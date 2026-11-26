import type {
  GameLevel,
  GameProject,
  TerrainData,
  WorldLandRegion,
  WorldMapData,
} from '../types/maker';
import {
  IslandTerrain,
  createDefaultDirtAndRoadConfig,
  createDefaultMountainConfig,
  createInitialTerrain,
  getTerrainRadius,
  uid,
} from './terrain';
import { buildCanopyConfigFromUserDefaults } from './defaultTreeStyles';

export const WORLD_TERRAIN_YELLOW = '#E5C67E';
export const WORLD_BORDER_GRAY = '#6E7582';

/**
 * Original template island radius (156m) rounded up to 160m, then multiplied by 4 -> 640m radius (1280m x 1280m).
 * Each individual Land / Level map stays at IslandTerrain.radius (156m, 312m x 312m).
 */
export const WORLD_MAP_BASE_RADIUS = Math.ceil(IslandTerrain.radius / 10) * 10; // 160m
export const WORLD_MAP_SCALE = 4;
export const WORLD_MAP_RADIUS = WORLD_MAP_BASE_RADIUS * WORLD_MAP_SCALE; // 640m (1280m x 1280m)
export const WORLD_MAP_GRID_SIZE = 320; // 4m per grid cell across [-640, +640]

export const LAND_REGION_PALETTE = [
  '#20B46A', // Emerald Meadow
  '#F2545B', // Ember Coral
  '#0EA5E9', // Azure Coast
  '#A855F7', // Mystic Violet
  '#F59E0B', // Sunstone Gold
  '#EC4899', // Blossom Rose
  '#14B8A6', // Seafoam Vale
  '#6366F1', // Twilight Indigo
  '#84CC16', // Moss Highlands
  '#F97316', // Canyon Ochre
];

export type WorldMapBrushMode = 'terrain' | 'eraseTerrain' | 'paintLand' | 'clearLand';

export function getWorldMapRadius(worldMap?: Pick<WorldMapData, 'worldRadius'>): number {
  return worldMap?.worldRadius && worldMap.worldRadius > 0
    ? worldMap.worldRadius
    : WORLD_MAP_RADIUS;
}

export function getRegionOrigin(region?: Pick<WorldLandRegion, 'origin'>): [number, number] {
  return region?.origin ?? [0, 0];
}

export function clampRegionOrigin(
  x: number,
  z: number,
  worldRadius = WORLD_MAP_RADIUS
): [number, number] {
  const maxOffset = Math.max(0, worldRadius - 24);
  return [
    Math.round(Math.max(-maxOffset, Math.min(maxOffset, x))),
    Math.round(Math.max(-maxOffset, Math.min(maxOffset, z))),
  ];
}

export function landLocalToWorldMap(
  localX: number,
  localZ: number,
  origin?: [number, number]
): [number, number] {
  const ox = origin?.[0] ?? 0;
  const oz = origin?.[1] ?? 0;
  return [ox + localX, oz + localZ];
}

export function worldMapToLandLocal(
  worldX: number,
  worldZ: number,
  origin?: [number, number]
): [number, number] {
  const ox = origin?.[0] ?? 0;
  const oz = origin?.[1] ?? 0;
  return [worldX - ox, worldZ - oz];
}

export function createEmptyWorldMap(): WorldMapData {
  const size = WORLD_MAP_GRID_SIZE;
  const count = (size + 1) * (size + 1);
  return {
    gridSize: size,
    worldRadius: WORLD_MAP_RADIUS,
    landMask: new Array(count).fill(0),
    regionGrid: new Array(count).fill(0),
    regions: [],
    revision: 1,
  };
}

export function createScratchOceanTerrain(): TerrainData {
  const size = IslandTerrain.gridSize;
  const count = (size + 1) * (size + 1);
  return {
    size,
    heights: new Array(count).fill(IslandTerrain.seaFloor),
    layers: new Array(count).fill(1),
    scatter: [],
    caves: [],
    mountainConfig: createDefaultMountainConfig(),
    waterBodies: [],
    dirtAndRoadConfig: createDefaultDirtAndRoadConfig(),
    roads: [],
    freeformWorld: true,
    revision: 1,
  };
}

