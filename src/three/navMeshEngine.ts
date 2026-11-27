import * as THREE from 'three';
import { init as initRecast, NavMesh, NavMeshQuery } from 'recast-navigation';
import { generateSoloNavMesh } from 'recast-navigation/generators';
import type { GameLevel, LevelEntity } from '../types/maker';
import {
  getEnvironmentType,
  getTerrainRadius,
  IslandTerrain,
  levelBoardToWorld,
  sampleLevelHeight,
} from '../utils/terrain';

/**
 * Recast / Detour WASM NavMesh Engine for Play Mode AI.
 *
 * Bakes a walkable NavMesh asynchronously from:
 *  - Island / land terrain surface (excluding deep water)
 *  - Carved cave tunnel floors & open mountain entrances
 *  - Placed bridges / platforms (walkable) and buildings / walls (obstacles)
 *
 * Gives every monster, companion, and patrolling NPC true A* pathfinding around
 * cliffs, across bridges, and through carved caves at negligible per-frame cost.
 */

let recastInitPromise: Promise<void> | null = null;

function ensureRecastInit(): Promise<void> {
  if (!recastInitPromise) {
    recastInitPromise = initRecast().catch((err) => {
      recastInitPromise = null;
      throw err;
    });
  }
  return recastInitPromise;
}

interface CachedAgentPath {
  waypoints: Array<{ x: number; y: number; z: number }>;
  waypointIdx: number;
  lastGoalX: number;
  lastGoalZ: number;
  lastQueryTime: number;
}

export interface NavSteerTarget {
  x: number;
  y: number;
  z: number;
  onNavMesh: boolean;
}

const OBSTACLE_KINDS = new Set([
  'house',
  'tower',
  'castle',
  'windmill',
  'tavern',
  'barn',
  'wall',
  'pillar',
  'rock',
  'boulder',
  'tree',
  'ruin',
]);

const WALKABLE_STRUCTURE_KINDS = new Set([
  'bridge',
  'platform',
  'dock',
  'pier',
  'stairs',
  'ramp',
]);

function pushQuad(
  positions: number[],
  indices: number[],
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number,
  x3: number,
  y3: number,
  z3: number
): void {
  const base = positions.length / 3;
  positions.push(x0, y0, z0, x1, y1, z1, x2, y2, z2, x3, y3, z3);
  indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
}

function pushBox(
  positions: number[],
  indices: number[],
  cx: number,
  cy: number,
  cz: number,
  hx: number,
  hy: number,
  hz: number
): void {
  const x0 = cx - hx;
  const x1 = cx + hx;
  const y0 = cy - hy;
  const y1 = cy + hy;
  const z0 = cz - hz;
  const z1 = cz + hz;
  // Top, Front, Back, Left, Right faces (CCW outward)
  pushQuad(positions, indices, x0, y1, z0, x1, y1, z0, x1, y1, z1, x0, y1, z1);
  pushQuad(positions, indices, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1);
  pushQuad(positions, indices, x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0);
  pushQuad(positions, indices, x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0);
  pushQuad(positions, indices, x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1);
}

