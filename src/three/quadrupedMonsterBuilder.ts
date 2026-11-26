import * as THREE from 'three';
import { applyMonsterSculptData } from './creatureSculptEngine';
import type {
  BaddieWindupClueStyle,
  CharacterEyePupilStyle,
  CharacterMaterialFinish,
  CharacterSurfaceCoatConfig,
  CharacterSurfaceCoatMode,
  CreatureExpressionMood,
  MonsterAbilityId,
  MonsterAttackType,
  MonsterBlueprint,
  MonsterEarsConfig,
  MonsterEarStyle,
  MonsterEyebrowsConfig,
  MonsterEyesConfig,
  MonsterHeadStyle,
  MonsterHornsConfig,
  MonsterHornStyle,
  MonsterLegPairConfig,
  MonsterMouthConfig,
  MonsterMuzzleConfig,
  MonsterNoseConfig,
  MonsterNoseStyle,
  MonsterPartKey,
  MonsterPawStyle,
  MonsterSegmentProfile,
  MonsterSpikesConfig,
  MonsterSpikeStyle,
  MonsterTailStyle,
  MonsterTeethConfig,
  MonsterTeethStyle,
  MonsterWingsConfig,
  MonsterWingStyle,
} from '../types/maker';
import { resolveEffectiveWindupClueStyle } from '../data/baddieActionLibrary';
import {
  polygonizeSdfToGeometry,
  SdfFieldEvaluator,
  type SdfPrimitive,
} from './sdfMarchingCubes';

export type QuadrupedAnimState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'fly'
  | 'windup'
  | 'strike'
  | 'stagger'
  | 'dying'
  | 'celebrate';

export interface MonsterSegmentGuideRing {
  center: [number, number, number];
  axis: [number, number, number];
  rx: number;
  rz: number;
}

export interface MonsterSegmentGuide {
  partKey: MonsterPartKey;
  boneIndex: number;
  rings: MonsterSegmentGuideRing[];
  spine: [number, number, number][];
}

export interface MonsterEyelidRig {
  node: THREE.Group;
  minOpenRad: number;
  maxCloseRad: number;
  restClosedFrac: number;
}

export interface MonsterEarRig {
  side: -1 | 1;
  pivot: THREE.Group;
  baseRotX: number;
  baseRotZ: number;
}

export interface MonsterEyebrowRig {
  side: -1 | 1;
  pivot: THREE.Group;
  basePosY: number;
  baseRotZ: number;
  baseTiltRad: number;
}

export interface QuadrupedLegRig {
  side: -1 | 1; // -1 = left (-X), +1 = right (+X)
  pairIndex: number; // 0 = frontmost ... legPairs - 1 = rearmost
  hipPivot: THREE.Bone;
  kneePivot: THREE.Bone;
  pawGroup: THREE.Bone;
  baseHipX: number;
  baseKneeX: number;
  baseSpreadZ: number;
  baseYawY: number;
}

export interface QuadrupedHeadRig {
  neckBones: THREE.Bone[];
  neckPivot: THREE.Bone; // alias to neckBones[0]
  headPivot: THREE.Bone;
  jawPivot: THREE.Bone;
  mouthAnchor: THREE.Object3D;
  eyelids: MonsterEyelidRig[];
  eyebrows: MonsterEyebrowRig[];
  ears: MonsterEarRig[];
  blushMeshes: THREE.Mesh[];
  lipGroup?: THREE.Group;
  mouthMoodGroups?: Record<CreatureExpressionMood, THREE.Group>;
  tongueMesh?: THREE.Mesh;
  tongueStickMesh?: THREE.Mesh;
  baseNeckYaw: number;
  baseNeckPitch: number;
  headIndex: number;
}

export interface QuadrupedWingRig {
  side: -1 | 1;
  innerPivot: THREE.Bone;
  outerPivot: THREE.Bone;
  baseLiftRad: number;
  baseSweepRad: number;
  baseFoldRad: number;
}

export interface ResolvedMonsterBlueprint extends MonsterBlueprint {
  materialFinish: CharacterMaterialFinish;
  blendSmoothness: number;
  chest: MonsterSegmentProfile;
  torso: MonsterSegmentProfile & { archY: number };
  hips: MonsterSegmentProfile;
  belly: MonsterSegmentProfile & { enabled: boolean };
  neck: MonsterSegmentProfile & { segments: number; pitchDeg: number; spreadDeg: number };
  head: MonsterSegmentProfile & {
    crownHeight: number;
    browFierce: number;
    jawWidth: number;
    jawDrop: number;
    craniumTiltDeg: number;
  };
  muzzle: MonsterMuzzleConfig;
  nose: MonsterNoseConfig;
  mouth: MonsterMouthConfig;
  teeth: MonsterTeethConfig;
  ears: MonsterEarsConfig;
  eyes: MonsterEyesConfig;
  eyebrows: MonsterEyebrowsConfig;
  horns: MonsterHornsConfig;
  frontLegs: MonsterLegPairConfig;
  rearLegs: MonsterLegPairConfig;
  midLegs: MonsterLegPairConfig;
  wings: MonsterWingsConfig;
  tail: MonsterSegmentProfile & { segments: number; curlUp: number; tipScale: number; tipColor: string };
  spikes: MonsterSpikesConfig;
  surfaceCoat: CharacterSurfaceCoatConfig;
  primaryAttack: MonsterAttackType;
  secondaryAttack: MonsterAttackType;
  specialAbility: MonsterAbilityId;
  attackPower: number;
  attackRange: number;
  attackCooldown: number;
}

export interface QuadrupedMonsterRig {
  root: THREE.Group;
  bodyPivot: THREE.Bone;
  chestBone: THREE.Bone;
  torsoBone: THREE.Bone;
  spineBackPivot: THREE.Bone;
  skinnedMesh: THREE.SkinnedMesh;
  skeleton: THREE.Skeleton;
  bones: THREE.Bone[];
  partWeights?: Uint8Array;
  seamZones?: Int16Array;
  seamGaps?: Float32Array;
  segmentGuides?: MonsterSegmentGuide[];
  partMeshes: Partial<Record<MonsterPartKey, THREE.Object3D[]>>;
  vertexCount: number;
  legs: QuadrupedLegRig[];
  heads: QuadrupedHeadRig[];
  tailSegments: THREE.Bone[];
  wingL?: QuadrupedWingRig;
  wingR?: QuadrupedWingRig;
  mouthAnchors: THREE.Object3D[];
  chestAnchor: THREE.Object3D;
  tailTipAnchor: THREE.Object3D;
  slashArc: THREE.Mesh;
  slashMat: THREE.MeshBasicMaterial;
  flashMaterials: THREE.MeshStandardMaterial[];
  groundClearance: number;
  topHeight: number;
  canFly: boolean;
  hasWings: boolean;
  legPairs: 2 | 3 | 4;
  isSpider: boolean;
  scale: number;
  mouthMood?: CreatureExpressionMood;
  eyebrowMood?: CreatureExpressionMood;
  blueprint: ResolvedMonsterBlueprint;
}

export interface MonsterPresetDef {
  id: string;
  label: string;
  category: 'animals' | 'monsters';
  blurb: string;
  blueprint: MonsterBlueprint;
}

/** Stable 15-slot part mask mapping matching sdfMarchingCubes.ts capacity */
export const MONSTER_SDF_PART_INDEX: Partial<Record<MonsterPartKey, number>> = {
  chest: 0,
  torso: 1,
  hips: 2,
  belly: 3,
  neck: 4,
  head: 5,
  muzzle: 6,
  frontLegs: 7,
  rearLegs: 8,
  midLegs: 9,
  tail: 10,
};

export const MONSTER_PRESETS: MonsterPresetDef[] = [
  {
    id: 'timber_wolf',
    label: 'Timber Wolf',
    category: 'animals',
    blurb: 'Swift 4-legged woodland runner',
    blueprint: {
      id: 'preset_timber_wolf',
      name: 'Timber Wolf',
      presetId: 'timber_wolf',
      role: 'baddie',
      legPairs: 2,
      headCount: 1,
      headStyle: 'wolf',
      hornStyle: 'none',
      wingStyle: 'none',
      canFly: false,
      tailStyle: 'bushy',
      spineSpikes: false,
      bodyLength: 1.08,
      bodyWidth: 0.92,
      legHeight: 1.05,
      scale: 1.0,
      bodyColor: '#6B7280',
      bellyColor: '#E5E7EB',
      accentColor: '#374151',
      eyeColor: '#FBBF24',
      wingColor: '#4B5563',
      speed: 4,
      health: 4,
      dialogue: 'Grrr... stay out of the pack territory!',
      primaryAttack: 'clawSlash',
      secondaryAttack: 'sonicRoar',
      specialAbility: 'swiftStride',
      surfaceCoat: {
        mode: 'furShort',
        intensity: 0.52,
        density: 1.1,
        scaleSize: 0.95,
        clumpiness: 0.35,
        tipColor: '#D1D5DB',
      },
    },
  },
  {
    id: 'red_fox',
    label: 'Red Fox',
    category: 'animals',
    blurb: 'Nimble 4-legged forest critter',
    blueprint: {
      id: 'preset_red_fox',
      name: 'Red Fox',
      presetId: 'red_fox',
      role: 'npc',
      legPairs: 2,
      headCount: 1,
      headStyle: 'wolf',
      hornStyle: 'none',
      wingStyle: 'none',
      canFly: false,
      tailStyle: 'bushy',
      spineSpikes: false,
      bodyLength: 0.96,
      bodyWidth: 0.85,
      legHeight: 0.9,
      scale: 0.9,
      bodyColor: '#D95F28',
      bellyColor: '#FFF3E0',
      accentColor: '#2B211B',
      eyeColor: '#F59E0B',
      wingColor: '#D95F28',
      speed: 4,
      health: 4,
      dialogue: 'Yip! Looking for hidden berries in the glade?',
      primaryAttack: 'clawSlash',
      secondaryAttack: 'fireBreath',
      specialAbility: 'swiftStride',
      ears: {
        style: 'foxTall',
        size: 1.25,
        tiltDeg: 10,
        spreadDeg: 22,
        offsetY: 0.02,
        offsetZ: 0,
        color: '#D95F28',
        innerColor: '#FFF3E0',
      },
      surfaceCoat: {
        mode: 'furShort',
        intensity: 0.48,
        density: 1.15,
        scaleSize: 0.85,
        clumpiness: 0.25,
        tipColor: '#FDBA74',
      },
    },
  },
  {
    id: 'forest_stag',
    label: 'Forest Stag',
    category: 'animals',
    blurb: 'Tall 4-legged antlered guardian',
    blueprint: {
      id: 'preset_forest_stag',
      name: 'Forest Stag',
      presetId: 'forest_stag',
      role: 'buddy',
      legPairs: 2,
      headCount: 1,
      headStyle: 'wolf',
      hornStyle: 'stagAntlers',
      wingStyle: 'none',
      canFly: false,
      tailStyle: 'shortStub',
      spineSpikes: false,
      bodyLength: 1.15,
      bodyWidth: 0.9,
      legHeight: 1.32,
      scale: 1.12,
      bodyColor: '#8B5A3C',
      bellyColor: '#EADBC8',
      accentColor: '#F3E5AB',
      eyeColor: '#38BDF8',
      wingColor: '#8B5A3C',
      speed: 4,
      health: 6,
      dialogue: 'Follow my antlers — I know the mountain paths.',
      primaryAttack: 'chargeGore',
      secondaryAttack: 'solarBeam',
      specialAbility: 'regenerator',
    },
  },
  {
    id: 'grizzly_bear',
    label: 'Grizzly Bear',
    category: 'animals',
    blurb: 'Heavy 4-legged woodland bruiser',
    blueprint: {
      id: 'preset_grizzly_bear',
      name: 'Grizzly Bear',
      presetId: 'grizzly_bear',
      role: 'baddie',
      legPairs: 2,
      headCount: 1,
      headStyle: 'fluffy',
      hornStyle: 'none',
      wingStyle: 'none',
      canFly: false,
      tailStyle: 'shortStub',
      spineSpikes: false,
      bodyLength: 1.12,
      bodyWidth: 1.34,
      legHeight: 0.92,
      scale: 1.24,
      bodyColor: '#6D442B',
      bellyColor: '#B98E68',
      accentColor: '#3B2314',
      eyeColor: '#FDE047',
      wingColor: '#6D442B',
      speed: 3,
      health: 7,
      dialogue: 'ROAR! Who woke me up from my nap?',
      primaryAttack: 'groundPound',
      secondaryAttack: 'clawSlash',
      specialAbility: 'thickFat',
      surfaceCoat: {
        mode: 'furLong',
        intensity: 0.6,
        density: 1.0,
        scaleSize: 1.1,
        clumpiness: 0.55,
        tipColor: '#A16207',
      },
    },
  },
  {
    id: 'twin_dragon',
    label: 'Two-Headed Dragon',
    category: 'monsters',
    blurb: 'Winged flying 4-legged twin-head drake',
    blueprint: {
      id: 'preset_twin_dragon',
      name: 'Twin Flame Drake',
      presetId: 'twin_dragon',
      role: 'baddie',
      legPairs: 2,
      headCount: 2,
      headStyle: 'dragon',
      hornStyle: 'twinHorns',
      wingStyle: 'dragonBat',
      canFly: true,
      tailStyle: 'dragonSpiked',
      spineSpikes: true,
      bodyLength: 1.24,
      bodyWidth: 1.12,
      legHeight: 1.0,
      scale: 1.25,
      bodyColor: '#B91C1C',
      bellyColor: '#FBBF24',
      accentColor: '#450A0A',
      eyeColor: '#FEF08A',
      wingColor: '#EA580C',
      isBoss: true,
      speed: 4,
      health: 9,
      dialogue: 'Twice the jaws, twice the fire!',
      primaryAttack: 'fireBreath',
      secondaryAttack: 'groundPound',
      specialAbility: 'flameBody',
      surfaceCoat: {
        mode: 'scalesDragon',
        intensity: 0.58,
        density: 1.05,
        scaleSize: 1.0,
        clumpiness: 0.2,
        tipColor: '#F59E0B',
      },
    },
  },
  {
    id: 'hydra_beast',
    label: 'Three-Headed Hydra',
    category: 'monsters',
    blurb: '3-headed armored swamp monster',
    blueprint: {
      id: 'preset_hydra_beast',
      name: 'Three-Headed Hydra',
      presetId: 'hydra_beast',
      role: 'baddie',
      legPairs: 2,
      headCount: 3,
      headStyle: 'dragon',
      hornStyle: 'crownSpikes',
      wingStyle: 'none',
      canFly: false,
      tailStyle: 'dragonSpiked',
      spineSpikes: true,
      bodyLength: 1.32,
      bodyWidth: 1.24,
      legHeight: 1.05,
      scale: 1.35,
      bodyColor: '#0F766E',
      bellyColor: '#99F6E4',
      accentColor: '#F59E0B',
      eyeColor: '#FB7185',
      wingColor: '#14B8A6',
      isBoss: true,
      speed: 3,
      health: 10,
      dialogue: 'All three of us saw you coming!',
      primaryAttack: 'waterJet',
      secondaryAttack: 'poisonSpit',
      specialAbility: 'regenerator',
      surfaceCoat: {
        mode: 'scalesDragon',
        intensity: 0.62,
        density: 1.1,
        scaleSize: 1.15,
        clumpiness: 0.15,
        tipColor: '#5EEAD4',
      },
    },
  },
  {
    id: 'winged_manticore',
    label: 'Winged Manticore',
    category: 'monsters',
    blurb: 'Horned lion-beast with wings & stinger',
    blueprint: {
      id: 'preset_winged_manticore',
      name: 'Winged Manticore',
      presetId: 'winged_manticore',
      role: 'baddie',
      legPairs: 2,
      headCount: 1,
      headStyle: 'demon',
      hornStyle: 'ramCurl',
      wingStyle: 'feathered',
      canFly: true,
      tailStyle: 'stinger',
      spineSpikes: true,
      bodyLength: 1.18,
      bodyWidth: 1.08,
      legHeight: 1.08,
      scale: 1.18,
      bodyColor: '#9333EA',
      bellyColor: '#FDE68A',
      accentColor: '#F59E0B',
      eyeColor: '#38BDF8',
      wingColor: '#EC4899',
      speed: 5,
      health: 7,
      dialogue: 'Watch out for the sky — and my tail!',
      primaryAttack: 'tailSmash',
      secondaryAttack: 'sonicRoar',
      specialAbility: 'galeWings',
    },
  },
  {
    id: 'six_leg_hound',
    label: 'Six-Legged Shadow Hound',
    category: 'monsters',
    blurb: '6-legged spiked prowler',
    blueprint: {
      id: 'preset_six_leg_hound',
      name: 'Shadow Hound',
      presetId: 'six_leg_hound',
      role: 'baddie',
      legPairs: 3,
      headCount: 2,
      headStyle: 'wolf',
      hornStyle: 'twinHorns',
      wingStyle: 'none',
      canFly: false,
      tailStyle: 'club',
      spineSpikes: true,
      bodyLength: 1.36,
      bodyWidth: 0.98,
      legHeight: 1.02,
      scale: 1.1,
      bodyColor: '#312E81',
      bellyColor: '#818CF8',
      accentColor: '#C084FC',
      eyeColor: '#22D3EE',
      wingColor: '#4F46E5',
      speed: 5,
      health: 6,
      dialogue: 'Six paws make zero sound in the dark...',
      primaryAttack: 'shadowBeam',
      secondaryAttack: 'electricShock',
      specialAbility: 'intimidate',
    },
  },
  {
    id: 'eight_leg_weaver',
    label: '8-Legged Cave Weaver',
    category: 'monsters',
    blurb: '8-legged arachnid monster with stinger',
    blueprint: {
      id: 'preset_eight_leg_weaver',
      name: 'Cave Weaver',
      presetId: 'eight_leg_weaver',
      role: 'baddie',
      legPairs: 4,
      headCount: 1,
      headStyle: 'spider',
      hornStyle: 'none',
      wingStyle: 'fairyInsect',
      canFly: false,
      tailStyle: 'stinger',
      spineSpikes: false,
      bodyLength: 1.15,
      bodyWidth: 1.28,
      legHeight: 0.95,
      scale: 1.12,
      bodyColor: '#1F2937',
      bellyColor: '#6D28D9',
      accentColor: '#A855F7',
      eyeColor: '#F43F5E',
      wingColor: '#38BDF8',
      speed: 4,
      health: 6,
      dialogue: 'Skitter-skitter... step into my parlor!',
      primaryAttack: 'poisonSpit',
      secondaryAttack: 'electricShock',
      specialAbility: 'staticShell',
    },
  },
];

export function createDefaultMonsterBlueprint(presetId = 'twin_dragon'): MonsterBlueprint {
  const found = MONSTER_PRESETS.find((p) => p.id === presetId) ?? MONSTER_PRESETS[0];
  return JSON.parse(JSON.stringify(found.blueprint)) as MonsterBlueprint;
}

export function createRandomMonsterBlueprint(): MonsterBlueprint {
  const bodies = ['#B91C1C', '#0F766E', '#7C3AED', '#D97706', '#2563EB', '#4B5563', '#059669', '#BE185D'];
  const bellies = ['#FEF3C7', '#CCFBF1', '#E0E7FF', '#FCE7F3', '#F3F4F6'];
  const accents = ['#F59E0B', '#38BDF8', '#EC4899', '#A855F7', '#FACC15', '#1F2937'];
  const eyes = ['#FACC15', '#38BDF8', '#FB7185', '#4ADE80', '#F97316'];
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  const headStyles: MonsterHeadStyle[] = ['wolf', 'dragon', 'demon', 'dino', 'fluffy', 'spider'];
  const hornStyles: MonsterHornStyle[] = ['none', 'twinHorns', 'ramCurl', 'stagAntlers', 'crownSpikes', 'rhinoHorn', 'unicorn', 'devilSweep', 'crystalCrown'];
  const wingStyles: MonsterWingStyle[] = ['none', 'dragonBat', 'feathered', 'fairyInsect', 'wyvern', 'elementalEnergy'];
  const tailStyles: MonsterTailStyle[] = ['none', 'bushy', 'dragonSpiked', 'club', 'stinger', 'shortStub', 'whip', 'bladeFin', 'twinFork'];
  const attacks: MonsterAttackType[] = [
    'clawSlash', 'groundPound', 'tailSmash', 'chargeGore', 'sonicRoar',
    'fireBreath', 'iceBreath', 'waterJet', 'electricShock', 'poisonSpit', 'shadowBeam', 'solarBeam',
  ];
  const abilities: MonsterAbilityId[] = [
    'intimidate', 'thickFat', 'flameBody', 'staticShell', 'swiftStride', 'galeWings', 'berserk', 'regenerator',
  ];
  const coats: CharacterSurfaceCoatMode[] = ['none', 'furShort', 'furLong', 'furClumped', 'scalesDragon', 'scalesHex'];

  const legPairs = pick<2 | 3 | 4>([2, 2, 2, 3, 4]);
  const headCount = legPairs === 4 ? 1 : pick<1 | 2 | 3>([1, 1, 2, 3]);
  const wingStyle = pick(wingStyles);
  const bodyColor = pick(bodies);
  const accentColor = pick(accents);

  return {
    id: `mon_${Date.now().toString(36)}`,
    name: `${pick(['Ember', 'Frost', 'Shadow', 'Storm', 'Moss', 'Crystal', 'Iron', 'Volt'])} ${pick(['Beast', 'Drake', 'Stalker', 'Guardian', 'Wyrm', 'Prowler'])}`,
    role: 'baddie',
    legPairs,
    headCount,
    headStyle: legPairs === 4 && Math.random() < 0.6 ? 'spider' : pick(headStyles),
    hornStyle: pick(hornStyles),
    wingStyle,
    canFly: wingStyle !== 'none' && Math.random() < 0.72,
    tailStyle: pick(tailStyles),
    spineSpikes: Math.random() < 0.65,
    bodyLength: Number((0.92 + Math.random() * 0.45).toFixed(2)),
    bodyWidth: Number((0.88 + Math.random() * 0.45).toFixed(2)),
    legHeight: Number((0.85 + Math.random() * 0.45).toFixed(2)),
    scale: Number((0.95 + Math.random() * 0.45).toFixed(2)),
    bodyColor,
    bellyColor: pick(bellies),
    accentColor,
    eyeColor: pick(eyes),
    wingColor: accentColor,
    isBoss: Math.random() < 0.25,
    speed: 3 + Math.floor(Math.random() * 3),
    health: 5 + Math.floor(Math.random() * 5),
    dialogue: 'Grrrr! Dare you challenge me?',
    primaryAttack: pick(attacks),
    secondaryAttack: pick(attacks),
    specialAbility: pick(abilities),
    surfaceCoat: {
      mode: pick(coats),
      intensity: 0.55,
      density: 1.05,
      scaleSize: 1.0,
      clumpiness: 0.35,
      tipColor: accentColor,
    },
  };
}

function defaultAttackForHead(bp: MonsterBlueprint): MonsterAttackType {
  if (bp.headStyle === 'dragon') return 'fireBreath';
  if (bp.headStyle === 'spider') return 'poisonSpit';
  if (bp.headStyle === 'fluffy') return 'groundPound';
  if (bp.headStyle === 'demon') return bp.tailStyle === 'stinger' ? 'tailSmash' : 'shadowBeam';
  if (bp.hornStyle === 'stagAntlers' || bp.hornStyle === 'rhinoHorn') return 'chargeGore';
  return 'clawSlash';
}

function defaultAbilityForStyle(bp: MonsterBlueprint): MonsterAbilityId {
  if (bp.canFly && bp.wingStyle !== 'none') return 'galeWings';
  if (bp.headStyle === 'dragon') return 'flameBody';
  if (bp.headStyle === 'fluffy') return 'thickFat';
  if (bp.headStyle === 'spider') return 'staticShell';
  if (bp.isBoss) return 'intimidate';
  return 'swiftStride';
}

function defaultPawForStyle(bp: MonsterBlueprint): MonsterPawStyle {
  if (bp.headStyle === 'spider') return 'arachnid';
  if (bp.hornStyle === 'stagAntlers' || bp.hornStyle === 'unicorn') return 'hoof';
  if (bp.headStyle === 'dragon' || bp.headStyle === 'dino') return 'talon';
  if (bp.headStyle === 'demon') return 'claw';
  return 'paw';
}

function defaultEarsForStyle(bp: MonsterBlueprint): MonsterEarStyle {
  if (bp.headStyle === 'spider' || bp.headStyle === 'dino') return 'none';
  if (bp.headStyle === 'dragon') return 'frill';
  if (bp.headStyle === 'demon') return 'batFin';
  if (bp.headStyle === 'fluffy') return 'bearRound';
  return 'wolfPerk';
}

function defaultPupilForStyle(bp: MonsterBlueprint): CharacterEyePupilStyle {
  if (bp.headStyle === 'dragon' || bp.headStyle === 'demon') return 'catSlit';
  if (bp.headStyle === 'spider') return 'glow';
  if (bp.headStyle === 'dino') return 'oval';
  return 'round';
}

