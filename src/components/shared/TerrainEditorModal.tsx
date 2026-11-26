import React, { useMemo } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Box,
  Flower2,
  Layers,
  Lock,
  Minus,
  Mountain,
  Paintbrush,
  Pipette,
  Redo2,
  RotateCcw,
  Sparkles,
  Trees,
  Undo2,
  Wand2,
  Waves,
  X,
} from 'lucide-react';
import type { MakerStore } from '../../store/useMakerStore';
import type { GrassQuality, TerrainBrush, TerrainBrushFalloff } from '../../types/maker';
import { resolveGrassConfig } from '../../three/stylizedGrassSystem';
import {
  applySlopeAutoWeathering,
  clearTerrainWeathering,
  createInitialTerrain,
  getEnvironmentType,
} from '../../utils/terrain';

interface SculptBrushDef {
  id: TerrainBrush;
  label: string;
  shortDesc: string;
  accent: string;
}

const PRIMARY_SCULPT_BRUSHES: SculptBrushDef[] = [
  {
    id: 'raiseGround',
    label: 'Raise',
    shortDesc: 'Lift hills & slopes',
    accent: '#20B46A',
  },
  {
    id: 'lowerGround',
    label: 'Lower',
    shortDesc: 'Carve valleys & basins',
    accent: '#F2545B',
  },
  {
    id: 'flattenGround',
    label: 'Flatten',
    shortDesc: 'Level to target height',
    accent: '#38BDF8',
  },
  {
    id: 'smoothGround',
    label: 'Smooth',
    shortDesc: 'Soften curved banks',
    accent: '#A855F7',
  },
];

const FEATURE_SCULPT_BRUSHES: { id: TerrainBrush; label: string; accent: string }[] = [
  { id: 'plateauCliff', label: 'Cliff Mesa', accent: '#F59E0B' },
  { id: 'carveRiver', label: 'Carve River', accent: '#0EA5E9' },
  { id: 'carveCave', label: 'Carve Cave', accent: '#94A3B8' },
];

const PAINT_BRUSHES: { id: TerrainBrush; label: string; swatch: string }[] = [
  { id: 'paintGrass', label: 'Grass', swatch: '#4F9E3C' },
  { id: 'paintMoss', label: 'Moss', swatch: '#598A3A' },
  { id: 'paintSand', label: 'Sand', swatch: '#D9C08B' },
  { id: 'paintDirt', label: 'Dirt', swatch: '#9E7B54' },
  { id: 'paintCobble', label: 'Cobble', swatch: '#8E8B82' },
  { id: 'paintRock', label: 'Rock', swatch: '#6F737A' },
  { id: 'paintSnow', label: 'Snow', swatch: '#EBF2FA' },
];

const WEATHER_BRUSHES: { id: TerrainBrush; label: string; swatch: string; desc: string }[] = [
  { id: 'weatherCracks', label: 'Cracks', swatch: '#57534E', desc: 'Fractured rock & fissures' },
  { id: 'weatherErode', label: 'Erode Cliff', swatch: '#B45309', desc: 'Chisels & cracks slopes' },
  { id: 'weatherMoss', label: 'Moss', swatch: '#4B8B3B', desc: 'Damp cave & slope lichen' },
  { id: 'weatherScorch', label: 'Scorch', swatch: '#292524', desc: 'Ash & fire soot' },
  { id: 'weatherMud', label: 'Damp Mud', swatch: '#6B4C35', desc: 'Muddy mire & rot' },
  { id: 'weatherFrost', label: 'Frost', swatch: '#BAE6FD', desc: 'Rime frost & snow dust' },
  { id: 'weatherClear', label: 'Clean', swatch: '#CBD5E1', desc: 'Wash away weathering' },
];

const SCATTER_BRUSHES: { id: TerrainBrush; label: string; icon: React.ReactNode }[] = [
  { id: 'scatterTree', label: 'Trees', icon: <Trees size={13} /> },
  { id: 'scatterRock', label: 'Rocks', icon: <Mountain size={13} /> },
  { id: 'scatterFlower', label: 'Flowers', icon: <Flower2 size={13} /> },
  { id: 'scatterCustom', label: 'Custom GLB', icon: <Box size={13} /> },
];

