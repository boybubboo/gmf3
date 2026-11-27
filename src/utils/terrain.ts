import type {
  BoardPoint,
  CaveGrotto,
  DirtAndRoadConfig,
  EnvironmentType,
  GameLevel,
  MountainProfileConfig,
  PlatformMotionType,
  PropPresetId,
  RoadSpline,
  ScatterItem,
  SidePlatformSegment,
  SideScrollerConfig,
  SideScrollerLayersConfig,
  SideScrollerLayoutStyle,
  SideScrollerThemeId,
  TerrainBrush,
  TerrainBrushFalloff,
  TerrainBrushOptions,
  TerrainData,
  VistaPresetId,
  WallColliderBox,
  WaterBodyConfig,
} from '../types/maker';
export type { SidePlatformSegment, WallColliderBox } from '../types/maker';

export function createDefaultMountainConfig(): MountainProfileConfig {
  return {
    rockStartHeight: 5.5,
    snowStartHeight: 10.6,
    bandTransition: 0.45,
    roughness: 0.72,
    noiseType: 'fbm',
    noiseScale: 1.0,
    randomness: 0.35,
    autoSlopeWeathering: 0.68,
  };
}

export function createDefaultDirtAndRoadConfig(): DirtAndRoadConfig {
  return {
    heroColor: '#9C734B',
    secondaryColor: '#6F4F32',
    noiseKind: 'fineLoam',
    noiseContrast: 0.48,
    bumpStrength: 0.55,
    degradeAmount: 0.28,
    pebbleDensity: 0.55,
    pebbleSpread: 0.65,
    pebbleShapeRandomness: 0.62,
    pebbleColor: '#8B877E',
    pebbleHueVariance: 0.28,
    defaultRoadWidth: 2.4,
    defaultRoadRecess: 0.32,
    defaultRoadBankAngle: 0.5,
    defaultRoadEdgeTransition: 0.45,
    defaultBorderKind: 'wildflowers',
    defaultBorderDensity: 0.65,
    defaultBorderRandomness: 0.55,
  };
}

export function createDefaultWaterBodies(): WaterBodyConfig[] {
  return [
    {
      id: 'water-whispering-river',
      name: 'Whispering River',
      kind: 'river',
      center: [0, 6],
      points: [
        [-140, 22],
        [-70, -14],
        [0, 12],
        [70, -18],
        [140, 14],
      ],
      radiusX: 140,
      radiusZ: 12,
      width: 9.2,
      waterLevelOffset: 0,
      waterColor: '#2A9D8F',
      deepMurkColor: '#0E3E44',
      opacity: 0.84,
      depth: 2.1,
      foamAmount: 0.72,
      waveSpeed: 0.95,
      windRipple: 0.65,
      flowSpeed: 1.15,
      flowAngleDeg: 18,
      bankSlope: 0.52,
      bankSmoothness: 0.72,
      shoreNoise: 0.35,
    },
    {
      id: 'water-whispering-lake',
      name: 'Crystal Forest Lake',
      kind: 'lake',
      center: [-48, -62],
      radiusX: 21,
      radiusZ: 15.5,
      width: 18,
      waterLevelOffset: 0,
      waterColor: '#2E86AB',
      deepMurkColor: '#0C2D48',
      opacity: 0.86,
      depth: 2.6,
      foamAmount: 0.55,
      waveSpeed: 0.65,
      windRipple: 0.48,
      flowSpeed: 0.25,
      flowAngleDeg: 0,
      bankSlope: 0.64,
      bankSmoothness: 0.78,
      shoreNoise: 0.4,
    },
  ];
}

export function normalizeCaveGrotto(cave: CaveGrotto, index = 0): CaveGrotto {
  return {
    ...cave,
    name: cave.name?.trim() || (index === 0 ? 'Shadowrock Cavern' : `Cave Grotto ${index + 1}`),
    entranceWidth: cave.entranceWidth ?? 1.0,
    entranceHeight: cave.entranceHeight ?? 1.0,
    archSharpness: cave.archSharpness ?? 0.5,
    cavityDepth: cave.cavityDepth ?? 1.0,
    cavityWidth: cave.cavityWidth ?? 1.0,
    stalactiteDensity: cave.stalactiteDensity ?? 0.65,
    stalagmiteDensity: cave.stalagmiteDensity ?? 0.55,
    crystalDensity: cave.crystalDensity ?? 0.35,
    crystalColor: cave.crystalColor ?? '#5EEAD4',
    hasSpring: cave.hasSpring ?? false,
    springFlow: cave.springFlow ?? 0.65,
  };
}

function quinticSmooth(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * c * (c * (c * 6 - 15) + 10);
}

function catmullRom1D(p0: number, p1: number, p2: number, p3: number, t: number): number {
  // Mild tension (0.45) produces silky C1 curves on riverbanks/hills without ringing overshoot on cliffs
  const t2 = t * t;
  const t3 = t2 * t;
  const m1 = 0.45 * (p2 - p0);
  const m2 = 0.45 * (p3 - p1);
  return (
    (2 * t3 - 3 * t2 + 1) * p1 +
    (t3 - 2 * t2 + t) * m1 +
    (-2 * t3 + 3 * t2) * p2 +
    (t3 - t2) * m2
  );
}

function evaluateBrushFalloff(normDist: number, falloff: TerrainBrushFalloff): number {
  const d = Math.max(0, Math.min(1, normDist));
  const inv = 1 - d;
  if (falloff === 'dome') {
    return Math.sqrt(Math.max(0, 1 - d * d));
  }
  if (falloff === 'peak') {
    return inv * inv;
  }
  if (falloff === 'plateau') {
    if (d <= 0.48) return 1;
    return quinticSmooth(1 - (d - 0.48) / 0.52);
  }
  // 'smooth' (C2 quintic bell curve for natural rounded transitions)
  return quinticSmooth(inv);
}

export interface IslandHill {
  center: [number, number];
  radii: [number, number];
  height: number;
}

// Reachable enterable cave carved into the southern base of the western mountain near the starting trail
export const MountainCave = {
  x: -80,
  z: 67,
  yaw: -0.34, // entrance faces south-southwest directly toward hero's starting trail
  floorY: 1.55,
  mouthHalfWidth: 2.65,
  chamberHalfWidth: 5.2,
  depth: 12.6, // extends from local z = 0 (arch) to local z = -12.6 (back wall)
  ceilingHeight: 4.85,
};

export function toMountainCaveLocal(x: number, z: number): { lx: number; lz: number } {
  const dx = x - MountainCave.x;
  const dz = z - MountainCave.z;
  const c = Math.cos(MountainCave.yaw);
  const s = Math.sin(MountainCave.yaw);
  // Local +Z points OUT of the cave mouth along (sin(yaw), cos(yaw)); local -Z goes INTO the cave
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  return { lx, lz };
}

export function fromMountainCaveLocal(lx: number, lz: number): [number, number] {
  const c = Math.cos(MountainCave.yaw);
  const s = Math.sin(MountainCave.yaw);
  return [
    MountainCave.x + lx * c + lz * s,
    MountainCave.z - lx * s + lz * c,
  ];
}

export function isInsideMountainCave(x: number, z: number): boolean {
  const { lx, lz } = toMountainCaveLocal(x, z);
  return lz <= 1.2 && lz >= -MountainCave.depth - 0.8 && Math.abs(lx) <= MountainCave.chamberHalfWidth + 0.6;
}

export function isNearMountainCaveEntrance(x: number, z: number): boolean {
  const { lx, lz } = toMountainCaveLocal(x, z);
  return lz <= 4.5 && lz >= -MountainCave.depth - 1.5 && Math.abs(lx) <= MountainCave.chamberHalfWidth + 1.5;
}

export function terrainHasMainMountainCave(terrain?: TerrainData | null): boolean {
  if (!terrain?.caves || terrain.caves.length === 0) return false;
  return terrain.caves.some(
    (c) =>
      c.id === 'cave-mountain-main' ||
      Math.hypot(c.x - MountainCave.x, c.z - MountainCave.z) < 6
  );
}

export const IslandTerrain = {
  radius: 156,
  baseTop: 1.15,
  shoreRadius: 164,
  waterLevel: -1.65,
  seaFloor: -4.8,
  gridSize: 156,
  hills: [
    { center: [-52, -38], radii: [46, 38], height: 9.2 },
    { center: [58, -52], radii: [42, 36], height: 11.4 },
    { center: [14, 58], radii: [44, 34], height: 6.4 },
    { center: [-74, 49], radii: [34, 30], height: 12.4 },
    { center: [88, 36], radii: [36, 32], height: 8.8 },
    { center: [-12, -88], radii: [40, 30], height: 10.2 },
    { center: [-96, -16], radii: [32, 34], height: 7.4 },
    { center: [74, -12], radii: [30, 28], height: 6.0 },
  ] as IslandHill[],

  heightAt(x: number, z: number): number {
    const distance = Math.hypot(x, z);
    if (distance >= this.shoreRadius) return this.seaFloor;

    let hillSum = 0;
    for (const hill of this.hills) {
      const dx = (x - hill.center[0]) / hill.radii[0];
      const dz = (z - hill.center[1]) / hill.radii[1];
      const r2 = dx * dx + dz * dz;
      if (r2 < 1) {
        // C2-smooth quintic foothill curve transitioning seamlessly from flat meadow into sculpted peaks
        const bell = quinticSmooth(1 - Math.sqrt(r2));
        const ridgeDetail = 1 + 0.06 * Math.sin(x * 0.12 + z * 0.08) * (1 - r2);
        hillSum = Math.max(hillSum, hill.height * Math.pow(bell, 0.84) * ridgeDetail);
      }
    }

    const rInfo = IslandRiver.closest(x, z);
    const tDist = TerrainPaths.distanceTo(x, z);

    // Gently lower hills approaching river & dirt trail with C2 curve so banks never pinch sharply
    const riverHillMask = quinticSmooth((rInfo.dist - 8.2) / 15.5);
    const trailHillMask = 0.28 + 0.72 * quinticSmooth((tDist - 3.2) / 10.5);
    let result = this.baseTop + hillSum * riverHillMask * trailHillMask;

    // Slight undulating forest floor variation
    result += Math.sin(x * 0.09) * Math.cos(z * 0.09) * 0.22;

    // Recessed Dirt Forest Trail (carved -0.42m below adjacent ground with smooth quintic grass shoulders)
    if (tDist < 4.2 && rInfo.dist > 6.0) {
      const inner = 1.75;
      const outer = 4.2;
      if (tDist <= inner) {
        result -= 0.42;
      } else {
        const s = (tDist - inner) / (outer - inner);
        const smooth = 1 - quinticSmooth(s);
        result -= 0.42 * smooth;
      }
    }

    // Recessed Meandering Riverbed & Gracefully Curved Banks (vertical-to-horizontal S-curve)
    const riverInner = 4.4;
    const riverBank = 10.6;
    if (distance < this.shoreRadius - 2.0 && rInfo.dist < riverBank) {
      const bedDepth = this.waterLevel - 1.38;
      if (rInfo.dist <= riverInner) {
        result = bedDepth;
      } else {
        const s = (rInfo.dist - riverInner) / (riverBank - riverInner);
        const smooth = quinticSmooth(s);
        result = bedDepth * (1 - smooth) + result * smooth;
      }
    }

    // Carve level walkable approach & cavern floor at MountainCave base (3D vaulted mountain rock roof spans overhead)
    const { lx, lz } = toMountainCaveLocal(x, z);
    if (lz >= -MountainCave.depth - 5.5 && lz <= 10.5 && Math.abs(lx) <= MountainCave.chamberHalfWidth + 7.5) {
      // Interior chamber footprint + gentle entrance apron
      const insideX = Math.max(0, Math.abs(lx) - (MountainCave.chamberHalfWidth + 0.8));
      const insideZ =
        lz > 1.8
          ? lz - 1.8
          : lz < -MountainCave.depth - 0.6
          ? -MountainCave.depth - 0.6 - lz
          : 0;
      const edgeDist = Math.hypot(insideX, insideZ);
      const blendSpan = lz > 1.8 ? 8.2 : 4.8;
      if (edgeDist < blendSpan) {
        const smooth = quinticSmooth(edgeDist / blendSpan);
        result = MountainCave.floorY * (1 - smooth) + result * smooth;
      }
    }

    // Taper smoothly at the island coastal shore edge with a quintic beach curve
    if (distance > this.radius - 6.5) {
      const t = quinticSmooth(
        (distance - (this.radius - 6.5)) / (this.shoreRadius - (this.radius - 6.5))
      );
      result = result * (1 - t) + (this.waterLevel - 0.72) * t;
    }

    return result;
  },

  boardToWorld(point: BoardPoint): [number, number] {
    return [
      (point.x - 0.5) * 2 * this.radius,
      (point.y - 0.5) * 2 * this.radius,
    ];
  },

  worldToBoard(x: number, z: number): BoardPoint {
    const bx = Math.min(0.95, Math.max(0.05, x / (2 * this.radius) + 0.5));
    const by = Math.min(0.95, Math.max(0.05, z / (2 * this.radius) + 0.5));
    return { x: bx, y: by };
  },
};

export const IslandRiver = (() => {
  const samples: { x: number; z: number; tx: number; tz: number }[] = [];
  const count = 200;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const x = -164 + t * 328;
    const z = Math.sin(x * 0.036) * 32 + Math.cos(x * 0.017) * 16 + 6;
    samples.push({ x, z, tx: 1, tz: 0 });
  }
  for (let i = 0; i < count; i++) {
    const prev = samples[Math.max(0, i - 1)];
    const next = samples[Math.min(count - 1, i + 1)];
    const dx = next.x - prev.x;
    const dz = next.z - prev.z;
    const len = Math.max(0.001, Math.hypot(dx, dz));
    samples[i].tx = dx / len;
    samples[i].tz = dz / len;
  }

  return {
    samples,
    closest(x: number, z: number): { dist: number; tx: number; tz: number; cx: number; cz: number } {
      let bestDist = Number.POSITIVE_INFINITY;
      let best = samples[0];
      for (const s of samples) {
        const d = Math.hypot(s.x - x, s.z - z);
        if (d < bestDist) {
          bestDist = d;
          best = s;
        }
      }
      return { dist: bestDist, tx: best.tx, tz: best.tz, cx: best.x, cz: best.z };
    },
    distanceTo(x: number, z: number): number {
      return this.closest(x, z).dist;
    },
  };
})();

export const TerrainPaths = (() => {
  const start: [number, number] = [
    (0.14 - 0.5) * 2 * IslandTerrain.radius,
    (0.8 - 0.5) * 2 * IslandTerrain.radius,
  ];
  const end: [number, number] = [
    (0.88 - 0.5) * 2 * IslandTerrain.radius,
    (0.24 - 0.5) * 2 * IslandTerrain.radius,
  ];
  const control: [number, number] = [
    (start[0] + end[0]) * 0.5 + 32.0,
    (start[1] + end[1]) * 0.5 + 24.0,
  ];
  const samples: { x: number; z: number; tx: number; tz: number }[] = [];
  const count = 220;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const om = 1 - t;
    const wobble = Math.sin(t * Math.PI * 5) * 9.5;
    const x = om * om * start[0] + 2 * om * t * control[0] + t * t * end[0] + wobble * 0.45;
    const z = om * om * start[1] + 2 * om * t * control[1] + t * t * end[1] - wobble * 0.85;
    samples.push({ x, z, tx: 1, tz: 0 });
  }
  for (let i = 0; i < count; i++) {
    const prev = samples[Math.max(0, i - 1)];
    const next = samples[Math.min(count - 1, i + 1)];
    const dx = next.x - prev.x;
    const dz = next.z - prev.z;
    const len = Math.max(0.001, Math.hypot(dx, dz));
    samples[i].tx = dx / len;
    samples[i].tz = dz / len;
  }
  return {
    start,
    end,
    samples,
    closest(x: number, z: number): { dist: number; tx: number; tz: number } {
      let closest = Number.POSITIVE_INFINITY;
      let best = samples[0];
      for (const s of samples) {
        const d = Math.hypot(s.x - x, s.z - z);
        if (d < closest) {
          closest = d;
          best = s;
        }
      }
      return { dist: closest, tx: best.tx, tz: best.tz };
    },
    distanceTo(x: number, z: number): number {
      return this.closest(x, z).dist;
    },
  };
})();

export const RiverCrossing = (() => {
  // Locate where TerrainPaths crosses IslandRiver so a sturdy wooden bridge spans it
  let bestDist = Number.POSITIVE_INFINITY;
  let crossSample = TerrainPaths.samples[Math.floor(TerrainPaths.samples.length / 2)];
  for (const s of TerrainPaths.samples) {
    const d = IslandRiver.distanceTo(s.x, s.z);
    if (d < bestDist) {
      bestDist = d;
      crossSample = s;
    }
  }
  const yaw = Math.atan2(crossSample.tx, crossSample.tz);
  return {
    x: crossSample.x,
    z: crossSample.z,
    tx: crossSample.tx,
    tz: crossSample.tz,
    yaw,
    halfLength: 9.2,
    halfWidth: 2.35,
    deckY: 0.42,
  };
})();

export function getEnvironmentType(level?: Partial<GameLevel> | null): EnvironmentType {
  if (!level) return 'openWorld';
  if (level.environmentType) return level.environmentType;

  const n = (level.name ?? '').toLowerCase();
  if (n.includes('dungeon') || n.includes('vault') || n.includes('outer gate') || n.includes('crypt')) {
    return 'dungeon';
  }
  if (n.includes('throne') || n.includes('castle') || (n.includes('courtyard') && level.biome === 'meadow')) {
    return 'castle';
  }
  if (n.includes('cliff') || n.includes('bridge') || n.includes('platform')) {
    return 'sideScroller';
  }
  if (n.includes('crater') || n.includes('orbital') || n.includes('base')) {
    return 'scifi';
  }
  if (level.cameraMode === 'sideScroll') return 'sideScroller';
  if (level.biome === 'cave' || level.sky === 'cave') return 'dungeon';
  return 'openWorld';
}

export function getTerrainRadius(terrain?: Pick<TerrainData, 'worldRadius'> | null): number {
  return terrain?.worldRadius && terrain.worldRadius > 0
    ? terrain.worldRadius
    : IslandTerrain.radius;
}

export function getTerrainShoreRadius(terrain?: Pick<TerrainData, 'worldRadius'> | null): number {
  const r = getTerrainRadius(terrain);
  return r === IslandTerrain.radius ? IslandTerrain.shoreRadius : r * 1.05;
}

export function getLevelWorldRadius(level?: Partial<GameLevel> | null): number {
  const env = getEnvironmentType(level);
  if (env === 'dungeon') return 42;
  if (env === 'castle') return 46;
  if (env === 'sideScroller') return 56;
  return getTerrainRadius(level?.terrain);
}

export function levelBoardToWorld(level: Partial<GameLevel> | null | undefined, point: BoardPoint): [number, number] {
  const env = getEnvironmentType(level);
  if (env === 'sideScroller') {
    return [
      (point.x - 0.5) * 108,
      (point.y - 0.5) * 3.8,
    ];
  }
  if (env === 'dungeon') {
    return [
      (point.x - 0.5) * 76,
      (point.y - 0.5) * 76,
    ];
  }
  if (env === 'castle') {
    return [
      (point.x - 0.5) * 84,
      (point.y - 0.5) * 84,
    ];
  }
  const r = getTerrainRadius(level?.terrain);
  return [(point.x - 0.5) * 2 * r, (point.y - 0.5) * 2 * r];
}

export function levelWorldToBoard(level: Partial<GameLevel> | null | undefined, x: number, z: number): BoardPoint {
  const env = getEnvironmentType(level);
  if (env === 'sideScroller') {
    return {
      x: Math.min(0.95, Math.max(0.05, x / 108 + 0.5)),
      y: Math.min(0.95, Math.max(0.05, z / 3.8 + 0.5)),
    };
  }
  if (env === 'dungeon') {
    return {
      x: Math.min(0.95, Math.max(0.05, x / 76 + 0.5)),
      y: Math.min(0.95, Math.max(0.05, z / 76 + 0.5)),
    };
  }
  if (env === 'castle') {
    return {
      x: Math.min(0.95, Math.max(0.05, x / 84 + 0.5)),
      y: Math.min(0.95, Math.max(0.05, z / 84 + 0.5)),
    };
  }
  const r = getTerrainRadius(level?.terrain);
  return {
    x: Math.min(0.95, Math.max(0.05, x / (2 * r) + 0.5)),
    y: Math.min(0.95, Math.max(0.05, z / (2 * r) + 0.5)),
  };
}

export const SIDE_SCROLLER_SEGMENTS: SidePlatformSegment[] = [
  { minX: -56, maxX: -28, y: 0.2, thickness: 4.5, style: 'cliff' },
  { minX: -25, maxX: -14, y: 1.7, thickness: 1.2, style: 'bridge' },
  { minX: -11, maxX: 6, y: 0.8, thickness: 4.5, style: 'cliff' },
  { minX: 9, maxX: 20, y: 2.5, thickness: 1.2, style: 'stone' },
  { minX: 23, maxX: 37, y: 1.4, thickness: 4.5, style: 'cliff' },
  { minX: 39.5, maxX: 56, y: 2.6, thickness: 4.5, style: 'cliff' },
];

