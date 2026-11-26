import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
  abs,
  attribute,
  cameraPosition,
  clamp,
  dot,
  float,
  mix,
  normalLocal,
  normalWorld,
  normalize,
  positionLocal,
  positionWorld,
  pow,
  smoothstep,
  vec3,
} from 'three/tsl';
import type { CharacterBodyPartKey } from '../types/maker';
import type { BuiltCharacterAsset } from './characterMakerBuilder';
import { CHARACTER_PART_INDEX, CHARACTER_PART_KEYS } from './sdfMarchingCubes';

export interface CharacterSegmentOverlayController {
  setActivePart: (partKey: CharacterBodyPartKey) => void;
  setVisible: (visible: boolean) => void;
  dispose: () => void;
}

interface GuideEntry {
  partKey: CharacterBodyPartKey;
  lines: THREE.LineSegments;
  geometry: THREE.BufferGeometry;
}

const HIGHLIGHT_BASE_HEX = new THREE.Color('#FACC15');
const HIGHLIGHT_RIM_HEX = new THREE.Color('#FEF08A');
const SEAM_LINE_HEX = new THREE.Color('#1E3A8A');
const RING_LINE_HEX = new THREE.Color('#1E40AF');

function populatePartMaskAttribute(
  attr: THREE.BufferAttribute,
  partWeights: Uint8Array,
  vertexCount: number,
  partKey: CharacterBodyPartKey
): void {
  const partCount = CHARACTER_PART_KEYS.length;
  const partIdx = CHARACTER_PART_INDEX[partKey] ?? 0;
  const arr = attr.array as Float32Array;
  const inv255 = 1 / 255;
  for (let i = 0; i < vertexCount; i++) {
    arr[i] = partWeights[i * partCount + partIdx] * inv255;
  }
  attr.needsUpdate = true;
}

function interpolateSkinWeights(
  skinIdxArr: ArrayLike<number>,
  skinWtArr: ArrayLike<number>,
  vA: number,
  vB: number,
  t: number
): { idx: [number, number, number, number]; wt: [number, number, number, number] } {
  const wA = 1 - t;
  const wB = t;
  const bones: number[] = [];
  const weights: number[] = [];

  const accum = (v: number, scale: number) => {
    const base = v * 4;
    for (let k = 0; k < 4; k++) {
      const bi = skinIdxArr[base + k];
      const bw = skinWtArr[base + k] * scale;
      if (bw <= 1e-5) continue;
      let found = -1;
      for (let j = 0; j < bones.length; j++) {
        if (bones[j] === bi) {
          found = j;
          break;
        }
      }
      if (found >= 0) {
        weights[found] += bw;
      } else {
        bones.push(bi);
        weights.push(bw);
      }
    }
  };

  accum(vA, wA);
  accum(vB, wB);

  // Pick top 4 bone influences sorted descending by weight
  const order = bones.map((_, i) => i).sort((a, b) => weights[b] - weights[a]);
  const outIdx: [number, number, number, number] = [0, 0, 0, 0];
  const outWt: [number, number, number, number] = [0, 0, 0, 0];
  let sum = 0;
  const count = Math.min(4, order.length);
  for (let i = 0; i < count; i++) {
    const src = order[i];
    outIdx[i] = bones[src];
    outWt[i] = weights[src];
    sum += weights[src];
  }
  if (sum > 1e-6) {
    const inv = 1 / sum;
    for (let i = 0; i < count; i++) outWt[i] *= inv;
  } else {
    outWt[0] = 1;
  }
  return { idx: outIdx, wt: outWt };
}

