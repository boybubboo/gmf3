import type {
  BaddieAIConfig,
  BaddieDetectionMode,
  BaddieFlightPattern,
  BaddieHeroEffectKind,
  BaddiePatrolPattern,
  BaddieWindupClueStyle,
  LevelEntity,
  MonsterAttackType,
  MonsterBlueprint,
} from '../types/maker';

export type BaddieActionFlightMode = 'groundOnly' | 'airOrGround' | 'airOnly';

export type BaddieArchetypeHint =
  | 'dragon'
  | 'ogre'
  | 'bat'
  | 'troll'
  | 'goblin'
  | 'wolf'
  | 'bear'
  | 'swordsman'
  | 'wizard'
  | 'general';

export interface BaddieActionDef {
  id: MonsterAttackType;
  label: string;
  category: 'melee' | 'smash' | 'charge' | 'breath' | 'spell' | 'roar';
  flightMode: BaddieActionFlightMode;
  heroEffect: BaddieHeroEffectKind;
  directDamage: number;
  residualDamage: number;
  effectDurationSec: number;
  slowFactor: number; // 1 = normal speed, <1 slows hero
  defensePenalty: number; // additive penalty to effective armor
  defaultRange: number;
  windupDuration: number;
  strikeDuration: number;
  recoverDuration: number;
  telegraphColor: string;
  coneHalfAngleCos: number; // for directional breath/beam/slash checks
  aoeRadius: number; // used for groundPound / sonicRoar / shock
  knockbackForce: number;
  blurb: string;
  suitedArchetypes: BaddieArchetypeHint[];
}

