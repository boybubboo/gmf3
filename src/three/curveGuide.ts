import * as THREE from 'three';
import type { CurveGuideConfig, CurveGuidePresetId } from '../types/maker';
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
