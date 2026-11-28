import type {
  BaddieHeroEffectKind,
  EnvironmentType,
  GameLevel,
  GameProject,
  HeroAffinityRating,
  HeroEnemyMatchups,
  HeroEnvironmentAffinities,
  HeroProfileConfig,
  HeroSkillId,
  HeroStatsConfig,
  HeroTerrainAffinities,
} from '../types/maker';
import type { BaddieActionDef } from './baddieActionLibrary';
import type { TerrainWeatherSample } from '../utils/terrain';

export interface HeroSkillMeta {
  id: HeroSkillId;
  title: string;
  kind: 'skill' | 'flaw';
  effectSummary: string;
  detail: string;
}

export const HERO_SKILL_CATALOG: HeroSkillMeta[] = [
  {
    id: 'powerStrike',
    title: 'Power Strike',
    kind: 'skill',
    effectSummary: '+1 Melee DMG · Stronger Stagger',
    detail: 'Adds +1 base melee impact and hits heavier against braced enemies.',
  },
  {
    id: 'swiftFootwork',
    title: 'Swift Footwork',
    kind: 'skill',
    effectSummary: '+14% Sprint · -25% Sprint Cost',
    detail: 'Boosts sprint speed and trims sprinting stamina consumption.',
  },
  {
    id: 'mountainClimber',
    title: 'Mountain Climber',
    kind: 'skill',
    effectSummary: '+35% Climb · -45% Climb Cost',
    detail: 'Scales rock cliffs and tree trunks swiftly with minimal fatigue.',
  },
  {
    id: 'aquaLung',
    title: 'Aqua Lung',
    kind: 'skill',
    effectSummary: '+25% Swim · -45% Swim Cost',
    detail: 'Glides through deep rivers and resists soaking water drag.',
  },
  {
    id: 'ironResolve',
    title: 'Iron Resolve',
    kind: 'skill',
    effectSummary: '-35% Knockdown Duration',
    detail: 'Recovers quickly onto feet after ground pounds and tail slams.',
  },
  {
    id: 'elementalWard',
    title: 'Elemental Ward',
    kind: 'skill',
    effectSummary: '-35% Burn/Freeze/Shock/Poison',
    detail: 'Dampens lingering elemental burns, frost chill, venom, and static.',
  },
  {
    id: 'giantSlayer',
    title: 'Giant Slayer',
    kind: 'skill',
    effectSummary: '+35% Damage vs Bosses',
    detail: 'Strikes weak points on Boss foes like the Twin-Flame Drake.',
  },
  {
    id: 'acrobat',
    title: 'Acrobat',
    kind: 'skill',
    effectSummary: '+16% Jump · +18% Glide Speed',
    detail: 'Springy leap height and agile midair parachute maneuvering.',
  },
  {
    id: 'frostBitten',
    title: 'Frostbitten',
    kind: 'flaw',
    effectSummary: 'Flaw: -18% Snow Speed · Longer Freeze',
    detail: 'Struggles in freezing cold, snow biomes, and against ice attacks.',
  },
  {
    id: 'heatExhausted',
    title: 'Heat Exhausted',
    kind: 'flaw',
    effectSummary: 'Flaw: -30% Heat Regen · Longer Burn',
    detail: 'Tires quickly in scorching sun, desert sand, and fire hazards.',
  },
  {
    id: 'heavyArmorClumsy',
    title: 'Heavy & Clumsy',
    kind: 'flaw',
    effectSummary: 'Tradeoff: +1 Def · -20% Swim/Mud/Climb',
    detail: 'Extra sturdy plating that slows swimming, climbing, and muddy ground.',
  },
  {
    id: 'glassCannon',
    title: 'Glass Cannon',
    kind: 'flaw',
    effectSummary: 'Tradeoff: +2 Attack · -1 Def · Short Invuln',
    detail: 'Hits devastatingly hard at the cost of fragile guard.',
  },
];

export const DEFAULT_HERO_STATS: HeroStatsConfig = {
  maxHealth: 6,
  baseAttack: 1,
  baseDefense: 0,
  moveSpeedMult: 1,
  jumpPowerMult: 1,
  staminaMax: 100,
  staminaRegenMult: 1,
  magicPower: 2,
  dodgeInvulnMult: 1,
};