export const BADDIE_ACTION_LIBRARY: BaddieActionDef[] = [
  {
    id: 'fireBreath',
    label: 'Twin Fire Breath',
    category: 'breath',
    flightMode: 'airOrGround',
    heroEffect: 'burn',
    directDamage: 1,
    residualDamage: 1,
    effectDurationSec: 4.5,
    slowFactor: 0.94,
    defensePenalty: 1,
    defaultRange: 10.5,
    windupDuration: 0.96,
    strikeDuration: 0.72,
    recoverDuration: 0.65,
    telegraphColor: '#F97316',
    coneHalfAngleCos: 0.56,
    aoeRadius: 3.4,
    knockbackForce: 5.5,
    blurb: 'Locks direction and scorches a cone ahead with roaring flame that ignites the hero.',
    suitedArchetypes: ['dragon', 'wizard', 'general'],
  },
  {
    id: 'groundPound',
    label: 'Seismic Ground Pound',
    category: 'smash',
    flightMode: 'groundOnly',
    heroEffect: 'knockdown',
    directDamage: 2,
    residualDamage: 0,
    effectDurationSec: 1.5,
    slowFactor: 1,
    defensePenalty: 0,
    defaultRange: 5.2,
    windupDuration: 1.02,
    strikeDuration: 0.45,
    recoverDuration: 0.75,
    telegraphColor: '#FBBF24',
    coneHalfAngleCos: -1,
    aoeRadius: 4.9,
    knockbackForce: 9.5,
    blurb: 'Flyers must land first; slams the earth to send the hero tumbling onto their rump.',
    suitedArchetypes: ['dragon', 'ogre', 'troll', 'bear'],
  },
  {
    id: 'clawSlash',
    label: 'Rending Claw Slash',
    category: 'melee',
    flightMode: 'airOrGround',
    heroEffect: 'none',
    directDamage: 2,
    residualDamage: 0,
    effectDurationSec: 0,
    slowFactor: 1,
    defensePenalty: 0,
    defaultRange: 3.8,
    windupDuration: 0.72,
    strikeDuration: 0.34,
    recoverDuration: 0.5,
    telegraphColor: '#EF4444',
    coneHalfAngleCos: 0.42,
    aoeRadius: 2.8,
    knockbackForce: 7.2,
    blurb: 'Fast sweeping claw or blade cleave that rewards sidestepping before the lunge.',
    suitedArchetypes: ['dragon', 'wolf', 'bear', 'goblin', 'swordsman', 'bat'],
  },
  {
    id: 'tailSmash',
    label: 'Sweeping Tail Smash',
    category: 'smash',
    flightMode: 'groundOnly',
    heroEffect: 'knockdown',
    directDamage: 2,
    residualDamage: 0,
    effectDurationSec: 1.4,
    slowFactor: 1,
    defensePenalty: 0,
    defaultRange: 4.5,
    windupDuration: 0.88,
    strikeDuration: 0.42,
    recoverDuration: 0.62,
    telegraphColor: '#F59E0B',
    coneHalfAngleCos: 0.2,
    aoeRadius: 4.0,
    knockbackForce: 9.0,
    blurb: 'Heavy sweeping slam that bowls the hero backwards onto their seat.',
    suitedArchetypes: ['dragon', 'ogre', 'troll'],
  },
  {
    id: 'chargeGore',
    label: 'Bull Charge Lunge',
    category: 'charge',
    flightMode: 'airOrGround',
    heroEffect: 'knockdown',
    directDamage: 2,
    residualDamage: 0,
    effectDurationSec: 1.45,
    slowFactor: 1,
    defensePenalty: 0,
    defaultRange: 7.2,
    windupDuration: 0.88,
    strikeDuration: 0.58,
    recoverDuration: 0.72,
    telegraphColor: '#DC2626',
    coneHalfAngleCos: 0.55,
    aoeRadius: 2.7,
    knockbackForce: 10.2,
    blurb: 'Commits along a locked charge lane; sidestepping leaves the attacker skidding past.',
    suitedArchetypes: ['wolf', 'bear', 'ogre', 'troll', 'swordsman', 'dragon'],
  },
  {
    id: 'sonicRoar',
    label: 'Concussive Roar',
    category: 'roar',
    flightMode: 'airOrGround',
    heroEffect: 'stun',
    directDamage: 1,
    residualDamage: 0,
    effectDurationSec: 2.2,
    slowFactor: 0.72,
    defensePenalty: 1,
    defaultRange: 6.2,
    windupDuration: 0.9,
    strikeDuration: 0.52,
    recoverDuration: 0.6,
    telegraphColor: '#C084FC',
    coneHalfAngleCos: -1,
    aoeRadius: 5.5,
    knockbackForce: 7.8,
    blurb: 'Bellowing shockwave that rattles footing and briefly lowers guard.',
    suitedArchetypes: ['dragon', 'bear', 'bat', 'ogre', 'troll'],
  },
  {
    id: 'iceBreath',
    label: 'Frostbite Breath',
    category: 'breath',
    flightMode: 'airOrGround',
    heroEffect: 'freeze',
    directDamage: 1,
    residualDamage: 1,
    effectDurationSec: 4.5,
    slowFactor: 0.58,
    defensePenalty: 1,
    defaultRange: 10.0,
    windupDuration: 0.96,
    strikeDuration: 0.68,
    recoverDuration: 0.62,
    telegraphColor: '#38BDF8',
    coneHalfAngleCos: 0.56,
    aoeRadius: 3.3,
    knockbackForce: 4.8,
    blurb: 'Chills the target lane with rime ice, slowing movement and brittle-cracking defense.',
    suitedArchetypes: ['dragon', 'wizard', 'bat'],
  },
  {
    id: 'waterJet',
    label: 'Torrent Hydro Jet',
    category: 'breath',
    flightMode: 'airOrGround',
    heroEffect: 'soak',
    directDamage: 2,
    residualDamage: 0,
    effectDurationSec: 4.0,
    slowFactor: 0.78,
    defensePenalty: 0,
    defaultRange: 10.5,
    windupDuration: 0.9,
    strikeDuration: 0.64,
    recoverDuration: 0.58,
    telegraphColor: '#0EA5E9',
    coneHalfAngleCos: 0.62,
    aoeRadius: 2.9,
    knockbackForce: 8.6,
    blurb: 'Pressurized stream that blasts along the locked heading and drenches footing.',
    suitedArchetypes: ['wizard', 'dragon'],
  },
  {
    id: 'electricShock',
    label: 'Arc Lightning Burst',
    category: 'spell',
    flightMode: 'airOrGround',
    heroEffect: 'shock',
    directDamage: 1,
    residualDamage: 1,
    effectDurationSec: 4.0,
    slowFactor: 0.85,
    defensePenalty: 1,
    defaultRange: 6.4,
    windupDuration: 0.88,
    strikeDuration: 0.52,
    recoverDuration: 0.62,
    telegraphColor: '#FACC15',
    coneHalfAngleCos: -1,
    aoeRadius: 4.8,
    knockbackForce: 6.4,
    blurb: 'Releases sizzling arcs that leave soot & pulsing current coursing over the hero.',
    suitedArchetypes: ['wizard', 'dragon', 'bat'],
  },
  {
    id: 'poisonSpit',
    label: 'Venom Globule',
    category: 'breath',
    flightMode: 'airOrGround',
    heroEffect: 'poison',
    directDamage: 1,
    residualDamage: 1,
    effectDurationSec: 5.0,
    slowFactor: 0.9,
    defensePenalty: 1,
    defaultRange: 9.2,
    windupDuration: 0.82,
    strikeDuration: 0.5,
    recoverDuration: 0.58,
    telegraphColor: '#4ADE80',
    coneHalfAngleCos: 0.6,
    aoeRadius: 2.8,
    knockbackForce: 4.0,
    blurb: 'Hurls corrosive venom along a locked arc, eating through defense over time.',
    suitedArchetypes: ['bat', 'goblin', 'wizard', 'troll'],
  },
  {
    id: 'shadowBeam',
    label: 'Umbral Void Beam',
    category: 'spell',
    flightMode: 'airOrGround',
    heroEffect: 'shock',
    directDamage: 2,
    residualDamage: 1,
    effectDurationSec: 3.5,
    slowFactor: 0.82,
    defensePenalty: 1,
    defaultRange: 11.2,
    windupDuration: 0.98,
    strikeDuration: 0.62,
    recoverDuration: 0.68,
    telegraphColor: '#A855F7',
    coneHalfAngleCos: 0.68,
    aoeRadius: 2.6,
    knockbackForce: 7.0,
    blurb: 'Dark lance locked at windup start; dodge laterally before detonation.',
    suitedArchetypes: ['wizard', 'dragon', 'bat'],
  },
  {
    id: 'solarBeam',
    label: 'Sunflare Lance',
    category: 'spell',
    flightMode: 'airOrGround',
    heroEffect: 'burn',
    directDamage: 2,
    residualDamage: 1,
    effectDurationSec: 4.0,
    slowFactor: 0.92,
    defensePenalty: 1,
    defaultRange: 11.8,
    windupDuration: 1.04,
    strikeDuration: 0.66,
    recoverDuration: 0.7,
    telegraphColor: '#FDE047',
    coneHalfAngleCos: 0.68,
    aoeRadius: 2.8,
    knockbackForce: 7.5,
    blurb: 'Radiant beam that scorches a locked line and leaves smoldering embers.',
    suitedArchetypes: ['wizard', 'dragon'],
  },
];

