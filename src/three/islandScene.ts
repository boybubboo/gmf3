export * from '../features/world/environment/islandAtmosphere';
import * as THREE from 'three';
import {
  MeshBasicNodeMaterial,
  MeshPhysicalNodeMaterial,
  MeshStandardNodeMaterial,
  MeshToonNodeMaterial,
  PMREMGenerator,
  WebGPURenderer,
  type NodeMaterial,
} from 'three/webgpu';
import {
  Fn,
  If,
  Loop,
  abs,
  attribute,
  cameraPosition,
  clamp,
  cos,
  dot,
  float,
  floor,
  fract,
  length,
  materialColor,
  materialDiffuseRoughness,
  materialOpacity,
  materialRoughness,
  max,
  mix,
  modelWorldMatrix,
  normalWorld,
  normalize,
  positionGeometry,
  positionLocal,
  positionWorld,
  pow,
  select,
  sin,
  smoothstep,
  step,
  texture,
  uniform,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  applyDegradeLayersTsl,
  applyDegradeRoughnessTsl,
  createMaterialVariantInstance,
  enableDiffuseRoughnessEon,
  getSharedWeatheringBaseMaterial,
  upgradeToNodeMaterial,
} from './nodeMaterialUtils';
import {
  applyBotwStyleToObject,
  attachBotwPainterlyShader,
  createDriftingCloudShadowNode,
  getSharedBotwUniforms,
  syncBotwSceneFog,
  syncBotwStyleUniforms,
  syncBotwTime,
} from './botwStyleUtils';
import {
  buildBatchedGeometryInstances,
  createScatterBatchMaterialInstance,
  normalizeGeometryForBatch,
  type BatchEntryRef,
  type BatchInstanceSpec,
} from './batchedScatterBuilder';
import { getBiome, getSky } from '../data/registries';
import type {
  CaveGrotto,
  CustomAssetMeta,
  DirtAndRoadConfig,
  GameLevel,
  MountainProfileConfig,
  ScatterItem,
  SceneryTextureSlot,
  SurfaceTextureSettings,
  TerrainData,
  ViewportResolutionScale,
  ViewportShadowQuality,
  VistaPresetId,
  VisualStyleId,
  WaterBodyConfig,
  WorldMapData,
} from '../types/maker';
import {
  getWorldMapRadius,
  sampleWorldMapAtWorld,
  sampleWorldMapInto,
  WORLD_TERRAIN_YELLOW,
  type WorldMapSample,
} from '../utils/worldMap';
import {
  applySeamlessBoxUVs,
  applySurfaceTextureToMaterial,
  applyWorldScaledBoxUVs,
  collectReferencedTextureIds,
  getProcessedSurfaceTextures,
  getRawCustomTextureSync,
  loadCustomTextureToCache,
} from './customTextureManager';
import {
  createDefaultDirtAndRoadConfig,
  createDefaultMountainConfig,
  createInitialTerrain,
  ensureUpgradedTerrain,
  evaluateVistaHeight,
  getEnvironmentType,
  getLevelWallBoxes,
  getSideScrollerConfig,
  getSideScrollerSegments,
  getTerrainRadius,
  IslandTerrain,
  MountainCave,
  normalizeCaveGrotto,
  RiverCrossing,
  sampleLevelHeight,
  sampleTerrainHeight,
  sampleTerrainWeathering,
} from '../utils/terrain';
import {
  applyVisualStyleToObject,
  getCachedAssetSync,
  instantiateCustomModel,
  loadCustomAssetToCache,
} from './gltfAssetManager';
import { getTerrainTextureAtlas } from './proceduralTextures';
import {
  DUNGEON_FLOOR_STYLE_META,
  DUNGEON_WALL_STYLE_META,
  resolveDungeonStyle,
} from '../services/DungeonGenerator';
import {
  createBroadleafPlantGeometry,
  createCurvedGrassTuftGeometries,
  createDetailedPineTierGeometry,
  createFernRosetteGeometry,
  createMushroomClusterGeometries,
  createOrganicTrunkGeometry,
  createSculptedCanopyLobeGeometry,
  createShrubBerryClusterGeometry,
} from './treeGeometry';
import { StylizedGrassSystem } from './stylizedGrassSystem';
import {
  createHardwareWebGL2Context,
  getRendererMaxTextureArrayLayers,
  isIOSDevice,
  probeHardwareWebGL2,
  recordWebGPUMaxTextureArrayLayers,
} from './webglUtils';
import {
  buildProceduralCanopyForest,
  buildSingleCanopyTreeGroup,
  computeWeatherWindFactor,
} from './canopyClusterBuilder';
import { buildVistaTreeSpeciesInstancedGroup } from './vistaTreeBatcher';
import { resolveEffectiveVistaTreeConfig } from '../utils/defaultTreeStyles';
import { resolveSpeciesConfig } from '../data/canopyEnginePresets';
import {
  nextAnimationFrame,
  runDeferredChunks,
  runDeferredSteps,
  type DeferredStep,
} from '../utils/deferredLoader';

export interface TorchLightHandle {
  light: THREE.PointLight;
  baseIntensity: number;
  phase: number;
}

export interface ChoppableTreeHandle {
  id: string;
  kind: 'pine' | 'oak' | 'birch';
  x: number;
  y: number;
  z: number;
  size: number;
  rotation: number;
  colorHex: string;
  instanceIndex: number;
  meshes: THREE.InstancedMesh[];
  batchedEntries?: BatchEntryRef[];
  treeGroup?: THREE.Group;
  canopyPuffMeshes?: THREE.InstancedMesh[];
  canopyPuffIndices?: number[];
  canopyPuffLocalMatrices?: THREE.Matrix4[];
  hp: number;
  maxHp: number;
  chopped: boolean;
  shakeTimer: number;
  shakeDirX: number;
  shakeDirZ: number;
}

export interface HarvestableScatterHandle {
  id: string;
  scatterKind: 'mushroom' | 'berryBush' | 'fern' | 'broadleaf' | 'flower' | 'rock';
  x: number;
  y: number;
  z: number;
  size: number;
  collected: boolean;
  batchedEntries: BatchEntryRef[];
}

export interface WorldMapRenderContext {
  worldMap?: WorldMapData;
  mode: 'worldMap' | 'land';
  activeRegionCode?: number;
  activeRegionOrigin?: [number, number];
}

export interface IslandSceneHandles {
  group: THREE.Group;
  timeUniform: { value: number };
  windUniform: { value: number };
  customScatterGroups: THREE.Group;
  torchLights: TorchLightHandle[];
  flameMeshes: { mesh: THREE.Object3D; baseY: number; phase: number }[];
  choppableTrees: ChoppableTreeHandle[];
  harvestableScatter: HarvestableScatterHandle[];
  terrainMesh?: THREE.Mesh;
  terrainRenderSize?: number;
  terrainWorldRadius?: number;
  grassSystem?: StylizedGrassSystem;
  waterDepthTex?: THREE.DataTexture;
  waterDepthTexData?: Float32Array;
  waterDepthTexSize?: number;
  pendingFoliagePromise?: Promise<void>;
  updateMountainUniforms?: (cfg?: MountainProfileConfig) => void;
  updateDirtUniforms?: (cfg?: DirtAndRoadConfig) => void;
  updateWaterBodiesUniforms?: (bodies?: WaterBodyConfig[], selectedWaterBodyId?: string | null) => void;
  updateWorldMapUniforms?: (ctx?: WorldMapRenderContext) => void;
}

export interface BuildIslandMeshOptions {
  deferFoliage?: boolean;
  deferFoliageSignal?: AbortSignal;
  onDeferredBatchReady?: (obj: THREE.Object3D) => Promise<void> | void;
  worldMapContext?: WorldMapRenderContext;
}

export function detectSoftwareGl(): boolean {
  return probeHardwareWebGL2().isSoftwareGl;
}

export function computeEffectivePixelRatio(
  width: number,
  height: number,
  isSoftwareGl: boolean,
  resolutionScale = 1
): number {
  if (isSoftwareGl) return 1;
  const isIOS = isIOSDevice();
  const rawDpr = isIOS ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
  let targetPr = rawDpr * (isIOS ? Math.min(resolutionScale, 1) : resolutionScale);
  // Cap total rasterized pixel count around ~2.3M pixels on desktop (900k on iOS) when scale <= 1
  if (resolutionScale <= 1 || isIOS) {
    const maxPixels = isIOS ? 900_000 : 2_300_000;
    const area = Math.max(1, width * height);
    const maxBudgetPr = Math.sqrt(maxPixels / area);
    targetPr = Math.min(targetPr, Math.max(isIOS ? 0.65 : 0.75, maxBudgetPr));
  }
  return THREE.MathUtils.clamp(targetPr, 0.5, isIOS ? 1 : 2.25);
}

export function createMakerRenderer(isSoftwareGl: boolean, forceWebGL = false): WebGPURenderer {
  const isIOS = isIOSDevice();
  const useAntialias = !isSoftwareGl && !isIOS;
  let canvas: HTMLCanvasElement | undefined;
  let glContext: WebGL2RenderingContext | undefined;

  if (forceWebGL && typeof document !== 'undefined') {
    canvas = document.createElement('canvas');
    const { gl } = createHardwareWebGL2Context(canvas, {
      antialias: useAntialias,
      alpha: true,
      depth: true,
      stencil: false,
      isSoftwareGl,
    });
    if (gl) {
      glContext = gl;
    }
  }

  const renderer = new WebGPURenderer({
    canvas,
    context: glContext,
    antialias: useAntialias,
    powerPreference: 'high-performance',
    forceWebGL,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.setPixelRatio(
    isSoftwareGl || isIOS ? 1 : Math.min(window.devicePixelRatio || 1, 1.5)
  );
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  return renderer;
}

/**
 * Initializes a `WebGPURenderer` created by `createMakerRenderer`, inspecting the WebGPU
 * adapter's `limits.maxTextureArrayLayers` prior to device creation so geometries with >256
 * morph targets or array textures can allocate full-resolution layers (e.g. 2048) cleanly
 * when supported, while keeping a safe fallback on hardware capped at 256.
 */
export async function initMakerRenderer(
  renderer: WebGPURenderer,
  desiredMaxTextureArrayLayers = 2048
): Promise<WebGPURenderer> {
  const backend = renderer.backend as
    | {
        isWebGPUBackend?: boolean;
        parameters?: {
          powerPreference?: GPUPowerPreference;
          requiredLimits?: Record<string, number>;
        };
        device?: GPUDevice;
      }
    | undefined;

  if (
    backend?.isWebGPUBackend === true &&
    typeof navigator !== 'undefined' &&
    navigator.gpu &&
    typeof navigator.gpu.requestAdapter === 'function'
  ) {
    try {
      const adapterOptions = {
        powerPreference: backend.parameters?.powerPreference ?? 'high-performance',
        featureLevel: 'compatibility',
      } as GPURequestAdapterOptions;
      const adapter = await navigator.gpu.requestAdapter(adapterOptions);
      const adapterMaxLayers = adapter?.limits?.maxTextureArrayLayers;
      if (typeof adapterMaxLayers === 'number' && adapterMaxLayers > 256) {
        const clampedTarget = Math.min(desiredMaxTextureArrayLayers, adapterMaxLayers);
        if (clampedTarget > 256 && backend.parameters) {
          backend.parameters.requiredLimits = {
            ...(backend.parameters.requiredLimits ?? {}),
            maxTextureArrayLayers: clampedTarget,
          };
        }
      }
    } catch {
      // Proceed with default limits if pre-inspection fails
    }
  }

  await renderer.init();

  if (backend?.isWebGPUBackend === true) {
    recordWebGPUMaxTextureArrayLayers(getRendererMaxTextureArrayLayers(renderer));
  }

  return renderer;
}

export function setupSceneEnvironment(scene: THREE.Scene, renderer: WebGPURenderer): THREE.Texture {
  const pmrem = new PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  pmrem.dispose();
  return envTex;
}

const _liveQualitySize = new THREE.Vector2();

export function applyLiveRendererQuality(
  renderer: WebGPURenderer,
  shadowLight: THREE.DirectionalLight | null,
  postPipeline: { setSize: (w: number, h: number) => void } | null,
  width: number,
  height: number,
  isSoftwareGl: boolean,
  resolutionScale = 1,
  shadowQuality: ViewportShadowQuality = 'medium'
): void {
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  const nextPr = computeEffectivePixelRatio(w, h, isSoftwareGl, resolutionScale);
  const prChanged = Math.abs(renderer.getPixelRatio() - nextPr) > 0.001;
  renderer.getSize(_liveQualitySize);
  const sizeChanged = Math.floor(_liveQualitySize.x) !== w || Math.floor(_liveQualitySize.y) !== h;

  if (prChanged) {
    renderer.setPixelRatio(nextPr);
  }
  if (prChanged || sizeChanged) {
    renderer.setSize(w, h);
    postPipeline?.setSize(w, h);
  }

  const shadowsActive = shadowQuality !== 'off' && !isSoftwareGl;
  renderer.shadowMap.enabled = shadowsActive;
  if (shadowLight) {
    shadowLight.castShadow = shadowsActive;
    const baseRes =
      shadowQuality === 'high' ? 2048 : shadowQuality === 'low' ? 512 : 1024;
    const targetRes = isIOSDevice() ? Math.min(baseRes, 512) : baseRes;
    if (
      shadowLight.shadow.mapSize.x !== targetRes ||
      shadowLight.shadow.mapSize.y !== targetRes
    ) {
      shadowLight.shadow.mapSize.set(targetRes, targetRes);
      if (shadowLight.shadow.map) {
        shadowLight.shadow.map.dispose();
        shadowLight.shadow.map = null;
      }
      shadowLight.shadow.needsUpdate = true;
    }
  }
}

interface ComputedAtmosphere {
  zenithColor: THREE.Color;
  midColor: THREE.Color;
  horizonColor: THREE.Color;
  fogColor: THREE.Color;
  sunColor: THREE.Color;
  sunIntensity: number;
  sunPos: THREE.Vector3;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  nightFactor: number;
  envIntensity: number;
  warmGlow: number;
}

export function computeAtmosphereState(level: GameLevel, overrideTime?: number): ComputedAtmosphere {
  const sky = getSky(level.sky);
  const style: VisualStyleId = level.visualStyle ?? 'painterlyPBR';
  const env = getEnvironmentType(level);

  // Enclosed dark subterranean dungeon overrides outdoor sky brightness
  if (env === 'dungeon') {
    return {
      zenithColor: new THREE.Color('#090B10'),
      midColor: new THREE.Color('#0D1017'),
      horizonColor: new THREE.Color('#11141D'),
      fogColor: new THREE.Color('#0E1118'),
      sunColor: new THREE.Color('#9AA8C7'),
      sunIntensity: 0.42,
      sunPos: new THREE.Vector3(14, 34, 22),
      hemiSky: new THREE.Color('#424D6B'),
      hemiGround: new THREE.Color('#191D26'),
      hemiIntensity: 0.58,
      nightFactor: 0,
      envIntensity: 0.16,
      warmGlow: 0,
    };
  }

  const hasDynamicTime = level.timeOfDay !== undefined || overrideTime !== undefined;

  const cloudDensity = THREE.MathUtils.clamp(
    level.cloudDensity ?? (level.sky === 'storm' ? 0.85 : level.sky === 'mist' ? 0.72 : 0.58),
    0,
    1
  );
  const sunScale = THREE.MathUtils.clamp(level.sunIntensityScale ?? 1, 0.3, 1.8);
  const ambientScale = THREE.MathUtils.clamp(level.ambientIntensityScale ?? 1, 0.3, 1.8);
  const warmth = THREE.MathUtils.clamp(level.atmosphereWarmth ?? 0, -0.5, 0.5);
  const overcastDamp = 1 - Math.max(0, cloudDensity - 0.55) * 0.48;

  const applyTuning = (base: ComputedAtmosphere): ComputedAtmosphere => {
    if (warmth !== 0) {
      const targetWarm = warmth > 0 ? new THREE.Color('#FFAD66') : new THREE.Color('#78B7FF');
      const amt = Math.abs(warmth);
      base.horizonColor.lerp(targetWarm, amt * 0.42);
      base.midColor.lerp(targetWarm, amt * 0.25);
      base.fogColor.lerp(targetWarm, amt * 0.35);
      base.sunColor.lerp(targetWarm, amt * 0.38);
      base.warmGlow = THREE.MathUtils.clamp(base.warmGlow + warmth * 0.55, 0, 1.25);
    }
    if (cloudDensity > 0.65) {
      const hazeAmt = (cloudDensity - 0.65) * 0.55;
      const cloudGrey = new THREE.Color(base.nightFactor > 0.5 ? '#263452' : '#9AA9BA');
      base.zenithColor.lerp(cloudGrey, hazeAmt);
      base.midColor.lerp(cloudGrey, hazeAmt * 0.75);
    }
    base.sunIntensity = base.sunIntensity * sunScale * overcastDamp;
    base.hemiIntensity = base.hemiIntensity * ambientScale * (1 + Math.max(0, cloudDensity - 0.55) * 0.14);
    base.envIntensity = base.envIntensity * THREE.MathUtils.lerp(1, ambientScale, 0.55);
    return base;
  };

  if (!hasDynamicTime) {
    const rad = ((level.sunAngle || 38) * Math.PI) / 180;
    const isNight = level.sky === 'night' || level.sky === 'cave' || env === 'scifi';
    const isGolden = level.sky === 'golden';
    const isStorm = level.sky === 'storm';
    const isMist = level.sky === 'mist';

    const sunPos = isGolden
      ? new THREE.Vector3(Math.cos(rad) * 72, 16 + Math.sin(rad) * 10, 46)
      : new THREE.Vector3(Math.cos(rad) * 58, 34 + Math.sin(rad) * 22, 34);

    const horizon = new THREE.Color(env === 'scifi' ? '#0C1222' : sky.bgHex);
    let zenith: THREE.Color;
    let midColor: THREE.Color;
    let envIntensity = 0.38;
    let warmGlow = 0.25;

    if (isNight) {
      zenith = new THREE.Color('#080D1F');
      midColor = new THREE.Color('#141E3B');
      envIntensity = 0.18;
      warmGlow = 0.05;
    } else if (isGolden) {
      // Rich late-afternoon twilight-slate zenith -> dusty rose-amber mid -> warm golden horizon
      zenith = new THREE.Color('#34466E');
      midColor = new THREE.Color('#A66E64');
      envIntensity = 0.26;
      warmGlow = 0.9;
    } else if (isStorm) {
      zenith = new THREE.Color('#283242');
      midColor = new THREE.Color('#3B4759');
      envIntensity = 0.24;
      warmGlow = 0.1;
    } else if (isMist) {
      zenith = new THREE.Color('#8BA0B2');
      midColor = new THREE.Color('#B3C2CE');
      envIntensity = 0.34;
      warmGlow = 0.2;
    } else {
      zenith = new THREE.Color('#3572B8');
      midColor = new THREE.Color('#6CA4DA');
      envIntensity = 0.4;
      warmGlow = 0.32;
    }

    return applyTuning({
      zenithColor: zenith,
      midColor,
      horizonColor: horizon,
      fogColor: new THREE.Color(env === 'scifi' ? '#0F172A' : sky.fogHex),
      sunColor: new THREE.Color(sky.sunColor),
      sunIntensity: style === 'softFantasy' ? sky.sunIntensity * 1.1 : sky.sunIntensity,
      sunPos,
      hemiSky: new THREE.Color(sky.hemiSky),
      hemiGround: new THREE.Color(sky.hemiGround),
      hemiIntensity: style === 'softFantasy' ? sky.hemiIntensity * 1.15 : sky.hemiIntensity,
      nightFactor: env === 'scifi' ? 0.95 : isNight ? 0.85 : 0,
      envIntensity,
      warmGlow,
    });
  }

  const hour = ((overrideTime ?? level.timeOfDay ?? 12) % 24 + 24) % 24;
  const sunAngleRad = ((hour - 6) / 24) * Math.PI * 2;
  const sunElev = Math.sin(sunAngleRad);
  const sunHoriz = Math.cos(sunAngleRad);
  const azOffsetRad = (((level.sunAngle ?? 38) - 38) * Math.PI) / 180;
  const rawX = sunHoriz * 64;
  const rawZ = 32;
  const cosA = Math.cos(azOffsetRad);
  const sinA = Math.sin(azOffsetRad);
  const sunPos = new THREE.Vector3(
    rawX * cosA - rawZ * sinA,
    Math.max(-20, sunElev * 52) + (sunElev < 0 ? 22 : 12),
    rawX * sinA + rawZ * cosA
  );

  const stops: {
    h: number;
    zen: string;
    mid: string;
    hor: string;
    sun: string;
    sInt: number;
    hSky: string;
    hGnd: string;
    hInt: number;
    envInt: number;
    glow: number;
  }[] = [
    { h: 0, zen: '#0A0F24', mid: '#121B36', hor: '#172242', sun: '#9EB8FF', sInt: 0.7, hSky: '#2E3F73', hGnd: '#171C2E', hInt: 0.52, envInt: 0.18, glow: 0.05 },
    { h: 5, zen: '#162044', mid: '#443B64', hor: '#7A546D', sun: '#FFA97A', sInt: 0.85, hSky: '#6C5E96', hGnd: '#2A2740', hInt: 0.58, envInt: 0.22, glow: 0.55 },
    { h: 6.5, zen: '#2D4E88', mid: '#B5727A', hor: '#F2A36F', sun: '#FFC188', sInt: 1.32, hSky: '#D2A6A0', hGnd: '#4A3B36', hInt: 0.64, envInt: 0.29, glow: 0.88 },
    { h: 12, zen: '#3674BA', mid: '#6CA5DA', hor: '#93C4E8', sun: '#FFF1D8', sInt: 1.58, hSky: '#A8D2F0', hGnd: '#4E663C', hInt: 0.68, envInt: 0.4, glow: 0.3 },
    { h: 17.8, zen: '#34466E', mid: '#A66E64', hor: '#D88E5A', sun: '#FFA95C', sInt: 1.48, hSky: '#988DB2', hGnd: '#3E3026', hInt: 0.62, envInt: 0.26, glow: 0.92 },
    { h: 19.5, zen: '#1B234A', mid: '#4E395E', hor: '#7A4C66', sun: '#B3A0E8', sInt: 0.86, hSky: '#4B4B85', hGnd: '#242138', hInt: 0.56, envInt: 0.2, glow: 0.45 },
    { h: 24, zen: '#0A0F24', mid: '#121B36', hor: '#172242', sun: '#9EB8FF', sInt: 0.7, hSky: '#2E3F73', hGnd: '#171C2E', hInt: 0.52, envInt: 0.18, glow: 0.05 },
  ];

  let a = stops[0];
  let b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (hour >= stops[i].h && hour <= stops[i + 1].h) {
      a = stops[i];
      b = stops[i + 1];
      break;
    }
  }
  const span = Math.max(0.001, b.h - a.h);
  const t = THREE.MathUtils.clamp((hour - a.h) / span, 0, 1);

  const zenith = new THREE.Color(a.zen).lerp(new THREE.Color(b.zen), t);
  const midColor = new THREE.Color(a.mid).lerp(new THREE.Color(b.mid), t);
  const horizon = new THREE.Color(a.hor).lerp(new THREE.Color(b.hor), t);
  const sunColor = new THREE.Color(a.sun).lerp(new THREE.Color(b.sun), t);
  const hemiSky = new THREE.Color(a.hSky).lerp(new THREE.Color(b.hSky), t);
  const hemiGround = new THREE.Color(a.hGnd).lerp(new THREE.Color(b.hGnd), t);

  if (level.sky === 'cave') {
    zenith.lerp(new THREE.Color('#191326'), 0.75);
    midColor.lerp(new THREE.Color('#201830'), 0.75);
    horizon.lerp(new THREE.Color('#251C38'), 0.75);
  } else if (level.sky === 'storm') {
    zenith.lerp(new THREE.Color('#2A3444'), 0.65);
    midColor.lerp(new THREE.Color('#3B4759'), 0.65);
    horizon.lerp(new THREE.Color('#4B586B'), 0.65);
  }

  const nightFactor = THREE.MathUtils.clamp(1 - (sunElev + 0.12) / 0.45, 0, 1);

  return applyTuning({
    zenithColor: zenith,
    midColor,
    horizonColor: horizon,
    fogColor: horizon.clone().lerp(midColor, 0.22),
    sunColor,
    sunIntensity: THREE.MathUtils.lerp(a.sInt, b.sInt, t) * (style === 'softFantasy' ? 1.1 : 1),
    sunPos,
    hemiSky,
    hemiGround,
    hemiIntensity: THREE.MathUtils.lerp(a.hInt, b.hInt, t) * (style === 'softFantasy' ? 1.15 : 1),
    nightFactor,
    envIntensity: THREE.MathUtils.lerp(a.envInt, b.envInt, t),
    warmGlow: THREE.MathUtils.lerp(a.glow, b.glow, t),
  });
}

export function applyAtmosphere(
  scene: THREE.Scene,
  sunLight: THREE.DirectionalLight,
  hemiLight: THREE.HemisphereLight,
  level: GameLevel,
  renderer?: WebGPURenderer,
  overrideTime?: number,
  options?: { isWorldMapMode?: boolean }
): ComputedAtmosphere {
  const atmo = computeAtmosphereState(level, overrideTime);
  const style: VisualStyleId = level.visualStyle ?? 'painterlyPBR';
  const env = getEnvironmentType(level);
  const isWmMode = Boolean(options?.isWorldMapMode);
  const cloudDensity = THREE.MathUtils.clamp(
    level.cloudDensity ?? (level.sky === 'storm' ? 0.85 : level.sky === 'mist' ? 0.72 : 0.58),
    0,
    1
  );
  const starScale = THREE.MathUtils.clamp(level.starIntensity ?? 1, 0, 1.5);

  scene.background = atmo.horizonColor;
  scene.environmentIntensity = atmo.envIntensity;
  syncBotwStyleUniforms(style, atmo, env, cloudDensity, level.sky);
  syncBotwSceneFog(
    scene,
    atmo,
    env,
    level.fog,
    cloudDensity,
    level.sky,
    IslandTerrain.waterLevel,
    level.vistaHeightFog ?? 1
  );
  if (isWmMode) {
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.density *= 0.14;
    }
    const fogU = scene.userData.botwFogUniforms as
      | {
          uFogDensity: { value: number };
          uHeightFogDensity: { value: number };
          uSunInscatterStrength: { value: number };
        }
      | undefined;
    if (fogU) {
      fogU.uFogDensity.value *= 0.14;
      fogU.uHeightFogDensity.value *= 0.1;
      fogU.uSunInscatterStrength.value *= 0.35;
    }
  }

  sunLight.color.copy(atmo.sunColor);
  sunLight.intensity = atmo.sunIntensity;
  sunLight.position.copy(atmo.sunPos);

  hemiLight.color.copy(atmo.hemiSky);
  hemiLight.groundColor.copy(atmo.hemiGround);
  hemiLight.intensity = atmo.hemiIntensity;

  if (renderer) {
    const goldenScale = level.sky === 'golden' ? 0.94 : 1.0;
    renderer.toneMappingExposure =
      (env === 'dungeon'
        ? 1.14
        : style === 'softFantasy'
        ? 1.05
        : style === 'celToon'
        ? 0.98
        : 0.99) * goldenScale;
  }

  const cloudTint = new THREE.Color('#F5EDE4')
    .lerp(atmo.horizonColor, atmo.warmGlow * 0.42)
    .lerp(atmo.sunColor, 0.22);
  if (atmo.nightFactor > 0) {
    cloudTint.lerp(new THREE.Color('#475A7E'), atmo.nightFactor * 0.72);
  }
  if (level.sky === 'storm') {
    cloudTint.lerp(new THREE.Color('#7C899E'), 0.6);
  }

  const skyDome =
    (scene.userData.__makerSkyDome as THREE.Mesh | undefined) ??
    (scene.getObjectByName('maker-skydome') as THREE.Mesh | undefined);
  if (skyDome) {
    scene.userData.__makerSkyDome = skyDome;
    skyDome.visible = env !== 'dungeon';
    const skyU = skyDome.userData?.skyUniforms as
      | {
          uZenith: { value: THREE.Color };
          uMidSky: { value: THREE.Color };
          uHorizon: { value: THREE.Color };
          uSunDir: { value: THREE.Vector3 };
          uSunColor: { value: THREE.Color };
          uWarmGlow: { value: number };
          uCloudDensity: { value: number };
          uCloudColor: { value: THREE.Color };
          uTime: { value: number };
        }
      | undefined;
    if (skyU) {
      skyU.uZenith.value.copy(atmo.zenithColor);
      skyU.uMidSky.value.copy(atmo.midColor);
      skyU.uHorizon.value.copy(atmo.horizonColor);
      skyU.uSunDir.value.copy(atmo.sunPos).normalize();
      skyU.uSunColor.value.copy(atmo.sunColor);
      skyU.uWarmGlow.value = atmo.warmGlow;
      skyU.uCloudDensity.value = env === 'sideScroller' ? cloudDensity * 0.45 : cloudDensity;
      skyU.uCloudColor.value.copy(cloudTint);
    }
  }
  const stars =
    (scene.userData.__makerStars as THREE.Points | undefined) ??
    (scene.getObjectByName('maker-stars') as THREE.Points | undefined);
  if (stars && stars.material instanceof THREE.PointsMaterial) {
    scene.userData.__makerStars = stars;
    const starOpacity = THREE.MathUtils.clamp(atmo.nightFactor * 0.92 * starScale * (1 - cloudDensity * 0.45), 0, 1);
    stars.material.opacity = starOpacity;
    stars.visible = env !== 'dungeon' && starOpacity > 0.03;
  }

  const clouds =
    (scene.userData.__makerClouds as THREE.Group | undefined) ??
    (scene.getObjectByName('maker-clouds') as THREE.Group | undefined);
  if (clouds) {
    scene.userData.__makerClouds = clouds;
    clouds.visible =
      !isWmMode && env !== 'dungeon' && env !== 'sideScroller' && cloudDensity > 0.015;
    const cloudMat = clouds.userData?.material as THREE.MeshStandardMaterial | undefined;
    if (cloudMat) {
      cloudMat.color.copy(cloudTint);
      cloudMat.emissive.copy(atmo.horizonColor).multiplyScalar(atmo.warmGlow * 0.22);
      cloudMat.emissiveIntensity = atmo.warmGlow > 0.4 ? 0.48 : 0.14;
      if (atmo.nightFactor > 0) {
        cloudMat.emissiveIntensity = 0.04;
      }
      if (level.sky === 'storm') {
        cloudMat.emissiveIntensity = 0.05;
      }
    }
    const fullnessScale = 0.72 + cloudDensity * 0.52;
    for (const child of clouds.children) {
      const ud = child.userData as { priority?: number; baseScale?: number };
      const priority = ud.priority ?? 0.5;
      const baseScale = ud.baseScale ?? 3.0;
      const isVisible = priority < cloudDensity;
      child.visible = isVisible;
      if (isVisible) {
        // Gently ramp in newly appearing clouds near the density threshold
        const edgeFade = THREE.MathUtils.clamp((cloudDensity - priority) / 0.14, 0.35, 1);
        child.scale.setScalar(baseScale * fullnessScale * edgeFade);
      }
    }
  }

  return atmo;
}

function createFacetedCloudMesh(mat: THREE.Material, variant = 0): THREE.Group {
  const cloud = new THREE.Group();
  const puffLayouts: [number, number, number, number, number, number, number][][] = [
    [
      [0, 0.25, 0, 2.35, 1.35, 0.74, 1.08],
      [-2.15, -0.15, 0.35, 1.65, 1.15, 0.68, 0.96],
      [2.25, -0.1, -0.25, 1.75, 1.2, 0.7, 1.0],
      [-0.85, 0.95, 0.18, 1.55, 1.05, 0.88, 0.95],
      [1.05, 0.82, -0.15, 1.45, 1.0, 0.84, 0.92],
      [0.2, 0.1, 1.25, 1.4, 1.1, 0.68, 0.92],
      [-0.25, 0.05, -1.2, 1.35, 1.05, 0.66, 0.9],
    ],
    [
      [0, 0.15, 0, 2.55, 1.45, 0.7, 1.05],
      [-2.45, -0.15, -0.2, 1.7, 1.15, 0.64, 0.95],
      [2.4, -0.18, 0.3, 1.65, 1.12, 0.66, 0.94],
      [0.35, 1.08, 0.1, 1.68, 1.08, 0.9, 0.98],
      [-1.15, 0.72, -0.22, 1.38, 1.0, 0.82, 0.9],
      [1.35, 0.58, 0.18, 1.3, 1.0, 0.78, 0.92],
    ],
    [
      [-0.4, 0.18, 0, 2.15, 1.25, 0.72, 1.0],
      [1.55, 0.08, 0.25, 1.88, 1.18, 0.7, 0.96],
      [-2.15, -0.2, 0.2, 1.35, 1.08, 0.64, 0.88],
      [0.55, 0.92, -0.12, 1.48, 1.02, 0.88, 0.94],
      [-1.05, 0.72, 0.18, 1.28, 0.96, 0.82, 0.9],
    ],
  ];

  const layout = puffLayouts[Math.abs(variant) % puffLayouts.length];
  for (let i = 0; i < layout.length; i++) {
    const [px, py, pz, r, sx, sy, sz] = layout[i];
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat);
    puff.position.set(px, py, pz);
    puff.scale.set(sx, sy, sz);
    puff.rotation.set(((i * 0.7 + variant) % 1) * 0.45, (i * 1.1 + variant) % Math.PI, 0);
    cloud.add(puff);
  }
  return cloud;
}

export function updateSkyClouds(scene: THREE.Scene, elapsed: number, wind = 0.3) {
  syncBotwTime(elapsed);
  let skyDome = scene.userData.__makerSkyDome as THREE.Mesh | undefined;
  if (!skyDome) {
    skyDome = scene.getObjectByName('maker-skydome') as THREE.Mesh | undefined;
    if (skyDome) scene.userData.__makerSkyDome = skyDome;
  }
  const skyU = skyDome?.userData?.skyUniforms as { uTime?: { value: number } } | undefined;
  if (skyDome && skyDome.visible && skyU?.uTime) {
    skyU.uTime.value = elapsed * (0.35 + wind * 0.9);
  }
  let clouds = scene.userData.__makerClouds as THREE.Group | undefined;
  if (!clouds) {
    clouds = scene.getObjectByName('maker-clouds') as THREE.Group | undefined;
    if (clouds) scene.userData.__makerClouds = clouds;
  }
  if (!clouds || !clouds.visible) return;
  const speedBoost = 0.35 + wind * 1.15;
  for (const child of clouds.children) {
    if (!child.visible) continue;
    const ud = child.userData as {
      baseAngle?: number;
      radius?: number;
      baseY?: number;
      driftSpeed?: number;
      bobPhase?: number;
    };
    if (ud.baseAngle === undefined || ud.radius === undefined || ud.baseY === undefined) continue;
    const ang = ud.baseAngle + elapsed * (ud.driftSpeed ?? 0.008) * speedBoost;
    child.position.set(
      Math.cos(ang) * ud.radius,
      ud.baseY + Math.sin(elapsed * 0.45 + (ud.bobPhase ?? 0)) * 0.9,
      Math.sin(ang) * ud.radius
    );
    child.rotation.y = -ang + Math.PI * 0.5;
  }
}

export function syncSkyDomeToCamera(scene: THREE.Scene, cameraPos: THREE.Vector3) {
  let skyDome = scene.userData.__makerSkyDome as THREE.Mesh | undefined;
  if (!skyDome) {
    skyDome = scene.getObjectByName('maker-skydome') as THREE.Mesh | undefined;
    if (skyDome) scene.userData.__makerSkyDome = skyDome;
  }
  if (skyDome) {
    skyDome.position.set(cameraPos.x, 0, cameraPos.z);
  }
  let stars = scene.userData.__makerStars as THREE.Points | undefined;
  if (!stars) {
    stars = scene.getObjectByName('maker-stars') as THREE.Points | undefined;
    if (stars) scene.userData.__makerStars = stars;
  }
  if (stars) {
    stars.position.set(cameraPos.x, 0, cameraPos.z);
  }
}

const skyHash21Tsl = Fn(([pIn]: [any]) => {
  const p = vec2(fract(vec2(pIn).mul(vec2(123.34, 456.21)))).toVar();
  p.addAssign(dot(p, p.add(45.32)));
  return fract(p.x.mul(p.y));
});

const skyValueNoiseTsl = Fn(([p]: [any]) => {
  const i = floor(p);
  const fRaw = fract(p);
  const f = fRaw.mul(fRaw).mul(vec2(3.0).sub(fRaw.mul(2.0)));
  const a = skyHash21Tsl(i);
  const b = skyHash21Tsl(i.add(vec2(1.0, 0.0)));
  const c = skyHash21Tsl(i.add(vec2(0.0, 1.0)));
  const d = skyHash21Tsl(i.add(vec2(1.0, 1.0)));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
});

const skyFbmCloudTsl = Fn(([pIn]: [any]) => {
  const v = float(0.0).toVar();
  const amp = float(0.52).toVar();
  const p = vec2(pIn).toVar();
  Loop(4, () => {
    v.addAssign(amp.mul(skyValueNoiseTsl(p)));
    const nextP = vec2(p.x.mul(0.8).sub(p.y.mul(0.6)), p.x.mul(0.6).add(p.y.mul(0.8)))
      .mul(2.06)
      .add(vec2(1.7, 9.2));
    p.assign(nextP);
    amp.mulAssign(0.48);
  });
  return v;
});

