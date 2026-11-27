import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionRegistry,
  createBlankLevel,
  createEntity,
  createStarterOpenWorldPickups,
  defaultHUDProfile,
  DefaultCraftingRecipes,
  DefaultInventoryItems,
  getProjectInventoryItems,
  makeWidget,
  Palette,
  projectFromTemplate,
  resolveGameInventoryConfig,
  resolveItemMetadata,
  starterProjects,
  StarterActions,
  WidgetKindMeta,
} from '../data/registries';
import type { FxLibraryTemplate } from '../data/fxEffectLibrary';
import {
  evictCachedAsset,
  parseUploadedGlbFile,
  registerGeneratedGlbAsset,
} from '../three/gltfAssetManager';
import { buildAndExportObjectDocToGlb } from '../three/objectMakerBuilder';
import {
  createFallenLogObjectDoc,
  FALLBACK_FALLEN_LOG_ASSET_ID,
} from '../three/fallenLogAsset';
import { setCustomAssetThumbnailCache } from '../three/assetThumbnailer';
import {
  collectReferencedTextureIds,
  evictCustomTexture,
  primeCustomTextureCanvas,
} from '../three/customTextureManager';
import { measurePersistence, measureStateUpdate } from '../utils/resourceMonitor';
import { HERO_START_ENTITY_ID } from '../types/maker';
import type {
  AssetCategory,
  BehaviorCard,
  BoardPoint,
  BuildingBlockConfig,
  BuildingMaterialId,
  BuildingShapeId,
  BuiltinMechanismTemplate,
  CaveGrotto,
  CharacterMakerDoc,
  CraftingRecipe,
  CustomAssetMeta,
  CustomClipSlot,
  CustomMotionPreset,
  CustomTextureAssetMeta,
  CustomTextureResolution,
  DoorConfig,
  EntityKind,
  EntityMaterialVariant,
  EntitySection,
  ExportedAssetBundle,
  ExportedTextureBundle,
  ExportedVoiceBundle,
  GameInventoryConfig,
  GameLevel,
  GameProject,
  GameTemplate,
  HUDWidget,
  InventoryItemDef,
  ItemMetadata,
  LevelEntity,
  LogicWorkspaceMode,
  MakerIssue,
  MonsterBlueprint,
  MotionActorTarget,
  MotionAssignmentScope,
  MotionStudioSection,
  ObjectAttachBodyPart,
  ObjectInteractionAttributeId,
  ObjectInteractionCalibration,
  ObjectMakerDoc,
  ObjectMechanism,
  PlayerTelemetry,
  RoadSpline,
  RuleRecipe,
  SavePresetEntry,
  SavePresetScope,
  SavedPosePreset,
  SceneryTextureSlot,
  StageTab,
  StudioTheme,
  StylizedCanopyConfig,
  SurfaceTextureSettings,
  TerrainBrush,
  TerrainBrushFalloff,
  TerrainBrushOptions,
  TerrainData,
  TerrainQualityTier,
  TreeSpeciesType,
  VertexPaintStroke,
  ViewportResolutionScale,
  ViewportShadowQuality,
  ViewportTool,
  VisualStyleId,
  WaterBodyConfig,
  WaterBodyKind,
  WidgetKind,
  WorldDomainId,
  WorldEditorScope,
  WorldLandRegion,
  WorldMapData,
  WorldViewMode,
} from '../types/maker';
import {
  WORLD_MAP_GRID_SIZE,
  WORLD_MAP_RADIUS,
  applyWorldMapStroke,
  clampRegionOrigin,
  compactWorldMapForStorage,
  computeRegionBounds,
  computeRegionCentroids,
  computeRegionWindowRadius,
  createEmptyWorldMap,
  createLandLevelFromTemplate,
  createScratchOceanTerrain,
  ensureWorldMapForProject,
  findNextRegionCode,
  getWorldMapRadius,
  hasManualTerrainEdits,
  hydrateWorldMapFromStorage,
  landLocalToWorldMap,
  pickNextRegionColor,
  syncLevelTerrainWithWorldMap,
  type WorldMapBrushMode,
} from '../utils/worldMap';
import {
  BUILDING_SHAPES,
  DEFAULT_DOOR_CONFIG,
  inferRoofStyleFromMaterial,
} from '../three/buildingBlocks';

type LiveTelemetryListener = (telemetry: PlayerTelemetry | null) => void;
let currentLivePlayerTelemetry: PlayerTelemetry | null = null;
const liveTelemetryListeners = new Set<LiveTelemetryListener>();

export function getLivePlayerTelemetry(): PlayerTelemetry | null {
  return currentLivePlayerTelemetry;
}

export function publishLivePlayerTelemetry(telemetry: PlayerTelemetry | null): void {
  currentLivePlayerTelemetry = telemetry;
  liveTelemetryListeners.forEach((listener) => listener(telemetry));
}

export function subscribeLivePlayerTelemetry(listener: LiveTelemetryListener): () => void {
  liveTelemetryListeners.add(listener);
  return () => {
    liveTelemetryListeners.delete(listener);
  };
}
import { createDefaultCanopyConfig } from '../data/canopyEnginePresets';
import {
  buildCanopyConfigFromUserDefaults,
  hasCustomDefaultTreeStyles,
} from '../utils/defaultTreeStyles';
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  deleteAssetRecord,
  getAssetBlob,
  listAssetMetas,
  saveAssetRecord,
  updateAssetMetaRecord,
} from '../utils/assetVault';
import {
  deleteTextureRecord,
  downsizeStoredTexture,
  getTextureBlobRecord,
  listTextureMetas,
  processUploadedTextureFile,
  saveTextureRecord,
} from '../utils/textureVault';
import {
  collectReferencedVoiceIds,
  collectVoiceIdsFromConfig,
  getVoiceBlobRecord,
  getVoiceMeta,
  saveVoiceRecord,
} from '../utils/voiceVault';
import {
  deletePresetRecord,
  downloadSavePresetsFile,
  listSavedPresets,
  parseSavePresetsFile,
  replaceAllPresetRecords,
  savePresetRecord,
} from '../utils/presetVault';
import {
  buildProjectZipArchive,
  compressMakerBundle,
  isZipArchiveFile,
  readMakerFileAsText,
  readMakerZipAsBundleText,
  triggerBlobDownload,
  type CompressedMakerResult,
  type ZipAssetEntry,
  type ZipProjectExportResult,
  type ZipTextureEntry,
  type ZipVoiceEntry,
} from '../utils/makerArchive';
import {
  apply2DOverviewBrushStroke,
  applyLushGroundFloraToTerrain,
  applyMountainCaveToTerrain,
  applyRoadSplineToTerrain,
  applyTerrainBrush,
  carveWaterBodyIntoTerrain,
  commitCaveSplineStroke,
  createDefaultWaterBodies,
  createInitialTerrain,
  ensureUpgradedTerrain,
  getEnvironmentType,
  getTerrainRadius,
  IslandTerrain,
  levelWorldToBoard,
  normalizeCaveGrotto,
  type CaveSplineStrokeInput,
  type Overview2DBrushId,
  sampleTerrainHeight,
  smoothOrganicMossLayers,
  uid,
} from '../utils/terrain';

import {
  loadProjectsSnapshotFromIDB,
  saveProjectsSnapshotToIDB,
} from '../utils/projectStorage';

const STORAGE_KEY = 'maker.projects.v1';
const MAX_UNDO_HISTORY = 12;
const LOCAL_STORAGE_FALLBACK_MAX_BYTES = 256 * 1024;
const THEME_KEY = 'maker.theme.v1';
const VIEWPORT_QUALITY_KEY = 'maker.viewportQuality.v1';
const WARM_SKY_MIGRATION_KEY = 'maker.warmForestSky.v1';
const ORGANIC_MOSS_MIGRATION_KEY = 'maker.organicMoss.v1';
const MOUNTAIN_CAVE_MIGRATION_KEY = 'maker.mountainCave.v1';
const INVENTORY_STARTER_MIGRATION_KEY = 'maker.inventoryStarter.v1';
const LUSH_FLORA_MIGRATION_KEY = 'maker.lushFlora.v1';
const DUNGEON_BUILDER_FRONT_CAM_MIGRATION_KEY = 'maker.dungeonBuilderFrontCam.v1';

interface HistorySnapshot {
  label: string;
  projects: GameProject[];
}

export interface IdeaSuggestion {
  id: string;
  title: string;
  detail: string;
  symbol: string;
  tint: string;
  actionTitle: string;
  perform: () => void;
}

function migrateProject(proj: GameProject): GameProject {
  const levels = (proj.levels ?? []).map((lvl) => {
    const env = getEnvironmentType(lvl);
    const rawStyle = lvl.visualStyle as string | undefined;
    const visualStyle: VisualStyleId =
      rawStyle === 'celToon' || rawStyle === 'softFantasy' || rawStyle === 'painterlyPBR'
        ? rawStyle
        : 'painterlyPBR';
    return {
      ...lvl,
      environmentType: env,
      visualStyle,
      cameraMode: lvl.cameraMode ?? (env === 'sideScroller' ? 'sideScroll' : 'front'),
      terrain: ensureUpgradedTerrain(lvl.terrain),
    };
  });

  const baseWidgets = proj.hud?.widgets ?? [];
  const hasEnergyBar = baseWidgets.some(
    (w) => w.kind === 'bar' && w.binding === 'energy'
  );
  const relocatedWidgets = baseWidgets.map((w) => {
    if (w.kind === 'objectiveList' && w.anchor === 'top' && w.offsetX === 0 && w.offsetY === 0) {
      return {
        ...w,
        anchor: 'topLeading' as const,
        offsetX: 0,
        offsetY: 138,
        width: Math.max(w.width, 236),
        height: Math.max(w.height, 76),
      };
    }
    if (
      !hasEnergyBar &&
      w.kind === 'objectiveList' &&
      w.anchor === 'topLeading' &&
      w.offsetY <= 112
    ) {
      return {
        ...w,
        offsetY: 138,
      };
    }
    return w;
  });

  if (!hasEnergyBar) {
    relocatedWidgets.push(
      makeWidget('bar', 'topLeading', 'energy', '#FACC15', 'Energy', 0, 102)
    );
  }

  const hasControls = relocatedWidgets.some((w) => w.kind === 'joystick' || w.kind === 'actionButton');
  const hud = hasControls
    ? {
        ...proj.hud,
        widgets: relocatedWidgets,
      }
    : {
        ...proj.hud,
        widgets: [
          ...relocatedWidgets,
          makeWidget('joystick', 'bottomLeading', 'move', '#1E2434', 'Move', 8, -8, {
            width: 112,
            height: 112,
            knobColorHex: '#FFFFFF',
            opacity: 0.85,
          }),
          makeWidget('actionButton', 'bottomTrailing', 'action', '#20B46A', 'Jump', -8, -8, {
            width: 68,
            height: 68,
            actionId: 'jump',
            shape: 'circle',
          }),
          makeWidget('actionButton', 'bottomTrailing', 'action', '#F2545B', 'Hit', -86, -4, {
            width: 56,
            height: 56,
            actionId: 'attack',
            shape: 'circle',
          }),
          makeWidget('actionButton', 'bottomTrailing', 'action', '#F59E0B', 'Use', -18, -84, {
            width: 52,
            height: 52,
            actionId: 'interact',
            shape: 'rounded',
          }),
        ],
      };

  const hydratedWorldMap = hydrateWorldMapFromStorage(proj.worldMap);
  const upgradedWorldMap =
    hydratedWorldMap &&
    (hydratedWorldMap.worldRadius !== WORLD_MAP_RADIUS ||
      hydratedWorldMap.gridSize !== WORLD_MAP_GRID_SIZE)
      ? ensureWorldMapForProject({ ...proj, levels, worldMap: hydratedWorldMap })
      : hydratedWorldMap;

  return {
    ...proj,
    levels,
    hud,
    ...(upgradedWorldMap ? { worldMap: upgradedWorldMap } : {}),
  };
}

function loadInitialProjects(): GameProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GameProject[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        const shouldWarmForest = localStorage.getItem(WARM_SKY_MIGRATION_KEY) !== '1';
        const shouldOrganicMoss = localStorage.getItem(ORGANIC_MOSS_MIGRATION_KEY) !== '1';
        const shouldMountainCave = localStorage.getItem(MOUNTAIN_CAVE_MIGRATION_KEY) !== '1';
        const shouldInventoryStarter = localStorage.getItem(INVENTORY_STARTER_MIGRATION_KEY) !== '1';
        const shouldLushFlora = localStorage.getItem(LUSH_FLORA_MIGRATION_KEY) !== '1';
        const shouldDungeonBuilderFrontCam =
          localStorage.getItem(DUNGEON_BUILDER_FRONT_CAM_MIGRATION_KEY) !== '1';
        const migrated = parsed.map((p) => {
          const base = migrateProject(p);
          if (
            !shouldWarmForest &&
            !shouldOrganicMoss &&
            !shouldMountainCave &&
            !shouldInventoryStarter &&
            !shouldLushFlora &&
            !shouldDungeonBuilderFrontCam
          ) {
            return base;
          }
          return {
            ...base,
            levels: base.levels.map((lvl, lvlIdx) => {
              const env = getEnvironmentType(lvl);
              let nextLvl = lvl;
              if (
                shouldWarmForest &&
                env === 'openWorld' &&
                nextLvl.sky === 'sunny' &&
                nextLvl.timeOfDay === undefined
              ) {
                nextLvl = {
                  ...nextLvl,
                  sky: 'golden' as const,
                  sunAngle: 32,
                  fog: Math.max(nextLvl.fog ?? 0.15, 0.24),
                  weather: nextLvl.weather === 'none' ? ('fireflies' as const) : nextLvl.weather,
                };
              }
              if (shouldOrganicMoss && env === 'openWorld' && nextLvl.terrain) {
                nextLvl = {
                  ...nextLvl,
                  terrain: smoothOrganicMossLayers(nextLvl.terrain),
                };
              }
              if (
                shouldMountainCave &&
                env === 'openWorld' &&
                nextLvl.terrain &&
                !nextLvl.terrain.freeformWorld
              ) {
                nextLvl = {
                  ...nextLvl,
                  terrain: applyMountainCaveToTerrain(nextLvl.terrain),
                };
              }
              if (shouldLushFlora && env === 'openWorld' && nextLvl.terrain) {
                nextLvl = {
                  ...nextLvl,
                  terrain: applyLushGroundFloraToTerrain(nextLvl.terrain),
                };
              }
              if (
                shouldInventoryStarter &&
                env === 'openWorld' &&
                lvlIdx === 0 &&
                !nextLvl.entities.some((e) => e.pickupItemId === 'wood_axe')
              ) {
                const updatedEntities = nextLvl.entities.map((e) =>
                  e.kind === 'treasure' && !e.pickupItemId
                    ? { ...e, pickupable: true, pickupItemId: 'leaf_cloak', pickupQty: 1 }
                    : e.kind === 'prop' && !e.pickupItemId
                    ? { ...e, pickupable: true, pickupItemId: 'river_stone', pickupQty: 2 }
                    : e
                );
                nextLvl = {
                  ...nextLvl,
                  entities: [...updatedEntities, ...createStarterOpenWorldPickups()],
                };
              }
              if (
                shouldDungeonBuilderFrontCam &&
                env === 'dungeon' &&
                nextLvl.gameplayMode !== 'roguelike' &&
                nextLvl.cameraMode === 'chase' &&
                (nextLvl.name.includes('Crypt Keep') ||
                  nextLvl.entities.some((e) => Boolean(e.buildingBlock)))
              ) {
                nextLvl = {
                  ...nextLvl,
                  cameraMode: 'front',
                };
              }
              return nextLvl;
            }),
          };
        });
        if (shouldWarmForest) {
          localStorage.setItem(WARM_SKY_MIGRATION_KEY, '1');
        }
        if (shouldOrganicMoss) {
          localStorage.setItem(ORGANIC_MOSS_MIGRATION_KEY, '1');
        }
        if (shouldMountainCave) {
          localStorage.setItem(MOUNTAIN_CAVE_MIGRATION_KEY, '1');
        }
        if (shouldInventoryStarter) {
          localStorage.setItem(INVENTORY_STARTER_MIGRATION_KEY, '1');
        }
        if (shouldLushFlora) {
          localStorage.setItem(LUSH_FLORA_MIGRATION_KEY, '1');
        }
        if (shouldDungeonBuilderFrontCam) {
          localStorage.setItem(DUNGEON_BUILDER_FRONT_CAM_MIGRATION_KEY, '1');
        }
        return migrated;
      }
    }
  } catch {
    // ignore storage errors
  }
  return starterProjects();
}

function loadInitialTheme(): StudioTheme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // ignore
  }
  return 'dark';
}

function loadInitialViewportQuality(): {
  resolutionScale: ViewportResolutionScale;
  shadowQuality: ViewportShadowQuality;
  terrainQuality: TerrainQualityTier;
} {
  try {
    const raw = localStorage.getItem(VIEWPORT_QUALITY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as {
        resolutionScale?: number;
        shadowQuality?: string;
        terrainQuality?: string;
      };
      const validScales: ViewportResolutionScale[] = [0.5, 0.75, 1, 1.25, 1.5];
      const resolutionScale = validScales.includes(parsed.resolutionScale as ViewportResolutionScale)
        ? (parsed.resolutionScale as ViewportResolutionScale)
        : 1;
      const validShadows: ViewportShadowQuality[] = ['off', 'low', 'medium', 'high'];
      const shadowQuality = validShadows.includes(parsed.shadowQuality as ViewportShadowQuality)
        ? (parsed.shadowQuality as ViewportShadowQuality)
        : 'medium';
      const validTerrainQualities: TerrainQualityTier[] = ['performance', 'balanced', 'ultra'];
      const terrainQuality = validTerrainQualities.includes(parsed.terrainQuality as TerrainQualityTier)
        ? (parsed.terrainQuality as TerrainQualityTier)
        : 'balanced';
      return { resolutionScale, shadowQuality, terrainQuality };
    }
  } catch {
    // ignore
  }
  return { resolutionScale: 1, shadowQuality: 'medium', terrainQuality: 'balanced' };
}

