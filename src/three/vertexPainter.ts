import * as THREE from 'three';
import {
  attribute,
  materialColor,
  materialOpacity,
  materialRoughness,
  vec4,
  vertexColor,
} from 'three/tsl';
import {
  applyDegradeLayersTsl,
  applyDegradeRoughnessTsl,
  applyHsvShiftLinearTsl,
  upgradeToNodeMaterial,
} from './nodeMaterialUtils';
import type {
  VertexPaintMode,
  VertexPaintStroke,
  VertexPaintTarget,
  WeatheringPreset,
} from '../types/maker';

export interface VertexPaintBrushSettings {
  radius: number;
  opacity: number;
  softness: number;
  mode: VertexPaintMode;
  target: VertexPaintTarget;
  color: string;
  hueShift: number; // -180..+180 degrees
  saturationShift: number; // -0.8..+0.8
  valueShift: number; // -0.5..+0.5
  hueJitter: number; // 0..90 degrees
  degradeForm?: WeatheringPreset;
  degradeChipDepth?: number; // 0..1
}

// Reusable math scratch objects (zero GC during live pointer-move brushing)
const _invRootMat = new THREE.Matrix4();
const _meshToRootMat = new THREE.Matrix4();
const _vPos = new THREE.Vector3();
const _srgbA = { r: 0, g: 0, b: 0 };
const _srgbB = { r: 0, g: 0, b: 0 };
const _cTmp = new THREE.Color();
const _cCurr = new THREE.Color();
const _cTarget = new THREE.Color();
const _cBase = new THREE.Color();
const _hslTmp = { h: 0, s: 0, l: 0 };

