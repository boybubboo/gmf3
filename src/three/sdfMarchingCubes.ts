import * as THREE from 'three';
import { edgeTable, triTable } from 'three/addons/objects/MarchingCubes.js';
import type { CharacterBodyPartKey } from '../types/maker';

export const CHARACTER_PART_KEYS: readonly CharacterBodyPartKey[] = [
  'head',
  'headCrown',
  'headJaw',
  'muzzle',
  'neck',
  'torso',
  'belly',
  'hips',
  'upperArm',
  'lowerArm',
  'upperLeg',
  'lowerLeg',
  'tail',
  'extraArm',
  'extraLeg',
] as const;

export const CHARACTER_PART_INDEX: Record<CharacterBodyPartKey, number> = {
  head: 0,
  headCrown: 1,
  headJaw: 2,
  muzzle: 3,
  neck: 4,
  torso: 5,
  belly: 6,
  hips: 7,
  upperArm: 8,
  lowerArm: 9,
  upperLeg: 10,
  lowerLeg: 11,
  tail: 12,
  extraArm: 13,
  extraLeg: 14,
};

export type SdfPrimitiveKind = 'capsule' | 'ellipsoid' | 'roundedBox';

export interface SdfPrimitive {
  kind: SdfPrimitiveKind;
  op?: 'add' | 'sub';
  /** Start point (or center for ellipsoid / roundedBox) */
  a: [number, number, number];
  /** End point (for capsule) or half-extents [rx, ry, rz] (for ellipsoid / roundedBox) */
  b: [number, number, number];
  /** Optional local X/Z ovalness for capsules [scaleX, scaleZ] */
  oval?: [number, number];
  /** Optional orientation axes (flattened 3x3 column-major basis or unit quaternion [x,y,z,w]) */
  quat?: [number, number, number, number];
  /** Radial profile along capsule t in [0..1] */
  startRadius: number;
  midRadius: number;
  endRadius: number;
  /** Curvature factor [-1..+1]: concave scoop to convex bulge between control points */
  curvature: number;
  /** Blend smoothness multiplier relative to global blendK (e.g. 1.0 body, 0.25 fingers) */
  blendScale?: number;
  /** Linear-ready RGB [0..1] color */
  color: [number, number, number];
  /** Primary bone index at t=0 (or whole primitive) */
  boneA: number;
  /** Secondary bone index at t=1 (for smooth joint interpolation along capsule) */
  boneB?: number;
  /** How much vertex weights favor boneA vs boneB (0 = pure boneA, 1 = blend along t) */
  boneLerp?: number;
  /** Corner roundness for roundedBox */
  roundness?: number;
  /** Optional semantic body part key for editor highlight masks */
  partKey?: CharacterBodyPartKey;
  /** Optional explicit part mask slot index (0..14) for custom SDF builders such as Monster Maker */
  partIndex?: number;
  /** Optional segment seam zone ID (>= 0) for surface segment boundary lines */
  seamZone?: number;
}

