import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Compass, MapPin, Navigation, Sparkles, X } from 'lucide-react';
import type { GameLevel, GameProject } from '../../types/maker';
import { getBiome } from '../../data/registries';
import {
  getEnvironmentType,
  getTerrainRadius,
  IslandRiver,
  IslandTerrain,
  levelBoardToWorld,
  MountainCave,
  terrainHasMainMountainCave,
  TerrainPaths,
} from '../../utils/terrain';
import { getWorldMapRadius } from '../../utils/worldMap';
import {
  EXPLORE_GRID_SIZE,
  findSavePlinthTargets,
  getEffectiveMapInfo,
  getExplorationSnapshot,
  getExploredPercent,
  levelLocalToMapCoords,
  subscribeExploration,
  type SavePlinthTarget,
} from '../../utils/worldMapFog';

export interface InGameWorldMapModalProps {
  project: GameProject;
  currentLevel: GameLevel;
  heroLocalX: number;
  heroLocalZ: number;
  heroYaw: number;
  mode: 'worldMap' | 'fastTravel';
  currentPlinthName?: string;
  currentPlinthEntityId?: string;
  discoveredPlinthKeys: Set<string>;
  onFastTravel?: (target: SavePlinthTarget) => void;
  onClose: () => void;
}

const CANVAS_RES = 512;

function hexToRgb(hex: string, fallback: [number, number, number]): [number, number, number] {
  const clean = hex.replace('#', '');
  const norm =
    clean.length === 3
      ? clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2]
      : clean;
  const parsed = parseInt(norm, 16);
  if (Number.isNaN(parsed)) return fallback;
  return [(parsed >> 16) & 255, (parsed >> 8) & 255, parsed & 255];
}

