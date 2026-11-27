import * as THREE from 'three';
import { mergeAndOptimizeGeometries } from './webglUtils';
import type {
  FeatureFrequency,
  SceneryTextureSlot,
  StylizedCanopyConfig,
  SurfaceTextureSettings,
  TreeBarkStyle,
  TreeSpeciesType,
  VisualStyleId,
} from '../types/maker';
import { applySurfaceTextureToMaterial } from './customTextureManager';
import { getCachedAssetSync } from './gltfAssetManager';
import { getTerrainTextureAtlas } from './proceduralTextures';
import { getProceduralBarkTextures } from './treeBarkTextures';

export interface TwigAttachment {
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  scale: number;
}

export interface BranchAnchor {
  origin: THREE.Vector3;
  mid: THREE.Vector3;
  tip: THREE.Vector3;
  length: number;
  thickness: number;
  yaw: number;
}

export interface BuiltTreeBase {
  group: THREE.Group;
  trunkTopY: number;
  trunkCurve: THREE.CatmullRomCurve3;
  branchTips: THREE.Vector3[];
  branchAnchors: BranchAnchor[];
  twigAttachments: TwigAttachment[];
  hasHollow: boolean;
  hasRoots: boolean;
}

export function hashTreeSeed(input: string, masterSeed: number): number {
  let h = (masterSeed | 0) ^ 0x9e3779b9;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 0x85ebca6b);
    h = (h ^ (h >>> 13)) >>> 0;
  }
  return h >>> 0;
}

