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
  floor,
  fract,
  getViewPosition,
  int,
  interleavedGradientNoise,
  isBackgroundDepth,
  length,
  log2,
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
  screenCoordinate,
  screenUV,
  select,
  smoothstep,
  step,
  uniform,
  vec2,
  vec3,
  vec4,
  velocity,
} from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { ssr } from 'three/addons/tsl/display/SSRNode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { traa } from 'three/addons/tsl/display/TRAANode.js';
import { resolvePostProcessingConfig } from '../data/postProcessingPresets';
import type { PostProcessingConfig } from '../types/maker';
import { isIOSDevice } from './webglUtils';

export interface VolumetricFogRenderConfig {
  enabled?: boolean;
  density?: number;
  height?: number;
  softness?: number;
  sharpness?: number;
  noise?: number;
  patchiness?: number;
  speed?: number;
  wind?: number;
  fogColor?: THREE.Color;
  inscatterColor?: THREE.Color;
}

export interface PostProcessingRenderContext {
  config?: PostProcessingConfig;
  volumetricFog?: VolumetricFogRenderConfig;
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
type TraaPassLike = ReturnType<typeof traa> & {
  getTextureNode: () => unknown;
  setSize: (width: number, height: number) => void;
  dispose: () => void;
};

export class PostProcessingPipeline {
  private static ssrGloballyUnsupported = false;
  private static gtaoGloballyUnsupported = false;
  private static traaGloballyUnsupported = false;

  private readonly renderer: WebGPURenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.Camera;
  private readonly isSoftwareGl: boolean;

  private renderPipeline: RenderPipeline | null = null;
  private scenePass: ReturnType<typeof pass> | null = null;
  private bloomPass: ReturnType<typeof bloom> | null = null;
  private ssrPass: ReturnType<typeof ssr> | null = null;
  private gtaoPass: ReturnType<typeof ao> | null = null;
  private traaPass: TraaPassLike | null = null;
  private ssrBuilt = false;
  private gtaoBuilt = false;
  private traaBuilt = false;
  private ssrFailed = PostProcessingPipeline.ssrGloballyUnsupported;
  private gtaoFailed = PostProcessingPipeline.gtaoGloballyUnsupported;
  private traaFailed = PostProcessingPipeline.traaGloballyUnsupported;
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
  private readonly uToneMappingMode = uniform(1.0); // 1.0 = AgX, 0.0 = ACES Filmic
  private readonly uGtaoStrength = uniform(0.0);
  private readonly uGodRaysEnabled = uniform(0.0);
  private readonly uGodRaysIntensity = uniform(0.52);

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

  // Volumetric 3D ray-marched height fog uniforms
  private readonly uCamWorldMatrix = uniform(new THREE.Matrix4());
  private readonly uCamProjInv = uniform(new THREE.Matrix4());
  private readonly uCamPos = uniform(new THREE.Vector3());
  private readonly uSunDir3D = uniform(new THREE.Vector3(0.45, 0.72, 0.42));
  private readonly uVolFogEnabled = uniform(0.0);
  private readonly uVolFogDensity = uniform(1.0);
  private readonly uVolFogHeight = uniform(2.2);
  private readonly uVolFogSoftness = uniform(8.5);
  private readonly uVolFogSharpness = uniform(0.3);
  private readonly uVolFogNoise = uniform(0.95);
  private readonly uVolFogPatchiness = uniform(0.45);
  private readonly uVolFogSpeed = uniform(0.75);
  private readonly uVolFogWind = uniform(0.45);
  private readonly uVolFogColor = uniform(new THREE.Color('#B8CDE0'));
  private readonly uVolFogInscatterColor = uniform(new THREE.Color('#FFE8BC'));

  // Reusable zero-GC math scratch vectors
  private readonly _sunDir = new THREE.Vector3();
  private readonly _sunWorld = new THREE.Vector3();
  private readonly _camForward = new THREE.Vector3();
  private readonly _projected = new THREE.Vector3();
  private readonly _drawingSize = new THREE.Vector2();
  private readonly _defaultFogCol = new THREE.Color('#B8CDE0');
  private readonly _defaultInscatterCol = new THREE.Color('#FFE8BC');

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
    if (this.traaPass) {
      this.traaPass.dispose();
      this.traaPass = null;
    }
    if (this.gtaoPass) {
      this.gtaoPass.dispose();
      this.gtaoPass = null;
    }
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
    this.gtaoBuilt = false;
    this.traaBuilt = false;
  }

