import * as THREE from 'three';
import type {
  MonsterSculptBoneOffset,
  MonsterSculptData,
  MonsterSculptSample,
  MonsterSculptSparseColor,
  MonsterSculptSparseDelta,
} from '../types/maker';

export type SculptToolId =
  | 'pull'
  | 'push'
  | 'grab'
  | 'pinch'
  | 'carve'
  | 'smooth'
  | 'stamp';

export type SeamlessPatternId =
  | 'scales'
  | 'fur'
  | 'chitin'
  | 'pebble'
  | 'spikes'
  | 'paintOnly'
  | 'custom';

export type StampApplyMode = 'both' | 'emboss' | 'paint';

export interface PatternSampler {
  id: string;
  label: string;
  previewDataUrl: string;
  sample: (u: number, v: number) => { h: number; r: number; g: number; b: number };
}

export interface GrabVertexEntry {
  index: number;
  weight: number;
  startX: number;
  startY: number;
  startZ: number;
}

export interface GrabSession {
  hitPoint: THREE.Vector3;
  mirrorHitPoint: THREE.Vector3 | null;
  primaryEntries: GrabVertexEntry[];
  mirrorEntries: GrabVertexEntry[];
}

export interface SculptBrushParams {
  tool: SculptToolId;
  radius: number;
  strength: number;
  symmetry: boolean;
  stampMode: StampApplyMode;
  stampTileScale: number;
  embossDepth: number;
  paintColor: string;
  paintMix: number;
  pattern?: PatternSampler | null;
}

const _cTmp = new THREE.Color();
const _vA = new THREE.Vector3();
const _vB = new THREE.Vector3();
const _tU = new THREE.Vector3();
const _tV = new THREE.Vector3();

function fract(x: number): number {
  return x - Math.floor(x);
}

/**
 * Generates a tileable 128x128 procedural pattern sampler + data URL preview.
 */
