import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import type {
  CustomAssetMeta,
  InventoryItemDef,
  ObjectAttachBodyPart,
  RigBoneRole,
  VisualStyleId,
} from '../types/maker';
import { getCachedAssetSync, type CustomModelInstance } from './gltfAssetManager';
import { applyBotwStyleToObject } from './botwStyleUtils';
import { buildPickupItemMesh, type BaddieRig, type HeroRig } from './proceduralModels';
import type { QuadrupedMonsterRig } from './quadrupedMonsterBuilder';

export interface HeroEquipmentHandles {
  handGripL?: THREE.Object3D;
  handGripR?: THREE.Object3D;
  sword?: THREE.Group;
  axe?: THREE.Group;
  fishingPole?: THREE.Group;
  fishingRodTip?: THREE.Object3D;
  torch?: THREE.Group;
  heldGeneric?: THREE.Mesh;
  shield?: THREE.Group | THREE.Mesh;
  wearHeadHat?: THREE.Group;
  wearHeadCrown?: THREE.Group;
  wearBodyCloak?: THREE.Group | THREE.Mesh;
  wearAccessoryAmulet?: THREE.Group;
  builtinHeadAddonNodes?: THREE.Object3D[];
}

type BodyRegion =
  | 'head'
  | 'neck'
  | 'torso'
  | 'rightHand'
  | 'rightForearm'
  | 'leftHand'
  | 'leftForearm';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _matInv = new THREE.Matrix4();
const _identityQuat = new THREE.Quaternion();

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor(THREE.MathUtils.clamp(p, 0, 1) * (sorted.length - 1)))
  );
  return sorted[idx];
}

function findBoneByPatterns(
  root: THREE.Object3D,
  patterns: RegExp[],
  excludePattern?: RegExp
): THREE.Object3D | null {
  const candidates: THREE.Object3D[] = [];
  root.traverse((obj) => {
    if (!obj.name) return;
    if (excludePattern && excludePattern.test(obj.name)) return;
    if ((obj as THREE.Bone).isBone || /arm|hand|head|neck|chest|spine|hips/i.test(obj.name)) {
      candidates.push(obj);
    }
  });
  for (const pat of patterns) {
    const boneMatch = candidates.find((c) => (c as THREE.Bone).isBone && pat.test(c.name));
    if (boneMatch) return boneMatch;
    const nodeMatch = candidates.find((c) => pat.test(c.name));
    if (nodeMatch) return nodeMatch;
  }
  return null;
}

function resolveRoleBone(
  heroCustom: CustomModelInstance,
  role: RigBoneRole | 'rightHand' | 'leftHand'
): THREE.Object3D | null {
  if (role !== 'rightHand' && role !== 'leftHand') {
    const mapped = heroCustom.proceduralRig?.getRoleBoneNode(role);
    if (mapped) return mapped;
  }

  const root = heroCustom.modelRoot;
  if (role === 'rightHand') {
    const explicit = findBoneByPatterns(
      root,
      [
        /(^|[:_.\-\s])(mixamorig\d*[:_.-]?)?(right|r)[_.\-\s]?(hand|wrist|palm)($|[:_.\-\s])/i,
        /(hand|wrist|palm)[_.\-\s]?(right|r)($|[:_.\-\s])/i,
        /right.*hand/i,
      ],
      /finger|thumb|index|middle|ring|pinky|tip|end|twist|roll/i
    );
    if (explicit) return explicit;
    const forearm = resolveRoleBone(heroCustom, 'rightLowerArm');
    if (forearm) {
      const childHand =
        forearm.children.find(
          (c) =>
            (c as THREE.Bone).isBone &&
            !/twist|roll|end|tip/i.test(c.name) &&
            /hand|wrist|palm/i.test(c.name)
        ) ??
        forearm.children.find(
          (c) => (c as THREE.Bone).isBone && !/twist|roll|end|tip/i.test(c.name)
        );
      return childHand ?? forearm;
    }
    return null;
  }

  if (role === 'leftHand') {
    const explicit = findBoneByPatterns(
      root,
      [
        /(^|[:_.\-\s])(mixamorig\d*[:_.-]?)?(left|l)[_.\-\s]?(hand|wrist|palm)($|[:_.\-\s])/i,
        /(hand|wrist|palm)[_.\-\s]?(left|l)($|[:_.\-\s])/i,
        /left.*hand/i,
      ],
      /finger|thumb|index|middle|ring|pinky|tip|end|twist|roll/i
    );
    if (explicit) return explicit;
    const forearm = resolveRoleBone(heroCustom, 'leftLowerArm');
    if (forearm) {
      const childHand =
        forearm.children.find(
          (c) =>
            (c as THREE.Bone).isBone &&
            !/twist|roll|end|tip/i.test(c.name) &&
            /hand|wrist|palm/i.test(c.name)
        ) ??
        forearm.children.find(
          (c) => (c as THREE.Bone).isBone && !/twist|roll|end|tip/i.test(c.name)
        );
      return childHand ?? forearm;
    }
    return null;
  }

  if (role === 'head') {
    return findBoneByPatterns(root, [/^(mixamorig\d*[:_.-]?)?head$/i, /head|skull|cranium/i], /hat|hair|eye|jaw|ear|end|top/i);
  }
  if (role === 'neck') {
    return findBoneByPatterns(root, [/neck/i]);
  }
  if (role === 'chest') {
    return findBoneByPatterns(root, [/^(mixamorig\d*[:_.-]?)?(chest|upper_?chest|spine_?0?2)$/i, /chest|thorax/i]);
  }
  if (role === 'spine') {
    return findBoneByPatterns(root, [/^(mixamorig\d*[:_.-]?)?(spine|spine_?0?1|torso|waist)$/i, /spine|torso|waist/i]);
  }
  if (role === 'hips') {
    return findBoneByPatterns(root, [/^(mixamorig\d*[:_.-]?)?(hips|pelvis|hip)$/i, /hips|pelvis/i]);
  }
  if (role === 'rightLowerArm') {
    return findBoneByPatterns(root, [/(right|r)[_.\-\s]*(forearm|lowerarm|elbow)/i], /hand|wrist|finger|twist/i);
  }
  if (role === 'leftLowerArm') {
    return findBoneByPatterns(root, [/(left|l)[_.\-\s]*(forearm|lowerarm|elbow)/i], /hand|wrist|finger|twist/i);
  }
  return null;
}

function mountOnBoneInHolderSpace(
  targetBone: THREE.Object3D,
  holderPos: THREE.Vector3,
  holderQuat: THREE.Quaternion,
  name: string
): THREE.Group {
  targetBone.updateWorldMatrix(true, false);
  _matInv.copy(targetBone.matrixWorld).invert();
  targetBone.matrixWorld.decompose(_v, _q, _s);
  const avgBoneScale = Math.max(
    0.0001,
    (Math.abs(_s.x) + Math.abs(_s.y) + Math.abs(_s.z)) / 3
  );

  const anchor = new THREE.Group();
  anchor.name = name;
  anchor.position.copy(holderPos).applyMatrix4(_matInv);
  anchor.quaternion.copy(_q).invert().multiply(holderQuat);
  anchor.scale.setScalar(1 / avgBoneScale);
  targetBone.add(anchor);
  return anchor;
}

function isIgnoredDecorativeMesh(obj: THREE.Object3D): boolean {
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    if (!cur.visible) return true;
    const n = cur.name ?? '';
    if (
      n.startsWith('CharAddon_') ||
      /eyelid|cornea|pupil|iris|eyeball|lash|shadow|slash/i.test(n) ||
      (cur.userData as { eyelidRole?: string } | undefined)?.eyelidRole
    ) {
      return true;
    }
    cur = cur.parent;
  }
  return false;
}

function isHairNode(obj: THREE.Object3D): boolean {
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    const n = cur.name ?? '';
    if (/^(hair|layeredhair|hairlayer)/i.test(n) || /facialhair/i.test(n)) {
      return true;
    }
    cur = cur.parent;
  }
  return false;
}

interface RegionSamples {
  headBodyPts: THREE.Vector3[];
  headHairPts: THREE.Vector3[];
  torsoPts: THREE.Vector3[];
  rightHandPts: THREE.Vector3[];
  rightForearmPts: THREE.Vector3[];
  builtinHeadAddonNodes: THREE.Object3D[];
}