  private initPipeline(enableSsr: boolean, enableGtao: boolean, enableTraa: boolean): void {
    this.disposePipelineNodes();

    const pipeline = new RenderPipeline(this.renderer);
    // Custom final TSL pass performs AgX / ACES Filmic + linear-to-sRGB + Color Grading cleanly
    pipeline.outputColorTransform = false;

    const scenePass = pass(this.scene, this.camera);
    const uSsrMaxRoughness = this.uSsrMaxRoughness;

    if (enableSsr || enableTraa) {
      const mrtTargets: Record<string, any> = { output };
      if (enableSsr) {
        mrtTargets.normal = normalView;
        mrtTargets.metalrough = vec2(metalness, roughness);
      }
      if (enableTraa) {
        mrtTargets.velocity = velocity;
      }
      scenePass.setMRT(mrt(mrtTargets));
    }

    const sceneColorTex = scenePass.getTextureNode('output');
    const sceneDepthTex = scenePass.getTextureNode('depth');

    let ssrPass: ReturnType<typeof ssr> | null = null;
    let scenePassMetalRough: ReturnType<typeof scenePass.getTextureNode> | null = null;
    let scenePassNormal: ReturnType<typeof scenePass.getTextureNode> | null = null;
    if (enableSsr) {
      scenePassNormal = scenePass.getTextureNode('normal');
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
        sceneColorTex,
        sceneDepthTex,
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

    // Opt-in Temporal Reprojection Anti-Aliasing (TRAA): requires velocity MRT & samples = 0
    let traaPass: TraaPassLike | null = null;
    let beautyColorTex: ReturnType<typeof scenePass.getTextureNode> = sceneColorTex;
    if (enableTraa) {
      const sceneVelocityTex = scenePass.getTextureNode('velocity');
      traaPass = traa(
        sceneColorTex,
        sceneDepthTex,
        sceneVelocityTex,
        this.camera
      ) as unknown as TraaPassLike;
      beautyColorTex = traaPass.getTextureNode() as unknown as ReturnType<
        typeof scenePass.getTextureNode
      >;
    }

    // Half-res Ground-Truth Ambient Occlusion (reuses MRT normal if SSR active, else reconstructs from depth!)
    let gtaoPass: ReturnType<typeof ao> | null = null;
    let gtaoTex: ReturnType<ReturnType<typeof ao>['getTextureNode']> | null = null;
    if (enableGtao) {
      gtaoPass = ao(
        sceneDepthTex,
        (scenePassNormal as unknown as Parameters<typeof ao>[1]) ?? null,
        this.camera
      );
      gtaoPass.resolutionScale = 0.5;
      gtaoPass.samples.value = 8;
      gtaoPass.radius.value = 0.85;
      gtaoPass.thickness.value = 1.0;
      gtaoPass.scale.value = 1.05;
      gtaoTex = gtaoPass.getTextureNode();
    }

    const bloomPass = bloom(beautyColorTex, 0.48, 0.55, 0.72);

    const uAspect = this.uAspect;
    const uTime = this.uTime;
    const uBaseExposure = this.uBaseExposure;
    const uBloomEnabled = this.uBloomEnabled;
    const uToneMappingMode = this.uToneMappingMode;
    const uGtaoStrength = this.uGtaoStrength;
    const uGodRaysEnabled = this.uGodRaysEnabled;
    const uGodRaysIntensity = this.uGodRaysIntensity;
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
    const uCamWorldMatrix = this.uCamWorldMatrix;
    const uCamProjInv = this.uCamProjInv;
    const uCamPos = this.uCamPos;
    const uSunDir3D = this.uSunDir3D;
    const uVolFogEnabled = this.uVolFogEnabled;
    const uVolFogDensity = this.uVolFogDensity;
    const uVolFogHeight = this.uVolFogHeight;
    const uVolFogSoftness = this.uVolFogSoftness;
    const uVolFogSharpness = this.uVolFogSharpness;
    const uVolFogNoise = this.uVolFogNoise;
    const uVolFogPatchiness = this.uVolFogPatchiness;
    const uVolFogSpeed = this.uVolFogSpeed;
    const uVolFogWind = this.uVolFogWind;
    const uVolFogColor = this.uVolFogColor;
    const uVolFogInscatterColor = this.uVolFogInscatterColor;

    // Pure arithmetic 2D hash & bilinear value noise (artifact-free across WebGPU & WebGL2)
    const hash21 = (p: any) => {
      const p3 = fract(vec3(p.x, p.y, p.x).mul(0.1031));
      const p3d = dot(p3, vec3(p3.y, p3.z, p3.x).add(33.33));
      const p3s = p3.add(vec3(p3d));
      return fract(p3s.x.add(p3s.y).mul(p3s.z));
    };

    const vnoise2 = (p: any) => {
      const i = floor(p);
      const f = fract(p);
      const u = f.mul(f).mul(vec2(3.0, 3.0).sub(f.mul(2.0)));
      const a = hash21(i);
      const b = hash21(i.add(vec2(1.0, 0.0)));
      const c = hash21(i.add(vec2(0.0, 1.0)));
      const d = hash21(i.add(vec2(1.0, 1.0)));
      return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    };

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

    // Troy Sobotka AgX Filmic tone mapper in pure TSL (creamy highlight roll-off, no neon sunset clipping)
    const agxToneMappingTsl = (cIn: any) => {
      const c = max(vec3(cIn), vec3(1e-6));
      // AgX inset matrix (Linear Rec.709 -> AgX log working space)
      const rIn = float(0.842479062253094).mul(c.r).add(float(0.0784335999999992).mul(c.g)).add(float(0.0792237451477643).mul(c.b));
      const gIn = float(0.0423282422610123).mul(c.r).add(float(0.878468636469772).mul(c.g)).add(float(0.0791661274605434).mul(c.b));
      const bIn = float(0.0423756549057051).mul(c.r).add(float(0.0784336).mul(c.g)).add(float(0.879142973793104).mul(c.b));
      const inset = max(vec3(rIn, gIn, bIn), vec3(1e-6));
      const ev = clamp(log2(inset), vec3(-12.47393), vec3(4.026069));
      const x = ev.sub(-12.47393).div(16.5);
      // 6th-order AgX default contrast approximation sigmoid
      const x2 = x.mul(x);
      const x4 = x2.mul(x2);
      const sig = x4
        .mul(x2)
        .mul(15.5)
        .sub(x4.mul(x).mul(40.14))
        .add(x4.mul(31.96))
        .sub(x2.mul(x).mul(6.868))
        .add(x2.mul(0.4298))
        .add(x.mul(0.1191))
        .sub(0.00232);
      // AgX outset matrix back to Linear Rec.709 (preserving rich stylized/realistic chroma)
      const rOut = float(1.19687900512017).mul(sig.r).add(float(-0.0980208811401368).mul(sig.g)).add(float(-0.0990297440797205).mul(sig.b));
      const gOut = float(-0.0528968517574562).mul(sig.r).add(float(1.15190312990417).mul(sig.g)).add(float(-0.0989611768448433).mul(sig.b));
      const bOut = float(-0.0529716355144438).mul(sig.r).add(float(-0.0980434501171241).mul(sig.g)).add(float(1.15107367264116).mul(sig.b));
      // Undo sRGB power inside AgX output so our downstream linearToSrgbTsl remains uniform
      return pow(clamp(vec3(rOut, gOut, bOut), 0.0, 1.0), vec3(2.2));
    };

    const linearToSrgbTsl = (c: any) => {
      const lo = c.mul(12.92);
      const hi = pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)).mul(1.055).sub(0.055);
      return mix(lo, hi, step(vec3(0.0031308), c));
    };

