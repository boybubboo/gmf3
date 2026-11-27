import * as THREE from 'three';
import type { CaveTunnelNode } from '../types/maker';

export interface CaveStrokePoint {
  x: number;
  z: number;
  radius: number;
  height: number;
  floorY?: number;
}

export interface LiveCavePreviewGeometries {
  centerlineGeo: THREE.BufferGeometry;
  vaultGeo: THREE.BufferGeometry;
  floorGeo: THREE.BufferGeometry;
  totalLength: number;
}

export interface CarvedCaveTunnelGeometries {
  rockWallGeo: THREE.BufferGeometry;
  rockFloorGeo: THREE.BufferGeometry;
  xRayVaultGeo: THREE.BufferGeometry;
  xRayFloorGeo: THREE.BufferGeometry;
  sampledFrames: Array<{
    x: number;
    y: number;
    z: number;
    tx: number;
    tz: number;
    rx: number;
    rz: number;
    radius: number;
    height: number;
    roofY: number;
    clearance: number;
  }>;
  totalLength: number;
}

function interpolateStrokeScalars(
  points: CaveStrokePoint[],
  cumDists: number[],
  totalDist: number,
  u: number
): { radius: number; height: number } {
  if (points.length === 1 || totalDist <= 0.001) {
    return { radius: points[0].radius, height: points[0].height };
  }
  const targetD = u * totalDist;
  for (let i = 1; i < cumDists.length; i++) {
    if (cumDists[i] >= targetD || i === cumDists.length - 1) {
      const segStart = cumDists[i - 1];
      const segLen = Math.max(0.0001, cumDists[i] - segStart);
      const localT = Math.max(0, Math.min(1, (targetD - segStart) / segLen));
      return {
        radius: points[i - 1].radius + (points[i].radius - points[i - 1].radius) * localT,
        height: points[i - 1].height + (points[i].height - points[i - 1].height) * localT,
      };
    }
  }
  const last = points[points.length - 1];
  return { radius: last.radius, height: last.height };
}

function buildCumDists(points: CaveStrokePoint[]): { cumDists: number[]; totalDist: number } {
  const cumDists: number[] = [0];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
    cumDists.push(total);
  }
  return { cumDists, totalDist: total };
}

/**
 * Smoothly resamples a raw pointer stroke into evenly spaced Catmull-Rom cave tunnel nodes.
 */
export function resampleCaveStrokePath(
  rawPoints: CaveStrokePoint[],
  maxNodes = 48
): CaveStrokePoint[] {
  if (rawPoints.length === 0) return [];
  if (rawPoints.length === 1) {
    return [{ ...rawPoints[0] }];
  }

  // Deduplicate very close consecutive points first
  const cleaned: CaveStrokePoint[] = [rawPoints[0]];
  for (let i = 1; i < rawPoints.length; i++) {
    const prev = cleaned[cleaned.length - 1];
    const cur = rawPoints[i];
    if (Math.hypot(cur.x - prev.x, cur.z - prev.z) >= 0.45) {
      cleaned.push(cur);
    }
  }
  if (cleaned.length === 1) {
    return [{ ...cleaned[0] }];
  }

  const { cumDists, totalDist } = buildCumDists(cleaned);
  if (totalDist < 0.75) {
    return [{ ...cleaned[0] }];
  }

  const avgRadius =
    cleaned.reduce((acc, p) => acc + p.radius, 0) / Math.max(1, cleaned.length);
  const targetSpacing = Math.max(2.0, avgRadius * 0.56);
  const segCount = Math.max(1, Math.min(maxNodes - 1, Math.round(totalDist / targetSpacing)));

  const ctrl = cleaned.map((p) => new THREE.Vector3(p.x, p.floorY ?? 0, p.z));
  const curve = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal', 0.5);
  const spaced = curve.getSpacedPoints(segCount);

  const result: CaveStrokePoint[] = [];
  for (let i = 0; i < spaced.length; i++) {
    const u = segCount > 0 ? i / segCount : 0;
    const { radius, height } = interpolateStrokeScalars(cleaned, cumDists, totalDist, u);
    const pt = spaced[i];
    result.push({
      x: Number(pt.x.toFixed(2)),
      z: Number(pt.z.toFixed(2)),
      floorY: cleaned[0].floorY !== undefined ? Number(pt.y.toFixed(2)) : undefined,
      radius: Number(radius.toFixed(2)),
      height: Number(height.toFixed(2)),
    });
  }
  return result;
}