export const BADDIE_ACTION_BY_ID: Record<MonsterAttackType, BaddieActionDef> = BADDIE_ACTION_LIBRARY.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<MonsterAttackType, BaddieActionDef>
);

export const DETECTION_MODE_OPTIONS: { id: BaddieDetectionMode; label: string }[] = [
  { id: 'both', label: 'Spatial + Sight' },
  { id: 'spatial', label: 'Spatial Radius' },
  { id: 'sight', label: 'Line of Sight Cone' },
];

export const PATROL_PATTERN_OPTIONS: { id: BaddiePatrolPattern; label: string }[] = [
  { id: 'wander', label: 'Roam Territory' },
  { id: 'pace', label: 'Pace Back & Forth' },
  { id: 'orbit', label: 'Orbit Territory' },
  { id: 'circuit', label: 'Triangle Circuit' },
  { id: 'guard', label: 'Hold & Watch Post' },
];

export const FLIGHT_PATTERN_OPTIONS: { id: BaddieFlightPattern; label: string }[] = [
  { id: 'circle', label: 'Sky Circle' },
  { id: 'figure8', label: 'Figure-8 Soar' },
  { id: 'swoop', label: 'Swoop Waves' },
  { id: 'hover', label: 'Steady Hover' },
];

export const WINDUP_CLUE_OPTIONS: { id: BaddieWindupClueStyle; label: string }[] = [
  { id: 'auto', label: 'Auto by Attack & Body' },
  { id: 'headSway3', label: '3× Head Sway & Pull Back' },
  { id: 'footMarch', label: 'Rapid Foot March Stomp' },
  { id: 'wingFlare', label: '3× Wing / Claw Flare' },
  { id: 'crouchPounce', label: 'Low Coil & Pounce Lock' },
];