const FALLOFF_PROFILES: {
  id: TerrainBrushFalloff;
  label: string;
  svgPath: string;
}[] = [
  {
    id: 'smooth',
    label: 'Smooth',
    svgPath: 'M 2 18 C 8 18, 10 3, 18 3 C 26 3, 28 18, 34 18',
  },
  {
    id: 'dome',
    label: 'Dome',
    svgPath: 'M 2 18 Q 5 3, 18 3 Q 31 3, 34 18',
  },
  {
    id: 'peak',
    label: 'Peak',
    svgPath: 'M 2 18 Q 14 15, 18 3 Q 22 15, 34 18',
  },
  {
    id: 'plateau',
    label: 'Flat Top',
    svgPath: 'M 2 18 C 6 18, 8 3, 12 3 L 24 3 C 28 3, 30 18, 34 18',
  },
];

const QUICK_SIZES = [3, 6, 12, 20];

const FLATTEN_PRESETS: { label: string; height: number }[] = [
  { label: 'Riverbed', height: -2.6 },
  { label: 'Shore', height: -0.6 },
  { label: 'Meadow', height: 1.2 },
  { label: 'Highland', height: 5.5 },
];

export function getTerrainBrushLabel(brush: TerrainBrush): string {
  switch (brush) {
    case 'raiseGround':
      return 'Raise';
    case 'lowerGround':
      return 'Lower';
    case 'flattenGround':
      return 'Flatten';
    case 'smoothGround':
      return 'Smooth';
    case 'plateauCliff':
      return 'Cliff';
    case 'carveRiver':
      return 'River';
    case 'carveCave':
      return 'Cave';
    case 'paintGrass':
      return 'Grass';
    case 'paintMoss':
      return 'Moss';
    case 'paintSand':
      return 'Sand';
    case 'paintDirt':
      return 'Dirt';
    case 'paintCobble':
      return 'Cobble';
    case 'paintRock':
      return 'Rock';
    case 'paintSnow':
      return 'Snow';
    case 'weatherMoss':
      return 'Weather Moss';
    case 'weatherCracks':
      return 'Rock Cracks';
    case 'weatherErode':
      return 'Erode Cliff';
    case 'weatherScorch':
      return 'Scorch / Soot';
    case 'weatherMud':
      return 'Damp Mud';
    case 'weatherFrost':
      return 'Rime Frost';
    case 'weatherClear':
      return 'Clean Weathering';
    case 'scatterTree':
      return 'Trees';
    case 'scatterRock':
      return 'Rocks';
    case 'scatterFlower':
      return 'Flowers';
    case 'scatterCustom':
      return 'Custom GLB';
    default:
      return 'Terrain';
  }
}

function PrimaryBrushIcon({ id, size = 15 }: { id: TerrainBrush; size?: number }) {
  switch (id) {
    case 'raiseGround':
      return <ArrowUpFromLine size={size} />;
    case 'lowerGround':
      return <ArrowDownToLine size={size} />;
    case 'flattenGround':
      return <Minus size={size} strokeWidth={2.8} />;
    case 'smoothGround':
      return <Waves size={size} />;
    default:
      return <Mountain size={size} />;
  }
}

