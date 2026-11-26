import * as THREE from 'three';
import type { SceneryTextureSlot, SurfaceTextureSettings } from '../types/maker';
import { getTextureBlobRecord } from '../utils/textureVault';

export interface SceneryTextureSlotInfo {
  id: SceneryTextureSlot;
  label: string;
  category: 'Trees & Flora' | 'Ground & Paths' | 'Stone & Structures';
  description: string;
  defaultRepeat: number;
  defaultRoughness: number;
  defaultBump: number;
  defaultTint: number;
}

export const SCENERY_TEXTURE_SLOTS: SceneryTextureSlotInfo[] = [
  {
    id: 'treeCanopy',
    label: 'Tree Canopy',
    category: 'Trees & Flora',
    description: 'Oak, fantasy & custom canopy spheres plus island tree foliage',
    defaultRepeat: 1.5,
    defaultRoughness: 0.78,
    defaultBump: 0.45,
    defaultTint: 0.25,
  },
  {
    id: 'treeBark',
    label: 'Tree Trunk & Bark',
    category: 'Trees & Flora',
    description: 'Trunks, major branches, roots & island timber bark',
    defaultRepeat: 1.0,
    defaultRoughness: 0.88,
    defaultBump: 0.55,
    defaultTint: 0.0,
  },
  {
    id: 'fruit',
    label: 'Fruit & Berries',
    category: 'Trees & Flora',
    description: 'Canopy tree fruit & wild woodland shrub berries',
    defaultRepeat: 1.0,
    defaultRoughness: 0.34,
    defaultBump: 0.25,
    defaultTint: 0.15,
  },
  {
    id: 'bushes',
    label: 'Bushes & Shrubs',
    category: 'Trees & Flora',
    description: 'Woodland bushes, berry shrub leaves, ferns & ground foliage',
    defaultRepeat: 1.4,
    defaultRoughness: 0.8,
    defaultBump: 0.4,
    defaultTint: 0.25,
  },
  {
    id: 'grass',
    label: 'Grass & Meadow',
    category: 'Ground & Paths',
    description: 'Terrain meadow grass surface & swaying tall grass tufts',
    defaultRepeat: 1.0,
    defaultRoughness: 0.84,
    defaultBump: 0.35,
    defaultTint: 0.22,
  },
  {
    id: 'flowerPetals',
    label: 'Flower Petals',
    category: 'Trees & Flora',
    description: 'Wildflower blossoms across meadows and cliff ledges',
    defaultRepeat: 1.0,
    defaultRoughness: 0.52,
    defaultBump: 0.25,
    defaultTint: 0.35,
  },
  {
    id: 'flowerStems',
    label: 'Flower Stems & Leaves',
    category: 'Trees & Flora',
    description: 'Wildflower stalks, base leaves & riverside reeds',
    defaultRepeat: 1.0,
    defaultRoughness: 0.74,
    defaultBump: 0.25,
    defaultTint: 0.2,
  },
  {
    id: 'pathRoad',
    label: 'Path & Road',
    category: 'Ground & Paths',
    description: 'Painted dirt trails and cobblestone roads across the terrain',
    defaultRepeat: 1.2,
    defaultRoughness: 0.88,
    defaultBump: 0.5,
    defaultTint: 0.0,
  },
  {
    id: 'rocks',
    label: 'Rocks & Boulders',
    category: 'Stone & Structures',
    description: 'Chiseled boulders, cliff rocks & terrain rock cliffs',
    defaultRepeat: 1.2,
    defaultRoughness: 0.88,
    defaultBump: 0.6,
    defaultTint: 0.12,
  },
  {
    id: 'cave',
    label: 'Cave & Grottos',
    category: 'Stone & Structures',
    description: 'Mountain cave interior walls, arches, stalactites & grottos',
    defaultRepeat: 1.2,
    defaultRoughness: 0.92,
    defaultBump: 0.65,
    defaultTint: 0.1,
  },
  {
    id: 'woodStructures',
    label: 'Wood & Bridges',
    category: 'Stone & Structures',
    description: 'River footbridge planks, railings, pilings & timber bridges',
    defaultRepeat: 1.0,
    defaultRoughness: 0.84,
    defaultBump: 0.55,
    defaultTint: 0.0,
  },
];

