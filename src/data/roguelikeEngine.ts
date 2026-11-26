import type {
  GameLevel,
  RoguelikeConfig,
  RoguelikeRelicDef,
} from '../types/maker';
import {
  DEFAULT_DUNGEON_STYLE,
  DungeonGenerator,
  applyDungeonStyleToLevel,
  createMulberry32,
} from '../services/DungeonGenerator';

export { DEFAULT_DUNGEON_STYLE, DungeonGenerator, applyDungeonStyleToLevel };

export const DEFAULT_ROGUELIKE_CONFIG: RoguelikeConfig = {
  bossInterval: 3,
  difficultyScale: 0.28,
  relicChoicesPerFloor: 3,
  trapDensity: 1.0,
  startingMaxHealth: 6,
  seedMode: 'random',
  fixedSeed: 104729,
  dungeonStyle: { ...DEFAULT_DUNGEON_STYLE },
};

export const ROGUELIKE_RELICS: RoguelikeRelicDef[] = [
  {
    id: 'iron_edge',
    name: 'Iron Edge',
    category: 'offense',
    rarity: 'common',
    symbol: 'flame.fill',
    colorHex: '#F2545B',
    shortEffect: '+1 Sword Damage',
    description: 'Hones your blade so every melee strike carves deeper into dungeon foes.',
    maxStacks: 4,
    modifiers: { attackBonus: 1 },
  },
  {
    id: 'obsidian_fang',
    name: 'Obsidian Fang',
    category: 'offense',
    rarity: 'rare',
    symbol: 'bolt.fill',
    colorHex: '#EF4444',
    shortEffect: '+2 Sword Damage',
    description: 'Volcanic edge infused with ember heat for heavy melee cleaves.',
    maxStacks: 2,
    modifiers: { attackBonus: 2 },
  },
  {
    id: 'vampiric_fang',
    name: 'Vampiric Fang',
    category: 'offense',
    rarity: 'rare',
    symbol: 'heart.fill',
    colorHex: '#E11D48',
    shortEffect: '+1 HP every 2 kills',
    description: 'Drains lingering dungeon vitality whenever an enemy falls.',
    maxStacks: 2,
    modifiers: { lifestealOnKill: 0.5 },
  },
  {
    id: 'berserker_ember',
    name: 'Berserker Ember',
    category: 'offense',
    rarity: 'mythic',
    symbol: 'flame.fill',
    colorHex: '#F97316',
    shortEffect: '+2 Damage · +15% Speed',
    description: 'Ignites relentless momentum across every chamber.',
    maxStacks: 1,
    modifiers: { attackBonus: 2, speedBonus: 0.15 },
  },
  {
    id: 'heart_vessel',
    name: 'Heart Vessel',
    category: 'defense',
    rarity: 'common',
    symbol: 'heart.fill',
    colorHex: '#20B46A',
    shortEffect: '+2 Max HP · Heal +2 HP',
    description: 'Expands your vitality pool and mends wounds immediately.',
    maxStacks: 4,
    modifiers: { maxHealthBonus: 2, healNow: 2 },
  },
  {
    id: 'ironclad_ward',
    name: 'Ironclad Ward',
    category: 'defense',
    rarity: 'rare',
    symbol: 'shield.fill',
    colorHex: '#38BDF8',
    shortEffect: '+1 Armor · +1 Max HP',
    description: 'Tempered ward plates deflect incoming blows more frequently.',
    maxStacks: 3,
    modifiers: { defenseBonus: 1, maxHealthBonus: 1 },
  },
  {
    id: 'briar_thorns',
    name: 'Briar Thorns',
    category: 'defense',
    rarity: 'rare',
    symbol: 'exclamationmark.triangle.fill',
    colorHex: '#A855F7',
    shortEffect: 'Reflect 1 Dmg on Hit',
    description: 'Spiked stone aura lashes back at attackers that strike you.',
    maxStacks: 3,
    modifiers: { thornsDamage: 1 },
  },
  {
    id: 'crypt_restorer',
    name: 'Crypt Restorer',
    category: 'defense',
    rarity: 'common',
    symbol: 'cross.case.fill',
    colorHex: '#4ADE80',
    shortEffect: '+2 HP on Floor Descent',
    description: 'Restores warmth and stamina each time you step through a floor portal.',
    maxStacks: 3,
    modifiers: { portalHeal: 2 },
  },
  {
    id: 'swift_greaves',
    name: 'Swift Greaves',
    category: 'mobility',
    rarity: 'common',
    symbol: 'figure.run',
    colorHex: '#38BDF8',
    shortEffect: '+20% Move Speed',
    description: 'Featherweight crypt boots for outmaneuvering lunging enemies.',
    maxStacks: 3,
    modifiers: { speedBonus: 0.2 },
  },
  {
    id: 'windstep_charm',
    name: 'Windstep Charm',
    category: 'mobility',
    rarity: 'rare',
    symbol: 'wind',
    colorHex: '#0EA5E9',
    shortEffect: '+40% Stamina Regen · +12% Speed',
    description: 'Keeps stamina flowing so you can sprint and strike without pause.',
    maxStacks: 2,
    modifiers: { staminaRegenMult: 0.4, speedBonus: 0.12 },
  },
  {
    id: 'arcane_conduit',
    name: 'Arcane Conduit',
    category: 'arcane',
    rarity: 'common',
    symbol: 'sparkles',
    colorHex: '#7C5CFF',
    shortEffect: '+2 Magic Bolt Damage',
    description: 'Amplifies ranged magic bolts fired with R into devastating blasts.',
    maxStacks: 3,
    modifiers: { magicBoltBonus: 2 },
  },
  {
    id: 'soul_magnet',
    name: 'Soul Magnet',
    category: 'arcane',
    rarity: 'common',
    symbol: 'diamond.fill',
    colorHex: '#FACC15',
    shortEffect: '+2 Coins per Foe Slain',
    description: 'Draws gleaming dungeon gold from every defeated creature.',
    maxStacks: 3,
    modifiers: { coinBonusOnKill: 2 },
  },
  {
    id: 'twin_spark',
    name: 'Twin Spark',
    category: 'arcane',
    rarity: 'rare',
    symbol: 'wand.and.stars',
    colorHex: '#A855F7',
    shortEffect: '+1 Sword · +1 Magic Dmg',
    description: 'Balances steel and sorcery for hybrid dungeon runs.',
    maxStacks: 2,
    modifiers: { attackBonus: 1, magicBoltBonus: 1 },
  },
  {
    id: 'phoenix_sigil',
    name: 'Phoenix Sigil',
    category: 'arcane',
    rarity: 'mythic',
    symbol: 'crown.fill',
    colorHex: '#F59E0B',
    shortEffect: '+3 Max HP · Full Heal · +1 Dmg',
    description: 'Ancient sun-forged crest that revitalizes your entire run.',
    maxStacks: 1,
    modifiers: { maxHealthBonus: 3, healNow: 99, attackBonus: 1 },
  },
];

