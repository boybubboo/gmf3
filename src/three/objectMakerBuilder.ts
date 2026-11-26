import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import type {
  BuildingMaterialId,
  ObjectGeometryModifiers,
  ObjectGroupSpec,
  ObjectMakerDoc,
  ObjectPartSpec,
  ObjectPrimitiveShapeId,
  ObjectSurfaceFinish,
  WeatheringPreset,
} from '../types/maker';
import {
  BUILDING_MATERIALS,
  WORLD_TEX_TILE_METERS,
  createBuildingSurfaceMaterial,
  createOrganicStoneBoxGeometry,
  enableShadows,
} from './buildingBlocks';
import { deserializeBufferGeometry } from './meshCsg';
import {
  buildPlantPartGeometry,
  createPlantPartMaterial,
  isPlantShape,
} from './plantMakerBuilder';
import { uid } from '../utils/terrain';

export interface ObjectPrimitiveMeta {
  id: ObjectPrimitiveShapeId;
  label: string;
  defaultName: string;
  category: 'basic' | 'architectural';
  defaultSize: [number, number, number];
}

export const OBJECT_PRIMITIVE_CATALOG: ObjectPrimitiveMeta[] = [
  { id: 'cube', label: 'Cube', defaultName: 'Cube', category: 'basic', defaultSize: [1.0, 1.0, 1.0] },
  { id: 'halfCube', label: 'Half Cube', defaultName: 'HalfCube', category: 'basic', defaultSize: [1.0, 0.5, 1.0] },
  { id: 'sphere', label: 'Sphere', defaultName: 'Sphere', category: 'basic', defaultSize: [0.9, 0.9, 0.9] },
  { id: 'hemisphere', label: 'Dome', defaultName: 'Dome', category: 'basic', defaultSize: [1.0, 0.55, 1.0] },
  { id: 'cylinder', label: 'Cylinder', defaultName: 'Cylinder', category: 'basic', defaultSize: [0.8, 1.2, 0.8] },
  { id: 'cone', label: 'Cone', defaultName: 'Cone', category: 'basic', defaultSize: [0.9, 1.2, 0.9] },
  { id: 'capsule', label: 'Capsule', defaultName: 'Capsule', category: 'basic', defaultSize: [0.65, 1.3, 0.65] },
  { id: 'torus', label: 'Ring / Torus', defaultName: 'Ring', category: 'basic', defaultSize: [1.0, 0.3, 1.0] },
  { id: 'wedge', label: 'Wedge / Ramp', defaultName: 'Wedge', category: 'basic', defaultSize: [1.0, 0.75, 1.0] },
  { id: 'arch', label: 'Arch', defaultName: 'Arch', category: 'architectural', defaultSize: [1.4, 1.4, 0.45] },
  { id: 'prism', label: 'Hex Prism', defaultName: 'Prism', category: 'basic', defaultSize: [0.9, 1.0, 0.9] },
  { id: 'plank', label: 'Plank', defaultName: 'Plank', category: 'architectural', defaultSize: [1.6, 0.12, 0.42] },
  { id: 'beamLarge', label: 'Large Beam', defaultName: 'LargeBeam', category: 'architectural', defaultSize: [1.8, 0.24, 0.24] },
  { id: 'beamSmall', label: 'Small Beam', defaultName: 'SmallBeam', category: 'architectural', defaultSize: [1.0, 0.14, 0.14] },
  { id: 'pillar', label: 'Pillar', defaultName: 'Pillar', category: 'architectural', defaultSize: [0.55, 1.6, 0.55] },
  { id: 'stairs', label: 'Steps', defaultName: 'Steps', category: 'architectural', defaultSize: [1.1, 0.85, 1.1] },
  { id: 'fence', label: 'Rail / Fence', defaultName: 'Fence', category: 'architectural', defaultSize: [1.6, 0.85, 0.2] },
  { id: 'roofAFrame', label: 'A-Frame Roof', defaultName: 'AFrameRoof', category: 'architectural', defaultSize: [1.8, 1.0, 1.6] },
  { id: 'roofSlope', label: 'Sloped Roof', defaultName: 'SlopedRoof', category: 'architectural', defaultSize: [1.6, 1.0, 1.6] },
];

export const DEFAULT_PART_MODIFIERS: ObjectGeometryModifiers = {
  bevel: 0.04,
  chamfer: 0,
  roundness: 0,
  edgeWear: 0,
  segments: 16,
};

export function createDefaultMaterialFinish(
  materialId?: BuildingMaterialId,
  color = '#CBD5E1'
): ObjectSurfaceFinish {
  if (materialId) {
    const meta = BUILDING_MATERIALS.find((m) => m.id === materialId) ?? BUILDING_MATERIALS[0];
    return {
      materialId,
      color: '#FFFFFF',
      roughness: meta.roughness,
      metalness: meta.metalness,
      weathering: 'none',
      weatheringIntensity: 0.35,
    };
  }
  return {
    color,
    roughness: 0.68,
    metalness: 0.08,
    weathering: 'none',
    weatheringIntensity: 0.35,
  };
}