export const DEFAULT_HERO_TERRAIN: HeroTerrainAffinities = {
  grassland: 0,
  sandAndCoast: 0,
  rockAndAlpine: 0,
  mudAndSwamp: 0,
  snowAndIce: 0,
  waterAndSwim: 0,
};

export const DEFAULT_HERO_PROFILE: HeroProfileConfig = {
  archetype: 'Balanced Explorer',
  bio: 'Adaptable trailblazer equipped for woodland trails and boss encounters.',
  stats: { ...DEFAULT_HERO_STATS },
  skills: [],
  terrain: { ...DEFAULT_HERO_TERRAIN },
  temperature: {
    preferredTemp: 'temperate',
    coldResistance: 0,
    heatResistance: 0,
  },
  enemies: {
    bosses: 0,
    flying: 0,
    beasts: 0,
    elemental: 0,
    heavyBrutes: 0,
  },
  environments: {
    openWilds: 0,
    underground: 0,
    stormAndRain: 0,
    nightAndShadow: 0,
    highAltitude: 0,
  },
};

export interface HeroArchetypePreset {
  id: string;
  name: string;
  blurb: string;
  profile: HeroProfileConfig;
}

export const HERO_ARCHETYPE_PRESETS: HeroArchetypePreset[] = [
  {
    id: 'balanced',
    name: 'Balanced Explorer',
    blurb: 'All-around adventurer with steady stamina and zero glaring weaknesses.',
    profile: {
      ...DEFAULT_HERO_PROFILE,
      archetype: 'Balanced Explorer',
      skills: ['swiftFootwork'],
      terrain: { ...DEFAULT_HERO_TERRAIN, grassland: 1 },
      environments: { ...DEFAULT_HERO_PROFILE.environments, openWilds: 1 },
    },
  },
  {
    id: 'alpine',
    name: 'Alpine Mountaineer',
    blurb: 'Masters cliffs, snow, and high peaks; sluggish in deep swamps and warm heat.',
    profile: {
      archetype: 'Alpine Mountaineer',
      bio: 'Thrives on craggy heights and frost, but struggles in humid heat and mud.',
      stats: {
        ...DEFAULT_HERO_STATS,
        maxHealth: 7,
        baseAttack: 1,
        baseDefense: 1,
        moveSpeedMult: 1.0,
        jumpPowerMult: 1.12,
        staminaMax: 120,
        staminaRegenMult: 1.1,
      },
      skills: ['mountainClimber', 'acrobat', 'heatExhausted'],
      terrain: {
        grassland: 0,
        sandAndCoast: -1,
        rockAndAlpine: 2,
        mudAndSwamp: -1,
        snowAndIce: 2,
        waterAndSwim: -1,
      },
      temperature: {
        preferredTemp: 'cold',
        coldResistance: 2,
        heatResistance: -2,
      },
      enemies: {
        bosses: 0,
        flying: 1,
        beasts: 1,
        elemental: -1,
        heavyBrutes: 0,
      },
      environments: {
        openWilds: 0,
        underground: 1,
        stormAndRain: 0,
        nightAndShadow: 0,
        highAltitude: 2,
      },
    },
  },
  {
    id: 'pyre',
    name: 'Pyre Warden',
    blurb: 'Shrugs off intense heat, fire breath, and Boss slams; vulnerable to snow & water.',
    profile: {
      archetype: 'Pyre Warden',
      bio: 'Forged for dragon battles and scorching arenas, yet chilled by frost and deep water.',
      stats: {
        ...DEFAULT_HERO_STATS,
        maxHealth: 8,
        baseAttack: 2,
        baseDefense: 1,
        moveSpeedMult: 0.96,
        staminaMax: 105,
        magicPower: 3,
      },
      skills: ['ironResolve', 'giantSlayer', 'frostBitten'],
      terrain: {
        grassland: 0,
        sandAndCoast: 2,
        rockAndAlpine: 1,
        mudAndSwamp: -1,
        snowAndIce: -2,
        waterAndSwim: -2,
      },
      temperature: {
        preferredTemp: 'warm',
        coldResistance: -2,
        heatResistance: 2,
      },
      enemies: {
        bosses: 2,
        flying: 0,
        beasts: 0,
        elemental: 1,
        heavyBrutes: 1,
      },
      environments: {
        openWilds: 0,
        underground: 1,
        stormAndRain: -2,
        nightAndShadow: 0,
        highAltitude: 0,
      },
    },
  },
  {
    id: 'tideway',
    name: 'Tideway Swimmer',
    blurb: 'Speeds through rivers, beaches, and rainstorms; weaker vs heavy armored brutes.',
    profile: {
      archetype: 'Tideway Swimmer',
      bio: 'Agile coastal scout who rules water and storms but avoids heavy brawls.',
      stats: {
        ...DEFAULT_HERO_STATS,
        maxHealth: 6,
        baseAttack: 1,
        baseDefense: 0,
        moveSpeedMult: 1.12,
        jumpPowerMult: 1.08,
        staminaMax: 125,
        staminaRegenMult: 1.25,
        dodgeInvulnMult: 1.2,
      },
      skills: ['aquaLung', 'swiftFootwork', 'elementalWard'],
      terrain: {
        grassland: 1,
        sandAndCoast: 2,
        rockAndAlpine: -1,
        mudAndSwamp: 1,
        snowAndIce: -1,
        waterAndSwim: 2,
      },
      temperature: {
        preferredTemp: 'temperate',
        coldResistance: 0,
        heatResistance: 1,
      },
      enemies: {
        bosses: 0,
        flying: 1,
        beasts: 1,
        elemental: 1,
        heavyBrutes: -2,
      },
      environments: {
        openWilds: 1,
        underground: -1,
        stormAndRain: 2,
        nightAndShadow: 0,
        highAltitude: -1,
      },
    },
  },
  {
    id: 'shadow',
    name: 'Shadow Delver',
    blurb: 'Excels underground, at night, and in magic; struggles under open sun & storms.',
    profile: {
      archetype: 'Shadow Delver',
      bio: 'Cave-dwelling tactician who thrives in darkness and hunts airborne monsters.',
      stats: {
        ...DEFAULT_HERO_STATS,
        maxHealth: 6,
        baseAttack: 2,
        baseDefense: 0,
        moveSpeedMult: 1.08,
        magicPower: 4,
        dodgeInvulnMult: 1.25,
      },
      skills: ['elementalWard', 'powerStrike'],
      terrain: {
        grassland: 0,
        sandAndCoast: -1,
        rockAndAlpine: 1,
        mudAndSwamp: 1,
        snowAndIce: 0,
        waterAndSwim: 0,
      },
      temperature: {
        preferredTemp: 'cold',
        coldResistance: 1,
        heatResistance: -1,
      },
      enemies: {
        bosses: 1,
        flying: 2,
        beasts: 0,
        elemental: 1,
        heavyBrutes: -1,
      },
      environments: {
        openWilds: -1,
        underground: 2,
        stormAndRain: -1,
        nightAndShadow: 2,
        highAltitude: 0,
      },
    },
  },
  {
    id: 'berserker',
    name: 'Glass Berserker',
    blurb: 'Huge melee bursts and Boss slayer damage, balanced by low defense & heat fatigue.',
    profile: {
      archetype: 'Glass Berserker',
      bio: 'Reckless vanguard trading armor for relentless speed and devastating blows.',
      stats: {
        ...DEFAULT_HERO_STATS,
        maxHealth: 5,
        baseAttack: 3,
        baseDefense: 0,
        moveSpeedMult: 1.18,
        jumpPowerMult: 1.1,
        staminaMax: 115,
        dodgeInvulnMult: 0.85,
      },
      skills: ['glassCannon', 'powerStrike', 'giantSlayer', 'heatExhausted'],
      terrain: {
        grassland: 1,
        sandAndCoast: 0,
        rockAndAlpine: 0,
        mudAndSwamp: -2,
        snowAndIce: -1,
        waterAndSwim: -1,
      },
      temperature: {
        preferredTemp: 'temperate',
        coldResistance: 0,
        heatResistance: -1,
      },
      enemies: {
        bosses: 2,
        flying: -1,
        beasts: 2,
        elemental: -2,
        heavyBrutes: 2,
      },
      environments: {
        openWilds: 1,
        underground: 0,
        stormAndRain: -1,
        nightAndShadow: 0,
        highAltitude: 0,
      },
    },
  },
];