function hashVertex3(x: number, y: number, z: number, seed: number): number {
  const xi = Math.round(x * 1000);
  const yi = Math.round(y * 1000);
  const zi = Math.round(z * 1000);
  let h = (seed | 0) ^ Math.imul(xi, 374761393) ^ Math.imul(yi, 668265263) ^ Math.imul(zi, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Smooth spatial 3D wave noise in [-1..+1] for organic painterly foliage/bark mottling.
 */
function organicSpatialNoise(x: number, y: number, z: number, seed: number): number {
  const s = (seed % 997) * 0.013;
  const n1 = Math.sin(x * 3.1 + s) * Math.cos(y * 3.7 - s * 0.7) * Math.sin(z * 2.9 + s * 1.1);
  const n2 = Math.sin(x * 7.3 - z * 6.1 + s * 2.3) * Math.cos(y * 6.7 + x * 4.2);
  return THREE.MathUtils.clamp(n1 * 0.65 + n2 * 0.35, -1, 1);
}

/**
 * Shifts a hex color in sRGB HSL space by hue degrees, saturation delta, and lightness delta.
 */
export function computeShiftedHexColor(
  hex: string,
  hueShiftDeg: number,
  satShift = 0,
  valShift = 0
): string {
  const c = new THREE.Color(hex);
  c.getHSL(_hslTmp, THREE.SRGBColorSpace);
  const nh = (((_hslTmp.h + hueShiftDeg / 360) % 1) + 1) % 1;
  const ns = THREE.MathUtils.clamp(_hslTmp.s + satShift, 0, 1);
  const nl = THREE.MathUtils.clamp(_hslTmp.l + valShift * 0.55, 0.04, 0.96);
  c.setHSL(nh, ns, nl, THREE.SRGBColorSpace);
  return `#${c.getHexString()}`;
}

type AnyVertexAttr = THREE.BufferAttribute | THREE.InterleavedBufferAttribute;

/**
 * Ensures a BufferGeometry has mutable `color` (RGB linear), `aPaintHsv` (hue, sat, val),
 * and multi-form weathering/degradation attributes (`aDegrade0`, `aDegrade1`, `aDegradeWet`)
 * packed into a SINGLE `THREE.InterleavedBuffer` (stride = 15 floats) so skinned & UV-mapped
 * meshes never exceed WebGPU's 8-vertex-buffer hardware limit, plus immutable baseline
 * snapshots for non-destructive erasing.
 */
export function ensureGeometryVertexPaintAttributes(geo: THREE.BufferGeometry): void {
  const pos = geo.attributes.position as AnyVertexAttr | undefined;
  if (!pos) return;
  const count = pos.count;

  if (!geo.attributes.normal) {
    geo.computeVertexNormals();
  }
  const norm = geo.attributes.normal as AnyVertexAttr | undefined;

  const existingCol = geo.attributes.color as AnyVertexAttr | undefined;
  const existingHsv = geo.attributes.aPaintHsv as AnyVertexAttr | undefined;
  const existingDeg0 = geo.attributes.aDegrade0 as AnyVertexAttr | undefined;
  const existingDeg1 = geo.attributes.aDegrade1 as AnyVertexAttr | undefined;
  const existingDegWet = geo.attributes.aDegradeWet as AnyVertexAttr | undefined;

  const isAlreadyPacked =
    geo.userData._vpPackedInterleaved === true &&
    existingCol instanceof THREE.InterleavedBufferAttribute &&
    existingHsv instanceof THREE.InterleavedBufferAttribute &&
    existingDeg0 instanceof THREE.InterleavedBufferAttribute &&
    existingDeg1 instanceof THREE.InterleavedBufferAttribute &&
    existingDegWet instanceof THREE.InterleavedBufferAttribute &&
    existingCol.data === existingHsv.data &&
    existingHsv.data === existingDeg0.data &&
    existingDeg0.data === existingDeg1.data &&
    existingDeg1.data === existingDegWet.data &&
    existingHsv.data.stride === 15 &&
    existingHsv.count === count;

  let colAttr: AnyVertexAttr;
  let hsvAttr: AnyVertexAttr;

  if (isAlreadyPacked) {
    colAttr = existingCol;
    hsvAttr = existingHsv;
  } else {
    const packed = new Float32Array(count * 15);
    const hasCol = Boolean(existingCol && existingCol.count === count && existingCol.itemSize >= 3);
    const hasHsv = Boolean(existingHsv && existingHsv.count === count && existingHsv.itemSize >= 3);
    const hasDeg0 = Boolean(existingDeg0 && existingDeg0.count === count && existingDeg0.itemSize >= 4);
    const hasDeg1 = Boolean(existingDeg1 && existingDeg1.count === count && existingDeg1.itemSize >= 4);
    const hasDegWet = Boolean(existingDegWet && existingDegWet.count === count && existingDegWet.itemSize >= 1);

    for (let i = 0; i < count; i++) {
      const o = i * 15;
      if (hasCol && existingCol) {
        packed[o] = existingCol.getX(i);
        packed[o + 1] = existingCol.getY(i);
        packed[o + 2] = existingCol.getZ(i);
      } else {
        packed[o] = 1.0;
        packed[o + 1] = 1.0;
        packed[o + 2] = 1.0;
      }
      if (hasHsv && existingHsv) {
        packed[o + 3] = existingHsv.getX(i);
        packed[o + 4] = existingHsv.getY(i);
        packed[o + 5] = existingHsv.getZ(i);
      }
      if (hasDeg0 && existingDeg0) {
        packed[o + 6] = existingDeg0.getX(i);
        packed[o + 7] = existingDeg0.getY(i);
        packed[o + 8] = existingDeg0.getZ(i);
        packed[o + 9] = existingDeg0.getW(i);
      }
      if (hasDeg1 && existingDeg1) {
        packed[o + 10] = existingDeg1.getX(i);
        packed[o + 11] = existingDeg1.getY(i);
        packed[o + 12] = existingDeg1.getZ(i);
        packed[o + 13] = existingDeg1.getW(i);
      }
      if (hasDegWet && existingDegWet) {
        packed[o + 14] = existingDegWet.getX(i);
      }
    }

    const ib = new THREE.InterleavedBuffer(packed, 15);
    colAttr = new THREE.InterleavedBufferAttribute(ib, 3, 0, false);
    hsvAttr = new THREE.InterleavedBufferAttribute(ib, 3, 3, false);
    const deg0Attr = new THREE.InterleavedBufferAttribute(ib, 4, 6, false);
    const deg1Attr = new THREE.InterleavedBufferAttribute(ib, 4, 10, false);
    const degWetAttr = new THREE.InterleavedBufferAttribute(ib, 1, 14, false);

    geo.setAttribute('color', colAttr);
    geo.setAttribute('aPaintHsv', hsvAttr);
    geo.setAttribute('aDegrade0', deg0Attr);
    geo.setAttribute('aDegrade1', deg1Attr);
    geo.setAttribute('aDegradeWet', degWetAttr);
    geo.userData._vpPackedInterleaved = true;
  }

  if (!geo.userData.vpBaseColors) {
    const snap = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      snap[i * 3] = colAttr.getX(i);
      snap[i * 3 + 1] = colAttr.getY(i);
      snap[i * 3 + 2] = colAttr.getZ(i);
    }
    geo.userData.vpBaseColors = snap;
  }
  if (!geo.userData.vpBaseHsv) {
    const snap = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      snap[i * 3] = hsvAttr.getX(i);
      snap[i * 3 + 1] = hsvAttr.getY(i);
      snap[i * 3 + 2] = hsvAttr.getZ(i);
    }
    geo.userData.vpBaseHsv = snap;
  }
  if (!geo.userData.vpBasePositions) {
    if (pos instanceof THREE.BufferAttribute && pos.array instanceof Float32Array) {
      geo.userData.vpBasePositions = new Float32Array(pos.array);
    } else {
      const snap = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        snap[i * 3] = pos.getX(i);
        snap[i * 3 + 1] = pos.getY(i);
        snap[i * 3 + 2] = pos.getZ(i);
      }
      geo.userData.vpBasePositions = snap;
    }
  }
  if (!geo.userData.vpBaseNormals && norm) {
    if (norm instanceof THREE.BufferAttribute && norm.array instanceof Float32Array) {
      geo.userData.vpBaseNormals = new Float32Array(norm.array);
    } else {
      const snap = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        snap[i * 3] = norm.getX(i);
        snap[i * 3 + 1] = norm.getY(i);
        snap[i * 3 + 2] = norm.getZ(i);
      }
      geo.userData.vpBaseNormals = snap;
    }
  }
  if (typeof geo.userData.vpGeoScale !== 'number') {
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    if (bb) {
      const sz = new THREE.Vector3();
      bb.getSize(sz);
      geo.userData.vpGeoScale = Math.max(0.25, Math.min(sz.x || 1, sz.y || 1, sz.z || 1, 2.5));
    } else {
      geo.userData.vpGeoScale = 1.0;
    }
  }
}

