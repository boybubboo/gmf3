import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Eraser,
  Flower2,
  Globe,
  Hand,
  MousePointer2,
  Mountain,
  Plus,
  RotateCcw,
  Route,
  Shrub,
  Trees,
  Umbrella,
  Waves,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { MakerStore } from '../../store/useMakerStore';
import { HERO_START_ENTITY_ID } from '../../types/maker';
import {
  IslandTerrain,
  type Overview2DBrushId,
  createDefaultWaterBodies,
  createInitialTerrain,
  getEnvironmentType,
  getTerrainRadius,
  getTerrainShoreRadius,
  levelBoardToWorld,
  sampleTerrainHeight,
} from '../../utils/terrain';
import {
  WORLD_BORDER_GRAY,
  WORLD_TERRAIN_YELLOW,
  type WorldMapSample,
  computeRegionBounds,
  computeRegionCentroids,
  getWorldMapRadius,
  sampleWorldMapAtWorld,
  sampleWorldMapInto,
} from '../../utils/worldMap';
import { MAKER_ASSET_DRAG_MIME } from './LeftAssetsPanel';

type Painter2DTool = Overview2DBrushId | 'inspect';

interface BrushMeta {
  id: Painter2DTool;
  label: string;
  accent: string;
  Icon: React.FC<{ size?: number; className?: string }>;
}

const PAINTER_2D_TOOLS: BrushMeta[] = [
  { id: 'inspect', label: 'Select', accent: '#7C5CFF', Icon: MousePointer2 },
  { id: 'terrain', label: 'Terrain', accent: WORLD_TERRAIN_YELLOW, Icon: Globe },
  { id: 'coniferWoods', label: 'Conifers', accent: '#1F5C36', Icon: Trees },
  { id: 'deciduousWoods', label: 'Deciduous', accent: '#4EA343', Icon: Trees },
  { id: 'bushes', label: 'Bushes', accent: '#20B46A', Icon: Shrub },
  { id: 'wildflowers', label: 'Flowers', accent: '#EC4899', Icon: Flower2 },
  { id: 'rocks', label: 'Rocks', accent: '#64748B', Icon: Mountain },
  { id: 'hills', label: 'Hills', accent: '#F59E0B', Icon: Mountain },
  { id: 'beaches', label: 'Beach', accent: '#D6B66A', Icon: Umbrella },
  { id: 'lakes', label: 'Lake', accent: '#0EA5E9', Icon: Waves },
  { id: 'rivers', label: 'Creek', accent: '#2A9D8F', Icon: Waves },
  { id: 'caves', label: 'Cave', accent: '#A855F7', Icon: Mountain },
  { id: 'roads', label: 'Trail', accent: '#C2854E', Icon: Route },
  { id: 'erase', label: 'Erase', accent: '#F2545B', Icon: Eraser },
];

const LAYER_COLORS = [
  '#4EA343', // 0 grass
  '#E5C67E', // 1 sand
  '#7D828F', // 2 rock
  '#E2E8F0', // 3 snow
  '#5D7B3B', // 4 moss
  '#8C939E', // 5 cobble
  '#9C6F44', // 6 dirt
];

function hexToRgbBytes(hex: string, fallback: [number, number, number] = [229, 198, 126]): [number, number, number] {
  const clean = hex.replace('#', '');
  const norm =
    clean.length === 3
      ? clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2]
      : clean;
  const num = parseInt(norm, 16);
  if (Number.isNaN(num)) return fallback;
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

const LAYER_RGB: [number, number, number][] = LAYER_COLORS.map((c) => hexToRgbBytes(c, [78, 163, 67]));
const GRAY_NEIGHBOR_RGB = hexToRgbBytes(WORLD_BORDER_GRAY, [110, 117, 130]);
const OCEAN_TILE_RGB: [number, number, number] = [27, 107, 147];
const SNOW_TILE_RGB: [number, number, number] = [226, 232, 240];
const ROCK_TILE_RGB: [number, number, number] = [118, 125, 137];
const WORLD_YELLOW_RGB = hexToRgbBytes(WORLD_TERRAIN_YELLOW, [229, 198, 126]);

interface OffscreenRasterCache {
  key: string;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D | null;
  img: ImageData | null;
}

export interface Overview2DPainterProps {
  store: MakerStore;
  activePlacementAssetId: string | null;
  isPlacingHero?: boolean;
  onPlacedHeroFrom2D?: () => void;
  onPlaceCustomAssetAtWorldPoint: (assetId: string, worldX: number, worldZ: number) => void;
  onSelectEntityFrom2D: (entityId: string) => void;
}