interface CompiledPrimitive {
  kind: SdfPrimitiveKind;
  op: 'add' | 'sub';
  ax: number;
  ay: number;
  az: number;
  bx: number;
  by: number;
  bz: number;
  // Capsule vector ab & invLenSq
  abx: number;
  aby: number;
  abz: number;
  abLenSq: number;
  ovalX: number;
  ovalZ: number;
  // Inverse quaternion for ellipsoid/box local space
  iqx: number;
  iqy: number;
  iqz: number;
  iqw: number;
  hasQuat: boolean;
  startR: number;
  midR: number;
  endR: number;
  curvature: number;
  blendScale: number;
  roundness: number;
  r: number;
  g: number;
  b: number;
  boneA: number;
  boneB: number;
  boneLerp: number;
  partIdx: number;
  seamZone: number;
  seamSlot: number;
  // Expanded AABB for fast culling
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

export interface SdfMarchingCubesResult {
  geometry: THREE.BufferGeometry;
  vertexCount: number;
  triangleCount: number;
  bounds: THREE.Box3;
  /** Quantized [0..255] per-vertex influence for each CHARACTER_PART_KEYS entry (len = vertexCount * 15) */
  partWeights?: Uint8Array;
  /** Dominant segment seam zone ID per vertex (-1 if untagged) */
  seamZones?: Int16Array;
  /** Signed-distance margin to the second-nearest seam zone (for exact boundary interpolation) */
  seamGaps?: Float32Array;
}

function evalProfileRadius(
  t: number,
  r0: number,
  r1: number,
  r2: number,
  curvature: number
): number {
  const half = t <= 0.5;
  const u = half ? t * 2 : (t - 0.5) * 2;
  const ra = half ? r0 : r1;
  const rb = half ? r1 : r2;
  // C1 cosine blend hits exact radii at t = 0, 0.5, 1
  const smooth = 0.5 - 0.5 * Math.cos(u * Math.PI);
  const baseR = ra + (rb - ra) * smooth;
  const bow = curvature * Math.sin(u * Math.PI) * 0.22 * ((ra + rb) * 0.5);
  return Math.max(0.004, baseR + bow);
}

function evalPrimitiveDist(
  prim: CompiledPrimitive,
  px: number,
  py: number,
  pz: number
): { d: number; t: number } {
  if (prim.kind === 'capsule') {
    const apx = px - prim.ax;
    const apy = py - prim.ay;
    const apz = pz - prim.az;
    let t = 0;
    if (prim.abLenSq > 1e-8) {
      t = (apx * prim.abx + apy * prim.aby + apz * prim.abz) / prim.abLenSq;
      if (t < 0) t = 0;
      else if (t > 1) t = 1;
    }
    const dx = apx - prim.abx * t;
    const dy = apy - prim.aby * t;
    const dz = apz - prim.abz * t;
    const sx = dx / prim.ovalX;
    const sz = dz / prim.ovalZ;
    const dist = Math.sqrt(sx * sx + dy * dy + sz * sz);
    const rad = evalProfileRadius(t, prim.startR, prim.midR, prim.endR, prim.curvature);
    return { d: dist - rad, t };
  }

  // Transform point into local primitive space
  let lx = px - prim.ax;
  let ly = py - prim.ay;
  let lz = pz - prim.az;
  if (prim.hasQuat) {
    // Rotate vector by inverse quaternion iquat
    const qx = prim.iqx;
    const qy = prim.iqy;
    const qz = prim.iqz;
    const qw = prim.iqw;
    const ix = qw * lx + qy * lz - qz * ly;
    const iy = qw * ly + qz * lx - qx * lz;
    const iz = qw * lz + qx * ly - qy * lx;
    const iw = -qx * lx - qy * ly - qz * lz;
    lx = ix * qw + iw * -qx + iy * -qz - iz * -qy;
    ly = iy * qw + iw * -qy + iz * -qx - ix * -qz;
    lz = iz * qw + iw * -qz + ix * -qy - iy * -qx;
  }

  if (prim.kind === 'ellipsoid') {
    const rx = Math.max(0.01, prim.bx);
    const ry = Math.max(0.01, prim.by);
    const rz = Math.max(0.01, prim.bz);
    const qx = lx / rx;
    const qy = ly / ry;
    const qz = lz / rz;
    const k0 = Math.sqrt(qx * qx + qy * qy + qz * qz);
    if (k0 < 1e-6) {
      return { d: -Math.min(rx, ry, rz), t: 0.5 };
    }
    const rx2 = rx * rx;
    const ry2 = ry * ry;
    const rz2 = rz * rz;
    const px2 = lx / rx2;
    const py2 = ly / ry2;
    const pz2 = lz / rz2;
    const k1 = Math.sqrt(px2 * px2 + py2 * py2 + pz2 * pz2);
    return { d: (k0 * (k0 - 1)) / Math.max(1e-6, k1), t: 0.5 };
  }

  // roundedBox
  const r = prim.roundness;
  const ex = Math.max(0.005, prim.bx - r);
  const ey = Math.max(0.005, prim.by - r);
  const ez = Math.max(0.005, prim.bz - r);
  const qx = Math.abs(lx) - ex;
  const qy = Math.abs(ly) - ey;
  const qz = Math.abs(lz) - ez;
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  const oz = Math.max(qz, 0);
  const outDist = Math.sqrt(ox * ox + oy * oy + oz * oz);
  const inDist = Math.min(Math.max(qx, qy, qz), 0);
  return { d: outDist + inDist - r, t: 0.5 };
}

function sminPoly(a: number, b: number, k: number): number {
  if (k <= 1e-5) return a < b ? a : b;
  const diff = a - b;
  const absDiff = diff < 0 ? -diff : diff;
  if (absDiff >= k) return a < b ? a : b;
  const h = (k - absDiff) / k;
  return (a < b ? a : b) - h * h * k * 0.25;
}

function smaxPoly(a: number, b: number, k: number): number {
  if (k <= 1e-5) return a > b ? a : b;
  const diff = a - b;
  const absDiff = diff < 0 ? -diff : diff;
  if (absDiff >= k) return a > b ? a : b;
  const h = (k - absDiff) / k;
  return (a > b ? a : b) + h * h * k * 0.25;
}

function compilePrimitives(
  primitives: SdfPrimitive[],
  blendK: number
): {
  addPrims: CompiledPrimitive[];
  subPrims: CompiledPrimitive[];
  bounds: THREE.Box3;
  seamZoneBySlot: number[];
  seamPartIdxBySlot: number[];
} {
  const addPrims: CompiledPrimitive[] = [];
  const subPrims: CompiledPrimitive[] = [];
  const bounds = new THREE.Box3();
  const padMargin = Math.max(0.08, blendK * 1.6);
  const seamSlotMap = new Map<number, number>();
  const seamZoneBySlot: number[] = [];
  const seamPartIdxBySlot: number[] = [];

  for (let i = 0; i < primitives.length; i++) {
    const p = primitives[i];
    const op = p.op ?? 'add';
    const ovalX = Math.max(0.35, p.oval?.[0] ?? 1);
    const ovalZ = Math.max(0.35, p.oval?.[1] ?? 1);
    const maxR = Math.max(p.startRadius, p.midRadius, p.endRadius) *
      (1 + Math.max(0, p.curvature) * 0.26) *
      Math.max(1, ovalX, ovalZ);

    let minX = p.a[0];
    let minY = p.a[1];
    let minZ = p.a[2];
    let maxX = p.a[0];
    let maxY = p.a[1];
    let maxZ = p.a[2];

    if (p.kind === 'capsule') {
      minX = Math.min(p.a[0], p.b[0]) - maxR;
      minY = Math.min(p.a[1], p.b[1]) - maxR;
      minZ = Math.min(p.a[2], p.b[2]) - maxR;
      maxX = Math.max(p.a[0], p.b[0]) + maxR;
      maxY = Math.max(p.a[1], p.b[1]) + maxR;
      maxZ = Math.max(p.a[2], p.b[2]) + maxR;
    } else {
      const ext = Math.max(p.b[0], p.b[1], p.b[2]) * 1.15;
      minX = p.a[0] - ext;
      minY = p.a[1] - ext;
      minZ = p.a[2] - ext;
      maxX = p.a[0] + ext;
      maxY = p.a[1] + ext;
      maxZ = p.a[2] + ext;
    }

    let iqx = 0;
    let iqy = 0;
    let iqz = 0;
    let iqw = 1;
    let hasQuat = false;
    if (p.quat) {
      hasQuat = true;
      iqx = -p.quat[0];
      iqy = -p.quat[1];
      iqz = -p.quat[2];
      iqw = p.quat[3];
    }

    const abx = p.b[0] - p.a[0];
    const aby = p.b[1] - p.a[1];
    const abz = p.b[2] - p.a[2];

    const partIdx =
      p.partIndex !== undefined
        ? p.partIndex
        : p.partKey
          ? CHARACTER_PART_INDEX[p.partKey]
          : -1;
    const seamZone = p.seamZone !== undefined ? p.seamZone : partIdx;
    let seamSlot = -1;
    if (op === 'add' && seamZone >= 0) {
      const existingSlot = seamSlotMap.get(seamZone);
      if (existingSlot !== undefined) {
        seamSlot = existingSlot;
      } else {
        seamSlot = seamZoneBySlot.length;
        seamSlotMap.set(seamZone, seamSlot);
        seamZoneBySlot.push(seamZone);
        seamPartIdxBySlot.push(partIdx);
      }
    }

    const compiled: CompiledPrimitive = {
      kind: p.kind,
      op,
      ax: p.a[0],
      ay: p.a[1],
      az: p.a[2],
      bx: p.b[0],
      by: p.b[1],
      bz: p.b[2],
      abx,
      aby,
      abz,
      abLenSq: abx * abx + aby * aby + abz * abz,
      ovalX,
      ovalZ,
      iqx,
      iqy,
      iqz,
      iqw,
      hasQuat,
      startR: p.startRadius,
      midR: p.midRadius,
      endR: p.endRadius,
      curvature: p.curvature,
      blendScale: p.blendScale ?? 1,
      roundness: p.roundness ?? 0.04,
      r: p.color[0],
      g: p.color[1],
      b: p.color[2],
      boneA: p.boneA,
      boneB: p.boneB ?? p.boneA,
      boneLerp: p.boneLerp ?? 0,
      partIdx,
      seamZone,
      seamSlot,
      minX: minX - padMargin,
      minY: minY - padMargin,
      minZ: minZ - padMargin,
      maxX: maxX + padMargin,
      maxY: maxY + padMargin,
      maxZ: maxZ + padMargin,
    };

    if (op === 'sub') {
      subPrims.push(compiled);
    } else {
      addPrims.push(compiled);
      bounds.expandByPoint(new THREE.Vector3(minX, minY, minZ));
      bounds.expandByPoint(new THREE.Vector3(maxX, maxY, maxZ));
    }
  }

  // Sort larger-blend core primitives first so finer details (fingers/claws) fillet smoothly onto them
  addPrims.sort((a, b) => b.blendScale - a.blendScale);

  return { addPrims, subPrims, bounds, seamZoneBySlot, seamPartIdxBySlot };
}

export class SdfFieldEvaluator {
  private readonly addPrims: CompiledPrimitive[];
  private readonly subPrims: CompiledPrimitive[];
  private readonly blendK: number;
  private readonly seamZoneBySlot: number[];
  private readonly seamPartIdxBySlot: number[];
  private readonly _partMinD = new Float32Array(CHARACTER_PART_KEYS.length);
  private readonly _seamMinD: Float32Array;
  public readonly bounds: THREE.Box3;