export function createDefaultPartSpec(
  shape: ObjectPrimitiveShapeId,
  overrides: Partial<ObjectPartSpec> = {}
): ObjectPartSpec {
  const meta = OBJECT_PRIMITIVE_CATALOG.find((p) => p.id === shape);
  const size: [number, number, number] = overrides.dimensions
    ? ([...overrides.dimensions] as [number, number, number])
    : meta
    ? ([...meta.defaultSize] as [number, number, number])
    : [1, 1, 1];
  const defaultY = Number((size[1] * 0.5).toFixed(3));
  const defaultMat =
    shape === 'plank' || shape === 'beamLarge' || shape === 'beamSmall' || shape === 'fence'
      ? createDefaultMaterialFinish('timberPlank')
      : shape === 'arch' || shape === 'pillar' || shape === 'stairs'
      ? createDefaultMaterialFinish('hewnStone')
      : shape === 'roofAFrame' || shape === 'roofSlope'
      ? createDefaultMaterialFinish('clayTile')
      : createDefaultMaterialFinish('sandstone');

  return {
    id: overrides.id ?? uid(),
    name: overrides.name ?? `${meta?.defaultName ?? 'Part'}_${Math.floor(Math.random() * 90 + 10)}`,
    parentGroupId: overrides.parentGroupId ?? null,
    shape,
    position: overrides.position ?? [0, defaultY, 0],
    rotation: overrides.rotation ?? [0, 0, 0],
    dimensions: size,
    modifiers: {
      ...DEFAULT_PART_MODIFIERS,
      ...(overrides.modifiers ?? {}),
    },
    material: {
      ...defaultMat,
      ...(overrides.material ?? {}),
    },
    bakedGeometry: overrides.bakedGeometry,
    hidden: overrides.hidden,
    isCutter: overrides.isCutter,
  };
}

export function createStarterObjectDoc(): ObjectMakerDoc {
  const top = createDefaultPartSpec('plank', {
    name: 'Table_Top',
    dimensions: [1.5, 0.14, 0.9],
    position: [0, 0.78, 0],
    modifiers: { bevel: 0.18, chamfer: 0.15, roundness: 0.25, edgeWear: 0.08 },
    material: createDefaultMaterialFinish('timberPlank'),
  });
  const legOffsets: [number, number][] = [
    [-0.6, -0.32],
    [0.6, -0.32],
    [-0.6, 0.32],
    [0.6, 0.32],
  ];
  const legs = legOffsets.map(([lx, lz], i) =>
    createDefaultPartSpec('beamSmall', {
      name: `Table_Leg_${i + 1}`,
      dimensions: [0.13, 0.72, 0.13],
      position: [lx, 0.36, lz],
      modifiers: { bevel: 0.12, chamfer: 0.2, roundness: 0.1, edgeWear: 0.06 },
      material: createDefaultMaterialFinish('weatheredSlats'),
    })
  );
  return {
    version: 1,
    parts: [top, ...legs],
    groups: [],
  };
}

export function createSavePlinthObjectDoc(): ObjectMakerDoc {
  const stonePlinth = createDefaultPartSpec('cube', {
    name: 'Plinth_Base_Slab',
    dimensions: [1.55, 0.24, 1.55],
    position: [0, 0.12, 0],
    modifiers: { bevel: 0.16, chamfer: 0.18, roundness: 0.05, edgeWear: 0.22 },
    material: createDefaultMaterialFinish('hewnStone', '#CBD5E1'),
  });
  const hexTier = createDefaultPartSpec('prism', {
    name: 'Plinth_Hex_Tier',
    dimensions: [1.14, 0.28, 1.14],
    position: [0, 0.36, 0],
    modifiers: { bevel: 0.14, chamfer: 0.12, roundness: 0, edgeWear: 0.15 },
    material: createDefaultMaterialFinish('crackedSlate', '#94A3B8'),
  });
  const pillarBody = createDefaultPartSpec('pillar', {
    name: 'Plinth_Pillar',
    dimensions: [0.58, 0.92, 0.58],
    position: [0, 0.92, 0],
    modifiers: { bevel: 0.12, chamfer: 0.12, roundness: 0, edgeWear: 0.16 },
    material: createDefaultMaterialFinish('hewnStone', '#CBD5E1'),
  });
  const topAltarCap = createDefaultPartSpec('prism', {
    name: 'Plinth_Altar_Cap',
    dimensions: [0.84, 0.18, 0.84],
    position: [0, 1.44, 0],
    modifiers: { bevel: 0.14, chamfer: 0.14, roundness: 0, edgeWear: 0.1 },
    material: createDefaultMaterialFinish('crackedSlate', '#B4C6DC'),
  });
  const runeRing = createDefaultPartSpec('torus', {
    name: 'Glowing_Rune_Ring',
    dimensions: [1.34, 0.14, 1.34],
    position: [0, 0.3, 0],
    rotation: [90, 0, 0],
    modifiers: { bevel: 0, chamfer: 0, roundness: 0, edgeWear: 0, segments: 24 },
    material: {
      color: '#38BDF8',
      roughness: 0.18,
      metalness: 0.2,
      emissive: '#0EA5E9',
      emissiveIntensity: 1.45,
      weathering: 'none',
      weatheringIntensity: 0,
    },
  });
  const beaconCrystal = createDefaultPartSpec('prism', {
    name: 'Waystone_Crystal',
    dimensions: [0.42, 0.88, 0.42],
    position: [0, 2.02, 0],
    rotation: [0, 30, 0],
    modifiers: { bevel: 0.32, chamfer: 0.45, roundness: 0, edgeWear: 0, segments: 6 },
    material: {
      color: '#7DD3FC',
      roughness: 0.12,
      metalness: 0.15,
      emissive: '#38BDF8',
      emissiveIntensity: 1.75,
      weathering: 'none',
      weatheringIntensity: 0,
    },
  });
  const haloRing = createDefaultPartSpec('torus', {
    name: 'Crystal_Halo_Ring',
    dimensions: [0.76, 0.08, 0.76],
    position: [0, 1.96, 0],
    rotation: [72, 18, 0],
    modifiers: { bevel: 0, chamfer: 0, roundness: 0, edgeWear: 0, segments: 24 },
    material: {
      color: '#93C5FD',
      roughness: 0.2,
      metalness: 0.35,
      emissive: '#2563EB',
      emissiveIntensity: 1.25,
      weathering: 'none',
      weatheringIntensity: 0,
    },
  });
  return {
    version: 1,
    parts: [stonePlinth, hexTier, pillarBody, topAltarCap, runeRing, beaconCrystal, haloRing],
    groups: [],
  };
}

