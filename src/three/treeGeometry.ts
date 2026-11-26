import * as THREE from 'three';
import { mergeAndOptimizeGeometries } from './webglUtils';

function scaleUVs(geo: THREE.BufferGeometry, su: number, sv: number) {
  const uv = geo.attributes.uv as THREE.BufferAttribute | undefined;
  if (!uv) return;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  }
  uv.needsUpdate = true;
}

export interface TrunkBranchSpec {
  startY: number;
  length: number;
  rBottom: number;
  rTop: number;
  tilt: number;
  yaw: number;
  bend?: number;
}

export interface OrganicTrunkOptions {
  rTop: number;
  rBottom: number;
  height: number;
  yOffset?: number;
  radialSegs?: number;
  heightSegs?: number;
  rootCount?: number;
  rootFlare?: number;
  curveX?: number;
  curveZ?: number;
  barkFlute?: number;
  uvScaleU?: number;
  uvScaleV?: number;
  branches?: TrunkBranchSpec[];
}

/**
 * Builds a higher-polygon organic trunk with buttress root flares, subtle natural
 * bend, bark ridge fluting, and optional merged upper boughs/branches.
 */
export function createOrganicTrunkGeometry(opts: OrganicTrunkOptions): THREE.BufferGeometry {
  const {
    rTop,
    rBottom,
    height,
    yOffset = 0,
    radialSegs = 14,
    heightSegs = 9,
    rootCount = 5,
    rootFlare = 0.34,
    curveX = 0.08,
    curveZ = 0.05,
    barkFlute = 0.055,
    uvScaleU = 2.0,
    uvScaleV = 2.4,
    branches = [],
  } = opts;

  const mainGeo = new THREE.CylinderGeometry(rTop, rBottom, height, radialSegs, heightSegs, false);
  const pos = mainGeo.attributes.position as THREE.BufferAttribute;
  const halfH = height * 0.5;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = THREE.MathUtils.clamp((y + halfH) / height, 0, 1); // 0 = base, 1 = top
    const radial = Math.hypot(x, z);
    const bendX = Math.sin(t * Math.PI * 0.95) * curveX + t * t * curveX * 0.35;
    const bendZ = Math.sin(t * Math.PI * 1.15 + 0.6) * curveZ;

    if (radial < 0.001) {
      pos.setXYZ(i, x + bendX, y + halfH + yOffset, z + bendZ);
      continue;
    }

    const angle = Math.atan2(z, x);
    // Flared buttress roots spreading outward at the base
    const rootT = Math.pow(Math.max(0, 1 - t / 0.34), 2.1);
    const rootLobe = 0.5 + 0.5 * Math.cos(angle * rootCount + 0.4);
    const flareScale = 1 + rootT * rootFlare * (0.45 + 0.95 * rootLobe);

    // Subtle organic bark ridges & slight gnarled swelling along height
    const ridge =
      1 +
      Math.sin(angle * 7 + t * 2.2) * barkFlute +
      Math.cos(angle * 4 - t * 5.2) * (barkFlute * 0.55);

    const nx = x * flareScale * ridge + bendX;
    const nz = z * flareScale * ridge + bendZ;
    pos.setXYZ(i, nx, y + halfH + yOffset, nz);
  }
  mainGeo.computeVertexNormals();
  scaleUVs(mainGeo, uvScaleU, uvScaleV);

  if (branches.length === 0) {
    return mainGeo;
  }

  const parts: THREE.BufferGeometry[] = [mainGeo];

  for (const b of branches) {
    const bGeo = new THREE.CylinderGeometry(b.rTop, b.rBottom, b.length, 9, 5, false);
    const bPos = bGeo.attributes.position as THREE.BufferAttribute;
    const bHalf = b.length * 0.5;
    const bBend = b.bend ?? 0.08;
    for (let i = 0; i < bPos.count; i++) {
      const bx = bPos.getX(i);
      const by = bPos.getY(i);
      const bz = bPos.getZ(i);
      const bt = THREE.MathUtils.clamp((by + bHalf) / b.length, 0, 1);
      // Slight upward bow along the limb
      bPos.setXYZ(i, bx + Math.sin(bt * Math.PI) * bBend, by + bHalf, bz);
    }
    scaleUVs(bGeo, 1.35, 1.45);
    bGeo.rotateZ(-b.tilt);
    bGeo.rotateY(b.yaw);

    // Anchor at trunk centerline curve at startY
    const anchorT = THREE.MathUtils.clamp((b.startY - yOffset) / height, 0, 1);
    const ax = Math.sin(anchorT * Math.PI * 0.95) * curveX + anchorT * anchorT * curveX * 0.35;
    const az = Math.sin(anchorT * Math.PI * 1.15 + 0.6) * curveZ;
    bGeo.translate(ax, b.startY, az);
    bGeo.computeVertexNormals();
    parts.push(bGeo);
  }

  const merged = mergeAndOptimizeGeometries(parts, {
    computeNormals: true,
    computeBounds: true,
  });
  if (!merged) {
    return createOrganicTrunkGeometry({ ...opts, branches: [] });
  }
  return merged;
}