function getClearanceRgb(clearance: number): [number, number, number] {
  if (clearance < 0.35) {
    // Open entrance / exit portal breaking cleanly through mountain exterior
    return [0.2, 0.88, 0.62];
  }
  if (clearance < 1.85) {
    // Thin rock skin near mountain surface
    return [0.96, 0.64, 0.14];
  }
  // Deep inside mountain
  return [0.22, 0.75, 0.98];
}

function createDomeChamberGeometry(
  cx: number,
  floorY: number,
  cz: number,
  rad: number,
  ceilH: number,
  radialSegs: number,
  rings: number,
  craggy: boolean,
  rgb?: [number, number, number]
): { vault: THREE.BufferGeometry; floor: THREE.BufferGeometry } {
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  for (let r = 0; r <= rings; r++) {
    const v = r / rings; // 0 = base ring, 1 = crown apex
    const phi = v * (Math.PI * 0.5);
    const cosP = Math.cos(phi);
    const sinP = Math.sin(phi);
    for (let s = 0; s <= radialSegs; s++) {
      const u = s / radialSegs;
      const theta = u * Math.PI * 2;
      const dx = Math.cos(theta) * cosP;
      const dz = Math.sin(theta) * cosP;
      let vx = cx + dx * rad;
      let vy = floorY + Math.pow(sinP, 0.88) * ceilH;
      let vz = cz + dz * rad;

      if (craggy && v > 0.06 && v < 0.98) {
        const crag =
          (Math.sin(vx * 0.95 + vy * 1.1) * 0.48 +
            Math.cos(vz * 0.88 - vy * 1.35) * 0.34 +
            Math.sin((vx + vz) * 1.85 + vy * 2.0) * 0.18) *
          (0.26 + rad * 0.045) *
          Math.sin(v * Math.PI);
        vx += dx * crag;
        vy += sinP * crag * 0.75;
        vz += dz * crag;
      }

      positions.push(vx, vy, vz);
      uvs.push(u * Math.max(2, rad * 0.75), v * 1.8);
      if (rgb) {
        colors.push(rgb[0], rgb[1], rgb[2]);
      } else {
        const ao = 0.58 + 0.42 * Math.pow(sinP, 0.6);
        colors.push(ao * 0.96, ao * 0.98, ao);
      }
    }
  }

  const stride = radialSegs + 1;
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < radialSegs; s++) {
      const a = r * stride + s;
      const b = a + 1;
      const c = (r + 1) * stride + s;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const vault = new THREE.BufferGeometry();
  vault.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  vault.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  vault.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  vault.setIndex(indices);
  vault.computeVertexNormals();

  // Floor disc
  const fPos: number[] = [cx, floorY - 0.04, cz];
  const fUv: number[] = [0.5, 0.5];
  const fCol: number[] = rgb ? [rgb[0], rgb[1], rgb[2]] : [0.76, 0.78, 0.82];
  const fIdx: number[] = [];
  for (let s = 0; s <= radialSegs; s++) {
    const theta = (s / radialSegs) * Math.PI * 2;
    fPos.push(cx + Math.cos(theta) * rad * 1.03, floorY - 0.04, cz + Math.sin(theta) * rad * 1.03);
    fUv.push(0.5 + Math.cos(theta) * 0.5, 0.5 + Math.sin(theta) * 0.5);
    if (rgb) {
      fCol.push(rgb[0], rgb[1], rgb[2]);
    } else {
      fCol.push(0.62, 0.65, 0.7);
    }
    if (s > 0) {
      fIdx.push(0, s + 1, s);
    }
  }
  const floor = new THREE.BufferGeometry();
  floor.setAttribute('position', new THREE.Float32BufferAttribute(fPos, 3));
  floor.setAttribute('uv', new THREE.Float32BufferAttribute(fUv, 2));
  floor.setAttribute('color', new THREE.Float32BufferAttribute(fCol, 3));
  floor.setIndex(fIdx);
  floor.computeVertexNormals();

  return { vault, floor };
}

