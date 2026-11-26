import * as THREE from 'three';
import {
  MeshPhysicalNodeMaterial,
  NodeMaterialInstance,
  type NodeMaterial,
} from 'three/webgpu';
import {
  Fn,
  attribute,
  cos,
  materialColor,
  materialDiffuseRoughness,
  max,
  modelWorldMatrix,
  positionGeometry,
  positionLocal,
  sin,
  vec3,
  vec4,
} from 'three/tsl';
import {
  applyWeatheringUserData,
  buildWeatheringColorTsl,
  buildWeatheringRoughnessTsl,
  createMaterialVariantInstance,
} from './nodeMaterialUtils';
import type { VisualStyleId, WeatheringPreset } from '../types/maker';
import { attachBotwPainterlyShader, getSharedBotwUniforms } from './botwStyleUtils';

export interface ScatterBatchMaterialOptions {
  style: VisualStyleId;
  timeUniform: { value: number };
  doubleSide?: boolean;
  isMatte?: boolean;
  hasMap?: boolean;
  toonGradient?: THREE.Texture;
}

const scatterBaseCache = new Map<string, NodeMaterial>();
const _defaultWhiteColor = new THREE.Color('#ffffff');
const _hideDummyMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * Shared NodeMaterial templates for instanced foliage, trunks, rocks, and flora.
 * Uses `attribute('aBatchMeta', 'vec4')` + `getSharedBotwUniforms().uTime` so EVERY
 * scatter & vista `InstancedMesh` shares the exact same compiled WebGPU shader pipelines
 * instead of compiling duplicate shaders per BatchedMesh UUID.
 */
export function getSharedScatterBatchBaseMaterial(
  opts: ScatterBatchMaterialOptions
): NodeMaterial {
  const isToon = opts.style === 'celToon';
  const key = [
    opts.isMatte ? 'matte' : 'foliage',
    opts.doubleSide ? 'ds' : 'fs',
    opts.hasMap ? 'map' : 'nomap',
  ].join('|');

  const existing = scatterBaseCache.get(key);
  if (existing) {
    return existing;
  }

  // Always bind the shared BotW time uniform (synced each frame in updateSkyClouds)
  const uTime = getSharedBotwUniforms().uTime;
  // aBatchMeta = [swayAmp, swayBaseY, 1.0, 1.0]
  const batchMetaAttr = attribute('aBatchMeta', 'vec4') as unknown as ReturnType<typeof vec4>;

  const buildPositionNode = () =>
    Fn(() => {
      const swayAmp = batchMetaAttr.x;
      const swayBaseY = batchMetaAttr.y;
      const worldPos = modelWorldMatrix.mul(vec4(positionLocal, 1.0)).xyz;
      const hFactor = max(0.0, positionGeometry.y.sub(swayBaseY));
      const gust = sin(uTime.mul(1.9).add(worldPos.x.mul(0.45)).add(worldPos.z.mul(0.35))).mul(swayAmp);
      const swayZ = cos(uTime.mul(1.5).add(worldPos.z.mul(0.4))).mul(swayAmp.mul(0.6)).mul(hFactor);
      return positionLocal.add(vec3(gust.mul(hFactor), 0.0, swayZ));
    })();

  const phys = new MeshPhysicalNodeMaterial({
    color: '#ffffff',
    roughness: isToon ? 0.88 : 0.84,
    metalness: 0.02,
    diffuseRoughness: opts.isMatte ? 0.9 : 0.72,
    side: opts.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
  });
  phys.positionNode = buildPositionNode();
  phys.colorNode = buildWeatheringColorTsl(vec3(materialColor));
  phys.roughnessNode = buildWeatheringRoughnessTsl();
  phys.diffuseRoughnessNode = materialDiffuseRoughness;
  attachBotwPainterlyShader(phys, {
    isFoliage: !opts.isMatte,
    rimStrengthScale: 0.85,
    shadowLiftScale: 0.85,
    translucencyScale: opts.isMatte ? 0.0 : 0.9,
  });
  applyWeatheringUserData(phys.userData, {
    tintHex: '#ffffff',
    tintMix: 0,
    weathering: 'none',
    weatheringIntensity: 0.65,
  });
  phys.userData.__timeUniform = uTime;
  phys.needsUpdate = true;
  scatterBaseCache.set(key, phys);
  return phys;
}