export function ensureWorldMapForProject(project: GameProject): WorldMapData {
  const size = WORLD_MAP_GRID_SIZE;
  const targetRadius = WORLD_MAP_RADIUS;
  const expectedLen = (size + 1) * (size + 1);
  const existing = project.worldMap;
  if (
    existing &&
    existing.worldRadius === targetRadius &&
    existing.gridSize === size &&
    existing.landMask.length === expectedLen &&
    existing.regionGrid.length === expectedLen
  ) {
    return existing;
  }

  const landMask = new Array<number>(expectedLen).fill(0);
  const regionGrid = new Array<number>(expectedLen).fill(0);
  const width = size + 1;

  // Upgrade legacy 1:1 (156m / 156-grid) WorldMap into the center of the 4x (640m / 320-grid) WorldMap
  if (
    existing &&
    existing.gridSize > 0 &&
    existing.landMask.length === (existing.gridSize + 1) * (existing.gridSize + 1) &&
    existing.regionGrid.length === existing.landMask.length
  ) {
    const oldSize = existing.gridSize;
    const oldWidth = oldSize + 1;
    const oldRadius =
      existing.worldRadius && existing.worldRadius > 0
        ? existing.worldRadius
        : IslandTerrain.radius;
    const targetStep = (2 * targetRadius) / size;

    for (let row = 0; row <= size; row++) {
      const wz = -targetRadius + row * targetStep;
      if (Math.abs(wz) > oldRadius + 0.01) continue;
      const oldRow = Math.max(
        0,
        Math.min(oldSize, Math.round(((wz + oldRadius) / (2 * oldRadius)) * oldSize))
      );
      for (let col = 0; col <= size; col++) {
        const wx = -targetRadius + col * targetStep;
        if (Math.abs(wx) > oldRadius + 0.01) continue;
        const oldCol = Math.max(
          0,
          Math.min(oldSize, Math.round(((wx + oldRadius) / (2 * oldRadius)) * oldSize))
        );
        const oldIdx = oldRow * oldWidth + oldCol;
        if (existing.landMask[oldIdx] === 1) {
          const idx = row * width + col;
          landMask[idx] = 1;
          regionGrid[idx] = existing.regionGrid[oldIdx] ?? 0;
        }
      }
    }

    return {
      gridSize: size,
      worldRadius: targetRadius,
      landMask,
      regionGrid,
      regions: existing.regions.map((r) => ({
        ...r,
        origin: r.origin ?? [0, 0],
      })),
      revision: (existing.revision ?? 1) + 1,
    };
  }

  const firstOpenLevel =
    project.levels.find((l) => !l.environmentType || l.environmentType === 'openWorld') ??
    project.levels[0];

  const regions: WorldLandRegion[] = [];

  if (firstOpenLevel) {
    const srcTerrain = firstOpenLevel.terrain ?? createInitialTerrain();
    const srcSize = srcTerrain.size;
    const srcWidth = srcSize + 1;
    const srcRadius = IslandTerrain.radius;
    const regionCode = 1;
    regions.push({
      id: `region-${firstOpenLevel.id}`,
      code: regionCode,
      name: firstOpenLevel.name || 'Land 1',
      colorHex: LAND_REGION_PALETTE[0],
      levelId: firstOpenLevel.id,
      origin: [0, 0],
    });
    if (srcTerrain.heights.length === srcWidth * srcWidth) {
      const targetStep = (2 * targetRadius) / size;
      for (let row = 0; row <= size; row++) {
        const wz = -targetRadius + row * targetStep;
        if (Math.abs(wz) > srcRadius + 0.01) continue;
        const srcRow = Math.max(
          0,
          Math.min(srcSize, Math.round(((wz + srcRadius) / (2 * srcRadius)) * srcSize))
        );
        for (let col = 0; col <= size; col++) {
          const wx = -targetRadius + col * targetStep;
          if (Math.abs(wx) > srcRadius + 0.01) continue;
          const srcCol = Math.max(
            0,
            Math.min(srcSize, Math.round(((wx + srcRadius) / (2 * srcRadius)) * srcSize))
          );
          if (srcTerrain.heights[srcRow * srcWidth + srcCol] > IslandTerrain.waterLevel - 0.15) {
            const idx = row * width + col;
            landMask[idx] = 1;
            regionGrid[idx] = regionCode;
          }
        }
      }
    }
  }

  return {
    gridSize: size,
    worldRadius: targetRadius,
    landMask,
    regionGrid,
    regions,
    revision: 1,
  };
}