/**
 * Upgrades/patches any standard/toon/physical/basic material with per-vertex `aPaintHsv`
 * and multi-form `aDegrade0`/`aDegrade1`/`aDegradeWet` TSL shaders so Hue Shift, Color,
 * and Weathering/Degrader painting preserve underlying bark, wood, stone, or uploaded textures
 * natively under WebGPURenderer!
 */
export function enableVertexPaintHsvOnMaterial(mat: THREE.Material): THREE.Material {
  if (!mat) return mat;

  // Materials already patched by patchCanopyMaterial with enableVertexPaintHsv already support aPaintHsv + degrade
  if (mat.userData.hasVertexPaintHsv) {
    if ('vertexColors' in mat) {
      const std = mat as THREE.MeshStandardMaterial;
      if (!std.vertexColors && !mat.userData._vpBakedVertexColors) {
        std.vertexColors = true;
        std.needsUpdate = true;
      }
    }
    return mat;
  }

  const nodeMat = upgradeToNodeMaterial(mat);
  nodeMat.userData.hasVertexPaintHsv = true;
  nodeMat.userData._vpBakedVertexColors = true;
  // Fold vertex color inside colorNode before HSV shift so diffuse * vertexColor is HSV-shifted once
  nodeMat.vertexColors = false;

  const vPaintHsv = attribute('aPaintHsv', 'vec3');
  const vDeg0 = attribute('aDegrade0', 'vec4');
  const vDeg1 = attribute('aDegrade1', 'vec4');
  const vDegWet = attribute('aDegradeWet', 'float');

  const combinedRgb = materialColor.rgb.mul(vertexColor().rgb);
  const shiftedRgb = applyHsvShiftLinearTsl(combinedRgb, vPaintHsv);
  const degradedRgb = applyDegradeLayersTsl(
    shiftedRgb,
    vDeg0.x, // moss
    vDeg0.y, // cracks
    vDeg0.z, // chipped
    vDeg0.w, // scorch
    vDeg1.x, // mud
    vDeg1.y, // frost
    vDeg1.z, // bleached
    vDeg1.w, // rusted
    vDegWet  // wet
  );
  nodeMat.colorNode = vec4(degradedRgb.rgb, materialOpacity);
  if ('roughnessNode' in nodeMat) {
    (nodeMat as unknown as { roughnessNode: unknown }).roughnessNode = applyDegradeRoughnessTsl(
      materialRoughness,
      vDeg0.x,
      vDeg0.y,
      vDeg0.z,
      vDeg0.w,
      vDeg1.x,
      vDeg1.y,
      vDeg1.z,
      vDeg1.w,
      vDegWet
    );
  }
  nodeMat.needsUpdate = true;
  return nodeMat;
}

/**
 * Prepares all paintable meshes inside a 3D object/tree for interactive vertex painting & degrading:
 * ensures unique non-shared BufferGeometries, initializes color/HSV/degrade attributes,
 * snapshots original positions/normals/colors for non-destructive erasing, and upgrades material shaders.
 */
export function prepareObjectForVertexPainting(root: THREE.Object3D): THREE.Mesh[] {
  const seenGeos = new Set<THREE.BufferGeometry>();
  const paintableMeshes: THREE.Mesh[] = [];

  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    if (child.userData.noVertexPaint) return;

    // Clone geometry if shared between sibling meshes (e.g. multiple canopy puffs) so painting stays localized
    if (seenGeos.has(child.geometry)) {
      child.geometry = child.geometry.clone();
    }
    seenGeos.add(child.geometry);

    ensureGeometryVertexPaintAttributes(child.geometry);

    if (Array.isArray(child.material)) {
      child.material = child.material.map((m) => enableVertexPaintHsvOnMaterial(m));
    } else if (child.material) {
      child.material = enableVertexPaintHsvOnMaterial(child.material);
    }

    paintableMeshes.push(child);
  });

  return paintableMeshes;
}

/**
 * Restores every vertex on every paintable mesh in `root` back to its pristine unpainted & undegraded baseline.
 */
