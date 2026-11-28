import * as THREE from 'three';
import { MeshPhysicalNodeMaterial, type NodeMaterial } from 'three/webgpu';
import {
  abs,
  cameraPosition,
  clamp,
  cos,
  densityFogFactor,
  diffuseColor,
  dot,
  exponentialHeightFogFactor,
  float,
  fog,
  materialEmissive,
  max,
  min,
  mix,
  normalWorld,
  normalize,
  positionWorld,
  pow,
  sin,
  smoothstep,
  uniform,
  vec2,
  vec3,
} from 'three/tsl';
import type { TerrainQualityTier, VisualStyleId } from '../types/maker';
import { upgradeToNodeMaterial } from './nodeMaterialUtils';

export interface BotwAtmosphereInput {
  zenithColor: THREE.Color;
  midColor: THREE.Color;
  horizonColor: THREE.Color;
  fogColor: THREE.Color;
  sunColor: THREE.Color;
  sunPos: THREE.Vector3;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  nightFactor: number;
  warmGlow: number;
}

function createSharedBotwUniforms() {
  return {
    uSunDir: uniform(new THREE.Vector3(0.55, 0.48, 0.45).normalize()),
    uSunColor: uniform(new THREE.Color('#FFF5E0')),
    uRimColor: uniform(new THREE.Color('#B5DEFF')),
    uShadowCoolColor: uniform(new THREE.Color('#34528A')),
    uSkyZenith: uniform(new THREE.Color('#3572B8')),
    uSkyMid: uniform(new THREE.Color('#6CA4DA')),
    uSkyHorizon: uniform(new THREE.Color('#93C4E8')),
    uNightFactor: uniform(0),
    uCloudDetailLevel: uniform(0.76),
    uWaterDetailLevel: uniform(0.76),
    uRimStrength: uniform(0.14),
    uShadowLiftStrength: uniform(0.14),
    uTranslucencyStrength: uniform(0.32),
    uCloudShadowStrength: uniform(0.11),
    uTime: uniform(0),
  };
}

export type BotwSharedUniforms = ReturnType<typeof createSharedBotwUniforms>;

function createBotwFogUniformBundle(
  fogColor: THREE.Color,
  fogDensity: number,
  waterLevel: number
) {
  return {
    uFogColor: uniform(fogColor.clone()),
    uFogDensity: uniform(fogDensity),
    uHeightFogDensity: uniform(0.0018),
    uHeightFogLevel: uniform(waterLevel + 3.4),
    uHeightFogSoftness: uniform(8.0),
    uHeightFogNoiseAmp: uniform(4.0),
    uHeightFogPatchiness: uniform(0.45),
    uTime: uniform(0.0),
    uWind: uniform(new THREE.Vector2(0.35, 0.15)),
    uSunDir: uniform(new THREE.Vector3(0.55, 0.48, 0.45).normalize()),
    uSunInscatterColor: uniform(new THREE.Color('#FFD29D')),
    uSunInscatterStrength: uniform(0.45),
  };
}

export type BotwFogUniformBundle = ReturnType<typeof createBotwFogUniformBundle>;

let _sharedUniforms: BotwSharedUniforms | null = null;

/**
 * Shared global TSL uniforms powering cohesive Breath-of-the-Wild style soft rim light,
 * cool-sky shadow temperature shifts, backlit foliage translucency, and drifting cloud shadows
 * with zero per-material uniform churn and zero shader recompiles on time/style switches.
 */
export function getSharedBotwUniforms(): BotwSharedUniforms {
  if (_sharedUniforms) return _sharedUniforms;
  _sharedUniforms = createSharedBotwUniforms();
  return _sharedUniforms;
}

const _tmpSunDir = new THREE.Vector3();
const _tmpRimCol = new THREE.Color();
const _tmpCoolCol = new THREE.Color();
const _tmpWarmFog = new THREE.Color();

export function syncBotwTime(elapsed: number, scene?: THREE.Scene): void {
  getSharedBotwUniforms().uTime.value = elapsed;
  if (scene) {
    const fogU = scene.userData.botwFogUniforms as BotwFogUniformBundle | undefined;
    if (fogU) {
      fogU.uTime.value = elapsed;
    }
  }
}

