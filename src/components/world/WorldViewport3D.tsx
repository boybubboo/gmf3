import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Hand } from 'lucide-react';
import * as THREE from 'three';
import type { WebGPURenderer } from 'three/webgpu';
import { uniform } from 'three/tsl';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ClusteredLighting } from 'three/addons/lighting/ClusteredLighting.js';
import { HERO_START_ENTITY_ID } from '../../types/maker';
import type {
  BoardPoint,
  CurveGuideConfig,
  CustomAssetMeta,
  LevelEntity,
  GameLevel,
  GameProject,
  PlatformerModuleId,
  StoryCameraShot,
  TerrainBrush,
  TerrainBrushFalloff,
  TerrainQualityTier,
  ViewportResolutionScale,
  ViewportShadowQuality,
  ViewportTool,
  WorldDomainId,
  WorldEditorScope,
  WorldMapData,
} from '../../types/maker';
import { buildCurveInstance, sampleCurveTransforms } from '../../three/curveGuide';
import { registerDirectorViewportBridge } from '../../utils/directorBridge';
import {
  IslandTerrain,
  createInitialTerrain,
  getEnvironmentType,
  getTerrainRadius,
  levelBoardToWorld,
  levelWorldToBoard,
  PlatformMotion,
  sampleLevelHeight,
  type CaveSplineStrokeInput,
} from '../../utils/terrain';
import {
  buildLiveCavePreviewGeometry,
  resampleCaveStrokePath,
  type CaveStrokePoint,
} from '../../three/caveSplineBuilder';
import { attachSunCSM, type CsmShadowHandle } from '../../three/csmShadowSetup';
import { WildlifeFlockingSystem } from '../../three/wildlifeFlockingSystem';
import {
  getWorldMapRadius,
  sampleWorldMapAtWorld,
  WORLD_TERRAIN_YELLOW,
  type WorldMapBrushMode,
} from '../../utils/worldMap';
import {
  applyVisualStyleToObject,
  getCachedAssetSync,
  instantiateCustomModel,
  loadCustomAssetToCache,
} from '../../three/gltfAssetManager';
import {
  applyAtmosphere,
  applyAtmosphereQualityToScene,
  applyLiveRendererQuality,
  buildIslandMesh,
  buildWeatherParticles,
  computeAtmosphereState,
  computeEffectivePixelRatio,
  createMakerRenderer,
  detectSoftwareGl,
  disposeObject3D,
  ensureSkyDome,
  initMakerRenderer,
  setupSceneEnvironment,
  syncSkyDomeToCamera,
  updateCaveInteractiveAnimations,
  updateIslandTerrainGeometryInPlace,
  updateRiverFishAnimations,
  updateSkyClouds,
  type IslandSceneHandles,
  type WorldMapRenderContext,
} from '../../three/islandScene';
import {
  forceReleaseRendererContext,
  getRendererMaxTextureArrayLayers,
  isIOSDevice,
  isWebGPUFallbackAdapter,
  sanitizeObjectMorphTargets,
} from '../../three/webglUtils';
import { createDefaultFxEmitterConfig } from '../../data/fxEmitterPresets';
import {
  buildSingleCanopyTreeGroup,
  computeWeatherWindFactor,
} from '../../three/canopyClusterBuilder';
import {
  collectReferencedTextureIds,
  getRawCustomTextureSync,
  loadCustomTextureToCache,
  subscribeCustomTextureInvalidation,
} from '../../three/customTextureManager';
import { FxEmitterRuntime } from '../../three/fxEmitterRuntime';
import { getBuildingBlockDimensions } from '../../three/buildingBlocks';
import { PostProcessingPipeline } from '../../three/postProcessingPipeline';
import { MechanismRuntimeController } from '../../three/mechanismController';
import {
  buildEntityMesh,
  buildHeroModel,
  buildPortalMarker,
  updateRpgLivingVillageAnimations,
} from '../../three/proceduralModels';
import { buildCarModel } from '../../three/vehicleModels';
import { applyVertexPaintStrokesToObject } from '../../three/vertexPainter';
import { createOptInMeshletPipeline, prepareObjectForMeshletCulling } from '../../three/meshletPipeline';
import {
  applyEntityMaterialVariant,
  stripLiveVariantFieldsForStructKey,
  updateEntityMaterialVariantInPlace,
} from '../../three/nodeMaterialUtils';
import { runDeferredChunks } from '../../utils/deferredLoader';
import { getDefaultTreeStylesSignature, useDefaultTreeStyles } from '../../utils/defaultTreeStyles';
import { readJsHeapUsageMB } from '../../utils/resourceMonitor';
import { isSavePlinthEntity } from '../../utils/worldMapFog';

import { FX_DRAG_MIME } from './FxLibraryPanel';
import { MAKER_ASSET_DRAG_MIME } from './LeftAssetsPanel';
import { PLATFORMER_MODULE_DRAG_MIME } from '../../data/platformerCatalog';

export interface TerrainBrushStrokeMeta {
  isStart: boolean;
  sampledHeight: number;
}

export interface BuildingCurveGuidePreview {
  enabled: boolean;
  curve: CurveGuideConfig;
  blockCount: number;
  blockSize: [number, number, number];
  elevationY?: number;
  pickMode?: boolean;
}

const HEIGHT_MODIFYING_BRUSHES = new Set<TerrainBrush>([
  'terrain',
  'raiseGround',
  'lowerGround',
  'smoothGround',
  'flattenGround',
  'plateauCliff',
  'carveRiver',
  'proceduralRidge',
  'proceduralMesa',
  'proceduralCrag',
  'hydraulicErosion',
  'weatherErode',
  'paintWaterLake',
  'paintRoad',
]);

function getBrushAccentHex(brush: TerrainBrush): string {
  switch (brush) {
    case 'terrain':
      return WORLD_TERRAIN_YELLOW;
    case 'raiseGround':
      return '#20B46A';
    case 'lowerGround':
      return '#F2545B';
    case 'flattenGround':
      return '#38BDF8';
    case 'smoothGround':
      return '#A855F7';
    case 'plateauCliff':
      return '#F59E0B';
    case 'carveRiver':
      return '#0EA5E9';
    case 'carveCave':
      return '#38BDF8';
    case 'cavePaintMoss':
      return '#4D8B4C';
    case 'cavePaintPuddles':
      return '#0EA5E9';
    case 'cavePaintGrass':
      return '#22C55E';
    case 'cavePaintStalactites':
      return '#94A3B8';
    case 'cavePaintCrystals':
      return '#67E8F9';
    case 'cavePlaceDrips':
      return '#38BDF8';
    case 'cavePlaceBats':
      return '#A855F7';
    case 'cavePlaceTorch':
      return '#F97316';
    case 'proceduralRidge':
      return '#EA580C';
    case 'proceduralMesa':
      return '#D97706';
    case 'proceduralCrag':
      return '#9333EA';
    case 'hydraulicErosion':
      return '#0284C7';
    case 'paintGrass':
      return '#20B46A';
    case 'paintGrassErase':
      return '#F97316';
    case 'paintDirt':
    case 'paintRoad':
      return '#D97706';
    case 'paintWaterLake':
      return '#0EA5E9';
    case 'weatherMoss':
      return '#4B8B3B';
    case 'weatherCracks':
      return '#78716C';
    case 'weatherErode':
      return '#D97706';
    case 'weatherScorch':
      return '#44403C';
    case 'weatherMud':
      return '#8B5E3C';
    case 'weatherFrost':
      return '#BAE6FD';
    case 'weatherClear':
      return '#E2E8F0';
    case 'scatterPlant':
      return '#10B981';
    default:
      return '#F59E0B';
  }
}

function getFalloffInnerRatio(falloff: TerrainBrushFalloff): number {
  switch (falloff) {
    case 'plateau':
      return 0.68;
    case 'dome':
      return 0.54;
    case 'peak':
      return 0.24;
    case 'smooth':
    default:
      return 0.42;
  }
}

const savedCameraPoseMap = new Map<
  string,
  { pos: [number, number, number]; target: [number, number, number] }
>();

function hasVillageAnimation(obj: THREE.Object3D): boolean {
  const ud = obj.userData;
  if (!ud) return false;
  return Boolean(
    ud.wanderingChicken ||
      ud.blacksmithHammerer ||
      ud.tavernPatrons ||
      ud.bartenderNpc ||
      ud.rakingVillager ||
      ud.tetheredHorses ||
      ud.spinningWaterwheel ||
      ud.spinningWindmillRotor ||
      ud.grazingCow ||
      ud.rootingPig
  );
}

interface WorldViewport3DProps {
  project: GameProject;
  level: GameLevel;
  customAssets: CustomAssetMeta[];
  selectedEntityID: string | null;
  playerPin?: BoardPoint | null;
  tool: ViewportTool;
  brush: TerrainBrush;
  brushRadius: number;
  brushStrength?: number;
  brushFalloff?: TerrainBrushFalloff;
  gridSnap?: 0 | 0.5 | 1 | 2;
  isPlacingBuildingBlock?: boolean;
  placementGhostSize?: [number, number, number];
  placementGhostRotation?: number;
  resolutionScale?: ViewportResolutionScale;
  shadowQuality?: ViewportShadowQuality;
  terrainQuality?: TerrainQualityTier;
  addKindName?: string;
  fxBurstSignal?: { entityId: string; nonce: number } | null;
  fxPaused?: boolean;
  renderPaused?: boolean;
  draggingFxTemplate?: { id: string; name: string; accentHex: string } | null;
  buildingCurveGuide?: BuildingCurveGuidePreview | null;
  cameraAngleLocked?: boolean;
  cameraFocusRequest?: { x: number; y: number; z: number; distance?: number; nonce: number } | null;
  cameraPresetRequest?: { preset: 'iso' | 'top' | 'north' | 'east'; nonce: number } | null;
  activeWorldDomain?: WorldDomainId;
  selectedWaterBodyId?: string | null;
  selectedCaveId?: string | null;
  worldMap?: WorldMapData;
  worldEditorScope?: WorldEditorScope;
  activeWorldRegionCode?: number;
  worldMapBrushMode?: WorldMapBrushMode;
  selectedWorldLandCode?: number | null;
  onSelectEntity: (id: string | null) => void;
  onSelectWaterBody?: (id: string | null) => void;
  onSelectCave?: (id: string | null) => void;
  onMoveEntity: (id: string, pos: { x: number; y: number }, elevationY?: number) => void;
  onRotateEntity: (id: string, deg: number) => void;
  onRotateActiveTool?: (deltaDeg: number) => void;
  onScaleEntity: (id: string, scale: number) => void;
  onBrushStroke: (x: number, z: number, meta?: TerrainBrushStrokeMeta) => void;
  onCommitCaveStroke?: (stroke: CaveSplineStrokeInput) => void;
  onWorldMapBrushStroke?: (x: number, z: number, meta?: { isStart: boolean }) => void;
  onSelectWorldLandFrom3D?: (regionCode: number | null) => void;
  onAddAtPoint: (pos: { x: number; y: number }, elevationY?: number) => void;
  onDropFxTemplate?: (templateId: string, pos: { x: number; y: number }) => void;
  onDropCustomAsset?: (assetId: string, pos: { x: number; y: number }, elevationY?: number) => void;
  onDropPlatformerModule?: (moduleId: PlatformerModuleId, pos: { x: number; y: number }, elevationY?: number) => void;
  onPickBuildingCurvePoint?: (worldXZ: [number, number]) => void;
}