export function resetObjectVertexPaint(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || child.userData.noVertexPaint) return;
    const geo = child.geometry;
    const baseCols = geo.userData.vpBaseColors as Float32Array | undefined;
    const baseHsv = geo.userData.vpBaseHsv as Float32Array | undefined;
    const basePos = geo.userData.vpBasePositions as Float32Array | undefined;
    const baseNorm = geo.userData.vpBaseNormals as Float32Array | undefined;
    const colAttr = geo.attributes.color as AnyVertexAttr | undefined;
    const hsvAttr = geo.attributes.aPaintHsv as AnyVertexAttr | undefined;
    const posAttr = geo.attributes.position as AnyVertexAttr | undefined;
    const normAttr = geo.attributes.normal as AnyVertexAttr | undefined;
    const deg0Attr = geo.attributes.aDegrade0 as AnyVertexAttr | undefined;
    const deg1Attr = geo.attributes.aDegrade1 as AnyVertexAttr | undefined;
    const degWetAttr = geo.attributes.aDegradeWet as AnyVertexAttr | undefined;

    if (baseCols && colAttr) {
      for (let i = 0; i < colAttr.count; i++) {
        const i3 = i * 3;
        colAttr.setXYZ(i, baseCols[i3] ?? 1, baseCols[i3 + 1] ?? 1, baseCols[i3 + 2] ?? 1);
      }
      colAttr.needsUpdate = true;
    }
    if (hsvAttr) {
      for (let i = 0; i < hsvAttr.count; i++) {
        const i3 = i * 3;
        hsvAttr.setXYZ(
          i,
          baseHsv ? baseHsv[i3] ?? 0 : 0,
          baseHsv ? baseHsv[i3 + 1] ?? 0 : 0,
          baseHsv ? baseHsv[i3 + 2] ?? 0 : 0
        );
      }
      hsvAttr.needsUpdate = true;
    }
    if (basePos && posAttr) {
      if (posAttr instanceof THREE.BufferAttribute && posAttr.array instanceof Float32Array) {
        posAttr.array.set(basePos);
      } else {
        for (let i = 0; i < posAttr.count; i++) {
          const i3 = i * 3;
          posAttr.setXYZ(i, basePos[i3] ?? 0, basePos[i3 + 1] ?? 0, basePos[i3 + 2] ?? 0);
        }
      }
      posAttr.needsUpdate = true;
    }
    if (baseNorm && normAttr) {
      if (normAttr instanceof THREE.BufferAttribute && normAttr.array instanceof Float32Array) {
        normAttr.array.set(baseNorm);
      } else {
        for (let i = 0; i < normAttr.count; i++) {
          const i3 = i * 3;
          normAttr.setXYZ(i, baseNorm[i3] ?? 0, baseNorm[i3 + 1] ?? 0, baseNorm[i3 + 2] ?? 0);
        }
      }
      normAttr.needsUpdate = true;
    }
    if (deg0Attr) {
      for (let i = 0; i < deg0Attr.count; i++) {
        deg0Attr.setXYZW(i, 0, 0, 0, 0);
      }
      deg0Attr.needsUpdate = true;
    }
    if (deg1Attr) {
      for (let i = 0; i < deg1Attr.count; i++) {
        deg1Attr.setXYZW(i, 0, 0, 0, 0);
      }
      deg1Attr.needsUpdate = true;
    }
    if (degWetAttr) {
      for (let i = 0; i < degWetAttr.count; i++) {
        degWetAttr.setX(i, 0);
      }
      degWetAttr.needsUpdate = true;
    }
  });
}

function matchesTarget(mesh: THREE.Mesh, target: VertexPaintTarget): boolean {
  if (target === 'all') return true;
  const part = mesh.userData.paintPart as string | undefined;
  if (!part) return true;
  return part === target;
}

/**
 * Applies a single 3D spherical brush dab (in `root` local coordinates) directly to vertex
 * `color`, `aPaintHsv`, `aDegrade0`/`aDegrade1`/`aDegradeWet`, and physical chip displacement
 * with smooth radial falloff. Runs in <1ms for 60fps brushing.
 */
