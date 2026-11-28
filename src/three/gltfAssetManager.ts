import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { buildObjectBVH } from './bvhAcceleration';
import type {
  AssetCategory,
  BuildingBlockConfig,
  CharacterMakerDoc,
  CustomAssetMeta,
  CustomClipSlot,
  CustomMotionPreset,
  CustomRigSettings,
  FlowerMakerRecipe,
  ObjectInteractionAttributeId,
  ObjectInteractionCalibration,
  ObjectMakerDoc,
  ObjectMechanism,
  ObjectAttachBodyPart,
  StylizedCanopyConfig,
  VertexPaintStroke,
  VisualStyleId,
} from '../types/maker';
import { getAssetBlob } from '../utils/assetVault';
import { uid } from '../utils/terrain';
import { getTerrainTextureAtlas } from './proceduralTextures';
import { applyVertexPaintStrokesToObject } from './vertexPainter';
import {
  createDefaultRigSettings,
  inspectAnimationClip,
  inspectModelSkeleton,
  ProceduralRigController,
  type ClipDiagnostics,
  type RigTestOverride,
  type SkeletonInspection,
} from './proceduralRigAnimator';
import {
  createHardwareWebGL2Context,
  getKnownWebGPUMaxTextureArrayLayers,
  optimizeObjectBuffers,
  sanitizeObjectMorphTargets,
} from './webglUtils';

export interface CachedGLTF {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  clipDiagnostics: ClipDiagnostics[];
  baseScale: number;
  baseGroundOffset: number;
  hasSkeleton: boolean;
  skeletonInfo: SkeletonInspection;
  defaultRigSettings: CustomRigSettings;
}

export interface CustomModelInstance {
  group: THREE.Group;
  modelRoot: THREE.Group;
  scaledRoot: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  proceduralRig: ProceduralRigController | null;
  rigSettings: CustomRigSettings;
  clips: Partial<Record<CustomClipSlot, THREE.AnimationAction>>;
  clipHasMotion: Partial<Record<CustomClipSlot, boolean>>;
  fallbackAction: THREE.AnimationAction | null;
  currentSlot: CustomClipSlot;
  activeDriver: 'clip' | 'procedural' | 'custom' | 'none';
  setAction: (slot: CustomClipSlot, fadeSec?: number) => void;
  update: (dt: number, speedMultiplier?: number) => void;
  applyRigSettings: (next: CustomRigSettings) => void;
  setCustomAnimations: (
    presets: CustomMotionPreset[] | undefined,
    defaults: Partial<Record<CustomClipSlot, string>> | undefined
  ) => void;
  setTestOverride: (override: RigTestOverride) => void;
  setAnimSpeed: (speed: number) => void;
}

const loader = new GLTFLoader();
// Attach Meshopt (bundled locally), Draco, and KTX2/Basis Universal decoders for AAA compressed GLBs
loader.setMeshoptDecoder(MeshoptDecoder);

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
dracoLoader.setDecoderConfig({ type: 'wasm' });
loader.setDRACOLoader(dracoLoader);

const ktx2Loader = new KTX2Loader();
ktx2Loader.setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.187.0/examples/jsm/libs/basis/');
loader.setKTX2Loader(ktx2Loader);

let ktx2SupportDetected = false;

/**
 * Configures GPU-compressed KTX2 / Basis Universal transcoding targets for the active
 * WebGPURenderer (or WebGL2 fallback) once after renderer initialization.
 */
export function configureGltfRendererSupport(renderer: WebGPURenderer): void {
  if (ktx2SupportDetected) return;
  ktx2SupportDetected = true;
  try {
    const ktxAny = ktx2Loader as unknown as {
      detectSupportAsync?: (r: WebGPURenderer) => Promise<KTX2Loader>;
      detectSupport?: (r: WebGPURenderer) => KTX2Loader;
    };
    if (typeof ktxAny.detectSupportAsync === 'function') {
      void ktxAny.detectSupportAsync(renderer).catch(() => {
        // Ignore if running in software fallback
      });
    } else if (typeof ktxAny.detectSupport === 'function') {
      ktxAny.detectSupport(renderer);
    }
  } catch {
    // Safe fallback
  }
}

const parsedCache = new Map<string, CachedGLTF>();
const pendingLoads = new Map<string, Promise<CachedGLTF | null>>();
const listeners = new Set<() => void>();