export function ensureSkyDome(scene: THREE.Scene) {
  if (!scene.userData.__makerSkyDome && !scene.getObjectByName('maker-skydome')) {
    const skyGeo = new THREE.SphereGeometry(2400, 28, 18);
    const uZenith = uniform(new THREE.Color('#34466E'));
    const uMidSky = uniform(new THREE.Color('#A66E64'));
    const uHorizon = uniform(new THREE.Color('#D88E5A'));
    const uSunDir = uniform(new THREE.Vector3(0.6, 0.28, 0.45).normalize());
    const uSunColor = uniform(new THREE.Color('#FFA95C'));
    const uWarmGlow = uniform(0.9);
    const uCloudDensity = uniform(0.58);
    const uCloudColor = uniform(new THREE.Color('#F5EDE4'));
    const uTime = uniform(0);

    const skyMat = new MeshBasicNodeMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      toneMapped: true,
    });

    skyMat.colorNode = Fn(() => {
      const dir = normalize(positionLocal);
      const elev = clamp(dir.y, 0.0, 1.0);
      const lowerT = smoothstep(0.0, 0.34, elev);
      const upperT = smoothstep(0.24, 0.95, elev);
      const col = mix(uHorizon, uMidSky, lowerT).toVar();
      col.assign(mix(col, uZenith, pow(upperT, 0.85)));

      const sunDirN = normalize(uSunDir);
      const sunDot = max(0.0, dot(dir, sunDirN));
      const horizonBand = pow(float(1.0).sub(clamp(elev.mul(2.4), 0.0, 1.0)), 2.5);
      const sunAzimuth = max(
        0.0,
        dot(
          normalize(vec3(dir.x, 0.0, dir.z).add(vec3(0.0001))),
          normalize(vec3(sunDirN.x, 0.0, sunDirN.z).add(vec3(0.0001)))
        )
      );

      col.addAssign(
        uSunColor.mul(horizonBand).mul(float(0.06).add(pow(sunAzimuth, 2.0).mul(0.16))).mul(uWarmGlow)
      );
      col.addAssign(uSunColor.mul(pow(sunDot, 10.0)).mul(float(0.14).add(uWarmGlow.mul(0.14))));
      col.addAssign(uSunColor.mul(pow(sunDot, 72.0)).mul(0.32));
      col.addAssign(uSunColor.mul(pow(sunDot, 380.0)).mul(0.72));

      If(uCloudDensity.greaterThan(0.01).and(dir.y.greaterThan(0.01)), () => {
        const skyUV = vec2(dir.x, dir.z).div(dir.y.add(0.18)).mul(1.45);
        const drift = vec2(uTime.mul(0.025), uTime.mul(0.011));
        const n1 = skyFbmCloudTsl(skyUV.add(drift));
        const n2 = skyFbmCloudTsl(skyUV.mul(2.15).sub(drift.mul(1.35)));
        const rawCloud = n1.mul(0.68).add(n2.mul(0.32));
        const threshold = mix(0.82, 0.28, uCloudDensity);
        const cloudMask = smoothstep(threshold, threshold.add(0.24), rawCloud);
        const horizonFade = smoothstep(0.01, 0.22, dir.y);
        const alpha = cloudMask.mul(horizonFade).mul(float(0.28).add(uCloudDensity.mul(0.56)));
        const litCloud = mix(
          uCloudColor,
          uSunColor.mul(1.18),
          pow(sunDot, 5.0).mul(float(0.28).add(uWarmGlow.mul(0.25)))
        );
        col.assign(mix(col, litCloud, clamp(alpha, 0.0, 0.82)));
      });

      return vec4(col, 1.0);
    })();

    const dome = new THREE.Mesh(skyGeo, skyMat);
    dome.name = 'maker-skydome';
    dome.frustumCulled = false;
    dome.userData.skyUniforms = {
      uZenith,
      uMidSky,
      uHorizon,
      uSunDir,
      uSunColor,
      uWarmGlow,
      uCloudDensity,
      uCloudColor,
      uTime,
    };
    scene.userData.__makerSkyDome = dome;
    scene.add(dome);
  } else if (!scene.userData.__makerSkyDome) {
    scene.userData.__makerSkyDome = scene.getObjectByName('maker-skydome');
  }

  if (!scene.userData.__makerStars && !scene.getObjectByName('maker-stars')) {
    const count = 480;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.45;
      const r = 2200;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi) + 8;
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: '#FFFFFF',
      size: 3.5,
      transparent: true,
      opacity: 0,
      fog: false,
      depthWrite: false,
    });
    const stars = new THREE.Points(geo, mat);
    stars.name = 'maker-stars';
    stars.frustumCulled = false;
    stars.visible = false;
    scene.userData.__makerStars = stars;
    scene.add(stars);
  } else if (!scene.userData.__makerStars) {
    scene.userData.__makerStars = scene.getObjectByName('maker-stars');
  }

  if (!scene.userData.__makerClouds && !scene.getObjectByName('maker-clouds')) {
    const cloudsGroup = new THREE.Group();
    cloudsGroup.name = 'maker-clouds';
    const cloudMat = new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      roughness: 0.94,
      metalness: 0.0,
      flatShading: true,
    });
    cloudsGroup.userData.material = cloudMat;

    const totalClouds = 48;
    for (let i = 0; i < totalClouds; i++) {
      const baseAngle = (i / totalClouds) * Math.PI * 2 + (i % 3) * 0.11;
      const band = i % 3;
      const radius = band === 0 ? 130 + (i % 5) * 18 : band === 1 ? 228 + (i % 7) * 16 : 330 + (i % 5) * 18;
      const baseY = band === 0 ? 48 + (i % 4) * 7 : band === 1 ? 64 + (i % 5) * 7 : 78 + (i % 4) * 8;
      const baseScale = band === 0 ? 2.4 + (i % 3) * 0.6 : band === 1 ? 3.3 + (i % 3) * 0.8 : 4.2 + (i % 4) * 0.75;
      // Golden-ratio priority spreads emerging clouds evenly around 360° as cloudDensity rises
      const priority = (i * 0.61803398875) % 1;

      const cloud = createFacetedCloudMesh(cloudMat, i);
      cloud.scale.setScalar(baseScale);
      cloud.position.set(Math.cos(baseAngle) * radius, baseY, Math.sin(baseAngle) * radius);
      cloud.rotation.y = -baseAngle + Math.PI * 0.5;
      cloud.userData = {
        baseAngle,
        radius,
        baseY,
        baseScale,
        priority,
        driftSpeed: 0.0052 + (i % 4) * 0.0017,
        bobPhase: i * 0.9,
      };
      cloudsGroup.add(cloud);
    }
    scene.userData.__makerClouds = cloudsGroup;
    scene.add(cloudsGroup);
  } else if (!scene.userData.__makerClouds) {
    scene.userData.__makerClouds = scene.getObjectByName('maker-clouds');
  }
}

const tHash21Tsl = Fn(([pIn]: [any]) => {
  const p = vec2(fract(vec2(pIn).mul(vec2(127.1, 311.7)))).toVar();
  p.addAssign(dot(p, p.add(34.345)));
  return fract(p.x.mul(p.y));
});

const tNoise2DTsl = Fn(([p]: [any]) => {
  const i = floor(p);
  const fRaw = fract(p);
  const f = fRaw.mul(fRaw).mul(vec2(3.0).sub(fRaw.mul(2.0)));
  const a = tHash21Tsl(i);
  const b = tHash21Tsl(i.add(vec2(1.0, 0.0)));
  const c = tHash21Tsl(i.add(vec2(0.0, 1.0)));
  const d = tHash21Tsl(i.add(vec2(1.0, 1.0)));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
});

const tFbm2DTsl = Fn(([pIn]: [any]) => {
  const v = float(0.0).toVar();
  const a = float(0.5).toVar();
  const p = vec2(pIn).toVar();
  Loop(3, () => {
    v.addAssign(a.mul(tNoise2DTsl(p)));
    const nextP = vec2(p.x.mul(0.8).sub(p.y.mul(0.6)), p.x.mul(0.6).add(p.y.mul(0.8)))
      .mul(2.08)
      .add(vec2(3.1, 7.4));
    p.assign(nextP);
    a.mulAssign(0.48);
  });
  return v;
});

function xformTerrainUvTsl(uvNode: any, params: THREE.Vector4, rotRad: number) {
  const c = cos(float(rotRad));
  const s = sin(float(rotRad));
  const rx = uvNode.x.mul(c).sub(uvNode.y.mul(s));
  const ry = uvNode.x.mul(s).add(uvNode.y.mul(c));
  return vec2(rx, ry).mul(vec2(params.x, params.y)).add(vec2(params.z, params.w));
}

function sampleTerrainReliefTsl(tex: THREE.Texture, uvNode: any, strengthVal: any) {
  if (typeof strengthVal === 'number' && strengthVal < 0.01) return float(1.0);
  const lumaW = vec3(0.299, 0.587, 0.114);
  const cL = texture(tex, uvNode.sub(vec2(0.0045, 0.0))).rgb;
  const cR = texture(tex, uvNode.add(vec2(0.0045, 0.0))).rgb;
  const cD = texture(tex, uvNode.sub(vec2(0.0, 0.0045))).rgb;
  const cU = texture(tex, uvNode.add(vec2(0.0, 0.0045))).rgb;
  const grad = dot(cR, lumaW).sub(dot(cL, lumaW)).mul(0.72).add(dot(cU, lumaW).sub(dot(cD, lumaW)).mul(0.68));
  return clamp(float(1.0).add(grad.mul(strengthVal).mul(1.9)), 0.62, 1.38);
}

const _sampleIslandFloatUniform = uniform(0);

function asIslandFloatUniformNode(
  u?: { value: number },
  fallback = 0
): typeof _sampleIslandFloatUniform {
  if (u && (u as unknown as { isNode?: boolean }).isNode) {
    return u as typeof _sampleIslandFloatUniform;
  }
  return uniform(u?.value ?? fallback);
}

function resolveMountainNoiseIndex(noiseType?: MountainProfileConfig['noiseType']): number {
  if (noiseType === 'ridged') return 1;
  if (noiseType === 'billow') return 2;
  if (noiseType === 'terraced') return 3;
  return 0;
}

function resolveDirtNoiseIndex(kind?: DirtAndRoadConfig['noiseKind']): number {
  if (kind === 'crackedEarth') return 1;
  if (kind === 'rockyGritty') return 2;
  if (kind === 'patchy') return 3;
  return 0;
}

interface TerrainMaterialBundle {
  material: THREE.Material;
  updateMountainUniforms: (cfg?: MountainProfileConfig) => void;
  updateDirtUniforms: (cfg?: DirtAndRoadConfig) => void;
  updateWorldMapUniforms: (ctx?: WorldMapRenderContext) => void;
}

function createTerrainMaterial(
  biomeGroundHex: string,
  biomeDetailHex: string,
  style: VisualStyleId,
  sceneryTextures?: Partial<Record<SceneryTextureSlot, SurfaceTextureSettings>>,
  timeUniform?: { value: number },
  windUniform?: { value: number },
  mountainConfig?: MountainProfileConfig,
  dirtConfig?: DirtAndRoadConfig,
  worldMapContext?: WorldMapRenderContext
): TerrainMaterialBundle {
  const atlas = getTerrainTextureAtlas();
  const grassTint = new THREE.Color(biomeGroundHex);
  const mossTint = new THREE.Color(biomeDetailHex).lerp(new THREE.Color('#3C8D4B'), 0.45);
  const mtnCfg = mountainConfig ?? createDefaultMountainConfig();
  const dCfg = dirtConfig ?? createDefaultDirtAndRoadConfig();

  const uMtnRockH = uniform(mtnCfg.rockStartHeight);
  const uMtnSnowH = uniform(mtnCfg.snowStartHeight);
  const uMtnBandSoftness = uniform(Math.max(0.18, mtnCfg.bandTransition * 3.8));
  const uMtnNoiseScale = uniform(mtnCfg.noiseScale);
  const uMtnNoiseMode = uniform(resolveMountainNoiseIndex(mtnCfg.noiseType));
  const uMtnRoughness = uniform(mtnCfg.roughness);
  const uMtnRandomness = uniform(mtnCfg.randomness);

  const uDirtHeroCol = uniform(new THREE.Color(dCfg.heroColor));
  const uDirtSecCol = uniform(new THREE.Color(dCfg.secondaryColor));
  const uDirtUseCustom = uniform(dirtConfig ? 1 : 0);
  const uDirtNoiseKind = uniform(resolveDirtNoiseIndex(dCfg.noiseKind));
  const uDirtNoiseContrast = uniform(dCfg.noiseContrast);
  const uDirtBumpStrength = uniform(dCfg.bumpStrength);
  const uDirtDegrade = uniform(dCfg.degradeAmount);

  const uWorldMapMode = uniform(worldMapContext?.mode === 'worldMap' ? 1 : 0);
  const uGrayOtherLand = uniform(
    worldMapContext?.mode === 'land' &&
      worldMapContext?.worldMap &&
      (worldMapContext.activeRegionCode ?? 0) > 0
      ? 1
      : 0
  );

  const customGrass = getProcessedSurfaceTextures(sceneryTextures?.grass);
  const customPath = getProcessedSurfaceTextures(sceneryTextures?.pathRoad);
  const customRock = getProcessedSurfaceTextures(sceneryTextures?.rocks);

  const grassUv = customGrass
    ? new THREE.Vector4(
        customGrass.settings.repeatX,
        customGrass.settings.repeatY,
        customGrass.settings.offsetX,
        customGrass.settings.offsetY
      )
    : new THREE.Vector4(1, 1, 0, 0);
  const grassRot = customGrass ? THREE.MathUtils.degToRad(customGrass.settings.rotationDeg ?? 0) : 0;
  const grassTintStrength = customGrass ? THREE.MathUtils.clamp(customGrass.settings.tintStrength ?? 0.22, 0, 1) : 1.0;
  const grassBumpStrength = customGrass ? THREE.MathUtils.clamp(customGrass.settings.bumpStrength ?? 0.35, 0, 1) : 0;

  const pathUv = customPath
    ? new THREE.Vector4(
        customPath.settings.repeatX,
        customPath.settings.repeatY,
        customPath.settings.offsetX,
        customPath.settings.offsetY
      )
    : new THREE.Vector4(1.25, 1.25, 0, 0);
  const cobbleUv = customPath ? pathUv.clone() : new THREE.Vector4(1.35, 1.35, 0, 0);
  const pathRot = customPath ? THREE.MathUtils.degToRad(customPath.settings.rotationDeg ?? 0) : 0;
  const pathBumpStrength = customPath ? THREE.MathUtils.clamp(customPath.settings.bumpStrength ?? 0.5, 0, 1) : 0;

  const rockUv = customRock
    ? new THREE.Vector4(
        customRock.settings.repeatX,
        customRock.settings.repeatY,
        customRock.settings.offsetX,
        customRock.settings.offsetY
      )
    : new THREE.Vector4(1.15, 1.15, 0, 0);
  const rockRot = customRock ? THREE.MathUtils.degToRad(customRock.settings.rotationDeg ?? 0) : 0;
  const rockBumpStrength = customRock ? THREE.MathUtils.clamp(customRock.settings.bumpStrength ?? 0.6, 0, 1) : 0;

  const uTime = asIslandFloatUniformNode(timeUniform, 0);
  const uWind = asIslandFloatUniformNode(windUniform, 0.45);
  const texGrass = customGrass ? customGrass.map : atlas.grass;
  const texRock = customRock ? customRock.map : atlas.rock;
  const texPath = customPath ? customPath.map : atlas.cobble;
  const texDirt = customPath ? customPath.map : atlas.dirt;
  const isToon = style === 'celToon';

  const terrainColorNode = Fn(() => {
    const vW0 = attribute('aW0', 'vec4');
    const vW1 = attribute('aW1', 'vec3');
    const wp = positionWorld;
    const wn = normalize(normalWorld);

    const wpXZ = vec2(wp.x, wp.z);
    const uvW = wpXZ.mul(0.16);
    const uvFine = wpXZ.mul(0.42);
    const orgMacro = tFbm2DTsl(wpXZ.mul(0.19));
    const orgFine = tFbm2DTsl(wpXZ.mul(0.68).add(vec2(11.3, 4.7)));
    const edgeJitter = orgMacro.sub(0.5).mul(0.38).add(orgFine.sub(0.5).mul(0.22));

    const dapple1 = sin(wp.x.mul(0.075).add(sin(wp.z.mul(0.055)).mul(1.4))).mul(cos(wp.z.mul(0.068).add(0.6)));
    const dapple2 = sin(wp.x.mul(0.14).sub(wp.z.mul(0.11)).add(1.8)).mul(0.5);
    const meadowVar = float(0.94).add(dapple1.add(dapple2).mul(0.055)).add(orgFine.sub(0.5).mul(0.09));

    const uvGrass = xformTerrainUvTsl(uvW, grassUv, grassRot);
    const uvGrassFine = xformTerrainUvTsl(uvFine, grassUv, grassRot + 0.35);
    const uvRock = xformTerrainUvTsl(uvW, rockUv, rockRot);
    const uvRockSlope = xformTerrainUvTsl(
      vec2(wp.x.add(wp.z).mul(0.17), wp.y.mul(0.24)),
      rockUv,
      rockRot
    );
    const uvCobble = xformTerrainUvTsl(uvW, cobbleUv, pathRot);
    const uvDirt = xformTerrainUvTsl(uvW, pathUv, pathRot);

    const gTint = mix(
      vec3(1.0),
      vec3(grassTint.r, grassTint.g, grassTint.b),
      float(grassTintStrength)
    );
    const cGrassMacro = texture(texGrass, uvGrass).rgb;
    const cGrassFine = texture(texGrass, uvGrassFine).rgb;
    const cGrass = mix(cGrassMacro, cGrassFine, 0.34)
      .mul(gTint)
      .mul(meadowVar)
      .mul(sampleTerrainReliefTsl(texGrass, uvGrass, Math.max(0.24, grassBumpStrength)));

    const cSandMacro = texture(atlas.sand, uvW).rgb;
    const cSandFine = texture(atlas.sand, uvFine.mul(1.25)).rgb;
    const cSand = mix(cSandMacro, cSandFine, 0.38).mul(float(0.94).add(orgFine.mul(0.12)));

    const slopeAmt = clamp(float(1.0).sub(abs(wn.y)), 0.0, 1.0);
    const mUv = wpXZ.mul(0.075).mul(uMtnNoiseScale);
    const mFbm = tFbm2DTsl(mUv);
    const mRidged = float(1.0).sub(abs(mFbm.mul(2.0).sub(1.0)));
    const mBillow = abs(mFbm.mul(2.0).sub(1.0));
    const mTerraced = floor(mFbm.mul(5.0)).div(5.0);
    const mNoise = select(
      uMtnNoiseMode.lessThan(0.5),
      mFbm,
      select(
        uMtnNoiseMode.lessThan(1.5),
        mRidged,
        select(uMtnNoiseMode.lessThan(2.5), mBillow, mTerraced)
      )
    );
    const mAlt = wp.y.add(mNoise.sub(0.5).mul(3.6).mul(uMtnRandomness));
    const mRockBand = smoothstep(uMtnRockH.sub(uMtnBandSoftness), uMtnRockH.add(uMtnBandSoftness), mAlt);
    const mSnowBand = smoothstep(uMtnSnowH.sub(uMtnBandSoftness), uMtnSnowH.add(uMtnBandSoftness), mAlt);

    const cRockFlat = texture(texRock, uvRock).rgb;
    const cRockWall = texture(texRock, uvRockSlope).rgb;
    const strata = float(0.92).add(sin(wp.y.mul(2.4).add(orgMacro.mul(4.5))).mul(0.16));
    const cRock = mix(cRockFlat, cRockWall, smoothstep(0.22, 0.62, slopeAmt))
      .mul(strata)
      .mul(float(1.0).add(mNoise.sub(0.5).mul(0.32).mul(uMtnRoughness)))
      .mul(sampleTerrainReliefTsl(texRock, uvRock, Math.max(0.35, rockBumpStrength)));

    const cSnow = texture(atlas.snow, uvW).rgb.mul(float(0.96).add(orgFine.mul(0.08)));
    const cMossRaw = mix(
      texture(atlas.moss, uvW.mul(1.05)).rgb,
      texture(atlas.moss, uvFine.mul(0.95)).rgb,
      0.35
    ).mul(
      mix(
        vec3(1.0),
        vec3(mossTint.r, mossTint.g, mossTint.b),
        float(isToon ? 0.22 : 0.2)
      )
    );
    const cMoss = mix(cGrass.mul(0.89), cMossRaw, float(isToon ? 0.48 : 0.46));
    const cCobble = texture(texPath, uvCobble).rgb.mul(
      sampleTerrainReliefTsl(texPath, uvCobble, Math.max(0.3, pathBumpStrength))
    );

    const dFbm = tFbm2DTsl(wpXZ.mul(0.28));
    const dFine = tNoise2DTsl(wpXZ.mul(0.95));
    const dCracked = smoothstep(0.12, 0.36, abs(dFine.sub(0.5)).mul(2.0));
    const dRocky = step(0.62, dFine).mul(0.6).add(dFbm.mul(0.4));
    const dPatchy = smoothstep(0.26, 0.74, tFbm2DTsl(wpXZ.mul(0.11)));
    const dMixFactor = select(
      uDirtNoiseKind.lessThan(0.5),
      dFbm,
      select(
        uDirtNoiseKind.lessThan(1.5),
        dCracked,
        select(uDirtNoiseKind.lessThan(2.5), dRocky, dPatchy)
      )
    );
    const dContrasted = clamp(
      dMixFactor.sub(0.5).mul(float(0.6).add(uDirtNoiseContrast.mul(1.8))).add(0.5),
      0.0,
      1.0
    );
    const dCustomTint = mix(uDirtSecCol, uDirtHeroCol, dContrasted);
    const cDirtBase = mix(texture(texDirt, uvDirt).rgb, texture(texDirt, uvFine).rgb, 0.32).mul(
      sampleTerrainReliefTsl(texDirt, uvDirt, float(0.25).add(uDirtBumpStrength.mul(0.55)))
    );
    const cDirt = mix(
      cDirtBase,
      cDirtBase.mul(vec3(1.18)).mul(dCustomTint),
      uDirtUseCustom
    ).mul(float(1.0).sub(uDirtDegrade.mul(0.24).mul(float(1.0).sub(dFbm))));

    const avgW = vec3(0.33, 0.33, 0.33);
    const hGrass = float(0.55).add(orgFine.mul(0.35)).add(dot(cGrassMacro, avgW).sub(0.5).mul(0.25));
    const hSand = float(0.42).add(orgMacro.mul(0.28)).add(dot(cSandFine, avgW).sub(0.5).mul(0.22));
    const hRock = float(0.58).add(orgMacro.mul(0.32));
    const hDirt = float(0.48).add(orgFine.mul(0.3));

    const w0x = select(vW0.x.greaterThan(0.01), edgeJitter.mul(0.65).add(hGrass.sub(0.5).mul(0.18)), 0.0);
    const w0y = select(vW0.y.greaterThan(0.01), edgeJitter.mul(-0.68).add(hSand.sub(0.5).mul(0.18)), 0.0);
    const w0z = select(vW0.z.greaterThan(0.01), edgeJitter.mul(0.55).add(hRock.sub(0.5).mul(0.2)), 0.0);
    const w0w = select(vW0.w.greaterThan(0.01), edgeJitter.mul(0.5), 0.0);
    const w1x = select(vW1.x.greaterThan(0.01), edgeJitter.mul(0.58), 0.0);
    const w1y = select(vW1.y.greaterThan(0.01), edgeJitter.mul(-0.45), 0.0);
    const w1z = select(vW1.z.greaterThan(0.01), edgeJitter.mul(-0.62).add(hDirt.sub(0.5).mul(0.18)), 0.0);

    const w0Raw = max(vec4(0.0), vW0.add(vec4(w0x, w0y, w0z, w0w)));
    const w1Raw = max(vec3(0.0), vW1.add(vec3(w1x, w1y, w1z)));

    const w0 = pow(w0Raw.add(vec4(0.0001)), vec4(1.32)).mul(step(0.002, vW0));
    const w1 = pow(w1Raw.add(vec3(0.0001)), vec3(1.32)).mul(step(0.002, vW1));
    const sumW = w0.x.add(w0.y).add(w0.z).add(w0.w).add(w1.x).add(w1.y).add(w1.z).add(0.0001);

    const texCol = cGrass
      .mul(w0.x)
      .add(cSand.mul(w0.y))
      .add(cRock.mul(w0.z))
      .add(cSnow.mul(w0.w))
      .add(cMoss.mul(w1.x))
      .add(cCobble.mul(w1.y))
      .add(cDirt.mul(w1.z))
      .div(sumW)
      .toVar();

    const waterElev = wp.y.add(1.65);
    const bankSandMask = float(1.0)
      .sub(
        smoothstep(
          float(0.18).add(edgeJitter.mul(0.45)),
          float(1.35).add(edgeJitter.mul(0.75)),
          waterElev
        )
      )
      .mul(smoothstep(-0.85, -0.05, waterElev));
    texCol.assign(mix(texCol, mix(cSand, cDirt.mul(1.06), float(0.22).add(orgFine.mul(0.2))), bankSandMask.mul(0.52)));

    const rockSlope = smoothstep(float(0.36).add(edgeJitter.mul(0.12)), 0.76, slopeAmt);
    const rockCov = clamp(max(rockSlope, mRockBand.mul(0.82)).mul(float(1.0).sub(mSnowBand.mul(0.88))), 0.0, 1.0);
    texCol.assign(mix(texCol, cRock, rockCov.mul(isToon ? 0.84 : 0.88)));

    const snowCov = mSnowBand.mul(float(1.0).sub(smoothstep(0.58, 0.9, slopeAmt).mul(0.65)));
    texCol.assign(mix(texCol, cSnow, snowCov.mul(0.88)));

    const meadowCov = clamp(w0.x.add(w1.x.mul(0.85)).div(sumW), 0.0, 1.0).mul(float(1.0).sub(rockCov));
    const wDirT = normalize(vec2(0.84, 0.54));
    const wSpeedT = float(0.85).add(uWind.mul(0.95));
    const wUvT = wpXZ.mul(0.052).sub(wDirT.mul(uTime.mul(wSpeedT).mul(0.62)));
    const distantWave = smoothstep(
      0.32,
      0.84,
      tNoise2DTsl(wUvT).mul(0.65).add(tNoise2DTsl(wUvT.mul(2.15).add(vec2(4.2, 1.7))).mul(0.35))
    );
    texCol.addAssign(
      vec3(0.055, 0.075, 0.015).mul(distantWave).mul(meadowCov).mul(clamp(uWind.mul(0.7).add(0.35), 0.25, 1.2))
    );

    const microDetail = float(0.96).add(orgFine.sub(0.5).mul(0.09));
    texCol.mulAssign(microDetail);

    const vWeather0 = attribute('aWeather0', 'vec4');
    const vWeather1 = attribute('aWeather1', 'float');
    const chipFromCrack = vWeather0.y.mul(0.55);
    const mudWet = vWeather0.w.mul(0.32);
    texCol.assign(
      applyDegradeLayersTsl(
        texCol,
        vWeather0.x,
        vWeather0.y,
        chipFromCrack,
        vWeather0.z,
        vWeather0.w,
        vWeather1,
        float(0.0),
        float(0.0),
        mudWet
      )
    );

    const wet = float(1.0).sub(smoothstep(-1.72, float(-1.12).add(edgeJitter.mul(0.25)), wp.y));
    texCol.assign(mix(texCol, texCol.mul(isToon ? 0.64 : 0.6), wet.mul(isToon ? 0.52 : 0.58)));
    const submerged = float(1.0).sub(smoothstep(-2.08, -1.52, wp.y));
    texCol.assign(mix(texCol, vec3(0.11, 0.28, 0.58), submerged.mul(0.78)));

    const vColorAttr = attribute('color', 'vec3');
    const otherLandMask = smoothstep(0.25, 0.75, vColorAttr.r)
      .mul(uGrayOtherLand)
      .mul(float(1.0).sub(uWorldMapMode));
    const grayLandTone = vec3(0.41, 0.44, 0.49)
      .mul(float(0.88).add(clamp(wp.y.mul(0.025), 0.0, 0.14)))
      .mul(float(0.92).add(clamp(wn.y, 0.0, 1.0).mul(0.08)));
    texCol.assign(mix(texCol, grayLandTone, otherLandMask));

    const worldMapShaded = vColorAttr.mul(float(0.93).add(clamp(wn.y, 0.0, 1.0).mul(0.08)));
    texCol.assign(mix(texCol, worldMapShaded, uWorldMapMode));

    // Gentle drifting world-space cloud shadows across open sunlit terrain
    texCol.mulAssign(createDriftingCloudShadowNode(wpXZ));

    return vec4(texCol.mul(isToon ? 1.09 : 1.12), 1.0);
  })();

  const mat = new MeshPhysicalNodeMaterial({
    vertexColors: true,
    roughness: customGrass
      ? THREE.MathUtils.clamp(customGrass.settings.roughness ?? 0.84, 0.08, 1.0)
      : isToon || style === 'softFantasy'
      ? 0.9
      : 0.84,
    metalness: 0.02,
    diffuseRoughness: THREE.MathUtils.clamp(
      customGrass?.settings.diffuseRoughness ?? (isToon ? 0.93 : 0.9),
      0,
      1
    ),
    flatShading: false,
  });
  mat.colorNode = terrainColorNode;
  mat.roughnessNode = Fn(() => {
    const vWeather0 = attribute('aWeather0', 'vec4');
    const vWeather1 = attribute('aWeather1', 'float');
    return applyDegradeRoughnessTsl(
      materialRoughness,
      vWeather0.x,
      vWeather0.y,
      vWeather0.y.mul(0.55),
      vWeather0.z,
      vWeather0.w,
      vWeather1,
      float(0.0),
      float(0.0),
      vWeather0.w.mul(0.32)
    );
  })();
  mat.diffuseRoughnessNode = materialDiffuseRoughness;
  attachBotwPainterlyShader(mat, { rimStrengthScale: 0.42, shadowLiftScale: 0.85 });
  return {
    material: mat,
    updateMountainUniforms: (cfg?: MountainProfileConfig) => {
      const m = cfg ?? createDefaultMountainConfig();
      uMtnRockH.value = m.rockStartHeight;
      uMtnSnowH.value = m.snowStartHeight;
      uMtnBandSoftness.value = Math.max(0.18, m.bandTransition * 3.8);
      uMtnNoiseScale.value = m.noiseScale;
      uMtnNoiseMode.value = resolveMountainNoiseIndex(m.noiseType);
      uMtnRoughness.value = m.roughness;
      uMtnRandomness.value = m.randomness;
    },
    updateDirtUniforms: (cfg?: DirtAndRoadConfig) => {
      const dc = cfg ?? createDefaultDirtAndRoadConfig();
      uDirtHeroCol.value.set(dc.heroColor);
      uDirtSecCol.value.set(dc.secondaryColor);
      uDirtUseCustom.value = cfg ? 1 : 0;
      uDirtNoiseKind.value = resolveDirtNoiseIndex(dc.noiseKind);
      uDirtNoiseContrast.value = dc.noiseContrast;
      uDirtBumpStrength.value = dc.bumpStrength;
      uDirtDegrade.value = dc.degradeAmount;
    },
    updateWorldMapUniforms: (ctx?: WorldMapRenderContext) => {
      uWorldMapMode.value = ctx?.mode === 'worldMap' ? 1 : 0;
      uGrayOtherLand.value =
        ctx?.mode === 'land' && ctx.worldMap && (ctx.activeRegionCode ?? 0) > 0 ? 1 : 0;
    },
  };
}

function addWallTorch(
  parent: THREE.Group,
  x: number,
  y: number,
  z: number,
  nx: number,
  nz: number,
  flameMeshes: IslandSceneHandles['flameMeshes'],
  torchLights: TorchLightHandle[],
  addRealLight: boolean,
  phase: number
) {
  const torchGroup = new THREE.Group();
  torchGroup.position.set(x, y, z);
  const yaw = Math.atan2(nx, nz);
  torchGroup.rotation.y = yaw;

  const ironMat = new THREE.MeshStandardMaterial({ color: '#272930', roughness: 0.45, metalness: 0.78 });
  const woodMat = new THREE.MeshStandardMaterial({ color: '#5A3A22', roughness: 0.85 });
  const flameMat = new THREE.MeshStandardMaterial({
    color: '#FFB74D',
    emissive: '#FF7300',
    emissiveIntensity: 2.2,
    roughness: 0.15,
  });

  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.56, 0.12), ironMat);
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.56), ironMat);
  bracket.position.set(0, -0.05, 0.28);

  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.72, 7), woodMat);
  stick.position.set(0, 0.18, 0.54);
  stick.rotation.x = 0.28;

  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.48, 8), flameMat);
  flame.position.set(0, 0.62, 0.64);

  const glowCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 8, 8),
    new THREE.MeshBasicMaterial({ color: '#FFF0B8', transparent: true, opacity: 0.85 })
  );
  glowCore.position.set(0, 0.55, 0.64);

  torchGroup.add(plate, bracket, stick, flame, glowCore);
  parent.add(torchGroup);

  flameMeshes.push({ mesh: flame, baseY: 0.62, phase });

  if (addRealLight) {
    const pt = new THREE.PointLight('#FF9238', 11.5, 28, 1.35);
    pt.position.set(x + nx * 0.95, y + 0.7, z + nz * 0.95);
    parent.add(pt);
    torchLights.push({ light: pt, baseIntensity: 11.5, phase });
  }
}

function buildDungeonScene(level: GameLevel, customAssets: CustomAssetMeta[]): IslandSceneHandles {
  const group = new THREE.Group();
  const atlas = getTerrainTextureAtlas();
  const timeUniform = uniform(0);
  const torchLights: TorchLightHandle[] = [];
  const flameMeshes: IslandSceneHandles['flameMeshes'] = [];

  const dStyle = resolveDungeonStyle(level.dungeonStyle ?? level.roguelikeConfig?.dungeonStyle);
  const wallMeta = DUNGEON_WALL_STYLE_META[dStyle.wallStyle];
  const floorMeta = DUNGEON_FLOOR_STYLE_META[dStyle.floorStyle];

  // Styled dungeon floor texture & material
  const floorSourceTex =
    floorMeta.textureKind === 'castleFloor'
      ? atlas.castleFloor
      : floorMeta.textureKind === 'cobble'
      ? atlas.cobble
      : floorMeta.textureKind === 'rock'
      ? atlas.rock
      : atlas.dungeonFlagstone;
  const floorTex = floorSourceTex.clone();
  floorTex.repeat.set(16, 16);
  floorTex.needsUpdate = true;

  const floorGeo = new THREE.PlaneGeometry(88, 88, 32, 32);
  floorGeo.rotateX(-Math.PI / 2);
  const posAttr = floorGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    const poolDist = Math.hypot(vx - 4, vz - 4);
    if (poolDist < 4.5) {
      posAttr.setY(i, -0.14 * (1 - poolDist / 4.5));
    }
  }
  floorGeo.computeVertexNormals();

  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    bumpMap: floorTex,
    bumpScale: 0.08,
    color: dStyle.floorTint ?? floorMeta.colorHex,
    roughness: floorMeta.roughness,
    metalness: floorMeta.metalness,
    ...(floorMeta.emissiveHex
      ? {
          emissive: floorMeta.emissiveHex,
          emissiveIntensity: floorMeta.emissiveIntensity ?? 0.14,
        }
      : {}),
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.receiveShadow = true;
  floorMesh.userData.isGround = true;
  group.add(floorMesh);

  // Underground puddle / ember basin sheen in central chamber
  const usesCustomWalls = Boolean(level.customWallBoxes && level.customWallBoxes.length > 0);
  if (!usesCustomWalls || dStyle.floorStyle === 'flagstone' || dStyle.floorStyle === 'emberBasalt') {
    const puddleMat = new THREE.MeshStandardMaterial({
      color: floorMeta.puddleHex,
      roughness: floorMeta.emissiveHex ? 0.25 : 0.08,
      metalness: floorMeta.emissiveHex ? 0.1 : 0.35,
      transparent: true,
      opacity: floorMeta.emissiveHex ? 0.85 : 0.78,
      ...(floorMeta.emissiveHex
        ? {
            emissive: floorMeta.emissiveHex,
            emissiveIntensity: 0.48,
          }
        : {}),
    });
    const puddle = new THREE.Mesh(new THREE.CircleGeometry(3.6, 24), puddleMat);
    puddle.rotation.x = -Math.PI / 2;
    puddle.position.set(4, -0.04, 4);
    group.add(puddle);
  }

  // Styled stone masonry walls & cave rock grottos
  const wallSourceTex =
    wallMeta.textureKind === 'castle'
      ? atlas.castleWall
      : wallMeta.textureKind === 'cave'
      ? atlas.craggyCaveRock
      : atlas.dampStoneBrick;
  const brickTex = wallSourceTex.clone();
  brickTex.needsUpdate = true;

  const caveTex = atlas.craggyCaveRock.clone();
  caveTex.repeat.set(2, 2);
  caveTex.needsUpdate = true;

  const caveRockMat = enableDiffuseRoughnessEon(
    new THREE.MeshStandardMaterial({
      map: caveTex,
      bumpMap: caveTex,
      bumpScale: 0.14,
      color: dStyle.wallTint ?? (wallMeta.textureKind === 'cave' ? wallMeta.primaryHex : '#CBD5E1'),
      roughness: Math.max(wallMeta.roughness, 0.72),
      metalness: wallMeta.metalness * 0.5,
      flatShading: true,
    }),
    0.92
  ) as THREE.MeshStandardMaterial;

  const mossMat = enableDiffuseRoughnessEon(
    new THREE.MeshStandardMaterial({
      map: atlas.moss,
      color: wallMeta.mossHex,
      roughness: 0.88,
    }),
    0.88
  ) as THREE.MeshStandardMaterial;

  const trimStoneMat = enableDiffuseRoughnessEon(
    new THREE.MeshStandardMaterial({
      color: wallMeta.trimHex,
      roughness: Math.max(0.28, wallMeta.roughness - 0.12),
      metalness: wallMeta.metalness * 0.9,
    }),
    0.86
  ) as THREE.MeshStandardMaterial;

  const wallBoxes = getLevelWallBoxes(level);

  for (let idx = 0; idx < wallBoxes.length; idx++) {
    const box = wallBoxes[idx];
    const w = box.maxX - box.minX;
    const d = box.maxZ - box.minZ;
    const cx = (box.minX + box.maxX) * 0.5;
    const cz = (box.minZ + box.maxZ) * 0.5;

    if (box.kind === 'caveRock') {
      // Cluster of uneven organic craggy cave boulders + stalagmites + optional moss patches
      const caveGroup = new THREE.Group();
      caveGroup.position.set(cx, 0, cz);
      const count = 6;
      for (let k = 0; k < count; k++) {
        const ang = (k / count) * Math.PI * 2 + idx * 0.6;
        const ox = Math.cos(ang) * (w * 0.24);
        const oz = Math.sin(ang) * (d * 0.24);
        const rockGeo = new THREE.DodecahedronGeometry(Math.min(w, d) * (0.42 + (k % 3) * 0.08), 1);
        const rPos = rockGeo.attributes.position as THREE.BufferAttribute;
        for (let vi = 0; vi < rPos.count; vi++) {
          const rx = rPos.getX(vi);
          const ry = rPos.getY(vi);
          const rz = rPos.getZ(vi);
          const crag = 0.82 + 0.34 * Math.sin(rx * 2.7 + k) * Math.cos(rz * 2.3 + vi);
          rPos.setXYZ(vi, rx * crag, ry * (0.9 + 0.35 * ((vi + k) % 2)), rz * crag);
        }
        rockGeo.computeVertexNormals();
        const boulder = new THREE.Mesh(rockGeo, caveRockMat);
        boulder.position.set(ox, box.height * (0.34 + (k % 2) * 0.14), oz);
        boulder.scale.set(1.1, box.height / Math.max(1.5, Math.min(w, d) * 0.85), 1.1);
        boulder.castShadow = true;
        boulder.receiveShadow = true;
        caveGroup.add(boulder);

        if (wallMeta.showMoss && k % 2 === 0) {
          const mossClump = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95, 1), mossMat);
          mossClump.scale.set(1.3, 0.38, 1.1);
          mossClump.position.set(ox * 1.15, 0.24 + (k % 3) * 0.55, oz * 1.15);
          caveGroup.add(mossClump);
        }
      }
      group.add(caveGroup);
    } else {
      // Styled masonry wall / pillar
      const wTex = brickTex.clone();
      wTex.repeat.set(Math.max(1, Math.round(Math.max(w, d) / 4.2)), Math.max(1, Math.round(box.height / 3.2)));
      wTex.needsUpdate = true;

      const wMat = enableDiffuseRoughnessEon(
        new THREE.MeshStandardMaterial({
          map: wTex,
          bumpMap: wTex,
          bumpScale: 0.09,
          color: dStyle.wallTint ?? wallMeta.primaryHex,
          roughness: wallMeta.roughness,
          metalness: wallMeta.metalness,
        }),
        0.86
      ) as THREE.MeshStandardMaterial;

      const wallSegX = Math.min(8, Math.max(2, Math.round(w / 3)));
      const wallSegY = Math.min(6, Math.max(2, Math.round(box.height / 2)));
      const wallSegZ = Math.min(8, Math.max(2, Math.round(d / 3)));
      const wallMesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, box.height, d, wallSegX, wallSegY, wallSegZ),
        wMat
      );
      wallMesh.position.set(cx, box.height * 0.5, cz);
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      group.add(wallMesh);

      // Stone / metal coping cap & plinth base
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.25, 0.36, d + 0.25, Math.min(6, wallSegX), 1, Math.min(6, wallSegZ)),
        trimStoneMat
      );
      cap.position.set(cx, box.height + 0.12, cz);
      group.add(cap);

      const plinth = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.28, 0.45, d + 0.28, Math.min(6, wallSegX), 1, Math.min(6, wallSegZ)),
        trimStoneMat
      );
      plinth.position.set(cx, 0.22, cz);
      plinth.receiveShadow = true;
      group.add(plinth);

      // Damp moss tufts along wall base when enabled by wall style
      if (wallMeta.showMoss && (w > 4 || d > 4)) {
        for (let m = 0; m < 3; m++) {
          const mx = cx + (w > d ? ((m - 1) * w) * 0.28 : 0);
          const mz = cz + (d >= w ? ((m - 1) * d) * 0.28 : 0);
          const moss = new THREE.Mesh(new THREE.DodecahedronGeometry(0.65, 1), mossMat);
          moss.scale.set(1.4, 0.35, 1.3);
          moss.position.set(mx, 0.15, mz);
          group.add(moss);
        }
      }
    }
  }

  if (!usesCustomWalls) {
    // Vaulted stone archway lintels over the wide room doorways
    const archPositions: { x: number; z: number }[] = [
      { x: -8, z: -10 },
      { x: -8, z: 21 },
      { x: 17, z: -15 },
      { x: 17, z: 17 },
    ];
    for (const ap of archPositions) {
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.1, 1.2, 13.5), trimStoneMat);
      lintel.position.set(ap.x, 7.6, ap.z);
      lintel.castShadow = true;
      group.add(lintel);
    }

    // Overhead stone ceiling ribs high above camera frustum (frames upper screen in Front view)
    for (const rz of [-34, -18, -2]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(82, 1.1, 1.8), trimStoneMat);
      beam.position.set(0, 9.6, rz);
      group.add(beam);
    }

    // Organic craggy cave rock walls lining the northern & western rock grottos
    const caveOutcrops: [number, number, number][] = [
      [-35, -36, 2.2], [-27, -37, 1.9], [-37, -26, 2.0],
      [-18, -36, 1.8], [34, -36, 2.1], [37, -26, 1.7],
      [35, 34, 2.0], [28, 37, 1.6], [4, -24.5, 1.85],
    ];
    for (let i = 0; i < caveOutcrops.length; i++) {
      const [rx, rz, rs] = caveOutcrops[i];
      const stalagmite = new THREE.Mesh(new THREE.ConeGeometry(rs * 0.55, rs * 2.1, 7), caveRockMat);
      stalagmite.position.set(rx, rs * 0.9, rz);
      stalagmite.rotation.y = i * 0.8;
      stalagmite.castShadow = true;
      group.add(stalagmite);
    }
  }

  // Wall torches casting warm flickering orange light pools across dungeon chambers
  const defaultTorchPlacements: { x: number; y: number; z: number; nx: number; nz: number; light: boolean }[] = [
    { x: -24, y: 3.4, z: -39.4, nx: 0, nz: 1, light: true },
    { x: 4, y: 3.4, z: -39.4, nx: 0, nz: 1, light: true },
    { x: 28, y: 3.4, z: -39.4, nx: 0, nz: 1, light: true },
    { x: -6.5, y: 3.2, z: 5, nx: 1, nz: 0, light: true },
    { x: -9.5, y: 3.2, z: 5, nx: -1, nz: 0, light: false },
    { x: 15.5, y: 3.2, z: 1, nx: -1, nz: 0, light: false },
    { x: 18.5, y: 3.2, z: 1, nx: 1, nz: 0, light: true },
    { x: -39.4, y: 3.2, z: 18, nx: 1, nz: 0, light: false },
    { x: -39.4, y: 3.2, z: -8, nx: 1, nz: 0, light: false },
    { x: 39.4, y: 3.2, z: -12, nx: -1, nz: 0, light: false },
    { x: 39.4, y: 3.2, z: 16, nx: -1, nz: 0, light: false },
    { x: 4, y: 3.1, z: -2.4, nx: 0, nz: 1, light: false },
    { x: 4, y: 3.1, z: 15.6, nx: 0, nz: 1, light: false },
  ];
  const torchPlacements =
    level.roguelikeTorchAnchors && level.roguelikeTorchAnchors.length > 0
      ? level.roguelikeTorchAnchors
      : defaultTorchPlacements;
  torchPlacements.forEach((tp, idx) => {
    addWallTorch(group, tp.x, tp.y, tp.z, tp.nx, tp.nz, flameMeshes, torchLights, tp.light, idx * 1.7);
  });

  // Custom GLB scatter props placed if any
  const customScatterGroups = buildCustomScatterOnly(level, customAssets);
  group.add(customScatterGroups);

  const windUniform = uniform(computeWeatherWindFactor(level.weather, level.wind));
  return { group, timeUniform, windUniform, customScatterGroups, torchLights, flameMeshes, choppableTrees: [], harvestableScatter: [] };
}