export interface WorldMapSample {
  land: number;
  regionCode: number;
  isBorder: boolean;
}

export interface CompactStoredWorldMapData extends Omit<WorldMapData, 'landMask' | 'regionGrid'> {
  landMask?: number[];
  regionGrid?: number[];
  landMaskRle?: number[];
  regionGridRle?: number[];
}

export function encodeNumberArrayRle(arr: readonly number[]): number[] {
  const len = arr.length;
  if (len === 0) return [];
  const out: number[] = [];
  let cur = arr[0] ?? 0;
  let count = 1;
  for (let i = 1; i < len; i++) {
    const v = arr[i] ?? 0;
    if (v === cur) {
      count++;
    } else {
      out.push(cur, count);
      cur = v;
      count = 1;
    }
  }
  out.push(cur, count);
  return out;
}

export function decodeNumberArrayRle(
  rle: readonly number[],
  expectedLength?: number
): number[] {
  let total = 0;
  for (let i = 1; i < rle.length; i += 2) {
    const cnt = rle[i];
    if (cnt > 0) total += cnt;
  }
  const len = expectedLength && expectedLength > 0 ? expectedLength : total;
  const out = new Array<number>(len).fill(0);
  let ptr = 0;
  for (let i = 0; i + 1 < rle.length && ptr < len; i += 2) {
    const val = rle[i] ?? 0;
    const cnt = rle[i + 1] ?? 0;
    const end = Math.min(len, ptr + Math.max(0, cnt));
    for (; ptr < end; ptr++) {
      out[ptr] = val;
    }
  }
  return out;
}

export function compactWorldMapForStorage(worldMap: WorldMapData): CompactStoredWorldMapData {
  return {
    gridSize: worldMap.gridSize,
    worldRadius: worldMap.worldRadius,
    regions: worldMap.regions,
    revision: worldMap.revision,
    landMaskRle: encodeNumberArrayRle(worldMap.landMask),
    regionGridRle: encodeNumberArrayRle(worldMap.regionGrid),
  };
}

export function hydrateWorldMapFromStorage(
  raw: CompactStoredWorldMapData | WorldMapData | undefined
): WorldMapData | undefined {
  if (!raw) return undefined;
  const gridSize = raw.gridSize ?? WORLD_MAP_GRID_SIZE;
  const expectedLen = (gridSize + 1) * (gridSize + 1);
  const compact = raw as CompactStoredWorldMapData;
  const landMask = Array.isArray(compact.landMaskRle)
    ? decodeNumberArrayRle(compact.landMaskRle, expectedLen)
    : Array.isArray(compact.landMask)
    ? compact.landMask
    : [];
  const regionGrid = Array.isArray(compact.regionGridRle)
    ? decodeNumberArrayRle(compact.regionGridRle, expectedLen)
    : Array.isArray(compact.regionGrid)
    ? compact.regionGrid
    : [];
  return {
    gridSize,
    worldRadius: raw.worldRadius,
    landMask,
    regionGrid,
    regions: raw.regions ?? [],
    revision: raw.revision ?? 1,
  };
}

