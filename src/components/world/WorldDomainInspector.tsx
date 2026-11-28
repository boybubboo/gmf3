import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Box,
  Crosshair,
  Flower2,
  Globe,
  MapPin,
  MessageCircle,
  Mountain,
  Paintbrush,
  Pencil,
  Plus,
  Route,
  Save,
  Shapes,
  SlidersHorizontal,
  Sparkles,
  Sprout,
  Trash2,
  Trees,
  User,
  Waves,
} from 'lucide-react';
import { EntityKindMeta } from '../../data/registries';
import type { MakerStore } from '../../store/useMakerStore';
import { HERO_START_ENTITY_ID } from '../../types/maker';
import type {
  BeamOrientation,
  BuildingBlockConfig,
  BuildingMaterialId,
  BuildingShapeId,
  CaveGrotto,
  CaveSurfacePresetId,
  CurveGuideConfig,
  CurveGuidePresetId,
  DirtAndRoadConfig,
  DirtNoiseKind,
  DoorConfig,
  DoorFrameShape,
  DoorLeafStyle,
  DoorOpenMode,
  DoorSlotStyle,
  EntityMaterialVariant,
  FenceStyleId,
  FloraScatterSettings,
  GrassFieldConfig,
  GrassQuality,
  LevelEntity,
  MountainNoiseType,
  MountainProfileConfig,
  ProceduralTerrainConfig,
  PropPresetId,
  RoadBorderScatterKind,
  RoadSpline,
  RockPatternKind,
  RockShapeKind,
  RoofStyleId,
  TerrainBrush,
  TerrainBrushFalloff,
  ViewportTool,
  VistaPropKind,
  WaterBodyConfig,
} from '../../types/maker';
import {
  BUILDING_MATERIALS,
  BUILDING_SHAPES,
  DEFAULT_DOOR_CONFIG,
  buildBuildingBlockMesh,
  getBuildingShapeBaseSize,
  inferRoofStyleFromMaterial,
  roofStyleToMaterial,
} from '../../three/buildingBlocks';
import { computeCurveLength } from '../../three/curveGuide';
import { renderObject3DThumbnail } from '../../three/gltfAssetManager';
import { disposeObject3D } from '../../three/islandScene';
import { WEATHERING_PRESETS } from '../../three/nodeMaterialUtils';
import {
  buildAndExportObjectDocToGlb,
  createSavePlinthObjectDoc,
  exportObjectGroupToGlbBuffer,
} from '../../three/objectMakerBuilder';
import { resolveGrassConfig } from '../../three/stylizedGrassSystem';
import { applyVertexPaintStrokesToObject } from '../../three/vertexPainter';
import {
  IslandTerrain,
  applyCaveSurfacePresetValues,
  applyRoadSplineToTerrain,
  applySlopeAutoWeathering,
  carveWaterBodyIntoTerrain,
  createDefaultDirtAndRoadConfig,
  createDefaultMountainConfig,
  createDefaultWaterBodies,
  createInitialTerrain,
  getEnvironmentType,
  levelBoardToWorld,
  sampleTerrainHeight,
} from '../../utils/terrain';
import {
  PROCEDURAL_TERRAIN_PRESETS,
  createDefaultProceduralConfig,
  generateProceduralTerrainFromConfig,
  normalizeProceduralConfig,
} from '../../utils/proceduralTerrain';
import {
  PlatformerModuleInspector,
  PlatformerMovementInspector,
} from './PlatformerInspectorSection';
import {
  LAND_REGION_PALETTE,
  WORLD_BORDER_GRAY,
  WORLD_TERRAIN_YELLOW,
  type WorldMapBrushMode,
} from '../../utils/worldMap';
import { isSavePlinthEntity } from '../../utils/worldMapFog';
import {
  clearDefaultTreeStyle,
  getTreeStyleChoiceCatalog,
  saveDefaultTreeStyle,
  setAutoApplyDefaultTreeStyles,
  useDefaultTreeStyles,
  type SpawnTreeCategory,
} from '../../utils/defaultTreeStyles';
import { AssetThumbnail } from '../shared/AssetThumbnail';
import { CanopyTreeInspector } from '../shared/CanopyTreeInspector';
import { FxEmitterInspector } from '../shared/FxEmitterInspector';
import { FieldLabel, MakerCard } from '../shared/MakerUI';
import {
  type AtmosphereSectionId,
  publishGuidanceFromControlEvent,
} from '../../utils/editorPrefs';
import {
  ROCK_CLASS_META,
  ROCK_PATTERN_OPTIONS,
  ROCK_SHAPE_OPTIONS,
  resolveFloraScatterSettings,
} from '../../three/rockBuilder';
import {
  FLOWER_STARTER_RECIPES,
  PLANT_STARTER_PRESETS,
} from '../../three/plantMakerBuilder';
import {
  FX_LIBRARY_CATEGORY_LABELS,
  type FxLibraryCategory,
  type FxLibraryTemplate,
} from '../../data/fxEffectLibrary';
import { FX_DRAG_MIME } from './FxLibraryPanel';
import { AtmosphereInspectorPanel } from './AtmosphereInspectorPanel';

export interface ActiveBlockToolAdjustments {
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  edgeWear: number;
  rotation: number;
  scale: number;
  archStyle?: 'arched' | 'rectangular';
  windowStyle?: 'open' | 'barred' | 'shuttered' | 'paned';
  roofStyle?: RoofStyleId;
  roofMedievalTruss?: boolean;
  beamOrientation?: BeamOrientation;
  fenceStyle?: FenceStyleId;
  doorConfig?: DoorConfig;
  materialVariant?: EntityMaterialVariant;
}

export interface WorldDomainInspectorProps {
  store: MakerStore;
  activeTool: ViewportTool;
  setTool: (t: ViewportTool) => void;
  brush: TerrainBrush;
  setBrush: (b: TerrainBrush) => void;
  brushRadius: number;
  setBrushRadius: (r: number) => void;
  activeScatterAssetId: string;
  setScatterAssetId: (id: string) => void;
  addPaletteMode: 'blocks' | 'entities';
  activeBuildShape: BuildingShapeId | 'door' | 'rusticDoor';
  setActiveBuildShape: (s: BuildingShapeId | 'door' | 'rusticDoor') => void;
  activeBuildMaterial: BuildingMaterialId;
  setActiveBuildMaterial: (m: BuildingMaterialId) => void;
  keepToolAdjustments: boolean;
  toggleKeepToolAdjustments: () => void;
  activeBlockAdjustments: ActiveBlockToolAdjustments;
  setActiveBlockAdjustments: React.Dispatch<React.SetStateAction<ActiveBlockToolAdjustments>>;
  captureEntityIntoActiveTool: (ent: LevelEntity) => void;
  curveGuideEnabled: boolean;
  setCurveGuideEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  buildingCurve: CurveGuideConfig;
  setBuildingCurve: React.Dispatch<React.SetStateAction<CurveGuideConfig>>;
  curveSpan: number;
  setCurveSpan: (v: number) => void;
  curveBend: number;
  setCurveBend: (v: number) => void;
  curvePickMode: boolean;
  setCurvePickMode: React.Dispatch<React.SetStateAction<boolean>>;
  curveBlockCount: number;
  setCurveBlockCount: (v: number) => void;
  applyBuildingCurvePreset: (preset: CurveGuidePresetId, span?: number, bend?: number) => void;
  handleStampBuildingCurveBlocks: () => void;
  placementGhostSize: [number, number, number];
  onOpenChatBubbleForEntity: (entityId: string) => void;
  onTriggerFxBurst: (entityId: string) => void;
  onSaveEntityToFxLibrary: (entity: LevelEntity) => void;
  onAddVistaItem: (kind: VistaPropKind, customAssetId?: string, customLabel?: string) => void;
  atmosphereSection?: AtmosphereSectionId;
  allFxTemplates?: FxLibraryTemplate[];
  placeFxTemplateId?: string | null;
  onSelectPlaceFxTemplate?: (template: FxLibraryTemplate | null) => void;
  onQuickPlaceFxCenter?: (template: FxLibraryTemplate) => void;
  onDragStartFxTemplate?: (template: FxLibraryTemplate) => void;
  onDragEndFxTemplate?: () => void;
  isPlacingHero?: boolean;
  onStartPlaceHero?: () => void;
}