function buildCastleScene(level: GameLevel, customAssets: CustomAssetMeta[]): IslandSceneHandles {
  const group = new THREE.Group();
  const atlas = getTerrainTextureAtlas();
  const timeUniform = uniform(0);
  const torchLights: TorchLightHandle[] = [];
  const flameMeshes: IslandSceneHandles['flameMeshes'] = [];

  const floorTex = atlas.castleFloor.clone();
  floorTex.repeat.set(16, 16);
  floorTex.needsUpdate = true;

  const floorGeo = new THREE.PlaneGeometry(92, 92, 16, 16);
  floorGeo.rotateX(-Math.PI / 2);
  const floorMat = enableDiffuseRoughnessEon(
    new THREE.MeshStandardMaterial({
      map: floorTex,
      bumpMap: floorTex,
      bumpScale: 0.05,
      roughness: 0.72,
    }),
    0.82
  );
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.receiveShadow = true;
  floorMesh.userData.isGround = true;
  group.add(floorMesh);

  // Raised Royal Stone Dais on North side + Red Carpet Runner
  const trimMat = enableDiffuseRoughnessEon(
    new THREE.MeshStandardMaterial({ color: '#9D9589', roughness: 0.7 }),
    0.84
  );
  const dais = new THREE.Mesh(new THREE.BoxGeometry(32, 0.72, 18), trimMat);
  dais.position.set(0, 0.36, -34);
  dais.receiveShadow = true;
  group.add(dais);

  const steps = new THREE.Mesh(new THREE.BoxGeometry(14, 0.36, 2.4), trimMat);
  steps.position.set(0, 0.18, -24.2);
  steps.receiveShadow = true;
  group.add(steps);

  const carpetMat = new THREE.MeshStandardMaterial({ color: '#A31F34', roughness: 0.85 });
  const carpetTrimMat = new THREE.MeshStandardMaterial({ color: '#EAB308', roughness: 0.4, metalness: 0.5 });
  const carpet = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.05, 58), carpetMat);
  carpet.position.set(0, 0.03, 6);
  carpet.receiveShadow = true;
  const daisCarpet = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.05, 16), carpetMat);
  daisCarpet.position.set(0, 0.74, -33);
  group.add(carpet, daisCarpet);

  // Castle stone walls & battlements
  const wallTex = atlas.castleWall.clone();
  wallTex.needsUpdate = true;
  const boxes = getLevelWallBoxes(level);

  for (const box of boxes) {
    const w = box.maxX - box.minX;
    const d = box.maxZ - box.minZ;
    const cx = (box.minX + box.maxX) * 0.5;
    const cz = (box.minZ + box.maxZ) * 0.5;

    const tex = wallTex.clone();
    tex.repeat.set(Math.max(1, Math.round(Math.max(w, d) / 5)), Math.max(1, Math.round(box.height / 4)));
    tex.needsUpdate = true;
    const wallMat = enableDiffuseRoughnessEon(
      new THREE.MeshStandardMaterial({
        map: tex,
        bumpMap: tex,
        bumpScale: 0.06,
        roughness: 0.78,
      }),
      0.86
    );

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(
        w,
        box.height,
        d,
        Math.min(8, Math.max(2, Math.round(w / 3))),
        Math.min(6, Math.max(2, Math.round(box.height / 2))),
        Math.min(8, Math.max(2, Math.round(d / 3)))
      ),
      wallMat
    );
    mesh.position.set(cx, box.height * 0.5, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    if (box.kind === 'pillar') {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.45, 0.45, d + 0.45), trimMat);
      cap.position.set(cx, box.height + 0.15, cz);
      group.add(cap);
      // Royal crimson banner hung on pillar
      const banner = new THREE.Mesh(new THREE.BoxGeometry(1.1, 3.4, 0.08), carpetMat);
      banner.position.set(cx, 5.1, cz + d * 0.5 + 0.08);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 8), carpetTrimMat);
      rod.rotation.z = Math.PI / 2;
      rod.position.set(cx, 6.8, cz + d * 0.5 + 0.1);
      group.add(banner, rod);
    } else if (box.height > 4) {
      // Crenellations along upper castle walls
      const count = Math.floor(Math.max(w, d) / 4);
      for (let i = 0; i < count; i++) {
        const frac = (i + 0.5) / count - 0.5;
        const merlon = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.25, 1.8), trimMat);
        merlon.position.set(
          w > d ? cx + frac * (w - 3) : cx,
          box.height + 0.62,
          d > w ? cz + frac * (d - 3) : cz
        );
        merlon.castShadow = true;
        group.add(merlon);
      }
    }
  }

  // Grand Castle Gatehouse Arch on North wall + Wall Banners
  const gateFrame = new THREE.Mesh(new THREE.BoxGeometry(9.5, 6.8, 2.2), trimMat);
  gateFrame.position.set(0, 3.4, -42.5);
  group.add(gateFrame);
  const gateInner = new THREE.Mesh(
    new THREE.BoxGeometry(6.2, 5.4, 2.4),
    new THREE.MeshStandardMaterial({ color: '#1E1A24', roughness: 0.9 })
  );
  gateInner.position.set(0, 2.7, -42.4);
  group.add(gateInner);

  for (const bx of [-22, -11, 11, 22]) {
    const wallBanner = new THREE.Mesh(new THREE.BoxGeometry(2.2, 5.2, 0.12), carpetMat);
    wallBanner.position.set(bx, 5.3, -43.3);
    group.add(wallBanner);
  }

  // Warm courtyard sconces
  [
    { x: -12, y: 3.8, z: -43.2, nx: 0, nz: 1, light: true },
    { x: 12, y: 3.8, z: -43.2, nx: 0, nz: 1, light: true },
    { x: -16.7, y: 3.5, z: -19.4, nx: 0, nz: 1, light: false },
    { x: 16.7, y: 3.5, z: -19.4, nx: 0, nz: 1, light: false },
    { x: -16.7, y: 3.5, z: 6.6, nx: 0, nz: 1, light: true },
    { x: 16.7, y: 3.5, z: 6.6, nx: 0, nz: 1, light: true },
  ].forEach((tp, idx) => {
    addWallTorch(group, tp.x, tp.y, tp.z, tp.nx, tp.nz, flameMeshes, torchLights, tp.light, idx * 1.4);
  });

  const customScatterGroups = buildCustomScatterOnly(level, customAssets);
  group.add(customScatterGroups);

  // Unreachable background mountains & woods visible over the castle walls
  const vistaPreset: VistaPresetId = level.vistaPreset ?? 'alpineValley';
  const hasVistaItems = (level.vistaItems?.length ?? 0) > 0;
  if (vistaPreset !== 'none' || hasVistaItems) {
    const castleVistaExt = 112 + Math.max(0, level.vistaDistance ?? 0) * 1.38 + 310;
    const castleSeaSize = Math.max(1150, castleVistaExt * 2.4);
    const castleSea = new THREE.Mesh(
      new THREE.PlaneGeometry(castleSeaSize, castleSeaSize),
      new THREE.MeshStandardMaterial({
        color: getBiome(level.biome).water,
        roughness: 0.22,
        metalness: 0.12,
      })
    );
    castleSea.rotation.x = -Math.PI / 2;
    castleSea.position.y = IslandTerrain.waterLevel;
    group.add(castleSea);
    group.add(
      buildDistantVista(level, customAssets, level.visualStyle ?? 'painterlyPBR', 112)
    );
  }

  const windUniform = uniform(computeWeatherWindFactor(level.weather, level.wind));
  return { group, timeUniform, windUniform, customScatterGroups, torchLights, flameMeshes, choppableTrees: [], harvestableScatter: [] };
}

function buildSideScrollerScene(level: GameLevel, customAssets: CustomAssetMeta[]): IslandSceneHandles {
  const group = new THREE.Group();
  const atlas = getTerrainTextureAtlas();
  const biome = getBiome(level.biome);
  const timeUniform = uniform(0);
  const cfg = getSideScrollerConfig(level);
  const layers = cfg.layers;
  const segments = getSideScrollerSegments(level);

  const grassMat = enableDiffuseRoughnessEon(
    new THREE.MeshStandardMaterial({
      map: atlas.grass,
      color: layers.heroLaneColor || biome.ground,
      roughness: 0.78,
    }),
    0.86
  ) as THREE.MeshStandardMaterial;
  applySurfaceTextureToMaterial(grassMat, level.sceneryTextures?.grass, {
    baseTintHex: layers.heroLaneColor || biome.ground,
  });

  const cliffMat = enableDiffuseRoughnessEon(
    new THREE.MeshStandardMaterial({
      map: atlas.rock,
      color: layers.heroTrimColor || '#7A7269',
      roughness: 0.9,
    }),
    0.92
  ) as THREE.MeshStandardMaterial;
  applySurfaceTextureToMaterial(cliffMat, level.sceneryTextures?.rocks, {
    baseTintHex: layers.heroTrimColor || '#7A7269',
  });

  const woodMat = enableDiffuseRoughnessEon(
    new THREE.MeshStandardMaterial({
      color: '#9C6638',
      roughness: 0.76,
    }),
    0.88
  ) as THREE.MeshStandardMaterial;
  applySurfaceTextureToMaterial(woodMat, level.sceneryTextures?.woodStructures, {
    baseTintHex: '#9C6638',
  });

  const branchMat = new THREE.MeshStandardMaterial({
    color: layers.heroLaneColor || '#5C4033',
    roughness: 0.84,
  });
  const branchBarkMat = new THREE.MeshStandardMaterial({
    color: layers.heroTrimColor || '#3F2A1D',
    roughness: 0.9,
  });
  const girderMat = new THREE.MeshStandardMaterial({
    color: layers.heroLaneColor || '#DC2626',
    roughness: 0.42,
    metalness: 0.65,
  });
  const coralMat = new THREE.MeshStandardMaterial({
    color: layers.heroLaneColor || '#F472B6',
    roughness: 0.65,
  });
  const crystalMat = new THREE.MeshStandardMaterial({
    color: layers.heroLaneColor || '#38BDF8',
    emissive: layers.heroTrimColor || '#0EA5E9',
    emissiveIntensity: 0.32,
    roughness: 0.25,
    metalness: 0.2,
  });
  const cloudDeckMat = new THREE.MeshStandardMaterial({
    color: layers.heroLaneColor || '#F8FAFC',
    roughness: 0.92,
    flatShading: true,
  });

  // Track min/max X extent for liquid & parallax span
  let minSpanX = -56;
  let maxSpanX = 56;

  // Walkable 3D Platform Lane (foreground/hero Z in [-3.4, +3.4])
  for (const seg of segments) {
    minSpanX = Math.min(minSpanX, seg.minX - 10);
    maxSpanX = Math.max(maxSpanX, seg.maxX + 10);
    const width = Math.max(1.2, seg.maxX - seg.minX);
    const cx = (seg.minX + seg.maxX) * 0.5;
    const laneZ = seg.z ?? 0;
    const depth = seg.depth ?? (seg.oneWay || seg.style === 'branch' || seg.style === 'girder' ? 4.4 : 6.4);
    const overrideMat = seg.color
      ? new THREE.MeshStandardMaterial({
          color: seg.color,
          roughness: seg.style === 'girder' ? 0.42 : seg.style === 'crystal' ? 0.25 : 0.78,
          metalness: seg.style === 'girder' ? 0.65 : 0.08,
          emissive: seg.style === 'crystal' ? seg.color : '#000000',
          emissiveIntensity: seg.style === 'crystal' ? 0.28 : 0,
        })
      : null;

    if (seg.style === 'cliff' || seg.style === 'jungleFloor') {
      const top = new THREE.Mesh(
        applyWorldScaledBoxUVs(new THREE.BoxGeometry(width, 0.65, depth), width, 0.65, depth, 0.25),
        overrideMat ?? grassMat
      );
      top.position.set(cx, seg.y - 0.32, laneZ);
      top.receiveShadow = true;
      top.userData.isGround = true;

      const body = new THREE.Mesh(
        applyWorldScaledBoxUVs(
          new THREE.BoxGeometry(Math.max(0.8, width - 0.35), 14.0, Math.max(2.2, depth - 0.6)),
          Math.max(0.8, width - 0.35),
          14.0,
          Math.max(2.2, depth - 0.6),
          0.25
        ),
        seg.style === 'jungleFloor' ? branchBarkMat : cliffMat
      );
      body.position.set(cx, seg.y - 7.6, laneZ);
      body.castShadow = true;
      body.receiveShadow = true;
      group.add(top, body);

      if (seg.style === 'jungleFloor') {
        const mossTrim = new THREE.Mesh(
          new THREE.BoxGeometry(width + 0.14, 0.22, depth + 0.16),
          grassMat
        );
        mossTrim.position.set(cx, seg.y - 0.12, laneZ);
        group.add(mossTrim);
      }
    } else if (seg.style === 'bridge') {
      const plank = new THREE.Mesh(
        applyWorldScaledBoxUVs(new THREE.BoxGeometry(width, 0.45, depth * 0.85), width, 0.45, depth * 0.85, 0.35),
        overrideMat ?? woodMat
      );
      plank.position.set(cx, seg.y - 0.22, laneZ);
      plank.receiveShadow = true;
      plank.castShadow = true;
      plank.userData.isGround = true;
      group.add(plank);

      for (let px = seg.minX + 1.2; px < seg.maxX - 0.8; px += 3.2) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.3, 8), woodMat);
        post.position.set(px, seg.y + 0.6, laneZ - depth * 0.42);
        group.add(post);
      }
    } else if (seg.style === 'branch') {
      const bough = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.56, depth),
        overrideMat ?? branchBarkMat
      );
      bough.position.set(cx, seg.y - 0.28, laneZ);
      bough.castShadow = true;
      bough.receiveShadow = true;
      bough.userData.isGround = true;
      const foliageStrip = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.25, 0.24, depth + 0.25),
        overrideMat ?? branchMat
      );
      foliageStrip.position.set(cx, seg.y - 0.12, laneZ);
      foliageStrip.receiveShadow = true;
      foliageStrip.userData.isGround = true;
      group.add(bough, foliageStrip);
    } else if (seg.style === 'girder') {
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.48, depth),
        overrideMat ?? girderMat
      );
      beam.position.set(cx, seg.y - 0.24, laneZ);
      beam.castShadow = true;
      beam.receiveShadow = true;
      beam.userData.isGround = true;
      group.add(beam);
      // Cross-truss accents along the steel girder
      const step = Math.max(2.4, width / Math.max(2, Math.round(width / 2.8)));
      for (let gx = seg.minX + step * 0.5; gx < seg.maxX - 0.4; gx += step) {
        const rivet = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.54, depth + 0.08), cliffMat);
        rivet.position.set(gx, seg.y - 0.24, laneZ);
        group.add(rivet);
      }
    } else if (seg.style === 'coral') {
      const reef = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.8, depth),
        overrideMat ?? coralMat
      );
      reef.position.set(cx, seg.y - 0.4, laneZ);
      reef.castShadow = true;
      reef.receiveShadow = true;
      reef.userData.isGround = true;
      const baseRock = new THREE.Mesh(
        new THREE.BoxGeometry(Math.max(1.0, width - 0.6), 9.0, Math.max(2.2, depth - 0.7)),
        cliffMat
      );
      baseRock.position.set(cx, seg.y - 5.0, laneZ);
      group.add(reef, baseRock);
    } else if (seg.style === 'crystal') {
      const ledge = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.65, depth),
        overrideMat ?? crystalMat
      );
      ledge.position.set(cx, seg.y - 0.32, laneZ);
      ledge.castShadow = true;
      ledge.receiveShadow = true;
      ledge.userData.isGround = true;
      group.add(ledge);
    } else if (seg.style === 'cloud') {
      const puffDeck = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.65, depth),
        overrideMat ?? cloudDeckMat
      );
      puffDeck.position.set(cx, seg.y - 0.32, laneZ);
      puffDeck.receiveShadow = true;
      puffDeck.userData.isGround = true;
      const rimTrim = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.2, 0.22, depth + 0.2),
        new THREE.MeshStandardMaterial({ color: layers.heroTrimColor || '#FBBF24', roughness: 0.4 })
      );
      rimTrim.position.set(cx, seg.y - 0.14, laneZ);
      group.add(puffDeck, rimTrim);
    } else {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(width, 0.9, depth), overrideMat ?? cliffMat);
      slab.position.set(cx, seg.y - 0.45, laneZ);
      slab.receiveShadow = true;
      slab.castShadow = true;
      slab.userData.isGround = true;
      group.add(slab);
    }
  }

  // Climbable Vines, Ladders & Underwater Bubble Streams
  if (cfg.vines && cfg.vines.length > 0) {
    const vineRopeMat = new THREE.MeshStandardMaterial({ color: '#16A34A', roughness: 0.78 });
    const vineLeafMat = new THREE.MeshStandardMaterial({ color: '#4ADE80', roughness: 0.65 });
    const ladderRailMat = new THREE.MeshStandardMaterial({ color: '#D97706', roughness: 0.65 });
    const ladderRungMat = new THREE.MeshStandardMaterial({ color: '#FBBF24', roughness: 0.55 });
    const bubbleMat = new THREE.MeshStandardMaterial({
      color: '#BAE6FD',
      emissive: '#38BDF8',
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.75,
    });

    for (const v of cfg.vines) {
      const h = Math.max(2.0, v.topY - v.bottomY);
      const midY = (v.topY + v.bottomY) * 0.5;
      const vz = v.z ?? 0;
      if (v.kind === 'ladder') {
        const railL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, h, 8), ladderRailMat);
        railL.position.set(v.x - 0.42, midY, vz);
        const railR = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, h, 8), ladderRailMat);
        railR.position.set(v.x + 0.42, midY, vz);
        group.add(railL, railR);
        const rungs = Math.max(3, Math.floor(h / 0.85));
        for (let r = 0; r <= rungs; r++) {
          const ry = v.bottomY + 0.35 + (r / rungs) * Math.max(0.4, h - 0.7);
          const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.88, 8), ladderRungMat);
          rung.rotation.z = Math.PI / 2;
          rung.position.set(v.x, ry, vz);
          group.add(rung);
        }
      } else if (v.kind === 'bubbleStream') {
        const count = Math.max(4, Math.floor(h / 1.15));
        for (let b = 0; b < count; b++) {
          const by = v.bottomY + 0.5 + (b / count) * (h - 0.5);
          const orb = new THREE.Mesh(new THREE.SphereGeometry(0.32 + (b % 2) * 0.1, 12, 10), bubbleMat);
          orb.position.set(v.x + Math.sin(b * 1.4) * 0.2, by, vz);
          orb.userData.floatSpin = true;
          group.add(orb);
        }
      } else {
        const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, h, 10), vineRopeMat);
        rope.position.set(v.x, midY, vz);
        group.add(rope);
        const leaves = Math.max(3, Math.floor(h / 1.1));
        for (let l = 0; l < leaves; l++) {
          const ly = v.bottomY + 0.6 + (l / leaves) * (h - 0.7);
          const leaf = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 0), vineLeafMat);
          leaf.scale.set(1.3, 0.45, 0.8);
          leaf.position.set(v.x + (l % 2 === 0 ? 0.24 : -0.24), ly, vz);
          leaf.rotation.z = l % 2 === 0 ? -0.45 : 0.45;
          group.add(leaf);
        }
      }
    }
  }

  // Secret Rooms (Glowing Entrances & Cozy Hidden Chambers)
  if (cfg.secretRooms && cfg.secretRooms.length > 0) {
    const portalMat = new THREE.MeshStandardMaterial({
      color: '#A855F7',
      emissive: '#9333EA',
      emissiveIntensity: 0.75,
      roughness: 0.25,
    });
    const archMat = new THREE.MeshStandardMaterial({ color: '#FBBF24', roughness: 0.4, metalness: 0.55 });
    const chamberWallMat = new THREE.MeshStandardMaterial({ color: '#1E1B4B', roughness: 0.88 });
    const chamberFloorMat = new THREE.MeshStandardMaterial({ color: '#4338CA', roughness: 0.72 });

    for (const room of cfg.secretRooms) {
      // Entrance Archway on Hero Lane
      const entGroup = new THREE.Group();
      entGroup.position.set(room.entranceX, room.entranceY, 0);
      const pillarL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 2.2, 0.48), archMat);
      pillarL.position.set(-0.78, 1.1, -0.4);
      const pillarR = new THREE.Mesh(new THREE.BoxGeometry(0.32, 2.2, 0.48), archMat);
      pillarR.position.set(0.78, 1.1, -0.4);
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.36, 0.55), archMat);
      lintel.position.set(0, 2.25, -0.4);
      const swirl = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 1.95), portalMat);
      swirl.position.set(0, 1.05, -0.35);
      entGroup.add(pillarL, pillarR, lintel, swirl);
      group.add(entGroup);

      // Enclosed Secret Room Chamber at roomCenterX, roomCenterY
      const rw = Math.max(8, room.width || 12);
      const rh = Math.max(4.5, room.height || 6.2);
      const roomFloor = new THREE.Mesh(new THREE.BoxGeometry(rw, 0.8, 6.2), chamberFloorMat);
      roomFloor.position.set(room.roomCenterX, room.roomCenterY - 0.4, 0);
      roomFloor.receiveShadow = true;
      roomFloor.userData.isGround = true;

      const backWall = new THREE.Mesh(new THREE.BoxGeometry(rw, rh, 0.6), chamberWallMat);
      backWall.position.set(room.roomCenterX, room.roomCenterY + rh * 0.5 - 0.2, -3.1);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(rw, 0.6, 6.2), chamberWallMat);
      roof.position.set(room.roomCenterX, room.roomCenterY + rh - 0.2, 0);
      const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.6, rh, 6.2), chamberWallMat);
      sideL.position.set(room.roomCenterX - rw * 0.5 + 0.3, room.roomCenterY + rh * 0.5 - 0.2, 0);
      const sideR = new THREE.Mesh(new THREE.BoxGeometry(0.6, rh, 6.2), chamberWallMat);
      sideR.position.set(room.roomCenterX + rw * 0.5 - 0.3, room.roomCenterY + rh * 0.5 - 0.2, 0);

      // Return Warp Gate inside the Secret Room
      const exitRing = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.14, 12, 24), archMat);
      exitRing.position.set(room.roomCenterX - rw * 0.34, room.roomCenterY + 1.15, -0.4);
      const exitCore = new THREE.Mesh(new THREE.CircleGeometry(0.76, 18), portalMat);
      exitCore.position.set(room.roomCenterX - rw * 0.34, room.roomCenterY + 1.15, -0.4);
      group.add(roomFloor, backWall, roof, sideL, sideR, exitRing, exitCore);
    }
  }

  // Animated water / lava / mist plane below (or enveloping underwater levels)
  const spanWidth = Math.max(240, maxSpanX - minSpanX + 100);
  const midSpanX = (minSpanX + maxSpanX) * 0.5;
  if (layers.liquidType !== 'none') {
    const isLava = layers.liquidType === 'lava';
    const waterMat = new THREE.MeshStandardMaterial({
      color: layers.liquidColor || (isLava ? '#EF4444' : biome.water),
      emissive: isLava ? '#DC2626' : '#000000',
      emissiveIntensity: isLava ? 0.65 : 0,
      roughness: isLava ? 0.4 : 0.18,
      metalness: isLava ? 0.1 : 0.15,
      transparent: !isLava,
      opacity: isLava ? 0.96 : layers.liquidType === 'mist' ? 0.58 : 0.82,
    });
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(spanWidth, 130), waterMat);
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(midSpanX, layers.liquidLevelY ?? -6.2, -18);
    group.add(sea);
  }

  // --- MULTI-LAYER 3D DEPTH PARALLAX BACKDROP ---
  const backdrop = layers.midgroundStyle;
  // Layer 1 (Z = +6.4, Foreground framing silhouettes)
  const fgRockMat = new THREE.MeshStandardMaterial({ color: layers.foregroundColor || '#39414E', roughness: 0.9 });
  const fgLeafMat = new THREE.MeshStandardMaterial({
    color: backdrop === 'jungleTreesAndVines' ? '#15803D' : backdrop === 'coralReefAndKelp' ? '#EC4899' : biome.detail,
    roughness: 0.78,
  });
  for (let x = Math.round(minSpanX); x <= Math.round(maxSpanX); x += 14) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.5, 0), fgRockMat);
    rock.position.set(x + ((x % 3) * 1.4), -2.2, 6.6);
    rock.scale.set(1.5, 0.9, 0.85);
    const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.95, 1), fgLeafMat);
    bush.position.set(x + 4.5, -1.6, 6.4);
    if (backdrop === 'jungleTreesAndVines') bush.scale.set(1.6, 1.15, 0.8);
    group.add(rock, bush);
  }

  // Layer 2 (Z = -10): Near Mid-ground scenery matched to midgroundStyle
  const midRockMat = new THREE.MeshStandardMaterial({ color: layers.midgroundColor || '#616E7D', roughness: 0.88, flatShading: true });
  const midFoliageMat = new THREE.MeshStandardMaterial({
    color:
      backdrop === 'jungleTreesAndVines'
        ? '#16A34A'
        : backdrop === 'coralReefAndKelp'
        ? '#F472B6'
        : backdrop === 'crystalCaverns'
        ? '#38BDF8'
        : backdrop === 'volcanicSpires'
        ? '#44403C'
        : new THREE.Color(biome.detail).lerp(new THREE.Color('#4A9A42'), 0.55),
    map: backdrop === 'cliffsAndPines' || backdrop === 'jungleTreesAndVines' ? atlas.pineLeaves : null,
    roughness: backdrop === 'crystalCaverns' ? 0.3 : 0.82,
  });
  const sidePineGeo = createDetailedPineTierGeometry(1.55, 3.9, 9, 2);
  const midCount = Math.max(14, Math.ceil((maxSpanX - minSpanX) / 9));
  for (let i = 0; i < midCount; i++) {
    const px = minSpanX + i * 9.5;
    const h = 7 + (i % 4) * 3.5;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.7, h, 7), midRockMat);
    pillar.position.set(px, h * 0.5 - 5.5, -10.5 - (i % 2) * 2.5);
    group.add(pillar);

    if (backdrop === 'jungleTreesAndVines') {
      const palmCrown = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6, 1), midFoliageMat);
      palmCrown.position.set(px, h - 5.2, -10.2);
      palmCrown.scale.set(1.45, 0.75, 1.1);
      group.add(palmCrown);
    } else if (backdrop === 'crystalCaverns') {
      const shard = new THREE.Mesh(new THREE.ConeGeometry(1.4, 5.5 + (i % 3) * 2, 5), crystalMat);
      shard.position.set(px + 2.5, 0.5 + (i % 3), -10.0);
      shard.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.18;
      group.add(shard);
    } else if (backdrop === 'coralReefAndKelp') {
      const fan = new THREE.Mesh(new THREE.DodecahedronGeometry(1.9, 0), midFoliageMat);
      fan.scale.set(1.3, 1.8, 0.6);
      fan.position.set(px + 2.8, 0.2 + (i % 3), -10.0);
      group.add(fan);
    } else if (backdrop === 'volcanicSpires') {
      const brazier = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.2, 1.8, 8), girderMat);
      brazier.position.set(px + 3.0, 0.2, -10.0);
      group.add(brazier);
    } else {
      const tree = new THREE.Mesh(sidePineGeo, midFoliageMat);
      tree.position.set(px + 3.2, 0.5 + (i % 3) * 0.8, -9.8);
      tree.rotation.y = i * 0.75;
      group.add(tree);
    }
  }

  // Layer 3 (Z = -24): Far Mid-ground cliffs/arches & waterfalls/light shafts
  const farMesaMat = new THREE.MeshStandardMaterial({ color: layers.farColor || '#7D8FA3', roughness: 0.9, flatShading: true });
  const waterfallMat = new THREE.MeshStandardMaterial({
    color: backdrop === 'volcanicSpires' ? '#FB923C' : '#9EE8FF',
    emissive: backdrop === 'volcanicSpires' ? '#EA580C' : '#38BDF8',
    emissiveIntensity: 0.35,
    transparent: true,
    opacity: 0.78,
  });
  const farCount = Math.max(10, Math.ceil((maxSpanX - minSpanX) / 16));
  for (let i = 0; i < farCount; i++) {
    const mx = minSpanX - 8 + i * 17.5;
    const mh = 16 + (i % 3) * 6;
    const mesa = new THREE.Mesh(new THREE.BoxGeometry(10.5, mh, 5.5), farMesaMat);
    mesa.position.set(mx, mh * 0.35 - 4.5, -24.5 - (i % 2) * 3.5);
    group.add(mesa);

    if (i % 3 === 1 && backdrop !== 'floatingTemples') {
      const falls = new THREE.Mesh(new THREE.PlaneGeometry(2.4, mh * 0.75), waterfallMat);
      falls.position.set(mx, mh * 0.25 - 2.5, -21.6);
      group.add(falls);
    }
  }

  // Layer 4 (Z = -48): Distant alpine peaks / skyline & clouds
  const mountainMat = new THREE.MeshStandardMaterial({ color: layers.farColor || '#9EB3C8', roughness: 0.95, flatShading: true });
  const cloudMat = new THREE.MeshStandardMaterial({
    color: backdrop === 'volcanicSpires' ? '#57534E' : backdrop === 'crystalCaverns' ? '#312E81' : '#FFFFFF',
    roughness: 0.94,
    flatShading: true,
  });
  for (let i = 0; i < 12; i++) {
    const peak = new THREE.Mesh(new THREE.ConeGeometry(14 + (i % 3) * 4, 28 + (i % 4) * 7, 5), mountainMat);
    peak.position.set(-92 + i * 17, 5, -48 - (i % 2) * 8);
    group.add(peak);

    if (backdrop !== 'coralReefAndKelp') {
      const cloud = createFacetedCloudMesh(cloudMat, i);
      cloud.position.set(-85 + i * 16, 14 + (i % 3) * 3.5, -36 - (i % 2) * 10);
      cloud.scale.setScalar(1.15 + (i % 3) * 0.25);
      group.add(cloud);
    }
  }

  const customScatterGroups = buildCustomScatterOnly(level, customAssets);
  group.add(customScatterGroups);

  const windUniform = uniform(computeWeatherWindFactor(level.weather, level.wind));
  return { group, timeUniform, windUniform, customScatterGroups, torchLights: [], flameMeshes: [], choppableTrees: [], harvestableScatter: [] };
}

function buildScifiScene(level: GameLevel, customAssets: CustomAssetMeta[]): IslandSceneHandles {
  const group = new THREE.Group();
  const atlas = getTerrainTextureAtlas();
  const timeUniform = uniform(0);

  const deckTex = atlas.scifiDeck.clone();
  deckTex.repeat.set(20, 20);
  deckTex.needsUpdate = true;

  const floorGeo = new THREE.PlaneGeometry(116, 116, 36, 36);
  floorGeo.rotateX(-Math.PI / 2);
  const posAttr = floorGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    const d = Math.hypot(vx, vz);
    if (d > 28) {
      const rim = Math.min(1, (d - 28) / 22);
      posAttr.setY(i, rim * rim * 2.4);
    }
  }
  floorGeo.computeVertexNormals();

  const floorMat = new THREE.MeshStandardMaterial({
    map: deckTex,
    roughness: 0.42,
    metalness: 0.45,
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.receiveShadow = true;
  floorMesh.userData.isGround = true;
  group.add(floorMesh);

  // Glowing cyan energy conduits across deck
  const glowMat = new THREE.MeshStandardMaterial({
    color: '#38BDF8',
    emissive: '#38BDF8',
    emissiveIntensity: 1.5,
    roughness: 0.2,
  });
  const hullMat = new THREE.MeshStandardMaterial({ color: '#2B3548', roughness: 0.45, metalness: 0.65 });

  for (const angle of [0, Math.PI / 2]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(56, 0.06, 0.45), glowMat);
    strip.rotation.y = angle;
    strip.position.y = 0.04;
    group.add(strip);
  }

  for (const box of getLevelWallBoxes(level)) {
    const w = box.maxX - box.minX;
    const d = box.maxZ - box.minZ;
    const cx = (box.minX + box.maxX) * 0.5;
    const cz = (box.minZ + box.maxZ) * 0.5;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, box.height, d), hullMat);
    wall.position.set(cx, box.height * 0.5, cz);
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);
  }

  // Sci-Fi Pylons around landing pad
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const px = Math.cos(ang) * 28;
    const pz = Math.sin(ang) * 28;
    const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.75, 5.2, 6), hullMat);
    pylon.position.set(px, 2.6, pz);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 10), glowMat);
    beacon.position.set(px, 5.3, pz);
    group.add(pylon, beacon);
  }

  const customScatterGroups = buildCustomScatterOnly(level, customAssets);
  group.add(customScatterGroups);

  const windUniform = uniform(computeWeatherWindFactor(level.weather, level.wind));
  return { group, timeUniform, windUniform, customScatterGroups, torchLights: [], flameMeshes: [], choppableTrees: [], harvestableScatter: [] };
}

function buildCustomScatterOnly(level: GameLevel, customAssets: CustomAssetMeta[]): THREE.Group {
  const customScatterGroups = new THREE.Group();
  const style: VisualStyleId = level.visualStyle ?? 'painterlyPBR';
  for (const item of level.terrain?.scatter ?? []) {
    if (item.kind !== 'custom' || !item.customAssetId) continue;
    const meta = customAssets.find((a) => a.id === item.customAssetId);
    const inst = instantiateCustomModel(item.customAssetId, meta, {
      scaleAdjust: item.size,
      visualStyle: style,
    });
    if (inst) {
      const y = sampleLevelHeight(level, item.x, item.z);
      inst.group.position.set(item.x, y, item.z);
      inst.group.rotation.y = item.rotation;
      customScatterGroups.add(inst.group);
    }
  }
  return customScatterGroups;
}

