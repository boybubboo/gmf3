import * as THREE from 'three';
import type { CurveGuideConfig, CurveGuidePresetId, ObjectSplineConfig } from '../types/maker';
import { WORLD_TEX_TILE_METERS } from './buildingBlocks';

export function createCurvePresetPoints(
  preset: CurveGuidePresetId,
  opts?: {
    span?: number;
    bend?: number;
    height?: number;
    baseY?: number;
  }
): [number, number, number][] {
  const span = Math.max(0.6, opts?.span ?? 3.6);
  const bend = opts?.bend ?? 1.2;
  const height = opts?.height ?? 1.8;
  const y0 = opts?.baseY ?? 0.35;
  const half = span * 0.5;

  switch (preset) {
    case 'arc':
      return [
        [-half, y0, bend * 0.35],
        [-half * 0.45, y0, -bend * 0.35],
        [half * 0.45, y0, -bend * 0.35],
        [half, y0, bend * 0.35],
      ];
    case 'sCurve':
      return [
        [-half, y0, -bend * 0.55],
        [-half * 0.35, y0, bend * 0.65],
        [half * 0.35, y0, -bend * 0.65],
        [half, y0, bend * 0.55],
      ];
    case 'arch':
      return [
        [-half, 0.05, 0],
        [-half * 0.65, height * 0.72, 0],
        [0, height, 0],
        [half * 0.65, height * 0.72, 0],
        [half, 0.05, 0],
      ];
    case 'semiCircle': {
      const r = half;
      const pts: [number, number, number][] = [];
      for (let i = 0; i <= 4; i++) {
        const a = Math.PI - (i / 4) * Math.PI;
        pts.push([
          Number((Math.cos(a) * r).toFixed(3)),
          y0,
          Number((-Math.sin(a) * r * (bend >= 0 ? 1 : -1)).toFixed(3)),
        ]);
      }
      return pts;
    }
    case 'circle': {
      const r = half;
      const pts: [number, number, number][] = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        pts.push([
          Number((Math.cos(a) * r).toFixed(3)),
          y0,
          Number((Math.sin(a) * r).toFixed(3)),
        ]);
      }
      return pts;
    }
    case 'free':
    default:
      return [
        [-half, y0, 0],
        [0, y0, -bend * 0.5],
        [half, y0, 0],
      ];
  }
}

export function createDefaultCurveGuide(preset: CurveGuidePresetId = 'arc'): CurveGuideConfig {
  return {
    preset,
    points: createCurvePresetPoints(preset),
    closed: preset === 'circle',
    segments: preset === 'circle' ? 14 : 10,
    radius: 0.14,
    elevationArch: preset === 'arch' ? 1.8 : 0,
    alignToTangent: true,
  };
}

export function buildCurveInstance(cfg: CurveGuideConfig): THREE.CatmullRomCurve3 {
  const rawPts = (cfg.points.length >= 2 ? cfg.points : [[-1, 0.3, 0], [1, 0.3, 0]]).map(
    (p) => new THREE.Vector3(p[0], p[1], p[2])
  );
  // Apply optional extra arch lift across middle points when elevationArch is positive & non-arch
  const count = rawPts.length;
  const pts = rawPts.map((pt, i) => {
    if (cfg.preset !== 'arch' && Math.abs(cfg.elevationArch) > 0.01 && count >= 3) {
      const t = i / (count - 1);
      const lift = Math.sin(t * Math.PI) * cfg.elevationArch;
      return new THREE.Vector3(pt.x, pt.y + lift, pt.z);
    }
    return pt;
  });
  return new THREE.CatmullRomCurve3(pts, Boolean(cfg.closed), 'catmullrom', 0.5);
}

export interface CurveSampleTransform {
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  yawDeg: number;
  quaternion: THREE.Quaternion;
  eulerDeg: [number, number, number];
}

