import * as THREE from 'three';
import { DefaultInventoryItems } from '../data/registries';
import type { CreatureBodyId, LevelEntity, PickupMeshKind, PropPresetId } from '../types/maker';
import { getTerrainTextureAtlas } from './proceduralTextures';
import { attachChestGoldenGlow, createBuiltinMechanismModel } from './mechanismController';
import {
  createDetailedPineTierGeometry,
  createFlutedStumpGeometry,
  createOrganicTrunkGeometry,
  createSculptedCanopyLobeGeometry,
} from './treeGeometry';
import { buildFxEmitterFallbackGroup } from './fxEmitterRuntime';
import { DUNGEON_TRAP_STYLE_META } from '../services/DungeonGenerator';
import { buildBuildingBlockMesh, buildModularDoorMesh } from './buildingBlocks';
import { buildQuadrupedMonsterMesh } from './quadrupedMonsterBuilder';
import {
  getWalkInBuildingSpec,
  isRopeBridgeEntity,
  isStoneArchBridgeEntity,
  type WalkInBuildingSpec,
} from '../utils/terrain';

export interface CreatureAnimRefs {
  creatureType: CreatureBodyId;
  tail?: THREE.Group;
  wingL?: THREE.Group;
  wingR?: THREE.Group;
  head?: THREE.Group;
}

export interface HeroRig {
  group: THREE.Group;
  bodyPivot: THREE.Group;
  spinePivot?: THREE.Group;
  shadowDisc: THREE.Mesh;
  head: THREE.Group;
  torso: THREE.Mesh;
  armL: THREE.Group;
  armR: THREE.Group;
  forearmL?: THREE.Group;
  forearmR?: THREE.Group;
  handGripL?: THREE.Object3D;
  handGripR?: THREE.Object3D;
  legL: THREE.Group;
  legR: THREE.Group;
  sword?: THREE.Group;
  axe?: THREE.Group;
  fishingPole?: THREE.Group;
  fishingRodTip?: THREE.Object3D;
  torch?: THREE.Group;
  heldGeneric?: THREE.Mesh;
  shield?: THREE.Group | THREE.Mesh;
  wearHeadHat?: THREE.Group;
  wearHeadCrown?: THREE.Group;
  wearBodyCloak?: THREE.Mesh;
  wearAccessoryAmulet?: THREE.Group;
}

export interface BaddieRig {
  isFlyer: boolean;
  bodyPivot: THREE.Group;
  torso?: THREE.Object3D;
  armR?: THREE.Group;
  armL?: THREE.Group;
  head?: THREE.Group;
  wingL?: THREE.Group;
  wingR?: THREE.Group;
  slashArc: THREE.Mesh;
  slashMat: THREE.MeshBasicMaterial;
  flashMaterials: THREE.MeshStandardMaterial[];
}

export function resolveCreatureType(name?: string, explicit?: CreatureBodyId): CreatureBodyId | undefined {
  if (explicit) return explicit;
  const lower = (name ?? '').toLowerCase();
  if (lower.includes('duckling') || lower.includes('duck')) return 'Duckling';
  if (lower.includes('skunk')) return 'Skunk';
  if (lower.includes('porcupine')) return 'Porcupine';
  if (lower.includes('mole')) return 'Mole Rat';
  if (lower.includes('vulture')) return 'Vulture';
  if (lower.includes('squirrel') || lower.includes('nutkin')) return 'Squirrel';
  if (lower.includes('badger') || lower.includes('barnaby')) return 'Badger';
  if (lower.includes('owl') || lower.includes('hoot')) return 'Owl';
  return undefined;
}

export function resolvePropPreset(name?: string, explicit?: PropPresetId): PropPresetId | undefined {
  if (explicit) return explicit;
  const lower = (name ?? '').toLowerCase();
  if (lower.includes('crafting') || lower.includes('workbench') || lower.includes('anvil') || lower.includes('bench')) {
    return 'craftingBench';
  }
  if (lower.includes('tavern') || lower.includes('inn')) return 'tavern';
  if (lower.includes('cottage') || lower.includes('burrow') || lower.includes('home')) return 'cottage';
  if (lower.includes('dock') || lower.includes('pier') || lower.includes('jetty')) return 'dock';
  if (lower.includes('campfire') || lower.includes('bonfire')) return 'campfire';
  if (lower.includes('plinth') || lower.includes('waystone') || lower.includes('save point')) {
    return 'savePlinth';
  }
  if (lower.includes('ramp') || lower.includes('jump')) return 'ramp';
  if (lower.includes('flight') || lower.includes('fly cube') || lower.includes('wing cube')) {
    return 'flightCube';
  }
  if (lower.includes('boost') || lower.includes('turbo pad')) return 'boostPad';
  if (lower.includes('barrier') || lower.includes('barricade')) return 'roadBarrier';
  if (lower.includes('arch') || lower.includes('gate')) return 'checkpointArch';
  if (lower.includes('signpost')) return 'signpost';
  return undefined;
}

function attachCreatureParts(
  creature: CreatureBodyId,
  bodyRoot: THREE.Group,
  head: THREE.Group,
  armL: THREE.Group,
  armR: THREE.Group,
  animTarget: THREE.Object3D
) {
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#14161D', roughness: 0.2 });
  const eyeHighlightMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF' });

  const addEyes = (ex: number, ey: number, ez: number, radius = 0.042) => {
    const eL = new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 8), eyeMat);
    eL.position.set(-ex, ey, ez);
    const eR = eL.clone();
    eR.position.x = ex;
    const hL = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.36, 6, 6), eyeHighlightMat);
    hL.position.set(-ex + radius * 0.25, ey + radius * 0.28, ez + radius * 0.8);
    const hR = hL.clone();
    hR.position.x = ex + radius * 0.25;
    head.add(eL, eR, hL, hR);
  };

  if (creature === 'Skunk') {
    const blackMat = new THREE.MeshStandardMaterial({ color: '#1A1B22', roughness: 0.72 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: '#F8FAFC', roughness: 0.65 });
    const pinkMat = new THREE.MeshStandardMaterial({ color: '#F48FB1', roughness: 0.45 });

    // Dorsal V-stripes on back & head blaze
    const stripeL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.46, 0.14), whiteMat);
    stripeL.position.set(-0.08, 0.86, -0.2);
    stripeL.rotation.z = -0.16;
    const stripeR = stripeL.clone();
    stripeR.position.x = 0.08;
    stripeR.rotation.z = 0.16;
    const headBlaze = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.22, 0.36), whiteMat);
    headBlaze.position.set(0, 0.16, 0.04);

    // Pointed muzzle & pink button nose
    const muzzle = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.24, 10), blackMat);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, -0.04, 0.28);
    muzzle.castShadow = true;
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), pinkMat);
    nose.position.set(0, -0.04, 0.4);
    const maskWhite = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.13, 0.14), whiteMat);
    maskWhite.position.set(0, 0.08, 0.23);

    // Rounded skunk ears
    const earL = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 8), blackMat);
    earL.scale.set(1.0, 1.15, 0.55);
    earL.position.set(-0.18, 0.21, -0.02);
    const earR = earL.clone();
    earR.position.x = 0.18;

    // Big signature S-curved fluffy striped tail
    const tail = new THREE.Group();
    tail.position.set(0, 0.62, -0.22);
    const tBase = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), blackMat);
    tBase.scale.set(0.88, 1.15, 1.1);
    tBase.position.set(0, 0.1, -0.14);
    tBase.castShadow = true;
    const tMid = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12), blackMat);
    tMid.scale.set(0.95, 1.38, 1.0);
    tMid.position.set(0, 0.38, -0.32);
    tMid.rotation.x = -0.35;
    tMid.castShadow = true;
    const tStripe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.56, 0.22), whiteMat);
    tStripe.position.set(0, 0.44, -0.4);
    tStripe.rotation.x = -0.32;
    const tPlume = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 10), whiteMat);
    tPlume.scale.set(0.9, 1.15, 0.9);
    tPlume.position.set(0, 0.72, -0.24);
    tPlume.castShadow = true;
    tail.add(tBase, tMid, tStripe, tPlume);

    head.add(headBlaze, muzzle, nose, maskWhite, earL, earR);
    addEyes(0.095, 0.03, 0.24, 0.042);
    bodyRoot.add(stripeL, stripeR, tail);
    animTarget.userData.creatureAnim = { creatureType: 'Skunk', tail, head } satisfies CreatureAnimRefs;
  } else if (creature === 'Porcupine') {
    const furMat = new THREE.MeshStandardMaterial({ color: '#784F32', roughness: 0.8 });
    const quillDark = new THREE.MeshStandardMaterial({ color: '#292524', roughness: 0.65 });
    const quillTip = new THREE.MeshStandardMaterial({ color: '#F5E6C8', roughness: 0.55 });
    const pinkNose = new THREE.MeshStandardMaterial({ color: '#E88D8D', roughness: 0.55 });

    // Rounded cute snout & rounded ears
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.125, 10, 10), furMat);
    snout.scale.set(1.05, 0.82, 1.25);
    snout.position.set(0, -0.05, 0.24);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), pinkNose);
    nose.position.set(0, -0.04, 0.37);
    const earL = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), furMat);
    earL.position.set(-0.2, 0.16, 0.02);
    const earR = earL.clone();
    earR.position.x = 0.2;
    head.add(snout, nose, earL, earR);
    addEyes(0.1, 0.04, 0.23, 0.044);

    // Dense fan of 3D banded quills radiating across back & crown
    const quillFan = new THREE.Group();
    quillFan.position.set(0, 0.92, -0.14);
    const quillOffsets: [number, number, number, number, number, number][] = [
      [0, 0.38, -0.08, -0.8, 0, 0],
      [-0.18, 0.34, -0.1, -0.7, 0.35, 0.3],
      [0.18, 0.34, -0.1, -0.7, -0.35, -0.3],
      [-0.32, 0.22, -0.12, -0.65, 0.65, 0.55],
      [0.32, 0.22, -0.12, -0.65, -0.65, -0.55],
      [0, 0.14, -0.18, -1.15, 0, 0],
      [-0.22, 0.08, -0.18, -1.1, 0.45, 0.32],
      [0.22, 0.08, -0.18, -1.1, -0.45, -0.32],
      [-0.34, -0.06, -0.14, -1.25, 0.72, 0.52],
      [0.34, -0.06, -0.14, -1.25, -0.72, -0.52],
      [0, -0.16, -0.18, -1.38, 0, 0],
      [-0.18, -0.22, -0.16, -1.42, 0.35, 0.24],
      [0.18, -0.22, -0.16, -1.42, -0.35, -0.24],
    ];
    for (const [qx, qy, qz, rx, ry, rz] of quillOffsets) {
      const qHolder = new THREE.Group();
      qHolder.position.set(qx, qy, qz);
      qHolder.rotation.set(rx, ry, rz);
      const qBase = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.34, 6), quillDark);
      qBase.position.y = 0.16;
      qBase.castShadow = true;
      const qEnd = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.2, 6), quillTip);
      qEnd.position.y = 0.34;
      qHolder.add(qBase, qEnd);
      quillFan.add(qHolder);
    }

    // Crown quills on head
    for (const [hx, rz] of [
      [-0.09, 0.28],
      [0, 0],
      [0.09, -0.28],
    ]) {
      const cq = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.28, 6), quillTip);
      cq.position.set(hx, 0.26, -0.12);
      cq.rotation.set(-0.55, 0, rz);
      head.add(cq);
    }

    const tail = new THREE.Group();
    tail.position.set(0, 0.56, -0.24);
    const tCone = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.28, 7), furMat);
    tCone.rotation.x = -1.25;
    tCone.position.z = -0.1;
    tail.add(tCone);

    bodyRoot.add(quillFan, tail);
    animTarget.userData.creatureAnim = { creatureType: 'Porcupine', tail, head } satisfies CreatureAnimRefs;
  } else if (creature === 'Mole Rat') {
    const moleSkin = new THREE.MeshStandardMaterial({ color: '#E8B3A4', roughness: 0.68 });
    const toothMat = new THREE.MeshStandardMaterial({ color: '#FFFDF7', roughness: 0.25 });
    const clawMat = new THREE.MeshStandardMaterial({ color: '#E2D4C0', roughness: 0.45 });
    const pinkNose = new THREE.MeshStandardMaterial({ color: '#F06292', roughness: 0.4 });
    const goggleRim = new THREE.MeshStandardMaterial({ color: '#5D4037', roughness: 0.5, metalness: 0.35 });
    const lensMat = new THREE.MeshStandardMaterial({
      color: '#67E8F9',
      emissive: '#0891B2',
      emissiveIntensity: 0.45,
      roughness: 0.15,
    });

    // Wide wrinkled snout & famous big buck teeth
    const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.22, 10), moleSkin);
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, -0.05, 0.25);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.058, 8, 8), pinkNose);
    nose.position.set(0, -0.04, 0.37);
    const toothL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.03), toothMat);
    toothL.position.set(-0.035, -0.14, 0.31);
    const toothR = toothL.clone();
    toothR.position.x = 0.035;

    // Digger brass goggles pushed onto forehead + tiny squinty eyes
    const gogL = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.018, 6, 12), goggleRim);
    gogL.position.set(-0.09, 0.15, 0.21);
    const gogR = gogL.clone();
    gogR.position.x = 0.09;
    const lenL = new THREE.Mesh(new THREE.CircleGeometry(0.058, 10), lensMat);
    lenL.position.set(-0.09, 0.15, 0.215);
    const lenR = lenL.clone();
    lenR.position.x = 0.09;

    // Oversized digging foreclaws on hands
    for (const arm of [armL, armR]) {
      const targetGroup = (arm.userData.forearm as THREE.Group | undefined) ?? arm;
      const clawY = arm.userData.forearm ? -0.21 : -0.4;
      for (const cx of [-0.045, 0, 0.045]) {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.14, 5), clawMat);
        claw.rotation.x = Math.PI * 0.65;
        claw.position.set(cx, clawY, 0.1);
        targetGroup.add(claw);
      }
    }

    // Curly hairless tail
    const tail = new THREE.Group();
    tail.position.set(0, 0.56, -0.22);
    const tailSeg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.028, 0.42, 8), moleSkin);
    tailSeg.rotation.x = -1.15;
    tailSeg.position.set(0, 0.04, -0.18);
    tail.add(tailSeg);

    head.add(snout, nose, toothL, toothR, gogL, gogR, lenL, lenR);
    addEyes(0.095, 0.03, 0.23, 0.034);
    bodyRoot.add(tail);
    animTarget.userData.creatureAnim = { creatureType: 'Mole Rat', tail, head } satisfies CreatureAnimRefs;
  } else if (creature === 'Duckling') {
    const fluffYellow = new THREE.MeshStandardMaterial({ color: '#FDE047', roughness: 0.72 });
    const bellyCream = new THREE.MeshStandardMaterial({ color: '#FEF9C3', roughness: 0.78 });
    const billOrange = new THREE.MeshStandardMaterial({ color: '#FB923C', roughness: 0.42 });

    // Fuzzy yellow crest tuft on head
    const tuftA = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.19, 7), fluffYellow);
    tuftA.position.set(0, 0.27, 0.02);
    tuftA.rotation.x = -0.25;
    const tuftB = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 7), fluffYellow);
    tuftB.position.set(-0.04, 0.24, -0.05);
    tuftB.rotation.set(-0.45, 0, 0.25);

    // Wide flat orange duckling bill
    const upperBill = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.055, 0.22), billOrange);
    upperBill.position.set(0, -0.045, 0.27);
    const lowerBill = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.038, 0.18), billOrange);
    lowerBill.position.set(0, -0.085, 0.25);
    const bellyPatch = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), bellyCream);
    bellyPatch.scale.set(0.95, 1.05, 0.65);
    bellyPatch.position.set(0, 0.78, 0.16);

    head.add(tuftA, tuftB, upperBill, lowerBill);
    addEyes(0.1, 0.04, 0.22, 0.046);

    // Stubby flapping puffling wings
    const makeDuckWing = (side: -1 | 1) => {
      const wPivot = new THREE.Group();
      wPivot.position.set(side * 0.27, 0.88, -0.03);
      const wingPad = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), fluffYellow);
      wingPad.scale.set(0.65, 1.15, 1.35);
      wingPad.position.set(side * 0.09, -0.1, -0.02);
      wingPad.rotation.z = side * -0.32;
      wingPad.castShadow = true;
      wPivot.add(wingPad);
      return wPivot;
    };
    const wingL = makeDuckWing(-1);
    const wingR = makeDuckWing(1);

    // Cute upturned duckling tail puff
    const tail = new THREE.Group();
    tail.position.set(0, 0.6, -0.22);
    const tailCone = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.24, 8), fluffYellow);
    tailCone.rotation.x = -0.85;
    tailCone.position.set(0, 0.06, -0.1);
    tail.add(tailCone);

    bodyRoot.add(bellyPatch, wingL, wingR, tail);
    animTarget.userData.creatureAnim = {
      creatureType: 'Duckling',
      tail,
      wingL,
      wingR,
      head,
    } satisfies CreatureAnimRefs;
  } else if (creature === 'Squirrel') {
    const russetMat = new THREE.MeshStandardMaterial({ color: '#C25E28', roughness: 0.72 });
    const creamMat = new THREE.MeshStandardMaterial({ color: '#F6E5C9', roughness: 0.78 });
    const noseMat = new THREE.MeshStandardMaterial({ color: '#4A2511', roughness: 0.45 });
    const toothMat = new THREE.MeshStandardMaterial({ color: '#FFFDF7', roughness: 0.25 });

    // Pointed squirrel ears with tiny ear tufts
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.082, 0.21, 7), russetMat);
      ear.position.set(side * 0.16, 0.26, -0.02);
      ear.rotation.z = side * -0.18;
      ear.castShadow = true;
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.036, 0.09, 5), creamMat);
      tuft.position.set(side * 0.18, 0.36, -0.02);
      tuft.rotation.z = side * -0.2;
      head.add(ear, tuft);
    }

    // Cheeky muzzle, nose & buck teeth
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), creamMat);
    muzzle.scale.set(1.15, 0.85, 1.1);
    muzzle.position.set(0, -0.05, 0.22);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 8), noseMat);
    nose.position.set(0, -0.02, 0.33);
    const teeth = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.075, 0.025), toothMat);
    teeth.position.set(0, -0.11, 0.3);
    head.add(muzzle, nose, teeth);
    addEyes(0.1, 0.04, 0.22, 0.044);

    // Creamy belly patch
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 10), creamMat);
    belly.scale.set(0.92, 1.15, 0.65);
    belly.position.set(0, 0.77, 0.14);

    // Big upright S-curved bushy squirrel tail
    const tail = new THREE.Group();
    tail.position.set(0, 0.56, -0.2);
    const tLow = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), russetMat);
    tLow.position.set(0, 0.14, -0.16);
    tLow.castShadow = true;
    const tMid = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 12), russetMat);
    tMid.scale.set(0.9, 1.32, 0.95);
    tMid.position.set(0, 0.44, -0.28);
    tMid.rotation.x = -0.26;
    tMid.castShadow = true;
    const tCurl = new THREE.Mesh(new THREE.SphereGeometry(0.21, 11, 11), creamMat);
    tCurl.scale.set(0.86, 1.05, 0.9);
    tCurl.position.set(0, 0.74, -0.14);
    tCurl.castShadow = true;
    tail.add(tLow, tMid, tCurl);

    bodyRoot.add(belly, tail);
    animTarget.userData.creatureAnim = { creatureType: 'Squirrel', tail, head } satisfies CreatureAnimRefs;
  } else if (creature === 'Badger') {
    const charcoalMat = new THREE.MeshStandardMaterial({ color: '#272C36', roughness: 0.76 });
    const slateFurMat = new THREE.MeshStandardMaterial({ color: '#64748B', roughness: 0.82 });
    const whiteStripeMat = new THREE.MeshStandardMaterial({ color: '#F1F5F9', roughness: 0.68 });
    const noseMat = new THREE.MeshStandardMaterial({ color: '#1E293B', roughness: 0.42 });

    // Iconic badger muzzle + white forehead blaze & cheek stripes
    const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.135, 0.24, 10), whiteStripeMat);
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, -0.04, 0.26);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 8), noseMat);
    nose.position.set(0, -0.03, 0.39);
    const centerBlaze = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.2, 0.38), whiteStripeMat);
    centerBlaze.position.set(0, 0.13, 0.05);
    for (const side of [-1, 1]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.34), charcoalMat);
      band.position.set(side * 0.11, 0.04, 0.09);
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.072, 8, 8), charcoalMat);
      ear.scale.set(1.0, 1.0, 0.52);
      ear.position.set(side * 0.18, 0.2, -0.02);
      const earRim = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), whiteStripeMat);
      earRim.position.set(side * 0.19, 0.23, 0.01);
      head.add(band, ear, earRim);
    }
    head.add(snout, nose, centerBlaze);
    addEyes(0.1, 0.04, 0.23, 0.04);

    // Grizzled back mantle & short sturdy tail
    const mantle = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 10), slateFurMat);
    mantle.scale.set(1.05, 1.1, 0.72);
    mantle.position.set(0, 0.84, -0.14);
    const tail = new THREE.Group();
    tail.position.set(0, 0.56, -0.22);
    const tailStub = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.28, 7), whiteStripeMat);
    tailStub.rotation.x = -1.2;
    tailStub.position.set(0, 0.04, -0.12);
    tail.add(tailStub);

    bodyRoot.add(mantle, tail);
    animTarget.userData.creatureAnim = { creatureType: 'Badger', tail, head } satisfies CreatureAnimRefs;
  } else if (creature === 'Owl') {
    const brownFeather = new THREE.MeshStandardMaterial({ color: '#7C5A40', roughness: 0.78 });
    const darkFeather = new THREE.MeshStandardMaterial({ color: '#4E3626', roughness: 0.8 });
    const creamDisc = new THREE.MeshStandardMaterial({ color: '#F5EAD8', roughness: 0.72 });
    const beakGold = new THREE.MeshStandardMaterial({ color: '#F59E0B', roughness: 0.38 });

    // Heart-like owl facial disc + golden beak + ear-tuft horns
    for (const side of [-1, 1]) {
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.115, 12), creamDisc);
      disc.position.set(side * 0.095, 0.03, 0.232);
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.2, 6), darkFeather);
      tuft.position.set(side * 0.16, 0.27, 0.02);
      tuft.rotation.z = side * -0.35;
      tuft.castShadow = true;
      head.add(disc, tuft);
    }
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.068, 0.18, 6), beakGold);
    beak.rotation.x = Math.PI * 0.65;
    beak.position.set(0, -0.02, 0.28);
    head.add(beak);
    addEyes(0.095, 0.04, 0.245, 0.052);

    // Cream breast feathers & wide owl wings
    const breast = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), creamDisc);
    breast.scale.set(0.95, 1.15, 0.62);
    breast.position.set(0, 0.78, 0.15);

    const makeOwlWing = (side: -1 | 1) => {
      const wPivot = new THREE.Group();
      wPivot.position.set(side * 0.28, 0.96, -0.05);
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.34), brownFeather);
      upper.position.set(side * 0.18, -0.08, -0.04);
      upper.rotation.z = side * -0.42;
      upper.castShadow = true;
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.24), darkFeather);
      tip.position.set(side * 0.34, -0.18, -0.08);
      tip.rotation.z = side * -0.5;
      wPivot.add(upper, tip);
      return wPivot;
    };
    const wingL = makeOwlWing(-1);
    const wingR = makeOwlWing(1);

    const tail = new THREE.Group();
    tail.position.set(0, 0.54, -0.22);
    const tailFan = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.34), darkFeather);
    tailFan.rotation.x = -0.38;
    tailFan.position.z = -0.14;
    tail.add(tailFan);

    bodyRoot.add(breast, wingL, wingR, tail);
    animTarget.userData.creatureAnim = {
      creatureType: 'Owl',
      tail,
      wingL,
      wingR,
      head,
    } satisfies CreatureAnimRefs;
  } else {
    // Vulture: feathered collar ruff, curved yellow-ivory beak, bald coral head, spreadable wings
    const featherDark = new THREE.MeshStandardMaterial({ color: '#2E2832', roughness: 0.78 });
    const featherTip = new THREE.MeshStandardMaterial({ color: '#524957', roughness: 0.75 });
    const ruffMat = new THREE.MeshStandardMaterial({ color: '#EDE7DE', roughness: 0.88 });
    const beakMat = new THREE.MeshStandardMaterial({ color: '#EAB308', roughness: 0.42 });
    const beakTipMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.4 });

    // Neck feather ruff collar
    const ruff = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.095, 8, 14), ruffMat);
    ruff.rotation.x = Math.PI / 2;
    ruff.position.set(0, 1.13, 0.02);
    ruff.castShadow = true;

    // Curved hooked vulture beak
    const beakBase = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.34, 7), beakMat);
    beakBase.rotation.x = Math.PI / 2 + 0.15;
    beakBase.position.set(0, -0.04, 0.32);
    const beakHook = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 6), beakTipMat);
    beakHook.rotation.x = Math.PI * 0.85;
    beakHook.position.set(0, -0.1, 0.47);
    head.add(beakBase, beakHook);
    addEyes(0.115, 0.05, 0.21, 0.045);

    // Feathered wings mounted on shoulders
    const makeWing = (side: -1 | 1) => {
      const wPivot = new THREE.Group();
      wPivot.position.set(side * 0.28, 1.02, -0.08);
      const inner = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.08, 0.42), featherDark);
      inner.position.set(side * 0.26, -0.06, -0.06);
      inner.rotation.z = side * -0.45;
      inner.castShadow = true;
      wPivot.add(inner);
      for (let f = 0; f < 4; f++) {
        const pinion = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 0.12), featherTip);
        pinion.position.set(side * (0.48 + f * 0.04), -0.16 - f * 0.03, -0.16 + f * 0.07);
        pinion.rotation.z = side * -0.52;
        wPivot.add(pinion);
      }
      return wPivot;
    };
    const wingL = makeWing(-1);
    const wingR = makeWing(1);

    // Tail feathers
    const tail = new THREE.Group();
    tail.position.set(0, 0.56, -0.22);
    const fan = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.46), featherDark);
    fan.rotation.x = -0.35;
    fan.position.z = -0.18;
    tail.add(fan);

    bodyRoot.add(ruff, wingL, wingR, tail);
    animTarget.userData.creatureAnim = {
      creatureType: 'Vulture',
      tail,
      wingL,
      wingR,
      head,
    } satisfies CreatureAnimRefs;
  }
}

function defaultPaletteForCreature(creature: CreatureBodyId): {
  tunic: string;
  cloak: string;
  hair: string;
  skin: string;
} {
  switch (creature) {
    case 'Skunk':
      return { tunic: '#1E2028', cloak: '#F8FAFC', hair: '#1A1B22', skin: '#1E2028' };
    case 'Porcupine':
      return { tunic: '#6D442B', cloak: '#D6C3A5', hair: '#3B281E', skin: '#8D5B3C' };
    case 'Mole Rat':
      return { tunic: '#D99B8C', cloak: '#785542', hair: '#A17C6B', skin: '#E8B3A4' };
    case 'Vulture':
      return { tunic: '#38303E', cloak: '#EDE7DE', hair: '#524957', skin: '#E57373' };
    case 'Duckling':
      return { tunic: '#FACC15', cloak: '#FEF08A', hair: '#F59E0B', skin: '#FDE047' };
    case 'Squirrel':
      return { tunic: '#C25E28', cloak: '#F6E5C9', hair: '#9A4319', skin: '#D47338' };
    case 'Badger':
      return { tunic: '#343A46', cloak: '#F1F5F9', hair: '#1E293B', skin: '#272C36' };
    case 'Owl':
      return { tunic: '#7C5A40', cloak: '#F5EAD8', hair: '#4E3626', skin: '#8D6748' };
  }
}

export function buildCreatureMesh(
  creature: CreatureBodyId,
  paletteOverride?: Partial<{ tunic: string; cloak: string; hair: string; skin: string }>
): THREE.Group {
  const base = defaultPaletteForCreature(creature);
  const rig = buildHeroModel(creature, {
    tunic: paletteOverride?.tunic ?? base.tunic,
    cloak: paletteOverride?.cloak ?? base.cloak,
    hair: paletteOverride?.hair ?? base.hair,
    skin: paletteOverride?.skin ?? base.skin,
  });
  // Hide humanoid hero weapons & tools on creature NPCs
  if (rig.sword) rig.sword.visible = false;
  if (rig.shield) rig.shield.visible = false;
  if (rig.axe) rig.axe.visible = false;
  if (rig.fishingPole) rig.fishingPole.visible = false;
  if (rig.torch) rig.torch.visible = false;
  if (rig.heldGeneric) rig.heldGeneric.visible = false;
  rig.group.userData.heroRig = rig;
  return rig.group;
}

export function buildDucklingCompanionMesh(): THREE.Group {
  const mesh = buildCreatureMesh('Duckling');
  mesh.scale.setScalar(0.58);
  return mesh;
}