async function hydrateCustomScatterListAsync(
  items: ScatterItem[],
  customAssets: CustomAssetMeta[],
  customScatterGroups: THREE.Group,
  style: VisualStyleId,
  getGroundY: (item: ScatterItem) => number,
  signal?: AbortSignal
): Promise<void> {
  if (signal?.aborted || items.length === 0) return;

  const validItems = items.filter((it) => Boolean(it.customAssetId));
  if (validItems.length === 0) return;

  const readyItems: ScatterItem[] = [];
  const waitingItems: ScatterItem[] = [];
  const missingIds = new Map<string, CustomAssetMeta['category']>();

  for (const item of validItems) {
    const assetId = item.customAssetId!;
    if (getCachedAssetSync(assetId)) {
      readyItems.push(item);
    } else {
      waitingItems.push(item);
      if (!missingIds.has(assetId)) {
        const meta = customAssets.find((a) => a.id === assetId);
        missingIds.set(assetId, meta?.category ?? 'scenery');
      }
    }
  }

  const instantiateSlice = (slice: ScatterItem[]) => {
    for (const item of slice) {
      if (signal?.aborted) return;
      const assetId = item.customAssetId!;
      const meta = customAssets.find((a) => a.id === assetId);
      const inst = instantiateCustomModel(assetId, meta, {
        scaleAdjust: item.size,
        visualStyle: style,
      });
      if (inst) {
        inst.group.position.set(item.x, getGroundY(item), item.z);
        inst.group.rotation.y = item.rotation;
        applyBotwStyleToObject(inst.group, style, { rimStrengthScale: 0.82, shadowLiftScale: 0.85 });
        customScatterGroups.add(inst.group);
      }
    }
  };

  if (readyItems.length > 0) {
    const ok = await runDeferredChunks({
      items: readyItems,
      chunkSize: 4,
      frameBudgetMs: 6,
      maxItemsPerFrame: 8,
      signal,
      onChunk: instantiateSlice,
    });
    if (!ok || signal?.aborted) return;
  }

  if (waitingItems.length > 0) {
    await Promise.allSettled(
      Array.from(missingIds.entries()).map(([id, cat]) => loadCustomAssetToCache(id, cat))
    );
    if (signal?.aborted) return;
    await runDeferredChunks({
      items: waitingItems,
      chunkSize: 4,
      frameBudgetMs: 6,
      maxItemsPerFrame: 8,
      signal,
      onChunk: instantiateSlice,
    });
  }
}

function collectCanopyConfigAssetIds(
  cfg?: NonNullable<GameLevel['canopyEngine']>
): string[] {
  if (!cfg) return [];
  const out: string[] = [];
  if (cfg.canopyAssetId) out.push(cfg.canopyAssetId);
  if (cfg.trunkAssetId) out.push(cfg.trunkAssetId);
  if (cfg.fruitAssetId) out.push(cfg.fruitAssetId);
  return out;
}

interface TerrainSnapshotEntry {
  heightsRef: TerrainData['heights'];
  layersRef: TerrainData['layers'];
  weatheringRef: TerrainData['weathering'];
  revision: number;
  size: number;
  renderSize: number;
  waterDepthTexSize: number;
  freeformWorld: boolean;
  worldMapMode: 'worldMap' | 'land';
  worldMapActiveCode: number;
  worldMapRevision: number;
  worldRadius: number;
  regionOriginKey: string;
  regionPaletteSig: string;
  positions: Float32Array;
  colors: Float32Array;
  w0: Float32Array;
  w1: Float32Array;
  weather0: Float32Array;
  weather1: Float32Array;
  normals: Float32Array;
  indices: Uint16Array | Uint32Array;
  waterDepthTexData: Float32Array;
}

const cachedTerrainSnapshots: TerrainSnapshotEntry[] = [];

function populateWaterDepthFromPositions(
  positions: Float32Array,
  renderSize: number,
  waterDepthTexData: Float32Array,
  waterDepthTexSize: number,
  brushArea?: { x: number; z: number; radius: number },
  worldRadius?: number
): void {
  const renderWidth = renderSize + 1;
  const maxTexIdx = waterDepthTexSize - 1;
  let rStart = 0;
  let rEnd = maxTexIdx;
  let cStart = 0;
  let cEnd = maxTexIdx;

  if (brushArea && worldRadius && worldRadius > 0) {
    const pad = brushArea.radius + 10.0;
    const worldDiameter = worldRadius * 2;
    cStart = Math.max(0, Math.floor(((brushArea.x - pad + worldRadius) / worldDiameter) * maxTexIdx));
    cEnd = Math.min(maxTexIdx, Math.ceil(((brushArea.x + pad + worldRadius) / worldDiameter) * maxTexIdx));
    rStart = Math.max(0, Math.floor(((brushArea.z - pad + worldRadius) / worldDiameter) * maxTexIdx));
    rEnd = Math.min(maxTexIdx, Math.ceil(((brushArea.z + pad + worldRadius) / worldDiameter) * maxTexIdx));
  }

  for (let row = rStart; row <= rEnd; row++) {
    const fz = (row / maxTexIdx) * renderSize;
    const r0 = Math.min(renderSize, Math.floor(fz));
    const r1 = Math.min(renderSize, r0 + 1);
    const tz = fz - r0;
    const row0Off = r0 * renderWidth;
    const row1Off = r1 * renderWidth;
    const outRowOff = row * waterDepthTexSize;
    for (let col = cStart; col <= cEnd; col++) {
      const fx = (col / maxTexIdx) * renderSize;
      const c0 = Math.min(renderSize, Math.floor(fx));
      const c1 = Math.min(renderSize, c0 + 1);
      const tx = fx - c0;
      const h00 = positions[(row0Off + c0) * 3 + 1];
      const h10 = positions[(row0Off + c1) * 3 + 1];
      const h01 = positions[(row1Off + c0) * 3 + 1];
      const h11 = positions[(row1Off + c1) * 3 + 1];
      const h = (h00 + (h10 - h00) * tx) * (1 - tz) + (h01 + (h11 - h01) * tx) * tz;
      const idx = (outRowOff + col) * 4;
      waterDepthTexData[idx] = h;
      waterDepthTexData[idx + 1] = h;
      waterDepthTexData[idx + 2] = h;
      waterDepthTexData[idx + 3] = 1.0;
    }
  }
}

export function buildIslandMesh(
  level: GameLevel,
  customAssets: CustomAssetMeta[] = [],
  isSoftwareGl = false,
  options?: BuildIslandMeshOptions
): IslandSceneHandles {
  const env = getEnvironmentType(level);
  const style: VisualStyleId = level.visualStyle ?? 'painterlyPBR';
  const deferFoliage = Boolean(options?.deferFoliage);
  const deferSignal = options?.deferFoliageSignal;

  if (env === 'dungeon' || env === 'castle' || env === 'sideScroller' || env === 'scifi') {
    const res =
      env === 'dungeon'
        ? buildDungeonScene(level, customAssets)
        : env === 'castle'
        ? buildCastleScene(level, customAssets)
        : env === 'sideScroller'
        ? buildSideScrollerScene(level, customAssets)
        : buildScifiScene(level, customAssets);
    applyBotwStyleToObject(res.group, style, { rimStrengthScale: 0.78, shadowLiftScale: 0.8 });
    if (deferFoliage) {
      const uncachedCustom = (level.terrain?.scatter ?? []).filter(
        (sc) => sc.kind === 'custom' && sc.customAssetId && !getCachedAssetSync(sc.customAssetId)
      );
      if (uncachedCustom.length > 0) {
        res.pendingFoliagePromise = hydrateCustomScatterListAsync(
          uncachedCustom,
          customAssets,
          res.customScatterGroups,
          style,
          (item) => sampleLevelHeight(level, item.x, item.z),
          deferSignal
        );
      }
    }
    return res;
  }

  const islandGroup = new THREE.Group();
  const terrain = ensureUpgradedTerrain(level.terrain ?? createInitialTerrain());
  const biome = getBiome(level.biome);
  const timeUniform = getSharedBotwUniforms().uTime;
  const windUniform = uniform(computeWeatherWindFactor(level.weather, level.wind));
  const worldMapContext = options?.worldMapContext;
  const isWorldMapMode = worldMapContext?.mode === 'worldMap';
  const isFreeform = Boolean(terrain.freeformWorld || worldMapContext?.worldMap);
  const wmMode = worldMapContext?.mode ?? 'land';
  const wmActiveCode = worldMapContext?.activeRegionCode ?? 0;
  const wmRevision = worldMapContext?.worldMap?.revision ?? 0;
  const worldRadius = isWorldMapMode
    ? getWorldMapRadius(worldMapContext?.worldMap)
    : getTerrainRadius(terrain);
  const regionOriginKey = worldMapContext?.activeRegionOrigin
    ? `${worldMapContext.activeRegionOrigin[0]},${worldMapContext.activeRegionOrigin[1]}`
    : '0,0';
  const regionPaletteSig = worldMapContext?.worldMap
    ? worldMapContext.worldMap.regions.map((r) => `${r.code}:${r.colorHex}`).join('|')
    : '';

  const renderSize = isWorldMapMode
    ? Math.min(320, worldMapContext?.worldMap?.gridSize ?? 320)
    : Math.min(312, terrain.size * 2);
  const renderWidth = renderSize + 1;
  const renderStep = (2 * worldRadius) / renderSize;
  const waterDepthTexSize = 256;

  let positions: Float32Array;
  let colors: Float32Array;
  let w0: Float32Array;
  let w1: Float32Array;
  let weather0: Float32Array;
  let weather1: Float32Array;
  let waterDepthTexData: Float32Array;

  const snapIdx = cachedTerrainSnapshots.findIndex(
    (s) =>
      s.heightsRef === terrain.heights &&
      s.layersRef === terrain.layers &&
      s.weatheringRef === terrain.weathering &&
      s.revision === (terrain.revision ?? 0) &&
      s.size === terrain.size &&
      s.renderSize === renderSize &&
      s.waterDepthTexSize === waterDepthTexSize &&
      s.freeformWorld === isFreeform &&
      s.worldMapMode === wmMode &&
      s.worldMapActiveCode === wmActiveCode &&
      s.worldMapRevision === wmRevision &&
      s.worldRadius === worldRadius &&
      s.regionOriginKey === regionOriginKey &&
      s.regionPaletteSig === regionPaletteSig
  );

  const geo = new THREE.BufferGeometry();
  if (snapIdx >= 0) {
    const snap = cachedTerrainSnapshots[snapIdx];
    positions = snap.positions.slice();
    colors = snap.colors.slice();
    w0 = snap.w0.slice();
    w1 = snap.w1.slice();
    weather0 = snap.weather0.slice();
    weather1 = snap.weather1.slice();
    waterDepthTexData = snap.waterDepthTexData.slice();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aW0', new THREE.BufferAttribute(w0, 4));
    geo.setAttribute('aW1', new THREE.BufferAttribute(w1, 3));
    geo.setAttribute('aWeather0', new THREE.BufferAttribute(weather0, 4));
    geo.setAttribute('aWeather1', new THREE.BufferAttribute(weather1, 1));
    geo.setAttribute('normal', new THREE.BufferAttribute(snap.normals.slice(), 3));
    geo.setIndex(new THREE.BufferAttribute(snap.indices, 1));
  } else {
    positions = new Float32Array(renderWidth * renderWidth * 3);
    colors = new Float32Array(renderWidth * renderWidth * 3);
    w0 = new Float32Array(renderWidth * renderWidth * 4);
    w1 = new Float32Array(renderWidth * renderWidth * 3);
    weather0 = new Float32Array(renderWidth * renderWidth * 4);
    weather1 = new Float32Array(renderWidth * renderWidth);

    populateSubdividedTerrainAttributes(
      terrain,
      renderSize,
      positions,
      colors,
      w0,
      w1,
      weather0,
      weather1,
      undefined,
      worldMapContext,
      worldRadius
    );

    const maxIndexCount = renderSize * renderSize * 6;
    const rawIndices =
      renderWidth * renderWidth > 65535
        ? new Uint32Array(maxIndexCount)
        : new Uint16Array(maxIndexCount);
    let indexPtr = 0;
    const shoreRadiusSq = IslandTerrain.shoreRadius * IslandTerrain.shoreRadius;

    for (let row = 0; row < renderSize; row++) {
      const vz = -worldRadius + (row + 0.5) * renderStep;
      const vzSq = vz * vz;
      const rowBase = row * renderWidth;
      for (let col = 0; col < renderSize; col++) {
        if (!isFreeform) {
          const vx = -worldRadius + (col + 0.5) * renderStep;
          if (vx * vx + vzSq > shoreRadiusSq) continue;
        }

        const a = rowBase + col;
        const b = a + 1;
        const c = a + renderWidth;
        const d = c + 1;
        // Alternate quad diagonal every checkerboard cell to remove directional stair-stepping on curves
        if (((row + col) & 1) === 0) {
          rawIndices[indexPtr++] = a;
          rawIndices[indexPtr++] = c;
          rawIndices[indexPtr++] = b;
          rawIndices[indexPtr++] = b;
          rawIndices[indexPtr++] = c;
          rawIndices[indexPtr++] = d;
        } else {
          rawIndices[indexPtr++] = a;
          rawIndices[indexPtr++] = c;
          rawIndices[indexPtr++] = d;
          rawIndices[indexPtr++] = a;
          rawIndices[indexPtr++] = d;
          rawIndices[indexPtr++] = b;
        }
      }
    }

    const indexArray = indexPtr === maxIndexCount ? rawIndices : rawIndices.slice(0, indexPtr);

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aW0', new THREE.BufferAttribute(w0, 4));
    geo.setAttribute('aW1', new THREE.BufferAttribute(w1, 3));
    geo.setAttribute('aWeather0', new THREE.BufferAttribute(weather0, 4));
    geo.setAttribute('aWeather1', new THREE.BufferAttribute(weather1, 1));
    geo.setIndex(new THREE.BufferAttribute(indexArray, 1));
    geo.computeVertexNormals();

    waterDepthTexData = new Float32Array(waterDepthTexSize * waterDepthTexSize * 4);
    populateWaterDepthFromPositions(positions, renderSize, waterDepthTexData, waterDepthTexSize);

    const normalArray = geo.attributes.normal.array as Float32Array;
    cachedTerrainSnapshots.unshift({
      heightsRef: terrain.heights,
      layersRef: terrain.layers,
      weatheringRef: terrain.weathering,
      revision: terrain.revision ?? 0,
      size: terrain.size,
      renderSize,
      waterDepthTexSize,
      freeformWorld: isFreeform,
      worldMapMode: wmMode,
      worldMapActiveCode: wmActiveCode,
      worldMapRevision: wmRevision,
      worldRadius,
      regionOriginKey,
      regionPaletteSig,
      positions: positions.slice(),
      colors: colors.slice(),
      w0: w0.slice(),
      w1: w1.slice(),
      weather0: weather0.slice(),
      weather1: weather1.slice(),
      normals: normalArray.slice(),
      indices: indexArray,
      waterDepthTexData: waterDepthTexData.slice(),
    });
    if (cachedTerrainSnapshots.length > 1) {
      cachedTerrainSnapshots.length = 1;
    }
  }

  const terrainMatBundle = createTerrainMaterial(
    biome.ground,
    biome.detail,
    style,
    level.sceneryTextures,
    timeUniform,
    windUniform,
    terrain.mountainConfig,
    terrain.dirtAndRoadConfig,
    worldMapContext
  );
  const terrainMesh = new THREE.Mesh(geo, terrainMatBundle.material);
  terrainMesh.receiveShadow = true;
  terrainMesh.castShadow = true;
  terrainMesh.userData.isGround = true;
  islandGroup.add(terrainMesh);

  if (!isFreeform) {
    // Island cliff underbelly for classic circular island levels
    const bellyGeo = new THREE.ConeGeometry(IslandTerrain.shoreRadius * 0.94, 48, 36);
    const bellyMat = enableDiffuseRoughnessEon(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(biome.detail).multiplyScalar(0.52),
        roughness: 0.92,
      }),
      0.92
    );
    const belly = new THREE.Mesh(bellyGeo, bellyMat);
    belly.rotation.x = Math.PI;
    belly.position.y = -25.5;
    islandGroup.add(belly);
  }

  // Animated Water Sea & River Plane with terrain-depth shoreline fade, organic foam & Fresnel sheen
  const atlas = getTerrainTextureAtlas();
  const baseVistaInner = Math.max(198, isWorldMapMode ? worldRadius + 48 : worldRadius + 38);
  const vistaExtRadius = baseVistaInner + Math.max(0, level.vistaDistance ?? 0) * 1.38 + 310;
  const oceanPlaneSize = isWorldMapMode
    ? Math.max(4800, worldRadius * 7.2, vistaExtRadius * 2.3)
    : Math.max(1150, worldRadius * 6.5, vistaExtRadius * 2.4);
  const waterGeo = new THREE.PlaneGeometry(oceanPlaneSize, oceanPlaneSize, 72, 72);
  waterGeo.rotateX(-Math.PI / 2);
  const waterNormal = atlas.waterNormal;
  waterNormal.repeat.set(
    isWorldMapMode ? 175 : Math.max(42, Math.round((worldRadius / IslandTerrain.radius) * 42)),
    isWorldMapMode ? 175 : Math.max(42, Math.round((worldRadius / IslandTerrain.radius) * 42))
  );

  // Live terrain elevation DataTexture (FloatType + NearestFilter + manual 4-tap bilinear in TSL)
  // Gives exact per-pixel water depth across coasts, coves, and sculpted rivers on both WebGPU & WebGL2.
  const waterDepthTex = new THREE.DataTexture(
    waterDepthTexData,
    waterDepthTexSize,
    waterDepthTexSize,
    THREE.RGBAFormat,
    THREE.FloatType
  );
  waterDepthTex.minFilter = THREE.NearestFilter;
  waterDepthTex.magFilter = THREE.NearestFilter;
  waterDepthTex.wrapS = THREE.ClampToEdgeWrapping;
  waterDepthTex.wrapT = THREE.ClampToEdgeWrapping;
  waterDepthTex.generateMipmaps = false;
  waterDepthTex.needsUpdate = true;

  // Rich clear blue water material — keeps river & sea unmistakably blue even under warm golden light
  const pureWaterBlue = new THREE.Color(biome.water).lerp(new THREE.Color('#2078EC'), 0.58);
  const waterMat = new MeshStandardNodeMaterial({
    color: pureWaterBlue,
    emissive: new THREE.Color('#10438F'),
    emissiveIntensity: 0.28,
    normalMap: waterNormal,
    normalScale: new THREE.Vector2(0.42, 0.42),
    roughness: style === 'celToon' ? 0.3 : 0.14,
    metalness: 0.1,
    transparent: true,
    opacity: 0.94,
  });

  const wave1 = sin(positionLocal.x.mul(0.32).add(timeUniform.mul(1.45))).mul(0.065);
  const wave2 = cos(positionLocal.z.mul(0.38).sub(timeUniform.mul(1.15))).mul(0.055);
  waterMat.positionNode = vec3(positionLocal.x, positionLocal.y.add(wave1).add(wave2), positionLocal.z);

  const waterMeshWorldRadius = worldRadius;
  waterMat.colorNode = Fn(() => {
    // 1. Sample exact terrain elevation below this water pixel (manual 4-tap bilinear for WebGPU/WebGL2 safety)
    const meshRadiusNode = float(waterMeshWorldRadius);
    const meshDiameterNode = float(waterMeshWorldRadius * 2.0);
    const terrainUv = vec2(positionLocal.x, positionLocal.z)
      .add(meshRadiusNode)
      .div(meshDiameterNode);
    const inBounds = smoothstep(0.0, 0.015, terrainUv.x)
      .mul(smoothstep(0.0, 0.015, terrainUv.y))
      .mul(float(1.0).sub(smoothstep(0.985, 1.0, terrainUv.x)))
      .mul(float(1.0).sub(smoothstep(0.985, 1.0, terrainUv.y)));

    const texRes = float(waterDepthTexSize);
    const texPos = clamp(terrainUv, vec2(0.0), vec2(1.0)).mul(texRes.sub(1.0));
    const f = fract(texPos);
    const baseCell = floor(texPos);
    const uv00 = baseCell.add(0.5).div(texRes);
    const uv10 = baseCell.add(vec2(1.0, 0.0)).add(0.5).div(texRes);
    const uv01 = baseCell.add(vec2(0.0, 1.0)).add(0.5).div(texRes);
    const uv11 = baseCell.add(vec2(1.0, 1.0)).add(0.5).div(texRes);
    const h00 = texture(waterDepthTex, uv00).r;
    const h10 = texture(waterDepthTex, uv10).r;
    const h01 = texture(waterDepthTex, uv01).r;
    const h11 = texture(waterDepthTex, uv11).r;
    const sampledTerrainY = mix(mix(h00, h10, f.x), mix(h01, h11, f.x), f.y);
    const terrainY = mix(float(-14.0), sampledTerrainY, inBounds);

    const waterDepth = max(0.0, float(IslandTerrain.waterLevel).sub(terrainY));

    // 2. Depth-driven optical absorption (shallow turquoise -> clear azure -> deep sapphire sea)
    const waterRgb = materialColor.rgb;
    const shallowCol = mix(waterRgb, vec3(0.24, 0.8, 0.86), 0.56);
    const deepCol = waterRgb.mul(vec3(0.42, 0.58, 0.86));
    const midCol = mix(shallowCol, waterRgb, smoothstep(0.08, 2.6, waterDepth));
    const depthCol = mix(midCol, deepCol, smoothstep(2.4, 11.5, waterDepth));

    // 3. Animated surface sun shimmer & grazing-angle Fresnel sky glint
    const shimmer = sin(positionLocal.x.mul(0.55).add(timeUniform.mul(1.9))).mul(
      cos(positionLocal.z.mul(0.55).sub(timeUniform.mul(1.5)))
    );
    const viewDir = normalize(cameraPosition.sub(positionWorld));
    const fresnel = pow(float(1.0).sub(clamp(dot(normalize(normalWorld), viewDir), 0.0, 1.0)), 4.0);
    const col = depthCol
      .add(vec3(0.05, 0.12, 0.24).mul(max(0.0, shimmer)))
      .add(vec3(0.2, 0.34, 0.48).mul(fresnel).mul(0.52));

    // 4. Organic shoreline & riverbank foam driven by real terrain depth
    const n1 = sin(positionLocal.x.mul(0.85).add(positionLocal.z.mul(0.65)).add(timeUniform.mul(1.2)))
      .mul(0.5)
      .add(0.5);
    const n2 = cos(positionLocal.x.mul(1.45).sub(positionLocal.z.mul(1.15)).sub(timeUniform.mul(0.95)))
      .mul(0.5)
      .add(0.5);
    const organicNoise = mix(n1, n2, 0.5);

    const edgeFoam = float(1.0)
      .sub(smoothstep(0.03, 0.44, waterDepth))
      .mul(smoothstep(0.0, 0.05, waterDepth));
    const waveBand = smoothstep(0.08, 0.36, waterDepth).mul(
      float(1.0).sub(smoothstep(0.95, 1.9, waterDepth))
    );
    const rippleWave = smoothstep(
      0.44,
      0.86,
      sin(waterDepth.mul(7.2).sub(timeUniform.mul(2.45)).add(organicNoise.mul(2.5)))
        .mul(0.5)
        .add(0.5)
    );
    const shoreFoam = clamp(
      edgeFoam
        .mul(0.76)
        .add(waveBand.mul(rippleWave).mul(0.64).mul(float(0.58).add(organicNoise.mul(0.42)))),
      0.0,
      1.0
    );

    // 5. Smooth shoreline alpha feathering (eliminates harsh ground/water intersection seams)
    const shoreAlpha = smoothstep(0.0, 0.42, waterDepth);
    const finalAlpha = clamp(
      materialOpacity.mul(mix(0.14, 1.0, shoreAlpha)).add(shoreFoam.mul(0.28)),
      0.0,
      1.0
    );

    return vec4(mix(col, vec3(0.91, 0.96, 1.0), shoreFoam.mul(0.74)), finalAlpha);
  })();

  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.y = IslandTerrain.waterLevel;
  water.receiveShadow = true;
  water.userData.skipBotwStyle = true;
  water.userData.disposeExtra = () => {
    waterDepthTex.dispose();
  };
  islandGroup.add(water);

  if (isWorldMapMode) {
    applyBotwStyleToObject(islandGroup, style, { rimStrengthScale: 0.65, shadowLiftScale: 0.85 });
    return {
      group: islandGroup,
      timeUniform,
      windUniform,
      customScatterGroups: new THREE.Group(),
      torchLights: [],
      flameMeshes: [],
      choppableTrees: [],
      harvestableScatter: [],
      terrainMesh,
      terrainRenderSize: renderSize,
      terrainWorldRadius: worldRadius,
      waterDepthTex,
      waterDepthTexData,
      waterDepthTexSize,
      updateMountainUniforms: (cfg) => terrainMatBundle.updateMountainUniforms(cfg),
      updateDirtUniforms: (cfg) => terrainMatBundle.updateDirtUniforms(cfg),
      updateWorldMapUniforms: (ctx) => terrainMatBundle.updateWorldMapUniforms(ctx),
    };
  }

  // Wooden Footbridge spanning the recessed river where the forest dirt trail crosses
  const bridgeGroup = new THREE.Group();
  bridgeGroup.position.set(RiverCrossing.x, RiverCrossing.deckY, RiverCrossing.z);
  bridgeGroup.rotation.y = RiverCrossing.yaw;

  const plankMat = enableDiffuseRoughnessEon(
    new THREE.MeshStandardMaterial({ color: '#8A5A36', roughness: 0.85 }),
    0.88
  ) as THREE.MeshStandardMaterial;
  const timberDarkMat = enableDiffuseRoughnessEon(
    new THREE.MeshStandardMaterial({ color: '#5A3A22', roughness: 0.9 }),
    0.9
  ) as THREE.MeshStandardMaterial;
  if (level.sceneryTextures?.woodStructures?.enabled) {
    applySurfaceTextureToMaterial(plankMat, level.sceneryTextures.woodStructures, {
      baseTintHex: '#8A5A36',
    });
    applySurfaceTextureToMaterial(timberDarkMat, level.sceneryTextures.woodStructures, {
      baseTintHex: '#6F4F38',
    });
    // Keep railings slightly richer/darker than deck planks for clear structure contrast
    timberDarkMat.color.multiplyScalar(0.84);
  }
  const deckW = RiverCrossing.halfWidth * 2;
  const deckL = RiverCrossing.halfLength * 2;
  const deck = new THREE.Mesh(
    applyWorldScaledBoxUVs(new THREE.BoxGeometry(deckW, 0.28, deckL), deckW, 0.28, deckL, 0.35),
    plankMat
  );
  deck.position.y = -0.14;
  deck.receiveShadow = true;
  deck.castShadow = true;
  deck.userData.isGround = true;
  deck.userData.bridgeWoodRole = 'plank';
  bridgeGroup.add(deck);

  const railLen = RiverCrossing.halfLength * 1.95;
  const railGeo = applyWorldScaledBoxUVs(
    new THREE.BoxGeometry(0.14, 0.14, railLen),
    0.14,
    0.14,
    railLen,
    0.4
  );
  const postGeo = applyWorldScaledBoxUVs(new THREE.BoxGeometry(0.22, 1.15, 0.22), 0.22, 1.15, 0.22, 0.45);
  for (const sx of [-RiverCrossing.halfWidth + 0.18, RiverCrossing.halfWidth - 0.18]) {
    const rail = new THREE.Mesh(railGeo, timberDarkMat);
    rail.position.set(sx, 0.85, 0);
    rail.castShadow = true;
    rail.userData.bridgeWoodRole = 'timber';
    bridgeGroup.add(rail);
    for (let pz = -RiverCrossing.halfLength + 0.8; pz <= RiverCrossing.halfLength - 0.6; pz += 3.6) {
      const post = new THREE.Mesh(postGeo, timberDarkMat);
      post.position.set(sx, 0.42, pz);
      post.castShadow = true;
      post.userData.bridgeWoodRole = 'timber';
      const piling = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 3.6, 8), timberDarkMat);
      piling.position.set(sx * 0.92, -1.9, pz);
      piling.userData.bridgeWoodRole = 'timber';
      bridgeGroup.add(post, piling);
    }
  }
  if (!isFreeform) {
    islandGroup.add(bridgeGroup);
  }

  // Per-Water-Body Selectable Lakes, Ponds, Rivers & Creeks
  const waterBodyGroupBundle = buildWaterBodiesGroup(
    terrain.waterBodies ?? [],
    waterDepthTex,
    waterDepthTexSize,
    timeUniform,
    style,
    worldRadius
  );
  if (waterBodyGroupBundle.group.children.length > 0) {
    islandGroup.add(waterBodyGroupBundle.group);
  }

  // Procedural Dirt & Trail Pebble Scatter
  const dirtPebbleMesh = buildDirtPebblesGroup(terrain, terrain.dirtAndRoadConfig);
  if (dirtPebbleMesh) {
    islandGroup.add(dirtPebbleMesh);
  }

  // Cave Grottos
  if (terrain.caves && terrain.caves.length > 0) {
    const cavesGroup = buildCavesGroup(level, terrain.caves, timeUniform);
    islandGroup.add(cavesGroup);
  }

  const grassContainer = new THREE.Group();
  const instancedGroup = new THREE.Group();
  const customScatterGroups = new THREE.Group();
  const vistaContainer = new THREE.Group();
  islandGroup.add(grassContainer, instancedGroup, customScatterGroups, vistaContainer);

  // Cohesive BotW soft-painterly rim & cool shadow lift across core island terrain, water, bridges & caves
  applyBotwStyleToObject(islandGroup, style, { rimStrengthScale: 0.82, shadowLiftScale: 0.85 });

  const choppableTrees: ChoppableTreeHandle[] = [];
  const harvestableScatter: HarvestableScatterHandle[] = [];
  const handles: IslandSceneHandles = {
    group: islandGroup,
    timeUniform,
    windUniform,
    customScatterGroups,
    torchLights: [],
    flameMeshes: [],
    choppableTrees,
    harvestableScatter,
    terrainMesh,
    terrainRenderSize: renderSize,
    terrainWorldRadius: worldRadius,
    waterDepthTex,
    waterDepthTexData,
    waterDepthTexSize,
    updateMountainUniforms: (cfg) => terrainMatBundle.updateMountainUniforms(cfg),
    updateDirtUniforms: (cfg) => terrainMatBundle.updateDirtUniforms(cfg),
    updateWaterBodiesUniforms: (bodies, selectedWaterBodyId) =>
      waterBodyGroupBundle.updateUniforms(bodies, selectedWaterBodyId),
    updateWorldMapUniforms: (ctx) => terrainMatBundle.updateWorldMapUniforms(ctx),
  };

  const scatterPlan = createScatterBuildPlan(
    level,
    terrain,
    terrain.scatter,
    style,
    timeUniform,
    windUniform,
    customAssets,
    instancedGroup,
    customScatterGroups,
    choppableTrees,
    harvestableScatter,
    worldMapContext
  );

  const vistaPreset: VistaPresetId = level.vistaPreset ?? 'alpineValley';
  const hasVista = vistaPreset !== 'none' || (level.vistaItems?.length ?? 0) > 0;
  const grassWorldMapCtx =
    worldMapContext?.worldMap && worldMapContext.activeRegionCode
      ? {
          worldMap: worldMapContext.worldMap,
          activeRegionCode: worldMapContext.activeRegionCode,
          activeRegionOrigin: worldMapContext.activeRegionOrigin,
        }
      : undefined;

  if (!deferFoliage) {
    // Synchronous path (Play Mode, thumbnails, etc.)
    const grassSystem = new StylizedGrassSystem({
      terrain,
      biome: level.biome,
      biomeGroundHex: biome.ground,
      biomeDetailHex: biome.detail,
      visualStyle: style,
      config: level.grass,
      isSoftwareGl,
      worldMapCtx: grassWorldMapCtx,
    });
    applyBotwStyleToObject(grassSystem.group, style, { rimStrengthScale: 0.82, shadowLiftScale: 0.85 });
    grassContainer.add(grassSystem.group);
    handles.grassSystem = grassSystem;

    if (scatterPlan.stylizedCanopyTrees.length > 0) {
      const builtForest = buildProceduralCanopyForest(
        scatterPlan.stylizedCanopyTrees,
        style,
        timeUniform,
        scatterPlan.fallbackLeafHex,
        level.sceneryTextures,
        windUniform
      );
      applyBotwStyleToObject(builtForest.group, style, { rimStrengthScale: 0.82, shadowLiftScale: 0.85 });
      instancedGroup.add(builtForest.group);
      scatterPlan.pushForestRecords(builtForest.records);
    }

    for (const step of scatterPlan.batchSteps) {
      void step.run();
    }

    for (const item of scatterPlan.customItems) {
      if (!item.customAssetId) continue;
      const meta = customAssets.find((a) => a.id === item.customAssetId);
      const inst = instantiateCustomModel(item.customAssetId, meta, {
        scaleAdjust: item.size,
        visualStyle: style,
      });
      if (inst) {
        const { y } = scatterPlan.groundAt(item.x, item.z, 0.3 * item.size);
        inst.group.position.set(item.x, y, item.z);
        inst.group.rotation.y = item.rotation;
        applyBotwStyleToObject(inst.group, style, { rimStrengthScale: 0.82, shadowLiftScale: 0.85 });
        customScatterGroups.add(inst.group);
      }
    }

    if (hasVista) {
      const vista = buildDistantVista(level, customAssets, style, baseVistaInner);
      applyBotwStyleToObject(vista, style, { rimStrengthScale: 0.82, shadowLiftScale: 0.85 });
      vistaContainer.add(vista);
    }

    return handles;
  }

  // Deferred asynchronous frame-budgeted loading path (World Builder UI responsiveness)
  handles.pendingFoliagePromise = (async () => {
    if (deferSignal?.aborted) return;

    const vistaTreeCfgs = (['conifer', 'oak', 'birch'] as const)
      .map((sp) => resolveEffectiveVistaTreeConfig(level, sp))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));

    // Kick off all custom GLB & texture preloads asynchronously in parallel
    const texIdSet = new Set(collectReferencedTextureIds(level.sceneryTextures, level.canopyEngine));
    for (const vCfg of vistaTreeCfgs) {
      for (const tid of collectReferencedTextureIds(undefined, vCfg)) {
        texIdSet.add(tid);
      }
    }
    const texIds = Array.from(texIdSet);
    const missingTexIds = texIds.filter((id) => !getRawCustomTextureSync(id));
    const texPreloadPromise =
      missingTexIds.length > 0
        ? Promise.allSettled(missingTexIds.map((id) => loadCustomTextureToCache(id)))
        : Promise.resolve([]);

    const readyCanopyTrees: typeof scatterPlan.stylizedCanopyTrees = [];
    const waitingCanopyTrees: typeof scatterPlan.stylizedCanopyTrees = [];
    const missingCanopyAssets = new Map<string, CustomAssetMeta['category']>();

    for (const entry of scatterPlan.stylizedCanopyTrees) {
      const assetIds = collectCanopyConfigAssetIds(entry.config);
      const uncached = assetIds.filter((id) => !getCachedAssetSync(id));
      if (uncached.length === 0) {
        readyCanopyTrees.push(entry);
      } else {
        waitingCanopyTrees.push(entry);
        for (const id of uncached) {
          if (!missingCanopyAssets.has(id)) {
            const meta = customAssets.find((a) => a.id === id);
            missingCanopyAssets.set(id, meta?.category ?? 'scenery');
          }
        }
      }
    }

    const canopyAssetPreloadPromise =
      missingCanopyAssets.size > 0
        ? Promise.allSettled(
            Array.from(missingCanopyAssets.entries()).map(([id, cat]) =>
              loadCustomAssetToCache(id, cat)
            )
          )
        : Promise.resolve([]);

    const missingVistaAssets = new Map<string, CustomAssetMeta['category']>();
    for (const vCfg of vistaTreeCfgs) {
      for (const id of collectCanopyConfigAssetIds(vCfg)) {
        if (!getCachedAssetSync(id) && !missingVistaAssets.has(id)) {
          const meta = customAssets.find((a) => a.id === id);
          missingVistaAssets.set(id, meta?.category ?? 'scenery');
        }
      }
    }
    for (const vi of level.vistaItems ?? []) {
      if (vi.kind === 'custom' && vi.customAssetId && !getCachedAssetSync(vi.customAssetId)) {
        const meta = customAssets.find((a) => a.id === vi.customAssetId);
        missingVistaAssets.set(vi.customAssetId, meta?.category ?? 'scenery');
      }
    }
    const vistaAssetPreloadPromise =
      missingVistaAssets.size > 0
        ? Promise.allSettled(
            Array.from(missingVistaAssets.entries()).map(([id, cat]) =>
              loadCustomAssetToCache(id, cat)
            )
          )
        : Promise.resolve([]);

    // Wait for any referenced custom textures before constructing grass & foliage materials
    if (missingTexIds.length > 0) {
      await texPreloadPromise;
      if (deferSignal?.aborted) return;

      // Refresh terrain & wood bridge materials in place without rebuilding geometry if textures loaded async
      const prevTerrainMat = terrainMesh.material;
      const refreshedBundle = createTerrainMaterial(
        biome.ground,
        biome.detail,
        style,
        level.sceneryTextures,
        timeUniform,
        windUniform,
        terrain.mountainConfig,
        terrain.dirtAndRoadConfig,
        worldMapContext
      );
      terrainMesh.material = refreshedBundle.material;
      handles.updateMountainUniforms = refreshedBundle.updateMountainUniforms;
      handles.updateDirtUniforms = refreshedBundle.updateDirtUniforms;
      handles.updateWorldMapUniforms = refreshedBundle.updateWorldMapUniforms;
      if (Array.isArray(prevTerrainMat)) prevTerrainMat.forEach((m) => m.dispose());
      else prevTerrainMat.dispose();
      applyBotwStyleToObject(terrainMesh, style, { rimStrengthScale: 0.82, shadowLiftScale: 0.85 });

      if (level.sceneryTextures?.woodStructures?.enabled) {
        const refreshedBridgeMats = new Set<THREE.Material>();
        bridgeGroup.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          const role = mesh.userData?.bridgeWoodRole as 'plank' | 'timber' | undefined;
          if (!mesh.isMesh || !role || Array.isArray(mesh.material)) return;
          const mat = mesh.material as THREE.MeshStandardMaterial;
          if (refreshedBridgeMats.has(mat)) return;
          refreshedBridgeMats.add(mat);
          applySurfaceTextureToMaterial(mat, level.sceneryTextures!.woodStructures, {
            baseTintHex: role === 'plank' ? '#8A5A36' : '#6F4F38',
          });
          if (role === 'timber') {
            mat.color.multiplyScalar(0.84);
          }
        });
      }
    }

    // 1. Stylized Grass System (yielded animation frame)
    if (!(await nextAnimationFrame(deferSignal))) return;
    const grassSystem = new StylizedGrassSystem({
      terrain,
      biome: level.biome,
      biomeGroundHex: biome.ground,
      biomeDetailHex: biome.detail,
      visualStyle: style,
      config: level.grass,
      isSoftwareGl,
      worldMapCtx: grassWorldMapCtx,
    });
    if (deferSignal?.aborted) {
      grassSystem.dispose();
      return;
    }
    applyBotwStyleToObject(grassSystem.group, style, { rimStrengthScale: 0.82, shadowLiftScale: 0.85 });
    if (options?.onDeferredBatchReady) {
      grassSystem.group.visible = false;
      grassContainer.add(grassSystem.group);
      handles.grassSystem = grassSystem;
      await options.onDeferredBatchReady(grassSystem.group);
      if (!deferSignal?.aborted) {
        grassSystem.group.visible = true;
      }
    } else {
      grassContainer.add(grassSystem.group);
      handles.grassSystem = grassSystem;
    }

    // 2. Chunked Procedural Canopy Trees (ready immediately without uncached GLBs)
    if (options?.onDeferredBatchReady) {
      instancedGroup.visible = false;
    }
    const canopyConvertedCache = new Map<THREE.Material, THREE.Material>();
    const appendCanopyChunk = (chunk: typeof scatterPlan.stylizedCanopyTrees) => {
      if (deferSignal?.aborted || chunk.length === 0) return;
      const builtForest = buildProceduralCanopyForest(
        chunk,
        style,
        timeUniform,
        scatterPlan.fallbackLeafHex,
        level.sceneryTextures,
        windUniform
      );
      if (deferSignal?.aborted) {
        disposeObject3D(builtForest.group);
        return;
      }
      applyBotwStyleToObject(
        builtForest.group,
        style,
        { rimStrengthScale: 0.82, shadowLiftScale: 0.85 },
        canopyConvertedCache
      );
      instancedGroup.add(builtForest.group);
      scatterPlan.pushForestRecords(builtForest.records);
    };

    if (readyCanopyTrees.length > 0) {
      const ok = await runDeferredChunks({
        items: readyCanopyTrees,
        chunkSize: 1,
        frameBudgetMs: 4,
        maxItemsPerFrame: 2,
        yieldBeforeFirst: true,
        signal: deferSignal,
        onChunk: appendCanopyChunk,
      });
      if (!ok || deferSignal?.aborted) return;
    }

    // 3. Time-sliced Batched Scatter Categories (pines, oaks, birches, bushes, ferns, flowers, etc.)
    if (scatterPlan.batchSteps.length > 0) {
      const ok = await runDeferredSteps(scatterPlan.batchSteps, {
        frameBudgetMs: 4,
        yieldBeforeFirst: true,
        signal: deferSignal,
      });
      if (!ok || deferSignal?.aborted) return;
    }

    // 4. Hydrate Canopy Trees that waited on async GLB parsing in chunks
    if (waitingCanopyTrees.length > 0) {
      await canopyAssetPreloadPromise;
      if (deferSignal?.aborted) return;
      const ok = await runDeferredChunks({
        items: waitingCanopyTrees,
        chunkSize: 1,
        frameBudgetMs: 4,
        maxItemsPerFrame: 2,
        signal: deferSignal,
        onChunk: appendCanopyChunk,
      });
      if (!ok || deferSignal?.aborted) return;
    }

    if (options?.onDeferredBatchReady && instancedGroup.children.length > 0) {
      await options.onDeferredBatchReady(instancedGroup);
      if (deferSignal?.aborted) return;
    }
    instancedGroup.visible = true;

    // 5. Hydrate Custom GLB Scatter Items asynchronously without blocking UI
    if (scatterPlan.customItems.length > 0) {
      if (options?.onDeferredBatchReady) {
        customScatterGroups.visible = false;
      }
      await hydrateCustomScatterListAsync(
        scatterPlan.customItems,
        customAssets,
        customScatterGroups,
        style,
        (item) => scatterPlan.groundAt(item.x, item.z, 0.3 * item.size).y,
        deferSignal
      );
      if (deferSignal?.aborted) return;
      if (options?.onDeferredBatchReady && customScatterGroups.children.length > 0) {
        await options.onDeferredBatchReady(customScatterGroups);
        if (deferSignal?.aborted) return;
      }
      customScatterGroups.visible = true;
    }

    // 6. Distant Mountain & Forest Vista (time-sliced across frames to keep frame time <16ms)
    if (hasVista) {
      if (missingVistaAssets.size > 0) {
        await vistaAssetPreloadPromise;
      }
      if (!(await nextAnimationFrame(deferSignal))) return;
      if (options?.onDeferredBatchReady) {
        vistaContainer.visible = false;
      }
      const vista = buildDistantVista(
        level,
        customAssets,
        style,
        baseVistaInner,
        deferSignal,
        vistaContainer
      );
      if (vista instanceof Promise) {
        const built = await vista;
        if (!built || deferSignal?.aborted) {
          if (built) disposeObject3D(built);
          return;
        }
      }
      if (options?.onDeferredBatchReady) {
        await options.onDeferredBatchReady(vistaContainer);
        if (!deferSignal?.aborted) {
          vistaContainer.visible = true;
        }
      }
    }
  })();

  return handles;
}

