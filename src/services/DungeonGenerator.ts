import type {
  BoardPoint,
  DungeonFloorStyle,
  DungeonPropStyle,
  DungeonRoomRole,
  DungeonRoomSpec,
  DungeonStyleConfig,
  DungeonTrapStyle,
  DungeonWallStyle,
  GameLevel,
  LevelEntity,
  RoguelikeConfig,
  RoguelikeTorchAnchor,
  WallColliderBox,
} from '../types/maker';
import { uid } from '../utils/terrain';

export const DEFAULT_DUNGEON_STYLE: DungeonStyleConfig = {
  wallStyle: 'dampMasonry',
  floorStyle: 'flagstone',
  propStyle: 'cryptBarrels',
  trapStyle: 'ironSpikes',
};

export const DUNGEON_WALL_STYLE_META: Record<
  DungeonWallStyle,
  {
    label: string;
    primaryHex: string;
    trimHex: string;
    mossHex: string;
    showMoss: boolean;
    roughness: number;
    metalness: number;
    textureKind: 'brick' | 'castle' | 'cave';
  }
> = {
  dampMasonry: {
    label: 'Damp Masonry',
    primaryHex: '#CBD5E1',
    trimHex: '#464C59',
    mossHex: '#4E8F52',
    showMoss: true,
    roughness: 0.78,
    metalness: 0.05,
    textureKind: 'brick',
  },
  obsidianBasalt: {
    label: 'Obsidian Basalt',
    primaryHex: '#3B3F4C',
    trimHex: '#F97316',
    mossHex: '#EA580C',
    showMoss: false,
    roughness: 0.56,
    metalness: 0.18,
    textureKind: 'cave',
  },
  mossyRuins: {
    label: 'Mossy Ruins',
    primaryHex: '#94A396',
    trimHex: '#526356',
    mossHex: '#3E8E41',
    showMoss: true,
    roughness: 0.88,
    metalness: 0.02,
    textureKind: 'brick',
  },
  gildedCrypt: {
    label: 'Gilded Crypt',
    primaryHex: '#647087',
    trimHex: '#D4A024',
    mossHex: '#B48822',
    showMoss: false,
    roughness: 0.62,
    metalness: 0.24,
    textureKind: 'castle',
  },
  crimsonCatacombs: {
    label: 'Crimson Catacombs',
    primaryHex: '#7A424B',
    trimHex: '#9B6B43',
    mossHex: '#7F1D1D',
    showMoss: false,
    roughness: 0.76,
    metalness: 0.1,
    textureKind: 'brick',
  },
};

export const DUNGEON_FLOOR_STYLE_META: Record<
  DungeonFloorStyle,
  {
    label: string;
    colorHex: string;
    puddleHex: string;
    roughness: number;
    metalness: number;
    emissiveHex?: string;
    emissiveIntensity?: number;
    textureKind: 'flagstone' | 'castleFloor' | 'cobble' | 'rock';
  }
> = {
  flagstone: {
    label: 'Damp Flagstone',
    colorHex: '#FFFFFF',
    puddleHex: '#1E2A33',
    roughness: 0.58,
    metalness: 0.08,
    textureKind: 'flagstone',
  },
  checkerMarble: {
    label: 'Crypt Marble',
    colorHex: '#DCE2EB',
    puddleHex: '#253142',
    roughness: 0.42,
    metalness: 0.14,
    textureKind: 'castleFloor',
  },
  crackedSlate: {
    label: 'Cracked Slate',
    colorHex: '#6F798B',
    puddleHex: '#19222D',
    roughness: 0.68,
    metalness: 0.1,
    textureKind: 'rock',
  },
  emberBasalt: {
    label: 'Ember Basalt',
    colorHex: '#463C40',
    puddleHex: '#E85D2A',
    roughness: 0.64,
    metalness: 0.16,
    emissiveHex: '#7C2D12',
    emissiveIntensity: 0.16,
    textureKind: 'flagstone',
  },
  mossyCobble: {
    label: 'Mossy Cobble',
    colorHex: '#7B8F78',
    puddleHex: '#23382D',
    roughness: 0.76,
    metalness: 0.04,
    textureKind: 'cobble',
  },
};

export const DUNGEON_PROP_STYLE_META: Record<
  DungeonPropStyle,
  {
    label: string;
    names: [string, string];
  }
> = {
  cryptBarrels: {
    label: 'Barrels & Crates',
    names: ['Crypt Barrel', 'Iron Crate'],
  },
  arcaneBraziers: {
    label: 'Arcane Braziers',
    names: ['Rune Brazier', 'Arcane Pedestal'],
  },
  boneRelics: {
    label: 'Bone Relics',
    names: ['Ossuary Plinth', 'Crypt Reliquary'],
  },
  gildedUrns: {
    label: 'Gilded Urns',
    names: ['Gilded Urn', 'Royal Pedestal'],
  },
};

export const DUNGEON_TRAP_STYLE_META: Record<
  DungeonTrapStyle,
  {
    label: string;
    baseHex: string;
    hazardHex: string;
    emissiveHex?: string;
  }
> = {
  ironSpikes: {
    label: 'Iron Spikes',
    baseHex: '#454852',
    hazardHex: '#E4572E',
  },
  emberPlates: {
    label: 'Ember Plates',
    baseHex: '#352624',
    hazardHex: '#FF6B2B',
    emissiveHex: '#FF5412',
  },
  cursedRunes: {
    label: 'Cursed Runes',
    baseHex: '#221C30',
    hazardHex: '#C084FC',
    emissiveHex: '#9333EA',
  },
  sawBlades: {
    label: 'Saw Blades',
    baseHex: '#52463A',
    hazardHex: '#CBD5E1',
  },
};

export interface DungeonThemePreset {
  id: string;
  name: string;
  accentHex: string;
  style: DungeonStyleConfig;
}

export const DUNGEON_THEME_PRESETS: DungeonThemePreset[] = [
  {
    id: 'torchlitCrypt',
    name: 'Torchlit Crypt',
    accentHex: '#F97316',
    style: {
      wallStyle: 'dampMasonry',
      floorStyle: 'flagstone',
      propStyle: 'cryptBarrels',
      trapStyle: 'ironSpikes',
    },
  },
  {
    id: 'obsidianForge',
    name: 'Obsidian Forge',
    accentHex: '#EA580C',
    style: {
      wallStyle: 'obsidianBasalt',
      floorStyle: 'emberBasalt',
      propStyle: 'arcaneBraziers',
      trapStyle: 'emberPlates',
    },
  },
  {
    id: 'mossyRuins',
    name: 'Mossy Ruins',
    accentHex: '#20B46A',
    style: {
      wallStyle: 'mossyRuins',
      floorStyle: 'mossyCobble',
      propStyle: 'boneRelics',
      trapStyle: 'sawBlades',
    },
  },
  {
    id: 'gildedVault',
    name: 'Gilded Vault',
    accentHex: '#EAB308',
    style: {
      wallStyle: 'gildedCrypt',
      floorStyle: 'checkerMarble',
      propStyle: 'gildedUrns',
      trapStyle: 'cursedRunes',
    },
  },
];

