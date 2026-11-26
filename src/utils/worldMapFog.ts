import type {
  BoardPoint,
  GameLevel,
  GameProject,
  HeroEquipment,
  InventoryStack,
} from '../types/maker';
import { getEnvironmentType, getTerrainRadius, levelBoardToWorld } from './terrain';
import { getWorldMapRadius } from './worldMap';

export const EXPLORE_GRID_SIZE = 128;

export interface SavePlinthTarget {
  key: string;
  entityId: string;
  levelId: string;
  levelName: string;
  regionCode?: number;
  regionColorHex?: string;
  name: string;
  position: BoardPoint;
  localX: number;
  localZ: number;
  mapX: number;
  mapZ: number;
}

export interface SavedPlayProgress {
  projectId: string;
  savedAt: number;
  levelId: string;
  levelName: string;
  plinthEntityId: string;
  plinthName: string;
  localX: number;
  localZ: number;
  coins: number;
  keys: number;
  health: number;
  maxHealth: number;
  inventoryStacks: InventoryStack[];
  equipment: HeroEquipment;
  discoveredPlinthKeys: string[];
  explorationB64?: string;
}

export interface PendingPlinthTravel {
  projectId: string;
  levelId: string;
  plinthEntityId: string;
  plinthName: string;
  localX: number;
  localZ: number;
  coins: number;
  keys: number;
  health: number;
  maxHealth: number;
  inventoryStacks: InventoryStack[];
  equipment: HeroEquipment;
}

export function makePlinthKey(levelId: string, entityId: string): string {
  return `${levelId}::${entityId}`;
}

export interface EffectiveMapBoundsInfo {
  isWorldMap: boolean;
  radius: number;
  originX: number;
  originZ: number;
}

export function getEffectiveMapInfo(
  project: GameProject,
  level: GameLevel
): EffectiveMapBoundsInfo {
  const env = getEnvironmentType(level);
  const wm = project.worldMap;
  const region = wm?.regions.find((r) => r.levelId === level.id);
  if (wm && (env === 'openWorld' || Boolean(region))) {
    return {
      isWorldMap: true,
      radius: getWorldMapRadius(wm),
      originX: region?.origin?.[0] ?? 0,
      originZ: region?.origin?.[1] ?? 0,
    };
  }
  const localRadius = env === 'openWorld' ? getTerrainRadius(level.terrain) : 44;
  return {
    isWorldMap: false,
    radius: localRadius,
    originX: 0,
    originZ: 0,
  };
}

export function levelLocalToMapCoords(
  project: GameProject,
  level: GameLevel,
  localX: number,
  localZ: number
): [number, number] {
  const info = getEffectiveMapInfo(project, level);
  return [info.originX + localX, info.originZ + localZ];
}

export function isSavePlinthEntity(ent: {
  kind?: string;
  name?: string;
  propPreset?: string;
}): boolean {
  if (ent.propPreset === 'savePlinth') return true;
  if (ent.kind === 'checkpoint') {
    const lower = (ent.name ?? '').toLowerCase();
    return lower.includes('plinth') || lower.includes('waystone') || lower.includes('save point');
  }
  return false;
}

export function findSavePlinthTargets(project: GameProject): SavePlinthTarget[] {
  const out: SavePlinthTarget[] = [];
  const wm = project.worldMap;
  for (const lvl of project.levels) {
    const region = wm?.regions.find((r) => r.levelId === lvl.id);
    for (const ent of lvl.entities) {
      if (!isSavePlinthEntity(ent)) continue;
      const [localX, localZ] = levelBoardToWorld(lvl, ent.position);
      const [mapX, mapZ] = levelLocalToMapCoords(project, lvl, localX, localZ);
      out.push({
        key: makePlinthKey(lvl.id, ent.id),
        entityId: ent.id,
        levelId: lvl.id,
        levelName: region?.name ?? lvl.name,
        regionCode: region?.code,
        regionColorHex: region?.colorHex,
        name: ent.name || 'Save Plinth',
        position: ent.position,
        localX,
        localZ,
        mapX,
        mapZ,
      });
    }
  }
  return out;
}

// --- Zero-churn Preallocated Exploration Grid ---

interface ExplorationEntry {
  data: Uint8Array;
  revision: number;
}

const explorationByProject = new Map<string, ExplorationEntry>();
const explorationListeners = new Set<(projectId: string) => void>();

function ensureExplorationEntry(projectId: string): ExplorationEntry {
  let entry = explorationByProject.get(projectId);
  if (!entry) {
    entry = {
      data: new Uint8Array(EXPLORE_GRID_SIZE * EXPLORE_GRID_SIZE),
      revision: 1,
    };
    explorationByProject.set(projectId, entry);
  }
  return entry;
}