export function sampleWorldMapInto(
  worldMap: WorldMapData | undefined,
  x: number,
  z: number,
  out: WorldMapSample
): WorldMapSample {
  if (!worldMap || worldMap.landMask.length === 0) {
    out.land = 0;
    out.regionCode = 0;
    out.isBorder = false;
    return out;
  }
  const r = worldMap.worldRadius && worldMap.worldRadius > 0 ? worldMap.worldRadius : WORLD_MAP_RADIUS;
  if (x < -r || x > r || z < -r || z > r) {
    out.land = 0;
    out.regionCode = 0;
    out.isBorder = false;
    return out;
  }
  const size = worldMap.gridSize;
  const width = size + 1;
  const invTwoR = size / (2 * r);
  const col = Math.max(0, Math.min(size, Math.round((x + r) * invTwoR)));
  const row = Math.max(0, Math.min(size, Math.round((z + r) * invTwoR)));
  const idx = row * width + col;
  const landMask = worldMap.landMask;
  const regionGrid = worldMap.regionGrid;
  const land = landMask[idx] ?? 0;
  const regionCode = regionGrid[idx] ?? 0;

  let isBorder = false;
  if (land === 1) {
    if (row > 0) {
      const ni = idx - width;
      if (landMask[ni] === 0 || regionGrid[ni] !== regionCode) isBorder = true;
    }
    if (!isBorder && row < size) {
      const ni = idx + width;
      if (landMask[ni] === 0 || regionGrid[ni] !== regionCode) isBorder = true;
    }
    if (!isBorder && col > 0) {
      const ni = idx - 1;
      if (landMask[ni] === 0 || regionGrid[ni] !== regionCode) isBorder = true;
    }
    if (!isBorder && col < size) {
      const ni = idx + 1;
      if (landMask[ni] === 0 || regionGrid[ni] !== regionCode) isBorder = true;
    }
  }

  out.land = land;
  out.regionCode = regionCode;
  out.isBorder = isBorder;
  return out;
}

export function sampleWorldMapAtWorld(
  worldMap: WorldMapData | undefined,
  x: number,
  z: number
): WorldMapSample {
  return sampleWorldMapInto(worldMap, x, z, { land: 0, regionCode: 0, isBorder: false });
}

export function sampleWorldMapForLand(
  worldMap: WorldMapData | undefined,
  localX: number,
  localZ: number,
  regionOrigin?: [number, number]
): { land: number; regionCode: number; isBorder: boolean } {
  const ox = regionOrigin?.[0] ?? 0;
  const oz = regionOrigin?.[1] ?? 0;
  return sampleWorldMapAtWorld(worldMap, ox + localX, oz + localZ);
}