export function subscribeAssetCache(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function notifyAssetCache() {
  listeners.forEach((cb) => cb());
}

export function autoMapAnimationClips(
  clipNames: string[]
): Partial<Record<CustomClipSlot, string>> {
  const map: Partial<Record<CustomClipSlot, string>> = {};
  const match = (patterns: RegExp[]): string | undefined => {
    for (const p of patterns) {
      const found = clipNames.find((n) => p.test(n));
      if (found) return found;
    }
    return undefined;
  };

  map.idle = match([/idle/i, /stand/i, /breath/i, /wait/i]);
  map.walk = match([/walk/i, /stroll/i, /patrol/i, /move/i]);
  map.run = match([/run/i, /sprint/i, /dash/i, /gallop/i]);
  map.jump = match([/jump/i, /hop/i, /leap/i, /air/i]);
  map.swim = match([/swim/i, /tread/i, /paddle/i, /float/i]);
  map.attack = match([/attack/i, /slash/i, /swing/i, /hit/i, /strike/i]);
  map.interact = match([/interact/i, /wave/i, /dance/i, /cheer/i, /talk/i, /open/i, /emote/i]);
  map.sit = match([/\bsit\b/i, /seat/i, /chair/i]);
  map.hold = match([/\bhold\b/i, /carry/i]);
  map.swing = match([/swing/i, /chop/i]);
  map.throw = match([/throw/i, /toss/i]);
  map.sleep = match([/sleep/i, /lie/i, /rest/i]);
  map.fishing = match([/fish/i, /cast/i, /reel/i]);
  map.lift = match([/\blift\b/i, /hoist/i]);
  map.pull = match([/\bpull\b/i, /tug/i]);
  map.push = match([/\bpush\b/i, /shove/i]);
  map.dig = match([/\bdig\b/i, /shovel/i]);
  map.climbVertical = match([/climb.*vert/i, /ladder/i, /\bclimb\b/i]);
  map.climbStairs = match([/stair/i, /step.*up/i]);
  map.crouch = match([/crouch/i, /duck/i]);
  map.sneak = match([/sneak/i, /creep/i, /stealth/i]);
  map.stab = match([/stab/i, /thrust/i]);
  map.bowPull = match([/bow/i, /arrow/i, /draw/i]);
  map.hug = match([/\bhug\b/i, /embrace/i]);
  map.punch = match([/punch/i, /jab/i]);
  map.kick = match([/\bkick\b/i]);

  // Only default clipNames[0] to idle if it wasn't already matched to an active motion/action slot
  const alreadyAssigned = new Set(Object.values(map).filter(Boolean));
  if (!map.idle && clipNames.length > 0 && !alreadyAssigned.has(clipNames[0])) {
    map.idle = clipNames[0];
  }
  return map;
}

function computeNormalizedBounds(root: THREE.Object3D, category: AssetCategory) {
  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    const sk = obj as THREE.SkinnedMesh;
    if (sk.isSkinnedMesh && sk.skeleton) {
      sk.skeleton.update();
    }
  });
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) {
    return { baseScale: 1, baseGroundOffset: 0 };
  }
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(0.01, size.y, Math.max(size.x, size.z) * 0.85);
  const targetHeight =
    category === 'character'
      ? 1.85
      : category === 'tree'
      ? 3.2
      : category === 'scenery'
      ? 2.8
      : category === 'building'
      ? 2.4
      : category === 'plant'
      ? 1.45
      : 1.25;
  const baseScale = THREE.MathUtils.clamp(targetHeight / maxDim, 0.01, 60);
  const baseGroundOffset = -box.min.y * baseScale;
  return { baseScale, baseGroundOffset };
}

const MAX_GLTF_COLOR_TEX_DIM = 512;
const MAX_GLTF_DATA_TEX_DIM = 256;
const MAX_GLTF_TEX_ANISOTROPY = 4;

function downsampleGLTFTexture(
  tex: THREE.Texture | null | undefined,
  maxDim: number,
  isColor: boolean,
  seen: Set<THREE.Texture>
): void {
  if (!tex || seen.has(tex)) return;
  seen.add(tex);

  if (isColor && tex.colorSpace !== THREE.SRGBColorSpace) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.anisotropy = Math.min(tex.anisotropy || MAX_GLTF_TEX_ANISOTROPY, MAX_GLTF_TEX_ANISOTROPY);

  // Preserve GPU-compressed KTX2 / Basis Universal textures directly in VRAM (4x-8x memory savings)
  if ((tex as THREE.CompressedTexture).isCompressedTexture) {
    return;
  }

  const img = tex.image as
    | { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number; close?: () => void }
    | undefined;
  if (!img || typeof document === 'undefined') {
    tex.needsUpdate = true;
    return;
  }

  const origW = img.naturalWidth || img.width || 0;
  const origH = img.naturalHeight || img.height || 0;
  if (origW <= maxDim && origH <= maxDim) {
    tex.needsUpdate = true;
    return;
  }

  const scale = Math.min(maxDim / origW, maxDim / origH);
  const targetW = Math.max(16, Math.round(origW * scale));
  const targetH = Math.max(16, Math.round(origH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    tex.needsUpdate = true;
    return;
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  try {
    ctx.drawImage(img as CanvasImageSource, 0, 0, targetW, targetH);
    if (typeof img.close === 'function') {
      try {
        img.close();
      } catch {
        // ignore closed ImageBitmap
      }
    }
    tex.image = canvas;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
  } catch {
    tex.needsUpdate = true;
  }
}

function prepareGLTFScene(gltf: GLTF, category: AssetCategory): CachedGLTF {
  const root = new THREE.Group();
  root.add(gltf.scene);
  const processedTextures = new Set<THREE.Texture>();
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((mat) => {
        if (!mat) return;
        const std = mat as THREE.MeshStandardMaterial;
        downsampleGLTFTexture(std.map, MAX_GLTF_COLOR_TEX_DIM, true, processedTextures);
        downsampleGLTFTexture(std.emissiveMap, MAX_GLTF_COLOR_TEX_DIM, true, processedTextures);
        downsampleGLTFTexture(std.normalMap, MAX_GLTF_DATA_TEX_DIM, false, processedTextures);
        downsampleGLTFTexture(std.roughnessMap, MAX_GLTF_DATA_TEX_DIM, false, processedTextures);
        downsampleGLTFTexture(std.metalnessMap, MAX_GLTF_DATA_TEX_DIM, false, processedTextures);
        downsampleGLTFTexture(std.aoMap, MAX_GLTF_DATA_TEX_DIM, false, processedTextures);
        downsampleGLTFTexture(std.bumpMap, MAX_GLTF_DATA_TEX_DIM, false, processedTextures);
      });
    }
  });
  const animations = gltf.animations ?? [];
  sanitizeObjectMorphTargets(root, { animations });
  optimizeObjectBuffers(root, {
    weldUnindexed: true,
    interleave: true,
    computeBounds: true,
  });
  // Build O(log N) MeshBVH bounds trees on static meshes for instant editor picking & Play Mode raycasts
  buildObjectBVH(root, 180);
  const { baseScale, baseGroundOffset } = computeNormalizedBounds(root, category);
  const skeletonInfo = inspectModelSkeleton(root);
  const clipDiagnostics = animations.map((c, idx) => inspectAnimationClip(c, `Clip ${idx + 1}`));
  const hasMovingClips = clipDiagnostics.some((d) => d.hasMotion);
  const defaultRigSettings = createDefaultRigSettings(skeletonInfo, hasMovingClips);

  return {
    scene: root,
    animations,
    clipDiagnostics,
    baseScale,
    baseGroundOffset,
    hasSkeleton: skeletonInfo.hasSkeleton,
    skeletonInfo,
    defaultRigSettings,
  };
}