  constructor(primitives: SdfPrimitive[], blendK: number) {
    this.blendK = Math.max(0.005, blendK);
    const compiled = compilePrimitives(primitives, this.blendK);
    this.addPrims = compiled.addPrims;
    this.subPrims = compiled.subPrims;
    this.bounds = compiled.bounds;
    this.seamZoneBySlot = compiled.seamZoneBySlot;
    this.seamPartIdxBySlot = compiled.seamPartIdxBySlot;
    this._seamMinD = new Float32Array(Math.max(1, this.seamZoneBySlot.length));
  }

  public evaluate(px: number, py: number, pz: number): number {
    const adds = this.addPrims;
    const len = adds.length;
    if (len === 0) return 10;

    let d = 1e6;
    const baseK = this.blendK;

    for (let i = 0; i < len; i++) {
      const p = adds[i];
      // Fast coarse box skip when already closer to another primitive than this box
      const kLocal = baseK * p.blendScale;
      if (d < 1e4) {
        const dx = px < p.minX ? p.minX - px : px > p.maxX ? px - p.maxX : 0;
        const dy = py < p.minY ? p.minY - py : py > p.maxY ? py - p.maxY : 0;
        const dz = pz < p.minZ ? p.minZ - pz : pz > p.maxZ ? pz - p.maxZ : 0;
        if (dx * dx + dy * dy + dz * dz > (Math.max(0, d) + kLocal + 0.05) ** 2) {
          continue;
        }
      }
      const { d: pd } = evalPrimitiveDist(p, px, py, pz);
      d = d > 1e4 ? pd : sminPoly(d, pd, kLocal);
    }

    for (let i = 0; i < this.subPrims.length; i++) {
      const s = this.subPrims[i];
      if (
        px < s.minX ||
        px > s.maxX ||
        py < s.minY ||
        py > s.maxY ||
        pz < s.minZ ||
        pz > s.maxZ
      ) {
        continue;
      }
      const { d: sd } = evalPrimitiveDist(s, px, py, pz);
      d = smaxPoly(d, -sd, baseK * s.blendScale);
    }

    return d;
  }