export function applyWorldMapStroke(
  worldMap: WorldMapData,
  mode: WorldMapBrushMode,
  x: number,
  z: number,
  radius: number,
  regionCode?: number,
  autoFillOcean = false
): WorldMapData {
  const size = worldMap.gridSize;
  const width = size + 1;
  const worldRadius = getWorldMapRadius(worldMap);
  const step = (2 * worldRadius) / size;
  const r = Math.max(2, radius);
  const rSq = r * r;

  const minCol = Math.max(1, Math.floor(((x - r + worldRadius) / (2 * worldRadius)) * size) - 1);
  const maxCol = Math.min(size - 1, Math.ceil(((x + r + worldRadius) / (2 * worldRadius)) * size) + 1);
  const minRow = Math.max(1, Math.floor(((z - r + worldRadius) / (2 * worldRadius)) * size) - 1);
  const maxRow = Math.min(size - 1, Math.ceil(((z + r + worldRadius) / (2 * worldRadius)) * size) + 1);

  const srcLand = worldMap.landMask;
  const srcRegion = worldMap.regionGrid;
  let landMask: number[] | null = null;
  let regionGrid: number[] | null = null;

  const ensureCopy = () => {
    if (!landMask) landMask = srcLand.slice();
    if (!regionGrid) regionGrid = srcRegion.slice();
  };

  for (let row = minRow; row <= maxRow; row++) {
    const vz = -worldRadius + row * step;
    const dz = vz - z;
    const dzSq = dz * dz;
    if (dzSq > rSq) continue;
    const rowOff = row * width;

    for (let col = minCol; col <= maxCol; col++) {
      const vx = -worldRadius + col * step;
      const dx = vx - x;
      if (dx * dx + dzSq > rSq) continue;
      const idx = rowOff + col;
      const curLand = (landMask ?? srcLand)[idx];
      const curReg = (regionGrid ?? srcRegion)[idx];

      if (mode === 'terrain') {
        const needLand = curLand !== 1;
        const needReg = Boolean(regionCode && regionCode > 0 && curReg !== regionCode);
        if (needLand || needReg) {
          ensureCopy();
          if (needLand) landMask![idx] = 1;
          if (needReg) regionGrid![idx] = regionCode!;
        }
      } else if (mode === 'eraseTerrain') {
        if (curLand !== 0 || curReg !== 0) {
          ensureCopy();
          landMask![idx] = 0;
          regionGrid![idx] = 0;
        }
      } else if (mode === 'paintLand' && regionCode && regionCode > 0) {
        if (curLand === 1 || autoFillOcean) {
          const needLand = curLand !== 1;
          const needReg = curReg !== regionCode;
          if (needLand || needReg) {
            ensureCopy();
            if (needLand) landMask![idx] = 1;
            if (needReg) regionGrid![idx] = regionCode;
          }
        }
      } else if (mode === 'clearLand') {
        if (curReg !== 0) {
          ensureCopy();
          regionGrid![idx] = 0;
        }
      }
    }
  }

  if (!landMask || !regionGrid) return worldMap;

  return {
    ...worldMap,
    landMask,
    regionGrid,
    revision: worldMap.revision + 1,
  };
}

export function computeRegionWindowRadius(
  worldMap: WorldMapData,
  activeRegionCode?: number,
  regionOrigin?: [number, number]
): number {
  if (!activeRegionCode || activeRegionCode <= 0) {
    return IslandTerrain.radius;
  }
  const bounds = computeRegionBounds(worldMap, activeRegionCode);
  if (!bounds || bounds.cellCount === 0) {
    return IslandTerrain.radius;
  }
  const ox = regionOrigin?.[0] ?? bounds.centerX;
  const oz = regionOrigin?.[1] ?? bounds.centerZ;
  const halfExtent = Math.max(
    Math.abs(bounds.maxX - ox),
    Math.abs(bounds.minX - ox),
    Math.abs(bounds.maxZ - oz),
    Math.abs(bounds.minZ - oz)
  );
  const maxAllowed = getWorldMapRadius(worldMap);
  const rounded = Math.ceil((halfExtent + 16) / 10) * 10;
  return Math.max(IslandTerrain.radius, Math.min(maxAllowed, rounded));
}

export function hasManualTerrainEdits(terrain?: TerrainData | null): boolean {
  if (!terrain) return false;
  if (
    terrain.scatter.length > 0 ||
    (terrain.caves?.length ?? 0) > 0 ||
    (terrain.roads?.length ?? 0) > 0 ||
    (terrain.waterBodies?.length ?? 0) > 0
  ) {
    return true;
  }
  for (let i = 0; i < terrain.heights.length; i++) {
    if (terrain.heights[i] > IslandTerrain.baseTop + 0.35) return true;
  }
  for (let i = 0; i < terrain.layers.length; i++) {
    if ((terrain.layers[i] ?? 0) >= 2) return true;
  }
  return false;
}