export function sanitizeObjectNodeName(raw: string, fallback = 'Part'): string {
  const cleaned = raw.replace(/[/\\:*?"<>|]+/g, '_').trim();
  return cleaned || fallback;
}

function applyPlanarMeterUVs(geo: THREE.BufferGeometry): void {
  const pos = geo.attributes.position as THREE.BufferAttribute | undefined;
  const norm = geo.attributes.normal as THREE.BufferAttribute | undefined;
  if (!pos || !norm) return;
  let uv = geo.attributes.uv as THREE.BufferAttribute | undefined;
  if (!uv) {
    uv = new THREE.Float32BufferAttribute(new Float32Array(pos.count * 2), 2);
    geo.setAttribute('uv', uv);
  }
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    const nx = Math.abs(norm.getX(i));
    const ny = Math.abs(norm.getY(i));
    const nz = Math.abs(norm.getZ(i));
    if (nz >= nx && nz >= ny) {
      uv.setXY(i, px / WORLD_TEX_TILE_METERS + 0.5, py / WORLD_TEX_TILE_METERS + 0.5);
    } else if (nx >= nz && nx >= ny) {
      uv.setXY(i, pz / WORLD_TEX_TILE_METERS + 0.5, py / WORLD_TEX_TILE_METERS + 0.5);
    } else {
      uv.setXY(i, px / WORLD_TEX_TILE_METERS + 0.5, pz / WORLD_TEX_TILE_METERS + 0.5);
    }
  }
  uv.needsUpdate = true;
}

function applyEdgeDegradationToGeometry(
  geo: THREE.BufferGeometry,
  edgeWear: number,
  chamferRatio: number,
  seed: number
): THREE.BufferGeometry {
  if (edgeWear <= 0.01 && chamferRatio <= 0.01) return geo;
  const nonIdx = geo.index ? geo.toNonIndexed() : geo;
  nonIdx.computeBoundingBox();
  const box = nonIdx.boundingBox;
  if (!box) return nonIdx;
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);
  const hx = Math.max(0.05, size.x * 0.5);
  const hy = Math.max(0.05, size.y * 0.5);
  const hz = Math.max(0.05, size.z * 0.5);
  const minHalf = Math.min(hx, hy, hz);
  const pos = nonIdx.attributes.position as THREE.BufferAttribute;

  const pA = (seed % 73) * 0.17 + 0.4;
  const pB = (seed % 41) * 0.23 + 1.3;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) - center.x;
    const y = pos.getY(i) - center.y;
    const z = pos.getZ(i) - center.z;
    const fx = hx - Math.abs(x);
    const fy = hy - Math.abs(y);
    const fz = hz - Math.abs(z);
    // Distance to nearest edge in normalized bounds
    let d1 = fx;
    let d2 = fy;
    let d3 = fz;
    if (d1 > d2) [d1, d2] = [d2, d1];
    if (d2 > d3) [d2, d3] = [d3, d2];
    if (d1 > d2) [d1, d2] = [d2, d1];
    const edgeProx = 1 - THREE.MathUtils.smoothstep(d2, 0, minHalf * 0.45);
    const n1 =
      Math.sin(x * 7.5 + y * 5.2 + pA) * Math.cos(z * 8.1 - x * 3.7 + pB) * 0.5 + 0.5;
    const wearInset = edgeProx * edgeWear * minHalf * (0.08 + 0.24 * n1);
    const chamInset = edgeProx * chamferRatio * minHalf * 0.12;
    const len = Math.hypot(x, y, z);
    if (len > 1e-5) {
      const pull = Math.min(len * 0.35, wearInset + chamInset);
      const scale = (len - pull) / len;
      pos.setXYZ(i, center.x + x * scale, center.y + y * scale, center.z + z * scale);
    }
  }
  pos.needsUpdate = true;
  nonIdx.computeVertexNormals();
  return nonIdx;
}

function hashSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function buildPartGeometry(part: ObjectPartSpec): THREE.BufferGeometry {
  if (part.shape === 'csgResult' && part.bakedGeometry) {
    const geo = deserializeBufferGeometry(part.bakedGeometry);
    if (part.modifiers.edgeWear > 0.02 || part.modifiers.chamfer > 0.02) {
      return applyEdgeDegradationToGeometry(
        geo,
        part.modifiers.edgeWear,
        part.modifiers.chamfer,
        hashSeed(part.id)
      );
    }
    return geo;
  }

  if (isPlantShape(part.shape)) {
    const plantGeo = buildPlantPartGeometry(part);
    plantGeo.computeBoundingBox();
    plantGeo.computeBoundingSphere();
    return plantGeo;
  }

  const w = Math.max(0.06, part.dimensions[0]);
  const h = Math.max(0.06, part.dimensions[1]);
  const d = Math.max(0.06, part.dimensions[2]);
  const { bevel, chamfer, roundness, edgeWear } = part.modifiers;
  const minDim = Math.min(w, h, d);
  const segBase = Math.max(8, Math.min(28, part.modifiers.segments ?? 16));
  const seed = hashSeed(part.id);

  let geo: THREE.BufferGeometry;

  switch (part.shape) {
    case 'cube':
    case 'halfCube':
    case 'plank':
    case 'beamLarge':
    case 'beamSmall': {
      const organicAmount = Math.max(edgeWear, chamfer * 0.55);
      if (edgeWear > 0.02 || (chamfer > 0.05 && edgeWear > 0)) {
        const minCh = Math.min(minDim * 0.36, 0.015 + (bevel + chamfer) * minDim * 0.18);
        geo = createOrganicStoneBoxGeometry(w, h, d, 1, 1, 1, organicAmount, seed, minCh);
      } else if (roundness > 0.02 || bevel > 0.02 || chamfer > 0.02) {
        const radius = Math.min(minDim * 0.46, Math.max(bevel, roundness, chamfer * 0.7) * minDim * 0.42);
        const segs = chamfer > roundness && bevel < 0.15 ? 1 : Math.max(2, Math.min(5, Math.round(1 + roundness * 4)));
        geo = new RoundedBoxGeometry(w, h, d, segs, Math.max(0.004, radius));
        applyPlanarMeterUVs(geo);
      } else {
        geo = new THREE.BoxGeometry(w, h, d, 2, 2, 2);
        applyPlanarMeterUVs(geo);
      }
      break;
    }

    case 'sphere': {
      const rx = w * 0.5;
      const ry = h * 0.5;
      const rz = d * 0.5;
      const g = new THREE.SphereGeometry(0.5, segBase, Math.max(8, Math.round(segBase * 0.75)));
      g.scale(rx * 2, ry * 2, rz * 2);
      geo = applyEdgeDegradationToGeometry(g, edgeWear * 0.85, 0, seed);
      break;
    }

    case 'hemisphere': {
      const g = new THREE.SphereGeometry(0.5, segBase, Math.max(8, Math.round(segBase * 0.6)), 0, Math.PI * 2, 0, Math.PI * 0.5);
      g.scale(w, h * 2, d);
      g.translate(0, -h * 0.5, 0);
      geo = applyEdgeDegradationToGeometry(g, edgeWear * 0.85, 0, seed);
      break;
    }

    case 'cylinder': {
      const topR = 0.5 * (1 - Math.min(0.35, chamfer * 0.2));
      const g = new THREE.CylinderGeometry(topR, 0.5, 1, segBase, Math.max(2, Math.round(bevel * 4) + 1));
      g.scale(w, h, d);
      geo = applyEdgeDegradationToGeometry(g, edgeWear, chamfer, seed);
      applyPlanarMeterUVs(geo);
      break;
    }

    case 'cone': {
      const tipR = Math.max(0, roundness * 0.16);
      const g = new THREE.CylinderGeometry(tipR, 0.5, 1, segBase, 2);
      g.scale(w, h, d);
      geo = applyEdgeDegradationToGeometry(g, edgeWear, chamfer * 0.5, seed);
      applyPlanarMeterUVs(geo);
      break;
    }

    case 'capsule': {
      const r = Math.min(w, d) * 0.5;
      const len = Math.max(0.05, h - r * 2);
      const g = new THREE.CapsuleGeometry(r, len, Math.max(4, Math.round(segBase * 0.35)), segBase);
      if (Math.abs(w - d) > 0.01) {
        g.scale(w / Math.max(0.01, Math.min(w, d)), 1, d / Math.max(0.01, Math.min(w, d)));
      }
      geo = applyEdgeDegradationToGeometry(g, edgeWear * 0.7, 0, seed);
      break;
    }

    case 'torus': {
      const tubeR = THREE.MathUtils.clamp(h * 0.5, 0.03, Math.min(w, d) * 0.28);
      const mainR = Math.max(tubeR * 1.4, Math.min(w, d) * 0.5 - tubeR);
      const g = new THREE.TorusGeometry(mainR, tubeR, Math.max(8, Math.round(segBase * 0.65)), segBase);
      g.rotateX(Math.PI / 2);
      geo = applyEdgeDegradationToGeometry(g, edgeWear * 0.7, chamfer * 0.4, seed);
      break;
    }

    case 'prism': {
      const sides = 6;
      const g = new THREE.CylinderGeometry(0.5, 0.5, 1, sides, 2);
      g.scale(w, h, d);
      geo = applyEdgeDegradationToGeometry(g, edgeWear, chamfer, seed);
      applyPlanarMeterUVs(geo);
      break;
    }

    case 'wedge': {
      const shape = new THREE.Shape();
      shape.moveTo(-d * 0.5, -h * 0.5);
      shape.lineTo(d * 0.5, -h * 0.5);
      shape.lineTo(-d * 0.5, h * 0.5);
      shape.closePath();
      const bev = Math.min(minDim * 0.14, (bevel + roundness * 0.6 + chamfer * 0.4) * 0.08);
      const g = new THREE.ExtrudeGeometry(shape, {
        depth: Math.max(0.04, w - bev * 2),
        bevelEnabled: bev > 0.004,
        bevelThickness: bev,
        bevelSize: bev,
        bevelSegments: chamfer > roundness ? 1 : 3,
      });
      g.center();
      g.rotateY(Math.PI / 2);
      geo = applyEdgeDegradationToGeometry(g, edgeWear, chamfer, seed);
      applyPlanarMeterUVs(geo);
      break;
    }

    case 'arch': {
      const outerRx = w * 0.5;
      const innerRx = w * 0.3;
      const legH = h * 0.55;
      const archShape = new THREE.Shape();
      archShape.moveTo(-outerRx, -h * 0.5);
      archShape.lineTo(-innerRx, -h * 0.5);
      archShape.lineTo(-innerRx, -h * 0.5 + legH);
      archShape.absarc(0, -h * 0.5 + legH, innerRx, Math.PI, 0, true);
      archShape.lineTo(innerRx, -h * 0.5);
      archShape.lineTo(outerRx, -h * 0.5);
      archShape.lineTo(outerRx, -h * 0.5 + legH);
      archShape.absarc(0, -h * 0.5 + legH, outerRx, 0, Math.PI, false);
      archShape.closePath();

      const bev = Math.min(minDim * 0.12, (bevel + chamfer) * 0.06);
      const g = new THREE.ExtrudeGeometry(archShape, {
        depth: Math.max(0.05, d - bev * 2),
        curveSegments: 14,
        bevelEnabled: bev > 0.004,
        bevelThickness: bev,
        bevelSize: bev,
        bevelSegments: chamfer > roundness ? 1 : 2,
      });
      g.center();
      geo = applyEdgeDegradationToGeometry(g, edgeWear, chamfer, seed);
      applyPlanarMeterUVs(geo);
      break;
    }

    case 'roofAFrame': {
      const shape = new THREE.Shape();
      shape.moveTo(-w * 0.5, -h * 0.5);
      shape.lineTo(w * 0.5, -h * 0.5);
      shape.lineTo(0, h * 0.5);
      shape.closePath();
      const bev = Math.min(minDim * 0.1, bevel * 0.05);
      const g = new THREE.ExtrudeGeometry(shape, {
        depth: Math.max(0.06, d - bev * 2),
        bevelEnabled: bev > 0.004,
        bevelThickness: bev,
        bevelSize: bev,
        bevelSegments: 2,
      });
      g.center();
      geo = applyEdgeDegradationToGeometry(g, edgeWear, chamfer, seed);
      applyPlanarMeterUVs(geo);
      break;
    }

    case 'roofSlope': {
      const shape = new THREE.Shape();
      shape.moveTo(-d * 0.5, -h * 0.5);
      shape.lineTo(d * 0.5, -h * 0.5);
      shape.lineTo(d * 0.5, h * 0.5);
      shape.closePath();
      const g = new THREE.ExtrudeGeometry(shape, {
        depth: w,
        bevelEnabled: bevel > 0.05,
        bevelThickness: bevel * 0.04,
        bevelSize: bevel * 0.04,
        bevelSegments: 2,
      });
      g.center();
      g.rotateY(Math.PI / 2);
      geo = applyEdgeDegradationToGeometry(g, edgeWear, chamfer, seed);
      applyPlanarMeterUVs(geo);
      break;
    }

    case 'stairs': {
      const stepCount = 5;
      const shape = new THREE.Shape();
      shape.moveTo(-d * 0.5, -h * 0.5);
      shape.lineTo(d * 0.5, -h * 0.5);
      shape.lineTo(d * 0.5, h * 0.5);
      for (let s = stepCount - 1; s >= 0; s--) {
        const xLeft = -d * 0.5 + (s / stepCount) * d;
        const yTop = -h * 0.5 + ((s + 1) / stepCount) * h;
        const yBot = -h * 0.5 + (s / stepCount) * h;
        shape.lineTo(xLeft, yTop);
        shape.lineTo(xLeft, yBot);
      }
      shape.closePath();
      const g = new THREE.ExtrudeGeometry(shape, {
        depth: w,
        bevelEnabled: bevel > 0.08,
        bevelThickness: bevel * 0.025,
        bevelSize: bevel * 0.025,
        bevelSegments: 1,
      });
      g.center();
      g.rotateY(Math.PI / 2);
      geo = applyEdgeDegradationToGeometry(g, edgeWear, chamfer, seed);
      applyPlanarMeterUVs(geo);
      break;
    }

    case 'pillar': {
      const radius = Math.min(w, d) * 0.42;
      const g = new THREE.CylinderGeometry(radius * 0.88, radius, h, Math.max(8, segBase), 4);
      geo = applyEdgeDegradationToGeometry(g, edgeWear, chamfer, seed);
      applyPlanarMeterUVs(geo);
      break;
    }

    case 'fence': {
      const g = new RoundedBoxGeometry(w, h, d, 2, Math.min(d * 0.3, 0.03));
      geo = applyEdgeDegradationToGeometry(g, edgeWear, chamfer, seed);
      applyPlanarMeterUVs(geo);
      break;
    }

    default: {
      geo = new THREE.BoxGeometry(w, h, d, 2, 2, 2);
      applyPlanarMeterUVs(geo);
      break;
    }
  }

  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

const WEATHERING_TINT: Record<WeatheringPreset, { hex: string; roughnessDelta: number }> = {
  none: { hex: '#FFFFFF', roughnessDelta: 0 },
  moss: { hex: '#5A8448', roughnessDelta: 0.08 },
  snow: { hex: '#E6EFF8', roughnessDelta: 0.05 },
  wet: { hex: '#7A8290', roughnessDelta: -0.35 },
  cracked: { hex: '#8A8378', roughnessDelta: 0.1 },
  chipped: { hex: '#B4ABA0', roughnessDelta: 0.1 },
  scorched: { hex: '#3B3430', roughnessDelta: 0.12 },
  muddy: { hex: '#6A5138', roughnessDelta: 0.1 },
  bleached: { hex: '#E8E0D0', roughnessDelta: 0.08 },
  rusted: { hex: '#8C4D30', roughnessDelta: 0.12 },
};

let cachedLogBark: { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } | null = null;
let cachedLogRings: { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } | null = null;

function getLogBarkTextures(): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  if (cachedLogBark) return cachedLogBark;
  const size = 256;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;

  ctx.fillStyle = '#5A3A22';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#787878';
  bCtx.fillRect(0, 0, size, size);

  let seed = 419;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < 64; i++) {
    const x = rand() * size;
    const w = 3 + rand() * 8;
    const isDark = i % 3 === 0;
    ctx.strokeStyle = isDark
      ? `rgba(42, 24, 13, ${0.42 + rand() * 0.35})`
      : `rgba(128, 92, 58, ${0.28 + rand() * 0.3})`;
    ctx.lineWidth = w;
    ctx.beginPath();
    let cx = x;
    ctx.moveTo(cx, 0);
    for (let y = 16; y <= size; y += 16) {
      cx += (rand() - 0.5) * 6;
      ctx.lineTo(cx, y);
    }
    ctx.stroke();

    bCtx.strokeStyle = isDark ? 'rgba(30,30,30,0.65)' : 'rgba(220,220,220,0.45)';
    bCtx.lineWidth = w * 0.85;
    bCtx.beginPath();
    cx = x;
    bCtx.moveTo(cx, 0);
    for (let y = 16; y <= size; y += 16) {
      cx += (rand() - 0.5) * 6;
      bCtx.lineTo(cx, y);
    }
    bCtx.stroke();
  }

  for (let i = 0; i < 14; i++) {
    const kx = rand() * size;
    const ky = rand() * size;
    const kr = 4 + rand() * 9;
    ctx.fillStyle = 'rgba(48, 28, 14, 0.55)';
    ctx.beginPath();
    ctx.ellipse(kx, ky, kr * 0.65, kr * 1.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.needsUpdate = true;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.needsUpdate = true;

  cachedLogBark = { map, bumpMap };
  return cachedLogBark;
}

function getLogRingTextures(): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  if (cachedLogRings) return cachedLogRings;
  const size = 256;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;

  const cx = size * 0.5 + 6;
  const cy = size * 0.5 - 4;
  const maxR = size * 0.49;

  ctx.fillStyle = '#E6D0AC';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#A0A0A0';
  bCtx.fillRect(0, 0, size, size);

  const img = ctx.getImageData(0, 0, size, size);
  const bImg = bCtx.getImageData(0, 0, size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const theta = Math.atan2(dy, dx);
      const r = Math.hypot(dx, dy);
      const warp =
        Math.sin(theta * 3 + r * 0.05) * 4.8 +
        Math.cos(theta * 5 - r * 0.03) * 2.6 +
        Math.sin(theta * 9) * 1.2;
      const rw = r + warp;
      const idx = (y * size + x) * 4;

      // Outer bark rim
      if (rw > maxR * 0.9) {
        img.data[idx] = 88;
        img.data[idx + 1] = 56;
        img.data[idx + 2] = 33;
        img.data[idx + 3] = 255;
        bImg.data[idx] = bImg.data[idx + 1] = bImg.data[idx + 2] = 75;
        bImg.data[idx + 3] = 255;
        continue;
      }

      // Organic hollow / dark heartwood center
      if (rw < 21) {
        const coreMix = Math.max(0, 1 - rw / 21);
        img.data[idx] = Math.round(92 - coreMix * 44);
        img.data[idx + 1] = Math.round(62 - coreMix * 32);
        img.data[idx + 2] = Math.round(38 - coreMix * 20);
        img.data[idx + 3] = 255;
        bImg.data[idx] = bImg.data[idx + 1] = bImg.data[idx + 2] = Math.round(45 + (1 - coreMix) * 55);
        bImg.data[idx + 3] = 255;
        continue;
      }

      // Concentric light-beige uneven growth rings + subtle medullary rays
      const ringWave = Math.sin(rw * 0.54 + Math.sin(theta * 2) * 0.8);
      const ringDark = ringWave > 0.42 ? (ringWave - 0.42) / 0.58 : 0;
      const ray = Math.abs(Math.sin(theta * 22 + rw * 0.04)) > 0.94 ? 0.14 : 0;
      const tone = 1 - ringDark * 0.24 - ray;

      img.data[idx] = Math.min(255, Math.round(234 * tone));
      img.data[idx + 1] = Math.min(255, Math.round(211 * tone));
      img.data[idx + 2] = Math.min(255, Math.round(170 * tone));
      img.data[idx + 3] = 255;
      const bv = Math.round(165 - ringDark * 65);
      bImg.data[idx] = bImg.data[idx + 1] = bImg.data[idx + 2] = bv;
      bImg.data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  bCtx.putImageData(bImg, 0, 0);

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.needsUpdate = true;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.needsUpdate = true;

  cachedLogRings = { map, bumpMap };
  return cachedLogRings;
}

export function createPartMaterial(finish: ObjectSurfaceFinish, isCutter = false): THREE.MeshStandardMaterial {
  if (isCutter) {
    return new THREE.MeshStandardMaterial({
      color: '#F43F5E',
      roughness: 0.35,
      metalness: 0.1,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
  }

  let mat: THREE.MeshStandardMaterial;
  if (finish.materialId) {
    mat = createBuildingSurfaceMaterial(finish.materialId);
    if (finish.color && finish.color.toUpperCase() !== '#FFFFFF') {
      mat.color.multiply(new THREE.Color(finish.color));
    }
    mat.roughness = finish.roughness;
    mat.metalness = finish.metalness;
  } else {
    mat = new THREE.MeshStandardMaterial({
      color: finish.color || '#CBD5E1',
      roughness: finish.roughness,
      metalness: finish.metalness,
    });
  }

  if (finish.proceduralSurface === 'logBark') {
    const tex = getLogBarkTextures();
    mat.map = tex.map;
    mat.bumpMap = tex.bumpMap;
    mat.bumpScale = 0.065;
    mat.roughness = Math.max(mat.roughness, 0.88);
    mat.metalness = 0;
  } else if (finish.proceduralSurface === 'logRings') {
    const tex = getLogRingTextures();
    mat.map = tex.map;
    mat.bumpMap = tex.bumpMap;
    mat.bumpScale = 0.045;
    mat.roughness = Math.max(mat.roughness, 0.82);
    mat.metalness = 0;
  }

  const wPreset = finish.weathering ?? 'none';
  const wAmt = THREE.MathUtils.clamp(finish.weatheringIntensity ?? 0.35, 0, 1);
  if (wPreset !== 'none' && wAmt > 0.01) {
    const wt = WEATHERING_TINT[wPreset];
    mat.color.lerp(new THREE.Color(wt.hex), wAmt * 0.55);
    mat.roughness = THREE.MathUtils.clamp(mat.roughness + wt.roughnessDelta * wAmt, 0.06, 0.99);
  }

  if (finish.emissive && (finish.emissiveIntensity ?? 0) > 0) {
    mat.emissive = new THREE.Color(finish.emissive);
    mat.emissiveIntensity = finish.emissiveIntensity ?? 1;
  }

  return mat;
}

export interface BuiltObjectMakerScene {
  root: THREE.Group;
  partMeshes: Map<string, THREE.Mesh>;
  groupNodes: Map<string, THREE.Group>;
}

export function buildObjectMakerSceneGroup(
  doc: ObjectMakerDoc,
  includeCutters = true
): BuiltObjectMakerScene {
  const root = new THREE.Group();
  root.name = 'ObjectRoot';

  const partMeshes = new Map<string, THREE.Mesh>();
  const groupNodes = new Map<string, THREE.Group>();

  for (const grp of doc.groups) {
    const g = new THREE.Group();
    g.name = sanitizeObjectNodeName(grp.name, `Group_${grp.id.slice(0, 4)}`);
    g.position.set(grp.position[0], grp.position[1], grp.position[2]);
    g.rotation.set(
      THREE.MathUtils.degToRad(grp.rotation[0]),
      THREE.MathUtils.degToRad(grp.rotation[1]),
      THREE.MathUtils.degToRad(grp.rotation[2])
    );
    g.scale.set(grp.scale[0], grp.scale[1], grp.scale[2]);
    g.userData.groupId = grp.id;
    groupNodes.set(grp.id, g);
  }

  for (const grp of doc.groups) {
    const node = groupNodes.get(grp.id)!;
    const parent = grp.parentGroupId ? groupNodes.get(grp.parentGroupId) : undefined;
    (parent ?? root).add(node);
  }

  for (const part of doc.parts) {
    if (part.hidden) continue;
    if (part.isCutter && !includeCutters) continue;
    const geo = buildPartGeometry(part);
    const mat =
      !part.isCutter && (isPlantShape(part.shape) || part.plantParams)
        ? createPlantPartMaterial(part.material, part.plantParams)
        : createPartMaterial(part.material, Boolean(part.isCutter));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = sanitizeObjectNodeName(part.name, `Part_${part.id.slice(0, 4)}`);
    mesh.position.set(part.position[0], part.position[1], part.position[2]);
    mesh.rotation.set(
      THREE.MathUtils.degToRad(part.rotation[0]),
      THREE.MathUtils.degToRad(part.rotation[1]),
      THREE.MathUtils.degToRad(part.rotation[2])
    );
    mesh.userData.partId = part.id;
    mesh.userData.isCutter = Boolean(part.isCutter);
    if (!part.isCutter && (isPlantShape(part.shape) || part.plantParams)) {
      mesh.userData.paintPart =
        part.shape === 'stemCurved' || part.shape === 'bulbCorm' || part.shape === 'vineTendril'
          ? 'branches'
          : 'leaves';
    }

    const parent = part.parentGroupId ? groupNodes.get(part.parentGroupId) : undefined;
    (parent ?? root).add(mesh);
    partMeshes.set(part.id, mesh);
  }

  enableShadows(root);
  return { root, partMeshes, groupNodes };
}

/**
 * Computes world-space Transform of a node inside ObjectMakerDoc (useful for Boolean CSG and Curve Arraying).
 */
export function computePartWorldMatrix(doc: ObjectMakerDoc, part: ObjectPartSpec): THREE.Matrix4 {
  const mat = new THREE.Matrix4().compose(
    new THREE.Vector3(...part.position),
    new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        THREE.MathUtils.degToRad(part.rotation[0]),
        THREE.MathUtils.degToRad(part.rotation[1]),
        THREE.MathUtils.degToRad(part.rotation[2])
      )
    ),
    new THREE.Vector3(1, 1, 1)
  );
  let pid = part.parentGroupId;
  let guard = 0;
  while (pid && guard < 16) {
    guard++;
    const grp = doc.groups.find((g) => g.id === pid);
    if (!grp) break;
    const gMat = new THREE.Matrix4().compose(
      new THREE.Vector3(...grp.position),
      new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
          THREE.MathUtils.degToRad(grp.rotation[0]),
          THREE.MathUtils.degToRad(grp.rotation[1]),
          THREE.MathUtils.degToRad(grp.rotation[2])
        )
      ),
      new THREE.Vector3(...grp.scale)
    );
    mat.premultiply(gMat);
    pid = grp.parentGroupId;
  }
  return mat;
}