export const InGameWorldMapModal: React.FC<InGameWorldMapModalProps> = ({
  project,
  currentLevel,
  heroLocalX,
  heroLocalZ,
  heroYaw,
  mode,
  currentPlinthName,
  currentPlinthEntityId,
  discoveredPlinthKeys,
  onFastTravel,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [exploreRevision, setExploreRevision] = useState(
    () => getExplorationSnapshot(project.id).revision
  );
  const [hoveredPlinthKey, setHoveredPlinthKey] = useState<string | null>(null);

  useEffect(() => {
    setExploreRevision(getExplorationSnapshot(project.id).revision);
    return subscribeExploration((pid) => {
      if (pid === project.id) {
        setExploreRevision(getExplorationSnapshot(project.id).revision);
      }
    });
  }, [project.id]);

  const fogEnabled = Boolean(project.worldMapFogOfWar);
  const mapInfo = useMemo(
    () => getEffectiveMapInfo(project, currentLevel),
    [project, currentLevel]
  );
  const mapRadius = mapInfo.radius;
  const [heroMapX, heroMapZ] = useMemo(
    () => levelLocalToMapCoords(project, currentLevel, heroLocalX, heroLocalZ),
    [project, currentLevel, heroLocalX, heroLocalZ]
  );

  const plinths = useMemo(() => findSavePlinthTargets(project), [project]);
  const exploredPct = useMemo(
    () => (fogEnabled ? getExploredPercent(project.id) : 100),
    [fogEnabled, project.id, exploreRevision]
  );

  const currentRegion = useMemo(() => {
    if (!project.worldMap) return null;
    return project.worldMap.regions.find((r) => r.levelId === currentLevel.id) ?? null;
  }, [project.worldMap, currentLevel.id]);

  // Pre-build full-color & greyscale offscreen map canvases when level/worldMap changes
  const mapCanvases = useMemo(() => {
    const colorCanvas = document.createElement('canvas');
    colorCanvas.width = CANVAS_RES;
    colorCanvas.height = CANVAS_RES;
    const cctx = colorCanvas.getContext('2d');

    const grayCanvas = document.createElement('canvas');
    grayCanvas.width = CANVAS_RES;
    grayCanvas.height = CANVAS_RES;
    const gctx = grayCanvas.getContext('2d');

    if (!cctx || !gctx) {
      return { colorCanvas, grayCanvas };
    }

    const toPx = (mx: number, mz: number): [number, number] => [
      ((mx + mapRadius) / (2 * mapRadius)) * CANVAS_RES,
      ((mz + mapRadius) / (2 * mapRadius)) * CANVAS_RES,
    ];

    const wm = project.worldMap;
    if (mapInfo.isWorldMap && wm && wm.landMask.length > 0) {
      // Rasterize full 1280x1280 World Map cleanly
      const img = cctx.createImageData(CANVAS_RES, CANVAS_RES);
      const pxData = img.data;
      const gSize = wm.gridSize;
      const gWidth = gSize + 1;
      const worldR = getWorldMapRadius(wm);
      const regionColors = new Map<number, [number, number, number]>();
      for (const r of wm.regions) {
        regionColors.set(r.code, hexToRgb(r.colorHex, [32, 180, 106]));
      }
      const oceanRgb: [number, number, number] = [14, 59, 89];
      const yellowRgb: [number, number, number] = [229, 198, 126];

      for (let py = 0; py < CANVAS_RES; py++) {
        const mz = (py / (CANVAS_RES - 1)) * 2 * worldR - worldR;
        const row = Math.max(0, Math.min(gSize, Math.round(((mz + worldR) / (2 * worldR)) * gSize)));
        const gRowOff = row * gWidth;
        for (let px = 0; px < CANVAS_RES; px++) {
          const mx = (px / (CANVAS_RES - 1)) * 2 * worldR - worldR;
          const col = Math.max(
            0,
            Math.min(gSize, Math.round(((mx + worldR) / (2 * worldR)) * gSize))
          );
          const idx = gRowOff + col;
          const isLand = wm.landMask[idx] === 1;
          let rgb = oceanRgb;
          if (isLand) {
            const code = wm.regionGrid[idx] ?? 0;
            rgb = code > 0 ? regionColors.get(code) ?? yellowRgb : yellowRgb;
            // Subtle shore edge darken
            const nL = col > 0 ? wm.landMask[idx - 1] === 1 : false;
            const nR = col < gSize ? wm.landMask[idx + 1] === 1 : false;
            const nU = row > 0 ? wm.landMask[idx - gWidth] === 1 : false;
            const nD = row < gSize ? wm.landMask[idx + gWidth] === 1 : false;
            if (!nL || !nR || !nU || !nD) {
              rgb = [
                Math.max(0, rgb[0] - 28),
                Math.max(0, rgb[1] - 28),
                Math.max(0, rgb[2] - 28),
              ];
            }
          }
          const outIdx = (py * CANVAS_RES + px) * 4;
          pxData[outIdx] = rgb[0];
          pxData[outIdx + 1] = rgb[1];
          pxData[outIdx + 2] = rgb[2];
          pxData[outIdx + 3] = 255;
        }
      }
      cctx.putImageData(img, 0, 0);

      // Subtle coordinate grid
      cctx.strokeStyle = 'rgba(255,255,255,0.07)';
      cctx.lineWidth = 1;
      for (let i = 1; i < 8; i++) {
        const p = (i / 8) * CANVAS_RES;
        cctx.beginPath();
        cctx.moveTo(p, 0);
        cctx.lineTo(p, CANVAS_RES);
        cctx.moveTo(0, p);
        cctx.lineTo(CANVAS_RES, p);
        cctx.stroke();
      }

      // Draw water bodies & roads for each openWorld Land positioned at its World Origin
      for (const reg of wm.regions) {
        const lvl = project.levels.find((l) => l.id === reg.levelId);
        if (!lvl?.terrain) continue;
        const [ox, oz] = reg.origin ?? [0, 0];
        for (const wb of lvl.terrain.waterBodies ?? []) {
          const [cx, cz] = toPx(ox + wb.center[0], oz + wb.center[1]);
          const rx = (wb.radiusX / (2 * worldR)) * CANVAS_RES;
          const rz = (wb.radiusZ / (2 * worldR)) * CANVAS_RES;
          cctx.save();
          cctx.translate(cx, cz);
          cctx.beginPath();
          cctx.ellipse(0, 0, Math.max(3, rx), Math.max(3, rz), 0, 0, Math.PI * 2);
          cctx.fillStyle = '#2589D8';
          cctx.fill();
          cctx.restore();
        }
        for (const rd of lvl.terrain.roads ?? []) {
          if (!rd.points || rd.points.length < 2) continue;
          cctx.save();
          cctx.beginPath();
          rd.points.forEach((pt, idx) => {
            const [rx, rz] = toPx(ox + pt[0], oz + pt[1]);
            if (idx === 0) cctx.moveTo(rx, rz);
            else cctx.lineTo(rx, rz);
          });
          cctx.strokeStyle = '#C29B6B';
          cctx.lineWidth = Math.max(1.8, (rd.width / (2 * worldR)) * CANVAS_RES);
          cctx.lineCap = 'round';
          cctx.lineJoin = 'round';
          cctx.stroke();
          cctx.restore();
        }
      }
    } else {
      // Single-Level Map (OpenWorld island without WorldMap OR Dungeon / Castle / SciFi / SideScroller)
      const env = getEnvironmentType(currentLevel);
      const biome = getBiome(currentLevel.biome);
      if (env === 'openWorld') {
        cctx.fillStyle = '#0E3B59';
        cctx.fillRect(0, 0, CANVAS_RES, CANVAS_RES);
        const rPx = (getTerrainRadius(currentLevel.terrain) / (2 * mapRadius)) * CANVAS_RES;
        cctx.beginPath();
        cctx.arc(CANVAS_RES / 2, CANVAS_RES / 2, rPx * 0.94, 0, Math.PI * 2);
        cctx.fillStyle = biome.ground;
        cctx.fill();
        cctx.lineWidth = 4;
        cctx.strokeStyle = '#DFC78B';
        cctx.stroke();

        const isFreeform = Boolean(currentLevel.terrain?.freeformWorld);
        if (!isFreeform) {
          // Legacy template island river & trail
          cctx.beginPath();
          IslandRiver.samples.forEach((s, idx) => {
            const [px, py] = toPx(s.x, s.z);
            if (idx === 0) cctx.moveTo(px, py);
            else cctx.lineTo(px, py);
          });
          cctx.strokeStyle = '#2B8CE6';
          cctx.lineWidth = 10;
          cctx.lineCap = 'round';
          cctx.stroke();

          cctx.beginPath();
          TerrainPaths.samples.forEach((s, idx) => {
            const [px, py] = toPx(s.x, s.z);
            if (idx === 0) cctx.moveTo(px, py);
            else cctx.lineTo(px, py);
          });
          cctx.strokeStyle = '#C9A26B';
          cctx.lineWidth = 6;
          cctx.lineCap = 'round';
          cctx.stroke();
        } else {
          for (const wb of currentLevel.terrain?.waterBodies ?? []) {
            const [cx, cz] = toPx(wb.center[0], wb.center[1]);
            const rx = (wb.radiusX / (2 * mapRadius)) * CANVAS_RES;
            const rz = (wb.radiusZ / (2 * mapRadius)) * CANVAS_RES;
            cctx.save();
            cctx.translate(cx, cz);
            cctx.beginPath();
            cctx.ellipse(0, 0, Math.max(4, rx), Math.max(4, rz), 0, 0, Math.PI * 2);
            cctx.fillStyle = '#2B8CE6';
            cctx.fill();
            cctx.restore();
          }
          for (const rd of currentLevel.terrain?.roads ?? []) {
            if (!rd.points || rd.points.length < 2) continue;
            cctx.save();
            cctx.beginPath();
            rd.points.forEach((pt, idx) => {
              const [rx, rz] = toPx(pt[0], pt[1]);
              if (idx === 0) cctx.moveTo(rx, rz);
              else cctx.lineTo(rx, rz);
            });
            cctx.strokeStyle = '#C9A26B';
            cctx.lineWidth = Math.max(3, (rd.width / (2 * mapRadius)) * CANVAS_RES);
            cctx.lineCap = 'round';
            cctx.lineJoin = 'round';
            cctx.stroke();
            cctx.restore();
          }
        }

        if (terrainHasMainMountainCave(currentLevel.terrain)) {
          const [caveX, caveZ] = toPx(MountainCave.x, MountainCave.z);
          cctx.beginPath();
          cctx.arc(caveX, caveZ, 12, 0, Math.PI * 2);
          cctx.fillStyle = '#334155';
          cctx.fill();
        }
      } else if (env === 'dungeon') {
        cctx.fillStyle = '#131620';
        cctx.fillRect(0, 0, CANVAS_RES, CANVAS_RES);
        cctx.fillStyle = '#222836';
        cctx.fillRect(34, 34, CANVAS_RES - 68, CANVAS_RES - 68);
        for (const room of currentLevel.dungeonRooms ?? []) {
          const [x1, z1] = toPx(room.minX, room.minZ);
          const [x2, z2] = toPx(room.maxX, room.maxZ);
          cctx.fillStyle =
            room.role === 'entrance'
              ? '#1E3A2F'
              : room.role === 'boss'
              ? '#3B1A24'
              : room.role === 'treasure'
              ? '#3A2E18'
              : '#2D3546';
          cctx.fillRect(x1, z1, Math.max(8, x2 - x1), Math.max(8, z2 - z1));
        }
        for (const wb of currentLevel.customWallBoxes ?? []) {
          const [x1, z1] = toPx(wb.minX, wb.minZ);
          const [x2, z2] = toPx(wb.maxX, wb.maxZ);
          cctx.fillStyle = '#11141C';
          cctx.fillRect(x1, z1, Math.max(4, x2 - x1), Math.max(4, z2 - z1));
        }
      } else if (env === 'castle') {
        cctx.fillStyle = '#2B3240';
        cctx.fillRect(0, 0, CANVAS_RES, CANVAS_RES);
        cctx.fillStyle = '#7D8490';
        cctx.fillRect(36, 36, CANVAS_RES - 72, CANVAS_RES - 72);
        cctx.fillStyle = '#8D1D2C';
        cctx.fillRect(CANVAS_RES * 0.44, CANVAS_RES * 0.16, CANVAS_RES * 0.12, CANVAS_RES * 0.72);
      } else if (env === 'scifi') {
        cctx.fillStyle = '#09111E';
        cctx.fillRect(0, 0, CANVAS_RES, CANVAS_RES);
        cctx.fillStyle = '#162238';
        cctx.fillRect(42, 42, CANVAS_RES - 84, CANVAS_RES - 84);
        cctx.strokeStyle = 'rgba(56,189,248,0.45)';
        cctx.lineWidth = 3;
        cctx.strokeRect(42, 42, CANVAS_RES - 84, CANVAS_RES - 84);
      } else {
        cctx.fillStyle = '#14233C';
        cctx.fillRect(0, 0, CANVAS_RES, CANVAS_RES);
        cctx.fillStyle = '#2A4D3E';
        cctx.fillRect(20, CANVAS_RES * 0.34, CANVAS_RES - 40, CANVAS_RES * 0.32);
      }

      // Portal marker
      if (currentLevel.hasPortal) {
        const pt = currentLevel.portalPoint ?? { x: 0.88, y: 0.24 };
        const [wx, wz] = levelBoardToWorld(currentLevel, pt);
        const [px, py] = toPx(wx, wz);
        cctx.beginPath();
        cctx.arc(px, py, 8, 0, Math.PI * 2);
        cctx.fillStyle = '#7C5CFF';
        cctx.fill();
        cctx.strokeStyle = '#FFFFFF';
        cctx.lineWidth = 2;
        cctx.stroke();
      }
    }

    // Build greyed-out Fog-of-War base canvas via fast luminance desaturation
    const srcImg = cctx.getImageData(0, 0, CANVAS_RES, CANVAS_RES);
    const dstImg = gctx.createImageData(CANVAS_RES, CANVAS_RES);
    const s = srcImg.data;
    const d = dstImg.data;
    for (let i = 0; i < s.length; i += 4) {
      const lum = Math.round((0.299 * s[i] + 0.587 * s[i + 1] + 0.114 * s[i + 2]) * 0.42);
      d[i] = lum;
      d[i + 1] = lum;
      d[i + 2] = Math.min(255, Math.round(lum * 1.07));
      d[i + 3] = 255;
    }
    gctx.putImageData(dstImg, 0, 0);

    return { colorCanvas, grayCanvas };
  }, [project, currentLevel, mapInfo.isWorldMap, mapRadius]);

  // Composite Fog-of-War + Land labels onto main display canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_RES, CANVAS_RES);

    if (!fogEnabled) {
      ctx.drawImage(mapCanvases.colorCanvas, 0, 0);
    } else {
      ctx.drawImage(mapCanvases.grayCanvas, 0, 0);

      // Build soft reveal mask canvas from 128x128 explored cells
      const revealCanvas = document.createElement('canvas');
      revealCanvas.width = CANVAS_RES;
      revealCanvas.height = CANVAS_RES;
      const rctx = revealCanvas.getContext('2d');
      if (rctx) {
        const snap = getExplorationSnapshot(project.id);
        const gridSize = EXPLORE_GRID_SIZE;
        const data = snap.data;
        const cellPx = CANVAS_RES / gridSize;
        const brushR = cellPx * 1.65;

        rctx.fillStyle = '#FFFFFF';
        rctx.beginPath();
        for (let row = 0; row < gridSize; row++) {
          const cy = ((row + 0.5) / gridSize) * CANVAS_RES;
          const rowOff = row * gridSize;
          for (let col = 0; col < gridSize; col++) {
            if (data[rowOff + col] === 0) continue;
            const cx = ((col + 0.5) / gridSize) * CANVAS_RES;
            rctx.moveTo(cx + brushR, cy);
            rctx.arc(cx, cy, brushR, 0, Math.PI * 2);
          }
        }
        rctx.fill();

        rctx.globalCompositeOperation = 'source-in';
        rctx.drawImage(mapCanvases.colorCanvas, 0, 0);
        rctx.globalCompositeOperation = 'source-over';

        ctx.drawImage(revealCanvas, 0, 0);
      }
    }

    // Crisp World Map Region Name Labels (positioned inside each Land's bounds)
    const wm = project.worldMap;
    if (mapInfo.isWorldMap && wm && wm.regions.length > 0) {
      const worldR = getWorldMapRadius(wm);
      const gSize = wm.gridSize;
      const gWidth = gSize + 1;
      for (const reg of wm.regions) {
        let sumX = 0;
        let sumZ = 0;
        let cnt = 0;
        const step = (2 * worldR) / gSize;
        for (let r = 0; r <= gSize; r += 2) {
          const wz = -worldR + r * step;
          const rowOff = r * gWidth;
          for (let c = 0; c <= gSize; c += 2) {
            if (wm.landMask[rowOff + c] === 1 && wm.regionGrid[rowOff + c] === reg.code) {
              sumX += -worldR + c * step;
              sumZ += wz;
              cnt++;
            }
          }
        }
        if (cnt === 0) continue;
        const cx = ((sumX / cnt + worldR) / (2 * worldR)) * CANVAS_RES;
        const cy = ((sumZ / cnt + worldR) / (2 * worldR)) * CANVAS_RES;

        ctx.save();
        ctx.font = '700 12px ui-sans-serif, system-ui, -apple-system, sans-serif';
        const textW = ctx.measureText(reg.name).width;
        const pillW = textW + 14;
        const pillH = 20;
        ctx.fillStyle = 'rgba(11, 15, 25, 0.78)';
        ctx.beginPath();
        ctx.roundRect(cx - pillW / 2, cy - pillH / 2, pillW, pillH, 6);
        ctx.fill();
        ctx.strokeStyle = reg.levelId === currentLevel.id ? '#FFFFFF' : 'rgba(255,255,255,0.22)';
        ctx.lineWidth = reg.levelId === currentLevel.id ? 1.5 : 1;
        ctx.stroke();
        ctx.fillStyle = '#F8FAFC';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(reg.name, cx, cy + 0.5);
        ctx.restore();
      }
    }
  }, [
    project.id,
    project.worldMap,
    currentLevel.id,
    fogEnabled,
    mapInfo.isWorldMap,
    mapCanvases,
    exploreRevision,
  ]);

  const toPct = (mx: number, mz: number): { leftPct: number; topPct: number } => ({
    leftPct: Math.max(3, Math.min(97, ((mx + mapRadius) / (2 * mapRadius)) * 100)),
    topPct: Math.max(3, Math.min(97, ((mz + mapRadius) / (2 * mapRadius)) * 100)),
  });

  const heroPos = toPct(heroMapX, heroMapZ);
  const headingDeg = 180 - (heroYaw * 180) / Math.PI;
  const activeRegionName = currentRegion?.name ?? currentLevel.name;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/78 p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[92vh] rounded-3xl bg-[#12151E] text-[#F3F5FA] border border-white/15 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 px-5 py-3.5 bg-[#171B26] border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#38BDF8]/15 border border-[#38BDF8]/35 text-[#38BDF8] flex items-center justify-center shrink-0">
              {mode === 'fastTravel' ? <Sparkles size={18} /> : <Compass size={18} />}
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black tracking-tight truncate">
                {mode === 'fastTravel'
                  ? currentPlinthName
                    ? `Progress Saved at ${currentPlinthName}`
                    : 'Save & Fast-Travel Map'
                  : mapInfo.isWorldMap
                  ? `${project.name} · World Map`
                  : `${currentLevel.name} · Map`}
              </h2>
              <p className="text-xs text-white/65 truncate">
                {mode === 'fastTravel'
                  ? 'Touch any Save / Spawn Point on the map or in the list to travel there.'
                  : `Currently in ${activeRegionName} · ${
                      fogEnabled ? `${exploredPct}% explored` : 'Full map revealed'
                    }`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline text-[11px] font-semibold text-white/55">
              {mode === 'worldMap' ? 'M or Esc to close' : 'Esc to stay here'}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close map"
              className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/18 text-white flex items-center justify-center transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_270px] gap-4 items-start">
          {/* Interactive Map Canvas */}
          <div className="relative w-full aspect-square max-h-[68vh] mx-auto rounded-2xl overflow-hidden border border-white/15 bg-[#0E3B59] shadow-inner select-none">
            <canvas
              ref={canvasRef}
              width={CANVAS_RES}
              height={CANVAS_RES}
              className="w-full h-full block"
            />

            {/* Save / Spawn Plinth Interactive Markers */}
            {plinths.map((plinth) => {
              const { leftPct, topPct } = toPct(plinth.mapX, plinth.mapZ);
              const isCurrent =
                plinth.levelId === currentLevel.id && plinth.entityId === currentPlinthEntityId;
              const isDiscovered = discoveredPlinthKeys.has(plinth.key);
              const canTravel = mode === 'fastTravel' && Boolean(onFastTravel);
              const isHovered = hoveredPlinthKey === plinth.key;
              return (
                <button
                  key={plinth.key}
                  type="button"
                  disabled={!canTravel}
                  onMouseEnter={() => setHoveredPlinthKey(plinth.key)}
                  onMouseLeave={() => setHoveredPlinthKey((k) => (k === plinth.key ? null : k))}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (canTravel && onFastTravel) {
                      onFastTravel(plinth);
                    }
                  }}
                  style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                  title={
                    canTravel
                      ? isCurrent
                        ? `${plinth.name} (Current Save Point)`
                        : `Touch to travel to ${plinth.name} (${plinth.levelName})`
                      : `${plinth.name} · ${plinth.levelName}`
                  }
                  className={`absolute -translate-x-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center z-10 group ${
                    canTravel ? 'cursor-pointer' : 'cursor-default'
                  }`}
                >
                  <span
                    className={`w-6 h-6 rotate-45 rounded-[5px] border-2 flex items-center justify-center shadow-lg transition-transform ${
                      isCurrent
                        ? 'bg-[#38BDF8] border-white scale-115 shadow-[#38BDF8]/60'
                        : isDiscovered
                        ? 'bg-[#0EA5E9] border-white group-hover:scale-120 shadow-[#0EA5E9]/50'
                        : 'bg-[#1E293B] border-[#38BDF8] group-hover:scale-115'
                    }`}
                  >
                    <span className="-rotate-45 block w-2 h-2 rounded-full bg-white" />
                  </span>
                  {(isHovered || isCurrent || mode === 'fastTravel') && (
                    <span className="pointer-events-none absolute top-full mt-0.5 px-2 py-0.5 rounded-md bg-[#0B0F1A]/92 border border-[#38BDF8]/40 text-[10px] font-extrabold text-white whitespace-nowrap shadow">
                      {plinth.name}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Current Player Position & Heading Marker */}
            <div
              style={{ left: `${heroPos.leftPct}%`, top: `${heroPos.topPct}%` }}
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center"
            >
              <div className="relative w-8 h-8 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-[#20B46A]/35 border border-[#4ADE80]/80" />
                <svg
                  viewBox="0 0 24 24"
                  className="w-5 h-5 drop-shadow"
                  style={{ transform: `rotate(${headingDeg}deg)` }}
                >
                  <polygon
                    points="12,2 20,20 12,15 4,20"
                    fill="#FFFFFF"
                    stroke="#15803D"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <span className="mt-0.5 px-1.5 py-0.5 rounded bg-[#15803D]/95 border border-white/40 text-[9px] font-black text-white uppercase tracking-wider whitespace-nowrap shadow">
                You
              </span>
            </div>
          </div>

          {/* Right Column: Legend, Current Location & Save / Spawn Points */}
          <div className="flex flex-col gap-3 min-w-0">
            {/* Current Position Summary */}
            <div className="rounded-2xl bg-[#181C28] border border-white/10 p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-white/60">
                <Navigation size={13} className="text-[#4ADE80]" />
                <span>Current Location</span>
              </div>
              <div className="text-sm font-black text-white truncate">{activeRegionName}</div>
              <div className="text-[11px] text-white/65 tabular-nums flex items-center justify-between">
                <span>
                  X {Math.round(heroMapX)}m · Z {Math.round(heroMapZ)}m
                </span>
                {fogEnabled && (
                  <span className="text-[#38BDF8] font-bold">{exploredPct}% Revealed</span>
                )}
              </div>
            </div>

            {/* Save / Spawn Points List */}
            <div className="rounded-2xl bg-[#181C28] border border-white/10 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#38BDF8]">
                  <MapPin size={13} />
                  <span>Save / Spawn Points</span>
                </div>
                <span className="text-[11px] font-bold text-white/55 tabular-nums">
                  {plinths.length}
                </span>
              </div>

              {plinths.length === 0 ? (
                <p className="text-xs text-white/60 leading-relaxed">
                  No Save / Spawn Plinths have been placed yet. Creators can drop a{' '}
                  <strong className="text-[#38BDF8]">Save Plinth</strong> in World Edit mode.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-0.5 maker-scroll">
                  {plinths.map((plinth) => {
                    const isCurrent =
                      plinth.levelId === currentLevel.id &&
                      plinth.entityId === currentPlinthEntityId;
                    const isDiscovered = discoveredPlinthKeys.has(plinth.key);
                    const canTravel = mode === 'fastTravel' && Boolean(onFastTravel);
                    return (
                      <button
                        key={plinth.key}
                        type="button"
                        disabled={!canTravel}
                        onMouseEnter={() => setHoveredPlinthKey(plinth.key)}
                        onMouseLeave={() =>
                          setHoveredPlinthKey((k) => (k === plinth.key ? null : k))
                        }
                        onClick={() => {
                          if (canTravel && onFastTravel) {
                            onFastTravel(plinth);
                          }
                        }}
                        className={`w-full min-h-[46px] px-3 py-2 rounded-xl border text-left flex items-center justify-between gap-2 transition-colors ${
                          isCurrent
                            ? 'bg-[#38BDF8]/18 border-[#38BDF8] text-white'
                            : canTravel
                            ? 'bg-[#12151E] hover:bg-[#1E273B] border-white/12 hover:border-[#38BDF8]/70 text-white cursor-pointer'
                            : 'bg-[#12151E] border-white/8 text-white/85 cursor-default'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold truncate">{plinth.name}</div>
                          <div className="text-[10px] text-white/60 truncate">
                            {plinth.levelName}
                            {isCurrent
                              ? ' · Current'
                              : isDiscovered
                              ? ' · Discovered'
                              : ' · Ready'}
                          </div>
                        </div>
                        {canTravel && !isCurrent && (
                          <span className="shrink-0 px-2.5 py-1 rounded-lg bg-[#0EA5E9] text-white text-[10px] font-extrabold">
                            Travel
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Map Legend */}
            <div className="rounded-2xl bg-[#181C28] border border-white/10 p-3 space-y-1.5 text-[11px] text-white/75">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rotate-45 rounded-[2px] bg-[#38BDF8] border border-white inline-block shrink-0" />
                <span>Save / Spawn Plinth</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#20B46A] border border-white inline-block shrink-0" />
                <span>Your Position &amp; Heading</span>
              </div>
              {fogEnabled && (
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-slate-500 border border-white/30 inline-block shrink-0" />
                  <span>Greyed = Untravelled Fog of War</span>
                </div>
              )}
            </div>

            {mode === 'fastTravel' && (
              <button
                type="button"
                onClick={onClose}
                className="w-full min-h-[44px] py-2.5 rounded-xl bg-white/10 hover:bg-white/16 text-xs font-extrabold text-white transition-colors"
              >
                Continue Exploring Here
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