export function syncLevelTerrainWithWorldMap(
  rawTerrain: TerrainData | undefined,
  worldMap: WorldMapData,
  activeRegionCode?: number,
  regionOrigin?: [number, number]
): TerrainData {
  const localRadius = computeRegionWindowRadius(worldMap, activeRegionCode, regionOrigin);
  const oldRadius = getTerrainRadius(rawTerrain);
  const scaleChanged = Math.abs(oldRadius - localRadius) > 0.5;
  const hasValidRaw = Boolean(rawTerrain && rawTerrain.size === IslandTerrain.gridSize);

  let base: TerrainData;
  let heights: number[];
  let layers: number[];
  let weathering: number[] | undefined;

  if (!hasValidRaw) {
    base = createScratchOceanTerrain();
    heights = [...base.heights];
    layers = [...base.layers];
    weathering = base.weathering;
  } else if (scaleChanged) {
    if (hasManualTerrainEdits(rawTerrain)) {
      base = rawTerrain!;
      const size = base.size;
      const width = size + 1;
      const localStep = (2 * localRadius) / size;
      heights = new Array<number>(width * width).fill(IslandTerrain.seaFloor);
      layers = new Array<number>(width * width).fill(1);
      weathering = base.weathering ? new Array<number>(width * width).fill(0) : undefined;
      for (let row = 0; row <= size; row++) {
        const vz = -localRadius + row * localStep;
        if (Math.abs(vz) > oldRadius) continue;
        const srcRow = Math.max(
          0,
          Math.min(size, Math.round(((vz + oldRadius) / (2 * oldRadius)) * size))
        );
        for (let col = 0; col <= size; col++) {
          const vx = -localRadius + col * localStep;
          if (Math.abs(vx) > oldRadius) continue;
          const srcCol = Math.max(
            0,
            Math.min(size, Math.round(((vx + oldRadius) / (2 * oldRadius)) * size))
          );
          const dstIdx = row * width + col;
          const srcIdx = srcRow * width + srcCol;
          heights[dstIdx] = base.heights[srcIdx];
          layers[dstIdx] = base.layers[srcIdx];
          if (weathering && base.weathering) {
            weathering[dstIdx] = base.weathering[srcIdx];
          }
        }
      }
    } else {
      const fresh = createScratchOceanTerrain();
      base = {
        ...fresh,
        mountainConfig: rawTerrain?.mountainConfig ?? fresh.mountainConfig,
        dirtAndRoadConfig: rawTerrain?.dirtAndRoadConfig ?? fresh.dirtAndRoadConfig,
      };
      heights = [...base.heights];
      layers = [...base.layers];
      weathering = base.weathering;
    }
  } else {
    base = rawTerrain!;
    heights = [...base.heights];
    layers = [...base.layers];
    weathering = base.weathering;
  }

  const size = base.size;
  const width = size + 1;
  const localStep = (2 * localRadius) / size;
  const ox = regionOrigin?.[0] ?? 0;
  const oz = regionOrigin?.[1] ?? 0;

  // Sample the 4x WorldMap window centered at [ox, oz] onto this Land's local grid
  const localLandMask = new Uint8Array(width * width);
  const localRegionGrid = new Uint16Array(width * width);
  const wmSample: WorldMapSample = { land: 0, regionCode: 0, isBorder: false };
  for (let row = 0; row <= size; row++) {
    const wz = oz + (-localRadius + row * localStep);
    const rowOff = row * width;
    for (let col = 0; col <= size; col++) {
      const wx = ox + (-localRadius + col * localStep);
      sampleWorldMapInto(worldMap, wx, wz, wmSample);
      const idx = rowOff + col;
      localLandMask[idx] = wmSample.land;
      localRegionGrid[idx] = wmSample.regionCode;
    }
  }

  for (let row = 0; row <= size; row++) {
    for (let col = 0; col <= size; col++) {
      const idx = row * width + col;
      const hasLand = localLandMask[idx] === 1;

      if (!hasLand) {
        if (heights[idx] > IslandTerrain.waterLevel - 0.6) {
          // Gentle underwater transition if touching a land cell
          const touchesLand =
            (row > 0 && localLandMask[(row - 1) * width + col] === 1) ||
            (row < size && localLandMask[(row + 1) * width + col] === 1) ||
            (col > 0 && localLandMask[row * width + (col - 1)] === 1) ||
            (col < size && localLandMask[row * width + (col + 1)] === 1);
          heights[idx] = touchesLand ? IslandTerrain.waterLevel - 0.7 : IslandTerrain.seaFloor;
        } else {
          heights[idx] = Math.min(heights[idx], IslandTerrain.waterLevel - 0.65);
        }
        layers[idx] = 1;
        continue;
      }

      const cellCode = localRegionGrid[idx] ?? 0;
      const isCoast =
        row === 0 ||
        row === size ||
        col === 0 ||
        col === size ||
        localLandMask[(row - 1) * width + col] === 0 ||
        localLandMask[(row + 1) * width + col] === 0 ||
        localLandMask[row * width + (col - 1)] === 0 ||
        localLandMask[row * width + (col + 1)] === 0;

      const isOtherLand =
        activeRegionCode !== undefined &&
        activeRegionCode > 0 &&
        cellCode !== activeRegionCode;

      if (isOtherLand) {
        // Keep neighboring / bordering lands visible as calm landmass (rendered gray in 2D & 3D)
        if (heights[idx] < IslandTerrain.waterLevel + 0.1) {
          heights[idx] = isCoast ? 0.25 : IslandTerrain.baseTop;
        }
      } else {
        // Active land: preserve sculpted height above sea, raise newly added terrain cells
        if (heights[idx] < IslandTerrain.waterLevel - 0.15) {
          heights[idx] = isCoast ? 0.3 : IslandTerrain.baseTop;
          layers[idx] = isCoast ? 1 : 0;
        } else if (!isCoast && Math.abs(heights[idx] - 0.3) < 0.05 && layers[idx] === 1) {
          heights[idx] = IslandTerrain.baseTop;
          layers[idx] = 0;
        } else if (isCoast && Math.abs(heights[idx] - IslandTerrain.baseTop) < 0.05 && layers[idx] === 0) {
          heights[idx] = 0.3;
          layers[idx] = 1;
        }
      }
    }
  }

  return {
    ...base,
    heights,
    layers,
    weathering,
    waterBodies: base.waterBodies ?? [],
    freeformWorld: true,
    worldRadius: localRadius,
    revision: (base.revision ?? 1) + 1,
  };
}