function collectRegionSamples(
  heroCustom: CustomModelInstance,
  bones: {
    head: THREE.Object3D | null;
    neck: THREE.Object3D | null;
    chest: THREE.Object3D | null;
    spine: THREE.Object3D | null;
    hips: THREE.Object3D | null;
    rightLowerArm: THREE.Object3D | null;
    rightHand: THREE.Object3D | null;
    leftLowerArm: THREE.Object3D | null;
    leftHand: THREE.Object3D | null;
  }
): RegionSamples {
  const result: RegionSamples = {
    headBodyPts: [],
    headHairPts: [],
    torsoPts: [],
    rightHandPts: [],
    rightForearmPts: [],
    builtinHeadAddonNodes: [],
  };

  const boneRegionMap = new Map<THREE.Object3D, BodyRegion>();

  const markSubtree = (
    rootNode: THREE.Object3D | null,
    region: BodyRegion,
    stopAtSet?: Set<THREE.Object3D>
  ) => {
    if (!rootNode) return;
    const visit = (n: THREE.Object3D) => {
      if (stopAtSet && stopAtSet.has(n)) return;
      if (/tail|wing|extraarm|extraleg/i.test(n.name ?? '')) return;
      if ((n as THREE.Bone).isBone || n === rootNode) {
        boneRegionMap.set(n, region);
      }
      for (const ch of n.children) {
        visit(ch);
      }
    };
    visit(rootNode);
  };

  const headStop = new Set<THREE.Object3D>();
  const torsoStop = new Set<THREE.Object3D>();
  if (bones.neck) torsoStop.add(bones.neck);
  if (bones.head) torsoStop.add(bones.head);
  heroCustom.modelRoot.traverse((obj) => {
    if ((obj as THREE.Bone).isBone && /(arm|shoulder|clavicle|leg|thigh|hip_|tail)/i.test(obj.name)) {
      if (!/^(hips|pelvis)$/i.test(obj.name)) {
        torsoStop.add(obj);
      }
    }
  });

  if (bones.hips) boneRegionMap.set(bones.hips, 'torso');
  if (bones.spine) boneRegionMap.set(bones.spine, 'torso');
  if (bones.chest) markSubtree(bones.chest, 'torso', torsoStop);
  if (bones.neck) boneRegionMap.set(bones.neck, 'neck');
  if (bones.head) markSubtree(bones.head, 'head', headStop);

  if (bones.rightLowerArm) {
    const stopRightHand = bones.rightHand && bones.rightHand !== bones.rightLowerArm
      ? new Set<THREE.Object3D>([bones.rightHand])
      : undefined;
    markSubtree(bones.rightLowerArm, 'rightForearm', stopRightHand);
  }
  if (bones.rightHand) {
    markSubtree(bones.rightHand, 'rightHand');
  }

  if (bones.leftLowerArm) {
    const stopLeftHand = bones.leftHand && bones.leftHand !== bones.leftLowerArm
      ? new Set<THREE.Object3D>([bones.leftHand])
      : undefined;
    markSubtree(bones.leftLowerArm, 'leftForearm', stopLeftHand);
  }
  if (bones.leftHand) {
    markSubtree(bones.leftHand, 'leftHand');
  }

  const pushSample = (region: BodyRegion | undefined, hair: boolean, pt: THREE.Vector3) => {
    if (region === 'head') {
      if (hair) result.headHairPts.push(pt);
      else result.headBodyPts.push(pt);
    } else if (region === 'torso') {
      result.torsoPts.push(pt);
    } else if (region === 'rightHand') {
      result.rightHandPts.push(pt);
    } else if (region === 'rightForearm') {
      result.rightForearmPts.push(pt);
    }
  };

  const findAncestorRegion = (obj: THREE.Object3D): BodyRegion | undefined => {
    let cur: THREE.Object3D | null = obj;
    while (cur) {
      const reg = boneRegionMap.get(cur);
      if (reg) return reg;
      cur = cur.parent;
    }
    return undefined;
  };

  heroCustom.modelRoot.traverse((obj) => {
    if (obj.name === 'CharAddon_HeadGear') {
      result.builtinHeadAddonNodes.push(obj);
      return;
    }
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (isIgnoredDecorativeMesh(mesh)) return;

    const posAttr = mesh.geometry.attributes.position as THREE.BufferAttribute | undefined;
    if (!posAttr || posAttr.count === 0) return;

    const hair = isHairNode(mesh);
    const skinned = mesh as THREE.SkinnedMesh;
    const step = Math.max(1, Math.floor(posAttr.count / 3600));

    if (
      skinned.isSkinnedMesh &&
      skinned.skeleton &&
      mesh.geometry.attributes.skinIndex &&
      mesh.geometry.attributes.skinWeight
    ) {
      skinned.skeleton.update();
      const idxAttr = mesh.geometry.attributes.skinIndex as THREE.BufferAttribute;
      const wAttr = mesh.geometry.attributes.skinWeight as THREE.BufferAttribute;
      const skBones = skinned.skeleton.bones;

      for (let i = 0; i < posAttr.count; i += step) {
        const w0 = wAttr.getX(i);
        const w1 = wAttr.getY(i);
        const w2 = wAttr.getZ(i);
        const w3 = wAttr.getW(i);
        let domBoneIdx = idxAttr.getX(i);
        let maxW = w0;
        if (w1 > maxW) { maxW = w1; domBoneIdx = idxAttr.getY(i); }
        if (w2 > maxW) { maxW = w2; domBoneIdx = idxAttr.getZ(i); }
        if (w3 > maxW) { domBoneIdx = idxAttr.getW(i); }

        const domBone = skBones[domBoneIdx];
        const region = domBone ? boneRegionMap.get(domBone) : undefined;
        if (!region) continue;

        _v.fromBufferAttribute(posAttr, i);
        skinned.applyBoneTransform(i, _v);
        _v.applyMatrix4(skinned.matrixWorld);
        if (Number.isFinite(_v.x) && Number.isFinite(_v.y) && Number.isFinite(_v.z)) {
          pushSample(region, hair, _v.clone());
        }
      }
    } else {
      const region = findAncestorRegion(mesh);
      if (!region) return;
      for (let i = 0; i < posAttr.count; i += step) {
        _v.fromBufferAttribute(posAttr, i).applyMatrix4(mesh.matrixWorld);
        if (Number.isFinite(_v.x) && Number.isFinite(_v.y) && Number.isFinite(_v.z)) {
          pushSample(region, hair, _v.clone());
        }
      }
    }
  });

  return result;
}

function buildWearableHatGroup(fitRx: number, fitRz: number, heroScale: number): THREE.Group {
  const hat = new THREE.Group();
  hat.name = 'HeroEquip_WearHeadHat';
  const sx = fitRx / 0.24;
  const sz = fitRz / 0.24;
  const sy = (sx + sz) * 0.5;
  hat.scale.set(sx, sy, sz);

  const feltMat = new THREE.MeshStandardMaterial({
    color: '#9A5B2F',
    roughness: 0.76,
    flatShading: true,
  });
  const bandMat = new THREE.MeshStandardMaterial({
    color: '#2F855A',
    roughness: 0.65,
  });
  const featherMat = new THREE.MeshStandardMaterial({
    color: '#F59E0B',
    roughness: 0.55,
  });

  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.048, 16), feltMat);
  brim.position.y = 0.015;
  brim.castShadow = true;

  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.258, 0.23, 14), feltMat);
  crown.position.y = 0.135;
  crown.castShadow = true;

  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.246, 0.256, 0.052, 14), bandMat);
  band.position.y = 0.058;

  const feather = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.21, 5), featherMat);
  feather.position.set(0.22, 0.18, 0.02);
  feather.rotation.z = -0.36;

  hat.add(brim, crown, band, feather);
  hat.userData.tintMeshes = [brim, crown];
  hat.userData.defaultHex = '#9A5B2F';
  hat.userData.heroScale = heroScale;
  hat.visible = false;
  return hat;
}

function buildWearableCrownGroup(fitRx: number, fitRz: number): THREE.Group {
  const crown = new THREE.Group();
  crown.name = 'HeroEquip_WearHeadCrown';
  const sx = fitRx / 0.22;
  const sz = fitRz / 0.22;
  const sy = (sx + sz) * 0.5;
  crown.scale.set(sx, sy, sz);

  const goldMat = new THREE.MeshStandardMaterial({
    color: '#F2C230',
    roughness: 0.28,
    metalness: 0.85,
  });
  const gemMat = new THREE.MeshStandardMaterial({
    color: '#EF4444',
    emissive: '#991B1B',
    emissiveIntensity: 0.35,
    roughness: 0.2,
  });

  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.23, 0.205, 0.12, 14, 1, false),
    goldMat
  );
  band.position.y = 0.055;
  band.castShadow = true;
  crown.add(band);

  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2;
    const pt = new THREE.Mesh(new THREE.ConeGeometry(0.052, 0.13, 4), goldMat);
    pt.position.set(Math.cos(ang) * 0.19, 0.155, Math.sin(ang) * 0.19);
    pt.castShadow = true;
    crown.add(pt);

    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.024, 0), gemMat);
    gem.position.set(Math.cos(ang) * 0.22, 0.06, Math.sin(ang) * 0.22);
    crown.add(gem);
  }

  crown.userData.tintMeshes = crown.children.filter((_, idx) => idx === 0 || idx % 2 === 1);
  crown.userData.defaultHex = '#F2C230';
  crown.visible = false;
  return crown;
}