export function getSideScrollerThemeLayers(theme: SideScrollerThemeId): SideScrollerLayersConfig {
  switch (theme) {
    case 'jungleCanopy':
      return {
        foregroundStyle: 'jungleFraming',
        foregroundColor: '#1F4D2A',
        heroLaneColor: '#4F772D',
        heroTrimColor: '#8C5E34',
        midgroundStyle: 'jungleTreesAndVines',
        midgroundColor: '#2D6A4F',
        farStyle: 'jungleMistCanopy',
        farColor: '#74C69D',
        liquidType: 'water',
        liquidLevelY: -5.8,
        liquidColor: '#2A9D8F',
      };
    case 'underwaterCoral':
      return {
        foregroundStyle: 'coralSilhouette',
        foregroundColor: '#114B5F',
        heroLaneColor: '#E9C46A',
        heroTrimColor: '#F4A261',
        midgroundStyle: 'coralReefAndKelp',
        midgroundColor: '#1B7F79',
        farStyle: 'deepOceanRays',
        farColor: '#0B3954',
        liquidType: 'water',
        liquidLevelY: 22.0,
        liquidColor: '#1CA3EC',
      };
    case 'volcanicForge':
      return {
        foregroundStyle: 'cavernStalactites',
        foregroundColor: '#2B1B17',
        heroLaneColor: '#4A3B39',
        heroTrimColor: '#EA580C',
        midgroundStyle: 'volcanicSpires',
        midgroundColor: '#3F2724',
        farStyle: 'volcanoPeaks',
        farColor: '#7C2D12',
        liquidType: 'lava',
        liquidLevelY: -4.8,
        liquidColor: '#F97316',
      };
    case 'crystalCavern':
      return {
        foregroundStyle: 'cavernStalactites',
        foregroundColor: '#1E1B4B',
        heroLaneColor: '#4338CA',
        heroTrimColor: '#38BDF8',
        midgroundStyle: 'crystalCaverns',
        midgroundColor: '#312E81',
        farStyle: 'cavernVault',
        farColor: '#1E1B4B',
        liquidType: 'water',
        liquidLevelY: -6.0,
        liquidColor: '#22D3EE',
      };
    case 'skyTemple':
      return {
        foregroundStyle: 'none',
        foregroundColor: '#64748B',
        heroLaneColor: '#E2E8F0',
        heroTrimColor: '#F59E0B',
        midgroundStyle: 'floatingTemples',
        midgroundColor: '#94A3B8',
        farStyle: 'cloudPillars',
        farColor: '#DBEAFE',
        liquidType: 'mist',
        liquidLevelY: -6.5,
        liquidColor: '#E0F2FE',
      };
    case 'sunnyCliffs':
    default:
      return {
        foregroundStyle: 'shrubsAndRocks',
        foregroundColor: '#39414E',
        heroLaneColor: '#6E9F4E',
        heroTrimColor: '#9C6638',
        midgroundStyle: 'cliffsAndPines',
        midgroundColor: '#616E7D',
        farStyle: 'alpineMountains',
        farColor: '#9EB3C8',
        liquidType: 'water',
        liquidLevelY: -6.2,
        liquidColor: '#38BDF8',
      };
  }
}

export function createSideScrollerPresetConfig(
  layoutStyle: SideScrollerLayoutStyle,
  themeOverride?: SideScrollerThemeId
): SideScrollerConfig {
  const defaultTheme: SideScrollerThemeId =
    themeOverride ??
    (layoutStyle === 'layeredJungle'
      ? 'jungleCanopy'
      : layoutStyle === 'underwater'
      ? 'underwaterCoral'
      : layoutStyle === 'verticalClimber'
      ? 'volcanicForge'
      : layoutStyle === 'skyTemple'
      ? 'skyTemple'
      : layoutStyle === 'cavern'
      ? 'crystalCavern'
      : 'sunnyCliffs');
  const layers = getSideScrollerThemeLayers(defaultTheme);

  if (layoutStyle === 'verticalClimber') {
    return {
      layoutStyle: 'verticalClimber',
      theme: defaultTheme,
      layers,
      gravityScale: 1.0,
      swimPhysics: false,
      segments: [
        { id: 'v_base', minX: -36, maxX: 36, y: 0.2, thickness: 4.5, style: 'girder', oneWay: false },
        { id: 'v_tier1_l', minX: -32, maxX: -2, y: 4.2, thickness: 0.9, style: 'girder', oneWay: true },
        { id: 'v_tier1_r', minX: 4, maxX: 32, y: 4.8, thickness: 0.9, style: 'girder', oneWay: true },
        { id: 'v_tier2_l', minX: -28, maxX: 8, y: 8.8, thickness: 0.9, style: 'girder', oneWay: true },
        { id: 'v_tier2_r', minX: 12, maxX: 32, y: 9.4, thickness: 0.9, style: 'girder', oneWay: true },
        { id: 'v_tier3_c', minX: -24, maxX: 26, y: 13.4, thickness: 0.9, style: 'girder', oneWay: true },
        { id: 'v_summit', minX: -16, maxX: 18, y: 17.6, thickness: 1.1, style: 'stone', oneWay: true },
      ],
      vines: [
        { id: 'lad_1', kind: 'ladder', x: 14, bottomY: 0.2, topY: 4.9 },
        { id: 'lad_2', kind: 'ladder', x: -16, bottomY: 4.2, topY: 8.9 },
        { id: 'lad_3', kind: 'ladder', x: 4, bottomY: 8.8, topY: 13.5 },
        { id: 'lad_4', kind: 'ladder', x: -8, bottomY: 13.4, topY: 17.7 },
      ],
      secretRooms: [
        {
          id: 'sec_climber_vault',
          name: 'Hidden Boiler Loft',
          entranceX: -29,
          entranceY: 4.2,
          roomCenterX: 46,
          roomCenterY: 6.0,
          width: 12,
          height: 6,
          floorColor: '#3B2820',
          wallColor: '#1E1514',
          accentColor: '#F59E0B',
          exitX: 41,
          exitY: 6.0,
        },
      ],
    };
  }

  if (layoutStyle === 'layeredJungle') {
    return {
      layoutStyle: 'layeredJungle',
      theme: defaultTheme,
      layers,
      gravityScale: 1.0,
      swimPhysics: false,
      segments: [
        { id: 'j_floor_1', minX: -54, maxX: -18, y: 0.2, thickness: 4.5, style: 'jungleFloor', oneWay: false },
        { id: 'j_branch_1', minX: -32, maxX: -14, y: 4.0, thickness: 0.85, style: 'branch', oneWay: true },
        { id: 'j_floor_2', minX: -13, maxX: 18, y: 0.4, thickness: 4.5, style: 'jungleFloor', oneWay: false },
        { id: 'j_branch_2', minX: -6, maxX: 14, y: 4.6, thickness: 0.85, style: 'branch', oneWay: true },
        { id: 'j_canopy_top', minX: 4, maxX: 24, y: 8.4, thickness: 0.85, style: 'branch', oneWay: true },
        { id: 'j_floor_3', minX: 23, maxX: 54, y: 1.1, thickness: 4.5, style: 'jungleFloor', oneWay: false },
        { id: 'j_branch_3', minX: 28, maxX: 46, y: 5.1, thickness: 0.85, style: 'branch', oneWay: true },
      ],
      vines: [
        { id: 'vine_1', kind: 'vine', x: -15.5, bottomY: 1.2, topY: 7.4 },
        { id: 'vine_2', kind: 'vine', x: 3.0, bottomY: 0.5, topY: 8.8 },
        { id: 'vine_3', kind: 'vine', x: 20.5, bottomY: 1.5, topY: 7.6 },
      ],
      secretRooms: [
        {
          id: 'sec_jungle_hollow',
          name: 'Secret Banana Hollow',
          entranceX: -2,
          entranceY: 0.4,
          roomCenterX: 0,
          roomCenterY: -13.0,
          width: 16,
          height: 6.5,
          floorColor: '#3B5E2B',
          wallColor: '#1E3119',
          accentColor: '#FACC15',
          exitX: -6,
          exitY: -13.0,
        },
      ],
    };
  }

  if (layoutStyle === 'underwater') {
    return {
      layoutStyle: 'underwater',
      theme: defaultTheme,
      layers,
      gravityScale: 0.38,
      swimPhysics: true,
      segments: [
        { id: 'u_reef_1', minX: -54, maxX: -20, y: 0.2, thickness: 4.5, style: 'coral', oneWay: false },
        { id: 'u_shelf_1', minX: -28, maxX: -12, y: 4.4, thickness: 0.9, style: 'coral', oneWay: true },
        { id: 'u_reef_2', minX: -14, maxX: 16, y: -0.6, thickness: 4.5, style: 'coral', oneWay: false },
        { id: 'u_shelf_2', minX: -4, maxX: 14, y: 5.2, thickness: 0.9, style: 'coral', oneWay: true },
        { id: 'u_reef_3', minX: 22, maxX: 54, y: 0.8, thickness: 4.5, style: 'coral', oneWay: false },
      ],
      vines: [
        { id: 'bub_1', kind: 'bubbleStream', x: -17, bottomY: -1.0, topY: 8.5 },
        { id: 'bub_2', kind: 'bubbleStream', x: 19, bottomY: -0.5, topY: 9.2 },
      ],
      secretRooms: [
        {
          id: 'sec_sunken_grotto',
          name: 'Sunken Pearl Grotto',
          entranceX: 6,
          entranceY: -0.6,
          roomCenterX: 0,
          roomCenterY: -13.5,
          width: 16,
          height: 7,
          floorColor: '#0E7490',
          wallColor: '#083344',
          accentColor: '#38BDF8',
          exitX: -6,
          exitY: -13.5,
        },
      ],
    };
  }

  // flat2D / skyTemple / cavern default layout
  const defaultStyle =
    layoutStyle === 'skyTemple' ? 'cloud' : layoutStyle === 'cavern' ? 'crystal' : 'cliff';
  return {
    layoutStyle,
    theme: defaultTheme,
    layers,
    gravityScale: 1.0,
    swimPhysics: false,
    segments: SIDE_SCROLLER_SEGMENTS.map((seg, i) => ({
      ...seg,
      id: `flat_${i}`,
      style: i === 1 ? 'bridge' : i === 3 ? 'stone' : defaultStyle,
      oneWay: i === 1 || i === 3,
    })),
    vines:
      layoutStyle === 'cavern'
        ? [{ id: 'lad_cav_1', kind: 'ladder', x: 9.5, bottomY: 0.8, topY: 2.6 }]
        : [],
    secretRooms: [],
  };
}

export function getSideScrollerConfig(level?: Partial<GameLevel> | null): SideScrollerConfig {
  if (level?.sideScrollerConfig && Array.isArray(level.sideScrollerConfig.segments)) {
    return level.sideScrollerConfig;
  }
  const layers = getSideScrollerThemeLayers('sunnyCliffs');
  return {
    layoutStyle: 'flat2D',
    theme: 'sunnyCliffs',
    segments: SIDE_SCROLLER_SEGMENTS.map((s, idx) => ({ ...s, id: `seg_${idx}` })),
    vines: [],
    secretRooms: [],
    layers,
    gravityScale: 1.0,
    swimPhysics: false,
  };
}

export function getSideScrollerSegments(level?: Partial<GameLevel> | null): SidePlatformSegment[] {
  const cfg = level?.sideScrollerConfig;
  const baseSegs =
    cfg && Array.isArray(cfg.segments) && cfg.segments.length > 0
      ? cfg.segments
      : SIDE_SCROLLER_SEGMENTS;
  if (!cfg?.secretRooms?.length) return baseSegs;
  const roomFloors: SidePlatformSegment[] = cfg.secretRooms.map((r) => ({
    id: `secfloor_${r.id}`,
    minX: r.roomCenterX - r.width * 0.5,
    maxX: r.roomCenterX + r.width * 0.5,
    y: r.roomCenterY,
    thickness: 1.4,
    style: 'stone',
    color: r.floorColor,
    oneWay: false,
    isSecretFloor: true,
  }));
  return [...baseSegs, ...roomFloors];
}

export function sampleSideScrollerSurfaceAtY(
  level: GameLevel,
  x: number,
  z: number,
  actorY: number,
  allowDropThrough = false
): number {
  if (Math.abs(z) > 3.6) return -28;
  const segs = getSideScrollerSegments(level);
  let bestY = -28;
  for (const seg of segs) {
    if (x >= seg.minX && x <= seg.maxX) {
      if (allowDropThrough && seg.oneWay) continue;
      if (seg.y <= actorY + 0.65 && seg.y > bestY) {
        bestY = seg.y;
      }
    }
  }
  return bestY;
}

export const DUNGEON_WALL_BOXES: WallColliderBox[] = [
  // Outer stone perimeter walls (south parapet lower so front camera never clips)
  { minX: -43, maxX: 43, minZ: -43, maxZ: -39.5, height: 8.5, kind: 'stoneWall' },
  { minX: -43, maxX: -39.5, minZ: -43, maxZ: 43, height: 8.5, kind: 'stoneWall' },
  { minX: 39.5, maxX: 43, minZ: -43, maxZ: 43, height: 8.5, kind: 'stoneWall' },
  { minX: -43, maxX: 43, minZ: 39.5, maxZ: 43, height: 2.3, kind: 'stoneWall' },

  // West chamber wall at X = -8 (wide archways at Z in [-16,-4] and [14,28])
  { minX: -9.4, maxX: -6.6, minZ: -39.5, maxZ: -16, height: 7.4, kind: 'stoneWall' },
  { minX: -9.4, maxX: -6.6, minZ: -4, maxZ: 14, height: 7.4, kind: 'stoneWall' },
  { minX: -9.4, maxX: -6.6, minZ: 28, maxZ: 39.5, height: 5.5, kind: 'stoneWall' },

  // East chamber wall at X = +17 (wide archways at Z in [-22,-8] and [10,24])
  { minX: 15.6, maxX: 18.4, minZ: -39.5, maxZ: -22, height: 7.4, kind: 'stoneWall' },
  { minX: 15.6, maxX: 18.4, minZ: -8, maxZ: 10, height: 7.4, kind: 'stoneWall' },
  { minX: 15.6, maxX: 18.4, minZ: 24, maxZ: 39.5, height: 5.5, kind: 'stoneWall' },

  // Organic craggy cave rock grottos (corners & northern alcove wall)
  { minX: -39.5, maxX: -32.5, minZ: -39.5, maxZ: -32.5, height: 6.2, kind: 'caveRock' },
  { minX: -22, maxX: -14, minZ: -39.5, maxZ: -33, height: 5.8, kind: 'caveRock' },
  { minX: 29, maxX: 39.5, minZ: 29, maxZ: 39.5, height: 6.0, kind: 'caveRock' },
  { minX: 0, maxX: 8, minZ: -27, maxZ: -22, height: 5.6, kind: 'caveRock' },

  // Vaulted hall pillars
  { minX: 2.5, maxX: 5.5, minZ: -5.5, maxZ: -2.5, height: 8.0, kind: 'pillar' },
  { minX: 2.5, maxX: 5.5, minZ: 12.5, maxZ: 15.5, height: 8.0, kind: 'pillar' },
];

export const CASTLE_WALL_BOXES: WallColliderBox[] = [
  // Outer castle walls (south parapet low for clear camera sightlines)
  { minX: -47, maxX: 47, minZ: -47, maxZ: -43.5, height: 9.0, kind: 'castleWall' },
  { minX: -47, maxX: -43.5, minZ: -47, maxZ: 47, height: 8.5, kind: 'castleWall' },
  { minX: 43.5, maxX: 47, minZ: -47, maxZ: 47, height: 8.5, kind: 'castleWall' },
  { minX: -47, maxX: 47, minZ: 43.5, maxZ: 47, height: 2.2, kind: 'castleWall' },

  // Grand colonnade pillars
  { minX: -18, maxX: -15.5, minZ: -22, maxZ: -19.5, height: 8.0, kind: 'pillar' },
  { minX: 15.5, maxX: 18, minZ: -22, maxZ: -19.5, height: 8.0, kind: 'pillar' },
  { minX: -18, maxX: -15.5, minZ: 4, maxZ: 6.5, height: 8.0, kind: 'pillar' },
  { minX: 15.5, maxX: 18, minZ: 4, maxZ: 6.5, height: 8.0, kind: 'pillar' },
];

export const SCIFI_WALL_BOXES: WallColliderBox[] = [
  { minX: -52, maxX: 52, minZ: -52, maxZ: -49, height: 6.0, kind: 'bulkhead' },
  { minX: -52, maxX: -49, minZ: -52, maxZ: 52, height: 6.0, kind: 'bulkhead' },
  { minX: 49, maxX: 52, minZ: -52, maxZ: 52, height: 6.0, kind: 'bulkhead' },
  { minX: -52, maxX: 52, minZ: 49, maxZ: 52, height: 2.0, kind: 'bulkhead' },
];

export function getLevelWallBoxes(level?: Partial<GameLevel> | null): WallColliderBox[] {
  if (level?.customWallBoxes && level.customWallBoxes.length > 0) {
    return level.customWallBoxes;
  }
  const env = getEnvironmentType(level);
  if (env === 'dungeon') return DUNGEON_WALL_BOXES;
  if (env === 'castle') return CASTLE_WALL_BOXES;
  if (env === 'scifi') return SCIFI_WALL_BOXES;
  return [];
}

export interface CollisionFilterContext {
  choppedTreeIds?: ReadonlySet<string>;
  openedDoorIds?: ReadonlySet<string>;
  actorY?: number;
}

interface CircleCollider {
  kind: 'circle';
  x: number;
  z: number;
  r: number;
  stumpR?: number;
  treeId?: string;
  doorId?: string;
  /** True for door side pillars that remain solid after door opens; false for main closed door leaf */
  openOnly?: boolean;
  minY?: number;
  maxY?: number;
  stamp: number;
}

interface ObbCollider {
  kind: 'obb';
  x: number;
  z: number;
  cos: number;
  sin: number;
  hw: number;
  hd: number;
  doorId?: string;
  minY?: number;
  maxY?: number;
  stamp: number;
}

type LevelCollider = CircleCollider | ObbCollider;

interface CachedLevelColliderGrid {
  env: EnvironmentType;
  scatterRef: ScatterItem[] | undefined;
  cavesRef: CaveGrotto[] | undefined;
  entitiesRef: GameLevel['entities'] | undefined;
  cells: Map<number, LevelCollider[]>;
}

const COLLIDER_CELL_SIZE = 8;
const levelColliderCache = new WeakMap<GameLevel, CachedLevelColliderGrid>();
let nextColliderQueryStamp = 1;

function packCellKey(cx: number, cz: number): number {
  return ((cx + 512) << 12) ^ (cz + 512);
}