let thumbRenderer: WebGPURenderer | null = null;
let thumbInitPromise: Promise<WebGPURenderer | null> | null = null;
let thumbEnv: THREE.Texture | null = null;
let thumbCleanupTimer: number | null = null;
let activeThumbRenders = 0;

function disposeThumbRendererNow(): void {
  if (thumbCleanupTimer !== null && typeof window !== 'undefined') {
    window.clearTimeout(thumbCleanupTimer);
    thumbCleanupTimer = null;
  }
  if (activeThumbRenders > 0) return;
  try {
    thumbEnv?.dispose();
  } catch {
    // ignore dispose error
  }
  thumbEnv = null;
  try {
    thumbRenderer?.dispose();
  } catch {
    // ignore dispose error
  }
  thumbRenderer = null;
  thumbInitPromise = null;
}

function scheduleThumbRendererCleanup(): void {
  if (typeof window === 'undefined') return;
  if (thumbCleanupTimer !== null) {
    window.clearTimeout(thumbCleanupTimer);
  }
  thumbCleanupTimer = window.setTimeout(() => {
    thumbCleanupTimer = null;
    if (activeThumbRenders === 0) {
      disposeThumbRendererNow();
    }
  }, 120000);
}

function encodeCompressedThumbnail(canvas: HTMLCanvasElement): string {
  try {
    const webp = canvas.toDataURL('image/webp', 0.82);
    if (webp.startsWith('data:image/webp')) return webp;
  } catch {
    // fallback below
  }
  return canvas.toDataURL('image/jpeg', 0.82);
}

function createLightweightThumbEnvTexture(): THREE.DataTexture {
  const w = 16;
  const h = 8;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const v = y / (h - 1);
    const isSky = v >= 0.48;
    const r = isSky ? Math.round(196 + 44 * v) : Math.round(68 + 40 * (v / 0.48));
    const g = isSky ? Math.round(212 + 36 * v) : Math.round(72 + 44 * (v / 0.48));
    const b = isSky ? Math.round(235 + 20 * v) : Math.round(92 + 52 * (v / 0.48));
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

async function ensureThumbRenderer(): Promise<WebGPURenderer | null> {
  if (typeof document === 'undefined') return null;
  if (thumbCleanupTimer !== null && typeof window !== 'undefined') {
    window.clearTimeout(thumbCleanupTimer);
    thumbCleanupTimer = null;
  }
  if (thumbRenderer) return thumbRenderer;
  if (thumbInitPromise) return thumbInitPromise;

  thumbInitPromise = (async () => {
    const createWithHardwareWebGL = async (): Promise<WebGPURenderer | null> => {
      const canvas = document.createElement('canvas');
      const { gl } = createHardwareWebGL2Context(canvas, {
        antialias: true,
        alpha: true,
        depth: true,
        stencil: false,
        preserveDrawingBuffer: true,
      });
      const r = new WebGPURenderer({
        canvas,
        context: gl ?? undefined,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
        forceWebGL: true,
      });
      r.setSize(144, 144, false);
      r.outputColorSpace = THREE.SRGBColorSpace;
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.toneMappingExposure = 1.1;
      await r.init();
      thumbEnv = createLightweightThumbEnvTexture();
      thumbRenderer = r;
      return r;
    };
    try {
      return await createWithHardwareWebGL();
    } catch {
      return null;
    }
  })();

  return thumbInitPromise;
}

export async function renderObject3DThumbnail(
  object: THREE.Object3D,
  opts?: { azimuthRad?: number; elevationFactor?: number; zoom?: number }
): Promise<string | undefined> {
  activeThumbRenders++;
  try {
    const wasCold = thumbRenderer === null;
    const renderer = await ensureThumbRenderer();
    if (!renderer) return undefined;
    if (wasCold && typeof requestAnimationFrame === 'function') {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }

    const scene = new THREE.Scene();
    scene.environment = thumbEnv;
    const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 80);

    const hemi = new THREE.HemisphereLight('#DCEBFF', '#3A3E52', 0.95);
    const key = new THREE.DirectionalLight('#FFF5E0', 1.85);
    key.position.set(3.4, 5.2, 4.2);
    const rim = new THREE.DirectionalLight('#7C5CFF', 0.85);
    rim.position.set(-4, 3, -3);
    scene.add(hemi, key, rim);

    scene.add(object);
    object.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(object);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    if (box.isEmpty()) {
      center.set(0, 0.5, 0);
      size.set(1, 1, 1);
    } else {
      box.getCenter(center);
      box.getSize(size);
    }

    const radius = Math.max(0.48, size.length() * 0.54) * (opts?.zoom ?? 1);
    const az = opts?.azimuthRad ?? 0.58;
    const elev = opts?.elevationFactor ?? 0.44;
    const dist = radius * 1.92;
    camera.position.set(
      center.x + Math.sin(az) * dist,
      center.y + radius * elev + size.y * 0.08,
      center.z + Math.cos(az) * dist
    );
    camera.lookAt(center);

    renderer.clear();
    renderer.render(scene, camera);
    const dataUrl = encodeCompressedThumbnail(renderer.domElement);
    scene.remove(object);
    return dataUrl;
  } catch {
    return undefined;
  } finally {
    activeThumbRenders = Math.max(0, activeThumbRenders - 1);
    scheduleThumbRendererCleanup();
  }
}