export const WorldDomainInspector: React.FC<WorldDomainInspectorProps> = ({
  store,
  activeTool,
  setTool,
  brush,
  setBrush,
  brushRadius,
  setBrushRadius,
  activeScatterAssetId,
  setScatterAssetId,
  addPaletteMode,
  activeBuildShape,
  setActiveBuildShape,
  activeBuildMaterial,
  setActiveBuildMaterial,
  keepToolAdjustments,
  toggleKeepToolAdjustments,
  activeBlockAdjustments,
  setActiveBlockAdjustments,
  captureEntityIntoActiveTool,
  curveGuideEnabled,
  setCurveGuideEnabled,
  buildingCurve,
  setBuildingCurve,
  curveSpan,
  setCurveSpan,
  curveBend,
  setCurveBend,
  curvePickMode,
  setCurvePickMode,
  curveBlockCount,
  setCurveBlockCount,
  applyBuildingCurvePreset,
  handleStampBuildingCurveBlocks,
  placementGhostSize,
  onOpenChatBubbleForEntity,
  onTriggerFxBurst,
  onSaveEntityToFxLibrary,
  onAddVistaItem,
  atmosphereSection = 'skyTime',
  allFxTemplates = [],
  placeFxTemplateId = null,
  onSelectPlaceFxTemplate,
  onQuickPlaceFxCenter,
  onDragStartFxTemplate,
  onDragEndFxTemplate,
  isPlacingHero,
  onStartPlaceHero,
}) => {
  const { currentLevel, currentEntity, currentProject } = store;
  const [savingBuildingAsset, setSavingBuildingAsset] = useState(false);
  const [savedBuildingAssetNote, setSavedBuildingAssetNote] = useState<string | null>(null);
  const [newLandName, setNewLandName] = useState('');
  const [appliedTreeDefaultsNote, setAppliedTreeDefaultsNote] = useState<'current' | 'all' | null>(null);
  const [fxCategoryFilter, setFxCategoryFilter] = useState<FxLibraryCategory>('all');
  const defaultTreePrefs = useDefaultTreeStyles();

  const domain = store.activeWorldDomain;
  const controlHintBadge = domain === 'atmosphere' ? 'Atmosphere Control' : 'Control Tip';
  const terrain = useMemo(
    () => currentLevel?.terrain ?? createInitialTerrain(),
    [currentLevel?.terrain]
  );

  if (!currentLevel || !currentProject) return null;

  if (domain === 'atmosphere') {
    return (
      <aside
        onPointerDownCapture={(e) =>
          publishGuidanceFromControlEvent(e, controlHintBadge)
        }
        onFocusCapture={(e) =>
          publishGuidanceFromControlEvent(e, controlHintBadge)
        }
        className="w-full lg:w-76 shrink-0 lg:h-full lg:min-h-0 bg-white dark:bg-[#171A23] border-t lg:border-t-0 lg:border-l border-slate-200/80 dark:border-white/[0.08] lg:overflow-y-auto maker-scroll p-4 space-y-4"
      >
        <AtmosphereInspectorPanel
          store={store}
          section={atmosphereSection}
          onAddVistaItem={onAddVistaItem}
        />
      </aside>
    );
  }

  const envType = getEnvironmentType(currentLevel);

  // --- WORLD MAP OVERVIEW INSPECTOR ---
  if (envType === 'openWorld' && store.worldEditorScope === 'worldMap') {
    const wm = store.resolvedWorldMap;
    const regions = wm?.regions ?? [];
    const selectedRegion = regions.find((r) => r.code === store.selectedWorldLandCode) ?? null;

    const wmBrushes: { id: WorldMapBrushMode; label: string; accent: string; note: string }[] = [
      { id: 'terrain', label: 'Terrain', accent: WORLD_TERRAIN_YELLOW, note: 'Paint landmass' },
      {
        id: 'paintLand',
        label: 'Land Color',
        accent: selectedRegion?.colorHex ?? '#20B46A',
        note: selectedRegion ? selectedRegion.name : 'Pick a Land below',
      },
      { id: 'eraseTerrain', label: 'Erase Land', accent: '#F2545B', note: 'Carve to ocean' },
      { id: 'clearLand', label: 'Unassign', accent: '#94A3B8', note: 'Keep yellow land' },
    ];

    const handleCreateLand = () => {
      const created = store.addWorldLandRegion(newLandName.trim() || undefined);
      setNewLandName('');
      if (created) {
        setTool('terrain');
      }
    };

    const handleCustomizePlinthInEditor = async (targetEntity?: LevelEntity) => {
      const existingId = targetEntity?.customAssetId ?? currentProject.savePlinthAssetId;
      const existingMeta = existingId
        ? store.customAssets.find((a) => a.id === existingId && Boolean(a.objectRecipe))
        : undefined;
      if (existingMeta) {
        store.openObjectMaker(existingMeta.id);
        return;
      }
      const doc = createSavePlinthObjectDoc();
      const { buffer, root } = await buildAndExportObjectDocToGlb(doc);
      disposeObject3D(root);
      const saved = await store.saveGeneratedAsset({
        name: 'Save / Spawn Plinth',
        category: 'prop',
        buffer,
        objectRecipe: doc,
        keepMetricScale: true,
      });
      store.updateProject(
        'link custom save plinth asset',
        (proj) => ({ ...proj, savePlinthAssetId: saved.id }),
        false
      );
      if (targetEntity) {
        store.updateEntity(
          targetEntity.id,
          'assign custom save plinth',
          (ent) => ({ ...ent, propPreset: 'savePlinth', customAssetId: saved.id }),
          false
        );
      }
      store.openObjectMaker(saved.id);
    };

    return (
      <aside
      onPointerDownCapture={(e) =>
        publishGuidanceFromControlEvent(e, controlHintBadge)
      }
      onFocusCapture={(e) =>
        publishGuidanceFromControlEvent(e, controlHintBadge)
      }
      className="w-full lg:w-76 shrink-0 lg:h-full lg:min-h-0 bg-white dark:bg-[#171A23] border-t lg:border-t-0 lg:border-l border-slate-200/80 dark:border-white/[0.08] lg:overflow-y-auto maker-scroll p-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Globe size={16} style={{ color: WORLD_TERRAIN_YELLOW }} />
            <h2 className="text-sm font-extrabold">World Map Planner</h2>
          </div>
          <span className="text-[10px] font-bold text-slate-400 tabular-nums">
            {regions.length} {regions.length === 1 ? 'Land' : 'Lands'}
          </span>
        </div>

        <p className="text-[11px] text-slate-500 dark:text-[#949BB0] leading-relaxed">
          Block out continents and islands across the <strong className="text-slate-700 dark:text-slate-200">1280m × 1280m</strong> world (4× Land size) in yellow <strong className="text-slate-700 dark:text-slate-200">Terrain</strong>, assign a color to each <strong className="text-slate-700 dark:text-slate-200">312m</strong> Land, then select any Land to terraform it.
        </p>

        {/* World Map Brushes */}
        <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2.5">
          <FieldLabel text="Geography Brushes" />
          <div className="grid grid-cols-2 gap-1.5">
            {wmBrushes.map((b) => {
              const active = activeTool === 'terrain' && store.worldMapBrushMode === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    setTool('terrain');
                    store.setWorldMapBrushMode(b.id);
                    if (b.id === 'paintLand' && !selectedRegion && regions.length > 0) {
                      store.setSelectedWorldLandCode(regions[0].code);
                    }
                  }}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-left border transition-colors ${
                    active
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-xs'
                      : 'bg-white dark:bg-[#171A23] border-transparent text-slate-700 dark:text-[#C8D0E4] hover:border-slate-300 dark:hover:border-white/15'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-sm border border-black/20 shrink-0"
                    style={{ backgroundColor: b.accent }}
                  />
                  <span className="min-w-0">
                    <span className="block text-[11px] font-extrabold leading-tight truncate">
                      {b.label}
                    </span>
                    <span className="block text-[9px] opacity-70 truncate">{b.note}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <label className="flex items-center justify-between gap-2 text-[11px] font-semibold cursor-pointer pt-1">
            <span>Auto-create land on ocean</span>
            <input
              type="checkbox"
              checked={store.worldMapAutoLand}
              onChange={(e) => store.setWorldMapAutoLand(e.target.checked)}
              className="accent-[#20B46A] w-3.5 h-3.5"
            />
          </label>

          <div className="pt-1">
            <div className="flex justify-between text-[11px] font-bold mb-1">
              <span>Brush Size</span>
              <span className="tabular-nums text-[#7C5CFF]">{brushRadius}m</span>
            </div>
            <input
              type="range"
              min={6}
              max={120}
              step={2}
              value={brushRadius}
              onChange={(e) => setBrushRadius(Number(e.target.value))}
              className="w-full accent-[#7C5CFF]"
            />
          </div>
        </div>

        {/* In-Game World Map & Save Plinth Options */}
        <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2.5">
          <FieldLabel text="In-Game Map &amp; Fast Travel" />
          <label className="flex items-start justify-between gap-2.5 text-[11px] font-semibold cursor-pointer">
            <span className="min-w-0">
              <span className="block font-bold text-slate-800 dark:text-slate-100">
                Fog of War (Hide Untravelled Areas)
              </span>
              <span className="block text-[10px] text-slate-500 dark:text-[#949BB0] mt-0.5">
                When ON, only visited areas show in color on both minimap and M World Map.
              </span>
            </span>
            <input
              type="checkbox"
              checked={Boolean(currentProject.worldMapFogOfWar)}
              onChange={(e) =>
                store.updateProject('toggle map fog of war', (proj) => ({
                  ...proj,
                  worldMapFogOfWar: e.target.checked,
                }))
              }
              className="accent-[#38BDF8] w-4 h-4 mt-0.5 shrink-0"
            />
          </label>
          <button
            type="button"
            onClick={() => void handleCustomizePlinthInEditor()}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#0EA5E9]/15 hover:bg-[#0EA5E9]/25 text-[#0284C7] dark:text-[#38BDF8] text-[11px] font-extrabold transition-colors"
          >
            <Shapes size={13} />
            <span>Customize Save Plinth Look</span>
          </button>
        </div>

        {/* Named Lands / Levels */}
        <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2.5">
          <div className="flex items-center justify-between">
            <FieldLabel text="Lands &amp; Levels" />
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: WORLD_BORDER_GRAY }}
              title="Bordering lands appear gray when editing one land"
            />
          </div>

          <div className="flex gap-1.5">
            <input
              type="text"
              value={newLandName}
              onChange={(e) => setNewLandName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateLand();
              }}
              placeholder={`Land ${regions.length + 1} name…`}
              className="flex-1 min-w-0 px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-xs font-semibold border border-slate-200/80 dark:border-white/[0.08] outline-none focus:border-[#7C5CFF]"
            />
            <button
              type="button"
              onClick={handleCreateLand}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#7C5CFF] hover:bg-[#6D4CFF] text-white text-[11px] font-extrabold shrink-0"
            >
              <Plus size={12} />
              <span>New</span>
            </button>
          </div>

          {regions.length === 0 ? (
            <div className="p-3 rounded-xl bg-white/80 dark:bg-[#171A23]/80 text-[11px] text-slate-500 dark:text-[#949BB0] space-y-1">
              <p className="font-semibold text-slate-700 dark:text-slate-200">
                No named Lands yet
              </p>
              <p>
                Paint yellow <strong>Terrain</strong> first, then click <strong>+ New</strong> to
                color-code and name your first Land or Level.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {regions.map((reg) => {
                const isSelected = store.selectedWorldLandCode === reg.code;
                return (
                  <div
                    key={reg.id}
                    className={`p-2.5 rounded-xl border transition-colors space-y-2 ${
                      isSelected
                        ? 'bg-white dark:bg-[#171A23] border-[#7C5CFF]'
                        : 'bg-white/75 dark:bg-[#171A23]/75 border-transparent hover:border-slate-300 dark:hover:border-white/15'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          store.setSelectedWorldLandCode(reg.code);
                          store.setWorldMapBrushMode('paintLand');
                          setTool('terrain');
                        }}
                        title={`Paint ${reg.name} on the world map`}
                        className="w-5 h-5 rounded-lg shrink-0 border border-black/20 flex items-center justify-center"
                        style={{ backgroundColor: reg.colorHex }}
                      />
                      <input
                        type="text"
                        value={reg.name}
                        onChange={(e) =>
                          store.updateWorldLandRegion(reg.id, { name: e.target.value })
                        }
                        onFocus={() => store.setSelectedWorldLandCode(reg.code)}
                        className="flex-1 min-w-0 px-1.5 py-0.5 rounded-lg bg-transparent hover:bg-slate-100 dark:hover:bg-[#1F2430] focus:bg-slate-100 dark:focus:bg-[#1F2430] text-xs font-bold outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => store.enterWorldEditorScope(reg.levelId)}
                        title={`Terraform & populate ${reg.name}`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#7C5CFF]/12 hover:bg-[#7C5CFF] text-[#7C5CFF] hover:text-white text-[10px] font-extrabold shrink-0 transition-colors"
                      >
                        <span>Edit</span>
                        <ArrowRight size={10} />
                      </button>
                      <button
                        type="button"
                        onClick={() => store.deleteWorldLandRegion(reg.id)}
                        title="Remove Land assignment"
                        className="p-1 rounded-lg text-slate-400 hover:text-[#F2545B] shrink-0"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    {isSelected && (
                      <div className="space-y-1.5 pt-0.5">
                        <div className="flex flex-wrap items-center gap-1">
                          {LAND_REGION_PALETTE.map((hex) => (
                            <button
                              key={hex}
                              type="button"
                              onClick={() => store.updateWorldLandRegion(reg.id, { colorHex: hex })}
                              className={`w-4 h-4 rounded-md border ${
                                reg.colorHex.toUpperCase() === hex.toUpperCase()
                                  ? 'border-slate-900 dark:border-white scale-110'
                                  : 'border-black/20 opacity-80 hover:opacity-100'
                              }`}
                              style={{ backgroundColor: hex }}
                              title={`Color ${hex}`}
                            />
                          ))}
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-white/[0.06] text-[10px]">
                          <span className="font-semibold text-slate-500 dark:text-[#949BB0]">
                            Playable Area Scope
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const nextR = reg.worldRadius === 640 ? undefined : 640;
                              store.updateWorldLandRegion(reg.id, { worldRadius: nextR });
                            }}
                            className={`px-2 py-0.5 rounded-md font-extrabold text-[10px] transition-colors ${
                              reg.worldRadius === 640
                                ? 'bg-[#20B46A] text-white shadow-xs'
                                : 'bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-white/15'
                            }`}
                            title="Toggle between standard land and full 1280m x 1280m world map area"
                          >
                            {reg.worldRadius === 640 ? 'Full World (1280m)' : 'Auto / Standard'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    );
  }

  const selectedEntityCustom = currentEntity?.customAssetId
    ? store.customAssets.find((a) => a.id === currentEntity.customAssetId) ?? null
    : null;

  const focusEntityCamera = (ent: LevelEntity) => {
    const [wx, wz] = levelBoardToWorld(currentLevel, ent.position);
    const wy = sampleTerrainHeight(terrain, wx, wz) + (ent.elevationY ?? 0);
    store.focusCameraOnWorldPoint({
      id: ent.id,
      x: wx,
      y: wy + 1.2,
      z: wz,
      distance: 16,
    });
  };

  // --- DOMAIN: MOUNTAINS & CLIFFS ---
  if (domain === 'mountains') {
    const mc: MountainProfileConfig = terrain.mountainConfig ?? createDefaultMountainConfig();
    const patchMountain = (label: string, patch: Partial<MountainProfileConfig>, recordUndo = false) => {
      store.updateLevel(
        label,
        (lvl) => {
          const base = lvl.terrain ?? createInitialTerrain();
          return {
            ...lvl,
            terrain: {
              ...base,
              mountainConfig: {
                ...(base.mountainConfig ?? createDefaultMountainConfig()),
                ...patch,
              },
            },
          };
        },
        recordUndo
      );
    };
    const pCfg = normalizeProceduralConfig(terrain.proceduralConfig);
    const patchProcedural = (
      label: string,
      patch: Partial<ProceduralTerrainConfig>,
      recordUndo = false
    ) => {
      store.updateLevel(
        label,
        (lvl) => {
          const base = lvl.terrain ?? createInitialTerrain();
          return {
            ...lvl,
            terrain: {
              ...base,
              proceduralConfig: normalizeProceduralConfig({
                ...(base.proceduralConfig ?? createDefaultProceduralConfig()),
                ...patch,
              }),
            },
          };
        },
        recordUndo
      );
    };
    const shapeBrushes: { id: TerrainBrush; label: string }[] = [
      { id: 'terrain', label: 'Expand Terrain' },
      { id: 'raiseGround', label: 'Raise Peak' },
      { id: 'lowerGround', label: 'Carve Valley' },
      { id: 'smoothGround', label: 'Smooth' },
      { id: 'flattenGround', label: 'Flatten' },
      { id: 'plateauCliff', label: 'Plateau' },
      { id: 'proceduralRidge', label: 'Ridge Stamp' },
      { id: 'proceduralMesa', label: 'Mesa Steps' },
      { id: 'proceduralCrag', label: 'Warped Crag' },
      { id: 'hydraulicErosion', label: 'Erode Water' },
      { id: 'weatherCracks', label: 'Cracks' },
      { id: 'weatherErode', label: 'Erode Cliff' },
      { id: 'paintRock', label: 'Paint Rock' },
      { id: 'paintSnow', label: 'Paint Snow' },
    ];
    return (
      <aside
      onPointerDownCapture={(e) =>
        publishGuidanceFromControlEvent(e, controlHintBadge)
      }
      onFocusCapture={(e) =>
        publishGuidanceFromControlEvent(e, controlHintBadge)
      }
      className="w-full lg:w-76 shrink-0 lg:h-full lg:min-h-0 bg-white dark:bg-[#171A23] border-t lg:border-t-0 lg:border-l border-slate-200/80 dark:border-white/[0.08] lg:overflow-y-auto maker-scroll p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mountain size={16} className="text-[#F59E0B]" />
            <h2 className="text-sm font-extrabold">Mountains &amp; Cliffs</h2>
          </div>
          <button
            type="button"
            onClick={() => store.setShowingTerrainEditor(true)}
            className="text-[11px] font-bold text-[#7C5CFF] hover:underline"
          >
            Heightmap Studio
          </button>
        </div>

        {/* Sculpt & Paint Brushes */}
        <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2.5">
          <FieldLabel text="Sculpt & Slope Brushes" />
          <div className="grid grid-cols-3 gap-1">
            {shapeBrushes.map((b) => {
              const active = activeTool === 'terrain' && brush === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    setTool('terrain');
                    setBrush(b.id);
                  }}
                  className={`py-1.5 px-1.5 rounded-xl text-[10px] font-bold border transition-colors ${
                    active
                      ? 'bg-[#F59E0B] border-[#F59E0B] text-white'
                      : 'bg-white dark:bg-[#171A23] border-transparent text-slate-600 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {b.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => store.erodeAllMountains(0.95)}
            className="w-full py-1.5 px-2.5 rounded-xl text-[11px] font-bold bg-sky-500/12 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/25 transition-colors"
          >
            Erode Mountains (Hydraulic + Scree)
          </button>

          <div className="grid grid-cols-4 gap-1">
            {(['smooth', 'dome', 'peak', 'plateau'] as TerrainBrushFalloff[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => store.setTerrainBrushFalloff(f)}
                className={`py-1 rounded-lg text-[10px] font-bold capitalize ${
                  store.terrainBrushFalloff === f
                    ? 'bg-[#7C5CFF] text-white'
                    : 'bg-white dark:bg-[#171A23] text-slate-500 dark:text-[#949BB0]'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <label className="block space-y-0.5">
              <div className="flex justify-between text-[11px] font-semibold">
                <span>Brush Radius</span>
                <span className="tabular-nums">{brushRadius.toFixed(0)}m</span>
              </div>
              <input
                type="range"
                min={2}
                max={26}
                step={0.5}
                value={brushRadius}
                onChange={(e) => setBrushRadius(Number(e.target.value))}
                className="w-full accent-[#F59E0B]"
              />
            </label>
            <label className="block space-y-0.5">
              <div className="flex justify-between text-[11px] font-semibold">
                <span>Strength</span>
                <span className="tabular-nums">{Math.round(store.terrainBrushStrength * 100)}%</span>
              </div>
              <input
                type="range"
                min={0.15}
                max={1.5}
                step={0.05}
                value={store.terrainBrushStrength}
                onChange={(e) => store.setTerrainBrushStrength(Number(e.target.value))}
                className="w-full accent-[#F59E0B]"
              />
            </label>
          </div>

          {/* Minimal Sculpt Mode / Hide Scenery While Terraforming */}
          <div className="pt-2 border-t border-slate-200/70 dark:border-white/[0.06] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Fast Sculpt Performance
              </span>
            </div>
            <label className="flex items-center justify-between text-[11px] font-semibold cursor-pointer">
              <span>Auto-hide scenery while painting</span>
              <input
                type="checkbox"
                checked={(window as unknown as { __makerHideSceneryOnSculpt?: boolean }).__makerHideSceneryOnSculpt === true}
                onChange={(e) => {
                  (window as unknown as { __makerHideSceneryOnSculpt?: boolean }).__makerHideSceneryOnSculpt =
                    e.target.checked;
                  store.updateLevel('toggle auto-hide scenery on sculpt', (l) => ({ ...l }), false);
                }}
                className="accent-[#F59E0B] w-3.5 h-3.5"
              />
            </label>
            <label className="flex items-center justify-between text-[11px] font-semibold cursor-pointer">
              <span>Hide all scenery now (Clay View)</span>
              <input
                type="checkbox"
                checked={Boolean((window as unknown as { __makerMinimalSculptAlways?: boolean }).__makerMinimalSculptAlways)}
                onChange={(e) => {
                  (window as unknown as { __makerMinimalSculptAlways?: boolean }).__makerMinimalSculptAlways =
                    e.target.checked;
                  store.updateLevel('toggle minimal sculpt clay view', (l) => ({ ...l }), false);
                }}
                className="accent-[#F59E0B] w-3.5 h-3.5"
              />
            </label>
          </div>
        </div>

        {/* Elevation Band & Layer Transition Controls */}
        <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2.5">
          <FieldLabel text="Elevation Layers & Blending" />
          <label className="block space-y-0.5">
            <div className="flex justify-between text-[11px] font-semibold">
              <span>Rock Band Start</span>
              <span className="tabular-nums text-slate-500">{mc.rockStartHeight.toFixed(1)}m</span>
            </div>
            <input
              type="range"
              min={1.5}
              max={12}
              step={0.2}
              value={mc.rockStartHeight}
              onChange={(e) => patchMountain('adjust rock height', { rockStartHeight: Number(e.target.value) })}
              className="w-full accent-[#7C5CFF]"
            />
          </label>
          <label className="block space-y-0.5">
            <div className="flex justify-between text-[11px] font-semibold">
              <span>Snow Cap Height</span>
              <span className="tabular-nums text-slate-500">{mc.snowStartHeight.toFixed(1)}m</span>
            </div>
            <input
              type="range"
              min={4}
              max={20}
              step={0.2}
              value={mc.snowStartHeight}
              onChange={(e) => patchMountain('adjust snow height', { snowStartHeight: Number(e.target.value) })}
              className="w-full accent-[#38BDF8]"
            />
          </label>
          <label className="block space-y-0.5">
            <div className="flex justify-between text-[11px] font-semibold">
              <span>Layer Transition (Sharp ↔ Gradual)</span>
              <span className="tabular-nums text-slate-500">{Math.round(mc.bandTransition * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.05}
              max={1.0}
              step={0.02}
              value={mc.bandTransition}
              onChange={(e) => patchMountain('adjust band transition', { bandTransition: Number(e.target.value) })}
              className="w-full accent-[#20B46A]"
            />
          </label>
          <label className="block space-y-0.5">
            <div className="flex justify-between text-[11px] font-semibold">
              <span>Cliff Roughness</span>
              <span className="tabular-nums text-slate-500">{Math.round(mc.roughness * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.1}
              max={1.0}
              step={0.02}
              value={mc.roughness}
              onChange={(e) => patchMountain('adjust cliff roughness', { roughness: Number(e.target.value) })}
              className="w-full accent-[#F59E0B]"
            />
          </label>
        </div>

        {/* Organic Noise & Weathering */}
        <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2.5">
          <FieldLabel text="Organic Noise & Degrade" />
          <label className="block space-y-1">
            <span className="text-[10px] font-bold text-slate-500 dark:text-[#949BB0]">
              Noise Algorithm
            </span>
            <select
              value={mc.noiseType}
              onChange={(e) =>
                patchMountain('change mountain noise', { noiseType: e.target.value as MountainNoiseType }, true)
              }
              className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-xs font-semibold"
            >
              <option value="fbm">Fractal FBM (Rolling Alpine)</option>
              <option value="ridged">Ridged Crest (Sharp Peaks)</option>
              <option value="billow">Billow Outcrops (Soft Hills)</option>
              <option value="terraced">Terraced Mesas (Layered Rock)</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-0.5">
              <div className="flex justify-between text-[10px] font-semibold">
                <span>Noise Scale</span>
                <span className="tabular-nums">{mc.noiseScale.toFixed(1)}×</span>
              </div>
              <input
                type="range"
                min={0.3}
                max={3.0}
                step={0.1}
                value={mc.noiseScale}
                onChange={(e) => patchMountain('adjust noise scale', { noiseScale: Number(e.target.value) })}
                className="w-full accent-[#7C5CFF]"
              />
            </label>
            <label className="space-y-0.5">
              <div className="flex justify-between text-[10px] font-semibold">
                <span>Randomness</span>
                <span className="tabular-nums">{Math.round(mc.randomness * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={mc.randomness}
                onChange={(e) => patchMountain('adjust randomness', { randomness: Number(e.target.value) })}
                className="w-full accent-[#F59E0B]"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() =>
              store.updateLevel('auto-weather cliffs', (lvl) => ({
                ...lvl,
                terrain: applySlopeAutoWeathering(
                  lvl.terrain ?? createInitialTerrain(),
                  store.terrainBrushStrength
                ),
              }))
            }
            className="w-full py-2 rounded-xl bg-[#20B46A]/15 hover:bg-[#20B46A]/25 text-[#20B46A] text-xs font-extrabold"
          >
            Auto-Weather Steep Slopes
          </button>
        </div>

        {/* Triplanar Cliff Shader & Procedural Generator */}
        <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2.5">
          <FieldLabel text="Triplanar & Micro-Detail Shader" />
          <label className="block space-y-0.5">
            <div className="flex justify-between text-[11px] font-semibold">
              <span>Triplanar Cliff Strata</span>
              <span className="tabular-nums text-[#EA580C]">{Math.round(pCfg.triplanarStrength * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.05}
              value={pCfg.triplanarStrength}
              onChange={(e) => patchProcedural('adjust triplanar strength', { triplanarStrength: Number(e.target.value) })}
              className="w-full accent-[#EA580C]"
            />
          </label>
          <label className="block space-y-0.5">
            <div className="flex justify-between text-[11px] font-semibold">
              <span>Micro-Normal Relief</span>
              <span className="tabular-nums text-[#7C5CFF]">{Math.round(pCfg.microNormalStrength * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.05}
              value={pCfg.microNormalStrength}
              onChange={(e) => patchProcedural('adjust micro normal strength', { microNormalStrength: Number(e.target.value) })}
              className="w-full accent-[#7C5CFF]"
            />
          </label>
          <label className="block space-y-0.5">
            <div className="flex justify-between text-[11px] font-semibold">
              <span>Cliff Slope Threshold</span>
              <span className="tabular-nums text-[#F59E0B]">{Math.round(pCfg.cliffSlopeThreshold * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.18}
              max={0.85}
              step={0.02}
              value={pCfg.cliffSlopeThreshold}
              onChange={(e) => patchProcedural('adjust cliff threshold', { cliffSlopeThreshold: Number(e.target.value) })}
              className="w-full accent-[#F59E0B]"
            />
          </label>
          <div className="flex items-center gap-1.5 pt-0.5">
            <select
              value={pCfg.presetId}
              onChange={(e) => {
                const chosen = PROCEDURAL_TERRAIN_PRESETS.find((p) => p.id === e.target.value);
                if (chosen) patchProcedural('select procedural preset', chosen.config, true);
              }}
              className="flex-1 min-w-0 px-2 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-[11px] font-bold"
            >
              {PROCEDURAL_TERRAIN_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() =>
                store.updateLevel('generate procedural landform', (lvl) => ({
                  ...lvl,
                  terrain: generateProceduralTerrainFromConfig(
                    lvl.terrain ?? createInitialTerrain(),
                    pCfg,
                    lvl
                  ),
                }))
              }
              className="px-2.5 py-1.5 rounded-xl bg-[#EA580C] text-white text-[11px] font-extrabold shrink-0"
            >
              Generate
            </button>
          </div>
        </div>
      </aside>
    );
  }

  // --- DOMAIN: WATER BODIES (LAKES, RIVERS, STREAMS) ---
  if (domain === 'water') {
    const waterBodies = terrain.waterBodies ?? createDefaultWaterBodies();
    const selectedWb =
      waterBodies.find((wb) => wb.id === store.selectedWaterBodyId) ?? waterBodies[0] ?? null;

    const patchSelectedWb = (
      _label: string,
      patch: Partial<WaterBodyConfig>,
      recordUndo = false,
      recarveTerrain = false
    ) => {
      if (!selectedWb) return;
      store.updateWaterBody(selectedWb.id, patch, recarveTerrain, recordUndo);
    };

    const addNewWater = (kind: 'lake' | 'river') => {
      const cx = Math.round((Math.random() - 0.5) * 55);
      const cz = Math.round((Math.random() - 0.5) * 55);
      store.addWaterBody(kind, [cx, cz]);
    };

    return (
      <aside
      onPointerDownCapture={(e) =>
        publishGuidanceFromControlEvent(e, controlHintBadge)
      }
      onFocusCapture={(e) =>
        publishGuidanceFromControlEvent(e, controlHintBadge)
      }
      className="w-full lg:w-76 shrink-0 lg:h-full lg:min-h-0 bg-white dark:bg-[#171A23] border-t lg:border-t-0 lg:border-l border-slate-200/80 dark:border-white/[0.08] lg:overflow-y-auto maker-scroll p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Waves size={16} className="text-[#0EA5E9]" />
            <h2 className="text-sm font-extrabold">Water &amp; Shores</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => addNewWater('lake')}
              className="px-2 py-1 rounded-lg bg-[#0EA5E9]/15 text-[#0EA5E9] text-[10px] font-extrabold hover:bg-[#0EA5E9]/25"
            >
              + Lake
            </button>
            <button
              type="button"
              onClick={() => addNewWater('river')}
              className="px-2 py-1 rounded-lg bg-[#2A9D8F]/15 text-[#2A9D8F] text-[10px] font-extrabold hover:bg-[#2A9D8F]/25"
            >
              + River
            </button>
          </div>
        </div>

        {/* Selectable Water Bodies */}
        <div className="space-y-1 max-h-36 overflow-y-auto maker-scroll">
          {waterBodies.map((wb) => {
            const active = selectedWb?.id === wb.id;
            return (
              <button
                key={wb.id}
                type="button"
                onClick={() => {
                  store.setSelectedWaterBodyId(wb.id);
                  store.focusCameraOnWorldPoint({
                    id: wb.id,
                    x: wb.center[0],
                    y: IslandTerrain.waterLevel,
                    z: wb.center[1],
                    distance: 32,
                  });
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-left text-xs font-bold border transition-colors ${
                  active
                    ? 'bg-[#0EA5E9]/15 border-[#0EA5E9]/50 text-[#0284C7] dark:text-[#38BDF8]'
                    : 'bg-slate-50 dark:bg-[#1F2430] border-transparent text-slate-700 dark:text-[#C8D0E4]'
                }`}
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0 border border-white/30"
                  style={{ backgroundColor: wb.waterColor }}
                />
                <span className="truncate flex-1">{wb.name}</span>
                <span className="text-[10px] uppercase opacity-70">{wb.kind}</span>
              </button>
            );
          })}
        </div>

        {/* Water Sculpt Brushes */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => {
              setTool('terrain');
              setBrush('paintWaterLake');
            }}
            className={`py-1.5 rounded-xl text-[11px] font-bold border ${
              activeTool === 'terrain' && brush === 'paintWaterLake'
                ? 'bg-[#0EA5E9] border-[#0EA5E9] text-white'
                : 'bg-slate-100 dark:bg-[#1F2430] border-transparent'
            }`}
          >
            Carve Lake Basin
          </button>
          <button
            type="button"
            onClick={() => {
              setTool('terrain');
              setBrush('carveRiver');
            }}
            className={`py-1.5 rounded-xl text-[11px] font-bold border ${
              activeTool === 'terrain' && brush === 'carveRiver'
                ? 'bg-[#0EA5E9] border-[#0EA5E9] text-white'
                : 'bg-slate-100 dark:bg-[#1F2430] border-transparent'
            }`}
          >
            Carve River Bed
          </button>
        </div>

        {/* River & Lake Brush Size + Minimal Sculpt Scenery Toggle */}
        <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2">
          <label className="block space-y-0.5">
            <div className="flex justify-between text-[11px] font-semibold">
              <span>Water Carve Brush Size</span>
              <span className="tabular-nums">{brushRadius.toFixed(1)}m</span>
            </div>
            <input
              type="range"
              min={2}
              max={24}
              step={0.5}
              value={brushRadius}
              onChange={(e) => setBrushRadius(Number(e.target.value))}
              className="w-full accent-[#0EA5E9]"
            />
          </label>
          <label className="flex items-center justify-between text-[11px] font-semibold cursor-pointer">
            <span>Hide all scenery now (Clay View)</span>
            <input
              type="checkbox"
              checked={Boolean((window as unknown as { __makerMinimalSculptAlways?: boolean }).__makerMinimalSculptAlways)}
              onChange={(e) => {
                (window as unknown as { __makerMinimalSculptAlways?: boolean }).__makerMinimalSculptAlways =
                  e.target.checked;
                store.updateLevel('toggle minimal sculpt clay view', (l) => ({ ...l }), false);
              }}
              className="accent-[#0EA5E9] w-3.5 h-3.5"
            />
          </label>
        </div>

        {selectedWb && (
          <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2.5">
            <input
              type="text"
              value={selectedWb.name}
              onChange={(e) => patchSelectedWb('rename water body', { name: e.target.value })}
              className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-xs font-extrabold"
            />

            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-[11px] font-semibold">
                <span>Surface</span>
                <input
                  type="color"
                  value={selectedWb.waterColor}
                  onChange={(e) => patchSelectedWb('tint water', { waterColor: e.target.value })}
                  className="w-6 h-5 rounded border-0 bg-transparent cursor-pointer"
                />
              </label>
              <label className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-[11px] font-semibold">
                <span>Deep Murk</span>
                <input
                  type="color"
                  value={selectedWb.deepMurkColor}
                  onChange={(e) => patchSelectedWb('tint deep murk', { deepMurkColor: e.target.value })}
                  className="w-6 h-5 rounded border-0 bg-transparent cursor-pointer"
                />
              </label>
            </div>

            {[
              { key: 'opacity', label: 'Opacity', min: 0.25, max: 1, step: 0.02, fmt: (v: number) => `${Math.round(v * 100)}%` },
              { key: 'depth', label: 'Depth Murk', min: 0.3, max: 5, step: 0.1, fmt: (v: number) => `${v.toFixed(1)}m` },
              { key: 'foamAmount', label: 'Edge Foam', min: 0, max: 1.5, step: 0.05, fmt: (v: number) => `${Math.round(v * 100)}%` },
              { key: 'waveSpeed', label: 'Wave Speed', min: 0, max: 2.5, step: 0.05, fmt: (v: number) => `${v.toFixed(2)}×` },
              { key: 'windRipple', label: 'Wind Ripple', min: 0, max: 2.0, step: 0.05, fmt: (v: number) => `${Math.round(v * 100)}%` },
              { key: 'flowSpeed', label: 'Current Flow', min: 0, max: 3.0, step: 0.05, fmt: (v: number) => `${v.toFixed(1)}×` },
              { key: 'flowAngleDeg', label: 'Flow Heading', min: 0, max: 360, step: 5, fmt: (v: number) => `${Math.round(v)}°` },
            ].map((s) => {
              const val = Number((selectedWb as unknown as Record<string, number>)[s.key] ?? 0);
              return (
                <label key={s.key} className="block space-y-0.5">
                  <div className="flex justify-between text-[11px] font-semibold">
                    <span>{s.label}</span>
                    <span className="tabular-nums text-slate-500">{s.fmt(val)}</span>
                  </div>
                  <input
                    type="range"
                    min={s.min}
                    max={s.max}
                    step={s.step}
                    value={val}
                    onChange={(e) =>
                      patchSelectedWb(`adjust ${s.label}`, { [s.key]: Number(e.target.value) })
                    }
                    className="w-full accent-[#0EA5E9]"
                  />
                </label>
              );
            })}

            <div className="pt-2 border-t border-slate-200/70 dark:border-white/[0.06] space-y-2">
              <FieldLabel text="Bank & Shoreline Sculpt" />
              <label className="block space-y-0.5">
                <div className="flex justify-between text-[10px] font-semibold">
                  <span>Slope (Steep ↔ Gradual)</span>
                  <span className="tabular-nums">{Math.round(selectedWb.bankSlope * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.15}
                  max={1.0}
                  step={0.05}
                  value={selectedWb.bankSlope}
                  onChange={(e) => patchSelectedWb('bank slope', { bankSlope: Number(e.target.value) })}
                  className="w-full accent-[#20B46A]"
                />
              </label>
              <label className="block space-y-0.5">
                <div className="flex justify-between text-[10px] font-semibold">
                  <span>Shoreline Noise</span>
                  <span className="tabular-nums">{Math.round(selectedWb.shoreNoise * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1.0}
                  step={0.05}
                  value={selectedWb.shoreNoise}
                  onChange={(e) => patchSelectedWb('shore noise', { shoreNoise: Number(e.target.value) })}
                  className="w-full accent-[#20B46A]"
                />
              </label>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    store.updateLevel(`re-carve banks for ${selectedWb.name}`, (lvl) => ({
                      ...lvl,
                      terrain: carveWaterBodyIntoTerrain(
                        lvl.terrain ?? createInitialTerrain(),
                        selectedWb
                      ),
                    }))
                  }
                  className="flex-1 py-1.5 rounded-xl bg-[#0EA5E9] text-white text-[11px] font-extrabold"
                >
                  Apply Banks to Terrain
                </button>
                {waterBodies.length > 1 && (
                  <button
                    type="button"
                    onClick={() => store.deleteWaterBody(selectedWb.id)}
                    className="p-2 rounded-xl bg-[#F2545B]/15 text-[#F2545B] hover:bg-[#F2545B]/25"
                    title="Delete water body"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </aside>
    );
  }

  // --- DOMAIN: CAVES & GROTTOS ---
  if (domain === 'caves') {
    const caves = terrain.caves ?? [];
    const selectedCave = caves.find((c) => c.id === store.selectedCaveId) ?? caves[0] ?? null;

    const patchCave = (_label: string, patch: Partial<CaveGrotto>, recordUndo = false) => {
      if (!selectedCave) return;
      store.updateCaveGrotto(selectedCave.id, patch, recordUndo);
    };

    const winFlags = window as unknown as {
      __makerDisableCaveXRay?: boolean;
      __makerForceScareCaveId?: string | null;
    };
    const isXRayOn = winFlags.__makerDisableCaveXRay !== true;

    const caveBrushes: Array<{ id: TerrainBrush; label: string; color: string }> = [
      { id: 'carveCave', label: 'Carve Tunnel', color: '#38BDF8' },
      { id: 'cavePaintMoss', label: 'Paint Moss', color: '#4D8B4C' },
      { id: 'cavePaintPuddles', label: 'Paint Puddles', color: '#0EA5E9' },
      { id: 'cavePaintGrass', label: 'Paint Grass', color: '#22C55E' },
      { id: 'cavePaintStalactites', label: 'Stalactites', color: '#94A3B8' },
      { id: 'cavePaintCrystals', label: 'Crystals', color: '#67E8F9' },
      { id: 'cavePlaceDrips', label: 'Add Drips', color: '#38BDF8' },
      { id: 'cavePlaceBats', label: 'Add Bats', color: '#A855F7' },
      { id: 'cavePlaceTorch', label: 'Add Torch', color: '#F97316' },
    ];

    const surfacePresets: Array<{ id: CaveSurfacePresetId; label: string }> = [
      { id: 'mossyDrip', label: 'Mossy Drip Cavern' },
      { id: 'crystalSanctum', label: 'Crystal Sanctum' },
      { id: 'floodedPuddle', label: 'Flooded Puddle Grotto' },
      { id: 'stalactiteVault', label: 'Stalactite Vault' },
      { id: 'lushGrotto', label: 'Lush Overgrown Grotto' },
    ];

    return (
      <aside
      onPointerDownCapture={(e) =>
        publishGuidanceFromControlEvent(e, controlHintBadge)
      }
      onFocusCapture={(e) =>
        publishGuidanceFromControlEvent(e, controlHintBadge)
      }
      className="w-full lg:w-76 shrink-0 lg:h-full lg:min-h-0 bg-white dark:bg-[#171A23] border-t lg:border-t-0 lg:border-l border-slate-200/80 dark:border-white/[0.08] lg:overflow-y-auto maker-scroll p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mountain size={16} className="text-[#A855F7]" />
            <h2 className="text-sm font-extrabold">Caves &amp; Grottos</h2>
          </div>
          <button
            type="button"
            onClick={() => {
              setTool('terrain');
              setBrush('carveCave');
            }}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold ${
              activeTool === 'terrain' && brush === 'carveCave'
                ? 'bg-[#38BDF8] text-slate-950'
                : 'bg-[#38BDF8]/15 text-[#38BDF8]'
            }`}
          >
            Carve Tunnel
          </button>
        </div>

        {/* Live X-Ray Mountain Cave Carver & Fast Sculpt Performance */}
        <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-cyan-600 dark:text-cyan-300">
              X-Ray Mountain Carver View
            </span>
            <button
              type="button"
              onClick={() => {
                winFlags.__makerDisableCaveXRay = isXRayOn;
                store.updateLevel('toggle cave x-ray view', (l) => ({ ...l }), false);
              }}
              className={`px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold ${
                isXRayOn
                  ? 'bg-cyan-400 text-slate-950'
                  : 'bg-slate-200 dark:bg-[#272D3D] text-slate-600 dark:text-slate-300'
              }`}
            >
              {isXRayOn ? 'X-Ray ON' : 'X-Ray OFF'}
            </button>
          </div>
          <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-snug">
            Click a mountain and drag smoothly to sketch a live 3D tunnel curve (<span className="text-cyan-500 font-bold">cyan</span> = deep inside, <span className="text-amber-500 font-bold">amber</span> = thin wall, <span className="text-emerald-500 font-bold">green</span> = open exit). Release to build the full cavern; press <span className="font-bold">Esc</span> to cancel mid-drag.
          </p>
          <div className="pt-1.5 border-t border-cyan-500/20 space-y-1">
            <label className="flex items-center justify-between text-[11px] font-bold cursor-pointer">
              <span>Auto-hide scenery while sculpting</span>
              <input
                type="checkbox"
                checked={(window as unknown as { __makerHideSceneryOnSculpt?: boolean }).__makerHideSceneryOnSculpt === true}
                onChange={(e) => {
                  (window as unknown as { __makerHideSceneryOnSculpt?: boolean }).__makerHideSceneryOnSculpt =
                    e.target.checked;
                  store.updateLevel('toggle auto-hide scenery on sculpt', (l) => ({ ...l }), false);
                }}
                className="accent-cyan-400 w-3.5 h-3.5"
              />
            </label>
            <label className="flex items-center justify-between text-[11px] font-bold cursor-pointer">
              <span>Hide all scenery now (Clay View)</span>
              <input
                type="checkbox"
                checked={Boolean((window as unknown as { __makerMinimalSculptAlways?: boolean }).__makerMinimalSculptAlways)}
                onChange={(e) => {
                  (window as unknown as { __makerMinimalSculptAlways?: boolean }).__makerMinimalSculptAlways =
                    e.target.checked;
                  store.updateLevel('toggle minimal sculpt clay view', (l) => ({ ...l }), false);
                }}
                className="accent-cyan-400 w-3.5 h-3.5"
              />
            </label>
          </div>
        </div>

        {/* Cave Carver & Multi-Surface Hand-Paint Brush Palette + Brush Size Settings */}
        <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2.5">
          <FieldLabel text="Cave Carving & Hand-Paint Brushes" />
          <div className="grid grid-cols-3 gap-1.5">
            {caveBrushes.map((b) => {
              const active = activeTool === 'terrain' && brush === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    setTool('terrain');
                    setBrush(b.id);
                  }}
                  className={`px-2 py-1.5 rounded-xl text-[10px] font-bold border transition ${
                    active
                      ? 'bg-[#A855F7] border-[#A855F7] text-white shadow-sm'
                      : 'bg-white dark:bg-[#171A23] border-transparent text-slate-700 dark:text-[#C8D0E4] hover:border-slate-300'
                  }`}
                >
                  {b.label}
                </button>
              );
            })}
          </div>

          {/* Direct Brush Size, Quick Tunnel Presets, Falloff & Strength inside Caves Panel */}
          <div className="pt-2 border-t border-slate-200/70 dark:border-white/[0.06] space-y-2">
            <FieldLabel text="Cave Brush Size & Tunnel Width" />
            <div className="grid grid-cols-4 gap-1">
              {[
                { r: 3.5, label: '3.5m Narrow' },
                { r: 5.0, label: '5m Tunnel' },
                { r: 8.0, label: '8m Cavern' },
                { r: 12.0, label: '12m Hall' },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setTool('terrain');
                    setBrushRadius(preset.r);
                  }}
                  className={`py-1 rounded-lg text-[10px] font-bold border ${
                    Math.abs(brushRadius - preset.r) < 0.4
                      ? 'bg-[#38BDF8]/20 border-[#38BDF8] text-[#0284C7] dark:text-[#38BDF8]'
                      : 'bg-white dark:bg-[#171A23] border-transparent text-slate-600 dark:text-[#949BB0]'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <label className="block space-y-0.5">
              <div className="flex justify-between text-[11px] font-semibold">
                <span>Brush Radius (Tunnel Size)</span>
                <span className="tabular-nums text-[#38BDF8] font-bold">{brushRadius.toFixed(1)}m</span>
              </div>
              <input
                type="range"
                min={2.5}
                max={16}
                step={0.5}
                value={brushRadius}
                onChange={(e) => setBrushRadius(Number(e.target.value))}
                className="w-full accent-[#38BDF8]"
              />
            </label>

            <label className="block space-y-0.5">
              <div className="flex justify-between text-[11px] font-semibold">
                <span>Brush Strength</span>
                <span className="tabular-nums text-slate-500">
                  {Math.round(store.terrainBrushStrength * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0.2}
                max={1.5}
                step={0.05}
                value={store.terrainBrushStrength}
                onChange={(e) => store.setTerrainBrushStrength(Number(e.target.value))}
                className="w-full accent-[#A855F7]"
              />
            </label>

            <div className="grid grid-cols-4 gap-1">
              {(['smooth', 'dome', 'peak', 'plateau'] as TerrainBrushFalloff[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => store.setTerrainBrushFalloff(f)}
                  className={`py-1 rounded-lg text-[10px] font-bold capitalize ${
                    store.terrainBrushFalloff === f
                      ? 'bg-[#A855F7] text-white'
                      : 'bg-white dark:bg-[#171A23] text-slate-500 dark:text-[#949BB0]'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-1 max-h-36 overflow-y-auto maker-scroll">
          {caves.length === 0 ? (
            <div className="text-xs text-slate-500 p-3 rounded-xl bg-slate-100 dark:bg-[#1F2430]">
              No caves yet — select <strong>Carve Tunnel</strong> and drag inside any mountain or hillside.
            </div>
          ) : (
            caves.map((c, idx) => {
              const active = selectedCave?.id === c.id;
              const nodeCount = c.tunnelNodes?.length ?? 0;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    store.setSelectedCaveId(c.id);
                    store.focusCameraOnWorldPoint({
                      id: c.id,
                      x: c.x,
                      y: (c.floorElevation ?? sampleTerrainHeight(terrain, c.x, c.z)) + 1.5,
                      z: c.z,
                      distance: 22,
                    });
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left text-xs font-bold border ${
                    active
                      ? 'bg-[#A855F7]/15 border-[#A855F7]/50 text-[#A855F7]'
                      : 'bg-slate-50 dark:bg-[#1F2430] border-transparent text-slate-700 dark:text-[#C8D0E4]'
                  }`}
                >
                  <span className="truncate">{c.name || `Cave Grotto ${idx + 1}`}</span>
                  <span className="text-[10px] tabular-nums opacity-70">
                    {nodeCount > 0 ? `${nodeCount} segs · ` : ''}
                    {Math.round(c.x)}, {Math.round(c.z)}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {selectedCave && (
          <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-3">
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={selectedCave.name ?? 'Cave Grotto'}
                onChange={(e) => patchCave('rename cave', { name: e.target.value })}
                className="flex-1 min-w-0 px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-xs font-extrabold"
              />
              {(selectedCave.tunnelNodes?.length ?? 0) > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const trimmed = (selectedCave.tunnelNodes ?? []).slice(0, -1);
                    patchCave('undo last cave segment', { tunnelNodes: trimmed }, true);
                  }}
                  className="px-2 py-1.5 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-300 text-[10px] font-extrabold hover:bg-amber-500/25 shrink-0"
                  title="Remove last carved tunnel segment"
                >
                  Undo Seg
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  store.updateLevel(
                    'delete cave grotto',
                    (lvl) => ({
                      ...lvl,
                      terrain: {
                        ...(lvl.terrain ?? createInitialTerrain()),
                        caves: (lvl.terrain?.caves ?? []).filter((c) => c.id !== selectedCave.id),
                      },
                    }),
                    true
                  );
                }}
                className="p-1.5 rounded-xl bg-[#F2545B]/15 text-[#F2545B] hover:bg-[#F2545B]/25 shrink-0"
                title="Delete cave"
              >
                <Trash2 size={13} />
              </button>
            </div>

            {/* Cave Elevation & Position Relative to Mountain */}
            <div className="p-2.5 rounded-xl bg-white dark:bg-[#171A23] space-y-2 border border-slate-200/70 dark:border-white/[0.06]">
              <FieldLabel text="Cave Elevation & Mountain Position" />
              {(() => {
                const curFloorY =
                  selectedCave.floorElevation ??
                  selectedCave.tunnelNodes?.[0]?.floorY ??
                  Math.max(
                    IslandTerrain.waterLevel + 0.55,
                    Math.min(sampleTerrainHeight(terrain, selectedCave.x, selectedCave.z), 2.5)
                  );
                const mountainPeakH = sampleTerrainHeight(terrain, selectedCave.x, selectedCave.z);
                const applyCaveElevation = (nextY: number, recordUndo = false) => {
                  const clampedY = Number(nextY.toFixed(2));
                  const nextNodes = (selectedCave.tunnelNodes ?? []).map((n) => ({
                    ...n,
                    floorY: clampedY,
                  }));
                  patchCave(
                    'adjust cave floor elevation',
                    {
                      floorElevation: clampedY,
                      tunnelNodes: nextNodes.length > 0 ? nextNodes : selectedCave.tunnelNodes,
                    },
                    recordUndo
                  );
                };
                const shiftCavePosition = (dx: number, dz: number, recordUndo = false) => {
                  const nx = Number((selectedCave.x + dx).toFixed(2));
                  const nz = Number((selectedCave.z + dz).toFixed(2));
                  const nextNodes = (selectedCave.tunnelNodes ?? []).map((n) => ({
                    ...n,
                    x: Number((n.x + dx).toFixed(2)),
                    z: Number((n.z + dz).toFixed(2)),
                  }));
                  patchCave(
                    'shift cave position relative to mountain',
                    {
                      x: nx,
                      z: nz,
                      tunnelNodes: nextNodes.length > 0 ? nextNodes : selectedCave.tunnelNodes,
                    },
                    recordUndo
                  );
                };
                return (
                  <div className="space-y-2">
                    <label className="block space-y-0.5">
                      <div className="flex justify-between text-[11px] font-semibold">
                        <span>Floor Elevation (Y)</span>
                        <span className="tabular-nums text-[#38BDF8] font-bold">
                          {curFloorY.toFixed(1)}m{' '}
                          <span className="text-[10px] text-slate-400 font-normal">
                            (Roof {mountainPeakH.toFixed(1)}m)
                          </span>
                        </span>
                      </div>
                      <input
                        type="range"
                        min={-0.2}
                        max={16.0}
                        step={0.1}
                        value={curFloorY}
                        onChange={(e) => applyCaveElevation(Number(e.target.value), false)}
                        className="w-full accent-[#38BDF8]"
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="block space-y-0.5">
                        <div className="flex justify-between text-[10px] font-semibold">
                          <span>West / East (X)</span>
                          <span className="tabular-nums text-slate-500">{selectedCave.x.toFixed(1)}m</span>
                        </div>
                        <input
                          type="range"
                          min={-85}
                          max={85}
                          step={0.5}
                          value={selectedCave.x}
                          onChange={(e) => shiftCavePosition(Number(e.target.value) - selectedCave.x, 0, false)}
                          className="w-full accent-[#A855F7]"
                        />
                      </label>
                      <label className="block space-y-0.5">
                        <div className="flex justify-between text-[10px] font-semibold">
                          <span>North / South (Z)</span>
                          <span className="tabular-nums text-slate-500">{selectedCave.z.toFixed(1)}m</span>
                        </div>
                        <input
                          type="range"
                          min={-85}
                          max={85}
                          step={0.5}
                          value={selectedCave.z}
                          onChange={(e) => shiftCavePosition(0, Number(e.target.value) - selectedCave.z, false)}
                          className="w-full accent-[#A855F7]"
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-5 gap-1">
                      <button
                        type="button"
                        onClick={() => shiftCavePosition(-1.5, 0, true)}
                        className="py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-[10px] font-bold hover:bg-slate-200 dark:hover:bg-[#2A3040]"
                      >
                        ← West
                      </button>
                      <button
                        type="button"
                        onClick={() => shiftCavePosition(1.5, 0, true)}
                        className="py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-[10px] font-bold hover:bg-slate-200 dark:hover:bg-[#2A3040]"
                      >
                        East →
                      </button>
                      <button
                        type="button"
                        onClick={() => shiftCavePosition(0, -1.5, true)}
                        className="py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-[10px] font-bold hover:bg-slate-200 dark:hover:bg-[#2A3040]"
                      >
                        ↑ North
                      </button>
                      <button
                        type="button"
                        onClick={() => shiftCavePosition(0, 1.5, true)}
                        className="py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-[10px] font-bold hover:bg-slate-200 dark:hover:bg-[#2A3040]"
                      >
                        South ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => applyCaveElevation(1.55, true)}
                        className="py-1 rounded-lg bg-[#38BDF8]/15 text-[#0284C7] dark:text-[#38BDF8] text-[10px] font-bold hover:bg-[#38BDF8]/25"
                        title="Reset floor elevation to mountain base (1.55m)"
                      >
                        Base Y
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Multi-Surface Cave Presets */}
            <div className="space-y-1.5">
              <FieldLabel text="Multi-Surface Cave Presets" />
              <div className="grid grid-cols-2 gap-1.5">
                {surfacePresets.map((p) => {
                  const isActive = selectedCave.surfacePreset === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        patchCave(
                          `apply ${p.label} cave preset`,
                          applyCaveSurfacePresetValues(p.id),
                          true
                        )
                      }
                      className={`px-2 py-1.5 rounded-xl text-[10px] font-bold text-left border ${
                        isActive
                          ? 'border-[#A855F7] bg-[#A855F7]/15 text-[#A855F7]'
                          : 'border-transparent bg-white dark:bg-[#171A23] text-slate-700 dark:text-[#C8D0E4]'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Ground, Ceiling & Formation Mix */}
            <div className="space-y-1.5 pt-1 border-t border-slate-200/70 dark:border-white/[0.06]">
              <FieldLabel text="Ground Surfaces & Formations" />
              {[
                { key: 'mossDensity', label: 'Moss Carpet', min: 0, max: 1.5, step: 0.05, fallback: 0.65 },
                { key: 'puddleDensity', label: 'Reflective Puddles', min: 0, max: 1.5, step: 0.05, fallback: 0.45 },
                { key: 'grassDensity', label: 'Cave Grass Tufts', min: 0, max: 1.5, step: 0.05, fallback: 0.25 },
                { key: 'stalactiteDensity', label: 'Stalactites (Ceiling)', min: 0, max: 1.5, step: 0.05, fallback: 0.65 },
                { key: 'stalagmiteDensity', label: 'Stalagmites (Floor)', min: 0, max: 1.5, step: 0.05, fallback: 0.5 },
                { key: 'crystalDensity', label: 'Glowing Crystals', min: 0, max: 1.5, step: 0.05, fallback: 0.5 },
              ].map((s) => {
                const rawVal = (selectedCave as unknown as Record<string, number | undefined>)[s.key];
                const val = typeof rawVal === 'number' ? rawVal : s.fallback;
                return (
                  <label key={s.key} className="block space-y-0.5">
                    <div className="flex justify-between text-[11px] font-semibold">
                      <span>{s.label}</span>
                      <span className="tabular-nums text-slate-500">{Math.round(val * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={s.min}
                      max={s.max}
                      step={s.step}
                      value={val}
                      onChange={(e) =>
                        patchCave(`adjust ${s.label}`, {
                          surfacePreset: 'custom',
                          [s.key]: Number(e.target.value),
                        })
                      }
                      className="w-full accent-[#A855F7]"
                    />
                  </label>
                );
              })}
            </div>

            {/* Ceiling Water Drips to Puddles FX */}
            <div className="space-y-1.5 pt-2 border-t border-slate-200/70 dark:border-white/[0.06]">
              <label className="flex items-center justify-between text-xs font-bold cursor-pointer">
                <span>Ceiling Drips → Puddles FX</span>
                <input
                  type="checkbox"
                  checked={selectedCave.hasCeilingDrips !== false}
                  onChange={(e) =>
                    patchCave('toggle ceiling drips', { hasCeilingDrips: e.target.checked }, true)
                  }
                  className="accent-[#38BDF8] w-4 h-4"
                />
              </label>
              {selectedCave.hasCeilingDrips !== false && (
                <label className="block space-y-0.5">
                  <div className="flex justify-between text-[11px] font-semibold">
                    <span>Drip Frequency &amp; Ripples</span>
                    <span className="tabular-nums text-slate-500">
                      {Math.round((selectedCave.dripRate ?? 0.6) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={1.5}
                    step={0.05}
                    value={selectedCave.dripRate ?? 0.6}
                    onChange={(e) => patchCave('drip rate', { dripRate: Number(e.target.value) })}
                    className="w-full accent-[#38BDF8]"
                  />
                </label>
              )}
            </div>

            {/* Hanging Upside-Down Bats + Proximity Scare Rule */}
            <div className="space-y-2 pt-2 border-t border-slate-200/70 dark:border-white/[0.06]">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedCave.hasHangingBats !== false}
                    onChange={(e) =>
                      patchCave('toggle hanging bats', { hasHangingBats: e.target.checked }, true)
                    }
                    className="accent-[#A855F7] w-4 h-4"
                  />
                  <span>Upside-Down Hanging Bats</span>
                </label>
                {selectedCave.hasHangingBats !== false && (
                  <button
                    type="button"
                    onClick={() => {
                      winFlags.__makerForceScareCaveId = selectedCave.id;
                      window.setTimeout(() => {
                        if (winFlags.__makerForceScareCaveId === selectedCave.id) {
                          winFlags.__makerForceScareCaveId = null;
                        }
                      }, 4600);
                    }}
                    className="px-2 py-0.5 rounded-lg bg-[#A855F7] text-white text-[10px] font-extrabold hover:opacity-90"
                  >
                    Test Scare Bats!
                  </button>
                )}
              </div>

              {selectedCave.hasHangingBats !== false && (
                <>
                  <label className="block space-y-0.5">
                    <div className="flex justify-between text-[11px] font-semibold">
                      <span>Roosting Bat Count</span>
                      <span className="tabular-nums text-slate-500">{selectedCave.batCount ?? 5}</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={16}
                      step={1}
                      value={selectedCave.batCount ?? 5}
                      onChange={(e) => patchCave('bat count', { batCount: Number(e.target.value) })}
                      className="w-full accent-[#A855F7]"
                    />
                  </label>
                  <label className="block space-y-0.5">
                    <div className="flex justify-between text-[11px] font-semibold">
                      <span>Rule: Scare &amp; Fly-Away Distance</span>
                      <span className="tabular-nums text-slate-500">
                        {(selectedCave.batScareRadius ?? 6.5).toFixed(1)}m
                      </span>
                    </div>
                    <input
                      type="range"
                      min={2.5}
                      max={16}
                      step={0.5}
                      value={selectedCave.batScareRadius ?? 6.5}
                      onChange={(e) =>
                        patchCave('bat scare radius', { batScareRadius: Number(e.target.value) })
                      }
                      className="w-full accent-[#A855F7]"
                    />
                  </label>
                </>
              )}
            </div>

            {/* Wall Torches & Entrance Dimensions */}
            <div className="space-y-1.5 pt-2 border-t border-slate-200/70 dark:border-white/[0.06]">
              <FieldLabel text="Torches & Chamber Dimensions" />
              <label className="block space-y-0.5">
                <div className="flex justify-between text-[11px] font-semibold">
                  <span>Flickering Wall Torches</span>
                  <span className="tabular-nums text-slate-500">{selectedCave.torchCount ?? 2}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={8}
                  step={1}
                  value={selectedCave.torchCount ?? 2}
                  onChange={(e) => patchCave('torch count', { torchCount: Number(e.target.value) })}
                  className="w-full accent-[#F97316]"
                />
              </label>

              {[
                { key: 'entranceWidth', label: 'Entrance Width', min: 0.6, max: 2.2, step: 0.05 },
                { key: 'entranceHeight', label: 'Entrance Height', min: 0.6, max: 2.2, step: 0.05 },
                { key: 'archSharpness', label: 'Arch Sharpness', min: 0.1, max: 1.0, step: 0.05 },
                { key: 'cavityDepth', label: 'Chamber Depth', min: 0.6, max: 2.2, step: 0.05 },
                { key: 'cavityWidth', label: 'Chamber Width', min: 0.6, max: 2.2, step: 0.05 },
              ].map((s) => {
                const val = Number((selectedCave as unknown as Record<string, number>)[s.key] ?? 1);
                return (
                  <label key={s.key} className="block space-y-0.5">
                    <div className="flex justify-between text-[11px] font-semibold">
                      <span>{s.label}</span>
                      <span className="tabular-nums text-slate-500">{Math.round(val * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={s.min}
                      max={s.max}
                      step={s.step}
                      value={val}
                      onChange={(e) =>
                        patchCave(`adjust ${s.label}`, { [s.key]: Number(e.target.value) })
                      }
                      className="w-full accent-[#A855F7]"
                    />
                  </label>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] font-semibold">Crystal Color</span>
              <input
                type="color"
                value={selectedCave.crystalColor ?? '#67E8F9'}
                onChange={(e) => patchCave('crystal color', { crystalColor: e.target.value })}
                className="w-7 h-6 rounded border-0 bg-transparent cursor-pointer"
              />
            </div>

            <label className="flex items-center justify-between text-xs font-bold cursor-pointer pt-1 border-t border-slate-200/70 dark:border-white/[0.06]">
              <span>Interior Spring Pool</span>
              <input
                type="checkbox"
                checked={Boolean(selectedCave.hasSpring)}
                onChange={(e) => patchCave('toggle interior spring', { hasSpring: e.target.checked }, true)}
                className="accent-[#0EA5E9] w-4 h-4"
              />
            </label>
          </div>
        )}
      </aside>
    );
  }

  // --- DOMAIN: STYLIZED GRASS FIELD ---
  if (domain === 'grass') {
    const grassCfg = resolveGrassConfig(currentLevel.grass);
    const patchGrass = (patch: Partial<GrassFieldConfig>, recordUndo = false) => {
      store.updateLevel(
        'adjust stylized grass',
        (lvl) => ({
          ...lvl,
          grass: {
            ...resolveGrassConfig(lvl.grass),
            ...patch,
          },
        }),
        recordUndo
      );
    };
    const activeQuality: GrassQuality = grassCfg.enabled ? grassCfg.quality : 'off';
    const qualities: { id: GrassQuality; label: string }[] = [
      { id: 'off', label: 'Off' },
      { id: 'light', label: 'Light' },
      { id: 'lush', label: 'Lush' },
      { id: 'dense', label: 'Dense' },
      { id: 'ultra', label: 'Ultra' },
    ];

    return (
      <aside
      onPointerDownCapture={(e) =>
        publishGuidanceFromControlEvent(e, controlHintBadge)
      }
      onFocusCapture={(e) =>
        publishGuidanceFromControlEvent(e, controlHintBadge)
      }
      className="w-full lg:w-76 shrink-0 lg:h-full lg:min-h-0 bg-white dark:bg-[#171A23] border-t lg:border-t-0 lg:border-l border-slate-200/80 dark:border-white/[0.08] lg:overflow-y-auto maker-scroll p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sprout size={16} className="text-[#20B46A]" />
            <h2 className="text-sm font-extrabold">Grass &amp; Meadow</h2>
          </div>
          <span className="text-[11px] font-bold tabular-nums text-[#20B46A]">
            {activeQuality === 'off' ? 'Off' : `LOD ${Math.round(grassCfg.viewDistance)}m`}
          </span>
        </div>

        {/* Paint Grass / Clear Grass */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => {
              setTool('terrain');
              setBrush('paintGrass');
            }}
            className={`py-1.5 rounded-xl text-[11px] font-bold border ${
              activeTool === 'terrain' && brush === 'paintGrass'
                ? 'bg-[#20B46A] border-[#20B46A] text-white'
                : 'bg-slate-100 dark:bg-[#1F2430] border-transparent'
            }`}
          >
            Paint Grass
          </button>
          <button
            type="button"
            onClick={() => {
              setTool('terrain');
              setBrush('paintGrassErase');
            }}
            className={`py-1.5 rounded-xl text-[11px] font-bold border ${
              activeTool === 'terrain' && brush === 'paintGrassErase'
                ? 'bg-[#F2545B] border-[#F2545B] text-white'
                : 'bg-slate-100 dark:bg-[#1F2430] border-transparent'
            }`}
          >
            Clear Grass
          </button>
        </div>

        <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2.5">
          <FieldLabel text="Density & View Distance" />
          <div className="grid grid-cols-5 gap-1">
            {qualities.map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={() =>
                  patchGrass(
                    q.id === 'off' ? { enabled: false, quality: 'off' } : { enabled: true, quality: q.id },
                    true
                  )
                }
                className={`py-1.5 rounded-xl text-[10px] font-bold border ${
                  activeQuality === q.id
                    ? 'border-[#20B46A] bg-[#20B46A]/18 text-[#16A34A] dark:text-[#20B46A]'
                    : 'border-transparent bg-white dark:bg-[#171A23] text-slate-600 dark:text-[#949BB0]'
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>

          {activeQuality !== 'off' && (
            <div className="space-y-2 pt-1">
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-[11px] font-semibold">
                  <span>Primary</span>
                  <input
                    type="color"
                    value={grassCfg.primaryColor ?? '#347A38'}
                    onChange={(e) => patchGrass({ primaryColor: e.target.value })}
                    className="w-6 h-5 rounded border-0 bg-transparent cursor-pointer"
                  />
                </label>
                <label className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-[11px] font-semibold">
                  <span>Secondary</span>
                  <input
                    type="color"
                    value={grassCfg.secondaryColor ?? '#8ED14F'}
                    onChange={(e) => patchGrass({ secondaryColor: e.target.value })}
                    className="w-6 h-5 rounded border-0 bg-transparent cursor-pointer"
                  />
                </label>
              </div>

              {[
                { key: 'mixNoiseScale', label: 'Dual-Tone Mix Scale', min: 0.2, max: 3, step: 0.1, fmt: (v: number) => `${v.toFixed(1)}×` },
                { key: 'carexMix', label: 'Tall Carex / Sedge Mix', min: 0, max: 1, step: 0.05, fmt: (v: number) => `${Math.round(v * 100)}%` },
                { key: 'tuftClumpiness', label: 'Tuft Clumpiness', min: 0, max: 1, step: 0.05, fmt: (v: number) => `${Math.round(v * 100)}%` },
                { key: 'bladeHeight', label: 'Blade Height', min: 0.35, max: 1.45, step: 0.05, fmt: (v: number) => `${v.toFixed(2)}m` },
                { key: 'bladeWidth', label: 'Blade Width', min: 0.05, max: 0.18, step: 0.01, fmt: (v: number) => `${v.toFixed(2)}m` },
                { key: 'viewDistance', label: 'View Distance LOD', min: 30, max: 85, step: 2, fmt: (v: number) => `${Math.round(v)}m` },
                { key: 'windWaveStrength', label: 'Wind Wave Flow', min: 0.2, max: 2.0, step: 0.1, fmt: (v: number) => `${Math.round(v * 100)}%` },
                { key: 'tipGlow', label: 'Tip Sun Glow', min: 0, max: 1.2, step: 0.05, fmt: (v: number) => `${Math.round(v * 100)}%` },
              ].map((s) => {
                const val = Number((grassCfg as unknown as Record<string, number>)[s.key] ?? 0.5);
                return (
                  <label key={s.key} className="block space-y-0.5">
                    <div className="flex justify-between text-[11px] font-semibold">
                      <span>{s.label}</span>
                      <span className="tabular-nums text-slate-500">{s.fmt(val)}</span>
                    </div>
                    <input
                      type="range"
                      min={s.min}
                      max={s.max}
                      step={s.step}
                      value={val}
                      onChange={(e) => patchGrass({ [s.key]: Number(e.target.value) })}
                      className="w-full accent-[#20B46A]"
                    />
                  </label>
                );
              })}

              <label className="flex items-center justify-between text-[11px] font-semibold cursor-pointer pt-1">
                <span>Part grass around hero</span>
                <input
                  type="checkbox"
                  checked={grassCfg.interactiveParting}
                  onChange={(e) => patchGrass({ interactiveParting: e.target.checked }, true)}
                  className="accent-[#20B46A]"
                />
              </label>
            </div>
          )}
        </div>

        {/* Grass-to-Dirt Overhanging Sod Underlayer (Creek Banks & Drop-Offs) */}
        <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2.5">
          <FieldLabel text="Grass-to-Dirt Overhanging Underlayer" />
          <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
            Adds a thick fibrous grassy sod lip and root-undercut overhang shadow where grass meets dirt trails or steep creek banks.
          </p>
          <label className="flex items-center justify-between text-[11px] font-bold cursor-pointer">
            <span>3D Overhanging Sod Ledge</span>
            <input
              type="checkbox"
              checked={grassCfg.underlayerOverhang !== false}
              onChange={(e) => patchGrass({ underlayerOverhang: e.target.checked }, true)}
              className="accent-[#20B46A] w-4 h-4"
            />
          </label>
          <label className="block space-y-0.5">
            <div className="flex justify-between text-[11px] font-semibold">
              <span>Overhang Lip Thickness</span>
              <span className="tabular-nums text-slate-500">
                {Math.round((grassCfg.underlayerThickness ?? 0.88) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.25}
              max={1.5}
              step={0.05}
              value={grassCfg.underlayerThickness ?? 0.88}
              onChange={(e) => patchGrass({ underlayerThickness: Number(e.target.value) })}
              className="w-full accent-[#20B46A]"
            />
          </label>
          <label className="block space-y-0.5">
            <div className="flex justify-between text-[11px] font-semibold">
              <span>Turf Edge &amp; Undercut Depth</span>
              <span className="tabular-nums text-slate-500">
                {Math.round((grassCfg.underlayerContrast ?? 0.92) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.05}
              value={grassCfg.underlayerContrast ?? 0.92}
              onChange={(e) => patchGrass({ underlayerContrast: Number(e.target.value) })}
              className="w-full accent-[#20B46A]"
            />
          </label>
        </div>
      </aside>
    );
  }

  // --- DOMAIN: DIRT, PEBBLES & ROADS ---
  if (domain === 'dirtRoads') {
    const dc: DirtAndRoadConfig = terrain.dirtAndRoadConfig ?? createDefaultDirtAndRoadConfig();
    const roads = terrain.roads ?? [];
    const selectedRoad = roads.find((r) => r.id === store.selectedRoadId) ?? roads[0] ?? null;

    const patchDirt = (label: string, patch: Partial<DirtAndRoadConfig>, recordUndo = false) => {
      store.updateLevel(
        label,
        (lvl) => {
          const base = lvl.terrain ?? createInitialTerrain();
          return {
            ...lvl,
            terrain: {
              ...base,
              dirtAndRoadConfig: {
                ...(base.dirtAndRoadConfig ?? createDefaultDirtAndRoadConfig()),
                ...patch,
              },
            },
          };
        },
        recordUndo
      );
    };

    const patchRoad = (_label: string, patch: Partial<RoadSpline>, recordUndo = false, reapply = false) => {
      if (!selectedRoad) return;
      store.updateRoadSpline(selectedRoad.id, patch, reapply, recordUndo);
    };

    return (
      <aside
      onPointerDownCapture={(e) =>
        publishGuidanceFromControlEvent(e, controlHintBadge)
      }
      onFocusCapture={(e) =>
        publishGuidanceFromControlEvent(e, controlHintBadge)
      }
      className="w-full lg:w-76 shrink-0 lg:h-full lg:min-h-0 bg-white dark:bg-[#171A23] border-t lg:border-t-0 lg:border-l border-slate-200/80 dark:border-white/[0.08] lg:overflow-y-auto maker-scroll p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Route size={16} className="text-[#C2854E]" />
            <h2 className="text-sm font-extrabold">Dirt, Pebbles &amp; Roads</h2>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1">
          {(
            [
              ['paintDirt', 'Paint Dirt'],
              ['paintRoad', 'Carve Road'],
              ['paintCobble', 'Cobble'],
            ] as const
          ).map(([id, lbl]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setTool('terrain');
                setBrush(id);
              }}
              className={`py-1.5 rounded-xl text-[10px] font-bold border ${
                activeTool === 'terrain' && brush === id
                  ? 'bg-[#C2854E] border-[#C2854E] text-white'
                  : 'bg-slate-100 dark:bg-[#1F2430] border-transparent'
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>

        {/* Ground Detail & Chocolate Soil Presets */}
        <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2">
          <FieldLabel text="Ground Surface Presets" />
          <div className="grid grid-cols-2 gap-1.5">
            {[
              {
                label: 'Chocolate River Loam',
                patch: {
                  heroColor: '#765239',
                  secondaryColor: '#523724',
                  shoreEarthColor: '#5C3E2B',
                  noiseKind: 'fineLoam' as DirtNoiseKind,
                  noiseContrast: 0.64,
                  bumpStrength: 0.65,
                  puddleDensity: 0.52,
                  puddleScale: 1.0,
                  pebbleDensity: 0.72,
                  pebbleColor: '#7A6E63',
                },
              },
              {
                label: 'Pebbled Forest Trail',
                patch: {
                  heroColor: '#7D583D',
                  secondaryColor: '#563B27',
                  shoreEarthColor: '#63432E',
                  noiseKind: 'rockyGritty' as DirtNoiseKind,
                  noiseContrast: 0.75,
                  bumpStrength: 0.82,
                  puddleDensity: 0.34,
                  puddleScale: 0.85,
                  pebbleDensity: 1.25,
                  pebbleColor: '#857C73',
                },
              },
              {
                label: 'Muddy Puddles & Stones',
                patch: {
                  heroColor: '#5E3F29',
                  secondaryColor: '#3E2819',
                  shoreEarthColor: '#4B311F',
                  noiseKind: 'patchy' as DirtNoiseKind,
                  noiseContrast: 0.72,
                  bumpStrength: 0.7,
                  puddleDensity: 0.88,
                  puddleScale: 1.15,
                  pebbleDensity: 0.9,
                  pebbleColor: '#6E665E',
                },
              },
              {
                label: 'Cracked Dry Earth',
                patch: {
                  heroColor: '#8C6244',
                  secondaryColor: '#63432C',
                  shoreEarthColor: '#6E4C34',
                  noiseKind: 'crackedEarth' as DirtNoiseKind,
                  noiseContrast: 0.8,
                  bumpStrength: 0.78,
                  puddleDensity: 0.12,
                  puddleScale: 0.8,
                  pebbleDensity: 0.65,
                  pebbleColor: '#8E8377',
                },
              },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => patchDirt(`apply ${p.label}`, p.patch, true)}
                className="px-2 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-[10px] font-bold text-left hover:border-[#C2854E] border border-transparent"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dual-Tone Dirt Material, Chocolate Shore Earth & Puddles */}
        <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2.5">
          <FieldLabel text="Dirt, Chocolate Shore & Puddles" />
          <div className="grid grid-cols-3 gap-1.5">
            <label className="flex items-center justify-between px-2 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-[10px] font-semibold">
              <span>Hero</span>
              <input
                type="color"
                value={dc.heroColor}
                onChange={(e) => patchDirt('dirt hero color', { heroColor: e.target.value })}
                className="w-5 h-5 rounded border-0 bg-transparent cursor-pointer"
              />
            </label>
            <label className="flex items-center justify-between px-2 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-[10px] font-semibold">
              <span>Deep</span>
              <input
                type="color"
                value={dc.secondaryColor}
                onChange={(e) => patchDirt('dirt secondary color', { secondaryColor: e.target.value })}
                className="w-5 h-5 rounded border-0 bg-transparent cursor-pointer"
              />
            </label>
            <label className="flex items-center justify-between px-2 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-[10px] font-semibold">
              <span>Shore</span>
              <input
                type="color"
                value={dc.shoreEarthColor ?? '#5C3E2B'}
                onChange={(e) => patchDirt('shore earth color', { shoreEarthColor: e.target.value })}
                className="w-5 h-5 rounded border-0 bg-transparent cursor-pointer"
              />
            </label>
          </div>
          <select
            value={dc.noiseKind}
            onChange={(e) => patchDirt('dirt noise kind', { noiseKind: e.target.value as DirtNoiseKind }, true)}
            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-xs font-semibold"
          >
            <option value="fineLoam">Fine Loam Soil</option>
            <option value="crackedEarth">Cracked Dry Earth</option>
            <option value="rockyGritty">Rocky Gritty Grit</option>
            <option value="patchy">Patchy Wild Trail</option>
          </select>
          {[
            { key: 'noiseContrast', label: 'Color Mix Contrast', min: 0, max: 1, fallback: 0.62 },
            { key: 'bumpStrength', label: 'Soil & Pebble Relief', min: 0, max: 1, fallback: 0.65 },
            { key: 'puddleDensity', label: 'Surface Puddle Density', min: 0, max: 1, fallback: 0.48 },
            { key: 'puddleScale', label: 'Puddle Size Scale', min: 0.4, max: 1.8, fallback: 1.0 },
            { key: 'degradeAmount', label: 'Ground Weathering', min: 0, max: 1, fallback: 0.35 },
          ].map((s) => {
            const raw = (dc as unknown as Record<string, number | undefined>)[s.key];
            const val = typeof raw === 'number' ? raw : s.fallback;
            return (
              <label key={s.key} className="block space-y-0.5">
                <div className="flex justify-between text-[11px] font-semibold">
                  <span>{s.label}</span>
                  <span className="tabular-nums text-slate-500">
                    {Math.round(val * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={0.05}
                  value={val}
                  onChange={(e) => patchDirt(`adjust ${s.label}`, { [s.key]: Number(e.target.value) })}
                  className="w-full accent-[#C2854E]"
                />
              </label>
            );
          })}
        </div>

        {/* Pebbles & Stones */}
        <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2">
          <FieldLabel text="3D Pebbles & Surface Rocks" />
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-[11px] font-semibold">
            <span>Pebble Tint</span>
            <input
              type="color"
              value={dc.pebbleColor}
              onChange={(e) => patchDirt('pebble tint', { pebbleColor: e.target.value })}
              className="w-6 h-5 rounded border-0 bg-transparent cursor-pointer"
            />
          </div>
          {[
            { key: 'pebbleDensity', label: 'Pebble Density', max: 1.5 },
            { key: 'pebbleSpread', label: 'Cluster Spread', max: 1 },
            { key: 'pebbleShapeRandomness', label: 'Shape Variety', max: 1 },
            { key: 'pebbleHueVariance', label: 'Color Variance', max: 1 },
          ].map((s) => (
            <label key={s.key} className="block space-y-0.5">
              <div className="flex justify-between text-[11px] font-semibold">
                <span>{s.label}</span>
                <span className="tabular-nums text-slate-500">
                  {Math.round(Number((dc as unknown as Record<string, number>)[s.key]) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={s.max}
                step={0.05}
                value={Number((dc as unknown as Record<string, number>)[s.key])}
                onChange={(e) => patchDirt(`adjust ${s.label}`, { [s.key]: Number(e.target.value) })}
                className="w-full accent-[#64748B]"
              />
            </label>
          ))}
        </div>

        {/* Selected Road / Trail Spline */}
        {selectedRoad && (
          <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2">
            <div className="flex items-center justify-between">
              <FieldLabel text={`Road: ${selectedRoad.name}`} />
            </div>
            {[
              { key: 'width', label: 'Road Width', min: 1.4, max: 6.5, step: 0.2, fmt: (v: number) => `${v.toFixed(1)}m` },
              { key: 'recessDepth', label: 'Bed Recess', min: 0, max: 1.0, step: 0.05, fmt: (v: number) => `${v.toFixed(2)}m` },
              { key: 'bankSlopeAngle', label: 'Bank Slope', min: 0.1, max: 1.0, step: 0.05, fmt: (v: number) => `${Math.round(v * 100)}%` },
              { key: 'edgeTransition', label: 'Edge Blend', min: 0.1, max: 1.0, step: 0.05, fmt: (v: number) => `${Math.round(v * 100)}%` },
              { key: 'borderDensity', label: 'Border Flora Density', min: 0, max: 1.5, step: 0.05, fmt: (v: number) => `${Math.round(v * 100)}%` },
              { key: 'borderRandomness', label: 'Border Randomness', min: 0, max: 1.0, step: 0.05, fmt: (v: number) => `${Math.round(v * 100)}%` },
            ].map((s) => {
              const val = Number((selectedRoad as unknown as Record<string, number>)[s.key] ?? 0.5);
              return (
                <label key={s.key} className="block space-y-0.5">
                  <div className="flex justify-between text-[10px] font-semibold">
                    <span>{s.label}</span>
                    <span className="tabular-nums text-slate-500">{s.fmt(val)}</span>
                  </div>
                  <input
                    type="range"
                    min={s.min}
                    max={s.max}
                    step={s.step}
                    value={val}
                    onChange={(e) => patchRoad(`adjust road ${s.label}`, { [s.key]: Number(e.target.value) })}
                    className="w-full accent-[#C2854E]"
                  />
                </label>
              );
            })}
            <select
              value={selectedRoad.borderScatter}
              onChange={(e) =>
                patchRoad('change border scatter', {
                  borderScatter: e.target.value as RoadBorderScatterKind,
                }, true)
              }
              className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-xs font-semibold"
            >
              <option value="none">No Road Border</option>
              <option value="wildflowers">Border: Wildflowers</option>
              <option value="grass">Border: Tall Grass</option>
              <option value="boulders">Border: Stones &amp; Rocks</option>
              <option value="mixed">Border: Mixed Foliage</option>
              <option value="custom">Border: Custom Plant/Prop</option>
            </select>
            {selectedRoad.borderScatter === 'custom' && store.customAssets.length > 0 && (
              <select
                value={selectedRoad.borderCustomAssetId ?? ''}
                onChange={(e) =>
                  patchRoad('set road border asset', { borderCustomAssetId: e.target.value || undefined }, true)
                }
                className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-xs font-semibold"
              >
                <option value="">Choose custom asset…</option>
                {store.customAssets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.category})
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() =>
                store.updateLevel(`rebuild road ${selectedRoad.name}`, (lvl) => ({
                  ...lvl,
                  terrain: applyRoadSplineToTerrain(
                    lvl.terrain ?? createInitialTerrain(),
                    selectedRoad,
                    true
                  ),
                }))
              }
              className="w-full py-1.5 rounded-xl bg-[#C2854E] text-white text-[11px] font-extrabold"
            >
              Rebuild Road &amp; Border
            </button>
          </div>
        )}
      </aside>
    );
  }

  // --- DOMAIN: FLORA & SCATTER ---
  if (domain === 'flora') {
    const floraBrushes: { id: TerrainBrush; label: string; spanClass: string }[] = [
      { id: 'scatterTree', label: 'Trees', spanClass: 'col-span-2' },
      { id: 'scatterRock', label: 'Rocks', spanClass: 'col-span-2' },
      { id: 'scatterFlower', label: 'Flowers', spanClass: 'col-span-2' },
      { id: 'scatterPlant', label: 'Plants', spanClass: 'col-span-3' },
      { id: 'scatterCustom', label: 'Custom GLB', spanClass: 'col-span-3' },
    ];
    const floraCfg = resolveFloraScatterSettings(terrain.floraScatterSettings);
    const patchFloraSettings = (
      updater: (cur: FloraScatterSettings) => FloraScatterSettings
    ) => {
      store.updateLevel(
        'update flora scatter settings',
        (lvl) => {
          const curTerrain = lvl.terrain ?? createInitialTerrain();
          const curResolved = resolveFloraScatterSettings(curTerrain.floraScatterSettings);
          return {
            ...lvl,
            terrain: {
              ...curTerrain,
              floraScatterSettings: updater(curResolved),
            },
          };
        },
        false
      );
    };
    const rockCfg = floraCfg.rocks;
    const savedFlowers = store.customAssets.filter(
      (a) => a.category === 'plant' && a.plantSubKind === 'flower'
    );
    const savedPlants = store.customAssets.filter(
      (a) => a.category === 'plant' && a.plantSubKind !== 'flower'
    );

    return (
      <aside
      onPointerDownCapture={(e) =>
        publishGuidanceFromControlEvent(e, controlHintBadge)
      }
      onFocusCapture={(e) =>
        publishGuidanceFromControlEvent(e, controlHintBadge)
      }
      className="w-full lg:w-76 shrink-0 lg:h-full lg:min-h-0 bg-white dark:bg-[#171A23] border-t lg:border-t-0 lg:border-l border-slate-200/80 dark:border-white/[0.08] lg:overflow-y-auto maker-scroll p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Trees size={16} className="text-[#20B46A]" />
          <h2 className="text-sm font-extrabold">Flora &amp; Scatter</h2>
        </div>

        <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2.5">
          <FieldLabel text="3D Scatter Brush" />
          <div className="grid grid-cols-6 gap-1.5">
            {floraBrushes.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  if (b.id === 'scatterCustom' && store.customAssets.length === 0) {
                    store.setShowingAssetVault(true);
                    return;
                  }
                  setTool('terrain');
                  setBrush(b.id);
                }}
                className={`${b.spanClass} py-2 px-1 rounded-xl text-xs font-bold border whitespace-nowrap truncate ${
                  activeTool === 'terrain' && brush === b.id
                    ? 'bg-[#20B46A] border-[#20B46A] text-white'
                    : 'bg-white dark:bg-[#171A23] border-transparent text-slate-700 dark:text-slate-200'
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>

          {brush === 'scatterCustom' && store.customAssets.length > 0 && (
            <select
              value={activeScatterAssetId}
              onChange={(e) => setScatterAssetId(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-xs font-bold"
            >
              {store.customAssets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.category})
                </option>
              ))}
            </select>
          )}

          <label className="block space-y-0.5">
            <div className="flex justify-between text-[11px] font-semibold">
              <span>Scatter Radius</span>
              <span className="tabular-nums">{brushRadius.toFixed(0)}m</span>
            </div>
            <input
              type="range"
              min={2}
              max={24}
              step={0.5}
              value={brushRadius}
              onChange={(e) => setBrushRadius(Number(e.target.value))}
              className="w-full accent-[#20B46A]"
            />
          </label>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => store.openTreeMaker()}
            className="py-2 px-1 rounded-xl bg-[#20B46A]/15 hover:bg-[#20B46A]/25 text-[#20B46A] text-[11px] font-extrabold inline-flex items-center justify-center gap-1 whitespace-nowrap"
          >
            <Trees size={12} />
            <span>Trees</span>
          </button>
          <button
            type="button"
            onClick={() => store.openPlantMaker(undefined, 'flower')}
            className="py-2 px-1 rounded-xl bg-[#EC4899]/15 hover:bg-[#EC4899]/25 text-[#EC4899] text-[11px] font-extrabold inline-flex items-center justify-center gap-1 whitespace-nowrap"
          >
            <Flower2 size={12} />
            <span>Flowers</span>
          </button>
          <button
            type="button"
            onClick={() => store.openPlantMaker(undefined, 'plant')}
            className="py-2 px-1 rounded-xl bg-[#16A34A]/15 hover:bg-[#16A34A]/25 text-[#16A34A] text-[11px] font-extrabold inline-flex items-center justify-center gap-1 whitespace-nowrap"
          >
            <Sprout size={12} />
            <span>Plants</span>
          </button>
        </div>

        {/* ROCKS SUB-CONTROLS: 4 Interactive Tiers + Size Ranges + Color/Pattern/Shape */}
        {brush === 'scatterRock' && (
          <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <FieldLabel text="Rock Tiers to Paint" />
              <span className="text-[10px] font-bold text-slate-500 dark:text-[#949BB0]">
                Tick any mix
              </span>
            </div>

            <div className="space-y-1.5">
              {ROCK_CLASS_META.map((tier) => {
                const enabled = rockCfg.enabledTiers[tier.id];
                return (
                  <label
                    key={tier.id}
                    className={`flex items-start gap-2 p-2 rounded-xl border cursor-pointer transition-colors ${
                      enabled
                        ? 'bg-white dark:bg-[#171A23] border-[#20B46A]/60'
                        : 'bg-white/50 dark:bg-[#171A23]/40 border-transparent opacity-70'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) =>
                        patchFloraSettings((cur) => ({
                          ...cur,
                          rocks: {
                            ...cur.rocks,
                            enabledTiers: {
                              ...cur.rocks.enabledTiers,
                              [tier.id]: e.target.checked,
                            },
                          },
                        }))
                      }
                      className="mt-0.5 w-3.5 h-3.5 accent-[#20B46A] shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-extrabold leading-tight">{tier.label}</span>
                        <span className="text-[10px] font-bold text-[#20B46A] shrink-0">
                          {tier.interactionLabel}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-[#949BB0] leading-snug mt-0.5">
                        {tier.description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Min / Max Size for Each Ticked Tier */}
            {ROCK_CLASS_META.some((t) => rockCfg.enabledTiers[t.id]) && (
              <div className="space-y-2 pt-2 border-t border-slate-200/70 dark:border-white/[0.08]">
                <FieldLabel text="Size Range (Selected Tiers)" />
                {ROCK_CLASS_META.filter((t) => rockCfg.enabledTiers[t.id]).map((tier) => {
                  const range = rockCfg.tierScales[tier.id];
                  return (
                    <div
                      key={tier.id}
                      className="p-2 rounded-xl bg-white dark:bg-[#171A23] space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span>{tier.label}</span>
                        <span className="tabular-nums text-[#20B46A]">
                          {range.minSize.toFixed(2)} – {range.maxSize.toFixed(2)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block text-[10px] font-semibold text-slate-500 dark:text-[#949BB0]">
                          <span>Min</span>
                          <input
                            type="range"
                            min={tier.sliderMin}
                            max={tier.sliderMax}
                            step={tier.sliderStep}
                            value={range.minSize}
                            onChange={(e) => {
                              const nextMin = Number(e.target.value);
                              patchFloraSettings((cur) => ({
                                ...cur,
                                rocks: {
                                  ...cur.rocks,
                                  tierScales: {
                                    ...cur.rocks.tierScales,
                                    [tier.id]: {
                                      minSize: nextMin,
                                      maxSize: Math.max(nextMin, cur.rocks.tierScales[tier.id].maxSize),
                                    },
                                  },
                                },
                              }));
                            }}
                            className="w-full accent-[#20B46A]"
                          />
                        </label>
                        <label className="block text-[10px] font-semibold text-slate-500 dark:text-[#949BB0]">
                          <span>Max</span>
                          <input
                            type="range"
                            min={tier.sliderMin}
                            max={tier.sliderMax}
                            step={tier.sliderStep}
                            value={range.maxSize}
                            onChange={(e) => {
                              const nextMax = Number(e.target.value);
                              patchFloraSettings((cur) => ({
                                ...cur,
                                rocks: {
                                  ...cur.rocks,
                                  tierScales: {
                                    ...cur.rocks.tierScales,
                                    [tier.id]: {
                                      minSize: Math.min(cur.rocks.tierScales[tier.id].minSize, nextMax),
                                      maxSize: nextMax,
                                    },
                                  },
                                },
                              }));
                            }}
                            className="w-full accent-[#20B46A]"
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Color, Pattern, Noise & Shape Controls */}
            <div className="space-y-2.5 pt-2 border-t border-slate-200/70 dark:border-white/[0.08]">
              <FieldLabel text="Color, Pattern & Shape" />
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    { id: 'single', label: 'Single Color' },
                    { id: 'gradient', label: '2-Color Gradient' },
                  ] as const
                ).map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() =>
                      patchFloraSettings((cur) => ({
                        ...cur,
                        rocks: { ...cur.rocks, colorMode: mode.id },
                      }))
                    }
                    className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border whitespace-nowrap ${
                      rockCfg.colorMode === mode.id
                        ? 'bg-[#20B46A] border-[#20B46A] text-white'
                        : 'bg-white dark:bg-[#171A23] border-transparent text-slate-600 dark:text-slate-200'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <label className="flex-1 flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-[11px] font-bold">
                  <span>Color A</span>
                  <input
                    type="color"
                    value={rockCfg.primaryColor}
                    onChange={(e) =>
                      patchFloraSettings((cur) => ({
                        ...cur,
                        rocks: { ...cur.rocks, primaryColor: e.target.value },
                      }))
                    }
                    className="w-6 h-5 rounded border-0 bg-transparent cursor-pointer"
                  />
                </label>
                {rockCfg.colorMode === 'gradient' && (
                  <label className="flex-1 flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-[11px] font-bold">
                    <span>Color B</span>
                    <input
                      type="color"
                      value={rockCfg.secondaryColor}
                      onChange={(e) =>
                        patchFloraSettings((cur) => ({
                          ...cur,
                          rocks: { ...cur.rocks, secondaryColor: e.target.value },
                        }))
                      }
                      className="w-6 h-5 rounded border-0 bg-transparent cursor-pointer"
                    />
                  </label>
                )}
              </div>

              <label className="block space-y-0.5">
                <div className="flex justify-between text-[11px] font-semibold">
                  <span>Color Variation</span>
                  <span className="tabular-nums">{Math.round(rockCfg.colorVariation * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={rockCfg.colorVariation}
                  onChange={(e) =>
                    patchFloraSettings((cur) => ({
                      ...cur,
                      rocks: { ...cur.rocks, colorVariation: Number(e.target.value) },
                    }))
                  }
                  className="w-full accent-[#20B46A]"
                />
              </label>

              <div className="space-y-1">
                <span className="text-[11px] font-semibold">Rock Pattern</span>
                <select
                  value={rockCfg.pattern}
                  onChange={(e) =>
                    patchFloraSettings((cur) => ({
                      ...cur,
                      rocks: { ...cur.rocks, pattern: e.target.value as RockPatternKind },
                    }))
                  }
                  className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.08] text-xs font-bold"
                >
                  {ROCK_PATTERN_OPTIONS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <label className="block space-y-0.5">
                <div className="flex justify-between text-[11px] font-semibold">
                  <span>Pattern Noise</span>
                  <span className="tabular-nums">{Math.round(rockCfg.patternNoise * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={rockCfg.patternNoise}
                  onChange={(e) =>
                    patchFloraSettings((cur) => ({
                      ...cur,
                      rocks: { ...cur.rocks, patternNoise: Number(e.target.value) },
                    }))
                  }
                  className="w-full accent-[#20B46A]"
                />
              </label>

              <div className="space-y-1">
                <span className="text-[11px] font-semibold">Shape Style</span>
                <select
                  value={rockCfg.shape}
                  onChange={(e) =>
                    patchFloraSettings((cur) => ({
                      ...cur,
                      rocks: { ...cur.rocks, shape: e.target.value as RockShapeKind },
                    }))
                  }
                  className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.08] text-xs font-bold"
                >
                  {ROCK_SHAPE_OPTIONS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <label className="block space-y-0.5">
                <div className="flex justify-between text-[11px] font-semibold">
                  <span>Shape Irregularity</span>
                  <span className="tabular-nums">{Math.round(rockCfg.shapeVariation * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={rockCfg.shapeVariation}
                  onChange={(e) =>
                    patchFloraSettings((cur) => ({
                      ...cur,
                      rocks: { ...cur.rocks, shapeVariation: Number(e.target.value) },
                    }))
                  }
                  className="w-full accent-[#20B46A]"
                />
              </label>
            </div>
          </div>
        )}

        {/* FLOWERS SUB-CONTROLS: 4 Flower Dropdown Slots + Single / Group / All 4 Selection */}
        {brush === 'scatterFlower' && (() => {
          const enabledFlowers = floraCfg.flowerEnabledSlots ?? [true, true, true, true];
          const enabledCount = enabledFlowers.filter(Boolean).length;
          return (
            <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <FieldLabel text="Flower Brush Slots" />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setTool('terrain');
                      setBrush('scatterFlower');
                      patchFloraSettings((cur) => ({
                        ...cur,
                        flowerPaintAll: true,
                        flowerEnabledSlots: [true, true, true, true],
                      }));
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold whitespace-nowrap ${
                      enabledCount === 4
                        ? 'bg-[#EC4899] text-white'
                        : 'bg-white dark:bg-[#171A23] text-slate-500'
                    }`}
                  >
                    All 4
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTool('terrain');
                      setBrush('scatterFlower');
                      patchFloraSettings((cur) => {
                        const soloIdx = Math.max(0, Math.min(3, cur.activeFlowerSlot));
                        return {
                          ...cur,
                          flowerPaintAll: false,
                          flowerEnabledSlots: [
                            soloIdx === 0,
                            soloIdx === 1,
                            soloIdx === 2,
                            soloIdx === 3,
                          ],
                        };
                      });
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold whitespace-nowrap ${
                      enabledCount === 1
                        ? 'bg-[#EC4899] text-white'
                        : 'bg-white dark:bg-[#171A23] text-slate-500'
                    }`}
                  >
                    Single
                  </button>
                </div>
              </div>
              <p className="text-[10.5px] text-slate-500 dark:text-[#949BB0] leading-snug">
                Tick one flower or any group below, then paint directly on the land map.
              </p>

              <div className="space-y-1.5">
                {floraCfg.flowerSlots.map((slotKey, idx) => {
                  const isChecked = enabledFlowers[idx];
                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-1.5 p-1.5 rounded-xl border transition-colors ${
                        isChecked
                          ? 'bg-[#EC4899]/10 border-[#EC4899]/60'
                          : 'bg-white dark:bg-[#171A23] border-transparent opacity-70'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        aria-label={`Include Flower ${idx + 1} in brush`}
                        onChange={(e) => {
                          const nextChecked = e.target.checked;
                          setTool('terrain');
                          setBrush('scatterFlower');
                          patchFloraSettings((cur) => {
                            const base = [...(cur.flowerEnabledSlots ?? [true, true, true, true])] as [
                              boolean,
                              boolean,
                              boolean,
                              boolean,
                            ];
                            base[idx] = nextChecked;
                            if (!base.some(Boolean)) {
                              base[idx] = true;
                            }
                            const firstOn = base.findIndex(Boolean);
                            return {
                              ...cur,
                              flowerEnabledSlots: base,
                              flowerPaintAll: base.every(Boolean),
                              activeFlowerSlot: nextChecked ? idx : firstOn >= 0 ? firstOn : 0,
                            };
                          });
                        }}
                        className="accent-[#EC4899] w-3.5 h-3.5 shrink-0 cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setTool('terrain');
                          setBrush('scatterFlower');
                          patchFloraSettings((cur) => ({
                            ...cur,
                            flowerPaintAll: false,
                            activeFlowerSlot: idx,
                            flowerEnabledSlots: [idx === 0, idx === 1, idx === 2, idx === 3],
                          }));
                        }}
                        title={`Paint only Flower ${idx + 1}`}
                        className={`w-5 h-5 rounded-md text-[10px] font-extrabold shrink-0 ${
                          isChecked
                            ? 'bg-[#EC4899] text-white'
                            : 'bg-slate-100 dark:bg-[#1F2430] text-slate-500'
                        }`}
                      >
                        {idx + 1}
                      </button>
                      <select
                        value={slotKey}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTool('terrain');
                          setBrush('scatterFlower');
                          patchFloraSettings((cur) => {
                            const nextSlots = [...cur.flowerSlots] as [string, string, string, string];
                            nextSlots[idx] = val;
                            return { ...cur, flowerSlots: nextSlots };
                          });
                        }}
                        className="flex-1 min-w-0 px-2 py-1 rounded-lg bg-slate-50 dark:bg-[#11141D] text-xs font-semibold truncate"
                      >
                        <optgroup label="Premade Flowers">
                          {FLOWER_STARTER_RECIPES.map((f) => (
                            <option key={`flower:${f.id}`} value={`flower:${f.id}`}>
                              {f.name}
                            </option>
                          ))}
                        </optgroup>
                        {savedFlowers.length > 0 && (
                          <optgroup label="Your Flower Maker Creations">
                            {savedFlowers.map((a) => (
                              <option key={`asset:${a.id}`} value={`asset:${a.id}`}>
                                {a.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => store.openPlantMaker(undefined, 'flower')}
                className="w-full py-2 px-3 rounded-xl bg-[#EC4899] hover:bg-[#DB2777] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5"
              >
                <Flower2 size={13} />
                <span>Create Custom Flower</span>
              </button>
            </div>
          );
        })()}

        {/* PLANTS SUB-CONTROLS: 4 Plant Dropdown Slots + Single / Group / All 4 Selection */}
        {brush === 'scatterPlant' && (() => {
          const enabledPlants = floraCfg.plantEnabledSlots ?? [true, true, true, true];
          const enabledCount = enabledPlants.filter(Boolean).length;
          return (
            <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <FieldLabel text="Plant Brush Slots" />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setTool('terrain');
                      setBrush('scatterPlant');
                      patchFloraSettings((cur) => ({
                        ...cur,
                        plantPaintAll: true,
                        plantEnabledSlots: [true, true, true, true],
                      }));
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold whitespace-nowrap ${
                      enabledCount === 4
                        ? 'bg-[#16A34A] text-white'
                        : 'bg-white dark:bg-[#171A23] text-slate-500'
                    }`}
                  >
                    All 4
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTool('terrain');
                      setBrush('scatterPlant');
                      patchFloraSettings((cur) => {
                        const soloIdx = Math.max(0, Math.min(3, cur.activePlantSlot));
                        return {
                          ...cur,
                          plantPaintAll: false,
                          plantEnabledSlots: [
                            soloIdx === 0,
                            soloIdx === 1,
                            soloIdx === 2,
                            soloIdx === 3,
                          ],
                        };
                      });
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold whitespace-nowrap ${
                      enabledCount === 1
                        ? 'bg-[#16A34A] text-white'
                        : 'bg-white dark:bg-[#171A23] text-slate-500'
                    }`}
                  >
                    Single
                  </button>
                </div>
              </div>
              <p className="text-[10.5px] text-slate-500 dark:text-[#949BB0] leading-snug">
                Tick one plant or any group below (or click a number to solo it), then paint on the land map.
              </p>

              <div className="space-y-1.5">
                {floraCfg.plantSlots.map((slotKey, idx) => {
                  const isChecked = enabledPlants[idx];
                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-1.5 p-1.5 rounded-xl border transition-colors ${
                        isChecked
                          ? 'bg-[#16A34A]/10 border-[#16A34A]/60'
                          : 'bg-white dark:bg-[#171A23] border-transparent opacity-70'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        aria-label={`Include Plant ${idx + 1} in brush`}
                        onChange={(e) => {
                          const nextChecked = e.target.checked;
                          setTool('terrain');
                          setBrush('scatterPlant');
                          patchFloraSettings((cur) => {
                            const base = [...(cur.plantEnabledSlots ?? [true, true, true, true])] as [
                              boolean,
                              boolean,
                              boolean,
                              boolean,
                            ];
                            base[idx] = nextChecked;
                            if (!base.some(Boolean)) {
                              base[idx] = true;
                            }
                            const firstOn = base.findIndex(Boolean);
                            return {
                              ...cur,
                              plantEnabledSlots: base,
                              plantPaintAll: base.every(Boolean),
                              activePlantSlot: nextChecked ? idx : firstOn >= 0 ? firstOn : 0,
                            };
                          });
                        }}
                        className="accent-[#16A34A] w-3.5 h-3.5 shrink-0 cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setTool('terrain');
                          setBrush('scatterPlant');
                          patchFloraSettings((cur) => ({
                            ...cur,
                            plantPaintAll: false,
                            activePlantSlot: idx,
                            plantEnabledSlots: [idx === 0, idx === 1, idx === 2, idx === 3],
                          }));
                        }}
                        title={`Paint only Plant ${idx + 1}`}
                        className={`w-5 h-5 rounded-md text-[10px] font-extrabold shrink-0 ${
                          isChecked
                            ? 'bg-[#16A34A] text-white'
                            : 'bg-slate-100 dark:bg-[#1F2430] text-slate-500'
                        }`}
                      >
                        {idx + 1}
                      </button>
                      <select
                        value={slotKey}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTool('terrain');
                          setBrush('scatterPlant');
                          patchFloraSettings((cur) => {
                            const nextSlots = [...cur.plantSlots] as [string, string, string, string];
                            nextSlots[idx] = val;
                            return { ...cur, plantSlots: nextSlots };
                          });
                        }}
                        className="flex-1 min-w-0 px-2 py-1 rounded-lg bg-slate-50 dark:bg-[#11141D] text-xs font-semibold truncate"
                      >
                        <optgroup label="Premade Plants">
                          {PLANT_STARTER_PRESETS.map((p) => (
                            <option key={`plant:${p.id}`} value={`plant:${p.id}`}>
                              {p.name}
                            </option>
                          ))}
                        </optgroup>
                        {savedPlants.length > 0 && (
                          <optgroup label="Your Plant Maker Creations">
                            {savedPlants.map((a) => (
                              <option key={`asset:${a.id}`} value={`asset:${a.id}`}>
                                {a.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => store.openPlantMaker(undefined, 'plant')}
                className="w-full py-2 px-3 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5"
              >
                <Sprout size={13} />
                <span>Create Custom Plant</span>
              </button>
            </div>
          );
        })()}

        {/* Persistent Default Spawn Tree Styles */}
        <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <FieldLabel text="Default Spawn Trees" />
            <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-[#949BB0] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={defaultTreePrefs.autoApplyOnNewMaps}
                onChange={(e) => setAutoApplyDefaultTreeStyles(e.target.checked)}
                className="accent-[#20B46A]"
              />
              <span>Auto on new maps</span>
            </label>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-[#949BB0] leading-snug">
            Pick your default styles so newly spawned trees &amp; lands always use them.
          </p>

          {(
            [
              { slot: 'conifer', title: 'Conifers' },
              { slot: 'oak', title: 'Oaks' },
              { slot: 'birch', title: 'Birches' },
            ] as { slot: SpawnTreeCategory; title: string }[]
          ).map(({ slot, title }) => {
            const savedEntry = defaultTreePrefs.species[slot];
            const catalog = getTreeStyleChoiceCatalog(slot, store.customAssets);
            const stylizedItems = catalog.filter((c) => c.group === 'stylized');
            const ezItems = catalog.filter((c) => c.group === 'ezTree');
            const assetItems = catalog.filter((c) => c.group === 'customAsset');
            const currentSelectValue = savedEntry
              ? savedEntry.presetId && catalog.some((c) => c.id === savedEntry.presetId)
                ? savedEntry.presetId
                : '__custom__'
              : '';

            return (
              <div key={slot} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {title}
                  </span>
                  <button
                    type="button"
                    onClick={() => store.openTreeMaker(undefined, slot)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#20B46A] hover:underline"
                    title={`Customize ${title} in Tree Maker`}
                  >
                    <Pencil size={10} />
                    <span>Edit in Studio</span>
                  </button>
                </div>
                <select
                  value={currentSelectValue}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) {
                      clearDefaultTreeStyle(slot);
                      return;
                    }
                    if (val === '__custom__') return;
                    const picked = catalog.find((c) => c.id === val);
                    if (!picked) return;
                    saveDefaultTreeStyle(slot, picked.buildConfig(), picked.label, picked.id);
                    store.applyDefaultTreeStylesToLevels('current');
                  }}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.08] text-xs font-semibold focus:outline-none focus:border-[#20B46A]"
                >
                  <option value="">Built-in Default</option>
                  {savedEntry && currentSelectValue === '__custom__' && (
                    <option value="__custom__">Custom · {savedEntry.label}</option>
                  )}
                  {stylizedItems.length > 0 && (
                    <optgroup label="Stylized Canopy Styles">
                      {stylizedItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {ezItems.length > 0 && (
                    <optgroup label="EZ-Tree Branching Styles">
                      {ezItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {assetItems.length > 0 && (
                    <optgroup label="Your Saved Tree Assets">
                      {assetItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            );
          })}

          {Object.keys(defaultTreePrefs.species).length > 0 && (
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  store.applyDefaultTreeStylesToLevels('current');
                  setAppliedTreeDefaultsNote('current');
                  window.setTimeout(() => setAppliedTreeDefaultsNote(null), 2000);
                }}
                className="py-1.5 px-2 rounded-xl bg-white dark:bg-[#171A23] hover:border-[#20B46A] border border-slate-200/80 dark:border-white/[0.08] text-[11px] font-bold transition-colors"
              >
                {appliedTreeDefaultsNote === 'current' ? 'Applied Here' : 'Apply to Land'}
              </button>
              <button
                type="button"
                onClick={() => {
                  store.applyDefaultTreeStylesToLevels('all');
                  setAppliedTreeDefaultsNote('all');
                  window.setTimeout(() => setAppliedTreeDefaultsNote(null), 2000);
                }}
                className="py-1.5 px-2 rounded-xl bg-[#20B46A] hover:bg-[#1A9A59] text-white text-[11px] font-bold transition-colors"
              >
                {appliedTreeDefaultsNote === 'all' ? 'Applied to All' : 'Apply to All Lands'}
              </button>
            </div>
          )}
        </div>
      </aside>
    );
  }

  // --- DOMAIN: SELECT / ENTITY OR BUILDINGS ---
  const isHeroSelected = store.selectedEntityID === HERO_START_ENTITY_ID;
  const heroCustomAsset = currentProject.heroCustomAssetId
    ? store.customAssets.find((a) => a.id === currentProject.heroCustomAssetId) ?? null
    : null;
  const heroBp =
    store.playFromPoint ??
    currentLevel.startPoint ??
    (envType === 'sideScroller' ? { x: 0.1, y: 0.5 } : { x: 0.14, y: 0.8 });
  const [heroWorldX, heroWorldZ] = levelBoardToWorld(currentLevel, heroBp);
  const heroRotationDeg =
    currentLevel.startRotation ?? (envType === 'sideScroller' ? 90 : 135);

  const showBuildingPlacementInspector =
    !isHeroSelected &&
    !currentEntity &&
    store.worldViewMode === '3d' &&
    (domain === 'buildings' || (activeTool === 'add' && addPaletteMode === 'blocks'));

  return (
    <aside
      onPointerDownCapture={(e) =>
        publishGuidanceFromControlEvent(e, controlHintBadge)
      }
      onFocusCapture={(e) =>
        publishGuidanceFromControlEvent(e, controlHintBadge)
      }
      className="w-full lg:w-76 shrink-0 lg:h-full lg:min-h-0 bg-white dark:bg-[#171A23] border-t lg:border-t-0 lg:border-l border-slate-200/80 dark:border-white/[0.08] lg:overflow-y-auto maker-scroll p-4 space-y-4">
      {isHeroSelected ? (
        <>
          <div className="flex items-center gap-3">
            <AssetThumbnail
              customAsset={heroCustomAsset}
              hero={{
                body: currentProject.heroBody,
                colors: currentProject.heroColors,
              }}
              size={46}
              rounded="rounded-xl"
              alt={currentProject.heroName}
            />
            <div className="min-w-0 flex-1">
              <input
                type="text"
                value={currentProject.heroName}
                onChange={(e) =>
                  store.updateProject('rename hero', (p) => ({ ...p, heroName: e.target.value }), false)
                }
                className="w-full text-sm font-extrabold bg-transparent focus:outline-none border-b border-transparent focus:border-[#7C5CFF]"
              />
              <div className="text-[11px] text-[#7C5CFF] font-bold truncate">
                Playable Hero · World Start
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const wy = sampleTerrainHeight(terrain, heroWorldX, heroWorldZ);
                store.focusCameraOnWorldPoint({
                  id: HERO_START_ENTITY_ID,
                  x: heroWorldX,
                  y: wy + 1.1,
                  z: heroWorldZ,
                  distance: 18,
                });
              }}
              title="Focus camera on Hero"
              className="p-2 rounded-xl bg-slate-100 dark:bg-[#1F2430] hover:bg-[#7C5CFF]/20 text-[#7C5CFF] shrink-0"
            >
              <Crosshair size={14} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => onStartPlaceHero?.()}
            className={`w-full py-2.5 px-3 rounded-xl text-xs font-extrabold inline-flex items-center justify-center gap-1.5 shadow-xs transition-colors ${
              isPlacingHero
                ? 'bg-[#20B46A] text-white'
                : 'bg-[#7C5CFF] hover:bg-[#6A48F5] text-white'
            }`}
          >
            <MapPin size={13} />
            <span>{isPlacingHero ? 'Click Anywhere on Map to Place…' : 'Place Hero on Map'}</span>
          </button>

          <p className="text-[11px] text-slate-500 dark:text-[#949BB0] leading-relaxed">
            Drag your Hero directly in the 3D viewport (Move tool) or click <strong className="text-slate-700 dark:text-slate-200">Place Hero on Map</strong> to drop them anywhere on the terrain.
          </p>

          <div className="space-y-3 pt-2 border-t border-slate-200/70 dark:border-white/[0.08]">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>Facing / Turn</span>
                <div className="flex items-center gap-1">
                  {[-90, -45, 45, 90].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() =>
                        store.rotateHeroStart((Math.round((heroRotationDeg + d) / 45) * 45 + 360) % 360, true)
                      }
                      className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#1F2430] hover:bg-[#7C5CFF]/20 text-[10px] font-bold"
                    >
                      {d > 0 ? `+${d}°` : `${d}°`}
                    </button>
                  ))}
                  <span className="tabular-nums text-slate-500 ml-1">
                    {Math.round(heroRotationDeg)}°
                  </span>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={360}
                value={((heroRotationDeg % 360) + 360) % 360}
                onChange={(e) => store.rotateHeroStart(Number(e.target.value), false)}
                className="w-full accent-[#7C5CFF]"
              />
            </div>

            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-[#1F2430] flex items-center justify-between text-[11px] font-semibold">
              <span className="text-slate-500 dark:text-[#949BB0]">Position</span>
              <span className="tabular-nums">
                X {heroWorldX.toFixed(1)}m · Z {heroWorldZ.toFixed(1)}m
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => store.moveEntity(HERO_START_ENTITY_ID, { x: 0.5, y: 0.5 }, true)}
                className="py-2 rounded-xl bg-slate-100 dark:bg-[#1F2430] hover:bg-[#7C5CFF]/15 text-[11px] font-bold"
              >
                Center on Land
              </button>
              <button
                type="button"
                onClick={() => {
                  store.setSelectedEntityID(null);
                  store.setSelectedSection('cast');
                  store.setSelectedTab('cast');
                }}
                className="py-2 rounded-xl bg-[#7C5CFF]/15 text-[#7C5CFF] hover:bg-[#7C5CFF]/25 text-[11px] font-bold inline-flex items-center justify-center gap-1"
              >
                <User size={12} />
                <span>Edit in Cast</span>
              </button>
            </div>

            <label className="flex items-center justify-between gap-2 pt-1 text-xs font-semibold cursor-pointer">
              <span>Hero spawns in this land</span>
              <input
                type="checkbox"
                checked={currentLevel.hasStart}
                onChange={(e) =>
                  store.updateLevel('toggle hero spawn', (lvl) => ({
                    ...lvl,
                    hasStart: e.target.checked,
                  }))
                }
                className="w-4 h-4 accent-[#7C5CFF]"
              />
            </label>
          </div>
        </>
      ) : currentEntity ? (
        <>
          <div className="flex items-center gap-3">
            <AssetThumbnail
              entity={currentEntity}
              customAsset={selectedEntityCustom}
              size={46}
              rounded="rounded-xl"
            />
            <div className="min-w-0 flex-1">
              <input
                type="text"
                value={currentEntity.name}
                onChange={(e) =>
                  store.updateEntity(currentEntity.id, 'rename', (ent) => ({
                    ...ent,
                    name: e.target.value,
                  }))
                }
                className="w-full text-sm font-extrabold bg-transparent focus:outline-none border-b border-transparent focus:border-[#7C5CFF]"
              />
              <div className="text-[11px] text-slate-500 dark:text-[#949BB0] truncate">
                {EntityKindMeta[currentEntity.kind].title}
                {selectedEntityCustom ? ` · ${selectedEntityCustom.name}` : ''}
              </div>
            </div>
            <button
              type="button"
              onClick={() => focusEntityCamera(currentEntity)}
              title="Focus camera on selected object"
              className="p-2 rounded-xl bg-slate-100 dark:bg-[#1F2430] hover:bg-[#7C5CFF]/20 text-[#7C5CFF] shrink-0"
            >
              <Crosshair size={14} />
            </button>
          </div>

          {/* Primary Attribute Modifier Trigger */}
          <button
            type="button"
            onClick={() =>
              store.setAttributeModifierTarget({
                kind: 'entity',
                entityId: currentEntity.id,
              })
            }
            className="w-full py-2.5 px-3 rounded-xl bg-[#7C5CFF] hover:bg-[#6A48F5] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 shadow-xs"
          >
            <SlidersHorizontal size={13} />
            <span>Edit Attributes, Role &amp; Dialogue</span>
          </button>

          {/* Spatial Turn / Elevation / Scale */}
          <div className="space-y-3 pt-2 border-t border-slate-200/70 dark:border-white/[0.08]">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>Turn</span>
                <div className="flex items-center gap-1">
                  {[-90, -45, 45, 90].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        const nextRot = (Math.round((currentEntity.rotation + d) / 45) * 45 + 360) % 360;
                        store.updateEntity(currentEntity.id, `rotate ${d}°`, (ent) => ({
                          ...ent,
                          rotation: nextRot,
                        }));
                        if (keepToolAdjustments && (currentEntity.buildingBlock || currentEntity.kind === 'door')) {
                          setActiveBlockAdjustments((prev) => ({ ...prev, rotation: nextRot }));
                        }
                      }}
                      className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#1F2430] hover:bg-[#7C5CFF]/20 text-[10px] font-bold"
                    >
                      {d > 0 ? `+${d}°` : `${d}°`}
                    </button>
                  ))}
                  <span className="tabular-nums text-slate-500 ml-1">
                    {Math.round(currentEntity.rotation)}°
                  </span>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={360}
                value={currentEntity.rotation}
                onChange={(e) => {
                  const nextRot = Number(e.target.value);
                  store.updateEntity(currentEntity.id, 'rotate', (ent) => ({ ...ent, rotation: nextRot }), false);
                  if (keepToolAdjustments && (currentEntity.buildingBlock || currentEntity.kind === 'door')) {
                    setActiveBlockAdjustments((prev) => ({ ...prev, rotation: nextRot }));
                  }
                }}
                className="w-full accent-[#7C5CFF]"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>Elevation (Stack Y)</span>
                <span className="tabular-nums text-slate-500">
                  {(currentEntity.elevationY ?? 0).toFixed(2)}m
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {[
                  { label: '-2m', delta: -2 },
                  { label: '-0.5m', delta: -0.5 },
                  { label: '0m', delta: null },
                  { label: '+0.5m', delta: 0.5 },
                  { label: '+2m', delta: 2 },
                ].map((btn) => (
                  <button
                    key={btn.label}
                    type="button"
                    onClick={() =>
                      store.updateEntity(currentEntity.id, 'change elevation', (ent) => ({
                        ...ent,
                        elevationY:
                          btn.delta === null
                            ? 0
                            : Number(Math.max(-4, (ent.elevationY ?? 0) + btn.delta).toFixed(2)),
                      }))
                    }
                    className="py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] hover:bg-[#7C5CFF]/20 text-[10px] font-bold"
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
              <input
                type="range"
                min={-2}
                max={8}
                step={0.05}
                value={currentEntity.elevationY ?? 0}
                onChange={(e) =>
                  store.updateEntity(
                    currentEntity.id,
                    'fine elevation',
                    (ent) => ({ ...ent, elevationY: Number(e.target.value) }),
                    false
                  )
                }
                className="w-full accent-[#F59E0B]"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold">
                <span>Size</span>
                <span className="tabular-nums text-slate-500">{currentEntity.scale.toFixed(1)}×</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={2.4}
                step={0.1}
                value={currentEntity.scale}
                onChange={(e) => {
                  const nextScale = Number(e.target.value);
                  store.updateEntity(currentEntity.id, 'resize', (ent) => ({ ...ent, scale: nextScale }), false);
                  if (keepToolAdjustments && (currentEntity.buildingBlock || currentEntity.kind === 'door')) {
                    setActiveBlockAdjustments((prev) => ({ ...prev, scale: nextScale }));
                  }
                }}
                className="w-full accent-[#7C5CFF]"
              />
            </div>
          </div>

          {/* Building Block Inspector */}
          {currentEntity.buildingBlock && (() => {
            const bb = currentEntity.buildingBlock!;
            const [baseW, baseH, baseD] = getBuildingShapeBaseSize(bb.shape);
            const curW = Number((baseW * (bb.scaleX ?? 1)).toFixed(2));
            const curH = Number((baseH * (bb.scaleY ?? 1)).toFixed(2));
            const curD = Number((baseD * (bb.scaleZ ?? 1)).toFixed(2));
            const patchBb = (label: string, patch: Partial<typeof bb>, recordUndo = true) => {
              store.updateEntity(
                currentEntity.id,
                label,
                (ent) => ({
                  ...ent,
                  buildingBlock: { ...(ent.buildingBlock ?? bb), ...patch },
                }),
                recordUndo
              );
              if (keepToolAdjustments) {
                if (patch.shape) setActiveBuildShape(patch.shape);
                if (patch.material) setActiveBuildMaterial(patch.material);
                setActiveBlockAdjustments((prev) => ({
                  ...prev,
                  ...(patch.scaleX !== undefined ? { scaleX: patch.scaleX } : {}),
                  ...(patch.scaleY !== undefined ? { scaleY: patch.scaleY } : {}),
                  ...(patch.scaleZ !== undefined ? { scaleZ: patch.scaleZ } : {}),
                  ...(patch.edgeWear !== undefined ? { edgeWear: patch.edgeWear } : {}),
                  ...(patch.archStyle !== undefined ? { archStyle: patch.archStyle } : {}),
                  ...(patch.windowStyle !== undefined ? { windowStyle: patch.windowStyle } : {}),
                  ...(patch.roofStyle !== undefined ? { roofStyle: patch.roofStyle } : {}),
                  ...(patch.roofMedievalTruss !== undefined ? { roofMedievalTruss: patch.roofMedievalTruss } : {}),
                  ...(patch.beamOrientation !== undefined ? { beamOrientation: patch.beamOrientation } : {}),
                  ...(patch.fenceStyle !== undefined ? { fenceStyle: patch.fenceStyle } : {}),
                }));
              }
            };
            const isWallLike =
              bb.shape === 'wallCube' || bb.shape === 'wallCubeHalf' || bb.shape === 'halfWall';
            return (
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-[#1F2430] space-y-2.5">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Building Block
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (!keepToolAdjustments) toggleKeepToolAdjustments();
                        captureEntityIntoActiveTool(currentEntity);
                      }}
                      className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-[#F59E0B]/15 text-[#D97706] dark:text-[#FBBF24]"
                    >
                      Use on Tool
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleKeepToolAdjustments()}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                        keepToolAdjustments
                          ? 'bg-[#7C5CFF] text-white'
                          : 'bg-white dark:bg-[#171A23] text-slate-500'
                      }`}
                    >
                      Keep: {keepToolAdjustments ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>

                <select
                  value={bb.shape}
                  onChange={(e) => {
                    const nextShape = e.target.value as BuildingShapeId;
                    patchBb('change block shape', { shape: nextShape });
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#171A23] text-xs font-semibold"
                >
                  {BUILDING_SHAPES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label} — {s.blurb}
                    </option>
                  ))}
                </select>

                <div className="p-2 rounded-lg bg-white/80 dark:bg-[#171A23]/80 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-bold">
                    <span>Dimensions</span>
                    <span className="tabular-nums text-[#F59E0B]">
                      {curW.toFixed(2)}×{curH.toFixed(2)}×{curD.toFixed(2)}m
                    </span>
                  </div>
                  {[
                    { label: 'Width (X)', val: curW, base: baseW, key: 'scaleX' },
                    { label: 'Height (Y)', val: curH, base: baseH, key: 'scaleY' },
                    { label: 'Length (Z)', val: curD, base: baseD, key: 'scaleZ' },
                  ].map((d) => (
                    <input
                      key={d.key}
                      type="range"
                      min={0.2}
                      max={6.0}
                      step={0.05}
                      value={d.val}
                      title={d.label}
                      onChange={(e) =>
                        patchBb(`resize ${d.label}`, { [d.key]: Number((Number(e.target.value) / d.base).toFixed(3)) }, false)
                      }
                      className="w-full accent-[#7C5CFF]"
                    />
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-1">
                  {BUILDING_MATERIALS.map((mat) => (
                    <button
                      key={mat.id}
                      type="button"
                      onClick={() => patchBb('change block material', { material: mat.id })}
                      className={`flex items-center gap-1 px-1.5 py-1 rounded-lg text-[10px] font-bold border ${
                        bb.material === mat.id
                          ? 'border-[#F59E0B] bg-[#F59E0B]/15 text-[#D97706] dark:text-[#FBBF24]'
                          : 'border-transparent bg-white dark:bg-[#171A23] text-slate-600 dark:text-[#949BB0]'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-sm border border-black/25 shrink-0"
                        style={{ backgroundColor: mat.swatch }}
                      />
                      <span className="truncate">{mat.label.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>

                {(isWallLike || bb.material === 'sandstone') && (
                  <label className="block space-y-1">
                    <div className="flex justify-between text-[10px] font-bold">
                      <span>Bevel &amp; Edge Erosion</span>
                      <span className="tabular-nums">
                        {Math.round((bb.edgeWear ?? 0) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={bb.edgeWear ?? (bb.material === 'sandstone' ? 0.35 : 0)}
                      onChange={(e) => patchBb('edge wear', { edgeWear: Number(e.target.value) }, false)}
                      className="w-full accent-[#D97706]"
                    />
                  </label>
                )}

                {bb.shape === 'archway' && (
                  <div className="grid grid-cols-2 gap-1">
                    {(['arched', 'rectangular'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => patchBb('archway style', { archStyle: st })}
                        className={`py-1 rounded-lg text-[10px] font-bold capitalize ${
                          (bb.archStyle ?? 'arched') === st
                            ? 'bg-[#7C5CFF] text-white'
                            : 'bg-white dark:bg-[#171A23]'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                )}

                {bb.shape === 'windowWall' && (
                  <div className="grid grid-cols-2 gap-1">
                    {(['open', 'barred', 'shuttered', 'paned'] as const).map((wId) => (
                      <button
                        key={wId}
                        type="button"
                        onClick={() => patchBb('window style', { windowStyle: wId })}
                        className={`py-1 rounded-lg text-[10px] font-bold capitalize ${
                          (bb.windowStyle ?? 'barred') === wId
                            ? 'bg-[#7C5CFF] text-white'
                            : 'bg-white dark:bg-[#171A23]'
                        }`}
                      >
                        {wId}
                      </button>
                    ))}
                  </div>
                )}

                {(bb.shape === 'roofAFrame' || bb.shape === 'roofSlope') && (
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-2 gap-1">
                      {(
                        [
                          { id: 'thatched', label: 'Thatched' },
                          { id: 'tiled', label: 'Tiled' },
                          { id: 'shingled', label: 'Shingled' },
                          { id: 'woodSlats', label: 'Wood Slats' },
                        ] as { id: RoofStyleId; label: string }[]
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            patchBb('roof style', {
                              roofStyle: opt.id,
                              material: roofStyleToMaterial(opt.id),
                            })
                          }
                          className={`py-1 rounded-lg text-[10px] font-bold ${
                            (bb.roofStyle ?? inferRoofStyleFromMaterial(bb.material)) === opt.id
                              ? 'bg-[#F59E0B] text-white'
                              : 'bg-white dark:bg-[#171A23]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <label className="flex items-center justify-between text-[11px] font-semibold cursor-pointer">
                      <span>Medieval Timber Truss</span>
                      <input
                        type="checkbox"
                        checked={bb.roofMedievalTruss !== false}
                        onChange={(e) => patchBb('roof truss', { roofMedievalTruss: e.target.checked })}
                        className="accent-[#F59E0B]"
                      />
                    </label>
                  </div>
                )}

                {bb.shape === 'fence' && (
                  <div className="grid grid-cols-3 gap-1">
                    {(
                      [
                        { id: 'rail', label: 'Split Rail' },
                        { id: 'picket', label: 'Picket' },
                        { id: 'medieval', label: 'X-Brace' },
                      ] as { id: FenceStyleId; label: string }[]
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => patchBb('fence style', { fenceStyle: opt.id })}
                        className={`py-1 rounded-lg text-[10px] font-bold ${
                          (bb.fenceStyle ?? 'rail') === opt.id
                            ? 'bg-[#7C5CFF] text-white'
                            : 'bg-white dark:bg-[#171A23]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}

                {(bb.shape === 'beamLarge' || bb.shape === 'beamSmall' || bb.shape === 'plankTrim') && (
                  <div className="grid grid-cols-2 gap-1">
                    {(
                      [
                        { id: 'horizontal', label: 'Flat (0°)' },
                        { id: 'vertical', label: 'Upright (90°)' },
                        { id: 'diag45', label: 'Brace (+45°)' },
                        { id: 'diagNeg45', label: 'Brace (-45°)' },
                      ] as { id: BeamOrientation; label: string }[]
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => patchBb('beam pose', { beamOrientation: opt.id })}
                        className={`py-1 rounded-lg text-[10px] font-bold ${
                          (bb.beamOrientation ?? 'horizontal') === opt.id
                            ? 'bg-[#F59E0B] text-white'
                            : 'bg-white dark:bg-[#171A23]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Door Customizer */}
          {currentEntity.kind === 'door' && (() => {
            const dc = currentEntity.doorConfig;
            const patchDoor = (label: string, patch: Partial<DoorConfig>) => {
              store.updateEntity(currentEntity.id, label, (ent) => ({
                ...ent,
                doorConfig: { ...(ent.doorConfig ?? DEFAULT_DOOR_CONFIG), ...patch },
              }));
            };
            return (
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-[#1F2430] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Door Customizer
                  </span>
                  {!dc && (
                    <button
                      type="button"
                      onClick={() => patchDoor('enable modular door', {})}
                      className="px-2 py-0.5 rounded-lg bg-[#7C5CFF] text-white text-[10px] font-bold"
                    >
                      Customize
                    </button>
                  )}
                </div>
                {dc && (
                  <div className="grid grid-cols-2 gap-1.5">
                    <select
                      value={dc.frameShape}
                      onChange={(e) => patchDoor('door frame', { frameShape: e.target.value as DoorFrameShape })}
                      className="px-2 py-1 rounded-lg bg-white dark:bg-[#171A23] text-[11px] font-semibold"
                    >
                      <option value="arched">Arched Frame</option>
                      <option value="rectangular">Rect Frame</option>
                    </select>
                    <select
                      value={dc.openMode}
                      onChange={(e) => patchDoor('door mode', { openMode: e.target.value as DoorOpenMode })}
                      className="px-2 py-1 rounded-lg bg-white dark:bg-[#171A23] text-[11px] font-semibold"
                    >
                      <option value="hingedSide">Side Swing</option>
                      <option value="doubleSplit">Middle Split</option>
                      <option value="sliding">Sliding Up</option>
                    </select>
                    <select
                      value={dc.leafStyle}
                      onChange={(e) => patchDoor('door leaf', { leafStyle: e.target.value as DoorLeafStyle })}
                      className="px-2 py-1 rounded-lg bg-white dark:bg-[#171A23] text-[11px] font-semibold"
                    >
                      <option value="rusticWood">Rustic Wood</option>
                      <option value="woodPlank">Wooden Plank</option>
                      <option value="solidMetal">Solid Iron</option>
                      <option value="ironBars">Metal Bars</option>
                      <option value="jailCage">Jail Cage</option>
                    </select>
                    <select
                      value={dc.slotStyle}
                      onChange={(e) => patchDoor('door slot', { slotStyle: e.target.value as DoorSlotStyle })}
                      className="px-2 py-1 rounded-lg bg-white dark:bg-[#171A23] text-[11px] font-semibold"
                    >
                      <option value="none">Solid Leaf</option>
                      <option value="peepSlot">Peep Slot</option>
                      <option value="barredWindow">Barred Window</option>
                    </select>
                  </div>
                )}
              </div>
            );
          })()}

          {(currentEntity.kind === 'prop' || currentEntity.kind === 'checkpoint') && (
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-[#1F2430] space-y-2">
              <select
                value={currentEntity.propPreset ?? ''}
                onChange={(e) =>
                  store.updateEntity(currentEntity.id, 'change prop structure', (ent) => ({
                    ...ent,
                    propPreset: (e.target.value || undefined) as PropPresetId | undefined,
                  }))
                }
                className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#171A23] text-xs font-semibold"
              >
                <option value="">Standard Prop</option>
                <option value="savePlinth">Save / Spawn Plinth (Blue Glow)</option>
                <option value="tavern">Woodland Tavern</option>
                <option value="cottage">Burrow Cottage</option>
                <option value="dock">Lakeside Dock</option>
                <option value="campfire">Campfire Ring</option>
                <option value="craftingBench">Crafting Bench</option>
                <option value="signpost">Trail Signpost</option>
                <option value="ramp">Timber Stunt Ramp</option>
                <option value="flightCube">Flight Bonus Cube</option>
                <option value="boostPad">Turbo Boost Pad</option>
                <option value="roadBarrier">Road Hazard Barrier</option>
                <option value="checkpointArch">Rally Checkpoint Arch</option>
              </select>

              {isSavePlinthEntity(currentEntity) && (
                <div className="p-2.5 rounded-xl bg-[#0EA5E9]/10 border border-[#38BDF8]/30 space-y-2">
                  <div className="text-[11px] font-extrabold text-[#0284C7] dark:text-[#38BDF8]">
                    Save / Spawn Plinth
                  </div>
                  <p className="text-[10px] text-slate-600 dark:text-[#949BB0] leading-snug">
                    Touching this plinth in Play mode saves progress and opens the World Map to fast-travel to any discovered plinth.
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      const existingId =
                        currentEntity.customAssetId ?? store.currentProject?.savePlinthAssetId;
                      const existingMeta = existingId
                        ? store.customAssets.find(
                            (a) => a.id === existingId && Boolean(a.objectRecipe)
                          )
                        : undefined;
                      if (existingMeta) {
                        if (!currentEntity.customAssetId) {
                          store.updateEntity(
                            currentEntity.id,
                            'link custom save plinth',
                            (ent) => ({
                              ...ent,
                              propPreset: 'savePlinth',
                              customAssetId: existingMeta.id,
                            }),
                            false
                          );
                        }
                        store.openObjectMaker(existingMeta.id);
                        return;
                      }
                      const doc = createSavePlinthObjectDoc();
                      const { buffer, root } = await buildAndExportObjectDocToGlb(doc);
                      disposeObject3D(root);
                      const saved = await store.saveGeneratedAsset({
                        name: 'Save / Spawn Plinth',
                        category: 'prop',
                        buffer,
                        objectRecipe: doc,
                        keepMetricScale: true,
                      });
                      store.updateProject(
                        'link project save plinth asset',
                        (proj) => ({ ...proj, savePlinthAssetId: saved.id }),
                        false
                      );
                      store.updateEntity(
                        currentEntity.id,
                        'link entity save plinth asset',
                        (ent) => ({
                          ...ent,
                          propPreset: 'savePlinth',
                          customAssetId: saved.id,
                        }),
                        false
                      );
                      store.openObjectMaker(saved.id);
                    }}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-[11px] font-extrabold transition-colors"
                  >
                    <Shapes size={13} />
                    <span>Modify Plinth in Object Editor</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {currentEntity.kind === 'fxEmitter' && (
            <FxEmitterInspector
              entity={currentEntity}
              store={store}
              onTriggerBurst={onTriggerFxBurst}
              onSaveToLibrary={onSaveEntityToFxLibrary}
            />
          )}

          {currentEntity.canopyTree && (
            <CanopyTreeInspector
              entity={currentEntity}
              store={store}
              onOpenStudio={() => store.openTreeMaker()}
              onOpenVertexPainter={() => store.setVertexPaintTarget(currentEntity.id)}
            />
          )}

          {currentEntity.platformerAddon && (
            <PlatformerModuleInspector store={store} entity={currentEntity} />
          )}

          {/* Material & Weathering */}
          {currentEntity.kind !== 'fxEmitter' && currentEntity.kind !== 'light' && (
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-[#1F2430] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Material &amp; Weathering
                </span>
                {currentEntity.materialVariant && (
                  <button
                    type="button"
                    onClick={() =>
                      store.updateEntity(currentEntity.id, 'reset material', (ent) => ({
                        ...ent,
                        materialVariant: undefined,
                      }))
                    }
                    className="text-[10px] font-bold text-[#7C5CFF] hover:underline"
                  >
                    Reset
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between text-[11px] font-semibold">
                <span>Tint Color</span>
                <input
                  type="color"
                  value={currentEntity.materialVariant?.colorHex ?? '#ffffff'}
                  onChange={(e) =>
                    store.updateEntity(
                      currentEntity.id,
                      'tint material',
                      (ent) => ({
                        ...ent,
                        materialVariant: { ...ent.materialVariant, colorHex: e.target.value },
                      }),
                      false
                    )
                  }
                  className="w-7 h-6 rounded border border-slate-300 dark:border-white/15 bg-transparent cursor-pointer"
                />
              </div>
              <label className="block space-y-0.5">
                <div className="flex justify-between text-[10px] font-semibold">
                  <span>Wear Intensity</span>
                  <span className="tabular-nums">
                    {Math.round((currentEntity.materialVariant?.wearFactor ?? 0) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={currentEntity.materialVariant?.wearFactor ?? 0}
                  onChange={(e) =>
                    store.updateEntity(
                      currentEntity.id,
                      'adjust wear factor',
                      (ent) => ({
                        ...ent,
                        materialVariant: { ...ent.materialVariant, wearFactor: Number(e.target.value) },
                      }),
                      false
                    )
                  }
                  className="w-full accent-[#D97706]"
                />
              </label>
              <div className="grid grid-cols-5 gap-1">
                {WEATHERING_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      store.updateEntity(currentEntity.id, 'weathering preset', (ent) => ({
                        ...ent,
                        materialVariant: {
                          ...ent.materialVariant,
                          weathering: preset.id,
                          weatheringIntensity: ent.materialVariant?.weatheringIntensity ?? 0.65,
                        },
                      }))
                    }
                    className={`py-1 px-1 rounded-lg text-[9px] font-bold truncate ${
                      (currentEntity.materialVariant?.weathering ?? 'none') === preset.id
                        ? 'bg-[#7C5CFF] text-white'
                        : 'bg-white dark:bg-[#171A23] text-slate-600 dark:text-[#949BB0]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Contextual Actions */}
          <div className="pt-2 border-t border-slate-200/70 dark:border-white/[0.08] space-y-1.5">
            {(currentEntity.kind === 'npc' || currentEntity.kind === 'baddie' || currentEntity.kind === 'sign') && (
              <button
                type="button"
                onClick={() => onOpenChatBubbleForEntity(currentEntity.id)}
                className="w-full py-2 rounded-xl bg-[#38BDF8]/15 text-xs font-bold text-[#0EA5E9] dark:text-[#38BDF8] hover:bg-[#38BDF8]/25 inline-flex items-center justify-center gap-1.5"
              >
                <MessageCircle size={13} />
                <span>Customize Chat Bubble</span>
              </button>
            )}

            {currentEntity.kind !== 'fxEmitter' && (
              <button
                type="button"
                onClick={() => store.setVertexPaintTarget(currentEntity.id)}
                className="w-full py-2 rounded-xl bg-[#EC4899]/15 text-xs font-bold text-[#EC4899] hover:bg-[#EC4899]/25 inline-flex items-center justify-center gap-1.5"
              >
                <Paintbrush size={13} />
                <span>Vertex Paint &amp; Degrade</span>
              </button>
            )}

            {currentEntity.buildingBlock && (
              <button
                type="button"
                disabled={savingBuildingAsset}
                onClick={async () => {
                  if (savingBuildingAsset || !currentEntity.buildingBlock) return;
                  setSavingBuildingAsset(true);
                  let rawGrp: ReturnType<typeof buildBuildingBlockMesh> | null = null;
                  let thumbGrp: ReturnType<typeof buildBuildingBlockMesh> | null = null;
                  try {
                    rawGrp = buildBuildingBlockMesh(currentEntity.buildingBlock, 1, 0);
                    const buffer = await exportObjectGroupToGlbBuffer(rawGrp);
                    thumbGrp = buildBuildingBlockMesh(currentEntity.buildingBlock, 1, 0);
                    if (currentEntity.vertexPaintStrokes?.length) {
                      applyVertexPaintStrokesToObject(thumbGrp, currentEntity.vertexPaintStrokes);
                    }
                    const thumbnailOverride = await renderObject3DThumbnail(thumbGrp);
                    await store.saveGeneratedAsset({
                      name: currentEntity.name,
                      category: 'building',
                      buffer,
                      buildingBlock: JSON.parse(JSON.stringify(currentEntity.buildingBlock)),
                      vertexPaintStrokes: currentEntity.vertexPaintStrokes,
                      thumbnailOverride,
                      keepMetricScale: true,
                    });
                    setSavedBuildingAssetNote(`Saved "${currentEntity.name}"`);
                    window.setTimeout(() => setSavedBuildingAssetNote(null), 2400);
                  } finally {
                    if (rawGrp) disposeObject3D(rawGrp);
                    if (thumbGrp) disposeObject3D(thumbGrp);
                    setSavingBuildingAsset(false);
                  }
                }}
                className="w-full py-2 rounded-xl bg-[#F59E0B]/15 text-xs font-extrabold text-[#D97706] dark:text-[#FBBF24] hover:bg-[#F59E0B]/25 inline-flex items-center justify-center gap-1.5"
              >
                <Save size={13} />
                <span>
                  {savingBuildingAsset ? 'Saving Block…' : savedBuildingAssetNote ?? 'Save Block to Buildings'}
                </span>
              </button>
            )}

            {selectedEntityCustom && (
              <button
                type="button"
                onClick={() => {
                  if (selectedEntityCustom.category === 'plant') store.openPlantMaker(selectedEntityCustom.id);
                  else if (selectedEntityCustom.category === 'character') store.openCharacterMaker(selectedEntityCustom.id);
                  else if (selectedEntityCustom.category === 'tree') store.openTreeMaker(selectedEntityCustom.id);
                  else store.openObjectMaker(selectedEntityCustom.id);
                }}
                className="w-full py-2 rounded-xl bg-[#7C5CFF]/15 text-[#7C5CFF] hover:bg-[#7C5CFF]/25 text-xs font-extrabold inline-flex items-center justify-center gap-1.5"
              >
                {selectedEntityCustom.category === 'character' ? <User size={13} /> : <Shapes size={13} />}
                <span>Edit Source in Maker</span>
              </button>
            )}

            {(currentEntity.monsterConfig ||
              (!selectedEntityCustom && (currentEntity.kind === 'baddie' || currentEntity.kind === 'npc'))) && (
              <button
                type="button"
                onClick={() =>
                  store.openMonsterMaker({
                    entityId: currentEntity.id,
                    blueprint: currentEntity.monsterConfig ?? undefined,
                  })
                }
                className="w-full py-2 rounded-xl bg-[#EC4899]/15 text-[#EC4899] hover:bg-[#EC4899]/25 text-xs font-extrabold inline-flex items-center justify-center gap-1.5"
              >
                <Sparkles size={13} />
                <span>
                  {currentEntity.monsterConfig
                    ? 'Edit in Creature Maker'
                    : 'Make Creature (4/6/8 Legs)'}
                </span>
              </button>
            )}

            {currentEntity.kind !== 'fxEmitter' && (envType === 'openWorld' || envType === 'castle') && (
              <button
                type="button"
                onClick={() => {
                  if (currentEntity.customAssetId) {
                    onAddVistaItem('custom', currentEntity.customAssetId, currentEntity.name);
                    return;
                  }
                  const lower = currentEntity.name.toLowerCase();
                  const mappedKind: VistaPropKind = lower.includes('pine')
                    ? 'pineCluster'
                    : lower.includes('birch')
                    ? 'birchCluster'
                    : lower.includes('tree') || lower.includes('oak')
                    ? 'oakCluster'
                    : lower.includes('tower') || lower.includes('castle') || lower.includes('ruin')
                    ? 'castleRuins'
                    : lower.includes('mountain') || lower.includes('peak')
                    ? 'mountain'
                    : 'boulderRidge';
                  onAddVistaItem(mappedKind, undefined, currentEntity.name);
                }}
                className="w-full py-2 rounded-xl bg-[#20B46A]/15 text-xs font-bold text-[#20B46A] hover:bg-[#20B46A]/25 inline-flex items-center justify-center gap-1.5"
              >
                <Mountain size={13} />
                <span>Place Copy on Distant Horizon</span>
              </button>
            )}

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => store.setSelectedTab('logic')}
                className="py-2 rounded-xl bg-[#A855F7]/15 text-[11px] font-bold text-[#A855F7] hover:bg-[#A855F7]/25"
              >
                Rules ({currentEntity.cards.length})
              </button>
              <button
                type="button"
                onClick={() => store.deleteEntity(currentEntity.id)}
                className="py-2 rounded-xl bg-[#F2545B]/12 text-[11px] font-bold text-[#F2545B] hover:bg-[#F2545B]/20 inline-flex items-center justify-center gap-1"
              >
                <Trash2 size={12} />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </>
      ) : showBuildingPlacementInspector ? (
        (() => {
          const isDoorTool = activeBuildShape === 'door' || activeBuildShape === 'rusticDoor';
          const [baseW, baseH, baseD] = isDoorTool
            ? [2.0, 2.4, 0.7]
            : getBuildingShapeBaseSize(activeBuildShape);
          const curW = Number((baseW * activeBlockAdjustments.scaleX).toFixed(2));
          const curH = Number((baseH * activeBlockAdjustments.scaleY).toFixed(2));
          const curD = Number((baseD * activeBlockAdjustments.scaleZ).toFixed(2));
          return (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Box size={15} className="text-[#F59E0B]" />
                  <h2 className="text-sm font-extrabold">Building Placement</h2>
                </div>
                <button
                  type="button"
                  onClick={() => toggleKeepToolAdjustments()}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold ${
                    keepToolAdjustments
                      ? 'bg-[#7C5CFF] text-white'
                      : 'bg-slate-100 dark:bg-[#1F2430] text-slate-500'
                  }`}
                >
                  Keep: {keepToolAdjustments ? 'ON' : 'OFF'}
                </button>
              </div>
              <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2">
                <div className="text-[11px] font-bold text-[#F59E0B] tabular-nums">
                  Preview: {curW.toFixed(2)}×{curH.toFixed(2)}×{curD.toFixed(2)}m @{' '}
                  {Math.round(activeBlockAdjustments.rotation)}°
                </div>
                {[
                  { label: 'Width (X)', val: curW, base: baseW, key: 'scaleX' },
                  { label: 'Height (Y)', val: curH, base: baseH, key: 'scaleY' },
                  { label: 'Length (Z)', val: curD, base: baseD, key: 'scaleZ' },
                ].map((d) => (
                  <label key={d.key} className="block space-y-0.5">
                    <div className="flex justify-between text-[10px] font-semibold">
                      <span>{d.label}</span>
                      <span className="tabular-nums">{d.val.toFixed(2)}m</span>
                    </div>
                    <input
                      type="range"
                      min={0.2}
                      max={6.0}
                      step={0.05}
                      value={d.val}
                      onChange={(e) => {
                        if (!keepToolAdjustments) toggleKeepToolAdjustments();
                        setActiveBlockAdjustments((prev) => ({
                          ...prev,
                          [d.key]: Number((Number(e.target.value) / d.base).toFixed(3)),
                        }));
                      }}
                      className="w-full accent-[#7C5CFF]"
                    />
                  </label>
                ))}
                <div className="grid grid-cols-4 gap-1 pt-1">
                  {[-90, -45, 45, 90].map((delta) => (
                    <button
                      key={delta}
                      type="button"
                      onClick={() => {
                        if (!keepToolAdjustments) toggleKeepToolAdjustments();
                        setActiveBlockAdjustments((prev) => ({
                          ...prev,
                          rotation: (Math.round((prev.rotation + delta) / 45) * 45 + 360) % 360,
                        }));
                      }}
                      className="py-1 rounded-lg bg-white dark:bg-[#171A23] text-[10px] font-bold"
                    >
                      {delta > 0 ? `+${delta}°` : `${delta}°`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2">
                <div className="flex items-center justify-between">
                  <FieldLabel text="Curve Placement" />
                  <button
                    type="button"
                    onClick={() => setCurveGuideEnabled((v) => !v)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold ${
                      curveGuideEnabled ? 'bg-[#0EA5E9] text-white' : 'bg-white dark:bg-[#171A23]'
                    }`}
                  >
                    {curveGuideEnabled ? 'Active' : 'Enable'}
                  </button>
                </div>
                {curveGuideEnabled && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-1">
                      {(['arc', 'sCurve', 'semiCircle', 'circle', 'free'] as CurveGuidePresetId[]).map(
                        (p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => applyBuildingCurvePreset(p)}
                            className={`py-1 rounded-lg text-[10px] font-bold ${
                              buildingCurve.preset === p
                                ? 'bg-[#0EA5E9] text-white'
                                : 'bg-white dark:bg-[#171A23]'
                            }`}
                          >
                            {p}
                          </button>
                        )
                      )}
                    </div>
                    {buildingCurve.preset !== 'free' ? (
                      <>
                        <label className="block space-y-0.5 text-[10px] font-semibold">
                          <span>Span ({curveSpan}m)</span>
                          <input
                            type="range"
                            min={4}
                            max={28}
                            value={curveSpan}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              setCurveSpan(v);
                              applyBuildingCurvePreset(buildingCurve.preset, v, curveBend);
                            }}
                            className="w-full accent-[#0EA5E9]"
                          />
                        </label>
                        <label className="block space-y-0.5 text-[10px] font-semibold">
                          <span>Bend ({curveBend.toFixed(1)}m)</span>
                          <input
                            type="range"
                            min={-10}
                            max={10}
                            step={0.5}
                            value={curveBend}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              setCurveBend(v);
                              applyBuildingCurvePreset(buildingCurve.preset, curveSpan, v);
                            }}
                            className="w-full accent-[#0EA5E9]"
                          />
                        </label>
                      </>
                    ) : (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setCurvePickMode((v) => !v)}
                          className={`flex-1 py-1 rounded-lg text-[10px] font-extrabold ${
                            curvePickMode ? 'bg-[#F59E0B] text-white' : 'bg-white dark:bg-[#171A23]'
                          }`}
                        >
                          {curvePickMode ? 'Clicking Terrain…' : 'Pick Points'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setBuildingCurve((p) => ({ ...p, points: [] }))}
                          className="px-2 py-1 rounded-lg bg-white dark:bg-[#171A23] text-[10px] font-bold"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={2}
                        max={36}
                        value={curveBlockCount}
                        onChange={(e) =>
                          setCurveBlockCount(Math.max(2, Math.min(36, Number(e.target.value) || 2)))
                        }
                        className="w-14 px-2 py-1 rounded-lg bg-white dark:bg-[#171A23] text-xs font-bold tabular-nums"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (buildingCurve.points.length < 2) return;
                          const len = computeCurveLength(buildingCurve);
                          setCurveBlockCount(
                            Math.max(2, Math.min(36, Math.round(len / Math.max(0.4, placementGhostSize[0]))))
                          );
                        }}
                        className="px-2 py-1 rounded-lg bg-white dark:bg-[#171A23] text-[10px] font-bold"
                      >
                        Auto-Fit
                      </button>
                      <button
                        type="button"
                        disabled={buildingCurve.points.length < 2}
                        onClick={handleStampBuildingCurveBlocks}
                        className="flex-1 py-1 rounded-lg bg-[#20B46A] disabled:opacity-40 text-white text-[10px] font-extrabold"
                      >
                        Stamp {curveBlockCount}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()
      ) : domain === 'platformerKit' ? (
        <PlatformerMovementInspector store={store} level={currentLevel} />
      ) : domain === 'particleFx' ? (
        (() => {
          const customCount = allFxTemplates.filter((t) => t.isCustom).length;
          const catTabs: FxLibraryCategory[] = [
            'all',
            'fireHeat',
            'weather',
            'magic',
            'nature',
            'critters',
            ...(customCount > 0 ? (['custom'] as FxLibraryCategory[]) : []),
          ];
          const filteredFx = allFxTemplates.filter(
            (t) => fxCategoryFilter === 'all' || t.category === fxCategoryFilter
          );
          return (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-[#F59E0B]" />
                  <h2 className="text-sm font-extrabold">Particle FX</h2>
                </div>
                <button
                  type="button"
                  onClick={() => store.setShowingFxLibrary(!store.showingFxLibrary)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-extrabold border ${
                    store.showingFxLibrary
                      ? 'bg-[#F59E0B] border-[#F59E0B] text-white'
                      : 'bg-slate-100 dark:bg-[#1F2430] border-transparent text-slate-600 dark:text-slate-200'
                  }`}
                >
                  {store.showingFxLibrary ? 'Hide Bottom Dock' : 'Open Dock'}
                </button>
              </div>

              <div className="flex flex-wrap gap-1">
                {catTabs.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFxCategoryFilter(cat)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                      fxCategoryFilter === cat
                        ? 'bg-[#F59E0B] text-white'
                        : 'bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#949BB0]'
                    }`}
                  >
                    {FX_LIBRARY_CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>

              <div className="space-y-1.5">
                {filteredFx.map((tpl) => {
                  const armed = placeFxTemplateId === tpl.id;
                  return (
                    <div
                      key={tpl.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(FX_DRAG_MIME, tpl.id);
                        e.dataTransfer.setData('text/plain', tpl.id);
                        e.dataTransfer.effectAllowed = 'copy';
                        onDragStartFxTemplate?.(tpl);
                      }}
                      onDragEnd={() => onDragEndFxTemplate?.()}
                      className={`p-2 rounded-xl border transition-all cursor-grab active:cursor-grabbing ${
                        armed
                          ? 'bg-[#F59E0B]/12 border-[#F59E0B]'
                          : 'bg-slate-100 dark:bg-[#1F2430] border-transparent hover:border-[#F59E0B]/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => onSelectPlaceFxTemplate?.(armed ? null : tpl)}
                          className="flex-1 min-w-0 flex items-center gap-2 text-left"
                        >
                          <span
                            className="w-6 h-6 rounded-lg shrink-0 flex items-center justify-center text-white"
                            style={{
                              background: `linear-gradient(135deg, ${tpl.accentHex}, ${tpl.secondaryHex})`,
                            }}
                          >
                            <Sparkles size={12} />
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold truncate">{tpl.name}</div>
                            <div className="text-[10px] text-slate-500 dark:text-[#949BB0] truncate">
                              {armed ? 'Click ground in 3D to drop' : tpl.summary}
                            </div>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => onQuickPlaceFxCenter?.(tpl)}
                          title={`Drop ${tpl.name} into center of scene`}
                          className="px-2 py-1 rounded-lg bg-white dark:bg-[#171A23] hover:bg-[#F59E0B] hover:text-white text-[10px] font-extrabold shrink-0"
                        >
                          + Add
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()
      ) : (
        <MakerCard padding="p-4" className="!bg-slate-100 dark:!bg-[#1F2430] border-none space-y-2.5">
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-[#7C5CFF]" />
            <h3 className="text-sm font-extrabold">World Job Inspector</h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-[#949BB0] leading-relaxed">
            Click any character, chest, door, lake, cave, or trail in the scene (or pick a job from the left panel) to inspect its contextual tools here.
          </p>
          <div className="text-[11px] font-semibold text-slate-500 dark:text-[#8E96AB] pt-1 tabular-nums">
            <span className="text-[#7C5CFF]">{currentLevel.entities.length} objects</span>
            <span> · </span>
            <span className="text-[#0EA5E9]">{(terrain.waterBodies ?? []).length} water</span>
            <span> · </span>
            <span className="text-[#A855F7]">{(terrain.caves ?? []).length} caves</span>
          </div>
        </MakerCard>
      )}
    </aside>
  );
};