function buildWearableCloakGroup(
  torsoHalfW: number,
  torsoHalfD: number,
  capeLen: number,
  heroScale: number
): THREE.Group {
  const cloakGroup = new THREE.Group();
  cloakGroup.name = 'HeroEquip_WearBodyCloak';

  const cloakMat = new THREE.MeshStandardMaterial({
    color: '#256F3E',
    roughness: 0.78,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  const claspMat = new THREE.MeshStandardMaterial({
    color: '#F2C230',
    roughness: 0.32,
    metalness: 0.82,
  });

  const depthScale = THREE.MathUtils.clamp(
    torsoHalfD / Math.max(0.08, torsoHalfW * 0.92),
    0.72,
    1.35
  );

  // Draped back cape wrapping smoothly around back (-Z) & sides without clipping into torso
  const topR = torsoHalfW * 1.07;
  const botR = torsoHalfW * 1.32;
  const capeGeo = new THREE.CylinderGeometry(
    topR,
    botR,
    capeLen,
    16,
    2,
    true,
    Math.PI * 0.60,
    Math.PI * 0.80
  );
  const capeMesh = new THREE.Mesh(capeGeo, cloakMat);
  capeMesh.scale.set(1, 1, depthScale);
  capeMesh.position.set(0, -capeLen * 0.48, -0.02 * heroScale);
  capeMesh.rotation.x = 0.11;
  capeMesh.castShadow = true;

  // Shoulder mantle collar hugging upper shoulders & leaving V-opening in front
  const collarH = Math.max(0.085, 0.11 * heroScale);
  const collarGeo = new THREE.CylinderGeometry(
    torsoHalfW * 0.82,
    torsoHalfW * 1.09,
    collarH,
    16,
    1,
    true,
    Math.PI * 0.28,
    Math.PI * 1.44
  );
  const collarMesh = new THREE.Mesh(collarGeo, cloakMat);
  collarMesh.scale.set(1, 1, depthScale);
  collarMesh.position.set(0, -collarH * 0.36, 0);
  collarMesh.castShadow = true;

  // Front clasp resting against upper collarbone
  const clasp = new THREE.Mesh(new THREE.OctahedronGeometry(0.032 * heroScale, 0), claspMat);
  clasp.position.set(0, -collarH * 0.55, torsoHalfD + 0.018 * heroScale);

  cloakGroup.add(capeMesh, collarMesh, clasp);
  cloakGroup.userData.tintMeshes = [capeMesh, collarMesh];
  cloakGroup.userData.defaultHex = '#256F3E';
  cloakGroup.visible = false;
  return cloakGroup;
}

function buildWearableAmuletGroup(
  torsoHalfW: number,
  heroScale: number
): THREE.Group {
  const amulet = new THREE.Group();
  amulet.name = 'HeroEquip_WearAccessoryAmulet';

  const cordMat = new THREE.MeshStandardMaterial({
    color: '#5C4033',
    roughness: 0.82,
  });
  const ringMat = new THREE.MeshStandardMaterial({
    color: '#E7E5E4',
    roughness: 0.6,
    flatShading: true,
  });
  const gemMat = new THREE.MeshStandardMaterial({
    color: '#2DD4BF',
    emissive: '#14B8A6',
    emissiveIntensity: 1.1,
    roughness: 0.22,
  });

  const s = THREE.MathUtils.clamp(torsoHalfW / 0.24, 0.78, 1.55);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.068 * s, 0.018 * s, 6, 12), ringMat);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.048 * s, 0), gemMat);
  gem.position.z = 0.014 * s;

  // Subtle neck cord rising back from pendant toward collarbone
  const cord = new THREE.Mesh(
    new THREE.TorusGeometry(0.11 * s, 0.011 * heroScale, 6, 16, Math.PI * 1.15),
    cordMat
  );
  cord.position.set(0, 0.065 * s, -0.07 * s);
  cord.rotation.set(Math.PI * 0.34, 0, Math.PI * 0.92);

  amulet.add(ring, gem, cord);
  amulet.userData.tintMeshes = [gem];
  amulet.userData.defaultHex = '#2DD4BF';
  amulet.visible = false;
  return amulet;
}

function buildHeldItemsInAnchor(anchor: THREE.Group, heroScale: number): {
  sword: THREE.Group;
  axe: THREE.Group;
  fishingPole: THREE.Group;
  fishingRodTip: THREE.Object3D;
  torch: THREE.Group;
  heldGeneric: THREE.Mesh;
} {
  const hs = heroScale;
  const bootMat = new THREE.MeshStandardMaterial({ color: '#3B2B23', roughness: 0.8 });
  const goldMat = new THREE.MeshStandardMaterial({ color: '#F2C230', roughness: 0.28, metalness: 0.85 });
  const steelMat = new THREE.MeshStandardMaterial({ color: '#D0D7E2', roughness: 0.25, metalness: 0.88 });
  const axeWoodMat = new THREE.MeshStandardMaterial({ color: '#8F5A32', roughness: 0.82, flatShading: true });
  const axeSteelMat = new THREE.MeshStandardMaterial({ color: '#BCC7D6', roughness: 0.3, metalness: 0.82, flatShading: true });
  const axeEdgeMat = new THREE.MeshStandardMaterial({ color: '#EEF4FA', roughness: 0.18, metalness: 0.92, flatShading: true });

  // 1. Sword (grip centered inside palm, blade extending forward + slightly upward)
  const sword = new THREE.Group();
  sword.name = 'HeroEquip_Sword';
  sword.rotation.x = -0.14;
  sword.visible = false;
  const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.026 * hs, 0.028 * hs, 0.17 * hs, 8), bootMat);
  hilt.rotation.x = Math.PI / 2;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.17 * hs, 0.038 * hs, 0.045 * hs), goldMat);
  guard.position.z = 0.08 * hs;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.056 * hs, 0.028 * hs, 0.54 * hs), steelMat);
  blade.position.z = 0.36 * hs;
  blade.castShadow = true;
  sword.add(hilt, guard, blade);
  anchor.add(sword);

  // 2. Woodcutter's Axe (lower handle held in palm, heavy steel head extending forward)
  const axe = new THREE.Group();
  axe.name = 'HeroEquip_Axe';
  axe.rotation.x = -0.18;
  axe.visible = false;
  const axeHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.025 * hs, 0.032 * hs, 0.82 * hs, 7), axeWoodMat);
  axeHandle.rotation.x = Math.PI / 2;
  axeHandle.position.z = 0.28 * hs;
  axeHandle.castShadow = true;
  const axeCollar = new THREE.Mesh(new THREE.BoxGeometry(0.082 * hs, 0.1 * hs, 0.13 * hs), axeSteelMat);
  axeCollar.position.set(0, 0.015 * hs, 0.60 * hs);
  const axeHead = new THREE.Mesh(new THREE.BoxGeometry(0.055 * hs, 0.26 * hs, 0.21 * hs), axeSteelMat);
  axeHead.position.set(0, -0.085 * hs, 0.63 * hs);
  axeHead.castShadow = true;
  const axeBevel = new THREE.Mesh(new THREE.CylinderGeometry(0.018 * hs, 0.018 * hs, 0.27 * hs, 4), axeEdgeMat);
  axeBevel.position.set(0, -0.195 * hs, 0.64 * hs);
  axeBevel.rotation.x = Math.PI / 2;
  axe.add(axeHandle, axeCollar, axeHead, axeBevel);
  anchor.add(axe);

  // 3. Bamboo Fishing Pole
  const fishingPole = new THREE.Group();
  fishingPole.name = 'HeroEquip_FishingPole';
  fishingPole.rotation.x = -0.16;
  fishingPole.visible = false;
  const bambooMat = new THREE.MeshStandardMaterial({ color: '#C99B4E', roughness: 0.68, flatShading: true });
  const rodCorkMat = new THREE.MeshStandardMaterial({ color: '#7D4E2A', roughness: 0.85 });
  const rodGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.028 * hs, 0.032 * hs, 0.26 * hs, 6), rodCorkMat);
  rodGrip.rotation.x = Math.PI / 2;
  rodGrip.position.z = 0.06 * hs;
  const rodLower = new THREE.Mesh(new THREE.CylinderGeometry(0.016 * hs, 0.025 * hs, 0.92 * hs, 6), bambooMat);
  rodLower.rotation.x = Math.PI / 2;
  rodLower.position.z = 0.62 * hs;
  rodLower.castShadow = true;
  const rodUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.008 * hs, 0.016 * hs, 0.88 * hs, 5), bambooMat);
  rodUpper.rotation.x = Math.PI / 2 + 0.09;
  rodUpper.position.set(0, 0.04 * hs, 1.48 * hs);
  rodUpper.castShadow = true;
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * hs, 0.05 * hs, 0.04 * hs, 10), goldMat);
  reel.rotation.z = Math.PI / 2;
  reel.position.set(0.038 * hs, -0.045 * hs, 0.23 * hs);
  const fishingRodTip = new THREE.Object3D();
  fishingRodTip.position.set(0, 0.08 * hs, 1.92 * hs);
  fishingPole.add(rodGrip, rodLower, rodUpper, reel, fishingRodTip);
  anchor.add(fishingPole);

  // 4. Pine Torch (angled upward ~32° from fist)
  const torch = new THREE.Group();
  torch.name = 'HeroEquip_Torch';
  torch.visible = false;
  const torchStick = new THREE.Mesh(new THREE.CylinderGeometry(0.032 * hs, 0.023 * hs, 0.58 * hs, 6), axeWoodMat);
  torchStick.rotation.x = Math.PI / 2 - 0.42;
  torchStick.position.set(0, 0.09 * hs, 0.20 * hs);
  const torchFlame = new THREE.Mesh(
    new THREE.ConeGeometry(0.088 * hs, 0.22 * hs, 6),
    new THREE.MeshStandardMaterial({
      color: '#FFBA49',
      emissive: '#FF6B00',
      emissiveIntensity: 2.0,
      roughness: 0.2,
      flatShading: true,
    })
  );
  torchFlame.position.set(0, 0.24 * hs, 0.41 * hs);
  const torchLight = new THREE.PointLight('#FF9E44', 5.2, 14, 1.6);
  torchLight.position.set(0, 0.28 * hs, 0.45 * hs);
  torch.userData.torchLight = torchLight;
  torch.add(torchStick, torchFlame, torchLight);
  anchor.add(torch);

  // 5. Generic Held Item
  const heldGeneric = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.095 * hs, 0),
    new THREE.MeshStandardMaterial({ color: '#F59E0B', roughness: 0.45, flatShading: true })
  );
  heldGeneric.name = 'HeroEquip_HeldGeneric';
  heldGeneric.position.set(0, 0, 0.04 * hs);
  heldGeneric.visible = false;
  anchor.add(heldGeneric);

  return { sword, axe, fishingPole, fishingRodTip, torch, heldGeneric };
}