function inferPropPresetForCollision(name?: string, explicit?: PropPresetId): PropPresetId | undefined {
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

export interface WalkInBuildingSpec {
  buildingType: 'tavern' | 'blacksmith' | 'cottage' | 'stoneShrine' | 'scifiBuilding' | 'modernBuilding';
  halfW: number;
  halfD: number;
  doorHalfW: number;
  floorOffset: number;
  wallHeight: number;
  wallThick: number;
}

export function getWalkInBuildingSpec(ent: {
  kind?: string;
  name?: string;
  notes?: string;
  propPreset?: PropPresetId;
  scale?: number;
}): WalkInBuildingSpec | null {
  if (ent.kind && ent.kind !== 'prop') return null;
  const lowerName = (ent.name ?? '').toLowerCase();
  const lowerNotes = (ent.notes ?? '').toLowerCase();
  const s = Math.max(0.65, ent.scale ?? 1);

  if (lowerName.includes('tavern') || lowerName.includes('inn') || lowerNotes.includes('tavern') || ent.propPreset === 'tavern') {
    return {
      buildingType: 'tavern',
      halfW: 7.2 * s,
      halfD: 5.8 * s,
      doorHalfW: 1.35 * s,
      floorOffset: 0.16,
      wallHeight: 6.4 * s,
      wallThick: 0.36 * s,
    };
  }
  if (lowerName.includes('blacksmith') || lowerName.includes('smithy') || lowerName.includes('forge') || lowerNotes.includes('blacksmith')) {
    return {
      buildingType: 'blacksmith',
      halfW: 6.0 * s,
      halfD: 4.8 * s,
      doorHalfW: 1.35 * s,
      floorOffset: 0.16,
      wallHeight: 5.4 * s,
      wallThick: 0.34 * s,
    };
  }
  if (lowerName.includes('scifi') || lowerName.includes('sci-fi') || lowerName.includes('cyber') || lowerName.includes('outpost') || lowerName.includes('command center') || lowerNotes.includes('scifibuilding')) {
    return {
      buildingType: 'scifiBuilding',
      halfW: 6.4 * s,
      halfD: 5.2 * s,
      doorHalfW: 1.4 * s,
      floorOffset: 0.18,
      wallHeight: 5.4 * s,
      wallThick: 0.34 * s,
    };
  }
  if (lowerName.includes('modern') || lowerName.includes('gallery') || lowerName.includes('penthouse') || lowerName.includes('lodge') || lowerNotes.includes('modernbuilding')) {
    return {
      buildingType: 'modernBuilding',
      halfW: 6.4 * s,
      halfD: 5.2 * s,
      doorHalfW: 1.4 * s,
      floorOffset: 0.16,
      wallHeight: 5.4 * s,
      wallThick: 0.34 * s,
    };
  }
  if (lowerName.includes('temple') || lowerName.includes('shrine') || lowerName.includes('sanctum') || lowerNotes.includes('stoneshrine') || lowerNotes.includes('temple')) {
    return {
      buildingType: 'stoneShrine',
      halfW: 5.6 * s,
      halfD: 5.2 * s,
      doorHalfW: 1.5 * s,
      floorOffset: 0.24,
      wallHeight: 5.6 * s,
      wallThick: 0.38 * s,
    };
  }
  if (
    lowerName.includes('cottage') ||
    lowerName.includes('cabin') ||
    lowerName.includes('house') ||
    lowerName.includes('manor') ||
    lowerName.includes('hall') ||
    lowerNotes.includes('cottage') ||
    ent.propPreset === 'cottage'
  ) {
    return {
      buildingType: 'cottage',
      halfW: 5.2 * s,
      halfD: 4.4 * s,
      doorHalfW: 1.25 * s,
      floorOffset: 0.16,
      wallHeight: 4.8 * s,
      wallThick: 0.32 * s,
    };
  }
  return null;
}

export function isRopeBridgeEntity(ent: { kind?: string; name?: string; notes?: string }): boolean {
  if (ent.kind && ent.kind !== 'prop') return false;
  const lowerName = (ent.name ?? '').toLowerCase();
  const lowerNotes = (ent.notes ?? '').toLowerCase();
  return (
    lowerName.includes('rope bridge') ||
    lowerName.includes('slat bridge') ||
    lowerName.includes('broken slat') ||
    lowerNotes.includes('ropebridge')
  );
}


function insertColliderIntoGrid(
  cells: Map<number, LevelCollider[]>,
  col: LevelCollider,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number
): void {
  const cx0 = Math.floor(minX / COLLIDER_CELL_SIZE);
  const cx1 = Math.floor(maxX / COLLIDER_CELL_SIZE);
  const cz0 = Math.floor(minZ / COLLIDER_CELL_SIZE);
  const cz1 = Math.floor(maxZ / COLLIDER_CELL_SIZE);
  for (let cx = cx0; cx <= cx1; cx++) {
    for (let cz = cz0; cz <= cz1; cz++) {
      const key = packCellKey(cx, cz);
      let bucket = cells.get(key);
      if (!bucket) {
        bucket = [];
        cells.set(key, bucket);
      }
      bucket.push(col);
    }
  }
}

function addCircleCollider(
  cells: Map<number, LevelCollider[]>,
  x: number,
  z: number,
  r: number,
  extra?: Partial<Pick<CircleCollider, 'stumpR' | 'treeId' | 'doorId' | 'openOnly' | 'minY' | 'maxY'>>
): void {
  if (r <= 0.01) return;
  const col: CircleCollider = { kind: 'circle', x, z, r, stamp: 0, ...extra };
  insertColliderIntoGrid(cells, col, x - r, x + r, z - r, z + r);
}

function addObbCollider(
  cells: Map<number, LevelCollider[]>,
  x: number,
  z: number,
  yawRad: number,
  hw: number,
  hd: number,
  doorId?: string,
  minY?: number,
  maxY?: number
): void {
  if (hw <= 0.01 || hd <= 0.01) return;
  const cos = Math.cos(yawRad);
  const sin = Math.sin(yawRad);
  const extX = Math.abs(hw * cos) + Math.abs(hd * sin);
  const extZ = Math.abs(hw * sin) + Math.abs(hd * cos);
  const col: ObbCollider = { kind: 'obb', x, z, cos, sin, hw, hd, doorId, minY, maxY, stamp: 0 };
  insertColliderIntoGrid(cells, col, x - extX, x + extX, z - extZ, z + extZ);
}

function buildLevelColliderGrid(level: GameLevel): CachedLevelColliderGrid {
  const env = getEnvironmentType(level);
  const cells = new Map<number, LevelCollider[]>();

  // 1. Open-world scatter obstacles (trees, rocks, bushes, berry bushes, custom GLBs)
  if (env === 'openWorld' && level.terrain?.scatter) {
    const terrain = level.terrain;
    for (const item of terrain.scatter) {
      const size = Math.max(0.25, item.size || 1);
      const y = sampleTerrainHeight(terrain, item.x, item.z);
      const minY =
        item.kind === 'rock' ? IslandTerrain.waterLevel - 0.85 : IslandTerrain.waterLevel + 0.15;
      if (y < minY) continue;

      if (item.kind === 'oak') {
        addCircleCollider(cells, item.x, item.z, 0.48 * size, {
          treeId: item.id,
          stumpR: 0.32 * size,
        });
      } else if (item.kind === 'pine' || item.kind === 'tree') {
        addCircleCollider(cells, item.x, item.z, 0.38 * size, {
          treeId: item.id,
          stumpR: 0.26 * size,
        });
      } else if (item.kind === 'birch') {
        addCircleCollider(cells, item.x, item.z, 0.28 * size, {
          treeId: item.id,
          stumpR: 0.2 * size,
        });
      } else if (item.kind === 'rock') {
        addCircleCollider(cells, item.x, item.z, 0.82 * size);
      } else if (item.kind === 'bush') {
        addCircleCollider(cells, item.x, item.z, 0.72 * size);
      } else if (item.kind === 'berryBush') {
        addCircleCollider(cells, item.x, item.z, 0.64 * size);
      } else if (item.kind === 'custom') {
        addCircleCollider(cells, item.x, item.z, 0.72 * size);
      }
    }
  }

  // 2. Carved Cave Grottos (excluding primary MountainCave which has its own interior collider)
  if (env === 'openWorld' && level.terrain?.caves) {
    for (const cave of level.terrain.caves) {
      if (Math.hypot(cave.x - MountainCave.x, cave.z - MountainCave.z) < 6) continue;
      const s = Math.max(0.35, cave.scale || 1);
      const cos = Math.cos(cave.rotation || 0);
      const sin = Math.sin(cave.rotation || 0);
      const toWorld = (lx: number, lz: number): [number, number] => [
        cave.x + lx * cos + lz * sin,
        cave.z - lx * sin + lz * cos,
      ];
      // Left and right stone entrance pillars
      const [lpX, lpZ] = toWorld(-1.65 * s, 0.15 * s);
      const [rpX, rpZ] = toWorld(1.65 * s, 0.15 * s);
      addCircleCollider(cells, lpX, lpZ, 1.15 * s);
      addCircleCollider(cells, rpX, rpZ, 1.15 * s);
      // Solid back cave wall and curved side shoulders
      const [bwX, bwZ] = toWorld(0, -1.65 * s);
      const [blX, blZ] = toWorld(-1.35 * s, -1.25 * s);
      const [brX, brZ] = toWorld(1.35 * s, -1.25 * s);
      addCircleCollider(cells, bwX, bwZ, 1.65 * s);
      addCircleCollider(cells, blX, blZ, 1.2 * s);
      addCircleCollider(cells, brX, brZ, 1.2 * s);
    }
  }

  // 3. Placed solid entities (trees, buildings, props, locked doors, chests, signs, spawners)
  if (level.entities && level.entities.length > 0) {
    for (const ent of level.entities) {
      const s = Math.max(0.25, ent.scale ?? 1);
      const [wx, wz] = levelBoardToWorld(level, ent.position);
      const yaw = ((ent.rotation ?? 0) * Math.PI) / 180;
      const baseY = sampleLevelHeight(level, wx, wz) + (ent.elevationY ?? 0);

      if (ent.buildingBlock) {
        const shape = ent.buildingBlock.shape;
        const bx = s * Math.max(0.1, Math.min(8, ent.buildingBlock.scaleX ?? 1));
        const by = s * Math.max(0.1, Math.min(8, ent.buildingBlock.scaleY ?? 1));
        const bz = s * Math.max(0.1, Math.min(8, ent.buildingBlock.scaleZ ?? 1));
        if (
          shape === 'floorTile' ||
          shape === 'stairsStraight' ||
          shape === 'porchSteps' ||
          shape === 'beamLarge' ||
          shape === 'beamSmall' ||
          shape === 'plankTrim' ||
          shape === 'trapdoor' ||
          shape === 'wallTorch'
        ) {
          continue; // Walkable surfaces / trim beams / wall sconces
        }
        if (shape === 'wallCube') {
          addObbCollider(cells, wx, wz, yaw, 1.0 * bx, 1.0 * bz, undefined, baseY, baseY + 2.0 * by);
        } else if (shape === 'wallCubeHalf') {
          addObbCollider(cells, wx, wz, yaw, 0.5 * bx, 0.5 * bz, undefined, baseY, baseY + 1.0 * by);
        } else if (shape === 'halfWall') {
          addObbCollider(cells, wx, wz, yaw, 1.0 * bx, 0.35 * bz, undefined, baseY, baseY + 1.0 * by);
        } else if (shape === 'fence') {
          addObbCollider(cells, wx, wz, yaw, 1.0 * bx, 0.2 * bz, undefined, baseY, baseY + 1.0 * by);
        } else if (shape === 'pillar') {
          if (Math.abs(bx - bz) > 0.15) {
            addObbCollider(cells, wx, wz, yaw, 0.42 * bx, 0.42 * bz, undefined, baseY, baseY + 2.0 * by);
          } else {
            addCircleCollider(cells, wx, wz, 0.42 * Math.max(bx, bz), { minY: baseY, maxY: baseY + 2.0 * by });
          }
        } else if (shape === 'windowWall') {
          addObbCollider(cells, wx, wz, yaw, 1.0 * bx, 0.28 * bz, undefined, baseY, baseY + 2.0 * by);
        } else if (shape === 'roofGable') {
          addObbCollider(cells, wx, wz, yaw, 1.0 * bx, 0.26 * bz, undefined, baseY, baseY + 1.35 * by);
        } else if (shape === 'roofAFrame' || shape === 'roofSlope') {
          addObbCollider(cells, wx, wz, yaw, 1.08 * bx, 1.04 * bz, undefined, baseY + 0.1 * by, baseY + 1.38 * by);
        } else if (shape === 'archway') {
          const cos = Math.cos(yaw);
          const sin = Math.sin(yaw);
          addObbCollider(
            cells,
            wx - 0.8 * bx * cos,
            wz + 0.8 * bx * sin,
            yaw,
            0.22 * bx,
            0.36 * bz,
            undefined,
            baseY,
            baseY + 2.2 * by
          );
          addObbCollider(
            cells,
            wx + 0.8 * bx * cos,
            wz - 0.8 * bx * sin,
            yaw,
            0.22 * bx,
            0.36 * bz,
            undefined,
            baseY,
            baseY + 2.2 * by
          );
        } else if (shape === 'stairsSpiral') {
          addCircleCollider(cells, wx, wz, 0.25 * Math.max(bx, bz), { minY: baseY, maxY: baseY + 2.1 * by });
        }
        continue;
      }

      if (ent.kind === 'scenery') {
        const trunkMult = ent.canopyTree?.trunkThickness ?? 1;
        addCircleCollider(cells, wx, wz, 0.45 * s * trunkMult);
      } else if (ent.kind === 'door') {
        // Closed door blocks full archway; once opened, only side stone pillars remain solid
        addObbCollider(cells, wx, wz, yaw, 0.96 * s, 0.26 * s, ent.id, baseY, baseY + 2.2 * s);
        const cos = Math.cos(yaw);
        const sin = Math.sin(yaw);
        addCircleCollider(cells, wx - 0.86 * s * cos, wz + 0.86 * s * sin, 0.2 * s, {
          doorId: ent.id,
          openOnly: true,
          minY: baseY,
          maxY: baseY + 2.2 * s,
        });
        addCircleCollider(cells, wx + 0.86 * s * cos, wz - 0.86 * s * sin, 0.2 * s, {
          doorId: ent.id,
          openOnly: true,
          minY: baseY,
          maxY: baseY + 2.2 * s,
        });
      } else if (ent.kind === 'prop') {
        const lowerName = (ent.name ?? '').toLowerCase();
        const lowerNotes = (ent.notes ?? '').toLowerCase();
        const walkInSpec = getWalkInBuildingSpec(ent);
        if (walkInSpec) {
          const cos = Math.cos(yaw);
          const sin = Math.sin(yaw);
          const toWorld = (lx: number, lz: number): [number, number] => [
            wx + lx * cos + lz * sin,
            wz - lx * sin + lz * cos,
          ];
          const wt = walkInSpec.wallThick * 0.5;
          const hw = walkInSpec.halfW;
          const hd = walkInSpec.halfD;
          const dhw = walkInSpec.doorHalfW;
          const minY = baseY - 0.2;
          const maxY = baseY + walkInSpec.wallHeight;

          // 1. Back wall (lz = -hd)
          const [bx, bz] = toWorld(0, -hd);
          addObbCollider(cells, bx, bz, yaw, hw, wt, undefined, minY, maxY);
          // 2. Left wall (lx = -hw)
          const [lxW, lzW] = toWorld(-hw, 0);
          addObbCollider(cells, lxW, lzW, yaw, wt, hd, undefined, minY, maxY);
          // 3. Right wall (lx = +hw)
          const [rxW, rzW] = toWorld(hw, 0);
          addObbCollider(cells, rxW, rzW, yaw, wt, hd, undefined, minY, maxY);
          // 4. Front-left wall segment (lx from -hw to -dhw at lz = +hd)
          const segHalfW = Math.max(0.3, (hw - dhw) * 0.5);
          const segCenter = dhw + segHalfW;
          const [flx, flz] = toWorld(-segCenter, hd);
          addObbCollider(cells, flx, flz, yaw, segHalfW, wt, undefined, minY, maxY);
          // 5. Front-right wall segment (lx from +dhw to +hw at lz = +hd)
          const [frx, frz] = toWorld(segCenter, hd);
          addObbCollider(cells, frx, frz, yaw, segHalfW, wt, undefined, minY, maxY);
          // 6. Hinged Front Door Leaf OBB (tagged with doorId: ent.id so opening with E unlocks the doorway)
          const [dx, dz] = toWorld(0, hd);
          addObbCollider(cells, dx, dz, yaw, dhw * 0.96, wt * 1.1, ent.id, minY, maxY);

          // 7. Interior solid furniture colliders (leave spacious center floor walkable)
          if (walkInSpec.buildingType === 'tavern') {
            const [barX, barZ] = toWorld(2.2 * s, -2.9 * s);
            addObbCollider(cells, barX, barZ, yaw, 2.5 * s, 0.58 * s, undefined, minY, baseY + 1.5 * s);
            const [fpX, fpZ] = toWorld(-3.2 * s, -4.8 * s);
            addObbCollider(cells, fpX, fpZ, yaw, 1.45 * s, 0.72 * s, undefined, minY, baseY + 3.2 * s);
          } else if (walkInSpec.buildingType === 'blacksmith') {
            const [fgX, fgZ] = toWorld(-2.3 * s, -2.5 * s);
            addObbCollider(cells, fgX, fgZ, yaw, 1.35 * s, 1.15 * s, undefined, minY, baseY + 3.2 * s);
            const [anX, anZ] = toWorld(-0.4 * s, -0.8 * s);
            addCircleCollider(cells, anX, anZ, 0.58 * s);
          }
          continue;
        }

        if (isRopeBridgeEntity(ent)) {
          // Walkable slat bridge deck: add left & right rope handrail colliders so player stays safely on the bridge
          const cos = Math.cos(yaw);
          const sin = Math.sin(yaw);
          const railX = 1.88 * s;
          const halfLen = 6.6 * s;
          for (const side of [-1, 1]) {
            const rx = wx + side * railX * cos;
            const rz = wz - side * railX * sin;
            addObbCollider(cells, rx, rz, yaw, 0.22 * s, halfLen, undefined, baseY - 2.5, baseY + 2.8 * s);
          }
          continue;
        }

        if (
          lowerName.includes('weathered stone') ||
          lowerName.includes('stone path') ||
          lowerNotes.includes('weatheredstone') ||
          lowerNotes.includes('stonepath') ||
          lowerName.includes('chicken') ||
          lowerNotes.includes('chicken') ||
          lowerName.includes('exotic') ||
          lowerName.includes('fern') ||
          lowerNotes.includes('exoticplant')
        ) {
          continue; // Walkable flagstones, small chickens, and soft jungle ferns don't block movement
        }

        if (lowerName.includes('fence') || lowerNotes.includes('fence')) {
          addObbCollider(cells, wx, wz, yaw, 1.15 * s, 0.22 * s, undefined, baseY, baseY + 1.2 * s);
          continue;
        }

        if (lowerName.includes('horse') || lowerNotes.includes('tetheredhorses')) {
          addObbCollider(cells, wx, wz, yaw, 1.45 * s, 0.95 * s, undefined, baseY, baseY + 1.8 * s);
          continue;
        }

        const preset = inferPropPresetForCollision(ent.name, ent.propPreset);
        if (
          preset === 'dock' ||
          preset === 'ramp' ||
          preset === 'flightCube' ||
          preset === 'boostPad'
        ) {
          continue; // Walkable / drivable / collect-through surfaces
        } else if (preset === 'roadBarrier') {
          addObbCollider(cells, wx, wz, yaw, 1.45 * s, 0.34 * s, undefined, baseY, baseY + 1.25 * s);
        } else if (preset === 'checkpointArch') {
          const cos = Math.cos(yaw);
          const sin = Math.sin(yaw);
          addCircleCollider(cells, wx - 3.8 * s * cos, wz + 3.8 * s * sin, 0.28 * s);
          addCircleCollider(cells, wx + 3.8 * s * cos, wz - 3.8 * s * sin, 0.28 * s);
        } else if (preset === 'campfire') {
          addCircleCollider(cells, wx, wz, 0.86 * s);
        } else if (preset === 'craftingBench') {
          addObbCollider(cells, wx, wz, yaw, 1.1 * s, 0.62 * s);
        } else if (preset === 'signpost') {
          addCircleCollider(cells, wx, wz, 0.32 * s);
        } else if (preset === 'savePlinth') {
          addCircleCollider(cells, wx, wz, 0.45 * s);
        } else if ((ent.name ?? '').toLowerCase().includes('crate')) {
          addObbCollider(cells, wx, wz, yaw, 0.44 * s, 0.44 * s);
        } else {
          const customMult = ent.customAssetId ? Math.max(0.5, ent.modelScaleAdjust ?? 1) * 1.55 : 1;
          addCircleCollider(cells, wx, wz, 0.44 * s * customMult);
        }
      } else if (ent.kind === 'treasure') {
        addObbCollider(cells, wx, wz, yaw, 0.45 * s, 0.34 * s);
      } else if (ent.kind === 'sign') {
        addCircleCollider(cells, wx, wz, 0.32 * s);
      } else if (ent.kind === 'light') {
        const isCampfire = inferPropPresetForCollision(ent.name, ent.propPreset) === 'campfire';
        addCircleCollider(cells, wx, wz, (isCampfire ? 0.86 : 0.3) * s);
      } else if (ent.kind === 'spawner') {
        addCircleCollider(cells, wx, wz, 0.65 * s);
      }
    }
  }

  return {
    env,
    scatterRef: level.terrain?.scatter,
    cavesRef: level.terrain?.caves,
    entitiesRef: level.entities,
    cells,
  };
}

function getLevelColliderGrid(level: GameLevel): Map<number, LevelCollider[]> {
  const env = getEnvironmentType(level);
  const cached = levelColliderCache.get(level);
  if (
    cached &&
    cached.env === env &&
    cached.scatterRef === level.terrain?.scatter &&
    cached.cavesRef === level.terrain?.caves &&
    cached.entitiesRef === level.entities
  ) {
    return cached.cells;
  }
  const built = buildLevelColliderGrid(level);
  levelColliderCache.set(level, built);
  return built.cells;
}

function resolveGridObstacles(
  grid: Map<number, LevelCollider[]>,
  x: number,
  z: number,
  radius: number,
  context?: CollisionFilterContext
): [number, number] {
  if (grid.size === 0) return [x, z];
  let nx = x;
  let nz = z;
  const searchPad = radius + 4.0;

  for (let pass = 0; pass < 2; pass++) {
    const queryStamp = nextColliderQueryStamp++;
    const cx0 = Math.floor((nx - searchPad) / COLLIDER_CELL_SIZE);
    const cx1 = Math.floor((nx + searchPad) / COLLIDER_CELL_SIZE);
    const cz0 = Math.floor((nz - searchPad) / COLLIDER_CELL_SIZE);
    const cz1 = Math.floor((nz + searchPad) / COLLIDER_CELL_SIZE);

    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cz = cz0; cz <= cz1; cz++) {
        const bucket = grid.get(packCellKey(cx, cz));
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          const col = bucket[i];
          if (col.stamp === queryStamp) continue;
          col.stamp = queryStamp;

          if (col.doorId) {
            const isOpen = context?.openedDoorIds?.has(col.doorId) ?? false;
            if (col.kind === 'obb' && isOpen) continue;
            if (col.kind === 'circle' && col.openOnly && !isOpen) continue;
          }

          if (context?.actorY !== undefined && col.minY !== undefined && col.maxY !== undefined) {
            if (context.actorY >= col.maxY - 0.15 || context.actorY + 1.55 <= col.minY) {
              continue;
            }
          }

          if (col.kind === 'circle') {
            const rEff =
              col.treeId && col.stumpR !== undefined && context?.choppedTreeIds?.has(col.treeId)
                ? col.stumpR
                : col.r;
            const minDist = rEff + radius;
            const dx = nx - col.x;
            const dz = nz - col.z;
            const distSq = dx * dx + dz * dz;
            if (distSq < minDist * minDist) {
              if (distSq > 0.00001) {
                const dist = Math.sqrt(distSq);
                const push = minDist - dist;
                nx += (dx / dist) * push;
                nz += (dz / dist) * push;
              } else {
                nx += minDist;
              }
            }
          } else {
            // Oriented Bounding Box in entity local XZ space
            const dxW = nx - col.x;
            const dzW = nz - col.z;
            const lx = dxW * col.cos - dzW * col.sin;
            const lz = dxW * col.sin + dzW * col.cos;

            const clampedX = Math.max(-col.hw, Math.min(lx, col.hw));
            const clampedZ = Math.max(-col.hd, Math.min(lz, col.hd));
            const diffX = lx - clampedX;
            const diffZ = lz - clampedZ;
            const distSq = diffX * diffX + diffZ * diffZ;

            if (distSq < radius * radius) {
              let nextLx = lx;
              let nextLz = lz;
              if (distSq > 0.00001) {
                const dist = Math.sqrt(distSq);
                const push = radius - dist;
                nextLx += (diffX / dist) * push;
                nextLz += (diffZ / dist) * push;
              } else {
                const penX = col.hw - Math.abs(lx);
                const penZ = col.hd - Math.abs(lz);
                if (penX < penZ) {
                  nextLx = (lx >= 0 ? 1 : -1) * (col.hw + radius);
                } else {
                  nextLz = (lz >= 0 ? 1 : -1) * (col.hd + radius);
                }
              }
              nx = col.x + nextLx * col.cos + nextLz * col.sin;
              nz = col.z - nextLx * col.sin + nextLz * col.cos;
            }
          }
        }
      }
    }
  }

  return [nx, nz];
}

