import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
  cameraPosition,
  clamp,
  cos,
  dot,
  float,
  length,
  max,
  min,
  mix,
  normalize,
  positionLocal,
  positionWorld,
  pow,
  sin,
  smoothstep,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import type { GameLevel, TerrainQualityTier } from '../types/maker';
import type { ComputedAtmosphere } from './islandScene';

// Reusable math helpers to guarantee 0 heap allocations in per-frame update
const _camPos = new THREE.Vector3();
const _camFwd = new THREE.Vector3();
const _sunDir = new THREE.Vector3();
const _antiSunDir = new THREE.Vector3();
const _shaftOffset = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
const _tempColor = new THREE.Color();

/** Procedural circular dust mote sprite texture with gaussian glow */
function createDustMoteTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.25, 'rgba(255, 248, 220, 0.85)');
    grad.addColorStop(0.6, 'rgba(255, 228, 160, 0.28)');
    grad.addColorStop(1, 'rgba(255, 220, 140, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface VolumetricAtmosphereConfig {
  volumetricFogEnabled?: boolean;
  volumetricFogDensity?: number;
  volumetricFogHeight?: number;
  volumetricFogSoftness?: number;
  volumetricFogNoise?: number;
  volumetricFogPatchiness?: number;
  volumetricFogSpeed?: number;
  godRaysEnabled?: boolean;
  godRaysIntensity?: number;
  atmosphericDust?: number;
}

/**
 * Volumetric Atmosphere System:
 * - 3D Volumetric Light Shafts (Crepuscular Rays / God Rays) streaming along sun vector with forward Mie scattering.
 * - Ambient Sunbeam Dust Motes & Floating Spores with phase-angle forward scattering.
 * (Ground mist planes removed to guarantee zero harsh horizontal cutting lines on tree trunks or rocks).
 */
export class VolumetricAtmosphereSystem {
  public readonly group: THREE.Group;

  // Sub-groups
  private readonly shaftsGroup: THREE.Group;
  private readonly dustPoints: THREE.Points;

  // Live TSL uniforms
  private readonly uTime = uniform(0.0);
  private readonly uSunDir = uniform(new THREE.Vector3(0.5, 0.72, 0.42));
  private readonly uSunColor = uniform(new THREE.Color('#FFF5DB'));
  private readonly uHorizonColor = uniform(new THREE.Color('#98BCD8'));
  private readonly uInscatterColor = uniform(new THREE.Color('#FFE2A8'));
  private readonly uGodRaysIntensity = uniform(0.75);
  private readonly uGodRaysEnabled = uniform(1.0);
  private readonly uDustIntensity = uniform(0.5);
  private readonly uWind = uniform(new THREE.Vector2(0.35, 0.15));

  // Materials & Geometries for clean disposal
  private readonly shaftMaterial: MeshBasicNodeMaterial;
  private readonly dustMaterial: THREE.PointsMaterial;
  private readonly dustGeo: THREE.BufferGeometry;
  private readonly dustPositions: Float32Array;
  private readonly dustOffsets: Float32Array;
  private readonly dustSpeeds: Float32Array;
  private readonly dustCount = 220;
  private readonly dustRadius = 24.0;
  private readonly dustHeightSpan = 14.0;
  private dustAccumDt = 0;

  private qualityTier: TerrainQualityTier = 'balanced';
  private isDungeon = false;
  private isNight = false;