export function resolveEffectiveWindupClueStyle(
  style: BaddieWindupClueStyle | undefined,
  attack: MonsterAttackType,
  opts?: { headCount?: number; canFly?: boolean; legPairs?: number }
): Exclude<BaddieWindupClueStyle, 'auto'> {
  if (style && style !== 'auto') return style;
  if (
    attack === 'fireBreath' ||
    attack === 'iceBreath' ||
    attack === 'waterJet' ||
    attack === 'shadowBeam' ||
    attack === 'solarBeam' ||
    attack === 'poisonSpit' ||
    attack === 'electricShock' ||
    (opts?.headCount ?? 1) > 1
  ) {
    return 'headSway3';
  }
  if (attack === 'groundPound' || attack === 'tailSmash') {
    return 'footMarch';
  }
  if (attack === 'chargeGore') {
    return (opts?.legPairs ?? 2) >= 2 ? 'footMarch' : 'crouchPounce';
  }
  if (attack === 'sonicRoar' || opts?.canFly) {
    return 'wingFlare';
  }
  return 'footMarch';
}

export function resolveBaddieActionId(raw: string | undefined): MonsterAttackType | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  for (const act of BADDIE_ACTION_LIBRARY) {
    if (act.id.toLowerCase() === trimmed || act.label.toLowerCase() === trimmed) {
      return act.id;
    }
  }
  if (trimmed.includes('fire') || trimmed.includes('flame')) return 'fireBreath';
  if (trimmed.includes('ground') || trimmed.includes('pound') || trimmed.includes('slam')) return 'groundPound';
  if (trimmed.includes('claw') || trimmed.includes('slash') || trimmed.includes('swipe')) return 'clawSlash';
  if (trimmed.includes('tail')) return 'tailSmash';
  if (trimmed.includes('charge') || trimmed.includes('gore') || trimmed.includes('lunge')) return 'chargeGore';
  if (trimmed.includes('roar') || trimmed.includes('sonic')) return 'sonicRoar';
  if (trimmed.includes('ice') || trimmed.includes('frost') || trimmed.includes('freeze')) return 'iceBreath';
  if (trimmed.includes('water') || trimmed.includes('hydro')) return 'waterJet';
  if (trimmed.includes('shock') || trimmed.includes('electric') || trimmed.includes('lightning')) return 'electricShock';
  if (trimmed.includes('poison') || trimmed.includes('venom')) return 'poisonSpit';
  if (trimmed.includes('shadow') || trimmed.includes('dark')) return 'shadowBeam';
  if (trimmed.includes('solar') || trimmed.includes('sun')) return 'solarBeam';
  return null;
}