export function resolveHorizontalCollision(
  level: GameLevel,
  x: number,
  z: number,
  radius = 0.65,
  allowOffshore = false,
  context?: CollisionFilterContext
): [number, number] {
  const env = getEnvironmentType(level);
  let nx = x;
  let nz = z;

  if (env === 'sideScroller') {
    nx = Math.max(-54.5, Math.min(54.5, nx));
    nz = Math.max(-2.6, Math.min(2.6, nz));
    return [nx, nz];
  }

  const obstacleGrid = getLevelColliderGrid(level);

  if (env === 'openWorld') {
    const dist = Math.hypot(nx, nz);
    const maxR =
      allowOffshore && level.canSwim !== false
        ? IslandTerrain.shoreRadius + 16
        : IslandTerrain.radius * 0.97;
    if (dist > maxR && dist > 0.001) {
      nx = (nx / dist) * maxR;
      nz = (nz / dist) * maxR;
    }

    // MountainCave interior & entrance pillar collision (only when terrain actually contains the main MountainCave)
    if (terrainHasMainMountainCave(level.terrain)) {
      const local = toMountainCaveLocal(nx, nz);
      let { lx, lz } = local;
      if (lz <= 2.4 && lz >= -MountainCave.depth - 2.4 && Math.abs(lx) <= MountainCave.chamberHalfWidth + 2.8) {
        // Entrance arch flanking pillars at lz in [-1.2, +1.5], |lx| >= mouthHalfWidth
        if (lz > -1.35 && lz < 1.55) {
          const minOpenX = MountainCave.mouthHalfWidth - radius * 0.6;
          const outerPillarX = MountainCave.chamberHalfWidth + 1.8;
          if (Math.abs(lx) > minOpenX && Math.abs(lx) < outerPillarX) {
            if (Math.abs(lx) < (minOpenX + outerPillarX) * 0.5) {
              lx = Math.sign(lx || 1) * minOpenX;
            } else {
              lx = Math.sign(lx || 1) * outerPillarX;
            }
          }
        } else if (lz <= -1.35) {
          // Inside the hollow cavern chamber: keep actor smoothly inside the curved stone walls
          const wallHalfW = MountainCave.chamberHalfWidth - 0.85 - radius;
          const backZ = -MountainCave.depth + 1.1 + radius;
          if (Math.abs(lx) < MountainCave.chamberHalfWidth + 0.8 && lz > -MountainCave.depth - 0.6) {
            // Rounded rear apse taper
            const rearT = Math.max(0, (-lz - (MountainCave.depth - 4.4)) / 4.4);
            const curHalfW = Math.max(1.8, wallHalfW * Math.sqrt(Math.max(0.15, 1 - rearT * rearT * 0.68)));
            if (Math.abs(lx) > curHalfW) {
              lx = Math.sign(lx) * curHalfW;
            }
            if (lz < backZ) {
              lz = backZ;
            }
          }
        }
        const [wx, wz] = fromMountainCaveLocal(lx, lz);
        nx = wx;
        nz = wz;
      }
    }

    return resolveGridObstacles(obstacleGrid, nx, nz, radius, context);
  }

  const boxes = getLevelWallBoxes(level);
  for (let pass = 0; pass < 2; pass++) {
    for (const box of boxes) {
      const closestX = Math.max(box.minX, Math.min(nx, box.maxX));
      const closestZ = Math.max(box.minZ, Math.min(nz, box.maxZ));
      const dx = nx - closestX;
      const dz = nz - closestZ;
      const distSq = dx * dx + dz * dz;
      if (distSq < radius * radius) {
        if (distSq > 0.00001) {
          const dist = Math.sqrt(distSq);
          const push = radius - dist;
          nx += (dx / dist) * push;
          nz += (dz / dist) * push;
        } else {
          // Inside box: push out along nearest edge
          const leftPen = Math.abs(nx - box.minX);
          const rightPen = Math.abs(box.maxX - nx);
          const backPen = Math.abs(nz - box.minZ);
          const frontPen = Math.abs(box.maxZ - nz);
          const minPen = Math.min(leftPen, rightPen, backPen, frontPen);
          if (minPen === leftPen) nx = box.minX - radius;
          else if (minPen === rightPen) nx = box.maxX + radius;
          else if (minPen === backPen) nz = box.minZ - radius;
          else nz = box.maxZ + radius;
        }
      }
    }
  }
  return resolveGridObstacles(obstacleGrid, nx, nz, radius, context);
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function terrainSlopeAt(x: number, z: number, r = 0.75): number {
  const h0 = IslandTerrain.heightAt(x, z);
  const h1 = IslandTerrain.heightAt(x + r, z);
  const h2 = IslandTerrain.heightAt(x - r, z);
  const h3 = IslandTerrain.heightAt(x, z + r);
  const h4 = IslandTerrain.heightAt(x, z - r);
  return Math.max(h0, h1, h2, h3, h4) - Math.min(h0, h1, h2, h3, h4);
}

export function evaluateVistaHeight(
  x: number,
  z: number,
  innerRadius: number,
  preset: VistaPresetId,
  mountainScale = 1
): number {
  if (preset === 'none') return IslandTerrain.waterLevel - 4.0;
  const dist = Math.hypot(x, z);
  if (dist <= innerRadius) return IslandTerrain.waterLevel - 3.2;

  const mtnScale = Math.max(0, Math.min(2.2, mountainScale));
  const hillScale = 0.28 + 0.72 * Math.min(1.4, mtnScale);

  const angle = Math.atan2(z, x);
  const span = Math.max(1, dist - innerRadius);
  const shoreRamp = Math.min(1, span / 26);
  const shoreSmooth = shoreRamp * shoreRamp * (3 - 2 * shoreRamp);

  // Rolling forested foothills in near ring (innerR..innerR+120), rising into tall peaks beyond
  const foothillWaves =
    Math.sin(angle * 5 + 0.6) * 2.6 +
    Math.cos(angle * 9 - 1.1) * 1.8 +
    Math.sin(x * 0.022) * Math.cos(z * 0.022) * 3.4;

  const ridgeMask = Math.max(0, Math.min(1, (span - 45) / 145));
  const mtnWaves =
    (Math.abs(Math.sin(angle * 3.5 + 0.4)) * 28 +
      Math.abs(Math.cos(angle * 7.0 - 0.8)) * 18 +
      Math.abs(Math.sin(angle * 13.0 + dist * 0.014)) * 11) *
    mtnScale;

  if (preset === 'coastalArchipelago') {
    const islandLobes = Math.sin(angle * 6 + 0.3) * Math.cos(dist * 0.022) + 0.15;
    if (islandLobes < 0) {
      return IslandTerrain.waterLevel - 2.4 + islandLobes * 2.0;
    }
    const base =
      IslandTerrain.waterLevel +
      1.2 +
      islandLobes * (4.5 + 10.0 * Math.min(1.5, mtnScale)) +
      mtnWaves * ridgeMask * 0.55;
    return (IslandTerrain.waterLevel - 2.8) * (1 - shoreSmooth) + base * shoreSmooth;
  }

  if (preset === 'mistyHills') {
    const hillBase =
      IslandTerrain.waterLevel +
      2.0 +
      Math.max(0, foothillWaves + 3.2) * 1.35 * hillScale +
      mtnWaves * ridgeMask * 0.48;
    return (IslandTerrain.waterLevel - 2.8) * (1 - shoreSmooth) + hillBase * shoreSmooth;
  }

  if (preset === 'volcanicPeaks') {
    const crags =
      IslandTerrain.waterLevel +
      1.8 +
      Math.max(0, foothillWaves + 2.5) * hillScale +
      Math.pow(ridgeMask, 0.88) *
        (mtnWaves * 1.38 + Math.abs(Math.sin(angle * 11)) * 14 * mtnScale);
    return (IslandTerrain.waterLevel - 2.8) * (1 - shoreSmooth) + crags * shoreSmooth;
  }

  // Default: alpineValley — lush forested valley foothills + towering distant alpine range
  const valleyBase =
    IslandTerrain.waterLevel +
    2.2 +
    Math.max(0, foothillWaves + 3.0) * 1.2 * hillScale +
    ridgeMask * ridgeMask * (mtnWaves * 1.28 + 8 * mtnScale);
  return (IslandTerrain.waterLevel - 2.8) * (1 - shoreSmooth) + valleyBase * shoreSmooth;
}

export function defaultScatter(): ScatterItem[] {
  const items: ScatterItem[] = [];
  const treeKinds: ('pine' | 'oak' | 'birch')[] = ['pine', 'oak', 'birch'];

  // 1. Dense multi-species forest trees across the 312m forest island (Pine, Oak, Birch)
  for (let index = 0; index < 520; index++) {
    const angle = index * 2.39996; // Golden angle spiral for uniform organic forest spread
    const distance = 9 + Math.sqrt((index + 1) / 520) * (IslandTerrain.radius - 16);
    if (distance >= IslandTerrain.radius * 0.93) continue;
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    if (TerrainPaths.distanceTo(x, z) <= 4.3) continue;
    if (IslandRiver.distanceTo(x, z) <= 8.2) continue;
    if (isNearMountainCaveEntrance(x, z)) continue;
    if (Math.hypot(x - TerrainPaths.start[0], z - TerrainPaths.start[1]) < 8.5) continue;
    if (Math.hypot(x - TerrainPaths.end[0], z - TerrainPaths.end[1]) < 8.5) continue;
    const h = IslandTerrain.heightAt(x, z);
    if (h < IslandTerrain.waterLevel + 0.5) continue;

    // Grove clustering via spatial trig so pine, oak, and birch feel natural
    const groveNoise = Math.sin(x * 0.032) + Math.cos(z * 0.032);
    const kind: 'pine' | 'oak' | 'birch' =
      groveNoise > 0.45
        ? index % 4 === 0
          ? 'birch'
          : 'pine'
        : groveNoise < -0.45
        ? index % 4 === 0
          ? 'birch'
          : 'oak'
        : treeKinds[index % 3];

    items.push({
      id: uid(),
      kind,
      x,
      z,
      size: 0.95 + (index % 5) * 0.16,
      rotation: (index * 1.37) % (Math.PI * 2),
    });
  }

  // 2. Trailside grass drifts, flanking rocks & wildflowers (natural irregular spacing along trail edges)
  const scatterRand = (n: number): number => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return s - Math.floor(s);
  };
  for (let i = 4; i < TerrainPaths.samples.length - 4; i += 2) {
    const s = TerrainPaths.samples[i];
    if (IslandRiver.distanceTo(s.x, s.z) < 8.5) continue;
    if (isNearMountainCaveEntrance(s.x, s.z)) continue;
    const nx = -s.tz;
    const nz = s.tx;
    for (const side of [-1, 1]) {
      const gate = scatterRand(i * 13.7 + side * 41.3);
      if (gate > 0.34) {
        const tuftCount = gate > 0.82 ? 2 : 1;
        for (let t = 0; t < tuftCount; t++) {
          const r1 = scatterRand(i * 19.3 + side * 7.1 + t * 53.9);
          const r2 = scatterRand(i * 31.1 + side * 11.7 + t * 29.3);
          const grassOffset = 2.05 + r1 * 1.95;
          const alongShift = (r2 - 0.5) * 1.8;
          const gx = s.x + nx * side * grassOffset + s.tx * alongShift;
          const gz = s.z + nz * side * grassOffset + s.tz * alongShift;
          if (Math.hypot(gx, gz) < IslandTerrain.radius * 0.94) {
            items.push({
              id: uid(),
              kind: i % 8 === 0 && t === 0 ? 'bush' : 'tallGrass',
              x: gx,
              z: gz,
              size: 0.72 + r2 * 0.62,
              rotation: r1 * Math.PI * 2,
            });
          }
        }
      }

      if (i % 5 === 0) {
        const rockOffset = 2.65 + (i % 3) * 0.38;
        const rx = s.x + nx * side * rockOffset;
        const rz = s.z + nz * side * rockOffset;
        if (Math.hypot(rx, rz) < IslandTerrain.radius * 0.94) {
          items.push({
            id: uid(),
            kind: 'rock',
            x: rx,
            z: rz,
            size: 0.72 + ((i * 3 + side) % 4) * 0.18,
            rotation: i * 1.1,
          });
        }
      }

      if (i % 6 === 2) {
        const fx = s.x + nx * side * 3.1;
        const fz = s.z + nz * side * 3.1;
        if (Math.hypot(fx, fz) < IslandTerrain.radius * 0.94 && terrainSlopeAt(fx, fz, 0.65) < 0.36) {
          items.push({
            id: uid(),
            kind: 'flower',
            x: fx,
            z: fz,
            size: 0.9 + (i % 3) * 0.2,
            rotation: i * 0.6,
          });
        }
      }
    }
  }

  // 3. Riverbank reeds, cattails & mossy river rocks along both banks of the recessed river
  for (let i = 6; i < IslandRiver.samples.length - 6; i += 2) {
    const r = IslandRiver.samples[i];
    if (Math.hypot(r.x, r.z) > IslandTerrain.radius * 0.92) continue;
    if (Math.hypot(r.x - RiverCrossing.x, r.z - RiverCrossing.z) < 5.5) continue;
    const nx = -r.tz;
    const nz = r.tx;

    for (const side of [-1, 1]) {
      const edgeDist = 4.2 + ((i + (side > 0 ? 2 : 0)) % 4) * 0.42;
      const px = r.x + nx * side * edgeDist;
      const pz = r.z + nz * side * edgeDist;

      // Cattails & Reeds hugging shallow water's edge
      items.push({
        id: uid(),
        kind: (i + (side > 0 ? 1 : 0)) % 3 === 0 ? 'cattail' : 'reed',
        x: px,
        z: pz,
        size: 0.92 + (i % 4) * 0.16,
        rotation: (i * 1.7 + side) % (Math.PI * 2),
      });

      // Secondary cluster slightly up the bank
      if (i % 4 === 0) {
        items.push({
          id: uid(),
          kind: i % 8 === 0 ? 'cattail' : 'reed',
          x: r.x + nx * side * (edgeDist + 1.1),
          z: r.z + nz * side * (edgeDist + 1.1),
          size: 0.88 + (i % 3) * 0.14,
          rotation: (i * 0.5) % (Math.PI * 2),
        });
      }

      // Riverbank boulders & stones
      if (i % 6 === 0) {
        items.push({
          id: uid(),
          kind: 'rock',
          x: r.x + nx * side * (5.2 + (i % 3) * 0.5),
          z: r.z + nz * side * (5.2 + (i % 3) * 0.5),
          size: 0.85 + (i % 4) * 0.25,
          rotation: (i * 2.1) % (Math.PI * 2),
        });
      }
    }
  }

  // 4. Deep-woods rocks & wildflower glades (ensure wildflowers only sprout on flat clearings)
  for (let i = 0; i < 80; i++) {
    const angle = i * 1.618 * Math.PI * 2;
    const dist = 18 + ((i * 29) % (IslandTerrain.radius - 26));
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    if (IslandRiver.distanceTo(x, z) < 9 || TerrainPaths.distanceTo(x, z) < 4) continue;
    if (isNearMountainCaveEntrance(x, z)) continue;
    const isFlower = i % 2 !== 0;
    if (isFlower && terrainSlopeAt(x, z, 0.8) > 0.34) continue;
    items.push({
      id: uid(),
      kind: isFlower ? 'flower' : 'rock',
      x,
      z,
      size: 0.9 + (i % 3) * 0.2,
      rotation: i * 0.7,
    });
  }

  // 5. Lush ground cover across meadows, forest floor, trail margins & mossy hollows
  items.push(...generateLushGroundFlora());

  return items;
}

/**
 * Generates varied, naturally clustered ground vegetation (meadow grass drifts, leafy bushes,
 * berry/flowering shrubs, woodland ferns, broadleaf plants, forest mushrooms, and wildflower clusters).
 */
export function generateLushGroundFlora(): ScatterItem[] {
  const items: ScatterItem[] = [];

  const floraRand = (seed: number): number => {
    const s = Math.sin(seed * 91.3458 + 47.231) * 47453.5453;
    return s - Math.floor(s);
  };

  const isValidGround = (x: number, z: number, minTrailDist: number, minRiverDist = 6.6): boolean => {
    const d = Math.hypot(x, z);
    if (d >= IslandTerrain.radius * 0.92) return false;
    if (TerrainPaths.distanceTo(x, z) < minTrailDist) return false;
    if (IslandRiver.distanceTo(x, z) < minRiverDist) return false;
    if (isNearMountainCaveEntrance(x, z)) return false;
    if (Math.hypot(x - TerrainPaths.start[0], z - TerrainPaths.start[1]) < 4.2) return false;
    if (Math.hypot(x - TerrainPaths.end[0], z - TerrainPaths.end[1]) < 5.5) return false;
    const h = IslandTerrain.heightAt(x, z);
    if (h < IslandTerrain.waterLevel + 0.38 || h > 10.6) return false;
    return true;
  };

  // A. Organic meadow & forest grass drifts (irregular multi-tuft clusters + open glades)
  for (let i = 0; i < 110; i++) {
    const rAng = floraRand(i * 1.37 + 11.2);
    const rDist = floraRand(i * 2.71 + 23.4);
    const angle = rAng * Math.PI * 2;
    const dist = 6 + Math.sqrt(0.06 + rDist * 0.94) * (IslandTerrain.radius - 14);
    const cx = Math.cos(angle) * dist;
    const cz = Math.sin(angle) * dist;
    if (!isValidGround(cx, cz, 2.55, 6.2)) continue;

    // Gate drifts by organic meadow patch field so thickets & clearings alternate naturally
    const gladeField = (organicMossPatch(cx * 1.15, cz * 1.15) + 1) * 0.5;
    if (gladeField + floraRand(i * 3.19) * 0.35 < 0.42) continue;

    const clusterSize = 1 + Math.floor(floraRand(i * 5.43 + 7.1) * 5); // 1..5 irregular tufts
    for (let k = 0; k < clusterSize; k++) {
      const subAng = floraRand(i * 17.1 + k * 41.3) * Math.PI * 2;
      const subR = k === 0 ? floraRand(i * 7.7) * 0.45 : 0.45 + floraRand(i * 29.3 + k * 13.7) * 2.65;
      const gx = cx + Math.cos(subAng) * subR;
      const gz = cz + Math.sin(subAng) * subR;
      if (!isValidGround(gx, gz, 2.35, 6.0)) continue;
      items.push({
        id: uid(),
        kind: 'tallGrass',
        x: gx,
        z: gz,
        size: 0.68 + floraRand(i * 11.9 + k * 19.7) * 0.72,
        rotation: floraRand(i * 23.1 + k * 37.9) * Math.PI * 2,
      });
    }
  }

  // B. Leafy woodland bushes & berry/flowering shrubs scattered in irregular glade pockets
  for (let i = 0; i < 290; i++) {
    const rA = floraRand(i * 3.13 + 101.5);
    const rD = floraRand(i * 4.79 + 202.3);
    const angle = rA * Math.PI * 2;
    const dist = 8 + Math.sqrt(rD) * (IslandTerrain.radius - 16);
    const bx = Math.cos(angle) * dist;
    const bz = Math.sin(angle) * dist;
    if (!isValidGround(bx, bz, 3.45, 7.2)) continue;
    if (terrainSlopeAt(bx, bz, 0.85) > 0.55) continue;

    const isBerry = floraRand(i * 7.3 + 5.1) < 0.32;
    items.push({
      id: uid(),
      kind: isBerry ? 'berryBush' : 'bush',
      x: bx,
      z: bz,
      size: 0.76 + floraRand(i * 9.7 + 3.3) * 0.66,
      rotation: floraRand(i * 13.1) * Math.PI * 2,
    });
  }

  // C. Woodland ferns clustered in damp hollows & shaded groves
  for (let i = 0; i < 240; i++) {
    const angle = floraRand(i * 5.21 + 303.1) * Math.PI * 2;
    const dist = 7 + Math.sqrt(floraRand(i * 6.43 + 404.7)) * (IslandTerrain.radius - 15);
    const fx = Math.cos(angle) * dist;
    const fz = Math.sin(angle) * dist;
    if (!isValidGround(fx, fz, 2.7, 5.8)) continue;
    if (terrainSlopeAt(fx, fz, 0.75) > 0.52) continue;

    const clumpN = floraRand(i * 8.11) > 0.68 ? 2 : 1;
    for (let k = 0; k < clumpN; k++) {
      const ox = k === 0 ? 0 : (floraRand(i * 15.7 + k) - 0.5) * 2.1;
      const oz = k === 0 ? 0 : (floraRand(i * 21.3 + k) - 0.5) * 2.1;
      if (!isValidGround(fx + ox, fz + oz, 2.6, 5.7)) continue;
      items.push({
        id: uid(),
        kind: 'fern',
        x: fx + ox,
        z: fz + oz,
        size: 0.76 + floraRand(i * 11.3 + k * 4.9) * 0.62,
        rotation: floraRand(i * 19.9 + k * 7.3) * Math.PI * 2,
      });
    }
  }

  // D. Broadleaf woodland plants along forest floor & shaded banks
  for (let i = 0; i < 200; i++) {
    const angle = floraRand(i * 7.37 + 505.9) * Math.PI * 2;
    const dist = 6 + Math.sqrt(floraRand(i * 8.53 + 606.2)) * (IslandTerrain.radius - 15);
    const px = Math.cos(angle) * dist;
    const pz = Math.sin(angle) * dist;
    if (!isValidGround(px, pz, 2.55, 6.2)) continue;
    if (terrainSlopeAt(px, pz, 0.75) > 0.45) continue;

    items.push({
      id: uid(),
      kind: 'broadleaf',
      x: px,
      z: pz,
      size: 0.76 + floraRand(i * 14.3) * 0.64,
      rotation: floraRand(i * 16.9) * Math.PI * 2,
    });
  }

  // E. Forest floor mushroom clusters in shady mossy hollows
  for (let i = 0; i < 120; i++) {
    const angle = floraRand(i * 9.17 + 707.4) * Math.PI * 2;
    const dist = 9 + Math.sqrt(floraRand(i * 10.31 + 808.6)) * (IslandTerrain.radius - 18);
    const mx = Math.cos(angle) * dist;
    const mz = Math.sin(angle) * dist;
    if (!isValidGround(mx, mz, 2.9, 6.4)) continue;
    if (terrainSlopeAt(mx, mz, 0.7) > 0.36) continue;

    items.push({
      id: uid(),
      kind: 'mushroom',
      x: mx,
      z: mz,
      size: 0.78 + floraRand(i * 18.1) * 0.56,
      rotation: floraRand(i * 22.7) * Math.PI * 2,
    });
  }

  // F. Sunlit wildflower meadow drifts (irregular 1–4 bloom clusters on gentle clearings)
  for (let i = 0; i < 64; i++) {
    const angle = floraRand(i * 11.41 + 909.8) * Math.PI * 2;
    const dist = 10 + Math.sqrt(floraRand(i * 12.67 + 1010.3)) * (IslandTerrain.radius - 18);
    const wx = Math.cos(angle) * dist;
    const wz = Math.sin(angle) * dist;
    if (!isValidGround(wx, wz, 2.7, 7.0)) continue;
    if (terrainSlopeAt(wx, wz, 0.75) > 0.32) continue;

    const bloomCount = 1 + Math.floor(floraRand(i * 19.1) * 3);
    for (let k = 0; k < bloomCount; k++) {
      const ang = floraRand(i * 27.3 + k * 14.9) * Math.PI * 2;
      const rad = k === 0 ? 0 : 0.45 + floraRand(i * 31.7 + k * 9.1) * 1.45;
      const fx = wx + Math.cos(ang) * rad;
      const fz = wz + Math.sin(ang) * rad;
      if (!isValidGround(fx, fz, 2.6, 6.8)) continue;
      items.push({
        id: uid(),
        kind: 'flower',
        x: fx,
        z: fz,
        size: 0.78 + floraRand(i * 35.1 + k * 5.7) * 0.52,
        rotation: floraRand(i * 41.3 + k * 8.3) * Math.PI * 2,
      });
    }
  }

  // G. Irregular trail-margin flora pockets (skipped randomly so edges breathe naturally)
  for (let i = 6; i < TerrainPaths.samples.length - 6; i += 3) {
    if (floraRand(i * 21.7 + 5.5) < 0.45) continue;
    const s = TerrainPaths.samples[i];
    if (IslandRiver.distanceTo(s.x, s.z) < 8.5) continue;
    if (isNearMountainCaveEntrance(s.x, s.z)) continue;
    const nx = -s.tz;
    const nz = s.tx;
    const side = floraRand(i * 13.9) > 0.5 ? 1 : -1;
    const offset = 2.9 + floraRand(i * 17.3) * 1.85;
    const along = (floraRand(i * 23.9) - 0.5) * 2.2;
    const tx = s.x + nx * side * offset + s.tx * along;
    const tz = s.z + nz * side * offset + s.tz * along;
    if (!isValidGround(tx, tz, 2.5, 6.8)) continue;
    if (terrainSlopeAt(tx, tz, 0.75) > 0.48) continue;

    const rKind = floraRand(i * 29.1);
    const kind: ScatterItem['kind'] =
      rKind < 0.16
        ? 'berryBush'
        : rKind < 0.34
        ? 'fern'
        : rKind < 0.5
        ? 'broadleaf'
        : rKind < 0.64
        ? 'bush'
        : 'tallGrass';
    items.push({
      id: uid(),
      kind,
      x: tx,
      z: tz,
      size: 0.76 + floraRand(i * 33.7) * 0.58,
      rotation: floraRand(i * 39.3) * Math.PI * 2,
    });
  }

  return items;
}