export function getExplorationSnapshot(projectId: string): {
  data: Uint8Array;
  revision: number;
} {
  return ensureExplorationEntry(projectId);
}

export function subscribeExploration(listener: (projectId: string) => void): () => void {
  explorationListeners.add(listener);
  return () => {
    explorationListeners.delete(listener);
  };
}

function emitExplorationChange(projectId: string): void {
  explorationListeners.forEach((fn) => fn(projectId));
}

export function resetExploration(projectId: string): void {
  const entry = ensureExplorationEntry(projectId);
  entry.data.fill(0);
  entry.revision++;
  emitExplorationChange(projectId);
}

export function revealExplorationAtCoords(
  projectId: string,
  mapX: number,
  mapZ: number,
  mapRadius: number,
  revealRadiusMeters: number
): boolean {
  if (!projectId || mapRadius <= 0) return false;
  const entry = ensureExplorationEntry(projectId);
  const size = EXPLORE_GRID_SIZE;
  const data = entry.data;
  const span = 2 * mapRadius;
  const uCenter = (mapX + mapRadius) / span;
  const vCenter = (mapZ + mapRadius) / span;
  const rGrid = (revealRadiusMeters / span) * size;
  const rGridSq = rGrid * rGrid;

  const colCenter = uCenter * (size - 1);
  const rowCenter = vCenter * (size - 1);
  const cMin = Math.max(0, Math.floor(colCenter - rGrid));
  const cMax = Math.min(size - 1, Math.ceil(colCenter + rGrid));
  const rMin = Math.max(0, Math.floor(rowCenter - rGrid));
  const rMax = Math.min(size - 1, Math.ceil(rowCenter + rGrid));

  let changed = false;
  for (let row = rMin; row <= rMax; row++) {
    const dr = row - rowCenter;
    const drSq = dr * dr;
    const rowOff = row * size;
    for (let col = cMin; col <= cMax; col++) {
      const dc = col - colCenter;
      if (dc * dc + drSq > rGridSq) continue;
      const idx = rowOff + col;
      if (data[idx] === 0) {
        data[idx] = 1;
        changed = true;
      }
    }
  }

  if (changed) {
    entry.revision++;
    emitExplorationChange(projectId);
  }
  return changed;
}

export function isCoordExplored(
  projectId: string,
  mapX: number,
  mapZ: number,
  mapRadius: number
): boolean {
  if (!projectId || mapRadius <= 0) return true;
  const entry = explorationByProject.get(projectId);
  if (!entry) return false;
  const size = EXPLORE_GRID_SIZE;
  const span = 2 * mapRadius;
  const col = Math.max(0, Math.min(size - 1, Math.round(((mapX + mapRadius) / span) * (size - 1))));
  const row = Math.max(0, Math.min(size - 1, Math.round(((mapZ + mapRadius) / span) * (size - 1))));
  return entry.data[row * size + col] === 1;
}

export function getExploredPercent(projectId: string): number {
  const entry = explorationByProject.get(projectId);
  if (!entry) return 0;
  let count = 0;
  const data = entry.data;
  for (let i = 0; i < data.length; i++) {
    if (data[i] === 1) count++;
  }
  return Math.round((count / data.length) * 100);
}

export function encodeExplorationBase64(data: Uint8Array): string {
  // Pack 8 cells per byte for tiny base64 payloads (~2.7 KB for 128x128)
  const byteLen = Math.ceil(data.length / 8);
  const packed = new Uint8Array(byteLen);
  for (let i = 0; i < data.length; i++) {
    if (data[i]) {
      packed[i >> 3] |= 1 << (i & 7);
    }
  }
  let bin = '';
  for (let i = 0; i < packed.length; i++) {
    bin += String.fromCharCode(packed[i]);
  }
  return typeof btoa === 'function' ? btoa(bin) : '';
}

export function decodeExplorationBase64(b64: string, out: Uint8Array): void {
  out.fill(0);
  if (!b64 || typeof atob !== 'function') return;
  try {
    const bin = atob(b64);
    const len = out.length;
    for (let i = 0; i < len; i++) {
      const byteIdx = i >> 3;
      if (byteIdx >= bin.length) break;
      const byteVal = bin.charCodeAt(byteIdx);
      out[i] = (byteVal >> (i & 7)) & 1;
    }
  } catch {
    // Ignore malformed saved exploration string
  }
}

export function hydrateExploration(projectId: string, b64?: string): void {
  const entry = ensureExplorationEntry(projectId);
  if (!b64) {
    entry.data.fill(0);
  } else {
    decodeExplorationBase64(b64, entry.data);
  }
  entry.revision++;
  emitExplorationChange(projectId);
}

/**
 * Builds a single compact SVG path representing explored horizontal runs
 * within the normalized [minU, maxU] x [minV, maxV] exploration-grid window.
 */