export const TerrainEditorModal: React.FC<{
  store: MakerStore;
  onClose: () => void;
}> = ({ store, onClose }) => {
  const level = store.currentLevel;

  const activeScatterAssetId = useMemo(
    () => store.terrainScatterAssetId || store.customAssets[0]?.id || '',
    [store.terrainScatterAssetId, store.customAssets]
  );

  if (!level) return null;

  const envType = getEnvironmentType(level);
  const isOpenWorld = envType === 'openWorld';
  const activeBrush = store.terrainBrush;

  const selectBrush = (brush: TerrainBrush) => {
    if (brush === 'scatterCustom' && store.customAssets.length === 0) {
      store.setShowingAssetVault(true);
      return;
    }
    store.setTerrainBrush(brush);
    store.setWorldTool('terrain');
    if (store.selectedTab !== 'world') {
      store.setSelectedTab('world');
    }
  };

  return (
    <aside
      aria-label="Terrain Maker"
      className="fixed top-16 right-4 bottom-4 w-[368px] max-w-[calc(100vw-2rem)] z-40 flex flex-col rounded-2xl bg-white dark:bg-[#151822] border border-slate-200 dark:border-white/[0.12] shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200/80 dark:border-white/[0.08]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#20B46A]/15 text-[#20B46A] flex items-center justify-center shrink-0">
            <Mountain size={16} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold leading-tight truncate">
              Terrain Maker
            </h2>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-[#949BB0] truncate">
              {level.name} · High-Res Heightmap
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            disabled={!store.canUndo}
            onClick={() => store.undo()}
            title="Undo last stroke"
            className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#C5CCE0] hover:text-slate-900 dark:hover:text-white disabled:opacity-35 flex items-center justify-center"
          >
            <Undo2 size={13} />
          </button>
          <button
            type="button"
            disabled={!store.canRedo}
            onClick={() => store.redo()}
            title="Redo"
            className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#C5CCE0] hover:text-slate-900 dark:hover:text-white disabled:opacity-35 flex items-center justify-center"
          >
            <Redo2 size={13} />
          </button>
          {isOpenWorld && (
            <button
              type="button"
              onClick={() => store.resetTerrain()}
              title="Reset terrain to default island"
              className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#C5CCE0] hover:text-[#F2545B] flex items-center justify-center"
            >
              <RotateCcw size={13} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            title="Close Terrain Maker"
            className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-slate-500 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white flex items-center justify-center"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto maker-scroll p-4 space-y-4">
        {!isOpenWorld ? (
          <div className="p-4 rounded-2xl bg-slate-100 dark:bg-[#1D2230] border border-slate-200/80 dark:border-white/[0.08] space-y-3">
            <div className="text-xs font-extrabold text-slate-900 dark:text-white">
              Terrain sculpting requires Open World mode
            </div>
            <p className="text-[11px] text-slate-600 dark:text-[#9AA3BA] leading-relaxed">
              This level currently uses the <strong className="capitalize">{envType}</strong> layout. Switch it to Open World to sculpt hills, valleys, riverbanks, and custom heightmaps.
            </p>
            <button
              type="button"
              onClick={() => {
                store.updateLevel('switch to open world', (lvl) => ({
                  ...lvl,
                  environmentType: 'openWorld',
                  cameraMode: lvl.cameraMode === 'sideScroll' ? 'front' : lvl.cameraMode,
                }));
                store.setWorldTool('terrain');
              }}
              className="w-full py-2 px-3 rounded-xl bg-[#20B46A] text-white text-xs font-extrabold hover:opacity-95"
            >
              Switch Level to Open World
            </button>
          </div>
        ) : (
          <>
            {/* Sculpt Mode Active Banner */}
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#1C212E] border border-slate-200/70 dark:border-white/[0.07]">
              <div className="text-[11px] font-bold text-slate-700 dark:text-[#D1D7E8]">
                {store.worldTool === 'terrain'
                  ? `Active: ${getTerrainBrushLabel(activeBrush)} Brush`
                  : 'Brush paused (Move / Select mode)'}
              </div>
              <button
                type="button"
                onClick={() =>
                  store.setWorldTool(store.worldTool === 'terrain' ? 'move' : 'terrain')
                }
                className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-colors whitespace-nowrap ${
                  store.worldTool === 'terrain'
                    ? 'bg-[#20B46A]/18 text-[#20B46A]'
                    : 'bg-[#7C5CFF] text-white'
                }`}
              >
                {store.worldTool === 'terrain' ? 'Sculpting On' : 'Resume Brush'}
              </button>
            </div>

            {/* Primary Heightmap Sculpting Brushes */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB]">
                  Heightmap Sculpt
                </span>
                <span className="text-[11px] font-semibold text-slate-400 dark:text-[#6B7285]">
                  1.0m curved mesh
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {PRIMARY_SCULPT_BRUSHES.map((b) => {
                  const active = store.worldTool === 'terrain' && activeBrush === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => selectBrush(b.id)}
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                        active
                          ? 'bg-slate-900 text-white dark:bg-white/[0.09] border-transparent shadow-xs'
                          : 'bg-slate-50 dark:bg-[#1C212E] border-slate-200/70 dark:border-white/[0.06] hover:border-slate-300 dark:hover:border-white/[0.16]'
                      }`}
                      style={active ? { boxShadow: `inset 0 0 0 1.5px ${b.accent}` } : undefined}
                    >
                      <span
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                        style={{
                          backgroundColor: `${b.accent}22`,
                          color: b.accent,
                        }}
                      >
                        <PrimaryBrushIcon id={b.id} size={14} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-extrabold leading-tight">
                          {b.label}
                        </span>
                        <span
                          className={`block text-[10px] mt-0.5 leading-snug ${
                            active
                              ? 'text-slate-300 dark:text-[#B6C0D6]'
                              : 'text-slate-500 dark:text-[#8E96AB]'
                          }`}
                        >
                          {b.shortDesc}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Secondary Specialty Sculpting Brushes */}
              <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                {FEATURE_SCULPT_BRUSHES.map((b) => {
                  const active = store.worldTool === 'terrain' && activeBrush === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => selectBrush(b.id)}
                      className={`px-2 py-1.5 rounded-xl text-[11px] font-bold border transition-colors whitespace-nowrap ${
                        active
                          ? 'text-white border-transparent'
                          : 'bg-slate-100 dark:bg-[#1C212E] border-transparent text-slate-600 dark:text-[#A8B1C6] hover:text-slate-900 dark:hover:text-white'
                      }`}
                      style={active ? { backgroundColor: b.accent } : undefined}
                    >
                      {b.label}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Flatten Target Elevation Controls (visible when Flatten is selected) */}
            {activeBrush === 'flattenGround' && (
              <section className="p-3 rounded-2xl bg-[#38BDF8]/10 border border-[#38BDF8]/25 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-extrabold text-[#0284C7] dark:text-[#38BDF8] uppercase tracking-wider">
                    Flatten Target Height
                  </span>
                  <div className="inline-flex rounded-lg bg-white/80 dark:bg-[#151822] p-0.5 border border-[#38BDF8]/25">
                    <button
                      type="button"
                      onClick={() => store.setTerrainFlattenHeight(null)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        store.terrainFlattenHeight === null
                          ? 'bg-[#38BDF8] text-white'
                          : 'text-slate-500 dark:text-[#949BB0]'
                      }`}
                    >
                      <Pipette size={10} />
                      <span>Sample</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        store.setTerrainFlattenHeight(store.terrainFlattenHeight ?? 1.2)
                      }
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        store.terrainFlattenHeight !== null
                          ? 'bg-[#38BDF8] text-white'
                          : 'text-slate-500 dark:text-[#949BB0]'
                      }`}
                    >
                      <Lock size={10} />
                      <span>Lock</span>
                    </button>
                  </div>
                </div>

                {store.terrainFlattenHeight === null ? (
                  <p className="text-[11px] text-slate-600 dark:text-[#B0BCD4] leading-snug">
                    Samples elevation where your stroke begins and levels everything you drag over to match that exact height.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span>Locked Elevation</span>
                      <span className="tabular-nums text-[#0284C7] dark:text-[#38BDF8]">
                        {store.terrainFlattenHeight >= 0 ? '+' : ''}
                        {store.terrainFlattenHeight.toFixed(1)}m
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-3.4}
                      max={18}
                      step={0.2}
                      value={store.terrainFlattenHeight}
                      onChange={(e) => store.setTerrainFlattenHeight(Number(e.target.value))}
                      className="w-full accent-[#38BDF8]"
                    />
                    <div className="grid grid-cols-4 gap-1">
                      {FLATTEN_PRESETS.map((p) => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => store.setTerrainFlattenHeight(p.height)}
                          className={`py-1 px-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                            Math.abs((store.terrainFlattenHeight ?? 0) - p.height) < 0.15
                              ? 'bg-[#38BDF8] text-white border-[#38BDF8]'
                              : 'bg-white dark:bg-[#151822] border-slate-200/70 dark:border-white/[0.08] text-slate-600 dark:text-[#A8B1C6]'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Brush Size, Strength & Falloff Curve */}
            <section className="p-3 rounded-2xl bg-slate-50 dark:bg-[#1C212E] border border-slate-200/70 dark:border-white/[0.06] space-y-3">
              {/* Radius */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>Brush Size</span>
                  <span className="tabular-nums text-[#7C5CFF]">
                    {store.terrainBrushRadius.toFixed(1)}m
                  </span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={24}
                  step={0.5}
                  value={store.terrainBrushRadius}
                  onChange={(e) => store.setTerrainBrushRadius(Number(e.target.value))}
                  className="w-full accent-[#7C5CFF]"
                />
                <div className="grid grid-cols-4 gap-1.5">
                  {QUICK_SIZES.map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => store.setTerrainBrushRadius(sz)}
                      className={`py-1 rounded-lg text-[10px] font-bold tabular-nums transition-colors ${
                        Math.abs(store.terrainBrushRadius - sz) < 0.3
                          ? 'bg-[#7C5CFF] text-white'
                          : 'bg-white dark:bg-[#151822] text-slate-500 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {sz}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Strength */}
              <div className="space-y-1.5 pt-2 border-t border-slate-200/70 dark:border-white/[0.06]">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>Strength</span>
                  <span className="tabular-nums text-[#20B46A]">
                    {Math.round(store.terrainBrushStrength * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={1.5}
                  step={0.05}
                  value={store.terrainBrushStrength}
                  onChange={(e) => store.setTerrainBrushStrength(Number(e.target.value))}
                  className="w-full accent-[#20B46A]"
                />
              </div>

              {/* Falloff Profile */}
              <div className="space-y-1.5 pt-2 border-t border-slate-200/70 dark:border-white/[0.06]">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>Curve Falloff</span>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-[#949BB0] capitalize">
                    {store.terrainBrushFalloff}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {FALLOFF_PROFILES.map((fp) => {
                    const active = store.terrainBrushFalloff === fp.id;
                    return (
                      <button
                        key={fp.id}
                        type="button"
                        onClick={() => store.setTerrainBrushFalloff(fp.id)}
                        className={`flex flex-col items-center gap-1 py-1.5 px-1 rounded-xl border transition-colors ${
                          active
                            ? 'border-[#7C5CFF] bg-[#7C5CFF]/14 text-[#7C5CFF]'
                            : 'border-transparent bg-white dark:bg-[#151822] text-slate-500 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <svg width="36" height="20" viewBox="0 0 36 20" fill="none">
                          <path
                            d={fp.svgPath}
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <span className="text-[10px] font-bold leading-none">{fp.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Surface Paint (Feathered Multi-Material Splatting) */}
            <section className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Paintbrush size={12} className="text-[#F59E0B]" />
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB]">
                  Surface Paint (Feathered Blend)
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {PAINT_BRUSHES.map((pb) => {
                  const active = store.worldTool === 'terrain' && activeBrush === pb.id;
                  return (
                    <button
                      key={pb.id}
                      type="button"
                      onClick={() => selectBrush(pb.id)}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl border text-[11px] font-bold transition-colors ${
                        active
                          ? 'border-[#F59E0B] bg-[#F59E0B]/15 text-[#D97706] dark:text-[#FBBF24]'
                          : 'border-transparent bg-slate-100 dark:bg-[#1C212E] text-slate-600 dark:text-[#A8B1C6] hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0"
                        style={{ backgroundColor: pb.swatch }}
                      />
                      <span className="truncate">{pb.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Weather & Degrade Ground / Hills / Mountains / Caves */}
            <section className="p-3 rounded-2xl bg-slate-50 dark:bg-[#1C212E] border border-slate-200/70 dark:border-white/[0.06] space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={12} className="text-[#20B46A]" />
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB]">
                    Weather &amp; Degrade Surfaces
                  </span>
                </div>
                <span className="text-[10px] font-semibold text-slate-400 dark:text-[#7D859B]">
                  Hills · Cliffs · Caves
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {WEATHER_BRUSHES.map((wb) => {
                  const active = store.worldTool === 'terrain' && activeBrush === wb.id;
                  return (
                    <button
                      key={wb.id}
                      type="button"
                      title={wb.desc}
                      onClick={() => selectBrush(wb.id)}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl border text-[11px] font-bold transition-colors ${
                        active
                          ? 'border-[#20B46A] bg-[#20B46A]/18 text-[#20B46A]'
                          : 'border-transparent bg-white dark:bg-[#151822] text-slate-600 dark:text-[#A8B1C6] hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full border border-black/20 shrink-0"
                        style={{ backgroundColor: wb.swatch }}
                      />
                      <span className="truncate">{wb.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() =>
                    store.updateLevel('auto-weather cliffs & caves', (lvl) => ({
                      ...lvl,
                      terrain: applySlopeAutoWeathering(
                        lvl.terrain ?? createInitialTerrain(),
                        store.terrainBrushStrength
                      ),
                    }))
                  }
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl bg-[#20B46A]/15 hover:bg-[#20B46A]/25 text-[#20B46A] text-[11px] font-extrabold transition-colors"
                >
                  <Wand2 size={12} />
                  <span>Auto-Weather Cliffs &amp; Caves</span>
                </button>
                {Boolean(level.terrain?.weathering) && (
                  <button
                    type="button"
                    onClick={() =>
                      store.updateLevel('clear terrain weathering', (lvl) => ({
                        ...lvl,
                        terrain: clearTerrainWeathering(lvl.terrain ?? createInitialTerrain()),
                      }))
                    }
                    className="py-1.5 px-2.5 rounded-xl bg-white dark:bg-[#151822] hover:text-[#F2545B] text-slate-500 dark:text-[#949BB0] text-[11px] font-bold"
                  >
                    Clear
                  </button>
                )}
              </div>
            </section>

            {/* Foliage & Prop Scatter */}
            <section className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Sparkles size={12} className="text-[#20B46A]" />
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB]">
                  Scatter Flora & Props
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {SCATTER_BRUSHES.map((sb) => {
                  const active = store.worldTool === 'terrain' && activeBrush === sb.id;
                  return (
                    <button
                      key={sb.id}
                      type="button"
                      onClick={() => selectBrush(sb.id)}
                      className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-bold transition-colors ${
                        active
                          ? 'border-[#20B46A] bg-[#20B46A]/15 text-[#20B46A]'
                          : 'border-transparent bg-slate-100 dark:bg-[#1C212E] text-slate-600 dark:text-[#A8B1C6] hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {sb.icon}
                      <span>{sb.label}</span>
                    </button>
                  );
                })}
              </div>

              {activeBrush === 'scatterCustom' && store.customAssets.length > 0 && (
                <select
                  value={activeScatterAssetId}
                  onChange={(e) => store.setTerrainScatterAssetId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#1C212E] border border-[#7C5CFF]/40 text-xs font-bold"
                >
                  {store.customAssets.map((a) => (
                    <option key={a.id} value={a.id}>
                      Custom Model: {a.name}
                    </option>
                  ))}
                </select>
              )}
            </section>

            {/* Quick Meadow Grass & Camera LOD Control */}
            {(() => {
              const g = resolveGrassConfig(level.grass);
              const activeQ: GrassQuality = g.enabled ? g.quality : 'off';
              return (
                <section className="p-3 rounded-2xl bg-slate-50 dark:bg-[#1C212E] border border-slate-200/70 dark:border-white/[0.06] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB]">
                      Meadow Grass & LOD
                    </span>
                    <span className="text-[10px] font-bold text-[#20B46A] tabular-nums">
                      {activeQ === 'off' ? 'Off' : `${Math.round(g.viewDistance)}m`}
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {(['off', 'light', 'lush', 'dense', 'ultra'] as GrassQuality[]).map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() =>
                          store.updateLevel('set grass quality', (lvl) => ({
                            ...lvl,
                            grass: {
                              ...resolveGrassConfig(lvl.grass),
                              enabled: q !== 'off',
                              quality: q,
                            },
                          }))
                        }
                        className={`py-1 rounded-lg text-[10px] font-bold capitalize border transition-colors ${
                          activeQ === q
                            ? 'bg-[#20B46A] text-white border-[#20B46A]'
                            : 'bg-white dark:bg-[#151822] border-transparent text-slate-600 dark:text-[#A8B1C6]'
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </section>
              );
            })()}
          </>
        )}
      </div>

      {/* Footer Hint */}
      <div className="shrink-0 px-4 py-2.5 bg-slate-50 dark:bg-[#11141D] border-t border-slate-200/80 dark:border-white/[0.08] flex items-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-[#8E96AB]">
        <Layers size={12} className="shrink-0 text-[#7C5CFF]" />
        <span>Left-drag terrain to sculpt · Right-drag or drag sky to orbit</span>
      </div>
    </aside>
  );
};