export function applyVertexPaintDab(
  root: THREE.Object3D,
  localCenter: THREE.Vector3,
  settings: VertexPaintBrushSettings,
  seed: number,
  cachedMeshes?: THREE.Mesh[]
): boolean {
  root.updateMatrixWorld(true);
  _invRootMat.copy(root.matrixWorld).invert();

  const radius = Math.max(0.05, settings.radius);
  const radiusSq = radius * radius;
  const opacity = THREE.MathUtils.clamp(settings.opacity, 0.01, 1.0);
  const softness = THREE.MathUtils.clamp(settings.softness, 0.05, 1.0);
  const hueNorm = settings.hueShift / 360;
  const satShift = THREE.MathUtils.clamp(settings.saturationShift ?? 0, -0.8, 0.8);
  const valShift = THREE.MathUtils.clamp(settings.valueShift ?? 0, -0.5, 0.5);
  const jitterDeg = THREE.MathUtils.clamp(settings.hueJitter ?? 0, 0, 90);
  const degradeForm: WeatheringPreset = settings.degradeForm ?? 'cracked';
  const chipDepth = THREE.MathUtils.clamp(settings.degradeChipDepth ?? 0.45, 0, 1);

  // Precompute base brush color shifted by hueShift/sat/val for 'paint' mode
  _cBase.set(settings.color);
  _cBase.getHSL(_hslTmp, THREE.SRGBColorSpace);
  const baseH = (((_hslTmp.h + hueNorm) % 1) + 1) % 1;
  const baseS = THREE.MathUtils.clamp(_hslTmp.s + satShift, 0, 1);
  const baseL = THREE.MathUtils.clamp(_hslTmp.l + valShift * 0.5, 0.04, 0.96);

  const meshes = cachedMeshes ?? [];
  if (!cachedMeshes) {
    root.traverse((child) => {
      if (child instanceof THREE.Mesh && !child.userData.noVertexPaint) {
        meshes.push(child);
      }
    });
  }

  let anyModified = false;

  for (let m = 0; m < meshes.length; m++) {
    const mesh = meshes[m];
    if (!mesh.visible) continue;
    if (!matchesTarget(mesh, settings.target)) continue;

    const geo = mesh.geometry;
    const posAttr = geo.attributes.position as AnyVertexAttr | undefined;
    const colAttr = geo.attributes.color as AnyVertexAttr | undefined;
    const hsvAttr = geo.attributes.aPaintHsv as AnyVertexAttr | undefined;
    const deg0Attr = geo.attributes.aDegrade0 as AnyVertexAttr | undefined;
    const deg1Attr = geo.attributes.aDegrade1 as AnyVertexAttr | undefined;
    const degWetAttr = geo.attributes.aDegradeWet as AnyVertexAttr | undefined;
    if (!posAttr || !colAttr || !hsvAttr || !deg0Attr || !deg1Attr || !degWetAttr) continue;

    // Matrix transforming vertex position from mesh local space into `root` local space
    _meshToRootMat.multiplyMatrices(_invRootMat, mesh.matrixWorld);

    const baseCols = geo.userData.vpBaseColors as Float32Array | undefined;
    const basePos = geo.userData.vpBasePositions as Float32Array | undefined;
    const baseNorm = geo.userData.vpBaseNormals as Float32Array | undefined;
    const geoScale = typeof geo.userData.vpGeoScale === 'number' ? geo.userData.vpGeoScale : 1.0;

    let meshTouched = false;
    let meshDeformed = false;

    for (let i = 0; i < posAttr.count; i++) {
      const i3 = i * 3;
      const vx = basePos ? basePos[i3] : posAttr.getX(i);
      const vy = basePos ? basePos[i3 + 1] : posAttr.getY(i);
      const vz = basePos ? basePos[i3 + 2] : posAttr.getZ(i);
      _vPos.set(vx, vy, vz).applyMatrix4(_meshToRootMat);

      const dx = _vPos.x - localCenter.x;
      const dy = _vPos.y - localCenter.y;
      const dz = _vPos.z - localCenter.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq >= radiusSq) continue;

      const normDist = Math.sqrt(distSq) / radius;
      const innerCore = 1 - softness;
      let falloff = 1.0;
      if (normDist > innerCore) {
        const edgeT = (normDist - innerCore) / Math.max(0.001, softness);
        const smooth = edgeT * edgeT * (3 - 2 * edgeT);
        falloff = 1 - smooth;
      }

      const w = THREE.MathUtils.clamp(falloff * opacity, 0, 1);
      if (w <= 0.0005) continue;

      meshTouched = true;

      if (settings.mode === 'erase') {
        const br = baseCols ? baseCols[i3] : 1;
        const bg = baseCols ? baseCols[i3 + 1] : 1;
        const bb = baseCols ? baseCols[i3 + 2] : 1;
        colAttr.setXYZ(
          i,
          THREE.MathUtils.lerp(colAttr.getX(i), br, w),
          THREE.MathUtils.lerp(colAttr.getY(i), bg, w),
          THREE.MathUtils.lerp(colAttr.getZ(i), bb, w)
        );
        hsvAttr.setXYZ(
          i,
          THREE.MathUtils.lerp(hsvAttr.getX(i), 0, w),
          THREE.MathUtils.lerp(hsvAttr.getY(i), 0, w),
          THREE.MathUtils.lerp(hsvAttr.getZ(i), 0, w)
        );
        deg0Attr.setXYZW(
          i,
          THREE.MathUtils.lerp(deg0Attr.getX(i), 0, w),
          THREE.MathUtils.lerp(deg0Attr.getY(i), 0, w),
          THREE.MathUtils.lerp(deg0Attr.getZ(i), 0, w),
          THREE.MathUtils.lerp(deg0Attr.getW(i), 0, w)
        );
        deg1Attr.setXYZW(
          i,
          THREE.MathUtils.lerp(deg1Attr.getX(i), 0, w),
          THREE.MathUtils.lerp(deg1Attr.getY(i), 0, w),
          THREE.MathUtils.lerp(deg1Attr.getZ(i), 0, w),
          THREE.MathUtils.lerp(deg1Attr.getW(i), 0, w)
        );
        degWetAttr.setX(i, THREE.MathUtils.lerp(degWetAttr.getX(i), 0, w));

        if (basePos) {
          const curX = posAttr.getX(i);
          const curY = posAttr.getY(i);
          const curZ = posAttr.getZ(i);
          const bx = basePos[i3];
          const by = basePos[i3 + 1];
          const bz = basePos[i3 + 2];
          if (Math.abs(curX - bx) + Math.abs(curY - by) + Math.abs(curZ - bz) > 0.0001) {
            posAttr.setXYZ(
              i,
              THREE.MathUtils.lerp(curX, bx, w),
              THREE.MathUtils.lerp(curY, by, w),
              THREE.MathUtils.lerp(curZ, bz, w)
            );
            meshDeformed = true;
          }
        }
      } else if (settings.mode === 'degrade') {
        const organic = THREE.MathUtils.clamp(
          0.72 + organicSpatialNoise(_vPos.x * 1.4, _vPos.y * 1.4, _vPos.z * 1.4, seed) * 0.28,
          0.35,
          1.0
        );
        const effW = THREE.MathUtils.clamp(w * organic, 0, 1);

        if (degradeForm === 'none') {
          // Restore degradation channels while leaving painted hue/color intact
          deg0Attr.setXYZW(
            i,
            THREE.MathUtils.lerp(deg0Attr.getX(i), 0, w),
            THREE.MathUtils.lerp(deg0Attr.getY(i), 0, w),
            THREE.MathUtils.lerp(deg0Attr.getZ(i), 0, w),
            THREE.MathUtils.lerp(deg0Attr.getW(i), 0, w)
          );
          deg1Attr.setXYZW(
            i,
            THREE.MathUtils.lerp(deg1Attr.getX(i), 0, w),
            THREE.MathUtils.lerp(deg1Attr.getY(i), 0, w),
            THREE.MathUtils.lerp(deg1Attr.getZ(i), 0, w),
            THREE.MathUtils.lerp(deg1Attr.getW(i), 0, w)
          );
          degWetAttr.setX(i, THREE.MathUtils.lerp(degWetAttr.getX(i), 0, w));
        } else {
          if (degradeForm === 'moss') {
            deg0Attr.setX(i, Math.min(1, Math.max(deg0Attr.getX(i), effW * 0.45) + effW * 0.55));
          } else if (degradeForm === 'cracked') {
            deg0Attr.setY(i, Math.min(1, Math.max(deg0Attr.getY(i), effW * 0.45) + effW * 0.55));
          } else if (degradeForm === 'chipped') {
            deg0Attr.setZ(i, Math.min(1, Math.max(deg0Attr.getZ(i), effW * 0.45) + effW * 0.55));
          } else if (degradeForm === 'scorched') {
            deg0Attr.setW(i, Math.min(1, Math.max(deg0Attr.getW(i), effW * 0.45) + effW * 0.55));
          } else if (degradeForm === 'muddy') {
            deg1Attr.setX(i, Math.min(1, Math.max(deg1Attr.getX(i), effW * 0.45) + effW * 0.55));
          } else if (degradeForm === 'snow') {
            deg1Attr.setY(i, Math.min(1, Math.max(deg1Attr.getY(i), effW * 0.45) + effW * 0.55));
          } else if (degradeForm === 'bleached') {
            deg1Attr.setZ(i, Math.min(1, Math.max(deg1Attr.getZ(i), effW * 0.45) + effW * 0.55));
          } else if (degradeForm === 'rusted') {
            deg1Attr.setW(i, Math.min(1, Math.max(deg1Attr.getW(i), effW * 0.45) + effW * 0.55));
          } else if (degradeForm === 'wet') {
            degWetAttr.setX(i, Math.min(1, Math.max(degWetAttr.getX(i), effW * 0.45) + effW * 0.55));
          }

          // Physical geometry dent / chip displacement for Chipped & Cracked forms
          if (
            (degradeForm === 'chipped' || degradeForm === 'cracked') &&
            chipDepth > 0.01 &&
            basePos &&
            baseNorm
          ) {
            const chipHash = hashVertex3(bxSafe(basePos, i3), basePos[i3 + 1], basePos[i3 + 2], seed + 17);
            const facetNoise = organicSpatialNoise(_vPos.x * 2.8, _vPos.y * 2.8, _vPos.z * 2.8, seed + 53);
            const carveProfile =
              degradeForm === 'chipped'
                ? chipHash > 0.28
                  ? 0.45 + 0.55 * chipHash
                  : 0.15
                : Math.max(0, 0.5 - Math.abs(facetNoise)) * 1.4;
            const maxBite = Math.min(0.14, geoScale * 0.12) * chipDepth;
            const targetDent = maxBite * falloff * Math.min(1, opacity * 1.15) * carveProfile;
            if (targetDent > 0.0005) {
              const bx = basePos[i3];
              const by = basePos[i3 + 1];
              const bz = basePos[i3 + 2];
              const nx = baseNorm[i3];
              const ny = baseNorm[i3 + 1];
              const nz = baseNorm[i3 + 2];
              const curX = posAttr.getX(i);
              const curY = posAttr.getY(i);
              const curZ = posAttr.getZ(i);
              const existingDent = Math.hypot(curX - bx, curY - by, curZ - bz);
              const nextDent = Math.min(maxBite * 1.15, Math.max(existingDent, targetDent));
              posAttr.setXYZ(i, bx - nx * nextDent, by - ny * nextDent, bz - nz * nextDent);
              meshDeformed = true;
            }
          }
        }
      } else if (settings.mode === 'hueShift') {
        const jNoise = jitterDeg > 0.5 ? (hashVertex3(_vPos.x, _vPos.y, _vPos.z, seed) - 0.5) * 2 * (jitterDeg / 360) : 0;
        const targetHue = hueNorm + jNoise;
        hsvAttr.setXYZ(
          i,
          THREE.MathUtils.lerp(hsvAttr.getX(i), targetHue, w),
          THREE.MathUtils.lerp(hsvAttr.getY(i), satShift, w),
          THREE.MathUtils.lerp(hsvAttr.getZ(i), valShift, w)
        );
      } else if (settings.mode === 'organicJitter') {
        const spatial = organicSpatialNoise(_vPos.x, _vPos.y, _vPos.z, seed);
        const micro = (hashVertex3(_vPos.x, _vPos.y, _vPos.z, seed + 31) - 0.5) * 0.45;
        const patchNoise = THREE.MathUtils.clamp(spatial * 0.8 + micro, -1, 1);
        const effJitter = Math.max(18, jitterDeg);
        const hShiftLocal = hueNorm + patchNoise * (effJitter / 360);
        const sShiftLocal = satShift + patchNoise * 0.14;
        const vShiftLocal = valShift + patchNoise * 0.16;

        hsvAttr.setXYZ(
          i,
          THREE.MathUtils.lerp(hsvAttr.getX(i), hShiftLocal, w * 0.9),
          THREE.MathUtils.lerp(hsvAttr.getY(i), THREE.MathUtils.clamp(sShiftLocal, -0.8, 0.8), w * 0.85),
          THREE.MathUtils.lerp(hsvAttr.getZ(i), THREE.MathUtils.clamp(vShiftLocal, -0.5, 0.5), w * 0.85)
        );

        _cTarget.setHSL(
          (((baseH + patchNoise * (effJitter / 360)) % 1) + 1) % 1,
          THREE.MathUtils.clamp(baseS * 0.85, 0, 1),
          THREE.MathUtils.clamp(baseL + patchNoise * 0.1, 0.12, 0.94),
          THREE.SRGBColorSpace
        );
        _cCurr.setRGB(colAttr.getX(i), colAttr.getY(i), colAttr.getZ(i));
        _cCurr.getRGB(_srgbA, THREE.SRGBColorSpace);
        _cTarget.getRGB(_srgbB, THREE.SRGBColorSpace);
        const tintW = w * 0.42;
        _cTmp.setRGB(
          _srgbA.r + (_srgbB.r - _srgbA.r) * tintW,
          _srgbA.g + (_srgbB.g - _srgbA.g) * tintW,
          _srgbA.b + (_srgbB.b - _srgbA.b) * tintW,
          THREE.SRGBColorSpace
        );
        colAttr.setXYZ(i, _cTmp.r, _cTmp.g, _cTmp.b);
      } else {
        // 'paint': direct color variation painting (with hue shift & optional organic jitter!)
        const jOffset =
          jitterDeg > 0.5
            ? organicSpatialNoise(_vPos.x, _vPos.y, _vPos.z, seed) * (jitterDeg / 360)
            : 0;
        const vH = (((baseH + jOffset) % 1) + 1) % 1;
        _cTarget.setHSL(vH, baseS, baseL, THREE.SRGBColorSpace);

        _cCurr.setRGB(colAttr.getX(i), colAttr.getY(i), colAttr.getZ(i));
        _cCurr.getRGB(_srgbA, THREE.SRGBColorSpace);
        _cTarget.getRGB(_srgbB, THREE.SRGBColorSpace);
        _cTmp.setRGB(
          _srgbA.r + (_srgbB.r - _srgbA.r) * w,
          _srgbA.g + (_srgbB.g - _srgbA.g) * w,
          _srgbA.b + (_srgbB.b - _srgbA.b) * w,
          THREE.SRGBColorSpace
        );
        colAttr.setXYZ(i, _cTmp.r, _cTmp.g, _cTmp.b);

        hsvAttr.setXYZ(
          i,
          THREE.MathUtils.lerp(hsvAttr.getX(i), 0, w * 0.65),
          THREE.MathUtils.lerp(hsvAttr.getY(i), 0, w * 0.65),
          THREE.MathUtils.lerp(hsvAttr.getZ(i), 0, w * 0.65)
        );
      }
    }

    if (meshTouched) {
      colAttr.needsUpdate = true;
      hsvAttr.needsUpdate = true;
      deg0Attr.needsUpdate = true;
      deg1Attr.needsUpdate = true;
      degWetAttr.needsUpdate = true;
      if (meshDeformed) {
        posAttr.needsUpdate = true;
        geo.computeVertexNormals();
      }
      anyModified = true;
    }
  }

  return anyModified;
}