function buildLevelNavGeometry(level: GameLevel): {
  positions: Float32Array;
  indices: Uint32Array;
} {
  const positions: number[] = [];
  const indices: number[] = [];

  const env = getEnvironmentType(level);
  const terrain = level.terrain;
  const worldR = terrain ? getTerrainRadius(terrain) : 78;
  // Clamp navmesh span to active playable island area for fast 40-100ms baking
  const navSpan = Math.min(worldR, 145);
  const gridCells = env === 'dungeon' ? 36 : 84;
  const stride = gridCells + 1;
  const step = (navSpan * 2) / gridCells;
  const waterCut = IslandTerrain.waterLevel - 0.15;

  // 1. Sample walkable ground grid
  const vertBase = 0;
  for (let gz = 0; gz < stride; gz++) {
    const wz = -navSpan + gz * step;
    for (let gx = 0; gx < stride; gx++) {
      const wx = -navSpan + gx * step;
      const wy = sampleLevelHeight(level, wx, wz);
      positions.push(wx, wy, wz);
    }
  }

  for (let gz = 0; gz < gridCells; gz++) {
    const row0 = gz * stride;
    const row1 = (gz + 1) * stride;
    for (let gx = 0; gx < gridCells; gx++) {
      const a = vertBase + row0 + gx;
      const b = vertBase + row0 + gx + 1;
      const c = vertBase + row1 + gx;
      const d = vertBase + row1 + gx + 1;

      const ya = positions[a * 3 + 1];
      const yb = positions[b * 3 + 1];
      const yc = positions[c * 3 + 1];
      const yd = positions[d * 3 + 1];
      // Skip underwater ocean cells so AI doesn't try to walk across deep water
      if (env === 'openWorld' && ya < waterCut && yb < waterCut && yc < waterCut && yd < waterCut) {
        continue;
      }
      indices.push(a, c, b, b, c, d);
    }
  }

  // 2. Add explicit walkable floor strips through carved cave tunnels so AI navigates inside mountains
  const caves = terrain?.caves ?? [];
  for (let c = 0; c < caves.length; c++) {
    const cave = caves[c];
    const nodes = cave.tunnelNodes ?? [];
    if (nodes.length === 0) continue;
    const baseFloor = cave.floorElevation ?? nodes[0].floorY ?? 1.5;

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const fy = n.floorY ?? baseFloor;
      const r = Math.max(1.8, (n.radius ?? 4.2) * 0.78);
      // Floor pad at node
      pushQuad(
        positions,
        indices,
        n.x - r,
        fy,
        n.z - r,
        n.x + r,
        fy,
        n.z - r,
        n.x + r,
        fy,
        n.z + r,
        n.x - r,
        fy,
        n.z + r
      );

      // Connect consecutive tunnel nodes with a continuous walkable bridge strip
      if (i > 0) {
        const prev = nodes[i - 1];
        const prevY = prev.floorY ?? baseFloor;
        const dx = n.x - prev.x;
        const dz = n.z - prev.z;
        const len = Math.hypot(dx, dz);
        if (len > 0.2) {
          const halfW = Math.max(1.6, Math.min(n.radius ?? 4.2, prev.radius ?? 4.2) * 0.72);
          const nx = (-dz / len) * halfW;
          const nz = (dx / len) * halfW;
          pushQuad(
            positions,
            indices,
            prev.x - nx,
            prevY,
            prev.z - nz,
            prev.x + nx,
            prevY,
            prev.z + nz,
            n.x + nx,
            fy,
            n.z + nz,
            n.x - nx,
            fy,
            n.z - nz
          );
        }
      }
    }
  }

  // 3. Add static obstacles (buildings/walls) and walkable bridges/ramps from level entities
  const entities: LevelEntity[] = level.entities ?? [];
  for (let i = 0; i < entities.length; i++) {
    const ent = entities[i];
    if (!ent || !ent.position) continue;
    const [wx, wz] = levelBoardToWorld(level, ent.position);
    if (Math.abs(wx) > navSpan || Math.abs(wz) > navSpan) continue;
    const groundY = sampleLevelHeight(level, wx, wz) + (ent.elevationY ?? 0);
    const presetOrKind = String(ent.propPreset ?? ent.kind ?? '').toLowerCase();
    const nameLower = String(ent.name ?? '').toLowerCase();
    const scale = Math.max(0.5, ent.scale ?? 1);

    const isWalkable =
      WALKABLE_STRUCTURE_KINDS.has(presetOrKind) ||
      nameLower.includes('bridge') ||
      nameLower.includes('ramp') ||
      nameLower.includes('platform') ||
      nameLower.includes('dock') ||
      nameLower.includes('stairs');
    const isObstacle =
      !isWalkable &&
      (OBSTACLE_KINDS.has(presetOrKind) ||
        Boolean(ent.buildingBlock) ||
        nameLower.includes('house') ||
        nameLower.includes('castle') ||
        nameLower.includes('tower') ||
        nameLower.includes('wall') ||
        nameLower.includes('tavern'));

    if (isWalkable) {
      const hw = 2.4 * scale;
      const hl = 4.2 * scale;
      pushQuad(
        positions,
        indices,
        wx - hw,
        groundY + 0.22,
        wz - hl,
        wx + hw,
        groundY + 0.22,
        wz - hl,
        wx + hw,
        groundY + 0.22,
        wz + hl,
        wx - hw,
        groundY + 0.22,
        wz + hl
      );
    } else if (isObstacle) {
      const r =
        presetOrKind === 'castle' || nameLower.includes('castle')
          ? 4.6 * scale
          : presetOrKind === 'house' ||
            presetOrKind === 'tavern' ||
            presetOrKind === 'barn' ||
            nameLower.includes('house') ||
            nameLower.includes('tavern')
          ? 2.8 * scale
          : presetOrKind === 'tower' || presetOrKind === 'windmill' || nameLower.includes('tower')
          ? 2.1 * scale
          : 1.15 * scale;
      pushBox(positions, indices, wx, groundY + 2.2, wz, r, 2.2, r);
    }
  }

  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
  };
}

export class PlayNavMeshEngine {
  private navMesh: NavMesh | null = null;
  private query: NavMeshQuery | null = null;
  private disposed = false;
  private ready = false;
  private readonly agentPaths = new Map<string, CachedAgentPath>();
  private readonly _out: NavSteerTarget = { x: 0, y: 0, z: 0, onNavMesh: false };

  public isReady(): boolean {
    return this.ready && !this.disposed && this.query !== null;
  }