/**
 * Measures the custom character's actual bones and skinned/rigid body geometry in resting idle pose,
 * then builds and attaches conformed held & worn equipment directly onto the character's head, torso,
 * and hand bones so items sit naturally on any Character Maker or imported GLB hero.
 */
export function attachEquipmentToCustomModel(
  heroCustom: CustomModelInstance,
  visualStyle: VisualStyleId
): HeroEquipmentHandles {
  const prevPos = heroCustom.group.position.clone();
  const prevQuat = heroCustom.group.quaternion.clone();
  const prevScale = heroCustom.group.scale.clone();

  heroCustom.group.position.set(0, 0, 0);
  heroCustom.group.quaternion.identity();
  heroCustom.group.scale.set(1, 1, 1);

  // Settle rig into relaxed standing idle pose so armRelaxAngle & idle clip transforms are active
  heroCustom.setAction('idle', 0);
  for (let i = 0; i < 14; i++) {
    heroCustom.update(0.08, 1);
  }
  heroCustom.group.updateMatrixWorld(true);

  const overallBox = new THREE.Box3();
  heroCustom.scaledRoot.traverse((obj) => {
    if (obj.name?.startsWith('CharAddon_')) return;
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible || !mesh.geometry) return;
    if (/shadow|slash/i.test(mesh.name ?? '')) return;
    mesh.geometry.computeBoundingBox();
    if (mesh.geometry.boundingBox) {
      const box = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
      overallBox.union(box);
    }
  });
  if (overallBox.isEmpty()) {
    overallBox.set(new THREE.Vector3(-0.35, 0, -0.25), new THREE.Vector3(0.35, 1.65, 0.25));
  }

  const charSize = new THREE.Vector3();
  const charCenter = new THREE.Vector3();
  overallBox.getSize(charSize);
  overallBox.getCenter(charCenter);
  const charHeight = Math.max(0.65, charSize.y);
  const heroScale = THREE.MathUtils.clamp(charHeight / 1.65, 0.55, 2.3);

  const bones = {
    head: resolveRoleBone(heroCustom, 'head'),
    neck: resolveRoleBone(heroCustom, 'neck'),
    chest: resolveRoleBone(heroCustom, 'chest'),
    spine: resolveRoleBone(heroCustom, 'spine'),
    hips: resolveRoleBone(heroCustom, 'hips'),
    rightLowerArm: resolveRoleBone(heroCustom, 'rightLowerArm'),
    rightHand: resolveRoleBone(heroCustom, 'rightHand'),
    leftLowerArm: resolveRoleBone(heroCustom, 'leftLowerArm'),
    leftHand: resolveRoleBone(heroCustom, 'leftHand'),
  };

  const samples = collectRegionSamples(heroCustom, bones);

  // 1. Headwear Anchor (Hat & Crown conformed to upper skull + hair)
  const headTargetBone = bones.head ?? heroCustom.scaledRoot;
  const headBonePos = new THREE.Vector3();
  if (bones.head) {
    bones.head.getWorldPosition(headBonePos);
  } else {
    headBonePos.set(charCenter.x, overallBox.min.y + charHeight * 0.84, charCenter.z);
  }

  const headFallbackPts: THREE.Vector3[] = [];
  if (samples.headBodyPts.length < 8) {
    // Fallback for unrigged models: use upper 26% of overall box
    const minY = overallBox.min.y + charHeight * 0.74;
    heroCustom.scaledRoot.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || isIgnoredDecorativeMesh(mesh) || !mesh.geometry?.attributes.position) return;
      const posAttr = mesh.geometry.attributes.position as THREE.BufferAttribute;
      const step = Math.max(1, Math.floor(posAttr.count / 1200));
      for (let i = 0; i < posAttr.count; i += step) {
        _v.fromBufferAttribute(posAttr, i).applyMatrix4(mesh.matrixWorld);
        if (_v.y >= minY) headFallbackPts.push(_v.clone());
      }
    });
  }
  const headPts = samples.headBodyPts.length >= 8 ? samples.headBodyPts : headFallbackPts;

  let headCenterX = headBonePos.x;
  let headCenterZ = headBonePos.z;
  let skullTopY = overallBox.max.y;
  let fitRx = 0.22 * heroScale;
  let fitRz = 0.22 * heroScale;

  if (headPts.length >= 6) {
    const maxHeadY = percentile(headPts.map((p) => p.y), 0.99);
    const upperPts = headPts.filter((p) => p.y >= THREE.MathUtils.lerp(headBonePos.y, maxHeadY, 0.22));
    const upperPool = upperPts.length >= 6 ? upperPts : headPts;

    const centralPts = upperPool.filter(
      (p) =>
        Math.abs(p.x - headBonePos.x) <= 0.16 * heroScale &&
        p.z <= headBonePos.z + 0.22 * heroScale
    );
    const crownPool = centralPts.length >= 5 ? centralPts : upperPool;
    skullTopY = percentile(crownPool.map((p) => p.y), 0.96);

    const bandPts = headPts.filter(
      (p) =>
        p.y >= skullTopY - 0.14 * heroScale &&
        p.y <= skullTopY - 0.015 * heroScale &&
        Math.abs(p.x - headBonePos.x) <= 0.36 * heroScale
    );
    const bandPool = bandPts.length >= 6 ? bandPts : upperPool;

    const bandXs = bandPool.map((p) => p.x);
    const bandZs = bandPool.map((p) => p.z);
    const minX = percentile(bandXs, 0.06);
    const maxX = percentile(bandXs, 0.94);
    headCenterX = (minX + maxX) * 0.5;
    fitRx = THREE.MathUtils.clamp((maxX - minX) * 0.5, 0.13 * heroScale, 0.36 * heroScale);

    const backZ = percentile(bandZs, 0.06);
    const frontZRaw = percentile(bandZs, 0.94);
    const backExtentZ = Math.max(0.11 * heroScale, headBonePos.z - backZ);
    const frontZ = Math.min(frontZRaw, headBonePos.z + backExtentZ * 1.25);
    headCenterZ = (backZ + frontZ) * 0.5;
    fitRz = THREE.MathUtils.clamp((frontZ - backZ) * 0.5, fitRx * 0.80, fitRx * 1.22);
  }

  let hairLift = 0;
  if (samples.headHairPts.length > 0) {
    const centralHair = samples.headHairPts.filter(
      (p) => Math.abs(p.x - headCenterX) <= fitRx * 0.95 && p.y >= skullTopY - 0.06 * heroScale
    );
    if (centralHair.length > 0) {
      const hairTopY = percentile(centralHair.map((p) => p.y), 0.94);
      hairLift = THREE.MathUtils.clamp((hairTopY - skullTopY) * 0.42, 0, 0.045 * heroScale);
      if (hairLift > 0.005 * heroScale) {
        fitRx *= 1.06;
        fitRz *= 1.06;
      }
    }
  }

  const hatSeatPos = new THREE.Vector3(
    headCenterX,
    skullTopY + hairLift - 0.02 * heroScale,
    headCenterZ
  );
  const headAnchor = mountOnBoneInHolderSpace(
    headTargetBone,
    hatSeatPos,
    _identityQuat,
    'HeroEquip_HeadAnchor'
  );
  const wearHeadHat = buildWearableHatGroup(fitRx, fitRz, heroScale);
  const wearHeadCrown = buildWearableCrownGroup(fitRx * 0.94, fitRz * 0.94);
  wearHeadCrown.position.y = 0.005 * heroScale;
  headAnchor.add(wearHeadHat, wearHeadCrown);

  // 2. Torso Anchors (Woodland Cloak & Chest Amulet conformed to chest/back/front)
  const torsoTargetBone = bones.chest ?? bones.spine ?? bones.hips ?? heroCustom.scaledRoot;
  let torsoPts = samples.torsoPts;
  if (torsoPts.length < 8) {
    const tMinY = overallBox.min.y + charHeight * 0.34;
    const tMaxY = overallBox.min.y + charHeight * 0.72;
    const fallbackTorso: THREE.Vector3[] = [];
    heroCustom.scaledRoot.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || isIgnoredDecorativeMesh(mesh) || !mesh.geometry?.attributes.position) return;
      const posAttr = mesh.geometry.attributes.position as THREE.BufferAttribute;
      const step = Math.max(1, Math.floor(posAttr.count / 1200));
      for (let i = 0; i < posAttr.count; i += step) {
        _v.fromBufferAttribute(posAttr, i).applyMatrix4(mesh.matrixWorld);
        if (_v.y >= tMinY && _v.y <= tMaxY && Math.abs(_v.x - charCenter.x) <= charSize.x * 0.3) {
          fallbackTorso.push(_v.clone());
        }
      }
    });
    torsoPts = fallbackTorso;
  }

  let torsoCenterX = charCenter.x;
  let torsoMinY = overallBox.min.y + charHeight * 0.42;
  let torsoMaxY = overallBox.min.y + charHeight * 0.72;
  let torsoHalfW = 0.24 * heroScale;
  let torsoBackZ = charCenter.z - 0.16 * heroScale;
  let torsoFrontZ = charCenter.z + 0.16 * heroScale;
  let chestFrontCenterZ = torsoFrontZ;

  if (torsoPts.length >= 6) {
    const tYs = torsoPts.map((p) => p.y);
    torsoMinY = percentile(tYs, 0.04);
    torsoMaxY = percentile(tYs, 0.96);
    const torsoSpan = Math.max(0.28 * heroScale, torsoMaxY - torsoMinY);
    const upperPts = torsoPts.filter((p) => p.y >= torsoMaxY - torsoSpan * 0.36);
    const upperPool = upperPts.length >= 5 ? upperPts : torsoPts;
    const midUpperPts = torsoPts.filter((p) => p.y >= torsoMinY + torsoSpan * 0.26);
    const backPool = midUpperPts.length >= 5 ? midUpperPts : torsoPts;

    const upperXs = upperPool.map((p) => p.x);
    const minTX = percentile(upperXs, 0.06);
    const maxTX = percentile(upperXs, 0.94);
    torsoCenterX = (minTX + maxTX) * 0.5;
    torsoHalfW = THREE.MathUtils.clamp((maxTX - minTX) * 0.5, 0.16 * heroScale, 0.46 * heroScale);

    torsoBackZ = percentile(backPool.map((p) => p.z), 0.04);
    torsoFrontZ = percentile(upperPool.map((p) => p.z), 0.96);

    const frontCenterPts = upperPool.filter(
      (p) =>
        Math.abs(p.x - torsoCenterX) <= torsoHalfW * 0.45 &&
        p.y <= torsoMaxY - torsoSpan * 0.06
    );
    chestFrontCenterZ =
      frontCenterPts.length > 0
        ? percentile(frontCenterPts.map((p) => p.z), 0.96)
        : torsoFrontZ;
  }

  const torsoSpan = Math.max(0.30 * heroScale, torsoMaxY - torsoMinY);
  const shoulderTopY = torsoMaxY - torsoSpan * 0.04;
  const torsoMidZ = (torsoBackZ + torsoFrontZ) * 0.5;
  const torsoHalfD = THREE.MathUtils.clamp(
    (torsoFrontZ - torsoBackZ) * 0.5,
    torsoHalfW * 0.55,
    torsoHalfW * 1.25
  );
  const capeLen = THREE.MathUtils.clamp(torsoSpan * 1.08, 0.46 * heroScale, 0.92 * heroScale);

  const cloakAnchor = mountOnBoneInHolderSpace(
    torsoTargetBone,
    new THREE.Vector3(torsoCenterX, shoulderTopY, torsoMidZ),
    _identityQuat,
    'HeroEquip_CloakAnchor'
  );
  const wearBodyCloak = buildWearableCloakGroup(torsoHalfW, torsoHalfD, capeLen, heroScale);
  cloakAnchor.add(wearBodyCloak);

  const amuletY = shoulderTopY - Math.min(0.14 * heroScale, torsoSpan * 0.24);
  const amuletAnchor = mountOnBoneInHolderSpace(
    torsoTargetBone,
    new THREE.Vector3(torsoCenterX, amuletY, chestFrontCenterZ + 0.02 * heroScale),
    _identityQuat,
    'HeroEquip_AmuletAnchor'
  );
  const wearAccessoryAmulet = buildWearableAmuletGroup(torsoHalfW, heroScale);
  amuletAnchor.add(wearAccessoryAmulet);

  // 3. Right-Hand Grip Anchor (Sword, Axe, Fishing Pole, Torch, Generic Held Item)
  const handTargetBone = bones.rightHand ?? bones.rightLowerArm ?? heroCustom.scaledRoot;
  const hasDedicatedHandBone = Boolean(bones.rightHand && bones.rightHand !== bones.rightLowerArm);
  const gripPos = new THREE.Vector3();
  if (samples.rightHandPts.length >= 4 && hasDedicatedHandBone && bones.rightHand) {
    const centroid = new THREE.Vector3();
    for (const pt of samples.rightHandPts) centroid.add(pt);
    centroid.divideScalar(samples.rightHandPts.length);

    bones.rightHand.getWorldPosition(_v2);
    const offset = centroid.clone().sub(_v2);
    const maxHandOffset = 0.22 * heroScale;
    if (offset.length() > maxHandOffset) {
      offset.setLength(maxHandOffset);
    }
    gripPos.copy(_v2).addScaledVector(offset, 0.65);
  } else if (samples.rightHandPts.length >= 4 && !bones.rightHand) {
    const centroid = new THREE.Vector3();
    for (const pt of samples.rightHandPts) centroid.add(pt);
    centroid.divideScalar(samples.rightHandPts.length);
    gripPos.copy(centroid);
  } else if (bones.rightHand) {
    bones.rightHand.getWorldPosition(gripPos);
    if (!hasDedicatedHandBone && samples.rightHandPts.length >= 4) {
      // Forearm-only rig (no wrist bone): pick distal tip furthest from elbow
      let furthest = samples.rightHandPts[0];
      let bestDistSq = 0;
      for (const pt of samples.rightHandPts) {
        const dSq = pt.distanceToSquared(gripPos);
        if (dSq > bestDistSq) {
          bestDistSq = dSq;
          furthest = pt;
        }
      }
      gripPos.lerp(furthest, 0.88);
    } else if (bones.rightLowerArm && bones.rightLowerArm !== bones.rightHand) {
      bones.rightLowerArm.getWorldPosition(_v2);
      const dir = gripPos.clone().sub(_v2);
      if (dir.lengthSq() > 1e-5) {
        dir.normalize();
        gripPos.addScaledVector(dir, 0.045 * heroScale);
      }
    }
  } else if (samples.rightForearmPts.length >= 4) {
    // Lowest/outermost point of right forearm
    let lowest = samples.rightForearmPts[0];
    for (const pt of samples.rightForearmPts) {
      if (pt.y < lowest.y) lowest = pt;
    }
    gripPos.copy(lowest);
  } else {
    gripPos.set(
      charCenter.x - Math.max(0.28 * heroScale, charSize.x * 0.34),
      overallBox.min.y + charHeight * 0.45,
      charCenter.z + 0.08 * heroScale
    );
  }

  const handAnchor = mountOnBoneInHolderSpace(
    handTargetBone,
    gripPos,
    _identityQuat,
    'HeroEquip_RightHandAnchor'
  );
  const held = buildHeldItemsInAnchor(handAnchor, heroScale);

  // Left-Hand Grip Anchor (used for two-handed Parachute Blanket corner grip)
  const leftHandTargetBone = bones.leftHand ?? bones.leftLowerArm ?? heroCustom.scaledRoot;
  const hasDedicatedLeftHandBone = Boolean(
    bones.leftHand && bones.leftHand !== bones.leftLowerArm
  );
  const leftGripPos = new THREE.Vector3();
  if (bones.leftHand) {
    bones.leftHand.getWorldPosition(leftGripPos);
    if (hasDedicatedLeftHandBone && bones.leftLowerArm && bones.leftLowerArm !== bones.leftHand) {
      bones.leftLowerArm.getWorldPosition(_v2);
      const dir = leftGripPos.clone().sub(_v2);
      if (dir.lengthSq() > 1e-5) {
        dir.normalize();
        leftGripPos.addScaledVector(dir, 0.045 * heroScale);
      }
    }
  } else {
    leftGripPos.set(
      charCenter.x + Math.max(0.28 * heroScale, charSize.x * 0.34),
      gripPos.y,
      gripPos.z
    );
  }
  const leftHandAnchor = mountOnBoneInHolderSpace(
    leftHandTargetBone,
    leftGripPos,
    _identityQuat,
    'HeroEquip_LeftHandAnchor'
  );

  // Off-hand Shield attached to Left Hand / Forearm Anchor
  const customShield = new THREE.Group();
  customShield.name = 'HeroEquip_Shield';
  customShield.position.set(0.09 * heroScale, 0.02 * heroScale, 0.08 * heroScale);
  customShield.rotation.set(0.04, -0.22, 0);
  const shieldFaceMat = new THREE.MeshStandardMaterial({ color: '#B47634', roughness: 0.62, flatShading: true });
  const shieldRimMat = new THREE.MeshStandardMaterial({ color: '#94A3B8', roughness: 0.35, metalness: 0.52 });
  const shieldBoard = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26 * heroScale, 0.21 * heroScale, 0.05 * heroScale, 8),
    shieldFaceMat
  );
  shieldBoard.rotation.z = Math.PI / 2;
  shieldBoard.scale.set(1.16, 1, 0.92);
  shieldBoard.castShadow = true;
  const shieldRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.24 * heroScale, 0.024 * heroScale, 6, 12),
    shieldRimMat
  );
  shieldRim.rotation.y = Math.PI / 2;
  shieldRim.scale.set(0.92, 1.12, 1);
  const shieldBoss = new THREE.Mesh(new THREE.SphereGeometry(0.062 * heroScale, 8, 6), shieldRimMat);
  shieldBoss.position.set(0.032 * heroScale, 0, 0);
  shieldBoss.scale.set(0.55, 1, 1);
  customShield.userData.tintMeshes = [shieldBoard];
  customShield.add(shieldBoard, shieldRim, shieldBoss);
  customShield.visible = false;
  leftHandAnchor.add(customShield);

  // Match project visual style on all newly constructed equipment meshes
  applyBotwStyleToObject(headAnchor, visualStyle);
  applyBotwStyleToObject(cloakAnchor, visualStyle);
  applyBotwStyleToObject(amuletAnchor, visualStyle);
  applyBotwStyleToObject(handAnchor, visualStyle);
  applyBotwStyleToObject(leftHandAnchor, visualStyle);

  // Restore original root transform cleanly
  heroCustom.group.position.copy(prevPos);
  heroCustom.group.quaternion.copy(prevQuat);
  heroCustom.group.scale.copy(prevScale);
  heroCustom.group.updateMatrixWorld(true);

  return {
    handGripL: leftHandAnchor,
    handGripR: handAnchor,
    sword: held.sword,
    axe: held.axe,
    fishingPole: held.fishingPole,
    fishingRodTip: held.fishingRodTip,
    torch: held.torch,
    heldGeneric: held.heldGeneric,
    shield: customShield,
    wearHeadHat,
    wearHeadCrown,
    wearBodyCloak,
    wearAccessoryAmulet,
    builtinHeadAddonNodes: samples.builtinHeadAddonNodes,
  };
}