export function syncTerrainAtmosphereQuality(tier: TerrainQualityTier): void {
  const u = getSharedBotwUniforms();
  const level = tier === 'ultra' ? 1.0 : tier === 'performance' ? 0.4 : 0.76;
  u.uCloudDetailLevel.value = level;
  u.uWaterDetailLevel.value = level;
}

/**
 * Syncs global BotW painterly lighting uniforms whenever sky, style, warmth, or time-of-day updates.
 */
export function syncBotwStyleUniforms(
  style: VisualStyleId,
  atmo: BotwAtmosphereInput,
  env: string,
  cloudDensity: number,
  skyId: string
): void {
  const u = getSharedBotwUniforms();

  _tmpSunDir.copy(atmo.sunPos);
  if (_tmpSunDir.lengthSq() < 0.0001) {
    _tmpSunDir.set(0.45, 0.72, 0.42);
  }
  _tmpSunDir.normalize();
  u.uSunDir.value.copy(_tmpSunDir);
  u.uSunColor.value.copy(atmo.sunColor);

  // Sky-tinted grazing rim blends crisp zenith sky light with warm horizon sun sheen
  _tmpRimCol.copy(atmo.hemiSky).lerp(atmo.horizonColor, 0.35 + atmo.warmGlow * 0.25);
  u.uRimColor.value.copy(_tmpRimCol);

  // Cool sky/indigo shadow tint (never muddy grey/black)
  _tmpCoolCol
    .set('#3A5A9C')
    .lerp(atmo.zenithColor, 0.38)
    .lerp(atmo.hemiSky, 0.22);
  u.uShadowCoolColor.value.copy(_tmpCoolCol);

  // Sky reflection gradient & night attenuation for planar water reflections & shallow caustics
  u.uSkyZenith.value.copy(atmo.zenithColor);
  u.uSkyMid.value.copy(atmo.midColor);
  u.uSkyHorizon.value.copy(atmo.horizonColor);
  u.uNightFactor.value = atmo.nightFactor;

  const isIndoor = env === 'dungeon' || env === 'castle' || env === 'scifi';
  const dayWeight = 1.0 - atmo.nightFactor * 0.65;

  if (style === 'celToon') {
    u.uRimStrength.value = (isIndoor ? 0.16 : 0.25) * dayWeight;
    u.uShadowLiftStrength.value = isIndoor ? 0.14 : 0.22;
    u.uTranslucencyStrength.value = 0.46;
  } else if (style === 'softFantasy') {
    u.uRimStrength.value = (isIndoor ? 0.13 : 0.19) * dayWeight;
    u.uShadowLiftStrength.value = isIndoor ? 0.12 : 0.17;
    u.uTranslucencyStrength.value = 0.38;
  } else {
    u.uRimStrength.value = (isIndoor ? 0.04 : 0.08) * dayWeight;
    u.uShadowLiftStrength.value = isIndoor ? 0.03 : 0.06;
    u.uTranslucencyStrength.value = 0.28;
  }

  // Drifting cloud dappled shadows across sunlit open-world meadows & hills
  const stormDamp = skyId === 'storm' ? 0.25 : 1.0;
  const openSunlit = !isIndoor && env !== 'sideScroller';
  u.uCloudShadowStrength.value =
    openSunlit && cloudDensity > 0.05
      ? THREE.MathUtils.clamp((0.06 + cloudDensity * 0.09) * dayWeight * stormDamp, 0, 0.15)
      : 0.0;
}

/**
 * Installs and updates r187 `scene.fogNode` with aerial perspective sun-inscatter
 * and gentle low-valley height mist so distant landscapes feel vast and painterly.
 */