export function resolveDungeonStyle(
  style?: Partial<DungeonStyleConfig> | null
): DungeonStyleConfig {
  return {
    wallStyle: style?.wallStyle ?? DEFAULT_DUNGEON_STYLE.wallStyle,
    floorStyle: style?.floorStyle ?? DEFAULT_DUNGEON_STYLE.floorStyle,
    propStyle: style?.propStyle ?? DEFAULT_DUNGEON_STYLE.propStyle,
    trapStyle: style?.trapStyle ?? DEFAULT_DUNGEON_STYLE.trapStyle,
    ...(style?.wallTint ? { wallTint: style.wallTint } : {}),
    ...(style?.floorTint ? { floorTint: style.floorTint } : {}),
    ...(style?.propTint ? { propTint: style.propTint } : {}),
    ...(style?.trapTint ? { trapTint: style.trapTint } : {}),
  };
}

export function applyDungeonStyleToLevel(
  level: GameLevel,
  nextStyle: DungeonStyleConfig
): GameLevel {
  const resolved = resolveDungeonStyle(nextStyle);
  const propNames = DUNGEON_PROP_STYLE_META[resolved.propStyle].names;
  let propIdx = 0;

  return {
    ...level,
    dungeonStyle: resolved,
    roguelikeConfig: level.roguelikeConfig
      ? { ...level.roguelikeConfig, dungeonStyle: resolved }
      : level.roguelikeConfig,
    entities: level.entities.map((ent) => {
      if (ent.kind === 'trap') {
        return {
          ...ent,
          trapStyle: resolved.trapStyle,
          styleTint: resolved.trapTint,
        };
      }
      if (ent.kind === 'prop' && !ent.propPreset && !ent.customAssetId) {
        const nextName = propNames[propIdx % propNames.length];
        propIdx++;
        return {
          ...ent,
          name: nextName,
          propStyle: resolved.propStyle,
          styleTint: resolved.propTint,
        };
      }
      return ent;
    }),
  };
}

export function createMulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GRID_SIZE = 19; // 19x19 cells across [-38, +38]
const CELL_SIZE = 4.0;
const GRID_MIN_WORLD = -38.0; // Cell 0 spans [-38, -34], cell 18 spans [34, 38]

// 0 = solid uncarved wall, 1 = room floor, 2 = corridor floor
type CellKind = 0 | 1 | 2;

export interface GeneratedDungeonLayout {
  grid: CellKind[][];
  rooms: DungeonRoomSpec[];
  entranceRoom: DungeonRoomSpec;
  exitRoom: DungeonRoomSpec;
  treasureRoom: DungeonRoomSpec | null;
  walls: WallColliderBox[];
  torches: RoguelikeTorchAnchor[];
  spawnWorld: [number, number];
  portalWorld: [number, number];
  bossWorld: [number, number];
  enemyZones: [number, number][];
  chestZones: [number, number][];
  trapZones: [number, number][];
  propZones: { x: number; z: number; yaw: number }[];
}

const BOSS_NAMES = [
  'Crypt Warden',
  'Bone Sovereign',
  'Ashen Executioner',
  'Abyssal Knight',
  'Vault Dreadlord',
];

const ENEMY_ARCHETYPES: {
  name: string;
  brain: string;
  baseHp: number;
  baseSpeed: number;
  damage: number;
  scale: number;
  minFloor: number;
}[] = [
  { name: 'Crypt Skeleton', brain: 'Chaser', baseHp: 3, baseSpeed: 3.0, damage: 1, scale: 1.0, minFloor: 1 },
  { name: 'Shadow Bat', brain: 'Flyer', baseHp: 2, baseSpeed: 3.8, damage: 1, scale: 0.95, minFloor: 1 },
  { name: 'Vault Stalker', brain: 'Charger', baseHp: 4, baseSpeed: 3.4, damage: 1, scale: 1.05, minFloor: 2 },
  { name: 'Iron Sentinel', brain: 'Patroller', baseHp: 5, baseSpeed: 2.7, damage: 1, scale: 1.15, minFloor: 3 },
];

export function worldToDungeonBoard(wx: number, wz: number): BoardPoint {
  return {
    x: Math.min(0.95, Math.max(0.05, wx / 76 + 0.5)),
    y: Math.min(0.95, Math.max(0.05, wz / 76 + 0.5)),
  };
}

export function isPointClearOfWalls(
  wx: number,
  wz: number,
  boxes: WallColliderBox[],
  clearance: number
): boolean {
  if (wx < -36.5 || wx > 36.5 || wz < -36.5 || wz > 36.5) return false;
  for (const b of boxes) {
    if (
      wx >= b.minX - clearance &&
      wx <= b.maxX + clearance &&
      wz >= b.minZ - clearance &&
      wz <= b.maxZ + clearance
    ) {
      return false;
    }
  }
  return true;
}

function cellCenterWorld(gx: number, gz: number): [number, number] {
  return [
    GRID_MIN_WORLD + (gx + 0.5) * CELL_SIZE,
    GRID_MIN_WORLD + (gz + 0.5) * CELL_SIZE,
  ];
}

function worldToGrid(wx: number, wz: number): [number, number] {
  return [
    Math.max(0, Math.min(GRID_SIZE - 1, Math.floor((wx - GRID_MIN_WORLD) / CELL_SIZE))),
    Math.max(0, Math.min(GRID_SIZE - 1, Math.floor((wz - GRID_MIN_WORLD) / CELL_SIZE))),
  ];
}

function makeRoomSpec(
  id: string,
  role: DungeonRoomRole,
  gx: number,
  gz: number,
  gw: number,
  gd: number
): DungeonRoomSpec {
  const minX = GRID_MIN_WORLD + gx * CELL_SIZE;
  const maxX = minX + gw * CELL_SIZE;
  const minZ = GRID_MIN_WORLD + gz * CELL_SIZE;
  const maxZ = minZ + gd * CELL_SIZE;
  return {
    id,
    role,
    gx,
    gz,
    gw,
    gd,
    minX,
    maxX,
    minZ,
    maxZ,
    centerX: (minX + maxX) * 0.5,
    centerZ: (minZ + maxZ) * 0.5,
  };
}