export function createTreePrng(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shouldTriggerFrequency(
  mode: FeatureFrequency | undefined,
  randVal: number,
  previewIndex?: number
): boolean {
  if (!mode || mode === 'none') return false;
  if (mode === 'all') return true;
  if (previewIndex !== undefined) {
    // Ensure Studio 3-tree preview reliably demonstrates 'some' (1 of 3) and 'lots' (2 of 3)
    if (mode === 'some') return previewIndex === 1;
    if (mode === 'lots') return previewIndex !== 0;
  }
  if (mode === 'some') return randVal < 0.36;
  return randVal < 0.72;
}

/**
 * Computes twist-free parallel-transport (Bishop) frames along a curve so bark UVs
 * never pinch or flip on curved trunks, limbs, or arching roots.
 */
function computeParallelTransportFrames(
  curve: THREE.CatmullRomCurve3,
  segments: number
): { tangents: THREE.Vector3[]; normals: THREE.Vector3[]; binormals: THREE.Vector3[] } {
  const tangents: THREE.Vector3[] = [];
  const normals: THREE.Vector3[] = [];
  const binormals: THREE.Vector3[] = [];

  for (let i = 0; i <= segments; i++) {
    tangents.push(curve.getTangentAt(i / segments).normalize());
  }

  // Pick a stable initial normal perpendicular to tangents[0]
  const t0 = tangents[0];
  const ref = Math.abs(t0.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const n0 = new THREE.Vector3().crossVectors(ref, t0).normalize();
  const b0 = new THREE.Vector3().crossVectors(t0, n0).normalize();
  normals.push(n0);
  binormals.push(b0);

  const axis = new THREE.Vector3();
  const q = new THREE.Quaternion();
  for (let i = 1; i <= segments; i++) {
    const prevT = tangents[i - 1];
    const currT = tangents[i];
    const n = normals[i - 1].clone();
    axis.crossVectors(prevT, currT);
    const axisLen = axis.length();
    if (axisLen > 1e-5) {
      axis.divideScalar(axisLen);
      const angle = Math.acos(THREE.MathUtils.clamp(prevT.dot(currT), -1, 1));
      q.setFromAxisAngle(axis, angle);
      n.applyQuaternion(q);
    }
    // Re-orthogonalize to prevent drift
    n.addScaledVector(currT, -n.dot(currT)).normalize();
    const b = new THREE.Vector3().crossVectors(currT, n).normalize();
    normals.push(n);
    binormals.push(b);
  }

  return { tangents, normals, binormals };
}

/**
 * Builds a solid, outward-facing, tapered, optionally gnarled curved tube along a CatmullRomCurve3.
 * Uses twist-free parallel-transport frames and outward triangle winding so bark textures stay
 * completely solid and seamless across trunks, branches, and roots!
 */
export function buildTaperedCurveTube(opts: {
  curve: THREE.CatmullRomCurve3;
  tubularSegs: number;
  radialSegs: number;
  rStart: number;
  rEnd: number;
  uvScaleU?: number;
  uvScaleV?: number;
  uvOffsetV?: number;
  capEnd?: boolean;
  radiusMod?: (t: number, angle: number) => number;
}): THREE.BufferGeometry {
  const {
    curve,
    tubularSegs,
    radialSegs,
    rStart,
    rEnd,
    uvScaleU = 1.6,
    uvScaleV = 0.65,
    uvOffsetV = 0,
    capEnd = true,
    radiusMod,
  } = opts;

  const frames = computeParallelTransportFrames(curve, tubularSegs);
  const length = Math.max(0.05, curve.getLength());
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const pt = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const binormal = new THREE.Vector3();
  const vPos = new THREE.Vector3();

  for (let i = 0; i <= tubularSegs; i++) {
    const t = i / tubularSegs;
    curve.getPointAt(t, pt);
    normal.copy(frames.normals[i]);
    binormal.copy(frames.binormals[i]);

    const baseR = THREE.MathUtils.lerp(rStart, rEnd, Math.pow(t, 0.88));
    const vCoord = uvOffsetV + t * length * uvScaleV;

    for (let j = 0; j <= radialSegs; j++) {
      const uFrac = j / radialSegs;
      const angle = uFrac * Math.PI * 2;
      const mod = radiusMod ? radiusMod(t, angle) : 1.0;
      const r = Math.max(0.0015, baseR * mod);

      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      vPos
        .copy(pt)
        .addScaledVector(normal, cosA * r)
        .addScaledVector(binormal, sinA * r);

      positions.push(vPos.x, vPos.y, vPos.z);
      uvs.push(uFrac * uvScaleU, vCoord);
    }
  }

  // Strictly OUTWARD-facing counter-clockwise winding: (d - a) x (b - a) = thetaHat x T = +R
  const ringStride = radialSegs + 1;
  for (let i = 0; i < tubularSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * ringStride + j;
      const b = (i + 1) * ringStride + j;
      const c = (i + 1) * ringStride + (j + 1);
      const d = i * ringStride + (j + 1);
      indices.push(a, d, b, b, d, c);
    }
  }

  if (capEnd) {
    const tipIdx = positions.length / 3;
    const tipPt = curve.getPointAt(1);
    positions.push(tipPt.x, tipPt.y, tipPt.z);
    uvs.push(0.5, uvOffsetV + length * uvScaleV);
    const lastRing = tubularSegs * ringStride;
    for (let j = 0; j < radialSegs; j++) {
      indices.push(lastRing + j, lastRing + j + 1, tipIdx);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function createTreeBarkMaterial(
  config: StylizedCanopyConfig,
  style: VisualStyleId,
  sceneryTextures?: Partial<Record<SceneryTextureSlot, SurfaceTextureSettings>>
): THREE.Material {
  const barkStyle: TreeBarkStyle = config.barkStyle ?? 'oak';
  const barkColor = config.barkColor || '#72503A';
  const lineIntensity = config.barkLineIntensity ?? 0.58;
  const lineDensity = config.barkLineDensity ?? 1.0;
  const bumpStrength = config.barkBumpStrength ?? 0.45;

  const customBarkTex =
    config.barkTexture?.enabled && config.barkTexture.textureId
      ? config.barkTexture
      : sceneryTextures?.treeBark?.enabled && sceneryTextures.treeBark.textureId
      ? sceneryTextures.treeBark
      : undefined;

  if (customBarkTex) {
    const isToon = style === 'celToon' || barkStyle === 'cartoony';
    const customMat = isToon
      ? new THREE.MeshToonMaterial({
          color: '#FFFFFF',
          gradientMap: getTerrainTextureAtlas().toonGradient,
        })
      : new THREE.MeshStandardMaterial({
          color: '#FFFFFF',
          roughness: customBarkTex.roughness ?? 0.88,
          metalness: barkStyle === 'fantasy' ? 0.08 : 0.01,
        });
    if (
      applySurfaceTextureToMaterial(customMat, customBarkTex, {
        baseTintHex: barkColor,
        isToon,
      })
    ) {
      if (!isToon && barkStyle === 'fantasy' && 'emissive' in customMat) {
        customMat.emissive = new THREE.Color('#3B2A6E');
        customMat.emissiveIntensity = 0.22;
      }
      return customMat;
    }
    customMat.dispose();
  }

  const { map, normalMap } = getProceduralBarkTextures(
    barkStyle,
    barkColor,
    lineIntensity,
    lineDensity
  );

  const roughness =
    barkStyle === 'birch'
      ? 0.72
      : barkStyle === 'cartoony' || barkStyle === 'painterly'
      ? 0.82
      : barkStyle === 'rough' || barkStyle === 'knotty'
      ? 0.94
      : 0.88;

  const normScale = bumpStrength * 2.2;

  if (style === 'celToon' || barkStyle === 'cartoony') {
    const atlas = getTerrainTextureAtlas();
    return new THREE.MeshToonMaterial({
      color: '#FFFFFF',
      map,
      normalMap: bumpStrength > 0.01 ? normalMap : null,
      normalScale: new THREE.Vector2(normScale * 0.85, normScale * 0.85),
      gradientMap: atlas.toonGradient,
    });
  }

  const mat = new THREE.MeshStandardMaterial({
    color: '#FFFFFF',
    map,
    normalMap: bumpStrength > 0.01 ? normalMap : null,
    normalScale: new THREE.Vector2(normScale, normScale),
    roughness,
    metalness: barkStyle === 'fantasy' ? 0.08 : 0.01,
  });

  if (barkStyle === 'fantasy') {
    mat.emissive = new THREE.Color('#3B2A6E');
    mat.emissiveIntensity = 0.22;
  }

  return mat;
}

/**
 * Builds an organic tree base (gnarled trunk + separate major canopy branches + fine birch twigs
 * + curved arching ground roots + sculpted owl hollow hole) with deterministic per-tree variety!
 */
export function buildProceduralTreeBase(
  config: StylizedCanopyConfig,
  treeKey: string,
  style: VisualStyleId,
  previewIndex?: number,
  sceneryTextures?: Partial<Record<SceneryTextureSlot, SurfaceTextureSettings>>
): BuiltTreeBase {
  const species: TreeSpeciesType = config.treeType ?? 'oak';
  const rand = createTreePrng(hashTreeSeed(`${treeKey}_base`, config.seed));
  const group = new THREE.Group();

  const variety = config.trunkVariety ?? 0.35;
  const hMult = 1 + (rand() - 0.5) * 2 * variety * 0.28;
  const tMult = 1 + (rand() - 0.5) * 2 * variety * 0.24;

  const minTrunkH = species === 'conifer' ? 5.8 : 4.8;
  const trunkHeight = Math.max(minTrunkH, config.trunkHeight) * hMult;
  const thick = Math.max(0.35, config.trunkThickness * tMult);
  const taper = THREE.MathUtils.clamp(config.trunkTaper ?? 0.45, 0.14, 0.88);
  const leanAmt = config.trunkLean ?? 0.28;
  const gnarl = config.gnarlAmount ?? (species === 'fantasy' ? 0.72 : species === 'oak' ? 0.35 : 0.12);

  const rBottom = 0.34 * thick;
  const rTop = Math.max(0.045, rBottom * taper);

  // Build organic curved trunk spine
  const leanDir = rand() * Math.PI * 2;
  const leanMag = leanAmt * (0.28 + rand() * 0.72) * trunkHeight * 0.22;
  const midWiggleDir = leanDir + (rand() - 0.5) * 2.2;
  const midWiggle = (0.04 + gnarl * 0.24 + variety * 0.08) * trunkHeight * 0.18;

  const p0 = new THREE.Vector3(0, -0.32, 0);
  const p1 = new THREE.Vector3(
    Math.cos(leanDir) * leanMag * 0.22 + Math.cos(midWiggleDir) * midWiggle * 0.55,
    trunkHeight * 0.3,
    Math.sin(leanDir) * leanMag * 0.22 + Math.sin(midWiggleDir) * midWiggle * 0.55
  );
  const p2 = new THREE.Vector3(
    Math.cos(leanDir) * leanMag * 0.72 - Math.cos(midWiggleDir) * midWiggle * 0.45,
    trunkHeight * 0.68,
    Math.sin(leanDir) * leanMag * 0.72 - Math.sin(midWiggleDir) * midWiggle * 0.45
  );
  const p3 = new THREE.Vector3(
    Math.cos(leanDir) * leanMag,
    trunkHeight,
    Math.sin(leanDir) * leanMag
  );

  const trunkCurve = new THREE.CatmullRomCurve3([p0, p1, p2, p3]);

  // Check if user bound a custom trunk GLB
  if (config.trunkAssetId) {
    const cached = getCachedAssetSync(config.trunkAssetId);
    if (cached) {
      cached.scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(cached.scene);
      if (!box.isEmpty()) {
        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        box.getCenter(center);
        box.getSize(size);
        const sY = trunkHeight / Math.max(0.01, size.y);
        const sXZ = sY * thick;
        const norm = new THREE.Matrix4()
          .makeScale(sXZ, sY, sXZ)
          .multiply(new THREE.Matrix4().makeTranslation(-center.x, -box.min.y, -center.z));

        cached.scene.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (!mesh.isMesh || !mesh.geometry) return;
          const geo = mesh.geometry.clone();
          geo.applyMatrix4(norm.clone().multiply(mesh.matrixWorld));
          if (!geo.attributes.normal) geo.computeVertexNormals();
          const rawMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
          const m = new THREE.Mesh(
            geo,
            rawMat ? rawMat.clone() : createTreeBarkMaterial(config, style, sceneryTextures)
          );
          m.castShadow = true;
          m.receiveShadow = true;
          m.userData.paintPart = 'branches';
          group.add(m);
        });
        return {
          group,
          trunkTopY: trunkHeight,
          trunkCurve,
          branchTips: [p3.clone()],
          branchAnchors: [],
          twigAttachments: [],
          hasHollow: false,
          hasRoots: false,
        };
      }
    }
  }

  const barkMat = createTreeBarkMaterial(config, style, sceneryTextures);
  const barkParts: THREE.BufferGeometry[] = [];

  // 1. Sculpted gnarled main trunk with root collar flare, helical flutes & organic knots/burls
  const rootLobeCount = 4 + Math.floor(rand() * 3);
  const burlT1 = 0.28 + rand() * 0.24;
  const burlA1 = rand() * Math.PI * 2;
  const burlT2 = 0.54 + rand() * 0.24;
  const burlA2 = burlA1 + 1.8 + rand() * 2.2;
  const flutePhase = rand() * Math.PI * 2;
  const twistRate = (species === 'fantasy' ? 4.2 : 1.6) * gnarl * (rand() > 0.5 ? 1 : -1);

  const trunkGeo = buildTaperedCurveTube({
    curve: trunkCurve,
    tubularSegs: gnarl > 0.45 ? 16 : 12,
    radialSegs: gnarl > 0.45 ? 14 : 12,
    rStart: rBottom,
    rEnd: rTop,
    uvScaleU: 2.0,
    uvScaleV: 0.72,
    capEnd: true,
    radiusMod: (t, angle) => {
      // Base buttress flare
      const flareT = Math.pow(Math.max(0, 1 - t / 0.34), 2.0);
      const flareWave = 0.55 + 0.45 * Math.cos(angle * rootLobeCount + flutePhase);
      const flare = 1 + flareT * (0.34 + gnarl * 0.26) * flareWave;

      // Helical gnarly flutes & bark swelling
      const twistedAngle = angle + t * twistRate;
      const flute =
        1 +
        Math.sin(twistedAngle * 5 + flutePhase) * (0.04 + gnarl * 0.12) +
        Math.cos(twistedAngle * 3 - t * 6.0) * (0.02 + gnarl * 0.08);

      // Raised organic wood burls / knots when gnarl is elevated
      let burl = 0;
      if (gnarl > 0.15) {
        const dt1 = (t - burlT1) / 0.095;
        const da1 = Math.atan2(Math.sin(angle - burlA1), Math.cos(angle - burlA1)) / 0.65;
        const d1 = dt1 * dt1 + da1 * da1;
        if (d1 < 3.5) burl += Math.exp(-d1 * 1.4) * gnarl * 0.36;

        const dt2 = (t - burlT2) / 0.085;
        const da2 = Math.atan2(Math.sin(angle - burlA2), Math.cos(angle - burlA2)) / 0.62;
        const d2 = dt2 * dt2 + da2 * da2;
        if (d2 < 3.5) burl += Math.exp(-d2 * 1.4) * gnarl * 0.3;
      }

      return flare * flute + burl;
    },
  });
  barkParts.push(trunkGeo);

  // 2. Separate Major Branches growing OUT and UP (with bidirectional droop & taper-to-point!)
  const branchTips: THREE.Vector3[] = [];
  const branchAnchors: BranchAnchor[] = [];
  const twigAttachments: TwigAttachment[] = [];
  const majorCount = Math.max(
    0,
    Math.min(7, Math.round(config.majorBranchCount ?? (species === 'conifer' ? 0 : 4)))
  );
  const majorLen = config.majorBranchLength ?? 1.45;
  const majorThick = config.majorBranchThickness ?? 0.95;
  const majorTaper = THREE.MathUtils.clamp(
    config.majorBranchTaper ?? (species === 'birch' ? 0.92 : 0.72),
    0,
    1
  );
  const majorSpread = config.majorBranchSpread ?? 0.84;
  const majorUpward = config.majorBranchUpward ?? 0.52;
  // Bidirectional droop: -1 curves/sweeps upward, 0 = neutral center, +1 droops downward
  const majorDroop = THREE.MathUtils.clamp(config.majorBranchDroop ?? 0.0, -1, 1);
  const birchTwigDensity = config.birchTwigDensity ?? 1.2;
  const birchDroop = config.birchBranchDroop ?? 0.32;

  const trunkLength = trunkCurve.getLength();
  const branchBaseAngle = rand() * Math.PI * 2;

  const minBranchY = Math.max(3.25, trunkHeight * 0.62);

  for (let b = 0; b < majorCount; b++) {
    const startFrac = THREE.MathUtils.clamp(
      (species === 'birch' ? 0.66 : 0.68) + (b / Math.max(1, majorCount)) * 0.24 + (rand() - 0.5) * 0.06,
      0.64,
      0.94
    );
    const origin = trunkCurve.getPointAt(startFrac);
    const yaw = branchBaseAngle + (b / majorCount) * Math.PI * 2 + (rand() - 0.5) * 0.42;
    const dirX = Math.cos(yaw);
    const dirZ = Math.sin(yaw);

    const len = majorLen * (0.82 + rand() * 0.38) * (1 - (startFrac - 0.6) * 0.25);
    const outDist = len * THREE.MathUtils.clamp(0.45 + majorSpread * 0.58, 0.25, 1.42);
    const upDist = len * THREE.MathUtils.clamp(0.22 + majorUpward * 0.72, -0.25, 1.25);
    // Negative majorDroop lifts tips upward; positive majorDroop arches them downward!
    const effDroop = species === 'birch' ? majorDroop + birchDroop * 0.32 : majorDroop;
    const droopMag = len * effDroop * 0.78;

    const midBow = (rand() - 0.5) * len * (0.14 + gnarl * 0.24);
    const sideX = -dirZ;
    const sideZ = dirX;

    const trunkRAtAnchor = THREE.MathUtils.lerp(rBottom, rTop, Math.pow(startFrac, 0.88));
    // Start slightly embedded inside trunk core so junction has zero cracks/seams
    const bp0 = origin.clone().add(new THREE.Vector3(-dirX * trunkRAtAnchor * 0.12, -0.04, -dirZ * trunkRAtAnchor * 0.12));
    const bp1 = origin.clone().add(
      new THREE.Vector3(
        dirX * outDist * 0.38 + sideX * midBow,
        upDist * 0.48 - droopMag * 0.14,
        dirZ * outDist * 0.38 + sideZ * midBow
      )
    );
    const bp2 = origin.clone().add(
      new THREE.Vector3(
        dirX * outDist * 0.76 + sideX * midBow * 0.45,
        upDist * 0.86 - droopMag * 0.46,
        dirZ * outDist * 0.76 + sideZ * midBow * 0.45
      )
    );
    const bp3 = origin.clone().add(
      new THREE.Vector3(dirX * outDist, upDist - droopMag * 1.05, dirZ * outDist)
    );
    bp1.y = Math.max(minBranchY, bp1.y);
    bp2.y = Math.max(minBranchY, bp2.y);
    bp3.y = Math.max(minBranchY, bp3.y);

    const branchCurve = new THREE.CatmullRomCurve3([bp0, bp1, bp2, bp3]);
    const brStart = Math.min(trunkRAtAnchor * 0.78, 0.155 * thick * majorThick);
    const endRatio = THREE.MathUtils.lerp(0.86, 0.006, majorTaper);
    const brEnd = Math.max(0.0018, brStart * endRatio);

    // Match bark texel scale & V-continuity with the trunk where the limb emerges!
    const branchUvU = Math.max(0.55, 2.0 * (brStart / Math.max(0.08, rBottom)));
    const branchUvVOffset = startFrac * trunkLength * 0.72;

    barkParts.push(
      buildTaperedCurveTube({
        curve: branchCurve,
        tubularSegs: 10,
        radialSegs: 8,
        rStart: brStart,
        rEnd: brEnd,
        uvScaleU: branchUvU,
        uvScaleV: 0.72,
        uvOffsetV: branchUvVOffset,
        capEnd: true,
        // Gentle organic shoulder collar flare where the branch joins the trunk
        radiusMod: (t) => (t < 0.28 ? 1 + Math.pow(1 - t / 0.28, 2.0) * 0.38 : 1.0),
      })
    );

    branchTips.push(bp3.clone());
    branchAnchors.push({
      origin: origin.clone(),
      mid: bp2.clone(),
      tip: bp3.clone(),
      length: len,
      thickness: brStart,
      yaw,
    });

    // Forked fine tapered sub-branches / twigs (inheriting branch taper so twigs can taper to a point too!)
    const subCount =
      species === 'birch'
        ? Math.max(2, Math.round(3.5 * birchTwigDensity))
        : species === 'fantasy'
        ? 2
        : gnarl > 0.35 || majorCount >= 3
        ? 1
        : 0;

    for (let s = 0; s < subCount; s++) {
      const st = THREE.MathUtils.clamp(
        0.42 + (s / Math.max(1, subCount)) * 0.46 + (rand() - 0.5) * 0.1,
        0.32,
        0.88
      );
      const subOrigin = branchCurve.getPointAt(st);
      const subYaw = yaw + (s % 2 === 0 ? 1 : -1) * (0.48 + rand() * 0.55);
      const subLen =
        species === 'birch' ? len * (0.48 + rand() * 0.38) : len * (0.38 + rand() * 0.24);
      const subOut = subLen * (0.68 + rand() * 0.32);
      const subUp = subLen * (species === 'birch' ? 0.28 - birchDroop * 0.42 : 0.38 - effDroop * 0.35);
      const subDroop =
        species === 'birch'
          ? subLen * (0.24 + birchDroop * 0.65 + majorDroop * 0.35)
          : subLen * effDroop * 0.55;

      const sp1 = subOrigin
        .clone()
        .add(
          new THREE.Vector3(
            Math.cos(subYaw) * subOut * 0.52,
            subUp * 0.65 - subDroop * 0.25,
            Math.sin(subYaw) * subOut * 0.52
          )
        );
      const sp2 = subOrigin
        .clone()
        .add(new THREE.Vector3(Math.cos(subYaw) * subOut, subUp - subDroop, Math.sin(subYaw) * subOut));
      sp1.y = Math.max(minBranchY, sp1.y);
      sp2.y = Math.max(minBranchY, sp2.y);

      const subCurve = new THREE.CatmullRomCurve3([subOrigin, sp1, sp2]);
      const srStart = Math.max(0.012, THREE.MathUtils.lerp(brStart, brEnd, Math.pow(st, 0.88)) * 0.66);
      const srEnd = Math.max(0.0016, srStart * THREE.MathUtils.lerp(0.62, 0.01, majorTaper));

      barkParts.push(
        buildTaperedCurveTube({
          curve: subCurve,
          tubularSegs: 6,
          radialSegs: 5,
          rStart: srStart,
          rEnd: srEnd,
          uvScaleU: Math.max(0.45, branchUvU * 0.6),
          uvScaleV: 0.72,
          uvOffsetV: branchUvVOffset + st * len * 0.72,
          capEnd: true,
          radiusMod: (t) => (t < 0.24 ? 1 + Math.pow(1 - t / 0.24, 2.0) * 0.26 : 1.0),
        })
      );

      // Attach birch leaf clusters along the mid-to-tip span of every fine twig
      const tipDir = sp2.clone().sub(sp1).normalize();
      twigAttachments.push({ pos: sp1.clone(), dir: tipDir, scale: 0.85 + rand() * 0.35 });
      twigAttachments.push({ pos: sp2.clone(), dir: tipDir, scale: 0.95 + rand() * 0.4 });
    }

    // Also mount leaf clusters near the main branch tip for Birch
    if (species === 'birch') {
      const bTipDir = bp3.clone().sub(bp2).normalize();
      twigAttachments.push({ pos: bp2.clone(), dir: bTipDir, scale: 1.05 });
      twigAttachments.push({ pos: bp3.clone(), dir: bTipDir, scale: 1.15 });
    }
  }

  // Sort prominent main branches (longest & sturdiest first) for distributed canopy placement
  branchAnchors.sort((a, b) => b.length * b.thickness - a.length * a.thickness);

  // Crown apex twig plume for Birch so the top is airy and full of tapered twigs
  if (species === 'birch') {
    const crownTwigs = Math.max(3, Math.round(4 * birchTwigDensity));
    for (let ct = 0; ct < crownTwigs; ct++) {
      const a = (ct / crownTwigs) * Math.PI * 2 + rand() * 0.5;
      const clen = 0.75 + rand() * 0.65;
      const cOrigin = trunkCurve.getPointAt(0.86 + rand() * 0.13);
      const cp1 = cOrigin
        .clone()
        .add(new THREE.Vector3(Math.cos(a) * clen * 0.45, clen * 0.62, Math.sin(a) * clen * 0.45));
      const cp2 = cOrigin
        .clone()
        .add(
          new THREE.Vector3(
            Math.cos(a) * clen * 0.92,
            clen * (0.85 - birchDroop * 0.45 - majorDroop * 0.35),
            Math.sin(a) * clen * 0.92
          )
        );
      barkParts.push(
        buildTaperedCurveTube({
          curve: new THREE.CatmullRomCurve3([cOrigin, cp1, cp2]),
          tubularSegs: 5,
          radialSegs: 5,
          rStart: Math.max(0.018, rTop * 0.6),
          rEnd: Math.max(0.0018, rTop * THREE.MathUtils.lerp(0.35, 0.008, majorTaper)),
          uvScaleU: 0.65,
          uvScaleV: 0.72,
          uvOffsetV: trunkLength * 0.65,
          capEnd: true,
        })
      );
      const dir = cp2.clone().sub(cp1).normalize();
      twigAttachments.push({ pos: cp1, dir, scale: 0.95 });
      twigAttachments.push({ pos: cp2, dir, scale: 1.1 });
    }
  }

  if (branchTips.length === 0) {
    branchTips.push(p3.clone());
  }

  // 3. CURVED GROUND-ENTERING ROOTS (with rootBaseHeight so roots can sit partially underground!)
  const supportsRoots = species === 'oak' || species === 'fantasy' || species === 'custom';
  const hasRoots =
    supportsRoots && shouldTriggerFrequency(config.rootMode, rand(), previewIndex);

  if (hasRoots) {
    const rootCount = Math.max(2, Math.min(10, Math.round(config.rootCount ?? 5)));
    const rootBaseH = THREE.MathUtils.clamp(
      config.rootBaseHeight ?? 0.22,
      -0.45,
      Math.min(1.25, trunkHeight * 0.45)
    );
    const rootReach = Math.max(0.45, config.rootReach ?? 1.45);
    const rootArch = Math.max(0.0, config.rootArchHeight ?? 0.34);
    const rootThick = Math.max(0.35, config.rootThickness ?? 1.0);
    const rootRand = THREE.MathUtils.clamp(config.rootRandomness ?? 0.45, 0, 1);
    const rootStartAngle = rand() * Math.PI * 2;

    for (let r = 0; r < rootCount; r++) {
      const baseAngle = rootStartAngle + (r / rootCount) * Math.PI * 2;
      const angle = baseAngle + (rand() - 0.5) * (1.25 * rootRand);
      const reach = rootReach * (1 + (rand() - 0.5) * 0.72 * rootRand);
      const arch = rootArch * (0.68 + rand() * 0.62 * (0.5 + rootRand));
      const wiggle = (rand() - 0.5) * reach * 0.42 * rootRand;

      const dx = Math.cos(angle);
      const dz = Math.sin(angle);
      const sx = -dz;
      const sz = dx;

      // Starts at user-controlled rootBaseHeight (can be low/negative so roots weave partially under soil!)
      const collarY = rootBaseH + (rand() - 0.5) * 0.14 * rootRand;
      const rp0 = new THREE.Vector3(dx * rBottom * 0.22, collarY, dz * rBottom * 0.22);
      const rp1 = new THREE.Vector3(
        dx * (rBottom * 0.75 + reach * 0.38) + sx * wiggle * 0.45,
        collarY * 0.58 + arch * 0.85,
        dz * (rBottom * 0.75 + reach * 0.38) + sz * wiggle * 0.45
      );
      const rp2 = new THREE.Vector3(
        dx * (rBottom * 0.75 + reach * 0.78) + sx * wiggle,
        collarY * 0.18 + arch * 0.26 - 0.04,
        dz * (rBottom * 0.75 + reach * 0.78) + sz * wiggle
      );
      const rp3 = new THREE.Vector3(
        dx * (rBottom * 0.75 + reach) + sx * wiggle * 0.85,
        Math.min(-0.44, collarY - 0.55),
        dz * (rBottom * 0.75 + reach) + sz * wiggle * 0.85
      );

      const rootCurve = new THREE.CatmullRomCurve3([rp0, rp1, rp2, rp3]);
      const rrStart = Math.max(0.06, rBottom * 0.46 * rootThick * (0.85 + rand() * 0.3));
      const rrEnd = Math.max(0.018, rrStart * 0.22);
      const rootUvU = Math.max(0.65, 2.0 * (rrStart / Math.max(0.08, rBottom)));

      barkParts.push(
        buildTaperedCurveTube({
          curve: rootCurve,
          tubularSegs: 10,
          radialSegs: 8,
          rStart: rrStart,
          rEnd: rrEnd,
          uvScaleU: rootUvU,
          uvScaleV: 0.72,
          capEnd: true,
          radiusMod: (t) => (t < 0.26 ? 1 + Math.pow(1 - t / 0.26, 2.0) * 0.34 : 1.0),
        })
      );

      // Occasional secondary root fork on gnarly/random trees
      if (rootRand > 0.45 && rand() < 0.42) {
        const forkStart = rootCurve.getPointAt(0.45);
        const fAngle = angle + (rand() > 0.5 ? 0.52 : -0.52);
        const fReach = reach * 0.48;
        const fp1 = forkStart
          .clone()
          .add(new THREE.Vector3(Math.cos(fAngle) * fReach * 0.55, 0.02, Math.sin(fAngle) * fReach * 0.55));
        const fp2 = forkStart
          .clone()
          .add(new THREE.Vector3(Math.cos(fAngle) * fReach, -0.42, Math.sin(fAngle) * fReach));
        barkParts.push(
          buildTaperedCurveTube({
            curve: new THREE.CatmullRomCurve3([forkStart, fp1, fp2]),
            tubularSegs: 5,
            radialSegs: 5,
            rStart: rrStart * 0.52,
            rEnd: 0.015,
            uvScaleU: Math.max(0.5, rootUvU * 0.65),
            uvScaleV: 0.72,
            capEnd: true,
          })
        );
      }
    }
  }

  // Merge all bark geometry (trunk + major branches + twigs + roots) into 1 crisp mesh!
  const mergedBark = mergeAndOptimizeGeometries(barkParts, {
    computeNormals: true,
    computeBounds: true,
  });
  if (mergedBark) {
    const barkMesh = new THREE.Mesh(mergedBark, barkMat);
    barkMesh.castShadow = true;
    barkMesh.receiveShadow = true;
    barkMesh.userData.paintPart = 'branches';
    group.add(barkMesh);
  }

  // 4. OWL HOLLOW HOLE (Oak, Fantasy & Custom)
  const supportsHollow = species === 'oak' || species === 'fantasy' || species === 'custom';
  const hasHollow =
    supportsHollow && shouldTriggerFrequency(config.hollowMode, rand(), previewIndex);

  if (hasHollow) {
    const hFrac = THREE.MathUtils.clamp(config.hollowHeight ?? 0.48, 0.24, 0.78);
    const hSize = THREE.MathUtils.clamp(config.hollowSize ?? 0.95, 0.4, 1.6);
    const centerPt = trunkCurve.getPointAt(hFrac);
    const trunkRHere = THREE.MathUtils.lerp(rBottom, rTop, Math.pow(hFrac, 0.88));
    // In 3-tree preview face slightly toward viewer (+Z) so the hollow is unmistakably visible!
    const hAngle = previewIndex !== undefined ? 0.15 + (rand() - 0.5) * 0.65 : rand() * Math.PI * 2;
    const outX = Math.sin(hAngle);
    const outZ = Math.cos(hAngle);

    const hollowGroup = new THREE.Group();
    hollowGroup.position.set(
      centerPt.x + outX * trunkRHere * 0.84,
      centerPt.y,
      centerPt.z + outZ * trunkRHere * 0.84
    );
    hollowGroup.rotation.y = hAngle;

    const cavityW = Math.min(trunkRHere * 0.68, 0.14 * hSize * Math.max(0.8, thick));
    const cavityH = cavityW * 1.42;

    // Raised knotty healed bark lip around the owl hollow
    const rimGeo = new THREE.TorusGeometry(cavityW, cavityW * 0.36, 9, 18);
    rimGeo.scale(1.0, 1.38, 0.72);
    const rimMesh = new THREE.Mesh(rimGeo, barkMat);
    rimMesh.castShadow = true;
    rimMesh.receiveShadow = true;
    rimMesh.userData.paintPart = 'branches';

    // Deep dark wood interior cavity where an owl perches
    const innerGeo = new THREE.SphereGeometry(cavityW * 0.92, 12, 10);
    innerGeo.scale(0.95, 1.32, 0.38);
    const innerMat = new THREE.MeshStandardMaterial({
      color: '#120B07',
      roughness: 0.98,
      metalness: 0,
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    innerMesh.position.z = -cavityW * 0.12;
    innerMesh.userData.noVertexPaint = true;

    // Subtle warm golden owl eyes glimmering inside Fantasy hollows for extra charm!
    if (species === 'fantasy') {
      const eyeMat = new THREE.MeshBasicMaterial({ color: '#FFE58A' });
      const eyeGeo = new THREE.SphereGeometry(cavityW * 0.12, 6, 6);
      const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
      const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
      eyeL.userData.noVertexPaint = true;
      eyeR.userData.noVertexPaint = true;
      eyeL.position.set(-cavityW * 0.26, cavityH * 0.06, cavityW * 0.12);
      eyeR.position.set(cavityW * 0.26, cavityH * 0.06, cavityW * 0.12);
      hollowGroup.add(eyeL, eyeR);
    }

    hollowGroup.add(rimMesh, innerMesh);
    group.add(hollowGroup);
  }

  return {
    group,
    trunkTopY: trunkHeight,
    trunkCurve,
    branchTips,
    branchAnchors,
    twigAttachments,
    hasHollow,
    hasRoots,
  };
}