export const Overview2DPainter: React.FC<Overview2DPainterProps> = ({
  store,
  activePlacementAssetId,
  isPlacingHero = false,
  onPlacedHeroFrom2D,
  onPlaceCustomAssetAtWorldPoint,
  onSelectEntityFrom2D,
}) => {
  const { currentLevel } = store;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [tool, setTool] = useState<Painter2DTool>('terrain');
  const [worldMapSelectMode, setWorldMapSelectMode] = useState(false);
  const [brushRadius, setBrushRadius] = useState<number>(11);
  const [density, setDensity] = useState<number>(0.65);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<[number, number]>([0, 0]);
  const [hoverWorld, setHoverWorld] = useState<[number, number] | null>(null);
  const [shiftHeld, setShiftHeld] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [viewportSize, setViewportSize] = useState<[number, number]>([640, 420]);

  const paintingRef = useRef(false);
  const draggingInspectIdRef = useRef<string | null>(null);
  const panningRef = useRef<{ startX: number; startY: number; origPan: [number, number] } | null>(
    null
  );
  const lastStrokeMsRef = useRef(0);
  const lastLandClickRef = useRef<{ code: number; time: number } | null>(null);

  const isWorldMapMode = store.worldEditorScope === 'worldMap';
  const worldMap = store.resolvedWorldMap;
  const activeRegionCode = store.activeWorldRegionCode;
  const activeRegionOrigin = store.activeWorldRegionOrigin;
  const worldMapRadius = getWorldMapRadius(worldMap);
  const terrain = useMemo(
    () => currentLevel?.terrain ?? createInitialTerrain(),
    [currentLevel?.terrain]
  );
  const landTerrainRadius = getTerrainRadius(terrain);
  const landShoreRadius = getTerrainShoreRadius(terrain);
  const viewShoreRadius = isWorldMapMode ? worldMapRadius * 1.05 : landShoreRadius;
  const activeBrushRadius = isWorldMapMode ? store.worldMapBrushRadius : brushRadius;
  const setActiveBrushRadius = isWorldMapMode ? store.setWorldMapBrushRadius : setBrushRadius;
  const worldMapCacheRef = useRef<OffscreenRasterCache | null>(null);
  const landTerrainCacheRef = useRef<OffscreenRasterCache | null>(null);
  const regionCentroids = useMemo(
    () => (worldMap ? computeRegionCentroids(worldMap) : null),
    [worldMap]
  );
  const isFreeform = Boolean(terrain.freeformWorld || worldMap || isWorldMapMode);

  const computeLandFit = useCallback((): { zoom: number; pan: [number, number] } => {
    if (isWorldMapMode) {
      return { zoom: 1, pan: [0, 0] };
    }

    const container = containerRef.current;
    const w = Math.max(240, container?.clientWidth || viewportSize[0]);
    const h = Math.max(200, container?.clientHeight || viewportSize[1]);

    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    if (worldMap && activeRegionCode && activeRegionCode > 0) {
      const bounds = computeRegionBounds(worldMap, activeRegionCode);
      if (bounds && bounds.cellCount > 0) {
        const ox = activeRegionOrigin?.[0] ?? 0;
        const oz = activeRegionOrigin?.[1] ?? 0;
        minX = Math.max(-landTerrainRadius, bounds.minX - ox);
        maxX = Math.min(landTerrainRadius, bounds.maxX - ox);
        minZ = Math.max(-landTerrainRadius, bounds.minZ - oz);
        maxZ = Math.min(landTerrainRadius, bounds.maxZ - oz);
      }
    }

    if (!Number.isFinite(minX) || maxX <= minX || maxZ <= minZ) {
      const size = terrain.size;
      const width = size + 1;
      const step = (2 * landTerrainRadius) / size;
      const seaCutoff = IslandTerrain.waterLevel - 0.15;
      for (let row = 0; row <= size; row++) {
        const vz = -landTerrainRadius + row * step;
        const rowOff = row * width;
        for (let col = 0; col <= size; col++) {
          if (terrain.heights[rowOff + col] <= seaCutoff) continue;
          const vx = -landTerrainRadius + col * step;
          if (vx < minX) minX = vx;
          if (vx > maxX) maxX = vx;
          if (vz < minZ) minZ = vz;
          if (vz > maxZ) maxZ = vz;
        }
      }
    }

    if (!Number.isFinite(minX) || maxX <= minX || maxZ <= minZ) {
      return { zoom: 1, pan: [0, 0] };
    }

    const localCx = (minX + maxX) * 0.5;
    const localCz = (minZ + maxZ) * 0.5;
    const spanX = Math.max(24, maxX - minX);
    const spanZ = Math.max(24, maxZ - minZ);
    const baseScale = (Math.min(w, h) * 0.45) / viewShoreRadius;
    const targetScale = Math.min((w * 0.84) / spanX, (h * 0.84) / spanZ);
    const fitZoom = Math.max(0.95, Math.min(6, targetScale / Math.max(0.001, baseScale)));
    const halfSpanFit = Math.min(w, h) * 0.45 * fitZoom;
    const panX = -(localCx / viewShoreRadius) * halfSpanFit;
    const panY = -(localCz / viewShoreRadius) * halfSpanFit;
    return { zoom: fitZoom, pan: [panX, panY] };
  }, [
    activeRegionCode,
    activeRegionOrigin,
    isWorldMapMode,
    landTerrainRadius,
    terrain.heights,
    terrain.size,
    viewShoreRadius,
    viewportSize,
    worldMap,
  ]);

  const activeOriginX = activeRegionOrigin?.[0] ?? 0;
  const activeOriginZ = activeRegionOrigin?.[1] ?? 0;
  useEffect(() => {
    const fitted = computeLandFit();
    setZoom(fitted.zoom);
    setPan(fitted.pan);
    // Re-fit only when switching between World Map and Lands or changing active Land / origin
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWorldMapMode, currentLevel?.id, activeRegionCode, activeOriginX, activeOriginZ]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const syncSize = () => {
      const nextW = Math.max(240, el.clientWidth);
      const nextH = Math.max(200, el.clientHeight);
      setViewportSize((prev) => (prev[0] === nextW && prev[1] === nextH ? prev : [nextW, nextH]));
    };
    syncSize();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', syncSize);
      return () => window.removeEventListener('resize', syncSize);
    }
    const ro = new ResizeObserver(syncSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const syncShift = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        e.type === 'keydown' &&
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
      ) {
        return;
      }
      if (e.key === 'Shift' || e.shiftKey) {
        setShiftHeld(e.shiftKey);
      } else {
        setShiftHeld(false);
      }
    };
    const onBlur = () => {
      setShiftHeld(false);
      setIsPanning(false);
      panningRef.current = null;
      paintingRef.current = false;
    };
    window.addEventListener('keydown', syncShift);
    window.addEventListener('keyup', syncShift);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', syncShift);
      window.removeEventListener('keyup', syncShift);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  const screenToWorld = useCallback(
    (clientX: number, clientY: number): [number, number] => {
      const canvas = canvasRef.current;
      if (!canvas) return [0, 0];
      const rect = canvas.getBoundingClientRect();
      const cx = rect.width * 0.5 + pan[0];
      const cy = rect.height * 0.5 + pan[1];
      const halfSpan = (Math.min(rect.width, rect.height) * 0.45) * zoom;
      const wx = ((clientX - rect.left - cx) / Math.max(1, halfSpan)) * viewShoreRadius;
      const wz = ((clientY - rect.top - cy) / Math.max(1, halfSpan)) * viewShoreRadius;
      return [wx, wz];
    },
    [pan, viewShoreRadius, zoom]
  );

  // Render interactive top-down world map canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !currentLevel) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(240, container.clientWidth || viewportSize[0]);
    const h = Math.max(200, container.clientHeight || viewportSize[1]);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Deep ocean backdrop
    ctx.fillStyle = '#0D2438';
    ctx.fillRect(0, 0, w, h);

    const cx = w * 0.5 + pan[0];
    const cy = h * 0.5 + pan[1];
    const halfSpan = Math.min(w, h) * 0.45 * zoom;
    const toPx = (wx: number, wz: number): [number, number] => [
      cx + (wx / viewShoreRadius) * halfSpan,
      cy + (wz / viewShoreRadius) * halfSpan,
    ];
    const scaleM = halfSpan / viewShoreRadius;

    if (!isFreeform) {
      // Classic circular ocean ripple rings & island base shadow
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
      ctx.lineWidth = 1.5;
      for (const rMul of [1.02, 1.12, 1.24]) {
        ctx.beginPath();
        ctx.arc(cx, cy, IslandTerrain.shoreRadius * scaleM * rMul, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = '#18364A';
      ctx.beginPath();
      ctx.arc(cx, cy, IslandTerrain.shoreRadius * scaleM, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Subtle navigable world grid over open ocean
      const gridExtent = isWorldMapMode ? worldMapRadius : landTerrainRadius;
      const gridStep = isWorldMapMode
        ? 80
        : landTerrainRadius > 320
        ? 60
        : landTerrainRadius > 200
        ? 40
        : 20;
      const worldHalfPx = gridExtent * scaleM;
      ctx.save();
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.08)';
      ctx.lineWidth = 1;
      for (let g = -gridExtent; g <= gridExtent; g += gridStep) {
        const [gx] = toPx(g, 0);
        const [, gy] = toPx(0, g);
        ctx.beginPath();
        ctx.moveTo(gx, cy - worldHalfPx);
        ctx.lineTo(gx, cy + worldHalfPx);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - worldHalfPx, gy);
        ctx.lineTo(cx + worldHalfPx, gy);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.22)';
      ctx.setLineDash([6, 6]);
      ctx.strokeRect(cx - worldHalfPx, cy - worldHalfPx, worldHalfPx * 2, worldHalfPx * 2);
      ctx.setLineDash([]);
      ctx.restore();
    }

    if (isWorldMapMode && worldMap) {
      const size = worldMap.gridSize;
      const width = size + 1;
      const paletteSig = worldMap.regions.map((r) => `${r.code}:${r.colorHex}`).join('|');
      const cacheKey = `${worldMap.revision}:${size}:${paletteSig}`;
      let cacheEntry = worldMapCacheRef.current;

      if (!cacheEntry || cacheEntry.key !== cacheKey || cacheEntry.canvas.width !== size) {
        const offCanvas =
          cacheEntry && cacheEntry.canvas.width === size
            ? cacheEntry.canvas
            : document.createElement('canvas');
        if (offCanvas.width !== size) offCanvas.width = size;
        if (offCanvas.height !== size) offCanvas.height = size;
        const offCtx =
          cacheEntry && cacheEntry.canvas === offCanvas
            ? cacheEntry.ctx
            : offCanvas.getContext('2d');
        if (offCtx) {
          const regionRgbMap = new Map<number, [number, number, number]>();
          for (const r of worldMap.regions) {
            regionRgbMap.set(r.code, hexToRgbBytes(r.colorHex, WORLD_YELLOW_RGB));
          }

          const img =
            cacheEntry?.img &&
            cacheEntry.img.width === size &&
            cacheEntry.img.height === size
              ? cacheEntry.img
              : offCtx.createImageData(size, size);
          const data = img.data;
          data.fill(0);
          const landMask = worldMap.landMask;
          const regionGrid = worldMap.regionGrid;
          for (let row = 0; row < size; row++) {
            const rowOff = row * width;
            const pRowOff = row * size;
            for (let col = 0; col < size; col++) {
              const idx = rowOff + col;
              const pOff = (pRowOff + col) * 4;
              const hasLand = landMask[idx] === 1;
              if (!hasLand) {
                const nearLand =
                  (row > 0 && landMask[idx - width] === 1) ||
                  (row < size && landMask[idx + width] === 1) ||
                  (col > 0 && landMask[idx - 1] === 1) ||
                  (col < size && landMask[idx + 1] === 1);
                if (nearLand) {
                  data[pOff] = 20;
                  data[pOff + 1] = 75;
                  data[pOff + 2] = 110;
                  data[pOff + 3] = 255;
                }
                continue;
              }
              const code = regionGrid[idx] ?? 0;
              const rgb = (code > 0 ? regionRgbMap.get(code) : undefined) ?? WORLD_YELLOW_RGB;
              const isEdge =
                row === 0 ||
                row >= size - 1 ||
                col === 0 ||
                col >= size - 1 ||
                landMask[idx - width] === 0 ||
                landMask[idx + width] === 0 ||
                landMask[idx - 1] === 0 ||
                landMask[idx + 1] === 0 ||
                regionGrid[idx - width] !== code ||
                regionGrid[idx + width] !== code ||
                regionGrid[idx - 1] !== code ||
                regionGrid[idx + 1] !== code;
              const shade = isEdge ? 0.68 : 1;
              data[pOff] = Math.round(rgb[0] * shade);
              data[pOff + 1] = Math.round(rgb[1] * shade);
              data[pOff + 2] = Math.round(rgb[2] * shade);
              data[pOff + 3] = 255;
            }
          }
          offCtx.putImageData(img, 0, 0);
          cacheEntry = { key: cacheKey, canvas: offCanvas, ctx: offCtx, img };
        } else {
          cacheEntry = { key: cacheKey, canvas: offCanvas, ctx: null, img: null };
        }
        worldMapCacheRef.current = cacheEntry;
      }

      const [leftPx, topPx] = toPx(-worldMapRadius, -worldMapRadius);
      const [rightPx, bottomPx] = toPx(worldMapRadius, worldMapRadius);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(cacheEntry.canvas, leftPx, topPx, rightPx - leftPx, bottomPx - topPx);
      ctx.restore();

      // Region labels (no dashed footprint boxes over painted Lands)
      const centroids = regionCentroids;
      ctx.save();
      ctx.font = '800 12px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const region of worldMap.regions) {
        const c = centroids?.get(region.code);
        if (!c || c.cellCount === 0) continue;
        const [lx, ly] = toPx(c.x, c.z);
        const text = region.name || `Land ${region.code}`;
        const metrics = ctx.measureText(text);
        const pillW = Math.max(48, metrics.width + 18);
        const pillH = 22;
        const selected = store.selectedWorldLandCode === region.code;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
        ctx.beginPath();
        ctx.roundRect(lx - pillW * 0.5, ly - pillH * 0.5, pillW, pillH, 8);
        ctx.fill();
        ctx.strokeStyle = selected ? '#FFFFFF' : region.colorHex;
        ctx.lineWidth = selected ? 2.2 : 1.5;
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(text, lx, ly + 0.5);
      }
      ctx.restore();

      // Hover brush ring in World Map mode
      if (hoverWorld && !worldMapSelectMode && !shiftHeld && !isPanning) {
        const [px, py] = toPx(hoverWorld[0], hoverWorld[1]);
        const activeRegion = worldMap.regions.find((r) => r.code === store.selectedWorldLandCode);
        const ringColor =
          store.worldMapBrushMode === 'terrain'
            ? WORLD_TERRAIN_YELLOW
            : store.worldMapBrushMode === 'eraseTerrain'
            ? '#F2545B'
            : store.worldMapBrushMode === 'clearLand'
            ? '#94A3B8'
            : activeRegion?.colorHex ?? '#20B46A';
        ctx.strokeStyle = ringColor;
        ctx.lineWidth = 2.2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(px, py, Math.max(6, activeBrushRadius * scaleM), 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();
      return;
    }

    // LAND EDIT MODE: Cache offscreen terrain raster + turn bordering/other lands gray
    const size = terrain.size;
    const width = size + 1;
    const stepM = (2 * landTerrainRadius) / size;
    const originX = activeRegionOrigin?.[0] ?? 0;
    const originZ = activeRegionOrigin?.[1] ?? 0;
    const checkNeighborLands = Boolean(worldMap && activeRegionCode && activeRegionCode > 0);
    const snowStartHeight = terrain.mountainConfig?.snowStartHeight ?? 10.5;
    const rockStartHeight = terrain.mountainConfig?.rockStartHeight ?? 5.5;
    const landCacheKey = `${currentLevel.id}:${terrain.revision}:${worldMap?.revision ?? 0}:${activeRegionCode ?? 0}:${originX}:${originZ}:${landTerrainRadius}:${isFreeform ? 1 : 0}:${snowStartHeight}:${rockStartHeight}:${size}`;

    let landCache = landTerrainCacheRef.current;
    if (!landCache || landCache.key !== landCacheKey || landCache.canvas.width !== size) {
      const offCanvas =
        landCache && landCache.canvas.width === size
          ? landCache.canvas
          : document.createElement('canvas');
      if (offCanvas.width !== size) offCanvas.width = size;
      if (offCanvas.height !== size) offCanvas.height = size;
      const offCtx =
        landCache && landCache.canvas === offCanvas
          ? landCache.ctx
          : offCanvas.getContext('2d');
      if (offCtx) {
        const img =
          landCache?.img && landCache.img.width === size && landCache.img.height === size
            ? landCache.img
            : offCtx.createImageData(size, size);
        const data = img.data;
        data.fill(0);
        const wmSample: WorldMapSample = { land: 0, regionCode: 0, isBorder: false };
        const shoreMax = landShoreRadius * 0.99;
        const shoreMaxSq = shoreMax * shoreMax;
        const heights = terrain.heights;
        const layers = terrain.layers;

        for (let row = 0; row < size; row++) {
          const vz = -landTerrainRadius + (row + 0.5) * stepM;
          const rowOff = row * width;
          const pRowOff = row * size;
          const vzSq = vz * vz;
          for (let col = 0; col < size; col++) {
            const vx = -landTerrainRadius + (col + 0.5) * stepM;
            if (!isFreeform && vx * vx + vzSq > shoreMaxSq) continue;
            const idx = rowOff + col;
            const pOff = (pRowOff + col) * 4;

            if (checkNeighborLands && worldMap) {
              sampleWorldMapInto(worldMap, originX + vx, originZ + vz, wmSample);
            }
            const isGrayNeighbor =
              checkNeighborLands && wmSample.land === 1 && wmSample.regionCode !== activeRegionCode;

            const height = heights[idx];
            const layer = layers[idx] ?? 0;

            let rByte: number;
            let gByte: number;
            let bByte: number;

            if (isGrayNeighbor) {
              rByte = GRAY_NEIGHBOR_RGB[0];
              gByte = GRAY_NEIGHBOR_RGB[1];
              bByte = GRAY_NEIGHBOR_RGB[2];
              if (wmSample.isBorder) {
                rByte = Math.round(rByte * 0.72 + 15 * 0.28);
                gByte = Math.round(gByte * 0.72 + 23 * 0.28);
                bByte = Math.round(bByte * 0.72 + 42 * 0.28);
              }
            } else {
              let rgb: [number, number, number];
              if (height <= IslandTerrain.waterLevel - 0.15) {
                if (isFreeform) continue;
                rgb = OCEAN_TILE_RGB;
              } else if (height > snowStartHeight) {
                rgb = SNOW_TILE_RGB;
              } else if (height > rockStartHeight && layer === 0) {
                rgb = ROCK_TILE_RGB;
              } else {
                rgb = LAYER_RGB[layer] ?? LAYER_RGB[0];
              }
              rByte = rgb[0];
              gByte = rgb[1];
              bByte = rgb[2];
              if (height > 2.2 && height > IslandTerrain.waterLevel) {
                const shadeAlpha = Math.min(0.32, (height - 2.2) * 0.025);
                const inv = 1 - shadeAlpha;
                rByte = Math.round(rByte * inv + 255 * shadeAlpha);
                gByte = Math.round(gByte * inv + 255 * shadeAlpha);
                bByte = Math.round(bByte * inv + 255 * shadeAlpha);
              }
            }

            data[pOff] = rByte;
            data[pOff + 1] = gByte;
            data[pOff + 2] = bByte;
            data[pOff + 3] = 255;
          }
        }
        offCtx.putImageData(img, 0, 0);
        landCache = { key: landCacheKey, canvas: offCanvas, ctx: offCtx, img };
      } else {
        landCache = { key: landCacheKey, canvas: offCanvas, ctx: null, img: null };
      }
      landTerrainCacheRef.current = landCache;
    }

    const [landLeftPx, landTopPx] = toPx(-landTerrainRadius, -landTerrainRadius);
    const [landRightPx, landBottomPx] = toPx(landTerrainRadius, landTerrainRadius);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      landCache.canvas,
      landLeftPx,
      landTopPx,
      landRightPx - landLeftPx,
      landBottomPx - landTopPx
    );
    ctx.restore();

    // Dimmed labels on neighboring gray lands visible inside this Land's window
    if (worldMap && activeRegionCode && regionCentroids) {
      ctx.save();
      ctx.font = '700 11px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const region of worldMap.regions) {
        if (region.code === activeRegionCode) continue;
        const c = regionCentroids.get(region.code);
        if (!c || c.cellCount === 0) continue;
        const localX = c.x - originX;
        const localZ = c.z - originZ;
        if (
          Math.abs(localX) > landShoreRadius * 1.15 ||
          Math.abs(localZ) > landShoreRadius * 1.15
        ) {
          continue;
        }
        const [lx, ly] = toPx(localX, localZ);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
        ctx.fillText(region.name, lx + 1, ly + 1);
        ctx.fillStyle = 'rgba(226, 232, 240, 0.65)';
        ctx.fillText(region.name, lx, ly);
      }
      ctx.restore();
    }

    // Water bodies overlay
    const waterBodies = terrain.waterBodies ?? createDefaultWaterBodies();
    for (const wb of waterBodies) {
      const selected = store.selectedWaterBodyId === wb.id;
      ctx.save();
      ctx.fillStyle = wb.waterColor || '#2E86AB';
      ctx.globalAlpha = 0.72;
      ctx.strokeStyle = selected ? '#FFFFFF' : 'rgba(186,230,253,0.75)';
      ctx.lineWidth = selected ? 2.5 : 1.2;

      if (wb.points && wb.points.length >= 2) {
        ctx.beginPath();
        wb.points.forEach((pt, idx) => {
          const [px, py] = toPx(pt[0], pt[1]);
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = wb.waterColor || '#2E86AB';
        ctx.lineWidth = Math.max(3, wb.width * scaleM);
        ctx.stroke();
      } else {
        const [px, py] = toPx(wb.center[0], wb.center[1]);
        ctx.beginPath();
        ctx.ellipse(
          px,
          py,
          Math.max(4, wb.radiusX * scaleM),
          Math.max(4, wb.radiusZ * scaleM),
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    // Roads / Trails overlay
    for (const road of terrain.roads ?? []) {
      if (road.points.length < 2) continue;
      const selected = store.selectedRoadId === road.id;
      ctx.save();
      ctx.beginPath();
      road.points.forEach((pt, idx) => {
        const [px, py] = toPx(pt[0], pt[1]);
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.strokeStyle = selected ? '#FBBF24' : '#B87C4C';
      ctx.lineWidth = Math.max(2.5, road.width * scaleM);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();
    }

    // Scatter foliage/rock dots
    for (const item of terrain.scatter) {
      if (worldMap && activeRegionCode) {
        const wmS = sampleWorldMapAtWorld(worldMap, originX + item.x, originZ + item.z);
        if (wmS.land === 1 && wmS.regionCode !== activeRegionCode) continue;
      }
      const [px, py] = toPx(item.x, item.z);
      if (item.kind === 'pine') {
        ctx.fillStyle = '#154D2B';
        ctx.beginPath();
        ctx.arc(px, py, Math.max(1.8, 1.5 * scaleM), 0, Math.PI * 2);
        ctx.fill();
      } else if (item.kind === 'oak' || item.kind === 'birch' || item.kind === 'tree') {
        ctx.fillStyle = item.kind === 'birch' ? '#85CC4E' : '#2D7A36';
        ctx.beginPath();
        ctx.arc(px, py, Math.max(2.0, 1.7 * scaleM), 0, Math.PI * 2);
        ctx.fill();
      } else if (item.kind === 'bush' || item.kind === 'berryBush') {
        ctx.fillStyle = '#38A169';
        ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
      } else if (item.kind === 'flower') {
        ctx.fillStyle = '#F472B6';
        ctx.fillRect(px - 1, py - 1, 2, 2);
      } else if (item.kind === 'rock') {
        ctx.fillStyle = '#94A3B8';
        ctx.fillRect(px - 1.8, py - 1.8, 3.6, 3.6);
      } else if (item.kind === 'custom') {
        ctx.fillStyle = '#A855F7';
        ctx.beginPath();
        ctx.arc(px, py, 2.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Caves
    for (const cave of terrain.caves ?? []) {
      const [px, py] = toPx(cave.x, cave.z);
      const selected = store.selectedCaveId === cave.id;
      ctx.fillStyle = '#1F1B2E';
      ctx.strokeStyle = selected ? '#FFFFFF' : '#A855F7';
      ctx.lineWidth = selected ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.arc(px, py, Math.max(5, 4.2 * (cave.scale ?? 1) * scaleM), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Placed Entities
    for (const ent of currentLevel.entities) {
      const [wx, wz] = levelBoardToWorld(currentLevel, ent.position);
      const [px, py] = toPx(wx, wz);
      const isSelected = store.selectedEntityID === ent.id;
      ctx.fillStyle =
        ent.kind === 'baddie'
          ? '#F2545B'
          : ent.kind === 'npc'
          ? ent.isBuddy
            ? '#20B46A'
            : '#7C5CFF'
          : ent.buildingBlock || ent.kind === 'door'
          ? '#F59E0B'
          : '#38BDF8';
      ctx.beginPath();
      ctx.arc(px, py, isSelected ? 5.5 : 3.8, 0, Math.PI * 2);
      ctx.fill();
      if (isSelected) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Hero Start marker
    if (currentLevel.hasStart) {
      const env = getEnvironmentType(currentLevel);
      const startBp =
        store.playFromPoint ??
        currentLevel.startPoint ??
        (env === 'sideScroller' ? { x: 0.1, y: 0.5 } : { x: 0.14, y: 0.8 });
      const [hx, hz] = levelBoardToWorld(currentLevel, startBp);
      const [px, py] = toPx(hx, hz);
      const isHeroSelected = store.selectedEntityID === HERO_START_ENTITY_ID;
      ctx.save();
      ctx.fillStyle = '#7C5CFF';
      ctx.beginPath();
      ctx.arc(px, py, isHeroSelected ? 8 : 6.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isHeroSelected ? '#FBBF24' : '#FFFFFF';
      ctx.lineWidth = isHeroSelected ? 2.5 : 1.8;
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('H', px, py + 0.5);
      ctx.restore();
    }

    // Hover brush ring
    if (hoverWorld && (tool !== 'inspect' || isPlacingHero) && !shiftHeld && !isPanning) {
      const [px, py] = toPx(hoverWorld[0], hoverWorld[1]);
      const activeMeta = PAINTER_2D_TOOLS.find((t) => t.id === tool);
      ctx.strokeStyle = isPlacingHero
        ? '#7C5CFF'
        : activePlacementAssetId
        ? '#20B46A'
        : activeMeta?.accent ?? '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(
        px,
        py,
        isPlacingHero || activePlacementAssetId ? 10 : Math.max(6, brushRadius * scaleM),
        0,
        Math.PI * 2
      );
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }, [
    currentLevel,
    terrain,
    worldMap,
    regionCentroids,
    isWorldMapMode,
    isFreeform,
    activeRegionCode,
    activeRegionOrigin,
    worldMapRadius,
    viewShoreRadius,
    worldMapSelectMode,
    zoom,
    pan,
    hoverWorld,
    tool,
    brushRadius,
    activeBrushRadius,
    activePlacementAssetId,
    isPlacingHero,
    shiftHeld,
    isPanning,
    store.playFromPoint,
    store.selectedEntityID,
    store.selectedWaterBodyId,
    store.selectedCaveId,
    store.selectedRoadId,
    store.selectedWorldLandCode,
    store.worldMapBrushMode,
    viewportSize,
  ]);

  const applyStrokeAtPoint = useCallback(
    (wx: number, wz: number, isStart: boolean) => {
      if (isWorldMapMode) {
        if (worldMapSelectMode) {
          if (!isStart || !worldMap) return;
          const res = sampleWorldMapAtWorld(worldMap, wx, wz);
          if (res.land === 1 && res.regionCode > 0) {
            const now = performance.now();
            const prev = lastLandClickRef.current;
            store.setSelectedWorldLandCode(res.regionCode);
            if (prev && prev.code === res.regionCode && now - prev.time < 360) {
              const targetRegion = worldMap.regions.find((r) => r.code === res.regionCode);
              if (targetRegion) {
                store.enterWorldEditorScope(targetRegion.levelId);
              }
              lastLandClickRef.current = null;
            } else {
              lastLandClickRef.current = { code: res.regionCode, time: now };
            }
          } else {
            store.setSelectedWorldLandCode(null);
            lastLandClickRef.current = null;
          }
          return;
        }
        const now = performance.now();
        if (!isStart && now - lastStrokeMsRef.current < 45) return;
        lastStrokeMsRef.current = now;
        store.applyWorldMapBrushStroke(
          store.worldMapBrushMode,
          wx,
          wz,
          activeBrushRadius,
          isStart,
          isStart
        );
        return;
      }

      if (isPlacingHero && currentLevel) {
        if (isStart) {
          const bp = store.placeWorldPointBoardHelper(wx, wz);
          store.moveEntity(HERO_START_ENTITY_ID, bp, true);
          store.setSelectedEntityID(HERO_START_ENTITY_ID);
          onPlacedHeroFrom2D?.();
        }
        return;
      }

      if (activePlacementAssetId) {
        if (isStart) {
          onPlaceCustomAssetAtWorldPoint(activePlacementAssetId, wx, wz);
        }
        return;
      }

      if (tool === 'inspect' && currentLevel) {
        if (!isStart) {
          if (draggingInspectIdRef.current) {
            const bp = store.placeWorldPointBoardHelper(wx, wz);
            store.moveEntity(draggingInspectIdRef.current, bp, false);
          }
          return;
        }
        // Pick closest Hero, entity, cave, or water body near click
        let bestDist = 10;
        let hitEntityId: string | null = null;
        if (currentLevel.hasStart) {
          const env = getEnvironmentType(currentLevel);
          const heroBp =
            store.playFromPoint ??
            currentLevel.startPoint ??
            (env === 'sideScroller' ? { x: 0.1, y: 0.5 } : { x: 0.14, y: 0.8 });
          const [hx, hz] = levelBoardToWorld(currentLevel, heroBp);
          const hd = Math.hypot(hx - wx, hz - wz);
          if (hd < bestDist) {
            bestDist = hd;
            hitEntityId = HERO_START_ENTITY_ID;
          }
        }
        for (const ent of currentLevel.entities) {
          const [ex, ez] = levelBoardToWorld(currentLevel, ent.position);
          const d = Math.hypot(ex - wx, ez - wz);
          if (d < bestDist) {
            bestDist = d;
            hitEntityId = ent.id;
          }
        }
        if (hitEntityId) {
          draggingInspectIdRef.current = hitEntityId;
          onSelectEntityFrom2D(hitEntityId);
          return;
        }
        for (const cave of terrain.caves ?? []) {
          if (Math.hypot(cave.x - wx, cave.z - wz) < 12) {
            store.setSelectedCaveId(cave.id);
            store.setActiveWorldDomain('caves');
            return;
          }
        }
        for (const wb of terrain.waterBodies ?? []) {
          if (Math.hypot(wb.center[0] - wx, wb.center[1] - wz) < Math.max(wb.radiusX, 12)) {
            store.setSelectedWaterBodyId(wb.id);
            store.setActiveWorldDomain('water');
            return;
          }
        }
        return;
      }

      if (tool === 'inspect') return;
      const now = performance.now();
      if (!isStart && now - lastStrokeMsRef.current < 65) return;
      lastStrokeMsRef.current = now;
      store.apply2DOverviewStroke(tool, wx, wz, activeBrushRadius, density, isStart, isStart);
    },
    [
      activeBrushRadius,
      activePlacementAssetId,
      currentLevel,
      density,
      isPlacingHero,
      isWorldMapMode,
      onPlaceCustomAssetAtWorldPoint,
      onPlacedHeroFrom2D,
      onSelectEntityFrom2D,
      store,
      terrain.caves,
      terrain.waterBodies,
      tool,
      worldMap,
      worldMapSelectMode,
    ]
  );

  if (!currentLevel) return null;

  const zoomPercent = Math.round(zoom * 100);
  const maxZoom = 6;

  return (
    <div className="w-full h-full flex flex-col bg-[#0D2438] select-none overflow-hidden">
      {/* Upper Workspace: Unobstructed Map Canvas + Outside Side Rail */}
      <div className="flex-1 min-h-0 flex">
        {/* Pure Map Canvas Area (zero overlays on top of the map) */}
        <div
          ref={containerRef}
          className="flex-1 min-w-0 min-h-0 relative bg-[#0D2438] overflow-hidden"
          onDragOver={(e) => {
            if (!isWorldMapMode && e.dataTransfer.types.includes(MAKER_ASSET_DRAG_MIME)) {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }
          }}
          onDrop={(e) => {
            if (isWorldMapMode) return;
            const assetId = e.dataTransfer.getData(MAKER_ASSET_DRAG_MIME);
            if (!assetId) return;
            e.preventDefault();
            const [wx, wz] = screenToWorld(e.clientX, e.clientY);
            onPlaceCustomAssetAtWorldPoint(assetId, wx, wz);
          }}
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full block touch-none"
            style={{
              cursor: isPanning
                ? 'grabbing'
                : shiftHeld
                ? 'grab'
                : (isWorldMapMode ? worldMapSelectMode : tool === 'inspect')
                ? 'default'
                : 'crosshair',
            }}
            onPointerDown={(e) => {
              setShiftHeld(e.shiftKey);
              if (e.button === 1 || e.button === 2 || e.shiftKey) {
                panningRef.current = {
                  startX: e.clientX,
                  startY: e.clientY,
                  origPan: [...pan] as [number, number],
                };
                setIsPanning(true);
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {
                  // ignore pointer capture fallback
                }
                return;
              }
              paintingRef.current = true;
              const [wx, wz] = screenToWorld(e.clientX, e.clientY);
              setHoverWorld([wx, wz]);
              applyStrokeAtPoint(wx, wz, true);
            }}
            onPointerMove={(e) => {
              if (e.shiftKey !== shiftHeld) {
                setShiftHeld(e.shiftKey);
              }
              if (panningRef.current) {
                const dx = e.clientX - panningRef.current.startX;
                const dy = e.clientY - panningRef.current.startY;
                setPan([panningRef.current.origPan[0] + dx, panningRef.current.origPan[1] + dy]);
                return;
              }
              const [wx, wz] = screenToWorld(e.clientX, e.clientY);
              setHoverWorld([wx, wz]);
              if (paintingRef.current) {
                applyStrokeAtPoint(wx, wz, false);
              }
            }}
            onPointerUp={(e) => {
              paintingRef.current = false;
              draggingInspectIdRef.current = null;
              panningRef.current = null;
              setIsPanning(false);
              setShiftHeld(e.shiftKey);
              try {
                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }
              } catch {
                // ignore release fallback
              }
            }}
            onPointerCancel={() => {
              paintingRef.current = false;
              draggingInspectIdRef.current = null;
              panningRef.current = null;
              setIsPanning(false);
            }}
            onPointerLeave={() => {
              if (!panningRef.current) {
                paintingRef.current = false;
                draggingInspectIdRef.current = null;
                setHoverWorld(null);
              }
            }}
            onContextMenu={(e) => e.preventDefault()}
            onWheel={(e) => {
              e.preventDefault();
              const factor = e.deltaY < 0 ? 1.12 : 0.89;
              setZoom((z) => Math.max(0.65, Math.min(maxZoom, z * factor)));
            }}
          />
        </div>

        {/* Outside Right Rail: Brush Size, Density, Magnify & Live Readout */}
        <aside className="w-[128px] shrink-0 bg-[#101522] border-l border-white/[0.1] flex flex-col justify-between p-2.5 gap-3 overflow-y-auto maker-scroll text-white">
          <div className="space-y-3">
            {/* Magnify / Zoom Controls */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-slate-400">Magnify</span>
                <span className="tabular-nums text-slate-200">{zoomPercent}%</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.65, z * 0.85))}
                  className="flex items-center justify-center py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.14] transition-colors"
                  title="Zoom Out"
                  aria-label="Zoom Out"
                >
                  <ZoomOut size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(maxZoom, z * 1.15))}
                  className="flex items-center justify-center py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.14] transition-colors"
                  title="Zoom In"
                  aria-label="Zoom In"
                >
                  <ZoomIn size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const fitted = computeLandFit();
                    setZoom(fitted.zoom);
                    setPan(fitted.pan);
                  }}
                  className="flex items-center justify-center py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.14] transition-colors"
                  title="Fit & Center View"
                  aria-label="Reset Pan & Zoom"
                >
                  <RotateCcw size={13} />
                </button>
              </div>
            </div>

            <div className="border-t border-white/[0.08]" />

            {/* Brush Size */}
            <label className="block space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-slate-400">Size</span>
                <span className="tabular-nums text-[#F59E0B]">{activeBrushRadius}m</span>
              </div>
              <input
                type="range"
                min={isWorldMapMode ? 6 : 3}
                max={isWorldMapMode ? 120 : 28}
                step={isWorldMapMode ? 2 : 1}
                value={activeBrushRadius}
                onChange={(e) => setActiveBrushRadius(Number(e.target.value))}
                className="w-full accent-[#F59E0B]"
              />
            </label>

            {/* Density (Land Edit mode) */}
            {!isWorldMapMode && (
              <label className="block space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="text-slate-400">Density</span>
                  <span className="tabular-nums text-[#20B46A]">
                    {Math.round(density * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.2}
                  max={1}
                  step={0.05}
                  value={density}
                  onChange={(e) => setDensity(Number(e.target.value))}
                  className="w-full accent-[#20B46A]"
                />
              </label>
            )}

            {(isPanning || shiftHeld) && (
              <div
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/[0.08] border border-white/15 text-[10px] font-bold"
                data-testid="pan-hand-indicator"
              >
                <Hand
                  size={12}
                  className={isPanning ? 'text-[#20B46A] shrink-0' : 'text-amber-300 shrink-0'}
                />
                <span className="truncate">{isPanning ? 'Panning' : 'Shift · Pan'}</span>
              </div>
            )}
          </div>

          {/* Live Coordinates / World Extent */}
          <div className="pt-2 border-t border-white/[0.08] text-[10px] font-mono tabular-nums text-slate-300 space-y-0.5">
            {hoverWorld ? (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-500">X</span>
                  <span>{hoverWorld[0].toFixed(1)}m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Z</span>
                  <span>{hoverWorld[1].toFixed(1)}m</span>
                </div>
                <div className="flex justify-between text-slate-400 pt-0.5">
                  <span>{isWorldMapMode ? 'Map' : 'Y'}</span>
                  <span>
                    {isWorldMapMode
                      ? `${worldMapRadius * 2}m`
                      : `${sampleTerrainHeight(terrain, hoverWorld[0], hoverWorld[1]).toFixed(1)}m`}
                  </span>
                </div>
              </>
            ) : (
              <div className="text-slate-500 leading-snug">
                {isWorldMapMode
                  ? `World ${worldMapRadius * 2}×${worldMapRadius * 2}m`
                  : 'Hover map for coords'}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Flush Bottom Toolbar Under the Map Border (Never Overlays Canvas) */}
      <div className="shrink-0 bg-[#121725] border-t border-white/[0.1] px-2.5 py-2">
        {isWorldMapMode && worldMap ? (
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => setWorldMapSelectMode(true)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap ${
                  worldMapSelectMode
                    ? 'bg-[#7C5CFF] text-white'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <MousePointer2 size={12} />
                <span>Select</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setWorldMapSelectMode(false);
                  store.setWorldMapBrushMode('terrain');
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-colors whitespace-nowrap ${
                  !worldMapSelectMode && store.worldMapBrushMode === 'terrain'
                    ? 'bg-[#E5C67E] text-slate-900 shadow-xs'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full border border-black/25 shrink-0"
                  style={{ backgroundColor: WORLD_TERRAIN_YELLOW }}
                />
                <span>Terrain</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setWorldMapSelectMode(false);
                  store.setWorldMapBrushMode('eraseTerrain');
                }}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap ${
                  !worldMapSelectMode && store.worldMapBrushMode === 'eraseTerrain'
                    ? 'bg-[#F2545B] text-white'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Eraser size={12} />
                <span>Erase Land</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setWorldMapSelectMode(false);
                  store.setWorldMapBrushMode('clearLand');
                }}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap ${
                  !worldMapSelectMode && store.worldMapBrushMode === 'clearLand'
                    ? 'bg-slate-500 text-white'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span>Unassign</span>
              </button>

              <div className="h-4 w-px bg-white/15 mx-0.5" />

              {worldMap.regions.map((region) => {
                const paintingThisLand =
                  !worldMapSelectMode &&
                  store.worldMapBrushMode === 'paintLand' &&
                  store.selectedWorldLandCode === region.code;
                return (
                  <button
                    key={region.id}
                    type="button"
                    onClick={() => {
                      setWorldMapSelectMode(false);
                      store.setSelectedWorldLandCode(region.code);
                      store.setWorldMapBrushMode('paintLand');
                    }}
                    onDoubleClick={() => store.enterWorldEditorScope(region.levelId)}
                    title="Paint this Land color on terrain (Double-click to edit Land)"
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-colors whitespace-nowrap ${
                      paintingThisLand
                        ? 'text-white shadow-xs ring-2 ring-white/70'
                        : 'bg-white/10 text-slate-200 hover:bg-white/20'
                    }`}
                    style={paintingThisLand ? { backgroundColor: region.colorHex } : undefined}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-white/50 shrink-0"
                      style={{ backgroundColor: region.colorHex }}
                    />
                    <span className="max-w-[96px] truncate">{region.name}</span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  setWorldMapSelectMode(false);
                  store.addWorldLandRegion();
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#7C5CFF] hover:bg-[#6A48F5] text-white text-[11px] font-extrabold whitespace-nowrap"
              >
                <Plus size={12} />
                <span>New Land</span>
              </button>
            </div>

            <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.06] text-slate-300 text-[11px] font-bold cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={store.worldMapAutoLand}
                onChange={(e) => store.setWorldMapAutoLand(e.target.checked)}
                className="accent-[#20B46A]"
              />
              <span>Auto-Land</span>
            </label>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1">
            {PAINTER_2D_TOOLS.map((item) => {
              const Icon = item.Icon;
              const active = !activePlacementAssetId && tool === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTool(item.id)}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap ${
                    active
                      ? item.id === 'terrain'
                        ? 'text-slate-900 shadow-xs'
                        : 'text-white shadow-xs'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                  style={active ? { backgroundColor: item.accent } : undefined}
                >
                  <Icon size={12} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
