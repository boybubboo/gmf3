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
import type { MonsterPartKey } from '../types/maker';
import { MONSTER_SDF_PART_INDEX, type QuadrupedMonsterRig } from './quadrupedMonsterBuilder';

export interface MonsterSegmentOverlayController {
  setActivePart: (partKey: MonsterPartKey) => void;
  setVisible: (visible: boolean) => void;
  dispose: () => void;
}

const HIGHLIGHT_BASE_HEX = new THREE.Color('#FACC15');
const HIGHLIGHT_RIM_HEX = new THREE.Color('#FEF08A');
const SEAM_LINE_HEX = new THREE.Color('#38BDF8');
const RING_LINE_HEX = new THREE.Color('#60A5FA');
const PART_SLOT_COUNT = 15;

function populateMonsterPartMaskAttribute(
  attr: THREE.BufferAttribute,
  partWeights: Uint8Array,
  vertexCount: number,
  partKey: MonsterPartKey
): void {
  const partIdx = MONSTER_SDF_PART_INDEX[partKey];
  const arr = attr.array as Float32Array;
  if (partIdx === undefined) {
    arr.fill(0);
    attr.needsUpdate = true;
    return;
  }
  const inv255 = 1 / 255;
  for (let i = 0; i < vertexCount; i++) {
    arr[i] = partWeights[i * PART_SLOT_COUNT + partIdx] * inv255;
  }
  attr.needsUpdate = true;
}

export function createMonsterSegmentOverlay(
  rig: QuadrupedMonsterRig,
  initialPart: MonsterPartKey,
  initialVisible: boolean
): MonsterSegmentOverlayController {
  let currentPart = initialPart;
  let currentVisible = initialVisible;

  const srcMesh = rig.skinnedMesh;
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

  if (rig.partWeights && posAttr && normAttr && skinIdxAttr && skinWtAttr) {
    partMaskAttr = new THREE.Float32BufferAttribute(new Float32Array(rig.vertexCount), 1);
    populateMonsterPartMaskAttribute(partMaskAttr, rig.partWeights, rig.vertexCount, currentPart);

    highlightGeo = new THREE.BufferGeometry();
    highlightGeo.setAttribute('position', posAttr);
    highlightGeo.setAttribute('normal', normAttr);
    highlightGeo.setAttribute('skinIndex', skinIdxAttr);
    highlightGeo.setAttribute('skinWeight', skinWtAttr);
    highlightGeo.setAttribute('aPartMask', partMaskAttr);
    if (idxAttr) highlightGeo.setIndex(idxAttr);

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
    highlightMat.positionNode = positionLocal.add(normalize(normalLocal).mul(0.0028));
    highlightMat.colorNode = mix(
      baseVec,
      rimVec,
      clamp(fresnel.mul(0.7).add(edgeBand.mul(0.6)), 0.0, 1.0)
    );
    highlightMat.opacityNode = clamp(
      bodyFill.mul(float(0.24).add(fresnel.mul(0.42)).add(edgeBand.mul(0.22))),
      0.0,
      0.74
    );

    highlightMesh = new THREE.SkinnedMesh(highlightGeo, highlightMat);
    highlightMesh.name = 'MonsterPartHighlightOverlay';
    highlightMesh.frustumCulled = false;
    highlightMesh.renderOrder = 2;
    highlightMesh.castShadow = false;
    highlightMesh.receiveShadow = false;
    highlightMesh.visible = currentVisible && MONSTER_SDF_PART_INDEX[currentPart] !== undefined;
    highlightMesh.bind(rig.skeleton, srcMesh.bindMatrix);
    rig.root.add(highlightMesh);
  }

  // Bone-attached Start / Mid / End cross-section rings + spine guides
  const guideEntries: { partKey: MonsterPartKey; lines: THREE.LineSegments; geometry: THREE.BufferGeometry }[] = [];
  let ringMat: THREE.LineBasicMaterial | null = null;

  if (rig.segmentGuides && rig.segmentGuides.length > 0) {
    rig.root.updateMatrixWorld(true);
    ringMat = new THREE.LineBasicMaterial({
      color: RING_LINE_HEX,
      transparent: true,
      opacity: 0.56,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    });

    const ringSteps = 26;
    const upTmp = new THREE.Vector3();
    const axisTmp = new THREE.Vector3();
    const t1 = new THREE.Vector3();
    const t2 = new THREE.Vector3();
    const cTmp = new THREE.Vector3();
    const ptTmp = new THREE.Vector3();
    const invBoneMat = new THREE.Matrix4();

    for (const guide of rig.segmentGuides) {
      const bone = rig.bones[guide.boneIndex];
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

        const rx = Math.max(0.006, ring.rx + 0.004);
        const rz = Math.max(0.006, ring.rz + 0.004);

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

      if (guide.spine.length >= 2) {
        for (let i = 0; i < guide.spine.length - 1; i++) {
          const a = guide.spine[i];
          const b = guide.spine[i + 1];
          ptTmp.set(a[0], a[1], a[2]).applyMatrix4(invBoneMat);
          segFloats.push(ptTmp.x, ptTmp.y, ptTmp.z);
          ptTmp.set(b[0], b[1], b[2]).applyMatrix4(invBoneMat);
          segFloats.push(ptTmp.x, ptTmp.y, ptTmp.z);
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(segFloats, 3));
      const lines = new THREE.LineSegments(geo, ringMat);
      lines.name = `MonsterGuide_${guide.partKey}`;
      lines.renderOrder = 4;
      lines.visible = currentVisible && guide.partKey === currentPart;
      bone.add(lines);
      guideEntries.push({ partKey: guide.partKey, lines, geometry: geo });
    }
  }

  // Fallback wireframe hint for seam zones if needed (unused if guides present, but keeps color constant clean)
  void SEAM_LINE_HEX;

  const syncVisibility = () => {
    if (highlightMesh) {
      highlightMesh.visible = currentVisible && MONSTER_SDF_PART_INDEX[currentPart] !== undefined;
    }
    for (const entry of guideEntries) {
      entry.lines.visible = currentVisible && entry.partKey === currentPart;
    }
  };

  return {
    setActivePart: (partKey: MonsterPartKey) => {
      currentPart = partKey;
      if (partMaskAttr && rig.partWeights) {
        populateMonsterPartMaskAttribute(partMaskAttr, rig.partWeights, rig.vertexCount, partKey);
      }
      syncVisibility();
    },
    setVisible: (visible: boolean) => {
      currentVisible = visible;
      syncVisibility();
    },
    dispose: () => {
      if (highlightMesh && highlightMesh.parent) highlightMesh.parent.remove(highlightMesh);
      if (highlightGeo) highlightGeo.dispose();
      if (highlightMat) highlightMat.dispose();
      for (const entry of guideEntries) {
        if (entry.lines.parent) entry.lines.parent.remove(entry.lines);
        entry.geometry.dispose();
      }
      if (ringMat) ringMat.dispose();
    },
  };
}
