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
      height: 2.05,
      yOffset: 0,
      radialSegs: 12,
      heightSegs: 7,
      rootFlare: 0.08,
      curveX: 0.1,
      curveZ: 0.06,
      branches: [
        { startY: 1.15, length: 1.2, rBottom: 0.15, rTop: 0.07, tilt: 0.62, yaw: 0.55 },
        { startY: 1.25, length: 1.12, rBottom: 0.14, rTop: 0.065, tilt: 0.56, yaw: 2.65 },
        { startY: 1.35, length: 1.02, rBottom: 0.13, rTop: 0.06, tilt: 0.5, yaw: -1.45 },
      ],
    });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.castShadow = true;
    const c1 = new THREE.Mesh(createSculptedCanopyLobeGeometry(1.34, 1.24, 0.88, 1.18, 1.2, 16, 12, 2.8, 1.9), leafMat);
    c1.position.set(0.05, 2.65, 0.02);
    c1.castShadow = true;
    const c2 = new THREE.Mesh(createSculptedCanopyLobeGeometry(1.02, 1.12, 0.86, 1.06, 2.7, 14, 10, 2.4, 1.7), leafMat);
    c2.position.set(0.84, 2.28, 0.5);
    c2.castShadow = true;
    const c3 = new THREE.Mesh(createSculptedCanopyLobeGeometry(0.96, 1.08, 0.88, 1.04, 4.1, 14, 10, 2.4, 1.7), leafMat);
    c3.position.set(-0.8, 2.34, -0.42);
    c3.castShadow = true;
    const c4 = new THREE.Mesh(createSculptedCanopyLobeGeometry(0.88, 1.08, 0.84, 1.06, 5.6, 14, 10, 2.3, 1.6), leafMat);
    c4.position.set(-0.26, 2.22, 0.82);
    c4.castShadow = true;
    const c5 = new THREE.Mesh(createSculptedCanopyLobeGeometry(0.84, 1.1, 0.88, 1.04, 7.3, 14, 10, 2.2, 1.6), leafMat);
    c5.position.set(0.3, 3.16, -0.24);
    c5.castShadow = true;
    g.add(trunk, c1, c2, c3, c4, c5);
  } else if (kind === 'birch') {
    const trunkGeo = createOrganicTrunkGeometry({
      rTop: 0.095,
      rBottom: 0.18,
      height: 2.65,
      yOffset: 0,
      radialSegs: 12,
      heightSegs: 7,
      rootFlare: 0.06,
      curveX: 0.12,
      curveZ: -0.05,
      uvScaleU: 1.6,
      uvScaleV: 2.5,
      branches: [
        { startY: 1.45, length: 1.1, rBottom: 0.08, rTop: 0.036, tilt: 0.44, yaw: 0.85 },
        { startY: 1.7, length: 0.94, rBottom: 0.07, rTop: 0.032, tilt: 0.4, yaw: -2.1 },
      ],
    });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.castShadow = true;
    const l1 = new THREE.Mesh(createSculptedCanopyLobeGeometry(0.96, 0.96, 1.24, 0.94, 3.1, 16, 10, 2.8, 2.0), leafMat);
    l1.position.set(0.12, 2.95, -0.04);
    l1.castShadow = true;
    const l2 = new THREE.Mesh(createSculptedCanopyLobeGeometry(0.72, 0.98, 1.12, 0.96, 5.4, 14, 10, 2.4, 1.8), leafMat);
    l2.position.set(0.54, 2.42, -0.32);
    l2.castShadow = true;
    const l3 = new THREE.Mesh(createSculptedCanopyLobeGeometry(0.66, 0.95, 1.08, 0.94, 8.2, 14, 10, 2.3, 1.7), leafMat);
    l3.position.set(-0.46, 2.52, 0.34);
    l3.castShadow = true;
    const l4 = new THREE.Mesh(createSculptedCanopyLobeGeometry(0.6, 0.92, 1.18, 0.92, 11.1, 12, 10, 2.2, 1.7), leafMat);
    l4.position.set(0.06, 3.66, 0.08);
    l4.castShadow = true;
    g.add(trunk, l1, l2, l3, l4);
  } else {
    const trunkGeo = createOrganicTrunkGeometry({
      rTop: 0.11,
      rBottom: 0.24,
      height: 2.35,
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
    t1.position.y = 1.68;
    t1.castShadow = true;
    const t2 = new THREE.Mesh(createDetailedPineTierGeometry(1.34, 1.38, 11, 2), leafMat);
    t2.position.y = 2.46;
    t2.rotation.y = 0.29;
    t2.castShadow = true;
    const t3 = new THREE.Mesh(createDetailedPineTierGeometry(1.08, 1.28, 10, 3), leafMat);
    t3.position.y = 3.2;
    t3.rotation.y = 0.61;
    t3.castShadow = true;
    const t4 = new THREE.Mesh(createDetailedPineTierGeometry(0.8, 1.14, 9, 4), leafMat);
    t4.position.y = 3.88;
    t4.rotation.y = 0.95;
    t4.castShadow = true;
    const t5 = new THREE.Mesh(createDetailedPineTierGeometry(0.5, 0.94, 7, 5), leafMat);
    t5.position.y = 4.46;
    t5.castShadow = true;
    g.add(trunk, t1, t2, t3, t4, t5);
  }

  g.scale.setScalar(size * 1.15);
  return g;
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
      const stoneMat = new THREE.MeshStandardMaterial({
        color: entity.platformPreset === 'swingingBridge' ? '#9C6B3F' : entity.platformPreset === 'spinningDisc' ? '#5E6885' : '#8A93A2',
        roughness: 0.72,
      });
      const trimMat = new THREE.MeshStandardMaterial({ color: '#6C4CF1', emissive: '#6C4CF1', emissiveIntensity: 0.35, roughness: 0.35 });
      const isDisc = entity.platformPreset === 'spinningDisc';
      const isBridge = entity.platformPreset === 'swingingBridge';
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
        height: 1.55,
        yOffset: -0.1,
        radialSegs: 12,
        heightSegs: 6,
        rootFlare: 0.34,
      });
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      const crown1 = new THREE.Mesh(createDetailedPineTierGeometry(1.12, 1.12, 11, 1), leafMat);
      crown1.position.y = 1.38;
      crown1.castShadow = true;
      const crown2 = new THREE.Mesh(createDetailedPineTierGeometry(0.92, 1.02, 10, 2), leafMat);
      crown2.position.y = 1.96;
      crown2.rotation.y = 0.38;
      crown2.castShadow = true;
      const crown3 = new THREE.Mesh(createDetailedPineTierGeometry(0.7, 0.92, 9, 3), leafMat);
      crown3.position.y = 2.48;
      crown3.rotation.y = 0.72;
      crown3.castShadow = true;
      const crown4 = new THREE.Mesh(createDetailedPineTierGeometry(0.45, 0.78, 7, 4), leafMat);
      crown4.position.y = 2.94;
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
      const woodMat = new THREE.MeshStandardMaterial({ color: '#614228', roughness: 0.85 });
      const flameMat = new THREE.MeshStandardMaterial({ color: '#FF9F1C', emissive: '#FF7A00', emissiveIntensity: 1.5, roughness: 0.2 });
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.25, 8), woodMat);
      pole.position.y = 0.62;
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.1, 0.16, 8), new THREE.MeshStandardMaterial({ color: '#3A3A40', metalness: 0.7 }));
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