export function syncBotwSceneFog(
  scene: THREE.Scene,
  atmo: BotwAtmosphereInput,
  env: string,
  fogSlider: number,
  cloudDensity: number,
  skyId: string,
  waterLevel = -1.65,
  vistaHeightFog = 1.0,
  options?: {
    heightFogLevel?: number;
    softness?: number;
    noise?: number;
    patchiness?: number;
    wind?: number;
  }
): number {
  const baseFog = env === 'dungeon' ? 0.015 : skyId === 'golden' ? 0.00135 : 0.00072;
  const fogDensity = baseFog + fogSlider * 0.0052;
  scene.fog = new THREE.FogExp2(atmo.fogColor.getHex(), fogDensity);
  scene.fogNode = null as any;

  let fogU = scene.userData.botwFogUniforms as BotwFogUniformBundle | undefined;
  if (!fogU) {
    fogU = createBotwFogUniformBundle(atmo.fogColor, fogDensity, waterLevel);
    scene.userData.botwFogUniforms = fogU;
  }

  _tmpSunDir.copy(atmo.sunPos);
  if (_tmpSunDir.lengthSq() < 0.0001) {
    _tmpSunDir.set(0.45, 0.72, 0.42);
  }
  _tmpSunDir.normalize();

  _tmpWarmFog
    .copy(atmo.horizonColor)
    .lerp(atmo.sunColor, 0.42 + atmo.warmGlow * 0.22);

  fogU.uFogColor.value.copy(atmo.fogColor);
  fogU.uFogDensity.value = fogDensity;
  fogU.uSunDir.value.copy(_tmpSunDir);
  fogU.uSunInscatterColor.value.copy(_tmpWarmFog);

  if (options) {
    if (options.softness !== undefined) fogU.uHeightFogSoftness.value = options.softness;
    if (options.noise !== undefined) fogU.uHeightFogNoiseAmp.value = options.noise * 4.6;
    if (options.patchiness !== undefined) fogU.uHeightFogPatchiness.value = options.patchiness;
    if (options.wind !== undefined) {
      const spd = THREE.MathUtils.clamp(options.wind, 0.05, 2.0);
      fogU.uWind.value.set(spd * 0.35, spd * 0.15);
    }
  }

  const mistScale = THREE.MathUtils.clamp(vistaHeightFog, 0, 2.5);
  const isOutdoor = env === 'openWorld' || env === 'castle' || env === 'sideScroller';
  if (!isOutdoor) {
    fogU.uHeightFogDensity.value = 0.0;
    fogU.uSunInscatterStrength.value = 0.0;
  } else {
    const mistBoost = skyId === 'mist' ? 1.75 : skyId === 'golden' ? 1.3 : 1.0;
    const valleyBase = (0.00055 + fogSlider * 0.0018 + cloudDensity * 0.0004) * mistScale;
    fogU.uHeightFogDensity.value =
      env === 'openWorld' ? valleyBase * mistBoost * (1.0 - atmo.nightFactor * 0.4) : valleyBase * 0.35;
    const baseLvl = options?.heightFogLevel !== undefined
      ? options.heightFogLevel
      : waterLevel + 3.6 + fogSlider * 2.2 + Math.max(0, mistScale - 1) * 4.5;
    fogU.uHeightFogLevel.value = baseLvl;
    fogU.uSunInscatterStrength.value =
      (0.32 + atmo.warmGlow * 0.38) * (1.0 - atmo.nightFactor * 0.85);
  }

  return fogDensity;
}

/**
 * Returns a gentle world-space drifting cloud-shadow multiplier `[1 - strength .. 1.0]`
 * evaluated along XZ coordinates so terrain and grass gently breathe with passing sunlight.
 */
export function createDriftingCloudShadowNode(worldXZ: any) {
  const u = getSharedBotwUniforms();
  const drift = vec2(u.uTime.mul(0.065), u.uTime.mul(0.038));
  const uv = worldXZ.mul(0.135).sub(drift);
  const w1 = sin(uv.x.add(sin(uv.y.mul(0.82)).mul(1.15))).mul(
    cos(uv.y.mul(0.94).sub(uv.x.mul(0.37)))
  );
  const w2 = cos(uv.x.mul(1.72).sub(uv.y.mul(1.48)).add(2.1)).mul(
    sin(uv.y.mul(1.61).add(uv.x.mul(0.88)).sub(0.7))
  );
  const cloud = smoothstep(0.08, 0.76, w1.mul(0.65).add(w2.mul(0.35)).mul(0.5).add(0.5));
  return float(1.0).sub(cloud.mul(u.uCloudShadowStrength));
}

export interface AttachBotwOptions {
  isFoliage?: boolean;
  rimStrengthScale?: number;
  shadowLiftScale?: number;
  translucencyScale?: number;
}

type TslEmissiveNode = ReturnType<typeof materialEmissive.add>;