export function resolveMonsterBlueprint(raw: MonsterBlueprint): ResolvedMonsterBlueprint {
  const bLen = THREE.MathUtils.clamp(raw.bodyLength ?? 1.1, 0.65, 1.85);
  const bWid = THREE.MathUtils.clamp(raw.bodyWidth ?? 1.0, 0.65, 1.75);
  const lHgt = THREE.MathUtils.clamp(raw.legHeight ?? 1.0, 0.55, 1.75);
  const isSpider = raw.headStyle === 'spider' || raw.legPairs === 4;
  const isBear = raw.headStyle === 'fluffy';
  const isDragon = raw.headStyle === 'dragon' || raw.headStyle === 'dino';

  const torsoHalf = 0.34 * bLen;
  const baseBodyR = 0.21 * bWid;

  const chest: MonsterSegmentProfile = {
    startRadius: baseBodyR * (isBear ? 1.18 : 1.06),
    midRadius: baseBodyR * (isBear ? 1.24 : 1.14),
    endRadius: baseBodyR * 0.98,
    curvature: 0.2,
    length: torsoHalf * 0.72,
    squashX: isSpider ? 1.15 : 1.02,
    squashZ: 1.0,
    offsetX: 0,
    offsetY: isDragon ? 0.03 : 0,
    offsetZ: torsoHalf * 0.66,
    blendScale: 1.05,
    color: raw.bodyColor,
    ...(raw.chest ?? {}),
  };

  const torso: MonsterSegmentProfile & { archY: number } = {
    startRadius: baseBodyR * 0.96,
    midRadius: baseBodyR * (isSpider ? 0.85 : 0.92),
    endRadius: baseBodyR * 0.98,
    curvature: isBear ? 0.25 : 0.1,
    length: torsoHalf * 0.95,
    squashX: isSpider ? 1.02 : 0.96,
    squashZ: 1.0,
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
    blendScale: 1.1,
    color: raw.bodyColor,
    archY: isDragon ? 0.025 : isSpider ? -0.015 : 0.01,
    ...(raw.torso ?? {}),
  };

  const hips: MonsterSegmentProfile = {
    startRadius: baseBodyR * (isSpider ? 1.22 : 0.96),
    midRadius: baseBodyR * (isSpider ? 1.52 : 1.06),
    endRadius: baseBodyR * (isSpider ? 1.12 : 0.88),
    curvature: isSpider ? 0.42 : 0.22,
    length: torsoHalf * (isSpider ? 1.12 : 0.76),
    squashX: isSpider ? 1.2 : 1.0,
    squashZ: 1.05,
    offsetX: 0,
    offsetY: isSpider ? 0.06 : -0.01,
    offsetZ: -torsoHalf * 0.66,
    blendScale: 1.05,
    color: raw.bodyColor,
    ...(raw.hips ?? {}),
  };

  const belly: MonsterSegmentProfile & { enabled: boolean } = {
    enabled: true,
    startRadius: baseBodyR * 0.68,
    midRadius: baseBodyR * 0.78,
    endRadius: baseBodyR * 0.64,
    curvature: 0.18,
    length: torsoHalf * 1.18,
    squashX: 0.92,
    squashZ: 0.82,
    offsetX: 0,
    offsetY: -baseBodyR * 0.48,
    offsetZ: 0.02,
    blendScale: 0.72,
    color: raw.bellyColor,
    ...(raw.belly ?? {}),
  };

  const neckDefaultLen = isSpider ? 0.06 : isDragon ? 0.44 : isBear ? 0.18 : 0.3;
  const neck: MonsterSegmentProfile & { segments: number; pitchDeg: number; spreadDeg: number } = {
    startRadius: baseBodyR * (isDragon ? 0.6 : isBear ? 0.82 : 0.56),
    midRadius: baseBodyR * (isDragon ? 0.48 : isBear ? 0.74 : 0.48),
    endRadius: baseBodyR * (isDragon ? 0.44 : isBear ? 0.68 : 0.46),
    curvature: isDragon ? 0.18 : 0.05,
    length: neckDefaultLen,
    squashX: 0.92,
    squashZ: 1.05,
    offsetX: 0,
    offsetY: isSpider ? -0.02 : 0.02,
    offsetZ: -0.03,
    blendScale: 0.88,
    ...(raw.neck ?? {}),
    color: raw.neck?.color ?? raw.bodyColor ?? '#888888',
    segments: raw.neck?.segments ?? (isDragon ? 3 : 2),
    pitchDeg: raw.neck?.pitchDeg ?? (isSpider ? 6 : isDragon ? 46 : isBear ? 18 : 34),
    spreadDeg: raw.headCount === 3 ? (raw.neck?.spreadDeg ?? 28) : raw.headCount === 2 ? (raw.neck?.spreadDeg ?? 22) : 0,
  };

  const headBaseR = baseBodyR * (isBear ? 0.82 : isSpider ? 0.78 : isDragon ? 0.64 : 0.68);
  const head: ResolvedMonsterBlueprint['head'] = {
    startRadius: headBaseR * 0.94,
    midRadius: headBaseR * 1.06,
    endRadius: headBaseR * 0.88,
    curvature: 0.24,
    length: headBaseR * 1.65,
    squashX: isBear ? 1.12 : isSpider ? 1.18 : 0.94,
    squashZ: 1.02,
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
    blendScale: 0.76,
    color: raw.bodyColor,
    crownHeight: isDragon ? 0.055 : 0.035,
    browFierce: isDragon || raw.headStyle === 'demon' ? 0.65 : isBear ? 0.25 : 0.35,
    jawWidth: isBear ? 0.95 : 0.82,
    jawDrop: isDragon ? 0.03 : 0.015,
    craniumTiltDeg: isDragon ? -8 : 0,
    ...(raw.head ?? {}),
  };

  const muzzle: MonsterMuzzleConfig = {
    enabled: !isSpider,
    length: isDragon ? 0.25 : isBear ? 0.14 : raw.headStyle === 'wolf' ? 0.23 : 0.18,
    width: isBear ? 0.13 : isDragon ? 0.105 : 0.092,
    height: isBear ? 0.105 : 0.082,
    taper: raw.headStyle === 'wolf' ? 0.54 : isBear ? 0.76 : 0.66,
    splitCleft: isBear || raw.headStyle === 'wolf' ? 0.28 : 0,
    fangSize: isDragon || raw.headStyle === 'demon' ? 1.0 : raw.headStyle === 'wolf' ? 0.65 : 0.35,
    nostrils: !isSpider,
    tiltDeg: isBear ? 6 : 3,
    offsetY: -0.02,
    offsetZ: 0,
    blendScale: 0.56,
    color: isBear ? raw.bellyColor : raw.bodyColor,
    ...(raw.muzzle ?? {}),
  };

  const defaultNoseStyle: MonsterNoseStyle = isSpider
    ? 'none'
    : isBear
    ? 'oval'
    : raw.headStyle === 'wolf'
    ? 'triangle'
    : 'nostrilsOnly';
  const nose: MonsterNoseConfig = {
    enabled: !isSpider && muzzle.nostrils !== false,
    style: defaultNoseStyle,
    width: isBear ? 0.038 : raw.headStyle === 'wolf' ? 0.028 : 0.03,
    height: isBear ? 0.025 : raw.headStyle === 'wolf' ? 0.022 : 0.02,
    depth3D: isBear ? 0.58 : raw.headStyle === 'wolf' ? 0.48 : 0.25,
    shine: isBear || raw.headStyle === 'wolf' ? 0.55 : 0.2,
    showNostrils: true,
    nostrilScale: 1.0,
    posX: 0,
    posY: 0,
    posZ: 0,
    embed: 0,
    tiltDeg: 0,
    color: isBear || raw.headStyle === 'wolf' ? '#1E1618' : raw.accentColor,
    nostrilColor: '#111827',
    ...(raw.nose ?? {}),
  };

  const ears: MonsterEarsConfig = {
    style: defaultEarsForStyle(raw),
    size: 1.0,
    thickness: 1.0,
    softness: 0.2,
    tiltDeg: 14,
    spreadDeg: 26,
    offsetY: 0,
    offsetZ: 0,
    color: raw.bodyColor,
    innerColor: raw.bellyColor,
    ...(raw.ears ?? {}),
  };

  const eyes: MonsterEyesConfig = {
    count: isSpider ? 6 : 2,
    pupilStyle: defaultPupilForStyle(raw),
    size: isSpider ? 0.038 : 0.046,
    aspectX: 1.0,
    aspectY: raw.headStyle === 'dragon' ? 0.92 : 1.05,
    flatness: 0.78,
    spacing: headBaseR * 0.58,
    height: headBaseR * 0.24,
    depthOffset: 0,
    eyelidRest: raw.role === 'baddie' ? 0.14 : 0.04,
    scleraColor: isDragon || raw.headStyle === 'demon' ? raw.eyeColor : '#FFFDF9',
    irisColor: raw.eyeColor,
    pupilColor: '#111827',
    glowEmissive: raw.headStyle === 'demon' || raw.headStyle === 'spider' ? 0.65 : 0.2,
    ...(raw.eyes ?? {}),
  };

  const defaultMood: CreatureExpressionMood =
    raw.role === 'baddie' ? (raw.headStyle === 'dragon' ? 'open' : 'angry') : 'closed';

  const mouth: MonsterMouthConfig = {
    mood: defaultMood,
    mouthOpen: 0.0,
    smileCurve: raw.role === 'baddie' ? -0.25 : 0.35,
    width: muzzle.enabled ? muzzle.width * 1.45 : headBaseR * 0.85,
    lipThickness: 0.011,
    tongueVisible: true,
    tongueStickOut: 0,
    tongueColor: '#FB7185',
    interiorColor: '#14090D',
    lipColor: isBear ? raw.accentColor : raw.bodyColor,
    blushColor: '#F472B6',
    offsetY: 0,
    offsetZ: 0,
    ...(raw.mouth ?? {}),
  };

  const legacyFang = raw.muzzle?.fangSize ?? muzzle.fangSize;
  const defaultTeethStyle: MonsterTeethStyle =
    isDragon || raw.headStyle === 'demon'
      ? 'stripsAndCanine'
      : raw.headStyle === 'wolf' || legacyFang > 0.2
      ? 'canine'
      : 'none';
  const teeth: MonsterTeethConfig = {
    style: defaultTeethStyle,
    sharpness: isDragon || raw.headStyle === 'demon' || raw.headStyle === 'wolf' ? 0.85 : 0.25,
    size: THREE.MathUtils.clamp(legacyFang > 0.1 ? legacyFang : 1.0, 0.4, 2.0),
    spreadX: 1.0,
    showTop: true,
    showBottom: isDragon || raw.headStyle === 'demon',
    topOffsetY: 0,
    bottomOffsetY: 0,
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
    color: '#F8FAFC',
    ...(raw.teeth ?? {}),
  };

  const eyebrows: MonsterEyebrowsConfig = {
    enabled: !isSpider,
    mood: raw.role === 'baddie' ? 'angry' : 'closed',
    width: headBaseR * 0.56,
    thickness: 0.015,
    arch: 0.22,
    tiltDeg: raw.role === 'baddie' ? 16 : 0,
    spacing: eyes.spacing,
    height: eyes.height + eyes.size * 1.18,
    color: raw.accentColor,
    ...(raw.eyebrows ?? {}),
  };

  const horns: MonsterHornsConfig = {
    length: 0.32,
    thickness: 1.0,
    softness: 0.14,
    sweepDeg: 24,
    spreadX: 0.08,
    offsetY: 0,
    offsetZ: 0,
    color: raw.accentColor,
    ...(raw.horns ?? {}),
  };

  const pawStyle = defaultPawForStyle(raw);
  const legUpperLen = 0.27 * lHgt;
  const legLowerLen = 0.27 * lHgt;
  const legR = Math.max(0.036, (isSpider ? 0.042 : isBear ? 0.088 : 0.064) * Math.sqrt(bWid));

  const makeLegDefault = (
    zOff: number,
    stanceDeg: number,
    kneeDeg: number,
    splay: number,
    override?: Partial<MonsterLegPairConfig>
  ): MonsterLegPairConfig => {
    const base: MonsterLegPairConfig = {
      upper: {
        startRadius: legR * 1.15,
        midRadius: legR * 0.96,
        endRadius: legR * 0.78,
        curvature: 0.12,
        length: legUpperLen,
        squashX: 0.95,
        squashZ: 1.08,
        offsetX: 0,
        offsetY: 0,
        offsetZ: 0,
        blendScale: 0.76,
        color: raw.bodyColor,
      },
      lower: {
        startRadius: legR * 0.76,
        midRadius: legR * 0.62,
        endRadius: legR * 0.56,
        curvature: -0.05,
        length: legLowerLen,
        squashX: 0.94,
        squashZ: 1.0,
        offsetX: 0,
        offsetY: 0,
        offsetZ: 0,
        blendScale: 0.58,
        color: raw.bodyColor,
      },
      hipSpreadX: baseBodyR * (isSpider ? 1.08 : 0.84),
      hipOffsetY: -baseBodyR * 0.25,
      hipOffsetZ: zOff,
      stanceAngleDeg: stanceDeg,
      kneeBendDeg: kneeDeg,
      spiderSplay: splay,
      pawStyle,
      pawScale: 1.0,
      clawColor: raw.accentColor,
    };
    if (!override) return base;
    return {
      ...base,
      ...override,
      upper: { ...base.upper, ...(override.upper ?? {}) },
      lower: { ...base.lower, ...(override.lower ?? {}) },
    };
  };

  const frontLegs = makeLegDefault(
    torsoHalf * 0.72,
    isSpider ? -24 : -14,
    isSpider ? 64 : 26,
    isSpider ? 0.85 : 0.08,
    raw.frontLegs
  );

  const midLegs = makeLegDefault(
    0,
    isSpider ? 0 : -4,
    isSpider ? 62 : 22,
    isSpider ? 1.0 : 0.1,
    raw.midLegs
  );
  const rearLegs = makeLegDefault(
    -torsoHalf * 0.72,
    isSpider ? 28 : 22,
    isSpider ? 66 : -34,
    isSpider ? 0.85 : 0.1,
    raw.rearLegs
  );

  const wings: MonsterWingsConfig = {
    span: 1.24,
    chordWidth: 0.62,
    sweepBackDeg: 22,
    liftDeg: 18,
    foldDeg: 10,
    offsetX: baseBodyR * 0.65,
    offsetY: baseBodyR * 0.52,
    offsetZ: -0.04,
    ribCount: 4,
    membraneOpacity: 0.76,
    wingColor: raw.wingColor,
    boneColor: raw.bodyColor,
    tipColor: raw.accentColor,
    ...(raw.wings ?? {}),
  };

  const isBushyTail = raw.tailStyle === 'bushy';
  const tailR = isBushyTail ? baseBodyR * 0.52 : raw.tailStyle === 'shortStub' ? baseBodyR * 0.36 : baseBodyR * 0.34;
  const tailLen = raw.tailStyle === 'shortStub' ? 0.22 : raw.tailStyle === 'whip' ? 0.95 : 0.72;
  const tail: ResolvedMonsterBlueprint['tail'] = {
    startRadius: tailR * 0.85,
    midRadius: isBushyTail ? tailR * 1.25 : tailR * 0.62,
    endRadius: isBushyTail ? tailR * 0.72 : raw.tailStyle === 'club' ? tailR * 1.15 : tailR * 0.25,
    curvature: isBushyTail ? 0.35 : 0.1,
    length: tailLen,
    squashX: 0.96,
    squashZ: 1.0,
    offsetX: 0,
    offsetY: 0.03,
    offsetZ: 0.02,
    blendScale: 0.74,
    color: raw.bodyColor,
    segments: raw.tailStyle === 'shortStub' ? 2 : 4,
    curlUp: isBushyTail || raw.tailStyle === 'stinger' ? 0.65 : 0.18,
    tipScale: 1.0,
    tipColor: raw.accentColor,
    ...(raw.tail ?? {}),
  };

  const spikes: MonsterSpikesConfig = {
    enabled: Boolean(raw.spineSpikes),
    style: isDragon ? 'dorsalFins' : 'boneSpikes',
    count: 6,
    length: 0.16,
    thickness: 1.0,
    softness: 0.2,
    sinkDepth: 0.016,
    sweepDeg: 28,
    startFrac: 0.1,
    endFrac: 0.92,
    color: raw.accentColor,
    tipColor: raw.bellyColor,
    ...(raw.spikes ?? {}),
  };

  const surfaceCoat: CharacterSurfaceCoatConfig = {
    mode: isBear ? 'furLong' : raw.headStyle === 'wolf' ? 'furShort' : isDragon ? 'scalesDragon' : 'none',
    intensity: 0.48,
    density: 1.0,
    scaleSize: 1.0,
    clumpiness: 0.35,
    tipColor: raw.accentColor,
    ...(raw.surfaceCoat ?? {}),
  };

  const primaryAttack = raw.primaryAttack ?? defaultAttackForHead(raw);
  const secondaryAttack = raw.secondaryAttack ?? (primaryAttack === 'clawSlash' ? 'sonicRoar' : 'clawSlash');

  return {
    ...raw,
    materialFinish: raw.materialFinish ?? 'clay',
    blendSmoothness: THREE.MathUtils.clamp(raw.blendSmoothness ?? 0.088, 0.02, 0.2),
    chest,
    torso,
    hips,
    belly,
    neck,
    head,
    muzzle,
    nose,
    mouth,
    teeth,
    ears,
    eyes,
    eyebrows,
    horns,
    frontLegs,
    rearLegs,
    midLegs,
    wings,
    tail,
    spikes,
    surfaceCoat,
    primaryAttack,
    secondaryAttack,
    specialAbility: raw.specialAbility ?? defaultAbilityForStyle(raw),
    attackPower: THREE.MathUtils.clamp(raw.attackPower ?? (raw.isBoss ? 2 : 1), 1, 5),
    attackRange: THREE.MathUtils.clamp(raw.attackRange ?? 3.6, 1.6, 10),
    attackCooldown: THREE.MathUtils.clamp(raw.attackCooldown ?? 1.15, 0.55, 3.5),
  };
}

function hexToRgbTuple(hex: string): [number, number, number] {
  const c = new THREE.Color(hex || '#9CA3AF');
  return [c.r, c.g, c.b];
}

function tupleVec(v: THREE.Vector3): [number, number, number] {
  return [v.x, v.y, v.z];
}

function hashInt01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

function createMonsterClayMaterial(finish: CharacterMaterialFinish): THREE.MeshStandardMaterial {
  switch (finish) {
    case 'glossySlime':
      return new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.16,
        metalness: 0.04,
        envMapIntensity: 0.9,
      });
    case 'toonSatin':
      return new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.68,
        metalness: 0.0,
        envMapIntensity: 0.3,
      });
    case 'velvetCreature':
      return new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 1.0,
        metalness: 0.0,
        envMapIntensity: 0.1,
      });
    case 'clay':
    default:
      return new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.96,
        metalness: 0.0,
        envMapIntensity: 0.15,
      });
  }
}

function createMonsterCoatTextures(coat: CharacterSurfaceCoatConfig): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  bumpScale: number;
} | null {
  if (coat.mode === 'none' || typeof document === 'undefined') return null;

  const size = 256;
  const albedoCanvas = document.createElement('canvas');
  const bumpCanvas = document.createElement('canvas');
  const roughCanvas = document.createElement('canvas');
  albedoCanvas.width = bumpCanvas.width = roughCanvas.width = size;
  albedoCanvas.height = bumpCanvas.height = roughCanvas.height = size;

  const aCtx = albedoCanvas.getContext('2d');
  const bCtx = bumpCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');
  if (!aCtx || !bCtx || !rCtx) return null;

  const intensity = THREE.MathUtils.clamp(coat.intensity, 0.05, 1);
  const densityMult = THREE.MathUtils.clamp(coat.density, 0.3, 1.8);
  const sizeScale = THREE.MathUtils.clamp(coat.scaleSize, 0.5, 2.0);
  const tipRgb = new THREE.Color(coat.tipColor || '#FDE68A');

  aCtx.fillStyle = '#FFFFFF';
  aCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#505050';
  bCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = coat.mode.startsWith('scales') ? '#EDEDED' : '#F6F6F6';
  rCtx.fillRect(0, 0, size, size);

  if (coat.mode.startsWith('fur')) {
    const isLong = coat.mode === 'furLong';
    const isClump = coat.mode === 'furClumped';
    const count = Math.round((isLong ? 300 : 440) * densityMult);
    const baseLen = (isLong ? 34 : isClump ? 24 : 15) * sizeScale;
    const baseW = (isClump ? 4.2 : isLong ? 2.5 : 1.8) * sizeScale;

    for (let i = 0; i < count; i++) {
      const h1 = hashInt01(i * 13 + 7);
      const h2 = hashInt01(i * 29 + 19);
      const h3 = hashInt01(i * 41 + 31);
      let x = h1 * size;
      let y = h2 * size;
      if (isClump) {
        const cx = Math.floor(h1 * 6) * (size / 6) + size / 12;
        const cy = Math.floor(h2 * 6) * (size / 6) + size / 12;
        const spread = THREE.MathUtils.lerp(28, 10, coat.clumpiness);
        x = (cx + (h3 - 0.5) * spread + size) % size;
        y = (cy + (hashInt01(i * 53) - 0.5) * spread + size) % size;
      }
      const len = baseLen * (0.7 + h3 * 0.65);
      const angle = (hashInt01(i * 71) - 0.5) * (isClump ? 0.55 : 0.35);
      const darkTone = Math.round(255 - intensity * 68);
      const bumpHi = Math.round(135 + intensity * 115);

      for (const ox of [-size, 0, size]) {
        for (const oy of [-size, 0, size]) {
          const px = x + ox;
          const py = y + oy;
          if (px < -len || px > size + len || py < -len || py > size + len) continue;
          const ex = px + Math.sin(angle) * len;
          const ey = py + Math.cos(angle) * len;
          aCtx.strokeStyle = `rgba(${darkTone},${darkTone},${darkTone},${0.32 * intensity})`;
          aCtx.lineWidth = baseW;
          aCtx.lineCap = 'round';
          aCtx.beginPath();
          aCtx.moveTo(px, py);
          aCtx.lineTo(ex, ey);
          aCtx.stroke();

          bCtx.strokeStyle = `rgb(${bumpHi},${bumpHi},${bumpHi})`;
          bCtx.lineWidth = baseW * 0.85;
          bCtx.lineCap = 'round';
          bCtx.beginPath();
          bCtx.moveTo(px, py);
          bCtx.lineTo(ex, ey);
          bCtx.stroke();
        }
      }
    }
  } else {
    // Fish, Dragon, or Hex scales
    const cols = Math.max(4, Math.round(9 * densityMult / sizeScale));
    const rows = Math.max(4, Math.round(9 * densityMult / sizeScale));
    const cw = size / cols;
    const ch = size / rows;
    const tr = Math.round(tipRgb.r * 255);
    const tg = Math.round(tipRgb.g * 255);
    const tb = Math.round(tipRgb.b * 255);

    for (let r = -1; r <= rows + 1; r++) {
      const xShift = r % 2 === 0 ? 0 : cw * 0.5;
      for (let c = -1; c <= cols + 1; c++) {
        const cx = c * cw + xShift;
        const cy = r * ch;
        const rad = cw * (coat.mode === 'scalesDragon' ? 0.58 : 0.52);

        bCtx.fillStyle = `rgb(${Math.round(145 + intensity * 95)},${Math.round(145 + intensity * 95)},${Math.round(145 + intensity * 95)})`;
        bCtx.strokeStyle = '#2A2A2A';
        bCtx.lineWidth = 2.0;
        bCtx.beginPath();
        if (coat.mode === 'scalesDragon') {
          bCtx.moveTo(cx, cy - rad * 0.9);
          bCtx.lineTo(cx + rad * 0.85, cy);
          bCtx.lineTo(cx, cy + rad * 1.05);
          bCtx.lineTo(cx - rad * 0.85, cy);
          bCtx.closePath();
        } else {
          bCtx.arc(cx, cy, rad, 0, Math.PI * 2);
        }
        bCtx.fill();
        bCtx.stroke();

        aCtx.strokeStyle = `rgba(${tr},${tg},${tb},${0.22 * intensity})`;
        aCtx.lineWidth = 1.6;
        aCtx.beginPath();
        aCtx.arc(cx, cy, rad * 0.78, 0.15 * Math.PI, 0.85 * Math.PI);
        aCtx.stroke();
      }
    }
  }

  const wrapTex = (canvas: HTMLCanvasElement, isColor: boolean) => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3.2, 3.2);
    if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  };

  return {
    map: wrapTex(albedoCanvas, true),
    bumpMap: wrapTex(bumpCanvas, false),
    roughnessMap: wrapTex(roughCanvas, false),
    bumpScale: (coat.mode.startsWith('scales') ? 0.032 : 0.022) * intensity,
  };
}

function createConformingDiscGeo(
  rx: number,
  ry: number,
  shellRadius: number,
  segTheta = 24,
  segRings = 8,
  offX = 0,
  offY = 0
): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const verts: number[] = [];
  const norms: number[] = [];
  const indices: number[] = [];

  const cSq = offX * offX + offY * offY;
  const cz = Math.sqrt(Math.max(0.01, shellRadius * shellRadius - cSq));
  const cLen = Math.sqrt(cSq + cz * cz) || 1;
  verts.push(offX, offY, cz);
  norms.push(offX / cLen, offY / cLen, cz / cLen);

  for (let r = 1; r <= segRings; r++) {
    const f = r / segRings;
    for (let s = 0; s < segTheta; s++) {
      const a = (s / segTheta) * Math.PI * 2;
      const x = offX + Math.cos(a) * rx * f;
      const y = offY + Math.sin(a) * ry * f;
      const rSq = x * x + y * y;
      const z = Math.sqrt(Math.max(0.01, shellRadius * shellRadius - rSq));
      verts.push(x, y, z);
      const len = Math.sqrt(x * x + y * y + z * z) || 1;
      norms.push(x / len, y / len, z / len);
    }
  }

  for (let s = 0; s < segTheta; s++) {
    const next = (s + 1) % segTheta;
    indices.push(0, 1 + s, 1 + next);
  }
  for (let r = 1; r < segRings; r++) {
    const prevRing = 1 + (r - 1) * segTheta;
    const curRing = 1 + r * segTheta;
    for (let s = 0; s < segTheta; s++) {
      const next = (s + 1) % segTheta;
      indices.push(prevRing + s, curRing + s, curRing + next);
      indices.push(prevRing + s, curRing + next, prevRing + next);
    }
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norms, 3));
  geo.setIndex(indices);
  return geo;
}

function createConformingStarGeo(
  outerRx: number,
  outerRy: number,
  points: number,
  innerRatio: number,
  shellRadius: number,
  offX = 0,
  offY = 0
): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const verts: number[] = [];
  const norms: number[] = [];
  const indices: number[] = [];

  const cSq = offX * offX + offY * offY;
  const cz = Math.sqrt(Math.max(0.01, shellRadius * shellRadius - cSq));
  const cLen = Math.sqrt(cSq + cz * cz) || 1;
  verts.push(offX, offY, cz);
  norms.push(offX / cLen, offY / cLen, cz / cLen);

  const totalSeg = points * 2;
  for (let i = 0; i < totalSeg; i++) {
    const a = (i / totalSeg) * Math.PI * 2 + Math.PI * 0.25;
    const mult = i % 2 === 0 ? 1.0 : innerRatio;
    const x = offX + Math.cos(a) * outerRx * mult;
    const y = offY + Math.sin(a) * outerRy * mult;
    const rSq = x * x + y * y;
    const z = Math.sqrt(Math.max(0.01, shellRadius * shellRadius - rSq));
    verts.push(x, y, z);
    const len = Math.sqrt(x * x + y * y + z * z) || 1;
    norms.push(x / len, y / len, z / len);
  }

  for (let i = 0; i < totalSeg; i++) {
    const next = (i + 1) % totalSeg;
    indices.push(0, 1 + i, 1 + next);
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norms, 3));
  geo.setIndex(indices);
  return geo;
}