export function inferArchetypeDefaultActions(entity: Pick<LevelEntity, 'name' | 'brain' | 'creatureType' | 'monsterConfig'>): {
  primaryAction: MonsterAttackType;
  secondaryAction: MonsterAttackType;
  canFly: boolean;
} {
  const bp = entity.monsterConfig;
  if (bp) {
    return {
      primaryAction: bp.primaryAttack ?? 'clawSlash',
      secondaryAction: bp.secondaryAttack ?? (bp.canFly ? 'fireBreath' : 'groundPound'),
      canFly: Boolean(bp.canFly),
    };
  }
  const n = `${entity.name} ${entity.brain} ${entity.creatureType ?? ''}`.toLowerCase();
  if (n.includes('dragon') || n.includes('drake') || n.includes('wyvern')) {
    return { primaryAction: 'fireBreath', secondaryAction: 'groundPound', canFly: true };
  }
  if (n.includes('bat') || entity.brain === 'Flyer') {
    return { primaryAction: 'sonicRoar', secondaryAction: 'clawSlash', canFly: true };
  }
  if (n.includes('wizard') || n.includes('mage') || entity.brain === 'Shooter') {
    return { primaryAction: 'electricShock', secondaryAction: 'shadowBeam', canFly: false };
  }
  if (n.includes('ogre') || n.includes('troll')) {
    return { primaryAction: 'groundPound', secondaryAction: 'tailSmash', canFly: false };
  }
  if (n.includes('bear')) {
    return { primaryAction: 'clawSlash', secondaryAction: 'groundPound', canFly: false };
  }
  if (n.includes('wolf') || n.includes('hound') || entity.brain === 'Charger') {
    return { primaryAction: 'chargeGore', secondaryAction: 'clawSlash', canFly: false };
  }
  if (n.includes('spider') || n.includes('venom')) {
    return { primaryAction: 'poisonSpit', secondaryAction: 'clawSlash', canFly: false };
  }
  return {
    primaryAction: 'clawSlash',
    secondaryAction: n.includes('boss') ? 'groundPound' : 'chargeGore',
    canFly: false,
  };
}

export function resolveBaddieAIConfig(
  entity: Pick<LevelEntity, 'name' | 'brain' | 'isBoss' | 'creatureType' | 'monsterConfig' | 'baddieAI'>
): BaddieAIConfig {
  const inferred = inferArchetypeDefaultActions(entity);
  const bpAI = entity.monsterConfig?.baddieAI;
  const entAI = entity.baddieAI;
  const merged = { ...bpAI, ...entAI };

  const primaryAction =
    merged.primaryAction ?? entity.monsterConfig?.primaryAttack ?? inferred.primaryAction;
  const secondaryAction =
    merged.secondaryAction ?? entity.monsterConfig?.secondaryAttack ?? inferred.secondaryAction;

  const isFlyer = Boolean(entity.monsterConfig?.canFly || entity.brain === 'Flyer' || inferred.canFly);

  return {
    detectionMode: merged.detectionMode ?? (entity.brain === 'Patroller' ? 'sight' : 'both'),
    aggroRange: merged.aggroRange ?? (entity.isBoss ? 28 : 20),
    sightAngleDeg: merged.sightAngleDeg ?? (entity.isBoss ? 145 : 115),
    territoryRadius: merged.territoryRadius ?? (entity.isBoss ? 22 : 13),
    patrolPattern: merged.patrolPattern ?? (isFlyer ? 'orbit' : entity.isBoss ? 'wander' : 'pace'),
    flightPattern: merged.flightPattern ?? 'figure8',
    flightAltitude: merged.flightAltitude ?? (isFlyer ? 3.8 : 0),
    hoverAttackHeight: merged.hoverAttackHeight ?? (isFlyer ? 2.5 : 0),
    landAfterAirAttack: merged.landAfterAirAttack ?? isFlyer,
    windupClueStyle: merged.windupClueStyle ?? 'auto',
    varietyFactor: merged.varietyFactor ?? 0.65,
    primaryAction,
    secondaryAction,
    actionPool:
      merged.actionPool && merged.actionPool.length > 0
        ? merged.actionPool
        : Array.from(new Set<MonsterAttackType>([primaryAction, secondaryAction])),
    bossRewardCoins: merged.bossRewardCoins ?? (entity.isBoss ? 25 : 0),
    bossRewardItems:
      merged.bossRewardItems && merged.bossRewardItems.length > 0
        ? merged.bossRewardItems
        : entity.isBoss
          ? ['golden_crown', 'bone_amulet', 'healing_tonic']
          : undefined,
  };
}