export function applyLushGroundFloraToTerrain(terrain: TerrainData): TerrainData {
  const alreadyHasFlora = terrain.scatter.some(
    (s) => s.kind === 'fern' || s.kind === 'berryBush' || s.kind === 'broadleaf' || s.kind === 'mushroom'
  );
  if (alreadyHasFlora) return terrain;
  return {
    ...terrain,
    scatter: [...terrain.scatter, ...generateLushGroundFlora()],
    revision: (terrain.revision ?? 1) + 1,
  };
}

function organicMossPatch(vx: number, vz: number): number {
  // Domain-warped multi-octave trigonometric field: completely irregular, organic woodland glades
  const wx = vx + Math.sin(vz * 0.043 + 1.2) * 14.5 + Math.cos(vx * 0.029 - 0.8) * 9.5;
  const wz = vz + Math.cos(vx * 0.039 + 2.1) * 14.5 + Math.sin(vz * 0.031 + 0.6) * 9.5;
  const n1 = Math.sin(wx * 0.052 + 0.4) * Math.cos(wz * 0.048 - 0.9);
  const n2 = Math.sin(wx * 0.097 - wz * 0.078 + 1.7) * 0.48;
  const n3 = Math.cos(wx * 0.068 + wz * 0.118 - 1.2) * 0.34;
  return (n1 + n2 + n3) / 1.82; // roughly [-1, 1]
}

export function isOrganicMossPoint(vx: number, vz: number, rDist: number, dist: number, worldRadius: number): boolean {
  if (dist >= worldRadius * 0.86) return false;
  const patch = organicMossPatch(vx, vz);
  const riverBand = 9.2 + patch * 3.6;
  return rDist < riverBand || patch > 0.34;
}

export function smoothOrganicMossLayers(terrain: TerrainData): TerrainData {
  const size = terrain.size;
  const width = size + 1;
  if (terrain.layers.length !== width * width) return terrain;
  const worldRadius = IslandTerrain.radius;
  const step = (2 * worldRadius) / size;
  const nextLayers = terrain.layers.slice();
  let changed = false;

  for (let row = 0; row < width; row++) {
    for (let col = 0; col < width; col++) {
      const idx = row * width + col;
      const cur = nextLayers[idx];
      // Preserve custom dirt, sand, rock, snow, cobble — only replace old striped grass/moss
      if (cur !== 0 && cur !== 4) continue;
      const vx = -worldRadius + col * step;
      const vz = -worldRadius + row * step;
      const dist = Math.hypot(vx, vz);
      const rDist = IslandRiver.distanceTo(vx, vz);
      const desired = isOrganicMossPoint(vx, vz, rDist, dist, worldRadius) ? 4 : 0;
      if (desired !== cur) {
        nextLayers[idx] = desired;
        changed = true;
      }
    }
  }

  if (!changed) return terrain;
  return {
    ...terrain,
    layers: nextLayers,
    revision: (terrain.revision ?? 1) + 1,
  };
}

export function applyMountainCaveToTerrain(terrain: TerrainData): TerrainData {
  const size = terrain.size;
  const width = size + 1;
  if (terrain.heights.length !== width * width || terrain.layers.length !== width * width) {
    return terrain;
  }
  const worldRadius = IslandTerrain.radius;
  const step = (2 * worldRadius) / size;
  const nextHeights = terrain.heights.slice();
  const nextLayers = terrain.layers.slice();

  // Re-evaluate heights around the mountain behind the cave + flatten cave floor & mouth approach
  for (let row = 0; row < width; row++) {
    for (let col = 0; col < width; col++) {
      const vx = -worldRadius + col * step;
      const vz = -worldRadius + row * step;
      const idx = row * width + col;
      const { lx, lz } = toMountainCaveLocal(vx, vz);

      // Enhance mountain silhouette behind the cave and carve flat entrance/chamber floor
      const mtnDist = Math.hypot((vx + 74) / 36, (vz - 49) / 32);
      const inCaveZone =
        lz >= -MountainCave.depth - 6 && lz <= 10.5 && Math.abs(lx) <= MountainCave.chamberHalfWidth + 7.5;

      if (mtnDist < 1.05 || inCaveZone) {
        nextHeights[idx] = Math.round(IslandTerrain.heightAt(vx, vz) * 1000) / 1000;
      }

      if (lz >= -MountainCave.depth - 1.5 && lz <= 4.2 && Math.abs(lx) <= MountainCave.chamberHalfWidth + 1.2) {
        nextLayers[idx] = lz < 0.8 ? 2 : 6; // dark rock floor inside, worn dirt apron at mouth
      }
    }
  }

  // Clear scatter trees/rocks from blocking the cave mouth or poking through the cave interior
  const nextScatter = terrain.scatter.filter((s) => !isNearMountainCaveEntrance(s.x, s.z));

  const existingCaves = terrain.caves ?? [];
  const hasMountainCave = existingCaves.some(
    (c) => Math.hypot(c.x - MountainCave.x, c.z - MountainCave.z) < 6
  );
  const nextCaves = hasMountainCave
    ? existingCaves
    : [
        {
          id: uid(),
          x: MountainCave.x,
          z: MountainCave.z,
          rotation: MountainCave.yaw,
          scale: 1.0,
        },
        ...existingCaves.filter((c) => Math.hypot(c.x + 74, c.z - 48) > 12),
      ];

  return {
    ...terrain,
    heights: nextHeights,
    layers: nextLayers,
    weathering:
      terrain.weathering && terrain.weathering.length === width * width
        ? terrain.weathering
        : undefined,
    scatter: nextScatter,
    caves: nextCaves,
    revision: (terrain.revision ?? 1) + 1,
  };
}

export function createInitialTerrain(): TerrainData {
  const size = IslandTerrain.gridSize;
  const width = size + 1;
  const worldRadius = IslandTerrain.radius;
  const step = (2 * worldRadius) / size;
  const heights: number[] = new Array(width * width);
  const layers: number[] = new Array(width * width);

  for (let row = 0; row < width; row++) {
    for (let col = 0; col < width; col++) {
      const vx = -worldRadius + col * step;
      const vz = -worldRadius + row * step;
      const idx = row * width + col;
      const h = Math.round(IslandTerrain.heightAt(vx, vz) * 1000) / 1000;
      heights[idx] = h;
      const dist = Math.hypot(vx, vz);
      const rDist = IslandRiver.distanceTo(vx, vz);
      const tDist = TerrainPaths.distanceTo(vx, vz);
      const { lx, lz } = toMountainCaveLocal(vx, vz);

      if (lz >= -MountainCave.depth - 1.5 && lz <= 0.8 && Math.abs(lx) <= MountainCave.chamberHalfWidth + 1.0) {
        layers[idx] = 2; // damp rocky mountain cave floor
      } else if (lz > 0.8 && lz <= 5.5 && Math.abs(lx) <= 3.6) {
        layers[idx] = 6; // worn dirt approach leading into mountain cave
      } else if (tDist < 2.25 && rDist > 5.8) {
        layers[idx] = 6; // recessed worn dirt forest trail
      } else if (h < IslandTerrain.waterLevel + 0.35 || dist > worldRadius * 0.91 || rDist < 6.8) {
        layers[idx] = 1; // riverbanks, riverbed & coastal sand
      } else if (h > 8.2) {
        layers[idx] = 2; // rocky mountain ridges
      } else if (isOrganicMossPoint(vx, vz, rDist, dist, worldRadius)) {
        layers[idx] = 4; // organic shaded forest moss pockets & riverbank dampness
      } else {
        layers[idx] = 0; // lush forest grass floor
      }
    }
  }

  return {
    size,
    heights,
    layers,
    scatter: defaultScatter(),
    caves: [
      normalizeCaveGrotto(
        {
          id: uid(),
          name: 'Shadowrock Cavern',
          x: MountainCave.x,
          z: MountainCave.z,
          rotation: MountainCave.yaw,
          scale: 1.0,
          crystalDensity: 0.45,
          crystalColor: '#38BDF8',
          hasSpring: false,
        },
        0
      ),
      normalizeCaveGrotto(
        {
          id: uid(),
          name: 'Eastern Ridge Cave',
          x: 54,
          z: -48,
          rotation: 0.65,
          scale: 1.55,
          crystalDensity: 0.5,
          crystalColor: '#A78BFA',
        },
        1
      ),
      normalizeCaveGrotto(
        {
          id: uid(),
          name: 'North Hollow Grotto',
          x: -14,
          z: -84,
          rotation: 0.2,
          scale: 1.45,
          crystalDensity: 0.35,
          crystalColor: '#5EEAD4',
        },
        2
      ),
    ],
    mountainConfig: createDefaultMountainConfig(),
    waterBodies: createDefaultWaterBodies(),
    dirtAndRoadConfig: createDefaultDirtAndRoadConfig(),
    roads: [],
    revision: 1,
  };
}

export function ensureUpgradedTerrain(terrain: TerrainData | undefined): TerrainData {
  if (!terrain) return createInitialTerrain();
  const hasForestEcosystem = terrain.scatter.some(
    (s) => s.kind === 'pine' || s.kind === 'cattail' || s.kind === 'birch'
  );
  if (
    terrain.size === IslandTerrain.gridSize &&
    terrain.heights.length === (terrain.size + 1) * (terrain.size + 1) &&
    (terrain.freeformWorld || hasForestEcosystem)
  ) {
    if (
      terrain.mountainConfig &&
      terrain.waterBodies &&
      terrain.dirtAndRoadConfig &&
      terrain.roads &&
      terrain.caves?.every((c) => Boolean(c.name))
    ) {
      return terrain;
    }
    return {
      ...terrain,
      mountainConfig: terrain.mountainConfig ?? createDefaultMountainConfig(),
      waterBodies: terrain.waterBodies ?? createDefaultWaterBodies(),
      dirtAndRoadConfig: terrain.dirtAndRoadConfig ?? createDefaultDirtAndRoadConfig(),
      roads: terrain.roads ?? [],
      caves: (terrain.caves ?? []).map((c, idx) => normalizeCaveGrotto(c, idx)),
    };
  }
  // Automatically upgrade legacy or older-grid islands to the 5x forest/river/trail island
  const prevScale = terrain.size < 96 ? 64 : IslandTerrain.radius;
  const customOnly = terrain.scatter
    .filter((s) => s.kind === 'custom')
    .map((s) => ({
      ...s,
      x: (s.x / prevScale) * IslandTerrain.radius,
      z: (s.z / prevScale) * IslandTerrain.radius,
    }));
  const fresh = createInitialTerrain();
  return {
    ...fresh,
    scatter: [...fresh.scatter, ...customOnly],
    revision: (terrain.revision ?? 1) + 1,
  };
}

export function sampleTerrainHeight(terrain: TerrainData | undefined, x: number, z: number): number {
  const dist = Math.hypot(x, z);
  const r = getTerrainRadius(terrain);
  const sr = getTerrainShoreRadius(terrain);
  if (!terrain?.freeformWorld && dist > sr) return IslandTerrain.seaFloor;
  if (terrain?.freeformWorld && (Math.abs(x) > r || Math.abs(z) > r)) {
    return IslandTerrain.seaFloor;
  }
  if (
    !terrain ||
    terrain.size !== IslandTerrain.gridSize ||
    terrain.heights.length !== (terrain.size + 1) * (terrain.size + 1)
  ) {
    return IslandTerrain.heightAt(x, z);
  }
  const size = terrain.size;
  const width = size + 1;
  const fx = Math.max(0, Math.min(size - 0.0001, ((x + r) / (2 * r)) * size));
  const fz = Math.max(0, Math.min(size - 0.0001, ((z + r) / (2 * r)) * size));
  const c1 = Math.floor(fx);
  const r1 = Math.floor(fz);
  const tx = fx - c1;
  const tz = fz - r1;

  const c0 = Math.max(0, c1 - 1);
  const c2 = Math.min(size, c1 + 1);
  const c3 = Math.min(size, c1 + 2);
  const r0 = Math.max(0, r1 - 1);
  const r2 = Math.min(size, r1 + 1);
  const r3 = Math.min(size, r1 + 2);

  const heights = terrain.heights;
  const o0 = r0 * width;
  const o1 = r1 * width;
  const o2 = r2 * width;
  const o3 = r3 * width;

  return catmullRom1D(
    catmullRom1D(heights[o0 + c0], heights[o0 + c1], heights[o0 + c2], heights[o0 + c3], tx),
    catmullRom1D(heights[o1 + c0], heights[o1 + c1], heights[o1 + c2], heights[o1 + c3], tx),
    catmullRom1D(heights[o2 + c0], heights[o2 + c1], heights[o2 + c2], heights[o2 + c3], tx),
    catmullRom1D(heights[o3 + c0], heights[o3 + c1], heights[o3 + c2], heights[o3 + c3], tx),
    tz
  );
}

export function sampleTerrainLayer(terrain: TerrainData | undefined, x: number, z: number): number {
  if (!terrain?.layers || terrain.layers.length !== (terrain.size + 1) * (terrain.size + 1)) {
    return 0;
  }
  const size = terrain.size;
  const width = size + 1;
  const r = getTerrainRadius(terrain);
  const fx = Math.max(0, Math.min(size, Math.round(((x + r) / (2 * r)) * size)));
  const fz = Math.max(0, Math.min(size, Math.round(((z + r) / (2 * r)) * size)));
  return terrain.layers[fz * width + fx] ?? 0;
}

export function sampleLevelHeight(level: GameLevel, x: number, z: number): number {
  const env = getEnvironmentType(level);
  if (env === 'dungeon') {
    const poolDist = Math.hypot(x - 4, z - 4);
    if (poolDist < 4.5) return -0.14 * (1 - poolDist / 4.5);
    return 0;
  }
  if (env === 'castle') {
    if (z < -24 && Math.abs(x) < 16) {
      const rampT = Math.min(1, (-24 - z) / 2.2);
      return 0.72 * rampT;
    }
    return 0;
  }
  if (env === 'scifi') {
    const d = Math.hypot(x, z);
    if (d <= 28) return 0;
    const rim = Math.min(1, (d - 28) / 22);
    return rim * rim * 2.4;
  }
  if (env === 'sideScroller') {
    if (Math.abs(z) > 3.6) return -28;
    const segs = getSideScrollerSegments(level);
    let lowestBaseY: number | null = null;
    for (const seg of segs) {
      if (seg.isSecretFloor) continue;
      if (x >= seg.minX && x <= seg.maxX) {
        if (lowestBaseY === null || seg.y < lowestBaseY) {
          lowestBaseY = seg.y;
        }
      }
    }
    return lowestBaseY ?? -28;
  }

  let h = sampleTerrainHeight(level.terrain, x, z);

  // Lock smooth walkable cavern floor inside the MountainCave interior only when terrain has the cave
  if (terrainHasMainMountainCave(level.terrain) && isInsideMountainCave(x, z)) {
    h = MountainCave.floorY;
  }

  // Check if standing on the wooden river crossing bridge (only present on non-freeform template islands)
  if (!level.terrain?.freeformWorld) {
    const dx = x - RiverCrossing.x;
    const dz = z - RiverCrossing.z;
    const along = dx * RiverCrossing.tx + dz * RiverCrossing.tz;
    const perp = -dx * RiverCrossing.tz + dz * RiverCrossing.tx;
    if (Math.abs(along) <= RiverCrossing.halfLength && Math.abs(perp) <= RiverCrossing.halfWidth) {
      h = Math.max(h, RiverCrossing.deckY);
    }
  }

  // Check if standing on any placed Rope & Slat Bridge or inside a Walk-In Building
  if (level.entities && level.entities.length > 0) {
    for (const ent of level.entities) {
      if (ent.kind !== 'prop') continue;
      const [wx, wz] = levelBoardToWorld(level, ent.position);
      const s = Math.max(0.5, ent.scale ?? 1);
      const yaw = ((ent.rotation ?? 0) * Math.PI) / 180;
      const cos = Math.cos(yaw);
      const sin = Math.sin(yaw);
      const dx = x - wx;
      const dz = z - wz;
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;

      if (isRopeBridgeEntity(ent)) {
        const halfW = 1.82 * s;
        const halfL = 6.8 * s;
        if (Math.abs(lx) <= halfW && Math.abs(lz) <= halfL) {
          // Sample bank height at the two ends of the bridge so it spans over deep water gorges
          const southEndX = wx + halfL * sin;
          const southEndZ = wz + halfL * cos;
          const northEndX = wx - halfL * sin;
          const northEndZ = wz - halfL * cos;
          const southBankY = sampleTerrainHeight(level.terrain, southEndX, southEndZ);
          const northBankY = sampleTerrainHeight(level.terrain, northEndX, northEndZ);
          const bankAnchorY = Math.max(southBankY, northBankY, IslandTerrain.waterLevel + 1.15) + (ent.elevationY ?? 0);
          const u = Math.min(1, Math.abs(lz) / Math.max(0.01, halfL));
          const archCamber = (1 - u * u) * 0.28 * s;
          const deckY = bankAnchorY + 0.14 * s + archCamber;
          h = Math.max(h, deckY);
        }
        continue;
      }

      const walkInSpec = getWalkInBuildingSpec(ent);
      if (walkInSpec) {
        if (Math.abs(lx) <= walkInSpec.halfW + 0.25 && Math.abs(lz) <= walkInSpec.halfD + 0.45) {
          const buildingGroundY = sampleTerrainHeight(level.terrain, wx, wz) + (ent.elevationY ?? 0);
          h = Math.max(h, buildingGroundY + walkInSpec.floorOffset);
        }
      }
    }
  }

  return h;
}

export interface TerrainWeatherSample {
  moss: number;
  cracks: number;
  scorch: number;
  mud: number;
  frost: number;
}

export function packTerrainWeathering(
  moss: number,
  cracks: number,
  scorch: number,
  mud: number,
  frost: number
): number {
  const m = Math.max(0, Math.min(63, Math.round(moss * 63)));
  const c = Math.max(0, Math.min(63, Math.round(cracks * 63)));
  const s = Math.max(0, Math.min(63, Math.round(scorch * 63)));
  const d = Math.max(0, Math.min(63, Math.round(mud * 63)));
  const f = Math.max(0, Math.min(63, Math.round(frost * 63)));
  return m | (c << 6) | (s << 12) | (d << 18) | (f << 24);
}

export function unpackTerrainWeathering(packed: number | undefined): TerrainWeatherSample {
  if (!packed) return { moss: 0, cracks: 0, scorch: 0, mud: 0, frost: 0 };
  return {
    moss: (packed & 63) / 63,
    cracks: ((packed >>> 6) & 63) / 63,
    scorch: ((packed >>> 12) & 63) / 63,
    mud: ((packed >>> 18) & 63) / 63,
    frost: ((packed >>> 24) & 63) / 63,
  };
}