export interface ScatterMaterialVariantConfig {
  style: VisualStyleId;
  timeUniform: { value: number };
  color?: string;
  roughness?: number;
  diffuseRoughness?: number;
  doubleSide?: boolean;
  map?: THREE.Texture | null;
  normalMap?: THREE.Texture | null;
  normalScale?: number;
  bumpMap?: THREE.Texture | null;
  bumpScale?: number;
  weathering?: WeatheringPreset;
  weatheringIntensity?: number;
}

export function createScatterBatchMaterialInstance(
  cfg: ScatterMaterialVariantConfig
): NodeMaterialInstance {
  const base = getSharedScatterBatchBaseMaterial({
    style: cfg.style,
    timeUniform: cfg.timeUniform,
    doubleSide: cfg.doubleSide,
    isMatte: (cfg.diffuseRoughness ?? 0.5) > 0.6,
    hasMap: Boolean(cfg.map),
  });

  return createMaterialVariantInstance(base, {
    colorHex: cfg.color ?? '#ffffff',
    roughness: cfg.roughness ?? 0.84,
    metalness: 0.02,
    diffuseRoughness: cfg.diffuseRoughness ?? 0.45,
    map: cfg.map ?? null,
    normalMap: cfg.normalMap ?? null,
    normalScale: cfg.normalScale ?? 1,
    bumpMap: cfg.bumpMap ?? null,
    bumpScale: cfg.bumpScale ?? 0.1,
    weathering: cfg.weathering ?? 'none',
    weatheringIntensity: cfg.weatheringIntensity ?? 0.65,
  });
}

/**
 * Normalizes a freshly generated scatter geometry in place so all geometries share
 * the exact same vertex attribute layout (`position`, `normal`, `uv`, `aBatchMeta`) and `.index`.
 */