  public evaluateNormal(px: number, py: number, pz: number, eps: number): [number, number, number] {
    const gx = this.evaluate(px + eps, py, pz) - this.evaluate(px - eps, py, pz);
    const gy = this.evaluate(px, py + eps, pz) - this.evaluate(px, py - eps, pz);
    const gz = this.evaluate(px, py, pz + eps) - this.evaluate(px, py, pz - eps);
    const len = Math.sqrt(gx * gx + gy * gy + gz * gz);
    if (len < 1e-8) return [0, 1, 0];
    return [gx / len, gy / len, gz / len];
  }

  /**
   * Computes smoothly blended vertex color AND top-4 bone weights from nearby primitives,
   * and optionally computes per-part glow weights + segment seam zone/gap for editor overlays.
   */
  public evaluateColorAndWeights(
    px: number,
    py: number,
    pz: number,
    boneCount: number,
    outPartWeights?: Uint8Array,
    outPartOffset = 0
  ): {
    color: [number, number, number];
    skinIndices: [number, number, number, number];
    skinWeights: [number, number, number, number];
    seamZone: number;
    seamGap: number;
  } {
    const adds = this.addPrims;
    const sharpnessColor = 1 / Math.max(0.02, this.blendK * 0.55);
    const sharpnessSkin = 1 / Math.max(0.035, this.blendK * 0.9 + 0.035);

    let minD = 1e6;
    const dists: number[] = new Array(adds.length);
    const ts: number[] = new Array(adds.length);

    const partMinD = this._partMinD;
    const seamMinD = this._seamMinD;
    const slotCount = this.seamZoneBySlot.length;
    if (outPartWeights) {
      partMinD.fill(99);
      seamMinD.fill(99);
    }

    for (let i = 0; i < adds.length; i++) {
      const p = adds[i];
      const dx = px < p.minX ? p.minX - px : px > p.maxX ? px - p.maxX : 0;
      const dy = py < p.minY ? p.minY - py : py > p.maxY ? py - p.maxY : 0;
      const dz = pz < p.minZ ? p.minZ - pz : pz > p.maxZ ? pz - p.maxZ : 0;
      if (dx * dx + dy * dy + dz * dz > 0.65) {
        dists[i] = 99;
        ts[i] = 0.5;
        continue;
      }
      const res = evalPrimitiveDist(p, px, py, pz);
      dists[i] = res.d;
      ts[i] = res.t;
      if (res.d < minD) minD = res.d;
      if (outPartWeights) {
        if (p.partIdx >= 0 && res.d < partMinD[p.partIdx]) {
          partMinD[p.partIdx] = res.d;
        }
        if (p.seamSlot >= 0 && res.d < seamMinD[p.seamSlot]) {
          seamMinD[p.seamSlot] = res.d;
        }
      }
    }

    let cWeightSum = 0;
    let rAcc = 0;
    let gAcc = 0;
    let bAcc = 0;

    // Accumulate bone influences in a small flat array (characters typically have 18-32 bones)
    const boneAcc = new Float32Array(Math.max(1, boneCount));

    for (let i = 0; i < adds.length; i++) {
      const di = dists[i];
      if (di > 50) continue;
      const p = adds[i];
      const delta = Math.max(0, di - minD);

      const cw = Math.exp(-delta * sharpnessColor / Math.max(0.35, p.blendScale));
      if (cw > 1e-4) {
        rAcc += p.r * cw;
        gAcc += p.g * cw;
        bAcc += p.b * cw;
        cWeightSum += cw;
      }

      const sw = Math.exp(-delta * sharpnessSkin);
      if (sw > 1e-4) {
        const bA = Math.min(boneCount - 1, Math.max(0, p.boneA));
        const bB = Math.min(boneCount - 1, Math.max(0, p.boneB));
        if (p.boneLerp > 0 && bA !== bB) {
          const lerpFrac = THREE.MathUtils.clamp(ts[i] * p.boneLerp, 0, 1);
          boneAcc[bA] += sw * (1 - lerpFrac);
          boneAcc[bB] += sw * lerpFrac;
        } else {
          boneAcc[bA] += sw;
        }
      }
    }

    const color: [number, number, number] =
      cWeightSum > 1e-6
        ? [rAcc / cWeightSum, gAcc / cWeightSum, bAcc / cWeightSum]
        : [0.85, 0.78, 0.72];

    // Pick top 4 bone weights
    const topIdx: [number, number, number, number] = [0, 0, 0, 0];
    const topW: [number, number, number, number] = [0, 0, 0, 0];

    for (let b = 0; b < boneCount; b++) {
      const w = boneAcc[b];
      if (w <= topW[3]) continue;
      if (w > topW[0]) {
        topW[3] = topW[2]; topIdx[3] = topIdx[2];
        topW[2] = topW[1]; topIdx[2] = topIdx[1];
        topW[1] = topW[0]; topIdx[1] = topIdx[0];
        topW[0] = w; topIdx[0] = b;
      } else if (w > topW[1]) {
        topW[3] = topW[2]; topIdx[3] = topIdx[2];
        topW[2] = topW[1]; topIdx[2] = topIdx[1];
        topW[1] = w; topIdx[1] = b;
      } else if (w > topW[2]) {
        topW[3] = topW[2]; topIdx[3] = topIdx[2];
        topW[2] = w; topIdx[2] = b;
      } else {
        topW[3] = w; topIdx[3] = b;
      }
    }

    const totalW = topW[0] + topW[1] + topW[2] + topW[3];
    if (totalW > 1e-6) {
      topW[0] /= totalW;
      topW[1] /= totalW;
      topW[2] /= totalW;
      topW[3] /= totalW;
    } else {
      topW[0] = 1;
    }

    let seamZone = -1;
    let seamGap = 0;
    if (outPartWeights) {
      const partCount = CHARACTER_PART_KEYS.length;
      const sharpPart = 1 / Math.max(0.011, this.blendK * 0.24);
      // Closest non-cranial part distance prevents headCrown/headJaw from spilling onto neck or muzzle
      let nonHeadMinD = 99;
      for (let k = 3; k < partCount; k++) {
        if (partMinD[k] < nonHeadMinD) nonHeadMinD = partMinD[k];
      }

      for (let k = 0; k < partCount; k++) {
        const pd = partMinD[k];
        if (pd > 20) {
          outPartWeights[outPartOffset + k] = 0;
          continue;
        }
        let w = 0;
        if (k === 1 || k === 2) {
          // headCrown & headJaw: glow even when slightly recessed inside the main skull
          const rawGap = Math.max(0, pd - 0.012);
          const otherDelta = Math.max(0, pd - nonHeadMinD);
          w = Math.exp(-rawGap / 0.018) * Math.exp(-otherDelta / 0.015);
        } else {
          const delta = Math.max(0, pd - minD);
          w = Math.exp(-delta * sharpPart);
        }
        outPartWeights[outPartOffset + k] = Math.min(255, Math.max(0, Math.round(w * 255)));
      }

      // Find best & second-best distinct seam zones (bias headCrown/headJaw slightly so subtle chin/brow seams appear)
      let bestSlot = -1;
      let bestEffD = 99;
      let secondEffD = 99;
      for (let s = 0; s < slotCount; s++) {
        let sd = seamMinD[s];
        if (sd > 20) continue;
        const sPart = this.seamPartIdxBySlot[s];
        if ((sPart === 1 || sPart === 2) && sd < 0.025) {
          sd -= 0.016;
        }
        if (sd < bestEffD) {
          secondEffD = bestEffD;
          bestEffD = sd;
          bestSlot = s;
        } else if (sd < secondEffD) {
          secondEffD = sd;
        }
      }
      if (bestSlot >= 0) {
        seamZone = this.seamZoneBySlot[bestSlot];
        seamGap = secondEffD < 20 ? Math.max(0, secondEffD - bestEffD) : 0.25;
      }
    }

    return { color, skinIndices: topIdx, skinWeights: topW, seamZone, seamGap };
  }