export const WorldViewport3D: React.FC<WorldViewport3DProps> = ({
  project,
  level,
  customAssets,
  selectedEntityID,
  playerPin = null,
  tool,
  brush,
  brushRadius,
  brushStrength = 1,
  brushFalloff = 'smooth',
  gridSnap = 0,
  isPlacingBuildingBlock = false,
  placementGhostSize = [2, 2, 2],
  placementGhostRotation = 0,
  resolutionScale = 1,
  shadowQuality = 'medium',
  terrainQuality = 'balanced',
  fxBurstSignal = null,
  fxPaused = false,
  renderPaused = false,
  draggingFxTemplate = null,
  buildingCurveGuide = null,
  cameraAngleLocked = false,
  cameraFocusRequest = null,
  cameraPresetRequest = null,
  activeWorldDomain = 'select',
  selectedWaterBodyId = null,
  selectedCaveId = null,
  worldMap,
  worldEditorScope = 'worldMap',
  activeWorldRegionCode,
  worldMapBrushMode = 'terrain',
  selectedWorldLandCode = null,
  onSelectEntity,
  onSelectWaterBody,
  onSelectCave,
  onMoveEntity,
  onRotateEntity,
  onRotateActiveTool,
  onScaleEntity,
  onBrushStroke,
  onCommitCaveStroke,
  onWorldMapBrushStroke,
  onSelectWorldLandFrom3D,
  onAddAtPoint,
  onDropFxTemplate,
  onDropCustomAsset,
  onDropPlatformerModule,
  onPickBuildingCurvePoint,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const defaultTreePrefs = useDefaultTreeStyles();
  const [texInvalidationTick, setTexInvalidationTick] = useState(0);
  const [sculptFinalizeNonce, setSculptFinalizeNonce] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragKind, setDragKind] = useState<'fx' | 'asset' | 'platformer' | null>(null);
  const [shiftHeld, setShiftHeld] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const shiftHeldRef = useRef(false);
  const isPanDragRef = useRef(false);
  const [showPerfHud, setShowPerfHud] = useState(false);
  const [perfStats, setPerfStats] = useState<{
    fps: number;
    frameMs: number;
    calls: number;
    triangles: number;
    backend: string;
    heapMB?: number;
    heapLimitMB?: number;
  }>({ fps: 0, frameMs: 0, calls: 0, triangles: 0, backend: 'WebGPU' });
  const showPerfHudRef = useRef(showPerfHud);
  showPerfHudRef.current = showPerfHud;
  const compactFpsDotRef = useRef<HTMLSpanElement | null>(null);
  const compactFpsTextRef = useRef<HTMLSpanElement | null>(null);
  const compactMsTextRef = useRef<HTMLSpanElement | null>(null);
  const caveDrawHudRef = useRef<HTMLDivElement | null>(null);
  const caveDrawHudTextRef = useRef<HTMLSpanElement | null>(null);
  const latestPerfSnapshotRef = useRef(perfStats);

  const lastSculptAreaRef = useRef<{ x: number; z: number; radius: number } | null>(null);
  const isSculptDraggingRef = useRef(false);
  const lastIslandStructKeyRef = useRef<string>('');
  const lastCavesSigRef = useRef<string>('');
  const lastTerrainRevRef = useRef<number>(-1);
  const lastWorldMapRevRef = useRef<number>(-1);
  const lastEntityStructKeyRef = useRef<string>('');
  const islandBuildAbortRef = useRef<AbortController | null>(null);
  const scatterReseatAbortRef = useRef<AbortController | null>(null);
  const entityBuildAbortRef = useRef<AbortController | null>(null);
  const dragRaycastScratchRef = useRef<{
    ndc: THREE.Vector2;
    raycaster: THREE.Raycaster;
    fallbackPlane: THREE.Plane;
    sideScrollerPlane: THREE.Plane;
    hitPt: THREE.Vector3;
  } | null>(null);

  useEffect(() => {
    return subscribeCustomTextureInvalidation(() => setTexInvalidationTick((t) => t + 1));
  }, []);

  const resumeLoopRef = useRef<(() => void) | null>(null);

  const propsRef = useRef({
    project,
    level,
    customAssets,
    selectedEntityID,
    tool,
    brush,
    brushRadius,
    brushStrength,
    brushFalloff,
    gridSnap,
    isPlacingBuildingBlock,
    placementGhostSize,
    placementGhostRotation,
    resolutionScale,
    shadowQuality,
    terrainQuality,
    fxPaused,
    renderPaused,
    draggingFxTemplate,
    onSelectEntity,
    onMoveEntity,
    onRotateEntity,
    onRotateActiveTool,
    onScaleEntity,
    onBrushStroke,
    onCommitCaveStroke,
    onWorldMapBrushStroke,
    onSelectWorldLandFrom3D,
    onAddAtPoint,
    onDropFxTemplate,
    onDropCustomAsset,
    onDropPlatformerModule,
    onPickBuildingCurvePoint,
    buildingCurveGuide,
    cameraAngleLocked,
    activeWorldDomain,
    selectedWaterBodyId,
    selectedCaveId,
    worldMap,
    worldEditorScope,
    activeWorldRegionCode,
    worldMapBrushMode,
    selectedWorldLandCode,
    onSelectWaterBody,
    onSelectCave,
  });
  propsRef.current = {
    project,
    level,
    customAssets,
    selectedEntityID,
    tool,
    brush,
    brushRadius,
    brushStrength,
    brushFalloff,
    gridSnap,
    isPlacingBuildingBlock,
    placementGhostSize,
    placementGhostRotation,
    resolutionScale,
    shadowQuality,
    terrainQuality,
    fxPaused,
    renderPaused,
    draggingFxTemplate,
    onSelectEntity,
    onMoveEntity,
    onRotateEntity,
    onRotateActiveTool,
    onScaleEntity,
    onBrushStroke,
    onCommitCaveStroke,
    onWorldMapBrushStroke,
    onSelectWorldLandFrom3D,
    onAddAtPoint,
    onDropFxTemplate,
    onDropCustomAsset,
    onDropPlatformerModule,
    onPickBuildingCurvePoint,
    buildingCurveGuide,
    cameraAngleLocked,
    activeWorldDomain,
    selectedWaterBodyId,
    selectedCaveId,
    worldMap,
    worldEditorScope,
    activeWorldRegionCode,
    worldMapBrushMode,
    selectedWorldLandCode,
    onSelectWaterBody,
    onSelectCave,
  };

  const sceneRefs = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    renderer: WebGPURenderer;
    postPipeline: PostProcessingPipeline | null;
    sun: THREE.DirectionalLight;
    hemi: THREE.HemisphereLight;
    islandContainer: THREE.Group;
    entitiesContainer: THREE.Group;
    fxContainer: THREE.Group;
    fxEmitters: Map<string, FxEmitterRuntime>;
    islandHandles: IslandSceneHandles | null;
    wildlifeSystem: WildlifeFlockingSystem | null;
    weatherPoints: THREE.Points | null;
    selectionRing: THREE.Mesh;
    brushGroup: THREE.Group;
    brushOuterMat: THREE.MeshBasicMaterial;
    brushInnerRing: THREE.Mesh;
    brushInnerMat: THREE.MeshBasicMaterial;
    brushCenterDot: THREE.Mesh;
    dropPreviewGroup: THREE.Group;
    dropRingMat: THREE.MeshBasicMaterial;
    dropPillarMat: THREE.MeshBasicMaterial;
    snapGhostGroup: THREE.Group;
    snapGhostPlane: THREE.Mesh;
    snapGhostWire: THREE.LineSegments;
    buildGridHelper: THREE.GridHelper;
    curveGuideGroup: THREE.Group;
    entityGroups: Map<string, THREE.Group>;
    animatedVillageGroups: THREE.Object3D[];
    floatSpinObjects: THREE.Object3D[];
    torchFlameObjects: Array<{ mesh: THREE.Object3D; baseY: number; phase: number }>;
    groundMeshes: THREE.Object3D[];
    heroGroup: THREE.Group | null;
    portalGroup: THREE.Group | null;
    customUpdaters: ((dt: number) => void)[];
    hasDynamicShadows: boolean;
    rendererInitialized: boolean;
    markShadowDirty: () => void;
    precompileObject: (obj: THREE.Object3D) => Promise<void>;
    canopyTimeUniform: { value: number };
    canopyWindUniform: { value: number };
    lastFramedEnvKey: string;
    isSoftwareGl: boolean;
    flyActive: boolean;
    flyTargetPos: THREE.Vector3;
    flyTargetLook: THREE.Vector3;
  } | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();
    let renderer = createMakerRenderer(isSoftwareGl);
    renderer.setSize(container.clientWidth || 640, container.clientHeight || 420);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    ensureSkyDome(scene);

    const camera = new THREE.PerspectiveCamera(
      48,
      (container.clientWidth || 640) / Math.max(1, container.clientHeight || 420),
      0.2,
      5200
    );
    camera.position.set(68, 52, 88);

    let controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.2, 0);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.minDistance = 8;
    controls.maxDistance = propsRef.current.worldEditorScope === 'worldMap' ? 1600 : 360;
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.update();

    const saveCurrentCameraPose = () => {
      const refs = sceneRefs.current;
      if (!refs || !refs.lastFramedEnvKey) return;
      savedCameraPoseMap.set(refs.lastFramedEnvKey, {
        pos: [camera.position.x, camera.position.y, camera.position.z],
        target: [controls.target.x, controls.target.y, controls.target.z],
      });
    };
    controls.addEventListener('change', saveCurrentCameraPose);
    const cancelCameraFly = () => {
      if (sceneRefs.current) {
        sceneRefs.current.flyActive = false;
      }
    };
    controls.addEventListener('start', cancelCameraFly);

    const hemi = new THREE.HemisphereLight('#B8E4FF', '#5F7844', 0.75);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight('#FFF5E0', 1.8);
    sun.castShadow = !isSoftwareGl;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -140;
    sun.shadow.camera.right = 140;
    sun.shadow.camera.top = 140;
    sun.shadow.camera.bottom = -140;
    sun.shadow.camera.near = 2;
    sun.shadow.camera.far = 400;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    sun.shadow.autoUpdate = false;
    sun.shadow.needsUpdate = !isSoftwareGl;
    scene.add(sun);
    scene.add(sun.target);
    let sunCsm: CsmShadowHandle | null = attachSunCSM(sun, {
      isSoftwareGl,
      cascades: 2,
      maxFar: 175,
      lightMargin: 75,
      mapSize: 768,
    });
    let cachedAtmoLevelRef: GameLevel | null = null;
    let cachedAtmoState: ReturnType<typeof computeAtmosphereState> | null = null;

    let envTex: THREE.Texture | null = null;
    let postPipeline: PostProcessingPipeline | null = null;
    const _sunDirScratch = new THREE.Vector3();
    const _volFogColorScratch = new THREE.Color('#B8CDE0');
    const _volFogInscatterScratch = new THREE.Color('#FFE8BC');
    const _volFogCfgScratch = {
      enabled: true,
      density: 1.0,
      height: 2.2,
      softness: 8.5,
      sharpness: 0.3,
      noise: 0.95,
      patchiness: 0.45,
      speed: 0.75,
      wind: 0.45,
      fogColor: _volFogColorScratch,
      inscatterColor: _volFogInscatterScratch,
    };

    const islandContainer = new THREE.Group();
    const entitiesContainer = new THREE.Group();
    const fxContainer = new THREE.Group();
    scene.add(islandContainer, entitiesContainer, fxContainer);

    const selectionRing = new THREE.Mesh(
      new THREE.RingGeometry(0.95, 1.18, 28),
      new THREE.MeshBasicMaterial({
        color: '#7C5CFF',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.92,
      })
    );
    selectionRing.rotation.x = -Math.PI / 2;
    selectionRing.visible = false;
    scene.add(selectionRing);

    // Dual-ring terrain sculpt reticle (outer radius + inner falloff profile + center dot)
    const brushGroup = new THREE.Group();
    const brushOuterMat = new THREE.MeshBasicMaterial({
      color: '#20B46A',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
      depthTest: false,
      depthWrite: false,
    });
    const brushOuterRing = new THREE.Mesh(new THREE.RingGeometry(0.94, 1.0, 48), brushOuterMat);
    brushOuterRing.rotation.x = -Math.PI / 2;
    brushOuterRing.renderOrder = 25;

    const brushInnerMat = new THREE.MeshBasicMaterial({
      color: '#20B46A',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.42,
      depthTest: false,
      depthWrite: false,
    });
    const brushInnerRing = new THREE.Mesh(new THREE.RingGeometry(0.92, 1.0, 40), brushInnerMat);
    brushInnerRing.rotation.x = -Math.PI / 2;
    brushInnerRing.renderOrder = 25;

    const brushCenterDot = new THREE.Mesh(
      new THREE.CircleGeometry(0.055, 16),
      brushOuterMat
    );
    brushCenterDot.rotation.x = -Math.PI / 2;
    brushCenterDot.renderOrder = 26;

    brushGroup.add(brushOuterRing, brushInnerRing, brushCenterDot);
    brushGroup.visible = false;
    scene.add(brushGroup);

    // Glowing 3D target beacon for drag-and-drop FX Library placement
    const dropPreviewGroup = new THREE.Group();
    const dropRingMat = new THREE.MeshBasicMaterial({
      color: '#7C5CFF',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });
    const dropOuterRing = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.48, 36), dropRingMat);
    dropOuterRing.rotation.x = -Math.PI / 2;
    dropOuterRing.position.y = 0.14;
    const dropInnerDisc = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 24),
      dropRingMat
    );
    dropInnerDisc.rotation.x = -Math.PI / 2;
    dropInnerDisc.position.y = 0.16;
    const dropPillarMat = new THREE.MeshBasicMaterial({
      color: '#7C5CFF',
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    });
    const dropPillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.45, 3.8, 16, 1, true),
      dropPillarMat
    );
    dropPillar.position.y = 2.0;
    dropPreviewGroup.add(dropOuterRing, dropInnerDisc, dropPillar);
    dropPreviewGroup.visible = false;
    scene.add(dropPreviewGroup);

    // Modular 2m build snap grid & cursor block ghost
    const buildGridHelper = new THREE.GridHelper(88, 44, '#7C5CFF', '#4B556B');
    const gridMats = Array.isArray(buildGridHelper.material)
      ? buildGridHelper.material
      : [buildGridHelper.material];
    for (const gm of gridMats) {
      gm.transparent = true;
      gm.opacity = 0.24;
      gm.depthWrite = false;
    }
    buildGridHelper.position.y = 0.04;
    buildGridHelper.visible = false;
    scene.add(buildGridHelper);

    const snapGhostGroup = new THREE.Group();
    const ghostFloorMat = new THREE.MeshBasicMaterial({
      color: '#38BDF8',
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ghostPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.96, 1.96), ghostFloorMat);
    ghostPlane.rotation.x = -Math.PI / 2;
    ghostPlane.position.y = 0.03;
    const ghostBoxTmp = new THREE.BoxGeometry(2.0, 2.0, 2.0);
    const ghostWire = new THREE.LineSegments(
      new THREE.EdgesGeometry(ghostBoxTmp),
      new THREE.LineBasicMaterial({ color: '#38BDF8', transparent: true, opacity: 0.72 })
    );
    ghostBoxTmp.dispose();
    ghostWire.position.y = 1.0;
    snapGhostGroup.add(ghostPlane, ghostWire);
    snapGhostGroup.visible = false;
    scene.add(snapGhostGroup);

    const curveGuideGroup = new THREE.Group();
    scene.add(curveGuideGroup);

    // Pre-allocated, zero-shader-recompile live 3D spline preview for carving caves at a locked 60 FPS!
    const caveDrawPreviewGroup = new THREE.Group();
    const cavePreviewVaultMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.32,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const cavePreviewWireMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.86,
      depthTest: false,
      depthWrite: false,
      wireframe: true,
    });
    const cavePreviewFloorMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.42,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const cavePreviewLineMat = new THREE.LineBasicMaterial({
      color: '#E0F2FE',
      transparent: true,
      opacity: 0.96,
      depthTest: false,
      depthWrite: false,
    });
    const cavePreviewStartMat = new THREE.MeshBasicMaterial({
      color: '#34D399',
      transparent: true,
      opacity: 0.92,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const cavePreviewTipMat = new THREE.MeshBasicMaterial({
      color: '#67E8F9',
      transparent: true,
      opacity: 0.95,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const cavePreviewVaultMesh = new THREE.Mesh(new THREE.BufferGeometry(), cavePreviewVaultMat);
    cavePreviewVaultMesh.renderOrder = 51;
    cavePreviewVaultMesh.frustumCulled = false;
    const cavePreviewWireMesh = new THREE.Mesh(cavePreviewVaultMesh.geometry, cavePreviewWireMat);
    cavePreviewWireMesh.renderOrder = 53;
    cavePreviewWireMesh.frustumCulled = false;
    const cavePreviewFloorMesh = new THREE.Mesh(new THREE.BufferGeometry(), cavePreviewFloorMat);
    cavePreviewFloorMesh.renderOrder = 52;
    cavePreviewFloorMesh.frustumCulled = false;
    const cavePreviewSplineLine = new THREE.Line(new THREE.BufferGeometry(), cavePreviewLineMat);
    cavePreviewSplineLine.renderOrder = 55;
    cavePreviewSplineLine.frustumCulled = false;
    const cavePreviewStartRing = new THREE.Mesh(
      new THREE.RingGeometry(0.84, 1.0, 32),
      cavePreviewStartMat
    );
    cavePreviewStartRing.rotation.x = -Math.PI / 2;
    cavePreviewStartRing.renderOrder = 54;
    const cavePreviewTipRing = new THREE.Mesh(
      new THREE.RingGeometry(0.86, 1.0, 32),
      cavePreviewTipMat
    );
    cavePreviewTipRing.rotation.x = -Math.PI / 2;
    cavePreviewTipRing.renderOrder = 54;
    caveDrawPreviewGroup.add(
      cavePreviewVaultMesh,
      cavePreviewWireMesh,
      cavePreviewFloorMesh,
      cavePreviewSplineLine,
      cavePreviewStartRing,
      cavePreviewTipRing
    );
    caveDrawPreviewGroup.visible = false;
    scene.add(caveDrawPreviewGroup);

    sceneRefs.current = {
      scene,
      camera,
      controls,
      renderer,
      postPipeline: null,
      sun,
      hemi,
      islandContainer,
      entitiesContainer,
      fxContainer,
      fxEmitters: new Map(),
      islandHandles: null,
      wildlifeSystem: null,
      weatherPoints: null,
      selectionRing,
      brushGroup,
      brushOuterMat,
      brushInnerRing,
      brushInnerMat,
      brushCenterDot,
      dropPreviewGroup,
      dropRingMat,
      dropPillarMat,
      snapGhostGroup,
      snapGhostPlane: ghostPlane,
      snapGhostWire: ghostWire,
      buildGridHelper,
      curveGuideGroup,
      entityGroups: new Map(),
      animatedVillageGroups: [],
      floatSpinObjects: [],
      torchFlameObjects: [],
      groundMeshes: [],
      heroGroup: null,
      portalGroup: null,
      customUpdaters: [],
      hasDynamicShadows: false,
      rendererInitialized: false,
      markShadowDirty: () => {
        if (!isSoftwareGl && sun.castShadow) {
          sun.shadow.needsUpdate = true;
        }
      },
      precompileObject: async (obj: THREE.Object3D) => {
        const curRefs = sceneRefs.current;
        if (!curRefs || !curRefs.rendererInitialized || disposed) return;
        // Skip incremental sub-container compileAsync while the render loop is running;
        // WebGPURenderer r187 compiles new node materials on demand during render() without
        // wiping the scene's shared RenderList or clobbering RenderTarget/MRT across frame yields.
        if (obj !== scene) return;
        compileChain = compileChain.then(async () => {
          const activeRefs = sceneRefs.current;
          if (disposed || !activeRefs?.rendererInitialized) return;
          try {
            if (activeRefs.postPipeline) {
              await activeRefs.postPipeline.precompileAsync(
                propsRef.current.project.postProcessing
              );
            } else {
              await activeRefs.renderer.compileAsync(scene, camera);
            }
          } catch {
            // ignore compile skips if object was disposed mid-flight
          } finally {
            const next = pendingResizeRef.current;
            if (!disposed && !activeRefs.postPipeline?.isPrecompiling() && next) {
              pendingResizeRef.current = null;
              applyContainerResize(next.w, next.h);
            }
          }
        });
        await compileChain;
      },
      canopyTimeUniform: uniform(0),
      canopyWindUniform: uniform(
        computeWeatherWindFactor(propsRef.current.level.weather, propsRef.current.level.wind)
      ),
      lastFramedEnvKey: '',
      isSoftwareGl,
      flyActive: false,
      flyTargetPos: new THREE.Vector3(68, 52, 88),
      flyTargetLook: new THREE.Vector3(0, 1.2, 0),
    };

    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const _waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -IslandTerrain.waterLevel);
    const _sideScrollerPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const _planeHit = new THREE.Vector3();
    const _worldNormal = new THREE.Vector3();

    let activeMode: 'none' | 'dragEntity' | 'rotateEntity' | 'scaleEntity' | 'brush' | 'caveDraw' =
      'none';
    let activeEntityId: string | null = null;
    let dragStartX = 0;
    let startVal = 0;
    let pointerDownPos = { x: 0, y: 0 };
    let movedFar = false;
    let strokeSampledHeight = 0;
    let strokeModifiedHeight = false;
    let lastStrokeTimeMs = 0;
    let lockedCaveFloorY: number | null = null;
    let caveDrawPoints: CaveStrokePoint[] = [];
    let caveDrawTargetId: string | null = null;
    let caveDrawLastTip: { x: number; z: number } | null = null;

    const clearLiveCavePreview = () => {
      caveDrawPreviewGroup.visible = false;
      const oldVault = cavePreviewVaultMesh.geometry;
      const oldFloor = cavePreviewFloorMesh.geometry;
      const oldLine = cavePreviewSplineLine.geometry;
      const emptyVault = new THREE.BufferGeometry();
      cavePreviewVaultMesh.geometry = emptyVault;
      cavePreviewWireMesh.geometry = emptyVault;
      cavePreviewFloorMesh.geometry = new THREE.BufferGeometry();
      cavePreviewSplineLine.geometry = new THREE.BufferGeometry();
      oldVault.dispose();
      oldFloor.dispose();
      oldLine.dispose();
      caveDrawPoints = [];
      caveDrawTargetId = null;
      caveDrawLastTip = null;
      if (caveDrawHudRef.current) {
        caveDrawHudRef.current.classList.add('hidden');
      }
    };

    const updateLiveCavePreview = (
      pts: CaveStrokePoint[],
      floorY: number,
      tipX: number,
      tipZ: number,
      tipRadius: number,
      tipHeight: number
    ) => {
      if (pts.length === 0) return;
      const curLevel = propsRef.current.level;
      const lastStored = pts[pts.length - 1];
      const withLiveTip: CaveStrokePoint[] =
        Math.hypot(tipX - lastStored.x, tipZ - lastStored.z) >= 0.35
          ? [...pts, { x: tipX, z: tipZ, radius: tipRadius, height: tipHeight, floorY }]
          : pts;

      const preview = buildLiveCavePreviewGeometry(withLiveTip, floorY, (wx, wz) =>
        sampleLevelHeight(curLevel, wx, wz)
      );

      const oldVault = cavePreviewVaultMesh.geometry;
      const oldFloor = cavePreviewFloorMesh.geometry;
      const oldLine = cavePreviewSplineLine.geometry;
      cavePreviewVaultMesh.geometry = preview.vaultGeo;
      cavePreviewWireMesh.geometry = preview.vaultGeo;
      cavePreviewFloorMesh.geometry = preview.floorGeo;
      cavePreviewSplineLine.geometry = preview.centerlineGeo;
      oldVault.dispose();
      oldFloor.dispose();
      oldLine.dispose();

      const p0 = withLiveTip[0];
      cavePreviewStartRing.position.set(p0.x, floorY + 0.14, p0.z);
      cavePreviewStartRing.scale.setScalar(p0.radius);
      cavePreviewTipRing.position.set(tipX, floorY + 0.16, tipZ);
      cavePreviewTipRing.scale.setScalar(tipRadius);
      caveDrawPreviewGroup.visible = true;

      if (caveDrawHudRef.current && caveDrawHudTextRef.current) {
        caveDrawHudRef.current.classList.remove('hidden');
        const modeTag = caveDrawTargetId ? 'Extending cave' : 'Carving tunnel';
        caveDrawHudTextRef.current.textContent = `${modeTag} · ${preview.totalLength.toFixed(1)}m · Floor Y ${floorY.toFixed(1)}m · Release to carve (Esc cancels)`;
      }
    };

    const syncSculptSceneryVisibility = (isDraggingBrush: boolean) => {
      const refs = sceneRefs.current;
      if (!refs) return;
      const winFlags = window as unknown as {
        __makerHideSceneryOnSculpt?: boolean;
        __makerMinimalSculptAlways?: boolean;
      };
      // Opt-in only so starting/stopping a brush stroke doesn't stall WebGPU render-list rebuilding
      const hideOnDrag = winFlags.__makerHideSceneryOnSculpt === true;
      const alwaysHide = Boolean(winFlags.__makerMinimalSculptAlways);
      const visible = !alwaysHide && !(isDraggingBrush && hideOnDrag);
      refs.islandHandles?.setSceneryVisible?.(visible);
      refs.entitiesContainer.visible = visible;
      refs.fxContainer.visible = visible;
    };

    const updatePointer = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
    };

    const raycastCavePlane = (
      clientX: number,
      clientY: number,
      floorY: number
    ): THREE.Vector3 | null => {
      updatePointer(clientX, clientY);
      raycaster.setFromCamera(pointerNdc, camera);
      _waterPlane.constant = -floorY;
      if (raycaster.ray.intersectPlane(_waterPlane, _planeHit)) {
        const rMax = getTerrainRadius(propsRef.current.level.terrain);
        if (Math.abs(_planeHit.x) <= rMax + 4 && Math.abs(_planeHit.z) <= rMax + 4) {
          _planeHit.x = Math.max(-rMax, Math.min(rMax, _planeHit.x));
          _planeHit.z = Math.max(-rMax, Math.min(rMax, _planeHit.z));
          _planeHit.y = floorY;
          return _planeHit;
        }
      }
      return null;
    };

    const findExistingCaveHitOnPlane = (
      clientX: number,
      clientY: number
    ): { caveId: string; x: number; z: number; floorY: number } | null => {
      const caves = propsRef.current.level.terrain?.caves ?? [];
      if (caves.length === 0) return null;
      updatePointer(clientX, clientY);
      raycaster.setFromCamera(pointerNdc, camera);
      const rMax = getTerrainRadius(propsRef.current.level.terrain);
      let best: { caveId: string; x: number; z: number; floorY: number; dist: number } | null = null;
      for (let ci = 0; ci < caves.length; ci++) {
        const c = caves[ci];
        const fy = c.floorElevation ?? c.tunnelNodes?.[0]?.floorY ?? 1.55;
        _waterPlane.constant = -fy;
        if (!raycaster.ray.intersectPlane(_waterPlane, _planeHit)) continue;
        if (Math.abs(_planeHit.x) > rMax + 2 || Math.abs(_planeHit.z) > rMax + 2) continue;
        const px = _planeHit.x;
        const pz = _planeHit.z;
        const nodes = c.tunnelNodes && c.tunnelNodes.length > 0 ? c.tunnelNodes : [{ x: c.x, z: c.z, radius: 4.0 * (c.scale || 1) }];
        for (let ni = 0; ni < nodes.length; ni++) {
          const nd = nodes[ni];
          const d = Math.hypot(px - nd.x, pz - nd.z);
          const snapR = Math.max(4.2, (nd.radius || 3.6) * 1.15);
          if (d <= snapR && (!best || d < best.dist)) {
            best = { caveId: c.id, x: px, z: pz, floorY: fy, dist: d };
          }
        }
      }
      return best ? { caveId: best.caveId, x: best.x, z: best.z, floorY: best.floorY } : null;
    };

    const raycastGround = (clientX: number, clientY: number): THREE.Vector3 | null => {
      const refs = sceneRefs.current;
      if (!refs) return null;
      updatePointer(clientX, clientY);
      raycaster.setFromCamera(pointerNdc, camera);
      const curState = propsRef.current;
      const isWm =
        curState.worldEditorScope === 'worldMap' &&
        getEnvironmentType(curState.level) === 'openWorld';

      if (getEnvironmentType(curState.level) === 'sideScroller') {
        const hits =
          refs.groundMeshes.length > 0
            ? raycaster.intersectObjects(refs.groundMeshes, false)
            : [];
        if (hits[0]?.point) return hits[0].point;
        if (raycaster.ray.intersectPlane(_sideScrollerPlane, _planeHit)) {
          _planeHit.x = Math.max(-54, Math.min(54, _planeHit.x));
          _planeHit.y = Math.max(-3, Math.min(22, _planeHit.y));
          _planeHit.z = 0;
          return _planeHit;
        }
        return null;
      }

      if (refs.groundMeshes.length === 0) return null;

      // When hand-painting inside an existing cave (moss/puddles/crystals/etc.), intersect its floor plane directly
      const isCavePaintBrush =
        !isWm && curState.tool === 'terrain' && curState.brush.startsWith('cave');
      if (isCavePaintBrush) {
        const caves = curState.level.terrain?.caves ?? [];
        const selCave =
          caves.find((c) => c.id === curState.selectedCaveId) ?? caves[caves.length - 1] ?? null;
        const targetFloorY =
          lockedCaveFloorY ??
          selCave?.floorElevation ??
          selCave?.tunnelNodes?.[0]?.floorY ??
          1.55;
        _waterPlane.constant = -targetFloorY;
        if (raycaster.ray.intersectPlane(_waterPlane, _planeHit)) {
          const rMax = getTerrainRadius(curState.level.terrain);
          if (Math.abs(_planeHit.x) <= rMax + 2 && Math.abs(_planeHit.z) <= rMax + 2) {
            _planeHit.x = Math.max(-rMax, Math.min(rMax, _planeHit.x));
            _planeHit.z = Math.max(-rMax, Math.min(rMax, _planeHit.z));
            const surfH = sampleLevelHeight(curState.level, _planeHit.x, _planeHit.z);
            if (activeMode === 'brush' || surfH >= targetFloorY - 0.45) {
              _planeHit.y = targetFloorY;
              return _planeHit;
            }
          }
        }
      }

      const hits = raycaster.intersectObjects(refs.groundMeshes, false);
      const meshHit = hits[0]?.point ?? null;
      const allowOceanPlane =
        isWm || Boolean(curState.level.terrain?.freeformWorld) || curState.brush === 'terrain';
      if (meshHit && (!allowOceanPlane || meshHit.y >= IslandTerrain.waterLevel - 0.1)) {
        return meshHit;
      }
      if (allowOceanPlane) {
        _waterPlane.constant = -IslandTerrain.waterLevel;
        if (raycaster.ray.intersectPlane(_waterPlane, _planeHit)) {
          const rMax = isWm
            ? getWorldMapRadius(curState.worldMap)
            : getTerrainRadius(curState.level.terrain);
          if (Math.abs(_planeHit.x) <= rMax + 2 && Math.abs(_planeHit.z) <= rMax + 2) {
            _planeHit.x = Math.max(-rMax, Math.min(rMax, _planeHit.x));
            _planeHit.z = Math.max(-rMax, Math.min(rMax, _planeHit.z));
            return _planeHit;
          }
        }
      }
      return meshHit;
    };

    const raycastPlacementSurface = (
      clientX: number,
      clientY: number,
      excludeEntityId?: string | null
    ): { x: number; y: number; z: number; elevationY: number } | null => {
      const refs = sceneRefs.current;
      if (!refs) return null;
      const curLevel = propsRef.current.level;
      const isSideScroller = getEnvironmentType(curLevel) === 'sideScroller';
      if (!isSideScroller && refs.groundMeshes.length === 0) return null;
      const snap = propsRef.current.gridSnap ?? 0;
      const shouldStack = Boolean(propsRef.current.isPlacingBuildingBlock || excludeEntityId);

      // Dimensions & rotation of the block being placed or dragged
      let newW = 2;
      let newH = 2;
      let newD = 2;
      let newYaw = 0;
      const draggedEnt = excludeEntityId
        ? curLevel.entities.find((item) => item.id === excludeEntityId)
        : undefined;
      if (draggedEnt?.buildingBlock) {
        [newW, newH, newD] = getBuildingBlockDimensions(draggedEnt.buildingBlock, draggedEnt.scale);
        newYaw = ((draggedEnt.rotation ?? 0) * Math.PI) / 180;
      } else if (draggedEnt?.kind === 'door') {
        const ds = Math.max(0.25, draggedEnt.scale ?? 1);
        [newW, newH, newD] = [2.0 * ds, 2.4 * ds, 0.7 * ds];
        newYaw = ((draggedEnt.rotation ?? 0) * Math.PI) / 180;
      } else {
        const ghost = propsRef.current.placementGhostSize;
        if (ghost) [newW, newH, newD] = ghost;
        newYaw = ((propsRef.current.placementGhostRotation ?? 0) * Math.PI) / 180;
      }

      const getTargetMeta = (ent: LevelEntity) => {
        const [tx, tz] = levelBoardToWorld(curLevel, ent.position);
        const ty = ((ent.rotation ?? 0) * Math.PI) / 180;
        const baseY = sampleLevelHeight(curLevel, tx, tz) + (ent.elevationY ?? 0);
        const [tw, th, td] = ent.buildingBlock
          ? getBuildingBlockDimensions(ent.buildingBlock, ent.scale)
          : (() => {
              const ds = Math.max(0.25, ent.scale ?? 1);
              return [2.0 * ds, 2.4 * ds, 0.7 * ds] as [number, number, number];
            })();
        const rel = newYaw - ty;
        const effHalfX = Math.abs(Math.cos(rel)) * (newW * 0.5) + Math.abs(Math.sin(rel)) * (newD * 0.5);
        const effHalfZ = Math.abs(Math.sin(rel)) * (newW * 0.5) + Math.abs(Math.cos(rel)) * (newD * 0.5);
        return { tx, tz, ty, cos: Math.cos(ty), sin: Math.sin(ty), baseY, tw, th, td, effHalfX, effHalfZ };
      };

      const alignAlongAxis = (coord: number, targetHalf: number, newHalf: number): number => {
        if (Math.abs(targetHalf - newHalf) < 0.18) {
          return 0;
        }
        const edgeShift = Math.abs(targetHalf - newHalf);
        const candidates = [-edgeShift, 0, edgeShift];
        for (const cand of candidates) {
          if (Math.abs(coord - cand) < 0.48) {
            return cand;
          }
        }
        return snap > 0 ? Math.round(coord / snap) * snap : coord;
      };

      updatePointer(clientX, clientY);
      raycaster.setFromCamera(pointerNdc, camera);

      if (shouldStack) {
        const stackTargets: THREE.Object3D[] = [];
        for (const ent of curLevel.entities) {
          if (ent.id === excludeEntityId) continue;
          if (!ent.buildingBlock && ent.kind !== 'platform' && ent.kind !== 'door') continue;
          const grp = refs.entityGroups.get(ent.id);
          if (grp) stackTargets.push(grp);
        }
        if (stackTargets.length > 0) {
          const objHits = raycaster.intersectObjects(stackTargets, true);
          const worldNormal = _worldNormal;
          for (const h of objHits) {
            if (!h.face) continue;
            worldNormal.copy(h.face.normal).transformDirection(h.object.matrixWorld).normalize();
            let hitEntId: string | null = null;
            let objCur: THREE.Object3D | null = h.object;
            while (objCur) {
              if (objCur.userData?.entityId) {
                hitEntId = String(objCur.userData.entityId);
                break;
              }
              objCur = objCur.parent;
            }
            const targetEnt = hitEntId
              ? curLevel.entities.find((item) => item.id === hitEntId)
              : undefined;

            if (targetEnt && (targetEnt.buildingBlock || targetEnt.kind === 'door')) {
              const m = getTargetMeta(targetEnt);
              const dx = h.point.x - m.tx;
              const dz = h.point.z - m.tz;
              const lx = dx * m.cos - dz * m.sin;
              const lz = dx * m.sin + dz * m.cos;

              if (worldNormal.y > 0.55) {
                // Top face hit: align flush along target block's local footprint
                const snappedLx = alignAlongAxis(lx, m.tw * 0.5, m.effHalfX);
                const snappedLz = alignAlongAxis(lz, m.td * 0.5, m.effHalfZ);
                const wx = m.tx + snappedLx * m.cos + snappedLz * m.sin;
                const wz = m.tz - snappedLx * m.sin + snappedLz * m.cos;
                const groundY = sampleLevelHeight(curLevel, wx, wz);
                const rawElev = Math.max(0, h.point.y - groundY);
                const elevationY =
                  Math.abs(rawElev - Math.round(rawElev / 2) * 2) < 0.1
                    ? Math.round(rawElev / 2) * 2
                    : Number(rawElev.toFixed(3));
                return { x: wx, y: groundY + elevationY, z: wz, elevationY };
              }

              if (Math.abs(worldNormal.y) <= 0.55) {
                // Side face hit: snap seamlessly flush edge-to-edge on target block's side
                const nLx = worldNormal.x * m.cos - worldNormal.z * m.sin;
                const nLz = worldNormal.x * m.sin + worldNormal.z * m.cos;
                let snappedLx = 0;
                let snappedLz = 0;
                if (Math.abs(nLx) >= Math.abs(nLz)) {
                  const dirX = nLx >= 0 ? 1 : -1;
                  snappedLx = dirX * (m.tw * 0.5 + m.effHalfX);
                  snappedLz = alignAlongAxis(lz, m.td * 0.5, m.effHalfZ);
                } else {
                  const dirZ = nLz >= 0 ? 1 : -1;
                  snappedLz = dirZ * (m.td * 0.5 + m.effHalfZ);
                  snappedLx = alignAlongAxis(lx, m.tw * 0.5, m.effHalfX);
                }
                const wx = m.tx + snappedLx * m.cos + snappedLz * m.sin;
                const wz = m.tz - snappedLx * m.sin + snappedLz * m.cos;
                const groundY = sampleLevelHeight(curLevel, wx, wz);
                const rawElev = m.baseY - groundY;
                const elevationY = Math.abs(rawElev) < 0.04 ? 0 : Number(rawElev.toFixed(3));
                return { x: wx, y: groundY + elevationY, z: wz, elevationY };
              }
            } else if (worldNormal.y > 0.55) {
              // Platform top fallback
              const x = snap > 0 ? Math.round(h.point.x / snap) * snap : h.point.x;
              const z = snap > 0 ? Math.round(h.point.z / snap) * snap : h.point.z;
              const groundY = sampleLevelHeight(curLevel, x, z);
              const rawElev = Math.max(0, h.point.y - groundY);
              const elevationY = Number(rawElev.toFixed(3));
              return { x, y: groundY + elevationY, z, elevationY };
            }
          }
        }
      }

      // 2.5D Side-Scroller: place/move anywhere in the Hero Lane vertical plane (Z = 0)
      if (isSideScroller) {
        if (raycaster.ray.intersectPlane(_sideScrollerPlane, _planeHit)) {
          const clampedX = Math.max(-54, Math.min(54, _planeHit.x));
          const clampedY = Math.max(-3, Math.min(22, _planeHit.y));
          const x = snap > 0 ? Math.round(clampedX / snap) * snap : clampedX;
          const y = snap > 0 ? Math.round(clampedY / snap) * snap : clampedY;
          const groundY = sampleLevelHeight(curLevel, x, 0);
          const elevationY = Number((y - groundY).toFixed(3));
          return { x, y, z: 0, elevationY };
        }
        return null;
      }

      const groundHits = raycaster.intersectObjects(refs.groundMeshes, false);
      const rawHit = groundHits[0]?.point?.clone() ?? null;
      if (!rawHit) return null;

      // Magnetic edge snap on ground near ground-level building blocks/doors so walls connect seamlessly
      if (shouldStack) {
        const magnetDist = Math.max(0.55, snap * 0.65);
        let bestDist = magnetDist;
        let bestPlacement: { x: number; y: number; z: number; elevationY: number } | null = null;

        for (const ent of curLevel.entities) {
          if (ent.id === excludeEntityId) continue;
          if (!ent.buildingBlock && ent.kind !== 'door') continue;
          if (Math.abs(ent.elevationY ?? 0) > 0.75) continue;
          const m = getTargetMeta(ent);
          const dx = rawHit.x - m.tx;
          const dz = rawHit.z - m.tz;
          const lx = dx * m.cos - dz * m.sin;
          const lz = dx * m.sin + dz * m.cos;

          const adjX = m.tw * 0.5 + m.effHalfX;
          const adjZ = m.td * 0.5 + m.effHalfZ;

          if (Math.abs(lz) <= m.td * 0.5 + m.effHalfZ + 0.35) {
            for (const dirX of [-1, 1]) {
              const targetX = dirX * adjX;
              const dist = Math.abs(lx - targetX);
              if (dist < bestDist) {
                bestDist = dist;
                const snappedLz = alignAlongAxis(lz, m.td * 0.5, m.effHalfZ);
                const wx = m.tx + targetX * m.cos + snappedLz * m.sin;
                const wz = m.tz - targetX * m.sin + snappedLz * m.cos;
                const groundY = sampleLevelHeight(curLevel, wx, wz);
                const rawElev = m.baseY - groundY;
                const elevationY = Math.abs(rawElev) < 0.04 ? 0 : Number(rawElev.toFixed(3));
                bestPlacement = { x: wx, y: groundY + elevationY, z: wz, elevationY };
              }
            }
          }
          if (Math.abs(lx) <= m.tw * 0.5 + m.effHalfX + 0.35) {
            for (const dirZ of [-1, 1]) {
              const targetZ = dirZ * adjZ;
              const dist = Math.abs(lz - targetZ);
              if (dist < bestDist) {
                bestDist = dist;
                const snappedLx = alignAlongAxis(lx, m.tw * 0.5, m.effHalfX);
                const wx = m.tx + snappedLx * m.cos + targetZ * m.sin;
                const wz = m.tz - snappedLx * m.sin + targetZ * m.cos;
                const groundY = sampleLevelHeight(curLevel, wx, wz);
                const rawElev = m.baseY - groundY;
                const elevationY = Math.abs(rawElev) < 0.04 ? 0 : Number(rawElev.toFixed(3));
                bestPlacement = { x: wx, y: groundY + elevationY, z: wz, elevationY };
              }
            }
          }
        }
        if (bestPlacement) {
          return bestPlacement;
        }
      }

      const x = snap > 0 ? Math.round(rawHit.x / snap) * snap : rawHit.x;
      const z = snap > 0 ? Math.round(rawHit.z / snap) * snap : rawHit.z;
      const groundY = sampleLevelHeight(curLevel, x, z);
      return { x, y: groundY, z, elevationY: 0 };
    };

    const raycastEntity = (clientX: number, clientY: number): string | null => {
      const refs = sceneRefs.current;
      if (!refs) return null;
      updatePointer(clientX, clientY);
      raycaster.setFromCamera(pointerNdc, camera);
      const targets: THREE.Object3D[] = [
        ...refs.entitiesContainer.children,
        ...refs.fxContainer.children,
      ];
      const hits = raycaster.intersectObjects(targets, true);
      for (const hit of hits) {
        let obj: THREE.Object3D | null = hit.object;
        while (obj) {
          if (obj.userData?.entityId) return String(obj.userData.entityId);
          obj = obj.parent;
        }
      }
      return null;
    };

    const raycastWaterOrCave = (
      clientX: number,
      clientY: number
    ): { waterBodyId?: string; caveId?: string } | null => {
      const refs = sceneRefs.current;
      if (!refs) return null;
      updatePointer(clientX, clientY);
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(refs.islandContainer.children, true);
      for (const hit of hits) {
        let obj: THREE.Object3D | null = hit.object;
        while (obj) {
          if (obj.userData?.waterBodyId) {
            return { waterBodyId: String(obj.userData.waterBodyId) };
          }
          if (obj.userData?.caveId) {
            return { caveId: String(obj.userData.caveId) };
          }
          obj = obj.parent;
        }
      }
      return null;
    };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
      movedFar = false;
      shiftHeldRef.current = e.shiftKey;
      setShiftHeld(e.shiftKey);

      // Shift+drag always pans in 3D view regardless of active tool or angle lock
      if (e.shiftKey) {
        activeMode = 'none';
        activeEntityId = null;
        isPanDragRef.current = true;
        setIsPanning(true);
        controls.enabled = true;
        controls.enablePan = true;
        controls.enableRotate = false;
        if (sceneRefs.current) {
          sceneRefs.current.brushGroup.visible = false;
          sceneRefs.current.snapGhostGroup.visible = false;
        }
        return;
      }

      if (e.button === 2 && !propsRef.current.cameraAngleLocked) {
        isPanDragRef.current = true;
        setIsPanning(true);
      }

      const {
        tool: curTool,
        brush: curBrush,
        brushRadius: r,
        selectedEntityID: selId,
        level: curLevel,
      } = propsRef.current;

      const getWorldMapAccent = (): string => {
        const wmMode = propsRef.current.worldMapBrushMode ?? 'terrain';
        if (wmMode === 'eraseTerrain') return '#F2545B';
        if (wmMode === 'clearLand') return '#94A3B8';
        if (wmMode === 'paintLand') {
          const selCode = propsRef.current.selectedWorldLandCode;
          const reg = propsRef.current.worldMap?.regions.find((item) => item.code === selCode);
          return reg?.colorHex ?? '#20B46A';
        }
        return WORLD_TERRAIN_YELLOW;
      };

      // Left-click sculpts terrain, draws live 3D cave spline, or paints World Map; right/middle-click still orbits smoothly
      if (curTool === 'terrain' && e.button === 0) {
        // Fast 60 FPS Live Spline Cave Carver: ZERO React state updates or heavy rebuilds during drag!
        if (propsRef.current.worldEditorScope !== 'worldMap' && curBrush === 'carveCave') {
          const existingHit = findExistingCaveHitOnPlane(e.clientX, e.clientY);
          let startX = 0;
          let startZ = 0;
          let floorY = 1.55;
          let validStart = false;

          if (existingHit) {
            caveDrawTargetId = existingHit.caveId;
            startX = existingHit.x;
            startZ = existingHit.z;
            floorY = existingHit.floorY;
            validStart = true;
          } else {
            caveDrawTargetId = null;
            const surfHit = raycastGround(e.clientX, e.clientY);
            if (surfHit) {
              startX = surfHit.x;
              startZ = surfHit.z;
              // Clicking on a hillside/base starts right at that height; clicking high on a mountain top carves inside the mountain
              floorY =
                surfHit.y <= 3.8
                  ? Math.max(IslandTerrain.waterLevel + 0.55, surfHit.y - 0.1)
                  : Math.max(IslandTerrain.waterLevel + 0.65, Math.min(surfHit.y - 2.6, 4.5));
              validStart = true;
            } else {
              const planeHit = raycastCavePlane(e.clientX, e.clientY, 1.55);
              if (planeHit) {
                startX = planeHit.x;
                startZ = planeHit.z;
                floorY = 1.55;
                validStart = true;
              }
            }
          }

          if (validStart) {
            const nodeRadius = Math.max(2.6, Math.min(11.0, r * 0.82));
            const nodeHeight = Math.max(3.4, Math.min(7.2, 3.8 + r * 0.25));
            lockedCaveFloorY = Number(floorY.toFixed(2));
            activeMode = 'caveDraw';
            controls.enabled = false;
            if (sceneRefs.current) {
              sceneRefs.current.brushGroup.visible = false;
            }
            caveDrawPoints = [
              {
                x: startX,
                z: startZ,
                radius: nodeRadius,
                height: nodeHeight,
                floorY: lockedCaveFloorY,
              },
            ];
            caveDrawLastTip = { x: startX, z: startZ };
            updateLiveCavePreview(
              caveDrawPoints,
              lockedCaveFloorY,
              startX,
              startZ,
              nodeRadius,
              nodeHeight
            );
          }
          return;
        }

        const hit = raycastGround(e.clientX, e.clientY);
        if (hit) {
          activeMode = 'brush';
          isSculptDraggingRef.current = true;
          controls.enabled = false;
          syncSculptSceneryVisibility(true);
          if (propsRef.current.worldEditorScope === 'worldMap') {
            strokeSampledHeight = IslandTerrain.waterLevel;
            strokeModifiedHeight = false;
            lastSculptAreaRef.current = { x: hit.x, z: hit.z, radius: r };
            lastStrokeTimeMs = performance.now();
            propsRef.current.onWorldMapBrushStroke?.(hit.x, hit.z, { isStart: true });
            return;
          }
          const isCavePaintStroke = curBrush.startsWith('cave');
          if (isCavePaintStroke) {
            lockedCaveFloorY = hit.y;
            strokeSampledHeight = hit.y;
          } else {
            lockedCaveFloorY = null;
            strokeSampledHeight = sampleLevelHeight(curLevel, hit.x, hit.z);
          }
          const nearCaveForWeather =
            curBrush.startsWith('weather') &&
            (curLevel.terrain?.caves ?? []).some(
              (c) => Math.hypot(hit.x - c.x, hit.z - c.z) < r + 15
            );
          strokeModifiedHeight = HEIGHT_MODIFYING_BRUSHES.has(curBrush) || nearCaveForWeather;
          lastSculptAreaRef.current = { x: hit.x, z: hit.z, radius: r };
          lastStrokeTimeMs = performance.now();
          propsRef.current.onBrushStroke(hit.x, hit.z, {
            isStart: true,
            sampledHeight: strokeSampledHeight,
          });
        }
        return;
      }

      if (curTool === 'terrain') return;

      if (
        propsRef.current.worldEditorScope === 'worldMap' &&
        getEnvironmentType(curLevel) === 'openWorld'
      ) {
        return;
      }

      const hitEntityId = raycastEntity(e.clientX, e.clientY);

      if (
        curTool === 'move' &&
        hitEntityId &&
        (hitEntityId === selId || hitEntityId === HERO_START_ENTITY_ID)
      ) {
        if (hitEntityId !== selId) {
          propsRef.current.onSelectEntity(hitEntityId);
        }
        activeMode = 'dragEntity';
        activeEntityId = hitEntityId;
        controls.enabled = false;
        return;
      }

      if ((curTool === 'rotate' || curTool === 'scale') && selId) {
        if (curTool === 'rotate' && selId === HERO_START_ENTITY_ID && hitEntityId === HERO_START_ENTITY_ID) {
          const envNow = getEnvironmentType(curLevel);
          activeMode = 'rotateEntity';
          activeEntityId = HERO_START_ENTITY_ID;
          dragStartX = e.clientX;
          startVal = curLevel.startRotation ?? (envNow === 'sideScroller' ? 90 : 135);
          controls.enabled = false;
          return;
        }
        const ent = curLevel.entities.find((item) => item.id === selId);
        if (ent && (hitEntityId === selId || e.button === 0)) {
          if (hitEntityId === selId) {
            activeMode = curTool === 'rotate' ? 'rotateEntity' : 'scaleEntity';
            activeEntityId = selId;
            dragStartX = e.clientX;
            startVal = curTool === 'rotate' ? ent.rotation : ent.scale;
            controls.enabled = false;
          }
        }
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.shiftKey !== shiftHeldRef.current) {
        shiftHeldRef.current = e.shiftKey;
        setShiftHeld(e.shiftKey);
      }
      if (Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y) > 5) {
        movedFar = true;
      }
      const {
        tool: curTool,
        brush: curBrush,
        brushRadius: r,
        brushFalloff: falloff,
      } = propsRef.current;
      const refs = sceneRefs.current;

      if (e.shiftKey || isPanDragRef.current) {
        if (refs) {
          refs.brushGroup.visible = false;
          refs.snapGhostGroup.visible = false;
        }
        return;
      }

      // Zero-lag 60 FPS live cave spline drawing: pure O(1) horizontal floor-plane intersection!
      if (activeMode === 'caveDraw' && lockedCaveFloorY !== null) {
        const planeHit = raycastCavePlane(e.clientX, e.clientY, lockedCaveFloorY);
        if (planeHit && caveDrawPoints.length > 0) {
          const nodeRadius = Math.max(2.6, Math.min(11.0, r * 0.82));
          const nodeHeight = Math.max(3.4, Math.min(7.2, 3.8 + r * 0.25));
          const last = caveDrawPoints[caveDrawPoints.length - 1];
          const minStep = Math.max(0.85, r * 0.22);
          if (
            caveDrawPoints.length < 240 &&
            Math.hypot(planeHit.x - last.x, planeHit.z - last.z) >= minStep
          ) {
            caveDrawPoints.push({
              x: planeHit.x,
              z: planeHit.z,
              radius: nodeRadius,
              height: nodeHeight,
              floorY: lockedCaveFloorY,
            });
          }
          caveDrawLastTip = { x: planeHit.x, z: planeHit.z };
          updateLiveCavePreview(
            caveDrawPoints,
            lockedCaveFloorY,
            planeHit.x,
            planeHit.z,
            nodeRadius,
            nodeHeight
          );
        }
        return;
      }

      if (curTool === 'terrain' && refs) {
        const isWorldMapEdit =
          propsRef.current.worldEditorScope === 'worldMap' &&
          getEnvironmentType(propsRef.current.level) === 'openWorld';
        const existingCaveHover =
          !isWorldMapEdit && curBrush === 'carveCave'
            ? findExistingCaveHitOnPlane(e.clientX, e.clientY)
            : null;
        const hit = existingCaveHover
          ? _planeHit.set(existingCaveHover.x, existingCaveHover.floorY, existingCaveHover.z)
          : raycastGround(e.clientX, e.clientY);
        if (hit) {
          let accent = getBrushAccentHex(curBrush);
          if (isWorldMapEdit) {
            const wmMode = propsRef.current.worldMapBrushMode ?? 'terrain';
            if (wmMode === 'eraseTerrain') accent = '#F2545B';
            else if (wmMode === 'clearLand') accent = '#94A3B8';
            else if (wmMode === 'paintLand') {
              const selCode = propsRef.current.selectedWorldLandCode;
              const reg = propsRef.current.worldMap?.regions.find((item) => item.code === selCode);
              accent = reg?.colorHex ?? '#20B46A';
            } else {
              accent = WORLD_TERRAIN_YELLOW;
            }
          }
          refs.brushOuterMat.color.set(accent);
          refs.brushInnerMat.color.set(accent);
          refs.brushInnerRing.scale.setScalar(isWorldMapEdit ? 0.88 : getFalloffInnerRatio(falloff));
          refs.brushGroup.visible = true;
          refs.brushGroup.position.set(hit.x, hit.y + 0.16, hit.z);
          refs.brushGroup.scale.setScalar(r);
          if (activeMode === 'brush') {
            const now = performance.now();
            if (now - lastStrokeTimeMs >= 22) {
              lastStrokeTimeMs = now;
              lastSculptAreaRef.current = { x: hit.x, z: hit.z, radius: r };
              if (isWorldMapEdit) {
                propsRef.current.onWorldMapBrushStroke?.(hit.x, hit.z, { isStart: false });
                return;
              }
              if (
                HEIGHT_MODIFYING_BRUSHES.has(curBrush) ||
                (curBrush.startsWith('weather') &&
                  (propsRef.current.level.terrain?.caves ?? []).some(
                    (c) => Math.hypot(hit.x - c.x, hit.z - c.z) < r + 15
                  ))
              ) {
                strokeModifiedHeight = true;
              }
              propsRef.current.onBrushStroke(hit.x, hit.z, {
                isStart: false,
                sampledHeight: strokeSampledHeight,
              });
            }
          }
        } else {
          refs.brushGroup.visible = false;
        }
        return;
      } else if (refs) {
        refs.brushGroup.visible = false;
      }

      if (activeMode === 'dragEntity' && activeEntityId) {
        if (!movedFar) return;
        const isSideScroller = getEnvironmentType(propsRef.current.level) === 'sideScroller';
        if (activeEntityId === HERO_START_ENTITY_ID) {
          const hit = raycastGround(e.clientX, e.clientY);
          if (hit) {
            const snap = propsRef.current.gridSnap ?? 0;
            const hx = snap > 0 ? Math.round(hit.x / snap) * snap : hit.x;
            const hz = snap > 0 ? Math.round(hit.z / snap) * snap : hit.z;
            const bp = levelWorldToBoard(propsRef.current.level, hx, hz);
            propsRef.current.onMoveEntity(HERO_START_ENTITY_ID, bp);
          }
          return;
        }
        const draggedEnt = propsRef.current.level.entities.find((item) => item.id === activeEntityId);
        const useSnapStack = Boolean(
          isSideScroller ||
            draggedEnt?.buildingBlock ||
            draggedEnt?.kind === 'door' ||
            (propsRef.current.gridSnap ?? 0) > 0
        );
        if (useSnapStack) {
          const hit = raycastPlacementSurface(
            e.clientX,
            e.clientY,
            draggedEnt?.buildingBlock ? activeEntityId : null
          );
          if (hit) {
            const bp = levelWorldToBoard(propsRef.current.level, hit.x, hit.z);
            const keepElev =
              isSideScroller || draggedEnt?.buildingBlock ? hit.elevationY : draggedEnt?.elevationY;
            propsRef.current.onMoveEntity(activeEntityId, bp, keepElev);
          }
        } else {
          const hit = raycastGround(e.clientX, e.clientY);
          if (hit) {
            const bp = levelWorldToBoard(propsRef.current.level, hit.x, hit.z);
            propsRef.current.onMoveEntity(activeEntityId, bp);
          }
        }
      } else if (activeMode === 'rotateEntity' && activeEntityId) {
        const dx = e.clientX - dragStartX;
        propsRef.current.onRotateEntity(activeEntityId, (startVal + dx * 0.9) % 360);
      } else if (activeMode === 'scaleEntity' && activeEntityId) {
        const dx = e.clientX - dragStartX;
        const nextScale = Math.max(0.4, Math.min(2.6, startVal + dx * 0.008));
        propsRef.current.onScaleEntity(activeEntityId, Number(nextScale.toFixed(2)));
      } else if (
        refs &&
        curTool === 'add' &&
        (propsRef.current.isPlacingBuildingBlock ||
          (propsRef.current.gridSnap ?? 0) > 0 ||
          getEnvironmentType(propsRef.current.level) === 'sideScroller')
      ) {
        const hit = raycastPlacementSurface(e.clientX, e.clientY, null);
        if (hit) {
          const [gw, gh, gd] = propsRef.current.placementGhostSize ?? [2, 2, 2];
          const safeW = Math.max(0.12, gw);
          const safeH = Math.max(0.1, gh);
          const safeD = Math.max(0.12, gd);
          refs.snapGhostPlane.scale.set(safeW * 0.5, safeD * 0.5, 1);
          refs.snapGhostWire.scale.set(safeW * 0.5, safeH * 0.5, safeD * 0.5);
          refs.snapGhostWire.position.y = safeH * 0.5;
          refs.snapGhostGroup.rotation.y = ((propsRef.current.placementGhostRotation ?? 0) * Math.PI) / 180;
          refs.snapGhostGroup.visible = true;
          refs.snapGhostGroup.position.set(hit.x, hit.y, hit.z);
        } else {
          refs.snapGhostGroup.visible = false;
        }
      } else if (refs) {
        refs.snapGhostGroup.visible = false;
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const wasMode = activeMode;
      const wasPanDrag = isPanDragRef.current;
      isPanDragRef.current = false;
      setIsPanning(false);
      shiftHeldRef.current = e.shiftKey;
      setShiftHeld(e.shiftKey);
      activeMode = 'none';
      activeEntityId = null;
      controls.enabled = true;
      controls.enableRotate = !propsRef.current.cameraAngleLocked && !e.shiftKey;
      controls.enablePan = !propsRef.current.cameraAngleLocked || e.shiftKey;
      if (sceneRefs.current) {
        sceneRefs.current.snapGhostGroup.visible = false;
      }

      if (wasMode === 'caveDraw') {
        const commitFloorY = lockedCaveFloorY ?? 1.55;
        const commitTargetId = caveDrawTargetId;
        const rawPts = [...caveDrawPoints];
        const tip = caveDrawLastTip;
        const rNow = propsRef.current.brushRadius;
        const nodeRadius = Math.max(2.6, Math.min(11.0, rNow * 0.82));
        const nodeHeight = Math.max(3.4, Math.min(7.2, 3.8 + rNow * 0.25));
        if (tip && rawPts.length > 0) {
          const last = rawPts[rawPts.length - 1];
          if (Math.hypot(tip.x - last.x, tip.z - last.z) >= 0.45) {
            rawPts.push({
              x: tip.x,
              z: tip.z,
              radius: nodeRadius,
              height: nodeHeight,
              floorY: commitFloorY,
            });
          }
        }
        clearLiveCavePreview();
        lockedCaveFloorY = null;

        if (rawPts.length > 0) {
          const resampled = resampleCaveStrokePath(rawPts, 48);
          if (propsRef.current.onCommitCaveStroke) {
            propsRef.current.onCommitCaveStroke({
              points: resampled,
              floorY: commitFloorY,
              strength: propsRef.current.brushStrength ?? 1.0,
              targetCaveId: commitTargetId,
            });
          } else {
            // Legacy fallback if caller didn't wire onCommitCaveStroke
            for (let i = 0; i < resampled.length; i++) {
              propsRef.current.onBrushStroke(resampled[i].x, resampled[i].z, {
                isStart: i === 0,
                sampledHeight: commitFloorY,
              });
            }
          }
        }
        return;
      }

      if (wasMode === 'brush') {
        isSculptDraggingRef.current = false;
        lockedCaveFloorY = null;
        syncSculptSceneryVisibility(false);
        if (strokeModifiedHeight) {
          strokeModifiedHeight = false;
          // Finalize scatter/trees/caves seating once after live sculpt drag completes
          setSculptFinalizeNonce((n) => n + 1);
        }
        lastSculptAreaRef.current = null;
        return;
      }

      if (wasPanDrag || e.shiftKey) {
        return;
      }

      if (!movedFar && wasMode === 'none') {
        const { tool: curTool, level: curLevel, activeWorldDomain: domMode } = propsRef.current;
        if (
          propsRef.current.worldEditorScope === 'worldMap' &&
          getEnvironmentType(curLevel) === 'openWorld'
        ) {
          if (curTool !== 'terrain') {
            const hit = raycastGround(e.clientX, e.clientY);
            if (hit && propsRef.current.worldMap) {
              const res = sampleWorldMapAtWorld(propsRef.current.worldMap, hit.x, hit.z);
              propsRef.current.onSelectWorldLandFrom3D?.(
                res.land === 1 && res.regionCode > 0 ? res.regionCode : null
              );
            }
          }
          return;
        }
        if (curTool === 'add') {
          if (e.altKey) {
            const hitId = raycastEntity(e.clientX, e.clientY);
            propsRef.current.onSelectEntity(hitId);
            return;
          }
          const hit = raycastPlacementSurface(e.clientX, e.clientY, null);
          if (hit) {
            const curveGuide = propsRef.current.buildingCurveGuide;
            if (curveGuide?.enabled && curveGuide.pickMode && propsRef.current.onPickBuildingCurvePoint) {
              propsRef.current.onPickBuildingCurvePoint([hit.x, hit.z]);
              return;
            }
            propsRef.current.onAddAtPoint(
              levelWorldToBoard(curLevel, hit.x, hit.z),
              Math.abs(hit.elevationY) > 0.01 ? hit.elevationY : undefined
            );
          }
          return;
        }
        if (curTool !== 'terrain') {
          if (domMode === 'water' || domMode === 'caves') {
            const featureHit = raycastWaterOrCave(e.clientX, e.clientY);
            if (featureHit?.waterBodyId && propsRef.current.onSelectWaterBody) {
              propsRef.current.onSelectWaterBody(featureHit.waterBodyId);
              return;
            }
            if (featureHit?.caveId && propsRef.current.onSelectCave) {
              propsRef.current.onSelectCave(featureHit.caveId);
              return;
            }
          }
          const hitId = raycastEntity(e.clientX, e.clientY);
          if (hitId) {
            propsRef.current.onSelectEntity(hitId);
            return;
          }
          const featureHit = raycastWaterOrCave(e.clientX, e.clientY);
          if (featureHit?.waterBodyId && propsRef.current.onSelectWaterBody) {
            propsRef.current.onSelectWaterBody(featureHit.waterBodyId);
            return;
          }
          if (featureHit?.caveId && propsRef.current.onSelectCave) {
            propsRef.current.onSelectCave(featureHit.caveId);
            return;
          }
          propsRef.current.onSelectEntity(null);
        }
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }
      if (e.key === 'Escape' && activeMode === 'caveDraw') {
        activeMode = 'none';
        lockedCaveFloorY = null;
        clearLiveCavePreview();
        controls.enabled = true;
        return;
      }
      if (e.key === 'Shift' || e.shiftKey) {
        shiftHeldRef.current = true;
        setShiftHeld(true);
        controls.enablePan = true;
        controls.enableRotate = false;
        if (sceneRefs.current) {
          sceneRefs.current.brushGroup.visible = false;
        }
      }
      if (e.key.toLowerCase() === 'r') {
        const { selectedEntityID: selId, level: curLevel, tool: curTool } = propsRef.current;
        const delta = e.shiftKey ? -90 : 90;
        if (selId === HERO_START_ENTITY_ID) {
          const envNow = getEnvironmentType(curLevel);
          const curRot = curLevel.startRotation ?? (envNow === 'sideScroller' ? 90 : 135);
          const nextRot = ((Math.round(curRot / 90) * 90 + delta) + 360) % 360;
          propsRef.current.onRotateEntity(HERO_START_ENTITY_ID, nextRot);
          return;
        }
        if (selId) {
          const ent = curLevel.entities.find((item) => item.id === selId);
          if (ent) {
            const nextRot = ((Math.round((ent.rotation ?? 0) / 90) * 90 + delta) + 360) % 360;
            propsRef.current.onRotateEntity(selId, nextRot);
            return;
          }
        }
        if (curTool === 'add') {
          propsRef.current.onRotateActiveTool?.(delta);
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift' || !e.shiftKey) {
        const nextShift = e.shiftKey && e.key !== 'Shift';
        shiftHeldRef.current = nextShift;
        setShiftHeld(nextShift);
        if (!isPanDragRef.current) {
          controls.enableRotate = !propsRef.current.cameraAngleLocked && !nextShift;
          controls.enablePan = !propsRef.current.cameraAngleLocked || nextShift;
        }
      }
    };

    const onWindowBlur = () => {
      if (activeMode === 'caveDraw') {
        activeMode = 'none';
        lockedCaveFloorY = null;
        clearLiveCavePreview();
        controls.enabled = true;
      }
      shiftHeldRef.current = false;
      isPanDragRef.current = false;
      setShiftHeld(false);
      setIsPanning(false);
      controls.enableRotate = !propsRef.current.cameraAngleLocked;
      controls.enablePan = !propsRef.current.cameraAngleLocked;
    };

    let dom = renderer.domElement;
    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onWindowBlur);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);

    let lastResizeW = container.clientWidth || 640;
    let lastResizeH = Math.max(1, container.clientHeight || 420);
    const pendingResizeRef: { current: { w: number; h: number } | null } = { current: null };

    const applyContainerResize = (w: number, h: number) => {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      postPipeline?.setSize(w, h);
      sunCsm?.updateFrustums();
    };

    const onResize = () => {
      if (!container || disposed) return;
      const w = container.clientWidth || 640;
      const h = Math.max(1, container.clientHeight || 420);
      if (w === lastResizeW && h === lastResizeH) return;
      lastResizeW = w;
      lastResizeH = h;
      if (postPipeline?.isPrecompiling()) {
        pendingResizeRef.current = { w, h };
        return;
      }
      applyContainerResize(w, h);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    let frameId = 0;
    const timer = new THREE.Timer();
    let disposed = false;
    let compileChain: Promise<void> = Promise.resolve();
    let perfFrames = 0;
    let perfWindowStart = performance.now();
    let lastCompactFps = -1;
    let weatherSyncTimer = 0;
    let lastAnimShadowTime = -1;
    let adaptiveScale = 1.0;
    let lowFpsStreak = 0;
    let highFpsStreak = 0;

    function afterDraw(cb: () => void) {
      const gl =
        typeof renderer.getContext === 'function'
          ? (renderer.getContext() as Partial<WebGL2RenderingContext> | null)
          : null;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE ?? 0x9117, 0);
      gl.flush?.();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync?.(sync);
          return;
        }
        const state = sync && gl.getSyncParameter?.(sync, gl.SYNC_STATUS ?? 0x9114);
        if (state === (gl.UNSIGNALED ?? 0x9118)) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync?.(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    let loopScheduled = false;

    function tick() {
      loopScheduled = false;
      if (disposed || propsRef.current.renderPaused) return;
      try {
        timer.update();
        const dt = Math.min(0.1, timer.getDelta());
        const t = timer.getElapsed();
        const refs = sceneRefs.current;
        const { level: curLevel, selectedEntityID: selId } = propsRef.current;

      if (refs) {
        updateSkyClouds(refs.scene, t, curLevel.wind);
        if (refs.islandHandles) {
          refs.islandHandles.timeUniform.value = t;
          for (const th of refs.islandHandles.torchLights) {
            th.light.intensity =
              th.baseIntensity +
              Math.sin(t * 7.2 + th.phase) * 1.1 +
              Math.cos(t * 13.1 + th.phase * 1.7) * 0.5;
          }
          for (const fm of refs.islandHandles.flameMeshes) {
            fm.mesh.position.y = fm.baseY + Math.sin(t * 8.5 + fm.phase) * 0.04;
            const s = 1 + Math.sin(t * 10 + fm.phase) * 0.12;
            fm.mesh.scale.set(s, 1 + Math.cos(t * 9 + fm.phase) * 0.16, s);
          }
          updateRiverFishAnimations(refs.islandHandles.riverFish, t);
          const winFlags = window as unknown as {
            __makerForceScareCaveId?: string | null;
            __makerDisableCaveXRay?: boolean;
          };
          updateCaveInteractiveAnimations(
            refs.islandHandles.caveInteractiveHandles,
            t,
            null,
            winFlags.__makerForceScareCaveId ?? null
          );
          const xRayActive =
            propsRef.current.activeWorldDomain === 'caves' &&
            winFlags.__makerDisableCaveXRay !== true;
          refs.islandHandles.setCaveXRayMode?.(xRayActive);
        }

        const liveWindFactor = computeWeatherWindFactor(curLevel.weather, curLevel.wind);
        refs.canopyTimeUniform.value = t;
        refs.canopyWindUniform.value = liveWindFactor;
        if (refs.islandHandles) {
          refs.islandHandles.windUniform.value = liveWindFactor;
        }
        for (const updateCustom of refs.customUpdaters) {
          updateCustom(dt);
        }

        // Update live FX Emitters (auto-pauses when entering Play Mode)
        const isFxPaused = propsRef.current.fxPaused;
        refs.fxEmitters.forEach((fx) => {
          fx.setPaused(isFxPaused);
          fx.update(dt, refs.camera);
        });

        // Animate moving platforms cleanly without scanning unrelated entities every frame
        if (refs.hasDynamicShadows || refs.customUpdaters.length > 0) {
          if (refs.hasDynamicShadows) {
            for (let ei = 0; ei < curLevel.entities.length; ei++) {
              const ent = curLevel.entities[ei];
              if (ent.kind !== 'platform' || !ent.platformRunning || ent.platformerAddon) continue;
              const grp = refs.entityGroups.get(ent.id);
              if (!grp) continue;
              const [sx, sz] = levelBoardToWorld(curLevel, ent.position);
              const sy =
                sampleLevelHeight(curLevel, sx, sz) +
                PlatformMotion.hover(ent.platformPreset) +
                (ent.elevationY ?? 0);
              const endBp = ent.platformEnd ?? ent.position;
              const [ex, ez] = levelBoardToWorld(curLevel, endBp);
              const ey =
                sampleLevelHeight(curLevel, ex, ez) +
                PlatformMotion.hover(ent.platformPreset) +
                (ent.elevationY ?? 0);
              const pose = PlatformMotion.pose(
                t,
                [sx, sy, sz],
                [ex, ey, ez],
                ent.platformSpeed,
                ent.platformWait,
                ent.platformMotion
              );
              grp.position.set(pose.position[0], pose.position[1], pose.position[2]);
              if (ent.platformMotion === 'spin') {
                grp.rotation.y = pose.yaw;
              } else if (ent.platformMotion === 'pendulum') {
                grp.rotation.z = pose.swingAngle ?? 0;
              }
            }
          }
          if (t - lastAnimShadowTime >= 0.08) {
            lastAnimShadowTime = t;
            refs.markShadowDirty();
          }
        }
        // Subtle editor preview animations for modular platformer add-ons
        for (let ei = 0; ei < curLevel.entities.length; ei++) {
          const ent = curLevel.entities[ei];
          const pa = ent.platformerAddon;
          if (!pa) continue;
          const grp = refs.entityGroups.get(ent.id);
          if (!grp) continue;
          const fb = grp.userData?.firebarPivot as THREE.Object3D | undefined;
          if (fb) fb.rotation.z = t * (pa.speed ?? 1.8);
          const pp = grp.userData?.pendulumPivot as THREE.Object3D | undefined;
          if (pp) pp.rotation.z = Math.sin(t * (pa.speed ?? 1.9)) * 0.85;
          const bp = grp.userData?.barrelPivot as THREE.Object3D | undefined;
          if (bp && pa.cannonAutoRotate) {
            bp.rotation.z = Math.sin(t * 1.4) * 0.65;
          } else if (bp && pa.cannonAngleDeg !== undefined) {
            bp.rotation.z = THREE.MathUtils.degToRad(90 - pa.cannonAngleDeg);
          }
          const cm = grp.userData?.crystalMesh as THREE.Object3D | undefined;
          if (cm) {
            cm.rotation.y = t * 1.8;
            cm.position.y = 0.85 + Math.sin(t * 2.6) * 0.1;
          }
          const sm = grp.userData?.starMesh as THREE.Object3D | undefined;
          if (sm) {
            sm.rotation.y = t * 2.0;
            sm.position.y = 1.0 + Math.sin(t * 2.4) * 0.1;
          }
        }
        for (let fi = 0; fi < refs.floatSpinObjects.length; fi++) {
          refs.floatSpinObjects[fi].rotation.y += dt * 1.4;
        }
        for (let vi = 0; vi < refs.animatedVillageGroups.length; vi++) {
          const grp = refs.animatedVillageGroups[vi];
          if (grp.userData?.wanderingChicken) {
            const ph = Number(grp.userData.wanderPhase ?? 0);
            grp.rotation.y += Math.sin(t * 0.9 + ph) * dt * 0.65;
            grp.rotation.x = Math.max(0, Math.sin(t * 4.5 + ph)) * 0.22;
          }
          updateRpgLivingVillageAnimations(grp, t);
        }
        for (let ti = 0; ti < refs.torchFlameObjects.length; ti++) {
          const tf = refs.torchFlameObjects[ti];
          tf.mesh.position.y = tf.baseY + Math.sin(t * 9.2 + tf.phase) * 0.025;
          const sc = 1 + Math.sin(t * 11 + tf.phase) * 0.14;
          tf.mesh.scale.set(sc, 1 + Math.cos(t * 10 + tf.phase) * 0.18, sc);
        }

        // Show subtle build grid when Grid Snap is active & adding/building/moving blocks
        const snap = propsRef.current.gridSnap ?? 0;
        const showGrid =
          snap > 0 &&
          (propsRef.current.tool === 'add' || Boolean(propsRef.current.isPlacingBuildingBlock));
        refs.buildGridHelper.visible = showGrid;
        if (showGrid) {
          refs.buildGridHelper.position.y = sampleLevelHeight(curLevel, 0, 0) + 0.04;
        }

        // Selection ring placement
        if (selId && refs.entityGroups.has(selId)) {
          const target = refs.entityGroups.get(selId)!;
          refs.selectionRing.visible = true;
          refs.selectionRing.position.set(
            target.position.x,
            target.position.y + 0.08,
            target.position.z
          );
          const pulse = 1 + Math.sin(t * 3.5) * 0.06;
          refs.selectionRing.scale.setScalar(pulse);
        } else {
          refs.selectionRing.visible = false;
        }

        if (refs.dropPreviewGroup.visible) {
          const dropPulse = 1 + Math.sin(t * 7.0) * 0.09;
          refs.dropPreviewGroup.scale.set(dropPulse, 1, dropPulse);
          refs.dropPreviewGroup.rotation.y += dt * 1.6;
        }

        // Weather particle animation (throttled ~30Hz GPU buffer upload)
        if (refs.weatherPoints) {
          weatherSyncTimer += dt;
          if (weatherSyncTimer >= 0.032) {
            const wDt = Math.min(0.1, weatherSyncTimer);
            weatherSyncTimer = 0;
            const posAttr = refs.weatherPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
            const kind = refs.weatherPoints.userData.weather;
            for (let i = 0; i < posAttr.count; i++) {
              let px = posAttr.getX(i);
              let py = posAttr.getY(i);
              let pz = posAttr.getZ(i);
              if (kind === 'fireflies') {
                px += Math.sin(t * 0.9 + i * 1.3) * wDt * 0.7;
                py += Math.cos(t * 1.4 + i * 0.7) * wDt * 0.45;
                pz += Math.cos(t * 0.8 + i * 1.1) * wDt * 0.7;
                if (py < 0.4) py = 0.6;
                if (py > 8.5) py = 7.2;
              } else if (kind === 'leaves') {
                py -= wDt * 2.1;
                px += Math.sin(t * 1.5 + i) * wDt * 1.3;
                pz += Math.cos(t * 1.2 + i * 0.5) * wDt * 0.7;
                if (py < -1) {
                  py = 26;
                  px = (Math.random() - 0.5) * 260;
                  pz = (Math.random() - 0.5) * 260;
                }
              } else {
                const isStorm = kind === 'storm';
                const isRain = kind === 'rain' || isStorm;
                py -= wDt * (isStorm ? 26 : isRain ? 18 : 3.2);
                px += isStorm ? wDt * 7.5 : isRain ? wDt * 1.4 : Math.sin(t + i) * wDt * 0.6;
                if (py < -2) {
                  py = 26;
                  px = (Math.random() - 0.5) * 260;
                  pz = (Math.random() - 0.5) * 260;
                }
              }
              posAttr.setXYZ(i, px, py, pz);
            }
            posAttr.needsUpdate = true;
          }
        }
      }

        if (refs?.flyActive) {
          const alpha = 1 - Math.exp(-dt * 8.5);
          refs.camera.position.lerp(refs.flyTargetPos, alpha);
          refs.controls.target.lerp(refs.flyTargetLook, alpha);
          if (
            refs.camera.position.distanceToSquared(refs.flyTargetPos) < 0.02 &&
            refs.controls.target.distanceToSquared(refs.flyTargetLook) < 0.01
          ) {
            refs.camera.position.copy(refs.flyTargetPos);
            refs.controls.target.copy(refs.flyTargetLook);
            refs.flyActive = false;
          }
        }
        controls.update();
        refs?.islandHandles?.chunkedTerrain?.updateLOD(
          refs.camera.position,
          propsRef.current.terrainQuality ?? 'balanced'
        );
        if (refs?.islandHandles?.grassSystem) {
          refs.islandHandles.grassSystem.update(
            refs.camera,
            refs.sun,
            refs.hemi,
            refs.scene,
            t,
            refs.islandHandles.windUniform.value
          );
        }
        if (refs?.wildlifeSystem && refs.islandContainer.visible) {
          refs.wildlifeSystem.update(dt, t);
        }
        if (refs?.islandHandles?.volumetricAtmosphere) {
          if (cachedAtmoLevelRef !== curLevel || !cachedAtmoState) {
            cachedAtmoLevelRef = curLevel;
            cachedAtmoState = computeAtmosphereState(curLevel);
          }
          refs.islandHandles.volumetricAtmosphere.update(
            refs.camera,
            dt,
            t,
            cachedAtmoState,
            refs.controls.target
          );
        }
        syncSkyDomeToCamera(scene, camera.position);
        try {
          if (postPipeline) {
            _sunDirScratch.copy(sun.position).sub(sun.target.position);
            if (scene.fog instanceof THREE.FogExp2) {
              _volFogColorScratch.copy(scene.fog.color);
            } else if (scene.background instanceof THREE.Color) {
              _volFogColorScratch.copy(scene.background);
            }
            const bgHorizon = scene.background instanceof THREE.Color ? scene.background : _volFogColorScratch;
            _volFogInscatterScratch.copy(bgHorizon).lerp(sun.color, 0.56);
            const isWmNow = propsRef.current.worldEditorScope === 'worldMap' && Boolean(propsRef.current.worldMap);
            _volFogCfgScratch.enabled = curLevel.volumetricFogEnabled ?? true;
            _volFogCfgScratch.density = (curLevel.volumetricFogDensity ?? 1.0) * (isWmNow ? 0.22 : 1.0);
            _volFogCfgScratch.height = curLevel.volumetricFogHeight ?? 2.2;
            _volFogCfgScratch.softness = curLevel.volumetricFogSoftness ?? 8.5;
            _volFogCfgScratch.sharpness = curLevel.volumetricFogSharpness ?? 0.3;
            _volFogCfgScratch.noise = curLevel.volumetricFogNoise ?? 0.95;
            _volFogCfgScratch.patchiness = curLevel.volumetricFogPatchiness ?? 0.45;
            _volFogCfgScratch.speed = curLevel.volumetricFogSpeed ?? 0.75;
            _volFogCfgScratch.wind = curLevel.wind ?? 0.45;

            postPipeline.render({
              config: propsRef.current.project.postProcessing,
              volumetricFog: _volFogCfgScratch,
              sunPosition: _sunDirScratch,
              sunColor: sun.color,
              sunIntensity: sun.intensity,
              isDungeon: getEnvironmentType(curLevel) === 'dungeon',
              dt,
              elapsedTime: t,
            });
          } else {
            renderer.render(scene, camera);
          }
        } catch (renderErr) {
          console.error('WorldViewport post-pipeline error; falling back to direct render:', renderErr);
          renderer.render(scene, camera);
        }
        perfFrames++;
        const nowMs = performance.now();
        const elapsedMs = nowMs - perfWindowStart;
        const perfUpdateIntervalMs = showPerfHudRef.current ? 350 : 900;
        if (elapsedMs >= perfUpdateIntervalMs) {
          const fps = Math.round((perfFrames * 1000) / Math.max(1, elapsedMs));
          if (showPerfHudRef.current || lastCompactFps < 0 || Math.abs(fps - lastCompactFps) >= 2) {
            lastCompactFps = fps;
            const frameMs = Number((elapsedMs / Math.max(1, perfFrames)).toFixed(1));
            const renderInfo = renderer.info?.render as { calls?: number; triangles?: number } | undefined;
            const backendObj = renderer.backend as { isWebGPUBackend?: boolean } | undefined;
            const heap = showPerfHudRef.current ? readJsHeapUsageMB() : undefined;
            const snapshot = {
              fps,
              frameMs,
              calls: renderInfo?.calls ?? 0,
              triangles: renderInfo?.triangles ?? 0,
              backend: backendObj?.isWebGPUBackend ? 'WebGPU' : 'WebGL2',
              heapMB: heap?.usedMB,
              heapLimitMB: heap?.limitMB,
            };
            latestPerfSnapshotRef.current = snapshot;
            if (showPerfHudRef.current) {
              setPerfStats(snapshot);
            } else {
              if (compactFpsDotRef.current) {
                compactFpsDotRef.current.className = `w-2 h-2 rounded-full ${
                  fps >= 50 ? 'bg-emerald-400' : fps >= 30 ? 'bg-amber-300' : 'bg-rose-400'
                }`;
              }
              if (compactFpsTextRef.current) {
                compactFpsTextRef.current.textContent = fps > 0 ? `${fps} FPS` : '-- FPS';
              }
              if (compactMsTextRef.current) {
                compactMsTextRef.current.textContent = `${frameMs.toFixed(0)}ms`;
              }
            }
          }
          // Adaptive FPS governor for World Editor viewport (never disables fog/atmosphere)
          if (!isSoftwareGl && !postPipeline?.isPrecompiling()) {
            if (fps < 42) {
              lowFpsStreak++;
              highFpsStreak = 0;
              if (lowFpsStreak >= 3 && adaptiveScale > 0.72) {
                lowFpsStreak = 0;
                adaptiveScale = adaptiveScale > 0.88 ? 0.82 : 0.72;
                refs?.islandHandles?.grassSystem?.setDynamicViewScale(adaptiveScale);
                if (adaptiveScale <= 0.82) {
                  sunCsm?.setQualityTier('performance');
                }
                const cw = container?.clientWidth || 800;
                const ch = container?.clientHeight || 600;
                renderer.setPixelRatio(computeEffectivePixelRatio(cw, ch, isSoftwareGl, adaptiveScale));
                renderer.setSize(cw, ch, false);
                postPipeline?.setSize(cw, ch);
              }
            } else if (fps >= 55 && adaptiveScale < 1) {
              highFpsStreak++;
              lowFpsStreak = 0;
              if (highFpsStreak >= 8) {
                highFpsStreak = 0;
                adaptiveScale = adaptiveScale < 0.76 ? 0.82 : 1.0;
                refs?.islandHandles?.grassSystem?.setDynamicViewScale(adaptiveScale);
                if (adaptiveScale >= 1.0) {
                  sunCsm?.setQualityTier('balanced');
                }
                const cw = container?.clientWidth || 800;
                const ch = container?.clientHeight || 600;
                applyContainerResize(cw, ch);
              }
            } else {
              lowFpsStreak = Math.max(0, lowFpsStreak - 1);
            }
          }
          perfFrames = 0;
          perfWindowStart = nowMs;
        }
      } catch (tickErr) {
        console.error('WorldViewport tick error:', tickErr);
      } finally {
        if (!disposed && !propsRef.current.renderPaused) {
          loopScheduled = true;
          if (isSoftwareGl) {
            afterDraw(tick);
          } else {
            frameId = requestAnimationFrame(tick);
          }
        }
      }
    }

    const scheduleTick = () => {
      if (disposed || propsRef.current.renderPaused || loopScheduled) return;
      loopScheduled = true;
      frameId = requestAnimationFrame(tick);
    };

    const switchToWebGLFallback = async (): Promise<boolean> => {
      if (disposed) return false;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      loopScheduled = false;
      dom.removeEventListener('pointerdown', onPointerDown);
      controls.removeEventListener('change', saveCurrentCameraPose);
      controls.dispose();
      sunCsm?.dispose();
      sunCsm = null;
      postPipeline?.dispose();
      postPipeline = null;
      envTex?.dispose();
      envTex = null;
      try {
        renderer.dispose();
      } catch {
        // ignore dispose errors on failed adapter
      }
      renderer = createMakerRenderer(isSoftwareGl, true);
      renderer.setSize(container.clientWidth || 640, container.clientHeight || 420);
      container.innerHTML = '';
      container.appendChild(renderer.domElement);
      dom = renderer.domElement;
      controls = new OrbitControls(camera, dom);
      dom.addEventListener('pointerdown', onPointerDown);
      controls.target.set(0, 1.2, 0);
      controls.enableDamping = !isSoftwareGl;
      controls.dampingFactor = 0.08;
      controls.minDistance = 8;
      controls.maxDistance = propsRef.current.worldEditorScope === 'worldMap' ? 1600 : 360;
      controls.maxPolarAngle = Math.PI * 0.47;
      controls.enableRotate = !propsRef.current.cameraAngleLocked && !shiftHeldRef.current;
      controls.enablePan = !propsRef.current.cameraAngleLocked || shiftHeldRef.current;
      controls.update();
      controls.addEventListener('change', saveCurrentCameraPose);
      controls.addEventListener('start', cancelCameraFly);
      if (sceneRefs.current) {
        sceneRefs.current.renderer = renderer;
        sceneRefs.current.controls = controls;
      }
      try {
        await initMakerRenderer(renderer);
        if (disposed) return false;
        sanitizeObjectMorphTargets(scene, {
          maxLayers: getRendererMaxTextureArrayLayers(renderer),
          cloneSharedGeometries: true,
        });
        envTex = setupSceneEnvironment(scene, renderer);
        postPipeline = new PostProcessingPipeline(
          renderer,
          scene,
          camera,
          container.clientWidth || 640,
          container.clientHeight || 420,
          isSoftwareGl
        );
        if (sceneRefs.current) {
          sceneRefs.current.postPipeline = postPipeline;
        }
        applyLiveRendererQuality(
          renderer,
          sun,
          postPipeline,
          container.clientWidth || 640,
          container.clientHeight || 420,
          isSoftwareGl,
          propsRef.current.resolutionScale,
          propsRef.current.shadowQuality
        );
        if (sceneRefs.current) {
          sceneRefs.current.rendererInitialized = true;
          sceneRefs.current.markShadowDirty();
        }
        return true;
      } catch (fallbackErr) {
        console.error('WebGL fallback renderer init failed:', fallbackErr);
        return false;
      }
    };

    void (async () => {
      let initOk = false;
      try {
        await initMakerRenderer(renderer);
        if (!isSoftwareGl && isWebGPUFallbackAdapter(renderer)) {
          console.warn('WorldViewport WebGPU returned a software fallback adapter; switching to hardware WebGL2.');
          initOk = await switchToWebGLFallback();
        } else {
          initOk = true;
        }
      } catch (err) {
        console.warn('WebGPU renderer init failed; falling back to WebGL backend:', err);
        initOk = await switchToWebGLFallback();
      }
      if (disposed || !initOk) return;
      sanitizeObjectMorphTargets(scene, {
        maxLayers: getRendererMaxTextureArrayLayers(renderer),
        cloneSharedGeometries: true,
      });
      // Yield one frame after device init so PMREM & PostProcessing don't stack onto mount long tasks
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (disposed) return;
      const backend = renderer.backend as {
        isWebGPUBackend?: boolean;
        device?: GPUDevice;
      } | undefined;
      if (backend?.isWebGPUBackend === true) {
        if (!isSoftwareGl) {
          const initLevel = propsRef.current.level;
          const initPointLights = initLevel.entities.filter((e) => e.kind === 'light').length;
          if (!isIOSDevice() && (getEnvironmentType(initLevel) === 'dungeon' || initPointLights >= 6)) {
            renderer.lighting = new ClusteredLighting(128, 64, 16, 16);
          }
          if (initLevel.entities.some((e) => e.meshletEnabled)) {
            renderer.drawingPipeline = createOptInMeshletPipeline(renderer);
          }
        }
        if (backend.device?.lost) {
          void backend.device.lost.then((info) => {
            if (disposed || info.reason === 'destroyed') return;
            console.warn('WorldViewport WebGPU device lost; recovering with WebGL2 fallback:', info.message);
            void switchToWebGLFallback().then((ok) => {
              if (ok && !disposed) scheduleTick();
            });
          });
        }
      }
      if (!envTex) {
        envTex = setupSceneEnvironment(scene, renderer);
      }
      if (!postPipeline) {
        postPipeline = new PostProcessingPipeline(
          renderer,
          scene,
          camera,
          container.clientWidth || 640,
          container.clientHeight || 420,
          isSoftwareGl
        );
        if (sceneRefs.current) {
          sceneRefs.current.postPipeline = postPipeline;
        }
        applyLiveRendererQuality(
          renderer,
          sun,
          postPipeline,
          container.clientWidth || 640,
          container.clientHeight || 420,
          isSoftwareGl,
          propsRef.current.resolutionScale,
          propsRef.current.shadowQuality
        );
        if (sceneRefs.current) {
          sceneRefs.current.rendererInitialized = true;
          sceneRefs.current.markShadowDirty();
        }
        try {
          await postPipeline.precompileAsync(propsRef.current.project.postProcessing);
        } catch {
          // ignore precompile errors on fallback adapters
        }
        if (disposed) return;
        const nextResize = pendingResizeRef.current;
        if (nextResize) {
          pendingResizeRef.current = null;
          applyContainerResize(nextResize.w, nextResize.h);
        }
      }
      resumeLoopRef.current = scheduleTick;
      if (!propsRef.current.renderPaused) {
        tick();
      }
    })();

    return () => {
      disposed = true;
      islandBuildAbortRef.current?.abort();
      islandBuildAbortRef.current = null;
      scatterReseatAbortRef.current?.abort();
      scatterReseatAbortRef.current = null;
      entityBuildAbortRef.current?.abort();
      entityBuildAbortRef.current = null;
      resumeLoopRef.current = null;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      saveCurrentCameraPose();
      ro.disconnect();
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onWindowBlur);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
      controls.removeEventListener('change', saveCurrentCameraPose);
      controls.removeEventListener('start', cancelCameraFly);
      controls.dispose();
      timer.dispose();
      if (sceneRefs.current) {
        sceneRefs.current.rendererInitialized = false;
        sceneRefs.current.islandHandles?.chunkedTerrain?.dispose();
        sceneRefs.current.islandHandles?.grassSystem?.dispose();
        sceneRefs.current.islandHandles?.volumetricAtmosphere?.dispose();
        sceneRefs.current.wildlifeSystem?.dispose();
        sceneRefs.current.wildlifeSystem = null;
        sceneRefs.current.islandHandles = null;
        sceneRefs.current.groundMeshes = [];
        sceneRefs.current.animatedVillageGroups = [];
        sceneRefs.current.fxEmitters.forEach((fx) => fx.dispose());
        sceneRefs.current.fxEmitters.clear();
        sceneRefs.current = null;
      }
      sunCsm?.dispose();
      sunCsm = null;
      postPipeline?.dispose();
      envTex?.dispose();
      disposeObject3D(scene);
      scene.background = null;
      scene.environment = null;
      scene.fog = null;
      scene.clear();
      const preCapturedGl =
        typeof renderer.getContext === 'function' ? renderer.getContext() : null;
      try {
        renderer.dispose();
      } catch {
        // ignore if device already lost
      }
      forceReleaseRendererContext(renderer, preCapturedGl);
      container.innerHTML = '';
    };
  }, []);

  // Resume render loop immediately when modal overlays close
  useEffect(() => {
    if (!renderPaused) {
      resumeLoopRef.current?.();
    }
  }, [renderPaused]);

  // Register live 3D camera capture & preview bridge for Story Director
  useEffect(() => {
    registerDirectorViewportBridge({
      captureCurrentShot: (nameHint?: string) => {
        const refs = sceneRefs.current;
        const curLevel = propsRef.current.level;
        if (!refs || !curLevel) return null;
        const t = refs.controls.target;
        const c = refs.camera.position;
        const bp = levelWorldToBoard(curLevel, t.x, t.z);
        const groundY = sampleLevelHeight(curLevel, t.x, t.z);
        const dx = c.x - t.x;
        const dy = c.y - t.y;
        const dz = c.z - t.z;
        const horiz = Math.hypot(dx, dz);
        const distance = THREE.MathUtils.clamp(Math.hypot(dx, dy, dz), 3, 28);
        const yaw = Number(((Math.atan2(dx, dz) * 180) / Math.PI).toFixed(1));
        const pitch = Number(
          THREE.MathUtils.clamp((Math.atan2(dy, Math.max(0.01, horiz)) * 180) / Math.PI, 5, 70).toFixed(1)
        );
        const heightOffset = Number(THREE.MathUtils.clamp(t.y - groundY, 0, 6).toFixed(2));
        return {
          id: `shot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          name: nameHint?.trim() || 'Captured Shot',
          targetMode: 'point',
          point: bp,
          yaw,
          pitch,
          distance: Number(distance.toFixed(1)),
          heightOffset,
          fov: Math.round(refs.camera.fov || 48),
        };
      },
      previewShot: (shot: StoryCameraShot, targetLevel: GameLevel) => {
        const refs = sceneRefs.current;
        if (!refs) return;
        const ent =
          shot.targetMode === 'entity' && shot.targetEntityId
            ? targetLevel.entities.find((e) => e.id === shot.targetEntityId)
            : undefined;
        const pt = ent?.position ?? shot.point ?? { x: 0.5, y: 0.5 };
        const [tx, tz] = levelBoardToWorld(targetLevel, pt);
        const groundY = sampleLevelHeight(targetLevel, tx, tz);
        const lookY = groundY + (shot.heightOffset ?? 1.2);
        const yawRad = ((shot.yaw ?? 25) * Math.PI) / 180;
        const pitchRad = (THREE.MathUtils.clamp(shot.pitch ?? 18, 5, 70) * Math.PI) / 180;
        const dist = THREE.MathUtils.clamp(shot.distance ?? 7.5, 3, 28);
        const cosP = Math.cos(pitchRad);

        refs.controls.target.set(tx, lookY, tz);
        refs.camera.position.set(
          tx + Math.sin(yawRad) * cosP * dist,
          lookY + Math.sin(pitchRad) * dist,
          tz + Math.cos(yawRad) * cosP * dist
        );
        if (shot.fov && Math.abs(refs.camera.fov - shot.fov) > 0.25) {
          refs.camera.fov = THREE.MathUtils.clamp(shot.fov, 32, 68);
          refs.camera.updateProjectionMatrix();
        }
        refs.controls.update();
      },
    });
    return () => {
      registerDirectorViewportBridge(null);
    };
  }, []);

  // Dynamically update pixel ratio scaling & shadow map quality without reloading scene
  useEffect(() => {
    const refs = sceneRefs.current;
    const container = mountRef.current;
    if (!refs || !container || !refs.rendererInitialized || refs.postPipeline?.isPrecompiling()) {
      return;
    }
    applyLiveRendererQuality(
      refs.renderer,
      refs.sun,
      refs.postPipeline,
      container.clientWidth || 640,
      container.clientHeight || 420,
      refs.isSoftwareGl,
      resolutionScale,
      shadowQuality
    );
  }, [resolutionScale, shadowQuality]);

  // Rebuild island & atmosphere when terrain, environment, biome, visualStyle, sky, timeOfDay, weather change
  // Lightweight real-time atmosphere, skybox, clouds & lighting update (no terrain/tree rebuild!)
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;
    const isWmMode = worldEditorScope === 'worldMap' && Boolean(worldMap);
    applyAtmosphere(refs.scene, refs.sun, refs.hemi, level, refs.renderer, undefined, {
      isWorldMapMode: isWmMode,
    });
    applyAtmosphereQualityToScene(refs.scene, propsRef.current.terrainQuality ?? 'balanced');
    refs.markShadowDirty();
  }, [
    level.id,
    level.environmentType,
    level.biome,
    level.weather,
    level.visualStyle,
    level.sky,
    level.fog,
    level.vistaHeightFog,
    level.sunAngle,
    level.sunVisible,
    level.sunSize,
    level.sunGlow,
    level.sunElevation,
    level.timeOfDay,
    level.cloudDensity,
    level.cloudOpacity,
    level.cloudSoftness,
    level.cloudHeight,
    level.cloudSpeed,
    level.cloudScale,
    level.stormClouds,
    level.stormIntensity,
    level.stormLightning,
    level.sunIntensityScale,
    level.ambientIntensityScale,
    level.atmosphereWarmth,
    level.moonMode,
    level.moonPhase,
    level.moonSize,
    level.moonGlow,
    level.moonColor,
    level.moonAngle,
    level.moonElevation,
    level.starIntensity,
    level.starDensity,
    level.starSize,
    level.starTwinkle,
    level.starTint,
    level.auroraEnabled,
    level.auroraIntensity,
    level.auroraSpeed,
    level.auroraHeight,
    level.auroraSpread,
    level.auroraColorA,
    level.auroraColorB,
    level.wind,
    level.volumetricFogEnabled,
    level.volumetricFogDensity,
    level.volumetricFogHeight,
    level.volumetricFogSoftness,
    level.volumetricFogSharpness,
    level.volumetricFogNoise,
    level.volumetricFogPatchiness,
    level.volumetricFogSpeed,
    level.godRaysEnabled,
    level.godRaysIntensity,
    level.atmosphericDust,
    worldEditorScope,
    worldMap,
  ]);

  // Lightweight weather particle rebuild
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;
    if (refs.weatherPoints) {
      refs.scene.remove(refs.weatherPoints);
      disposeObject3D(refs.weatherPoints);
      refs.weatherPoints = null;
    }
    const wp = buildWeatherParticles(level.weather);
    if (wp) {
      refs.weatherPoints = wp;
      refs.scene.add(wp);
    }
  }, [level.weather, level.id]);

  // Memoize expensive structural JSON signatures so 45Hz terrain sculpt revisions do zero JSON.stringify churn
  const cavesSig = useMemo(
    () => JSON.stringify(level.terrain?.caves ?? []),
    [level.terrain?.caves]
  );
  const roadsSig = useMemo(
    () => JSON.stringify(level.terrain?.roads ?? []),
    [level.terrain?.roads]
  );
  const mountainCfgSig = useMemo(
    () => JSON.stringify(level.terrain?.mountainConfig ?? null),
    [level.terrain?.mountainConfig]
  );
  const waterBodiesGeoSig = useMemo(
    () =>
      JSON.stringify(
        (level.terrain?.waterBodies ?? []).map((wb) => [
          wb.id,
          wb.kind,
          wb.center,
          wb.points,
          wb.radiusX,
          wb.radiusZ,
          wb.width,
          wb.shoreNoise,
        ])
      ),
    [level.terrain?.waterBodies]
  );
  const entitiesCoreSig = useMemo(
    () => JSON.stringify(stripLiveVariantFieldsForStructKey(level.entities)),
    [level.entities]
  );

  // Rebuild island mesh OR perform fast in-place GPU sculpt update during live brush strokes
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;

    const env = getEnvironmentType(level);
    const isWorldMapScope = worldEditorScope === 'worldMap' && env === 'openWorld';
    const landRadius = getTerrainRadius(level.terrain);
    refs.controls.maxDistance = isWorldMapScope
      ? 1600
      : Math.max(360, landRadius * 2.5);
    const activeRegionForFrame = worldMap?.regions.find((r) => r.code === activeWorldRegionCode);
    const originKey = activeRegionForFrame?.origin
      ? `${Math.round(activeRegionForFrame.origin[0])}:${Math.round(activeRegionForFrame.origin[1])}`
      : '0:0';
    const frameKey = `${project.id}:${
      isWorldMapScope ? 'worldMap' : `${level.id}:${originKey}:${Math.round(landRadius)}`
    }:${env}`;
    if (refs.lastFramedEnvKey !== frameKey) {
      refs.lastFramedEnvKey = frameKey;
      const savedPose = savedCameraPoseMap.get(frameKey);
      if (savedPose) {
        refs.camera.position.set(savedPose.pos[0], savedPose.pos[1], savedPose.pos[2]);
        refs.controls.target.set(savedPose.target[0], savedPose.target[1], savedPose.target[2]);
      } else if (isWorldMapScope) {
        refs.camera.position.set(220, 560, 660);
        refs.controls.target.set(0, 1.2, 0);
      } else if (env === 'sideScroller') {
        refs.camera.position.set(0, 8, 30);
        refs.controls.target.set(0, 1.5, 0);
      } else if (level.gameplayMode === 'rpg') {
        const isInterior = Boolean(level.rpgConfig?.isInterior);
        if (isInterior) {
          refs.camera.position.set(16, 17, 16);
          refs.controls.target.set(0, 1.2, 0);
        } else {
          refs.camera.position.set(23, 25, 25);
          refs.controls.target.set(0, 1.4, -3);
        }
      } else if (env === 'dungeon' || env === 'castle') {
        refs.camera.position.set(0, 32, 46);
        refs.controls.target.set(0, 1.2, 0);
      } else {
        let minX = Infinity;
        let maxX = -Infinity;
        let minZ = Infinity;
        let maxZ = -Infinity;

        if (worldMap && activeWorldRegionCode && activeWorldRegionCode > 0) {
          const ox = activeRegionForFrame?.origin?.[0] ?? 0;
          const oz = activeRegionForFrame?.origin?.[1] ?? 0;
          const wmSize = worldMap.gridSize;
          const wmWidth = wmSize + 1;
          const wmRadius =
            typeof worldMap.worldRadius === 'number' && worldMap.worldRadius > 0
              ? worldMap.worldRadius
              : 640;
          const wmStep = (2 * wmRadius) / wmSize;
          for (let row = 0; row <= wmSize; row++) {
            const wz = -wmRadius + row * wmStep;
            const lx = Math.abs(wz - oz);
            if (lx > landRadius) continue;
            const rowOff = row * wmWidth;
            for (let col = 0; col <= wmSize; col++) {
              const idx = rowOff + col;
              if (worldMap.landMask[idx] !== 1) continue;
              if ((worldMap.regionGrid[idx] ?? 0) !== activeWorldRegionCode) continue;
              const localX = -wmRadius + col * wmStep - ox;
              const localZ = wz - oz;
              if (Math.abs(localX) > landRadius) continue;
              if (localX < minX) minX = localX;
              if (localX > maxX) maxX = localX;
              if (localZ < minZ) minZ = localZ;
              if (localZ > maxZ) maxZ = localZ;
            }
          }
        }

        if ((!Number.isFinite(minX) || maxX <= minX || maxZ <= minZ) && level.terrain) {
          const tSize = level.terrain.size;
          const tWidth = tSize + 1;
          const tStep = (2 * landRadius) / tSize;
          const seaCutoff = IslandTerrain.waterLevel - 0.15;
          for (let row = 0; row <= tSize; row++) {
            const vz = -landRadius + row * tStep;
            const rowOff = row * tWidth;
            for (let col = 0; col <= tSize; col++) {
              if (level.terrain.heights[rowOff + col] <= seaCutoff) continue;
              const vx = -landRadius + col * tStep;
              if (vx < minX) minX = vx;
              if (vx > maxX) maxX = vx;
              if (vz < minZ) minZ = vz;
              if (vz > maxZ) maxZ = vz;
            }
          }
        }

        if (Number.isFinite(minX) && maxX > minX && maxZ > minZ) {
          const cx = (minX + maxX) * 0.5;
          const cz = (minZ + maxZ) * 0.5;
          const halfExtent = Math.max(24, (maxX - minX) * 0.5, (maxZ - minZ) * 0.5);
          const dist = Math.max(44, Math.min(920, halfExtent * 1.9));
          refs.controls.target.set(cx, 1.2, cz);
          refs.camera.position.set(cx + dist * 0.52, dist * 0.55, cz + dist * 0.72);
        } else {
          refs.camera.position.set(68, 52, 88);
          refs.controls.target.set(0, 1.2, 0);
        }
      }
      refs.controls.update();
    }

    const scatterArr = level.terrain?.scatter ?? [];
    const scatterSig = `${scatterArr.length}:${scatterArr[0]?.id ?? ''}:${
      scatterArr[scatterArr.length - 1]?.id ?? ''
    }`;
    const grassFieldKey = `${level.grass?.quality ?? 'lush'}:${level.grass?.viewDistance ?? 55}:${level.grass?.underlayerOverhang ?? true}:${level.grass?.underlayerThickness ?? 0.88}`;
    const pebbleSig = level.terrain?.dirtAndRoadConfig
      ? `${level.terrain.dirtAndRoadConfig.pebbleDensity}:${level.terrain.dirtAndRoadConfig.pebbleSpread}:${level.terrain.dirtAndRoadConfig.pebbleShapeRandomness}:${level.terrain.dirtAndRoadConfig.pebbleColor}:${level.terrain.dirtAndRoadConfig.pebbleHueVariance}:${level.terrain.dirtAndRoadConfig.heroColor}:${level.terrain.dirtAndRoadConfig.secondaryColor}`
      : 'default';

    const isWorldMapMode = worldEditorScope === 'worldMap' && Boolean(worldMap);
    const activeRegion = worldMap?.regions.find((r) => r.code === activeWorldRegionCode);
    const worldMapContext: WorldMapRenderContext | undefined = worldMap
      ? {
          worldMap,
          mode: isWorldMapMode ? 'worldMap' : 'land',
          activeRegionCode: activeWorldRegionCode,
          activeRegionOrigin: activeRegion?.origin,
        }
      : undefined;
    const regionPaletteSig = (worldMap?.regions ?? [])
      .map((r) => `${r.code}:${r.colorHex}:${r.levelId}`)
      .join('|');
    const curTerrainRev = level.terrain?.revision ?? 0;
    const curWorldMapRev = worldMap?.revision ?? 0;

    const structKey = JSON.stringify([
      level.id,
      env,
      isWorldMapMode ? 'worldMap' : 'land',
      activeWorldRegionCode ?? 0,
      activeRegion?.origin?.[0] ?? 0,
      activeRegion?.origin?.[1] ?? 0,
      regionPaletteSig,
      Boolean(level.terrain?.freeformWorld),
      level.biome,
      level.visualStyle ?? 'painterlyPBR',
      level.vistaPreset ?? '',
      level.vistaDensity ?? 0.85,
      level.vistaTreeDensity ?? null,
      level.vistaMountainScale ?? 1,
      level.vistaDistance ?? 0,
      level.vistaTreeScale ?? 1,
      level.vistaItems ?? null,
      level.canopyEngine,
      getDefaultTreeStylesSignature(),
      level.sceneryTextures,
      grassFieldKey,
      pebbleSig,
      mountainCfgSig,
      waterBodiesGeoSig,
      roadsSig,
      level.customWallBoxes ?? null,
      level.sideScrollerConfig ?? null,
      level.roguelikeTorchAnchors ?? null,
      level.dungeonStyle ?? level.roguelikeConfig?.dungeonStyle ?? null,
      scatterSig,
      customAssets.length,
      texInvalidationTick,
    ]);

    const liveTerrain = level.terrain ?? createInitialTerrain();
    const winSculptFlags = window as unknown as {
      __makerHideSceneryOnSculpt?: boolean;
      __makerMinimalSculptAlways?: boolean;
      __makerDisableCaveXRay?: boolean;
    };
    const hideOnDragFlag = winSculptFlags.__makerHideSceneryOnSculpt === true;
    const alwaysHideFlag = Boolean(winSculptFlags.__makerMinimalSculptAlways);
    const shouldShowSceneryNow = !alwaysHideFlag && !(isSculptDraggingRef.current && hideOnDragFlag);

    // Fast 60fps in-place Cave + Terrain update without rebuilding the entire island!
    if (
      env === 'openWorld' &&
      refs.islandHandles?.terrainMesh &&
      lastIslandStructKeyRef.current === structKey
    ) {
      refs.islandHandles.setSceneryVisible?.(shouldShowSceneryNow);
      refs.entitiesContainer.visible = shouldShowSceneryNow;
      refs.fxContainer.visible = shouldShowSceneryNow;

      let didInPlaceUpdate = false;
      if (lastCavesSigRef.current !== cavesSig && refs.islandHandles.updateCavesInPlace) {
        refs.islandHandles.updateCavesInPlace(level);
        refs.islandHandles.setCaveXRayMode?.(
          propsRef.current.activeWorldDomain === 'caves' && winSculptFlags.__makerDisableCaveXRay !== true
        );
        lastCavesSigRef.current = cavesSig;
        didInPlaceUpdate = true;
      }

      if (lastSculptAreaRef.current !== null) {
        const updated = updateIslandTerrainGeometryInPlace(
          refs.islandHandles,
          liveTerrain,
          lastSculptAreaRef.current,
          worldMapContext
        );
        if (updated) {
          refs.islandHandles.updateMountainUniforms?.(liveTerrain.mountainConfig);
          refs.islandHandles.updateDirtUniforms?.(liveTerrain.dirtAndRoadConfig);
          lastTerrainRevRef.current = curTerrainRev;
          lastWorldMapRevRef.current = curWorldMapRev;
          refs.markShadowDirty();
          return;
        }
      }

      if (
        lastTerrainRevRef.current !== curTerrainRev ||
        lastWorldMapRevRef.current !== curWorldMapRev
      ) {
        updateIslandTerrainGeometryInPlace(
          refs.islandHandles,
          liveTerrain,
          undefined,
          worldMapContext
        );
        refs.islandHandles.updateMountainUniforms?.(liveTerrain.mountainConfig);
        refs.islandHandles.updateDirtUniforms?.(liveTerrain.dirtAndRoadConfig);
        lastTerrainRevRef.current = curTerrainRev;
        lastWorldMapRevRef.current = curWorldMapRev;
        didInPlaceUpdate = true;
      }

      if (didInPlaceUpdate) {
        refs.markShadowDirty();
      }
      return;
    }

    lastIslandStructKeyRef.current = structKey;
    lastCavesSigRef.current = cavesSig;
    lastTerrainRevRef.current = curTerrainRev;
    lastWorldMapRevRef.current = curWorldMapRev;

    scatterReseatAbortRef.current?.abort();
    scatterReseatAbortRef.current = null;
    islandBuildAbortRef.current?.abort();
    const abortController = new AbortController();
    islandBuildAbortRef.current = abortController;

    refs.islandHandles?.chunkedTerrain?.dispose();
    refs.islandHandles?.grassSystem?.dispose();
    refs.islandHandles?.volumetricAtmosphere?.dispose();
    if (refs.wildlifeSystem) {
      refs.islandContainer.remove(refs.wildlifeSystem.group);
      refs.wildlifeSystem.dispose();
      refs.wildlifeSystem = null;
    }
    disposeObject3D(refs.islandContainer);
    refs.islandContainer.clear();
    const handles = buildIslandMesh(level, customAssets, refs.isSoftwareGl, {
      deferFoliage: true,
      deferFoliageSignal: abortController.signal,
      worldMapContext,
      terrainQuality: propsRef.current.terrainQuality ?? 'balanced',
      onDeferredBatchReady: async (obj) => {
        if (!abortController.signal.aborted) {
          await refs.precompileObject(obj);
          if (!abortController.signal.aborted) {
            refs.markShadowDirty();
          }
        }
      },
    });
    refs.islandHandles = handles;
    refs.islandContainer.add(handles.group);
    if (handles.volumetricAtmosphere) {
      refs.scene.userData.volumetricAtmosphere = handles.volumetricAtmosphere;
      const atmo = computeAtmosphereState(level);
      handles.volumetricAtmosphere.syncAtmosphere(atmo, level);
    }
    if (!refs.isSoftwareGl && getEnvironmentType(level) !== 'dungeon') {
      const wildlife = new WildlifeFlockingSystem(level, 0.85);
      refs.wildlifeSystem = wildlife;
      refs.islandContainer.add(wildlife.group);
    }
    handles.updateWaterBodiesUniforms?.(level.terrain?.waterBodies, propsRef.current.selectedWaterBodyId);
    handles.updateMountainUniforms?.(liveTerrain.mountainConfig);
    handles.updateProceduralUniforms?.(liveTerrain.proceduralConfig);
    handles.updateTerrainQualityUniforms?.(propsRef.current.terrainQuality ?? 'balanced');
    handles.updateDirtUniforms?.(liveTerrain.dirtAndRoadConfig);
    handles.updateUnderlayerUniforms?.(level.grass?.underlayerContrast ?? 0.92);
    handles.setCaveXRayMode?.(
      propsRef.current.activeWorldDomain === 'caves' && winSculptFlags.__makerDisableCaveXRay !== true
    );
    handles.setSceneryVisible?.(shouldShowSceneryNow);
    refs.entitiesContainer.visible = shouldShowSceneryNow;
    refs.fxContainer.visible = shouldShowSceneryNow;
    void refs.precompileObject(handles.group);
    refs.markShadowDirty();

    const groundMeshes: THREE.Object3D[] = [];
    handles.group.traverse((o) => {
      if (o.userData?.isGround) groundMeshes.push(o);
    });
    refs.groundMeshes = groundMeshes;
  }, [
    level.environmentType,
    level.biome,
    level.visualStyle,
    level.vistaPreset,
    level.vistaDensity,
    level.vistaTreeDensity,
    level.vistaMountainScale,
    level.vistaDistance,
    level.vistaTreeScale,
    level.vistaItems,
    level.canopyEngine,
    defaultTreePrefs,
    level.sceneryTextures,
    level.grass?.quality,
    level.grass?.viewDistance,
    level.grass?.underlayerOverhang,
    level.grass?.underlayerThickness,
    level.terrain?.dirtAndRoadConfig,
    level.terrain?.mountainConfig,
    level.terrain?.caves,
    level.terrain?.roads,
    level.terrain?.scatter,
    level.terrain?.waterBodies,
    level.terrain?.freeformWorld,
    level.customWallBoxes,
    level.sideScrollerConfig,
    level.roguelikeTorchAnchors,
    level.dungeonStyle,
    level.roguelikeConfig?.dungeonStyle,
    level.terrain?.revision,
    level.id,
    worldEditorScope,
    activeWorldRegionCode,
    worldMap?.revision,
    worldMap?.regions,
    cavesSig,
    roadsSig,
    mountainCfgSig,
    waterBodiesGeoSig,
    customAssets,
    texInvalidationTick,
  ]);

  // Lightweight scatter, pebble & cave reseat after height sculpting finishes (avoids 1.5-2.4s full island teardown/rebuild!)
  useEffect(() => {
    if (sculptFinalizeNonce === 0) return;
    const refs = sceneRefs.current;
    const curLevel = propsRef.current.level;
    if (!refs?.islandHandles) return;
    const env = getEnvironmentType(curLevel);
    if (env !== 'openWorld' || propsRef.current.worldEditorScope === 'worldMap') return;

    if ((curLevel.terrain?.caves?.length ?? 0) > 0) {
      refs.islandHandles.updateCavesInPlace?.(curLevel);
    }

    if (!refs.islandHandles.reseatScatterInPlace) {
      refs.markShadowDirty();
      return;
    }

    scatterReseatAbortRef.current?.abort();
    const ac = new AbortController();
    scatterReseatAbortRef.current = ac;

    void refs.islandHandles
      .reseatScatterInPlace(curLevel, propsRef.current.customAssets, ac.signal)
      .then(() => {
        if (!ac.signal.aborted) {
          refs.markShadowDirty();
        }
      })
      .catch(() => {
        // ignore if aborted mid-reseat
      });
  }, [sculptFinalizeNonce]);

  // Camera angle lock & Shift pan sync
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;
    refs.controls.enableRotate = !cameraAngleLocked && !shiftHeld;
    refs.controls.enablePan = !cameraAngleLocked || shiftHeld;
  }, [cameraAngleLocked, shiftHeld]);

  // Sync live cursor directly onto Three.js canvas element
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;
    const nextCursor = isPanning
      ? 'grabbing'
      : shiftHeld
      ? 'grab'
      : tool === 'terrain' || tool === 'add'
      ? 'crosshair'
      : 'default';
    refs.renderer.domElement.style.cursor = nextCursor;
  }, [isPanning, shiftHeld, tool]);

  // Smooth fly-to camera focus when clicking items in Left Contents or Inspector
  useEffect(() => {
    if (!cameraFocusRequest) return;
    const refs = sceneRefs.current;
    if (!refs) return;
    const dist = Math.max(8, Math.min(85, cameraFocusRequest.distance ?? 24));
    const dx = refs.camera.position.x - refs.controls.target.x;
    const dy = refs.camera.position.y - refs.controls.target.y;
    const dz = refs.camera.position.z - refs.controls.target.z;
    const len = Math.max(0.001, Math.hypot(dx, dy, dz));
    const lookY = cameraFocusRequest.y + 1.1;
    refs.flyTargetLook.set(cameraFocusRequest.x, lookY, cameraFocusRequest.z);
    refs.flyTargetPos.set(
      cameraFocusRequest.x + (dx / len) * dist,
      Math.max(lookY + 5, cameraFocusRequest.y + (dy / len) * dist),
      cameraFocusRequest.z + (dz / len) * dist
    );
    refs.flyActive = true;
  }, [cameraFocusRequest]);

  // Quick compass & elevation presets (Iso, Top, North, East)
  useEffect(() => {
    if (!cameraPresetRequest) return;
    const refs = sceneRefs.current;
    if (!refs) return;
    const tx = refs.controls.target.x;
    const ty = refs.controls.target.y;
    const tz = refs.controls.target.z;
    const maxPresetDist = propsRef.current.worldEditorScope === 'worldMap' ? 1200 : 130;
    const dist = Math.max(24, Math.min(maxPresetDist, refs.camera.position.distanceTo(refs.controls.target)));
    refs.flyTargetLook.set(tx, ty, tz);
    if (cameraPresetRequest.preset === 'top') {
      refs.flyTargetPos.set(tx, ty + dist * 1.12, tz + 0.01);
    } else if (cameraPresetRequest.preset === 'north') {
      refs.flyTargetPos.set(tx, ty + dist * 0.42, tz - dist * 0.9);
    } else if (cameraPresetRequest.preset === 'east') {
      refs.flyTargetPos.set(tx + dist * 0.9, ty + dist * 0.42, tz);
    } else {
      refs.flyTargetPos.set(tx + dist * 0.56, ty + dist * 0.48, tz + dist * 0.68);
    }
    refs.flyActive = true;
  }, [cameraPresetRequest]);

  // 60fps Live Uniform Sync for Grass, Underlayer, Mountains, Dirt & Per-Body Water (zero full rebuild!)
  useEffect(() => {
    sceneRefs.current?.islandHandles?.grassSystem?.applyConfigUniforms(level.grass);
    sceneRefs.current?.islandHandles?.updateUnderlayerUniforms?.(level.grass?.underlayerContrast ?? 0.92);
  }, [level.grass]);

  useEffect(() => {
    sceneRefs.current?.islandHandles?.updateMountainUniforms?.(level.terrain?.mountainConfig);
  }, [level.terrain?.mountainConfig]);

  useEffect(() => {
    sceneRefs.current?.islandHandles?.updateProceduralUniforms?.(level.terrain?.proceduralConfig);
  }, [level.terrain?.proceduralConfig]);

  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;
    refs.islandHandles?.updateTerrainQualityUniforms?.(terrainQuality);
    applyAtmosphereQualityToScene(refs.scene, terrainQuality);
  }, [terrainQuality]);

  useEffect(() => {
    sceneRefs.current?.islandHandles?.updateDirtUniforms?.(level.terrain?.dirtAndRoadConfig);
  }, [level.terrain?.dirtAndRoadConfig]);

  useEffect(() => {
    sceneRefs.current?.islandHandles?.updateWaterBodiesUniforms?.(
      level.terrain?.waterBodies,
      selectedWaterBodyId
    );
  }, [level.terrain?.waterBodies, selectedWaterBodyId]);

  // Rebuild entity meshes & hero start marker (fast Y-reposition only during live terrain sculpting)
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;

    const backendObj = refs.renderer.backend as { isWebGPUBackend?: boolean } | undefined;
    if (
      backendObj?.isWebGPUBackend === true &&
      !refs.isSoftwareGl &&
      !refs.renderer.drawingPipeline &&
      level.entities.some((e) => e.meshletEnabled)
    ) {
      refs.renderer.drawingPipeline = createOptInMeshletPipeline(refs.renderer);
    }

    const env = getEnvironmentType(level);
    const startBp =
      playerPin ??
      level.startPoint ??
      (env === 'sideScroller' ? { x: 0.1, y: 0.5 } : { x: 0.14, y: 0.8 });
    const portalBp = level.portalPoint ?? (env === 'sideScroller' ? { x: 0.92, y: 0.5 } : { x: 0.88, y: 0.24 });

    const isWorldMapOnly = worldEditorScope === 'worldMap' && env === 'openWorld';
    const entityStructKey = JSON.stringify([
      isWorldMapOnly ? 'worldMapOnly' : 'land',
      level.id,
      env,
      level.gameplayMode ?? 'adventure',
      level.drivingConfig ?? null,
      portalBp,
      level.hasStart,
      level.hasPortal,
      level.visualStyle ?? 'painterlyPBR',
      level.sceneryTextures,
      entitiesCoreSig,
      project.heroBody,
      project.heroColors,
      project.heroCustomAssetId,
      project.heroModelScale,
      project.heroModelOffsetY,
      project.savePlinthAssetId,
      customAssets.length,
      texInvalidationTick,
    ]);

    // Pure World Map view renders landmasses and region colors without level actors/props
    if (isWorldMapOnly) {
      if (lastEntityStructKeyRef.current !== entityStructKey) {
        lastEntityStructKeyRef.current = entityStructKey;
        entityBuildAbortRef.current?.abort();
        disposeObject3D(refs.entitiesContainer);
        refs.entitiesContainer.clear();
        refs.entityGroups.clear();
        refs.animatedVillageGroups = [];
        refs.fxEmitters.forEach((fx) => fx.dispose());
        refs.fxEmitters.clear();
        refs.fxContainer.clear();
        refs.floatSpinObjects = [];
        refs.torchFlameObjects = [];
        refs.customUpdaters = [];
        refs.hasDynamicShadows = false;
        refs.heroGroup = null;
        refs.portalGroup = null;
        refs.markShadowDirty();
      }
      return;
    }

    // Fast Y-only re-grounding & zero-stutter NodeMaterialInstance uniform updates
    const expectedEntityGroupCount = level.entities.length + (level.hasStart ? 1 : 0);
    if (
      lastEntityStructKeyRef.current === entityStructKey &&
      refs.entityGroups.size === expectedEntityGroupCount
    ) {
      if (level.hasStart && refs.heroGroup) {
        const [hx, hz] = levelBoardToWorld(level, startBp);
        refs.heroGroup.position.set(hx, sampleLevelHeight(level, hx, hz), hz);
        refs.heroGroup.rotation.y =
          level.startRotation !== undefined
            ? (level.startRotation * Math.PI) / 180
            : env === 'sideScroller'
            ? Math.PI * 0.5
            : Math.PI * 0.75;
      }
      if (level.hasPortal && refs.portalGroup) {
        const [px, pz] = levelBoardToWorld(level, portalBp);
        refs.portalGroup.position.set(px, sampleLevelHeight(level, px, pz), pz);
      }
      for (const ent of level.entities) {
        const grp = refs.entityGroups.get(ent.id);
        if (!grp) continue;
        const [wx, wz] = levelBoardToWorld(level, ent.position);
        const wy = sampleLevelHeight(level, wx, wz);
        const extraY =
          ent.kind === 'platform' && !ent.platformerAddon
            ? PlatformMotion.hover(ent.platformPreset)
            : 0;
        grp.position.set(wx, wy + extraY + (ent.elevationY ?? 0), wz);

        if (ent.kind !== 'fxEmitter' && ent.kind !== 'light') {
          const isMatte =
            ent.kind === 'platform' ||
            ent.kind === 'checkpoint' ||
            ent.kind === 'door' ||
            ent.kind === 'puzzle' ||
            ent.kind === 'spawner';
          updateEntityMaterialVariantInPlace(grp, ent.materialVariant, isMatte);
          if (Boolean(grp.userData.meshletEnabled) !== Boolean(ent.meshletEnabled)) {
            prepareObjectForMeshletCulling(grp, Boolean(ent.meshletEnabled));
          }
        }
      }
      refs.hasDynamicShadows = level.entities.some(
        (ent) => ent.kind === 'platform' && Boolean(ent.platformRunning) && !ent.platformerAddon
      );
      refs.markShadowDirty();
      return;
    }

    lastEntityStructKeyRef.current = entityStructKey;

    entityBuildAbortRef.current?.abort();
    const entityAbort = new AbortController();
    entityBuildAbortRef.current = entityAbort;
    const signal = entityAbort.signal;

    disposeObject3D(refs.entitiesContainer);
    refs.entitiesContainer.clear();
    refs.entityGroups.clear();
    refs.animatedVillageGroups = [];
    refs.floatSpinObjects = [];
    refs.torchFlameObjects = [];
    refs.customUpdaters = [];
    refs.hasDynamicShadows = level.entities.some(
      (ent) => ent.kind === 'platform' && Boolean(ent.platformRunning) && !ent.platformerAddon
    );
    refs.heroGroup = null;
    refs.portalGroup = null;

    const style = level.visualStyle ?? 'painterlyPBR';

    // Hero start marker
    if (level.hasStart) {
      const [hx, hz] = levelBoardToWorld(level, startBp);
      const hy = sampleLevelHeight(level, hx, hz);
      const heroAnchor = new THREE.Group();
      heroAnchor.userData.entityId = HERO_START_ENTITY_ID;
      heroAnchor.position.set(hx, hy, hz);
      heroAnchor.rotation.y =
        level.startRotation !== undefined
          ? (level.startRotation * Math.PI) / 180
          : env === 'sideScroller'
          ? Math.PI * 0.5
          : Math.PI * 0.75;
      refs.entitiesContainer.add(heroAnchor);
      refs.entityGroups.set(HERO_START_ENTITY_ID, heroAnchor);
      refs.heroGroup = heroAnchor;

      if (level.gameplayMode === 'driving') {
        const carRig = buildCarModel(
          level.drivingConfig?.carId ?? 'trailBuggy',
          level.drivingConfig?.driverId ?? 'stunt',
          level.drivingConfig?.customVehicle
        );
        applyVisualStyleToObject(carRig.group, style);
        heroAnchor.add(carRig.group);
      } else if (project.heroCustomAssetId) {
        const heroAssetId = project.heroCustomAssetId;
        const cached = getCachedAssetSync(heroAssetId);
        if (cached) {
          const meta = customAssets.find((a) => a.id === heroAssetId);
          const inst = instantiateCustomModel(heroAssetId, meta, {
            scaleAdjust: project.heroModelScale ?? 1,
            offsetY: project.heroModelOffsetY ?? 0,
            visualStyle: style,
          });
          if (inst) {
            heroAnchor.add(inst.group);
            refs.customUpdaters.push((stepDt) => inst.update(stepDt));
          } else {
            const heroRig = buildHeroModel(project.heroBody, project.heroColors);
            heroRig.group.scale.setScalar(Math.max(0.25, Math.min(3.5, project.heroModelScale ?? 1)));
            heroRig.group.position.y = project.heroModelOffsetY ?? 0;
            applyVisualStyleToObject(heroRig.group, style);
            heroAnchor.add(heroRig.group);
          }
        } else {
          const heroRig = buildHeroModel(project.heroBody, project.heroColors);
          heroRig.group.scale.setScalar(Math.max(0.25, Math.min(3.5, project.heroModelScale ?? 1)));
          heroRig.group.position.y = project.heroModelOffsetY ?? 0;
          applyVisualStyleToObject(heroRig.group, style);
          heroAnchor.add(heroRig.group);
          void loadCustomAssetToCache(heroAssetId, 'character').then((loaded) => {
            if (signal.aborted || !loaded) return;
            const meta = customAssets.find((a) => a.id === heroAssetId);
            const inst = instantiateCustomModel(heroAssetId, meta, {
              scaleAdjust: project.heroModelScale ?? 1,
              offsetY: project.heroModelOffsetY ?? 0,
              visualStyle: style,
            });
            if (!inst || signal.aborted) {
              if (inst) disposeObject3D(inst.group);
              return;
            }
            disposeObject3D(heroAnchor);
            heroAnchor.clear();
            heroAnchor.add(inst.group);
            refs.customUpdaters.push((stepDt) => inst.update(stepDt));
            void refs.precompileObject(heroAnchor);
          });
        }
      } else {
        const heroRig = buildHeroModel(project.heroBody, project.heroColors);
        heroRig.group.scale.setScalar(Math.max(0.25, Math.min(3.5, project.heroModelScale ?? 1)));
        heroRig.group.position.y = project.heroModelOffsetY ?? 0;
        applyVisualStyleToObject(heroRig.group, style);
        heroAnchor.add(heroRig.group);
      }
    }

    // Portal marker
    if (level.hasPortal) {
      const portal = buildPortalMarker();
      const [px, pz] = levelBoardToWorld(level, portalBp);
      const py = sampleLevelHeight(level, px, pz);
      portal.position.set(px, py, pz);
      portal.rotation.y = -Math.PI * 0.25;
      refs.entitiesContainer.add(portal);
      refs.portalGroup = portal;
    }

    // Track live fxEmitter IDs to keep persistent FxEmitterRuntime pools smooth while editing sliders
    const activeFxIds = new Set<string>();
    const deferredCanopyEntities: Array<{ ent: LevelEntity; anchor: THREE.Group }> = [];
    const deferredCustomEntities: Array<{
      ent: LevelEntity;
      anchor: THREE.Group;
      customAssetId: string;
      isCached: boolean;
    }> = [];
    let wallTorchAddedLight = 0;
    let savePlinthAddedLight = 0;

    for (const ent of level.entities) {
      if (ent.kind === 'fxEmitter') {
        activeFxIds.add(ent.id);
        const cfg = ent.fxEmitter ?? createDefaultFxEmitterConfig('fire');
        let fx = refs.fxEmitters.get(ent.id);
        if (!fx) {
          fx = new FxEmitterRuntime(cfg, ent.id, true);
          refs.fxEmitters.set(ent.id, fx);
          refs.fxContainer.add(fx.group);
        } else {
          fx.updateConfig(cfg);
        }
        const [wx, wz] = levelBoardToWorld(level, ent.position);
        const wy = sampleLevelHeight(level, wx, wz);
        fx.group.position.set(wx, wy + (ent.elevationY ?? 0), wz);
        fx.group.rotation.y = (ent.rotation * Math.PI) / 180;
        fx.group.scale.setScalar(ent.scale);
        refs.entityGroups.set(ent.id, fx.group);
        continue;
      }

      const [wx, wz] = levelBoardToWorld(level, ent.position);
      const wy = sampleLevelHeight(level, wx, wz);
      const extraY =
        ent.kind === 'platform' && !ent.platformerAddon
          ? PlatformMotion.hover(ent.platformPreset)
          : 0;

      if (ent.canopyTree) {
        const anchor = new THREE.Group();
        anchor.userData.entityId = ent.id;
        anchor.position.set(wx, wy + extraY + (ent.elevationY ?? 0), wz);
        anchor.rotation.y = (ent.rotation * Math.PI) / 180;
        anchor.scale.setScalar(ent.scale);
        refs.entitiesContainer.add(anchor);
        refs.entityGroups.set(ent.id, anchor);
        deferredCanopyEntities.push({ ent, anchor });
        continue;
      }

      const resolvedCustomAssetId =
        ent.customAssetId ?? (isSavePlinthEntity(ent) ? project.savePlinthAssetId : undefined);

      if (resolvedCustomAssetId) {
        const anchor = new THREE.Group();
        anchor.userData.entityId = ent.id;
        anchor.position.set(wx, wy + extraY + (ent.elevationY ?? 0), wz);
        const isCached = Boolean(getCachedAssetSync(resolvedCustomAssetId));
        if (!isCached) {
          const fallbackMesh = buildEntityMesh(ent);
          applyVisualStyleToObject(fallbackMesh, style);
          fallbackMesh.userData.entityId = ent.id;
          fallbackMesh.traverse((child) => {
            if (child.userData?.floatSpin) {
              refs.floatSpinObjects.push(child);
            }
          });
          anchor.add(fallbackMesh);
        }
        if (isSavePlinthEntity(ent) && savePlinthAddedLight < 6) {
          savePlinthAddedLight++;
          const plinthPt = new THREE.PointLight('#38BDF8', 4.0, 9.5, 1.8);
          plinthPt.position.set(0, 1.75, 0);
          anchor.add(plinthPt);
        }
        refs.entitiesContainer.add(anchor);
        refs.entityGroups.set(ent.id, anchor);
        deferredCustomEntities.push({ ent, anchor, customAssetId: resolvedCustomAssetId, isCached });
        continue;
      }

      const mesh = buildEntityMesh(ent);
      applyVisualStyleToObject(mesh, style);

      if (ent.vertexPaintStrokes && ent.vertexPaintStrokes.length > 0) {
        applyVertexPaintStrokesToObject(mesh, ent.vertexPaintStrokes);
      }

      if (ent.kind !== 'light') {
        const isMatte =
          ent.kind === 'platform' ||
          ent.kind === 'checkpoint' ||
          ent.kind === 'door' ||
          ent.kind === 'puzzle' ||
          ent.kind === 'spawner';
        applyEntityMaterialVariant(mesh, ent.materialVariant, isMatte);
        if (ent.meshletEnabled) {
          prepareObjectForMeshletCulling(mesh, true);
        }
      }

      mesh.position.set(wx, wy + extraY + (ent.elevationY ?? 0), wz);
      mesh.traverse((child) => {
        if (child.userData?.floatSpin) {
          refs.floatSpinObjects.push(child);
        }
        if (child.userData?.torchFlame) {
          refs.torchFlameObjects.push({
            mesh: child,
            baseY: Number(child.userData.baseY ?? child.position.y),
            phase: wx * 0.43 + wz * 0.61,
          });
        }
      });
      if (ent.buildingBlock?.shape === 'wallTorch' && wallTorchAddedLight < 8) {
        wallTorchAddedLight++;
        const pt = new THREE.PointLight('#FF9C40', 4.5, 11, 1.8);
        pt.position.set(0, 1.82, 0.38);
        mesh.add(pt);
      } else if (isSavePlinthEntity(ent) && savePlinthAddedLight < 6) {
        savePlinthAddedLight++;
        const plinthPt = new THREE.PointLight('#38BDF8', 4.0, 9.5, 1.8);
        plinthPt.position.set(0, 1.75, 0);
        mesh.add(plinthPt);
      }
      refs.entitiesContainer.add(mesh);
      refs.entityGroups.set(ent.id, mesh);
      if (hasVillageAnimation(mesh)) {
        refs.animatedVillageGroups.push(mesh);
      }
      if (ent.mechanisms && ent.mechanisms.length > 0) {
        const mechRoot = (mesh.userData.mechRoot as THREE.Object3D | undefined) ?? mesh;
        const editorMechCtrl = new MechanismRuntimeController(mechRoot, ent.mechanisms);
        refs.customUpdaters.push((stepDt) => editorMechCtrl.update(stepDt));
      }
    }
    void refs.precompileObject(refs.entitiesContainer);
    refs.markShadowDirty();

    // Dispose removed FX Emitters
    refs.fxEmitters.forEach((fx, id) => {
      if (!activeFxIds.has(id)) {
        refs.fxContainer.remove(fx.group);
        fx.dispose();
        refs.fxEmitters.delete(id);
      }
    });

    if (deferredCanopyEntities.length > 0 || deferredCustomEntities.length > 0) {
      void (async () => {
        if (signal.aborted) return;

        // Preload any custom canopy textures referenced by placed canopy trees asynchronously
        if (deferredCanopyEntities.length > 0) {
          const entTexIds = collectReferencedTextureIds(
            level.sceneryTextures,
            undefined,
            deferredCanopyEntities.map((d) => d.ent.canopyTree)
          );
          const missingEntTex = entTexIds.filter((id) => !getRawCustomTextureSync(id));
          if (missingEntTex.length > 0) {
            await Promise.allSettled(missingEntTex.map((id) => loadCustomTextureToCache(id)));
            if (signal.aborted) return;
          }
        }

        const readyCanopy = deferredCanopyEntities.filter(({ ent }) => {
          const ct = ent.canopyTree!;
          return (
            (!ct.canopyAssetId || getCachedAssetSync(ct.canopyAssetId)) &&
            (!ct.trunkAssetId || getCachedAssetSync(ct.trunkAssetId)) &&
            (!ct.fruitAssetId || getCachedAssetSync(ct.fruitAssetId))
          );
        });
        const waitingCanopy = deferredCanopyEntities.filter((d) => !readyCanopy.includes(d));

        const attachCanopyTree = (ent: LevelEntity, anchor: THREE.Group) => {
          if (signal.aborted || !ent.canopyTree) return;
          const resolvedStrokes =
            ent.vertexPaintStrokes && ent.vertexPaintStrokes.length > 0
              ? ent.vertexPaintStrokes
              : ent.canopyTree.vertexPaintStrokes;
          const treeMesh = buildSingleCanopyTreeGroup(
            resolvedStrokes ? { ...ent.canopyTree, vertexPaintStrokes: resolvedStrokes } : ent.canopyTree,
            ent.id,
            style,
            refs.canopyTimeUniform,
            undefined,
            {
              sceneryTextures: level.sceneryTextures,
              weatherWindUniform: refs.canopyWindUniform,
            }
          );
          if (signal.aborted) {
            disposeObject3D(treeMesh);
            return;
          }
          const latestEnt = propsRef.current.level.entities.find((e) => e.id === ent.id) ?? ent;
          treeMesh.userData.entityId = ent.id;
          applyEntityMaterialVariant(treeMesh, latestEnt.materialVariant, false);
          if (latestEnt.meshletEnabled) {
            prepareObjectForMeshletCulling(treeMesh, true);
          }
          disposeObject3D(anchor);
          anchor.clear();
          anchor.add(treeMesh);
        };

        if (readyCanopy.length > 0) {
          const ok = await runDeferredChunks({
            items: readyCanopy,
            chunkSize: 1,
            frameBudgetMs: 4,
            maxItemsPerFrame: 2,
            yieldBeforeFirst: true,
            signal,
            onChunk: (chunk) => {
              for (const { ent, anchor } of chunk) {
                attachCanopyTree(ent, anchor);
              }
            },
          });
          if (!ok || signal.aborted) return;
          void refs.precompileObject(refs.entitiesContainer);
        }

        if (waitingCanopy.length > 0) {
          const missingIds = new Map<string, CustomAssetMeta['category']>();
          for (const { ent } of waitingCanopy) {
            const ct = ent.canopyTree!;
            for (const aid of [ct.canopyAssetId, ct.trunkAssetId, ct.fruitAssetId]) {
              if (aid && !getCachedAssetSync(aid) && !missingIds.has(aid)) {
                const meta = customAssets.find((a) => a.id === aid);
                missingIds.set(aid, meta?.category ?? 'scenery');
              }
            }
          }
          await Promise.allSettled(
            Array.from(missingIds.entries()).map(([id, cat]) => loadCustomAssetToCache(id, cat))
          );
          if (signal.aborted) return;
          const ok = await runDeferredChunks({
            items: waitingCanopy,
            chunkSize: 1,
            frameBudgetMs: 4,
            maxItemsPerFrame: 2,
            signal,
            onChunk: (chunk) => {
              for (const { ent, anchor } of chunk) {
                attachCanopyTree(ent, anchor);
              }
            },
          });
          if (!ok || signal.aborted) return;
          void refs.precompileObject(refs.entitiesContainer);
        }

        const attachCustomEntity = (ent: LevelEntity, anchor: THREE.Group, customAssetId: string) => {
          if (signal.aborted || !customAssetId) return;
          const meta = customAssets.find((a) => a.id === customAssetId);
          const inst = instantiateCustomModel(customAssetId, meta, {
            scaleAdjust: ent.modelScaleAdjust ?? 1,
            offsetY: ent.modelOffsetY ?? 0,
            visualStyle: style,
          });
          if (!inst || signal.aborted) {
            if (inst) disposeObject3D(inst.group);
            return;
          }
          const latestEnt = propsRef.current.level.entities.find((e) => e.id === ent.id) ?? ent;
          inst.group.scale.setScalar(latestEnt.scale);
          inst.group.rotation.y = (latestEnt.rotation * Math.PI) / 180;
          inst.group.userData.entityId = ent.id;
          const paintStrokes =
            latestEnt.vertexPaintStrokes && latestEnt.vertexPaintStrokes.length > 0
              ? latestEnt.vertexPaintStrokes
              : meta?.vertexPaintStrokes;
          if (paintStrokes && paintStrokes.length > 0) {
            applyVertexPaintStrokesToObject(inst.group, paintStrokes);
          }
          const isMatte =
            latestEnt.kind === 'platform' ||
            latestEnt.kind === 'checkpoint' ||
            latestEnt.kind === 'door' ||
            latestEnt.kind === 'puzzle' ||
            latestEnt.kind === 'spawner';
          applyEntityMaterialVariant(inst.group, latestEnt.materialVariant, isMatte);
          if (latestEnt.meshletEnabled) {
            prepareObjectForMeshletCulling(inst.group, true);
          }
          const preservedLights: THREE.PointLight[] = [];
          for (const child of anchor.children) {
            if (child instanceof THREE.PointLight) {
              preservedLights.push(child);
            }
          }
          for (const pt of preservedLights) {
            anchor.remove(pt);
          }
          disposeObject3D(anchor);
          anchor.clear();
          anchor.add(inst.group);
          for (const pt of preservedLights) {
            anchor.add(pt);
          }
          refs.customUpdaters.push((stepDt) => inst.update(stepDt));
          const resolvedMechs =
            latestEnt.mechanisms && latestEnt.mechanisms.length > 0
              ? latestEnt.mechanisms
              : meta?.mechanisms ?? [];
          if (resolvedMechs.length > 0) {
            const editorMechCtrl = new MechanismRuntimeController(inst.scaledRoot, resolvedMechs);
            refs.customUpdaters.push((stepDt) => editorMechCtrl.update(stepDt));
          }
        };

        const cachedCustom = deferredCustomEntities.filter((d) => d.isCached);
        const uncachedCustom = deferredCustomEntities.filter((d) => !d.isCached);

        if (cachedCustom.length > 0) {
          const ok = await runDeferredChunks({
            items: cachedCustom,
            chunkSize: 3,
            frameBudgetMs: 6,
            maxItemsPerFrame: 6,
            yieldBeforeFirst: true,
            signal,
            onChunk: (chunk) => {
              for (const { ent, anchor, customAssetId } of chunk) {
                attachCustomEntity(ent, anchor, customAssetId);
              }
            },
          });
          if (!ok || signal.aborted) return;
          void refs.precompileObject(refs.entitiesContainer);
        }

        if (uncachedCustom.length > 0) {
          const missingEntAssets = new Map<string, CustomAssetMeta['category']>();
          for (const { customAssetId } of uncachedCustom) {
            if (customAssetId && !missingEntAssets.has(customAssetId)) {
              const meta = customAssets.find((a) => a.id === customAssetId);
              missingEntAssets.set(customAssetId, meta?.category ?? 'prop');
            }
          }
          await Promise.allSettled(
            Array.from(missingEntAssets.entries()).map(([id, cat]) => loadCustomAssetToCache(id, cat))
          );
          if (signal.aborted) return;
          const ok = await runDeferredChunks({
            items: uncachedCustom,
            chunkSize: 3,
            frameBudgetMs: 6,
            maxItemsPerFrame: 6,
            signal,
            onChunk: (chunk) => {
              for (const { ent, anchor, customAssetId } of chunk) {
                attachCustomEntity(ent, anchor, customAssetId);
              }
            },
          });
          if (ok && !signal.aborted) {
            void refs.precompileObject(refs.entitiesContainer);
          }
        }
      })();
    }
  }, [
    level.environmentType,
    level.entities,
    level.hasStart,
    level.startPoint,
    level.startRotation,
    level.hasPortal,
    level.portalPoint,
    playerPin,
    level.terrain?.revision,
    level.visualStyle,
    level.sceneryTextures,
    level.id,
    worldEditorScope,
    project.heroBody,
    project.heroColors,
    project.heroCustomAssetId,
    project.heroModelScale,
    project.heroModelOffsetY,
    project.savePlinthAssetId,
    customAssets,
    entitiesCoreSig,
    texInvalidationTick,
  ]);

  // Manual Preview / Burst trigger from Inspector
  useEffect(() => {
    if (!fxBurstSignal) return;
    const fx = sceneRefs.current?.fxEmitters.get(fxBurstSignal.entityId);
    if (fx) {
      fx.triggerBurst();
    }
  }, [fxBurstSignal]);

  const raycastClientToGround = (clientX: number, clientY: number): THREE.Vector3 | null => {
    const refs = sceneRefs.current;
    if (!refs) return null;
    if (!dragRaycastScratchRef.current) {
      dragRaycastScratchRef.current = {
        ndc: new THREE.Vector2(),
        raycaster: new THREE.Raycaster(),
        fallbackPlane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
        sideScrollerPlane: new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
        hitPt: new THREE.Vector3(),
      };
    }
    const scratch = dragRaycastScratchRef.current;
    const rect = refs.renderer.domElement.getBoundingClientRect();
    scratch.ndc.set(
      ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
      -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1
    );
    scratch.raycaster.setFromCamera(scratch.ndc, refs.camera);

    if (getEnvironmentType(propsRef.current.level) === 'sideScroller') {
      if (scratch.raycaster.ray.intersectPlane(scratch.sideScrollerPlane, scratch.hitPt)) {
        scratch.hitPt.x = Math.max(-54, Math.min(54, scratch.hitPt.x));
        scratch.hitPt.y = Math.max(-3, Math.min(22, scratch.hitPt.y));
        scratch.hitPt.z = 0;
        return scratch.hitPt;
      }
      return null;
    }

    if (refs.groundMeshes.length === 0) return null;
    const hits = scratch.raycaster.intersectObjects(refs.groundMeshes, false);
    if (hits[0]?.point) return hits[0].point;

    // Fallback intersection against Y=0 plane if dragging near terrain edges
    return scratch.raycaster.ray.intersectPlane(scratch.fallbackPlane, scratch.hitPt)
      ? scratch.hitPt
      : null;
  };

  // Sync Building Curve Guide spline, anchor markers & ghost blocks in 3D world
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;
    disposeObject3D(refs.curveGuideGroup);
    refs.curveGuideGroup.clear();
    if (!buildingCurveGuide?.enabled || buildingCurveGuide.curve.points.length < 2) return;

    const curve = buildCurveInstance(buildingCurveGuide.curve);
    const elev = buildingCurveGuide.elevationY ?? 0;
    const splinePts = curve.getPoints(48).map(
      (pt) => new THREE.Vector3(pt.x, sampleLevelHeight(level, pt.x, pt.z) + elev + 0.14, pt.z)
    );
    const lineGeo = new THREE.BufferGeometry().setFromPoints(splinePts);
    refs.curveGuideGroup.add(
      new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: '#0EA5E9' }))
    );

    const anchorGeo = new THREE.SphereGeometry(0.28, 12, 10);
    const anchorMat = new THREE.MeshBasicMaterial({ color: '#F59E0B' });
    buildingCurveGuide.curve.points.forEach((pt) => {
      const m = new THREE.Mesh(anchorGeo, anchorMat);
      m.position.set(pt[0], sampleLevelHeight(level, pt[0], pt[2]) + elev + 0.25, pt[2]);
      refs.curveGuideGroup.add(m);
    });

    const [bw, bh, bd] = buildingCurveGuide.blockSize;
    const samples = sampleCurveTransforms(
      buildingCurveGuide.curve,
      Math.max(2, buildingCurveGuide.blockCount),
      true
    );
    const curveBoxTmp = new THREE.BoxGeometry(bw, bh, bd);
    const ghostBoxGeo = new THREE.EdgesGeometry(curveBoxTmp);
    curveBoxTmp.dispose();
    const ghostMat = new THREE.LineBasicMaterial({
      color: '#38BDF8',
      transparent: true,
      opacity: 0.78,
    });
    for (const s of samples) {
      const gy = sampleLevelHeight(level, s.position.x, s.position.z) + elev + bh * 0.5;
      const wire = new THREE.LineSegments(ghostBoxGeo, ghostMat);
      wire.position.set(s.position.x, gy, s.position.z);
      wire.rotation.y = THREE.MathUtils.degToRad(s.yawDeg);
      refs.curveGuideGroup.add(wire);
    }
  }, [buildingCurveGuide, level.terrain?.revision, level.environmentType]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    const hasFxMime =
      e.dataTransfer.types.includes(FX_DRAG_MIME) || Boolean(propsRef.current.draggingFxTemplate);
    const hasAssetMime = e.dataTransfer.types.includes(MAKER_ASSET_DRAG_MIME);
    const hasPlatformerMime = e.dataTransfer.types.includes(PLATFORMER_MODULE_DRAG_MIME);
    if (!hasFxMime && !hasAssetMime && !hasPlatformerMime) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const nextDragKind: 'fx' | 'asset' | 'platformer' = hasPlatformerMime
      ? 'platformer'
      : hasAssetMime
      ? 'asset'
      : 'fx';
    if (!isDragOver) setIsDragOver(true);
    if (dragKind !== nextDragKind) setDragKind(nextDragKind);

    const refs = sceneRefs.current;
    if (refs) {
      const accent = hasPlatformerMime
        ? '#20B46A'
        : hasAssetMime
        ? '#20B46A'
        : propsRef.current.draggingFxTemplate?.accentHex ?? '#7C5CFF';
      refs.dropRingMat.color.set(accent);
      refs.dropPillarMat.color.set(accent);
      const hit = raycastClientToGround(e.clientX, e.clientY);
      if (hit) {
        refs.dropPreviewGroup.visible = true;
        refs.dropPreviewGroup.position.set(hit.x, hit.y, hit.z);
      } else {
        refs.dropPreviewGroup.visible = false;
      }
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setIsDragOver(false);
    setDragKind(null);
    if (sceneRefs.current) {
      sceneRefs.current.dropPreviewGroup.visible = false;
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const platformerModId = e.dataTransfer.getData(PLATFORMER_MODULE_DRAG_MIME) as PlatformerModuleId | '';
    const customAssetId = e.dataTransfer.getData(MAKER_ASSET_DRAG_MIME);
    const templateId =
      e.dataTransfer.getData(FX_DRAG_MIME) ||
      propsRef.current.draggingFxTemplate?.id ||
      (!customAssetId && !platformerModId ? e.dataTransfer.getData('text/plain') : '');
    setIsDragOver(false);
    setDragKind(null);
    if (sceneRefs.current) {
      sceneRefs.current.dropPreviewGroup.visible = false;
    }

    if (platformerModId && propsRef.current.onDropPlatformerModule) {
      e.preventDefault();
      const curLevel = propsRef.current.level;
      const hit = raycastClientToGround(e.clientX, e.clientY);
      const boardPos = hit
        ? levelWorldToBoard(curLevel, hit.x, hit.z)
        : { x: 0.5, y: 0.5 };
      const envNow = getEnvironmentType(curLevel);
      const groundY = hit ? sampleLevelHeight(curLevel, hit.x, hit.z) : 0;
      const elev =
        hit && envNow === 'sideScroller'
          ? Number(Math.max(-4, Math.min(22, hit.y - groundY)).toFixed(2))
          : undefined;
      propsRef.current.onDropPlatformerModule(platformerModId, boardPos, elev);
      return;
    }

    if (customAssetId && propsRef.current.onDropCustomAsset) {
      e.preventDefault();
      const hit = raycastClientToGround(e.clientX, e.clientY);
      const boardPos = hit
        ? levelWorldToBoard(propsRef.current.level, hit.x, hit.z)
        : { x: 0.5, y: 0.5 };
      propsRef.current.onDropCustomAsset(customAssetId, boardPos);
      return;
    }

    if (!templateId || !propsRef.current.onDropFxTemplate) return;
    e.preventDefault();
    const hit = raycastClientToGround(e.clientX, e.clientY);
    const boardPos = hit
      ? levelWorldToBoard(propsRef.current.level, hit.x, hit.z)
      : { x: 0.5, y: 0.5 };
    propsRef.current.onDropFxTemplate(templateId, boardPos);
  };

  return (
    <div
      className="w-full h-full relative select-none touch-none"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        ref={mountRef}
        className="w-full h-full"
        style={{
          cursor: isPanning
            ? 'grabbing'
            : shiftHeld
            ? 'grab'
            : tool === 'terrain' || tool === 'add'
            ? 'crosshair'
            : 'default',
        }}
      />
      {(isPanning || shiftHeld) && (
        <div
          className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/82 text-white text-[11px] font-bold border border-white/20 shadow-lg"
          data-testid="pan-hand-indicator"
        >
          <Hand
            size={14}
            className={isPanning ? 'text-[#20B46A] scale-95' : 'text-amber-300'}
          />
          <span>{isPanning ? 'Panning' : 'Shift · Drag to Pan'}</span>
        </div>
      )}
      {/* Compact Framerate Viewer & Expandable Performance HUD */}
      <div
        className="absolute bottom-3 left-3 z-10 flex flex-col items-start gap-1.5"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {showPerfHud && (
          <div className="px-3 py-2 rounded-xl bg-black/82 text-white text-[11px] font-mono border border-white/15 shadow-lg space-y-0.5 tabular-nums">
            <div className="flex items-center justify-between gap-4 pb-1 mb-1 border-b border-white/10">
              <span className="font-sans font-bold text-[10px] uppercase tracking-wider text-slate-300">
                Framerate &amp; Stats
              </span>
              <span className="text-[10px] font-sans font-semibold text-emerald-400">
                {perfStats.backend}
              </span>
            </div>
            <div className="flex justify-between gap-5">
              <span className="text-slate-400">FPS</span>
              <span
                className={`font-bold ${
                  perfStats.fps >= 50
                    ? 'text-emerald-400'
                    : perfStats.fps >= 30
                    ? 'text-amber-300'
                    : 'text-rose-400'
                }`}
              >
                {perfStats.fps}
              </span>
            </div>
            <div className="flex justify-between gap-5">
              <span className="text-slate-400">Frame</span>
              <span>{perfStats.frameMs.toFixed(1)} ms</span>
            </div>
            <div className="flex justify-between gap-5">
              <span className="text-slate-400">Draws</span>
              <span>{perfStats.calls.toLocaleString()}</span>
            </div>
            <div className="flex justify-between gap-5">
              <span className="text-slate-400">Triangles</span>
              <span>{perfStats.triangles.toLocaleString()}</span>
            </div>
            {perfStats.heapMB !== undefined && (
              <div className="flex justify-between gap-5">
                <span className="text-slate-400">JS Heap</span>
                <span>
                  {perfStats.heapMB.toFixed(1)} MB
                  {perfStats.heapLimitMB ? ` / ${Math.round(perfStats.heapLimitMB)}` : ''}
                </span>
              </div>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={() =>
            setShowPerfHud((v) => {
              if (!v) setPerfStats({ ...latestPerfSnapshotRef.current });
              return !v;
            })
          }
          className="px-2.5 py-1 rounded-lg bg-black/75 hover:bg-black/90 text-white text-[11px] font-mono font-semibold border border-white/15 inline-flex items-center gap-1.5 tabular-nums"
          title="Toggle detailed framerate, frame time, draw calls, triangle count, and heap usage"
        >
          <span
            ref={compactFpsDotRef}
            className={`w-2 h-2 rounded-full ${
              perfStats.fps >= 50
                ? 'bg-emerald-400'
                : perfStats.fps >= 30
                ? 'bg-amber-300'
                : 'bg-rose-400'
            }`}
          />
          <span ref={compactFpsTextRef}>{perfStats.fps > 0 ? `${perfStats.fps} FPS` : '-- FPS'}</span>
          <span ref={compactMsTextRef} className="text-white/50 font-sans text-[10px]">
            {showPerfHud ? '▲' : `${perfStats.frameMs.toFixed(0)}ms`}
          </span>
        </button>
      </div>

      <div
        ref={caveDrawHudRef}
        className="hidden pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-xl bg-slate-950/88 text-cyan-100 text-xs font-extrabold border border-cyan-400/50 shadow-lg flex items-center gap-2 tabular-nums"
      >
        <span className="inline-block w-2 h-2 rounded-full bg-cyan-400" />
        <span ref={caveDrawHudTextRef}>Carving tunnel</span>
      </div>

      {isDragOver && (
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl border-2 transition-colors"
          style={{
            borderColor:
              dragKind === 'asset' || dragKind === 'platformer'
                ? '#20B46A'
                : draggingFxTemplate?.accentHex ?? '#7C5CFF',
            boxShadow: `inset 0 0 36px ${
              dragKind === 'asset' || dragKind === 'platformer'
                ? '#20B46A33'
                : `${draggingFxTemplate?.accentHex ?? '#7C5CFF'}33`
            }`,
          }}
        >
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-xl bg-black/80 text-white text-xs font-extrabold shadow-lg border border-white/15 whitespace-nowrap">
            {dragKind === 'asset'
              ? 'Drag prop or character and drop in anywhere'
              : dragKind === 'platformer'
              ? 'Drop platformer mechanic anywhere in level'
              : `Drop to place ${draggingFxTemplate?.name ?? 'FX Effect'} here`}
          </div>
        </div>
      )}
    </div>
  );
};