/**
 * Populates a 256x256 Float32 RGBA DataTexture with world terrain heights so the open-world
 * water shader computes exact per-pixel shoreline depth, optical absorption, and organic foam.
 */
function populateWaterDepthTexture(
  terrain: TerrainData,
  data: Float32Array,
  size: number,
  brushArea?: { x: number; z: number; radius: number }
): void {
  const worldRadius = getTerrainRadius(terrain);
  const worldDiameter = worldRadius * 2;
  const maxIdx = size - 1;
  let rStart = 0;
  let rEnd = maxIdx;
  let cStart = 0;
  let cEnd = maxIdx;

  if (brushArea) {
    const pad = brushArea.radius + 8.0;
    cStart = Math.max(0, Math.floor(((brushArea.x - pad + worldRadius) / worldDiameter) * maxIdx));
    cEnd = Math.min(maxIdx, Math.ceil(((brushArea.x + pad + worldRadius) / worldDiameter) * maxIdx));
    rStart = Math.max(0, Math.floor(((brushArea.z - pad + worldRadius) / worldDiameter) * maxIdx));
    rEnd = Math.min(maxIdx, Math.ceil(((brushArea.z + pad + worldRadius) / worldDiameter) * maxIdx));
  }

  for (let row = rStart; row <= rEnd; row++) {
    const wz = -worldRadius + (row / maxIdx) * worldDiameter;
    const rowOff = row * size;
    for (let col = cStart; col <= cEnd; col++) {
      const wx = -worldRadius + (col / maxIdx) * worldDiameter;
      const idx = (rowOff + col) * 4;
      const h = sampleTerrainHeight(terrain, wx, wz);
      data[idx] = h;
      data[idx + 1] = h;
      data[idx + 2] = h;
      data[idx + 3] = 1.0;
    }
  }
}

const _attrOceanCol = new THREE.Color('#1B6B93');
const _attrYellowCol = new THREE.Color(WORLD_TERRAIN_YELLOW);
const _attrTmpCol = new THREE.Color();
const _attrRegionColMap = new Map<number, THREE.Color>();
const _attrGauss = [1, 4, 6, 4, 1];
const _attrAcc = new Float32Array(7);
const _attrWmScratch: WorldMapSample = { land: 0, regionCode: 0, isBorder: false };

function recomputeTerrainGridNormalsBounds(
  positions: Float32Array,
  normals: Float32Array,
  renderSize: number,
  renderStep: number,
  bounds: { minRow: number; maxRow: number; minCol: number; maxCol: number }
): void {
  const renderWidth = renderSize + 1;
  const rStart = Math.max(0, bounds.minRow - 1);
  const rEnd = Math.min(renderSize, bounds.maxRow + 1);
  const cStart = Math.max(0, bounds.minCol - 1);
  const cEnd = Math.min(renderSize, bounds.maxCol + 1);

  for (let row = rStart; row <= rEnd; row++) {
    const rU = row > 0 ? row - 1 : 0;
    const rD = row < renderSize ? row + 1 : renderSize;
    const spanZ = Math.max(0.001, (rD - rU) * renderStep);
    const rowOff = row * renderWidth;
    const uOff = rU * renderWidth;
    const dOff = rD * renderWidth;

    for (let col = cStart; col <= cEnd; col++) {
      const cL = col > 0 ? col - 1 : 0;
      const cR = col < renderSize ? col + 1 : renderSize;
      const spanX = Math.max(0.001, (cR - cL) * renderStep);

      const hL = positions[(rowOff + cL) * 3 + 1];
      const hR = positions[(rowOff + cR) * 3 + 1];
      const hU = positions[(uOff + col) * 3 + 1];
      const hD = positions[(dOff + col) * 3 + 1];

      const nx = -(hR - hL) / spanX;
      const ny = 1.0;
      const nz = -(hD - hU) / spanZ;
      const invLen = 1 / Math.hypot(nx, ny, nz);

      const nIdx = (rowOff + col) * 3;
      normals[nIdx] = nx * invLen;
      normals[nIdx + 1] = ny * invLen;
      normals[nIdx + 2] = nz * invLen;
    }
  }
}

/**
 * Evaluates 2x-subdivided terrain vertices using Catmull-Rom bicubic heights and a smooth
 * 5x5 Gaussian multi-material splat filter across ALL 7 terrain layers (eliminating chunky stairs).
 */
function populateSubdividedTerrainAttributes(
  terrain: TerrainData,
  renderSize: number,
  positions: Float32Array,
  colors: Float32Array,
  w0: Float32Array,
  w1: Float32Array,
  weather0: Float32Array,
  weather1: Float32Array,
  bounds?: { minRow: number; maxRow: number; minCol: number; maxCol: number },
  worldMapContext?: WorldMapRenderContext,
  worldRadiusOverride?: number
) {
  const srcSize = terrain.size;
  const srcWidth = srcSize + 1;
  const renderWidth = renderSize + 1;
  const worldRadius =
    worldRadiusOverride ??
    (worldMapContext?.mode === 'worldMap'
      ? getWorldMapRadius(worldMapContext.worldMap)
      : getTerrainRadius(terrain));
  const renderStep = (2 * worldRadius) / renderSize;
  const rStart = bounds ? Math.max(0, bounds.minRow) : 0;
  const rEnd = bounds ? Math.min(renderSize, bounds.maxRow) : renderSize;
  const cStart = bounds ? Math.max(0, bounds.minCol) : 0;
  const cEnd = bounds ? Math.min(renderSize, bounds.maxCol) : renderSize;
  const hasWeathering =
    Boolean(terrain.weathering) && terrain.weathering!.length === srcWidth * srcWidth;

  const wm = worldMapContext?.worldMap;
  const isWorldMap = worldMapContext?.mode === 'worldMap' && Boolean(wm);
  const activeRegionCode = worldMapContext?.activeRegionCode ?? 0;
  const activeOriginX = worldMapContext?.activeRegionOrigin?.[0] ?? 0;
  const activeOriginZ = worldMapContext?.activeRegionOrigin?.[1] ?? 0;
  const checkOtherLand =
    worldMapContext?.mode === 'land' && Boolean(wm) && activeRegionCode > 0;

  const oceanCol = _attrOceanCol;
  const yellowTerrainCol = _attrYellowCol;
  const regionColMap = _attrRegionColMap;
  if (isWorldMap && wm) {
    regionColMap.clear();
    for (const r of wm.regions) {
      regionColMap.set(r.code, new THREE.Color(r.colorHex));
    }
  }
  const tmpWorldCol = _attrTmpCol;

  // Separable 5-tap Gaussian weights [1, 4, 6, 4, 1] for buttery multi-material edge blending
  const gauss = _attrGauss;
  const acc = _attrAcc;

  for (let row = rStart; row <= rEnd; row++) {
    const vz = -worldRadius + row * renderStep;
    const srcFZ = (row / renderSize) * srcSize;
    const baseR = Math.round(srcFZ);

    for (let col = cStart; col <= cEnd; col++) {
      const vx = -worldRadius + col * renderStep;
      const idx = row * renderWidth + col;
      let h = isWorldMap ? IslandTerrain.seaFloor : sampleTerrainHeight(terrain, vx, vz);

      let wmSample: WorldMapSample | null = null;
      if (isWorldMap && wm) {
        wmSample = sampleWorldMapInto(wm, vx, vz, _attrWmScratch);
        h = wmSample.land === 1 ? (wmSample.isBorder ? 0.55 : IslandTerrain.baseTop) : IslandTerrain.seaFloor;
      } else if (checkOtherLand && wm) {
        wmSample = sampleWorldMapInto(wm, activeOriginX + vx, activeOriginZ + vz, _attrWmScratch);
      }

      positions[idx * 3] = vx;
      positions[idx * 3 + 1] = h;
      positions[idx * 3 + 2] = vz;

      const srcFX = (col / renderSize) * srcSize;
      const baseC = Math.round(srcFX);

      // Fast-path uniform regions (skips 25-tap Gaussian convolution when 5x5 corners share the same layer)
      const rMin = baseR > 1 ? baseR - 2 : 0;
      const rMax = baseR + 2 < srcSize ? baseR + 2 : srcSize;
      const cMin = baseC > 1 ? baseC - 2 : 0;
      const cMax = baseC + 2 < srcSize ? baseC + 2 : srcSize;
      const centerL = terrain.layers[baseR * srcWidth + baseC] ?? 0;
      const isUniform =
        centerL >= 0 &&
        centerL < 7 &&
        (terrain.layers[rMin * srcWidth + cMin] ?? 0) === centerL &&
        (terrain.layers[rMin * srcWidth + cMax] ?? 0) === centerL &&
        (terrain.layers[rMax * srcWidth + cMin] ?? 0) === centerL &&
        (terrain.layers[rMax * srcWidth + cMax] ?? 0) === centerL &&
        (terrain.layers[baseR * srcWidth + cMin] ?? 0) === centerL &&
        (terrain.layers[baseR * srcWidth + cMax] ?? 0) === centerL &&
        (terrain.layers[rMin * srcWidth + baseC] ?? 0) === centerL &&
        (terrain.layers[rMax * srcWidth + baseC] ?? 0) === centerL;

      if (isUniform) {
        w0[idx * 4 + 0] = centerL === 0 ? 1 : 0;
        w0[idx * 4 + 1] = centerL === 1 ? 1 : 0;
        w0[idx * 4 + 2] = centerL === 2 ? 1 : 0;
        w0[idx * 4 + 3] = centerL === 3 ? 1 : 0;
        w1[idx * 3 + 0] = centerL === 4 ? 1 : 0;
        w1[idx * 3 + 1] = centerL === 5 ? 1 : 0;
        w1[idx * 3 + 2] = centerL === 6 ? 1 : 0;
      } else {
        acc[0] = 0;
        acc[1] = 0;
        acc[2] = 0;
        acc[3] = 0;
        acc[4] = 0;
        acc[5] = 0;
        acc[6] = 0;
        let totalW = 0;

        for (let dr = -2; dr <= 2; dr++) {
          const nr = Math.max(0, Math.min(srcSize, baseR + dr));
          const wy = gauss[dr + 2];
          const rowOff = nr * srcWidth;
          for (let dc = -2; dc <= 2; dc++) {
            const nc = Math.max(0, Math.min(srcSize, baseC + dc));
            const wt = wy * gauss[dc + 2];
            const l = terrain.layers[rowOff + nc] ?? 0;
            if (l >= 0 && l < 7) {
              acc[l] += wt;
              totalW += wt;
            }
          }
        }

        const inv = totalW > 0 ? 1 / totalW : 1;
        w0[idx * 4 + 0] = acc[0] * inv; // grass
        w0[idx * 4 + 1] = acc[1] * inv; // sand
        w0[idx * 4 + 2] = acc[2] * inv; // rock
        w0[idx * 4 + 3] = acc[3] * inv; // snow
        w1[idx * 3 + 0] = acc[4] * inv; // moss
        w1[idx * 3 + 1] = acc[5] * inv; // cobble
        w1[idx * 3 + 2] = acc[6] * inv; // worn dirt trail
      }

      if (isWorldMap && wmSample) {
        if (wmSample.land === 0) {
          tmpWorldCol.copy(oceanCol);
        } else {
          const regCol = wmSample.regionCode > 0 ? regionColMap.get(wmSample.regionCode) : undefined;
          tmpWorldCol.copy(regCol ?? yellowTerrainCol);
          if (wmSample.isBorder) {
            tmpWorldCol.multiplyScalar(0.74);
          }
        }
        colors[idx * 3] = tmpWorldCol.r;
        colors[idx * 3 + 1] = tmpWorldCol.g;
        colors[idx * 3 + 2] = tmpWorldCol.b;
      } else if (checkOtherLand && wmSample) {
        const isOther = wmSample.land === 1 && wmSample.regionCode !== activeRegionCode ? 1.0 : 0.0;
        colors[idx * 3] = isOther;
        colors[idx * 3 + 1] = isOther;
        colors[idx * 3 + 2] = isOther;
      } else {
        const shade = THREE.MathUtils.clamp(0.92 + h * 0.017, 0.82, 1.14);
        colors[idx * 3] = shade;
        colors[idx * 3 + 1] = shade;
        colors[idx * 3 + 2] = shade;
      }

      if (hasWeathering) {
        const ws = sampleTerrainWeathering(terrain, vx, vz);
        weather0[idx * 4 + 0] = ws.moss;
        weather0[idx * 4 + 1] = ws.cracks;
        weather0[idx * 4 + 2] = ws.scorch;
        weather0[idx * 4 + 3] = ws.mud;
        weather1[idx] = ws.frost;
      } else {
        weather0[idx * 4 + 0] = 0;
        weather0[idx * 4 + 1] = 0;
        weather0[idx * 4 + 2] = 0;
        weather0[idx * 4 + 3] = 0;
        weather1[idx] = 0;
      }
    }
  }
}

/**
 * Fast in-place GPU vertex & splat buffer update for real-time 60fps brush sculpting
 * without tearing down trees, caves, water, or distant mountains.
 */
export function updateIslandTerrainGeometryInPlace(
  handles: IslandSceneHandles | null | undefined,
  rawTerrain: TerrainData | undefined,
  brushArea?: { x: number; z: number; radius: number },
  worldMapContext?: WorldMapRenderContext
): boolean {
  if (!handles?.terrainMesh || !handles.terrainRenderSize || !rawTerrain) return false;
  const terrain = ensureUpgradedTerrain(rawTerrain);
  const geo = handles.terrainMesh.geometry as THREE.BufferGeometry;
  const posAttr = geo.attributes.position as THREE.BufferAttribute | undefined;
  const colAttr = geo.attributes.color as THREE.BufferAttribute | undefined;
  const w0Attr = geo.attributes.aW0 as THREE.BufferAttribute | undefined;
  const w1Attr = geo.attributes.aW1 as THREE.BufferAttribute | undefined;
  const weather0Attr = geo.attributes.aWeather0 as THREE.BufferAttribute | undefined;
  const weather1Attr = geo.attributes.aWeather1 as THREE.BufferAttribute | undefined;
  if (!posAttr || !colAttr || !w0Attr || !w1Attr || !weather0Attr || !weather1Attr) return false;

  const renderSize = handles.terrainRenderSize;
  const worldRadius =
    handles.terrainWorldRadius ??
    (worldMapContext?.mode === 'worldMap'
      ? getWorldMapRadius(worldMapContext.worldMap)
      : getTerrainRadius(terrain));
  let bounds: { minRow: number; maxRow: number; minCol: number; maxCol: number } | undefined;
  if (brushArea) {
    const pad = brushArea.radius + 7.5;
    bounds = {
      minCol: Math.floor(((brushArea.x - pad + worldRadius) / (2 * worldRadius)) * renderSize),
      maxCol: Math.ceil(((brushArea.x + pad + worldRadius) / (2 * worldRadius)) * renderSize),
      minRow: Math.floor(((brushArea.z - pad + worldRadius) / (2 * worldRadius)) * renderSize),
      maxRow: Math.ceil(((brushArea.z + pad + worldRadius) / (2 * worldRadius)) * renderSize),
    };
  }

  populateSubdividedTerrainAttributes(
    terrain,
    renderSize,
    posAttr.array as Float32Array,
    colAttr.array as Float32Array,
    w0Attr.array as Float32Array,
    w1Attr.array as Float32Array,
    weather0Attr.array as Float32Array,
    weather1Attr.array as Float32Array,
    bounds,
    worldMapContext,
    worldRadius
  );
  posAttr.needsUpdate = true;
  colAttr.needsUpdate = true;
  w0Attr.needsUpdate = true;
  w1Attr.needsUpdate = true;
  weather0Attr.needsUpdate = true;
  weather1Attr.needsUpdate = true;

  const normAttr = geo.attributes.normal as THREE.BufferAttribute | undefined;
  if (bounds && normAttr) {
    recomputeTerrainGridNormalsBounds(
      posAttr.array as Float32Array,
      normAttr.array as Float32Array,
      renderSize,
      (2 * worldRadius) / renderSize,
      bounds
    );
    normAttr.needsUpdate = true;
  } else {
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
  }

  handles.updateWorldMapUniforms?.(worldMapContext);
  if (worldMapContext?.mode === 'worldMap' && worldMapContext.worldMap) {
    if (handles.waterDepthTex && handles.waterDepthTexData && handles.waterDepthTexSize) {
      populateWaterDepthFromPositions(
        posAttr.array as Float32Array,
        renderSize,
        handles.waterDepthTexData,
        handles.waterDepthTexSize,
        brushArea,
        worldRadius
      );
      handles.waterDepthTex.needsUpdate = true;
    }
    return true;
  }
  const grassWmCtx =
    worldMapContext?.worldMap && worldMapContext.activeRegionCode
      ? {
          worldMap: worldMapContext.worldMap,
          activeRegionCode: worldMapContext.activeRegionCode,
          activeRegionOrigin: worldMapContext.activeRegionOrigin,
        }
      : undefined;
  handles.grassSystem?.updateTerrainData(terrain, brushArea, grassWmCtx);
  if (handles.waterDepthTex && handles.waterDepthTexData && handles.waterDepthTexSize) {
    populateWaterDepthTexture(
      terrain,
      handles.waterDepthTexData,
      handles.waterDepthTexSize,
      brushArea
    );
    handles.waterDepthTex.needsUpdate = true;
  }
  return true;
}

function buildMountainCaveInterior(
  stoneMat: THREE.Material,
  darkInteriorMat: THREE.Material,
  mossMat: THREE.Material,
  mossBrightMat: THREE.Material
): THREE.Group {
  const g = new THREE.Group();
  g.position.set(MountainCave.x, MountainCave.floorY, MountainCave.z);
  g.rotation.y = MountainCave.yaw;

  const rockGeo = createFacetedRockGeometry(1.0, 1.0, 1.0, 1.0, 13);
  const boulderGeo = createFacetedRockGeometry(1.0, 1.05, 0.92, 0.98, 29);

  // 1. Damp rocky interior floor slab (matches walkable MountainCave.floorY)
  const floorSlab = new THREE.Mesh(
    new THREE.CylinderGeometry(5.6, 5.9, 0.24, 28),
    darkInteriorMat
  );
  floorSlab.position.set(0, -0.09, -6.2);
  floorSlab.scale.set(1.02, 1, 1.24);
  floorSlab.receiveShadow = true;
  floorSlab.userData.isGround = true;
  g.add(floorSlab);

  // 2. Dramatic Mountain-Base Cave Mouth Arch & Flanking Craggy Buttresses
  const mouthBlocks: [number, number, number, number, number, number, number][] = [
    [-4.1, 2.2, 0.3, 1.85, 3.1, 2.3, 0.25],
    [4.1, 2.2, 0.3, 1.85, 3.1, 2.3, -0.22],
    [-6.2, 2.6, -1.2, 2.7, 3.6, 2.8, 0.4],
    [6.2, 2.6, -1.2, 2.7, 3.6, 2.8, -0.35],
    [0, 5.05, 0.05, 4.9, 1.55, 2.6, 0.08], // craggy overhanging brow
    [-2.5, 4.4, -0.25, 2.3, 1.45, 2.4, -0.18],
    [2.5, 4.4, -0.25, 2.3, 1.45, 2.4, 0.2],
  ];
  for (const [x, y, z, sx, sy, sz, ry] of mouthBlocks) {
    const m = new THREE.Mesh(rockGeo, stoneMat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.rotation.set(ry * 0.4, ry, ry * 0.3);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  }

  // Towering faceted Mountain Crag Cap rising right over the cave into the mountain peak behind
  const mountainCrags: [number, number, number, number, number, number, number][] = [
    [0, 7.6, -5.8, 7.2, 4.4, 7.6, 0.2],
    [-4.8, 6.8, -6.5, 4.8, 4.2, 5.8, 0.65],
    [4.8, 6.6, -6.2, 4.8, 4.0, 5.8, -0.55],
    [0, 9.6, -9.8, 6.4, 4.8, 6.2, -0.25],
    [-3.6, 8.2, -10.8, 4.5, 4.2, 4.8, 0.45],
    [3.8, 8.0, -10.4, 4.6, 4.0, 4.8, -0.4],
  ];
  for (const [x, y, z, sx, sy, sz, ry] of mountainCrags) {
    const crag = new THREE.Mesh(rockGeo, stoneMat);
    crag.position.set(x, y, z);
    crag.scale.set(sx, sy, sz);
    crag.rotation.set(0.12, ry, ry * 0.2);
    crag.castShadow = true;
    crag.receiveShadow = true;
    g.add(crag);
  }

  // 3. Enclosed Hollow Interior Cavern Walls (horseshoe of overlapping faceted cave monoliths)
  const wallRing: [number, number, number, number, number, number][] = [
    [-5.7, 2.3, -2.5, 1.85, 3.1, 2.5],
    [-6.0, 2.4, -5.5, 1.95, 3.2, 2.7],
    [-5.8, 2.4, -8.5, 2.0, 3.2, 2.6],
    [-4.2, 2.4, -11.2, 2.35, 3.3, 2.4],
    [0.0, 2.5, -13.1, 3.8, 3.4, 2.3],
    [4.2, 2.4, -11.2, 2.35, 3.3, 2.4],
    [5.8, 2.4, -8.5, 2.0, 3.2, 2.6],
    [6.0, 2.4, -5.5, 1.95, 3.2, 2.7],
    [5.7, 2.3, -2.5, 1.85, 3.1, 2.5],
  ];
  for (let i = 0; i < wallRing.length; i++) {
    const [x, y, z, sx, sy, sz] = wallRing[i];
    const wall = new THREE.Mesh(rockGeo, darkInteriorMat);
    wall.position.set(x, y, z);
    wall.scale.set(sx, sy, sz);
    wall.rotation.set((i % 3) * 0.14, i * 0.55, ((i + 1) % 3) * 0.12);
    wall.castShadow = true;
    wall.receiveShadow = true;
    g.add(wall);
  }

  // Vaulted Cavern Ceiling sealing overhead (keeps interior genuinely dark & enclosed)
  const ceilingSlabs: [number, number, number, number, number, number][] = [
    [0, 5.2, -3.6, 5.8, 1.35, 3.6],
    [0, 5.35, -7.4, 6.1, 1.45, 4.1],
    [0, 5.05, -10.8, 5.5, 1.4, 3.5],
  ];
  for (let i = 0; i < ceilingSlabs.length; i++) {
    const [x, y, z, sx, sy, sz] = ceilingSlabs[i];
    const ceil = new THREE.Mesh(rockGeo, darkInteriorMat);
    ceil.position.set(x, y, z);
    ceil.scale.set(sx, sy, sz);
    ceil.rotation.y = i * 0.4;
    ceil.castShadow = true;
    ceil.receiveShadow = true;
    g.add(ceil);
  }

  // Hanging ceiling stalactites (safely above hero head height)
  const stalactiteGeo = new THREE.ConeGeometry(0.24, 1.1, 10);
  const stalactites: [number, number, number, number][] = [
    [-2.4, 4.15, -3.2, 0.95],
    [2.6, 4.2, -4.1, 1.05],
    [-3.1, 4.1, -6.8, 1.2],
    [0.8, 4.25, -5.6, 0.8],
    [2.9, 4.05, -8.4, 1.15],
    [-1.4, 4.1, -9.8, 1.0],
    [1.6, 4.0, -10.4, 0.9],
    [-0.5, 4.2, -2.5, 0.72],
  ];
  for (const [x, y, z, sc] of stalactites) {
    const st = new THREE.Mesh(stalactiteGeo, darkInteriorMat);
    st.position.set(x, y, z);
    st.rotation.x = Math.PI;
    st.scale.set(sc * 0.85, sc, sc * 0.85);
    g.add(st);
  }

  // 4. Interior Cave Rocks, Boulders & Stalagmites tucked around the cavern perimeter
  const interiorRocks: [number, number, number, number, number, boolean][] = [
    [-3.7, 0.5, -3.6, 1.05, 0.78, true],
    [-4.1, 0.65, -7.2, 1.25, 0.95, true],
    [-3.2, 0.42, -9.8, 0.95, 0.68, true],
    [3.8, 0.55, -3.4, 1.1, 0.82, true],
    [4.0, 0.68, -6.8, 1.2, 0.92, true],
    [3.1, 0.48, -9.9, 1.05, 0.74, true],
    [-0.8, 0.52, -10.9, 1.3, 0.82, true],
    [1.4, 0.36, -10.7, 0.9, 0.62, false],
    [-2.1, 0.25, -5.1, 0.62, 0.45, true],
    [2.4, 0.28, -8.2, 0.68, 0.48, true],
    // Entrance flanking mossy boulders outside mouth
    [-3.4, 0.42, 2.3, 0.95, 0.66, true],
    [3.5, 0.38, 2.6, 0.88, 0.62, true],
  ];
  for (let i = 0; i < interiorRocks.length; i++) {
    const [x, y, z, r, h, hasMoss] = interiorRocks[i];
    const rock = new THREE.Mesh(boulderGeo, i < 10 ? darkInteriorMat : stoneMat);
    rock.position.set(x, y, z);
    rock.scale.set(r, h, r * 0.88);
    rock.rotation.set(i * 0.4, i * 1.1, i * 0.25);
    rock.castShadow = true;
    rock.receiveShadow = true;
    g.add(rock);

    if (hasMoss) {
      const cap = new THREE.Mesh(boulderGeo, i % 2 === 0 ? mossMat : mossBrightMat);
      cap.position.set(x, y + h * 0.58, z);
      cap.scale.set(r * 0.82, h * 0.36, r * 0.76);
      cap.rotation.y = i * 0.9;
      g.add(cap);
    }
  }

  // Rising pointed stalagmites beside the wall boulders
  const stalagmiteGeo = new THREE.ConeGeometry(0.32, 1.65, 10);
  const stalagmites: [number, number, number, number][] = [
    [-4.3, 0.75, -5.2, 1.05],
    [-3.6, 0.55, -8.6, 0.82],
    [4.2, 0.8, -5.1, 1.12],
    [3.7, 0.58, -8.8, 0.86],
    [0.2, 0.65, -11.3, 0.92],
  ];
  for (const [x, y, z, sc] of stalagmites) {
    const sm = new THREE.Mesh(stalagmiteGeo, darkInteriorMat);
    sm.position.set(x, y, z);
    sm.scale.set(sc, sc, sc);
    sm.castShadow = true;
    g.add(sm);
  }

  // 5. Lush Damp Moss Patches on cave mouth brow, damp floor corners & walls
  const mossPads: [number, number, number, number, number, number][] = [
    [0, 5.95, 0.55, 3.8, 0.55, 1.6], // overhanging cave mouth moss brow
    [-2.5, 4.95, 0.75, 1.9, 0.45, 1.2],
    [2.4, 4.85, 0.8, 1.85, 0.42, 1.2],
    [-3.1, 0.08, -2.1, 1.5, 0.16, 1.3],
    [3.0, 0.08, -2.4, 1.4, 0.15, 1.2],
    [-2.7, 0.07, -7.8, 1.7, 0.16, 1.5],
    [2.6, 0.07, -6.2, 1.5, 0.15, 1.4],
    [-0.4, 0.07, -9.2, 2.0, 0.16, 1.4],
    [0.5, 0.06, -6.4, 2.3, 0.12, 2.1], // damp mossy hollow under the carcass
  ];
  for (let i = 0; i < mossPads.length; i++) {
    const [x, y, z, sx, sy, sz] = mossPads[i];
    const pad = new THREE.Mesh(boulderGeo, i % 2 === 0 ? mossMat : mossBrightMat);
    pad.position.set(x, y, z);
    pad.scale.set(sx, sy, sz);
    pad.rotation.y = i * 0.7;
    pad.receiveShadow = true;
    g.add(pad);
  }

  // 6. Stylized Mid-Poly Beast Carcass (Spine, Arched Ribcage, Horned Skull & Scattered Bones)
  const boneMat = new THREE.MeshStandardMaterial({
    color: '#E5DCC4',
    roughness: 0.78,
    flatShading: true,
  });
  const agedBoneMat = new THREE.MeshStandardMaterial({
    color: '#C7BC9F',
    roughness: 0.84,
    flatShading: true,
  });
  const socketMat = new THREE.MeshStandardMaterial({
    color: '#1A1C22',
    roughness: 0.95,
  });

  const carcass = new THREE.Group();
  carcass.position.set(0.35, 0.08, -6.7);
  carcass.rotation.y = 0.32;

  // Curved spine vertebrae along the cave floor
  const vertGeo = new THREE.CylinderGeometry(0.11, 0.13, 0.34, 6);
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const vx = Math.sin(t * 2.1) * 0.42;
    const vz = -1.65 + t * 3.1;
    const vy = 0.14 + Math.sin(t * Math.PI) * 0.08;
    const vert = new THREE.Mesh(vertGeo, i % 2 === 0 ? boneMat : agedBoneMat);
    vert.position.set(vx, vy, vz);
    vert.rotation.x = Math.PI / 2;
    vert.rotation.z = -Math.cos(t * 2.1) * 0.35;
    vert.castShadow = true;
    carcass.add(vert);
  }

  // Arched ribcage (6 pairs of curved faceted ribs rising from the spine)
  const ribSegGeo = new THREE.CylinderGeometry(0.042, 0.055, 0.62, 5);
  for (let i = 0; i < 6; i++) {
    const t = (i + 1.3) / 8;
    const rx = Math.sin(t * 2.1) * 0.42;
    const rz = -1.65 + t * 3.1;
    const ribScale = 0.76 + Math.sin((i / 5) * Math.PI) * 0.44;
    for (const side of [-1, 1]) {
      // Leave one right rib slightly broken & fallen for authentic natural storytelling
      const broken = i === 4 && side === 1;
      const ribGroup = new THREE.Group();
      ribGroup.position.set(rx, 0.16, rz);
      ribGroup.rotation.y = -Math.cos(t * 2.1) * 0.25;

      const lower = new THREE.Mesh(ribSegGeo, boneMat);
      lower.scale.set(1, ribScale, 1);
      lower.position.set(side * 0.28 * ribScale, 0.22 * ribScale, 0);
      lower.rotation.z = -side * 0.85;
      lower.castShadow = true;

      const upper = new THREE.Mesh(ribSegGeo, agedBoneMat);
      upper.scale.set(0.85, ribScale * 0.85, 0.85);
      if (broken) {
        upper.position.set(side * 0.72, 0.06, 0.24);
        upper.rotation.set(0.15, 0.6, Math.PI / 2);
      } else {
        upper.position.set(side * 0.48 * ribScale, 0.66 * ribScale, 0.02);
        upper.rotation.z = side * 0.24;
      }
      upper.castShadow = true;

      ribGroup.add(lower, upper);
      carcass.add(ribGroup);
    }
  }

  // Pelvis & shoulder bones near back/front of spine
  const pelvis = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 0), agedBoneMat);
  pelvis.scale.set(1.5, 0.55, 0.9);
  pelvis.position.set(0.02, 0.18, -1.68);
  pelvis.castShadow = true;
  carcass.add(pelvis);

  // Weathered Beast Skull resting at the front end of the carcass
  const skull = new THREE.Group();
  skull.position.set(0.42, 0.22, 1.72);
  skull.rotation.set(0.08, 0.42, -0.22);

  const cranium = new THREE.Mesh(new THREE.DodecahedronGeometry(0.34, 0), boneMat);
  cranium.scale.set(0.95, 0.78, 1.15);
  cranium.castShadow = true;
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.58, 5), boneMat);
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, -0.05, 0.42);
  snout.castShadow = true;
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.46), agedBoneMat);
  jaw.position.set(0.04, -0.2, 0.26);
  jaw.rotation.set(0.16, 0.12, 0);

  const eyeL = new THREE.Mesh(new THREE.DodecahedronGeometry(0.085, 0), socketMat);
  eyeL.position.set(-0.18, 0.04, 0.22);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.18;

  // Curved faceted horns (left full horn, right partially snapped)
  const hornGeo = new THREE.ConeGeometry(0.075, 0.68, 5);
  const hornL = new THREE.Mesh(hornGeo, agedBoneMat);
  hornL.position.set(-0.34, 0.28, -0.14);
  hornL.rotation.set(-0.45, 0, 0.68);
  hornL.castShadow = true;
  const hornR = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.36, 5), agedBoneMat);
  hornR.position.set(0.28, 0.22, -0.1);
  hornR.rotation.set(-0.35, 0, -0.62);
  hornR.castShadow = true;

  skull.add(cranium, snout, jaw, eyeL, eyeR, hornL, hornR);
  carcass.add(skull);

  // Scattered limb bones near mossy floor rocks
  const scatteredBones: [number, number, number, number, number][] = [
    [-1.15, 0.07, 0.85, 0.75, 0.85],
    [1.25, 0.07, -0.55, -0.62, 0.78],
    [-0.9, 0.07, -1.55, 1.25, 0.68],
    [0.95, 0.07, 1.35, 0.35, 0.62],
  ];
  for (const [bx, by, bz, bry, len] of scatteredBones) {
    const bone = new THREE.Group();
    bone.position.set(bx, by, bz);
    bone.rotation.y = bry;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, len, 5), boneMat);
    shaft.rotation.z = Math.PI / 2;
    const endL = new THREE.Mesh(new THREE.DodecahedronGeometry(0.08, 0), agedBoneMat);
    endL.position.x = -len * 0.5;
    const endR = endL.clone();
    endR.position.x = len * 0.5;
    bone.add(shaft, endL, endR);
    carcass.add(bone);
  }
  g.add(carcass);

  // 7. Moody Cave Interior Lighting (cool daylight bounce at mouth + dim mossy cave fill inside)
  const mouthBounce = new THREE.PointLight('#82ACD4', 3.4, 15, 1.5);
  mouthBounce.position.set(0, 3.1, -2.6);
  g.add(mouthBounce);

  const chamberFill = new THREE.PointLight('#9AB89A', 2.8, 13, 1.5);
  chamberFill.position.set(0.3, 2.3, -7.4);
  g.add(chamberFill);

  return g;
}

interface WaterBodyUniformBundle {
  uWaterCol: { value: THREE.Color };
  uMurkCol: { value: THREE.Color };
  uOpacity: { value: number };
  uDepth: { value: number };
  uFoam: { value: number };
  uWaveSpeed: { value: number };
  uWindRipple: { value: number };
  uFlowSpeed: { value: number };
  uFlowDirX: { value: number };
  uFlowDirZ: { value: number };
  uSelected: { value: number };
  mesh: THREE.Mesh;
}

