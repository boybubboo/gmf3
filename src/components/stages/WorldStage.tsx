import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Check,
  ChevronDown,
  ChevronRight,
  Compass,
  Crosshair,
  Eraser,
  Eye,
  Gamepad2,
  Globe,
  HelpCircle,
  Lock,
  Map as MapIcon,
  MapPin,
  Mountain,
  Move,
  PanelLeftOpen,
  Plus,
  RotateCcw,
  RotateCw,
  Route,
  Scaling,
  Search,
  SlidersHorizontal,
  Spline,
  Trash2,
  Unlock,
} from 'lucide-react';
import {
  BUILTIN_FX_EFFECT_LIBRARY,
  createCustomFxTemplate,
  loadCustomFxTemplates,
  saveCustomFxTemplates,
  type FxLibraryTemplate,
} from '../../data/fxEffectLibrary';
import { createDefaultFxEmitterConfig } from '../../data/fxEmitterPresets';
import {
  CameraModes,
  CompleteConditions,
  EntityKindMeta,
  EnvironmentTypes,
  MusicMoodOptions,
  StorybookThemeCatalog,
  VistaPropKinds,
  createEntity,
  defaultStorybookConfig,
} from '../../data/registries';
import { DEFAULT_ROGUELIKE_CONFIG } from '../../data/roguelikeEngine';
import {
  DUNGEON_FLOOR_STYLE_META,
  DUNGEON_PROP_STYLE_META,
  DUNGEON_THEME_PRESETS,
  DUNGEON_TRAP_STYLE_META,
  DUNGEON_WALL_STYLE_META,
  DungeonGenerator,
  applyDungeonStyleToLevel,
  resolveDungeonStyle,
} from '../../services/DungeonGenerator';
import type { MakerStore } from '../../store/useMakerStore';
import {
  setContextualAiPanelOpen,
  useContextualAiPanelState,
} from '../../ai/studioBridge';
import { ContextualAiPanel } from '../shared/ContextualAiModal';
import type {
  BuildingBlockConfig,
  BuildingMaterialId,
  BuildingShapeId,
  CameraMode,
  CarPresetId,
  CurveGuideConfig,
  CurveGuidePresetId,
  DoorConfig,
  DriverTypeId,
  DrivingCameraView,
  DrivingPhysicsId,
  DungeonFloorStyle,
  DungeonPropStyle,
  DungeonTrapStyle,
  DungeonWallStyle,
  EntityKind,
  EnvironmentType,
  GameplayMode,
  LevelEntity,
  PlatformerModuleId,
  PropPresetId,
  RpgLootMode,
  RpgPathStyle,
  RpgScenarioId,
  SideScrollerLayoutStyle,
  SideScrollerThemeId,
  StorybookThemeId,
  TerrainBrush,
  VehicleCustomSpec,
  VehicleRoofStyle,
  VehicleWheelStyle,
  VehicleWingStyle,
  ViewportTool,
  VistaPropItem,
  VistaPropKind,
  WorldDomainId,
} from '../../types/maker';
import { HERO_START_ENTITY_ID } from '../../types/maker';
import {
  CAR_PRESETS,
  DRIVING_CAMERA_VIEWS,
  DRIVING_PHYSICS_PRESETS,
  DRIVER_TYPES,
} from '../../three/vehicleModels';
import {
  BUILDING_MATERIALS,
  BUILDING_SHAPES,
  DEFAULT_DOOR_CONFIG,
  getBuildingShapeBaseSize,
} from '../../three/buildingBlocks';
import {
  getActiveFlowerVariantKeys,
  getActivePlantVariantKeys,
  resolveFloraScatterSettings,
} from '../../three/rockBuilder';
import {
  computeCurveLength,
  createCurvePresetPoints,
  createDefaultCurveGuide,
  sampleCurveTransforms,
} from '../../three/curveGuide';
import {
  createDefaultWaterBodies,
  createInitialTerrain,
  createSideScrollerPresetConfig,
  getEnvironmentType,
  getSideScrollerConfig,
  getSideScrollerThemeLayers,
  levelBoardToWorld,
  levelWorldToBoard,
  sampleTerrainHeight,
  uid,
} from '../../utils/terrain';
import { WORLD_TERRAIN_YELLOW } from '../../utils/worldMap';
import {
  type AtmosphereSectionId,
  publishGuidanceHint,
  useHintsEnabled,
} from '../../utils/editorPrefs';
import { AssetThumbnail } from '../shared/AssetThumbnail';
import { ChatBubbleStudioModal } from '../shared/ChatBubbleStudioModal';
import { DialogueVoiceEditor } from '../shared/DialogueVoiceEditor';
import { FieldLabel } from '../shared/MakerUI';
import { FxLibraryPanel } from '../world/FxLibraryPanel';
import { LevelMapModal } from '../world/LevelMapModal';
import { Overview2DPainter, type Painter2DTool } from '../world/Overview2DPainter';
import { PlatformerKitPanel } from '../world/PlatformerKitPanel';
import { PLATFORMER_MODULE_MAP, createPlatformerModuleEntity } from '../../data/platformerCatalog';
import {
  type ActiveBlockToolAdjustments,
  WorldDomainInspector,
} from '../world/WorldDomainInspector';
import { WorldGuidanceBanner } from '../world/WorldGuidanceBanner';
import {
  WorldLeftCreationPanel,
  type LeftCreationTab,
  type LeftPropsSubTab,
} from '../world/WorldLeftCreationPanel';
import { WorldViewport3D } from '../world/WorldViewport3D';

const DropKinds: EntityKind[] = [
  'pickup',
  'baddie',
  'npc',
  'treasure',
  'key',
  'door',
  'trap',
  'puzzle',
  'platform',
  'prop',
  'scenery',
  'light',
  'fxEmitter',
  'checkpoint',
];