export const AFFINITY_LABELS: Record<
  HeroAffinityRating,
  { short: string; label: string; color: string }
> = {
  '-2': { short: '-2', label: 'Severe Flaw', color: '#EF4444' },
  '-1': { short: '-1', label: 'Weak', color: '#F97316' },
  '0': { short: '0', label: 'Neutral', color: '#94A3B8' },
  '1': { short: '+1', label: 'Strong', color: '#22C55E' },
  '2': { short: '+2', label: 'Mastery', color: '#10B981' },
};

export function resolveHeroProfile(project?: GameProject | null): HeroProfileConfig {
  const raw = project?.heroProfile;
  if (!raw) {
    return {
      ...DEFAULT_HERO_PROFILE,
      stats: { ...DEFAULT_HERO_STATS },
      skills: [...DEFAULT_HERO_PROFILE.skills],
      terrain: { ...DEFAULT_HERO_TERRAIN },
      temperature: { ...DEFAULT_HERO_PROFILE.temperature },
      enemies: { ...DEFAULT_HERO_PROFILE.enemies },
      environments: { ...DEFAULT_HERO_PROFILE.environments },
    };
  }
  return {
    archetype: raw.archetype ?? DEFAULT_HERO_PROFILE.archetype,
    bio: raw.bio ?? DEFAULT_HERO_PROFILE.bio,
    stats: { ...DEFAULT_HERO_STATS, ...(raw.stats ?? {}) },
    skills: Array.isArray(raw.skills) ? raw.skills : [],
    terrain: { ...DEFAULT_HERO_TERRAIN, ...(raw.terrain ?? {}) },
    temperature: { ...DEFAULT_HERO_PROFILE.temperature, ...(raw.temperature ?? {}) },
    enemies: { ...DEFAULT_HERO_PROFILE.enemies, ...(raw.enemies ?? {}) },
    environments: { ...DEFAULT_HERO_PROFILE.environments, ...(raw.environments ?? {}) },
  };
}