  /**
   * Projects a point onto the SDF zero-isosurface by marching along its gradient/ray
   * so surface-mounted details (eyes, eyebrows, whiskers) sit flush against any sculpted head.
   */
  public projectPointToSurface(
    origin: THREE.Vector3,
    outwardDir: THREE.Vector3,
    maxSteps = 20
  ): { point: THREE.Vector3; normal: THREE.Vector3 } {
    const dir = outwardDir.clone().normalize();
    const p = origin.clone();
    // Walk toward SDF d == 0 along dir when well-aligned, falling back to negative gradient near silhouettes
    for (let i = 0; i < maxSteps; i++) {
      const d = this.evaluate(p.x, p.y, p.z);
      if (Math.abs(d) < 0.0012) break;
      const g = this.evaluateNormal(p.x, p.y, p.z, 0.005);
      const gradVec = new THREE.Vector3(g[0], g[1], g[2]);
      const align = gradVec.dot(dir);
      if (align > 0.35) {
        const step = THREE.MathUtils.clamp((-d / align) * 0.65, -0.14, 0.14);
        p.addScaledVector(dir, step);
      } else {
        const step = THREE.MathUtils.clamp(-d * 0.68, -0.14, 0.14);
        p.addScaledVector(gradVec, step);
      }
    }
    const nArr = this.evaluateNormal(p.x, p.y, p.z, 0.006);
    return {
      point: p,
      normal: new THREE.Vector3(nArr[0], nArr[1], nArr[2]).normalize(),
    };
  }