function buildPropPresetMesh(preset: PropPresetId): THREE.Group {
  const g = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: '#747C8C', roughness: 0.88, flatShading: true });
  const darkStoneMat = new THREE.MeshStandardMaterial({ color: '#4B5260', roughness: 0.9, flatShading: true });
  const oakMat = new THREE.MeshStandardMaterial({ color: '#6E4224', roughness: 0.82 });
  const pineWoodMat = new THREE.MeshStandardMaterial({ color: '#9C6334', roughness: 0.78 });
  const plasterMat = new THREE.MeshStandardMaterial({ color: '#F2E5CE', roughness: 0.86 });
  const roofMat = new THREE.MeshStandardMaterial({ color: '#8C3B2B', roughness: 0.78, flatShading: true });
  const mossRoofMat = new THREE.MeshStandardMaterial({ color: '#4E7A3C', roughness: 0.84, flatShading: true });
  const goldMat = new THREE.MeshStandardMaterial({ color: '#F59E0B', roughness: 0.35, metalness: 0.65 });
  const lanternGlowMat = new THREE.MeshStandardMaterial({
    color: '#FFE699',
    emissive: '#FF9F1C',
    emissiveIntensity: 1.6,
    roughness: 0.2,
  });

  if (preset === 'tavern') {
    // Woodland Acorn & Lantern Tavern
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.45, 5.4, 6, 2, 5), darkStoneMat);
    plinth.position.y = 0.22;
    plinth.receiveShadow = true;
    plinth.castShadow = true;

    const mainHall = new THREE.Mesh(new THREE.BoxGeometry(5.6, 2.75, 4.0, 5, 3, 4), plasterMat);
    mainHall.position.set(0, 1.82, -0.35);
    mainHall.castShadow = true;
    mainHall.receiveShadow = true;

    // Half-timber oak beams
    for (const bx of [-2.75, -0.95, 0.95, 2.75]) {
      const postF = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.8, 0.14), oakMat);
      postF.position.set(bx, 1.82, 1.66);
      const postB = postF.clone();
      postB.position.z = -2.36;
      g.add(postF, postB);
    }
    const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(5.76, 0.2, 4.18), oakMat);
    crossBeam.position.set(0, 2.55, -0.35);

    // Pitched shingle roof
    const roofGeo = new THREE.ConeGeometry(4.45, 2.35, 4);
    roofGeo.rotateY(Math.PI / 4);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.scale.set(1.05, 1.0, 0.78);
    roof.position.set(0, 4.25, -0.35);
    roof.castShadow = true;

    // Stone chimney
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.85, 2.9, 0.85), stoneMat);
    chimney.position.set(2.05, 3.85, -1.25);
    chimney.castShadow = true;
    const chimneyCap = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.18, 1.02), darkStoneMat);
    chimneyCap.position.set(2.05, 5.32, -1.25);

    // Front oak porch & deck
    const porchDeck = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.24, 1.5), pineWoodMat);
    porchDeck.position.set(0, 0.44, 2.25);
    porchDeck.receiveShadow = true;
    const porchRoof = new THREE.Mesh(new THREE.BoxGeometry(5.9, 0.18, 1.7), roofMat);
    porchRoof.position.set(0, 2.24, 2.25);
    porchRoof.rotation.x = 0.2;
    porchRoof.castShadow = true;

    for (const px of [-2.6, -1.1, 1.1, 2.6]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 1.85, 8), oakMat);
      col.position.set(px, 1.32, 2.86);
      col.castShadow = true;
      g.add(col);
    }

    // Arched door + warm glowing windows
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.75, 0.14), oakMat);
    door.position.set(0, 1.32, 1.66);
    for (const wx of [-1.8, 1.8]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.78, 0.14), lanternGlowMat);
      win.position.set(wx, 1.62, 1.66);
      g.add(win);
    }

    // Hanging porch lanterns + barrels + outdoor picnic table
    for (const lx of [-1.1, 1.1]) {
      const lan = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.28, 6), lanternGlowMat);
      lan.position.set(lx, 1.92, 2.86);
      g.add(lan);
    }
    const signBoard = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.56, 0.1), goldMat);
    signBoard.position.set(0, 2.62, 2.95);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.3, 0.68, 10), pineWoodMat);
    barrel.position.set(-2.15, 0.9, 2.2);
    barrel.castShadow = true;
    const tableTop = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.1, 0.85), pineWoodMat);
    tableTop.position.set(2.1, 0.72, 3.6);
    tableTop.castShadow = true;
    const bench = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.34), oakMat);
    bench.position.set(2.1, 0.4, 4.22);

    // Festive colorful bunting garland across porch
    const buntingColors = ['#F59E0B', '#EC4899', '#22C55E', '#38BDF8', '#A855F7'];
    for (let i = 0; i < 9; i++) {
      const bx = -2.4 + i * 0.6;
      const sag = Math.sin((i / 8) * Math.PI) * 0.18;
      const pennant = new THREE.Mesh(
        new THREE.ConeGeometry(0.11, 0.24, 3),
        new THREE.MeshStandardMaterial({ color: buntingColors[i % buntingColors.length], roughness: 0.45 })
      );
      pennant.rotation.x = Math.PI;
      pennant.position.set(bx, 2.08 - sag, 2.96);
      g.add(pennant);
    }

    g.add(
      plinth,
      mainHall,
      crossBeam,
      roof,
      chimney,
      chimneyCap,
      porchDeck,
      porchRoof,
      door,
      signBoard,
      barrel,
      tableTop,
      bench
    );
  } else if (preset === 'cottage') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.05, 3.1), plasterMat);
    base.position.y = 1.02;
    base.castShadow = true;
    const roofGeo = new THREE.ConeGeometry(2.85, 1.75, 4);
    roofGeo.rotateY(Math.PI / 4);
    const roof = new THREE.Mesh(roofGeo, mossRoofMat);
    roof.position.y = 2.8;
    roof.castShadow = true;
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.54, 1.45, 0.54), stoneMat);
    chimney.position.set(0.95, 2.95, -0.7);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.84, 1.32, 0.14), oakMat);
    door.position.set(0, 0.66, 1.56);
    const winL = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.54, 0.14), lanternGlowMat);
    winL.position.set(-0.98, 1.15, 1.56);
    const flowerBox = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.22, 0.28), pineWoodMat);
    flowerBox.position.set(-0.98, 0.72, 1.66);
    g.add(base, roof, chimney, door, winL, flowerBox);
  } else if (preset === 'dock') {
    for (const px of [-1.2, 1.2]) {
      for (const pz of [-2.4, 0, 2.4]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.14, 2.1, 8), oakMat);
        post.position.set(px, 0.55, pz);
        post.castShadow = true;
        g.add(post);
      }
    }
    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.18, 5.6), pineWoodMat);
    deck.position.set(0, 0.82, 0);
    deck.castShadow = true;
    deck.receiveShadow = true;
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.26, 6), lanternGlowMat);
    lantern.position.set(1.2, 1.74, 2.4);
    g.add(deck, lantern);
  } else if (preset === 'campfire') {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), stoneMat);
      st.position.set(Math.cos(a) * 0.72, 0.14, Math.sin(a) * 0.72);
      st.castShadow = true;
      g.add(st);
    }
    for (const rotY of [0.4, -0.5, 1.3]) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 1.1, 7), oakMat);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = rotY;
      log.position.y = 0.16;
      g.add(log);
    }
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.75, 6), lanternGlowMat);
    flame.position.y = 0.5;
    g.add(flame);
  } else if (preset === 'ramp') {
    // Wide drive-over wooden stunt ramp (4.6m wide, 6.2m long, 1.6m peak at +Z)
    const length = 6.2;
    const width = 4.6;
    const height = 1.6;
    const rampGeo = new THREE.BufferGeometry();
    const hw = width * 0.5;
    const hl = length * 0.5;
    // Wedge sloped from y=0 at -hl up to y=height at +hl
    const verts = new Float32Array([
      // Sloped top quad (2 tris)
      -hw, 0, -hl,   hw, 0, -hl,   hw, height, hl,
      -hw, 0, -hl,   hw, height, hl,  -hw, height, hl,
      // Back vertical face (+hl)
      -hw, 0, hl,   -hw, height, hl,   hw, height, hl,
      -hw, 0, hl,    hw, height, hl,   hw, 0, hl,
      // Left side tri
      -hw, 0, -hl,  -hw, height, hl,  -hw, 0, hl,
      // Right side tri
       hw, 0, -hl,   hw, 0, hl,        hw, height, hl,
    ]);
    rampGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    rampGeo.computeVertexNormals();
    const deckMat = new THREE.MeshStandardMaterial({ color: '#B45309', roughness: 0.76, side: THREE.DoubleSide });
    const wedge = new THREE.Mesh(rampGeo, deckMat);
    wedge.castShadow = true;
    wedge.receiveShadow = true;
    const stripeMat = new THREE.MeshStandardMaterial({
      color: '#FACC15',
      emissive: '#D97706',
      emissiveIntensity: 0.35,
      roughness: 0.4,
    });
    const lipBar = new THREE.Mesh(new THREE.BoxGeometry(width + 0.08, 0.14, 0.32), stripeMat);
    lipBar.position.set(0, height - 0.04, hl - 0.16);
    g.add(wedge, lipBar);
  } else if (preset === 'checkpointArch') {
    const colL = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 4.4, 8), oakMat);
    colL.position.set(-3.8, 2.2, 0);
    colL.castShadow = true;
    const colR = colL.clone();
    colR.position.x = 3.8;
    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(8.0, 0.78, 0.24),
      new THREE.MeshStandardMaterial({ color: '#20B46A', emissive: '#059669', emissiveIntensity: 0.25, roughness: 0.5 })
    );
    banner.position.set(0, 4.15, 0);
    banner.castShadow = true;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.22, 0.28), goldMat);
    stripe.position.set(0, 4.15, 0);
    g.add(colL, colR, banner, stripe);
  } else if (preset === 'flightCube') {
    // Glowing Mario-Kart-inspired winged Flight Bonus Cube
    const cubeRoot = new THREE.Group();
    cubeRoot.position.y = 1.45;
    cubeRoot.userData.floatSpin = true;

    const glassBoxMat = new THREE.MeshStandardMaterial({
      color: '#38BDF8',
      emissive: '#0EA5E9',
      emissiveIntensity: 0.9,
      roughness: 0.14,
      metalness: 0.25,
      transparent: true,
      opacity: 0.78,
    });
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.35, 1.35), glassBoxMat);
    crate.rotation.set(Math.PI / 6, Math.PI / 4, 0);
    crate.castShadow = true;

    const frameMat = new THREE.MeshStandardMaterial({
      color: '#FACC15',
      emissive: '#F59E0B',
      emissiveIntensity: 0.55,
      roughness: 0.25,
      metalness: 0.72,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.08, 8, 20), frameMat);
    ring.rotation.x = Math.PI / 2;

    // Wing emblems jutting from cube sides
    for (const sx of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.12, 0.42), frameMat);
      wing.position.set(sx * 1.15, 0.18, 0);
      wing.rotation.z = sx * 0.28;
      cubeRoot.add(wing);
    }

    const coreOrb = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.42, 0),
      new THREE.MeshStandardMaterial({
        color: '#FEF3C7',
        emissive: '#FDE047',
        emissiveIntensity: 1.8,
        roughness: 0.1,
      })
    );
    cubeRoot.add(crate, ring, coreOrb);
    g.add(cubeRoot);
  } else if (preset === 'boostPad') {
    const padBase = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 0.08, 3.4),
      new THREE.MeshStandardMaterial({ color: '#0F172A', roughness: 0.4, metalness: 0.5 })
    );
    padBase.position.y = 0.04;
    padBase.receiveShadow = true;
    const chevMat = new THREE.MeshStandardMaterial({
      color: '#38BDF8',
      emissive: '#0EA5E9',
      emissiveIntensity: 1.6,
      roughness: 0.15,
    });
    for (let i = 0; i < 3; i++) {
      const zOff = -0.95 + i * 0.95;
      const barL = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.24), chevMat);
      barL.position.set(-0.65, 0.06, zOff);
      barL.rotation.y = 0.45;
      const barR = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.24), chevMat);
      barR.position.set(0.65, 0.06, zOff);
      barR.rotation.y = -0.45;
      g.add(barL, barR);
    }
    g.add(padBase);
  } else if (preset === 'roadBarrier') {
    const legMat = new THREE.MeshStandardMaterial({ color: '#1F2937', roughness: 0.65 });
    for (const lx of [-1.05, 1.05]) {
      const legF = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.96, 0.14), legMat);
      legF.position.set(lx, 0.46, 0.18);
      legF.rotation.x = -0.22;
      legF.castShadow = true;
      const legB = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.96, 0.14), legMat);
      legB.position.set(lx, 0.46, -0.18);
      legB.rotation.x = 0.22;
      legB.castShadow = true;
      const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.18, 8), lanternGlowMat);
      beacon.position.set(lx, 1.08, 0);
      g.add(legF, legB, beacon);
    }
    const plankMat = new THREE.MeshStandardMaterial({ color: '#F97316', roughness: 0.55 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: '#F8FAFC', roughness: 0.5 });
    const railTop = new THREE.Mesh(new THREE.BoxGeometry(2.85, 0.28, 0.14), plankMat);
    railTop.position.set(0, 0.82, 0);
    railTop.castShadow = true;
    const railMid = new THREE.Mesh(new THREE.BoxGeometry(2.85, 0.22, 0.14), stripeMat);
    railMid.position.set(0, 0.46, 0);
    railMid.castShadow = true;
    g.add(railTop, railMid);
  } else if (preset === 'craftingBench') {
    // Artisan Woodland Crafting Bench: heavy timber trestle, plank deck, mini cast-iron anvil,
    // glowing alchemy flask, stone mortar, hammer, and unrolled blueprint scroll
    const ironMat = new THREE.MeshStandardMaterial({
      color: '#39414E',
      roughness: 0.42,
      metalness: 0.78,
      flatShading: true,
    });
    const flaskGlowMat = new THREE.MeshStandardMaterial({
      color: '#34D399',
      emissive: '#10B981',
      emissiveIntensity: 1.25,
      roughness: 0.2,
    });
    const scrollMat = new THREE.MeshStandardMaterial({ color: '#F3E4C6', roughness: 0.85 });

    // Four stout timber legs
    for (const lx of [-0.9, 0.9]) {
      for (const lz of [-0.42, 0.42]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.9, 0.16), oakMat);
        leg.position.set(lx, 0.45, lz);
        leg.castShadow = true;
        leg.receiveShadow = true;
        g.add(leg);
      }
    }

    // Lower storage shelf & cross-stretchers
    const lowerShelf = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.08, 0.8), pineWoodMat);
    lowerShelf.position.set(0, 0.28, 0);
    lowerShelf.castShadow = true;
    lowerShelf.receiveShadow = true;

    // Thick plank benchtop
    const benchTop = new THREE.Mesh(new THREE.BoxGeometry(2.16, 0.14, 1.12, 4, 2, 3), pineWoodMat);
    benchTop.position.set(0, 0.96, 0);
    benchTop.castShadow = true;
    benchTop.receiveShadow = true;

    // Front vise & brass vise screw handle
    const viseJaw = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.12), oakMat);
    viseJaw.position.set(-0.72, 0.86, 0.6);
    const viseHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.34, 6), goldMat);
    viseHandle.rotation.z = Math.PI / 2;
    viseHandle.position.set(-0.72, 0.84, 0.68);

    // Back tool rail + hanging lantern
    const railPostL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.85, 0.1), oakMat);
    railPostL.position.set(-0.94, 1.42, -0.46);
    const railPostR = railPostL.clone();
    railPostR.position.x = 0.94;
    const topCrossRail = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.12, 0.09), oakMat);
    topCrossRail.position.set(0, 1.82, -0.46);
    topCrossRail.castShadow = true;

    const benchLantern = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.24, 6), lanternGlowMat);
    benchLantern.position.set(0.86, 1.62, -0.35);

    // Mini forge anvil (left side of benchtop)
    const anvilBase = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.24), ironMat);
    anvilBase.position.set(-0.66, 1.09, -0.05);
    anvilBase.castShadow = true;
    const anvilBody = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.2), ironMat);
    anvilBody.position.set(-0.64, 1.21, -0.05);
    anvilBody.castShadow = true;
    const anvilHorn = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.24, 5), ironMat);
    anvilHorn.rotation.z = -Math.PI / 2;
    anvilHorn.position.set(-0.34, 1.22, -0.05);

    // Crafting hammer resting across the center
    const hammerHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.028, 0.42, 6), oakMat);
    hammerHandle.rotation.z = Math.PI / 2;
    hammerHandle.rotation.y = 0.35;
    hammerHandle.position.set(-0.08, 1.06, 0.25);
    const hammerHead = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.18), ironMat);
    hammerHead.rotation.y = 0.35;
    hammerHead.position.set(0.1, 1.08, 0.18);

    // Blueprint parchment scroll
    const parchment = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.025, 0.36), scrollMat);
    parchment.position.set(0.08, 1.045, -0.14);
    parchment.rotation.y = -0.12;
    const scrollRoll = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 8), scrollMat);
    scrollRoll.rotation.x = Math.PI / 2;
    scrollRoll.rotation.y = -0.12;
    scrollRoll.position.set(-0.15, 1.07, -0.16);

    // Stone mortar + glowing alchemy flask (right side)
    const mortar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.11, 0.18, 8), stoneMat);
    mortar.position.set(0.56, 1.12, 0.2);
    mortar.castShadow = true;
    const flaskBulb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), flaskGlowMat);
    flaskBulb.position.set(0.76, 1.15, -0.12);
    const flaskNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.14, 8), flaskGlowMat);
    flaskNeck.position.set(0.76, 1.3, -0.12);

    g.add(
      lowerShelf,
      benchTop,
      viseJaw,
      viseHandle,
      railPostL,
      railPostR,
      topCrossRail,
      benchLantern,
      anvilBase,
      anvilBody,
      anvilHorn,
      hammerHandle,
      hammerHead,
      parchment,
      scrollRoll,
      mortar,
      flaskBulb,
      flaskNeck
    );
  } else if (preset === 'savePlinth') {
    const plinthSlateMat = new THREE.MeshStandardMaterial({
      color: '#475569',
      roughness: 0.72,
      metalness: 0.14,
      flatShading: true,
    });
    const plinthTrimMat = new THREE.MeshStandardMaterial({
      color: '#94A3B8',
      roughness: 0.45,
      metalness: 0.35,
      flatShading: true,
    });
    const runeGlowMat = new THREE.MeshStandardMaterial({
      color: '#38BDF8',
      emissive: '#0EA5E9',
      emissiveIntensity: 1.55,
      roughness: 0.18,
    });
    const crystalGlowMat = new THREE.MeshStandardMaterial({
      color: '#BAE6FD',
      emissive: '#38BDF8',
      emissiveIntensity: 1.9,
      roughness: 0.12,
      metalness: 0.2,
      flatShading: true,
    });
    const auraMat = new THREE.MeshBasicMaterial({
      color: '#38BDF8',
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const auraDisc = new THREE.Mesh(new THREE.RingGeometry(0.65, 1.38, 28), auraMat);
    auraDisc.rotation.x = -Math.PI / 2;
    auraDisc.position.y = 0.03;

    const baseStep = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.04, 0.22, 8), plinthSlateMat);
    baseStep.position.y = 0.11;
    baseStep.castShadow = true;
    baseStep.receiveShadow = true;

    const midTier = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.78, 0.24, 6), plinthTrimMat);
    midTier.position.y = 0.34;
    midTier.castShadow = true;
    midTier.receiveShadow = true;

    const runeRing = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.055, 8, 24), runeGlowMat);
    runeRing.rotation.x = Math.PI / 2;
    runeRing.position.y = 0.25;

    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.92, 6), plinthSlateMat);
    pillar.position.y = 0.9;
    pillar.castShadow = true;

    const crownCap = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.36, 0.18, 6), plinthTrimMat);
    crownCap.position.y = 1.42;
    crownCap.castShadow = true;

    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), crystalGlowMat);
    crystal.scale.set(0.82, 1.48, 0.82);
    crystal.position.y = 2.02;
    crystal.userData.floatSpin = true;

    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.038, 8, 24), runeGlowMat);
    halo.position.y = 1.98;
    halo.rotation.set(1.15, 0.3, 0);
    halo.userData.floatSpin = true;

    g.add(auraDisc, baseStep, midTier, runeRing, pillar, crownCap, crystal, halo);
  } else {
    // signpost
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.05, 10, 4), oakMat);
    post.position.y = 1.02;
    post.castShadow = true;
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.34, 0.08, 6, 3, 2), pineWoodMat);
    b1.position.set(0.28, 1.72, 0.04);
    b1.rotation.y = 0.18;
    b1.castShadow = true;
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.32, 0.08, 6, 3, 2), pineWoodMat);
    b2.position.set(-0.24, 1.32, -0.04);
    b2.rotation.y = -0.22;
    b2.castShadow = true;
    g.add(post, b1, b2);
  }

  return g;
}