/**
 * Builds a higher-polygon sculpted pine bough tier with arched drooping star-lobed
 * evergreen branches and scalloped needle ridges.
 */
export function createDetailedPineTierGeometry(
  radius: number,
  height: number,
  points = 11,
  seed = 1
): THREE.BufferGeometry {
  const segs = points * 2;
  const heightSegs = 4;
  const geo = new THREE.CylinderGeometry(radius * 0.055, radius, height, segs, heightSegs, false);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const halfH = height * 0.5;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const radial = Math.hypot(x, z);
    if (radial < 0.04) continue;

    // Normalized position from apex (0) to lower bough skirt (1)
    const downT = THREE.MathUtils.clamp((halfH - y) / height, 0, 1);
    const angle = Math.atan2(z, x);

    // Smoothly sculpted bough lobes using continuous trig so seam vertices match identically
    const lobeWave = Math.cos(angle * points + seed * 1.3);
    const subLobe = Math.sin(angle * (points * 2) - seed * 0.7) * 0.22;
    const asymmetry = 1 + 0.075 * Math.sin(angle * 3 + seed * 2.1) + 0.045 * Math.cos(angle * 2 - seed);

    // Slightly concave graceful conifer curve (bell-shaped skirt)
    const skirtBell = 1 + Math.pow(downT, 1.55) * 0.16;
    const lobeAmp = 0.06 + 0.23 * Math.pow(downT, 1.15);
    const rScale = skirtBell * asymmetry * (1 + lobeAmp * (lobeWave + subLobe));

    // Drooping bough tips on outer lobes, tucked up slightly in valleys
    const droop = Math.pow(downT, 1.45) * height * (0.14 * Math.max(0, lobeWave) - 0.05 * Math.max(0, -lobeWave));
    // Softly lift the very bottom inner cap edge so underside doesn't look flat
    const yNew = y - droop;

    pos.setXYZ(i, x * rScale, yNew, z * rScale);
  }

  geo.computeVertexNormals();
  scaleUVs(geo, 3.0, 1.65);
  return geo;
}

/**
 * Builds a higher-polygon sculpted organic broadleaf/birch foliage cluster using
 * direction-based multi-octave lobe displacement (100% watertight at UV seam).
 */
export function createSculptedCanopyLobeGeometry(
  radius: number,
  sx = 1.15,
  sy = 0.88,
  sz = 1.1,
  seed = 1,
  widthSegs = 20,
  heightSegs = 14,
  uvScaleU = 2.6,
  uvScaleV = 1.85
): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(radius, widthSegs, heightSegs);
  const pos = geo.attributes.position as THREE.BufferAttribute;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const len = Math.hypot(x, y, z) || 1;
    const nx = x / len;
    const ny = y / len;
    const nz = z / len;

    // Multi-octave leafy bough bumps keyed solely on unit direction (seamless wrap!)
    const bump1 =
      Math.sin(nx * 3.8 + seed * 1.7) *
      Math.cos(nz * 3.5 - seed * 1.1) *
      Math.cos(ny * 2.9 + seed * 0.5);
    const bump2 =
      Math.sin((nx * 6.4 - nz * 5.8) + seed * 2.3) *
      Math.sin((ny * 6.1 + nx * 4.2) - seed);
    const bump3 = Math.cos((nx + ny + nz) * 8.2 + seed * 3.1);

    const disp = 1.0 + bump1 * 0.16 + bump2 * 0.075 + bump3 * 0.032;

    // Softly flatten underside of foliage puffs so they rest naturally over branches
    const underFlatten = ny < -0.2 ? 1.0 + (ny + 0.2) * 0.22 : 1.0;

    pos.setXYZ(
      i,
      x * sx * disp,
      y * sy * disp * underFlatten,
      z * sz * disp
    );
  }

  geo.computeVertexNormals();
  scaleUVs(geo, uvScaleU, uvScaleV);
  return geo;
}