export function sampleCurveTransforms(
  cfg: CurveGuideConfig,
  count: number,
  flatGroundMode = false
): CurveSampleTransform[] {
  const curve = buildCurveInstance(cfg);
  const safeCount = Math.max(2, Math.min(48, Math.round(count)));
  const out: CurveSampleTransform[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  const forward = new THREE.Vector3(1, 0, 0);
  const rotMat = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler(0, 0, 0, 'XYZ');

  for (let i = 0; i < safeCount; i++) {
    const t = cfg.closed ? i / safeCount : safeCount === 1 ? 0.5 : i / (safeCount - 1);
    const position = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();

    if (flatGroundMode) {
      const yawRad = Math.atan2(-tangent.z, tangent.x);
      const yawDeg = Math.round(THREE.MathUtils.radToDeg(yawRad) * 10) / 10;
      const q = new THREE.Quaternion().setFromAxisAngle(up, yawRad);
      out.push({
        position,
        tangent,
        yawDeg,
        quaternion: q,
        eulerDeg: [0, yawDeg, 0],
      });
    } else if (cfg.alignToTangent) {
      // Align local +X along tangent, keep local +Y close to world up
      const xAxis = tangent.clone().normalize();
      let zAxis = new THREE.Vector3().crossVectors(xAxis, up);
      if (zAxis.lengthSq() < 1e-4) {
        zAxis = new THREE.Vector3(0, 0, 1);
      } else {
        zAxis.normalize();
      }
      const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
      rotMat.makeBasis(xAxis, yAxis, zAxis);
      quat.setFromRotationMatrix(rotMat);
      euler.setFromQuaternion(quat, 'XYZ');
      const yawDeg = Math.round(THREE.MathUtils.radToDeg(euler.y) * 10) / 10;
      out.push({
        position,
        tangent,
        yawDeg,
        quaternion: quat.clone(),
        eulerDeg: [
          Math.round(THREE.MathUtils.radToDeg(euler.x) * 10) / 10,
          yawDeg,
          Math.round(THREE.MathUtils.radToDeg(euler.z) * 10) / 10,
        ],
      });
    } else {
      out.push({
        position,
        tangent,
        yawDeg: 0,
        quaternion: forward.lengthSq() ? new THREE.Quaternion() : new THREE.Quaternion(),
        eulerDeg: [0, 0, 0],
      });
    }
  }

  return out;
}

/**
 * Generates a clean watertight swept mesh (round tube, chamfered square bar, or flat plank ribbon)
 * along a CurveGuideConfig with optional end caps and world-meter UVs.
 */
export function buildCurveSweepGeometry(
  cfg: CurveGuideConfig,
  profile: 'tube' | 'ribbon' | 'beveledBar',
  radius = 0.14,
  radialSegments = 14
): THREE.BufferGeometry {
  const curve = buildCurveInstance(cfg);
  const pathSteps = Math.max(12, Math.min(72, Math.round(cfg.segments * 3)));
  const r = Math.max(0.025, radius);

  let shape: THREE.Shape;
  if (profile === 'ribbon') {
    const hw = r * 1.4;
    const hh = r * 0.34;
    shape = new THREE.Shape();
    shape.moveTo(-hw, -hh);
    shape.lineTo(hw, -hh);
    shape.lineTo(hw, hh);
    shape.lineTo(-hw, hh);
    shape.closePath();
  } else if (profile === 'beveledBar') {
    const hw = r * 0.95;
    const ch = hw * 0.24;
    shape = new THREE.Shape();
    shape.moveTo(-hw + ch, -hw);
    shape.lineTo(hw - ch, -hw);
    shape.lineTo(hw, -hw + ch);
    shape.lineTo(hw, hw - ch);
    shape.lineTo(hw - ch, hw);
    shape.lineTo(-hw + ch, hw);
    shape.lineTo(-hw, hw - ch);
    shape.lineTo(-hw, -hw + ch);
    shape.closePath();
  } else {
    // Smooth circle
    shape = new THREE.Shape();
    const segs = Math.max(8, Math.min(24, radialSegments));
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
  }

  let geo: THREE.BufferGeometry;
  if (cfg.closed || profile !== 'tube') {
    geo = new THREE.ExtrudeGeometry(shape, {
      steps: pathSteps,
      bevelEnabled: false,
      extrudePath: curve,
    });
  } else {
    geo = new THREE.TubeGeometry(curve, pathSteps, r, Math.max(8, radialSegments), false);
  }

  geo.computeVertexNormals();
  // Lock UVs roughly to world-meter scale
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const norm = geo.attributes.normal as THREE.BufferAttribute;
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  if (pos && norm && uv) {
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const nx = Math.abs(norm.getX(i));
      const ny = Math.abs(norm.getY(i));
      const nz = Math.abs(norm.getZ(i));
      if (nz >= nx && nz >= ny) {
        uv.setXY(i, x / WORLD_TEX_TILE_METERS, y / WORLD_TEX_TILE_METERS);
      } else if (nx >= nz && nx >= ny) {
        uv.setXY(i, z / WORLD_TEX_TILE_METERS, y / WORLD_TEX_TILE_METERS);
      } else {
        uv.setXY(i, x / WORLD_TEX_TILE_METERS, z / WORLD_TEX_TILE_METERS);
      }
    }
    uv.needsUpdate = true;
  }

  return geo;
}