export function buildHeroModel(
  heroBody: string,
  colors: { tunic: string; cloak: string; hair: string; skin: string }
): HeroRig {
  const group = new THREE.Group();
  const creatureType = resolveCreatureType(heroBody);

  const skinMat = new THREE.MeshStandardMaterial({ color: colors.skin, roughness: 0.65 });
  const tunicMat = new THREE.MeshStandardMaterial({
    color: colors.tunic,
    roughness: 0.55,
    metalness: heroBody === 'Knight' || heroBody === 'Robot' ? 0.55 : 0.08,
  });
  const cloakMat = new THREE.MeshStandardMaterial({ color: colors.cloak, roughness: 0.72 });
  const hairMat = new THREE.MeshStandardMaterial({ color: colors.hair, roughness: 0.75 });
  const bootMat = new THREE.MeshStandardMaterial({ color: '#3B2B23', roughness: 0.8 });
  const goldMat = new THREE.MeshStandardMaterial({ color: '#F2C230', roughness: 0.28, metalness: 0.85 });
  const steelMat = new THREE.MeshStandardMaterial({ color: '#D0D7E2', roughness: 0.25, metalness: 0.88 });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#1F1F24', roughness: 0.4 });

  // Contact shadow disc
  const shadowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 20),
    new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.28, depthWrite: false })
  );
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.02;
  group.add(shadowDisc);

  // Body pivot around chest/hip center (0, 0.85, 0) so swimming leans cleanly without tilting ground shadow
  const bodyPivot = new THREE.Group();
  bodyPivot.name = 'Hips';
  bodyPivot.position.set(0, 0.85, 0);
  const bodyRoot = new THREE.Group();
  bodyRoot.position.set(0, -0.85, 0);
  bodyPivot.add(bodyRoot);
  group.add(bodyPivot);

  // Articulated waist spine pivot at y=0.56 so torso/arms/head bend together naturally
  const spinePivot = new THREE.Group();
  spinePivot.name = 'Spine';
  spinePivot.position.set(0, 0.56, 0);
  const upperBodyRoot = new THREE.Group();
  upperBodyRoot.position.set(0, -0.56, 0);
  spinePivot.add(upperBodyRoot);
  bodyRoot.add(spinePivot);

  // Legs
  const makeLeg = (x: number, name: string) => {
    const legPivot = new THREE.Group();
    legPivot.name = name;
    legPivot.position.set(x, 0.52, 0);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.24, 6, 10), darkMat);
    thigh.position.y = -0.2;
    thigh.castShadow = true;
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.3), bootMat);
    boot.position.set(0, -0.44, 0.04);
    boot.castShadow = true;
    legPivot.add(thigh, boot);
    bodyRoot.add(legPivot);
    return legPivot;
  };
  const legL = makeLeg(0.15, 'LeftUpperLeg');
  const legR = makeLeg(-0.15, 'RightUpperLeg');

  // Torso
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 0.58, 12), tunicMat);
  torso.position.y = 0.82;
  torso.castShadow = true;
  upperBodyRoot.add(torso);

  // Belt
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.245, 0.09, 12), bootMat);
  belt.position.y = 0.62;
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.06), goldMat);
  buckle.position.set(0, 0.62, 0.23);
  upperBodyRoot.add(belt, buckle);

  // Cloak / backpack
  if (heroBody === 'Adventurer' || heroBody === 'Wizard' || heroBody === 'Knight') {
    const cape = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.56, 0.07), cloakMat);
    cape.position.set(0, 0.8, -0.23);
    cape.rotation.x = 0.14;
    cape.castShadow = true;
    upperBodyRoot.add(cape);
  } else if (heroBody === 'Explorer') {
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.42, 0.22), bootMat);
    pack.position.set(0, 0.86, -0.26);
    pack.castShadow = true;
    upperBodyRoot.add(pack);
  }

  // Arms with articulated elbow joints (+X is anatomical Left, -X is anatomical Right when facing +Z)
  const makeArm = (x: number, upperName: string, lowerName: string) => {
    const pivot = new THREE.Group();
    pivot.name = upperName;
    pivot.position.set(x, 1.04, 0);
    const upperSleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.11, 6, 10), tunicMat);
    upperSleeve.position.y = -0.095;
    upperSleeve.castShadow = true;

    const forearm = new THREE.Group();
    forearm.name = lowerName;
    forearm.position.set(0, -0.19, 0);
    const lowerSleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.078, 0.1, 6, 10), tunicMat);
    lowerSleeve.position.y = -0.09;
    lowerSleeve.castShadow = true;
    const hand = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 10, 10),
      heroBody === 'Robot' ? steelMat : skinMat
    );
    hand.position.y = -0.18;
    const handGrip = new THREE.Object3D();
    handGrip.position.set(0, -0.18, 0.02);
    forearm.add(lowerSleeve, hand, handGrip);
    pivot.add(upperSleeve, forearm);
    pivot.userData.forearm = forearm;
    upperBodyRoot.add(pivot);
    return { pivot, forearm, handGrip };
  };
  const { pivot: armL, forearm: forearmL, handGrip: handGripL } = makeArm(0.34, 'LeftUpperArm', 'LeftLowerArm');
  const { pivot: armR, forearm: forearmR, handGrip: handGripR } = makeArm(-0.34, 'RightUpperArm', 'RightLowerArm');

  // Sword on right forearm
  const sword = new THREE.Group();
  sword.position.set(0, -0.19, 0.06);
  const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 8), bootMat);
  hilt.rotation.x = Math.PI / 2;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.05), goldMat);
  guard.position.z = 0.08;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.54), steelMat);
  blade.position.z = 0.36;
  blade.castShadow = true;
  sword.add(hilt, guard, blade);
  forearmR.add(sword);

  // Woodcutter's Axe on right forearm (hidden unless holding an axe)
  const axe = new THREE.Group();
  axe.position.set(0, -0.19, 0.08);
  axe.visible = false;
  const axeWoodMat = new THREE.MeshStandardMaterial({ color: '#8F5A32', roughness: 0.82, flatShading: true });
  const axeSteelMat = new THREE.MeshStandardMaterial({ color: '#BCC7D6', roughness: 0.3, metalness: 0.82, flatShading: true });
  const axeEdgeMat = new THREE.MeshStandardMaterial({ color: '#EEF4FA', roughness: 0.18, metalness: 0.92, flatShading: true });
  const axeHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.036, 0.84, 6), axeWoodMat);
  axeHandle.rotation.x = Math.PI / 2;
  axeHandle.position.z = 0.3;
  axeHandle.castShadow = true;
  const axeCollar = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.14), axeSteelMat);
  axeCollar.position.set(0, 0.02, 0.62);
  const axeHead = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.22), axeSteelMat);
  axeHead.position.set(0, -0.09, 0.65);
  axeHead.castShadow = true;
  const axeBevel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.29, 4), axeEdgeMat);
  axeBevel.position.set(0, -0.21, 0.66);
  axeBevel.rotation.x = Math.PI / 2;
  axe.add(axeHandle, axeCollar, axeHead, axeBevel);
  forearmR.add(axe);

  // Bamboo Fishing Pole on right forearm (with exact tip anchor for the 3D fishing line)
  const fishingPole = new THREE.Group();
  fishingPole.position.set(0, -0.19, 0.08);
  fishingPole.visible = false;
  const bambooMat = new THREE.MeshStandardMaterial({ color: '#C99B4E', roughness: 0.68, flatShading: true });
  const rodCorkMat = new THREE.MeshStandardMaterial({ color: '#7D4E2A', roughness: 0.85 });
  const rodGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 0.28, 6), rodCorkMat);
  rodGrip.rotation.x = Math.PI / 2;
  rodGrip.position.z = 0.08;
  const rodLower = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.028, 0.95, 6), bambooMat);
  rodLower.rotation.x = Math.PI / 2;
  rodLower.position.z = 0.66;
  rodLower.castShadow = true;
  const rodUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.018, 0.92, 5), bambooMat);
  rodUpper.rotation.x = Math.PI / 2 + 0.09;
  rodUpper.position.set(0, 0.04, 1.54);
  rodUpper.castShadow = true;
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.045, 10), goldMat);
  reel.rotation.z = Math.PI / 2;
  reel.position.set(0.04, -0.05, 0.26);
  const fishingRodTip = new THREE.Object3D();
  fishingRodTip.position.set(0, 0.08, 2.0);
  fishingPole.add(rodGrip, rodLower, rodUpper, reel, fishingRodTip);
  forearmR.add(fishingPole);

  // Pine Torch on right forearm (casts warm light inside caves!)
  const torch = new THREE.Group();
  torch.position.set(0, -0.19, 0.08);
  torch.visible = false;
  const torchStick = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.025, 0.62, 6), axeWoodMat);
  torchStick.rotation.x = Math.PI / 2 - 0.35;
  torchStick.position.set(0, 0.08, 0.22);
  const torchFlame = new THREE.Mesh(
    new THREE.ConeGeometry(0.095, 0.24, 6),
    new THREE.MeshStandardMaterial({ color: '#FFBA49', emissive: '#FF6B00', emissiveIntensity: 2.0, roughness: 0.2, flatShading: true })
  );
  torchFlame.position.set(0, 0.22, 0.44);
  const torchLight = new THREE.PointLight('#FF9E44', 5.2, 14, 1.6);
  torchLight.position.set(0, 0.26, 0.48);
  torch.userData.torchLight = torchLight;
  torch.add(torchStick, torchFlame, torchLight);
  forearmR.add(torch);

  // Generic held parcel/orb for misc held items
  const heldGeneric = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.11, 0),
    new THREE.MeshStandardMaterial({ color: '#F59E0B', roughness: 0.45, flatShading: true })
  );
  heldGeneric.position.set(0, -0.21, 0.14);
  heldGeneric.visible = false;
  forearmR.add(heldGeneric);

  // Sculpted Off-Hand Shield on left forearm (tinted by equipped offhand shield item)
  const shield = new THREE.Group();
  shield.position.set(0.11, -0.06, 0.06);
  shield.rotation.set(0.04, -0.22, 0);
  const shieldFaceMat = new THREE.MeshStandardMaterial({ color: '#B47634', roughness: 0.62, flatShading: true });
  const shieldRimMat = new THREE.MeshStandardMaterial({ color: '#94A3B8', roughness: 0.35, metalness: 0.52 });
  const shieldBoard = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.22, 0.05, 8), shieldFaceMat);
  shieldBoard.rotation.z = Math.PI / 2;
  shieldBoard.scale.set(1.16, 1, 0.92);
  shieldBoard.castShadow = true;
  const shieldRim = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.025, 6, 12), shieldRimMat);
  shieldRim.rotation.y = Math.PI / 2;
  shieldRim.scale.set(0.92, 1.12, 1);
  const shieldBoss = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), shieldRimMat);
  shieldBoss.position.set(0.032, 0, 0);
  shieldBoss.scale.set(0.55, 1, 1);
  shield.userData.tintMeshes = [shieldBoard];
  shield.add(shieldBoard, shieldRim, shieldBoss);
  forearmL.add(shield);

  // Wearable Body Cloak (visible when equipping a wearable body cloak item)
  const wearBodyCloak = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.66, 0.08),
    new THREE.MeshStandardMaterial({ color: '#256F3E', roughness: 0.78, flatShading: true })
  );
  wearBodyCloak.position.set(0, 0.76, -0.25);
  wearBodyCloak.rotation.x = 0.16;
  wearBodyCloak.castShadow = true;
  wearBodyCloak.visible = false;
  bodyRoot.add(wearBodyCloak);

  // Wearable Chest Amulet (visible when equipping an accessory item)
  const wearAccessoryAmulet = new THREE.Group();
  wearAccessoryAmulet.position.set(0, 0.94, 0.25);
  wearAccessoryAmulet.visible = false;
  const amuletRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.08, 0.022, 6, 10),
    new THREE.MeshStandardMaterial({ color: '#E7E5E4', roughness: 0.7, flatShading: true })
  );
  const amuletGem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.055, 0),
    new THREE.MeshStandardMaterial({ color: '#2DD4BF', emissive: '#14B8A6', emissiveIntensity: 1.2, roughness: 0.2 })
  );
  amuletGem.position.z = 0.015;
  wearAccessoryAmulet.userData.tintMeshes = [amuletGem];
  wearAccessoryAmulet.add(amuletRing, amuletGem);
  upperBodyRoot.add(wearAccessoryAmulet);

  // Head
  const head = new THREE.Group();
  head.name = 'Head';
  head.position.set(0, 1.36, 0);
  const cranium = new THREE.Mesh(
    heroBody === 'Robot' ? new THREE.BoxGeometry(0.42, 0.38, 0.4) : new THREE.SphereGeometry(0.25, 14, 14),
    heroBody === 'Robot' ? steelMat : skinMat
  );
  cranium.castShadow = true;
  head.add(cranium);

  // Eyes
  if (heroBody === 'Robot') {
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.11, 0.06),
      new THREE.MeshStandardMaterial({ color: '#3AA0FF', emissive: '#3AA0FF', emissiveIntensity: 0.9, roughness: 0.2 })
    );
    visor.position.set(0, 0.03, 0.2);
    head.add(visor);
  } else {
    const eyeMat = new THREE.MeshStandardMaterial({ color: '#1C1C1E', roughness: 0.3 });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 8), eyeMat);
    eyeL.position.set(-0.08, 0.03, 0.22);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.08;
    head.add(eyeL, eyeR);
  }

  // Archetype headgear
  if (heroBody === 'Wizard') {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.44, 0.05, 16), tunicMat);
    brim.position.y = 0.18;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.56, 14), tunicMat);
    cone.position.y = 0.44;
    cone.rotation.x = -0.14;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.25, 0.06, 14), goldMat);
    band.position.y = 0.22;
    head.add(brim, cone, band);
  } else if (heroBody === 'Knight') {
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.65), steelMat);
    helm.position.y = 0.04;
    const plume = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.32), cloakMat);
    plume.position.set(0, 0.3, -0.04);
    head.add(helm, plume);
  } else if (heroBody === 'Ninja') {
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.265, 14, 14), darkMat);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.08, 14), cloakMat);
    band.position.y = 0.12;
    head.add(hood, band);
  } else if (heroBody === 'Explorer') {
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.36, 0.12, 14), new THREE.MeshStandardMaterial({ color: '#D4A86A', roughness: 0.7 }));
    hat.position.y = 0.2;
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.255, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
    head.add(hair, hat);
  } else if (heroBody === 'Adventurer') {
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), hairMat);
    hair.position.y = 0.03;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.23, 0.38, 12), tunicMat);
    cap.position.set(0, 0.28, -0.06);
    cap.rotation.x = -0.35;
    head.add(hair, cap);
  }

  // Wearable Headgear overlays (toggled when equipping wearables from Inventory)
  const wearHeadHat = new THREE.Group();
  wearHeadHat.position.set(0, 0.24, 0);
  wearHeadHat.visible = false;
  const fHatMat = new THREE.MeshStandardMaterial({ color: '#9A5B2F', roughness: 0.76, flatShading: true });
  const fBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.05, 8), fHatMat);
  const fCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 0.24, 8), fHatMat);
  fCrown.position.y = 0.13;
  const fBand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.245, 0.255, 0.055, 8),
    new THREE.MeshStandardMaterial({ color: '#2F855A', roughness: 0.65 })
  );
  fBand.position.y = 0.05;
  const fFeather = new THREE.Mesh(
    new THREE.ConeGeometry(0.045, 0.22, 4),
    new THREE.MeshStandardMaterial({ color: '#F59E0B', roughness: 0.55 })
  );
  fFeather.position.set(0.22, 0.18, 0.02);
  fFeather.rotation.z = -0.35;
  wearHeadHat.userData.tintMeshes = [fBrim, fCrown];
  wearHeadHat.add(fBrim, fCrown, fBand, fFeather);
  head.add(wearHeadHat);

  const wearHeadCrown = new THREE.Group();
  wearHeadCrown.position.set(0, 0.27, 0);
  wearHeadCrown.visible = false;
  const crownBase = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.2, 0.14, 7), goldMat);
  wearHeadCrown.add(crownBase);
  const crownTintMeshes: THREE.Mesh[] = [crownBase];
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2;
    const pt = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.14, 4), goldMat);
    pt.position.set(Math.cos(ang) * 0.19, 0.11, Math.sin(ang) * 0.19);
    wearHeadCrown.add(pt);
    crownTintMeshes.push(pt);
  }
  wearHeadCrown.userData.tintMeshes = crownTintMeshes;
  head.add(wearHeadCrown);

  if (creatureType) {
    attachCreatureParts(creatureType, upperBodyRoot, head, armL, armR, group);
    const cAnim = group.userData.creatureAnim as CreatureAnimRefs | undefined;
    if (cAnim?.tail) cAnim.tail.name = 'Tail';
    if (cAnim?.wingL) cAnim.wingL.name = 'LeftWing';
    if (cAnim?.wingR) cAnim.wingR.name = 'RightWing';
  }

  upperBodyRoot.add(head);
  const heroRigOut: HeroRig = {
    group,
    bodyPivot,
    spinePivot,
    shadowDisc,
    head,
    torso,
    armL,
    armR,
    forearmL,
    forearmR,
    handGripL,
    handGripR,
    legL,
    legR,
    sword,
    axe,
    fishingPole,
    fishingRodTip,
    torch,
    heldGeneric,
    shield,
    wearHeadHat,
    wearHeadCrown,
    wearBodyCloak,
    wearAccessoryAmulet,
  };
  group.userData.heroRig = heroRigOut;
  return heroRigOut;
}

/**
 * Builds an articulated Townsperson NPC rig (classic scarf, brimmed cap, robe/tunic silhouette)
 * with full shoulder, elbow, waist, head, and foot joints so NPCs can wave, talk, emote, and animate cleanly.
 */
export function buildProceduralNpcRig(styleTint?: string): HeroRig {
  const group = new THREE.Group();
  group.name = 'ProceduralNpcRoot';

  const robeColor = styleTint || '#3AA0FF';
  const robeMat = new THREE.MeshStandardMaterial({ color: robeColor, roughness: 0.65 });
  const skinMat = new THREE.MeshStandardMaterial({ color: '#F3C7A4', roughness: 0.65 });
  const hatMat = new THREE.MeshStandardMaterial({ color: '#FF9F1C', roughness: 0.6 });
  const bootMat = new THREE.MeshStandardMaterial({ color: '#3E2B22', roughness: 0.8 });

  const shadowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.45, 20),
    new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.25, depthWrite: false })
  );
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.02;
  group.add(shadowDisc);

  const bodyPivot = new THREE.Group();
  bodyPivot.name = 'Hips';
  bodyPivot.position.set(0, 0.72, 0);
  const bodyRoot = new THREE.Group();
  bodyRoot.position.set(0, -0.72, 0);
  bodyPivot.add(bodyRoot);
  group.add(bodyPivot);

  const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.66, 12), robeMat);
  skirt.position.y = 0.36;
  skirt.castShadow = true;
  bodyRoot.add(skirt);

  const makeFoot = (x: number, name: string) => {
    const legPivot = new THREE.Group();
    legPivot.name = name;
    legPivot.position.set(x, 0.32, 0);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.11, 0.24), bootMat);
    shoe.position.set(0, -0.26, 0.05);
    shoe.castShadow = true;
    legPivot.add(shoe);
    bodyRoot.add(legPivot);
    return legPivot;
  };
  const legL = makeFoot(0.12, 'LeftUpperLeg');
  const legR = makeFoot(-0.12, 'RightUpperLeg');

  const spinePivot = new THREE.Group();
  spinePivot.name = 'Spine';
  spinePivot.position.set(0, 0.62, 0);
  const upperBody = new THREE.Group();
  upperBody.position.set(0, -0.62, 0);
  spinePivot.add(upperBody);
  bodyRoot.add(spinePivot);

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.45, 12), robeMat);
  torso.position.y = 0.84;
  torso.castShadow = true;
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 8, 16), hatMat);
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 1.07;
  upperBody.add(torso, scarf);

  const makeArm = (x: number, upperName: string, lowerName: string) => {
    const pivot = new THREE.Group();
    pivot.name = upperName;
    pivot.position.set(x, 0.99, 0);
    const upperSleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.072, 0.1, 6, 8), robeMat);
    upperSleeve.position.y = -0.09;
    upperSleeve.castShadow = true;

    const forearm = new THREE.Group();
    forearm.name = lowerName;
    forearm.position.set(0, -0.17, 0);
    const lowerSleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.09, 6, 8), robeMat);
    lowerSleeve.position.y = -0.08;
    lowerSleeve.castShadow = true;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), skinMat);
    hand.position.y = -0.16;
    const handGrip = new THREE.Object3D();
    handGrip.position.set(0, -0.16, 0.02);
    forearm.add(lowerSleeve, hand, handGrip);
    pivot.add(upperSleeve, forearm);
    upperBody.add(pivot);
    return { pivot, forearm, handGrip };
  };
  const { pivot: armL, forearm: forearmL, handGrip: handGripL } = makeArm(0.29, 'LeftUpperArm', 'LeftLowerArm');
  const { pivot: armR, forearm: forearmR, handGrip: handGripR } = makeArm(-0.29, 'RightUpperArm', 'RightLowerArm');

  const head = new THREE.Group();
  head.name = 'Head';
  head.position.set(0, 1.28, 0);
  const headSphere = new THREE.Mesh(new THREE.SphereGeometry(0.23, 14, 14), skinMat);
  headSphere.castShadow = true;
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#1C1C1E', roughness: 0.3 });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), eyeMat);
  eyeL.position.set(-0.075, 0.02, 0.2);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.075;
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.32, 0.18, 12), hatMat);
  hat.position.y = 0.2;
  hat.castShadow = true;
  head.add(headSphere, eyeL, eyeR, hat);
  upperBody.add(head);

  const npcRig: HeroRig = {
    group,
    bodyPivot,
    spinePivot,
    shadowDisc,
    head,
    torso,
    armL,
    armR,
    forearmL,
    forearmR,
    handGripL,
    handGripR,
    legL,
    legR,
  };
  group.userData.heroRig = npcRig;
  group.userData.npcRig = npcRig;
  return npcRig;
}

/**
 * Builds an articulated procedural Baddie model (Ground Fighter, Winged Flyer, or Boss Warlord)
 * with canonical bone/pivot names so it can be posed & keyframe-animated in Motion Studio and Play Mode.
 */
export function buildProceduralBaddieModel(
  variant: 'ground' | 'flyer' | 'boss' = 'ground',
  styleTint?: string
): { group: THREE.Group; rig: BaddieRig } {
  const group = new THREE.Group();
  group.name = `ProceduralBaddie_${variant}`;
  const isBoss = variant === 'boss';
  const isFlyer = variant === 'flyer';

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(isBoss ? 0.9 : 0.55, 18),
    new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.25, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);

  const bodyColor = styleTint || (isBoss ? '#9B2242' : isFlyer ? '#524175' : '#D9434E');
  const armorColor = isBoss ? '#F2C230' : '#32323D';
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.55, flatShading: true });
  const darkMat = new THREE.MeshStandardMaterial({ color: armorColor, roughness: 0.42, metalness: 0.45, flatShading: true });
  const bladeMat = new THREE.MeshStandardMaterial({ color: '#D6DEE8', roughness: 0.25, metalness: 0.85, flatShading: true });

  const slashGeo = new THREE.RingGeometry(0.55, 1.32, 16, 1, -0.95, 1.9);
  slashGeo.rotateX(-Math.PI / 2);
  const slashMat = new THREE.MeshBasicMaterial({
    color: '#FF5E3A',
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const slashArc = new THREE.Mesh(slashGeo, slashMat);
  slashArc.visible = false;

  if (isFlyer) {
    const bodyPivot = new THREE.Group();
    bodyPivot.name = 'Hips';
    bodyPivot.position.y = 1.25;

    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.36, 1), bodyMat);
    core.castShadow = true;

    const wingGeo = new THREE.BoxGeometry(0.75, 0.06, 0.36);
    const wingL = new THREE.Group();
    wingL.name = 'LeftWing';
    wingL.position.set(-0.26, 0.07, 0);
    const wingLMesh = new THREE.Mesh(wingGeo, darkMat);
    wingLMesh.position.x = -0.34;
    wingLMesh.castShadow = true;
    wingL.add(wingLMesh);

    const wingR = new THREE.Group();
    wingR.name = 'RightWing';
    wingR.position.set(0.26, 0.07, 0);
    const wingRMesh = new THREE.Mesh(wingGeo, darkMat);
    wingRMesh.position.x = 0.34;
    wingRMesh.castShadow = true;
    wingR.add(wingRMesh);

    const eyeMat = new THREE.MeshStandardMaterial({ color: '#FFE066', emissive: '#FF9F1C', emissiveIntensity: 0.8 });
    const eyeL = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), eyeMat);
    eyeL.position.set(-0.13, 0.05, 0.31);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.13;

    slashArc.position.set(0, -0.08, 0.45);
    bodyPivot.add(core, wingL, wingR, eyeL, eyeR, slashArc);
    group.add(bodyPivot);

    const rig: BaddieRig = {
      isFlyer: true,
      bodyPivot,
      wingL,
      wingR,
      slashArc,
      slashMat,
      flashMaterials: [bodyMat, darkMat],
    };
    group.userData.baddieRig = rig;
    return { group, rig };
  }

  const scale = isBoss ? 1.45 : 1.0;
  const bodyPivot = new THREE.Group();
  bodyPivot.name = 'Hips';
  bodyPivot.scale.setScalar(scale);

  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.42, 7), darkMat);
  legs.position.y = 0.21;
  legs.castShadow = true;

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.56, 0.44), bodyMat);
  torso.name = 'Spine';
  torso.position.y = 0.7;
  torso.castShadow = true;

  const headGroup = new THREE.Group();
  headGroup.name = 'Head';
  headGroup.position.set(0, 1.18, 0);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.4), bodyMat);
  head.castShadow = true;
  const brow = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.1, 0.44), darkMat);
  brow.position.y = 0.16;
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#FFF', emissive: '#FF4D4D', emissiveIntensity: 0.7 });
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.04), eyeMat);
  eyeL.position.set(-0.1, 0, 0.2);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.1;
  headGroup.add(head, brow, eyeL, eyeR);

  if (isBoss) {
    const crown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.18, 0.18, 6),
      new THREE.MeshStandardMaterial({ color: '#F2C230', metalness: 0.85, roughness: 0.25, flatShading: true })
    );
    crown.position.y = 0.3;
    headGroup.add(crown);
  }

  const armL = new THREE.Group();
  armL.name = 'LeftUpperArm';
  armL.position.set(-0.35, 0.88, 0);
  const armLMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.38, 0.15), bodyMat);
  armLMesh.position.y = -0.16;
  armLMesh.castShadow = true;
  const bracer = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.22), darkMat);
  bracer.position.set(-0.02, -0.28, 0.04);
  armL.add(armLMesh, bracer);

  const armR = new THREE.Group();
  armR.name = 'RightUpperArm';
  armR.position.set(0.35, 0.9, 0);
  const armRMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.38, 0.15), bodyMat);
  armRMesh.position.y = -0.16;
  armRMesh.castShadow = true;

  const weapon = new THREE.Group();
  weapon.position.set(0.04, -0.32, 0.06);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 1.38, 6), darkMat);
  shaft.position.set(0, 0.26, 0.12);
  shaft.rotation.x = 0.32;
  shaft.castShadow = true;
  const spearTip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.36, 5), bladeMat);
  spearTip.position.set(0, 0.96, 0.35);
  spearTip.rotation.x = 0.32;
  spearTip.castShadow = true;
  weapon.add(shaft, spearTip);
  armR.add(armRMesh, weapon);

  slashArc.position.set(0, 0.88, 0.32);
  bodyPivot.add(legs, torso, headGroup, armL, armR, slashArc);
  group.add(bodyPivot);

  const rig: BaddieRig = {
    isFlyer: false,
    bodyPivot,
    torso,
    armR,
    armL,
    head: headGroup,
    slashArc,
    slashMat,
    flashMaterials: [bodyMat, darkMat],
  };
  group.userData.baddieRig = rig;
  return { group, rig };
}

export function buildPickupItemMesh(meshKind: PickupMeshKind, colorHex: string): THREE.Group {
  const holder = new THREE.Group();
  holder.position.y = 0.62;
  holder.userData.floatSpin = true;

  const accentMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.45,
    metalness: 0.12,
    flatShading: true,
  });
  const woodMat = new THREE.MeshStandardMaterial({ color: '#8F5A32', roughness: 0.82, flatShading: true });
  const steelMat = new THREE.MeshStandardMaterial({ color: '#CBD5E1', roughness: 0.25, metalness: 0.85, flatShading: true });
  const goldMat = new THREE.MeshStandardMaterial({ color: '#FACC15', roughness: 0.25, metalness: 0.85, flatShading: true });

  switch (meshKind) {
    case 'axe': {
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.05, 6), woodMat);
      handle.castShadow = true;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.36, 0.28), steelMat);
      head.position.set(0, 0.32, 0.12);
      head.castShadow = true;
      const edge = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.37, 4), goldMat);
      edge.position.set(0, 0.32, 0.25);
      holder.rotation.z = -0.35;
      holder.add(handle, head, edge);
      break;
    }
    case 'fishingPole': {
      const bambooMat = new THREE.MeshStandardMaterial({ color: '#CFA052', roughness: 0.68, flatShading: true });
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.04, 1.55, 6), bambooMat);
      rod.rotation.z = -0.52;
      rod.position.y = 0.2;
      rod.castShadow = true;
      const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 8), goldMat);
      reel.rotation.x = Math.PI / 2;
      reel.position.set(-0.2, -0.15, 0.05);
      const bobberRed = new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 8, 6),
        new THREE.MeshStandardMaterial({ color: '#EF4444', roughness: 0.35 })
      );
      bobberRed.position.set(0.45, 0.28, 0);
      const bobberWhite = new THREE.Mesh(
        new THREE.SphereGeometry(0.072, 8, 6),
        new THREE.MeshStandardMaterial({ color: '#F8FAFC', roughness: 0.35 })
      );
      bobberWhite.position.set(0.45, 0.21, 0);
      holder.add(rod, reel, bobberRed, bobberWhite);
      break;
    }
    case 'woodLog': {
      holder.position.y = 0.24;
      holder.userData.floatSpin = false;
      const atlas = getTerrainTextureAtlas();
      const barkMat = new THREE.MeshStandardMaterial({
        color: '#FFFFFF',
        map: atlas.oakBark,
        bumpMap: atlas.oakBarkBump,
        bumpScale: 0.12,
        roughness: 0.9,
      });
      const endMat = new THREE.MeshStandardMaterial({
        color: '#FFFFFF',
        map: atlas.woodRings,
        roughness: 0.82,
      });
      const logGeo = new THREE.CylinderGeometry(0.16, 0.17, 1.05, 12);
      logGeo.rotateZ(Math.PI / 2);
      const log1 = new THREE.Mesh(logGeo, [barkMat, endMat, endMat]);
      log1.position.set(0, 0, -0.12);
      log1.rotation.y = 0.22;
      log1.castShadow = true;
      const log2 = new THREE.Mesh(logGeo, [barkMat, endMat, endMat]);
      log2.position.set(0.05, 0.02, 0.16);
      log2.rotation.y = -0.18;
      log2.castShadow = true;
      holder.add(log1, log2);
      break;
    }
    case 'fish': {
      const fishBody = buildLeapingFishMesh(colorHex);
      fishBody.scale.setScalar(1.1);
      holder.add(fishBody);
      break;
    }
    case 'berries': {
      const leafMat = new THREE.MeshStandardMaterial({ color: '#3F9B42', roughness: 0.72, flatShading: true });
      const berryMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.35, flatShading: true });
      for (const [lx, lz, ry] of [
        [-0.14, 0, 0.4],
        [0.14, 0.05, -0.5],
        [0, -0.14, 1.2],
      ]) {
        const lf = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.34, 4), leafMat);
        lf.position.set(lx, -0.05, lz);
        lf.rotation.set(0.95, ry, 0);
        holder.add(lf);
      }
      for (const [bx, by, bz] of [
        [0, 0.1, 0],
        [-0.12, 0.04, 0.08],
        [0.12, 0.05, 0.06],
        [0.03, 0.16, -0.08],
        [-0.07, 0.15, -0.04],
      ]) {
        const b = new THREE.Mesh(new THREE.DodecahedronGeometry(0.095, 0), berryMat);
        b.position.set(bx, by, bz);
        b.castShadow = true;
        holder.add(b);
      }
      break;
    }
    case 'herbs': {
      const herbMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.65, flatShading: true });
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2;
        const frond = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.46, 4), herbMat);
        frond.position.set(Math.cos(ang) * 0.11, 0.05, Math.sin(ang) * 0.11);
        frond.rotation.set(Math.sin(ang) * 0.45, 0, -Math.cos(ang) * 0.45);
        frond.castShadow = true;
        holder.add(frond);
      }
      break;
    }
    case 'potion': {
      const flaskMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: 0.35,
        roughness: 0.2,
        flatShading: true,
      });
      const bulb = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), flaskMat);
      bulb.castShadow = true;
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.18, 7), steelMat);
      neck.position.y = 0.24;
      const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.1, 6), woodMat);
      cork.position.y = 0.35;
      holder.add(bulb, neck, cork);
      break;
    }
    case 'hat': {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 0.06, 8), accentMat);
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.24, 0.24, 8), accentMat);
      crown.position.y = 0.13;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.24, 0.05, 8), goldMat);
      band.position.y = 0.06;
      holder.add(brim, crown, band);
      break;
    }
    case 'cloak': {
      const drape = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.54, 6), accentMat);
      drape.castShadow = true;
      const clasp = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), goldMat);
      clasp.position.set(0, 0.22, 0.12);
      holder.add(drape, clasp);
      break;
    }
    case 'amulet': {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.055, 6, 10), new THREE.MeshStandardMaterial({ color: '#E7E5E4', roughness: 0.65, flatShading: true }));
      const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.14, 0),
        new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 0.85, roughness: 0.2 })
      );
      holder.add(ring, gem);
      break;
    }
    case 'torch': {
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.038, 0.72, 6), woodMat);
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.14, 0.3, 6),
        new THREE.MeshStandardMaterial({ color: '#FFBA49', emissive: '#FF6B00', emissiveIntensity: 1.5, flatShading: true })
      );
      flame.position.y = 0.45;
      holder.add(stick, flame);
      break;
    }
    case 'stone': {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.26, 0), accentMat);
      rock.scale.set(1.25, 0.75, 1.0);
      rock.castShadow = true;
      holder.add(rock);
      break;
    }
    case 'moss': {
      const mossMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: 0.45,
        roughness: 0.7,
        flatShading: true,
      });
      const m1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), mossMat);
      m1.scale.set(1.3, 0.68, 1.15);
      const m2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.15, 0), mossMat);
      m2.position.set(0.16, 0.05, 0.1);
      holder.add(m1, m2);
      break;
    }
    case 'bone': {
      const boneMat = new THREE.MeshStandardMaterial({ color: '#ECE5D2', roughness: 0.75, flatShading: true });
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.68, 6), boneMat);
      shaft.rotation.z = Math.PI / 2;
      const e1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1, 0), boneMat);
      e1.position.x = -0.34;
      const e2 = e1.clone();
      e2.position.x = 0.34;
      holder.add(shaft, e1, e2);
      break;
    }
    case 'sword': {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.74, 0.04), steelMat);
      b.position.y = 0.14;
      const g = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.08), goldMat);
      g.position.y = -0.22;
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.22, 6), woodMat);
      h.position.y = -0.34;
      holder.add(b, g, h);
      break;
    }
    case 'mushroom': {
      const stemMat = new THREE.MeshStandardMaterial({ color: '#F3EAD8', roughness: 0.72, flatShading: true });
      const capMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.48, flatShading: true });
      const spotMat = new THREE.MeshStandardMaterial({ color: '#FFFDF7', roughness: 0.55, flatShading: true });
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.34, 8), stemMat);
      stem.position.y = -0.06;
      stem.castShadow = true;
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58), capMat);
      cap.scale.set(1, 0.72, 1);
      cap.position.y = 0.08;
      cap.castShadow = true;
      holder.add(stem, cap);
      for (const [sx, sy, sz] of [
        [0.11, 0.2, 0.1],
        [-0.12, 0.18, -0.06],
        [0.02, 0.24, -0.11],
      ]) {
        const spot = new THREE.Mesh(new THREE.SphereGeometry(0.036, 6, 6), spotMat);
        spot.position.set(sx, sy, sz);
        holder.add(spot);
      }
      break;
    }
    case 'flower': {
      const stemMat = new THREE.MeshStandardMaterial({ color: '#3F873B', roughness: 0.75 });
      const petalMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.5, flatShading: true });
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.035, 0.42, 6), stemMat);
      stem.position.y = -0.08;
      const center = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), goldMat);
      center.position.y = 0.16;
      holder.add(stem, center);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.085, 7, 5), petalMat);
        p.scale.set(1.25, 0.45, 0.85);
        p.position.set(Math.cos(a) * 0.16, 0.15, Math.sin(a) * 0.16);
        p.rotation.y = -a;
        holder.add(p);
      }
      break;
    }
    case 'armor': {
      const breast = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.19, 0.44, 8), accentMat);
      breast.castShadow = true;
      const trim = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 6, 10), goldMat);
      trim.rotation.x = Math.PI / 2;
      trim.position.y = 0.2;
      const pauldronL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), steelMat);
      pauldronL.position.set(-0.24, 0.15, 0);
      const pauldronR = pauldronL.clone();
      pauldronR.position.x = 0.24;
      holder.add(breast, trim, pauldronL, pauldronR);
      break;
    }
    case 'shield': {
      const faceMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.6, flatShading: true });
      const board = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.25, 0.06, 8), faceMat);
      board.rotation.x = Math.PI / 2;
      board.scale.set(0.92, 1, 1.15);
      board.castShadow = true;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.03, 6, 12), steelMat);
      rim.scale.set(0.92, 1.12, 1);
      const boss = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), goldMat);
      boss.position.z = 0.035;
      boss.scale.set(1, 1, 0.55);
      holder.add(board, rim, boss);
      break;
    }
    case 'staff': {
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.042, 1.05, 7), woodMat);
      shaft.rotation.z = -0.25;
      const orb = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.14, 0),
        new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 0.9, roughness: 0.2 })
      );
      orb.position.set(0.14, 0.54, 0);
      holder.add(shaft, orb);
      break;
    }
    case 'scroll': {
      const paperMat = new THREE.MeshStandardMaterial({ color: '#F5E6C8', roughness: 0.82 });
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.5, 10), paperMat);
      roll.rotation.z = Math.PI / 2;
      const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.08, 10), accentMat);
      seal.rotation.z = Math.PI / 2;
      holder.add(roll, seal);
      break;
    }
    case 'blanket': {
      const clothMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.86,
        flatShading: true,
      });
      const trimMat = new THREE.MeshStandardMaterial({
        color: '#F7E8CF',
        roughness: 0.85,
        flatShading: true,
      });
      const strapMat = new THREE.MeshStandardMaterial({
        color: '#7C4422',
        roughness: 0.78,
      });
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.56, 10), clothMat);
      roll.rotation.z = Math.PI / 2;
      roll.scale.set(1, 0.82, 1.18);
      roll.castShadow = true;
      const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.146, 0.146, 0.16, 10), trimMat);
      stripe.rotation.z = Math.PI / 2;
      stripe.scale.set(1, 0.82, 1.18);
      const strapL = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.018, 6, 12), strapMat);
      strapL.rotation.y = Math.PI / 2;
      strapL.position.x = -0.17;
      const strapR = strapL.clone();
      strapR.position.x = 0.17;
      holder.add(roll, stripe, strapL, strapR);
      break;
    }
    default: {
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), accentMat);
      gem.castShadow = true;
      holder.add(gem);
      break;
    }
  }

  return holder;
}