export interface RegionBoundsResult {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  centerX: number;
  centerZ: number;
  centroidX: number;
  centroidZ: number;
  cellCount: number;
}

export function computeRegionBounds(
  worldMap: WorldMapData,
  regionCode: number
): RegionBoundsResult | null {
  if (!regionCode || regionCode <= 0) return null;
  const size = worldMap.gridSize;
  const width = size + 1;
  const r = getWorldMapRadius(worldMap);
  const step = (2 * r) / size;

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let sx = 0;
  let sz = 0;
  let count = 0;

  for (let row = 0; row <= size; row++) {
    const vz = -r + row * step;
    const rowOff = row * width;
    for (let col = 0; col <= size; col++) {
      const idx = rowOff + col;
      if (worldMap.landMask[idx] !== 1) continue;
      if ((worldMap.regionGrid[idx] ?? 0) !== regionCode) continue;
      const vx = -r + col * step;
      if (vx < minX) minX = vx;
      if (vx > maxX) maxX = vx;
      if (vz < minZ) minZ = vz;
      if (vz > maxZ) maxZ = vz;
      sx += vx;
      sz += vz;
      count += 1;
    }
  }

  if (count === 0) return null;
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    centerX: (minX + maxX) * 0.5,
    centerZ: (minZ + maxZ) * 0.5,
    centroidX: sx / count,
    centroidZ: sz / count,
    cellCount: count,
  };
}