export function createDefaultSurfaceTextureSettings(
  slot?: SceneryTextureSlot,
  textureId?: string
): SurfaceTextureSettings {
  const info = slot ? SCENERY_TEXTURE_SLOTS.find((s) => s.id === slot) : undefined;
  const isMatteSlot =
    slot === 'rocks' ||
    slot === 'cave' ||
    slot === 'treeBark' ||
    slot === 'pathRoad' ||
    slot === 'woodStructures' ||
    slot === 'grass';
  return {
    textureId,
    enabled: Boolean(textureId),
    repeatX: info?.defaultRepeat ?? 1.0,
    repeatY: info?.defaultRepeat ?? 1.0,
    lockScale: true,
    offsetX: 0,
    offsetY: 0,
    rotationDeg: 0,
    flipX: false,
    flipY: false,
    bumpStrength: info?.defaultBump ?? 0.45,
    hueShift: 0,
    saturation: 0,
    value: 0,
    contrast: 1.0,
    roughness: info?.defaultRoughness ?? 0.82,
    diffuseRoughness: isMatteSlot ? 0.88 : 0.45,
    weathering: 'none',
    weatheringIntensity: 0.65,
    tintStrength: info?.defaultTint ?? 0.15,
  };
}

export interface ProcessedSurfaceTextures {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  albedoCanvas: HTMLCanvasElement;
  settings: SurfaceTextureSettings;
}

interface ProcessedCanvasPair {
  albedoCanvas: HTMLCanvasElement;
  normalCanvas: HTMLCanvasElement;
}

const rawCanvasCache = new Map<string, HTMLCanvasElement>();
const inflightLoads = new Map<string, Promise<HTMLCanvasElement | null>>();
const processedCanvasCache = new Map<string, ProcessedCanvasPair>();
const uvTextureCache = new Map<string, ProcessedSurfaceTextures>();
const listeners = new Set<() => void>();
const invalidationListeners = new Set<() => void>();

const MAX_RAW_CACHE = 24;
const MAX_PIXEL_CACHE = 20;
const MAX_UV_CACHE = 32;
const MAX_RUNTIME_TEXTURE_DIM = 512;
const MAX_NORMAL_MAP_DIM = 256;