/**
 * Builds a higher-polygon root-flared tree stump retaining CylinderGeometry's 3
 * material groups ([side bark, cut wood-rings top, bottom]).
 */
export function createFlutedStumpGeometry(
  rTop: number,
  rBottom: number,
  height: number
): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(rTop, rBottom, height, 14, 5, false);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const halfH = height * 0.5;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const radial = Math.hypot(x, z);
    if (radial < 0.001) continue;

    const t = THREE.MathUtils.clamp((y + halfH) / height, 0, 1);
    const angle = Math.atan2(z, x);
    const rootT = Math.pow(Math.max(0, 1 - t), 1.65);
    const lobe = 0.5 + 0.5 * Math.cos(angle * 5 + 0.35);
    const flare = 1 + rootT * 0.38 * (0.45 + 0.9 * lobe);
    const barkRipple = 1 + Math.sin(angle * 7) * 0.045;
    pos.setXYZ(i, x * flare * barkRipple, y, z * flare * barkRipple);
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a gracefully arched, curved ribbon blade (3 vertical segments) for grass & fern fronds.
 */
function createArchedBladeGeometry(
  baseWidth: number,
  length: number,
  archOut: number,
  droopTip: number,
  taperPower = 0.72,
  segments = 4,
  cupDepth = 0.018
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let s = 0; s <= segments; s++) {
    const t = s / segments;
    const widthFactor = Math.pow(Math.max(0, 1 - t), taperPower);
    const halfW = baseWidth * 0.5 * widthFactor;
    const zCurve = archOut * Math.pow(t, 1.35);
    const yCurve = length * t - droopTip * Math.pow(t, 2.35);
    const cup = cupDepth * (1 - t * 0.65);

    // 3 vertices across blade width (left edge, center midrib, right edge) for subtle 3D V-cupping
    positions.push(-halfW, yCurve, zCurve);
    positions.push(0, yCurve + cup, zCurve - cup * 0.4);
    positions.push(halfW, yCurve, zCurve);

    uvs.push(0, t, 0.5, t, 1, t);
  }

  for (let s = 0; s < segments; s++) {
    const row0 = s * 3;
    const row1 = (s + 1) * 3;
    // Left half
    indices.push(row0, row0 + 1, row1, row0 + 1, row1 + 1, row1);
    // Right half
    indices.push(row0 + 1, row0 + 2, row1 + 1, row0 + 2, row1 + 2, row1 + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds two merged curved-blade grass tuft geometries (inner dense blades + taller outer sun-tipped blades)
 * so lush multi-blade grass renders in just 2 instanced draw calls across the entire island.
 */
export function createCurvedGrassTuftGeometries(): {
  innerGeo: THREE.BufferGeometry;
  outerGeo: THREE.BufferGeometry;
} {
  const innerParts: THREE.BufferGeometry[] = [];
  const outerParts: THREE.BufferGeometry[] = [];

  const innerSpecs: [number, number, number, number, number, number][] = [
    // [yaw, offsetR, width, height, archOut, droop]
    [0.0, 0.04, 0.12, 0.62, 0.24, 0.08],
    [1.25, 0.06, 0.11, 0.54, 0.22, 0.07],
    [2.5, 0.05, 0.12, 0.66, 0.26, 0.09],
    [3.8, 0.06, 0.11, 0.58, 0.23, 0.08],
    [5.05, 0.04, 0.11, 0.52, 0.2, 0.06],
  ];

  const outerSpecs: [number, number, number, number, number, number][] = [
    [0.55, 0.08, 0.11, 0.88, 0.36, 0.16],
    [1.82, 0.09, 0.1, 0.78, 0.33, 0.14],
    [3.12, 0.08, 0.11, 0.92, 0.38, 0.18],
    [4.42, 0.09, 0.1, 0.82, 0.34, 0.15],
    [5.68, 0.07, 0.1, 0.74, 0.3, 0.13],
  ];

  for (const [yaw, offR, w, h, arch, droop] of innerSpecs) {
    const b = createArchedBladeGeometry(w, h, arch, droop, 0.75, 4, 0.016);
    b.translate(0, -0.14, offR);
    b.rotateY(yaw);
    innerParts.push(b);
  }

  for (const [yaw, offR, w, h, arch, droop] of outerSpecs) {
    const b = createArchedBladeGeometry(w, h, arch, droop, 0.8, 4, 0.015);
    b.translate(0, -0.14, offR);
    b.rotateY(yaw);
    outerParts.push(b);
  }

  const innerGeo = mergeAndOptimizeGeometries(innerParts, {
    computeNormals: true,
    computeBounds: true,
  })!;
  const outerGeo = mergeAndOptimizeGeometries(outerParts, {
    computeNormals: true,
    computeBounds: true,
  })!;
  return { innerGeo, outerGeo };
}

/**
 * Builds a lush woodland fern rosette (7 gracefully arching scalloped fronds) in a single BufferGeometry.
 */
export function createFernRosetteGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const frondCount = 7;

  for (let f = 0; f < frondCount; f++) {
    const yaw = (f / frondCount) * Math.PI * 2 + (f % 2) * 0.18;
    const isOuter = f % 2 === 0;
    const len = isOuter ? 0.92 : 0.68;
    const wid = isOuter ? 0.34 : 0.27;
    const arch = isOuter ? 0.78 : 0.52;
    const droop = isOuter ? 0.42 : 0.22;

    // Scalloped serrated fern frond profile across 6 segments
    const segs = 6;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      // Widest around t = 0.32, tapering smoothly to a fine pointed tip
      const env = Math.sin(Math.pow(t, 0.78) * Math.PI);
      const serration = s > 0 && s < segs ? (s % 2 === 0 ? 1.08 : 0.84) : 1.0;
      const halfW = wid * 0.5 * env * serration;
      const zCurve = arch * Math.pow(t, 1.15);
      const yCurve = len * Math.sin(t * Math.PI * 0.62) - droop * Math.pow(t, 2.2) - 0.1;
      const ridge = 0.024 * env;

      positions.push(-halfW, yCurve, zCurve);
      positions.push(0, yCurve + ridge, zCurve - 0.01);
      positions.push(halfW, yCurve, zCurve);
      uvs.push(0, t, 0.5, t, 1, t);
    }
    for (let s = 0; s < segs; s++) {
      const r0 = s * 3;
      const r1 = (s + 1) * 3;
      indices.push(r0, r0 + 1, r1, r0 + 1, r1 + 1, r1);
      indices.push(r0 + 1, r0 + 2, r1 + 1, r0 + 2, r1 + 2, r1 + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.rotateY(yaw);
    geo.computeVertexNormals();
    parts.push(geo);
  }

  const merged = mergeAndOptimizeGeometries(parts, {
    computeNormals: true,
    computeBounds: true,
  })!;
  return merged;
}

/**
 * Builds a ground-hugging broadleaf woodland hosta / forest plant rosette (6 cupped wide leaves).
 */
export function createBroadleafPlantGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const leafCount = 6;

  for (let l = 0; l < leafCount; l++) {
    const yaw = (l / leafCount) * Math.PI * 2 + (l % 2) * 0.25;
    const isInner = l % 2 === 1;
    const len = isInner ? 0.52 : 0.68;
    const maxW = isInner ? 0.34 : 0.42;
    const arch = isInner ? 0.4 : 0.58;
    const lift = isInner ? 0.46 : 0.34;
    const segs = 5;

    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      // Broad heart/ovate silhouette peaking around t = 0.45
      const widthEnv = Math.sin(Math.pow(t, 0.85) * Math.PI);
      const halfW = maxW * 0.5 * widthEnv;
      const zCurve = 0.04 + arch * Math.pow(t, 1.05);
      const yCurve = -0.1 + lift * Math.sin(t * Math.PI * 0.72) - 0.16 * Math.pow(t, 2.3);
      const cup = -0.042 * widthEnv; // softly cupped downward center midrib

      positions.push(-halfW, yCurve - cup * 0.4, zCurve);
      positions.push(0, yCurve + cup, zCurve);
      positions.push(halfW, yCurve - cup * 0.4, zCurve);
      uvs.push(0, t, 0.5, t, 1, t);
    }
    for (let s = 0; s < segs; s++) {
      const r0 = s * 3;
      const r1 = (s + 1) * 3;
      indices.push(r0, r0 + 1, r1, r0 + 1, r1 + 1, r1);
      indices.push(r0 + 1, r0 + 2, r1 + 1, r0 + 2, r1 + 2, r1 + 1);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.rotateY(yaw);
    geo.computeVertexNormals();
    parts.push(geo);
  }

  const merged = mergeAndOptimizeGeometries(parts, {
    computeNormals: true,
    computeBounds: true,
  })!;
  return merged;
}

/**
 * Builds a merged cluster of wild berries/blossoms perched across the outside of a berry shrub.
 */
export function createShrubBerryClusterGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const pts: [number, number, number, number][] = [
    [0.42, 0.62, 0.34, 0.072],
    [0.54, 0.48, 0.24, 0.062],
    [0.34, 0.54, 0.46, 0.064],
    [-0.44, 0.58, 0.32, 0.07],
    [-0.56, 0.45, 0.18, 0.06],
    [-0.36, 0.66, -0.34, 0.068],
    [0.24, 0.72, -0.38, 0.072],
    [0.46, 0.52, -0.28, 0.062],
    [-0.12, 0.78, 0.22, 0.066],
    [0.08, 0.82, -0.08, 0.07],
    [-0.48, 0.46, -0.22, 0.058],
    [0.16, 0.56, 0.52, 0.062],
  ];
  for (const [bx, by, bz, br] of pts) {
    const s = new THREE.SphereGeometry(br, 7, 5);
    s.translate(bx, by, bz);
    parts.push(s);
  }
  const merged = mergeAndOptimizeGeometries(parts, {
    computeNormals: true,
    computeBounds: true,
  })!;
  return merged;
}