export interface ParachuteBlanketRig {
  group: THREE.Group;
  canopyMesh: THREE.Mesh;
  canopyGeo: THREE.BufferGeometry;
  cornerGripL: THREE.Mesh;
  cornerGripR: THREE.Mesh;
  segsU: number;
  segsV: number;
}

export function buildParachuteBlanketRig(colorHex = '#E06D44'): ParachuteBlanketRig {
  const group = new THREE.Group();
  group.visible = false;

  const segsU = 14;
  const segsV = 10;
  const vertCount = (segsU + 1) * (segsV + 1);
  const positions = new Float32Array(vertCount * 3);
  const colors = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);

  const mainCol = new THREE.Color(colorHex);
  const stripeCol = new THREE.Color('#F4C95D');
  const hemCol = new THREE.Color('#F7E8CF');
  const cornerCol = new THREE.Color('#7C4422');
  const tmpCol = new THREE.Color();

  for (let iv = 0; iv <= segsV; iv++) {
    const v = iv / segsV;
    for (let iu = 0; iu <= segsU; iu++) {
      const tU = iu / segsU;
      const u = tU * 2 - 1;
      const idx = iv * (segsU + 1) + iu;

      uvs[idx * 2] = tU;
      uvs[idx * 2 + 1] = v;

      // Woven textile pattern: cream outer stitched hem, ochre double stripes, leather corner tabs
      const isCornerTab = v < 0.16 && Math.abs(u) > 0.82;
      const isBorder = v < 0.08 || v > 0.91 || Math.abs(u) > 0.89;
      const isStripe = Math.abs(Math.abs(u) - 0.52) < 0.09 || Math.abs(v - 0.72) < 0.07;

      if (isCornerTab) {
        tmpCol.copy(cornerCol);
      } else if (isBorder) {
        tmpCol.copy(hemCol);
      } else if (isStripe) {
        tmpCol.copy(stripeCol);
      } else {
        tmpCol.copy(mainCol);
      }
      // Subtle woven thread modulation
      const weave = ((iu + iv) % 2 === 0 ? 1.02 : 0.96);
      colors[idx * 3] = Math.min(1, tmpCol.r * weave);
      colors[idx * 3 + 1] = Math.min(1, tmpCol.g * weave);
      colors[idx * 3 + 2] = Math.min(1, tmpCol.b * weave);
    }
  }

  const indices: number[] = [];
  for (let iv = 0; iv < segsV; iv++) {
    for (let iu = 0; iu < segsU; iu++) {
      const a = iv * (segsU + 1) + iu;
      const b = a + 1;
      const c = (iv + 1) * (segsU + 1) + iu;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const canopyGeo = new THREE.BufferGeometry();
  canopyGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  canopyGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  canopyGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  canopyGeo.setIndex(indices);

  const canopyMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.88,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  const canopyMesh = new THREE.Mesh(canopyGeo, canopyMat);
  canopyMesh.castShadow = true;
  canopyMesh.receiveShadow = true;
  canopyMesh.frustumCulled = false;

  const leatherMat = new THREE.MeshStandardMaterial({
    color: '#7C4422',
    roughness: 0.72,
  });
  const gripGeo = new THREE.SphereGeometry(0.062, 8, 8);
  const cornerGripL = new THREE.Mesh(gripGeo, leatherMat);
  const cornerGripR = new THREE.Mesh(gripGeo, leatherMat);

  group.add(canopyMesh, cornerGripL, cornerGripR);

  return {
    group,
    canopyMesh,
    canopyGeo,
    cornerGripL,
    cornerGripR,
    segsU,
    segsV,
  };
}

export function updateParachuteBlanketRig(
  rig: ParachuteBlanketRig,
  deployBlend: number,
  timeSec: number,
  airSpeedNorm: number,
  leftHandLocal: THREE.Vector3,
  rightHandLocal: THREE.Vector3,
  heroScale = 1
): void {
  const deploy = THREE.MathUtils.clamp(deployBlend, 0, 1);
  if (deploy <= 0.01) {
    rig.group.visible = false;
    return;
  }
  rig.group.visible = true;

  const s = Math.max(0.45, heroScale);
  const posAttr = rig.canopyGeo.getAttribute('position') as THREE.BufferAttribute;
  const arr = posAttr.array as Float32Array;
  const { segsU, segsV } = rig;

  const lx = leftHandLocal.x;
  const ly = leftHandLocal.y;
  const lz = leftHandLocal.z;
  const rx = rightHandLocal.x;
  const ry = rightHandLocal.y;
  const rz = rightHandLocal.z;

  const midX = (lx + rx) * 0.5;
  const spanSign = rx >= lx ? 1 : -1;
  const rawHalfSpanX = Math.abs(rx - lx) * 0.5;
  const fullSailHalfW = Math.max(rawHalfSpanX * 1.38, 1.18 * s);
  const sailDepth = 1.68 * s * THREE.MathUtils.lerp(0.22, 1.0, deploy);
  const domeHeight = (1.02 + 0.16 * airSpeedNorm) * s * deploy;
  const frontArchLift = 0.34 * s * deploy;

  rig.cornerGripL.position.set(lx, ly, lz);
  rig.cornerGripR.position.set(rx, ry, rz);
  const gripScale = s * THREE.MathUtils.lerp(0.65, 1.0, deploy);
  rig.cornerGripL.scale.setScalar(gripScale);
  rig.cornerGripR.scale.setScalar(gripScale);

  for (let iv = 0; iv <= segsV; iv++) {
    const v = iv / segsV;
    const widthEnvelope = Math.pow(v, 0.65);
    const windBillowV = Math.sin(Math.pow(v, 0.72) * Math.PI * 0.88);
    const trailingDrop = v > 0.76 ? Math.pow((v - 0.76) / 0.24, 1.4) * 0.22 * s * deploy : 0;

    for (let iu = 0; iu <= segsU; iu++) {
      const tU = iu / segsU;
      const u = tU * 2 - 1;
      const idx = iv * (segsU + 1) + iu;

      // Interpolate directly between left and right hand grip points along v=0
      const baseHandX = THREE.MathUtils.lerp(lx, rx, tU);
      const baseHandY = THREE.MathUtils.lerp(ly, ry, tU);
      const baseHandZ = THREE.MathUtils.lerp(lz, rz, tU);

      // Wing widens softly outward above hands and cups inward toward center dome
      const broadSailX = midX + u * spanSign * fullSailHalfW;
      const x = THREE.MathUtils.lerp(baseHandX, broadSailX, widthEnvelope * 0.82 * deploy);

      const archU = Math.sin(tU * Math.PI);
      const cupU = Math.cos(u * Math.PI * 0.46);
      const frontBridgeY = archU * frontArchLift * (1 - v * 0.45);
      const sailDomeY = (0.36 * v * s * deploy) + windBillowV * cupU * domeHeight - trailingDrop;
      const windFlutter =
        (Math.sin(u * 4.2 + timeSec * 8.6) * 0.022 +
          Math.cos(v * 5.5 - timeSec * 11.4) * 0.016) *
        Math.pow(v, 1.35) *
        s *
        deploy;

      const y = baseHandY + frontBridgeY + sailDomeY + windFlutter;
      const z =
        baseHandZ +
        archU * 0.14 * s * deploy * (1 - v) -
        sailDepth * Math.pow(v, 0.92) +
        cupU * Math.sin(v * Math.PI) * 0.18 * s * deploy;

      arr[idx * 3] = x;
      arr[idx * 3 + 1] = y;
      arr[idx * 3 + 2] = z;
    }
  }

  posAttr.needsUpdate = true;
  rig.canopyGeo.computeVertexNormals();
  rig.canopyGeo.computeBoundingSphere();
}

export function buildLeapingFishMesh(colorHex = '#38BDF8'): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.28,
    metalness: 0.35,
    flatShading: true,
  });
  const bellyMat = new THREE.MeshStandardMaterial({
    color: '#E2F2FF',
    roughness: 0.35,
    flatShading: true,
  });
  const finMat = new THREE.MeshStandardMaterial({
    color: '#F59E0B',
    roughness: 0.5,
    flatShading: true,
  });
  const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 1), bodyMat);
  body.scale.set(0.58, 0.82, 1.85);
  body.castShadow = true;
  const belly = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), bellyMat);
  belly.scale.set(0.5, 0.45, 1.4);
  belly.position.set(0, -0.08, 0.04);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.26, 4), finMat);
  tail.rotation.x = Math.PI / 2;
  tail.scale.set(0.32, 1.0, 1.1);
  tail.position.set(0, 0, -0.44);
  const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.18, 3), finMat);
  dorsal.position.set(0, 0.19, -0.02);
  dorsal.rotation.x = -0.35;
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#0F172A' });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.032, 6, 6), eyeMat);
  eyeL.position.set(-0.085, 0.04, 0.24);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.085;
  g.add(body, belly, tail, dorsal, eyeL, eyeR);
  return g;
}

export function buildTreeStumpMesh(size: number, kind: 'pine' | 'oak' | 'birch'): THREE.Group {
  const g = new THREE.Group();
  const atlas = getTerrainTextureAtlas();
  const barkMap = kind === 'birch' ? atlas.birchBark : kind === 'oak' ? atlas.oakBark : atlas.pineBark;
  const barkBump = kind === 'birch' ? atlas.birchBarkBump : kind === 'oak' ? atlas.oakBarkBump : atlas.pineBarkBump;
  const barkMat = new THREE.MeshStandardMaterial({
    color: '#FFFFFF',
    map: barkMap,
    bumpMap: barkBump,
    bumpScale: kind === 'birch' ? 0.08 : 0.14,
    roughness: kind === 'birch' ? 0.74 : 0.9,
  });
  const topMat = new THREE.MeshStandardMaterial({
    color: '#FFFFFF',
    map: atlas.woodRings,
    roughness: 0.82,
  });
  const stumpGeo = createFlutedStumpGeometry(
    kind === 'birch' ? 0.18 : 0.26,
    kind === 'birch' ? 0.24 : 0.38,
    0.58
  );
  const stump = new THREE.Mesh(stumpGeo, [barkMat, topMat, barkMat]);
  stump.position.y = 0.24;
  stump.castShadow = true;
  stump.receiveShadow = true;
  g.add(stump);
  g.scale.setScalar(size * 1.15);
  return g;
}

export function buildFallingTreeMesh(
  kind: 'pine' | 'oak' | 'birch',
  size: number,
  colorHex: string
): THREE.Group {
  // Pivoted at the cut line (y = 0) so tilting around local X/Z topples realistically from the stump
  const g = new THREE.Group();
  const atlas = getTerrainTextureAtlas();
  const barkMap = kind === 'birch' ? atlas.birchBark : kind === 'oak' ? atlas.oakBark : atlas.pineBark;
  const barkBump = kind === 'birch' ? atlas.birchBarkBump : kind === 'oak' ? atlas.oakBarkBump : atlas.pineBarkBump;
  const leafMap = kind === 'birch' ? atlas.birchLeaves : kind === 'oak' ? atlas.oakLeaves : atlas.pineLeaves;
  const leafBump = kind === 'birch' ? atlas.birchLeavesBump : kind === 'oak' ? atlas.oakLeavesBump : atlas.pineLeavesBump;

  const trunkMat = new THREE.MeshStandardMaterial({
    color: '#FFFFFF',
    map: barkMap,
    bumpMap: barkBump,
    bumpScale: kind === 'birch' ? 0.09 : 0.15,
    roughness: kind === 'birch' ? 0.74 : 0.9,
  });
  const leafMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    map: leafMap,
    bumpMap: leafBump,
    bumpScale: 0.12,
    roughness: 0.8,
  });

  if (kind === 'oak') {
    const trunkGeo = createOrganicTrunkGeometry({
      rTop: 0.22,
      rBottom: 0.34,
      height: 4.65,
      yOffset: 0,
      radialSegs: 12,
      heightSegs: 7,
      rootFlare: 0.08,
      curveX: 0.1,
      curveZ: 0.06,
      branches: [
        { startY: 3.55, length: 1.22, rBottom: 0.15, rTop: 0.07, tilt: 0.56, yaw: 0.55 },
        { startY: 3.68, length: 1.14, rBottom: 0.14, rTop: 0.065, tilt: 0.52, yaw: 2.65 },
        { startY: 3.82, length: 1.04, rBottom: 0.13, rTop: 0.06, tilt: 0.48, yaw: -1.45 },
      ],
    });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.castShadow = true;
    const c1 = new THREE.Mesh(createSculptedCanopyLobeGeometry(1.34, 1.24, 0.88, 1.18, 1.2, 16, 12, 2.8, 1.9), leafMat);
    c1.position.set(0.05, 5.25, 0.02);
    c1.castShadow = true;
    const c2 = new THREE.Mesh(createSculptedCanopyLobeGeometry(1.02, 1.12, 0.86, 1.06, 2.7, 14, 10, 2.4, 1.7), leafMat);
    c2.position.set(0.84, 4.88, 0.5);
    c2.castShadow = true;
    const c3 = new THREE.Mesh(createSculptedCanopyLobeGeometry(0.96, 1.08, 0.88, 1.04, 4.1, 14, 10, 2.4, 1.7), leafMat);
    c3.position.set(-0.8, 4.94, -0.42);
    c3.castShadow = true;
    const c4 = new THREE.Mesh(createSculptedCanopyLobeGeometry(0.88, 1.08, 0.84, 1.06, 5.6, 14, 10, 2.3, 1.6), leafMat);
    c4.position.set(-0.26, 4.82, 0.82);
    c4.castShadow = true;
    const c5 = new THREE.Mesh(createSculptedCanopyLobeGeometry(0.84, 1.1, 0.88, 1.04, 7.3, 14, 10, 2.2, 1.6), leafMat);
    c5.position.set(0.3, 5.76, -0.24);
    c5.castShadow = true;
    g.add(trunk, c1, c2, c3, c4, c5);
  } else if (kind === 'birch') {
    const trunkGeo = createOrganicTrunkGeometry({
      rTop: 0.095,
      rBottom: 0.2,
      height: 5.15,
      yOffset: 0,
      radialSegs: 12,
      heightSegs: 7,
      rootFlare: 0.06,
      curveX: 0.12,
      curveZ: -0.05,
      uvScaleU: 1.6,
      uvScaleV: 2.5,
      branches: [
        { startY: 3.85, length: 1.12, rBottom: 0.08, rTop: 0.036, tilt: 0.44, yaw: 0.85 },
        { startY: 4.12, length: 0.96, rBottom: 0.07, rTop: 0.032, tilt: 0.4, yaw: -2.1 },
      ],
    });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.castShadow = true;
    const l1 = new THREE.Mesh(createSculptedCanopyLobeGeometry(0.96, 0.96, 1.24, 0.94, 3.1, 16, 10, 2.8, 2.0), leafMat);
    l1.position.set(0.12, 5.45, -0.04);
    l1.castShadow = true;
    const l2 = new THREE.Mesh(createSculptedCanopyLobeGeometry(0.72, 0.98, 1.12, 0.96, 5.4, 14, 10, 2.4, 1.8), leafMat);
    l2.position.set(0.54, 4.92, -0.32);
    l2.castShadow = true;
    const l3 = new THREE.Mesh(createSculptedCanopyLobeGeometry(0.66, 0.95, 1.08, 0.94, 8.2, 14, 10, 2.3, 1.7), leafMat);
    l3.position.set(-0.46, 5.02, 0.34);
    l3.castShadow = true;
    const l4 = new THREE.Mesh(createSculptedCanopyLobeGeometry(0.6, 0.92, 1.18, 0.92, 11.1, 12, 10, 2.2, 1.7), leafMat);
    l4.position.set(0.06, 6.16, 0.08);
    l4.castShadow = true;
    g.add(trunk, l1, l2, l3, l4);
  } else {
    const trunkGeo = createOrganicTrunkGeometry({
      rTop: 0.11,
      rBottom: 0.26,
      height: 4.95,
      yOffset: 0,
      radialSegs: 12,
      heightSegs: 7,
      rootFlare: 0.06,
      curveX: 0.05,
      curveZ: 0.03,
    });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.castShadow = true;
    const t1 = new THREE.Mesh(createDetailedPineTierGeometry(1.58, 1.48, 11, 1), leafMat);
    t1.position.y = 4.28;
    t1.castShadow = true;
    const t2 = new THREE.Mesh(createDetailedPineTierGeometry(1.34, 1.38, 11, 2), leafMat);
    t2.position.y = 5.06;
    t2.rotation.y = 0.29;
    t2.castShadow = true;
    const t3 = new THREE.Mesh(createDetailedPineTierGeometry(1.08, 1.28, 10, 3), leafMat);
    t3.position.y = 5.8;
    t3.rotation.y = 0.61;
    t3.castShadow = true;
    const t4 = new THREE.Mesh(createDetailedPineTierGeometry(0.8, 1.14, 9, 4), leafMat);
    t4.position.y = 6.48;
    t4.rotation.y = 0.95;
    t4.castShadow = true;
    const t5 = new THREE.Mesh(createDetailedPineTierGeometry(0.5, 0.94, 7, 5), leafMat);
    t5.position.y = 7.06;
    t5.castShadow = true;
    g.add(trunk, t1, t2, t3, t4, t5);
  }

  g.scale.setScalar(size * 1.15);
  return g;
}

function buildRpgRewardCardsShrineMesh(entity: LevelEntity): THREE.Group {
  const root = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: '#5A626A', roughness: 0.88 });
  const mossMat = new THREE.MeshStandardMaterial({ color: '#3E6B3C', roughness: 0.9 });
  const goldMat = new THREE.MeshStandardMaterial({ color: '#F59E0B', roughness: 0.25, metalness: 0.85 });

  // Organic stepped octagonal stone pedestal
  const base1 = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.74, 0.22, 8), stoneMat);
  base1.position.y = 0.11;
  base1.castShadow = true;
  base1.receiveShadow = true;
  const base2 = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.56, 0.38, 7), stoneMat);
  base2.position.y = 0.4;
  base2.rotation.y = 0.35;
  base2.castShadow = true;
  const mossCap = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.48, 0.08, 7), mossMat);
  mossCap.position.y = 0.6;
  root.add(base1, base2, mossCap);

  // 3 colorful fanned-out reward cards hovering above the shrine
  const cardPivot = new THREE.Group();
  cardPivot.position.set(0, 1.28, 0);
  cardPivot.userData.floatSpin = true;

  const cardSpecs = [
    { color: '#EF4444', border: '#F59E0B', x: -0.36, y: -0.04, z: 0.03, rotZ: 0.28, rotY: 0.18 },
    { color: '#8B5CF6', border: '#FDE047', x: 0, y: 0.06, z: 0.08, rotZ: 0, rotY: 0 },
    { color: '#10B981', border: '#F59E0B', x: 0.36, y: -0.04, z: 0.03, rotZ: -0.28, rotY: -0.18 },
  ];

  for (const spec of cardSpecs) {
    const cardGroup = new THREE.Group();
    cardGroup.position.set(spec.x, spec.y, spec.z);
    cardGroup.rotation.set(0, spec.rotY, spec.rotZ);

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.62, 0.04),
      new THREE.MeshStandardMaterial({ color: spec.border, roughness: 0.28, metalness: 0.8 })
    );
    frame.castShadow = true;
    const face = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.54, 0.05),
      new THREE.MeshStandardMaterial({
        color: spec.color,
        emissive: spec.color,
        emissiveIntensity: 0.45,
        roughness: 0.3,
      })
    );
    const emblem = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), goldMat);
    emblem.position.z = 0.035;
    cardGroup.add(frame, face, emblem);
    cardPivot.add(cardGroup);
  }

  root.add(cardPivot);
  root.userData.isRpgCardShrine = true;
  root.userData.entityTint = entity.styleTint;
  return root;
}

function buildMiniVillagerFigure(options: {
  tunicColor: string;
  hairColor: string;
  skinColor?: string;
  seated?: boolean;
  apronColor?: string;
  hatColor?: string;
}): {
  root: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  torso: THREE.Group;
} {
  const root = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: options.skinColor ?? '#F2C5A0', roughness: 0.72 });
  const tunicMat = new THREE.MeshStandardMaterial({ color: options.tunicColor, roughness: 0.8 });
  const hairMat = new THREE.MeshStandardMaterial({ color: options.hairColor, roughness: 0.85 });
  const trouserMat = new THREE.MeshStandardMaterial({ color: '#3E3227', roughness: 0.88 });
  const bootMat = new THREE.MeshStandardMaterial({ color: '#271E17', roughness: 0.82 });

  const torso = new THREE.Group();
  const baseH = options.seated ? 0.56 : 0.72;
  torso.position.y = baseH;
  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.23, 0.54, 10), tunicMat);
  chest.position.y = 0.27;
  chest.castShadow = true;
  torso.add(chest);

  if (options.apronColor) {
    const apronMat = new THREE.MeshStandardMaterial({ color: options.apronColor, roughness: 0.78 });
    const apron = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.52, 0.12), apronMat);
    apron.position.set(0, 0.22, 0.16);
    torso.add(apron);
  }

  const head = new THREE.Group();
  head.position.set(0, 0.66, 0);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), skinMat);
  skull.castShadow = true;
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.58), hairMat);
  hairCap.position.y = 0.02;
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#1F2937' });
  for (const sx of [-0.065, 0.065]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.024, 6, 6), eyeMat);
    eye.position.set(sx, 0.02, 0.16);
    head.add(eye);
  }
  if (options.hatColor) {
    const hatMat = new THREE.MeshStandardMaterial({ color: options.hatColor, roughness: 0.85 });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.04, 12), hatMat);
    brim.position.y = 0.13;
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.16, 10), hatMat);
    crown.position.y = 0.21;
    head.add(brim, crown);
  }
  head.add(skull, hairCap);
  torso.add(head);

  const armL = new THREE.Group();
  armL.position.set(-0.26, 0.48, 0);
  const armLMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.42, 8), tunicMat);
  armLMesh.position.y = -0.18;
  const handL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), skinMat);
  handL.position.y = -0.4;
  armL.add(armLMesh, handL);

  const armR = new THREE.Group();
  armR.position.set(0.26, 0.48, 0);
  const armRMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.42, 8), tunicMat);
  armRMesh.position.y = -0.18;
  const handR = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), skinMat);
  handR.position.y = -0.4;
  armR.add(armRMesh, handR);

  torso.add(armL, armR);
  root.add(torso);

  for (const sx of [-0.11, 0.11]) {
    if (options.seated) {
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.34, 8), trouserMat);
      thigh.rotation.x = Math.PI / 2;
      thigh.position.set(sx, 0.48, 0.16);
      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.06, 0.38, 8), bootMat);
      shin.position.set(sx, 0.24, 0.32);
      root.add(thigh, shin);
    } else {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.065, 0.56, 8), trouserMat);
      leg.position.set(sx, 0.38, 0);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.14, 0.22), bootMat);
      boot.position.set(sx, 0.07, 0.03);
      root.add(leg, boot);
    }
  }

  return { root, head, armL, armR, torso };
}