  constructor(level: GameLevel, isSoftwareGl = false) {
    this.group = new THREE.Group();
    this.group.name = 'volumetric-atmosphere-root';

    this.isDungeon = level.biome === 'cave' || level.sky === 'cave';
    this.applyConfig(level);

    // 1. Volumetric Light Shafts
    this.shaftsGroup = new THREE.Group();
    this.shaftsGroup.name = 'volumetric-light-shafts';
    this.shaftMaterial = this.createLightShaftMaterial();
    this.buildShaftMeshes(isSoftwareGl);
    this.group.add(this.shaftsGroup);

    // 2. Atmospheric Dust Motes & Sunbeam Particulates
    const dustTex = createDustMoteTexture();
    this.dustGeo = new THREE.BufferGeometry();
    this.dustPositions = new Float32Array(this.dustCount * 3);
    this.dustOffsets = new Float32Array(this.dustCount * 3);
    this.dustSpeeds = new Float32Array(this.dustCount);

    for (let i = 0; i < this.dustCount; i++) {
      const idx = i * 3;
      const r = Math.pow(Math.random(), 0.6) * this.dustRadius;
      const theta = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.2) * this.dustHeightSpan;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;

      this.dustPositions[idx] = x;
      this.dustPositions[idx + 1] = y;
      this.dustPositions[idx + 2] = z;

      this.dustOffsets[idx] = Math.random() * Math.PI * 2;
      this.dustOffsets[idx + 1] = Math.random() * Math.PI * 2;
      this.dustOffsets[idx + 2] = Math.random() * Math.PI * 2;
      this.dustSpeeds[i] = 0.4 + Math.random() * 0.8;
    }
    this.dustGeo.setAttribute('position', new THREE.BufferAttribute(this.dustPositions, 3));

    this.dustMaterial = new THREE.PointsMaterial({
      size: 0.32,
      map: dustTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      color: new THREE.Color('#FFF5DC'),
      opacity: 0.55,
    });
    this.dustPoints = new THREE.Points(this.dustGeo, this.dustMaterial);
    this.dustPoints.frustumCulled = false;
    this.group.add(this.dustPoints);