/** Smoothly curved sculpted pin/fin geometry with continuous C1 rounded tip cap (no sharp apex rim) */
function createSculptedPinGeometry(
  baseRx: number,
  baseRz: number,
  height: number,
  softness: number,
  curveBack = 0,
  radialSegs = 14,
  heightSegs = 12
): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const s = THREE.MathUtils.clamp(softness, 0, 1);
  const verts: number[] = [];
  const indices: number[] = [];

  for (let iy = 0; iy <= heightSegs; iy++) {
    const t = iy / heightSegs;
    // Continuous rounded dome curve near top so tip softens smoothly without faceted corners
    const tipSmooth = Math.sin(Math.min(1, t) * Math.PI * 0.5);
    const sharpProfile = Math.pow(Math.max(0, 1 - t), 0.92);
    const softProfile = Math.sqrt(Math.max(0, 1 - Math.pow(t, 1.85)));
    const tipRoundCap = t > 0.82 ? Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.82) / 0.18, 2))) : 1;
    const baseBlend = THREE.MathUtils.lerp(sharpProfile, softProfile, s);
    const rProfile = iy === heightSegs ? 0 : baseBlend * (s > 0.05 ? THREE.MathUtils.lerp(1, tipRoundCap, Math.min(1, s * 1.4)) : 1);
    const yPos = THREE.MathUtils.lerp(t, tipSmooth, s * 0.22) * height;
    const zCurve = -curveBack * Math.pow(t, 1.55) * height;

    for (let ix = 0; ix < radialSegs; ix++) {
      const a = (ix / radialSegs) * Math.PI * 2;
      verts.push(
        Math.cos(a) * baseRx * rProfile,
        yPos,
        Math.sin(a) * baseRz * rProfile + zCurve
      );
    }
  }

  for (let iy = 0; iy < heightSegs; iy++) {
    const r0 = iy * radialSegs;
    const r1 = (iy + 1) * radialSegs;
    for (let ix = 0; ix < radialSegs; ix++) {
      const next = (ix + 1) % radialSegs;
      indices.push(r0 + ix, r0 + next, r1 + next);
      indices.push(r0 + ix, r1 + next, r1 + ix);
    }
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Smooth organic ear geometry that puffs from thin leaf/pinna to thick, plush, pillowed lobe
 * with zero harsh angled edges or flat corners at any thickness or softness setting.
 */
function createOrganicEarGeometry(
  baseWidth: number,
  baseThick: number,
  height: number,
  softness: number,
  thicknessFactor: number,
  curveBack = 0.12,
  hollowFront = 0.25,
  radialSegs = 22,
  heightSegs = 14
): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const s = THREE.MathUtils.clamp(softness, 0, 1);
  const thick = THREE.MathUtils.clamp(thicknessFactor, 0.35, 2.5);
  // Fattening gently puffs width & rounds edges so thickened ears feel plump and soft, never boxy
  const plumpGain = Math.max(0, thick - 1.0);
  const effSoft = THREE.MathUtils.clamp(Math.max(0.22, s) + plumpGain * 0.26, 0.22, 1.0);
  const effWidth = baseWidth * (1 + plumpGain * 0.22);
  const effThick = baseThick * thick;
  const effHollow = hollowFront * THREE.MathUtils.clamp(1.25 - thick * 0.62, 0, 1);

  const verts: number[] = [];
  const indices: number[] = [];

  // Bottom rounded pole so underside never shows a sharp cut edge
  const bottomDepth = Math.min(effThick * 0.65, height * 0.14);
  verts.push(0, -bottomDepth, 0);

  for (let iy = 0; iy <= heightSegs; iy++) {
    const t = iy / heightSegs;
    // Organic pinna longitudinal silhouette: slight belly swell near lower-mid, then C1 rounded crown dome
    const swell = Math.sin(t * Math.PI) * (0.14 + plumpGain * 0.12);
    const sharpPinna = Math.pow(Math.max(0, 1 - t), 0.78) * (1 + swell);
    const pillowLobe = Math.pow(Math.max(0, 1 - Math.pow(t, 1.85)), 0.54) * (1 + swell * 1.15);
    let rHoriz = THREE.MathUtils.lerp(sharpPinna, pillowLobe, effSoft);
    let rDepth = THREE.MathUtils.lerp(
      Math.pow(Math.max(0, 1 - t), 0.7) * (1 + swell * 0.9),
      pillowLobe,
      Math.max(effSoft, 0.45)
    );
    // Smooth dome crown cap over top 22% so tip has continuous C1 surface normals
    if (t > 0.78) {
      const u = (t - 0.78) / 0.22;
      const dome = Math.sqrt(Math.max(0, 1 - u * u));
      rHoriz *= dome;
      rDepth *= dome;
    }
    if (iy === heightSegs) {
      rHoriz = 0;
      rDepth = 0;
    }
    const yPos = t * height;
    const zCurve = -curveBack * Math.pow(t, 1.45) * height;

    for (let ix = 0; ix < radialSegs; ix++) {
      const a = (ix / radialSegs) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      // Smooth super-ellipse / organic pinna cross-section: gentle anterior bowl when thin, convex pillow when thick
      const frontPinch = sa > 0 ? -effHollow * Math.pow(ca * ca < 0.75 ? 1 - ca * ca : 0, 1.2) * (1 - t * 0.5) : 0;
      const backPillow = sa < 0 ? 0.16 * (1 + plumpGain * 0.4) * Math.sin(t * Math.PI) : 0;
      const x = ca * effWidth * rHoriz;
      const z = (sa + frontPinch - backPillow) * effThick * rDepth + zCurve;
      verts.push(x, yPos, z);
    }
  }

  // Cap bottom pole smoothly to ring 0
  const ring0Start = 1;
  for (let ix = 0; ix < radialSegs; ix++) {
    const next = (ix + 1) % radialSegs;
    indices.push(0, ring0Start + next, ring0Start + ix);
  }

  for (let iy = 0; iy < heightSegs; iy++) {
    const r0 = ring0Start + iy * radialSegs;
    const r1 = ring0Start + (iy + 1) * radialSegs;
    for (let ix = 0; ix < radialSegs; ix++) {
      const next = (ix + 1) % radialSegs;
      indices.push(r0 + ix, r0 + next, r1 + next);
      indices.push(r0 + ix, r1 + next, r1 + ix);
    }
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

interface SdfSnapResult {
  point: THREE.Vector3;
  normal: THREE.Vector3;
}

function snapToSdfSurface(
  evaluator: SdfFieldEvaluator,
  interiorOrigin: THREE.Vector3,
  rayDir: THREE.Vector3,
  fallbackWorldPt: THREE.Vector3,
  maxDist = 0.8
): SdfSnapResult {
  const dir = rayDir.clone();
  if (dir.lengthSq() < 1e-8) dir.set(0, 1, 0);
  else dir.normalize();
  const hit = evaluator.projectOutwardFromInterior(interiorOrigin, dir, maxDist);
  if (hit) return hit;
  return evaluator.projectPointToSurface(fallbackWorldPt, dir, 24);
}

function buildHornAttachment(
  bp: ResolvedMonsterBlueprint,
  hornMat: THREE.MeshStandardMaterial,
  crystalMat: THREE.MeshStandardMaterial,
  evaluator: SdfFieldEvaluator,
  headBone: THREE.Bone,
  headCenter: THREE.Vector3,
  headFwd: THREE.Vector3,
  sideRight: THREE.Vector3,
  muzzleTopAnchor: THREE.Vector3,
  yawRad: number
): THREE.Group {
  const g = new THREE.Group();
  const style = bp.hornStyle;
  if (style === 'none') return g;
  const hc = bp.horns;
  const L = THREE.MathUtils.clamp(hc.length, 0.08, 0.9);
  const T = THREE.MathUtils.clamp(hc.thickness, 0.4, 2.2);
  const soft = THREE.MathUtils.clamp(hc.softness ?? 0.14, 0, 1);
  const sweepRad = THREE.MathUtils.degToRad(hc.sweepDeg);
  const spreadX = hc.spreadX;

  const placeHornOnSkull = (
    hornObj: THREE.Object3D,
    lateralOffset: number,
    upDirWeight: number,
    fwdDirWeight: number,
    originWorld: THREE.Vector3 = headCenter,
    embed = 0.014
  ) => {
    const upVec = new THREE.Vector3(0, 1, 0);
    const ray = upVec
      .clone()
      .multiplyScalar(upDirWeight)
      .addScaledVector(sideRight, lateralOffset)
      .addScaledVector(headFwd, fwdDirWeight)
      .add(new THREE.Vector3(0, hc.offsetY * 0.45, hc.offsetZ * 0.45));
    const fallback = originWorld
      .clone()
      .addScaledVector(sideRight, lateralOffset * bp.head.midRadius)
      .addScaledVector(upVec, bp.head.midRadius * 0.72 + bp.head.crownHeight + hc.offsetY)
      .addScaledVector(headFwd, fwdDirWeight * bp.head.length * 0.25 + hc.offsetZ);
    const hit = snapToSdfSurface(evaluator, originWorld, ray, fallback, 0.85);
    const worldPlaced = hit.point.clone().addScaledVector(hit.normal, -embed);
    hornObj.position.copy(headBone.worldToLocal(worldPlaced));
    hornObj.rotation.order = 'YXZ';
    hornObj.rotation.y += yawRad;
  };

  const makeCurvedHorn = (side: -1 | 1, len: number, thick: number, curlScale: number) => {
    const pts: THREE.Vector3[] = [];
    const steps = 7;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = side * (t * 0.06 + Math.sin(t * Math.PI) * 0.04 * curlScale);
      const y = t * len * Math.cos(sweepRad * 0.55) + Math.sin(t * Math.PI) * 0.03 * curlScale;
      const z = -t * len * Math.sin(sweepRad) * 0.85 + Math.cos(t * Math.PI * 1.4) * 0.03 * curlScale;
      pts.push(new THREE.Vector3(x, y, z));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const segs = 14;
    const radSegs = 10;
    const baseRad = 0.034 * thick;
    const geo = new THREE.TubeGeometry(curve, segs, baseRad, radSegs, false);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      const ringIdx = Math.floor(i / (radSegs + 1));
      const frac = THREE.MathUtils.clamp(ringIdx / segs, 0, 1);
      const cPt = curve.getPointAt(frac);
      v.fromBufferAttribute(pos, i).sub(cPt);
      const sharpTaper = 1 - frac * 0.86;
      const softTaper = Math.pow(Math.max(0.08, 1 - Math.pow(frac, 1.8)), 0.5);
      v.multiplyScalar(THREE.MathUtils.lerp(sharpTaper, softTaper, soft));
      v.add(cPt);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, hornMat);
    m.castShadow = true;
    return m;
  };

  const spreadDirScale = spreadX / Math.max(0.06, bp.head.midRadius);

  if (style === 'twinHorns' || style === 'devilSweep') {
    ([-1, 1] as const).forEach((s) => {
      const h = makeCurvedHorn(s, L, T, style === 'devilSweep' ? 1.6 : 0.7);
      h.rotation.z = -s * 0.28;
      placeHornOnSkull(h, s * spreadDirScale * 0.72, 1.0, -0.18 + hc.offsetZ * 2.2);
      g.add(h);
    });
  } else if (style === 'ramCurl') {
    ([-1, 1] as const).forEach((s) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 10; i++) {
        const f = i / 10;
        const ang = f * Math.PI * 1.55;
        pts.push(
          new THREE.Vector3(
            s * (0.04 + f * 0.11 * T),
            Math.sin(ang) * L * 0.48,
            -Math.cos(ang) * L * 0.42 + L * 0.25
          )
        );
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const geo = new THREE.TubeGeometry(curve, 16, 0.042 * T, 10, false);
      const m = new THREE.Mesh(geo, hornMat);
      m.castShadow = true;
      placeHornOnSkull(m, s * spreadDirScale * 0.85, 0.82, -0.15 + hc.offsetZ * 2.0, headCenter, 0.018);
      g.add(m);
    });
  } else if (style === 'stagAntlers') {
    const buildOrganicBranch = (
      curve: THREE.CatmullRomCurve3,
      rStart: number,
      rEnd: number,
      segs: number,
      radSegs: number
    ) => {
      const geo = new THREE.TubeGeometry(curve, segs, rStart, radSegs, false);
      const pos = geo.attributes.position as THREE.BufferAttribute;
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        const ringIdx = Math.floor(i / (radSegs + 1));
        const frac = THREE.MathUtils.clamp(ringIdx / segs, 0, 1);
        const cPt = curve.getPointAt(frac);
        v.fromBufferAttribute(pos, i).sub(cPt);
        const sharpTaper = THREE.MathUtils.lerp(1.0, rEnd / Math.max(0.001, rStart), frac);
        const softTaper =
          rEnd / Math.max(0.001, rStart) +
          (1 - rEnd / Math.max(0.001, rStart)) * Math.pow(Math.max(0, 1 - Math.pow(frac, 1.85)), 0.52);
        v.multiplyScalar(THREE.MathUtils.lerp(sharpTaper, softTaper, soft));
        v.add(cPt);
        pos.setXYZ(i, v.x, v.y, v.z);
      }
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, hornMat);
      mesh.castShadow = true;
      // Smooth rounded cap at tine/beam tip so no harsh cut circles appear
      const tipCapR = THREE.MathUtils.lerp(rEnd, Math.max(rEnd, rStart * 0.14), soft);
      const tipCap = new THREE.Mesh(new THREE.SphereGeometry(tipCapR, 8, 6), hornMat);
      tipCap.position.copy(curve.getPointAt(1));
      const group = new THREE.Group();
      group.add(mesh, tipCap);
      return group;
    };

    ([-1, 1] as const).forEach((s) => {
      const antler = new THREE.Group();
      const baseR = 0.03 * T;
      const tipR = 0.004 * T;
      const beamRadiusAt = (frac: number) => THREE.MathUtils.lerp(baseR, tipR, frac);

      const beamPts = [
        new THREE.Vector3(0, -0.01, 0),
        new THREE.Vector3(s * 0.035, L * 0.34, -L * 0.06 * Math.sin(sweepRad)),
        new THREE.Vector3(s * 0.11, L * 0.72, -L * 0.14 * Math.sin(sweepRad)),
        new THREE.Vector3(s * 0.17, L * 1.12, -L * 0.08 * Math.sin(sweepRad)),
        new THREE.Vector3(s * 0.15, L * 1.38, L * 0.04),
      ];
      const beamCurve = new THREE.CatmullRomCurve3(beamPts);
      antler.add(buildOrganicBranch(beamCurve, baseR, tipR, 18, 10));

      // Sculpted organic burr/coronet ring at skull root
      const burr = new THREE.Mesh(new THREE.SphereGeometry(baseR * 1.28, 10, 8), hornMat);
      burr.scale.set(1.1, 0.65, 1.1);
      burr.position.copy(beamPts[0]).add(new THREE.Vector3(0, 0.012, 0));
      antler.add(burr);

      // Helper to grow a tine directly out of an exact point inside the main beam curve
      const addForkTine = (tFork: number, offsetMid: THREE.Vector3, offsetTip: THREE.Vector3, rScale: number) => {
        const forkRoot = beamCurve.getPointAt(tFork);
        const tangent = beamCurve.getTangentAt(tFork).normalize();
        const rFork = beamRadiusAt(tFork) * 0.88;
        const p1 = forkRoot.clone().addScaledVector(tangent, L * 0.045).addScaledVector(offsetMid, 0.35);
        const p2 = forkRoot.clone().add(offsetMid);
        const p3 = forkRoot.clone().add(offsetTip);
        const tineCurve = new THREE.CatmullRomCurve3([forkRoot, p1, p2, p3]);
        antler.add(buildOrganicBranch(tineCurve, rFork * rScale, tipR * 0.85, 12, 8));

        // Smooth knuckle swell at the fork junction so branch merges seamlessly into main beam
        const knot = new THREE.Mesh(new THREE.SphereGeometry(beamRadiusAt(tFork) * 1.06, 9, 7), hornMat);
        knot.position.copy(forkRoot);
        antler.add(knot);
      };

      // Brow tine (sweeps forward and up from lower beam)
      addForkTine(
        0.24,
        new THREE.Vector3(s * 0.03, L * 0.14, L * 0.14),
        new THREE.Vector3(s * 0.055, L * 0.32, L * 0.24),
        0.92
      );
      // Trez tine (sweeps forward-outward from mid beam)
      addForkTine(
        0.52,
        new THREE.Vector3(s * 0.05, L * 0.18, L * 0.11),
        new THREE.Vector3(s * 0.08, L * 0.42, L * 0.19),
        0.88
      );
      // Upper crown fork (splits upward-outward near top)
      addForkTine(
        0.74,
        new THREE.Vector3(s * 0.075, L * 0.16, -L * 0.04),
        new THREE.Vector3(s * 0.13, L * 0.36, -L * 0.07),
        0.82
      );

      placeHornOnSkull(antler, s * spreadDirScale * 0.7, 1.0, -0.22 + hc.offsetZ * 2.0);
      g.add(antler);
    });
  } else if (style === 'crownSpikes' || style === 'crystalCrown') {
    const mat = style === 'crystalCrown' ? crystalMat : hornMat;
    const count = 5;
    for (let i = 0; i < count; i++) {
      const frac = i / (count - 1) - 0.5;
      const len = L * (1.0 - Math.abs(frac) * 0.35);
      const sp = new THREE.Mesh(
        createSculptedPinGeometry(0.032 * T, 0.032 * T, len, style === 'crystalCrown' ? Math.min(0.35, soft) : soft, 0.12, style === 'crystalCrown' ? 6 : 10, 8),
        mat
      );
      sp.rotation.set(-sweepRad * 0.8, 0, -frac * 0.72);
      sp.castShadow = true;
      placeHornOnSkull(sp, frac * spreadDirScale * 1.4, 1.0, -0.24 - Math.abs(frac) * 0.35 + hc.offsetZ * 2.0);
      g.add(sp);
    }
  } else if (style === 'rhinoHorn' || style === 'unicorn') {
    const mat = style === 'unicorn' ? crystalMat : hornMat;
    const h = makeCurvedHorn(1, L * (style === 'unicorn' ? 1.35 : 0.95), T * (style === 'unicorn' ? 0.85 : 1.35), 0.35);
    h.rotation.x = style === 'unicorn' ? 0.35 : 0.65;
    if (style === 'unicorn') {
      (h as THREE.Mesh).material = mat;
    }
    const useAnchor = style === 'rhinoHorn' ? muzzleTopAnchor : headCenter;
    placeHornOnSkull(h, 0, style === 'rhinoHorn' ? 0.75 : 0.92, style === 'rhinoHorn' ? 0.72 : 0.45 + hc.offsetZ * 2.0, useAnchor, 0.016);
    g.add(h);
  }
  return g;
}

function buildEarAttachment(
  side: -1 | 1,
  cfg: MonsterEarsConfig,
  outerMat: THREE.MeshStandardMaterial,
  innerMat: THREE.MeshStandardMaterial
): THREE.Group {
  const g = new THREE.Group();
  const s = THREE.MathUtils.clamp(cfg.size, 0.35, 2.2);
  const thick = THREE.MathUtils.clamp(cfg.thickness ?? 1.0, 0.35, 2.5);
  const plumpGain = Math.max(0, thick - 1.0);
  const soft = THREE.MathUtils.clamp(cfg.softness ?? 0.2, 0, 1);
  if (cfg.style === 'none') return g;

  if (cfg.style === 'bearRound') {
    const zScale = THREE.MathUtils.clamp(0.46 * thick, 0.22, 1.05);
    const xyScale = 1.0 + plumpGain * 0.16;
    const outer = new THREE.Mesh(new THREE.SphereGeometry(0.066 * s, 20, 16), outerMat);
    outer.scale.set(xyScale, xyScale, zScale);
    outer.castShadow = true;
    const inner = new THREE.Mesh(new THREE.SphereGeometry(0.042 * s, 16, 12), innerMat);
    inner.scale.set(1.0 + plumpGain * 0.12, 1.0 + plumpGain * 0.12, Math.max(0.24, zScale * 0.68));
    inner.position.z = 0.066 * s * zScale * 0.48;
    g.add(outer, inner);
  } else if (cfg.style === 'floppy') {
    const zScale = THREE.MathUtils.clamp(0.46 * thick, 0.22, 1.02);
    const lobeGeo = createOrganicEarGeometry(
      0.046 * s,
      0.042 * s,
      0.165 * s,
      Math.max(0.62, soft),
      thick,
      -0.06,
      0.08,
      20,
      12
    );
    const lobe = new THREE.Mesh(lobeGeo, outerMat);
    lobe.position.set(side * 0.022 * s, -0.015 * s, 0);
    lobe.rotation.set(0.18, 0, Math.PI - side * 0.28);
    lobe.castShadow = true;
    const innerGeo = createOrganicEarGeometry(
      0.028 * s,
      0.022 * s,
      0.118 * s,
      Math.max(0.68, soft),
      Math.max(0.75, thick * 0.85),
      -0.04,
      0.0,
      16,
      10
    );
    const inner = new THREE.Mesh(innerGeo, innerMat);
    inner.position.copy(lobe.position);
    inner.position.z += 0.042 * s * zScale * 0.45;
    inner.position.y -= 0.012 * s;
    inner.rotation.copy(lobe.rotation);
    g.add(lobe, inner);
  } else if (cfg.style === 'batFin' || cfg.style === 'frill') {
    const finGeo = createOrganicEarGeometry(
      0.076 * s,
      0.024 * s,
      0.175 * s,
      Math.max(soft, 0.28),
      thick,
      0.2,
      0.26,
      22,
      14
    );
    const fin = new THREE.Mesh(finGeo, outerMat);
    fin.position.set(side * 0.018 * s, -0.015 * s, -0.01);
    fin.rotation.set(-0.2, side * 0.28, -side * 0.88);
    fin.castShadow = true;
    const ribGeo = createOrganicEarGeometry(
      0.044 * s,
      0.015 * s,
      0.128 * s,
      Math.max(soft, 0.35),
      Math.max(0.75, thick * 0.85),
      0.16,
      0.05,
      16,
      10
    );
    const rib = new THREE.Mesh(ribGeo, innerMat);
    rib.position.copy(fin.position);
    rib.position.z += 0.024 * s * thick * 0.48;
    rib.rotation.copy(fin.rotation);
    g.add(fin, rib);
  } else {
    // wolfPerk / foxTall: smooth curved pinna with plump rounded lobe thickness support
    const hMult = cfg.style === 'foxTall' ? 1.36 : 1.0;
    const outerGeo = createOrganicEarGeometry(
      0.058 * s,
      0.032 * s,
      0.148 * s * hMult,
      soft,
      thick,
      0.11,
      0.32,
      22,
      14
    );
    const outer = new THREE.Mesh(outerGeo, outerMat);
    outer.position.y = -0.008 * s;
    outer.castShadow = true;
    const innerGeo = createOrganicEarGeometry(
      0.035 * s,
      0.017 * s,
      0.1 * s * hMult,
      Math.max(soft, 0.3),
      Math.max(0.8, thick * 0.86),
      0.09,
      0.04,
      16,
      10
    );
    const inner = new THREE.Mesh(innerGeo, innerMat);
    inner.position.set(0, 0.004 * s, 0.032 * s * thick * 0.48);
    g.add(outer, inner);
  }
  return g;
}

function createWingMembraneTexture(
  wingColor: string,
  tipColor: string,
  style: MonsterWingStyle
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const baseCol = new THREE.Color(wingColor || '#EA580C');
  const tipCol = new THREE.Color(tipColor || '#F59E0B');
  const darkCol = baseCol.clone().multiplyScalar(0.55);
  const warmCol = baseCol.clone().lerp(new THREE.Color('#FFFBEB'), 0.28);

  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0.0, `#${darkCol.getHexString()}`);
  grad.addColorStop(0.32, `#${baseCol.getHexString()}`);
  grad.addColorStop(0.75, `#${warmCol.getHexString()}`);
  grad.addColorStop(1.0, `#${tipCol.getHexString()}`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Darker edge vein shadow along left/right finger borders (u=0 and u=1)
  const edgeL = ctx.createLinearGradient(0, 0, size * 0.22, 0);
  edgeL.addColorStop(0, `rgba(${Math.round(darkCol.r * 255)},${Math.round(darkCol.g * 255)},${Math.round(darkCol.b * 255)},0.58)`);
  edgeL.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = edgeL;
  ctx.fillRect(0, 0, size * 0.22, size);

  const edgeR = ctx.createLinearGradient(size, 0, size * 0.78, 0);
  edgeR.addColorStop(0, `rgba(${Math.round(darkCol.r * 255)},${Math.round(darkCol.g * 255)},${Math.round(darkCol.b * 255)},0.58)`);
  edgeR.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = edgeR;
  ctx.fillRect(size * 0.78, 0, size * 0.22, size);

  // Branching organic skin veins & leathery creases / fairy veinlets
  const isFairy = style === 'fairyInsect' || style === 'elementalEnergy';
  ctx.strokeStyle = isFairy
    ? `rgba(255,255,255,0.42)`
    : `rgba(${Math.round(darkCol.r * 190)},${Math.round(darkCol.g * 190)},${Math.round(darkCol.b * 190)},0.34)`;
  ctx.lineCap = 'round';
  const veinCount = isFairy ? 22 : 16;
  for (let i = 0; i < veinCount; i++) {
    const startX = i % 2 === 0 ? 4 : size - 4;
    const dir = i % 2 === 0 ? 1 : -1;
    const startY = ((i + 0.5) / veinCount) * size * 0.9;
    ctx.lineWidth = isFairy ? 1.4 : 2.1;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    const midX = startX + dir * (40 + hashInt01(i * 19 + 3) * 75);
    const midY = startY + (hashInt01(i * 31 + 7) - 0.35) * 44;
    const endX = midX + dir * (25 + hashInt01(i * 47 + 11) * 55);
    const endY = midY + (hashInt01(i * 61 + 13) - 0.3) * 38;
    ctx.quadraticCurveTo(midX, midY, endX, endY);
    ctx.stroke();
  }

  // Subtle horizontal membrane tension wrinkles across leathery dragon wings
  if (!isFairy) {
    ctx.strokeStyle = `rgba(20,12,8,0.16)`;
    ctx.lineWidth = 1.6;
    for (let w = 1; w <= 7; w++) {
      const y = (w / 8) * size;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.quadraticCurveTo(size * 0.5, y + 14, size, y);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Builds a curved, cambered, concave-scalloped membrane panel directly between two 3D bone splines */
function buildMembranePanelGeometry(
  curveA: THREE.Curve<THREE.Vector3>,
  curveB: THREE.Curve<THREE.Vector3>,
  scallopDepth = 0.24,
  camberHeight = 0.025,
  uSegs = 10,
  tSegs = 10
): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const verts: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const pA = new THREE.Vector3();
  const pB = new THREE.Vector3();
  const pt = new THREE.Vector3();

  for (let it = 0; it <= tSegs; it++) {
    const t = it / tSegs;
    for (let iu = 0; iu <= uSegs; iu++) {
      const u = iu / uSegs;
      const tEffective = THREE.MathUtils.clamp(
        t * (1 - scallopDepth * Math.pow(t, 1.4) * Math.sin(u * Math.PI)),
        0,
        1
      );
      curveA.getPoint(tEffective, pA);
      curveB.getPoint(tEffective, pB);
      pt.lerpVectors(pA, pB, u);
      pt.y += Math.sin(u * Math.PI) * Math.sin(t * Math.PI) * camberHeight;
      verts.push(pt.x, pt.y, pt.z);
      uvs.push(u, t);
    }
  }

  const row = uSegs + 1;
  for (let it = 0; it < tSegs; it++) {
    for (let iu = 0; iu < uSegs; iu++) {
      const a = it * row + iu;
      const b = a + 1;
      const c = (it + 1) * row + iu;
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Builds a realistic organic feather vane whose sides curve gracefully out in the middle and taper cleanly back in to a rounded tip */
function createFeatherBladeGeometry(
  length: number,
  width: number,
  camber = 0.018
): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const segsV = 14;
  const uNorms = [-1, -0.45, 0, 0.45, 1];
  const cols = uNorms.length;
  const verts: number[] = [];
  const indices: number[] = [];

  for (let iv = 0; iv <= segsV; iv++) {
    const v = iv / segsV;
    // Narrow quill entry -> graceful outward mid-blade swell -> smooth inward curve to convex rounded tip
    const midArch = Math.pow(Math.sin(THREE.MathUtils.clamp(v, 0, 1) * Math.PI), 0.65);
    const widthProfile = 0.28 * Math.pow(1 - v, 1.6) + 0.92 * midArch;
    const droop = -Math.pow(v, 1.75) * length * 0.07 + Math.sin(v * Math.PI) * camber;
    for (let ic = 0; ic < cols; ic++) {
      const u = uNorms[ic];
      const x = u * width * 0.5 * widthProfile;
      const archCross = (1 - u * u) * 0.0045 * (1 - v * 0.45);
      const quillBump = Math.abs(u) < 0.08 ? 0.0038 * (1 - v * 0.5) : 0;
      const y = droop + archCross + quillBump;
      const z = -v * length;
      verts.push(x, y, z);
    }
  }

  for (let iv = 0; iv < segsV; iv++) {
    const r0 = iv * cols;
    const r1 = (iv + 1) * cols;
    for (let ic = 0; ic < cols - 1; ic++) {
      indices.push(r0 + ic, r1 + ic, r0 + ic + 1);
      indices.push(r0 + ic + 1, r1 + ic, r1 + ic + 1);
    }
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildTaperedBoneMesh(
  pts: THREE.Vector3[],
  rStart: number,
  rEnd: number,
  mat: THREE.Material
): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(pts);
  const segs = 12;
  const radSegs = 8;
  const geo = new THREE.TubeGeometry(curve, segs, rStart, radSegs, false);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const ratio = rEnd / Math.max(0.001, rStart);
  for (let i = 0; i < pos.count; i++) {
    const ringIdx = Math.floor(i / (radSegs + 1));
    const frac = THREE.MathUtils.clamp(ringIdx / segs, 0, 1);
    const cPt = curve.getPointAt(frac);
    v.fromBufferAttribute(pos, i).sub(cPt);
    v.multiplyScalar(THREE.MathUtils.lerp(1.0, ratio, frac));
    v.add(cPt);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return mesh;
}

function buildMonsterWingSide(
  side: -1 | 1,
  bp: ResolvedMonsterBlueprint,
  innerPivot: THREE.Bone,
  outerPivot: THREE.Bone,
  boneMat: THREE.MeshStandardMaterial,
  membraneMat: THREE.MeshStandardMaterial,
  tipMat: THREE.MeshStandardMaterial
): THREE.Object3D[] {
  const created: THREE.Object3D[] = [];
  const style = bp.wingStyle;
  if (style === 'none') return created;

  const wc = bp.wings;
  const span = THREE.MathUtils.clamp(wc.span, 0.35, 2.4);
  const chord = THREE.MathUtils.clamp(wc.chordWidth, 0.22, 1.2);
  const innerLen = span * 0.44;
  const outerLen = span * 0.62;
  const ribCount = Math.max(3, Math.min(6, Math.round(wc.ribCount)));
  const memOpacity = THREE.MathUtils.clamp(wc.membraneOpacity ?? 0.76, 0.15, 0.98);

  const isFeather = style === 'feathered';
  const isFairy = style === 'fairyInsect' || style === 'elementalEnergy';

  const wingTex = createWingMembraneTexture(wc.wingColor, wc.tipColor, style);

  if (isFairy) {
    // Thin cambered translucent veined fairy / dragonfly / elemental membrane wings
    const fairyMat = style === 'elementalEnergy'
      ? new THREE.MeshStandardMaterial({
          color: wc.wingColor,
          map: wingTex ?? undefined,
          emissive: wc.wingColor,
          emissiveIntensity: 0.92,
          transparent: true,
          opacity: memOpacity,
          roughness: 0.25,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      : new THREE.MeshPhysicalMaterial({
          color: wc.wingColor,
          map: wingTex ?? undefined,
          emissive: wc.tipColor,
          emissiveIntensity: 0.24,
          transparent: true,
          opacity: Math.min(0.88, memOpacity * 0.9),
          roughness: 0.28,
          side: THREE.DoubleSide,
          depthWrite: false,
        });

    // Forewing: leading curve + trailing scalloped petal curve
    const foreLead = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(side * span * 0.45, chord * 0.26, chord * 0.16),
      new THREE.Vector3(side * span * 0.92, chord * 0.32, chord * 0.04),
      new THREE.Vector3(side * span * 1.02, chord * 0.12, -chord * 0.14),
    ]);
    const foreTrail = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, -chord * 0.08),
      new THREE.Vector3(side * span * 0.34, chord * 0.06, -chord * 0.42),
      new THREE.Vector3(side * span * 0.72, chord * 0.02, -chord * 0.46),
      new THREE.Vector3(side * span * 1.02, chord * 0.12, -chord * 0.14),
    ]);
    const foreGeo = buildMembranePanelGeometry(foreLead, foreTrail, 0.06, 0.032, 12, 10);
    const foreMesh = new THREE.Mesh(foreGeo, fairyMat);
    innerPivot.add(foreMesh);
    created.push(foreMesh);

    const leadSpar = buildTaperedBoneMesh(foreLead.getPoints(5), 0.015, 0.005, boneMat);
    innerPivot.add(leadSpar);
    created.push(leadSpar);

    // Delicate internal fairy veins
    for (let vIdx = 0; vIdx < 3; vIdx++) {
      const f = (vIdx + 1) / 4;
      const veinStart = foreLead.getPoint(f * 0.65);
      const veinEnd = foreTrail.getPoint(0.28 + f * 0.56);
      const veinMid = veinStart.clone().lerp(veinEnd, 0.5);
      veinMid.y += 0.016;
      const vein = buildTaperedBoneMesh([veinStart, veinMid, veinEnd], 0.006, 0.0025, boneMat);
      innerPivot.add(vein);
      created.push(vein);
    }

    // Hindwing petal
    const hindLead = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.015, -chord * 0.08),
      new THREE.Vector3(side * span * 0.36, -chord * 0.02, -chord * 0.22),
      new THREE.Vector3(side * span * 0.74, -chord * 0.08, -chord * 0.38),
    ]);
    const hindTrail = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.02, -chord * 0.24),
      new THREE.Vector3(side * span * 0.25, -chord * 0.12, -chord * 0.72),
      new THREE.Vector3(side * span * 0.58, -chord * 0.14, -chord * 0.68),
      new THREE.Vector3(side * span * 0.74, -chord * 0.08, -chord * 0.38),
    ]);
    const hindGeo = buildMembranePanelGeometry(hindLead, hindTrail, 0.08, 0.02, 10, 8);
    const hindMesh = new THREE.Mesh(hindGeo, fairyMat);
    innerPivot.add(hindMesh);
    created.push(hindMesh);
    const hindSpar = buildTaperedBoneMesh(hindLead.getPoints(4), 0.011, 0.004, boneMat);
    innerPivot.add(hindSpar);
    created.push(hindSpar);

    return created;
  }

  // Articulated anatomical shoulder -> elbow -> raised wrist arm skeleton
  const shoulderPt = new THREE.Vector3(0, 0, 0);
  const elbowPt = new THREE.Vector3(side * innerLen * 0.44, -innerLen * 0.14, -chord * 0.22);
  const wristPt = outerPivot.position.clone(); // matches wristOffset (side*innerLen, innerLen*0.34, chord*0.08)

  const armBoneMesh = buildTaperedBoneMesh([shoulderPt, elbowPt, wristPt], 0.032, 0.021, boneMat);
  innerPivot.add(armBoneMesh);
  created.push(armBoneMesh);

  const elbowJoint = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), boneMat);
  elbowJoint.position.copy(elbowPt);
  innerPivot.add(elbowJoint);
  created.push(elbowJoint);

  const wristJoint = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), boneMat);
  wristJoint.position.copy(wristPt);
  innerPivot.add(wristJoint);
  created.push(wristJoint);

  if (isFeather) {
    // Cohesive dual-layer cambered flight feathers (upper coverts + top flight layer + offset lower under-layer)
    const underLayerMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(wc.wingColor).lerp(new THREE.Color(wc.tipColor), 0.35),
      roughness: 0.84,
      metalness: 0.0,
      envMapIntensity: 0.2,
      side: THREE.DoubleSide,
    });

    // Sculpted fluffy arm plumage bolster bridging shoulder -> elbow -> wrist so roots don't look bare
    const armCoverGeo = buildTaperedBoneMesh([shoulderPt, elbowPt, wristPt], 0.056, 0.038, membraneMat);
    innerPivot.add(armCoverGeo);
    created.push(armCoverGeo);

    const secCount = ribCount + 5;
    for (let i = 0; i < secCount; i++) {
      const f = i / Math.max(1, secCount - 1);
      const tPos = new THREE.Vector3().lerpVectors(shoulderPt, wristPt, f * 0.94);
      tPos.y += Math.sin(f * Math.PI) * -0.055;
      const flen = chord * (0.76 + 0.34 * Math.sin(f * Math.PI));
      const fGeo = createFeatherBladeGeometry(flen, chord * 0.28, 0.022);
      const feather = new THREE.Mesh(fGeo, i % 3 === 0 ? tipMat : membraneMat);
      feather.position.copy(tPos);
      feather.rotation.set(0.05, -side * (0.04 + f * 0.16), side * 0.04);
      feather.castShadow = true;
      innerPivot.add(feather);
      created.push(feather);

      // Offset lower secondary feather layer peeking beneath spaces between upper feathers
      if (i < secCount - 1) {
        const fMid = (i + 0.5) / Math.max(1, secCount - 1);
        const uPos = new THREE.Vector3().lerpVectors(shoulderPt, wristPt, fMid * 0.94);
        uPos.y += Math.sin(fMid * Math.PI) * -0.055 - 0.015;
        uPos.z -= 0.012;
        const uLen = chord * (0.64 + 0.28 * Math.sin(fMid * Math.PI));
        const uGeo = createFeatherBladeGeometry(uLen, chord * 0.25, 0.016);
        const uFeather = new THREE.Mesh(uGeo, underLayerMat);
        uFeather.position.copy(uPos);
        uFeather.rotation.set(0.02, -side * (0.05 + fMid * 0.17), side * 0.04);
        innerPivot.add(uFeather);
        created.push(uFeather);
      }

      // Shorter overlapping upper covert plumage along the leading arm
      if (i % 2 === 0) {
        const covGeo = createFeatherBladeGeometry(flen * 0.52, chord * 0.25, 0.015);
        const cov = new THREE.Mesh(covGeo, tipMat);
        cov.position.copy(tPos).add(new THREE.Vector3(0, 0.013, 0.004));
        cov.rotation.set(0.09, -side * (0.04 + f * 0.15), side * 0.04);
        innerPivot.add(cov);
        created.push(cov);
      }
    }

    const primCount = ribCount + 6;
    for (let i = 0; i < primCount; i++) {
      const f = i / Math.max(1, primCount - 1);
      const flen = chord * (1.06 - f * 0.44);
      const fGeo = createFeatherBladeGeometry(flen, chord * 0.27, 0.024);
      const feather = new THREE.Mesh(fGeo, f > 0.62 ? tipMat : membraneMat);
      feather.position.set(side * (f * outerLen * 0.95), -f * 0.045, -f * 0.075);
      feather.rotation.set(0.04, -side * (0.14 + f * 0.62), -side * f * 0.11);
      feather.castShadow = true;
      outerPivot.add(feather);
      created.push(feather);

      // Offset lower primary feather layer beneath between upper primary gaps
      if (i < primCount - 1) {
        const fMid = (i + 0.5) / Math.max(1, primCount - 1);
        const uLen = chord * (0.9 - fMid * 0.38);
        const uGeo = createFeatherBladeGeometry(uLen, chord * 0.24, 0.018);
        const uFeather = new THREE.Mesh(uGeo, underLayerMat);
        uFeather.position.set(side * (fMid * outerLen * 0.95), -fMid * 0.045 - 0.015, -fMid * 0.075 - 0.012);
        uFeather.rotation.set(0.01, -side * (0.15 + fMid * 0.62), -side * fMid * 0.11);
        outerPivot.add(uFeather);
        created.push(uFeather);
      }
    }
    return created;
  }

  // Dragon / Bat / Wyvern: Semitransparent veined membrane + articulated bone framework
  const transMemMat = new THREE.MeshStandardMaterial({
    color: wc.wingColor,
    map: wingTex ?? undefined,
    transparent: true,
    opacity: memOpacity,
    roughness: 0.74,
    metalness: 0.02,
    envMapIntensity: 0.25,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  // 1. Inner wing membrane panel connecting flank/elbow to wrist & inner edge
  const innerShoulderToFlank = new THREE.CatmullRomCurve3([
    shoulderPt,
    elbowPt.clone().add(new THREE.Vector3(0, -0.03, -chord * 0.15)),
    new THREE.Vector3(side * innerLen * 0.14, -chord * 0.28, -chord * 0.65),
    new THREE.Vector3(side * innerLen * 0.02, -chord * 0.42, -chord * 0.95),
  ]);
  const innerWristToTrail = new THREE.CatmullRomCurve3([
    wristPt,
    wristPt.clone().add(new THREE.Vector3(side * 0.06, -chord * 0.22, -chord * 0.38)),
    wristPt.clone().add(new THREE.Vector3(side * 0.08, -chord * 0.56, -chord * 0.92)),
  ]);
  const innerMemGeo = buildMembranePanelGeometry(innerShoulderToFlank, innerWristToTrail, 0.26, 0.028, 10, 10);
  const innerMem = new THREE.Mesh(innerMemGeo, transMemMat);
  innerMem.renderOrder = 2;
  innerPivot.add(innerMem);
  created.push(innerMem);

  // 2. Hooked thumb spur claw at the raised wrist apex
  const thumbCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(side * 0.035, 0.068, 0.042),
    new THREE.Vector3(side * 0.048, 0.11, 0.095),
  ]);
  const thumbMesh = buildTaperedBoneMesh(thumbCurve.getPoints(4), 0.022, 0.004, tipMat);
  outerPivot.add(thumbMesh);
  created.push(thumbMesh);

  // 3. Articulated curved finger bones radiating from wrist apex
  const fingerCurves: THREE.CatmullRomCurve3[] = [];
  for (let r = 0; r < ribCount; r++) {
    const f = r / Math.max(1, ribCount - 1);
    const sweepAngle = -0.18 + f * 1.42;
    const fLen = outerLen * (1.06 - f * 0.28);
    const endX = side * Math.cos(sweepAngle) * fLen;
    const endY = -f * chord * 0.55 - Math.sin(f * Math.PI * 0.6) * chord * 0.16;
    const endZ = -Math.sin(sweepAngle) * fLen * 0.72 - f * chord * 0.42;

    const mid1 = new THREE.Vector3(
      endX * 0.42,
      endY * 0.2 + (r === 0 ? 0.09 : 0.05 * (1 - f)),
      endZ * 0.35 + (r === 0 ? 0.06 : 0)
    );
    const mid2 = new THREE.Vector3(
      endX * 0.76,
      endY * 0.66 + 0.02,
      endZ * 0.74
    );
    const endPt = new THREE.Vector3(endX, endY, endZ);

    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), mid1, mid2, endPt]);
    fingerCurves.push(curve);

    const fingerMesh = buildTaperedBoneMesh(curve.getPoints(5), 0.021 * (1 - f * 0.25), 0.0055, boneMat);
    outerPivot.add(fingerMesh);
    created.push(fingerMesh);

    // Subtle mid-knuckle + pointed tip claw spur
    const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.017 * (1 - f * 0.2), 8, 6), boneMat);
    knuckle.position.copy(mid1);
    outerPivot.add(knuckle);
    created.push(knuckle);

    const tipDir = endPt.clone().sub(mid2).normalize();
    const tipClaw = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.048, 6), tipMat);
    tipClaw.position.copy(endPt).addScaledVector(tipDir, 0.02);
    tipClaw.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tipDir);
    outerPivot.add(tipClaw);
    created.push(tipClaw);
  }

  // 4. Scalloped curved membrane bays between every pair of adjacent fingers
  for (let r = 0; r < fingerCurves.length - 1; r++) {
    const bayGeo = buildMembranePanelGeometry(
      fingerCurves[r],
      fingerCurves[r + 1],
      0.22,
      0.026,
      10,
      10
    );
    const bay = new THREE.Mesh(bayGeo, transMemMat);
    bay.renderOrder = 2;
    outerPivot.add(bay);
    created.push(bay);
  }

  // 5. Trailing bridge bay closing innermost finger smoothly to the inner trailing edge
  const innermostFinger = fingerCurves[fingerCurves.length - 1];
  const innerBridgeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(side * 0.04, -chord * 0.22, -chord * 0.38),
    new THREE.Vector3(side * 0.06, -chord * 0.52, -chord * 0.88),
  ]);
  const bridgeGeo = buildMembranePanelGeometry(innermostFinger, innerBridgeCurve, 0.25, 0.024, 9, 9);
  const bridgeBay = new THREE.Mesh(bridgeGeo, transMemMat);
  bridgeBay.renderOrder = 2;
  outerPivot.add(bridgeBay);
  created.push(bridgeBay);

  return created;
}