export function normalizeGeometryForBatch(
  geo: THREE.BufferGeometry,
  swayAmp: number,
  swayBaseY = 0
): THREE.BufferGeometry {
  if (!geo.attributes.normal) {
    geo.computeVertexNormals();
  }

  const posAttr = geo.attributes.position as THREE.BufferAttribute;
  const vCount = posAttr.count;

  if (!geo.attributes.uv) {
    const uvs = new Float32Array(vCount * 2);
    for (let i = 0; i < vCount; i++) {
      uvs[i * 2] = posAttr.getX(i) * 0.5 + 0.5;
      uvs[i * 2 + 1] = posAttr.getY(i) * 0.5 + 0.5;
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  }

  for (const attrName of Object.keys(geo.attributes)) {
    if (attrName !== 'position' && attrName !== 'normal' && attrName !== 'uv') {
      geo.deleteAttribute(attrName);
    }
  }

  const meta = new Float32Array(vCount * 4);
  for (let i = 0; i < vCount; i++) {
    meta[i * 4] = swayAmp;
    meta[i * 4 + 1] = swayBaseY;
    meta[i * 4 + 2] = 1.0;
    meta[i * 4 + 3] = 1.0;
  }
  geo.setAttribute('aBatchMeta', new THREE.BufferAttribute(meta, 4));

  if (!geo.index) {
    const idxArray = vCount > 65535 ? new Uint32Array(vCount) : new Uint16Array(vCount);
    for (let i = 0; i < vCount; i++) idxArray[i] = i;
    geo.setIndex(new THREE.BufferAttribute(idxArray, 1));
  }

  return geo;
}

export interface BatchInstanceSpec {
  geoIndex: number;
  matrix: THREE.Matrix4;
  color?: THREE.Color;
  tag?: number;
}

export interface BatchEntryRef {
  mesh: THREE.InstancedMesh;
  instanceId: number;
}

export function hideBatchEntry(entry: BatchEntryRef, sinkX = 0, sinkY = -60, sinkZ = 0): void {
  _hideDummyMatrix.elements[12] = sinkX;
  _hideDummyMatrix.elements[13] = sinkY;
  _hideDummyMatrix.elements[14] = sinkZ;
  entry.mesh.setMatrixAt(entry.instanceId, _hideDummyMatrix);
  entry.mesh.instanceMatrix.needsUpdate = true;
}

export function setBatchEntryMatrix(entry: BatchEntryRef, matrix: THREE.Matrix4): void {
  entry.mesh.setMatrixAt(entry.instanceId, matrix);
  entry.mesh.instanceMatrix.needsUpdate = true;
}

/**
 * Packs geometry variants and instance placements into one `THREE.InstancedMesh` per
 * non-empty `geoIndex`, grouped inside a `THREE.Group`. Unlike `BatchedMesh` (whose internal
 * `_matricesTexture.uuid` / `_colorsTexture.uuid` forces Three.js r187 WebGPU to recompile a
 * unique shader pipeline per mesh), `InstancedMesh` hits `nodeBuilderCache` with key `'aa,'`
 * so all foliage, trunks, rocks, and vista instances share a tiny handful of compiled shaders!
 */
export function buildBatchedGeometryInstances(opts: {
  geometries: THREE.BufferGeometry[];
  material: THREE.Material;
  entries: BatchInstanceSpec[];
  castShadow?: boolean;
  receiveShadow?: boolean;
  perObjectFrustumCulled?: boolean;
}): {
  batchedMesh: THREE.Group;
  meshes: THREE.InstancedMesh[];
  /** Parallel to opts.entries index for dynamic wobble/hide/chop */
  entryRefs: BatchEntryRef[];
} {
  const { geometries, material, entries } = opts;
  const group = new THREE.Group();
  const meshes: THREE.InstancedMesh[] = [];
  const entryRefs = new Array<BatchEntryRef>(entries.length);

  // Bucket entries by geoIndex preserving original entry indices
  const buckets = geometries.map(() => [] as { entry: BatchInstanceSpec; originalIdx: number }[]);
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const bIdx = e.geoIndex >= 0 && e.geoIndex < buckets.length ? e.geoIndex : 0;
    if (buckets[bIdx]) {
      buckets[bIdx].push({ entry: e, originalIdx: i });
    }
  }

  for (let gIdx = 0; gIdx < geometries.length; gIdx++) {
    const bucket = buckets[gIdx];
    const geo = geometries[gIdx];
    if (!bucket || bucket.length === 0) {
      geo.dispose();
      continue;
    }

    const instMesh = new THREE.InstancedMesh(geo, material, bucket.length);
    instMesh.castShadow = Boolean(opts.castShadow);
    instMesh.receiveShadow = Boolean(opts.receiveShadow);
    instMesh.frustumCulled = opts.perObjectFrustumCulled ?? true;

    for (let localIdx = 0; localIdx < bucket.length; localIdx++) {
      const { entry, originalIdx } = bucket[localIdx];
      instMesh.setMatrixAt(localIdx, entry.matrix);
      instMesh.setColorAt(localIdx, entry.color ?? _defaultWhiteColor);
      entryRefs[originalIdx] = { mesh: instMesh, instanceId: localIdx };
    }

    instMesh.instanceMatrix.needsUpdate = true;
    if (instMesh.instanceColor) {
      instMesh.instanceColor.needsUpdate = true;
    }
    instMesh.computeBoundingSphere();
    instMesh.computeBoundingBox();

    group.add(instMesh);
    meshes.push(instMesh);
  }

  return { batchedMesh: group, meshes, entryRefs };
}