export function sampleTerrainWeathering(
  terrain: TerrainData | undefined,
  x: number,
  z: number
): TerrainWeatherSample {
  if (
    !terrain?.weathering ||
    terrain.weathering.length !== (terrain.size + 1) * (terrain.size + 1)
  ) {
    return { moss: 0, cracks: 0, scorch: 0, mud: 0, frost: 0 };
  }
  const size = terrain.size;
  const width = size + 1;
  const r = getTerrainRadius(terrain);
  const fx = Math.max(0, Math.min(size - 0.0001, ((x + r) / (2 * r)) * size));
  const fz = Math.max(0, Math.min(size - 0.0001, ((z + r) / (2 * r)) * size));
  const c0 = Math.floor(fx);
  const r0 = Math.floor(fz);
  const c1 = Math.min(size, c0 + 1);
  const r1 = Math.min(size, r0 + 1);
  const tx = fx - c0;
  const tz = fz - r0;

  const wArr = terrain.weathering;
  const s00 = unpackTerrainWeathering(wArr[r0 * width + c0]);
  const s10 = unpackTerrainWeathering(wArr[r0 * width + c1]);
  const s01 = unpackTerrainWeathering(wArr[r1 * width + c0]);
  const s11 = unpackTerrainWeathering(wArr[r1 * width + c1]);

  const bilerp = (a: number, b: number, c: number, d: number) =>
    (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;

  return {
    moss: bilerp(s00.moss, s10.moss, s01.moss, s11.moss),
    cracks: bilerp(s00.cracks, s10.cracks, s01.cracks, s11.cracks),
    scorch: bilerp(s00.scorch, s10.scorch, s01.scorch, s11.scorch),
    mud: bilerp(s00.mud, s10.mud, s01.mud, s11.mud),
    frost: bilerp(s00.frost, s10.frost, s01.frost, s11.frost),
  };
}

export function applyTerrainBrush(
  rawTerrain: TerrainData,
  brush: TerrainBrush,
  x: number,
  z: number,
  radius: number,
  customAssetId?: string,
  options?: TerrainBrushOptions
): TerrainData {
  const terrain = ensureUpgradedTerrain(rawTerrain);
  const size = terrain.size;
  const width = size + 1;
  const worldRadius = getTerrainRadius(terrain);
  const step = (2 * worldRadius) / size;
  const strength = Math.max(0.1, Math.min(1.5, options?.strength ?? 0.65));
  const falloffMode: TerrainBrushFalloff = options?.falloff ?? 'smooth';

  const isShape =
    brush === 'raiseGround' ||
    brush === 'lowerGround' ||
    brush === 'smoothGround' ||
    brush === 'flattenGround' ||
    brush === 'plateauCliff' ||
    brush === 'carveRiver' ||
    brush === 'paintWaterLake' ||
    brush === 'paintRoad';

  const paintLayerMap: Partial<Record<TerrainBrush, number>> = {
    paintGrass: 0,
    paintSand: 1,
    paintRock: 2,
    paintSnow: 3,
    paintMoss: 4,
    paintCobble: 5,
    paintDirt: 6,
  };

  // Restrict grid iteration strictly to the brush bounding box for instant O(r^2) sculpting
  const minCol = Math.max(0, Math.floor(((x - radius + worldRadius) / (2 * worldRadius)) * size) - 1);
  const maxCol = Math.min(size, Math.ceil(((x + radius + worldRadius) / (2 * worldRadius)) * size) + 1);
  const minRow = Math.max(0, Math.floor(((z - radius + worldRadius) / (2 * worldRadius)) * size) - 1);
  const maxRow = Math.min(size, Math.ceil(((z + radius + worldRadius) / (2 * worldRadius)) * size) + 1);

  if (brush === 'terrain') {
    const updatedHeights = [...terrain.heights];
    const updatedLayers = [...terrain.layers];
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const vx = -worldRadius + col * step;
        const vz = -worldRadius + row * step;
        const d = Math.hypot(vx - x, vz - z);
        if (d > radius) continue;
        const idx = row * width + col;
        const targetY = IslandTerrain.baseTop;
        if (updatedHeights[idx] < targetY) {
          const edgeT = Math.max(0, Math.min(1, 1 - d / Math.max(0.001, radius)));
          updatedHeights[idx] =
            edgeT > 0.38 ? targetY : Math.max(updatedHeights[idx], 0.35 + edgeT * 0.9);
        }
        if (updatedHeights[idx] < 0.7 && d > radius * 0.72) {
          updatedLayers[idx] = 1;
        } else if (updatedLayers[idx] === 1 && updatedHeights[idx] >= 0.65) {
          updatedLayers[idx] = 0;
        }
      }
    }
    return {
      ...terrain,
      freeformWorld: true,
      heights: updatedHeights,
      layers: updatedLayers,
      revision: terrain.revision + 1,
    };
  }

  if (brush === 'paintGrassErase') {
    const updatedLayers = [...terrain.layers];
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const vx = -worldRadius + col * step;
        const vz = -worldRadius + row * step;
        const d = Math.hypot(vx - x, vz - z);
        if (d > radius) continue;
        if (updatedLayers[row * width + col] === 0 || updatedLayers[row * width + col] === 4) {
          updatedLayers[row * width + col] = 6; // bare earth under cleared grass
        }
      }
    }
    const nextScatter = terrain.scatter.filter(
      (s) => s.kind !== 'tallGrass' || Math.hypot(s.x - x, s.z - z) > radius
    );
    return {
      ...terrain,
      layers: updatedLayers,
      scatter: nextScatter,
      revision: terrain.revision + 1,
    };
  }

  if (brush === 'carveCave') {
    const caves: CaveGrotto[] = [...(terrain.caves ?? [])];
    const tooClose = caves.some((c) => Math.hypot(c.x - x, c.z - z) < 7.0);
    const updatedHeights = [...terrain.heights];
    const updatedLayers = [...terrain.layers];

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const vx = -worldRadius + col * step;
        const vz = -worldRadius + row * step;
        const d = Math.hypot(vx - x, vz - z);
        if (d > radius) continue;
        const soft = quinticSmooth(1 - d / radius);
        const idx = row * width + col;
        if (d < radius * 0.58) {
          updatedHeights[idx] = Math.max(-1.0, terrain.heights[idx] - soft * 0.55 * strength);
          updatedLayers[idx] = 2; // rock floor
        } else {
          updatedLayers[idx] = 4; // mossy cave entrance
        }
      }
    }

    if (!tooClose && caves.length < 18) {
      caves.push(
        normalizeCaveGrotto(
          {
            id: uid(),
            x,
            z,
            rotation: Math.atan2(-x, -z),
            scale: Math.max(0.95, Math.min(1.8, radius / 4)),
          },
          caves.length
        )
      );
    }

    return {
      ...terrain,
      heights: updatedHeights,
      layers: updatedLayers,
      caves,
      revision: terrain.revision + 1,
    };
  }

  if (isShape) {
    const original = terrain.heights;
    const updated = [...original];
    const updatedLayers = [...terrain.layers];
    const centerH =
      options?.flattenHeight !== undefined && options.flattenHeight !== null
        ? options.flattenHeight
        : sampleTerrainHeight(terrain, x, z);
    const cliffTarget = Math.min(22, Math.ceil((centerH + 0.5) / 2.4) * 2.4);
    const roadCfg = terrain.dirtAndRoadConfig ?? createDefaultDirtAndRoadConfig();

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const vx = -worldRadius + col * step;
        const vz = -worldRadius + row * step;
        const distance = Math.hypot(vx - x, vz - z);
        if (distance > radius) continue;
        const soft = evaluateBrushFalloff(distance / radius, falloffMode);
        const idx = row * width + col;

        if (brush === 'raiseGround') {
          updated[idx] = Math.min(24, original[idx] + soft * 0.92 * strength);
        } else if (brush === 'lowerGround') {
          updated[idx] = Math.max(-4.2, original[idx] - soft * 0.92 * strength);
        } else if (brush === 'smoothGround') {
          const rUp = Math.max(0, row - 1);
          const rDn = Math.min(size, row + 1);
          const cLt = Math.max(0, col - 1);
          const cRt = Math.min(size, col + 1);
          const avg =
            (original[row * width + col] * 4 +
              (original[row * width + cLt] +
                original[row * width + cRt] +
                original[rUp * width + col] +
                original[rDn * width + col]) *
                2 +
              (original[rUp * width + cLt] +
                original[rUp * width + cRt] +
                original[rDn * width + cLt] +
                original[rDn * width + cRt])) /
            16;
          updated[idx] = original[idx] + (avg - original[idx]) * Math.min(1, soft * 0.85 * strength);
        } else if (brush === 'flattenGround') {
          const blend = Math.min(1, soft * 0.68 * strength);
          updated[idx] = original[idx] + (centerH - original[idx]) * blend;
        } else if (brush === 'plateauCliff') {
          const terrace =
            distance < radius * 0.56
              ? cliffTarget
              : original[idx] + (cliffTarget - original[idx]) * soft * 0.78;
          updated[idx] = original[idx] + (terrace - original[idx]) * Math.min(1, 0.52 * strength);
          if (distance >= radius * 0.48 && distance <= radius * 0.92) {
            updatedLayers[idx] = 2; // rock cliff wall
          }
        } else if (brush === 'carveRiver' || brush === 'paintWaterLake') {
          const riverFloor = IslandTerrain.waterLevel - (brush === 'paintWaterLake' ? 1.55 : 1.25);
          updated[idx] = original[idx] + (riverFloor - original[idx]) * Math.min(1, soft * 0.62 * strength);
          if (soft > 0.18) {
            updatedLayers[idx] = 1; // sandy riverbed & banks
          }
        } else if (brush === 'paintRoad') {
          const recess = roadCfg.defaultRoadRecess * soft * Math.min(1, strength);
          const minSafe = IslandTerrain.waterLevel + 0.45;
          updated[idx] = Math.max(minSafe, original[idx] - recess * 0.55);
          if (soft > 1 - Math.max(0.2, roadCfg.defaultRoadEdgeTransition)) {
            updatedLayers[idx] = 6; // dirt road
          }
        }
      }
    }
    return {
      ...terrain,
      heights: updated,
      layers: updatedLayers,
      revision: terrain.revision + 1,
    };
  }

  const isWeatherBrush =
    brush === 'weatherMoss' ||
    brush === 'weatherCracks' ||
    brush === 'weatherErode' ||
    brush === 'weatherScorch' ||
    brush === 'weatherMud' ||
    brush === 'weatherFrost' ||
    brush === 'weatherClear';

  if (isWeatherBrush) {
    const cellCount = width * width;
    const updatedWeather =
      terrain.weathering && terrain.weathering.length === cellCount
        ? [...terrain.weathering]
        : new Array<number>(cellCount).fill(0);
    const updatedHeights = brush === 'weatherErode' ? [...terrain.heights] : null;
    const baseHeights = terrain.heights;

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const vx = -worldRadius + col * step;
        const vz = -worldRadius + row * step;
        const distance = Math.hypot(vx - x, vz - z);
        if (distance > radius) continue;
        const soft = evaluateBrushFalloff(distance / radius, falloffMode);
        const idx = row * width + col;

        // Estimate local cliff slope for realistic rock/cave weathering
        const cLt = Math.max(0, col - 1);
        const cRt = Math.min(size, col + 1);
        const rUp = Math.max(0, row - 1);
        const rDn = Math.min(size, row + 1);
        const gx = (baseHeights[row * width + cRt] - baseHeights[row * width + cLt]) / (2 * step);
        const gz = (baseHeights[rDn * width + col] - baseHeights[rUp * width + col]) / (2 * step);
        const slope = Math.min(1, Math.hypot(gx, gz) * 0.9);

        const cur = unpackTerrainWeathering(updatedWeather[idx]);
        let { moss, cracks, scorch, mud, frost } = cur;
        const rate = Math.min(0.92, soft * strength * 0.48);

        if (brush === 'weatherMoss') {
          const slopeBias = 0.72 + (1 - slope) * 0.28;
          moss = Math.min(1, moss + (1 - moss) * rate * slopeBias);
          frost = Math.max(0, frost * (1 - rate * 0.5));
          scorch = Math.max(0, scorch * (1 - rate * 0.35));
        } else if (brush === 'weatherCracks') {
          const slopeBoost = 0.8 + slope * 0.55;
          cracks = Math.min(1, cracks + (1 - cracks) * rate * slopeBoost);
        } else if (brush === 'weatherErode') {
          const slopeBoost = 0.85 + slope * 0.65;
          cracks = Math.min(1, cracks + (1 - cracks) * rate * slopeBoost);
          if (slope < 0.38 && baseHeights[idx] < IslandTerrain.waterLevel + 2.2) {
            mud = Math.min(1, mud + (1 - mud) * rate * 0.28);
          }
          if (updatedHeights) {
            // Chisel layered strata grooves & chipped rock notches onto cliff/cave/hill slopes
            const cragNoise =
              Math.sin(vx * 0.95 + Math.cos(vz * 0.75) * 1.4) * Math.cos(vz * 1.05 - vx * 0.45) +
              Math.sin(vx * 2.1 - vz * 1.9 + baseHeights[idx] * 0.8) * 0.45;
            const sculptScale = soft * strength * (0.09 + slope * 0.24);
            const etched = baseHeights[idx] + (cragNoise * 0.55 - 0.22) * sculptScale;
            updatedHeights[idx] = Math.max(-4.2, Math.min(24, etched));
          }
        } else if (brush === 'weatherScorch') {
          scorch = Math.min(1, scorch + (1 - scorch) * rate * 1.05);
          moss = Math.max(0, moss * (1 - rate * 0.65));
          frost = Math.max(0, frost * (1 - rate * 0.75));
        } else if (brush === 'weatherMud') {
          mud = Math.min(1, mud + (1 - mud) * rate);
          frost = Math.max(0, frost * (1 - rate * 0.55));
        } else if (brush === 'weatherFrost') {
          frost = Math.min(1, frost + (1 - frost) * rate);
          scorch = Math.max(0, scorch * (1 - rate * 0.55));
        } else if (brush === 'weatherClear') {
          const clearMul = Math.max(0, 1 - rate * 1.35);
          moss *= clearMul;
          cracks *= clearMul;
          scorch *= clearMul;
          mud *= clearMul;
          frost *= clearMul;
        }

        updatedWeather[idx] = packTerrainWeathering(moss, cracks, scorch, mud, frost);
      }
    }

    return {
      ...terrain,
      heights: updatedHeights ?? terrain.heights,
      weathering: updatedWeather,
      revision: terrain.revision + 1,
    };
  }

  const paintIdx = paintLayerMap[brush];
  if (paintIdx !== undefined) {
    const updated = [...terrain.layers];
    for (let row = 0; row < width; row++) {
      for (let col = 0; col < width; col++) {
        const vx = -worldRadius + col * step;
        const vz = -worldRadius + row * step;
        const distance = Math.hypot(vx - x, vz - z);
        if (distance > radius) continue;
        const falloff = 1 - distance / radius;
        const chance = Math.min(1, falloff * 3.2);
        if (Math.random() <= chance) {
          updated[row * width + col] = paintIdx;
        }
      }
    }
    return { ...terrain, layers: updated, revision: terrain.revision + 1 };
  }

  // Scatter brushes
  const treeKinds: ('pine' | 'oak' | 'birch')[] = ['pine', 'oak', 'birch'];
  const kind: ScatterItem['kind'] =
    brush === 'scatterTree'
      ? treeKinds[Math.floor(Math.random() * 3)]
      : brush === 'scatterRock'
      ? 'rock'
      : brush === 'scatterFlower'
      ? 'flower'
      : customAssetId
      ? 'custom'
      : 'bush';

  const nextScatter = [...terrain.scatter];
  const maxPerStroke = kind === 'custom' ? 1 : 4;
  for (let i = 0; i < maxPerStroke; i++) {
    if (nextScatter.length >= 3600) break;
    const angle = Math.random() * Math.PI * 2;
    const dist = kind === 'custom' ? Math.random() * Math.min(1.5, radius * 0.35) : Math.random() * radius;
    const sx = x + Math.cos(angle) * dist;
    const sz = z + Math.sin(angle) * dist;
    if (
      terrain.freeformWorld
        ? Math.abs(sx) >= worldRadius * 0.96 || Math.abs(sz) >= worldRadius * 0.96
        : Math.hypot(sx, sz) >= worldRadius * 0.94
    ) {
      continue;
    }
    const spacing = kind === 'flower' ? 0.85 : kind === 'custom' ? 2.0 : 1.7;
    const tooClose = nextScatter.some((item) => Math.hypot(item.x - sx, item.z - sz) < spacing);
    if (tooClose) continue;
    const itemSize =
      kind === 'pine' || kind === 'oak' || kind === 'birch'
        ? 0.95 + Math.random() * 0.65
        : kind === 'rock'
        ? 0.75 + Math.random() * 0.7
        : kind === 'custom'
        ? 0.9 + Math.random() * 0.35
        : 0.75 + Math.random() * 0.45;
    nextScatter.push({
      id: uid(),
      kind,
      customAssetId: kind === 'custom' ? customAssetId : undefined,
      x: sx,
      z: sz,
      size: itemSize,
      rotation: Math.random() * Math.PI * 2,
    });
  }
  return { ...terrain, scatter: nextScatter, revision: terrain.revision + 1 };
}

/**
 * Automatically applies organic multi-form weathering across hills, mountain cliffs, riverbanks,
 * and cave sides based on local slope, elevation, and distance to water or caves.
 */
export function applySlopeAutoWeathering(
  rawTerrain: TerrainData,
  degree = 0.72
): TerrainData {
  const terrain = ensureUpgradedTerrain(rawTerrain);
  const size = terrain.size;
  const width = size + 1;
  const worldRadius = getTerrainRadius(terrain);
  const step = (2 * worldRadius) / size;
  const cellCount = width * width;
  const existing =
    terrain.weathering && terrain.weathering.length === cellCount
      ? terrain.weathering
      : null;
  const nextWeather = new Array<number>(cellCount);
  const caves = terrain.caves ?? [];
  const scale = Math.max(0.15, Math.min(1.25, degree));

  for (let row = 0; row < width; row++) {
    const rUp = Math.max(0, row - 1);
    const rDn = Math.min(size, row + 1);
    const vz = -worldRadius + row * step;
    for (let col = 0; col < width; col++) {
      const cLt = Math.max(0, col - 1);
      const cRt = Math.min(size, col + 1);
      const vx = -worldRadius + col * step;
      const idx = row * width + col;
      const h = terrain.heights[idx];

      const gx = (terrain.heights[row * width + cRt] - terrain.heights[row * width + cLt]) / (2 * step);
      const gz = (terrain.heights[rDn * width + col] - terrain.heights[rUp * width + col]) / (2 * step);
      const slope = Math.min(1, Math.hypot(gx, gz) * 0.85);
      const patch = (organicMossPatch(vx * 1.4, vz * 1.4) + 1) * 0.5;
      const rDist = IslandRiver.distanceTo(vx, vz);

      let nearCave = 0;
      for (let ci = 0; ci < caves.length; ci++) {
        const cd = Math.hypot(vx - caves[ci].x, vz - caves[ci].z);
        if (cd < 16) {
          nearCave = Math.max(nearCave, 1 - cd / 16);
        }
      }

      const prev = existing ? unpackTerrainWeathering(existing[idx]) : { moss: 0, cracks: 0, scorch: 0, mud: 0, frost: 0 };

      // Steep cliff faces, ridges & cave surrounds get fractured stone cracks
      const cliffCracks =
        slope > 0.28 || nearCave > 0.15 || h > 6.5
          ? Math.min(0.9, ((slope - 0.2) * 0.85 + nearCave * 0.55 + Math.max(0, h - 6.5) * 0.04) * (0.55 + patch * 0.55) * scale)
          : 0;

      // Damp riverbanks, cave approaches & shaded lower slopes gather moss
      const bankMoss =
        h > IslandTerrain.waterLevel + 0.1 && (rDist < 9.5 || nearCave > 0.2 || (slope > 0.18 && slope < 0.58 && patch > 0.45))
          ? Math.min(0.85, (Math.max(0, 1 - rDist / 10) * 0.55 + nearCave * 0.45 + patch * 0.35) * scale)
          : 0;

      // Wet mud along low shorelines and river edges
      const shoreMud =
        h >= IslandTerrain.waterLevel - 0.35 && h <= IslandTerrain.waterLevel + 1.15 && (rDist < 7.5 || patch > 0.42)
          ? Math.min(0.75, (0.45 + patch * 0.4) * scale)
          : 0;

      // High-altitude frost on tall mountain summits
      const peakFrost = h > 10.5 ? Math.min(0.85, ((h - 10.5) / 6.5) * (0.65 + patch * 0.35) * scale) : 0;

      nextWeather[idx] = packTerrainWeathering(
        Math.max(prev.moss, bankMoss),
        Math.max(prev.cracks, cliffCracks),
        prev.scorch,
        Math.max(prev.mud, shoreMud),
        Math.max(prev.frost, peakFrost)
      );
    }
  }

  return {
    ...terrain,
    weathering: nextWeather,
    revision: terrain.revision + 1,
  };
}

export function clearTerrainWeathering(rawTerrain: TerrainData): TerrainData {
  const terrain = ensureUpgradedTerrain(rawTerrain);
  if (!terrain.weathering) return terrain;
  return {
    ...terrain,
    weathering: undefined,
    revision: terrain.revision + 1,
  };
}

export const PlatformMotion = {
  presets: [
    { id: 'stoneLift', title: 'Stone lift' },
    { id: 'swingingBridge', title: 'Swinging bridge' },
    { id: 'spinningDisc', title: 'Spinning disc' },
    { id: 'jungleVine', title: 'Jungle canopy platform' },
    { id: 'bouncePad', title: 'Giant bounce pad' },
    { id: 'crumbleStone', title: 'Mossy ledge' },
    { id: 'sawWheel', title: 'Spinning saw wheel' },
  ] as const,

  hover(preset: string): number {
    if (preset === 'spinningDisc' || preset === 'sawWheel') return 0.45;
    if (preset === 'bouncePad') return 0.15;
    return 0.55;
  },

  halfExtent(preset: string): number {
    if (preset === 'swingingBridge' || preset === 'jungleVine') return 1.45;
    if (preset === 'spinningDisc' || preset === 'sawWheel') return 1.25;
    if (preset === 'bouncePad') return 1.1;
    return 1.2;
  },

  pose(
    time: number,
    start: [number, number, number],
    end: [number, number, number],
    speed: number,
    wait: number,
    spinOrMotion: boolean | PlatformMotionType
  ): { position: [number, number, number]; yaw: number; swingAngle?: number } {
    const motion: PlatformMotionType =
      typeof spinOrMotion === 'boolean'
        ? spinOrMotion
          ? 'spin'
          : 'slide'
        : spinOrMotion;

    if (motion === 'spin') {
      const yaw = (time * Math.max(0.2, speed) * 1.4) % (Math.PI * 2);
      return { position: start, yaw };
    }

    if (motion === 'pendulum') {
      const freq = Math.max(0.25, speed * 0.7);
      const phase = Math.sin(time * freq * 2.0);
      const radiusX = Math.abs(end[0] - start[0]) > 0.2 ? end[0] - start[0] : 3.2;
      const arcDrop = Math.abs(Math.cos(phase * 0.65)) * 0.65 - 0.65;
      return {
        position: [start[0] + phase * radiusX, start[1] + arcDrop, start[2]],
        yaw: 0,
        swingAngle: phase * 0.38,
      };
    }

    const effEnd: [number, number, number] =
      motion === 'vertical' && Math.hypot(end[0] - start[0], end[1] - start[1], end[2] - start[2]) <= 0.1
        ? [start[0], start[1] + 4.4, start[2]]
        : end;

    const dx = effEnd[0] - start[0];
    const dy = effEnd[1] - start[1];
    const dz = effEnd[2] - start[2];
    const dist = Math.hypot(dx, dy, dz);
    if (dist <= 0.05) return { position: start, yaw: 0 };

    const travel = dist / Math.max(0.15, speed);
    const pause = Math.max(0, wait);
    const cycle = Math.max(0.2, travel * 2 + pause * 2);
    const t = Math.max(0, time) % cycle;

    const smooth = (v: number) => {
      const c = Math.min(1, Math.max(0, v));
      return c * c * (3 - 2 * c);
    };

    let fraction = 0;
    if (t < travel) {
      fraction = smooth(t / travel);
    } else if (t < travel + pause) {
      fraction = 1;
    } else if (t < travel * 2 + pause) {
      fraction = 1 - smooth((t - travel - pause) / travel);
    }
    return {
      position: [
        start[0] + dx * fraction,
        start[1] + dy * fraction,
        start[2] + dz * fraction,
      ],
      yaw: 0,
    };
  },
};

