import React, { useEffect, useId, useMemo, useState } from 'react';
import {
  ChevronDown,
  Compass,
  Flag,
  Flame,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Play,
  RotateCcw,
  Users,
} from 'lucide-react';
import { getBiome } from '../../data/registries';
import {
  getLivePlayerTelemetry,
  subscribeLivePlayerTelemetry,
  type MakerStore,
} from '../../store/useMakerStore';
import type { BoardPoint, GameLevel, PlayerTelemetry } from '../../types/maker';
import {
  BuddiesLandmarks,
  DrivingWaypoints,
  getEnvironmentType,
  getTerrainRadius,
  IslandRiver,
  IslandTerrain,
  levelBoardToWorld,
  MountainCave,
  terrainHasMainMountainCave,
  TerrainPaths,
} from '../../utils/terrain';
import {
  EXPLORE_GRID_SIZE,
  buildSvgFogRunPath,
  getEffectiveMapInfo,
  getExplorationSnapshot,
  isSavePlinthEntity,
  requestOpenInGameWorldMap,
  subscribeExploration,
} from '../../utils/worldMapFog';

function w2svg(wx: number, wz: number): [number, number] {
  const x = (wx / (2 * IslandTerrain.radius) + 0.5) * 100;
  const y = (wz / (2 * IslandTerrain.radius) + 0.5) * 100;
  return [
    Math.min(98, Math.max(2, x)),
    Math.min(98, Math.max(2, y)),
  ];
}

function toPolylinePoints(coords: [number, number][]): string {
  return coords
    .map(([wx, wz]) => {
      const [sx, sy] = w2svg(wx, wz);
      return `${sx.toFixed(1)},${sy.toFixed(1)}`;
    })
    .join(' ');
}

const RIVER_POLYLINE = (() => {
  const pts: [number, number][] = [];
  for (let i = 0; i < IslandRiver.samples.length; i += 5) {
    pts.push([IslandRiver.samples[i].x, IslandRiver.samples[i].z]);
  }
  const last = IslandRiver.samples[IslandRiver.samples.length - 1];
  pts.push([last.x, last.z]);
  return toPolylinePoints(pts);
})();

const MAIN_TRAIL_POLYLINE = (() => {
  const pts: [number, number][] = [];
  for (let i = 0; i < TerrainPaths.samples.length; i += 6) {
    pts.push([TerrainPaths.samples[i].x, TerrainPaths.samples[i].z]);
  }
  const last = TerrainPaths.samples[TerrainPaths.samples.length - 1];
  pts.push([last.x, last.z]);
  return toPolylinePoints(pts);
})();

const CAVE_SPUR_POLYLINE = toPolylinePoints([
  [-94, 83],
  [-86, 76],
  [MountainCave.x + 2, MountainCave.z + 5.5],
  [MountainCave.x, MountainCave.z + 1.5],
]);

const HOME_SPUR_POLYLINE = toPolylinePoints([
  [-20, 62],
  [-2, 71],
  [17, 83],
  [33, 91],
]);

const LAKE_SPUR_POLYLINE = toPolylinePoints([
  [12, 0],
  [-4, -18],
  [-18, -38],
  [-28, -50],
]);