export function createProceduralPatternSampler(id: Exclude<SeamlessPatternId, 'custom'>): PatternSampler {
  const size = 128;
  const data = new Uint8ClampedArray(size * size * 4);
  const heights = new Float32Array(size * size);

  const labelMap: Record<Exclude<SeamlessPatternId, 'custom'>, string> = {
    scales: 'Dragon Scales',
    fur: 'Plush Fur',
    chitin: 'Chitin Plates',
    pebble: 'Reptile Bumps',
    spikes: 'Spiky Ridges',
    paintOnly: 'Solid Paint',
  };

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      let h = 0.5;
      let shade = 0.85;

      if (id === 'scales') {
        const cols = 6;
        const rows = 6;
        const rowIdx = Math.floor(v * rows);
        const uShift = rowIdx % 2 === 1 ? 0.5 / cols : 0;
        const fx = fract((u + uShift) * cols) - 0.5;
        const fy = fract(v * rows) - 0.5;
        const d = Math.hypot(fx * 1.05, fy * 0.9);
        const dome = Math.max(0, 1 - d * 1.85);
        h = 0.18 + Math.pow(dome, 0.72) * 0.82;
        shade = 0.48 + h * 0.52;
      } else if (id === 'fur') {
        const strands = 12;
        const fx = fract(u * strands) - 0.5;
        const wave = Math.sin(u * Math.PI * 12) * 0.08 + Math.cos(v * Math.PI * 6) * 0.06;
        const streak = Math.exp(-Math.pow(fx * 3.1 + wave, 2));
        const tip = Math.sin(fract(v * 5 + u * 2) * Math.PI);
        h = 0.2 + streak * tip * 0.8;
        shade = 0.52 + h * 0.48;
      } else if (id === 'chitin') {
        const bands = 4;
        const fy = fract(v * bands);
        const ridge = fy < 0.8 ? fy / 0.8 : (1 - fy) / 0.2;
        const seam = 0.85 + 0.15 * Math.cos(u * Math.PI * 4);
        h = 0.2 + Math.pow(ridge, 0.65) * 0.78 * seam;
        shade = 0.5 + h * 0.5;
      } else if (id === 'pebble') {
        // Tileable multi-lobe Voronoi-like bumpy skin
        const cells = 5;
        let minD = 9;
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const cx = Math.floor(u * cells) + ox;
            const cy = Math.floor(v * cells) + oy;
            const wx = ((cx % cells) + cells) % cells;
            const wy = ((cy % cells) + cells) % cells;
            const jx = fract(Math.sin(wx * 12.9898 + wy * 78.233) * 43758.5453) * 0.6 + 0.2;
            const jy = fract(Math.sin(wx * 45.164 + wy * 94.673) * 19341.123) * 0.6 + 0.2;
            const dx = (cx + jx) / cells - u;
            const dy = (cy + jy) / cells - v;
            const dist = Math.hypot(dx * cells, dy * cells);
            if (dist < minD) minD = dist;
          }
        }
        h = Math.max(0.1, 1 - minD * 1.15);
        shade = 0.48 + h * 0.52;
      } else if (id === 'spikes') {
        const cols = 4;
        const rows = 4;
        const fx = fract(u * cols) - 0.5;
        const fy = fract(v * rows) - 0.5;
        const d = Math.hypot(fx, fy) * 2.1;
        h = Math.max(0, Math.pow(Math.max(0, 1 - d), 1.6));
        shade = 0.4 + h * 0.6;
      } else {
        h = 0.5;
        shade = 1.0;
      }

      const idx = y * size + x;
      heights[idx] = h;
      const cVal = Math.round(THREE.MathUtils.clamp(shade, 0, 1) * 255);
      const p = idx * 4;
      data[p] = cVal;
      data[p + 1] = cVal;
      data[p + 2] = cVal;
      data[p + 3] = 255;
    }
  }

  let previewDataUrl = '';
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const imgData = new ImageData(data, size, size);
      ctx.putImageData(imgData, 0, 0);
      previewDataUrl = canvas.toDataURL('image/png');
    }
  }

  return {
    id,
    label: labelMap[id],
    previewDataUrl,
    sample: (u: number, v: number) => {
      const fu = fract(u) * (size - 1);
      const fv = fract(v) * (size - 1);
      const x0 = Math.floor(fu);
      const y0 = Math.floor(fv);
      const x1 = (x0 + 1) % size;
      const y1 = (y0 + 1) % size;
      const tx = fu - x0;
      const ty = fv - y0;

      const i00 = y0 * size + x0;
      const i10 = y0 * size + x1;
      const i01 = y1 * size + x0;
      const i11 = y1 * size + x1;

      const h =
        (heights[i00] * (1 - tx) + heights[i10] * tx) * (1 - ty) +
        (heights[i01] * (1 - tx) + heights[i11] * tx) * ty;

      const r =
        ((data[i00 * 4] * (1 - tx) + data[i10 * 4] * tx) * (1 - ty) +
          (data[i01 * 4] * (1 - tx) + data[i11 * 4] * tx) * ty) /
        255;

      return { h, r, g: r, b: r };
    },
  };
}

/**
 * Loads an uploaded image file (PNG/JPG/WEBP) into a fast seamless pattern sampler.
 */