export class DungeonGeneratorService {
  /**
   * Generates a complete playable floor `GameLevel` for the isometric stone dungeon theme,
   * using room placement, MST + A* corridor pathfinding, wall merging, torch placement,
   * and role-aware spawning rules.
   */
  generateFloor(
    baseLevel: GameLevel,
    runSeed: number,
    floorNumber: number,
    configOverride?: Partial<RoguelikeConfig>
  ): GameLevel {
    const cfg: RoguelikeConfig = {
      bossInterval: 3,
      difficultyScale: 0.28,
      relicChoicesPerFloor: 3,
      trapDensity: 1.0,
      startingMaxHealth: 6,
      seedMode: 'random',
      fixedSeed: 104729,
      ...(baseLevel.roguelikeConfig ?? {}),
      ...(configOverride ?? {}),
    };

    const style = resolveDungeonStyle(
      configOverride?.dungeonStyle ??
        baseLevel.dungeonStyle ??
        cfg.dungeonStyle
    );
    cfg.dungeonStyle = style;

    const safeFloor = Math.max(1, Math.floor(floorNumber));
    const bossInterval = Math.max(2, Math.round(cfg.bossInterval || 3));
    const isBossFloor = safeFloor % bossInterval === 0;
    const effectiveSeed = (runSeed ^ Math.imul(safeFloor + 31, 1597334677)) >>> 0;
    const rng = createMulberry32(effectiveSeed);

    const layout = this.generateLayout(effectiveSeed, isBossFloor);
    const [sx, sz] = layout.spawnWorld;
    const [px, pz] = layout.portalWorld;
    const startPoint = worldToDungeonBoard(sx, sz);
    const portalPoint = worldToDungeonBoard(px, pz);

    const scaleFactor = 1 + (safeFloor - 1) * Math.max(0.05, cfg.difficultyScale);
    const entities = this.spawnEntities({
      layout,
      safeFloor,
      bossInterval,
      isBossFloor,
      scaleFactor,
      cfg,
      style,
      rng,
    });

    const nextBossIn = bossInterval - (safeFloor % bossInterval);
    const objectives = isBossFloor
      ? [
          { id: uid(), text: `Defeat the Floor ${safeFloor} Boss and guards`, isOptional: false },
          { id: uid(), text: 'Enter the unlocked portal to draft a Relic', isOptional: false },
        ]
      : [
          { id: uid(), text: `Clear all foes on Floor ${safeFloor}`, isOptional: false },
          {
            id: uid(),
            text: `Enter the portal to draft a Relic (Boss in ${nextBossIn} floor${nextBossIn === 1 ? '' : 's'})`,
            isOptional: false,
          },
        ];

    return {
      ...baseLevel,
      name: isBossFloor ? `Floor ${safeFloor} · Boss Vault` : `Floor ${safeFloor} · Torchlit Crypt`,
      style: 'roomChain',
      environmentType: 'dungeon',
      cameraMode: baseLevel.cameraMode ?? 'isometric',
      biome: 'cave',
      sky: 'cave',
      gameplayMode: 'roguelike',
      completeCondition: 'defeatAll',
      hasStart: true,
      hasPortal: true,
      startPoint,
      portalPoint,
      dungeonStyle: style,
      dungeonRooms: layout.rooms,
      customWallBoxes: layout.walls,
      roguelikeTorchAnchors: layout.torches,
      roguelikeConfig: cfg,
      entities,
      objectives,
      canSwim: false,
    };
  }

  /**
   * Builds a procedural 19x19 dungeon grid: non-overlapping rectangular rooms,
   * MST + loop edge selection, A* corridor pathfinding, greedy rectangular wall merging,
   * pillar & torch anchor placement, and role-based spawn anchors.
   */
  generateLayout(seed: number, isBossFloor: boolean): GeneratedDungeonLayout {
    const rng = createMulberry32(seed);
    const grid: CellKind[][] = Array.from({ length: GRID_SIZE }, () =>
      Array<CellKind>(GRID_SIZE).fill(0)
    );

    const rooms = isBossFloor
      ? this.placeBossSanctumRooms(rng)
      : this.placeStandardRooms(rng);

    for (const r of rooms) {
      this.carveRoomOnGrid(grid, r);
    }

    // Assign room roles before corridor carving so MST + loops know entrance/exit/treasure
    const { entranceRoom, exitRoom, treasureRoom, edges } = this.buildRoomConnections(
      rooms,
      isBossFloor,
      rng
    );

    for (const [a, b] of edges) {
      this.carveCorridorAStar(grid, a, b, isBossFloor ? 2 : 1, rng);
    }

    // Verify full reachability from entranceRoom to every room via flood fill
    this.ensureAllRoomsReachable(grid, rooms, entranceRoom, rng);

    const { walls, torches } = this.extractWallCollidersAndTorches(
      grid,
      rooms,
      entranceRoom,
      exitRoom,
      isBossFloor
    );

    const spawnWorld: [number, number] = [entranceRoom.centerX, entranceRoom.centerZ];
    const portalWorld: [number, number] = [exitRoom.centerX, exitRoom.centerZ];
    const bossWorld: [number, number] = isBossFloor
      ? [exitRoom.centerX, exitRoom.centerZ - 4.0]
      : [exitRoom.centerX, exitRoom.centerZ];

    // If boss floor, nudge portal north edge of sanctum so boss guards center in front of it
    if (isBossFloor) {
      portalWorld[0] = exitRoom.centerX;
      portalWorld[1] = exitRoom.minZ + CELL_SIZE * 1.1;
      bossWorld[0] = exitRoom.centerX;
      bossWorld[1] = exitRoom.centerZ;
    }

    const { enemyZones, chestZones, trapZones, propZones } = this.collectSpawnZones({
      grid,
      rooms,
      entranceRoom,
      exitRoom,
      treasureRoom,
      walls,
      spawnWorld,
      portalWorld,
      bossWorld,
      isBossFloor,
      rng,
    });

    return {
      grid,
      rooms,
      entranceRoom,
      exitRoom,
      treasureRoom,
      walls,
      torches,
      spawnWorld,
      portalWorld,
      bossWorld,
      enemyZones,
      chestZones,
      trapZones,
      propZones,
    };
  }

  private placeBossSanctumRooms(rng: () => number): DungeonRoomSpec[] {
    const mirror = rng() > 0.5 ? 1 : -1;
    const rooms: DungeonRoomSpec[] = [
      makeRoomSpec('room_boss', 'boss', 5, 3, 9, 9),
      makeRoomSpec('room_entrance', 'entrance', 7, 14, 5, 3),
      makeRoomSpec('room_wing_a', 'treasure', mirror > 0 ? 1 : 15, 6, 3, 5),
      makeRoomSpec('room_wing_b', 'combat', mirror > 0 ? 15 : 1, 6, 3, 5),
    ];
    return rooms;
  }