export function computeCurveLength(cfg: CurveGuideConfig): number {
  return buildCurveInstance(cfg).getLength();
}

/**
 * Computes smooth belly-preserving taper multiplier along u in [0, 1].
 * smoothStart / smoothEnd control how gradually the taper transitions from tip into the center belly.
 */
export function evaluateTaperScale(
  u: number,
  taperStart = 1,
  taperEnd = 1,
  smoothStart = 0.35,
  smoothEnd = 0.35
): number {
  const clampU = THREE.MathUtils.clamp(u, 0, 1);
  const zoneS = 0.06 + THREE.MathUtils.clamp(smoothStart, 0.04, 1) * 0.44;
  const zoneE = 0.06 + THREE.MathUtils.clamp(smoothEnd, 0.04, 1) * 0.44;
  const tS = THREE.MathUtils.clamp(1 - clampU / zoneS, 0, 1);
  const tE = THREE.MathUtils.clamp(1 - (1 - clampU) / zoneE, 0, 1);
  const eS = tS * tS * (3 - 2 * tS);
  const eE = tE * tE * (3 - 2 * tE);
  return Math.max(0.03, 1 + (taperStart - 1) * eS + (taperEnd - 1) * eE);
}

function buildCrossSectionRing(
  profile: ObjectSplineConfig['profile'],
  radialSegments: number,
  rx: number,
  ry: number
): [number, number][] {
  const segs = Math.max(6, Math.min(28, Math.round(radialSegments)));
  const pts: [number, number][] = [];
  if (profile === 'flatStave') {
    // Rounded-rectangle / D-shaped stave cross section (great for bows, scythes, blades, ribbons)
    const hw = rx * 1.15;
    const hh = ry;
    const corner = Math.min(hw, hh) * 0.32;
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const sx = Math.sign(ca);
      const sy = Math.sign(sa);
      const x = sx * Math.max(0, hw - corner) + ca * corner;
      const y = sy * Math.max(0, hh - corner) + sa * corner;
      // Blend toward smooth rounded stave perimeter
      const bx = sx * Math.pow(Math.abs(ca), 0.55) * hw;
      const by = sy * Math.pow(Math.abs(sa), 0.72) * hh;
      pts.push([bx * 0.7 + x * 0.3, by * 0.7 + y * 0.3]);
    }
    return pts;
  }
  if (profile === 'beveledBar') {
    const hw = rx * 0.96;
    const hh = ry * 0.96;
    const ch = 0.24;
    const raw: [number, number][] = [
      [hw, hh * (1 - ch)],
      [hw * (1 - ch), hh],
      [-hw * (1 - ch), hh],
      [-hw, hh * (1 - ch)],
      [-hw, -hh * (1 - ch)],
      [-hw * (1 - ch), -hh],
      [hw * (1 - ch), -hh],
      [hw, -hh * (1 - ch)],
    ];
    return raw;
  }
  // 'round' or 'oval'
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    pts.push([Math.cos(a) * rx, Math.sin(a) * ry]);
  }
  return pts;
}

/**
 * Generates a watertight, smoothly tapered swept mesh along a 3D spline using parallel-transport
 * frames so curves never twist-flip, with independent end tapers, falloff smoothness, and end caps.
 */