export function createImagePatternSamplerFromFile(file: File): Promise<PatternSampler> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read texture file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file'));
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, size, size);
        const imgData = ctx.getImageData(0, 0, size, size).data;
        const previewDataUrl = canvas.toDataURL('image/png');

        resolve({
          id: 'custom',
          label: file.name.slice(0, 18),
          previewDataUrl,
          sample: (u: number, v: number) => {
            const fu = fract(u) * (size - 1);
            const fv = fract(v) * (size - 1);
            const x0 = Math.floor(fu);
            const y0 = Math.floor(fv);
            const x1 = (x0 + 1) % size;
            const y1 = (y0 + 1) % size;
            const tx = fu - x0;
            const ty = fv - y0;

            const i00 = (y0 * size + x0) * 4;
            const i10 = (y0 * size + x1) * 4;
            const i01 = (y1 * size + x0) * 4;
            const i11 = (y1 * size + x1) * 4;

            const r =
              ((imgData[i00] * (1 - tx) + imgData[i10] * tx) * (1 - ty) +
                (imgData[i01] * (1 - tx) + imgData[i11] * tx) * ty) /
              255;
            const g =
              ((imgData[i00 + 1] * (1 - tx) + imgData[i10 + 1] * tx) * (1 - ty) +
                (imgData[i01 + 1] * (1 - tx) + imgData[i11 + 1] * tx) * ty) /
              255;
            const b =
              ((imgData[i00 + 2] * (1 - tx) + imgData[i10 + 2] * tx) * (1 - ty) +
                (imgData[i01 + 2] * (1 - tx) + imgData[i11 + 2] * tx) * ty) /
              255;
            const h = 0.299 * r + 0.587 * g + 0.114 * b;
            return { h, r, g, b };
          },
        });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Builds fast per-vertex neighbor adjacency for Laplacian smoothing and sculpting.
 */
export function buildVertexAdjacency(geometry: THREE.BufferGeometry): Int32Array[] {
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const count = pos.count;
  const sets: Set<number>[] = new Array(count);
  for (let i = 0; i < count; i++) sets[i] = new Set();

  const index = geometry.getIndex();
  if (index) {
    const arr = index.array;
    for (let i = 0; i < arr.length; i += 3) {
      const a = arr[i];
      const b = arr[i + 1];
      const c = arr[i + 2];
      sets[a].add(b);
      sets[a].add(c);
      sets[b].add(a);
      sets[b].add(c);
      sets[c].add(a);
      sets[c].add(b);
    }
  } else {
    for (let i = 0; i < count; i += 3) {
      const a = i;
      const b = i + 1;
      const c = i + 2;
      sets[a].add(b);
      sets[a].add(c);
      sets[b].add(a);
      sets[b].add(c);
      sets[c].add(a);
      sets[c].add(b);
    }
  }

  return sets.map((s) => Int32Array.from(s));
}

function smoothFalloff(dist: number, radius: number): number {
  const t = dist / radius;
  if (t >= 1) return 0;
  const k = 1 - t * t;
  return k * k;
}

function buildLocalTangentFrame(normal: THREE.Vector3, outU: THREE.Vector3, outV: THREE.Vector3): void {
  const up = Math.abs(normal.y) < 0.92 ? _vA.set(0, 1, 0) : _vA.set(1, 0, 0);
  outU.crossVectors(up, normal).normalize();
  outV.crossVectors(normal, outU).normalize();
}

export function beginGrabSession(
  geometry: THREE.BufferGeometry,
  hitPoint: THREE.Vector3,
  radius: number,
  symmetry: boolean
): GrabSession {
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const rSq = radius * radius;
  const primaryEntries: GrabVertexEntry[] = [];
  const mirrorEntries: GrabVertexEntry[] = [];

  const mirrorHit = symmetry ? new THREE.Vector3(-hitPoint.x, hitPoint.y, hitPoint.z) : null;

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);

    const dx = vx - hitPoint.x;
    const dy = vy - hitPoint.y;
    const dz = vz - hitPoint.z;
    const dSq = dx * dx + dy * dy + dz * dz;
    if (dSq < rSq) {
      const w = smoothFalloff(Math.sqrt(dSq), radius);
      if (w > 0.001) {
        primaryEntries.push({ index: i, weight: w, startX: vx, startY: vy, startZ: vz });
      }
    }

    if (mirrorHit) {
      const mdx = vx - mirrorHit.x;
      const mdy = vy - mirrorHit.y;
      const mdz = vz - mirrorHit.z;
      const mdSq = mdx * mdx + mdy * mdy + mdz * mdz;
      if (mdSq < rSq) {
        const w = smoothFalloff(Math.sqrt(mdSq), radius);
        if (w > 0.001) {
          // Avoid double-moving center seam vertices already grabbed on primary side
          if (!symmetry || Math.abs(vx) > 0.008 || hitPoint.x >= 0) {
            mirrorEntries.push({ index: i, weight: w, startX: vx, startY: vy, startZ: vz });
          }
        }
      }
    }
  }

  return {
    hitPoint: hitPoint.clone(),
    mirrorHitPoint: mirrorHit,
    primaryEntries,
    mirrorEntries,
  };
}