    const finalOutputNode = Fn(() => {
      const uvCoord = screenUV;
      const baseTexel = beautyColorTex.sample(uvCoord);
      const col = baseTexel.rgb.toVar();

      // 0a. Half-Res Ground-Truth Ambient Occlusion (5-tap cross-filtered to remove half-res dither)
      if (gtaoTex) {
        If(uGtaoStrength.greaterThan(0.001), () => {
          const stepUv = vec2(0.0018, 0.0024);
          const aoC = gtaoTex.sample(uvCoord).r;
          const aoL = gtaoTex.sample(clamp(uvCoord.sub(vec2(stepUv.x, 0.0)), vec2(0.001), vec2(0.999))).r;
          const aoR = gtaoTex.sample(clamp(uvCoord.add(vec2(stepUv.x, 0.0)), vec2(0.001), vec2(0.999))).r;
          const aoU = gtaoTex.sample(clamp(uvCoord.sub(vec2(0.0, stepUv.y)), vec2(0.001), vec2(0.999))).r;
          const aoD = gtaoTex.sample(clamp(uvCoord.add(vec2(0.0, stepUv.y)), vec2(0.001), vec2(0.999))).r;
          const aoSmooth = clamp(aoC.mul(0.36).add(aoL.add(aoR).add(aoU).add(aoD).mul(0.16)), 0.0, 1.0);
          // Protect sky background pixels (depth ~ 1.0) so sky never darkens
          const centerDepth = sceneDepthTex.sample(uvCoord).r;
          const skyProtect = smoothstep(0.9992, 0.996, centerDepth);
          const aoFactor = mix(float(1.0), aoSmooth, clamp(uGtaoStrength, 0.0, 1.6).mul(skyProtect));
          // Slightly cool-tinted crevice shadows instead of muddy black
          const aoTint = mix(vec3(0.76, 0.82, 0.94), vec3(1.0), aoFactor);
          col.mulAssign(mix(vec3(aoFactor), aoTint.mul(aoFactor), 0.35));
        });
      }

      // 0b. Optional r187 Screen-Space Reflections blended in linear HDR space (ignore unlit roughness=0 surfaces like grass/sky)
      if (ssrPass && scenePassMetalRough) {
        const mr = scenePassMetalRough.sample(uvCoord);
        const pbrValid = smoothstep(0.015, 0.05, mr.g);
        const surfMask = max(mr.r, smoothstep(uSsrMaxRoughness, 0.04, mr.g).mul(pbrValid));
        col.addAssign(min(ssrPass.rgb, vec3(1.6)).mul(surfMask));
      }

      // 0c. True 3D Screen-Space Ray-Marched Volumetric Height Fog (no horizontal geometry cut lines)
      If(uVolFogEnabled.greaterThan(0.5).and(uVolFogDensity.greaterThan(0.005)), () => {
        const cDepth = sceneDepthTex.sample(uvCoord).r;
        const isSky = isBackgroundDepth(cDepth);
        const midView = getViewPosition(uvCoord, float(0.5), uCamProjInv);
        const midWorld = uCamWorldMatrix.mul(vec4(midView, 1.0)).xyz;
        const rayDir = normalize(midWorld.sub(uCamPos));

        const clampedDepth = select(isSky, float(0.5), cDepth);
        const hitView = getViewPosition(uvCoord, clampedDepth, uCamProjInv);
        const hitWorld = uCamWorldMatrix.mul(vec4(hitView, 1.0)).xyz;
        const hitDist = length(hitWorld.sub(uCamPos));
        const maxMarchDist = select(isSky, float(130.0), min(hitDist, float(130.0)));

        const skyZenithFade = select(
          isSky,
          float(1.0).sub(smoothstep(float(0.04), float(0.44), max(float(0.0), rayDir.y))),
          float(1.0)
        );

        If(maxMarchDist.greaterThan(0.25).and(skyZenithFade.greaterThan(0.005)), () => {
          const jitter = interleavedGradientNoise(screenCoordinate.xy);
          const marchSteps = float(14.0);
          const stepLen = maxMarchDist.div(marchSteps);

          const windSpeed = float(0.45).add(uVolFogWind.mul(0.65));
          const driftPhase = uTime.mul(uVolFogSpeed).mul(windSpeed);
          const driftW1 = vec2(0.72, 0.34).mul(driftPhase);
          const driftW2 = vec2(-0.46, 0.56).mul(driftPhase);

          const spread = max(float(1.2), uVolFogSoftness);
          const sharp = clamp(uVolFogSharpness, 0.0, 1.0);
          const bandHalf = mix(float(0.50), float(0.13), sharp);
          const patchActive = smoothstep(float(0.0), float(0.08), uVolFogPatchiness);
          const patchCut = uVolFogPatchiness.mul(0.58);
          const patchEdge = mix(float(0.28), float(0.09), sharp);

          const cosTheta = dot(rayDir, uSunDir3D);
          const mie = pow(max(float(0.0001), cosTheta.mul(0.5).add(0.5)), float(4.5))
            .mul(0.85)
            .add(0.15);
          const stepScatterCol = mix(uVolFogColor, uVolFogInscatterColor, mie.mul(0.68));

          const transmittance = float(1.0).toVar();
          const fogAccum = vec3(0.0).toVar();

          Loop({ start: int(0), end: int(14), type: 'int', condition: '<' }, ({ i }) => {
            const stepT = float(i).add(jitter).div(marchSteps);
            const stepDist = stepT.mul(maxMarchDist);
            const samplePos = uCamPos.add(rayDir.mul(stepDist));

            // 3-octave domain-warped 3D drifting noise field
            const uvMacro = vec2(samplePos.x, samplePos.z)
              .mul(0.026)
              .add(vec2(samplePos.y.mul(0.05), samplePos.y.negate().mul(0.04)))
              .sub(driftW1.mul(0.042));
            const nMacro = vnoise2(uvMacro);

            const rotX = samplePos.x.mul(0.8).sub(samplePos.z.mul(0.6));
            const rotZ = samplePos.x.mul(0.6).add(samplePos.z.mul(0.8));
            const uvMed = vec2(rotX, rotZ)
              .mul(0.072)
              .add(vec2(nMacro.mul(1.35), nMacro.negate().mul(1.1)))
              .add(vec2(samplePos.y.mul(0.11), samplePos.y.mul(0.07)))
              .sub(driftW2.mul(0.072));
            const nMed = vnoise2(uvMed);

            const rotFX = samplePos.x.mul(0.6).add(samplePos.z.mul(0.8));
            const rotFZ = samplePos.z.mul(0.6).sub(samplePos.x.mul(0.8));
            const uvFine = vec2(rotFX, rotFZ)
              .mul(0.175)
              .add(vec2(nMed.mul(1.35), samplePos.y.mul(0.22)))
              .sub(driftW1.mul(0.11));
            const nFine = vnoise2(uvFine);

            const fbm = nMacro.mul(0.5).add(nMed.mul(0.34)).add(nFine.mul(0.16));

            // Organic vertical boundary undulation + spread & blur/sharpness envelope
            const ceilingWave = fbm
              .sub(0.5)
              .mul(uVolFogNoise)
              .mul(max(float(2.4), spread.mul(0.95)));
            const relY = samplePos.y.sub(uVolFogHeight.add(ceilingWave));
            const halfSpread = spread.mul(0.55);
            const hNorm = relY.add(halfSpread).div(max(float(1.0), spread.mul(1.1)));
            const noisePerturb = nMed.sub(0.5).mul(0.42).add(nFine.sub(0.5).mul(0.24)).mul(uVolFogNoise);
            const perturbedH = clamp(hNorm.sub(noisePerturb), float(-0.5), float(1.5));

            const rawHeightMask = float(1.0).sub(
              smoothstep(float(0.5).sub(bandHalf), float(0.5).add(bandHalf), perturbedH)
            );
            const softPow = pow(max(float(0.0001), rawHeightMask), float(1.45));
            const blurCurve = mix(softPow, rawHeightMask, sharp);
            const wispErode = smoothstep(
              mix(float(0.02), float(0.32), sharp),
              mix(float(0.45), float(0.68), sharp),
              fbm
            );
            const edgeDetail = mix(wispErode, float(1.0), smoothstep(float(0.24), float(0.76), blurCurve));

            // Patch separation (fog banks vs clearings)
            const bankSignal = nMacro.mul(0.75).add(nMed.mul(0.25));
            const rawPatchMask = smoothstep(patchCut.sub(patchEdge), patchCut.add(0.26), bankSignal);
            const patchMask = mix(float(1.0), rawPatchMask, patchActive);

            const nearFade = smoothstep(float(1.2), float(6.5), stepDist);
            const farFade = float(1.0).sub(smoothstep(float(82.0), float(130.0), stepDist));

            const stepDensity = blurCurve
              .mul(edgeDetail)
              .mul(patchMask)
              .mul(nearFade)
              .mul(farFade)
              .mul(skyZenithFade);

            const sigma = stepDensity.mul(uVolFogDensity).mul(0.052);
            const stepTrans = exp(sigma.mul(stepLen).negate());

            fogAccum.addAssign(stepScatterCol.mul(transmittance).mul(float(1.0).sub(stepTrans)));
            transmittance.mulAssign(stepTrans);
          });

          col.assign(col.mul(transmittance).add(fogAccum));
        });
      });

      // 0d. Depth-Occluded Volumetric Sun Shafts (14-tap dithered radial scatter toward sun)
      If(uGodRaysEnabled.greaterThan(0.5).and(uGodRaysIntensity.greaterThan(0.001)).and(uSunVisibility.greaterThan(0.005)), () => {
        const toSun = uSunScreenPos.sub(uvCoord);
        const aspectVec = vec2(uAspect, 1.0);
        const sunDist = length(toSun.mul(aspectVec));
        // Screen-space interleaved dither eliminates radial stepping bands
        const jitter = fract(dot(uvCoord.mul(vec2(128.4, 217.9)), vec2(12.9898, 78.233))).mul(0.09);
        const shaftAccum = float(0.0).toVar();
        const decay = float(1.0).toVar();
        Loop({ start: int(0), end: int(14), type: 'int', condition: '<' }, ({ i }) => {
          const t = float(i).add(0.5).add(jitter).div(14.0).mul(0.82);
          const sampleUv = clamp(uvCoord.add(toSun.mul(t)), vec2(0.002), vec2(0.998));
          const dSample = sceneDepthTex.sample(sampleUv).r;
          // Far sky pixels pass sunlight through gaps in trees, peaks, and cave mouths
          const skyMask = smoothstep(0.993, 0.9992, dSample);
          shaftAccum.addAssign(skyMask.mul(decay));
          decay.mulAssign(0.88);
        });
        const radialFalloff = exp(sunDist.mul(-1.85)).mul(float(1.0).sub(smoothstep(0.82, 1.45, sunDist)));
        const godRayEnergy = shaftAccum.div(6.2).mul(radialFalloff).mul(uSunVisibility).mul(uGodRaysIntensity);
        col.addAssign(uSunColor.mul(godRayEnergy).mul(0.58));
      });

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
          const s = beautyColorTex.sample(sampleUv).rgb;
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

      // 2. Exposure + AgX (default) or ACES Filmic tone mapping
      const expMult = uBaseExposure.mul(select(uGradeEnabled.greaterThan(0.5), uExposure, float(1.0)));
      col.mulAssign(expMult);
      col.assign(mix(acesFilmicTsl(col), agxToneMappingTsl(col), clamp(uToneMappingMode, 0.0, 1.0)));

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
    this.gtaoPass = gtaoPass;
    this.traaPass = traaPass;
    this.ssrBuilt = enableSsr;
    this.gtaoBuilt = enableGtao;
    this.traaBuilt = enableTraa;

    const pr = this.renderer.getPixelRatio();
    const scaledW = Math.max(1, Math.floor(this.width * pr));
    const scaledH = Math.max(1, Math.floor(this.height * pr));
    if (isIOSDevice() || enableTraa) {
      const rt = (this.scenePass as unknown as { renderTarget?: THREE.RenderTarget }).renderTarget;
      if (rt) rt.samples = 0;
    }
    this.scenePass.setSize(scaledW, scaledH);
    this.ssrPass?.setSize(scaledW, scaledH);
    this.gtaoPass?.setSize(scaledW, scaledH);
    this.traaPass?.setSize(scaledW, scaledH);
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
    if (this.gtaoPass) {
      this.gtaoPass.setSize(scaledW, scaledH);
    }
    if (this.traaPass) {
      this.traaPass.setSize(scaledW, scaledH);
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

  private resolveFlags(
    config?: PostProcessingConfig,
    volumetricFog?: VolumetricFogRenderConfig
  ): {
    cfg: ReturnType<typeof resolvePostProcessingConfig>;
    masterPostOn: boolean;
    vignetteOn: boolean;
    ssrRequested: boolean;
    gtaoRequested: boolean;
    traaRequested: boolean;
    godRaysOn: boolean;
    volFogOn: boolean;
    anyEffectActive: boolean;
  } {
    const cfg = resolvePostProcessingConfig(config);
    const masterPostOn = Boolean(cfg.enabled);
    const vignetteOn = masterPostOn && (cfg.vignetteEnabled ?? true) && cfg.vignette > 0.001;
    const ssrRequested =
      masterPostOn &&
      !isIOSDevice() &&
      !this.ssrFailed &&
      !PostProcessingPipeline.ssrGloballyUnsupported &&
      Boolean(cfg.ssrEnabled) &&
      (cfg.ssrIntensity ?? 0.65) > 0.001;
    const gtaoRequested =
      masterPostOn &&
      !isIOSDevice() &&
      !this.gtaoFailed &&
      !PostProcessingPipeline.gtaoGloballyUnsupported &&
      Boolean(cfg.gtaoEnabled) &&
      (cfg.gtaoIntensity ?? 0.72) > 0.001;
    const traaRequested =
      masterPostOn &&
      !isIOSDevice() &&
      !this.traaFailed &&
      !PostProcessingPipeline.traaGloballyUnsupported &&
      Boolean(cfg.traaEnabled);
    const godRaysOn =
      masterPostOn && Boolean(cfg.godRaysEnabled) && (cfg.godRaysIntensity ?? 0.52) > 0.001;
    const volFogOn =
      (volumetricFog?.enabled ?? cfg.volumetricFogEnabled ?? true) &&
      (volumetricFog?.density ?? cfg.volumetricFogDensity ?? 1.0) > 0.005;
    const anyEffectActive =
      volFogOn ||
      (masterPostOn &&
        (cfg.bloomEnabled ||
          cfg.lensFlareEnabled ||
          cfg.colorGradingEnabled ||
          vignetteOn ||
          ssrRequested ||
          gtaoRequested ||
          traaRequested ||
          godRaysOn));
    return {
      cfg,
      masterPostOn,
      vignetteOn,
      ssrRequested,
      gtaoRequested,
      traaRequested,
      godRaysOn,
      volFogOn,
      anyEffectActive,
    };
  }

  private ensurePipeline(
    ssrRequested: boolean,
    gtaoRequested: boolean,
    traaRequested: boolean
  ): void {
    if (
      !this.renderPipeline ||
      ssrRequested !== this.ssrBuilt ||
      gtaoRequested !== this.gtaoBuilt ||
      traaRequested !== this.traaBuilt
    ) {
      try {
        this.initPipeline(ssrRequested, gtaoRequested, traaRequested);
      } catch (pipeErr) {
        console.warn('Post-processing pipeline init failed; retrying with safe fallback:', pipeErr);
        if (ssrRequested) {
          this.ssrFailed = true;
          PostProcessingPipeline.ssrGloballyUnsupported = true;
        }
        if (gtaoRequested) {
          this.gtaoFailed = true;
          PostProcessingPipeline.gtaoGloballyUnsupported = true;
        }
        if (traaRequested) {
          this.traaFailed = true;
          PostProcessingPipeline.traaGloballyUnsupported = true;
        }
        this.initPipeline(false, false, false);
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
    const { ssrRequested, gtaoRequested, traaRequested, anyEffectActive } =
      this.resolveFlags(config);

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

    this.ensurePipeline(ssrRequested, gtaoRequested, traaRequested);
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
    passNode.renderTarget.samples = isIOSDevice() || this.traaBuilt ? 0 : this.renderer.samples;
    this.renderer.getDrawingBufferSize(this._drawingSize);
    const dbW = Math.max(1, Math.floor(this._drawingSize.x));
    const dbH = Math.max(1, Math.floor(this._drawingSize.y));
    if (passNode.renderTarget.width !== dbW || passNode.renderTarget.height !== dbH) {
      passNode.setSize(dbW, dbH);
      this.ssrPass?.setSize(dbW, dbH);
      this.gtaoPass?.setSize(dbW, dbH);
      this.traaPass?.setSize(dbW, dbH);
      this.lastAppliedScaledW = dbW;
      this.lastAppliedScaledH = dbH;
    }

    this.activeCompileCount++;
    try {
      if (!targetObject) {
        try {
          await passNode.compileAsync(this.renderer);
        } catch (err) {
          if (this.ssrBuilt || this.gtaoBuilt || this.traaBuilt) {
            console.warn('SSR/GTAO/TRAA precompile failed; falling back and retrying:', err);
            if (this.ssrBuilt) {
              this.ssrFailed = true;
              PostProcessingPipeline.ssrGloballyUnsupported = true;
            }
            if (this.gtaoBuilt) {
              this.gtaoFailed = true;
              PostProcessingPipeline.gtaoGloballyUnsupported = true;
            }
            if (this.traaBuilt) {
              this.traaFailed = true;
              PostProcessingPipeline.traaGloballyUnsupported = true;
            }
            this.initPipeline(false, false, false);
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
    const {
      cfg,
      masterPostOn,
      vignetteOn,
      ssrRequested,
      gtaoRequested,
      traaRequested,
      godRaysOn,
      volFogOn,
      anyEffectActive,
    } = this.resolveFlags(ctx.config, ctx.volumetricFog);

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
      // Zero-overhead bypass when neither Post-Processing nor Volumetric Fog is active (or on software WebGL)
      if (!anyEffectActive || this.isSoftwareGl) {
        this.renderer.render(this.scene, this.camera);
        return;
      }

      // Lazily rebuild RenderPipeline with/without MRT + SSRNode / GTAONode / TRAANode only when toggled
      this.ensurePipeline(ssrRequested, gtaoRequested, traaRequested);

      if (!this.renderPipeline || !this.bloomPass) {
        this.renderer.render(this.scene, this.camera);
        return;
      }

      // 0a. Update GTAO parameters when active
      if (this.gtaoPass && gtaoRequested) {
        this.gtaoPass.radius.value = THREE.MathUtils.clamp(cfg.gtaoRadius ?? 0.85, 0.2, 2.5);
        this.uGtaoStrength.value = THREE.MathUtils.clamp(cfg.gtaoIntensity ?? 0.72, 0, 1.6);
      } else {
        this.uGtaoStrength.value = 0;
      }

      // 0b. Update SSR parameters when active
      if (this.ssrPass && ssrRequested) {
        this.ssrPass.intensity.value = THREE.MathUtils.clamp(cfg.ssrIntensity ?? 0.65, 0, 1.5);
        this.uSsrMaxRoughness.value = THREE.MathUtils.clamp(cfg.ssrMaxRoughness ?? 0.55, 0.1, 0.9);
      }

      // 0c. Tone mapping curve (1.0 = AgX, 0.0 = ACES Filmic)
      this.uToneMappingMode.value = cfg.toneMapping === 'aces' ? 0.0 : 1.0;

      // 0d. Volumetric 3D ray-marched height fog uniforms
      this.uVolFogEnabled.value = volFogOn ? 1.0 : 0.0;
      if (volFogOn) {
        const vf = ctx.volumetricFog;
        this.camera.updateMatrixWorld();
        this.uCamWorldMatrix.value.copy(this.camera.matrixWorld);
        this.uCamProjInv.value.copy(this.camera.projectionMatrixInverse);
        this.uCamPos.value.copy(this.camera.position);

        this.uVolFogDensity.value = THREE.MathUtils.clamp(
          vf?.density ?? cfg.volumetricFogDensity ?? 1.0,
          0,
          2.5
        );
        this.uVolFogHeight.value = THREE.MathUtils.clamp(
          vf?.height ?? cfg.volumetricFogHeight ?? 2.2,
          -12,
          40
        );
        this.uVolFogSoftness.value = THREE.MathUtils.clamp(
          vf?.softness ?? cfg.volumetricFogSoftness ?? 8.5,
          1.0,
          25.0
        );
        this.uVolFogSharpness.value = THREE.MathUtils.clamp(
          vf?.sharpness ?? cfg.volumetricFogSharpness ?? 0.3,
          0.0,
          1.0
        );
        this.uVolFogNoise.value = THREE.MathUtils.clamp(
          vf?.noise ?? cfg.volumetricFogNoise ?? 0.95,
          0.0,
          2.0
        );
        this.uVolFogPatchiness.value = THREE.MathUtils.clamp(
          vf?.patchiness ?? cfg.volumetricFogPatchiness ?? 0.45,
          0.0,
          1.0
        );
        this.uVolFogSpeed.value = THREE.MathUtils.clamp(
          vf?.speed ?? cfg.volumetricFogSpeed ?? 0.75,
          0.0,
          3.0
        );
        this.uVolFogWind.value = THREE.MathUtils.clamp(vf?.wind ?? 0.45, 0.0, 2.0);
        this.uVolFogColor.value.copy(vf?.fogColor ?? this._defaultFogCol);
        this.uVolFogInscatterColor.value.copy(vf?.inscatterColor ?? this._defaultInscatterCol);
      }

      // 1. Update Bloom pass parameters
      const bloomOn = masterPostOn && cfg.bloomEnabled && cfg.bloomIntensity > 0.001;
      this.uBloomEnabled.value = bloomOn ? 1.0 : 0.0;
      if (bloomOn) {
        this.bloomPass.strength.value = THREE.MathUtils.clamp(cfg.bloomIntensity, 0, 2.5);
        this.bloomPass.threshold.value = THREE.MathUtils.clamp(cfg.bloomThreshold, 0, 1.5);
        this.bloomPass.radius.value = THREE.MathUtils.clamp(cfg.bloomRadius, 0, 1.5);
      }

      // 2. Update Lens Flare + Volumetric Sun Shafts uniforms (screenUV has y=0 at top, y=1 at bottom)
      this.uAspect.value = this.width / Math.max(1, this.height);
      this.uTime.value = ctx.elapsedTime;
      this.uBaseExposure.value = this.renderer.toneMappingExposure || 1.0;

      const flareOn = masterPostOn && cfg.lensFlareEnabled && cfg.lensFlareIntensity > 0.001;
      this.uFlareEnabled.value = flareOn ? 1.0 : 0.0;
      this.uFlareIntensity.value = THREE.MathUtils.clamp(cfg.lensFlareIntensity, 0, 2.5);
      this.uFlareGhosts.value = THREE.MathUtils.clamp(cfg.lensFlareGhosts, 0, 1.8);
      this.uFlareHalo.value = THREE.MathUtils.clamp(cfg.lensFlareHalo, 0, 1.8);
      this.uGodRaysEnabled.value = godRaysOn ? 1.0 : 0.0;
      this.uGodRaysIntensity.value = THREE.MathUtils.clamp(cfg.godRaysIntensity ?? 0.52, 0, 1.5);
      this.uSunColor.value.copy(ctx.sunColor);

      if (flareOn || godRaysOn || volFogOn) {
        this._sunDir.copy(ctx.sunPosition);
        if (this._sunDir.lengthSq() < 0.0001) {
          this._sunDir.set(0.4, 0.6, 0.5);
        }
        this._sunDir.normalize();
        this.uSunDir3D.value.copy(this._sunDir);
      }

      if (flareOn || godRaysOn) {
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
      this.uGradeEnabled.value = masterPostOn && cfg.colorGradingEnabled ? 1.0 : 0.0;
      this.uExposure.value = THREE.MathUtils.clamp(cfg.exposure, 0.4, 2.2);
      this.uContrast.value = THREE.MathUtils.clamp(cfg.contrast, -0.6, 0.8);
      this.uSaturation.value = THREE.MathUtils.clamp(cfg.saturation, -1.0, 1.0);
      this.uTemperature.value = THREE.MathUtils.clamp(cfg.temperature, -1.0, 1.0);
      this.uTint.value = THREE.MathUtils.clamp(cfg.tint, -1.0, 1.0);
      this.uHighlightsWarmth.value = THREE.MathUtils.clamp(cfg.highlightsWarmth, -0.6, 0.6);
      this.uShadowsCoolness.value = THREE.MathUtils.clamp(cfg.shadowsCoolness, -0.6, 0.6);
      this.uVignette.value = vignetteOn ? THREE.MathUtils.clamp(cfg.vignette, 0, 1.0) : 0.0;
      this.uVignetteSoftness.value = THREE.MathUtils.clamp(cfg.vignetteSoftness ?? 0.55, 0.1, 1.0);

      // 4. Execute r187 RenderPipeline (auto-fallback if SSR, GTAO, or TRAA fails on an incompatible driver)
      try {
        this.renderPipeline.render();
      } catch (err) {
        if (this.ssrBuilt || this.gtaoBuilt || this.traaBuilt) {
          console.warn('SSR/GTAO/TRAA render failed at runtime; falling back and retrying:', err);
          if (this.ssrBuilt) {
            this.ssrFailed = true;
            PostProcessingPipeline.ssrGloballyUnsupported = true;
          }
          if (this.gtaoBuilt) {
            this.gtaoFailed = true;
            PostProcessingPipeline.gtaoGloballyUnsupported = true;
          }
          if (this.traaBuilt) {
            this.traaFailed = true;
            PostProcessingPipeline.traaGloballyUnsupported = true;
          }
          this.initPipeline(false, false, false);
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