export function buildSvgFogRunPath(
  data: Uint8Array,
  size: number,
  minU: number,
  maxU: number,
  minV: number,
  maxV: number
): string {
  const spanU = Math.max(0.0001, maxU - minU);
  const spanV = Math.max(0.0001, maxV - minV);
  const rStart = Math.max(0, Math.floor(minV * size) - 1);
  const rEnd = Math.min(size - 1, Math.ceil(maxV * size) + 1);
  const cStart = Math.max(0, Math.floor(minU * size) - 1);
  const cEnd = Math.min(size - 1, Math.ceil(maxU * size) + 1);

  const cellW = (100 / size) / spanU;
  const cellH = (100 / size) / spanV;
  const parts: string[] = [];

  for (let row = rStart; row <= rEnd; row++) {
    const rowOff = row * size;
    const y = (((row / size) - minV) / spanV) * 100;
    const h = Math.max(1.2, cellH + 0.5);
    let col = cStart;
    while (col <= cEnd) {
      if (data[rowOff + col] === 0) {
        col++;
        continue;
      }
      const runStart = col;
      while (col <= cEnd && data[rowOff + col] === 1) {
        col++;
      }
      const runLen = col - runStart;
      const x = (((runStart / size) - minU) / spanU) * 100;
      const w = runLen * cellW + 0.4;
      parts.push(`M${x.toFixed(1)},${y.toFixed(1)}h${w.toFixed(1)}v${h.toFixed(1)}h-${w.toFixed(1)}Z`);
    }
  }

  return parts.join('');
}

// --- Discovered Save / Spawn Plinths Tracking ---

const discoveredPlinthsByProject = new Map<string, Set<string>>();
const discoveredListeners = new Set<(projectId: string) => void>();

export function getDiscoveredPlinthKeys(projectId: string): Set<string> {
  let set = discoveredPlinthsByProject.get(projectId);
  if (!set) {
    set = new Set<string>();
    discoveredPlinthsByProject.set(projectId, set);
  }
  return set;
}

export function markPlinthDiscovered(projectId: string, plinthKey: string): boolean {
  const set = getDiscoveredPlinthKeys(projectId);
  if (set.has(plinthKey)) return false;
  set.add(plinthKey);
  discoveredListeners.forEach((fn) => fn(projectId));
  return true;
}

export function hydrateDiscoveredPlinths(projectId: string, keys: string[]): void {
  const set = getDiscoveredPlinthKeys(projectId);
  set.clear();
  for (const k of keys) set.add(k);
  discoveredListeners.forEach((fn) => fn(projectId));
}

export function clearDiscoveredPlinths(projectId: string): void {
  const set = getDiscoveredPlinthKeys(projectId);
  set.clear();
  discoveredListeners.forEach((fn) => fn(projectId));
}

export function subscribeDiscoveredPlinths(listener: (projectId: string) => void): () => void {
  discoveredListeners.add(listener);
  return () => {
    discoveredListeners.delete(listener);
  };
}

// --- LocalStorage Play Progress Persistence ---

const PROGRESS_KEY_PREFIX = 'maker.playProgress.v1.';

export function loadSavedPlayProgress(projectId: string): SavedPlayProgress | null {
  try {
    const raw = localStorage.getItem(`${PROGRESS_KEY_PREFIX}${projectId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedPlayProgress;
    if (!parsed || parsed.projectId !== projectId || !parsed.levelId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePlayProgress(progress: SavedPlayProgress): void {
  try {
    localStorage.setItem(`${PROGRESS_KEY_PREFIX}${progress.projectId}`, JSON.stringify(progress));
  } catch {
    // ignore quota / sandboxed storage errors
  }
}

export function clearSavedPlayProgress(projectId: string): void {
  try {
    localStorage.removeItem(`${PROGRESS_KEY_PREFIX}${projectId}`);
  } catch {
    // ignore storage errors
  }
}

// --- Transient Cross-Level Fast Travel Payload ---

let pendingTravel: PendingPlinthTravel | null = null;

export function setPendingPlinthTravel(travel: PendingPlinthTravel | null): void {
  pendingTravel = travel;
}

export function consumePendingPlinthTravel(
  projectId: string,
  levelId: string
): PendingPlinthTravel | null {
  if (!pendingTravel) return null;
  if (pendingTravel.projectId !== projectId || pendingTravel.levelId !== levelId) {
    return null;
  }
  const res = pendingTravel;
  pendingTravel = null;
  return res;
}

// --- In-Game World Map Open Trigger Bus ---

const openWorldMapListeners = new Set<() => void>();

export function requestOpenInGameWorldMap(): void {
  openWorldMapListeners.forEach((fn) => fn());
}

export function subscribeOpenInGameWorldMap(listener: () => void): () => void {
  openWorldMapListeners.add(listener);
  return () => {
    openWorldMapListeners.delete(listener);
  };
}
