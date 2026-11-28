import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Box,
  Car,
  CloudFog,
  CloudSun,
  Crosshair,
  Eraser,
  Film,
  Gamepad2,
  Globe,
  Mountain,
  Palette,
  PanelLeftClose,
  Plus,
  Route,
  Search,
  SlidersHorizontal,
  Sparkles,
  Sprout,
  Sun,
  Trees,
  Waves,
  Wind,
} from 'lucide-react';
import {
  PLATFORMER_CATEGORY_META,
  PLATFORMER_MODULES,
  PLATFORMER_MODULE_DRAG_MIME,
  type PlatformerModuleSpec,
} from '../../data/platformerCatalog';
import { CAR_PRESETS, DRIVING_PHYSICS_PRESETS } from '../../three/vehicleModels';
import type { MakerStore } from '../../store/useMakerStore';
import type {
  CarPresetId,
  DrivingPhysicsId,
  EnvironmentType,
  PlatformerAddonCategory,
  PlatformerModuleId,
  PropPresetId,
  ViewportTool,
  WorldDomainId,
} from '../../types/maker';
import { WORLD_TERRAIN_YELLOW, type WorldMapBrushMode } from '../../utils/worldMap';
import {
  type AtmosphereSectionId,
  publishGuidanceFromControlEvent,
  publishGuidanceHint,
} from '../../utils/editorPrefs';
import { AtmospherePreviewViewport } from './AtmospherePreviewViewport';
import { LeftAssetsPanel } from './LeftAssetsPanel';
import { PlatformerModuleAnim } from './PlatformerModuleAnim';

export type LeftCreationTab = 'build' | 'props' | 'atmosphere';
export type LeftPropsSubTab = 'assets' | 'scene';

const ATMOSPHERE_ATTRIBUTES: {
  id: AtmosphereSectionId;
  label: string;
  hint: string;
  accent: string;
  Icon: React.FC<{ size?: number; className?: string }>;
}[] = [
  { id: 'skyTime', label: 'Sky & Time of Day', hint: 'Sun, moon, stars, aurora & clouds', accent: '#0EA5E9', Icon: CloudSun },
  { id: 'fogMist', label: 'Fog & Ground Mist', hint: 'Rolling mist, edge fade & drift', accent: '#38BDF8', Icon: CloudFog },
  { id: 'weatherWind', label: 'Weather & Wind', hint: 'Rain, snow, storm & wind gusts', accent: '#0284C7', Icon: Wind },
  { id: 'sunRays', label: 'God Rays & Dust', hint: '3D light shafts & floating motes', accent: '#F59E0B', Icon: Sun },
  { id: 'styleBiome', label: 'Visual Style & Biome', hint: 'Shading look & terrain colors', accent: '#A855F7', Icon: Palette },
  { id: 'postFx', label: 'Post FX & Lighting', hint: 'Bloom glow, vignette & color', accent: '#EC4899', Icon: Film },
  { id: 'horizonVista', label: '360° Horizon Vista', hint: 'Distant mountains & forest ring', accent: '#16A34A', Icon: Mountain },
];

interface DomainCardMeta {
  id: WorldDomainId;
  label: string;
  hint: string;
  accent: string;
  Icon: React.FC<{ size?: number; className?: string }>;
}

const OPEN_WORLD_LAND_DOMAINS: DomainCardMeta[] = [
  { id: 'select', label: 'Select & Move', hint: 'Pick or drag items', accent: '#6D4AFF', Icon: Crosshair },
  { id: 'mountains', label: 'Mountains', hint: 'Peaks, cliffs & rock', accent: '#D97706', Icon: Mountain },
  { id: 'water', label: 'Water', hint: 'Lakes, rivers & shore', accent: '#0284C7', Icon: Waves },
  { id: 'caves', label: 'Caves', hint: 'Carve grottos', accent: '#9333EA', Icon: Mountain },
  { id: 'grass', label: 'Grass', hint: 'Meadows & turf', accent: '#16A34A', Icon: Sprout },
  { id: 'dirtRoads', label: 'Dirt & Roads', hint: 'Paths, trails & stone', accent: '#B45309', Icon: Route },
  { id: 'buildings', label: 'Buildings', hint: 'Walls, roofs & doors', accent: '#EA580C', Icon: Box },
  { id: 'flora', label: 'Flora', hint: 'Trees, rocks, flowers & plants', accent: '#15803D', Icon: Trees },
  { id: 'particleFx', label: 'Particle FX', hint: 'Fireflies, embers, mist & bursts', accent: '#F59E0B', Icon: Sparkles },
];

const ARENA_DOMAINS: DomainCardMeta[] = [
  { id: 'select', label: 'Select & Move', hint: 'Pick or arrange items', accent: '#6D4AFF', Icon: Crosshair },
  { id: 'buildings', label: 'Buildings & Doors', hint: 'Walls, roofs & gates', accent: '#EA580C', Icon: Box },
  { id: 'particleFx', label: 'Particle FX', hint: 'Fireflies, embers, magic & sparks', accent: '#F59E0B', Icon: Sparkles },
  { id: 'platformerKit', label: 'Interactive Modules', hint: 'Movers, traps & gates', accent: '#16A34A', Icon: Gamepad2 },
];