  private placeStandardRooms(rng: () => number): DungeonRoomSpec[] {
    const targetCount = 5 + Math.floor(rng() * 3); // 5..7 rooms
    const placed: DungeonRoomSpec[] = [];

    const overlapsWithPadding = (gx: number, gz: number, gw: number, gd: number) => {
      const pad = 1;
      for (const r of placed) {
        if (
          gx < r.gx + r.gw + pad &&
          gx + gw + pad > r.gx &&
          gz < r.gz + r.gd + pad &&
          gz + gd + pad > r.gz
        ) {
          return true;
        }
      }
      return false;
    };

    // Anchor an entrance room near south-west/south so isometric view frames nicely
    const entW = 3 + Math.floor(rng() * 2);
    const entD = 3 + Math.floor(rng() * 2);
    const entX = 1 + Math.floor(rng() * 6);
    const entZ = GRID_SIZE - 1 - entD - Math.floor(rng() * 2);
    placed.push(makeRoomSpec('room_0', 'entrance', entX, entZ, entW, entD));

    // Anchor a distant northern/eastern target candidate
    const farW = 4;
    const farD = 4;
    const farX = entX < 8 ? 11 + Math.floor(rng() * 3) : 2 + Math.floor(rng() * 3);
    const farZ = 1 + Math.floor(rng() * 3);
    if (!overlapsWithPadding(farX, farZ, farW, farD)) {
      placed.push(makeRoomSpec('room_1', 'combat', farX, farZ, farW, farD));
    }

    for (let attempt = 0; attempt < 90 && placed.length < targetCount; attempt++) {
      const gw = 3 + Math.floor(rng() * 3); // 3..5 (12m..20m)
      const gd = 3 + Math.floor(rng() * 3);
      const gx = 1 + Math.floor(rng() * Math.max(1, GRID_SIZE - 2 - gw));
      const gz = 1 + Math.floor(rng() * Math.max(1, GRID_SIZE - 2 - gd));
      if (!overlapsWithPadding(gx, gz, gw, gd)) {
        placed.push(makeRoomSpec(`room_${placed.length}`, 'combat', gx, gz, gw, gd));
      }
    }

    // Fallback quadrants if random placement yielded fewer than 4 rooms
    const fallbackSpots: [number, number, number, number][] = [
      [2, 2, 4, 4],
      [12, 2, 4, 4],
      [2, 12, 4, 4],
      [12, 12, 4, 4],
      [7, 7, 4, 4],
    ];
    for (const [gx, gz, gw, gd] of fallbackSpots) {
      if (placed.length >= 4) break;
      if (!overlapsWithPadding(gx, gz, gw, gd)) {
        placed.push(makeRoomSpec(`room_${placed.length}`, 'combat', gx, gz, gw, gd));
      }
    }

    return placed;
  }

  private carveRoomOnGrid(grid: CellKind[][], r: DungeonRoomSpec) {
    for (let gz = r.gz; gz < r.gz + r.gd; gz++) {
      for (let gx = r.gx; gx < r.gx + r.gw; gx++) {
        if (gx > 0 && gx < GRID_SIZE - 1 && gz > 0 && gz < GRID_SIZE - 1) {
          grid[gz][gx] = 1;
        }
      }
    }
  }

  private buildRoomConnections(
    rooms: DungeonRoomSpec[],
    isBossFloor: boolean,
    rng: () => number
  ): {
    entranceRoom: DungeonRoomSpec;
    exitRoom: DungeonRoomSpec;
    treasureRoom: DungeonRoomSpec | null;
    edges: [DungeonRoomSpec, DungeonRoomSpec][];
  } {
    const entranceRoom =
      rooms.find((r) => r.role === 'entrance') ??
      rooms.reduce((best, r) => (r.centerZ - r.centerX > best.centerZ - best.centerX ? r : best), rooms[0]);
    entranceRoom.role = 'entrance';

    let exitRoom: DungeonRoomSpec;
    if (isBossFloor) {
      exitRoom = rooms.find((r) => r.role === 'boss') ?? rooms[0];
      exitRoom.role = 'boss';
    } else {
      exitRoom = rooms
        .filter((r) => r.id !== entranceRoom.id)
        .reduce((best, r) => {
          const dBest = Math.hypot(best.centerX - entranceRoom.centerX, best.centerZ - entranceRoom.centerZ);
          const dCur = Math.hypot(r.centerX - entranceRoom.centerX, r.centerZ - entranceRoom.centerZ);
          return dCur > dBest ? r : best;
        }, rooms[rooms.length - 1]);
    }

    // Prim's Minimum Spanning Tree across rooms
    const connected = new Set<string>([entranceRoom.id]);
    const edges: [DungeonRoomSpec, DungeonRoomSpec][] = [];
    const degree = new Map<string, number>();

    while (connected.size < rooms.length) {
      let bestPair: [DungeonRoomSpec, DungeonRoomSpec] | null = null;
      let bestDist = Number.POSITIVE_INFINITY;
      for (const a of rooms) {
        if (!connected.has(a.id)) continue;
        for (const b of rooms) {
          if (connected.has(b.id)) continue;
          const d = Math.hypot(a.centerX - b.centerX, a.centerZ - b.centerZ);
          if (d < bestDist) {
            bestDist = d;
            bestPair = [a, b];
          }
        }
      }
      if (!bestPair) break;
      edges.push(bestPair);
      connected.add(bestPair[1].id);
      degree.set(bestPair[0].id, (degree.get(bestPair[0].id) ?? 0) + 1);
      degree.set(bestPair[1].id, (degree.get(bestPair[1].id) ?? 0) + 1);
    }

    // Add 1 tactical loop edge between two nearby unconnected rooms on standard floors
    if (!isBossFloor && rooms.length >= 4) {
      const hasEdge = (a: DungeonRoomSpec, b: DungeonRoomSpec) =>
        edges.some(([ea, eb]) => (ea.id === a.id && eb.id === b.id) || (ea.id === b.id && eb.id === a.id));
      let loopPair: [DungeonRoomSpec, DungeonRoomSpec] | null = null;
      let bestLoopDist = Number.POSITIVE_INFINITY;
      for (let i = 0; i < rooms.length; i++) {
        for (let j = i + 1; j < rooms.length; j++) {
          const a = rooms[i];
          const b = rooms[j];
          if (hasEdge(a, b)) continue;
          const d = Math.hypot(a.centerX - b.centerX, a.centerZ - b.centerZ);
          if (d < bestLoopDist && d > 14) {
            bestLoopDist = d;
            loopPair = [a, b];
          }
        }
      }
      if (loopPair && rng() > 0.25) {
        edges.push(loopPair);
      }
    }

    // Designate a treasure room (prefer a leaf room other than entrance/exit)
    let treasureRoom = rooms.find((r) => r.role === 'treasure') ?? null;
    if (!treasureRoom) {
      const candidates = rooms.filter((r) => r.id !== entranceRoom.id && r.id !== exitRoom.id);
      const leaf = candidates.find((r) => (degree.get(r.id) ?? 0) === 1);
      treasureRoom = leaf ?? candidates[0] ?? null;
      if (treasureRoom) treasureRoom.role = 'treasure';
    }

    return { entranceRoom, exitRoom, treasureRoom, edges };
  }