  /**
   * Traces strictly forward (+outwardDir) starting inside the skull/body SDF until the FIRST
   * surface zero-crossing (d >= 0), then bisects to sub-millimeter precision.
   * Prevents cranial eyes and eyebrows from jumping across empty space onto a protruding muzzle tip.
   */
  public projectOutwardFromInterior(
    interiorOrigin: THREE.Vector3,
    outwardDir: THREE.Vector3,
    maxDist = 0.65
  ): { point: THREE.Vector3; normal: THREE.Vector3 } | null {
    const dir = outwardDir.clone().normalize();
    let d0 = this.evaluate(interiorOrigin.x, interiorOrigin.y, interiorOrigin.z);
    if (d0 >= 0) {
      return null;
    }

    let t = 0;
    let tPrev = 0;
    const probe = new THREE.Vector3();
    while (t < maxDist) {
      const step = Math.max(0.0035, Math.min(0.022, -d0 * 0.72));
      tPrev = t;
      t += step;
      probe.copy(interiorOrigin).addScaledVector(dir, t);
      const d = this.evaluate(probe.x, probe.y, probe.z);
      if (d >= 0) {
        let lo = tPrev;
        let hi = t;
        for (let b = 0; b < 9; b++) {
          const mid = (lo + hi) * 0.5;
          probe.copy(interiorOrigin).addScaledVector(dir, mid);
          if (this.evaluate(probe.x, probe.y, probe.z) < 0) lo = mid;
          else hi = mid;
        }
        const finalPt = interiorOrigin.clone().addScaledVector(dir, (lo + hi) * 0.5);
        const nArr = this.evaluateNormal(finalPt.x, finalPt.y, finalPt.z, 0.006);
        return {
          point: finalPt,
          normal: new THREE.Vector3(nArr[0], nArr[1], nArr[2]).normalize(),
        };
      }
      d0 = d;
    }
    return null;
  }
}

/**
 * Polygonizes an SdfFieldEvaluator into a watertight, smoothly-shaded, vertex-colored,
 * skin-weighted THREE.BufferGeometry using edge-indexed Marching Cubes.
 */
export function polygonizeSdfToGeometry(
  evaluator: SdfFieldEvaluator,
  boneCount: number,
  targetResolution: number,
  includePartMasks = false
): SdfMarchingCubesResult {
  const bounds = evaluator.bounds.clone();
  if (bounds.isEmpty()) {
    bounds.set(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1.5, 0.5));
  }
  const size = new THREE.Vector3();
  bounds.getSize(size);
  const maxDim = Math.max(0.25, size.x, size.y, size.z);
  const res = THREE.MathUtils.clamp(Math.round(targetResolution), 18, 80);