export function applyGrabDelta(
  geometry: THREE.BufferGeometry,
  session: GrabSession,
  totalDelta: THREE.Vector3,
  strength: number
): void {
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const s = THREE.MathUtils.clamp(strength, 0.1, 1.5);

  for (let i = 0; i < session.primaryEntries.length; i++) {
    const e = session.primaryEntries[i];
    const f = e.weight * s;
    pos.setXYZ(e.index, e.startX + totalDelta.x * f, e.startY + totalDelta.y * f, e.startZ + totalDelta.z * f);
  }

  for (let i = 0; i < session.mirrorEntries.length; i++) {
    const e = session.mirrorEntries[i];
    const f = e.weight * s;
    pos.setXYZ(e.index, e.startX - totalDelta.x * f, e.startY + totalDelta.y * f, e.startZ + totalDelta.z * f);
  }

  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

function applySingleBrushDab(
  geometry: THREE.BufferGeometry,
  adjacency: Int32Array[],
  hitPoint: THREE.Vector3,
  hitNormal: THREE.Vector3,
  params: SculptBrushParams,
  isMirrorSide: boolean
): void {
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const norm = geometry.attributes.normal as THREE.BufferAttribute;
  const col = geometry.attributes.color as THREE.BufferAttribute | undefined;

  const r = Math.max(0.02, params.radius);
  const rSq = r * r;
  const str = params.strength;

  const affected: { idx: number; w: number; dist: number; vx: number; vy: number; vz: number }[] = [];

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);

    // Prevent double-applying across symmetry plane if hit is close to center
    if (isMirrorSide && Math.abs(vx) < 0.005) continue;

    const dx = vx - hitPoint.x;
    const dy = vy - hitPoint.y;
    const dz = vz - hitPoint.z;
    const dSq = dx * dx + dy * dy + dz * dz;
    if (dSq >= rSq) continue;
    const dist = Math.sqrt(dSq);
    const w = smoothFalloff(dist, r);
    if (w > 1e-4) {
      affected.push({ idx: i, w, dist, vx, vy, vz });
    }
  }

  if (affected.length === 0) return;

  if (params.tool === 'smooth') {
    const origPos = new Float32Array(affected.length * 3);
    for (let k = 0; k < affected.length; k++) {
      const { idx, w, vx, vy, vz } = affected[k];
      const nbrs = adjacency[idx];
      if (!nbrs || nbrs.length === 0) {
        origPos[k * 3] = vx;
        origPos[k * 3 + 1] = vy;
        origPos[k * 3 + 2] = vz;
        continue;
      }
      let ax = 0;
      let ay = 0;
      let az = 0;
      for (let n = 0; n < nbrs.length; n++) {
        const ni = nbrs[n];
        ax += pos.getX(ni);
        ay += pos.getY(ni);
        az += pos.getZ(ni);
      }
      const inv = 1 / nbrs.length;
      ax *= inv;
      ay *= inv;
      az *= inv;
      const blend = THREE.MathUtils.clamp(w * str * 0.55, 0, 0.85);
      origPos[k * 3] = vx + (ax - vx) * blend;
      origPos[k * 3 + 1] = vy + (ay - vy) * blend;
      origPos[k * 3 + 2] = vz + (az - vz) * blend;
    }
    for (let k = 0; k < affected.length; k++) {
      pos.setXYZ(affected[k].idx, origPos[k * 3], origPos[k * 3 + 1], origPos[k * 3 + 2]);
    }
  } else if (params.tool === 'pull' || params.tool === 'push') {
    const dirSign = params.tool === 'pull' ? 1 : -1;
    const mag = str * r * 0.14 * dirSign;
    for (let k = 0; k < affected.length; k++) {
      const { idx, w, vx, vy, vz } = affected[k];
      // Blend vertex normal + brush hit normal so spikes/horns pull out smoothly without self-intersecting
      const vnx = norm.getX(idx) * 0.6 + hitNormal.x * 0.4;
      const vny = norm.getY(idx) * 0.6 + hitNormal.y * 0.4;
      const vnz = norm.getZ(idx) * 0.6 + hitNormal.z * 0.4;
      const nLen = Math.hypot(vnx, vny, vnz) || 1;
      const d = mag * w;
      pos.setXYZ(idx, vx + (vnx / nLen) * d, vy + (vny / nLen) * d, vz + (vnz / nLen) * d);
    }
  } else if (params.tool === 'pinch') {
    const pullIn = str * 0.18;
    const tipLift = str * r * 0.08;
    for (let k = 0; k < affected.length; k++) {
      const { idx, w, vx, vy, vz } = affected[k];
      const toCenterX = hitPoint.x - vx;
      const toCenterY = hitPoint.y - vy;
      const toCenterZ = hitPoint.z - vz;
      // Pull radially toward brush center + slight outward tip lift
      const dLift = tipLift * w * w;
      pos.setXYZ(
        idx,
        vx + toCenterX * w * pullIn + hitNormal.x * dLift,
        vy + toCenterY * w * pullIn + hitNormal.y * dLift,
        vz + toCenterZ * w * pullIn + hitNormal.z * dLift
      );
    }
  } else if (params.tool === 'carve') {
    const pushDepth = -str * r * 0.14;
    const pinchFactor = str * 0.12;
    for (let k = 0; k < affected.length; k++) {
      const { idx, w, dist, vx, vy, vz } = affected[k];
      const sharpW = Math.pow(w, 1.45);
      const toCenterX = hitPoint.x - vx;
      const toCenterY = hitPoint.y - vy;
      const toCenterZ = hitPoint.z - vz;
      const vnx = norm.getX(idx) * 0.5 + hitNormal.x * 0.5;
      const vny = norm.getY(idx) * 0.5 + hitNormal.y * 0.5;
      const vnz = norm.getZ(idx) * 0.5 + hitNormal.z * 0.5;
      const nLen = Math.hypot(vnx, vny, vnz) || 1;
      const edgePinch = (dist / r) * sharpW * pinchFactor;
      pos.setXYZ(
        idx,
        vx + (vnx / nLen) * pushDepth * sharpW + toCenterX * edgePinch,
        vy + (vny / nLen) * pushDepth * sharpW + toCenterY * edgePinch,
        vz + (vnz / nLen) * pushDepth * sharpW + toCenterZ * edgePinch
      );
    }
  } else if (params.tool === 'stamp') {
    const sampler = params.pattern;
    if (!sampler) return;

    buildLocalTangentFrame(hitNormal, _tU, _tV);
    const tileScale = Math.max(0.25, params.stampTileScale);
    const doEmboss = params.stampMode === 'emboss' || params.stampMode === 'both';
    const doPaint = (params.stampMode === 'paint' || params.stampMode === 'both') && Boolean(col);
    const isCustomImg = sampler.id === 'custom';

    _cTmp.set(params.paintColor || '#7C5CFF');
    const targetR = _cTmp.r;
    const targetG = _cTmp.g;
    const targetB = _cTmp.b;

    for (let k = 0; k < affected.length; k++) {
      const { idx, w, vx, vy, vz } = affected[k];
      _vB.set(vx - hitPoint.x, vy - hitPoint.y, vz - hitPoint.z);
      const localU = _vB.dot(_tU) / Math.max(0.08, r * 1.35) * tileScale + 0.5;
      const localV = _vB.dot(_tV) / Math.max(0.08, r * 1.35) * tileScale + 0.5;

      const smp = sampler.sample(isMirrorSide ? 1 - localU : localU, localV);

      if (doEmboss && sampler.id !== 'paintOnly') {
        const disp = (smp.h - 0.42) * params.embossDepth * str * w * 0.08;
        const vnx = norm.getX(idx) * 0.65 + hitNormal.x * 0.35;
        const vny = norm.getY(idx) * 0.65 + hitNormal.y * 0.35;
        const vnz = norm.getZ(idx) * 0.65 + hitNormal.z * 0.35;
        const nLen = Math.hypot(vnx, vny, vnz) || 1;
        pos.setXYZ(idx, vx + (vnx / nLen) * disp, vy + (vny / nLen) * disp, vz + (vnz / nLen) * disp);
      }

      if (doPaint && col) {
        const mixW = THREE.MathUtils.clamp(w * str * params.paintMix, 0, 1);
        const curR = col.getX(idx);
        const curG = col.getY(idx);
        const curB = col.getZ(idx);

        // For custom uploaded images, paint the uploaded RGB directly (tinted lightly if desired);
        // for procedural grayscale patterns, tint with paintColor * pattern shade
        const destR = isCustomImg ? smp.r : targetR * smp.r;
        const destG = isCustomImg ? smp.g : targetG * smp.g;
        const destB = isCustomImg ? smp.b : targetB * smp.b;

        col.setXYZ(
          idx,
          curR + (destR - curR) * mixW,
          curG + (destG - curG) * mixW,
          curB + (destB - curB) * mixW
        );
      }
    }
  }

  pos.needsUpdate = true;
  if (col) col.needsUpdate = true;
}