export interface HeroEnvEvalResult {
  speedMult: number;
  climbSpeedMult: number;
  swimSpeedMult: number;
  jumpMult: number;
  staminaDrainMult: number;
  staminaRegenMult: number;
  ambientTemp: 'freezing' | 'cold' | 'temperate' | 'warm' | 'scorching';
  activeTerrainKey: keyof HeroTerrainAffinities;
  activeSummary: string;
  activeTone: 'strength' | 'flaw' | 'neutral';
}

const affinitySpeedFactor = (r: HeroAffinityRating): number =>
  r === -2 ? 0.78 : r === -1 ? 0.9 : r === 1 ? 1.1 : r === 2 ? 1.22 : 1;

const affinityStaminaDrainFactor = (r: HeroAffinityRating): number =>
  r === -2 ? 1.38 : r === -1 ? 1.18 : r === 1 ? 0.85 : r === 2 ? 0.7 : 1;

export function evaluateHeroEnvironmentModifiers(
  profile: HeroProfileConfig,
  level: GameLevel,
  envType: EnvironmentType,
  terrainLayer: number,
  weathering: TerrainWeatherSample,
  waterDepth: number,
  isSwimming: boolean,
  isClimbing: boolean,
  heroY: number,
  liveHour: number,
  isInsideCave: boolean,
  hasBurnStatus: boolean
): HeroEnvEvalResult {
  const skills = new Set(profile.skills);

  // 1. Identify current terrain category
  let activeTerrainKey: keyof HeroTerrainAffinities = 'grassland';
  let activeTerrainLabel = 'Grass & Trails';
  if (isSwimming || waterDepth > 0.35) {
    activeTerrainKey = 'waterAndSwim';
    activeTerrainLabel = 'Water';
  } else if (weathering.frost > 0.35 || terrainLayer === 3 || level.biome === 'snow') {
    activeTerrainKey = 'snowAndIce';
    activeTerrainLabel = 'Snow & Ice';
  } else if (weathering.mud > 0.35 || (terrainLayer === 4 && level.biome === 'swamp') || level.biome === 'swamp') {
    activeTerrainKey = 'mudAndSwamp';
    activeTerrainLabel = 'Mud & Swamp';
  } else if (terrainLayer === 1 || level.biome === 'desert') {
    activeTerrainKey = 'sandAndCoast';
    activeTerrainLabel = 'Sand & Coast';
  } else if (terrainLayer === 2 || isClimbing || heroY >= 6.5) {
    activeTerrainKey = 'rockAndAlpine';
    activeTerrainLabel = 'Rock & Alpine';
  }

  const terrainRating = profile.terrain[activeTerrainKey] ?? 0;

  // 2. Ambient temperature score (-2..+2)
  let tempScore = 0;
  if (level.biome === 'snow' || level.weather === 'snow') tempScore -= 1.2;
  if (terrainLayer === 3 || weathering.frost > 0.35) tempScore -= 0.7;
  if (heroY >= 8.5) tempScore -= 0.5;
  if ((level.atmosphereWarmth ?? 0) < -0.15) tempScore -= 0.5;
  if (liveHour < 5.5 || liveHour > 20.0 || level.biome === 'night') tempScore -= 0.4;

  if (level.biome === 'desert') tempScore += 1.3;
  if (weathering.scorch > 0.35) tempScore += 0.8;
  if ((level.atmosphereWarmth ?? 0) > 0.18) tempScore += 0.6;
  if (hasBurnStatus) tempScore += 0.9;

  const ambientTemp: HeroEnvEvalResult['ambientTemp'] =
    tempScore <= -1.3
      ? 'freezing'
      : tempScore <= -0.45
      ? 'cold'
      : tempScore >= 1.3
      ? 'scorching'
      : tempScore >= 0.45
      ? 'warm'
      : 'temperate';

  // 3. Active environments
  const envRatings: number[] = [];
  if (envType === 'openWorld' && !isInsideCave) envRatings.push(profile.environments.openWilds);
  if (envType === 'dungeon' || level.biome === 'cave' || isInsideCave) {
    envRatings.push(profile.environments.underground);
  }
  if (level.weather === 'rain' || level.weather === 'storm' || level.wind >= 0.75) {
    envRatings.push(profile.environments.stormAndRain);
  }
  if (level.biome === 'night' || liveHour < 5.5 || liveHour > 19.5) {
    envRatings.push(profile.environments.nightAndShadow);
  }
  if (heroY >= 7.5) {
    envRatings.push(profile.environments.highAltitude);
  }

  let envDelta = 0;
  if (envRatings.length > 0) {
    envDelta = envRatings.reduce((a, b) => a + b, 0) / envRatings.length;
  }

  // 4. Temperature penalties & bonuses
  let tempSpeedFactor = 1;
  let tempStaminaRegenFactor = 1;
  let tempNote = '';
  let tempTone: 'strength' | 'flaw' | 'neutral' = 'neutral';

  if (ambientTemp === 'freezing' || ambientTemp === 'cold') {
    const res = profile.temperature.coldResistance;
    const prefBonus = profile.temperature.preferredTemp === 'cold' ? 0.06 : 0;
    const frostFlaw = skills.has('frostBitten') ? -0.14 : 0;
    if (res < 0 || skills.has('frostBitten')) {
      const severity = ambientTemp === 'freezing' ? 1 : 0.6;
      tempSpeedFactor = Math.max(0.68, 1 + (res * 0.08 + frostFlaw) * severity);
      tempStaminaRegenFactor = Math.max(0.62, 1 + (res * 0.1 - (skills.has('frostBitten') ? 0.16 : 0)) * severity);
      tempNote = 'Cold Vulnerability';
      tempTone = 'flaw';
    } else if (res > 0 || prefBonus > 0) {
      tempSpeedFactor = 1 + res * 0.04 + prefBonus;
      tempStaminaRegenFactor = 1 + res * 0.08;
      tempNote = 'Cold Adapted';
      tempTone = 'strength';
    }
  } else if (ambientTemp === 'warm' || ambientTemp === 'scorching') {
    const res = profile.temperature.heatResistance;
    const prefBonus = profile.temperature.preferredTemp === 'warm' ? 0.06 : 0;
    const heatFlaw = skills.has('heatExhausted') ? -0.22 : 0;
    if (res < 0 || skills.has('heatExhausted')) {
      const severity = ambientTemp === 'scorching' ? 1 : 0.65;
      tempSpeedFactor = Math.max(0.74, 1 + res * 0.06 * severity);
      tempStaminaRegenFactor = Math.max(0.55, 1 + (res * 0.14 + heatFlaw) * severity);
      tempNote = 'Heat Exhaustion';
      tempTone = 'flaw';
    } else if (res > 0 || prefBonus > 0) {
      tempSpeedFactor = 1 + res * 0.04 + prefBonus;
      tempStaminaRegenFactor = 1 + res * 0.08;
      tempNote = 'Heat Adapted';
      tempTone = 'strength';
    }
  }

  // 5. Combine speed / climb / swim / jump / stamina
  let speedMult =
    profile.stats.moveSpeedMult *
    affinitySpeedFactor(terrainRating) *
    (1 + envDelta * 0.05) *
    tempSpeedFactor;
  let climbSpeedMult =
    profile.stats.moveSpeedMult *
    affinitySpeedFactor(profile.terrain.rockAndAlpine) *
    (skills.has('mountainClimber') ? 1.35 : 1);
  let swimSpeedMult =
    profile.stats.moveSpeedMult *
    affinitySpeedFactor(profile.terrain.waterAndSwim) *
    (skills.has('aquaLung') ? 1.25 : 1);
  let jumpMult = profile.stats.jumpPowerMult * (skills.has('acrobat') ? 1.16 : 1);

  if (skills.has('heavyArmorClumsy')) {
    if (activeTerrainKey === 'mudAndSwamp' || activeTerrainKey === 'waterAndSwim') {
      speedMult *= 0.8;
    }
    climbSpeedMult *= 0.8;
    swimSpeedMult *= 0.78;
    jumpMult *= 0.92;
  }

  let staminaDrainMult =
    affinityStaminaDrainFactor(terrainRating) *
    (skills.has('swiftFootwork') ? 0.75 : 1);
  if (isClimbing && skills.has('mountainClimber')) staminaDrainMult *= 0.55;
  if (isSwimming && skills.has('aquaLung')) staminaDrainMult *= 0.55;

  const staminaRegenMult =
    profile.stats.staminaRegenMult *
    (1 + envDelta * 0.07) *
    tempStaminaRegenFactor;

  // Build concise, informative HUD summary when a meaningful modifier is active
  let activeSummary = '';
  let activeTone: HeroEnvEvalResult['activeTone'] = 'neutral';
  if (terrainRating >= 1) {
    activeSummary = `${activeTerrainLabel} Mastery (+${Math.round((affinitySpeedFactor(terrainRating) - 1) * 100)}% Spd)`;
    activeTone = 'strength';
  } else if (terrainRating <= -1) {
    activeSummary = `${activeTerrainLabel} Flaw (${Math.round((affinitySpeedFactor(terrainRating) - 1) * 100)}% Spd)`;
    activeTone = 'flaw';
  } else if (tempNote) {
    activeSummary = tempNote;
    activeTone = tempTone;
  } else if (envDelta >= 0.9) {
    activeSummary = 'Favored Environment';
    activeTone = 'strength';
  } else if (envDelta <= -0.9) {
    activeSummary = 'Hostile Environment';
    activeTone = 'flaw';
  }

  return {
    speedMult: Math.max(0.55, Math.min(1.85, speedMult)),
    climbSpeedMult: Math.max(0.55, Math.min(2.0, climbSpeedMult)),
    swimSpeedMult: Math.max(0.55, Math.min(2.0, swimSpeedMult)),
    jumpMult: Math.max(0.65, Math.min(1.65, jumpMult)),
    staminaDrainMult: Math.max(0.35, Math.min(2.0, staminaDrainMult)),
    staminaRegenMult: Math.max(0.4, Math.min(2.4, staminaRegenMult)),
    ambientTemp,
    activeTerrainKey,
    activeSummary,
    activeTone,
  };
}