  // Uniform cubic voxel size preserves exact proportions without distortion
  const pad = maxDim * 0.08 + 0.05;
  bounds.expandByScalar(pad);
  bounds.getSize(size);
  const maxSpan = Math.max(size.x, size.y, size.z);
  const cellSize = maxSpan / res;

  const nx = Math.max(8, Math.ceil(size.x / cellSize) + 2);
  const ny = Math.max(8, Math.ceil(size.y / cellSize) + 2);
  const nz = Math.max(8, Math.ceil(size.z / cellSize) + 2);

  const originX = bounds.min.x - cellSize * 0.5;
  const originY = bounds.min.y - cellSize * 0.5;
  const originZ = bounds.min.z - cellSize * 0.5;

  const strideY = nx;
  const strideZ = nx * ny;
  const totalVoxels = nx * ny * nz;
  const field = new Float32Array(totalVoxels);

  // Sample SDF on grid
  for (let z = 0; z < nz; z++) {
    const wz = originZ + z * cellSize;
    const zOff = z * strideZ;
    for (let y = 0; y < ny; y++) {
      const wy = originY + y * cellSize;
      const yOff = zOff + y * strideY;
      for (let x = 0; x < nx; x++) {
        const wx = originX + x * cellSize;
        field[yOff + x] = evaluator.evaluate(wx, wy, wz);
      }
    }
  }

  // Deduplicated vertex storage keyed by edge ID:
  // edgeKey = (axis << 24) | (z * strideZ + y * strideY + x) -> safe up to ~16M cells
  const edgeVertexMap = new Map<number, number>();
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const skinIndices: number[] = [];
  const skinWeights: number[] = [];
  const indices: number[] = [];
  const partWeightsList: number[] | null = includePartMasks ? [] : null;
  const seamZonesList: number[] | null = includePartMasks ? [] : null;
  const seamGapsList: number[] | null = includePartMasks ? [] : null;
  const scratchPartW = includePartMasks ? new Uint8Array(CHARACTER_PART_KEYS.length) : undefined;

  const gradEps = Math.max(0.004, cellSize * 0.45);
  const tmpColor = new THREE.Color();

  const getOrCreateEdgeVertex = (
    axis: 0 | 1 | 2,
    ix: number,
    iy: number,
    iz: number,
    d0: number,
    d1: number
  ): number => {
    const baseIdx = iz * strideZ + iy * strideY + ix;
    const key = axis * 16_777_216 + baseIdx;
    const existing = edgeVertexMap.get(key);
    if (existing !== undefined) return existing;

    const denom = d1 - d0;
    const mu = Math.abs(denom) > 1e-7 ? THREE.MathUtils.clamp(-d0 / denom, 0, 1) : 0.5;

    const px = originX + (ix + (axis === 0 ? mu : 0)) * cellSize;
    const py = originY + (iy + (axis === 1 ? mu : 0)) * cellSize;
    const pz = originZ + (iz + (axis === 2 ? mu : 0)) * cellSize;

    const [nxv, nyv, nzv] = evaluator.evaluateNormal(px, py, pz, gradEps);
    const {
      color,
      skinIndices: si,
      skinWeights: sw,
      seamZone,
      seamGap,
    } = evaluator.evaluateColorAndWeights(px, py, pz, boneCount, scratchPartW, 0);

    const vIdx = positions.length / 3;
    positions.push(px, py, pz);
    normals.push(nxv, nyv, nzv);

    // Seamless symmetric UV projection (no back seam jump; smooth pole blend on crowns/shoulders)
    const radialXZ = Math.hypot(px, pz);
    const uAz = Math.abs(Math.atan2(px, pz)) / Math.PI;
    const uPlanar = 0.5 + THREE.MathUtils.clamp(px * 1.8, -0.5, 0.5);
    const poleBlend = THREE.MathUtils.smoothstep(radialXZ, 0.015, 0.08);
    const u = THREE.MathUtils.lerp(uPlanar, uAz, poleBlend);
    const v = (py - bounds.min.y) * 1.35 + (1 - poleBlend) * Math.abs(pz) * 0.6;
    uvs.push(u, v);

    // Store linear RGB for MeshStandardMaterial vertexColors
    tmpColor.setRGB(color[0], color[1], color[2], THREE.SRGBColorSpace);
    colors.push(tmpColor.r, tmpColor.g, tmpColor.b);

    skinIndices.push(si[0], si[1], si[2], si[3]);
    skinWeights.push(sw[0], sw[1], sw[2], sw[3]);

    if (partWeightsList && scratchPartW && seamZonesList && seamGapsList) {
      for (let k = 0; k < scratchPartW.length; k++) {
        partWeightsList.push(scratchPartW[k]);
      }
      seamZonesList.push(seamZone);
      seamGapsList.push(seamGap);
    }

    edgeVertexMap.set(key, vIdx);
    return vIdx;
  };