  /**
   * A* grid pathfinding between two room centers.
   * Prefers reusing existing carved cells so corridors merge cleanly, penalizes turns
   * for crisp orthogonal dungeon halls, and never pierces perimeter border cells.
   */
  private carveCorridorAStar(
    grid: CellKind[][],
    roomA: DungeonRoomSpec,
    roomB: DungeonRoomSpec,
    widenRadius: 1 | 2,
    rng: () => number
  ) {
    const startX = Math.max(1, Math.min(GRID_SIZE - 2, Math.floor(roomA.gx + roomA.gw * 0.5)));
    const startZ = Math.max(1, Math.min(GRID_SIZE - 2, Math.floor(roomA.gz + roomA.gd * 0.5)));
    const goalX = Math.max(1, Math.min(GRID_SIZE - 2, Math.floor(roomB.gx + roomB.gw * 0.5)));
    const goalZ = Math.max(1, Math.min(GRID_SIZE - 2, Math.floor(roomB.gz + roomB.gd * 0.5)));

    interface Node {
      x: number;
      z: number;
      g: number;
      f: number;
      dirX: number;
      dirZ: number;
      parent: Node | null;
    }

    const keyOf = (x: number, z: number) => z * GRID_SIZE + x;
    const open: Node[] = [
      {
        x: startX,
        z: startZ,
        g: 0,
        f: Math.abs(goalX - startX) + Math.abs(goalZ - startZ),
        dirX: 0,
        dirZ: 0,
        parent: null,
      },
    ];
    const bestG = new Map<number, number>([[keyOf(startX, startZ), 0]]);
    const closed = new Set<number>();
    const dirs: [number, number][] = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];

    let goalNode: Node | null = null;
    while (open.length > 0) {
      let bestIdx = 0;
      for (let i = 1; i < open.length; i++) {
        if (open[i].f < open[bestIdx].f) bestIdx = i;
      }
      const cur = open.splice(bestIdx, 1)[0];
      const curKey = keyOf(cur.x, cur.z);
      if (closed.has(curKey)) continue;
      closed.add(curKey);

      if (cur.x === goalX && cur.z === goalZ) {
        goalNode = cur;
        break;
      }

      for (const [dx, dz] of dirs) {
        const nx = cur.x + dx;
        const nz = cur.z + dz;
        if (nx <= 0 || nx >= GRID_SIZE - 1 || nz <= 0 || nz >= GRID_SIZE - 1) continue;
        const nKey = keyOf(nx, nz);
        if (closed.has(nKey)) continue;

        const baseStepCost = grid[nz][nx] !== 0 ? 1.0 : 2.35;
        const turnPenalty = cur.dirX !== 0 || cur.dirZ !== 0 ? (cur.dirX === dx && cur.dirZ === dz ? 0 : 0.35) : 0;
        const jitter = rng() * 0.05;
        const ng = cur.g + baseStepCost + turnPenalty + jitter;

        const prevBest = bestG.get(nKey);
        if (prevBest !== undefined && ng >= prevBest) continue;
        bestG.set(nKey, ng);

        const h = Math.abs(goalX - nx) + Math.abs(goalZ - nz);
        open.push({
          x: nx,
          z: nz,
          g: ng,
          f: ng + h * 1.05,
          dirX: dx,
          dirZ: dz,
          parent: cur,
        });
      }
    }