function buildDorsalSpikes(
  bp: ResolvedMonsterBlueprint,
  chestPos: THREE.Vector3,
  torsoPos: THREE.Vector3,
  hipsPos: THREE.Vector3,
  bodyPivotBone: THREE.Bone,
  evaluator: SdfFieldEvaluator,
  spikeMat: THREE.MeshStandardMaterial,
  tipMat: THREE.MeshStandardMaterial
): THREE.Object3D[] {
  const created: THREE.Object3D[] = [];
  if (!bp.spikes.enabled) return created;

  const sc = bp.spikes;
  const count = THREE.MathUtils.clamp(Math.round(sc.count), 2, 14);
  const soft = THREE.MathUtils.clamp(sc.softness ?? 0.2, 0, 1);
  const sinkDepth = THREE.MathUtils.clamp(sc.sinkDepth ?? 0.016, 0, 0.14);
  const sweepRad = THREE.MathUtils.degToRad(sc.sweepDeg);
  const zFront = chestPos.z + bp.chest.length * 0.35;
  const zBack = hipsPos.z - bp.hips.length * 0.3;
  const totalSpineSpan = Math.abs(zFront - zBack) * Math.max(0.1, sc.endFrac - sc.startFrac);
  const stepZ = totalSpineSpan / Math.max(1, count - 1);
  const upAxis = new THREE.Vector3(0, 1, 0);
  const xAxis = new THREE.Vector3(1, 0, 0);

  for (let i = 0; i < count; i++) {
    const f = count === 1 ? 0.5 : i / (count - 1);
    const t = THREE.MathUtils.lerp(sc.startFrac, sc.endFrac, f);
    const zPos = THREE.MathUtils.lerp(zFront, zBack, t);
    const bodyR = THREE.MathUtils.lerp(bp.chest.midRadius, bp.hips.midRadius, t);
    const arch = Math.sin(t * Math.PI) * bp.torso.archY;
    const spineY =
      t < 0.5
        ? THREE.MathUtils.lerp(chestPos.y, torsoPos.y, t * 2)
        : THREE.MathUtils.lerp(torsoPos.y, hipsPos.y, (t - 0.5) * 2);
    const spineOrigin = new THREE.Vector3(0, spineY, zPos);

    const hMult = 0.72 + Math.sin(f * Math.PI) * 0.45;
    const sLen = sc.length * hMult;
    const thickMult = THREE.MathUtils.clamp(sc.thickness, 0.4, 2.8);
    const sRadX = 0.034 * thickMult * hMult;
    // Cap longitudinal Z footprint smoothly below half-step spacing so thick spikes never slice/Z-fight through neighbors
    const sRadZ = Math.min(0.034 * thickMult * hMult, stepZ * 0.43);

    // Extend a subtle tapered root skirt below y=0 (-rootSkirt .. 0) so tilting never lifts edges off curved backs
    const rootSkirt = 0.028;
    const addRootSkirt = (g: THREE.BufferGeometry) => {
      g.translate(0, 0, 0);
      return g;
    };

    let geo: THREE.BufferGeometry;
    if (sc.style === 'dorsalFins') {
      geo = createSculptedPinGeometry(sRadX * 0.52, Math.min(sRadZ * 1.95, stepZ * 0.46), sLen * 1.12 + rootSkirt, soft, 0.28, 12, 10);
    } else if (sc.style === 'crystalSpines') {
      if (soft > 0.35) {
        geo = createSculptedPinGeometry(sRadX * 0.92, sRadZ * 0.95, sLen + rootSkirt, soft, 0.1, 8, 8);
      } else {
        geo = new THREE.OctahedronGeometry(1, 0);
        geo.scale(sRadX * 0.92, (sLen + rootSkirt) * 0.58, sRadZ * 0.92);
        geo.translate(0, (sLen + rootSkirt) * 0.32, 0);
      }
    } else if (sc.style === 'armoredPlates') {
      const roundScale = THREE.MathUtils.lerp(0.58, 1.0, soft);
      const plateH = sLen * 0.38 + rootSkirt;
      geo = new THREE.CylinderGeometry(1 * roundScale, 1.16, plateH, soft > 0.3 ? 14 : 6);
      geo.scale(sRadX * 2.25, 1.0, Math.min(sRadZ * 1.95, stepZ * 0.45));
      geo.translate(0, plateH * 0.42, 0);
    } else if (sc.style === 'maneTufts') {
      geo = createSculptedPinGeometry(sRadX * 1.38, Math.min(sRadZ * 1.12, stepZ * 0.45), sLen * 1.15 + rootSkirt, Math.max(0.45, soft), 0.35, 14, 10);
    } else {
      geo = createSculptedPinGeometry(sRadX, sRadZ * 1.04, sLen + rootSkirt, soft, 0.18, 12, 10);
    }
    addRootSkirt(geo);

    const fallbackTop = new THREE.Vector3(0, spineY + bodyR * 0.8 + arch, zPos);
    const upHit = snapToSdfSurface(evaluator, spineOrigin, upAxis, fallbackTop, 0.75);
    const staggerLift = (sc.style === 'armoredPlates' || sc.style === 'dorsalFins') ? (i % 2) * 0.0018 : 0;
    const sinkOffset = -(rootSkirt * 0.65 + sinkDepth) + staggerLift;

    const mesh = new THREE.Mesh(geo, i % 2 === 0 ? spikeMat : tipMat);
    mesh.position.copy(
      bodyPivotBone.worldToLocal(upHit.point.clone().addScaledVector(upHit.normal, sinkOffset))
    );
    // Align spike base flush to the exact surface normal of the back, then apply user sweep pitch
    const qFlush = new THREE.Quaternion().setFromUnitVectors(upAxis, upHit.normal);
    const qSweep = new THREE.Quaternion().setFromAxisAngle(xAxis, -sweepRad);
    mesh.quaternion.copy(qFlush).multiply(qSweep);
    mesh.castShadow = true;
    bodyPivotBone.add(mesh);
    created.push(mesh);

    // Side mane tuft flanking tufts projected onto actual shoulder/back flanks
    if (sc.style === 'maneTufts') {
      ([-1, 1] as const).forEach((side) => {
        const sideGeo = createSculptedPinGeometry(sRadX * 1.05, sRadZ * 0.9, sLen * 0.78 + rootSkirt, Math.max(0.5, soft), 0.32, 12, 8);
        const sideMesh = new THREE.Mesh(sideGeo, side < 0 ? spikeMat : tipMat);
        const sideRay = new THREE.Vector3(side * 0.46, 0.88, 0);
        const sideFallback = new THREE.Vector3(side * bodyR * 0.36, spineY + bodyR * 0.68, zPos);
        const sHit = snapToSdfSurface(evaluator, spineOrigin, sideRay, sideFallback, 0.75);
        sideMesh.position.copy(
          bodyPivotBone.worldToLocal(sHit.point.clone().addScaledVector(sHit.normal, -(rootSkirt * 0.65 + sinkDepth)))
        );
        const qSideFlush = new THREE.Quaternion().setFromUnitVectors(upAxis, sHit.normal);
        const qSideTilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(-sweepRad * 0.9, 0, -side * 0.22));
        sideMesh.quaternion.copy(qSideFlush).multiply(qSideTilt);
        sideMesh.castShadow = true;
        bodyPivotBone.add(sideMesh);
        created.push(sideMesh);
      });
    }
  }
  return created;
}