const _botwExtraLightCache = new Map<string, TslEmissiveNode>();
const _botwDefaultEmissiveCache = new Map<string, TslEmissiveNode>();

/**
 * Enhances a PBR/Node material with Breath-of-the-Wild style cohesive soft lighting:
 * - Grazing sky/sun rim catchlight (separates silhouettes without dark ink outlines)
 * - Cool sky-tinted shadow lift (eliminates muddy black/grey shadows)
 * - Optional backlit foliage subsurface scattering glow
 * Preserves any existing `material.emissive` contribution.
 */
export function attachBotwPainterlyShader(
  mat: THREE.Material,
  opts: AttachBotwOptions = {}
): NodeMaterial {
  const nodeMat = upgradeToNodeMaterial(mat);
  if (nodeMat.userData?.botwPatched) {
    return nodeMat;
  }

  const rimScale = opts.rimStrengthScale ?? 1.0;
  const shadowScale = opts.shadowLiftScale ?? 1.0;
  const sssScale = opts.translucencyScale ?? 1.0;
  const isFoliage = Boolean(opts.isFoliage);
  const cacheKey = `${isFoliage ? 1 : 0}|${rimScale}|${shadowScale}|${sssScale}`;

  let extraLight = _botwExtraLightCache.get(cacheKey);
  if (!extraLight) {
    const u = getSharedBotwUniforms();

    const viewDir = normalize(cameraPosition.sub(positionWorld).add(vec3(0.0001)));
    const nW = normalize(normalWorld);
    const sunN = normalize(u.uSunDir);
    const ndl = dot(nW, sunN);

    // Soft sky-facing grazing rim highlight (subtle painted catchlight, never a dark outline)
    const fresnel = pow(float(1.0).sub(clamp(abs(dot(nW, viewDir)), 0.0, 1.0)), 3.1);
    const skyFacing = smoothstep(-0.22, 0.72, nW.y);
    const sunWrap = clamp(ndl.mul(0.5).add(0.5), 0.0, 1.0);
    const rimTint = mix(u.uRimColor, u.uSunColor, 0.25);
    const rimGlow = rimTint
      .mul(mix(vec3(1.0), diffuseColor.rgb, 0.25))
      .mul(fresnel)
      .mul(skyFacing)
      .mul(float(0.45).add(sunWrap.mul(0.55)))
      .mul(u.uRimStrength)
      .mul(rimScale);

    // Cool sky-blue shadow temperature shift (keeps shadows airy & vibrant)
    const shadowMask = clamp(float(0.52).sub(ndl.mul(0.52)), 0.0, 1.0);
    const coolShadowLift = diffuseColor.rgb
      .mul(u.uShadowCoolColor)
      .mul(shadowMask)
      .mul(u.uShadowLiftStrength)
      .mul(shadowScale);

    let built = rimGlow.add(coolShadowLift);

    if (isFoliage) {
      const backLit = pow(max(0.0, dot(viewDir, sunN.negate())), 2.4);
      const edgeGlow = pow(float(1.0).sub(clamp(abs(dot(nW, viewDir)), 0.0, 1.0)), 2.4);
      const sss = diffuseColor.rgb
        .mul(u.uSunColor)
        .mul(backLit.mul(0.75).add(edgeGlow.mul(0.16)))
        .mul(u.uTranslucencyStrength)
        .mul(sssScale);
      built = min(built.add(sss), vec3(0.42));
    } else {
      built = min(built, vec3(0.48));
    }

    extraLight = built as unknown as TslEmissiveNode;
    _botwExtraLightCache.set(cacheKey, extraLight);
  }

  // Add cleanly over any existing custom emissiveNode or material.emissive color
  const emissiveTarget = nodeMat as MeshPhysicalNodeMaterial;
  const prevEmissive = emissiveTarget.emissiveNode;
  if (prevEmissive && (prevEmissive as unknown as { isNode?: boolean }).isNode) {
    emissiveTarget.emissiveNode = vec3(prevEmissive as unknown as ReturnType<typeof vec3>).add(extraLight);
  } else {
    let defaultEmissive = _botwDefaultEmissiveCache.get(cacheKey);
    if (!defaultEmissive) {
      defaultEmissive = materialEmissive.add(extraLight);
      _botwDefaultEmissiveCache.set(cacheKey, defaultEmissive);
    }
    emissiveTarget.emissiveNode = defaultEmissive;
  }

  nodeMat.userData.botwPatched = true;
  nodeMat.needsUpdate = true;
  return nodeMat;
}