export interface SplineSample {
  x: number;
  z: number;
  tx: number;
  tz: number;
}

function samplePolylineSpline(waypoints: [number, number][], totalSamples = 140): SplineSample[] {
  if (waypoints.length < 2) return [];
  const raw: { x: number; z: number }[] = [];
  const segs = waypoints.length - 1;
  for (let i = 0; i < totalSamples; i++) {
    const u = (i / (totalSamples - 1)) * segs;
    const idx = Math.min(segs - 1, Math.floor(u));
    const t = u - idx;
    const p0 = waypoints[Math.max(0, idx - 1)];
    const p1 = waypoints[idx];
    const p2 = waypoints[idx + 1];
    const p3 = waypoints[Math.min(segs, idx + 2)];
    raw.push({
      x: catmullRom1D(p0[0], p1[0], p2[0], p3[0], t),
      z: catmullRom1D(p0[1], p1[1], p2[1], p3[1], t),
    });
  }
  return raw.map((pt, i) => {
    const prev = raw[Math.max(0, i - 1)];
    const next = raw[Math.min(raw.length - 1, i + 1)];
    const dx = next.x - prev.x;
    const dz = next.z - prev.z;
    const len = Math.max(0.001, Math.hypot(dx, dz));
    return { x: pt.x, z: pt.z, tx: dx / len, tz: dz / len };
  });
}

function distToSpline(samples: SplineSample[], x: number, z: number): number {
  let best = Number.POSITIVE_INFINITY;
  for (const s of samples) {
    const d = Math.hypot(s.x - x, s.z - z);
    if (d < best) best = d;
  }
  return best;
}

function carveRoadCorridor(
  heights: number[],
  layers: number[],
  samples: SplineSample[],
  innerHalfW: number,
  outerHalfW: number,
  layerIdx: number,
  recessDepth = 0.28,
  minSafeHeight = IslandTerrain.waterLevel + 0.55
) {
  const size = IslandTerrain.gridSize;
  const width = size + 1;
  const worldRadius = IslandTerrain.radius;
  const step = (2 * worldRadius) / size;
  for (let row = 0; row < width; row++) {
    for (let col = 0; col < width; col++) {
      const vx = -worldRadius + col * step;
      const vz = -worldRadius + row * step;
      const d = distToSpline(samples, vx, vz);
      if (d > outerHalfW) continue;
      const idx = row * width + col;
      const rDist = IslandRiver.distanceTo(vx, vz);
      if (rDist < 6.4) continue;
      if (d <= innerHalfW) {
        heights[idx] = Math.max(minSafeHeight, heights[idx] - recessDepth);
        layers[idx] = layerIdx;
      } else {
        const s = (d - innerHalfW) / (outerHalfW - innerHalfW);
        const w = 1 - quinticSmooth(s);
        heights[idx] = Math.max(minSafeHeight, heights[idx] - recessDepth * w);
        if (w > 0.6) layers[idx] = layerIdx;
      }
    }
  }
}

function levelPlazaCircle(
  heights: number[],
  layers: number[],
  cx: number,
  cz: number,
  flatRadius: number,
  blendRadius: number,
  targetH: number,
  layerIdx?: number
) {
  const size = IslandTerrain.gridSize;
  const width = size + 1;
  const worldRadius = IslandTerrain.radius;
  const step = (2 * worldRadius) / size;
  for (let row = 0; row < width; row++) {
    for (let col = 0; col < width; col++) {
      const vx = -worldRadius + col * step;
      const vz = -worldRadius + row * step;
      const d = Math.hypot(vx - cx, vz - cz);
      if (d > blendRadius) continue;
      const idx = row * width + col;
      if (d <= flatRadius) {
        heights[idx] = targetH;
        if (layerIdx !== undefined) layers[idx] = layerIdx;
      } else {
        const s = quinticSmooth((d - flatRadius) / Math.max(0.01, blendRadius - flatRadius));
        heights[idx] = targetH * (1 - s) + heights[idx] * s;
        if (layerIdx !== undefined && s < 0.35) layers[idx] = layerIdx;
      }
    }
  }
}

function carveLakeBasin(
  heights: number[],
  layers: number[],
  cx: number,
  cz: number,
  rx: number,
  rz: number,
  bedHeight: number
) {
  const size = IslandTerrain.gridSize;
  const width = size + 1;
  const worldRadius = IslandTerrain.radius;
  const step = (2 * worldRadius) / size;
  for (let row = 0; row < width; row++) {
    for (let col = 0; col < width; col++) {
      const vx = -worldRadius + col * step;
      const vz = -worldRadius + row * step;
      const u = Math.hypot((vx - cx) / rx, (vz - cz) / rz);
      if (u > 1.55) continue;
      const idx = row * width + col;
      if (u <= 0.72) {
        heights[idx] = bedHeight;
        layers[idx] = 1; // sandy lake bed
      } else {
        const t = quinticSmooth((u - 0.72) / (1.55 - 0.72));
        heights[idx] = bedHeight * (1 - t) + heights[idx] * t;
        if (u < 1.12) layers[idx] = 1; // sandy shoreline
        else if (u < 1.32 && layers[idx] === 0) layers[idx] = 4; // mossy bank
      }
    }
  }
}

export const BuddiesLandmarks = (() => {
  const caveMouthWorld: [number, number] = [MountainCave.x, MountainCave.z + 4.5];
  const caveInteriorWorld = fromMountainCaveLocal(0.6, -7.8);
  const homeClearingWorld: [number, number] = [34, 92];
  const lakeCenterWorld: [number, number] = [-48, -62];
  const dockSpotWorld: [number, number] = [-31, -55];
  const campfireWorld: [number, number] = [-23, -46];
  const tavernWorld: [number, number] = [104, -71];
  const portalWorld: [number, number] = [115, -77];
  const startWorld: [number, number] = [-112, 93];

  const toB = (wx: number, wz: number): BoardPoint => IslandTerrain.worldToBoard(wx, wz);

  return {
    startWorld,
    caveMouthWorld,
    caveInteriorWorld,
    homeClearingWorld,
    lakeCenterWorld,
    dockSpotWorld,
    campfireWorld,
    tavernWorld,
    portalWorld,
    startBoard: toB(...startWorld),
    caveSignBoard: toB(-90, 79),
    caveInteriorBoard: toB(...caveInteriorWorld),
    homeSignBoard: toB(-16, 63),
    homeCottageBoard: toB(38, 96),
    porcupineBoard: toB(31, 88),
    lakeSignBoard: toB(6, 4),
    dockBoard: toB(...dockSpotWorld),
    campfireBoard: toB(...campfireWorld),
    vultureBoard: toB(-27, -51),
    tavernBoard: toB(...tavernWorld),
    portalBoard: toB(...portalWorld),
  };
})();

export function createBuddiesTerrain(): TerrainData {
  const base = createInitialTerrain();
  const heights = base.heights.slice();
  const layers = base.layers.slice();

  // 1. Detour spur into the Mountain Cave mouth (SW trail -> cave)
  const caveSpur = samplePolylineSpline(
    [
      [-94, 83],
      [-86, 76],
      [MountainCave.x + 2, MountainCave.z + 5.5],
      [MountainCave.x, MountainCave.z + 1.5],
    ],
    60
  );
  carveRoadCorridor(heights, layers, caveSpur, 1.8, 3.8, 6, 0.2);

  // 2. Detour spur off-road South-Southeast to Porcupine's Home Clearing
  const homeSpur = samplePolylineSpline(
    [
      [-20, 62],
      [-2, 71],
      [17, 83],
      [33, 91],
    ],
    80
  );
  carveRoadCorridor(heights, layers, homeSpur, 1.9, 4.0, 6, 0.24);
  levelPlazaCircle(heights, layers, 35, 92, 11.5, 19.5, 1.45, 0);
  // Subtle sandy garden path inside clearing
  levelPlazaCircle(heights, layers, 32, 89, 5.2, 8.5, 1.45, 6);

  // 3. Long scenic Northern Detour off the main road to Whispering Forest Lake & Village Dock
  const lakeSpur = samplePolylineSpline(
    [
      [12, 0],
      [-4, -18],
      [-18, -38],
      [-28, -50],
    ],
    80
  );
  carveRoadCorridor(heights, layers, lakeSpur, 1.9, 4.1, 6, 0.25);

  // Carve shimmering natural Forest Lake basin below waterLevel (-1.65)
  carveLakeBasin(heights, layers, -48, -62, 22, 16, IslandTerrain.waterLevel - 1.75);
  // Level cozy lakeside Village Clearing beside the dock
  levelPlazaCircle(heights, layers, -24, -47, 9.0, 15.5, 1.15, 4);

  // 4. Final Destination Courtyard for Woodland Tavern + Feast Reward Altar
  levelPlazaCircle(heights, layers, 108, -73, 14.5, 23.0, 1.55, 5);

  // Add lush cattails/reeds/flowers around the lake & clearings while keeping paths/plazas clean
  const extraScatter: ScatterItem[] = [];
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const rx = -48 + Math.cos(a) * (20.5 + (i % 3) * 1.4);
    const rz = -62 + Math.sin(a) * (15.0 + (i % 3) * 1.2);
    // Keep dock & village approach clear
    if (Math.hypot(rx - -30, rz - -54) < 5.2) continue;
    extraScatter.push({
      id: uid(),
      kind: i % 3 === 0 ? 'cattail' : i % 3 === 1 ? 'reed' : 'fern',
      x: rx,
      z: rz,
      size: 0.95 + (i % 4) * 0.14,
      rotation: a,
    });
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    extraScatter.push({
      id: uid(),
      kind: i % 2 === 0 ? 'flower' : 'berryBush',
      x: 35 + Math.cos(a) * 12.2,
      z: 92 + Math.sin(a) * 12.2,
      size: 0.9 + (i % 3) * 0.12,
      rotation: a * 1.3,
    });
  }

  const clearedScatter = base.scatter.filter((item) => {
    const isTree = item.kind === 'tree' || item.kind === 'pine' || item.kind === 'oak' || item.kind === 'birch';
    if (distToSpline(caveSpur, item.x, item.z) < (isTree ? 3.8 : 2.1)) return false;
    if (distToSpline(homeSpur, item.x, item.z) < (isTree ? 4.0 : 2.2)) return false;
    if (distToSpline(lakeSpur, item.x, item.z) < (isTree ? 4.2 : 2.2)) return false;
    if (Math.hypot(item.x - 35, item.z - 92) < (isTree ? 12.5 : 8.5)) return false;
    if (Math.hypot((item.x + 48) / 24, (item.z + 62) / 18) < 1.08) return false;
    if (Math.hypot(item.x - -24, item.z - -47) < (isTree ? 9.5 : 5.5)) return false;
    if (Math.hypot(item.x - 108, item.z - -73) < (isTree ? 15.5 : 9.0)) return false;
    return true;
  });

  return {
    ...base,
    heights,
    layers,
    scatter: [...clearedScatter, ...extraScatter],
    revision: base.revision + 1,
  };
}

export function createFloatingIslandTerrain(): TerrainData {
  const base = createInitialTerrain();
  const heights = base.heights.slice();
  const layers = base.layers.slice();

  // Central sky-shrine flat plateau + eastern crescent cove lagoon
  levelPlazaCircle(heights, layers, 0, 0, 12, 20, 2.6, 5);
  carveLakeBasin(heights, layers, 64, 58, 24, 18, IslandTerrain.waterLevel - 1.9);
  levelPlazaCircle(heights, layers, -98, 86, 9, 14, 1.35, 0);
  levelPlazaCircle(heights, layers, 112, -74, 11, 18, 2.8, 5);

  const filtered = base.scatter.filter((item) => {
    if (Math.hypot(item.x, item.z) < 11.5) return false;
    if (Math.hypot((item.x - 64) / 25, (item.z - 58) / 19) < 1.05) return false;
    if (Math.hypot(item.x - 112, item.z - -74) < 10.5) return false;
    return true;
  });

  return {
    ...base,
    heights,
    layers,
    scatter: filtered,
    revision: base.revision + 1,
  };
}

export const DrivingWaypoints: [number, number][] = [
  [-98, 72],
  [-48, 88],
  [22, 84],
  [78, 48],
  [92, -16],
  [66, -74],
  [-4, -92],
  [-68, -68],
  [-98, -12],
  [-96, 42],
  [-98, 72],
];

export function createDrivingTerrain(): TerrainData {
  const base = createInitialTerrain();
  const heights = base.heights.slice();
  const layers = base.layers.slice();
  const trackSamples = samplePolylineSpline(DrivingWaypoints, 240);

  const size = IslandTerrain.gridSize;
  const width = size + 1;
  const worldRadius = IslandTerrain.radius;
  const step = (2 * worldRadius) / size;

  // Grade a fast, smooth, driveable forest rally loop (including raised earthen river causeways where loop crosses the river)
  for (let row = 0; row < width; row++) {
    for (let col = 0; col < width; col++) {
      const vx = -worldRadius + col * step;
      const vz = -worldRadius + row * step;
      const d = distToSpline(trackSamples, vx, vz);
      if (d > 9.8) continue;
      const idx = row * width + col;
      // Target gentle banked elevation (~1.2m, gently rising near scenic ridges)
      const targetTrackH = 1.15 + Math.sin(vx * 0.025) * 0.35 + Math.cos(vz * 0.025) * 0.3;
      if (d <= 4.4) {
        heights[idx] = targetTrackH;
        layers[idx] = 6; // wide packed forest dirt rally surface
      } else {
        const s = quinticSmooth((d - 4.4) / (9.8 - 4.4));
        heights[idx] = targetTrackH * (1 - s) + heights[idx] * s;
        if (d < 5.6) layers[idx] = 6;
      }
    }
  }

  // Clear trees & tall rocks cleanly off the racing corridor so vehicles never get snagged
  const cleared = base.scatter.filter((item) => {
    const isTree = item.kind === 'tree' || item.kind === 'pine' || item.kind === 'oak' || item.kind === 'birch';
    const d = distToSpline(trackSamples, item.x, item.z);
    if (d < (isTree ? 7.6 : 5.4)) return false;
    return true;
  });

  return {
    ...base,
    heights,
    layers,
    scatter: cleared,
    revision: base.revision + 1,
  };
}

export interface DrivingChasmGap {
  x: number;
  z: number;
  yawRad: number;
  width: number;
  length: number;
}

export interface CustomDrivingTrackOptions {
  waypoints: [number, number][];
  trackHalfWidth?: number;
  elevationBoost?: number;
  surfaceLayer?: number;
  chasmGaps?: DrivingChasmGap[];
  baseTerrain?: TerrainData;
}

export function createCustomDrivingTrackTerrain(options: CustomDrivingTrackOptions): TerrainData {
  const base = options.baseTerrain
    ? ensureUpgradedTerrain(options.baseTerrain)
    : createInitialTerrain();
  const heights = base.heights.slice();
  const layers = base.layers.slice();
  const pts = options.waypoints.length >= 2 ? options.waypoints : DrivingWaypoints;
  const trackSamples = samplePolylineSpline(pts, Math.max(200, pts.length * 24));

  const size = base.size;
  const width = size + 1;
  const worldRadius = getTerrainRadius(base);
  const step = (2 * worldRadius) / size;
  const trackHalfW = Math.max(3.2, Math.min(7.5, options.trackHalfWidth ?? 4.5));
  const shoulderW = trackHalfW + 5.2;
  const surfaceLayer = options.surfaceLayer ?? 6;
  const elevBoost = options.elevationBoost ?? 0.55;
  const chasms = options.chasmGaps ?? [];

  for (let row = 0; row < width; row++) {
    for (let col = 0; col < width; col++) {
      const vx = -worldRadius + col * step;
      const vz = -worldRadius + row * step;
      const d = distToSpline(trackSamples, vx, vz);
      const idx = row * width + col;

      if (d <= shoulderW) {
        const scenicWave =
          1.28 +
          elevBoost *
            (Math.sin(vx * 0.032) * 0.75 + Math.cos(vz * 0.028) * 0.65);
        const targetTrackH = Math.max(0.95, scenicWave);
        if (d <= trackHalfW) {
          heights[idx] = targetTrackH;
          layers[idx] = surfaceLayer;
        } else {
          const s = quinticSmooth((d - trackHalfW) / (shoulderW - trackHalfW));
          heights[idx] = targetTrackH * (1 - s) + Math.max(0.25, heights[idx]) * s;
          if (d < trackHalfW + 1.1) layers[idx] = surfaceLayer;
        }
      }

      // Carve jumpable canyon/water chasms across track segments
      for (const ch of chasms) {
        const dx = vx - ch.x;
        const dz = vz - ch.z;
        const sy = Math.sin(ch.yawRad);
        const cy = Math.cos(ch.yawRad);
        const along = dx * sy + dz * cy;
        const perp = dx * cy - dz * sy;
        const hl = Math.max(4.5, ch.length * 0.5);
        const hw = Math.max(6.0, ch.width * 0.5);
        const ax = Math.abs(along) / hl;
        const az = Math.abs(perp) / hw;
        if (ax <= 1.25 && az <= 1.18) {
          const rim = Math.max(ax, az);
          if (rim <= 0.78) {
            heights[idx] = IslandTerrain.waterLevel - 4.4;
            layers[idx] = 1;
          } else {
            const blend = quinticSmooth((rim - 0.78) / 0.47);
            const canyonFloor = IslandTerrain.waterLevel - 4.0;
            heights[idx] = canyonFloor * (1 - blend) + heights[idx] * blend;
            if (blend < 0.6) layers[idx] = 2; // rocky cliff rim
          }
        }
      }
    }
  }

  const cleared = base.scatter.filter((item) => {
    const isTree =
      item.kind === 'tree' || item.kind === 'pine' || item.kind === 'oak' || item.kind === 'birch';
    const d = distToSpline(trackSamples, item.x, item.z);
    if (d < (isTree ? trackHalfW + 3.4 : trackHalfW + 1.2)) return false;
    for (const ch of chasms) {
      if (Math.hypot(item.x - ch.x, item.z - ch.z) < Math.max(ch.width, ch.length) * 0.65) {
        return false;
      }
    }
    return true;
  });

  return {
    ...base,
    heights,
    layers,
    scatter: cleared,
    revision: base.revision + 1,
  };
}

export function carveWaterBodyIntoTerrain(
  rawTerrain: TerrainData,
  wb: WaterBodyConfig
): TerrainData {
  const terrain = ensureUpgradedTerrain(rawTerrain);
  const size = terrain.size;
  const width = size + 1;
  const worldRadius = getTerrainRadius(terrain);
  const step = (2 * worldRadius) / size;
  const heights = [...terrain.heights];
  const layers = [...terrain.layers];

  const waterY = IslandTerrain.waterLevel + wb.waterLevelOffset;
  const bedY = waterY - Math.max(0.5, wb.depth * 0.82);
  const bankSpread = 0.24 + wb.bankSlope * 0.9; // steeper = smaller shoulder
  const outerMult = 1 + bankSpread;

  if (wb.kind === 'river' || wb.kind === 'stream') {
    const pts: [number, number][] =
      wb.points && wb.points.length >= 2
        ? wb.points
        : [
            [wb.center[0] - wb.radiusX * 0.5, wb.center[1]],
            [wb.center[0] + wb.radiusX * 0.5, wb.center[1]],
          ];
    const samples = samplePolylineSpline(pts, 120);
    const innerHalf = Math.max(1.2, wb.width * 0.5);
    const outerHalf = innerHalf * (1 + 0.55 + wb.bankSlope * 1.1);
    for (let row = 0; row < width; row++) {
      for (let col = 0; col < width; col++) {
        const vx = -worldRadius + col * step;
        const vz = -worldRadius + row * step;
        const noise =
          wb.shoreNoise *
          (Math.sin(vx * 0.35 + vz * 0.28) * 0.8 + Math.cos(vz * 0.5 - vx * 0.2) * 0.5);
        const d = distToSpline(samples, vx, vz) + noise;
        if (d > outerHalf) continue;
        const idx = row * width + col;
        if (d <= innerHalf) {
          heights[idx] = Math.min(heights[idx], bedY);
          layers[idx] = 1;
        } else {
          const t = (d - innerHalf) / Math.max(0.1, outerHalf - innerHalf);
          const shaped = Math.pow(quinticSmooth(t), 1.35 - wb.bankSmoothness * 0.65);
          heights[idx] = bedY * (1 - shaped) + heights[idx] * shaped;
          if (t < 0.52) layers[idx] = 1;
          else if (t < 0.78 && layers[idx] === 0) layers[idx] = 4;
        }
      }
    }
  } else {
    const rx = Math.max(2, wb.radiusX);
    const rz = Math.max(2, wb.radiusZ);
    for (let row = 0; row < width; row++) {
      for (let col = 0; col < width; col++) {
        const vx = -worldRadius + col * step;
        const vz = -worldRadius + row * step;
        const ang = Math.atan2(vz - wb.center[1], vx - wb.center[0]);
        const wobble =
          1 +
          wb.shoreNoise *
            0.22 *
            (Math.sin(ang * 3 + wb.center[0] * 0.1) + Math.cos(ang * 5 - wb.center[1] * 0.1));
        const u = Math.hypot((vx - wb.center[0]) / (rx * wobble), (vz - wb.center[1]) / (rz * wobble));
        if (u > outerMult) continue;
        const idx = row * width + col;
        if (u <= 0.68) {
          heights[idx] = bedY;
          layers[idx] = 1;
        } else {
          const t = (u - 0.68) / Math.max(0.05, outerMult - 0.68);
          const shaped = Math.pow(quinticSmooth(t), 1.35 - wb.bankSmoothness * 0.65);
          heights[idx] = bedY * (1 - shaped) + heights[idx] * shaped;
          if (t < 0.45) layers[idx] = 1;
          else if (t < 0.75 && layers[idx] === 0) layers[idx] = 4;
        }
      }
    }
  }

  return {
    ...terrain,
    heights,
    layers,
    revision: terrain.revision + 1,
  };
}