function buildWalkInBuildingMesh(entity: LevelEntity, spec: WalkInBuildingSpec): THREE.Group {
  const root = new THREE.Group();
  // Walk-in building coordinates in spec are scaled by entity.scale in terrain.ts,
  // while Three.js scales the root group by entity.scale automatically. Use unscaled base dimensions here!
  const s = Math.max(0.65, entity.scale ?? 1);
  const halfW = spec.halfW / s;
  const halfD = spec.halfD / s;
  const doorHalfW = spec.doorHalfW / s;
  const floorY = spec.floorOffset;
  const wallH = (spec.wallHeight / s) * 0.62;
  const wallT = spec.wallThick / s;

  const isScifi = spec.buildingType === 'scifiBuilding';
  const isModern = spec.buildingType === 'modernBuilding';
  const isTemple = spec.buildingType === 'stoneShrine';

  const stoneMat = new THREE.MeshStandardMaterial({
    color: isScifi ? '#1E293B' : isModern ? '#334155' : '#6A707A',
    roughness: isScifi ? 0.45 : 0.9,
    metalness: isScifi ? 0.55 : 0.05,
  });
  const darkStoneMat = new THREE.MeshStandardMaterial({
    color: isScifi ? '#0F172A' : '#474C55',
    roughness: 0.88,
  });
  const woodFloorMat = new THREE.MeshStandardMaterial({
    color: isScifi ? '#1E293B' : isTemple ? '#57534E' : isModern ? '#855836' : '#6E472B',
    roughness: isModern ? 0.55 : 0.82,
    metalness: isScifi ? 0.45 : 0.05,
  });
  const plankSeamMat = new THREE.MeshStandardMaterial({
    color: isScifi ? '#0EA5E9' : isTemple ? '#44403C' : '#4A2E1A',
    emissive: isScifi ? '#0284C7' : '#000000',
    emissiveIntensity: isScifi ? 0.45 : 0,
    roughness: 0.85,
  });
  const wallMat = new THREE.MeshStandardMaterial({
    color:
      entity.styleTint ??
      (isScifi
        ? '#334155'
        : isModern
          ? '#F1F5F9'
          : isTemple
            ? '#78716C'
            : spec.buildingType === 'blacksmith'
              ? '#B8A996'
              : '#E5D7C1'),
    roughness: isScifi ? 0.38 : 0.84,
    metalness: isScifi ? 0.42 : 0.04,
  });
  const timberMat = new THREE.MeshStandardMaterial({
    color: isScifi ? '#0F172A' : isModern ? '#1E293B' : '#4E321D',
    roughness: 0.84,
  });
  const furnitureWoodMat = new THREE.MeshStandardMaterial({
    color: isScifi ? '#334155' : '#7C5132',
    roughness: 0.78,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: isScifi ? '#0F172A' : isModern ? '#1E293B' : isTemple ? '#57534E' : '#7A3424',
    roughness: 0.8,
  });
  const mossMat = new THREE.MeshStandardMaterial({ color: '#3F6E38', roughness: 0.88 });
  const ironMat = new THREE.MeshStandardMaterial({ color: '#374151', roughness: 0.35, metalness: 0.82 });
  const goldMat = new THREE.MeshStandardMaterial({ color: '#F59E0B', roughness: 0.32, metalness: 0.72 });
  const lanternGlowMat = new THREE.MeshStandardMaterial({
    color: isScifi ? '#38BDF8' : '#FFD584',
    emissive: isScifi ? '#0EA5E9' : '#FF8F00',
    emissiveIntensity: 1.75,
    roughness: 0.2,
  });
  const windowGlassMat = new THREE.MeshStandardMaterial({
    color: isScifi ? '#7DD3FC' : '#FFE4A0',
    emissive: isScifi ? '#0284C7' : '#F59E0B',
    emissiveIntensity: 0.65,
    transparent: true,
    opacity: 0.72,
    roughness: 0.18,
  });

  // 1. Stone Foundation Plinth & Detailed Wooden Plank Floor
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(halfW * 2 + 0.6, floorY, halfD * 2 + 0.6),
    stoneMat
  );
  plinth.position.y = floorY * 0.5;
  plinth.receiveShadow = true;
  root.add(plinth);

  const floorDeck = new THREE.Mesh(
    new THREE.BoxGeometry(halfW * 2 - 0.1, 0.08, halfD * 2 - 0.1),
    woodFloorMat
  );
  floorDeck.position.y = floorY + 0.02;
  floorDeck.receiveShadow = true;
  root.add(floorDeck);

  // Visible wooden plank floor boards & entrance stone threshold
  const plankCount = Math.floor((halfW * 2 - 0.6) / 0.85);
  for (let i = 0; i <= plankCount; i++) {
    const px = -halfW + 0.4 + i * 0.85;
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.02, halfD * 2 - 0.3), plankSeamMat);
    seam.position.set(px, floorY + 0.055, 0);
    root.add(seam);
  }
  const threshold = new THREE.Mesh(new THREE.BoxGeometry(doorHalfW * 2.4, 0.1, 1.35), darkStoneMat);
  threshold.position.set(0, floorY * 0.65, halfD + 0.32);
  threshold.receiveShadow = true;
  root.add(threshold);

  // 2. Perimeter Walls with Front Doorway Gap & Framed Windows
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2, wallH, wallT), wallMat);
  backWall.position.set(0, floorY + wallH * 0.5, -halfD);
  backWall.castShadow = true;
  backWall.receiveShadow = true;

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, halfD * 2), wallMat);
  leftWall.position.set(-halfW, floorY + wallH * 0.5, 0);
  leftWall.castShadow = true;
  leftWall.receiveShadow = true;

  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, halfD * 2), wallMat);
  rightWall.position.set(halfW, floorY + wallH * 0.5, 0);
  rightWall.castShadow = true;
  rightWall.receiveShadow = true;

  const frontSegW = Math.max(0.6, halfW - doorHalfW);
  const frontSegCenter = doorHalfW + frontSegW * 0.5;
  const frontLeftWall = new THREE.Mesh(new THREE.BoxGeometry(frontSegW, wallH, wallT), wallMat);
  frontLeftWall.position.set(-frontSegCenter, floorY + wallH * 0.5, halfD);
  frontLeftWall.castShadow = true;
  frontLeftWall.receiveShadow = true;

  const frontRightWall = new THREE.Mesh(new THREE.BoxGeometry(frontSegW, wallH, wallT), wallMat);
  frontRightWall.position.set(frontSegCenter, floorY + wallH * 0.5, halfD);
  frontRightWall.castShadow = true;
  frontRightWall.receiveShadow = true;

  // Doorway header beam above front entrance
  const doorH = Math.min(wallH - 0.55, 2.55);
  const doorHeaderH = Math.max(0.35, wallH - doorH);
  const doorHeader = new THREE.Mesh(
    new THREE.BoxGeometry(doorHalfW * 2 + 0.2, doorHeaderH, wallT + 0.06),
    timberMat
  );
  doorHeader.position.set(0, floorY + doorH + doorHeaderH * 0.5, halfD);
  root.add(backWall, leftWall, rightWall, frontLeftWall, frontRightWall, doorHeader);

  // Corner & intermediate timber framing posts + stone corner quoins + half-timber X-bracing
  for (const px of [-halfW, -doorHalfW, doorHalfW, halfW]) {
    for (const pz of [-halfD, halfD]) {
      if (Math.abs(px) === doorHalfW && pz < 0) continue;
      const post = new THREE.Mesh(new THREE.BoxGeometry(wallT + 0.14, wallH + 0.12, wallT + 0.14), timberMat);
      post.position.set(px, floorY + wallH * 0.5, pz);
      post.castShadow = true;
      root.add(post);
      if (!isScifi && !isModern && Math.abs(px) === halfW) {
        // Chamfered corner stone quoins anchoring timber corners into plinth
        for (let q = 0; q < 3; q++) {
          const quoin = new THREE.Mesh(
            new THREE.BoxGeometry(wallT + 0.24, 0.36, wallT + 0.24),
            q % 2 === 0 ? stoneMat : darkStoneMat
          );
          quoin.position.set(px, floorY + 0.24 + q * 0.44, pz);
          quoin.castShadow = true;
          root.add(quoin);
        }
      }
    }
  }

  if (!isScifi && !isModern && !isTemple) {
    // Upper half-timber horizontal wall plate & refined X-bracing on front & side walls
    for (const zWall of [-halfD, halfD]) {
      const topPlate = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 + 0.14, 0.14, wallT + 0.12), timberMat);
      topPlate.position.set(0, floorY + wallH - 0.12, zWall);
      const midRail = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 + 0.08, 0.1, wallT + 0.1), timberMat);
      midRail.position.set(0, floorY + wallH * 0.44, zWall);
      root.add(topPlate, midRail);
    }
    const braceLen = Math.hypot(frontSegW * 0.86, wallH * 0.44);
    const braceAng = Math.atan2(wallH * 0.44, frontSegW * 0.86);
    for (const side of [-1, 1]) {
      for (const diag of [-1, 1]) {
        const brace = new THREE.Mesh(new THREE.BoxGeometry(braceLen, 0.09, wallT + 0.1), timberMat);
        brace.position.set(side * frontSegCenter, floorY + wallH * 0.72, halfD);
        brace.rotation.z = diag * braceAng;
        root.add(brace);
      }
      const sidePlate = new THREE.Mesh(new THREE.BoxGeometry(wallT + 0.12, 0.14, halfD * 2 + 0.14), timberMat);
      sidePlate.position.set(side * halfW, floorY + wallH - 0.12, 0);
      root.add(sidePlate);
    }
  }

  // Paned Windows on Front, Left, and Right Walls
  const addWindow = (wx: number, wy: number, wz: number, rotY: number, winW = 1.38, winH = 1.12) => {
    const winGroup = new THREE.Group();
    winGroup.position.set(wx, wy, wz);
    winGroup.rotation.y = rotY;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(winW + 0.18, winH + 0.18, wallT + 0.12), timberMat);
    const pane = new THREE.Mesh(new THREE.BoxGeometry(winW, winH, wallT + 0.16), windowGlassMat);
    const mullionV = new THREE.Mesh(new THREE.BoxGeometry(0.07, winH, wallT + 0.18), timberMat);
    const mullionH = new THREE.Mesh(new THREE.BoxGeometry(winW, 0.07, wallT + 0.18), timberMat);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(winW + 0.34, 0.1, wallT + 0.32), stoneMat);
    sill.position.y = -winH * 0.5 - 0.06;
    winGroup.add(frame, pane, mullionV, mullionH, sill);
    root.add(winGroup);
  };
  addWindow(-frontSegCenter, floorY + wallH * 0.52, halfD, 0);
  addWindow(frontSegCenter, floorY + wallH * 0.52, halfD, 0);
  addWindow(-halfW, floorY + wallH * 0.52, -halfD * 0.32, Math.PI / 2);
  addWindow(-halfW, floorY + wallH * 0.52, halfD * 0.34, Math.PI / 2);
  addWindow(halfW, floorY + wallH * 0.52, -halfD * 0.32, Math.PI / 2);
  addWindow(halfW, floorY + wallH * 0.52, halfD * 0.34, Math.PI / 2);

  // 3. Hinged Interactive Front Door (swings open when player presses E / Use)
  const frontDoorPivot = new THREE.Group();
  frontDoorPivot.position.set(-doorHalfW, floorY, halfD);
  const doorW = doorHalfW * 2;
  const doorLeaf = new THREE.Mesh(
    new THREE.BoxGeometry(doorW, doorH, 0.16),
    new THREE.MeshStandardMaterial({
      color: isScifi ? '#0284C7' : '#5C371C',
      roughness: 0.75,
      metalness: isScifi ? 0.5 : 0.08,
    })
  );
  doorLeaf.position.set(doorW * 0.5, doorH * 0.5, 0);
  doorLeaf.castShadow = true;
  frontDoorPivot.add(doorLeaf);

  // Iron hinge straps & brass door ring handle on both faces of door
  for (const hy of [0.55, doorH - 0.55]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(doorW * 0.72, 0.1, 0.2), ironMat);
    strap.position.set(doorW * 0.38, hy, 0);
    frontDoorPivot.add(strap);
  }
  const doorHandle = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.025, 8, 14), goldMat);
  doorHandle.position.set(doorW - 0.32, doorH * 0.48, 0.12);
  const doorHandleBack = doorHandle.clone();
  doorHandleBack.position.z = -0.12;
  frontDoorPivot.add(doorHandle, doorHandleBack);
  root.add(frontDoorPivot);

  // 4. Interior Wall Lanterns & Framed Wall Pictures (for ALL walk-in buildings)
  const coneMat = new THREE.MeshBasicMaterial({
    color: isScifi ? '#38BDF8' : '#FFCC66',
    transparent: true,
    opacity: 0.11,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const addWallLantern = (lx: number, ly: number, lz: number) => {
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.24), ironMat);
    bracket.position.set(lx, ly + 0.14, lz);
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.28, 6), lanternGlowMat);
    lantern.position.set(lx, ly, lz);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.12, 6), ironMat);
    cap.position.set(lx, ly + 0.18, lz);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.55, 2.2, 14, 1, true), coneMat);
    cone.position.set(lx, ly - 1.05, lz);
    root.add(bracket, lantern, cap, cone);
  };
  addWallLantern(-halfW + 0.32, floorY + wallH * 0.68, -halfD * 0.45);
  addWallLantern(-halfW + 0.32, floorY + wallH * 0.68, halfD * 0.45);
  addWallLantern(halfW - 0.32, floorY + wallH * 0.68, -halfD * 0.45);
  addWallLantern(halfW - 0.32, floorY + wallH * 0.68, halfD * 0.45);
  addWallLantern(-doorHalfW - 0.45, floorY + 2.15, halfD + 0.28);
  addWallLantern(doorHalfW + 0.45, floorY + 2.15, halfD + 0.28);

  // Framed Wall Pictures / Paintings hanging on interior walls
  const pictureColors = ['#1D4ED8', '#15803D', '#B45309', '#7E22CE', '#BE123C'];
  const addFramedPicture = (px: number, py: number, pz: number, rotY: number, colorIdx: number) => {
    const picGroup = new THREE.Group();
    picGroup.position.set(px, py, pz);
    picGroup.rotation.y = rotY;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.82, 0.08), goldMat);
    const canvas = new THREE.Mesh(
      new THREE.BoxGeometry(0.98, 0.66, 0.1),
      new THREE.MeshStandardMaterial({
        color: pictureColors[colorIdx % pictureColors.length],
        roughness: 0.55,
      })
    );
    const sunMotif = new THREE.Mesh(new THREE.CircleGeometry(0.14, 12), lanternGlowMat);
    sunMotif.position.set(0.18, 0.1, 0.06);
    picGroup.add(frame, canvas, sunMotif);
    root.add(picGroup);
  };
  addFramedPicture(0.2, floorY + wallH * 0.58, -halfD + 0.22, 0, 0);
  addFramedPicture(-halfW + 0.22, floorY + wallH * 0.58, 0, Math.PI / 2, 1);
  addFramedPicture(halfW - 0.22, floorY + wallH * 0.58, 0, -Math.PI / 2, 2);

  // Helper to build a refined compact dining table with benches
  const addTableWithBenches = (tx: number, tz: number, tableW = 1.85, tableD = 0.92, withCandles = true) => {
    const tGroup = new THREE.Group();
    tGroup.position.set(tx, floorY, tz);
    const top = new THREE.Mesh(new THREE.BoxGeometry(tableW, 0.1, tableD), furnitureWoodMat);
    top.position.y = 0.74;
    top.castShadow = true;
    top.receiveShadow = true;
    tGroup.add(top);
    for (const [lx, lz] of [
      [-tableW * 0.42, -tableD * 0.38],
      [tableW * 0.42, -tableD * 0.38],
      [-tableW * 0.42, tableD * 0.38],
      [tableW * 0.42, tableD * 0.38],
    ]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.72, 6), timberMat);
      leg.position.set(lx, 0.36, lz);
      tGroup.add(leg);
    }
    for (const bz of [-tableD * 0.78, tableD * 0.78]) {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(tableW * 0.9, 0.075, 0.32), furnitureWoodMat);
      bench.position.set(0, 0.42, bz);
      bench.castShadow = true;
      tGroup.add(bench);
    }
    if (withCandles) {
      const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.045, 0.16, 8), lanternGlowMat);
      candle.position.set(0, 0.87, 0);
      const mug1 = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.074, 0.15, 8), timberMat);
      mug1.position.set(-0.42, 0.86, 0.18);
      const mug2 = mug1.clone();
      mug2.position.set(0.44, 0.86, -0.18);
      tGroup.add(candle, mug1, mug2);
    }
    root.add(tGroup);
  };

  // 5. Building-Specific Detailed Interiors & Animated NPCs
  if (spec.buildingType === 'tavern') {
    // A. Roaring Stone Fireplace on Back-Left Wall
    const hearth = new THREE.Mesh(new THREE.BoxGeometry(2.7, 2.6, 1.3), stoneMat);
    hearth.position.set(-3.2, floorY + 1.3, -halfD + 0.72);
    hearth.castShadow = true;
    const firebox = new THREE.Mesh(
      new THREE.BoxGeometry(1.55, 1.15, 0.65),
      new THREE.MeshBasicMaterial({ color: '#1A0F0A' })
    );
    firebox.position.set(-3.2, floorY + 0.62, -halfD + 1.12);
    const embers = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.42, 1),
      new THREE.MeshStandardMaterial({ color: '#FF6D00', emissive: '#FF3D00', emissiveIntensity: 2.1 })
    );
    embers.position.set(-3.2, floorY + 0.42, -halfD + 1.18);
    const mantleBeam = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.22, 1.5), timberMat);
    mantleBeam.position.set(-3.2, floorY + 1.65, -halfD + 0.75);
    root.add(hearth, firebox, embers, mantleBeam);

    // B. Long Oak Bar Counter + Stacked Kegs + Bartender Behind the Bar
    const barCounter = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.12, 0.95), furnitureWoodMat);
    barCounter.position.set(2.2, floorY + 0.56, -2.9);
    barCounter.castShadow = true;
    const barTop = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.12, 1.12), timberMat);
    barTop.position.set(2.2, floorY + 1.14, -2.9);
    root.add(barCounter, barTop);

    // Back bar kegs & bottle shelves
    for (const kx of [0.6, 2.2, 3.8]) {
      const keg = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.32, 0.78, 10), furnitureWoodMat);
      keg.rotation.x = Math.PI / 2;
      keg.position.set(kx, floorY + 1.35, -halfD + 0.62);
      keg.castShadow = true;
      root.add(keg);
    }

    // Bartender NPC standing behind the bar counter
    const bartender = buildMiniVillagerFigure({
      tunicColor: '#7C2D12',
      hairColor: '#451A03',
      apronColor: '#F5F5F4',
    });
    bartender.root.position.set(2.2, floorY, -4.15);
    bartender.armR.rotation.x = -0.75;
    root.add(bartender.root);

    // C. Multiple Dining Tables & Benches with Seated Patrons Chatting & Raising Mugs
    const tableCoords: [number, number][] = [
      [-3.7, -0.3],
      [-3.7, 2.7],
      [3.1, 0.2],
      [3.1, 2.9],
    ];
    const patronColors = ['#1E40AF', '#166534', '#9A3412', '#6B21A8', '#0F766E', '#991B1B'];
    const tavernPatrons: { head: THREE.Group; armR: THREE.Group; phase: number }[] = [];
    tableCoords.forEach(([tx, tz], idx) => {
      addTableWithBenches(tx, tz, 2.2, 1.08, true);
      // 1-2 seated patrons per table
      for (const side of idx % 2 === 0 ? [-1, 1] : [1]) {
        const pIdx = tavernPatrons.length;
        const patron = buildMiniVillagerFigure({
          tunicColor: patronColors[pIdx % patronColors.length],
          hairColor: pIdx % 2 === 0 ? '#3B2314' : '#D97706',
          seated: true,
        });
        patron.root.position.set(tx + (side > 0 ? -0.35 : 0.35), floorY, tz + side * 0.82);
        patron.root.rotation.y = side > 0 ? Math.PI : 0;
        patron.armR.rotation.x = -0.85;
        const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.075, 0.16, 8), goldMat);
        mug.position.set(0, -0.44, 0.08);
        patron.armR.add(mug);
        root.add(patron.root);
        tavernPatrons.push({ head: patron.head, armR: patron.armR, phase: pIdx * 1.3 });
      }
    });
    root.userData.tavernPatrons = tavernPatrons;
    root.userData.bartenderNpc = bartender;

    // D. Wooden Staircase & Upstairs Inn Mezzanine Loft with Beds
    const loftY = floorY + 2.55;
    const loftDeck = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.16, 3.8), furnitureWoodMat);
    loftDeck.position.set(-halfW + 2.3, loftY, -halfD + 2.0);
    loftDeck.castShadow = true;
    loftDeck.receiveShadow = true;
    const loftRailing = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.72, 0.12), timberMat);
    loftRailing.position.set(-halfW + 2.3, loftY + 0.42, -halfD + 3.85);
    root.add(loftDeck, loftRailing);

    // Stairs leading up to the Upstairs Inn Loft along left wall
    const stepCount = 8;
    for (let sIdx = 0; sIdx < stepCount; sIdx++) {
      const stepT = (sIdx + 1) / stepCount;
      const step = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.14, 0.38), furnitureWoodMat);
      step.position.set(-halfW + 0.75, floorY + stepT * 2.45, 2.2 - sIdx * 0.42);
      step.castShadow = true;
      root.add(step);
    }

    // Two Cozy Upstairs Inn Beds on the Loft
    const quiltMat1 = new THREE.MeshStandardMaterial({ color: '#B91C1C', roughness: 0.8 });
    const quiltMat2 = new THREE.MeshStandardMaterial({ color: '#1D4ED8', roughness: 0.8 });
    const pillowMat = new THREE.MeshStandardMaterial({ color: '#F8FAFC', roughness: 0.75 });
    for (let b = 0; b < 2; b++) {
      const bx = -halfW + 1.25 + b * 1.85;
      const bz = -halfD + 1.45;
      const bedFrame = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.34, 1.95), timberMat);
      bedFrame.position.set(bx, loftY + 0.22, bz);
      const mattress = new THREE.Mesh(
        new THREE.BoxGeometry(1.04, 0.18, 1.82),
        b === 0 ? quiltMat1 : quiltMat2
      );
      mattress.position.set(bx, loftY + 0.42, bz);
      const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.12, 0.38), pillowMat);
      pillow.position.set(bx, loftY + 0.54, bz - 0.64);
      root.add(bedFrame, mattress, pillow);
    }
  } else if (spec.buildingType === 'blacksmith') {
    // A. Roaring Red-Hot Coal Forge with Chimney Hood & Bellows
    const forgeHearth = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.25, 2.2), darkStoneMat);
    forgeHearth.position.set(-2.3, floorY + 0.62, -2.5);
    forgeHearth.castShadow = true;
    const forgeHood = new THREE.Mesh(new THREE.ConeGeometry(1.65, 1.85, 4), stoneMat);
    forgeHood.position.set(-2.3, floorY + 2.65, -2.5);
    forgeHood.rotation.y = Math.PI / 4;
    const redHotCoals = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.75, 1),
      new THREE.MeshStandardMaterial({
        color: '#FF5722',
        emissive: '#FF2A00',
        emissiveIntensity: 2.4,
        roughness: 0.3,
      })
    );
    redHotCoals.scale.set(1.2, 0.45, 1.1);
    redHotCoals.position.set(-2.3, floorY + 1.28, -2.45);
    root.add(forgeHearth, forgeHood, redHotCoals);

    // B. Heavy Iron Anvil on Oak Stump with Glowing Red-Hot Metal Blade
    const anvilStump = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.52, 0.64, 10), timberMat);
    anvilStump.position.set(-0.4, floorY + 0.32, -0.8);
    const anvilBody = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.38, 0.42), ironMat);
    anvilBody.position.set(-0.4, floorY + 0.82, -0.8);
    anvilBody.castShadow = true;
    const anvilHorn = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.45, 6), ironMat);
    anvilHorn.rotation.z = -Math.PI / 2;
    anvilHorn.position.set(0.22, floorY + 0.85, -0.8);

    const hotMetalMat = new THREE.MeshStandardMaterial({
      color: '#FFAB40',
      emissive: '#FF3D00',
      emissiveIntensity: 2.6,
      roughness: 0.25,
    });
    const hotBlade = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.06, 0.14), hotMetalMat);
    hotBlade.position.set(-0.35, floorY + 1.04, -0.8);
    root.add(anvilStump, anvilBody, anvilHorn, hotBlade);

    // C. Animated Blacksmith Forging with a Large Hammer & Flying Sparks!
    const smith = buildMiniVillagerFigure({
      tunicColor: '#44403C',
      hairColor: '#1C1917',
      skinColor: '#E0AC8B',
      apronColor: '#5C3419',
    });
    smith.root.position.set(-0.4, floorY, -1.62);
    smith.root.rotation.y = 0; // faces +Z toward the anvil

    // Large Two-Pound Forging Hammer attached to smith's right arm
    const hammerGroup = new THREE.Group();
    hammerGroup.position.set(0, -0.4, 0.08);
    const hShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 0.68, 8), timberMat);
    hShaft.rotation.x = Math.PI / 2;
    hShaft.position.z = 0.26;
    const hHead = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.34, 0.22), ironMat);
    hHead.position.set(0, 0, 0.56);
    hammerGroup.add(hShaft, hHead);
    smith.armR.add(hammerGroup);

    // Tongs in smith's left hand gripping the glowing metal
    const tongs = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.58, 6), ironMat);
    tongs.rotation.x = Math.PI / 2;
    tongs.position.set(0, -0.38, 0.28);
    smith.armL.rotation.x = -0.95;
    smith.armL.add(tongs);
    root.add(smith.root);

    // Flying Spark Particles bursting from the anvil impact point
    const sparksGroup = new THREE.Group();
    sparksGroup.position.set(-0.35, floorY + 1.06, -0.8);
    const sparkMat = new THREE.MeshBasicMaterial({ color: '#FDE047' });
    const sparkDirections: [number, number, number][] = [];
    for (let sp = 0; sp < 14; sp++) {
      const ang = (sp / 14) * Math.PI * 2;
      const spMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), sparkMat);
      sparksGroup.add(spMesh);
      sparkDirections.push([
        Math.cos(ang) * (0.45 + (sp % 3) * 0.22),
        0.55 + (sp % 4) * 0.25,
        Math.sin(ang) * (0.45 + ((sp + 1) % 3) * 0.22),
      ]);
    }
    root.add(sparksGroup);

    root.userData.blacksmithHammerer = {
      armR: smith.armR,
      torso: smith.torso,
      head: smith.head,
      hotBlade,
      sparksGroup,
      sparkDirections,
    };

    // D. Weapon Racks, Quenching Barrel & Workbenches
    const quenchBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.4, 0.88, 10), furnitureWoodMat);
    quenchBarrel.position.set(1.1, floorY + 0.44, -1.2);
    const weaponRack = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.55, 0.45), timberMat);
    weaponRack.position.set(2.8, floorY + 0.78, -halfD + 0.55);
    root.add(quenchBarrel, weaponRack);
    addTableWithBenches(2.9, 1.4, 2.2, 1.0, true);
  } else {
    // Cottage, Stone Temple, Sci-Fi Outpost, or Modern Lodge Interior Furnishings
    addTableWithBenches(-2.1, -0.6, 2.2, 1.05, true);
    addTableWithBenches(2.2, 1.2, 2.0, 0.95, true);

    if (isTemple) {
      // Glowing Rune Altar in back center
      const altar = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.35, 0.92, 8), stoneMat);
      altar.position.set(0, floorY + 0.46, -2.4);
      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.45, 0),
        new THREE.MeshStandardMaterial({ color: '#34D399', emissive: '#10B981', emissiveIntensity: 1.5 })
      );
      crystal.position.set(0, floorY + 1.45, -2.4);
      crystal.userData.floatSpin = true;
      root.add(altar, crystal);
    } else if (isScifi) {
      // Holographic Command Projector Table
      const holoBase = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.35, 0.85, 12), stoneMat);
      holoBase.position.set(0, floorY + 0.42, -1.8);
      const holoGlobe = new THREE.Mesh(
        new THREE.SphereGeometry(0.62, 14, 12),
        new THREE.MeshStandardMaterial({
          color: '#38BDF8',
          emissive: '#0284C7',
          emissiveIntensity: 1.4,
          wireframe: true,
        })
      );
      holoGlobe.position.set(0, floorY + 1.38, -1.8);
      holoGlobe.userData.floatSpin = true;
      root.add(holoBase, holoGlobe);
    } else {
      // Cozy Fireplace & Bookshelf for Cottage / Modern Lodge
      const hearth = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.2, 1.05), stoneMat);
      hearth.position.set(0, floorY + 1.1, -halfD + 0.62);
      const embers = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 0), lanternGlowMat);
      embers.position.set(0, floorY + 0.38, -halfD + 0.96);
      root.add(hearth, embers);
    }
  }

  // 6. Pitched Intact Roof Group (kept visible in 'close' interior camera with dormers & stone chimney)
  const cutawayRoofGroup = new THREE.Group();
  const roofPeakH = spec.buildingType === 'tavern' ? 3.2 : 2.6;
  const roofCone = new THREE.Mesh(
    new THREE.ConeGeometry(Math.max(halfW, halfD) * 1.46, roofPeakH, 4),
    roofMat
  );
  roofCone.position.y = floorY + wallH + roofPeakH * 0.48;
  roofCone.rotation.y = Math.PI / 4;
  roofCone.scale.set((halfW + 0.55) / Math.max(halfW, halfD), 1, (halfD + 0.55) / Math.max(halfW, halfD));
  roofCone.castShadow = true;
  cutawayRoofGroup.add(roofCone);

  // Pitched Dormer Windows along front roof slope for classic fantasy village silhouette
  if (!isScifi && !isModern && !isTemple) {
    const dormerOffsets = spec.buildingType === 'tavern' ? [-2.2, 2.2] : [0];
    for (const dx of dormerOffsets) {
      const dBox = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.95, 1.3), wallMat);
      dBox.position.set(dx, floorY + wallH + 0.68, halfD * 0.62);
      dBox.castShadow = true;
      const dRoof = new THREE.Mesh(new THREE.ConeGeometry(0.95, 0.68, 4), roofMat);
      dRoof.rotation.y = Math.PI / 4;
      dRoof.position.set(dx, floorY + wallH + 1.44, halfD * 0.62);
      const dPane = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.55, 0.1), windowGlassMat);
      dPane.position.set(dx, floorY + wallH + 0.72, halfD * 0.62 + 0.64);
      cutawayRoofGroup.add(dBox, dRoof, dPane);
    }
  }

  const chimney = new THREE.Mesh(new THREE.BoxGeometry(1.05, 2.5, 1.05), stoneMat);
  chimney.position.set(-halfW * 0.52, floorY + wallH + 1.5, -halfD * 0.52);
  chimney.castShadow = true;
  const chimneyCap = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.16, 1.25), darkStoneMat);
  chimneyCap.position.set(-halfW * 0.52, floorY + wallH + 2.78, -halfD * 0.52);
  cutawayRoofGroup.add(chimney, chimneyCap);

  // Hanging Building Signboard above Front Entrance
  const signBoard = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.58, 0.14), goldMat);
  signBoard.position.set(0, floorY + wallH - 0.15, halfD + 0.32);
  root.add(signBoard, cutawayRoofGroup);

  root.userData.walkInBuilding = true;
  root.userData.walkInSpec = spec;
  root.userData.cutawayRoofGroup = cutawayRoofGroup;
  root.userData.frontDoorPivot = frontDoorPivot;
  return root;
}