export function buildSplineTubeGeometry(cfg: ObjectSplineConfig): THREE.BufferGeometry {
  const rawPts =
    cfg.points && cfg.points.length >= 2
      ? cfg.points.map((p) => new THREE.Vector3(p[0], p[1], p[2]))
      : [new THREE.Vector3(0, -0.5, 0), new THREE.Vector3(0, 0.5, 0)];

  // Ensure non-zero curve even if points collapse onto each other
  const allEqual = rawPts.every((p) => p.distanceToSquared(rawPts[0]) < 1e-6);
  if (allEqual) {
    rawPts[rawPts.length - 1] = rawPts[0].clone().add(new THREE.Vector3(0, 0.25, 0));
  }

  const closed = Boolean(cfg.closed && rawPts.length >= 3);
  const curve = new THREE.CatmullRomCurve3(rawPts, closed, 'catmullrom', 0.5);
  const steps = Math.max(12, Math.min(80, Math.round(cfg.steps ?? Math.max(24, rawPts.length * 7))));
  const baseRadius = Math.max(0.004, cfg.radius ?? 0.06);
  const ovalRatio =
    cfg.profile === 'oval'
      ? THREE.MathUtils.clamp(cfg.ovalness ?? 0.6, 0.2, 2.0)
      : cfg.profile === 'flatStave'
      ? THREE.MathUtils.clamp(cfg.ovalness ?? 0.48, 0.18, 1.5)
      : 1.0;

  const baseRing = buildCrossSectionRing(
    cfg.profile ?? 'round',
    cfg.radialSegments ?? 14,
    1,
    ovalRatio
  );
  const ringCount = baseRing.length;

  // Sample centers & tangents
  const centers: THREE.Vector3[] = [];
  const tangents: THREE.Vector3[] = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    centers.push(curve.getPointAt(closed ? u % 1 : u));
    const tan = curve.getTangentAt(closed ? u % 1 : u);
    if (tan.lengthSq() < 1e-8) tan.set(0, 1, 0);
    else tan.normalize();
    tangents.push(tan);
  }

  // Parallel-transport (Bishop) frames to avoid Frenet flips on S-curves & inflection points
  const normals: THREE.Vector3[] = [];
  const binormals: THREE.Vector3[] = [];
  const t0 = tangents[0];
  const refVec =
    Math.abs(t0.dot(new THREE.Vector3(0, 0, 1))) < 0.9
      ? new THREE.Vector3(0, 0, 1)
      : new THREE.Vector3(1, 0, 0);
  const n0 = new THREE.Vector3().crossVectors(refVec, t0).normalize();
  const b0 = new THREE.Vector3().crossVectors(t0, n0).normalize();
  normals.push(n0);
  binormals.push(b0);

  const qRot = new THREE.Quaternion();
  for (let i = 1; i <= steps; i++) {
    qRot.setFromUnitVectors(tangents[i - 1], tangents[i]);
    const n = normals[i - 1].clone().applyQuaternion(qRot).normalize();
    // Re-orthogonalize against tangent
    n.addScaledVector(tangents[i], -n.dot(tangents[i]));
    if (n.lengthSq() < 1e-8) n.copy(normals[i - 1]);
    else n.normalize();
    const b = new THREE.Vector3().crossVectors(tangents[i], n).normalize();
    normals.push(n);
    binormals.push(b);
  }

  const pointRadii = cfg.pointRadii;
  const samplePointScale = (u: number): number => {
    if (!pointRadii || pointRadii.length === 0) return 1;
    if (pointRadii.length === 1) return Math.max(0.05, pointRadii[0]);
    const f = THREE.MathUtils.clamp(u, 0, 1) * (pointRadii.length - 1);
    const i0 = Math.floor(f);
    const i1 = Math.min(pointRadii.length - 1, i0 + 1);
    const frac = f - i0;
    return THREE.MathUtils.lerp(
      Math.max(0.05, pointRadii[i0] ?? 1),
      Math.max(0.05, pointRadii[i1] ?? 1),
      frac * frac * (3 - 2 * frac)
    );
  };

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const totalLen = Math.max(0.1, curve.getLength());

  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const taper = closed
      ? 1
      : evaluateTaperScale(
          u,
          cfg.taperStart ?? 1,
          cfg.taperEnd ?? 1,
          cfg.taperSmoothStart ?? 0.35,
          cfg.taperSmoothEnd ?? 0.35
        );
    const rHere = baseRadius * taper * samplePointScale(u);
    const c = centers[i];
    const n = normals[i];
    const b = binormals[i];

    for (let j = 0; j <= ringCount; j++) {
      const [rx, ry] = baseRing[j % ringCount];
      const vx = c.x + (n.x * rx + b.x * ry) * rHere;
      const vy = c.y + (n.y * rx + b.y * ry) * rHere;
      const vz = c.z + (n.z * rx + b.z * ry) * rHere;
      positions.push(vx, vy, vz);
      uvs.push(
        (j / ringCount) * (2 * Math.PI * Math.max(0.04, rHere)) / WORLD_TEX_TILE_METERS,
        (u * totalLen) / WORLD_TEX_TILE_METERS
      );
    }
  }

  const stride = ringCount + 1;
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < ringCount; j++) {
      const v00 = i * stride + j;
      const v01 = i * stride + (j + 1);
      const v10 = (i + 1) * stride + j;
      const v11 = (i + 1) * stride + (j + 1);
      indices.push(v00, v01, v11);
      indices.push(v00, v11, v10);
    }
  }

  // Watertight end caps for non-closed curves
  if (!closed) {
    const startCenterIdx = positions.length / 3;
    const cStart = centers[0];
    positions.push(cStart.x, cStart.y, cStart.z);
    uvs.push(0.5, 0.5);
    const startRingStart = positions.length / 3;
    for (let j = 0; j < ringCount; j++) {
      const src = j * 3;
      positions.push(positions[src], positions[src + 1], positions[src + 2]);
      uvs.push(0.5 + baseRing[j][0] * 0.25, 0.5 + baseRing[j][1] * 0.25);
    }
    for (let j = 0; j < ringCount; j++) {
      const nextJ = (j + 1) % ringCount;
      indices.push(startCenterIdx, startRingStart + nextJ, startRingStart + j);
    }

    const endCenterIdx = positions.length / 3;
    const cEnd = centers[steps];
    positions.push(cEnd.x, cEnd.y, cEnd.z);
    uvs.push(0.5, 0.5);
    const endRingStart = positions.length / 3;
    const lastRingBase = steps * stride;
    for (let j = 0; j < ringCount; j++) {
      const src = (lastRingBase + j) * 3;
      positions.push(positions[src], positions[src + 1], positions[src + 2]);
      uvs.push(0.5 + baseRing[j][0] * 0.25, 0.5 + baseRing[j][1] * 0.25);
    }
    for (let j = 0; j < ringCount; j++) {
      const nextJ = (j + 1) % ringCount;
      indices.push(endCenterIdx, endRingStart + j, endRingStart + nextJ);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

export function computeSplineLength(cfg: ObjectSplineConfig): number {
  const pts =
    cfg.points && cfg.points.length >= 2
      ? cfg.points.map((p) => new THREE.Vector3(p[0], p[1], p[2]))
      : [new THREE.Vector3(0, -0.5, 0), new THREE.Vector3(0, 0.5, 0)];
  if (pts.every((p) => p.distanceToSquared(pts[0]) < 1e-6)) return 0.25;
  return new THREE.CatmullRomCurve3(pts, Boolean(cfg.closed && pts.length >= 3)).getLength();
}

/**
 * Mirrors control points & per-point radii symmetrically across Y=0 (for vertical bow limbs)
 * or X=0 (for horizontal bars/horns) whenever mirrorSymmetry is enabled.
 */
export function applySplineSymmetryFromIndex(
  cfg: ObjectSplineConfig,
  editedIdx: number
): ObjectSplineConfig {
  const mode = cfg.mirrorSymmetry ?? 'none';
  if (mode === 'none' || cfg.points.length < 2) return cfg;
  const last = cfg.points.length - 1;
  const oppIdx = last - editedIdx;
  if (oppIdx < 0 || oppIdx >= cfg.points.length) return cfg;

  const src = cfg.points[editedIdx];
  const nextPoints = cfg.points.map((pt) => [...pt] as [number, number, number]);

  if (editedIdx === oppIdx) {
    // Center point sits cleanly on the symmetry plane
    nextPoints[editedIdx] =
      mode === 'y'
        ? [src[0], 0, src[2]]
        : [0, src[1], src[2]];
  } else {
    nextPoints[oppIdx] =
      mode === 'y'
        ? [src[0], Number((-src[1]).toFixed(3)), src[2]]
        : [Number((-src[0]).toFixed(3)), src[1], src[2]];
  }

  let nextRadii = cfg.pointRadii ? [...cfg.pointRadii] : undefined;
  if (nextRadii && nextRadii.length === cfg.points.length && oppIdx !== editedIdx) {
    nextRadii[oppIdx] = nextRadii[editedIdx];
  }

  return {
    ...cfg,
    points: nextPoints,
    ...(nextRadii ? { pointRadii: nextRadii } : {}),
  };
}