/**
 * Builds a charming 3-mushroom woodland cluster (stems & domed caps separated for distinct coloring).
 */
export function createMushroomClusterGeometries(): {
  stemGeo: THREE.BufferGeometry;
  capGeo: THREE.BufferGeometry;
} {
  const stems: THREE.BufferGeometry[] = [];
  const caps: THREE.BufferGeometry[] = [];

  const specs: [number, number, number, number, number, number][] = [
    // [ox, oz, height, capR, tiltX, tiltZ]
    [0, 0, 0.34, 0.22, 0.06, -0.05],
    [0.2, 0.12, 0.24, 0.15, -0.14, 0.18],
    [-0.17, 0.14, 0.2, 0.13, 0.16, -0.2],
  ];

  for (const [ox, oz, h, capR, tx, tz] of specs) {
    const stem = new THREE.CylinderGeometry(capR * 0.22, capR * 0.32, h + 0.12, 8, 2);
    stem.translate(0, h * 0.5 - 0.06, 0);
    stem.rotateX(tx);
    stem.rotateZ(tz);
    stem.translate(ox, 0, oz);
    stems.push(stem);

    // Fluted dome mushroom cap
    const cap = new THREE.SphereGeometry(capR, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58);
    cap.scale(1.0, 0.72, 1.0);
    cap.translate(0, h * 0.92, 0);
    cap.rotateX(tx);
    cap.rotateZ(tz);
    cap.translate(ox, 0, oz);
    caps.push(cap);
  }

  const stemGeo = mergeAndOptimizeGeometries(stems, {
    computeNormals: true,
    computeBounds: true,
  })!;
  const capGeo = mergeAndOptimizeGeometries(caps, {
    computeNormals: true,
    computeBounds: true,
  })!;
  return { stemGeo, capGeo };
}