function applyTintToHandle(node: THREE.Object3D, hex: string) {
  const meshes = node.userData.tintMeshes as THREE.Mesh[] | undefined;
  if (meshes && meshes.length > 0) {
    for (const m of meshes) {
      const mat = Array.isArray(m.material) ? m.material[0] : m.material;
      if ((mat as THREE.MeshStandardMaterial | undefined)?.color) {
        (mat as THREE.MeshStandardMaterial).color.set(hex);
      }
    }
    return;
  }
  const mesh = node as THREE.Mesh;
  if (mesh.isMesh && mesh.material) {
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if ((mat as THREE.MeshStandardMaterial | undefined)?.color) {
      (mat as THREE.MeshStandardMaterial).color.set(hex);
    }
  }
}

export function syncHeroEquipmentVisuals(
  handles: HeroEquipmentHandles,
  opts: {
    heldDef: InventoryItemDef | null;
    offhandDef?: InventoryItemDef | null;
    headDef: InventoryItemDef | null;
    bodyDef: InventoryItemDef | null;
    accDef: InventoryItemDef | null;
    isSwimming: boolean;
    isAttacking: boolean;
    isFishingActive: boolean;
    isGliding?: boolean;
    isBlocking?: boolean;
  }
): void {
  const {
    heldDef,
    offhandDef,
    headDef,
    bodyDef,
    accDef,
    isSwimming,
    isAttacking,
    isFishingActive,
    isGliding,
    isBlocking,
  } = opts;
  const heldTool = heldDef?.toolKind ?? null;
  const showHandProp = !isGliding && (!isSwimming || isAttacking);
  const twoHandedHeld =
    heldDef?.handedness === 'twoHand' || heldTool === 'axe' || heldTool === 'fishingPole';

  if (handles.sword) handles.sword.visible = showHandProp && heldTool === 'sword';
  if (handles.axe) handles.axe.visible = showHandProp && heldTool === 'axe';
  if (handles.fishingPole) {
    handles.fishingPole.visible =
      !isGliding && (showHandProp || isFishingActive) && heldTool === 'fishingPole';
  }
  if (handles.torch) {
    const torchOn = showHandProp && heldTool === 'torch';
    handles.torch.visible = torchOn;
    const torchLight = handles.torch.userData.torchLight as THREE.PointLight | undefined;
    if (torchLight) torchLight.intensity = torchOn ? 5.2 : 0;
  }
  if (handles.heldGeneric) {
    const isGenericHeld = Boolean(heldDef && !heldTool);
    handles.heldGeneric.visible = showHandProp && isGenericHeld;
    if (isGenericHeld && heldDef) {
      (handles.heldGeneric.material as THREE.MeshStandardMaterial).color.set(heldDef.colorHex);
    }
  }
  if (handles.shield) {
    const showShield = Boolean(offhandDef) && !isGliding && !isSwimming && !twoHandedHeld;
    handles.shield.visible = showShield;
    if (showShield && offhandDef) {
      applyTintToHandle(handles.shield, offhandDef.wearColorHex ?? offhandDef.colorHex);
      // Turn shield face forward (+Z) across the front guard when actively raised
      handles.shield.rotation.set(
        isBlocking ? 0.35 : 0.04,
        isBlocking ? -0.18 : -0.22,
        isBlocking ? -0.38 : 0
      );
    }
  }

  const isCrownItem = Boolean(
    headDef && (headDef.id === 'golden_crown' || /\bcrown\b/i.test(headDef.name))
  );
  if (handles.wearHeadHat) {
    const showHat = Boolean(headDef && !isCrownItem);
    handles.wearHeadHat.visible = showHat;
    if (showHat && headDef) {
      const hex =
        headDef.id === 'ranger_hat'
          ? headDef.wearColorHex ?? '#9A5B2F'
          : headDef.wearColorHex ?? headDef.colorHex;
      applyTintToHandle(handles.wearHeadHat, hex);
    }
  }
  if (handles.wearHeadCrown) {
    handles.wearHeadCrown.visible = isCrownItem;
    if (isCrownItem && headDef) {
      const hex =
        headDef.id === 'golden_crown'
          ? '#F2C230'
          : headDef.wearColorHex ?? headDef.colorHex;
      applyTintToHandle(handles.wearHeadCrown, hex);
    }
  }
  if (handles.builtinHeadAddonNodes && handles.builtinHeadAddonNodes.length > 0) {
    const hideBuiltin = Boolean(headDef);
    for (const addon of handles.builtinHeadAddonNodes) {
      addon.visible = !hideBuiltin;
    }
  }

  if (handles.wearBodyCloak) {
    handles.wearBodyCloak.visible = Boolean(bodyDef);
    if (bodyDef) {
      applyTintToHandle(
        handles.wearBodyCloak,
        bodyDef.wearColorHex ?? bodyDef.colorHex ?? '#256F3E'
      );
    }
  }
  if (handles.wearAccessoryAmulet) {
    handles.wearAccessoryAmulet.visible = Boolean(accDef);
    if (accDef) {
      applyTintToHandle(
        handles.wearAccessoryAmulet,
        accDef.wearColorHex ?? accDef.colorHex ?? '#2DD4BF'
      );
    }
  }
}