/**
 * Ultra-fast (<0.3ms) live 3D tunnel spline & arched volume preview while the user drags the cave carver.
 */
export function buildLiveCavePreviewGeometry(
  points: CaveStrokePoint[],
  floorY: number,
  sampleRoofHeight: (x: number, z: number) => number
): LiveCavePreviewGeometries {
  if (points.length === 0) {
    return {
      centerlineGeo: new THREE.BufferGeometry(),
      vaultGeo: new THREE.BufferGeometry(),
      floorGeo: new THREE.BufferGeometry(),
      totalLength: 0,
    };
  }

  // Deduplicate tiny jitter
  const clean: CaveStrokePoint[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = clean[clean.length - 1];
    if (Math.hypot(points[i].x - prev.x, points[i].z - prev.z) >= 0.3) {
      clean.push(points[i]);
    }
  }

  const { cumDists, totalDist } = buildCumDists(clean);
  if (clean.length === 1 || totalDist < 0.6) {
    const p0 = clean[0];
    const roofY = sampleRoofHeight(p0.x, p0.z);
    const clearance = roofY - (floorY + p0.height);
    const rgb = getClearanceRgb(clearance);
    const chamber = createDomeChamberGeometry(p0.x, floorY, p0.z, p0.radius, p0.height, 14, 5, false, rgb);
    const centerlineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(p0.x, floorY + 0.25, p0.z),
      new THREE.Vector3(p0.x, floorY + p0.height * 0.35, p0.z + 0.01),
    ]);
    return {
      centerlineGeo,
      vaultGeo: chamber.vault,
      floorGeo: chamber.floor,
      totalLength: 0,
    };
  }

  const ctrl = clean.map((p) => new THREE.Vector3(p.x, floorY, p.z));
  const curve = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal', 0.5);
  const totalLength = curve.getLength();
  const numSteps = Math.max(8, Math.min(60, Math.ceil(totalLength / 1.45)));
  const archSegs = 6;

  const spinePts: THREE.Vector3[] = [];
  const vPos: number[] = [];
  const vCol: number[] = [];
  const vIdx: number[] = [];

  const fPos: number[] = [];
  const fCol: number[] = [];
  const fIdx: number[] = [];

  const sampled: Array<{
    x: number;
    z: number;
    rx: number;
    rz: number;
    rad: number;
    ceilH: number;
    rgb: [number, number, number];
  }> = [];

  for (let i = 0; i <= numSteps; i++) {
    const u = i / numSteps;
    const pos = curve.getPointAt(u);
    const tan = curve.getTangentAt(u);
    const tLen = Math.hypot(tan.x, tan.z) || 1;
    const tx = tan.x / tLen;
    const tz = tan.z / tLen;
    const rx = -tz;
    const rz = tx;
    const { radius: rad, height: ceilH } = interpolateStrokeScalars(clean, cumDists, totalDist, u);
    const roofY = sampleRoofHeight(pos.x, pos.z);
    const clearance = roofY - (floorY + ceilH);
    const rgb = getClearanceRgb(clearance);

    spinePts.push(new THREE.Vector3(pos.x, floorY + 0.28, pos.z));
    sampled.push({ x: pos.x, z: pos.z, rx, rz, rad, ceilH, rgb });

    // Arch cross section vertices
    for (let a = 0; a <= archSegs; a++) {
      const theta = (a / archSegs) * Math.PI;
      const lat = Math.cos(theta);
      const vert = Math.sin(theta);
      vPos.push(
        pos.x + rx * (lat * rad),
        floorY + Math.pow(vert, 0.86) * ceilH,
        pos.z + rz * (lat * rad)
      );
      vCol.push(rgb[0], rgb[1], rgb[2]);
    }

    // Floor ribbon left & right vertices
    fPos.push(pos.x + rx * rad, floorY + 0.08, pos.z + rz * rad);
    fCol.push(rgb[0], rgb[1], rgb[2]);
    fPos.push(pos.x - rx * rad, floorY + 0.08, pos.z - rz * rad);
    fCol.push(rgb[0], rgb[1], rgb[2]);
  }

  const archStride = archSegs + 1;
  for (let i = 0; i < numSteps; i++) {
    for (let a = 0; a < archSegs; a++) {
      const p00 = i * archStride + a;
      const p01 = p00 + 1;
      const p10 = (i + 1) * archStride + a;
      const p11 = p10 + 1;
      vIdx.push(p00, p10, p01, p01, p10, p11);
    }
    const f0 = i * 2;
    fIdx.push(f0, f0 + 2, f0 + 1, f0 + 1, f0 + 2, f0 + 3);
  }

  // Add rounded end semicircles to floor ribbon so tips look crisp
  const addFloorCap = (idx: number, sign: 1 | -1) => {
    const s = sampled[idx];
    const tx = s.rz * sign;
    const tz = -s.rx * sign;
    const centerIdx = fPos.length / 3;
    fPos.push(s.x, floorY + 0.08, s.z);
    fCol.push(s.rgb[0], s.rgb[1], s.rgb[2]);
    const capSegs = 8;
    for (let c = 0; c <= capSegs; c++) {
      const ang = (c / capSegs) * Math.PI;
      const lx = Math.cos(ang) * s.rad;
      const lz = Math.sin(ang) * s.rad;
      fPos.push(s.x + s.rx * lx + tx * lz, floorY + 0.08, s.z + s.rz * lx + tz * lz);
      fCol.push(s.rgb[0], s.rgb[1], s.rgb[2]);
      if (c > 0) {
        fIdx.push(centerIdx, centerIdx + c, centerIdx + c + 1);
      }
    }
  };
  addFloorCap(0, -1);
  addFloorCap(sampled.length - 1, 1);

  const centerlineGeo = new THREE.BufferGeometry().setFromPoints(spinePts);

  const vaultGeo = new THREE.BufferGeometry();
  vaultGeo.setAttribute('position', new THREE.Float32BufferAttribute(vPos, 3));
  vaultGeo.setAttribute('color', new THREE.Float32BufferAttribute(vCol, 3));
  vaultGeo.setIndex(vIdx);
  vaultGeo.computeVertexNormals();

  const floorGeo = new THREE.BufferGeometry();
  floorGeo.setAttribute('position', new THREE.Float32BufferAttribute(fPos, 3));
  floorGeo.setAttribute('color', new THREE.Float32BufferAttribute(fCol, 3));
  floorGeo.setIndex(fIdx);
  floorGeo.computeVertexNormals();

  return { centerlineGeo, vaultGeo, floorGeo, totalLength };
}