/**
 * Adapts a single standard/node material to match the level's Visual Style using cohesive
 * EON velvety roughness and BotW TSL lighting instead of muddy flat toon banding.
 */
export function adaptMaterialForVisualStyle(
  mat: THREE.Material,
  style: VisualStyleId,
  opts: AttachBotwOptions = {}
): THREE.Material {
  if (
    (mat as THREE.MeshBasicMaterial).isMeshBasicMaterial ||
    (mat as { isMeshBasicNodeMaterial?: boolean }).isMeshBasicNodeMaterial
  ) {
    return mat;
  }
  if (mat.userData?.botwPatched) return mat;
  if (mat.transparent && (mat.opacity ?? 1) < 0.85) return mat;
  if ((mat as unknown as { isNodeMaterialInstance?: boolean }).isNodeMaterialInstance) {
    return mat;
  }

  // Upgrade to MeshPhysicalNodeMaterial so EON diffuseRoughness + BotW TSL rim/cool-shadows apply uniformly
  const cloned = mat.clone();
  const nodeMat = upgradeToNodeMaterial(cloned);
  if (nodeMat !== cloned) {
    cloned.dispose();
  }

  const phys = nodeMat as MeshPhysicalNodeMaterial;
  const baseRough = typeof phys.roughness === 'number' ? phys.roughness : 0.82;
  const baseMetal = typeof phys.metalness === 'number' ? phys.metalness : 0.0;

  if (opts.isFoliage) {
    phys.roughness = THREE.MathUtils.clamp(Math.max(0.86, baseRough), 0.72, 0.96);
    phys.metalness = 0.0;
    phys.envMapIntensity = Math.min(phys.envMapIntensity ?? 1.0, 0.32);
    phys.diffuseRoughness = THREE.MathUtils.clamp(Math.max(0.88, phys.diffuseRoughness ?? 0.88), 0, 1);
  } else if (style === 'celToon') {
    // Velvety non-plastic surfaces with crisp sky-rim & cool shadow lift
    if (baseMetal < 0.35) {
      phys.roughness = THREE.MathUtils.clamp(Math.max(0.68, baseRough + 0.08), 0.35, 0.96);
    }
    phys.diffuseRoughness = THREE.MathUtils.clamp(Math.max(0.88, phys.diffuseRoughness ?? 0.88), 0, 1);
  } else if (style === 'softFantasy') {
    if (baseMetal < 0.35) {
      phys.roughness = THREE.MathUtils.clamp(Math.max(0.58, baseRough + 0.12), 0.35, 0.95);
    }
    phys.metalness = Math.max(0, baseMetal * 0.65);
    phys.diffuseRoughness = THREE.MathUtils.clamp(Math.max(0.84, phys.diffuseRoughness ?? 0.84), 0, 1);
  } else {
    phys.diffuseRoughness = THREE.MathUtils.clamp(Math.max(0.74, phys.diffuseRoughness ?? 0.74), 0, 1);
  }

  return attachBotwPainterlyShader(phys, opts);
}

/**
 * Traverses a 3D prop/entity/architecture hierarchy and upgrades materials to the level's cohesive
 * BotW / Soft-Painterly style (replacing harsh MeshToonMaterial bands and preserving shared instances).
 */
export function applyBotwStyleToObject(
  root: THREE.Object3D,
  style: VisualStyleId,
  opts: AttachBotwOptions = {},
  convertedCache?: Map<THREE.Material, THREE.Material>
): void {
  const converted = convertedCache ?? new Map<THREE.Material, THREE.Material>();
  const mapMat = (m: THREE.Material) => {
    const existing = converted.get(m);
    if (existing) return existing;
    const adapted = adaptMaterialForVisualStyle(m, style, opts);
    converted.set(m, adapted);
    return adapted;
  };
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    if (mesh.userData?.skipBotwStyle) return;
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map(mapMat);
    } else {
      mesh.material = mapMat(mesh.material);
    }
  });
}