export function computeRegionCentroids(
  worldMap: WorldMapData
): Map<number, { x: number; z: number; cellCount: number }> {
  const size = worldMap.gridSize;
  const width = size + 1;
  const r = getWorldMapRadius(worldMap);
  const step = (2 * r) / size;
  const accum = new Map<number, { sx: number; sz: number; count: number }>();

  for (let row = 0; row <= size; row++) {
    const vz = -r + row * step;
    for (let col = 0; col <= size; col++) {
      if (worldMap.landMask[row * width + col] !== 1) continue;
      const code = worldMap.regionGrid[row * width + col] ?? 0;
      if (code <= 0) continue;
      const vx = -r + col * step;
      const entry = accum.get(code);
      if (entry) {
        entry.sx += vx;
        entry.sz += vz;
        entry.count += 1;
      } else {
        accum.set(code, { sx: vx, sz: vz, count: 1 });
      }
    }
  }

  const out = new Map<number, { x: number; z: number; cellCount: number }>();
  accum.forEach((v, code) => {
    if (v.count > 0) {
      out.set(code, {
        x: v.sx / v.count,
        z: v.sz / v.count,
        cellCount: v.count,
      });
    }
  });
  return out;
}

export function findNextRegionCode(regions: WorldLandRegion[]): number {
  const used = new Set(regions.map((r) => r.code));
  for (let c = 1; c < 255; c++) {
    if (!used.has(c)) return c;
  }
  return regions.length + 1;
}

export function pickNextRegionColor(regions: WorldLandRegion[]): string {
  const used = new Set(regions.map((r) => r.colorHex.toUpperCase()));
  for (const hex of LAND_REGION_PALETTE) {
    if (!used.has(hex.toUpperCase())) return hex;
  }
  return LAND_REGION_PALETTE[regions.length % LAND_REGION_PALETTE.length];
}

export function createLandLevelFromTemplate(
  baseLevel: GameLevel | undefined,
  name: string,
  worldMap: WorldMapData,
  regionCode: number,
  regionOrigin?: [number, number]
): GameLevel {
  const levelId = uid();
  const terrain = syncLevelTerrainWithWorldMap(
    createScratchOceanTerrain(),
    worldMap,
    regionCode,
    regionOrigin
  );
  return {
    id: levelId,
    name,
    style: 'openWorld',
    environmentType: 'openWorld',
    visualStyle: baseLevel?.visualStyle ?? 'painterlyPBR',
    biome: baseLevel?.biome ?? 'meadow',
    sky: baseLevel?.sky ?? 'sunny',
    sunAngle: baseLevel?.sunAngle ?? 38,
    timeOfDay: baseLevel?.timeOfDay,
    fog: baseLevel?.fog ?? 0.25,
    hasStart: true,
    hasPortal: true,
    completeCondition: 'reachPortal',
    requiredCount: 0,
    objectives: [
      { id: uid(), text: `Explore ${name}`, isOptional: false },
    ],
    entities: [],
    terrain,
    grass: baseLevel?.grass
      ? { ...baseLevel.grass }
      : {
          enabled: true,
          quality: 'lush',
          viewDistance: 55,
          bladeHeight: 0.72,
          bladeWidth: 0.09,
          windWaveStrength: 0.85,
          tipGlow: 0.22,
          interactiveParting: true,
        },
    audio: baseLevel?.audio
      ? { ...baseLevel.audio }
      : {
          mood: 'adventure',
          coin: 'coin',
          hit: 'hit',
          door: 'creak',
          portal: 'chime',
          jump: 'jump',
          step: 'step',
        },
    weather: 'none',
    vistaPreset: 'coastalArchipelago',
    vistaDensity: 0.7,
    canopyEngine: baseLevel?.canopyEngine?.enabled
      ? buildCanopyConfigFromUserDefaults(JSON.parse(JSON.stringify(baseLevel.canopyEngine)))
      : buildCanopyConfigFromUserDefaults(baseLevel?.canopyEngine),
    wind: baseLevel?.wind ?? 0.45,
    canSwim: true,
    notes: '',
    startPoint: { x: 0.5, y: 0.55 },
    portalPoint: { x: 0.56, y: 0.44 },
  };
}