function clampTextureCanvas(src: CanvasImageSource, origW: number, origH: number, maxDim: number): HTMLCanvasElement {
  const w0 = Math.max(1, origW);
  const h0 = Math.max(1, origH);
  const scale = w0 > maxDim || h0 > maxDim ? Math.min(maxDim / w0, maxDim / h0) : 1;
  const w = Math.max(1, Math.round(w0 * scale));
  const h = Math.max(1, Math.round(h0 * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, w, h);
  return canvas;
}

function setRawCacheEntry(textureId: string, canvas: HTMLCanvasElement): void {
  if (rawCanvasCache.has(textureId)) {
    rawCanvasCache.delete(textureId);
  } else if (rawCanvasCache.size >= MAX_RAW_CACHE) {
    const oldest = rawCanvasCache.keys().next().value;
    if (oldest) rawCanvasCache.delete(oldest);
  }
  rawCanvasCache.set(textureId, canvas);
}

function notifyTextureListeners(): void {
  listeners.forEach((cb) => {
    try {
      cb();
    } catch {
      // ignore subscriber errors
    }
  });
}

function notifyTextureInvalidations(): void {
  invalidationListeners.forEach((cb) => {
    try {
      cb();
    } catch {
      // ignore subscriber errors
    }
  });
}

export function subscribeCustomTextureCache(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Fires only when a cached texture is explicitly edited, replaced, or deleted in Texture Studio,
 * preventing redundant viewport rebuilds during initial async IndexedDB preloading.
 */
export function subscribeCustomTextureInvalidation(listener: () => void): () => void {
  invalidationListeners.add(listener);
  return () => invalidationListeners.delete(listener);
}

/**
 * Evicts any derived processed canvases & GPU textures for a textureId (e.g. after resize or delete).
 */
export function invalidateCustomTextureCache(textureId: string): void {
  for (const [k, v] of uvTextureCache.entries()) {
    if (k.startsWith(`${textureId}|`)) {
      v.map.dispose();
      v.normalMap.dispose();
      uvTextureCache.delete(k);
    }
  }
  for (const k of processedCanvasCache.keys()) {
    if (k.startsWith(`${textureId}|`)) {
      processedCanvasCache.delete(k);
    }
  }
  notifyTextureListeners();
  notifyTextureInvalidations();
}

/**
 * Synchronously registers a newly uploaded or resized canvas into the runtime cache
 * so 3D previews and the world viewport show it instantaneously.
 */
export function primeCustomTextureCanvas(textureId: string, canvas: HTMLCanvasElement): void {
  const clamped =
    canvas.width > MAX_RUNTIME_TEXTURE_DIM || canvas.height > MAX_RUNTIME_TEXTURE_DIM
      ? clampTextureCanvas(canvas, canvas.width, canvas.height, MAX_RUNTIME_TEXTURE_DIM)
      : canvas;
  setRawCacheEntry(textureId, clamped);
  invalidateCustomTextureCache(textureId);
}

/**
 * Removes a deleted texture from memory & disposes any GPU resources referencing it.
 */
export function evictCustomTexture(textureId: string): void {
  rawCanvasCache.delete(textureId);
  invalidateCustomTextureCache(textureId);
}

/**
 * Loads a custom texture from IndexedDB into the synchronous in-memory canvas cache.
 */
export function loadCustomTextureToCache(textureId: string): Promise<HTMLCanvasElement | null> {
  const existing = rawCanvasCache.get(textureId);
  if (existing) return Promise.resolve(existing);

  const pending = inflightLoads.get(textureId);
  if (pending) return pending;

  const job = (async () => {
    try {
      const rec = await getTextureBlobRecord(textureId);
      if (!rec) return null;
      const blob = new Blob([rec.buffer], { type: rec.mimeType });
      const url = URL.createObjectURL(blob);
      try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = () => reject(new Error('Failed to decode cached texture'));
          el.src = url;
        });
        const origW = img.naturalWidth || img.width;
        const origH = img.naturalHeight || img.height;
        const canvas = clampTextureCanvas(img, origW, origH, MAX_RUNTIME_TEXTURE_DIM);
        setRawCacheEntry(textureId, canvas);
        notifyTextureListeners();
        return canvas;
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch {
      return null;
    } finally {
      inflightLoads.delete(textureId);
    }
  })();

  inflightLoads.set(textureId, job);
  return job;
}

export function getRawCustomTextureSync(textureId?: string): HTMLCanvasElement | null {
  if (!textureId) return null;
  const cached = rawCanvasCache.get(textureId);
  if (cached) return cached;
  void loadCustomTextureToCache(textureId);
  return null;
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 1e-6) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  const s = max > 1e-6 ? d / max : 0;
  return [h, s, max];
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0:
      return [v, t, p];
    case 1:
      return [q, v, p];
    case 2:
      return [p, v, t];
    case 3:
      return [p, q, v];
    case 4:
      return [t, p, v];
    default:
      return [v, p, q];
  }
}

/**
 * Generates seamless processed albedo canvas (Flip H/V, Hue, Saturation, Value, Contrast)
 * and a matching 3x3 Sobel tangent-space Normal Map canvas (wrapping seamlessly at all edges!).
 */