/**
 * Carves a real water-filled river gorge between two higher pieces of land (South Village Plateau
 * and North Highlands) so that the Rope & Wooden Slat Bridge placed at (bridgeX, bridgeZ)
 * is the authentic crossing over deep flowing water.
 */
export function carveRpgRiverGorgeTerrain(
  rawTerrain: TerrainData,
  bridgeX = 0,
  bridgeZ = -14
): TerrainData {
  const terrain = ensureUpgradedTerrain(rawTerrain);
  const size = terrain.size;
  const width = size + 1;
  const worldRadius = getTerrainRadius(terrain);
  const step = (2 * worldRadius) / size;
  const heights = [...terrain.heights];
  const layers = [...terrain.layers];

  const riverWaterY = IslandTerrain.waterLevel + 0.15;
  const riverBedY = riverWaterY - 2.35;
  const southBankTargetY = Math.max(1.55, riverWaterY + 1.55);
  const northBankTargetY = Math.max(1.75, riverWaterY + 1.75);

  for (let row = 0; row < width; row++) {
    for (let col = 0; col < width; col++) {
      const vx = -worldRadius + col * step;
      const vz = -worldRadius + row * step;
      const idx = row * width + col;

      // Keep outer island shoreline intact beyond radius 54
      const radialDist = Math.hypot(vx, vz);
      if (radialDist > worldRadius * 0.88) continue;

      // Meandering river centerline passing directly under (bridgeX, bridgeZ)
      const dxFromBridge = vx - bridgeX;
      const meanderOffset =
        Math.sin(dxFromBridge * 0.085) * 1.85 * Math.min(1, Math.abs(dxFromBridge) / 6.5);
      const riverCenterZ = bridgeZ + meanderOffset;
      const dzRiver = vz - riverCenterZ;
      const absDz = Math.abs(dzRiver);

      // Gorge channel half-width (~4.6m inner water bed, ~6.4m bank rim where bridge anchors sit)
      const innerWaterHalfW = 4.4;
      const bankRimHalfW = 6.5;
      const plateauBlendHalfW = 14.0;

      if (absDz <= innerWaterHalfW) {
        // Deep river water channel between the two higher pieces of land
        const depthFactor = 1 - Math.pow(absDz / innerWaterHalfW, 2) * 0.25;
        heights[idx] = riverBedY * depthFactor + (riverWaterY - 0.65) * (1 - depthFactor);
        layers[idx] = 1; // rocky riverbed / shore stone
      } else if (absDz <= bankRimHalfW) {
        // Steep gorge cliff banks rising up to the elevated north and south plateaus
        const t = (absDz - innerWaterHalfW) / (bankRimHalfW - innerWaterHalfW);
        const s = quinticSmooth(t);
        const bankHighY = dzRiver >= 0 ? southBankTargetY : northBankTargetY;
        heights[idx] = riverBedY * (1 - s) + bankHighY * s;
        layers[idx] = t < 0.72 ? 2 : 0; // cliff rock edge into grass/path
      } else if (absDz <= plateauBlendHalfW) {
        // Elevated plateaus on both sides of the river gorge so the landmasses sit well above water
        const t = (absDz - bankRimHalfW) / (plateauBlendHalfW - bankRimHalfW);
        const s = quinticSmooth(t);
        const bankHighY = dzRiver >= 0 ? southBankTargetY : northBankTargetY;
        const naturalH = Math.max(heights[idx], bankHighY - 0.18);
        heights[idx] = bankHighY * (1 - s) + naturalH * s;
      } else {
        // Ensure both the South Village Plateau and North Temple Highlands stay elevated above water
        const minLandY = dzRiver >= 0 ? southBankTargetY - 0.2 : northBankTargetY - 0.1;
        if (radialDist < worldRadius * 0.76 && heights[idx] < minLandY) {
          heights[idx] = minLandY + (heights[idx] - minLandY) * 0.25;
        }
      }

      // Flatten the main village building terraces & central road approach so walk-in buildings sit level
      if (Math.abs(vx - bridgeX) < 3.4 && absDz >= bankRimHalfW - 0.6 && absDz <= 28) {
        layers[idx] = 4; // cobblestone/dirt road path leading to bridge
      }
    }
  }

  // Add/update the flowing river water body across the gorge
  const riverPoints: [number, number][] = [
    [-worldRadius * 0.84, bridgeZ + Math.sin((-worldRadius * 0.84 - bridgeX) * 0.085) * 1.85],
    [-22, bridgeZ + Math.sin((-22 - bridgeX) * 0.085) * 1.85],
    [bridgeX - 7, bridgeZ],
    [bridgeX, bridgeZ],
    [bridgeX + 7, bridgeZ],
    [22, bridgeZ + Math.sin((22 - bridgeX) * 0.085) * 1.85],
    [worldRadius * 0.84, bridgeZ + Math.sin((worldRadius * 0.84 - bridgeX) * 0.085) * 1.85],
  ];

  const existingWater = (terrain.waterBodies ?? []).filter((w) => w.id !== 'wb-rpg-gorge-river');
  const gorgeRiver: WaterBodyConfig = {
    id: 'wb-rpg-gorge-river',
    name: 'Emerald Gorge River',
    kind: 'river',
    center: [bridgeX, bridgeZ],
    points: riverPoints,
    radiusX: worldRadius * 1.65,
    radiusZ: 5.4,
    width: 9.2,
    waterLevelOffset: 0.15,
    waterColor: '#2A9D8F',
    deepMurkColor: '#134E4A',
    opacity: 0.86,
    depth: 2.35,
    foamAmount: 0.65,
    waveSpeed: 0.9,
    windRipple: 0.6,
    flowSpeed: 0.85,
    flowAngleDeg: 0,
    bankSlope: 0.25,
    bankSmoothness: 0.6,
    shoreNoise: 0.08,
  };

  // Clear scatter trees/rocks from inside the river gorge, bridge approaches, and walk-in building lots
  const filteredScatter = (terrain.scatter ?? []).filter((item) => {
    const dxB = item.x - bridgeX;
    const meanderZ =
      bridgeZ + Math.sin(dxB * 0.085) * 1.85 * Math.min(1, Math.abs(dxB) / 6.5);
    if (Math.abs(item.z - meanderZ) < 6.8) return false; // inside river gorge
    if (Math.abs(item.x - bridgeX) < 4.5 && item.z >= bridgeZ - 14 && item.z <= bridgeZ + 40) {
      return false; // main village road & bridge approach
    }
    // Keep tavern (-14, 12), blacksmith (14, 11), cottage (-15, -2), and chicken yard (12, 22) clear of wild trees
    if (Math.hypot(item.x - -14, item.z - 12) < 9.2) return false;
    if (Math.hypot(item.x - 14, item.z - 11) < 8.2) return false;
    if (Math.hypot(item.x - -15, item.z - -2) < 7.2) return false;
    if (Math.hypot(item.x - 12, item.z - 22) < 6.2) return false;
    return true;
  });

  return {
    ...terrain,
    heights,
    layers,
    scatter: filteredScatter,
    waterBodies: [...existingWater, gorgeRiver],
    revision: terrain.revision + 1,
  };
}

export function applyRoadSplineToTerrain(
  rawTerrain: TerrainData,
  road: RoadSpline,
  regenerateBorder = true
): TerrainData {
  const terrain = ensureUpgradedTerrain(rawTerrain);
  if (road.points.length < 2) return terrain;
  const samples = samplePolylineSpline(road.points, Math.max(48, road.points.length * 16));
  const size = terrain.size;
  const width = size + 1;
  const worldRadius = getTerrainRadius(terrain);
  const step = (2 * worldRadius) / size;
  const heights = [...terrain.heights];
  const layers = [...terrain.layers];

  const innerHalf = Math.max(0.6, road.width * 0.5);
  const bankSpread = Math.max(0.35, (1.1 - road.bankSlopeAngle) * 1.4 + road.edgeTransition * 1.6);
  const outerHalf = innerHalf + bankSpread;
  const minSafeH = IslandTerrain.waterLevel + 0.45;

  for (let row = 0; row < width; row++) {
    for (let col = 0; col < width; col++) {
      const vx = -worldRadius + col * step;
      const vz = -worldRadius + row * step;
      const d = distToSpline(samples, vx, vz);
      if (d > outerHalf) continue;
      if (IslandRiver.distanceTo(vx, vz) < 5.2) continue;
      const idx = row * width + col;
      if (d <= innerHalf) {
        heights[idx] = Math.max(minSafeH, heights[idx] - road.recessDepth);
        layers[idx] = 6;
      } else {
        const s = (d - innerHalf) / Math.max(0.05, outerHalf - innerHalf);
        const w = 1 - quinticSmooth(s);
        heights[idx] = Math.max(minSafeH, heights[idx] - road.recessDepth * w);
        const edgeThreshold = 0.25 + (1 - road.edgeTransition) * 0.5;
        if (w > edgeThreshold) layers[idx] = 6;
      }
    }
  }

  let scatter = terrain.scatter;
  if (regenerateBorder && road.borderScatter !== 'none') {
    const rand = Math.max(0, Math.min(1, road.borderRandomness));
    const stepIdx = Math.max(2, Math.round(7 - road.borderDensity * 3.5));
    const added: ScatterItem[] = [];
    for (let i = 2; i < samples.length - 2; i += stepIdx) {
      const s = samples[i];
      if (IslandRiver.distanceTo(s.x, s.z) < 6.0) continue;
      const nx = -s.tz;
      const nz = s.tx;
      for (const side of [-1, 1]) {
        if (Math.random() > Math.min(1, road.borderDensity * 0.82)) continue;
        const offset = innerHalf + 0.65 + Math.random() * (0.8 + rand * 1.4);
        const sx = s.x + nx * side * offset + (Math.random() - 0.5) * rand * 0.8;
        const sz = s.z + nz * side * offset + (Math.random() - 0.5) * rand * 0.8;
        if (
          terrain.freeformWorld
            ? Math.abs(sx) > worldRadius * 0.95 || Math.abs(sz) > worldRadius * 0.95
            : Math.hypot(sx, sz) > worldRadius * 0.93
        ) {
          continue;
        }
        let kind: ScatterItem['kind'] = 'flower';
        if (road.borderScatter === 'grass') kind = 'tallGrass';
        else if (road.borderScatter === 'boulders') kind = 'rock';
        else if (road.borderScatter === 'custom' && road.borderCustomAssetId) kind = 'custom';
        else if (road.borderScatter === 'mixed') {
          const pick = Math.random();
          kind = pick < 0.42 ? 'flower' : pick < 0.78 ? 'tallGrass' : 'rock';
        }
        added.push({
          id: uid(),
          kind,
          customAssetId: kind === 'custom' ? road.borderCustomAssetId : undefined,
          x: sx,
          z: sz,
          size: 0.78 + Math.random() * (0.25 + rand * 0.45),
          rotation: Math.random() * Math.PI * 2,
        });
      }
    }
    scatter = [...scatter.slice(0, Math.max(0, 3600 - added.length)), ...added];
  }

  return {
    ...terrain,
    heights,
    layers,
    scatter,
    revision: terrain.revision + 1,
  };
}

export type Overview2DBrushId =
  | 'terrain'
  | 'coniferWoods'
  | 'deciduousWoods'
  | 'bushes'
  | 'wildflowers'
  | 'rocks'
  | 'hills'
  | 'beaches'
  | 'lakes'
  | 'rivers'
  | 'caves'
  | 'roads'
  | 'erase';

export function apply2DOverviewBrushStroke(
  rawTerrain: TerrainData,
  brushId: Overview2DBrushId,
  x: number,
  z: number,
  radius: number,
  density = 0.65,
  isStrokeStart = false
): TerrainData {
  const terrain = ensureUpgradedTerrain(rawTerrain);
  const size = terrain.size;
  const width = size + 1;
  const worldRadius = getTerrainRadius(terrain);
  const step = (2 * worldRadius) / size;
  const r = Math.max(2, radius);
  const minCol = Math.max(1, Math.floor(((x - r + worldRadius) / (2 * worldRadius)) * size) - 1);
  const maxCol = Math.min(size - 1, Math.ceil(((x + r + worldRadius) / (2 * worldRadius)) * size) + 1);
  const minRow = Math.max(1, Math.floor(((z - r + worldRadius) / (2 * worldRadius)) * size) - 1);
  const maxRow = Math.min(size - 1, Math.ceil(((z + r + worldRadius) / (2 * worldRadius)) * size) + 1);

  if (brushId === 'terrain') {
    const nextHeights = [...terrain.heights];
    const nextLayers = [...terrain.layers];
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const vx = -worldRadius + col * step;
        const vz = -worldRadius + row * step;
        const d = Math.hypot(vx - x, vz - z);
        if (d > r) continue;
        const idx = row * width + col;
        const soft = quinticSmooth(1 - d / r);
        const targetH = IslandTerrain.baseTop;
        if (nextHeights[idx] < targetH) {
          nextHeights[idx] = nextHeights[idx] + (targetH - nextHeights[idx]) * Math.min(1, soft * 0.92 + 0.12);
        }
        if (soft > 0.2 && nextHeights[idx] <= IslandTerrain.baseTop + 0.6) {
          nextLayers[idx] = 1; // warm yellow sand/terrain surface
        }
      }
    }
    return {
      ...terrain,
      heights: nextHeights,
      layers: nextLayers,
      freeformWorld: true,
      revision: terrain.revision + 1,
    };
  }

  if (brushId === 'hills') {
    return applyTerrainBrush(terrain, 'raiseGround', x, z, r, undefined, {
      strength: 0.45 + density * 0.85,
      falloff: 'smooth',
    });
  }
  if (brushId === 'beaches') {
    return applyTerrainBrush(terrain, 'paintSand', x, z, r);
  }
  if (brushId === 'caves') {
    if (!isStrokeStart) return terrain;
    return applyTerrainBrush(terrain, 'carveCave', x, z, Math.max(4.5, Math.min(10, r)));
  }

  if (brushId === 'lakes' || brushId === 'rivers') {
    const nextHeights = [...terrain.heights];
    const nextLayers = [...terrain.layers];
    const bedY = IslandTerrain.waterLevel - (brushId === 'lakes' ? 1.5 : 1.2);
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const vx = -worldRadius + col * step;
        const vz = -worldRadius + row * step;
        const d = Math.hypot(vx - x, vz - z);
        if (d > r) continue;
        const soft = quinticSmooth(1 - d / r);
        const idx = row * width + col;
        nextHeights[idx] = nextHeights[idx] * (1 - soft * 0.72) + bedY * (soft * 0.72);
        if (soft > 0.25) nextLayers[idx] = 1;
      }
    }
    const waterBodies = [...(terrain.waterBodies ?? createDefaultWaterBodies())];
    if (isStrokeStart && brushId === 'lakes') {
      const nearby = waterBodies.some(
        (wb) => wb.kind === 'lake' && Math.hypot(wb.center[0] - x, wb.center[1] - z) < r * 1.15
      );
      if (!nearby) {
        waterBodies.push({
          id: uid(),
          name: `Painted Lake ${waterBodies.length + 1}`,
          kind: 'lake',
          center: [x, z],
          radiusX: Math.max(6, r * 0.9),
          radiusZ: Math.max(6, r * 0.85),
          width: r * 1.2,
          waterLevelOffset: 0,
          waterColor: '#2E86AB',
          deepMurkColor: '#0C2D48',
          opacity: 0.86,
          depth: 2.3,
          foamAmount: 0.55,
          waveSpeed: 0.75,
          windRipple: 0.5,
          flowSpeed: 0.2,
          flowAngleDeg: 0,
          bankSlope: 0.6,
          bankSmoothness: 0.75,
          shoreNoise: 0.35,
        });
      }
    } else if (brushId === 'rivers') {
      let activeRiver = waterBodies.find((wb) => wb.id.startsWith('water-2d-river-'));
      if (isStrokeStart || !activeRiver) {
        activeRiver = {
          id: `water-2d-river-${uid()}`,
          name: `Painted Creek ${waterBodies.filter((w) => w.kind === 'river' || w.kind === 'stream').length + 1}`,
          kind: 'stream',
          center: [x, z],
          points: [[x, z]],
          radiusX: r,
          radiusZ: r,
          width: Math.max(3.2, r * 0.95),
          waterLevelOffset: 0,
          waterColor: '#2A9D8F',
          deepMurkColor: '#0E3E44',
          opacity: 0.84,
          depth: 1.5,
          foamAmount: 0.65,
          waveSpeed: 0.9,
          windRipple: 0.55,
          flowSpeed: 1.2,
          flowAngleDeg: 0,
          bankSlope: 0.5,
          bankSmoothness: 0.7,
          shoreNoise: 0.35,
        };
        waterBodies.push(activeRiver);
      } else {
        const pts = activeRiver.points ?? [activeRiver.center];
        const last = pts[pts.length - 1];
        if (!last || Math.hypot(last[0] - x, last[1] - z) >= 3.2) {
          const updatedPts: [number, number][] = [...pts, [x, z]];
          const idx = waterBodies.findIndex((w) => w.id === activeRiver!.id);
          if (idx >= 0) waterBodies[idx] = { ...activeRiver, points: updatedPts };
        }
      }
    }
    return {
      ...terrain,
      heights: nextHeights,
      layers: nextLayers,
      waterBodies,
      revision: terrain.revision + 1,
    };
  }

  if (brushId === 'roads') {
    const roadCfg = terrain.dirtAndRoadConfig ?? createDefaultDirtAndRoadConfig();
    const roads = [...(terrain.roads ?? [])];
    if (isStrokeStart || roads.length === 0) {
      roads.push({
        id: uid(),
        name: `Trail ${roads.length + 1}`,
        points: [[x, z]],
        width: Math.max(1.6, Math.min(6.0, r * 0.48)),
        recessDepth: roadCfg.defaultRoadRecess,
        bankSlopeAngle: roadCfg.defaultRoadBankAngle,
        edgeTransition: roadCfg.defaultRoadEdgeTransition,
        borderScatter: roadCfg.defaultBorderKind,
        borderDensity: roadCfg.defaultBorderDensity,
        borderRandomness: roadCfg.defaultBorderRandomness,
        borderCustomAssetId: roadCfg.defaultBorderAssetId,
      });
    } else {
      const lastRoad = roads[roads.length - 1];
      const prevPt = lastRoad.points[lastRoad.points.length - 1];
      if (!prevPt || Math.hypot(prevPt[0] - x, prevPt[1] - z) >= 2.5) {
        roads[roads.length - 1] = {
          ...lastRoad,
          points: [...lastRoad.points, [x, z]],
        };
      }
    }
    const painted = applyTerrainBrush(terrain, 'paintRoad', x, z, Math.max(2.2, r * 0.45), undefined, {
      strength: 0.9,
    });
    return { ...painted, roads };
  }

  if (brushId === 'erase') {
    const nextHeights = [...terrain.heights];
    const nextLayers = [...terrain.layers];
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const vx = -worldRadius + col * step;
        const vz = -worldRadius + row * step;
        const d = Math.hypot(vx - x, vz - z);
        if (d > r) continue;
        const soft = quinticSmooth(1 - d / r);
        const idx = row * width + col;
        nextHeights[idx] = nextHeights[idx] * (1 - soft * 0.55) + IslandTerrain.baseTop * (soft * 0.55);
        if (soft > 0.35) nextLayers[idx] = 0;
      }
    }
    const filteredScatter = terrain.scatter.filter((s) => Math.hypot(s.x - x, s.z - z) > r);
    const filteredCaves = (terrain.caves ?? []).filter((c) => Math.hypot(c.x - x, c.z - z) > r);
    return {
      ...terrain,
      heights: nextHeights,
      layers: nextLayers,
      scatter: filteredScatter,
      caves: filteredCaves,
      revision: terrain.revision + 1,
    };
  }

  // Generic botanical & boulder blocking brushes
  const targetCount = Math.max(1, Math.round(density * (brushId === 'wildflowers' ? 7 : 4)));
  const minSpacing = brushId === 'wildflowers' ? 1.1 : brushId === 'bushes' ? 1.8 : 2.6;
  const nextScatter = [...terrain.scatter];
  for (let i = 0; i < targetCount; i++) {
    if (nextScatter.length >= 3600) break;
    const ang = Math.random() * Math.PI * 2;
    const dist = Math.sqrt(Math.random()) * r;
    const sx = x + Math.cos(ang) * dist;
    const sz = z + Math.sin(ang) * dist;
    if (
      terrain.freeformWorld
        ? Math.abs(sx) >= worldRadius * 0.96 || Math.abs(sz) >= worldRadius * 0.96
        : Math.hypot(sx, sz) >= worldRadius * 0.94
    ) {
      continue;
    }
    if (nextScatter.some((item) => Math.hypot(item.x - sx, item.z - sz) < minSpacing)) continue;
    let kind: ScatterItem['kind'] = 'oak';
    if (brushId === 'coniferWoods') kind = 'pine';
    else if (brushId === 'deciduousWoods') kind = Math.random() < 0.32 ? 'birch' : 'oak';
    else if (brushId === 'bushes') kind = Math.random() < 0.3 ? 'berryBush' : 'bush';
    else if (brushId === 'wildflowers') kind = 'flower';
    else if (brushId === 'rocks') kind = 'rock';
    nextScatter.push({
      id: uid(),
      kind,
      x: sx,
      z: sz,
      size:
        kind === 'pine' || kind === 'oak' || kind === 'birch'
          ? 0.92 + Math.random() * 0.55
          : 0.78 + Math.random() * 0.48,
      rotation: Math.random() * Math.PI * 2,
    });
  }
  return { ...terrain, scatter: nextScatter, revision: terrain.revision + 1 };
}