function bxSafe(arr: Float32Array, i3: number): number {
  return arr[i3] ?? 0;
}

/**
 * Deterministically replays all saved 3D vertex paint & degradation strokes onto a built tree or object mesh.
 */
export function applyVertexPaintStrokesToObject(
  root: THREE.Object3D,
  strokes: VertexPaintStroke[] | undefined
): void {
  if (!strokes || strokes.length === 0) return;
  const meshes = prepareObjectForVertexPainting(root);
  if (meshes.length === 0) return;

  const pt = new THREE.Vector3();
  for (let s = 0; s < strokes.length; s++) {
    const stroke = strokes[s];
    const settings: VertexPaintBrushSettings = {
      radius: stroke.radius,
      opacity: stroke.opacity,
      softness: stroke.softness ?? 0.65,
      mode: stroke.mode,
      target: stroke.target,
      color: stroke.color,
      hueShift: stroke.hueShift,
      saturationShift: stroke.saturationShift ?? 0,
      valueShift: stroke.valueShift ?? 0,
      hueJitter: stroke.hueJitter ?? 0,
      degradeForm: stroke.degradeForm,
      degradeChipDepth: stroke.degradeChipDepth,
    };
    for (let p = 0; p < stroke.points.length; p++) {
      const [x, y, z] = stroke.points[p];
      pt.set(x, y, z);
      applyVertexPaintDab(root, pt, settings, stroke.seed, meshes);
    }
  }
}