export function applySculptBrushDab(
  geometry: THREE.BufferGeometry,
  adjacency: Int32Array[],
  hitPoint: THREE.Vector3,
  hitNormal: THREE.Vector3,
  params: SculptBrushParams
): void {
  applySingleBrushDab(geometry, adjacency, hitPoint, hitNormal, params, false);

  if (params.symmetry && Math.abs(hitPoint.x) > 0.008) {
    const mPt = new THREE.Vector3(-hitPoint.x, hitPoint.y, hitPoint.z);
    const mNorm = new THREE.Vector3(-hitNormal.x, hitNormal.y, hitNormal.z).normalize();
    applySingleBrushDab(geometry, adjacency, mPt, mNorm, params, true);
  }

  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

/**
 * Extracts compact sparse deltas + resolution-independent spatial samples relative to basePositions/baseColors.
 */
export function extractMonsterSculptData(
  geometry: THREE.BufferGeometry,
  basePositions: Float32Array,
  baseColors: Float32Array | null,
  resolution: number,
  boneOffsets?: MonsterSculptBoneOffset[]
): MonsterSculptData {
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const col = geometry.attributes.color as THREE.BufferAttribute | undefined;
  const count = pos.count;

  const sparseDeltas: MonsterSculptSparseDelta[] = [];
  const sparseColors: MonsterSculptSparseColor[] = [];

  // Spatial cell downsampler (cell size 0.045m) so sample count stays compact for cross-resolution transfer
  const cellSize = 0.045;
  const sampleBuckets = new Map<string, MonsterSculptSample>();

  const round4 = (n: number) => Math.round(n * 10000) / 10000;
  const round3 = (n: number) => Math.round(n * 1000) / 1000;

  for (let i = 0; i < count; i++) {
    const bx = basePositions[i * 3];
    const by = basePositions[i * 3 + 1];
    const bz = basePositions[i * 3 + 2];

    const dx = pos.getX(i) - bx;
    const dy = pos.getY(i) - by;
    const dz = pos.getZ(i) - bz;
    const dMag = Math.hypot(dx, dy, dz);

    let colorChanged = false;
    let cr = 1;
    let cg = 1;
    let cb = 1;
    if (col && baseColors && baseColors.length === count * 3) {
      cr = col.getX(i);
      cg = col.getY(i);
      cb = col.getZ(i);
      const cd = Math.abs(cr - baseColors[i * 3]) + Math.abs(cg - baseColors[i * 3 + 1]) + Math.abs(cb - baseColors[i * 3 + 2]);
      if (cd > 0.015) {
        colorChanged = true;
        sparseColors.push({ i, c: [round3(cr), round3(cg), round3(cb)] });
      }
    }

    if (dMag > 0.0008) {
      sparseDeltas.push({ i, d: [round4(dx), round4(dy), round4(dz)] });
    }

    if (dMag > 0.0015 || colorChanged) {
      const gx = Math.round(bx / cellSize);
      const gy = Math.round(by / cellSize);
      const gz = Math.round(bz / cellSize);
      const key = `${gx},${gy},${gz}`;
      if (!sampleBuckets.has(key)) {
        sampleBuckets.set(key, {
          p: [round4(bx), round4(by), round4(bz)],
          d: [round4(dx), round4(dy), round4(dz)],
          c: colorChanged ? [round3(cr), round3(cg), round3(cb)] : undefined,
        });
      }
    }
  }

  return {
    enabled: sparseDeltas.length > 0 || sparseColors.length > 0 || (boneOffsets?.length ?? 0) > 0,
    resolution,
    vertexCount: count,
    sparseDeltas,
    sparseColors: sparseColors.length > 0 ? sparseColors : undefined,
    samples: Array.from(sampleBuckets.values()),
    boneOffsets: boneOffsets && boneOffsets.length > 0 ? boneOffsets : undefined,
  };
}

/**
 * Applies saved MonsterSculptData onto any newly generated SDF monster geometry.
 * Uses 1:1 exact vertex restore when resolution & vertexCount match, and fast spatial hash IDW interpolation otherwise.
 */
export function applyMonsterSculptData(
  geometry: THREE.BufferGeometry,
  sculptData: MonsterSculptData | undefined,
  resolution: number
): void {
  if (!sculptData || !sculptData.enabled) return;

  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const col = geometry.attributes.color as THREE.BufferAttribute | undefined;
  if (!pos) return;

  const count = pos.count;

  if (sculptData.resolution === resolution && sculptData.vertexCount === count) {
    for (let k = 0; k < sculptData.sparseDeltas.length; k++) {
      const entry = sculptData.sparseDeltas[k];
      if (entry.i >= count) continue;
      pos.setXYZ(
        entry.i,
        pos.getX(entry.i) + entry.d[0],
        pos.getY(entry.i) + entry.d[1],
        pos.getZ(entry.i) + entry.d[2]
      );
    }
    if (col && sculptData.sparseColors) {
      for (let k = 0; k < sculptData.sparseColors.length; k++) {
        const entry = sculptData.sparseColors[k];
        if (entry.i >= count) continue;
        col.setXYZ(entry.i, entry.c[0], entry.c[1], entry.c[2]);
      }
      col.needsUpdate = true;
    }
  } else if (sculptData.samples.length > 0) {
    // Spatial Hash Grid transfer for cross-resolution playback (e.g. PlayModeView or Draft drag)
    const cellSize = 0.14;
    const grid = new Map<string, MonsterSculptSample[]>();
    for (let s = 0; s < sculptData.samples.length; s++) {
      const smp = sculptData.samples[s];
      const gx = Math.floor(smp.p[0] / cellSize);
      const gy = Math.floor(smp.p[1] / cellSize);
      const gz = Math.floor(smp.p[2] / cellSize);
      const key = `${gx},${gy},${gz}`;
      const list = grid.get(key);
      if (list) list.push(smp);
      else grid.set(key, [smp]);
    }

    const maxR = 0.14;
    const maxRSq = maxR * maxR;

    for (let i = 0; i < count; i++) {
      const px = pos.getX(i);
      const py = pos.getY(i);
      const pz = pos.getZ(i);
      const cx = Math.floor(px / cellSize);
      const cy = Math.floor(py / cellSize);
      const cz = Math.floor(pz / cellSize);

      let wSum = 0;
      let dxAcc = 0;
      let dyAcc = 0;
      let dzAcc = 0;
      let cWSum = 0;
      let crAcc = 0;
      let cgAcc = 0;
      let cbAcc = 0;

      for (let oz = -1; oz <= 1; oz++) {
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const bucket = grid.get(`${cx + ox},${cy + oy},${cz + oz}`);
            if (!bucket) continue;
            for (let b = 0; b < bucket.length; b++) {
              const smp = bucket[b];
              const dx = px - smp.p[0];
              const dy = py - smp.p[1];
              const dz = pz - smp.p[2];
              const dSq = dx * dx + dy * dy + dz * dz;
              if (dSq >= maxRSq) continue;
              const w = 1 / (dSq + 0.0008);
              wSum += w;
              dxAcc += smp.d[0] * w;
              dyAcc += smp.d[1] * w;
              dzAcc += smp.d[2] * w;
              if (smp.c) {
                cWSum += w;
                crAcc += smp.c[0] * w;
                cgAcc += smp.c[1] * w;
                cbAcc += smp.c[2] * w;
              }
            }
          }
        }
      }

      if (wSum > 0) {
        pos.setXYZ(i, px + dxAcc / wSum, py + dyAcc / wSum, pz + dzAcc / wSum);
      }
      if (col && cWSum > 0) {
        col.setXYZ(i, crAcc / cWSum, cgAcc / cWSum, cbAcc / cWSum);
      }
    }
    if (col) col.needsUpdate = true;
  }

  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