async function renderThumbnailSnapshot(
  cached: CachedGLTF,
  vertexPaintStrokes?: VertexPaintStroke[]
): Promise<string | undefined> {
  try {
    const previewClone = SkeletonUtils.clone(cached.scene) as THREE.Group;
    if (vertexPaintStrokes && vertexPaintStrokes.length > 0) {
      applyVertexPaintStrokesToObject(previewClone, vertexPaintStrokes);
    }
    previewClone.scale.setScalar(cached.baseScale);
    previewClone.position.y = cached.baseGroundOffset;
    return await renderObject3DThumbnail(previewClone);
  } catch {
    return undefined;
  }
}

export async function regenerateCustomAssetThumbnail(
  assetId: string,
  category: AssetCategory = 'character',
  vertexPaintStrokes?: VertexPaintStroke[]
): Promise<string | undefined> {
  const cached = getCachedAssetSync(assetId) ?? (await loadCustomAssetToCache(assetId, category));
  if (!cached) return undefined;
  return await renderThumbnailSnapshot(cached, vertexPaintStrokes);
}

export async function parseUploadedGlbFile(
  file: File,
  category: AssetCategory
): Promise<{ meta: CustomAssetMeta; buffer: ArrayBuffer }> {
  const buffer = await file.arrayBuffer();
  const gltf = await loader.parseAsync(buffer, '');
  const cached = prepareGLTFScene(gltf, category);
  const clipNames = cached.animations.map((c, idx) => c.name || `Clip ${idx + 1}`);
  const id = uid();
  parsedCache.set(id, cached);

  const cleanName =
    file.name
      .replace(/\.(glb|gltf)$/i, '')
      .replace(/[_-]+/g, ' ')
      .trim() || 'Custom Model';

  const thumbnailDataUrl = await renderThumbnailSnapshot(cached);

  const meta: CustomAssetMeta = {
    id,
    name: cleanName,
    category,
    fileName: file.name,
    byteSize: buffer.byteLength,
    hasSkeleton: cached.hasSkeleton,
    boneNames: cached.skeletonInfo.boneNames,
    animationClips: clipNames,
    clipMap: autoMapAnimationClips(clipNames),
    rigSettings: cached.defaultRigSettings,
    groundOffset: Number(cached.baseGroundOffset.toFixed(3)),
    defaultScale: Number(cached.baseScale.toFixed(3)),
    animSpeed: 1,
    thumbnailDataUrl,
    createdAt: new Date().toISOString(),
  };

  notifyAssetCache();
  return { meta, buffer };
}

export function evictCachedAsset(assetId: string): void {
  parsedCache.delete(assetId);
  pendingLoads.delete(assetId);
  notifyAssetCache();
}