export interface AggregatedRelicModifiers {
  attackBonus: number;
  maxHealthBonus: number;
  defenseBonus: number;
  speedBonus: number;
  lifestealOnKill: number;
  thornsDamage: number;
  coinBonusOnKill: number;
  staminaRegenMult: number;
  magicBoltBonus: number;
  portalHeal: number;
}

export function getRelicById(id: string): RoguelikeRelicDef | undefined {
  return ROGUELIKE_RELICS.find((r) => r.id === id);
}

export function aggregateRelicModifiers(relicIds: string[]): AggregatedRelicModifiers {
  const acc: AggregatedRelicModifiers = {
    attackBonus: 0,
    maxHealthBonus: 0,
    defenseBonus: 0,
    speedBonus: 0,
    lifestealOnKill: 0,
    thornsDamage: 0,
    coinBonusOnKill: 0,
    staminaRegenMult: 0,
    magicBoltBonus: 0,
    portalHeal: 0,
  };
  for (const id of relicIds) {
    const def = getRelicById(id);
    if (!def) continue;
    acc.attackBonus += def.modifiers.attackBonus ?? 0;
    acc.maxHealthBonus += def.modifiers.maxHealthBonus ?? 0;
    acc.defenseBonus += def.modifiers.defenseBonus ?? 0;
    acc.speedBonus += def.modifiers.speedBonus ?? 0;
    acc.lifestealOnKill += def.modifiers.lifestealOnKill ?? 0;
    acc.thornsDamage += def.modifiers.thornsDamage ?? 0;
    acc.coinBonusOnKill += def.modifiers.coinBonusOnKill ?? 0;
    acc.staminaRegenMult += def.modifiers.staminaRegenMult ?? 0;
    acc.magicBoltBonus += def.modifiers.magicBoltBonus ?? 0;
    acc.portalHeal += def.modifiers.portalHeal ?? 0;
  }
  return acc;
}

export function rollRelicDraftOptions(
  runSeed: number,
  floorNumber: number,
  ownedRelicIds: string[],
  count = 3
): RoguelikeRelicDef[] {
  const ownedCounts = new Map<string, number>();
  for (const id of ownedRelicIds) {
    ownedCounts.set(id, (ownedCounts.get(id) ?? 0) + 1);
  }
  const eligible = ROGUELIKE_RELICS.filter((r) => {
    const cur = ownedCounts.get(r.id) ?? 0;
    return cur < (r.maxStacks ?? 99);
  });
  const pool = eligible.length >= count ? [...eligible] : [...ROGUELIKE_RELICS];
  const rng = createMulberry32((runSeed ^ Math.imul(floorNumber + 17, 2654435761)) >>> 0);

  // Weighted Fisher-Yates so rare/mythic appear slightly less often on floor 1, more later
  const scored = pool.map((relic) => {
    const rarityWeight =
      relic.rarity === 'mythic'
        ? 0.45 + Math.min(0.45, floorNumber * 0.06)
        : relic.rarity === 'rare'
        ? 0.8
        : 1.15;
    return {
      relic,
      sortKey: Math.pow(Math.max(0.0001, rng()), 1 / rarityWeight),
    };
  });
  scored.sort((a, b) => b.sortKey - a.sortKey);
  return scored.slice(0, Math.max(1, Math.min(count, scored.length))).map((s) => s.relic);
}

export function generateRoguelikeFloor(
  baseLevel: GameLevel,
  runSeed: number,
  floorNumber: number,
  configOverride?: Partial<RoguelikeConfig>
): GameLevel {
  return DungeonGenerator.generateFloor(baseLevel, runSeed, floorNumber, configOverride);
}