export function updateRpgLivingVillageAnimations(mesh: THREE.Object3D, elapsed: number): void {
  const ud = mesh.userData;
  if (!ud) return;

  // 1. Blacksmith hammering red-hot metal over the forge with flying sparks bursting on impact
  if (ud.blacksmithHammerer) {
    const bh = ud.blacksmithHammerer as {
      armR: THREE.Group;
      torso: THREE.Group;
      head: THREE.Group;
      hotBlade: THREE.Mesh;
      sparksGroup: THREE.Group;
      sparkDirections: [number, number, number][];
    };
    const cyclePeriod = 1.15;
    const phase = (elapsed % cyclePeriod) / cyclePeriod; // 0 -> 1
    // Wind up from 0..0.55, rapid downward hammer strike 0.55..0.72, rebound 0.72..1.0
    let armAngle = -0.95;
    let torsoLean = 0;
    if (phase < 0.55) {
      const u = phase / 0.55;
      armAngle = -0.95 - Math.sin(u * Math.PI * 0.5) * 1.15; // raise hammer high
      torsoLean = -u * 0.14;
    } else if (phase < 0.72) {
      const u = (phase - 0.55) / 0.17;
      armAngle = -2.1 + u * 1.55; // slam down onto anvil
      torsoLean = -0.14 + u * 0.34;
    } else {
      const u = (phase - 0.72) / 0.28;
      armAngle = -0.55 - u * 0.4;
      torsoLean = 0.2 * (1 - u);
    }
    bh.armR.rotation.x = armAngle;
    bh.torso.rotation.x = torsoLean;

    // Spark burst starts at phase = 0.70 when hammer strikes the glowing blade
    const sparksVisible = phase >= 0.68 || phase < 0.18;
    bh.sparksGroup.visible = sparksVisible;
    if (sparksVisible) {
      const burstT = phase >= 0.68 ? (phase - 0.68) / 0.32 : 0.6 + phase * 2.0;
      const children = bh.sparksGroup.children;
      for (let i = 0; i < children.length; i++) {
        const sp = children[i];
        const dir = bh.sparkDirections[i] ?? [0.4, 0.6, 0.4];
        sp.position.set(
          dir[0] * burstT * 1.35,
          dir[1] * burstT * 1.1 - burstT * burstT * 1.45,
          dir[2] * burstT * 1.35
        );
        const sc = Math.max(0.05, 1.25 - burstT * 0.95);
        sp.scale.setScalar(sc);
      }
    }
    // Pulse red-hot blade emissive glow on strike
    const mat = bh.hotBlade.material as THREE.MeshStandardMaterial;
    if (mat && 'emissiveIntensity' in mat) {
      mat.emissiveIntensity = phase >= 0.68 && phase <= 0.85 ? 3.8 : 2.3 + Math.sin(elapsed * 8) * 0.3;
    }
  }

  // 2. Tavern seated patrons chatting & toasting mugs + Bartender behind the bar
  if (ud.tavernPatrons) {
    const patrons = ud.tavernPatrons as { head: THREE.Group; armR: THREE.Group; phase: number }[];
    for (let i = 0; i < patrons.length; i++) {
      const p = patrons[i];
      p.head.rotation.y = Math.sin(elapsed * 1.7 + p.phase) * 0.28;
      p.head.rotation.x = Math.cos(elapsed * 2.3 + p.phase) * 0.08;
      const toastWave = Math.max(0, Math.sin(elapsed * 1.4 + p.phase));
      p.armR.rotation.x = -0.85 - toastWave * 0.52;
    }
  }
  if (ud.bartenderNpc) {
    const bt = ud.bartenderNpc as { root: THREE.Group; head: THREE.Group; armR: THREE.Group };
    bt.root.rotation.y = Math.sin(elapsed * 0.9) * 0.35;
    bt.head.rotation.y = Math.cos(elapsed * 1.5) * 0.25;
    bt.armR.rotation.z = Math.sin(elapsed * 4.5) * 0.22;
  }

  // 3. Villager raking their yard
  if (ud.rakingVillager) {
    const rv = ud.rakingVillager as {
      torso: THREE.Group;
      armL: THREE.Group;
      armR: THREE.Group;
      rakePivot: THREE.Group;
    };
    const sweep = Math.sin(elapsed * 2.8);
    rv.torso.rotation.y = sweep * 0.24;
    rv.torso.rotation.x = 0.12 + Math.abs(sweep) * 0.08;
    rv.rakePivot.rotation.x = sweep * 0.28;
    rv.rakePivot.rotation.z = Math.cos(elapsed * 2.8) * 0.16;
  }

  // 4. Tethered saddle horses outside the tavern
  if (ud.tetheredHorses) {
    const horses = ud.tetheredHorses as {
      headPivot: THREE.Group;
      tailPivot: THREE.Group;
      phase: number;
    }[];
    for (let i = 0; i < horses.length; i++) {
      const h = horses[i];
      h.headPivot.rotation.x = Math.sin(elapsed * 1.6 + h.phase) * 0.14;
      h.headPivot.rotation.y = Math.cos(elapsed * 1.1 + h.phase) * 0.1;
      h.tailPivot.rotation.z = Math.sin(elapsed * 3.2 + h.phase) * 0.26;
    }
  }

  // 5. River Sawmill Waterwheel & Hilltop Windmill Lattice Sails
  if (ud.spinningWaterwheel) {
    (ud.spinningWaterwheel as THREE.Group).rotation.x = elapsed * 1.15;
  }
  if (ud.spinningWindmillRotor) {
    (ud.spinningWindmillRotor as THREE.Group).rotation.z = elapsed * 0.85;
  }

  // 6. Pasture Livestock (Grazing Cows & Rooting Pigs)
  if (ud.grazingCow) {
    const gc = ud.grazingCow as { headPivot: THREE.Group; tailPivot: THREE.Group; phase: number };
    gc.headPivot.rotation.x = 0.24 + Math.sin(elapsed * 1.2 + gc.phase) * 0.18;
    gc.tailPivot.rotation.z = Math.sin(elapsed * 2.8 + gc.phase) * 0.24;
  }
  if (ud.rootingPig) {
    const rp = ud.rootingPig as { headPivot: THREE.Group; phase: number };
    rp.headPivot.rotation.x = 0.18 + Math.sin(elapsed * 3.2 + rp.phase) * 0.16;
    rp.headPivot.rotation.y = Math.cos(elapsed * 1.7 + rp.phase) * 0.12;
  }
}


function buildRpgCustomPropOrBuildingMesh(entity: LevelEntity): THREE.Group | null {
  const lowerName = entity.name.toLowerCase();
  const lowerNotes = (entity.notes ?? '').toLowerCase();

  // Check if this prop is a Full-Sized Walk-In Building (Medieval, Modern, or Sci-Fi)
  const walkInSpec = getWalkInBuildingSpec(entity);
  if (walkInSpec) {
    return buildWalkInBuildingMesh(entity, walkInSpec);
  }

  const isRpg =
    lowerNotes.includes('rpg') ||
    isRopeBridgeEntity(entity) ||
    isStoneArchBridgeEntity(entity) ||
    lowerName.includes('cutaway') ||
    lowerName.includes('weathered stone') ||
    lowerName.includes('stone path') ||
    lowerName.includes('wandering chicken') ||
    lowerName.includes('chicken') ||
    lowerName.includes('village well') ||
    lowerName.includes('stone well') ||
    lowerName.includes('hollow magic tree') ||
    lowerName.includes('tropical') ||
    lowerName.includes('distressed') ||
    lowerName.includes('fence') ||
    lowerName.includes('hanging lamp') ||
    lowerName.includes('lamp post') ||
    lowerNotes.includes('hanginglamppost') ||
    lowerName.includes('horse') ||
    lowerNotes.includes('tetheredhorses') ||
    lowerName.includes('raking') ||
    lowerNotes.includes('rakingvillager') ||
    lowerName.includes('watermill') ||
    lowerName.includes('sawmill') ||
    lowerNotes.includes('watermill') ||
    lowerName.includes('windmill') ||
    lowerNotes.includes('windmill') ||
    lowerName.includes('market stall') ||
    lowerNotes.includes('marketstall') ||
    lowerName.includes('crossroads signpost') ||
    lowerNotes.includes('crossroadssignpost') ||
    lowerName.includes('cow') ||
    lowerName.includes('pig');

  if (!isRpg) return null;

  const root = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: '#6E737B', roughness: 0.9 });
  const darkStoneMat = new THREE.MeshStandardMaterial({ color: '#4B5058', roughness: 0.92 });
  const mossMat = new THREE.MeshStandardMaterial({ color: '#3F6E38', roughness: 0.88 });
  const timberMat = new THREE.MeshStandardMaterial({ color: '#5A3A22', roughness: 0.85 });
  const weatheredWoodMat = new THREE.MeshStandardMaterial({ color: '#7D583A', roughness: 0.88 });
  const plasterMat = new THREE.MeshStandardMaterial({ color: entity.styleTint ?? '#DFD3BE', roughness: 0.82 });
  const roofMat = new THREE.MeshStandardMaterial({ color: '#6E3224', roughness: 0.82 });
  const warmGlowMat = new THREE.MeshStandardMaterial({
    color: '#FFB74D',
    emissive: '#FF8F00',
    emissiveIntensity: 1.45,
    roughness: 0.25,
  });

  // 1. Cutaway Isometric Interior Diorama
  if (
    lowerNotes.includes('interior') ||
    lowerName.includes('cutaway') ||
    lowerName.includes('interior')
  ) {
    const isCave = lowerNotes.includes('cave') || lowerName.includes('cave');
    const wallMat = isCave ? darkStoneMat : plasterMat;
    const floorMat = isCave
      ? new THREE.MeshStandardMaterial({ color: '#3D4047', roughness: 0.92 })
      : weatheredWoodMat;

    const floor = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.18, 7.6), floorMat);
    floor.position.y = 0.09;
    floor.receiveShadow = true;
    root.add(floor);

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(7.6, 2.8, 0.28), wallMat);
    backWall.position.set(0, 1.48, -3.66);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.8, 7.6), wallMat);
    leftWall.position.set(-3.66, 1.48, 0);
    leftWall.castShadow = true;
    leftWall.receiveShadow = true;
    root.add(backWall, leftWall);

    const hearth = new THREE.Mesh(new THREE.BoxGeometry(1.65, 1.85, 0.82), stoneMat);
    hearth.position.set(-1.1, 0.98, -3.15);
    hearth.castShadow = true;
    const fireEmbers = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 0), warmGlowMat);
    fireEmbers.position.set(-1.1, 0.42, -2.85);
    root.add(hearth, fireEmbers);

    const tableTop = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.12, 1.15), timberMat);
    tableTop.position.set(0.85, 0.76, 0.45);
    tableTop.castShadow = true;
    root.add(tableTop);
    return root;
  }

  // 2. River-Spanning Wooden Slat & Rope Bridge (13.6m span along Z axis across the water gorge)
  if (isRopeBridgeEntity(entity)) {
    const ropeMat = new THREE.MeshStandardMaterial({ color: '#A38655', roughness: 0.92 });
    const halfSpan = 6.8;
    const halfWidth = 1.82;

    // 4 heavy timber anchor bents on the north and south cliff banks + mid-span posts
    for (const pz of [-halfSpan + 0.3, -halfSpan * 0.48, 0, halfSpan * 0.48, halfSpan - 0.3]) {
      const u = Math.min(1, Math.abs(pz) / halfSpan);
      const camberY = (1 - u * u) * 0.28;
      for (const px of [-halfWidth, halfWidth]) {
        const isEndPost = Math.abs(pz) > halfSpan - 0.8;
        const postH = isEndPost ? 1.75 : 1.18;
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(isEndPost ? 0.15 : 0.09, isEndPost ? 0.18 : 0.11, postH, 8),
          timberMat
        );
        post.position.set(px, camberY + postH * 0.48, pz);
        post.rotation.z = px > 0 ? -0.04 : 0.04;
        post.castShadow = true;
        root.add(post);
      }
    }

    // Arched bottom deck cables & upper rope handrails running along both sides
    const segs = 14;
    for (const sideX of [-halfWidth, halfWidth]) {
      for (let i = 0; i < segs; i++) {
        const z0 = -halfSpan + (i / segs) * (halfSpan * 2);
        const z1 = -halfSpan + ((i + 1) / segs) * (halfSpan * 2);
        const zm = (z0 + z1) * 0.5;
        const u = Math.min(1, Math.abs(zm) / halfSpan);
        const camberY = (1 - u * u) * 0.28;
        const segLen = (halfSpan * 2) / segs + 0.06;

        const deckCable = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, segLen, 7), ropeMat);
        deckCable.rotation.x = Math.PI / 2;
        deckCable.position.set(sideX, camberY + 0.1, zm);

        const handrail = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, segLen, 7), ropeMat);
        handrail.rotation.x = Math.PI / 2;
        handrail.position.set(sideX, camberY + 1.05, zm);
        root.add(deckCable, handrail);
      }
    }

    // 26 Weathered Wooden Slats across the 13.6m bridge span (with broken/splintered slats for realism)
    const slatCount = 26;
    for (let i = 0; i < slatCount; i++) {
      const sz = -halfSpan + 0.35 + (i / (slatCount - 1)) * (halfSpan * 2 - 0.7);
      const u = Math.min(1, Math.abs(sz) / halfSpan);
      const deckY = (1 - u * u) * 0.28 + 0.14;
      const mat = i % 2 === 0 ? weatheredWoodMat : timberMat;

      if (i === 9 || i === 17) {
        // Broken / splintered wooden slat with a gap in the middle showing the rushing water below
        const leftPiece = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.1, 0.42), mat);
        leftPiece.position.set(-1.02, deckY - 0.01, sz);
        leftPiece.rotation.set(0.05, 0.08, -0.07);
        leftPiece.castShadow = true;
        const rightPiece = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.1, 0.4), mat);
        rightPiece.position.set(1.06, deckY - 0.02, sz);
        rightPiece.rotation.set(-0.06, -0.09, 0.08);
        rightPiece.castShadow = true;
        root.add(leftPiece, rightPiece);
      } else {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2 + 0.15, 0.11, 0.44), mat);
        slat.position.set(0, deckY, sz);
        slat.rotation.set((i % 3 - 1) * 0.018, (i % 2 === 0 ? 1 : -1) * 0.022, (i % 5 - 2) * 0.01);
        slat.castShadow = true;
        slat.receiveShadow = true;
        root.add(slat);
      }
    }
    return root;
  }

  // 3. Village Hanging Lamp on Curved Timber & Iron Post
  if (
    lowerName.includes('hanging lamp') ||
    lowerName.includes('lamp post') ||
    lowerName.includes('streetlamp') ||
    lowerNotes.includes('hanginglamppost')
  ) {
    const ironMat = new THREE.MeshStandardMaterial({ color: '#27272A', roughness: 0.4, metalness: 0.78 });
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 0.38, 8), stoneMat);
    plinth.position.y = 0.19;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 3.1, 8), timberMat);
    post.position.y = 1.72;
    post.castShadow = true;
    const crossArm = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.11, 0.11), timberMat);
    crossArm.position.set(0.42, 3.12, 0);
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.09, 0.09), timberMat);
    brace.position.set(0.26, 2.86, 0);
    brace.rotation.z = Math.PI / 4;

    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.34, 6), ironMat);
    chain.position.set(0.84, 2.92, 0);
    const lanternCage = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.36, 6), warmGlowMat);
    lanternCage.position.set(0.84, 2.62, 0);
    const lanternCap = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.16, 6), ironMat);
    lanternCap.position.set(0.84, 2.86, 0);

    const coneMat = new THREE.MeshBasicMaterial({
      color: '#FFCC66',
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const lightCone = new THREE.Mesh(new THREE.ConeGeometry(1.65, 2.6, 16, 1, true), coneMat);
    lightCone.position.set(0.84, 1.3, 0);

    root.add(plinth, post, crossArm, brace, chain, lanternCage, lanternCap, lightCone);
    return root;
  }

  // 4. Tethered Saddle Horses at Hitching Post & Water Trough (Outside Tavern)
  if (lowerName.includes('horse') || lowerNotes.includes('tetheredhorses')) {
    const ropeMat = new THREE.MeshStandardMaterial({ color: '#A38655', roughness: 0.9 });
    // Hitching rail & water trough
    for (const px of [-1.35, 1.35]) {
      const hPost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.095, 1.15, 7), timberMat);
      hPost.position.set(px, 0.57, -0.78);
      hPost.castShadow = true;
      root.add(hPost);
    }
    const hRail = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 2.9, 7), weatheredWoodMat);
    hRail.rotation.z = Math.PI / 2;
    hRail.position.set(0, 1.02, -0.78);
    const trough = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.42, 0.54), timberMat);
    trough.position.set(0, 0.21, -1.18);
    const troughWater = new THREE.Mesh(
      new THREE.BoxGeometry(1.12, 0.06, 0.42),
      new THREE.MeshStandardMaterial({ color: '#0284C7', roughness: 0.18 })
    );
    troughWater.position.set(0, 0.39, -1.18);
    root.add(hRail, trough, troughWater);

    // Build two sculpted horses (Bay & Chestnut) with saddle, bridle, mane & tail
    const horseAnims: { headPivot: THREE.Group; tailPivot: THREE.Group; phase: number }[] = [];
    const horseSpecs = [
      { x: -0.78, coat: '#6B3410', mane: '#1F1209', saddle: '#3F2312', phase: 0 },
      { x: 0.78, coat: '#9A5B2C', mane: '#F3E5AB', saddle: '#4A2511', phase: 1.9 },
    ];
    for (const hs of horseSpecs) {
      const hGroup = new THREE.Group();
      hGroup.position.set(hs.x, 0, 0.15);
      const coatMat = new THREE.MeshStandardMaterial({ color: hs.coat, roughness: 0.74 });
      const maneMat = new THREE.MeshStandardMaterial({ color: hs.mane, roughness: 0.85 });
      const saddleMat = new THREE.MeshStandardMaterial({ color: hs.saddle, roughness: 0.65 });
      const hoofMat = new THREE.MeshStandardMaterial({ color: '#1C1917', roughness: 0.6 });

      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 1.28, 10), coatMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 1.05, 0);
      barrel.castShadow = true;
      const chest = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 10), coatMat);
      chest.position.set(0, 1.06, -0.52);
      const rump = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 10), coatMat);
      rump.position.set(0, 1.07, 0.52);

      const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.18, 0.56), saddleMat);
      saddle.position.set(0, 1.36, -0.04);
      hGroup.add(barrel, chest, rump, saddle);

      // Four horse legs & hooves
      for (const [lx, lz] of [
        [-0.19, -0.48],
        [0.19, -0.48],
        [-0.2, 0.48],
        [0.2, 0.48],
      ]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.055, 0.88, 8), coatMat);
        leg.position.set(lx, 0.48, lz);
        leg.castShadow = true;
        const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 8), hoofMat);
        hoof.position.set(lx, 0.06, lz);
        hGroup.add(leg, hoof);
      }

      // Neck & Head Pivot (facing -Z toward the hitching rail)
      const headPivot = new THREE.Group();
      headPivot.position.set(0, 1.24, -0.62);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.68, 8), coatMat);
      neck.position.set(0, 0.26, -0.18);
      neck.rotation.x = -0.55;
      const mane = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.58, 0.16), maneMat);
      mane.position.set(0, 0.3, -0.05);
      mane.rotation.x = -0.55;
      const skull = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.48), coatMat);
      skull.position.set(0, 0.52, -0.44);
      skull.rotation.x = 0.35;
      for (const ex of [-0.09, 0.09]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.15, 5), coatMat);
        ear.position.set(ex, 0.69, -0.28);
        headPivot.add(ear);
      }
      headPivot.add(neck, mane, skull);
      hGroup.add(headPivot);

      // Swishing Tail Pivot
      const tailPivot = new THREE.Group();
      tailPivot.position.set(0, 1.18, 0.82);
      const tailMesh = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.68, 7), maneMat);
      tailMesh.position.set(0, -0.28, 0.14);
      tailMesh.rotation.x = 2.65;
      tailPivot.add(tailMesh);
      hGroup.add(tailPivot);

      // Rope lead tying horse to hitching rail
      const ropeLead = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.72, 6), ropeMat);
      ropeLead.position.set(hs.x, 1.22, -0.68);
      ropeLead.rotation.x = 0.75;
      root.add(hGroup, ropeLead);

      horseAnims.push({ headPivot, tailPivot, phase: hs.phase });
    }
    root.userData.tetheredHorses = horseAnims;
    return root;
  }

  // 5. Villager Raking Their Yard (with animated wooden rake & leaf pile)
  if (lowerName.includes('raking') || lowerNotes.includes('rakingvillager')) {
    const villager = buildMiniVillagerFigure({
      tunicColor: '#3F6212',
      hairColor: '#713F12',
      apronColor: '#D6D3D1',
      hatColor: '#EAB308',
    });
    root.add(villager.root);

    // Long wooden yard rake held across hands
    const rakePivot = new THREE.Group();
    rakePivot.position.set(0.12, 1.05, 0.22);
    const rakeHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.48, 7), weatheredWoodMat);
    rakeHandle.position.set(0, -0.35, 0.25);
    rakeHandle.rotation.x = 0.45;
    const rakeBar = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.06, 0.06), timberMat);
    rakeBar.position.set(0, -0.96, 0.56);
    rakePivot.add(rakeHandle, rakeBar);
    for (let t = -3; t <= 3; t++) {
      const tine = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.008, 0.14, 5), timberMat);
      tine.position.set(t * 0.085, -1.02, 0.56);
      rakePivot.add(tine);
    }
    villager.armL.rotation.x = -0.75;
    villager.armR.rotation.x = -0.85;
    root.add(rakePivot);

    // Small pile of raked golden-autumn leaves in front of villager
    const leafColors = ['#D97706', '#B45309', '#65A30D', '#CA8A04'];
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.15 + (i % 3) * 0.04, 0),
        new THREE.MeshStandardMaterial({ color: leafColors[i % leafColors.length], roughness: 0.9 })
      );
      leaf.scale.set(1.3, 0.35, 1.2);
      leaf.position.set(-0.25 + (i % 3) * 0.24, 0.05, 0.72 + Math.floor(i / 3) * 0.18);
      root.add(leaf);
    }

    root.userData.rakingVillager = {
      torso: villager.torso,
      armL: villager.armL,
      armR: villager.armR,
      rakePivot,
    };
    return root;
  }

  // 6. Weathered Broken Organic Stone Path
  if (lowerName.includes('weathered stone') || lowerNotes.includes('weatheredstone') || lowerName.includes('stone path')) {
    const offsets = [
      { x: -0.78, z: -0.15, r: 0.44, sides: 6, rot: 0.2, y: 0.05 },
      { x: -0.22, z: 0.18, r: 0.52, sides: 7, rot: 0.85, y: 0.06 },
      { x: 0.36, z: -0.12, r: 0.48, sides: 6, rot: 1.4, y: 0.055 },
      { x: 0.88, z: 0.14, r: 0.42, sides: 5, rot: 2.1, y: 0.045 },
      { x: -0.52, z: 0.42, r: 0.24, sides: 5, rot: 0.5, y: 0.04 },
      { x: 0.12, z: -0.44, r: 0.28, sides: 6, rot: 1.8, y: 0.04 },
    ];
    for (let i = 0; i < offsets.length; i++) {
      const o = offsets[i];
      const slab = new THREE.Mesh(
        new THREE.CylinderGeometry(o.r * 0.92, o.r, 0.09, o.sides),
        i % 2 === 0 ? stoneMat : darkStoneMat
      );
      slab.position.set(o.x, o.y, o.z);
      slab.rotation.set((i % 3 - 1) * 0.03, o.rot, ((i + 1) % 3 - 1) * 0.03);
      slab.receiveShadow = true;
      slab.castShadow = true;
      root.add(slab);
    }
    for (const [mx, mz] of [
      [-0.48, 0.02],
      [0.08, 0.05],
      [0.62, -0.02],
    ]) {
      const moss = new THREE.Mesh(new THREE.DodecahedronGeometry(0.11, 0), mossMat);
      moss.scale.set(1.4, 0.35, 1.2);
      moss.position.set(mx, 0.04, mz);
      root.add(moss);
    }
    return root;
  }

  // 7. Distressed Organic Split-Rail Wood Fence (Non-Cube Crooked Timber Logs)
  if (lowerName.includes('fence') || lowerNotes.includes('fence')) {
    for (const px of [-1.05, 0, 1.05]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.098, 1.02, 6), timberMat);
      post.position.set(px, 0.48, (px === 0 ? 1 : -1) * 0.04);
      post.rotation.set((px % 2) * 0.08, px * 0.22, (px === 0 ? -1 : 1) * 0.08);
      post.castShadow = true;
      root.add(post);
    }
    for (const [ry, tiltZ, tiltY] of [
      [0.34, 0.05, 0.04],
      [0.72, -0.06, -0.05],
    ]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.062, 2.35, 6), weatheredWoodMat);
      rail.rotation.set(tiltY, 0, Math.PI / 2 + tiltZ);
      rail.position.set(0, ry, 0.04);
      rail.castShadow = true;
      root.add(rail);
    }
    return root;
  }

  // 8. Village Stone Well with Timber Roof & Hanging Bucket
  if (lowerName.includes('well') || lowerNotes.includes('well')) {
    const wellWall = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.68, 0.62, 12), stoneMat);
    wellWall.position.y = 0.31;
    wellWall.castShadow = true;
    const waterDisc = new THREE.Mesh(
      new THREE.CircleGeometry(0.5, 12),
      new THREE.MeshStandardMaterial({ color: '#0284C7', roughness: 0.15, metalness: 0.2 })
    );
    waterDisc.rotation.x = -Math.PI / 2;
    waterDisc.position.y = 0.56;
    root.add(wellWall, waterDisc);

    for (const sx of [-0.54, 0.54]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 1.35, 7), timberMat);
      post.position.set(sx, 0.95, 0);
      post.castShadow = true;
      root.add(post);
    }
    const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.15, 8), weatheredWoodMat);
    spindle.rotation.z = Math.PI / 2;
    spindle.position.y = 1.25;
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.22, 8), timberMat);
    bucket.position.set(0, 0.88, 0);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.88, 0.62, 4), roofMat);
    roof.position.y = 1.82;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    root.add(spindle, bucket, roof);
    return root;
  }

  // 9. Wandering Village Chicken
  if (lowerName.includes('chicken') || lowerNotes.includes('chicken')) {
    const featherMat = new THREE.MeshStandardMaterial({ color: entity.styleTint ?? '#FFFBEB', roughness: 0.8 });
    const combMat = new THREE.MeshStandardMaterial({ color: '#DC2626', roughness: 0.5 });
    const beakMat = new THREE.MeshStandardMaterial({ color: '#F59E0B', roughness: 0.4 });

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 10), featherMat);
    body.scale.set(0.95, 0.88, 1.25);
    body.position.set(0, 0.26, 0);
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 9, 9), featherMat);
    head.position.set(0, 0.43, 0.18);
    const comb = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.09, 0.12), combMat);
    comb.position.set(0, 0.55, 0.18);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.11, 5), beakMat);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.42, 0.32);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 5), featherMat);
    tail.rotation.x = -0.55;
    tail.position.set(0, 0.36, -0.24);
    for (const lx of [-0.07, 0.07]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 5), beakMat);
      leg.position.set(lx, 0.08, 0.02);
      root.add(leg);
    }
    root.add(body, head, comb, beak, tail);
    root.userData.wanderingChicken = true;
    root.userData.wanderPhase = Math.random() * Math.PI * 2;
    return root;
  }

  // 10. Hollow Magic Forest Tree with Inner Arcane Glow
  if (lowerName.includes('hollow') || lowerNotes.includes('hollowmagictree')) {
    const barkMat = new THREE.MeshStandardMaterial({ color: '#3E2A1D', roughness: 0.94 });
    const leafMat = new THREE.MeshStandardMaterial({ color: '#1E4620', roughness: 0.86 });
    const trunk = new THREE.Mesh(
      createOrganicTrunkGeometry({
        rTop: 0.38,
        rBottom: 0.68,
        height: 4.95,
        yOffset: 0,
        radialSegs: 12,
        heightSegs: 7,
        rootFlare: 0.38,
        curveX: 0.12,
      }),
      barkMat
    );
    trunk.castShadow = true;
    const cavity = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.28, 0.85, 8),
      new THREE.MeshBasicMaterial({ color: '#090D16' })
    );
    cavity.position.set(0, 0.68, 0.32);
    const magicCore = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.2, 1),
      new THREE.MeshStandardMaterial({
        color: '#38BDF8',
        emissive: '#0284C7',
        emissiveIntensity: 1.6,
        roughness: 0.15,
      })
    );
    magicCore.position.set(0, 0.75, 0.44);
    magicCore.userData.floatSpin = true;

    const canopy1 = new THREE.Mesh(createSculptedCanopyLobeGeometry(1.45, 1.85, 1.35, 1.05, 4.1, 14, 10, 2.2, 1.6), leafMat);
    canopy1.position.set(0, 4.95, 0);
    canopy1.castShadow = true;
    const canopy2 = new THREE.Mesh(createSculptedCanopyLobeGeometry(1.15, 1.45, 1.15, 0.95, 7.3, 12, 9, 2.1, 1.5), leafMat);
    canopy2.position.set(0.55, 4.55, -0.35);
    canopy2.castShadow = true;
    root.add(trunk, cavity, magicCore, canopy1, canopy2);
    return root;
  }

  // 11. Tropical Jungle Vine Tree (Banyan / Palm with hanging liana vines)
  if (lowerName.includes('tropical') || lowerNotes.includes('tropicaltree')) {
    const barkMat = new THREE.MeshStandardMaterial({ color: '#5C432C', roughness: 0.9 });
    const jungleLeafMat = new THREE.MeshStandardMaterial({ color: '#2D7A32', roughness: 0.78 });
    const vineMat = new THREE.MeshStandardMaterial({ color: '#4D7C0F', roughness: 0.88 });

    const trunk = new THREE.Mesh(
      createOrganicTrunkGeometry({
        rTop: 0.22,
        rBottom: 0.56,
        height: 5.25,
        yOffset: 0,
        radialSegs: 12,
        heightSegs: 8,
        rootFlare: 0.46,
        curveX: 0.18,
        curveZ: -0.12,
      }),
      barkMat
    );
    trunk.castShadow = true;
    root.add(trunk);

    const domes = [
      { x: 0, y: 5.25, z: 0, r: 1.55 },
      { x: 0.85, y: 4.95, z: 0.42, r: 1.15 },
      { x: -0.78, y: 4.88, z: -0.38, r: 1.18 },
    ];
    for (const d of domes) {
      const lobe = new THREE.Mesh(
        createSculptedCanopyLobeGeometry(d.r, d.r * 1.32, d.r * 0.72, 1.1, d.x * 5 + 2.1, 14, 10, 2.3, 1.6),
        jungleLeafMat
      );
      lobe.position.set(d.x, d.y, d.z);
      lobe.castShadow = true;
      root.add(lobe);
    }

    for (const [vx, vz, vh] of [
      [0.68, 0.35, 1.45],
      [-0.62, -0.28, 1.35],
      [0.25, -0.64, 1.55],
      [-0.38, 0.58, 1.25],
    ]) {
      const vine = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.018, vh, 6), vineMat);
      vine.position.set(vx, 4.85 - vh * 0.5, vz);
      vine.rotation.z = vx * 0.08;
      root.add(vine);
    }
    return root;
  }

  // 12. Exotic Giant Jungle Plant / Monstera & Fern Cluster
  if (lowerName.includes('exotic') || lowerName.includes('fern') || lowerName.includes('monstera') || lowerNotes.includes('exoticplant')) {
    const frondMat = new THREE.MeshStandardMaterial({ color: '#16A34A', roughness: 0.72 });
    const bloomMat = new THREE.MeshStandardMaterial({
      color: '#F43F5E',
      emissive: '#E11D48',
      emissiveIntensity: 0.35,
      roughness: 0.4,
    });
    const frondCount = 9;
    for (let i = 0; i < frondCount; i++) {
      const ang = (i / frondCount) * Math.PI * 2;
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.98, 5), frondMat);
      frond.scale.set(1.2, 1, 0.25);
      frond.position.set(Math.cos(ang) * 0.38, 0.38, Math.sin(ang) * 0.38);
      frond.rotation.y = -ang + Math.PI / 2;
      frond.rotation.z = -0.68;
      frond.castShadow = true;
      root.add(frond);
    }
    const bloom = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), bloomMat);
    bloom.position.y = 0.48;
    root.add(bloom);
    return root;
  }

  // 13. Vine-Wrapped Stone Ruin Pillar
  if (lowerName.includes('pillar') || lowerNotes.includes('stonepillar')) {
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.54, 0.26, 7), darkStoneMat);
    plinth.position.y = 0.13;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 1.75, 8), stoneMat);
    shaft.position.y = 1.08;
    shaft.rotation.z = 0.04;
    shaft.castShadow = true;
    const vineWrap = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.055, 6, 14), mossMat);
    vineWrap.position.y = 0.95;
    vineWrap.rotation.x = Math.PI / 2 + 0.35;
    const vineWrap2 = vineWrap.clone();
    vineWrap2.position.y = 1.45;
    vineWrap2.rotation.x = Math.PI / 2 - 0.3;
    root.add(plinth, shaft, vineWrap, vineWrap2);
    return root;
  }

  // 14. Chamfered Ashlar Stone Arch Bridge (15m Z-span across Nottingham River)
  if (isStoneArchBridgeEntity(entity)) {
    const atlas = getTerrainTextureAtlas();
    const ashlarMat = new THREE.MeshStandardMaterial({
      color: '#9AA0A8',
      map: atlas.chamferedAshlarStone,
      roughness: 0.86,
      metalness: 0.05,
    });
    const halfSpan = 7.5;
    const halfWidth = 2.08;
    const segs = 16;

    // Arched stone voussoir deck segments & wing piers reaching into riverbed
    for (let i = 0; i < segs; i++) {
      const z0 = -halfSpan + (i / segs) * (halfSpan * 2);
      const z1 = -halfSpan + ((i + 1) / segs) * (halfSpan * 2);
      const zm = (z0 + z1) * 0.5;
      const u = Math.min(1, Math.abs(zm) / halfSpan);
      const camber = (1 - u * u) * 1.12;
      const deckY = 0.24 + camber;
      const segLen = (halfSpan * 2) / segs + 0.08;
      const tiltX = ((u * 2.24) / halfSpan) * (zm >= 0 ? 1 : -1);

      const deckSlab = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2, 0.42, segLen), ashlarMat);
      deckSlab.position.set(0, deckY - 0.16, zm);
      deckSlab.rotation.x = tiltX;
      deckSlab.castShadow = true;
      deckSlab.receiveShadow = true;
      root.add(deckSlab);

      // Chamfered stone parapets along left and right edge matching terrain.ts colliders
      for (const sideX of [-halfWidth + 0.16, halfWidth - 0.16]) {
        const parapet = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.72, segLen), ashlarMat);
        parapet.position.set(sideX, deckY + 0.34, zm);
        parapet.rotation.x = tiltX;
        parapet.castShadow = true;
        const coping = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, segLen + 0.02), darkStoneMat);
        coping.position.set(sideX, deckY + 0.72, zm);
        coping.rotation.x = tiltX;
        root.add(parapet, coping);
      }
    }

    // Heavy Stone Riverbank Abutment Piers anchoring both ends down into the banks
    for (const endZ of [-halfSpan + 0.85, halfSpan - 0.85]) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2 + 0.45, 3.2, 2.2), darkStoneMat);
      pier.position.set(0, -1.35, endZ);
      pier.castShadow = true;
      pier.receiveShadow = true;
      root.add(pier);
    }

    // 4 Carved Stone Entry Bollards with Warm Iron Lanterns at bridge corners
    const ironMat = new THREE.MeshStandardMaterial({ color: '#27272A', roughness: 0.38, metalness: 0.78 });
    for (const endZ of [-halfSpan + 0.4, halfSpan - 0.4]) {
      for (const sideX of [-halfWidth + 0.14, halfWidth - 0.14]) {
        const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 1.32, 6), ashlarMat);
        bollard.position.set(sideX, 0.82, endZ);
        bollard.castShadow = true;
        const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.26, 6), warmGlowMat);
        lantern.position.set(sideX, 1.58, endZ);
        const cap = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.14, 6), ironMat);
        cap.position.set(sideX, 1.76, endZ);
        root.add(bollard, lantern, cap);
      }
    }
    return root;
  }

  // 15. River Watermill & Timber Sawmill with Rotating Overshot Waterwheel
  if (lowerName.includes('watermill') || lowerName.includes('sawmill') || lowerNotes.includes('watermill')) {
    const millPlinth = new THREE.Mesh(new THREE.BoxGeometry(6.0, 1.8, 5.2), darkStoneMat);
    millPlinth.position.set(0, 0.45, 0);
    millPlinth.castShadow = true;
    millPlinth.receiveShadow = true;
    const millBody = new THREE.Mesh(new THREE.BoxGeometry(5.4, 3.2, 4.6), plasterMat);
    millBody.position.set(0, 2.75, 0);
    millBody.castShadow = true;
    const millRoof = new THREE.Mesh(new THREE.ConeGeometry(4.2, 2.4, 4), roofMat);
    millRoof.rotation.y = Math.PI / 4;
    millRoof.scale.set(1.06, 1, 0.94);
    millRoof.position.set(0, 5.45, 0);
    millRoof.castShadow = true;
    root.add(millPlinth, millBody, millRoof);

    // Timber framing posts & open log-sawing shed awning
    for (const sx of [-2.65, 2.65]) {
      for (const sz of [-2.25, 2.25]) {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(0.26, 3.3, 0.26), timberMat);
        beam.position.set(sx, 2.75, sz);
        root.add(beam);
      }
    }
    const logStackGroup = new THREE.Group();
    logStackGroup.position.set(3.4, 0.28, 0.8);
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3 - row; col++) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 2.4, 8), weatheredWoodMat);
        log.rotation.x = Math.PI / 2;
        log.position.set(col * 0.5 + row * 0.25, row * 0.42, 0);
        log.castShadow = true;
        logStackGroup.add(log);
      }
    }
    root.add(logStackGroup);

    // Spinning Wooden Waterwheel mounted on the river-facing (-X) wall
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(-3.1, 1.35, 0);
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.25, 8), timberMat);
    axle.rotation.z = Math.PI / 2;
    wheelGroup.add(axle);
    const rimOuter = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.12, 7, 16), weatheredWoodMat);
    rimOuter.rotation.y = Math.PI / 2;
    rimOuter.position.x = -0.3;
    const rimInner = rimOuter.clone();
    rimInner.position.x = 0.25;
    wheelGroup.add(rimOuter, rimInner);
    for (let p = 0; p < 10; p++) {
      const ang = (p / 10) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3.1, 0.12), timberMat);
      spoke.rotation.x = ang;
      wheelGroup.add(spoke);
      const paddle = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.08, 0.42), weatheredWoodMat);
      paddle.position.set(-0.02, Math.cos(ang) * 1.55, Math.sin(ang) * 1.55);
      paddle.rotation.x = ang;
      paddle.castShadow = true;
      wheelGroup.add(paddle);
    }
    root.add(wheelGroup);
    root.userData.spinningWaterwheel = wheelGroup;
    return root;
  }

  // 16. Hilltop Timber Windmill Tower with Rotating Lattice Sails
  if (lowerName.includes('windmill') || lowerNotes.includes('windmill')) {
    const stoneBase = new THREE.Mesh(new THREE.CylinderGeometry(2.25, 2.55, 2.1, 8), darkStoneMat);
    stoneBase.position.y = 1.05;
    stoneBase.castShadow = true;
    stoneBase.receiveShadow = true;
    const towerBody = new THREE.Mesh(new THREE.CylinderGeometry(1.52, 2.22, 4.4, 8), plasterMat);
    towerBody.position.y = 4.25;
    towerBody.castShadow = true;
    const capCone = new THREE.Mesh(new THREE.ConeGeometry(1.95, 1.9, 8), roofMat);
    capCone.position.y = 7.35;
    capCone.castShadow = true;
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.65, 0.22), timberMat);
    door.position.set(0, 0.85, 2.32);
    const balcony = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.16, 8), weatheredWoodMat);
    balcony.position.y = 2.18;
    root.add(stoneBase, towerBody, capCone, door, balcony);

    const rotor = new THREE.Group();
    rotor.position.set(0, 5.75, 1.95);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.72, 8), timberMat);
    hub.rotation.x = Math.PI / 2;
    rotor.add(hub);
    const sailMat = new THREE.MeshStandardMaterial({ color: '#F5EFE6', roughness: 0.85 });
    for (let b = 0; b < 4; b++) {
      const armPivot = new THREE.Group();
      armPivot.rotation.z = (b * Math.PI) / 2;
      const spar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 4.1, 0.14), timberMat);
      spar.position.y = 2.05;
      const sail = new THREE.Mesh(new THREE.BoxGeometry(0.95, 3.05, 0.05), sailMat);
      sail.position.set(0.48, 2.25, 0.04);
      sail.castShadow = true;
      armPivot.add(spar, sail);
      rotor.add(armPivot);
    }
    root.add(rotor);
    root.userData.spinningWindmillRotor = rotor;
    return root;
  }

  // 17. Medieval Market Stall with Striped Canopy & Goods Crates
  if (lowerName.includes('market stall') || lowerNotes.includes('marketstall')) {
    const canopyMat1 = new THREE.MeshStandardMaterial({ color: entity.styleTint ?? '#B91C1C', roughness: 0.78 });
    const canopyMat2 = new THREE.MeshStandardMaterial({ color: '#F5F0E1', roughness: 0.8 });
    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.92, 1.05), weatheredWoodMat);
    counter.position.set(0, 0.46, 0);
    counter.castShadow = true;
    root.add(counter);
    for (const sx of [-1.12, 1.12]) {
      for (const sz of [-0.46, 0.46]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 2.25, 6), timberMat);
        post.position.set(sx, 1.12, sz);
        root.add(post);
      }
    }
    for (let stripe = 0; stripe < 5; stripe++) {
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(0.52, 0.08, 1.68),
        stripe % 2 === 0 ? canopyMat1 : canopyMat2
      );
      strip.position.set(-1.04 + stripe * 0.52, 2.22, 0.14);
      strip.rotation.x = 0.22;
      strip.castShadow = true;
      root.add(strip);
    }
    const appleMat = new THREE.MeshStandardMaterial({ color: '#DC2626', roughness: 0.5 });
    for (const [cx, cz] of [[-0.65, 0.12], [0.55, -0.05]]) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.28, 0.52), timberMat);
      crate.position.set(cx, 1.05, cz);
      const goods = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), appleMat);
      goods.position.set(cx, 1.24, cz);
      root.add(crate, goods);
    }
    return root;
  }

  // 18. Forest Crossroads Carved Wooden Signpost
  if (lowerName.includes('crossroads signpost') || lowerNotes.includes('crossroadssignpost')) {
    const cairn = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45, 0), stoneMat);
    cairn.scale.set(1.25, 0.55, 1.15);
    cairn.position.y = 0.18;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.11, 2.35, 7), timberMat);
    post.position.y = 1.18;
    post.castShadow = true;
    root.add(cairn, post);
    const armSpecs = [
      { y: 2.02, rotY: 0.08, tiltZ: 0.04 }, // North: Village & Stone Bridge
      { y: 1.68, rotY: -1.35, tiltZ: -0.05 }, // West: Cursed Caves
      { y: 1.36, rotY: 1.22, tiltZ: 0.03 }, // East: Windmill Hill
    ];
    for (const arm of armSpecs) {
      const boardGroup = new THREE.Group();
      boardGroup.position.set(0, arm.y, 0);
      boardGroup.rotation.set(0, arm.rotY, arm.tiltZ);
      const plank = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.26, 0.08), weatheredWoodMat);
      plank.position.x = 0.48;
      plank.castShadow = true;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.24, 4), weatheredWoodMat);
      tip.rotation.z = -Math.PI / 2;
      tip.position.x = 1.12;
      boardGroup.add(plank, tip);
      root.add(boardGroup);
    }
    return root;
  }

  // 19. Pasture Dairy Cow (with grazing head & tail animation)
  if (lowerName.includes('cow') || lowerNotes.includes('pasturecow')) {
    const hideMat = new THREE.MeshStandardMaterial({ color: '#F8FAFC', roughness: 0.78 });
    const spotMat = new THREE.MeshStandardMaterial({ color: '#1F2937', roughness: 0.8 });
    const hornMat = new THREE.MeshStandardMaterial({ color: '#FDE68A', roughness: 0.5 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.68, 1.32), hideMat);
    torso.position.set(0, 0.78, 0);
    torso.castShadow = true;
    const patch = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.42, 0.58), spotMat);
    patch.position.set(0, 0.84, 0.12);
    root.add(torso, patch);
    for (const [lx, lz] of [[-0.24, -0.48], [0.24, -0.48], [-0.24, 0.48], [0.24, 0.48]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.065, 0.52, 6), hideMat);
      leg.position.set(lx, 0.26, lz);
      leg.castShadow = true;
      root.add(leg);
    }
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.92, 0.66);
    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.46), spotMat);
    skull.position.set(0, -0.02, 0.22);
    const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.2, 0.18), new THREE.MeshStandardMaterial({ color: '#FDA4AF', roughness: 0.7 }));
    muzzle.position.set(0, -0.1, 0.44);
    for (const hx of [-0.22, 0.22]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 5), hornMat);
      horn.position.set(hx, 0.2, 0.14);
      horn.rotation.z = hx > 0 ? -0.5 : 0.5;
      headPivot.add(horn);
    }
    headPivot.add(skull, muzzle);
    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, 0.96, -0.68);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.52, 5), spotMat);
    tail.position.y = -0.24;
    tailPivot.add(tail);
    root.add(headPivot, tailPivot);
    root.userData.grazingCow = { headPivot, tailPivot, phase: Math.random() * Math.PI * 2 };
    return root;
  }

  // 20. Pasture Farm Pig (with snout-rooting animation)
  if (lowerName.includes('pig') || lowerNotes.includes('pasturepig')) {
    const pinkMat = new THREE.MeshStandardMaterial({ color: '#F9A8D4', roughness: 0.72 });
    const snoutMat = new THREE.MeshStandardMaterial({ color: '#F472B6', roughness: 0.65 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), pinkMat);
    body.scale.set(0.95, 0.86, 1.38);
    body.position.set(0, 0.42, 0);
    body.castShadow = true;
    root.add(body);
    for (const [lx, lz] of [[-0.16, -0.26], [0.16, -0.26], [-0.16, 0.26], [0.16, 0.26]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.26, 6), pinkMat);
      leg.position.set(lx, 0.13, lz);
      root.add(leg);
    }
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.44, 0.4);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), pinkMat);
    head.position.set(0, 0, 0.12);
    const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.14, 8), snoutMat);
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, -0.04, 0.3);
    headPivot.add(head, snout);
    root.add(headPivot);
    root.userData.rootingPig = { headPivot, phase: Math.random() * Math.PI * 2 };
    return root;
  }

  return null;
}