export function buildQuadrupedMonsterMesh(
  rawBlueprint: MonsterBlueprint,
  options?: { resolution?: number; includeGuides?: boolean }
): THREE.Group {
  const bp = resolveMonsterBlueprint(rawBlueprint);
  const root = new THREE.Group();
  root.name = `Monster_${bp.id}`;

  const scale = THREE.MathUtils.clamp(bp.scale ?? 1.0, 0.5, 2.4);
  const legPairs = bp.legPairs ?? 2;
  const headCount = bp.headCount ?? 1;
  const isSpider = bp.headStyle === 'spider' || legPairs === 4;
  const hasWings = bp.wingStyle !== 'none';
  const canFly = Boolean(bp.canFly && hasWings);

  // Calculate ground clearance from leg geometry
  const maxLegHeight = Math.max(
    bp.frontLegs.upper.length + bp.frontLegs.lower.length,
    bp.rearLegs.upper.length + bp.rearLegs.lower.length
  );
  const bendCos = Math.cos(THREE.MathUtils.degToRad(Math.abs(bp.frontLegs.kneeBendDeg) * 0.55));
  const pawRadius = Math.max(0.03, bp.frontLegs.lower.endRadius * 1.1 * bp.frontLegs.pawScale);
  const groundClearance = Math.max(0.24, maxLegHeight * THREE.MathUtils.clamp(bendCos, 0.55, 0.98) * 0.88 + pawRadius);
  const bodyCenterY = groundClearance + Math.max(bp.chest.midRadius, bp.torso.midRadius) * 0.58;

  // ---------------------------------------------------------------------------
  // 1. Hierarchical Skeleton Bones (World coordinates in bind rest pose)
  // ---------------------------------------------------------------------------
  const bones: THREE.Bone[] = [];
  const registerBone = (name: string, parent: THREE.Object3D, worldPos: THREE.Vector3): THREE.Bone => {
    const bone = new THREE.Bone();
    bone.name = name;
    const parentWorld = new THREE.Vector3();
    parent.updateMatrixWorld(true);
    parent.getWorldPosition(parentWorld);
    bone.position.copy(worldPos).sub(parentWorld);
    parent.add(bone);
    bones.push(bone);
    return bone;
  };

  const rootBone = new THREE.Bone();
  rootBone.name = 'MonsterRoot';
  root.add(rootBone);
  bones.push(rootBone);

  const bodyPivotPos = new THREE.Vector3(0, bodyCenterY, 0);
  const bodyPivot = registerBone('MonsterBodyPivot', rootBone, bodyPivotPos);

  const chestPos = new THREE.Vector3(bp.chest.offsetX, bodyCenterY + bp.chest.offsetY, bp.chest.offsetZ);
  const chestBone = registerBone('MonsterChest', bodyPivot, chestPos);

  const torsoPos = new THREE.Vector3(bp.torso.offsetX, bodyCenterY + bp.torso.offsetY + bp.torso.archY, bp.torso.offsetZ);
  const torsoBone = registerBone('MonsterTorso', bodyPivot, torsoPos);

  const hipsPos = new THREE.Vector3(bp.hips.offsetX, bodyCenterY + bp.hips.offsetY, bp.hips.offsetZ);
  const hipsBone = registerBone('MonsterHips', bodyPivot, hipsPos);

  const prims: SdfPrimitive[] = [];
  const guideRings: MonsterSegmentGuide[] = [];
  const addCapsuleWithGuide = (
    partKey: MonsterPartKey,
    a: THREE.Vector3,
    b: THREE.Vector3,
    prof: MonsterSegmentProfile,
    boneA: number,
    boneB?: number,
    boneLerp = 0,
    seamZone?: number
  ) => {
    const partIndex = MONSTER_SDF_PART_INDEX[partKey];
    prims.push({
      kind: 'capsule',
      a: tupleVec(a),
      b: tupleVec(b),
      oval: [THREE.MathUtils.clamp(prof.squashX ?? 1, 0.45, 2.2), THREE.MathUtils.clamp(prof.squashZ ?? 1, 0.45, 2.2)],
      startRadius: Math.max(0.012, prof.startRadius),
      midRadius: Math.max(0.012, prof.midRadius),
      endRadius: Math.max(0.012, prof.endRadius),
      curvature: prof.curvature,
      blendScale: prof.blendScale,
      color: hexToRgbTuple(prof.color),
      boneA,
      boneB,
      boneLerp,
      partIndex,
      seamZone: seamZone ?? partIndex,
    });
    if (options?.includeGuides) {
      const axisVec = b.clone().sub(a);
      const axis: [number, number, number] =
        axisVec.lengthSq() > 1e-6 ? tupleVec(axisVec.normalize()) : [0, 1, 0];
      const ox = THREE.MathUtils.clamp(prof.squashX ?? 1, 0.45, 2.2);
      const oz = THREE.MathUtils.clamp(prof.squashZ ?? 1, 0.45, 2.2);
      const midPt = a.clone().lerp(b, 0.5);
      guideRings.push({
        partKey,
        boneIndex: boneA,
        rings: [
          { center: tupleVec(a), axis, rx: prof.startRadius * ox, rz: prof.startRadius * oz },
          { center: tupleVec(midPt), axis, rx: prof.midRadius * ox, rz: prof.midRadius * oz },
          { center: tupleVec(b), axis, rx: prof.endRadius * ox, rz: prof.endRadius * oz },
        ],
        spine: [tupleVec(a), tupleVec(b)],
      });
    }
  };

  // Chest, Mid Torso & Hips SDF Capsules
  const chestBack = chestPos.clone().add(new THREE.Vector3(0, -0.01, -bp.chest.length * 0.5));
  const chestFront = chestPos.clone().add(new THREE.Vector3(0, 0.02, bp.chest.length * 0.5));
  addCapsuleWithGuide('chest', chestBack, chestFront, bp.chest, bones.indexOf(chestBone), bones.indexOf(torsoBone), 0.35);

  const torsoBack = torsoPos.clone().add(new THREE.Vector3(0, 0, -bp.torso.length * 0.5));
  const torsoFront = torsoPos.clone().add(new THREE.Vector3(0, 0, bp.torso.length * 0.5));
  addCapsuleWithGuide('torso', torsoBack, torsoFront, bp.torso, bones.indexOf(torsoBone), bones.indexOf(chestBone), 0.45);

  const hipsBack = hipsPos.clone().add(new THREE.Vector3(0, 0.01, -bp.hips.length * 0.5));
  const hipsFront = hipsPos.clone().add(new THREE.Vector3(0, -0.01, bp.hips.length * 0.5));
  addCapsuleWithGuide('hips', hipsBack, hipsFront, bp.hips, bones.indexOf(hipsBone), bones.indexOf(torsoBone), 0.35);

  if (bp.belly.enabled) {
    const bellyBack = bodyPivotPos.clone().add(new THREE.Vector3(bp.belly.offsetX, bp.belly.offsetY, bp.belly.offsetZ - bp.belly.length * 0.5));
    const bellyFront = bodyPivotPos.clone().add(new THREE.Vector3(bp.belly.offsetX, bp.belly.offsetY + 0.02, bp.belly.offsetZ + bp.belly.length * 0.5));
    addCapsuleWithGuide('belly', bellyBack, bellyFront, bp.belly, bones.indexOf(torsoBone), bones.indexOf(chestBone), 0.5);
  }

  // ---------------------------------------------------------------------------
  // 2. Multi-Headed Necks, Skulls, Jaws & Sculpted Muzzles
  // ---------------------------------------------------------------------------
  const heads: QuadrupedHeadRig[] = [];
  const mouthAnchors: THREE.Object3D[] = [];
  const headYaws =
    headCount === 1
      ? [0]
      : headCount === 2
        ? [-THREE.MathUtils.degToRad(bp.neck.spreadDeg), THREE.MathUtils.degToRad(bp.neck.spreadDeg)]
        : [-THREE.MathUtils.degToRad(bp.neck.spreadDeg * 1.15), 0, THREE.MathUtils.degToRad(bp.neck.spreadDeg * 1.15)];

  interface HeadBuildInfo {
    headBone: THREE.Bone;
    jawBone: THREE.Bone;
    headCenter: THREE.Vector3;
    headFwd: THREE.Vector3;
    muzzleStart: THREE.Vector3 | null;
    muzzleTip: THREE.Vector3;
    muzzleDir: THREE.Vector3;
    yawRad: number;
  }
  const headInfos: HeadBuildInfo[] = [];

  for (let h = 0; h < headCount; h++) {
    const yaw = headYaws[h];
    const sideDirX = Math.sin(yaw);
    const fwdDirZ = Math.cos(yaw);
    const pitchRad = THREE.MathUtils.degToRad(bp.neck.pitchDeg);
    const neckRootPos = chestFront.clone().add(
      new THREE.Vector3(
        bp.neck.offsetX + sideDirX * 0.08 * (headCount > 1 ? 1 : 0),
        bp.neck.offsetY,
        bp.neck.offsetZ - 0.04
      )
    );
    const neckDir = new THREE.Vector3(
      sideDirX * Math.cos(pitchRad * 0.6),
      Math.sin(pitchRad),
      fwdDirZ * Math.cos(pitchRad)
    ).normalize();

    const segs = Math.max(2, Math.min(3, Math.round(bp.neck.segments)));
    const neckBones: THREE.Bone[] = [];
    const neckPts: THREE.Vector3[] = [neckRootPos];

    let parentForNeck: THREE.Object3D = chestBone;
    for (let s = 0; s < segs; s++) {
      const f0 = s / segs;
      const f1 = (s + 1) / segs;
      const pEnd = neckRootPos.clone().addScaledVector(neckDir, bp.neck.length * f1);
      // Slight organic S-curve arch on longer necks
      pEnd.y += Math.sin(f1 * Math.PI) * bp.neck.length * 0.08;
      neckPts.push(pEnd);
      const b = registerBone(`MonsterNeck_${h}_${s}`, parentForNeck, neckPts[s]);
      neckBones.push(b);
      parentForNeck = b;
    }

    for (let s = 0; s < segs; s++) {
      const f0 = s / segs;
      const f1 = (s + 1) / segs;
      const r0 = THREE.MathUtils.lerp(bp.neck.startRadius, bp.neck.endRadius, f0);
      const r1 = THREE.MathUtils.lerp(bp.neck.startRadius, bp.neck.endRadius, f1);
      const segProf: MonsterSegmentProfile = {
        ...bp.neck,
        startRadius: r0,
        midRadius: (r0 + r1) * 0.5,
        endRadius: r1,
      };
      const bA = bones.indexOf(neckBones[s]);
      const bB = s + 1 < segs ? bones.indexOf(neckBones[s + 1]) : bA;
      addCapsuleWithGuide('neck', neckPts[s], neckPts[s + 1], segProf, bA, bB, 0.7);
    }

    const headAnchorPos = neckPts[segs].clone().add(
      new THREE.Vector3(bp.head.offsetX, bp.head.offsetY + 0.02, bp.head.offsetZ)
    );
    const headBone = registerBone(`MonsterHead_${h}`, neckBones[segs - 1], headAnchorPos);
    const headIdx = bones.indexOf(headBone);

    const headFwd = new THREE.Vector3(sideDirX, -Math.sin(THREE.MathUtils.degToRad(bp.head.craniumTiltDeg)) * 0.4, fwdDirZ).normalize();
    const skullBack = headAnchorPos.clone().addScaledVector(headFwd, -bp.head.length * 0.35);
    const skullFront = headAnchorPos.clone().addScaledVector(headFwd, bp.head.length * 0.52);
    addCapsuleWithGuide('head', skullBack, skullFront, bp.head, headIdx, bones.indexOf(neckBones[segs - 1]), 0.15);

    // Sculpted Crown & Brow Ridge
    if (bp.head.crownHeight > 0.005 || bp.head.browFierce > 0.05) {
      prims.push({
        kind: 'ellipsoid',
        a: [
          headAnchorPos.x + headFwd.x * 0.02,
          headAnchorPos.y + bp.head.midRadius * 0.55 + bp.head.crownHeight * 0.4,
          headAnchorPos.z + headFwd.z * 0.02,
        ],
        b: [
          bp.head.midRadius * bp.head.squashX * 0.88,
          bp.head.midRadius * 0.58 + bp.head.crownHeight,
          bp.head.midRadius * bp.head.squashZ * 0.92,
        ],
        startRadius: bp.head.midRadius * 0.65,
        midRadius: bp.head.midRadius * 0.65,
        endRadius: bp.head.midRadius * 0.65,
        curvature: 0,
        blendScale: 0.72,
        color: hexToRgbTuple(bp.head.color),
        boneA: headIdx,
        partIndex: MONSTER_SDF_PART_INDEX.head,
      });
    }

    // Articulated Lower Jaw Bone (for roaring, breathing fire, and gentle panting)
    const jawPivotPos = headAnchorPos.clone().add(
      new THREE.Vector3(0, -bp.head.midRadius * 0.48 - bp.head.jawDrop * 0.35, 0)
    );
    const jawBone = registerBone(`MonsterJaw_${h}`, headBone, jawPivotPos);
    const jawIdx = bones.indexOf(jawBone);

    const jawReach = bp.muzzle.enabled ? bp.muzzle.length * 0.86 + bp.head.length * 0.32 : bp.head.length * 0.42;
    const jawEnd = jawPivotPos.clone().addScaledVector(headFwd, jawReach);
    jawEnd.y -= bp.head.jawDrop * 0.65;
    prims.push({
      kind: 'capsule',
      a: tupleVec(jawPivotPos),
      b: tupleVec(jawEnd),
      oval: [bp.head.jawWidth, 0.62],
      startRadius: bp.head.midRadius * 0.62,
      midRadius: (bp.muzzle.enabled ? bp.muzzle.width * 0.88 : bp.head.midRadius * 0.52),
      endRadius: (bp.muzzle.enabled ? bp.muzzle.width * bp.muzzle.taper * 0.86 : bp.head.endRadius * 0.45),
      curvature: 0.08,
      blendScale: 0.52,
      color: hexToRgbTuple(bp.muzzle.enabled ? bp.muzzle.color : bp.head.color),
      boneA: jawIdx,
      boneB: headIdx,
      boneLerp: 0.25,
      partIndex: MONSTER_SDF_PART_INDEX.muzzle,
    });

    // Upper Sculpted Snout / Muzzle
    let muzzleTip = skullFront.clone();
    let muzzleStart: THREE.Vector3 | null = null;
    let muzzleDir = headFwd.clone();
    if (bp.muzzle.enabled && bp.muzzle.length > 0.015) {
      const mTilt = THREE.MathUtils.degToRad(bp.muzzle.tiltDeg);
      const mDir = new THREE.Vector3(
        sideDirX * Math.cos(mTilt),
        -Math.sin(mTilt),
        fwdDirZ * Math.cos(mTilt)
      ).normalize();
      muzzleDir = mDir.clone();
      const mStart = headAnchorPos.clone().addScaledVector(headFwd, bp.head.length * 0.26);
      mStart.y += bp.muzzle.offsetY;
      mStart.z += bp.muzzle.offsetZ;
      muzzleStart = mStart.clone();
      const mEnd = mStart.clone().addScaledVector(mDir, bp.muzzle.length);
      muzzleTip = mEnd.clone();

      const rStart = bp.muzzle.height;
      const rEnd = Math.max(0.015, bp.muzzle.height * bp.muzzle.taper);
      const mProf: MonsterSegmentProfile = {
        startRadius: rStart,
        midRadius: (rStart + rEnd) * 0.54,
        endRadius: rEnd,
        curvature: 0.12,
        length: bp.muzzle.length,
        squashX: THREE.MathUtils.clamp(bp.muzzle.width / Math.max(0.015, bp.muzzle.height), 0.5, 2.0),
        squashZ: 1.0,
        offsetX: 0,
        offsetY: 0,
        offsetZ: 0,
        blendScale: bp.muzzle.blendScale,
        color: bp.muzzle.color,
      };
      addCapsuleWithGuide('muzzle', mStart, mEnd, mProf, headIdx);

      // Dual cheek whisker pads if splitCleft > 0.05
      if (bp.muzzle.splitCleft > 0.05) {
        const padCenter = mStart.clone().lerp(mEnd, 0.72);
        const sideRight = new THREE.Vector3(fwdDirZ, 0, -sideDirX).normalize();
        const sep = bp.muzzle.width * bp.muzzle.taper * (0.48 + bp.muzzle.splitCleft * 0.28);
        ([-1, 1] as const).forEach((s) => {
          const lobeCenter = padCenter.clone().addScaledVector(sideRight, s * sep);
          lobeCenter.y -= rEnd * 0.2;
          prims.push({
            kind: 'ellipsoid',
            a: tupleVec(lobeCenter),
            b: [rEnd * 0.85, rEnd * 0.78, rEnd * 0.95],
            startRadius: rEnd * 0.78,
            midRadius: rEnd * 0.78,
            endRadius: rEnd * 0.78,
            curvature: 0,
            blendScale: 0.34,
            color: hexToRgbTuple(bp.muzzle.color),
            boneA: headIdx,
            partIndex: MONSTER_SDF_PART_INDEX.muzzle,
          });
        });
      }
    }

    headInfos.push({
      headBone,
      jawBone,
      headCenter: headAnchorPos,
      headFwd,
      muzzleStart,
      muzzleTip,
      muzzleDir,
      yawRad: yaw,
    });

    const mouthAnchor = new THREE.Object3D();
    mouthAnchor.name = `MonsterMouthAnchor_${h}`;
    const localTip = muzzleTip.clone().sub(headAnchorPos);
    mouthAnchor.position.set(localTip.x, localTip.y - 0.02, localTip.z + 0.03);
    mouthAnchor.rotation.y = yaw;
    headBone.add(mouthAnchor);
    mouthAnchors.push(mouthAnchor);

    heads.push({
      neckBones,
      neckPivot: neckBones[0],
      headPivot: headBone,
      jawPivot: jawBone,
      mouthAnchor,
      eyelids: [],
      eyebrows: [],
      ears: [],
      blushMeshes: [],
      baseNeckYaw: yaw,
      baseNeckPitch: 0,
      headIndex: h,
    });
  }

  // ---------------------------------------------------------------------------
  // 3. Multi-Pedal Legs (Front, Mid, Rear) with Articulated Bones & SDF Clays
  // ---------------------------------------------------------------------------
  const legs: QuadrupedLegRig[] = [];
  const clawColorRgb = hexToRgbTuple(bp.frontLegs.clawColor);

  for (let p = 0; p < legPairs; p++) {
    const legCfg =
      p === 0 ? bp.frontLegs : p === legPairs - 1 ? bp.rearLegs : bp.midLegs;
    const partKey: MonsterPartKey =
      p === 0 ? 'frontLegs' : p === legPairs - 1 ? 'rearLegs' : 'midLegs';
    const pairFrac = (legPairs as number) <= 1 ? 0 : p / (legPairs - 1);
    const baseZ =
      p === 0
        ? bp.frontLegs.hipOffsetZ
        : p === legPairs - 1
          ? bp.rearLegs.hipOffsetZ
          : THREE.MathUtils.lerp(bp.frontLegs.hipOffsetZ, bp.rearLegs.hipOffsetZ, pairFrac) +
            bp.midLegs.hipOffsetZ * 0.25;
    const parentBodyBone =
      p === 0 ? chestBone : p === legPairs - 1 ? hipsBone : torsoBone;

    const stanceRad = THREE.MathUtils.degToRad(legCfg.stanceAngleDeg);
    const kneeRad = THREE.MathUtils.degToRad(legCfg.kneeBendDeg);
    const splayX = legCfg.spiderSplay;

    ([-1, 1] as const).forEach((side) => {
      const hipPos = new THREE.Vector3(
        side * (legCfg.hipSpreadX + legCfg.upper.offsetX),
        bodyCenterY + legCfg.hipOffsetY + legCfg.upper.offsetY,
        baseZ + legCfg.upper.offsetZ
      );
      const upperDir = new THREE.Vector3(
        side * splayX * 0.65,
        -Math.cos(stanceRad),
        Math.sin(stanceRad)
      ).normalize();
      const kneePos = hipPos.clone().addScaledVector(upperDir, legCfg.upper.length);

      const lowerDir = new THREE.Vector3(
        side * splayX * 0.25,
        -Math.cos(stanceRad + kneeRad),
        Math.sin(stanceRad + kneeRad)
      ).normalize();
      const pawPos = kneePos.clone().addScaledVector(lowerDir, legCfg.lower.length);
      pawPos.y = Math.max(pawRadius * 0.9, pawPos.y);

      const hipBone = registerBone(`Leg_${p}_${side < 0 ? 'L' : 'R'}_Hip`, parentBodyBone, hipPos);
      const kneeBone = registerBone(`Leg_${p}_${side < 0 ? 'L' : 'R'}_Knee`, hipBone, kneePos);
      const pawBone = registerBone(`Leg_${p}_${side < 0 ? 'L' : 'R'}_Paw`, kneeBone, pawPos);

      const hipIdx = bones.indexOf(hipBone);
      const kneeIdx = bones.indexOf(kneeBone);
      const pawIdx = bones.indexOf(pawBone);

      addCapsuleWithGuide(partKey, hipPos, kneePos, legCfg.upper, hipIdx, kneeIdx, 0.72);
      addCapsuleWithGuide(partKey, kneePos, pawPos, legCfg.lower, kneeIdx, pawIdx, 0.65);

      // Sculpted Paws / Hooves / Claws / Arachnid Tarsi integrated into SDF clay
      const ps = legCfg.pawScale;
      const footR = legCfg.lower.endRadius * ps;
      if (legCfg.pawStyle === 'hoof') {
        prims.push({
          kind: 'capsule',
          a: tupleVec(pawPos),
          b: [pawPos.x, Math.max(0.02, pawPos.y - footR * 0.85), pawPos.z + footR * 0.42],
          oval: [1.08, 1.15],
          startRadius: footR * 0.98,
          midRadius: footR * 1.18,
          endRadius: footR * 1.24,
          curvature: 0.05,
          blendScale: 0.35,
          color: hexToRgbTuple(legCfg.clawColor),
          boneA: pawIdx,
          partIndex: MONSTER_SDF_PART_INDEX[partKey],
        });
      } else if (legCfg.pawStyle === 'arachnid') {
        const tipPt = pawPos.clone().add(new THREE.Vector3(side * footR * 2.2, -footR * 0.75, 0));
        prims.push({
          kind: 'capsule',
          a: tupleVec(pawPos),
          b: tupleVec(tipPt),
          startRadius: footR * 0.95,
          midRadius: footR * 0.65,
          endRadius: Math.max(0.012, footR * 0.25),
          curvature: 0.1,
          blendScale: 0.3,
          color: clawColorRgb,
          boneA: pawIdx,
          partIndex: MONSTER_SDF_PART_INDEX[partKey],
        });
      } else if (legCfg.pawStyle !== 'stump') {
        const pawFront = pawPos.clone().add(new THREE.Vector3(0, -footR * 0.18, footR * 1.35));
        prims.push({
          kind: 'capsule',
          a: tupleVec(pawPos),
          b: tupleVec(pawFront),
          oval: [1.28, 0.82],
          startRadius: footR * 1.08,
          midRadius: footR * 1.26,
          endRadius: footR * 1.05,
          curvature: 0.14,
          blendScale: 0.38,
          color: hexToRgbTuple(legCfg.lower.color),
          boneA: pawIdx,
          partIndex: MONSTER_SDF_PART_INDEX[partKey],
        });

        // Sculpted Claws / Toes
        if (legCfg.pawStyle === 'claw' || legCfg.pawStyle === 'talon') {
          for (const cIdx of [-1, 0, 1]) {
            const cStart = pawFront.clone().add(new THREE.Vector3(cIdx * footR * 0.55, -footR * 0.12, footR * 0.35));
            const cEnd = cStart.clone().add(new THREE.Vector3(cIdx * footR * 0.22, -footR * 0.22, footR * 1.05));
            prims.push({
              kind: 'capsule',
              a: tupleVec(cStart),
              b: tupleVec(cEnd),
              startRadius: footR * 0.28,
              midRadius: footR * 0.2,
              endRadius: 0.01,
              curvature: 0.15,
              blendScale: 0.22,
              color: hexToRgbTuple(legCfg.clawColor),
              boneA: pawIdx,
              partIndex: MONSTER_SDF_PART_INDEX[partKey],
            });
          }
        }
      }

      legs.push({
        side,
        pairIndex: p,
        hipPivot: hipBone,
        kneePivot: kneeBone,
        pawGroup: pawBone,
        baseHipX: 0,
        baseKneeX: 0,
        baseSpreadZ: 0,
        baseYawY: 0,
      });
    });
  }

  // ---------------------------------------------------------------------------
  // 4. Organic Multi-Segment Tail Chain (Bones + SDF Capsules)
  // ---------------------------------------------------------------------------
  const tailSegments: THREE.Bone[] = [];
  let tailTipPos = hipsPos.clone().add(new THREE.Vector3(0, 0, -0.25));
  if (bp.tailStyle !== 'none') {
    const segCount = THREE.MathUtils.clamp(Math.round(bp.tail.segments), 2, 5);
    const tailBasePos = hipsBack.clone().add(
      new THREE.Vector3(bp.tail.offsetX, bp.tail.offsetY, bp.tail.offsetZ + 0.03)
    );
    const tailPts: THREE.Vector3[] = [tailBasePos];
    let parentTail: THREE.Object3D = hipsBone;
    for (let i = 0; i < segCount; i++) {
      const f = (i + 1) / segCount;
      const segPos = tailBasePos.clone().add(
        new THREE.Vector3(
          0,
          Math.sin(f * Math.PI * 0.85) * bp.tail.length * 0.28 * bp.tail.curlUp + f * bp.tail.curlUp * bp.tail.length * 0.35,
          -f * bp.tail.length
        )
      );
      tailPts.push(segPos);
      const tBone = registerBone(`MonsterTail_${i}`, parentTail, tailPts[i]);
      tailSegments.push(tBone);
      parentTail = tBone;
    }
    tailTipPos = tailPts[segCount].clone();

    for (let i = 0; i < segCount; i++) {
      const f0 = i / segCount;
      const f1 = (i + 1) / segCount;
      const evalR = (f: number) =>
        f <= 0.5
          ? THREE.MathUtils.lerp(bp.tail.startRadius, bp.tail.midRadius, f * 2)
          : THREE.MathUtils.lerp(bp.tail.midRadius, bp.tail.endRadius, (f - 0.5) * 2);
      const segProf: MonsterSegmentProfile = {
        ...bp.tail,
        startRadius: evalR(f0),
        midRadius: evalR((f0 + f1) * 0.5),
        endRadius: evalR(f1),
        color: i === segCount - 1 ? bp.tail.tipColor : bp.tail.color,
      };
      const bA = bones.indexOf(tailSegments[i]);
      const bB = i + 1 < segCount ? bones.indexOf(tailSegments[i + 1]) : bA;
      addCapsuleWithGuide('tail', tailPts[i], tailPts[i + 1], segProf, bA, bB, 0.72);
    }

    // Specialized Tail Tips (Club Mace, Scorpion Stinger, Blade Fin, Twin Fork)
    const tipBoneIdx = bones.indexOf(tailSegments[tailSegments.length - 1]);
    const tipCol = hexToRgbTuple(bp.tail.tipColor);
    const ts = bp.tail.tipScale;
    if (bp.tailStyle === 'club') {
      prims.push({
        kind: 'ellipsoid',
        a: tupleVec(tailTipPos),
        b: [0.13 * ts, 0.11 * ts, 0.15 * ts],
        startRadius: 0.11 * ts,
        midRadius: 0.11 * ts,
        endRadius: 0.11 * ts,
        curvature: 0,
        blendScale: 0.55,
        color: tipCol,
        boneA: tipBoneIdx,
        partIndex: MONSTER_SDF_PART_INDEX.tail,
      });
    } else if (bp.tailStyle === 'stinger') {
      const hookPt = tailTipPos.clone().add(new THREE.Vector3(0, 0.14 * ts, 0.14 * ts));
      prims.push({
        kind: 'capsule',
        a: tupleVec(tailTipPos),
        b: tupleVec(hookPt),
        startRadius: 0.055 * ts,
        midRadius: 0.042 * ts,
        endRadius: 0.012 * ts,
        curvature: 0.35,
        blendScale: 0.35,
        color: tipCol,
        boneA: tipBoneIdx,
        partIndex: MONSTER_SDF_PART_INDEX.tail,
      });
    } else if (bp.tailStyle === 'bladeFin' || bp.tailStyle === 'twinFork') {
      const sides = bp.tailStyle === 'twinFork' ? [-1, 1] : [0];
      for (const s of sides) {
        const finEnd = tailTipPos.clone().add(new THREE.Vector3(s * 0.11 * ts, 0.04 * ts, -0.18 * ts));
        prims.push({
          kind: 'capsule',
          a: tupleVec(tailTipPos),
          b: tupleVec(finEnd),
          oval: [1.85, 0.35],
          startRadius: 0.045 * ts,
          midRadius: 0.068 * ts,
          endRadius: 0.018 * ts,
          curvature: 0.15,
          blendScale: 0.32,
          color: tipCol,
          boneA: tipBoneIdx,
          partIndex: MONSTER_SDF_PART_INDEX.tail,
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 5 & 6. Polygonize Unified SDF Clay Mesh + Surface-Anchored Wing Bones + Bind Skeleton
  // ---------------------------------------------------------------------------
  root.updateMatrixWorld(true);
  const evaluator = new SdfFieldEvaluator(prims, bp.blendSmoothness);

  let wingL: QuadrupedWingRig | undefined;
  let wingR: QuadrupedWingRig | undefined;
  if (hasWings) {
    const liftRad = THREE.MathUtils.degToRad(bp.wings.liftDeg);
    const sweepRad = THREE.MathUtils.degToRad(bp.wings.sweepBackDeg);
    const foldRad = THREE.MathUtils.degToRad(bp.wings.foldDeg);
    const innerSpan = bp.wings.span * 0.44;
    const chord = THREE.MathUtils.clamp(bp.wings.chordWidth, 0.22, 1.2);

    const makeWingBones = (side: -1 | 1): QuadrupedWingRig => {
      // Snap shoulder anchor onto actual chest/upper-back flank SDF surface so chest reshaping keeps wings flush
      const shoulderRay = new THREE.Vector3(side * 0.82, 0.56, 0).normalize();
      const shoulderFallback = chestPos.clone().add(
        new THREE.Vector3(side * bp.wings.offsetX, bp.wings.offsetY, bp.wings.offsetZ)
      );
      const chestOrigin = chestPos.clone().add(new THREE.Vector3(0, 0, bp.wings.offsetZ));
      const flankHit = snapToSdfSurface(evaluator, chestOrigin, shoulderRay, shoulderFallback, 0.75);
      const userDeltaX = bp.wings.offsetX - 0.14;
      const shoulderPos = new THREE.Vector3(
        flankHit.point.x + side * (userDeltaX - 0.015),
        Math.max(flankHit.point.y * 0.5 + chestPos.y * 0.5, chestPos.y) + bp.wings.offsetY,
        flankHit.point.z
      );

      const inner = registerBone(`Wing_${side < 0 ? 'L' : 'R'}_Inner`, chestBone, shoulderPos);
      inner.rotation.set(0, side * sweepRad, side * liftRad);
      const wristOffset = new THREE.Vector3(side * innerSpan, innerSpan * 0.34, chord * 0.08);
      const wristPos = shoulderPos.clone().add(wristOffset);
      const outer = registerBone(`Wing_${side < 0 ? 'L' : 'R'}_Outer`, inner, wristPos);
      outer.position.copy(wristOffset);
      outer.rotation.set(0, side * foldRad, -side * liftRad * 0.35);
      return {
        side,
        innerPivot: inner,
        outerPivot: outer,
        baseLiftRad: liftRad,
        baseSweepRad: sweepRad,
        baseFoldRad: foldRad,
      };
    };

    wingL = makeWingBones(-1);
    wingR = makeWingBones(1);
  }

  const res = THREE.MathUtils.clamp(Math.round(options?.resolution ?? 36), 24, 72);
  const sdfResult = polygonizeSdfToGeometry(evaluator, bones.length, res, Boolean(options?.includeGuides));

  if (bp.sculptData?.enabled) {
    applyMonsterSculptData(sdfResult.geometry, bp.sculptData, res);
    if (bp.sculptData.boneOffsets && bp.sculptData.boneOffsets.length > 0) {
      const offsetMap = new Map(bp.sculptData.boneOffsets.map((o) => [o.boneName, o.delta]));
      root.updateMatrixWorld(true);
      const targetWorldByBone = new Map<THREE.Bone, THREE.Vector3>();
      for (const bone of bones) {
        const d = offsetMap.get(bone.name);
        if (d) {
          const wp = new THREE.Vector3();
          bone.getWorldPosition(wp);
          wp.x += d[0];
          wp.y += d[1];
          wp.z += d[2];
          targetWorldByBone.set(bone, wp);
        }
      }
      for (const bone of bones) {
        const targetWp = targetWorldByBone.get(bone);
        if (targetWp && bone.parent) {
          bone.parent.updateMatrixWorld(true);
          bone.position.copy(bone.parent.worldToLocal(targetWp.clone()));
        }
      }
    }
  }

  const clayMat = createMonsterClayMaterial(bp.materialFinish);
  const coatTextures = createMonsterCoatTextures(bp.surfaceCoat);
  if (coatTextures) {
    clayMat.map = coatTextures.map;
    clayMat.bumpMap = coatTextures.bumpMap;
    clayMat.bumpScale = coatTextures.bumpScale;
    if (bp.materialFinish === 'glossySlime' || bp.materialFinish === 'toonSatin') {
      clayMat.roughnessMap = coatTextures.roughnessMap;
    }
  }

  const skinnedMesh = new THREE.SkinnedMesh(sdfResult.geometry, clayMat);
  skinnedMesh.name = 'MonsterClaySkinnedMesh';
  skinnedMesh.castShadow = true;
  skinnedMesh.receiveShadow = true;
  skinnedMesh.frustumCulled = false;

  const skeleton = new THREE.Skeleton(bones);
  root.add(skinnedMesh);
  root.updateMatrixWorld(true);
  skinnedMesh.bind(skeleton, new THREE.Matrix4());

  // ---------------------------------------------------------------------------
  // 7. Surface-Projected Eyes, Eyebrows, Mouths, Ears, Horns, Wings, Spikes
  // ---------------------------------------------------------------------------
  const partMeshes: Partial<Record<MonsterPartKey, THREE.Object3D[]>> = {
    eyes: [],
    eyebrows: [],
    mouth: [],
    teeth: [],
    nose: [],
    ears: [],
    horns: [],
    wings: [],
    spikes: [],
    muzzle: [],
  };

  const hornMat = new THREE.MeshStandardMaterial({
    color: bp.horns.color,
    roughness: 0.72,
    metalness: 0.04,
    envMapIntensity: 0.28,
  });
  const crystalMat = new THREE.MeshStandardMaterial({
    color: bp.horns.color,
    emissive: bp.horns.color,
    emissiveIntensity: 0.35,
    roughness: 0.24,
    metalness: 0.2,
  });
  const earOuterMat = new THREE.MeshStandardMaterial({
    color: bp.ears.color,
    roughness: 0.92,
    metalness: 0.0,
    envMapIntensity: 0.16,
  });
  const earInnerMat = new THREE.MeshStandardMaterial({
    color: bp.ears.innerColor,
    roughness: 0.94,
    metalness: 0.0,
    envMapIntensity: 0.14,
  });
  const scleraMat = new THREE.MeshStandardMaterial({
    color: bp.eyes.scleraColor,
    roughness: 0.22,
    metalness: 0.02,
    emissive: bp.eyes.glowEmissive > 0.3 ? bp.eyes.irisColor : '#000000',
    emissiveIntensity: bp.eyes.glowEmissive * 0.4,
  });
  const isGlowPupil = bp.eyes.pupilStyle === 'glow';
  const irisMat = new THREE.MeshStandardMaterial({
    color: bp.eyes.irisColor,
    emissive: bp.eyes.irisColor,
    emissiveIntensity: isGlowPupil
      ? Math.max(0.85, bp.eyes.glowEmissive * 1.15)
      : Math.max(0.18, bp.eyes.glowEmissive * 0.75),
    roughness: 0.18,
  });
  const pupilMat = isGlowPupil
    ? new THREE.MeshStandardMaterial({
        color: '#FFFFFF',
        emissive: bp.eyes.irisColor,
        emissiveIntensity: 1.55,
        roughness: 0.1,
      })
    : new THREE.MeshStandardMaterial({
        color: bp.eyes.pupilColor,
        roughness: 0.15,
      });
  const catchlightMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF' });
  const eyelidMat = new THREE.MeshStandardMaterial({
    color: bp.head.color,
    roughness: 0.94,
    metalness: 0.0,
    envMapIntensity: 0.16,
  });
  const eyebrowMat = new THREE.MeshStandardMaterial({
    color: bp.eyebrows.color,
    roughness: 0.9,
    metalness: 0.0,
    envMapIntensity: 0.18,
  });
  const lipMat = new THREE.MeshStandardMaterial({
    color: bp.mouth.lipColor,
    roughness: 0.88,
    metalness: 0.0,
    envMapIntensity: 0.2,
  });
  const tongueMat = new THREE.MeshStandardMaterial({
    color: bp.mouth.tongueColor,
    roughness: 0.65,
    metalness: 0.0,
  });
  const blushMat = new THREE.MeshBasicMaterial({
    color: bp.mouth.blushColor,
    transparent: true,
    opacity: 0.56,
    depthWrite: false,
  });
  const teethMat = new THREE.MeshStandardMaterial({
    color: bp.teeth.color,
    roughness: 0.24,
    metalness: 0.02,
  });
  const noseRough = THREE.MathUtils.clamp(0.88 - bp.nose.shine * 0.72, 0.12, 0.94);
  const noseMat = new THREE.MeshStandardMaterial({
    color: bp.nose.color,
    roughness: noseRough,
    metalness: 0.02,
    envMapIntensity: 0.2 + bp.nose.shine * 0.45,
  });
  const nostrilMat = new THREE.MeshBasicMaterial({ color: bp.nose.nostrilColor });
  const wingBoneMat = new THREE.MeshStandardMaterial({
    color: bp.wings.boneColor,
    roughness: 0.88,
    metalness: 0.0,
    envMapIntensity: 0.2,
  });
  const wingMemMat = new THREE.MeshStandardMaterial({
    color: bp.wings.wingColor,
    roughness: 0.82,
    metalness: 0.0,
    envMapIntensity: 0.22,
    side: THREE.DoubleSide,
  });
  const wingTipMat = new THREE.MeshStandardMaterial({
    color: bp.wings.tipColor,
    roughness: 0.72,
    metalness: 0.02,
    envMapIntensity: 0.25,
    side: THREE.DoubleSide,
  });
  const spikeMat = new THREE.MeshStandardMaterial({
    color: bp.spikes.color,
    roughness: 0.8,
    metalness: 0.04,
    envMapIntensity: 0.24,
  });
  const spikeTipMat = new THREE.MeshStandardMaterial({
    color: bp.spikes.tipColor,
    roughness: 0.72,
    metalness: 0.06,
    envMapIntensity: 0.26,
  });

  const eyeCfg = bp.eyes;
  const eyePairsCount = eyeCfg.count === 1 ? 1 : eyeCfg.count === 3 ? 3 : eyeCfg.count;

  const worldToHeadLocal = (headBone: THREE.Bone, worldPt: THREE.Vector3) =>
    headBone.worldToLocal(worldPt.clone());

  const placeOnHeadSurface = (
    headBone: THREE.Bone,
    headCenter: THREE.Vector3,
    rayDir: THREE.Vector3,
    fallbackLocalPos: THREE.Vector3,
    child: THREE.Object3D,
    normalBias: number,
    alignStrength = 0.65
  ) => {
    const hit = evaluator.projectOutwardFromInterior(headCenter, rayDir.clone().normalize(), 0.75);
    if (hit) {
      const worldPlaced = hit.point.clone().addScaledVector(hit.normal, normalBias);
      child.position.copy(worldToHeadLocal(headBone, worldPlaced));
      const fwd = new THREE.Vector3(0, 0, 1);
      const q = new THREE.Quaternion().setFromUnitVectors(fwd, hit.normal);
      const id = new THREE.Quaternion();
      child.quaternion.copy(id.slerp(q, alignStrength));
    } else {
      child.position.copy(fallbackLocalPos);
    }
    headBone.add(child);
  };

  for (let h = 0; h < headInfos.length; h++) {
    const hi = headInfos[h];
    const rigHead = heads[h];
    const sideRight = new THREE.Vector3(Math.cos(hi.yawRad), 0, -Math.sin(hi.yawRad)).normalize();
    const fwdDir = new THREE.Vector3(Math.sin(hi.yawRad), 0, Math.cos(hi.yawRad)).normalize();
    const worldUp = new THREE.Vector3(0, 1, 0);

    // Eyes with concentric iris/pupil/catchlight & blinking top eyelids!
    const eyeSlots: { ox: number; oy: number; scale: number }[] = [];
    if (eyePairsCount === 1) {
      eyeSlots.push({ ox: 0, oy: eyeCfg.height, scale: 1.35 });
    } else if (eyePairsCount === 3) {
      eyeSlots.push(
        { ox: -eyeCfg.spacing, oy: eyeCfg.height, scale: 1.0 },
        { ox: eyeCfg.spacing, oy: eyeCfg.height, scale: 1.0 },
        { ox: 0, oy: eyeCfg.height + eyeCfg.size * 1.3, scale: 0.76 }
      );
    } else {
      const rows = eyePairsCount / 2;
      for (let r = 0; r < rows; r++) {
        const sMult = r === 0 ? 1.0 : Math.max(0.5, 0.72 - r * 0.14);
        const yOff = eyeCfg.height + r * eyeCfg.size * 0.95;
        const xSpread = eyeCfg.spacing * (1 + r * 0.35);
        eyeSlots.push({ ox: -xSpread, oy: yOff, scale: sMult }, { ox: xSpread, oy: yOff, scale: sMult });
      }
    }

    for (const slot of eyeSlots) {
      const eyeSocket = new THREE.Group();
      const r = eyeCfg.size * slot.scale;
      const scaled = new THREE.Group();
      scaled.scale.set(r * eyeCfg.aspectX, r * eyeCfg.aspectY, r * eyeCfg.flatness);
      eyeSocket.add(scaled);

      const sclera = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 14), scleraMat);
      scaled.add(sclera);

      const irisGeo = createConformingDiscGeo(0.56, 0.56, 1.022, 18, 5);
      const iris = new THREE.Mesh(irisGeo, irisMat);
      scaled.add(iris);

      const pStyle = eyeCfg.pupilStyle;
      const pRx =
        pStyle === 'catSlit' ? 0.11 : pStyle === 'oval' ? 0.21 : pStyle === 'glow' ? 0.28 : 0.34;
      const pRy =
        pStyle === 'catSlit' ? 0.52 : pStyle === 'oval' ? 0.49 : pStyle === 'glow' ? 0.28 : 0.34;
      const pupil = new THREE.Mesh(createConformingDiscGeo(pRx, pRy, 1.038, 18, 4), pupilMat);
      scaled.add(pupil);

      if (pStyle === 'glow') {
        const ringRim = new THREE.Mesh(
          createConformingDiscGeo(0.45, 0.45, 1.032, 18, 4),
          new THREE.MeshBasicMaterial({ color: '#111827' })
        );
        scaled.add(ringRim);
      }

      if (pStyle === 'starry') {
        const starMain = new THREE.Mesh(
          createConformingStarGeo(0.24, 0.24, 4, 0.3, 1.056, 0.08, 0.09),
          catchlightMat
        );
        const starSub = new THREE.Mesh(
          createConformingDiscGeo(0.085, 0.085, 1.056, 10, 2, -0.17, -0.17),
          catchlightMat
        );
        const spec = new THREE.Mesh(
          createConformingDiscGeo(0.11, 0.11, 1.058, 10, 2, 0.21, 0.22),
          catchlightMat
        );
        scaled.add(starMain, starSub, spec);
      } else {
        const spec = new THREE.Mesh(
          createConformingDiscGeo(0.14, 0.14, 1.055, 12, 3, 0.17, 0.2),
          catchlightMat
        );
        scaled.add(spec);
      }

      // Animated blinking upper eyelid
      const topMinOpen = -Math.PI * 0.44;
      const topMaxClose = Math.PI * 0.48;
      const lidPivot = new THREE.Group();
      lidPivot.rotation.x = THREE.MathUtils.lerp(topMinOpen, topMaxClose, eyeCfg.eyelidRest);
      const lidMesh = new THREE.Mesh(
        new THREE.SphereGeometry(1.088, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
        eyelidMat
      );
      lidPivot.add(lidMesh);
      scaled.add(lidPivot);
      rigHead.eyelids.push({
        node: lidPivot,
        minOpenRad: topMinOpen,
        maxCloseRad: topMaxClose,
        restClosedFrac: eyeCfg.eyelidRest,
      });

      const targetDir = fwdDir
        .clone()
        .multiplyScalar(bp.head.midRadius * 1.15)
        .addScaledVector(sideRight, slot.ox)
        .add(new THREE.Vector3(0, slot.oy, 0));
      const fallback = new THREE.Vector3(slot.ox, slot.oy, bp.head.midRadius * 0.9);
      placeOnHeadSurface(
        hi.headBone,
        hi.headCenter,
        targetDir,
        fallback,
        eyeSocket,
        eyeCfg.depthOffset - r * eyeCfg.flatness * 0.15,
        0.55
      );
      partMeshes.eyes?.push(eyeSocket);
    }

    // Expressive Sculpted Eyebrows conformed across 5 SDF surface samples
    if (bp.eyebrows.enabled) {
      const eb = bp.eyebrows;
      const tiltRad = THREE.MathUtils.degToRad(eb.tiltDeg);
      const fwdRefDist = Math.max(0.06, bp.head.midRadius * 1.18);
      ([-1, 1] as const).forEach((s) => {
        const centerRay = fwdDir
          .clone()
          .multiplyScalar(fwdRefDist)
          .addScaledVector(sideRight, s * eb.spacing)
          .addScaledVector(worldUp, eb.height);
        const centerFallback = hi.headCenter
          .clone()
          .addScaledVector(sideRight, s * eb.spacing)
          .addScaledVector(worldUp, eb.height)
          .addScaledVector(fwdDir, bp.head.midRadius * 0.92);
        const cHit = snapToSdfSurface(evaluator, hi.headCenter, centerRay, centerFallback, 0.78);
        const centerWorld = cHit.point.clone().addScaledVector(cHit.normal, eb.thickness * 0.42 + 0.0025);

        const browPivot = new THREE.Group();
        browPivot.position.copy(worldToHeadLocal(hi.headBone, centerWorld));
        browPivot.rotation.order = 'YXZ';
        browPivot.rotation.set(0, hi.yawRad, 0);
        hi.headBone.add(browPivot);
        browPivot.updateMatrixWorld(true);

        const samplePts: THREE.Vector3[] = [];
        for (let k = 0; k < 5; k++) {
          const v = -1 + (2 * k) / 4;
          const localHoriz = v * eb.width * 0.48;
          const xArc = s * eb.spacing + localHoriz;
          const tiltSlope = localHoriz * Math.sin(s * tiltRad);
          const yArc = eb.height + (1 - v * v) * eb.arch * 0.026 - v * v * eb.arch * 0.008 + tiltSlope;
          const ray = fwdDir
            .clone()
            .multiplyScalar(fwdRefDist)
            .addScaledVector(sideRight, xArc)
            .addScaledVector(worldUp, yArc);
          const fb = hi.headCenter
            .clone()
            .addScaledVector(sideRight, xArc)
            .addScaledVector(worldUp, yArc)
            .addScaledVector(fwdDir, bp.head.midRadius * 0.92);
          const pHit = snapToSdfSurface(evaluator, hi.headCenter, ray, fb, 0.78);
          const pWorld = pHit.point.clone().addScaledVector(pHit.normal, eb.thickness * 0.42 + 0.0025);
          samplePts.push(browPivot.worldToLocal(pWorld));
        }

        const browCurve = new THREE.CatmullRomCurve3(samplePts);
        const browGeo = new THREE.TubeGeometry(browCurve, 12, eb.thickness * 0.78, 10, false);
        const browMesh = new THREE.Mesh(browGeo, eyebrowMat);
        browMesh.castShadow = true;
        browPivot.add(browMesh);
        // Smooth spherical end caps matching surface endpoints
        for (const endPt of [samplePts[0], samplePts[samplePts.length - 1]]) {
          const cap = new THREE.Mesh(new THREE.SphereGeometry(eb.thickness * 0.74, 10, 8), eyebrowMat);
          cap.position.copy(endPt);
          browPivot.add(cap);
        }

        rigHead.eyebrows.push({
          side: s,
          pivot: browPivot,
          basePosY: browPivot.position.y,
          baseRotZ: 0,
          baseTiltRad: tiltRad,
        });
        partMeshes.eyebrows?.push(browPivot);
      });
    }

    // Surface-Conformed Cheek Blush Patches (subtle on happy, prominent on shy)
    ([-1, 1] as const).forEach((s) => {
      const blushCenterRay = fwdDir
        .clone()
        .multiplyScalar(bp.head.midRadius * 1.05)
        .addScaledVector(sideRight, s * (eyeCfg.spacing + eyeCfg.size * 0.65))
        .addScaledVector(worldUp, eyeCfg.height - eyeCfg.size * 1.15);
      const blushFallback = hi.headCenter
        .clone()
        .addScaledVector(sideRight, s * eyeCfg.spacing * 1.2)
        .addScaledVector(worldUp, eyeCfg.height - 0.04)
        .addScaledVector(fwdDir, bp.head.midRadius * 0.85);
      const cHit = snapToSdfSurface(evaluator, hi.headCenter, blushCenterRay, blushFallback, 0.75);
      const blushAnchorWorld = cHit.point.clone().addScaledVector(cHit.normal, 0.0028);

      const blushPivot = new THREE.Object3D();
      blushPivot.position.copy(worldToHeadLocal(hi.headBone, blushAnchorWorld));
      hi.headBone.add(blushPivot);
      blushPivot.updateMatrixWorld(true);

      // Build conformed elliptical patch following cheek SDF contour
      const segs = 14;
      const brx = eyeCfg.size * 0.78;
      const bry = eyeCfg.size * 0.45;
      const verts: number[] = [0, 0, 0];
      const norms: number[] = [0, 0, 1];
      const idxs: number[] = [];
      const tangU = new THREE.Vector3().crossVectors(worldUp, cHit.normal);
      if (tangU.lengthSq() < 1e-6) tangU.copy(sideRight);
      tangU.normalize();
      const tangV = new THREE.Vector3().crossVectors(cHit.normal, tangU).normalize();

      for (let i = 0; i < segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        const offWorld = cHit.point
          .clone()
          .addScaledVector(tangU, Math.cos(a) * brx)
          .addScaledVector(tangV, Math.sin(a) * bry);
        const rimRay = offWorld.clone().sub(hi.headCenter);
        const rimHit = snapToSdfSurface(evaluator, hi.headCenter, rimRay, offWorld, 0.75);
        const rimLocal = blushPivot.worldToLocal(rimHit.point.clone().addScaledVector(rimHit.normal, 0.0028));
        verts.push(rimLocal.x, rimLocal.y, rimLocal.z);
        norms.push(0, 0, 1);
        idxs.push(0, 1 + i, 1 + ((i + 1) % segs));
      }
      const blushGeo = new THREE.BufferGeometry();
      blushGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      blushGeo.setAttribute('normal', new THREE.Float32BufferAttribute(norms, 3));
      blushGeo.setIndex(idxs);
      blushGeo.computeVertexNormals();

      const blushMatInst = blushMat.clone();
      blushMatInst.side = THREE.DoubleSide;
      blushMatInst.polygonOffset = true;
      blushMatInst.polygonOffsetFactor = -2;
      blushMatInst.polygonOffsetUnits = -2;
      const blush = new THREE.Mesh(blushGeo, blushMatInst);
      blushPivot.add(blush);
      blush.visible = bp.mouth.mood === 'shy' || bp.mouth.mood === 'happy';
      rigHead.blushMeshes.push(blush);
      partMeshes.mouth?.push(blush);
    });

    // Surface-Conformed Horns on this head
    if (bp.hornStyle !== 'none') {
      const muzzleTopAnchor = hi.muzzleStart
        ? hi.muzzleStart.clone().lerp(hi.muzzleTip, 0.55)
        : hi.headCenter.clone().addScaledVector(hi.headFwd, bp.head.length * 0.3);
      const hornGrp = buildHornAttachment(
        bp,
        hornMat,
        crystalMat,
        evaluator,
        hi.headBone,
        hi.headCenter,
        hi.headFwd,
        sideRight,
        muzzleTopAnchor,
        hi.yawRad
      );
      hi.headBone.add(hornGrp);
      partMeshes.horns?.push(hornGrp);
    }

    // Surface-Conformed Ears on this head
    if (bp.ears.style !== 'none') {
      ([-1, 1] as const).forEach((s) => {
        const earPivot = new THREE.Group();
        const earMesh = buildEarAttachment(s, bp.ears, earOuterMat, earInnerMat);
        earPivot.add(earMesh);
        const tilt = THREE.MathUtils.degToRad(bp.ears.tiltDeg);
        const spread = THREE.MathUtils.degToRad(bp.ears.spreadDeg);

        const earRay = sideRight
          .clone()
          .multiplyScalar(s * 0.78)
          .addScaledVector(worldUp, 0.64 + bp.ears.offsetY * 3.5)
          .addScaledVector(fwdDir, -0.22 + bp.ears.offsetZ * 3.5);
        const earFallback = hi.headCenter
          .clone()
          .addScaledVector(sideRight, s * bp.head.midRadius * 0.78)
          .addScaledVector(worldUp, bp.head.midRadius * 0.65 + bp.ears.offsetY)
          .addScaledVector(fwdDir, -bp.head.length * 0.12 + bp.ears.offsetZ);
        const earHit = snapToSdfSurface(evaluator, hi.headCenter, earRay, earFallback, 0.82);
        // Slightly seat ear base into skull (-0.012) so animated twitches never reveal gaps
        const earWorld = earHit.point.clone().addScaledVector(earHit.normal, -0.012);
        earPivot.position.copy(worldToHeadLocal(hi.headBone, earWorld));
        earPivot.rotation.order = 'YXZ';
        earPivot.rotation.set(tilt, hi.yawRad, -s * spread);
        hi.headBone.add(earPivot);
        rigHead.ears.push({ side: s, pivot: earPivot, baseRotX: tilt, baseRotZ: -s * spread });
        partMeshes.ears?.push(earPivot);
      });
    }

    // Surface-Conformed Adjustable Nose (Round / Oval / Soft Triangle / Snout Pad / Nostrils-Only, Flat-to-3D)
    const nc = bp.nose;
    if (nc.enabled && nc.style !== 'none') {
      let noseOrigin = bp.muzzle.enabled && hi.muzzleStart
        ? hi.muzzleStart.clone().lerp(hi.muzzleTip, 0.56)
        : hi.headCenter.clone().addScaledVector(hi.headFwd, bp.head.length * 0.14);
      if (nc.posZ < -0.01) {
        noseOrigin = noseOrigin.clone().lerp(hi.headCenter, THREE.MathUtils.clamp(-nc.posZ * 4.5, 0, 0.92));
      }
      if (evaluator.evaluate(noseOrigin.x, noseOrigin.y, noseOrigin.z) >= -0.004) {
        noseOrigin = hi.headCenter.clone();
      }

      const baseNoseRay = (bp.muzzle.enabled ? hi.muzzleDir : fwdDir)
        .clone()
        .multiplyScalar(0.86)
        .addScaledVector(worldUp, bp.muzzle.enabled ? 0.36 : 0.06)
        .normalize();
      const baseNoseFb = (bp.muzzle.enabled ? hi.muzzleTip : hi.headCenter.clone().addScaledVector(fwdDir, bp.head.midRadius * 0.92))
        .clone()
        .addScaledVector(worldUp, bp.muzzle.enabled ? bp.muzzle.height * bp.muzzle.taper * 0.32 : 0.01);
      const baseNoseHit = snapToSdfSurface(evaluator, noseOrigin, baseNoseRay, baseNoseFb, 0.72);

      const shiftedNoseHint = baseNoseHit.point
        .clone()
        .addScaledVector(sideRight, nc.posX)
        .addScaledVector(worldUp, nc.posY)
        .addScaledVector(fwdDir, nc.posZ);
      const noseHit = snapToSdfSurface(
        evaluator,
        noseOrigin,
        shiftedNoseHint.clone().sub(noseOrigin),
        shiftedNoseHint,
        0.8
      );

      const nNormal = noseHit.normal.clone().normalize();
      const nUp = worldUp.clone().addScaledVector(nNormal, -worldUp.dot(nNormal));
      if (nUp.lengthSq() < 1e-6) nUp.copy(fwdDir);
      nUp.normalize();
      const nRight = new THREE.Vector3().crossVectors(nUp, nNormal).normalize();

      const nosePivot = new THREE.Group();
      nosePivot.position.copy(worldToHeadLocal(hi.headBone, noseHit.point));
      hi.headBone.add(nosePivot);
      nosePivot.updateMatrixWorld(true);

      const nw = THREE.MathUtils.clamp(nc.width, 0.01, 0.14);
      const nh = THREE.MathUtils.clamp(nc.height, 0.008, 0.11);
      const depth3D = THREE.MathUtils.clamp(nc.depth3D, 0.04, 1.4);
      const embed = THREE.MathUtils.clamp(nc.embed, -0.03, 0.05);
      const tiltRad = THREE.MathUtils.degToRad(nc.tiltDeg);
      const domeAxis = nNormal
        .clone()
        .multiplyScalar(Math.cos(tiltRad))
        .addScaledVector(nUp, Math.sin(tiltRad))
        .normalize();

      const mapShapeXY = (ang: number, rf: number): [number, number] => {
        const ca = Math.cos(ang);
        const sa = Math.sin(ang);
        if (nc.style === 'round') {
          return [ca * nw * rf, sa * nw * rf];
        }
        if (nc.style === 'oval') {
          return [ca * nw * rf, sa * nh * rf];
        }
        if (nc.style === 'snoutPad') {
          const p = 2.8;
          const superScale = 1 / Math.pow(Math.pow(Math.abs(ca), p) + Math.pow(Math.abs(sa), p) + 1e-6, 1 / p);
          return [ca * superScale * nw * 1.12 * rf, sa * superScale * nh * 0.96 * rf];
        }
        // Soft rounded triangle / shield nose
        const u = ca * rf;
        const v = sa * rf;
        const x = u * (0.76 + 0.34 * v) * nw;
        const y = (v * 0.92 - 0.14 * u * u * (v > 0 ? 1 : -0.4)) * nh;
        return [x, y];
      };

      const computeDomeElev = (rf: number) => {
        const clamped = THREE.MathUtils.clamp(rf, 0, 1);
        const domeProfile = Math.pow(Math.max(0, 1 - clamped * clamped), 0.56);
        const maxLift = Math.max(nw, nh) * depth3D * 0.78 + 0.0024;
        const skirtSink = clamped >= 0.99 ? -0.003 : 0;
        return maxLift * domeProfile + skirtSink + embed;
      };

      const projectNosePt = (xOff: number, yOff: number, rf: number) => {
        const worldHint = noseHit.point
          .clone()
          .addScaledVector(nRight, xOff)
          .addScaledVector(nUp, yOff);
        const ray = worldHint.clone().sub(noseOrigin);
        const sHit = snapToSdfSurface(evaluator, noseOrigin, ray, worldHint, 0.8);
        const elev = computeDomeElev(rf);
        // Outer perimeter snaps along local SDF normal so edge sits flush; inner dome rises along domeAxis
        const dirBlend = THREE.MathUtils.lerp(1, 0, THREE.MathUtils.clamp(rf, 0, 1));
        const pushDir = sHit.normal.clone().lerp(domeAxis, dirBlend).normalize();
        const worldPt = sHit.point.clone().addScaledVector(pushDir, elev);
        return {
          local: nosePivot.worldToLocal(worldPt),
          normalWorld: pushDir,
        };
      };

      if (nc.style === 'nostrilsOnly') {
        const ns = THREE.MathUtils.clamp(nc.nostrilScale, 0.4, 1.8);
        ([-1, 1] as const).forEach((s) => {
          const proj = projectNosePt(s * nw * 0.52, 0, 0.8);
          const worldTarget = noseHit.point
            .clone()
            .addScaledVector(nRight, s * nw * 0.52)
            .addScaledVector(nUp, 0);
          const sHit = snapToSdfSurface(evaluator, noseOrigin, worldTarget.clone().sub(noseOrigin), worldTarget, 0.78);
          const pit = new THREE.Mesh(new THREE.SphereGeometry(0.011 * ns, 10, 8), nostrilMat);
          pit.scale.set(0.84, 1.15, THREE.MathUtils.clamp(depth3D * 0.65, 0.18, 0.65));
          pit.position.copy(
            nosePivot.worldToLocal(sHit.point.clone().addScaledVector(sHit.normal, 0.0018 + embed))
          );
          void proj;
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), sHit.normal);
          pit.quaternion.copy(q);
          nosePivot.add(pit);
        });
      } else {
        const angSegs = 24;
        const radRings = 6;
        const nVerts: number[] = [];
        const nIdx: number[] = [];

        const centerPt = projectNosePt(0, 0, 0).local;
        nVerts.push(centerPt.x, centerPt.y, centerPt.z);

        for (let r = 1; r <= radRings; r++) {
          const rf = r === radRings ? 1.03 : (r / radRings) * 0.98;
          for (let a = 0; a < angSegs; a++) {
            const theta = (a / angSegs) * Math.PI * 2;
            const [ox, oy] = mapShapeXY(theta, Math.min(1.02, rf));
            const pt = projectNosePt(ox, oy, rf).local;
            nVerts.push(pt.x, pt.y, pt.z);
          }
        }

        // Center fan (outward facing along +nNormal: (0, cur, next))
        for (let a = 0; a < angSegs; a++) {
          const next = (a + 1) % angSegs;
          nIdx.push(0, 1 + a, 1 + next);
        }
        // Concentric rings
        for (let r = 1; r < radRings; r++) {
          const ringStart = 1 + (r - 1) * angSegs;
          const nextRingStart = 1 + r * angSegs;
          for (let a = 0; a < angSegs; a++) {
            const next = (a + 1) % angSegs;
            const i0 = ringStart + a;
            const i1 = ringStart + next;
            const o0 = nextRingStart + a;
            const o1 = nextRingStart + next;
            nIdx.push(i0, o0, i1, i1, o0, o1);
          }
        }

        const noseGeo = new THREE.BufferGeometry();
        noseGeo.setAttribute('position', new THREE.Float32BufferAttribute(nVerts, 3));
        noseGeo.setIndex(nIdx);
        noseGeo.computeVertexNormals();
        const noseMesh = new THREE.Mesh(noseGeo, noseMat);
        noseMesh.castShadow = true;
        nosePivot.add(noseMesh);

        if (nc.showNostrils) {
          const ns = THREE.MathUtils.clamp(nc.nostrilScale, 0.4, 1.8);
          ([-1, 1] as const).forEach((s) => {
            const nx = s * nw * (nc.style === 'snoutPad' ? 0.44 : 0.36);
            const ny = nc.style === 'snoutPad' ? 0.0 : -nh * 0.16;
            const rfApprox = nc.style === 'snoutPad' ? 0.42 : 0.45;
            const nProj = projectNosePt(nx, ny, rfApprox);
            const pit = new THREE.Mesh(new THREE.SphereGeometry(0.0075 * ns, 10, 8), nostrilMat);
            pit.scale.set(0.75, 1.08, 0.45);
            pit.position.copy(nProj.local);
            const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), nProj.normalWorld);
            pit.quaternion.copy(q);
            nosePivot.add(pit);
          });
        }
      }

      partMeshes.nose?.push(nosePivot);
    }

    // Surface-Conformed 5-Mood Expressive Mouth (Black Void + Inner/Stick-Out Tongue + Separate Teeth Rig)
    const mc = bp.mouth;
    const tc = bp.teeth;
    const mw = THREE.MathUtils.clamp(mc.width, 0.04, 0.28);

    // Ensure mouth interior ray origin is inside the sculpted front face/muzzle SDF
    let mouthInterior = bp.muzzle.enabled && hi.muzzleStart
      ? hi.muzzleStart.clone().lerp(hi.muzzleTip, 0.65)
      : hi.headCenter.clone().addScaledVector(hi.headFwd, bp.head.length * 0.16);
    if (evaluator.evaluate(mouthInterior.x, mouthInterior.y, mouthInterior.z) >= -0.004) {
      mouthInterior = hi.headCenter.clone();
    }

    const mouthCenterTiltY = bp.muzzle.enabled ? -0.24 : -0.28;
    const baseMouthRay = hi.muzzleDir
      .clone()
      .addScaledVector(worldUp, mouthCenterTiltY)
      .normalize();
    const baseFallback = (bp.muzzle.enabled ? hi.muzzleTip : hi.headCenter.clone().addScaledVector(fwdDir, bp.head.midRadius * 0.85))
      .clone()
      .addScaledVector(worldUp, -(bp.muzzle.enabled ? bp.muzzle.height * 0.34 : bp.head.midRadius * 0.26));
    const baseMouthHit = snapToSdfSurface(evaluator, mouthInterior, baseMouthRay, baseFallback, 0.72);
    const shiftedCenterHint = baseMouthHit.point
      .clone()
      .addScaledVector(fwdDir, mc.offsetZ * 0.75)
      .addScaledVector(worldUp, mc.offsetY);
    const frontMouthHit = snapToSdfSurface(
      evaluator,
      mouthInterior,
      shiftedCenterHint.clone().sub(mouthInterior),
      shiftedCenterHint,
      0.74
    );

    const n0 = frontMouthHit.normal.clone().normalize();
    const up0 = worldUp.clone().addScaledVector(n0, -worldUp.dot(n0));
    if (up0.lengthSq() < 1e-6) up0.copy(worldUp);
    up0.normalize();
    const right0 = new THREE.Vector3().crossVectors(up0, n0).normalize();

    const lipOutBias = mc.lipThickness * 0.55 + 0.003;
    const mouthDepthBias = mc.offsetZ * 0.25;
    const lipGrp = new THREE.Group();
    const lipAnchorWorld = frontMouthHit.point.clone().addScaledVector(n0, mouthDepthBias);
    lipGrp.position.copy(worldToHeadLocal(hi.headBone, lipAnchorWorld));
    lipGrp.rotation.order = 'YXZ';
    lipGrp.rotation.y = hi.yawRad;
    hi.headBone.add(lipGrp);
    lipGrp.updateMatrixWorld(true);

    const projectToLipGrp = (xOff: number, yOff: number, normalBias: number) => {
      const worldHint = frontMouthHit.point
        .clone()
        .addScaledVector(right0, xOff)
        .addScaledVector(up0, yOff);
      const ray = worldHint.clone().sub(mouthInterior);
      const hit = snapToSdfSurface(evaluator, mouthInterior, ray, worldHint, 0.8);
      const worldPt = hit.point.clone().addScaledVector(hit.normal, normalBias + mouthDepthBias);
      return {
        local: lipGrp.worldToLocal(worldPt),
        normalLocal: hit.normal.clone().transformDirection(lipGrp.matrixWorld.clone().invert()).normalize(),
      };
    };

    const voidMat = new THREE.MeshBasicMaterial({
      color: mc.interiorColor === '#3B0A1A' ? '#14090D' : mc.interiorColor,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const innerRimMat = new THREE.MeshBasicMaterial({
      color: '#1A0D12',
      side: THREE.DoubleSide,
    });
    const innerTongueMat = new THREE.MeshBasicMaterial({
      color: mc.tongueColor,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });

    const allMoods: CreatureExpressionMood[] = ['closed', 'open', 'happy', 'angry', 'shy'];
    const moodGroups = {} as Record<CreatureExpressionMood, THREE.Group>;
    const restOpen = THREE.MathUtils.clamp(mc.mouthOpen, 0, 0.75);

    const buildMoodContour = (m: CreatureExpressionMood) => {
      const grp = new THREE.Group();
      grp.visible = m === mc.mood;
      lipGrp.add(grp);

      const isPureClosed = m === 'closed' && restOpen <= 0.025;
      const widthMult =
        m === 'happy' ? 1.15 : m === 'angry' ? 1.08 : m === 'open' ? 0.86 : m === 'shy' ? 0.54 : 0.98;
      const effW = mw * widthMult;
      const openH =
        m === 'closed'
          ? mw * (0.04 + restOpen * 0.72)
          : m === 'open'
          ? mw * (0.58 + restOpen * 0.45)
          : m === 'happy'
          ? mw * (0.5 + restOpen * 0.4)
          : m === 'angry'
          ? mw * (0.44 + restOpen * 0.42)
          : mw * (0.24 + restOpen * 0.3);

      const getTopBot = (u: number): [number, number] => {
        const smileLift = mc.smileCurve * 0.02 * (u * u - 0.35);
        if (m === 'closed') {
          if (isPureClosed) {
            return [smileLift, smileLift];
          }
          const almond = Math.sqrt(Math.max(0, 1 - u * u * 0.96));
          return [smileLift + openH * 0.44 * almond, smileLift - openH * 0.58 * almond];
        }
        if (m === 'open') {
          const arch = Math.sqrt(Math.max(0, 1 - u * u * 0.97));
          return [openH * 0.44 * arch, -openH * 0.68 * arch];
        }
        if (m === 'happy') {
          const lift = u * u * openH * 0.34;
          return [openH * 0.14 + lift, -openH * 0.76 * (1 - u * u * 0.78) + lift * 0.32];
        }
        if (m === 'angry') {
          // Center snarl arch + downturned scowl corners
          const top = openH * (0.32 * Math.cos(u * Math.PI * 0.5) - 0.2 * u * u);
          const bot = openH * (-0.36 - 0.28 * Math.sin(Math.abs(u) * Math.PI * 0.85) + 0.1 * (1 - u * u));
          return [top, Math.min(top - openH * 0.12, bot)];
        }
        // shy
        const arch = Math.sqrt(Math.max(0, 1 - u * u * 0.96));
        const top = openH * 0.32 * arch - Math.cos(u * Math.PI * 2) * openH * 0.12;
        const bot = -openH * 0.48 * arch;
        return [top, Math.min(top - openH * 0.08, bot)];
      };

      const cols = 15;
      const rows = 5;

      const buildTaperedLip = (pts: THREE.Vector3[], maxRad: number) => {
        const segs = 22;
        const radSegs = 10;
        const curve = new THREE.CatmullRomCurve3(pts);
        const geo = new THREE.TubeGeometry(curve, segs, maxRad, radSegs, false);
        const pos = geo.attributes.position as THREE.BufferAttribute;
        const vTmp = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) {
          const ringIdx = Math.floor(i / (radSegs + 1));
          const frac = THREE.MathUtils.clamp(ringIdx / segs, 0, 1);
          const cPt = curve.getPointAt(frac);
          const taper = 0.22 + 0.78 * Math.pow(Math.max(0, Math.sin(frac * Math.PI)), 0.55);
          vTmp.fromBufferAttribute(pos, i).sub(cPt).multiplyScalar(taper).add(cPt);
          pos.setXYZ(i, vTmp.x, vTmp.y, vTmp.z);
        }
        geo.computeVertexNormals();
        const mesh = new THREE.Mesh(geo, lipMat);
        mesh.castShadow = true;
        const capRad = maxRad * 0.22;
        for (const endPt of [pts[0], pts[pts.length - 1]]) {
          const cap = new THREE.Mesh(new THREE.SphereGeometry(capRad, 8, 6), lipMat);
          cap.position.copy(endPt);
          mesh.add(cap);
        }
        return mesh;
      };

      if (isPureClosed) {
        const lipPts: THREE.Vector3[] = [];
        for (let i = 0; i < cols; i++) {
          const u = -1 + (2 * i) / (cols - 1);
          const [ty] = getTopBot(u);
          lipPts.push(projectToLipGrp(u * effW, ty, lipOutBias).local);
        }
        grp.add(buildTaperedLip(lipPts, mc.lipThickness));
      } else {
        // 1. Matte-black curved void interior grid conforming cleanly onto snout/head SDF
        const cavVerts: number[] = [];
        const cavIdx: number[] = [];
        const rimVerts: number[] = [];
        const rimIdx: number[] = [];
        const topLipPts: THREE.Vector3[] = [];
        const botLipPts: THREE.Vector3[] = [];

        for (let i = 0; i < cols; i++) {
          const u = -1 + (2 * i) / (cols - 1);
          const [ty, by] = getTopBot(u);
          const x = u * effW;
          for (let r = 0; r < rows; r++) {
            const vf = r / (rows - 1);
            const y = THREE.MathUtils.lerp(by, ty, vf);
            const p = projectToLipGrp(x, y, 0.0022).local;
            cavVerts.push(p.x, p.y, p.z);
          }
          // Outer & inner rim points
          const topRimIn = projectToLipGrp(x, ty, 0.0027).local;
          const topRimOut = projectToLipGrp(x * 1.03, ty + 0.003, 0.0029).local;
          const botRimIn = projectToLipGrp(x, by, 0.0027).local;
          const botRimOut = projectToLipGrp(x * 1.03, by - 0.003, 0.0029).local;
          rimVerts.push(
            topRimIn.x, topRimIn.y, topRimIn.z,
            topRimOut.x, topRimOut.y, topRimOut.z,
            botRimIn.x, botRimIn.y, botRimIn.z,
            botRimOut.x, botRimOut.y, botRimOut.z
          );

          const lipTaperBias = Math.sqrt(Math.max(0.08, 1 - u * u * 0.9));
          topLipPts.push(projectToLipGrp(x, ty + mc.lipThickness * 0.24 * lipTaperBias, lipOutBias).local);
          botLipPts.push(projectToLipGrp(x, by - mc.lipThickness * 0.24 * lipTaperBias, lipOutBias).local);
        }

        for (let i = 0; i < cols - 1; i++) {
          for (let r = 0; r < rows - 1; r++) {
            const a = i * rows + r;
            const b = a + 1;
            const c = (i + 1) * rows + r;
            const d = c + 1;
            cavIdx.push(a, c, b, b, c, d);
          }
          const rA = i * 4;
          const rC = (i + 1) * 4;
          rimIdx.push(rA, rC, rA + 1, rA + 1, rC, rC + 1);
          rimIdx.push(rA + 2, rA + 3, rC + 2, rA + 3, rC + 3, rC + 2);
        }

        const cavGeo = new THREE.BufferGeometry();
        cavGeo.setAttribute('position', new THREE.Float32BufferAttribute(cavVerts, 3));
        cavGeo.setIndex(cavIdx);
        cavGeo.computeVertexNormals();
        grp.add(new THREE.Mesh(cavGeo, voidMat));

        const rimGeo = new THREE.BufferGeometry();
        rimGeo.setAttribute('position', new THREE.Float32BufferAttribute(rimVerts, 3));
        rimGeo.setIndex(rimIdx);
        rimGeo.computeVertexNormals();
        grp.add(new THREE.Mesh(rimGeo, innerRimMat));

        grp.add(
          buildTaperedLip(topLipPts, mc.lipThickness * 0.92),
          buildTaperedLip(botLipPts, mc.lipThickness * 0.92)
        );

        // 2. Inner flat cartoon tongue contained STRICTLY inside lower half of black void & BEHIND teeth
        if (mc.tongueVisible && (m === 'open' || m === 'happy' || m === 'angry' || restOpen > 0.04)) {
          const tCols = 11;
          const tRows = 4;
          const tVerts: number[] = [];
          const tIdx: number[] = [];
          const tSpan = m === 'open' ? 0.62 : 0.72;
          for (let i = 0; i < tCols; i++) {
            const tu = -1 + (2 * i) / (tCols - 1);
            const uMouth = tu * tSpan;
            const [ty, by] = getTopBot(uMouth);
            const hSpan = Math.max(0.002, ty - by);
            const x = uMouth * effW;
            const archTop = Math.sqrt(Math.max(0, 1 - tu * tu * 0.92));
            const tLow = by + hSpan * 0.06;
            const tHigh = by + hSpan * (0.14 + 0.44 * archTop);
            for (let r = 0; r < tRows; r++) {
              const vf = r / (tRows - 1);
              const y = THREE.MathUtils.lerp(tLow, tHigh, vf);
              const tp = projectToLipGrp(x, y, 0.0033).local;
              tVerts.push(tp.x, tp.y, tp.z);
            }
          }
          for (let i = 0; i < tCols - 1; i++) {
            for (let r = 0; r < tRows - 1; r++) {
              const a = i * tRows + r;
              const b = a + 1;
              const c = (i + 1) * tRows + r;
              const d = c + 1;
              tIdx.push(a, c, b, b, c, d);
            }
          }
          const tGeo = new THREE.BufferGeometry();
          tGeo.setAttribute('position', new THREE.Float32BufferAttribute(tVerts, 3));
          tGeo.setIndex(tIdx);
          tGeo.computeVertexNormals();
          grp.add(new THREE.Mesh(tGeo, innerTongueMat));
        }
      }

      // 3. Dedicated Surface-Conformed Teeth & Fangs Rig (sits IN FRONT of inner tongue & void, never buried in head)
      if (tc.style !== 'none') {
        const teethGrp = new THREE.Group();
        grp.add(teethGrp);
        partMeshes.teeth?.push(teethGrp);

        const tSharp = THREE.MathUtils.clamp(tc.sharpness, 0, 1);
        const tSize = THREE.MathUtils.clamp(tc.size, 0.35, 2.2);
        const tSpread = THREE.MathUtils.clamp(tc.spreadX, 0.4, 1.6);
        const zTeeth = 0.0046 + tc.offsetZ;

        // Flat Top & Bottom Tooth Strips hugging the inside edge of upper and lower lips
        if (tc.style === 'strips' || tc.style === 'stripsAndCanine') {
          const stripMat = teethMat.clone();
          stripMat.side = THREE.DoubleSide;
          const stripCols = 17;
          const stripRows = 3;
          const buildStrip = (isTop: boolean) => {
            const verts: number[] = [];
            const idxs: number[] = [];
            const stripSpan = m === 'open' ? 0.78 : m === 'shy' ? 0.72 : 0.88;
            const maxOpening = Math.max(0.006, openH * 0.42);
            const stripH = Math.max(
              0.005,
              Math.min(
                maxOpening * Math.max(0.75, tSize),
                (isPureClosed ? mw * 0.065 : Math.max(openH * 0.24, mw * 0.095)) * tSize
              )
            );
            const yShift = tc.offsetY + (isTop ? tc.topOffsetY : tc.bottomOffsetY);
            const depthFront = (isPureClosed ? 0.0038 : 0.0046) + tc.offsetZ;
            const depthBack = depthFront - 0.0024;

            // Front curved white ribbon (stripCols x stripRows) snapped cleanly onto SDF curvature
            for (let i = 0; i < stripCols; i++) {
              const frac = i / (stripCols - 1);
              const u = (-1 + 2 * frac) * stripSpan * Math.min(1.12, tSpread);
              const uClamped = THREE.MathUtils.clamp(u, -0.95, 0.95);
              const [ty, by] = getTopBot(uClamped);
              const x = uClamped * effW + tc.offsetX;
              const taperEnd = 0.55 + 0.45 * Math.sqrt(Math.max(0.12, 1 - uClamped * uClamped * 0.82));
              const serration =
                tSharp > 0.05
                  ? Math.abs(Math.sin(frac * Math.PI * 5)) * stripH * 0.52 * tSharp
                  : 0;

              let yRoot: number;
              let yBite: number;
              if (isTop) {
                yRoot = ty + (isPureClosed ? 0.002 : mc.lipThickness * 0.14) + yShift;
                yBite = ty - stripH * taperEnd - serration + yShift;
              } else {
                yRoot = by - (isPureClosed ? 0.002 : mc.lipThickness * 0.14) + yShift;
                yBite = by + stripH * 0.88 * taperEnd + serration + yShift;
              }

              for (let r = 0; r < stripRows; r++) {
                const vf = r / (stripRows - 1);
                const y = THREE.MathUtils.lerp(yRoot, yBite, vf);
                // Slight smooth front convexity so root & biting edge sit softly into mouth opening
                const zBias = depthFront + Math.sin(vf * Math.PI * 0.75) * 0.0006;
                const pt = projectToLipGrp(x, y, zBias).local;
                verts.push(pt.x, pt.y, pt.z);
              }
            }

            // Front face triangles (strictly outward facing toward +n0)
            for (let i = 0; i < stripCols - 1; i++) {
              for (let r = 0; r < stripRows - 1; r++) {
                const a = i * stripRows + r;
                const b = a + 1;
                const c = (i + 1) * stripRows + r;
                const d = c + 1;
                if (isTop) {
                  // y decreases from r=0 (root) to r=2 (bite), x increases from i to i+1 -> (-Y) x (+X) = +Z
                  idxs.push(a, b, c, b, d, c);
                } else {
                  // y increases from r=0 (root) to r=2 (bite), x increases from i to i+1 -> (+X) x (+Y) = +Z
                  idxs.push(a, c, b, b, c, d);
                }
              }
            }

            // Biting-edge thickness skirt connecting front biting edge back into void so tooth strip looks solid from any angle
            const backOffset = stripCols * stripRows;
            for (let i = 0; i < stripCols; i++) {
              const frac = i / (stripCols - 1);
              const u = (-1 + 2 * frac) * stripSpan * Math.min(1.12, tSpread);
              const uClamped = THREE.MathUtils.clamp(u, -0.95, 0.95);
              const [ty, by] = getTopBot(uClamped);
              const x = uClamped * effW + tc.offsetX;
              const taperEnd = 0.55 + 0.45 * Math.sqrt(Math.max(0.12, 1 - uClamped * uClamped * 0.82));
              const serration =
                tSharp > 0.05
                  ? Math.abs(Math.sin(frac * Math.PI * 5)) * stripH * 0.52 * tSharp
                  : 0;
              const yBite = isTop
                ? ty - stripH * taperEnd - serration + yShift
                : by + stripH * 0.88 * taperEnd + serration + yShift;
              const ptBack = projectToLipGrp(x, yBite, depthBack).local;
              verts.push(ptBack.x, ptBack.y, ptBack.z);
            }
            for (let i = 0; i < stripCols - 1; i++) {
              const frontL = i * stripRows + (stripRows - 1);
              const frontR = (i + 1) * stripRows + (stripRows - 1);
              const backL = backOffset + i;
              const backR = backOffset + i + 1;
              if (isTop) {
                idxs.push(frontL, backL, frontR, backL, backR, frontR);
              } else {
                idxs.push(frontL, frontR, backL, backL, frontR, backR);
              }
            }

            const sGeo = new THREE.BufferGeometry();
            sGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
            sGeo.setIndex(idxs);
            sGeo.computeVertexNormals();
            const sMesh = new THREE.Mesh(sGeo, stripMat);
            sMesh.castShadow = true;
            teethGrp.add(sMesh);
          };

          if (tc.showTop) buildStrip(true);
          if (tc.showBottom) buildStrip(false);
        }

        // Canine Fangs (support Top/Bottom, Left/Right/Up/Down/Fwd/Back, Sharp vs Dull)
        if (tc.style === 'canine' || tc.style === 'stripsAndCanine') {
          const fangR = 0.0115 * tSize;
          const fangH = 0.036 * tSize;
          const fangSoft = 1 - tSharp;
          const fangGeo = createSculptedPinGeometry(fangR, fangR * 0.56, fangH, fangSoft, 0.04, 12, 8);
          const uFang = THREE.MathUtils.clamp(0.56 * tSpread, 0.16, 0.92);

          ([-1, 1] as const).forEach((side) => {
            const uSigned = side * uFang;
            const [ty, by] = getTopBot(uSigned);
            const xBase = uSigned * effW + tc.offsetX;

            if (tc.showTop) {
              const yBase = ty + tc.offsetY + tc.topOffsetY + (isPureClosed ? 0.004 : -0.001);
              const proj = projectToLipGrp(xBase, yBase, zTeeth + 0.0022);
              const fang = new THREE.Mesh(fangGeo, teethMat);
              fang.position.copy(proj.local);
              fang.rotation.set(Math.PI, 0, -side * 0.08);
              fang.castShadow = true;
              teethGrp.add(fang);
            }
            if (tc.showBottom) {
              const uLow = side * THREE.MathUtils.clamp(0.42 * tSpread, 0.12, 0.86);
              const [, lowY] = getTopBot(uLow);
              const yBase = lowY + tc.offsetY + tc.bottomOffsetY + (isPureClosed ? -0.004 : 0.001);
              const proj = projectToLipGrp(uLow * effW + tc.offsetX, yBase, zTeeth + 0.0022);
              const fang = new THREE.Mesh(fangGeo, teethMat);
              fang.position.copy(proj.local);
              fang.rotation.set(0, 0, -side * 0.08);
              fang.castShadow = true;
              teethGrp.add(fang);
            }
          });
        }

        // Cute / Comical Buck Teeth
        if (tc.style === 'buck') {
          const bR = 0.0125 * tSize;
          const bH = 0.028 * tSize;
          const buckGeo = createSculptedPinGeometry(bR, bR * 0.38, bH, 1 - tSharp * 0.85, 0.02, 10, 8);
          ([-1, 1] as const).forEach((side) => {
            const uBuck = side * THREE.MathUtils.clamp(0.16 * tSpread, 0.06, 0.45);
            const [ty, by] = getTopBot(uBuck);
            const xBase = uBuck * effW + tc.offsetX;
            if (tc.showTop) {
              const yBase = ty + tc.offsetY + tc.topOffsetY;
              const proj = projectToLipGrp(xBase, yBase, zTeeth + 0.0018);
              const tooth = new THREE.Mesh(buckGeo, teethMat);
              tooth.position.copy(proj.local);
              tooth.rotation.x = Math.PI;
              tooth.castShadow = true;
              teethGrp.add(tooth);
            }
            if (tc.showBottom) {
              const yBase = by + tc.offsetY + tc.bottomOffsetY;
              const proj = projectToLipGrp(xBase, yBase, zTeeth + 0.0018);
              const tooth = new THREE.Mesh(buckGeo, teethMat);
              tooth.position.copy(proj.local);
              tooth.castShadow = true;
              teethGrp.add(tooth);
            }
          });
        }
      }

      return grp;
    };

    for (const m of allMoods) {
      moodGroups[m] = buildMoodContour(m);
    }

    rigHead.lipGroup = lipGrp;
    rigHead.mouthMoodGroups = moodGroups;
    partMeshes.mouth?.push(lipGrp);

    // Sync breath/beam mouthAnchor directly to true projected front mouth surface
    const localSurfaceMouth = worldToHeadLocal(hi.headBone, frontMouthHit.point.clone().addScaledVector(frontMouthHit.normal, 0.025));
    rigHead.mouthAnchor.position.copy(localSurfaceMouth);

    // Optional Stick-Out Tongue control (curves cleanly out from lower-center inside mouth void!)
    const stickAmt = THREE.MathUtils.clamp(mc.tongueStickOut ?? 0, 0, 1);
    if (mc.tongueVisible && stickAmt > 0.02) {
      const stickLen = 0.016 + mw * 0.64 * stickAmt;
      const rootWorld = frontMouthHit.point
        .clone()
        .addScaledVector(n0, mouthDepthBias - 0.001)
        .addScaledVector(up0, -mw * 0.14);
      const midWorld = rootWorld
        .clone()
        .addScaledVector(n0, stickLen * 0.56)
        .addScaledVector(up0, -stickLen * 0.18);
      const tipWorld = rootWorld
        .clone()
        .addScaledVector(n0, stickLen)
        .addScaledVector(up0, -stickLen * 0.44);

      const tCurve = new THREE.CatmullRomCurve3([
        lipGrp.worldToLocal(rootWorld),
        lipGrp.worldToLocal(midWorld),
        lipGrp.worldToLocal(tipWorld),
      ]);
      const tGeo = new THREE.TubeGeometry(tCurve, 12, mw * 0.17, 10, false);
      const tPos = tGeo.attributes.position as THREE.BufferAttribute;
      const vTmp = new THREE.Vector3();
      for (let i = 0; i < tPos.count; i++) {
        const ringIdx = Math.floor(i / 11);
        const frac = THREE.MathUtils.clamp(ringIdx / 12, 0, 1);
        const cPt = tCurve.getPointAt(frac);
        vTmp.fromBufferAttribute(tPos, i).sub(cPt);
        const wTaper = 0.92 + Math.sin(frac * Math.PI * 0.75) * 0.25 - frac * 0.28;
        vTmp.x *= wTaper;
        vTmp.y *= 0.36 * Math.max(0.25, 1 - frac * 0.45);
        vTmp.z *= wTaper;
        vTmp.add(cPt);
        tPos.setXYZ(i, vTmp.x, vTmp.y, vTmp.z);
      }
      tGeo.computeVertexNormals();
      const stickTongue = new THREE.Mesh(tGeo, tongueMat);
      stickTongue.castShadow = true;
      const tipCap = new THREE.Mesh(new THREE.SphereGeometry(mw * 0.125, 10, 8), tongueMat);
      tipCap.scale.set(1.0, 0.34, 0.95);
      tipCap.position.copy(lipGrp.worldToLocal(tipWorld));
      stickTongue.add(tipCap);
      lipGrp.add(stickTongue);
      rigHead.tongueStickMesh = stickTongue;
      partMeshes.mouth?.push(stickTongue);
    }
  }

  // Attach wings onto wing bones
  if (wingL && wingR) {
    const wLeft = buildMonsterWingSide(-1, bp, wingL.innerPivot, wingL.outerPivot, wingBoneMat, wingMemMat, wingTipMat);
    const wRight = buildMonsterWingSide(1, bp, wingR.innerPivot, wingR.outerPivot, wingBoneMat, wingMemMat, wingTipMat);
    partMeshes.wings?.push(...wLeft, ...wRight);
  }

  // Attach Dorsal Spikes / Fins / Crystals / Armor Plates conformed to spine SDF surface
  const spikeMeshes = buildDorsalSpikes(bp, chestPos, torsoPos, hipsPos, bodyPivot, evaluator, spikeMat, spikeTipMat);
  partMeshes.spikes?.push(...spikeMeshes);

  // Chest & Tail-Tip Anchors for Ground Pound / Tail Smash VFX
  const chestAnchor = new THREE.Object3D();
  chestAnchor.name = 'MonsterChestAnchor';
  chestBone.add(chestAnchor);

  const tailTipAnchor = new THREE.Object3D();
  tailTipAnchor.name = 'MonsterTailTipAnchor';
  if (tailSegments.length > 0) {
    tailSegments[tailSegments.length - 1].add(tailTipAnchor);
    tailTipAnchor.position.set(0, 0, -bp.tail.length * 0.25);
  } else {
    hipsBone.add(tailTipAnchor);
  }

  // Enemy Strike Slash Arc (hidden unless melee strike)
  const slashGeo = new THREE.RingGeometry(0.55, 1.4, 18, 1, -0.95, 1.9);
  slashGeo.rotateX(-Math.PI / 2);
  const slashMat = new THREE.MeshBasicMaterial({
    color: '#FF5E3A',
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const slashArc = new THREE.Mesh(slashGeo, slashMat);
  slashArc.position.y = bodyCenterY * 0.8;
  slashArc.visible = false;
  root.add(slashArc);

  root.scale.setScalar(scale);

  const flashMaterials: THREE.MeshStandardMaterial[] = [
    clayMat,
    hornMat,
    earOuterMat,
    wingBoneMat,
    wingMemMat,
    spikeMat,
  ];

  // Measure actual bounds topHeight
  root.updateMatrixWorld(true);
  const bbox = sdfResult.geometry.boundingBox ?? new THREE.Box3();
  const topHeight = Math.max(1.2, (bbox.max.y + bp.horns.length * 0.7) * scale);

  const rig: QuadrupedMonsterRig = {
    root,
    bodyPivot,
    chestBone,
    torsoBone,
    spineBackPivot: hipsBone,
    skinnedMesh,
    skeleton,
    bones,
    partWeights: sdfResult.partWeights,
    seamZones: sdfResult.seamZones,
    seamGaps: sdfResult.seamGaps,
    segmentGuides: options?.includeGuides ? guideRings : undefined,
    partMeshes,
    vertexCount: sdfResult.vertexCount,
    legs,
    heads,
    tailSegments,
    wingL,
    wingR,
    mouthAnchors,
    chestAnchor,
    tailTipAnchor,
    slashArc,
    slashMat,
    flashMaterials,
    groundClearance,
    topHeight,
    canFly,
    hasWings,
    legPairs,
    isSpider,
    scale,
    mouthMood: bp.mouth.mood,
    eyebrowMood: bp.eyebrows.mood,
    blueprint: bp,
  };

  root.userData.quadrupedRig = rig;
  return root;
}

export function setQuadrupedExpressionMood(
  rig: QuadrupedMonsterRig,
  mouthMood: CreatureExpressionMood,
  eyebrowMood?: CreatureExpressionMood
): void {
  rig.mouthMood = mouthMood;
  rig.eyebrowMood = eyebrowMood ?? mouthMood;
}

function getMoodOffsets(mood: CreatureExpressionMood): {
  jawAdd: number;
  browTiltAdd: number;
  browLiftY: number;
  lidAdd: number;
  showBlush: boolean;
  blushOpacity: number;
  showTongue: boolean;
  lipScaleX: number;
  lipTiltX: number;
} {
  switch (mood) {
    case 'open':
      return {
        jawAdd: 0.38,
        browTiltAdd: -0.1,
        browLiftY: 0.012,
        lidAdd: -0.05,
        showBlush: false,
        blushOpacity: 0,
        showTongue: true,
        lipScaleX: 1.04,
        lipTiltX: 0.09,
      };
    case 'angry':
      return {
        jawAdd: 0.18,
        browTiltAdd: 0.42,
        browLiftY: -0.012,
        lidAdd: 0.28,
        showBlush: false,
        blushOpacity: 0,
        showTongue: false,
        lipScaleX: 1.04,
        lipTiltX: -0.1,
      };
    case 'happy':
      return {
        jawAdd: 0.15,
        browTiltAdd: -0.18,
        browLiftY: 0.014,
        lidAdd: 0.12,
        showBlush: true,
        blushOpacity: 0.34,
        showTongue: true,
        lipScaleX: 1.07,
        lipTiltX: 0.12,
      };
    case 'shy':
      return {
        jawAdd: -0.02,
        browTiltAdd: -0.32,
        browLiftY: 0.008,
        lidAdd: 0.16,
        showBlush: true,
        blushOpacity: 0.72,
        showTongue: false,
        lipScaleX: 0.92,
        lipTiltX: 0.06,
      };
    case 'closed':
    default:
      return {
        jawAdd: 0,
        browTiltAdd: 0,
        browLiftY: 0,
        lidAdd: 0,
        showBlush: false,
        blushOpacity: 0,
        showTongue: false,
        lipScaleX: 1.0,
        lipTiltX: 0,
      };
  }
}

export function animateQuadrupedMonster(
  rig: QuadrupedMonsterRig,
  dt: number,
  elapsed: number,
  walkPhase: number,
  speedNorm: number,
  state: QuadrupedAnimState,
  stateProgress = 0,
  slopePitch = 0,
  recoilPitch = 0,
  recoilRoll = 0,
  attackType?: MonsterAttackType,
  mouthMoodOverride?: CreatureExpressionMood,
  eyebrowMoodOverride?: CreatureExpressionMood,
  airborneFrac = 0,
  windupClueStyle?: BaddieWindupClueStyle
): void {
  const moveAttack = attackType ?? rig.blueprint.primaryAttack ?? 'clawSlash';
  const clueStyle = resolveEffectiveWindupClueStyle(windupClueStyle, moveAttack, {
    headCount: rig.heads.length,
    canFly: rig.canFly,
    legPairs: rig.legPairs,
  });
  const windupP = THREE.MathUtils.clamp(stateProgress, 0, 1);
  const clueBeatsEnv = windupP < 0.76 ? Math.sin((windupP / 0.76) * Math.PI) : 0;
  const pullBackEnv =
    windupP >= 0.76 ? THREE.MathUtils.smoothstep((windupP - 0.76) / 0.24, 0, 1) : 0;
  const airBlend = THREE.MathUtils.clamp(airborneFrac, 0, 1);
  const isBreathOrBeam =
    moveAttack === 'fireBreath' ||
    moveAttack === 'iceBreath' ||
    moveAttack === 'waterJet' ||
    moveAttack === 'electricShock' ||
    moveAttack === 'poisonSpit' ||
    moveAttack === 'shadowBeam' ||
    moveAttack === 'solarBeam';

  // 1. Body Root Bounce / Flight Hover / Breath & Weight-Shift Idle
  let targetBodyY = rig.groundClearance + Math.max(rig.blueprint.chest.midRadius, rig.blueprint.torso.midRadius) * 0.58;
  let targetBodyPitch = slopePitch + recoilPitch;
  let targetBodyYaw = 0;
  let targetBodyRoll = recoilRoll;
  let chestBreathScale = 1.0;

  if (state === 'dying') {
    const p = THREE.MathUtils.clamp(stateProgress, 0, 1);
    if (p < 0.28) {
      const rear = Math.sin((p / 0.28) * Math.PI * 0.5);
      targetBodyY += 0.24 * rear;
      targetBodyPitch = -0.52 * rear;
      targetBodyRoll = Math.sin(elapsed * 26) * 0.08 * rear;
    } else {
      const collapse = THREE.MathUtils.smoothstep((p - 0.28) / 0.62, 0, 1);
      const slumpedY = Math.max(0.14, targetBodyY * 0.22);
      targetBodyY = THREE.MathUtils.lerp(targetBodyY + 0.16, slumpedY, collapse);
      targetBodyPitch = THREE.MathUtils.lerp(-0.46, 0.22, collapse);
      targetBodyRoll = THREE.MathUtils.lerp(0.08, 0.96, collapse);
    }
  } else if (state === 'stagger') {
    targetBodyPitch = -0.26 + recoilPitch;
    targetBodyRoll = Math.sin(elapsed * 24) * 0.14;
  } else if (state === 'fly') {
    const baseLift = airBlend > 0.02 ? 0 : 0.95;
    targetBodyY += baseLift + Math.sin(elapsed * 3.4) * 0.16;
    targetBodyPitch = -0.06 + Math.sin(elapsed * 3.4 - 0.5) * 0.08;
  } else if (state === 'celebrate') {
    targetBodyY += Math.abs(Math.sin(elapsed * 6.5)) * 0.22;
    targetBodyPitch = -0.18 + Math.sin(elapsed * 6.5) * 0.1;
  } else if (state === 'windup') {
    if (clueStyle === 'headSway3') {
      const swayWave = windupP < 0.76 ? Math.sin((windupP / 0.76) * Math.PI * 6) : 0;
      targetBodyYaw = swayWave * 0.16 * (0.5 + 0.5 * clueBeatsEnv);
      targetBodyRoll = -swayWave * 0.1 * clueBeatsEnv;
      targetBodyY += 0.06 * clueBeatsEnv + (moveAttack === 'groundPound' ? 0.22 : 0.12) * pullBackEnv;
      targetBodyPitch =
        -0.14 * clueBeatsEnv + (moveAttack === 'groundPound' ? -0.68 : -0.46) * pullBackEnv;
      chestBreathScale = 1.0 + 0.06 * Math.abs(swayWave) + 0.1 * pullBackEnv;
    } else if (clueStyle === 'footMarch') {
      const stompWave = windupP < 0.78 ? Math.abs(Math.sin((windupP / 0.78) * Math.PI * 6)) : 0;
      targetBodyY += stompWave * 0.09 + (moveAttack === 'groundPound' ? 0.22 : -0.1) * pullBackEnv;
      targetBodyRoll =
        (windupP < 0.78 ? Math.sin((windupP / 0.78) * Math.PI * 6) : 0) * 0.09;
      if (moveAttack === 'groundPound' || moveAttack === 'sonicRoar') {
        targetBodyPitch = -0.16 * stompWave - 0.65 * pullBackEnv;
      } else if (moveAttack === 'tailSmash') {
        targetBodyYaw = 0.65 * pullBackEnv + (windupP < 0.78 ? Math.sin((windupP / 0.78) * Math.PI * 6) * 0.14 : 0);
        targetBodyPitch = -0.14 * pullBackEnv;
      } else if (moveAttack === 'chargeGore') {
        targetBodyPitch = 0.26 * pullBackEnv + 0.08 * stompWave;
      } else {
        targetBodyPitch = -0.34 * pullBackEnv;
      }
    } else if (clueStyle === 'wingFlare') {
      const pulse = windupP < 0.76 ? Math.abs(Math.sin((windupP / 0.76) * Math.PI * 3)) : 0;
      targetBodyY += 0.12 * pulse + 0.16 * pullBackEnv;
      targetBodyPitch = -0.22 * pulse - 0.48 * pullBackEnv;
      chestBreathScale = 1.0 + 0.08 * pulse + 0.1 * pullBackEnv;
    } else {
      // crouchPounce
      const coil = windupP < 0.75 ? Math.sin((windupP / 0.75) * Math.PI * 6) : 0;
      targetBodyY -= 0.16 * THREE.MathUtils.clamp(windupP * 1.35, 0, 1);
      targetBodyRoll = coil * 0.08;
      targetBodyPitch = 0.24 * pullBackEnv + 0.1 * windupP;
    }
  } else if (state === 'strike') {
    const p = Math.sin(THREE.MathUtils.clamp(stateProgress, 0, 1) * Math.PI);
    if (moveAttack === 'groundPound') {
      const slam = Math.min(1, stateProgress * 2.2);
      targetBodyY -= 0.16 * Math.sin(slam * Math.PI * 0.5);
      targetBodyPitch = THREE.MathUtils.lerp(-0.55, 0.28, slam);
    } else if (moveAttack === 'tailSmash') {
      targetBodyYaw = THREE.MathUtils.lerp(0.62, -1.25, Math.min(1, stateProgress * 1.35));
      targetBodyRoll = 0.14 * p;
    } else if (moveAttack === 'sonicRoar') {
      targetBodyPitch = -0.45 * p;
      targetBodyRoll = Math.sin(elapsed * 42) * 0.06;
    } else if (moveAttack === 'chargeGore') {
      targetBodyPitch = 0.18 - 0.35 * p;
      targetBodyY += 0.08 * p;
    } else if (isBreathOrBeam) {
      targetBodyPitch = 0.12 * p;
      targetBodyYaw = Math.sin(stateProgress * Math.PI * 2.2) * 0.18;
    } else {
      targetBodyPitch = 0.34 * p;
      targetBodyY += 0.08 * p;
    }
  } else if (state === 'walk' || state === 'run') {
    const amp = state === 'run' ? 0.095 : 0.042;
    targetBodyY += Math.abs(Math.sin(walkPhase)) * amp * speedNorm;
    targetBodyPitch += Math.cos(walkPhase) * (state === 'run' ? 0.11 : 0.038) * speedNorm;
    targetBodyRoll += Math.sin(walkPhase * 0.5) * (state === 'run' ? 0.04 : 0.025) * speedNorm;
  } else {
    // Lifelike Idle: gentle breathing chest expansion & weight shift
    const breath = Math.sin(elapsed * 2.1);
    const sway = Math.sin(elapsed * 1.12);
    targetBodyY += breath * 0.016;
    targetBodyRoll += sway * 0.025;
    targetBodyPitch += breath * 0.015;
    chestBreathScale = 1.0 + breath * 0.032;
  }

  const bodySpd = state === 'strike' ? 22 : 11;
  rig.bodyPivot.position.y = THREE.MathUtils.damp(rig.bodyPivot.position.y, targetBodyY, bodySpd, dt);
  rig.bodyPivot.rotation.x = THREE.MathUtils.damp(rig.bodyPivot.rotation.x, targetBodyPitch, bodySpd, dt);
  rig.bodyPivot.rotation.y = THREE.MathUtils.damp(rig.bodyPivot.rotation.y, targetBodyYaw, bodySpd, dt);
  rig.bodyPivot.rotation.z = THREE.MathUtils.damp(rig.bodyPivot.rotation.z, targetBodyRoll, bodySpd, dt);
  rig.chestBone.scale.set(chestBreathScale, chestBreathScale, 1 + (chestBreathScale - 1) * 0.6);

  // 2. Biomechanical 4-Phase Gait (Lift & Knee Bend -> Forward Extension -> Ground Strike -> Body Pull)
  const cyclesPerTau = walkPhase / (Math.PI * 2);
  for (const leg of rig.legs) {
    let hipX = 0;
    let hipZ = 0;
    let kneeX = 0;
    let pawX = 0;

    if (state === 'dying') {
      const p = THREE.MathUtils.clamp(stateProgress, 0, 1);
      const slump = THREE.MathUtils.smoothstep(Math.max(0, (p - 0.22) / 0.68), 0, 1);
      hipX = THREE.MathUtils.lerp(leg.pairIndex === 0 ? -0.42 : 0.25, leg.pairIndex === 0 ? 0.65 : -0.58, slump);
      hipZ = leg.side * 0.35 * slump;
      kneeX = THREE.MathUtils.lerp(0.35, 0.95, slump);
      pawX = 0.4 * slump;
    } else if (state === 'fly') {
      hipX = leg.pairIndex === 0 ? -0.35 : 0.45;
      kneeX = 0.55;
      pawX = 0.2;
    } else if (state === 'windup') {
      if (clueStyle === 'footMarch' && !(airBlend > 0.25)) {
        if (windupP < 0.78) {
          const marchRaw = Math.sin((windupP / 0.78) * Math.PI * 6 + (leg.side * Math.PI * 0.5) + leg.pairIndex * Math.PI * 0.5);
          const lift = Math.max(0, marchRaw);
          hipX = -0.78 * lift + 0.16 * Math.max(0, -marchRaw);
          kneeX = (leg.pairIndex === rig.legPairs - 1 ? -0.62 : 0.92) * lift;
          pawX = 0.34 * lift;
        } else if (moveAttack === 'groundPound' || moveAttack === 'sonicRoar') {
          hipX = leg.pairIndex === 0 ? -0.92 * pullBackEnv : 0.38 * pullBackEnv;
          kneeX = leg.pairIndex === 0 ? 0.72 * pullBackEnv : 0.32 * pullBackEnv;
          pawX = 0.26 * pullBackEnv;
        } else if (moveAttack === 'chargeGore') {
          hipX = leg.pairIndex === 0 ? 0.34 * pullBackEnv : -0.45 * pullBackEnv;
          kneeX = 0.52 * pullBackEnv;
        }
      } else if (clueStyle === 'crouchPounce' && !(airBlend > 0.25)) {
        const crouchAmt = THREE.MathUtils.clamp(windupP * 1.4, 0, 1);
        const shift = windupP < 0.75 ? Math.sin((windupP / 0.75) * Math.PI * 6) * leg.side : 0;
        hipX = (leg.pairIndex === 0 ? 0.35 : -0.45) * crouchAmt;
        hipZ = leg.side * 0.14 * crouchAmt + shift * 0.09;
        kneeX = (leg.pairIndex === rig.legPairs - 1 ? -0.58 : 0.68) * crouchAmt;
      } else if (moveAttack === 'groundPound') {
        if (leg.pairIndex === 0) {
          hipX = -0.88 * pullBackEnv;
          kneeX = 0.68 * pullBackEnv;
          pawX = 0.28 * pullBackEnv;
        } else {
          hipX = 0.35 * pullBackEnv;
          kneeX = 0.3 * pullBackEnv;
        }
      } else if (moveAttack === 'clawSlash' && leg.pairIndex === 0 && leg.side === 1) {
        const beatShake = windupP < 0.76 ? Math.abs(Math.sin((windupP / 0.76) * Math.PI * 3)) * 0.45 : 0;
        hipX = -0.45 * beatShake - 1.1 * pullBackEnv;
        kneeX = 0.55 * beatShake + 0.76 * pullBackEnv;
        pawX = 0.24 * pullBackEnv;
      }
    } else if (state === 'strike' && moveAttack === 'clawSlash' && leg.pairIndex === 0 && leg.side === 1) {
      const p = Math.min(1, stateProgress * 1.5);
      hipX = THREE.MathUtils.lerp(-1.05, 0.78, p);
      kneeX = THREE.MathUtils.lerp(0.72, -0.12, p);
      pawX = -0.25 * (1 - p);
    } else if (state === 'walk' || state === 'run') {
      const isRun = state === 'run';
      let pairOffset = 0;
      if (isRun) {
        // Bounding / canter gallop phase
        pairOffset =
          leg.pairIndex === 0
            ? leg.side > 0 ? 0.13 : 0.0
            : leg.pairIndex === rig.legPairs - 1
              ? leg.side > 0 ? 0.64 : 0.52
              : leg.side > 0 ? 0.4 : 0.28;
      } else {
        // Natural 4-beat diagonal-sequence walk
        if (rig.legPairs === 2) {
          pairOffset = leg.pairIndex === 0
            ? leg.side < 0 ? 0.0 : 0.5
            : leg.side < 0 ? 0.75 : 0.25;
        } else {
          pairOffset = (leg.pairIndex * 0.34 + (leg.side > 0 ? 0.5 : 0.0)) % 1;
        }
      }

      const rawU = (cyclesPerTau + pairOffset) % 1;
      const u = rawU < 0 ? rawU + 1 : rawU;
      const swingEnd = isRun ? 0.48 : 0.42;
      const hipAmp = (isRun ? 0.62 : 0.42) * THREE.MathUtils.clamp(speedNorm, 0.25, 1.0);
      const kneeLiftAmp = (isRun ? 1.15 : 0.88) * THREE.MathUtils.clamp(speedNorm, 0.25, 1.0);
      const isRear = leg.pairIndex === rig.legPairs - 1 && !rig.isSpider;

      if (rig.isSpider) {
        const lift = u < swingEnd ? Math.sin((u / swingEnd) * Math.PI) : 0;
        const swingProg = u < swingEnd ? u / swingEnd : 1 - (u - swingEnd) / (1 - swingEnd);
        hipZ = leg.side * lift * 0.26 * speedNorm;
        hipX = THREE.MathUtils.lerp(0.32, -0.32, swingProg) * speedNorm;
        kneeX = -lift * 0.58 * speedNorm;
      } else if (u < swingEnd) {
        // Phase 1 & 2: Forward Swing — leg bends cleanly at the knee to lift paw, then extends forward before strike!
        const s = u / swingEnd;
        const smoothSwing = s * s * (3 - 2 * s);
        hipX = THREE.MathUtils.lerp(hipAmp, -hipAmp, smoothSwing);

        if (s < 0.62) {
          // Bend knee deeply at mid-swing (shin folds up/back)
          const b = Math.sin((s / 0.62) * Math.PI * 0.82);
          kneeX = (isRear ? -0.78 : 1.0) * kneeLiftAmp * b;
        } else {
          // Extend knee smoothly forward right before ground contact
          const e = (s - 0.62) / 0.38;
          const midKnee = (isRear ? -0.78 : 1.0) * kneeLiftAmp * Math.sin(0.82 * Math.PI);
          const strikeExt = isRear ? 0.14 : -0.22 * hipAmp;
          kneeX = THREE.MathUtils.lerp(midKnee, strikeExt, e * e * (3 - 2 * e));
        }
        pawX = Math.sin(s * Math.PI) * 0.36 * speedNorm;
      } else {
        // Phase 3 & 4: Ground Strike & Pull — foot plants and pulls body forward, cushioning mid-stance weight!
        const t = (u - swingEnd) / (1 - swingEnd);
        hipX = THREE.MathUtils.lerp(-hipAmp, hipAmp, t);
        const cushion = Math.sin(t * Math.PI) * 0.22 * speedNorm;
        const pushOff = Math.pow(t, 2.2) * 0.26 * speedNorm;
        kneeX = (isRear ? -0.15 : 1) * (cushion + pushOff);
        // Keep paw flat on ground across stance pull
        pawX = -(hipX + kneeX) * 0.65;
      }
    }

    const legDamp = state === 'strike' ? 24 : 16;
    leg.hipPivot.rotation.x = THREE.MathUtils.damp(leg.hipPivot.rotation.x, hipX, legDamp, dt);
    leg.hipPivot.rotation.z = THREE.MathUtils.damp(leg.hipPivot.rotation.z, hipZ, legDamp, dt);
    leg.kneePivot.rotation.x = THREE.MathUtils.damp(leg.kneePivot.rotation.x, kneeX, legDamp, dt);
    leg.pawGroup.rotation.x = THREE.MathUtils.damp(leg.pawGroup.rotation.x, pawX, legDamp, dt);
  }

  // 3. Multi-Headed Necks, Skulls, Expressive Moods (Mouth & Eyebrows), Eyelids & Ears
  const blinkCycle = elapsed % 3.8;
  const isBlinking = blinkCycle > 3.64;
  const blinkAmt = isBlinking ? Math.sin(((blinkCycle - 3.64) / 0.16) * Math.PI) : 0;

  // Determine effective facial mood (combat windup/strike/celebrate dynamically express on top of base mood)
  let effMouthMood: CreatureExpressionMood = mouthMoodOverride ?? rig.mouthMood ?? rig.blueprint.mouth.mood;
  let effBrowMood: CreatureExpressionMood = eyebrowMoodOverride ?? rig.eyebrowMood ?? rig.blueprint.eyebrows.mood;
  if (!mouthMoodOverride) {
    if (state === 'strike') {
      effMouthMood = 'open';
      effBrowMood = 'angry';
    } else if (state === 'windup' || state === 'stagger') {
      effMouthMood = state === 'stagger' ? 'open' : 'angry';
      effBrowMood = 'angry';
    } else if (state === 'celebrate') {
      effMouthMood = 'happy';
      effBrowMood = 'happy';
    }
  }
  const mOff = getMoodOffsets(effMouthMood);
  const bOff = getMoodOffsets(effBrowMood);

  for (const h of rig.heads) {
    const phaseOff = h.headIndex * 1.45;
    let neckPitch = 0;
    let neckYaw = 0;
    let headPitch = 0;
    let headYaw = 0;
    let headRoll = 0;
    let jawOpen = 0.04 + mOff.jawAdd;

    if (state === 'dying') {
      const p = THREE.MathUtils.clamp(stateProgress, 0, 1);
      if (p < 0.28) {
        const rear = Math.sin((p / 0.28) * Math.PI * 0.5);
        neckPitch = -0.45 * rear;
        headPitch = -0.28 * rear;
        jawOpen = 0.75 * rear;
      } else {
        const slump = THREE.MathUtils.smoothstep((p - 0.28) / 0.62, 0, 1);
        neckPitch = THREE.MathUtils.lerp(-0.4, 0.62, slump);
        neckYaw = 0.25 * slump * (h.headIndex === 0 ? -1 : 1);
        headPitch = THREE.MathUtils.lerp(-0.24, 0.34, slump);
        headRoll = 0.42 * slump;
        jawOpen = THREE.MathUtils.lerp(0.68, 0.08, slump);
      }
    } else if (state === 'windup') {
      if (clueStyle === 'headSway3') {
        // 3 clear head sways left-right-left, then a sharp pull-back coil right before strike!
        const headSideBias = rig.heads.length > 1 ? (h.headIndex % 2 === 0 ? 1 : -1) : 1;
        if (windupP < 0.76) {
          const u = windupP / 0.76;
          const sway = Math.sin(u * Math.PI * 6) * headSideBias;
          const beatSnap = Math.abs(Math.sin(u * Math.PI * 3));
          neckYaw = sway * 0.58;
          headYaw = sway * 0.42;
          headRoll = -sway * 0.26;
          neckPitch = -0.14 - beatSnap * 0.14;
          headPitch = -0.08 * beatSnap;
          jawOpen = 0.18 + beatSnap * 0.26;
        } else {
          neckYaw = 0;
          headYaw = 0;
          headRoll = 0;
          neckPitch = -0.84 * pullBackEnv;
          headPitch = -0.46 * pullBackEnv;
          jawOpen = 0.24 + 0.52 * pullBackEnv;
        }
      } else if (clueStyle === 'footMarch') {
        const bob = windupP < 0.78 ? Math.sin((windupP / 0.78) * Math.PI * 12) * 0.08 : 0;
        neckPitch = (moveAttack === 'chargeGore' ? 0.36 : -0.34) * pullBackEnv + bob;
        headPitch = (moveAttack === 'chargeGore' ? 0.28 : -0.22) * pullBackEnv;
        jawOpen = 0.2 + 0.38 * windupP;
      } else if (clueStyle === 'wingFlare') {
        const beat = windupP < 0.76 ? Math.abs(Math.sin((windupP / 0.76) * Math.PI * 3)) : 0;
        neckPitch = -0.24 * beat - 0.54 * pullBackEnv;
        headPitch = -0.16 * beat - 0.3 * pullBackEnv;
        jawOpen = 0.32 * beat + 0.55 * pullBackEnv;
      } else {
        // crouchPounce
        const weave = windupP < 0.75 ? Math.sin((windupP / 0.75) * Math.PI * 6) * 0.22 : 0;
        neckYaw = weave;
        neckPitch = 0.22 * windupP - 0.35 * pullBackEnv;
        headPitch = -0.28 * windupP;
        jawOpen = 0.28 * windupP;
      }
    } else if (state === 'strike') {
      const p = Math.sin(THREE.MathUtils.clamp(stateProgress, 0, 1) * Math.PI);
      if (isBreathOrBeam) {
        neckPitch = 0.28 * p;
        neckYaw = Math.sin(stateProgress * Math.PI * 2.5 + phaseOff) * 0.22;
        headPitch = -0.14 * p;
        jawOpen = 0.68 * Math.min(1, p * 1.4);
      } else if (moveAttack === 'sonicRoar') {
        neckPitch = -0.45 * p;
        headPitch = -0.35 * p;
        jawOpen = 0.78 * p;
      } else if (moveAttack === 'chargeGore') {
        neckPitch = 0.25 * (1 - p);
        headPitch = -0.25 * p;
        jawOpen = 0.25 * p;
      } else {
        neckPitch = 0.24 * p;
        jawOpen = 0.62 * p;
      }
    } else if (state === 'celebrate') {
      neckPitch = Math.sin(elapsed * 6.5 + phaseOff) * 0.24;
      headRoll = Math.sin(elapsed * 3.8 + phaseOff) * 0.18;
      jawOpen = 0.24;
    } else if (state === 'walk' || state === 'run' || state === 'fly') {
      neckPitch = Math.sin(walkPhase + phaseOff) * 0.08 * (0.4 + speedNorm * 0.6);
      headYaw = Math.sin(elapsed * 1.8 + phaseOff) * 0.08;
      jawOpen = Math.max(0.01, mOff.jawAdd + Math.max(0, Math.sin(elapsed * 3.6 + phaseOff)) * 0.06);
    } else {
      // Realistic Alive Idle: curious head looks, head-tilt & gentle breath
      neckYaw = Math.sin(elapsed * 0.85 + phaseOff) * 0.16 + Math.sin(elapsed * 0.37 + phaseOff * 2) * 0.1;
      neckPitch = Math.sin(elapsed * 1.25 + phaseOff) * 0.08 + Math.pow(Math.max(0, Math.sin(elapsed * 2.3 + phaseOff)), 6) * 0.06;
      headYaw = Math.sin(elapsed * 1.15 + phaseOff + 0.6) * 0.14;
      headRoll = Math.sin(elapsed * 0.72 + phaseOff) * 0.11;
      headPitch = -neckPitch * 0.45 + Math.sin(elapsed * 2.1 + phaseOff) * 0.04;
      jawOpen = Math.max(0.0, 0.02 + mOff.jawAdd + Math.max(0, Math.sin(elapsed * 2.1 - 0.5 + phaseOff)) * 0.04);
    }

    const headDamp = state === 'strike' ? 22 : 9;
    const perNeckPitch = neckPitch / Math.max(1, h.neckBones.length);
    const perNeckYaw = neckYaw / Math.max(1, h.neckBones.length);
    for (const nb of h.neckBones) {
      nb.rotation.x = THREE.MathUtils.damp(nb.rotation.x, perNeckPitch, headDamp, dt);
      nb.rotation.y = THREE.MathUtils.damp(nb.rotation.y, perNeckYaw, headDamp, dt);
    }
    h.headPivot.rotation.x = THREE.MathUtils.damp(h.headPivot.rotation.x, headPitch, headDamp, dt);
    h.headPivot.rotation.y = THREE.MathUtils.damp(h.headPivot.rotation.y, headYaw, headDamp, dt);
    h.headPivot.rotation.z = THREE.MathUtils.damp(h.headPivot.rotation.z, headRoll, headDamp, dt);
    h.jawPivot.rotation.x = THREE.MathUtils.damp(h.jawPivot.rotation.x, jawOpen, state === 'strike' ? 24 : 12, dt);

    // Lip, Void & Tongue Mood Switching
    if (h.mouthMoodGroups) {
      const activeM: CreatureExpressionMood =
        effMouthMood === 'closed' && jawOpen > 0.2 ? 'open' : effMouthMood;
      for (const [mKey, mGrp] of Object.entries(h.mouthMoodGroups)) {
        mGrp.visible = mKey === activeM;
      }
    }
    if (h.tongueStickMesh) {
      h.tongueStickMesh.visible = rig.blueprint.mouth.tongueVisible && (rig.blueprint.mouth.tongueStickOut ?? 0) > 0.02;
      h.tongueStickMesh.rotation.x = Math.sin(elapsed * 5.2 + phaseOff) * 0.06;
    }

    // Cheek Blush Mood
    for (const blush of h.blushMeshes) {
      blush.visible = mOff.showBlush || effBrowMood === 'shy';
      const bMat = blush.material as THREE.MeshBasicMaterial;
      const targetOp = effMouthMood === 'shy' || effBrowMood === 'shy' ? 0.72 : mOff.blushOpacity;
      bMat.opacity = THREE.MathUtils.damp(bMat.opacity, targetOp, 10, dt);
    }

    // Blinking & Mood-Shaped Eyelids (eyes slowly close during death collapse)
    for (const lid of h.eyelids) {
      if (state === 'dying') {
        const deathClose = THREE.MathUtils.smoothstep(Math.max(0, (stateProgress - 0.25) / 0.55), 0, 1);
        const closedFrac = THREE.MathUtils.lerp(lid.restClosedFrac, 0.96, deathClose);
        lid.node.rotation.x = THREE.MathUtils.lerp(lid.minOpenRad, lid.maxCloseRad, closedFrac);
      } else {
        const baseLid = THREE.MathUtils.clamp(lid.restClosedFrac + bOff.lidAdd, 0, 0.72);
        const closedFrac = THREE.MathUtils.clamp(baseLid + blinkAmt * (1 - baseLid), 0, 1);
        lid.node.rotation.x = THREE.MathUtils.lerp(lid.minOpenRad, lid.maxCloseRad, closedFrac);
      }
    }

    // Expressive Mood Eyebrows
    for (const brow of h.eyebrows) {
      const targetRotZ = brow.baseRotZ + brow.side * bOff.browTiltAdd;
      const targetPosY = brow.basePosY + bOff.browLiftY;
      brow.pivot.rotation.z = THREE.MathUtils.damp(brow.pivot.rotation.z, targetRotZ, 12, dt);
      brow.pivot.position.y = THREE.MathUtils.damp(brow.pivot.position.y, targetPosY, 12, dt);
    }

    // Subtle ear twitches (plus relaxed/lowered droop when shy)
    const earShyDroop = effBrowMood === 'shy' || effMouthMood === 'shy' ? 0.28 : 0;
    for (const ear of h.ears) {
      const twitch = Math.pow(Math.max(0, Math.sin(elapsed * 1.9 + ear.side * 1.3 + phaseOff)), 14) * 0.18;
      ear.pivot.rotation.x = ear.baseRotX + twitch - earShyDroop * 0.4;
      ear.pivot.rotation.z = THREE.MathUtils.damp(
        ear.pivot.rotation.z,
        ear.baseRotZ - ear.side * (twitch * 0.7 + earShyDroop),
        10,
        dt
      );
    }
  }

  // 4. Multi-Segment Tail S-Wave / Whip
  for (let i = 0; i < rig.tailSegments.length; i++) {
    const seg = rig.tailSegments[i];
    const phase = i * 0.75;
    let yaw = Math.sin(elapsed * (state === 'run' ? 6.2 : 2.6) - phase) * (state === 'run' ? 0.24 : 0.15);
    let pitch = Math.sin(elapsed * 1.8 - phase) * 0.08;
    if (state === 'dying') {
      const slump = THREE.MathUtils.smoothstep(Math.max(0, (stateProgress - 0.25) / 0.65), 0, 1);
      yaw *= 1 - slump;
      pitch = THREE.MathUtils.lerp(pitch, -0.22, slump);
    } else if (state === 'windup' && moveAttack === 'tailSmash') {
      yaw = -0.35 * stateProgress;
    } else if (state === 'strike' && moveAttack === 'tailSmash') {
      yaw = THREE.MathUtils.lerp(-0.35, 0.45, Math.min(1, stateProgress * 1.4));
    }
    seg.rotation.y = THREE.MathUtils.damp(seg.rotation.y, yaw, 10, dt);
    seg.rotation.x = THREE.MathUtils.damp(seg.rotation.x, pitch, 10, dt);
  }

  // 5. Organic Two-Joint Wing Flap (supports continuous flying attacks via airBlend!)
  if (rig.wingL && rig.wingR) {
    let flap = Math.sin(elapsed * 2.2) * 0.08;
    let outerFold = 0;
    const hoverFlap = Math.sin(elapsed * 8.2) * 0.62;
    const hoverOuter = Math.sin(elapsed * 8.2 - 0.65) * 0.38;
    if (state === 'dying') {
      const p = THREE.MathUtils.clamp(stateProgress, 0, 1);
      if (p < 0.28) {
        flap = 0.58 * (p / 0.28);
      } else {
        const slump = THREE.MathUtils.smoothstep((p - 0.28) / 0.65, 0, 1);
        flap = THREE.MathUtils.lerp(0.55, -0.52, slump);
        outerFold = 0.45 * slump;
      }
    } else if (state === 'fly') {
      flap = hoverFlap;
      outerFold = hoverOuter;
    } else if (airBlend > 0.04) {
      let attackAccent = 0;
      if (state === 'windup') {
        if (clueStyle === 'wingFlare' || clueStyle === 'headSway3') {
          const pulse = windupP < 0.76 ? Math.abs(Math.sin((windupP / 0.76) * Math.PI * 3)) : 0;
          attackAccent = 0.34 * pulse + 0.58 * pullBackEnv;
        } else {
          attackAccent = 0.42 * windupP;
        }
      } else if (state === 'strike') {
        attackAccent = -0.28 * Math.sin(stateProgress * Math.PI);
      }
      flap = hoverFlap * airBlend * (state === 'windup' ? 0.5 : 1) + attackAccent;
      outerFold = hoverOuter * airBlend;
    } else if (state === 'run') {
      flap = Math.sin(walkPhase) * 0.25;
      outerFold = 0.2;
    } else if (state === 'windup') {
      if (clueStyle === 'wingFlare') {
        const pulse = windupP < 0.76 ? Math.abs(Math.sin((windupP / 0.76) * Math.PI * 3)) : 0;
        flap = 0.68 * pulse + 0.85 * pullBackEnv;
        outerFold = -0.28 * pulse;
      } else {
        flap = 0.38 * windupP + 0.45 * pullBackEnv;
      }
    } else if (state === 'strike') {
      flap = -0.35 * Math.sin(stateProgress * Math.PI);
    }
    for (const w of [rig.wingL, rig.wingR]) {
      w.innerPivot.rotation.z = THREE.MathUtils.damp(w.innerPivot.rotation.z, w.side * (w.baseLiftRad + flap), 12, dt);
      w.outerPivot.rotation.z = THREE.MathUtils.damp(w.outerPivot.rotation.z, -w.side * (w.baseLiftRad * 0.35 + outerFold), 12, dt);
    }
  }
}