export const WorldStage: React.FC<{ store: MakerStore }> = ({ store }) => {
  const { currentProject, currentLevel, currentEntity } = store;
  const tool = store.worldTool;
  const setTool = store.setWorldTool;
  const brush = store.terrainBrush;
  const setBrush = store.setTerrainBrush;
  const isWorldMapDockActive =
    (currentLevel ? getEnvironmentType(currentLevel) : 'openWorld') === 'openWorld' &&
    store.worldEditorScope === 'worldMap';
  const brushRadius = isWorldMapDockActive
    ? store.worldMapBrushRadius
    : store.terrainBrushRadius;
  const setBrushRadius = isWorldMapDockActive
    ? store.setWorldMapBrushRadius
    : store.setTerrainBrushRadius;
  const scatterAssetId = store.terrainScatterAssetId;
  const setScatterAssetId = store.setTerrainScatterAssetId;

  const [dropKind, setDropKind] = useState<EntityKind>('treasure');
  const [dropCustomAssetId, setDropCustomAssetId] = useState<string>('');
  const [addPaletteMode, setAddPaletteMode] = useState<'blocks' | 'entities'>('blocks');
  const [activeBuildShape, setActiveBuildShape] = useState<BuildingShapeId | 'door' | 'rusticDoor'>(
    'wallCube'
  );
  const [activeBuildMaterial, setActiveBuildMaterial] = useState<BuildingMaterialId>('hewnStone');
  const [keepToolAdjustments, setKeepToolAdjustments] = useState(false);
  const [activeBlockAdjustments, setActiveBlockAdjustments] = useState<ActiveBlockToolAdjustments>({
    rotation: 0,
    scale: 1,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
    edgeWear: 0,
  });

  const [showingMap, setShowingMap] = useState(false);
  const [landMenuOpen, setLandMenuOpen] = useState(false);
  const [scratchMenuOpen, setScratchMenuOpen] = useState(false);
  const [quickLandName, setQuickLandName] = useState('');
  const [newObjective, setNewObjective] = useState('');
  const [contentsSearch, setContentsSearch] = useState('');
  const [showLevelSettings, setShowLevelSettings] = useState(false);
  const [fxBurstSignal, setFxBurstSignal] = useState<{ entityId: string; nonce: number } | null>(
    null
  );
  const [cameraPresetRequest, setCameraPresetRequest] = useState<{
    preset: 'iso' | 'top' | 'north' | 'east';
    nonce: number;
  } | null>(null);

  const [hintsEnabled, setHintsEnabled] = useHintsEnabled();
  const [worldMapSelectMode, setWorldMapSelectMode] = useState(false);
  const [leftPanelVisible, setLeftPanelVisible] = useState<boolean>(() => {
    try {
      return localStorage.getItem('maker.world.showLeftPanel.v1') !== 'false';
    } catch {
      return true;
    }
  });
  const [leftActiveTab, setLeftActiveTab] = useState<LeftCreationTab>('build');
  const [leftPropsSubTab, setLeftPropsSubTab] = useState<LeftPropsSubTab>('assets');
  const [atmosphereSection, setAtmosphereSection] = useState<AtmosphereSectionId>('skyTime');
  const setLeftPanelOpen = (visible: boolean) => {
    setLeftPanelVisible(visible);
    try {
      localStorage.setItem('maker.world.showLeftPanel.v1', String(visible));
    } catch {
      // ignore storage failures
    }
  };
  const aiPanelState = useContextualAiPanelState();
  const showLeftPanel = aiPanelState.isOpen || leftPanelVisible;

  const wmForHints = store.resolvedWorldMap;
  const hasWorldTerrain = useMemo(() => {
    const mask = wmForHints?.landMask;
    if (!mask || mask.length === 0) return false;
    for (let i = 0; i < mask.length; i += 4) {
      if (mask[i] === 1) return true;
    }
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] === 1) return true;
    }
    return false;
  }, [wmForHints?.revision, wmForHints?.landMask]);

  const syncedLandTool: Painter2DTool = useMemo(() => {
    if (store.activeWorldDomain === 'mountains') {
      return brush === 'paintRock' || brush === 'weatherCracks' || brush === 'weatherErode'
        ? 'rocks'
        : 'hills';
    }
    if (store.activeWorldDomain === 'water') {
      return brush === 'carveRiver' ? 'rivers' : 'lakes';
    }
    if (store.activeWorldDomain === 'caves') return 'caves';
    if (store.activeWorldDomain === 'grass') return 'terrain';
    if (store.activeWorldDomain === 'dirtRoads') return 'roads';
    if (store.activeWorldDomain === 'flora') {
      if (brush === 'scatterRock') return 'rocks';
      if (brush === 'scatterFlower') return 'wildflowers';
      if (brush === 'scatterPlant') return 'plants';
      return 'deciduousWoods';
    }
    if (store.activeWorldDomain === 'select') return 'inspect';
    return 'terrain';
  }, [store.activeWorldDomain, brush]);

  const [activePlacementAssetId, setActivePlacementAssetId] = useState<string | null>(null);
  const [dropPreset, setDropPreset] = useState<'savePlinth' | 'heroStart' | null>(null);
  const [curveGuideEnabled, setCurveGuideEnabled] = useState(false);
  const [curveSpan, setCurveSpan] = useState(10);
  const [curveBend, setCurveBend] = useState(3.2);
  const [curveBlockCount, setCurveBlockCount] = useState(7);
  const [curvePickMode, setCurvePickMode] = useState(false);
  const [buildingCurve, setBuildingCurve] = useState<CurveGuideConfig>(() => ({
    ...createDefaultCurveGuide('arc'),
    points: createCurvePresetPoints('arc', { span: 10, bend: 3.2, baseY: 0.2 }),
  }));
  const [chatBubbleTargetId, setChatBubbleTargetId] = useState<string | null>(null);
  const [customFxTemplates, setCustomFxTemplates] = useState<FxLibraryTemplate[]>(
    loadCustomFxTemplates
  );
  const [draggingFxTemplate, setDraggingFxTemplate] = useState<FxLibraryTemplate | null>(null);
  const [placeFxTemplateId, setPlaceFxTemplateId] = useState<string | null>(null);
  const [placePlatformerModuleId, setPlacePlatformerModuleId] = useState<PlatformerModuleId | null>(null);

  const allFxTemplates = useMemo(
    () => [...BUILTIN_FX_EFFECT_LIBRARY, ...customFxTemplates],
    [customFxTemplates]
  );

  const activePlaceFxTemplate = useMemo(
    () => allFxTemplates.find((t) => t.id === placeFxTemplateId) ?? null,
    [allFxTemplates, placeFxTemplateId]
  );

  const activeScatterAssetId = useMemo(
    () => scatterAssetId || store.customAssets[0]?.id || '',
    [scatterAssetId, store.customAssets]
  );

  // Hotkey 'L' toggles camera angle lock (ignored when typing in inputs/textareas/selects)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'l' || e.key === 'L') {
        store.setCameraAngleLocked(!store.cameraAngleLocked);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [store]);

  const prevSelectedEntityIdRef = useRef<string | null>(store.selectedEntityID);
  useEffect(() => {
    if (store.selectedEntityID === prevSelectedEntityIdRef.current) return;
    prevSelectedEntityIdRef.current = store.selectedEntityID;
    if (!keepToolAdjustments || !currentEntity) return;
    if (currentEntity.buildingBlock || currentEntity.kind === 'door') {
      captureEntityIntoActiveTool(currentEntity);
    }
  }, [store.selectedEntityID, keepToolAdjustments, currentEntity]);

  useEffect(() => {
    publishGuidanceHint(null);
  }, [currentLevel?.id, store.worldEditorScope]);

  const placementGhostSize: [number, number, number] = useMemo(() => {
    if (tool === 'add' && addPaletteMode === 'entities' && dropPreset === 'heroStart') {
      return [0.9, 1.8, 0.9];
    }
    const base: [number, number, number] =
      activeBuildShape === 'door' || activeBuildShape === 'rusticDoor'
        ? [2.0, 2.4, 0.7]
        : getBuildingShapeBaseSize(activeBuildShape);
    if (!keepToolAdjustments) return base;
    const sc = activeBlockAdjustments.scale || 1;
    return [
      base[0] * sc * (activeBlockAdjustments.scaleX || 1),
      base[1] * sc * (activeBlockAdjustments.scaleY || 1),
      base[2] * sc * (activeBlockAdjustments.scaleZ || 1),
    ];
  }, [tool, addPaletteMode, dropPreset, activeBuildShape, keepToolAdjustments, activeBlockAdjustments]);

  const placementGhostRotation = keepToolAdjustments ? activeBlockAdjustments.rotation : 0;

  const fallbackTerrain = useMemo(() => createInitialTerrain(), []);
  const defaultWaterBodies = useMemo(() => createDefaultWaterBodies(), []);
  const terrain = currentLevel?.terrain ?? fallbackTerrain;
  const searchQ = contentsSearch.trim().toLowerCase();

  const heroCustomAsset = useMemo(
    () =>
      currentProject?.heroCustomAssetId
        ? store.customAssets.find((a) => a.id === currentProject.heroCustomAssetId) ?? null
        : null,
    [currentProject?.heroCustomAssetId, store.customAssets]
  );

  const actorsInLevel = useMemo(
    () =>
      (currentLevel?.entities ?? []).filter(
        (e) =>
          (e.kind === 'hero' || e.kind === 'npc' || e.kind === 'baddie') &&
          (!searchQ || e.name.toLowerCase().includes(searchQ))
      ),
    [currentLevel?.entities, searchQ]
  );

  const objectsInLevel = useMemo(
    () =>
      (currentLevel?.entities ?? []).filter(
        (e) =>
          e.kind !== 'hero' &&
          e.kind !== 'npc' &&
          e.kind !== 'baddie' &&
          (!searchQ || e.name.toLowerCase().includes(searchQ))
      ),
    [currentLevel?.entities, searchQ]
  );

  const waterBodiesInLevel = useMemo(
    () =>
      (terrain.waterBodies ?? defaultWaterBodies).filter(
        (wb) => !searchQ || wb.name.toLowerCase().includes(searchQ)
      ),
    [terrain.waterBodies, defaultWaterBodies, searchQ]
  );

  const cavesInLevel = useMemo(
    () =>
      (terrain.caves ?? []).filter(
        (c, idx) => !searchQ || (c.name || `Cave ${idx + 1}`).toLowerCase().includes(searchQ)
      ),
    [terrain.caves, searchQ]
  );

  const roadsInLevel = useMemo(
    () =>
      (terrain.roads ?? []).filter(
        (r) => !searchQ || r.name.toLowerCase().includes(searchQ)
      ),
    [terrain.roads, searchQ]
  );

  const extraNonRegionLevels = useMemo(() => {
    const regions = store.resolvedWorldMap?.regions ?? [];
    return (currentProject?.levels ?? []).filter((lvl) => {
      if (regions.some((r) => r.levelId === lvl.id)) return false;
      const lvlEnv = getEnvironmentType(lvl);
      // Keep custom non-openWorld levels visible, and hide empty scratch placeholder until named
      if (
        regions.length === 0 &&
        lvlEnv === 'openWorld' &&
        lvl.entities.length === 0 &&
        (lvl.terrain?.scatter.length ?? 0) === 0
      ) {
        return false;
      }
      return true;
    });
  }, [currentProject?.levels, store.resolvedWorldMap?.regions]);

  if (!currentProject || !currentLevel) return null;

  const envType = getEnvironmentType(currentLevel);
  const cameraMode: CameraMode =
    currentLevel.cameraMode ?? (envType === 'sideScroller' ? 'sideScroll' : 'front');
  const activeTool: ViewportTool = envType !== 'openWorld' && tool === 'terrain' ? 'move' : tool;

  const triggerFxBurst = (entityId: string) =>
    setFxBurstSignal((prev) => ({ entityId, nonce: (prev?.nonce ?? 0) + 1 }));

  const handleDropFxTemplate = (templateId: string, pos: { x: number; y: number }) => {
    const tpl = allFxTemplates.find((t) => t.id === templateId);
    setDraggingFxTemplate(null);
    if (!tpl) return;
    store.addFxTemplateAtPoint(tpl, pos);
    setPlaceFxTemplateId(null);
    setTool('move');
  };

  const handleSaveEntityToFxLibrary = (ent: LevelEntity) => {
    if (ent.kind !== 'fxEmitter') return;
    const cfg = ent.fxEmitter ?? createDefaultFxEmitterConfig('fire');
    const customTpl = createCustomFxTemplate(ent.name, cfg, ent.scale);
    setCustomFxTemplates((prev) => {
      const next = [customTpl, ...prev];
      saveCustomFxTemplates(next);
      return next;
    });
    store.setShowingFxLibrary(true);
  };

  const handleDeleteCustomFxTemplate = (templateId: string) => {
    setCustomFxTemplates((prev) => {
      const next = prev.filter((t) => t.id !== templateId);
      saveCustomFxTemplates(next);
      return next;
    });
    if (placeFxTemplateId === templateId) {
      setPlaceFxTemplateId(null);
    }
  };

  const handleAddObjective = () => {
    const clean = newObjective.trim();
    if (!clean) return;
    store.updateLevel('add goal', (lvl) => ({
      ...lvl,
      objectives: [...lvl.objectives, { id: uid(), text: clean, isOptional: false }],
    }));
    setNewObjective('');
  };

  const resetActiveAdjustments = () => {
    setActiveBlockAdjustments({
      rotation: 0,
      scale: 1,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
      edgeWear: activeBuildMaterial === 'sandstone' ? 0.35 : 0,
    });
  };

  function captureEntityIntoActiveTool(ent: LevelEntity) {
    if (ent.buildingBlock) {
      const bb = ent.buildingBlock;
      setActiveBuildShape(bb.shape);
      setActiveBuildMaterial(bb.material);
      setActiveBlockAdjustments({
        rotation: ent.rotation ?? 0,
        scale: ent.scale ?? 1,
        scaleX: bb.scaleX ?? 1,
        scaleY: bb.scaleY ?? 1,
        scaleZ: bb.scaleZ ?? 1,
        edgeWear: bb.edgeWear ?? (bb.material === 'sandstone' ? 0.35 : 0),
        archStyle: bb.archStyle,
        windowStyle: bb.windowStyle,
        roofStyle: bb.roofStyle,
        roofMedievalTruss: bb.roofMedievalTruss,
        beamOrientation: bb.beamOrientation,
        fenceStyle: bb.fenceStyle,
        materialVariant: ent.materialVariant ? { ...ent.materialVariant } : undefined,
      });
    } else if (ent.kind === 'door') {
      const dc: DoorConfig = { ...DEFAULT_DOOR_CONFIG, ...(ent.doorConfig ?? {}) };
      setActiveBuildShape(dc.leafStyle === 'rusticWood' ? 'rusticDoor' : 'door');
      if (dc.frameMaterial) setActiveBuildMaterial(dc.frameMaterial);
      setActiveBlockAdjustments({
        rotation: ent.rotation ?? 0,
        scale: ent.scale ?? 1,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
        edgeWear: 0,
        doorConfig: dc,
        materialVariant: ent.materialVariant ? { ...ent.materialVariant } : undefined,
      });
    }
  }

  const toggleKeepToolAdjustments = (forced?: boolean) => {
    const next = forced !== undefined ? forced : !keepToolAdjustments;
    setKeepToolAdjustments(next);
    if (next) {
      if (currentEntity && (currentEntity.buildingBlock || currentEntity.kind === 'door')) {
        captureEntityIntoActiveTool(currentEntity);
      }
    } else {
      resetActiveAdjustments();
    }
  };

  const placeCustomAssetAtPoint = (
    assetId: string,
    pos: { x: number; y: number },
    elevationY?: number
  ) => {
    const asset = store.customAssets.find((a) => a.id === assetId);
    if (!asset) return;
    const baseKind: EntityKind =
      asset.category === 'character'
        ? 'npc'
        : asset.category === 'scenery' || asset.category === 'plant' || asset.category === 'tree'
        ? 'scenery'
        : 'prop';
    const created = store.addEntity(baseKind, asset.name, pos, asset.id);
    store.updateEntity(
      created.id,
      `configure ${asset.name}`,
      (ent) => ({
        ...ent,
        ...(elevationY !== undefined ? { elevationY } : {}),
        ...(asset.treeRecipe ? { canopyTree: JSON.parse(JSON.stringify(asset.treeRecipe)) } : {}),
        ...(asset.buildingBlock
          ? { buildingBlock: JSON.parse(JSON.stringify(asset.buildingBlock)) }
          : {}),
        ...(asset.vertexPaintStrokes?.length
          ? { vertexPaintStrokes: JSON.parse(JSON.stringify(asset.vertexPaintStrokes)) }
          : {}),
        ...(asset.mechanisms?.length
          ? {
              mechanisms: asset.mechanisms.map((m) => ({
                ...m,
                pivot: [...m.pivot] as [number, number, number],
              })),
            }
          : {}),
      }),
      false
    );
    setActivePlacementAssetId(null);
    setPlacePlatformerModuleId(null);
    setTool('move');
    store.setActiveWorldDomain('select');
  };

  const placePlatformerModuleAtPoint = (
    moduleId: PlatformerModuleId,
    pos: { x: number; y: number },
    elevationY?: number
  ) => {
    const spec = PLATFORMER_MODULE_MAP[moduleId];
    if (!spec) return;
    const ent = createPlatformerModuleEntity(moduleId, pos, { elevationY });
    store.updateLevel(`add ${spec.label}`, (lvl) => ({
      ...lvl,
      entities: [...lvl.entities, ent],
    }));
    store.setSelectedEntityID(ent.id);
    setPlacePlatformerModuleId(null);
    setTool('move');
    store.setActiveWorldDomain('select');
  };

  const applyBuildingCurvePreset = (
    preset: CurveGuidePresetId,
    nextSpan = curveSpan,
    nextBend = curveBend
  ) => {
    setCurvePickMode(preset === 'free');
    setBuildingCurve((prev) => ({
      ...prev,
      preset,
      closed: preset === 'circle',
      points: createCurvePresetPoints(preset, {
        span: nextSpan,
        bend: nextBend,
        baseY: 0.2,
      }),
    }));
  };

  const handlePickBuildingCurvePoint = ([wx, wz]: [number, number]) => {
    setBuildingCurve((prev) => ({
      ...prev,
      preset: 'free',
      closed: false,
      points: [...prev.points, [Number(wx.toFixed(2)), 0.2, Number(wz.toFixed(2))]],
    }));
  };

  const handleStampBuildingCurveBlocks = () => {
    if (buildingCurve.points.length < 2) return;
    const samples = sampleCurveTransforms(buildingCurve, Math.max(2, curveBlockCount), true);
    const isDoor = activeBuildShape === 'door' || activeBuildShape === 'rusticDoor';
    const resolvedShape: BuildingShapeId =
      activeBuildMaterial === 'sandstone'
        ? activeBuildShape === 'wallCubeHalf'
          ? 'wallCubeHalf'
          : 'wallCube'
        : isDoor
        ? 'wallCube'
        : (activeBuildShape as BuildingShapeId);
    const shapeMeta =
      BUILDING_SHAPES.find((s) => s.id === resolvedShape) ?? BUILDING_SHAPES[0];
    const rotOffset = keepToolAdjustments ? activeBlockAdjustments.rotation : 0;
    const created: LevelEntity[] = samples.map((s) => {
      const bp = levelWorldToBoard(currentLevel, s.position.x, s.position.z);
      const rot = (Math.round(s.yawDeg + rotOffset) + 360) % 360;
      if (isDoor) {
        const isRustic = activeBuildShape === 'rusticDoor';
        const doorCfg: DoorConfig = {
          ...DEFAULT_DOOR_CONFIG,
          ...(isRustic
            ? {
                frameShape: 'rectangular',
                leafStyle: 'rusticWood',
                openMode: 'hingedSide',
                frameMaterial:
                  activeBuildMaterial === 'timberPlank' ||
                  activeBuildMaterial === 'roundLogs' ||
                  activeBuildMaterial === 'weatheredSlats'
                    ? activeBuildMaterial
                    : 'timberPlank',
              }
            : { frameMaterial: activeBuildMaterial }),
          ...(keepToolAdjustments && activeBlockAdjustments.doorConfig
            ? activeBlockAdjustments.doorConfig
            : {}),
        };
        return {
          ...store.addBuildingBlockEntity(activeBuildShape, activeBuildMaterial, bp, {
            rotation: rot,
            scale: keepToolAdjustments ? activeBlockAdjustments.scale : 1,
            doorConfig: doorCfg,
          }),
        };
      }
      const isRoof = resolvedShape === 'roofAFrame' || resolvedShape === 'roofSlope';
      const isBeam =
        resolvedShape === 'beamLarge' ||
        resolvedShape === 'beamSmall' ||
        resolvedShape === 'plankTrim';
      const bbPatch: Partial<BuildingBlockConfig> = keepToolAdjustments
        ? {
            ...(activeBlockAdjustments.scaleX !== 1 ? { scaleX: activeBlockAdjustments.scaleX } : {}),
            ...(activeBlockAdjustments.scaleY !== 1 ? { scaleY: activeBlockAdjustments.scaleY } : {}),
            ...(activeBlockAdjustments.scaleZ !== 1 ? { scaleZ: activeBlockAdjustments.scaleZ } : {}),
            ...(activeBlockAdjustments.edgeWear > 0 || activeBuildMaterial === 'sandstone'
              ? { edgeWear: activeBlockAdjustments.edgeWear }
              : {}),
            ...(resolvedShape === 'archway' && activeBlockAdjustments.archStyle
              ? { archStyle: activeBlockAdjustments.archStyle }
              : {}),
            ...(resolvedShape === 'windowWall' && activeBlockAdjustments.windowStyle
              ? { windowStyle: activeBlockAdjustments.windowStyle }
              : {}),
            ...(isRoof
              ? {
                  ...(activeBlockAdjustments.roofStyle ? { roofStyle: activeBlockAdjustments.roofStyle } : {}),
                  ...(activeBlockAdjustments.roofMedievalTruss !== undefined
                    ? { roofMedievalTruss: activeBlockAdjustments.roofMedievalTruss }
                    : {}),
                }
              : {}),
            ...(resolvedShape === 'roofGable' && activeBlockAdjustments.roofMedievalTruss !== undefined
              ? { roofMedievalTruss: activeBlockAdjustments.roofMedievalTruss }
              : {}),
            ...(resolvedShape === 'fence' && activeBlockAdjustments.fenceStyle
              ? { fenceStyle: activeBlockAdjustments.fenceStyle }
              : {}),
            ...(isBeam && activeBlockAdjustments.beamOrientation
              ? { beamOrientation: activeBlockAdjustments.beamOrientation }
              : {}),
          }
        : {};
      return store.addBuildingBlockEntity(resolvedShape, activeBuildMaterial, bp, {
        rotation: rot,
        scale: keepToolAdjustments ? activeBlockAdjustments.scale : 1,
        buildingBlockPatch: bbPatch,
      });
    });
    if (created.length > 0) {
      store.setSelectedEntityID(created[0].id);
    }
    void shapeMeta;
  };

  const handleAddVistaItem = (kind: VistaPropKind, customAssetId?: string, label?: string) => {
    const defaultName =
      label ??
      (customAssetId
        ? store.customAssets.find((a) => a.id === customAssetId)?.name ?? 'Custom Landmark'
        : VistaPropKinds.find((k) => k.id === kind)?.title ?? 'Landmark');
    store.updateLevel('add vista landmark', (lvl) => {
      const existing = lvl.vistaItems ?? [];
      const nextItem: VistaPropItem = {
        id: uid(),
        kind,
        name: defaultName,
        angle: (existing.length * 53 + 28) % 360,
        distance: envType === 'castle' ? 148 : 238,
        scale: customAssetId ? 1.4 : kind === 'mountain' ? 1.15 : 1.35,
        ...(customAssetId ? { customAssetId } : {}),
      };
      return {
        ...lvl,
        vistaItems: [...existing, nextItem],
      };
    });
  };

  const selectWorldDomain = (domainId: WorldDomainId) => {
    store.setActiveWorldDomain(domainId);
    if (domainId === 'atmosphere') {
      setPlaceFxTemplateId(null);
      setPlacePlatformerModuleId(null);
      if (tool === 'terrain' || tool === 'add') setTool('move');
      if (leftActiveTab !== 'atmosphere') setLeftActiveTab('atmosphere');
      return;
    }
    publishGuidanceHint(null);
    if (domainId === 'select') {
      if (tool === 'terrain') setTool('move');
      setPlaceFxTemplateId(null);
      setPlacePlatformerModuleId(null);
      return;
    }
    if (domainId === 'buildings') {
      setPlaceFxTemplateId(null);
      setActivePlacementAssetId(null);
      setPlacePlatformerModuleId(null);
      setAddPaletteMode('blocks');
      setTool('add');
      store.setSelectedEntityID(null);
      return;
    }
    if (domainId === 'platformerKit') {
      setPlaceFxTemplateId(null);
      setActivePlacementAssetId(null);
      setDropPreset(null);
      setAddPaletteMode('entities');
      setTool('add');
      store.setSelectedEntityID(null);
      setPlacePlatformerModuleId((prev) => prev ?? 'shuttlePlatform');
      return;
    }
    if (domainId === 'particleFx') {
      setActivePlacementAssetId(null);
      setDropPreset(null);
      setPlacePlatformerModuleId(null);
      store.setSelectedEntityID(null);
      setTool(placeFxTemplateId ? 'add' : 'move');
      return;
    }
    setPlacePlatformerModuleId(null);
    if (envType !== 'openWorld') {
      setTool('move');
      return;
    }
    setTool('terrain');
    if (domainId === 'mountains') {
      const mountainSet = new Set<TerrainBrush>([
        'raiseGround',
        'lowerGround',
        'smoothGround',
        'flattenGround',
        'plateauCliff',
        'weatherCracks',
        'weatherErode',
        'paintRock',
        'paintSnow',
      ]);
      if (!mountainSet.has(brush)) setBrush('raiseGround');
    } else if (domainId === 'water') {
      if (brush !== 'paintWaterLake' && brush !== 'carveRiver') setBrush('paintWaterLake');
    } else if (domainId === 'caves') {
      setBrush('carveCave');
    } else if (domainId === 'grass') {
      if (brush !== 'paintGrass' && brush !== 'paintGrassErase' && brush !== 'paintTallGrass') {
        setBrush('paintGrass');
      }
    } else if (domainId === 'dirtRoads') {
      if (
        brush !== 'paintRoad' &&
        brush !== 'paintDirt' &&
        brush !== 'paintClumpyDirt' &&
        brush !== 'paintLeaves' &&
        brush !== 'paintCobble'
      ) {
        setBrush('paintRoad');
      }
    } else if (domainId === 'flora') {
      const floraSet = new Set<TerrainBrush>([
        'scatterTree',
        'scatterRock',
        'scatterFlower',
        'scatterPlant',
        'scatterCustom',
      ]);
      if (!floraSet.has(brush)) setBrush('scatterTree');
    }
  };

  const focusEntity = (ent: LevelEntity) => {
    if (envType === 'openWorld' && store.worldEditorScope === 'worldMap') {
      store.enterWorldEditorScope(currentLevel.id);
    }
    store.setSelectedEntityID(ent.id);
    store.setActiveWorldDomain('select');
    if (tool === 'terrain' || tool === 'add') setTool('move');
    const [wx, wz] = levelBoardToWorld(currentLevel, ent.position);
    const wy = sampleTerrainHeight(terrain, wx, wz) + (ent.elevationY ?? 0);
    store.focusCameraOnWorldPoint({
      id: ent.id,
      x: wx,
      y: wy + 1.1,
      z: wz,
      distance: 18,
    });
  };

  const focusHeroStart = (activatePlaceMode = false) => {
    if (envType === 'openWorld' && store.worldEditorScope === 'worldMap') {
      store.enterWorldEditorScope(currentLevel.id);
    }
    store.setSelectedEntityID(HERO_START_ENTITY_ID);
    store.setActiveWorldDomain('select');
    if (activatePlaceMode) {
      setPlaceFxTemplateId(null);
      setActivePlacementAssetId(null);
      setAddPaletteMode('entities');
      setDropCustomAssetId('');
      setDropPreset('heroStart');
      setTool('add');
      return;
    }
    setDropPreset(null);
    if (tool === 'terrain' || tool === 'add') setTool('move');
    const heroBp =
      store.playFromPoint ??
      currentLevel.startPoint ??
      (envType === 'sideScroller' ? { x: 0.1, y: 0.5 } : { x: 0.14, y: 0.8 });
    const [wx, wz] = levelBoardToWorld(currentLevel, heroBp);
    const wy = sampleTerrainHeight(terrain, wx, wz);
    store.focusCameraOnWorldPoint({
      id: HERO_START_ENTITY_ID,
      x: wx,
      y: wy + 1.1,
      z: wz,
      distance: 18,
    });
  };

  const showHeroInContents =
    !searchQ ||
    currentProject.heroName.toLowerCase().includes(searchQ) ||
    'hero'.includes(searchQ) ||
    'player'.includes(searchQ) ||
    'start'.includes(searchQ);

  const isWorldMapScope = envType === 'openWorld' && store.worldEditorScope === 'worldMap';
  const wm = store.resolvedWorldMap;
  const wmRegions = wm?.regions ?? [];
  const activeRegion = wmRegions.find((r) => r.levelId === currentLevel.id) ?? null;

  return (
    <div className="h-full min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden maker-scroll">
      {/* Left sidebar: Contextual AI Creator OR Focused Creation & Land Elements Panel */}
      {aiPanelState.isOpen ? (
        <aside className="w-full lg:w-[296px] xl:w-[320px] shrink-0 lg:h-full lg:min-h-0 bg-white dark:bg-[#171A23] border-b lg:border-b-0 lg:border-r border-slate-200/80 dark:border-white/[0.08] overflow-hidden flex flex-col">
          <ContextualAiPanel
            store={store}
            initialContext={aiPanelState.preferredContext}
            embedded
            onClose={() => setContextualAiPanelOpen(false)}
          />
        </aside>
      ) : (
        leftPanelVisible && (
          <WorldLeftCreationPanel
            store={store}
            envType={envType}
            isWorldMapScope={isWorldMapScope}
            worldMapSelectMode={worldMapSelectMode}
            onWorldMapSelectModeChange={setWorldMapSelectMode}
            activeTool={activeTool}
            setTool={setTool}
            brushRadius={brushRadius}
            setBrushRadius={setBrushRadius}
            activeTab={leftActiveTab}
            setActiveTab={setLeftActiveTab}
            propsSubTab={leftPropsSubTab}
            setPropsSubTab={setLeftPropsSubTab}
            onSelectDomain={(domainId) => selectWorldDomain(domainId)}
            atmosphereSection={atmosphereSection}
            onSelectAtmosphereSection={setAtmosphereSection}
            onOpenLandSettings={() => {
              setLeftActiveTab('props');
              setLeftPropsSubTab('scene');
              setShowLevelSettings(true);
            }}
            onCollapsePanel={() => setLeftPanelOpen(false)}
            activePlacementAssetId={activePlacementAssetId}
            onSelectPlacementAsset={(assetId) => {
              if (isWorldMapScope) {
                const targetRegion = wmRegions[0] ?? store.addWorldLandRegion('Land 1');
                if (targetRegion) {
                  store.enterWorldEditorScope(targetRegion.levelId);
                }
              }
              setActivePlacementAssetId(assetId);
              setPlaceFxTemplateId(null);
              setPlacePlatformerModuleId(null);
              setAddPaletteMode('entities');
              setDropCustomAssetId(assetId);
              setTool('add');
              store.setActiveWorldDomain('select');
            }}
            placePlatformerModuleId={placePlatformerModuleId}
            onSelectPlacePlatformerModule={(spec) => {
              if (spec) {
                setPlaceFxTemplateId(null);
                setActivePlacementAssetId(null);
                setDropPreset(null);
                setAddPaletteMode('entities');
                setPlacePlatformerModuleId(spec.id);
                setTool('add');
              } else {
                setPlacePlatformerModuleId(null);
                setTool('move');
              }
            }}
            onQuickPlacePlatformerModule={(spec) => {
              const bx =
                envType === 'sideScroller'
                  ? 0.35 + Math.random() * 0.3
                  : 0.44 + Math.random() * 0.12;
              const bz = envType === 'sideScroller' ? 0.5 : 0.44 + Math.random() * 0.12;
              placePlatformerModuleAtPoint(spec.id, { x: bx, y: bz });
            }}
            renderSceneContents={() => (
              <>
                {/* Search Contents */}
                <div className="relative">
                  <Search
                    size={13}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />
            <input
              type="text"
              value={contentsSearch}
              onChange={(e) => setContentsSearch(e.target.value)}
              placeholder="Search characters, objects, lakes, caves…"
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1F2430] text-xs font-medium border border-slate-200/60 dark:border-white/[0.06] focus:outline-none focus:ring-2 focus:ring-[#7C5CFF]"
            />
          </div>

          {/* Grouped Scene Contents */}
          <div className="space-y-3">
            {(showHeroInContents || actorsInLevel.length > 0) && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-[#7D859B] px-1">
                  <span>Cast &amp; NPCs</span>
                  <span className="tabular-nums">
                    {(showHeroInContents ? 1 : 0) + actorsInLevel.length}
                  </span>
                </div>
                <div className="space-y-1">
                  {showHeroInContents && (() => {
                    const heroSelected = store.selectedEntityID === HERO_START_ENTITY_ID;
                    const placingHeroNow = activeTool === 'add' && dropPreset === 'heroStart';
                    return (
                      <div
                        className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                          heroSelected || placingHeroNow
                            ? 'bg-[#7C5CFF]/15 text-[#7C5CFF]'
                            : 'hover:bg-slate-100 dark:hover:bg-[#1F2430]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => focusHeroStart(false)}
                          className="flex items-center gap-2 flex-1 min-w-0 text-left"
                        >
                          <AssetThumbnail
                            customAsset={heroCustomAsset}
                            hero={{
                              body: currentProject.heroBody,
                              colors: currentProject.heroColors,
                            }}
                            size={24}
                            rounded="rounded-lg"
                          />
                          <span className="truncate flex-1">{currentProject.heroName}</span>
                          <span className="text-[10px] text-[#7C5CFF] font-bold shrink-0">
                            {currentLevel.hasStart ? 'Hero' : 'Unplaced'}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => focusHeroStart(!placingHeroNow)}
                          title="Click on the 3D/2D map to place Hero"
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-extrabold transition-colors shrink-0 ${
                            placingHeroNow
                              ? 'bg-[#7C5CFF] text-white'
                              : 'bg-[#7C5CFF]/12 text-[#7C5CFF] hover:bg-[#7C5CFF] hover:text-white'
                          }`}
                        >
                          <MapPin size={10} />
                          <span>{placingHeroNow ? 'Placing…' : 'Place'}</span>
                        </button>
                      </div>
                    );
                  })()}
                  {actorsInLevel.map((ent) => {
                    const active = ent.id === store.selectedEntityID;
                    const custom = ent.customAssetId
                      ? store.customAssets.find((a) => a.id === ent.customAssetId) ?? null
                      : null;
                    return (
                      <button
                        key={ent.id}
                        type="button"
                        onClick={() => focusEntity(ent)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-left text-xs font-semibold transition-colors ${
                          active
                            ? 'bg-[#7C5CFF]/15 text-[#7C5CFF]'
                            : 'hover:bg-slate-100 dark:hover:bg-[#1F2430]'
                        }`}
                      >
                        <AssetThumbnail entity={ent} customAsset={custom} size={24} rounded="rounded-lg" />
                        <span className="truncate flex-1">{ent.name}</span>
                        <span className="text-[10px] text-slate-400 dark:text-[#7D859B]">
                          {ent.isBuddy ? 'Buddy' : EntityKindMeta[ent.kind].title}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {objectsInLevel.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-[#7D859B] px-1">
                  <span>Objects, Buildings &amp; Props</span>
                  <span className="tabular-nums">{objectsInLevel.length}</span>
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto maker-scroll">
                  {objectsInLevel.map((ent) => {
                    const active = ent.id === store.selectedEntityID;
                    const custom = ent.customAssetId
                      ? store.customAssets.find((a) => a.id === ent.customAssetId) ?? null
                      : null;
                    return (
                      <button
                        key={ent.id}
                        type="button"
                        onClick={() => focusEntity(ent)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-left text-xs font-semibold transition-colors ${
                          active
                            ? 'bg-[#7C5CFF]/15 text-[#7C5CFF]'
                            : 'hover:bg-slate-100 dark:hover:bg-[#1F2430]'
                        }`}
                      >
                        <AssetThumbnail entity={ent} customAsset={custom} size={24} rounded="rounded-lg" />
                        <span className="truncate flex-1">{ent.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {envType === 'openWorld' && waterBodiesInLevel.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-[#7D859B] px-1">
                  <span>Water Bodies</span>
                  <span className="tabular-nums">{waterBodiesInLevel.length}</span>
                </div>
                <div className="space-y-1">
                  {waterBodiesInLevel.map((wb) => {
                    const active = store.selectedWaterBodyId === wb.id && store.activeWorldDomain === 'water';
                    return (
                      <button
                        key={wb.id}
                        type="button"
                        onClick={() => {
                          store.setSelectedEntityID(null);
                          store.setSelectedWaterBodyId(wb.id);
                          store.setActiveWorldDomain('water');
                          store.focusCameraOnWorldPoint({
                            id: wb.id,
                            x: wb.center[0],
                            y: 0,
                            z: wb.center[1],
                            distance: 32,
                          });
                        }}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-left text-xs font-semibold transition-colors ${
                          active
                            ? 'bg-[#0EA5E9]/15 text-[#0284C7] dark:text-[#38BDF8]'
                            : 'hover:bg-slate-100 dark:hover:bg-[#1F2430]'
                        }`}
                      >
                        <span
                          className="w-3 h-3 rounded-full shrink-0 border border-black/15"
                          style={{ backgroundColor: wb.waterColor }}
                        />
                        <span className="truncate flex-1">{wb.name}</span>
                        <span className="text-[10px] uppercase opacity-70">{wb.kind}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {envType === 'openWorld' && (cavesInLevel.length > 0 || roadsInLevel.length > 0) && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-[#7D859B] px-1">
                  <span>Caves &amp; Trails</span>
                  <span className="tabular-nums">{cavesInLevel.length + roadsInLevel.length}</span>
                </div>
                <div className="space-y-1">
                  {cavesInLevel.map((c, idx) => {
                    const active = store.selectedCaveId === c.id && store.activeWorldDomain === 'caves';
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          store.setSelectedEntityID(null);
                          store.setSelectedCaveId(c.id);
                          store.setActiveWorldDomain('caves');
                          store.focusCameraOnWorldPoint({
                            id: c.id,
                            x: c.x,
                            y: sampleTerrainHeight(terrain, c.x, c.z) + 1.5,
                            z: c.z,
                            distance: 22,
                          });
                        }}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-left text-xs font-semibold ${
                          active
                            ? 'bg-[#A855F7]/15 text-[#A855F7]'
                            : 'hover:bg-slate-100 dark:hover:bg-[#1F2430]'
                        }`}
                      >
                        <Mountain size={13} className="text-[#A855F7] shrink-0" />
                        <span className="truncate flex-1">{c.name || `Cave Grotto ${idx + 1}`}</span>
                      </button>
                    );
                  })}
                  {roadsInLevel.map((r) => {
                    const active = store.selectedRoadId === r.id && store.activeWorldDomain === 'dirtRoads';
                    const midPt = r.points[Math.floor(r.points.length / 2)] ?? [0, 0];
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          store.setSelectedEntityID(null);
                          store.setSelectedRoadId(r.id);
                          store.setActiveWorldDomain('dirtRoads');
                          store.focusCameraOnWorldPoint({
                            id: r.id,
                            x: midPt[0],
                            y: sampleTerrainHeight(terrain, midPt[0], midPt[1]) + 1.5,
                            z: midPt[1],
                            distance: 28,
                          });
                        }}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-left text-xs font-semibold ${
                          active
                            ? 'bg-[#C2854E]/18 text-[#C2854E]'
                            : 'hover:bg-slate-100 dark:hover:bg-[#1F2430]'
                        }`}
                      >
                        <Route size={13} className="text-[#C2854E] shrink-0" />
                        <span className="truncate flex-1">{r.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Collapsible Level Essentials & Rules */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#1C202B] overflow-hidden">
            <button
              type="button"
              onClick={() => setShowLevelSettings((v) => !v)}
              className="w-full px-3 py-2.5 flex items-center justify-between text-xs font-extrabold hover:bg-slate-100 dark:hover:bg-[#232938]"
            >
              <span className="flex items-center gap-1.5">
                <SlidersHorizontal size={13} className="text-[#7C5CFF]" />
                <span>Level Settings &amp; Rules</span>
              </span>
              {showLevelSettings ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            {showLevelSettings && (
              <div className="p-3 pt-1 space-y-3.5 border-t border-slate-200/70 dark:border-white/[0.06]">
                {/* Level name */}
                <div className="space-y-1">
                  <FieldLabel text="Level name" />
                  <input
                    type="text"
                    value={currentLevel.name}
                    onChange={(e) =>
                      store.updateLevel(
                        'rename level',
                        (lvl) => ({ ...lvl, name: e.target.value }),
                        false
                      )
                    }
                    className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#171A23] border border-slate-200/60 dark:border-white/[0.06] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#7C5CFF]"
                  />
                </div>

                {/* Scene Environment */}
                <div className="space-y-1">
                  <FieldLabel text="Scene environment" />
                  <div className="grid grid-cols-2 gap-1">
                    {EnvironmentTypes.map((et) => {
                      const active = envType === et.id;
                      return (
                        <button
                          key={et.id}
                          type="button"
                          title={et.blurb}
                          onClick={() => {
                            const nextEnv = et.id as EnvironmentType;
                            if (nextEnv !== 'openWorld' && tool === 'terrain') {
                              setTool('move');
                              store.setActiveWorldDomain('select');
                            }
                            store.updateLevel('change scene environment', (lvl) => {
                              const nextCam: CameraMode =
                                nextEnv === 'sideScroller'
                                  ? 'sideScroll'
                                  : lvl.cameraMode === 'sideScroll' || !lvl.cameraMode
                                  ? 'front'
                                  : lvl.cameraMode;
                              const nextSky =
                                nextEnv === 'dungeon'
                                  ? 'cave'
                                  : nextEnv === 'scifi'
                                  ? 'night'
                                  : lvl.sky === 'cave'
                                  ? 'sunny'
                                  : lvl.sky;
                              return {
                                ...lvl,
                                environmentType: nextEnv,
                                cameraMode: nextCam,
                                sky: nextSky,
                                sideScrollerConfig:
                                  nextEnv === 'sideScroller' && !lvl.sideScrollerConfig
                                    ? createSideScrollerPresetConfig('flat2D', 'sunnyCliffs')
                                    : lvl.sideScrollerConfig,
                              };
                            });
                          }}
                          className={`px-2 py-1.5 rounded-xl text-[10px] font-bold border text-left transition-colors ${
                            active
                              ? 'border-[#7C5CFF] bg-[#7C5CFF]/15 text-[#7C5CFF]'
                              : 'border-transparent bg-white dark:bg-[#171A23] text-slate-600 dark:text-[#949BB0]'
                          }`}
                        >
                          {et.title}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Water Behavior */}
                {envType === 'openWorld' && (
                  <div className="space-y-1">
                    <FieldLabel text="Water behavior" />
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          store.updateLevel('enable auto swim', (lvl) => ({ ...lvl, canSwim: true }))
                        }
                        className={`px-2 py-1.5 rounded-xl text-[10px] font-bold border ${
                          currentLevel.canSwim !== false
                            ? 'border-[#38BDF8] bg-[#38BDF8]/15 text-[#38BDF8]'
                            : 'border-transparent bg-white dark:bg-[#171A23] text-slate-600 dark:text-[#949BB0]'
                        }`}
                      >
                        Auto-swim
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          store.updateLevel('disable auto swim', (lvl) => ({ ...lvl, canSwim: false }))
                        }
                        className={`px-2 py-1.5 rounded-xl text-[10px] font-bold border ${
                          currentLevel.canSwim === false
                            ? 'border-[#F59E0B] bg-[#F59E0B]/15 text-[#F59E0B]'
                            : 'border-transparent bg-white dark:bg-[#171A23] text-slate-600 dark:text-[#949BB0]'
                        }`}
                      >
                        Splash respawn
                      </button>
                    </div>
                  </div>
                )}

                {/* Platformer Style & Multi-Layer Controls */}
                {envType === 'sideScroller' && (() => {
                  const sCfg = getSideScrollerConfig(currentLevel);
                  const updateSideCfg = (
                    label: string,
                    updater: (prevCfg: typeof sCfg) => typeof sCfg
                  ) => {
                    store.updateLevel(label, (lvl) => ({
                      ...lvl,
                      sideScrollerConfig: updater(getSideScrollerConfig(lvl)),
                    }));
                  };
                  return (
                    <div className="p-2.5 rounded-xl bg-white dark:bg-[#171A23] space-y-2.5 border border-[#20B46A]/25">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-extrabold text-[#20B46A]">
                          Platformer Layers &amp; Style
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-[#949BB0]">
                          {sCfg.segments.length} plats · {sCfg.vines.length} climbs · {sCfg.secretRooms.length} rooms
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="space-y-0.5">
                          <FieldLabel text="Layout Style" />
                          <select
                            value={sCfg.layoutStyle}
                            onChange={(e) => {
                              const nextLayout = e.target.value as SideScrollerLayoutStyle;
                              const nextPreset = createSideScrollerPresetConfig(nextLayout, sCfg.theme);
                              updateSideCfg('apply platformer layout', () => nextPreset);
                            }}
                            className="w-full px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-[10px] font-bold"
                          >
                            <option value="flat2D">Flat 2D Run</option>
                            <option value="verticalClimber">Vertical Tower (DK)</option>
                            <option value="layeredJungle">Layered Jungle (DKC)</option>
                            <option value="underwater">Underwater Coral</option>
                            <option value="skyTemple">Sky Temple</option>
                            <option value="cavern">Crystal Cavern</option>
                          </select>
                        </div>
                        <div className="space-y-0.5">
                          <FieldLabel text="World Theme" />
                          <select
                            value={sCfg.theme}
                            onChange={(e) => {
                              const nextTheme = e.target.value as SideScrollerThemeId;
                              const nextLayers = getSideScrollerThemeLayers(nextTheme);
                              updateSideCfg('change platformer theme', (prevCfg) => ({
                                ...prevCfg,
                                theme: nextTheme,
                                swimPhysics: nextTheme === 'underwaterCoral' || prevCfg.layoutStyle === 'underwater',
                                gravityScale: nextTheme === 'underwaterCoral' ? 0.48 : prevCfg.gravityScale ?? 1,
                                layers: nextLayers,
                              }));
                            }}
                            className="w-full px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-[10px] font-bold"
                          >
                            <option value="sunnyCliffs">Sunny Cliffs</option>
                            <option value="jungleCanopy">Jungle Canopy</option>
                            <option value="underwaterCoral">Coral Reef</option>
                            <option value="volcanicForge">Volcanic Forge</option>
                            <option value="crystalCavern">Crystal Cavern</option>
                            <option value="skyTemple">Sky Temple</option>
                          </select>
                        </div>
                      </div>

                      {/* Layer Colors */}
                      <div className="space-y-1">
                        <FieldLabel text="Parallax &amp; Lane Colors" />
                        <div className="grid grid-cols-5 gap-1">
                          {(
                            [
                              ['Hero', 'heroLaneColor'],
                              ['Trim', 'heroTrimColor'],
                              ['Front', 'foregroundColor'],
                              ['Mid', 'midgroundColor'],
                              ['Far', 'farColor'],
                            ] as const
                          ).map(([label, key]) => (
                            <label
                              key={key}
                              className="flex flex-col items-center gap-0.5 text-[9px] font-bold text-slate-500 dark:text-[#949BB0]"
                            >
                              <span>{label}</span>
                              <input
                                type="color"
                                value={sCfg.layers[key]}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  updateSideCfg(`tint ${label} layer`, (prevCfg) => ({
                                    ...prevCfg,
                                    layers: { ...prevCfg.layers, [key]: val },
                                  }));
                                }}
                                className="w-full h-5 rounded cursor-pointer border-0 bg-transparent p-0"
                              />
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Liquid & Physics */}
                      <div className="grid grid-cols-3 gap-1.5 items-end">
                        <div className="space-y-0.5">
                          <FieldLabel text="Hazard Liquid" />
                          <select
                            value={sCfg.layers.liquidType}
                            onChange={(e) => {
                              const nextLiq = e.target.value as 'water' | 'lava' | 'mist' | 'none';
                              updateSideCfg('change liquid layer', (prevCfg) => ({
                                ...prevCfg,
                                layers: {
                                  ...prevCfg.layers,
                                  liquidType: nextLiq,
                                  liquidColor:
                                    nextLiq === 'lava'
                                      ? '#EF4444'
                                      : nextLiq === 'water'
                                      ? '#0EA5E9'
                                      : prevCfg.layers.liquidColor,
                                },
                              }));
                            }}
                            className="w-full px-1.5 py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-[10px] font-bold"
                          >
                            <option value="water">Water</option>
                            <option value="lava">Lava</option>
                            <option value="mist">Mist</option>
                            <option value="none">None</option>
                          </select>
                        </div>
                        <label className="flex flex-col gap-0.5 text-[10px] font-bold text-slate-500 dark:text-[#949BB0]">
                          <span>Liquid Tint</span>
                          <input
                            type="color"
                            value={sCfg.layers.liquidColor}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateSideCfg('tint liquid', (prevCfg) => ({
                                ...prevCfg,
                                layers: { ...prevCfg.layers, liquidColor: val },
                              }));
                            }}
                            className="w-full h-6 rounded cursor-pointer border-0 bg-transparent p-0"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            updateSideCfg('toggle swim physics', (prevCfg) => ({
                              ...prevCfg,
                              swimPhysics: !prevCfg.swimPhysics,
                              gravityScale: !prevCfg.swimPhysics ? 0.48 : 1.0,
                            }))
                          }
                          className={`px-2 py-1 rounded-lg text-[10px] font-extrabold border ${
                            sCfg.swimPhysics
                              ? 'border-[#38BDF8] bg-[#38BDF8]/15 text-[#38BDF8]'
                              : 'border-slate-200 dark:border-white/10 text-slate-500 dark:text-[#949BB0]'
                          }`}
                        >
                          {sCfg.swimPhysics ? 'Swim ON' : 'Land Grav'}
                        </button>
                      </div>

                      {/* Quick Layer Builders */}
                      <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                        <button
                          type="button"
                          onClick={() =>
                            updateSideCfg('add climbable vine or ladder', (prevCfg) => ({
                              ...prevCfg,
                              vines: [
                                ...prevCfg.vines,
                                {
                                  id: uid(),
                                  kind:
                                    prevCfg.layoutStyle === 'verticalClimber'
                                      ? 'ladder'
                                      : prevCfg.swimPhysics
                                      ? 'bubbleStream'
                                      : 'vine',
                                  x: Math.round((prevCfg.vines.length * 9 - 14) * 10) / 10,
                                  bottomY: 0,
                                  topY: 7,
                                },
                              ],
                            }))
                          }
                          className="px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-300 text-[10px] font-extrabold inline-flex items-center justify-center gap-1"
                        >
                          <Plus size={11} />
                          <span>Add Vine / Ladder</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateSideCfg('add secret bonus room', (prevCfg) => ({
                              ...prevCfg,
                              secretRooms: [
                                ...prevCfg.secretRooms,
                                {
                                  id: uid(),
                                  name: `Bonus Vault ${prevCfg.secretRooms.length + 1}`,
                                  entranceX: 12 + prevCfg.secretRooms.length * 8,
                                  entranceY: 0,
                                  roomCenterX: -12 + prevCfg.secretRooms.length * 16,
                                  roomCenterY: -16,
                                  width: 14,
                                  height: 6.5,
                                  floorColor: prevCfg.layers.heroLaneColor,
                                  wallColor: prevCfg.layers.midgroundColor,
                                  accentColor: prevCfg.layers.heroTrimColor,
                                },
                              ],
                            }))
                          }
                          className="px-2 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-600 dark:text-purple-300 text-[10px] font-extrabold inline-flex items-center justify-center gap-1"
                        >
                          <Plus size={11} />
                          <span>Add Secret Room</span>
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => selectWorldDomain('platformerKit')}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#20B46A] hover:bg-[#199958] text-white text-[10px] font-extrabold inline-flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Gamepad2 size={12} />
                        <span>Open Modular Platformer Kit &amp; Movement Tuning</span>
                      </button>
                    </div>
                  );
                })()}

                {/* Camera & Music */}
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="space-y-1">
                    <FieldLabel text="Camera feel" />
                    <select
                      value={cameraMode}
                      onChange={(e) =>
                        store.updateLevel('change camera mode', (lvl) => ({
                          ...lvl,
                          cameraMode: e.target.value as CameraMode,
                        }))
                      }
                      className="w-full px-2 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-[11px] font-semibold"
                    >
                      {CameraModes.map((cm) => (
                        <option key={cm.id} value={cm.id}>
                          {cm.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <FieldLabel text="Music mood" />
                    <select
                      value={currentLevel.audio.mood}
                      onChange={(e) =>
                        store.updateLevel('change music', (lvl) => ({
                          ...lvl,
                          audio: { ...lvl.audio, mood: e.target.value as typeof lvl.audio.mood },
                        }))
                      }
                      className="w-full px-2 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-[11px] font-semibold"
                    >
                      {MusicMoodOptions.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Win Condition */}
                <div className="space-y-1">
                  <FieldLabel text="How to beat this level" />
                  <select
                    value={currentLevel.completeCondition}
                    onChange={(e) =>
                      store.updateLevel('change win condition', (lvl) => ({
                        ...lvl,
                        completeCondition: e.target.value as typeof lvl.completeCondition,
                      }))
                    }
                    className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-[11px] font-semibold"
                  >
                    {CompleteConditions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Gameplay Mode + Driving + Roguelike + Dungeon + Duckling + Storybook */}
                <div className="p-2.5 rounded-xl bg-white dark:bg-[#171A23] space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <FieldLabel text="Gameplay Mode" />
                    <select
                      value={currentLevel.gameplayMode ?? 'adventure'}
                      onChange={(e) => {
                        const mode = e.target.value as GameplayMode;
                        store.updateLevel('change gameplay mode', (lvl) => ({
                          ...lvl,
                          gameplayMode: mode,
                          drivingConfig:
                            mode === 'driving'
                              ? lvl.drivingConfig ?? {
                                  carId: 'trailBuggy',
                                  physicsId: 'arcadeDrift',
                                  driverId: 'stunt',
                                  cameraView: 'closeChase',
                                }
                              : lvl.drivingConfig,
                          roguelikeConfig:
                            mode === 'roguelike'
                              ? lvl.roguelikeConfig ?? { ...DEFAULT_ROGUELIKE_CONFIG }
                              : lvl.roguelikeConfig,
                          rpgConfig:
                            mode === 'rpg'
                              ? lvl.rpgConfig ?? {
                                  scenario: 'medievalVillage',
                                  lootMode: 'both',
                                  pathStyle: 'weatheredStone',
                                  isInterior: false,
                                  volumetricLanterns: true,
                                  cameraZoom: 25,
                                }
                              : lvl.rpgConfig,
                          cameraMode:
                            mode === 'roguelike' || mode === 'rpg'
                              ? 'isometric'
                              : lvl.cameraMode,
                        }));
                      }}
                      className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-[11px] font-bold"
                    >
                      <option value="adventure">Adventure</option>
                      <option value="rpg">Isometric RPG</option>
                      <option value="buddies">Buddies Quest</option>
                      <option value="driving">Forest Driving</option>
                      <option value="roguelike">Roguelike Run</option>
                    </select>
                  </div>

                  {currentLevel.gameplayMode === 'rpg' && (
                    <div className="space-y-2 pt-2 border-t border-slate-200/70 dark:border-white/[0.06]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-extrabold text-[#8B5CF6]">
                          Isometric RPG Diorama & Loot
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">
                          Sword · Bow · Magic
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <select
                          value={currentLevel.rpgConfig?.scenario ?? 'medievalVillage'}
                          onChange={(e) => {
                            const scenario = e.target.value as RpgScenarioId;
                            const isInterior = scenario.startsWith('interior');
                            store.updateLevel('change RPG scenario', (lvl) => ({
                              ...lvl,
                              cameraMode: 'isometric',
                              biome:
                                scenario === 'jungleRuins'
                                  ? 'swamp'
                                  : scenario === 'stoneTemple' || scenario === 'interiorCave'
                                    ? 'cave'
                                    : scenario === 'coastalVillage'
                                      ? 'island'
                                      : 'forest',
                              rpgConfig: {
                                scenario,
                                lootMode: lvl.rpgConfig?.lootMode ?? 'both',
                                pathStyle: lvl.rpgConfig?.pathStyle ?? 'weatheredStone',
                                isInterior,
                                volumetricLanterns: true,
                                cameraZoom: isInterior ? 20 : 25,
                              },
                            }));
                          }}
                          className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-[10px] font-bold"
                        >
                          <option value="medievalVillage">Medieval Village</option>
                          <option value="jungleRuins">Lush Jungle Ruins</option>
                          <option value="deepWoodedForest">Deep Wooded Forest</option>
                          <option value="stoneTemple">Stone Temple Sanctuary</option>
                          <option value="coastalVillage">Coastal Harbor Village</option>
                          <option value="interiorCottage">Interior: Forest Cottage</option>
                          <option value="interiorTavern">Interior: Timber Tavern</option>
                          <option value="interiorCave">Interior: Volumetric Cave</option>
                        </select>

                        <select
                          value={currentLevel.rpgConfig?.lootMode ?? 'both'}
                          onChange={(e) => {
                            const lootMode = e.target.value as RpgLootMode;
                            store.updateLevel('change RPG loot mode', (lvl) => ({
                              ...lvl,
                              rpgConfig: {
                                scenario: lvl.rpgConfig?.scenario ?? 'medievalVillage',
                                lootMode,
                                pathStyle: lvl.rpgConfig?.pathStyle ?? 'weatheredStone',
                                isInterior: lvl.rpgConfig?.isInterior ?? false,
                                volumetricLanterns: lvl.rpgConfig?.volumetricLanterns ?? true,
                                cameraZoom: lvl.rpgConfig?.cameraZoom ?? 25,
                              },
                            }));
                          }}
                          className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-[10px] font-bold"
                        >
                          <option value="both">Chests + Fanned Cards</option>
                          <option value="fannedCards">Fanned Reward Cards</option>
                          <option value="traditional">Traditional Chests</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold text-slate-500">Path & Bridge Style</span>
                        <select
                          value={currentLevel.rpgConfig?.pathStyle ?? 'weatheredStone'}
                          onChange={(e) => {
                            const pathStyle = e.target.value as RpgPathStyle;
                            store.updateLevel('change RPG path style', (lvl) => ({
                              ...lvl,
                              rpgConfig: {
                                scenario: lvl.rpgConfig?.scenario ?? 'medievalVillage',
                                lootMode: lvl.rpgConfig?.lootMode ?? 'both',
                                pathStyle,
                                isInterior: lvl.rpgConfig?.isInterior ?? false,
                                volumetricLanterns: lvl.rpgConfig?.volumetricLanterns ?? true,
                                cameraZoom: lvl.rpgConfig?.cameraZoom ?? 25,
                              },
                            }));
                          }}
                          className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-[10px] font-bold"
                        >
                          <option value="weatheredStone">Weathered Broken Stone</option>
                          <option value="ropeBridgeSlats">Rope Bridge (Broken Slat)</option>
                          <option value="mossyCobble">Mossy Cobblestone</option>
                          <option value="woodPlankWalkway">Distressed Wood Slats</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {currentLevel.gameplayMode === 'roguelike' && (
                    <div className="space-y-2 pt-2 border-t border-slate-200/70 dark:border-white/[0.06]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-extrabold text-[#E11D48]">
                          Roguelike Rules
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const nextSeed = Math.floor(10000 + Math.random() * 899999);
                            store.updateLevel('roll procedural dungeon floor', (lvl) =>
                              DungeonGenerator.generateFloor(lvl, nextSeed, 1, {
                                ...(lvl.roguelikeConfig ?? DEFAULT_ROGUELIKE_CONFIG),
                                fixedSeed: nextSeed,
                                dungeonStyle: resolveDungeonStyle(
                                  lvl.dungeonStyle ?? lvl.roguelikeConfig?.dungeonStyle
                                ),
                              })
                            );
                          }}
                          className="px-2 py-0.5 rounded-lg bg-[#E11D48]/15 text-[#E11D48] text-[10px] font-extrabold"
                        >
                          Roll Floor
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <select
                          value={currentLevel.roguelikeConfig?.bossInterval ?? 3}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            store.updateLevel('change boss interval', (lvl) => ({
                              ...lvl,
                              roguelikeConfig: {
                                ...DEFAULT_ROGUELIKE_CONFIG,
                                ...(lvl.roguelikeConfig ?? {}),
                                bossInterval: val,
                              },
                            }));
                          }}
                          className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-[10px] font-semibold"
                        >
                          {[2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>
                              Boss / {n}f
                            </option>
                          ))}
                        </select>
                        <select
                          value={currentLevel.roguelikeConfig?.startingMaxHealth ?? 6}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            store.updateLevel('change starting HP', (lvl) => ({
                              ...lvl,
                              roguelikeConfig: {
                                ...DEFAULT_ROGUELIKE_CONFIG,
                                ...(lvl.roguelikeConfig ?? {}),
                                startingMaxHealth: val,
                              },
                            }));
                          }}
                          className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-[10px] font-semibold"
                        >
                          {[4, 6, 8, 10].map((hp) => (
                            <option key={hp} value={hp}>
                              Start {hp} HP
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {(currentLevel.gameplayMode === 'roguelike' || envType === 'dungeon') &&
                    (() => {
                      const activeStyle = resolveDungeonStyle(
                        currentLevel.dungeonStyle ?? currentLevel.roguelikeConfig?.dungeonStyle
                      );
                      const updateDungeonStyle = (
                        label: string,
                        patch: Partial<typeof activeStyle>
                      ) => {
                        const merged = resolveDungeonStyle({ ...activeStyle, ...patch });
                        store.updateLevel(label, (lvl) => applyDungeonStyleToLevel(lvl, merged));
                      };
                      return (
                        <div className="space-y-2 pt-2 border-t border-slate-200/70 dark:border-white/[0.06]">
                          <span className="text-[11px] font-extrabold text-amber-500 block">
                            Dungeon Theme
                          </span>
                          <div className="grid grid-cols-2 gap-1">
                            {DUNGEON_THEME_PRESETS.map((preset) => (
                              <button
                                key={preset.id}
                                type="button"
                                onClick={() =>
                                  store.updateLevel(`apply ${preset.name} theme`, (lvl) =>
                                    applyDungeonStyleToLevel(lvl, preset.style)
                                  )
                                }
                                className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-[10px] font-bold truncate text-left"
                              >
                                {preset.name}
                              </button>
                            ))}
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <select
                              value={activeStyle.wallStyle}
                              onChange={(e) =>
                                updateDungeonStyle('change wall style', {
                                  wallStyle: e.target.value as DungeonWallStyle,
                                })
                              }
                              className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-[10px] font-semibold"
                            >
                              {(Object.keys(DUNGEON_WALL_STYLE_META) as DungeonWallStyle[]).map((k) => (
                                <option key={k} value={k}>
                                  {DUNGEON_WALL_STYLE_META[k].label}
                                </option>
                              ))}
                            </select>
                            <select
                              value={activeStyle.floorStyle}
                              onChange={(e) =>
                                updateDungeonStyle('change floor style', {
                                  floorStyle: e.target.value as DungeonFloorStyle,
                                })
                              }
                              className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-[10px] font-semibold"
                            >
                              {(Object.keys(DUNGEON_FLOOR_STYLE_META) as DungeonFloorStyle[]).map(
                                (k) => (
                                  <option key={k} value={k}>
                                    {DUNGEON_FLOOR_STYLE_META[k].label}
                                  </option>
                                )
                              )}
                            </select>
                            <select
                              value={activeStyle.propStyle}
                              onChange={(e) =>
                                updateDungeonStyle('change prop style', {
                                  propStyle: e.target.value as DungeonPropStyle,
                                })
                              }
                              className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-[10px] font-semibold"
                            >
                              {(Object.keys(DUNGEON_PROP_STYLE_META) as DungeonPropStyle[]).map((k) => (
                                <option key={k} value={k}>
                                  {DUNGEON_PROP_STYLE_META[k].label}
                                </option>
                              ))}
                            </select>
                            <select
                              value={activeStyle.trapStyle}
                              onChange={(e) =>
                                updateDungeonStyle('change trap style', {
                                  trapStyle: e.target.value as DungeonTrapStyle,
                                })
                              }
                              className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-[10px] font-semibold"
                            >
                              {(Object.keys(DUNGEON_TRAP_STYLE_META) as DungeonTrapStyle[]).map((k) => (
                                <option key={k} value={k}>
                                  {DUNGEON_TRAP_STYLE_META[k].label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1 pt-1.5 border-t border-slate-200/50 dark:border-white/[0.04]">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-slate-500 dark:text-[#949BB0]">
                                Place Scenario Trap Hazard
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-1">
                              {(
                                [
                                  'laserTripwires',
                                  'poisonDartPillars',
                                  'fireGeysers',
                                  'frostSpikes',
                                  'acidPuddles',
                                  'whirlpoolVortex',
                                ] as DungeonTrapStyle[]
                              ).map((tStyle) => {
                                const meta = DUNGEON_TRAP_STYLE_META[tStyle];
                                return (
                                  <button
                                    key={tStyle}
                                    type="button"
                                    onClick={() => {
                                      const sp = currentLevel.startPoint ?? { x: 0.5, y: 0.5 };
                                      const jitter = (Math.random() - 0.5) * 0.16;
                                      const bx = Math.min(0.9, Math.max(0.1, sp.x + jitter));
                                      const by = Math.min(0.9, Math.max(0.1, sp.y + 0.1 + jitter));
                                      const newTrap = createEntity('trap', meta.label, bx, by, {
                                        trapStyle: tStyle,
                                        styleTint: meta.emissiveHex ?? meta.hazardHex,
                                      });
                                      store.updateLevel(`add ${meta.label}`, (lvl) => ({
                                        ...lvl,
                                        entities: [...lvl.entities, newTrap],
                                      }));
                                    }}
                                    className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] hover:bg-slate-200 dark:hover:bg-[#2A3142] text-[10px] font-semibold flex items-center justify-between text-left truncate transition-colors"
                                  >
                                    <span className="truncate">{meta.label}</span>
                                    <span
                                      className="w-2 h-2 rounded-full shrink-0 ml-1"
                                      style={{ backgroundColor: meta.hazardHex }}
                                    />
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                  {currentLevel.gameplayMode === 'driving' && (() => {
                    const drivingCfg = currentLevel.drivingConfig ?? {
                      carId: 'trailBuggy' as CarPresetId,
                      physicsId: 'arcadeDrift' as DrivingPhysicsId,
                      driverId: 'stunt' as DriverTypeId,
                      cameraView: 'closeChase' as DrivingCameraView,
                    };
                    const custom = drivingCfg.customVehicle ?? {};

                    const updateCustomVehicle = (patch: Partial<VehicleCustomSpec>) => {
                      store.updateLevel('customize vehicle', (lvl) => ({
                        ...lvl,
                        drivingConfig: {
                          carId: lvl.drivingConfig?.carId ?? 'trailBuggy',
                          physicsId: lvl.drivingConfig?.physicsId ?? 'arcadeDrift',
                          driverId: lvl.drivingConfig?.driverId ?? 'stunt',
                          cameraView: lvl.drivingConfig?.cameraView ?? 'closeChase',
                          ...lvl.drivingConfig,
                          customVehicle: {
                            ...(lvl.drivingConfig?.customVehicle ?? {}),
                            ...patch,
                          },
                        },
                      }));
                    };

                    const spawnDriveProp = (preset: PropPresetId, name: string) => {
                      const spawn = currentLevel.startPoint ?? { x: 8, y: 8 };
                      const count = currentLevel.entities.filter((e) => e.propPreset === preset).length;
                      const offset = (count + 1) * 2;
                      const pos = {
                        x: spawn.x + (count % 2 === 0 ? offset : -offset),
                        y: spawn.y + offset,
                      };
                      const created = store.addEntity('prop', name, pos);
                      if (created) {
                        store.updateEntity(created.id, `spawn ${name}`, (ent) => ({
                          ...ent,
                          propPreset: preset,
                        }));
                      }
                    };

                    return (
                      <div className="space-y-2 pt-2 border-t border-slate-200/70 dark:border-white/[0.06]">
                        <div className="text-[11px] font-extrabold text-sky-600 dark:text-sky-400 flex items-center justify-between">
                          <span>Vehicle &amp; Driving Setup</span>
                          <span className="text-[9px] font-normal text-slate-400">Phase 2 Engine</span>
                        </div>

                        {/* Car Chassis Preset */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 dark:text-white/60">Chassis Archetype</label>
                          <select
                            value={drivingCfg.carId}
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
                            className="w-full px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-[11px] font-semibold"
                          >
                            {CAR_PRESETS.map((car) => (
                              <option key={car.id} value={car.id}>
                                {car.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Physics & Driver */}
                        <div className="grid grid-cols-2 gap-1.5">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 dark:text-white/60">Physics</label>
                            <select
                              value={drivingCfg.physicsId}
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
                              className="w-full px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-[10px] font-semibold"
                            >
                              {DRIVING_PHYSICS_PRESETS.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 dark:text-white/60">Pilot</label>
                            <select
                              value={drivingCfg.driverId}
                              onChange={(e) =>
                                store.updateLevel('change driver type', (lvl) => ({
                                  ...lvl,
                                  drivingConfig: {
                                    carId: lvl.drivingConfig?.carId ?? 'trailBuggy',
                                    physicsId: lvl.drivingConfig?.physicsId ?? 'arcadeDrift',
                                    driverId: e.target.value as DriverTypeId,
                                    cameraView: lvl.drivingConfig?.cameraView ?? 'closeChase',
                                    customVehicle: lvl.drivingConfig?.customVehicle,
                                  },
                                }))
                              }
                              className="w-full px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-[10px] font-semibold"
                            >
                              {DRIVER_TYPES.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Camera View */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 dark:text-white/60">Camera View</label>
                          <select
                            value={drivingCfg.cameraView ?? 'closeChase'}
                            onChange={(e) =>
                              store.updateLevel('change driving cam', (lvl) => ({
                                ...lvl,
                                drivingConfig: {
                                  carId: lvl.drivingConfig?.carId ?? 'trailBuggy',
                                  physicsId: lvl.drivingConfig?.physicsId ?? 'arcadeDrift',
                                  driverId: lvl.drivingConfig?.driverId ?? 'stunt',
                                  cameraView: e.target.value as DrivingCameraView,
                                  customVehicle: lvl.drivingConfig?.customVehicle,
                                },
                              }))
                            }
                            className="w-full px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-[10px] font-semibold"
                          >
                            {DRIVING_CAMERA_VIEWS.map((cam) => (
                              <option key={cam.id} value={cam.id}>
                                {cam.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Vehicle Customizer (Wheels, Roof, Wings, Colors) */}
                        <div className="p-2 rounded-xl bg-slate-100/80 dark:bg-black/30 border border-slate-200 dark:border-white/10 space-y-2">
                          <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-sky-300">
                            Custom Modifications
                          </div>

                          <div className="grid grid-cols-2 gap-1.5">
                            {/* Wheel Style */}
                            <div className="space-y-0.5">
                              <label className="text-[9px] font-bold text-slate-500 dark:text-white/60">Wheels</label>
                              <select
                                value={custom.wheelStyle ?? 'standard'}
                                onChange={(e) => updateCustomVehicle({ wheelStyle: e.target.value as VehicleWheelStyle })}
                                className="w-full px-1.5 py-1 rounded bg-white dark:bg-[#171A23] text-[10px] font-semibold"
                              >
                                <option value="standard">Stock</option>
                                <option value="thickMag">Thick Mag Wheels</option>
                                <option value="offroadKnobby">Off-Road Knobby</option>
                                <option value="stoneRoller">Stone Rollers</option>
                                <option value="slick">F1 Slicks</option>
                              </select>
                            </div>

                            {/* Roof Style */}
                            <div className="space-y-0.5">
                              <label className="text-[9px] font-bold text-slate-500 dark:text-white/60">Roof / Canopy</label>
                              <select
                                value={custom.roofStyle ?? 'standard'}
                                onChange={(e) => updateCustomVehicle({ roofStyle: e.target.value as VehicleRoofStyle })}
                                className="w-full px-1.5 py-1 rounded bg-white dark:bg-[#171A23] text-[10px] font-semibold"
                              >
                                <option value="standard">Standard</option>
                                <option value="sunroof">Tinted Sunroof</option>
                                <option value="openTop">Open Roadster</option>
                                <option value="rollCage">Roll Cage</option>
                              </select>
                            </div>
                          </div>

                          {/* Wings for Chasm Flight */}
                          <div className="space-y-0.5">
                            <label className="text-[9px] font-bold text-slate-500 dark:text-white/60">Aerodynamic Wings (Chasm Leaps)</label>
                            <select
                              value={custom.wingStyle ?? 'none'}
                              onChange={(e) => updateCustomVehicle({ wingStyle: e.target.value as VehicleWingStyle })}
                              className="w-full px-1.5 py-1 rounded bg-white dark:bg-[#171A23] text-[10px] font-semibold"
                            >
                              <option value="none">No Permanent Wings</option>
                              <option value="gliderWings">🪽 Chasm Glider Wings (Hold Space)</option>
                              <option value="aeroFins">📐 Downforce Aero Fins</option>
                              <option value="jetWing">🚀 Turbo Jet Wings</option>
                            </select>
                          </div>

                          {/* Accessories Toggles */}
                          <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] font-semibold">
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={Boolean(custom.hasSpoiler)}
                                onChange={(e) => updateCustomVehicle({ hasSpoiler: e.target.checked })}
                              />
                              <span>Spoiler</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={Boolean(custom.hasBullbar)}
                                onChange={(e) => updateCustomVehicle({ hasBullbar: e.target.checked })}
                              />
                              <span>Bullbar</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={Boolean(custom.hasTwinExhaust)}
                                onChange={(e) => updateCustomVehicle({ hasTwinExhaust: e.target.checked })}
                              />
                              <span>Twin Exhaust</span>
                            </label>
                          </div>

                          {/* Color Palette */}
                          <div className="grid grid-cols-3 gap-1 pt-1">
                            <label className="flex flex-col gap-0.5 text-[9px] font-bold text-slate-500 dark:text-white/60">
                              <span>Body Color</span>
                              <input
                                type="color"
                                value={custom.bodyColor ?? '#D946EF'}
                                onChange={(e) => updateCustomVehicle({ bodyColor: e.target.value })}
                                className="w-full h-6 rounded cursor-pointer border border-white/20 bg-transparent"
                              />
                            </label>
                            <label className="flex flex-col gap-0.5 text-[9px] font-bold text-slate-500 dark:text-white/60">
                              <span>Accent Color</span>
                              <input
                                type="color"
                                value={custom.accentColor ?? '#38BDF8'}
                                onChange={(e) => updateCustomVehicle({ accentColor: e.target.value })}
                                className="w-full h-6 rounded cursor-pointer border border-white/20 bg-transparent"
                              />
                            </label>
                            <label className="flex flex-col gap-0.5 text-[9px] font-bold text-slate-500 dark:text-white/60">
                              <span>Rim Color</span>
                              <input
                                type="color"
                                value={custom.rimColor ?? '#F8FAFC'}
                                onChange={(e) => updateCustomVehicle({ rimColor: e.target.value })}
                                className="w-full h-6 rounded cursor-pointer border border-white/20 bg-transparent"
                              />
                            </label>
                          </div>
                        </div>

                        {/* Quick Driving Props Placement */}
                        <div className="space-y-1 pt-1">
                          <label className="text-[10px] font-bold text-slate-500 dark:text-white/60">Quick Add Driving Props</label>
                          <div className="grid grid-cols-2 gap-1 text-[10px] font-semibold">
                            <button
                              type="button"
                              onClick={() => spawnDriveProp('flightCube', 'Flight Bonus Cube')}
                              className="px-2 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-600 dark:text-sky-300 transition-colors text-left"
                            >
                              + 🪽 Flight Cube
                            </button>
                            <button
                              type="button"
                              onClick={() => spawnDriveProp('boostPad', 'Turbo Boost Pad')}
                              className="px-2 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-600 dark:text-cyan-300 transition-colors text-left"
                            >
                              + ⚡ Boost Pad
                            </button>
                            <button
                              type="button"
                              onClick={() => spawnDriveProp('ramp', 'Timber Stunt Ramp')}
                              className="px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-700 dark:text-amber-300 transition-colors text-left"
                            >
                              + 📐 Stunt Ramp
                            </button>
                            <button
                              type="button"
                              onClick={() => spawnDriveProp('roadBarrier', 'Hazard Barrier')}
                              className="px-2 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-600 dark:text-rose-300 transition-colors text-left"
                            >
                              + 🚧 Barrier
                            </button>
                            <button
                              type="button"
                              onClick={() => spawnDriveProp('checkpointArch', 'Rally Arch')}
                              className="col-span-2 px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300 transition-colors text-center"
                            >
                              + 🏁 Rally Checkpoint Arch
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {currentLevel.gameplayMode !== 'driving' && (
                    <div className="space-y-2 pt-2 border-t border-slate-200/70 dark:border-white/[0.06]">
                      <label className="flex items-center justify-between text-[11px] font-bold cursor-pointer">
                        <span>Escort Baby Duckling</span>
                        <input
                          type="checkbox"
                          checked={Boolean(currentLevel.startWithDuckling)}
                          onChange={(e) =>
                            store.updateLevel('toggle baby duckling companion', (lvl) => ({
                              ...lvl,
                              startWithDuckling: e.target.checked,
                            }))
                          }
                          className="accent-[#F59E0B] w-4 h-4"
                        />
                      </label>
                      <textarea
                        rows={2}
                        value={currentLevel.heroIntroSpeech ?? ''}
                        onChange={(e) =>
                          store.updateLevel(
                            'edit hero intro speech',
                            (lvl) => ({ ...lvl, heroIntroSpeech: e.target.value || undefined }),
                            false
                          )
                        }
                        placeholder="Opening hero dialogue…"
                        className="w-full px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-[11px] resize-none"
                      />
                      <DialogueVoiceEditor
                        dialogueText={currentLevel.heroIntroSpeech ?? ''}
                        voiceConfig={currentLevel.heroIntroVoice}
                        projectChatSettings={currentProject.chatSettings}
                        singleLineOnly
                        compact
                        labelPrefix="Intro"
                        onChange={(nextVoice) =>
                          store.updateLevel(
                            'update hero intro voice-over',
                            (lvl) => ({ ...lvl, heroIntroVoice: nextVoice }),
                            true
                          )
                        }
                      />
                    </div>
                  )}

                  {/* Storybook Framing */}
                  <div className="space-y-2 pt-2 border-t border-slate-200/70 dark:border-white/[0.06]">
                    <label className="flex items-center justify-between text-[11px] font-bold cursor-pointer">
                      <span>Storybook Framing</span>
                      <input
                        type="checkbox"
                        checked={Boolean(currentProject.storybook?.enabled)}
                        onChange={(e) => {
                          const nextEnabled = e.target.checked;
                          store.updateProject('toggle storybook framing', (proj) => ({
                            ...proj,
                            storybook: {
                              ...(proj.storybook ?? defaultStorybookConfig()),
                              enabled: nextEnabled,
                            },
                          }));
                        }}
                        className="accent-[#8C4A27] w-4 h-4"
                      />
                    </label>
                    {currentProject.storybook?.enabled && (() => {
                      const sb = currentProject.storybook ?? defaultStorybookConfig();
                      return (
                        <div className="space-y-1.5">
                          <select
                            value={sb.theme}
                            onChange={(e) =>
                              store.updateProject('change storybook theme', (proj) => ({
                                ...proj,
                                storybook: {
                                  ...(proj.storybook ?? defaultStorybookConfig()),
                                  theme: e.target.value as StorybookThemeId,
                                },
                              }))
                            }
                            className="w-full px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-[11px] font-semibold"
                          >
                            {StorybookThemeCatalog.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.title}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={currentLevel.chapterTitle ?? ''}
                            onChange={(e) =>
                              store.updateLevel(
                                'edit chapter title',
                                (lvl) => ({ ...lvl, chapterTitle: e.target.value }),
                                false
                              )
                            }
                            placeholder="Chapter Title…"
                            className="w-full px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-[11px]"
                          />
                          <textarea
                            rows={2}
                            value={sb.prologueText ?? ''}
                            onChange={(e) =>
                              store.updateProject(
                                'edit prologue',
                                (proj) => ({
                                  ...proj,
                                  storybook: {
                                    ...(proj.storybook ?? defaultStorybookConfig()),
                                    prologueText: e.target.value,
                                  },
                                }),
                                false
                              )
                            }
                            placeholder="Prologue narration…"
                            className="w-full px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-[11px] resize-none"
                          />
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Objectives */}
                <div className="space-y-1.5">
                  <FieldLabel text="Goals shown to player" />
                  {currentLevel.objectives.map((obj) => (
                    <div
                      key={obj.id}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-[11px]"
                    >
                      <span className="truncate">{obj.text}</span>
                      <button
                        type="button"
                        onClick={() =>
                          store.updateLevel('remove goal', (lvl) => ({
                            ...lvl,
                            objectives: lvl.objectives.filter((o) => o.id !== obj.id),
                          }))
                        }
                        className="text-slate-400 hover:text-[#F2545B]"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={newObjective}
                      onChange={(e) => setNewObjective(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddObjective();
                      }}
                      placeholder="Add a goal…"
                      className="flex-1 px-2.5 py-1 rounded-xl bg-white dark:bg-[#171A23] text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleAddObjective}
                      className="px-2.5 py-1 rounded-xl bg-[#7C5CFF] text-white text-[11px] font-bold"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Start / Portal / Reset */}
                <div className="space-y-1.5 pt-1 border-t border-slate-200/70 dark:border-white/[0.06]">
                  <label className="flex items-center justify-between text-xs font-semibold cursor-pointer">
                    <span>Hero start spot</span>
                    <input
                      type="checkbox"
                      checked={currentLevel.hasStart}
                      onChange={(e) =>
                        store.updateLevel('toggle start', (lvl) => ({
                          ...lvl,
                          hasStart: e.target.checked,
                        }))
                      }
                      className="accent-[#7C5CFF] w-4 h-4"
                    />
                  </label>
                  <label className="flex items-center justify-between text-xs font-semibold cursor-pointer">
                    <span>Exit portal</span>
                    <input
                      type="checkbox"
                      checked={currentLevel.hasPortal}
                      onChange={(e) =>
                        store.updateLevel('toggle portal', (lvl) => ({
                          ...lvl,
                          hasPortal: e.target.checked,
                        }))
                      }
                      className="accent-[#7C5CFF] w-4 h-4"
                    />
                  </label>
                  <label className="flex items-center justify-between gap-2 text-xs font-semibold cursor-pointer">
                    <span>Fog of War (hide untravelled map)</span>
                    <input
                      type="checkbox"
                      checked={Boolean(currentProject.worldMapFogOfWar)}
                      onChange={(e) =>
                        store.updateProject('toggle map fog of war', (proj) => ({
                          ...proj,
                          worldMapFogOfWar: e.target.checked,
                        }))
                      }
                      className="accent-[#38BDF8] w-4 h-4 shrink-0"
                    />
                  </label>
                  {envType === 'openWorld' && (
                    <button
                      type="button"
                      onClick={() => store.resetTerrain()}
                      className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-xs font-semibold text-slate-600 dark:text-[#949BB0] hover:text-[#F2545B]"
                    >
                      <RotateCcw size={12} />
                      <span>Reset world ground</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
              </>
            )}
          />
        )
      )}

      {/* Center: Docked Viewport Header + Optional Guided Hint + Canvas + Lightweight Bottom Bar */}
      <main
        className={`shrink-0 lg:shrink lg:flex-1 lg:h-full lg:min-h-0 lg:min-w-0 flex flex-col lg:overflow-hidden ${
          showLeftPanel ? 'p-2.5 sm:p-3 gap-2' : 'p-2 gap-2'
        }`}
      >
        {/* Docked Top Viewport Control Bar (never overlaps the map or 3D scene) */}
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#151822] border border-slate-200/80 dark:border-white/[0.08]">
          <div className="flex flex-wrap items-center gap-1.5">
            {!showLeftPanel && (
              <button
                type="button"
                onClick={() => setLeftPanelOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-extrabold bg-[#6D4AFF]/12 text-[#6D4AFF] dark:text-[#C4B5FD] border border-[#6D4AFF]/25 whitespace-nowrap"
              >
                <PanelLeftOpen size={13} />
                <span>{isWorldMapScope ? 'World Brushes' : 'Build Tools'}</span>
              </button>
            )}

            {envType === 'openWorld' && (
              <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-[#10131C] border border-slate-200/80 dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => {
                    store.setWorldViewMode('3d');
                    publishGuidanceHint({
                      badge: 'Viewport',
                      title: '3D View Active',
                      detail: 'Right-drag or Alt-drag to orbit, scroll to zoom, and sculpt or drop items directly in 3D.',
                    });
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-extrabold transition-colors whitespace-nowrap ${
                    store.worldViewMode === '3d'
                      ? 'bg-[#6D4AFF] text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Eye size={13} />
                  <span>3D View</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    store.setWorldViewMode('2d');
                    if (store.activeWorldDomain === 'buildings') {
                      store.setActiveWorldDomain('select');
                    }
                    if (tool === 'add' && addPaletteMode === 'blocks') {
                      setTool('move');
                    }
                    publishGuidanceHint({
                      badge: 'Viewport',
                      title: '2D Top-Down Map View',
                      detail: isWorldMapScope
                        ? 'Paint continents and colored territories directly from above. Double-click any Land to open it.'
                        : 'Paint terrain, water, caves, and roads from above. Shift+Drag pans and Scroll zooms.',
                    });
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-extrabold transition-colors whitespace-nowrap ${
                    store.worldViewMode === '2d'
                      ? 'bg-[#16A34A] text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <MapIcon size={13} />
                  <span>2D Map</span>
                </button>
              </div>
            )}

            {store.worldViewMode === '3d' ? (
              <>
                <div className="inline-flex items-center gap-0.5 p-0.5 rounded-xl bg-slate-100 dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-white">
                  <Compass size={12} className="mx-1.5 text-slate-400" />
                  {(
                    [
                      { id: 'iso', label: 'Iso' },
                      { id: 'top', label: 'Top' },
                      { id: 'north', label: 'N' },
                      { id: 'east', label: 'E' },
                    ] as const
                  ).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setCameraPresetRequest({ preset: p.id, nonce: Date.now() + Math.random() });
                        publishGuidanceHint({
                          badge: 'Camera',
                          title: `${p.label} Camera View`,
                          detail: 'Snapped camera framing. Right-drag to orbit freely or press Lock Angle (L) to keep it fixed.',
                        });
                      }}
                      className="px-2 py-1 rounded-lg text-[10px] font-extrabold hover:bg-slate-200/70 dark:hover:bg-white/15 transition-colors"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const nextLocked = !store.cameraAngleLocked;
                    store.setCameraAngleLocked(nextLocked);
                    publishGuidanceHint({
                      badge: 'Camera',
                      title: nextLocked ? 'Camera Angle Locked' : 'Camera Angle Unlocked',
                      detail: nextLocked
                        ? 'Orbit rotation is locked so brushing and dropping props never shifts your view (press L to unlock).'
                        : 'Free camera orbit restored. Right-drag or middle-drag to rotate around your land.',
                    });
                  }}
                  title="Lock camera orbit/pan while placing details (Shortcut: L)"
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold border transition-colors whitespace-nowrap ${
                    store.cameraAngleLocked
                      ? 'bg-[#F59E0B] border-[#F59E0B] text-white'
                      : 'bg-slate-100 dark:bg-[#12151E] border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {store.cameraAngleLocked ? <Lock size={11} /> : <Unlock size={11} />}
                  <span>{store.cameraAngleLocked ? 'Angle Locked (L)' : 'Lock Angle (L)'}</span>
                </button>
              </>
            ) : (
              <span className="hidden xl:inline text-[11px] font-medium text-slate-500 dark:text-[#8E96AB] pl-1">
                Shift+Drag or Right-Drag to pan · Scroll to zoom
                {isWorldMapScope ? ' · Double-click a Land to edit' : ''}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setHintsEnabled(!hintsEnabled)}
              title={hintsEnabled ? 'Hide guided workflow hints' : 'Show guided workflow hints'}
              aria-pressed={hintsEnabled}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-colors whitespace-nowrap ${
                hintsEnabled
                  ? 'bg-[#6366F1]/12 border-[#6366F1]/30 text-[#4F46E5] dark:text-[#A5B4FC]'
                  : 'bg-slate-100 dark:bg-[#12151E] border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <HelpCircle size={12} />
              <span>Hints</span>
            </button>

            {envType === 'openWorld' && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setScratchMenuOpen((v) => !v);
                    setLandMenuOpen(false);
                  }}
                  title="Start from a blank ocean world or reset the active land"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#12151E] hover:bg-slate-200/70 dark:hover:bg-[#1F2430] text-slate-800 dark:text-white text-[11px] font-bold border border-slate-200/80 dark:border-white/[0.08]"
                >
                  <RotateCcw size={12} className="text-[#F59E0B]" />
                  <span>New</span>
                </button>
                {scratchMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setScratchMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-1.5 w-60 rounded-2xl bg-white dark:bg-[#171A23] shadow-2xl border border-slate-200/80 dark:border-white/[0.1] p-2 space-y-1.5 z-30">
                      <div className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        Start from Scratch
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          store.startWorldFromScratch('world');
                          setScratchMenuOpen(false);
                        }}
                        className="w-full flex items-start gap-2 px-2.5 py-2 rounded-xl text-left hover:bg-rose-500/10 text-slate-800 dark:text-slate-100 transition-colors"
                      >
                        <Globe size={14} className="text-[#F2545B] shrink-0 mt-0.5" />
                        <span>
                          <span className="block text-xs font-extrabold text-[#F2545B]">
                            Blank Ocean World
                          </span>
                          <span className="block text-[10px] text-slate-500 dark:text-[#949BB0]">
                            Clear everything and paint landmasses from zero
                          </span>
                        </span>
                      </button>
                      {!isWorldMapScope && (
                        <button
                          type="button"
                          onClick={() => {
                            store.startWorldFromScratch('currentLand');
                            setScratchMenuOpen(false);
                          }}
                          className="w-full flex items-start gap-2 px-2.5 py-2 rounded-xl text-left hover:bg-amber-500/10 text-slate-800 dark:text-slate-100 transition-colors"
                        >
                          <Eraser size={14} className="text-[#F59E0B] shrink-0 mt-0.5" />
                          <span>
                            <span className="block text-xs font-extrabold">
                              Reset Current Land
                            </span>
                            <span className="block text-[10px] text-slate-500 dark:text-[#949BB0]">
                              Flatten sculpting &amp; remove props in {currentLevel.name}
                            </span>
                          </span>
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowingMap(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#12151E] hover:bg-slate-200/70 dark:hover:bg-[#1F2430] text-slate-800 dark:text-white text-[11px] font-bold border border-slate-200/80 dark:border-white/[0.08]"
            >
              <MapIcon size={12} className="text-[#7C5CFF]" />
              <span>Map</span>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setLandMenuOpen((v) => !v);
                  setScratchMenuOpen(false);
                }}
                data-testid="world-scope-dropdown"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-[#12151E] hover:bg-slate-800 dark:hover:bg-[#1F2430] text-white text-[11px] font-extrabold border transition-all ${
                  hintsEnabled && isWorldMapScope && hasWorldTerrain
                    ? 'border-[#6366F1] ring-2 ring-[#6366F1]/45'
                    : 'border-slate-700 dark:border-white/[0.12]'
                }`}
                title="Switch, add, or manage Lands and Levels"
              >
                {isWorldMapScope ? (
                  <Globe size={12} style={{ color: WORLD_TERRAIN_YELLOW }} />
                ) : activeRegion ? (
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-white/40 shrink-0"
                    style={{ backgroundColor: activeRegion.colorHex }}
                  />
                ) : (
                  <MapIcon size={12} className="text-[#7C5CFF]" />
                )}
                <span className="max-w-[120px] truncate">
                  {isWorldMapScope ? 'World Map' : currentLevel.name}
                </span>
                <ChevronDown size={12} className="opacity-75" />
              </button>

              {landMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setLandMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-1.5 w-64 rounded-2xl bg-white dark:bg-[#171A23] shadow-2xl border border-slate-200/80 dark:border-white/[0.1] p-1.5 space-y-1 z-30">
                    {envType === 'openWorld' && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            store.enterWorldEditorScope('worldMap');
                            setLandMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left text-xs font-extrabold transition-colors ${
                            isWorldMapScope
                              ? 'bg-[#7C5CFF]/15 text-[#7C5CFF]'
                              : 'hover:bg-slate-100 dark:hover:bg-[#1F2430] text-slate-800 dark:text-slate-100'
                          }`}
                        >
                          <Globe size={13} style={{ color: WORLD_TERRAIN_YELLOW }} />
                          <span className="flex-1 truncate">World Map (Overview)</span>
                          {isWorldMapScope && <Check size={12} />}
                        </button>
                        <div className="my-1 border-t border-slate-200/70 dark:border-white/[0.08]" />
                      </>
                    )}

                    <div className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      {envType === 'openWorld'
                        ? `Lands & Levels (${wmRegions.length + extraNonRegionLevels.length})`
                        : `Levels (${currentProject.levels.length})`}
                    </div>

                    {envType === 'openWorld' ? (
                      wmRegions.length === 0 && extraNonRegionLevels.length === 0 ? (
                        <div className="px-2.5 py-2 text-[11px] text-slate-500 dark:text-[#949BB0]">
                          Paint yellow terrain, then name your first Land below.
                        </div>
                      ) : (
                        <div className="max-h-56 overflow-y-auto maker-scroll space-y-0.5">
                          {wmRegions.map((reg) => {
                            const active = !isWorldMapScope && currentLevel.id === reg.levelId;
                            return (
                              <button
                                key={reg.id}
                                type="button"
                                onClick={() => {
                                  store.enterWorldEditorScope(reg.levelId);
                                  setLandMenuOpen(false);
                                }}
                                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-left text-xs font-bold transition-colors ${
                                  active
                                    ? 'bg-[#7C5CFF]/15 text-[#7C5CFF]'
                                    : 'hover:bg-slate-100 dark:hover:bg-[#1F2430] text-slate-700 dark:text-slate-200'
                                }`}
                              >
                                <span
                                  className="w-3 h-3 rounded-sm border border-black/20 shrink-0"
                                  style={{ backgroundColor: reg.colorHex }}
                                />
                                <span className="flex-1 truncate">{reg.name}</span>
                                {active && <Check size={12} />}
                              </button>
                            );
                          })}
                          {extraNonRegionLevels.map((lvl) => {
                            const active = !isWorldMapScope && currentLevel.id === lvl.id;
                            return (
                              <button
                                key={lvl.id}
                                type="button"
                                onClick={() => {
                                  store.enterWorldEditorScope(lvl.id);
                                  setLandMenuOpen(false);
                                }}
                                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-left text-xs font-bold transition-colors ${
                                  active
                                    ? 'bg-[#7C5CFF]/15 text-[#7C5CFF]'
                                    : 'hover:bg-slate-100 dark:hover:bg-[#1F2430] text-slate-700 dark:text-slate-200'
                                }`}
                              >
                                <MapIcon size={12} className="text-slate-400 shrink-0" />
                                <span className="flex-1 truncate">{lvl.name}</span>
                                {active && <Check size={12} />}
                              </button>
                            );
                          })}
                        </div>
                      )
                    ) : (
                      <div className="max-h-56 overflow-y-auto maker-scroll space-y-0.5">
                        {currentProject.levels.map((lvl, idx) => {
                          const active = lvl.id === currentLevel.id;
                          return (
                            <button
                              key={lvl.id}
                              type="button"
                              onClick={() => {
                                store.enterWorldEditorScope(lvl.id);
                                setLandMenuOpen(false);
                              }}
                              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-left text-xs font-bold transition-colors ${
                                active
                                  ? 'bg-[#7C5CFF]/15 text-[#7C5CFF]'
                                  : 'hover:bg-slate-100 dark:hover:bg-[#1F2430] text-slate-700 dark:text-slate-200'
                              }`}
                            >
                              <span className="w-4 text-[11px] text-slate-400 tabular-nums">
                                {idx + 1}.
                              </span>
                              <span className="flex-1 truncate">{lvl.name}</span>
                              {active && <Check size={12} />}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {envType === 'openWorld' ? (
                      <div className="pt-1 border-t border-slate-200/70 dark:border-white/[0.08] flex gap-1 px-1 pb-0.5">
                        <input
                          type="text"
                          value={quickLandName}
                          onChange={(e) => setQuickLandName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              store.addWorldLandRegion(quickLandName.trim() || undefined);
                              setQuickLandName('');
                              setTool('terrain');
                            }
                          }}
                          placeholder={`New Land ${wmRegions.length + 1}…`}
                          className="flex-1 min-w-0 px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-xs font-semibold outline-none focus:ring-1 focus:ring-[#7C5CFF]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            store.addWorldLandRegion(quickLandName.trim() || undefined);
                            setQuickLandName('');
                            setTool('terrain');
                          }}
                          className="px-2 py-1 rounded-lg bg-[#7C5CFF] text-white text-[11px] font-extrabold shrink-0"
                        >
                          + Land
                        </button>
                      </div>
                    ) : (
                      <div className="pt-1 border-t border-slate-200/70 dark:border-white/[0.08]">
                        <button
                          type="button"
                          onClick={() => {
                            store.addLevel();
                            setLandMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-left text-xs font-bold text-[#7C5CFF] hover:bg-[#7C5CFF]/10"
                        >
                          <Plus size={13} />
                          <span>Add a level</span>
                        </button>
                      </div>
                    )}

                    {!isWorldMapScope && currentProject.levels.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          store.deleteCurrentLevel();
                          setLandMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-left text-xs font-bold text-[#F2545B] hover:bg-[#F2545B]/10"
                      >
                        <Trash2 size={13} />
                        <span>Delete current level</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <WorldGuidanceBanner
          visible={hintsEnabled}
          isWorldMapScope={isWorldMapScope}
          hasWorldTerrain={hasWorldTerrain}
          landCount={wmRegions.length}
          firstLandName={wmRegions[0]?.name}
          currentLandName={currentLevel.name}
          envType={envType}
          gameplayMode={currentLevel.gameplayMode}
          leftActiveTab={leftActiveTab}
          activeWorldDomain={store.activeWorldDomain}
          atmosphereSection={atmosphereSection}
          onDismiss={() => setHintsEnabled(false)}
          onJumpToLands={
            isWorldMapScope && hasWorldTerrain
              ? () => {
                  const target = wmRegions[0] ?? store.addWorldLandRegion('Land 1');
                  if (target) {
                    store.enterWorldEditorScope(target.levelId);
                  }
                }
              : undefined
          }
        />

        <div className="h-[420px] sm:h-[480px] lg:h-auto lg:flex-1 min-h-[280px] rounded-2xl overflow-hidden border border-slate-200/80 dark:border-white/[0.1] shadow-sm relative bg-[#0B0F1A]">
          {!store.isPlaying &&
            (store.worldViewMode === '2d' && envType === 'openWorld' ? (
              <Overview2DPainter
                store={store}
                activePlacementAssetId={activePlacementAssetId}
                isPlacingHero={activeTool === 'add' && dropPreset === 'heroStart'}
                syncedLandTool={syncedLandTool}
                onLandToolChange={(nextTool) => {
                  if (nextTool === 'plants') {
                    store.setActiveWorldDomain('flora');
                    setTool('terrain');
                    setBrush('scatterPlant');
                  } else if (nextTool === 'wildflowers') {
                    store.setActiveWorldDomain('flora');
                    setTool('terrain');
                    setBrush('scatterFlower');
                  } else if (nextTool === 'rocks') {
                    store.setActiveWorldDomain('flora');
                    setTool('terrain');
                    setBrush('scatterRock');
                  } else if (
                    nextTool === 'coniferWoods' ||
                    nextTool === 'deciduousWoods' ||
                    nextTool === 'bushes'
                  ) {
                    store.setActiveWorldDomain('flora');
                    setTool('terrain');
                    setBrush('scatterTree');
                  }
                }}
                syncedWorldMapSelectMode={worldMapSelectMode}
                onWorldMapSelectModeChange={setWorldMapSelectMode}
                hideWorldMapToolbar
                onPlacedHeroFrom2D={() => {
                  setDropPreset(null);
                  setTool('move');
                }}
                onPlaceCustomAssetAtWorldPoint={(assetId, wx, wz) => {
                  const bp = store.placeWorldPointBoardHelper(wx, wz);
                  placeCustomAssetAtPoint(assetId, bp);
                }}
                onSelectEntityFrom2D={(id) => {
                  store.setSelectedEntityID(id);
                  store.setActiveWorldDomain('select');
                }}
              />
            ) : (
              <WorldViewport3D
                project={currentProject}
                level={currentLevel}
                customAssets={store.customAssets}
                selectedEntityID={store.selectedEntityID}
                playerPin={store.playFromPoint}
                tool={activeTool}
                brush={brush}
                brushRadius={brushRadius}
                brushFalloff={store.terrainBrushFalloff}
                gridSnap={store.worldGridSnap}
                isPlacingBuildingBlock={
                  activeTool === 'add' && addPaletteMode === 'blocks' && !activePlaceFxTemplate
                }
                placementGhostSize={placementGhostSize}
                placementGhostRotation={placementGhostRotation}
                resolutionScale={store.viewportResolutionScale}
                shadowQuality={store.viewportShadowQuality}
                terrainQuality={store.terrainQuality}
                cameraAngleLocked={store.cameraAngleLocked}
                cameraFocusRequest={store.cameraFocusRequest}
                cameraPresetRequest={cameraPresetRequest}
                activeWorldDomain={store.activeWorldDomain}
                selectedWaterBodyId={store.selectedWaterBodyId}
                selectedCaveId={store.selectedCaveId}
                worldMap={wm}
                worldEditorScope={store.worldEditorScope}
                activeWorldRegionCode={store.activeWorldRegionCode}
                worldMapBrushMode={store.worldMapBrushMode}
                selectedWorldLandCode={store.selectedWorldLandCode}
                renderPaused={
                  store.treeMakerOpen ||
                  store.showingTextureStudio ||
                  store.objectMakerOpen ||
                  store.plantMakerOpen ||
                  store.characterMakerOpen ||
                  store.monsterMakerOpen ||
                  store.vertexPaintTarget !== null ||
                  store.attributeModifierTarget !== null ||
                  showingMap ||
                  store.showingSkybox ||
                  store.showingPostFx
                }
                buildingCurveGuide={
                  activeTool === 'add' && addPaletteMode === 'blocks' && curveGuideEnabled
                    ? {
                        enabled: true,
                        curve: buildingCurve,
                        blockCount: curveBlockCount,
                        blockSize: placementGhostSize,
                        elevationY: 0,
                        pickMode: curvePickMode,
                      }
                    : null
                }
                onPickBuildingCurvePoint={handlePickBuildingCurvePoint}
                onDropCustomAsset={placeCustomAssetAtPoint}
                onSelectEntity={(id) => {
                  store.setSelectedEntityID(id);
                  if (id) store.setActiveWorldDomain('select');
                }}
                onSelectWaterBody={(id) => {
                  store.setSelectedWaterBodyId(id);
                  if (id) {
                    store.setSelectedEntityID(null);
                    store.setActiveWorldDomain('water');
                  }
                }}
                onSelectCave={(id) => {
                  store.setSelectedCaveId(id);
                  if (id) {
                    store.setSelectedEntityID(null);
                    store.setActiveWorldDomain('caves');
                  }
                }}
                onSelectWorldLandFrom3D={(code) => {
                  store.setSelectedWorldLandCode(code);
                }}
                onMoveEntity={(id, pos, elev) => store.moveEntity(id, pos, false, elev)}
                onRotateEntity={(id, deg) => {
                  const rounded = Math.round(deg);
                  if (id === HERO_START_ENTITY_ID) {
                    store.rotateHeroStart(rounded, false);
                    return;
                  }
                  store.updateEntity(
                    id,
                    'rotate item',
                    (e) => ({ ...e, rotation: rounded }),
                    false
                  );
                  if (keepToolAdjustments && id === store.selectedEntityID) {
                    const ent = currentLevel.entities.find((item) => item.id === id);
                    if (ent && (ent.buildingBlock || ent.kind === 'door')) {
                      setActiveBlockAdjustments((prev) => ({ ...prev, rotation: rounded }));
                    }
                  }
                }}
                onRotateActiveTool={(deltaDeg) => {
                  if (!keepToolAdjustments) setKeepToolAdjustments(true);
                  setActiveBlockAdjustments((prev) => ({
                    ...prev,
                    rotation: (Math.round((prev.rotation + deltaDeg) / 45) * 45 + 360) % 360,
                  }));
                }}
                onScaleEntity={(id, sc) => {
                  store.updateEntity(id, 'resize item', (e) => ({ ...e, scale: sc }), false);
                  if (keepToolAdjustments && id === store.selectedEntityID) {
                    const ent = currentLevel.entities.find((item) => item.id === id);
                    if (ent && (ent.buildingBlock || ent.kind === 'door')) {
                      setActiveBlockAdjustments((prev) => ({ ...prev, scale: sc }));
                    }
                  }
                }}
                onWorldMapBrushStroke={(x, z, meta) =>
                  store.applyWorldMapBrushStroke(
                    store.worldMapBrushMode,
                    x,
                    z,
                    brushRadius,
                    meta?.isStart ?? false,
                    meta?.isStart ?? false
                  )
                }
                brushStrength={store.terrainBrushStrength}
                onBrushStroke={(x, z, meta) => {
                  const floraCfg = resolveFloraScatterSettings(
                    currentLevel.terrain?.floraScatterSettings
                  );
                  const activeFlowerKeys = getActiveFlowerVariantKeys(floraCfg);
                  const activePlantKeys = getActivePlantVariantKeys(floraCfg);
                  store.applyBrush(
                    brush,
                    x,
                    z,
                    brushRadius,
                    meta?.isStart ?? false,
                    brush === 'scatterCustom' ? activeScatterAssetId : undefined,
                    {
                      strength: store.terrainBrushStrength,
                      falloff: store.terrainBrushFalloff,
                      flattenHeight:
                        store.terrainFlattenHeight !== null
                          ? store.terrainFlattenHeight
                          : meta?.sampledHeight,
                      ...(brush === 'scatterRock' ? { rockConfig: floraCfg.rocks } : {}),
                      ...(brush === 'scatterFlower'
                        ? {
                            botanicalVariantKey: activeFlowerKeys[0],
                            botanicalVariantKeys: activeFlowerKeys,
                          }
                        : {}),
                      ...(brush === 'scatterPlant'
                        ? {
                            botanicalVariantKey: activePlantKeys[0],
                            botanicalVariantKeys: activePlantKeys,
                          }
                        : {}),
                    }
                  );
                }}
                onCommitCaveStroke={(stroke) => store.commitCaveStroke(stroke)}
                fxBurstSignal={fxBurstSignal}
                fxPaused={store.isPlaying}
                draggingFxTemplate={
                  draggingFxTemplate
                    ? {
                        id: draggingFxTemplate.id,
                        name: draggingFxTemplate.name,
                        accentHex: draggingFxTemplate.accentHex,
                      }
                    : null
                }
                onDropFxTemplate={handleDropFxTemplate}
                onDropPlatformerModule={placePlatformerModuleAtPoint}
                onAddAtPoint={(pos, elev) => {
                  if (activePlaceFxTemplate) {
                    store.addFxTemplateAtPoint(activePlaceFxTemplate, pos);
                    setPlaceFxTemplateId(null);
                    setTool('move');
                  } else if (placePlatformerModuleId) {
                    placePlatformerModuleAtPoint(placePlatformerModuleId, pos, elev);
                  } else if (activePlacementAssetId) {
                    placeCustomAssetAtPoint(activePlacementAssetId, pos, elev);
                  } else if (addPaletteMode === 'blocks') {
                    if (keepToolAdjustments) {
                      const isDoor =
                        activeBuildShape === 'door' || activeBuildShape === 'rusticDoor';
                      const bbPatch: Partial<BuildingBlockConfig> = !isDoor
                        ? {
                            ...(activeBlockAdjustments.scaleX !== 1
                              ? { scaleX: activeBlockAdjustments.scaleX }
                              : {}),
                            ...(activeBlockAdjustments.scaleY !== 1
                              ? { scaleY: activeBlockAdjustments.scaleY }
                              : {}),
                            ...(activeBlockAdjustments.scaleZ !== 1
                              ? { scaleZ: activeBlockAdjustments.scaleZ }
                              : {}),
                            ...(activeBlockAdjustments.edgeWear > 0 ||
                            activeBuildMaterial === 'sandstone'
                              ? { edgeWear: activeBlockAdjustments.edgeWear }
                              : {}),
                            ...(activeBuildShape === 'archway' && activeBlockAdjustments.archStyle
                              ? { archStyle: activeBlockAdjustments.archStyle }
                              : {}),
                            ...(activeBuildShape === 'windowWall' &&
                            activeBlockAdjustments.windowStyle
                              ? { windowStyle: activeBlockAdjustments.windowStyle }
                              : {}),
                            ...(activeBuildShape === 'roofAFrame' ||
                            activeBuildShape === 'roofSlope'
                              ? {
                                  ...(activeBlockAdjustments.roofStyle
                                    ? { roofStyle: activeBlockAdjustments.roofStyle }
                                    : {}),
                                  ...(activeBlockAdjustments.roofMedievalTruss !== undefined
                                    ? {
                                        roofMedievalTruss: activeBlockAdjustments.roofMedievalTruss,
                                      }
                                    : {}),
                                }
                              : {}),
                            ...(activeBuildShape === 'roofGable' &&
                            activeBlockAdjustments.roofMedievalTruss !== undefined
                              ? { roofMedievalTruss: activeBlockAdjustments.roofMedievalTruss }
                              : {}),
                            ...(activeBuildShape === 'fence' && activeBlockAdjustments.fenceStyle
                              ? { fenceStyle: activeBlockAdjustments.fenceStyle }
                              : {}),
                            ...((activeBuildShape === 'beamLarge' ||
                              activeBuildShape === 'beamSmall' ||
                              activeBuildShape === 'plankTrim') &&
                            activeBlockAdjustments.beamOrientation
                              ? { beamOrientation: activeBlockAdjustments.beamOrientation }
                              : {}),
                          }
                        : {};
                      store.addBuildingBlockEntity(activeBuildShape, activeBuildMaterial, pos, {
                        elevationY: elev,
                        rotation: activeBlockAdjustments.rotation,
                        scale: activeBlockAdjustments.scale,
                        ...(isDoor && activeBlockAdjustments.doorConfig
                          ? {
                              doorConfig: {
                                ...activeBlockAdjustments.doorConfig,
                                frameMaterial: activeBuildMaterial,
                              },
                            }
                          : { buildingBlockPatch: bbPatch }),
                        ...(activeBlockAdjustments.materialVariant
                          ? { materialVariant: { ...activeBlockAdjustments.materialVariant } }
                          : {}),
                      });
                    } else {
                      store.addBuildingBlockEntity(activeBuildShape, activeBuildMaterial, pos, {
                        elevationY: elev,
                      });
                    }
                  } else if (dropCustomAssetId) {
                    placeCustomAssetAtPoint(dropCustomAssetId, pos, elev);
                  } else if (dropPreset === 'heroStart') {
                    store.moveEntity(HERO_START_ENTITY_ID, pos, true);
                    store.setSelectedEntityID(HERO_START_ENTITY_ID);
                    store.setActiveWorldDomain('select');
                    setDropPreset(null);
                    setTool('move');
                  } else if (dropPreset === 'savePlinth') {
                    const created = store.addEntity(
                      'checkpoint',
                      'Save Plinth',
                      pos,
                      currentProject.savePlinthAssetId
                    );
                    if (created) {
                      store.updateEntity(
                        created.id,
                        'configure save plinth',
                        (ent) => ({ ...ent, propPreset: 'savePlinth' }),
                        false
                      );
                    }
                    setDropPreset(null);
                    setTool('move');
                  } else {
                    const meta = EntityKindMeta[dropKind];
                    store.addEntity(dropKind, meta.defaultName, pos);
                    setTool('move');
                  }
                }}
              />
            ))}
        </div>

        {/* Bottom Precision & Viewport Action Bar (Land/Level scope only; World Map stays clean in Left Panel) */}
        {!isWorldMapScope && (
        <div className="shrink-0 space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#151822] border border-slate-200/80 dark:border-white/[0.08]">
            {/* Transform & Drop Tools */}
            <div className="inline-flex items-center gap-1 p-0.5 rounded-xl bg-slate-100 dark:bg-[#10131C] border border-slate-200/70 dark:border-white/[0.07]">
              {(
                [
                  { id: 'move', label: 'Move', Icon: Move, hint: 'Click any prop, character, or building in the scene and drag to reposition it (hold Alt/Shift for height).' },
                  { id: 'rotate', label: 'Turn', Icon: RotateCw, hint: 'Click an item and drag horizontally or adjust Yaw on the right to rotate it.' },
                  { id: 'scale', label: 'Resize', Icon: Scaling, hint: 'Select an item and drag or use the right panel Size sliders to scale it up or down.' },
                  { id: 'add', label: 'Drop', Icon: Plus, hint: 'Pick a quick item below or drag any asset from Props & Cast on the left, then click the scene to place.' },
                ] as const
              ).map((t) => {
                const Icon = t.Icon;
                const active = activeTool === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTool(t.id);
                      if (t.id !== 'add') {
                        setPlaceFxTemplateId(null);
                        setActivePlacementAssetId(null);
                        setDropPreset(null);
                        setPlacePlatformerModuleId(null);
                        if (
                          store.activeWorldDomain !== 'buildings' &&
                          store.activeWorldDomain !== 'platformerKit'
                        ) {
                          store.setActiveWorldDomain('select');
                        }
                      } else {
                        setAddPaletteMode('entities');
                      }
                      publishGuidanceHint({
                        badge: 'Viewport Tool',
                        title: `${t.label} Tool`,
                        detail: t.hint,
                      });
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-[#6D4AFF] text-white shadow-xs'
                        : 'text-slate-600 dark:text-[#9FA8BE] hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon size={13} />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Active Brush Quick Size (when sculpting terrain) + Snap */}
            <div className="flex flex-wrap items-center gap-2">
              {activeTool === 'terrain' && envType === 'openWorld' && (
                <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-[#10131C] border border-slate-200/70 dark:border-white/[0.07] text-xs font-bold">
                  <span className="text-slate-500 dark:text-[#949BB0]">Brush</span>
                  <input
                    type="range"
                    min={4}
                    max={48}
                    step={2}
                    value={brushRadius}
                    onPointerDown={() =>
                      publishGuidanceHint({
                        badge: 'Brush Size',
                        title: `Terrain Brush Radius (${brushRadius}m)`,
                        detail: 'Slide left for fine paths and detail carving, or right for broad hills, lakes, and meadows.',
                      })
                    }
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setBrushRadius(val);
                      publishGuidanceHint({
                        badge: 'Brush Size',
                        title: `Terrain Brush Radius (${val}m)`,
                        detail: 'Slide left for fine paths and detail carving, or right for broad hills, lakes, and meadows.',
                      });
                    }}
                    className="w-20 accent-[#6D4AFF]"
                  />
                  <span className="tabular-nums w-9 text-right text-[#6D4AFF] dark:text-[#A5B4FC]">
                    {brushRadius}m
                  </span>
                </div>
              )}

              <div className="inline-flex items-center gap-0.5 p-0.5 rounded-xl bg-slate-100 dark:bg-[#10131C] border border-slate-200/70 dark:border-white/[0.07]">
                <span className="px-2 text-[11px] font-bold text-slate-400">Snap</span>
                {([0, 0.5, 1, 2] as const).map((snapVal) => (
                  <button
                    key={snapVal}
                    type="button"
                    onClick={() => {
                      store.setWorldGridSnap(snapVal);
                      publishGuidanceHint({
                        badge: 'Grid Snap',
                        title: snapVal === 0 ? 'Free Placement (Snap Off)' : `Grid Snap: ${snapVal}m`,
                        detail:
                          snapVal === 0
                            ? 'Place walls, props, and platforms smoothly anywhere without grid locking.'
                            : `Snapping moved and dropped items every ${snapVal}m so structures align cleanly.`,
                      });
                    }}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                      store.worldGridSnap === snapVal
                        ? 'bg-[#16A34A] text-white'
                        : 'text-slate-500 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {snapVal === 0 ? 'Off' : `${snapVal}m`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Contextual Building Kit Tray (3D Land Edit mode only) */}
          {!isWorldMapScope &&
            store.worldViewMode === '3d' &&
            (store.activeWorldDomain === 'buildings' ||
              (activeTool === 'add' && addPaletteMode === 'blocks' && !activePlaceFxTemplate)) && (
            <div className="rounded-2xl bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.08] p-2 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex flex-wrap items-center gap-1">
                  {BUILDING_MATERIALS.map((mat) => (
                    <button
                      key={mat.id}
                      type="button"
                      onClick={() => setActiveBuildMaterial(mat.id)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                        activeBuildMaterial === mat.id
                          ? 'border-[#F59E0B] bg-[#F59E0B]/15 text-[#D97706] dark:text-[#FBBF24]'
                          : 'border-transparent bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#949BB0]'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-sm border border-black/25 shrink-0"
                        style={{ backgroundColor: mat.swatch }}
                      />
                      <span>{mat.label}</span>
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggleKeepToolAdjustments()}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-extrabold ${
                      keepToolAdjustments
                        ? 'bg-[#7C5CFF] text-white'
                        : 'bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#949BB0]'
                    }`}
                  >
                    <SlidersHorizontal size={11} />
                    <span>Keep: {keepToolAdjustments ? 'ON' : 'OFF'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurveGuideEnabled((v) => !v)}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-extrabold ${
                      curveGuideEnabled
                        ? 'bg-[#0EA5E9] text-white'
                        : 'bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#949BB0]'
                    }`}
                  >
                    <Spline size={11} />
                    <span>Curve ({Math.round(computeCurveLength(buildingCurve))}m)</span>
                  </button>
                </div>
              </div>

              <div className="flex gap-1 overflow-x-auto pb-0.5 maker-scroll">
                {BUILDING_SHAPES.map((shape) => (
                  <button
                    key={shape.id}
                    type="button"
                    onClick={() => {
                      setActiveBuildShape(shape.id);
                      setAddPaletteMode('blocks');
                      setTool('add');
                    }}
                    className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold border ${
                      activeBuildShape === shape.id
                        ? 'bg-[#7C5CFF] text-white border-[#7C5CFF]'
                        : 'bg-slate-100 dark:bg-[#1F2430] border-transparent text-slate-700 dark:text-[#C8D0E4]'
                    }`}
                  >
                    <Box size={11} />
                    <span>{shape.label}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setActiveBuildShape('rusticDoor');
                    setAddPaletteMode('blocks');
                    setTool('add');
                  }}
                  className={`shrink-0 px-2.5 py-1 rounded-xl text-[11px] font-bold border ${
                    activeBuildShape === 'rusticDoor'
                      ? 'bg-[#F59E0B] text-white border-[#F59E0B]'
                      : 'bg-slate-100 dark:bg-[#1F2430] border-transparent'
                  }`}
                >
                  Rustic Door
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveBuildShape('door');
                    setAddPaletteMode('blocks');
                    setTool('add');
                  }}
                  className={`shrink-0 px-2.5 py-1 rounded-xl text-[11px] font-bold border ${
                    activeBuildShape === 'door'
                      ? 'bg-[#20B46A] text-white border-[#20B46A]'
                      : 'bg-slate-100 dark:bg-[#1F2430] border-transparent'
                  }`}
                >
                  Modular Door
                </button>
              </div>
            </div>
          )}

          {/* Contextual Entity Quick-Drop Strip */}
          {!isWorldMapScope &&
            activeTool === 'add' &&
            addPaletteMode === 'entities' &&
            !placePlatformerModuleId &&
            !activePlaceFxTemplate &&
            store.activeWorldDomain !== 'buildings' && (
              <div className="rounded-2xl bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.08] p-2 flex gap-1.5 overflow-x-auto maker-scroll">
                <button
                  type="button"
                  onClick={() => {
                    setDropCustomAssetId('');
                    setActivePlacementAssetId(null);
                    setDropPreset('heroStart');
                  }}
                  className={`shrink-0 inline-flex items-center gap-1.5 pl-1 pr-2.5 py-0.5 rounded-xl text-[11px] font-bold border ${
                    dropPreset === 'heroStart'
                      ? 'bg-[#7C5CFF] text-white border-[#7C5CFF]'
                      : 'bg-[#7C5CFF]/12 text-[#7C5CFF] border-[#7C5CFF]/30'
                  }`}
                >
                  <AssetThumbnail
                    customAsset={heroCustomAsset}
                    hero={{
                      body: currentProject.heroBody,
                      colors: currentProject.heroColors,
                    }}
                    size={20}
                    rounded="rounded-lg"
                  />
                  <span>Hero ({currentProject.heroName})</span>
                </button>
                {DropKinds.map((k) => {
                  const meta = EntityKindMeta[k];
                  const active = !dropCustomAssetId && !dropPreset && dropKind === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        setDropCustomAssetId('');
                        setDropPreset(null);
                        setActivePlacementAssetId(null);
                        setDropKind(k);
                      }}
                      className={`shrink-0 inline-flex items-center gap-1.5 pl-1 pr-2.5 py-0.5 rounded-xl text-[11px] font-bold border ${
                        active
                          ? 'bg-[#7C5CFF] text-white border-[#7C5CFF]'
                          : 'bg-slate-100 dark:bg-[#1F2430] border-transparent'
                      }`}
                    >
                      <AssetThumbnail kind={k} size={20} rounded="rounded-lg" />
                      <span>{meta.defaultName}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    setDropCustomAssetId('');
                    setActivePlacementAssetId(null);
                    setDropKind('checkpoint');
                    setDropPreset('savePlinth');
                  }}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border ${
                    dropPreset === 'savePlinth'
                      ? 'bg-[#0EA5E9] text-white border-[#0EA5E9]'
                      : 'bg-[#0EA5E9]/12 text-[#0284C7] dark:text-[#38BDF8] border-[#38BDF8]/30'
                  }`}
                >
                  <Compass size={13} />
                  <span>Save Plinth</span>
                </button>
              </div>
            )}

          {!isWorldMapScope &&
            envType !== 'sideScroller' &&
            store.worldViewMode === '3d' &&
            (store.activeWorldDomain === 'platformerKit' ||
              (activeTool === 'add' && Boolean(placePlatformerModuleId))) && (
            <PlatformerKitPanel
              activeModuleId={placePlatformerModuleId}
              onSelectPlaceModule={(spec) => {
                if (spec) {
                  setPlaceFxTemplateId(null);
                  setActivePlacementAssetId(null);
                  setDropPreset(null);
                  setAddPaletteMode('entities');
                  setPlacePlatformerModuleId(spec.id);
                  setTool('add');
                } else {
                  setPlacePlatformerModuleId(null);
                  setTool('move');
                }
              }}
              onQuickPlaceCenter={(spec) => {
                const bx = 0.44 + Math.random() * 0.12;
                const bz = 0.44 + Math.random() * 0.12;
                placePlatformerModuleAtPoint(spec.id, { x: bx, y: bz });
              }}
              onClose={() => {
                setPlacePlatformerModuleId(null);
                store.setActiveWorldDomain('select');
                setTool('move');
              }}
            />
          )}

          {!isWorldMapScope && store.showingFxLibrary && (
            <FxLibraryPanel
              templates={allFxTemplates}
              activePlaceTemplateId={placeFxTemplateId}
              wideMode={!showLeftPanel}
              onSelectPlaceTemplate={(tpl) => {
                if (tpl) {
                  setPlaceFxTemplateId(tpl.id);
                  setTool('add');
                } else {
                  setPlaceFxTemplateId(null);
                  setTool('move');
                }
              }}
              onQuickPlaceCenter={(tpl) => {
                store.addFxTemplateAtPoint(tpl, {
                  x: 0.44 + Math.random() * 0.12,
                  y: 0.44 + Math.random() * 0.12,
                });
                setPlaceFxTemplateId(null);
                setTool('move');
              }}
              onDragStartTemplate={(tpl) => setDraggingFxTemplate(tpl)}
              onDragEndTemplate={() => setDraggingFxTemplate(null)}
              onDeleteCustomTemplate={handleDeleteCustomFxTemplate}
              onClose={() => store.setShowingFxLibrary(false)}
            />
          )}
        </div>
        )}
      </main>

      {/* Right Contextual World Domain / Entity Inspector */}
      <WorldDomainInspector
        store={store}
        activeTool={activeTool}
        setTool={setTool}
        brush={brush}
        setBrush={setBrush}
        brushRadius={brushRadius}
        setBrushRadius={setBrushRadius}
        activeScatterAssetId={activeScatterAssetId}
        setScatterAssetId={setScatterAssetId}
        addPaletteMode={addPaletteMode}
        activeBuildShape={activeBuildShape}
        setActiveBuildShape={setActiveBuildShape}
        activeBuildMaterial={activeBuildMaterial}
        setActiveBuildMaterial={setActiveBuildMaterial}
        keepToolAdjustments={keepToolAdjustments}
        toggleKeepToolAdjustments={toggleKeepToolAdjustments}
        activeBlockAdjustments={activeBlockAdjustments}
        setActiveBlockAdjustments={setActiveBlockAdjustments}
        captureEntityIntoActiveTool={captureEntityIntoActiveTool}
        curveGuideEnabled={curveGuideEnabled}
        setCurveGuideEnabled={setCurveGuideEnabled}
        buildingCurve={buildingCurve}
        setBuildingCurve={setBuildingCurve}
        curveSpan={curveSpan}
        setCurveSpan={setCurveSpan}
        curveBend={curveBend}
        setCurveBend={setCurveBend}
        curvePickMode={curvePickMode}
        setCurvePickMode={setCurvePickMode}
        curveBlockCount={curveBlockCount}
        setCurveBlockCount={setCurveBlockCount}
        applyBuildingCurvePreset={applyBuildingCurvePreset}
        handleStampBuildingCurveBlocks={handleStampBuildingCurveBlocks}
        placementGhostSize={placementGhostSize}
        onOpenChatBubbleForEntity={(entityId) => setChatBubbleTargetId(entityId)}
        onTriggerFxBurst={triggerFxBurst}
        onSaveEntityToFxLibrary={handleSaveEntityToFxLibrary}
        onAddVistaItem={handleAddVistaItem}
        atmosphereSection={atmosphereSection}
        allFxTemplates={allFxTemplates}
        placeFxTemplateId={placeFxTemplateId}
        onSelectPlaceFxTemplate={(tpl) => {
          if (tpl) {
            setPlaceFxTemplateId(tpl.id);
            setTool('add');
          } else {
            setPlaceFxTemplateId(null);
            setTool('move');
          }
        }}
        onQuickPlaceFxCenter={(tpl) => {
          store.addFxTemplateAtPoint(tpl, {
            x: 0.44 + Math.random() * 0.12,
            y: 0.44 + Math.random() * 0.12,
          });
          setPlaceFxTemplateId(null);
          setTool('move');
        }}
        onDragStartFxTemplate={(tpl) => setDraggingFxTemplate(tpl)}
        onDragEndFxTemplate={() => setDraggingFxTemplate(null)}
        isPlacingHero={activeTool === 'add' && dropPreset === 'heroStart'}
        onStartPlaceHero={() => focusHeroStart(true)}
      />

      {showingMap && (
        <LevelMapModal
          level={currentLevel}
          selectedEntityID={store.selectedEntityID}
          onSelectEntity={(id) => store.setSelectedEntityID(id)}
          onMoveEntity={(id, pos) => store.moveEntity(id, pos, true)}
          onClose={() => setShowingMap(false)}
        />
      )}

      {chatBubbleTargetId !== null && (
        <ChatBubbleStudioModal
          store={store}
          initialTarget={chatBubbleTargetId}
          onClose={() => setChatBubbleTargetId(null)}
        />
      )}
    </div>
  );
};