export function buildEntityMesh(entity: LevelEntity): THREE.Group {
  const group = new THREE.Group();
  group.userData.entityId = entity.id;

  const addShadow = (radius = 0.55) => {
    const s = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 18),
      new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.25, depthWrite: false })
    );
    s.rotation.x = -Math.PI / 2;
    s.position.y = 0.02;
    group.add(s);
  };

  if (entity.mechTemplate) {
    addShadow(0.95);
    const mechModel = createBuiltinMechanismModel(entity.mechTemplate);
    group.add(mechModel);
    group.userData.mechRoot = mechModel;
    if (mechModel.userData.chestAnim) {
      group.userData.chestAnim = mechModel.userData.chestAnim;
    }
    group.scale.setScalar(entity.scale);
    group.rotation.y = (entity.rotation * Math.PI) / 180;
    return group;
  }

  if (entity.buildingBlock) {
    const bbScale = Math.max(0.25, Math.min(3.5, entity.scale));
    let idHash = 2166136261;
    for (let i = 0; i < entity.id.length; i++) {
      idHash ^= entity.id.charCodeAt(i);
      idHash = Math.imul(idHash, 16777619);
    }
    const blockSeed = (idHash >>> 0) % 10000;
    group.add(buildBuildingBlockMesh(entity.buildingBlock, bbScale, blockSeed));
    group.rotation.y = (entity.rotation * Math.PI) / 180;
    group.scale.setScalar(bbScale);
    return group;
  }

  if (entity.monsterConfig) {
    const monMesh = buildQuadrupedMonsterMesh(entity.monsterConfig);
    group.add(monMesh);
    group.userData.quadrupedRig = monMesh.userData.quadrupedRig;
    group.rotation.y = (entity.rotation * Math.PI) / 180;
    group.scale.setScalar(Math.max(0.25, Math.min(3.5, entity.scale)));
    return group;
  }

  switch (entity.kind) {
    case 'baddie': {
      const variant = entity.brain === 'Flyer' ? 'flyer' : entity.isBoss ? 'boss' : 'ground';
      const built = buildProceduralBaddieModel(variant, entity.styleTint);
      group.add(built.group);
      group.userData.baddieRig = built.rig;
      break;
    }

    case 'npc': {
      const creature = resolveCreatureType(entity.name, entity.creatureType);
      if (creature) {
        const creatureMesh = buildCreatureMesh(creature);
        group.add(creatureMesh);
        if (creatureMesh.userData.creatureAnim) {
          group.userData.creatureAnim = creatureMesh.userData.creatureAnim;
        }
        if (creatureMesh.userData.heroRig) {
          group.userData.heroRig = creatureMesh.userData.heroRig;
        }
        break;
      }
      const npcRig = buildProceduralNpcRig(entity.styleTint);
      group.add(npcRig.group);
      group.userData.heroRig = npcRig;
      group.userData.npcRig = npcRig;
      break;
    }

    case 'treasure': {
      addShadow(0.58);
      if (
        entity.notes?.toLowerCase().includes('card') ||
        entity.name.toLowerCase().includes('card')
      ) {
        group.add(buildRpgRewardCardsShrineMesh(entity));
        break;
      }
      const woodMat = new THREE.MeshStandardMaterial({ color: '#8E5225', roughness: 0.72 });
      const darkWoodMat = new THREE.MeshStandardMaterial({ color: '#3D2210', roughness: 0.88 });
      const goldMat = new THREE.MeshStandardMaterial({ color: '#F2C230', roughness: 0.25, metalness: 0.9 });

      const base = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.44, 0.64), woodMat);
      base.position.y = 0.22;
      base.castShadow = true;
      base.receiveShadow = true;

      // Recessed dark interior floor/cavity so opened chest reveals radiant gold light cleanly
      const cavity = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.08, 0.52), darkWoodMat);
      cavity.position.y = 0.415;

      // Lower side metal straps & lock plate
      for (const sx of [-0.29, 0.29]) {
        const baseStrap = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.67), goldMat);
        baseStrap.position.set(sx, 0.225, 0);
        baseStrap.castShadow = true;
        group.add(baseStrap);
      }
      const lockPlate = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.16, 0.07), goldMat);
      lockPlate.position.set(0, 0.35, 0.33);

      // Back-hinged lid pivot at (0, 0.44, -0.32)
      const lidPivot = new THREE.Group();
      lidPivot.name = 'Chest_Lid';
      lidPivot.position.set(0, 0.44, -0.32);

      const lidRim = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.66), woodMat);
      lidRim.position.set(0, 0.04, 0.32);
      lidRim.castShadow = true;

      const lidDome = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.32, 0.88, 14, 1, false, 0, Math.PI),
        woodMat
      );
      lidDome.rotation.z = Math.PI / 2;
      lidDome.rotation.y = Math.PI / 2;
      lidDome.position.set(0, 0.06, 0.32);
      lidDome.castShadow = true;

      for (const sx of [-0.29, 0.29]) {
        const lidStrap = new THREE.Mesh(
          new THREE.CylinderGeometry(0.335, 0.335, 0.082, 14, 1, false, 0, Math.PI),
          goldMat
        );
        lidStrap.rotation.z = Math.PI / 2;
        lidStrap.rotation.y = Math.PI / 2;
        lidStrap.position.set(sx, 0.06, 0.32);
        lidPivot.add(lidStrap);
      }

      const topClasp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.07), goldMat);
      topClasp.position.set(0, 0.01, 0.65);

      lidPivot.add(lidRim, lidDome, topClasp);
      group.add(base, cavity, lockPlate, lidPivot);

      attachChestGoldenGlow(group, 0.72, 0.48, 0.46, lidPivot, false);
      break;
    }

    case 'key': {
      addShadow(0.35);
      const goldMat = new THREE.MeshStandardMaterial({
        color: '#FFD140',
        emissive: '#FF9F1C',
        emissiveIntensity: 0.25,
        roughness: 0.22,
        metalness: 0.9,
      });
      const holder = new THREE.Group();
      holder.position.y = 0.75;
      holder.userData.floatSpin = true;
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 10, 18), goldMat);
      bow.position.y = 0.26;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.52, 8), goldMat);
      shaft.position.y = -0.14;
      const tooth1 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 0.06), goldMat);
      tooth1.position.set(0.1, -0.32, 0);
      const tooth2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.06), goldMat);
      tooth2.position.set(0.08, -0.2, 0);
      holder.add(bow, shaft, tooth1, tooth2);
      group.add(holder);
      break;
    }

    case 'door': {
      addShadow(0.95);
      if (entity.doorConfig) {
        group.add(buildModularDoorMesh(entity.doorConfig, Math.max(0.35, Math.min(3, entity.scale))));
        break;
      }
      const stoneMat = new THREE.MeshStandardMaterial({ color: '#7D828F', roughness: 0.85 });
      const woodMat = new THREE.MeshStandardMaterial({ color: '#7B4B2A', roughness: 0.75 });
      const ironMat = new THREE.MeshStandardMaterial({ color: '#3B3F46', roughness: 0.35, metalness: 0.8 });
      const pillarL = new THREE.Mesh(new THREE.BoxGeometry(0.34, 2.2, 0.45, 3, 6, 3), stoneMat);
      pillarL.position.set(-0.78, 1.1, 0);
      pillarL.castShadow = true;
      const pillarR = pillarL.clone();
      pillarR.position.x = 0.78;
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.36, 0.52, 6, 2, 2), stoneMat);
      lintel.position.y = 2.24;
      lintel.castShadow = true;
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.22, 1.98, 0.16, 4, 6, 2), woodMat);
      leaf.position.y = 0.99;
      leaf.userData.doorLeaf = true;
      const band = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.12, 0.2, 4, 1, 1), ironMat);
      band.position.y = 1.45;
      const lock = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.24), new THREE.MeshStandardMaterial({ color: '#F2C230', metalness: 0.85, roughness: 0.25 }));
      lock.position.set(0.38, 0.96, 0);
      group.add(pillarL, pillarR, lintel, leaf, band, lock);
      break;
    }

    case 'trap': {
      const trapStyle = entity.trapStyle ?? 'ironSpikes';
      const trapMeta = DUNGEON_TRAP_STYLE_META[trapStyle];
      const baseMat = new THREE.MeshStandardMaterial({
        color: trapMeta.baseHex,
        roughness: 0.58,
        metalness: 0.6,
      });
      const hazardColor = entity.styleTint ?? trapMeta.hazardHex;
      const hazardMat = new THREE.MeshStandardMaterial({
        color: hazardColor,
        roughness: trapStyle === 'sawBlades' ? 0.25 : 0.35,
        metalness: trapStyle === 'cursedRunes' ? 0.2 : 0.78,
        ...(trapMeta.emissiveHex
          ? {
              emissive: entity.styleTint ?? trapMeta.emissiveHex,
              emissiveIntensity: 0.85,
            }
          : {}),
      });

      const plate = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.12, 1.24, 4, 2, 4), baseMat);
      plate.position.y = 0.06;
      plate.receiveShadow = true;
      group.add(plate);

      if (trapStyle === 'emberPlates') {
        const core = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.06, 0.86), hazardMat);
        core.position.y = 0.13;
        group.add(core);
        for (const ox of [-0.46, 0.46]) {
          for (const oz of [-0.46, 0.46]) {
            const stud = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.34, 6), baseMat);
            stud.position.set(ox, 0.25, oz);
            stud.castShadow = true;
            group.add(stud);
          }
        }
      } else if (trapStyle === 'cursedRunes') {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.055, 8, 20), hazardMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.15;
        const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), hazardMat);
        crystal.position.y = 0.38;
        crystal.castShadow = true;
        crystal.userData.floatSpin = true;
        group.add(ring, crystal);
      } else if (trapStyle === 'sawBlades') {
        const slot = new THREE.Mesh(
          new THREE.BoxGeometry(1.06, 0.14, 0.16),
          new THREE.MeshStandardMaterial({ color: '#1B1E24', roughness: 0.8 })
        );
        slot.position.y = 0.08;
        const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 12), hazardMat);
        blade.rotation.x = Math.PI / 2;
        blade.position.y = 0.26;
        blade.castShadow = true;
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 8), baseMat);
        hub.rotation.x = Math.PI / 2;
        hub.position.y = 0.26;
        group.add(slot, blade, hub);
      } else if (trapStyle === 'laserTripwires') {
        // Twin high-tech pylons with glowing cyan laser beam across them
        for (const px of [-0.48, 0.48]) {
          const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.52, 8), baseMat);
          pylon.position.set(px, 0.26, 0);
          pylon.castShadow = true;
          const cap = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), hazardMat);
          cap.position.set(px, 0.54, 0);
          group.add(pylon, cap);
        }
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.96, 6), hazardMat);
        beam.rotation.z = Math.PI / 2;
        beam.position.set(0, 0.32, 0);
        group.add(beam);
      } else if (trapStyle === 'poisonDartPillars') {
        // Carved stone dart totem pillar with apertures
        const totem = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.72, 0.48), baseMat);
        totem.position.y = 0.42;
        totem.castShadow = true;
        const topNozzle = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.22, 6), hazardMat);
        topNozzle.position.y = 0.86;
        for (const oz of [-0.25, 0.25]) {
          const slit = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.04), hazardMat);
          slit.position.set(0, 0.42, oz);
          group.add(slit);
        }
        group.add(totem, topNozzle);
      } else if (trapStyle === 'fireGeysers') {
        // Volcanic vent cone with glowing magma core
        const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.48, 0.34, 10), baseMat);
        cone.position.y = 0.22;
        cone.castShadow = true;
        const magmaCore = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), hazardMat);
        magmaCore.position.y = 0.34;
        group.add(cone, magmaCore);
      } else if (trapStyle === 'frostSpikes') {
        // Cluster of sharp crystalline frost spikes
        const spikeOffsets: [number, number, number, number][] = [
          [0, 0, 0.65, 0.15],
          [-0.32, -0.32, 0.48, 0.11],
          [0.32, -0.32, 0.52, 0.12],
          [-0.32, 0.32, 0.55, 0.12],
          [0.32, 0.32, 0.46, 0.11],
        ];
        for (const [ox, oz, h, r] of spikeOffsets) {
          const spike = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), hazardMat);
          spike.position.set(ox, h * 0.5 + 0.08, oz);
          spike.castShadow = true;
          group.add(spike);
        }
      } else if (trapStyle === 'acidPuddles') {
        // Sunken basin with toxic bubbling acid vapor
        const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.56, 0.06, 16), baseMat);
        basin.position.y = 0.09;
        const acidSurface = new THREE.Mesh(new THREE.CircleGeometry(0.48, 16), hazardMat);
        acidSurface.rotation.x = -Math.PI / 2;
        acidSurface.position.y = 0.13;
        for (const [bx, bz, br] of [[-0.18, 0.12, 0.09], [0.16, -0.14, 0.08], [0.05, 0.18, 0.06]] as const) {
          const bubble = new THREE.Mesh(new THREE.SphereGeometry(br, 8, 8), hazardMat);
          bubble.position.set(bx, 0.15 + br * 0.5, bz);
          group.add(bubble);
        }
        group.add(basin, acidSurface);
      } else if (trapStyle === 'whirlpoolVortex') {
        // Swirling water vortex with concentric abyssal rings
        const outerRing = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.045, 8, 20), hazardMat);
        outerRing.rotation.x = Math.PI / 2;
        outerRing.position.y = 0.12;
        const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 8, 16), hazardMat);
        innerRing.rotation.x = Math.PI / 2;
        innerRing.position.y = 0.09;
        const funnel = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.24, 10), baseMat);
        funnel.rotation.x = Math.PI;
        funnel.position.y = 0.18;
        group.add(outerRing, innerRing, funnel);
      } else {
        const offsets = [-0.32, 0.32];
        for (const ox of offsets) {
          for (const oz of offsets) {
            const spike = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.52, 8), hazardMat);
            spike.position.set(ox, 0.34, oz);
            spike.castShadow = true;
            group.add(spike);
          }
        }
      }
      break;
    }

    case 'spawner': {
      addShadow(0.65);
      const stoneMat = new THREE.MeshStandardMaterial({ color: '#443B54', roughness: 0.7 });
      const glowMat = new THREE.MeshStandardMaterial({ color: '#F2545B', emissive: '#F2545B', emissiveIntensity: 0.8, roughness: 0.2 });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.72, 0.24, 8), stoneMat);
      base.position.y = 0.12;
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), glowMat);
      crystal.position.y = 0.92;
      crystal.userData.floatSpin = true;
      group.add(base, crystal);
      break;
    }

    case 'puzzle': {
      addShadow(0.62);
      const req = entity.puzzleRequires;
      if (req === 'skunkScent') {
        // Grumpy Briar Bramble with glowing mint-lime scent spore core
        const brambleMat = new THREE.MeshStandardMaterial({ color: '#3F4A2D', roughness: 0.88, flatShading: true });
        const thornMat = new THREE.MeshStandardMaterial({ color: '#6B2148', roughness: 0.7 });
        const sporeMat = new THREE.MeshStandardMaterial({
          color: '#A3E635',
          emissive: '#65A30D',
          emissiveIntensity: 0.9,
          roughness: 0.25,
        });
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2;
          const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.36, 0), brambleMat);
          bush.position.set(Math.cos(ang) * 0.42, 0.3, Math.sin(ang) * 0.42);
          bush.castShadow = true;
          group.add(bush);
          const thorn = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.34, 5), thornMat);
          thorn.position.set(Math.cos(ang) * 0.56, 0.62, Math.sin(ang) * 0.56);
          thorn.rotation.set(Math.sin(ang) * 0.5, 0, -Math.cos(ang) * 0.5);
          group.add(thorn);
        }
        const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), sporeMat);
        core.position.y = 0.72;
        core.userData.floatSpin = true;
        core.userData.puzzleCore = true;
        group.add(core);
      } else if (req === 'porcupineQuills') {
        // Wooden gantry with hanging golden acorn bullseye latch
        const woodMat = new THREE.MeshStandardMaterial({ color: '#784828', roughness: 0.82 });
        const acornMat = new THREE.MeshStandardMaterial({ color: '#D97706', roughness: 0.45 });
        const capMat = new THREE.MeshStandardMaterial({ color: '#451A03', roughness: 0.8 });
        const targetMat = new THREE.MeshStandardMaterial({
          color: '#F59E0B',
          emissive: '#D97706',
          emissiveIntensity: 0.95,
          roughness: 0.25,
        });
        const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.35, 8), woodMat);
        postL.position.set(-0.65, 1.17, 0);
        postL.castShadow = true;
        const postR = postL.clone();
        postR.position.x = 0.65;
        const beam = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.14, 0.16), woodMat);
        beam.position.set(0, 2.28, 0);
        beam.castShadow = true;
        const targetGroup = new THREE.Group();
        targetGroup.position.set(0, 1.55, 0);
        targetGroup.userData.puzzleCore = true;
        const acornBody = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), acornMat);
        acornBody.scale.set(1, 1.25, 1);
        const acornCap = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52), capMat);
        acornCap.position.y = 0.08;
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.055, 8, 18), targetMat);
        ring.userData.floatSpin = true;
        targetGroup.add(acornBody, acornCap, ring);
        group.add(postL, postR, beam, targetGroup);
      } else if (req === 'moleSonar') {
        // Buried Truffle Mound with glowing teal-cyan acoustic beacon cap
        const dirtMat = new THREE.MeshStandardMaterial({ color: '#6B4E35', roughness: 0.92, flatShading: true });
        const truffleMat = new THREE.MeshStandardMaterial({
          color: '#38BDF8',
          emissive: '#0284C7',
          emissiveIntensity: 0.9,
          roughness: 0.25,
        });
        const mound = new THREE.Mesh(new THREE.SphereGeometry(0.76, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), dirtMat);
        mound.scale.set(1.1, 0.65, 1.1);
        mound.receiveShadow = true;
        mound.castShadow = true;
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.05, 8, 20), truffleMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.08;
        ring.userData.puzzleCore = true;
        const gem = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), truffleMat);
        gem.position.y = 0.62;
        gem.userData.floatSpin = true;
        gem.userData.puzzleCore = true;
        group.add(mound, ring, gem);
      } else if (req === 'vultureSight') {
        // Sky-Lookout Totem with perched violet-gold sky lens
        const stoneMat = new THREE.MeshStandardMaterial({ color: '#585F70', roughness: 0.85, flatShading: true });
        const woodMat = new THREE.MeshStandardMaterial({ color: '#784828', roughness: 0.8 });
        const skyMat = new THREE.MeshStandardMaterial({
          color: '#C084FC',
          emissive: '#9333EA',
          emissiveIntensity: 1.0,
          roughness: 0.2,
        });
        const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.68, 0.34, 8), stoneMat);
        plinth.position.y = 0.17;
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.9, 8), woodMat);
        pillar.position.y = 1.25;
        pillar.castShadow = true;
        const perch = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.12, 0.14), woodMat);
        perch.position.y = 2.05;
        const lens = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), skyMat);
        lens.position.y = 2.45;
        lens.userData.floatSpin = true;
        lens.userData.puzzleCore = true;
        group.add(plinth, pillar, perch, lens);
      } else {
        const stoneMat = new THREE.MeshStandardMaterial({ color: '#6E7180', roughness: 0.8 });
        const glowMat = new THREE.MeshStandardMaterial({ color: '#9B5DE5', emissive: '#9B5DE5', emissiveIntensity: 0.65, roughness: 0.25 });
        const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.62, 0.18, 12), stoneMat);
        plinth.position.y = 0.09;
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.1, 12), glowMat);
        pad.position.y = 0.2;
        pad.userData.puzzleCore = true;
        group.add(plinth, pad);
      }
      break;
    }

    case 'platform': {
      const preset = entity.platformPreset ?? 'stoneLift';
      if (preset === 'bouncePad') {
        const baseMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.45, metalness: 0.72 });
        const coilMat = new THREE.MeshStandardMaterial({ color: '#94A3B8', roughness: 0.35, metalness: 0.85 });
        const padMat = new THREE.MeshStandardMaterial({
          color: entity.styleTint || '#F59E0B',
          emissive: '#F97316',
          emissiveIntensity: 0.35,
          roughness: 0.4,
        });
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.16, 20), baseMat);
        base.position.y = 0.08;
        const spring = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.09, 10, 20), coilMat);
        spring.rotation.x = Math.PI / 2;
        spring.position.y = 0.24;
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.86, 0.18, 22), padMat);
        pad.position.y = 0.36;
        pad.castShadow = true;
        pad.receiveShadow = true;
        group.add(base, spring, pad);
        break;
      }
      if (preset === 'sawWheel') {
        const hubMat = new THREE.MeshStandardMaterial({ color: '#1E293B', roughness: 0.4, metalness: 0.82 });
        const bladeMat = new THREE.MeshStandardMaterial({
          color: '#E2E8F0',
          emissive: '#EF4444',
          emissiveIntensity: 0.22,
          roughness: 0.25,
          metalness: 0.9,
        });
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.24, 16), hubMat);
        hub.position.y = 0.24;
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.08, 24), bladeMat);
        disc.position.y = 0.24;
        disc.castShadow = true;
        group.add(hub, disc);
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2;
          const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.34, 4), bladeMat);
          tooth.position.set(Math.cos(ang) * 1.22, 0.24, Math.sin(ang) * 1.22);
          tooth.rotation.z = -Math.PI / 2;
          tooth.rotation.y = -ang;
          group.add(tooth);
        }
        break;
      }
      if (preset === 'jungleVine') {
        const logMat = new THREE.MeshStandardMaterial({ color: entity.styleTint || '#6D442B', roughness: 0.82 });
        const leafMat = new THREE.MeshStandardMaterial({ color: '#22C55E', roughness: 0.72 });
        const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 2.4, 10), logMat);
        branch.rotation.z = Math.PI / 2;
        branch.position.y = 0.22;
        branch.castShadow = true;
        branch.receiveShadow = true;
        const topLeaf1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 0), leafMat);
        topLeaf1.position.set(-0.95, 0.3, 0.12);
        topLeaf1.scale.set(1.2, 0.45, 0.9);
        const topLeaf2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.38, 0), leafMat);
        topLeaf2.position.set(0.95, 0.3, -0.1);
        topLeaf2.scale.set(1.2, 0.45, 0.9);
        group.add(branch, topLeaf1, topLeaf2);
        break;
      }
      if (preset === 'crumbleStone') {
        const stoneMat = new THREE.MeshStandardMaterial({ color: entity.styleTint || '#A89F91', roughness: 0.92, flatShading: true });
        const crackMat = new THREE.MeshStandardMaterial({ color: '#57534E', roughness: 0.95 });
        const deck = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.32, 1.8, 3, 2, 3), stoneMat);
        deck.position.y = 0.16;
        deck.castShadow = true;
        deck.receiveShadow = true;
        const seam = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.06, 0.12), crackMat);
        seam.position.set(0, 0.31, 0.1);
        seam.rotation.y = 0.35;
        group.add(deck, seam);
        break;
      }
      const stoneMat = new THREE.MeshStandardMaterial({
        color: entity.styleTint || (preset === 'swingingBridge' ? '#9C6B3F' : preset === 'spinningDisc' ? '#5E6885' : '#8A93A2'),
        roughness: 0.72,
      });
      const trimMat = new THREE.MeshStandardMaterial({ color: '#6C4CF1', emissive: '#6C4CF1', emissiveIntensity: 0.35, roughness: 0.35 });
      const isDisc = preset === 'spinningDisc';
      const isBridge = preset === 'swingingBridge';
      const deck = new THREE.Mesh(
        isDisc
          ? new THREE.CylinderGeometry(1.1, 1.0, 0.3, 24, 2)
          : new THREE.BoxGeometry(isBridge ? 2.5 : 2.0, 0.3, isBridge ? 1.5 : 2.0, 6, 2, 6),
        stoneMat
      );
      deck.position.y = 0.15;
      deck.castShadow = true;
      deck.receiveShadow = true;
      const rim = new THREE.Mesh(
        isDisc
          ? new THREE.TorusGeometry(1.06, 0.06, 8, 24)
          : new THREE.BoxGeometry(isBridge ? 2.54 : 2.04, 0.08, isBridge ? 1.54 : 2.04, 6, 1, 6),
        trimMat
      );
      if (isDisc) rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.24;
      group.add(deck, rim);
      break;
    }

    case 'prop': {
      const rpgCustom = buildRpgCustomPropOrBuildingMesh(entity);
      if (rpgCustom) {
        if (!rpgCustom.userData.walkInBuilding && !isRopeBridgeEntity(entity)) {
          addShadow(0.75);
        }
        group.add(rpgCustom);
        Object.assign(group.userData, rpgCustom.userData);
        break;
      }
      const preset = resolvePropPreset(entity.name, entity.propPreset);
      if (preset) {
        group.add(buildPropPresetMesh(preset));
        break;
      }
      addShadow(0.45);
      const lowerName = entity.name.toLowerCase();
      const propStyle = entity.propStyle;
      const woodMat = new THREE.MeshStandardMaterial({
        color: entity.styleTint ?? '#9E6234',
        roughness: 0.75,
      });
      const ironMat = new THREE.MeshStandardMaterial({ color: '#424752', roughness: 0.35, metalness: 0.8 });
      const isCrate = lowerName.includes('crate');
      const isThrone = lowerName.includes('throne');

      if (isThrone) {
        const goldMat = new THREE.MeshStandardMaterial({ color: '#F2C230', roughness: 0.3, metalness: 0.8 });
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.48, 0.8, 4, 2, 4), goldMat);
        seat.position.y = 0.24;
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.3, 0.22, 4, 5, 2), goldMat);
        back.position.set(0, 0.88, -0.29);
        const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.12, 0.62, 3, 1, 3), new THREE.MeshStandardMaterial({ color: '#B8293D', roughness: 0.8 }));
        cushion.position.y = 0.52;
        group.add(seat, back, cushion);
      } else if (propStyle === 'arcaneBraziers') {
        const plinthMat = new THREE.MeshStandardMaterial({ color: '#394152', roughness: 0.75 });
        const bronzeMat = new THREE.MeshStandardMaterial({ color: '#A17434', roughness: 0.35, metalness: 0.75 });
        const glowColor = entity.styleTint ?? (lowerName.includes('brazier') ? '#FF7A2F' : '#38BDF8');
        const glowMat = new THREE.MeshStandardMaterial({
          color: glowColor,
          emissive: glowColor,
          emissiveIntensity: 0.9,
          roughness: 0.2,
        });
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.44, 0.52, 8), plinthMat);
        base.position.y = 0.26;
        base.castShadow = true;
        const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.28, 0.26, 10), bronzeMat);
        bowl.position.y = 0.64;
        bowl.castShadow = true;
        const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), glowMat);
        orb.position.y = 0.96;
        orb.userData.floatSpin = true;
        group.add(base, bowl, orb);
      } else if (propStyle === 'boneRelics') {
        const slabMat = new THREE.MeshStandardMaterial({ color: '#3D434F', roughness: 0.82 });
        const boneMat = new THREE.MeshStandardMaterial({
          color: entity.styleTint ?? '#E6DFCE',
          roughness: 0.65,
        });
        const accentMat = new THREE.MeshStandardMaterial({ color: '#8C6239', roughness: 0.5, metalness: 0.45 });
        const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.48, 0.76, 4, 3, 4), slabMat);
        plinth.position.y = 0.24;
        plinth.castShadow = true;
        const skull = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 1), boneMat);
        skull.position.y = 0.68;
        skull.castShadow = true;
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.04, 6, 14), accentMat);
        band.rotation.x = Math.PI / 2;
        band.position.y = 0.5;
        group.add(plinth, band, skull);
      } else if (propStyle === 'gildedUrns') {
        const slateMat = new THREE.MeshStandardMaterial({ color: '#313746', roughness: 0.7 });
        const goldMat = new THREE.MeshStandardMaterial({
          color: entity.styleTint ?? '#EAB308',
          roughness: 0.28,
          metalness: 0.85,
        });
        const ceramicMat = new THREE.MeshStandardMaterial({ color: '#5D4E6D', roughness: 0.45, metalness: 0.2 });
        const ped = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.34, 0.68, 4, 2, 4), slateMat);
        ped.position.y = 0.17;
        ped.castShadow = true;
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.2, 0.56, 12), ceramicMat);
        body.position.y = 0.62;
        body.castShadow = true;
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.045, 8, 16), goldMat);
        rim.rotation.x = Math.PI / 2;
        rim.position.y = 0.88;
        const bellyBand = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.035, 6, 16), goldMat);
        bellyBand.rotation.x = Math.PI / 2;
        bellyBand.position.y = 0.62;
        group.add(ped, body, rim, bellyBand);
      } else if (isCrate) {
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.84, 0.84, 4, 4, 4), woodMat);
        box.position.y = 0.42;
        box.castShadow = true;
        const brace = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.12, 0.88, 4, 2, 4), ironMat);
        brace.position.y = 0.42;
        group.add(box, brace);
      } else {
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.34, 0.82, 12), woodMat);
        barrel.position.y = 0.41;
        barrel.castShadow = true;
        const hoop1 = new THREE.Mesh(new THREE.TorusGeometry(0.365, 0.03, 6, 16), ironMat);
        hoop1.rotation.x = Math.PI / 2;
        hoop1.position.y = 0.2;
        const hoop2 = hoop1.clone();
        hoop2.position.y = 0.62;
        group.add(barrel, hoop1, hoop2);
      }
      break;
    }

    case 'scenery': {
      addShadow(0.85);
      const atlas = getTerrainTextureAtlas();
      const trunkMat = new THREE.MeshStandardMaterial({
        color: '#FFFFFF',
        map: atlas.pineBark,
        bumpMap: atlas.pineBarkBump,
        bumpScale: 0.14,
        roughness: 0.9,
      });
      const leafMat = new THREE.MeshStandardMaterial({
        color: '#52A441',
        map: atlas.pineLeaves,
        bumpMap: atlas.pineLeavesBump,
        bumpScale: 0.12,
        roughness: 0.82,
      });
      const trunkGeo = createOrganicTrunkGeometry({
        rTop: 0.11,
        rBottom: 0.27,
        height: 3.65,
        yOffset: -0.1,
        radialSegs: 12,
        heightSegs: 6,
        rootFlare: 0.34,
      });
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      const crown1 = new THREE.Mesh(createDetailedPineTierGeometry(1.12, 1.12, 11, 1), leafMat);
      crown1.position.y = 3.55;
      crown1.castShadow = true;
      const crown2 = new THREE.Mesh(createDetailedPineTierGeometry(0.92, 1.02, 10, 2), leafMat);
      crown2.position.y = 4.15;
      crown2.rotation.y = 0.38;
      crown2.castShadow = true;
      const crown3 = new THREE.Mesh(createDetailedPineTierGeometry(0.7, 0.92, 9, 3), leafMat);
      crown3.position.y = 4.68;
      crown3.rotation.y = 0.72;
      crown3.castShadow = true;
      const crown4 = new THREE.Mesh(createDetailedPineTierGeometry(0.45, 0.78, 7, 4), leafMat);
      crown4.position.y = 5.15;
      crown4.castShadow = true;
      group.add(trunk, crown1, crown2, crown3, crown4);
      break;
    }

    case 'sign': {
      if (resolvePropPreset(entity.name, entity.propPreset) === 'signpost') {
        group.add(buildPropPresetMesh('signpost'));
        break;
      }
      addShadow(0.35);
      const woodMat = new THREE.MeshStandardMaterial({ color: '#9C6838', roughness: 0.8 });
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.9, 10, 4), woodMat);
      post.position.y = 0.45;
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.52, 0.1, 6, 4, 2), woodMat);
      board.position.y = 0.96;
      board.castShadow = true;
      group.add(post, board);
      break;
    }

    case 'light': {
      if (resolvePropPreset(entity.name, entity.propPreset) === 'campfire') {
        group.add(buildPropPresetMesh('campfire'));
        break;
      }
      addShadow(0.3);
      const isVolumetricLantern =
        entity.notes?.toLowerCase().includes('volumetric') ||
        entity.name.toLowerCase().includes('lantern') ||
        entity.notes?.toLowerCase().includes('rpg');
      const woodMat = new THREE.MeshStandardMaterial({ color: '#5A3D24', roughness: 0.85 });
      const ironMat = new THREE.MeshStandardMaterial({ color: '#2F3540', metalness: 0.78, roughness: 0.35 });
      const glowHex = entity.styleTint ?? '#FFAE34';
      const flameMat = new THREE.MeshStandardMaterial({
        color: glowHex,
        emissive: glowHex,
        emissiveIntensity: 1.65,
        roughness: 0.18,
      });

      if (isVolumetricLantern) {
        const stoneBase = new THREE.Mesh(
          new THREE.CylinderGeometry(0.22, 0.3, 0.38, 7),
          new THREE.MeshStandardMaterial({ color: '#61666F', roughness: 0.9 })
        );
        stoneBase.position.y = 0.19;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.08, 1.55, 7), woodMat);
        post.position.y = 0.96;
        post.castShadow = true;
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.06), woodMat);
        arm.position.set(0.18, 1.68, 0);
        const lanternCage = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.28, 6), ironMat);
        lanternCage.position.set(0.36, 1.46, 0);
        const lanternCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.095, 1), flameMat);
        lanternCore.position.set(0.36, 1.46, 0);

        // Stylized volumetric light cone & ground pool
        const volumetricCone = new THREE.Mesh(
          new THREE.ConeGeometry(1.45, 2.35, 20, 1, true),
          new THREE.MeshBasicMaterial({
            color: glowHex,
            transparent: true,
            opacity: 0.15,
            depthWrite: false,
            side: THREE.DoubleSide,
          })
        );
        volumetricCone.position.set(0.36, 0.35, 0);

        const groundGlow = new THREE.Mesh(
          new THREE.CircleGeometry(1.42, 20),
          new THREE.MeshBasicMaterial({
            color: glowHex,
            transparent: true,
            opacity: 0.22,
            depthWrite: false,
          })
        );
        groundGlow.rotation.x = -Math.PI / 2;
        groundGlow.position.set(0.36, 0.03, 0);

        const ptLight = new THREE.PointLight(glowHex, 1.4, 9.5, 1.8);
        ptLight.position.set(0.36, 1.42, 0);

        group.add(stoneBase, post, arm, lanternCage, lanternCore, volumetricCone, groundGlow, ptLight);
        break;
      }

      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.25, 8), woodMat);
      pole.position.y = 0.62;
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.1, 0.16, 8), ironMat);
      bowl.position.y = 1.28;
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.34, 8), flameMat);
      flame.position.y = 1.5;
      group.add(pole, bowl, flame);
      break;
    }

    case 'fxEmitter': {
      const fxFallback = buildFxEmitterFallbackGroup(entity.id, entity.fxEmitter);
      group.add(fxFallback);
      break;
    }

    case 'checkpoint': {
      const cpPreset = resolvePropPreset(entity.name, entity.propPreset);
      if (cpPreset === 'checkpointArch' || cpPreset === 'savePlinth') {
        group.add(buildPropPresetMesh(cpPreset));
        break;
      }
      addShadow(0.4);
      const poleMat = new THREE.MeshStandardMaterial({ color: '#E2E4EA', metalness: 0.7, roughness: 0.3 });
      const flagMat = new THREE.MeshStandardMaterial({ color: '#22B573', emissive: '#22B573', emissiveIntensity: 0.25, roughness: 0.55 });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.16, 12), poleMat);
      base.position.y = 0.08;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.8, 8), poleMat);
      pole.position.y = 0.95;
      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.42, 0.05), flagMat);
      flag.position.set(0.34, 1.56, 0);
      group.add(base, pole, flag);
      break;
    }

    case 'portal': {
      addShadow(1.6);
      const stoneLightMat = new THREE.MeshStandardMaterial({
        color: '#8C94A6',
        roughness: 0.84,
        metalness: 0.04,
        flatShading: true,
      });
      const stoneDarkMat = new THREE.MeshStandardMaterial({
        color: '#535B6E',
        roughness: 0.86,
        metalness: 0.06,
        flatShading: true,
      });
      const runeMat = new THREE.MeshStandardMaterial({
        color: '#7CE8FF',
        emissive: '#38BDF8',
        emissiveIntensity: 1.85,
        roughness: 0.2,
      });
      const vortexMat = new THREE.MeshStandardMaterial({
        color: '#6CE5FF',
        emissive: '#2563EB',
        emissiveIntensity: 1.55,
        transparent: true,
        opacity: 0.86,
        roughness: 0.12,
        side: THREE.DoubleSide,
      });

      // Stepped faceted octagonal altar dais
      const step1 = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.95, 0.22, 8), stoneLightMat);
      step1.position.y = 0.11;
      step1.receiveShadow = true;
      step1.castShadow = true;
      const step2 = new THREE.Mesh(new THREE.CylinderGeometry(1.38, 1.54, 0.2, 8), stoneLightMat);
      step2.position.y = 0.31;
      step2.receiveShadow = true;
      const step3 = new THREE.Mesh(new THREE.CylinderGeometry(1.06, 1.18, 0.18, 8), stoneLightMat);
      step3.position.y = 0.48;
      group.add(step1, step2, step3);

      // Left & right carved stone archway columns + 5 segmented arch voussoir blocks
      const colGeo = new THREE.BoxGeometry(0.46, 1.65, 0.56);
      const pillarL = new THREE.Mesh(colGeo, stoneLightMat);
      pillarL.position.set(-0.92, 1.28, 0);
      pillarL.castShadow = true;
      const pillarR = new THREE.Mesh(colGeo, stoneLightMat);
      pillarR.position.set(0.92, 1.28, 0);
      pillarR.castShadow = true;
      group.add(pillarL, pillarR);

      for (let i = 0; i < 5; i++) {
        const theta = Math.PI * 0.14 + (i / 4) * Math.PI * 0.72;
        const archBlock = new THREE.Mesh(
          new THREE.BoxGeometry(0.56, 0.42, 0.58),
          i === 2 ? stoneDarkMat : stoneLightMat
        );
        archBlock.position.set(-Math.cos(theta) * 0.92, 2.08 + Math.sin(theta) * 0.86, 0);
        archBlock.rotation.z = theta - Math.PI / 2;
        archBlock.castShadow = true;
        group.add(archBlock);
      }

      // Glowing arcane vortex plane + inner radiant core
      const vortex = new THREE.Mesh(new THREE.CircleGeometry(0.84, 8), vortexMat);
      vortex.position.set(0, 1.72, 0);
      vortex.userData.floatSpin = true;
      const core = new THREE.Mesh(
        new THREE.CircleGeometry(0.42, 12),
        new THREE.MeshBasicMaterial({ color: '#E0F7FF', transparent: true, opacity: 0.92, side: THREE.DoubleSide })
      );
      core.position.set(0, 1.72, 0.02);
      group.add(vortex, core);

      // Flanking tapered dark-slate Rune Monolith stones with glowing cyan rune crystals
      for (const [mx, mz, myRot] of [
        [-2.25, 0.55, 0.38],
        [2.25, 0.45, -0.42],
      ]) {
        const mono = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.4, 1.55, 5), stoneDarkMat);
        mono.position.set(mx, 0.74, mz);
        mono.rotation.y = myRot;
        mono.castShadow = true;
        const glyph = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), runeMat);
        glyph.scale.set(0.9, 1.45, 0.55);
        glyph.position.set(mx + Math.sin(myRot) * 0.24, 0.95, mz + Math.cos(myRot) * 0.24);
        glyph.rotation.y = myRot;
        group.add(mono, glyph);
      }
      break;
    }

    case 'pickup': {
      addShadow(0.38);
      const itemDef = entity.pickupItemId
        ? DefaultInventoryItems.find((i) => i.id === entity.pickupItemId)
        : undefined;
      let meshKind: PickupMeshKind = itemDef?.meshKind ?? 'gem';
      let colorHex = itemDef?.colorHex ?? '#22B573';
      if (!itemDef) {
        const lower = entity.name.toLowerCase();
        if (lower.includes('axe')) {
          meshKind = 'axe';
          colorHex = '#D97706';
        } else if (lower.includes('fish') || lower.includes('pole') || lower.includes('rod')) {
          meshKind = lower.includes('pole') || lower.includes('rod') ? 'fishingPole' : 'fish';
          colorHex = '#38BDF8';
        } else if (lower.includes('log') || lower.includes('wood')) {
          meshKind = 'woodLog';
          colorHex = '#92400E';
        } else if (lower.includes('berry') || lower.includes('berries')) {
          meshKind = 'berries';
          colorHex = '#E11D48';
        } else if (lower.includes('herb')) {
          meshKind = 'herbs';
          colorHex = '#22C55E';
        } else if (lower.includes('hat') || lower.includes('crown')) {
          meshKind = 'hat';
          colorHex = '#B45309';
        } else if (lower.includes('cloak') || lower.includes('cape')) {
          meshKind = 'cloak';
          colorHex = '#15803D';
        } else if (lower.includes('torch')) {
          meshKind = 'torch';
          colorHex = '#F97316';
        } else if (lower.includes('potion') || lower.includes('tonic') || lower.includes('brew')) {
          meshKind = 'potion';
          colorHex = '#F43F5E';
        }
      }
      group.add(buildPickupItemMesh(meshKind, colorHex));
      break;
    }

    default: {
      addShadow(0.45);
      const mat = new THREE.MeshStandardMaterial({ color: '#22B573', roughness: 0.45 });
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), mat);
      gem.position.y = 0.65;
      gem.userData.floatSpin = true;
      group.add(gem);
      break;
    }
  }

  group.rotation.y = (entity.rotation * Math.PI) / 180;
  group.scale.setScalar(Math.max(0.25, Math.min(3.5, entity.scale)));
  return group;
}

export function buildPortalMarker(): THREE.Group {
  return buildEntityMesh({
    id: 'level-portal',
    kind: 'portal',
    name: 'Portal',
    position: { x: 0.88, y: 0.24 },
    rotation: 0,
    scale: 1,
    isBoss: false,
    brain: '',
    health: 1,
    speed: 0,
    damage: 0,
    loot: '',
    puzzleType: '',
    dialogue: '',
    platformPreset: 'stoneLift',
    platformMotion: 'slide',
    platformSpeed: 1,
    platformWait: 1,
    platformRunning: true,
    conversation: [],
    notes: '',
    cards: [],
  });
}
