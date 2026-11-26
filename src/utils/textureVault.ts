import type { CustomTextureAssetMeta, CustomTextureResolution } from '../types/maker';
import { uid } from './terrain';

const DB_NAME = 'maker-textures-db';
const DB_VERSION = 1;
const META_STORE = 'texMeta';
const BLOB_STORE = 'texBlobs';

interface TextureBlobRecord {
  id: string;
  mimeType: string;
  blob: ArrayBuffer;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(BLOB_STORE)) {
        db.createObjectStore(BLOB_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open texture vault'));
  });
}

export async function listTextureMetas(): Promise<CustomTextureAssetMeta[]> {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(META_STORE, 'readonly');
      const req = tx.objectStore(META_STORE).getAll();
      req.onsuccess = () => {
        const rows = (req.result as CustomTextureAssetMeta[]) ?? [];
        rows.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
        resolve(rows);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function saveTextureRecord(
  meta: CustomTextureAssetMeta,
  buffer: ArrayBuffer,
  mimeType = 'image/png'
): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([META_STORE, BLOB_STORE], 'readwrite');
    tx.objectStore(META_STORE).put(meta);
    tx.objectStore(BLOB_STORE).put({ id: meta.id, mimeType, blob: buffer } as TextureBlobRecord);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to save custom texture'));
  });
}

export async function getTextureBlobRecord(
  id: string
): Promise<{ buffer: ArrayBuffer; mimeType: string } | null> {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(BLOB_STORE, 'readonly');
      const req = tx.objectStore(BLOB_STORE).get(id);
      req.onsuccess = () => {
        const rec = req.result as TextureBlobRecord | undefined;
        resolve(rec ? { buffer: rec.blob, mimeType: rec.mimeType || 'image/png' } : null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function deleteTextureRecord(id: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([META_STORE, BLOB_STORE], 'readwrite');
      tx.objectStore(META_STORE).delete(id);
      tx.objectStore(BLOB_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore cleanup failures
  }
}

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode uploaded image file'));
    img.src = url;
  });
}

function nearestPowerOfTwoDown(val: number, maxCap: number): number {
  const clamped = Math.min(val, maxCap);
  const pots = [1024, 512, 256, 128, 64];
  for (const p of pots) {
    if (clamped >= p) return p;
  }
  return Math.max(32, Math.round(clamped));
}

function computeTargetDimensions(
  origW: number,
  origH: number,
  maxResolution: CustomTextureResolution
): { width: number; height: number } {
  const aspect = origW / Math.max(1, origH);
  // Square or nearly square seamless textures snap cleanly to power-of-2 for crisp mipmapping
  if (aspect >= 0.9 && aspect <= 1.11) {
    const side = nearestPowerOfTwoDown(Math.max(origW, origH), maxResolution);
    return { width: side, height: side };
  }
  const maxDim = Math.max(origW, origH);
  if (maxDim <= maxResolution) {
    return { width: Math.max(32, origW), height: Math.max(32, origH) };
  }
  const scale = maxResolution / maxDim;
  const w = Math.max(32, Math.round((origW * scale) / 2) * 2);
  const h = Math.max(32, Math.round((origH * scale) / 2) * 2);
  return { width: w, height: h };
}

function canvasToPngBuffer(canvas: HTMLCanvasElement): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to encode texture PNG'));
          return;
        }
        blob.arrayBuffer().then(resolve, reject);
      },
      'image/png'
    );
  });
}

function makeThumbnailDataUrl(src: CanvasImageSource, srcW: number, srcH: number): string {
  const thumb = document.createElement('canvas');
  thumb.width = 96;
  thumb.height = 96;
  const ctx = thumb.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // Center-crop square thumbnail
  const minSide = Math.min(srcW, srcH);
  const sx = (srcW - minSide) * 0.5;
  const sy = (srcH - minSide) * 0.5;
  ctx.drawImage(src, sx, sy, minSide, minSide, 0, 0, 96, 96);
  try {
    const webp = thumb.toDataURL('image/webp', 0.82);
    if (webp.startsWith('data:image/webp')) return webp;
  } catch {
    // fallback below
  }
  return thumb.toDataURL('image/jpeg', 0.82);
}

/**
 * Decodes an uploaded image file (PNG/JPG/WebP), automatically resizes it down to
 * maxResolution (power-of-2 for square seamless maps) with high-quality filtering,
 * and returns compact lossless PNG bytes + metadata + ready canvas!
 */
export async function processUploadedTextureFile(
  file: File,
  maxResolution: CustomTextureResolution = 512
): Promise<{
  meta: CustomTextureAssetMeta;
  buffer: ArrayBuffer;
  mimeType: string;
  canvas: HTMLCanvasElement;
}> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImageFromUrl(objectUrl);
    const origW = img.naturalWidth || img.width;
    const origH = img.naturalHeight || img.height;
    const { width, height } = computeTargetDimensions(origW, origH, maxResolution);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    const buffer = await canvasToPngBuffer(canvas);
    const thumbnailDataUrl = makeThumbnailDataUrl(canvas, width, height);
    const cleanName = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Custom Texture';

    const meta: CustomTextureAssetMeta = {
      id: `tex_${uid()}`,
      name: cleanName,
      fileName: file.name,
      width,
      height,
      originalWidth: origW,
      originalHeight: origH,
      byteSize: buffer.byteLength,
      thumbnailDataUrl,
      createdAt: new Date().toISOString(),
    };

    return { meta, buffer, mimeType: 'image/png', canvas };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Downsizes an already-stored custom texture record in IndexedDB to a smaller power-of-2 resolution.
 */
export async function downsizeStoredTexture(
  meta: CustomTextureAssetMeta,
  targetResolution: CustomTextureResolution
): Promise<{
  meta: CustomTextureAssetMeta;
  buffer: ArrayBuffer;
  canvas: HTMLCanvasElement;
} | null> {
  const existing = await getTextureBlobRecord(meta.id);
  if (!existing) return null;

  const blob = new Blob([existing.buffer], { type: existing.mimeType });
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await loadImageFromUrl(objectUrl);
    const curW = img.naturalWidth || img.width;
    const curH = img.naturalHeight || img.height;
    const { width, height } = computeTargetDimensions(curW, curH, targetResolution);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    const buffer = await canvasToPngBuffer(canvas);
    const nextMeta: CustomTextureAssetMeta = {
      ...meta,
      width,
      height,
      byteSize: buffer.byteLength,
      thumbnailDataUrl: makeThumbnailDataUrl(canvas, width, height),
    };
    await saveTextureRecord(nextMeta, buffer, 'image/png');
    return { meta: nextMeta, buffer, canvas };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