/**
 * Normalizes root X/Z center to 0 and grounds bottom Y=0 in place inside ObjectMakerDoc
 * so saved GLBs and mechanism pivots share exact 1:1 local coordinates.
 */
export function centerAndGroundObjectDoc(doc: ObjectMakerDoc): {
  doc: ObjectMakerDoc;
  shift: [number, number, number];
} {
  const { root } = buildObjectMakerSceneGroup(doc, false);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) {
    return { doc, shift: [0, 0, 0] };
  }
  const center = new THREE.Vector3();
  box.getCenter(center);
  const dx = -center.x;
  const dy = -box.min.y;
  const dz = -center.z;

  if (Math.abs(dx) < 0.002 && Math.abs(dy) < 0.002 && Math.abs(dz) < 0.002) {
    return { doc, shift: [0, 0, 0] };
  }

  const shiftedParts = doc.parts.map((p) => {
    if (p.parentGroupId) return p;
    return {
      ...p,
      position: [
        Number((p.position[0] + dx).toFixed(4)),
        Number((p.position[1] + dy).toFixed(4)),
        Number((p.position[2] + dz).toFixed(4)),
      ] as [number, number, number],
    };
  });
  const shiftedGroups = doc.groups.map((g) => {
    if (g.parentGroupId) return g;
    return {
      ...g,
      position: [
        Number((g.position[0] + dx).toFixed(4)),
        Number((g.position[1] + dy).toFixed(4)),
        Number((g.position[2] + dz).toFixed(4)),
      ] as [number, number, number],
    };
  });

  return {
    doc: {
      ...doc,
      parts: shiftedParts,
      groups: shiftedGroups,
    },
    shift: [dx, dy, dz],
  };
}

export async function exportObjectGroupToGlbBuffer(group: THREE.Object3D): Promise<ArrayBuffer> {
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(group, { binary: true });
  if (result instanceof ArrayBuffer) {
    return result;
  }
  throw new Error('Expected binary ArrayBuffer from GLTFExporter');
}

export async function buildAndExportObjectDocToGlb(
  doc: ObjectMakerDoc
): Promise<{ buffer: ArrayBuffer; root: THREE.Group }> {
  const { root } = buildObjectMakerSceneGroup(doc, false);
  const buffer = await exportObjectGroupToGlbBuffer(root);
  return { buffer, root };
}