function buildProcessedCanvases(
  srcCanvas: HTMLCanvasElement,
  settings: SurfaceTextureSettings
): ProcessedCanvasPair {
  const w = srcCanvas.width;
  const h = srcCanvas.height;

  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = w;
  albedoCanvas.height = h;
  const aCtx = albedoCanvas.getContext('2d')!;

  // 1. Apply Flip Horizontal / Flip Vertical cleanly on canvas
  aCtx.save();
  aCtx.translate(settings.flipX ? w : 0, settings.flipY ? h : 0);
  aCtx.scale(settings.flipX ? -1 : 1, settings.flipY ? -1 : 1);
  aCtx.drawImage(srcCanvas, 0, 0, w, h);
  aCtx.restore();

  const imgData = aCtx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const hueDelta = ((settings.hueShift ?? 0) % 360) / 360;
  const satDelta = settings.saturation ?? 0;
  const valDelta = settings.value ?? 0;
  const contrast = settings.contrast ?? 1.0;
  const needsColorAdjust =
    Math.abs(hueDelta) > 0.001 ||
    Math.abs(satDelta) > 0.002 ||
    Math.abs(valDelta) > 0.002 ||
    Math.abs(contrast - 1.0) > 0.005;

  const heights = new Float32Array(w * h);

  for (let p = 0; p < w * h; p++) {
    const idx = p * 4;
    let r = data[idx] / 255;
    let g = data[idx + 1] / 255;
    let b = data[idx + 2] / 255;

    if (needsColorAdjust) {
      let [hh, ss, vv] = rgbToHsv(r, g, b);
      hh = (((hh + hueDelta) % 1) + 1) % 1;
      ss = Math.max(0, Math.min(1, ss + satDelta));
      vv = Math.max(0, Math.min(1, vv * (1 + valDelta) + valDelta * 0.25));
      [r, g, b] = hsvToRgb(hh, ss, vv);

      if (Math.abs(contrast - 1.0) > 0.005) {
        r = Math.max(0, Math.min(1, (r - 0.5) * contrast + 0.5));
        g = Math.max(0, Math.min(1, (g - 0.5) * contrast + 0.5));
        b = Math.max(0, Math.min(1, (b - 0.5) * contrast + 0.5));
      }

      data[idx] = Math.round(r * 255);
      data[idx + 1] = Math.round(g * 255);
      data[idx + 2] = Math.round(b * 255);
    }

    heights[p] = r * 0.299 + g * 0.587 + b * 0.114;
  }

  if (needsColorAdjust) {
    aCtx.putImageData(imgData, 0, 0);
  }

  // 2. Seamless wrapped 3x3 Sobel tangent-space Normal Map at half resolution (<= 256px) for 4x lower VRAM
  const nScale =
    w > MAX_NORMAL_MAP_DIM || h > MAX_NORMAL_MAP_DIM
      ? Math.min(0.5, MAX_NORMAL_MAP_DIM / Math.max(w, h))
      : w >= 128 && h >= 128
      ? 0.5
      : 1;
  const nw = Math.max(16, Math.round(w * nScale));
  const nh = Math.max(16, Math.round(h * nScale));
  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = nw;
  normalCanvas.height = nh;
  const nCtx = normalCanvas.getContext('2d')!;
  const nOut = nCtx.createImageData(nw, nh);
  const nd = nOut.data;

  const sampleH = (nxCoord: number, nyCoord: number): number => {
    const sx = Math.floor((nxCoord / nw) * w);
    const sy = Math.floor((nyCoord / nh) * h);
    const wx = ((sx % w) + w) % w;
    const wy = ((sy % h) + h) % h;
    return heights[wy * w + wx];
  };

  const strength = 3.2;
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const tl = sampleH(x - 1, y - 1);
      const t = sampleH(x, y - 1);
      const tr = sampleH(x + 1, y - 1);
      const l = sampleH(x - 1, y);
      const r = sampleH(x + 1, y);
      const bl = sampleH(x - 1, y + 1);
      const b = sampleH(x, y + 1);
      const br = sampleH(x + 1, y + 1);

      const dX = (tr + 2 * r + br - (tl + 2 * l + bl)) * strength;
      const dY = (bl + 2 * b + br - (tl + 2 * t + tr)) * strength;
      const nx = -dX;
      const ny = dY;
      const nz = 1.0;
      const invLen = 1 / Math.hypot(nx, ny, nz);

      const idx = (y * nw + x) * 4;
      nd[idx] = Math.round((nx * invLen * 0.5 + 0.5) * 255);
      nd[idx + 1] = Math.round((ny * invLen * 0.5 + 0.5) * 255);
      nd[idx + 2] = Math.round((nz * invLen * 0.5 + 0.5) * 255);
      nd[idx + 3] = 255;
    }
  }
  nCtx.putImageData(nOut, 0, 0);

  return { albedoCanvas, normalCanvas };
}