export interface WorldLeftCreationPanelProps {
  store: MakerStore;
  envType: EnvironmentType;
  isWorldMapScope: boolean;
  worldMapSelectMode: boolean;
  onWorldMapSelectModeChange: (selectMode: boolean) => void;
  activeTool: ViewportTool;
  setTool: (t: ViewportTool) => void;
  brushRadius: number;
  setBrushRadius: (r: number) => void;
  activeTab: LeftCreationTab;
  setActiveTab: (tab: LeftCreationTab) => void;
  propsSubTab: LeftPropsSubTab;
  setPropsSubTab: (sub: LeftPropsSubTab) => void;
  onSelectDomain: (domainId: WorldDomainId) => void;
  atmosphereSection?: AtmosphereSectionId;
  onSelectAtmosphereSection?: (sec: AtmosphereSectionId) => void;
  onOpenLandSettings: () => void;
  onCollapsePanel: () => void;
  activePlacementAssetId: string | null;
  onSelectPlacementAsset: (assetId: string) => void;
  placePlatformerModuleId: PlatformerModuleId | null;
  onSelectPlacePlatformerModule: (spec: PlatformerModuleSpec | null) => void;
  onQuickPlacePlatformerModule: (spec: PlatformerModuleSpec) => void;
  renderSceneContents: () => React.ReactNode;
}