function averageSkinWeights3(
  s0: { idx: [number, number, number, number]; wt: [number, number, number, number] },
  s1: { idx: [number, number, number, number]; wt: [number, number, number, number] },
  s2: { idx: [number, number, number, number]; wt: [number, number, number, number] }
): { idx: [number, number, number, number]; wt: [number, number, number, number] } {
  const bones: number[] = [];
  const weights: number[] = [];
  const accum = (s: typeof s0) => {
    for (let k = 0; k < 4; k++) {
      const bi = s.idx[k];
      const bw = s.wt[k];
      if (bw <= 1e-5) continue;
      let found = -1;
      for (let j = 0; j < bones.length; j++) {
        if (bones[j] === bi) {
          found = j;
          break;
        }
      }
      if (found >= 0) weights[found] += bw;
      else {
        bones.push(bi);
        weights.push(bw);
      }
    }
  };
  accum(s0);
  accum(s1);
  accum(s2);

  const order = bones.map((_, i) => i).sort((a, b) => weights[b] - weights[a]);
  const outIdx: [number, number, number, number] = [0, 0, 0, 0];
  const outWt: [number, number, number, number] = [0, 0, 0, 0];
  let sum = 0;
  const count = Math.min(4, order.length);
  for (let i = 0; i < count; i++) {
    const src = order[i];
    outIdx[i] = bones[src];
    outWt[i] = weights[src];
    sum += weights[src];
  }
  if (sum > 1e-6) {
    const inv = 1 / sum;
    for (let i = 0; i < count; i++) outWt[i] *= inv;
  } else {
    outWt[0] = 1;
  }
  return { idx: outIdx, wt: outWt };
}