/**
 * Returns GPU-ready seamless RepeatWrapping albedo + normalMap textures for a SurfaceTextureSettings.
 * Returns null if disabled, unset, or still loading asynchronously (auto-triggers load & notifies subscribers).
 */
export function getProcessedSurfaceTextures(
  settings: SurfaceTextureSettings | undefined
): ProcessedSurfaceTextures | null {
  if (!settings || !settings.enabled || !settings.textureId) return null;

  const srcCanvas = getRawCustomTextureSync(settings.textureId);
  if (!srcCanvas) return null;

  const pixelKey = [
    settings.textureId,
    settings.flipX ? 1 : 0,
    settings.flipY ? 1 : 0,
    Math.round(settings.hueShift ?? 0),
    Math.round((settings.saturation ?? 0) * 100),
    Math.round((settings.value ?? 0) * 100),
    Math.round((settings.contrast ?? 1) * 100),
  ].join('|');

  let canvases = processedCanvasCache.get(pixelKey);
  if (!canvases) {
    canvases = buildProcessedCanvases(srcCanvas, settings);
    if (processedCanvasCache.size >= MAX_PIXEL_CACHE) {
      const oldest = processedCanvasCache.keys().next().value;
      if (oldest) processedCanvasCache.delete(oldest);
    }
    processedCanvasCache.set(pixelKey, canvases);
  }

  const repX = Math.max(0.05, Number((settings.repeatX ?? 1).toFixed(3)));
  const repY = Math.max(0.05, Number((settings.repeatY ?? 1).toFixed(3)));
  const offX = Number((settings.offsetX ?? 0).toFixed(3));
  const offY = Number((settings.offsetY ?? 0).toFixed(3));
  const rotDeg = Math.round(settings.rotationDeg ?? 0);

  const uvKey = `${pixelKey}|${repX}|${repY}|${offX}|${offY}|${rotDeg}`;
  const cachedUv = uvTextureCache.get(uvKey);
  if (cachedUv) {
    return { ...cachedUv, settings };
  }

  const configureTex = (tex: THREE.CanvasTexture, isColor: boolean) => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.center.set(0.5, 0.5);
    tex.repeat.set(repX, repY);
    tex.offset.set(offX, offY);
    tex.rotation = THREE.MathUtils.degToRad(rotDeg);
    tex.anisotropy = 4;
    tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.needsUpdate = true;
  };

  const map = new THREE.CanvasTexture(canvases.albedoCanvas);
  configureTex(map, true);

  const normalMap = new THREE.CanvasTexture(canvases.normalCanvas);
  configureTex(normalMap, false);

  const bundle: ProcessedSurfaceTextures = {
    map,
    normalMap,
    albedoCanvas: canvases.albedoCanvas,
    settings,
  };

  if (uvTextureCache.size >= MAX_UV_CACHE) {
    const oldestKey = uvTextureCache.keys().next().value;
    if (oldestKey) {
      const old = uvTextureCache.get(oldestKey);
      old?.map.dispose();
      old?.normalMap.dispose();
      uvTextureCache.delete(oldestKey);
    }
  }
  uvTextureCache.set(uvKey, bundle);
  return bundle;
}