export const WorldLeftCreationPanel: React.FC<WorldLeftCreationPanelProps> = ({
  store,
  envType,
  isWorldMapScope,
  worldMapSelectMode,
  onWorldMapSelectModeChange,
  activeTool,
  setTool,
  brushRadius,
  setBrushRadius,
  activeTab,
  setActiveTab,
  propsSubTab,
  setPropsSubTab,
  onSelectDomain,
  atmosphereSection = 'skyTime',
  onSelectAtmosphereSection,
  onOpenLandSettings,
  onCollapsePanel,
  activePlacementAssetId,
  onSelectPlacementAsset,
  placePlatformerModuleId,
  onSelectPlacePlatformerModule,
  onQuickPlacePlatformerModule,
  renderSceneContents,
}) => {
  const { currentLevel } = store;
  const [newLandName, setNewLandName] = useState('');
  const [platCategory, setPlatCategory] = useState<PlatformerAddonCategory | 'all'>('all');
  const [platQuery, setPlatQuery] = useState('');
  const [hoveredPlatId, setHoveredPlatId] = useState<PlatformerModuleId | null>(null);

  const wm = store.resolvedWorldMap;
  const wmRegions = wm?.regions ?? [];
  const isDriving = currentLevel?.gameplayMode === 'driving';
  const isPlatformer = envType === 'sideScroller';
  const is2DView = envType === 'openWorld' && store.worldViewMode === '2d';

  const inspectedPlatSpec = useMemo(() => {
    const targetId = hoveredPlatId ?? placePlatformerModuleId;
    return targetId ? PLATFORMER_MODULES.find((m) => m.id === targetId) ?? null : null;
  }, [hoveredPlatId, placePlatformerModuleId]);

  const filteredPlatModules = useMemo(() => {
    const q = platQuery.trim().toLowerCase();
    return PLATFORMER_MODULES.filter((m) => {
      if (!q && platCategory !== 'all' && m.category !== platCategory) return false;
      if (!q) return true;
      return (
        m.label.toLowerCase().includes(q) ||
        m.shortDesc.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q)
      );
    });
  }, [platCategory, platQuery]);

  if (!currentLevel) return null;

  // --- MODE 1: WORLD MAP SCOPE (Strictly World Geography & Lands) ---
  if (isWorldMapScope) {
    const paintTools: {
      id: WorldMapBrushMode | 'select';
      label: string;
      hint: string;
      swatch: string;
    }[] = [
      { id: 'terrain', label: 'Paint Land', hint: 'Draw islands & continents', swatch: WORLD_TERRAIN_YELLOW },
      { id: 'eraseTerrain', label: 'Erase to Ocean', hint: 'Carve coastlines & bays', swatch: '#EF4444' },
      { id: 'select', label: 'Select Land', hint: 'Click a region on map', swatch: '#6D4AFF' },
      { id: 'clearLand', label: 'Unassign Land', hint: 'Clear land tint only', swatch: '#94A3B8' },
    ];

    const handleCreateLand = () => {
      const created = store.addWorldLandRegion(newLandName.trim() || undefined);
      setNewLandName('');
      if (created) {
        onWorldMapSelectModeChange(false);
        setTool('terrain');
      }
    };

    return (
      <aside
        onPointerDownCapture={(e) => publishGuidanceFromControlEvent(e, 'World Map')}
        onFocusCapture={(e) => publishGuidanceFromControlEvent(e, 'World Map')}
        className="w-full lg:w-[296px] xl:w-[312px] shrink-0 lg:h-full lg:min-h-0 bg-white dark:bg-[#151822] border-b lg:border-b-0 lg:border-r border-slate-200/80 dark:border-white/[0.08] flex flex-col min-h-0 overflow-hidden"
      >
        <div className="shrink-0 px-3.5 py-2.5 border-b border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between gap-2 bg-slate-50/70 dark:bg-[#11141D]">
          <div className="flex items-center gap-2 min-w-0">
            <Globe size={16} style={{ color: WORLD_TERRAIN_YELLOW }} className="shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                World Map Builder
              </div>
              <div className="text-[11px] text-slate-500 dark:text-[#8E96AB] truncate">
                2 easy steps to launch your world
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onCollapsePanel}
            title="Hide left panel"
            aria-label="Hide left panel"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-[#949BB0] dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-[#1F2430]"
          >
            <PanelLeftClose size={14} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto maker-scroll p-3 space-y-4">
          {/* STEP 1: PAINT YOUR WORLD (Bold, Bright, Obvious) */}
          <div className="space-y-2">
            <div className="p-2.5 rounded-2xl bg-amber-400/18 dark:bg-amber-400/15 border border-amber-500/45 space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 text-[11px] font-black tracking-wide uppercase shrink-0">
                  Step 1
                </span>
                <h3 className="text-sm font-display font-extrabold text-slate-950 dark:text-amber-100 leading-tight">
                  Paint Your World
                </h3>
              </div>
              <p className="text-[11px] font-semibold text-slate-700 dark:text-amber-100/85 leading-snug">
                Draw golden continents &amp; islands directly across the blue ocean.
              </p>
            </div>

            <div className="space-y-1.5">
              {paintTools.map((item) => {
                const isSelectActive =
                  item.id === 'select' && (worldMapSelectMode || (!is2DView && activeTool !== 'terrain'));
                const isBrushActive =
                  item.id !== 'select' &&
                  !worldMapSelectMode &&
                  (is2DView || activeTool === 'terrain') &&
                  store.worldMapBrushMode === item.id;
                const active = isSelectActive || isBrushActive;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (item.id === 'select') {
                        onWorldMapSelectModeChange(true);
                        setTool('move');
                        publishGuidanceHint({
                          badge: 'World Map',
                          title: 'Select Land Tool',
                          detail:
                            'Click any painted Land region on the map to highlight it, or double-click a Land to open and build inside it.',
                        });
                      } else {
                        onWorldMapSelectModeChange(false);
                        store.setWorldMapBrushMode(item.id);
                        setTool('terrain');
                        const hintMap: Record<WorldMapBrushMode, { title: string; detail: string }> = {
                          terrain: {
                            title: 'Paint Land Brush',
                            detail:
                              'Click and drag across the ocean to paint golden landmasses. Use Brush Size below to draw broad continents or thin bridges.',
                          },
                          eraseTerrain: {
                            title: 'Erase to Ocean',
                            detail:
                              'Drag over golden land or shorelines to carve bays, channels, and islands back into open water.',
                          },
                          clearLand: {
                            title: 'Unassign Land Color',
                            detail:
                              'Brush over a colored Land region to revert it back to unassigned golden landmass without deleting ground.',
                          },
                          paintLand: {
                            title: 'Assign Land by Color',
                            detail:
                              'Brush across golden landmass to claim territory for your selected Land color.',
                          },
                        };
                        publishGuidanceHint({ badge: 'World Map', ...hintMap[item.id] });
                      }
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-all ${
                      active
                        ? 'bg-[#6D4AFF]/14 border-[#6D4AFF] text-slate-950 dark:text-white shadow-xs'
                        : 'bg-slate-50 dark:bg-[#1B1F2B] border-slate-200/70 dark:border-white/[0.06] text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-white/20'
                    }`}
                  >
                    {item.id === 'select' ? (
                      <span
                        className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${item.swatch}22`, color: item.swatch }}
                      >
                        <Crosshair size={14} />
                      </span>
                    ) : item.id === 'eraseTerrain' ? (
                      <span
                        className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${item.swatch}22`, color: item.swatch }}
                      >
                        <Eraser size={14} />
                      </span>
                    ) : (
                      <span
                        className="w-6 h-6 rounded-lg border border-black/20 shrink-0"
                        style={{ backgroundColor: item.swatch }}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-extrabold leading-tight">{item.label}</div>
                      <div className="text-[11px] text-slate-500 dark:text-[#8E96AB] truncate">
                        {item.hint}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Brush Size */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1B1F2B] border border-slate-200/70 dark:border-white/[0.06] space-y-2.5">
            <div>
              <div className="flex items-center justify-between text-xs font-bold mb-1">
                <span>Brush Size</span>
                <span className="tabular-nums text-[#6D4AFF] dark:text-[#A5B4FC]">
                  {brushRadius}m
                </span>
              </div>
              <input
                type="range"
                min={6}
                max={120}
                step={2}
                value={brushRadius}
                data-hint-badge="World Map"
                data-hint-title="World Brush Size"
                data-hint-detail="Drag right for massive continents or left for narrow peninsulas and small islands."
                onChange={(e) => setBrushRadius(Number(e.target.value))}
                className="w-full accent-[#6D4AFF]"
              />
            </div>

            <label className="flex items-center justify-between gap-2 text-xs font-semibold cursor-pointer pt-1 border-t border-slate-200/70 dark:border-white/[0.06]">
              <span className="text-slate-700 dark:text-slate-200">Auto-create Land</span>
              <input
                type="checkbox"
                checked={store.worldMapAutoLand}
                data-hint-badge="World Map"
                data-hint-title="Auto-Create Land"
                data-hint-detail="When enabled, painting your Land color over ocean automatically creates new landmass beneath it."
                onChange={(e) => store.setWorldMapAutoLand(e.target.checked)}
                className="accent-[#16A34A] w-4 h-4"
              />
            </label>
          </div>

          {/* STEP 2: ASSIGN INDIVIDUAL LANDS BY COLOR (Bold, Bright, Obvious) */}
          <div className="space-y-2.5">
            <div className="p-2.5 rounded-2xl bg-emerald-500/16 dark:bg-emerald-500/15 border border-emerald-500/45 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-400 text-slate-950 text-[11px] font-black tracking-wide uppercase shrink-0">
                    Step 2
                  </span>
                  <h3 className="text-sm font-display font-extrabold text-slate-950 dark:text-emerald-100 leading-tight truncate">
                    Assign Lands by Color
                  </h3>
                </div>
                <span className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-300 tabular-nums shrink-0">
                  {wmRegions.length}
                </span>
              </div>
              <p className="text-[11px] font-semibold text-slate-700 dark:text-emerald-100/85 leading-snug">
                Tap a Land to brush its color across the map, or press <strong className="font-extrabold">Edit</strong> to build inside it.
              </p>
            </div>

            {wmRegions.length === 0 ? (
              <div className="p-3 rounded-xl border border-dashed border-emerald-500/40 bg-emerald-500/5 text-xs font-medium text-slate-600 dark:text-emerald-100/80 leading-relaxed">
                Paint golden terrain above first, then create your first colored Land below!
              </div>
            ) : (
              <div className="space-y-1.5">
                {wmRegions.map((reg) => {
                  const paintingThisLand =
                    !worldMapSelectMode &&
                    (is2DView || activeTool === 'terrain') &&
                    store.worldMapBrushMode === 'paintLand' &&
                    store.selectedWorldLandCode === reg.code;
                  return (
                    <div
                      key={reg.id}
                      className={`flex items-center gap-1.5 p-1.5 rounded-xl border transition-colors ${
                        paintingThisLand
                          ? 'bg-emerald-500/12 border-emerald-500 ring-1 ring-emerald-500/35'
                          : 'bg-slate-50 dark:bg-[#1B1F2B] border-slate-200/70 dark:border-white/[0.06]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onWorldMapSelectModeChange(false);
                          store.setSelectedWorldLandCode(reg.code);
                          store.setWorldMapBrushMode('paintLand');
                          setTool('terrain');
                          publishGuidanceHint({
                            badge: 'Step 2 · Color Land',
                            title: `Assigning ${reg.name}`,
                            detail: `Drag across golden terrain on the map to paint ${reg.name}’s territory, then click Edit when ready to sculpt inside it.`,
                          });
                        }}
                        title="Brush this Land's territory color on the world map"
                        className="flex-1 min-w-0 flex items-center gap-2 px-1.5 py-1 text-left"
                      >
                        <span
                          className="w-4 h-4 rounded-md border border-black/25 shadow-xs shrink-0"
                          style={{ backgroundColor: reg.colorHex }}
                        />
                        <span className="text-xs font-extrabold truncate">{reg.name}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          publishGuidanceHint(null);
                          store.enterWorldEditorScope(reg.levelId);
                        }}
                        title={`Enter ${reg.name} to sculpt terrain and place objects`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#6D4AFF] hover:bg-[#5B3DF5] text-white text-[11px] font-bold shrink-0 whitespace-nowrap"
                      >
                        <span>Edit</span>
                        <ArrowRight size={11} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex gap-1.5 pt-1">
              <input
                type="text"
                value={newLandName}
                onChange={(e) => setNewLandName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateLand();
                }}
                placeholder={`Land ${wmRegions.length + 1} name…`}
                className="flex-1 min-w-0 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1B1F2B] border border-slate-200/80 dark:border-white/[0.08] text-xs font-semibold focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={handleCreateLand}
                className="px-3 py-1.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-extrabold inline-flex items-center gap-1 shrink-0 whitespace-nowrap shadow-xs"
              >
                <Plus size={12} />
                <span>Add Land</span>
              </button>
            </div>
          </div>
        </div>
      </aside>
    );
  }

  // --- MODE 2: LAND / LEVEL SCOPE ---
  const primaryTabLabel = isPlatformer
    ? 'Platformer Kit'
    : isDriving
    ? 'Garage & Track'
    : envType === 'openWorld'
    ? 'Land Elements'
    : 'Level Kit';

  const spawnDriveProp = (preset: PropPresetId, name: string) => {
    const spawn = currentLevel.startPoint ?? { x: 0.5, y: 0.5 };
    const count = currentLevel.entities.filter((e) => e.propPreset === preset).length;
    const step = 0.04 * (count + 1);
    const pos = {
      x: Math.max(0.1, Math.min(0.9, spawn.x + (count % 2 === 0 ? step : -step))),
      y: Math.max(0.1, Math.min(0.9, spawn.y + step)),
    };
    const created = store.addEntity('prop', name, pos);
    if (created) {
      store.updateEntity(created.id, `spawn ${name}`, (ent) => ({
        ...ent,
        propPreset: preset,
      }));
    }
  };

  const landDomainsList =
    envType === 'openWorld'
      ? is2DView
        ? OPEN_WORLD_LAND_DOMAINS.filter((d) => d.id !== 'buildings')
        : OPEN_WORLD_LAND_DOMAINS
      : ARENA_DOMAINS;

  return (
    <aside
      onPointerDownCapture={(e) =>
        publishGuidanceFromControlEvent(
          e,
          activeTab === 'atmosphere' ? 'Atmosphere' : activeTab === 'props' ? 'Props & Cast' : primaryTabLabel
        )
      }
      onFocusCapture={(e) =>
        publishGuidanceFromControlEvent(
          e,
          activeTab === 'atmosphere' ? 'Atmosphere' : activeTab === 'props' ? 'Props & Cast' : primaryTabLabel
        )
      }
      className="w-full lg:w-[296px] xl:w-[312px] shrink-0 lg:h-full lg:min-h-0 bg-white dark:bg-[#151822] border-b lg:border-b-0 lg:border-r border-slate-200/80 dark:border-white/[0.08] flex flex-col min-h-0 overflow-hidden"
    >
      {/* Top Primary Mode Switcher: Land Elements | Props & Cast | Atmosphere */}
      <div className="shrink-0 p-2 border-b border-slate-200/80 dark:border-white/[0.08] flex items-center gap-1.5 bg-slate-50/70 dark:bg-[#11141D]">
        <div className="flex-1 grid grid-cols-3 gap-0.5 p-0.5 rounded-xl bg-slate-200/75 dark:bg-[#1C212E]">
          <button
            type="button"
            onClick={() => {
              setActiveTab('build');
              publishGuidanceHint(null);
              if (store.activeWorldDomain === 'atmosphere') {
                onSelectDomain('select');
              }
            }}
            className={`py-1.5 px-1.5 rounded-lg text-[10.5px] font-extrabold transition-colors whitespace-nowrap truncate ${
              activeTab === 'build'
                ? 'bg-white dark:bg-[#272E3F] text-[#6D4AFF] dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-[#9FA8BE] hover:text-slate-900 dark:hover:text-white'
            }`}
            title={primaryTabLabel}
          >
            {primaryTabLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('props');
              publishGuidanceHint(null);
              if (store.activeWorldDomain === 'atmosphere') {
                onSelectDomain('select');
              }
            }}
            className={`py-1.5 px-1.5 rounded-lg text-[10.5px] font-extrabold transition-colors whitespace-nowrap truncate ${
              activeTab === 'props'
                ? 'bg-white dark:bg-[#272E3F] text-[#6D4AFF] dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-[#9FA8BE] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Props &amp; Cast
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('atmosphere');
              publishGuidanceHint(null);
              onSelectDomain('atmosphere');
            }}
            className={`py-1.5 px-1.5 rounded-lg text-[10.5px] font-extrabold transition-colors whitespace-nowrap truncate ${
              activeTab === 'atmosphere'
                ? 'bg-white dark:bg-[#272E3F] text-[#0284C7] dark:text-[#38BDF8] shadow-xs'
                : 'text-slate-600 dark:text-[#9FA8BE] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Atmosphere
          </button>
        </div>
        <button
          type="button"
          onClick={onCollapsePanel}
          title="Hide left panel to expand viewport"
          aria-label="Hide left panel"
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-[#949BB0] dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-[#1F2430] shrink-0"
        >
          <PanelLeftClose size={14} />
        </button>
      </div>

      {/* TAB 1: TEMPLATE-ADAPTIVE BUILD PALETTE */}
      {activeTab === 'build' ? (
        isPlatformer ? (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* Search & Category Filter */}
            <div className="shrink-0 p-2.5 border-b border-slate-200/70 dark:border-white/[0.06] space-y-2">
              <div className="relative">
                <Search
                  size={12}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  type="text"
                  value={platQuery}
                  onChange={(e) => setPlatQuery(e.target.value)}
                  placeholder="Find platforms, vines, traps…"
                  className="w-full pl-7 pr-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1B1F2B] border border-slate-200/80 dark:border-white/[0.08] text-xs font-semibold focus:outline-none focus:border-[#16A34A]"
                />
              </div>

              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setPlatCategory('all')}
                  className={`px-2 py-1 rounded-lg text-[10px] font-extrabold transition-colors ${
                    platCategory === 'all' && !platQuery.trim()
                      ? 'bg-[#6D4AFF] text-white'
                      : 'bg-slate-100 dark:bg-[#1B1F2B] text-slate-600 dark:text-[#9FA8BE]'
                  }`}
                >
                  All
                </button>
                {PLATFORMER_CATEGORY_META.map((cat) => {
                  const active = platCategory === cat.id && !platQuery.trim();
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setPlatCategory(cat.id)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-extrabold transition-colors ${
                        active
                          ? 'text-white'
                          : 'bg-slate-100 dark:bg-[#1B1F2B] text-slate-600 dark:text-[#9FA8BE]'
                      }`}
                      style={active ? { backgroundColor: cat.accent } : undefined}
                    >
                      {cat.shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Platformer Modules 2-per-row Animated Square Grid */}
            <div className="flex-1 min-h-0 overflow-y-auto maker-scroll p-2.5">
              {filteredPlatModules.length === 0 ? (
                <div className="p-4 rounded-2xl border border-dashed border-slate-300 dark:border-white/15 text-center text-xs text-slate-500 dark:text-[#8E96AB]">
                  No mechanics match “{platQuery}”.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {filteredPlatModules.map((spec) => {
                    const armed = placePlatformerModuleId === spec.id;
                    return (
                      <div
                        key={spec.id}
                        draggable
                        onMouseEnter={() => setHoveredPlatId(spec.id)}
                        onMouseLeave={() =>
                          setHoveredPlatId((prev) => (prev === spec.id ? null : prev))
                        }
                        onDragStart={(e) => {
                          e.dataTransfer.setData(PLATFORMER_MODULE_DRAG_MIME, spec.id);
                          e.dataTransfer.setData('text/plain', spec.id);
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                        className={`relative group rounded-2xl border transition-all cursor-grab active:cursor-grabbing ${
                          armed
                            ? 'bg-[#16A34A]/12 border-[#16A34A] ring-2 ring-[#16A34A]/30 text-slate-950 dark:text-white'
                            : 'bg-slate-50 dark:bg-[#1B1F2B] border-slate-200/80 dark:border-white/[0.08] hover:border-[#6D4AFF]/55 hover:bg-white dark:hover:bg-[#222737] text-slate-800 dark:text-slate-100'
                        }`}
                        title={`${spec.label}: ${spec.shortDesc}`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            const nextArmed = armed ? null : spec;
                            onSelectPlacePlatformerModule(nextArmed);
                            if (nextArmed) {
                              publishGuidanceHint({
                                badge: 'Platformer Kit',
                                title: nextArmed.label,
                                detail: `${nextArmed.shortDesc} — Click anywhere in your course to drop it, or drag straight from the tile.`,
                              });
                            } else {
                              publishGuidanceHint(null);
                            }
                          }}
                          onFocus={() => setHoveredPlatId(spec.id)}
                          onBlur={() =>
                            setHoveredPlatId((prev) => (prev === spec.id ? null : prev))
                          }
                          className="w-full p-2 flex flex-col items-center text-center focus:outline-none"
                        >
                          <div className="w-full h-[54px] rounded-xl bg-white dark:bg-[#11141D] border border-slate-200/60 dark:border-white/[0.06] flex items-center justify-center overflow-hidden text-slate-600 dark:text-slate-300 group-hover:scale-[1.03] transition-transform">
                            <PlatformerModuleAnim
                              moduleId={spec.id}
                              accent={spec.accent}
                              className="w-[84px] h-[46px]"
                            />
                          </div>
                          <span className="mt-1.5 text-[11px] font-extrabold leading-tight line-clamp-2 min-h-[26px] flex items-center justify-center">
                            {spec.label}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onQuickPlacePlatformerModule(spec);
                          }}
                          title={`Drop ${spec.label} into course`}
                          aria-label={`Quick place ${spec.label}`}
                          className={`absolute top-2.5 right-2.5 w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${
                            armed
                              ? 'opacity-100 bg-[#16A34A] border-[#16A34A] text-white shadow-xs'
                              : 'opacity-0 group-hover:opacity-100 focus:opacity-100 bg-white/95 dark:bg-[#252B3B]/95 border-slate-200/90 dark:border-white/[0.12] text-[#16A34A] hover:bg-[#16A34A] hover:text-white shadow-xs'
                          }`}
                        >
                          <Plus size={12} strokeWidth={2.6} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Live Hovered / Armed Detail Bar */}
            <div className="shrink-0 px-2.5 py-2 border-t border-slate-200/70 dark:border-white/[0.07] bg-slate-50/90 dark:bg-[#131620] min-h-[54px] flex items-center gap-2.5">
              {inspectedPlatSpec ? (
                <>
                  <div className="w-14 h-9 rounded-lg bg-white dark:bg-[#0F1117] border border-slate-200/80 dark:border-white/[0.08] flex items-center justify-center shrink-0 text-slate-600 dark:text-slate-300">
                    <PlatformerModuleAnim
                      moduleId={inspectedPlatSpec.id}
                      accent={inspectedPlatSpec.accent}
                      className="w-12 h-7"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-extrabold text-slate-900 dark:text-white truncate">
                      {inspectedPlatSpec.label}
                    </div>
                    <div className="text-[10px] leading-snug text-slate-500 dark:text-[#9FA8BE] line-clamp-2">
                      {inspectedPlatSpec.shortDesc}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-[11px] leading-snug text-slate-500 dark:text-[#8E96AB]">
                  Hover any tile to preview how it works · Click or drag into your level, or press + to drop.
                </div>
              )}
            </div>

            {/* Footer Shortcuts */}
            <div className="shrink-0 p-2.5 border-t border-slate-200/80 dark:border-white/[0.08] grid grid-cols-2 gap-1.5 bg-slate-50/70 dark:bg-[#11141D]">
              <button
                type="button"
                onClick={() => onSelectDomain('platformerKit')}
                className="px-2.5 py-2 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-[11px] font-extrabold inline-flex items-center justify-center gap-1"
              >
                <Gamepad2 size={12} />
                <span>Jump &amp; Feel</span>
              </button>
              <button
                type="button"
                onClick={onOpenLandSettings}
                className="px-2.5 py-2 rounded-xl bg-white dark:bg-[#1B1F2B] border border-slate-200/80 dark:border-white/[0.08] text-xs font-bold inline-flex items-center justify-center gap-1"
              >
                <SlidersHorizontal size={12} />
                <span>Stage Style</span>
              </button>
            </div>
          </div>
        ) : isDriving ? (
          <div className="flex-1 min-h-0 overflow-y-auto maker-scroll p-3 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-extrabold text-slate-900 dark:text-white">
                <Car size={15} className="text-[#0284C7]" />
                <span>Vehicle &amp; Handling</span>
              </div>
              <select
                value={currentLevel.drivingConfig?.carId ?? 'trailBuggy'}
                onChange={(e) =>
                  store.updateLevel('change car preset', (lvl) => ({
                    ...lvl,
                    drivingConfig: {
                      carId: e.target.value as CarPresetId,
                      physicsId: lvl.drivingConfig?.physicsId ?? 'arcadeDrift',
                      driverId: lvl.drivingConfig?.driverId ?? 'stunt',
                      cameraView: lvl.drivingConfig?.cameraView ?? 'closeChase',
                      customVehicle: lvl.drivingConfig?.customVehicle,
                    },
                  }))
                }
                className="w-full px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-[#1B1F2B] border border-slate-200/80 dark:border-white/[0.08] text-xs font-bold"
              >
                {CAR_PRESETS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                value={currentLevel.drivingConfig?.physicsId ?? 'arcadeDrift'}
                onChange={(e) =>
                  store.updateLevel('change driving physics', (lvl) => ({
                    ...lvl,
                    drivingConfig: {
                      carId: lvl.drivingConfig?.carId ?? 'trailBuggy',
                      physicsId: e.target.value as DrivingPhysicsId,
                      driverId: lvl.drivingConfig?.driverId ?? 'stunt',
                      cameraView: lvl.drivingConfig?.cameraView ?? 'closeChase',
                      customVehicle: lvl.drivingConfig?.customVehicle,
                    },
                  }))
                }
                className="w-full px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-[#1B1F2B] border border-slate-200/80 dark:border-white/[0.08] text-xs font-bold"
              >
                {DRIVING_PHYSICS_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={onOpenLandSettings}
                className="w-full px-3 py-2 rounded-xl bg-[#0284C7]/12 text-[#0284C7] dark:text-[#38BDF8] text-xs font-extrabold inline-flex items-center justify-center gap-1.5"
              >
                <SlidersHorizontal size={13} />
                <span>Wheels, Wings &amp; Colors</span>
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-slate-500 dark:text-[#8E96AB]">
                Quick Track Props
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {[
                  { preset: 'boostPad' as PropPresetId, label: 'Add Boost Pad', color: '#06B6D4' },
                  { preset: 'ramp' as PropPresetId, label: 'Add Stunt Ramp', color: '#D97706' },
                  { preset: 'roadBarrier' as PropPresetId, label: 'Add Hazard Barrier', color: '#EF4444' },
                  { preset: 'checkpointArch' as PropPresetId, label: 'Add Rally Arch', color: '#16A34A' },
                  { preset: 'flightCube' as PropPresetId, label: 'Add Flight Cube', color: '#6D4AFF' },
                ].map((item) => (
                  <button
                    key={item.preset}
                    type="button"
                    onClick={() => spawnDriveProp(item.preset, item.label.replace('Add ', ''))}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1B1F2B] border border-slate-200/70 dark:border-white/[0.06] hover:border-slate-300 dark:hover:border-white/20 text-xs font-bold"
                  >
                    <span>{item.label}</span>
                    <Plus size={13} style={{ color: item.color }} />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-slate-200/70 dark:border-white/[0.06]">
              <div className="text-[11px] font-bold text-slate-500 dark:text-[#8E96AB]">
                Terrain &amp; Scenery
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {OPEN_WORLD_LAND_DOMAINS.map((d) => {
                  const Icon = d.Icon;
                  const active = store.activeWorldDomain === d.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => onSelectDomain(d.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-[11px] font-bold transition-colors ${
                        active
                          ? 'text-white border-transparent'
                          : 'bg-slate-50 dark:bg-[#1B1F2B] border-slate-200/70 dark:border-white/[0.06] text-slate-700 dark:text-slate-200'
                      }`}
                      style={active ? { backgroundColor: d.accent } : undefined}
                    >
                      <Icon size={13} />
                      <span className="truncate">{d.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* Standard Open World / Floating Island / Dungeon / Castle / Sci-Fi Left Elements Palette */
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto maker-scroll p-3 space-y-1.5">
              <div className="text-[11px] font-bold text-slate-500 dark:text-[#8E96AB] px-0.5 pb-0.5">
                {envType === 'openWorld'
                  ? `Form ${currentLevel.name}`
                  : 'Structure & Mechanics'}
              </div>

              {landDomainsList.map((d) => {
                const Icon = d.Icon;
                const active = store.activeWorldDomain === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => onSelectDomain(d.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                      active
                        ? 'text-white border-transparent shadow-sm'
                        : 'bg-slate-50 dark:bg-[#1B1F2B] border-slate-200/70 dark:border-white/[0.06] text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-white/20'
                    }`}
                    style={active ? { backgroundColor: d.accent } : undefined}
                  >
                    <span
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={
                        active
                          ? { backgroundColor: 'rgba(255,255,255,0.2)', color: '#FFFFFF' }
                          : { backgroundColor: `${d.accent}1A`, color: d.accent }
                      }
                    >
                      <Icon size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-extrabold leading-tight">{d.label}</div>
                      <div
                        className={`text-[11px] truncate ${
                          active ? 'text-white/85' : 'text-slate-500 dark:text-[#8E96AB]'
                        }`}
                      >
                        {d.hint}
                      </div>
                    </div>
                  </button>
                );
              })}

              {envType === 'openWorld' && (
                <button
                  type="button"
                  onClick={() => onSelectDomain('platformerKit')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                    store.activeWorldDomain === 'platformerKit'
                      ? 'bg-[#16A34A] text-white border-transparent shadow-sm'
                      : 'bg-slate-50 dark:bg-[#1B1F2B] border-slate-200/70 dark:border-white/[0.06] text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-white/20'
                  }`}
                >
                  <span
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={
                      store.activeWorldDomain === 'platformerKit'
                        ? { backgroundColor: 'rgba(255,255,255,0.2)', color: '#FFFFFF' }
                        : { backgroundColor: '#16A34A1A', color: '#16A34A' }
                    }
                  >
                    <Gamepad2 size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-extrabold leading-tight">Platformer Kit</div>
                    <div
                      className={`text-[11px] truncate ${
                        store.activeWorldDomain === 'platformerKit'
                          ? 'text-white/85'
                          : 'text-slate-500 dark:text-[#8E96AB]'
                      }`}
                    >
                      Movers, vines, traps &amp; pads
                    </div>
                  </div>
                </button>
              )}
            </div>

            {/* Clean Footer Actions */}
            <div className="shrink-0 p-2.5 border-t border-slate-200/80 dark:border-white/[0.08] grid grid-cols-2 gap-1.5 bg-slate-50/70 dark:bg-[#11141D]">
              <button
                type="button"
                onClick={() => store.setShowingFxLibrary(!store.showingFxLibrary)}
                className={`px-2.5 py-2 rounded-xl border text-[11px] font-bold inline-flex items-center justify-center gap-1 transition-colors ${
                  store.showingFxLibrary
                    ? 'bg-[#F59E0B] border-[#F59E0B] text-white'
                    : 'bg-white dark:bg-[#1B1F2B] border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-200'
                }`}
              >
                <Sparkles size={12} />
                <span>FX Library</span>
              </button>
              <button
                type="button"
                onClick={onOpenLandSettings}
                className="px-2.5 py-2 rounded-xl bg-white dark:bg-[#1B1F2B] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 text-[11px] font-bold inline-flex items-center justify-center gap-1 hover:border-[#6D4AFF]/50"
              >
                <SlidersHorizontal size={12} />
                <span>Land Rules</span>
              </button>
            </div>
          </div>
        )
      ) : activeTab === 'atmosphere' ? (
        /* TAB 3: ATMOSPHERE ATTRIBUTES (Paired with Right Contextual Controls) */
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto maker-scroll p-2.5 space-y-1.5">
            <div className="text-[11px] font-bold text-slate-500 dark:text-[#8E96AB] px-0.5 pb-0.5">
              Select an attribute to tune on the right
            </div>
            {ATMOSPHERE_ATTRIBUTES.map((attr) => {
              const Icon = attr.Icon;
              const active = atmosphereSection === attr.id && store.activeWorldDomain === 'atmosphere';
              return (
                <button
                  key={attr.id}
                  type="button"
                  onClick={() => {
                    onSelectAtmosphereSection?.(attr.id);
                    onSelectDomain('atmosphere');
                    publishGuidanceHint({
                      badge: 'Atmosphere',
                      title: attr.label,
                      detail: `${attr.hint} — adjust the live sliders and presets in the right panel.`,
                    });
                  }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl border text-left transition-all ${
                    active
                      ? 'text-white border-transparent shadow-sm'
                      : 'bg-slate-50 dark:bg-[#1B1F2B] border-slate-200/70 dark:border-white/[0.06] text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-white/20'
                  }`}
                  style={active ? { backgroundColor: attr.accent } : undefined}
                >
                  <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={
                      active
                        ? { backgroundColor: 'rgba(255,255,255,0.2)', color: '#FFFFFF' }
                        : { backgroundColor: `${attr.accent}1A`, color: attr.accent }
                    }
                  >
                    <Icon size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-extrabold leading-tight">{attr.label}</div>
                    <div
                      className={`text-[10.5px] truncate ${
                        active ? 'text-white/85' : 'text-slate-500 dark:text-[#8E96AB]'
                      }`}
                    >
                      {attr.hint}
                    </div>
                  </div>
                </button>
              );
            })}

            {currentLevel && (
              <div className="pt-1.5">
                <AtmospherePreviewViewport
                  level={currentLevel}
                  postProcessing={store.currentProject?.postProcessing}
                  activeSection={atmosphereSection}
                />
              </div>
            )}
          </div>

          <div className="shrink-0 p-2.5 border-t border-slate-200/80 dark:border-white/[0.08] grid grid-cols-2 gap-1.5 bg-slate-50/70 dark:bg-[#11141D]">
            <button
              type="button"
              onClick={() => store.setShowingSkybox(true)}
              className="px-2.5 py-2 rounded-xl bg-white dark:bg-[#1B1F2B] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 text-[11px] font-bold inline-flex items-center justify-center gap-1 hover:border-[#0EA5E9]"
            >
              <Sun size={12} className="text-[#0EA5E9]" />
              <span>Skybox Modal</span>
            </button>
            <button
              type="button"
              onClick={() => store.setShowingPostFx(true)}
              className="px-2.5 py-2 rounded-xl bg-white dark:bg-[#1B1F2B] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 text-[11px] font-bold inline-flex items-center justify-center gap-1 hover:border-[#EC4899]"
            >
              <Film size={12} className="text-[#EC4899]" />
              <span>Post FX</span>
            </button>
          </div>
        </div>
      ) : (
        /* TAB 2: PROPS & CAST (Asset Library + In Scene Contents) */
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="shrink-0 px-2.5 pt-2 pb-1.5 border-b border-slate-200/70 dark:border-white/[0.06] flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setPropsSubTab('assets');
                publishGuidanceHint({
                  badge: 'Props & Cast',
                  title: 'Asset Vault',
                  detail: 'Drag any prop, character, tree, or creature straight into the 3D scene and drop it anywhere.',
                });
              }}
              className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-bold transition-colors ${
                propsSubTab === 'assets'
                  ? 'bg-[#6D4AFF]/15 text-[#6D4AFF] dark:text-[#C4B5FD]'
                  : 'text-slate-500 dark:text-[#8E96AB] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Asset Vault ({store.customAssets.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setPropsSubTab('scene');
                publishGuidanceHint({
                  badge: 'Props & Cast',
                  title: 'In This Land',
                  detail: 'Click any placed hero, NPC, lake, or object below to jump the camera straight to it and edit its rules.',
                });
              }}
              className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-bold transition-colors ${
                propsSubTab === 'scene'
                  ? 'bg-[#6D4AFF]/15 text-[#6D4AFF] dark:text-[#C4B5FD]'
                  : 'text-slate-500 dark:text-[#8E96AB] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              In This Land
            </button>
          </div>

          {propsSubTab === 'assets' ? (
            <LeftAssetsPanel
              store={store}
              embedded
              activePlacementAssetId={activePlacementAssetId}
              hideBuildingsSection={is2DView}
              onSelectPlacementAsset={(asset) => {
                onSelectPlacementAsset(asset.id);
                publishGuidanceHint({
                  badge: 'Props & Cast',
                  title: `Placing ${asset.name}`,
                  detail: 'Drag onto the 3D world and drop anywhere, or click directly on the ground to place a copy.',
                });
              }}
              onEditAssetInObjectMaker={(assetId) => store.openObjectMaker(assetId)}
              onEditAssetInPlantMaker={(assetId) => store.openPlantMaker(assetId)}
              onEditAssetInCharacterMaker={(assetId) => store.openCharacterMaker(assetId)}
              onEditAssetInTreeMaker={(assetId) => store.openTreeMaker(assetId)}
              onCreateNewObject={() => store.openObjectMaker()}
              onCreateNewPlant={() => store.openPlantMaker()}
              onCreateNewCharacter={() => store.openCharacterMaker()}
              onCreateNewTree={() => store.openTreeMaker()}
              onCreateNewBuilding={() => onSelectDomain('buildings')}
              onSwitchToLevelPanel={() => setPropsSubTab('scene')}
              onCollapseLeftPanel={onCollapsePanel}
            />
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto maker-scroll p-3 space-y-3.5">
              {renderSceneContents()}
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