export async function registerGeneratedGlbAsset(opts: {
  existingMeta?: CustomAssetMeta;
  forcedId?: string;
  name: string;
  category: AssetCategory;
  buffer: ArrayBuffer;
  mechanisms?: ObjectMechanism[];
  interactionAttributes?: ObjectInteractionAttributeId[];
  interactionCalibrations?: Partial<
    Record<ObjectInteractionAttributeId, ObjectInteractionCalibration>
  >;
  objectRecipe?: ObjectMakerDoc;
  characterRecipe?: CharacterMakerDoc;
  treeRecipe?: StylizedCanopyConfig;
  buildingBlock?: BuildingBlockConfig;
  vertexPaintStrokes?: VertexPaintStroke[];
  thumbnailOverride?: string;
  keepMetricScale?: boolean;
  attachBodyPart?: ObjectAttachBodyPart | null;
  linkedInventoryItemId?: string | null;
  plantSubKind?: 'plant' | 'flower';
  flowerRecipe?: FlowerMakerRecipe;
}): Promise<{ meta: CustomAssetMeta; buffer: ArrayBuffer }> {
  const gltf = await loader.parseAsync(opts.buffer, '');
  const cached = prepareGLTFScene(gltf, opts.category);
  const clipNames = cached.animations.map((c, idx) => c.name || `Clip ${idx + 1}`);
  const id = opts.forcedId ?? opts.existingMeta?.id ?? uid();
  parsedCache.set(id, cached);

  const cleanName = opts.name.trim() || 'Custom Object';
  const safeFile =
    cleanName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '') || 'custom_object';

  const strokes =
    opts.vertexPaintStrokes && opts.vertexPaintStrokes.length > 0
      ? opts.vertexPaintStrokes
      : undefined;
  const thumbnailDataUrl =
    opts.thumbnailOverride ?? (await renderThumbnailSnapshot(cached, strokes));

  const meta: CustomAssetMeta = {
    ...(opts.existingMeta ?? {}),
    id,
    name: cleanName,
    category: opts.category,
    fileName: `${safeFile}.glb`,
    byteSize: opts.buffer.byteLength,
    hasSkeleton: cached.hasSkeleton,
    boneNames: cached.skeletonInfo.boneNames,
    animationClips: clipNames,
    clipMap: opts.existingMeta?.clipMap ?? autoMapAnimationClips(clipNames),
    rigSettings:
      opts.existingMeta?.rigSettings
        ? {
            ...opts.existingMeta.rigSettings,
            armRelaxAngle:
              !opts.existingMeta.rigSettings.armRelaxAutoVersion &&
              opts.existingMeta.rigSettings.armRelaxAngle === 0 &&
              cached.defaultRigSettings.armRelaxAngle >= 15
                ? cached.defaultRigSettings.armRelaxAngle
                : opts.existingMeta.rigSettings.armRelaxAngle,
            armRelaxAutoVersion: opts.existingMeta.rigSettings.armRelaxAutoVersion ?? 2,
          }
        : cached.defaultRigSettings,
    mechanisms: opts.mechanisms && opts.mechanisms.length > 0 ? opts.mechanisms : undefined,
    interactionAttributes:
      opts.interactionAttributes !== undefined
        ? opts.interactionAttributes
        : opts.existingMeta?.interactionAttributes,
    interactionCalibrations:
      opts.interactionCalibrations !== undefined
        ? opts.interactionCalibrations
        : opts.existingMeta?.interactionCalibrations,
    objectRecipe: opts.objectRecipe,
    characterRecipe: opts.characterRecipe,
    treeRecipe: opts.treeRecipe,
    buildingBlock: opts.buildingBlock,
    vertexPaintStrokes: strokes,
    attachBodyPart:
      opts.attachBodyPart !== undefined
        ? opts.attachBodyPart ?? undefined
        : opts.existingMeta?.attachBodyPart,
    linkedInventoryItemId:
      opts.linkedInventoryItemId !== undefined
        ? opts.linkedInventoryItemId ?? undefined
        : opts.existingMeta?.linkedInventoryItemId,
    favorite: opts.existingMeta?.favorite,
    groundOffset: Number(cached.baseGroundOffset.toFixed(3)),
    defaultScale: opts.keepMetricScale
      ? 1
      : opts.existingMeta?.defaultScale ?? Number(cached.baseScale.toFixed(3)),
    animSpeed: opts.existingMeta?.animSpeed ?? 1,
    thumbnailDataUrl: thumbnailDataUrl ?? opts.existingMeta?.thumbnailDataUrl,
    plantSubKind: opts.plantSubKind ?? opts.existingMeta?.plantSubKind,
    flowerRecipe: opts.flowerRecipe ?? opts.existingMeta?.flowerRecipe,
    createdAt: opts.existingMeta?.createdAt ?? new Date().toISOString(),
  };

  notifyAssetCache();
  return { meta, buffer: opts.buffer };
}

export function getCachedAssetSync(assetId?: string): CachedGLTF | null {
  if (!assetId) return null;
  return parsedCache.get(assetId) ?? null;
}

export function resolveRigSettings(
  cached: CachedGLTF,
  meta?: CustomAssetMeta
): CustomRigSettings {
  const defaults = cached.defaultRigSettings;
  const saved = meta?.rigSettings;
  if (!saved) {
    return {
      ...defaults,
      boneMap: { ...defaults.boneMap },
    };
  }
  const upgradeLegacyArmRelax =
    !saved.armRelaxAutoVersion &&
    saved.armRelaxAngle === 0 &&
    defaults.armRelaxAngle >= 15;
  return {
    mode: saved.mode ?? defaults.mode,
    boneMap:
      saved.boneMap && Object.keys(saved.boneMap).length > 0
        ? { ...saved.boneMap }
        : { ...defaults.boneMap },
    invertedRoles: saved.invertedRoles ? { ...saved.invertedRoles } : undefined,
    limbSwingAxis: saved.limbSwingAxis ?? defaults.limbSwingAxis,
    armRelaxAngle: upgradeLegacyArmRelax
      ? defaults.armRelaxAngle
      : (saved.armRelaxAngle ?? defaults.armRelaxAngle),
    armRelaxAutoVersion: saved.armRelaxAutoVersion ?? defaults.armRelaxAutoVersion ?? 2,
    armSpreadAngle: saved.armSpreadAngle ?? defaults.armSpreadAngle,
    idleArmSpreadAngle: saved.idleArmSpreadAngle ?? defaults.idleArmSpreadAngle,
    mirrorArmRelax: saved.mirrorArmRelax ?? defaults.mirrorArmRelax,
    mirrorLimbSwing: saved.mirrorLimbSwing ?? defaults.mirrorLimbSwing,
    motionStrength: saved.motionStrength ?? defaults.motionStrength,
    headMotion: saved.headMotion ?? defaults.headMotion,
    facingOffsetDeg: saved.facingOffsetDeg ?? defaults.facingOffsetDeg,
    slotTuning: saved.slotTuning ? { ...saved.slotTuning } : undefined,
  };
}