/**
 * Inspects sculpted displacements grouped by bone skinning weights to auto-adjust
 * existing limb, head, neck, and tail bones to follow stretched/sculpted proportions.
 */
export function computeAutoFitBoneOffsets(
  geometry: THREE.BufferGeometry,
  basePositions: Float32Array,
  bones: THREE.Bone[]
): MonsterSculptBoneOffset[] {
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const skinIdx = geometry.attributes.skinIndex as THREE.BufferAttribute | undefined;
  const skinW = geometry.attributes.skinWeight as THREE.BufferAttribute | undefined;
  if (!pos || !skinIdx || !skinW) return [];

  const bCount = bones.length;
  const sumW = new Float32Array(bCount);
  const sumDx = new Float32Array(bCount);
  const sumDy = new Float32Array(bCount);
  const sumDz = new Float32Array(bCount);
  const maxMag = new Float32Array(bCount);

  for (let i = 0; i < pos.count; i++) {
    const dx = pos.getX(i) - basePositions[i * 3];
    const dy = pos.getY(i) - basePositions[i * 3 + 1];
    const dz = pos.getZ(i) - basePositions[i * 3 + 2];
    const mag = Math.hypot(dx, dy, dz);
    if (mag < 0.008) continue;

    for (let slot = 0; slot < 4; slot++) {
      const w =
        slot === 0 ? skinW.getX(i) : slot === 1 ? skinW.getY(i) : slot === 2 ? skinW.getZ(i) : skinW.getW(i);
      if (w < 0.35) continue;
      const bi =
        slot === 0 ? skinIdx.getX(i) : slot === 1 ? skinIdx.getY(i) : slot === 2 ? skinIdx.getZ(i) : skinIdx.getW(i);
      if (bi < 0 || bi >= bCount) continue;
      sumW[bi] += w;
      sumDx[bi] += dx * w;
      sumDy[bi] += dy * w;
      sumDz[bi] += dz * w;
      if (mag > maxMag[bi]) maxMag[bi] = mag;
    }
  }

  const offsets: MonsterSculptBoneOffset[] = [];
  const round4 = (n: number) => Math.round(n * 10000) / 10000;

  for (let b = 0; b < bCount; b++) {
    const bone = bones[b];
    // Only auto-adjust articulated limbs, head/jaw/neck, and tail joints (keep root & body pivot stable)
    if (
      bone.name === 'MonsterRoot' ||
      bone.name === 'MonsterBodyPivot' ||
      bone.name === 'MonsterTorso'
    ) {
      continue;
    }
    if (sumW[b] < 2.0) continue;
    const dx = sumDx[b] / sumW[b];
    const dy = sumDy[b] / sumW[b];
    const dz = sumDz[b] / sumW[b];
    if (Math.hypot(dx, dy, dz) < 0.015) continue;

    offsets.push({
      boneName: bone.name,
      delta: [round4(dx), round4(dy), round4(dz)],
    });
  }

  return offsets;
}