export const OBJECT_BODY_PART_OPTIONS: {
  id: ObjectAttachBodyPart;
  label: string;
  short: string;
}[] = [
  { id: 'rightHand', label: 'Right Hand (Main Hand)', short: 'Right Hand' },
  { id: 'leftHand', label: 'Left Hand (Off-Hand)', short: 'Left Hand' },
  { id: 'head', label: 'Head / Skull', short: 'Head' },
  { id: 'chest', label: 'Chest / Torso', short: 'Chest' },
  { id: 'back', label: 'Back / Shoulders', short: 'Back' },
  { id: 'neck', label: 'Neck / Collar', short: 'Neck' },
  { id: 'hips', label: 'Hips / Waist', short: 'Hips' },
  { id: 'leftArm', label: 'Left Arm / Forearm', short: 'Left Arm' },
  { id: 'rightArm', label: 'Right Arm / Forearm', short: 'Right Arm' },
  { id: 'leftFoot', label: 'Left Foot / Boot', short: 'Left Foot' },
  { id: 'rightFoot', label: 'Right Foot / Boot', short: 'Right Foot' },
  { id: 'leftWing', label: 'Left Wing (Creatures)', short: 'Left Wing' },
  { id: 'rightWing', label: 'Right Wing (Creatures)', short: 'Right Wing' },
  { id: 'tail', label: 'Tail (Creatures & Monsters)', short: 'Tail' },
];