    let step: Node | null = goalNode;
    while (step) {
      if (grid[step.z][step.x] === 0) {
        grid[step.z][step.x] = 2;
      }
      // Widen boss corridors cleanly (2 cells) so bosses & multiple chasers never pinch
      if (widenRadius === 2) {
        for (const [ox, oz] of [
          [1, 0],
          [0, 1],
        ]) {
          const wx = step.x + ox;
          const wz = step.z + oz;
          if (wx > 0 && wx < GRID_SIZE - 1 && wz > 0 && wz < GRID_SIZE - 1 && grid[wz][wx] === 0) {
            grid[wz][wx] = 2;
          }
        }
      }
      step = step.parent;
    }
  }

  private ensureAllRoomsReachable(
    grid: CellKind[][],
    rooms: DungeonRoomSpec[],
    entranceRoom: DungeonRoomSpec,
    rng: () => number
  ) {
    const startX = Math.floor(entranceRoom.gx + entranceRoom.gw * 0.5);
    const startZ = Math.floor(entranceRoom.gz + entranceRoom.gd * 0.5);
    const flood = () => {
      const visited = new Set<number>();
      const queue: [number, number][] = [[startX, startZ]];
      visited.add(startZ * GRID_SIZE + startX);
      while (queue.length > 0) {
        const [cx, cz] = queue.shift()!;
        for (const [dx, dz] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = cx + dx;
          const nz = cz + dz;
          if (nx < 0 || nx >= GRID_SIZE || nz < 0 || nz >= GRID_SIZE) continue;
          if (grid[nz][nx] === 0) continue;
          const k = nz * GRID_SIZE + nx;
          if (visited.has(k)) continue;
          visited.add(k);
          queue.push([nx, nz]);
        }
      }
      return visited;
    };

    const visited = flood();
    for (const r of rooms) {
      const rx = Math.floor(r.gx + r.gw * 0.5);
      const rz = Math.floor(r.gz + r.gd * 0.5);
      if (!visited.has(rz * GRID_SIZE + rx)) {
        this.carveCorridorAStar(grid, entranceRoom, r, 1, rng);
      }
    }
  }

  private extractWallCollidersAndTorches(
    grid: CellKind[][],
    rooms: DungeonRoomSpec[],
    entranceRoom: DungeonRoomSpec,
    exitRoom: DungeonRoomSpec,
    isBossFloor: boolean
  ): { walls: WallColliderBox[]; torches: RoguelikeTorchAnchor[] } {
    const walls: WallColliderBox[] = [
      // Outer structural backing around the 19x19 grid [-43, +43]
      { minX: -43, maxX: 43, minZ: -43, maxZ: -38.0, height: 8.5, kind: 'stoneWall' },
      { minX: -43, maxX: -38.0, minZ: -43, maxZ: 43, height: 8.5, kind: 'stoneWall' },
      { minX: 38.0, maxX: 43, minZ: -43, maxZ: 43, height: 8.5, kind: 'stoneWall' },
      // South parapet kept low for clear isometric diorama sightlines
      { minX: -43, maxX: 43, minZ: 38.0, maxZ: 43, height: 2.3, kind: 'stoneWall' },
    ];

    // Greedy 2D rectangle merging over uncarved interior cells [0..GRID_SIZE-1]
    const visited: boolean[][] = Array.from({ length: GRID_SIZE }, () =>
      Array<boolean>(GRID_SIZE).fill(false)
    );

    for (let gz = 0; gz < GRID_SIZE; gz++) {
      for (let gx = 0; gx < GRID_SIZE; gx++) {
        if (grid[gz][gx] !== 0 || visited[gz][gx]) continue;
        const isSouthParapet = gz === GRID_SIZE - 1;

        let w = 1;
        while (
          gx + w < GRID_SIZE &&
          grid[gz][gx + w] === 0 &&
          !visited[gz][gx + w]
        ) {
          w++;
        }

        let h = 1;
        outer: while (gz + h < GRID_SIZE) {
          const rowIsSouth = gz + h === GRID_SIZE - 1;
          if (rowIsSouth !== isSouthParapet) break;
          for (let dx = 0; dx < w; dx++) {
            if (grid[gz + h][gx + dx] !== 0 || visited[gz + h][gx + dx]) {
              break outer;
            }
          }
          h++;
        }

        for (let dz = 0; dz < h; dz++) {
          for (let dx = 0; dx < w; dx++) {
            visited[gz + dz][gx + dx] = true;
          }
        }

        const minX = GRID_MIN_WORLD + gx * CELL_SIZE;
        const maxX = minX + w * CELL_SIZE;
        const minZ = GRID_MIN_WORLD + gz * CELL_SIZE;
        const maxZ = minZ + h * CELL_SIZE;

        const isCornerPocket =
          (gx === 0 || gx + w === GRID_SIZE) &&
          (gz === 0 || gz + h === GRID_SIZE) &&
          w >= 2 &&
          h >= 2 &&
          !isSouthParapet;

        walls.push({
          minX,
          maxX,
          minZ,
          maxZ,
          height: isSouthParapet ? 2.3 : isCornerPocket ? 6.2 : gz >= GRID_SIZE - 3 ? 5.6 : 7.0,
          kind: isCornerPocket ? 'caveRock' : 'stoneWall',
        });
      }
    }

    // Place interior structural stone pillars in spacious rooms (clear of center/doorways)
    for (const r of rooms) {
      if (isBossFloor && r.role === 'boss') {
        for (const [px, pz] of [
          [r.centerX - 9.5, r.centerZ - 9.5],
          [r.centerX + 9.5, r.centerZ - 9.5],
          [r.centerX - 9.5, r.centerZ + 9.5],
          [r.centerX + 9.5, r.centerZ + 9.5],
        ]) {
          walls.push({
            minX: px - 1.5,
            maxX: px + 1.5,
            minZ: pz - 1.5,
            maxZ: pz + 1.5,
            height: 8.0,
            kind: 'pillar',
          });
        }
        continue;
      }

      if (r.gw >= 4 && r.gd >= 4 && r.id !== entranceRoom.id) {
        const offsets: [number, number][] =
          r.id === exitRoom.id
            ? [
                [-4.8, -4.8],
                [4.8, -4.8],
                [-4.8, 4.8],
                [4.8, 4.8],
              ]
            : [
                [-4.2, 0],
                [4.2, 0],
              ];
        for (const [ox, oz] of offsets) {
          const px = r.centerX + ox;
          const pz = r.centerZ + oz;
          const [pgx, pgz] = worldToGrid(px, pz);
          // Only place pillar if well inside the room bounds
          if (
            pgx > r.gx &&
            pgx < r.gx + r.gw - 1 &&
            pgz > r.gz &&
            pgz < r.gz + r.gd - 1
          ) {
            walls.push({
              minX: px - 1.25,
              maxX: px + 1.25,
              minZ: pz - 1.25,
              maxZ: pz + 1.25,
              height: 7.8,
              kind: 'pillar',
            });
          }
        }
      }
    }

    // Place wall-mounted torches on exposed north/west/east stone walls bordering carved rooms
    const candidateTorches: RoguelikeTorchAnchor[] = [];
    for (let gz = 0; gz < GRID_SIZE - 2; gz++) {
      for (let gx = 0; gx < GRID_SIZE; gx++) {
        if (grid[gz][gx] !== 0) continue;
        const minX = GRID_MIN_WORLD + gx * CELL_SIZE;
        const maxX = minX + CELL_SIZE;
        const minZ = GRID_MIN_WORLD + gz * CELL_SIZE;
        const maxZ = minZ + CELL_SIZE;
        const cx = (minX + maxX) * 0.5;
        const cz = (minZ + maxZ) * 0.5;

        // South-facing wall surface (north wall of a room — reads super cleanly in isometric)
        if (gz + 1 < GRID_SIZE && grid[gz + 1][gx] === 1 && gx % 2 === 1) {
          candidateTorches.push({ x: cx, y: 3.3, z: maxZ + 0.08, nx: 0, nz: 1, light: false });
        }
        // East-facing wall surface (west wall of a room)
        if (gx + 1 < GRID_SIZE && grid[gz][gx + 1] === 1 && gz % 2 === 1) {
          candidateTorches.push({ x: maxX + 0.08, y: 3.2, z: cz, nx: 1, nz: 0, light: false });
        }
        // West-facing wall surface (east wall of a room)
        if (gx - 1 >= 0 && grid[gz][gx - 1] === 1 && gz % 2 === 0) {
          candidateTorches.push({ x: minX - 0.08, y: 3.2, z: cz, nx: -1, nz: 0, light: false });
        }
      }
    }

    // Deduplicate torches closer than 8.5m and evenly assign up to 7 real PointLight emitters
    const torches: RoguelikeTorchAnchor[] = [];
    for (const t of candidateTorches) {
      if (torches.some((e) => Math.hypot(e.x - t.x, e.z - t.z) < 8.5)) continue;
      torches.push(t);
      if (torches.length >= 16) break;
    }

    const maxRealLights = Math.min(7, torches.length);
    if (maxRealLights > 0) {
      const step = Math.max(1, Math.floor(torches.length / maxRealLights));
      let lit = 0;
      for (let i = 0; i < torches.length && lit < maxRealLights; i += step) {
        torches[i].light = true;
        lit++;
      }
    }

    return { walls, torches };
  }

  private collectSpawnZones(params: {
    grid: CellKind[][];
    rooms: DungeonRoomSpec[];
    entranceRoom: DungeonRoomSpec;
    exitRoom: DungeonRoomSpec;
    treasureRoom: DungeonRoomSpec | null;
    walls: WallColliderBox[];
    spawnWorld: [number, number];
    portalWorld: [number, number];
    bossWorld: [number, number];
    isBossFloor: boolean;
    rng: () => number;
  }) {
    const {
      grid,
      rooms,
      entranceRoom,
      exitRoom,
      treasureRoom,
      walls,
      spawnWorld,
      portalWorld,
      bossWorld,
      isBossFloor,
      rng,
    } = params;

    const enemyZones: [number, number][] = [];
    const chestZones: [number, number][] = [];
    const trapZones: [number, number][] = [];
    const propZones: { x: number; z: number; yaw: number }[] = [];

    const isSafeFromAnchors = (wx: number, wz: number, minDist = 4.2) => {
      if (Math.hypot(wx - spawnWorld[0], wz - spawnWorld[1]) < minDist) return false;
      if (Math.hypot(wx - portalWorld[0], wz - portalWorld[1]) < minDist) return false;
      if (isBossFloor && Math.hypot(wx - bossWorld[0], wz - bossWorld[1]) < minDist) return false;
      return true;
    };

    for (const r of rooms) {
      if (r.id === entranceRoom.id) {
        // Entrance gets corner decorative props only — never enemies or traps
        for (const [cx, cz] of [
          [r.minX + 1.8, r.minZ + 1.8],
          [r.maxX - 1.8, r.minZ + 1.8],
        ]) {
          if (isPointClearOfWalls(cx, cz, walls, 1.35) && isSafeFromAnchors(cx, cz, 3.4)) {
            propZones.push({ x: cx, z: cz, yaw: Math.round(rng() * 3) * 90 });
          }
        }
        continue;
      }

      // Enemy spots inside non-entrance rooms
      if (isBossFloor && r.role === 'boss') {
        for (const [ox, oz] of [
          [-11, -4],
          [11, -4],
          [-11, 8],
          [11, 8],
        ]) {
          const ex = r.centerX + ox;
          const ez = r.centerZ + oz;
          if (isPointClearOfWalls(ex, ez, walls, 2.0)) {
            enemyZones.push([ex, ez]);
          }
        }
      } else {
        const roomArea = r.gw * r.gd;
        const spotsInRoom = roomArea >= 16 ? 2 : 1;
        for (let s = 0; s < spotsInRoom; s++) {
          const ox = (s === 0 ? -0.22 : 0.22) * (r.maxX - r.minX);
          const oz = (rng() - 0.5) * 0.35 * (r.maxZ - r.minZ);
          const ex = r.centerX + ox;
          const ez = r.centerZ + oz;
          if (isPointClearOfWalls(ex, ez, walls, 2.0) && isSafeFromAnchors(ex, ez, 4.0)) {
            enemyZones.push([ex, ez]);
          }
        }
      }

      // Chest spots prioritize treasure room, then far alcoves/combat corners
      if (treasureRoom && r.id === treasureRoom.id) {
        if (isPointClearOfWalls(r.centerX, r.centerZ, walls, 1.8) && isSafeFromAnchors(r.centerX, r.centerZ, 3.6)) {
          chestZones.unshift([r.centerX, r.centerZ]);
        }
      } else if (r.id !== exitRoom.id || isBossFloor) {
        const cx = r.maxX - 2.4;
        const cz = r.minZ + 2.4;
        if (isPointClearOfWalls(cx, cz, walls, 1.7) && isSafeFromAnchors(cx, cz, 4.2)) {
          chestZones.push([cx, cz]);
        }
      }

      // Corner props inside rooms
      const corners: [number, number][] = [
        [r.minX + 1.8, r.minZ + 1.8],
        [r.maxX - 1.8, r.minZ + 1.8],
        [r.minX + 1.8, r.maxZ - 1.8],
      ];
      for (const [px, pz] of corners) {
        if (rng() > 0.55) continue;
        if (
          isPointClearOfWalls(px, pz, walls, 1.4) &&
          isSafeFromAnchors(px, pz, 3.8) &&
          !chestZones.some(([cx, cz]) => Math.hypot(cx - px, cz - pz) < 2.6)
        ) {
          propZones.push({ x: px, z: pz, yaw: Math.round(rng() * 3) * 90 });
        }
      }
    }

    // Collect corridor & combat room trap spots (always clear of walls & anchors)
    for (let gz = 1; gz < GRID_SIZE - 1; gz++) {
      for (let gx = 1; gx < GRID_SIZE - 1; gx++) {
        if (grid[gz][gx] !== 2) continue;
        const [wx, wz] = cellCenterWorld(gx, gz);
        if (
          isPointClearOfWalls(wx, wz, walls, 1.65) &&
          isSafeFromAnchors(wx, wz, 6.5) &&
          !trapZones.some(([tx, tz]) => Math.hypot(tx - wx, tz - wz) < 7.5)
        ) {
          trapZones.push([wx, wz]);
        }
      }
    }

    // Add a few flank traps inside large combat/boss rooms if corridor spots are scarce
    for (const r of rooms) {
      if (r.id === entranceRoom.id) continue;
      if (r.gw >= 4 && r.gd >= 4) {
        const tx = r.centerX + (rng() > 0.5 ? 4.2 : -4.2);
        const tz = r.centerZ + (rng() > 0.5 ? 3.8 : -3.8);
        if (
          isPointClearOfWalls(tx, tz, walls, 1.75) &&
          isSafeFromAnchors(tx, tz, 5.5) &&
          !trapZones.some(([ox, oz]) => Math.hypot(ox - tx, oz - tz) < 6.0)
        ) {
          trapZones.push([tx, tz]);
        }
      }
    }

    return { enemyZones, chestZones, trapZones, propZones };
  }

  private spawnEntities(params: {
    layout: GeneratedDungeonLayout;
    safeFloor: number;
    bossInterval: number;
    isBossFloor: boolean;
    scaleFactor: number;
    cfg: RoguelikeConfig;
    style: DungeonStyleConfig;
    rng: () => number;
  }): LevelEntity[] {
    const { layout, safeFloor, bossInterval, isBossFloor, scaleFactor, cfg, style, rng } = params;
    const entities: LevelEntity[] = [];
    const [sx, sz] = layout.spawnWorld;

    const makeEntity = (
      kind: LevelEntity['kind'],
      name: string,
      wx: number,
      wz: number,
      opts: Partial<LevelEntity> = {}
    ): LevelEntity => ({
      id: uid(),
      kind,
      name,
      position: worldToDungeonBoard(wx, wz),
      rotation: 0,
      scale: 1,
      isBoss: false,
      brain: 'Patroller',
      health: 3,
      speed: 3,
      damage: 1,
      loot: 'Coins',
      puzzleType: 'Pressure plate',
      dialogue: '',
      platformPreset: 'stoneLift',
      platformMotion: 'slide',
      platformSpeed: 1,
      platformWait: 1,
      platformRunning: true,
      conversation: [],
      notes: '',
      cards: [],
      ...opts,
    });

    // 1. Floor Boss on boss floors
    if (isBossFloor) {
      const bossTier = Math.max(0, Math.floor(safeFloor / bossInterval) - 1);
      const bossName = BOSS_NAMES[bossTier % BOSS_NAMES.length];
      const bossHp = Math.round((10 + safeFloor * 2.5) * (0.85 + cfg.difficultyScale * 0.5));
      const [bx, bz] = layout.bossWorld;
      entities.push(
        makeEntity('baddie', bossName, bx, bz, {
          isBoss: true,
          brain: 'Boss',
          health: Math.max(8, bossHp),
          speed: Math.min(4.6, 2.9 + safeFloor * 0.08),
          damage: 1,
          scale: 1.5,
          dialogue: `None shall pass Floor ${safeFloor}!`,
          conversation: [
            { id: uid(), isHero: false, words: `None shall pass Floor ${safeFloor}!`, replies: [] },
            { id: uid(), isHero: false, words: 'The crypt itself obeys my blade!', replies: [] },
          ],
        })
      );
    }

    // 2. Floor-scaled dungeon enemies across combat & wing rooms
    const targetEnemyCount = isBossFloor
      ? Math.min(4, 2 + Math.floor(safeFloor / 4))
      : Math.min(8, 3 + Math.floor((safeFloor + 1) * 0.7));

    const availableArchetypes = ENEMY_ARCHETYPES.filter((a) => safeFloor >= a.minFloor);
    const shuffledEnemySpots = [...layout.enemyZones].sort(() => rng() - 0.5);

    let placedEnemies = 0;
    for (const [exRaw, ezRaw] of shuffledEnemySpots) {
      if (placedEnemies >= targetEnemyCount) break;
      const jx = exRaw + (rng() - 0.5) * 2.2;
      const jz = ezRaw + (rng() - 0.5) * 2.2;
      if (!isPointClearOfWalls(jx, jz, layout.walls, 1.95)) continue;
      if (Math.hypot(jx - sx, jz - sz) < 11.5) continue;

      const arch = availableArchetypes[Math.floor(rng() * availableArchetypes.length)];
      const hp = Math.max(2, Math.round(arch.baseHp * scaleFactor));
      const spd = Math.min(4.8, Number((arch.baseSpeed + safeFloor * 0.08).toFixed(2)));
      const dropPool = ['healing_brew', 'wild_berries', 'forest_herbs'];
      const dropsHeal = rng() < 0.25;

      entities.push(
        makeEntity('baddie', arch.name, jx, jz, {
          brain: arch.brain,
          health: hp,
          speed: spd,
          damage: arch.damage,
          scale: arch.scale,
          pickupable: dropsHeal,
          pickupItemId: dropsHeal ? dropPool[Math.floor(rng() * dropPool.length)] : undefined,
          pickupQty: dropsHeal ? 1 : undefined,
        })
      );
      placedEnemies++;
    }

    // Guarantee at least 1 enemy on regular floors if room spots were tight
    if (!isBossFloor && placedEnemies === 0) {
      const [fx, fz] = [layout.exitRoom.centerX, layout.exitRoom.centerZ];
      entities.push(
        makeEntity('baddie', 'Crypt Skeleton', fx, fz, {
          brain: 'Chaser',
          health: Math.max(3, Math.round(3 * scaleFactor)),
          speed: 3.1,
        })
      );
    }

    // 3. Treasure Chests
    const chestCount = isBossFloor ? 2 : Math.min(3, 1 + (rng() > 0.35 ? 1 : 0));
    let placedChests = 0;
    for (const [cx, cz] of layout.chestZones) {
      if (placedChests >= chestCount) break;
      if (!isPointClearOfWalls(cx, cz, layout.walls, 1.6)) continue;
      const grantsPotion = rng() < 0.65;
      entities.push(
        makeEntity('treasure', isBossFloor ? 'Vault Chest' : 'Crypt Chest', cx, cz, {
          loot: grantsPotion ? 'Health' : 'Coins',
          pickupable: grantsPotion,
          pickupItemId: grantsPotion ? 'healing_brew' : undefined,
          pickupQty: grantsPotion ? 1 : undefined,
        })
      );
      placedChests++;
    }

    // 4. Styled Dungeon Traps
    const trapCount = Math.min(
      layout.trapZones.length,
      Math.max(1, Math.round((1 + safeFloor * 0.5) * (cfg.trapDensity ?? 1)))
    );
    const shuffledTraps = [...layout.trapZones].sort(() => rng() - 0.5);
    let placedTraps = 0;
    for (const [tx, tz] of shuffledTraps) {
      if (placedTraps >= trapCount) break;
      if (!isPointClearOfWalls(tx, tz, layout.walls, 1.65)) continue;
      entities.push(
        makeEntity('trap', DUNGEON_TRAP_STYLE_META[style.trapStyle].label, tx, tz, {
          trapStyle: style.trapStyle,
          styleTint: style.trapTint,
        })
      );
      placedTraps++;
    }

    // 5. Styled Dungeon Props (Barrels/Crates, Arcane Braziers, Bone Relics, or Gilded Urns)
    const propNames = DUNGEON_PROP_STYLE_META[style.propStyle].names;
    const maxProps = Math.min(8, layout.propZones.length);
    const shuffledProps = [...layout.propZones].sort(() => rng() - 0.5);
    for (let i = 0; i < maxProps; i++) {
      const pz = shuffledProps[i];
      if (
        entities.some((e) => {
          const ew = [
            (e.position.x - 0.5) * 76,
            (e.position.y - 0.5) * 76,
          ];
          return Math.hypot(ew[0] - pz.x, ew[1] - pz.z) < 2.2;
        })
      ) {
        continue;
      }
      entities.push(
        makeEntity('prop', propNames[i % propNames.length], pz.x, pz.z, {
          rotation: pz.yaw,
          propStyle: style.propStyle,
          styleTint: style.propTint,
        })
      );
    }

    return entities;
  }
}

export const DungeonGenerator = new DungeonGeneratorService();