export interface EnemyTargetDescriptors {
  isBoss: boolean;
  isFlying: boolean;
  isBeast: boolean;
  isElemental: boolean;
  isHeavyBrute: boolean;
}

export function computeHeroOutgoingDamage(
  baseWeaponAndStatDamage: number,
  profile: HeroProfileConfig,
  target: EnemyTargetDescriptors
): { damage: number; matchupNote: string; matchupTone: 'strength' | 'flaw' | 'neutral' } {
  const skills = new Set(profile.skills);
  const ratings: number[] = [];
  let strongestLabel = '';

  if (target.isBoss) {
    ratings.push(profile.enemies.bosses);
    if (profile.enemies.bosses !== 0) strongestLabel = 'Boss';
  }
  if (target.isFlying) {
    ratings.push(profile.enemies.flying);
    if (!strongestLabel && profile.enemies.flying !== 0) strongestLabel = 'Aerial';
  }
  if (target.isBeast) {
    ratings.push(profile.enemies.beasts);
    if (!strongestLabel && profile.enemies.beasts !== 0) strongestLabel = 'Beast';
  }
  if (target.isElemental) {
    ratings.push(profile.enemies.elemental);
    if (!strongestLabel && profile.enemies.elemental !== 0) strongestLabel = 'Elemental';
  }
  if (target.isHeavyBrute) {
    ratings.push(profile.enemies.heavyBrutes);
    if (!strongestLabel && profile.enemies.heavyBrutes !== 0) strongestLabel = 'Brute';
  }

  const avgMatchup =
    ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

  let mult = 1 + avgMatchup * 0.22;
  if (target.isBoss && skills.has('giantSlayer')) {
    mult += 0.35;
    strongestLabel = 'Boss Slayer';
  }
  mult = Math.max(0.55, Math.min(2.2, mult));

  const finalDamage = Math.max(1, Math.round(baseWeaponAndStatDamage * mult));
  let matchupNote = '';
  let matchupTone: 'strength' | 'flaw' | 'neutral' = 'neutral';
  if (mult >= 1.2 && strongestLabel) {
    matchupNote = `${strongestLabel} Advantage!`;
    matchupTone = 'strength';
  } else if (mult <= 0.84 && strongestLabel) {
    matchupNote = `${strongestLabel} Resistance`;
    matchupTone = 'flaw';
  }

  return { damage: finalDamage, matchupNote, matchupTone };
}