  const cellVerts = new Int32Array(12);

  for (let z = 0; z < nz - 1; z++) {
    const zOff = z * strideZ;
    for (let y = 0; y < ny - 1; y++) {
      const yOff = zOff + y * strideY;
      for (let x = 0; x < nx - 1; x++) {
        const q = yOff + x;
        const q1 = q + 1;
        const qy = q + strideY;
        const q1y = q1 + strideY;
        const qz = q + strideZ;
        const q1z = q1 + strideZ;
        const qyz = qy + strideZ;
        const q1yz = q1y + strideZ;

        const f0 = field[q];
        const f1 = field[q1];
        const f2 = field[qy];
        const f3 = field[q1y];
        const f4 = field[qz];
        const f5 = field[q1z];
        const f6 = field[qyz];
        const f7 = field[q1yz];

        let cubeindex = 0;
        if (f0 > 0) cubeindex |= 1;
        if (f1 > 0) cubeindex |= 2;
        if (f3 > 0) cubeindex |= 4;
        if (f2 > 0) cubeindex |= 8;
        if (f4 > 0) cubeindex |= 16;
        if (f5 > 0) cubeindex |= 32;
        if (f7 > 0) cubeindex |= 64;
        if (f6 > 0) cubeindex |= 128;

        const bits = edgeTable[cubeindex];
        if (bits === 0) continue;

        if (bits & 1) cellVerts[0] = getOrCreateEdgeVertex(0, x, y, z, f0, f1);
        if (bits & 2) cellVerts[1] = getOrCreateEdgeVertex(1, x + 1, y, z, f1, f3);
        if (bits & 4) cellVerts[2] = getOrCreateEdgeVertex(0, x, y + 1, z, f2, f3);
        if (bits & 8) cellVerts[3] = getOrCreateEdgeVertex(1, x, y, z, f0, f2);

        if (bits & 16) cellVerts[4] = getOrCreateEdgeVertex(0, x, y, z + 1, f4, f5);
        if (bits & 32) cellVerts[5] = getOrCreateEdgeVertex(1, x + 1, y, z + 1, f5, f7);
        if (bits & 64) cellVerts[6] = getOrCreateEdgeVertex(0, x, y + 1, z + 1, f6, f7);
        if (bits & 128) cellVerts[7] = getOrCreateEdgeVertex(1, x, y, z + 1, f4, f6);

        if (bits & 256) cellVerts[8] = getOrCreateEdgeVertex(2, x, y, z, f0, f4);
        if (bits & 512) cellVerts[9] = getOrCreateEdgeVertex(2, x + 1, y, z, f1, f5);
        if (bits & 1024) cellVerts[10] = getOrCreateEdgeVertex(2, x + 1, y + 1, z, f3, f7);
        if (bits & 2048) cellVerts[11] = getOrCreateEdgeVertex(2, x, y + 1, z, f2, f6);

        const row = cubeindex << 4;
        for (let i = 0; triTable[row + i] !== -1; i += 3) {
          const i0 = cellVerts[triTable[row + i]];
          const i1 = cellVerts[triTable[row + i + 1]];
          const i2 = cellVerts[triTable[row + i + 2]];
          if (i0 !== i1 && i1 !== i2 && i0 !== i2) {
            indices.push(i0, i1, i2);
          }
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return {
    geometry,
    vertexCount: positions.length / 3,
    triangleCount: indices.length / 3,
    bounds: geometry.boundingBox ? geometry.boundingBox.clone() : bounds,
    partWeights: partWeightsList ? new Uint8Array(partWeightsList) : undefined,
    seamZones: seamZonesList ? new Int16Array(seamZonesList) : undefined,
    seamGaps: seamGapsList ? new Float32Array(seamGapsList) : undefined,
  };
}