export function useMakerStore() {
  const [projects, setProjects] = useState<GameProject[]>(loadInitialProjects);
  const [theme, setTheme] = useState<StudioTheme>(loadInitialTheme);
  const [viewportResolutionScale, setViewportResolutionScale] = useState<ViewportResolutionScale>(
    () => loadInitialViewportQuality().resolutionScale
  );
  const [viewportShadowQuality, setViewportShadowQuality] = useState<ViewportShadowQuality>(
    () => loadInitialViewportQuality().shadowQuality
  );
  const [terrainQuality, setTerrainQuality] = useState<TerrainQualityTier>(
    () => loadInitialViewportQuality().terrainQuality
  );
  const [customAssets, setCustomAssets] = useState<CustomAssetMeta[]>([]);
  const [customTextures, setCustomTextures] = useState<CustomTextureAssetMeta[]>([]);
  const [savedPresets, setSavedPresets] = useState<SavePresetEntry[]>([]);
  const [showingAssetVault, setShowingAssetVault] = useState(false);
  const [showingPresets, setShowingPresets] = useState(false);
  const [showingLogicFlow, setShowingLogicFlow] = useState(false);
  const [showingPublish, setShowingPublish] = useState(false);
  const [showingDirector, setShowingDirector] = useState(false);
  const [showingTerrainEditor, setShowingTerrainEditorRaw] = useState(false);
  const [rehearseSkitId, setRehearseSkitId] = useState<string | null>(null);

  const [worldTool, setWorldTool] = useState<ViewportTool>('move');
  const [worldGridSnap, setWorldGridSnap] = useState<0 | 0.5 | 1 | 2>(1);
  const [worldViewMode, setWorldViewMode] = useState<WorldViewMode>('2d');
  const [worldEditorScope, setWorldEditorScope] = useState<WorldEditorScope>('worldMap');
  const [selectedWorldLandCode, setSelectedWorldLandCode] = useState<number | null>(null);
  const [worldMapBrushMode, setWorldMapBrushMode] = useState<WorldMapBrushMode>('terrain');
  const [worldMapBrushRadius, setWorldMapBrushRadius] = useState<number>(48);
  const [worldMapAutoLand, setWorldMapAutoLand] = useState<boolean>(false);
  const [activeWorldDomain, setActiveWorldDomain] = useState<WorldDomainId>('select');
  const [cameraAngleLocked, setCameraAngleLocked] = useState(false);
  const [cameraFocusRequest, setCameraFocusRequest] = useState<{
    id: string;
    x: number;
    y: number;
    z: number;
    distance?: number;
    yawDeg?: number;
    pitchDeg?: number;
    nonce: number;
  } | null>(null);
  const [selectedWaterBodyId, setSelectedWaterBodyId] = useState<string | null>(null);
  const [selectedCaveId, setSelectedCaveId] = useState<string | null>(null);
  const [selectedRoadId, setSelectedRoadId] = useState<string | null>(null);
  const [showingAtmosphereDrawer, setShowingAtmosphereDrawer] = useState(false);
  const [showingSkybox, setShowingSkybox] = useState(false);
  const [showingPostFx, setShowingPostFx] = useState(false);
  const [showingFxLibrary, setShowingFxLibrary] = useState(false);
  const [showingTextureStudio, setShowingTextureStudio] = useState(false);
  const [vertexPaintTarget, setVertexPaintTarget] = useState<string | null>(null);
  const [attributeModifierTarget, setAttributeModifierTarget] = useState<
    | null
    | { kind: 'entity'; entityId: string }
    | { kind: 'assetMeta'; assetId: string }
  >(null);

  const [terrainBrush, setTerrainBrush] = useState<TerrainBrush>('raiseGround');
  const [terrainBrushRadius, setTerrainBrushRadius] = useState<number>(5.5);
  const [terrainBrushStrength, setTerrainBrushStrength] = useState<number>(0.75);
  const [terrainBrushFalloff, setTerrainBrushFalloff] = useState<TerrainBrushFalloff>('smooth');
  const [terrainFlattenHeight, setTerrainFlattenHeight] = useState<number | null>(null);
  const [terrainScatterAssetId, setTerrainScatterAssetId] = useState<string>('');

  const [currentProjectID, setCurrentProjectID] = useState<string | null>(null);
  const [selectedLevelID, setSelectedLevelID] = useState<string | null>(null);
  const [selectedEntityID, setSelectedEntityID] = useState<string | null>(null);
  const [selectedWidgetID, setSelectedWidgetID] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<EntitySection>('cast');
  const [selectedTab, setSelectedTab] = useState<StageTab>('world');
  const [motionSection, setMotionSection] = useState<MotionStudioSection>('gait');
  const [logicMode, setLogicMode] = useState<LogicWorkspaceMode>('rules');
  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState<string | null>(null);
  const [runtimeDurability, setRuntimeDurability] = useState<
    Record<string, { durability: number; maxDurability: number }>
  >({});
  const [motionAssetId, setMotionAssetId] = useState<string | null>(null);
  const [motionActorTarget, setMotionActorTarget] = useState<MotionActorTarget | null>(null);
  const [motionRequestedSlot, setMotionRequestedSlot] = useState<CustomClipSlot | null>(null);
  const [objectMakerOpen, setObjectMakerOpen] = useState(false);
  const [objectMakerTargetAssetId, setObjectMakerTargetAssetId] = useState<string | null>(null);
  const [objectMakerInventoryItemId, setObjectMakerInventoryItemId] = useState<string | null>(null);
  const [plantMakerOpen, setPlantMakerOpen] = useState(false);
  const [plantMakerTargetAssetId, setPlantMakerTargetAssetId] = useState<string | null>(null);
  const [characterMakerOpen, setCharacterMakerOpen] = useState(false);
  const [characterMakerTargetAssetId, setCharacterMakerTargetAssetId] = useState<string | null>(null);
  const [treeMakerOpen, setTreeMakerOpen] = useState(false);
  const [treeMakerTargetAssetId, setTreeMakerTargetAssetId] = useState<string | null>(null);
  const [treeMakerInitialSpecies, setTreeMakerInitialSpecies] = useState<TreeSpeciesType | null>(null);
  const [monsterMakerOpen, setMonsterMakerOpen] = useState(false);
  const [monsterMakerTargetEntityId, setMonsterMakerTargetEntityId] = useState<string | null>(null);
  const [monsterMakerInitialBlueprint, setMonsterMakerInitialBlueprint] = useState<MonsterBlueprint | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playModalOpen, setPlayModalOpen] = useState(false);
  const [playFromPoint, setPlayFromPoint] = useState<BoardPoint | null>(null);
  const [playerTelemetry, setPlayerTelemetryRaw] = useState<PlayerTelemetry | null>(null);
  const setPlayerTelemetry = useCallback(
    (
      next:
        | PlayerTelemetry
        | null
        | ((prev: PlayerTelemetry | null) => PlayerTelemetry | null)
    ) => {
      setPlayerTelemetryRaw((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        publishLivePlayerTelemetry(resolved);
        return resolved;
      });
    },
    []
  );
  const [showingNewGame, setShowingNewGame] = useState(false);
  const [showingIdeas, setShowingIdeas] = useState(false);

  const setShowingTerrainEditor = useCallback((open: boolean) => {
    setShowingTerrainEditorRaw(open);
    if (open) {
      setSelectedTab('world');
      setActiveWorldDomain('mountains');
      setWorldTool('terrain');
    }
  }, []);

  const [past, setPast] = useState<HistorySnapshot[]>([]);
  const [future, setFuture] = useState<HistorySnapshot[]>([]);

  const isFirstPersistRef = useRef(true);
  const latestProjectsRef = useRef(projects);
  latestProjectsRef.current = projects;
  const persistDirtyRef = useRef(false);
  const hasUserMutatedProjectsRef = useRef(false);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const lastContextSwitchMsRef = useRef(0);
  // Active-only serialization caches: pruned on every flush so historical undo snapshots never pin multi-MB strings
  const serializedProjectCacheRef = useRef(new Map<GameProject, string>());
  const serializedLevelCacheRef = useRef(new Map<GameLevel, string>());
  const persistInFlightRef = useRef(false);
  const persistQueuedRef = useRef(false);

  useEffect(() => {
    lastContextSwitchMsRef.current = performance.now();
  }, [currentProjectID, selectedLevelID]);

  // Hydrate projects asynchronously from IndexedDB on initial mount (migrating from legacy localStorage seamlessly)
  useEffect(() => {
    let active = true;
    void loadProjectsSnapshotFromIDB().then((storedProjects) => {
      if (!active || !storedProjects || storedProjects.length === 0) return;
      if (hasUserMutatedProjectsRef.current) return;
      const migrated = storedProjects.map((p) => migrateProject(p));
      isFirstPersistRef.current = true;
      setProjects(migrated);
    });
    return () => {
      active = false;
    };
  }, []);

  const serializeProjectsPruned = useCallback((list: GameProject[]): string => {
    const prevProjCache = serializedProjectCacheRef.current;
    const prevLevelCache = serializedLevelCacheRef.current;
    const nextProjCache = new Map<GameProject, string>();
    const nextLevelCache = new Map<GameLevel, string>();
    const parts = new Array<string>(list.length);

    for (let i = 0; i < list.length; i++) {
      const proj = list[i];
      let json = prevProjCache.get(proj);
      if (json === undefined) {
        const { levels, worldMap: rawWm, ...rest } = proj;
        const persistHead = rawWm
          ? { ...rest, worldMap: compactWorldMapForStorage(rawWm) }
          : rest;
        const baseJson = JSON.stringify(persistHead);
        const levelParts = new Array<string>(levels.length);
        for (let li = 0; li < levels.length; li++) {
          const lvl = levels[li];
          let lj = prevLevelCache.get(lvl);
          if (lj === undefined) {
            lj = JSON.stringify(lvl);
          }
          nextLevelCache.set(lvl, lj);
          levelParts[li] = lj;
        }
        const prefix = baseJson.slice(0, -1);
        const sep = prefix.length > 1 ? ',' : '';
        json = `${prefix}${sep}"levels":[${levelParts.join(',')}]}`;
      } else {
        for (let li = 0; li < proj.levels.length; li++) {
          const lvl = proj.levels[li];
          const lj = prevLevelCache.get(lvl);
          if (lj !== undefined) {
            nextLevelCache.set(lvl, lj);
          }
        }
      }
      nextProjCache.set(proj, json);
      parts[i] = json;
    }

    serializedProjectCacheRef.current = nextProjCache;
    serializedLevelCacheRef.current = nextLevelCache;
    return `[${parts.join(',')}]`;
  }, []);

  const flushProjectsToStorage = useCallback((force = false) => {
    if (!force && !persistDirtyRef.current) return;
    if (!force && isPlayingRef.current) return;
    if (persistInFlightRef.current) {
      persistQueuedRef.current = true;
      return;
    }
    persistDirtyRef.current = false;
    persistQueuedRef.current = false;

    let serialized = '';
    try {
      serialized = measurePersistence('projects:serialize', () => {
        const text = serializeProjectsPruned(latestProjectsRef.current);
        return { result: text, payloadBytes: text.length };
      });
    } catch {
      return;
    }

    persistInFlightRef.current = true;
    void saveProjectsSnapshotToIDB(serialized)
      .then(() => {
        // Once safely stored in IndexedDB, clear any oversized legacy localStorage blob so reloads stay lean
        if (serialized.length > LOCAL_STORAGE_FALLBACK_MAX_BYTES) {
          try {
            localStorage.removeItem(STORAGE_KEY);
          } catch {
            // ignore
          }
        } else {
          try {
            localStorage.setItem(STORAGE_KEY, serialized);
          } catch {
            // ignore quota errors
          }
        }
      })
      .catch(() => {
        // Fallback to localStorage only if IndexedDB is unavailable
        try {
          localStorage.setItem(STORAGE_KEY, serialized);
        } catch {
          // ignore quota errors
        }
      })
      .finally(() => {
        persistInFlightRef.current = false;
        if (persistQueuedRef.current) {
          persistQueuedRef.current = false;
          flushProjectsToStorage(false);
        }
      });
  }, [serializeProjectsPruned]);

  useEffect(() => {
    if (isFirstPersistRef.current) {
      isFirstPersistRef.current = false;
      return;
    }
    hasUserMutatedProjectsRef.current = true;
    persistDirtyRef.current = true;
    if (isPlaying) return;
    let cancelled = false;
    let idleId: number | null = null;
    const winWithIdle = window as Window & {
      requestIdleCallback?: (
        cb: (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void,
        opts?: { timeout: number }
      ) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const sinceSwitch = performance.now() - lastContextSwitchMsRef.current;
    const delayMs = sinceSwitch < 2500 ? Math.max(2400, 3200 - sinceSwitch) : 2200;
    const scheduleIdleFlush = (retriesLeft: number) => {
      if (cancelled) return;
      if (typeof winWithIdle.requestIdleCallback === 'function') {
        idleId = winWithIdle.requestIdleCallback(
          (deadline) => {
            if (cancelled) return;
            if (!deadline.didTimeout && deadline.timeRemaining() < 16 && retriesLeft > 0) {
              scheduleIdleFlush(retriesLeft - 1);
              return;
            }
            flushProjectsToStorage(false);
          },
          { timeout: 4000 }
        );
      } else {
        flushProjectsToStorage(false);
      }
    };
    const timer = window.setTimeout(() => {
      scheduleIdleFlush(3);
    }, delayMs);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (idleId !== null && typeof winWithIdle.cancelIdleCallback === 'function') {
        winWithIdle.cancelIdleCallback(idleId);
      }
    };
  }, [projects, isPlaying, flushProjectsToStorage]);

  useEffect(() => {
    const onHide = () => flushProjectsToStorage(true);
    window.addEventListener('pagehide', onHide);
    window.addEventListener('beforeunload', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('beforeunload', onHide);
      flushProjectsToStorage(true);
    };
  }, [flushProjectsToStorage]);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore
    }
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(
        VIEWPORT_QUALITY_KEY,
        JSON.stringify({
          resolutionScale: viewportResolutionScale,
          shadowQuality: viewportShadowQuality,
          terrainQuality,
        })
      );
    } catch {
      // ignore
    }
  }, [viewportResolutionScale, viewportShadowQuality, terrainQuality]);

  useEffect(() => {
    let active = true;
    listAssetMetas().then(async (rows) => {
      if (!active) return;
      const seedKey = 'maker.seededFallenLog.v1';
      if (
        localStorage.getItem(seedKey) !== '1' &&
        !rows.some((a) => a.id === FALLBACK_FALLEN_LOG_ASSET_ID)
      ) {
        try {
          const logDoc = createFallenLogObjectDoc();
          const { buffer } = await buildAndExportObjectDocToGlb(logDoc);
          const { meta, buffer: finalBuf } = await registerGeneratedGlbAsset({
            forcedId: FALLBACK_FALLEN_LOG_ASSET_ID,
            name: 'Fallen Log',
            category: 'scenery',
            buffer,
            interactionAttributes: logDoc.interactionAttributes,
            interactionCalibrations: logDoc.interactionCalibrations,
            objectRecipe: logDoc,
            keepMetricScale: true,
          });
          await saveAssetRecord(meta, finalBuf);
          if (meta.thumbnailDataUrl) {
            setCustomAssetThumbnailCache(meta.id, meta.thumbnailDataUrl);
          }
          localStorage.setItem(seedKey, '1');
          if (active) setCustomAssets([meta, ...rows]);
          return;
        } catch {
          // Non-fatal if GLB export fails during headless tests
        }
      }
      if (active) setCustomAssets(rows);
    });
    listTextureMetas().then((rows) => {
      if (active) setCustomTextures(rows);
    });
    listSavedPresets().then((rows) => {
      if (active) setSavedPresets(rows);
    });
    return () => {
      active = false;
    };
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const uploadCustomGlb = useCallback(
    async (file: File, category: AssetCategory): Promise<CustomAssetMeta> => {
      const { meta, buffer } = await parseUploadedGlbFile(file, category);
      await saveAssetRecord(meta, buffer);
      setCustomAssets((prev) => [meta, ...prev]);
      return meta;
    },
    []
  );

  const updateCustomAssetMeta = useCallback(async (meta: CustomAssetMeta) => {
    await updateAssetMetaRecord(meta);
    setCustomAssets((prev) => prev.map((a) => (a.id === meta.id ? meta : a)));
  }, []);

  const saveGeneratedAsset = useCallback(
    async (opts: {
      existingAssetId?: string;
      name: string;
      category: AssetCategory;
      buffer: ArrayBuffer;
      mechanisms?: ObjectMechanism[];
      interactionAttributes?: ObjectInteractionAttributeId[];
      interactionCalibrations?: Partial<
        Record<ObjectInteractionAttributeId, ObjectInteractionCalibration>
      >;
      objectRecipe?: ObjectMakerDoc;
      characterRecipe?: CharacterMakerDoc;
      treeRecipe?: StylizedCanopyConfig;
      buildingBlock?: BuildingBlockConfig;
      vertexPaintStrokes?: VertexPaintStroke[];
      thumbnailOverride?: string;
      keepMetricScale?: boolean;
      attachBodyPart?: ObjectAttachBodyPart | null;
      linkedInventoryItemId?: string | null;
    }): Promise<CustomAssetMeta> => {
      const existingMeta = opts.existingAssetId
        ? customAssets.find((a) => a.id === opts.existingAssetId)
        : undefined;
      const { meta, buffer } = await registerGeneratedGlbAsset({
        existingMeta,
        name: opts.name,
        category: opts.category,
        buffer: opts.buffer,
        mechanisms: opts.mechanisms,
        interactionAttributes: opts.interactionAttributes,
        interactionCalibrations: opts.interactionCalibrations,
        objectRecipe: opts.objectRecipe,
        characterRecipe: opts.characterRecipe,
        treeRecipe: opts.treeRecipe,
        buildingBlock: opts.buildingBlock,
        vertexPaintStrokes: opts.vertexPaintStrokes,
        thumbnailOverride: opts.thumbnailOverride,
        keepMetricScale: opts.keepMetricScale ?? true,
        attachBodyPart: opts.attachBodyPart,
        linkedInventoryItemId: opts.linkedInventoryItemId,
      });
      await saveAssetRecord(meta, buffer);
      if (meta.thumbnailDataUrl) {
        setCustomAssetThumbnailCache(meta.id, meta.thumbnailDataUrl);
      }
      setCustomAssets((prev) => {
        const idx = prev.findIndex((a) => a.id === meta.id);
        if (idx >= 0) {
          return prev.map((a) => (a.id === meta.id ? meta : a));
        }
        return [meta, ...prev];
      });
      return meta;
    },
    [customAssets]
  );

  const toggleFavoriteCustomAsset = useCallback(
    async (id: string): Promise<boolean> => {
      const target = customAssets.find((a) => a.id === id);
      if (!target) return false;
      const nextFav = !target.favorite;
      const updated: CustomAssetMeta = { ...target, favorite: nextFav };
      await updateAssetMetaRecord(updated);
      setCustomAssets((prev) => prev.map((a) => (a.id === id ? updated : a)));
      return nextFav;
    },
    [customAssets]
  );

  const duplicateCustomAsset = useCallback(
    async (id: string): Promise<CustomAssetMeta | null> => {
      const source = customAssets.find((a) => a.id === id);
      if (!source) return null;
      const blob = (await getAssetBlob(id)) ?? new ArrayBuffer(0);
      const clonedBuffer = blob.slice(0);
      const newId = uid();
      const baseName = `${source.name.replace(/\s+Copy(\s+\d+)?$/i, '')} Copy`;
      let candidateName = baseName;
      let copyIdx = 2;
      const existingNames = new Set(customAssets.map((a) => a.name.toLowerCase()));
      while (existingNames.has(candidateName.toLowerCase())) {
        candidateName = `${baseName} ${copyIdx++}`;
      }
      const clonedMeta: CustomAssetMeta = {
        ...(JSON.parse(JSON.stringify(source)) as CustomAssetMeta),
        id: newId,
        name: candidateName,
        favorite: false,
        createdAt: new Date().toISOString(),
      };
      await saveAssetRecord(clonedMeta, clonedBuffer);
      if (clonedMeta.thumbnailDataUrl) {
        setCustomAssetThumbnailCache(newId, clonedMeta.thumbnailDataUrl);
      }
      setCustomAssets((prev) => [clonedMeta, ...prev]);
      return clonedMeta;
    },
    [customAssets]
  );

  const removeCustomAsset = useCallback(async (id: string) => {
    await deleteAssetRecord(id);
    evictCachedAsset(id);
    setCustomAssets((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const uploadCustomTexture = useCallback(
    async (
      file: File,
      maxResolution: CustomTextureResolution = 512
    ): Promise<CustomTextureAssetMeta> => {
      const { meta, buffer, mimeType, canvas } = await processUploadedTextureFile(
        file,
        maxResolution
      );
      await saveTextureRecord(meta, buffer, mimeType);
      primeCustomTextureCanvas(meta.id, canvas);
      setCustomTextures((prev) => [meta, ...prev]);
      return meta;
    },
    []
  );

  const resizeCustomTexture = useCallback(
    async (
      id: string,
      targetResolution: CustomTextureResolution
    ): Promise<CustomTextureAssetMeta | null> => {
      const existing = customTextures.find((t) => t.id === id);
      if (!existing) return null;
      const res = await downsizeStoredTexture(existing, targetResolution);
      if (!res) return null;
      primeCustomTextureCanvas(res.meta.id, res.canvas);
      setCustomTextures((prev) => prev.map((t) => (t.id === id ? res.meta : t)));
      return res.meta;
    },
    [customTextures]
  );

  const removeCustomTexture = useCallback(async (id: string) => {
    await deleteTextureRecord(id);
    evictCustomTexture(id);
    setCustomTextures((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const currentProject = useMemo(
    () => projects.find((p) => p.id === currentProjectID) ?? null,
    [projects, currentProjectID]
  );

  const currentLevel = useMemo(() => {
    if (!currentProject) return null;
    return currentProject.levels.find((l) => l.id === selectedLevelID) ?? currentProject.levels[0] ?? null;
  }, [currentProject, selectedLevelID]);

  const levelIndex = useMemo(() => {
    if (!currentProject || !currentLevel) return 0;
    const idx = currentProject.levels.findIndex((l) => l.id === currentLevel.id);
    return Math.max(0, idx);
  }, [currentProject, currentLevel]);

  const currentEntity = useMemo(() => {
    if (!currentLevel || !selectedEntityID) return null;
    return currentLevel.entities.find((e) => e.id === selectedEntityID) ?? null;
  }, [currentLevel, selectedEntityID]);

  const currentWidget = useMemo(() => {
    if (!currentProject || !selectedWidgetID) return null;
    return currentProject.hud.widgets.find((w) => w.id === selectedWidgetID) ?? null;
  }, [currentProject, selectedWidgetID]);

  const resolvedWorldMap = useMemo<WorldMapData | undefined>(() => {
    if (!currentProject) return undefined;
    return currentProject.worldMap ?? ensureWorldMapForProject(currentProject);
  }, [currentProject]);

  const activeWorldRegion = useMemo(
    () =>
      worldEditorScope === 'worldMap' || !resolvedWorldMap || !currentLevel
        ? undefined
        : resolvedWorldMap.regions.find((r) => r.levelId === currentLevel.id),
    [worldEditorScope, resolvedWorldMap, currentLevel]
  );

  const activeWorldRegionCode = activeWorldRegion?.code;
  const activeWorldRegionOrigin = activeWorldRegion?.origin;

  const commit = useCallback(
    (label: string, mutator: (prev: GameProject[]) => GameProject[], recordUndo = true) => {
      setProjects((prev) => {
        const next = measureStateUpdate(`commit:${label}`, () => mutator(prev));
        if (next === prev) return prev;
        if (recordUndo) {
          setPast((h) => [...h.slice(-(MAX_UNDO_HISTORY - 1)), { label, projects: prev }]);
          setFuture([]);
        }
        return next;
      });
    },
    []
  );

  const undo = useCallback(() => {
    measureStateUpdate('undo', () => {
      setPast((prevPast) => {
        if (prevPast.length === 0) return prevPast;
        const last = prevPast[prevPast.length - 1];
        setProjects((curr) => {
          setFuture((f) => [{ label: last.label, projects: curr }, ...f.slice(0, MAX_UNDO_HISTORY - 1)]);
          return last.projects;
        });
        return prevPast.slice(0, -1);
      });
    });
  }, []);

  const redo = useCallback(() => {
    measureStateUpdate('redo', () => {
      setFuture((prevFuture) => {
        if (prevFuture.length === 0) return prevFuture;
        const next = prevFuture[0];
        setProjects((curr) => {
          setPast((p) => [...p.slice(-(MAX_UNDO_HISTORY - 1)), { label: next.label, projects: curr }]);
          return next.projects;
        });
        return prevFuture.slice(1);
      });
    });
  }, []);

  const openProject = useCallback(
    (id: string) => {
      const target = projects.find((p) => p.id === id);
      if (!target) return;
      setCurrentProjectID(id);
      const firstLevel = target.levels[0] ?? null;
      const firstEnv = firstLevel ? getEnvironmentType(firstLevel) : 'openWorld';
      setSelectedLevelID(firstLevel?.id ?? null);
      setSelectedEntityID(firstLevel?.entities[0]?.id ?? null);
      setSelectedWidgetID(target.hud.widgets[0]?.id ?? null);
      setWorldViewMode(firstEnv === 'openWorld' ? '2d' : '3d');
      setWorldEditorScope(firstEnv === 'openWorld' ? 'worldMap' : firstLevel?.id ?? 'worldMap');
      setSelectedWorldLandCode(null);
      setWorldMapBrushMode('terrain');
      setActiveWorldDomain('select');
      setPlayerTelemetry(null);
      setSelectedTab('world');
      setPast([]);
      setFuture([]);
    },
    [projects]
  );

  const closeProject = useCallback(() => {
    setCurrentProjectID(null);
    setIsPlaying(false);
    setPlayFromPoint(null);
    setPlayerTelemetry(null);
    setPast([]);
    setFuture([]);
  }, []);

  const createProject = useCallback((name: string, template: GameTemplate) => {
    const next = projectFromTemplate(name, template);
    setProjects((prev) => [next, ...prev]);
    setCurrentProjectID(next.id);
    const firstLevel = next.levels[0] ?? null;
    const firstEnv = firstLevel ? getEnvironmentType(firstLevel) : 'openWorld';
    setSelectedLevelID(firstLevel?.id ?? null);
    setSelectedEntityID(firstLevel?.entities[0]?.id ?? null);
    setSelectedWidgetID(next.hud.widgets[0]?.id ?? null);
    setWorldViewMode(firstEnv === 'openWorld' ? '2d' : '3d');
    setWorldEditorScope(firstEnv === 'openWorld' ? 'worldMap' : firstLevel?.id ?? 'worldMap');
    setSelectedWorldLandCode(null);
    setWorldMapBrushMode('terrain');
    setActiveWorldDomain('select');
    setPlayFromPoint(null);
    setPlayerTelemetry(null);
    setSelectedTab('world');
    setShowingNewGame(false);
    setPast([]);
    setFuture([]);
  }, []);

  const duplicateProject = useCallback((id: string) => {
    setProjects((prev) =>
      measureStateUpdate('duplicateProject', () => {
        const src = prev.find((p) => p.id === id);
        if (!src) return prev;
        const copy: GameProject = {
          ...JSON.parse(JSON.stringify(src)),
          id: uid(),
          name: `${src.name} copy`,
          updatedAt: new Date().toISOString(),
          published: false,
        };
        return [copy, ...prev];
      })
    );
  }, []);

  const deleteProject = useCallback(
    (id: string) => {
      setProjects((prev) => prev.filter((p) => p.id !== id));
      if (currentProjectID === id) {
        setCurrentProjectID(null);
      }
    },
    [currentProjectID]
  );

  const updateProject = useCallback(
    (undoLabel: string, updater: (project: GameProject) => GameProject, recordUndo = true) => {
      if (!currentProjectID) return;
      commit(
        undoLabel,
        (prev) =>
          prev.map((p) =>
            p.id === currentProjectID
              ? { ...updater(p), updatedAt: new Date().toISOString() }
              : p
          ),
        recordUndo
      );
    },
    [commit, currentProjectID]
  );

  const saveUniversalMotionPreset = useCallback(
    async (
      preset: CustomMotionPreset,
      target: MotionActorTarget,
      customAssetMeta?: CustomAssetMeta
    ) => {
      // Persist onto customAsset if applicable
      if (target.kind === 'customAsset' && customAssetMeta) {
        const list = customAssetMeta.customAnimations ?? [];
        const exists = list.some((p) => p.id === preset.id);
        const nextList = exists
          ? list.map((p) => (p.id === preset.id ? preset : p))
          : [...list, preset];
        await updateCustomAssetMeta({
          ...customAssetMeta,
          customAnimations: nextList,
        });
      }
      // Also store into project.customMotionLibrary so Logic Rules & cross-actor sharing always find it
      updateProject(`save motion "${preset.name}"`, (proj) => {
        const lib = proj.customMotionLibrary ?? [];
        const exists = lib.some((p) => p.id === preset.id);
        const nextLib = exists
          ? lib.map((p) => (p.id === preset.id ? preset : p))
          : [...lib, preset];

        // If target is a MonsterBlueprint in customMonsters or level entities, keep its copy updated too
        let nextMonsters = proj.customMonsters;
        if (target.kind === 'monsterBlueprint' && nextMonsters) {
          nextMonsters = nextMonsters.map((m) => {
            if (m.id !== target.monsterId && m.presetId !== target.monsterId) return m;
            const mList = m.customAnimations ?? [];
            const mHas = mList.some((p) => p.id === preset.id);
            return {
              ...m,
              customAnimations: mHas
                ? mList.map((p) => (p.id === preset.id ? preset : p))
                : [...mList, preset],
            };
          });
        }
        return {
          ...proj,
          customMotionLibrary: nextLib,
          customMonsters: nextMonsters,
        };
      });
    },
    [updateCustomAssetMeta, updateProject]
  );

  const deleteUniversalMotionPreset = useCallback(
    async (
      presetId: string,
      target: MotionActorTarget,
      customAssetMeta?: CustomAssetMeta
    ) => {
      if (target.kind === 'customAsset' && customAssetMeta) {
        const nextDefs = { ...(customAssetMeta.defaultSlotPresets ?? {}) };
        (Object.keys(nextDefs) as CustomClipSlot[]).forEach((s) => {
          if (nextDefs[s] === presetId) delete nextDefs[s];
        });
        await updateCustomAssetMeta({
          ...customAssetMeta,
          customAnimations: (customAssetMeta.customAnimations ?? []).filter((p) => p.id !== presetId),
          defaultSlotPresets: nextDefs,
        });
      }
      updateProject('delete saved motion variation', (proj) => {
        const clearSlotMap = (m?: Partial<Record<CustomClipSlot, string>>) => {
          if (!m) return m;
          const next = { ...m };
          (Object.keys(next) as CustomClipSlot[]).forEach((s) => {
            if (next[s] === presetId) delete next[s];
          });
          return next;
        };
        const nextSpecies = proj.buddyMotionSlotsByCreature
          ? Object.fromEntries(
              Object.entries(proj.buddyMotionSlotsByCreature).map(([sp, mp]) => [
                sp,
                clearSlotMap(mp),
              ])
            )
          : undefined;
        return {
          ...proj,
          customMotionLibrary: (proj.customMotionLibrary ?? []).filter((p) => p.id !== presetId),
          heroMotionSlots: clearSlotMap(proj.heroMotionSlots),
          npcMotionSlots: clearSlotMap(proj.npcMotionSlots),
          buddyMotionSlots: clearSlotMap(proj.buddyMotionSlots),
          buddyMotionSlotsByCreature: nextSpecies,
          baddieMotionSlots: clearSlotMap(proj.baddieMotionSlots),
        };
      });
    },
    [updateCustomAssetMeta, updateProject]
  );

  const assignMotionPresetToScope = useCallback(
    async (opts: {
      preset: CustomMotionPreset;
      slot: CustomClipSlot;
      scope: MotionAssignmentScope;
      target: MotionActorTarget;
      entityId?: string;
      blueprint?: MonsterBlueprint;
      customAssetMeta?: CustomAssetMeta;
    }) => {
      const { preset, slot, scope, target, entityId, blueprint, customAssetMeta } = opts;
      // Ensure preset is saved first in library
      await saveUniversalMotionPreset(preset, target, customAssetMeta);

      if (scope === 'customAsset' && customAssetMeta) {
        await updateCustomAssetMeta({
          ...customAssetMeta,
          customAnimations: [
            ...(customAssetMeta.customAnimations ?? []).filter((p) => p.id !== preset.id),
            preset,
          ],
          defaultSlotPresets: {
            ...(customAssetMeta.defaultSlotPresets ?? {}),
            [slot]: preset.id,
          },
        });
        return;
      }

      updateProject(`assign motion to ${scope} (${slot})`, (proj) => {
        if (scope === 'heroDefault') {
          return {
            ...proj,
            heroMotionSlots: { ...(proj.heroMotionSlots ?? {}), [slot]: preset.id },
          };
        }
        if (scope === 'npcDefault') {
          return {
            ...proj,
            npcMotionSlots: { ...(proj.npcMotionSlots ?? {}), [slot]: preset.id },
          };
        }
        if (scope === 'buddyDefault') {
          if (target.kind === 'buddyCritter') {
            const prevBySp = proj.buddyMotionSlotsByCreature ?? {};
            return {
              ...proj,
              buddyMotionSlotsByCreature: {
                ...prevBySp,
                [target.creatureType]: { ...(prevBySp[target.creatureType] ?? {}), [slot]: preset.id },
              },
            };
          }
          return {
            ...proj,
            buddyMotionSlots: { ...(proj.buddyMotionSlots ?? {}), [slot]: preset.id },
          };
        }
        if (scope === 'baddieDefault') {
          return {
            ...proj,
            baddieMotionSlots: { ...(proj.baddieMotionSlots ?? {}), [slot]: preset.id },
          };
        }
        if (scope === 'monsterBlueprint') {
          const bpId =
            target.kind === 'monsterBlueprint' ? target.monsterId : blueprint?.id;
          const prevMonsters = proj.customMonsters ?? [];
          let foundInProject = false;
          const nextMonsters = prevMonsters.map((m) => {
            if (m.id !== bpId && m.presetId !== bpId) return m;
            foundInProject = true;
            return {
              ...m,
              customAnimations: [
                ...(m.customAnimations ?? []).filter((p) => p.id !== preset.id),
                preset,
              ],
              defaultSlotPresets: { ...(m.defaultSlotPresets ?? {}), [slot]: preset.id },
            };
          });
          if (!foundInProject && blueprint) {
            nextMonsters.push({
              ...blueprint,
              customAnimations: [
                ...(blueprint.customAnimations ?? []).filter((p) => p.id !== preset.id),
                preset,
              ],
              defaultSlotPresets: { ...(blueprint.defaultSlotPresets ?? {}), [slot]: preset.id },
            });
          }
          // Also propagate onto placed entities using this monster blueprint
          const nextLevels = proj.levels.map((lvl) => ({
            ...lvl,
            entities: lvl.entities.map((ent) => {
              if (!ent.monsterConfig) return ent;
              if (ent.monsterConfig.id !== bpId && ent.monsterConfig.presetId !== bpId) return ent;
              return {
                ...ent,
                monsterConfig: {
                  ...ent.monsterConfig,
                  customAnimations: [
                    ...(ent.monsterConfig.customAnimations ?? []).filter((p) => p.id !== preset.id),
                    preset,
                  ],
                  defaultSlotPresets: {
                    ...(ent.monsterConfig.defaultSlotPresets ?? {}),
                    [slot]: preset.id,
                  },
                },
              };
            }),
          }));
          return { ...proj, customMonsters: nextMonsters, levels: nextLevels };
        }
        if (scope === 'entityOverride' && entityId) {
          const nextLevels = proj.levels.map((lvl) => ({
            ...lvl,
            entities: lvl.entities.map((ent) => {
              if (ent.id !== entityId) return ent;
              return {
                ...ent,
                motionSlotOverrides: { ...(ent.motionSlotOverrides ?? {}), [slot]: preset.id },
                motionCustomAnimations: [
                  ...(ent.motionCustomAnimations ?? []).filter((p) => p.id !== preset.id),
                  preset,
                ],
              };
            }),
          }));
          return { ...proj, levels: nextLevels };
        }
        return proj;
      });
    },
    [saveUniversalMotionPreset, updateCustomAssetMeta, updateProject]
  );

  const restoreDefaultMotionSlot = useCallback(
    async (opts: {
      slot: CustomClipSlot;
      scope: MotionAssignmentScope;
      target: MotionActorTarget;
      entityId?: string;
      customAssetMeta?: CustomAssetMeta;
    }) => {
      const { slot, scope, target, entityId, customAssetMeta } = opts;
      if (scope === 'customAsset' && customAssetMeta) {
        const next = { ...(customAssetMeta.defaultSlotPresets ?? {}) };
        delete next[slot];
        await updateCustomAssetMeta({ ...customAssetMeta, defaultSlotPresets: next });
        return;
      }
      updateProject(`restore default ${slot}`, (proj) => {
        const dropKey = (m?: Partial<Record<CustomClipSlot, string>>) => {
          if (!m) return m;
          const copy = { ...m };
          delete copy[slot];
          return copy;
        };
        if (scope === 'heroDefault') return { ...proj, heroMotionSlots: dropKey(proj.heroMotionSlots) };
        if (scope === 'npcDefault') return { ...proj, npcMotionSlots: dropKey(proj.npcMotionSlots) };
        if (scope === 'buddyDefault') {
          if (target.kind === 'buddyCritter') {
            const prev = proj.buddyMotionSlotsByCreature ?? {};
            return {
              ...proj,
              buddyMotionSlotsByCreature: {
                ...prev,
                [target.creatureType]: dropKey(prev[target.creatureType]),
              },
            };
          }
          return { ...proj, buddyMotionSlots: dropKey(proj.buddyMotionSlots) };
        }
        if (scope === 'baddieDefault') return { ...proj, baddieMotionSlots: dropKey(proj.baddieMotionSlots) };
        if (scope === 'monsterBlueprint') {
          const bpId = target.kind === 'monsterBlueprint' ? target.monsterId : undefined;
          return {
            ...proj,
            customMonsters: (proj.customMonsters ?? []).map((m) =>
              m.id === bpId || m.presetId === bpId
                ? { ...m, defaultSlotPresets: dropKey(m.defaultSlotPresets) }
                : m
            ),
            levels: proj.levels.map((lvl) => ({
              ...lvl,
              entities: lvl.entities.map((ent) =>
                ent.monsterConfig && (ent.monsterConfig.id === bpId || ent.monsterConfig.presetId === bpId)
                  ? {
                      ...ent,
                      monsterConfig: {
                        ...ent.monsterConfig,
                        defaultSlotPresets: dropKey(ent.monsterConfig.defaultSlotPresets),
                      },
                    }
                  : ent
              ),
            })),
          };
        }
        if (scope === 'entityOverride' && entityId) {
          return {
            ...proj,
            levels: proj.levels.map((lvl) => ({
              ...lvl,
              entities: lvl.entities.map((ent) =>
                ent.id === entityId
                  ? { ...ent, motionSlotOverrides: dropKey(ent.motionSlotOverrides) }
                  : ent
              ),
            })),
          };
        }
        return proj;
      });
    },
    [updateCustomAssetMeta, updateProject]
  );

  const saveUniversalPosePreset = useCallback(
    async (pose: SavedPosePreset, target: MotionActorTarget, customAssetMeta?: CustomAssetMeta) => {
      if (target.kind === 'customAsset' && customAssetMeta) {
        const list = customAssetMeta.savedPoses ?? [];
        const exists = list.some((p) => p.id === pose.id);
        await updateCustomAssetMeta({
          ...customAssetMeta,
          savedPoses: exists ? list.map((p) => (p.id === pose.id ? pose : p)) : [...list, pose],
        });
      }
      updateProject(`save pose "${pose.name}"`, (proj) => {
        const lib = proj.customPoseLibrary ?? [];
        const exists = lib.some((p) => p.id === pose.id);
        return {
          ...proj,
          customPoseLibrary: exists ? lib.map((p) => (p.id === pose.id ? pose : p)) : [...lib, pose],
        };
      });
    },
    [updateCustomAssetMeta, updateProject]
  );

  const deleteUniversalPosePreset = useCallback(
    async (poseId: string, target: MotionActorTarget, customAssetMeta?: CustomAssetMeta) => {
      if (target.kind === 'customAsset' && customAssetMeta) {
        await updateCustomAssetMeta({
          ...customAssetMeta,
          savedPoses: (customAssetMeta.savedPoses ?? []).filter((p) => p.id !== poseId),
        });
      }
      updateProject('delete saved pose', (proj) => ({
        ...proj,
        customPoseLibrary: (proj.customPoseLibrary ?? []).filter((p) => p.id !== poseId),
      }));
    },
    [updateCustomAssetMeta, updateProject]
  );

  const updateLevel = useCallback(
    (undoLabel: string, updater: (level: GameLevel) => GameLevel, recordUndo = true) => {
      if (!currentProjectID || !currentLevel) return;
      const targetLevelID = currentLevel.id;
      updateProject(
        undoLabel,
        (proj) => ({
          ...proj,
          levels: proj.levels.map((l) => (l.id === targetLevelID ? updater(l) : l)),
        }),
        recordUndo
      );
    },
    [currentLevel, currentProjectID, updateProject]
  );

  const addLevel = useCallback(() => {
    if (!currentProject) return;
    const newLevel = createBlankLevel(`Level ${currentProject.levels.length + 1}`, 'island');
    updateProject('add a level', (proj) => ({
      ...proj,
      levels: [...proj.levels, newLevel],
    }));
    setSelectedLevelID(newLevel.id);
    setSelectedEntityID(null);
  }, [currentProject, updateProject]);

  const deleteCurrentLevel = useCallback(() => {
    if (!currentProject || !currentLevel || currentProject.levels.length <= 1) return;
    const remaining = currentProject.levels.filter((l) => l.id !== currentLevel.id);
    updateProject('delete a level', (proj) => ({
      ...proj,
      levels: remaining,
    }));
    setSelectedLevelID(remaining[0]?.id ?? null);
    setSelectedEntityID(remaining[0]?.entities[0]?.id ?? null);
  }, [currentLevel, currentProject, updateProject]);

  const applyBrush = useCallback(
    (
      brush: TerrainBrush,
      x: number,
      z: number,
      radius: number,
      recordUndo = false,
      customAssetId?: string,
      options?: TerrainBrushOptions
    ) => {
      if (brush === 'terrain' && currentProject && currentLevel) {
        updateProject(
          'paint terrain landmass',
          (proj) => {
            const baseWm = proj.worldMap ?? ensureWorldMapForProject(proj);
            const region = baseWm.regions.find((r) => r.levelId === currentLevel.id);
            const resolvedOrigin = region?.origin ?? [0, 0];
            const wm =
              region && !region.origin
                ? {
                    ...baseWm,
                    regions: baseWm.regions.map((r) =>
                      r.id === region.id ? { ...r, origin: resolvedOrigin } : r
                    ),
                  }
                : baseWm;
            const [wx, wz] = landLocalToWorldMap(x, z, resolvedOrigin);
            const nextWm = applyWorldMapStroke(wm, 'terrain', wx, wz, radius, region?.code);
            return {
              ...proj,
              worldMap: nextWm,
              levels: proj.levels.map((lvl) => {
                if (lvl.id !== currentLevel.id) return lvl;
                const base = lvl.terrain ?? createInitialTerrain();
                return {
                  ...lvl,
                  terrain: applyTerrainBrush(base, 'terrain', x, z, radius, customAssetId, options),
                };
              }),
            };
          },
          recordUndo
        );
        return;
      }
      updateLevel(
        'sculpt terrain',
        (lvl) => {
          const base = lvl.terrain ?? createInitialTerrain();
          const shouldAttachDefaults =
            brush === 'scatterTree' && !lvl.canopyEngine && hasCustomDefaultTreeStyles();
          return {
            ...lvl,
            ...(shouldAttachDefaults
              ? { canopyEngine: buildCanopyConfigFromUserDefaults(undefined) }
              : {}),
            terrain: applyTerrainBrush(base, brush, x, z, radius, customAssetId, options),
          };
        },
        recordUndo
      );
    },
    [currentLevel, currentProject, updateLevel, updateProject]
  );

  const commitCaveStroke = useCallback(
    (stroke: CaveSplineStrokeInput) => {
      if (!stroke.points || stroke.points.length === 0) return;
      let committedCaveId = stroke.targetCaveId ?? '';
      updateLevel(
        'carve cave tunnel',
        (lvl) => {
          const base = lvl.terrain ?? createInitialTerrain();
          const { terrain: nextTerrain, caveId } = commitCaveSplineStroke(base, stroke);
          committedCaveId = caveId;
          return {
            ...lvl,
            terrain: nextTerrain,
          };
        },
        true
      );
      if (committedCaveId) {
        setSelectedCaveId(committedCaveId);
      }
    },
    [updateLevel]
  );

  const resetTerrain = useCallback(() => {
    updateLevel('reset ground', (lvl) => ({
      ...lvl,
      terrain: createInitialTerrain(),
    }));
  }, [updateLevel]);

  const focusCameraOnWorldPoint = useCallback(
    (opts: {
      id: string;
      x: number;
      y?: number;
      z: number;
      distance?: number;
      yawDeg?: number;
      pitchDeg?: number;
    }) => {
      setCameraFocusRequest({
        id: opts.id,
        x: opts.x,
        y: opts.y ?? 1.5,
        z: opts.z,
        distance: opts.distance,
        yawDeg: opts.yawDeg,
        pitchDeg: opts.pitchDeg,
        nonce: Date.now() + Math.random(),
      });
    },
    []
  );

  const updateWaterBody = useCallback(
    (id: string, patch: Partial<WaterBodyConfig>, recarveTerrain = false, recordUndo = false) => {
      updateLevel(
        'edit water body',
        (lvl) => {
          const base = ensureUpgradedTerrain(lvl.terrain);
          const list = base.waterBodies ?? createDefaultWaterBodies();
          let updatedBody: WaterBodyConfig | null = null;
          const nextBodies = list.map((wb) => {
            if (wb.id !== id) return wb;
            updatedBody = { ...wb, ...patch };
            return updatedBody;
          });
          let nextTerrain: TerrainData = { ...base, waterBodies: nextBodies, revision: base.revision + (recarveTerrain ? 0 : 1) };
          if (recarveTerrain && updatedBody) {
            nextTerrain = carveWaterBodyIntoTerrain(nextTerrain, updatedBody);
          }
          return { ...lvl, terrain: nextTerrain };
        },
        recordUndo
      );
    },
    [updateLevel]
  );

  const addWaterBody = useCallback(
    (kind: WaterBodyKind, center: [number, number]) => {
      const id = uid();
      const label =
        kind === 'lake'
          ? 'Mirror Lake'
          : kind === 'pond'
          ? 'Woodland Pond'
          : kind === 'stream'
          ? 'Silver Creek'
          : 'Misty River';
      const newBody: WaterBodyConfig = {
        id,
        name: label,
        kind,
        center,
        points:
          kind === 'river' || kind === 'stream'
            ? [
                [center[0] - 18, center[1] - 6],
                [center[0], center[1] + 4],
                [center[0] + 18, center[1] - 4],
              ]
            : undefined,
        radiusX: kind === 'pond' ? 9 : 16,
        radiusZ: kind === 'pond' ? 7 : 13,
        width: kind === 'stream' ? 4.2 : 8.5,
        waterLevelOffset: 0,
        waterColor: kind === 'stream' ? '#34B3A0' : '#2E86AB',
        deepMurkColor: '#0C2D48',
        opacity: 0.85,
        depth: kind === 'pond' ? 1.5 : 2.4,
        foamAmount: 0.62,
        waveSpeed: 0.8,
        windRipple: 0.55,
        flowSpeed: kind === 'river' || kind === 'stream' ? 1.2 : 0.25,
        flowAngleDeg: 0,
        bankSlope: 0.55,
        bankSmoothness: 0.75,
        shoreNoise: 0.35,
      };
      updateLevel(`add ${label}`, (lvl) => {
        const base = ensureUpgradedTerrain(lvl.terrain);
        const carved = carveWaterBodyIntoTerrain(base, newBody);
        return {
          ...lvl,
          terrain: {
            ...carved,
            waterBodies: [...(base.waterBodies ?? createDefaultWaterBodies()), newBody],
            revision: carved.revision + 1,
          },
        };
      });
      setSelectedWaterBodyId(id);
      setActiveWorldDomain('water');
      focusCameraOnWorldPoint({ id, x: center[0], y: IslandTerrain.waterLevel, z: center[1], distance: 34 });
      return newBody;
    },
    [focusCameraOnWorldPoint, updateLevel]
  );

  const deleteWaterBody = useCallback(
    (id: string) => {
      updateLevel('remove water body', (lvl) => {
        const base = ensureUpgradedTerrain(lvl.terrain);
        return {
          ...lvl,
          terrain: {
            ...base,
            waterBodies: (base.waterBodies ?? []).filter((w) => w.id !== id),
            revision: base.revision + 1,
          },
        };
      });
      setSelectedWaterBodyId((prev) => (prev === id ? null : prev));
    },
    [updateLevel]
  );

  const updateCaveGrotto = useCallback(
    (id: string, patch: Partial<CaveGrotto>, recordUndo = false) => {
      updateLevel(
        'edit cave',
        (lvl) => {
          const base = ensureUpgradedTerrain(lvl.terrain);
          return {
            ...lvl,
            terrain: {
              ...base,
              caves: (base.caves ?? []).map((c, idx) =>
                c.id === id ? normalizeCaveGrotto({ ...c, ...patch }, idx) : c
              ),
              revision: base.revision + 1,
            },
          };
        },
        recordUndo
      );
    },
    [updateLevel]
  );

  const updateRoadSpline = useCallback(
    (id: string, patch: Partial<RoadSpline>, reapplyTerrain = false, recordUndo = false) => {
      updateLevel(
        'edit trail road',
        (lvl) => {
          const base = ensureUpgradedTerrain(lvl.terrain);
          let targetRoad: RoadSpline | null = null;
          const nextRoads = (base.roads ?? []).map((r) => {
            if (r.id !== id) return r;
            targetRoad = { ...r, ...patch };
            return targetRoad;
          });
          let nextTerrain: TerrainData = { ...base, roads: nextRoads, revision: base.revision + 1 };
          if (reapplyTerrain && targetRoad) {
            nextTerrain = applyRoadSplineToTerrain(nextTerrain, targetRoad, true);
          }
          return { ...lvl, terrain: nextTerrain };
        },
        recordUndo
      );
    },
    [updateLevel]
  );

  const apply2DOverviewStroke = useCallback(
    (
      brushId: Overview2DBrushId,
      worldX: number,
      worldZ: number,
      radius: number,
      density: number,
      isStrokeStart = false,
      recordUndo = false
    ) => {
      if (brushId === 'terrain' && currentProject && currentLevel) {
        updateProject(
          '2D paint terrain',
          (proj) => {
            const baseWm = proj.worldMap ?? ensureWorldMapForProject(proj);
            const region = baseWm.regions.find((r) => r.levelId === currentLevel.id);
            const resolvedOrigin = region?.origin ?? [0, 0];
            const wm =
              region && !region.origin
                ? {
                    ...baseWm,
                    regions: baseWm.regions.map((r) =>
                      r.id === region.id ? { ...r, origin: resolvedOrigin } : r
                    ),
                  }
                : baseWm;
            const [wx, wz] = landLocalToWorldMap(worldX, worldZ, resolvedOrigin);
            const nextWm = applyWorldMapStroke(wm, 'terrain', wx, wz, radius, region?.code);
            return {
              ...proj,
              worldMap: nextWm,
              levels: proj.levels.map((lvl) => {
                if (lvl.id !== currentLevel.id) return lvl;
                const base = lvl.terrain ?? createInitialTerrain();
                return {
                  ...lvl,
                  terrain: apply2DOverviewBrushStroke(
                    base,
                    brushId,
                    worldX,
                    worldZ,
                    radius,
                    density,
                    isStrokeStart
                  ),
                };
              }),
            };
          },
          recordUndo
        );
        return;
      }
      updateLevel(
        `2D paint ${brushId}`,
        (lvl) => {
          const base = lvl.terrain ?? createInitialTerrain();
          const shouldAttachDefaults =
            (brushId === 'coniferWoods' || brushId === 'deciduousWoods') &&
            !lvl.canopyEngine &&
            hasCustomDefaultTreeStyles();
          return {
            ...lvl,
            ...(shouldAttachDefaults
              ? { canopyEngine: buildCanopyConfigFromUserDefaults(undefined) }
              : {}),
            terrain: apply2DOverviewBrushStroke(
              base,
              brushId,
              worldX,
              worldZ,
              radius,
              density,
              isStrokeStart
            ),
          };
        },
        recordUndo
      );
    },
    [currentLevel, currentProject, updateLevel, updateProject]
  );

  const ensureProjectWorldMap = useCallback((): WorldMapData | null => {
    if (!currentProject) return null;
    if (currentProject.worldMap) return currentProject.worldMap;
    const wm = ensureWorldMapForProject(currentProject);
    updateProject(
      'init world map',
      (proj) => (proj.worldMap ? proj : { ...proj, worldMap: wm }),
      false
    );
    return wm;
  }, [currentProject, updateProject]);

  const addWorldLandRegion = useCallback(
    (customName?: string, customColorHex?: string): WorldLandRegion | null => {
      if (!currentProject) return null;
      const baseWm = currentProject.worldMap ?? ensureWorldMapForProject(currentProject);
      const nextCode = findNextRegionCode(baseWm.regions);
      const colorHex = customColorHex ?? pickNextRegionColor(baseWm.regions);
      const name = (customName ?? `Land ${baseWm.regions.length + 1}`).trim() || `Land ${baseWm.regions.length + 1}`;

      // Reuse a clean blank openWorld starter level if there are no regions yet
      const firstOpenLvl = currentProject.levels.find(
        (l) => (!l.environmentType || l.environmentType === 'openWorld') &&
          baseWm.regions.every((r) => r.levelId !== l.id)
      );
      const canReuseFirst =
        Boolean(firstOpenLvl) &&
        baseWm.regions.length === 0 &&
        firstOpenLvl!.entities.length === 0 &&
        (firstOpenLvl!.terrain?.scatter.length ?? 0) === 0;

      let targetLevel: GameLevel;
      if (canReuseFirst && firstOpenLvl) {
        const scratchBase = createScratchOceanTerrain();
        const cleanBaseTerrain = {
          ...scratchBase,
          mountainConfig: firstOpenLvl.terrain?.mountainConfig ?? scratchBase.mountainConfig,
          dirtAndRoadConfig:
            firstOpenLvl.terrain?.dirtAndRoadConfig ?? scratchBase.dirtAndRoadConfig,
        };
        targetLevel = {
          ...firstOpenLvl,
          name,
          canopyEngine: firstOpenLvl.canopyEngine?.enabled
            ? firstOpenLvl.canopyEngine
            : buildCanopyConfigFromUserDefaults(firstOpenLvl.canopyEngine),
          terrain: syncLevelTerrainWithWorldMap(cleanBaseTerrain, baseWm, nextCode),
        };
      } else {
        targetLevel = createLandLevelFromTemplate(
          currentLevel ?? currentProject.levels[0],
          name,
          baseWm,
          nextCode
        );
      }

      const newRegion: WorldLandRegion = {
        id: uid(),
        code: nextCode,
        name,
        colorHex,
        levelId: targetLevel.id,
      };

      updateProject(`add land ${name}`, (proj) => {
        const wm = proj.worldMap ?? ensureWorldMapForProject(proj);
        const nextWm: WorldMapData = {
          ...wm,
          regions: [...wm.regions, newRegion],
          revision: wm.revision + 1,
        };
        const nextLevels = canReuseFirst
          ? proj.levels.map((l) => (l.id === targetLevel.id ? targetLevel : l))
          : [...proj.levels, targetLevel];
        return {
          ...proj,
          worldMap: nextWm,
          levels: nextLevels,
        };
      });

      setSelectedWorldLandCode(nextCode);
      setWorldMapBrushMode('paintLand');
      return newRegion;
    },
    [currentLevel, currentProject, updateProject]
  );

  const updateWorldLandRegion = useCallback(
    (regionId: string, patch: Partial<Pick<WorldLandRegion, 'name' | 'colorHex'>>) => {
      if (!currentProject) return;
      updateProject('update land region', (proj) => {
        const wm = proj.worldMap ?? ensureWorldMapForProject(proj);
        let linkedLevelId: string | null = null;
        const nextRegions = wm.regions.map((r) => {
          if (r.id !== regionId) return r;
          linkedLevelId = r.levelId;
          return { ...r, ...patch };
        });
        const nextLevels =
          patch.name !== undefined && linkedLevelId
            ? proj.levels.map((l) => (l.id === linkedLevelId ? { ...l, name: patch.name! } : l))
            : proj.levels;
        return {
          ...proj,
          worldMap: {
            ...wm,
            regions: nextRegions,
            revision: wm.revision + 1,
          },
          levels: nextLevels,
        };
      });
    },
    [currentProject, updateProject]
  );

  const deleteWorldLandRegion = useCallback(
    (regionId: string) => {
      if (!currentProject) return;
      const baseWm = currentProject.worldMap ?? ensureWorldMapForProject(currentProject);
      const target = baseWm.regions.find((r) => r.id === regionId);
      if (!target) return;

      updateProject(`delete land ${target.name}`, (proj) => {
        const wm = proj.worldMap ?? ensureWorldMapForProject(proj);
        const nextRegionGrid = wm.regionGrid.map((c) => (c === target.code ? 0 : c));
        const nextRegions = wm.regions.filter((r) => r.id !== regionId);
        const canDropLevel = proj.levels.length > 1;
        const nextLevels = canDropLevel
          ? proj.levels.filter((l) => l.id !== target.levelId)
          : proj.levels;
        return {
          ...proj,
          worldMap: {
            ...wm,
            regionGrid: nextRegionGrid,
            regions: nextRegions,
            revision: wm.revision + 1,
          },
          levels: nextLevels,
        };
      });

      if (selectedWorldLandCode === target.code) {
        setSelectedWorldLandCode(null);
      }
      if (worldEditorScope === target.levelId) {
        setWorldEditorScope('worldMap');
        setActiveWorldDomain('select');
      }
    },
    [currentProject, selectedWorldLandCode, updateProject, worldEditorScope]
  );

  const enterWorldEditorScope = useCallback(
    (scope: WorldEditorScope) => {
      if (!currentProject) {
        setWorldEditorScope(scope);
        return;
      }
      if (scope === 'worldMap') {
        setWorldEditorScope('worldMap');
        setActiveWorldDomain('select');
        setSelectedEntityID(null);
        if (!currentProject.worldMap) {
          ensureProjectWorldMap();
        }
        return;
      }

      const wm = currentProject.worldMap ?? ensureWorldMapForProject(currentProject);
      const targetLevel =
        currentProject.levels.find((l) => l.id === scope) ??
        currentProject.levels[0] ??
        null;
      if (!targetLevel) return;

      const region = wm.regions.find((r) => r.levelId === targetLevel.id);
      if (!currentProject.worldMap || region) {
        updateProject(
          `enter ${targetLevel.name}`,
          (proj) => {
            const baseWm = proj.worldMap ?? ensureWorldMapForProject(proj);
            const currentRegion = baseWm.regions.find((r) => r.levelId === targetLevel.id);
            let nextWm = baseWm;
            let resolvedOrigin = currentRegion?.origin;
            let originMoved = false;

            if (currentRegion) {
              const bounds = computeRegionBounds(baseWm, currentRegion.code);
              if (bounds && bounds.cellCount > 0) {
                const centeredOrigin = clampRegionOrigin(
                  bounds.centerX,
                  bounds.centerZ,
                  getWorldMapRadius(baseWm)
                );
                const ox = currentRegion.origin?.[0] ?? 0;
                const oz = currentRegion.origin?.[1] ?? 0;
                const currentLevelObj = proj.levels.find((l) => l.id === targetLevel.id);
                const currentRadius = getTerrainRadius(currentLevelObj?.terrain);
                const margin = currentRadius - 2;
                const fitsCurrentOrigin =
                  Boolean(currentRegion.origin) &&
                  bounds.minX >= ox - margin &&
                  bounds.maxX <= ox + margin &&
                  bounds.minZ >= oz - margin &&
                  bounds.maxZ <= oz + margin;
                const shiftDist = currentRegion.origin
                  ? Math.hypot(ox - centeredOrigin[0], oz - centeredOrigin[1])
                  : Infinity;
                const hasPlacedWork =
                  Boolean(currentLevelObj) &&
                  (currentLevelObj!.entities.length > 0 ||
                    hasManualTerrainEdits(currentLevelObj!.terrain));

                if (
                  !currentRegion.origin ||
                  !fitsCurrentOrigin ||
                  (!hasPlacedWork && shiftDist > 8)
                ) {
                  originMoved =
                    !currentRegion.origin ||
                    ox !== centeredOrigin[0] ||
                    oz !== centeredOrigin[1];
                  resolvedOrigin = centeredOrigin;
                  nextWm = {
                    ...baseWm,
                    regions: baseWm.regions.map((r) =>
                      r.id === currentRegion.id ? { ...r, origin: resolvedOrigin } : r
                    ),
                    revision: baseWm.revision + 1,
                  };
                }
              }
            }

            return {
              ...proj,
              worldMap: nextWm,
              levels: proj.levels.map((l) => {
                if (l.id !== targetLevel.id) return l;
                const oldRadius = getTerrainRadius(l.terrain);
                const newRadius = computeRegionWindowRadius(
                  nextWm,
                  currentRegion?.code,
                  resolvedOrigin
                );
                const shouldResetBase =
                  !hasManualTerrainEdits(l.terrain) &&
                  (originMoved ||
                    Math.abs(oldRadius - newRadius) > 0.5 ||
                    l.terrain?.worldRadius === undefined);
                let baseTerrain = l.terrain;
                if (shouldResetBase || originMoved) {
                  const freshScratch = createScratchOceanTerrain();
                  baseTerrain = {
                    ...freshScratch,
                    mountainConfig: l.terrain?.mountainConfig ?? freshScratch.mountainConfig,
                    dirtAndRoadConfig:
                      l.terrain?.dirtAndRoadConfig ?? freshScratch.dirtAndRoadConfig,
                  };
                }
                return {
                  ...l,
                  terrain: syncLevelTerrainWithWorldMap(
                    baseTerrain,
                    nextWm,
                    currentRegion?.code,
                    resolvedOrigin
                  ),
                };
              }),
            };
          },
          false
        );
      }

      setSelectedLevelID(targetLevel.id);
      setWorldEditorScope(targetLevel.id);
      setSelectedEntityID(targetLevel.entities[0]?.id ?? null);
    },
    [currentProject, ensureProjectWorldMap, updateProject]
  );

  const applyWorldMapBrushStroke = useCallback(
    (
      mode: WorldMapBrushMode,
      x: number,
      z: number,
      radius: number,
      _isStart = false,
      recordUndo = false,
      explicitRegionCode?: number
    ) => {
      if (!currentProject) return;
      updateProject(
        `world map ${mode}`,
        (proj) => {
          const baseWm = proj.worldMap ?? ensureWorldMapForProject(proj);
          const activeRegion =
            worldEditorScope !== 'worldMap' && currentLevel
              ? baseWm.regions.find((r) => r.levelId === currentLevel.id)
              : undefined;
          const fallbackCode = activeRegion ? activeRegion.code : selectedWorldLandCode ?? undefined;
          const targetCode = explicitRegionCode ?? fallbackCode;
          const [wx, wz] = activeRegion
            ? landLocalToWorldMap(x, z, activeRegion.origin)
            : [x, z];
          const nextWm = applyWorldMapStroke(
            baseWm,
            mode,
            wx,
            wz,
            radius,
            targetCode,
            mode === 'paintLand' && worldMapAutoLand
          );
          if (nextWm === baseWm && proj.worldMap) return proj;
          const nextLevels =
            worldEditorScope !== 'worldMap' && currentLevel
              ? proj.levels.map((lvl) => {
                  if (lvl.id !== currentLevel.id) return lvl;
                  const reg = nextWm.regions.find((r) => r.levelId === lvl.id);
                  return {
                    ...lvl,
                    terrain: syncLevelTerrainWithWorldMap(
                      lvl.terrain,
                      nextWm,
                      reg?.code,
                      reg?.origin
                    ),
                  };
                })
              : proj.levels;
          return {
            ...proj,
            worldMap: nextWm,
            levels: nextLevels,
          };
        },
        recordUndo
      );
    },
    [
      currentLevel,
      currentProject,
      selectedWorldLandCode,
      updateProject,
      worldEditorScope,
      worldMapAutoLand,
    ]
  );

  const startWorldFromScratch = useCallback(
    (mode: 'world' | 'currentLand') => {
      if (!currentProject) return;
      if (mode === 'world') {
        const blankWm = createEmptyWorldMap();
        const freshBase = createBlankLevel('Land 1', 'island', 'openWorld');
        const scratchLvl: GameLevel = {
          ...freshBase,
          id: currentLevel?.id ?? uid(),
          name: 'Land 1',
          biome: 'island',
          sky: 'sunny',
          weather: 'none',
          fog: 0.14,
          vistaPreset: 'none',
          vistaItems: [],
          sceneryTextures: undefined,
          timeOfDay: undefined,
          grass: undefined,
          entities: [],
          terrain: createScratchOceanTerrain(),
        };
        updateProject('start world from scratch', (proj) => ({
          ...proj,
          worldMap: blankWm,
          levels: [scratchLvl],
        }));
        setSelectedLevelID(scratchLvl.id);
        setSelectedEntityID(null);
        setSelectedWaterBodyId(null);
        setSelectedCaveId(null);
        setSelectedRoadId(null);
        setWorldEditorScope('worldMap');
        setWorldViewMode('2d');
        setSelectedWorldLandCode(null);
        setWorldMapBrushMode('terrain');
        setActiveWorldDomain('select');
      } else if (currentLevel) {
        updateProject('reset current land', (proj) => {
          const baseWm = proj.worldMap ?? ensureWorldMapForProject(proj);
          const reg = baseWm.regions.find((r) => r.levelId === currentLevel.id);
          const nextWm = reg
            ? {
                ...baseWm,
                revision: baseWm.revision + 1,
              }
            : baseWm;
          return {
            ...proj,
            worldMap: nextWm,
            levels: proj.levels.map((l) =>
              l.id === currentLevel.id
                ? {
                    ...l,
                    biome: l.biome === 'snow' ? 'island' : l.biome,
                    sky: l.sky === 'storm' || l.sky === 'cave' ? 'sunny' : l.sky,
                    weather: 'none',
                    fog: 0.14,
                    vistaPreset: 'none',
                    vistaItems: [],
                    sceneryTextures: undefined,
                    timeOfDay: undefined,
                    entities: [],
                    terrain: reg
                      ? syncLevelTerrainWithWorldMap(
                          createScratchOceanTerrain(),
                          nextWm,
                          reg.code,
                          reg.origin
                        )
                      : createScratchOceanTerrain(),
                  }
                : l
            ),
          };
        });
        setSelectedEntityID(null);
        setSelectedWaterBodyId(null);
        setSelectedCaveId(null);
        setSelectedRoadId(null);
      }
    },
    [currentLevel, currentProject, updateProject]
  );

  const addEntity = useCallback(
    (
      kind: EntityKind,
      name?: string,
      position?: { x: number; y: number },
      customAssetId?: string
    ) => {
      const pos = position ?? {
        x: 0.25 + Math.random() * 0.5,
        y: 0.25 + Math.random() * 0.5,
      };
      const meta = customAssetId ? customAssets.find((a) => a.id === customAssetId) : undefined;
      let resolvedKind = kind;
      let extraProps: Partial<LevelEntity> = {
        customAssetId,
        platformEnd: kind === 'platform' ? { x: Math.min(0.9, pos.x + 0.14), y: pos.y } : undefined,
      };
      if (meta?.defaultRolePreset) {
        if (meta.defaultRolePreset === 'buddy') {
          resolvedKind = 'npc';
          extraProps.isBuddy = true;
          extraProps.critterAttitude = 'none';
        } else if (meta.defaultRolePreset === 'enemy') {
          resolvedKind = 'baddie';
        } else if (meta.defaultRolePreset === 'neutralSpeaker') {
          resolvedKind = 'npc';
          extraProps.isBuddy = false;
        } else if (meta.defaultRolePreset === 'neutralSilent') {
          resolvedKind = 'npc';
          extraProps.isBuddy = false;
          extraProps.dialogue = '';
        }
      }
      if (meta?.defaultDialogue) extraProps.dialogue = meta.defaultDialogue;
      if (meta?.defaultPickupItemId) {
        extraProps.pickupable = true;
        extraProps.pickupItemId = meta.defaultPickupItemId;
      }
      if (meta?.defaultLoot) extraProps.loot = meta.defaultLoot;
      if (meta?.interactionAttributes?.length) {
        extraProps.interactionAttributes = [...meta.interactionAttributes];
      }
      if (meta?.interactionCalibrations) {
        extraProps.interactionCalibrations = JSON.parse(
          JSON.stringify(meta.interactionCalibrations)
        ) as Partial<Record<ObjectInteractionAttributeId, ObjectInteractionCalibration>>;
      }
      const entity = createEntity(
        resolvedKind,
        name ?? meta?.name ?? resolvedKind.charAt(0).toUpperCase() + resolvedKind.slice(1),
        pos.x,
        pos.y,
        extraProps
      );
      updateLevel(`add ${entity.name}`, (lvl) => ({
        ...lvl,
        entities: [...lvl.entities, entity],
      }));
      setSelectedEntityID(entity.id);
      return entity;
    },
    [customAssets, updateLevel]
  );

  const saveCustomMonster = useCallback(
    (bp: MonsterBlueprint) => {
      updateProject(`save monster ${bp.name}`, (proj) => {
        const list = proj.customMonsters ?? [];
        const idx = list.findIndex((m) => m.id === bp.id);
        const nextList =
          idx >= 0 ? list.map((m, i) => (i === idx ? bp : m)) : [...list, bp];
        return { ...proj, customMonsters: nextList };
      });
    },
    [updateProject]
  );

  const spawnMonsterEntity = useCallback(
    (bp: MonsterBlueprint, position?: BoardPoint) => {
      const pos = position ?? {
        x: 0.35 + Math.random() * 0.3,
        y: 0.35 + Math.random() * 0.3,
      };
      const kind: EntityKind = bp.role === 'baddie' ? 'baddie' : 'npc';
      const entity = createEntity(kind, bp.name, pos.x, pos.y, {
        isBuddy: bp.role === 'buddy',
        isBoss: Boolean(bp.isBoss),
        brain: bp.canFly ? 'Flyer' : bp.role === 'baddie' ? 'Chaser' : 'Walker',
        speed: bp.speed ?? 4,
        health: bp.health ?? (bp.role === 'baddie' ? 5 : 4),
        dialogue:
          bp.dialogue ??
          (bp.role === 'baddie'
            ? 'Grrrr! Look out!'
            : bp.role === 'buddy'
            ? 'I will travel beside you!'
            : 'Nice day to trot around the island!'),
        monsterConfig: bp,
      });
      updateLevel(`place ${bp.name}`, (lvl) => ({
        ...lvl,
        entities: [...lvl.entities, entity],
      }));
      setSelectedSection('cast');
      setSelectedEntityID(entity.id);
      return entity;
    },
    [updateLevel]
  );

  const placeWorldPointBoardHelper = useCallback(
    (worldX: number, worldZ: number): BoardPoint => levelWorldToBoard(currentLevel, worldX, worldZ),
    [currentLevel]
  );

  const addBuildingBlockEntity = useCallback(
    (
      shapeOrDoor: BuildingShapeId | 'door' | 'rusticDoor',
      material: BuildingMaterialId,
      pos: { x: number; y: number },
      opts: {
        elevationY?: number;
        rotation?: number;
        scale?: number;
        name?: string;
        doorConfig?: Partial<DoorConfig>;
        buildingBlockPatch?: Partial<BuildingBlockConfig>;
        materialVariant?: EntityMaterialVariant;
      } = {}
    ) => {
      if (shapeOrDoor === 'door' || shapeOrDoor === 'rusticDoor') {
        const isRustic = shapeOrDoor === 'rusticDoor';
        const doorCfg: DoorConfig = {
          ...DEFAULT_DOOR_CONFIG,
          ...(isRustic
            ? {
                frameShape: 'rectangular',
                leafStyle: 'rusticWood',
                openMode: 'hingedSide',
                frameMaterial:
                  material === 'timberPlank' || material === 'roundLogs' || material === 'weatheredSlats'
                    ? material
                    : 'timberPlank',
              }
            : { frameMaterial: material }),
          ...opts.doorConfig,
        };
        const entity = createEntity(
          'door',
          opts.name ?? (isRustic ? 'Rustic Front Door' : 'Dungeon Door'),
          pos.x,
          pos.y,
          {
            rotation: opts.rotation ?? 0,
            scale: opts.scale ?? 1,
            elevationY: opts.elevationY,
            doorConfig: doorCfg,
            ...(opts.materialVariant ? { materialVariant: { ...opts.materialVariant } } : {}),
          }
        );
        updateLevel(`place ${entity.name}`, (lvl) => ({
          ...lvl,
          entities: [...lvl.entities, entity],
        }));
        setSelectedEntityID(entity.id);
        return entity;
      }

      const resolvedShape: BuildingShapeId =
        material === 'sandstone'
          ? shapeOrDoor === 'wallCubeHalf'
            ? 'wallCubeHalf'
            : 'wallCube'
          : shapeOrDoor;
      const shapeMeta = BUILDING_SHAPES.find((s) => s.id === resolvedShape) ?? BUILDING_SHAPES[0];
      const kind: EntityKind = resolvedShape === 'wallTorch' ? 'light' : 'prop';
      const isRoof = resolvedShape === 'roofAFrame' || resolvedShape === 'roofSlope';
      const isBeam =
        resolvedShape === 'beamLarge' || resolvedShape === 'beamSmall' || resolvedShape === 'plankTrim';
      const defaultName =
        material === 'sandstone'
          ? resolvedShape === 'wallCubeHalf'
            ? 'Half Sandstone Cube'
            : 'Sandstone Cube'
          : shapeMeta.defaultName;
      const entity = createEntity(kind, opts.name ?? defaultName, pos.x, pos.y, {
        rotation: opts.rotation ?? 0,
        scale: opts.scale ?? 1,
        elevationY: opts.elevationY,
        ...(opts.materialVariant ? { materialVariant: { ...opts.materialVariant } } : {}),
        buildingBlock: {
          shape: resolvedShape,
          material,
          ...(material === 'sandstone' ? { edgeWear: 0.35 } : {}),
          ...(resolvedShape === 'archway' ? { archStyle: 'arched' } : {}),
          ...(resolvedShape === 'windowWall' ? { windowStyle: 'barred' } : {}),
          ...(isRoof ? { roofStyle: inferRoofStyleFromMaterial(material), roofMedievalTruss: true } : {}),
          ...(resolvedShape === 'roofGable' ? { roofMedievalTruss: true } : {}),
          ...(resolvedShape === 'fence' ? { fenceStyle: 'rail' } : {}),
          ...(isBeam ? { beamOrientation: 'horizontal' } : {}),
          ...opts.buildingBlockPatch,
        },
      });
      updateLevel(`place ${entity.name}`, (lvl) => ({
        ...lvl,
        entities: [...lvl.entities, entity],
      }));
      setSelectedEntityID(entity.id);
      return entity;
    },
    [updateLevel]
  );

  const addEntitiesBatch = useCallback(
    (undoLabel: string, entities: LevelEntity[]) => {
      if (entities.length === 0) return [];
      updateLevel(undoLabel, (lvl) => ({
        ...lvl,
        entities: [...lvl.entities, ...entities],
      }));
      setSelectedEntityID(entities[0].id);
      return entities;
    },
    [updateLevel]
  );

  const addFxTemplateAtPoint = useCallback(
    (template: FxLibraryTemplate, position?: { x: number; y: number }) => {
      const basePos = position ?? { x: 0.5, y: 0.5 };
      const created: LevelEntity[] = template.layers.map((layer) => {
        const dx = layer.offset?.[0] ?? 0;
        const dy = layer.offset?.[1] ?? 0;
        const px = Math.max(0.06, Math.min(0.94, basePos.x + dx));
        const py = Math.max(0.06, Math.min(0.94, basePos.y + dy));
        const layerName = layer.nameSuffix
          ? `${template.name} · ${layer.nameSuffix}`
          : template.name;
        return createEntity('fxEmitter', layerName, px, py, {
          scale: layer.scale ?? 1,
          fxEmitter: {
            ...layer.config,
            targetOffset: [...layer.config.targetOffset] as [number, number, number],
          },
        });
      });

      if (created.length === 0) return null;

      updateLevel(`place FX: ${template.name}`, (lvl) => ({
        ...lvl,
        entities: [...lvl.entities, ...created],
      }));
      setSelectedEntityID(created[0].id);
      return created[0];
    },
    [updateLevel]
  );

  const addCanopyTreeEntity = useCallback(
    (config: StylizedCanopyConfig, position?: { x: number; y: number }, label = 'Stylized Tree') => {
      const pos = position ?? {
        x: 0.42 + Math.random() * 0.16,
        y: 0.42 + Math.random() * 0.16,
      };
      const entity = createEntity('scenery', label, pos.x, pos.y, {
        rotation: Math.round(Math.random() * 360),
        scale: Number((0.92 + Math.random() * 0.24).toFixed(2)),
        canopyTree: {
          ...config,
          enabled: true,
          seed: Math.floor(Math.random() * 90000) + 1000,
        },
      });
      updateLevel(`place ${label}`, (lvl) => ({
        ...lvl,
        entities: [...lvl.entities, entity],
      }));
      setSelectedEntityID(entity.id);
      return entity;
    },
    [updateLevel]
  );

  const scatterCanopyGrove = useCallback(
    (config: StylizedCanopyConfig, count = 10) => {
      updateLevel(`scatter ${count} stylized trees`, (lvl) => {
        const baseTerrain = lvl.terrain ?? createInitialTerrain();
        const nextScatter = [...baseTerrain.scatter];
        const halfExtent = IslandTerrain.radius * 0.72;
        let placed = 0;
        let attempts = 0;
        const scatterKind =
          config.treeType === 'conifer'
            ? 'pine'
            : config.treeType === 'birch'
            ? 'birch'
            : 'oak';
        while (placed < count && attempts < count * 18) {
          attempts++;
          const rx = (Math.random() * 2 - 1) * halfExtent;
          const rz = (Math.random() * 2 - 1) * halfExtent;
          const h = sampleTerrainHeight(baseTerrain, rx, rz);
          if (h < IslandTerrain.waterLevel + 0.55) continue;
          // Avoid overlapping existing trees too tightly
          const tooClose = nextScatter.some(
            (s) =>
              (s.kind === 'oak' || s.kind === 'pine' || s.kind === 'birch' || s.kind === 'tree') &&
              Math.hypot(s.x - rx, s.z - rz) < 4.2
          );
          if (tooClose) continue;
          nextScatter.push({
            id: uid(),
            kind: scatterKind,
            x: rx,
            z: rz,
            size: 0.82 + Math.random() * 0.42,
            rotation: Math.random() * Math.PI * 2,
          });
          placed++;
        }
        return {
          ...lvl,
          canopyEngine: {
            ...config,
            enabled: true,
            targetTrees:
              config.targetTrees === 'placedOnly' ? 'matching' : config.targetTrees,
          },
          terrain: {
            ...baseTerrain,
            scatter: nextScatter,
            revision: baseTerrain.revision + 1,
          },
        };
      });
    },
    [updateLevel]
  );

  const applyDefaultTreeStylesToLevels = useCallback(
    (scope: 'current' | 'all' = 'current') => {
      if (!currentProject) return;
      if (scope === 'current') {
        updateLevel(
          'apply default tree styles',
          (lvl) => ({
            ...lvl,
            canopyEngine: buildCanopyConfigFromUserDefaults(lvl.canopyEngine, {
              forceEnable: true,
              ignoreAutoApplyFlag: true,
            }),
          }),
          true
        );
        return;
      }
      updateProject(
        'apply default tree styles across all lands',
        (proj) => ({
          ...proj,
          levels: proj.levels.map((lvl) => ({
            ...lvl,
            canopyEngine: buildCanopyConfigFromUserDefaults(lvl.canopyEngine, {
              forceEnable: true,
              ignoreAutoApplyFlag: true,
            }),
          })),
        }),
        true
      );
    },
    [currentProject, updateLevel, updateProject]
  );

  const addMechanicalEntityToLevel = useCallback(
    (opts: {
      name: string;
      kind: EntityKind;
      customAssetId?: string;
      mechTemplate?: BuiltinMechanismTemplate;
      mechanisms: ObjectMechanism[];
    }) => {
      const heroEntity = currentLevel?.entities.find((e) => e.kind === 'hero');
      const heroStart = heroEntity?.position ?? { x: 0.5, y: 0.5 };
      const existingMechCount = (currentLevel?.entities ?? []).filter(
        (e) => e.mechTemplate || (e.mechanisms && e.mechanisms.length > 0)
      ).length;
      const angle = existingMechCount * 1.15;
      const dist = 0.08 + (existingMechCount % 3) * 0.035;
      const px = Math.max(0.14, Math.min(0.86, heroStart.x + Math.cos(angle) * dist));
      const py = Math.max(0.14, Math.min(0.86, heroStart.y + Math.sin(angle) * dist));
      const entity = createEntity(opts.kind, opts.name, px, py, {
        customAssetId: opts.customAssetId,
        mechTemplate: opts.mechTemplate,
        mechanisms: opts.mechanisms,
      });
      updateLevel(`place ${entity.name}`, (lvl) => ({
        ...lvl,
        entities: [...lvl.entities, entity],
      }));
      setSelectedEntityID(entity.id);
      return entity;
    },
    [currentLevel, updateLevel]
  );

  const updateEntity = useCallback(
    (id: string, undoLabel: string, updater: (e: LevelEntity) => LevelEntity, recordUndo = true) => {
      updateLevel(
        undoLabel,
        (lvl) => ({
          ...lvl,
          entities: lvl.entities.map((e) => (e.id === id ? updater(e) : e)),
        }),
        recordUndo
      );
    },
    [updateLevel]
  );

  const moveEntity = useCallback(
    (id: string, pos: { x: number; y: number }, recordUndo = false, elevationY?: number) => {
      if (id === HERO_START_ENTITY_ID) {
        setPlayFromPoint(null);
        updateLevel(
          'move hero',
          (lvl) => ({
            ...lvl,
            hasStart: true,
            startPoint: pos,
          }),
          recordUndo
        );
        return;
      }
      updateEntity(
        id,
        'move item',
        (e) => ({
          ...e,
          position: pos,
          ...(elevationY !== undefined ? { elevationY } : {}),
        }),
        recordUndo
      );
    },
    [updateEntity, updateLevel]
  );

  const rotateHeroStart = useCallback(
    (rotationDeg: number, recordUndo = false) => {
      const normalized = ((Math.round(rotationDeg) % 360) + 360) % 360;
      updateLevel(
        'rotate hero',
        (lvl) => ({
          ...lvl,
          hasStart: true,
          startRotation: normalized,
        }),
        recordUndo
      );
    },
    [updateLevel]
  );

  const deleteEntity = useCallback(
    (id: string) => {
      updateLevel('delete item', (lvl) => ({
        ...lvl,
        entities: lvl.entities.filter((e) => e.id !== id),
      }));
      if (selectedEntityID === id) {
        setSelectedEntityID(null);
      }
    },
    [selectedEntityID, updateLevel]
  );

  const addEmptyCard = useCallback(
    (entityID: string) => {
      const card: BehaviorCard = {
        id: uid(),
        when: { id: uid(), key: 'playerTouches', detail: '' },
        conditions: [],
        actions: [{ id: uid(), key: 'say', detail: 'Hello!' }],
        isOnce: false,
        isEnabled: true,
      };
      updateEntity(entityID, 'add a rule', (e) => ({
        ...e,
        cards: [...e.cards, card],
      }));
    },
    [updateEntity]
  );

  const applyRecipe = useCallback(
    (recipe: RuleRecipe) => {
      if (!selectedEntityID) return;
      const card: BehaviorCard = {
        id: uid(),
        when: { id: uid(), key: recipe.whenKey, detail: '' },
        conditions: recipe.conditionKeys.map((k) => ({ id: uid(), key: k, detail: '' })),
        actions: recipe.actionKeys.map((k) => ({
          id: uid(),
          key: k,
          detail: k === 'say' ? 'Watch out!' : k === 'giveTreasure' ? '3 coins' : '',
        })),
        isOnce: false,
        isEnabled: true,
      };
      updateEntity(selectedEntityID, `use ${recipe.title}`, (e) => ({
        ...e,
        cards: [...e.cards, card],
      }));
    },
    [selectedEntityID, updateEntity]
  );

  const toggleAction = useCallback(
    (actionId: string) => {
      updateProject('toggle move', (proj) => {
        const has = proj.enabledActions.includes(actionId);
        return {
          ...proj,
          enabledActions: has
            ? proj.enabledActions.filter((id) => id !== actionId)
            : [...proj.enabledActions, actionId],
        };
      });
    },
    [updateProject]
  );

  const enableAllActions = useCallback(() => {
    updateProject('enable all moves', (proj) => ({
      ...proj,
      enabledActions: ActionRegistry.map((a) => a.id),
    }));
  }, [updateProject]);

  const resetActions = useCallback(() => {
    updateProject('reset moves', (proj) => ({
      ...proj,
      enabledActions: [...StarterActions],
    }));
  }, [updateProject]);

  const addWidget = useCallback(
    (kind: WidgetKind) => {
      const meta = WidgetKindMeta[kind];
      const anchor =
        kind === 'bossBar'
          ? 'top'
          : kind === 'dialogue'
          ? 'bottom'
          : kind === 'joystick'
          ? 'bottomLeading'
          : kind === 'actionButton'
          ? 'bottomTrailing'
          : 'topLeading';
      const widget = makeWidget(
        kind,
        anchor,
        kind === 'counter' ? 'coins' : kind === 'joystick' ? 'move' : kind === 'actionButton' ? 'action' : 'health',
        kind === 'joystick' ? '#1E2434' : kind === 'actionButton' ? '#20B46A' : Palette.accent,
        kind === 'actionButton' ? 'Jump' : kind === 'joystick' ? 'Move' : meta.title,
        0,
        0
      );
      updateProject(`add ${meta.title}`, (proj) => ({
        ...proj,
        hud: {
          ...proj.hud,
          widgets: [...proj.hud.widgets, widget],
        },
      }));
      setSelectedWidgetID(widget.id);
    },
    [updateProject]
  );

  const resetHUDToDefault = useCallback(() => {
    const fresh = defaultHUDProfile();
    updateProject('reset HUD layout', (proj) => ({
      ...proj,
      hud: fresh,
    }));
    setSelectedWidgetID(fresh.widgets[0]?.id ?? null);
  }, [updateProject]);

  const updateWidget = useCallback(
    (id: string, undoLabel: string, updater: (w: HUDWidget) => HUDWidget, recordUndo = true) => {
      updateProject(
        undoLabel,
        (proj) => ({
          ...proj,
          hud: {
            ...proj.hud,
            widgets: proj.hud.widgets.map((w) => (w.id === id ? updater(w) : w)),
          },
        }),
        recordUndo
      );
    },
    [updateProject]
  );

  const deleteWidget = useCallback(
    (id: string) => {
      updateProject('remove HUD widget', (proj) => ({
        ...proj,
        hud: {
          ...proj.hud,
          widgets: proj.hud.widgets.filter((w) => w.id !== id),
        },
      }));
      if (selectedWidgetID === id) {
        setSelectedWidgetID(null);
      }
    },
    [selectedWidgetID, updateProject]
  );

  const addInventoryItem = useCallback(
    (item: InventoryItemDef) => {
      updateProject(`add item ${item.name}`, (proj) => {
        const base = proj.inventoryItems?.length ? proj.inventoryItems : [...DefaultInventoryItems];
        return {
          ...proj,
          inventoryItems: [...base.filter((i) => i.id !== item.id), item],
        };
      });
    },
    [updateProject]
  );

  const updateInventoryItem = useCallback(
    (item: InventoryItemDef) => {
      updateProject(`update item ${item.name}`, (proj) => {
        const base = proj.inventoryItems?.length ? proj.inventoryItems : [...DefaultInventoryItems];
        const exists = base.some((i) => i.id === item.id);
        return {
          ...proj,
          inventoryItems: exists
            ? base.map((i) => (i.id === item.id ? item : i))
            : [...base, item],
        };
      });
    },
    [updateProject]
  );

  const deleteInventoryItem = useCallback(
    (itemId: string) => {
      updateProject('delete inventory item', (proj) => {
        const base = proj.inventoryItems?.length ? proj.inventoryItems : [...DefaultInventoryItems];
        return {
          ...proj,
          inventoryItems: base.filter((i) => i.id !== itemId),
        };
      });
      if (selectedInventoryItemId === itemId) {
        setSelectedInventoryItemId(null);
      }
    },
    [selectedInventoryItemId, updateProject]
  );

  const updateInventoryItemMetadata = useCallback(
    (itemId: string, patch: Partial<ItemMetadata>) => {
      updateProject('update item metadata', (proj) => {
        const base = proj.inventoryItems?.length ? proj.inventoryItems : [...DefaultInventoryItems];
        return {
          ...proj,
          inventoryItems: base.map((item) => {
            if (item.id !== itemId) return item;
            const nextMeta: ItemMetadata = {
              ...(item.metadata ?? {}),
              ...patch,
              properties: {
                ...(item.metadata?.properties ?? {}),
                ...(patch.properties ?? {}),
              },
            };
            return {
              ...item,
              metadata: nextMeta,
              ...(patch.magic_effect !== undefined ? { magicEffect: patch.magic_effect } : {}),
            };
          }),
        };
      });
    },
    [updateProject]
  );

  const wearItemDurability = useCallback(
    (itemId: string, amount = 2) => {
      const items = currentProject?.inventoryItems?.length
        ? currentProject.inventoryItems
        : DefaultInventoryItems;
      const target = items.find((i) => i.id === itemId);
      const baseMeta = target ? resolveItemMetadata(target) : null;
      const fallbackMax = baseMeta?.maxDurability ?? 100;
      const fallbackCur = baseMeta?.durability ?? fallbackMax;
      if (fallbackMax <= 1) return;

      setRuntimeDurability((prev) => {
        const existing = prev[itemId];
        const maxDurability = existing?.maxDurability ?? fallbackMax;
        const curDurability = existing?.durability ?? fallbackCur;
        const nextDurability = Math.max(0, curDurability - amount);
        return {
          ...prev,
          [itemId]: { durability: nextDurability, maxDurability },
        };
      });
    },
    [currentProject?.inventoryItems]
  );

  const repairItemDurability = useCallback(
    (itemId: string) => {
      const items = currentProject?.inventoryItems?.length
        ? currentProject.inventoryItems
        : DefaultInventoryItems;
      const target = items.find((i) => i.id === itemId);
      const baseMeta = target ? resolveItemMetadata(target) : null;
      const maxDurability = baseMeta?.maxDurability ?? 100;

      setRuntimeDurability((prev) => ({
        ...prev,
        [itemId]: { durability: maxDurability, maxDurability },
      }));
    },
    [currentProject?.inventoryItems]
  );

  const resetRuntimeDurability = useCallback(() => {
    setRuntimeDurability({});
  }, []);

  const addCraftingRecipe = useCallback(
    (recipe: CraftingRecipe) => {
      updateProject(`add recipe ${recipe.title}`, (proj) => {
        const base = proj.craftingRecipes?.length ? proj.craftingRecipes : [...DefaultCraftingRecipes];
        return {
          ...proj,
          craftingRecipes: [...base.filter((r) => r.id !== recipe.id), recipe],
        };
      });
    },
    [updateProject]
  );

  const deleteCraftingRecipe = useCallback(
    (recipeId: string) => {
      updateProject('delete crafting recipe', (proj) => {
        const base = proj.craftingRecipes?.length ? proj.craftingRecipes : [...DefaultCraftingRecipes];
        return {
          ...proj,
          craftingRecipes: base.filter((r) => r.id !== recipeId),
        };
      });
    },
    [updateProject]
  );

  const updateInventoryConfig = useCallback(
    (label: string, updater: (cfg: GameInventoryConfig) => GameInventoryConfig) => {
      updateProject(label, (proj) => ({
        ...proj,
        inventoryConfig: updater(resolveGameInventoryConfig(proj)),
      }));
    },
    [updateProject]
  );

  const collectProjectResourceIds = useCallback((project: GameProject) => {
    const usedIds = new Set<string>();
    const usedTexIds = new Set<string>();
    if (project.heroCustomAssetId) usedIds.add(project.heroCustomAssetId);
    for (const lvl of project.levels) {
      if (lvl.canopyEngine?.canopyAssetId) usedIds.add(lvl.canopyEngine.canopyAssetId);
      if (lvl.canopyEngine?.trunkAssetId) usedIds.add(lvl.canopyEngine.trunkAssetId);
      if (lvl.canopyEngine?.fruitAssetId) usedIds.add(lvl.canopyEngine.fruitAssetId);
      if (lvl.canopyEngine?.speciesProfiles) {
        for (const prof of Object.values(lvl.canopyEngine.speciesProfiles)) {
          if (!prof) continue;
          if (prof.canopyAssetId) usedIds.add(prof.canopyAssetId);
          if (prof.trunkAssetId) usedIds.add(prof.trunkAssetId);
          if (prof.fruitAssetId) usedIds.add(prof.fruitAssetId);
        }
      }
      for (const ent of lvl.entities) {
        if (ent.customAssetId) usedIds.add(ent.customAssetId);
        if (ent.canopyTree?.canopyAssetId) usedIds.add(ent.canopyTree.canopyAssetId);
        if (ent.canopyTree?.trunkAssetId) usedIds.add(ent.canopyTree.trunkAssetId);
        if (ent.canopyTree?.fruitAssetId) usedIds.add(ent.canopyTree.fruitAssetId);
        if (ent.fxEmitter?.customMeshAssetId) usedIds.add(ent.fxEmitter.customMeshAssetId);
      }
      for (const sc of lvl.terrain?.scatter ?? []) {
        if (sc.customAssetId) usedIds.add(sc.customAssetId);
      }
      for (const vi of lvl.vistaItems ?? []) {
        if (vi.customAssetId) usedIds.add(vi.customAssetId);
      }
      for (const tid of collectReferencedTextureIds(
        lvl.sceneryTextures,
        lvl.canopyEngine,
        lvl.entities.map((e) => e.canopyTree)
      )) {
        usedTexIds.add(tid);
      }
    }
    const usedVoiceIds = collectReferencedVoiceIds(project.levels, [
      project.storybook?.prologueVoice,
      project.storybook?.epilogueVoice,
    ]);
    return { usedIds, usedTexIds, usedVoiceIds };
  }, []);

  const exportProjectJSON = useCallback(
    async (project: GameProject, includeAssets = true): Promise<string> => {
      const assets: ExportedAssetBundle[] = [];
      const textures: ExportedTextureBundle[] = [];
      const voiceOvers: ExportedVoiceBundle[] = [];
      if (includeAssets) {
        const { usedIds, usedTexIds, usedVoiceIds } = collectProjectResourceIds(project);
        for (const assetId of usedIds) {
          const meta = customAssets.find((a) => a.id === assetId);
          if (!meta) continue;
          const blob = await getAssetBlob(assetId);
          if (!blob) continue;
          assets.push({
            meta,
            base64Glb: arrayBufferToBase64(blob),
          });
        }
        for (const texId of usedTexIds) {
          const meta = customTextures.find((t) => t.id === texId);
          if (!meta) continue;
          const rec = await getTextureBlobRecord(texId);
          if (!rec) continue;
          textures.push({
            meta,
            mimeType: rec.mimeType,
            base64Image: arrayBufferToBase64(rec.buffer),
          });
        }
        for (const vid of usedVoiceIds) {
          const meta = await getVoiceMeta(vid);
          const rec = await getVoiceBlobRecord(vid);
          if (!meta || !rec) continue;
          voiceOvers.push({
            meta,
            mimeType: rec.mimeType || meta.mimeType,
            base64Audio: arrayBufferToBase64(rec.buffer),
          });
        }
      }

      const bundle = {
        format:
          assets.length > 0 || textures.length > 0 || voiceOvers.length > 0
            ? 'maker.game.v2'
            : 'maker.game.v1',
        title: project.name,
        subtitle: project.coverTagline || project.tagline,
        summary: `${project.levels.length} levels, ${project.levels.reduce((s, l) => s + l.entities.length, 0)} entities`,
        project,
        assets: assets.length > 0 ? assets : undefined,
        textures: textures.length > 0 ? textures : undefined,
        voiceOvers: voiceOvers.length > 0 ? voiceOvers : undefined,
      };
      return JSON.stringify(bundle, null, 2);
    },
    [collectProjectResourceIds, customAssets, customTextures]
  );

  const importProjectJSON = useCallback(
    async (rawText: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        const parsed = JSON.parse(rawText);
        const proj: GameProject = parsed.project ?? parsed;
        if (!proj || !proj.name || !Array.isArray(proj.levels)) {
          return { ok: false, error: 'That file does not look like a Maker game.' };
        }

        if (Array.isArray(parsed.assets)) {
          for (const entry of parsed.assets as ExportedAssetBundle[]) {
            if (entry?.meta?.id && entry.base64Glb) {
              const buffer = base64ToArrayBuffer(entry.base64Glb);
              await saveAssetRecord(entry.meta, buffer);
            }
          }
          const refreshed = await listAssetMetas();
          setCustomAssets(refreshed);
        }

        if (Array.isArray(parsed.textures)) {
          for (const entry of parsed.textures as ExportedTextureBundle[]) {
            if (entry?.meta?.id && entry.base64Image) {
              const buffer = base64ToArrayBuffer(entry.base64Image);
              await saveTextureRecord(entry.meta, buffer, entry.mimeType || 'image/png');
            }
          }
          const refreshedTex = await listTextureMetas();
          setCustomTextures(refreshedTex);
        }

        if (Array.isArray(parsed.voiceOvers)) {
          for (const entry of parsed.voiceOvers as ExportedVoiceBundle[]) {
            if (entry?.meta?.id && entry.base64Audio) {
              const buffer = base64ToArrayBuffer(entry.base64Audio);
              await saveVoiceRecord(
                { ...entry.meta, mimeType: entry.mimeType || entry.meta.mimeType || 'audio/webm' },
                buffer
              );
            }
          }
        }

        const imported: GameProject = migrateProject({
          ...proj,
          id: uid(),
          updatedAt: new Date().toISOString(),
          sharedBy: parsed.sharedBy || proj.sharedBy || 'Imported',
        });
        setProjects((prev) => [imported, ...prev]);
        setCurrentProjectID(imported.id);
        setSelectedLevelID(imported.levels[0]?.id ?? null);
        setSelectedEntityID(imported.levels[0]?.entities[0]?.id ?? null);
        setSelectedTab('world');
        return { ok: true };
      } catch {
        return { ok: false, error: 'Could not read that project file.' };
      }
    },
    []
  );

  const exportCompressedMakerFile = useCallback(
    async (
      project: GameProject,
      opts?: { includeAssets?: boolean; sharedBy?: string }
    ): Promise<CompressedMakerResult> => {
      const targetProject: GameProject = opts?.sharedBy?.trim()
        ? { ...project, sharedBy: opts.sharedBy.trim() }
        : project;
      const rawJson = await exportProjectJSON(targetProject, opts?.includeAssets ?? true);
      // Compact before gzip for maximum compression ratio
      const compactJson = JSON.stringify(JSON.parse(rawJson));
      const result = await compressMakerBundle(compactJson, targetProject.name);
      triggerBlobDownload(result.blob, result.filename);
      return result;
    },
    [exportProjectJSON]
  );

  const exportProjectZip = useCallback(
    async (
      project: GameProject,
      opts?: { includeAssets?: boolean; sharedBy?: string }
    ): Promise<ZipProjectExportResult> => {
      const includeAssets = opts?.includeAssets ?? true;
      const assets: ZipAssetEntry[] = [];
      const textures: ZipTextureEntry[] = [];
      const voiceOvers: ZipVoiceEntry[] = [];

      if (includeAssets) {
        const { usedIds, usedTexIds, usedVoiceIds } = collectProjectResourceIds(project);
        for (const assetId of usedIds) {
          const meta = customAssets.find((a) => a.id === assetId);
          if (!meta) continue;
          const buffer = await getAssetBlob(assetId);
          if (!buffer) continue;
          assets.push({ meta, buffer });
        }
        for (const texId of usedTexIds) {
          const meta = customTextures.find((t) => t.id === texId);
          if (!meta) continue;
          const rec = await getTextureBlobRecord(texId);
          if (!rec) continue;
          textures.push({
            meta,
            mimeType: rec.mimeType,
            buffer: rec.buffer,
          });
        }
        for (const vid of usedVoiceIds) {
          const meta = await getVoiceMeta(vid);
          const rec = await getVoiceBlobRecord(vid);
          if (!meta || !rec) continue;
          voiceOvers.push({
            meta,
            mimeType: rec.mimeType || meta.mimeType,
            buffer: rec.buffer,
          });
        }
      }

      const result = await buildProjectZipArchive({
        project,
        sharedBy: opts?.sharedBy,
        assets,
        textures,
        voiceOvers,
      });
      triggerBlobDownload(result.blob, result.filename);
      return result;
    },
    [collectProjectResourceIds, customAssets, customTextures]
  );

  const importProjectFile = useCallback(
    async (file: File): Promise<{ ok: boolean; error?: string }> => {
      try {
        const text = (await isZipArchiveFile(file))
          ? await readMakerZipAsBundleText(file)
          : await readMakerFileAsText(file);
        return await importProjectJSON(text);
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Could not open that game file.',
        };
      }
    },
    [importProjectJSON]
  );

  const packReferencedAssetsAndTextures = useCallback(
    async (
      usedAssetIds: Set<string>,
      usedTextureIds: Set<string>,
      usedVoiceIds?: Set<string>
    ): Promise<{
      assets: ExportedAssetBundle[];
      textures: ExportedTextureBundle[];
      voiceOvers: ExportedVoiceBundle[];
    }> => {
      const assets: ExportedAssetBundle[] = [];
      const textures: ExportedTextureBundle[] = [];
      const voiceOvers: ExportedVoiceBundle[] = [];
      for (const assetId of usedAssetIds) {
        const meta = customAssets.find((a) => a.id === assetId);
        if (!meta) continue;
        const blob = await getAssetBlob(assetId);
        if (!blob) continue;
        assets.push({ meta, base64Glb: arrayBufferToBase64(blob) });
      }
      for (const texId of usedTextureIds) {
        const meta = customTextures.find((t) => t.id === texId);
        if (!meta) continue;
        const rec = await getTextureBlobRecord(texId);
        if (!rec) continue;
        textures.push({
          meta,
          mimeType: rec.mimeType,
          base64Image: arrayBufferToBase64(rec.buffer),
        });
      }
      if (usedVoiceIds) {
        for (const vid of usedVoiceIds) {
          const meta = await getVoiceMeta(vid);
          const rec = await getVoiceBlobRecord(vid);
          if (!meta || !rec) continue;
          voiceOvers.push({
            meta,
            mimeType: rec.mimeType || meta.mimeType,
            base64Audio: arrayBufferToBase64(rec.buffer),
          });
        }
      }
      return { assets, textures, voiceOvers };
    },
    [customAssets, customTextures]
  );

  const restoreBundledAssetsAndTextures = useCallback(
    async (
      assets?: ExportedAssetBundle[],
      textures?: ExportedTextureBundle[],
      voiceOvers?: ExportedVoiceBundle[]
    ) => {
      if (Array.isArray(assets) && assets.length > 0) {
        for (const entry of assets) {
          if (entry?.meta?.id && entry.base64Glb) {
            const buffer = base64ToArrayBuffer(entry.base64Glb);
            await saveAssetRecord(entry.meta, buffer);
          }
        }
        const refreshed = await listAssetMetas();
        setCustomAssets(refreshed);
      }
      if (Array.isArray(textures) && textures.length > 0) {
        for (const entry of textures) {
          if (entry?.meta?.id && entry.base64Image) {
            const buffer = base64ToArrayBuffer(entry.base64Image);
            await saveTextureRecord(entry.meta, buffer, entry.mimeType || 'image/png');
          }
        }
        const refreshedTex = await listTextureMetas();
        setCustomTextures(refreshedTex);
      }
      if (Array.isArray(voiceOvers) && voiceOvers.length > 0) {
        for (const entry of voiceOvers) {
          if (entry?.meta?.id && entry.base64Audio) {
            const buffer = base64ToArrayBuffer(entry.base64Audio);
            await saveVoiceRecord(
              { ...entry.meta, mimeType: entry.mimeType || entry.meta.mimeType || 'audio/webm' },
              buffer
            );
          }
        }
      }
    },
    []
  );

  const saveDesignPreset = useCallback(
    async (opts: {
      name: string;
      notes?: string;
      scope: SavePresetScope;
      includeAssets?: boolean;
      overwriteId?: string;
    }): Promise<SavePresetEntry | null> => {
      if (!currentProject) return null;
      const lvl = currentLevel ?? currentProject.levels[0];
      if (!lvl && opts.scope !== 'fullGame') return null;

      const includeAssets = opts.includeAssets ?? true;
      const usedIds = new Set<string>();
      const usedTexIds = new Set<string>();
      const usedVoiceIds = new Set<string>();

      const collectCanopyAssets = (cfg?: StylizedCanopyConfig) => {
        if (!cfg) return;
        if (cfg.canopyAssetId) usedIds.add(cfg.canopyAssetId);
        if (cfg.trunkAssetId) usedIds.add(cfg.trunkAssetId);
        if (cfg.fruitAssetId) usedIds.add(cfg.fruitAssetId);
        if (cfg.speciesProfiles) {
          for (const prof of Object.values(cfg.speciesProfiles)) {
            if (!prof) continue;
            if (prof.canopyAssetId) usedIds.add(prof.canopyAssetId);
            if (prof.trunkAssetId) usedIds.add(prof.trunkAssetId);
            if (prof.fruitAssetId) usedIds.add(prof.fruitAssetId);
          }
        }
      };

      const collectLevelAssets = (level: GameLevel) => {
        collectCanopyAssets(level.canopyEngine);
        collectVoiceIdsFromConfig(level.heroIntroVoice, usedVoiceIds);
        for (const ent of level.entities) {
          if (ent.customAssetId) usedIds.add(ent.customAssetId);
          collectCanopyAssets(ent.canopyTree);
          collectVoiceIdsFromConfig(ent.voiceConfig, usedVoiceIds);
          if (ent.fxEmitter?.customMeshAssetId) usedIds.add(ent.fxEmitter.customMeshAssetId);
        }
        for (const sc of level.terrain?.scatter ?? []) {
          if (sc.customAssetId) usedIds.add(sc.customAssetId);
        }
        for (const vi of level.vistaItems ?? []) {
          if (vi.customAssetId) usedIds.add(vi.customAssetId);
        }
        for (const tid of collectReferencedTextureIds(
          level.sceneryTextures,
          level.canopyEngine,
          level.entities.map((e) => e.canopyTree)
        )) {
          usedTexIds.add(tid);
        }
      };

      const now = new Date().toISOString();
      const existing = opts.overwriteId
        ? savedPresets.find((p) => p.id === opts.overwriteId)
        : undefined;

      let summary = '';
      let fullGame: GameProject | undefined;
      let worldLevel: SavePresetEntry['worldLevel'];
      let treeStudio: StylizedCanopyConfig | undefined;
      let atmosphere: SavePresetEntry['atmosphere'];

      if (opts.scope === 'fullGame') {
        fullGame = JSON.parse(JSON.stringify(currentProject)) as GameProject;
        if (includeAssets) {
          if (fullGame.heroCustomAssetId) usedIds.add(fullGame.heroCustomAssetId);
          fullGame.levels.forEach(collectLevelAssets);
        }
        const totalEnts = fullGame.levels.reduce((s, l) => s + l.entities.length, 0);
        summary = `${fullGame.levels.length} level${fullGame.levels.length === 1 ? '' : 's'} · ${totalEnts} entities`;
      } else if (opts.scope === 'worldLevel' && lvl) {
        const clonedLevel = JSON.parse(JSON.stringify(lvl)) as GameLevel;
        worldLevel = {
          level: clonedLevel,
          postProcessing: currentProject.postProcessing
            ? JSON.parse(JSON.stringify(currentProject.postProcessing))
            : undefined,
        };
        if (includeAssets) {
          collectLevelAssets(clonedLevel);
        }
        summary = `${clonedLevel.name} · ${clonedLevel.biome} · ${clonedLevel.entities.length} entities`;
      } else if (opts.scope === 'treeStudio' && lvl) {
        const cfg = JSON.parse(
          JSON.stringify(lvl.canopyEngine ?? createDefaultCanopyConfig())
        ) as StylizedCanopyConfig;
        treeStudio = cfg;
        if (includeAssets) {
          collectCanopyAssets(cfg);
          for (const tid of collectReferencedTextureIds(undefined, cfg)) {
            usedTexIds.add(tid);
          }
        }
        const speciesName =
          cfg.treeType === 'custom'
            ? cfg.customTypeName?.trim() || 'Custom'
            : cfg.treeType ?? 'oak';
        summary = `${speciesName} · ${cfg.canopyLeavesEnabled ? `${cfg.canopyLeafShape ?? 'basic'} leaves` : 'base canopy'}`;
      } else if (opts.scope === 'atmosphere' && lvl) {
        atmosphere = {
          sky: lvl.sky,
          timeOfDay: lvl.timeOfDay,
          autoCycleTime: lvl.autoCycleTime,
          cloudDensity: lvl.cloudDensity,
          sunIntensityScale: lvl.sunIntensityScale,
          ambientIntensityScale: lvl.ambientIntensityScale,
          atmosphereWarmth: lvl.atmosphereWarmth,
          starIntensity: lvl.starIntensity,
          sunAngle: lvl.sunAngle,
          fog: lvl.fog,
          weather: lvl.weather,
          wind: lvl.wind,
          visualStyle: lvl.visualStyle,
          vistaPreset: lvl.vistaPreset,
          vistaDensity: lvl.vistaDensity,
          vistaTreeDensity: lvl.vistaTreeDensity,
          vistaMountainScale: lvl.vistaMountainScale,
          vistaDistance: lvl.vistaDistance,
          vistaTreeScale: lvl.vistaTreeScale,
          vistaHeightFog: lvl.vistaHeightFog,
          postProcessing: currentProject.postProcessing
            ? JSON.parse(JSON.stringify(currentProject.postProcessing))
            : undefined,
        };
        const grade = currentProject.postProcessing?.colorGradingPreset ?? 'natural';
        summary = `${lvl.sky} sky · ${lvl.weather} · ${grade === 'natural' ? 'natural grade' : grade}`;
      }

      const packed = includeAssets
        ? await packReferencedAssetsAndTextures(usedIds, usedTexIds, usedVoiceIds)
        : { assets: [], textures: [], voiceOvers: [] };

      const entry: SavePresetEntry = {
        id: existing?.id ?? uid(),
        name: opts.name.trim() || currentProject.name || 'Saved Preset',
        notes: opts.notes?.trim() || undefined,
        scope: opts.scope,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        summary,
        fullGame,
        worldLevel,
        treeStudio,
        atmosphere,
        assets: packed.assets.length > 0 ? packed.assets : undefined,
        textures: packed.textures.length > 0 ? packed.textures : undefined,
        voiceOvers: packed.voiceOvers.length > 0 ? packed.voiceOvers : undefined,
      };

      await savePresetRecord(entry);
      setSavedPresets((prev) => [entry, ...prev.filter((p) => p.id !== entry.id)]);
      return entry;
    },
    [currentLevel, currentProject, packReferencedAssetsAndTextures, savedPresets]
  );

  const loadDesignPreset = useCallback(
    async (
      preset: SavePresetEntry,
      opts?: { loadMode?: 'replaceCurrent' | 'asNewGame' }
    ): Promise<{ ok: boolean; message: string }> => {
      try {
        await restoreBundledAssetsAndTextures(
          preset.assets,
          preset.textures,
          preset.voiceOvers
        );

        if (preset.scope === 'fullGame' && preset.fullGame) {
          const cloned = migrateProject(
            JSON.parse(JSON.stringify(preset.fullGame)) as GameProject
          );
          const loadAsNew =
            opts?.loadMode === 'asNewGame' || !currentProjectID || !currentProject;
          if (loadAsNew) {
            const opened: GameProject = {
              ...cloned,
              id: uid(),
              updatedAt: new Date().toISOString(),
            };
            setProjects((prev) => [opened, ...prev]);
            setCurrentProjectID(opened.id);
            setSelectedLevelID(opened.levels[0]?.id ?? null);
            setSelectedEntityID(opened.levels[0]?.entities[0]?.id ?? null);
            setSelectedWidgetID(opened.hud?.widgets?.[0]?.id ?? null);
            setSelectedTab('world');
            setPast([]);
            setFuture([]);
            return { ok: true, message: `Opened "${preset.name}" as a new game.` };
          }
          const preservedId = currentProjectID;
          updateProject(
            `load preset: ${preset.name}`,
            () => ({
              ...cloned,
              id: preservedId,
              updatedAt: new Date().toISOString(),
            }),
            true
          );
          setSelectedLevelID(cloned.levels[0]?.id ?? null);
          setSelectedEntityID(cloned.levels[0]?.entities[0]?.id ?? null);
          setSelectedWidgetID(cloned.hud?.widgets?.[0]?.id ?? null);
          return { ok: true, message: `Loaded full game design "${preset.name}".` };
        }

        if (!currentProject || !currentLevel) {
          return {
            ok: false,
            message: 'Open a game first to apply this level, tree, or atmosphere preset.',
          };
        }

        if (preset.scope === 'worldLevel' && preset.worldLevel?.level) {
          const clonedLevel = JSON.parse(
            JSON.stringify(preset.worldLevel.level)
          ) as GameLevel;
          const nextPP = preset.worldLevel.postProcessing
            ? JSON.parse(JSON.stringify(preset.worldLevel.postProcessing))
            : undefined;
          const targetLevelId = currentLevel.id;
          updateProject(
            `load level preset: ${preset.name}`,
            (proj) => ({
              ...proj,
              postProcessing: nextPP ?? proj.postProcessing,
              levels: proj.levels.map((l) =>
                l.id === targetLevelId
                  ? {
                      ...clonedLevel,
                      id: targetLevelId,
                      terrain: clonedLevel.terrain
                        ? {
                            ...ensureUpgradedTerrain(clonedLevel.terrain),
                            revision: (l.terrain?.revision ?? 0) + 1,
                          }
                        : l.terrain,
                    }
                  : l
              ),
            }),
            true
          );
          setSelectedEntityID(clonedLevel.entities[0]?.id ?? null);
          return { ok: true, message: `Loaded level design "${preset.name}".` };
        }

        if (preset.scope === 'treeStudio' && preset.treeStudio) {
          const clonedTree = JSON.parse(
            JSON.stringify(preset.treeStudio)
          ) as StylizedCanopyConfig;
          updateLevel(
            `load tree preset: ${preset.name}`,
            (lvl) => ({
              ...lvl,
              canopyEngine: {
                ...clonedTree,
                enabled: true,
              },
              terrain: lvl.terrain
                ? { ...lvl.terrain, revision: lvl.terrain.revision + 1 }
                : lvl.terrain,
            }),
            true
          );
          return { ok: true, message: `Applied Tree Studio preset "${preset.name}".` };
        }

        if (preset.scope === 'atmosphere' && preset.atmosphere) {
          const atmo = preset.atmosphere;
          const targetLevelId = currentLevel.id;
          updateProject(
            `load atmosphere preset: ${preset.name}`,
            (proj) => ({
              ...proj,
              postProcessing: atmo.postProcessing
                ? JSON.parse(JSON.stringify(atmo.postProcessing))
                : proj.postProcessing,
              levels: proj.levels.map((l) =>
                l.id === targetLevelId
                  ? {
                      ...l,
                      sky: atmo.sky,
                      timeOfDay: atmo.timeOfDay,
                      autoCycleTime: atmo.autoCycleTime,
                      cloudDensity: atmo.cloudDensity,
                      sunIntensityScale: atmo.sunIntensityScale,
                      ambientIntensityScale: atmo.ambientIntensityScale,
                      atmosphereWarmth: atmo.atmosphereWarmth,
                      starIntensity: atmo.starIntensity,
                      sunAngle: atmo.sunAngle,
                      fog: atmo.fog,
                      weather: atmo.weather,
                      wind: atmo.wind,
                      visualStyle: atmo.visualStyle ?? l.visualStyle,
                      vistaPreset: atmo.vistaPreset ?? l.vistaPreset,
                      vistaDensity: atmo.vistaDensity ?? l.vistaDensity,
                      vistaTreeDensity: atmo.vistaTreeDensity ?? l.vistaTreeDensity,
                      vistaMountainScale: atmo.vistaMountainScale ?? l.vistaMountainScale,
                      vistaDistance: atmo.vistaDistance ?? l.vistaDistance,
                      vistaTreeScale: atmo.vistaTreeScale ?? l.vistaTreeScale,
                      vistaHeightFog: atmo.vistaHeightFog ?? l.vistaHeightFog,
                    }
                  : l
              ),
            }),
            true
          );
          return { ok: true, message: `Applied atmosphere & post-FX "${preset.name}".` };
        }

        return { ok: false, message: 'Preset payload was empty.' };
      } catch {
        return { ok: false, message: 'Could not load that preset.' };
      }
    },
    [
      currentLevel,
      currentProject,
      currentProjectID,
      restoreBundledAssetsAndTextures,
      updateLevel,
      updateProject,
    ]
  );

  const deleteDesignPreset = useCallback(async (id: string) => {
    await deletePresetRecord(id);
    setSavedPresets((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const renameDesignPreset = useCallback(
    async (id: string, name: string, notes?: string) => {
      const target = savedPresets.find((p) => p.id === id);
      if (!target) return;
      const updated: SavePresetEntry = {
        ...target,
        name: name.trim() || target.name,
        notes: notes?.trim() || undefined,
        updatedAt: new Date().toISOString(),
      };
      await savePresetRecord(updated);
      setSavedPresets((prev) => [updated, ...prev.filter((p) => p.id !== id)]);
    },
    [savedPresets]
  );

  const exportSavePresetsFile = useCallback(
    (presetIds?: string[], filename = 'savepresets.json') => {
      const list =
        presetIds && presetIds.length > 0
          ? savedPresets.filter((p) => presetIds.includes(p.id))
          : savedPresets;
      downloadSavePresetsFile(list, filename);
      return list.length;
    },
    [savedPresets]
  );

  const importSavePresetsFile = useCallback(
    async (
      rawText: string,
      mode: 'merge' | 'replace' = 'merge'
    ): Promise<{ ok: boolean; count?: number; presets?: SavePresetEntry[]; error?: string }> => {
      const res = parseSavePresetsFile(rawText);
      if (!res.ok) return { ok: false, error: res.error };

      if (mode === 'replace') {
        await replaceAllPresetRecords(res.presets);
        setSavedPresets(res.presets);
        return { ok: true, count: res.presets.length, presets: res.presets };
      }

      const byId = new Map<string, SavePresetEntry>();
      for (const existing of savedPresets) {
        byId.set(existing.id, existing);
      }
      for (const incoming of res.presets) {
        byId.set(incoming.id, incoming);
        await savePresetRecord(incoming);
      }
      const merged = Array.from(byId.values()).sort((a, b) =>
        (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt)
      );
      setSavedPresets(merged);
      return { ok: true, count: res.presets.length, presets: res.presets };
    },
    [savedPresets]
  );

  const issues: MakerIssue[] = useMemo(() => {
    if (!currentProject) return [];
    const list: MakerIssue[] = [];
    if (!currentProject.enabledActions.includes('walk') || !currentProject.enabledActions.includes('jump')) {
      list.push({
        id: 'moves',
        title: 'Hero needs Walk & Jump',
        detail: 'Turn on Walk and Jump in Motion → Hero Actions so the player can get around.',
        symbol: 'figure.run',
        tab: 'motion',
        motionSection: 'actions',
        isBlocking: true,
      });
    }
    const noPortal = currentProject.levels.find((l) => !l.hasPortal);
    if (noPortal) {
      list.push({
        id: 'portal',
        title: `${noPortal.name} has no portal`,
        detail: 'Turn on the end portal in World so players can finish the level.',
        symbol: 'sparkles',
        tab: 'world',
        isBlocking: true,
      });
    }
    if (currentLevel && currentLevel.entities.length === 0) {
      list.push({
        id: 'empty',
        title: `${currentLevel.name} is empty`,
        detail: 'Add a friend, treasure chest, or baddie in Cast or World.',
        symbol: 'person.2.fill',
        tab: 'cast',
        isBlocking: false,
      });
    }
    const quiet = currentLevel?.entities.find(
      (e) => (e.kind === 'baddie' || e.kind === 'npc' || e.kind === 'treasure') && e.cards.length === 0
    );
    if (quiet) {
      list.push({
        id: 'rule',
        title: `${quiet.name} has no rules yet`,
        detail: 'Give it a When → If → Then rule in the Logic tab.',
        symbol: 'arrow.triangle.branch',
        tab: 'logic',
        isBlocking: false,
      });
    }
    if (!currentProject.coverTagline.trim()) {
      list.push({
        id: 'tagline',
        title: 'Add a cover tagline',
        detail: 'Give your game a one-line hook in Publish.',
        symbol: 'paperplane.fill',
        tab: 'world',
        openPublish: true,
        isBlocking: false,
      });
    }
    return list;
  }, [currentLevel, currentProject]);

  const suggestions: IdeaSuggestion[] = useMemo(() => {
    if (!currentProject || !currentLevel) return [];
    const list: IdeaSuggestion[] = [];

    const hasBaddie = currentLevel.entities.some((e) => e.kind === 'baddie');
    if (!hasBaddie) {
      list.push({
        id: 'add-baddie',
        title: 'Add a grumpy guard',
        detail: 'Every adventure feels more exciting with someone to dodge or battle.',
        symbol: 'bolt.fill',
        tint: Palette.coral,
        actionTitle: 'Drop a baddie',
        perform: () => {
          addEntity('baddie', 'Grumpy Slime', { x: 0.54, y: 0.44 });
          setSelectedTab('cast');
        },
      });
    }

    const hasTreasure = currentLevel.entities.some((e) => e.kind === 'treasure');
    if (!hasTreasure) {
      list.push({
        id: 'add-treasure',
        title: 'Hide a treasure chest',
        detail: 'Reward curious explorers who wander off the main path.',
        symbol: 'gift.fill',
        tint: Palette.gold,
        actionTitle: 'Add a chest',
        perform: () => {
          addEntity('treasure', 'Secret Chest', { x: 0.72, y: 0.65 });
          setSelectedTab('world');
        },
      });
    }

    const quietEntity = currentLevel.entities.find(
      (e) => (e.kind === 'baddie' || e.kind === 'npc' || e.kind === 'treasure') && e.cards.length === 0
    );
    if (quietEntity) {
      list.push({
        id: 'add-rule',
        title: `Give ${quietEntity.name} a rule`,
        detail: 'Right now it just stands there. One tap makes it react to the hero.',
        symbol: 'arrow.triangle.branch',
        tint: Palette.plum,
        actionTitle: 'Open Logic',
        perform: () => {
          setSelectedEntityID(quietEntity.id);
          setSelectedTab('logic');
        },
      });
    }

    if (currentLevel.audio.mood === 'none') {
      list.push({
        id: 'add-music',
        title: 'Pick a music mood',
        detail: 'Music sets the tone as soon as the player steps onto the island.',
        symbol: 'speaker.wave.2.fill',
        tint: Palette.sky,
        actionTitle: 'Set Adventure music',
        perform: () => {
          updateLevel('set adventure music', (lvl) => ({
            ...lvl,
            audio: { ...lvl.audio, mood: 'adventure' },
          }));
        },
      });
    }

    if (currentProject.levels.length < 2) {
      list.push({
        id: 'add-level',
        title: 'Build Level 2',
        detail: 'Connect a second island so the portal takes the player somewhere new.',
        symbol: 'map.fill',
        tint: Palette.mint,
        actionTitle: 'Add Level 2',
        perform: () => addLevel(),
      });
    }

    return list;
  }, [addEntity, addLevel, currentLevel, currentProject, updateLevel]);

  const updateLevelSceneryTexture = useCallback(
    (slot: SceneryTextureSlot, settings: SurfaceTextureSettings | undefined, recordUndo = false) => {
      updateLevel(
        `update ${slot} texture`,
        (lvl) => {
          const next = { ...(lvl.sceneryTextures ?? {}) };
          if (!settings) {
            delete next[slot];
          } else {
            next[slot] = settings;
          }
          return { ...lvl, sceneryTextures: next };
        },
        recordUndo
      );
    },
    [updateLevel]
  );

  return {
    projects,
    theme,
    setTheme,
    toggleTheme,
    customAssets,
    customTextures,
    savedPresets,
    viewportResolutionScale,
    setViewportResolutionScale,
    viewportShadowQuality,
    setViewportShadowQuality,
    terrainQuality,
    setTerrainQuality,
    showingAssetVault,
    setShowingAssetVault,
    showingPresets,
    setShowingPresets,
    showingPublish,
    setShowingPublish,
    showingLogicFlow,
    setShowingLogicFlow: (open: boolean) => {
      if (open) {
        setLogicMode('flow');
        setSelectedTab('logic');
      }
      setShowingLogicFlow(false);
    },
    showingDirector,
    setShowingDirector,
    rehearseSkitId,
    setRehearseSkitId,
    showingTerrainEditor,
    setShowingTerrainEditor,
    worldTool,
    setWorldTool,
    worldGridSnap,
    setWorldGridSnap,
    worldViewMode,
    setWorldViewMode,
    worldEditorScope,
    setWorldEditorScope,
    selectedWorldLandCode,
    setSelectedWorldLandCode,
    worldMapBrushMode,
    setWorldMapBrushMode,
    worldMapBrushRadius,
    setWorldMapBrushRadius,
    worldMapAutoLand,
    setWorldMapAutoLand,
    resolvedWorldMap,
    activeWorldRegionCode,
    activeWorldRegionOrigin,
    ensureProjectWorldMap,
    addWorldLandRegion,
    updateWorldLandRegion,
    deleteWorldLandRegion,
    enterWorldEditorScope,
    applyWorldMapBrushStroke,
    startWorldFromScratch,
    activeWorldDomain,
    setActiveWorldDomain,
    cameraAngleLocked,
    setCameraAngleLocked,
    cameraFocusRequest,
    focusCameraOnWorldPoint,
    selectedWaterBodyId,
    setSelectedWaterBodyId,
    selectedCaveId,
    setSelectedCaveId,
    selectedRoadId,
    setSelectedRoadId,
    showingAtmosphereDrawer,
    setShowingAtmosphereDrawer,
    showingSkybox,
    setShowingSkybox,
    showingPostFx,
    setShowingPostFx,
    showingFxLibrary,
    setShowingFxLibrary,
    showingTextureStudio,
    setShowingTextureStudio,
    vertexPaintTarget,
    setVertexPaintTarget,
    attributeModifierTarget,
    setAttributeModifierTarget,
    updateWaterBody,
    addWaterBody,
    deleteWaterBody,
    updateCaveGrotto,
    updateRoadSpline,
    apply2DOverviewStroke,
    placeWorldPointBoardHelper,
    terrainBrush,
    setTerrainBrush,
    terrainBrushRadius,
    setTerrainBrushRadius,
    terrainBrushStrength,
    setTerrainBrushStrength,
    terrainBrushFalloff,
    setTerrainBrushFalloff,
    terrainFlattenHeight,
    setTerrainFlattenHeight,
    terrainScatterAssetId,
    setTerrainScatterAssetId,
    saveDesignPreset,
    loadDesignPreset,
    deleteDesignPreset,
    renameDesignPreset,
    exportSavePresetsFile,
    importSavePresetsFile,
    uploadCustomGlb,
    updateCustomAssetMeta,
    saveGeneratedAsset,
    removeCustomAsset,
    uploadCustomTexture,
    resizeCustomTexture,
    removeCustomTexture,
    updateLevelSceneryTexture,
    currentProject,
    currentLevel,
    levelIndex,
    currentEntity,
    currentWidget,
    selectedLevelID,
    setSelectedLevelID,
    selectedEntityID,
    setSelectedEntityID,
    selectedWidgetID,
    setSelectedWidgetID,
    selectedSection,
    setSelectedSection,
    selectedTab,
    setSelectedTab,
    motionSection,
    setMotionSection,
    logicMode,
    setLogicMode,
    motionAssetId,
    setMotionAssetId,
    motionActorTarget,
    setMotionActorTarget,
    motionRequestedSlot,
    setMotionRequestedSlot,
    openMotionStudio: (assetId?: string) => {
      if (assetId) {
        setMotionAssetId(assetId);
        const found = customAssets.find((a) => a.id === assetId);
        setMotionActorTarget({
          kind: 'customAsset',
          category: 'hero',
          assetId,
          label: found?.name ?? 'Custom Character',
        });
      }
      setShowingAssetVault(false);
      setMotionSection('gait');
      setSelectedTab('motion');
    },
    openMotionStudioForTarget: (target: MotionActorTarget, initialSlot?: CustomClipSlot) => {
      if (target.kind === 'customAsset') {
        setMotionAssetId(target.assetId);
      }
      setMotionActorTarget(target);
      setMotionRequestedSlot(initialSlot ?? null);
      setShowingAssetVault(false);
      setMotionSection('pose');
      setSelectedTab('motion');
    },
    saveUniversalMotionPreset,
    deleteUniversalMotionPreset,
    assignMotionPresetToScope,
    restoreDefaultMotionSlot,
    saveUniversalPosePreset,
    deleteUniversalPosePreset,
    openHeroActions: () => {
      setMotionSection('actions');
      setSelectedTab('motion');
    },
    objectMakerOpen,
    setObjectMakerOpen: (open: boolean) => {
      setObjectMakerOpen(open);
      if (!open) {
        setObjectMakerInventoryItemId(null);
      }
    },
    objectMakerTargetAssetId,
    setObjectMakerTargetAssetId,
    objectMakerInventoryItemId,
    setObjectMakerInventoryItemId,
    openObjectMaker: (assetId?: string) => {
      setObjectMakerTargetAssetId(assetId ?? null);
      setObjectMakerInventoryItemId(null);
      setShowingAssetVault(false);
      setPlantMakerOpen(false);
      setCharacterMakerOpen(false);
      setTreeMakerOpen(false);
      setSelectedTab('world');
      setObjectMakerOpen(true);
    },
    openObjectMakerForInventoryItem: (itemId: string) => {
      const invItem = getProjectInventoryItems(currentProject).find((i) => i.id === itemId);
      setObjectMakerInventoryItemId(itemId);
      setObjectMakerTargetAssetId(invItem?.customAssetId ?? null);
      setShowingAssetVault(false);
      setPlantMakerOpen(false);
      setCharacterMakerOpen(false);
      setTreeMakerOpen(false);
      setObjectMakerOpen(true);
    },
    plantMakerOpen,
    setPlantMakerOpen,
    plantMakerTargetAssetId,
    setPlantMakerTargetAssetId,
    openPlantMaker: (assetId?: string) => {
      setPlantMakerTargetAssetId(assetId ?? null);
      setShowingAssetVault(false);
      setObjectMakerOpen(false);
      setCharacterMakerOpen(false);
      setTreeMakerOpen(false);
      setSelectedTab('world');
      setPlantMakerOpen(true);
    },
    characterMakerOpen,
    setCharacterMakerOpen,
    characterMakerTargetAssetId,
    setCharacterMakerTargetAssetId,
    openCharacterMaker: (assetId?: string) => {
      setCharacterMakerTargetAssetId(assetId ?? null);
      setShowingAssetVault(false);
      setObjectMakerOpen(false);
      setPlantMakerOpen(false);
      setTreeMakerOpen(false);
      setCharacterMakerOpen(true);
    },
    treeMakerOpen,
    setTreeMakerOpen,
    treeMakerTargetAssetId,
    setTreeMakerTargetAssetId,
    treeMakerInitialSpecies,
    setTreeMakerInitialSpecies,
    openTreeMaker: (assetId?: string, initialSpecies?: TreeSpeciesType) => {
      setTreeMakerTargetAssetId(assetId ?? null);
      setTreeMakerInitialSpecies(initialSpecies ?? null);
      setShowingAssetVault(false);
      setObjectMakerOpen(false);
      setPlantMakerOpen(false);
      setCharacterMakerOpen(false);
      setMonsterMakerOpen(false);
      setSelectedTab('world');
      setTreeMakerOpen(true);
    },
    monsterMakerOpen,
    setMonsterMakerOpen,
    monsterMakerTargetEntityId,
    monsterMakerInitialBlueprint,
    openMonsterMaker: (opts?: { entityId?: string | null; blueprint?: MonsterBlueprint | null }) => {
      setMonsterMakerTargetEntityId(opts?.entityId ?? null);
      setMonsterMakerInitialBlueprint(opts?.blueprint ?? null);
      setShowingAssetVault(false);
      setObjectMakerOpen(false);
      setPlantMakerOpen(false);
      setCharacterMakerOpen(false);
      setTreeMakerOpen(false);
      setMonsterMakerOpen(true);
    },
    saveCustomMonster,
    spawnMonsterEntity,
    toggleFavoriteCustomAsset,
    duplicateCustomAsset,
    isPlaying,
    setIsPlaying,
    playModalOpen,
    setPlayModalOpen,
    playFromPoint,
    setPlayFromPoint,
    playerTelemetry,
    setPlayerTelemetry,
    showingNewGame,
    setShowingNewGame,
    showingIdeas,
    setShowingIdeas,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    undoLabel: past[past.length - 1]?.label ?? '',
    undo,
    redo,
    openProject,
    closeProject,
    createProject,
    duplicateProject,
    deleteProject,
    updateProject,
    updateLevel,
    addLevel,
    deleteCurrentLevel,
    applyBrush,
    commitCaveStroke,
    resetTerrain,
    addEntity,
    addEntitiesBatch,
    addBuildingBlockEntity,
    addFxTemplateAtPoint,
    addCanopyTreeEntity,
    scatterCanopyGrove,
    applyDefaultTreeStylesToLevels,
    addMechanicalEntityToLevel,
    updateEntity,
    moveEntity,
    rotateHeroStart,
    deleteEntity,
    addEmptyCard,
    applyRecipe,
    toggleAction,
    enableAllActions,
    resetActions,
    addWidget,
    resetHUDToDefault,
    updateWidget,
    deleteWidget,
    addInventoryItem,
    updateInventoryItem,
    updateInventoryItemMetadata,
    deleteInventoryItem,
    selectedInventoryItemId,
    setSelectedInventoryItemId,
    runtimeDurability,
    wearItemDurability,
    repairItemDurability,
    resetRuntimeDurability,
    selectedInventoryMetadata: (() => {
      const items = currentProject?.inventoryItems?.length
        ? currentProject.inventoryItems
        : DefaultInventoryItems;
      const target = items.find((i) => i.id === selectedInventoryItemId) ?? null;
      if (!target) return null;
      const dur = runtimeDurability[target.id];
      return resolveItemMetadata(
        target,
        dur
          ? { itemId: target.id, qty: 1, durability: dur.durability, maxDurability: dur.maxDurability }
          : null
      );
    })(),
    addCraftingRecipe,
    deleteCraftingRecipe,
    updateInventoryConfig,
    exportProjectJSON,
    importProjectJSON,
    exportCompressedMakerFile,
    exportProjectZip,
    importProjectFile,
    saveProjectStateNow: flushProjectsToStorage,
    issues,
    suggestions,
  };
}

export type MakerStore = ReturnType<typeof useMakerStore>;