/**
 * Applies a custom SurfaceTextureSettings directly onto a MeshStandardMaterial or MeshToonMaterial.
 * Returns true if the custom texture was active and applied.
 */
export function applySurfaceTextureToMaterial(
  mat: THREE.MeshStandardMaterial | THREE.MeshToonMaterial,
  settings: SurfaceTextureSettings | undefined,
  opts?: {
    baseTintHex?: string;
    isToon?: boolean;
    preserveFlatShading?: boolean;
  }
): boolean {
  const proc = getProcessedSurfaceTextures(settings);
  if (!proc || !settings) return false;

  const bump = THREE.MathUtils.clamp(settings.bumpStrength ?? 0.45, 0, 1);
  const tintStrength = THREE.MathUtils.clamp(settings.tintStrength ?? 0.15, 0, 1);

  mat.map = proc.map;
  mat.bumpMap = null;
  if (bump > 0.01) {
    const nScale = bump * (opts?.isToon ? 1.9 : 2.35);
    mat.normalMap = proc.normalMap;
    mat.normalScale = new THREE.Vector2(nScale, nScale);
  } else {
    mat.normalMap = null;
    mat.normalScale = new THREE.Vector2(0, 0);
  }

  if (opts?.baseTintHex) {
    const pureWhite = new THREE.Color('#FFFFFF');
    const baseTint = new THREE.Color(opts.baseTintHex);
    mat.color.copy(pureWhite).lerp(baseTint, tintStrength);
  } else {
    mat.color.set('#FFFFFF');
  }

  if ('roughness' in mat && typeof settings.roughness === 'number') {
    mat.roughness = THREE.MathUtils.clamp(settings.roughness, 0.05, 1.0);
  }
  const matEon = mat as unknown as { diffuseRoughness?: number };
  if (typeof settings.diffuseRoughness === 'number') {
    matEon.diffuseRoughness = THREE.MathUtils.clamp(settings.diffuseRoughness, 0, 1);
  }
  if ('flatShading' in mat && !opts?.preserveFlatShading) {
    mat.flatShading = false;
  }

  mat.needsUpdate = true;
  return true;
}

/**
 * Projects clean, distortion-free seamless box-mapped UVs onto faceted procedural geometry
 * (like boulders and cave dodecahedrons) so custom seamless textures wrap cleanly without pinching!
 */
export function applySeamlessBoxUVs(
  geometry: THREE.BufferGeometry,
  uvScale = 0.65
): THREE.BufferGeometry {
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  if (!pos) return geometry;

  const count = pos.count;
  const uvs = new Float32Array(count * 2);
  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const cb = new THREE.Vector3();
  const ab = new THREE.Vector3();

  const index = geometry.index;
  if (index) {
    // Indexed geometry: project per vertex using vertex normal
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    const norm = geometry.attributes.normal as THREE.BufferAttribute;
    for (let i = 0; i < count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const ax = Math.abs(norm.getX(i));
      const ay = Math.abs(norm.getY(i));
      const az = Math.abs(norm.getZ(i));
      if (ay >= ax && ay >= az) {
        uvs[i * 2] = x * uvScale;
        uvs[i * 2 + 1] = z * uvScale;
      } else if (ax >= ay && ax >= az) {
        uvs[i * 2] = z * uvScale;
        uvs[i * 2 + 1] = y * uvScale;
      } else {
        uvs[i * 2] = x * uvScale;
        uvs[i * 2 + 1] = y * uvScale;
      }
    }
  } else {
    // Non-indexed faceted geometry (DodecahedronGeometry): consistent face-normal planar projection!
    for (let i = 0; i + 2 < count; i += 3) {
      vA.fromBufferAttribute(pos, i);
      vB.fromBufferAttribute(pos, i + 1);
      vC.fromBufferAttribute(pos, i + 2);
      cb.subVectors(vC, vB);
      ab.subVectors(vA, vB);
      cb.cross(ab).normalize();

      const ax = Math.abs(cb.x);
      const ay = Math.abs(cb.y);
      const az = Math.abs(cb.z);

      for (let k = 0; k < 3; k++) {
        const idx = i + k;
        const x = pos.getX(idx);
        const y = pos.getY(idx);
        const z = pos.getZ(idx);
        if (ay >= ax && ay >= az) {
          uvs[idx * 2] = x * uvScale;
          uvs[idx * 2 + 1] = z * uvScale;
        } else if (ax >= ay && ax >= az) {
          uvs[idx * 2] = z * uvScale;
          uvs[idx * 2 + 1] = y * uvScale;
        } else {
          uvs[idx * 2] = x * uvScale;
          uvs[idx * 2 + 1] = y * uvScale;
        }
      }
    }
  }

  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  return geometry;
}

