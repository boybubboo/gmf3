import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
  Fn,
  If,
  abs,
  attribute,
  cameraPosition,
  cameraProjectionMatrix,
  cameraViewMatrix,
  clamp,
  cos,
  dot,
  float,
  floor,
  fract,
  frontFacing,
  length,
  max,
  min,
  mix,
  normalize,
  positionGeometry,
  pow,
  select,
  sin,
  smoothstep,
  uniform,
  uv,
  varying,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import type { BiomeId, GrassFieldConfig, GrassQuality } from '../types/maker';
import {
  createNearBladeGeometry,
  getBiomeGrassPalette,
  getLodTierSpec,
  resolveGrassConfig,
} from './stylizedGrassSystem';

export interface GrassMeadowPreset {
  id: string;
  name: string;
  summary: string;
  patch: Partial<GrassFieldConfig>;
}

export const GRASS_MEADOW_PRESETS: GrassMeadowPreset[] = [
  {
    id: 'lush_meadow',
    name: 'Lush Meadow',
    summary: 'Natural vibrant green drifts & soft Carex tufts',
    patch: {
      enabled: true,
      quality: 'lush',
      bladeHeight: 0.74,
      bladeWidth: 0.104,
      windWaveStrength: 1.0,
      tipGlow: 0.68,
      primaryColor: '#54B049',
      secondaryColor: '#98D954',
      mixNoiseScale: 1.0,
      carexMix: 0.34,
      tuftClumpiness: 0.56,
    },
  },
  {
    id: 'wild_sedge',
    name: 'Wild Sedge Marsh',
    summary: 'Dense tall arching Carex clusters with deep emerald roots',
    patch: {
      enabled: true,
      quality: 'dense',
      bladeHeight: 0.98,
      bladeWidth: 0.11,
      windWaveStrength: 1.25,
      tipGlow: 0.56,
      primaryColor: '#3B7F46',
      secondaryColor: '#8FB84C',
      mixNoiseScale: 1.3,
      carexMix: 0.76,
      tuftClumpiness: 0.8,
    },
  },
  {
    id: 'manicured_lawn',
    name: 'Manicured Lawn',
    summary: 'Trimmed garden turf with natural soft micro-tufts',
    patch: {
      enabled: true,
      quality: 'ultra',
      bladeHeight: 0.44,
      bladeWidth: 0.095,
      windWaveStrength: 0.55,
      tipGlow: 0.38,
      primaryColor: '#4BA447',
      secondaryColor: '#75C954',
      mixNoiseScale: 0.85,
      carexMix: 0.12,
      tuftClumpiness: 0.24,
    },
  },
  {
    id: 'golden_savanna',
    name: 'Golden Savanna',
    summary: 'Organic sun-warmed wheat drifts & sweeping wind',
    patch: {
      enabled: true,
      quality: 'lush',
      bladeHeight: 0.92,
      bladeWidth: 0.09,
      windWaveStrength: 1.45,
      tipGlow: 0.88,
      primaryColor: '#8E8E38',
      secondaryColor: '#D6BE56',
      mixNoiseScale: 1.2,
      carexMix: 0.65,
      tuftClumpiness: 0.84,
    },
  },
  {
    id: 'mystic_moss',
    name: 'Mystic Dew Grass',
    summary: 'Cool teal-jade clusters with luminous sunlit tips',
    patch: {
      enabled: true,
      quality: 'dense',
      bladeHeight: 0.78,
      bladeWidth: 0.115,
      windWaveStrength: 0.9,
      tipGlow: 1.05,
      primaryColor: '#2B7A67',
      secondaryColor: '#69CF9E',
      mixNoiseScale: 1.5,
      carexMix: 0.42,
      tuftClumpiness: 0.7,
    },
  },
];

export interface GrassSampleStats {
  patchSizeM: number;
  patchAreaSqM: number;
  bladeCount: number;
  bladesPerSqM: number;
  clumpCount: number;
  cellSpacingM: number;
  bladesPerCell: number;
}

const gHash21Sample = Fn(([pIn]: [any]) => {
  const p = vec2(fract(vec2(pIn).add(vec2(17.31, 43.87)).mul(vec2(127.1, 311.7)))).toVar();
  p.addAssign(dot(p, p.add(34.345)));
  return fract(p.x.mul(p.y));
});

const gHash22Sample = Fn(([p]: [any]) => {
  const pv = vec2(p).add(vec2(31.73, 19.41));
  const p3 = vec3(fract(vec3(pv.x, pv.y, pv.x).mul(vec3(0.1031, 0.103, 0.0973)))).toVar();
  p3.addAssign(dot(p3, vec3(p3.y, p3.z, p3.x).add(33.33)));
  return fract(vec2(p3.x.add(p3.y), p3.y.add(p3.z)).mul(vec2(p3.z, p3.y)));
});

const gNoise2DSample = Fn(([p]: [any]) => {
  const i = floor(p);
  const fRaw = fract(p);
  const f = fRaw.mul(fRaw).mul(vec2(3.0).sub(fRaw.mul(2.0)));
  const a = gHash21Sample(i);
  const b = gHash21Sample(i.add(vec2(1.0, 0.0)));
  const c = gHash21Sample(i.add(vec2(0.0, 1.0)));
  const d = gHash21Sample(i.add(vec2(1.0, 1.0)));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
});