function buildWaterBodiesGroup(
  waterBodies: WaterBodyConfig[],
  waterDepthTex: THREE.DataTexture,
  waterDepthTexSize: number,
  timeUniform: { value: number },
  style: VisualStyleId,
  terrainWorldRadius: number = IslandTerrain.radius
): {
  group: THREE.Group;
  updateUniforms: (bodies?: WaterBodyConfig[], selectedWaterBodyId?: string | null) => void;
} {
  const group = new THREE.Group();
  const bundleMap = new Map<string, WaterBodyUniformBundle>();

  for (const wb of waterBodies) {
    let geo: THREE.BufferGeometry;
    if ((wb.kind === 'river' || wb.kind === 'stream') && wb.points && wb.points.length >= 2) {
      const pts3 = wb.points.map(([px, pz]) => new THREE.Vector3(px, 0, pz));
      const curve = new THREE.CatmullRomCurve3(pts3);
      const segs = Math.max(20, pts3.length * 10);
      const samples = curve.getSpacedPoints(segs);
      const halfW = Math.max(0.8, wb.width * 0.5);
      const positions: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];
      let accumDist = 0;

      for (let i = 0; i < samples.length; i++) {
        const cur = samples[i];
        if (i > 0) accumDist += cur.distanceTo(samples[i - 1]);
        const prev = samples[Math.max(0, i - 1)];
        const next = samples[Math.min(samples.length - 1, i + 1)];
        let tx = next.x - prev.x;
        let tz = next.z - prev.z;
        const len = Math.max(0.0001, Math.hypot(tx, tz));
        tx /= len;
        tz /= len;
        const nx = -tz;
        const nz = tx;
        const edgeWobble = Math.sin(i * 0.72 + wb.center[0] * 0.3) * (wb.shoreNoise * 0.42 * halfW);
        const w = halfW + edgeWobble;
        positions.push(cur.x - nx * w, 0, cur.z - nz * w);
        positions.push(cur.x + nx * w, 0, cur.z + nz * w);
        uvs.push(0, accumDist * 0.2);
        uvs.push(1, accumDist * 0.2);
        if (i < samples.length - 1) {
          const base = i * 2;
          indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
        }
      }
      geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(indices);
      geo.computeVertexNormals();
    } else {
      const radialSegs = 40;
      const rings = 4;
      geo = new THREE.CircleGeometry(1, radialSegs);
      geo.rotateX(-Math.PI / 2);
      const posAttr = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < posAttr.count; i++) {
        const vx = posAttr.getX(i);
        const vz = posAttr.getZ(i);
        const r = Math.hypot(vx, vz);
        if (r > 0.001) {
          const ang = Math.atan2(vz, vx);
          const jitter =
            1 +
            (Math.sin(ang * 3 + wb.center[0] * 0.25) * 0.14 +
              Math.cos(ang * 5 - wb.center[1] * 0.3) * 0.08) *
              wb.shoreNoise;
          posAttr.setXYZ(
            i,
            vx * wb.radiusX * jitter,
            0,
            vz * wb.radiusZ * jitter
          );
        }
      }
      void rings;
      geo.translate(wb.center[0], 0, wb.center[1]);
      geo.computeVertexNormals();
    }

    const uWaterCol = uniform(new THREE.Color(wb.waterColor));
    const uMurkCol = uniform(new THREE.Color(wb.deepMurkColor));
    const uOpacity = uniform(THREE.MathUtils.clamp(wb.opacity, 0.2, 1));
    const uDepth = uniform(Math.max(0.25, wb.depth));
    const uFoam = uniform(Math.max(0, wb.foamAmount));
    const uWaveSpeed = uniform(Math.max(0, wb.waveSpeed));
    const uWindRipple = uniform(Math.max(0, wb.windRipple));
    const uFlowSpeed = uniform(Math.max(0, wb.flowSpeed));
    const rad = (wb.flowAngleDeg * Math.PI) / 180;
    const uFlowDirX = uniform(Math.cos(rad));
    const uFlowDirZ = uniform(Math.sin(rad));
    const uSelected = uniform(0);

    const mat = new MeshStandardNodeMaterial({
      color: new THREE.Color(wb.waterColor),
      roughness: style === 'celToon' ? 0.28 : 0.14,
      metalness: 0.08,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const uTime = asIslandFloatUniformNode(timeUniform, 0);
    const waveAmp = float(0.032).mul(float(0.35).add(uWindRipple.mul(0.85)));
    const wv1 = sin(positionLocal.x.mul(0.48).add(uTime.mul(uWaveSpeed.mul(1.8).add(0.4)))).mul(waveAmp);
    const wv2 = cos(positionLocal.z.mul(0.54).sub(uTime.mul(uWaveSpeed.mul(1.4).add(0.3)))).mul(waveAmp);
    mat.positionNode = vec3(positionLocal.x, positionLocal.y.add(wv1).add(wv2), positionLocal.z);

    mat.colorNode = Fn(() => {
      const worldRadius = float(terrainWorldRadius);
      const worldDiameter = float(terrainWorldRadius * 2.0);
      const wp = positionWorld;
      const terrainUv = vec2(wp.x, wp.z).add(worldRadius).div(worldDiameter);
      const texRes = float(waterDepthTexSize);
      const texPos = clamp(terrainUv, vec2(0.0), vec2(1.0)).mul(texRes.sub(1.0));
      const f = fract(texPos);
      const baseCell = floor(texPos);
      const h00 = texture(waterDepthTex, baseCell.add(0.5).div(texRes)).r;
      const h10 = texture(waterDepthTex, baseCell.add(vec2(1.0, 0.0)).add(0.5).div(texRes)).r;
      const h01 = texture(waterDepthTex, baseCell.add(vec2(0.0, 1.0)).add(0.5).div(texRes)).r;
      const h11 = texture(waterDepthTex, baseCell.add(vec2(1.0, 1.0)).add(0.5).div(texRes)).r;
      const terrainY = mix(mix(h00, h10, f.x), mix(h01, h11, f.x), f.y);

      const surfaceY = float(IslandTerrain.waterLevel + wb.waterLevelOffset + 0.03);
      const waterDepth = max(0.0, surfaceY.sub(terrainY));
      const depthNorm = clamp(waterDepth.div(max(0.3, uDepth)), 0.0, 1.0);

      const flowShift = vec2(uFlowDirX, uFlowDirZ).mul(uTime.mul(uFlowSpeed.mul(1.15)));
      const rippleUv = vec2(wp.x, wp.z).mul(0.36).sub(flowShift);
      const flowNoise = tFbm2DTsl(rippleUv);
      const flowStreak = smoothstep(0.52, 0.88, flowNoise).mul(float(0.16).add(uWindRipple.mul(0.12)));

      const baseCol = mix(uWaterCol, uMurkCol, smoothstep(0.08, 0.92, depthNorm));
      const viewDir = normalize(cameraPosition.sub(wp));
      const fresnel = pow(float(1.0).sub(clamp(dot(normalize(normalWorld), viewDir), 0.0, 1.0)), 3.6);

      const shoreEdgeFoam = float(1.0).sub(smoothstep(0.02, 0.48, waterDepth)).mul(uFoam);
      const shoreBreakup = smoothstep(0.35, 0.78, tNoise2DTsl(rippleUv.mul(2.1)));
      const foamVal = clamp(shoreEdgeFoam.mul(float(0.55).add(shoreBreakup.mul(0.45))), 0.0, 1.0);

      const selectedGlow = vec3(0.48, 0.76, 1.0).mul(uSelected.mul(0.28));
      const finalRgb = mix(
        baseCol
          .add(vec3(0.12, 0.2, 0.24).mul(flowStreak))
          .add(vec3(0.18, 0.32, 0.45).mul(fresnel).mul(0.45))
          .add(selectedGlow),
        vec3(0.92, 0.97, 1.0),
        foamVal.mul(0.75)
      );

      const edgeFeather = smoothstep(0.0, 0.25, waterDepth);
      const alpha = clamp(
        uOpacity.mul(mix(0.22, 1.0, edgeFeather)).add(foamVal.mul(0.3)),
        0.05,
        1.0
      );
      return vec4(finalRgb, alpha);
    })();

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = IslandTerrain.waterLevel + wb.waterLevelOffset + 0.03;
    mesh.receiveShadow = true;
    mesh.userData.waterBodyId = wb.id;
    mesh.userData.skipBotwStyle = true;
    group.add(mesh);

    bundleMap.set(wb.id, {
      uWaterCol,
      uMurkCol,
      uOpacity,
      uDepth,
      uFoam,
      uWaveSpeed,
      uWindRipple,
      uFlowSpeed,
      uFlowDirX,
      uFlowDirZ,
      uSelected,
      mesh,
    });
  }

  return {
    group,
    updateUniforms: (bodies?: WaterBodyConfig[], selectedWaterBodyId?: string | null) => {
      for (const wb of bodies ?? []) {
        const b = bundleMap.get(wb.id);
        if (!b) continue;
        b.uWaterCol.value.set(wb.waterColor);
        b.uMurkCol.value.set(wb.deepMurkColor);
        b.uOpacity.value = THREE.MathUtils.clamp(wb.opacity, 0.2, 1);
        b.uDepth.value = Math.max(0.25, wb.depth);
        b.uFoam.value = Math.max(0, wb.foamAmount);
        b.uWaveSpeed.value = Math.max(0, wb.waveSpeed);
        b.uWindRipple.value = Math.max(0, wb.windRipple);
        b.uFlowSpeed.value = Math.max(0, wb.flowSpeed);
        const rad = (wb.flowAngleDeg * Math.PI) / 180;
        b.uFlowDirX.value = Math.cos(rad);
        b.uFlowDirZ.value = Math.sin(rad);
        b.uSelected.value = selectedWaterBodyId === wb.id ? 1 : 0;
        b.mesh.position.y = IslandTerrain.waterLevel + wb.waterLevelOffset + 0.03;
      }
    },
  };
}

function buildDirtPebblesGroup(
  terrain: TerrainData,
  dirtConfig?: DirtAndRoadConfig
): THREE.InstancedMesh | null {
  const cfg = dirtConfig ?? createDefaultDirtAndRoadConfig();
  if (cfg.pebbleDensity <= 0.02) return null;

  const dirtCells: [number, number][] = [];
  const terrainRadius = getTerrainRadius(terrain);
  const step = (terrainRadius * 2) / terrain.size;
  for (let row = 1; row < terrain.size; row++) {
    for (let col = 1; col < terrain.size; col++) {
      const idx = row * (terrain.size + 1) + col;
      if (terrain.layers[idx] === 6) {
        const wx = -terrainRadius + col * step;
        const wz = -terrainRadius + row * step;
        if (terrain.freeformWorld || Math.hypot(wx, wz) < IslandTerrain.shoreRadius - 4) {
          dirtCells.push([wx, wz]);
        }
      }
    }
  }
  if (dirtCells.length === 0) return null;

  const targetCount = Math.min(720, Math.max(12, Math.round(dirtCells.length * cfg.pebbleDensity * 1.15)));
  const pebbleGeo = createFacetedRockGeometry(0.14, 1.22, 0.65, 1.05, 19);
  const mat = new THREE.MeshStandardMaterial({
    color: '#FFFFFF',
    roughness: 0.88,
    flatShading: true,
  });
  const instMesh = new THREE.InstancedMesh(pebbleGeo, mat, targetCount);
  instMesh.castShadow = false;
  instMesh.receiveShadow = true;

  const baseColor = new THREE.Color(cfg.pebbleColor || '#7B746C');
  const tmpColor = new THREE.Color();
  const dummy = new THREE.Object3D();

  let placed = 0;
  for (let i = 0; i < targetCount; i++) {
    const cellIdx = (i * 37 + 11) % dirtCells.length;
    const [cx, cz] = dirtCells[cellIdx];
    const hash1 = Math.sin(i * 12.9898 + cx * 0.47 + cz * 0.83) * 43758.5453;
    const r1 = hash1 - Math.floor(hash1);
    const hash2 = Math.sin(i * 78.233 - cz * 0.61) * 29432.1234;
    const r2 = hash2 - Math.floor(hash2);
    const hash3 = Math.sin(i * 45.164 + cx * 0.91) * 19341.732;
    const r3 = hash3 - Math.floor(hash3);

    const spreadRange = (0.35 + cfg.pebbleSpread * 1.45) * step;
    const px = cx + (r1 - 0.5) * spreadRange;
    const pz = cz + (r2 - 0.5) * spreadRange;
    const py = sampleTerrainHeight(terrain, px, pz);
    if (py < IslandTerrain.waterLevel + 0.12) continue;

    const jitter = cfg.pebbleShapeRandomness;
    const baseScale = 0.6 + r3 * 0.95;
    const sx = baseScale * (1 + (r1 - 0.5) * 0.7 * jitter);
    const sy = baseScale * (0.7 + (r2 - 0.5) * 0.5 * jitter);
    const sz = baseScale * (1 + (r3 - 0.5) * 0.7 * jitter);

    dummy.position.set(px, py + 0.02 * sy, pz);
    dummy.rotation.set((r1 - 0.5) * 0.5 * jitter, r2 * Math.PI * 2, (r3 - 0.5) * 0.5 * jitter);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    instMesh.setMatrixAt(placed, dummy.matrix);

    tmpColor.copy(baseColor).offsetHSL(
      (r1 - 0.5) * 0.08 * cfg.pebbleHueVariance,
      (r2 - 0.5) * 0.14 * cfg.pebbleHueVariance,
      (r3 - 0.5) * 0.22 * cfg.pebbleHueVariance
    );
    instMesh.setColorAt(placed, tmpColor);
    placed++;
  }
  instMesh.count = placed;
  instMesh.instanceMatrix.needsUpdate = true;
  if (instMesh.instanceColor) instMesh.instanceColor.needsUpdate = true;
  return instMesh;
}

function buildCavesGroup(
  level: GameLevel,
  caves: CaveGrotto[],
  timeUniform: { value: number }
): THREE.Group {
  const group = new THREE.Group();
  const uCaveTime = asIslandFloatUniformNode(timeUniform, 0);
  const atlas = getTerrainTextureAtlas();
  const customCaveTex = level.sceneryTextures?.cave;

  const resolveCaveMaterialPair = (x: number, z: number) => {
    const baseStone = enableDiffuseRoughnessEon(
      new THREE.MeshStandardMaterial({
        map: atlas.craggyCaveRock,
        color: '#6C7382',
        roughness: 0.9,
        flatShading: true,
      }),
      0.92
    ) as THREE.MeshStandardMaterial;
    const baseDark = enableDiffuseRoughnessEon(
      new THREE.MeshStandardMaterial({
        map: atlas.craggyCaveRock,
        color: '#464C59',
        roughness: 0.94,
        flatShading: true,
      }),
      0.94
    ) as THREE.MeshStandardMaterial;

    if (customCaveTex?.enabled && customCaveTex.textureId) {
      applySurfaceTextureToMaterial(baseStone, customCaveTex, {
        baseTintHex: '#8E96A6',
        preserveFlatShading: true,
      });
      applySurfaceTextureToMaterial(baseDark, customCaveTex, {
        baseTintHex: '#5E6573',
        preserveFlatShading: true,
      });
      baseDark.color.multiplyScalar(0.76);
    }

    let wPreset = customCaveTex?.enabled && customCaveTex.weathering ? customCaveTex.weathering : 'none';
    let wIntensity = customCaveTex?.enabled ? customCaveTex.weatheringIntensity ?? 0.65 : 0.65;
    if (wPreset === 'none') {
      const tw = sampleTerrainWeathering(level.terrain, x, z);
      const candidates: Array<{ p: 'moss' | 'cracked' | 'scorched' | 'muddy' | 'snow'; v: number }> = [
        { p: 'cracked', v: tw.cracks },
        { p: 'moss', v: tw.moss },
        { p: 'scorched', v: tw.scorch },
        { p: 'muddy', v: tw.mud },
        { p: 'snow', v: tw.frost },
      ];
      let best = candidates[0];
      for (const c of candidates) {
        if (c.v > best.v) best = c;
      }
      if (best.v > 0.1) {
        wPreset = best.p;
        wIntensity = Math.min(1, best.v * 1.15);
      }
    }

    if (wPreset === 'none') {
      return { stone: baseStone as THREE.Material, dark: baseDark as THREE.Material };
    }

    const wrap = (src: THREE.MeshStandardMaterial, roughFallback: number): THREE.Material => {
      const base = getSharedWeatheringBaseMaterial({
        hasMap: Boolean(src.map),
        doubleSide: src.side === THREE.DoubleSide,
        transparent: src.transparent,
        vertexColors: src.vertexColors,
      });
      const inst = createMaterialVariantInstance(base, {
        colorHex: `#${src.color.getHexString()}`,
        roughness: src.roughness ?? roughFallback,
        metalness: src.metalness ?? 0.04,
        diffuseRoughness: 0.92,
        map: src.map ?? null,
        normalMap: src.normalMap ?? null,
        bumpMap: src.bumpMap ?? null,
        bumpScale: src.bumpScale ?? 1,
        weathering: wPreset,
        weatheringIntensity: wIntensity,
      });
      src.dispose();
      return inst;
    };

    return {
      stone: wrap(baseStone, 0.9),
      dark: wrap(baseDark, 0.94),
    };
  };

  const mossMat = enableDiffuseRoughnessEon(
    new THREE.MeshStandardMaterial({
      map: atlas.moss,
      color: '#4D8B4C',
      roughness: 0.84,
      flatShading: true,
    }),
    0.88
  ) as THREE.MeshStandardMaterial;
  const mossBrightMat = enableDiffuseRoughnessEon(
    new THREE.MeshStandardMaterial({
      map: atlas.moss,
      color: '#62A354',
      roughness: 0.82,
      flatShading: true,
    }),
    0.86
  ) as THREE.MeshStandardMaterial;

  const tagCaveId = (root: THREE.Object3D, caveId: string) => {
    root.userData.caveId = caveId;
    root.traverse((child) => {
      child.userData.caveId = caveId;
    });
  };

  const attachInteriorSpring = (
    parent: THREE.Group,
    depthSpan: number,
    widthSpan: number,
    flow: number
  ) => {
    const springMat = new MeshStandardNodeMaterial({
      color: new THREE.Color('#2AA8DF'),
      roughness: 0.16,
      metalness: 0.08,
      transparent: true,
      opacity: 0.82,
    });
    springMat.colorNode = Fn(() => {
      const p = positionLocal;
      const shimmer = sin(p.z.mul(2.4).add(uCaveTime.mul(2.5 * Math.max(0.2, flow)))).mul(0.08);
      return vec4(vec3(0.18, 0.68, 0.88).add(vec3(0.1, 0.14, 0.16).mul(shimmer)), 0.84);
    })();
    const creek = new THREE.Mesh(
      new THREE.PlaneGeometry(widthSpan * 0.46, depthSpan * 0.95, 8, 12),
      springMat
    );
    creek.rotation.x = -Math.PI / 2;
    creek.position.set(0, 0.06, -depthSpan * 0.35);
    parent.add(creek);
  };

  let builtMainMountainCave = false;
  for (const rawCave of caves) {
    const cave = normalizeCaveGrotto(rawCave);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: cave.crystalColor ?? '#6CE5FF',
      emissive: cave.crystalColor ?? '#38BDF8',
      emissiveIntensity: 1.45,
      roughness: 0.2,
    });

    // Primary reachable Mountain-Base Cave with full enterable interior
    if (!builtMainMountainCave && Math.hypot(cave.x - MountainCave.x, cave.z - MountainCave.z) < 6) {
      builtMainMountainCave = true;
      const mats = resolveCaveMaterialPair(cave.x, cave.z);
      const mainG = buildMountainCaveInterior(mats.stone, mats.dark, mossMat, mossBrightMat);
      mainG.scale.set(
        cave.entranceWidth ?? 1,
        cave.entranceHeight ?? 1,
        cave.cavityDepth ?? 1
      );
      if ((cave.crystalDensity ?? 0.5) > 0.1) {
        const extraCrystals = Math.round((cave.crystalDensity ?? 0.5) * 6);
        for (let ci = 0; ci < extraCrystals; ci++) {
          const crys = new THREE.Mesh(new THREE.OctahedronGeometry(0.28 + (ci % 3) * 0.08, 0), crystalMat);
          crys.position.set(
            (ci % 2 === 0 ? -1 : 1) * (3.1 + (ci % 3) * 0.45),
            0.7 + (ci % 2) * 0.35,
            -2.4 - ci * 1.15
          );
          crys.scale.set(0.7, 1.5, 0.7);
          mainG.add(crys);
        }
      }
      if (cave.hasSpring) {
        attachInteriorSpring(mainG, 10.5, 4.2, cave.springFlow ?? 0.75);
      }
      tagCaveId(mainG, cave.id);
      group.add(mainG);
      continue;
    }

    const mats = resolveCaveMaterialPair(cave.x, cave.z);
    const y = sampleLevelHeight(level, cave.x, cave.z);
    const g = new THREE.Group();
    g.position.set(cave.x, y, cave.z);
    g.rotation.y = cave.rotation;
    g.scale.setScalar(cave.scale);

    const ew = cave.entranceWidth ?? 1.0;
    const eh = cave.entranceHeight ?? 1.0;
    const cw = cave.cavityWidth ?? 1.0;
    const cd = cave.cavityDepth ?? 1.0;
    const archSharp = cave.archSharpness ?? 0.45;

    const pillarGeo = createFacetedRockGeometry(1.45, 1.0, 1.0, 1.0, 31);
    const leftP = new THREE.Mesh(pillarGeo, mats.stone);
    leftP.scale.set(0.95 + archSharp * 0.2, 1.8 * eh, 1.45 * cd);
    leftP.position.set(-1.65 * ew, 1.1 * eh, 0);
    leftP.castShadow = true;
    leftP.receiveShadow = true;

    const rightP = new THREE.Mesh(pillarGeo, mats.stone);
    rightP.scale.set(0.95 + archSharp * 0.2, 1.8 * eh, 1.45 * cd);
    rightP.position.set(1.65 * ew, 1.1 * eh, 0);
    rightP.castShadow = true;
    rightP.receiveShadow = true;

    const arch = new THREE.Mesh(createFacetedRockGeometry(1.85, 1.0, 1.0, 1.0, 41), mats.stone);
    arch.scale.set(1.65 * ew, (0.62 + archSharp * 0.35) * eh, 1.55 * cd);
    arch.position.set(0, 2.75 * eh, -0.2 * cd);
    arch.castShadow = true;

    const backWall = new THREE.Mesh(createFacetedRockGeometry(1.75, 1.0, 1.0, 1.0, 53), mats.dark);
    backWall.scale.set(1.45 * cw, 1.55 * eh, 0.9 * cd);
    backWall.position.set(0, 1.35 * eh, -1.9 * cd);
    backWall.castShadow = true;

    const sideWallL = new THREE.Mesh(pillarGeo, mats.dark);
    sideWallL.scale.set(0.75, 1.45 * eh, 1.75 * cd);
    sideWallL.position.set(-1.75 * cw, 1.2 * eh, -1.2 * cd);
    const sideWallR = sideWallL.clone();
    sideWallR.position.x = 1.75 * cw;

    const mossCap = new THREE.Mesh(createFacetedRockGeometry(1.5, 1.0, 1.0, 1.0, 67), mossMat);
    mossCap.scale.set(1.4 * ew, 0.35, 1.25 * cd);
    mossCap.position.set(0, 3.25 * eh, -0.15 * cd);

    g.add(leftP, rightP, arch, backWall, sideWallL, sideWallR, mossCap);

    // Stalactites
    const stalCount = Math.round((cave.stalactiteDensity ?? 0.65) * 6);
    if (stalCount > 0) {
      const stGeo = new THREE.ConeGeometry(0.16, 0.78, 7);
      for (let i = 0; i < stalCount; i++) {
        const st = new THREE.Mesh(stGeo, mats.dark);
        const rx = (((i * 37) % 10) / 10 - 0.5) * 1.9 * cw;
        const rz = -0.35 - ((i + 1) / (stalCount + 1)) * 1.45 * cd;
        st.position.set(rx, 2.25 * eh, rz);
        st.rotation.x = Math.PI;
        st.scale.setScalar(0.75 + (i % 3) * 0.25);
        g.add(st);
      }
    }

    // Stalagmites
    const stagCount = Math.round((cave.stalagmiteDensity ?? 0.5) * 5);
    if (stagCount > 0) {
      const smGeo = new THREE.ConeGeometry(0.2, 0.9, 7);
      for (let i = 0; i < stagCount; i++) {
        const sm = new THREE.Mesh(smGeo, mats.dark);
        const side = i % 2 === 0 ? -1 : 1;
        sm.position.set(side * (0.9 + (i % 2) * 0.4) * cw, 0.42, -0.4 - i * 0.28 * cd);
        sm.scale.setScalar(0.75 + (i % 3) * 0.22);
        g.add(sm);
      }
    }

    // Glowing Crystals
    const cryCount = Math.max(0, Math.round((cave.crystalDensity ?? 0.5) * 5));
    for (let i = 0; i < cryCount; i++) {
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 0), crystalMat);
      crystal.position.set(
        (((i * 29) % 10) / 10 - 0.5) * 1.4 * cw,
        0.55 + (i % 2) * 0.2,
        -0.55 - (i / Math.max(1, cryCount)) * 1.15 * cd
      );
      crystal.scale.set(0.75, 1.45, 0.75);
      crystal.rotation.set((i % 3) * 0.2, i * 0.8, 0.15);
      g.add(crystal);
    }

    // Optional Interior Spring / Creek
    if (cave.hasSpring) {
      attachInteriorSpring(g, 2.2 * cd, 1.8 * cw, cave.springFlow ?? 0.75);
    }

    tagCaveId(g, cave.id);
    group.add(g);
  }

  return group;
}

// Sculpted Mid-Detail Rock Geometry Builder (finer curved stylized facets without blocky corners)

function createFacetedRockGeometry(
  radius: number,
  sx = 1.2,
  sy = 0.82,
  sz = 1.05,
  seed = 7
): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(radius, 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const len = Math.max(0.0001, Math.hypot(x, y, z));
    const nx = x / len;
    const ny = y / len;
    const nz = z / len;
    // Continuous multi-frequency directional carving so facets curve organically around the rock
    const w1 = Math.sin(nx * 2.9 + seed * 1.1) * Math.cos(nz * 2.7 - seed * 0.6) * 0.14;
    const w2 = Math.cos(ny * 3.8 + nx * 2.2 + seed * 0.4) * 0.08;
    const w3 = Math.sin((nx - nz) * 4.5 + ny * 3.1 + seed) * 0.045;
    const radial = 0.94 + w1 + w2 + w3;
    // Subtle flattened weathered shelf on top and broad seated base
    const curvedY =
      y > radius * 0.52
        ? radius * 0.54 + (y - radius * 0.52) * 0.42
        : y < -radius * 0.45
        ? -radius * 0.45 + (y + radius * 0.45) * 0.55
        : y;
    pos.setXYZ(i, x * sx * radial, curvedY * sy * (0.96 + w2 * 0.4), z * sz * radial);
  }
  geo.computeVertexNormals();
  applySeamlessBoxUVs(geo, 0.78);
  return geo;
}

// Gracefully curved, arching botanical reed blade
function createCurvedReedBladeGeometry(
  baseWidth: number,
  height: number,
  archDist: number,
  rotY: number
): THREE.BufferGeometry {
  const segs = 5;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const w = baseWidth * (1 - t * 0.88) * (0.82 + Math.sin(t * Math.PI) * 0.25);
    const y = -0.18 + t * height;
    const bend = t * t * archDist;
    const lx = bend;
    const lzL = -w * 0.5;
    const lzR = w * 0.5;
    const rxL = lx * c - lzL * s;
    const rzL = lx * s + lzL * c;
    const rxR = lx * c - lzR * s;
    const rzR = lx * s + lzR * c;
    positions.push(rxL, y, rzL, rxR, y, rzR);
    uvs.push(0, t, 1, t);
    if (i < segs) {
      const b = i * 2;
      indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Detailed multi-petal sculpted 3D wildflower (curved stem, 2 arched leaves, 6 individual cupped petals, domed pollen cushion)
function createDetailedWildflowerGeometries(): {
  stemGeo: THREE.BufferGeometry;
  leafGeo: THREE.BufferGeometry;
  petalGeo: THREE.BufferGeometry;
  centerGeo: THREE.BufferGeometry;
} {
  // 1. Gently arched slender tapered stem
  const stemGeo = new THREE.CylinderGeometry(0.018, 0.032, 0.56, 7, 5);
  stemGeo.translate(0, 0.16, 0);
  const sPos = stemGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < sPos.count; i++) {
    const y = sPos.getY(i);
    const t = Math.max(0, (y + 0.12) / 0.56);
    sPos.setX(i, sPos.getX(i) + Math.sin(t * Math.PI * 0.65) * 0.045);
  }
  stemGeo.computeVertexNormals();

  // 2. Pair of gracefully arched, pointed cupped basal leaves
  const leafPositions: number[] = [];
  const leafUvs: number[] = [];
  const leafIndices: number[] = [];
  const addArchedLeaf = (yaw: number, len: number, maxW: number, rise: number, yStart: number) => {
    const segs = 4;
    const baseVert = leafPositions.length / 3;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const dist = t * len;
      const y = yStart + Math.sin(t * Math.PI * 0.72) * rise - t * t * rise * 0.35;
      const halfW = Math.sin(Math.pow(t, 0.72) * Math.PI) * maxW;
      const cup = halfW * 0.28;
      // Left edge, center mid-rib, right edge for genuine 3D V-cupped botanical leaf
      const pts: [number, number, number][] = [
        [dist, y + cup, -halfW],
        [dist, y, 0],
        [dist, y + cup, halfW],
      ];
      for (let k = 0; k < 3; k++) {
        const [lx, ly, lz] = pts[k];
        leafPositions.push(lx * cy - lz * sy, ly, lx * sy + lz * cy);
        leafUvs.push(k * 0.5, t);
      }
      if (i < segs) {
        const r0 = baseVert + i * 3;
        const r1 = baseVert + (i + 1) * 3;
        leafIndices.push(r0, r0 + 1, r1, r0 + 1, r1 + 1, r1);
        leafIndices.push(r0 + 1, r0 + 2, r1 + 1, r0 + 2, r1 + 2, r1 + 1);
      }
    }
  };
  addArchedLeaf(0.25, 0.28, 0.068, 0.14, 0.04);
  addArchedLeaf(3.25, 0.24, 0.06, 0.12, 0.08);
  const leafGeo = new THREE.BufferGeometry();
  leafGeo.setAttribute('position', new THREE.Float32BufferAttribute(leafPositions, 3));
  leafGeo.setAttribute('uv', new THREE.Float32BufferAttribute(leafUvs, 2));
  leafGeo.setIndex(leafIndices);
  leafGeo.computeVertexNormals();

  // 3. Six individual cupped, overlapping 3D blossom petals around the flower crown
  const petalPositions: number[] = [];
  const petalUvs: number[] = [];
  const petalIndices: number[] = [];
  const petalCount = 6;
  const crownX = 0.042;
  const crownY = 0.43;

  for (let p = 0; p < petalCount; p++) {
    const yaw = (p / petalCount) * Math.PI * 2;
    const altLift = (p % 2 === 0 ? 0.014 : -0.004);
    const petalLen = 0.215;
    const maxHalfW = 0.078;
    const segs = 4;
    const baseVert = petalPositions.length / 3;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);

    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const dist = 0.032 + t * petalLen;
      // Softly cupped upward bell curve with delicate tip flare
      const y = crownY + altLift + Math.sin(t * Math.PI * 0.78) * 0.052 + t * 0.018;
      // Rounded obovate petal silhouette (narrow claw -> broad rounded blade -> soft tip)
      const shapeW = Math.sin(Math.pow(t, 0.62) * Math.PI) * (0.65 + 0.35 * Math.sin(t * Math.PI));
      const halfW = Math.max(0.004, shapeW * maxHalfW);
      const cupLift = halfW * 0.34;
      const pts: [number, number, number][] = [
        [dist, y + cupLift, -halfW],
        [dist, y, 0],
        [dist, y + cupLift, halfW],
      ];
      for (let k = 0; k < 3; k++) {
        const [lx, ly, lz] = pts[k];
        petalPositions.push(crownX + lx * cy - lz * sy, ly, lx * sy + lz * cy);
        petalUvs.push(k * 0.5, t);
      }
      if (i < segs) {
        const r0 = baseVert + i * 3;
        const r1 = baseVert + (i + 1) * 3;
        petalIndices.push(r0, r0 + 1, r1, r0 + 1, r1 + 1, r1);
        petalIndices.push(r0 + 1, r0 + 2, r1 + 1, r0 + 2, r1 + 2, r1 + 1);
      }
    }
  }
  const petalGeo = new THREE.BufferGeometry();
  petalGeo.setAttribute('position', new THREE.Float32BufferAttribute(petalPositions, 3));
  petalGeo.setAttribute('uv', new THREE.Float32BufferAttribute(petalUvs, 2));
  petalGeo.setIndex(petalIndices);
  petalGeo.computeVertexNormals();

  // 4. Rounded golden pollen cushion
  const centerGeo = new THREE.SphereGeometry(0.064, 10, 7);
  centerGeo.scale(1, 0.58, 1);
  centerGeo.translate(crownX, crownY + 0.025, 0);

  return { stemGeo, leafGeo, petalGeo, centerGeo };
}