const DRIVING_LOOP_POLYLINE = (() => {
  // Interpolate smooth closed path along DrivingWaypoints
  const pts: [number, number][] = [];
  const segs = DrivingWaypoints.length - 1;
  const samples = 88;
  for (let i = 0; i < samples; i++) {
    const u = (i / (samples - 1)) * segs;
    const idx = Math.min(segs - 1, Math.floor(u));
    const t = u - idx;
    const p0 = DrivingWaypoints[Math.max(0, idx - 1)];
    const p1 = DrivingWaypoints[idx];
    const p2 = DrivingWaypoints[idx + 1];
    const p3 = DrivingWaypoints[Math.min(segs, idx + 2)];
    const t2 = t * t;
    const t3 = t2 * t;
    const x =
      0.5 *
      (2 * p1[0] +
        (-p0[0] + p2[0]) * t +
        (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
        (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
    const z =
      0.5 *
      (2 * p1[1] +
        (-p0[1] + p2[1]) * t +
        (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
        (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
    pts.push([x, z]);
  }
  return toPolylinePoints(pts);
})();

function describeZone(
  level: GameLevel,
  point: BoardPoint,
  telemetry: PlayerTelemetry | null
): { zone: string; status: string } {
  const env = getEnvironmentType(level);
  const [wx, wz] = levelBoardToWorld(level, point);

  if (level.gameplayMode === 'buddies') {
    const caveDist = Math.hypot(wx - MountainCave.x, wz - MountainCave.z);
    const homeDist = Math.hypot(wx - BuddiesLandmarks.homeClearingWorld[0], wz - BuddiesLandmarks.homeClearingWorld[1]);
    const lakeDist = Math.hypot(wx - BuddiesLandmarks.lakeCenterWorld[0], wz - BuddiesLandmarks.lakeCenterWorld[1]);
    const dockDist = Math.hypot(wx - BuddiesLandmarks.dockSpotWorld[0], wz - BuddiesLandmarks.dockSpotWorld[1]);
    const tavernDist = Math.hypot(wx - BuddiesLandmarks.tavernWorld[0], wz - BuddiesLandmarks.tavernWorld[1]);
    const startDist = Math.hypot(wx - BuddiesLandmarks.startWorld[0], wz - BuddiesLandmarks.startWorld[1]);
    const riverDist = IslandRiver.distanceTo(wx, wz);

    const isFreeform = Boolean(level.terrain?.freeformWorld);
    let zone = isFreeform ? 'Explore Land' : 'Forest Main Trail';
    if (terrainHasMainMountainCave(level.terrain) && caveDist < 12) zone = 'Mountain Cave';
    else if (!isFreeform && homeDist < 22) zone = 'Pine-Needle Hollow';
    else if (!isFreeform && (dockDist < 18 || lakeDist < 26)) zone = 'Whispering Lake';
    else if (!isFreeform && tavernDist < 22) zone = 'Woodland Tavern';
    else if (!isFreeform && startDist < 18) zone = 'Broken Wagon Start';
    else if (!isFreeform && riverDist < 9) zone = 'River Footbridge';

    const buddies = level.entities.filter((e) => e.kind === 'npc' && e.isBuddy);
    const found = telemetry?.buddiesFound ?? 0;
    const total = telemetry?.buddiesTotal ?? buddies.length;
    const status =
      total > 0
        ? found >= total
          ? `All ${total} buddies · Head to Tavern!`
          : `Buddies ${found}/${total}`
        : 'Forest Quest';
    return { zone, status };
  }

  if (level.gameplayMode === 'driving') {
    const cps = level.entities
      .filter((e) => e.kind === 'checkpoint')
      .sort((a, b) => (a.checkpointOrder ?? 99) - (b.checkpointOrder ?? 99));
    const clearedSet = new Set(telemetry?.clearedCheckpointIds ?? []);
    const nextCp = cps.find((c) => !clearedSet.has(c.id));
    const speed = telemetry?.speedKmh ?? 0;
    const hit = telemetry?.checkpointsHit ?? 0;
    const total = telemetry?.checkpointsTotal ?? cps.length;

    let zone = 'Timberline Rally Loop';
    if (nextCp) {
      const [cx, cz] = levelBoardToWorld(level, nextCp.position);
      const distMeters = Math.round(Math.hypot(cx - wx, cz - wz));
      zone = `Next: CP ${nextCp.checkpointOrder ?? ''} (${distMeters}m)`;
    } else if (total > 0) {
      zone = 'All Arches Cleared · Finish!';
    }

    const status =
      total > 0
        ? `${hit}/${total} Arches${speed > 0 ? ` · ${speed} km/h` : ''}`
        : `${speed} km/h`;
    return { zone, status };
  }

  if (env === 'sideScroller') {
    const pct = Math.round(point.x * 100);
    return {
      zone: pct < 22 ? 'Start Ledge' : pct > 82 ? 'Goal Platform' : 'Course Midsection',
      status: `${pct}% across track`,
    };
  }

  const portal = level.portalPoint ?? { x: 0.88, y: 0.24 };
  const [px, pz] = levelBoardToWorld(level, portal);
  const toPortal = Math.round(Math.hypot(px - wx, pz - wz));
  const envName =
    level.gameplayMode === 'roguelike'
      ? level.name
      : env === 'dungeon'
      ? 'Stone Keep'
      : env === 'castle'
      ? 'Royal Courtyard'
      : env === 'scifi'
      ? 'Starship Deck'
      : 'Island Wilds';
  return {
    zone: envName,
    status: level.hasPortal ? `${toPortal}m to Portal` : 'Explore',
  };
}

export const TemplateMinimapSVG: React.FC<{
  level: GameLevel;
  playerPoint: BoardPoint;
  playerYaw: number;
  telemetry?: PlayerTelemetry | null;
  selectedEntityID?: string | null;
  interactive?: boolean;
  accentHex?: string;
  fogRevealPath?: string | null;
  onSelectEntity?: (id: string) => void;
  onMapClick?: (pt: BoardPoint) => void;
}> = React.memo(({
  level,
  playerPoint,
  playerYaw,
  telemetry = null,
  selectedEntityID = null,
  interactive = false,
  accentHex = '#7C5CFF',
  fogRevealPath = null,
  onSelectEntity,
  onMapClick,
}) => {
  const fogMaskId = useId();
  const env = getEnvironmentType(level);
  const biome = getBiome(level.biome);
  const isBuddies = level.gameplayMode === 'buddies';
  const isDriving = level.gameplayMode === 'driving';
  const startPt = level.startPoint ?? (env === 'sideScroller' ? { x: 0.1, y: 0.5 } : { x: 0.14, y: 0.8 });
  const portalPt = level.portalPoint ?? (env === 'sideScroller' ? { x: 0.92, y: 0.5 } : { x: 0.88, y: 0.24 });

  const buddies = useMemo(
    () => level.entities.filter((e) => e.kind === 'npc' && e.isBuddy),
    [level.entities]
  );
  const savePlinths = useMemo(
    () => level.entities.filter((e) => isSavePlinthEntity(e)),
    [level.entities]
  );
  const checkpoints = useMemo(
    () =>
      level.entities
        .filter((e) => e.kind === 'checkpoint' && !isSavePlinthEntity(e))
        .sort((a, b) => (a.checkpointOrder ?? 99) - (b.checkpointOrder ?? 99)),
    [level.entities]
  );
  const ramps = useMemo(
    () => level.entities.filter((e) => e.propPreset === 'ramp'),
    [level.entities]
  );

  const clearedCpSet = new Set(telemetry?.clearedCheckpointIds ?? []);
  const recruitedSet = new Set(telemetry?.recruitedBuddyIds ?? []);
  const nextCheckpointId = checkpoints.find((c) => !clearedCpSet.has(c.id))?.id ?? null;

  const [caveSvgX, caveSvgY] = w2svg(MountainCave.x, MountainCave.z);
  const [lakeSvgX, lakeSvgY] = w2svg(
    BuddiesLandmarks.lakeCenterWorld[0],
    BuddiesLandmarks.lakeCenterWorld[1]
  );
  const [tavernSvgX, tavernSvgY] = w2svg(
    BuddiesLandmarks.tavernWorld[0],
    BuddiesLandmarks.tavernWorld[1]
  );
  const [homeSvgX, homeSvgY] = w2svg(
    BuddiesLandmarks.homeClearingWorld[0],
    BuddiesLandmarks.homeClearingWorld[1]
  );

  // Convert yaw (0 = +Z/down, PI = -Z/up, +PI/2 = +X/right) to SVG rotation deg (0 = UP)
  const headingDeg = 180 - (playerYaw * 180) / Math.PI;
  const px = playerPoint.x * 100;
  const py = playerPoint.y * 100;

  const trailPointsStr =
    telemetry && telemetry.trail.length >= 2
      ? telemetry.trail
          .map((pt) => `${(pt.x * 100).toFixed(1)},${(pt.y * 100).toFixed(1)}`)
          .join(' ')
      : '';

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!interactive || !onMapClick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = Math.min(0.95, Math.max(0.05, (e.clientX - rect.left) / rect.width));
    const ny = Math.min(0.95, Math.max(0.05, (e.clientY - rect.top) / rect.height));
    onMapClick({ x: nx, y: ny });
  };

  const renderTerrainScene = () => (
    <>
      {/* Environment Base Layer */}
      {env === 'openWorld' && (
        <>
          <rect width="100" height="100" fill="#0B2239" />
          <circle
            cx="50"
            cy="50"
            r="47.5"
            fill={biome.ground}
            stroke="#DFC78B"
            strokeWidth="2.2"
          />
          {/* Gentle topographic rings */}
          <circle
            cx="50"
            cy="50"
            r="36"
            fill="none"
            stroke="#FFFFFF"
            strokeOpacity="0.08"
            strokeWidth="0.6"
          />
          {/* Water & Paths: render actual freeform features OR legacy template island river/trail */}
          {level.terrain?.freeformWorld ? (
            <>
              {(level.terrain.waterBodies ?? []).map((wb) => {
                const [wx, wy] = w2svg(wb.center[0], wb.center[1]);
                const rx = Math.max(1.5, (wb.radiusX / (2 * IslandTerrain.radius)) * 100);
                const ry = Math.max(1.5, (wb.radiusZ / (2 * IslandTerrain.radius)) * 100);
                return (
                  <ellipse
                    key={wb.id}
                    cx={wx}
                    cy={wy}
                    rx={rx}
                    ry={ry}
                    fill="#2B8CE6"
                    stroke="#93C5FD"
                    strokeOpacity="0.45"
                    strokeWidth="0.6"
                  />
                );
              })}
              {(level.terrain.roads ?? []).map((rd) =>
                rd.points && rd.points.length >= 2 ? (
                  <polyline
                    key={rd.id}
                    points={toPolylinePoints(rd.points)}
                    fill="none"
                    stroke="#C9A26B"
                    strokeWidth={Math.max(1.2, (rd.width / (2 * IslandTerrain.radius)) * 100)}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null
              )}
              {(level.terrain.caves ?? []).map((c) => {
                const [cx, cy] = w2svg(c.x, c.z);
                return (
                  <g key={c.id}>
                    <circle cx={cx} cy={cy} r="2.8" fill="#334155" stroke="#94A3B8" strokeWidth="0.7" />
                    <circle cx={cx} cy={cy} r="1.1" fill="#F59E0B" />
                  </g>
                );
              })}
            </>
          ) : (
            <>
              {/* Whispering Lake & River */}
              {isBuddies && (
                <ellipse
                  cx={lakeSvgX}
                  cy={lakeSvgY}
                  rx="7.5"
                  ry="5.5"
                  fill="#2B8CE6"
                  stroke="#7DD3FC"
                  strokeOpacity="0.55"
                  strokeWidth="0.8"
                />
              )}
              <polyline
                points={RIVER_POLYLINE}
                fill="none"
                stroke="#2B8CE6"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polyline
                points={RIVER_POLYLINE}
                fill="none"
                stroke="#93C5FD"
                strokeOpacity="0.4"
                strokeWidth="0.9"
              />

              {/* Template-specific Paths */}
              {isDriving ? (
                <>
                  <polyline
                    points={DRIVING_LOOP_POLYLINE}
                    fill="none"
                    stroke="#B58E5A"
                    strokeWidth="6.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <polyline
                    points={DRIVING_LOOP_POLYLINE}
                    fill="none"
                    stroke="#1E2430"
                    strokeWidth="4.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <polyline
                    points={DRIVING_LOOP_POLYLINE}
                    fill="none"
                    stroke="#F8FAFC"
                    strokeOpacity="0.55"
                    strokeWidth="0.7"
                    strokeDasharray="2.4 2.4"
                  />
                </>
              ) : (
                <>
                  <polyline
                    points={MAIN_TRAIL_POLYLINE}
                    fill="none"
                    stroke="#C9A26B"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {isBuddies && (
                    <>
                      <polyline
                        points={CAVE_SPUR_POLYLINE}
                        fill="none"
                        stroke="#FDE68A"
                        strokeOpacity="0.85"
                        strokeWidth="1.6"
                        strokeDasharray="2.2 1.4"
                        strokeLinecap="round"
                      />
                      <polyline
                        points={HOME_SPUR_POLYLINE}
                        fill="none"
                        stroke="#FDE68A"
                        strokeOpacity="0.85"
                        strokeWidth="1.6"
                        strokeDasharray="2.2 1.4"
                        strokeLinecap="round"
                      />
                      <polyline
                        points={LAKE_SPUR_POLYLINE}
                        fill="none"
                        stroke="#FDE68A"
                        strokeOpacity="0.85"
                        strokeWidth="1.6"
                        strokeDasharray="2.2 1.4"
                        strokeLinecap="round"
                      />
                      {/* Wooden Footbridge over river */}
                      <rect
                        x="51"
                        y="47"
                        width="5.2"
                        height="2.4"
                        rx="0.6"
                        transform="rotate(-24 53.6 48.2)"
                        fill="#9A5B2F"
                        stroke="#FDE68A"
                        strokeWidth="0.45"
                      />
                      {/* Mountain Cave arch + Pine Cottage + Tavern plaza */}
                      {terrainHasMainMountainCave(level.terrain) && (
                        <g>
                          <circle cx={caveSvgX} cy={caveSvgY} r="3.8" fill="#334155" stroke="#94A3B8" strokeWidth="0.8" />
                          <circle cx={caveSvgX} cy={caveSvgY} r="1.4" fill="#F59E0B" />
                        </g>
                      )}
                      <circle cx={homeSvgX} cy={homeSvgY} r="3.4" fill="#A16207" stroke="#FDE68A" strokeWidth="0.7" />
                      <rect
                        x={tavernSvgX - 3.6}
                        y={tavernSvgY - 3.6}
                        width="7.2"
                        height="7.2"
                        rx="1.5"
                        fill="#D97706"
                        stroke="#FDE68A"
                        strokeWidth="0.8"
                      />
                    </>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}

      {env === 'sideScroller' && (
        <>
          <rect width="100" height="100" fill="#14233C" />
          <rect x="3" y="34" width="94" height="32" rx="4" fill="#2A4D3E" stroke="#7BA66D" strokeWidth="1.2" />
          <line x1="4" y1="50" x2="96" y2="50" stroke="#A3E635" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="3 2" />
          {level.entities
            .filter((e) => e.kind === 'platform')
            .map((p) => (
              <rect
                key={p.id}
                x={p.position.x * 100 - 4}
                y={p.position.y * 100 - 1.5}
                width="8"
                height="3"
                rx="1"
                fill="#38BDF8"
              />
            ))}
        </>
      )}

      {env === 'dungeon' && (
        <>
          <rect width="100" height="100" fill="#131620" />
          <rect x="6" y="8" width="88" height="84" rx="5" fill="#181C27" stroke="#475569" strokeWidth="1.4" />
          {level.dungeonRooms && level.dungeonRooms.length > 0 && level.dungeonRooms.map((room) => {
            const rx1 = Math.max(6, Math.min(94, (room.minX / 76 + 0.5) * 100));
            const rx2 = Math.max(6, Math.min(94, (room.maxX / 76 + 0.5) * 100));
            const rz1 = Math.max(8, Math.min(92, (room.minZ / 76 + 0.5) * 100));
            const rz2 = Math.max(8, Math.min(92, (room.maxZ / 76 + 0.5) * 100));
            const roomFill =
              room.role === 'entrance'
                ? '#1E3A2F'
                : room.role === 'boss'
                ? '#3B1A24'
                : room.role === 'treasure'
                ? '#3A2E18'
                : '#2A303C';
            return (
              <rect
                key={room.id}
                x={rx1}
                y={rz1}
                width={Math.max(3, rx2 - rx1)}
                height={Math.max(3, rz2 - rz1)}
                rx="1.2"
                fill={roomFill}
                fillOpacity="0.85"
                stroke="#64748B"
                strokeOpacity="0.28"
                strokeWidth="0.4"
              />
            );
          })}
          {level.customWallBoxes && level.customWallBoxes.length > 0 ? (
            level.customWallBoxes
              .filter((b) => Math.abs(b.maxX - b.minX) < 70 && Math.abs(b.maxZ - b.minZ) < 70)
              .map((b, idx) => {
                const x1 = Math.max(6, Math.min(94, (b.minX / 76 + 0.5) * 100));
                const x2 = Math.max(6, Math.min(94, (b.maxX / 76 + 0.5) * 100));
                const z1 = Math.max(8, Math.min(92, (b.minZ / 76 + 0.5) * 100));
                const z2 = Math.max(8, Math.min(92, (b.maxZ / 76 + 0.5) * 100));
                return (
                  <rect
                    key={idx}
                    x={x1}
                    y={z1}
                    width={Math.max(2, x2 - x1)}
                    height={Math.max(2, z2 - z1)}
                    rx={b.kind === 'caveRock' ? 2 : 0.8}
                    fill={b.kind === 'pillar' ? '#475569' : '#131620'}
                    stroke="#64748B"
                    strokeOpacity="0.4"
                    strokeWidth="0.5"
                  />
                );
              })
          ) : (
            <>
              <line x1="38" y1="8" x2="38" y2="33" stroke="#131620" strokeWidth="2.5" />
              <line x1="38" y1="48" x2="38" y2="65" stroke="#131620" strokeWidth="2.5" />
              <line x1="38" y1="81" x2="38" y2="92" stroke="#131620" strokeWidth="2.5" />
              <line x1="71" y1="8" x2="71" y2="27" stroke="#131620" strokeWidth="2.5" />
              <line x1="71" y1="43" x2="71" y2="61" stroke="#131620" strokeWidth="2.5" />
              <line x1="71" y1="77" x2="71" y2="92" stroke="#131620" strokeWidth="2.5" />
            </>
          )}
        </>
      )}

      {env === 'castle' && (
        <>
          <rect width="100" height="100" fill="#2B3240" />
          <rect x="6" y="7" width="88" height="86" rx="5" fill="#7D8490" stroke="#CBD5E1" strokeWidth="1.2" />
          <rect x="44" y="18" width="12" height="72" fill="#8D1D2C" opacity="0.85" />
          <rect x="30" y="9" width="40" height="15" rx="2" fill="#64748B" stroke="#FACC15" strokeWidth="0.9" />
        </>
      )}

      {env === 'scifi' && (
        <>
          <rect width="100" height="100" fill="#09111E" />
          <rect x="8" y="8" width="84" height="84" rx="8" fill="#162238" stroke="#38BDF8" strokeOpacity="0.65" strokeWidth="1.3" />
          <line x1="50" y1="10" x2="50" y2="90" stroke="#38BDF8" strokeOpacity="0.2" strokeWidth="0.8" />
          <line x1="10" y1="50" x2="90" y2="50" stroke="#38BDF8" strokeOpacity="0.2" strokeWidth="0.8" />
        </>
      )}

      {/* Driving Ramps */}
      {isDriving &&
        ramps.map((r) => (
          <polygon
            key={r.id}
            points="-2.2,1.6 2.2,1.6 0,-2.0"
            transform={`translate(${(r.position.x * 100).toFixed(1)} ${(r.position.y * 100).toFixed(1)}) rotate(${r.rotation})`}
            fill="#F97316"
            stroke="#FFF7ED"
            strokeWidth="0.5"
          />
        ))}
    </>
  );

  return (
    <svg
      viewBox="0 0 100 100"
      onClick={handleSvgClick}
      className={`w-full h-full block select-none ${
        interactive ? 'cursor-crosshair' : ''
      }`}
    >
      {fogRevealPath !== null ? (
        <>
          <defs>
            <filter id={`${fogMaskId}-blur`}>
              <feGaussianBlur stdDeviation="1.4" />
            </filter>
            <mask id={fogMaskId}>
              <rect width="100" height="100" fill="black" />
              {fogRevealPath && (
                <path
                  d={fogRevealPath}
                  fill="white"
                  filter={`url(#${fogMaskId}-blur)`}
                />
              )}
            </mask>
          </defs>
          <g style={{ filter: 'grayscale(1) brightness(0.42)' }}>
            {renderTerrainScene()}
          </g>
          <g mask={`url(#${fogMaskId})`}>
            {renderTerrainScene()}
          </g>
        </>
      ) : (
        renderTerrainScene()
      )}

      {/* Driving Checkpoints */}
      {isDriving &&
        checkpoints.map((cp) => {
          const isCleared = clearedCpSet.has(cp.id);
          const isNext = nextCheckpointId === cp.id;
          const cx = cp.position.x * 100;
          const cy = cp.position.y * 100;
          return (
            <g
              key={cp.id}
              onClick={(e) => {
                if (!onSelectEntity) return;
                e.stopPropagation();
                onSelectEntity(cp.id);
              }}
              className={onSelectEntity ? 'cursor-pointer' : ''}
            >
              {isNext && (
                <circle
                  cx={cx}
                  cy={cy}
                  r="4.5"
                  fill="none"
                  stroke="#FACC15"
                  strokeWidth="0.9"
                  strokeOpacity="0.85"
                />
              )}
              <circle
                cx={cx}
                cy={cy}
                r="2.7"
                fill={isCleared ? '#20B46A' : isNext ? '#FACC15' : '#38BDF8'}
                stroke="#0F172A"
                strokeWidth="0.7"
              />
              <text
                x={cx}
                y={cy + 0.95}
                textAnchor="middle"
                fontSize="3.1"
                fontWeight="800"
                fill="#0F172A"
              >
                {cp.checkpointOrder ?? ''}
              </text>
            </g>
          );
        })}

      {/* Start & Portal Markers */}
      {level.hasStart && (
        <g>
          <circle
            cx={startPt.x * 100}
            cy={startPt.y * 100}
            r="2.6"
            fill="#7C5CFF"
            stroke="#FFFFFF"
            strokeWidth="0.7"
          />
          <text
            x={startPt.x * 100}
            y={startPt.y * 100 + 0.95}
            textAnchor="middle"
            fontSize="3.1"
            fontWeight="800"
            fill="#FFFFFF"
          >
            S
          </text>
        </g>
      )}

      {level.hasPortal && (
        <polygon
          points="0,-3.4 3.4,0 0,3.4 -3.4,0"
          transform={`translate(${(portalPt.x * 100).toFixed(1)} ${(portalPt.y * 100).toFixed(1)})`}
          fill={isDriving ? '#20B46A' : accentHex}
          stroke="#FFFFFF"
          strokeWidth="0.8"
        />
      )}

      {/* Save / Spawn Plinths */}
      {savePlinths.map((sp) => {
        const sx = sp.position.x * 100;
        const sy = sp.position.y * 100;
        const isSel = sp.id === selectedEntityID;
        return (
          <g
            key={sp.id}
            transform={`translate(${sx.toFixed(1)} ${sy.toFixed(1)})`}
            onClick={(e) => {
              if (!onSelectEntity) return;
              e.stopPropagation();
              onSelectEntity(sp.id);
            }}
            className={onSelectEntity ? 'cursor-pointer' : ''}
          >
            <circle cx="0" cy="0" r={isSel ? 5.2 : 4.2} fill="#38BDF8" fillOpacity="0.28" />
            <polygon
              points="0,-3.2 3.2,0 0,3.2 -3.2,0"
              fill="#38BDF8"
              stroke="#FFFFFF"
              strokeWidth={isSel ? 1.1 : 0.75}
            />
          </g>
        );
      })}

      {/* Baddies, Treasures, Non-buddy NPCs */}
      {level.entities.map((ent) => {
        if (ent.kind === 'checkpoint' || ent.isBuddy) return null;
        if (ent.kind !== 'baddie' && ent.kind !== 'treasure' && ent.kind !== 'key' && ent.kind !== 'npc') {
          return null;
        }
        const ex = ent.position.x * 100;
        const ey = ent.position.y * 100;
        const isSel = ent.id === selectedEntityID;
        const fill =
          ent.kind === 'baddie'
            ? '#F2545B'
            : ent.kind === 'treasure' || ent.kind === 'key'
            ? '#FACC15'
            : '#38BDF8';
        return (
          <circle
            key={ent.id}
            cx={ex}
            cy={ey}
            r={isSel ? 2.6 : 1.7}
            fill={fill}
            stroke="#FFFFFF"
            strokeWidth={isSel ? 0.9 : 0.45}
            onClick={(e) => {
              if (!onSelectEntity) return;
              e.stopPropagation();
              onSelectEntity(ent.id);
            }}
            className={onSelectEntity ? 'cursor-pointer' : ''}
          />
        );
      })}

      {/* Buddies Quest Woodland Friend Markers */}
      {buddies.map((b) => {
        const bx = b.position.x * 100;
        const by = b.position.y * 100;
        const isRecruited = recruitedSet.has(b.id);
        const isSel = b.id === selectedEntityID;
        return (
          <g
            key={b.id}
            onClick={(e) => {
              if (!onSelectEntity) return;
              e.stopPropagation();
              onSelectEntity(b.id);
            }}
            className={onSelectEntity ? 'cursor-pointer' : ''}
          >
            {!isRecruited && (
              <circle
                cx={bx}
                cy={by}
                r="4.3"
                fill="none"
                stroke="#FACC15"
                strokeWidth="0.7"
                strokeOpacity="0.8"
              />
            )}
            <circle
              cx={bx}
              cy={by}
              r={isSel ? 3.2 : 2.7}
              fill={isRecruited ? '#20B46A' : '#FACC15'}
              stroke="#0F172A"
              strokeWidth="0.75"
            />
            <text
              x={bx}
              y={by + 1.0}
              textAnchor="middle"
              fontSize="3.2"
              fontWeight="900"
              fill="#0F172A"
            >
              {b.name.charAt(0).toUpperCase()}
            </text>
          </g>
        );
      })}

      {/* Live Breadcrumb Trail */}
      {trailPointsStr && (
        <polyline
          points={trailPointsStr}
          fill="none"
          stroke={isDriving ? '#38BDF8' : '#4ADE80'}
          strokeWidth="1.2"
          strokeOpacity="0.65"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* Live Tracked Player Heading Chevron */}
      <g transform={`translate(${px.toFixed(1)} ${py.toFixed(1)})`}>
        <circle
          cx="0"
          cy="0"
          r="5.6"
          fill={isDriving ? '#38BDF8' : '#20B46A'}
          fillOpacity="0.24"
        />
        <polygon
          points="0,-4.4 3.2,3.4 0,1.7 -3.2,3.4"
          transform={`rotate(${headingDeg.toFixed(1)})`}
          fill="#FFFFFF"
          stroke={isDriving ? '#0284C7' : '#15803D'}
          strokeWidth="0.85"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
});

export const PersistentMinimapHUD: React.FC<{ store: MakerStore }> = React.memo(({ store }) => {
  const { currentProject, currentLevel, isPlaying, playModalOpen, playFromPoint, playerTelemetry } = store;
  const [liveTelemetry, setLiveTelemetry] = useState<PlayerTelemetry | null>(() =>
    getLivePlayerTelemetry()
  );
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [fogRevision, setFogRevision] = useState(0);

  useEffect(() => {
    setLiveTelemetry(getLivePlayerTelemetry());
    if (collapsed) return;
    return subscribeLivePlayerTelemetry((next) => {
      setLiveTelemetry(next);
    });
  }, [collapsed]);

  useEffect(() => {
    if (!currentProject?.id || collapsed) return;
    setFogRevision(getExplorationSnapshot(currentProject.id).revision);
    return subscribeExploration((pid) => {
      if (pid === currentProject.id) {
        setFogRevision(getExplorationSnapshot(currentProject.id).revision);
      }
    });
  }, [currentProject?.id, collapsed]);

  const resolvedTelemetry = liveTelemetry ?? playerTelemetry;
  const activeTelemetry =
    currentLevel && resolvedTelemetry && resolvedTelemetry.levelId === currentLevel.id
      ? resolvedTelemetry
      : null;
  const displayLevel =
    isPlaying && activeTelemetry?.roguelikeFloorLevel
      ? activeTelemetry.roguelikeFloorLevel
      : currentLevel;

  const fogRevealPath = useMemo(() => {
    if (!currentProject || !displayLevel || !isPlaying || !currentProject.worldMapFogOfWar) {
      return null;
    }
    const snap = getExplorationSnapshot(currentProject.id);
    const info = getEffectiveMapInfo(currentProject, displayLevel);
    const viewR = getEnvironmentType(displayLevel) === 'openWorld'
      ? getTerrainRadius(displayLevel.terrain)
      : 44;
    const mapSpan = Math.max(1, info.radius * 2);
    const minU = (info.originX - viewR + info.radius) / mapSpan;
    const maxU = (info.originX + viewR + info.radius) / mapSpan;
    const minV = (info.originZ - viewR + info.radius) / mapSpan;
    const maxV = (info.originZ + viewR + info.radius) / mapSpan;
    return buildSvgFogRunPath(snap.data, EXPLORE_GRID_SIZE, minU, maxU, minV, maxV);
  }, [isPlaying, currentProject, displayLevel, fogRevision]);

  if (!currentProject || !currentLevel || !displayLevel || !isPlaying || playModalOpen) {
    return null;
  }

  const env = getEnvironmentType(displayLevel);

  const fallbackStart =
    displayLevel.startPoint ?? (env === 'sideScroller' ? { x: 0.1, y: 0.5 } : { x: 0.14, y: 0.8 });

  const playerPoint: BoardPoint =
    activeTelemetry?.point ?? playFromPoint ?? fallbackStart;

  const defaultYaw =
    env === 'sideScroller'
      ? Math.PI * 0.5
      : displayLevel.gameplayMode === 'driving'
      ? Math.PI * 0.55
      : displayLevel.gameplayMode === 'buddies'
      ? Math.PI * 0.72
      : Math.PI;

  const playerYaw = activeTelemetry?.yaw ?? defaultYaw;
  const { zone, status } = describeZone(displayLevel, playerPoint, activeTelemetry);

  const isPinnedAway =
    playFromPoint !== null &&
    (Math.abs(playFromPoint.x - fallbackStart.x) > 0.015 ||
      Math.abs(playFromPoint.y - fallbackStart.y) > 0.015);

  const modeLabel =
    displayLevel.gameplayMode === 'roguelike'
      ? 'Crypt'
      : displayLevel.gameplayMode === 'buddies'
      ? 'Buddies'
      : displayLevel.gameplayMode === 'driving'
      ? 'Driving'
      : env === 'sideScroller'
      ? 'Platformer'
      : env === 'dungeon'
      ? 'Dungeon'
      : 'World';

  // Position cleanly in Editor (above bottom nav, right corner) vs Play Mode (below topTrailing Coins/Pause)
  const dockClass = isPlaying
    ? 'fixed top-[68px] right-4 z-[55]'
    : 'fixed bottom-[64px] right-4 z-30';

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        title="Expand Minimap HUD"
        className={`${dockClass} inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-[#11141D]/95 text-white border border-white/15 shadow-xl hover:bg-[#191E2B] text-xs font-extrabold`}
      >
        <MapIcon size={14} className="text-[#38BDF8]" />
        <span>Minimap</span>
        <span className="text-[11px] font-semibold text-white/70 max-w-[140px] truncate">
          {zone}
        </span>
      </button>
    );
  }

  const mapBoxSize = isPlaying
    ? expanded
      ? 200
      : 148
    : expanded
    ? 236
    : 164;

  return (
    <aside
      aria-label="Persistent Level Minimap HUD"
      className={`${dockClass} rounded-2xl bg-[#11141D]/95 text-white border border-white/15 shadow-2xl overflow-hidden transition-all`}
      style={{ width: mapBoxSize + 18 }}
    >
      {/* Header Bar */}
      <div className="px-2.5 py-1.5 bg-white/[0.04] border-b border-white/[0.08] flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {displayLevel.gameplayMode === 'roguelike' ? (
            <Flame size={12} className="text-[#E11D48] shrink-0" />
          ) : displayLevel.gameplayMode === 'buddies' ? (
            <Users size={12} className="text-[#FACC15] shrink-0" />
          ) : displayLevel.gameplayMode === 'driving' ? (
            <Flag size={12} className="text-[#38BDF8] shrink-0" />
          ) : (
            <Compass size={12} className="text-[#7C5CFF] shrink-0" />
          )}
          <span className="text-[11px] font-extrabold truncate">{modeLabel} Map</span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            title={expanded ? 'Compact minimap' : 'Expand minimap'}
            className="w-6 h-6 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/75 hover:text-white"
          >
            {expanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            title="Minimize minimap"
            className="w-6 h-6 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/75 hover:text-white"
          >
            <ChevronDown size={13} />
          </button>
        </div>
      </div>

      {/* Map Canvas */}
      <div className="p-2 flex flex-col gap-1.5">
        <div
          onClick={isPlaying ? () => requestOpenInGameWorldMap() : undefined}
          role={isPlaying ? 'button' : undefined}
          tabIndex={isPlaying ? 0 : undefined}
          onKeyDown={
            isPlaying
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    requestOpenInGameWorldMap();
                  }
                }
              : undefined
          }
          className={`rounded-xl overflow-hidden border border-white/15 bg-[#0B2239] shadow-inner mx-auto ${
            isPlaying ? 'cursor-pointer hover:border-[#38BDF8]/70 transition-colors' : ''
          }`}
          style={{ width: mapBoxSize, height: mapBoxSize }}
          title={
            isPlaying
              ? 'Touch or press M to open World Map'
              : 'Click anywhere on the minimap to move the player pin'
          }
        >
          <TemplateMinimapSVG
            level={displayLevel}
            playerPoint={playerPoint}
            playerYaw={playerYaw}
            telemetry={activeTelemetry}
            selectedEntityID={!isPlaying ? store.selectedEntityID : null}
            interactive={!isPlaying}
            fogRevealPath={fogRevealPath}
            onSelectEntity={
              !isPlaying ? (id) => store.setSelectedEntityID(id) : undefined
            }
            onMapClick={
              !isPlaying
                ? (pt) => {
                    store.setPlayFromPoint(pt);
                    store.setPlayerTelemetry({
                      levelId: currentLevel.id,
                      point: pt,
                      yaw: playerYaw,
                      buddiesFound: activeTelemetry?.buddiesFound ?? 0,
                      buddiesTotal: activeTelemetry?.buddiesTotal,
                      recruitedBuddyIds: activeTelemetry?.recruitedBuddyIds ?? [],
                      checkpointsHit: activeTelemetry?.checkpointsHit ?? 0,
                      checkpointsTotal: activeTelemetry?.checkpointsTotal,
                      clearedCheckpointIds: activeTelemetry?.clearedCheckpointIds ?? [],
                      trail: [pt],
                    });
                  }
                : undefined
            }
          />
        </div>

        {/* Live Landmark & Telemetry Status */}
        <div className="space-y-0.5 px-0.5">
          <div className="text-[11px] font-bold text-white truncate">{zone}</div>
          <div className="flex items-center justify-between gap-1 text-[10px] font-semibold text-white/70">
            <span className="truncate">{isPlaying ? 'Touch map or M · World Map' : status}</span>
            <span className="tabular-nums shrink-0 text-white/50">
              {Math.round(playerPoint.x * 100)},{Math.round(playerPoint.y * 100)}
            </span>
          </div>
        </div>

        {/* Quick Pin / Test Actions (Editor Only) */}
        {!isPlaying && (
          <div className="flex items-center gap-1 pt-0.5">
            <button
              type="button"
              onClick={() => {
                store.setPlayFromPoint(playerPoint);
                store.setIsPlaying(true);
              }}
              className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 rounded-lg bg-[#20B46A] hover:opacity-95 text-white text-[10px] font-extrabold"
              title="Launch Play Mode at the tracked player marker"
            >
              <Play size={10} fill="currentColor" />
              <span>{isPinnedAway ? 'Play from pin' : 'Play'}</span>
            </button>
            {(isPinnedAway || Boolean(activeTelemetry)) && (
              <button
                type="button"
                onClick={() => {
                  store.setPlayFromPoint(null);
                  store.setPlayerTelemetry(null);
                }}
                className="w-7 h-6 rounded-lg bg-white/10 hover:bg-white/18 flex items-center justify-center text-white/80 hover:text-white shrink-0"
                title="Reset player tracker back to Start"
              >
                <RotateCcw size={11} />
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
});