/**
 * Builds continuous, organically sculpted rocky tunnel shell, walkable stone floor,
 * and unified X-Ray overlay geometry along a cave's `tunnelNodes`.
 */
export function buildCarvedCaveTunnelGeometry(
  nodes: CaveTunnelNode[],
  baseFloorY: number,
  sampleRoofHeight: (x: number, z: number) => number
): CarvedCaveTunnelGeometries {
  if (nodes.length === 0) {
    return {
      rockWallGeo: new THREE.BufferGeometry(),
      rockFloorGeo: new THREE.BufferGeometry(),
      xRayVaultGeo: new THREE.BufferGeometry(),
      xRayFloorGeo: new THREE.BufferGeometry(),
      sampledFrames: [],
      totalLength: 0,
    };
  }

  const pts: CaveStrokePoint[] = nodes.map((n) => ({
    x: n.x,
    z: n.z,
    floorY: baseFloorY,
    radius: Math.max(2.0, n.radius || 3.4),
    height: Math.max(2.8, n.height || 4.2),
  }));

  const { cumDists, totalDist } = buildCumDists(pts);
  if (pts.length === 1 || totalDist < 0.75) {
    const p0 = pts[0];
    const roofY = sampleRoofHeight(p0.x, p0.z);
    const clearance = roofY - (baseFloorY + p0.height);
    const rgb = getClearanceRgb(clearance);
    const rockChamber = createDomeChamberGeometry(
      p0.x,
      baseFloorY,
      p0.z,
      p0.radius,
      p0.height,
      18,
      7,
      true
    );
    const xRayChamber = createDomeChamberGeometry(
      p0.x,
      baseFloorY,
      p0.z,
      p0.radius * 0.98,
      p0.height * 0.98,
      14,
      5,
      false,
      rgb
    );
    return {
      rockWallGeo: rockChamber.vault,
      rockFloorGeo: rockChamber.floor,
      xRayVaultGeo: xRayChamber.vault,
      xRayFloorGeo: xRayChamber.floor,
      sampledFrames: [
        {
          x: p0.x,
          y: baseFloorY,
          z: p0.z,
          tx: 0,
          tz: 1,
          rx: -1,
          rz: 0,
          radius: p0.radius,
          height: p0.height,
          roofY,
          clearance,
        },
      ],
      totalLength: 0,
    };
  }

  const ctrl = pts.map((p) => new THREE.Vector3(p.x, baseFloorY, p.z));
  const curve = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal', 0.5);
  const totalLength = curve.getLength();
  const numSteps = Math.max(12, Math.min(92, Math.ceil(totalLength / 1.15)));
  const rockArchSegs = 12;
  const xRayArchSegs = 7;

  const sampledFrames: CarvedCaveTunnelGeometries['sampledFrames'] = [];
  for (let i = 0; i <= numSteps; i++) {
    const u = i / numSteps;
    const pos = curve.getPointAt(u);
    const tan = curve.getTangentAt(u);
    const tLen = Math.hypot(tan.x, tan.z) || 1;
    const tx = tan.x / tLen;
    const tz = tan.z / tLen;
    const rx = -tz;
    const rz = tx;
    const { radius, height } = interpolateStrokeScalars(pts, cumDists, totalDist, u);
    const roofY = sampleRoofHeight(pos.x, pos.z);
    const clearance = roofY - (baseFloorY + height);
    sampledFrames.push({
      x: pos.x,
      y: baseFloorY,
      z: pos.z,
      tx,
      tz,
      rx,
      rz,
      radius,
      height,
      roofY,
      clearance,
    });
  }

  // 1. Sculpted Organic Rock Tunnel Shell + Dead-end Caps (when buried inside mountain)
  const wPos: number[] = [];
  const wUv: number[] = [];
  const wCol: number[] = [];
  const wIdx: number[] = [];

  for (let i = 0; i <= numSteps; i++) {
    const f = sampledFrames[i];
    const u = i / numSteps;
    const distAlong = u * totalLength;
    for (let a = 0; a <= rockArchSegs; a++) {
      const v = a / rockArchSegs;
      const theta = v * Math.PI;
      const lat = Math.cos(theta);
      const vert = Math.sin(theta);
      // Slight organic cavern taper: wider shoulder, natural vaulted crown
      const radScale = 1.0 + Math.sin(theta * 2) * 0.04;
      let vx = f.x + f.rx * (lat * f.radius * radScale);
      let vy = f.y - 0.14 + Math.pow(vert, 0.84) * (f.height + 0.14);
      let vz = f.z + f.rz * (lat * f.radius * radScale);

      // Deterministic 3D craggy rock relief along the tunnel walls & ceiling
      const edgeFade = Math.min(1, vert * 5.0);
      const crag =
        (Math.sin(vx * 0.78 + vy * 1.05 + distAlong * 0.35) * 0.45 +
          Math.cos(vz * 0.84 - vy * 1.28) * 0.35 +
          Math.sin((vx - vz) * 1.75 + vy * 2.15) * 0.2) *
        (0.28 + f.radius * 0.05) *
        edgeFade;
      vx += f.rx * lat * crag;
      vy += vert * crag * 0.72;
      vz += f.rz * lat * crag;

      wPos.push(vx, vy, vz);
      wUv.push(distAlong * 0.2, v * 2.4);

      // Natural subterranean AO & subtle mossy/damp rock variation
      const floorAo = 0.56 + 0.44 * Math.pow(vert, 0.55);
      const mossTint = vert > 0.12 && vert < 0.48 ? 0.05 : 0;
      const rockVar = 0.92 + Math.sin(vx * 0.5 + vz * 0.5) * 0.08;
      wCol.push(
        floorAo * rockVar * (1 - mossTint * 0.5),
        floorAo * rockVar * (1 + mossTint),
        floorAo * rockVar * (1 - mossTint * 0.3)
      );
    }
  }

  const wStride = rockArchSegs + 1;
  for (let i = 0; i < numSteps; i++) {
    for (let a = 0; a < rockArchSegs; a++) {
      const p00 = i * wStride + a;
      const p01 = p00 + 1;
      const p10 = (i + 1) * wStride + a;
      const p11 = p10 + 1;
      wIdx.push(p00, p10, p01, p01, p10, p11);
    }
  }

  // Add sculpted rocky end-cap ONLY when the tunnel end stays buried inside the mountain!
  // (When it breaks near/outside the mountain skin, leave the portal cleanly open!)
  const appendRockEndCap = (frameIdx: number, outwardSign: 1 | -1) => {
    const f = sampledFrames[frameIdx];
    const endClearance = f.roofY - (f.y + f.height * 0.65);
    if (endClearance < 0.75) return; // open portal!
    const capRings = 4;
    const baseVertex = wPos.length / 3;
    for (let r = 0; r <= capRings; r++) {
      const t = r / capRings; // 0 = rim, 1 = back wall center
      const ringScale = Math.cos(t * Math.PI * 0.5);
      const depthOff = Math.sin(t * Math.PI * 0.5) * (f.radius * 0.85) * outwardSign;
      for (let a = 0; a <= rockArchSegs; a++) {
        const v = a / rockArchSegs;
        const theta = v * Math.PI;
        const lat = Math.cos(theta) * ringScale;
        const vert = Math.sin(theta) * ringScale;
        let vx = f.x + f.rx * (lat * f.radius) + f.tx * depthOff;
        let vy = f.y - 0.14 + Math.pow(Math.max(0, vert), 0.86) * (f.height + 0.14);
        let vz = f.z + f.rz * (lat * f.radius) + f.tz * depthOff;
        const crag =
          Math.sin(vx * 0.9 + vy * 1.1) * Math.cos(vz * 0.9) * 0.24 * (1 - t * 0.4);
        vx += f.tx * outwardSign * crag;
        vz += f.tz * outwardSign * crag;
        wPos.push(vx, vy, vz);
        wUv.push(t * 1.4, v * 2.4);
        const ao = 0.52 + 0.36 * Math.max(0, vert);
        wCol.push(ao, ao * 1.02, ao * 1.04);
      }
    }
    for (let r = 0; r < capRings; r++) {
      for (let a = 0; a < rockArchSegs; a++) {
        const p00 = baseVertex + r * wStride + a;
        const p01 = p00 + 1;
        const p10 = baseVertex + (r + 1) * wStride + a;
        const p11 = p10 + 1;
        if (outwardSign > 0) {
          wIdx.push(p00, p10, p01, p01, p10, p11);
        } else {
          wIdx.push(p00, p01, p10, p01, p11, p10);
        }
      }
    }
  };
  // Never cap the entrance portal at index 0 unless it's buried deep without an opening;
  // cap the deep interior end cleanly so the cavern terminates in natural solid rock!
  appendRockEndCap(0, -1);
  appendRockEndCap(sampledFrames.length - 1, 1);

  const rockWallGeo = new THREE.BufferGeometry();
  rockWallGeo.setAttribute('position', new THREE.Float32BufferAttribute(wPos, 3));
  rockWallGeo.setAttribute('uv', new THREE.Float32BufferAttribute(wUv, 2));
  rockWallGeo.setAttribute('color', new THREE.Float32BufferAttribute(wCol, 3));
  rockWallGeo.setIndex(wIdx);
  rockWallGeo.computeVertexNormals();

  // 2. Continuous Walkable Stone Floor Ribbon (with subtle recess near entrances to prevent Z-fighting)
  const rfPos: number[] = [];
  const rfUv: number[] = [];
  const rfCol: number[] = [];
  const rfIdx: number[] = [];

  for (let i = 0; i <= numSteps; i++) {
    const f = sampledFrames[i];
    const u = i / numSteps;
    const distAlong = u * totalLength;
    const nearMouth = f.roofY - f.y < 1.35;
    const yFloor = f.y + (nearMouth ? -0.14 : -0.045);
    const halfW = f.radius * 1.06;

    // 3 vertices across floor (right, center, left) for gentle concave path feel & crisp lighting
    rfPos.push(f.x + f.rx * halfW, yFloor + 0.03, f.z + f.rz * halfW);
    rfUv.push(distAlong * 0.22, 0);
    rfCol.push(0.64, 0.67, 0.72);

    rfPos.push(f.x, yFloor, f.z);
    rfUv.push(distAlong * 0.22, 0.5);
    rfCol.push(0.84, 0.86, 0.9);

    rfPos.push(f.x - f.rx * halfW, yFloor + 0.03, f.z - f.rz * halfW);
    rfUv.push(distAlong * 0.22, 1);
    rfCol.push(0.64, 0.67, 0.72);
  }

  for (let i = 0; i < numSteps; i++) {
    const r0 = i * 3;
    const r1 = (i + 1) * 3;
    rfIdx.push(r0, r1, r0 + 1, r0 + 1, r1, r1 + 1);
    rfIdx.push(r0 + 1, r1 + 1, r0 + 2, r0 + 2, r1 + 1, r1 + 2);
  }

  const rockFloorGeo = new THREE.BufferGeometry();
  rockFloorGeo.setAttribute('position', new THREE.Float32BufferAttribute(rfPos, 3));
  rockFloorGeo.setAttribute('uv', new THREE.Float32BufferAttribute(rfUv, 2));
  rockFloorGeo.setAttribute('color', new THREE.Float32BufferAttribute(rfCol, 3));
  rockFloorGeo.setIndex(rfIdx);
  rockFloorGeo.computeVertexNormals();

  // 3. Unified Continuous X-Ray See-Through Vault & Floor Ribbon (2 draw calls total!)
  const xrPos: number[] = [];
  const xrCol: number[] = [];
  const xrIdx: number[] = [];

  const xfPos: number[] = [];
  const xfCol: number[] = [];
  const xfIdx: number[] = [];

  for (let i = 0; i <= numSteps; i++) {
    const f = sampledFrames[i];
    const rgb = getClearanceRgb(f.clearance);
    for (let a = 0; a <= xRayArchSegs; a++) {
      const theta = (a / xRayArchSegs) * Math.PI;
      const lat = Math.cos(theta);
      const vert = Math.sin(theta);
      xrPos.push(
        f.x + f.rx * (lat * f.radius * 0.97),
        f.y + Math.pow(vert, 0.86) * f.height,
        f.z + f.rz * (lat * f.radius * 0.97)
      );
      xrCol.push(rgb[0], rgb[1], rgb[2]);
    }
    xfPos.push(f.x + f.rx * (f.radius * 0.94), f.y + 0.09, f.z + f.rz * (f.radius * 0.94));
    xfCol.push(rgb[0], rgb[1], rgb[2]);
    xfPos.push(f.x - f.rx * (f.radius * 0.94), f.y + 0.09, f.z - f.rz * (f.radius * 0.94));
    xfCol.push(rgb[0], rgb[1], rgb[2]);
  }

  const xrStride = xRayArchSegs + 1;
  for (let i = 0; i < numSteps; i++) {
    for (let a = 0; a < xRayArchSegs; a++) {
      const p00 = i * xrStride + a;
      const p01 = p00 + 1;
      const p10 = (i + 1) * xrStride + a;
      const p11 = p10 + 1;
      xrIdx.push(p00, p10, p01, p01, p10, p11);
    }
    const f0 = i * 2;
    xfIdx.push(f0, f0 + 2, f0 + 1, f0 + 1, f0 + 2, f0 + 3);
  }

  const xRayVaultGeo = new THREE.BufferGeometry();
  xRayVaultGeo.setAttribute('position', new THREE.Float32BufferAttribute(xrPos, 3));
  xRayVaultGeo.setAttribute('color', new THREE.Float32BufferAttribute(xrCol, 3));
  xRayVaultGeo.setIndex(xrIdx);
  xRayVaultGeo.computeVertexNormals();

  const xRayFloorGeo = new THREE.BufferGeometry();
  xRayFloorGeo.setAttribute('position', new THREE.Float32BufferAttribute(xfPos, 3));
  xRayFloorGeo.setAttribute('color', new THREE.Float32BufferAttribute(xfCol, 3));
  xRayFloorGeo.setIndex(xfIdx);
  xRayFloorGeo.computeVertexNormals();

  return {
    rockWallGeo,
    rockFloorGeo,
    xRayVaultGeo,
    xRayFloorGeo,
    sampledFrames,
    totalLength,
  };
}