function createScatterBuildPlan(
  level: GameLevel,
  terrain: TerrainData,
  scatter: ScatterItem[],
  style: VisualStyleId,
  timeUniform: { value: number },
  windUniform: { value: number },
  customAssets: CustomAssetMeta[],
  instancedGroup: THREE.Group,
  _customScatterGroups: THREE.Group,
  choppableTrees: ChoppableTreeHandle[],
  harvestableScatter: HarvestableScatterHandle[],
  worldMapContext?: WorldMapRenderContext
) {
  const biome = getBiome(level.biome);
  const atlas = getTerrainTextureAtlas();

  const addBatchMeshes = (...meshes: THREE.Object3D[]) => {
    for (const m of meshes) {
      applyBotwStyleToObject(m, style, { rimStrengthScale: 0.82, shadowLiftScale: 0.85 });
      instancedGroup.add(m);
    }
  };

  // Sample exact rendered terrain height using lowest footprint corner so nothing floats on slopes/cliffs
  const groundAt = (x: number, z: number, footprintRadius = 0): { y: number; maxSlope: number } => {
    const center = sampleTerrainHeight(terrain, x, z);
    if (footprintRadius <= 0) return { y: center, maxSlope: 0 };
    const hN = sampleTerrainHeight(terrain, x, z - footprintRadius);
    const hS = sampleTerrainHeight(terrain, x, z + footprintRadius);
    const hE = sampleTerrainHeight(terrain, x + footprintRadius, z);
    const hW = sampleTerrainHeight(terrain, x - footprintRadius, z);
    const minH = Math.min(center, hN, hS, hE, hW);
    const maxH = Math.max(center, hN, hS, hE, hW);
    return { y: minH, maxSlope: maxH - minH };
  };

  const pines: ScatterItem[] = [];
  const oaks: ScatterItem[] = [];
  const birches: ScatterItem[] = [];
  const stylizedCanopyTrees: { item: ScatterItem; y: number; config: NonNullable<GameLevel['canopyEngine']> }[] = [];
  const rocks: ScatterItem[] = [];
  const flowers: ScatterItem[] = [];
  const bushes: ScatterItem[] = [];
  const berryBushes: ScatterItem[] = [];
  const ferns: ScatterItem[] = [];
  const broadleafs: ScatterItem[] = [];
  const mushrooms: ScatterItem[] = [];
  const reeds: ScatterItem[] = [];
  const cattails: ScatterItem[] = [];
  const tallGrasses: ScatterItem[] = [];
  const customItems: ScatterItem[] = [];

  const canopyCfg = level.canopyEngine;
  const canopyActive = Boolean(canopyCfg?.enabled && canopyCfg.targetTrees !== 'placedOnly');
  const activeType = canopyCfg?.treeType ?? 'oak';
  const coniferProfile = canopyCfg ? resolveSpeciesConfig(canopyCfg, 'conifer') : null;
  const oakProfile = canopyCfg
    ? activeType === 'fantasy' || activeType === 'custom'
      ? canopyCfg
      : resolveSpeciesConfig(canopyCfg, 'oak')
    : null;
  const birchProfile = canopyCfg ? resolveSpeciesConfig(canopyCfg, 'birch') : null;

  const filterOtherLand =
    worldMapContext?.mode === 'land' &&
    Boolean(worldMapContext.worldMap) &&
    (worldMapContext.activeRegionCode ?? 0) > 0;
  const activeOriginX = worldMapContext?.activeRegionOrigin?.[0] ?? 0;
  const activeOriginZ = worldMapContext?.activeRegionOrigin?.[1] ?? 0;

  for (const item of scatter) {
    if (filterOtherLand && worldMapContext?.worldMap) {
      const wmSample = sampleWorldMapAtWorld(
        worldMapContext.worldMap,
        activeOriginX + item.x,
        activeOriginZ + item.z
      );
      if (wmSample.land === 1 && wmSample.regionCode !== worldMapContext.activeRegionCode) {
        continue;
      }
    }
    const { y } = groundAt(item.x, item.z);
    const minY =
      item.kind === 'reed' || item.kind === 'cattail' || item.kind === 'rock'
        ? IslandTerrain.waterLevel - 0.85
        : IslandTerrain.waterLevel + 0.15;
    if (y < minY) continue;

    if (item.kind === 'pine' || item.kind === 'tree') {
      if (canopyActive && canopyCfg && (canopyCfg.targetTrees === 'all' || canopyCfg.targetTrees === 'matching')) {
        const { y: groundY } = groundAt(item.x, item.z, 0.25);
        stylizedCanopyTrees.push({
          item,
          y: groundY,
          config: canopyCfg.targetTrees === 'matching' && coniferProfile ? coniferProfile : canopyCfg,
        });
      } else {
        pines.push(item);
      }
    } else if (item.kind === 'oak') {
      if (
        canopyActive &&
        canopyCfg &&
        (canopyCfg.targetTrees === 'matching' ||
          canopyCfg.targetTrees === 'broadleaf' ||
          canopyCfg.targetTrees === 'oak' ||
          canopyCfg.targetTrees === 'all')
      ) {
        const { y: groundY } = groundAt(item.x, item.z, 0.25);
        stylizedCanopyTrees.push({
          item,
          y: groundY,
          config: canopyCfg.targetTrees === 'matching' && oakProfile ? oakProfile : canopyCfg,
        });
      } else {
        oaks.push(item);
      }
    } else if (item.kind === 'birch') {
      if (
        canopyActive &&
        canopyCfg &&
        (canopyCfg.targetTrees === 'matching' ||
          canopyCfg.targetTrees === 'broadleaf' ||
          canopyCfg.targetTrees === 'all')
      ) {
        const { y: groundY } = groundAt(item.x, item.z, 0.22);
        stylizedCanopyTrees.push({
          item,
          y: groundY,
          config: canopyCfg.targetTrees === 'matching' && birchProfile ? birchProfile : canopyCfg,
        });
      } else {
        birches.push(item);
      }
    } else if (item.kind === 'rock') rocks.push(item);
    else if (item.kind === 'flower') flowers.push(item);
    else if (item.kind === 'bush') bushes.push(item);
    else if (item.kind === 'berryBush') berryBushes.push(item);
    else if (item.kind === 'fern') ferns.push(item);
    else if (item.kind === 'broadleaf') broadleafs.push(item);
    else if (item.kind === 'mushroom') mushrooms.push(item);
    else if (item.kind === 'reed') reeds.push(item);
    else if (item.kind === 'cattail') cattails.push(item);
    else if (item.kind === 'tallGrass') tallGrasses.push(item);
    else if (item.kind === 'custom') customItems.push(item);
  }

  const baseLeafCol = new THREE.Color(biome.ground).lerp(new THREE.Color('#52A441'), 0.58);
  const fallbackLeafHex = `#${baseLeafCol.getHexString()}`;
  const pushForestRecords = (
    records: ReturnType<typeof buildProceduralCanopyForest>['records']
  ) => {
    for (const rec of records) {
      choppableTrees.push({
        id: rec.item.id,
        kind: rec.item.kind === 'pine' ? 'pine' : rec.item.kind === 'birch' ? 'birch' : 'oak',
        x: rec.item.x,
        y: rec.y,
        z: rec.item.z,
        size: rec.item.size,
        rotation: rec.item.rotation,
        colorHex: rec.colorHex,
        instanceIndex: -1,
        meshes: [],
        treeGroup: rec.treeGroup,
        hp: 3,
        maxHp: 3,
        chopped: false,
        shakeTimer: 0,
        shakeDirX: 0,
        shakeDirZ: 1,
      });
    }
  };
  const batchSteps: DeferredStep[] = [];

  const sceneryTex = level.sceneryTextures;
  const applySlotTex = (
    mat: THREE.Material,
    slot: SceneryTextureSlot,
    baseTintHex?: string,
    preserveFlatShading = false
  ): boolean => {
    const st = sceneryTex?.[slot];
    if (!st?.enabled || !st.textureId) return false;
    return applySurfaceTextureToMaterial(
      mat as THREE.MeshStandardMaterial | THREE.MeshToonMaterial,
      st,
      {
        baseTintHex,
        isToon: false,
        preserveFlatShading,
      }
    );
  };
  const slotTintWeight = (slot: SceneryTextureSlot, fallback = 0.2): number => {
    const st = sceneryTex?.[slot];
    if (!st?.enabled || !st.textureId) return 1.0;
    return THREE.MathUtils.clamp(st.tintStrength ?? fallback, 0, 1);
  };
  const slotWeatherCfg = (slot?: SceneryTextureSlot) => {
    const st = slot ? sceneryTex?.[slot] : undefined;
    return {
      weathering: st?.enabled ? st.weathering ?? 'none' : 'none',
      weatheringIntensity: st?.enabled ? st.weatheringIntensity ?? 0.65 : 0.65,
      diffuseRoughnessOverride:
        st?.enabled && typeof st.diffuseRoughness === 'number' ? st.diffuseRoughness : undefined,
      roughnessOverride:
        st?.enabled && typeof st.roughness === 'number' ? st.roughness : undefined,
    };
  };
  const whiteCol = new THREE.Color('#FFFFFF');
  const blendInstColor = (c: THREE.Color, weight: number): THREE.Color =>
    weight >= 0.99 ? c : whiteCol.clone().lerp(c, weight);

  const makeBatchMat = (opts: {
    color: string;
    roughness: number;
    diffuseRoughness?: number;
    doubleSide?: boolean;
    map?: THREE.Texture | null;
    bumpMap?: THREE.Texture | null;
    bumpScale?: number;
    slot?: SceneryTextureSlot;
    baseTintHex?: string;
    preserveFlatShading?: boolean;
  }) => {
    const wCfg = slotWeatherCfg(opts.slot);
    const mat = createScatterBatchMaterialInstance({
      style,
      timeUniform,
      color: opts.color,
      roughness: wCfg.roughnessOverride ?? opts.roughness,
      diffuseRoughness: wCfg.diffuseRoughnessOverride ?? opts.diffuseRoughness ?? 0.55,
      doubleSide: opts.doubleSide,
      map: opts.map ?? null,
      bumpMap: opts.bumpMap ?? null,
      bumpScale: opts.bumpScale ?? 0.1,
      weathering: wCfg.weathering,
      weatheringIntensity: wCfg.weatheringIntensity,
    });
    if (opts.slot) {
      applySlotTex(mat, opts.slot, opts.baseTintHex, opts.preserveFlatShading);
    }
    return mat;
  };

  const dummy = new THREE.Object3D();
  const col = new THREE.Color();

  // 1. PINE TREES (BatchedMesh trunk + batched 5 sculpted needle tiers with shared referenceAttribute wind shader)
  if (pines.length > 0) {
    batchSteps.push({
      label: 'pines',
      run: () => {
    const trunkGeo = normalizeGeometryForBatch(
      createOrganicTrunkGeometry({
        rTop: 0.11,
        rBottom: 0.34,
        height: 2.9,
        yOffset: -0.35,
        radialSegs: 14,
        heightSegs: 8,
        rootCount: 5,
        rootFlare: 0.36,
        curveX: 0.06,
        curveZ: 0.04,
        barkFlute: 0.05,
        uvScaleU: 2.2,
        uvScaleV: 2.6,
      }),
      0
    );
    const t1Raw = createDetailedPineTierGeometry(1.62, 1.52, 11, 1);
    t1Raw.translate(0, 2.15, 0);
    const t2Raw = createDetailedPineTierGeometry(1.38, 1.42, 11, 2);
    t2Raw.rotateY(0.29);
    t2Raw.translate(0, 2.95, 0);
    const t3Raw = createDetailedPineTierGeometry(1.12, 1.32, 10, 3);
    t3Raw.rotateY(0.61);
    t3Raw.translate(0, 3.7, 0);
    const t4Raw = createDetailedPineTierGeometry(0.84, 1.18, 9, 4);
    t4Raw.rotateY(0.95);
    t4Raw.translate(0, 4.38, 0);
    const t5Raw = createDetailedPineTierGeometry(0.52, 0.98, 7, 5);
    t5Raw.rotateY(0.42);
    t5Raw.translate(0, 4.98, 0);

    const tierGeos = [t1Raw, t2Raw, t3Raw, t4Raw, t5Raw].map((g) =>
      normalizeGeometryForBatch(g, 0.045, 0)
    );

    const pineBarkMat = makeBatchMat({
      color: '#FFFFFF',
      roughness: 0.9,
      diffuseRoughness: 0.9,
      map: atlas.pineBark,
      bumpMap: atlas.pineBarkBump,
      bumpScale: 0.14,
      slot: 'treeBark',
    });
    const leafMat = makeBatchMat({
      color: '#FFFFFF',
      roughness: 0.82,
      diffuseRoughness: 0.45,
      map: atlas.pineLeaves,
      bumpMap: atlas.pineLeavesBump,
      bumpScale: 0.12,
      slot: 'treeCanopy',
    });
    const pineCanopyTintW = slotTintWeight('treeCanopy', 0.25);

    const trunkEntries: BatchInstanceSpec[] = [];
    const tierEntries: BatchInstanceSpec[] = [];
    const treeMeta: { x: number; y: number; z: number; item: ScatterItem; colorHex: string }[] = [];

    const basePine = new THREE.Color(biome.detail).lerp(new THREE.Color('#4B9E3D'), 0.68);
    pines.forEach((item, i) => {
      const { y } = groundAt(item.x, item.z, 0.25);
      dummy.position.set(item.x, y, item.z);
      dummy.rotation.set(0, item.rotation, 0);
      dummy.scale.setScalar(item.size * 1.15);
      dummy.updateMatrix();
      const mat4 = dummy.matrix.clone();

      trunkEntries.push({ geoIndex: 0, matrix: mat4, color: whiteCol });

      col.copy(basePine).offsetHSL(((i % 5) - 2) * 0.014, 0.04, ((i % 3) - 1) * 0.035);
      tierEntries.push(
        { geoIndex: 0, matrix: mat4, color: blendInstColor(col.clone().offsetHSL(0, 0, -0.02), pineCanopyTintW) },
        { geoIndex: 1, matrix: mat4, color: blendInstColor(col.clone().offsetHSL(0.006, 0, 0.02), pineCanopyTintW) },
        { geoIndex: 2, matrix: mat4, color: blendInstColor(col.clone().offsetHSL(0.012, 0, 0.055), pineCanopyTintW) },
        { geoIndex: 3, matrix: mat4, color: blendInstColor(col.clone().offsetHSL(0.016, 0, 0.085), pineCanopyTintW) },
        { geoIndex: 4, matrix: mat4, color: blendInstColor(col.clone().offsetHSL(0.02, 0, 0.115), pineCanopyTintW) }
      );
      treeMeta.push({ x: item.x, y, z: item.z, item, colorHex: `#${col.getHexString()}` });
    });

    const trunkBatch = buildBatchedGeometryInstances({
      geometries: [trunkGeo],
      material: pineBarkMat,
      entries: trunkEntries,
      castShadow: true,
      receiveShadow: true,
    });
    const tierBatch = buildBatchedGeometryInstances({
      geometries: tierGeos,
      material: leafMat,
      entries: tierEntries,
      castShadow: true,
      receiveShadow: true,
    });
    addBatchMeshes(trunkBatch.batchedMesh, tierBatch.batchedMesh);

    treeMeta.forEach((m, i) => {
      choppableTrees.push({
        id: m.item.id,
        kind: 'pine',
        x: m.x,
        y: m.y,
        z: m.z,
        size: m.item.size,
        rotation: m.item.rotation,
        colorHex: m.colorHex,
        instanceIndex: -1,
        meshes: [],
        batchedEntries: [
          trunkBatch.entryRefs[i],
          tierBatch.entryRefs[i * 5 + 0],
          tierBatch.entryRefs[i * 5 + 1],
          tierBatch.entryRefs[i * 5 + 2],
          tierBatch.entryRefs[i * 5 + 3],
          tierBatch.entryRefs[i * 5 + 4],
        ],
        hp: 3,
        maxHp: 3,
        chopped: false,
        shakeTimer: 0,
        shakeDirX: 0,
        shakeDirZ: 1,
      });
    });
      },
    });
  }

  // 2. OAK TREES (BatchedMesh trunk + 5 sculpted leaf-textured canopy lobes)
  if (oaks.length > 0) {
    batchSteps.push({
      label: 'oaks',
      run: () => {
    const trunkGeo = normalizeGeometryForBatch(
      createOrganicTrunkGeometry({
        rTop: 0.22,
        rBottom: 0.44,
        height: 2.5,
        yOffset: -0.35,
        radialSegs: 14,
        heightSegs: 9,
        rootCount: 5,
        rootFlare: 0.42,
        curveX: 0.12,
        curveZ: 0.07,
        barkFlute: 0.07,
        uvScaleU: 2.2,
        uvScaleV: 2.4,
        branches: [
          { startY: 1.55, length: 1.25, rBottom: 0.16, rTop: 0.075, tilt: 0.62, yaw: 0.55, bend: 0.09 },
          { startY: 1.65, length: 1.18, rBottom: 0.15, rTop: 0.07, tilt: 0.58, yaw: 2.65, bend: 0.08 },
          { startY: 1.75, length: 1.08, rBottom: 0.14, rTop: 0.065, tilt: 0.52, yaw: -1.45, bend: 0.07 },
        ],
      }),
      0
    );

    const crown1Geo = createSculptedCanopyLobeGeometry(1.36, 1.24, 0.88, 1.18, 1.2, 20, 14, 2.8, 1.9);
    crown1Geo.translate(0.05, 3.18, 0.02);
    const crown2Geo = createSculptedCanopyLobeGeometry(1.04, 1.12, 0.86, 1.06, 2.7, 18, 12, 2.4, 1.7);
    crown2Geo.translate(0.86, 2.76, 0.52);
    const crown3Geo = createSculptedCanopyLobeGeometry(0.98, 1.08, 0.88, 1.04, 4.1, 18, 12, 2.4, 1.7);
    crown3Geo.translate(-0.82, 2.82, -0.44);
    const crown4Geo = createSculptedCanopyLobeGeometry(0.92, 1.08, 0.84, 1.06, 5.6, 16, 12, 2.3, 1.6);
    crown4Geo.translate(-0.28, 2.68, 0.86);
    const crown5Geo = createSculptedCanopyLobeGeometry(0.86, 1.1, 0.88, 1.04, 7.3, 16, 12, 2.2, 1.6);
    crown5Geo.translate(0.32, 3.68, -0.26);

    const crownGeos = [crown1Geo, crown2Geo, crown3Geo, crown4Geo, crown5Geo].map((g) =>
      normalizeGeometryForBatch(g, 0.045, 0)
    );

    const oakBarkMat = makeBatchMat({
      color: '#FFFFFF',
      roughness: 0.9,
      diffuseRoughness: 0.9,
      map: atlas.oakBark,
      bumpMap: atlas.oakBarkBump,
      bumpScale: 0.16,
      slot: 'treeBark',
    });
    const oakLeafMat = makeBatchMat({
      color: '#FFFFFF',
      roughness: 0.8,
      diffuseRoughness: 0.45,
      map: atlas.oakLeaves,
      bumpMap: atlas.oakLeavesBump,
      bumpScale: 0.13,
      slot: 'treeCanopy',
    });
    const oakCanopyTintW = slotTintWeight('treeCanopy', 0.25);

    const trunkEntries: BatchInstanceSpec[] = [];
    const crownEntries: BatchInstanceSpec[] = [];
    const treeMeta: { x: number; y: number; z: number; item: ScatterItem; colorHex: string }[] = [];

    const baseOak = new THREE.Color(biome.ground).lerp(new THREE.Color('#52A441'), 0.58);
    oaks.forEach((item, i) => {
      const { y } = groundAt(item.x, item.z, 0.25);
      dummy.position.set(item.x, y, item.z);
      dummy.rotation.set(0, item.rotation, 0);
      dummy.scale.setScalar(item.size * 1.15);
      dummy.updateMatrix();
      const mat4 = dummy.matrix.clone();

      trunkEntries.push({ geoIndex: 0, matrix: mat4, color: whiteCol });
      col.copy(baseOak).offsetHSL(((i % 5) - 2) * 0.018, 0, ((i % 3) - 1) * 0.045);
      crownEntries.push(
        { geoIndex: 0, matrix: mat4, color: blendInstColor(col, oakCanopyTintW) },
        { geoIndex: 1, matrix: mat4, color: blendInstColor(col.clone().offsetHSL(0.014, 0, 0.04), oakCanopyTintW) },
        { geoIndex: 2, matrix: mat4, color: blendInstColor(col.clone().offsetHSL(-0.014, 0, -0.025), oakCanopyTintW) },
        { geoIndex: 3, matrix: mat4, color: blendInstColor(col.clone().offsetHSL(0.008, 0, -0.035), oakCanopyTintW) },
        { geoIndex: 4, matrix: mat4, color: blendInstColor(col.clone().offsetHSL(0.02, 0, 0.07), oakCanopyTintW) }
      );
      treeMeta.push({ x: item.x, y, z: item.z, item, colorHex: `#${col.getHexString()}` });
    });

    const trunkBatch = buildBatchedGeometryInstances({
      geometries: [trunkGeo],
      material: oakBarkMat,
      entries: trunkEntries,
      castShadow: true,
      receiveShadow: true,
    });
    const crownBatch = buildBatchedGeometryInstances({
      geometries: crownGeos,
      material: oakLeafMat,
      entries: crownEntries,
      castShadow: true,
      receiveShadow: true,
    });
    addBatchMeshes(trunkBatch.batchedMesh, crownBatch.batchedMesh);

    treeMeta.forEach((m, i) => {
      choppableTrees.push({
        id: m.item.id,
        kind: 'oak',
        x: m.x,
        y: m.y,
        z: m.z,
        size: m.item.size,
        rotation: m.item.rotation,
        colorHex: m.colorHex,
        instanceIndex: -1,
        meshes: [],
        batchedEntries: [
          trunkBatch.entryRefs[i],
          crownBatch.entryRefs[i * 5 + 0],
          crownBatch.entryRefs[i * 5 + 1],
          crownBatch.entryRefs[i * 5 + 2],
          crownBatch.entryRefs[i * 5 + 3],
          crownBatch.entryRefs[i * 5 + 4],
        ],
        hp: 3,
        maxHp: 3,
        chopped: false,
        shakeTimer: 0,
        shakeDirX: 0,
        shakeDirZ: 1,
      });
    });
      },
    });
  }

  // 3. BIRCH TREES (BatchedMesh papery trunk + 4 sculpted birch leaf plumes)
  if (birches.length > 0) {
    batchSteps.push({
      label: 'birches',
      run: () => {
    const trunkGeo = normalizeGeometryForBatch(
      createOrganicTrunkGeometry({
        rTop: 0.095,
        rBottom: 0.22,
        height: 3.15,
        yOffset: -0.25,
        radialSegs: 12,
        heightSegs: 9,
        rootCount: 4,
        rootFlare: 0.28,
        curveX: 0.13,
        curveZ: -0.06,
        barkFlute: 0.03,
        uvScaleU: 1.65,
        uvScaleV: 2.8,
        branches: [
          { startY: 1.95, length: 1.15, rBottom: 0.085, rTop: 0.038, tilt: 0.44, yaw: 0.85, bend: 0.08 },
          { startY: 2.2, length: 0.98, rBottom: 0.075, rTop: 0.035, tilt: 0.4, yaw: -2.1, bend: 0.07 },
        ],
      }),
      0
    );
    const leaf1Geo = createSculptedCanopyLobeGeometry(0.98, 0.96, 1.24, 0.94, 3.1, 18, 12, 2.8, 2.0);
    leaf1Geo.translate(0.12, 3.45, -0.04);
    const leaf2Geo = createSculptedCanopyLobeGeometry(0.74, 0.98, 1.12, 0.96, 5.4, 16, 12, 2.4, 1.8);
    leaf2Geo.translate(0.56, 2.9, -0.34);
    const leaf3Geo = createSculptedCanopyLobeGeometry(0.68, 0.95, 1.08, 0.94, 8.2, 16, 12, 2.3, 1.7);
    leaf3Geo.translate(-0.48, 3.02, 0.36);
    const leaf4Geo = createSculptedCanopyLobeGeometry(0.62, 0.92, 1.18, 0.92, 11.1, 14, 10, 2.2, 1.7);
    leaf4Geo.translate(0.06, 4.18, 0.08);

    const leafGeos = [leaf1Geo, leaf2Geo, leaf3Geo, leaf4Geo].map((g) =>
      normalizeGeometryForBatch(g, 0.065, 0)
    );

    const trunkMat = makeBatchMat({
      color: '#FFFFFF',
      roughness: 0.74,
      diffuseRoughness: 0.86,
      map: atlas.birchBark,
      bumpMap: atlas.birchBarkBump,
      bumpScale: 0.09,
      slot: 'treeBark',
    });
    const leafMat = makeBatchMat({
      color: '#FFFFFF',
      roughness: 0.74,
      diffuseRoughness: 0.42,
      map: atlas.birchLeaves,
      bumpMap: atlas.birchLeavesBump,
      bumpScale: 0.11,
      slot: 'treeCanopy',
    });
    const birchCanopyTintW = slotTintWeight('treeCanopy', 0.25);

    const trunkEntries: BatchInstanceSpec[] = [];
    const leafEntries: BatchInstanceSpec[] = [];
    const treeMeta: { x: number; y: number; z: number; item: ScatterItem; colorHex: string }[] = [];

    const baseBirch = new THREE.Color(biome.ground).lerp(new THREE.Color('#86CF4D'), 0.65);
    birches.forEach((item, i) => {
      const { y } = groundAt(item.x, item.z, 0.2);
      dummy.position.set(item.x, y, item.z);
      dummy.rotation.set(0, item.rotation, 0);
      dummy.scale.setScalar(item.size * 1.15);
      dummy.updateMatrix();
      const mat4 = dummy.matrix.clone();

      trunkEntries.push({ geoIndex: 0, matrix: mat4, color: whiteCol });
      col.copy(baseBirch).offsetHSL(((i % 4) - 1.5) * 0.02, 0, ((i % 3) - 1) * 0.05);
      leafEntries.push(
        { geoIndex: 0, matrix: mat4, color: blendInstColor(col, birchCanopyTintW) },
        { geoIndex: 1, matrix: mat4, color: blendInstColor(col.clone().offsetHSL(0.018, 0, 0.045), birchCanopyTintW) },
        { geoIndex: 2, matrix: mat4, color: blendInstColor(col.clone().offsetHSL(-0.012, 0, -0.02), birchCanopyTintW) },
        { geoIndex: 3, matrix: mat4, color: blendInstColor(col.clone().offsetHSL(0.024, 0, 0.075), birchCanopyTintW) }
      );
      treeMeta.push({ x: item.x, y, z: item.z, item, colorHex: `#${col.getHexString()}` });
    });

    const trunkBatch = buildBatchedGeometryInstances({
      geometries: [trunkGeo],
      material: trunkMat,
      entries: trunkEntries,
      castShadow: true,
      receiveShadow: true,
    });
    const leafBatch = buildBatchedGeometryInstances({
      geometries: leafGeos,
      material: leafMat,
      entries: leafEntries,
      castShadow: true,
      receiveShadow: true,
    });
    addBatchMeshes(trunkBatch.batchedMesh, leafBatch.batchedMesh);

    treeMeta.forEach((m, i) => {
      choppableTrees.push({
        id: m.item.id,
        kind: 'birch',
        x: m.x,
        y: m.y,
        z: m.z,
        size: m.item.size,
        rotation: m.item.rotation,
        colorHex: m.colorHex,
        instanceIndex: -1,
        meshes: [],
        batchedEntries: [
          trunkBatch.entryRefs[i],
          leafBatch.entryRefs[i * 4 + 0],
          leafBatch.entryRefs[i * 4 + 1],
          leafBatch.entryRefs[i * 4 + 2],
          leafBatch.entryRefs[i * 4 + 3],
        ],
        hp: 3,
        maxHp: 3,
        chopped: false,
        shakeTimer: 0,
        shakeDirX: 0,
        shakeDirZ: 1,
      });
    });
      },
    });
  }

  // 4. RIVERBANK REEDS (BatchedMesh 3 arching blades merged per geometry range)
  if (reeds.length > 0) {
    batchSteps.push({
      label: 'reeds',
      run: () => {
    const blade1Geo = createCurvedReedBladeGeometry(0.09, 1.72, 0.34, 0.2);
    blade1Geo.translate(-0.08, 0, 0);
    const blade2Geo = createCurvedReedBladeGeometry(0.082, 1.54, 0.38, 2.35);
    blade2Geo.translate(0.09, 0, 0.05);
    const blade3Geo = createCurvedReedBladeGeometry(0.078, 1.8, 0.32, 4.4);
    blade3Geo.translate(0, 0, -0.08);

    const reedGeos = [blade1Geo, blade2Geo, blade3Geo].map((g) => normalizeGeometryForBatch(g, 0.2, 0));
    const reedMat = makeBatchMat({
      color: '#FFFFFF',
      roughness: 0.72,
      diffuseRoughness: 0.45,
      doubleSide: true,
      slot: 'flowerStems',
    });
    const reedTintW = slotTintWeight('flowerStems', 0.2);
    const entries: BatchInstanceSpec[] = [];

    reeds.forEach((item, i) => {
      const { y } = groundAt(item.x, item.z, 0.2);
      dummy.position.set(item.x, y, item.z);
      dummy.rotation.set(0, item.rotation, 0);
      dummy.scale.setScalar(item.size);
      dummy.updateMatrix();
      const mat4 = dummy.matrix.clone();
      col.set('#62A84D').offsetHSL(((i % 3) - 1) * 0.02, 0, ((i % 4) - 1) * 0.03);
      entries.push(
        { geoIndex: 0, matrix: mat4, color: blendInstColor(col, reedTintW) },
        { geoIndex: 1, matrix: mat4, color: blendInstColor(col.clone().offsetHSL(0.01, 0, 0.05), reedTintW) },
        { geoIndex: 2, matrix: mat4, color: blendInstColor(col.clone().offsetHSL(-0.01, 0, -0.04), reedTintW) }
      );
    });
    const batch = buildBatchedGeometryInstances({
      geometries: reedGeos,
      material: reedMat,
      entries,
    });
    addBatchMeshes(batch.batchedMesh);
      },
    });
  }

  // 5. RIVERBANK CATTAILS (BatchedMesh stalks, capsule heads & arching leaves)
  if (cattails.length > 0) {
    batchSteps.push({
      label: 'cattails',
      run: () => {
    const stalkGeo = new THREE.CylinderGeometry(0.03, 0.046, 1.78, 8);
    stalkGeo.translate(0, 0.7, 0);
    const headGeo = new THREE.CapsuleGeometry(0.088, 0.28, 6, 10);
    headGeo.translate(0, 1.32, 0);
    const leafGeo = createCurvedReedBladeGeometry(0.095, 1.42, 0.36, 0.35);
    leafGeo.translate(0.07, 0, 0);

    const catEntries: BatchInstanceSpec[] = [];
    const stalkCol = new THREE.Color('#4B8C42');
    const headCol = new THREE.Color('#5A311D');
    const leafCol = new THREE.Color('#66A652');

    cattails.forEach((item) => {
      const { y } = groundAt(item.x, item.z, 0.2);
      dummy.position.set(item.x, y, item.z);
      dummy.rotation.set(0, item.rotation, 0);
      dummy.scale.setScalar(item.size);
      dummy.updateMatrix();
      const mat4 = dummy.matrix.clone();
      catEntries.push(
        { geoIndex: 0, matrix: mat4, color: stalkCol },
        { geoIndex: 1, matrix: mat4, color: headCol }
      );
    });

    const catBatch = buildBatchedGeometryInstances({
      geometries: [
        normalizeGeometryForBatch(stalkGeo, 0.16, 0),
        normalizeGeometryForBatch(headGeo, 0.16, 0),
      ],
      material: makeBatchMat({ color: '#FFFFFF', roughness: 0.78, diffuseRoughness: 0.65 }),
      entries: catEntries,
    });
    const leafBatch = buildBatchedGeometryInstances({
      geometries: [normalizeGeometryForBatch(leafGeo, 0.2, 0)],
      material: makeBatchMat({
        color: '#FFFFFF',
        roughness: 0.76,
        diffuseRoughness: 0.45,
        doubleSide: true,
      }),
      entries: cattails.map((item) => {
        const { y } = groundAt(item.x, item.z, 0.2);
        dummy.position.set(item.x, y, item.z);
        dummy.rotation.set(0, item.rotation, 0);
        dummy.scale.setScalar(item.size);
        dummy.updateMatrix();
        return { geoIndex: 0, matrix: dummy.matrix.clone(), color: leafCol };
      }),
    });
    addBatchMeshes(catBatch.batchedMesh, leafBatch.batchedMesh);
      },
    });
  }

  // 6. LUSH CURVED MEADOW & TRAILSIDE GRASS TUFTS (single BatchedMesh for inner/outer V-cupped blades)
  if (tallGrasses.length > 0) {
    batchSteps.push({
      label: 'tallGrass',
      run: () => {
    const { innerGeo, outerGeo } = createCurvedGrassTuftGeometries();
    const grassMat = makeBatchMat({
      color: '#FFFFFF',
      roughness: 0.76,
      diffuseRoughness: 0.55,
      doubleSide: true,
      slot: 'grass',
    });
    const grassTintW = slotTintWeight('grass', 0.22);
    const entries: BatchInstanceSpec[] = [];

    const grassPalette = [
      new THREE.Color(biome.ground).lerp(new THREE.Color('#6BBF46'), 0.56),
      new THREE.Color(biome.ground).lerp(new THREE.Color('#86C94F'), 0.52),
      new THREE.Color(biome.ground).lerp(new THREE.Color('#53A043'), 0.58),
      new THREE.Color(biome.ground).lerp(new THREE.Color('#97BF4D'), 0.45),
    ];

    tallGrasses.forEach((item, i) => {
      const { y } = groundAt(item.x, item.z, 0.22);
      dummy.position.set(item.x, y, item.z);
      dummy.rotation.set(0, item.rotation, 0);
      const sx = item.size * (0.9 + ((i * 7) % 5) * 0.06);
      const sy = item.size * (0.85 + ((i * 11) % 6) * 0.08);
      dummy.scale.set(sx, sy, sx);
      dummy.updateMatrix();
      const mat4 = dummy.matrix.clone();

      col.copy(grassPalette[i % grassPalette.length]).offsetHSL(((i % 5) - 2) * 0.012, 0.02, ((i % 3) - 1) * 0.032);
      entries.push(
        { geoIndex: 0, matrix: mat4, color: blendInstColor(col.clone().offsetHSL(-0.008, 0.02, -0.045), grassTintW) },
        { geoIndex: 1, matrix: mat4, color: blendInstColor(col.clone().offsetHSL(0.015, 0.01, 0.05), grassTintW) }
      );
    });
    const batch = buildBatchedGeometryInstances({
      geometries: [
        normalizeGeometryForBatch(innerGeo, 0.16, 0),
        normalizeGeometryForBatch(outerGeo, 0.16, 0),
      ],
      material: grassMat,
      entries,
      receiveShadow: true,
    });
    addBatchMeshes(batch.batchedMesh);
      },
    });
  }

  // 7. CHISELED FACETED BOULDERS & CLIFF STONES (BatchedMesh + EON matte diffuseRoughness)
  if (rocks.length > 0) {
    batchSteps.push({
      label: 'rocks',
      run: () => {
    const rockGeoRaw = createFacetedRockGeometry(0.74, 1.24, 0.78, 1.06, 7);
    rockGeoRaw.translate(0, 0.16, 0);
    const rockNonIdx = rockGeoRaw.index ? rockGeoRaw.toNonIndexed() : rockGeoRaw;
    if (rockNonIdx !== rockGeoRaw) rockGeoRaw.dispose();
    rockNonIdx.computeVertexNormals();

    const sideRockRaw = createFacetedRockGeometry(0.46, 0.92, 1.12, 0.88, 19);
    sideRockRaw.translate(0.55, 0.12, 0.26);
    const sideNonIdx = sideRockRaw.index ? sideRockRaw.toNonIndexed() : sideRockRaw;
    if (sideNonIdx !== sideRockRaw) sideRockRaw.dispose();
    sideNonIdx.computeVertexNormals();

    const rockMat = makeBatchMat({
      color: '#FFFFFF',
      roughness: 0.86,
      diffuseRoughness: 0.92,
      slot: 'rocks',
      preserveFlatShading: false,
    });
    const rockTintW = slotTintWeight('rocks', 0.12);
    const entries: BatchInstanceSpec[] = [];
    const rockMeta: { id: string; x: number; y: number; z: number; size: number; start: number; count: number }[] = [];

    rocks.forEach((item, i) => {
      const { y } = groundAt(item.x, item.z, 0.45 * item.size);
      dummy.position.set(item.x, y, item.z);
      dummy.rotation.set(0, item.rotation, 0);
      dummy.scale.setScalar(item.size);
      dummy.updateMatrix();
      const mat4 = dummy.matrix.clone();
      const tone = 0.54 + (i % 4) * 0.055;
      const start = entries.length;
      entries.push({
        geoIndex: 0,
        matrix: mat4,
        color: blendInstColor(col.setRGB(tone, tone + 0.03, tone + 0.08), rockTintW),
      });
      if (i % 2 === 0) {
        entries.push({
          geoIndex: 1,
          matrix: mat4,
          color: blendInstColor(col.setRGB(tone - 0.04, tone, tone + 0.05), rockTintW),
        });
      }
      rockMeta.push({ id: item.id, x: item.x, y, z: item.z, size: item.size, start, count: entries.length - start });
    });

    const rockBatch = buildBatchedGeometryInstances({
      geometries: [
        normalizeGeometryForBatch(rockNonIdx, 0, 0),
        normalizeGeometryForBatch(sideNonIdx, 0, 0),
      ],
      material: rockMat,
      entries,
      castShadow: true,
      receiveShadow: true,
    });
    addBatchMeshes(rockBatch.batchedMesh);
    for (const rm of rockMeta) {
      const batchedEntries: BatchEntryRef[] = [];
      for (let k = 0; k < rm.count; k++) {
        batchedEntries.push(rockBatch.entryRefs[rm.start + k]);
      }
      harvestableScatter.push({
        id: rm.id,
        scatterKind: 'rock',
        x: rm.x,
        y: rm.y,
        z: rm.z,
        size: rm.size,
        collected: false,
        batchedEntries,
      });
    }
      },
    });
  }

  // 8. FULL MULTI-LOBE LEAF-TEXTURED WOODLAND BUSHES (single BatchedMesh for 3 lobes)
  if (bushes.length > 0) {
    batchSteps.push({
      label: 'bushes',
      run: () => {
    const lobe1Geo = createSculptedCanopyLobeGeometry(0.62, 1.14, 0.84, 1.08, 1.7, 14, 10, 2.2, 1.6);
    lobe1Geo.translate(0, 0.36, 0);
    const lobe2Geo = createSculptedCanopyLobeGeometry(0.46, 1.08, 0.82, 1.04, 4.3, 12, 9, 2.0, 1.5);
    lobe2Geo.translate(0.44, 0.27, 0.18);
    const lobe3Geo = createSculptedCanopyLobeGeometry(0.42, 1.06, 0.8, 1.04, 7.9, 12, 9, 1.9, 1.4);
    lobe3Geo.translate(-0.4, 0.25, -0.22);

    const bushMat = makeBatchMat({
      color: '#FFFFFF',
      roughness: 0.8,
      diffuseRoughness: 0.55,
      map: atlas.oakLeaves,
      bumpMap: atlas.oakLeavesBump,
      bumpScale: 0.11,
      slot: 'bushes',
    });
    const bushTintW = slotTintWeight('bushes', 0.25);
    const entries: BatchInstanceSpec[] = [];

    const bushPalette = [
      new THREE.Color(biome.ground).lerp(new THREE.Color('#2E8A47'), 0.56),
      new THREE.Color(biome.ground).lerp(new THREE.Color('#3F9848'), 0.54),
      new THREE.Color(biome.ground).lerp(new THREE.Color('#4B8C3B'), 0.58),
      new THREE.Color(biome.ground).lerp(new THREE.Color('#649E42'), 0.5),
    ];
    bushes.forEach((item, i) => {
      const { y } = groundAt(item.x, item.z, 0.42 * item.size);
      dummy.position.set(item.x, y, item.z);
      dummy.rotation.set(0, item.rotation, 0);
      dummy.scale.set(item.size * (0.94 + (i % 3) * 0.08), item.size * (0.88 + ((i + 1) % 3) * 0.09), item.size);
      dummy.updateMatrix();
      const mat4 = dummy.matrix.clone();

      col.copy(bushPalette[i % bushPalette.length]).offsetHSL(((i % 5) - 2) * 0.015, 0.02, ((i % 3) - 1) * 0.03);
      entries.push(
        { geoIndex: 0, matrix: mat4, color: blendInstColor(col, bushTintW) },
        { geoIndex: 1, matrix: mat4, color: blendInstColor(col.clone().offsetHSL(0.015, 0.02, 0.045), bushTintW) },
        { geoIndex: 2, matrix: mat4, color: blendInstColor(col.clone().offsetHSL(-0.014, 0, -0.035), bushTintW) }
      );
    });
    const bushBatch = buildBatchedGeometryInstances({
      geometries: [lobe1Geo, lobe2Geo, lobe3Geo].map((g) => normalizeGeometryForBatch(g, 0.045, 0)),
      material: bushMat,
      entries,
      castShadow: false,
      receiveShadow: true,
    });
    addBatchMeshes(bushBatch.batchedMesh);
      },
    });
  }

  // 8b. WILD BERRY & BLOSSOM SHRUBS (BatchedMesh foliage lobes + BatchedMesh berries)
  if (berryBushes.length > 0) {
    batchSteps.push({
      label: 'berryBushes',
      run: () => {
    const mainLobeGeo = createSculptedCanopyLobeGeometry(0.56, 1.08, 0.84, 1.04, 2.3, 14, 10, 2.2, 1.6);
    mainLobeGeo.translate(0, 0.4, 0);
    const sideLobeGeo = createSculptedCanopyLobeGeometry(0.42, 1.04, 0.82, 1.02, 5.1, 12, 9, 1.9, 1.4);
    sideLobeGeo.translate(0.34, 0.3, -0.14);
    const berryGeo = createShrubBerryClusterGeometry();

    const leafMat = makeBatchMat({
      color: '#FFFFFF',
      roughness: 0.78,
      diffuseRoughness: 0.55,
      map: atlas.oakLeaves,
      bumpMap: atlas.oakLeavesBump,
      bumpScale: 0.11,
      slot: 'bushes',
    });
    const shrubLeafTintW = slotTintWeight('bushes', 0.25);
    const berryMat = makeBatchMat({
      color: '#FFFFFF',
      roughness: 0.36,
      diffuseRoughness: 0.2,
      slot: 'fruit',
    });
    const berryTintW = slotTintWeight('fruit', 0.2);

    const shrubLeafBase = new THREE.Color(biome.detail).lerp(new THREE.Color('#2B7B43'), 0.62);
    const berryColors = ['#DC2626', '#4F46E5', '#F59E0B', '#EC4899', '#E11D48'];
    const leafEntries: BatchInstanceSpec[] = [];
    const berryEntries: BatchInstanceSpec[] = [];
    const berryHeights: number[] = [];

    berryBushes.forEach((item, i) => {
      const { y } = groundAt(item.x, item.z, 0.38 * item.size);
      berryHeights.push(y);
      dummy.position.set(item.x, y, item.z);
      dummy.rotation.set(0, item.rotation, 0);
      dummy.scale.setScalar(item.size);
      dummy.updateMatrix();
      const mat4 = dummy.matrix.clone();

      col.copy(shrubLeafBase).offsetHSL(((i % 4) - 1.5) * 0.016, 0.03, ((i % 3) - 1) * 0.035);
      leafEntries.push(
        { geoIndex: 0, matrix: mat4, color: blendInstColor(col, shrubLeafTintW) },
        { geoIndex: 1, matrix: mat4, color: blendInstColor(col.clone().offsetHSL(0.012, 0.02, 0.04), shrubLeafTintW) }
      );
      berryEntries.push({
        geoIndex: 0,
        matrix: mat4,
        color: blendInstColor(col.set(berryColors[i % berryColors.length]), berryTintW),
      });
    });

    const leafBatch = buildBatchedGeometryInstances({
      geometries: [mainLobeGeo, sideLobeGeo].map((g) => normalizeGeometryForBatch(g, 0.045, 0)),
      material: leafMat,
      entries: leafEntries,
      castShadow: false,
      receiveShadow: true,
    });
    const berryBatch = buildBatchedGeometryInstances({
      geometries: [normalizeGeometryForBatch(berryGeo, 0.045, 0)],
      material: berryMat,
      entries: berryEntries,
    });
    addBatchMeshes(leafBatch.batchedMesh, berryBatch.batchedMesh);
    berryBushes.forEach((item, i) => {
      harvestableScatter.push({
        id: item.id,
        scatterKind: 'berryBush',
        x: item.x,
        y: berryHeights[i] ?? 0,
        z: item.z,
        size: item.size,
        collected: false,
        batchedEntries: [
          leafBatch.entryRefs[i * 2],
          leafBatch.entryRefs[i * 2 + 1],
          berryBatch.entryRefs[i],
        ],
      });
    });
      },
    });
  }

  // 8c. WOODLAND FERNS (BatchedMesh arching scalloped fronds)
  if (ferns.length > 0) {
    batchSteps.push({
      label: 'ferns',
      run: () => {
    const fernGeo = createFernRosetteGeometry();
    const fernMat = makeBatchMat({
      color: '#FFFFFF',
      roughness: 0.72,
      diffuseRoughness: 0.5,
      doubleSide: true,
      map: atlas.pineLeaves,
      bumpMap: atlas.pineLeavesBump,
      bumpScale: 0.06,
      slot: 'bushes',
    });
    const fernTintW = slotTintWeight('bushes', 0.25);
    const fernPalette = [
      new THREE.Color('#3C9A47'),
      new THREE.Color('#4EAD4E'),
      new THREE.Color('#2F8746'),
      new THREE.Color('#5DB44C'),
    ];
    const fernHeights: number[] = [];
    const entries: BatchInstanceSpec[] = ferns.map((item, i) => {
      const { y } = groundAt(item.x, item.z, 0.28 * item.size);
      fernHeights.push(y);
      dummy.position.set(item.x, y, item.z);
      dummy.rotation.set(0, item.rotation, 0);
      dummy.scale.set(item.size, item.size * (0.86 + (i % 4) * 0.08), item.size);
      dummy.updateMatrix();
      col.copy(fernPalette[i % fernPalette.length]).offsetHSL(((i % 5) - 2) * 0.012, 0.02, ((i % 3) - 1) * 0.03);
      return { geoIndex: 0, matrix: dummy.matrix.clone(), color: blendInstColor(col, fernTintW) };
    });
    const fernBatch = buildBatchedGeometryInstances({
      geometries: [normalizeGeometryForBatch(fernGeo, 0.11, 0)],
      material: fernMat,
      entries,
      receiveShadow: true,
    });
    addBatchMeshes(fernBatch.batchedMesh);
    ferns.forEach((item, i) => {
      harvestableScatter.push({
        id: item.id,
        scatterKind: 'fern',
        x: item.x,
        y: fernHeights[i] ?? 0,
        z: item.z,
        size: item.size,
        collected: false,
        batchedEntries: [fernBatch.entryRefs[i]],
      });
    });
      },
    });
  }

  // 8d. BROADLEAF FOREST PLANTS / HOSTAS (BatchedMesh cupped ovate leaves)
  if (broadleafs.length > 0) {
    batchSteps.push({
      label: 'broadleafs',
      run: () => {
    const broadGeo = createBroadleafPlantGeometry();
    const broadMat = makeBatchMat({
      color: '#FFFFFF',
      roughness: 0.68,
      diffuseRoughness: 0.5,
      doubleSide: true,
      map: atlas.birchLeaves,
      bumpMap: atlas.birchLeavesBump,
      bumpScale: 0.07,
      slot: 'bushes',
    });
    const broadTintW = slotTintWeight('bushes', 0.25);
    const broadPalette = [
      new THREE.Color('#3F9456'),
      new THREE.Color('#53AA57'),
      new THREE.Color('#347F4B'),
      new THREE.Color('#6BB554'),
    ];
    const broadHeights: number[] = [];
    const entries: BatchInstanceSpec[] = broadleafs.map((item, i) => {
      const { y } = groundAt(item.x, item.z, 0.25 * item.size);
      broadHeights.push(y);
      dummy.position.set(item.x, y, item.z);
      dummy.rotation.set(0, item.rotation, 0);
      dummy.scale.set(item.size, item.size * (0.9 + (i % 3) * 0.1), item.size);
      dummy.updateMatrix();
      col.copy(broadPalette[i % broadPalette.length]).offsetHSL(((i % 4) - 1.5) * 0.015, 0.02, ((i % 3) - 1) * 0.03);
      return { geoIndex: 0, matrix: dummy.matrix.clone(), color: blendInstColor(col, broadTintW) };
    });
    const broadBatch = buildBatchedGeometryInstances({
      geometries: [normalizeGeometryForBatch(broadGeo, 0.08, 0)],
      material: broadMat,
      entries,
      receiveShadow: true,
    });
    addBatchMeshes(broadBatch.batchedMesh);
    broadleafs.forEach((item, i) => {
      harvestableScatter.push({
        id: item.id,
        scatterKind: 'broadleaf',
        x: item.x,
        y: broadHeights[i] ?? 0,
        z: item.z,
        size: item.size,
        collected: false,
        batchedEntries: [broadBatch.entryRefs[i]],
      });
    });
      },
    });
  }

  // 8e. WOODLAND MUSHROOM CLUSTERS (single BatchedMesh for cream stalks + tinted caps)
  if (mushrooms.length > 0) {
    batchSteps.push({
      label: 'mushrooms',
      run: () => {
    const { stemGeo, capGeo } = createMushroomClusterGeometries();
    const mushMat = makeBatchMat({ color: '#FFFFFF', roughness: 0.68, diffuseRoughness: 0.6 });
    const stemCol = new THREE.Color('#F3EAD8');
    const capPalette = ['#C85A32', '#D98A3A', '#B8322E', '#E3C082', '#A64D2E'];
    const entries: BatchInstanceSpec[] = [];
    const mushHeights: number[] = [];

    mushrooms.forEach((item, i) => {
      const { y } = groundAt(item.x, item.z, 0.18 * item.size);
      mushHeights.push(y);
      dummy.position.set(item.x, y, item.z);
      dummy.rotation.set(0, item.rotation, 0);
      dummy.scale.setScalar(item.size);
      dummy.updateMatrix();
      const mat4 = dummy.matrix.clone();
      entries.push(
        { geoIndex: 0, matrix: mat4, color: stemCol },
        { geoIndex: 1, matrix: mat4, color: new THREE.Color(capPalette[i % capPalette.length]) }
      );
    });
    const mushBatch = buildBatchedGeometryInstances({
      geometries: [
        normalizeGeometryForBatch(stemGeo, 0, 0),
        normalizeGeometryForBatch(capGeo, 0, 0),
      ],
      material: mushMat,
      entries,
      receiveShadow: true,
    });
    addBatchMeshes(mushBatch.batchedMesh);
    mushrooms.forEach((item, i) => {
      harvestableScatter.push({
        id: item.id,
        scatterKind: 'mushroom',
        x: item.x,
        y: mushHeights[i] ?? 0,
        z: item.z,
        size: item.size,
        collected: false,
        batchedEntries: [
          mushBatch.entryRefs[i * 2],
          mushBatch.entryRefs[i * 2 + 1],
        ],
      });
    });
      },
    });
  }

  // 9. WILDFLOWERS (BatchedMesh stems/centers + BatchedMesh double-sided leaves/petals)
  if (flowers.length > 0) {
    batchSteps.push({
      label: 'flowers',
      run: () => {
    const { stemGeo, leafGeo, petalGeo: bloomGeo, centerGeo } = createDetailedWildflowerGeometries();

    const singleSidedFlowerMat = makeBatchMat({
      color: '#FFFFFF',
      roughness: 0.62,
      diffuseRoughness: 0.5,
      slot: 'flowerStems',
      baseTintHex: '#FFFFFF',
    });
    const doubleSidedFlowerMat = makeBatchMat({
      color: '#FFFFFF',
      roughness: 0.55,
      diffuseRoughness: 0.45,
      doubleSide: true,
      slot: 'flowerPetals',
      baseTintHex: '#FFFFFF',
    });
    const petalTintW = slotTintWeight('flowerPetals', 0.35);
    const stemTintW = slotTintWeight('flowerStems', 0.2);

    const petalPalette = ['#FB7185', '#FBBF24', '#F8FAFC', '#C084FC', '#FF6B4A', '#60A5FA', '#FDE047', '#F472B6'];
    const stemBaseCol = new THREE.Color('#3F873B');
    const leafBaseCol = new THREE.Color('#54AB49');
    const centerBaseCol = new THREE.Color('#FACC15');

    const singleEntries: BatchInstanceSpec[] = [];
    const doubleEntries: BatchInstanceSpec[] = [];
    const cliffLedgePositions: { x: number; y: number; z: number; size: number; rot: number }[] = [];
    const flowerHeights: number[] = [];

    flowers.forEach((item, i) => {
      const centerY = sampleTerrainHeight(terrain, item.x, item.z);
      const { y, maxSlope } = groundAt(item.x, item.z, 0.42 * item.size);
      let flowerY = y;
      if (maxSlope > 0.32) {
        flowerY = centerY;
        cliffLedgePositions.push({ x: item.x, y: centerY, z: item.z, size: item.size, rot: item.rotation });
      }
      flowerHeights.push(flowerY);
      dummy.position.set(item.x, flowerY, item.z);
      dummy.rotation.set(0, item.rotation, 0);
      dummy.scale.setScalar(item.size);
      dummy.updateMatrix();
      const mat4 = dummy.matrix.clone();

      singleEntries.push(
        { geoIndex: 0, matrix: mat4, color: blendInstColor(stemBaseCol, stemTintW) },
        { geoIndex: 1, matrix: mat4, color: centerBaseCol }
      );
      doubleEntries.push(
        { geoIndex: 0, matrix: mat4, color: blendInstColor(leafBaseCol, stemTintW) },
        { geoIndex: 1, matrix: mat4, color: blendInstColor(col.set(petalPalette[i % petalPalette.length]), petalTintW) }
      );
    });

    const singleBatch = buildBatchedGeometryInstances({
      geometries: [
        normalizeGeometryForBatch(stemGeo, 0.14, 0),
        normalizeGeometryForBatch(centerGeo, 0.14, 0),
      ],
      material: singleSidedFlowerMat,
      entries: singleEntries,
    });
    const doubleBatch = buildBatchedGeometryInstances({
      geometries: [
        normalizeGeometryForBatch(leafGeo, 0.14, 0),
        normalizeGeometryForBatch(bloomGeo, 0.14, 0),
      ],
      material: doubleSidedFlowerMat,
      entries: doubleEntries,
    });
    addBatchMeshes(singleBatch.batchedMesh, doubleBatch.batchedMesh);
    flowers.forEach((item, i) => {
      harvestableScatter.push({
        id: item.id,
        scatterKind: 'flower',
        x: item.x,
        y: flowerHeights[i] ?? 0,
        z: item.z,
        size: item.size,
        collected: false,
        batchedEntries: [
          singleBatch.entryRefs[i * 2],
          singleBatch.entryRefs[i * 2 + 1],
          doubleBatch.entryRefs[i * 2],
          doubleBatch.entryRefs[i * 2 + 1],
        ],
      });
    });

    if (cliffLedgePositions.length > 0) {
      const padGeo = new THREE.CylinderGeometry(0.62, 0.44, 1.15, 6);
      padGeo.translate(0, -0.575, 0);
      const padBatch = buildBatchedGeometryInstances({
        geometries: [normalizeGeometryForBatch(padGeo, 0, 0)],
        material: makeBatchMat({ color: '#5A8A45', roughness: 0.88, diffuseRoughness: 0.9, map: atlas.moss }),
        entries: cliffLedgePositions.map((p) => {
          dummy.position.set(p.x, p.y, p.z);
          dummy.rotation.set(0, p.rot, 0);
          dummy.scale.setScalar(p.size);
          dummy.updateMatrix();
          return { geoIndex: 0, matrix: dummy.matrix.clone(), color: whiteCol };
        }),
        receiveShadow: true,
      });
      addBatchMeshes(padBatch.batchedMesh);
    }
      },
    });
  }

  return {
    stylizedCanopyTrees,
    fallbackLeafHex,
    pushForestRecords,
    batchSteps,
    customItems,
    groundAt,
  };
}