function fractScalar(v: number): number {
  return v - Math.floor(v);
}

function jsHash21(x: number, y: number): number {
  let px = fractScalar((x + 17.31) * 127.1);
  let py = fractScalar((y + 43.87) * 311.7);
  const d = px * (px + 34.345) + py * (py + 34.345);
  px += d;
  py += d;
  return fractScalar(px * py);
}

function jsHash22(x: number, y: number): [number, number] {
  const vx = x + 31.73;
  const vy = y + 19.41;
  let p3x = fractScalar(vx * 0.1031);
  let p3y = fractScalar(vy * 0.103);
  let p3z = fractScalar(vx * 0.0973);
  const d = p3x * (p3y + 33.33) + p3y * (p3z + 33.33) + p3z * (p3x + 33.33);
  p3x += d;
  p3y += d;
  p3z += d;
  return [fractScalar((p3x + p3y) * p3z), fractScalar((p3y + p3z) * p3y)];
}

function jsNoise2D(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = jsHash21(ix, iy);
  const b = jsHash21(ix + 1, iy);
  const c = jsHash21(ix, iy + 1);
  const d = jsHash21(ix + 1, iy + 1);
  return (a + (b - a) * ux) * (1 - uy) + (c + (d - c) * ux) * uy;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstepJS(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export class GrassSamplePreview {
  public readonly group = new THREE.Group();

  private readonly baseBladeGeo: THREE.BufferGeometry;
  private readonly material: MeshBasicNodeMaterial;
  private readonly plinthGroup = new THREE.Group();
  private readonly guideGroup = new THREE.Group();
  private grassMesh: THREE.Mesh | null = null;
  private grassGeo: THREE.InstancedBufferGeometry | null = null;

  private soilRimMesh: THREE.Mesh | null = null;
  private turfPadMesh: THREE.Mesh | null = null;
  private meterGridLines: THREE.LineSegments | null = null;
  private readonly soilMat: THREE.MeshStandardMaterial;
  private readonly turfMat: THREE.MeshStandardMaterial;
  private readonly gridMat: THREE.LineBasicMaterial;
  private readonly guideMat: THREE.MeshBasicMaterial;

  private lastKey = '';
  private lastGuideKey = '';
  private lastStats: GrassSampleStats = {
    patchSizeM: 4,
    patchAreaSqM: 16,
    bladeCount: 0,
    bladesPerSqM: 0,
    clumpCount: 0,
    cellSpacingM: 0.818,
    bladesPerCell: 2,
  };

  private readonly uHalfPatch = uniform(2.0);
  private readonly uCellSpacing = uniform(0.818);
  private readonly uSeedShift = uniform(1.0);
  private readonly uBladeHeight = uniform(0.74);
  private readonly uBladeWidth = uniform(0.104);
  private readonly uWindWaveStrength = uniform(1.0);
  private readonly uTipGlow = uniform(0.68);
  private readonly uPrimaryCol = uniform(new THREE.Color('#54B049'));
  private readonly uSecondaryCol = uniform(new THREE.Color('#98D954'));
  private readonly uMixNoiseScale = uniform(1.0);
  private readonly uCarexMix = uniform(0.32);
  private readonly uTuftClumpiness = uniform(0.45);
  private readonly uCameraPos = uniform(new THREE.Vector3(2.8, 2.0, 3.2));
  private readonly uTime = uniform(0);
  private readonly uWindStrength = uniform(0.45);
  private readonly uSunDir = uniform(new THREE.Vector3(0.4, 0.75, 0.5).normalize());
  private readonly uSunColor = uniform(new THREE.Color('#FFF7E2'));
  private readonly uSunIntensity = uniform(1.65);
  private readonly uSkyColor = uniform(new THREE.Color('#E7F9EE'));
  private readonly uGroundHemiColor = uniform(new THREE.Color('#273A2B'));
  private readonly uHemiIntensity = uniform(0.92);
  private readonly uCrestColor = uniform(new THREE.Color('#E8F78A'));
  private readonly _sunDir = new THREE.Vector3();

  constructor() {
    this.group.name = 'GrassSamplePreview';
    this.baseBladeGeo = createNearBladeGeometry(1.0);

    this.soilMat = new THREE.MeshStandardMaterial({
      color: '#2B221B',
      roughness: 0.94,
      metalness: 0.02,
    });
    this.turfMat = new THREE.MeshStandardMaterial({
      color: '#2B4425',
      roughness: 0.9,
      metalness: 0.02,
    });
    this.gridMat = new THREE.LineBasicMaterial({
      color: '#88C49B',
      transparent: true,
      opacity: 0.28,
    });
    this.guideMat = new THREE.MeshBasicMaterial({
      color: '#F59E0B',
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.group.add(this.plinthGroup, this.guideGroup);
    this.material = this.createNodeMaterial();
  }

  private createNodeMaterial(): MeshBasicNodeMaterial {
    const vHeight = varying(float());
    const vSide = varying(float());
    const vWaveCrest = varying(float());
    const vColorVar = varying(float());
    const vSpeciesMix = varying(float());
    const vWorldPos = varying(vec3());
    const vBladeNormal = varying(vec3());

    const mat = new MeshBasicNodeMaterial({
      side: THREE.DoubleSide,
      toneMapped: true,
      fog: false,
    });

    const uHalfPatch = this.uHalfPatch;
    const uCellSpacing = this.uCellSpacing;
    const uSeedShift = this.uSeedShift;
    const uBladeHeight = this.uBladeHeight;
    const uBladeWidth = this.uBladeWidth;
    const uWindWaveStrength = this.uWindWaveStrength;
    const uTipGlow = this.uTipGlow;
    const uPrimaryCol = this.uPrimaryCol;
    const uSecondaryCol = this.uSecondaryCol;
    const uMixNoiseScale = this.uMixNoiseScale;
    const uCarexMix = this.uCarexMix;
    const uTuftClumpiness = this.uTuftClumpiness;
    const uCameraPos = this.uCameraPos;
    const uTime = this.uTime;
    const uWindStrength = this.uWindStrength;
    const uSunDir = this.uSunDir;
    const uSunColor = this.uSunColor;
    const uSunIntensity = this.uSunIntensity;
    const uSkyColor = this.uSkyColor;
    const uGroundHemiColor = this.uGroundHemiColor;
    const uHemiIntensity = this.uHemiIntensity;
    const uCrestColor = this.uCrestColor;

    mat.vertexNode = Fn(() => {
      const aCellOffset = attribute('aCellOffset', 'vec2');
      const aBladeSub = attribute('aBladeSub', 'float');

      const hashSeed = aCellOffset.add(
        vec2(
          aBladeSub.mul(37.13).add(uSeedShift.mul(19.7)),
          aBladeSub.mul(91.7).add(uSeedShift.mul(41.3))
        )
      );
      const jitter = gHash22Sample(hashSeed).sub(0.5);
      // Wide cross-cell jitter breaks up square cell boundaries
      const rawWorldXZ = aCellOffset.add(0.5).add(jitter.mul(1.52)).mul(uCellSpacing);

      const seedVec = vec2(uSeedShift.mul(7.1), uSeedShift.mul(13.3));
      const warpX = gNoise2DSample(rawWorldXZ.mul(0.28).add(vec2(5.2, 1.3)).add(seedVec)).sub(0.5);
      const warpZ = gNoise2DSample(rawWorldXZ.mul(0.28).add(vec2(18.7, 9.4)).add(seedVec)).sub(0.5);
      const warpedXZ = rawWorldXZ.add(vec2(warpX, warpZ).mul(1.35));
      const clumpGridScale = float(0.58);
      const warpedScaled = warpedXZ.mul(clumpGridScale);
      const baseClump = floor(warpedScaled.sub(0.5));

      const evalSite = (ox: number, oz: number) => {
        const c = baseClump.add(vec2(ox, oz));
        const h = gHash22Sample(c.add(seedVec));
        const w = gHash21Sample(c.add(vec2(7.7, 23.1)).add(seedVec));
        const siteScaled = c.add(0.14).add(h.mul(0.72));
        const diffScaled = siteScaled.sub(warpedScaled);
        const d2 = dot(diffScaled, diffScaled).mul(mix(0.68, 1.42, w));
        return { diffScaled, h, w, d2 };
      };

      const s00 = evalSite(0, 0);
      const s10 = evalSite(1, 0);
      const s01 = evalSite(0, 1);
      const s11 = evalSite(1, 1);

      const pickA = s00.d2.lessThanEqual(s10.d2);
      const aDiff = select(pickA, s00.diffScaled, s10.diffScaled);
      const aHash = select(pickA, s00.h, s10.h);
      const aW = select(pickA, s00.w, s10.w);
      const aD2 = min(s00.d2, s10.d2);

      const pickB = s01.d2.lessThanEqual(s11.d2);
      const bDiff = select(pickB, s01.diffScaled, s11.diffScaled);
      const bHash = select(pickB, s01.h, s11.h);
      const bW = select(pickB, s01.w, s11.w);
      const bD2 = min(s01.d2, s11.d2);

      const pickBest = aD2.lessThanEqual(bD2);
      const clumpDiffXZ = select(pickBest, aDiff, bDiff).div(clumpGridScale);
      const clumpHash = select(pickBest, aHash, bHash);
      const clumpWeight = select(pickBest, aW, bW);

      const clumpCenterXZ = rawWorldXZ.add(clumpDiffXZ);
      const clumpDist = length(clumpDiffXZ);
      const bladePullRnd = gHash21Sample(hashSeed.add(vec2(29.4, 51.8)));
      const clumpPull = clamp(uTuftClumpiness, 0.0, 1.0)
        .mul(0.66)
        .mul(mix(0.62, 1.0, clumpWeight))
        .mul(mix(0.45, 1.0, bladePullRnd));
      const worldXZ = mix(rawWorldXZ, clumpCenterXZ, clumpPull);

      const clipPos = vec4(2.0, 2.0, 2.0, 1.0).toVar();
      const halfBound = uHalfPatch.sub(0.06);
      const insidePatch = abs(worldXZ.x)
        .lessThanEqual(halfBound)
        .and(abs(worldXZ.y).lessThanEqual(halfBound));

      const densityRnd = gHash21Sample(hashSeed.add(vec2(17.3, 5.9)));
      const meadowDrift = gNoise2DSample(worldXZ.mul(0.28).add(vec2(3.1, 8.7)).add(seedVec))
        .mul(0.62)
        .add(gNoise2DSample(worldXZ.mul(0.68).add(vec2(19.4, 2.3)).add(seedVec)).mul(0.38));
      const clumpAffinity = float(1.0).sub(smoothstep(0.22, 1.12, clumpDist));
      const baseNaturalDensity = mix(0.76, 1.0, smoothstep(0.16, 0.78, meadowDrift));
      const clumpGapMod = mix(
        0.42,
        1.0,
        clamp(clumpAffinity.mul(0.72).add(meadowDrift.mul(0.28)), 0.0, 1.0)
      );
      const organicDensity = mix(
        baseNaturalDensity,
        clumpGapMod,
        clamp(uTuftClumpiness, 0.0, 1.0).mul(0.68)
      );
      const densityKeep = densityRnd.lessThanEqual(organicDensity);

      If(insidePatch.and(densityKeep), () => {
        const clumpNoise = gNoise2DSample(worldXZ.mul(0.32));
        const bladeRnd = gHash21Sample(hashSeed.add(vec2(43.1, 88.4)));

        const speciesPatch = gNoise2DSample(worldXZ.mul(0.26).add(vec2(12.3, 4.7)));
        const isCarex = smoothstep(
          float(0.68).sub(uCarexMix.mul(0.65)),
          float(0.95).sub(uCarexMix.mul(0.5)),
          speciesPatch.mul(0.62).add(bladeRnd.mul(0.38))
        ).mul(clamp(uCarexMix.mul(1.35), 0.0, 1.0));

        const clumpHeightSpan = mix(0.14, 0.54, clamp(uTuftClumpiness, 0.0, 1.0));
        const clumpScaledMul = float(1.0)
          .sub(clumpHeightSpan.mul(0.45))
          .add(clumpHash.y.mul(clumpHeightSpan));

        const speciesHeightMul = mix(0.84, 1.48, isCarex);
        const heightScale = uBladeHeight
          .mul(float(0.62).add(clumpNoise.mul(0.48)).add(bladeRnd.mul(0.28)))
          .mul(clumpScaledMul)
          .mul(speciesHeightMul);
        const widthScale = uBladeWidth
          .mul(mix(1.05, 0.78, isCarex))
          .mul(float(0.86).add(bladeRnd.mul(0.34)));

        const toCamXZ = normalize(
          vec2(uCameraPos.x, uCameraPos.z).sub(worldXZ).add(vec2(0.0001))
        );
        const clumpYaw = clumpHash.x.mul(6.2831853);
        const indivYaw = gHash21Sample(hashSeed.add(vec2(9.2, 61.7))).mul(6.2831853);
        const yaw = mix(
          clumpYaw,
          indivYaw,
          mix(0.76, 0.24, clamp(uTuftClumpiness, 0.0, 1.0))
        );
        const cy = cos(yaw);
        const sy = sin(yaw);

        const bladeUv = uv();
        const hT = bladeUv.y;
        const side = bladeUv.x.mul(2.0).sub(1.0);

        const faceAlign = abs(dot(vec2(sy.negate(), cy), toCamXZ));
        const edgeThicken = float(1.0).add(pow(float(1.0).sub(faceAlign), 2.0).mul(0.78));

        const curveRnd = gHash21Sample(hashSeed.add(vec2(71.9, 13.4)));
        const archBend = hT
          .mul(hT)
          .mul(heightScale)
          .mul(float(0.14).add(curveRnd.mul(0.28)).add(isCarex.mul(0.26)));

        const localZ = positionGeometry.z
          .mul(heightScale)
          .mul(float(0.75).add(bladeRnd.mul(0.55)))
          .add(archBend);
        const localX = positionGeometry.x.mul(widthScale).mul(edgeThicken);
        const localY = positionGeometry.y.mul(heightScale);

        const rotX = localX.mul(cy).sub(localZ.mul(sy)).toVar();
        const rotY = localY.toVar();
        const rotZ = localX.mul(sy).add(localZ.mul(cy)).toVar();

        const windDir = normalize(vec2(0.84, 0.54));
        const wSpeed = float(0.85).add(uWindStrength.mul(0.95));
        const wAmp = float(0.18).add(uWindStrength.mul(0.42)).mul(uWindWaveStrength);

        const waveCoord = worldXZ.mul(0.16).sub(windDir.mul(uTime.mul(wSpeed).mul(0.62)));
        const macroWave = gNoise2DSample(waveCoord)
          .mul(0.65)
          .add(gNoise2DSample(waveCoord.mul(2.15).add(vec2(4.2, 1.7))).mul(0.35));
        const wavePulse = smoothstep(0.28, 0.84, macroWave);

        const phase = worldXZ.x.mul(0.42).add(worldXZ.y.mul(0.35)).add(bladeRnd.mul(6.283));
        const flutter = sin(
          uTime.mul(float(2.6).add(uWindStrength.mul(1.4))).add(phase)
        ).mul(0.24);
        const gust = macroWave.mul(1.15).add(flutter.mul(0.45)).mul(wAmp);

        const bendT = hT.mul(hT);
        const windPerp = vec2(windDir.y.negate(), windDir.x);
        const windPush = windDir
          .mul(gust.mul(heightScale).mul(bendT))
          .add(
            windPerp.mul(
              sin(uTime.mul(1.9).add(phase.mul(0.7)))
                .mul(0.12)
                .mul(wAmp)
                .mul(heightScale)
                .mul(bendT)
            )
          );

        rotX.addAssign(windPush.x);
        rotZ.addAssign(windPush.y);
        rotY.subAssign(min(heightScale.mul(0.42), dot(windPush, windPush).mul(0.42)));

        const worldPos = vec3(
          worldXZ.x.add(rotX),
          float(0.012).add(rotY),
          worldXZ.y.add(rotZ)
        );

        const localN = normalize(vec3(side.mul(0.44), float(0.48).add(hT.mul(0.44)), -0.7));
        const bladeN = normalize(
          vec3(
            localN.x.mul(cy).sub(localN.z.mul(sy)),
            localN.y,
            localN.x.mul(sy).add(localN.z.mul(cy))
          )
        );

        vHeight.assign(hT);
        vSide.assign(side);
        vWaveCrest.assign(wavePulse.mul(clamp(uWindStrength.mul(0.85).add(0.35), 0.0, 1.35)));
        vColorVar.assign(clumpNoise.mul(0.65).add(bladeRnd.mul(0.35)));
        vSpeciesMix.assign(isCarex);
        vWorldPos.assign(worldPos);
        vBladeNormal.assign(bladeN);

        clipPos.assign(cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(worldPos, 1.0)));
      });

      return clipPos;
    })();

    mat.colorNode = Fn(() => {
      const patchNoise = gNoise2DSample(
        vec2(vWorldPos.x, vWorldPos.z).mul(float(0.32).mul(uMixNoiseScale))
      );
      const dualBlend = smoothstep(0.2, 0.8, patchNoise.mul(0.72).add(vSpeciesMix.mul(0.28)));
      const customRoot = mix(uPrimaryCol.mul(0.62), uSecondaryCol.mul(0.62), dualBlend);
      const customMid = mix(uPrimaryCol, uSecondaryCol, dualBlend);
      const customTip = mix(uPrimaryCol.mul(1.24), uSecondaryCol.mul(1.28), dualBlend);

      const gradCol = mix(customRoot, customMid, smoothstep(0.0, 0.55, vHeight));
      const baseTip = mix(gradCol, customTip, smoothstep(0.45, 1.0, vHeight));

      const warmShift = mix(vec3(0.92, 0.97, 0.94), vec3(1.09, 1.03, 0.88), vColorVar);
      const crestMask = vWaveCrest
        .mul(smoothstep(0.28, 1.0, vHeight))
        .mul(clamp(uTipGlow, 0.0, 1.4));
      const ridgeShade = float(0.94).add(float(1.0).sub(abs(vSide)).mul(0.1));
      const baseCol = mix(
        baseTip.mul(warmShift),
        uCrestColor,
        clamp(crestMask.mul(0.42), 0.0, 0.55)
      ).mul(ridgeShade);

      const faceSign = select(frontFacing, float(1.0), float(-0.35));
      const norm = normalize(mix(vec3(0, 1, 0), vBladeNormal.mul(faceSign), vHeight.mul(0.42)));
      const viewDir = normalize(cameraPosition.sub(vWorldPos).add(vec3(0.0001)));
      const ndl = dot(norm, uSunDir);
      const wrapDiff = clamp(ndl.add(0.48).div(1.48), 0.0, 1.0);

      const hemiMix = clamp(norm.y.mul(0.5).add(0.5), 0.0, 1.0);
      const ambientLight = mix(uGroundHemiColor, uSkyColor, hemiMix).mul(uHemiIntensity).mul(0.8);
      const directLight = uSunColor.mul(uSunIntensity).mul(wrapDiff).mul(0.68);

      const halfVec = normalize(uSunDir.add(viewDir));
      const specPower = pow(clamp(dot(norm, halfVec), 0.0, 1.0), 7.5);
      const sunGlint = vec3(uSunColor.r, uSunColor.g, uSunColor.b)
        .mul(specPower)
        .mul(0.11)
        .mul(smoothstep(0.24, 0.96, vHeight));

      const backScatter = pow(clamp(dot(viewDir.negate(), uSunDir), 0.0, 1.0), 3.0);
      const rimGlow = pow(float(1.0).sub(clamp(abs(dot(norm, viewDir)), 0.0, 1.0)), 2.2).mul(0.42);
      const sssGlow = vec3(uSunColor.r, uSunColor.g, uSunColor.b)
        .mul(uCrestColor)
        .mul(backScatter.mul(0.46).add(rimGlow.mul(0.18)))
        .mul(vHeight)
        .mul(uTipGlow);

      const rootAo = mix(0.76, 1.04, smoothstep(0.0, 0.58, vHeight));
      const litCol = baseCol
        .mul(ambientLight.add(directLight))
        .mul(rootAo)
        .add(sssGlow)
        .add(sunGlint)
        .toVar();

      const hdrExcess = max(litCol.sub(vec3(0.86)), vec3(0.0));
      litCol.assign(litCol.min(vec3(0.86)).add(hdrExcess.div(vec3(1.0).add(hdrExcess.mul(2.4)))));
      return vec4(litCol, 1.0);
    })();

    return mat;
  }

  private rebuildPlinth(patchSizeM: number): void {
    while (this.plinthGroup.children.length > 0) {
      const child = this.plinthGroup.children[0];
      this.plinthGroup.remove(child);
    }
    this.soilRimMesh?.geometry.dispose();
    this.turfPadMesh?.geometry.dispose();
    this.meterGridLines?.geometry.dispose();

    const rimW = patchSizeM + 0.34;
    const soilGeo = new THREE.BoxGeometry(rimW, 0.045, rimW);
    this.soilRimMesh = new THREE.Mesh(soilGeo, this.soilMat);
    this.soilRimMesh.position.y = -0.01;
    this.soilRimMesh.receiveShadow = true;

    const turfGeo = new THREE.BoxGeometry(patchSizeM, 0.018, patchSizeM);
    this.turfPadMesh = new THREE.Mesh(turfGeo, this.turfMat);
    this.turfPadMesh.position.y = 0.012;
    this.turfPadMesh.receiveShadow = true;

    // 1.0m grid etched across the meadow sample pad
    const half = patchSizeM * 0.5;
    const pts: number[] = [];
    const yLine = 0.023;
    const step = 1.0;
    const firstTick = -Math.floor(half);
    const lastTick = Math.floor(half);
    for (let x = firstTick; x <= lastTick; x += step) {
      pts.push(x, yLine, -half, x, yLine, half);
    }
    for (let z = firstTick; z <= lastTick; z += step) {
      pts.push(-half, yLine, z, half, yLine, z);
    }
    // Outer boundary frame
    pts.push(
      -half, yLine, -half, half, yLine, -half,
      half, yLine, -half, half, yLine, half,
      half, yLine, half, -half, yLine, half,
      -half, yLine, half, -half, yLine, -half
    );
    const gridGeo = new THREE.BufferGeometry();
    gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.meterGridLines = new THREE.LineSegments(gridGeo, this.gridMat);

    this.plinthGroup.add(this.soilRimMesh, this.turfPadMesh, this.meterGridLines);
  }

  private rebuildClumpGuides(
    clumpAnchors: { x: number; z: number }[],
    showGuides: boolean
  ): void {
    while (this.guideGroup.children.length > 0) {
      const child = this.guideGroup.children[0] as THREE.Mesh;
      child.geometry.dispose();
      this.guideGroup.remove(child);
    }
    if (this.meterGridLines) {
      this.meterGridLines.visible = showGuides;
    }
    if (!showGuides || clumpAnchors.length === 0) return;

    const sharedRingGeo = new THREE.RingGeometry(0.18, 0.24, 24);
    sharedRingGeo.rotateX(-Math.PI / 2);

    for (let i = 0; i < clumpAnchors.length; i++) {
      const a = clumpAnchors[i];
      const ring = new THREE.Mesh(i === 0 ? sharedRingGeo : sharedRingGeo.clone(), this.guideMat);
      ring.position.set(a.x, 0.026, a.z);
      this.guideGroup.add(ring);
    }
  }

  public sync(opts: {
    config?: Partial<GrassFieldConfig> | null;
    patchSizeM: number;
    biome?: BiomeId;
    seedOffset: number;
    showGuides: boolean;
  }): GrassSampleStats {
    const resolved = resolveGrassConfig(opts.config);
    const quality: GrassQuality = resolved.enabled ? resolved.quality : 'off';
    const patchSizeM = THREE.MathUtils.clamp(opts.patchSizeM, 2.0, 7.0);
    const halfPatch = patchSizeM * 0.5;
    const seed = Math.max(1, Math.round(opts.seedOffset));
    const clumpiness = THREE.MathUtils.clamp(resolved.tuftClumpiness ?? 0.45, 0.0, 1.0);

    // Update uniforms every call (instant feedback for sliders/colors)
    const palette = getBiomeGrassPalette(
      opts.biome ?? 'meadow',
      '#4A9840',
      '#7BC452'
    );
    const primaryHex = resolved.primaryColor ?? palette.midHex;
    const secondaryHex = resolved.secondaryColor ?? palette.tipHex;
    this.uHalfPatch.value = halfPatch;
    this.uSeedShift.value = seed;
    this.uBladeHeight.value = THREE.MathUtils.clamp(resolved.bladeHeight, 0.25, 1.8);
    this.uBladeWidth.value = THREE.MathUtils.clamp(resolved.bladeWidth, 0.04, 0.22);
    this.uWindWaveStrength.value = THREE.MathUtils.clamp(resolved.windWaveStrength, 0.1, 2.5);
    this.uTipGlow.value = THREE.MathUtils.clamp(resolved.tipGlow, 0, 1.4);
    this.uPrimaryCol.value.set(primaryHex);
    this.uSecondaryCol.value.set(secondaryHex);
    this.uCrestColor.value.set(palette.crestHex);
    this.uMixNoiseScale.value = THREE.MathUtils.clamp(resolved.mixNoiseScale ?? 1.0, 0.2, 3.0);
    this.uCarexMix.value = THREE.MathUtils.clamp(resolved.carexMix ?? 0.32, 0.0, 1.0);
    this.uTuftClumpiness.value = clumpiness;

    // Tint topsoil gently toward darkened grass root color
    const turfTint = new THREE.Color(primaryHex).multiplyScalar(0.38).lerp(new THREE.Color('#27201A'), 0.42);
    this.turfMat.color.copy(turfTint);

    const spec = getLodTierSpec(quality === 'off' ? 'light' : quality);
    this.uCellSpacing.value = spec.nearSpacing;

    const geoKey = `${quality}:${patchSizeM.toFixed(2)}:${seed}`;
    const guideKey = `${geoKey}:${clumpiness.toFixed(2)}:${opts.showGuides ? 1 : 0}`;

    if (geoKey !== this.lastKey) {
      this.lastKey = geoKey;
      this.rebuildPlinth(patchSizeM);

      if (this.grassMesh) {
        this.group.remove(this.grassMesh);
        this.grassMesh = null;
      }
      if (this.grassGeo) {
        this.grassGeo.dispose();
        this.grassGeo = null;
      }

      if (quality !== 'off') {
        const halfCells = Math.ceil((halfPatch + 1.2) / spec.nearSpacing);
        const cellsPerSide = halfCells * 2 + 1;
        const totalInstances = cellsPerSide * cellsPerSide * spec.nearBladesPerCell;
        const offsets = new Float32Array(totalInstances * 2);
        const subIndices = new Float32Array(totalInstances);
        let o = 0;
        let s = 0;
        for (let dz = -halfCells; dz <= halfCells; dz++) {
          for (let dx = -halfCells; dx <= halfCells; dx++) {
            for (let b = 0; b < spec.nearBladesPerCell; b++) {
              offsets[o++] = dx;
              offsets[o++] = dz;
              subIndices[s++] = b;
            }
          }
        }
        const instGeo = new THREE.InstancedBufferGeometry();
        instGeo.index = this.baseBladeGeo.index;
        instGeo.attributes.position = this.baseBladeGeo.attributes.position;
        instGeo.attributes.uv = this.baseBladeGeo.attributes.uv;
        instGeo.setAttribute('aCellOffset', new THREE.InstancedBufferAttribute(offsets, 2));
        instGeo.setAttribute('aBladeSub', new THREE.InstancedBufferAttribute(subIndices, 1));
        instGeo.instanceCount = totalInstances;
        instGeo.boundingSphere = new THREE.Sphere(
          new THREE.Vector3(0, 0.6, 0),
          patchSizeM * 1.1
        );

        this.grassGeo = instGeo;
        this.grassMesh = new THREE.Mesh(instGeo, this.material);
        this.grassMesh.frustumCulled = false;
        this.grassMesh.castShadow = false;
        this.grassMesh.receiveShadow = false;
        this.group.add(this.grassMesh);
      }
    }

    if (guideKey !== this.lastGuideKey) {
      this.lastGuideKey = guideKey;
      const halfBound = halfPatch - 0.06;
      let bladeCount = 0;
      const clumpAccum = new Map<string, { sumX: number; sumZ: number; count: number }>();

      if (quality !== 'off') {
        const halfCells = Math.ceil((halfPatch + 1.2) / spec.nearSpacing);
        const clumpGridScale = 0.58;
        const seedX = seed * 7.1;
        const seedZ = seed * 13.3;

        for (let dz = -halfCells; dz <= halfCells; dz++) {
          for (let dx = -halfCells; dx <= halfCells; dx++) {
            for (let b = 0; b < spec.nearBladesPerCell; b++) {
              const sx = dx + b * 37.13 + seed * 19.7;
              const sz = dz + b * 91.7 + seed * 41.3;
              const [jx, jz] = jsHash22(sx, sz);
              const rawX = (dx + 0.5 + (jx - 0.5) * 1.52) * spec.nearSpacing;
              const rawZ = (dz + 0.5 + (jz - 0.5) * 1.52) * spec.nearSpacing;

              const warpX = jsNoise2D(rawX * 0.28 + 5.2 + seedX, rawZ * 0.28 + 1.3 + seedZ) - 0.5;
              const warpZ = jsNoise2D(rawX * 0.28 + 18.7 + seedX, rawZ * 0.28 + 9.4 + seedZ) - 0.5;
              const warpedX = rawX + warpX * 1.35;
              const warpedZ = rawZ + warpZ * 1.35;
              const warpedSX = warpedX * clumpGridScale;
              const warpedSZ = warpedZ * clumpGridScale;
              const baseCX = Math.floor(warpedSX - 0.5);
              const baseCZ = Math.floor(warpedSZ - 0.5);

              let bestKey = '';
              let bestDiffSX = 0;
              let bestDiffSZ = 0;
              let bestW = 0;
              let bestD2 = Infinity;

              for (let oz = 0; oz <= 1; oz++) {
                for (let ox = 0; ox <= 1; ox++) {
                  const cx = baseCX + ox;
                  const cz = baseCZ + oz;
                  const [hx, hz] = jsHash22(cx + seedX, cz + seedZ);
                  const w = jsHash21(cx + 7.7 + seedX, cz + 23.1 + seedZ);
                  const siteX = cx + 0.14 + hx * 0.72;
                  const siteZ = cz + 0.14 + hz * 0.72;
                  const diffX = siteX - warpedSX;
                  const diffZ = siteZ - warpedSZ;
                  const d2 = (diffX * diffX + diffZ * diffZ) * (0.68 + (1.42 - 0.68) * w);
                  if (d2 < bestD2) {
                    bestD2 = d2;
                    bestDiffSX = diffX;
                    bestDiffSZ = diffZ;
                    bestW = w;
                    bestKey = `${cx}:${cz}`;
                  }
                }
              }

              const diffMX = bestDiffSX / clumpGridScale;
              const diffMZ = bestDiffSZ / clumpGridScale;
              const clumpDist = Math.hypot(diffMX, diffMZ);
              const bladePullRnd = jsHash21(sx + 29.4, sz + 51.8);
              const clumpPull =
                clumpiness *
                0.66 *
                (0.62 + 0.38 * bestW) *
                (0.45 + 0.55 * bladePullRnd);

              const wx = rawX + diffMX * clumpPull;
              const wz = rawZ + diffMZ * clumpPull;
              if (Math.abs(wx) > halfBound || Math.abs(wz) > halfBound) continue;

              const densityRnd = jsHash21(sx + 17.3, sz + 5.9);
              const meadowDrift =
                jsNoise2D(wx * 0.28 + 3.1 + seedX, wz * 0.28 + 8.7 + seedZ) * 0.62 +
                jsNoise2D(wx * 0.68 + 19.4 + seedX, wz * 0.68 + 2.3 + seedZ) * 0.38;
              const clumpAffinity = 1.0 - smoothstepJS(0.22, 1.12, clumpDist);
              const baseNaturalDensity = 0.76 + 0.24 * smoothstepJS(0.16, 0.78, meadowDrift);
              const clumpGapMod = 0.42 + 0.58 * clamp01(clumpAffinity * 0.72 + meadowDrift * 0.28);
              const organicDensity =
                baseNaturalDensity + (clumpGapMod - baseNaturalDensity) * (clumpiness * 0.68);
              if (densityRnd > organicDensity) continue;

              bladeCount++;
              const prev = clumpAccum.get(bestKey);
              if (prev) {
                prev.sumX += wx;
                prev.sumZ += wz;
                prev.count++;
              } else {
                clumpAccum.set(bestKey, { sumX: wx, sumZ: wz, count: 1 });
              }
            }
          }
        }
      }

      const clumpAnchors: { x: number; z: number }[] = [];
      for (const acc of clumpAccum.values()) {
        if (acc.count >= 2) {
          clumpAnchors.push({ x: acc.sumX / acc.count, z: acc.sumZ / acc.count });
        }
      }

      const patchAreaSqM = patchSizeM * patchSizeM;
      this.lastStats = {
        patchSizeM,
        patchAreaSqM,
        bladeCount,
        bladesPerSqM: patchAreaSqM > 0 ? bladeCount / patchAreaSqM : 0,
        clumpCount: clumpAnchors.length,
        cellSpacingM: spec.nearSpacing,
        bladesPerCell: spec.nearBladesPerCell,
      };
      this.rebuildClumpGuides(clumpAnchors, opts.showGuides);
    }

    return this.lastStats;
  }

  public update(
    elapsedSec: number,
    camera: THREE.Camera,
    sun: THREE.DirectionalLight,
    hemi: THREE.HemisphereLight,
    windFactor: number
  ): void {
    if (!this.group.visible) return;
    this.uTime.value = elapsedSec;
    this.uWindStrength.value = windFactor;
    this.uCameraPos.value.copy(camera.position);

    this._sunDir.copy(sun.position);
    if (this._sunDir.lengthSq() < 0.0001) {
      this._sunDir.set(0.4, 0.75, 0.5);
    }
    this._sunDir.normalize();
    this.uSunDir.value.copy(this._sunDir);
    this.uSunColor.value.copy(sun.color);
    this.uSunIntensity.value = sun.intensity;
    this.uSkyColor.value.copy(hemi.color);
    this.uGroundHemiColor.value.copy(hemi.groundColor);
    this.uHemiIntensity.value = hemi.intensity;
  }

  public dispose(): void {
    this.baseBladeGeo.dispose();
    this.material.dispose();
    if (this.grassGeo) {
      this.grassGeo.dispose();
      this.grassGeo = null;
    }
    this.soilRimMesh?.geometry.dispose();
    this.turfPadMesh?.geometry.dispose();
    this.meterGridLines?.geometry.dispose();
    this.soilMat.dispose();
    this.turfMat.dispose();
    this.gridMat.dispose();
    this.guideMat.dispose();
    while (this.guideGroup.children.length > 0) {
      const ch = this.guideGroup.children[0] as THREE.Mesh;
      ch.geometry.dispose();
      this.guideGroup.remove(ch);
    }
    this.group.clear();
  }
}
