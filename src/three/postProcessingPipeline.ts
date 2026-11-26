import * as THREE from 'three';
import { RenderPipeline, type WebGPURenderer } from 'three/webgpu';
import {
  Fn,
  If,
  Loop,
  abs,
  atan,
  clamp,
  cos,
  dot,
  exp,
  float,
  int,
  length,
  max,
  metalness,
  min,
  mix,
  mrt,
  normalView,
  normalize,
  output,
  pass,
  pow,
  roughness,
  screenUV,
  select,
  smoothstep,
  step,
  uniform,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { ssr } from 'three/addons/tsl/display/SSRNode.js';
import { resolvePostProcessingConfig } from '../data/postProcessingPresets';
import type { PostProcessingConfig } from '../types/maker';
import { isIOSDevice } from './webglUtils';

export interface PostProcessingRenderContext {
  config?: PostProcessingConfig;
  sunPosition: THREE.Vector3;
  sunColor: THREE.Color;
  sunIntensity?: number;
  isDungeon?: boolean;
  dt: number;
  elapsedTime: number;
}

/**
 * Three.js r187 WebGPURenderer RenderPipeline combining:
 * 1. Linear-HDR scene pass (`pass(scene, camera)`)
 * 2. TSL Bloom (`bloom(...)`)
 * 3. Optical Sun Lens Flare + Anamorphic Streak Glint
 * 4. ACES Filmic Tone Mapping + sRGB Encoding
 * 5. Lightroom-style Color Grading & Cinematic Vignette
 */
export class PostProcessingPipeline {
  private static ssrGloballyUnsupported = false;

  private readonly renderer: WebGPURenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.Camera;
  private readonly isSoftwareGl: boolean;

  private renderPipeline: RenderPipeline | null = null;
  private scenePass: ReturnType<typeof pass> | null = null;
  private bloomPass: ReturnType<typeof bloom> | null = null;
  private ssrPass: ReturnType<typeof ssr> | null = null;
  private ssrBuilt = false;
  private ssrFailed = PostProcessingPipeline.ssrGloballyUnsupported;
  private disposed = false;
  private activeCompileCount = 0;
  private compileQueue: Promise<void> = Promise.resolve();
  private pendingResize: { width: number; height: number } | null = null;
  private lastAppliedScaledW = -1;
  private lastAppliedScaledH = -1;

  private width = 1;
  private height = 1;
  private smoothedFlareVis = 0;

  // Live TSL uniforms updated per-frame with zero allocations
  private readonly uAspect = uniform(1.5);
  private readonly uTime = uniform(0);
  private readonly uBaseExposure = uniform(1.0);
  private readonly uBloomEnabled = uniform(0.0);
  private readonly uSsrMaxRoughness = uniform(0.55);

  private readonly uFlareEnabled = uniform(0.0);
  private readonly uFlareIntensity = uniform(0.65);
  private readonly uFlareGhosts = uniform(0.6);
  private readonly uFlareHalo = uniform(0.55);
  private readonly uSunScreenPos = uniform(new THREE.Vector2(0.5, 0.25));
  private readonly uSunVisibility = uniform(0.0);
  private readonly uSunColor = uniform(new THREE.Color('#FFF2D6'));

  private readonly uGradeEnabled = uniform(0.0);
  private readonly uExposure = uniform(1.0);
  private readonly uContrast = uniform(0.0);
  private readonly uSaturation = uniform(0.0);
  private readonly uTemperature = uniform(0.0);
  private readonly uTint = uniform(0.0);
  private readonly uHighlightsWarmth = uniform(0.0);
  private readonly uShadowsCoolness = uniform(0.0);
  private readonly uVignette = uniform(0.0);
  private readonly uVignetteSoftness = uniform(0.55);

  // Reusable zero-GC math scratch vectors
  private readonly _sunDir = new THREE.Vector3();
  private readonly _sunWorld = new THREE.Vector3();
  private readonly _camForward = new THREE.Vector3();
  private readonly _projected = new THREE.Vector3();
  private readonly _drawingSize = new THREE.Vector2();

  constructor(
    renderer: WebGPURenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    width: number,
    height: number,
    isSoftwareGl: boolean
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.isSoftwareGl = isSoftwareGl;
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
  }

  private disposePipelineNodes(): void {
    if (this.ssrPass) {
      this.ssrPass.dispose();
      this.ssrPass = null;
    }
    if (this.bloomPass) {
      this.bloomPass.dispose();
      this.bloomPass = null;
    }
    if (this.scenePass) {
      this.scenePass.dispose();
      this.scenePass = null;
    }
    if (this.renderPipeline) {
      this.renderPipeline.dispose();
      this.renderPipeline = null;
    }
    this.ssrBuilt = false;
  }

  private initPipeline(enableSsr: boolean): void {
    this.disposePipelineNodes();

    const pipeline = new RenderPipeline(this.renderer);
    // Custom final TSL pass performs ACES Filmic + linear-to-sRGB + Color Grading cleanly
    pipeline.outputColorTransform = false;

    const scenePass = pass(this.scene, this.camera);
    const uSsrMaxRoughness = this.uSsrMaxRoughness;

    let ssrPass: ReturnType<typeof ssr> | null = null;
    let scenePassMetalRough: ReturnType<typeof scenePass.getTextureNode> | null = null;
    if (enableSsr) {
      scenePass.setMRT(
        mrt({
          output,
          normal: normalView,
          metalrough: vec2(metalness, roughness),
        })
      );
      const scenePassColor = scenePass.getTextureNode('output');
      const scenePassDepth = scenePass.getTextureNode('depth');
      const scenePassNormal = scenePass.getTextureNode('normal');
      scenePassMetalRough = scenePass.getTextureNode('metalrough');
      const pbrSurfaceMask = smoothstep(0.015, 0.05, scenePassMetalRough.g);
      const dielectricGloss = smoothstep(
        uSsrMaxRoughness,
        0.04,
        scenePassMetalRough.g
      )
        .mul(pbrSurfaceMask)
        .mul(0.55);
      const reflectWeight = max(scenePassMetalRough.r, dielectricGloss);

      ssrPass = ssr(
        scenePassColor,
        scenePassDepth,
        scenePassNormal as unknown as Parameters<typeof ssr>[2],
        {
          metalnessNode: reflectWeight,
          roughnessNode: scenePassMetalRough.g,
          stochastic: false,
          reflectNonMetals: true,
          camera: this.camera,
        }
      );
      ssrPass.resolutionScale = 0.5;
      ssrPass.maxDistance.value = 18;
      ssrPass.thickness.value = 0.25;
      ssrPass.quality.value = 0.45;
      ssrPass.intensity.value = 0.65;
    }

    const sceneColorTex = scenePass.getTextureNode('output');
    const bloomPass = bloom(sceneColorTex, 0.48, 0.55, 0.72);

    const uAspect = this.uAspect;
    const uTime = this.uTime;
    const uBaseExposure = this.uBaseExposure;
    const uBloomEnabled = this.uBloomEnabled;
    const uFlareEnabled = this.uFlareEnabled;
    const uFlareIntensity = this.uFlareIntensity;
    const uFlareGhosts = this.uFlareGhosts;
    const uFlareHalo = this.uFlareHalo;
    const uSunScreenPos = this.uSunScreenPos;
    const uSunVisibility = this.uSunVisibility;
    const uSunColor = this.uSunColor;
    const uGradeEnabled = this.uGradeEnabled;
    const uExposure = this.uExposure;
    const uContrast = this.uContrast;
    const uSaturation = this.uSaturation;
    const uTemperature = this.uTemperature;
    const uTint = this.uTint;
    const uHighlightsWarmth = this.uHighlightsWarmth;
    const uShadowsCoolness = this.uShadowsCoolness;
    const uVignette = this.uVignette;
    const uVignetteSoftness = this.uVignetteSoftness;

    const ghostDisc = (uvA: any, posA: any, radius: number, sharpness: number) => {
      const d = length(uvA.sub(posA));
      const inner = Math.min(radius - 0.0005, Math.max(0.0001, radius * (1.0 - sharpness)));
      const core = float(1.0).sub(smoothstep(inner, radius, d));
      const rim = float(1.0)
        .sub(smoothstep(radius * 0.84, radius * 1.08, d))
        .mul(smoothstep(radius * 0.62, radius * 0.88, d));
      return core.mul(0.55).add(rim.mul(0.45));
    };

    const acesFilmicTsl = (cIn: any) => {
      const c = vec3(cIn).mul(0.6);
      const rIn = float(0.59719).mul(c.r).add(float(0.35458).mul(c.g)).add(float(0.04823).mul(c.b));
      const gIn = float(0.076).mul(c.r).add(float(0.90834).mul(c.g)).add(float(0.01566).mul(c.b));
      const bIn = float(0.0284).mul(c.r).add(float(0.13383).mul(c.g)).add(float(0.83777).mul(c.b));
      const v = vec3(rIn, gIn, bIn);

      const a = v.mul(v.add(0.0245786)).sub(0.000090537);
      const b = v.mul(v.mul(0.983729).add(0.432951)).add(0.238081);
      const o = a.div(b);

      const rOut = float(1.60475).mul(o.r).add(float(-0.53108).mul(o.g)).add(float(-0.07367).mul(o.b));
      const gOut = float(-0.10208).mul(o.r).add(float(1.10813).mul(o.g)).add(float(-0.00605).mul(o.b));
      const bOut = float(-0.00327).mul(o.r).add(float(-0.07276).mul(o.g)).add(float(1.07602).mul(o.b));
      return clamp(vec3(rOut, gOut, bOut), 0.0, 1.0);
    };

    const linearToSrgbTsl = (c: any) => {
      const lo = c.mul(12.92);
      const hi = pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)).mul(1.055).sub(0.055);
      return mix(lo, hi, step(vec3(0.0031308), c));
    };

    const finalOutputNode = Fn(() => {
      const uvCoord = screenUV;
      const baseTexel = sceneColorTex.sample(uvCoord);
      const col = baseTexel.rgb.toVar();

      // Optional r187 Screen-Space Reflections blended in linear HDR space (ignore unlit roughness=0 surfaces like grass/sky)
      if (ssrPass && scenePassMetalRough) {
        const mr = scenePassMetalRough.sample(uvCoord);
        const pbrValid = smoothstep(0.015, 0.05, mr.g);
        const surfMask = max(mr.r, smoothstep(uSsrMaxRoughness, 0.04, mr.g).mul(pbrValid));
        col.addAssign(min(ssrPass.rgb, vec3(1.6)).mul(surfMask));
      }

      // Add optional Bloom contribution in linear HDR space
      If(uBloomEnabled.greaterThan(0.5), () => {
        col.addAssign(bloomPass.rgb);
      });

      // 1. Optical sun lens flare + horizontal anamorphic highlight streak in linear HDR
      If(uFlareEnabled.greaterThan(0.5).and(uFlareIntensity.greaterThan(0.001)), () => {
        If(uSunVisibility.greaterThan(0.001), () => {
          const aspectScale = vec2(uAspect, 1.0);
          const uvA = uvCoord.sub(0.5).mul(aspectScale);
          const sunA = uSunScreenPos.sub(0.5).mul(aspectScale);
          const diff = uvA.sub(sunA);
          const dist = length(diff);
          const angle = atan(diff.y, diff.x);

          const flare = vec3(0.0).toVar();
          const core = exp(dist.mul(-7.5)).mul(0.72).add(exp(dist.mul(-2.4)).mul(0.28));
          const rot = uTime.mul(0.04);
          const rays6 = pow(max(0.0, cos(angle.add(rot).mul(6.0)).mul(0.5).add(0.5)), 10.0);
          const rays12 = pow(
            max(0.0, cos(angle.sub(rot.mul(0.6)).mul(12.0).add(0.5)).mul(0.5).add(0.5)),
            16.0
          );
          const rayFalloff = exp(dist.mul(-3.1));
          const starburst = rays6.mul(0.68).add(rays12.mul(0.38)).mul(rayFalloff);
          flare.addAssign(uSunColor.mul(core.add(starburst.mul(0.95))));

          const streakY = exp(abs(diff.y).mul(-28.0));
          const streakX = exp(abs(diff.x).mul(-1.55));
          const streakTint = mix(uSunColor, vec3(0.72, 0.88, 1.0), 0.35);
          flare.addAssign(streakTint.mul(streakY).mul(streakX).mul(float(0.45).add(uFlareHalo.mul(0.75))));

          If(uFlareGhosts.greaterThan(0.001), () => {
            const axis = sunA.negate();
            const ghosts = vec3(0.0).toVar();

            const g1 = mix(sunA, axis, 0.32);
            ghosts.addAssign(vec3(1.0, 0.78, 0.48).mul(ghostDisc(uvA, g1, 0.11, 0.45)).mul(0.22));

            const g2 = mix(sunA, axis, 0.58);
            const chDir = normalize(axis.sub(sunA).add(vec2(0.0001, 0.0001)));
            const g2r = ghostDisc(uvA, g2.add(chDir.mul(0.012)), 0.075, 0.5);
            const g2g = ghostDisc(uvA, g2, 0.075, 0.5);
            const g2b = ghostDisc(uvA, g2.sub(chDir.mul(0.012)), 0.075, 0.5);
            ghosts.addAssign(vec3(g2r.mul(0.85), g2g, g2b.mul(1.15)).mul(0.24));

            const g3 = mix(sunA, axis, 0.86);
            ghosts.addAssign(vec3(0.45, 0.92, 0.88).mul(ghostDisc(uvA, g3, 0.048, 0.65)).mul(0.32));

            const g4 = mix(sunA, axis, 1.18);
            ghosts.addAssign(vec3(1.0, 0.62, 0.74).mul(ghostDisc(uvA, g4, 0.145, 0.35)).mul(0.18));

            const g5 = mix(sunA, axis, 1.48);
            ghosts.addAssign(vec3(0.58, 0.72, 1.0).mul(ghostDisc(uvA, g5, 0.095, 0.4)).mul(0.22));

            flare.addAssign(ghosts.mul(uSunColor).mul(uFlareGhosts));
          });

          If(uFlareHalo.greaterThan(0.001), () => {
            const haloCenter = sunA.mul(-0.68);
            const hDiff = uvA.sub(haloCenter);
            const hDist = length(hDiff);
            const rRing = exp(pow(hDist.sub(0.34).mul(16.0), 2.0).negate());
            const gRing = exp(pow(hDist.sub(0.325).mul(16.0), 2.0).negate());
            const bRing = exp(pow(hDist.sub(0.31).mul(16.0), 2.0).negate());
            const rainbowHalo = vec3(rRing.mul(1.05), gRing.mul(0.96), bRing.mul(1.12));
            const haloArc = float(0.55).add(
              float(0.45).mul(cos(atan(hDiff.y, hDiff.x).sub(atan(sunA.y, sunA.x))))
            );
            flare.addAssign(rainbowHalo.mul(haloArc).mul(0.18).mul(uFlareHalo));
          });

          col.addAssign(flare.mul(uSunVisibility).mul(uFlareIntensity));
        });

        // Horizontal anamorphic highlight streak sampled from bright HDR pixels
        const streakAccum = vec3(0.0).toVar();
        const totalW = float(0.0).toVar();
        const texelX = float(0.0075 * 2.2);
        Loop({ start: int(-4), end: int(5), type: 'int', condition: '<' }, ({ i }) => {
          const fi = float(i);
          const w = exp(abs(fi).mul(-0.42));
          const sampleUv = clamp(uvCoord.add(vec2(fi.mul(texelX), 0.0)), vec2(0.001), vec2(0.999));
          const s = sceneColorTex.sample(sampleUv).rgb;
          const lum = dot(s, vec3(0.2126, 0.7152, 0.0722));
          const bright = max(s.sub(vec3(0.78)), vec3(0.0)).mul(smoothstep(0.65, 1.25, lum));
          streakAccum.addAssign(bright.mul(w));
          totalW.addAssign(w);
        });
        const glintTint = mix(uSunColor, vec3(0.76, 0.9, 1.0), 0.38);
        col.addAssign(
          streakAccum
            .div(max(0.001, totalW))
            .mul(glintTint)
            .mul(float(0.28).add(uFlareHalo.mul(0.45)))
            .mul(uFlareIntensity)
        );
      });

      // 2. Exposure + ACES Filmic tone mapping
      const expMult = uBaseExposure.mul(select(uGradeEnabled.greaterThan(0.5), uExposure, float(1.0)));
      col.mulAssign(expMult);
      col.assign(acesFilmicTsl(col));

      // 3. Linear -> sRGB encoding
      col.assign(linearToSrgbTsl(col));

      // 4. Perceptual sRGB Color Grading
      If(uGradeEnabled.greaterThan(0.5), () => {
        const wb = vec3(
          float(1.0).add(uTemperature.mul(0.22)).add(uTint.mul(0.12)),
          float(1.0).add(uTemperature.mul(0.03)).sub(uTint.mul(0.14)),
          float(1.0).sub(uTemperature.mul(0.24)).add(uTint.mul(0.12))
        );
        col.assign(clamp(col.mul(wb), 0.0, 1.0));

        const cFactor = float(1.0).add(uContrast.mul(1.15));
        col.assign(clamp(col.sub(0.5).mul(cFactor).add(0.5), 0.0, 1.0));

        const luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col.assign(clamp(mix(vec3(luma, luma, luma), col, float(1.0).add(uSaturation)), 0.0, 1.0));

        const shadowMask = float(1.0).sub(smoothstep(0.0, 0.58, luma));
        const highlightMask = smoothstep(0.42, 1.0, luma);
        const shadowShift = vec3(-0.14, 0.02, 0.22).mul(uShadowsCoolness);
        const highlightShift = vec3(0.22, 0.1, -0.14).mul(uHighlightsWarmth);
        col.assign(
          clamp(col.add(shadowShift.mul(shadowMask)).add(highlightShift.mul(highlightMask)), 0.0, 1.0)
        );
      });

      // 5. Independent Cinematic Vignette
      If(uVignette.greaterThan(0.001), () => {
        const vPos = uvCoord.sub(0.5).mul(vec2(uAspect.min(1.48), 1.0));
        const vDist = dot(vPos, vPos);
        const soft = clamp(uVignetteSoftness, 0.1, 1.0);
        const innerEdge = mix(0.26, 0.08, soft);
        const outerEdge = mix(0.64, 1.02, soft);
        const vig = float(1.0).sub(smoothstep(innerEdge, outerEdge, vDist).mul(uVignette).mul(0.86));
        col.mulAssign(clamp(vig, 0.06, 1.0));
      });

      return vec4(col, baseTexel.a);
    })();

    pipeline.outputNode = finalOutputNode;
    this.renderPipeline = pipeline;
    this.scenePass = scenePass;
    this.bloomPass = bloomPass;
    this.ssrPass = ssrPass;
    this.ssrBuilt = enableSsr;

    const pr = this.renderer.getPixelRatio();
    const scaledW = Math.max(1, Math.floor(this.width * pr));
    const scaledH = Math.max(1, Math.floor(this.height * pr));
    if (isIOSDevice()) {
      const rt = (this.scenePass as unknown as { renderTarget?: THREE.RenderTarget }).renderTarget;
      if (rt) rt.samples = 0;
    }
    this.scenePass.setSize(scaledW, scaledH);
    this.ssrPass?.setSize(scaledW, scaledH);
    this.lastAppliedScaledW = scaledW;
    this.lastAppliedScaledH = scaledH;
  }

  public isPrecompiling(): boolean {
    return this.activeCompileCount > 0;
  }

  private applyPassTargetSize(w: number, h: number): void {
    this.width = Math.max(1, Math.floor(w));
    this.height = Math.max(1, Math.floor(h));
    const pr = this.renderer.getPixelRatio();
    const scaledW = Math.max(1, Math.floor(this.width * pr));
    const scaledH = Math.max(1, Math.floor(this.height * pr));
    if (scaledW === this.lastAppliedScaledW && scaledH === this.lastAppliedScaledH) {
      return;
    }
    this.lastAppliedScaledW = scaledW;
    this.lastAppliedScaledH = scaledH;
    if (this.scenePass) {
      this.scenePass.setSize(scaledW, scaledH);
    }
    if (this.ssrPass) {
      this.ssrPass.setSize(scaledW, scaledH);
    }
  }

  public setSize(width: number, height: number): void {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    // Never dispose RenderTarget/depthTexture mid-compileAsync while WebGPU pipelines are queued
    if (this.activeCompileCount > 0) {
      this.pendingResize = { width: w, height: h };
      return;
    }
    this.applyPassTargetSize(w, h);
  }

  private resolveFlags(config?: PostProcessingConfig): {
    cfg: ReturnType<typeof resolvePostProcessingConfig>;
    vignetteOn: boolean;
    ssrRequested: boolean;
    anyEffectActive: boolean;
  } {
    const cfg = resolvePostProcessingConfig(config);
    const vignetteOn = (cfg.vignetteEnabled ?? true) && cfg.vignette > 0.001;
    const ssrRequested =
      !isIOSDevice() &&
      !this.ssrFailed &&
      !PostProcessingPipeline.ssrGloballyUnsupported &&
      Boolean(cfg.ssrEnabled) &&
      (cfg.ssrIntensity ?? 0.65) > 0.001;
    const anyEffectActive =
      cfg.enabled &&
      (cfg.bloomEnabled ||
        cfg.lensFlareEnabled ||
        cfg.colorGradingEnabled ||
        vignetteOn ||
        ssrRequested);
    return { cfg, vignetteOn, ssrRequested, anyEffectActive };
  }

  private ensurePipeline(ssrRequested: boolean): void {
    if (!this.renderPipeline || ssrRequested !== this.ssrBuilt) {
      try {
        this.initPipeline(ssrRequested);
      } catch (ssrErr) {
        console.warn('SSR pipeline init failed; falling back to non-SSR post pipeline:', ssrErr);
        this.ssrFailed = true;
        PostProcessingPipeline.ssrGloballyUnsupported = true;
        this.initPipeline(false);
      }
    }
  }

  public precompileAsync(
    config?: PostProcessingConfig,
    targetObject?: THREE.Object3D
  ): Promise<void> {
    if (this.disposed) return Promise.resolve();

    const task = this.compileQueue.then(() => this.runPrecompileAsync(config, targetObject));
    this.compileQueue = task.catch(() => {});
    return task;
  }

  private async runPrecompileAsync(
    config?: PostProcessingConfig,
    targetObject?: THREE.Object3D
  ): Promise<void> {
    if (this.disposed) return;
    const { ssrRequested, anyEffectActive } = this.resolveFlags(config);

    if (!anyEffectActive || this.isSoftwareGl) {
      this.activeCompileCount++;
      try {
        await this.renderer.compileAsync(
          targetObject ?? this.scene,
          this.camera,
          targetObject ? this.scene : null
        );
      } catch {
        // ignore precompile failures on fallback/disposed targets
      } finally {
        this.activeCompileCount = Math.max(0, this.activeCompileCount - 1);
      }
      return;
    }

    this.ensurePipeline(ssrRequested);
    if (this.disposed || !this.scenePass) return;

    const passNode = this.scenePass as unknown as {
      renderTarget: THREE.RenderTarget;
      getMRT: () => unknown;
      setSize: (w: number, h: number) => void;
      compileAsync: (r: WebGPURenderer) => Promise<void>;
    };

    const outputTypeFn = (this.renderer as unknown as { getOutputBufferType?: () => THREE.TextureDataType })
      .getOutputBufferType;
    if (typeof outputTypeFn === 'function') {
      passNode.renderTarget.texture.type = outputTypeFn.call(this.renderer);
    }
    passNode.renderTarget.samples = isIOSDevice() ? 0 : this.renderer.samples;
    this.renderer.getDrawingBufferSize(this._drawingSize);
    const dbW = Math.max(1, Math.floor(this._drawingSize.x));
    const dbH = Math.max(1, Math.floor(this._drawingSize.y));
    if (passNode.renderTarget.width !== dbW || passNode.renderTarget.height !== dbH) {
      passNode.setSize(dbW, dbH);
      this.lastAppliedScaledW = dbW;
      this.lastAppliedScaledH = dbH;
    }

    this.activeCompileCount++;
    try {
      if (!targetObject) {
        try {
          await passNode.compileAsync(this.renderer);
        } catch (err) {
          if (this.ssrBuilt) {
            console.warn('SSR precompile failed; disabling SSR and retrying:', err);
            this.ssrFailed = true;
            PostProcessingPipeline.ssrGloballyUnsupported = true;
            this.initPipeline(false);
            if (!this.disposed && this.scenePass) {
              await (this.scenePass as unknown as typeof passNode).compileAsync(this.renderer);
            }
          }
        }
        return;
      }

      const prevTarget = this.renderer.getRenderTarget();
      const prevMrt = this.renderer.getMRT();
      this.renderer.setRenderTarget(passNode.renderTarget);
      this.renderer.setMRT(passNode.getMRT() as Parameters<WebGPURenderer['setMRT']>[0]);
      try {
        await this.renderer.compileAsync(targetObject, this.camera, this.scene);
      } catch {
        // ignore precompile errors on transient/disposed objects
      } finally {
        if (!this.disposed) {
          this.renderer.setRenderTarget(prevTarget);
          this.renderer.setMRT(prevMrt);
        }
      }
    } finally {
      this.activeCompileCount = Math.max(0, this.activeCompileCount - 1);
      if (this.activeCompileCount === 0 && this.pendingResize && !this.disposed) {
        const next = this.pendingResize;
        this.pendingResize = null;
        this.applyPassTargetSize(next.width, next.height);
      }
    }
  }

  public render(ctx: PostProcessingRenderContext): void {
    if (this.disposed) return;
    const { cfg, vignetteOn, ssrRequested, anyEffectActive } = this.resolveFlags(ctx.config);

    // Protect screen draw if an async compileAsync batch yielded mid-flight with a PassNode RT/MRT bound
    const savedTarget = this.renderer.getRenderTarget();
    const savedMrt = this.renderer.getMRT();
    if (savedTarget !== null) {
      this.renderer.setRenderTarget(null);
    }
    if (savedMrt !== null) {
      this.renderer.setMRT(null);
    }

    try {
      // Zero-overhead bypass when Post-Processing is off or running on software WebGL
      if (!anyEffectActive || this.isSoftwareGl) {
        this.renderer.render(this.scene, this.camera);
        return;
      }

      // Lazily rebuild RenderPipeline with/without MRT + SSRNode only when toggled
      this.ensurePipeline(ssrRequested);

      if (!this.renderPipeline || !this.bloomPass) {
        this.renderer.render(this.scene, this.camera);
        return;
      }

    // 0. Update SSR parameters when active
    if (this.ssrPass && ssrRequested) {
      this.ssrPass.intensity.value = THREE.MathUtils.clamp(cfg.ssrIntensity ?? 0.65, 0, 1.5);
      this.uSsrMaxRoughness.value = THREE.MathUtils.clamp(cfg.ssrMaxRoughness ?? 0.55, 0.1, 0.9);
    }

    // 1. Update Bloom pass parameters
    const bloomOn = cfg.bloomEnabled && cfg.bloomIntensity > 0.001;
    this.uBloomEnabled.value = bloomOn ? 1.0 : 0.0;
    if (bloomOn) {
      this.bloomPass.strength.value = THREE.MathUtils.clamp(cfg.bloomIntensity, 0, 2.5);
      this.bloomPass.threshold.value = THREE.MathUtils.clamp(cfg.bloomThreshold, 0, 1.5);
      this.bloomPass.radius.value = THREE.MathUtils.clamp(cfg.bloomRadius, 0, 1.5);
    }

    // 2. Update Lens Flare uniforms (screenUV has y=0 at top, y=1 at bottom)
    this.uAspect.value = this.width / Math.max(1, this.height);
    this.uTime.value = ctx.elapsedTime;
    this.uBaseExposure.value = this.renderer.toneMappingExposure || 1.0;

    const flareOn = cfg.lensFlareEnabled && cfg.lensFlareIntensity > 0.001;
    this.uFlareEnabled.value = flareOn ? 1.0 : 0.0;
    this.uFlareIntensity.value = THREE.MathUtils.clamp(cfg.lensFlareIntensity, 0, 2.5);
    this.uFlareGhosts.value = THREE.MathUtils.clamp(cfg.lensFlareGhosts, 0, 1.8);
    this.uFlareHalo.value = THREE.MathUtils.clamp(cfg.lensFlareHalo, 0, 1.8);
    this.uSunColor.value.copy(ctx.sunColor);

    if (flareOn) {
      this._sunDir.copy(ctx.sunPosition);
      if (this._sunDir.lengthSq() < 0.0001) {
        this._sunDir.set(0.4, 0.6, 0.5);
      }
      this._sunDir.normalize();
      this.camera.getWorldDirection(this._camForward);
      const facing = this._camForward.dot(this._sunDir);

      let targetVis = 0;
      if (!ctx.isDungeon && facing > 0.02) {
        this._sunWorld.copy(this.camera.position).addScaledVector(this._sunDir, 500);
        this._projected.copy(this._sunWorld).project(this.camera);

        if (this._projected.z < 1.0) {
          const sx = this._projected.x * 0.5 + 0.5;
          const sy = 0.5 - this._projected.y * 0.5;
          this.uSunScreenPos.value.set(sx, sy);

          const edgeX = Math.max(0, Math.abs(sx - 0.5) - 0.42);
          const edgeY = Math.max(0, Math.abs(sy - 0.5) - 0.42);
          const edgeFade = 1.0 - THREE.MathUtils.smoothstep(Math.hypot(edgeX, edgeY), 0.0, 0.62);
          const elevFade = THREE.MathUtils.smoothstep(this._sunDir.y, -0.08, 0.14);
          const intensityScale = THREE.MathUtils.clamp((ctx.sunIntensity ?? 1.4) / 1.35, 0.25, 1.25);

          targetVis = THREE.MathUtils.clamp(
            edgeFade * elevFade * intensityScale * THREE.MathUtils.smoothstep(facing, 0.02, 0.24),
            0,
            1.15
          );
        }
      }

      this.smoothedFlareVis = THREE.MathUtils.damp(
        this.smoothedFlareVis,
        targetVis,
        12,
        Math.min(0.1, Math.max(0.001, ctx.dt))
      );
      this.uSunVisibility.value = this.smoothedFlareVis;
    } else {
      this.smoothedFlareVis = 0;
      this.uSunVisibility.value = 0;
    }

    // 3. Update Color Grading & Vignette uniforms
    this.uGradeEnabled.value = cfg.colorGradingEnabled ? 1.0 : 0.0;
    this.uExposure.value = THREE.MathUtils.clamp(cfg.exposure, 0.4, 2.2);
    this.uContrast.value = THREE.MathUtils.clamp(cfg.contrast, -0.6, 0.8);
    this.uSaturation.value = THREE.MathUtils.clamp(cfg.saturation, -1.0, 1.0);
    this.uTemperature.value = THREE.MathUtils.clamp(cfg.temperature, -1.0, 1.0);
    this.uTint.value = THREE.MathUtils.clamp(cfg.tint, -1.0, 1.0);
    this.uHighlightsWarmth.value = THREE.MathUtils.clamp(cfg.highlightsWarmth, -0.6, 0.6);
    this.uShadowsCoolness.value = THREE.MathUtils.clamp(cfg.shadowsCoolness, -0.6, 0.6);
    this.uVignette.value = vignetteOn ? THREE.MathUtils.clamp(cfg.vignette, 0, 1.0) : 0.0;
    this.uVignetteSoftness.value = THREE.MathUtils.clamp(cfg.vignetteSoftness ?? 0.55, 0.1, 1.0);

      // 4. Execute r187 RenderPipeline (auto-fallback if SSR fails on an incompatible driver)
      try {
        this.renderPipeline.render();
      } catch (err) {
        if (this.ssrBuilt) {
          console.warn('SSR render failed at runtime; disabling SSR and retrying:', err);
          this.ssrFailed = true;
          PostProcessingPipeline.ssrGloballyUnsupported = true;
          this.initPipeline(false);
          this.renderPipeline?.render();
        } else {
          throw err;
        }
      }
    } finally {
      if (savedTarget !== null) {
        this.renderer.setRenderTarget(savedTarget);
      }
      if (savedMrt !== null) {
        this.renderer.setMRT(savedMrt);
      }
    }
  }

  public dispose(): void {
    this.disposed = true;
    this.disposePipelineNodes();
  }
}