/**
 * Scales BoxGeometry UVs proportionally to physical box dimensions so seamless wood plank
 * textures tile uniformly on wide decks, slender railings, and square bridge posts!
 */
export function applyWorldScaledBoxUVs(
  geo: THREE.BoxGeometry,
  width: number,
  height: number,
  depth: number,
  texelsPerUnit = 0.42
): THREE.BoxGeometry {
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const norm = geo.attributes.normal as THREE.BufferAttribute;
  if (!uv || !norm) return geo;

  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(norm.getX(i));
    const ny = Math.abs(norm.getY(i));
    const u = uv.getX(i);
    const v = uv.getY(i);
    if (ny > 0.5) {
      // Top / bottom faces: width x depth
      uv.setXY(i, u * width * texelsPerUnit, v * depth * texelsPerUnit);
    } else if (nx > 0.5) {
      // Left / right faces: depth x height
      uv.setXY(i, u * depth * texelsPerUnit, v * height * texelsPerUnit);
    } else {
      // Front / back faces: width x height
      uv.setXY(i, u * width * texelsPerUnit, v * height * texelsPerUnit);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

/**
 * Helper to collect every custom textureId referenced in a GameLevel (scenery + tree studio)
 * so Viewports & PlayMode can preload them all upfront!
 */
export function collectReferencedTextureIds(
  sceneryTextures?: Partial<Record<SceneryTextureSlot, SurfaceTextureSettings>>,
  canopyEngine?: {
    barkTexture?: SurfaceTextureSettings;
    canopyTexture?: SurfaceTextureSettings;
    fruitTexture?: SurfaceTextureSettings;
    speciesProfiles?: Record<
      string,
      | {
          barkTexture?: SurfaceTextureSettings;
          canopyTexture?: SurfaceTextureSettings;
          fruitTexture?: SurfaceTextureSettings;
        }
      | undefined
    >;
  },
  entityCanopies?: (
    | {
        barkTexture?: SurfaceTextureSettings;
        canopyTexture?: SurfaceTextureSettings;
        fruitTexture?: SurfaceTextureSettings;
      }
    | undefined
  )[]
): string[] {
  const ids = new Set<string>();
  const add = (s?: SurfaceTextureSettings) => {
    if (s?.enabled && s.textureId) ids.add(s.textureId);
  };
  if (sceneryTextures) {
    Object.values(sceneryTextures).forEach(add);
  }
  if (canopyEngine) {
    add(canopyEngine.barkTexture);
    add(canopyEngine.canopyTexture);
    add(canopyEngine.fruitTexture);
    if (canopyEngine.speciesProfiles) {
      Object.values(canopyEngine.speciesProfiles).forEach((p) => {
        if (!p) return;
        add(p.barkTexture);
        add(p.canopyTexture);
        add(p.fruitTexture);
      });
    }
  }
  if (entityCanopies) {
    entityCanopies.forEach((c) => {
      if (!c) return;
      add(c.barkTexture);
      add(c.canopyTexture);
      add(c.fruitTexture);
    });
  }
  return Array.from(ids);
}