export function pickNextBaddieAction(
  ai: BaddieAIConfig,
  lastAction: MonsterAttackType | undefined,
  distToHero: number,
  isAirborne: boolean,
  canFly: boolean
): MonsterAttackType {
  const pool = Array.from(
    new Set<MonsterAttackType>([ai.primaryAction, ai.secondaryAction, ...(ai.actionPool ?? [])])
  );
  if (pool.length === 0) return 'clawSlash';
  if (pool.length === 1) return pool[0];

  const v = Math.max(0, Math.min(1, ai.varietyFactor));
  // Pure deterministic primary if variety === 0
  if (v <= 0.02) return ai.primaryAction;

  // Weighted choice factoring in range suitability, anti-repeat variety, and flight readiness
  const weights = pool.map((id) => {
    const def = BADDIE_ACTION_BY_ID[id];
    let w = id === ai.primaryAction ? 1.45 - v * 0.45 : 0.75 + v * 0.85;
    if (lastAction && id === lastAction) {
      w *= 1 - v * 0.72; // strongly encourage alternating between primary & secondary
    }
    if (def.flightMode === 'groundOnly') {
      // Flyers can still pick groundOnly attacks (they will smoothly land first), slightly rarer at long range
      if (canFly && distToHero > def.defaultRange * 1.45) w *= 0.65;
      else if (!isAirborne && distToHero <= def.defaultRange * 1.2) w *= 1.35;
    } else if (def.category === 'breath' || def.category === 'spell') {
      if (distToHero > 4.2) w *= 1.25;
    }
    return Math.max(0.12, w);
  });

  const total = weights.reduce((s, x) => s + x, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[0];
}

export function createShowcaseTwinFlameDrakeBlueprint(): MonsterBlueprint {
  return {
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
    scale: 1.3,
    bodyColor: '#B91C1C',
    bellyColor: '#FBBF24',
    accentColor: '#450A0A',
    eyeColor: '#FEF08A',
    wingColor: '#EA580C',
    isBoss: true,
    speed: 4,
    health: 18,
    dialogue: 'Twice the jaws, twice the fire!',
    primaryAttack: 'fireBreath',
    secondaryAttack: 'groundPound',
    specialAbility: 'flameBody',
    attackPower: 2,
    attackRange: 10.5,
    attackCooldown: 1.45,
    surfaceCoat: {
      mode: 'scalesDragon',
      intensity: 0.58,
      density: 1.05,
      scaleSize: 1.0,
      clumpiness: 0.2,
      tipColor: '#F59E0B',
    },
    baddieAI: {
      detectionMode: 'both',
      aggroRange: 28,
      sightAngleDeg: 145,
      territoryRadius: 24,
      patrolPattern: 'orbit',
      flightPattern: 'figure8',
      flightAltitude: 4.1,
      hoverAttackHeight: 2.6,
      landAfterAirAttack: true,
      windupClueStyle: 'headSway3',
      varietyFactor: 0.72,
      primaryAction: 'fireBreath',
      secondaryAction: 'groundPound',
      actionPool: ['fireBreath', 'groundPound', 'clawSlash'],
      bossRewardCoins: 30,
      bossRewardItems: ['golden_crown', 'bone_amulet', 'healing_tonic'],
    },
  };
}