export const OBJECT_BODY_PART_LABELS: Record<ObjectAttachBodyPart, string> =
  OBJECT_BODY_PART_OPTIONS.reduce(
    (acc, opt) => {
      acc[opt.id] = opt.short;
      return acc;
    },
    {} as Record<ObjectAttachBodyPart, string>
  );

export function resolveItemAttachBodyPart(
  item: InventoryItemDef | null | undefined,
  customAssets?: CustomAssetMeta[]
): ObjectAttachBodyPart | null {
  if (!item) return null;
  if (item.attachBodyPart) return item.attachBodyPart;
  if (item.customAssetId && customAssets) {
    const meta = customAssets.find((a) => a.id === item.customAssetId);
    if (meta?.attachBodyPart) return meta.attachBodyPart;
  }
  if (item.toolKind) return 'rightHand';
  if (item.wearSlot === 'offhand') return 'leftHand';
  if (item.wearSlot === 'head') return 'head';
  if (item.wearSlot === 'body') return 'back';
  if (item.wearSlot === 'accessory') return 'neck';
  return null;
}

function disposeAttachedGroup(group: THREE.Object3D | null | undefined) {
  if (!group) return;
  group.parent?.remove(group);
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    if (mesh.material) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        m.dispose();
      }
    }
  });
}

function clearNativeHeroRigEquipment(heroRig: HeroRig | undefined) {
  if (!heroRig) return;
  if (heroRig.sword) heroRig.sword.visible = false;
  if (heroRig.axe) heroRig.axe.visible = false;
  if (heroRig.fishingPole) heroRig.fishingPole.visible = false;
  if (heroRig.torch) {
    heroRig.torch.visible = false;
    const torchLight = heroRig.torch.userData.torchLight as THREE.PointLight | undefined;
    if (torchLight) torchLight.intensity = 0;
  }
  if (heroRig.heldGeneric) heroRig.heldGeneric.visible = false;
  if (heroRig.shield) heroRig.shield.visible = false;
  if (heroRig.wearHeadHat) heroRig.wearHeadHat.visible = false;
  if (heroRig.wearHeadCrown) heroRig.wearHeadCrown.visible = false;
  if (heroRig.wearBodyCloak) heroRig.wearBodyCloak.visible = false;
  if (heroRig.wearAccessoryAmulet) heroRig.wearAccessoryAmulet.visible = false;
}

function findNamedBoneInRoot(
  root: THREE.Object3D,
  patterns: RegExp[],
  exclude?: RegExp
): THREE.Object3D | null {
  const candidates: THREE.Object3D[] = [];
  root.traverse((obj) => {
    if (!obj.name) return;
    if (exclude && exclude.test(obj.name)) return;
    candidates.push(obj);
  });
  for (const pat of patterns) {
    const boneHit = candidates.find((c) => (c as THREE.Bone).isBone && pat.test(c.name));
    if (boneHit) return boneHit;
    const objHit = candidates.find((c) => pat.test(c.name));
    if (objHit) return objHit;
  }
  return null;
}

function resolveAttachmentBone(
  runtime: {
    instance: CustomModelInstance;
    heroRig?: HeroRig;
    baddieRig?: BaddieRig;
    quadrupedRig?: QuadrupedMonsterRig;
    customEquipmentHandles?: HeroEquipmentHandles | null;
  },
  part: ObjectAttachBodyPart
): THREE.Object3D {
  const root = runtime.instance.modelRoot;
  const rig = runtime.instance.proceduralRig;
  const heroRig = runtime.heroRig;
  const baddieRig = runtime.baddieRig;
  const customHandles = runtime.customEquipmentHandles;

  switch (part) {
    case 'rightHand':
      return (
        heroRig?.handGripR ??
        customHandles?.handGripR ??
        resolveRoleBone(runtime.instance, 'rightHand') ??
        heroRig?.forearmR ??
        baddieRig?.armR ??
        rig?.getRoleBoneNode('rightLowerArm') ??
        rig?.getRoleBoneNode('rightUpperArm') ??
        findNamedBoneInRoot(root, [/claw.*r|front.*right|right.*paw|mouthanchor/i]) ??
        root
      );
    case 'leftHand':
      return (
        heroRig?.handGripL ??
        customHandles?.handGripL ??
        resolveRoleBone(runtime.instance, 'leftHand') ??
        heroRig?.forearmL ??
        baddieRig?.armL ??
        rig?.getRoleBoneNode('leftLowerArm') ??
        rig?.getRoleBoneNode('leftUpperArm') ??
        findNamedBoneInRoot(root, [/claw.*l|front.*left|left.*paw/i]) ??
        root
      );
    case 'head':
      return (
        heroRig?.head ??
        baddieRig?.head ??
        rig?.getRoleBoneNode('head') ??
        resolveRoleBone(runtime.instance, 'head') ??
        findNamedBoneInRoot(root, [/monsterhead|head/i], /hat|hair|eye|jaw|end/i) ??
        root
      );
    case 'neck':
      return (
        rig?.getRoleBoneNode('neck') ??
        resolveRoleBone(runtime.instance, 'neck') ??
        findNamedBoneInRoot(root, [/neck/i]) ??
        rig?.getRoleBoneNode('chest') ??
        heroRig?.spinePivot ??
        baddieRig?.torso ??
        root
      );
    case 'chest':
    case 'back':
      return (
        rig?.getRoleBoneNode('chest') ??
        resolveRoleBone(runtime.instance, 'chest') ??
        heroRig?.torso ??
        baddieRig?.torso ??
        heroRig?.spinePivot ??
        rig?.getRoleBoneNode('spine') ??
        findNamedBoneInRoot(root, [/monsterchest|chest|torso|spine/i]) ??
        root
      );
    case 'hips':
      return (
        rig?.getRoleBoneNode('hips') ??
        resolveRoleBone(runtime.instance, 'hips') ??
        heroRig?.bodyPivot ??
        baddieRig?.bodyPivot ??
        findNamedBoneInRoot(root, [/monsterhips|monsterbodypivot|hips|pelvis/i]) ??
        root
      );
    case 'leftArm':
      return (
        heroRig?.forearmL ??
        heroRig?.armL ??
        baddieRig?.armL ??
        rig?.getRoleBoneNode('leftLowerArm') ??
        rig?.getRoleBoneNode('leftUpperArm') ??
        root
      );
    case 'rightArm':
      return (
        heroRig?.forearmR ??
        heroRig?.armR ??
        baddieRig?.armR ??
        rig?.getRoleBoneNode('rightLowerArm') ??
        rig?.getRoleBoneNode('rightUpperArm') ??
        root
      );
    case 'leftFoot':
      return (
        findNamedBoneInRoot(root, [/(left|l)[_.\-\s]*(foot|ankle|toe|paw|hoof)/i], /end|tip/i) ??
        rig?.getRoleBoneNode('leftLowerLeg') ??
        rig?.getRoleBoneNode('leftUpperLeg') ??
        heroRig?.legL ??
        root
      );
    case 'rightFoot':
      return (
        findNamedBoneInRoot(root, [/(right|r)[_.\-\s]*(foot|ankle|toe|paw|hoof)/i], /end|tip/i) ??
        rig?.getRoleBoneNode('rightLowerLeg') ??
        rig?.getRoleBoneNode('rightUpperLeg') ??
        heroRig?.legR ??
        root
      );
    case 'leftWing':
      return (
        baddieRig?.wingL ??
        findNamedBoneInRoot(root, [/left.*wing|wing.*l|wingl/i]) ??
        heroRig?.armL ??
        rig?.getRoleBoneNode('chest') ??
        root
      );
    case 'rightWing':
      return (
        baddieRig?.wingR ??
        findNamedBoneInRoot(root, [/right.*wing|wing.*r|wingr/i]) ??
        heroRig?.armR ??
        rig?.getRoleBoneNode('chest') ??
        root
      );
    case 'tail':
      return (
        findNamedBoneInRoot(root, [/tail/i]) ??
        heroRig?.bodyPivot ??
        baddieRig?.bodyPivot ??
        rig?.getRoleBoneNode('hips') ??
        root
      );
  }
}