function buildSeamRibbonGeometry(
  srcGeo: THREE.BufferGeometry,
  seamZones: Int16Array,
  seamGaps: Float32Array
): THREE.BufferGeometry | null {
  const posAttr = srcGeo.getAttribute('position') as THREE.BufferAttribute | undefined;
  const normAttr = srcGeo.getAttribute('normal') as THREE.BufferAttribute | undefined;
  const skinIdxAttr = srcGeo.getAttribute('skinIndex') as THREE.BufferAttribute | undefined;
  const skinWtAttr = srcGeo.getAttribute('skinWeight') as THREE.BufferAttribute | undefined;
  if (!posAttr || !normAttr || !skinIdxAttr || !skinWtAttr) return null;

  const posArr = posAttr.array as Float32Array;
  const normArr = normAttr.array as Float32Array;
  const skinIdxArr = skinIdxAttr.array as ArrayLike<number>;
  const skinWtArr = skinWtAttr.array as ArrayLike<number>;
  const indexAttr = srcGeo.getIndex();
  const triCount = indexAttr ? Math.floor(indexAttr.count / 3) : Math.floor(posAttr.count / 3);

  interface EdgeCrossing {
    px: number;
    py: number;
    pz: number;
    nx: number;
    ny: number;
    nz: number;
    skin: { idx: [number, number, number, number]; wt: [number, number, number, number] };
  }

  const evalCrossing = (va: number, vb: number): EdgeCrossing => {
    const ga = Math.max(0, seamGaps[va]);
    const gb = Math.max(0, seamGaps[vb]);
    const denom = ga + gb;
    const t = denom > 1e-5 ? THREE.MathUtils.clamp(ga / denom, 0.05, 0.95) : 0.5;
    const a3 = va * 3;
    const b3 = vb * 3;
    const px = posArr[a3] + (posArr[b3] - posArr[a3]) * t;
    const py = posArr[a3 + 1] + (posArr[b3 + 1] - posArr[a3 + 1]) * t;
    const pz = posArr[a3 + 2] + (posArr[b3 + 2] - posArr[a3 + 2]) * t;
    let nx = normArr[a3] + (normArr[b3] - normArr[a3]) * t;
    let ny = normArr[a3 + 1] + (normArr[b3 + 1] - normArr[a3 + 1]) * t;
    let nz = normArr[a3 + 2] + (normArr[b3 + 2] - normArr[a3 + 2]) * t;
    const nLen = Math.hypot(nx, ny, nz) || 1;
    nx /= nLen;
    ny /= nLen;
    nz /= nLen;
    return {
      px,
      py,
      pz,
      nx,
      ny,
      nz,
      skin: interpolateSkinWeights(skinIdxArr, skinWtArr, va, vb, t),
    };
  };

  const segments: [EdgeCrossing, EdgeCrossing][] = [];
  for (let t = 0; t < triCount; t++) {
    const i0 = indexAttr ? indexAttr.getX(t * 3) : t * 3;
    const i1 = indexAttr ? indexAttr.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = indexAttr ? indexAttr.getX(t * 3 + 2) : t * 3 + 2;

    const z0 = seamZones[i0];
    const z1 = seamZones[i1];
    const z2 = seamZones[i2];
    if (z0 < 0 || z1 < 0 || z2 < 0) continue;
    if (z0 === z1 && z1 === z2) continue;

    if (z0 === z1) {
      segments.push([evalCrossing(i0, i2), evalCrossing(i1, i2)]);
    } else if (z0 === z2) {
      segments.push([evalCrossing(i0, i1), evalCrossing(i2, i1)]);
    } else if (z1 === z2) {
      segments.push([evalCrossing(i1, i0), evalCrossing(i2, i0)]);
    } else {
      // Triple junction inside a single triangle: meet at centroid of edge crossings
      const c01 = evalCrossing(i0, i1);
      const c12 = evalCrossing(i1, i2);
      const c20 = evalCrossing(i2, i0);
      let cnx = c01.nx + c12.nx + c20.nx;
      let cny = c01.ny + c12.ny + c20.ny;
      let cnz = c01.nz + c12.nz + c20.nz;
      const cnLen = Math.hypot(cnx, cny, cnz) || 1;
      cnx /= cnLen;
      cny /= cnLen;
      cnz /= cnLen;
      const center: EdgeCrossing = {
        px: (c01.px + c12.px + c20.px) / 3,
        py: (c01.py + c12.py + c20.py) / 3,
        pz: (c01.pz + c12.pz + c20.pz) / 3,
        nx: cnx,
        ny: cny,
        nz: cnz,
        skin: averageSkinWeights3(c01.skin, c12.skin, c20.skin),
      };
      segments.push([c01, center], [c12, center], [c20, center]);
    }
  }

  if (segments.length === 0) return null;

  const halfW = 0.00105;
  const normalLift = 0.0028;
  const segCount = segments.length;
  const vCount = segCount * 4;
  const outPos = new Float32Array(vCount * 3);
  const outNorm = new Float32Array(vCount * 3);
  const outSkinIdx = new Uint16Array(vCount * 4);
  const outSkinWt = new Float32Array(vCount * 4);
  const outIndex = new Uint32Array(segCount * 6);

  let validQuads = 0;
  for (let s = 0; s < segCount; s++) {
    const [a, b] = segments[s];
    const tx = b.px - a.px;
    const ty = b.py - a.py;
    const tz = b.pz - a.pz;
    const tLen = Math.hypot(tx, ty, tz);
    if (tLen < 1e-6) continue;

    // Binormal = normalize(N x T) at endpoint A (consistent orientation across endpoints)
    let bx = a.ny * tz - a.nz * ty;
    let by = a.nz * tx - a.nx * tz;
    let bz = a.nx * ty - a.ny * tx;
    let bLen = Math.hypot(bx, by, bz);
    if (bLen < 1e-6) {
      bx = 1;
      by = 0;
      bz = 0;
      bLen = 1;
    }
    const bw = halfW / bLen;
    bx *= bw;
    by *= bw;
    bz *= bw;

    const ax = a.px + a.nx * normalLift;
    const ay = a.py + a.ny * normalLift;
    const az = a.pz + a.nz * normalLift;
    const ex = b.px + b.nx * normalLift;
    const ey = b.py + b.ny * normalLift;
    const ez = b.pz + b.nz * normalLift;

    const vBase = validQuads * 4;
    const pts: [number, number, number, EdgeCrossing][] = [
      [ax - bx, ay - by, az - bz, a],
      [ax + bx, ay + by, az + bz, a],
      [ex + bx, ey + by, ez + bz, b],
      [ex - bx, ey - by, ez - bz, b],
    ];

    for (let k = 0; k < 4; k++) {
      const vi = vBase + k;
      const vi3 = vi * 3;
      const vi4 = vi * 4;
      const [px, py, pz, src] = pts[k];
      outPos[vi3] = px;
      outPos[vi3 + 1] = py;
      outPos[vi3 + 2] = pz;
      outNorm[vi3] = src.nx;
      outNorm[vi3 + 1] = src.ny;
      outNorm[vi3 + 2] = src.nz;
      outSkinIdx[vi4] = src.skin.idx[0];
      outSkinIdx[vi4 + 1] = src.skin.idx[1];
      outSkinIdx[vi4 + 2] = src.skin.idx[2];
      outSkinIdx[vi4 + 3] = src.skin.idx[3];
      outSkinWt[vi4] = src.skin.wt[0];
      outSkinWt[vi4 + 1] = src.skin.wt[1];
      outSkinWt[vi4 + 2] = src.skin.wt[2];
      outSkinWt[vi4 + 3] = src.skin.wt[3];
    }

    const iBase = validQuads * 6;
    outIndex[iBase] = vBase;
    outIndex[iBase + 1] = vBase + 1;
    outIndex[iBase + 2] = vBase + 2;
    outIndex[iBase + 3] = vBase;
    outIndex[iBase + 4] = vBase + 2;
    outIndex[iBase + 5] = vBase + 3;
    validQuads++;
  }

  if (validQuads === 0) return null;

  const trimmedV = validQuads * 4;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(outPos.subarray(0, trimmedV * 3), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(outNorm.subarray(0, trimmedV * 3), 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(outSkinIdx.subarray(0, trimmedV * 4), 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(outSkinWt.subarray(0, trimmedV * 4), 4));
  geo.setIndex(new THREE.BufferAttribute(outIndex.subarray(0, validQuads * 6), 1));
  return geo;
}

export function createCharacterSegmentOverlay(
  built: BuiltCharacterAsset,
  initialPart: CharacterBodyPartKey,
  initialVisible: boolean
): CharacterSegmentOverlayController {
  let currentPart = initialPart;
  let currentVisible = initialVisible;

  const srcMesh = built.skinnedMesh;
  const srcGeo = srcMesh.geometry;
  const posAttr = srcGeo.getAttribute('position');
  const normAttr = srcGeo.getAttribute('normal');
  const skinIdxAttr = srcGeo.getAttribute('skinIndex');
  const skinWtAttr = srcGeo.getAttribute('skinWeight');
  const idxAttr = srcGeo.getIndex();

  let highlightMesh: THREE.SkinnedMesh | null = null;
  let highlightGeo: THREE.BufferGeometry | null = null;
  let highlightMat: MeshBasicNodeMaterial | null = null;
  let partMaskAttr: THREE.BufferAttribute | null = null;

  // 1. Yellow semi-transparent highlight shell (SkinnedMesh sharing vertex buffers + aPartMask)
  if (built.partWeights && posAttr && normAttr && skinIdxAttr && skinWtAttr) {
    partMaskAttr = new THREE.Float32BufferAttribute(new Float32Array(built.vertexCount), 1);
    populatePartMaskAttribute(partMaskAttr, built.partWeights, built.vertexCount, currentPart);

    highlightGeo = new THREE.BufferGeometry();
    highlightGeo.setAttribute('position', posAttr);
    highlightGeo.setAttribute('normal', normAttr);
    highlightGeo.setAttribute('skinIndex', skinIdxAttr);
    highlightGeo.setAttribute('skinWeight', skinWtAttr);
    highlightGeo.setAttribute('aPartMask', partMaskAttr);
    if (idxAttr) {
      highlightGeo.setIndex(idxAttr);
    }

    const maskAttrNode = attribute('aPartMask', 'float');
    const clampedMask = clamp(maskAttrNode, 0.0, 1.0);
    const viewDir = normalize(cameraPosition.sub(positionWorld));
    const nWorld = normalize(normalWorld);
    const ndv = abs(dot(viewDir, nWorld));
    const fresnel = pow(clamp(float(1.0).sub(ndv), 0.0, 1.0), 1.65);
    const edgeBand = smoothstep(0.14, 0.44, clampedMask).mul(
      float(1.0).sub(smoothstep(0.56, 0.92, clampedMask))
    );
    const bodyFill = smoothstep(0.12, 0.62, clampedMask);

    const baseVec = vec3(HIGHLIGHT_BASE_HEX.r, HIGHLIGHT_BASE_HEX.g, HIGHLIGHT_BASE_HEX.b);
    const rimVec = vec3(HIGHLIGHT_RIM_HEX.r, HIGHLIGHT_RIM_HEX.g, HIGHLIGHT_RIM_HEX.b);

    highlightMat = new MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      toneMapped: false,
    });
    highlightMat.positionNode = positionLocal.add(normalize(normalLocal).mul(0.0022));
    highlightMat.colorNode = mix(baseVec, rimVec, clamp(fresnel.mul(0.7).add(edgeBand.mul(0.6)), 0.0, 1.0));
    highlightMat.opacityNode = clamp(
      bodyFill.mul(float(0.24).add(fresnel.mul(0.4)).add(edgeBand.mul(0.22))),
      0.0,
      0.72
    );

    highlightMesh = new THREE.SkinnedMesh(highlightGeo, highlightMat);
    highlightMesh.name = 'EditorPartHighlightOverlay';
    highlightMesh.userData.noVertexPaint = true;
    highlightMesh.frustumCulled = false;
    highlightMesh.renderOrder = 2;
    highlightMesh.castShadow = false;
    highlightMesh.receiveShadow = false;
    highlightMesh.visible = currentVisible;
    highlightMesh.bind(built.skeleton, srcMesh.bindMatrix);
    built.root.add(highlightMesh);
  }

  // 2. Very faint surface segment boundary lines (skinned quad ribbon mesh)
  let seamMesh: THREE.SkinnedMesh | null = null;
  let seamGeo: THREE.BufferGeometry | null = null;
  let seamMat: MeshBasicNodeMaterial | null = null;
  if (built.seamZones && built.seamGaps) {
    seamGeo = buildSeamRibbonGeometry(srcGeo, built.seamZones, built.seamGaps);
    if (seamGeo) {
      seamMat = new MeshBasicNodeMaterial({
        color: SEAM_LINE_HEX,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      seamMesh = new THREE.SkinnedMesh(seamGeo, seamMat);
      seamMesh.name = 'EditorSegmentSeamLines';
      seamMesh.userData.noVertexPaint = true;
      seamMesh.frustumCulled = false;
      seamMesh.renderOrder = 3;
      seamMesh.castShadow = false;
      seamMesh.receiveShadow = false;
      seamMesh.visible = currentVisible;
      seamMesh.bind(built.skeleton, srcMesh.bindMatrix);
      built.root.add(seamMesh);
    }
  }

  // 3. Bone-attached active cross-section segment guide rings (Start / Mid / End or 5 muzzle rings)
  const guideEntries: GuideEntry[] = [];
  let ringMat: THREE.LineBasicMaterial | null = null;
  if (built.segmentGuides && built.segmentGuides.length > 0) {
    built.root.updateMatrixWorld(true);
    ringMat = new THREE.LineBasicMaterial({
      color: RING_LINE_HEX,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    });

    const ringSteps = 28;
    const upTmp = new THREE.Vector3();
    const axisTmp = new THREE.Vector3();
    const t1 = new THREE.Vector3();
    const t2 = new THREE.Vector3();
    const cTmp = new THREE.Vector3();
    const ptTmp = new THREE.Vector3();
    const invBoneMat = new THREE.Matrix4();

    for (const guide of built.segmentGuides) {
      const bone = built.bones[guide.boneIndex];
      if (!bone || guide.rings.length === 0) continue;
      invBoneMat.copy(bone.matrixWorld).invert();

      const segFloats: number[] = [];

      for (const ring of guide.rings) {
        cTmp.set(ring.center[0], ring.center[1], ring.center[2]);
        axisTmp.set(ring.axis[0], ring.axis[1], ring.axis[2]).normalize();
        if (Math.abs(axisTmp.y) < 0.9) upTmp.set(0, 1, 0);
        else upTmp.set(1, 0, 0);

        t1.crossVectors(axisTmp, upTmp).normalize();
        t2.crossVectors(axisTmp, t1).normalize();

        const rx = Math.max(0.004, ring.rx + 0.0025);
        const rz = Math.max(0.004, ring.rz + 0.0025);

        for (let s = 0; s < ringSteps; s++) {
          const a0 = (s / ringSteps) * Math.PI * 2;
          const a1 = ((s + 1) / ringSteps) * Math.PI * 2;
          ptTmp
            .copy(cTmp)
            .addScaledVector(t1, Math.cos(a0) * rx)
            .addScaledVector(t2, Math.sin(a0) * rz)
            .applyMatrix4(invBoneMat);
          segFloats.push(ptTmp.x, ptTmp.y, ptTmp.z);

          ptTmp
            .copy(cTmp)
            .addScaledVector(t1, Math.cos(a1) * rx)
            .addScaledVector(t2, Math.sin(a1) * rz)
            .applyMatrix4(invBoneMat);
          segFloats.push(ptTmp.x, ptTmp.y, ptTmp.z);
        }
      }

      if (guide.spine) {
        ptTmp.set(guide.spine[0][0], guide.spine[0][1], guide.spine[0][2]).applyMatrix4(invBoneMat);
        segFloats.push(ptTmp.x, ptTmp.y, ptTmp.z);
        ptTmp.set(guide.spine[1][0], guide.spine[1][1], guide.spine[1][2]).applyMatrix4(invBoneMat);
        segFloats.push(ptTmp.x, ptTmp.y, ptTmp.z);
      }

      const lGeo = new THREE.BufferGeometry();
      lGeo.setAttribute('position', new THREE.Float32BufferAttribute(segFloats, 3));
      const lines = new THREE.LineSegments(lGeo, ringMat);
      lines.name = `EditorGuideRings_${guide.partKey}`;
      lines.userData.noVertexPaint = true;
      lines.frustumCulled = false;
      lines.renderOrder = 4;
      lines.visible = currentVisible && guide.partKey === currentPart;
      bone.add(lines);
      guideEntries.push({ partKey: guide.partKey, lines, geometry: lGeo });
    }
  }

  const syncGuideVisibility = () => {
    for (const entry of guideEntries) {
      entry.lines.visible = currentVisible && entry.partKey === currentPart;
    }
  };

  return {
    setActivePart(partKey: CharacterBodyPartKey) {
      if (partKey === currentPart) return;
      currentPart = partKey;
      if (partMaskAttr && built.partWeights) {
        populatePartMaskAttribute(partMaskAttr, built.partWeights, built.vertexCount, currentPart);
      }
      syncGuideVisibility();
    },
    setVisible(visible: boolean) {
      if (visible === currentVisible) return;
      currentVisible = visible;
      if (highlightMesh) highlightMesh.visible = currentVisible;
      if (seamMesh) seamMesh.visible = currentVisible;
      syncGuideVisibility();
    },
    dispose() {
      if (highlightMesh) {
        highlightMesh.parent?.remove(highlightMesh);
        highlightMesh = null;
      }
      if (highlightGeo) {
        // Detach shared attributes from srcMesh before disposing so srcMesh keeps its buffers intact
        highlightGeo.deleteAttribute('position');
        highlightGeo.deleteAttribute('normal');
        highlightGeo.deleteAttribute('skinIndex');
        highlightGeo.deleteAttribute('skinWeight');
        highlightGeo.setIndex(null);
        highlightGeo.dispose();
        highlightGeo = null;
      }
      partMaskAttr = null;
      highlightMat?.dispose();
      highlightMat = null;

      if (seamMesh) {
        seamMesh.parent?.remove(seamMesh);
        seamMesh = null;
      }
      seamGeo?.dispose();
      seamGeo = null;
      seamMat?.dispose();
      seamMat = null;

      for (const entry of guideEntries) {
        entry.lines.parent?.remove(entry.lines);
        entry.geometry.dispose();
      }
      guideEntries.length = 0;
      ringMat?.dispose();
      ringMat = null;
    },
  };
}