function buildDistantVista(
  level: GameLevel,
  customAssets: CustomAssetMeta[],
  style: VisualStyleId,
  innerRadius: number
): THREE.Group;
function buildDistantVista(
  level: GameLevel,
  customAssets: CustomAssetMeta[],
  style: VisualStyleId,
  innerRadius: number,
  deferSignal: AbortSignal | undefined,
  targetContainer: THREE.Group
): Promise<THREE.Group | null>;
function buildDistantVista(
  level: GameLevel,
  customAssets: CustomAssetMeta[],
  style: VisualStyleId,
  innerRadius: number,
  deferSignal?: AbortSignal,
  targetContainer?: THREE.Group
): THREE.Group | Promise<THREE.Group | null> {
  const vistaGroup = new THREE.Group();
  const preset: VistaPresetId = level.vistaPreset ?? 'alpineValley';
  const baseDensity = THREE.MathUtils.clamp(level.vistaDensity ?? 0.85, 0.1, 1.5);
  const treeDensity = THREE.MathUtils.clamp(level.vistaTreeDensity ?? baseDensity, 0, 1.5);
  const mountainScale = THREE.MathUtils.clamp(level.vistaMountainScale ?? 1.0, 0, 1.8);
  const treeScaleMult = THREE.MathUtils.clamp(level.vistaTreeScale ?? 1.0, 0.5, 2.2);
  const vistaDistOffset = THREE.MathUtils.clamp(level.vistaDistance ?? 0, -40, 280);
  const effectiveInnerRadius = Math.max(innerRadius < 140 ? 68 : 145, innerRadius + vistaDistOffset);
  const ringBandSpan = 270 + Math.max(0, vistaDistOffset) * 0.38;
  const outerRadius = effectiveInnerRadius + ringBandSpan;

  const items = level.vistaItems ?? [];
  if (preset === 'none' && items.length === 0) {
    if (targetContainer) targetContainer.add(vistaGroup);
    return vistaGroup;
  }

  const biome = getBiome(level.biome);
  const atlas = getTerrainTextureAtlas();

  const coniferVistaCfg = resolveEffectiveVistaTreeConfig(level, 'conifer');
  const oakVistaCfg = resolveEffectiveVistaTreeConfig(level, 'oak');
  const birchVistaCfg = resolveEffectiveVistaTreeConfig(level, 'birch');

  const vistaMatCache = new Map<string, THREE.MeshStandardMaterial>();
  const makeVistaMat = (color: string) => {
    let mat = vistaMatCache.get(color);
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.88,
        metalness: 0.02,
        flatShading: style !== 'celToon',
      });
      vistaMatCache.set(color, mat);
    }
    return mat;
  };
  const vistaBotwCache = new Map<THREE.Material, THREE.Material>();
  const vistaTimeUniform = getSharedBotwUniforms().uTime;

  const steps: DeferredStep[] = [];

  if (preset !== 'none') {
    const pinePts: { x: number; y: number; z: number; s: number; rot: number }[] = [];
    const oakPts: { x: number; y: number; z: number; s: number; rot: number }[] = [];
    const birchPts: { x: number; y: number; z: number; s: number; rot: number }[] = [];
    const rockPts: { x: number; y: number; z: number; s: number; rot: number }[] = [];

    steps.push({
      label: 'vistaTerrain',
      run: () => {
        // 1. Higher-Resolution Continuous Polar-Grid Distant Foothills & Mountain Ring
        const radialSegs = 28;
        const angSegs = 144;
        const vPos = new Float32Array((radialSegs + 1) * (angSegs + 1) * 3);
        const vCol = new Float32Array((radialSegs + 1) * (angSegs + 1) * 3);
        const vIdx: number[] = [];

        const grassC = new THREE.Color(biome.ground).lerp(new THREE.Color('#4C8A44'), 0.35);
        const mossC = new THREE.Color(biome.detail).lerp(new THREE.Color('#35663A'), 0.4);
        const rockC = new THREE.Color(preset === 'volcanicPeaks' ? '#494754' : '#6F7785');
        const capC = new THREE.Color(preset === 'volcanicPeaks' ? '#7D3B2B' : '#EDF4FA');
        const sandTintC = new THREE.Color('#BFA878');
        const tmpC = new THREE.Color();

        for (let r = 0; r <= radialSegs; r++) {
          const rt = r / radialSegs;
          const rad = effectiveInnerRadius + rt * rt * (outerRadius - effectiveInnerRadius);
          for (let a = 0; a <= angSegs; a++) {
            const theta = (a / angSegs) * Math.PI * 2;
            const vx = Math.cos(theta) * rad;
            const vz = Math.sin(theta) * rad;
            const h = evaluateVistaHeight(vx, vz, effectiveInnerRadius, preset, mountainScale);
            const vi = r * (angSegs + 1) + a;
            vPos[vi * 3] = vx;
            vPos[vi * 3 + 1] = h;
            vPos[vi * 3 + 2] = vz;

            if (h < IslandTerrain.waterLevel + 0.9) {
              tmpC.copy(rockC).lerp(sandTintC, 0.42);
            } else if (h < 10) {
              tmpC.copy(grassC).lerp(mossC, (h - IslandTerrain.waterLevel) / 12);
            } else if (h < 25) {
              tmpC.copy(mossC).lerp(rockC, (h - 10) / 15);
            } else {
              tmpC.copy(rockC).lerp(capC, Math.min(1, (h - 25) / 18));
            }
            vCol[vi * 3] = tmpC.r;
            vCol[vi * 3 + 1] = tmpC.g;
            vCol[vi * 3 + 2] = tmpC.b;
          }
        }

        for (let r = 0; r < radialSegs; r++) {
          for (let a = 0; a < angSegs; a++) {
            const i0 = r * (angSegs + 1) + a;
            const i1 = i0 + 1;
            const i2 = (r + 1) * (angSegs + 1) + a;
            const i3 = i2 + 1;
            vIdx.push(i0, i1, i2, i1, i3, i2);
          }
        }

        const landGeo = new THREE.BufferGeometry();
        landGeo.setAttribute('position', new THREE.BufferAttribute(vPos, 3));
        landGeo.setAttribute('color', new THREE.BufferAttribute(vCol, 3));
        landGeo.setIndex(vIdx);
        landGeo.computeVertexNormals();

        const landMat = new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.9,
          metalness: 0.02,
          flatShading: false,
        });
        const landMesh = new THREE.Mesh(landGeo, landMat);
        landMesh.receiveShadow = false;
        applyBotwStyleToObject(landMesh, style, { rimStrengthScale: 0.82, shadowLiftScale: 0.85 });
        vistaGroup.add(landMesh);
        if (targetContainer) {
          targetContainer.add(vistaGroup);
        }

        const treeSpan = Math.min(185, ringBandSpan * 0.58);
        const maxTreeElev = 28 * Math.max(0.85, Math.min(1.3, mountainScale));
        const totalTreeSamples = treeDensity > 0 ? Math.round(680 * treeDensity) : 0;
        for (let i = 0; i < totalTreeSamples; i++) {
          const theta = (i * 2.399963) % (Math.PI * 2);
          const dist = effectiveInnerRadius + 16 + ((i * 37.7) % treeSpan);
          const vx = Math.cos(theta) * dist;
          const vz = Math.sin(theta) * dist;
          const y = evaluateVistaHeight(vx, vz, effectiveInnerRadius, preset, mountainScale);
          if (y < IslandTerrain.waterLevel + 0.65 || y > maxTreeElev) continue;

          const yIn = evaluateVistaHeight(
            vx - Math.cos(theta) * 2.2,
            vz - Math.sin(theta) * 2.2,
            effectiveInnerRadius,
            preset,
            mountainScale
          );
          const baseY = Math.min(y, yIn) - 0.35;
          const rot = (i * 1.13) % (Math.PI * 2);
          const scale = 1.65 + (i % 5) * 0.35;

          if (i % 3 === 0) {
            pinePts.push({ x: vx, y: baseY, z: vz, s: scale * 1.15, rot });
          } else if (i % 3 === 1) {
            oakPts.push({ x: vx, y: baseY, z: vz, s: scale * 1.1, rot });
          } else {
            birchPts.push({ x: vx, y: baseY, z: vz, s: scale * 1.05, rot });
          }
        }

        const rockSampleCount =
          mountainScale > 0.05
            ? Math.round(145 * Math.max(0.15, Math.min(1.4, baseDensity * Math.max(0.35, mountainScale))))
            : 0;
        for (let i = 0; i < rockSampleCount; i++) {
          const theta = (i * 2.399963 + 0.85) % (Math.PI * 2);
          const dist = effectiveInnerRadius + 18 + ((i * 53.3) % treeSpan);
          const vx = Math.cos(theta) * dist;
          const vz = Math.sin(theta) * dist;
          const y = evaluateVistaHeight(vx, vz, effectiveInnerRadius, preset, mountainScale);
          if (y < IslandTerrain.waterLevel + 0.65 || y > maxTreeElev + 6) continue;
          const yIn = evaluateVistaHeight(
            vx - Math.cos(theta) * 2.2,
            vz - Math.sin(theta) * 2.2,
            effectiveInnerRadius,
            preset,
            mountainScale
          );
          const baseY = Math.min(y, yIn) - 0.35;
          const rot = (i * 1.71) % (Math.PI * 2);
          const scale = 1.65 + (i % 5) * 0.35;
          rockPts.push({ x: vx, y: baseY, z: vz, s: scale * 1.25, rot });
        }
      },
    });

    const dummy = new THREE.Object3D();
    const tint = new THREE.Color();
    const whiteTint = new THREE.Color('#FFFFFF');

    const makeVistaBatchMat = (color: string, map?: THREE.Texture, roughness = 0.86, diffuseRoughness = 0.82) =>
      createScatterBatchMaterialInstance({
        style,
        timeUniform: vistaTimeUniform,
        color,
        roughness,
        diffuseRoughness,
        map: map ?? null,
      });

    steps.push({
      label: 'vistaPines',
      run: () => {
        if (pinePts.length === 0) return;
        const pineBase = new THREE.Color(biome.detail).lerp(new THREE.Color('#3F8D3B'), 0.68);
        if (coniferVistaCfg) {
          const grp = buildVistaTreeSpeciesInstancedGroup({
            config: coniferVistaCfg,
            speciesKey: 'conifer',
            style,
            placements: pinePts,
            treeScaleMultiplier: treeScaleMult,
            fallbackBaseColor: `#${pineBase.getHexString()}`,
            sceneryTextures: level.sceneryTextures,
          });
          vistaGroup.add(grp);
          return;
        }
        const pTrunk = new THREE.CylinderGeometry(0.18, 0.38, 2.5, 9);
        pTrunk.translate(0, 0.92, 0);
        const pCone = createDetailedPineTierGeometry(1.82, 4.4, 9, 2);
        pCone.translate(0, 3.35, 0);
        const trunkEntries: BatchInstanceSpec[] = [];
        const crownEntries: BatchInstanceSpec[] = [];
        pinePts.forEach((p, idx) => {
          dummy.position.set(p.x, p.y, p.z);
          dummy.rotation.set(0, p.rot, 0);
          dummy.scale.setScalar(p.s * treeScaleMult);
          dummy.updateMatrix();
          const mat4 = dummy.matrix.clone();
          trunkEntries.push({ geoIndex: 0, matrix: mat4, color: whiteTint });
          crownEntries.push({
            geoIndex: 0,
            matrix: mat4,
            color: tint.copy(pineBase).offsetHSL(0, 0, ((idx % 3) - 1) * 0.04).clone(),
          });
        });
        vistaGroup.add(
          buildBatchedGeometryInstances({
            geometries: [normalizeGeometryForBatch(pTrunk, 0, 0)],
            material: makeVistaBatchMat('#FFFFFF', atlas.pineBark, 0.88, 0.9),
            entries: trunkEntries,
          }).batchedMesh,
          buildBatchedGeometryInstances({
            geometries: [normalizeGeometryForBatch(pCone, 0, 0)],
            material: makeVistaBatchMat('#FFFFFF', atlas.pineLeaves, 0.84, 0.45),
            entries: crownEntries,
          }).batchedMesh
        );
      },
    });

    steps.push({
      label: 'vistaOaks',
      run: () => {
        if (oakPts.length === 0) return;
        const oakBase = new THREE.Color(biome.ground).lerp(new THREE.Color('#4E9A3F'), 0.6);
        if (oakVistaCfg) {
          const grp = buildVistaTreeSpeciesInstancedGroup({
            config: oakVistaCfg,
            speciesKey: 'oak',
            style,
            placements: oakPts,
            treeScaleMultiplier: treeScaleMult,
            fallbackBaseColor: `#${oakBase.getHexString()}`,
            sceneryTextures: level.sceneryTextures,
          });
          vistaGroup.add(grp);
          return;
        }
        const oTrunk = new THREE.CylinderGeometry(0.26, 0.45, 2.3, 9);
        oTrunk.translate(0, 0.9, 0);
        const oCrown = createSculptedCanopyLobeGeometry(1.58, 1.2, 0.95, 1.15, 2.4, 12, 9, 2.4, 1.7);
        oCrown.translate(0, 2.95, 0);
        const trunkEntries: BatchInstanceSpec[] = [];
        const crownEntries: BatchInstanceSpec[] = [];
        oakPts.forEach((p, idx) => {
          dummy.position.set(p.x, p.y, p.z);
          dummy.rotation.set(0, p.rot, 0);
          dummy.scale.setScalar(p.s * treeScaleMult);
          dummy.updateMatrix();
          const mat4 = dummy.matrix.clone();
          trunkEntries.push({ geoIndex: 0, matrix: mat4, color: whiteTint });
          crownEntries.push({
            geoIndex: 0,
            matrix: mat4,
            color: tint.copy(oakBase).offsetHSL(0, 0, ((idx % 3) - 1) * 0.045).clone(),
          });
        });
        vistaGroup.add(
          buildBatchedGeometryInstances({
            geometries: [normalizeGeometryForBatch(oTrunk, 0, 0)],
            material: makeVistaBatchMat('#FFFFFF', atlas.oakBark, 0.88, 0.9),
            entries: trunkEntries,
          }).batchedMesh,
          buildBatchedGeometryInstances({
            geometries: [normalizeGeometryForBatch(oCrown, 0, 0)],
            material: makeVistaBatchMat('#FFFFFF', atlas.oakLeaves, 0.84, 0.45),
            entries: crownEntries,
          }).batchedMesh
        );
      },
    });

    steps.push({
      label: 'vistaBirchAndRocks',
      run: () => {
        if (birchPts.length > 0) {
          const birchBase = new THREE.Color(biome.ground).lerp(new THREE.Color('#80CF4C'), 0.62);
          if (birchVistaCfg) {
            const grp = buildVistaTreeSpeciesInstancedGroup({
              config: birchVistaCfg,
              speciesKey: 'birch',
              style,
              placements: birchPts,
              treeScaleMultiplier: treeScaleMult,
              fallbackBaseColor: `#${birchBase.getHexString()}`,
              sceneryTextures: level.sceneryTextures,
            });
            vistaGroup.add(grp);
          } else {
            const bTrunk = new THREE.CylinderGeometry(0.13, 0.24, 3.0, 9);
            bTrunk.translate(0, 1.2, 0);
            const bCrown = createSculptedCanopyLobeGeometry(1.16, 0.95, 1.32, 0.95, 4.2, 12, 9, 2.4, 1.8);
            bCrown.translate(0, 3.35, 0);
            const trunkEntries: BatchInstanceSpec[] = [];
            const crownEntries: BatchInstanceSpec[] = [];
            birchPts.forEach((p, idx) => {
              dummy.position.set(p.x, p.y, p.z);
              dummy.rotation.set(0, p.rot, 0);
              dummy.scale.setScalar(p.s * treeScaleMult);
              dummy.updateMatrix();
              const mat4 = dummy.matrix.clone();
              trunkEntries.push({ geoIndex: 0, matrix: mat4, color: whiteTint });
              crownEntries.push({
                geoIndex: 0,
                matrix: mat4,
                color: tint.copy(birchBase).offsetHSL(0, 0, ((idx % 3) - 1) * 0.05).clone(),
              });
            });
            vistaGroup.add(
              buildBatchedGeometryInstances({
                geometries: [normalizeGeometryForBatch(bTrunk, 0, 0)],
                material: makeVistaBatchMat('#FFFFFF', atlas.birchBark, 0.82, 0.86),
                entries: trunkEntries,
              }).batchedMesh,
              buildBatchedGeometryInstances({
                geometries: [normalizeGeometryForBatch(bCrown, 0, 0)],
                material: makeVistaBatchMat('#FFFFFF', atlas.birchLeaves, 0.82, 0.45),
                entries: crownEntries,
              }).batchedMesh
            );
          }
        }

        if (rockPts.length > 0) {
          const rGeo = createFacetedRockGeometry(1.28, 1.28, 0.88, 1.08, 11);
          rGeo.translate(0, 0.35, 0);
          const rNonIdx = rGeo.index ? rGeo.toNonIndexed() : rGeo;
          if (rNonIdx !== rGeo) rGeo.dispose();
          rNonIdx.computeVertexNormals();
          const rockEntries: BatchInstanceSpec[] = rockPts.map((p, idx) => {
            dummy.position.set(p.x, p.y, p.z);
            dummy.rotation.set(0, p.rot, 0);
            dummy.scale.setScalar(p.s);
            dummy.updateMatrix();
            const t = 0.52 + (idx % 4) * 0.05;
            return { geoIndex: 0, matrix: dummy.matrix.clone(), color: tint.setRGB(t, t + 0.03, t + 0.08).clone() };
          });
          vistaGroup.add(
            buildBatchedGeometryInstances({
              geometries: [normalizeGeometryForBatch(rNonIdx, 0, 0)],
              material: makeVistaBatchMat('#FFFFFF', undefined, 0.88, 0.92),
              entries: rockEntries,
            }).batchedMesh
          );
        }
      },
    });
  }

  if (items.length > 0) {
    steps.push({
      label: 'vistaLandmarks',
      run: () => {
        for (const item of items) {
          const rad = (item.angle * Math.PI) / 180;
          const dist = Math.max(effectiveInnerRadius + 8, Math.min(outerRadius - 20, item.distance));
          const vx = Math.cos(rad) * dist;
          const vz = Math.sin(rad) * dist;
          const terrainY = evaluateVistaHeight(vx, vz, effectiveInnerRadius, preset, mountainScale);
          const needsIslet = terrainY < IslandTerrain.waterLevel + 0.3;
          const baseY = needsIslet ? IslandTerrain.waterLevel + 0.35 : terrainY - 0.3;

          const itemGroup = new THREE.Group();
          itemGroup.position.set(vx, baseY, vz);
          itemGroup.rotation.y = rad + Math.PI * 0.5;
          itemGroup.scale.setScalar(item.scale);

          if (needsIslet) {
            const islet = new THREE.Mesh(
              new THREE.CylinderGeometry(7.5, 11.5, 3.2, 7),
              makeVistaMat('#778091')
            );
            islet.position.y = -1.4;
            const grassTop = new THREE.Mesh(
              new THREE.CylinderGeometry(7.4, 7.6, 0.45, 7),
              makeVistaMat(biome.ground)
            );
            grassTop.position.y = 0.05;
            itemGroup.add(islet, grassTop);
          }

          if (item.kind === 'custom' && item.customAssetId) {
            const meta = customAssets.find((a) => a.id === item.customAssetId);
            const inst = instantiateCustomModel(item.customAssetId, meta, {
              scaleAdjust: 4.5,
              visualStyle: style,
            });
            if (inst) {
              itemGroup.add(inst.group);
            }
          } else if (item.kind === 'mountain') {
            const rockMat = makeVistaMat('#7E8EA6');
            const shoulderMat = makeVistaMat('#677790');
            const capMat = makeVistaMat('#D9EEFA');
            const mainPeak = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 13.5, 34, 6), rockMat);
            mainPeak.position.y = 15.5;
            const cap = new THREE.Mesh(new THREE.ConeGeometry(4.5, 8.2, 6), capMat);
            cap.position.y = 35.5;
            const sidePeakL = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 9.2, 23, 5), shoulderMat);
            sidePeakL.position.set(-10.5, 10.2, 2.8);
            const sidePeakR = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 8.5, 19, 5), shoulderMat);
            sidePeakR.position.set(9.8, 8.6, -2.4);
            itemGroup.add(mainPeak, cap, sidePeakL, sidePeakR);
          } else if (item.kind === 'boulderRidge') {
            const mat = makeVistaMat('#7B8494');
            for (const [bx, bz, w, h, s] of [
              [-3.2, 0.6, 2.2, 7.2, 6],
              [-0.4, -0.6, 2.8, 10.5, 6],
              [2.6, 0.4, 2.4, 8.4, 5],
              [4.8, -0.8, 1.8, 5.2, 6],
            ]) {
              const colRock = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.85, w, h, s), mat);
              colRock.position.set(bx, h * 0.45, bz);
              itemGroup.add(colRock);
            }
          } else if (item.kind === 'castleRuins') {
            const stoneM = makeVistaMat('#8D887E');
            const roofM = makeVistaMat('#7C3AED');
            const keep = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.8, 13, 6), stoneM);
            keep.position.y = 6.2;
            const spire = new THREE.Mesh(new THREE.ConeGeometry(3.8, 6.2, 6), roofM);
            spire.position.y = 15.6;
            const sideWall = new THREE.Mesh(new THREE.BoxGeometry(9.5, 6.5, 2.8), stoneM);
            sideWall.position.set(4.5, 3.1, 0);
            itemGroup.add(keep, spire, sideWall);
          } else {
            const activeClusterCfg =
              item.kind === 'birchCluster'
                ? birchVistaCfg
                : item.kind === 'oakCluster'
                ? oakVistaCfg
                : coniferVistaCfg;
            if (activeClusterCfg) {
              const fallbackClusterColor =
                item.kind === 'pineCluster'
                  ? '#4D9E3E'
                  : item.kind === 'oakCluster'
                  ? '#52A441'
                  : '#80CF4C';
              const clusterOffsets: [number, number, number, number][] = [
                [0, 0, 1.25, 0.25],
                [-3.2, 1.4, 0.95, 1.8],
                [3.0, -1.2, 1.05, 3.5],
                [1.1, 2.9, 0.85, 5.1],
              ];
              for (const [idx, [tx, tz, ts, rotY]] of clusterOffsets.entries()) {
                const treeGrp = buildSingleCanopyTreeGroup(
                  activeClusterCfg,
                  `vista_lm_${item.id}_${idx}`,
                  style,
                  vistaTimeUniform,
                  fallbackClusterColor,
                  { sceneryTextures: level.sceneryTextures, detail: 'forest' }
                );
                treeGrp.position.set(tx, 0, tz);
                treeGrp.rotation.y = rotY;
                treeGrp.scale.setScalar(ts * 1.15 * treeScaleMult);
                treeGrp.traverse((ch) => {
                  if ((ch as THREE.Mesh).isMesh) {
                    ch.castShadow = false;
                    ch.receiveShadow = false;
                  }
                });
                itemGroup.add(treeGrp);
              }
            } else {
              const trunkMap =
                item.kind === 'birchCluster'
                  ? atlas.birchBark
                  : item.kind === 'oakCluster'
                  ? atlas.oakBark
                  : atlas.pineBark;
              const crownMap =
                item.kind === 'pineCluster'
                  ? atlas.pineLeaves
                  : item.kind === 'oakCluster'
                  ? atlas.oakLeaves
                  : atlas.birchLeaves;
              const crownColor =
                item.kind === 'pineCluster'
                  ? '#4D9E3E'
                  : item.kind === 'oakCluster'
                  ? '#52A441'
                  : '#80CF4C';
              const tKey = `${item.kind}:trunk`;
              let tMat = vistaMatCache.get(tKey);
              if (!tMat) {
                tMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF', map: trunkMap, roughness: 0.88 });
                vistaMatCache.set(tKey, tMat);
              }
              const cKey = `${item.kind}:crown:${crownColor}`;
              let cMat = vistaMatCache.get(cKey);
              if (!cMat) {
                cMat = new THREE.MeshStandardMaterial({ color: crownColor, map: crownMap, roughness: 0.82 });
                vistaMatCache.set(cKey, cMat);
              }
              for (const [tx, tz, ts] of [
                [0, 0, 1.25],
                [-3.2, 1.4, 0.95],
                [3.0, -1.2, 1.05],
                [1.1, 2.9, 0.85],
              ]) {
                const trunk = new THREE.Mesh(
                  new THREE.CylinderGeometry(0.32 * ts * treeScaleMult, 0.52 * ts * treeScaleMult, 3.6 * ts * treeScaleMult, 10),
                  tMat
                );
                trunk.position.set(tx, 1.5 * ts * treeScaleMult, tz);
                const crown =
                  item.kind === 'pineCluster'
                    ? new THREE.Mesh(
                        createDetailedPineTierGeometry(2.5 * ts * treeScaleMult, 6.4 * ts * treeScaleMult, 9, 3),
                        cMat
                      )
                    : new THREE.Mesh(
                        createSculptedCanopyLobeGeometry(2.4 * ts * treeScaleMult, 1.15, 0.95, 1.1, 2.2, 12, 9, 2.4, 1.8),
                        cMat
                      );
                crown.position.set(tx, (item.kind === 'pineCluster' ? 5.1 : 4.2) * ts * treeScaleMult, tz);
                itemGroup.add(trunk, crown);
              }
            }
          }

          applyBotwStyleToObject(itemGroup, style, { rimStrengthScale: 0.82, shadowLiftScale: 0.85 }, vistaBotwCache);
          vistaGroup.add(itemGroup);
        }
        if (targetContainer && !vistaGroup.parent) {
          targetContainer.add(vistaGroup);
        }
      },
    });
  }

  if (targetContainer && deferSignal) {
    return (async () => {
      const ok = await runDeferredSteps(steps, {
        frameBudgetMs: 4,
        yieldBeforeFirst: false,
        signal: deferSignal,
      });
      if (!ok || deferSignal.aborted) {
        disposeObject3D(vistaGroup);
        return null;
      }
      return vistaGroup;
    })();
  }

  for (const s of steps) {
    void s.run();
  }
  applyBotwStyleToObject(vistaGroup, style, { rimStrengthScale: 0.82, shadowLiftScale: 0.85 });
  return vistaGroup;
}

export function buildWeatherParticles(weather: GameLevel['weather']): THREE.Points | null {
  if (weather === 'none') return null;
  const atlas = getTerrainTextureAtlas();
  const isFireflies = weather === 'fireflies';
  const isLeaves = weather === 'leaves';
  const isRain = weather === 'rain';

  const count = isRain ? 420 : isFireflies ? 140 : isLeaves ? 160 : 280;
  const spread = 120;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * spread;
    positions[i * 3 + 1] = isFireflies ? 0.5 + Math.random() * 6.5 : Math.random() * 24;
    positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: isRain
      ? '#BAE6FD'
      : isFireflies
      ? '#FFE77A'
      : isLeaves
      ? '#F59E0B'
      : '#FFFFFF',
    map: isFireflies ? atlas.glowSprite : null,
    size: isRain ? 0.24 : isFireflies ? 0.72 : isLeaves ? 0.48 : 0.4,
    transparent: true,
    opacity: isRain ? 0.6 : isFireflies ? 0.92 : 0.85,
    blending: isFireflies ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: false,
  });

  const pts = new THREE.Points(geo, mat);
  pts.userData.weather = weather;
  return pts;
}

export function disposeObject3D(root: THREE.Object3D) {
  const disposedGeometries = new Set<THREE.BufferGeometry>();
  const disposedMaterials = new Set<THREE.Material>();

  root.traverse((obj) => {
    if (typeof obj.userData?.disposeExtra === 'function') {
      obj.userData.disposeExtra();
    }
    if ((obj as THREE.InstancedMesh).isInstancedMesh) {
      (obj as THREE.InstancedMesh).dispose?.();
    }
    if ((obj as THREE.BatchedMesh).isBatchedMesh) {
      (obj as THREE.BatchedMesh).dispose?.();
    }
    if ((obj as THREE.Mesh).isMesh || (obj as THREE.Points).isPoints) {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry && !disposedGeometries.has(mesh.geometry)) {
        disposedGeometries.add(mesh.geometry);
        mesh.geometry.dispose();
      }
      if (Array.isArray(mesh.material)) {
        for (const m of mesh.material) {
          if (m && !disposedMaterials.has(m)) {
            disposedMaterials.add(m);
            m.dispose();
          }
        }
      } else if (mesh.material && !disposedMaterials.has(mesh.material)) {
        disposedMaterials.add(mesh.material);
        mesh.material.dispose();
      }
    }
  });
}