    if (this.isDungeon) {
      this.shaftsGroup.visible = false;
      this.dustPoints.visible = false;
    }
  }

  /**
   * Creates the custom TSL node material for physical volumetric light shafts (god rays).
   */
  private createLightShaftMaterial(): MeshBasicNodeMaterial {
    const uTime = this.uTime;
    const uSunDir = this.uSunDir;
    const uSunColor = this.uSunColor;
    const uHorizonColor = this.uHorizonColor;
    const uGodRaysIntensity = this.uGodRaysIntensity;
    const uGodRaysEnabled = this.uGodRaysEnabled;

    const mat = new MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });

    mat.colorNode = (() => {
      const posW = positionWorld;
      const viewVec = posW.sub(cameraPosition);
      const distToCam = length(viewVec);
      const viewDir = normalize(viewVec);

      const cosTheta = dot(viewDir, uSunDir);
      const mieScatter = pow(max(float(0.0), cosTheta.mul(0.5).add(0.5)), float(4.5))
        .mul(1.5)
        .add(0.18);

      const radDist = length(vec2(positionLocal.x, positionLocal.z));
      const radFade = float(1.0).sub(smoothstep(float(0.08), float(0.98), radDist));

      const topFade = smoothstep(float(0.0), float(0.18), uv().y);
      const btmFade = float(1.0).sub(smoothstep(float(0.82), float(1.0), uv().y));
      const vertFade = topFade.mul(btmFade);

      const flow = sin(posW.y.mul(0.14).sub(uTime.mul(0.95)))
        .mul(cos(posW.x.mul(0.08).add(posW.z.mul(0.08)).add(uTime.mul(0.65))));
      const turbulence = flow.mul(0.24).add(1.0);

      const camFade = smoothstep(float(2.0), float(7.5), distToCam);
      const shaftCol = mix(uHorizonColor, uSunColor, mieScatter.mul(0.65).add(0.35));

      const alpha = clamp(
        radFade
          .mul(vertFade)
          .mul(mieScatter)
          .mul(turbulence)
          .mul(camFade)
          .mul(uGodRaysIntensity)
          .mul(uGodRaysEnabled)
          .mul(0.32),
        float(0.0),
        float(1.0)
      );

      return vec4(shaftCol, alpha);
    })();

    return mat;
  }

  private buildShaftMeshes(isSoftwareGl: boolean): void {
    while (this.shaftsGroup.children.length > 0) {
      const child = this.shaftsGroup.children[0];
      this.shaftsGroup.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
    }

    const beamCount = isSoftwareGl ? 4 : 6;
    const beamRadii = [5.2, 8.2, 6.4, 9.6, 7.0, 10.5];
    const beamLengths = [115, 140, 125, 150, 130, 145];
    const beamAngles = [0, 1.05, 2.1, 3.15, 4.2, 5.25];

    for (let i = 0; i < beamCount; i++) {
      const topR = (beamRadii[i % beamRadii.length] ?? 6) * 0.28;
      const btmR = (beamRadii[i % beamRadii.length] ?? 6) * 1.55;
      const len = beamLengths[i % beamLengths.length] ?? 130;
      const angle = beamAngles[i % beamAngles.length] ?? (i * Math.PI * 2) / beamCount;

      const geo = new THREE.CylinderGeometry(topR, btmR, len, 14, 4, true);
      geo.translate(0, -len * 0.5, 0);

      const mesh = new THREE.Mesh(geo, this.shaftMaterial);
      const spreadR = 12 + (i % 4) * 9;
      mesh.position.set(Math.cos(angle) * spreadR, 0, Math.sin(angle) * spreadR);

      mesh.rotation.x = (Math.random() - 0.5) * 0.08;
      mesh.rotation.z = (Math.random() - 0.5) * 0.08;
      mesh.renderOrder = 18;

      this.shaftsGroup.add(mesh);
    }
  }

  public applyConfig(cfg: VolumetricAtmosphereConfig): void {
    const raysOn = cfg.godRaysEnabled ?? true;
    const raysIntensity = THREE.MathUtils.clamp(cfg.godRaysIntensity ?? 0.75, 0, 1.8);
    const dustAmt = THREE.MathUtils.clamp(cfg.atmosphericDust ?? 0.5, 0, 1.0);

    this.uGodRaysEnabled.value = raysOn ? 1.0 : 0.0;
    this.uGodRaysIntensity.value = raysIntensity;
    this.uDustIntensity.value = dustAmt;

    if (this.dustMaterial) {
      this.dustMaterial.opacity = dustAmt * 0.65;
    }
  }

  public setQuality(tier: TerrainQualityTier): void {
    if (tier === this.qualityTier) return;
    this.qualityTier = tier;
    const isLow = tier === 'performance';
    const isUltra = tier === 'ultra';

    this.shaftsGroup.visible = !isLow || (this.uGodRaysIntensity.value > 0.05);
    this.dustPoints.visible = isUltra || tier === 'balanced';
  }

  public syncAtmosphere(atmo: ComputedAtmosphere, level: GameLevel): void {
    this.isDungeon = level.biome === 'cave' || level.sky === 'cave';
    this.isNight = atmo.nightFactor > 0.55;

    if (this.isDungeon) {
      this.shaftsGroup.visible = false;
      this.dustPoints.visible = false;
      return;
    }

    this.shaftsGroup.visible = (this.uGodRaysEnabled.value > 0.5) && (this.uGodRaysIntensity.value > 0.01);
    this.dustPoints.visible = this.uDustIntensity.value > 0.02;

    this.uSunColor.value.copy(atmo.sunColor);
    this.uHorizonColor.value.copy(atmo.horizonColor);

    _tempColor.copy(atmo.horizonColor).lerp(atmo.sunColor, 0.55 + atmo.warmGlow * 0.35);
    this.uInscatterColor.value.copy(_tempColor);

    const windSpeed = THREE.MathUtils.clamp(level.wind ?? 0.45, 0.05, 2.0);
    const speedMult = level.volumetricFogSpeed ?? 0.75;
    this.uWind.value.set(windSpeed * 0.38 * speedMult, windSpeed * 0.18 * speedMult);

    if (this.isNight) {
      this.uInscatterColor.value.set('#A4C4E8');
    }
  }

  public update(
    camera: THREE.Camera,
    dt: number,
    timeSec: number,
    atmo: ComputedAtmosphere,
    heroPosition?: THREE.Vector3
  ): void {
    if (this.isDungeon) return;

    this.uTime.value = timeSec;

    camera.getWorldPosition(_camPos);
    camera.getWorldDirection(_camFwd);

    const focusX = heroPosition ? heroPosition.x : _camPos.x;
    const focusY = heroPosition ? heroPosition.y : _camPos.y;
    const focusZ = heroPosition ? heroPosition.z : _camPos.z;

    _sunDir.copy(atmo.sunPos);
    if (_sunDir.lengthSq() < 0.0001) {
      _sunDir.set(0.45, 0.72, 0.42);
    }
    _sunDir.normalize();
    this.uSunDir.value.copy(_sunDir);

    const shaftDistOverhead = 85.0;
    _shaftOffset.copy(_sunDir).multiplyScalar(shaftDistOverhead);
    this.shaftsGroup.position.set(
      focusX + _shaftOffset.x * 0.6,
      focusY + _shaftOffset.y,
      focusZ + _shaftOffset.z * 0.6
    );

    _antiSunDir.copy(_sunDir).negate();
    _quat.setFromUnitVectors(_up, _antiSunDir);
    this.shaftsGroup.quaternion.copy(_quat);

    if (this.dustPoints.visible && this.dustPositions) {
      this.dustAccumDt += dt;
      if (this.dustAccumDt >= 0.032) {
        const stepDt = this.dustAccumDt;
        this.dustAccumDt = 0;
        const posAttr = this.dustGeo.getAttribute('position') as THREE.BufferAttribute;
        const positions = posAttr.array as Float32Array;
        const speeds = this.dustSpeeds;
        const offsets = this.dustOffsets;
        const r = this.dustRadius;
        const hSpan = this.dustHeightSpan;

        const windX = this.uWind.value.x * 0.8;
        const windZ = this.uWind.value.y * 0.8;
        const stepScale = stepDt * 60;

        for (let i = 0; i < this.dustCount; i++) {
          const idx = i * 3;
          const spd = speeds[i] ?? 0.6;
          const ox = offsets[idx] ?? 0;
          const oy = offsets[idx + 1] ?? 0;
          const oz = offsets[idx + 2] ?? 0;

          let px = positions[idx] + (Math.sin(timeSec * spd + ox) * 0.08 + windX * 0.04) * stepScale;
          let py = positions[idx + 1] + (Math.cos(timeSec * spd * 0.7 + oy) * 0.05 + 0.012) * stepScale;
          let pz = positions[idx + 2] + (Math.sin(timeSec * spd * 0.8 + oz) * 0.08 + windZ * 0.04) * stepScale;

          const relX = px - focusX;
          const relY = py - (focusY + 2.5);
          const relZ = pz - focusZ;

          if (relX > r) px = focusX - r;
          else if (relX < -r) px = focusX + r;

          if (relY > hSpan * 0.5) py = focusY + 2.5 - hSpan * 0.5;
          else if (relY < -hSpan * 0.5) py = focusY + 2.5 + hSpan * 0.5;

          if (relZ > r) pz = focusZ - r;
          else if (relZ < -r) pz = focusZ + r;

          positions[idx] = px;
          positions[idx + 1] = py;
          positions[idx + 2] = pz;
        }
        posAttr.needsUpdate = true;
      }
    }
  }

  public dispose(): void {
    if (this.shaftMaterial) this.shaftMaterial.dispose();
    if (this.dustMaterial) {
      if (this.dustMaterial.map) this.dustMaterial.map.dispose();
      this.dustMaterial.dispose();
    }
    if (this.dustGeo) this.dustGeo.dispose();

    while (this.shaftsGroup.children.length > 0) {
      const c = this.shaftsGroup.children[0];
      this.shaftsGroup.remove(c);
      if (c instanceof THREE.Mesh) c.geometry.dispose();
    }
  }
}