  /**
   * Asynchronously initializes Recast WASM and bakes the level's walkable NavMesh.
   * Non-blocking so Play Mode opens immediately while pathfinding activates in ~60-120ms.
   */
  public async buildForLevel(level: GameLevel): Promise<boolean> {
    try {
      await ensureRecastInit();
      if (this.disposed) return false;

      const { positions, indices } = buildLevelNavGeometry(level);
      if (positions.length < 9 || indices.length < 3) return false;

      const result = generateSoloNavMesh(positions, indices, {
        cs: 0.75,
        ch: 0.35,
        walkableSlopeAngle: 46,
        walkableHeight: 5,
        walkableClimb: 2,
        walkableRadius: 1,
        maxEdgeLen: 16,
        maxSimplificationError: 1.4,
        minRegionArea: 6,
        mergeRegionArea: 18,
        maxVertsPerPoly: 6,
        detailSampleDist: 6,
        detailSampleMaxError: 1,
        buildBvTree: true,
      });

      if (this.disposed) {
        if (result.success) result.navMesh.destroy();
        return false;
      }

      if (!result.success) {
        return false;
      }

      this.clearInternal();
      this.navMesh = result.navMesh;
      this.query = new NavMeshQuery(result.navMesh);
      this.ready = true;
      return true;
    } catch (err) {
      console.warn('Recast NavMesh build skipped; using direct steering fallback:', err);
      return false;
    }
  }

  /**
   * Returns the next walkable waypoint toward `(goalX, goalY, goalZ)` for `agentId`,
   * caching computed A* paths and refreshing at ~3 Hz (or when the goal moves >2.5m).
   */
  public steerTowards(
    agentId: string,
    curX: number,
    curY: number,
    curZ: number,
    goalX: number,
    goalY: number,
    goalZ: number,
    nowSec: number
  ): NavSteerTarget {
    if (!this.ready || !this.query || this.disposed) {
      this._out.x = goalX;
      this._out.y = goalY;
      this._out.z = goalZ;
      this._out.onNavMesh = false;
      return this._out;
    }

    const directDistSq = (goalX - curX) * (goalX - curX) + (goalZ - curZ) * (goalZ - curZ);
    // For very close melee range (<2.2m), direct pursuit is snappier
    if (directDistSq < 4.8) {
      this._out.x = goalX;
      this._out.y = goalY;
      this._out.z = goalZ;
      this._out.onNavMesh = true;
      return this._out;
    }

    let cached = this.agentPaths.get(agentId);
    const goalShiftSq = cached
      ? (goalX - cached.lastGoalX) * (goalX - cached.lastGoalX) +
        (goalZ - cached.lastGoalZ) * (goalZ - cached.lastGoalZ)
      : Infinity;

    const needsRequery =
      !cached ||
      nowSec - cached.lastQueryTime > 0.36 ||
      goalShiftSq > 6.25 ||
      cached.waypointIdx >= cached.waypoints.length;

    if (needsRequery) {
      try {
        const res = this.query.computePath(
          { x: curX, y: curY + 0.25, z: curZ },
          { x: goalX, y: goalY + 0.25, z: goalZ },
          {
            halfExtents: { x: 4, y: 6, z: 4 },
            maxPathPolys: 128,
            maxStraightPathPoints: 48,
          }
        );
        if (res.success && res.path && res.path.length > 1) {
          cached = {
            waypoints: res.path.map((p) => ({ x: p.x, y: p.y, z: p.z })),
            waypointIdx: 1,
            lastGoalX: goalX,
            lastGoalZ: goalZ,
            lastQueryTime: nowSec,
          };
          this.agentPaths.set(agentId, cached);
        } else {
          this._out.x = goalX;
          this._out.y = goalY;
          this._out.z = goalZ;
          this._out.onNavMesh = false;
          return this._out;
        }
      } catch {
        this._out.x = goalX;
        this._out.y = goalY;
        this._out.z = goalZ;
        this._out.onNavMesh = false;
        return this._out;
      }
    }

    // Advance past already-reached waypoints
    while (cached && cached.waypointIdx < cached.waypoints.length - 1) {
      const wp = cached.waypoints[cached.waypointIdx];
      const d2 = (wp.x - curX) * (wp.x - curX) + (wp.z - curZ) * (wp.z - curZ);
      if (d2 < 1.9 * 1.9) {
        cached.waypointIdx++;
      } else {
        break;
      }
    }

    const activeWp = cached?.waypoints[Math.min(cached.waypointIdx, cached.waypoints.length - 1)];
    if (activeWp) {
      this._out.x = activeWp.x;
      this._out.y = activeWp.y;
      this._out.z = activeWp.z;
      this._out.onNavMesh = true;
      return this._out;
    }

    this._out.x = goalX;
    this._out.y = goalY;
    this._out.z = goalZ;
    this._out.onNavMesh = false;
    return this._out;
  }

  public removeAgent(agentId: string): void {
    this.agentPaths.delete(agentId);
  }

  private clearInternal(): void {
    this.ready = false;
    this.agentPaths.clear();
    if (this.query) {
      try {
        this.query.destroy();
      } catch {
        // ignore
      }
      this.query = null;
    }
    if (this.navMesh) {
      try {
        this.navMesh.destroy();
      } catch {
        // ignore
      }
      this.navMesh = null;
    }
  }

  public dispose(): void {
    this.disposed = true;
    this.clearInternal();
  }
}

export function isThreeVector3(v: unknown): v is THREE.Vector3 {
  return v instanceof THREE.Vector3;
}