function buildNormalizedAttachmentMesh(
  item: InventoryItemDef,
  part: ObjectAttachBodyPart,
  charScale: number,
  visualStyle: VisualStyleId,
  targetBoneName: string
): THREE.Group {
  const wrapper = new THREE.Group();
  wrapper.name = 'StudioInventoryAttachment';

  let content: THREE.Group | null = null;
  if (item.customAssetId) {
    const cached = getCachedAssetSync(item.customAssetId);
    if (cached) {
      content = SkeletonUtils.clone(cached.scene) as THREE.Group;
    }
  }
  if (!content) {
    content = buildPickupItemMesh(item.meshKind, item.wearColorHex ?? item.colorHex);
    content.position.set(0, 0, 0);
    content.userData.floatSpin = false;
  }

  content.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(content);
  const size = new THREE.Vector3(0.4, 0.4, 0.4);
  const center = new THREE.Vector3();
  if (!box.isEmpty()) {
    box.getSize(size);
    box.getCenter(center);
  }
  const maxDim = Math.max(0.08, size.x, size.y, size.z);
  const desiredMeters =
    item.meshKind === 'fishingPole'
      ? 1.15
      : item.meshKind === 'sword' || item.meshKind === 'axe' || item.meshKind === 'staff'
      ? 0.72
      : part === 'back'
      ? 0.56
      : part === 'head'
      ? 0.44
      : 0.38;
  const normScale = (desiredMeters * charScale) / maxDim;

  const normalized = new THREE.Group();
  normalized.scale.setScalar(normScale);
  content.position.set(-center.x, -box.min.y, -center.z);
  normalized.add(content);

  // Orient cleanly based on target body part
  switch (part) {
    case 'rightHand':
      normalized.rotation.set(Math.PI * 0.42, 0, 0);
      normalized.position.set(0, 0, 0.04 * charScale);
      break;
    case 'leftHand':
      normalized.rotation.set(Math.PI * 0.42, 0, 0);
      normalized.position.set(0, 0, 0.04 * charScale);
      break;
    case 'head':
      normalized.position.set(0, 0.22 * charScale, 0);
      break;
    case 'neck':
      normalized.position.set(0, -0.02 * charScale, 0.16 * charScale);
      break;
    case 'chest':
      normalized.position.set(0, 0.06 * charScale, 0.2 * charScale);
      break;
    case 'back':
      normalized.position.set(0, 0.08 * charScale, -0.24 * charScale);
      normalized.rotation.set(-0.18, Math.PI, 0);
      break;
    case 'hips':
      normalized.position.set(0.22 * charScale, 0, 0.04 * charScale);
      break;
    case 'leftArm':
      normalized.position.set(0.08 * charScale, -0.06 * charScale, 0);
      break;
    case 'rightArm':
      normalized.position.set(-0.08 * charScale, -0.06 * charScale, 0);
      break;
    case 'leftFoot':
    case 'rightFoot': {
      const isHipOrUpperLeg = /upperleg|thigh/i.test(targetBoneName);
      const isLowerLeg = /lowerleg|shin|calf|knee/i.test(targetBoneName);
      const footY = isHipOrUpperLeg
        ? -0.42 * charScale
        : isLowerLeg
        ? -0.32 * charScale
        : -0.04 * charScale;
      normalized.position.set(0, footY, 0.08 * charScale);
      break;
    }
    case 'leftWing':
    case 'rightWing':
      normalized.position.set(0, 0.06 * charScale, -0.06 * charScale);
      break;
    case 'tail':
      normalized.position.set(0, 0.02 * charScale, -0.14 * charScale);
      break;
  }

  wrapper.add(normalized);
  applyBotwStyleToObject(wrapper, visualStyle);
  return wrapper;
}

export function applyStudioInventoryAttachment(opts: {
  runtime: {
    descriptor: { target: { kind: string } };
    instance: CustomModelInstance;
    boundsSize: THREE.Vector3;
    heroRig?: HeroRig;
    baddieRig?: BaddieRig;
    quadrupedRig?: QuadrupedMonsterRig;
    customEquipmentHandles?: HeroEquipmentHandles | null;
    studioAttachedGroup?: THREE.Group | null;
  };
  item: InventoryItemDef | null;
  customAssets: CustomAssetMeta[];
  visualStyle: VisualStyleId;
}): void {
  const { runtime, item, customAssets, visualStyle } = opts;

  if (runtime.studioAttachedGroup) {
    disposeAttachedGroup(runtime.studioAttachedGroup);
    runtime.studioAttachedGroup = null;
  }

  clearNativeHeroRigEquipment(runtime.heroRig);
  if (runtime.customEquipmentHandles) {
    syncHeroEquipmentVisuals(runtime.customEquipmentHandles, {
      heldDef: null,
      offhandDef: null,
      headDef: null,
      bodyDef: null,
      accDef: null,
      isSwimming: false,
      isAttacking: false,
      isFishingActive: false,
    });
  }

  if (!item) return;

  const part = resolveItemAttachBodyPart(item, customAssets);
  if (!part) return;

  const isCustomGlbActor = runtime.descriptor.target.kind === 'customAsset';
  const matchesNativeSlot =
    !item.customAssetId &&
    ((part === 'rightHand' && Boolean(item.toolKind)) ||
      (part === 'leftHand' && item.wearSlot === 'offhand') ||
      (part === 'head' && item.wearSlot === 'head') ||
      (part === 'back' && item.wearSlot === 'body') ||
      (part === 'neck' && item.wearSlot === 'accessory'));

  if (isCustomGlbActor && matchesNativeSlot) {
    if (!runtime.customEquipmentHandles) {
      runtime.customEquipmentHandles = attachEquipmentToCustomModel(
        runtime.instance,
        visualStyle
      );
    }
    syncHeroEquipmentVisuals(runtime.customEquipmentHandles, {
      heldDef: part === 'rightHand' ? item : null,
      offhandDef: part === 'leftHand' ? item : null,
      headDef: part === 'head' ? item : null,
      bodyDef: part === 'back' ? item : null,
      accDef: part === 'neck' ? item : null,
      isSwimming: false,
      isAttacking: false,
      isFishingActive: false,
    });
    return;
  }

  const heroRig = runtime.heroRig;
  const hasBuiltInHeroHandles = Boolean(
    heroRig &&
      (heroRig.sword ||
        heroRig.shield ||
        heroRig.wearHeadHat ||
        heroRig.wearHeadCrown ||
        heroRig.wearBodyCloak ||
        heroRig.wearAccessoryAmulet)
  );
  if (hasBuiltInHeroHandles && heroRig && matchesNativeSlot) {
    if (part === 'rightHand') {
      if (item.toolKind === 'sword' && heroRig.sword) heroRig.sword.visible = true;
      else if (item.toolKind === 'axe' && heroRig.axe) heroRig.axe.visible = true;
      else if (item.toolKind === 'fishingPole' && heroRig.fishingPole)
        heroRig.fishingPole.visible = true;
      else if (item.toolKind === 'torch' && heroRig.torch) {
        heroRig.torch.visible = true;
        const tl = heroRig.torch.userData.torchLight as THREE.PointLight | undefined;
        if (tl) tl.intensity = 5.2;
      }
      return;
    }
    if (part === 'leftHand' && heroRig.shield) {
      heroRig.shield.visible = true;
      applyTintToHandle(heroRig.shield, item.wearColorHex ?? item.colorHex);
      return;
    }
    if (part === 'head') {
      const isCrown =
        item.id === 'golden_crown' || /\bcrown\b/i.test(item.name);
      if (isCrown && heroRig.wearHeadCrown) {
        heroRig.wearHeadCrown.visible = true;
        applyTintToHandle(heroRig.wearHeadCrown, item.wearColorHex ?? item.colorHex);
        return;
      }
      if (!isCrown && heroRig.wearHeadHat) {
        heroRig.wearHeadHat.visible = true;
        applyTintToHandle(heroRig.wearHeadHat, item.wearColorHex ?? item.colorHex);
        return;
      }
    }
    if (part === 'back' && heroRig.wearBodyCloak) {
      heroRig.wearBodyCloak.visible = true;
      applyTintToHandle(heroRig.wearBodyCloak, item.wearColorHex ?? item.colorHex);
      return;
    }
    if (part === 'neck' && heroRig.wearAccessoryAmulet) {
      heroRig.wearAccessoryAmulet.visible = true;
      applyTintToHandle(heroRig.wearAccessoryAmulet, item.wearColorHex ?? item.colorHex);
      return;
    }
  }

  // Universal direct bone attachment for any custom object, NPC, buddy, baddie, monster, or custom body part
  const targetBone = resolveAttachmentBone(runtime, part);
  const charHeight = Math.max(0.75, runtime.boundsSize.y || 1.65);
  const charScale = THREE.MathUtils.clamp(charHeight / 1.65, 0.55, 2.2);

  targetBone.updateWorldMatrix(true, false);
  targetBone.matrixWorld.decompose(_v, _q, _s);
  const avgBoneScale = Math.max(
    0.0001,
    (Math.abs(_s.x) + Math.abs(_s.y) + Math.abs(_s.z)) / 3
  );

  const attached = buildNormalizedAttachmentMesh(
    item,
    part,
    charScale,
    visualStyle,
    targetBone.name ?? ''
  );
  attached.scale.setScalar(1 / avgBoneScale);
  targetBone.add(attached);
  runtime.studioAttachedGroup = attached;
}