export async function loadCustomAssetToCache(
  assetId: string,
  category: AssetCategory = 'character'
): Promise<CachedGLTF | null> {
  if (parsedCache.has(assetId)) return parsedCache.get(assetId)!;
  if (pendingLoads.has(assetId)) return pendingLoads.get(assetId)!;

  const task = (async () => {
    try {
      const buffer = await getAssetBlob(assetId);
      if (!buffer) return null;
      const gltf = await loader.parseAsync(buffer, '');
      const cached = prepareGLTFScene(gltf, category);
      parsedCache.set(assetId, cached);
      notifyAssetCache();
      return cached;
    } catch {
      return null;
    } finally {
      pendingLoads.delete(assetId);
    }
  })();

  pendingLoads.set(assetId, task);
  return task;
}

export function instantiateCustomModel(
  assetId: string,
  meta: CustomAssetMeta | undefined,
  opts?: { scaleAdjust?: number; offsetY?: number; visualStyle?: VisualStyleId }
): CustomModelInstance | null {
  const cached = parsedCache.get(assetId);
  if (!cached) return null;

  const holder = new THREE.Group();
  const clone = SkeletonUtils.clone(cached.scene) as THREE.Group;

  // Center horizontally around X/Z origin so rotation pivots cleanly
  clone.updateMatrixWorld(true);
  clone.traverse((obj) => {
    const sk = obj as THREE.SkinnedMesh;
    if (sk.isSkinnedMesh && sk.skeleton) {
      sk.skeleton.update();
    }
  });
  const rawBox = new THREE.Box3().setFromObject(clone);
  const rawCenter = new THREE.Vector3();
  rawBox.getCenter(rawCenter);
  clone.position.x -= rawCenter.x;
  clone.position.z -= rawCenter.z;

  const scale = (meta?.defaultScale ?? cached.baseScale) * (opts?.scaleAdjust ?? 1);
  const baseNormalizedY = (cached.baseGroundOffset / Math.max(0.0001, cached.baseScale)) * scale;
  const userGroundDelta = meta ? meta.groundOffset - cached.baseGroundOffset : 0;

  const rigSettings = resolveRigSettings(cached, meta);

  const scaledRoot = new THREE.Group();
  scaledRoot.scale.setScalar(scale);
  scaledRoot.position.y = baseNormalizedY + userGroundDelta + (opts?.offsetY ?? 0);
  scaledRoot.rotation.y = THREE.MathUtils.degToRad(rigSettings.facingOffsetDeg);
  scaledRoot.add(clone);
  holder.add(scaledRoot);

  // Subtle grounded contact shadow disc
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 20),
    new THREE.MeshBasicMaterial({
      color: '#000000',
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  holder.add(shadow);

  if (opts?.visualStyle) {
    applyVisualStyleToObject(clone, opts.visualStyle);
  }

  // Capture procedural rig controller BEFORE any animation mixer mutates bind-pose bone rotations
  const proceduralRig =
    cached.skeletonInfo.boneNames.length > 0
      ? new ProceduralRigController(
          holder,
          clone,
          rigSettings,
          meta?.customAnimations,
          meta?.defaultSlotPresets
        )
      : null;

  const knownLayerCap = getKnownWebGPUMaxTextureArrayLayers();
  let animationsForInstance = cached.animations;
  if (knownLayerCap !== null && knownLayerCap > 0) {
    let needsMorphCap = false;
    clone.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (!m.isMesh || !m.geometry) return;
      const ma = m.geometry.morphAttributes;
      const len = ma?.position?.length ?? ma?.normal?.length ?? ma?.color?.length ?? 0;
      if (len > knownLayerCap) needsMorphCap = true;
    });
    if (needsMorphCap) {
      animationsForInstance = cached.animations.map((c) => c.clone());
      sanitizeObjectMorphTargets(clone, {
        animations: animationsForInstance,
        maxLayers: knownLayerCap,
        cloneSharedGeometries: true,
      });
    }
  }

  let mixer: THREE.AnimationMixer | null = null;
  const clips: Partial<Record<CustomClipSlot, THREE.AnimationAction>> = {};
  const clipHasMotion: Partial<Record<CustomClipSlot, boolean>> = {};
  let fallbackAction: THREE.AnimationAction | null = null;
  let fallbackHasMotion = false;

  if (animationsForInstance.length > 0) {
    mixer = new THREE.AnimationMixer(clone);
    const clipByName = new Map<string, { clip: THREE.AnimationClip; hasMotion: boolean }>();
    animationsForInstance.forEach((c, idx) => {
      const key = c.name || `Clip ${idx + 1}`;
      const diag = cached.clipDiagnostics[idx];
      clipByName.set(key, { clip: c, hasMotion: diag?.hasMotion ?? true });
    });

    const effectiveClipMap = meta?.clipMap ?? autoMapAnimationClips(Array.from(clipByName.keys()));
    const slots: CustomClipSlot[] = [
      'idle',
      'walk',
      'run',
      'jump',
      'swim',
      'attack',
      'interact',
      'sit',
      'hold',
      'swing',
      'throw',
      'sleep',
      'fishing',
      'lift',
      'pull',
      'push',
      'dig',
      'climbVertical',
      'climbStairs',
      'crouch',
      'sneak',
      'stab',
      'bowPull',
      'hug',
      'punch',
      'kick',
    ];
    for (const slot of slots) {
      const targetName = effectiveClipMap[slot];
      const entry = targetName ? clipByName.get(targetName) : undefined;
      if (entry) {
        const act = mixer.clipAction(entry.clip);
        if (slot === 'jump' || slot === 'attack' || slot === 'swing' || slot === 'throw' || slot === 'punch' || slot === 'kick' || slot === 'stab') {
          act.setLoop(THREE.LoopOnce, 1);
          act.clampWhenFinished = true;
        }
        clips[slot] = act;
        clipHasMotion[slot] = entry.hasMotion;
      }
    }

    fallbackAction = mixer.clipAction(animationsForInstance[0]);
    fallbackHasMotion = cached.clipDiagnostics[0]?.hasMotion ?? true;
  }

  let activeTestOverride: RigTestOverride = null;
  let activeClipAction: THREE.AnimationAction | null = null;
  let baseAnimSpeed = meta?.animSpeed ?? 1;

  const hasExplicitClipMap = Boolean(meta && meta.clipMap !== undefined);

  const resolveClipActionForSlot = (
    slot: CustomClipSlot
  ): { action: THREE.AnimationAction; hasMotion: boolean } | null => {
    if (clips[slot]) {
      return { action: clips[slot]!, hasMotion: Boolean(clipHasMotion[slot]) };
    }
    if ((slot === 'run' || slot === 'swim') && clips.walk) {
      return { action: clips.walk, hasMotion: Boolean(clipHasMotion.walk) };
    }
    // Never force a walk/fallback clip onto idle if the user intentionally cleared idle
    if (slot === 'idle' && hasExplicitClipMap) {
      return null;
    }
    // Only fall back to idle/first clip when procedural rig isn't available or mode is strictly 'clips'
    if (instance.rigSettings.mode === 'clips' || !proceduralRig?.hasMappedBones()) {
      if (clips.idle) return { action: clips.idle, hasMotion: Boolean(clipHasMotion.idle) };
      if (!hasExplicitClipMap && fallbackAction) {
        return { action: fallbackAction, hasMotion: fallbackHasMotion };
      }
    }
    return null;
  };

  const hasCustomDefaultForSlot = (slot: CustomClipSlot): boolean => {
    if (instance.rigSettings.mode === 'clips') return false;
    return Boolean(proceduralRig?.getDefaultPresetForSlot(slot));
  };

  const shouldUseClip = (slot: CustomClipSlot): boolean => {
    if (activeTestOverride) return false;
    if (hasCustomDefaultForSlot(slot)) return false;
    if (!mixer) return false;
    if (instance.rigSettings.mode === 'procedural') return false;
    const candidate = resolveClipActionForSlot(slot);
    if (!candidate) return false;
    if (instance.rigSettings.mode === 'clips') return true;
    // 'auto' mode: use embedded clip only if it is mapped and actually animates!
    if (candidate.hasMotion) return true;
    return !proceduralRig?.hasMappedBones();
  };

  const getSlotRelativeTimeScale = (slot: CustomClipSlot): number => {
    // If run is reusing the walk clip, gently boost cadence without hyper-speed glitching
    if (slot === 'run' && !clips.run && clips.walk) return 1.24;
    if (slot === 'swim' && !clips.swim && clips.walk) return 0.9;
    return 1.0;
  };

  const playClipForSlot = (slot: CustomClipSlot, fadeSec: number) => {
    const candidate = resolveClipActionForSlot(slot);
    if (!candidate || !mixer) return;
    const target = candidate.action;
    const relScale = getSlotRelativeTimeScale(slot);

    if (activeClipAction === target && target.isRunning()) {
      // Same underlying clip (e.g. walk <-> run sharing walk clip): adjust pace smoothly without resetting frame 0!
      target.setEffectiveTimeScale(relScale);
      target.setEffectiveWeight(1);
      return;
    }

    if (activeClipAction && activeClipAction !== target) {
      target.enabled = true;
      target.reset().setEffectiveTimeScale(relScale).setEffectiveWeight(1).play();
      // warp = false prevents erratic speed spikes during walk <-> run transitions!
      activeClipAction.crossFadeTo(target, fadeSec, false);
    } else if (!target.isRunning()) {
      target.enabled = true;
      target.reset().setEffectiveTimeScale(relScale).setEffectiveWeight(1).play();
    } else {
      target.setEffectiveTimeScale(relScale);
    }
    activeClipAction = target;
  };

  const instance: CustomModelInstance = {
    group: holder,
    modelRoot: clone,
    scaledRoot,
    mixer,
    proceduralRig,
    rigSettings,
    clips,
    clipHasMotion,
    fallbackAction,
    currentSlot: 'idle',
    activeDriver: 'none',
    setAction(slot: CustomClipSlot, fadeSec = 0.16) {
      const prevSlot = instance.currentSlot;
      instance.currentSlot = slot;

      if (shouldUseClip(slot)) {
        if (instance.activeDriver !== 'clip' || prevSlot !== slot || !activeClipAction?.isRunning()) {
          if (instance.activeDriver === 'procedural' || instance.activeDriver === 'custom') {
            proceduralRig?.resetToRestPose();
          }
          playClipForSlot(slot, fadeSec);
        }
        instance.activeDriver = 'clip';
      } else if (
        proceduralRig &&
        (hasCustomDefaultForSlot(slot) || proceduralRig.hasMappedBones() || activeTestOverride)
      ) {
        if (instance.activeDriver === 'clip' && mixer) {
          mixer.stopAllAction();
          activeClipAction = null;
          proceduralRig.resetToRestPose();
        }
        instance.activeDriver =
          !activeTestOverride && hasCustomDefaultForSlot(slot) ? 'custom' : 'procedural';
      } else {
        if (instance.activeDriver === 'clip' && mixer) {
          mixer.stopAllAction();
          activeClipAction = null;
          proceduralRig?.resetToRestPose();
        }
        instance.activeDriver = 'none';
      }
    },
    update(dt: number, speedMultiplier = 1) {
      const spd = baseAnimSpeed * speedMultiplier;
      if (activeTestOverride && proceduralRig) {
        if (instance.activeDriver === 'clip' && mixer) {
          mixer.stopAllAction();
          activeClipAction = null;
        }
        instance.activeDriver =
          activeTestOverride.kind === 'presetPreview' || activeTestOverride.kind === 'poseSnapshot'
            ? 'custom'
            : 'procedural';
        proceduralRig.update(dt, instance.currentSlot, spd);
        return;
      }

      if (shouldUseClip(instance.currentSlot)) {
        if (instance.activeDriver !== 'clip') {
          proceduralRig?.resetToRestPose();
          playClipForSlot(instance.currentSlot, 0.14);
          instance.activeDriver = 'clip';
        }
        const safeStep = Math.min(0.05, Math.max(0, dt)) * THREE.MathUtils.clamp(spd, 0.15, 2.2);
        mixer?.update(safeStep);
        proceduralRig?.applyPostClipAdjustments(instance.currentSlot);
      } else if (
        proceduralRig &&
        (hasCustomDefaultForSlot(instance.currentSlot) ||
          (instance.rigSettings.mode !== 'clips' && proceduralRig.hasMappedBones()))
      ) {
        if (instance.activeDriver === 'clip' && mixer) {
          mixer.stopAllAction();
          activeClipAction = null;
          proceduralRig.resetToRestPose();
        }
        instance.activeDriver = hasCustomDefaultForSlot(instance.currentSlot)
          ? 'custom'
          : 'procedural';
        proceduralRig.update(dt, instance.currentSlot, spd);
      } else {
        if (instance.activeDriver === 'clip' && mixer) {
          mixer.stopAllAction();
          activeClipAction = null;
          proceduralRig?.resetToRestPose();
        }
        if (
          instance.rigSettings.mode !== 'procedural' &&
          !hasExplicitClipMap &&
          mixer &&
          fallbackAction
        ) {
          if (!fallbackAction.isRunning()) {
            fallbackAction.reset().setEffectiveTimeScale(1).play();
          }
          const safeStep = Math.min(0.05, Math.max(0, dt)) * THREE.MathUtils.clamp(spd, 0.15, 2.2);
          mixer.update(safeStep);
          proceduralRig?.applyPostClipAdjustments(instance.currentSlot);
          instance.activeDriver = 'clip';
        } else {
          instance.activeDriver = 'none';
        }
      }
    },
    applyRigSettings(next: CustomRigSettings) {
      const facingChanged = next.facingOffsetDeg !== instance.rigSettings.facingOffsetDeg;
      instance.rigSettings = {
        ...next,
        boneMap: { ...next.boneMap },
        invertedRoles: next.invertedRoles ? { ...next.invertedRoles } : undefined,
        slotTuning: next.slotTuning ? { ...next.slotTuning } : undefined,
      };
      if (facingChanged) {
        scaledRoot.rotation.y = THREE.MathUtils.degToRad(next.facingOffsetDeg);
        proceduralRig?.recaptureAfterFacingChange();
      }
      proceduralRig?.updateSettings(instance.rigSettings);
      instance.setAction(instance.currentSlot, 0.1);
    },
    setCustomAnimations(presets, defaults) {
      proceduralRig?.setCustomAnimations(presets, defaults);
      instance.setAction(instance.currentSlot, 0.08);
    },
    setTestOverride(override: RigTestOverride) {
      activeTestOverride = override;
      if (override && mixer) {
        mixer.stopAllAction();
        activeClipAction = null;
      }
      proceduralRig?.setTestOverride(override);
      if (!override) {
        instance.setAction(instance.currentSlot, 0.1);
      }
    },
    setAnimSpeed(speed: number) {
      baseAnimSpeed = Math.max(0.1, speed);
    },
  };

  instance.setAction('idle', 0);
  return instance;
}

import { applyBotwStyleToObject } from './botwStyleUtils';

export function applyVisualStyleToObject(root: THREE.Object3D, visualStyle: VisualStyleId) {
  applyBotwStyleToObject(root, visualStyle);
}