/**
 * Generates an organic multi-dab auto-dapple or auto-degrade stroke over the visible parts
 * so creators can immediately weather or dapple an object in 1 click.
 */
export function generateOrganicDappleStroke(
  root: THREE.Object3D,
  settings: VertexPaintBrushSettings,
  seed: number
): VertexPaintStroke | null {
  root.updateMatrixWorld(true);
  const invRoot = root.matrixWorld.clone().invert();
  const candidates: THREE.Vector3[] = [];

  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || child.userData.noVertexPaint || !child.visible) return;
    if (!matchesTarget(child, settings.target)) return;
    const pos = child.geometry.attributes.position as THREE.BufferAttribute | undefined;
    if (!pos || pos.count === 0) return;
    const mToR = new THREE.Matrix4().multiplyMatrices(invRoot, child.matrixWorld);
    const step = Math.max(1, Math.floor(pos.count / 18));
    for (let i = 0; i < pos.count; i += step) {
      candidates.push(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(mToR));
    }
  });

  if (candidates.length === 0) return null;

  let st = (seed >>> 0) || 1;
  const rand = () => {
    st = (st + 0x6d2b79f5) >>> 0;
    let t = Math.imul(st ^ (st >>> 15), 1 | st);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const count = Math.min(18, Math.max(8, Math.round(candidates.length * 0.28)));
  const points: [number, number, number][] = [];
  for (let i = 0; i < count; i++) {
    const pick = candidates[Math.floor(rand() * candidates.length)];
    points.push([
      Number(pick.x.toFixed(3)),
      Number(pick.y.toFixed(3)),
      Number(pick.z.toFixed(3)),
    ]);
  }

  const isDegrade = settings.mode === 'degrade';
  return {
    id: `vp_${Date.now().toString(36)}_${Math.floor(rand() * 9999)}`,
    points,
    radius: Math.max(0.42, settings.radius * 1.15),
    opacity: isDegrade
      ? Math.min(0.95, Math.max(0.32, settings.opacity))
      : Math.min(0.65, Math.max(0.28, settings.opacity)),
    softness: 0.82,
    mode: settings.mode === 'erase' ? 'organicJitter' : settings.mode,
    target: settings.target,
    color: settings.color,
    hueShift: settings.hueShift,
    saturationShift: settings.saturationShift,
    valueShift: settings.valueShift,
    hueJitter: Math.max(24, settings.hueJitter),
    degradeForm: isDegrade ? settings.degradeForm ?? 'cracked' : undefined,
    degradeChipDepth: isDegrade ? settings.degradeChipDepth ?? 0.45 : undefined,
    seed,
  };
}