export function computeHeroIncomingDamage(
  rawBaddieDamage: number,
  effectiveDefense: number,
  profile: HeroProfileConfig,
  actionDef: BaddieActionDef,
  target: EnemyTargetDescriptors
): {
  damage: number;
  effectDurationMult: number;
  note: string;
} {
  const skills = new Set(profile.skills);
  let resRating = 0;

  if (target.isBoss) resRating += profile.enemies.bosses * 0.45;
  if (target.isFlying) resRating += profile.enemies.flying * 0.35;
  if (target.isBeast) resRating += profile.enemies.beasts * 0.35;
  if (target.isElemental) resRating += profile.enemies.elemental * 0.45;
  if (target.isHeavyBrute) resRating += profile.enemies.heavyBrutes * 0.4;

  const eff: BaddieHeroEffectKind = actionDef.heroEffect;
  let statusDurMult = skills.has('elementalWard') ? 0.65 : 1.0;

  if (eff === 'burn') {
    resRating += profile.temperature.heatResistance * 0.6;
    if (skills.has('heatExhausted')) {
      resRating -= 0.75;
      statusDurMult *= 1.35;
    }
    statusDurMult *= 1 - profile.temperature.heatResistance * 0.2;
  } else if (eff === 'freeze') {
    resRating += profile.temperature.coldResistance * 0.6;
    if (skills.has('frostBitten')) {
      resRating -= 0.75;
      statusDurMult *= 1.35;
    }
    statusDurMult *= 1 - profile.temperature.coldResistance * 0.2;
  } else if (eff === 'shock' || eff === 'poison' || eff === 'soak') {
    resRating += profile.enemies.elemental * 0.45;
    statusDurMult *= 1 - profile.enemies.elemental * 0.16;
  } else if (eff === 'knockdown' || eff === 'stun') {
    resRating += profile.enemies.heavyBrutes * 0.45;
    if (skills.has('ironResolve')) statusDurMult *= 0.65;
  }

  // Clamp resistance modifier so boss strikes stay dangerous (~3 hits threat) while strengths & flaws clearly matter
  const bonusReduction = resRating >= 1.1 ? 1 : resRating <= -1.1 ? -1 : 0;
  const totalGuard = effectiveDefense + bonusReduction;
  const damage = Math.max(1, rawBaddieDamage - totalGuard);

  let note = '';
  if (bonusReduction > 0) note = 'Trait Resist!';
  else if (bonusReduction < 0) note = 'Weakness Hit!';

  return {
    damage,
    effectDurationMult: Math.max(0.4, Math.min(1.75, statusDurMult)),
    note,
  };
}
