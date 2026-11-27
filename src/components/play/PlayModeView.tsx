import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { WebGPURenderer } from 'three/webgpu';
import { ClusteredLighting } from 'three/addons/lighting/ClusteredLighting.js';
import { attachSunCSM, type CsmShadowHandle } from '../../three/csmShadowSetup';
import { CharacterFootIKController } from '../../three/characterFootIK';
import { PlayNavMeshEngine } from '../../three/navMeshEngine';
import { HybridRapierPhysicsWorld } from '../../three/rapierPhysicsWorld';
import { WildlifeFlockingSystem } from '../../three/wildlifeFlockingSystem';
import {
  WorldInteractivitySystem,
  type DebrisTheme,
  type PushableStoneBlock,
  type RockImpactEnemyTarget,
  type WorldInteractivityCallbacks,
} from '../../three/worldInteractivitySystem';
import {
  Anvil,
  Backpack,
  Camera,
  Car,
  ChevronRight,
  Clapperboard,
  Eye,
  Fish,
  Flame,
  Gauge,
  Map as MapIcon,
  MessageCircle,
  PackageOpen,
  PanelBottom,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Skull,
  Sparkles,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  resolveChatBubbleStyle,
  resolveChatDisplaySettings,
  resolveEffectiveDialogueMode,
  resolveVoiceClipForLine,
} from '../../data/chatBubblePresets';
import { createDefaultFxEmitterConfig } from '../../data/fxEmitterPresets';
import {
  EntityKindMeta,
  findCraftingRecipe,
  formatKeyCodeLabel,
  getProjectCraftingRecipes,
  getProjectInventoryItems,
  MisfitAbilityById,
  MisfitAbilityCatalog,
  resolveGameInventoryConfig,
  resolveItemMetadata,
} from '../../data/registries';
import {
  DEFAULT_ROGUELIKE_CONFIG,
  aggregateRelicModifiers,
  generateRoguelikeFloor,
  getRelicById,
  rollRelicDraftOptions,
} from '../../data/roguelikeEngine';
import {
  BADDIE_ACTION_BY_ID,
  pickNextBaddieAction,
  resolveBaddieActionId,
  resolveBaddieAIConfig,
  type BaddieActionDef,
} from '../../data/baddieActionLibrary';
import {
  computeHeroIncomingDamage,
  computeHeroOutgoingDamage,
  evaluateHeroEnvironmentModifiers,
  resolveHeroProfile,
  type EnemyTargetDescriptors,
  type HeroEnvEvalResult,
} from '../../data/heroTraits';
import { publishLivePlayerTelemetry, type MakerStore } from '../../store/useMakerStore';
import type {
  ActionButtonBinding,
  BaddieAIConfig,
  BehaviorCard,
  BoardPoint,
  BuildingBlockConfig,
  CameraCutawayTransition,
  CameraMode,
  CarPresetId,
  ChatBubbleStyle,
  CraftingRecipe,
  CreatureExpressionMood,
  CritterAttitude,
  CritterWarmTrigger,
  CustomClipSlot,
  CustomMotionPreset,
  DialogueOutputMode,
  DialogueVoiceConfig,
  DoorConfig,
  DriverTypeId,
  DrivingCameraView,
  DrivingConfig,
  DrivingPhysicsId,
  EntityKind,
  GameInventoryConfig,
  HeroEquipment,
  HeroStatusEffectKind,
  HUDState,
  InventoryItemDef,
  InventoryStack,
  LevelEntity,
  MisfitAbilityId,
  MonsterAbilityId,
  MonsterAttackType,
  MonsterBlueprint,
  ObjectInteractionAttributeId,
  ObjectInteractionCalibration,
  ObjectMechanism,
  PropPresetId,
  RoguelikeRelicDef,
  SkitBeat,
  SkitBeatEmote,
  StoryCameraShot,
  StorySkit,
} from '../../types/maker';
import { AudioEngine } from '../../utils/audio';
import { collectReferencedVoiceIds } from '../../utils/voiceVault';
import {
  getEnvironmentType,
  getSideScrollerConfig,
  isInsideAnyCave,
  isInsideMountainCave,
  IslandTerrain,
  levelBoardToWorld,
  levelWorldToBoard,
  MountainCave,
  PlatformMotion,
  resolveHorizontalCollision,
  sampleLevelHeight,
  sampleSideScrollerSurfaceAtY,
  sampleTerrainLayer,
  sampleTerrainWeathering,
  terrainHasMainMountainCave,
  type CollisionFilterContext,
  type WalkInBuildingSpec,
} from '../../utils/terrain';
import { readJsHeapUsageMB } from '../../utils/resourceMonitor';
import {
  clearDiscoveredPlinths,
  clearSavedPlayProgress,
  consumePendingPlinthTravel,
  encodeExplorationBase64,
  getDiscoveredPlinthKeys,
  getEffectiveMapInfo,
  getExplorationSnapshot,
  hydrateDiscoveredPlinths,
  hydrateExploration,
  isSavePlinthEntity,
  levelLocalToMapCoords,
  loadSavedPlayProgress,
  makePlinthKey,
  markPlinthDiscovered,
  resetExploration,
  revealExplorationAtCoords,
  savePlayProgress,
  setPendingPlinthTravel,
  subscribeOpenInGameWorldMap,
  type SavePlinthTarget,
  type SavedPlayProgress,
} from '../../utils/worldMapFog';
import {
  applyVisualStyleToObject,
  instantiateCustomModel,
  loadCustomAssetToCache,
  type CustomModelInstance,
} from '../../three/gltfAssetManager';
import {
  buildSingleCanopyTreeGroup,
  computeWeatherWindFactor,
} from '../../three/canopyClusterBuilder';
import {
  collectReferencedTextureIds,
  loadCustomTextureToCache,
} from '../../three/customTextureManager';
import { FxEmitterRuntime } from '../../three/fxEmitterRuntime';
import { PostProcessingPipeline } from '../../three/postProcessingPipeline';
import { applyVertexPaintStrokesToObject } from '../../three/vertexPainter';
import { createOptInMeshletPipeline, prepareObjectForMeshletCulling } from '../../three/meshletPipeline';
import { applyEntityMaterialVariant } from '../../three/nodeMaterialUtils';
import { applyDoorOpenAnimation, sampleBuildingSurfaceY } from '../../three/buildingBlocks';
import {
  applyAtmosphere,
  applyAtmosphereQualityToScene,
  applyLiveRendererQuality,
  buildIslandMesh,
  buildWeatherParticles,
  createMakerRenderer,
  detectSoftwareGl,
  disposeObject3D,
  ensureSkyDome,
  initMakerRenderer,
  setupSceneEnvironment,
  syncSkyDomeToCamera,
  updateCaveInteractiveAnimations,
  updateRiverFishAnimations,
  updateSkyClouds,
  type IslandSceneHandles,
} from '../../three/islandScene';
import { hideBatchEntry, setBatchEntryMatrix } from '../../three/batchedScatterBuilder';
import {
  forceReleaseRendererContext,
  getRendererMaxTextureArrayLayers,
  isIOSDevice,
  isWebGPUFallbackAdapter,
  sanitizeObjectMorphTargets,
} from '../../three/webglUtils';
import {
  MechanismRuntimeController,
  updateTreasureChestRig,
  type TreasureChestAnimRig,
} from '../../three/mechanismController';
import {
  buildDucklingCompanionMesh,
  buildEntityMesh,
  buildFallingTreeMesh,
  buildHeroModel,
  buildLeapingFishMesh,
  buildParachuteBlanketRig,
  buildPickupItemMesh,
  buildPortalMarker,
  buildTreeStumpMesh,
  updateParachuteBlanketRig,
  updateRpgLivingVillageAnimations,
  type BaddieRig,
  type CreatureAnimRefs,
  type HeroRig,
  type ParachuteBlanketRig,
} from '../../three/proceduralModels';
import {
  animateQuadrupedMonster,
  resolveMonsterBlueprint,
  type QuadrupedAnimState,
  type QuadrupedMonsterRig,
} from '../../three/quadrupedMonsterBuilder';
import {
  MonsterAttackVfxController,
} from '../../three/monsterAttackVfx';
import {
  HeroCombatEffectsController,
  type ActiveHeroEffectTimers,
} from '../../three/heroCombatEffects';
import {
  attachEquipmentToCustomModel,
  syncHeroEquipmentVisuals,
  type HeroEquipmentHandles,
} from '../../three/heroEquipmentAttachments';
import {
  applyMotionPresetToBaddieRigRuntime,
  applyMotionPresetToHeroRigRuntime,
  applyMotionPresetToQuadrupedRuntime,
  presetHasLegTracks,
  resolveLogicPlayAnimationTarget,
  resolveMotionPresetForRuntime,
} from '../../three/universalMotionAdapter';
import {
  buildCarModel,
  CAR_PRESETS,
  DRIVING_CAMERA_VIEWS,
  DRIVING_PHYSICS_PRESETS,
  DRIVER_TYPES,
  getCarPreset,
  getDriverType,
  getDrivingCameraView,
  getDrivingPhysics,
  type CarRig,
} from '../../three/vehicleModels';
import {
  BottomChatPanelView,
  ChatBubbleView,
  type ChatHistoryEntry,
} from '../shared/ChatBubbleRenderer';
import { HUDWidgetView } from '../shared/HUDWidgetPreview';
import { MakerIcon } from '../shared/IconMap';
import { InventoryItemIcon } from '../shared/InventoryItemIcon';
import { IconBadge, Pill } from '../shared/MakerUI';
import { computeWidgetPosition } from '../stages/InterfaceStage';
import { ChestLootModal, type ChestLootEntry } from './ChestLootModal';
import { InventoryModal } from './InventoryModal';
import { InGameWorldMapModal } from './InGameWorldMapModal';
import {
  StorybookChapterBanner,
  StorybookCoverModal,
} from './StorybookFrameOverlay';
import {
  EnemyHealthBar,
  EvaporatingDamageNumber,
  RpgVisualFxItem,
  hexLuminance,
  resolveBaddieHealthBarColors,
  drawRoundedRectPath,
  redrawEnemyHealthBar,
  createEnemyHealthBar,
  spawnEvaporatingDamageNumber,
  updateEvaporatingDamageNumbers,
  spawnRpgSwordSlashArc,
  spawnRpgMagicZapBeam,
  spawnRpgOgreThrowWave,
  buildRpgArrowProjectileMesh,
  updateRpgVisualFx,
} from '../../features/play/systems/enemyHealthBar';
import {
  RpgRewardCardsModal,
  RPG_REWARD_CARD_POOL,
  type RpgRewardCardOption,
} from '../../features/play/components/RpgRewardCardsModal';
import { RpgGameHudOverlay } from '../../features/play/components/RpgGameHudOverlay';
import { buildChestLootEntriesForEntity } from '../../features/play/systems/chestLootGenerator';
import { PlayPauseModal } from '../../features/play/components/PlayPauseModal';
import { RoguelikeRelicDraftModal } from '../../features/play/components/RoguelikeRelicDraftModal';
import { PlayGameOverModal } from '../../features/play/components/PlayGameOverModal';
import { PlayLevelCompleteModal } from '../../features/play/components/PlayLevelCompleteModal';
import { PlayInteractionPrompts } from '../../features/play/components/PlayInteractionPrompts';
import { PlayCutawayOverlay } from '../../features/play/components/PlayCutawayOverlay';

type BaddieAIState =
  | 'patrol'
  | 'chase'
  | 'landing'
  | 'windup'
  | 'strike'
  | 'recover'
  | 'stagger'
  | 'dying';

interface ActiveCharacterSpeech {
  key: string; // 'hero' or entity.id
  entityId: string | 'hero';
  speaker: string;
  roleLabel: string;
  kind: EntityKind | 'hero';
  lines: string[];
  lineIndex: number;
  style: ChatBubbleStyle;
  voiceConfig?: DialogueVoiceConfig;
  outputMode: DialogueOutputMode;
  isProximity: boolean;
  expiresAt: number | null;
  nonce: number;
}

const _bubbleProjVec = new THREE.Vector3();

function splitDialogueLines(
  raw: string,
  conversationWords?: string[],
  voiceConfig?: DialogueVoiceConfig
): string[] {
  const fromRaw = raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const fromConv = (conversationWords ?? []).map((s) => s.trim()).filter(Boolean);
  const merged = [...fromRaw];
  for (const line of fromConv) {
    if (!merged.includes(line)) merged.push(line);
  }
  let maxVoiceIdx = -1;
  if (voiceConfig?.clipId) maxVoiceIdx = 0;
  if (voiceConfig?.lineClipIds) {
    for (const [k, v] of Object.entries(voiceConfig.lineClipIds)) {
      if (v) maxVoiceIdx = Math.max(maxVoiceIdx, Number(k));
    }
  }
  if (merged.length === 0 && maxVoiceIdx < 0) {
    return ['Hello, traveller!'];
  }
  while (merged.length <= maxVoiceIdx) {
    merged.push('');
  }
  return merged;
}

function animateCreatureRig(
  refs: CreatureAnimRefs | null | undefined,
  time: number,
  moving: boolean,
  speedMult = 1,
  celebrating = false
) {
  if (!refs) return;
  const wagFreq = celebrating ? 13 : moving ? 8.5 * speedMult : 2.6;
  const wagAmp = celebrating ? 0.42 : moving ? 0.28 : 0.1;
  if (refs.tail) {
    refs.tail.rotation.y = Math.sin(time * wagFreq) * wagAmp;
    refs.tail.rotation.x = celebrating
      ? 0.16 + Math.abs(Math.sin(time * 9)) * 0.14
      : moving
      ? 0.08
      : Math.sin(time * 1.9) * 0.05;
  }
  if (refs.wingL && refs.wingR) {
    const flap = celebrating
      ? Math.sin(time * 12) * 0.65
      : moving
      ? Math.sin(time * 8.5) * 0.48
      : Math.sin(time * 2.2) * 0.08;
    refs.wingL.rotation.z = (moving || celebrating ? 0.35 : 0.12) + flap;
    refs.wingR.rotation.z = -(moving || celebrating ? 0.35 : 0.12) - flap;
  }
  if (refs.head && celebrating) {
    refs.head.rotation.z = Math.sin(time * 7) * 0.12;
  }
}

// Note: EnemyHealthBar systems and buildChestLootEntriesForEntity extracted to src/features/play/systems/


interface RuntimeEntity {
  id: string;
  kind: string;
  name: string;
  mesh: THREE.Group;
  customInst: CustomModelInstance | null;
  baddieRig: BaddieRig | null;
  quadrupedRig: QuadrupedMonsterRig | null;
  npcRig: HeroRig | null;
  npcBaseBodyY: number;
  creatureHeroRig: HeroRig | null;
  creatureBaseBodyY: number;
  sourceEntity?: LevelEntity;
  resolvedMonster?: MonsterBlueprint | null;
  customFlashMats: Array<{ emissive: THREE.Color; emissiveIntensity: number }>;
  hpBar: EnemyHealthBar | null;
  x: number;
  z: number;
  startX: number;
  startZ: number;
  vx: number;
  vz: number;
  vy: number;
  yOffset: number;
  health: number;
  maxHealth: number;
  speed: number;
  isBoss: boolean;
  brain: string;
  alive: boolean;
  opened: boolean;
  dialogue: string;
  dialogueLines: string[];
  chatStyle: ChatBubbleStyle;
  voiceConfig?: DialogueVoiceConfig;
  lastProximityVoiceAt: number;
  headHeight: number;
  aggroShouted: boolean;
  lowHpShouted: boolean;
  patrolDir: number;
  attackCooldown: number;
  aiState: BaddieAIState;
  stateTimer: number;
  attackDirX: number;
  attackDirZ: number;
  strikeDidHit: boolean;
  hitFlashTimer: number;
  recoilPitch: number;
  recoilRoll: number;
  walkPhase: number;
  defeatSpin: number;
  monsterPrimaryAttack?: MonsterAttackType;
  monsterSecondaryAttack?: MonsterAttackType;
  monsterAbility?: MonsterAbilityId;
  monsterAttackPower?: number;
  monsterAttackRange?: number;
  monsterAttackCooldown?: number;
  activeAttack: MonsterAttackType;
  attackCycleCount: number;
  regenTimer: number;
  pickupable: boolean;
  pickupItemId?: string;
  pickupQty: number;
  giftGiven: boolean;
  treeHp?: number;
  mechanisms: ObjectMechanism[];
  mechController: MechanismRuntimeController | null;
  mechNearState: Record<string, boolean>;
  mechFlagFired: Record<string, boolean>;
  chestAnim: TreasureChestAnimRig | null;
  chestLootEntries: ChestLootEntry[];
  chestOpening: boolean;
  chestOpenTimer: number;
  fxRuntime: FxEmitterRuntime | null;
  isBuddy: boolean;
  buddyAreaLabel?: string;
  misfitAbility?: MisfitAbilityId;
  critterAttitude?: CritterAttitude;
  critterWarmOn?: CritterWarmTrigger;
  critterWarmFlag?: string;
  critterWarmLines?: string[];
  warmedUp: boolean;
  critterCelebrateTimer: number;
  lastCritterReactAt: number;
  puzzleRequires?: MisfitAbilityId;
  puzzleRewardText?: string;
  puzzleFlag?: string;
  propPreset?: PropPresetId;
  checkpointOrder?: number;
  recruited: boolean;
  creatureRefs: CreatureAnimRefs | null;
  floatSpinMeshes: THREE.Object3D[];
  cards: BehaviorCard[];
  elevationY?: number;
  buildingBlock?: BuildingBlockConfig;
  doorConfig?: DoorConfig;
  requiresKey?: boolean;
  wallTorchLight?: THREE.PointLight;
  torchFlames?: Array<{ mesh: THREE.Object3D; baseY: number; phase: number }>;
  skitEmote?: SkitBeatEmote | null;
  skitMoving?: boolean;
  interactionAttributes?: ObjectInteractionAttributeId[];
  interactionCalibrations?: Partial<
    Record<ObjectInteractionAttributeId, ObjectInteractionCalibration>
  >;
  entityYaw?: number;
  entityScale?: number;
  npcWanderAngle?: number;
  npcWanderTimer?: number;
  npcPauseTimer?: number;
  chickenMode?: 'walk' | 'peck' | 'idle';
  chickenTimer?: number;
  chickenYaw?: number;
  chickenSpeedVal?: number;
  propHp?: number;
  propMaxHp?: number;
  propShakeTimer?: number;
  propShakeDirX?: number;
  propShakeDirZ?: number;
  baddieAI?: BaddieAIConfig;
  flightY: number;
  targetFlightY: number;
  patrolAngle: number;
  lockedTargetX: number;
  lockedTargetZ: number;
  varietyCooldownMult: number;
  behaviorChaseOrdered: boolean;
  behaviorFleeOrdered: boolean;
  behaviorAttackQueue: MonsterAttackType | null;
  enraged: boolean;
  dyingDuration: number;
  deathFinalized: boolean;
  keyFillColor: string;
  keyBorderColor: string;
  airAttacksSinceLand: number;
  postAirHoverTimer: number;
  groundedHoldTimer: number;
  mustLandBeforeAttack: boolean;
  logicAnimName: string | null;
  logicAnimTimer: number;
  logicAnimDuration: number;
  motionBlend: number;
  motionElapsed: number;
  motionKey: string;
}

export const PlayModeView: React.FC<{ store: MakerStore }> = ({ store }) => {
  const { currentProject, currentLevel } = store;
  const [showTitle, setShowTitle] = useState(
    !store.playFromPoint && !store.rehearseSkitId
  );
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const [dead, setDead] = useState(false);
  const [muted, setMuted] = useState(AudioEngine.isMuted());
  const [resetTick, setResetTick] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [showPerfHud, setShowPerfHud] = useState(false);
  const showPerfHudRef = useRef(showPerfHud);
  showPerfHudRef.current = showPerfHud;
  const [perfStats, setPerfStats] = useState<{
    fps: number;
    frameMs: number;
    calls: number;
    triangles: number;
    backend: string;
    heapMB?: number;
    heapLimitMB?: number;
  }>({ fps: 0, frameMs: 0, calls: 0, triangles: 0, backend: 'WebGPU' });
  const compactFpsDotRef = useRef<HTMLSpanElement | null>(null);
  const compactFpsTextRef = useRef<HTMLSpanElement | null>(null);
  const compactMsTextRef = useRef<HTMLSpanElement | null>(null);
  const latestPerfSnapshotRef = useRef(perfStats);
  const [toast, setToast] = useState<string | null>(null);
  const [activeSpeeches, setActiveSpeeches] = useState<ActiveCharacterSpeech[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatHistoryEntry[]>([]);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [inventoryMode, setInventoryMode] = useState<'bag' | 'bench'>('bag');
  const [nearCraftingBench, setNearCraftingBench] = useState(false);
  const [harvestPrompt, setHarvestPrompt] = useState<{
    label: string;
    itemName: string;
    method: 'interact' | 'walkOver';
  } | null>(null);
  const [doorInteractPrompt, setDoorInteractPrompt] = useState<{
    label: string;
    isOpen: boolean;
    locked: boolean;
  } | null>(null);
  const [chestInteractPrompt, setChestInteractPrompt] = useState<{
    label: string;
    isOpen: boolean;
    locked: boolean;
    lockedMessage?: string;
    itemCount: number;
  } | null>(null);
  const [isChestOpeningAnim, setIsChestOpeningAnim] = useState(false);
  const [activeChestLoot, setActiveChestLoot] = useState<{
    entityId: string;
    chestName: string;
    entries: ChestLootEntry[];
  } | null>(null);
  const [sitPrompt, setSitPrompt] = useState<{
    label: string;
    isSitting: boolean;
  } | null>(null);
  const [climbPrompt, setClimbPrompt] = useState<{
    label: string;
    active: boolean;
  } | null>(null);
  const [worldActionPrompt, setWorldActionPrompt] = useState<{
    kind: 'rock' | 'boulder' | 'carryingRock' | 'carryingBoulder' | 'wallTorch' | 'treeFruit';
    label: string;
    hint?: string;
  } | null>(null);
  const [glidePrompt, setGlidePrompt] = useState<'ready' | 'readySecond' | 'gliding' | null>(null);
  const [fishingBanner, setFishingBanner] = useState<'none' | 'waiting' | 'bite'>('none');
  const [inventoryStacks, setInventoryStacks] = useState<InventoryStack[]>([
    { itemId: 'iron_sword', qty: 1, durability: 100, maxDurability: 100 },
    { itemId: 'oak_shield', qty: 1, durability: 120, maxDurability: 120 },
    { itemId: 'wood_axe', qty: 1, durability: 90, maxDurability: 90 },
    { itemId: 'parachute_blanket', qty: 1, durability: 100, maxDurability: 100 },
  ]);
  const [heroStatusBanner, setHeroStatusBanner] = useState<{
    label: string;
    kind: HeroStatusEffectKind | 'knockdown';
  } | null>(null);
  const [heroTraitBanner, setHeroTraitBanner] = useState<{
    label: string;
    tone: 'strength' | 'flaw';
  } | null>(null);
  const [bossVictoryBanner, setBossVictoryBanner] = useState<{
    bossName: string;
    coins: number;
  } | null>(null);
  const [equipment, setEquipment] = useState<HeroEquipment>({
    heldItemId: 'iron_sword',
    offhandItemId: 'oak_shield',
    headItemId: null,
    bodyItemId: null,
    accessoryItemId: null,
  });
  const [stickOffset, setStickOffset] = useState({ x: 0, y: 0 });
  const [viewSize, setViewSize] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 1000,
    h: typeof window !== 'undefined' ? window.innerHeight : 700,
  }));
  const [drivingCfg, setDrivingCfg] = useState<DrivingConfig>(() => ({
    carId: currentLevel?.drivingConfig?.carId ?? 'trailBuggy',
    physicsId: currentLevel?.drivingConfig?.physicsId ?? 'arcadeDrift',
    driverId: currentLevel?.drivingConfig?.driverId ?? 'stunt',
    cameraView: currentLevel?.drivingConfig?.cameraView ?? 'closeChase',
    customVehicle: currentLevel?.drivingConfig?.customVehicle,
  }));
  const drivingCfgRef = useRef(drivingCfg);
  drivingCfgRef.current = drivingCfg;

  const [driveHud, setDriveHud] = useState({
    speedKmh: 0,
    boost: 100,
    drifting: false,
    airborne: false,
    checkpointsHit: 0,
    checkpointsTotal: 0,
    flightSeconds: 0,
    hasWings: false,
  });

  const [buddyHud, setBuddyHud] = useState({
    found: 0,
    total: 0,
    names: [] as string[],
    celebrating: false,
    celebrationBannerOpen: false,
  });
  const [storyStats, setStoryStats] = useState({ puzzlesSolved: 0, crittersWarmed: 0 });
  const [chapterBannerVisible, setChapterBannerVisible] = useState(false);
  const introSpokenRef = useRef(false);

  const [worldMapOpen, setWorldMapOpen] = useState(false);
  const [fastTravelState, setFastTravelState] = useState<{
    plinthEntityId: string;
    plinthName: string;
  } | null>(null);
  const [discoveredPlinthKeys, setDiscoveredPlinthKeys] = useState<Set<string>>(() =>
    currentProject ? getDiscoveredPlinthKeys(currentProject.id) : new Set()
  );
  const liveHeroTransformRef = useRef({ x: 0, z: 0, yaw: 0 });
  const resumeSavedRef = useRef<SavedPlayProgress | null>(null);
  const crossLevelCarryRef = useRef<{
    coins: number;
    keys: number;
    health: number;
    maxHealth: number;
  } | null>(null);
  const sameLevelTravelFnRef = useRef<((target: SavePlinthTarget) => void) | null>(null);
  const liveStatsGetterRef = useRef<
    (() => { coins: number; keys: number; health: number; maxHealth: number }) | null
  >(null);
  const openFastTravelRef = useRef<(plinthEntityId: string, plinthName: string) => void>(() => {});
  const worldMapOpenRef = useRef(worldMapOpen);
  worldMapOpenRef.current = worldMapOpen;
  const fastTravelStateRef = useRef(fastTravelState);
  fastTravelStateRef.current = fastTravelState;
  const showTitleRef = useRef(showTitle);
  showTitleRef.current = showTitle;
  const activeChestLootRef = useRef(activeChestLoot);
  activeChestLootRef.current = activeChestLoot;
  const chestEntriesByEntityRef = useRef<Map<string, ChestLootEntry[]>>(new Map());
  const openChestModalFnRef = useRef<(entityId: string, chestName: string) => void>(() => {});
  const liveGrantCurrencyRef = useRef<(coinDelta: number, keyDelta: number) => void>(() => {});
  const chestOpeningLockRef = useRef(false);

  const isRpgMode = currentLevel?.gameplayMode === 'rpg';
  const [rpgStats, setRpgStats] = useState({
    atkBonus: 4,
    defBonus: 3,
    magicBonus: 5,
    potions: 2,
    herbs: 2,
    weaponName: 'Steel Broadsword',
    activeCombatStyle: 'sword' as 'sword' | 'arrow' | 'magic',
  });
  const rpgStatsRef = useRef(rpgStats);
  rpgStatsRef.current = rpgStats;

  const [rpgCardModal, setRpgCardModal] = useState<{
    sourceTitle: string;
    cards: RpgRewardCardOption[];
  } | null>(null);
  const rpgCardModalRef = useRef(rpgCardModal);
  rpgCardModalRef.current = rpgCardModal;
  const openRpgCardModalRef = useRef<(sourceTitle: string) => void>(() => {});
  const liveRpgApplyRewardRef = useRef<((card: RpgRewardCardOption) => void) | null>(null);

  openRpgCardModalRef.current = (sourceTitle: string) => {
    inputRef.current.keys.clear();
    inputRef.current.interactQueued = false;
    inputRef.current.interactPointerDown = false;
    const shuffled = [...RPG_REWARD_CARD_POOL].sort(() => Math.random() - 0.5).slice(0, 3);
    setRpgCardModal({
      sourceTitle,
      cards: shuffled,
    });
  };

  openFastTravelRef.current = (plinthEntityId: string, plinthName: string) => {
    if (!currentProject) return;
    setDiscoveredPlinthKeys(getDiscoveredPlinthKeys(currentProject.id));
    setWorldMapOpen(false);
    setFastTravelState({ plinthEntityId, plinthName });
  };

  useEffect(() => {
    return subscribeOpenInGameWorldMap(() => {
      if (
        showTitleRef.current ||
        flagsRef.current.paused ||
        flagsRef.current.finished ||
        flagsRef.current.dead
      ) {
        return;
      }
      setFastTravelState(null);
      setWorldMapOpen(true);
    });
  }, []);

  useEffect(() => {
    if (showTitle || !currentProject?.storybook?.enabled) {
      setChapterBannerVisible(false);
      return;
    }
    setChapterBannerVisible(true);
    const timer = window.setTimeout(() => setChapterBannerVisible(false), 3800);
    return () => window.clearTimeout(timer);
  }, [showTitle, currentProject?.id, currentLevel?.id, currentProject?.storybook?.enabled, resetTick]);

  const computeStarterMisfitPowers = useCallback((): MisfitAbilityId[] => {
    const usesMisfits =
      currentProject?.heroBody === 'Skunk' ||
      currentLevel?.gameplayMode === 'buddies' ||
      currentLevel?.completeCondition === 'gatherBuddies' ||
      Boolean(currentLevel?.startWithDuckling) ||
      Boolean(
        currentLevel?.entities?.some((e) => Boolean(e.puzzleRequires || e.misfitAbility))
      );
    return usesMisfits ? ['skunkScent'] : [];
  }, [currentProject?.heroBody, currentLevel]);

  const [unlockedPowers, setUnlockedPowers] = useState<MisfitAbilityId[]>(computeStarterMisfitPowers);
  const [activePower, setActivePower] = useState<MisfitAbilityId | null>(
    () => computeStarterMisfitPowers()[0] ?? null
  );
  const [coolingPowerId, setCoolingPowerId] = useState<MisfitAbilityId | null>(null);
  const [vultureLookoutActive, setVultureLookoutActive] = useState(false);

  const unlockedPowersRef = useRef<MisfitAbilityId[]>(unlockedPowers);
  unlockedPowersRef.current = unlockedPowers;
  const activePowerRef = useRef<MisfitAbilityId | null>(activePower);
  activePowerRef.current = activePower;
  const vultureLookoutActiveRef = useRef(vultureLookoutActive);
  vultureLookoutActiveRef.current = vultureLookoutActive;

  useEffect(() => {
    const starter = computeStarterMisfitPowers();
    setUnlockedPowers(starter);
    unlockedPowersRef.current = starter;
    setActivePower(starter[0] ?? null);
    activePowerRef.current = starter[0] ?? null;
    setCoolingPowerId(null);
    setVultureLookoutActive(false);
  }, [currentProject?.id, currentLevel?.id, resetTick, computeStarterMisfitPowers]);

  const [activeCutawayHud, setActiveCutawayHud] = useState<{
    skitId: string;
    skitName: string;
    caption?: string;
    showLetterbox: boolean;
    narratorText?: string;
    speakerLabel?: string;
    beatIndex: number;
    totalBeats: number;
  } | null>(null);
  const skipCutawaySignalRef = useRef(false);
  const cutawayHeroLockRef = useRef(false);
  const rehearseSkitIdRef = useRef<string | null>(store.rehearseSkitId);
  rehearseSkitIdRef.current = store.rehearseSkitId;

  const isRoguelike = currentLevel?.gameplayMode === 'roguelike';
  const savedProgressForTitle = useMemo(() => {
    if (!showTitle || !currentProject || isRoguelike) return null;
    const saved = loadSavedPlayProgress(currentProject.id);
    if (!saved) return null;
    const lvl = currentProject.levels.find((l) => l.id === saved.levelId);
    if (!lvl) return null;
    return { saved, levelName: lvl.name };
  }, [showTitle, currentProject, isRoguelike]);
  const roguelikeConfig = currentLevel?.roguelikeConfig ?? DEFAULT_ROGUELIKE_CONFIG;

  const createFreshRoguelikeRun = useCallback((cfg: typeof DEFAULT_ROGUELIKE_CONFIG) => {
    const seed =
      cfg.seedMode === 'fixed'
        ? Math.max(1, Math.round(cfg.fixedSeed || 104729))
        : 100000 + Math.floor(Math.random() * 899999);
    const startHp = Math.max(2, Math.round(cfg.startingMaxHealth ?? 6));
    return {
      runSeed: seed,
      floorNumber: 1,
      activeRelics: [] as string[],
      enemiesSlain: 0,
      bossesSlain: 0,
      coinsEarned: 0,
      currentHealth: startHp,
      killStealProgress: 0,
      draftOptions: null as RoguelikeRelicDef[] | null,
      runSummary: null as {
        floorReached: number;
        enemiesSlain: number;
        bossesSlain: number;
        coinsEarned: number;
        relicIds: string[];
        runSeed: number;
      } | null,
    };
  }, []);

  const [roguelikeRun, setRoguelikeRun] = useState(() => createFreshRoguelikeRun(roguelikeConfig));
  const roguelikeRunRef = useRef(roguelikeRun);
  roguelikeRunRef.current = roguelikeRun;
  const [roguelikeHud, setRoguelikeHud] = useState({
    baddiesLeft: 0,
    baddiesTotal: 0,
    portalUnlocked: false,
  });

  useEffect(() => {
    if (!currentLevel || currentLevel.gameplayMode !== 'roguelike') return;
    setRoguelikeRun(
      createFreshRoguelikeRun(currentLevel.roguelikeConfig ?? DEFAULT_ROGUELIKE_CONFIG)
    );
  }, [currentProject?.id, currentLevel?.id, createFreshRoguelikeRun]);

  const activePlayLevel = useMemo(() => {
    if (!currentLevel) return null;
    if (currentLevel.gameplayMode !== 'roguelike') return currentLevel;
    return generateRoguelikeFloor(
      currentLevel,
      roguelikeRun.runSeed,
      roguelikeRun.floorNumber,
      currentLevel.roguelikeConfig
    );
  }, [currentLevel, roguelikeRun.runSeed, roguelikeRun.floorNumber]);

  const inventoryConfig = useMemo(
    () => resolveGameInventoryConfig(currentProject),
    [currentProject]
  );
  const inventoryConfigRef = useRef<GameInventoryConfig>(inventoryConfig);
  inventoryConfigRef.current = inventoryConfig;
  const harvestRuleByScatter = useMemo(() => {
    const map = new Map<string, GameInventoryConfig['worldCollectibles'][number]>();
    for (const r of inventoryConfig.worldCollectibles) {
      if (r.enabled) map.set(r.scatterKind, r);
    }
    return map;
  }, [inventoryConfig]);
  const harvestRuleByScatterRef = useRef(harvestRuleByScatter);
  harvestRuleByScatterRef.current = harvestRuleByScatter;

  const itemCatalog = useMemo(
    () => getProjectInventoryItems(currentProject),
    [currentProject]
  );
  const craftingRecipes = useMemo(
    () => getProjectCraftingRecipes(currentProject),
    [currentProject]
  );
  const itemById = useMemo(() => {
    const m = new Map<string, InventoryItemDef>();
    for (const item of itemCatalog) m.set(item.id, item);
    return m;
  }, [itemCatalog]);

  const inventoryStacksRef = useRef(inventoryStacks);
  inventoryStacksRef.current = inventoryStacks;
  const equipmentRef = useRef(equipment);
  equipmentRef.current = equipment;
  const itemByIdRef = useRef(itemById);
  itemByIdRef.current = itemById;
  const pendingConsumeRef = useRef<{ heal: number; stamina: number; magic: number }[]>([]);

  const chatSettings = useMemo(
    () => resolveChatDisplaySettings(currentProject?.chatSettings),
    [currentProject?.chatSettings]
  );
  const chatSettingsRef = useRef(chatSettings);
  chatSettingsRef.current = chatSettings;

  const heroChatStyle = useMemo(
    () => resolveChatBubbleStyle(currentProject?.heroChatBubble, 'hero'),
    [currentProject?.heroChatBubble]
  );
  const heroChatStyleRef = useRef(heroChatStyle);
  heroChatStyleRef.current = heroChatStyle;

  const activeSpeechesRef = useRef(activeSpeeches);
  activeSpeechesRef.current = activeSpeeches;
  const bubbleDomRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const appendHistory = useCallback((speaker: string, speakerColor: string, text: string) => {
    setChatHistory((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.speaker === speaker && last.text === text) return prev;
      return [
        ...prev.slice(-24),
        { id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, speaker, speakerColor, text },
      ];
    });
  }, []);

  const advanceOrDismissSpeechRef = useRef<(key: string) => void>(() => {});

  const playSpeechVoiceForLine = useCallback(
    (
      key: string,
      voiceConfig: DialogueVoiceConfig | undefined,
      outputMode: DialogueOutputMode,
      lineIndex: number,
      allowAudioPlayback = true
    ) => {
      if (!allowAudioPlayback || outputMode === 'text') return;
      const clipId = resolveVoiceClipForLine(voiceConfig, lineIndex);
      if (!clipId) return;
      AudioEngine.playVoiceClip(clipId, {
        ownerKey: key,
        volume: voiceConfig?.volume ?? 1.0,
        playbackRate: voiceConfig?.playbackRate ?? 1.0,
        onEnded: () => {
          if (voiceConfig?.autoAdvance || outputMode === 'audio') {
            advanceOrDismissSpeechRef.current(key);
          }
        },
      });
    },
    []
  );

  const pushCharacterSpeech = useCallback(
    (
      speech: Omit<ActiveCharacterSpeech, 'nonce' | 'outputMode'> & {
        outputMode?: DialogueOutputMode;
      },
      logToHistory = true,
      allowAudioPlayback = true
    ) => {
      const outputMode =
        speech.outputMode ??
        resolveEffectiveDialogueMode(chatSettingsRef.current, speech.voiceConfig);
      const text = speech.lines[speech.lineIndex] ?? speech.lines[0] ?? '';
      if (logToHistory && text && outputMode !== 'audio') {
        appendHistory(speech.speaker, speech.style.speakerColor, text);
      }
      playSpeechVoiceForLine(
        speech.key,
        speech.voiceConfig,
        outputMode,
        speech.lineIndex,
        allowAudioPlayback
      );
      setActiveSpeeches((prev) => {
        const existing = prev.find((s) => s.key === speech.key);
        const nextEntry: ActiveCharacterSpeech = {
          ...speech,
          outputMode,
          nonce: (existing?.nonce ?? 0) + 1,
        };
        if (existing) {
          return prev.map((s) => (s.key === speech.key ? nextEntry : s));
        }
        return [...prev, nextEntry];
      });
    },
    [appendHistory, playSpeechVoiceForLine]
  );

  const dismissCharacterSpeech = useCallback((key: string) => {
    AudioEngine.stopVoice(key);
    setActiveSpeeches((prev) => prev.filter((s) => s.key !== key));
  }, []);

  const advanceOrDismissSpeech = useCallback(
    (key: string) => {
      const current = activeSpeechesRef.current.find((s) => s.key === key);
      if (!current) return;
      if (current.lineIndex + 1 < current.lines.length) {
        const nextIdx = current.lineIndex + 1;
        const nextLine = current.lines[nextIdx];
        if (nextLine && current.outputMode !== 'audio') {
          appendHistory(current.speaker, current.style.speakerColor, nextLine);
        }
        playSpeechVoiceForLine(key, current.voiceConfig, current.outputMode, nextIdx, true);
        setActiveSpeeches((prev) =>
          prev.map((s) =>
            s.key === key
              ? {
                  ...s,
                  lineIndex: nextIdx,
                  isProximity: false,
                  nonce: s.nonce + 1,
                }
              : s
          )
        );
      } else {
        AudioEngine.stopVoice(key);
        setActiveSpeeches((prev) => prev.filter((s) => s.key !== key));
      }
    },
    [appendHistory, playSpeechVoiceForLine]
  );
  advanceOrDismissSpeechRef.current = advanceOrDismissSpeech;

  const triggerHeroSpeech = useCallback(
    (text: string, durationMs = 2800, voiceConfig?: DialogueVoiceConfig) => {
      const style = heroChatStyleRef.current;
      pushCharacterSpeech(
        {
          key: 'hero',
          entityId: 'hero',
          speaker: currentProject?.heroName || 'Hero',
          roleLabel: 'Hero',
          kind: 'hero',
          lines: [text],
          lineIndex: 0,
          style,
          voiceConfig,
          isProximity: false,
          expiresAt: performance.now() + durationMs,
        },
        Boolean(text.trim()),
        true
      );
    },
    [currentProject?.heroName, pushCharacterSpeech]
  );

  // Auto-expire timed bubbles (e.g. baddie shouts & hero emotes)
  useEffect(() => {
    if (!activeSpeeches.some((s) => s.expiresAt !== null)) return;
    const timer = window.setInterval(() => {
      const now = performance.now();
      setActiveSpeeches((prev) => {
        const filtered = prev.filter((s) => s.expiresAt === null || s.expiresAt > now);
        return filtered.length === prev.length ? prev : filtered;
      });
    }, 180);
    return () => window.clearInterval(timer);
  }, [activeSpeeches]);

  // Primary speech displayed when Bottom Chat Panel mode is active
  const activeBottomSpeech = useMemo<ActiveCharacterSpeech | null>(() => {
    if (chatSettings.displayMode !== 'bottomPanel') return null;
    const manual = [...activeSpeeches]
      .reverse()
      .find(
        (s) =>
          !s.isProximity &&
          s.outputMode !== 'audio' &&
          Boolean((s.lines[s.lineIndex] ?? s.lines[0] ?? '').trim())
      );
    return manual ?? null;
  }, [activeSpeeches, chatSettings.displayMode]);

  const panelPausesMovement = Boolean(
    (activeBottomSpeech &&
      chatSettings.panelPauseGame &&
      !activeBottomSpeech.isProximity &&
      activeBottomSpeech.outputMode !== 'audio') ||
      worldMapOpen ||
      fastTravelState !== null ||
      activeChestLoot !== null
  );

  const showToastGlobal = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((cur) => (cur === msg ? null : cur));
    }, 2600);
  }, []);

  const addItemToBag = useCallback(
    (itemId: string, qty = 1, autoEquipNewTool = false) => {
      const def = itemByIdRef.current.get(itemId);
      const meta = def ? resolveItemMetadata(def) : null;
      setInventoryStacks((prev) => {
        const existing = prev.find((s) => s.itemId === itemId);
        if (existing) {
          return prev.map((s) => (s.itemId === itemId ? { ...s, qty: s.qty + qty } : s));
        }
        return [
          ...prev,
          {
            itemId,
            qty,
            ...(meta && meta.maxDurability > 1
              ? { durability: meta.durability, maxDurability: meta.maxDurability }
              : {}),
          },
        ];
      });
      if (autoEquipNewTool && def && (def.category === 'tool' || def.category === 'weapon')) {
        setEquipment((prev) => ({ ...prev, heldItemId: itemId }));
      }
    },
    []
  );

  openChestModalFnRef.current = (entityId: string, chestName: string) => {
    const isCardShrine =
      chestName.toLowerCase().includes('card') ||
      (currentLevel?.gameplayMode === 'rpg' && currentLevel.rpgConfig?.lootMode === 'fannedCards');
    if (isCardShrine) {
      openRpgCardModalRef.current(chestName);
      return;
    }
    const entries = chestEntriesByEntityRef.current.get(entityId) ?? [];
    if (entries.length === 0) {
      showToastGlobal(`${chestName} is empty.`);
      return;
    }
    inputRef.current.keys.clear();
    inputRef.current.interactQueued = false;
    inputRef.current.interactPointerDown = false;
    setActiveChestLoot({
      entityId,
      chestName,
      entries: [...entries],
    });
  };

  const grantChestEntryToHero = useCallback(
    (entry: ChestLootEntry, silentToast = false) => {
      if (entry.kind === 'coin') {
        liveGrantCurrencyRef.current(entry.qty, 0);
        setHudState((prev) => ({ ...prev, coins: prev.coins + entry.qty }));
        if (!silentToast) {
          showToastGlobal(`Added +${entry.qty} Gold Coins!`);
        }
      } else if (entry.kind === 'key') {
        liveGrantCurrencyRef.current(0, entry.qty);
        setHudState((prev) => ({ ...prev, keys: prev.keys + entry.qty }));
        if (!silentToast) {
          showToastGlobal(`Added +${entry.qty} Key to inventory!`);
        }
      } else if (entry.kind === 'item' && entry.itemId) {
        addItemToBag(entry.itemId, entry.qty, false);
        if (!silentToast) {
          showToastGlobal(
            `Moved ${entry.qty > 1 ? `${entry.qty}× ` : ''}${entry.label} to inventory!`
          );
        }
      }
    },
    [addItemToBag, showToastGlobal]
  );

  const handleTakeChestEntry = useCallback(
    (entryUid: string) => {
      const current = activeChestLootRef.current;
      if (!current) return;
      const list = chestEntriesByEntityRef.current.get(current.entityId) ?? current.entries;
      const target = list.find((e) => e.uid === entryUid);
      if (!target) return;

      grantChestEntryToHero(target, false);
      AudioEngine.playSound(currentLevel?.audio?.coin ?? 'coin');

      const nextList = list.filter((e) => e.uid !== entryUid);
      list.length = 0;
      list.push(...nextList);
      chestEntriesByEntityRef.current.set(current.entityId, list);

      if (nextList.length === 0) {
        setActiveChestLoot(null);
      } else {
        setActiveChestLoot({
          ...current,
          entries: [...nextList],
        });
      }
    },
    [currentLevel?.audio?.coin, grantChestEntryToHero]
  );

  const handleTakeAllChestEntries = useCallback(() => {
    const current = activeChestLootRef.current;
    if (!current) return;
    const list = chestEntriesByEntityRef.current.get(current.entityId) ?? current.entries;
    if (list.length === 0) {
      setActiveChestLoot(null);
      return;
    }

    let coinTotal = 0;
    const itemLabels: string[] = [];
    for (const entry of list) {
      grantChestEntryToHero(entry, true);
      if (entry.kind === 'coin') coinTotal += entry.qty;
      else itemLabels.push(`${entry.qty > 1 ? `${entry.qty}× ` : ''}${entry.label}`);
    }

    list.length = 0;
    chestEntriesByEntityRef.current.set(current.entityId, list);
    AudioEngine.playSound(currentLevel?.audio?.coin ?? 'coin');
    AudioEngine.playSound('chime');

    const parts: string[] = [];
    if (coinTotal > 0) parts.push(`+${coinTotal} Coins`);
    if (itemLabels.length > 0) parts.push(itemLabels.join(', '));
    showToastGlobal(`Looted ${current.chestName}: ${parts.join(' · ')}!`);
    setActiveChestLoot(null);
  }, [currentLevel?.audio?.coin, grantChestEntryToHero, showToastGlobal]);

  const removeItemFromBag = useCallback((itemId: string, qty = 1) => {
    setInventoryStacks((prev) => {
      const next = prev
        .map((s) => (s.itemId === itemId ? { ...s, qty: s.qty - qty } : s))
        .filter((s) => s.qty > 0);
      const stillHas = next.some((s) => s.itemId === itemId);
      if (!stillHas) {
        setEquipment((eq) => ({
          heldItemId: eq.heldItemId === itemId ? null : eq.heldItemId,
          offhandItemId: eq.offhandItemId === itemId ? null : eq.offhandItemId,
          headItemId: eq.headItemId === itemId ? null : eq.headItemId,
          bodyItemId: eq.bodyItemId === itemId ? null : eq.bodyItemId,
          accessoryItemId: eq.accessoryItemId === itemId ? null : eq.accessoryItemId,
        }));
      }
      return next;
    });
  }, []);

  const handleHoldItem = useCallback((itemId: string | null) => {
    setEquipment((prev) => ({ ...prev, heldItemId: itemId }));
    if (itemId) {
      const def = itemByIdRef.current.get(itemId);
      if (def) {
        AudioEngine.playSound('step');
        showToastGlobal(`Holding ${def.name}`);
      }
    }
  }, [showToastGlobal]);

  const handleWearItem = useCallback(
    (item: InventoryItemDef) => {
      if (!item.wearSlot) return;
      setEquipment((prev) => ({
        ...prev,
        ...(item.wearSlot === 'head'
          ? { headItemId: item.id }
          : item.wearSlot === 'body'
          ? { bodyItemId: item.id }
          : item.wearSlot === 'offhand'
          ? { offhandItemId: item.id }
          : { accessoryItemId: item.id }),
      }));
      AudioEngine.playSound('chime');
      showToastGlobal(
        item.wearSlot === 'offhand' ? `Armed ${item.name} in off-hand!` : `Wearing ${item.name}!`
      );
    },
    [showToastGlobal]
  );

  const handleUnequipSlot = useCallback((slot: 'head' | 'body' | 'accessory' | 'offhand') => {
    setEquipment((prev) => ({
      ...prev,
      ...(slot === 'head'
        ? { headItemId: null }
        : slot === 'body'
        ? { bodyItemId: null }
        : slot === 'offhand'
        ? { offhandItemId: null }
        : { accessoryItemId: null }),
    }));
  }, []);

  const handleConsumeItem = useCallback(
    (item: InventoryItemDef) => {
      const has = inventoryStacksRef.current.find((s) => s.itemId === item.id && s.qty > 0);
      if (!has) return;
      removeItemFromBag(item.id, 1);
      pendingConsumeRef.current.push({
        heal: item.healAmount ?? 1,
        stamina: item.staminaAmount ?? 20,
        magic: item.magicAmount ?? 0,
      });
      AudioEngine.playSound('sparkle');
      const parts: string[] = [];
      if (item.healAmount) parts.push(`+${item.healAmount} HP`);
      if (item.staminaAmount) parts.push(`+${item.staminaAmount} Stamina`);
      if (item.magicAmount) parts.push(`+${item.magicAmount} Magic`);
      showToastGlobal(`Consumed ${item.name}${parts.length ? ` (${parts.join(', ')})` : ''}!`);
    },
    [removeItemFromBag, showToastGlobal]
  );

  const handleMixItems = useCallback(
    (itemIdA: string, itemIdB: string) => {
      const recipe = findCraftingRecipe(craftingRecipes, itemIdA, itemIdB);
      const resultId = recipe ? recipe.resultItemId : 'healing_tonic';
      const resultQty = recipe ? recipe.resultQty : 1;
      removeItemFromBag(itemIdA, 1);
      removeItemFromBag(itemIdB, 1);
      addItemToBag(resultId, resultQty, false);
      const resDef = itemByIdRef.current.get(resultId);
      AudioEngine.playSound('sparkle');
      AudioEngine.playSound('chime');
      showToastGlobal(`Mixed → ${resDef?.name ?? 'Crafted Item'}!`);
    },
    [addItemToBag, craftingRecipes, removeItemFromBag, showToastGlobal]
  );

  const handleCraftRecipe = useCallback(
    (recipe: CraftingRecipe) => {
      const qtyA = inventoryStacksRef.current.find((s) => s.itemId === recipe.ingredientA)?.qty ?? 0;
      const qtyB = inventoryStacksRef.current.find((s) => s.itemId === recipe.ingredientB)?.qty ?? 0;
      const canCraft =
        recipe.ingredientA === recipe.ingredientB ? qtyA >= 2 : qtyA >= 1 && qtyB >= 1;
      if (!canCraft) {
        showToastGlobal('Gather the required ingredients first!');
        return;
      }
      if (recipe.ingredientA === recipe.ingredientB) {
        removeItemFromBag(recipe.ingredientA, 2);
      } else {
        removeItemFromBag(recipe.ingredientA, 1);
        removeItemFromBag(recipe.ingredientB, 1);
      }
      const resDef = itemByIdRef.current.get(recipe.resultItemId);
      addItemToBag(
        recipe.resultItemId,
        recipe.resultQty,
        resDef?.category === 'weapon' || resDef?.category === 'tool'
      );
      AudioEngine.playSound('sparkle');
      AudioEngine.playSound('chime');
      showToastGlobal(
        `Crafted ${recipe.resultQty > 1 ? `${recipe.resultQty}× ` : ''}${resDef?.name ?? recipe.title}!`
      );
    },
    [addItemToBag, removeItemFromBag, showToastGlobal]
  );

  const handleRepairItem = useCallback(
    (itemId: string) => {
      const def = itemByIdRef.current.get(itemId);
      if (!def) return;
      const meta = resolveItemMetadata(def);
      store.repairItemDurability(itemId);
      setInventoryStacks((prev) =>
        prev.map((s) =>
          s.itemId === itemId
            ? { ...s, durability: meta.maxDurability, maxDurability: meta.maxDurability }
            : s
        )
      );
      AudioEngine.playSound('chime');
      showToastGlobal(`Repaired & sharpened ${def.name} to 100%!`);
    },
    [showToastGlobal, store]
  );

  const wearShieldDurability = useCallback(
    (amount = 2) => {
      const offId = equipmentRef.current.offhandItemId;
      if (!offId) return;
      const def = itemByIdRef.current.get(offId);
      if (!def) return;
      const baseMeta = resolveItemMetadata(def);
      if (baseMeta.maxDurability <= 1) return;
      store.wearItemDurability(offId, amount);
      setInventoryStacks((prev) =>
        prev.map((s) => {
          if (s.itemId !== offId) return s;
          const storeDur = store.runtimeDurability[offId];
          const maxD = storeDur?.maxDurability ?? s.maxDurability ?? baseMeta.maxDurability;
          const curD = storeDur?.durability ?? s.durability ?? baseMeta.durability;
          const nextD = Math.max(0, curD - amount);
          if (curD > Math.floor(maxD * 0.2) && nextD <= Math.floor(maxD * 0.2)) {
            showToastGlobal(`${def.name} is splintering — repair at a Crafting Bench!`);
          }
          return { ...s, durability: nextD, maxDurability: maxD };
        })
      );
    },
    [showToastGlobal, store]
  );

  const wearHeldDurability = useCallback(
    (amount = 2) => {
      const heldId = equipmentRef.current.heldItemId;
      if (!heldId) return;
      const def = itemByIdRef.current.get(heldId);
      if (!def || (def.category !== 'weapon' && def.category !== 'tool')) return;
      const baseMeta = resolveItemMetadata(def);
      store.wearItemDurability(heldId, amount);
      setInventoryStacks((prev) =>
        prev.map((s) => {
          if (s.itemId !== heldId) return s;
          const storeDur = store.runtimeDurability[heldId];
          const maxD = storeDur?.maxDurability ?? s.maxDurability ?? baseMeta.maxDurability;
          const curD = storeDur?.durability ?? s.durability ?? baseMeta.durability;
          const nextD = Math.max(0, curD - amount);
          if (curD > Math.floor(maxD * 0.2) && nextD <= Math.floor(maxD * 0.2)) {
            showToastGlobal(`${def.name} is getting dulled — sharpen at a Crafting Bench!`);
          }
          return { ...s, durability: nextD, maxDurability: maxD };
        })
      );
    },
    [showToastGlobal, store]
  );

  const effectiveInventoryStacks = useMemo(
    () =>
      inventoryStacks.map((st) => {
        const storeDur = store.runtimeDurability[st.itemId];
        return storeDur
          ? { ...st, durability: storeDur.durability, maxDurability: storeDur.maxDurability }
          : st;
      }),
    [inventoryStacks, store.runtimeDurability]
  );

  useEffect(() => {
    return () => {
      store.resetRuntimeDurability();
    };
  }, [store.resetRuntimeDurability]);

  // Derived hero profile + wearable/held bonuses for display in InventoryModal
  const heroBonusStats = useMemo(() => {
    const profile = resolveHeroProfile(currentProject);
    const skills = new Set(profile.skills);
    let maxHpBonus = 0;
    let attackPower =
      profile.stats.baseAttack +
      (skills.has('powerStrike') ? 1 : 0) +
      (skills.has('glassCannon') ? 2 : 0);
    let defensePower = Math.max(
      0,
      profile.stats.baseDefense +
        (skills.has('heavyArmorClumsy') ? 1 : 0) -
        (skills.has('glassCannon') ? 1 : 0)
    );
    let speedBonus = profile.stats.moveSpeedMult - 1;
    const heldDefForStats = equipment.heldItemId ? itemById.get(equipment.heldItemId) : null;
    const twoHandedForStats =
      heldDefForStats?.handedness === 'twoHand' ||
      heldDefForStats?.toolKind === 'axe' ||
      heldDefForStats?.toolKind === 'fishingPole';
    const activeIds = [
      equipment.heldItemId,
      ...(twoHandedForStats ? [] : [equipment.offhandItemId ?? null]),
      equipment.headItemId,
      equipment.bodyItemId,
      equipment.accessoryItemId,
    ];
    for (const id of activeIds) {
      if (!id) continue;
      const def = itemById.get(id);
      if (!def) continue;
      if (id !== equipment.heldItemId || def.category === 'weapon' || def.category === 'tool') {
        attackPower += def.attackBonus ?? 0;
      }
      if (id !== equipment.heldItemId) {
        maxHpBonus += def.maxHealthBonus ?? 0;
        speedBonus += def.speedBonus ?? 0;
      }
      defensePower += def.defenseBonus ?? 0;
    }
    return {
      maxHpBonus,
      attackPower,
      defensePower,
      speedPct: Math.round((1 + speedBonus) * 100),
    };
  }, [currentProject, equipment, itemById]);

  const quickHotbarTools = useMemo(() => {
    return inventoryStacks
      .filter((s) => s.qty > 0)
      .map((s) => ({ stack: s, def: itemById.get(s.itemId) }))
      .filter(
        (x): x is { stack: InventoryStack; def: InventoryItemDef } =>
          Boolean(x.def && (x.def.category === 'tool' || x.def.category === 'weapon'))
      )
      .slice(0, 5);
  }, [inventoryStacks, itemById]);

  const envType = getEnvironmentType(activePlayLevel ?? currentLevel);
  const isDrivingMode = currentLevel?.gameplayMode === 'driving';
  const isBuddiesMode =
    currentLevel?.gameplayMode === 'buddies' || currentLevel?.completeCondition === 'gatherBuddies';
  const baseCamMode: CameraMode =
    currentLevel?.cameraMode ?? (envType === 'sideScroller' ? 'sideScroll' : 'front');
  const [liveCamMode, setLiveCamMode] = useState<CameraMode>(baseCamMode);
  useEffect(() => {
    setLiveCamMode(baseCamMode);
  }, [baseCamMode, currentLevel?.id, resetTick]);
  const resolvedCamMode: CameraMode = isDrivingMode ? baseCamMode : liveCamMode;
  const resolvedCamModeRef = useRef<CameraMode>(resolvedCamMode);
  resolvedCamModeRef.current = resolvedCamMode;
  const liveHeroYawRef = useRef(0);
  const initialStartPt =
    store.playFromPoint ??
    activePlayLevel?.startPoint ??
    currentLevel?.startPoint ??
    (envType === 'sideScroller' ? { x: 0.1, y: 0.5 } : { x: 0.14, y: 0.8 });
  const initialPortalPt =
    activePlayLevel?.portalPoint ??
    currentLevel?.portalPoint ??
    (envType === 'sideScroller' ? { x: 0.92, y: 0.5 } : { x: 0.88, y: 0.24 });

  useEffect(() => {
    setDrivingCfg({
      carId: currentLevel?.drivingConfig?.carId ?? 'trailBuggy',
      physicsId: currentLevel?.drivingConfig?.physicsId ?? 'arcadeDrift',
      driverId: currentLevel?.drivingConfig?.driverId ?? 'stunt',
      cameraView: currentLevel?.drivingConfig?.cameraView ?? 'closeChase',
      customVehicle: currentLevel?.drivingConfig?.customVehicle,
    });
    introSpokenRef.current = false;
  }, [
    currentLevel?.id,
    currentLevel?.drivingConfig?.carId,
    currentLevel?.drivingConfig?.physicsId,
    currentLevel?.drivingConfig?.driverId,
    currentLevel?.drivingConfig?.cameraView,
    JSON.stringify(currentLevel?.drivingConfig?.customVehicle ?? null),
  ]);

  const [hudState, setHudState] = useState<HUDState>({
    health: isRoguelike ? roguelikeConfig.startingMaxHealth : 6,
    maxHealth: isRoguelike ? roguelikeConfig.startingMaxHealth : 6,
    stamina: 100,
    energy: 100,
    magic: 100,
    coins: 0,
    keys: 0,
    timeText: '0:00',
    objectives: (activePlayLevel ?? currentLevel)?.objectives.map((o) => o.text) ?? [],
    heroPoint: initialStartPt,
    portalPoint: initialPortalPt,
    baddiePoints: [],
    flashHealth: false,
  });

  const mountRef = useRef<HTMLDivElement | null>(null);

  const inputRef = useRef({
    keys: new Set<string>(),
    joyX: 0,
    joyY: 0,
    jumpQueued: false,
    jumpPointerDown: false,
    jumpPressQueuedCount: 0,
    attackQueued: false,
    arrowQueued: false,
    interactQueued: false,
    interactPointerDown: false,
    magicQueued: false,
    healQueued: false,
    misfitPowerQueued: false,
    vultureExitQueued: false,
    carResetQueued: false,
    emoteType: '' as '' | 'wave' | 'dance',
    emoteTimer: 0,
    cameraYaw:
      resolvedCamMode === 'front' || resolvedCamMode === 'heroFront' || resolvedCamMode === 'sideScroll'
        ? 0
        : isRpgMode
        ? Math.PI * 0.25
        : 0.4,
    lookYawOffset: 0,
    lookPitchOffset: 0,
    cameraDistance:
      isDrivingMode
        ? 11.2
        : isRpgMode
        ? currentLevel?.rpgConfig?.isInterior
          ? 18.5
          : currentLevel?.rpgConfig?.cameraZoom ?? 23.5
        : resolvedCamMode === 'cozy'
        ? 6.6
        : resolvedCamMode === 'close'
        ? 4.6
        : resolvedCamMode === 'isometric'
        ? 14.5
        : resolvedCamMode === 'front'
        ? 9.8
        : resolvedCamMode === 'heroFront'
        ? 9.2
        : 8.8,
  });

  const toggleCharacterPov = useCallback(() => {
    if (isDrivingMode || envType === 'sideScroller') return;
    setLiveCamMode((prev) => {
      const baseIsSpecial =
        baseCamMode === 'front' ||
        baseCamMode === 'close' ||
        baseCamMode === 'heroFront' ||
        baseCamMode === 'firstPerson';
      const cycleOrder: CameraMode[] = baseIsSpecial
        ? ['front', 'close', 'heroFront', 'firstPerson', 'isometric']
        : [baseCamMode, 'front', 'close', 'heroFront', 'firstPerson'];
      const curIdx = cycleOrder.indexOf(prev);
      const next: CameraMode = cycleOrder[(curIdx + 1) % cycleOrder.length];

      inputRef.current.lookPitchOffset = 0;
      inputRef.current.lookYawOffset = 0;
      if (next === 'firstPerson') {
        const hy = liveHeroYawRef.current;
        inputRef.current.cameraYaw = Math.atan2(-Math.sin(hy), -Math.cos(hy));
      } else if (next === 'front') {
        // Lock right behind hero facing forward
        inputRef.current.lookYawOffset = 0;
        inputRef.current.lookPitchOffset = 0;
      } else if (next === 'close' && prev === 'front') {
        const hy = liveHeroYawRef.current;
        inputRef.current.cameraYaw = Math.atan2(-Math.sin(hy), -Math.cos(hy));
      } else if (next === 'close' && prev === 'heroFront') {
        inputRef.current.cameraYaw = liveHeroYawRef.current;
      } else if (prev === 'firstPerson') {
        inputRef.current.cameraYaw = Math.atan2(
          -Math.sin(inputRef.current.cameraYaw),
          -Math.cos(inputRef.current.cameraYaw)
        );
      }
      showToastGlobal(
        next === 'firstPerson'
          ? 'Camera: Character POV (First-Person)'
          : next === 'front'
          ? 'Camera: Front View (Behind Hero)'
          : next === 'heroFront'
          ? 'Camera: Face View (Facing You)'
          : next === 'close'
          ? 'Camera: Close View'
          : `Camera: ${next === 'cozy' ? 'Cozy Behind' : next === 'isometric' ? 'Isometric' : 'Chase'} View`
      );
      return next;
    });
  }, [baseCamMode, envType, isDrivingMode, showToastGlobal]);

  useEffect(() => {
    inputRef.current.cameraYaw =
      baseCamMode === 'front' || baseCamMode === 'heroFront' || baseCamMode === 'sideScroll'
        ? 0
        : isRpgMode
        ? Math.PI * 0.25
        : 0.4;
    inputRef.current.lookYawOffset = 0;
    inputRef.current.lookPitchOffset = 0;
    inputRef.current.cameraDistance =
      isDrivingMode
        ? 11.2
        : isRpgMode
        ? currentLevel?.rpgConfig?.isInterior
          ? 18.5
          : currentLevel?.rpgConfig?.cameraZoom ?? 23.5
        : baseCamMode === 'cozy'
        ? 6.6
        : baseCamMode === 'isometric'
        ? 14.5
        : baseCamMode === 'front'
        ? 9.8
        : baseCamMode === 'heroFront'
        ? 9.2
        : 8.8;
  }, [currentLevel?.id, baseCamMode, isDrivingMode, isRpgMode, currentLevel?.rpgConfig?.isInterior, currentLevel?.rpgConfig?.cameraZoom]);

  useEffect(() => {
    const hasIntroText = Boolean(currentLevel?.heroIntroSpeech?.trim());
    const hasIntroVoice = Boolean(resolveVoiceClipForLine(currentLevel?.heroIntroVoice, 0));
    if (showTitle || (!hasIntroText && !hasIntroVoice) || introSpokenRef.current) return;
    introSpokenRef.current = true;
    const t = window.setTimeout(() => {
      triggerHeroSpeech(
        currentLevel?.heroIntroSpeech ?? '',
        hasIntroVoice ? 12000 : 7800,
        currentLevel?.heroIntroVoice
      );
    }, 320);
    return () => window.clearTimeout(t);
  }, [
    showTitle,
    currentLevel?.id,
    currentLevel?.heroIntroSpeech,
    currentLevel?.heroIntroVoice,
    resetTick,
    triggerHeroSpeech,
  ]);

  useEffect(() => {
    return () => {
      AudioEngine.stopVoice();
      store.setRehearseSkitId(null);
    };
  }, [store.setRehearseSkitId]);

  useEffect(() => {
    const onResizeWindow = () => {
      setViewSize({ w: window.innerWidth, h: window.innerHeight });
    };
    window.addEventListener('resize', onResizeWindow);
    return () => window.removeEventListener('resize', onResizeWindow);
  }, []);

  const flagsRef = useRef({
    paused: false,
    pausedByScreen: true,
    finished: false,
    dead: false,
  });

  const hasRelicDraftOpen = Boolean(roguelikeRun.draftOptions);

  flagsRef.current = {
    paused,
    pausedByScreen:
      showTitle ||
      paused ||
      finished ||
      dead ||
      panelPausesMovement ||
      inventoryOpen ||
      worldMapOpen ||
      fastTravelState !== null ||
      activeChestLoot !== null ||
      hasRelicDraftOpen,
    finished,
    dead,
  };

  useEffect(() => {
    store.setPlayModalOpen(
      showTitle ||
        paused ||
        finished ||
        dead ||
        inventoryOpen ||
        worldMapOpen ||
        fastTravelState !== null ||
        activeChestLoot !== null ||
        hasRelicDraftOpen
    );
    return () => store.setPlayModalOpen(false);
  }, [
    showTitle,
    paused,
    finished,
    dead,
    inventoryOpen,
    worldMapOpen,
    fastTravelState,
    activeChestLoot,
    hasRelicDraftOpen,
    store.setPlayModalOpen,
  ]);

  const enabledSet = useMemo(
    () => new Set(currentProject?.enabledActions ?? []),
    [currentProject?.enabledActions]
  );

  // Music lifecycle
  useEffect(() => {
    if (!currentLevel || showTitle || paused || finished || dead) {
      AudioEngine.stopMusic();
      return;
    }
    AudioEngine.startMusic(currentLevel.audio.mood);
    return () => AudioEngine.stopMusic();
  }, [currentLevel?.id, currentLevel?.audio.mood, showTitle, paused, finished, dead]);

  // Keyboard listeners
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Prevent Tab from moving focus off the game viewport
      if (e.code === 'Tab') {
        e.preventDefault();
      }

      const toggleCode = inventoryConfigRef.current.toggleKey || 'Tab';
      const matchesInventoryKey =
        e.code === toggleCode ||
        (toggleCode === 'Tab' && (e.code === 'KeyI' || e.code === 'KeyB'));
      if (matchesInventoryKey && !e.repeat) {
        e.preventDefault();
        if (!flagsRef.current.paused && !flagsRef.current.finished && !flagsRef.current.dead) {
          setInventoryOpen((open) => {
            if (!open) setInventoryMode('bag');
            return !open;
          });
        }
        return;
      }

      if (e.code === 'KeyM' && !e.repeat) {
        const activeTag = (document.activeElement as HTMLElement | null)?.tagName;
        if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA' && activeTag !== 'SELECT') {
          e.preventDefault();
          if (
            !showTitleRef.current &&
            !flagsRef.current.paused &&
            !flagsRef.current.finished &&
            !flagsRef.current.dead
          ) {
            setFastTravelState(null);
            setWorldMapOpen((open) => !open);
          }
          return;
        }
      }

      // When Bottom Chat Panel is open & blocking, allow E / Space / Enter / Escape to advance or close
      if (
        chatSettingsRef.current.displayMode === 'bottomPanel' &&
        !e.repeat
      ) {
        const curBottom = [...activeSpeechesRef.current]
          .reverse()
          .find((s) => !s.isProximity);
        if (curBottom) {
          if (
            e.code === 'KeyE' ||
            e.code === 'AltLeft' ||
            e.code === 'AltRight' ||
            e.code === 'Space' ||
            e.code === 'Enter'
          ) {
            e.preventDefault();
            advanceOrDismissSpeech(curBottom.key);
            return;
          }
          if (e.code === 'Escape') {
            e.preventDefault();
            dismissCharacterSpeech(curBottom.key);
            return;
          }
        }
      }

      if (
        (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') &&
        !e.repeat
      ) {
        e.preventDefault();
        if (vultureLookoutActiveRef.current) {
          inputRef.current.vultureExitQueued = true;
          return;
        }
        if (cutawayHeroLockRef.current) {
          skipCutawaySignalRef.current = true;
          return;
        }
        inputRef.current.jumpQueued = true;
        inputRef.current.jumpPressQueuedCount += 1;
      } else if (e.code === 'Space') {
        e.preventDefault();
      } else if (
        envType === 'sideScroller' &&
        (e.code === 'KeyW' || e.code === 'ArrowUp') &&
        !e.repeat
      ) {
        e.preventDefault();
        inputRef.current.jumpQueued = true;
        inputRef.current.jumpPressQueuedCount += 1;
      } else if (
        e.code === 'ArrowUp' ||
        e.code === 'ArrowDown' ||
        e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight'
      ) {
        e.preventDefault();
      } else if (
        e.code === 'KeyF' ||
        e.code === 'KeyJ' ||
        ((e.code === 'ControlLeft' || e.code === 'ControlRight') && !e.repeat)
      ) {
        if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
          e.preventDefault();
        }
        if (e.code === 'KeyF' && currentLevel?.gameplayMode === 'rpg') {
          setRpgStats((prev) => ({ ...prev, activeCombatStyle: 'magic' }));
          inputRef.current.magicQueued = true;
        } else {
          if (currentLevel?.gameplayMode === 'rpg') {
            setRpgStats((prev) => ({ ...prev, activeCombatStyle: 'sword' }));
          }
          inputRef.current.attackQueued = true;
        }
      } else if (
        (e.code === 'KeyE' && !e.repeat) ||
        ((e.code === 'AltLeft' || e.code === 'AltRight') && !e.repeat)
      ) {
        if (e.code === 'AltLeft' || e.code === 'AltRight') {
          e.preventDefault();
        }
        inputRef.current.interactQueued = true;
      } else if (e.code === 'KeyQ' && !e.repeat && !isDrivingMode) {
        if (vultureLookoutActiveRef.current) {
          inputRef.current.vultureExitQueued = true;
        } else if (!flagsRef.current.pausedByScreen) {
          inputRef.current.misfitPowerQueued = true;
        }
      } else if (e.code === 'KeyX' && !e.repeat && !isDrivingMode) {
        const list = unlockedPowersRef.current;
        if (list.length > 0 && !flagsRef.current.pausedByScreen) {
          const curIdx = activePowerRef.current ? list.indexOf(activePowerRef.current) : -1;
          const next = list[(curIdx + 1) % list.length];
          activePowerRef.current = next;
          setActivePower(next);
          const meta = MisfitAbilityById[next];
          AudioEngine.playSound('step');
          showToastGlobal(`${meta.title}: ${meta.strengthLabel}`);
        }
      } else if (e.code === 'KeyV' && !e.repeat && !isDrivingMode && envType !== 'sideScroller') {
        toggleCharacterPov();
      } else if (e.code === 'KeyR') {
        if (currentLevel?.gameplayMode === 'driving') {
          inputRef.current.carResetQueued = true;
        } else if (currentLevel?.gameplayMode === 'rpg') {
          setRpgStats((prev) => ({ ...prev, activeCombatStyle: 'arrow' }));
          inputRef.current.arrowQueued = true;
        } else {
          inputRef.current.magicQueued = true;
        }
      } else if (e.code === 'KeyC' && !e.repeat && currentLevel?.gameplayMode === 'driving') {
        const order: DrivingCameraView[] = ['driverPov', 'closeChase', 'farChase'];
        const curView: DrivingCameraView = drivingCfgRef.current.cameraView ?? 'closeChase';
        const nextView = order[(order.indexOf(curView) + 1) % order.length];
        setDrivingCfg((prev) => ({ ...prev, cameraView: nextView }));
        showToastGlobal(`Camera: ${getDrivingCameraView(nextView).name}`);
      } else if (e.code === 'KeyH') {
        inputRef.current.healQueued = true;
      } else if (e.code === 'KeyT' && !e.repeat) {
        triggerHeroSpeech("Onward to adventure!", 2600);
      } else if (e.code === 'Digit1') {
        if (currentLevel?.gameplayMode === 'rpg') {
          setRpgStats((prev) => ({ ...prev, activeCombatStyle: 'sword' }));
          inputRef.current.attackQueued = true;
        } else {
          inputRef.current.emoteType = 'wave';
          inputRef.current.emoteTimer = 1.4;
          if (!e.repeat) triggerHeroSpeech('Hey there!', 2200);
        }
      } else if (e.code === 'Digit2') {
        if (currentLevel?.gameplayMode === 'rpg') {
          setRpgStats((prev) => ({ ...prev, activeCombatStyle: 'arrow' }));
          inputRef.current.arrowQueued = true;
        } else {
          inputRef.current.emoteType = 'dance';
          inputRef.current.emoteTimer = 2.0;
          if (!e.repeat) triggerHeroSpeech('Time to celebrate!', 2400);
        }
      } else if (e.code === 'Digit3' && currentLevel?.gameplayMode === 'rpg' && !e.repeat) {
        setRpgStats((prev) => ({ ...prev, activeCombatStyle: 'magic' }));
        inputRef.current.magicQueued = true;
      } else if (e.code === 'Digit4' && currentLevel?.gameplayMode === 'rpg' && !e.repeat) {
        inputRef.current.healQueued = true;
      } else if (
        (e.code === 'Digit3' || e.code === 'Digit4' || e.code === 'Digit5' || e.code === 'Digit6') &&
        !e.repeat
      ) {
        const slotIdx = Number(e.code.replace('Digit', '')) - 3;
        const holdables = inventoryStacksRef.current
          .filter((s) => s.qty > 0)
          .map((s) => itemByIdRef.current.get(s.itemId))
          .filter((d): d is InventoryItemDef => Boolean(d && (d.category === 'tool' || d.category === 'weapon')));
        const picked = holdables[slotIdx];
        if (picked) {
          handleHoldItem(picked.id);
        }
      } else if (e.code === 'Escape') {
        if (rpgCardModalRef.current) {
          setRpgCardModal(null);
        } else if (activeChestLootRef.current) {
          setActiveChestLoot(null);
        } else if (fastTravelStateRef.current) {
          setFastTravelState(null);
        } else if (worldMapOpenRef.current) {
          setWorldMapOpen(false);
        } else {
          setInventoryOpen((open) => {
            if (open) return false;
            setPaused((p) => !p);
            return false;
          });
        }
      }
      inputRef.current.keys.add(e.code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      inputRef.current.keys.delete(e.code);
    };

    const onWindowBlur = () => {
      inputRef.current.keys.clear();
      inputRef.current.interactPointerDown = false;
      inputRef.current.jumpPointerDown = false;
      inputRef.current.jumpPressQueuedCount = 0;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [
    envType,
    isDrivingMode,
    currentLevel?.gameplayMode,
    advanceOrDismissSpeech,
    dismissCharacterSpeech,
    triggerHeroSpeech,
    handleHoldItem,
    showToastGlobal,
    toggleCharacterPov,
  ]);

  const liveQualityTargetRef = useRef<{
    renderer: WebGPURenderer;
    sun: THREE.DirectionalLight;
    postPipeline: PostProcessingPipeline | null;
    container: HTMLDivElement;
    isSoftwareGl: boolean;
  } | null>(null);
  const liveQualityValuesRef = useRef({
    resolutionScale: store.viewportResolutionScale,
    shadowQuality: store.viewportShadowQuality,
    terrainQuality: store.terrainQuality,
  });
  liveQualityValuesRef.current = {
    resolutionScale: store.viewportResolutionScale,
    shadowQuality: store.viewportShadowQuality,
    terrainQuality: store.terrainQuality,
  };

  useEffect(() => {
    const target = liveQualityTargetRef.current;
    if (!target || target.postPipeline?.isPrecompiling()) return;
    applyLiveRendererQuality(
      target.renderer,
      target.sun,
      target.postPipeline,
      target.container.clientWidth || 800,
      target.container.clientHeight || 600,
      target.isSoftwareGl,
      store.viewportResolutionScale,
      store.viewportShadowQuality
    );
  }, [store.viewportResolutionScale, store.viewportShadowQuality]);

  // Main Three.js game runtime
  useEffect(() => {
    const container = mountRef.current;
    if (!container || !currentProject || !activePlayLevel) return;
    const activeProject = currentProject;
    const activeLevel = activePlayLevel;
    const isRoguelikeLevel = activeLevel.gameplayMode === 'roguelike';
    const activeAssets = store.customAssets;
    const env = getEnvironmentType(activeLevel);
    const style = activeLevel.visualStyle ?? 'painterlyPBR';
    const camMode: CameraMode =
      activeLevel.cameraMode ?? (env === 'sideScroller' ? 'sideScroll' : 'front');

    const isIOS = isIOSDevice();
    const isSoftwareGl = detectSoftwareGl();
    let renderer = createMakerRenderer(isSoftwareGl);
    renderer.setSize(container.clientWidth || 800, container.clientHeight || 600);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    ensureSkyDome(scene);

    const camera = new THREE.PerspectiveCamera(
      camMode === 'firstPerson'
        ? 68
        : camMode === 'heroFront'
        ? 58
        : camMode === 'sideScroll'
        ? 42
        : camMode === 'cozy'
        ? 48
        : camMode === 'isometric'
        ? 42
        : 52,
      (container.clientWidth || 800) / Math.max(1, container.clientHeight || 600),
      0.15,
      5200
    );

    const hemi = new THREE.HemisphereLight('#B8E4FF', '#5F7844', 0.75);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight('#FFF5E0', 1.85);
    sun.castShadow = !isSoftwareGl;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -36;
    sun.shadow.camera.right = 36;
    sun.shadow.camera.top = 36;
    sun.shadow.camera.bottom = -36;
    sun.shadow.camera.near = 2;
    sun.shadow.camera.far = 160;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    sun.shadow.autoUpdate = false;
    sun.shadow.needsUpdate = !isSoftwareGl;
    scene.add(sun);
    scene.add(sun.target);
    let sunCsm: CsmShadowHandle | null = attachSunCSM(sun, {
      isSoftwareGl,
      cascades: 3,
      maxFar: 185,
      lightMargin: 85,
      mapSize: 1024,
    });
    const heroFootIK = new CharacterFootIKController();
    let prevHeroYawForIK = 0;
    let wasAirborneForIK = false;

    const fpsTorchLight = new THREE.PointLight('#FFAA4C', 0, 14, 1.5);
    scene.add(fpsTorchLight);

    let envTex: THREE.Texture | null = null;
    let postPipeline: PostProcessingPipeline | null = null;
    let wildlifeSystem: WildlifeFlockingSystem | null = null;
    let worldInteract: WorldInteractivitySystem | null = null;
    let navMeshEngine: PlayNavMeshEngine | null = null;
    let rapierPhysics: HybridRapierPhysicsWorld | null = null;
    const rapierTumblingIds = new Set<string>();
    const _aimRaycaster = new THREE.Raycaster();
    const _aimNdc = new THREE.Vector2();
    const _aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const _aimHit = new THREE.Vector3();
    let latestHeroYForAim = 0;
    let caveEyeAdaptBlend = 0;
    let basePlayExposure = renderer.toneMappingExposure || 1.05;
    let baseHemiIntensity = hemi.intensity;
    const baseHemiSkyColor = hemi.color.clone();
    const baseHemiGroundColor = hemi.groundColor.clone();
    const caveHemiSkyColor = new THREE.Color('#64748B');
    const caveHemiGroundColor = new THREE.Color('#1E293B');
    const caveFillLight = new THREE.PointLight('#93C5FD', 0, 14, 1.8);
    scene.add(caveFillLight);
    const timer = new THREE.Timer();

    let frameId = 0;
    let disposed = false;
    let dom = renderer.domElement;

    let lastResizeW = container.clientWidth || 800;
    let lastResizeH = Math.max(1, container.clientHeight || 600);
    let pendingResize: { w: number; h: number } | null = null;

    const applyContainerResize = (w: number, h: number) => {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      postPipeline?.setSize(w, h);
      sunCsm?.updateFrustums();
    };

    const onResize = () => {
      if (!container || disposed) return;
      const w = container.clientWidth || 800;
      const h = Math.max(1, container.clientHeight || 600);
      if (w === lastResizeW && h === lastResizeH) return;
      lastResizeW = w;
      lastResizeH = h;
      if (postPipeline?.isPrecompiling()) {
        pendingResize = { w, h };
        return;
      }
      applyContainerResize(w, h);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    // Drag anywhere on the screen to look around; Driving mode keeps the camera locked to car heading & steering
    const isDrivingLevel = activeLevel.gameplayMode === 'driving';
    const canOrbit = camMode !== 'sideScroll' && !isDrivingLevel;
    let draggingCam = false;
    let lastCamX = 0;
    let lastCamY = 0;
    const onPointerDown = (e: PointerEvent) => {
      if (!canOrbit) return;
      draggingCam = true;
      lastCamX = e.clientX;
      lastCamY = e.clientY;
    };
    const onPointerMove = (e: PointerEvent) => {
      // When carrying a rock or boulder, moving the cursor smoothly guides the 3D orange aiming bullseye
      if (worldInteract?.carriedRock && !draggingCam) {
        const rect = dom.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          _aimNdc.set(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1
          );
          _aimPlane.constant = -latestHeroYForAim;
          _aimRaycaster.setFromCamera(_aimNdc, camera);
          if (_aimRaycaster.ray.intersectPlane(_aimPlane, _aimHit)) {
            worldInteract.setPointerAimWorldPoint(_aimHit.x, _aimHit.z);
          }
        }
      }
      if (!draggingCam || !canOrbit) return;
      const dx = e.clientX - lastCamX;
      const dy = e.clientY - lastCamY;
      lastCamX = e.clientX;
      lastCamY = e.clientY;
      const activeMode = resolvedCamModeRef.current;
      if (activeMode === 'firstPerson') {
        inputRef.current.cameraYaw -= dx * 0.0055;
        inputRef.current.lookPitchOffset = THREE.MathUtils.clamp(
          inputRef.current.lookPitchOffset - dy * 0.0045,
          -1.15,
          1.15
        );
      } else if (activeMode === 'front') {
        inputRef.current.lookYawOffset -= dx * 0.007;
        inputRef.current.lookPitchOffset = THREE.MathUtils.clamp(
          inputRef.current.lookPitchOffset + dy * 0.025,
          -1.2,
          4.8
        );
      } else if (activeMode === 'heroFront') {
        inputRef.current.lookYawOffset += dx * 0.007;
        inputRef.current.lookPitchOffset = THREE.MathUtils.clamp(
          inputRef.current.lookPitchOffset + dy * 0.025,
          -1.2,
          4.8
        );
      } else {
        inputRef.current.cameraYaw -= dx * 0.007;
        inputRef.current.lookPitchOffset = THREE.MathUtils.clamp(
          inputRef.current.lookPitchOffset + dy * 0.02,
          -1.0,
          4.0
        );
      }
    };
    const onPointerUp = () => {
      draggingCam = false;
    };
    const onWheel = (e: WheelEvent) => {
      if (worldInteract?.carriedRock) {
        worldInteract.adjustAimRange(-e.deltaY * 0.008);
        return;
      }
      const activeMode = resolvedCamModeRef.current;
      if (activeMode === 'sideScroll' || activeMode === 'firstPerson' || isDrivingLevel) return;
      inputRef.current.cameraDistance = THREE.MathUtils.clamp(
        inputRef.current.cameraDistance + e.deltaY * 0.008,
        5.0,
        activeLevel.gameplayMode === 'rpg' ? 36 : 24
      );
    };

    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    dom.addEventListener('wheel', onWheel, { passive: true });

    const showToast = (msg: string) => {
      setToast(msg);
      window.setTimeout(() => {
        setToast((cur) => (cur === msg ? null : cur));
      }, 2400);
    };

    const activeFxRuntimes: FxEmitterRuntime[] = [];
    const monsterVfx = new MonsterAttackVfxController(scene);
    const heroEffects = new HeroCombatEffectsController(scene);
    let activeRuntimeEntities: RuntimeEntity[] = [];
    const scentPuffGeo = new THREE.SphereGeometry(0.42, 10, 10);
    const sonarRingGeo = new THREE.RingGeometry(0.75, 1.08, 36);
    sonarRingGeo.rotateX(-Math.PI / 2);
    const revealBeaconGeo = new THREE.CylinderGeometry(0.18, 0.42, 11, 10, 1, true);
    let islandAbort: AbortController | null = null;
    let islandHandlesRef: IslandSceneHandles | null = null;

    const bootAndRun = async () => {
      if (isIOS) {
        // Allow iOS Safari/WebKit to reclaim the unmounted editor WebGL/WebGPU buffers before allocating Play Mode GPU memory
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        );
        if (disposed) return;
      }
      let initOk = false;
      const initHardwareWebGLFallback = async () => {
        if (disposed) return false;
        dom.removeEventListener('pointerdown', onPointerDown);
        dom.removeEventListener('wheel', onWheel);
        try {
          renderer.dispose();
        } catch {
          // ignore dispose errors on failed adapter
        }
        renderer = createMakerRenderer(isSoftwareGl, true);
        renderer.setSize(container.clientWidth || 800, container.clientHeight || 600);
        container.innerHTML = '';
        container.appendChild(renderer.domElement);
        dom = renderer.domElement;
        dom.addEventListener('pointerdown', onPointerDown);
        dom.addEventListener('wheel', onWheel, { passive: true });
        try {
          await initMakerRenderer(renderer);
          return true;
        } catch (fallbackErr) {
          console.error('PlayMode WebGL fallback renderer init failed:', fallbackErr);
          return false;
        }
      };

      try {
        await initMakerRenderer(renderer);
        if (!isSoftwareGl && isWebGPUFallbackAdapter(renderer)) {
          console.warn('PlayMode WebGPU returned a software fallback adapter; switching to hardware WebGL2.');
          initOk = await initHardwareWebGLFallback();
        } else {
          initOk = true;
        }
      } catch (err) {
        console.warn('PlayMode WebGPU renderer init failed; falling back to WebGL backend:', err);
        initOk = await initHardwareWebGLFallback();
      }
      if (disposed || !initOk) return;
      sanitizeObjectMorphTargets(scene, {
        maxLayers: getRendererMaxTextureArrayLayers(renderer),
        cloneSharedGeometries: true,
      });
      // Yield one frame after GPU init so PMREM, PostProcessing, and terrain don't stack onto one long task
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (disposed) return;

      const backend = renderer.backend as { isWebGPUBackend?: boolean } | undefined;
      const pointLightCount = activeLevel.entities.filter((e) => e.kind === 'light').length;
      if (backend?.isWebGPUBackend === true && !isSoftwareGl) {
        if (!isIOS && (env === 'dungeon' || pointLightCount >= 6)) {
          renderer.lighting = new ClusteredLighting(128, 64, 16, 16);
        }
        if (activeLevel.entities.some((e) => e.meshletEnabled)) {
          renderer.drawingPipeline = createOptInMeshletPipeline(renderer);
        }
      }
      envTex = setupSceneEnvironment(scene, renderer);
      postPipeline = new PostProcessingPipeline(
        renderer,
        scene,
        camera,
        container.clientWidth || 800,
        container.clientHeight || 600,
        isSoftwareGl
      );
      applyLiveRendererQuality(
        renderer,
        sun,
        postPipeline,
        container.clientWidth || 800,
        container.clientHeight || 600,
        isSoftwareGl,
        liveQualityValuesRef.current.resolutionScale,
        liveQualityValuesRef.current.shadowQuality
      );

      // Yield a frame after PMREM environment setup so asset preloading and terrain/entity construction stay responsive
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (disposed) return;

      // Preload referenced custom Tripo 3D GLB assets and dialogue voice-overs from IndexedDB
      const preloadTasks: Promise<unknown>[] = [];
      const referencedVoiceIds = collectReferencedVoiceIds([activeLevel], [
        activeProject.storybook?.prologueVoice,
        activeProject.storybook?.epilogueVoice,
      ]);
      if (referencedVoiceIds.size > 0) {
        preloadTasks.push(AudioEngine.preloadVoiceClips(referencedVoiceIds));
      }
      if (activeProject.heroCustomAssetId) {
        preloadTasks.push(loadCustomAssetToCache(activeProject.heroCustomAssetId, 'character'));
      }
      if (activeProject.savePlinthAssetId) {
        const plinthMeta = activeAssets.find((a) => a.id === activeProject.savePlinthAssetId);
        preloadTasks.push(
          loadCustomAssetToCache(activeProject.savePlinthAssetId, plinthMeta?.category ?? 'prop')
        );
      }
      for (const ent of activeLevel.entities) {
        const resolvedEntAssetId =
          ent.customAssetId ??
          (isSavePlinthEntity(ent) ? activeProject.savePlinthAssetId : undefined);
        if (resolvedEntAssetId) {
          const meta = activeAssets.find((a) => a.id === resolvedEntAssetId);
          preloadTasks.push(loadCustomAssetToCache(resolvedEntAssetId, meta?.category ?? 'prop'));
        }
        if (ent.kind === 'fxEmitter' && ent.fxEmitter?.customMeshAssetId) {
          const meta = activeAssets.find((a) => a.id === ent.fxEmitter?.customMeshAssetId);
          preloadTasks.push(
            loadCustomAssetToCache(ent.fxEmitter.customMeshAssetId, meta?.category ?? 'prop')
          );
        }
        const queueTreeAsset = (assetId?: string) => {
          if (!assetId) return;
          const meta = activeAssets.find((a) => a.id === assetId);
          preloadTasks.push(loadCustomAssetToCache(assetId, meta?.category ?? 'scenery'));
        };
        if (ent.canopyTree) {
          queueTreeAsset(ent.canopyTree.canopyAssetId);
          queueTreeAsset(ent.canopyTree.trunkAssetId);
          queueTreeAsset(ent.canopyTree.fruitAssetId);
        }
      }
      if (activeLevel.canopyEngine) {
        const queueLevelTreeAsset = (assetId?: string) => {
          if (!assetId) return;
          const meta = activeAssets.find((a) => a.id === assetId);
          preloadTasks.push(loadCustomAssetToCache(assetId, meta?.category ?? 'scenery'));
        };
        queueLevelTreeAsset(activeLevel.canopyEngine.canopyAssetId);
        queueLevelTreeAsset(activeLevel.canopyEngine.trunkAssetId);
        queueLevelTreeAsset(activeLevel.canopyEngine.fruitAssetId);
        if (activeLevel.canopyEngine.speciesProfiles) {
          for (const prof of Object.values(activeLevel.canopyEngine.speciesProfiles)) {
            if (!prof) continue;
            queueLevelTreeAsset(prof.canopyAssetId);
            queueLevelTreeAsset(prof.trunkAssetId);
            queueLevelTreeAsset(prof.fruitAssetId);
          }
        }
      }
      for (const sc of activeLevel.terrain?.scatter ?? []) {
        if (sc.kind === 'custom' && sc.customAssetId) {
          const meta = activeAssets.find((a) => a.id === sc.customAssetId);
          preloadTasks.push(loadCustomAssetToCache(sc.customAssetId, meta?.category ?? 'scenery'));
        }
      }
      for (const vi of activeLevel.vistaItems ?? []) {
        if (vi.kind === 'custom' && vi.customAssetId) {
          const meta = activeAssets.find((a) => a.id === vi.customAssetId);
          preloadTasks.push(loadCustomAssetToCache(vi.customAssetId, meta?.category ?? 'scenery'));
        }
      }
      for (const texId of collectReferencedTextureIds(
        activeLevel.sceneryTextures,
        activeLevel.canopyEngine,
        activeLevel.entities.map((e) => e.canopyTree)
      )) {
        preloadTasks.push(loadCustomTextureToCache(texId));
      }
      if (preloadTasks.length > 0) {
        await Promise.all(preloadTasks);
      }
      if (disposed) return;

      applyAtmosphere(scene, sun, hemi, activeLevel, renderer);
      applyAtmosphereQualityToScene(scene, liveQualityValuesRef.current.terrainQuality);
      islandAbort = new AbortController();
      const islandHandles = buildIslandMesh(activeLevel, activeAssets, isSoftwareGl, {
        deferFoliage: true,
        deferFoliageSignal: islandAbort.signal,
        terrainQuality: liveQualityValuesRef.current.terrainQuality,
        ...(isIOS
          ? {
              onDeferredBatchReady: async (obj: THREE.Object3D) => {
                if (disposed) return;
                try {
                  if (postPipeline) {
                    await postPipeline.precompileAsync(activeProject.postProcessing, obj);
                  } else {
                    await renderer.compileAsync(obj, camera, scene);
                  }
                } catch {
                  // ignore precompile errors on fallback/mobile adapters
                }
                if (!disposed && !isSoftwareGl && sun.castShadow) {
                  sun.shadow.needsUpdate = true;
                }
              },
            }
          : {}),
      });
      islandHandlesRef = islandHandles;
      scene.add(islandHandles.group);
      // Capture post-atmosphere baseline exposure & hemisphere light for smooth cave eye adaptation
      basePlayExposure = renderer.toneMappingExposure || 1.05;
      baseHemiIntensity = hemi.intensity;
      baseHemiSkyColor.copy(hemi.color);
      baseHemiGroundColor.copy(hemi.groundColor);
      if (!isSoftwareGl && env !== 'dungeon') {
        wildlifeSystem = new WildlifeFlockingSystem(activeLevel, isIOS ? 0.6 : 1.0);
        scene.add(wildlifeSystem.group);
      }
      if (!isSoftwareGl) {
        navMeshEngine = new PlayNavMeshEngine();
        void navMeshEngine.buildForLevel(activeLevel);
      }
      // Yield one frame between terrain mesh construction and entity construction
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (disposed) return;

      const weatherPts = buildWeatherParticles(activeLevel.weather);
      if (weatherPts) scene.add(weatherPts);

      // Hero (custom rigged GLB or native procedural rig)
      let heroCustom: CustomModelInstance | null = null;
      let heroCustomEquipment: HeroEquipmentHandles | null = null;
      let heroRig: ReturnType<typeof buildHeroModel> | null = null;
      let heroRoot: THREE.Group;

      if (activeProject.heroCustomAssetId) {
        const meta = activeAssets.find((a) => a.id === activeProject.heroCustomAssetId);
        heroCustom = instantiateCustomModel(activeProject.heroCustomAssetId, meta, {
          scaleAdjust: activeProject.heroModelScale ?? 1,
          offsetY: activeProject.heroModelOffsetY ?? 0,
          visualStyle: style,
        });
      }
      if (heroCustom) {
        const heroMeta = activeAssets.find((a) => a.id === activeProject.heroCustomAssetId);
        const mergedHeroPresets = [
          ...(activeProject.customMotionLibrary ?? []),
          ...(heroMeta?.customAnimations ?? []),
        ];
        const mergedHeroDefaults: Partial<Record<CustomClipSlot, string>> = {
          ...(heroMeta?.defaultSlotPresets ?? {}),
          ...(activeProject.heroMotionSlots ?? {}),
        };
        heroCustom.setCustomAnimations(mergedHeroPresets, mergedHeroDefaults);
        heroCustomEquipment = attachEquipmentToCustomModel(heroCustom, style);
        heroRoot = heroCustom.group;
      } else {
        heroRig = buildHeroModel(activeProject.heroBody, activeProject.heroColors);
        heroRig.group.scale.setScalar(Math.max(0.25, Math.min(3.5, activeProject.heroModelScale ?? 1)));
        heroRig.group.position.y = activeProject.heroModelOffsetY ?? 0;
        applyVisualStyleToObject(heroRig.group, style);
        heroRoot = heroRig.group;
      }

      const blanketDef = itemByIdRef.current.get('parachute_blanket');
      const parachuteRig: ParachuteBlanketRig = buildParachuteBlanketRig(
        blanketDef?.colorHex ?? '#E06D44'
      );
      applyVisualStyleToObject(parachuteRig.group, style);
      heroRoot.add(parachuteRig.group);
      const parachuteCanopyScale = heroCustom
        ? Math.max(0.45, activeProject.heroModelScale ?? 1)
        : 1;

      const isDriving = activeLevel.gameplayMode === 'driving';
      const isBuddies =
        activeLevel.gameplayMode === 'buddies' || activeLevel.completeCondition === 'gatherBuddies';

      const spawnPoint =
        (isRoguelikeLevel && roguelikeRunRef.current.floorNumber > 1
          ? activeLevel.startPoint
          : store.playFromPoint) ??
        activeLevel.startPoint ??
        (env === 'sideScroller' ? { x: 0.1, y: 0.5 } : { x: 0.14, y: 0.8 });
      const portalBoardPoint =
        activeLevel.portalPoint ??
        (env === 'sideScroller' ? { x: 0.92, y: 0.5 } : { x: 0.88, y: 0.24 });

      const choppedTreeIds = new Set<string>();
      const openedDoorIds = new Set<string>();
      const collisionCtx: CollisionFilterContext = { choppedTreeIds, openedDoorIds };

      const pendingTravel = consumePendingPlinthTravel(activeProject.id, activeLevel.id);
      const resumeSaved =
        !pendingTravel &&
        resumeSavedRef.current &&
        resumeSavedRef.current.levelId === activeLevel.id
          ? resumeSavedRef.current
          : null;
      if (resumeSaved) {
        resumeSavedRef.current = null;
      }
      const carryStats = crossLevelCarryRef.current;
      crossLevelCarryRef.current = null;
      const spawnedOnPlinthId =
        pendingTravel?.plinthEntityId ?? resumeSaved?.plinthEntityId ?? null;

      const [rawStartX, rawStartZ] = levelBoardToWorld(activeLevel, spawnPoint);
      const desiredStartX = pendingTravel?.localX ?? resumeSaved?.localX ?? rawStartX;
      const desiredStartZ = pendingTravel?.localZ ?? resumeSaved?.localZ ?? rawStartZ;
      const [startX, startZ] = resolveHorizontalCollision(
        activeLevel,
        desiredStartX,
        desiredStartZ,
        isDriving ? 1.15 : 0.62,
        true,
        collisionCtx
      );
      let heroX = startX;
      let heroZ = startZ;
      let heroY = Math.max(0.2, sampleLevelHeight(activeLevel, heroX, heroZ));
      let heroVelY = 0;

      const effectiveMapInfo = getEffectiveMapInfo(activeProject, activeLevel);
      const revealAtHero = () => {
        const [mx, mz] = levelLocalToMapCoords(activeProject, activeLevel, heroX, heroZ);
        revealExplorationAtCoords(
          activeProject.id,
          mx,
          mz,
          effectiveMapInfo.radius,
          isDriving ? 34 : 26
        );
        return [mx, mz] as const;
      };
      const [initMapX, initMapZ] = revealAtHero();
      liveHeroTransformRef.current = { x: heroX, z: heroZ, yaw: 0 };
      publishLivePlayerTelemetry({
        levelId: activeLevel.id,
        point: levelWorldToBoard(activeLevel, heroX, heroZ),
        yaw: 0,
        worldX: initMapX,
        worldZ: initMapZ,
        buddiesFound: 0,
        buddiesTotal: 0,
        trail: [],
      });
      let heroYaw =
        activeLevel.startRotation !== undefined
          ? (activeLevel.startRotation * Math.PI) / 180
          : env === 'sideScroller'
          ? Math.PI * 0.5
          : isDriving
          ? Math.PI * 0.55
          : isBuddies
          ? Math.PI * 0.72
          : Math.PI;
      if (isDriving && activeLevel.startRotation === undefined) {
        const firstCp = activeLevel.entities
          .filter((e) => e.kind === 'checkpoint')
          .sort((a, b) => (a.checkpointOrder ?? 99) - (b.checkpointOrder ?? 99))[0];
        if (firstCp) {
          const [cx, cz] = levelBoardToWorld(activeLevel, firstCp.position);
          heroYaw = Math.atan2(cx - startX, cz - startZ);
        }
      }
      let smoothCamYaw = heroYaw;
      let jumpsUsed = 0;
      let coyoteTimer = 0.14;
      let airborneTimer = 0;
      let jumpBufferTimer = 0;
      let isSwimming = false;
      let swimReenterCooldown = 0;
      let swimExitCooldown = 0;
      let swimTiltX = 0;
      let swimRipplePhase = 0;
      let walkPhase = 0;
      let swimPhase = 0;
      let bobPhase = 0;
      let shownSwimTip = false;
      let shownCaveTip = false;
      let caveCamBlend = 0;
      let interiorCamBlend = 0;
      let canopyOcclusionBlend = 0;
      let heroInsideWalkInBuilding = false;
      let insideBuildingCeilingY = 999;
      let wasInsideAutoClose = false;
      let autoCloseReason: 'interior' | 'forest' | null = null;
      let forestDenseHoldTimer = 0;
      let forestClearHoldTimer = 0;
      let wasCloseCamMode = resolvedCamModeRef.current === 'close';
      let prevCamModeForSnap: CameraMode = resolvedCamModeRef.current;
      let lastAutoCloseToastAt = -10;
      let camBeforeAutoClose: CameraMode | null = null;
      let respawnX = startX;
      let respawnZ = startZ;
      let respawnYaw = heroYaw;
      const sideCfgInit = env === 'sideScroller' ? getSideScrollerConfig(activeLevel) : null;
      let secretRoomWarpCooldown = 0;
      let mechSpringCooldownUntil = 0;
      let mechWarpCooldownUntil = 0;
      let heroInSecretRoom = false;

      heroRoot.position.set(heroX, heroY, heroZ);
      scene.add(heroRoot);

      // Driving vehicle rig (active in Driving mode; swaps live on car/driver change)
      let activeCarId: CarPresetId = drivingCfgRef.current.carId;
      let activeDriverId: DriverTypeId = drivingCfgRef.current.driverId;
      let activeCustomKey: string = JSON.stringify(drivingCfgRef.current.customVehicle ?? null);
      let carFlightTimer = 0;
      let carRig: CarRig | null = null;
      if (isDriving) {
        heroRoot.visible = false;
        carRig = buildCarModel(activeCarId, activeDriverId, drivingCfgRef.current.customVehicle);
        applyVisualStyleToObject(carRig.group, style);
        carRig.group.position.set(heroX, heroY, heroZ);
        carRig.group.rotation.y = heroYaw;
        scene.add(carRig.group);
      }
      let carVelX = 0;
      let carVelZ = 0;
      let carPitch = 0;
      let carRoll = 0;
      let steerVis = 0;
      let wheelSpin = 0;
      let carBoost = 100;
      let carWasDrifting = false;
      let carExhaustTimer = 0;
      let carCheckpointsHit = 0;
      let driveCamYaw = heroYaw;

      // Buddies Adventure & Telemetry state
      const heroTrail: { x: number; y: number; z: number }[] = [{ x: heroX, y: heroY, z: heroZ }];
      const recruitedBuddyIds: string[] = [];
      const clearedCheckpointIds: string[] = [];
      const boardTrail: BoardPoint[] = [levelWorldToBoard(activeLevel, heroX, heroZ)];
      let telemetrySyncTimer = 0;
      let tavernCelebrated = false;
      let lastTavernWarnAt = -10;

      // Stylized sword slash arc attached to heroRoot (visible during active slash sweep)
      const heroSlashGeo = new THREE.RingGeometry(0.68, 1.56, 22, 1, -1.15, 2.3);
      heroSlashGeo.rotateX(-Math.PI / 2);
      const heroSlashMat = new THREE.MeshBasicMaterial({
        color: '#FFF2B8',
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const heroSlashArc = new THREE.Mesh(heroSlashGeo, heroSlashMat);
      heroSlashArc.position.set(0, 0.96, 0.34);
      heroSlashArc.rotation.z = 0.22;
      heroSlashArc.visible = false;
      heroRoot.add(heroSlashArc);

      const waterRippleGeo = new THREE.RingGeometry(0.45, 0.72, 24);
      waterRippleGeo.rotateX(-Math.PI / 2);
      const waterRippleMat = new THREE.MeshBasicMaterial({
        color: '#DDF6FF',
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const waterRipple = new THREE.Mesh(waterRippleGeo, waterRippleMat);
      waterRipple.position.set(heroX, IslandTerrain.waterLevel + 0.04, heroZ);
      waterRipple.visible = false;
      scene.add(waterRipple);

      // Snap initial camera cleanly on spawn
      if (isDriving && carRig) {
        const initDriveView: DrivingCameraView = drivingCfgRef.current.cameraView ?? 'closeChase';
        carRig.driverHead.visible = initDriveView !== 'driverPov';
        carRig.group.updateMatrixWorld(true);
        driveCamYaw = heroYaw;
        if (initDriveView === 'driverPov') {
          camera.fov = 62;
          camera.updateProjectionMatrix();
          const eye = new THREE.Vector3();
          carRig.driverEyeAnchor.getWorldPosition(eye);
          camera.position.copy(eye);
          camera.lookAt(
            eye.x + Math.sin(heroYaw) * 18,
            eye.y - 0.55,
            eye.z + Math.cos(heroYaw) * 18
          );
        } else {
          const isFar = initDriveView === 'farChase';
          camera.fov = isFar ? 50 : 54;
          camera.updateProjectionMatrix();
          const dist = isFar ? 11.4 : 5.4;
          const height = isFar ? 4.85 : 2.35;
          const lookAhead = isFar ? 6.2 : 4.5;
          camera.position.set(
            heroX - Math.sin(heroYaw) * dist,
            heroY + height,
            heroZ - Math.cos(heroYaw) * dist
          );
          camera.lookAt(
            heroX + Math.sin(heroYaw) * lookAhead,
            heroY + (isFar ? 1.45 : 1.28),
            heroZ + Math.cos(heroYaw) * lookAhead
          );
        }
      } else if (camMode === 'firstPerson') {
        inputRef.current.cameraYaw = Math.atan2(-Math.sin(heroYaw), -Math.cos(heroYaw));
        const eyeY = heroY + 1.56;
        camera.position.set(heroX, eyeY, heroZ);
        camera.lookAt(
          heroX + Math.sin(heroYaw) * 14,
          eyeY,
          heroZ + Math.cos(heroYaw) * 14
        );
      } else if (camMode === 'sideScroll') {
        camera.position.set(heroX + 2.2, Math.max(2.0, heroY + 2.5), 14.5);
        camera.lookAt(heroX + 2.2, Math.max(0.6, heroY + 1.15), 0);
      } else if (camMode === 'front') {
        const dist = Math.max(8.2, inputRef.current.cameraDistance);
        camera.position.set(
          heroX - Math.sin(heroYaw) * dist,
          heroY + 4.6,
          heroZ - Math.cos(heroYaw) * dist
        );
        camera.lookAt(
          heroX + Math.sin(heroYaw) * 1.8,
          heroY + 1.35,
          heroZ + Math.cos(heroYaw) * 1.8
        );
      } else if (camMode === 'heroFront') {
        const dist = Math.max(8.2, Math.min(15.5, inputRef.current.cameraDistance));
        const lookAhead = THREE.MathUtils.clamp(dist * 0.24, 1.4, 3.6);
        camera.position.set(
          heroX + Math.sin(heroYaw) * dist,
          heroY + 4.6 + (dist - 9.2) * 0.28,
          heroZ + Math.cos(heroYaw) * dist
        );
        camera.lookAt(
          heroX + Math.sin(heroYaw) * lookAhead,
          heroY + 0.95,
          heroZ + Math.cos(heroYaw) * lookAhead
        );
      } else {
        const isRpgIso = activeLevel.gameplayMode === 'rpg' && camMode === 'isometric';
        if (isRpgIso) {
          camera.fov = 35;
          camera.updateProjectionMatrix();
        }
        camera.position.set(
          heroX + Math.sin(inputRef.current.cameraYaw) * inputRef.current.cameraDistance,
          heroY + (isRpgIso ? 18.0 : camMode === 'isometric' ? 11.5 : 4.2),
          heroZ + Math.cos(inputRef.current.cameraYaw) * inputRef.current.cameraDistance
        );
        camera.lookAt(heroX, heroY + 1.15, heroZ);
      }

      // Portal
      let portalMesh: THREE.Group | null = null;
      const portalSpinMeshes: THREE.Object3D[] = [];
      const [portalX, portalZ] = levelBoardToWorld(activeLevel, portalBoardPoint);
      if (activeLevel.hasPortal) {
        portalMesh = buildPortalMarker();
        portalMesh.position.set(portalX, sampleLevelHeight(activeLevel, portalX, portalZ), portalZ);
        portalMesh.traverse((c) => {
          if (c.userData?.floatSpin) portalSpinMeshes.push(c);
        });
        scene.add(portalMesh);
      }

      // Runtime entities
      let playWallTorchLightCount = 0;
      let playSavePlinthLightCount = 0;
      const runtimeEntities: RuntimeEntity[] = activeLevel.entities.map((ent) => {
        let customInst: CustomModelInstance | null = null;
        let fxRuntime: FxEmitterRuntime | null = null;
        let mesh: THREE.Group;
        const resolvedCustomAssetId =
          ent.customAssetId ??
          (isSavePlinthEntity(ent) ? activeProject.savePlinthAssetId : undefined);
        if (ent.kind === 'fxEmitter') {
          fxRuntime = new FxEmitterRuntime(
            ent.fxEmitter ?? createDefaultFxEmitterConfig('fire'),
            ent.id,
            false
          );
          activeFxRuntimes.push(fxRuntime);
          mesh = fxRuntime.group;
          mesh.scale.setScalar(ent.scale);
          mesh.rotation.y = (ent.rotation * Math.PI) / 180;
        } else if (ent.canopyTree) {
          const resolvedTreeStrokes =
            ent.vertexPaintStrokes && ent.vertexPaintStrokes.length > 0
              ? ent.vertexPaintStrokes
              : ent.canopyTree.vertexPaintStrokes;
          mesh = buildSingleCanopyTreeGroup(
            resolvedTreeStrokes
              ? { ...ent.canopyTree, vertexPaintStrokes: resolvedTreeStrokes }
              : ent.canopyTree,
            ent.id,
            style,
            islandHandles.timeUniform,
            undefined,
            {
              sceneryTextures: activeLevel.sceneryTextures,
              weatherWindUniform: islandHandles.windUniform,
            }
          );
          mesh.scale.setScalar(ent.scale);
          mesh.rotation.y = (ent.rotation * Math.PI) / 180;
        } else {
          const meta = resolvedCustomAssetId
            ? activeAssets.find((a) => a.id === resolvedCustomAssetId)
            : undefined;
          if (resolvedCustomAssetId) {
            customInst = instantiateCustomModel(resolvedCustomAssetId, meta, {
              scaleAdjust: ent.modelScaleAdjust ?? 1,
              offsetY: ent.modelOffsetY ?? 0,
              visualStyle: style,
            });
          }
          if (customInst) {
            mesh = customInst.group;
            mesh.scale.setScalar(ent.scale);
            mesh.rotation.y = (ent.rotation * Math.PI) / 180;
          } else {
            mesh = buildEntityMesh(ent);
            applyVisualStyleToObject(mesh, style);
          }
          const resolvedStrokes =
            ent.vertexPaintStrokes && ent.vertexPaintStrokes.length > 0
              ? ent.vertexPaintStrokes
              : meta?.vertexPaintStrokes;
          if (resolvedStrokes && resolvedStrokes.length > 0) {
            applyVertexPaintStrokesToObject(mesh, resolvedStrokes);
          }
        }

        if (ent.kind !== 'fxEmitter' && ent.kind !== 'light') {
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

        const [wx, wz] = levelBoardToWorld(activeLevel, ent.position);
        const wy = sampleLevelHeight(activeLevel, wx, wz);
        const extraY = ent.kind === 'platform' ? PlatformMotion.hover(ent.platformPreset) : 0;
        const elevY = ent.elevationY ?? 0;
        mesh.position.set(wx, wy + extraY + elevY, wz);
        scene.add(mesh);

        const baddieRig = (mesh.userData.baddieRig as BaddieRig | undefined) ?? null;
        const quadrupedRig = (mesh.userData.quadrupedRig as QuadrupedMonsterRig | undefined) ?? null;
        const npcRig = (mesh.userData.npcRig as HeroRig | undefined) ?? null;
        const creatureHeroRig =
          ent.creatureType && !npcRig
            ? ((mesh.userData.heroRig as HeroRig | undefined) ?? null)
            : null;
        const customFlashMats: Array<{ emissive: THREE.Color; emissiveIntensity: number }> = [];
        const floatSpinMeshes: THREE.Object3D[] = [];
        const torchFlames: Array<{ mesh: THREE.Object3D; baseY: number; phase: number }> = [];
        mesh.traverse((c) => {
          if (c.userData?.floatSpin) {
            floatSpinMeshes.push(c);
          }
          if (c.userData?.torchFlame) {
            torchFlames.push({
              mesh: c,
              baseY: Number(c.userData.baseY ?? c.position.y),
              phase: wx * 0.43 + wz * 0.61,
            });
          }
          if (ent.kind === 'baddie' && c instanceof THREE.Mesh) {
            const mats = Array.isArray(c.material) ? c.material : [c.material];
            for (const m of mats) {
              const candidate = m as unknown as {
                emissive?: unknown;
                emissiveIntensity?: unknown;
              };
              if (candidate.emissive instanceof THREE.Color) {
                customFlashMats.push(
                  candidate as { emissive: THREE.Color; emissiveIntensity: number }
                );
              }
            }
          }
        });
        let wallTorchLight: THREE.PointLight | undefined;
        if (ent.buildingBlock?.shape === 'wallTorch' && playWallTorchLightCount < 8) {
          playWallTorchLightCount++;
          wallTorchLight = new THREE.PointLight('#FF9C40', 4.5, 11, 1.8);
          wallTorchLight.position.set(0, 1.82, 0.38);
          mesh.add(wallTorchLight);
        } else if (isSavePlinthEntity(ent) && playSavePlinthLightCount < 6) {
          playSavePlinthLightCount++;
          const plinthLight = new THREE.PointLight('#38BDF8', 4.2, 9.5, 1.8);
          plinthLight.position.set(0, 1.75, 0);
          mesh.add(plinthLight);
        }
        if (ent.kind === 'baddie' && baddieRig && ent.materialVariant) {
          baddieRig.flashMaterials = customFlashMats as unknown as THREE.MeshStandardMaterial[];
        }
        if (ent.kind === 'baddie' && quadrupedRig && ent.materialVariant) {
          quadrupedRig.flashMaterials = customFlashMats as unknown as THREE.MeshStandardMaterial[];
        }

        const resolvedMonster = ent.monsterConfig ? resolveMonsterBlueprint(ent.monsterConfig) : null;
        const baddieAI = ent.kind === 'baddie' ? resolveBaddieAIConfig(ent) : undefined;
        const canFly = Boolean(quadrupedRig?.canFly || baddieRig?.isFlyer);
        const keyColors = resolveBaddieHealthBarColors(
          resolvedMonster ?? undefined,
          ent.isBoss,
          ent.styleTint
        );
        const baseHp = Math.max(1, ent.health);
        const maxHp =
          resolvedMonster?.specialAbility === 'thickFat'
            ? Math.max(baseHp + 1, Math.round(baseHp * 1.25))
            : baseHp;
        let hpBar: EnemyHealthBar | null = null;
        if (ent.kind === 'baddie') {
          let barHeight = ent.isBoss ? 2.68 : baddieRig?.isFlyer ? 2.15 : 1.92;
          if (quadrupedRig) {
            barHeight = Math.max(1.85, quadrupedRig.topHeight + (quadrupedRig.canFly ? 1.4 : 0.45));
          } else if (!baddieRig) {
            const box = new THREE.Box3().setFromObject(mesh);
            const modelH = box.max.y - wy;
            if (Number.isFinite(modelH) && modelH > 0.4) {
              barHeight = THREE.MathUtils.clamp(modelH + 0.36, 1.85, 3.6);
            }
          }
          hpBar = createEnemyHealthBar(
            maxHp,
            ent.isBoss,
            barHeight,
            keyColors.fillHex,
            keyColors.borderHex
          );
          redrawEnemyHealthBar(hpBar, maxHp, maxHp, 1);
          const initFlyY = canFly && baddieAI ? baddieAI.flightAltitude : 0;
          if (initFlyY > 0) {
            mesh.position.y += initFlyY;
          }
          hpBar.group.position.set(wx, Math.max(-1, wy) + initFlyY + barHeight, wz);
          scene.add(hpBar.group);
        }

        // Attach MechanismRuntimeController if entity or its custom asset defines hinges/sliders
        const customMeta = resolvedCustomAssetId
          ? activeAssets.find((a) => a.id === resolvedCustomAssetId)
          : undefined;
        const resolvedMechs: ObjectMechanism[] =
          ent.mechanisms && ent.mechanisms.length > 0
            ? ent.mechanisms
            : customMeta?.mechanisms ?? [];
        const mechRoot = customInst
          ? customInst.scaledRoot
          : ((mesh.userData.mechRoot as THREE.Object3D | undefined) ?? mesh);
        const mechController =
          resolvedMechs.length > 0
            ? new MechanismRuntimeController(mechRoot, resolvedMechs)
            : null;
        const chestAnim =
          (mesh.userData.chestAnim as TreasureChestAnimRig | undefined) ?? null;
        const chestLootEntries =
          ent.kind === 'treasure'
            ? buildChestLootEntriesForEntity(
                ent,
                resolvedMechs,
                itemByIdRef.current,
                itemCatalog,
                isRoguelikeLevel
              )
            : [];
        if (ent.kind === 'treasure') {
          chestEntriesByEntityRef.current.set(ent.id, chestLootEntries);
        }

        const resolvedChatStyle = resolveChatBubbleStyle(ent.chatBubble, ent.kind);
        const primaryDialogue =
          ent.dialogue ||
          ent.cards.flatMap((c) => c.actions).find((a) => a.key === 'say')?.detail ||
          (ent.voiceConfig?.clipId ||
          (ent.voiceConfig?.lineClipIds &&
            Object.values(ent.voiceConfig.lineClipIds).some(Boolean))
            ? ''
            : ent.kind === 'baddie'
            ? 'Hey! Come back here!'
            : 'Hello, traveller!');
        const dialogueLines = splitDialogueLines(
          primaryDialogue,
          ent.conversation?.map((c) => c.words),
          ent.voiceConfig
        );
        let headHeight = ent.isBoss ? 2.55 : ent.kind === 'sign' ? 1.55 : 1.95;
        if (ent.kind === 'npc' || ent.kind === 'baddie' || ent.kind === 'sign') {
          const box = new THREE.Box3().setFromObject(mesh);
          const h = box.max.y - (wy + extraY);
          if (Number.isFinite(h) && h > 0.45) {
            headHeight = THREE.MathUtils.clamp(h + 0.15, 1.35, 3.8);
          }
        }

        if (customInst) {
          const catDefaults: Partial<Record<CustomClipSlot, string>> =
            ent.kind === 'baddie'
              ? {
                  ...(activeProject.baddieMotionSlots ?? {}),
                  ...(resolvedMonster?.defaultSlotPresets ?? {}),
                }
              : ent.isBuddy
              ? {
                  ...(activeProject.buddyMotionSlots ?? {}),
                  ...(ent.creatureType
                    ? activeProject.buddyMotionSlotsByCreature?.[ent.creatureType] ?? {}
                    : {}),
                }
              : ent.kind === 'npc'
              ? { ...(activeProject.npcMotionSlots ?? {}) }
              : {};
          const mergedCustomDefaults: Partial<Record<CustomClipSlot, string>> = {
            ...(customMeta?.defaultSlotPresets ?? {}),
            ...catDefaults,
            ...(ent.motionSlotOverrides ?? {}),
          };
          const mergedCustomPresets: CustomMotionPreset[] = [
            ...(ent.motionCustomAnimations ?? []),
            ...(resolvedMonster?.customAnimations ?? []),
            ...(activeProject.customMotionLibrary ?? []),
            ...(customMeta?.customAnimations ?? []),
          ];
          customInst.setCustomAnimations(mergedCustomPresets, mergedCustomDefaults);
        }

        return {
          id: ent.id,
          kind: ent.kind,
          name: ent.name,
          mesh,
          customInst,
          baddieRig,
          quadrupedRig,
          npcRig,
          npcBaseBodyY: npcRig ? npcRig.bodyPivot.position.y : 0.72,
          creatureHeroRig,
          creatureBaseBodyY: creatureHeroRig ? creatureHeroRig.bodyPivot.position.y : 0.85,
          sourceEntity: ent,
          resolvedMonster,
          customFlashMats,
          hpBar,
          x: wx,
          z: wz,
          startX: wx,
          startZ: wz,
          vx: 0,
          vz: 0,
          vy: 0,
          yOffset: 0,
          health: maxHp,
          maxHealth: maxHp,
          speed:
            resolvedMonster?.specialAbility === 'swiftStride'
              ? ent.speed * 1.22
              : ent.speed,
          isBoss: ent.isBoss,
          brain: ent.brain,
          alive: true,
          opened: false,
          dialogue: primaryDialogue,
          dialogueLines,
          chatStyle: resolvedChatStyle,
          voiceConfig: ent.voiceConfig,
          lastProximityVoiceAt: -99999,
          headHeight,
          aggroShouted: false,
          lowHpShouted: false,
          patrolDir: 1,
          attackCooldown: 0.4,
          aiState: 'patrol' as BaddieAIState,
          stateTimer: 0,
          attackDirX: 0,
          attackDirZ: 1,
          strikeDidHit: false,
          hitFlashTimer: 0,
          recoilPitch: 0,
          recoilRoll: 0,
          walkPhase: Math.random() * Math.PI * 2,
          defeatSpin: 0,
          monsterPrimaryAttack: baddieAI?.primaryAction ?? resolvedMonster?.primaryAttack,
          monsterSecondaryAttack: baddieAI?.secondaryAction ?? resolvedMonster?.secondaryAttack,
          monsterAbility: resolvedMonster?.specialAbility,
          monsterAttackPower: resolvedMonster?.attackPower,
          monsterAttackRange: resolvedMonster?.attackRange,
          monsterAttackCooldown: resolvedMonster?.attackCooldown,
          activeAttack: baddieAI?.primaryAction ?? resolvedMonster?.primaryAttack ?? 'clawSlash',
          attackCycleCount: 0,
          regenTimer: 0,
          pickupable: Boolean(ent.pickupable || ent.pickupItemId || ent.kind === 'pickup'),
          pickupItemId: ent.pickupItemId,
          pickupQty: ent.pickupQty ?? 1,
          giftGiven: false,
          treeHp: ent.kind === 'scenery' ? 3 : undefined,
          mechanisms: resolvedMechs,
          mechController,
          mechNearState: {},
          mechFlagFired: {},
          chestAnim,
          chestLootEntries,
          chestOpening: false,
          chestOpenTimer: 0,
          fxRuntime,
          isBuddy: Boolean(ent.isBuddy),
          buddyAreaLabel: ent.buddyAreaLabel,
          misfitAbility: ent.misfitAbility,
          critterAttitude: ent.critterAttitude,
          critterWarmOn: ent.critterWarmOn,
          critterWarmFlag: ent.critterWarmFlag,
          critterWarmLines: ent.critterWarmLines?.trim()
            ? ent.critterWarmLines
                .split(/\r?\n/)
                .map((s) => s.trim())
                .filter(Boolean)
            : undefined,
          warmedUp: false,
          critterCelebrateTimer: 0,
          lastCritterReactAt: -99,
          puzzleRequires: ent.puzzleRequires,
          puzzleRewardText: ent.puzzleRewardText,
          puzzleFlag: ent.puzzleFlag,
          propPreset: ent.propPreset,
          checkpointOrder: ent.checkpointOrder,
          recruited: false,
          creatureRefs: (mesh.userData.creatureAnim as CreatureAnimRefs | undefined) ?? null,
          floatSpinMeshes,
          cards: ent.cards ?? [],
          elevationY: ent.elevationY,
          buildingBlock: ent.buildingBlock,
          doorConfig: ent.doorConfig,
          requiresKey: Boolean(
            ent.doorConfig?.requiresKey ||
              (!ent.doorConfig && ent.kind === 'door') ||
              (ent.cards ?? []).some((c) => (c.conditions ?? []).some((cond) => cond.key === 'hasKey'))
          ),
          wallTorchLight,
          torchFlames: torchFlames.length > 0 ? torchFlames : undefined,
          skitEmote: null,
          skitMoving: false,
          interactionAttributes:
            ent.interactionAttributes ?? customMeta?.interactionAttributes,
          interactionCalibrations:
            ent.interactionCalibrations ?? customMeta?.interactionCalibrations,
          entityYaw: (ent.rotation * Math.PI) / 180,
          entityScale: Math.max(0.25, ent.scale || 1),
          baddieAI,
          flightY: canFly && baddieAI ? baddieAI.flightAltitude : 0,
          targetFlightY: canFly && baddieAI ? baddieAI.flightAltitude : 0,
          patrolAngle: Math.random() * Math.PI * 2,
          lockedTargetX: wx,
          lockedTargetZ: wz,
          varietyCooldownMult: 1,
          behaviorChaseOrdered: false,
          behaviorFleeOrdered: false,
          behaviorAttackQueue: null,
          enraged: false,
          dyingDuration: ent.isBoss ? 1.45 : 0.95,
          deathFinalized: false,
          keyFillColor: keyColors.fillHex,
          keyBorderColor: keyColors.borderHex,
          airAttacksSinceLand: 0,
          postAirHoverTimer: 0,
          groundedHoldTimer: 0,
          mustLandBeforeAttack: false,
          logicAnimName: null,
          logicAnimTimer: 0,
          logicAnimDuration: 1,
          motionBlend: 0,
          motionElapsed: 0,
          motionKey: '',
        };
      });

      activeRuntimeEntities = runtimeEntities;

      // Pre-warm a Boss Reward Chest mesh at boot so its TSL/WebGPU shaders compile during initial scene precompile
      let prewarmedBossChestMesh: THREE.Group | null = (() => {
        const templateChestEnt: LevelEntity = {
          id: 'prewarm_boss_chest',
          name: 'Great Chest',
          kind: 'treasure',
          position: { x: 0, y: 0 },
          scale: 1.35,
          rotation: 0,
          speed: 0,
          health: 1,
          damage: 0,
          brain: 'Guardian',
          isBoss: false,
          loot: 'treasure',
          puzzleType: 'none',
          dialogue: '',
          platformPreset: 'stoneLift',
          platformMotion: 'slide',
          platformSpeed: 0,
          platformWait: 0,
          platformRunning: false,
          conversation: [],
          notes: '',
          styleTint: '#FACC15',
          cards: [],
        };
        const m = buildEntityMesh(templateChestEnt);
        applyVisualStyleToObject(m, style);
        m.position.set(0, -500, 0);
        m.scale.setScalar(0.0001);
        m.traverse((child) => {
          child.frustumCulled = false;
        });
        scene.add(m);
        return m;
      })();

      const spawnBossRewardChest = (bossRt: RuntimeEntity) => {
        const chestId = `boss_chest_${bossRt.id}_${Math.round(performance.now())}`;
        const chestName = `${bossRt.name} Great Chest`;
        const [cx, cz] = resolveHorizontalCollision(
          activeLevel,
          bossRt.x,
          bossRt.z,
          0.9,
          false,
          collisionCtx
        );
        const cy = sampleLevelHeight(activeLevel, cx, cz);
        let chestMesh: THREE.Group;
        if (prewarmedBossChestMesh) {
          chestMesh = prewarmedBossChestMesh;
          prewarmedBossChestMesh = null;
          chestMesh.scale.setScalar(1.35);
          chestMesh.position.set(cx, cy, cz);
          chestMesh.rotation.y = Math.atan2(heroX - cx, heroZ - cz);
        } else {
          const tempChestEnt: LevelEntity = {
            id: chestId,
            name: chestName,
            kind: 'treasure',
            position: levelWorldToBoard(activeLevel, cx, cz),
            scale: 1.35,
            rotation: Math.round((Math.atan2(heroX - cx, heroZ - cz) * 180) / Math.PI),
            speed: 0,
            health: 1,
            damage: 0,
            brain: 'Guardian',
            isBoss: false,
            loot: 'treasure',
            puzzleType: 'none',
            dialogue: '',
            platformPreset: 'stoneLift',
            platformMotion: 'slide',
            platformSpeed: 0,
            platformWait: 0,
            platformRunning: false,
            conversation: [],
            notes: '',
            styleTint: '#FACC15',
            cards: [],
          };
          chestMesh = buildEntityMesh(tempChestEnt);
          chestMesh.position.set(cx, cy, cz);
          chestMesh.rotation.y = Math.atan2(heroX - cx, heroZ - cz);
          scene.add(chestMesh);
        }

        const chestAnim =
          (chestMesh.userData.chestAnim as TreasureChestAnimRig | undefined) ?? null;
        const rewardCoins = bossRt.baddieAI?.bossRewardCoins ?? 30;
        const rewardItemIds = bossRt.baddieAI?.bossRewardItems ?? [
          'golden_crown',
          'bone_amulet',
          'healing_tonic',
        ];
        const entries: ChestLootEntry[] = [];
        for (const itemId of rewardItemIds) {
          const def = itemByIdRef.current.get(itemId);
          if (!def) continue;
          const meta = resolveItemMetadata(def);
          entries.push({
            uid: `${chestId}_${itemId}_${entries.length}`,
            kind: 'item',
            qty: 1,
            label: def.name,
            subtitle: `${bossRt.name} Trophy`,
            rarity: meta.rarity,
            itemId: def.id,
            itemDef: def,
          });
        }
        if (entries.length === 0) {
          const fallbackPool = itemCatalog.filter(
            (i) => i.id !== 'iron_sword' && i.id !== 'parachute_blanket'
          );
          for (const pick of fallbackPool.slice(0, 2)) {
            const meta = resolveItemMetadata(pick);
            entries.push({
              uid: `${chestId}_${pick.id}_${entries.length}`,
              kind: 'item',
              qty: 1,
              label: pick.name,
              subtitle: `${bossRt.name} Trophy`,
              rarity: meta.rarity,
              itemId: pick.id,
              itemDef: pick,
            });
          }
        }
        entries.push({
          uid: `${chestId}_coins`,
          kind: 'coin',
          qty: rewardCoins,
          label: 'Royal Gold Hoard',
          subtitle: `${bossRt.name} Bounty`,
          rarity: 'epic',
        });
        chestEntriesByEntityRef.current.set(chestId, entries);

        runtimeEntities.push({
          id: chestId,
          kind: 'treasure',
          name: chestName,
          mesh: chestMesh,
          customInst: null,
          baddieRig: null,
          quadrupedRig: null,
          npcRig: null,
          npcBaseBodyY: 0.72,
          creatureHeroRig: null,
          creatureBaseBodyY: 0.85,
          customFlashMats: [],
          hpBar: null,
          x: cx,
          z: cz,
          startX: cx,
          startZ: cz,
          vx: 0,
          vz: 0,
          vy: 0,
          yOffset: 0,
          health: 1,
          maxHealth: 1,
          speed: 0,
          isBoss: false,
          brain: 'Guardian',
          alive: true,
          opened: false,
          dialogue: '',
          dialogueLines: [],
          chatStyle: resolveChatBubbleStyle(undefined, 'treasure'),
          lastProximityVoiceAt: -99999,
          headHeight: 1.4,
          aggroShouted: false,
          lowHpShouted: false,
          patrolDir: 1,
          attackCooldown: 0,
          aiState: 'patrol',
          stateTimer: 0,
          attackDirX: 0,
          attackDirZ: 1,
          strikeDidHit: false,
          hitFlashTimer: 0,
          recoilPitch: 0,
          recoilRoll: 0,
          walkPhase: 0,
          defeatSpin: 0,
          activeAttack: 'clawSlash',
          attackCycleCount: 0,
          regenTimer: 0,
          pickupable: false,
          pickupQty: 1,
          giftGiven: false,
          mechanisms: [],
          mechController: null,
          mechNearState: {},
          mechFlagFired: {},
          chestAnim,
          chestLootEntries: entries,
          chestOpening: false,
          chestOpenTimer: 0,
          fxRuntime: null,
          isBuddy: false,
          warmedUp: false,
          critterCelebrateTimer: 0,
          lastCritterReactAt: -99999,
          recruited: false,
          creatureRefs: null,
          floatSpinMeshes: [],
          cards: [],
          propPreset: undefined,
          entityYaw: chestMesh.rotation.y,
          entityScale: 1.35,
          flightY: 0,
          targetFlightY: 0,
          patrolAngle: 0,
          lockedTargetX: cx,
          lockedTargetZ: cz,
          varietyCooldownMult: 1,
          behaviorChaseOrdered: false,
          behaviorFleeOrdered: false,
          behaviorAttackQueue: null,
          enraged: false,
          dyingDuration: 1.0,
          deathFinalized: false,
          keyFillColor: '#FACC15',
          keyBorderColor: '#F59E0B',
          airAttacksSinceLand: 0,
          postAirHoverTimer: 0,
          groundedHoldTimer: 0,
          mustLandBeforeAttack: false,
          logicAnimName: null,
          logicAnimTimer: 0,
          logicAnimDuration: 1,
          motionBlend: 0,
          motionElapsed: 0,
          motionKey: '',
        });
        spawnCombatSparks(cx, cy + 0.85, cz, '#FACC15', 20, 6.2);
      };

      const spawnSecretPuzzleChest = (rx: number, rz: number) => {
        const chestId = `puzzle_secret_chest_${Math.round(performance.now())}_${Math.floor(Math.random() * 999)}`;
        const chestName = 'Ancient Secret Chest';
        const [cx, cz] = resolveHorizontalCollision(activeLevel, rx, rz, 0.85, false, collisionCtx);
        const cy = sampleLevelHeight(activeLevel, cx, cz);
        const tempChestEnt: LevelEntity = {
          id: chestId,
          name: chestName,
          kind: 'treasure',
          position: levelWorldToBoard(activeLevel, cx, cz),
          scale: 1.18,
          rotation: Math.round((Math.atan2(heroX - cx, heroZ - cz) * 180) / Math.PI),
          speed: 0,
          health: 1,
          damage: 0,
          brain: 'Guardian',
          isBoss: false,
          loot: 'treasure',
          puzzleType: 'none',
          dialogue: '',
          platformPreset: 'stoneLift',
          platformMotion: 'slide',
          platformSpeed: 0,
          platformWait: 0,
          platformRunning: false,
          conversation: [],
          notes: '',
          styleTint: '#38BDF8',
          cards: [],
        };
        const chestMesh = buildEntityMesh(tempChestEnt);
        if (style !== 'painterlyPBR') {
          applyVisualStyleToObject(chestMesh, style);
        }
        chestMesh.position.set(cx, cy, cz);
        chestMesh.rotation.y = Math.atan2(heroX - cx, heroZ - cz);
        scene.add(chestMesh);

        const chestAnim =
          (chestMesh.userData.chestAnim as TreasureChestAnimRig | undefined) ?? null;
        const entries: ChestLootEntry[] = [];
        for (const itemId of ['healing_tonic', 'wild_berries', 'orchard_apple']) {
          const def = itemByIdRef.current.get(itemId);
          if (!def) continue;
          const meta = resolveItemMetadata(def);
          entries.push({
            uid: `${chestId}_${itemId}`,
            kind: 'item',
            qty: itemId === 'healing_tonic' ? 1 : 2,
            label: def.name,
            subtitle: 'Ancient Stone Secret',
            rarity: meta.rarity,
            itemId: def.id,
            itemDef: def,
          });
        }
        entries.push({
          uid: `${chestId}_coins`,
          kind: 'coin',
          qty: 25,
          label: 'Ancient Gold Cache',
          subtitle: 'Stone Switch Reward',
          rarity: 'rare',
        });
        chestEntriesByEntityRef.current.set(chestId, entries);
        runtimeEntities.push({
          id: chestId,
          kind: 'treasure',
          name: chestName,
          mesh: chestMesh,
          customInst: null,
          baddieRig: null,
          quadrupedRig: null,
          npcRig: null,
          npcBaseBodyY: 0.72,
          creatureHeroRig: null,
          creatureBaseBodyY: 0.85,
          customFlashMats: [],
          hpBar: null,
          x: cx,
          z: cz,
          startX: cx,
          startZ: cz,
          vx: 0,
          vz: 0,
          vy: 0,
          yOffset: 0,
          health: 1,
          maxHealth: 1,
          speed: 0,
          isBoss: false,
          brain: 'Guardian',
          alive: true,
          opened: false,
          dialogue: '',
          dialogueLines: [],
          chatStyle: resolveChatBubbleStyle(undefined, 'treasure'),
          lastProximityVoiceAt: -99999,
          headHeight: 1.3,
          aggroShouted: false,
          lowHpShouted: false,
          patrolDir: 1,
          attackCooldown: 0,
          aiState: 'patrol',
          stateTimer: 0,
          attackDirX: 0,
          attackDirZ: 1,
          strikeDidHit: false,
          hitFlashTimer: 0,
          recoilPitch: 0,
          recoilRoll: 0,
          walkPhase: 0,
          defeatSpin: 0,
          activeAttack: 'clawSlash',
          attackCycleCount: 0,
          regenTimer: 0,
          pickupable: false,
          pickupQty: 1,
          giftGiven: false,
          mechanisms: [],
          mechController: null,
          mechNearState: {},
          mechFlagFired: {},
          chestAnim,
          chestLootEntries: entries,
          chestOpening: false,
          chestOpenTimer: 0,
          fxRuntime: null,
          isBuddy: false,
          warmedUp: false,
          critterCelebrateTimer: 0,
          lastCritterReactAt: -99999,
          recruited: false,
          creatureRefs: null,
          floatSpinMeshes: [],
          cards: [],
          propPreset: undefined,
          entityYaw: chestMesh.rotation.y,
          entityScale: 1.18,
          flightY: 0,
          targetFlightY: 0,
          patrolAngle: 0,
          lockedTargetX: cx,
          lockedTargetZ: cz,
          varietyCooldownMult: 1,
          behaviorChaseOrdered: false,
          behaviorFleeOrdered: false,
          behaviorAttackQueue: null,
          enraged: false,
          dyingDuration: 1.0,
          deathFinalized: false,
          keyFillColor: '#38BDF8',
          keyBorderColor: '#0284C7',
          airAttacksSinceLand: 0,
          postAirHoverTimer: 0,
          groundedHoldTimer: 0,
          mustLandBeforeAttack: false,
          logicAnimName: null,
          logicAnimTimer: 0,
          logicAnimDuration: 1,
          motionBlend: 0,
          motionElapsed: 0,
          motionKey: '',
        });
        spawnCombatSparks(cx, cy + 0.85, cz, '#38BDF8', 22, 6.4);
      };

      // Interactive World Physics: Organic throwable rocks & boulders, pushable distressed stone puzzle cubes,
      // grabbable wall torches anywhere, and pooled 3D debris for destructible flora/props
      if (!isDriving) {
        worldInteract = new WorldInteractivitySystem(activeLevel, heroX, heroZ, scene, collisionCtx);
        scene.add(worldInteract.group);
        for (const rt of runtimeEntities) {
          if (!rt.alive) continue;
          const lname = rt.name.toLowerCase();
          if (
            rt.wallTorchLight ||
            (rt.torchFlames && rt.torchFlames.length > 0) ||
            (rt.kind === 'light' && (lname.includes('torch') || lname.includes('sconce'))) ||
            (rt.kind === 'prop' && lname.includes('torch'))
          ) {
            const ty = sampleLevelHeight(activeLevel, rt.x, rt.z) + (rt.elevationY ?? 0) + 1.1;
            worldInteract.registerEntityWallTorch(
              `ent_torch_${rt.id}`,
              rt.mesh,
              rt.x,
              ty,
              rt.z,
              rt.wallTorchLight ?? null
            );
          }
        }
      }

      const buddyEntities = runtimeEntities.filter((r) => r.isBuddy);

      // Non-blocking Hybrid Rapier 3D WASM Physics for pushable/tumbleable props & melee blasts
      if (!isSoftwareGl) {
        rapierPhysics = new HybridRapierPhysicsWorld();
        const physRef = rapierPhysics;
        void physRef.initForLevel(activeLevel).then((ok) => {
          if (!ok || disposed) return;
          let registeredCount = 0;
          for (const rt of runtimeEntities) {
            if (registeredCount >= 32) break;
            if (rt.kind !== 'prop' || !rt.alive || rt.buildingBlock || rt.doorConfig) continue;
            const nm = rt.name.toLowerCase();
            const pr = String(rt.propPreset ?? '').toLowerCase();
            const isPushable =
              pr === 'barrel' ||
              pr === 'crate' ||
              pr === 'boulder' ||
              nm.includes('barrel') ||
              nm.includes('crate') ||
              nm.includes('keg') ||
              nm.includes('pot') ||
              nm.includes('urn') ||
              nm.includes('boulder');
            if (!isPushable) continue;
            const isRound = nm.includes('boulder') || pr === 'boulder';
            const isCyl =
              nm.includes('barrel') ||
              pr === 'barrel' ||
              nm.includes('keg') ||
              nm.includes('urn') ||
              nm.includes('pot');
            const sc = Math.max(0.45, Math.min(2.2, rt.entityScale || 1));
            physRef.registerDynamicProp(rt.id, rt.mesh, {
              radius: 0.48 * sc,
              shape: isRound ? 'sphere' : isCyl ? 'cylinder' : 'box',
              mass: isRound ? 2.4 : 1.2,
              restitution: isRound ? 0.34 : 0.22,
              baseYOffset: 0.45 * sc,
            });
            registeredCount++;
          }
        });
      }

      // Baby Duckling companion (follows behind hero trail and peeps gently!)
      let ducklingMesh: THREE.Group | null = null;
      let duckX = heroX - Math.sin(heroYaw) * 1.4;
      let duckZ = heroZ - Math.cos(heroYaw) * 1.4;
      let duckYaw = heroYaw;
      let duckPeepCooldown = 8.5;
      if (!isDriving && activeLevel.startWithDuckling) {
        ducklingMesh = buildDucklingCompanionMesh();
        applyVisualStyleToObject(ducklingMesh, style);
        const duckFloor = sampleLevelHeight(activeLevel, duckX, duckZ);
        ducklingMesh.position.set(duckX, duckFloor, duckZ);
        ducklingMesh.rotation.y = duckYaw;
        scene.add(ducklingMesh);
      }

      // Misfit Powers 3D FX pools & puzzle helpers
      const scentPuffs: {
        mesh: THREE.Mesh;
        mat: THREE.MeshBasicMaterial;
        vx: number;
        vy: number;
        vz: number;
        life: number;
        maxLife: number;
        maxScale: number;
      }[] = [];
      const quillProjectiles: {
        mesh: THREE.Group;
        vx: number;
        vz: number;
        life: number;
      }[] = [];
      const sonarRings: {
        mesh: THREE.Mesh;
        mat: THREE.MeshBasicMaterial;
        age: number;
        maxAge: number;
        maxScale: number;
      }[] = [];
      const revealBeacons: {
        mesh: THREE.Mesh;
        mat: THREE.MeshBasicMaterial;
        life: number;
        maxLife: number;
      }[] = [];
      const powerCooldownUntil: Record<MisfitAbilityId, number> = {
        skunkScent: 0,
        porcupineQuills: 0,
        moleSonar: 0,
        vultureSight: 0,
      };
      let vultureAerialTimer = 0;
      let lastPuzzleHintAt = -10;
      let recentMisfitUsed: MisfitAbilityId | null = null;
      const recentSolvedPuzzleIds = new Set<string>();
      let puzzlesSolvedCount = 0;
      let crittersWarmedCount = 0;
      setStoryStats({ puzzlesSolved: 0, crittersWarmed: 0 });
      const drivingCheckpointsTotal = runtimeEntities.filter((r) => r.kind === 'checkpoint').length;
      const rampEntities = activeLevel.entities
        .filter((e) => e.propPreset === 'ramp' || e.name.toLowerCase().includes('ramp'))
        .map((e) => {
          const [rx, rz] = levelBoardToWorld(activeLevel, e.position);
          return {
            x: rx,
            z: rz,
            baseY: sampleLevelHeight(activeLevel, rx, rz),
            yaw: (e.rotation * Math.PI) / 180,
            scale: Math.max(0.45, Math.min(2.6, e.scale || 1)),
          };
        });
      const flightCubeEntities = activeLevel.entities
        .filter(
          (e) =>
            e.propPreset === 'flightCube' ||
            e.name.toLowerCase().includes('flight') ||
            e.name.toLowerCase().includes('fly cube') ||
            e.name.toLowerCase().includes('wing cube')
        )
        .map((e) => {
          const [rx, rz] = levelBoardToWorld(activeLevel, e.position);
          const rt = runtimeEntities.find((r) => r.id === e.id);
          return {
            id: e.id,
            mesh: rt?.mesh,
            x: rx,
            z: rz,
            baseY: sampleLevelHeight(activeLevel, rx, rz) + 1.25,
            respawnAt: 0,
          };
        });
      const boostPadEntities = activeLevel.entities
        .filter((e) => e.propPreset === 'boostPad' || e.name.toLowerCase().includes('boost pad'))
        .map((e) => {
          const [rx, rz] = levelBoardToWorld(activeLevel, e.position);
          return {
            id: e.id,
            x: rx,
            z: rz,
            cooldownUntil: 0,
          };
        });
      const roadBarrierEntities = activeLevel.entities
        .filter((e) => e.propPreset === 'roadBarrier' || e.name.toLowerCase().includes('barrier'))
        .map((e) => {
          const [rx, rz] = levelBoardToWorld(activeLevel, e.position);
          return {
            id: e.id,
            x: rx,
            z: rz,
            cooldownUntil: 0,
          };
        });
      const tavernRt = runtimeEntities.find(
        (r) => r.propPreset === 'tavern' || r.name.toLowerCase().includes('tavern')
      );
      const craftingBenchEntities = runtimeEntities.filter(
        (r) =>
          r.propPreset === 'craftingBench' ||
          r.name.toLowerCase().includes('crafting') ||
          r.name.toLowerCase().includes('workbench')
      );

      setBuddyHud({
        found: 0,
        total: buddyEntities.length,
        names: [],
        celebrating: false,
        celebrationBannerOpen: false,
      });
      setDriveHud({
        speedKmh: 0,
        boost: 100,
        drifting: false,
        airborne: false,
        checkpointsHit: 0,
        checkpointsTotal: drivingCheckpointsTotal,
        flightSeconds: 0,
        hasWings: Boolean(carRig?.hasPermanentWings),
      });

      // Dynamic world drops spawned during play (e.g. Wood Logs from chopped trees!)
      interface DroppedPickup {
        id: string;
        itemId: string;
        qty: number;
        mesh: THREE.Group;
        x: number;
        y: number;
        z: number;
        vx: number;
        vy: number;
        vz: number;
        pickupDelay: number;
        collected: boolean;
      }
      const droppedPickups: DroppedPickup[] = [];

      const spawnDroppedItem = (
        itemId: string,
        qty: number,
        x: number,
        y: number,
        z: number,
        vx: number,
        vy: number,
        vz: number
      ) => {
        const def = itemByIdRef.current.get(itemId);
        const wrapper = new THREE.Group();
        const shadow = new THREE.Mesh(
          new THREE.CircleGeometry(0.36, 12),
          new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.25, depthWrite: false })
        );
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = 0.02;
        const itemMesh = buildPickupItemMesh(def?.meshKind ?? 'woodLog', def?.colorHex ?? '#92400E');
        wrapper.add(shadow, itemMesh);
        wrapper.position.set(x, y, z);
        scene.add(wrapper);
        droppedPickups.push({
          id: `drop_${Math.random().toString(36).slice(2)}`,
          itemId,
          qty,
          mesh: wrapper,
          x,
          y,
          z,
          vx,
          vy,
          vz,
          pickupDelay: 0.35,
          collected: false,
        });
      };

      // Falling tree animations (toppling from stump -> dissolving into pickupable Wood Logs)
      interface FallingTreeAnim {
        mesh: THREE.Group;
        x: number;
        y: number;
        z: number;
        fallDirX: number;
        fallDirZ: number;
        size: number;
        progress: number;
        bounced: boolean;
      }
      const fallingTrees: FallingTreeAnim[] = [];
      const _treeDummy = new THREE.Object3D();

      // Dynamic expanding water ripples (used for fishing bait splash, waiting pulse, fish bite & leap)
      const ripplePoolGeo = new THREE.RingGeometry(0.18, 0.3, 24);
      ripplePoolGeo.rotateX(-Math.PI / 2);
      const dynamicRipples: {
        mesh: THREE.Mesh;
        mat: THREE.MeshBasicMaterial;
        age: number;
        maxAge: number;
        maxScale: number;
      }[] = [];

      const spawnWaterRipple = (x: number, z: number, maxScale = 3.2, maxAge = 1.15) => {
        const mat = new THREE.MeshBasicMaterial({
          color: '#E6F8FF',
          transparent: true,
          opacity: 0.82,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const ring = new THREE.Mesh(ripplePoolGeo, mat);
        ring.position.set(x, IslandTerrain.waterLevel + 0.055, z);
        scene.add(ring);
        dynamicRipples.push({ mesh: ring, mat, age: 0, maxAge, maxScale });
      };

      // 3D Fishing Bobber, Dynamic Catenary Line, and Leaping Fish mesh
      const bobberGroup = new THREE.Group();
      bobberGroup.visible = false;
      const bobberTop = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
        new THREE.MeshStandardMaterial({ color: '#EF4444', roughness: 0.3, flatShading: true })
      );
      const bobberBot = new THREE.Mesh(
        new THREE.SphereGeometry(0.118, 10, 8, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5),
        new THREE.MeshStandardMaterial({ color: '#F8FAFC', roughness: 0.35, flatShading: true })
      );
      const bobberPin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.24, 5),
        new THREE.MeshBasicMaterial({ color: '#FACC15' })
      );
      bobberPin.position.y = 0.08;
      bobberGroup.add(bobberTop, bobberBot, bobberPin);
      scene.add(bobberGroup);

      const LINE_SEGMENTS = 14;
      const fishingLinePositions = new Float32Array((LINE_SEGMENTS + 1) * 3);
      const fishingLineGeo = new THREE.BufferGeometry();
      fishingLineGeo.setAttribute('position', new THREE.BufferAttribute(fishingLinePositions, 3));
      const fishingLineMat = new THREE.LineBasicMaterial({
        color: '#E2F1FF',
        transparent: true,
        opacity: 0.82,
      });
      const fishingLine = new THREE.Line(fishingLineGeo, fishingLineMat);
      fishingLine.visible = false;
      fishingLine.frustumCulled = false;
      scene.add(fishingLine);

      const leapingFishMesh = buildLeapingFishMesh('#38BDF8');
      leapingFishMesh.visible = false;
      scene.add(leapingFishMesh);

      const fishingState = {
        phase: 'idle' as 'idle' | 'dryWhip' | 'casting' | 'waiting' | 'bite' | 'reeling',
        timer: 0,
        waitDuration: 3.4,
        rippleTimer: 0,
        startX: 0,
        startY: 0,
        startZ: 0,
        targetX: 0,
        targetZ: 0,
      };
      const _rodTipWorld = new THREE.Vector3();

      const setFishingPhase = (next: typeof fishingState.phase) => {
        fishingState.phase = next;
        fishingState.timer = 0;
        if (next === 'waiting') setFishingBanner('waiting');
        else if (next === 'bite') setFishingBanner('bite');
        else setFishingBanner('none');
      };

      const cancelFishing = (toastMsg?: string) => {
        setFishingPhase('idle');
        bobberGroup.visible = false;
        fishingLine.visible = false;
        leapingFishMesh.visible = false;
        if (toastMsg) showToast(toastMsg);
      };

      const updateFishingLine = (
        ax: number,
        ay: number,
        az: number,
        bx: number,
        by: number,
        bz: number,
        sag: number
      ) => {
        const posAttr = fishingLineGeo.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i <= LINE_SEGMENTS; i++) {
          const t = i / LINE_SEGMENTS;
          const lx = THREE.MathUtils.lerp(ax, bx, t);
          const lz = THREE.MathUtils.lerp(az, bz, t);
          const curveSag = Math.sin(t * Math.PI) * sag;
          const ly = THREE.MathUtils.lerp(ay, by, t) - curveSag;
          posAttr.setXYZ(i, lx, ly, lz);
        }
        posAttr.needsUpdate = true;
      };

      const getRodTipPos = (out: THREE.Vector3) => {
        const rodTip = heroRig?.fishingRodTip ?? heroCustomEquipment?.fishingRodTip;
        if (rodTip) {
          rodTip.getWorldPosition(out);
        } else {
          out.set(
            heroX + Math.sin(heroYaw) * 1.4,
            heroY + 1.55,
            heroZ + Math.cos(heroYaw) * 1.4
          );
        }
        return out;
      };

      const bolts: { mesh: THREE.Mesh; vx: number; vz: number; life: number; isArrow?: boolean }[] = [];
      const evaporatingDamages: EvaporatingDamageNumber[] = [];
      const rpgVisualFx: RpgVisualFxItem[] = [];
      const companionAttackCooldowns = new Map<string, number>();
      const sparkGeo = new THREE.OctahedronGeometry(0.11, 0);
      const combatSparks: {
        mesh: THREE.Mesh;
        mat: THREE.MeshBasicMaterial;
        vx: number;
        vy: number;
        vz: number;
        life: number;
        maxLife: number;
        active: boolean;
      }[] = [];
      for (let i = 0; i < 32; i++) {
        const mat = new THREE.MeshBasicMaterial({
          color: '#FFD166',
          transparent: true,
          opacity: 0,
          depthWrite: false,
        });
        const shard = new THREE.Mesh(sparkGeo, mat);
        shard.visible = true;
        shard.frustumCulled = false;
        shard.position.set(0, -500, 0);
        shard.scale.setScalar(0.0001);
        scene.add(shard);
        combatSparks.push({
          mesh: shard,
          mat,
          vx: 0,
          vy: 0,
          vz: 0,
          life: 0,
          maxLife: 0.3,
          active: false,
        });
      }

      const spawnCombatSparks = (
        x: number,
        y: number,
        z: number,
        colorHex: string,
        count: number,
        speed = 6.5
      ) => {
        let spawned = 0;
        const limit = Math.min(count, 14);
        for (let i = 0; i < combatSparks.length && spawned < limit; i++) {
          const sp = combatSparks[i];
          if (sp.active) continue;
          sp.active = true;
          sp.mat.color.set(colorHex);
          sp.mat.opacity = 0.95;
          sp.mesh.position.set(x, y, z);
          sp.mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
          sp.mesh.scale.setScalar(1.0);
          const ang = (spawned / limit) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
          const spd = speed * (0.55 + Math.random() * 0.7);
          const maxLife = 0.24 + Math.random() * 0.22;
          sp.vx = Math.cos(ang) * spd;
          sp.vy = 2.2 + Math.random() * 4.5;
          sp.vz = Math.sin(ang) * spd;
          sp.life = maxLife;
          sp.maxLife = maxLife;
          spawned++;
        }
      };

      const ATTACK_DURATION = 0.44;
      const CHOP_DURATION = 0.48;
      const attackHitEnemies = new Set<string>();
      let activeAttackKind: 'sword' | 'axe' = 'sword';
      let activeAttackDuration = ATTACK_DURATION;
      let chopDidStrike = false;
      const _flashColor = new THREE.Color();

      const runInit = roguelikeRunRef.current;
      const initRelicMods = isRoguelikeLevel ? aggregateRelicModifiers(runInit.activeRelics) : null;
      const heroProfile = resolveHeroProfile(activeProject);
      const heroSkillSet = new Set(heroProfile.skills);
      const maxStamina = Math.max(40, Math.round(heroProfile.stats.staminaMax));
      const baseStartMaxHealth = isRoguelikeLevel
        ? Math.max(
            2,
            Math.round(
              activeLevel.roguelikeConfig?.startingMaxHealth ??
                DEFAULT_ROGUELIKE_CONFIG.startingMaxHealth
            )
          )
        : Math.max(3, Math.round(heroProfile.stats.maxHealth));
      let maxHealth = carryStats?.maxHealth ?? resumeSaved?.maxHealth ?? (baseStartMaxHealth + (initRelicMods?.maxHealthBonus ?? 0));
      let health =
        carryStats?.health ??
        resumeSaved?.health ??
        (isRoguelikeLevel
          ? Math.min(maxHealth, Math.max(1, runInit.currentHealth))
          : maxHealth);
      let stamina = maxStamina;
      let staminaExhausted = false;
      let lastStaminaToast = -10;
      let energy = 100;
      let lastEnergyToast = -10;
      let magic = 100;
      let coins = carryStats?.coins ?? resumeSaved?.coins ?? (isRoguelikeLevel ? runInit.coinsEarned : 0);
      let keys = carryStats?.keys ?? resumeSaved?.keys ?? 0;
      const insideSavePlinthIds = new Set<string>();
      let savePlinthCooldownUntil = spawnedOnPlinthId ? 1.6 : 0;
      if (spawnedOnPlinthId) {
        insideSavePlinthIds.add(spawnedOnPlinthId);
      }
      let floorDraftTriggered = false;
      let lastPortalLockedToastAt = -10;
      let lastRoguelikeBaddiesLeft = -1;
      const gameFlags = new Set<string>();
      let mechLevelStartsFired = false;
      let hitInvuln = 0;
      let attackAnimTimer = 0;
      let hitStopTimer = 0;
      let heroKnockVX = 0;
      let heroKnockVZ = 0;
      let heroRecoilTimer = 0;
      let heroHitPitchDir = -1;
      let heroHitRollDir = 0;
      let heroCustomMotionBlend = 0;
      let heroCustomMotionElapsed = 0;
      let heroCustomMotionKey = '';
      let heroLogicAnimName: string | null = null;
      let heroLogicAnimTimer = 0;
      let heroLogicAnimDuration = 1;
      let stepTimer = 0;
      let gameElapsed = 0;
      let hudSyncTimer = 0;
      let atmoSyncTimer = 0;
      let weatherSyncTimer = 0;
      let liveHour = activeLevel.timeOfDay ?? 12;
      let adaptiveScale = 1;
      let lowFpsStreak = 0;
      let highFpsStreak = 0;
      let lastShadowSnapX = Infinity;
      let lastShadowSnapZ = Infinity;
      let lastShadowUpdateTime = -1;
      const staticObjectives = activeLevel.objectives.map((o) => o.text);
      let shakeTimer = 0;

      liveStatsGetterRef.current = () => ({ coins, keys, health, maxHealth });
      liveGrantCurrencyRef.current = (coinDelta: number, keyDelta: number) => {
        if (coinDelta) coins += coinDelta;
        if (keyDelta) keys += keyDelta;
      };
      liveRpgApplyRewardRef.current = (card: RpgRewardCardOption) => {
        const eff = card.effect;
        if (eff.maxHeartsBonus) {
          maxHealth += eff.maxHeartsBonus;
        }
        if (eff.healHearts) {
          health = Math.min(maxHealth, health + eff.healHearts);
        }
        if (eff.manaRestore) {
          magic = Math.min(100, magic + eff.manaRestore);
        }
        if (eff.coinsBonus) {
          coins += eff.coinsBonus;
        }
        setRpgStats((prev) => ({
          ...prev,
          atkBonus: prev.atkBonus + (eff.atkBonus ?? 0),
          defBonus: prev.defBonus + (eff.defBonus ?? 0),
          magicBonus: prev.magicBonus + (eff.magicBonus ?? 0),
          potions: prev.potions + (eff.givePotionQty ?? 0),
          herbs: prev.herbs + (eff.giveHerbQty ?? 0),
          weaponName: eff.grantWeaponName ?? prev.weaponName,
        }));
        setHudState((prev) => ({
          ...prev,
          health,
          maxHealth,
          magic,
          coins,
        }));
        AudioEngine.playSound('chime');
        AudioEngine.playSound('sparkle');
        spawnCombatSparks(heroX, heroY + 1.3, heroZ, card.borderColor, 18, 7.5);
        spawnEvaporatingDamageNumber(
          scene,
          evaporatingDamages,
          heroX,
          heroY + 2.1,
          heroZ,
          card.statLabel.split('·')[0].trim(),
          card.borderColor,
          card.title.toUpperCase()
        );
        showToast(`Acquired Card: ${card.title} (${card.statLabel})!`);
      };
      sameLevelTravelFnRef.current = (target: SavePlinthTarget) => {
        const [destX, destZ] = resolveHorizontalCollision(
          activeLevel,
          target.localX,
          target.localZ,
          isDriving ? 1.15 : 0.62,
          true,
          collisionCtx
        );
        heroX = destX;
        heroZ = destZ;
        heroY = Math.max(0.2, sampleLevelHeight(activeLevel, heroX, heroZ));
        heroVelY = 0;
        carVelX = 0;
        carVelZ = 0;
        respawnX = destX;
        respawnZ = destZ;
        respawnYaw = heroYaw;
        insideSavePlinthIds.add(target.entityId);
        savePlinthCooldownUntil = gameElapsed + 1.8;
        heroRoot.position.set(heroX, heroY, heroZ);
        if (carRig) {
          carRig.group.position.set(heroX, heroY, heroZ);
        }
        const [mx, mz] = revealAtHero();
        liveHeroTransformRef.current = { x: heroX, z: heroZ, yaw: heroYaw };
        publishLivePlayerTelemetry({
          levelId: activeLevel.id,
          point: levelWorldToBoard(activeLevel, heroX, heroZ),
          yaw: heroYaw,
          worldX: mx,
          worldZ: mz,
          buddiesFound: recruitedBuddyIds.length,
          buddiesTotal: buddyEntities.length,
          trail: [...boardTrail],
        });
        spawnCombatSparks(heroX, heroY + 1.4, heroZ, '#38BDF8', 20, 7.5);
        AudioEngine.playSound('sparkle');
        const snapDist = inputRef.current.cameraDistance;
        camera.position.set(
          heroX + Math.sin(inputRef.current.cameraYaw) * snapDist,
          heroY + 3.8,
          heroZ + Math.cos(inputRef.current.cameraYaw) * snapDist
        );
        camera.lookAt(heroX, heroY + 1.15, heroZ);
        showToast(`Fast-traveled to ${target.name}`);
      };

      // Zero-allocation scratch vectors for tick()
      const _targetCamPos = new THREE.Vector3();
      const _lookTarget = new THREE.Vector3();
      const _carCamEyePos = new THREE.Vector3();
      const _sunOffset = sun.position.clone();
      const _cutCurrLook = new THREE.Vector3(heroX, heroY + 1.15, heroZ);
      const _cutBaseCamPos = new THREE.Vector3();
      const _cutBaseCamLook = new THREE.Vector3();

      // Live Camera Cutaways & Skit Sequencer runtime state
      interface ActiveCutawayState {
        skit: StorySkit;
        beatIndex: number;
        phase: 'in' | 'hold' | 'out';
        phaseElapsed: number;
        phaseDuration: number;
        beatElapsed: number;
        voiceDone: boolean;
        hasVoiceClip: boolean;
        fromPos: THREE.Vector3;
        fromLook: THREE.Vector3;
        fromFov: number;
        goalPos: THREE.Vector3;
        goalLook: THREE.Vector3;
        goalFov: number;
        returnDuration: number;
      }

      let activeCutaway: ActiveCutawayState | null = null;
      const playedSkitIds = new Set<string>();
      const skitNearState = new Map<string, boolean>();
      const firedCardIds = new Set<string>();
      const cardNearState = new Map<string, boolean>();
      let levelStartSkitsChecked = false;
      let pendingRehearseSkitId = rehearseSkitIdRef.current;

      const getTransitionSeconds = (t?: CameraCutawayTransition): number => {
        if (t === 'snapCut') return 0.02;
        if (t === 'glide') return 0.92;
        return 0.44; // whipPan default
      };

      const resolveCutawayPose = (
        beat: SkitBeat,
        outPos: THREE.Vector3,
        outLook: THREE.Vector3
      ): number => {
        const shots = activeLevel.storyShots ?? [];
        const shot: StoryCameraShot | undefined = beat.cameraShotId
          ? shots.find((s) => s.id === beat.cameraShotId || s.name === beat.cameraShotId)
          : undefined;

        if (shot) {
          const targetRt =
            shot.targetMode === 'entity' && shot.targetEntityId
              ? runtimeEntities.find((r) => r.id === shot.targetEntityId)
              : undefined;
          let tx = heroX;
          let tz = heroZ;
          let groundY = heroY;
          if (targetRt) {
            tx = targetRt.x;
            tz = targetRt.z;
            groundY = sampleLevelHeight(activeLevel, tx, tz);
          } else if (shot.point) {
            const [wx, wz] = levelBoardToWorld(activeLevel, shot.point);
            tx = wx;
            tz = wz;
            groundY = sampleLevelHeight(activeLevel, tx, tz);
          }
          const lookY = groundY + (shot.heightOffset ?? 1.25);
          const yawRad = ((shot.yaw ?? 26) * Math.PI) / 180;
          const pitchRad = (THREE.MathUtils.clamp(shot.pitch ?? 18, 5, 70) * Math.PI) / 180;
          const dist = THREE.MathUtils.clamp(shot.distance ?? 7.2, 3, 28);
          const cosP = Math.cos(pitchRad);
          outLook.set(tx, lookY, tz);
          outPos.set(
            tx + Math.sin(yawRad) * cosP * dist,
            lookY + Math.sin(pitchRad) * dist,
            tz + Math.cos(yawRad) * cosP * dist
          );
          const camGnd = sampleLevelHeight(activeLevel, outPos.x, outPos.z);
          outPos.y = Math.max(outPos.y, camGnd + 0.85);
          return THREE.MathUtils.clamp(shot.fov ?? 48, 32, 68);
        }

        // Auto-frame speaker
        const speakerRt =
          beat.speakerKind === 'entity' && beat.speakerEntityId
            ? runtimeEntities.find((r) => r.id === beat.speakerEntityId)
            : undefined;
        let tx = heroX;
        let tz = heroZ;
        let groundY = heroY;
        let facingYaw = heroYaw;
        if (speakerRt) {
          tx = speakerRt.x;
          tz = speakerRt.z;
          groundY = sampleLevelHeight(activeLevel, tx, tz);
          facingYaw = speakerRt.mesh.rotation.y;
        } else if (beat.lookAtKind === 'entity' && beat.lookAtEntityId) {
          const lookRt = runtimeEntities.find((r) => r.id === beat.lookAtEntityId);
          if (lookRt) {
            tx = lookRt.x;
            tz = lookRt.z;
            groundY = sampleLevelHeight(activeLevel, tx, tz);
            facingYaw = lookRt.mesh.rotation.y;
          }
        }
        const orbitYaw = facingYaw + 0.36;
        const dist = 5.4;
        const pitchRad = (17 * Math.PI) / 180;
        const cosP = Math.cos(pitchRad);
        outLook.set(tx, groundY + 1.2, tz);
        outPos.set(
          tx + Math.sin(orbitYaw) * cosP * dist,
          outLook.y + Math.sin(pitchRad) * dist,
          tz + Math.cos(orbitYaw) * cosP * dist
        );
        const camGnd = sampleLevelHeight(activeLevel, outPos.x, outPos.z);
        outPos.y = Math.max(outPos.y, camGnd + 0.85);
        return 46;
      };

      const enterCutawayBeat = (ctx: ActiveCutawayState, idx: number) => {
        const beat = ctx.skit.beats[idx];
        if (!beat) return;
        for (const rt of runtimeEntities) {
          rt.skitEmote = null;
          rt.skitMoving = false;
        }
        AudioEngine.stopVoice('skit_cutaway');

        ctx.beatIndex = idx;
        ctx.beatElapsed = 0;
        ctx.voiceDone = false;
        ctx.phase = 'in';
        ctx.phaseElapsed = 0;
        ctx.phaseDuration = getTransitionSeconds(beat.transition);
        ctx.fromPos.copy(camera.position);
        ctx.fromLook.copy(_cutCurrLook);
        ctx.fromFov = camera.fov;
        ctx.goalFov = resolveCutawayPose(beat, ctx.goalPos, ctx.goalLook);

        const speakerRt =
          beat.speakerKind === 'entity' && beat.speakerEntityId
            ? runtimeEntities.find((r) => r.id === beat.speakerEntityId)
            : undefined;
        if (speakerRt && beat.emote && beat.emote !== 'none') {
          speakerRt.skitEmote = beat.emote;
        }

        const speakerLabel =
          beat.speakerKind === 'narrator'
            ? beat.speakerNameOverride?.trim() || 'Narrator'
            : beat.speakerKind === 'hero'
            ? beat.speakerNameOverride?.trim() || activeProject.heroName || 'Hero'
            : speakerRt?.name || 'Character';

        const clipId = resolveVoiceClipForLine(beat.voiceConfig, 0);
        ctx.hasVoiceClip = Boolean(clipId);
        if (clipId) {
          AudioEngine.playVoiceClip(clipId, {
            ownerKey: 'skit_cutaway',
            volume: beat.voiceConfig?.volume ?? 1.0,
            playbackRate: beat.voiceConfig?.playbackRate ?? 1.0,
            onEnded: () => {
              if (activeCutaway === ctx && ctx.beatIndex === idx) {
                ctx.voiceDone = true;
              }
            },
          });
        }

        if (beat.speakerKind !== 'narrator' && beat.text.trim()) {
          if (speakerRt) {
            pushCharacterSpeech(
              {
                key: speakerRt.id,
                entityId: speakerRt.id,
                speaker: speakerLabel,
                roleLabel: EntityKindMeta[speakerRt.kind as EntityKind]?.title ?? 'Character',
                kind: speakerRt.kind as EntityKind,
                lines: [beat.text],
                lineIndex: 0,
                style: speakerRt.chatStyle,
                voiceConfig: beat.voiceConfig,
                isProximity: false,
                expiresAt: performance.now() + Math.max(beat.durationSec, 2.8) * 1000 + 800,
              },
              true,
              false
            );
          } else if (beat.speakerKind === 'hero') {
            pushCharacterSpeech(
              {
                key: 'hero',
                entityId: 'hero',
                speaker: speakerLabel,
                roleLabel: 'Hero',
                kind: 'hero',
                lines: [beat.text],
                lineIndex: 0,
                style: heroChatStyleRef.current,
                voiceConfig: beat.voiceConfig,
                isProximity: false,
                expiresAt: performance.now() + Math.max(beat.durationSec, 2.8) * 1000 + 800,
              },
              true,
              false
            );
          }
        }

        setActiveCutawayHud({
          skitId: ctx.skit.id,
          skitName: ctx.skit.name,
          caption: ctx.skit.caption,
          showLetterbox: ctx.skit.showLetterbox,
          narratorText: beat.speakerKind === 'narrator' ? beat.text : undefined,
          speakerLabel,
          beatIndex: idx,
          totalBeats: ctx.skit.beats.length,
        });
      };

      const startCutawaySkit = (skit: StorySkit, forcePlay = false) => {
        if (activeCutaway || !skit.beats || skit.beats.length === 0) return;
        if (!forcePlay && skit.playOnce && playedSkitIds.has(skit.id)) return;
        playedSkitIds.add(skit.id);
        skipCutawaySignalRef.current = false;
        cutawayHeroLockRef.current = skit.pauseHeroMovement;

        const ctx: ActiveCutawayState = {
          skit,
          beatIndex: 0,
          phase: 'in',
          phaseElapsed: 0,
          phaseDuration: getTransitionSeconds(skit.beats[0]?.transition),
          beatElapsed: 0,
          voiceDone: false,
          hasVoiceClip: false,
          fromPos: camera.position.clone(),
          fromLook: _cutCurrLook.clone(),
          fromFov: camera.fov,
          goalPos: new THREE.Vector3(),
          goalLook: new THREE.Vector3(),
          goalFov: 48,
          returnDuration: getTransitionSeconds(skit.returnTransition),
        };
        activeCutaway = ctx;
        enterCutawayBeat(ctx, 0);
      };

      const startSingleShotCutaway = (shotRef: string) => {
        if (activeCutaway) return;
        const needle = shotRef.trim().toLowerCase();
        const shots = activeLevel.storyShots ?? [];
        const shot =
          shots.find((s) => s.id === shotRef || s.name.trim().toLowerCase() === needle) ??
          shots[0];
        if (!shot) return;
        const quickSkit: StorySkit = {
          id: `quick_${shot.id}`,
          name: shot.name,
          caption: shot.name,
          triggerKind: 'manual',
          playOnce: false,
          pauseHeroMovement: true,
          showLetterbox: true,
          returnTransition: 'whipPan',
          beats: [
            {
              id: 'quick_beat_0',
              speakerKind: 'narrator',
              text: '',
              cameraShotId: shot.id,
              transition: 'whipPan',
              emote: 'none',
              lookAtKind: 'camera',
              durationSec: 2.6,
              waitForVoice: false,
            },
          ],
        };
        startCutawaySkit(quickSkit, true);
      };

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

      let perfFrames = 0;
      let perfWindowStart = performance.now();
      let lastPerfHudUiMs = 0;
      let lastCompactFps = -1;
      let cachedHotbarKey = '';
      let cachedHotbarItems: HUDState['hotbarItems'] = [];
      let cachedBaddieKey = '';
      let cachedBaddiePoints: BoardPoint[] = [];
      let cachedHudKey = '';
      let lastPubBuddyCount = -1;
      let cachedRecruitedBuddyIds: string[] = [];
      let lastPubCheckpointCount = -1;
      let cachedClearedCheckpointIds: string[] = [];
      let cachedTrailSnapshot: BoardPoint[] = [];
      let lastPubPointX = Number.NaN;
      let lastPubPointY = Number.NaN;
      let lastPubYaw = Number.NaN;
      let lastPubSpeed: number | undefined = undefined;
      let lastHarvestPromptKey = '';
      let lastDoorPromptKey = '';
      let lastChestPromptKey = '';
      let openingChestId: string | null = null;
      let lastSitPromptKey = '';
      let lastClimbPromptKey = '';
      let lastWorldActionPromptKey = '';
      let lastGlidePromptKey: 'ready' | 'readySecond' | 'gliding' | '' = '';
      const attackHitFlora = new Set<string>();
      const rockTargetBuffer: RockImpactEnemyTarget[] = [];
      let lastNearCraftingBench = false;
      let armorBlockCounter = 0;

      // Hero knockdown (fall on rump + bounce + get up), elemental residual statuses, & boss victory celebration
      let heroKnockdownPhase: 'none' | 'fall' | 'bounce' | 'stun' | 'getup' = 'none';
      let heroKnockdownTimer = 0;
      const heroStatusTimers: ActiveHeroEffectTimers = {
        burn: 0,
        freeze: 0,
        shock: 0,
        poison: 0,
        soak: 0,
      };
      let heroStatusTickAccum = 0;
      let heroVictoryTimer = 0;
      let bossVictoryBannerTimer = -99;
      let lastStatusBannerKey = '';
      let lastTraitBannerKey = '';
      let heroEnvEvalTimer = 0;
      let heroEnvEval: HeroEnvEvalResult = {
        speedMult: heroProfile.stats.moveSpeedMult,
        climbSpeedMult: heroProfile.stats.moveSpeedMult,
        swimSpeedMult: heroProfile.stats.moveSpeedMult,
        jumpMult: heroProfile.stats.jumpPowerMult,
        staminaDrainMult: 1,
        staminaRegenMult: heroProfile.stats.staminaRegenMult,
        ambientTemp: 'temperate',
        activeTerrainKey: 'grassland',
        activeSummary: '',
        activeTone: 'neutral',
      };

      let isGliding = false;
      let airJumpPresses = 0;
      let secondJumpHoldTime = 0;
      let glideDeployBlend = 0;
      let glideBankRoll = 0;
      let wasGlidingCustom = false;
      const _glideHandL = new THREE.Vector3();
      const _glideHandR = new THREE.Vector3();

      let isSitting = false;
      let sitTargetX = 0;
      let sitTargetY = 0;
      let sitTargetZ = 0;
      let sitFacingYaw = 0;
      let preSitCamMode: CameraMode | null = null;
      const enterSitWithPov = (facingYaw: number) => {
        if (isDriving || env === 'sideScroller') return;
        const curCam = resolvedCamModeRef.current;
        const fallbackBehind: CameraMode =
          baseCamMode === 'firstPerson' || baseCamMode === 'heroFront' || baseCamMode === 'sideScroll'
            ? 'front'
            : baseCamMode;
        preSitCamMode =
          curCam === 'firstPerson' || curCam === 'heroFront' || curCam === 'sideScroll'
            ? fallbackBehind
            : curCam;
        inputRef.current.lookPitchOffset = -0.02;
        inputRef.current.lookYawOffset = 0;
        inputRef.current.cameraYaw = Math.atan2(-Math.sin(facingYaw), -Math.cos(facingYaw));
        resolvedCamModeRef.current = 'firstPerson';
        setLiveCamMode('firstPerson');
      };
      const standUpFromSit = () => {
        isSitting = false;
        heroY = Math.max(heroY, sampleLevelHeight(activeLevel, heroX, heroZ));
        if (isDriving || env === 'sideScroller') return;
        const fallbackBehind: CameraMode =
          baseCamMode === 'firstPerson' || baseCamMode === 'heroFront' || baseCamMode === 'sideScroll'
            ? 'front'
            : baseCamMode;
        const behindMode: CameraMode = preSitCamMode ?? fallbackBehind;
        preSitCamMode = null;
        if (resolvedCamModeRef.current === 'firstPerson') {
          heroYaw = Math.atan2(
            -Math.sin(inputRef.current.cameraYaw),
            -Math.cos(inputRef.current.cameraYaw)
          );
        }
        smoothCamYaw = heroYaw;
        inputRef.current.lookPitchOffset = 0;
        inputRef.current.lookYawOffset = 0;
        inputRef.current.cameraYaw = Math.atan2(-Math.sin(heroYaw), -Math.cos(heroYaw));
        resolvedCamModeRef.current = behindMode;
        setLiveCamMode(behindMode);
      };
      let isClimbing = false;
      let climbKind: 'entity' | 'tree' | 'mountain' = 'entity';
      let climbingTree: (typeof islandHandles.choppableTrees)[number] | null = null;
      let climbAnchorX = 0;
      let climbAnchorZ = 0;
      let climbMaxY = 12;
      let climbPhase = 0;
      let prevHeroFloorY = heroY;
      let isClimbingStairs = false;
      let hasNearbyInteractablePrev = false;
      let shieldGuardTimer = 0;
      let interactConsumedLock = false;
      let wasBlockingCustom = false;
      const choppedStumps: {
        id: string;
        x: number;
        y: number;
        z: number;
        size: number;
        topOffsetY: number;
        label: string;
      }[] = [];

      const getEntityAttrs = (rt: RuntimeEntity): ObjectInteractionAttributeId[] => {
        if (rt.interactionAttributes && rt.interactionAttributes.length > 0) {
          return rt.interactionAttributes;
        }
        const out: ObjectInteractionAttributeId[] = [];
        const lower = rt.name.toLowerCase();
        if (
          !rt.pickupable &&
          rt.kind !== 'pickup' &&
          rt.propPreset !== 'craftingBench' &&
          (lower.includes('chair') ||
            lower.includes('bench') ||
            lower.includes('stool') ||
            lower.includes('stump') ||
            lower.includes('fallen log') ||
            lower.includes('river stone') ||
            lower.includes('boulder') ||
            lower.includes('rock') ||
            lower.includes('seat') ||
            lower.includes('sofa') ||
            lower.includes('couch'))
        ) {
          out.push('sit');
        }
        if (lower.includes('ladder')) {
          out.push('climbVertical');
        }
        if (
          rt.buildingBlock?.shape === 'stairsStraight' ||
          rt.buildingBlock?.shape === 'stairsSpiral'
        ) {
          out.push('climbStairs');
        }
        return out;
      };

      function tick() {
        if (disposed) return;
        try {
        timer.update();
        const dt = Math.min(0.05, timer.getDelta());
        const inp = inputRef.current;
        const pausedNow = flagsRef.current.pausedByScreen;
        const camModeNow = resolvedCamModeRef.current;

        if (pausedNow) {
          inp.jumpPointerDown = false;
          inp.jumpPressQueuedCount = 0;
          inp.interactPointerDown = false;
        }

        if (!pausedNow) {
          // Brief crisp micro-hitstop freezes combat motion for a tactile melee impact punch
          const simDt = hitStopTimer > 0 ? dt * 0.14 : dt;
          hitStopTimer = Math.max(0, hitStopTimer - dt);

          gameElapsed += simDt;
          islandHandles.timeUniform.value = gameElapsed;
          islandHandles.windUniform.value = computeWeatherWindFactor(
            activeLevel.weather,
            activeLevel.wind
          );
          updateSkyClouds(scene, gameElapsed, activeLevel.wind);
          hitInvuln = Math.max(0, hitInvuln - dt);
          attackAnimTimer = Math.max(0, attackAnimTimer - simDt);
          heroRecoilTimer = Math.max(0, heroRecoilTimer - dt);
          shakeTimer = Math.max(0, shakeTimer - dt);
          swimReenterCooldown = Math.max(0, swimReenterCooldown - dt);
          swimExitCooldown = Math.max(0, swimExitCooldown - dt);
          inp.emoteTimer = Math.max(0, inp.emoteTimer - dt);
          if (inp.emoteTimer === 0) inp.emoteType = '';

          magic = Math.min(100, magic + dt * 5);

          // Animate flickering torches in Dungeon / Castle
          for (const th of islandHandles.torchLights) {
            th.light.intensity =
              th.baseIntensity +
              Math.sin(gameElapsed * 7.2 + th.phase) * 1.15 +
              Math.cos(gameElapsed * 13.1 + th.phase * 1.7) * 0.5;
          }
          for (const fm of islandHandles.flameMeshes) {
            fm.mesh.position.y = fm.baseY + Math.sin(gameElapsed * 8.5 + fm.phase) * 0.045;
            const s = 1 + Math.sin(gameElapsed * 10 + fm.phase) * 0.12;
            fm.mesh.scale.set(s, 1 + Math.cos(gameElapsed * 9 + fm.phase) * 0.18, s);
          }
          updateRiverFishAnimations(islandHandles.riverFish, gameElapsed);
          updateCaveInteractiveAnimations(
            islandHandles.caveInteractiveHandles,
            gameElapsed,
            [heroX, heroY, heroZ]
          );

          // Day-Night Cycle progression
          if (activeLevel.autoCycleTime && env !== 'dungeon') {
            liveHour = (liveHour + dt * 0.24) % 24;
            atmoSyncTimer += dt;
            if (atmoSyncTimer >= 0.2) {
              atmoSyncTimer = 0;
              applyAtmosphere(scene, sun, hemi, activeLevel, renderer, liveHour);
              _sunOffset.copy(sun.position);
              if (Number.isFinite(lastShadowSnapX) && Number.isFinite(lastShadowSnapZ)) {
                sun.position.set(
                  lastShadowSnapX + _sunOffset.x,
                  _sunOffset.y,
                  lastShadowSnapZ + _sunOffset.z
                );
              }
              if (!isSoftwareGl && sun.castShadow) {
                sun.shadow.needsUpdate = true;
              }
            }
          }

          // Live equipment & Roguelike relic bonuses
          shieldGuardTimer = Math.max(0, shieldGuardTimer - dt);
          let isShieldBlockingNow = false;
          const eqNow = equipmentRef.current;
          const heldDefNow = eqNow.heldItemId ? itemByIdRef.current.get(eqNow.heldItemId) ?? null : null;
          const offhandDefNow = eqNow.offhandItemId
            ? itemByIdRef.current.get(eqNow.offhandItemId) ?? null
            : null;
          const twoHandedHeldNow = Boolean(
            heldDefNow?.handedness === 'twoHand' ||
              heldDefNow?.toolKind === 'axe' ||
              heldDefNow?.toolKind === 'fishingPole'
          );
          const activeOffhandDefNow = !twoHandedHeldNow ? offhandDefNow : null;
          const hasUsableShield = Boolean(
            activeOffhandDefNow &&
              (activeOffhandDefNow.wearSlot === 'offhand' ||
                typeof activeOffhandDefNow.blockReduction === 'number')
          );
          const headDefNow = eqNow.headItemId ? itemByIdRef.current.get(eqNow.headItemId) ?? null : null;
          const bodyDefNow = eqNow.bodyItemId ? itemByIdRef.current.get(eqNow.bodyItemId) ?? null : null;
          const accDefNow = eqNow.accessoryItemId ? itemByIdRef.current.get(eqNow.accessoryItemId) ?? null : null;
          const relicMods = isRoguelikeLevel
            ? aggregateRelicModifiers(roguelikeRunRef.current.activeRelics)
            : null;

          const wearMaxHpBonus =
            (activeOffhandDefNow?.maxHealthBonus ?? 0) +
            (headDefNow?.maxHealthBonus ?? 0) +
            (bodyDefNow?.maxHealthBonus ?? 0) +
            (accDefNow?.maxHealthBonus ?? 0) +
            (relicMods?.maxHealthBonus ?? 0);
          const nextMaxHealth = baseStartMaxHealth + wearMaxHpBonus;
          if (nextMaxHealth > maxHealth) {
            health += nextMaxHealth - maxHealth;
          }
          maxHealth = nextMaxHealth;
          health = Math.min(health, maxHealth);

          const heroAttackDamage =
            heroProfile.stats.baseAttack +
            (heroSkillSet.has('powerStrike') ? 1 : 0) +
            (heroSkillSet.has('glassCannon') ? 2 : 0) +
            (heldDefNow?.attackBonus ?? 0) +
            (headDefNow?.attackBonus ?? 0) +
            (bodyDefNow?.attackBonus ?? 0) +
            (accDefNow?.attackBonus ?? 0) +
            (relicMods?.attackBonus ?? 0);
          const heroDefensePower = Math.max(
            0,
            heroProfile.stats.baseDefense +
              (heroSkillSet.has('heavyArmorClumsy') ? 1 : 0) -
              (heroSkillSet.has('glassCannon') ? 1 : 0) +
              (heldDefNow?.defenseBonus ?? 0) +
              (activeOffhandDefNow?.defenseBonus ?? 0) +
              (headDefNow?.defenseBonus ?? 0) +
              (bodyDefNow?.defenseBonus ?? 0) +
              (accDefNow?.defenseBonus ?? 0) +
              (relicMods?.defenseBonus ?? 0)
          );

          heroEnvEvalTimer -= dt;
          if (heroEnvEvalTimer <= 0) {
            heroEnvEvalTimer = 0.16;
            const curLayer = sampleTerrainLayer(activeLevel.terrain, heroX, heroZ);
            const curWeathering = sampleTerrainWeathering(activeLevel.terrain, heroX, heroZ);
            const curFloorForEval = sampleLevelHeight(activeLevel, heroX, heroZ);
            const curWaterDepth = env === 'openWorld' ? IslandTerrain.waterLevel - curFloorForEval : 0;
            const curInCave = isInsideAnyCave(activeLevel.terrain, heroX, heroZ);
            heroEnvEval = evaluateHeroEnvironmentModifiers(
              heroProfile,
              activeLevel,
              env,
              curLayer,
              curWeathering,
              curWaterDepth,
              isSwimming,
              isClimbing,
              heroY,
              liveHour,
              curInCave,
              heroStatusTimers.burn > 0
            );
            const nextTraitKey =
              heroEnvEval.activeSummary && heroEnvEval.activeTone !== 'neutral'
                ? `${heroEnvEval.activeTone}:${heroEnvEval.activeSummary}`
                : '';
            if (nextTraitKey !== lastTraitBannerKey) {
              lastTraitBannerKey = nextTraitKey;
              if (!nextTraitKey || heroEnvEval.activeTone === 'neutral') {
                setHeroTraitBanner(null);
              } else {
                setHeroTraitBanner({
                  label: heroEnvEval.activeSummary,
                  tone: heroEnvEval.activeTone,
                });
              }
            }
          }

          const heroSpeedMultBase =
            (isSwimming
              ? heroEnvEval.swimSpeedMult
              : isClimbing
              ? heroEnvEval.climbSpeedMult
              : heroEnvEval.speedMult) +
            (activeOffhandDefNow?.speedBonus ?? 0) +
            (headDefNow?.speedBonus ?? 0) +
            (bodyDefNow?.speedBonus ?? 0) +
            (accDefNow?.speedBonus ?? 0) +
            (relicMods?.speedBonus ?? 0);
          const staminaRegenMult = heroEnvEval.staminaRegenMult + (relicMods?.staminaRegenMult ?? 0);

          const triggerHeroDeath = () => {
            if (isRoguelikeLevel) {
              const snap = roguelikeRunRef.current;
              const summary = {
                floorReached: snap.floorNumber,
                enemiesSlain: snap.enemiesSlain,
                bossesSlain: snap.bossesSlain,
                coinsEarned: coins,
                relicIds: snap.activeRelics,
                runSeed: snap.runSeed,
              };
              const nextSnap = { ...snap, currentHealth: 0, coinsEarned: coins, runSummary: summary };
              roguelikeRunRef.current = nextSnap;
              setRoguelikeRun(nextSnap);
            }
            setDead(true);
          };

          // Advance hero knockdown (fall onto rump -> bounce -> dazed -> animated get-up)
          const knockdownDurFactor = heroSkillSet.has('ironResolve') ? 0.65 : 1;
          if (heroKnockdownPhase !== 'none') {
            heroKnockdownTimer -= dt;
            if (heroKnockdownTimer <= 0) {
              if (heroKnockdownPhase === 'fall') {
                heroKnockdownPhase = 'bounce';
                heroKnockdownTimer = 0.22 * knockdownDurFactor;
                heroEffects.emitKnockdownImpact(heroX, heroY, heroZ);
                AudioEngine.playSound('hit');
              } else if (heroKnockdownPhase === 'bounce') {
                heroKnockdownPhase = 'stun';
                heroKnockdownTimer = 0.44 * knockdownDurFactor;
              } else if (heroKnockdownPhase === 'stun') {
                heroKnockdownPhase = 'getup';
                heroKnockdownTimer = 0.42 * knockdownDurFactor;
              } else {
                heroKnockdownPhase = 'none';
                heroKnockdownTimer = 0;
              }
            }
          }

          // Advance Boss Victory banner & celebration sparkles
          if (heroVictoryTimer > 0) {
            heroVictoryTimer = Math.max(0, heroVictoryTimer - dt);
            heroEffects.emitVictorySparkles(heroX, heroY, heroZ, dt);
          }
          if (heroLogicAnimTimer > 0) {
            heroLogicAnimTimer = Math.max(0, heroLogicAnimTimer - dt);
            if (heroLogicAnimTimer <= 0) {
              heroLogicAnimName = null;
            }
          }
          if (bossVictoryBannerTimer > -50) {
            bossVictoryBannerTimer -= dt;
            if (bossVictoryBannerTimer <= 0) {
              bossVictoryBannerTimer = -99;
              setBossVictoryBanner(null);
            }
          }

          // Advance hero elemental status timers (burn, freeze, shock, poison, soak)
          if (heroStatusTimers.burn > 0) heroStatusTimers.burn = Math.max(0, heroStatusTimers.burn - dt);
          if (heroStatusTimers.freeze > 0) heroStatusTimers.freeze = Math.max(0, heroStatusTimers.freeze - dt);
          if (heroStatusTimers.shock > 0) heroStatusTimers.shock = Math.max(0, heroStatusTimers.shock - dt);
          if (heroStatusTimers.poison > 0) heroStatusTimers.poison = Math.max(0, heroStatusTimers.poison - dt);
          if (heroStatusTimers.soak > 0) heroStatusTimers.soak = Math.max(0, heroStatusTimers.soak - dt);

          const hasDotStatus =
            heroStatusTimers.burn > 0 || heroStatusTimers.shock > 0 || heroStatusTimers.poison > 0;
          if (hasDotStatus) {
            heroStatusTickAccum += dt;
            if (heroStatusTickAccum >= 1.65) {
              heroStatusTickAccum = 0;
              if (health > 1) {
                health -= 1;
                AudioEngine.playSound(heroStatusTimers.shock > 0 ? 'sparkle' : 'hurt');
                if (heroStatusTimers.burn > 0) {
                  showToast('Burning! Flames & soot scorch you (-1 HP)');
                } else if (heroStatusTimers.shock > 0) {
                  showToast('Shocked! Electric current jolts you (-1 HP)');
                } else {
                  showToast('Poisoned! Venom drains your strength (-1 HP)');
                }
              } else if (heroStatusTimers.burn > 0 || heroStatusTimers.shock > 0 || heroStatusTimers.poison > 0) {
                // Allow elemental DoT to finish off a critically low hero if not healed/cured
                health = 0;
                triggerHeroDeath();
              }
            }
          } else {
            heroStatusTickAccum = 0;
          }

          heroEffects.updateHeroStatuses(heroX, heroY, heroZ, dt, heroStatusTimers);
          heroEffects.tick(dt);

          const heroStatusSlow =
            heroStatusTimers.freeze > 0
              ? 0.58
              : heroStatusTimers.soak > 0
              ? 0.8
              : heroStatusTimers.shock > 0
              ? 0.86
              : heroStatusTimers.burn > 0
              ? 0.94
              : 1;
          const heroSpeedMult = heroSpeedMultBase * heroStatusSlow;
          const heroDefensePenalty =
            (heroStatusTimers.freeze > 0 ? 1 : 0) +
            (heroStatusTimers.burn > 0 ? 1 : 0) +
            (heroStatusTimers.shock > 0 ? 1 : 0) +
            (heroStatusTimers.poison > 0 ? 1 : 0);
          const effectiveHeroDefense = Math.max(0, heroDefensePower - heroDefensePenalty);

          // Sync clean status pill only on transitions
          const nextStatusKind: HeroStatusEffectKind | 'knockdown' | '' =
            heroKnockdownPhase !== 'none'
              ? 'knockdown'
              : heroStatusTimers.burn > 0
              ? 'burn'
              : heroStatusTimers.freeze > 0
              ? 'freeze'
              : heroStatusTimers.shock > 0
              ? 'shock'
              : heroStatusTimers.poison > 0
              ? 'poison'
              : heroStatusTimers.soak > 0
              ? 'soak'
              : '';
          if (nextStatusKind !== lastStatusBannerKey) {
            lastStatusBannerKey = nextStatusKind;
            if (!nextStatusKind) {
              setHeroStatusBanner(null);
            } else {
              const statusLabelMap: Record<HeroStatusEffectKind | 'knockdown', string> = {
                knockdown: heroKnockdownPhase === 'stun' ? 'Knocked Down & Dazed!' : 'Knocked Down!',
                burn: 'On Fire (Burn · -1 Def)',
                freeze: 'Frozen (Slowed · -1 Def)',
                shock: 'Electrified (Shock · -1 Def)',
                poison: 'Poisoned (-1 Def)',
                soak: 'Drenched (Slowed)',
              };
              setHeroStatusBanner({
                kind: nextStatusKind,
                label: statusLabelMap[nextStatusKind],
              });
            }
          }

          const recordRoguelikeEnemyKill = (rt: RuntimeEntity) => {
            if (!isRoguelikeLevel) return;
            const mods = aggregateRelicModifiers(roguelikeRunRef.current.activeRelics);
            if (mods.coinBonusOnKill > 0) {
              coins += mods.coinBonusOnKill;
            }
            let nextKillSteal = roguelikeRunRef.current.killStealProgress + mods.lifestealOnKill;
            if (nextKillSteal >= 1) {
              const healAmt = Math.floor(nextKillSteal);
              nextKillSteal -= healAmt;
              if (health < maxHealth) {
                health = Math.min(maxHealth, health + healAmt);
                showToast(`Vampiric Fang restored +${healAmt} HP!`);
              }
            }
            const nextSnap = {
              ...roguelikeRunRef.current,
              enemiesSlain: roguelikeRunRef.current.enemiesSlain + 1,
              bossesSlain: roguelikeRunRef.current.bossesSlain + (rt.isBoss ? 1 : 0),
              coinsEarned: coins,
              currentHealth: health,
              killStealProgress: nextKillSteal,
            };
            roguelikeRunRef.current = nextSnap;
            setRoguelikeRun(nextSnap);
          };

          const beginBaddieDeath = (rt: RuntimeEntity, knockX: number, knockZ: number) => {
            if (!rt.alive || rt.aiState === 'dying') return;
            rt.aiState = 'dying';
            const dyingPreset = resolveMotionPresetForRuntime({
              slot: 'dying',
              actorCategory: 'enemy',
              project: activeProject,
              entity: rt.sourceEntity,
              monsterBp: rt.resolvedMonster,
            });
            rt.dyingDuration = dyingPreset
              ? Math.max(0.45, dyingPreset.duration)
              : rt.isBoss
              ? 1.45
              : 0.95;
            rt.stateTimer = rt.dyingDuration;
            rt.motionElapsed = 0;
            rt.deathFinalized = false;
            rt.vx = knockX * (rt.isBoss ? 5.2 : 10.2);
            rt.vz = knockZ * (rt.isBoss ? 5.2 : 10.2);
            rt.vy = rt.isBoss ? 1.1 : 3.4;
            rt.defeatSpin = rt.quadrupedRig ? 0 : (Math.random() > 0.5 ? 1 : -1) * 7.5;
            hitStopTimer = 0;
            shakeTimer = Math.max(shakeTimer, rt.isBoss ? 0.36 : 0.2);
            navMeshEngine?.removeAgent(rt.id);
            if (rapierPhysics?.isReady()) {
              rapierPhysics.applyRadialImpulse(
                rt.x,
                rt.mesh.position.y + 0.7,
                rt.z,
                4.5,
                rt.isBoss ? 18 : 11,
                0.55
              );
              if (!dyingPreset && !rt.isBoss && !rt.quadrupedRig) {
                rapierPhysics.launchTumbleBody(
                  rt.id,
                  rt.mesh,
                  knockX * 9.5,
                  5.8,
                  knockZ * 9.5,
                  0.52 * Math.max(0.6, Math.min(1.6, rt.entityScale || 1)),
                  rt.dyingDuration + 0.25
                );
                rapierTumblingIds.add(rt.id);
              }
            }

            if (rt.hpBar) {
              rt.hpBar.opacity = 0;
              rt.hpBar.mat.opacity = 0;
              rt.hpBar.group.visible = false;
              rt.hpBar.mesh.visible = false;
            }
            const deathY = Math.max(-0.5, sampleLevelHeight(activeLevel, rt.x, rt.z)) + rt.flightY;
            heroEffects.emitBossDeathBurst(
              rt.x,
              deathY,
              rt.z,
              rt.keyFillColor || '#EA580C',
              rt.keyBorderColor || '#FBBF24'
            );
            spawnCombatSparks(rt.x, deathY + 0.9, rt.z, '#FFD166', rt.isBoss ? 18 : 11, 8.0);
            coins += rt.isBoss ? 10 : 2;
            recordRoguelikeEnemyKill(rt);
            if (rt.pickupable && rt.pickupItemId) {
              const gy = sampleLevelHeight(activeLevel, rt.x, rt.z);
              spawnDroppedItem(
                rt.pickupItemId,
                rt.pickupQty,
                rt.x,
                gy + 0.5,
                rt.z,
                knockX * 2.5,
                4.6,
                knockZ * 2.5
              );
            }
            if (activeLevel.gameplayMode === 'rpg') {
              const dropRoll = Math.random();
              if (dropRoll < 0.5) {
                setRpgStats((prev) => ({ ...prev, herbs: prev.herbs + 1 }));
                spawnEvaporatingDamageNumber(
                  scene,
                  evaporatingDamages,
                  rt.x,
                  deathY + 1.85,
                  rt.z,
                  '+1 HERB',
                  '#34D399',
                  'LOOT DROP'
                );
              } else {
                setRpgStats((prev) => ({ ...prev, potions: prev.potions + 1 }));
                spawnEvaporatingDamageNumber(
                  scene,
                  evaporatingDamages,
                  rt.x,
                  deathY + 1.85,
                  rt.z,
                  '+1 POTION',
                  '#10B981',
                  'LOOT DROP'
                );
              }
            }
            if (rt.isBoss) {
              heroVictoryTimer = 2.8;
              bossVictoryBannerTimer = 4.2;
              AudioEngine.playSound('chime');
              AudioEngine.playSound('sparkle');
              if (
                activeLevel.gameplayMode === 'rpg' &&
                activeLevel.rpgConfig?.lootMode !== 'traditional'
              ) {
                if (activeLevel.rpgConfig?.lootMode === 'both') {
                  spawnBossRewardChest(rt);
                }
                window.setTimeout(() => {
                  openRpgCardModalRef.current(`Victory Tribute: ${rt.name}`);
                }, 650);
              } else {
                spawnBossRewardChest(rt);
              }
              setBossVictoryBanner({
                bossName: rt.name,
                coins: rt.baddieAI?.bossRewardCoins ?? 30,
              });
              showToast(`Victory! ${rt.name} defeated!`);
            } else {
              if (
                activeLevel.gameplayMode === 'rpg' &&
                activeLevel.rpgConfig?.lootMode === 'fannedCards'
              ) {
                window.setTimeout(() => {
                  openRpgCardModalRef.current(`Fallen Foe Spoils: ${rt.name}`);
                }, 450);
              }
              showToast(`Defeated ${rt.name}!`);
            }
          };

          const applyBaddieAttackEffectToHero = (
            actionDef: BaddieActionDef,
            kbDirX: number,
            kbDirZ: number,
            wasDeflected: boolean,
            effectDurationMult = 1,
            shieldBlocked = false
          ) => {
            if (wasDeflected && !shieldBlocked && actionDef.heroEffect !== 'knockdown') return;
            const eff = actionDef.heroEffect;
            if (eff === 'knockdown') {
              if (shieldBlocked) {
                heroRecoilTimer = Math.max(heroRecoilTimer, 0.14);
                showToast('Shield braced against the slam!');
                return;
              }
              heroKnockdownPhase = 'fall';
              heroKnockdownTimer = 0.28;
              isSitting = false;
              isClimbing = false;
              attackAnimTimer = 0;
              shieldGuardTimer = 0;
              const kbScale = heroSkillSet.has('ironResolve') ? 0.72 : 1;
              heroKnockVX = kbDirX * actionDef.knockbackForce * kbScale;
              heroKnockVZ = kbDirZ * actionDef.knockbackForce * kbScale;
              if (!isSwimming) {
                heroVelY = Math.max(heroVelY, 2.8);
              }
              heroEffects.emitKnockdownImpact(heroX, heroY, heroZ);
              showToast('Slammed off your feet!');
            } else if (eff === 'burn' || eff === 'freeze' || eff === 'shock' || eff === 'poison' || eff === 'soak') {
              const durScale = shieldBlocked ? effectDurationMult * 0.45 : effectDurationMult;
              heroStatusTimers[eff] = Math.max(
                heroStatusTimers[eff],
                actionDef.effectDurationSec * durScale
              );
              if (eff === 'burn') {
                showToast('Scorched! Flames & soot cling to you!');
              } else if (eff === 'freeze') {
                showToast('Frostbitten! Ice chills your speed & defense!');
              } else if (eff === 'shock') {
                showToast('Shocked! Soot & electric current surge through you!');
              } else if (eff === 'poison') {
                showToast('Venomed! Toxic mist weakens your guard!');
              } else if (eff === 'soak') {
                showToast('Soaked! Heavy spray slows your stride!');
              }
            }
          };

          if (pendingConsumeRef.current.length > 0) {
            for (const c of pendingConsumeRef.current) {
              health = Math.min(maxHealth, health + c.heal);
              stamina = Math.min(maxStamina, stamina + c.stamina);
              magic = Math.min(100, magic + c.magic);
              staminaExhausted = false;
            }
            pendingConsumeRef.current = [];
          }

          // Cancel fishing cleanly if hero swaps off the fishing pole
          if (fishingState.phase !== 'idle' && heldDefNow?.toolKind !== 'fishingPole') {
            cancelFishing();
          }

          // Driving ground + stunt ramp surface sampler (zero-GC)
          const sampleDriveSurface = (x: number, z: number) => {
            let y = sampleLevelHeight(activeLevel, x, z);
            let onRamp = false;
            let nearLip = false;
            for (const r of rampEntities) {
              const dx = x - r.x;
              const dz = z - r.z;
              const sy = Math.sin(r.yaw);
              const cy = Math.cos(r.yaw);
              const along = dx * sy + dz * cy;
              const perp = dx * cy - dz * sy;
              const hw = 2.4 * r.scale;
              const hl = 3.1 * r.scale;
              if (Math.abs(perp) <= hw && along >= -hl && along <= hl) {
                const t = (along + hl) / (2 * hl);
                const rampY = r.baseY + t * 1.6 * r.scale;
                if (rampY > y) {
                  y = rampY;
                  onRamp = true;
                  nearLip = along > hl - 0.65 * r.scale;
                }
              }
            }
            return { y, onRamp, nearLip };
          };

          // Movement & Vehicle Physics Branch
          let floorY = sampleLevelHeight(activeLevel, heroX, heroZ);
          let mag = 0;
          let isRunning = false;
          let moveX = 0;
          let moveZ = 0;

          if (isDriving && carRig) {
            const cfgNow = drivingCfgRef.current;
            const currentCustomKey = JSON.stringify(cfgNow.customVehicle ?? null);
            if (
              cfgNow.carId !== activeCarId ||
              cfgNow.driverId !== activeDriverId ||
              currentCustomKey !== activeCustomKey
            ) {
              scene.remove(carRig.group);
              disposeObject3D(carRig.group);
              activeCarId = cfgNow.carId;
              activeDriverId = cfgNow.driverId;
              activeCustomKey = currentCustomKey;
              carRig = buildCarModel(activeCarId, activeDriverId, cfgNow.customVehicle);
              applyVisualStyleToObject(carRig.group, style);
              scene.add(carRig.group);
              spawnCombatSparks(heroX, heroY + 1.0, heroZ, '#38BDF8', 12, 6.2);
              AudioEngine.playSound('chime');
              showToast(
                `Switched to ${getCarPreset(activeCarId).name} · ${getDriverType(activeDriverId).name}`
              );
            }

            const carDef = getCarPreset(cfgNow.carId);
            const physDef = getDrivingPhysics(cfgNow.physicsId);
            const drvDef = getDriverType(cfgNow.driverId);

            if (inp.carResetQueued) {
              inp.carResetQueued = false;
              heroX = respawnX;
              heroZ = respawnZ;
              heroYaw = respawnYaw;
              driveCamYaw = respawnYaw;
              steerVis = 0;
              carPitch = 0;
              carRoll = 0;
              heroY = sampleLevelHeight(activeLevel, heroX, heroZ) + 0.35;
              heroVelY = 0;
              carVelX = 0;
              carVelZ = 0;
              AudioEngine.playSound('whoosh');
              showToast('Car reset onto track');
            }

            let throttle = -inp.joyY;
            if (inp.keys.has('KeyW') || inp.keys.has('ArrowUp')) throttle += 1;
            if (inp.keys.has('KeyS') || inp.keys.has('ArrowDown')) throttle -= 1;
            throttle = THREE.MathUtils.clamp(throttle, -1, 1);

            let steer = -inp.joyX;
            if (inp.keys.has('KeyA') || inp.keys.has('ArrowLeft')) steer += 1;
            if (inp.keys.has('KeyD') || inp.keys.has('ArrowRight')) steer -= 1;
            steer = THREE.MathUtils.clamp(steer, -1, 1);

            const handbrake = inp.keys.has('Space');
            if (inp.jumpQueued) inp.jumpQueued = false;
            const wantsBoost =
              (inp.keys.has('ShiftLeft') || inp.keys.has('ShiftRight')) && carBoost > 4;
            if (wantsBoost) {
              carBoost = Math.max(0, carBoost - dt * 36);
            } else {
              carBoost = Math.min(100, carBoost + dt * 19 * drvDef.boostRechargeMult);
            }

            const fx = Math.sin(heroYaw);
            const fz = Math.cos(heroYaw);
            const rx = Math.cos(heroYaw);
            const rz = -Math.sin(heroYaw);

            let vFwd = carVelX * fx + carVelZ * fz;
            let vLat = carVelX * rx + carVelZ * rz;
            const boostMult = wantsBoost ? physDef.boostPower : 1.0;
            const maxFwd = physDef.maxSpeed * carDef.speedScale * drvDef.topSpeedMult * boostMult;

            const preSurf = sampleDriveSurface(heroX, heroZ);
            floorY = preSurf.y;
            const groundedCar = heroY <= floorY + 0.28;

            // Flight Bonus Cubes pickup (Mario Kart style soaring bonus)
            for (const fc of flightCubeEntities) {
              if (fc.respawnAt === 0 || gameElapsed >= fc.respawnAt) {
                if (fc.respawnAt > 0 && gameElapsed >= fc.respawnAt) {
                  fc.respawnAt = 0;
                  if (fc.mesh) fc.mesh.visible = true;
                }
                const d = Math.hypot(heroX - fc.x, heroZ - fc.z);
                if (d < 2.65 && Math.abs(heroY - fc.baseY) < 3.2) {
                  fc.respawnAt = gameElapsed + 14;
                  carFlightTimer = 9.5;
                  carBoost = 100;
                  heroVelY = Math.max(heroVelY, 8.5);
                  spawnCombatSparks(fc.x, fc.baseY, fc.z, '#38BDF8', 24, 8.5);
                  AudioEngine.playSound('sparkle');
                  AudioEngine.playSound('jump');
                  showToast('Flight Bonus Activated! Hold Space to soar across the chasms!');
                  if (fc.mesh) fc.mesh.visible = false;
                }
              }
            }

            // Neon Boost Pads surge
            for (const bp of boostPadEntities) {
              if (gameElapsed >= bp.cooldownUntil) {
                const d = Math.hypot(heroX - bp.x, heroZ - bp.z);
                if (d < 2.6 && groundedCar) {
                  bp.cooldownUntil = gameElapsed + 1.5;
                  vFwd = Math.max(vFwd + 13.5, physDef.maxSpeed * 1.35);
                  carBoost = Math.min(100, carBoost + 50);
                  spawnCombatSparks(heroX, heroY + 0.35, heroZ, '#0EA5E9', 16, 7.2);
                  AudioEngine.playSound('whoosh');
                }
              }
            }

            // Striped Road Barriers
            for (const rb of roadBarrierEntities) {
              if (gameElapsed >= rb.cooldownUntil) {
                const d = Math.hypot(heroX - rb.x, heroZ - rb.z);
                if (d < 1.85 && groundedCar && Math.abs(vFwd) > 3.8) {
                  rb.cooldownUntil = gameElapsed + 1.2;
                  vFwd *= -0.32;
                  shakeTimer = 0.22;
                  spawnCombatSparks(heroX, heroY + 0.5, heroZ, '#F97316', 14, 6.0);
                  AudioEngine.playSound('step');
                }
              }
            }

            const isFlying = carFlightTimer > 0 || carRig.hasPermanentWings;
            if (carFlightTimer > 0) {
              carFlightTimer = Math.max(0, carFlightTimer - dt);
            }
            carRig.wingLeft.visible = isFlying;
            carRig.wingRight.visible = isFlying;

            if (groundedCar) {
              if (throttle > 0.05) {
                const thrust = physDef.accel * throttle * (wantsBoost ? 1.55 : 1.0);
                vFwd += thrust * dt;
              } else if (throttle < -0.05) {
                if (vFwd > 1.2) {
                  vFwd -= physDef.brakeAccel * Math.abs(throttle) * dt;
                } else {
                  vFwd -= physDef.accel * 0.72 * Math.abs(throttle) * dt;
                }
              } else {
                vFwd = THREE.MathUtils.damp(vFwd, 0, 1.8, dt);
              }
              if (handbrake && Math.abs(vFwd) > 2.5) {
                vFwd = THREE.MathUtils.damp(vFwd, vFwd * 0.78, 3.2, dt);
              }
              vFwd = THREE.MathUtils.clamp(vFwd, -physDef.reverseSpeed, maxFwd);

              const steerAutority = Math.min(1, Math.abs(vFwd) / 3.4) * (vFwd >= -0.35 ? 1 : -1);
              heroYaw +=
                steer *
                physDef.turnSpeed *
                drvDef.driftControlMult *
                (handbrake ? 1.32 : 1.0) *
                steerAutority *
                dt;

              const inShallowWater = floorY < IslandTerrain.waterLevel + 0.12;
              const latGrip =
                (handbrake ? physDef.driftGrip : inShallowWater ? physDef.offroadGrip : physDef.normalGrip) *
                carDef.gripScale;
              vLat = THREE.MathUtils.damp(vLat, 0, latGrip, dt);
              if (inShallowWater && cfgNow.physicsId !== 'offroadCrawler') {
                vFwd *= 1 - Math.min(0.4, dt * 1.4);
              }

              const nfx = Math.sin(heroYaw);
              const nfz = Math.cos(heroYaw);
              const nrx = Math.cos(heroYaw);
              const nrz = -Math.sin(heroYaw);
              carVelX = nfx * vFwd + nrx * vLat;
              carVelZ = nfz * vFwd + nrz * vLat;
              carWasDrifting = handbrake && Math.hypot(vFwd, vLat) > 6.5;
            } else {
              if (isFlying) {
                // High-authority aerodynamic steering and flight gliding
                heroYaw += steer * 1.95 * dt;
                carWasDrifting = false;
                const wantsClimb = handbrake || throttle > 0;
                const targetSink = wantsClimb ? 1.4 : -1.8;
                heroVelY = THREE.MathUtils.damp(heroVelY, targetSink, 2.5, dt);
                if (wantsClimb && vFwd > 4) {
                  vFwd = THREE.MathUtils.damp(vFwd, maxFwd * 0.92, 1.2, dt);
                }
                if (Math.random() < 0.32) {
                  spawnCombatSparks(heroX, heroY + 0.35, heroZ, '#38BDF8', 2, 3.5);
                }
              } else {
                // Slight air steer control when jumping off stunt ramps
                heroYaw += steer * 0.85 * dt;
                carWasDrifting = false;
              }
            }

            const rawCarX = heroX + carVelX * dt;
            const rawCarZ = heroZ + carVelZ * dt;
            const [resCarX, resCarZ] = resolveHorizontalCollision(
              activeLevel,
              rawCarX,
              rawCarZ,
              1.15,
              true,
              collisionCtx
            );
            if (Math.hypot(resCarX - rawCarX, resCarZ - rawCarZ) > 0.08) {
              carVelX *= 0.6;
              carVelZ *= 0.6;
            }
            heroX = resCarX;
            heroZ = resCarZ;

            const postSurf = sampleDriveSurface(heroX, heroZ);
            floorY = postSurf.y;

            if (postSurf.onRamp && postSurf.nearLip && vFwd > 7.2 && heroVelY <= 1.2) {
              heroVelY = Math.max(heroVelY, vFwd * 0.44 * physDef.jumpMult);
              AudioEngine.playSound(activeLevel.audio.jump);
              spawnCombatSparks(heroX, floorY + 0.5, heroZ, '#FACC15', 10, 6.4);
            }

            if (heroY > floorY + 0.08 || heroVelY > 0) {
              if (!isFlying || groundedCar) {
                heroVelY -= 21 * dt;
              }
              heroY += heroVelY * dt;
              if (heroY <= floorY) {
                if (heroVelY < -6) {
                  shakeTimer = Math.max(shakeTimer, 0.14);
                  AudioEngine.playSound('step');
                }
                heroY = floorY;
                heroVelY = 0;
              }
            } else {
              heroY = floorY;
              heroVelY = 0;
            }

            if (heroY < IslandTerrain.waterLevel - 3.8) {
              heroX = respawnX;
              heroZ = respawnZ;
              heroYaw = respawnYaw;
              driveCamYaw = respawnYaw;
              steerVis = 0;
              carPitch = 0;
              carRoll = 0;
              heroY = sampleLevelHeight(activeLevel, heroX, heroZ) + 0.4;
              heroVelY = 0;
              carVelX = 0;
              carVelZ = 0;
              showToast('Car plunged into the chasm — reset to road!');
            }

            // Animate CarRig wheels, steering, suspension lean & drift/boost sparks
            steerVis = THREE.MathUtils.damp(steerVis, steer * 0.44, 14, dt);
            wheelSpin += (vFwd / Math.max(0.25, carDef.wheelRadius)) * dt;
            carRig.wheelFL.rotation.y = steerVis;
            carRig.wheelFR.rotation.y = steerVis;
            carRig.tireFL.rotation.x = wheelSpin;
            carRig.tireFR.rotation.x = wheelSpin;
            carRig.tireRL.rotation.x = wheelSpin;
            carRig.tireRR.rotation.x = wheelSpin;

            const hFront = sampleDriveSurface(heroX + Math.sin(heroYaw) * 1.15, heroZ + Math.cos(heroYaw) * 1.15).y;
            const hBack = sampleDriveSurface(heroX - Math.sin(heroYaw) * 1.15, heroZ - Math.cos(heroYaw) * 1.15).y;
            const hLeft = sampleDriveSurface(heroX + Math.cos(heroYaw) * 0.85, heroZ - Math.sin(heroYaw) * 0.85).y;
            const hRight = sampleDriveSurface(heroX - Math.cos(heroYaw) * 0.85, heroZ + Math.sin(heroYaw) * 0.85).y;
            const inAirSlopePitch = isFlying
              ? handbrake
                ? 0.22
                : throttle > 0
                ? -0.12
                : 0
              : THREE.MathUtils.clamp(-heroVelY * 0.04, -0.35, 0.35);
            const inAirSlopeRoll = isFlying ? -steer * 0.38 : 0;
            const slopePitch = groundedCar ? Math.atan2(hBack - hFront, 2.3) : inAirSlopePitch;
            const slopeRoll = groundedCar ? Math.atan2(hLeft - hRight, 1.7) : inAirSlopeRoll;
            const turnLean = groundedCar
              ? -steer * physDef.bodyRollFactor * 0.08 * THREE.MathUtils.clamp(vFwd / 18, -1, 1)
              : 0;

            carPitch = THREE.MathUtils.damp(carPitch, slopePitch, 11, dt);
            carRoll = THREE.MathUtils.damp(carRoll, slopeRoll + turnLean, 11, dt);

            carRig.group.position.set(heroX, heroY, heroZ);
            carRig.group.rotation.y = heroYaw;
            carRig.chassisPivot.rotation.x = carPitch;
            carRig.chassisPivot.rotation.z = carRoll;
            carRig.driverHead.rotation.y = steerVis * 0.55;
            carRig.brakeLights.emissiveIntensity = throttle < -0.1 || handbrake ? 2.5 : 0.45;
            carRig.shadowDisc.visible = heroY <= floorY + 2.5;

            if (wantsBoost || carWasDrifting) {
              carExhaustTimer += dt;
              if (carExhaustTimer > 0.07) {
                carExhaustTimer = 0;
                const exW = carRig.exhaustPos.getWorldPosition(_bubbleProjVec);
                spawnCombatSparks(
                  exW.x,
                  exW.y,
                  exW.z,
                  wantsBoost ? '#38BDF8' : '#E2E8F0',
                  wantsBoost ? 2 : 1,
                  wantsBoost ? 4.2 : 2.1
                );
              }
            }

            mag = Math.min(1, Math.hypot(carVelX, carVelZ) / 6);
            isRunning = wantsBoost;
            isSwimming = false;
            heroRoot.position.set(heroX, heroY, heroZ);
            heroRoot.rotation.y = heroYaw;
          } else {
          // Movement input
          moveX = inp.joyX;
          moveZ = inp.joyY;
          if (env !== 'sideScroller') {
            if (inp.keys.has('KeyW') || inp.keys.has('ArrowUp')) moveZ -= 1;
          }
          if (inp.keys.has('KeyS') || inp.keys.has('ArrowDown')) moveZ += 1;
          if (inp.keys.has('KeyA') || inp.keys.has('ArrowLeft')) moveX -= 1;
          if (inp.keys.has('KeyD') || inp.keys.has('ArrowRight')) moveX += 1;

          mag = Math.hypot(moveX, moveZ);
          if (mag > 0.22 && (fishingState.phase === 'waiting' || fishingState.phase === 'bite')) {
            cancelFishing('Reeled in the line.');
          }
          const fishingLocksMove =
            fishingState.phase === 'casting' || fishingState.phase === 'reeling';
          const cutawayLocksMove = cutawayHeroLockRef.current;
          const chestLocksMove = Boolean(openingChestId || chestOpeningLockRef.current);
          const knockdownLocksMove = heroKnockdownPhase !== 'none';
          const canWalk =
            (enabledSet.has('walk') || enabledSet.has('run')) &&
            !fishingLocksMove &&
            !cutawayLocksMove &&
            !chestLocksMove &&
            !knockdownLocksMove;
          if (cutawayLocksMove || chestLocksMove || knockdownLocksMove) {
            inp.jumpQueued = false;
            inp.attackQueued = false;
            inp.magicQueued = false;
            if (chestLocksMove) {
              inp.interactQueued = false;
              const openChestRt = openingChestId
                ? runtimeEntities.find((r) => r.id === openingChestId)
                : null;
              if (openChestRt) {
                const targetYaw = Math.atan2(openChestRt.x - heroX, openChestRt.z - heroZ);
                let diff = targetYaw - heroYaw;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                heroYaw += diff * Math.min(1, dt * 10);
              }
            }
          }
          const canSwim = env === 'openWorld' && activeLevel.canSwim !== false;

          // Stamina recovery threshold: once exhausted, must wait until >= 30 before running or hitting again
          if (staminaExhausted && stamina >= 30) {
            staminaExhausted = false;
          }

          const prevHeroX = heroX;
          const prevHeroZ = heroZ;
          const joyMag = Math.hypot(inp.joyX, inp.joyY);
          const isFirstPersonControl = camModeNow === 'firstPerson';
          const effectiveMoveMag = isFirstPersonControl ? Math.abs(moveZ) : mag;

          if (isSitting) {
            if (inp.jumpQueued || inp.attackQueued || effectiveMoveMag > 0.22) {
              standUpFromSit();
            }
          }

          const useHeld =
            inp.keys.has('KeyE') ||
            inp.keys.has('AltLeft') ||
            inp.keys.has('AltRight') ||
            inp.interactPointerDown;
          if (!useHeld && !inp.interactQueued) {
            interactConsumedLock = false;
          }
          const canRaiseShieldNow =
            !isDriving &&
            !isGliding &&
            !isSwimming &&
            !isSitting &&
            !isClimbing &&
            heroKnockdownPhase === 'none' &&
            attackAnimTimer <= 0 &&
            hasUsableShield;
          if (
            canRaiseShieldNow &&
            !hasNearbyInteractablePrev &&
            !interactConsumedLock &&
            heldDefNow?.toolKind !== 'fishingPole'
          ) {
            if (inp.interactQueued) {
              shieldGuardTimer = 0.85;
            } else if (useHeld) {
              shieldGuardTimer = Math.max(shieldGuardTimer, 0.2);
            }
          }
          isShieldBlockingNow = shieldGuardTimer > 0 && canRaiseShieldNow;
          const energySpeedMult = energy <= 0 ? 0.78 : 1;
          const wantsRun =
            (joyMag > 0.85 ||
              (useHeld &&
                !isShieldBlockingNow &&
                !isGliding &&
                !hasNearbyInteractablePrev &&
                effectiveMoveMag > 0.08)) &&
            enabledSet.has('run') &&
            !isSitting &&
            !isClimbing &&
            !isGliding &&
            energy > 0.5;
          isRunning = wantsRun && !staminaExhausted && stamina > 0.5 && effectiveMoveMag > 0.08;
          const shieldBraceSpeedMult = isShieldBlockingNow ? 0.72 : 1;
          const carrySpeedMult =
            worldInteract?.carriedRock?.kind === 'boulder'
              ? 0.72
              : worldInteract?.carriedRock?.kind === 'rock'
              ? 0.94
              : 1;
          const moveSpeed =
            (isSwimming
              ? isRunning
                ? 5.8
                : 3.9
              : isRunning
              ? 7.4 * (heroSkillSet.has('swiftFootwork') ? 1.14 : 1)
              : 3.6 * shieldBraceSpeedMult) *
            heroSpeedMult *
            energySpeedMult *
            carrySpeedMult;

          // Detect climbable surfaces (tagged entities, live trees, steep openWorld mountain cliffs)
          let climbCandidate: {
            kind: 'entity' | 'tree' | 'mountain';
            label: string;
            anchorX: number;
            anchorZ: number;
            maxY: number;
            dist: number;
            tree?: (typeof islandHandles.choppableTrees)[number];
          } | null = null;
          if (!isSitting && !isSwimming && canWalk && !worldInteract?.carriedRock) {
            for (const rt of runtimeEntities) {
              if (!rt.alive) continue;
              if (!getEntityAttrs(rt).includes('climbVertical')) continue;
              const d = Math.hypot(rt.x - heroX, rt.z - heroZ);
              const baseY = sampleLevelHeight(activeLevel, rt.x, rt.z) + (rt.elevationY ?? 0);
              const maxY = baseY + Math.max(2.6, (rt.entityScale ?? 1) * 2.8);
              if (d <= 1.45 && heroY >= baseY - 0.5 && heroY <= maxY + 0.35) {
                if (!climbCandidate || d < climbCandidate.dist) {
                  climbCandidate = {
                    kind: 'entity',
                    label: rt.name,
                    anchorX: rt.x,
                    anchorZ: rt.z,
                    maxY,
                    dist: d,
                  };
                }
              }
            }
            if (!climbCandidate) {
              for (const tr of islandHandles.choppableTrees) {
                if (tr.chopped) continue;
                const d = Math.hypot(tr.x - heroX, tr.z - heroZ);
                const trunkReach = Math.max(0.85, tr.size * 0.48) + 0.72;
                const crownY = tr.y + Math.max(2.6, tr.size * 2.8);
                if (d <= trunkReach && heroY >= tr.y - 0.4 && heroY <= crownY + 0.25) {
                  climbCandidate = {
                    kind: 'tree',
                    label: tr.hasFruit && (tr.fruitCount ?? 0) > 0 ? 'Fruit Tree' : 'Tree Trunk',
                    anchorX: tr.x,
                    anchorZ: tr.z,
                    maxY: crownY,
                    dist: d,
                    tree: tr,
                  };
                  break;
                }
              }
            }
            if (!climbCandidate && env === 'sideScroller' && sideCfgInit?.vines?.length) {
              for (const v of sideCfgInit.vines) {
                const vz = v.z ?? 0;
                const d = Math.hypot(v.x - heroX, vz - heroZ);
                if (d <= 1.35 && heroY >= v.bottomY - 0.5 && heroY <= v.topY + 0.45) {
                  if (!climbCandidate || d < climbCandidate.dist) {
                    climbCandidate = {
                      kind: 'entity',
                      label:
                        v.kind === 'ladder'
                          ? 'Ladder'
                          : v.kind === 'bubbleStream'
                          ? 'Bubble Stream'
                          : 'Jungle Vine',
                      anchorX: v.x,
                      anchorZ: vz,
                      maxY: v.topY,
                      dist: d,
                    };
                  }
                }
              }
            }
            if (!climbCandidate && env === 'openWorld') {
              const fwdX = Math.sin(heroYaw);
              const fwdZ = Math.cos(heroYaw);
              const curH = sampleLevelHeight(activeLevel, heroX, heroZ);
              const aheadH = sampleLevelHeight(activeLevel, heroX + fwdX * 0.9, heroZ + fwdZ * 0.9);
              const slope = (aheadH - curH) / 0.9;
              if (slope > 0.78 && Math.max(aheadH, curH) >= 2.6) {
                climbCandidate = {
                  kind: 'mountain',
                  label: 'Rockface',
                  anchorX: heroX + fwdX * 0.9,
                  anchorZ: heroZ + fwdZ * 0.9,
                  maxY: aheadH + 1.4,
                  dist: 0.75,
                };
              }
            }
          }

          const climbPromptKey = isClimbing
            ? `active:${climbKind}`
            : climbCandidate
            ? `near:${climbCandidate.label}`
            : '';
          if (climbPromptKey !== lastClimbPromptKey) {
            lastClimbPromptKey = climbPromptKey;
            if (isClimbing) {
              setClimbPrompt({
                label:
                  climbKind === 'tree'
                    ? 'Tree'
                    : climbKind === 'mountain'
                    ? 'Rockface'
                    : climbCandidate?.label || 'Climbable',
                active: true,
              });
            } else if (climbCandidate) {
              setClimbPrompt({ label: climbCandidate.label, active: false });
            } else {
              setClimbPrompt(null);
            }
          }

          const climbUpHeld =
            env === 'sideScroller'
              ? inp.keys.has('KeyW') || inp.keys.has('ArrowUp')
              : -moveZ > 0.22;
          if (!isClimbing && !isSitting && !isSwimming && canWalk && climbCandidate) {
            if (env === 'sideScroller' && climbUpHeld) {
              isClimbing = true;
              climbKind = climbCandidate.kind;
              climbingTree = climbCandidate.tree ?? null;
              climbAnchorX = climbCandidate.anchorX;
              climbAnchorZ = climbCandidate.anchorZ;
              climbMaxY = climbCandidate.maxY;
              heroVelY = 0;
              airborneTimer = 0;
              jumpsUsed = 0;
            } else {
              const dxC = climbCandidate.anchorX - heroX;
              const dzC = climbCandidate.anchorZ - heroZ;
              const lenC = Math.max(0.01, Math.hypot(dxC, dzC));
              const facingDot = (dxC / lenC) * Math.sin(heroYaw) + (dzC / lenC) * Math.cos(heroYaw);
              if ((climbUpHeld && facingDot > 0.35) || (heroVelY > 1.2 && facingDot > 0.2)) {
                isClimbing = true;
                climbKind = climbCandidate.kind;
                climbingTree = climbCandidate.tree ?? null;
                climbAnchorX = climbCandidate.anchorX;
                climbAnchorZ = climbCandidate.anchorZ;
                climbMaxY = climbCandidate.maxY;
                heroVelY = 0;
                airborneTimer = 0;
                jumpsUsed = 0;
              }
            }
          }

          const waterSurfaceY = IslandTerrain.waterLevel;
          let waterDepth = env === 'openWorld' ? waterSurfaceY - floorY : 0;
          if (isSitting) {
            heroX = sitTargetX;
            heroY = sitTargetY;
            heroZ = sitTargetZ;
            if (camModeNow === 'firstPerson') {
              const turnInput = THREE.MathUtils.clamp(moveX, -1, 1);
              if (Math.abs(turnInput) > 0.05) {
                inp.cameraYaw -= turnInput * 2.1 * dt;
              }
              heroYaw = Math.atan2(-Math.sin(inp.cameraYaw), -Math.cos(inp.cameraYaw));
            } else {
              heroYaw = sitFacingYaw;
            }
            heroVelY = 0;
            airborneTimer = 0;
            jumpsUsed = 0;
            isSwimming = false;
            isClimbingStairs = false;
            floorY = sampleLevelHeight(activeLevel, heroX, heroZ);
            energy = Math.min(100, energy + dt * 16);
            stamina = Math.min(maxStamina, stamina + dt * 32 * staminaRegenMult);
          } else if (isClimbing) {
            floorY =
              env === 'sideScroller'
                ? sampleSideScrollerSurfaceAtY(activeLevel, heroX, heroZ, heroY, true)
                : sampleLevelHeight(activeLevel, heroX, heroZ);
            const vertInput =
              env === 'sideScroller'
                ? (inp.keys.has('KeyW') || inp.keys.has('ArrowUp') ? 1 : 0) -
                  (inp.keys.has('KeyS') || inp.keys.has('ArrowDown') ? 1 : 0)
                : THREE.MathUtils.clamp(-moveZ, -1, 1);
            const sideInput = THREE.MathUtils.clamp(moveX, -1, 1);
            const climbSpeed = 3.8 * heroEnvEval.climbSpeedMult * energySpeedMult;

            if (climbKind === 'tree' || climbKind === 'entity') {
              heroYaw = Math.atan2(climbAnchorX - heroX, climbAnchorZ - heroZ);
              if (env === 'sideScroller') {
                heroX = THREE.MathUtils.damp(heroX, climbAnchorX, 10, dt);
              }
            }
            if (Math.abs(vertInput) > 0.1) {
              heroY += vertInput * climbSpeed * dt;
              climbPhase += Math.abs(vertInput) * dt * 8.5;
            }
            if (Math.abs(sideInput) > 0.1) {
              if (env === 'sideScroller') {
                heroX += sideInput * 2.2 * dt;
                if (Math.abs(heroX - climbAnchorX) > 1.25) {
                  isClimbing = false;
                }
              } else {
                const tanX = Math.cos(heroYaw);
                const tanZ = -Math.sin(heroYaw);
                const [sx, sz] = resolveHorizontalCollision(
                  activeLevel,
                  heroX + tanX * sideInput * 1.45 * dt,
                  heroZ + tanZ * sideInput * 1.45 * dt,
                  0.55,
                  false,
                  collisionCtx
                );
                heroX = sx;
                heroZ = sz;
              }
              climbPhase += Math.abs(sideInput) * dt * 5.0;
            }

            heroVelY = 0;
            airborneTimer = 0;
            jumpsUsed = 0;
            isSwimming = false;
            isClimbingStairs = false;
            stamina = Math.max(0, stamina - (Math.abs(vertInput) > 0.1 ? 6 : 1.5) * heroEnvEval.staminaDrainMult * dt);
            energy = Math.max(0, energy - 0.45 * dt);

            if (inp.jumpQueued) {
              inp.jumpQueued = false;
              inp.jumpPressQueuedCount = 0;
              isClimbing = false;
              airJumpPresses = 1;
              secondJumpHoldTime = 0;
              heroVelY = 8.8;
              heroKnockVX -= Math.sin(heroYaw) * 2.8;
              heroKnockVZ -= Math.cos(heroYaw) * 2.8;
              AudioEngine.playSound(activeLevel.audio.jump);
            } else if (vertInput < -0.1 && heroY <= floorY + 0.1) {
              isClimbing = false;
              heroY = floorY;
            } else if (
              climbKind === 'mountain' &&
              env === 'openWorld' &&
              vertInput > 0.1 &&
              heroY > floorY + 0.35 &&
              sampleLevelHeight(
                activeLevel,
                heroX + Math.sin(heroYaw) * 0.85,
                heroZ + Math.cos(heroYaw) * 0.85
              ) <=
                heroY + 0.28
            ) {
              // Cresting mountain top: step cleanly onto ledge
              heroX += Math.sin(heroYaw) * 0.72;
              heroZ += Math.cos(heroYaw) * 0.72;
              heroY = sampleLevelHeight(activeLevel, heroX, heroZ);
              isClimbing = false;
            } else if (vertInput > 0.1 && heroY >= climbMaxY) {
              heroX += Math.sin(heroYaw) * 0.55;
              heroZ += Math.cos(heroYaw) * 0.55;
              isClimbing = false;
              heroVelY = 2.4;
            } else if (climbKind === 'mountain') {
              const aheadSlopeH = sampleLevelHeight(
                activeLevel,
                heroX + Math.sin(heroYaw) * 0.9,
                heroZ + Math.cos(heroYaw) * 0.9
              );
              const curSlopeH = sampleLevelHeight(activeLevel, heroX, heroZ);
              if ((aheadSlopeH - curSlopeH) / 0.9 < 0.35 && heroY <= curSlopeH + 0.35) {
                isClimbing = false;
              }
            }
          } else {
          if (isGliding && canWalk) {
            collisionCtx.actorY = heroY;
            let glideTurnInput = 0;
            let glideAirSpeed = 7.2;

            if (isFirstPersonControl || camModeNow === 'front' || camModeNow === 'heroFront') {
              if (!draggingCam && camModeNow !== 'firstPerson') {
                const wrappedOffset = Math.atan2(
                  Math.sin(inp.lookYawOffset),
                  Math.cos(inp.lookYawOffset)
                );
                inp.lookYawOffset = THREE.MathUtils.damp(wrappedOffset, 0, 7.5, dt);
                inp.lookPitchOffset = THREE.MathUtils.damp(inp.lookPitchOffset, 0, 6.5, dt);
              }
              const steerX = THREE.MathUtils.clamp(moveX, -1, 1);
              if (camModeNow === 'firstPerson') {
                if (Math.abs(steerX) > 0.05) {
                  inp.cameraYaw -= steerX * 1.95 * dt;
                }
                heroYaw = Math.atan2(-Math.sin(inp.cameraYaw), -Math.cos(inp.cameraYaw));
                glideTurnInput = -steerX;
              } else if (camModeNow === 'heroFront') {
                heroYaw += steerX * 2.0 * dt;
                glideTurnInput = steerX;
              } else {
                heroYaw -= steerX * 2.0 * dt;
                glideTurnInput = -steerX;
              }
              if (moveZ > 0.25) {
                // Pulling back flares the sail for a gentle, precise landing
                glideAirSpeed = THREE.MathUtils.lerp(7.2, 2.6, Math.min(1, moveZ));
              } else if (moveZ < -0.15) {
                glideAirSpeed = THREE.MathUtils.lerp(7.2, 10.2, Math.min(1, -moveZ));
              }
            } else if (mag > 0.08) {
              const nx = moveX / Math.max(1, mag);
              const nz = moveZ / Math.max(1, mag);
              const activeYaw = camModeNow === 'sideScroll' ? 0 : inp.cameraYaw;
              const sinY = Math.sin(activeYaw);
              const cosY = Math.cos(activeYaw);
              const wishDX = nx * cosY + nz * sinY;
              const wishDZ = env === 'sideScroller' ? nz * 0.35 : -nx * sinY + nz * cosY;
              const wishYaw = Math.atan2(wishDX, wishDZ);
              const yawDiff = Math.atan2(Math.sin(wishYaw - heroYaw), Math.cos(wishYaw - heroYaw));
              const maxTurn = 4.2 * dt;
              const stepYaw = THREE.MathUtils.clamp(yawDiff, -maxTurn, maxTurn);
              heroYaw += stepYaw;
              glideTurnInput = THREE.MathUtils.clamp(yawDiff, -1, 1);
              glideAirSpeed = THREE.MathUtils.lerp(7.2, 10.2, Math.min(1, mag));
            }

            glideBankRoll = THREE.MathUtils.damp(glideBankRoll, glideTurnInput * 0.28, 7.5, dt);
            const glideDX = Math.sin(heroYaw);
            const glideDZ = Math.cos(heroYaw);
            const [resolvedX, resolvedZ] = resolveHorizontalCollision(
              activeLevel,
              heroX + glideDX * glideAirSpeed * heroSpeedMult * (heroSkillSet.has('acrobat') ? 1.18 : 1) * dt,
              heroZ + glideDZ * glideAirSpeed * heroSpeedMult * (heroSkillSet.has('acrobat') ? 1.18 : 1) * dt,
              0.62,
              canSwim,
              collisionCtx
            );
            heroX = resolvedX;
            heroZ = resolvedZ;
            stamina = Math.min(maxStamina, stamina + dt * 14 * staminaRegenMult);
          } else if (isFirstPersonControl && canWalk) {
            glideBankRoll = THREE.MathUtils.damp(glideBankRoll, 0, 10, dt);
            collisionCtx.actorY = heroY;
            // In Character POV: A/D & Left/Right rotate the character left/right (even when standing still);
            // W/S & Up/Down walk forward and backward along the facing direction.
            const turnInput = THREE.MathUtils.clamp(moveX, -1, 1);
            if (Math.abs(turnInput) > 0.05) {
              inp.cameraYaw -= turnInput * 2.35 * dt;
            }
            heroYaw = Math.atan2(-Math.sin(inp.cameraYaw), -Math.cos(inp.cameraYaw));

            const fwdAxis = -THREE.MathUtils.clamp(moveZ, -1, 1);
            if (Math.abs(fwdAxis) > 0.08) {
              const speedScale = fwdAxis < 0 ? fwdAxis * 0.72 : fwdAxis;
              const worldDX = -Math.sin(inp.cameraYaw) * speedScale;
              const worldDZ = -Math.cos(inp.cameraYaw) * speedScale;
              const rawNextX = heroX + worldDX * moveSpeed * dt;
              const rawNextZ = heroZ + worldDZ * moveSpeed * dt;
              const [resolvedX, resolvedZ] = resolveHorizontalCollision(
                activeLevel,
                rawNextX,
                rawNextZ,
                0.62,
                canSwim,
                collisionCtx
              );
              heroX = resolvedX;
              heroZ = resolvedZ;

              if (isRunning) {
                stamina = Math.max(
                  0,
                  stamina - dt * (isSwimming ? 14 : 24) * heroEnvEval.staminaDrainMult
                );
                if (stamina <= 0) {
                  stamina = 0;
                  staminaExhausted = true;
                  if (gameElapsed - lastStaminaToast > 1.8) {
                    lastStaminaToast = gameElapsed;
                    showToast('Out of stamina! Wait to recover.');
                  }
                }
              } else {
                stamina = Math.min(maxStamina, stamina + dt * 11 * staminaRegenMult);
              }

              stepTimer += dt;
              if (isSwimming) {
                if (stepTimer > (isRunning ? 0.36 : 0.5)) {
                  stepTimer = 0;
                  AudioEngine.playSound('splash');
                }
              } else if (heroVelY === 0 && stepTimer > (isRunning ? 0.28 : 0.44)) {
                stepTimer = 0;
                AudioEngine.playSound(activeLevel.audio.step);
              }
            } else {
              stamina = Math.min(maxStamina, stamina + dt * 26 * staminaRegenMult);
            }
          } else if (mag > 0.08 && canWalk) {
            glideBankRoll = THREE.MathUtils.damp(glideBankRoll, 0, 10, dt);
            collisionCtx.actorY = heroY;
            const nx = moveX / Math.max(1, mag);
            const nz = moveZ / Math.max(1, mag);
            let worldDX = 0;
            let worldDZ = 0;

            if (camModeNow === 'front' || camModeNow === 'heroFront') {
              // Auto-right camera smoothly into straight-ahead view whenever travelling (unless actively dragging)
              if (!draggingCam) {
                const wrappedOffset = Math.atan2(
                  Math.sin(inp.lookYawOffset),
                  Math.cos(inp.lookYawOffset)
                );
                inp.lookYawOffset = THREE.MathUtils.damp(wrappedOffset, 0, 8.5, dt);
                inp.lookPitchOffset = THREE.MathUtils.damp(inp.lookPitchOffset, 0, 7.0, dt);
              }

              // Hero always faces forward; steering left/right matches screen left/right
              const steerX = THREE.MathUtils.clamp(moveX, -1, 1);
              if (camModeNow === 'heroFront') {
                heroYaw += steerX * 2.35 * dt;
              } else {
                heroYaw -= steerX * 2.35 * dt;
              }

              const fwdX = Math.sin(heroYaw);
              const fwdZ = Math.cos(heroYaw);
              let fwdSpeedScale = 0;
              if (moveZ > 0.2) {
                // Pulling down backpedals gently while keeping character facing forward
                fwdSpeedScale = -0.58 * Math.min(1, moveZ);
              } else if (moveZ < -0.1) {
                // Forward push advances smoothly along facing vector (works seamlessly while steering)
                fwdSpeedScale = Math.min(1, -moveZ);
              } else if (camModeNow === 'heroFront') {
                // In heroFront, side steering also nudges forward smoothly
                fwdSpeedScale = Math.min(1, Math.abs(steerX) * 0.65);
              } else {
                // In Front view, pure Left/Right pivots hero & rotates the world in front of you without running sideways
                fwdSpeedScale = 0;
              }
              worldDX = fwdX * fwdSpeedScale;
              worldDZ = fwdZ * fwdSpeedScale;
            } else {
              const activeYaw = camModeNow === 'sideScroll' ? 0 : inp.cameraYaw;
              const sinY = Math.sin(activeYaw);
              const cosY = Math.cos(activeYaw);
              worldDX = nx * cosY + nz * sinY;
              worldDZ = env === 'sideScroller' ? nz * 0.45 : -nx * sinY + nz * cosY;
              heroYaw = Math.atan2(worldDX, worldDZ);
            }

            const rawNextX = heroX + worldDX * moveSpeed * dt;
            const rawNextZ = heroZ + worldDZ * moveSpeed * dt;
            const [resolvedX, resolvedZ] = resolveHorizontalCollision(
              activeLevel,
              rawNextX,
              rawNextZ,
              0.62,
              canSwim,
              collisionCtx
            );
            heroX = resolvedX;
            heroZ = resolvedZ;

            if (isRunning) {
              stamina = Math.max(
                0,
                stamina - dt * (isSwimming ? 14 : 24) * heroEnvEval.staminaDrainMult
              );
              if (stamina <= 0) {
                stamina = 0;
                staminaExhausted = true;
                if (gameElapsed - lastStaminaToast > 1.8) {
                  lastStaminaToast = gameElapsed;
                  showToast('Out of stamina! Wait to recover.');
                }
              }
            } else {
              // Walking or relaxed swimming slowly recovers stamina so player catches breath
              stamina = Math.min(maxStamina, stamina + dt * 11 * staminaRegenMult);
            }

            stepTimer += dt;
            if (isSwimming) {
              if (stepTimer > (isRunning ? 0.36 : 0.5)) {
                stepTimer = 0;
                AudioEngine.playSound('splash');
              }
            } else if (heroVelY === 0 && stepTimer > (isRunning ? 0.28 : 0.44)) {
              stepTimer = 0;
              AudioEngine.playSound(activeLevel.audio.step);
            }
          } else {
            glideBankRoll = THREE.MathUtils.damp(glideBankRoll, 0, 10, dt);
            stamina = Math.min(maxStamina, stamina + dt * 26 * staminaRegenMult);
          }

          // Apply physical knockback impulse on hero when bumped by an enemy attack
          if (Math.abs(heroKnockVX) > 0.04 || Math.abs(heroKnockVZ) > 0.04) {
            collisionCtx.actorY = heroY;
            const [kx, kz] = resolveHorizontalCollision(
              activeLevel,
              heroX + heroKnockVX * simDt,
              heroZ + heroKnockVZ * simDt,
              0.62,
              canSwim,
              collisionCtx
            );
            heroX = kx;
            heroZ = kz;
            heroKnockVX = THREE.MathUtils.damp(heroKnockVX, 0, 8.2, dt);
            heroKnockVZ = THREE.MathUtils.damp(heroKnockVZ, 0, 8.2, dt);
          } else {
            heroKnockVX = 0;
            heroKnockVZ = 0;
          }
          collisionCtx.actorY = undefined;

          // Walk-to-push distressed stone puzzle cubes (hero simply walks into a stone face — no Use button required!)
          if (worldInteract && !isDriving && !isSwimming && !isClimbing && !isSitting && !isGliding) {
            const isWalkingNow = effectiveMoveMag > 0.08;
            const pushIntentX = isWalkingNow && !worldInteract.carriedRock ? Math.sin(heroYaw) : 0;
            const pushIntentZ = isWalkingNow && !worldInteract.carriedRock ? Math.cos(heroYaw) : 0;
            const pushRes = worldInteract.updatePushableBlocks(
              simDt,
              heroX,
              heroY,
              heroZ,
              0.52,
              pushIntentX,
              pushIntentZ,
              {
                onRockHitEnemy: () => {},
                onRockImpactGround: () => {},
                onStoneScrape: () => {
                  AudioEngine.playSound('hit');
                },
                onPuzzleBlockSolved: (blk: PushableStoneBlock) => {
                  AudioEngine.playSound('chime');
                  AudioEngine.playSound(activeLevel.audio.door);
                  shakeTimer = Math.max(shakeTimer, 0.26);
                  if (blk.rewardKind === 'chest') {
                    const revealX = blk.startX;
                    const revealZ = blk.startZ;
                    spawnSecretPuzzleChest(revealX, revealZ);
                    showToast('Secret switch activated! A hidden Ancient Chest emerged!');
                  } else {
                    coins += 15;
                    showToast('Ancient stone aligned! Uncovered +15 hidden Gold!');
                  }
                },
              },
              collisionCtx
            );
            heroX = pushRes.x;
            heroZ = pushRes.z;
            if (pushRes.pushing) {
              heroYaw = pushRes.pushYaw;
            }
          }
          latestHeroYForAim = heroY;

          // Ground, modular building surfaces & platforms
          const sideDropThrough =
            env === 'sideScroller' && (inp.keys.has('KeyS') || inp.keys.has('ArrowDown'));
          floorY =
            env === 'sideScroller'
              ? sampleSideScrollerSurfaceAtY(activeLevel, heroX, heroZ, heroY, sideDropThrough)
              : sampleLevelHeight(activeLevel, heroX, heroZ);
          let nearStairSurface = false;
          for (const entData of activeLevel.entities) {
            if (entData.buildingBlock) {
              const [bx, bz] = levelBoardToWorld(activeLevel, entData.position);
              const baseY = sampleLevelHeight(activeLevel, bx, bz) + (entData.elevationY ?? 0);
              const surfY = sampleBuildingSurfaceY(
                entData,
                bx,
                bz,
                baseY,
                heroX,
                heroZ,
                heroY,
                openedDoorIds.has(entData.id)
              );
              if (surfY !== null) {
                floorY = Math.max(floorY, surfY);
                if (
                  entData.buildingBlock.shape === 'stairsStraight' ||
                  entData.buildingBlock.shape === 'stairsSpiral' ||
                  entData.interactionAttributes?.includes('climbStairs')
                ) {
                  nearStairSurface = true;
                }
              }
              continue;
            }
            if (
              entData.interactionAttributes?.includes('climbStairs') &&
              Math.hypot(
                levelBoardToWorld(activeLevel, entData.position)[0] - heroX,
                levelBoardToWorld(activeLevel, entData.position)[1] - heroZ
              ) < 3.4
            ) {
              nearStairSurface = true;
            }
            if (entData.kind !== 'platform') continue;
            const rt = runtimeEntities.find((r) => r.id === entData.id);
            if (!rt) continue;
            const [sx, sz] = levelBoardToWorld(activeLevel, entData.position);
            const sy =
              sampleLevelHeight(activeLevel, sx, sz) +
              PlatformMotion.hover(entData.platformPreset) +
              (entData.elevationY ?? 0);
            const endBp = entData.platformEnd ?? entData.position;
            const [ex, ez] = levelBoardToWorld(activeLevel, endBp);
            const ey =
              sampleLevelHeight(activeLevel, ex, ez) +
              PlatformMotion.hover(entData.platformPreset) +
              (entData.elevationY ?? 0);
            const pose = PlatformMotion.pose(
              gameElapsed,
              [sx, sy, sz],
              [ex, ey, ez],
              entData.platformSpeed,
              entData.platformWait,
              entData.platformMotion
            );
            rt.mesh.position.set(pose.position[0], pose.position[1], pose.position[2]);
            if (entData.platformMotion === 'spin') rt.mesh.rotation.y = pose.yaw;
            else if (entData.platformMotion === 'pendulum') rt.mesh.rotation.z = pose.swingAngle ?? 0;
            const half = PlatformMotion.halfExtent(entData.platformPreset) * (entData.scale || 1);
            if (Math.abs(heroX - pose.position[0]) < half && Math.abs(heroZ - pose.position[2]) < half) {
              const platTopY = pose.position[1] + 0.34;
              if (entData.platformPreset === 'sawWheel' && Math.abs(heroY - pose.position[1]) < 1.25 && hitInvuln <= 0) {
                health -= 1;
                hitInvuln = 1.0;
                shakeTimer = 0.25;
                heroVelY = 7.5;
                AudioEngine.playSound('hurt');
                if (health <= 0) triggerHeroDeath();
              } else if (entData.platformPreset === 'bouncePad' && heroY <= platTopY + 0.65 && heroY >= pose.position[1] - 0.45 && heroVelY <= 1.5) {
                heroVelY = 18.5;
                jumpsUsed = 0;
                airborneTimer = 0.1;
                AudioEngine.playSound('whoosh');
                spawnCombatSparks(pose.position[0], platTopY, pose.position[2], '#FBBF24', 10, 4.8);
              } else if (heroY >= platTopY - 0.85) {
                floorY = Math.max(floorY, platTopY);
              }
            }
          }

          isClimbingStairs =
            nearStairSurface &&
            effectiveMoveMag > 0.08 &&
            !isSwimming &&
            Math.abs(floorY - prevHeroFloorY) > 0.008;
          prevHeroFloorY = floorY;

          // Water detection & Auto-Swim state transitions (wide hysteresis prevents shore chatter)
          waterDepth = env === 'openWorld' ? waterSurfaceY - floorY : 0;
          if (canSwim) {
            if (!isSwimming) {
              if (
                swimReenterCooldown <= 0 &&
                waterDepth > 0.62 &&
                heroY <= waterSurfaceY - 0.45
              ) {
                isSwimming = true;
                swimExitCooldown = 0.22;
                heroVelY = 0;
                jumpsUsed = 0;
                AudioEngine.playSound('splash');
                if (!shownSwimTip) {
                  shownSwimTip = true;
                  showToast('Swimming! Space to jump out');
                }
              }
            } else if (swimExitCooldown <= 0 && waterDepth < 0.38) {
              isSwimming = false;
              swimReenterCooldown = 0.25;
              heroY = Math.max(heroY, floorY);
            }
          } else {
            isSwimming = false;
          }

          // Coyote time & jump buffering so jumping while running/swimming NEVER drops an input
          const grounded = !isSwimming && heroVelY <= 0.25 && heroY <= floorY + 0.14;
          const upJumpHeld =
            env === 'sideScroller' && !climbCandidate && !isClimbing && (inp.keys.has('KeyW') || inp.keys.has('ArrowUp'));
          const jumpHeld =
            inp.keys.has('Space') ||
            inp.keys.has('ShiftLeft') ||
            inp.keys.has('ShiftRight') ||
            upJumpHeld ||
            inp.jumpPointerDown;
          const freshJumpPresses = inp.jumpPressQueuedCount;
          inp.jumpPressQueuedCount = 0;

          if (grounded || isSwimming) {
            coyoteTimer = 0.14;
            jumpsUsed = 0;
            airJumpPresses = 0;
            secondJumpHoldTime = 0;
          } else {
            coyoteTimer = Math.max(0, coyoteTimer - dt);
          }

          if (freshJumpPresses > 0) {
            airJumpPresses += freshJumpPresses;
            if (airJumpPresses >= 2 && jumpHeld) {
              secondJumpHoldTime = Math.max(secondJumpHoldTime, 0.001);
            }
          }
          if (jumpHeld && airJumpPresses >= 2) {
            secondJumpHoldTime += dt;
          } else {
            secondJumpHoldTime = 0;
          }

          if (inp.jumpQueued) {
            inp.jumpQueued = false;
            jumpBufferTimer = 0.15;
          } else {
            jumpBufferTimer = Math.max(0, jumpBufferTimer - dt);
          }

          const isSideSwim = env === 'sideScroller' && Boolean(sideCfgInit?.swimPhysics);
          const maxJumps = enabledSet.has('doubleJump') ? 2 : enabledSet.has('jump') ? 1 : 0;
          if ((jumpBufferTimer > 0 || (isSideSwim && upJumpHeld)) && maxJumps > 0) {
            if (isSideSwim) {
              heroVelY = 7.4;
              jumpsUsed = 0;
              coyoteTimer = 0;
              jumpBufferTimer = 0;
              AudioEngine.playSound('splash');
              spawnCombatSparks(heroX, heroY + 0.8, heroZ, '#BAE6FD', 4, 2.2);
            } else if (isSwimming) {
              isSwimming = false;
              swimReenterCooldown = 0.36;
              heroVelY = 9.6 * heroEnvEval.jumpMult;
              jumpsUsed = 1;
              airJumpPresses = Math.max(1, airJumpPresses);
              coyoteTimer = 0;
              jumpBufferTimer = 0;
              AudioEngine.playSound(activeLevel.audio.jump);
              AudioEngine.playSound('splash');
            } else if (coyoteTimer > 0) {
              heroVelY = 10.6 * heroEnvEval.jumpMult;
              jumpsUsed = 1;
              airJumpPresses = Math.max(1, airJumpPresses);
              coyoteTimer = 0;
              jumpBufferTimer = 0;
              AudioEngine.playSound(activeLevel.audio.jump);
            } else if (jumpsUsed < maxJumps) {
              heroVelY = 10.0 * heroEnvEval.jumpMult;
              jumpsUsed++;
              airJumpPresses = Math.max(2, airJumpPresses);
              jumpBufferTimer = 0;
              AudioEngine.playSound(activeLevel.audio.jump);
            }
          }

          const hasParachuteBlanket = inventoryStacksRef.current.some(
            (s) => s.itemId === 'parachute_blanket' && s.qty > 0
          );
          const clearanceBelow =
            heroY -
            Math.max(
              floorY,
              env === 'openWorld' && waterDepth > 0.35 ? waterSurfaceY : floorY
            );
          const readyToOpenOnHold =
            airJumpPresses >= 2 &&
            clearanceBelow > 0.35 &&
            (secondJumpHoldTime >= 0.08 || (heroVelY < -2.2 && secondJumpHoldTime >= 0.02));

          if (!isSitting && !isClimbing && !isSwimming && canWalk && hasParachuteBlanket && jumpHeld) {
            if (!isGliding && readyToOpenOnHold) {
              isGliding = true;
              if (heroVelY < 0) {
                heroVelY = Math.max(heroVelY * 0.32, -1.1);
              } else {
                heroVelY = Math.min(heroVelY, 6.2);
              }
              AudioEngine.playSound('whoosh');
              spawnCombatSparks(heroX, heroY + 1.85, heroZ, '#E8F7FF', 8, 3.6);
            }
          } else {
            isGliding = false;
          }

          const movingNow =
            !isGliding &&
            (camModeNow === 'firstPerson' || camModeNow === 'front'
              ? Math.abs(moveZ) > 0.08
              : mag > 0.08) &&
            canWalk;
          const energyDrainRate = isGliding
            ? 0.08
            : isSwimming
            ? 0.32
            : isRunning
            ? 0.48
            : movingNow
            ? 0.2
            : 0.06;
          energy = Math.max(0, energy - energyDrainRate * dt);
          if (energy <= 0 && movingNow && gameElapsed - lastEnergyToast > 4.5) {
            lastEnergyToast = gameElapsed;
            showToast('Low Energy! Find a rock, log, stump, or chair and press Use to sit.');
          }
          } // end !isSitting && !isClimbing

          if (isSitting || isClimbing || isSwimming || isDriving) {
            isGliding = false;
          }

          const moving =
            !isSitting &&
            !isClimbing &&
            !isGliding &&
            (camModeNow === 'firstPerson' || camModeNow === 'front'
              ? Math.abs(moveZ) > 0.08
              : mag > 0.08) &&
            canWalk;
          const actualHorizSpeed =
            simDt > 0.0001 ? Math.hypot(heroX - prevHeroX, heroZ - prevHeroZ) / simDt : 0;
          const heroTotalScale = Math.max(0.45, activeProject.heroModelScale ?? 1);
          const nominalRefSpeed = (isRunning ? 7.4 : 3.6) * heroTotalScale;
          const locoVelocityRatio = moving
            ? THREE.MathUtils.clamp(actualHorizSpeed / Math.max(0.5, nominalRefSpeed), 0.35, 1.85)
            : 1;

          // Monotonically integrated animation phases (never jump phase when speed changes)
          if (isSwimming) {
            swimPhase += dt * (moving ? (isRunning ? 4.8 : 3.5) : 2.1);
            bobPhase += dt * (moving ? 2.4 : 1.7);
          } else if (moving) {
            walkPhase += dt * (isRunning ? 8.8 : 5.4) * locoVelocityRatio;
          }

          if (!isSitting && !isClimbing) {
          if (isSwimming) {
            const waveBob = Math.sin(bobPhase) * 0.032;
            const targetFloatY = Math.max(
              floorY + 0.04,
              waterSurfaceY - (moving ? 0.62 : 0.74) + waveBob
            );
            heroY = THREE.MathUtils.damp(heroY, targetFloatY, 7.5, dt);
            heroVelY = 0;
            airborneTimer = 0;
          } else if (isGliding) {
            if (heroVelY > -0.95) {
              heroVelY -= 4.8 * dt;
            } else {
              const isFlaring =
                (isFirstPersonControl || camModeNow === 'front' || camModeNow === 'heroFront') &&
                moveZ > 0.25;
              const targetSink = -1.15 + Math.sin(gameElapsed * 2.1) * 0.14 + (isFlaring ? 0.25 : 0);
              heroVelY = THREE.MathUtils.damp(heroVelY, targetSink, 6.2, dt);
            }
            heroY += heroVelY * dt;
            if (heroVelY <= 0 && heroY <= floorY + 0.14) {
              heroY = floorY;
              heroVelY = 0;
              jumpsUsed = 0;
              airborneTimer = 0;
              isGliding = false;
            } else {
              airborneTimer += dt;
            }
          } else {
            const wasGroundedOnSlope = jumpsUsed === 0 && heroVelY <= 0.1 && heroY <= floorY + 0.48;
            const gravAccel =
              env === 'sideScroller' && sideCfgInit?.swimPhysics
                ? 8.2 * (sideCfgInit.gravityScale ?? 0.48)
                : 19.5 * (env === 'sideScroller' ? sideCfgInit?.gravityScale ?? 1 : 1);
            heroVelY -= gravAccel * dt;
            if (env === 'sideScroller' && sideCfgInit?.swimPhysics) {
              heroVelY = Math.max(-4.2, heroVelY);
            }
            heroY += heroVelY * dt;
            // Follow mild downhill slopes smoothly while running so character never bounces into false jump glitches!
            if (heroVelY <= 0 && (heroY <= floorY || (wasGroundedOnSlope && heroY <= floorY + 0.42))) {
              heroY = floorY;
              heroVelY = 0;
              jumpsUsed = 0;
              airborneTimer = 0;
            } else {
              airborneTimer += dt;
            }
          }

          if (isSitting || isClimbing || isSwimming || isDriving) {
            isGliding = false;
            airJumpPresses = 0;
            secondJumpHoldTime = 0;
          }

          const hasBlanketInBag = inventoryStacksRef.current.some(
            (s) => s.itemId === 'parachute_blanket' && s.qty > 0
          );
          const promptClearance =
            heroY -
            Math.max(
              floorY,
              env === 'openWorld' && waterDepth > 0.35 ? waterSurfaceY : floorY
            );
          const nextGlidePromptKey: 'ready' | 'readySecond' | 'gliding' | '' = isGliding
            ? 'gliding'
            : !isSitting &&
              !isClimbing &&
              !isSwimming &&
              !isDriving &&
              canWalk &&
              hasBlanketInBag &&
              promptClearance >= 1.85
            ? airJumpPresses >= 1
              ? 'readySecond'
              : 'ready'
            : '';
          if (nextGlidePromptKey !== lastGlidePromptKey) {
            lastGlidePromptKey = nextGlidePromptKey;
            setGlidePrompt(nextGlidePromptKey || null);
          }

          // Secret Room Warps (SideScroller)
          if (secretRoomWarpCooldown > 0) secretRoomWarpCooldown = Math.max(0, secretRoomWarpCooldown - dt);
          heroInSecretRoom = false;
          if (env === 'sideScroller' && sideCfgInit?.secretRooms?.length) {
            for (const room of sideCfgInit.secretRooms) {
              const halfW = Math.max(4, (room.width || 12) * 0.65);
              if (Math.abs(heroX - room.roomCenterX) <= halfW && Math.abs(heroY - room.roomCenterY) <= 7.5) {
                heroInSecretRoom = true;
              }
              if (secretRoomWarpCooldown <= 0) {
                const distEnt = Math.hypot(heroX - room.entranceX, heroY - room.entranceY);
                if (distEnt < 1.35) {
                  secretRoomWarpCooldown = 1.4;
                  heroX = room.roomCenterX - (room.width || 12) * 0.2;
                  heroY = room.roomCenterY + 0.5;
                  heroZ = 0;
                  heroVelY = 0;
                  AudioEngine.playSound('sparkle');
                  AudioEngine.playSound('whoosh');
                  spawnCombatSparks(heroX, heroY + 0.8, 0, '#A855F7', 16, 5.2);
                  showToast(`Discovered Secret Room: ${room.name}!`);
                  break;
                }
                const exitX = room.roomCenterX - (room.width || 12) * 0.34;
                const distExit = Math.hypot(heroX - exitX, heroY - room.roomCenterY);
                if (heroInSecretRoom && distExit < 1.25) {
                  secretRoomWarpCooldown = 1.4;
                  heroX = room.entranceX + 1.8;
                  heroY = room.entranceY + 0.4;
                  heroZ = 0;
                  heroVelY = 0;
                  AudioEngine.playSound('whoosh');
                  spawnCombatSparks(heroX, heroY + 0.8, 0, '#38BDF8', 12, 4.5);
                  showToast('Returned to main level!');
                  break;
                }
              }
            }
          }

          // Water / Chasm respawn check when swimming is disabled or in sideScroller
          if (env === 'openWorld' && !canSwim && heroY < waterSurfaceY - 0.35) {
            heroX = respawnX;
            heroZ = respawnZ;
            heroY = sampleLevelHeight(activeLevel, heroX, heroZ) + 0.5;
            heroVelY = 0;
            showToast('Splashed into the sea!');
          } else if (env === 'sideScroller' && !heroInSecretRoom && heroY < -5.2) {
            heroX = respawnX;
            heroZ = respawnZ;
            heroY = Math.max(0.4, sampleLevelHeight(activeLevel, heroX, heroZ) + 0.5);
            heroVelY = 0;
            showToast(sideCfgInit?.layers.liquidType === 'lava' ? 'Fell into the lava!' : 'Fell off the platform!');
          }
          }

          // Water ripple ring when wading or swimming in openWorld water
          waterDepth = env === 'openWorld' ? waterSurfaceY - floorY : 0;
          const inAnyWater = env === 'openWorld' && waterDepth > 0.14 && heroY <= waterSurfaceY + 0.15;
          if (inAnyWater) {
            waterRipple.visible = true;
            swimRipplePhase = (swimRipplePhase + dt * (isSwimming && moving ? 1.45 : 0.85)) % 1;
            const rScale = 0.75 + swimRipplePhase * (isSwimming ? 1.55 : 0.9);
            waterRipple.position.set(heroX, waterSurfaceY + 0.04, heroZ);
            waterRipple.scale.setScalar(rScale);
            waterRippleMat.opacity = (1 - swimRipplePhase) * (isSwimming ? 0.62 : 0.36);
          } else {
            waterRipple.visible = false;
          }

          // Hero animation (Custom GLB AnimationMixer OR Native Procedural Rig)
          if (camModeNow === 'firstPerson') {
            heroYaw = Math.atan2(-Math.sin(inp.cameraYaw), -Math.cos(inp.cameraYaw));
          }
          liveHeroYawRef.current = heroYaw;
          heroRoot.position.set(heroX, heroY, heroZ);
          heroRoot.rotation.y = heroYaw;

          // Real-time 2-bone Foot-Planting IK, slope alignment, turn banking & breathing layer
          const ikGroundedNow =
            !isSwimming &&
            !isSitting &&
            !isClimbing &&
            !isGliding &&
            heroKnockdownPhase === 'none' &&
            heroY <= floorY + 0.16;
          if (wasAirborneForIK && ikGroundedNow) {
            heroFootIK.triggerImpact(0.65);
          }
          wasAirborneForIK = !ikGroundedNow && !isSwimming && !isSitting && !isClimbing;
          let yawDeltaForIK = heroYaw - prevHeroYawForIK;
          if (yawDeltaForIK > Math.PI) yawDeltaForIK -= Math.PI * 2;
          if (yawDeltaForIK < -Math.PI) yawDeltaForIK += Math.PI * 2;
          prevHeroYawForIK = heroYaw;
          const ikTurnRate = yawDeltaForIK / Math.max(0.008, dt);
          const ikHorizSpeed = moving ? Math.hypot(moveX, moveZ) * 6.5 : 0;
          const heroIKTargets = heroFootIK.evaluate({
            rootX: heroX,
            rootZ: heroZ,
            centerGroundY: floorY,
            facingYaw: heroYaw,
            horizSpeed: ikHorizSpeed,
            turnRate: ikTurnRate,
            grounded: ikGroundedNow,
            dt,
            elapsedTime: gameElapsed,
            impactImpulse: heroRecoilTimer > 0.2 ? 0.55 : 0,
            sampleGroundY: (sx, sz) => sampleLevelHeight(activeLevel, sx, sz),
          });

          const recoilWave = heroRecoilTimer > 0 ? Math.sin((heroRecoilTimer / 0.28) * Math.PI) : 0;
          const recoilTilt = recoilWave * 0.48 * heroHitPitchDir;
          const targetTiltX = isSwimming
            ? moving
              ? 0.92
              : 0.16
            : worldInteract?.isPushingStone
            ? 0.34
            : recoilTilt;
          swimTiltX = THREE.MathUtils.damp(swimTiltX, targetTiltX, isSwimming ? 7.5 : 16, dt);

          // Update stylized hero sword/axe slash arc ribbon during the active inward swing window
          if (attackAnimTimer > 0) {
            const p = 1 - attackAnimTimer / activeAttackDuration;
            if (p >= 0.26 && p <= 0.72) {
              const sp = (p - 0.26) / 0.46;
              heroSlashArc.visible = true;
              heroSlashArc.rotation.y = -2.55 + sp * 2.1;
              heroSlashArc.scale.setScalar(
                (activeAttackKind === 'axe' ? 1.04 : 0.88) + Math.sin(sp * Math.PI) * 0.24
              );
              heroSlashMat.color.set(activeAttackKind === 'axe' ? '#FFE2A8' : '#FFF2B8');
              heroSlashMat.opacity = Math.sin(sp * Math.PI) * 0.72;
            } else {
              heroSlashArc.visible = false;
            }
          } else {
            heroSlashArc.visible = false;
          }

          const activeHeroEquipment: HeroEquipmentHandles | null = heroRig ?? heroCustomEquipment;
          if (activeHeroEquipment) {
            syncHeroEquipmentVisuals(activeHeroEquipment, {
              heldDef: heldDefNow,
              offhandDef: activeOffhandDefNow,
              headDef: headDefNow,
              bodyDef: bodyDefNow,
              accDef: accDefNow,
              isSwimming,
              isAttacking: attackAnimTimer > 0,
              isFishingActive: fishingState.phase !== 'idle',
              isGliding,
              isBlocking: isShieldBlockingNow,
            });
          }

          if (heroCustom) {
            const isTrulyAirborne =
              !isSwimming &&
              !isSitting &&
              !isClimbing &&
              (jumpsUsed > 0 || (airborneTimer > 0.1 && heroY > floorY + 0.45));
            const heroLogicResolved = heroLogicAnimTimer > 0 && heroLogicAnimName
              ? resolveLogicPlayAnimationTarget({
                  detail: heroLogicAnimName,
                  actorCategory: 'hero',
                  project: activeProject,
                })
              : null;
            const customBlockPreset = isShieldBlockingNow
              ? resolveMotionPresetForRuntime({
                  slot: 'block',
                  actorCategory: 'hero',
                  project: activeProject,
                })
              : null;
            if (heroLogicResolved?.preset) {
              const dur = Math.max(0.1, heroLogicResolved.preset.duration);
              const tNorm = ((heroLogicAnimDuration - heroLogicAnimTimer) / dur) % 1;
              heroCustom.setTestOverride({
                kind: 'presetPreview',
                preset: heroLogicResolved.preset,
                timeNorm: tNorm,
                playing: false,
              });
              wasGlidingCustom = false;
              wasBlockingCustom = false;
            } else if (isGliding) {
              heroCustom.setTestOverride({
                kind: 'glide',
                sway: Math.sin(gameElapsed * 2.9),
                steerBank: glideBankRoll,
              });
              wasGlidingCustom = true;
              wasBlockingCustom = false;
            } else if (isShieldBlockingNow && !customBlockPreset) {
              heroCustom.setTestOverride({
                kind: 'block',
                speedNorm: moving ? locoVelocityRatio : 0,
              });
              wasBlockingCustom = true;
              wasGlidingCustom = false;
            } else {
              heroCustom.setTestOverride(null);
              wasGlidingCustom = false;
              wasBlockingCustom = false;
            }
            if (heroLogicResolved) heroCustom.setAction(heroLogicResolved.slot, 0.1);
            else if (heroKnockdownPhase !== 'none') {
              const kdSlot: CustomClipSlot = resolveMotionPresetForRuntime({
                slot: heroKnockdownPhase === 'getup' ? 'getUp' : 'knockdown',
                actorCategory: 'hero',
                project: activeProject,
              })
                ? heroKnockdownPhase === 'getup'
                  ? 'getUp'
                  : 'knockdown'
                : 'sit';
              heroCustom.setAction(kdSlot, 0.1);
            } else if (isSitting) heroCustom.setAction('sit', 0.12);
            else if (isClimbing) heroCustom.setAction('climbVertical', 0.12);
            else if (attackAnimTimer > 0)
              heroCustom.setAction(activeAttackKind === 'axe' ? 'swing' : 'attack', 0.08);
            else if (isShieldBlockingNow) heroCustom.setAction('block', 0.08);
            else if (heroRecoilTimer > 0) {
              const hurtPreset = resolveMotionPresetForRuntime({
                slot: 'hurt',
                actorCategory: 'hero',
                project: activeProject,
              });
              if (hurtPreset) heroCustom.setAction('hurt', 0.06);
              else heroCustom.setAction('idle', 0.12);
            } else if (heroVictoryTimer > 0) {
              const vicSlot: CustomClipSlot = resolveMotionPresetForRuntime({
                slot: 'celebrate',
                actorCategory: 'hero',
                project: activeProject,
              })
                ? 'celebrate'
                : 'interact';
              heroCustom.setAction(vicSlot, 0.12);
            } else if (inp.emoteTimer > 0) {
              const emSlot: CustomClipSlot =
                inp.emoteType === 'wave' || inp.emoteType === 'dance' ? inp.emoteType : 'interact';
              const hasEmote = resolveMotionPresetForRuntime({
                slot: emSlot,
                actorCategory: 'hero',
                project: activeProject,
              });
              heroCustom.setAction(hasEmote ? emSlot : 'interact', 0.12);
            } else if (isSwimming) heroCustom.setAction('swim', 0.14);
            else if (isTrulyAirborne) heroCustom.setAction('jump', 0.1);
            else if (isClimbingStairs) heroCustom.setAction('climbStairs', 0.14);
            else if (moving && isRunning) heroCustom.setAction('run', 0.16);
            else if (moving) heroCustom.setAction('walk', 0.16);
            else heroCustom.setAction('idle', 0.18);

            if (heroKnockdownPhase !== 'none' && heroCustom.group.children[0]) {
              const kdTilt =
                heroKnockdownPhase === 'fall'
                  ? -0.85
                  : heroKnockdownPhase === 'bounce'
                  ? -0.68
                  : heroKnockdownPhase === 'stun'
                  ? -0.58
                  : -0.25;
              heroCustom.group.children[0].rotation.x = kdTilt;
            } else if (!heroCustom.clips.swim && heroCustom.group.children[0]) {
              heroCustom.group.children[0].rotation.x = swimTiltX * 0.72;
            } else if (heroCustom.group.children[0]) {
              heroCustom.group.children[0].rotation.x = recoilTilt * 0.75;
            }

            const isLocomotingOnGround =
              moving && !isSwimming && !isTrulyAirborne && attackAnimTimer <= 0 && inp.emoteTimer <= 0;
            const climbActiveMove =
              isClimbing && (Math.abs(moveZ) > 0.12 || Math.abs(moveX) > 0.12);
            const spd =
              (activeProject.heroAnimSpeed ?? 1) *
              (isClimbing
                ? climbActiveMove
                  ? 1.0
                  : 0.05
                : isSwimming && !moving
                ? 0.65
                : isLocomotingOnGround
                ? locoVelocityRatio
                : 1);
            heroCustom.update(simDt, spd);
            // Apply subtle pelvis slope drop, landing squash, breathing & turn banking to custom GLB rigs
            if (heroKnockdownPhase === 'none' && !isSwimming && !isClimbing) {
              heroCustom.group.position.y =
                heroIKTargets.pelvisDropY + heroIKTargets.breathLift * 0.4;
              heroCustom.group.rotation.z =
                heroIKTargets.bankRollRad + heroIKTargets.slopeRollRad * 0.4;
              if (heroCustom.group.children[0]) {
                heroCustom.group.children[0].rotation.x += heroIKTargets.slopePitchRad * 0.45;
              }
            } else {
              heroCustom.group.position.y = 0;
              heroCustom.group.rotation.z = 0;
            }
          } else if (heroRig) {
            heroRig.shadowDisc.visible = !isSwimming && !isClimbing;
            const heldTool = heldDefNow?.toolKind ?? null;

            const dampJoint = (cur: number, target: number, lambda = 12) =>
              THREE.MathUtils.damp(cur, target, lambda, dt);

            let targetBodyY = 0;
            let targetBodyPitch = 0;
            let targetBodyYaw = 0;
            let targetBodyRoll = 0;
            let targetHeadX = isSwimming ? -swimTiltX * 0.7 : 0;
            let targetArmLX = 0;
            let targetArmLY = 0;
            let targetArmLZ = 0;
            let targetArmRX = 0;
            let targetArmRY = 0;
            let targetArmRZ = 0;
            let targetForearmLX = -0.18;
            let targetForearmLY = 0;
            let targetForearmRX = -0.18;
            let targetForearmRZ = 0;
            let targetLegLX = 0;
            let targetLegRX = 0;

            if (heroKnockdownPhase !== 'none') {
              if (heroKnockdownPhase === 'fall') {
                const p = Math.min(1, Math.max(0, 1 - heroKnockdownTimer / 0.28));
                targetBodyY = -0.40 * p;
                targetBodyPitch = -0.82 * p;
                targetLegLX = -1.24 * p;
                targetLegRX = -1.16 * p;
                targetArmLX = -1.35 * p;
                targetArmRX = -1.35 * p;
                targetArmLZ = 0.68 * p;
                targetArmRZ = -0.68 * p;
                targetHeadX = -0.22 * p;
              } else if (heroKnockdownPhase === 'bounce') {
                const p = Math.min(1, Math.max(0, 1 - heroKnockdownTimer / 0.22));
                const arc = Math.sin(p * Math.PI);
                targetBodyY = -0.44 + arc * 0.16;
                targetBodyPitch = -0.72 + arc * 0.18;
                targetLegLX = -1.28 + arc * 0.22;
                targetLegRX = -1.22 + arc * 0.22;
                targetArmLX = 0.35 - arc * 0.45;
                targetArmRX = 0.35 - arc * 0.45;
                targetArmLZ = 0.62;
                targetArmRZ = -0.62;
                targetHeadX = -0.15 + arc * 0.15;
              } else if (heroKnockdownPhase === 'stun') {
                const wobble = Math.sin(gameElapsed * 13);
                targetBodyY = -0.44;
                targetBodyPitch = -0.44 + Math.sin(gameElapsed * 6.5) * 0.08;
                targetBodyRoll = wobble * 0.09;
                targetLegLX = -1.26;
                targetLegRX = -1.20;
                targetArmLX = 0.42;
                targetArmRX = 0.42;
                targetArmLZ = 0.45;
                targetArmRZ = -0.45;
                targetForearmLX = -0.22;
                targetForearmRX = -0.22;
                targetHeadX = 0.20;
              } else {
                const p = Math.min(1, Math.max(0, 1 - heroKnockdownTimer / 0.42));
                const ease = p * p * (3 - 2 * p);
                targetBodyY = THREE.MathUtils.lerp(-0.44, 0, ease);
                targetBodyPitch = Math.sin(p * Math.PI) * 0.26;
                targetLegLX = THREE.MathUtils.lerp(-1.15, 0, ease);
                targetLegRX = THREE.MathUtils.lerp(-0.92, 0, ease);
                targetArmLX = THREE.MathUtils.lerp(0.32, 0, ease);
                targetArmRX = THREE.MathUtils.lerp(0.32, 0, ease);
                targetArmLZ = THREE.MathUtils.lerp(0.4, 0, ease);
                targetArmRZ = THREE.MathUtils.lerp(-0.4, 0, ease);
              }
            } else if (isSitting) {
              targetBodyY = -0.43;
              targetLegLX = -1.26;
              targetLegRX = -1.26;
              targetArmLX = -0.24;
              targetArmRX = -0.24;
              targetForearmLX = -0.36;
              targetForearmRX = -0.36;
            } else if (isClimbing) {
              const reach = Math.sin(climbPhase);
              targetArmLX = -2.05 + reach * 0.52;
              targetArmRX = -2.05 - reach * 0.52;
              targetForearmLX = -0.35;
              targetForearmRX = -0.35;
              targetLegLX = -0.58 - reach * 0.44;
              targetLegRX = -0.58 + reach * 0.44;
              targetHeadX = -0.24;
            } else if (isGliding) {
              const flutter = Math.sin(gameElapsed * 3.6);
              targetBodyY = 0.06 + flutter * 0.025;
              targetBodyRoll = glideBankRoll * 0.65;
              targetHeadX = -0.22;
              targetArmLX = -2.62 + flutter * 0.03;
              targetArmRX = -2.62 - flutter * 0.03;
              targetArmLZ = 0.58;
              targetArmRZ = -0.58;
              targetForearmLX = -0.22;
              targetForearmRX = -0.22;
              targetLegLX = 0.24 + Math.sin(gameElapsed * 2.9) * 0.14;
              targetLegRX = 0.34 - Math.sin(gameElapsed * 2.9) * 0.14;
            } else if (isSwimming) {
              if (attackAnimTimer > 0) {
                const p = 1 - attackAnimTimer / activeAttackDuration;
                if (p < 0.28) {
                  const t = p / 0.28;
                  targetArmRX = 0.2 * t;
                  targetArmRY = -0.68 * t;
                  targetArmRZ = -1.15 * t;
                  targetForearmRX = 0.82 * t;
                  targetArmLZ = 0.45;
                } else {
                  const s = Math.min(1, (p - 0.28) / 0.44);
                  targetArmRX = THREE.MathUtils.lerp(0.2, -0.95, s);
                  targetArmRY = THREE.MathUtils.lerp(-0.68, 1.05, s);
                  targetArmRZ = THREE.MathUtils.lerp(-1.15, -0.55, s);
                  targetForearmRX = THREE.MathUtils.lerp(0.82, -0.42, s);
                  targetArmLZ = 0.45;
                }
              } else if (moving) {
                // Smooth synchronized breaststroke glide — calm, readable, zero rapid vibration
                const pull = Math.sin(swimPhase);
                const reach = Math.cos(swimPhase);
                targetArmLX = -1.62 + reach * 0.52;
                targetArmRX = -1.62 + reach * 0.52;
                targetArmLZ = 0.5 + pull * 0.42;
                targetArmRZ = -(0.5 + pull * 0.42);
                targetLegLX = 0.22 + pull * 0.22;
                targetLegRX = 0.22 - pull * 0.22;
                targetBodyRoll = 0;
              } else {
                // Calm water treading
                const tread = Math.sin(swimPhase);
                targetArmLX = -0.35;
                targetArmRX = -0.35;
                targetArmLZ = 0.52 + tread * 0.22;
                targetArmRZ = -(0.52 + tread * 0.22);
                targetLegLX = tread * 0.2;
                targetLegRX = -tread * 0.2;
              }
            } else {
              const strideMult = isClimbingStairs ? 1.35 : 1;
              const stride = moving ? Math.sin(walkPhase) * 0.62 * strideMult : 0;
              if (isClimbingStairs) {
                targetBodyY = Math.abs(Math.sin(walkPhase)) * 0.06;
              }
              targetLegLX = stride;
              targetLegRX = -stride;
              targetArmLX = -stride * 0.68;
              targetForearmLX = -0.18 - Math.max(0, stride) * 0.28;

              if (fishingState.phase !== 'idle') {
                // Expressive fishing pole animation: backswing -> whip cast -> gentle hold -> bite tug -> reel whip!
                if (fishingState.phase === 'casting' || fishingState.phase === 'dryWhip') {
                  const dur = fishingState.phase === 'casting' ? 0.54 : 0.38;
                  const p = Math.min(1, fishingState.timer / dur);
                  if (p < 0.36) {
                    const t = p / 0.36;
                    targetArmRX = THREE.MathUtils.lerp(-0.4, -2.28, t);
                    targetArmRZ = -0.22 * t;
                    targetForearmRX = -0.45 * t;
                    targetBodyYaw = -0.36 * t;
                    targetArmLX = -0.45 * t;
                  } else {
                    const t = (p - 0.36) / 0.64;
                    const ease = 1 - Math.pow(1 - t, 3);
                    targetArmRX = THREE.MathUtils.lerp(-2.28, -0.52, ease);
                    targetArmRZ = THREE.MathUtils.lerp(-0.22, 0.1, ease);
                    targetForearmRX = THREE.MathUtils.lerp(-0.45, -0.15, ease);
                    targetBodyYaw = THREE.MathUtils.lerp(-0.36, 0.24, ease);
                    targetArmLX = THREE.MathUtils.lerp(-0.45, 0.15, ease);
                  }
                } else if (fishingState.phase === 'waiting') {
                  targetArmRX = -0.68 + Math.sin(gameElapsed * 2.1) * 0.05;
                  targetArmRZ = 0.06;
                  targetForearmRX = -0.22;
                  targetArmLX = -0.36;
                  targetArmLZ = -0.22;
                  targetBodyYaw = 0.12;
                } else if (fishingState.phase === 'bite') {
                  const tug = Math.sin(gameElapsed * 26);
                  targetArmRX = -0.32 + tug * 0.18;
                  targetArmRZ = 0.1 + tug * 0.08;
                  targetForearmRX = -0.35 + tug * 0.14;
                  targetArmLX = -0.52;
                  targetBodyYaw = 0.18 + tug * 0.06;
                } else if (fishingState.phase === 'reeling') {
                  const p = Math.min(1, fishingState.timer / 0.78);
                  const whip = Math.sin(Math.min(1, p * 1.4) * Math.PI * 0.5);
                  targetArmRX = THREE.MathUtils.lerp(-0.35, -1.92, whip);
                  targetArmRZ = -0.32 * whip;
                  targetForearmRX = -0.48 * whip;
                  targetArmLX = -0.95 * whip;
                  targetBodyYaw = -0.38 * whip;
                  targetHeadX = -0.18 * whip;
                }
              } else if (attackAnimTimer > 0 && activeAttackKind === 'axe') {
                // Forehand woodchopping swing: wind back outward to the right with elbow bent back -> swing inward -> recover
                const p = 1 - attackAnimTimer / activeAttackDuration;
                if (p < 0.30) {
                  const t = Math.sin((p / 0.30) * Math.PI * 0.5);
                  targetArmRX = 0.30 * t;
                  targetArmRY = -0.78 * t;
                  targetArmRZ = -1.28 * t;
                  targetForearmRX = THREE.MathUtils.lerp(-0.18, 0.98, t);
                  targetForearmRZ = -0.44 * t;
                  targetArmLX = -0.48 * t;
                  targetArmLZ = 0.36 * t;
                  targetBodyYaw = -0.52 * t;
                  targetBodyRoll = 0.14 * t;
                } else if (p < 0.68) {
                  const t = (p - 0.30) / 0.38;
                  const ease = 1 - Math.pow(1 - t, 3);
                  targetArmRX = THREE.MathUtils.lerp(0.30, -0.98, ease);
                  targetArmRY = THREE.MathUtils.lerp(-0.78, 1.18, ease);
                  targetArmRZ = THREE.MathUtils.lerp(-1.28, -0.60, ease);
                  targetForearmRX =
                    t < 0.45
                      ? THREE.MathUtils.lerp(0.98, -0.22, t / 0.45)
                      : THREE.MathUtils.lerp(-0.22, -0.62, (t - 0.45) / 0.55);
                  targetForearmRZ = THREE.MathUtils.lerp(-0.44, 0.34, ease);
                  targetArmLX = THREE.MathUtils.lerp(-0.48, 0.32, ease);
                  targetArmLZ = THREE.MathUtils.lerp(0.36, 0.18, ease);
                  targetBodyYaw = THREE.MathUtils.lerp(-0.52, 0.58, ease);
                  targetBodyRoll = THREE.MathUtils.lerp(0.14, -0.14, ease);
                } else {
                  const t = (p - 0.68) / 0.32;
                  const ease = t * t * (3 - 2 * t);
                  targetArmRX = THREE.MathUtils.lerp(-0.98, stride * 0.68, ease);
                  targetArmRY = THREE.MathUtils.lerp(1.18, 0, ease);
                  targetArmRZ = THREE.MathUtils.lerp(-0.60, 0, ease);
                  targetForearmRX = THREE.MathUtils.lerp(-0.62, -0.18, ease);
                  targetForearmRZ = THREE.MathUtils.lerp(0.34, 0, ease);
                  targetArmLX = THREE.MathUtils.lerp(0.32, -stride * 0.68, ease);
                  targetArmLZ = THREE.MathUtils.lerp(0.18, 0, ease);
                  targetBodyYaw = THREE.MathUtils.lerp(0.58, 0, ease);
                  targetBodyRoll = THREE.MathUtils.lerp(-0.14, 0, ease);
                }
              } else if (attackAnimTimer > 0) {
                // Forehand sword slash: wind back outward to the right with elbow bent back -> swing inward -> recover
                const p = 1 - attackAnimTimer / activeAttackDuration;
                if (p < 0.28) {
                  const t = Math.sin((p / 0.28) * Math.PI * 0.5);
                  targetArmRX = 0.24 * t;
                  targetArmRY = -0.72 * t;
                  targetArmRZ = -1.22 * t;
                  targetForearmRX = THREE.MathUtils.lerp(-0.18, 0.92, t);
                  targetForearmRZ = -0.38 * t;
                  targetBodyYaw = -0.44 * t;
                  targetBodyRoll = 0.10 * t;
                  targetArmLX = -0.25 * t;
                  targetArmLZ = 0.24 * t;
                } else if (p < 0.66) {
                  const t = (p - 0.28) / 0.38;
                  const ease = 1 - Math.pow(1 - t, 3);
                  targetArmRX = THREE.MathUtils.lerp(0.24, -1.04, ease);
                  targetArmRY = THREE.MathUtils.lerp(-0.72, 1.22, ease);
                  targetArmRZ = THREE.MathUtils.lerp(-1.22, -0.56, ease);
                  targetForearmRX =
                    t < 0.45
                      ? THREE.MathUtils.lerp(0.92, -0.24, t / 0.45)
                      : THREE.MathUtils.lerp(-0.24, -0.64, (t - 0.45) / 0.55);
                  targetForearmRZ = THREE.MathUtils.lerp(-0.38, 0.32, ease);
                  targetBodyYaw = THREE.MathUtils.lerp(-0.44, 0.54, ease);
                  targetBodyRoll = THREE.MathUtils.lerp(0.10, -0.10, ease);
                  targetArmLX = THREE.MathUtils.lerp(-0.25, 0.26, ease);
                  targetArmLZ = THREE.MathUtils.lerp(0.24, 0.14, ease);
                } else {
                  const t = (p - 0.66) / 0.34;
                  const ease = t * t * (3 - 2 * t);
                  targetArmRX = THREE.MathUtils.lerp(-1.04, stride * 0.68, ease);
                  targetArmRY = THREE.MathUtils.lerp(1.22, 0, ease);
                  targetArmRZ = THREE.MathUtils.lerp(-0.56, 0, ease);
                  targetForearmRX = THREE.MathUtils.lerp(-0.64, -0.18, ease);
                  targetForearmRZ = THREE.MathUtils.lerp(0.32, 0, ease);
                  targetBodyYaw = THREE.MathUtils.lerp(0.54, 0, ease);
                  targetBodyRoll = THREE.MathUtils.lerp(-0.10, 0, ease);
                  targetArmLX = THREE.MathUtils.lerp(0.26, -stride * 0.68, ease);
                  targetArmLZ = THREE.MathUtils.lerp(0.14, 0, ease);
                }
              } else if (isShieldBlockingNow) {
                targetArmLX = -0.62;
                targetArmLY = -0.68;
                targetArmLZ = -0.24;
                targetForearmLX = -1.05;
                targetForearmLY = 0;
                targetBodyYaw = 0.22;
                if (!moving && heldDefNow) {
                  targetArmRX = -0.42;
                  targetForearmRX = -0.35;
                }
              } else if (heroVictoryTimer > 0 && !moving) {
                const pump = Math.sin(gameElapsed * 9.5);
                targetBodyY = Math.abs(Math.sin(gameElapsed * 5.2)) * 0.08;
                targetArmRX = -2.55 + pump * 0.16;
                targetArmRZ = -0.32;
                targetForearmRX = -0.25;
                targetArmLX = -2.18 - pump * 0.14;
                targetArmLZ = 0.45;
                targetHeadX = -0.2;
              } else if (heroRecoilTimer > 0) {
                const stagger = Math.sin((heroRecoilTimer / 0.28) * Math.PI);
                targetBodyRoll = heroHitRollDir * stagger * 0.46;
                targetBodyYaw = heroHitRollDir * stagger * 0.35;
                targetArmLX = -0.55 - heroHitPitchDir * 0.22;
                targetArmRX = -0.55 - heroHitPitchDir * 0.22;
                targetArmLZ = 0.48;
                targetArmRZ = -0.48;
              } else if (worldInteract?.isPushingStone) {
                // Grounded two-handed pushing brace against the distressed stone cube
                targetArmLX = -1.42;
                targetArmRX = -1.42;
                targetForearmLX = -0.22;
                targetForearmRX = -0.22;
                targetArmLZ = 0.12;
                targetArmRZ = -0.12;
                targetHeadX = 0.14;
              } else if (worldInteract?.carriedRock?.kind === 'boulder') {
                // Heavy two-handed overhead boulder carry!
                targetArmLX = -2.68;
                targetArmRX = -2.68;
                targetArmLZ = 0.24;
                targetArmRZ = -0.24;
                targetForearmLX = -0.42;
                targetForearmRX = -0.42;
                targetHeadX = 0.08;
              } else if (worldInteract?.carriedRock?.kind === 'rock') {
                // One-handed organic stone poised in right hand to throw
                targetArmRX = -1.16 + stride * 0.15;
                targetArmRZ = -0.16;
                targetForearmRX = -0.58;
              } else if (inp.emoteType === 'wave') {
                targetArmRZ = -2.4 - Math.sin(gameElapsed * 12) * 0.4;
                targetArmRX = 0;
              } else if (inp.emoteType === 'dance') {
                heroRig.group.position.y += Math.abs(Math.sin(gameElapsed * 8)) * 0.25;
                targetArmLZ = 1.2 - Math.sin(gameElapsed * 8) * 0.5;
                targetArmRZ = -1.2 + Math.sin(gameElapsed * 8) * 0.5;
              } else if (heldTool === 'fishingPole') {
                targetArmRX = -0.58 + stride * 0.25;
              } else if (heldTool === 'torch') {
                targetArmRX = -1.05 + stride * 0.18;
              } else {
                targetArmRX = stride * 0.68;
                targetForearmRX = -0.18 - Math.max(0, -stride) * 0.28;
              }
            }

            const ikPelvisOffset = ikGroundedNow
              ? heroIKTargets.pelvisDropY + heroIKTargets.breathLift * 0.5
              : 0;
            const ikBodyPitch = ikGroundedNow ? heroIKTargets.slopePitchRad * 0.42 : 0;
            const ikBodyRoll = ikGroundedNow
              ? heroIKTargets.bankRollRad + heroIKTargets.slopeRollRad * 0.35
              : 0;
            const ikSpinePitch = ikGroundedNow
              ? heroIKTargets.slopePitchRad * 0.32 + heroIKTargets.impactSquash * 0.12
              : 0;

            heroRig.bodyPivot.position.y = dampJoint(
              heroRig.bodyPivot.position.y,
              0.85 + targetBodyY + ikPelvisOffset,
              14
            );
            const desiredBodyPitch =
              (heroKnockdownPhase !== 'none'
                ? targetBodyPitch
                : isSitting
                ? -0.05
                : isClimbing
                ? -0.1
                : isGliding
                ? 0.14
                : swimTiltX) + ikBodyPitch;
            heroRig.bodyPivot.rotation.x = dampJoint(heroRig.bodyPivot.rotation.x, desiredBodyPitch, 16);
            heroRig.bodyPivot.rotation.y = dampJoint(heroRig.bodyPivot.rotation.y, targetBodyYaw, 18);
            heroRig.bodyPivot.rotation.z = dampJoint(
              heroRig.bodyPivot.rotation.z,
              targetBodyRoll + ikBodyRoll,
              10
            );
            heroRig.head.rotation.x = dampJoint(heroRig.head.rotation.x, targetHeadX, 10);
            const armLambda = attackAnimTimer > 0 ? 30 : isShieldBlockingNow ? 22 : 13;
            heroRig.armL.rotation.x = dampJoint(heroRig.armL.rotation.x, targetArmLX, armLambda);
            heroRig.armL.rotation.y = dampJoint(heroRig.armL.rotation.y, targetArmLY, armLambda);
            heroRig.armL.rotation.z = dampJoint(heroRig.armL.rotation.z, targetArmLZ, armLambda);
            heroRig.armR.rotation.x = dampJoint(heroRig.armR.rotation.x, targetArmRX, armLambda);
            heroRig.armR.rotation.y = dampJoint(heroRig.armR.rotation.y, targetArmRY, armLambda);
            heroRig.armR.rotation.z = dampJoint(heroRig.armR.rotation.z, targetArmRZ, armLambda);
            if (heroRig.forearmL) {
              heroRig.forearmL.rotation.x = dampJoint(heroRig.forearmL.rotation.x, targetForearmLX, armLambda);
              heroRig.forearmL.rotation.y = dampJoint(heroRig.forearmL.rotation.y, targetForearmLY, armLambda);
            }
            if (heroRig.forearmR) {
              heroRig.forearmR.rotation.x = dampJoint(heroRig.forearmR.rotation.x, targetForearmRX, armLambda);
              heroRig.forearmR.rotation.z = dampJoint(heroRig.forearmR.rotation.z, targetForearmRZ, armLambda);
            }
            const ikLegLFlex = ikGroundedNow ? heroIKTargets.leftHipFlexRad : 0;
            const ikLegRFlex = ikGroundedNow ? heroIKTargets.rightHipFlexRad : 0;
            heroRig.legL.rotation.x = dampJoint(heroRig.legL.rotation.x, targetLegLX - ikLegLFlex, 13);
            heroRig.legR.rotation.x = dampJoint(heroRig.legR.rotation.x, targetLegRX - ikLegRFlex, 13);
            if (heroRig.spinePivot) {
              heroRig.spinePivot.rotation.x = dampJoint(
                heroRig.spinePivot.rotation.x,
                ikSpinePitch,
                14
              );
              heroRig.spinePivot.rotation.y = dampJoint(heroRig.spinePivot.rotation.y, 0, 14);
              heroRig.spinePivot.rotation.z = dampJoint(heroRig.spinePivot.rotation.z, 0, 14);
            }
            // Keep hip sockets strictly anchored to their pelvis rest Y (zero float/detachment)
            heroFootIK.applyToProceduralHero(heroIKTargets, {
              leftLeg: heroRig.legL,
              rightLeg: heroRig.legR,
              legLength: 0.72,
            });

            // Universal Motion Studio preset overlay for Built-in Hero
            const isHeroAirborne =
              !isSwimming &&
              !isSitting &&
              !isClimbing &&
              (jumpsUsed > 0 || (airborneTimer > 0.1 && heroY > floorY + 0.45));
            const heroLogicTarget =
              heroLogicAnimTimer > 0 && heroLogicAnimName
                ? resolveLogicPlayAnimationTarget({
                    detail: heroLogicAnimName,
                    actorCategory: 'hero',
                    project: activeProject,
                  })
                : null;
            const desiredHeroSlot: CustomClipSlot = heroLogicTarget
              ? heroLogicTarget.slot
              : heroKnockdownPhase === 'getup'
              ? 'getUp'
              : heroKnockdownPhase !== 'none'
              ? 'knockdown'
              : isSitting
              ? 'sit'
              : isClimbing
              ? 'climbVertical'
              : attackAnimTimer > 0
              ? activeAttackKind === 'axe'
                ? 'swing'
                : 'attack'
              : isShieldBlockingNow
              ? 'block'
              : heroRecoilTimer > 0
              ? 'hurt'
              : heroVictoryTimer > 0
              ? 'celebrate'
              : inp.emoteTimer > 0 && inp.emoteType === 'wave'
              ? 'wave'
              : inp.emoteTimer > 0 && inp.emoteType === 'dance'
              ? 'dance'
              : isSwimming
              ? 'swim'
              : isHeroAirborne
              ? 'jump'
              : isClimbingStairs
              ? 'climbStairs'
              : moving && isRunning
              ? 'run'
              : moving
              ? 'walk'
              : 'idle';

            const activeHeroPreset = heroLogicTarget
              ? heroLogicTarget.preset
              : resolveMotionPresetForRuntime({
                  slot: desiredHeroSlot,
                  actorCategory: 'hero',
                  project: activeProject,
                });

            if (activeHeroPreset) {
              const pKey = `${desiredHeroSlot}:${activeHeroPreset.id}`;
              if (heroCustomMotionKey !== pKey) {
                heroCustomMotionKey = pKey;
                heroCustomMotionElapsed = 0;
              }
              heroCustomMotionBlend = THREE.MathUtils.damp(heroCustomMotionBlend, 1, 18, dt);
              const dur = Math.max(0.1, activeHeroPreset.duration);
              let tNorm = 0;
              if (attackAnimTimer > 0 && (desiredHeroSlot === 'attack' || desiredHeroSlot === 'swing')) {
                tNorm = THREE.MathUtils.clamp(1 - attackAnimTimer / Math.max(0.05, activeAttackDuration), 0, 1);
              } else if (heroLogicTarget && heroLogicAnimTimer > 0) {
                tNorm = THREE.MathUtils.clamp(
                  ((heroLogicAnimDuration - heroLogicAnimTimer) / dur) % 1,
                  0,
                  1
                );
              } else {
                const spdMult =
                  desiredHeroSlot === 'walk' || desiredHeroSlot === 'run'
                    ? THREE.MathUtils.clamp(locoVelocityRatio, 0.5, 1.6)
                    : 1;
                heroCustomMotionElapsed += dt * spdMult * (activeProject.heroAnimSpeed ?? 1);
                tNorm = activeHeroPreset.loop
                  ? (heroCustomMotionElapsed / dur) % 1
                  : Math.min(1, heroCustomMotionElapsed / dur);
              }
              const isNonLocomotionSlot =
                desiredHeroSlot !== 'idle' &&
                desiredHeroSlot !== 'walk' &&
                desiredHeroSlot !== 'run' &&
                desiredHeroSlot !== 'swim' &&
                desiredHeroSlot !== 'jump' &&
                desiredHeroSlot !== 'sit' &&
                desiredHeroSlot !== 'knockdown' &&
                desiredHeroSlot !== 'getUp' &&
                desiredHeroSlot !== 'climbVertical';
              const upperOnly =
                moving &&
                !isHeroAirborne &&
                !isSitting &&
                isNonLocomotionSlot &&
                !presetHasLegTracks(activeHeroPreset);
              applyMotionPresetToHeroRigRuntime(
                heroRig,
                activeHeroPreset,
                tNorm,
                heroCustomMotionBlend,
                upperOnly,
                0.85
              );
            } else {
              heroCustomMotionBlend = THREE.MathUtils.damp(heroCustomMotionBlend, 0, 18, dt);
              if (heroCustomMotionBlend <= 0.02) heroCustomMotionKey = '';
            }

            animateCreatureRig(
              heroRig.group.userData.creatureAnim as CreatureAnimRefs | undefined,
              gameElapsed,
              moving || isSwimming,
              isRunning ? 1.35 : 1,
              inp.emoteType === 'dance' || tavernCelebrated
            );
          }

          glideDeployBlend = THREE.MathUtils.damp(
            glideDeployBlend,
            isGliding ? 1 : 0,
            isGliding ? 13 : 17,
            dt
          );
          if (glideDeployBlend > 0.01) {
            heroRoot.updateMatrixWorld(true);
            const gripLObj = heroRig?.handGripL ?? heroCustomEquipment?.handGripL;
            const gripRObj = heroRig?.handGripR ?? heroCustomEquipment?.handGripR;
            if (gripLObj && gripRObj) {
              gripLObj.getWorldPosition(_glideHandL);
              gripRObj.getWorldPosition(_glideHandR);
              heroRoot.worldToLocal(_glideHandL);
              heroRoot.worldToLocal(_glideHandR);
            } else {
              _glideHandL.set(
                0.62 * parachuteCanopyScale,
                1.98 * parachuteCanopyScale,
                0.22 * parachuteCanopyScale
              );
              _glideHandR.set(
                -0.62 * parachuteCanopyScale,
                1.98 * parachuteCanopyScale,
                0.22 * parachuteCanopyScale
              );
            }
            const airSpeedNorm = THREE.MathUtils.clamp(actualHorizSpeed / 8.0, 0.25, 1.2);
            updateParachuteBlanketRig(
              parachuteRig,
              glideDeployBlend,
              gameElapsed,
              airSpeedNorm,
              _glideHandL,
              _glideHandR,
              parachuteCanopyScale
            );
          } else {
            parachuteRig.group.visible = false;
          }

          // Close the on-foot else block & record breadcrumb trail for companions
          }
          if (isDriving) {
            parachuteRig.group.visible = false;
          }

          const isFirstPersonNow = !isDriving && camModeNow === 'firstPerson';
          if (heroCustom) {
            heroRoot.visible = !isFirstPersonNow;
          } else if (heroRig) {
            heroRig.bodyPivot.visible = !isFirstPersonNow;
            heroRig.shadowDisc.visible = !isFirstPersonNow && !isSwimming;
          }
          if (isFirstPersonNow) {
            heroSlashArc.visible = false;
          }
          if (isFirstPersonNow && heldDefNow?.toolKind === 'torch') {
            fpsTorchLight.intensity = 2.6 + Math.sin(gameElapsed * 9.5) * 0.28;
            fpsTorchLight.position.set(heroX, heroY + 1.45, heroZ);
          } else {
            fpsTorchLight.intensity = 0;
          }

          const lastTrailPt = heroTrail[heroTrail.length - 1];
          if (
            !isDriving &&
            !isSwimming &&
            Math.hypot(heroX - lastTrailPt.x, heroZ - lastTrailPt.z) >= 0.85
          ) {
            heroTrail.push({ x: heroX, y: heroY, z: heroZ });
            if (heroTrail.length > 260) heroTrail.shift();
          }

          // Action initiation: Fishing Pole cast/reel OR Axe Woodchop OR Sword Attack!
          const triggerFishingAction = () => {
            if (isSwimming) {
              showToast('Stand on the riverbank or shore to cast your fishing pole!');
              return;
            }
            if (fishingState.phase === 'bite') {
              // Hooked! Reel the leaping fish in!
              setFishingPhase('reeling');
              fishingState.startX = fishingState.targetX;
              fishingState.startY = IslandTerrain.waterLevel;
              fishingState.startZ = fishingState.targetZ;
              AudioEngine.playSound('reel');
              AudioEngine.playSound('splash');
              spawnWaterRipple(fishingState.targetX, fishingState.targetZ, 3.6, 1.0);
              spawnCombatSparks(
                fishingState.targetX,
                IslandTerrain.waterLevel + 0.25,
                fishingState.targetZ,
                '#E0F7FF',
                10,
                5.4
              );
              bobberGroup.visible = false;
              leapingFishMesh.visible = true;
              leapingFishMesh.position.set(
                fishingState.targetX,
                IslandTerrain.waterLevel,
                fishingState.targetZ
              );
            } else if (fishingState.phase === 'waiting') {
              cancelFishing('Reeled in early — wait for a fish to bite!');
            } else if (fishingState.phase === 'idle') {
              // Search forward along heroYaw for blue river/ocean water
              const fwdX = Math.sin(heroYaw);
              const fwdZ = Math.cos(heroYaw);
              let foundWater: [number, number] | null = null;
              if (env === 'openWorld') {
                for (const distTry of [7.2, 5.5, 9.2, 4.2, 11.4, 3.4]) {
                  const tx = heroX + fwdX * distTry;
                  const tz = heroZ + fwdZ * distTry;
                  const h = sampleLevelHeight(activeLevel, tx, tz);
                  if (h < IslandTerrain.waterLevel - 0.12) {
                    foundWater = [tx, tz];
                    break;
                  }
                }
              }
              AudioEngine.playSound('whoosh');
              if (foundWater) {
                getRodTipPos(_rodTipWorld);
                fishingState.startX = _rodTipWorld.x;
                fishingState.startY = _rodTipWorld.y;
                fishingState.startZ = _rodTipWorld.z;
                fishingState.targetX = foundWater[0];
                fishingState.targetZ = foundWater[1];
                fishingState.waitDuration = 2.6 + Math.random() * 2.8;
                fishingState.rippleTimer = 0;
                setFishingPhase('casting');
                bobberGroup.visible = true;
                fishingLine.visible = true;
              } else {
                setFishingPhase('dryWhip');
                showToast('Face the river or ocean shore to cast your line!');
              }
            }
          };

          if (inp.attackQueued) {
            inp.attackQueued = false;
            shieldGuardTimer = 0;
            if (worldInteract?.carriedRock) {
              const thrownKind = worldInteract.throwCarriedRock();
              if (thrownKind) {
                AudioEngine.playSound('whoosh');
                heroYaw = Math.atan2(worldInteract.aimX - heroX, worldInteract.aimZ - heroZ);
                attackAnimTimer = 0.24;
                activeAttackDuration = 0.24;
              }
            } else if (heldDefNow?.toolKind === 'fishingPole') {
              triggerFishingAction();
            } else if (attackAnimTimer <= 0.06) {
              if (staminaExhausted || stamina < 15) {
                if (gameElapsed - lastStaminaToast > 1.8) {
                  lastStaminaToast = gameElapsed;
                  showToast('Out of stamina! Wait to recover.');
                }
              } else {
                const isAxe = heldDefNow?.toolKind === 'axe';
                stamina = Math.max(0, stamina - (isAxe ? 16 : 20));
                energy = Math.max(0, energy - 0.45);
                if (stamina <= 0) {
                  staminaExhausted = true;
                }
                activeAttackKind = isAxe ? 'axe' : 'sword';
                activeAttackDuration = isAxe ? CHOP_DURATION : ATTACK_DURATION;
                attackAnimTimer = activeAttackDuration;
                attackHitEnemies.clear();
                attackHitFlora.clear();
                chopDidStrike = false;
                AudioEngine.playSound('whoosh');
                // Small forward combat step so melee swings feel committed
                if (!isSwimming) {
                  heroKnockVX += Math.sin(heroYaw) * (isAxe ? 1.4 : 2.2);
                  heroKnockVZ += Math.cos(heroYaw) * (isAxe ? 1.4 : 2.2);
                }
                if (rapierPhysics?.isReady()) {
                  rapierPhysics.applyRadialImpulse(
                    heroX + Math.sin(heroYaw) * 1.35,
                    heroY + 0.85,
                    heroZ + Math.cos(heroYaw) * 1.35,
                    3.6,
                    isAxe ? 13.5 : 10.5,
                    0.52
                  );
                }
              }
            }
          }

          // Active melee / woodchopping hit window — synced with visual blade/axe sweep!
          if (attackAnimTimer > 0) {
            const p = 1 - attackAnimTimer / activeAttackDuration;
            const fwdX = Math.sin(heroYaw);
            const fwdZ = Math.cos(heroYaw);

            // Woodchopping strike against forest trees & scenery trees when holding an Axe!
            if (activeAttackKind === 'axe' && !chopDidStrike && p >= 0.28 && p <= 0.65) {
              let bestTree: (typeof islandHandles.choppableTrees)[number] | null = null;
              let bestDist = 3.35;
              for (const tr of islandHandles.choppableTrees) {
                if (tr.chopped) continue;
                const dx = tr.x - heroX;
                const dz = tr.z - heroZ;
                const d = Math.hypot(dx, dz);
                if (d > bestDist) continue;
                const dot = d > 0.01 ? (dx / d) * fwdX + (dz / d) * fwdZ : 1;
                if (d > 1.65 && dot < -0.1) continue;
                bestDist = d;
                bestTree = tr;
              }

              if (bestTree) {
                chopDidStrike = true;
                wearHeldDurability(2);
                bestTree.hp -= 1;
                const dx = bestTree.x - heroX;
                const dz = bestTree.z - heroZ;
                const invD = 1 / Math.max(0.01, Math.hypot(dx, dz));
                bestTree.shakeDirX = dx * invD;
                bestTree.shakeDirZ = dz * invD;
                bestTree.shakeTimer = 0.34;
                AudioEngine.playSound('chop');
                hitStopTimer = 0.036;
                shakeTimer = Math.max(shakeTimer, 0.14);
                spawnCombatSparks(
                  bestTree.x - bestTree.shakeDirX * 0.32,
                  bestTree.y + 1.15,
                  bestTree.z - bestTree.shakeDirZ * 0.32,
                  '#D9A166',
                  10,
                  5.8
                );

                if (bestTree.hp <= 0) {
                  bestTree.chopped = true;
                  choppedTreeIds.add(bestTree.id);
                  // Hide procedural, batched, or instanced tree immediately
                  if (bestTree.treeGroup) {
                    bestTree.treeGroup.visible = false;
                  } else if (bestTree.batchedEntries && bestTree.batchedEntries.length > 0) {
                    for (const be of bestTree.batchedEntries) {
                      hideBatchEntry(be, bestTree.x, bestTree.y - 60, bestTree.z);
                    }
                  } else {
                    _treeDummy.position.set(bestTree.x, bestTree.y - 50, bestTree.z);
                    _treeDummy.scale.set(0, 0, 0);
                    _treeDummy.updateMatrix();
                    for (const im of bestTree.meshes) {
                      im.setMatrixAt(bestTree.instanceIndex, _treeDummy.matrix);
                      im.instanceMatrix.needsUpdate = true;
                    }
                    if (bestTree.canopyPuffMeshes && bestTree.canopyPuffIndices) {
                      for (const pm of bestTree.canopyPuffMeshes) {
                        for (const pIdx of bestTree.canopyPuffIndices) {
                          pm.setMatrixAt(pIdx, _treeDummy.matrix);
                        }
                        pm.instanceMatrix.needsUpdate = true;
                      }
                    }
                  }
                  // Place faceted stump & spawn animated falling tree
                  const stump = buildTreeStumpMesh(bestTree.size, bestTree.kind);
                  if (style !== 'painterlyPBR') {
                    applyVisualStyleToObject(stump, style);
                  }
                  stump.position.set(bestTree.x, bestTree.y, bestTree.z);
                  scene.add(stump);
                  stump.updateMatrixWorld(true);
                  const stumpBox = new THREE.Box3().setFromObject(stump);
                  const stumpTopOffset = Math.max(0.28, stumpBox.max.y - bestTree.y);
                  choppedStumps.push({
                    id: bestTree.id,
                    x: bestTree.x,
                    y: bestTree.y,
                    z: bestTree.z,
                    size: bestTree.size,
                    topOffsetY: stumpTopOffset,
                    label: 'Tree Stump',
                  });

                  const fallTree = buildFallingTreeMesh(bestTree.kind, bestTree.size, bestTree.colorHex);
                  if (style !== 'painterlyPBR') {
                    applyVisualStyleToObject(fallTree, style);
                  }
                  fallTree.position.set(bestTree.x, bestTree.y + 0.52, bestTree.z);
                  fallTree.rotation.y = Math.atan2(bestTree.shakeDirX, bestTree.shakeDirZ);
                  scene.add(fallTree);
                  fallingTrees.push({
                    mesh: fallTree,
                    x: bestTree.x,
                    y: bestTree.y,
                    z: bestTree.z,
                    fallDirX: bestTree.shakeDirX,
                    fallDirZ: bestTree.shakeDirZ,
                    size: bestTree.size,
                    progress: 0,
                    bounced: false,
                  });
                  showToast('Timber! Tree falling...');
                } else {
                  showToast(`Chop! (${bestTree.hp} hit${bestTree.hp === 1 ? '' : 's'} left)`);
                }
              } else {
                // Also allow chopping placed 'scenery' tree entities!
                for (const rt of runtimeEntities) {
                  if (!rt.alive || rt.kind !== 'scenery') continue;
                  const d = Math.hypot(rt.x - heroX, rt.z - heroZ);
                  if (d > 3.1) continue;
                  chopDidStrike = true;
                  wearHeldDurability(2);
                  rt.treeHp = (rt.treeHp ?? 3) - 1;
                  AudioEngine.playSound('chop');
                  spawnCombatSparks(rt.x, sampleLevelHeight(activeLevel, rt.x, rt.z) + 1.0, rt.z, '#D9A166', 9, 5.5);
                  if (rt.treeHp <= 0) {
                    rt.alive = false;
                    rt.mesh.visible = false;
                    const gy = sampleLevelHeight(activeLevel, rt.x, rt.z);
                    for (let li = 0; li < 2; li++) {
                      const ang = li * Math.PI + Math.random() * 0.8;
                      spawnDroppedItem(
                        rt.pickupItemId || 'wood_log',
                        1,
                        rt.x,
                        gy + 0.5,
                        rt.z,
                        Math.cos(ang) * 2.2,
                        4.2,
                        Math.sin(ang) * 2.2
                      );
                    }
                    showToast(`Chopped ${rt.name} into logs!`);
                  } else {
                    showToast(`Chop! (${rt.treeHp} left)`);
                  }
                  break;
                }
              }
            }

            if (!chopDidStrike && p >= 0.28 && p <= 0.65) {
              const rockRule = harvestRuleByScatterRef.current.get('rock');
              if (rockRule && islandHandles.harvestableScatter.length > 0) {
                let bestRock: (typeof islandHandles.harvestableScatter)[number] | null = null;
                let bestRockDist = 2.45;
                for (let hi = 0; hi < islandHandles.harvestableScatter.length; hi++) {
                  const hs = islandHandles.harvestableScatter[hi];
                  if (hs.collected || hs.scatterKind !== 'rock') continue;
                  const dx = hs.x - heroX;
                  const dz = hs.z - heroZ;
                  const d = Math.hypot(dx, dz);
                  if (d > bestRockDist) continue;
                  const dot = d > 0.01 ? (dx / d) * fwdX + (dz / d) * fwdZ : 1;
                  if (d > 1.35 && dot < -0.15) continue;
                  bestRockDist = d;
                  bestRock = hs;
                }
                if (bestRock) {
                  chopDidStrike = true;
                  wearHeldDurability(1);
                  bestRock.collected = true;
                  for (const be of bestRock.batchedEntries) {
                    hideBatchEntry(be, bestRock.x, bestRock.y - 60, bestRock.z);
                  }
                  const collectDef = itemByIdRef.current.get(rockRule.itemId);
                  addItemToBag(
                    rockRule.itemId,
                    rockRule.qty,
                    collectDef?.category === 'tool'
                  );
                  AudioEngine.playSound(activeLevel.audio.hit);
                  spawnCombatSparks(
                    bestRock.x,
                    bestRock.y + 0.4,
                    bestRock.z,
                    '#94A3B8',
                    9,
                    5.2
                  );
                  showToast(
                    `Gathered ${rockRule.qty > 1 ? `${rockRule.qty}× ` : ''}${
                      collectDef?.name ?? 'Smooth River Stone'
                    }!`
                  );
                }
              }
            }

            // Sliceable Flora (bushes, berry bushes, ferns, wildflowers, mushrooms) & Breakable Pots/Crates with 3D Debris + Occasional Loot!
            if (p >= 0.26 && p <= 0.68) {
              // 1. World flora scatter
              for (let hi = 0; hi < islandHandles.harvestableScatter.length; hi++) {
                const hs = islandHandles.harvestableScatter[hi];
                if (hs.collected || hs.scatterKind === 'rock') continue;
                if (attackHitFlora.has(hs.id)) continue;
                const fdx = hs.x - heroX;
                const fdz = hs.z - heroZ;
                const fd = Math.hypot(fdx, fdz);
                if (fd > 2.55 || Math.abs(hs.y - heroY) > 2.2) continue;
                const fdot = fd > 0.01 ? (fdx / fd) * fwdX + (fdz / fd) * fwdZ : 1;
                if (fd > 1.15 && fdot < -0.1) continue;

                attackHitFlora.add(hs.id);
                const maxHp =
                  hs.maxHp ??
                  (hs.scatterKind === 'bush' || hs.scatterKind === 'berryBush'
                    ? 3
                    : hs.scatterKind === 'fern' || hs.scatterKind === 'broadleaf'
                    ? 2
                    : 1);
                hs.maxHp = maxHp;
                hs.hp = (hs.hp ?? maxHp) - 1;

                const theme: DebrisTheme =
                  hs.scatterKind === 'berryBush'
                    ? 'berry'
                    : hs.scatterKind === 'flower'
                    ? 'flower'
                    : hs.scatterKind === 'fern' || hs.scatterKind === 'broadleaf'
                    ? 'fern'
                    : hs.scatterKind === 'mushroom'
                    ? 'wood'
                    : 'leaf';
                worldInteract?.spawnDebrisBurst(
                  hs.x,
                  hs.y + 0.42,
                  hs.z,
                  theme,
                  hs.hp <= 0 ? 12 : 6,
                  hs.hp <= 0 ? 5.2 : 3.8
                );
                AudioEngine.playSound('chop');

                if (hs.hp <= 0) {
                  hs.collected = true;
                  for (const be of hs.batchedEntries) {
                    hideBatchEntry(be, hs.x, hs.y - 60, hs.z);
                  }
                  // Occasional hidden treasure or forage inside sliced bushes & flora!
                  const lootRoll = Math.random();
                  if (hs.scatterKind === 'berryBush' || lootRoll < 0.16) {
                    const dropItem =
                      hs.scatterKind === 'berryBush'
                        ? 'wild_berries'
                        : hs.scatterKind === 'mushroom'
                        ? 'wild_mushroom'
                        : 'forest_herbs';
                    if (itemByIdRef.current.has(dropItem)) {
                      spawnDroppedItem(dropItem, 1, hs.x, hs.y + 0.45, hs.z, (Math.random() - 0.5) * 2, 4.0, (Math.random() - 0.5) * 2);
                    }
                  } else if (lootRoll < 0.30) {
                    coins += 2;
                    AudioEngine.playSound(activeLevel.audio.coin);
                    spawnCombatSparks(hs.x, hs.y + 0.5, hs.z, '#FACC15', 8, 4.6);
                    showToast('Found +2 hidden Gold in the foliage!');
                  }
                }
              }

              // 2. Breakable placed props (pots, urns, vases, crates, barrels)
              for (const rt of runtimeEntities) {
                if (!rt.alive || rt.kind !== 'prop' || rt.buildingBlock || rt.doorConfig) continue;
                if (attackHitFlora.has(rt.id)) continue;
                const nm = rt.name.toLowerCase();
                const pr = String(rt.propPreset ?? '').toLowerCase();
                const isCeramic = nm.includes('pot') || nm.includes('vase') || nm.includes('urn') || nm.includes('jar');
                const isWoodProp =
                  pr === 'crate' ||
                  pr === 'barrel' ||
                  nm.includes('crate') ||
                  nm.includes('barrel') ||
                  nm.includes('box') ||
                  nm.includes('keg');
                if (!isCeramic && !isWoodProp) continue;

                const pdx = rt.x - heroX;
                const pdz = rt.z - heroZ;
                const pd = Math.hypot(pdx, pdz);
                if (pd > 2.65) continue;
                const pdot = pd > 0.01 ? (pdx / pd) * fwdX + (pdz / pd) * fwdZ : 1;
                if (pd > 1.2 && pdot < -0.1) continue;

                attackHitFlora.add(rt.id);
                const maxP = rt.propMaxHp ?? (isCeramic ? 2 : 3);
                rt.propMaxHp = maxP;
                rt.propHp = (rt.propHp ?? maxP) - 1;
                rt.propShakeTimer = 0.22;
                rt.propShakeDirX = pdx / Math.max(0.01, pd);
                rt.propShakeDirZ = pdz / Math.max(0.01, pd);

                const propY = sampleLevelHeight(activeLevel, rt.x, rt.z) + (rt.elevationY ?? 0);
                worldInteract?.spawnDebrisBurst(
                  rt.x,
                  propY + 0.55,
                  rt.z,
                  isCeramic ? 'ceramic' : 'wood',
                  rt.propHp <= 0 ? 14 : 7,
                  rt.propHp <= 0 ? 5.8 : 4.1
                );
                AudioEngine.playSound(isCeramic ? 'hit' : 'chop');

                if (rt.propHp <= 0) {
                  rt.alive = false;
                  rt.mesh.visible = false;
                  const roll = Math.random();
                  if (roll < 0.45) {
                    const bonus = 3 + Math.floor(Math.random() * 4);
                    coins += bonus;
                    AudioEngine.playSound(activeLevel.audio.coin);
                    spawnCombatSparks(rt.x, propY + 0.6, rt.z, '#FACC15', 10, 5.2);
                    showToast(`Smashed ${rt.name}! Found +${bonus} Gold!`);
                  } else if (roll < 0.7 && health < maxHealth) {
                    health = Math.min(maxHealth, health + 1);
                    AudioEngine.playSound('chime');
                    spawnCombatSparks(rt.x, propY + 0.6, rt.z, '#FB7185', 10, 5.0);
                    showToast(`Smashed ${rt.name}! Found a Heart (+1 HP)!`);
                  }
                }
              }
            }

            if (p >= 0.26 && p <= 0.70) {
              const rangeExtra = heldDefNow?.weaponRange ? Math.max(0, heldDefNow.weaponRange - 2.4) : 0;
              for (const rt of runtimeEntities) {
                if (!rt.alive || rt.kind !== 'baddie' || rt.aiState === 'dying') continue;
                if (attackHitEnemies.has(rt.id)) continue;
                const dx = rt.x - heroX;
                const dz = rt.z - heroZ;
                const d = Math.hypot(dx, dz);
                const reach = (rt.isBoss ? 3.15 : 2.8) + rangeExtra;
                if (d > reach) continue;
                const invD = 1 / Math.max(0.001, d);
                const nx = dx * invD;
                const nz = dz * invD;
                const forwardDot = nx * fwdX + nz * fwdZ;
                if (d > 1.35 && forwardDot < -0.15) continue;

                // Direct melee impact!
                attackHitEnemies.add(rt.id);
                wearHeldDurability(2);
                const targetDesc: EnemyTargetDescriptors = {
                  isBoss: rt.isBoss,
                  isFlying: Boolean(rt.quadrupedRig?.canFly || rt.baddieRig?.isFlyer || rt.flightY > 0.35),
                  isBeast: Boolean(rt.quadrupedRig),
                  isElemental:
                    rt.monsterAbility === 'flameBody' ||
                    rt.monsterAbility === 'staticShell' ||
                    Boolean(
                      rt.baddieAI &&
                        [
                          rt.baddieAI.primaryAction,
                          rt.baddieAI.secondaryAction,
                        ].some((act) =>
                          ['fireBreath', 'iceBreath', 'electricShock', 'poisonSpit', 'waterJet', 'shadowBeam', 'solarBeam'].includes(
                            act
                          )
                        )
                    ),
                  isHeavyBrute: rt.maxHealth >= 8 || rt.monsterAbility === 'thickFat',
                };
                const rpgAtkExtra =
                  activeLevel.gameplayMode === 'rpg' ? rpgStatsRef.current.atkBonus : 0;
                const meleeOut = computeHeroOutgoingDamage(
                  heroAttackDamage + rpgAtkExtra,
                  heroProfile,
                  targetDesc
                );
                rt.health -= meleeOut.damage;
                AudioEngine.playSound(activeLevel.audio.hit);
                if (meleeOut.matchupNote && rt.health > 0) {
                  showToast(`${meleeOut.matchupNote} (${meleeOut.damage} DMG)`);
                }

                // Directional physical knockback & hit-side stagger reaction (front vs flank vs rear!)
                const bFwdX = Math.sin(rt.mesh.rotation.y);
                const bFwdZ = Math.cos(rt.mesh.rotation.y);
                const bRightX = Math.cos(rt.mesh.rotation.y);
                const bRightZ = -Math.sin(rt.mesh.rotation.y);
                const hitFrontDot = nx * bFwdX + nz * bFwdZ; // >0 means hit from behind pushing baddie forward
                const hitSideDot = nx * bRightX + nz * bRightZ; // +/- means left/right flank impact
                const isRearHit = hitFrontDot > 0.38;
                const isFlankHit = Math.abs(hitSideDot) > 0.45 && !isRearHit;

                const powerStrikeBonus = heroSkillSet.has('powerStrike') ? 1.25 : 1;
                const directionalMult = isRearHit ? 1.24 : isFlankHit ? 1.12 : 1.0;
                const knockSpeed =
                  (rt.isBoss ? 8.2 : 14.2) *
                  powerStrikeBonus *
                  directionalMult *
                  (rt.monsterAbility === 'thickFat' ? 0.58 : 1);
                rt.vx = nx * knockSpeed + (isFlankHit ? -bRightX * Math.sign(hitSideDot) * 2.2 : 0);
                rt.vz = nz * knockSpeed + (isFlankHit ? -bRightZ * Math.sign(hitSideDot) * 2.2 : 0);
                rt.vy = (rt.isBoss ? 2.9 : 4.8) * (rt.monsterAbility === 'thickFat' ? 0.68 : 1);
                rt.hitFlashTimer = 0.22;
                rt.recoilPitch = isRearHit ? 0.72 : -0.74;
                rt.recoilRoll = isFlankHit
                  ? (hitSideDot > 0 ? -0.68 : 0.68)
                  : (hitSideDot >= 0 ? -0.28 : 0.28);
                if (!isRearHit) {
                  rt.mesh.rotation.y = Math.atan2(-nx, -nz) + (isFlankHit ? -hitSideDot * 0.45 : 0);
                }
                worldInteract?.spawnDebrisBurst(
                  rt.x,
                  sampleLevelHeight(activeLevel, rt.x, rt.z) + 0.35,
                  rt.z,
                  'dust',
                  rt.isBoss ? 9 : 6,
                  4.8
                );

                if (
                  rt.health > 0 &&
                  (rt.monsterAbility === 'flameBody' || rt.monsterAbility === 'staticShell')
                ) {
                  const isFlame = rt.monsterAbility === 'flameBody';
                  spawnCombatSparks(
                    heroX + dx * 0.45,
                    heroY + 1.0,
                    heroZ + dz * 0.45,
                    isFlame ? '#F97316' : '#FACC15',
                    9,
                    6.8
                  );
                  if (d < 1.65 && hitInvuln <= 0) {
                    health -= 1;
                    hitInvuln = 0.8;
                    heroKnockVX = -nx * 5.2;
                    heroKnockVZ = -nz * 5.2;
                    heroRecoilTimer = 0.2;
                    AudioEngine.playSound(isFlame ? 'hurt' : 'sparkle');
                    showToast(
                      isFlame ? `${rt.name}'s Flame Body scorched you!` : `${rt.name}'s Static Shell shocked you!`
                    );
                    if (health <= 0) {
                      triggerHeroDeath();
                    }
                  }
                }

                const impactY = Math.max(-0.5, sampleLevelHeight(activeLevel, rt.x, rt.z)) + 1.0;
                const sparkX = heroX + dx * 0.68;
                const sparkZ = heroZ + dz * 0.68;

                // Colorful blade contact slash arc + evaporating enemy HP number overhead!
                spawnRpgSwordSlashArc(
                  scene,
                  rpgVisualFx,
                  heroX,
                  heroY,
                  heroZ,
                  Math.atan2(dx, dz),
                  '#F59E0B'
                );
                spawnEvaporatingDamageNumber(
                  scene,
                  evaporatingDamages,
                  rt.x,
                  impactY + (rt.isBoss ? 1.55 : 1.05),
                  rt.z,
                  `-${meleeOut.damage}`,
                  '#FBBF24',
                  activeLevel.gameplayMode === 'rpg' ? 'SWORD SLASH!' : undefined
                );

                if (rt.health <= 0) {
                  beginBaddieDeath(rt, nx, nz);
                } else {
                  hitStopTimer = 0.042;
                  shakeTimer = Math.max(shakeTimer, 0.14);
                  spawnCombatSparks(sparkX, impactY, sparkZ, '#FFF3B0', 9, 7.2);
                  // Stagger enemy and interrupt windup (boss keeps poise only during active strike)
                  if (!(rt.isBoss && rt.aiState === 'strike')) {
                    rt.aiState = 'stagger';
                    rt.stateTimer = rt.isBoss ? 0.32 : 0.48;
                    rt.attackCooldown = Math.max(rt.attackCooldown, 0.58);
                  }
                  if (rt.isBoss && rt.health === Math.ceil(rt.maxHealth / 2)) {
                    shakeTimer = 0.4;
                    showToast(`${rt.name}: You are stronger than you look!`);
                  }
                }
              }
            }
          }

          // Update shaken trees (tactile woodchop wobble!)
          for (const tr of islandHandles.choppableTrees) {
            if (tr.chopped || tr.shakeTimer <= 0) continue;
            tr.shakeTimer = Math.max(0, tr.shakeTimer - dt);
            const frac = tr.shakeTimer / 0.34;
            const wobble = Math.sin(frac * Math.PI * 3.5) * frac * 0.12;
            if (tr.treeGroup) {
              tr.treeGroup.rotation.set(
                tr.shakeDirZ * wobble,
                tr.rotation,
                -tr.shakeDirX * wobble
              );
            } else if (tr.batchedEntries && tr.batchedEntries.length > 0) {
              _treeDummy.position.set(tr.x, tr.y, tr.z);
              _treeDummy.rotation.set(tr.shakeDirZ * wobble, tr.rotation, -tr.shakeDirX * wobble);
              _treeDummy.scale.setScalar(tr.size * 1.15);
              _treeDummy.updateMatrix();
              for (const be of tr.batchedEntries) {
                setBatchEntryMatrix(be, _treeDummy.matrix);
              }
            } else {
              _treeDummy.position.set(tr.x, tr.y, tr.z);
              _treeDummy.rotation.set(tr.shakeDirZ * wobble, tr.rotation, -tr.shakeDirX * wobble);
              _treeDummy.scale.setScalar(tr.size * 1.15);
              _treeDummy.updateMatrix();
              for (const im of tr.meshes) {
                im.setMatrixAt(tr.instanceIndex, _treeDummy.matrix);
                im.instanceMatrix.needsUpdate = true;
              }
              if (tr.canopyPuffMeshes && tr.canopyPuffIndices && tr.canopyPuffLocalMatrices) {
                const puffWorld = new THREE.Matrix4();
                for (const pm of tr.canopyPuffMeshes) {
                  for (let pi = 0; pi < tr.canopyPuffIndices.length; pi++) {
                    puffWorld.multiplyMatrices(_treeDummy.matrix, tr.canopyPuffLocalMatrices[pi]);
                    pm.setMatrixAt(tr.canopyPuffIndices[pi], puffWorld);
                  }
                  pm.instanceMatrix.needsUpdate = true;
                }
              }
            }
          }

          // Update toppling trees -> burst into pickupable 3D Wood Logs!
          for (let i = fallingTrees.length - 1; i >= 0; i--) {
            const ft = fallingTrees[i];
            ft.progress += dt / 0.92;
            const p = Math.min(1, ft.progress);
            const fallAngle = p * p * (Math.PI * 0.49);
            ft.mesh.rotation.x = fallAngle;
            if (p >= 1) {
              // Tree crashes onto forest floor and splits into 3 pickupable Wood Logs!
              AudioEngine.playSound('chop');
              AudioEngine.playSound('hit');
              shakeTimer = Math.max(shakeTimer, 0.18);
              for (let li = 0; li < 3; li++) {
                const along = 1.4 + li * 1.25;
                const lx = ft.x + ft.fallDirX * along + (Math.random() - 0.5) * 0.6;
                const lz = ft.z + ft.fallDirZ * along + (Math.random() - 0.5) * 0.6;
                const ly = sampleLevelHeight(activeLevel, lx, lz);
                spawnCombatSparks(lx, ly + 0.55, lz, '#88C057', 5, 4.2);
                spawnDroppedItem(
                  'wood_log',
                  1,
                  lx,
                  ly + 0.35,
                  lz,
                  (Math.random() - 0.5) * 1.8,
                  3.6 + Math.random() * 1.4,
                  (Math.random() - 0.5) * 1.8
                );
              }
              scene.remove(ft.mesh);
              disposeObject3D(ft.mesh);
              fallingTrees.splice(i, 1);
              showToast('Tree felled! Pick up the Wood Logs.');
            }
          }

          // Update dynamic fishing loop (casting -> ripple -> waiting -> fish bite -> leaping reel-in!)
          if (fishingState.phase !== 'idle') {
            fishingState.timer += dt;
            getRodTipPos(_rodTipWorld);

            if (fishingState.phase === 'dryWhip') {
              if (fishingState.timer >= 0.38) {
                setFishingPhase('idle');
              }
            } else if (fishingState.phase === 'casting') {
              const p = Math.min(1, fishingState.timer / 0.54);
              if (p < 0.36) {
                bobberGroup.position.copy(_rodTipWorld);
                bobberGroup.position.y -= 0.28;
                updateFishingLine(
                  _rodTipWorld.x,
                  _rodTipWorld.y,
                  _rodTipWorld.z,
                  bobberGroup.position.x,
                  bobberGroup.position.y,
                  bobberGroup.position.z,
                  0.04
                );
              } else {
                const fp = (p - 0.36) / 0.64;
                const bx = THREE.MathUtils.lerp(_rodTipWorld.x, fishingState.targetX, fp);
                const bz = THREE.MathUtils.lerp(_rodTipWorld.z, fishingState.targetZ, fp);
                const by =
                  THREE.MathUtils.lerp(_rodTipWorld.y, IslandTerrain.waterLevel, fp) +
                  Math.sin(fp * Math.PI) * 2.55;
                bobberGroup.position.set(bx, by, bz);
                updateFishingLine(_rodTipWorld.x, _rodTipWorld.y, _rodTipWorld.z, bx, by, bz, 0.25);
              }

              if (p >= 1) {
                // Bait lands in the water — crisp splash & concentric ripples!
                AudioEngine.playSound('splash');
                spawnWaterRipple(fishingState.targetX, fishingState.targetZ, 3.4, 1.2);
                spawnWaterRipple(fishingState.targetX, fishingState.targetZ, 2.2, 0.85);
                spawnCombatSparks(
                  fishingState.targetX,
                  IslandTerrain.waterLevel + 0.15,
                  fishingState.targetZ,
                  '#E0F7FF',
                  7,
                  3.8
                );
                setFishingPhase('waiting');
              }
            } else if (fishingState.phase === 'waiting') {
              const bobY = IslandTerrain.waterLevel + Math.sin(gameElapsed * 3.6) * 0.048;
              bobberGroup.position.set(fishingState.targetX, bobY, fishingState.targetZ);
              bobberGroup.rotation.z = Math.sin(gameElapsed * 2.2) * 0.12;
              updateFishingLine(
                _rodTipWorld.x,
                _rodTipWorld.y,
                _rodTipWorld.z,
                fishingState.targetX,
                bobY + 0.12,
                fishingState.targetZ,
                0.55
              );
              fishingState.rippleTimer += dt;
              if (fishingState.rippleTimer >= 1.15) {
                fishingState.rippleTimer = 0;
                spawnWaterRipple(fishingState.targetX, fishingState.targetZ, 1.9, 1.05);
              }
              if (fishingState.timer >= fishingState.waitDuration) {
                // Fish bites!
                AudioEngine.playSound('splash');
                AudioEngine.playSound('bite');
                spawnWaterRipple(fishingState.targetX, fishingState.targetZ, 4.2, 1.0);
                spawnCombatSparks(
                  fishingState.targetX,
                  IslandTerrain.waterLevel + 0.2,
                  fishingState.targetZ,
                  '#FFFFFF',
                  9,
                  4.5
                );
                fishingState.rippleTimer = 0;
                setFishingPhase('bite');
              }
            } else if (fishingState.phase === 'bite') {
              const plungeY = IslandTerrain.waterLevel - 0.16 + Math.sin(gameElapsed * 30) * 0.09;
              const jx = fishingState.targetX + Math.sin(gameElapsed * 24) * 0.16;
              const jz = fishingState.targetZ + Math.cos(gameElapsed * 21) * 0.16;
              bobberGroup.position.set(jx, plungeY, jz);
              bobberGroup.rotation.z = Math.sin(gameElapsed * 34) * 0.55;
              // Line snaps taut during bite!
              updateFishingLine(
                _rodTipWorld.x,
                _rodTipWorld.y,
                _rodTipWorld.z,
                jx,
                plungeY + 0.08,
                jz,
                0.06
              );
              fishingState.rippleTimer += dt;
              if (fishingState.rippleTimer >= 0.26) {
                fishingState.rippleTimer = 0;
                spawnWaterRipple(jx, jz, 3.1, 0.72);
              }
              if (fishingState.timer >= 3.0) {
                cancelFishing('The fish got away! Cast again.');
              }
            } else if (fishingState.phase === 'reeling') {
              const p = Math.min(1, fishingState.timer / 0.78);
              const fx = THREE.MathUtils.lerp(fishingState.startX, heroX + Math.sin(heroYaw) * 0.5, p);
              const fz = THREE.MathUtils.lerp(fishingState.startZ, heroZ + Math.cos(heroYaw) * 0.5, p);
              const fy =
                THREE.MathUtils.lerp(IslandTerrain.waterLevel, heroY + 1.15, p) +
                Math.sin(p * Math.PI) * 3.1;
              leapingFishMesh.position.set(fx, fy, fz);
              leapingFishMesh.rotation.y = Math.atan2(heroX - fx, heroZ - fz) + Math.sin(p * 30) * 0.45;
              leapingFishMesh.rotation.x = (p - 0.5) * 1.4;
              updateFishingLine(_rodTipWorld.x, _rodTipWorld.y, _rodTipWorld.z, fx, fy, fz, 0.08);
              if (p >= 1) {
                wearHeldDurability(2);
                addItemToBag('raw_fish', 1, false);
                AudioEngine.playSound('chime');
                spawnCombatSparks(heroX, heroY + 1.25, heroZ, '#7DD3FC', 10, 5.2);
                cancelFishing('Caught a Fresh River Trout! Added to Satchel.');
              }
            }
          }

          // Update expanding concentric water ripples
          for (let i = dynamicRipples.length - 1; i >= 0; i--) {
            const rp = dynamicRipples[i];
            rp.age += dt;
            if (rp.age >= rp.maxAge) {
              scene.remove(rp.mesh);
              rp.mat.dispose();
              dynamicRipples.splice(i, 1);
              continue;
            }
            const t = rp.age / rp.maxAge;
            rp.mesh.scale.setScalar(0.65 + t * rp.maxScale);
            rp.mat.opacity = (1 - t) * (1 - t) * 0.82;
          }

          // Update dynamically dropped pickupable items (Wood Logs, baddie loot)
          for (let i = droppedPickups.length - 1; i >= 0; i--) {
            const dp = droppedPickups[i];
            if (dp.collected) continue;
            dp.pickupDelay = Math.max(0, dp.pickupDelay - dt);
            const gy = sampleLevelHeight(activeLevel, dp.x, dp.z);
            if (dp.y > gy + 0.02 || dp.vy !== 0) {
              dp.vy -= 18 * dt;
              dp.x += dp.vx * dt;
              dp.z += dp.vz * dt;
              dp.y += dp.vy * dt;
              dp.vx = THREE.MathUtils.damp(dp.vx, 0, 5.5, dt);
              dp.vz = THREE.MathUtils.damp(dp.vz, 0, 5.5, dt);
              if (dp.y <= gy) {
                dp.y = gy;
                dp.vy = 0;
                dp.vx = 0;
                dp.vz = 0;
              }
            }
            dp.mesh.position.set(dp.x, dp.y, dp.z);
            const dHero = Math.hypot(dp.x - heroX, dp.z - heroZ);
            if (dp.pickupDelay <= 0 && dHero < 1.55) {
              dp.collected = true;
              scene.remove(dp.mesh);
              disposeObject3D(dp.mesh);
              droppedPickups.splice(i, 1);
              addItemToBag(dp.itemId, dp.qty, false);
              const def = itemByIdRef.current.get(dp.itemId);
              AudioEngine.playSound(activeLevel.audio.coin);
              showToast(`Picked up ${dp.qty > 1 ? `${dp.qty}× ` : ''}${def?.name ?? 'Item'}!`);
            }
          }

          // Misfit Power Runtime Helpers & Simulation
          const unlockPowerRuntime = (ability: MisfitAbilityId, sourceName?: string) => {
            const meta = MisfitAbilityById[ability];
            if (!meta) return;
            const list = unlockedPowersRef.current;
            const isNew = !list.includes(ability);
            const nextList = isNew ? [...list, ability] : list;
            if (isNew) {
              unlockedPowersRef.current = nextList;
              setUnlockedPowers(nextList);
            }
            activePowerRef.current = ability;
            setActivePower(ability);
            AudioEngine.playSound('sparkle');
            spawnCombatSparks(heroX, heroY + 1.35, heroZ, meta.colorHex, 14, 6.2);
            showToast(
              isNew
                ? `${sourceName ? `${sourceName} unlocked ` : 'Unlocked '}${meta.title} (${meta.flawLabel} -> ${meta.strengthLabel})! Press Q`
                : `Switched to ${meta.title}!`
            );
          };

          const solveMisfitPuzzle = (rt: RuntimeEntity) => {
            if (rt.opened) return;
            rt.opened = true;
            coins += 5;
            if (rt.pickupable && rt.pickupItemId) {
              addItemToBag(rt.pickupItemId, rt.pickupQty, false);
            }
            if (rt.puzzleFlag?.trim()) {
              gameFlags.add(rt.puzzleFlag.trim());
            }
            recentSolvedPuzzleIds.add(rt.id);
            puzzlesSolvedCount += 1;
            setStoryStats({ puzzlesSolved: puzzlesSolvedCount, crittersWarmed: crittersWarmedCount });
            const py = sampleLevelHeight(activeLevel, rt.x, rt.z);
            const accent = rt.puzzleRequires ? MisfitAbilityById[rt.puzzleRequires].colorHex : '#FACC15';
            spawnCombatSparks(rt.x, py + 1.1, rt.z, accent, 18, 7.2);
            AudioEngine.playSound('sparkle');
            AudioEngine.playSound('chime');
            rt.mesh.traverse((child) => {
              if (child.userData?.puzzleCore) {
                child.visible = false;
              }
            });
            if (rt.puzzleRequires === 'skunkScent') {
              rt.mesh.scale.multiplyScalar(0.55);
            }
            showToast(rt.puzzleRewardText?.trim() || `${rt.name} solved! (+5 Coins)`);
            if (
              activeLevel.gameplayMode === 'rpg' &&
              (activeLevel.rpgConfig?.lootMode === 'fannedCards' ||
                activeLevel.rpgConfig?.lootMode === 'both' ||
                !activeLevel.rpgConfig)
            ) {
              openRpgCardModalRef.current(`Puzzle Solved: ${rt.name}`);
            }
          };

          const spawnRevealBeacon = (bx: number, bz: number, colorHex: string, duration = 6.0) => {
            const by = sampleLevelHeight(activeLevel, bx, bz);
            const bMat = new THREE.MeshBasicMaterial({
              color: colorHex,
              transparent: true,
              opacity: 0.42,
              side: THREE.DoubleSide,
              depthWrite: false,
              blending: THREE.AdditiveBlending,
            });
            const beam = new THREE.Mesh(revealBeaconGeo, bMat);
            beam.position.set(bx, by + 5.5, bz);
            scene.add(beam);
            revealBeacons.push({ mesh: beam, mat: bMat, life: duration, maxLife: duration });
          };

          // Cancel Vulture High Sight early on Q/Space
          if (inp.vultureExitQueued) {
            inp.vultureExitQueued = false;
            if (vultureAerialTimer > 0) {
              vultureAerialTimer = 0;
              setVultureLookoutActive(false);
              showToast('Returned to trail view.');
            }
          }
          if (vultureAerialTimer > 0) {
            vultureAerialTimer = Math.max(0, vultureAerialTimer - dt);
            if (vultureAerialTimer === 0) {
              setVultureLookoutActive(false);
            }
          }

          // Trigger Active Misfit Power [Q]
          if (inp.misfitPowerQueued) {
            inp.misfitPowerQueued = false;
            const abilityId = activePowerRef.current;
            if (abilityId && !cutawayHeroLockRef.current && !isDriving) {
              const meta = MisfitAbilityById[abilityId];
              if (gameElapsed < powerCooldownUntil[abilityId]) {
                const rem = (powerCooldownUntil[abilityId] - gameElapsed).toFixed(1);
                showToast(`${meta.title} recharging (${rem}s)...`);
              } else {
                powerCooldownUntil[abilityId] = gameElapsed + meta.cooldownSec;
                setCoolingPowerId(abilityId);
                window.setTimeout(() => {
                  setCoolingPowerId((cur) => (cur === abilityId ? null : cur));
                }, Math.round(meta.cooldownSec * 1000));
                recentMisfitUsed = abilityId;

                if (abilityId === 'skunkScent') {
                  AudioEngine.playSound('sparkle');
                  for (let i = 0; i < 14; i++) {
                    const ang = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
                    const puffColor = i % 2 === 0 ? '#A3E635' : '#C084FC';
                    const pMat = new THREE.MeshBasicMaterial({
                      color: puffColor,
                      transparent: true,
                      opacity: 0.72,
                      depthWrite: false,
                    });
                    const puff = new THREE.Mesh(scentPuffGeo, pMat);
                    puff.position.set(heroX, heroY + 0.75, heroZ);
                    scene.add(puff);
                    const spd = 2.6 + Math.random() * 3.4;
                    scentPuffs.push({
                      mesh: puff,
                      mat: pMat,
                      vx: Math.cos(ang) * spd,
                      vy: 0.7 + Math.random() * 1.4,
                      vz: Math.sin(ang) * spd,
                      life: 0.95,
                      maxLife: 0.95,
                      maxScale: 2.3 + Math.random() * 0.9,
                    });
                  }
                  let calmedCount = 0;
                  for (const rt of runtimeEntities) {
                    if (!rt.alive) continue;
                    const d = Math.hypot(rt.x - heroX, rt.z - heroZ);
                    if (rt.kind === 'baddie' && rt.aiState !== 'dying' && d <= 6.2) {
                      const pushLen = Math.max(0.1, d);
                      rt.vx = ((rt.x - heroX) / pushLen) * 9.5;
                      rt.vz = ((rt.z - heroZ) / pushLen) * 9.5;
                      rt.vy = 2.8;
                      rt.aiState = 'stagger';
                      rt.stateTimer = 2.2;
                      rt.hitFlashTimer = 0.25;
                      calmedCount++;
                    } else if (rt.kind === 'puzzle' && !rt.opened && rt.puzzleRequires === 'skunkScent' && d <= 6.4) {
                      solveMisfitPuzzle(rt);
                    }
                  }
                  if (calmedCount > 0) {
                    showToast(`Skunk Scent shooed ${calmedCount} grumpy pest${calmedCount > 1 ? 's' : ''}!`);
                  }
                } else if (abilityId === 'porcupineQuills') {
                  AudioEngine.playSound('hit');
                  const quillBodyMat = new THREE.MeshStandardMaterial({ color: '#3F2D21', roughness: 0.6 });
                  const quillTipMat = new THREE.MeshStandardMaterial({
                    color: '#F5E6C8',
                    emissive: '#F59E0B',
                    emissiveIntensity: 0.55,
                    roughness: 0.4,
                  });
                  for (const spread of [-0.16, 0, 0.16]) {
                    const qYaw = heroYaw + spread;
                    const qGroup = new THREE.Group();
                    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 0.55, 6), quillBodyMat);
                    shaft.rotation.x = Math.PI / 2;
                    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.28, 6), quillTipMat);
                    tip.rotation.x = Math.PI / 2;
                    tip.position.z = 0.36;
                    qGroup.add(shaft, tip);
                    qGroup.position.set(heroX + Math.sin(qYaw) * 0.7, heroY + 1.15, heroZ + Math.cos(qYaw) * 0.7);
                    qGroup.rotation.y = qYaw;
                    scene.add(qGroup);
                    quillProjectiles.push({
                      mesh: qGroup,
                      vx: Math.sin(qYaw) * 22,
                      vz: Math.cos(qYaw) * 22,
                      life: 0.88,
                    });
                  }
                } else if (abilityId === 'moleSonar') {
                  AudioEngine.playSound('chime');
                  for (let ringIdx = 0; ringIdx < 3; ringIdx++) {
                    const rMat = new THREE.MeshBasicMaterial({
                      color: ringIdx === 1 ? '#FACC15' : '#38BDF8',
                      transparent: true,
                      opacity: 0.85,
                      side: THREE.DoubleSide,
                      depthWrite: false,
                    });
                    const rMesh = new THREE.Mesh(sonarRingGeo, rMat);
                    rMesh.position.set(heroX, heroY + 0.14 + ringIdx * 0.05, heroZ);
                    scene.add(rMesh);
                    sonarRings.push({
                      mesh: rMesh,
                      mat: rMat,
                      age: -ringIdx * 0.16,
                      maxAge: 1.35,
                      maxScale: 24,
                    });
                  }
                  let revealed = 0;
                  for (const rt of runtimeEntities) {
                    if (!rt.alive) continue;
                    const d = Math.hypot(rt.x - heroX, rt.z - heroZ);
                    if (rt.kind === 'puzzle' && !rt.opened && rt.puzzleRequires === 'moleSonar' && d <= 14.5) {
                      solveMisfitPuzzle(rt);
                    } else if (
                      d <= 56 &&
                      ((rt.isBuddy && !rt.recruited) ||
                        (rt.kind === 'treasure' && !rt.opened) ||
                        (rt.kind === 'key') ||
                        (rt.kind === 'puzzle' && !rt.opened))
                    ) {
                      spawnRevealBeacon(rt.x, rt.z, rt.isBuddy ? '#FACC15' : '#38BDF8', 6.5);
                      revealed++;
                    }
                  }
                  if (revealed > 0) {
                    showToast(`Ear Sonar echoed ${revealed} hidden secret${revealed > 1 ? 's' : ''}!`);
                  }
                } else if (abilityId === 'vultureSight') {
                  AudioEngine.playSound('sparkle');
                  vultureAerialTimer = 5.5;
                  setVultureLookoutActive(true);
                  let sighted = 0;
                  for (const rt of runtimeEntities) {
                    if (!rt.alive) continue;
                    const d = Math.hypot(rt.x - heroX, rt.z - heroZ);
                    if (rt.kind === 'puzzle' && !rt.opened && rt.puzzleRequires === 'vultureSight' && d <= 26) {
                      solveMisfitPuzzle(rt);
                    } else if ((rt.isBuddy && !rt.recruited) || rt.propPreset === 'tavern') {
                      spawnRevealBeacon(rt.x, rt.z, rt.isBuddy ? '#FACC15' : '#C084FC', 6.2);
                      sighted++;
                    }
                  }
                  if (activeLevel.hasPortal) {
                    spawnRevealBeacon(portalX, portalZ, '#C084FC', 6.2);
                  }
                  showToast(
                    sighted > 0
                      ? `High Sight spotted ${sighted} landmark${sighted > 1 ? 's' : ''}! Press Q or Space to land.`
                      : 'High Sight soaring! Press Q or Space to land.'
                  );
                }
              }
            }
          }

          // Update Skunk Scent puffs
          for (let i = scentPuffs.length - 1; i >= 0; i--) {
            const p = scentPuffs[i];
            p.life -= dt;
            if (p.life <= 0) {
              scene.remove(p.mesh);
              p.mat.dispose();
              scentPuffs.splice(i, 1);
              continue;
            }
            const t = 1 - p.life / p.maxLife;
            p.mesh.position.x += p.vx * dt;
            p.mesh.position.y += p.vy * dt;
            p.mesh.position.z += p.vz * dt;
            p.vx *= 1 - Math.min(0.6, dt * 1.9);
            p.vz *= 1 - Math.min(0.6, dt * 1.9);
            p.mesh.scale.setScalar(0.55 + t * p.maxScale);
            p.mat.opacity = (1 - t) * 0.65;
          }

          // Update Porcupine Quill projectiles
          for (let i = quillProjectiles.length - 1; i >= 0; i--) {
            const q = quillProjectiles[i];
            q.life -= dt;
            q.mesh.position.x += q.vx * dt;
            q.mesh.position.z += q.vz * dt;
            let hit = false;
            for (const rt of runtimeEntities) {
              if (!rt.alive) continue;
              if (rt.kind === 'puzzle' && !rt.opened && rt.puzzleRequires === 'porcupineQuills') {
                if (Math.hypot(rt.x - q.mesh.position.x, rt.z - q.mesh.position.z) <= 1.85) {
                  solveMisfitPuzzle(rt);
                  hit = true;
                  break;
                }
              } else if (rt.kind === 'baddie' && rt.aiState !== 'dying') {
                if (Math.hypot(rt.x - q.mesh.position.x, rt.z - q.mesh.position.z) <= 1.35) {
                  hit = true;
                  rt.health -= 1;
                  AudioEngine.playSound(activeLevel.audio.hit);
                  const ql = Math.max(0.1, Math.hypot(q.vx, q.vz));
                  rt.vx = (q.vx / ql) * 8.5;
                  rt.vz = (q.vz / ql) * 8.5;
                  rt.vy = 2.8;
                  rt.hitFlashTimer = 0.2;
                  rt.recoilPitch = -0.45;
                  spawnCombatSparks(q.mesh.position.x, q.mesh.position.y, q.mesh.position.z, '#F59E0B', 7, 6.2);
                  if (rt.health <= 0) {
                    beginBaddieDeath(rt, q.vx / ql, q.vz / ql);
                  } else {
                    rt.aiState = 'stagger';
                    rt.stateTimer = 0.45;
                  }
                  break;
                }
              }
            }
            if (hit || q.life <= 0) {
              scene.remove(q.mesh);
              disposeObject3D(q.mesh);
              quillProjectiles.splice(i, 1);
            }
          }

          // Update Mole Sonar expanding echo rings & Sky/Sonar reveal beacons
          for (let i = sonarRings.length - 1; i >= 0; i--) {
            const sr = sonarRings[i];
            sr.age += dt;
            if (sr.age < 0) {
              sr.mesh.visible = false;
              continue;
            }
            if (sr.age >= sr.maxAge) {
              scene.remove(sr.mesh);
              sr.mat.dispose();
              sonarRings.splice(i, 1);
              continue;
            }
            sr.mesh.visible = true;
            const t = sr.age / sr.maxAge;
            sr.mesh.scale.setScalar(0.8 + t * sr.maxScale);
            sr.mat.opacity = (1 - t) * (1 - t) * 0.85;
          }
          for (let i = revealBeacons.length - 1; i >= 0; i--) {
            const rb = revealBeacons[i];
            rb.life -= dt;
            if (rb.life <= 0) {
              scene.remove(rb.mesh);
              rb.mat.dispose();
              revealBeacons.splice(i, 1);
              continue;
            }
            const fade = Math.min(1, rb.life / 1.1);
            rb.mat.opacity = fade * (0.32 + Math.sin(gameElapsed * 5.2 + i) * 0.12);
          }

          // Update Baby Duckling companion trail follow & gentle waddle
          if (ducklingMesh) {
            const duckIdx = Math.max(0, heroTrail.length - 3);
            const anchor = heroTrail[duckIdx] ?? { x: heroX, z: heroZ };
            const duckGoalX = anchor.x - Math.sin(heroYaw) * 0.95 + Math.cos(heroYaw) * 0.72;
            const duckGoalZ = anchor.z - Math.cos(heroYaw) * 0.95 - Math.sin(heroYaw) * 0.72;
            const dxD = duckGoalX - duckX;
            const dzD = duckGoalZ - duckZ;
            const dD = Math.hypot(dxD, dzD);
            let duckMoving = false;
            if (dD > 0.42) {
              const spdD = Math.min(dD, (isRunning ? 8.8 : 6.2) * dt);
              const nxD = duckX + (dxD / dD) * spdD;
              const nzD = duckZ + (dzD / dD) * spdD;
              const [rxD, rzD] = resolveHorizontalCollision(activeLevel, nxD, nzD, 0.35, true, collisionCtx);
              duckX = rxD;
              duckZ = rzD;
              const goalYaw = Math.atan2(dxD, dzD);
              const yd = Math.atan2(Math.sin(goalYaw - duckYaw), Math.cos(goalYaw - duckYaw));
              duckYaw += yd * Math.min(1, dt * 10);
              duckMoving = true;
            } else {
              const yd = Math.atan2(Math.sin(heroYaw - duckYaw), Math.cos(heroYaw - duckYaw));
              duckYaw += yd * Math.min(1, dt * 5);
            }
            const duckHopY = duckMoving
              ? Math.abs(Math.sin(gameElapsed * 12)) * 0.09
              : tavernCelebrated
              ? Math.abs(Math.sin(gameElapsed * 9)) * 0.24
              : 0;
            const duckFloorY = sampleLevelHeight(activeLevel, duckX, duckZ);
            ducklingMesh.position.set(duckX, duckFloorY + duckHopY, duckZ);
            ducklingMesh.rotation.y = duckYaw;
            ducklingMesh.rotation.z = duckMoving ? Math.sin(gameElapsed * 12) * 0.09 : 0;
            animateCreatureRig(
              ducklingMesh.userData.creatureAnim as CreatureAnimRefs | undefined,
              gameElapsed * 1.2,
              duckMoving,
              1.35,
              tavernCelebrated
            );
            duckPeepCooldown -= dt;
            if (
              duckPeepCooldown <= 0 &&
              !activeCutaway &&
              !activeSpeechesRef.current.some((s) => s.key === 'duckling')
            ) {
              duckPeepCooldown = 14 + Math.random() * 8;
              const nearestBuddy = buddyEntities.find((b) => b.alive && !b.recruited);
              const peepLine = nearestBuddy
                ? `Peep! (${nearestBuddy.buddyAreaLabel || 'Adventure ahead!'})`
                : 'Peep! Peep!';
              pushCharacterSpeech(
                {
                  key: 'duckling',
                  entityId: 'duckling',
                  speaker: 'Duckling',
                  roleLabel: 'Companion',
                  kind: 'npc',
                  lines: [peepLine],
                  lineIndex: 0,
                  style: heroChatStyleRef.current,
                  isProximity: false,
                  expiresAt: performance.now() + 2600,
                },
                false,
                false
              );
            }
          }

          // Bow & Arrow shot (RPG mode Key 2 / Key R)
          if (inp.arrowQueued) {
            inp.arrowQueued = false;
            let aimYaw = heroYaw;
            let bestTarget: RuntimeEntity | null = null;
            let bestDist = 14.5;
            for (const rt of runtimeEntities) {
              if (!rt.alive || rt.kind !== 'baddie' || rt.aiState === 'dying') continue;
              const d = Math.hypot(rt.x - heroX, rt.z - heroZ);
              if (d < bestDist) {
                bestDist = d;
                bestTarget = rt;
              }
            }
            if (bestTarget) {
              aimYaw = Math.atan2(bestTarget.x - heroX, bestTarget.z - heroZ);
              heroYaw = aimYaw;
            }
            AudioEngine.playSound('jump');
            const arrowMesh = buildRpgArrowProjectileMesh(aimYaw);
            arrowMesh.position.set(
              heroX + Math.sin(aimYaw) * 0.65,
              heroY + 1.05,
              heroZ + Math.cos(aimYaw) * 0.65
            );
            scene.add(arrowMesh);
            bolts.push({
              mesh: arrowMesh,
              vx: Math.sin(aimYaw) * 23,
              vz: Math.cos(aimYaw) * 23,
              life: 1.35,
              isArrow: true,
            });
            spawnCombatSparks(
              arrowMesh.position.x,
              arrowMesh.position.y,
              arrowMesh.position.z,
              '#34D399',
              6,
              4.2
            );
          }

          // Magic bolt & RPG Arcane Lightning Zap
          if (inp.magicQueued) {
            inp.magicQueued = false;
            const magicCost = activeLevel.gameplayMode === 'rpg' ? 15 : 20;
            if ((enabledSet.has('magicBolt') || activeLevel.gameplayMode === 'rpg') && magic >= magicCost) {
              magic -= magicCost;
              AudioEngine.playSound('sparkle');

              let aimYaw = heroYaw;
              let zapTarget: RuntimeEntity | null = null;
              let bestZapDist = 11.5;
              for (const rt of runtimeEntities) {
                if (!rt.alive || rt.kind !== 'baddie' || rt.aiState === 'dying') continue;
                const d = Math.hypot(rt.x - heroX, rt.z - heroZ);
                if (d < bestZapDist) {
                  bestZapDist = d;
                  zapTarget = rt;
                }
              }

              if (zapTarget && activeLevel.gameplayMode === 'rpg') {
                aimYaw = Math.atan2(zapTarget.x - heroX, zapTarget.z - heroZ);
                heroYaw = aimYaw;
                const targetY =
                  Math.max(-0.5, sampleLevelHeight(activeLevel, zapTarget.x, zapTarget.z)) +
                  zapTarget.flightY +
                  1.0;
                spawnRpgMagicZapBeam(
                  scene,
                  rpgVisualFx,
                  heroX,
                  heroY + 1.2,
                  heroZ,
                  zapTarget.x,
                  targetY,
                  zapTarget.z,
                  '#A855F7'
                );
                const zapDmg = Math.max(
                  6,
                  Math.round(heroAttackDamage + rpgStatsRef.current.magicBonus)
                );
                zapTarget.health -= zapDmg;
                zapTarget.hitFlashTimer = 0.24;
                zapTarget.recoilPitch = -0.62;
                const znx = Math.sin(aimYaw);
                const znz = Math.cos(aimYaw);
                zapTarget.vx = znx * 8.5;
                zapTarget.vz = znz * 8.5;
                zapTarget.vy = 3.2;
                spawnCombatSparks(zapTarget.x, targetY, zapTarget.z, '#C084FC', 14, 7.8);
                spawnEvaporatingDamageNumber(
                  scene,
                  evaporatingDamages,
                  zapTarget.x,
                  targetY + (zapTarget.isBoss ? 1.55 : 1.05),
                  zapTarget.z,
                  `-${zapDmg}`,
                  '#C084FC',
                  'MAGIC ZAP!'
                );
                if (zapTarget.health <= 0) {
                  beginBaddieDeath(zapTarget, znx, znz);
                } else {
                  zapTarget.aiState = 'stagger';
                  zapTarget.stateTimer = 0.45;
                }
              } else {
                const boltMesh = new THREE.Mesh(
                  new THREE.SphereGeometry(0.24, 10, 10),
                  new THREE.MeshStandardMaterial({
                    color: '#3AA0FF',
                    emissive: '#7C5CFF',
                    emissiveIntensity: 1.4,
                  })
                );
                boltMesh.position.set(heroX, heroY + 1.0, heroZ);
                scene.add(boltMesh);
                bolts.push({
                  mesh: boltMesh,
                  vx: Math.sin(aimYaw) * 16,
                  vz: Math.cos(aimYaw) * 16,
                  life: 1.5,
                });
              }
            } else if (activeLevel.gameplayMode === 'rpg' && magic < magicCost) {
              showToast('Low Arcane Mana! Drink a Potion or Herb (Key 4 / H).');
            }
          }

          // Heal spell / RPG Health Potion & Wild Healing Herb
          if (inp.healQueued) {
            inp.healQueued = false;
            if (activeLevel.gameplayMode === 'rpg') {
              const curRpg = rpgStatsRef.current;
              if (curRpg.potions > 0) {
                setRpgStats((prev) => ({ ...prev, potions: Math.max(0, prev.potions - 1) }));
                health = Math.min(maxHealth, health + 3);
                magic = Math.min(100, magic + 40);
                AudioEngine.playSound('sparkle');
                spawnCombatSparks(heroX, heroY + 1.1, heroZ, '#10B981', 14, 6.2);
                spawnEvaporatingDamageNumber(
                  scene,
                  evaporatingDamages,
                  heroX,
                  heroY + 2.0,
                  heroZ,
                  '+3 HP · +40 MP',
                  '#34D399',
                  'HEALTH POTION'
                );
                showToast('Drank Health Potion (+3 HP, +40 Mana)!');
              } else if (curRpg.herbs > 0) {
                setRpgStats((prev) => ({ ...prev, herbs: Math.max(0, prev.herbs - 1) }));
                health = Math.min(maxHealth, health + 2);
                magic = Math.min(100, magic + 25);
                AudioEngine.playSound('sparkle');
                spawnCombatSparks(heroX, heroY + 1.1, heroZ, '#34D399', 12, 5.5);
                spawnEvaporatingDamageNumber(
                  scene,
                  evaporatingDamages,
                  heroX,
                  heroY + 2.0,
                  heroZ,
                  '+2 HP · +25 MP',
                  '#A7F3D0',
                  'HEALING HERB'
                );
                showToast('Used Wild Healing Herb (+2 HP, +25 Mana)!');
              } else if (magic >= 25 && health < maxHealth) {
                magic -= 25;
                health = Math.min(maxHealth, health + 2);
                AudioEngine.playSound('sparkle');
                showToast('Cast Heal Spell (+2 HP)!');
              } else {
                showToast('No Potions or Healing Herbs remaining!');
              }
            } else if (enabledSet.has('heal') && magic >= 25 && health < maxHealth) {
              magic -= 25;
              health = Math.min(maxHealth, health + 2);
              AudioEngine.playSound('sparkle');
              showToast('Healed +2 health!');
            }
          }

          // Update bolts & feathered arrows
          for (let i = bolts.length - 1; i >= 0; i--) {
            const b = bolts[i];
            b.life -= dt;
            b.mesh.position.x += b.vx * dt;
            b.mesh.position.z += b.vz * dt;
            let hit = false;
            for (const rt of runtimeEntities) {
              if (!rt.alive || rt.kind !== 'baddie' || rt.aiState === 'dying') continue;
              if (Math.hypot(rt.x - b.mesh.position.x, rt.z - b.mesh.position.z) < 1.3) {
                hit = true;
                const boltTargetDesc: EnemyTargetDescriptors = {
                  isBoss: rt.isBoss,
                  isFlying: Boolean(rt.quadrupedRig?.canFly || rt.baddieRig?.isFlyer || rt.flightY > 0.35),
                  isBeast: Boolean(rt.quadrupedRig),
                  isElemental:
                    rt.monsterAbility === 'flameBody' ||
                    rt.monsterAbility === 'staticShell' ||
                    Boolean(
                      rt.baddieAI &&
                        [
                          rt.baddieAI.primaryAction,
                          rt.baddieAI.secondaryAction,
                        ].some((act) =>
                          ['fireBreath', 'iceBreath', 'electricShock', 'poisonSpit', 'waterJet', 'shadowBeam', 'solarBeam'].includes(
                            act
                          )
                        )
                    ),
                  isHeavyBrute: rt.maxHealth >= 8 || rt.monsterAbility === 'thickFat',
                };
                const baseBoltPower = b.isArrow
                  ? heroAttackDamage +
                    (activeLevel.gameplayMode === 'rpg' ? rpgStatsRef.current.atkBonus : 0)
                  : heroProfile.stats.magicPower +
                    (relicMods?.magicBoltBonus ?? 0) +
                    (activeLevel.gameplayMode === 'rpg' ? rpgStatsRef.current.magicBonus : 0);
                const boltOut = computeHeroOutgoingDamage(
                  baseBoltPower,
                  heroProfile,
                  boltTargetDesc
                );
                const appliedDmg = b.isArrow ? Math.max(4, boltOut.damage) : boltOut.damage;
                rt.health -= appliedDmg;
                AudioEngine.playSound(activeLevel.audio.hit);
                const bLen = Math.max(0.1, Math.hypot(b.vx, b.vz));
                const bnx = b.vx / bLen;
                const bnz = b.vz / bLen;
                rt.vx = bnx * 10.5;
                rt.vz = bnz * 10.5;
                rt.vy = 3.6;
                rt.hitFlashTimer = 0.2;
                rt.recoilPitch = -0.58;
                spawnCombatSparks(
                  b.mesh.position.x,
                  b.mesh.position.y,
                  b.mesh.position.z,
                  b.isArrow ? '#34D399' : '#7CCBFF',
                  10,
                  7.2
                );
                spawnEvaporatingDamageNumber(
                  scene,
                  evaporatingDamages,
                  rt.x,
                  b.mesh.position.y + (rt.isBoss ? 1.45 : 0.95),
                  rt.z,
                  `-${appliedDmg}`,
                  b.isArrow ? '#34D399' : '#38BDF8',
                  b.isArrow ? 'ARROW SHOT!' : 'ARCANE BOLT!'
                );
                if (rt.health <= 0) {
                  beginBaddieDeath(rt, bnx, bnz);
                } else {
                  rt.aiState = 'stagger';
                  rt.stateTimer = 0.4;
                }
                break;
              }
            }
            if (hit || b.life <= 0) {
              scene.remove(b.mesh);
              disposeObject3D(b.mesh);
              bolts.splice(i, 1);
            }
          }

          // Update evaporating overhead enemy HP numbers & colorful RPG fight FX
          updateEvaporatingDamageNumbers(scene, evaporatingDamages, camera, dt);
          updateRpgVisualFx(scene, rpgVisualFx, dt);

          // Update 3D combat impact sparks (zero-allocation pooled meshes)
          for (let i = 0; i < combatSparks.length; i++) {
            const sp = combatSparks[i];
            if (!sp.active) continue;
            sp.life -= dt;
            if (sp.life <= 0) {
              sp.active = false;
              sp.mat.opacity = 0;
              sp.mesh.scale.setScalar(0.0001);
              sp.mesh.position.set(0, -500, 0);
              continue;
            }
            sp.vy -= 16 * dt;
            sp.mesh.position.x += sp.vx * dt;
            sp.mesh.position.y += sp.vy * dt;
            sp.mesh.position.z += sp.vz * dt;
            sp.mesh.rotation.x += dt * 11;
            sp.mesh.rotation.y += dt * 9;
            const frac = sp.life / sp.maxLife;
            sp.mesh.scale.setScalar(Math.max(0.01, frac * 1.15));
            sp.mat.opacity = frac;
          }

          // Interact action (also reels/casts fishing pole if holding it and no NPC/door nearby)
          const didInteract = inp.interactQueued;
          inp.interactQueued = false;
          let interactConsumed = false;

          // Update carried rock/boulder + orange bullseye, thrown rock flight & impact physics, and 3D debris
          if (worldInteract && !isDriving) {
            const isHeroMovingInput =
              inp.keys.has('KeyW') ||
              inp.keys.has('KeyA') ||
              inp.keys.has('KeyS') ||
              inp.keys.has('KeyD') ||
              inp.keys.has('ArrowUp') ||
              inp.keys.has('ArrowDown') ||
              inp.keys.has('ArrowLeft') ||
              inp.keys.has('ArrowRight') ||
              Math.hypot(inp.joyX, inp.joyY) > 0.12;
            if (worldInteract.carriedRock && !isHeroMovingInput) {
              // Gently align hero facing toward where the orange bullseye is aimed
              const aimYaw = Math.atan2(worldInteract.aimX - heroX, worldInteract.aimZ - heroZ);
              const yawDiff = Math.atan2(Math.sin(aimYaw - heroYaw), Math.cos(aimYaw - heroYaw));
              heroYaw += yawDiff * Math.min(1, dt * 8);
            }
            worldInteract.updateCarriedAndAim(dt, gameElapsed, heroX, heroY, heroZ, heroYaw);

            // Populate zero-GC enemy target list for thrown rocks & boulders
            rockTargetBuffer.length = 0;
            for (const rt of runtimeEntities) {
              if (!rt.alive || rt.kind !== 'baddie' || rt.aiState === 'dying') continue;
              rockTargetBuffer.push({
                id: rt.id,
                x: rt.x,
                y: sampleLevelHeight(activeLevel, rt.x, rt.z) + rt.yOffset + rt.flightY,
                z: rt.z,
                radius: rt.isBoss ? 1.15 : 0.72,
                isBoss: rt.isBoss,
              });
            }

            const throwCallbacks: WorldInteractivityCallbacks = {
              onRockHitEnemy: (enemyId, kind, dirX, dirZ, impactX, impactY, impactZ) => {
                const rt = runtimeEntities.find((e) => e.id === enemyId);
                if (!rt || !rt.alive || rt.aiState === 'dying') return;
                const dmg = kind === 'boulder' ? Math.max(3, heroAttackDamage + 2) : Math.max(2, heroAttackDamage);
                rt.health -= dmg;
                AudioEngine.playSound(activeLevel.audio.hit);

                // Directional rock/boulder knockback!
                const bFwdX = Math.sin(rt.mesh.rotation.y);
                const bFwdZ = Math.cos(rt.mesh.rotation.y);
                const bRightX = Math.cos(rt.mesh.rotation.y);
                const bRightZ = -Math.sin(rt.mesh.rotation.y);
                const hitFrontDot = dirX * bFwdX + dirZ * bFwdZ;
                const hitSideDot = dirX * bRightX + dirZ * bRightZ;
                const kbForce =
                  (kind === 'boulder' ? (rt.isBoss ? 11.5 : 18.5) : rt.isBoss ? 7.0 : 12.2) *
                  (rt.monsterAbility === 'thickFat' ? 0.65 : 1);
                rt.vx = dirX * kbForce;
                rt.vz = dirZ * kbForce;
                rt.vy = kind === 'boulder' ? (rt.isBoss ? 4.2 : 6.4) : rt.isBoss ? 2.6 : 4.2;
                rt.hitFlashTimer = 0.25;
                rt.recoilPitch = hitFrontDot > 0.35 ? 0.85 : -0.85;
                rt.recoilRoll = hitSideDot > 0 ? -0.62 : 0.62;
                hitStopTimer = kind === 'boulder' ? 0.055 : 0.032;
                shakeTimer = Math.max(shakeTimer, kind === 'boulder' ? 0.26 : 0.14);
                spawnCombatSparks(impactX, impactY, impactZ, kind === 'boulder' ? '#FB923C' : '#FDE047', 12, 7.2);
                spawnEvaporatingDamageNumber(
                  scene,
                  evaporatingDamages,
                  rt.x,
                  impactY + 1.2,
                  rt.z,
                  `-${dmg}`,
                  kind === 'boulder' ? '#F97316' : '#FACC15',
                  kind === 'boulder' ? 'BOULDER SMASH!' : 'STONE HIT!'
                );
                if (rt.health <= 0) {
                  beginBaddieDeath(rt, dirX, dirZ);
                } else if (!(rt.isBoss && rt.aiState === 'strike')) {
                  rt.aiState = 'stagger';
                  rt.stateTimer = kind === 'boulder' ? 0.85 : 0.52;
                  rt.attackCooldown = Math.max(rt.attackCooldown, 0.75);
                }
              },
              onRockImpactGround: (kind, ix, iy, iz) => {
                AudioEngine.playSound(kind === 'boulder' ? 'hit' : 'step');
                if (kind === 'boulder') {
                  shakeTimer = Math.max(shakeTimer, 0.16);
                }
                // Shatter nearby flora on rock/boulder smash!
                const smashR = kind === 'boulder' ? 1.85 : 1.05;
                for (let hi = 0; hi < islandHandles.harvestableScatter.length; hi++) {
                  const hs = islandHandles.harvestableScatter[hi];
                  if (hs.collected || hs.scatterKind === 'rock') continue;
                  if (Math.hypot(hs.x - ix, hs.z - iz) <= smashR) {
                    hs.collected = true;
                    for (const be of hs.batchedEntries) {
                      hideBatchEntry(be, hs.x, hs.y - 60, hs.z);
                    }
                    const th: DebrisTheme =
                      hs.scatterKind === 'berryBush'
                        ? 'berry'
                        : hs.scatterKind === 'flower'
                        ? 'flower'
                        : hs.scatterKind === 'fern' || hs.scatterKind === 'broadleaf'
                        ? 'fern'
                        : 'leaf';
                    worldInteract?.spawnDebrisBurst(hs.x, hs.y + 0.35, hs.z, th, 9, 5.0);
                  }
                }
              },
              onStoneScrape: () => {},
              onPuzzleBlockSolved: () => {},
            };
            worldInteract.updateThrownRocks(simDt, rockTargetBuffer, throwCallbacks, collisionCtx);
            worldInteract.updateDebris(simDt);

            // Priority 1: Throw carried rock/boulder when pressing Use (E)
            if (didInteract && worldInteract.carriedRock) {
              interactConsumed = true;
              const thrown = worldInteract.throwCarriedRock();
              if (thrown) {
                AudioEngine.playSound('whoosh');
                heroYaw = Math.atan2(worldInteract.aimX - heroX, worldInteract.aimZ - heroZ);
                attackAnimTimer = 0.24;
                activeAttackDuration = 0.24;
              }
            }
          }

          // Priority 2: Pick fruit directly from the tree canopy while climbing a fruit tree!
          const canPickTreeFruitNow = Boolean(
            isClimbing &&
              climbKind === 'tree' &&
              climbingTree &&
              !climbingTree.chopped &&
              climbingTree.hasFruit &&
              (climbingTree.fruitCount ?? 0) > 0 &&
              heroY >= climbingTree.y + 1.35
          );
          if (didInteract && !interactConsumed && canPickTreeFruitNow && climbingTree) {
            interactConsumed = true;
            climbingTree.fruitCount = Math.max(0, (climbingTree.fruitCount ?? 1) - 1);
            addItemToBag('orchard_apple', 1, false);
            AudioEngine.playSound('chime');
            worldInteract?.spawnDebrisBurst(heroX, heroY + 1.0, heroZ, 'leaf', 8, 3.8);
            worldInteract?.spawnDebrisBurst(heroX, heroY + 0.9, heroZ, 'berry', 4, 3.2);
            const left = climbingTree.fruitCount;
            showToast(
              `Picked ${climbingTree.fruitLabel || 'Sunlit Orchard Fruit'}!${
                left > 0 ? ` (${left} left in canopy)` : ' (Tree picked clean)'
              }`
            );
          }

          // Pre-check whether hero is right next to an unopened treasure chest or door so companions
          // keep a safe distance and NEVER hijack the Use button!
          let heroNearPriorityChestOrDoor = false;
          let activeChestBlockX = 0;
          let activeChestBlockZ = 0;
          for (const rt of runtimeEntities) {
            if (!rt.alive) continue;
            if (rt.kind === 'treasure' && (!rt.opened || rt.chestLootEntries.length > 0)) {
              if (Math.hypot(rt.x - heroX, rt.z - heroZ) < 3.4) {
                heroNearPriorityChestOrDoor = true;
                activeChestBlockX = rt.x;
                activeChestBlockZ = rt.z;
                break;
              }
            }
            if ((rt.kind === 'door' || rt.mesh.userData?.walkInBuilding) && Math.hypot(rt.x - heroX, rt.z - heroZ) < 3.6) {
              heroNearPriorityChestOrDoor = true;
            }
          }

          // Entity updates & collisions
          const baddiesRemaining = runtimeEntities.some((r) => r.kind === 'baddie' && r.alive);
          let nearestDoorPrompt: { label: string; isOpen: boolean; locked: boolean } | null = null;
          let nearestDoorPromptDist = 999;
          let nearestChestPrompt: {
            label: string;
            isOpen: boolean;
            locked: boolean;
            lockedMessage?: string;
            itemCount: number;
          } | null = null;
          let nearestChestPromptDist = 999;
          let nearInteractableEntity = false;
          heroInsideWalkInBuilding = false;
          insideBuildingCeilingY = 999;

          for (const rt of runtimeEntities) {
            if (!rt.alive) continue;

            const prevRtX = rt.x;
            const prevRtZ = rt.z;
            if (rt.logicAnimTimer > 0) {
              rt.logicAnimTimer = Math.max(0, rt.logicAnimTimer - dt);
              if (rt.logicAnimTimer <= 0) {
                rt.logicAnimName = null;
              }
            }
            rt.mechController?.update(dt);
            if (rt.kind === 'treasure') {
              if (rt.chestAnim) {
                const mechProg =
                  rt.mechController && rt.mechanisms.length > 0
                    ? rt.mechController.getProgress(rt.mechanisms[0].id)
                    : undefined;
                const finishedAnim = updateTreasureChestRig(
                  rt.chestAnim,
                  dt,
                  gameElapsed,
                  rt.chestLootEntries.length > 0,
                  mechProg
                );
                if (finishedAnim && rt.chestOpening) {
                  rt.chestOpening = false;
                  rt.opened = true;
                  if (openingChestId === rt.id) {
                    openingChestId = null;
                  }
                  chestOpeningLockRef.current = false;
                  setIsChestOpeningAnim(false);
                  openChestModalFnRef.current(rt.id, rt.name);
                }
              } else if (rt.chestOpening) {
                rt.chestOpenTimer -= dt;
                if (rt.chestOpenTimer <= 0) {
                  rt.chestOpening = false;
                  rt.opened = true;
                  if (openingChestId === rt.id) {
                    openingChestId = null;
                  }
                  chestOpeningLockRef.current = false;
                  setIsChestOpeningAnim(false);
                  openChestModalFnRef.current(rt.id, rt.name);
                }
              }
            }
            for (let fi = 0; fi < rt.floatSpinMeshes.length; fi++) {
              rt.floatSpinMeshes[fi].rotation.y += dt * 1.8;
            }
            if (rt.torchFlames && rt.torchFlames.length > 0) {
              for (let tf = 0; tf < rt.torchFlames.length; tf++) {
                const item = rt.torchFlames[tf];
                const flick =
                  Math.sin(gameElapsed * 14 + item.phase) * 0.14 +
                  Math.cos(gameElapsed * 23 + item.phase * 1.7) * 0.08;
                item.mesh.scale.set(1 + flick * 0.28, 1 + flick * 0.55, 1 + flick * 0.28);
                item.mesh.position.y = item.baseY + flick * 0.04;
              }
            }
            if (rt.wallTorchLight) {
              rt.wallTorchLight.intensity = 4.3 + Math.sin(gameElapsed * 12 + rt.x * 0.4) * 0.55;
            }
            if (rt.kind === 'door' || rt.buildingBlock?.shape === 'trapdoor') {
              applyDoorOpenAnimation(rt.mesh, rt.opened, dt);
            }
            if (rt.propShakeTimer && rt.propShakeTimer > 0) {
              rt.propShakeTimer = Math.max(0, rt.propShakeTimer - dt);
              const wf = rt.propShakeTimer / 0.22;
              const wob = Math.sin(wf * Math.PI * 4) * wf * 0.16;
              rt.mesh.rotation.x = (rt.propShakeDirZ ?? 0) * wob;
              rt.mesh.rotation.z = -(rt.propShakeDirX ?? 0) * wob;
              if (rt.propShakeTimer <= 0) {
                rt.mesh.rotation.x = 0;
                rt.mesh.rotation.z = 0;
              }
            }
            if (rt.mesh.userData?.wanderingChicken) {
              // Independent per-chicken autonomous AI (walk / peck / idle) with strict fence & world collision!
              if (rt.chickenTimer === undefined || rt.chickenYaw === undefined || rt.chickenMode === undefined) {
                let hash = 2166136261;
                for (let ci = 0; ci < rt.id.length; ci++) {
                  hash = Math.imul(hash ^ rt.id.charCodeAt(ci), 16777619);
                }
                const s1 = ((hash >>> 0) % 1000) / 1000;
                const s2 = (((hash * 13) >>> 0) % 1000) / 1000;
                rt.chickenMode = s1 < 0.45 ? 'walk' : s1 < 0.78 ? 'peck' : 'idle';
                rt.chickenTimer = 0.6 + s2 * 2.4;
                rt.chickenYaw = s1 * Math.PI * 2;
                rt.chickenSpeedVal = 0.72 + s2 * 0.58;
              }
              rt.chickenTimer -= dt;
              if (rt.chickenTimer <= 0) {
                const homeDx = rt.startX - rt.x;
                const homeDz = rt.startZ - rt.z;
                const homeDist = Math.hypot(homeDx, homeDz);
                const r = Math.random();
                if (homeDist > 1.85) {
                  rt.chickenMode = 'walk';
                  rt.chickenYaw = Math.atan2(homeDx, homeDz) + (Math.random() - 0.5) * 0.85;
                  rt.chickenTimer = 1.2 + Math.random() * 1.4;
                } else if (r < 0.52) {
                  rt.chickenMode = 'walk';
                  rt.chickenYaw = rt.chickenYaw + (Math.random() - 0.5) * 2.8;
                  rt.chickenTimer = 1.1 + Math.random() * 2.1;
                } else if (r < 0.84) {
                  rt.chickenMode = 'peck';
                  rt.chickenTimer = 0.8 + Math.random() * 1.5;
                } else {
                  rt.chickenMode = 'idle';
                  rt.chickenTimer = 0.7 + Math.random() * 1.4;
                }
              }

              let hopC = 0;
              let peckPitch = 0;
              if (rt.chickenMode === 'walk') {
                const spdC = rt.chickenSpeedVal ?? 0.95;
                const stepC = spdC * dt;
                const candX = rt.x + Math.sin(rt.chickenYaw) * stepC;
                const candZ = rt.z + Math.cos(rt.chickenYaw) * stepC;
                // Strictly respect fences, coops, buildings, water, and pen boundary!
                const [colX, colZ] = resolveHorizontalCollision(
                  activeLevel,
                  candX,
                  candZ,
                  0.36,
                  false,
                  collisionCtx
                );
                const movedDist = Math.hypot(colX - rt.x, colZ - rt.z);
                const distFromPen = Math.hypot(colX - rt.startX, colZ - rt.startZ);
                if (movedDist < stepC * 0.45 || distFromPen > 2.25) {
                  // Gently bounce/steer back inside fenced pen instead of clipping through!
                  const inwardYaw = Math.atan2(rt.startX - rt.x, rt.startZ - rt.z);
                  rt.chickenYaw = inwardYaw + (Math.random() - 0.5) * 1.35;
                  rt.chickenTimer = 0.9 + Math.random() * 1.1;
                } else {
                  rt.x = colX;
                  rt.z = colZ;
                  rt.walkPhase += dt * (7.5 + spdC * 2.5);
                  hopC = Math.abs(Math.sin(rt.walkPhase)) * 0.045;
                }
              } else if (rt.chickenMode === 'peck') {
                rt.walkPhase += dt * 5.2;
                peckPitch = Math.max(0, Math.sin(rt.walkPhase)) * 0.42;
              }
              const groundYC = sampleLevelHeight(activeLevel, rt.x, rt.z);
              rt.mesh.position.set(rt.x, groundYC + hopC, rt.z);
              const yawDiffC = Math.atan2(
                Math.sin(rt.chickenYaw - rt.mesh.rotation.y),
                Math.cos(rt.chickenYaw - rt.mesh.rotation.y)
              );
              rt.mesh.rotation.y += yawDiffC * Math.min(1, dt * 6.5);
              rt.mesh.rotation.x = THREE.MathUtils.damp(rt.mesh.rotation.x, peckPitch, 12, dt);
            }

            // Animate Blacksmith hammering & flying sparks, Tavern patrons & bartender, Villager raking yard, and Tethered horses
            updateRpgLivingVillageAnimations(rt.mesh, gameElapsed);

            const dist = Math.hypot(rt.x - heroX, rt.z - heroZ);
            const rtBaseY = sampleLevelHeight(activeLevel, rt.x, rt.z) + (rt.elevationY ?? 0);
            const vertOk = Math.abs(heroY - rtBaseY) < 2.2;

            // Walk-In Full-Sized Building: Hinged Front Door (Press E to Open), Roof Cutaway & Closer Interior Camera
            if (rt.mesh.userData?.walkInBuilding && rt.mesh.userData?.walkInSpec) {
              const spec = rt.mesh.userData.walkInSpec as WalkInBuildingSpec;
              const yawB = rt.mesh.rotation.y;
              const cosB = Math.cos(yawB);
              const sinB = Math.sin(yawB);
              const dxB = heroX - rt.x;
              const dzB = heroZ - rt.z;
              const lxB = dxB * cosB - dzB * sinB;
              const lzB = dxB * sinB + dzB * cosB;

              const insideFootprint =
                Math.abs(lxB) <= spec.halfW - 0.15 && Math.abs(lzB) <= spec.halfD - 0.15;
              const inDoorwayThreshold =
                rt.opened &&
                Math.abs(lxB) <= spec.doorHalfW + 0.65 &&
                lzB >= spec.halfD - 0.6 &&
                lzB <= spec.halfD + 1.4;
              if (insideFootprint || inDoorwayThreshold) {
                heroInsideWalkInBuilding = true;
                const scY = Math.max(0.65, rt.mesh.scale.y || 1);
                const ceilingTopY = rtBaseY + spec.floorOffset + (spec.wallHeight / scY) * 0.62 * scY;
                if (ceilingTopY < insideBuildingCeilingY) {
                  insideBuildingCeilingY = ceilingTopY;
                }
              }

              const roofGrp = rt.mesh.userData.cutawayRoofGroup as THREE.Group | undefined;
              if (roofGrp) {
                // Keep roofs intact! Close camera moves smoothly inside underneath the roof.
                roofGrp.visible = true;
              }

              const doorPivot = rt.mesh.userData.frontDoorPivot as THREE.Group | undefined;
              if (doorPivot) {
                const targetDoorYaw = rt.opened ? -Math.PI * 0.64 : 0;
                doorPivot.rotation.y = THREE.MathUtils.damp(
                  doorPivot.rotation.y,
                  targetDoorYaw,
                  10,
                  dt
                );
              }

              // Distance from hero to the front door center (lx = 0, lz = +spec.halfD)
              const doorDist = Math.hypot(lxB, lzB - spec.halfD);
              if (doorDist < 3.85 && Math.abs(heroY - rtBaseY) < 3.2) {
                nearInteractableEntity = true;
                if (doorDist < nearestDoorPromptDist) {
                  nearestDoorPromptDist = doorDist;
                  nearestDoorPrompt = {
                    label: `${rt.name} Door`,
                    isOpen: rt.opened,
                    locked: false,
                  };
                }
                if (didInteract && !interactConsumed) {
                  interactConsumed = true;
                  rt.opened = !rt.opened;
                  if (rt.opened) openedDoorIds.add(rt.id);
                  else openedDoorIds.delete(rt.id);
                  AudioEngine.playSound(activeLevel.audio.door);
                  showToast(
                    rt.opened
                      ? `${rt.name} door opened — walk inside to explore!`
                      : `${rt.name} door closed`
                  );
                }
              }
            }

            // Live Particle & FX Emitter simulation (auto-paused whenever Play Mode pauses)
            if (rt.fxRuntime) {
              rt.fxRuntime.setPaused(false);
              const fxPreset = rt.fxRuntime.getConfig().preset;
              if (
                didInteract &&
                dist <= 4.8 &&
                (fxPreset === 'waterSplash' ||
                  fxPreset === 'lightning' ||
                  fxPreset === 'dimensionalPortal' ||
                  fxPreset === 'arcaneSigil' ||
                  fxPreset === 'crystalEruption' ||
                  fxPreset === 'energyPillar' ||
                  fxPreset === 'voidVortex' ||
                  fxPreset === 'meteorStrike')
              ) {
                rt.fxRuntime.triggerBurst();
                interactConsumed = true;
              }
              rt.fxRuntime.update(dt, camera);
              continue;
            }

            // Treasure chest: sit in world, prompt to press Use, animate spring-open + gold glow first, then open ChestLootModal
            if (rt.kind === 'treasure') {
              const useRadius =
                rt.mechanisms.length > 0
                  ? Math.max(
                      2.35,
                      rt.mechanisms[0]?.triggers.find((t) => t.event === 'playerUses')?.radius ?? 2.35
                    )
                  : 2.35;

              if (
                !rt.chestOpening &&
                (!rt.opened || rt.chestLootEntries.length > 0) &&
                dist < useRadius &&
                vertOk
              ) {
                nearInteractableEntity = true;
                let isLocked = false;
                let lockedMsg = '';
                let blockingRule: {
                  mechId: string;
                  rule: ObjectMechanism['triggers'][number];
                } | null = null;

                if (rt.mechanisms.length > 0 && !rt.opened) {
                  for (const mech of rt.mechanisms) {
                    const useRule = mech.triggers.find((t) => t.event === 'playerUses');
                    if (!useRule) continue;
                    blockingRule = { mechId: mech.id, rule: useRule };
                    let condPassed = true;
                    if (useRule.condition === 'hasKey') condPassed = keys > 0;
                    else if (useRule.condition === 'hasItem') {
                      const reqId = useRule.conditionValue;
                      condPassed = Boolean(
                        reqId &&
                          inventoryStacksRef.current.some((s) => s.itemId === reqId && s.qty > 0)
                      );
                    } else if (useRule.condition === 'flagSet') {
                      const reqFlag = useRule.conditionValue?.trim();
                      condPassed = Boolean(reqFlag && gameFlags.has(reqFlag));
                    } else if (useRule.condition === 'baddiesGone') {
                      condPassed = !baddiesRemaining;
                    }
                    if (!condPassed) {
                      isLocked = true;
                      lockedMsg = useRule.lockedMessage?.trim() || `${rt.name} is locked!`;
                    }
                    break;
                  }
                }

                if (dist < nearestChestPromptDist) {
                  nearestChestPromptDist = dist;
                  nearestChestPrompt = {
                    label: rt.name,
                    isOpen: rt.opened,
                    locked: isLocked,
                    lockedMessage: lockedMsg || undefined,
                    itemCount: rt.chestLootEntries.length,
                  };
                }

                if (didInteract && !interactConsumed && !openingChestId) {
                  interactConsumed = true;
                  if (isLocked) {
                    showToast(lockedMsg || `${rt.name} is locked!`);
                  } else if (!rt.opened) {
                    if (blockingRule && rt.mechController) {
                      const { mechId, rule } = blockingRule;
                      if (rule.consumeRequired) {
                        if (rule.condition === 'hasKey' && keys > 0) keys -= 1;
                        if (rule.condition === 'hasItem' && rule.conditionValue) {
                          removeItemFromBag(rule.conditionValue, 1);
                        }
                      }
                      if (rule.setFlagOnOpen?.trim()) {
                        gameFlags.add(rule.setFlagOnOpen.trim());
                      }
                      rt.mechController.trigger(mechId, 'open');
                    }

                    rt.chestOpening = true;
                    openingChestId = rt.id;
                    chestOpeningLockRef.current = true;
                    setIsChestOpeningAnim(true);
                    if (rt.chestAnim) {
                      rt.chestAnim.opening = true;
                      rt.chestAnim.openElapsed = 0;
                      rt.chestAnim.openProgress = 0;
                    } else {
                      rt.chestOpenTimer = 0.95;
                    }
                    AudioEngine.playSound(activeLevel.audio.door);
                    AudioEngine.playSound('sparkle');
                    spawnCombatSparks(
                      rt.x,
                      rtBaseY + 0.65,
                      rt.z,
                      '#FFD24C',
                      16,
                      5.4
                    );
                  } else if (rt.chestLootEntries.length > 0) {
                    openChestModalFnRef.current(rt.id, rt.name);
                  }
                }
              }
              continue;
            }

            // Evaluate Interaction Designer mechanisms (hinge, slider, spinner, pendulum, springBounce, transporter)
            if (rt.mechController && rt.mechanisms.length > 0) {
              for (const mech of rt.mechanisms) {
                // Continuous hazard check for spinner / pendulum traps
                if (
                  (mech.kind === 'spinner' || mech.kind === 'pendulum') &&
                  mech.isHazard &&
                  dist <= 1.45 &&
                  vertOk &&
                  hitInvuln <= 0
                ) {
                  health -= 1;
                  hitInvuln = 1.0;
                  shakeTimer = 0.25;
                  heroVelY = 6.5;
                  AudioEngine.playSound('hurt');
                  if (health <= 0) {
                    triggerHeroDeath();
                  }
                }

                // Giant Spring / Bounce Contraption
                if (
                  mech.kind === 'springBounce' &&
                  dist <= 1.55 &&
                  vertOk &&
                  gameElapsed >= mechSpringCooldownUntil
                ) {
                  mechSpringCooldownUntil = gameElapsed + 0.32;
                  rt.mechController.trigger(mech.id, 'open');
                  heroVelY = Math.max(heroVelY, mech.bounceVelocity ?? 18.5);
                  jumpsUsed = 0;
                  airborneTimer = 0.1;
                  if (mech.bounceForwardBoost && mech.bounceForwardBoost > 0) {
                    const fwdX = Math.sin(heroYaw);
                    heroKnockVX = (Math.abs(fwdX) > 0.2 ? Math.sign(fwdX) : 1) * mech.bounceForwardBoost;
                  }
                  AudioEngine.playSound('whoosh');
                  spawnCombatSparks(rt.x, rtBaseY + 0.8, rt.z, '#FBBF24', 12, 5.4);
                }

                for (const rule of mech.triggers) {
                  const ruleKey = `${mech.id}:${rule.id}`;
                  let eventMatched = false;

                  if (rule.event === 'levelStarts') {
                    if (!mechLevelStartsFired) eventMatched = true;
                  } else if (rule.event === 'playerUses') {
                    if (dist <= rule.radius && vertOk) {
                      nearInteractableEntity = true;
                    }
                    if (didInteract && dist <= rule.radius && vertOk) {
                      eventMatched = true;
                      interactConsumed = true;
                    }
                  } else if (rule.event === 'playerNear') {
                    const inside = dist <= rule.radius && vertOk;
                    const wasInside = Boolean(rt.mechNearState[ruleKey]);
                    rt.mechNearState[ruleKey] = inside;
                    if (inside && !wasInside) eventMatched = true;
                  } else if (rule.event === 'playerTouches') {
                    const touching = dist <= Math.min(rule.radius, 1.5) && vertOk;
                    const wasTouching = Boolean(rt.mechNearState[ruleKey]);
                    rt.mechNearState[ruleKey] = touching;
                    if (touching && !wasTouching) eventMatched = true;
                  } else if (rule.event === 'flagSet') {
                    const flagName = rule.eventFlag?.trim();
                    if (flagName) {
                      const active = gameFlags.has(flagName);
                      const wasActive = Boolean(rt.mechFlagFired[ruleKey]);
                      rt.mechFlagFired[ruleKey] = active;
                      if (active && !wasActive) eventMatched = true;
                    }
                  }

                  if (!eventMatched) continue;

                  // Evaluate conditional gate
                  let condPassed = true;
                  if (rule.condition === 'hasKey') {
                    condPassed = keys > 0;
                  } else if (rule.condition === 'hasItem') {
                    const reqId = rule.conditionValue;
                    condPassed = Boolean(
                      reqId &&
                        inventoryStacksRef.current.some((s) => s.itemId === reqId && s.qty > 0)
                    );
                  } else if (rule.condition === 'flagSet') {
                    const reqFlag = rule.conditionValue?.trim();
                    condPassed = Boolean(reqFlag && gameFlags.has(reqFlag));
                  } else if (rule.condition === 'baddiesGone') {
                    condPassed = !baddiesRemaining;
                  }

                  if (!condPassed) {
                    if (rule.event === 'playerUses' || rule.event === 'playerTouches') {
                      showToast(rule.lockedMessage?.trim() || `${rt.name} is locked.`);
                    }
                    continue;
                  }

                  const changed = rt.mechController.trigger(mech.id, rule.action);
                  if (!changed && mech.kind !== 'transporter') continue;

                  // Transporter contraption warp
                  if (mech.kind === 'transporter' && gameElapsed >= mechWarpCooldownUntil) {
                    mechWarpCooldownUntil = gameElapsed + 1.25;
                    const targetRoom =
                      mech.transportToSecretRoomId && sideCfgInit?.secretRooms
                        ? sideCfgInit.secretRooms.find((r) => r.id === mech.transportToSecretRoomId)
                        : undefined;
                    if (targetRoom) {
                      heroX = targetRoom.roomCenterX;
                      heroY = targetRoom.roomCenterY + 0.6;
                      heroZ = 0;
                      heroVelY = 0;
                    } else if (mech.transportTarget) {
                      const [tx, tz] = levelBoardToWorld(activeLevel, mech.transportTarget);
                      heroX = tx;
                      heroZ = tz;
                      heroY =
                        mech.transportTargetY !== undefined
                          ? mech.transportTargetY
                          : sampleLevelHeight(activeLevel, tx, tz) + 0.8;
                      heroVelY = 8.0;
                    } else {
                      heroX = rt.x + 9;
                      heroY = rtBaseY + 3.5;
                      heroVelY = 10.5;
                    }
                    AudioEngine.playSound('sparkle');
                    spawnCombatSparks(heroX, heroY + 0.8, heroZ, '#38BDF8', 18, 6.2);
                    showToast(mech.transportLabel?.trim() || `Launched from ${rt.name}!`);
                  }

                  const nowOpen = rt.mechController.isOpen(mech.id);
                  if (nowOpen) {
                    if (rule.consumeRequired) {
                      if (rule.condition === 'hasKey' && keys > 0) keys -= 1;
                      if (rule.condition === 'hasItem' && rule.conditionValue) {
                        removeItemFromBag(rule.conditionValue, 1);
                      }
                    }
                    if (rule.setFlagOnOpen?.trim()) {
                      gameFlags.add(rule.setFlagOnOpen.trim());
                    }
                    if (rt.mechController.markRewarded(mech.id)) {
                      if (rule.rewardCoins && rule.rewardCoins > 0) {
                        coins += rule.rewardCoins;
                      }
                      if (rule.rewardItemId) {
                        const itemDef = itemByIdRef.current.get(rule.rewardItemId);
                        addItemToBag(
                          rule.rewardItemId,
                          1,
                          itemDef?.category === 'tool' || itemDef?.category === 'weapon'
                        );
                      }
                    }
                    rt.opened = true;
                  } else if (rule.clearFlagOnClose && rule.setFlagOnOpen?.trim()) {
                    gameFlags.delete(rule.setFlagOnOpen.trim());
                  }

                  if (rule.sound && rule.sound !== 'none') {
                    const soundKey =
                      rule.sound === 'door'
                        ? activeLevel.audio.door
                        : rule.sound === 'coin'
                        ? activeLevel.audio.coin
                        : rule.sound;
                    AudioEngine.playSound(soundKey);
                  }
                  if (rule.message?.trim()) {
                    showToast(rule.message.trim());
                  }
                }
              }
              continue;
            }

            if (rt.kind === 'pickup' && dist < 1.55 && vertOk) {
              rt.alive = false;
              rt.mesh.visible = false;
              const targetItemId = rt.pickupItemId || 'wild_berries';
              const itemDef = itemByIdRef.current.get(targetItemId);
              const isToolOrWeapon =
                itemDef?.category === 'tool' || itemDef?.category === 'weapon';
              addItemToBag(targetItemId, rt.pickupQty, isToolOrWeapon);
              AudioEngine.playSound(activeLevel.audio.coin);
              spawnCombatSparks(rt.x, rtBaseY + 0.8, rt.z, itemDef?.colorHex ?? '#FACC15', 7, 4.5);
              if (itemDef?.toolKind === 'axe') {
                showToast(`Found ${itemDef.name}! Equipped — press F near trees to chop.`);
              } else if (itemDef?.toolKind === 'fishingPole') {
                showToast(`Found ${itemDef.name}! Equipped — face water & press F to fish.`);
              } else {
                showToast(
                  `Collected ${rt.pickupQty > 1 ? `${rt.pickupQty}× ` : ''}${itemDef?.name ?? rt.name}!`
                );
              }
            } else if (rt.kind === 'key' && dist < 1.35 && vertOk) {
              rt.alive = false;
              rt.mesh.visible = false;
              keys += 1;
              if (rt.pickupable && rt.pickupItemId) {
                addItemToBag(rt.pickupItemId, rt.pickupQty, false);
              }
              AudioEngine.playSound(activeLevel.audio.coin);
              showToast(`Picked up ${rt.name}!`);
            } else if (rt.buildingBlock?.shape === 'trapdoor') {
              if (dist < 2.25 && vertOk) {
                if (dist < nearestDoorPromptDist) {
                  nearestDoorPromptDist = dist;
                  nearestDoorPrompt = { label: rt.name, isOpen: rt.opened, locked: false };
                }
                if (didInteract && !interactConsumed) {
                  interactConsumed = true;
                  rt.opened = !rt.opened;
                  if (rt.opened) openedDoorIds.add(rt.id);
                  else openedDoorIds.delete(rt.id);
                  AudioEngine.playSound(activeLevel.audio.door);
                  showToast(`${rt.name} ${rt.opened ? 'opened' : 'closed'}`);
                }
              }
            } else if (
              (rt.kind === 'prop' || rt.kind === 'scenery' || rt.kind === 'light') &&
              rt.pickupable &&
              rt.pickupItemId &&
              dist < 1.55 &&
              vertOk
            ) {
              rt.alive = false;
              rt.mesh.visible = false;
              const itemDef = itemByIdRef.current.get(rt.pickupItemId);
              addItemToBag(
                rt.pickupItemId,
                rt.pickupQty,
                itemDef?.category === 'tool' || itemDef?.category === 'weapon'
              );
              AudioEngine.playSound(activeLevel.audio.coin);
              showToast(
                `Picked up ${rt.pickupQty > 1 ? `${rt.pickupQty}× ` : ''}${itemDef?.name ?? rt.name}!`
              );
            } else if (isSavePlinthEntity({ kind: rt.kind, name: rt.name, propPreset: rt.propPreset })) {
              const touchRadius = isDriving ? 4.8 : 2.35;
              const leaveRadius = isDriving ? 5.8 : 3.2;
              if (dist < touchRadius) {
                if (!insideSavePlinthIds.has(rt.id) && gameElapsed >= savePlinthCooldownUntil) {
                  insideSavePlinthIds.add(rt.id);
                  savePlinthCooldownUntil = gameElapsed + 1.8;
                  const plinthKey = makePlinthKey(activeLevel.id, rt.id);
                  const wasNew = markPlinthDiscovered(activeProject.id, plinthKey);
                  if (!clearedCheckpointIds.includes(rt.id)) clearedCheckpointIds.push(rt.id);
                  respawnX = rt.x;
                  respawnZ = rt.z;
                  respawnYaw = heroYaw;
                  AudioEngine.playSound('chime');
                  AudioEngine.playSound('sparkle');
                  spawnCombatSparks(
                    rt.x,
                    sampleLevelHeight(activeLevel, rt.x, rt.z) + 1.8,
                    rt.z,
                    '#38BDF8',
                    18,
                    7.2
                  );
                  savePlayProgress({
                    projectId: activeProject.id,
                    levelId: activeLevel.id,
                    levelName: activeLevel.name,
                    plinthEntityId: rt.id,
                    plinthName: rt.name,
                    localX: rt.x,
                    localZ: rt.z,
                    savedAt: Date.now(),
                    coins,
                    keys,
                    health,
                    maxHealth,
                    inventoryStacks: inventoryStacksRef.current,
                    equipment: equipmentRef.current,
                    discoveredPlinthKeys: Array.from(getDiscoveredPlinthKeys(activeProject.id)),
                    explorationB64: encodeExplorationBase64(
                      getExplorationSnapshot(activeProject.id).data
                    ),
                  });
                  showToast(
                    wasNew
                      ? `Save Plinth Discovered & Saved: ${rt.name}!`
                      : `Progress Saved at ${rt.name}`
                  );
                  openFastTravelRef.current(rt.id, rt.name);
                }
              } else if (dist > leaveRadius && insideSavePlinthIds.has(rt.id)) {
                insideSavePlinthIds.delete(rt.id);
              }
            } else if (rt.kind === 'checkpoint' && !rt.opened && dist < (isDriving ? 4.8 : 1.8)) {
              rt.opened = true;
              if (!clearedCheckpointIds.includes(rt.id)) clearedCheckpointIds.push(rt.id);
              respawnX = rt.x;
              respawnZ = rt.z;
              respawnYaw = heroYaw;
              AudioEngine.playSound('chime');
              if (isDriving) {
                carCheckpointsHit += 1;
                coins += 5;
                spawnCombatSparks(rt.x, sampleLevelHeight(activeLevel, rt.x, rt.z) + 2.2, rt.z, '#20B46A', 14, 7.5);
                if (drivingCheckpointsTotal > 0 && carCheckpointsHit >= drivingCheckpointsTotal) {
                  showToast('All Checkpoint Arches cleared! Cross the finish portal or keep cruising!');
                } else {
                  showToast(`${rt.name} cleared! (${carCheckpointsHit}/${drivingCheckpointsTotal})`);
                }
              } else {
                showToast('Checkpoint saved!');
              }
            } else if (rt.kind === 'puzzle' && !rt.opened) {
              if (rt.puzzleRequires) {
                if (dist < 2.3 && gameElapsed - lastPuzzleHintAt > 3.2) {
                  lastPuzzleHintAt = gameElapsed;
                  const reqMeta = MisfitAbilityById[rt.puzzleRequires];
                  const hasPower = unlockedPowersRef.current.includes(rt.puzzleRequires);
                  showToast(
                    hasPower
                      ? `${rt.name}: Switch to ${reqMeta.title} (X) and press Q!`
                      : `${rt.name}: Needs ${reqMeta.title} — find that woodland buddy!`
                  );
                }
              } else if (dist < 1.4) {
                solveMisfitPuzzle(rt);
              }
            } else if (rt.kind === 'trap' && dist < 1.15 && hitInvuln <= 0) {
              health -= 1;
              hitInvuln = 1.0;
              shakeTimer = 0.25;
              AudioEngine.playSound('hurt');
              if (health <= 0) {
                triggerHeroDeath();
              }
            } else if (rt.kind === 'npc' || rt.kind === 'sign') {
              // Buddies auto-recruit + companion following + tavern dance celebration
              let buddyMoving = false;
              if (rt.kind === 'npc' && rt.isBuddy) {
                if (!rt.recruited && (dist <= 3.3 || (didInteract && dist <= 4.6))) {
                  rt.recruited = true;
                  recruitedBuddyIds.push(rt.id);
                  AudioEngine.playSound('chime');
                  AudioEngine.playSound('sparkle');
                  const bFloor = sampleLevelHeight(activeLevel, rt.x, rt.z);
                  spawnCombatSparks(rt.x, bFloor + 1.2, rt.z, '#FACC15', 14, 6.2);
                  if (rt.misfitAbility) {
                    unlockPowerRuntime(rt.misfitAbility, rt.name);
                  } else {
                    showToast(
                      `${rt.name} joined! (${recruitedBuddyIds.length}/${buddyEntities.length})`
                    );
                  }
                  pushCharacterSpeech(
                    {
                      key: rt.id,
                      entityId: rt.id,
                      speaker: rt.name,
                      roleLabel: rt.buddyAreaLabel || 'Woodland Buddy',
                      kind: 'npc',
                      lines: rt.dialogueLines,
                      lineIndex: 0,
                      style: rt.chatStyle,
                      voiceConfig: rt.voiceConfig,
                      isProximity: false,
                      expiresAt: performance.now() + 5400,
                    },
                    true,
                    true
                  );
                  setBuddyHud({
                    found: recruitedBuddyIds.length,
                    total: buddyEntities.length,
                    names: recruitedBuddyIds
                      .map((id) => runtimeEntities.find((r) => r.id === id)?.name.split(' ')[0] ?? 'Buddy'),
                    celebrating: tavernCelebrated,
                    celebrationBannerOpen: tavernCelebrated,
                  });
                }

                if (rt.recruited) {
                  const slotIdx = Math.max(0, recruitedBuddyIds.indexOf(rt.id));
                  let targetX = heroX;
                  let targetZ = heroZ;
                  if (tavernCelebrated) {
                    const count = Math.max(1, recruitedBuddyIds.length);
                    const ringAng = gameElapsed * 0.55 + (slotIdx / count) * Math.PI * 2;
                    targetX = heroX + Math.cos(ringAng) * 2.95;
                    targetZ = heroZ + Math.sin(ringAng) * 2.95;
                  } else {
                    // Keep recruited companions at a respectful, comfortable trailing & flanking distance
                    // so they never crowd the hero or get in the way of treasure chests & doors!
                    const idxBack = Math.max(0, heroTrail.length - 1 - (slotIdx + 1) * 9);
                    const trailNode = heroTrail[idxBack] ?? {
                      x: heroX - Math.sin(heroYaw) * (3.5 + slotIdx * 1.2),
                      z: heroZ - Math.cos(heroYaw) * (3.5 + slotIdx * 1.2),
                    };
                    const sideSign = slotIdx % 2 === 0 ? -1 : 1;
                    const sideDist = 2.35 + Math.floor(slotIdx / 2) * 1.15;
                    const backDist = heroNearPriorityChestOrDoor ? 2.6 : 1.35;
                    targetX =
                      trailNode.x +
                      Math.cos(heroYaw) * sideSign * sideDist -
                      Math.sin(heroYaw) * backDist;
                    targetZ =
                      trailNode.z -
                      Math.sin(heroYaw) * sideSign * sideDist -
                      Math.cos(heroYaw) * backDist;

                    // Enforce personal-space clearance around the hero (and even wider around chests!)
                    const minHeroClearance = heroNearPriorityChestOrDoor ? 4.2 : 3.35;
                    const tdxH = targetX - heroX;
                    const tdzH = targetZ - heroZ;
                    const tdH = Math.hypot(tdxH, tdzH);
                    if (tdH < minHeroClearance) {
                      const pushAng =
                        tdH > 0.05
                          ? Math.atan2(tdxH, tdzH)
                          : heroYaw + Math.PI + sideSign * 0.65;
                      targetX = heroX + Math.sin(pushAng) * minHeroClearance;
                      targetZ = heroZ + Math.cos(pushAng) * minHeroClearance;
                    }
                    if (heroNearPriorityChestOrDoor) {
                      const tdxCh = targetX - activeChestBlockX;
                      const tdzCh = targetZ - activeChestBlockZ;
                      const tdCh = Math.hypot(tdxCh, tdzCh);
                      if (tdCh < 4.1) {
                        const awayAng =
                          tdCh > 0.05 ? Math.atan2(tdxCh, tdzCh) : heroYaw + Math.PI;
                        targetX = activeChestBlockX + Math.sin(awayAng) * 4.2;
                        targetZ = activeChestBlockZ + Math.cos(awayAng) * 4.2;
                      }
                    }
                  }
                  const dxB = targetX - rt.x;
                  const dzB = targetZ - rt.z;
                  const dB = Math.hypot(dxB, dzB);
                  if (dB > (tavernCelebrated ? 0.25 : 0.72)) {
                    const stepSpd = tavernCelebrated ? 4.8 : Math.max(rt.speed, isRunning ? 8.8 : 6.2);
                    const step = Math.min(dB, stepSpd * dt);
                    const nxB = rt.x + (dxB / dB) * step;
                    const nzB = rt.z + (dzB / dB) * step;
                    const [resBX, resBZ] = resolveHorizontalCollision(
                      activeLevel,
                      nxB,
                      nzB,
                      0.48,
                      true,
                      collisionCtx
                    );
                    rt.x = resBX;
                    rt.z = resBZ;
                    rt.mesh.rotation.y = Math.atan2(dxB, dzB);
                    buddyMoving = true;
                  } else if (tavernCelebrated) {
                    rt.mesh.rotation.y = Math.atan2(heroX - rt.x, heroZ - rt.z);
                  } else if (dist < 6.5) {
                    rt.mesh.rotation.y = Math.atan2(heroX - rt.x, heroZ - rt.z);
                  }
                  const hopY = tavernCelebrated
                    ? Math.abs(Math.sin(gameElapsed * 7.5 + slotIdx * 1.4)) * 0.32
                    : buddyMoving
                    ? Math.abs(Math.sin(gameElapsed * 10 + slotIdx)) * 0.08
                    : 0;
                  rt.mesh.position.set(rt.x, sampleLevelHeight(activeLevel, rt.x, rt.z) + hopY, rt.z);

                  // Recruited RPG Companion Combat AI: actively attack nearby enemies with sword, arrow, or magic!
                  if (activeLevel.gameplayMode === 'rpg' && !tavernCelebrated) {
                    const lastAllyAtk = companionAttackCooldowns.get(rt.id) ?? 0;
                    if (gameElapsed - lastAllyAtk >= 1.45) {
                      let targetEnemy: RuntimeEntity | null = null;
                      let bestEnemyD = 7.8;
                      for (const cand of runtimeEntities) {
                        if (!cand.alive || cand.kind !== 'baddie') continue;
                        const dCand = Math.hypot(cand.x - rt.x, cand.z - rt.z);
                        if (dCand < bestEnemyD) {
                          bestEnemyD = dCand;
                          targetEnemy = cand;
                        }
                      }
                      if (targetEnemy) {
                        companionAttackCooldowns.set(rt.id, gameElapsed);
                        const allyY = sampleLevelHeight(activeLevel, rt.x, rt.z);
                        const enemyY =
                          sampleLevelHeight(activeLevel, targetEnemy.x, targetEnemy.z) +
                          (targetEnemy.flightY ?? 0);
                        rt.mesh.rotation.y = Math.atan2(
                          targetEnemy.x - rt.x,
                          targetEnemy.z - rt.z
                        );
                        const lowerName = rt.name.toLowerCase();
                        const isMageAlly =
                          lowerName.includes('mage') ||
                          lowerName.includes('lyra') ||
                          lowerName.includes('wizard');
                        const isArcherAlly =
                          lowerName.includes('ranger') ||
                          lowerName.includes('archer') ||
                          lowerName.includes('pip');
                        const allyDmg = isMageAlly ? 5 : isArcherAlly ? 4 : 4;
                        if (isMageAlly) {
                          spawnRpgMagicZapBeam(
                            scene,
                            rpgVisualFx,
                            rt.x,
                            allyY + 1.0,
                            rt.z,
                            targetEnemy.x,
                            enemyY,
                            targetEnemy.z,
                            '#A855F7'
                          );
                          AudioEngine.playSound('sparkle');
                        } else {
                          spawnRpgSwordSlashArc(
                            scene,
                            rpgVisualFx,
                            targetEnemy.x,
                            enemyY + 0.85,
                            targetEnemy.z,
                            Math.atan2(targetEnemy.x - rt.x, targetEnemy.z - rt.z),
                            isArcherAlly ? '#34D399' : '#38BDF8'
                          );
                          AudioEngine.playSound('hit');
                        }
                        targetEnemy.health -= allyDmg;
                        targetEnemy.hitFlashTimer = 0.16;
                        spawnCombatSparks(
                          targetEnemy.x,
                          enemyY + 0.95,
                          targetEnemy.z,
                          isMageAlly ? '#C084FC' : '#38BDF8',
                          9,
                          5.6
                        );
                        spawnEvaporatingDamageNumber(
                          scene,
                          evaporatingDamages,
                          targetEnemy.x,
                          enemyY + 1.35,
                          targetEnemy.z,
                          `-${allyDmg}`,
                          isMageAlly ? '#C084FC' : '#38BDF8',
                          `${rt.name.split(' ')[0].toUpperCase()}!`
                        );
                        if (targetEnemy.health <= 0) {
                          const kLen = Math.max(0.01, bestEnemyD);
                          beginBaddieDeath(
                            targetEnemy,
                            (targetEnemy.x - rt.x) / kLen,
                            (targetEnemy.z - rt.z) / kLen
                          );
                        }
                      }
                    }
                  }
                } else if (dist < 10) {
                  rt.mesh.rotation.y = Math.atan2(heroX - rt.x, heroZ - rt.z);
                }
              }
              // Woodland Critter Reactions (teasing / nervous / grumpy -> cheers once won over!)
              let critterMoving = false;
              if (rt.kind === 'npc' && !rt.isBuddy && rt.critterAttitude && rt.critterAttitude !== 'none') {
                if (!rt.warmedUp) {
                  const triggerKind = rt.critterWarmOn ?? 'nearbyPower';
                  let shouldWarm = false;
                  if (triggerKind === 'allBuddies') {
                    shouldWarm =
                      buddyEntities.length > 0 && recruitedBuddyIds.length >= buddyEntities.length;
                  } else if (triggerKind === 'flagSet') {
                    shouldWarm = Boolean(
                      rt.critterWarmFlag?.trim() && gameFlags.has(rt.critterWarmFlag.trim())
                    );
                  } else {
                    let hasNearbySolvedPuzzle = false;
                    let hasNearbyUnsolvedPuzzle = false;
                    for (const pRt of runtimeEntities) {
                      if (!pRt.alive || pRt.kind !== 'puzzle') continue;
                      if (Math.hypot(pRt.x - rt.x, pRt.z - rt.z) <= 18) {
                        if (pRt.opened) hasNearbySolvedPuzzle = true;
                        else hasNearbyUnsolvedPuzzle = true;
                      }
                    }
                    if (hasNearbySolvedPuzzle) {
                      shouldWarm = true;
                    } else if (!hasNearbyUnsolvedPuzzle && recentMisfitUsed && dist <= 9.0) {
                      shouldWarm = true;
                    }
                  }

                  if (shouldWarm) {
                    rt.warmedUp = true;
                    rt.critterCelebrateTimer = 2.8;
                    crittersWarmedCount += 1;
                    setStoryStats({ puzzlesSolved: puzzlesSolvedCount, crittersWarmed: crittersWarmedCount });
                    rt.dialogueLines =
                      rt.critterWarmLines && rt.critterWarmLines.length > 0
                        ? rt.critterWarmLines
                        : ["Now I see what you misfits can really do — you're amazing!"];
                    AudioEngine.playSound('chime');
                    AudioEngine.playSound('sparkle');
                    const cFloor = sampleLevelHeight(activeLevel, rt.x, rt.z);
                    spawnCombatSparks(rt.x, cFloor + 1.15, rt.z, '#FACC15', 14, 6.0);
                    showToast(`${rt.name} was won over!`);
                    if (!activeCutaway) {
                      pushCharacterSpeech(
                        {
                          key: rt.id,
                          entityId: rt.id,
                          speaker: rt.name,
                          roleLabel: 'Woodland Friend',
                          kind: 'npc',
                          lines: rt.dialogueLines,
                          lineIndex: 0,
                          style: rt.chatStyle,
                          voiceConfig: rt.voiceConfig,
                          isProximity: false,
                          expiresAt: performance.now() + 5200,
                        },
                        true,
                        true
                      );
                    }
                  }
                }
                if (rt.critterCelebrateTimer > 0) {
                  rt.critterCelebrateTimer = Math.max(0, rt.critterCelebrateTimer - dt);
                }
              }

              let skitAnimating = false;
              if (activeCutaway) {
                const curBeat = activeCutaway.skit.beats[activeCutaway.beatIndex];
                if (curBeat && curBeat.speakerKind === 'entity' && curBeat.speakerEntityId === rt.id) {
                  skitAnimating = true;
                  rt.skitMoving = false;
                  if (curBeat.moveToPoint) {
                    const [txW, tzW] = levelBoardToWorld(activeLevel, curBeat.moveToPoint);
                    const dxM = txW - rt.x;
                    const dzM = tzW - rt.z;
                    const dM = Math.hypot(dxM, dzM);
                    if (dM > 0.22) {
                      const stepM = Math.min(dM, 2.7 * dt);
                      const [resMX, resMZ] = resolveHorizontalCollision(
                        activeLevel,
                        rt.x + (dxM / dM) * stepM,
                        rt.z + (dzM / dM) * stepM,
                        0.45,
                        true,
                        collisionCtx
                      );
                      rt.x = resMX;
                      rt.z = resMZ;
                      rt.skitMoving = true;
                    }
                  }
                  let targetLookYaw = rt.mesh.rotation.y;
                  if (curBeat.lookAtKind === 'hero') {
                    targetLookYaw = Math.atan2(heroX - rt.x, heroZ - rt.z);
                  } else if (curBeat.lookAtKind === 'entity' && curBeat.lookAtEntityId) {
                    const ltRt = runtimeEntities.find((r) => r.id === curBeat.lookAtEntityId);
                    if (ltRt) targetLookYaw = Math.atan2(ltRt.x - rt.x, ltRt.z - rt.z);
                  } else {
                    targetLookYaw = Math.atan2(camera.position.x - rt.x, camera.position.z - rt.z);
                  }
                  const yawDiffS = Math.atan2(
                    Math.sin(targetLookYaw - rt.mesh.rotation.y),
                    Math.cos(targetLookYaw - rt.mesh.rotation.y)
                  );
                  rt.mesh.rotation.y += yawDiffS * Math.min(1, dt * 8.5);

                  const em = curBeat.emote ?? 'none';
                  let emHopY = rt.skitMoving ? Math.abs(Math.sin(gameElapsed * 9)) * 0.08 : 0;
                  let emPitch = 0;
                  let emRoll = 0;
                  if (em === 'shock') {
                    const tShock = Math.min(1, activeCutaway.beatElapsed * 3.5);
                    emHopY += Math.sin(tShock * Math.PI) * 0.36;
                    emPitch = -0.18 * (1 - tShock * 0.5);
                  } else if (em === 'angry') {
                    emHopY += Math.abs(Math.sin(gameElapsed * 15)) * 0.14;
                    emRoll = Math.sin(gameElapsed * 24) * 0.14;
                    emPitch = 0.12;
                  } else if (em === 'shy') {
                    emRoll = Math.sin(gameElapsed * 4.5) * 0.09;
                    emPitch = 0.15;
                  } else if (em === 'cheer' || em === 'dance') {
                    emHopY += Math.abs(Math.sin(gameElapsed * 8.5)) * 0.28;
                    emRoll = Math.sin(gameElapsed * 8.5) * 0.12;
                  } else if (em === 'laugh') {
                    emHopY += Math.abs(Math.sin(gameElapsed * 12)) * 0.12;
                    emPitch = -0.1 + Math.sin(gameElapsed * 14) * 0.08;
                  } else if (em === 'wave') {
                    emRoll = Math.sin(gameElapsed * 7) * 0.1;
                  }
                  rt.mesh.rotation.x = THREE.MathUtils.damp(rt.mesh.rotation.x, emPitch, 14, dt);
                  rt.mesh.rotation.z = THREE.MathUtils.damp(rt.mesh.rotation.z, emRoll, 14, dt);
                  rt.mesh.position.set(
                    rt.x,
                    sampleLevelHeight(activeLevel, rt.x, rt.z) + emHopY,
                    rt.z
                  );
                }
              }
              if (!skitAnimating && rt.kind === 'npc' && !rt.isBuddy && rt.critterAttitude && rt.critterAttitude !== 'none') {
                if (rt.warmedUp) {
                  if (dist < 10) {
                    const gYaw = Math.atan2(heroX - rt.x, heroZ - rt.z);
                    const yDiff = Math.atan2(
                      Math.sin(gYaw - rt.mesh.rotation.y),
                      Math.cos(gYaw - rt.mesh.rotation.y)
                    );
                    rt.mesh.rotation.y += yDiff * Math.min(1, dt * 6);
                  }
                  const cheerHop =
                    rt.critterCelebrateTimer > 0
                      ? Math.abs(Math.sin(gameElapsed * 9.5)) * 0.26
                      : 0;
                  rt.mesh.rotation.x = THREE.MathUtils.damp(rt.mesh.rotation.x, 0, 12, dt);
                  rt.mesh.rotation.z = THREE.MathUtils.damp(
                    rt.mesh.rotation.z,
                    rt.critterCelebrateTimer > 0 ? Math.sin(gameElapsed * 10) * 0.1 : 0,
                    12,
                    dt
                  );
                  rt.mesh.position.set(rt.x, sampleLevelHeight(activeLevel, rt.x, rt.z) + cheerHop, rt.z);
                } else if (rt.critterAttitude === 'nervous') {
                  if (dist < 6.4 && dist > 0.25) {
                    const awayX = (rt.x - heroX) / dist;
                    const awayZ = (rt.z - heroZ) / dist;
                    const homeDist = Math.hypot(rt.x - rt.startX, rt.z - rt.startZ);
                    if (homeDist < 6.5) {
                      const [resCX, resCZ] = resolveHorizontalCollision(
                        activeLevel,
                        rt.x + awayX * 2.1 * dt,
                        rt.z + awayZ * 2.1 * dt,
                        0.45,
                        false,
                        collisionCtx
                      );
                      rt.x = resCX;
                      rt.z = resCZ;
                      critterMoving = true;
                    }
                    const shyYaw = Math.atan2(awayX, awayZ) + 0.55;
                    const yDiff = Math.atan2(
                      Math.sin(shyYaw - rt.mesh.rotation.y),
                      Math.cos(shyYaw - rt.mesh.rotation.y)
                    );
                    rt.mesh.rotation.y += yDiff * Math.min(1, dt * 6);
                    rt.mesh.rotation.z = Math.sin(gameElapsed * 14) * 0.08;
                    const shyHop = critterMoving ? Math.abs(Math.sin(gameElapsed * 11)) * 0.07 : 0;
                    rt.mesh.position.set(rt.x, sampleLevelHeight(activeLevel, rt.x, rt.z) + shyHop, rt.z);
                  } else {
                    rt.mesh.rotation.z = THREE.MathUtils.damp(rt.mesh.rotation.z, 0, 10, dt);
                  }
                } else {
                  // 'teasing' or 'grumpy': turn toward hero and shake head indignantly when close
                  if (dist < 9.5) {
                    const baseYaw = Math.atan2(heroX - rt.x, heroZ - rt.z);
                    const scoldWobble = dist < 6.2 ? Math.sin(gameElapsed * 6.5) * 0.16 : 0;
                    const targetY = baseYaw + scoldWobble;
                    const yDiff = Math.atan2(
                      Math.sin(targetY - rt.mesh.rotation.y),
                      Math.cos(targetY - rt.mesh.rotation.y)
                    );
                    rt.mesh.rotation.y += yDiff * Math.min(1, dt * 8);
                    rt.mesh.rotation.z =
                      dist < 6.2 ? Math.sin(gameElapsed * 12) * 0.06 : THREE.MathUtils.damp(rt.mesh.rotation.z, 0, 10, dt);
                  }
                }
              } else if (!skitAnimating && (rt.mesh.rotation.x !== 0 || rt.mesh.rotation.z !== 0)) {
                rt.mesh.rotation.x = THREE.MathUtils.damp(rt.mesh.rotation.x, 0, 12, dt);
                rt.mesh.rotation.z = THREE.MathUtils.damp(rt.mesh.rotation.z, 0, 12, dt);
              }
              let npcWanderMoving = false;
              if (
                !skitAnimating &&
                rt.quadrupedRig &&
                !rt.isBuddy &&
                (!rt.critterAttitude || rt.critterAttitude === 'none')
              ) {
                if (dist < 3.6) {
                  const gYaw = Math.atan2(heroX - rt.x, heroZ - rt.z);
                  const yDiff = Math.atan2(
                    Math.sin(gYaw - rt.mesh.rotation.y),
                    Math.cos(gYaw - rt.mesh.rotation.y)
                  );
                  rt.mesh.rotation.y += yDiff * Math.min(1, dt * 6);
                } else {
                  // Desynchronized per-animal wandering + grazing pauses with strict fence/world collision
                  if (rt.npcWanderTimer === undefined) {
                    let hA = 2166136261;
                    for (let ai = 0; ai < rt.id.length; ai++) {
                      hA = Math.imul(hA ^ rt.id.charCodeAt(ai), 16777619);
                    }
                    const fracA = ((hA >>> 0) % 1000) / 1000;
                    rt.npcWanderAngle = fracA * Math.PI * 2;
                    rt.npcWanderTimer = 0.8 + fracA * 3.2;
                    rt.npcPauseTimer = fracA > 0.5 ? 1.2 + fracA * 1.8 : 0;
                  }
                  if ((rt.npcPauseTimer ?? 0) > 0) {
                    rt.npcPauseTimer = (rt.npcPauseTimer ?? 0) - dt;
                  } else {
                    rt.npcWanderTimer -= dt;
                    if (rt.npcWanderTimer <= 0) {
                      if (Math.random() < 0.36) {
                        rt.npcPauseTimer = 1.4 + Math.random() * 2.4;
                      }
                      const homeDist = Math.hypot(rt.x - rt.startX, rt.z - rt.startZ);
                      if (homeDist > 3.6) {
                        rt.npcWanderAngle =
                          Math.atan2(rt.startX - rt.x, rt.startZ - rt.z) + (Math.random() - 0.5) * 0.9;
                      } else {
                        rt.npcWanderAngle =
                          (rt.npcWanderAngle ?? Math.random() * Math.PI * 2) +
                          (Math.random() - 0.5) * 2.6;
                      }
                      rt.npcWanderTimer = 1.8 + Math.random() * 3.1;
                    }
                    const ang = rt.npcWanderAngle ?? 0;
                    const moveSpd = Math.max(1.05, Math.min(3.1, rt.speed * 0.48));
                    const stepN = moveSpd * dt;
                    const [wxN, wzN] = resolveHorizontalCollision(
                      activeLevel,
                      rt.x + Math.sin(ang) * stepN,
                      rt.z + Math.cos(ang) * stepN,
                      0.54,
                      false,
                      collisionCtx
                    );
                    if (Math.hypot(wxN - rt.x, wzN - rt.z) > stepN * 0.35) {
                      rt.x = wxN;
                      rt.z = wzN;
                      npcWanderMoving = true;
                    } else {
                      // Blocked by fence or obstacle — pick a fresh inward/clear direction immediately
                      rt.npcWanderAngle =
                        Math.atan2(rt.startX - rt.x, rt.startZ - rt.z) + (Math.random() - 0.5) * 1.5;
                      rt.npcWanderTimer = 1.2 + Math.random() * 1.6;
                    }
                    const yDiff = Math.atan2(
                      Math.sin(ang - rt.mesh.rotation.y),
                      Math.cos(ang - rt.mesh.rotation.y)
                    );
                    rt.mesh.rotation.y += yDiff * Math.min(1, dt * 4.5);
                  }
                }
                rt.mesh.position.set(rt.x, sampleLevelHeight(activeLevel, rt.x, rt.z) + (rt.elevationY ?? 0), rt.z);
              }
              if (rt.quadrupedRig) {
                const emCelebratesQ =
                  Boolean(rt.skitEmote) &&
                  (rt.skitEmote === 'cheer' ||
                    rt.skitEmote === 'dance' ||
                    rt.skitEmote === 'laugh');
                const qMoving = buddyMoving || critterMoving || npcWanderMoving || Boolean(rt.skitMoving);
                if (qMoving) {
                  rt.walkPhase += dt * (buddyMoving ? 8.2 : 5.4);
                }
                const fwdX = Math.sin(rt.mesh.rotation.y);
                const fwdZ = Math.cos(rt.mesh.rotation.y);
                const hAhead = sampleLevelHeight(activeLevel, rt.x + fwdX * 0.55, rt.z + fwdZ * 0.55);
                const hBehind = sampleLevelHeight(activeLevel, rt.x - fwdX * 0.55, rt.z - fwdZ * 0.55);
                const slopePitch = rt.quadrupedRig.canFly
                  ? 0
                  : THREE.MathUtils.clamp(-Math.atan2(hAhead - hBehind, 1.1), -0.45, 0.45);
                const qState: QuadrupedAnimState =
                  tavernCelebrated || emCelebratesQ || rt.critterCelebrateTimer > 0
                    ? 'celebrate'
                    : rt.quadrupedRig.canFly
                    ? 'fly'
                    : buddyMoving
                    ? 'run'
                    : qMoving
                    ? 'walk'
                    : 'idle';
                let qMood: CreatureExpressionMood = rt.quadrupedRig.blueprint.mouth.mood;
                if (rt.skitEmote === 'angry') qMood = 'angry';
                else if (rt.skitEmote === 'shy') qMood = 'shy';
                else if (rt.skitEmote === 'shock') qMood = 'open';
                else if (emCelebratesQ || tavernCelebrated || rt.critterCelebrateTimer > 0 || rt.warmedUp) {
                  qMood = 'happy';
                } else if (rt.critterAttitude === 'nervous') {
                  qMood = 'shy';
                } else if (rt.critterAttitude === 'grumpy' || rt.critterAttitude === 'teasing') {
                  qMood = 'angry';
                } else if (rt.isBuddy) {
                  qMood = 'happy';
                }
                animateQuadrupedMonster(
                  rt.quadrupedRig,
                  dt,
                  gameElapsed + (rt.x + rt.z) * 0.15,
                  rt.walkPhase,
                  buddyMoving ? 0.85 : qMoving ? 0.52 : 0,
                  qState,
                  0,
                  slopePitch,
                  0,
                  0,
                  undefined,
                  qMood,
                  qMood
                );
              }
              if (rt.creatureRefs) {
                const emCelebrates =
                  Boolean(rt.skitEmote) &&
                  (rt.skitEmote === 'cheer' ||
                    rt.skitEmote === 'dance' ||
                    rt.skitEmote === 'laugh' ||
                    rt.skitEmote === 'wave' ||
                    rt.skitEmote === 'shock');
                animateCreatureRig(
                  rt.creatureRefs,
                  gameElapsed + (rt.x + rt.z) * 0.15,
                  buddyMoving || critterMoving || Boolean(rt.skitMoving),
                  1.15,
                  tavernCelebrated || emCelebrates || rt.critterCelebrateTimer > 0
                );
              }

              // Universal Motion Studio presets & articulated rigs for NPCs, Buddy Critters, and custom GLBs
              if (rt.kind === 'npc') {
                const existingNpcSpeech = activeSpeechesRef.current.find((s) => s.key === rt.id);
                const isNpcSpeaking = Boolean(existingNpcSpeech && !existingNpcSpeech.isProximity);
                const isMovingNpc = buddyMoving || critterMoving || npcWanderMoving || Boolean(rt.skitMoving);
                const npcCategory: 'buddy' | 'npc' =
                  rt.isBuddy || rt.sourceEntity?.creatureType ? 'buddy' : 'npc';
                const logicTarget =
                  rt.logicAnimTimer > 0 && rt.logicAnimName
                    ? resolveLogicPlayAnimationTarget({
                        detail: rt.logicAnimName,
                        actorCategory: npcCategory,
                        project: activeProject,
                        entity: rt.sourceEntity,
                        monsterBp: rt.resolvedMonster,
                      })
                    : null;
                let npcSlot: CustomClipSlot = 'idle';
                if (logicTarget) {
                  npcSlot = logicTarget.slot;
                } else if (rt.skitEmote && rt.skitEmote !== 'none') {
                  npcSlot = rt.skitEmote as CustomClipSlot;
                } else if (tavernCelebrated || rt.critterCelebrateTimer > 0) {
                  npcSlot = 'cheer';
                } else if (!rt.warmedUp && rt.critterAttitude === 'nervous') {
                  npcSlot = critterMoving ? 'run' : 'shy';
                } else if (!rt.warmedUp && (rt.critterAttitude === 'grumpy' || rt.critterAttitude === 'teasing')) {
                  npcSlot = 'grumpy';
                } else if (isNpcSpeaking) {
                  npcSlot = 'talk';
                } else if (isMovingNpc) {
                  npcSlot = buddyMoving ? 'run' : 'walk';
                }

                const customNpcPreset = logicTarget
                  ? logicTarget.preset
                  : resolveMotionPresetForRuntime({
                      slot: npcSlot,
                      actorCategory: npcCategory,
                      project: activeProject,
                      entity: rt.sourceEntity,
                      monsterBp: rt.resolvedMonster,
                    });

                // Articulated Townsperson Procedural NPC Rig
                if (rt.npcRig) {
                  const nRig = rt.npcRig;
                  const phase = gameElapsed + (rt.x + rt.z) * 0.25;
                  const walkStride = isMovingNpc ? Math.sin(phase * 7.5) * 0.45 : 0;
                  const talkWave = isNpcSpeaking ? Math.sin(phase * 6.5) * 0.35 : 0;
                  const breath = Math.sin(phase * 2.1);
                  const dN = (cur: number, target: number, lmb = 12) => THREE.MathUtils.damp(cur, target, lmb, dt);
                  nRig.bodyPivot.position.y = dN(
                    nRig.bodyPivot.position.y,
                    rt.npcBaseBodyY + (isMovingNpc ? Math.abs(walkStride) * 0.05 : breath * 0.015),
                    12
                  );
                  nRig.bodyPivot.rotation.x = dN(nRig.bodyPivot.rotation.x, 0, 12);
                  nRig.bodyPivot.rotation.y = dN(nRig.bodyPivot.rotation.y, 0, 12);
                  nRig.bodyPivot.rotation.z = dN(nRig.bodyPivot.rotation.z, 0, 12);
                  if (nRig.spinePivot) {
                    nRig.spinePivot.rotation.x = dN(nRig.spinePivot.rotation.x, isNpcSpeaking ? -0.05 : 0, 12);
                    nRig.spinePivot.rotation.y = dN(nRig.spinePivot.rotation.y, isNpcSpeaking ? Math.sin(phase * 2.4) * 0.08 : 0, 12);
                    nRig.spinePivot.rotation.z = dN(nRig.spinePivot.rotation.z, 0, 12);
                  }
                  nRig.head.rotation.x = dN(nRig.head.rotation.x, isNpcSpeaking ? Math.sin(phase * 5.2) * 0.1 : breath * 0.03, 12);
                  nRig.head.rotation.y = dN(nRig.head.rotation.y, isNpcSpeaking ? Math.sin(phase * 2.8) * 0.14 : 0, 12);
                  nRig.armL.rotation.x = dN(nRig.armL.rotation.x, isNpcSpeaking ? -0.35 + talkWave * 0.4 : -walkStride * 0.65, 12);
                  nRig.armL.rotation.z = dN(nRig.armL.rotation.z, isNpcSpeaking ? 0.25 : 0.08, 12);
                  nRig.armR.rotation.x = dN(nRig.armR.rotation.x, isNpcSpeaking ? -0.45 - talkWave * 0.5 : walkStride * 0.65, 12);
                  nRig.armR.rotation.z = dN(nRig.armR.rotation.z, isNpcSpeaking ? -0.28 : -0.08, 12);
                  if (nRig.forearmL) nRig.forearmL.rotation.x = dN(nRig.forearmL.rotation.x, isNpcSpeaking ? -0.55 : -0.15, 12);
                  if (nRig.forearmR) nRig.forearmR.rotation.x = dN(nRig.forearmR.rotation.x, isNpcSpeaking ? -0.65 : -0.15, 12);
                  nRig.legL.rotation.x = dN(nRig.legL.rotation.x, walkStride, 12);
                  nRig.legR.rotation.x = dN(nRig.legR.rotation.x, -walkStride, 12);

                  if (customNpcPreset) {
                    const pKey = `${npcSlot}:${customNpcPreset.id}`;
                    if (rt.motionKey !== pKey) {
                      rt.motionKey = pKey;
                      rt.motionElapsed = 0;
                    }
                    rt.motionBlend = THREE.MathUtils.damp(rt.motionBlend, 1, 14, dt);
                    const dur = Math.max(0.1, customNpcPreset.duration);
                    rt.motionElapsed += dt;
                    const tNorm = logicTarget && rt.logicAnimTimer > 0
                      ? ((rt.logicAnimDuration - rt.logicAnimTimer) / dur) % 1
                      : customNpcPreset.loop
                      ? (rt.motionElapsed / dur) % 1
                      : Math.min(1, rt.motionElapsed / dur);
                    applyMotionPresetToHeroRigRuntime(
                      nRig,
                      customNpcPreset,
                      tNorm,
                      rt.motionBlend,
                      false,
                      rt.npcBaseBodyY
                    );
                  } else {
                    rt.motionBlend = THREE.MathUtils.damp(rt.motionBlend, 0, 14, dt);
                    if (rt.motionBlend <= 0.02) rt.motionKey = '';
                  }
                } else if (rt.creatureHeroRig) {
                  const cRig = rt.creatureHeroRig;
                  const phase = gameElapsed + (rt.x + rt.z) * 0.25;
                  const isBuddyRun = buddyMoving;
                  const walkStride = isMovingNpc
                    ? Math.sin(phase * (isBuddyRun ? 10.5 : 7.6)) * (isBuddyRun ? 0.68 : 0.45)
                    : 0;
                  const breath = Math.sin(phase * 2.1);
                  const dC = (cur: number, target: number, lmb = 12) => THREE.MathUtils.damp(cur, target, lmb, dt);
                  const celebratingNow = npcSlot === 'cheer' || npcSlot === 'celebrate';
                  const shyNow = npcSlot === 'shy';
                  const grumpyNow = npcSlot === 'grumpy';

                  cRig.bodyPivot.position.y = dC(
                    cRig.bodyPivot.position.y,
                    rt.creatureBaseBodyY + (isMovingNpc ? -Math.abs(walkStride) * 0.03 : 0),
                    14
                  );
                  cRig.bodyPivot.rotation.x = dC(cRig.bodyPivot.rotation.x, isMovingNpc ? (isBuddyRun ? 0.1 : 0.05) : 0, 12);
                  cRig.bodyPivot.rotation.y = dC(cRig.bodyPivot.rotation.y, isMovingNpc ? -walkStride * 0.1 : 0, 12);
                  cRig.bodyPivot.rotation.z = dC(cRig.bodyPivot.rotation.z, isMovingNpc ? walkStride * 0.05 : 0, 12);

                  if (cRig.spinePivot) {
                    cRig.spinePivot.rotation.x = dC(
                      cRig.spinePivot.rotation.x,
                      isMovingNpc ? (isBuddyRun ? 0.2 : 0.1) : grumpyNow ? 0.16 : shyNow ? 0.14 : breath * 0.04,
                      12
                    );
                    cRig.spinePivot.rotation.y = dC(
                      cRig.spinePivot.rotation.y,
                      isMovingNpc ? walkStride * 0.18 : isNpcSpeaking ? Math.sin(phase * 2.6) * 0.1 : 0,
                      12
                    );
                  }
                  cRig.head.rotation.x = dC(
                    cRig.head.rotation.x,
                    celebratingNow
                      ? -0.22 + Math.sin(phase * 9) * 0.08
                      : shyNow
                      ? 0.32
                      : grumpyNow
                      ? 0.28
                      : isMovingNpc
                      ? -0.1 + Math.abs(Math.cos(phase * (isBuddyRun ? 10.5 : 7.6))) * 0.08
                      : isNpcSpeaking
                      ? Math.sin(phase * 5.2) * 0.1
                      : breath * 0.05,
                    12
                  );
                  cRig.head.rotation.y = dC(
                    cRig.head.rotation.y,
                    isMovingNpc
                      ? -walkStride * 0.22
                      : shyNow
                      ? Math.sin(phase * 2.6) * 0.38
                      : grumpyNow
                      ? Math.sin(phase * 4.5) * 0.22
                      : Math.sin(phase * 1.1) * 0.14,
                    12
                  );

                  const targetArmLX = celebratingNow
                    ? -2.35 + Math.sin(phase * 9) * 0.2
                    : shyNow
                    ? -0.45
                    : grumpyNow
                    ? -0.78
                    : isMovingNpc
                    ? -walkStride * 0.72
                    : isNpcSpeaking
                    ? -0.38 + Math.sin(phase * 6.5) * 0.28
                    : breath * 0.05;
                  const targetArmRX = celebratingNow
                    ? -2.35 - Math.sin(phase * 9) * 0.2
                    : shyNow
                    ? -0.45
                    : grumpyNow
                    ? -0.78
                    : isMovingNpc
                    ? walkStride * 0.72
                    : isNpcSpeaking
                    ? -0.48 - Math.sin(phase * 6.5) * 0.32
                    : -breath * 0.05;

                  cRig.armL.rotation.x = dC(cRig.armL.rotation.x, targetArmLX, 12);
                  cRig.armL.rotation.z = dC(cRig.armL.rotation.z, celebratingNow ? 0.38 : grumpyNow ? -0.18 : 0.14, 12);
                  cRig.armR.rotation.x = dC(cRig.armR.rotation.x, targetArmRX, 12);
                  cRig.armR.rotation.z = dC(cRig.armR.rotation.z, celebratingNow ? -0.38 : grumpyNow ? 0.18 : -0.14, 12);
                  if (cRig.forearmL) {
                    cRig.forearmL.rotation.x = dC(
                      cRig.forearmL.rotation.x,
                      grumpyNow ? -1.4 : shyNow ? -1.1 : isMovingNpc ? (isBuddyRun ? -0.75 : -0.36) : -0.22,
                      12
                    );
                  }
                  if (cRig.forearmR) {
                    cRig.forearmR.rotation.x = dC(
                      cRig.forearmR.rotation.x,
                      grumpyNow ? -1.4 : shyNow ? -1.1 : isMovingNpc ? (isBuddyRun ? -0.75 : -0.36) : -0.22,
                      12
                    );
                  }
                  cRig.legL.rotation.x = dC(cRig.legL.rotation.x, walkStride, 12);
                  cRig.legR.rotation.x = dC(cRig.legR.rotation.x, -walkStride, 12);

                  if (customNpcPreset) {
                    // Overlay custom Buddy Critter motion preset on top of creature rig
                    const pKey = `${npcSlot}:${customNpcPreset.id}`;
                    if (rt.motionKey !== pKey) {
                      rt.motionKey = pKey;
                      rt.motionElapsed = 0;
                    }
                    rt.motionBlend = THREE.MathUtils.damp(rt.motionBlend, 1, 14, dt);
                    const dur = Math.max(0.1, customNpcPreset.duration);
                    rt.motionElapsed += dt;
                    const tNorm = logicTarget && rt.logicAnimTimer > 0
                      ? ((rt.logicAnimDuration - rt.logicAnimTimer) / dur) % 1
                      : customNpcPreset.loop
                      ? (rt.motionElapsed / dur) % 1
                      : Math.min(1, rt.motionElapsed / dur);
                    applyMotionPresetToHeroRigRuntime(
                      cRig,
                      customNpcPreset,
                      tNorm,
                      rt.motionBlend,
                      false,
                      rt.creatureBaseBodyY
                    );
                  } else {
                    rt.motionBlend = THREE.MathUtils.damp(rt.motionBlend, 0, 14, dt);
                    if (rt.motionBlend <= 0.02) rt.motionKey = '';
                  }
                } else if (rt.quadrupedRig && customNpcPreset) {
                  const pKey = `${npcSlot}:${customNpcPreset.id}`;
                  if (rt.motionKey !== pKey) {
                    rt.motionKey = pKey;
                    rt.motionElapsed = 0;
                  }
                  rt.motionBlend = THREE.MathUtils.damp(rt.motionBlend, 1, 14, dt);
                  const dur = Math.max(0.1, customNpcPreset.duration);
                  rt.motionElapsed += dt;
                  const tNorm = customNpcPreset.loop
                    ? (rt.motionElapsed / dur) % 1
                    : Math.min(1, rt.motionElapsed / dur);
                  applyMotionPresetToQuadrupedRuntime(
                    rt.quadrupedRig,
                    customNpcPreset,
                    tNorm,
                    rt.motionBlend,
                    dt
                  );
                } else if (rt.customInst) {
                  if (logicTarget?.preset) {
                    const dur = Math.max(0.1, logicTarget.preset.duration);
                    const tNorm = ((rt.logicAnimDuration - rt.logicAnimTimer) / dur) % 1;
                    rt.customInst.setTestOverride({
                      kind: 'presetPreview',
                      preset: logicTarget.preset,
                      timeNorm: tNorm,
                      playing: false,
                    });
                  } else {
                    rt.customInst.setTestOverride(null);
                  }
                  rt.customInst.setAction(npcSlot, 0.14);
                } else {
                  rt.motionBlend = THREE.MathUtils.damp(rt.motionBlend, 0, 14, dt);
                  if (rt.motionBlend <= 0.02) rt.motionKey = '';
                }
              }

              const existingSpeech = activeSpeechesRef.current.find((s) => s.key === rt.id);
              const inBubblesMode = chatSettingsRef.current.displayMode === 'bubbles';
              const rtOutputMode = resolveEffectiveDialogueMode(
                chatSettingsRef.current,
                rt.voiceConfig
              );
              const autoDist = rt.chatStyle.autoShowDistance;

              const npcTalkRadius = rt.recruited ? 2.1 : 2.8;
              const toNpcX = rt.x - heroX;
              const toNpcZ = rt.z - heroZ;
              const toNpcLen = Math.max(0.01, Math.hypot(toNpcX, toNpcZ));
              const facingNpcDot =
                (toNpcX / toNpcLen) * Math.sin(heroYaw) + (toNpcZ / toNpcLen) * Math.cos(heroYaw);
              const canTalkToNpcNow =
                dist < npcTalkRadius &&
                !heroNearPriorityChestOrDoor &&
                (!rt.recruited || facingNpcDot > 0.32);

              if (canTalkToNpcNow) {
                nearInteractableEntity = true;
              }
              if (didInteract && !interactConsumed && canTalkToNpcNow) {
                interactConsumed = true;
                if (rt.pickupable && rt.pickupItemId && !rt.giftGiven) {
                  rt.giftGiven = true;
                  const itemDef = itemByIdRef.current.get(rt.pickupItemId);
                  addItemToBag(
                    rt.pickupItemId,
                    rt.pickupQty,
                    itemDef?.category === 'tool' || itemDef?.category === 'weapon'
                  );
                  AudioEngine.playSound('chime');
                  showToast(`${rt.name} gave you ${itemDef?.name ?? 'an item'}!`);
                }
                if (existingSpeech && !existingSpeech.isProximity) {
                  advanceOrDismissSpeech(rt.id);
                } else {
                  pushCharacterSpeech(
                    {
                      key: rt.id,
                      entityId: rt.id,
                      speaker: rt.name,
                      roleLabel: EntityKindMeta[rt.kind as EntityKind]?.title ?? 'Character',
                      kind: rt.kind as EntityKind,
                      lines: rt.dialogueLines,
                      lineIndex: 0,
                      style: rt.chatStyle,
                      voiceConfig: rt.voiceConfig,
                      isProximity: false,
                      expiresAt: null,
                    },
                    true,
                    true
                  );
                }
              } else if (
                (inBubblesMode || rtOutputMode === 'audio') &&
                rt.chatStyle.autoShowOnApproach &&
                !rt.recruited
              ) {
                if (dist <= autoDist && !existingSpeech) {
                  const nowMs = performance.now();
                  const allowProxVoice = nowMs - rt.lastProximityVoiceAt > 12000;
                  if (allowProxVoice && rtOutputMode !== 'text') {
                    rt.lastProximityVoiceAt = nowMs;
                  }
                  pushCharacterSpeech(
                    {
                      key: rt.id,
                      entityId: rt.id,
                      speaker: rt.name,
                      roleLabel: EntityKindMeta[rt.kind as EntityKind]?.title ?? 'Character',
                      kind: rt.kind as EntityKind,
                      lines: rt.dialogueLines,
                      lineIndex: 0,
                      style: rt.chatStyle,
                      voiceConfig: rt.voiceConfig,
                      isProximity: true,
                      expiresAt: null,
                    },
                    false,
                    allowProxVoice
                  );
                } else if (dist > autoDist + 1.5 && existingSpeech && existingSpeech.isProximity) {
                  dismissCharacterSpeech(rt.id);
                }
              } else if (existingSpeech && existingSpeech.isProximity && !inBubblesMode && rtOutputMode !== 'audio') {
                dismissCharacterSpeech(rt.id);
              }
            } else if (rt.kind === 'door') {
              if (dist < 2.6 && vertOk) {
                const isLocked = Boolean(rt.requiresKey && !rt.opened && keys === 0);
                if (dist < nearestDoorPromptDist) {
                  nearestDoorPromptDist = dist;
                  nearestDoorPrompt = { label: rt.name, isOpen: rt.opened, locked: isLocked };
                }
                if (!rt.requiresKey) {
                  if (didInteract && !interactConsumed) {
                    interactConsumed = true;
                    rt.opened = !rt.opened;
                    if (rt.opened) openedDoorIds.add(rt.id);
                    else openedDoorIds.delete(rt.id);
                    AudioEngine.playSound(activeLevel.audio.door);
                    showToast(`${rt.name} ${rt.opened ? 'opened' : 'closed'}`);
                  }
                } else if (!rt.opened && (didInteract || (keys > 0 && dist < 2.2))) {
                  interactConsumed = true;
                  if (keys > 0) {
                    keys -= 1;
                    rt.opened = true;
                    openedDoorIds.add(rt.id);
                    AudioEngine.playSound(activeLevel.audio.door);
                    showToast(`${rt.name} unlocked!`);
                  } else if (didInteract) {
                    showToast('Locked! Find a key first.');
                  }
                }
              }
            } else if (rt.kind === 'baddie') {
              rt.attackCooldown = Math.max(0, rt.attackCooldown - simDt);
              rt.hitFlashTimer = Math.max(0, rt.hitFlashTimer - dt);
              rt.recoilPitch = THREE.MathUtils.damp(rt.recoilPitch, 0, 9.5, dt);
              rt.recoilRoll = THREE.MathUtils.damp(rt.recoilRoll, 0, 9.5, dt);

              const aiCfg =
                rt.baddieAI ??
                resolveBaddieAIConfig({
                  name: rt.name,
                  brain: rt.brain,
                  isBoss: rt.isBoss,
                });
              const canFly = Boolean(rt.quadrupedRig?.canFly || rt.baddieRig?.isFlyer);

              // Apply physical knockback/lunge velocity and vertical hop gravity
              if (Math.abs(rt.vx) > 0.03 || Math.abs(rt.vz) > 0.03) {
                const [kx, kz] = resolveHorizontalCollision(
                  activeLevel,
                  rt.x + rt.vx * simDt,
                  rt.z + rt.vz * simDt,
                  0.6,
                  false,
                  collisionCtx
                );
                rt.x = kx;
                rt.z = kz;
                const drag = rt.aiState === 'strike' ? 5.2 : 7.4;
                rt.vx = THREE.MathUtils.damp(rt.vx, 0, drag, dt);
                rt.vz = THREE.MathUtils.damp(rt.vz, 0, drag, dt);
              } else {
                rt.vx = 0;
                rt.vz = 0;
              }

              if (rt.yOffset > 0 || rt.vy !== 0) {
                rt.vy -= 21 * simDt;
                rt.yOffset += rt.vy * simDt;
                if (rt.yOffset <= 0) {
                  rt.yOffset = 0;
                  rt.vy = 0;
                }
              }

              if (
                rt.monsterAbility === 'regenerator' &&
                rt.alive &&
                rt.aiState !== 'dying' &&
                rt.aiState !== 'stagger' &&
                rt.health < rt.maxHealth
              ) {
                rt.regenTimer += simDt;
                if (rt.regenTimer >= 5.5) {
                  rt.regenTimer = 0;
                  rt.health = Math.min(rt.maxHealth, rt.health + 1);
                  spawnCombatSparks(
                    rt.x,
                    sampleLevelHeight(activeLevel, rt.x, rt.z) + rt.flightY + 1.0,
                    rt.z,
                    '#4ADE80',
                    5,
                    3.8
                  );
                }
              }

              // Spatial + Sight-Cone detection check
              const dxToHero = heroX - rt.x;
              const dzToHero = heroZ - rt.z;
              const invDist = dist > 0.01 ? 1 / dist : 0;
              const faceX = Math.sin(rt.mesh.rotation.y);
              const faceZ = Math.cos(rt.mesh.rotation.y);
              const sightDot = dist > 0.01 ? (dxToHero * invDist) * faceX + (dzToHero * invDist) * faceZ : 1;
              const sightCos = Math.cos((((aiCfg.sightAngleDeg ?? 120) * 0.5) * Math.PI) / 180);
              const aggroRange = aiCfg.aggroRange;
              const inSpatial = dist <= aggroRange;
              const inSight = dist <= aggroRange * 1.22 && sightDot >= sightCos;
              const damagedAggro = rt.health < rt.maxHealth && dist <= aggroRange * 1.35;
              const heroDetected =
                aiCfg.detectionMode === 'spatial'
                  ? inSpatial || damagedAggro
                  : aiCfg.detectionMode === 'sight'
                  ? inSight || damagedAggro
                  : inSpatial || inSight || damagedAggro;

              // Evaluate Baddie Logic BehaviorCards (seesPlayer, playerNear, isFlying, isGrounded, flyPattern, randomAttack, landAndAttack, enrage, attack)
              if (rt.aiState !== 'dying' && rt.cards.length > 0) {
                for (const card of rt.cards) {
                  if (!card.isEnabled) continue;
                  const trig = card.when;
                  let trigOk = false;
                  if (trig.key === 'seesPlayer') {
                    const customRange = Number(trig.detail);
                    trigOk =
                      Number.isFinite(customRange) && customRange > 0
                        ? dist <= customRange
                        : heroDetected;
                  } else if (trig.key === 'playerNear') {
                    const customRange = Number(trig.detail);
                    trigOk = dist <= (Number.isFinite(customRange) && customRange > 0 ? customRange : 6.5);
                  } else if (trig.key === 'takesDamage') {
                    trigOk = rt.hitFlashTimer > 0.14;
                  } else if (trig.key === 'healthLow') {
                    trigOk = rt.health <= Math.max(1, Math.ceil(rt.maxHealth * 0.5));
                  } else if (trig.key === 'timer') {
                    const sec = Math.max(2, Number(trig.detail) || 5);
                    trigOk = Math.floor(gameElapsed * 10) % (sec * 10) === 0;
                  } else if (trig.key === 'gameStart') {
                    trigOk = gameElapsed < 0.12;
                  }
                  if (!trigOk) continue;

                  let condsOk = true;
                  for (const cond of card.conditions) {
                    if (cond.key === 'isFlying' && !(canFly && rt.flightY > 0.45)) {
                      condsOk = false;
                      break;
                    }
                    if (cond.key === 'isGrounded' && canFly && rt.flightY > 0.45) {
                      condsOk = false;
                      break;
                    }
                    if (cond.key === 'isBoss' && !rt.isBoss) {
                      condsOk = false;
                      break;
                    }
                    if (cond.key === 'playerClose' && dist > 6.5) {
                      condsOk = false;
                      break;
                    }
                    if (cond.key === 'flagSet' && (!cond.detail || !gameFlags.has(cond.detail))) {
                      condsOk = false;
                      break;
                    }
                    if (cond.key === 'hasKey' && keys <= 0) {
                      condsOk = false;
                      break;
                    }
                    if (cond.key === 'healthHalf' && rt.health > Math.ceil(rt.maxHealth * 0.5)) {
                      condsOk = false;
                      break;
                    }
                  }
                  if (!condsOk) continue;

                  for (const act of card.actions) {
                    if (act.key === 'chase') {
                      rt.behaviorChaseOrdered = true;
                      rt.behaviorFleeOrdered = false;
                    } else if (act.key === 'flee') {
                      rt.behaviorFleeOrdered = true;
                      rt.behaviorChaseOrdered = false;
                    } else if (act.key === 'patrol') {
                      rt.behaviorChaseOrdered = false;
                      rt.behaviorFleeOrdered = false;
                    } else if (act.key === 'flyPattern' && act.detail) {
                      const dLow = act.detail.trim().toLowerCase();
                      if (
                        dLow === 'circle' ||
                        dLow === 'figure8' ||
                        dLow === 'swoop' ||
                        dLow === 'hover'
                      ) {
                        aiCfg.flightPattern = dLow;
                      }
                    } else if (act.key === 'attack') {
                      if (
                        rt.attackCooldown <= 0 &&
                        (rt.aiState === 'patrol' || rt.aiState === 'chase') &&
                        !rt.behaviorAttackQueue
                      ) {
                        const resolved = resolveBaddieActionId(act.detail);
                        rt.behaviorAttackQueue = resolved ?? aiCfg.primaryAction;
                      }
                    } else if (act.key === 'randomAttack') {
                      if (
                        rt.attackCooldown <= 0 &&
                        (rt.aiState === 'patrol' || rt.aiState === 'chase') &&
                        !rt.behaviorAttackQueue
                      ) {
                        rt.behaviorAttackQueue = pickNextBaddieAction(
                          aiCfg,
                          rt.activeAttack,
                          dist,
                          canFly && rt.flightY > 0.35,
                          canFly
                        );
                      }
                    } else if (act.key === 'landAndAttack') {
                      if (
                        rt.attackCooldown <= 0 &&
                        (rt.aiState === 'patrol' || rt.aiState === 'chase') &&
                        !rt.behaviorAttackQueue
                      ) {
                        const resolved = resolveBaddieActionId(act.detail);
                        rt.behaviorAttackQueue = resolved ?? 'groundPound';
                      }
                    } else if (act.key === 'enrage') {
                      if (!rt.enraged) {
                        rt.enraged = true;
                        showToast(`${rt.name} erupts with fury!`);
                      }
                    }
                  }
                }
              }

              let curAttack = rt.activeAttack ?? aiCfg.primaryAction ?? 'clawSlash';
              let actionDef = BADDIE_ACTION_BY_ID[curAttack] ?? BADDIE_ACTION_BY_ID.clawSlash;
              const berserkActive =
                rt.enraged ||
                (rt.monsterAbility === 'berserk' && rt.health <= Math.max(1, rt.maxHealth * 0.5));
              const windupTotal = actionDef.windupDuration;
              const strikeTotal = actionDef.strikeDuration;

              const attackReach =
                actionDef.category === 'smash' || actionDef.category === 'melee'
                  ? actionDef.defaultRange
                  : Math.max(actionDef.defaultRange, rt.monsterAttackRange ?? actionDef.defaultRange);
              const bSpeed = Math.max(1.8, rt.speed * 0.95 * (berserkActive ? 1.26 : 1));
              let movingBaddie = false;

              if (rt.aiState === 'dying') {
                if (rt.hpBar) {
                  rt.hpBar.opacity = 0;
                  rt.hpBar.mat.opacity = 0;
                  rt.hpBar.group.visible = false;
                  rt.hpBar.mesh.visible = false;
                }
                rt.stateTimer -= dt;
                if (rapierTumblingIds.has(rt.id)) {
                  const dyingScale = THREE.MathUtils.clamp(rt.stateTimer / 0.28, 0.01, 1);
                  rt.mesh.scale.setScalar(dyingScale * Math.max(0.25, rt.entityScale || 1));
                  if (rt.stateTimer <= 0) {
                    rapierTumblingIds.delete(rt.id);
                    rapierPhysics?.removeProp(rt.id);
                    rt.deathFinalized = true;
                    rt.alive = false;
                    rt.mesh.visible = false;
                  }
                  continue;
                }
                if (canFly && rt.flightY > 0) {
                  rt.flightY = Math.max(0, rt.flightY - dt * 7.2);
                }
                if (rt.defeatSpin !== 0) {
                  rt.mesh.rotation.y += rt.defeatSpin * dt;
                }
                if (rt.baddieRig && !rt.quadrupedRig) {
                  const hasCustomDying = Boolean(
                    resolveMotionPresetForRuntime({
                      slot: 'dying',
                      actorCategory: 'enemy',
                      project: activeProject,
                      entity: rt.sourceEntity,
                      monsterBp: rt.resolvedMonster,
                    })
                  );
                  const fadeWindow = hasCustomDying ? 0.25 : 0.3;
                  const dyingScale = THREE.MathUtils.clamp(rt.stateTimer / fadeWindow, 0.01, 1);
                  rt.mesh.scale.setScalar(dyingScale);
                }
                if (rt.stateTimer <= 0) {
                  rt.deathFinalized = true;
                  rt.alive = false;
                  rt.mesh.visible = false;
                  if (rt.hpBar) {
                    rt.hpBar.group.visible = false;
                    rt.hpBar.opacity = 0;
                  }
                  continue;
                }
              } else if (rt.aiState === 'stagger') {
                rt.stateTimer -= simDt;
                if (rt.stateTimer <= 0) {
                  rt.aiState = heroDetected ? 'chase' : 'patrol';
                }
              } else if (rt.aiState === 'landing') {
                rt.stateTimer -= simDt;
                rt.targetFlightY = 0;
                rt.flightY = Math.max(0, rt.flightY - dt * 6.8);
                if (dist > 0.1) {
                  rt.mesh.rotation.y = Math.atan2(dxToHero * invDist, dzToHero * invDist);
                }
                if (rt.flightY <= 0.14 || rt.stateTimer <= 0) {
                  rt.flightY = 0;
                  rt.aiState = 'windup';
                  rt.stateTimer = windupTotal;
                  rt.attackDirX = dist > 0.1 ? dxToHero * invDist : Math.sin(rt.mesh.rotation.y);
                  rt.attackDirZ = dist > 0.1 ? dzToHero * invDist : Math.cos(rt.mesh.rotation.y);
                  rt.lockedTargetX = heroX;
                  rt.lockedTargetZ = heroZ;
                  rt.strikeDidHit = false;
                  heroEffects.emitKnockdownImpact(rt.x, sampleLevelHeight(activeLevel, rt.x, rt.z), rt.z);
                }
              } else if (rt.aiState === 'windup') {
                rt.stateTimer -= simDt;
                const windupProg = THREE.MathUtils.clamp(
                  1 - rt.stateTimer / Math.max(0.05, windupTotal),
                  0,
                  1
                );
                if (rt.quadrupedRig) {
                  monsterVfx.emitAttackStep(rt.quadrupedRig, curAttack, 'windup', windupProg, simDt);
                }
                // Brief aim settle in first 15% of windup, then STRICT lock-on so hero can sidestep or dodge!
                if (rt.stateTimer > windupTotal * 0.85 && dist > 0.1) {
                  rt.attackDirX = dxToHero * invDist;
                  rt.attackDirZ = dzToHero * invDist;
                  rt.lockedTargetX = heroX;
                  rt.lockedTargetZ = heroZ;
                  rt.mesh.rotation.y = Math.atan2(rt.attackDirX, rt.attackDirZ);
                }
                const lockGroundY = sampleLevelHeight(activeLevel, rt.lockedTargetX, rt.lockedTargetZ);
                monsterVfx.emitLockedTelegraph(
                  rt.lockedTargetX,
                  lockGroundY,
                  rt.lockedTargetZ,
                  actionDef.coneHalfAngleCos <= -0.9 ? actionDef.aoeRadius : Math.min(3.0, actionDef.aoeRadius),
                  actionDef.telegraphColor,
                  windupProg
                );
                if (rt.stateTimer <= 0) {
                  rt.aiState = 'strike';
                  rt.stateTimer = strikeTotal;
                  rt.strikeDidHit = false;
                  const lungeMult =
                    curAttack === 'chargeGore'
                      ? 1.45
                      : actionDef.category === 'breath' || actionDef.category === 'spell' || actionDef.category === 'smash'
                      ? 0.16
                      : 0.95;
                  const lungeSpeed = (rt.isBoss ? 8.8 : 8.0) * lungeMult;
                  rt.vx += rt.attackDirX * lungeSpeed;
                  rt.vz += rt.attackDirZ * lungeSpeed;
                  if (actionDef.id === 'waterJet') {
                    AudioEngine.playSound('splash');
                  } else if (
                    actionDef.id === 'electricShock' ||
                    actionDef.id === 'solarBeam' ||
                    actionDef.id === 'iceBreath'
                  ) {
                    AudioEngine.playSound('sparkle');
                  } else if (actionDef.id === 'sonicRoar' || actionDef.id === 'groundPound') {
                    AudioEngine.playSound('hit');
                  } else {
                    AudioEngine.playSound('whoosh');
                  }
                  rt.customInst?.setAction('attack', 0.06);
                }
              } else if (rt.aiState === 'strike') {
                rt.stateTimer -= simDt;
                const strikeProg = THREE.MathUtils.clamp(
                  1 - rt.stateTimer / Math.max(0.05, strikeTotal),
                  0,
                  1
                );
                if (rt.quadrupedRig) {
                  monsterVfx.emitAttackStep(rt.quadrupedRig, curAttack, 'strike', strikeProg, simDt);
                }
                // Active enemy strike frames against the LOCKED heading / target zone (fully dodgeable!)
                if (
                  !rt.strikeDidHit &&
                  strikeProg >= 0.16 &&
                  strikeProg <= 0.88 &&
                  hitInvuln <= 0
                ) {
                  const curDx = heroX - rt.x;
                  const curDz = heroZ - rt.z;
                  const curDist = Math.hypot(curDx, curDz);
                  const dot =
                    curDist > 0.01
                      ? (curDx / curDist) * rt.attackDirX + (curDz / curDist) * rt.attackDirZ
                      : 1;
                  const ryCheck = sampleLevelHeight(activeLevel, rt.x, rt.z) + (rt.elevationY ?? 0);
                  const verticalLimit =
                    actionDef.category === 'breath' ||
                    actionDef.category === 'spell' ||
                    actionDef.category === 'smash' ||
                    actionDef.category === 'roar'
                      ? 3.2
                      : 2.1;

                  let didStrikeConnect = false;
                  if (actionDef.coneHalfAngleCos <= -0.9) {
                    const distToLock = Math.hypot(heroX - rt.lockedTargetX, heroZ - rt.lockedTargetZ);
                    didStrikeConnect =
                      curDist <= actionDef.aoeRadius || distToLock <= actionDef.aoeRadius * 0.88;
                  } else {
                    const hitReach = Math.max(attackReach, actionDef.defaultRange);
                    didStrikeConnect =
                      curDist <= hitReach &&
                      (dot >= actionDef.coneHalfAngleCos || curDist < 1.15);
                  }

                  if (didStrikeConnect && Math.abs(heroY - ryCheck) < verticalLimit) {
                    rt.strikeDidHit = true;
                    const rawHitDmg = Math.max(
                      1,
                      Math.round((rt.monsterAttackPower ?? actionDef.directDamage) * (berserkActive ? 1.35 : 1))
                    );
                    const baddieDesc: EnemyTargetDescriptors = {
                      isBoss: rt.isBoss,
                      isFlying: Boolean(rt.quadrupedRig?.canFly || rt.baddieRig?.isFlyer || rt.flightY > 0.35),
                      isBeast: Boolean(rt.quadrupedRig),
                      isElemental:
                        actionDef.heroEffect === 'burn' ||
                        actionDef.heroEffect === 'freeze' ||
                        actionDef.heroEffect === 'shock' ||
                        actionDef.heroEffect === 'poison' ||
                        actionDef.heroEffect === 'soak',
                      isHeavyBrute: rt.maxHealth >= 8 || actionDef.heroEffect === 'knockdown',
                    };
                    const incomingCalc = computeHeroIncomingDamage(
                      rawHitDmg,
                      effectiveHeroDefense,
                      heroProfile,
                      actionDef,
                      baddieDesc
                    );
                    let incomingDmg = incomingCalc.damage;
                    const shieldedBlock = Boolean(isShieldBlockingNow && activeOffhandDefNow);
                    if (shieldedBlock) {
                      const blockRed = THREE.MathUtils.clamp(
                        activeOffhandDefNow?.blockReduction ?? 0.65,
                        0.25,
                        0.92
                      );
                      const preBlockDmg = incomingDmg;
                      incomingDmg = Math.max(0, Math.round(preBlockDmg * (1 - blockRed)));
                      const blockedAmount = Math.max(1, preBlockDmg - incomingDmg);
                      spawnCombatSparks(
                        heroX + Math.sin(heroYaw) * 0.52,
                        heroY + 1.15,
                        heroZ + Math.cos(heroYaw) * 0.52,
                        '#60A5FA',
                        12,
                        6.4
                      );
                      wearShieldDurability(2);
                      showToast(
                        incomingDmg === 0
                          ? `Shield blocked ${rt.name}'s attack!`
                          : `Shield blocked! (-${blockedAmount} dmg)`
                      );
                    } else if (effectiveHeroDefense > 0) {
                      armorBlockCounter += effectiveHeroDefense;
                      if (armorBlockCounter >= 3) {
                        armorBlockCounter -= 3;
                        incomingDmg = 0;
                        spawnCombatSparks(heroX, heroY + 1.1, heroZ, '#38BDF8', 9, 5.8);
                        showToast('Armor deflected the blow!');
                      }
                    }
                    if (incomingDmg > 0) {
                      health -= incomingDmg;
                      if (incomingCalc.note && !shieldedBlock) {
                        showToast(incomingCalc.note);
                      }
                    }
                    const invulnScale =
                      heroProfile.stats.dodgeInvulnMult * (heroSkillSet.has('glassCannon') ? 0.75 : 1);
                    hitInvuln = 0.95 * invulnScale;
                    shakeTimer = shieldedBlock ? 0.11 : incomingDmg > 0 ? 0.28 : 0.1;
                    hitStopTimer = 0.04;
                    const kbDirX =
                      actionDef.coneHalfAngleCos <= -0.9 && curDist > 0.05
                        ? curDx / curDist
                        : rt.attackDirX;
                    const kbDirZ =
                      actionDef.coneHalfAngleCos <= -0.9 && curDist > 0.05
                        ? curDz / curDist
                        : rt.attackDirZ;
                    const kbMag = shieldedBlock
                      ? actionDef.knockbackForce * 0.42
                      : incomingDmg > 0
                      ? Math.max(actionDef.knockbackForce, 6.2)
                      : 4.2;
                    // Compute realistic directional hit reaction on Hero (front, rear, or left/right flank)
                    const hFwdX = Math.sin(heroYaw);
                    const hFwdZ = Math.cos(heroYaw);
                    const hRightX = Math.cos(heroYaw);
                    const hRightZ = -Math.sin(heroYaw);
                    const hitFromBehindDot = kbDirX * hFwdX + kbDirZ * hFwdZ;
                    const hitSideDot = kbDirX * hRightX + kbDirZ * hRightZ;
                    heroHitPitchDir = hitFromBehindDot > 0.35 ? 1 : -1;
                    heroHitRollDir = THREE.MathUtils.clamp(-hitSideDot * 1.25, -1, 1);

                    const rearFlankMult = !shieldedBlock && hitFromBehindDot > 0.35 ? 1.18 : 1.0;
                    heroKnockVX = kbDirX * kbMag * rearFlankMult;
                    heroKnockVZ = kbDirZ * kbMag * rearFlankMult;
                    if (!shieldedBlock && !isSwimming && heroY <= floorY + 0.22 && incomingDmg > 0) {
                      heroVelY = actionDef.heroEffect === 'knockdown' ? 3.8 : 2.9;
                    }
                    heroRecoilTimer = shieldedBlock ? 0.14 : incomingDmg > 0 ? 0.28 : 0.12;
                    if (incomingDmg > 0 && !shieldedBlock) {
                      spawnCombatSparks(
                        heroX,
                        heroY + 1.0,
                        heroZ,
                        actionDef.telegraphColor || '#FF6B4A',
                        9,
                        6.5
                      );
                      worldInteract?.spawnDebrisBurst(heroX, heroY + 0.45, heroZ, 'dust', 6, 4.4);
                    }
                    const isOgreThrow =
                      !shieldedBlock &&
                      incomingDmg > 0 &&
                      (rt.name.toLowerCase().includes('ogre') ||
                        (activeLevel.gameplayMode === 'rpg' && rt.isBoss));
                    if (isOgreThrow) {
                      heroKnockVX = kbDirX * 13.5;
                      heroKnockVZ = kbDirZ * 13.5;
                      heroVelY = Math.max(heroVelY, 5.4);
                      shakeTimer = 0.42;
                      spawnRpgOgreThrowWave(scene, rpgVisualFx, rt.x, heroY, rt.z);
                      spawnEvaporatingDamageNumber(
                        scene,
                        evaporatingDamages,
                        heroX,
                        heroY + 2.1,
                        heroZ,
                        `-${incomingDmg} THROWN!`,
                        '#EF4444',
                        'OGRE BRUTE FORCE!'
                      );
                    } else if (incomingDmg > 0 && activeLevel.gameplayMode === 'rpg') {
                      spawnEvaporatingDamageNumber(
                        scene,
                        evaporatingDamages,
                        heroX,
                        heroY + 1.85,
                        heroZ,
                        `-${incomingDmg}`,
                        '#F87171'
                      );
                    }
                    AudioEngine.playSound(shieldedBlock || incomingDmg === 0 ? 'chime' : 'hurt');
                    AudioEngine.playSound('hit');

                    applyBaddieAttackEffectToHero(
                      actionDef,
                      kbDirX,
                      kbDirZ,
                      incomingDmg === 0,
                      incomingCalc.effectDurationMult,
                      shieldedBlock
                    );

                    if (
                      incomingDmg > 0 &&
                      isRoguelikeLevel &&
                      relicMods &&
                      relicMods.thornsDamage > 0 &&
                      rt.alive
                    ) {
                      rt.health -= relicMods.thornsDamage;
                      rt.hitFlashTimer = 0.16;
                      spawnCombatSparks(
                        rt.x,
                        sampleLevelHeight(activeLevel, rt.x, rt.z) + rt.flightY + 1.0,
                        rt.z,
                        '#A855F7',
                        6,
                        5.5
                      );
                      if (rt.health <= 0) {
                        beginBaddieDeath(rt, -kbDirX, -kbDirZ);
                      }
                    }
                    if (health <= 0) {
                      triggerHeroDeath();
                    }
                  }
                }
                if (rt.stateTimer <= 0) {
                  rt.aiState = 'recover';
                  rt.stateTimer = actionDef.recoverDuration;
                  const baseCd = rt.monsterAttackCooldown ?? (rt.isBoss ? 1.25 : 1.35);
                  const varietySpan = 0.85 + Math.random() * (0.35 * (0.5 + aiCfg.varietyFactor));
                  const cdMult =
                    varietySpan *
                    (rt.monsterAbility === 'galeWings' && canFly ? 0.8 : 1) *
                    (berserkActive ? 0.78 : 1);
                  rt.attackCooldown = baseCd * cdMult;
                  rt.attackCycleCount += 1;
                  const enforceAirLand = canFly && aiCfg.landAfterAirAttack !== false;
                  if (enforceAirLand && rt.flightY > 0.35) {
                    rt.airAttacksSinceLand += 1;
                    if (rt.airAttacksSinceLand >= 1) {
                      rt.mustLandBeforeAttack = true;
                      rt.postAirHoverTimer = 0.95 + Math.random() * 0.45;
                    }
                  }
                  rt.activeAttack = pickNextBaddieAction(
                    aiCfg,
                    curAttack,
                    dist,
                    canFly && rt.flightY > 0.35,
                    canFly
                  );
                  if (canFly) {
                    rt.targetFlightY = rt.groundedHoldTimer > 0 ? 0 : aiCfg.hoverAttackHeight;
                  }
                }
              } else if (rt.aiState === 'recover') {
                rt.stateTimer -= simDt;
                if (canFly) {
                  rt.targetFlightY = rt.groundedHoldTimer > 0 ? 0 : aiCfg.hoverAttackHeight;
                }
                if (rt.stateTimer <= 0) {
                  // Recalibrate toward hero after attack concludes
                  rt.aiState = heroDetected || rt.behaviorChaseOrdered ? 'chase' : 'patrol';
                }
              } else if (rt.behaviorFleeOrdered && dist < aggroRange * 1.1) {
                const awayX = dist > 0.05 ? -dxToHero * invDist : 0;
                const awayZ = dist > 0.05 ? -dzToHero * invDist : 1;
                const [bx, bz] = resolveHorizontalCollision(
                  activeLevel,
                  rt.x + awayX * bSpeed * 1.1 * simDt,
                  rt.z + awayZ * bSpeed * 1.1 * simDt,
                  0.6,
                  false,
                  collisionCtx
                );
                rt.x = bx;
                rt.z = bz;
                rt.mesh.rotation.y = Math.atan2(awayX, awayZ);
                movingBaddie = true;
                rt.walkPhase += simDt * (bSpeed * 3.1);
                if (canFly) rt.targetFlightY = aiCfg.flightAltitude;
              } else if (heroDetected || rt.behaviorChaseOrdered) {
                if (rt.aiState === 'patrol' && !rt.aggroShouted && rt.dialogueLines.length > 0) {
                  rt.aggroShouted = true;
                  pushCharacterSpeech(
                    {
                      key: rt.id,
                      entityId: rt.id,
                      speaker: rt.name,
                      roleLabel: rt.isBoss ? 'Boss' : 'Baddie',
                      kind: 'baddie',
                      lines: [rt.dialogueLines[0]],
                      lineIndex: 0,
                      style: rt.chatStyle,
                      voiceConfig: rt.voiceConfig,
                      isProximity: false,
                      expiresAt: performance.now() + 3000,
                    },
                    true,
                    true
                  );
                }
                if (
                  rt.isBoss &&
                  !rt.lowHpShouted &&
                  rt.health <= Math.ceil(rt.maxHealth * 0.5)
                ) {
                  rt.lowHpShouted = true;
                  const phaseLine =
                    rt.dialogueLines[1] ?? 'You are stronger than you look!';
                  pushCharacterSpeech(
                    {
                      key: rt.id,
                      entityId: rt.id,
                      speaker: rt.name,
                      roleLabel: 'Boss',
                      kind: 'baddie',
                      lines: [phaseLine],
                      lineIndex: 0,
                      style: rt.chatStyle,
                      voiceConfig: rt.voiceConfig,
                      isProximity: false,
                      expiresAt: performance.now() + 3400,
                    },
                    true,
                    true
                  );
                }
                rt.aiState = 'chase';
                const enforceAirLand = canFly && aiCfg.landAfterAirAttack !== false;
                if (rt.groundedHoldTimer > 0) {
                  rt.groundedHoldTimer = Math.max(0, rt.groundedHoldTimer - simDt);
                }
                if (canFly) {
                  if (rt.mustLandBeforeAttack) {
                    if (rt.postAirHoverTimer > 0) {
                      rt.postAirHoverTimer = Math.max(0, rt.postAirHoverTimer - simDt);
                      rt.targetFlightY = aiCfg.hoverAttackHeight;
                    } else {
                      rt.targetFlightY = 0;
                      if (rt.flightY <= 0.25) {
                        rt.flightY = 0;
                        rt.mustLandBeforeAttack = false;
                        rt.airAttacksSinceLand = 0;
                        rt.groundedHoldTimer = 2.4 + Math.random() * 0.9;
                      }
                    }
                  } else if (rt.groundedHoldTimer > 0) {
                    rt.targetFlightY = 0;
                  } else {
                    rt.targetFlightY = aiCfg.hoverAttackHeight;
                  }
                }
                const dx = dist > 0.01 ? dxToHero * invDist : Math.sin(rt.mesh.rotation.y);
                const dz = dist > 0.01 ? dzToHero * invDist : Math.cos(rt.mesh.rotation.y);
                rt.mesh.rotation.y = Math.atan2(dx, dz);

                if (rt.behaviorAttackQueue) {
                  curAttack = rt.behaviorAttackQueue;
                  rt.activeAttack = curAttack;
                  actionDef = BADDIE_ACTION_BY_ID[curAttack] ?? BADDIE_ACTION_BY_ID.clawSlash;
                  rt.behaviorAttackQueue = null;
                }

                const wantReach =
                  actionDef.category === 'smash' || actionDef.category === 'melee'
                    ? actionDef.defaultRange
                    : Math.max(actionDef.defaultRange, rt.monsterAttackRange ?? actionDef.defaultRange);

                if (
                  dist <= wantReach &&
                  rt.attackCooldown <= 0 &&
                  !(enforceAirLand && rt.mustLandBeforeAttack)
                ) {
                  rt.attackDirX = dx;
                  rt.attackDirZ = dz;
                  rt.lockedTargetX = heroX;
                  rt.lockedTargetZ = heroZ;
                  rt.strikeDidHit = false;
                  if (canFly && actionDef.flightMode === 'groundOnly' && rt.flightY > 0.35) {
                    // Land smoothly before slamming the ground!
                    rt.aiState = 'landing';
                    rt.targetFlightY = 0;
                    rt.stateTimer = 1.65;
                  } else {
                    rt.aiState = 'windup';
                    rt.stateTimer = actionDef.windupDuration;
                  }
                } else if (enforceAirLand && rt.mustLandBeforeAttack) {
                  // Flyer finished 1 air strike: hover around briefly then descend & land cleanly
                  if (rt.postAirHoverTimer > 0) {
                    rt.patrolAngle += simDt * 1.5;
                    const strafeX = -dz * Math.cos(rt.patrolAngle * 0.65);
                    const strafeZ = dx * Math.cos(rt.patrolAngle * 0.65);
                    const [bx, bz] = resolveHorizontalCollision(
                      activeLevel,
                      rt.x + strafeX * bSpeed * 0.85 * simDt,
                      rt.z + strafeZ * bSpeed * 0.85 * simDt,
                      0.6,
                      false,
                      collisionCtx
                    );
                    rt.x = bx;
                    rt.z = bz;
                    movingBaddie = true;
                    rt.walkPhase += simDt * 4.0;
                  } else if (dist > 3.8) {
                    const [bx, bz] = resolveHorizontalCollision(
                      activeLevel,
                      rt.x + dx * bSpeed * 0.85 * simDt,
                      rt.z + dz * bSpeed * 0.85 * simDt,
                      0.6,
                      false,
                      collisionCtx
                    );
                    rt.x = bx;
                    rt.z = bz;
                    movingBaddie = true;
                    rt.walkPhase += simDt * 3.8;
                  }
                } else {
                  const idealStopDist =
                    canFly && (actionDef.category === 'breath' || actionDef.category === 'spell')
                      ? 4.6
                      : 1.45;
                  if (dist > idealStopDist) {
                    const flyChaseMult = canFly && rt.flightY > 0.35 ? 1.18 : 1.0;
                    let steerX = dx;
                    let steerZ = dz;
                    if (!canFly && navMeshEngine?.isReady()) {
                      const navPt = navMeshEngine.steerTowards(
                        rt.id,
                        rt.x,
                        rt.mesh.position.y,
                        rt.z,
                        heroX,
                        heroY,
                        heroZ,
                        gameElapsed
                      );
                      if (navPt.onNavMesh) {
                        const ndx = navPt.x - rt.x;
                        const ndz = navPt.z - rt.z;
                        const nLen = Math.hypot(ndx, ndz);
                        if (nLen > 0.08) {
                          steerX = ndx / nLen;
                          steerZ = ndz / nLen;
                          rt.mesh.rotation.y = Math.atan2(steerX, steerZ);
                        }
                      }
                    }
                    const [bx, bz] = resolveHorizontalCollision(
                      activeLevel,
                      rt.x + steerX * bSpeed * flyChaseMult * simDt,
                      rt.z + steerZ * bSpeed * flyChaseMult * simDt,
                      0.6,
                      false,
                      collisionCtx
                    );
                    rt.x = bx;
                    rt.z = bz;
                    movingBaddie = true;
                    rt.walkPhase += simDt * (bSpeed * 3.1);
                  } else if (canFly && rt.flightY > 0.35) {
                    // Hover strafe around hero when at optimal airborne breath distance
                    rt.patrolAngle += simDt * 1.15;
                    const strafeX = -dz * Math.cos(rt.patrolAngle * 0.5);
                    const strafeZ = dx * Math.cos(rt.patrolAngle * 0.5);
                    const [bx, bz] = resolveHorizontalCollision(
                      activeLevel,
                      rt.x + strafeX * bSpeed * 0.55 * simDt,
                      rt.z + strafeZ * bSpeed * 0.55 * simDt,
                      0.6,
                      false,
                      collisionCtx
                    );
                    rt.x = bx;
                    rt.z = bz;
                    movingBaddie = true;
                    rt.walkPhase += simDt * 3.6;
                  }
                }
              } else {
                rt.aiState = 'patrol';
                const terrR = Math.max(3.5, aiCfg.territoryRadius);
                if (canFly) {
                  // Aerial flight pattern patrol around home territory
                  rt.patrolAngle += simDt * (aiCfg.flightPattern === 'swoop' ? 0.82 : 0.65);
                  const rad = Math.min(terrR * 0.65, 8.5);
                  let goalX = rt.startX;
                  let goalZ = rt.startZ;
                  if (aiCfg.flightPattern === 'figure8') {
                    goalX = rt.startX + Math.sin(rt.patrolAngle) * rad;
                    goalZ = rt.startZ + Math.sin(rt.patrolAngle * 2) * (rad * 0.55);
                    rt.targetFlightY = aiCfg.flightAltitude + Math.sin(rt.patrolAngle * 2) * 0.55;
                  } else if (aiCfg.flightPattern === 'circle') {
                    goalX = rt.startX + Math.cos(rt.patrolAngle) * rad;
                    goalZ = rt.startZ + Math.sin(rt.patrolAngle) * rad;
                    rt.targetFlightY = aiCfg.flightAltitude;
                  } else if (aiCfg.flightPattern === 'swoop') {
                    goalX = rt.startX + Math.cos(rt.patrolAngle) * rad;
                    goalZ = rt.startZ + Math.sin(rt.patrolAngle) * (rad * 0.72);
                    rt.targetFlightY =
                      aiCfg.flightAltitude + Math.sin(rt.patrolAngle * 3) * 1.15;
                  } else {
                    goalX = rt.startX + Math.sin(rt.patrolAngle * 0.5) * 1.6;
                    goalZ = rt.startZ + Math.cos(rt.patrolAngle * 0.5) * 1.6;
                    rt.targetFlightY = aiCfg.flightAltitude + Math.sin(gameElapsed * 2.2) * 0.35;
                  }
                  const gdx = goalX - rt.x;
                  const gdz = goalZ - rt.z;
                  const gLen = Math.hypot(gdx, gdz);
                  if (gLen > 0.12) {
                    const step = Math.min(gLen, bSpeed * 0.85 * simDt);
                    const [bx, bz] = resolveHorizontalCollision(
                      activeLevel,
                      rt.x + (gdx / gLen) * step,
                      rt.z + (gdz / gLen) * step,
                      0.6,
                      false,
                      collisionCtx
                    );
                    rt.x = bx;
                    rt.z = bz;
                    rt.mesh.rotation.y = Math.atan2(gdx, gdz);
                    movingBaddie = true;
                    rt.walkPhase += simDt * 4.4;
                  }
                } else {
                  const pMode = aiCfg.patrolPattern;
                  if (pMode === 'guard') {
                    // Hold home post and scan gently left & right
                    const homeDist = Math.hypot(rt.startX - rt.x, rt.startZ - rt.z);
                    if (homeDist > 1.2) {
                      const hx = (rt.startX - rt.x) / homeDist;
                      const hz = (rt.startZ - rt.z) / homeDist;
                      const [bx, bz] = resolveHorizontalCollision(
                        activeLevel,
                        rt.x + hx * 1.8 * simDt,
                        rt.z + hz * 1.8 * simDt,
                        0.6,
                        false,
                        collisionCtx
                      );
                      rt.x = bx;
                      rt.z = bz;
                      rt.mesh.rotation.y = Math.atan2(hx, hz);
                      movingBaddie = true;
                      rt.walkPhase += simDt * 4.2;
                    } else {
                      rt.mesh.rotation.y = Math.sin(gameElapsed * 0.75 + rt.patrolAngle) * 1.3;
                    }
                  } else if (pMode === 'orbit' || pMode === 'circuit' || pMode === 'wander') {
                    rt.patrolAngle += simDt * (pMode === 'circuit' ? 0.55 : 0.48);
                    const orbitR = Math.min(terrR * 0.55, 6.2);
                    const tx =
                      pMode === 'wander'
                        ? rt.startX + Math.sin(rt.patrolAngle * 1.3) * orbitR
                        : rt.startX + Math.cos(rt.patrolAngle) * orbitR;
                    const tz =
                      pMode === 'wander'
                        ? rt.startZ + Math.cos(rt.patrolAngle * 0.85) * orbitR
                        : rt.startZ + Math.sin(rt.patrolAngle) * orbitR;
                    const pdx = tx - rt.x;
                    const pdz = tz - rt.z;
                    const pLen = Math.hypot(pdx, pdz);
                    if (pLen > 0.15) {
                      const [bx, bz] = resolveHorizontalCollision(
                        activeLevel,
                        rt.x + (pdx / pLen) * 1.75 * simDt,
                        rt.z + (pdz / pLen) * 1.75 * simDt,
                        0.6,
                        false,
                        collisionCtx
                      );
                      rt.x = bx;
                      rt.z = bz;
                      rt.mesh.rotation.y = Math.atan2(pdx, pdz);
                      movingBaddie = true;
                      rt.walkPhase += simDt * 4.6;
                    }
                  } else {
                    const [bx, bz] = resolveHorizontalCollision(
                      activeLevel,
                      rt.x + rt.patrolDir * 1.55 * simDt,
                      rt.z,
                      0.6,
                      false,
                      collisionCtx
                    );
                    if (Math.abs(bx - rt.x) < 0.001 || Math.abs(bx - rt.startX) > Math.min(terrR * 0.5, 4.2)) {
                      rt.patrolDir *= -1;
                    }
                    rt.x = bx;
                    rt.z = bz;
                    rt.mesh.rotation.y = rt.patrolDir > 0 ? Math.PI / 2 : -Math.PI / 2;
                    movingBaddie = true;
                    rt.walkPhase += simDt * 4.6;
                  }
                }
              }

              // Smooth vertical flight altitude tracking when not dying
              if (canFly && rt.aiState !== 'dying') {
                rt.flightY = THREE.MathUtils.damp(rt.flightY, rt.targetFlightY, 4.4, dt);
              } else if (!canFly) {
                rt.flightY = 0;
              }

              // Animate articulated BaddieRig (windup raise, downward spear cleave, hit recoil, stride bob)
              const bRig = rt.baddieRig;
              if (bRig) {
                let targetPitch = rt.recoilPitch;
                let targetRoll = rt.recoilRoll;
                let targetArmRX = 0;
                let targetArmRZ = 0;
                let targetArmLX = 0;
                let bobY = 0;

                if (rt.aiState === 'dying') {
                  targetPitch = -1.25;
                  targetRoll = 0.65;
                } else if (rt.aiState === 'stagger') {
                  targetArmRX = -0.55;
                  targetArmRZ = 0.45;
                  targetArmLX = -0.55;
                } else if (rt.aiState === 'windup' || rt.aiState === 'landing') {
                  const wp =
                    rt.aiState === 'landing'
                      ? 0.35
                      : 1 - Math.max(0, rt.stateTimer / Math.max(0.05, windupTotal));
                  if (rt.aiState === 'windup' && wp < 0.76) {
                    const clueWave = Math.sin((wp / 0.76) * Math.PI * 6);
                    bobY = Math.abs(clueWave) * 0.1;
                    targetRoll = clueWave * 0.16 + rt.recoilRoll;
                    targetPitch = -0.14 + Math.abs(clueWave) * 0.08 + rt.recoilPitch;
                    targetArmRX = -0.55 + Math.abs(clueWave) * 0.45;
                    targetArmRZ = 0.28 * Math.abs(clueWave);
                    targetArmLX = clueWave * 0.48;
                  } else {
                    const pull = rt.aiState === 'landing' ? 0.35 : Math.min(1, (wp - 0.76) / 0.24);
                    targetPitch = -0.34 * pull + rt.recoilPitch;
                    targetArmRX = -2.05 * pull;
                    targetArmRZ = 0.42 * pull;
                    targetArmLX = 0.42 * pull;
                  }
                } else if (rt.aiState === 'strike') {
                  const sp = 1 - Math.max(0, rt.stateTimer / Math.max(0.05, strikeTotal));
                  targetPitch = 0.38 * Math.sin(sp * Math.PI) + rt.recoilPitch;
                  targetArmRX = THREE.MathUtils.lerp(-1.92, 1.05, Math.min(1, sp * 1.45));
                  targetArmRZ = THREE.MathUtils.lerp(0.35, -0.55, Math.min(1, sp * 1.45));
                  targetArmLX = -0.45;
                } else if (rt.aiState === 'recover') {
                  targetPitch = 0.14 + rt.recoilPitch;
                  targetArmRX = 0.55;
                } else if (movingBaddie) {
                  const stride = Math.sin(rt.walkPhase);
                  bobY = Math.abs(stride) * 0.08;
                  targetPitch = 0.08 + rt.recoilPitch;
                  targetArmRX = -0.22 + stride * 0.28;
                  targetArmLX = -stride * 0.42;
                }

                bRig.bodyPivot.rotation.x = THREE.MathUtils.damp(bRig.bodyPivot.rotation.x, targetPitch, 18, dt);
                bRig.bodyPivot.rotation.z = THREE.MathUtils.damp(bRig.bodyPivot.rotation.z, targetRoll, 16, dt);

                if (bRig.isFlyer) {
                  const flapSpeed = rt.aiState === 'windup' ? 22 : rt.aiState === 'strike' ? 26 : 11;
                  const flap = Math.sin(gameElapsed * flapSpeed + rt.walkPhase) * 0.65;
                  if (bRig.wingL) bRig.wingL.rotation.z = 0.25 + flap;
                  if (bRig.wingR) bRig.wingR.rotation.z = -0.25 - flap;
                  bRig.bodyPivot.position.y = 0.45 + Math.sin(gameElapsed * 3.5 + rt.walkPhase) * 0.12;
                } else {
                  bRig.bodyPivot.position.y = bobY;
                  if (bRig.armR) {
                    const armLmb = rt.aiState === 'strike' ? 30 : 14;
                    bRig.armR.rotation.x = THREE.MathUtils.damp(bRig.armR.rotation.x, targetArmRX, armLmb, dt);
                    bRig.armR.rotation.z = THREE.MathUtils.damp(bRig.armR.rotation.z, targetArmRZ, armLmb, dt);
                  }
                  if (bRig.armL) {
                    bRig.armL.rotation.x = THREE.MathUtils.damp(bRig.armL.rotation.x, targetArmLX, 14, dt);
                  }
                }

                if (bRig.torso) {
                  bRig.torso.rotation.x = THREE.MathUtils.damp(bRig.torso.rotation.x, 0, 14, dt);
                  bRig.torso.rotation.y = THREE.MathUtils.damp(bRig.torso.rotation.y, 0, 14, dt);
                  bRig.torso.rotation.z = THREE.MathUtils.damp(bRig.torso.rotation.z, 0, 14, dt);
                }
                if (bRig.head) {
                  bRig.head.rotation.x = THREE.MathUtils.damp(bRig.head.rotation.x, 0, 14, dt);
                  bRig.head.rotation.y = THREE.MathUtils.damp(bRig.head.rotation.y, 0, 14, dt);
                  bRig.head.rotation.z = THREE.MathUtils.damp(bRig.head.rotation.z, 0, 14, dt);
                }

                // Universal Motion Studio custom preset overlay for Procedural BaddieRig
                const bLogicTarget =
                  rt.logicAnimTimer > 0 && rt.logicAnimName
                    ? resolveLogicPlayAnimationTarget({
                        detail: rt.logicAnimName,
                        actorCategory: 'enemy',
                        project: activeProject,
                        entity: rt.sourceEntity,
                        monsterBp: rt.resolvedMonster,
                      })
                    : null;
                const bWindupSlot: CustomClipSlot =
                  aiCfg.windupClueStyle === 'footMarch'
                    ? 'windup_footMarch'
                    : aiCfg.windupClueStyle === 'wingFlare'
                    ? 'windup_wingFlare'
                    : bRig.isFlyer
                    ? 'windup_wingFlare'
                    : 'windup_headSway3';
                const bSlot: CustomClipSlot = bLogicTarget
                  ? bLogicTarget.slot
                  : rt.aiState === 'dying'
                  ? 'dying'
                  : rt.aiState === 'stagger'
                  ? 'stagger'
                  : rt.aiState === 'windup' || rt.aiState === 'landing'
                  ? bWindupSlot
                  : rt.aiState === 'strike'
                  ? ((curAttack as CustomClipSlot) || 'attack')
                  : bRig.isFlyer
                  ? 'fly'
                  : movingBaddie && rt.aiState === 'chase'
                  ? 'run'
                  : movingBaddie
                  ? 'walk'
                  : 'idle';
                const bCustomPreset = bLogicTarget
                  ? bLogicTarget.preset
                  : resolveMotionPresetForRuntime({
                      slot: bSlot,
                      actorCategory: 'enemy',
                      project: activeProject,
                      entity: rt.sourceEntity,
                      monsterBp: rt.resolvedMonster,
                    }) ??
                    (rt.aiState === 'strike'
                      ? resolveMotionPresetForRuntime({
                          slot: 'attack',
                          actorCategory: 'enemy',
                          project: activeProject,
                          entity: rt.sourceEntity,
                          monsterBp: rt.resolvedMonster,
                        })
                      : null);

                if (bCustomPreset) {
                  const pKey = `${bSlot}:${bCustomPreset.id}`;
                  if (rt.motionKey !== pKey) {
                    rt.motionKey = pKey;
                    rt.motionElapsed = 0;
                  }
                  rt.motionBlend = THREE.MathUtils.damp(rt.motionBlend, 1, 18, dt);
                  const dur = Math.max(0.1, bCustomPreset.duration);
                  let tNorm = 0;
                  if (rt.aiState === 'windup' || rt.aiState === 'landing') {
                    tNorm = THREE.MathUtils.clamp(
                      1 - rt.stateTimer / Math.max(0.05, windupTotal),
                      0,
                      1
                    );
                  } else if (rt.aiState === 'strike') {
                    tNorm = THREE.MathUtils.clamp(
                      1 - rt.stateTimer / Math.max(0.05, strikeTotal),
                      0,
                      1
                    );
                  } else if (rt.aiState === 'dying') {
                    tNorm = THREE.MathUtils.clamp(
                      1 - rt.stateTimer / Math.max(0.1, rt.dyingDuration),
                      0,
                      1
                    );
                  } else if (bLogicTarget && rt.logicAnimTimer > 0) {
                    tNorm = ((rt.logicAnimDuration - rt.logicAnimTimer) / dur) % 1;
                  } else {
                    rt.motionElapsed += dt;
                    tNorm = bCustomPreset.loop
                      ? (rt.motionElapsed / dur) % 1
                      : Math.min(1, rt.motionElapsed / dur);
                  }
                  applyMotionPresetToBaddieRigRuntime(
                    bRig,
                    bCustomPreset,
                    tNorm,
                    bRig.isFlyer ? 0.45 : 0,
                    rt.motionBlend
                  );
                } else {
                  rt.motionBlend = THREE.MathUtils.damp(rt.motionBlend, 0, 18, dt);
                  if (rt.motionBlend <= 0.02) rt.motionKey = '';
                }

                // Enemy strike slash visual arc
                if (rt.aiState === 'strike') {
                  const sp = 1 - Math.max(0, rt.stateTimer / Math.max(0.05, strikeTotal));
                  bRig.slashArc.visible = true;
                  bRig.slashArc.rotation.y = 0.7 - sp * 1.5;
                  bRig.slashMat.opacity = Math.sin(sp * Math.PI) * 0.75;
                } else {
                  bRig.slashArc.visible = false;
                }
              } else if (rt.quadrupedRig) {
                const qRig = rt.quadrupedRig;
                const fwdX = Math.sin(rt.mesh.rotation.y);
                const fwdZ = Math.cos(rt.mesh.rotation.y);
                const hAhead = sampleLevelHeight(activeLevel, rt.x + fwdX * 0.6, rt.z + fwdZ * 0.6);
                const hBehind = sampleLevelHeight(activeLevel, rt.x - fwdX * 0.6, rt.z - fwdZ * 0.6);
                const airborneFrac = qRig.canFly ? THREE.MathUtils.clamp(rt.flightY / 1.2, 0, 1) : 0;
                const slopePitch =
                  qRig.canFly && airborneFrac > 0.25
                    ? 0
                    : THREE.MathUtils.clamp(-Math.atan2(hAhead - hBehind, 1.2), -0.45, 0.45);
                let qState: QuadrupedAnimState = 'idle';
                let qProg = 0;
                if (rt.aiState === 'dying') {
                  qState = 'dying';
                  qProg = 1 - Math.max(0, rt.stateTimer / Math.max(0.1, rt.dyingDuration));
                } else if (rt.aiState === 'stagger') {
                  qState = 'stagger';
                } else if (rt.aiState === 'windup') {
                  qState = 'windup';
                  qProg = 1 - Math.max(0, rt.stateTimer / Math.max(0.05, windupTotal));
                } else if (rt.aiState === 'strike') {
                  qState = 'strike';
                  qProg = 1 - Math.max(0, rt.stateTimer / Math.max(0.05, strikeTotal));
                } else if (qRig.canFly && airborneFrac > 0.25) {
                  qState = 'fly';
                } else if (movingBaddie && rt.aiState === 'chase') {
                  qState = 'run';
                } else if (movingBaddie) {
                  qState = 'walk';
                }
                const spdNorm = rt.aiState === 'chase' ? 0.92 : movingBaddie ? 0.54 : 0;
                const bMood: CreatureExpressionMood =
                  rt.aiState === 'strike' || rt.aiState === 'stagger'
                    ? 'open'
                    : rt.aiState === 'windup' || rt.aiState === 'chase'
                      ? 'angry'
                      : qRig.blueprint.mouth.mood;
                animateQuadrupedMonster(
                  qRig,
                  dt,
                  gameElapsed,
                  rt.walkPhase,
                  spdNorm,
                  qState,
                  qProg,
                  slopePitch,
                  rt.recoilPitch,
                  rt.recoilRoll,
                  curAttack,
                  bMood,
                  bMood,
                  airborneFrac,
                  aiCfg.windupClueStyle
                );

                // Universal Motion Studio custom preset overlay for MonsterBlueprint / Quadruped Rig
                const qLogicTarget =
                  rt.logicAnimTimer > 0 && rt.logicAnimName
                    ? resolveLogicPlayAnimationTarget({
                        detail: rt.logicAnimName,
                        actorCategory: 'enemy',
                        project: activeProject,
                        entity: rt.sourceEntity,
                        monsterBp: rt.resolvedMonster,
                      })
                    : null;
                const qWindupSlot: CustomClipSlot =
                  aiCfg.windupClueStyle === 'footMarch'
                    ? 'windup_footMarch'
                    : aiCfg.windupClueStyle === 'wingFlare'
                    ? 'windup_wingFlare'
                    : 'windup_headSway3';
                const qMotionSlot: CustomClipSlot = qLogicTarget
                  ? qLogicTarget.slot
                  : qState === 'dying'
                  ? 'dying'
                  : qState === 'stagger'
                  ? 'stagger'
                  : qState === 'windup'
                  ? qWindupSlot
                  : qState === 'strike'
                  ? ((curAttack as CustomClipSlot) || 'attack')
                  : qState === 'fly'
                  ? 'fly'
                  : qState === 'run'
                  ? 'run'
                  : qState === 'walk'
                  ? 'walk'
                  : 'idle';
                const qCustomPreset = qLogicTarget
                  ? qLogicTarget.preset
                  : resolveMotionPresetForRuntime({
                      slot: qMotionSlot,
                      actorCategory: 'enemy',
                      project: activeProject,
                      entity: rt.sourceEntity,
                      monsterBp: rt.resolvedMonster,
                    }) ??
                    (qState === 'strike'
                      ? resolveMotionPresetForRuntime({
                          slot: 'attack',
                          actorCategory: 'enemy',
                          project: activeProject,
                          entity: rt.sourceEntity,
                          monsterBp: rt.resolvedMonster,
                        })
                      : null);

                if (qCustomPreset) {
                  const pKey = `${qMotionSlot}:${qCustomPreset.id}`;
                  if (rt.motionKey !== pKey) {
                    rt.motionKey = pKey;
                    rt.motionElapsed = 0;
                  }
                  rt.motionBlend = THREE.MathUtils.damp(rt.motionBlend, 1, 18, dt);
                  const dur = Math.max(0.1, qCustomPreset.duration);
                  let tNorm = 0;
                  if (qState === 'windup' || qState === 'strike' || qState === 'dying') {
                    tNorm = THREE.MathUtils.clamp(qProg, 0, 1);
                  } else if (qLogicTarget && rt.logicAnimTimer > 0) {
                    tNorm = ((rt.logicAnimDuration - rt.logicAnimTimer) / dur) % 1;
                  } else {
                    rt.motionElapsed += dt;
                    tNorm = qCustomPreset.loop
                      ? (rt.motionElapsed / dur) % 1
                      : Math.min(1, rt.motionElapsed / dur);
                  }
                  applyMotionPresetToQuadrupedRuntime(
                    qRig,
                    qCustomPreset,
                    tNorm,
                    rt.motionBlend,
                    dt
                  );
                } else {
                  rt.motionBlend = THREE.MathUtils.damp(rt.motionBlend, 0, 18, dt);
                  if (rt.motionBlend <= 0.02) rt.motionKey = '';
                }

                const showSlash =
                  rt.aiState === 'strike' &&
                  (curAttack === 'clawSlash' || curAttack === 'chargeGore' || curAttack === 'tailSmash');
                if (showSlash) {
                  qRig.slashArc.visible = true;
                  qRig.slashArc.rotation.y = 0.7 - qProg * 1.5;
                  qRig.slashMat.opacity = Math.sin(qProg * Math.PI) * 0.75;
                } else {
                  qRig.slashArc.visible = false;
                }
              } else {
                // Custom GLB baddie motion & recoil tilt
                rt.mesh.rotation.x = THREE.MathUtils.damp(rt.mesh.rotation.x, rt.recoilPitch, 14, dt);
                rt.mesh.rotation.z = THREE.MathUtils.damp(rt.mesh.rotation.z, rt.recoilRoll, 14, dt);
                if (rt.customInst) {
                  const bLogicTarget =
                    rt.logicAnimTimer > 0 && rt.logicAnimName
                      ? resolveLogicPlayAnimationTarget({
                          detail: rt.logicAnimName,
                          actorCategory: 'enemy',
                          project: activeProject,
                          entity: rt.sourceEntity,
                          monsterBp: rt.resolvedMonster,
                        })
                      : null;
                  if (bLogicTarget?.preset) {
                    const dur = Math.max(0.1, bLogicTarget.preset.duration);
                    const tNorm = ((rt.logicAnimDuration - rt.logicAnimTimer) / dur) % 1;
                    rt.customInst.setTestOverride({
                      kind: 'presetPreview',
                      preset: bLogicTarget.preset,
                      timeNorm: tNorm,
                      playing: false,
                    });
                    rt.customInst.setAction(bLogicTarget.slot, 0.1);
                  } else {
                    rt.customInst.setTestOverride(null);
                    if (rt.aiState === 'dying') {
                      rt.customInst.setAction('dying', 0.08);
                    } else if (rt.aiState === 'stagger') {
                      rt.customInst.setAction('stagger', 0.08);
                    } else if (rt.aiState === 'strike' || rt.aiState === 'windup') {
                      rt.customInst.setAction('attack', 0.08);
                    } else if (rt.aiState === 'chase') {
                      rt.customInst.setAction('run', 0.12);
                    } else {
                      rt.customInst.setAction(movingBaddie ? 'walk' : 'idle', 0.16);
                    }
                  }
                }
              }

              // Hit-flash (bright white-gold) and Attack-Windup telegraph glow (pulsing telegraph color)
              const flashMats = bRig
                ? bRig.flashMaterials
                : rt.quadrupedRig
                ? rt.quadrupedRig.flashMaterials
                : rt.customFlashMats;
              if (flashMats.length > 0) {
                if (rt.hitFlashTimer > 0) {
                  const f = Math.min(1, rt.hitFlashTimer / 0.14);
                  _flashColor.set('#FFF0C2');
                  for (const m of flashMats) {
                    m.emissive.copy(_flashColor);
                    m.emissiveIntensity = f * 1.25;
                  }
                } else if (rt.aiState === 'windup') {
                  const pulse = 0.45 + 0.55 * Math.sin(gameElapsed * 26);
                  _flashColor.set(actionDef.telegraphColor || '#FF4A1C');
                  for (const m of flashMats) {
                    m.emissive.copy(_flashColor);
                    m.emissiveIntensity = pulse * 0.75;
                  }
                } else {
                  for (const m of flashMats) {
                    if (m.emissiveIntensity !== 0) {
                      m.emissive.setHex(0x000000);
                      m.emissiveIntensity = 0;
                    }
                  }
                }
              }

              const ry = sampleLevelHeight(activeLevel, rt.x, rt.z) + (rt.elevationY ?? 0);
              const baseY = Math.max(-1, ry);
              rt.mesh.position.set(rt.x, baseY + rt.yOffset + rt.flightY, rt.z);

              // Dynamic key-colored overhead health bar with matching border & HP readout
              if (rt.hpBar) {
                const bar = rt.hpBar;
                if (!rt.alive || rt.aiState === 'dying' || rt.health <= 0) {
                  bar.opacity = 0;
                  bar.mat.opacity = 0;
                  bar.group.visible = false;
                  bar.mesh.visible = false;
                } else {
                  const inBattle =
                    rt.aiState !== 'patrol'
                      ? true
                      : rt.health < rt.maxHealth && dist < aggroRange + 6;
                  const targetOpacity = inBattle ? 1 : 0;
                  bar.opacity = THREE.MathUtils.damp(bar.opacity, targetOpacity, inBattle ? 12 : 7, dt);

                  const hpRatio = THREE.MathUtils.clamp(rt.health / Math.max(1, rt.maxHealth), 0, 1);
                  if (bar.displayTrail < hpRatio) {
                    bar.displayTrail = hpRatio;
                  } else {
                    bar.displayTrail = THREE.MathUtils.damp(bar.displayTrail, hpRatio, 5.5, dt);
                  }

                  if (bar.opacity > 0.02) {
                    bar.group.visible = true;
                    bar.mesh.visible = true;
                    const flyHover = canFly ? Math.sin(gameElapsed * 3.4 + rt.walkPhase) * 0.14 : 0;
                    bar.group.position.set(
                      rt.x,
                      baseY + rt.yOffset + rt.flightY + bar.heightOffset + flyHover,
                      rt.z
                    );
                    if (rt.keyFillColor) {
                      bar.fillHex = rt.keyFillColor;
                    }
                    if (rt.keyBorderColor) {
                      bar.borderHex = rt.keyBorderColor;
                    }
                    bar.mat.opacity = bar.opacity;
                    redrawEnemyHealthBar(bar, rt.health, rt.maxHealth, bar.displayTrail);
                  } else {
                    bar.group.visible = false;
                  }
                }
              }
            }

            if (rt.customInst) {
              const rtMovedSpeed =
                simDt > 0.0001 ? Math.hypot(rt.x - prevRtX, rt.z - prevRtZ) / simDt : 0;
              const isRtLocomoting =
                rt.customInst.currentSlot === 'walk' || rt.customInst.currentSlot === 'run';
              const rtSpd = isRtLocomoting
                ? THREE.MathUtils.clamp(rtMovedSpeed / 3.4, 0.38, 1.75)
                : 1;
              rt.customInst.update(dt, rtSpd);
            }
          }
          mechLevelStartsFired = true;

          const doorPromptKey = nearestDoorPrompt
            ? `${nearestDoorPrompt.label}:${nearestDoorPrompt.isOpen}:${nearestDoorPrompt.locked}`
            : '';
          if (doorPromptKey !== lastDoorPromptKey) {
            lastDoorPromptKey = doorPromptKey;
            setDoorInteractPrompt(nearestDoorPrompt);
          }

          const chestPromptKey = nearestChestPrompt
            ? `${nearestChestPrompt.label}:${nearestChestPrompt.isOpen}:${nearestChestPrompt.locked}:${nearestChestPrompt.itemCount}`
            : '';
          if (chestPromptKey !== lastChestPromptKey) {
            lastChestPromptKey = chestPromptKey;
            setChestInteractPrompt(nearestChestPrompt);
          }

          // --- Live Camera Cutaways, Story Skits & Logic BehaviorCards ---
          const levelSkits = activeLevel.storySkits ?? [];
          if (!activeCutaway && pendingRehearseSkitId) {
            const targetRehearse = levelSkits.find((s) => s.id === pendingRehearseSkitId);
            pendingRehearseSkitId = null;
            if (targetRehearse) {
              startCutawaySkit(targetRehearse, true);
            }
          }

          if (!activeCutaway) {
            // 1. Evaluate StorySkits triggers
            for (const sk of levelSkits) {
              if (sk.playOnce && playedSkitIds.has(sk.id)) continue;
              let matched = false;
              if (sk.triggerKind === 'levelStart') {
                if (!levelStartSkitsChecked && gameElapsed > 0.25) matched = true;
              } else if (sk.triggerKind === 'nearEntity' && sk.triggerEntityId) {
                const trigRt = runtimeEntities.find((r) => r.id === sk.triggerEntityId && r.alive);
                const rad = sk.triggerRadius ?? 6;
                const inside = Boolean(
                  trigRt && Math.hypot(trigRt.x - heroX, trigRt.z - heroZ) <= rad
                );
                const wasInside = skitNearState.get(sk.id) ?? false;
                skitNearState.set(sk.id, inside);
                if (inside && !wasInside) matched = true;
              } else if (sk.triggerKind === 'talkToEntity' && sk.triggerEntityId) {
                const trigRt = runtimeEntities.find((r) => r.id === sk.triggerEntityId && r.alive);
                if (
                  didInteract &&
                  !interactConsumed &&
                  trigRt &&
                  Math.hypot(trigRt.x - heroX, trigRt.z - heroZ) <= 3.6
                ) {
                  matched = true;
                  interactConsumed = true;
                }
              } else if (sk.triggerKind === 'flagSet' && sk.triggerFlag?.trim()) {
                if (gameFlags.has(sk.triggerFlag.trim())) matched = true;
              } else if (sk.triggerKind === 'buddyCount') {
                if (recruitedBuddyIds.length >= (sk.triggerBuddyCount ?? 1)) matched = true;
              }
              if (matched) {
                startCutawaySkit(sk);
                break;
              }
            }
            if (gameElapsed > 0.25) levelStartSkitsChecked = true;
          }

          // 2. Evaluate Entity BehaviorCards (playSkit, cutawayCamera, setFlag, shakeCamera, showMessage, say)
          if (!activeCutaway) {
            const baddiesAllGone = !runtimeEntities.some((r) => r.kind === 'baddie' && r.alive);
            for (const rt of runtimeEntities) {
              if (!rt.alive || !rt.cards || rt.cards.length === 0) continue;
              const dHero = Math.hypot(rt.x - heroX, rt.z - heroZ);
              for (const card of rt.cards) {
                if (!card.isEnabled) continue;
                if (card.isOnce && firedCardIds.has(card.id)) continue;

                let whenMatched = false;
                const wk = card.when?.key;
                if (wk === 'levelStarts') {
                  whenMatched = !levelStartSkitsChecked && gameElapsed > 0.25;
                } else if (wk === 'playerNear') {
                  const inside = dHero <= 5.5;
                  const wasIn = cardNearState.get(card.id) ?? false;
                  cardNearState.set(card.id, inside);
                  whenMatched = inside && !wasIn;
                } else if (wk === 'playerTouches') {
                  const inside = dHero <= 1.75;
                  const wasIn = cardNearState.get(card.id) ?? false;
                  cardNearState.set(card.id, inside);
                  whenMatched = inside && !wasIn;
                } else if (wk === 'playerTalks' || wk === 'playerUses') {
                  whenMatched = didInteract && !interactConsumed && dHero <= 3.4;
                } else if (wk === 'baddiesGone') {
                  whenMatched = baddiesAllGone;
                } else if (wk === 'misfitPowerUsed') {
                  const want = card.when?.detail?.trim().toLowerCase();
                  whenMatched = Boolean(
                    recentMisfitUsed && (!want || want === recentMisfitUsed.toLowerCase())
                  );
                } else if (wk === 'puzzleSolved') {
                  whenMatched = recentSolvedPuzzleIds.has(rt.id);
                }
                if (!whenMatched) continue;

                let condsOk = true;
                for (const cond of card.conditions ?? []) {
                  if (cond.key === 'hasKey') condsOk = keys > 0;
                  else if (cond.key === 'baddiesGone') condsOk = baddiesAllGone;
                  else if (cond.key === 'flagSet') {
                    condsOk = Boolean(cond.detail?.trim() && gameFlags.has(cond.detail.trim()));
                  } else if (cond.key === 'hasCoins') {
                    condsOk = coins >= (Number(cond.detail) || 1);
                  }
                  if (!condsOk) break;
                }
                if (!condsOk) continue;

                firedCardIds.add(card.id);
                for (const act of card.actions ?? []) {
                  if (act.key === 'playSkit' && act.detail?.trim()) {
                    const needle = act.detail.trim().toLowerCase();
                    const foundSkit = levelSkits.find(
                      (s) => s.id === act.detail.trim() || s.name.trim().toLowerCase() === needle
                    );
                    if (foundSkit) startCutawaySkit(foundSkit);
                  } else if (act.key === 'cutawayCamera' && act.detail?.trim()) {
                    startSingleShotCutaway(act.detail);
                  } else if (act.key === 'unlockMisfitPower' && act.detail?.trim()) {
                    const rawAb = act.detail.trim();
                    const matchedAb = MisfitAbilityCatalog.find(
                      (m) => m.id.toLowerCase() === rawAb.toLowerCase() || m.title.toLowerCase() === rawAb.toLowerCase()
                    );
                    if (matchedAb) unlockPowerRuntime(matchedAb.id);
                  } else if (act.key === 'setFlag' && act.detail?.trim()) {
                    gameFlags.add(act.detail.trim());
                  } else if (act.key === 'shakeCamera') {
                    shakeTimer = 0.45;
                  } else if (act.key === 'showMessage' && act.detail?.trim()) {
                    showToast(act.detail.trim());
                  } else if (act.key === 'say' && act.detail?.trim()) {
                    pushCharacterSpeech(
                      {
                        key: rt.id,
                        entityId: rt.id,
                        speaker: rt.name,
                        roleLabel: EntityKindMeta[rt.kind as EntityKind]?.title ?? 'Character',
                        kind: rt.kind as EntityKind,
                        lines: [act.detail.trim()],
                        lineIndex: 0,
                        style: rt.chatStyle,
                        voiceConfig: rt.voiceConfig,
                        isProximity: false,
                        expiresAt: performance.now() + 4200,
                      },
                      true,
                      true
                    );
                  } else if (act.key === 'playAnimation' && act.detail?.trim()) {
                    const animQuery = act.detail.trim();
                    const actorCategory: 'hero' | 'npc' | 'buddy' | 'enemy' =
                      rt.kind === 'player'
                        ? 'hero'
                        : rt.kind === 'baddie'
                        ? 'enemy'
                        : rt.isBuddy || rt.sourceEntity?.creatureType
                        ? 'buddy'
                        : 'npc';
                    const resolvedAnim = resolveLogicPlayAnimationTarget({
                      detail: animQuery,
                      actorCategory,
                      project: activeProject,
                      entity: rt.sourceEntity,
                      monsterBp: rt.resolvedMonster,
                    });
                    const dur = Math.max(1.8, resolvedAnim.preset?.duration ?? 1.8);
                    if (rt.kind === 'player') {
                      heroLogicAnimName = animQuery;
                      heroLogicAnimDuration = dur;
                      heroLogicAnimTimer = dur;
                    } else {
                      rt.logicAnimName = animQuery;
                      rt.logicAnimDuration = dur;
                      rt.logicAnimTimer = dur;
                    }
                  }
                }
              }
            }
          }
          recentMisfitUsed = null;
          recentSolvedPuzzleIds.clear();

          // 3. Step active Cutaway Skit beats
          if (activeCutaway) {
            if (skipCutawaySignalRef.current) {
              skipCutawaySignalRef.current = false;
              AudioEngine.stopVoice('skit_cutaway');
              if (activeCutaway.phase !== 'out') {
                activeCutaway.phase = 'out';
                activeCutaway.phaseElapsed = 0;
                activeCutaway.fromPos.copy(camera.position);
                activeCutaway.fromLook.copy(_cutCurrLook);
                activeCutaway.fromFov = camera.fov;
              }
            }

            if (activeCutaway.phase === 'in') {
              activeCutaway.phaseElapsed += dt;
              if (activeCutaway.phaseElapsed >= activeCutaway.phaseDuration) {
                activeCutaway.phase = 'hold';
                activeCutaway.phaseElapsed = activeCutaway.phaseDuration;
              }
            } else if (activeCutaway.phase === 'hold') {
              activeCutaway.beatElapsed += dt;
              const curBeat = activeCutaway.skit.beats[activeCutaway.beatIndex];
              const minMet = !curBeat || activeCutaway.beatElapsed >= curBeat.durationSec;
              const voiceMet =
                !curBeat ||
                !curBeat.waitForVoice ||
                !activeCutaway.hasVoiceClip ||
                activeCutaway.voiceDone ||
                activeCutaway.beatElapsed >= Math.max(curBeat.durationSec + 6, 12);
              if (minMet && voiceMet) {
                if (activeCutaway.beatIndex + 1 < activeCutaway.skit.beats.length) {
                  enterCutawayBeat(activeCutaway, activeCutaway.beatIndex + 1);
                } else {
                  AudioEngine.stopVoice('skit_cutaway');
                  activeCutaway.phase = 'out';
                  activeCutaway.phaseElapsed = 0;
                  activeCutaway.fromPos.copy(camera.position);
                  activeCutaway.fromLook.copy(_cutCurrLook);
                  activeCutaway.fromFov = camera.fov;
                }
              }
            } else if (activeCutaway.phase === 'out') {
              activeCutaway.phaseElapsed += dt;
              if (activeCutaway.phaseElapsed >= activeCutaway.returnDuration) {
                const doneSkit = activeCutaway.skit;
                activeCutaway = null;
                cutawayHeroLockRef.current = false;
                for (const rt of runtimeEntities) {
                  rt.skitEmote = null;
                  rt.skitMoving = false;
                }
                setActiveCutawayHud(null);
                if (doneSkit.setFlagOnComplete?.trim()) {
                  gameFlags.add(doneSkit.setFlagOnComplete.trim());
                }
              }
            }
          }

          // World Scatter Collectible Harvesting (e.g. mushrooms, berry bushes, ferns, flowers, stone)
          const harvestRuleMap = harvestRuleByScatterRef.current;
          let nearestScatter: (typeof islandHandles.harvestableScatter)[number] | null = null;
          let nearestScatterRule: GameInventoryConfig['worldCollectibles'][number] | null = null;
          let nearestScatterDist = 2.15;

          if (!isDriving && harvestRuleMap.size > 0 && islandHandles.harvestableScatter.length > 0) {
            for (let hi = 0; hi < islandHandles.harvestableScatter.length; hi++) {
              const hs = islandHandles.harvestableScatter[hi];
              if (hs.collected || hs.scatterKind === 'bush') continue;
              const rule = harvestRuleMap.get(hs.scatterKind);
              if (!rule) continue;
              // Smooth River Stones use the Use button for sitting; gather them by hitting (Ctrl / F)
              if (hs.scatterKind === 'rock' && rule.collectMethod === 'interact') continue;
              const d = Math.hypot(hs.x - heroX, hs.z - heroZ);
              if (d <= nearestScatterDist && Math.abs(heroY - hs.y) < 2.4) {
                nearestScatterDist = d;
                nearestScatter = hs;
                nearestScatterRule = rule;
              }
            }
          }

          // World interactivity Use-button priorities: Wall Torches anywhere -> Organic Rocks/Boulders -> Prompts
          const nearestWallTorch =
            !isDriving && !isSitting && !isClimbing && !worldInteract?.carriedRock
              ? worldInteract?.findNearestWallTorch(heroX, heroY, heroZ) ?? null
              : null;
          if (didInteract && !interactConsumed && nearestWallTorch && worldInteract) {
            interactConsumed = true;
            worldInteract.grabWallTorch(nearestWallTorch);
            addItemToBag('campfire_torch', 1, true);
            handleHoldItem('campfire_torch');
            AudioEngine.playSound('sparkle');
            showToast('Grabbed lit Wall Torch! Equipped in hand.');
          }

          const nearestPickupRock =
            !isDriving && !isSitting && !isClimbing && !worldInteract?.carriedRock && !nearestWallTorch
              ? worldInteract?.findNearestPickupRock(heroX, heroY, heroZ) ?? null
              : null;
          if (didInteract && !interactConsumed && nearestPickupRock && worldInteract) {
            interactConsumed = true;
            worldInteract.pickUpRock(nearestPickupRock);
            AudioEngine.playSound('step');
            showToast(
              nearestPickupRock.kind === 'boulder'
                ? 'Lifted heavy Boulder (2-handed)! Aim the orange bullseye & press E to throw.'
                : 'Picked up Rock (1-handed)! Aim the orange bullseye & press E to throw.'
            );
          }

          // Sync compact World Action prompt banner (throttled via key cache)
          let nextWorldPrompt: {
            kind: 'rock' | 'boulder' | 'carryingRock' | 'carryingBoulder' | 'wallTorch' | 'treeFruit';
            label: string;
            hint?: string;
          } | null = null;
          if (worldInteract?.carriedRock) {
            nextWorldPrompt =
              worldInteract.carriedRock.kind === 'boulder'
                ? {
                    kind: 'carryingBoulder',
                    label: 'Heavy Boulder',
                    hint: 'Move mouse or turn to aim · Short heavy arc',
                  }
                : {
                    kind: 'carryingRock',
                    label: 'Field Rock',
                    hint: 'Move mouse or turn to aim · Long fast throw',
                  };
          } else if (canPickTreeFruitNow && climbingTree) {
            nextWorldPrompt = {
              kind: 'treeFruit',
              label: climbingTree.fruitLabel || 'Orchard Fruit',
              hint: `${climbingTree.fruitCount ?? 1} remaining in canopy`,
            };
          } else if (nearestWallTorch) {
            nextWorldPrompt = {
              kind: 'wallTorch',
              label: 'Wall Torch',
              hint: 'Pull from sconce & equip lit',
            };
          } else if (nearestPickupRock && !nearestChestPrompt && !nearestDoorPrompt) {
            nextWorldPrompt =
              nearestPickupRock.kind === 'boulder'
                ? {
                    kind: 'boulder',
                    label: 'Boulder (2-Handed)',
                    hint: 'Lift & throw at enemies',
                  }
                : {
                    kind: 'rock',
                    label: 'Field Rock (1-Handed)',
                    hint: 'Pick up & throw far',
                  };
          }
          const worldPromptKey = nextWorldPrompt
            ? `${nextWorldPrompt.kind}:${nextWorldPrompt.label}:${nextWorldPrompt.hint ?? ''}`
            : '';
          if (worldPromptKey !== lastWorldActionPromptKey) {
            lastWorldActionPromptKey = worldPromptKey;
            setWorldActionPrompt(nextWorldPrompt);
          }

          if (nearestScatter && nearestScatterRule) {
            const scatterLabels: Record<
              'mushroom' | 'berryBush' | 'fern' | 'broadleaf' | 'flower' | 'rock' | 'bush',
              string
            > = {
              mushroom: 'Wild Mushroom',
              berryBush: 'Berry Bush',
              fern: 'Woodland Fern',
              broadleaf: 'Herbaceous Plant',
              flower: 'Wildflower',
              rock: 'Mossy Stone',
              bush: 'Woodland Bush',
            };
            const fallbackLabel = scatterLabels[nearestScatter.scatterKind] ?? 'Collectible';
            const collectDef = itemByIdRef.current.get(nearestScatterRule.itemId);
            const canWalkCollect =
              nearestScatterRule.collectMethod === 'walkOver' && nearestScatterDist <= 1.35;
            const canInteractCollect = didInteract && !interactConsumed;
            if (canWalkCollect || canInteractCollect) {
              if (canInteractCollect) interactConsumed = true;
              nearestScatter.collected = true;
              for (const be of nearestScatter.batchedEntries) {
                hideBatchEntry(be, nearestScatter.x, nearestScatter.y - 60, nearestScatter.z);
              }
              addItemToBag(
                nearestScatterRule.itemId,
                nearestScatterRule.qty,
                collectDef?.category === 'tool'
              );
              AudioEngine.playSound(activeLevel.audio.coin);
              spawnCombatSparks(
                nearestScatter.x,
                nearestScatter.y + 0.45,
                nearestScatter.z,
                collectDef?.colorHex ?? '#20B46A',
                8,
                4.4
              );
              showToast(
                `Collected ${nearestScatterRule.qty > 1 ? `${nearestScatterRule.qty}× ` : ''}${
                  collectDef?.name ?? fallbackLabel
                }!`
              );
              if (lastHarvestPromptKey !== '') {
                lastHarvestPromptKey = '';
                setHarvestPrompt(null);
              }
            } else {
              const promptKey = `${nearestScatter.id}:${nearestScatterRule.itemId}:${nearestScatterRule.collectMethod}`;
              if (lastHarvestPromptKey !== promptKey) {
                lastHarvestPromptKey = promptKey;
                setHarvestPrompt({
                  label: fallbackLabel,
                  itemName: collectDef?.name ?? fallbackLabel,
                  method: nearestScatterRule.collectMethod,
                });
              }
            }
          } else if (lastHarvestPromptKey !== '') {
            lastHarvestPromptKey = '';
            setHarvestPrompt(null);
          }

          if (didInteract && !interactConsumed && !isGliding && heldDefNow?.toolKind === 'fishingPole') {
            triggerFishingAction();
          }

          // Proximity check for 3D Crafting Bench in the world
          let isNearBenchNow = false;
          if (!isDriving && !isGliding && craftingBenchEntities.length > 0) {
            for (const benchRt of craftingBenchEntities) {
              if (!benchRt.alive) continue;
              const d = Math.hypot(benchRt.x - heroX, benchRt.z - heroZ);
              if (d <= 3.1) {
                isNearBenchNow = true;
                break;
              }
            }
          }
          if (isNearBenchNow !== lastNearCraftingBench) {
            lastNearCraftingBench = isNearBenchNow;
            setNearCraftingBench(isNearBenchNow);
          }
          if (isNearBenchNow && didInteract && !interactConsumed) {
            interactConsumed = true;
            inp.keys.clear();
            setInventoryMode('bench');
            setInventoryOpen(true);
            AudioEngine.playSound('chime');
          }

          // Sitting detection & toggle on rocks, chopped stumps, fallen logs, chairs & 'sit'-tagged objects
          let nearestSitTarget: {
            label: string;
            x: number;
            y: number;
            z: number;
            dist: number;
            seatHeight: number;
            seatForward: number;
            entityYaw: number;
            cal?: ObjectInteractionCalibration;
          } | null = null;
          if (!isDriving && !isSwimming && !isSitting) {
            for (const rt of runtimeEntities) {
              if (!rt.alive) continue;
              if (!getEntityAttrs(rt).includes('sit')) continue;
              const d = Math.hypot(rt.x - heroX, rt.z - heroZ);
              const baseY = sampleLevelHeight(activeLevel, rt.x, rt.z) + (rt.elevationY ?? 0);
              if (d <= 2.15 && Math.abs(heroY - baseY) < 2.2) {
                if (!nearestSitTarget || d < nearestSitTarget.dist) {
                  let fallbackSeatH = 0.44 * (rt.entityScale ?? 1);
                  let fallbackSeatFwd = 0.14 * (rt.entityScale ?? 1);
                  if (!rt.interactionCalibrations?.sit) {
                    const entBox = new THREE.Box3().setFromObject(rt.mesh);
                    if (!entBox.isEmpty()) {
                      fallbackSeatH = THREE.MathUtils.clamp(entBox.max.y - baseY - 0.03, 0.24, 1.35);
                      const entSize = new THREE.Vector3();
                      entBox.getSize(entSize);
                      fallbackSeatFwd = THREE.MathUtils.clamp(
                        Math.min(entSize.x, entSize.z) * 0.34,
                        0.14,
                        0.72
                      );
                    }
                  }
                  nearestSitTarget = {
                    label: rt.name,
                    x: rt.x,
                    y: baseY,
                    z: rt.z,
                    dist: d,
                    seatHeight: fallbackSeatH,
                    seatForward: fallbackSeatFwd,
                    entityYaw: rt.entityYaw ?? 0,
                    cal: rt.interactionCalibrations?.sit,
                  };
                }
              }
            }
            for (const st of choppedStumps) {
              const d = Math.hypot(st.x - heroX, st.z - heroZ);
              if (d <= 2.05 && Math.abs(heroY - st.y) < 2.0) {
                if (!nearestSitTarget || d < nearestSitTarget.dist) {
                  nearestSitTarget = {
                    label: st.label,
                    x: st.x,
                    y: st.y,
                    z: st.z,
                    dist: d,
                    seatHeight: Math.max(0.24, st.topOffsetY - 0.03),
                    seatForward: Math.min(0.11, st.size * 0.09),
                    entityYaw: 0,
                  };
                }
              }
            }
            for (let hi = 0; hi < islandHandles.harvestableScatter.length; hi++) {
              const hs = islandHandles.harvestableScatter[hi];
              if (hs.collected || hs.scatterKind !== 'rock' || hs.size < 0.45) continue;
              const d = Math.hypot(hs.x - heroX, hs.z - heroZ);
              if (d <= 2.15 && Math.abs(heroY - hs.y) < 2.2) {
                if (!nearestSitTarget || d < nearestSitTarget.dist) {
                  nearestSitTarget = {
                    label: 'Smooth River Stone',
                    x: hs.x,
                    y: hs.y,
                    z: hs.z,
                    dist: d,
                    seatHeight: Math.max(0.24, hs.size * 0.52),
                    seatForward: Math.max(0.32, hs.size * 0.56),
                    entityYaw: 0,
                  };
                }
              }
            }
          }

          if (isSitting && didInteract && !interactConsumed) {
            interactConsumed = true;
            standUpFromSit();
          } else if (!isSitting && nearestSitTarget && didInteract && !interactConsumed) {
            interactConsumed = true;
            if (nearestSitTarget.cal) {
              const c = nearestSitTarget.cal;
              const cosE = Math.cos(nearestSitTarget.entityYaw);
              const sinE = Math.sin(nearestSitTarget.entityYaw);
              sitTargetX =
                nearestSitTarget.x + c.offset[0] * cosE + c.offset[2] * sinE;
              sitTargetY = nearestSitTarget.y + c.offset[1];
              sitTargetZ =
                nearestSitTarget.z - c.offset[0] * sinE + c.offset[2] * cosE;
              sitFacingYaw =
                nearestSitTarget.entityYaw + THREE.MathUtils.degToRad(c.yawDeg);
            } else {
              const dxS = heroX - nearestSitTarget.x;
              const dzS = heroZ - nearestSitTarget.z;
              const outwardYaw =
                Math.hypot(dxS, dzS) > 0.08
                  ? Math.atan2(dxS, dzS)
                  : heroYaw + Math.PI;
              sitTargetX =
                nearestSitTarget.x + Math.sin(outwardYaw) * nearestSitTarget.seatForward;
              sitTargetY = nearestSitTarget.y + nearestSitTarget.seatHeight;
              sitTargetZ =
                nearestSitTarget.z + Math.cos(outwardYaw) * nearestSitTarget.seatForward;
              sitFacingYaw = outwardYaw;
            }
            isSitting = true;
            isClimbing = false;
            heroVelY = 0;
            heroX = sitTargetX;
            heroY = sitTargetY;
            heroZ = sitTargetZ;
            heroYaw = sitFacingYaw;
            enterSitWithPov(sitFacingYaw);
            showToast(
              `Sitting on ${nearestSitTarget.label} — resting to recover Energy!`
            );
          }

          const sitPromptKey = isSitting
            ? 'sitting'
            : nearestSitTarget
            ? `sit:${nearestSitTarget.label}`
            : '';
          if (sitPromptKey !== lastSitPromptKey) {
            lastSitPromptKey = sitPromptKey;
            if (isSitting) {
              setSitPrompt({ label: 'Seat', isSitting: true });
            } else if (nearestSitTarget) {
              setSitPrompt({ label: nearestSitTarget.label, isSitting: false });
            } else {
              setSitPrompt(null);
            }
          }

          hasNearbyInteractablePrev = Boolean(
            isSitting ||
              nearestSitTarget ||
              isNearBenchNow ||
              nearestDoorPrompt ||
              nearestChestPrompt ||
              nearestScatter ||
              nearInteractableEntity ||
              fishingState.phase !== 'idle'
          );
          if (interactConsumed) {
            shieldGuardTimer = 0;
            interactConsumedLock = true;
          }

          // Buddies Tavern Feast & Celebration Trigger
          if (isBuddies && buddyEntities.length > 0 && !tavernCelebrated) {
            const tavernDist = tavernRt
              ? Math.hypot(tavernRt.x - heroX, tavernRt.z - heroZ)
              : Math.hypot(portalX - heroX, portalZ - heroZ);
            if (tavernDist < 6.4) {
              let missingCount = 0;
              for (let bi = 0; bi < buddyEntities.length; bi++) {
                if (!buddyEntities[bi].recruited) missingCount++;
              }
              if (missingCount === 0) {
                tavernCelebrated = true;
                coins += 25;
                addItemToBag('golden_crown', 1, false);
                AudioEngine.playSound('fanfare');
                AudioEngine.playSound('sparkle');
                const tY = sampleLevelHeight(activeLevel, tavernRt?.x ?? portalX, tavernRt?.z ?? portalZ);
                spawnCombatSparks(tavernRt?.x ?? portalX, tY + 2.6, tavernRt?.z ?? portalZ, '#FACC15', 22, 8.8);
                spawnCombatSparks(heroX, heroY + 1.8, heroZ, '#20B46A', 16, 7.2);
                showToast('Tavern Feast Celebration! +25 Coins & Golden Crown!');
                triggerHeroSpeech("We made it to the Lantern Tavern with everyone! Feast time!", 6000);
                setBuddyHud({
                  found: recruitedBuddyIds.length,
                  total: buddyEntities.length,
                  names: recruitedBuddyIds
                    .map((id) => runtimeEntities.find((r) => r.id === id)?.name.split(' ')[0] ?? 'Buddy'),
                  celebrating: true,
                  celebrationBannerOpen: true,
                });
              } else if (gameElapsed - lastTavernWarnAt > 4.0) {
                lastTavernWarnAt = gameElapsed;
                const missingNames: string[] = [];
                for (let bi = 0; bi < buddyEntities.length; bi++) {
                  const m = buddyEntities[bi];
                  if (!m.recruited) {
                    missingNames.push(`${m.name.split(' ')[0]} (${m.buddyAreaLabel || 'Detour Trail'})`);
                  }
                }
                showToast(`Find your remaining buddies first: ${missingNames.join(', ')}`);
              }
            }
          }

          // Portal check
          if (portalMesh) {
            for (let pi = 0; pi < portalSpinMeshes.length; pi++) {
              portalSpinMeshes[pi].rotation.z += dt * 1.6;
            }
            const portalDist = Math.hypot(portalX - heroX, portalZ - heroZ);
            if (portalDist < (isDriving ? 4.4 : 1.9)) {
              let baddiesLeft = 0;
              let chestsLeft = 0;
              for (let ri = 0; ri < runtimeEntities.length; ri++) {
                const r = runtimeEntities[ri];
                if (!r.alive) continue;
                if (r.kind === 'baddie' && r.aiState !== 'dying') baddiesLeft++;
                else if (r.kind === 'treasure' && !r.opened) chestsLeft++;
              }
              let buddiesLeft = 0;
              for (let bi = 0; bi < buddyEntities.length; bi++) {
                if (!buddyEntities[bi].recruited) buddiesLeft++;
              }
              if (isRoguelikeLevel) {
                if (baddiesLeft > 0) {
                  if (didInteract || (portalDist < 1.35 && gameElapsed - lastPortalLockedToastAt > 2.2)) {
                    lastPortalLockedToastAt = gameElapsed;
                    showToast(
                      `Defeat ${baddiesLeft} more foe${baddiesLeft === 1 ? '' : 's'} to unlock the portal!`
                    );
                  }
                } else if (!floorDraftTriggered) {
                  floorDraftTriggered = true;
                  AudioEngine.playSound('fanfare');
                  const choiceCount = Math.max(
                    1,
                    Math.min(
                      4,
                      Math.round(
                        activeLevel.roguelikeConfig?.relicChoicesPerFloor ??
                          DEFAULT_ROGUELIKE_CONFIG.relicChoicesPerFloor
                      )
                    )
                  );
                  const draft = rollRelicDraftOptions(
                    roguelikeRunRef.current.runSeed,
                    roguelikeRunRef.current.floorNumber,
                    roguelikeRunRef.current.activeRelics,
                    choiceCount
                  );
                  const nextSnap = {
                    ...roguelikeRunRef.current,
                    currentHealth: health,
                    coinsEarned: coins,
                    draftOptions: draft,
                  };
                  roguelikeRunRef.current = nextSnap;
                  setRoguelikeRun(nextSnap);
                }
              } else if (activeLevel.completeCondition === 'defeatAll' && baddiesLeft > 0) {
                if (didInteract || portalDist < 1.2) {
                  showToast(`Defeat ${baddiesLeft} more baddie${baddiesLeft === 1 ? '' : 's'} first!`);
                }
              } else if (activeLevel.completeCondition === 'collectAll' && chestsLeft > 0) {
                if (didInteract || portalDist < 1.2) {
                  showToast(`Open ${chestsLeft} more treasure${chestsLeft === 1 ? '' : 's'} first!`);
                }
              } else if (activeLevel.completeCondition === 'gatherBuddies' && buddiesLeft > 0) {
                if (didInteract || portalDist < 1.4) {
                  showToast(`Find ${buddiesLeft} more woodland friend${buddiesLeft === 1 ? '' : 's'} first!`);
                }
              } else if (
                isDriving &&
                activeLevel.completeCondition === 'completeCourse' &&
                drivingCheckpointsTotal > 0 &&
                carCheckpointsHit < drivingCheckpointsTotal
              ) {
                if (gameElapsed - lastTavernWarnAt > 3.0) {
                  lastTavernWarnAt = gameElapsed;
                  showToast(`Drive through all checkpoint arches first (${carCheckpointsHit}/${drivingCheckpointsTotal})!`);
                }
              } else {
                AudioEngine.playSound('fanfare');
                setElapsedSec(Math.round(gameElapsed));
                setFinished(true);
              }
            }
          }

          // Weather particles (throttled ~30Hz buffer upload, localized around hero)
          if (weatherPts) {
            weatherSyncTimer += dt;
            if (weatherSyncTimer >= 0.032) {
              const wDt = Math.min(0.1, weatherSyncTimer);
              weatherSyncTimer = 0;
              const posAttr = weatherPts.geometry.getAttribute('position') as THREE.BufferAttribute;
              const kind = weatherPts.userData.weather;
              const halfBox = 60;
              for (let i = 0; i < posAttr.count; i++) {
                let px = posAttr.getX(i);
                let py = posAttr.getY(i);
                let pz = posAttr.getZ(i);
                if (kind === 'fireflies') {
                  px += Math.sin(gameElapsed * 0.9 + i * 1.3) * wDt * 0.7;
                  py += Math.cos(gameElapsed * 1.4 + i * 0.7) * wDt * 0.45;
                  pz += Math.cos(gameElapsed * 0.8 + i * 1.1) * wDt * 0.7;
                  if (py < 0.4) py = 0.6;
                  if (py > 7.5) py = 6.5;
                } else if (kind === 'leaves') {
                  py -= wDt * 2.1;
                  px += Math.sin(gameElapsed * 1.5 + i) * wDt * 1.3;
                  if (py < -1) {
                    py = 24;
                    px = heroX + (Math.random() - 0.5) * 120;
                    pz = heroZ + (Math.random() - 0.5) * 120;
                  }
                } else {
                  const isRain = kind === 'rain';
                  py -= wDt * (isRain ? 18 : 3.2);
                  if (py < -2) {
                    py = 24;
                    px = heroX + (Math.random() - 0.5) * 120;
                    pz = heroZ + (Math.random() - 0.5) * 120;
                  }
                }
                if (px < heroX - halfBox) px += halfBox * 2;
                else if (px > heroX + halfBox) px -= halfBox * 2;
                if (pz < heroZ - halfBox) pz += halfBox * 2;
                else if (pz > heroZ + halfBox) pz -= halfBox * 2;
                posAttr.setXYZ(i, px, py, pz);
              }
              posAttr.needsUpdate = true;
            }
          }

          // Texel-snapped directional shadow camera following hero to prevent shimmer & redundant updates
          const shadowSpan = 72;
          const shadowRes = Math.max(256, sun.shadow.mapSize.x || 1024);
          const texelWorld = shadowSpan / shadowRes;
          const snapX = Math.round(heroX / texelWorld) * texelWorld;
          const snapZ = Math.round(heroZ / texelWorld) * texelWorld;
          if (Math.abs(snapX - lastShadowSnapX) > 0.25 || Math.abs(snapZ - lastShadowSnapZ) > 0.25) {
            lastShadowSnapX = snapX;
            lastShadowSnapZ = snapZ;
            sun.target.position.set(snapX, 0, snapZ);
            sun.position.set(snapX + _sunOffset.x, _sunOffset.y, snapZ + _sunOffset.z);
            if (!isSoftwareGl && sun.castShadow) {
              lastShadowUpdateTime = gameElapsed;
              sun.shadow.needsUpdate = true;
            }
          } else if (!isSoftwareGl && sun.castShadow && gameElapsed - lastShadowUpdateTime >= 0.045) {
            lastShadowUpdateTime = gameElapsed;
            sun.shadow.needsUpdate = true;
          }

          // Sync HUD smoothly (~9Hz)
          hudSyncTimer += dt;
          if (hudSyncTimer >= 0.11) {
            hudSyncTimer = 0;
            const mins = Math.floor(gameElapsed / 60);
            const secs = Math.floor(gameElapsed % 60);
            const timeText = `${mins}:${secs.toString().padStart(2, '0')}`;
            let boss: RuntimeEntity | undefined;
            let bKey = '';
            let aliveBaddies = 0;
            let totalBaddies = 0;
            const nextBaddiePts: BoardPoint[] = [];
            for (let ri = 0; ri < runtimeEntities.length; ri++) {
              const r = runtimeEntities[ri];
              if (r.kind === 'baddie') totalBaddies++;
              if (r.kind === 'baddie' && r.alive && r.aiState !== 'dying') {
                aliveBaddies++;
                if (r.isBoss) boss = r;
                const bp = levelWorldToBoard(activeLevel, r.x, r.z);
                bKey += `${Math.round(bp.x * 400)},${Math.round(bp.y * 400)};`;
                nextBaddiePts.push(bp);
              }
            }
            if (isRoguelikeLevel && aliveBaddies !== lastRoguelikeBaddiesLeft) {
              lastRoguelikeBaddiesLeft = aliveBaddies;
              setRoguelikeHud({
                baddiesLeft: aliveBaddies,
                baddiesTotal: totalBaddies,
                portalUnlocked: aliveBaddies === 0,
              });
            }
            if (bKey !== cachedBaddieKey) {
              cachedBaddieKey = bKey;
              cachedBaddiePoints = nextBaddiePts;
            }
            if (isDriving) {
              setDriveHud({
                speedKmh: Math.round(Math.hypot(carVelX, carVelZ) * 4.2),
                boost: Math.round(carBoost),
                drifting: carWasDrifting,
                airborne: heroY > floorY + 0.35,
                checkpointsHit: carCheckpointsHit,
                checkpointsTotal: drivingCheckpointsTotal,
                flightSeconds: Math.ceil(carFlightTimer),
                hasWings: Boolean(carRig?.hasPermanentWings),
              });
            }

            const stacks = inventoryStacksRef.current;
            let bagCount = 0;
            for (let si = 0; si < stacks.length; si++) {
              bagCount += stacks[si].qty;
            }
            let hotbarKey = `${eqNow.heldItemId ?? ''}|`;
            const hotbarCount = Math.min(4, stacks.length);
            for (let hi = 0; hi < hotbarCount; hi++) {
              hotbarKey += `${stacks[hi].itemId}:${stacks[hi].qty};`;
            }
            if (hotbarKey !== cachedHotbarKey) {
              cachedHotbarKey = hotbarKey;
              const nextHotbar: HUDState['hotbarItems'] = [];
              for (let hi = 0; hi < hotbarCount; hi++) {
                const st = stacks[hi];
                const d = itemByIdRef.current.get(st.itemId);
                nextHotbar.push({
                  id: st.itemId,
                  name: d?.name ?? st.itemId,
                  colorHex: d?.colorHex ?? '#20B46A',
                  icon: d?.icon ?? 'package',
                  qty: st.qty,
                  held: eqNow.heldItemId === st.itemId,
                });
              }
              cachedHotbarItems = nextHotbar;
            }

            const heroPt = levelWorldToBoard(activeLevel, heroX, heroZ);
            const stamRound = Math.round((stamina / maxStamina) * 100);
            const energyRound = Math.round(energy);
            const magicRound = Math.round(magic);
            const flashHp = hitInvuln > 0.7;
            const hudKey = `${health}/${maxHealth}|${stamRound}|${energyRound}|${magicRound}|${coins}|${keys}|${timeText}|${Math.round(heroPt.x * 400)},${Math.round(heroPt.y * 400)}|${cachedBaddieKey}|${flashHp ? 1 : 0}|${boss?.health ?? ''}|${recruitedBuddyIds.length}|${bagCount}|${cachedHotbarKey}`;
            if (hudKey !== cachedHudKey) {
              cachedHudKey = hudKey;
              setHudState({
                health,
                maxHealth,
                stamina: stamRound,
                energy: energyRound,
                magic: magicRound,
                coins,
                keys,
                timeText,
                objectives: staticObjectives,
                heroPoint: heroPt,
                portalPoint: portalBoardPoint,
                baddiePoints: cachedBaddiePoints,
                flashHealth: flashHp,
                bossName: boss?.name,
                bossHealth: boss?.health,
                bossMaxHealth: boss?.maxHealth,
                buddiesFound: recruitedBuddyIds.length,
                buddiesTotal: buddyEntities.length,
                heldItemName: heldDefNow?.name,
                heldItemColor: heldDefNow?.colorHex,
                bagCount,
                hotbarItems: cachedHotbarItems,
              });
            }
          }

          // Stream live player position & template progress (~5Hz) to EditorShell PersistentMinimapHUD
          telemetrySyncTimer += dt;
          if (telemetrySyncTimer >= 0.2) {
            telemetrySyncTimer = 0;
            const curPt = levelWorldToBoard(activeLevel, heroX, heroZ);
            const lastPt = boardTrail[boardTrail.length - 1];
            let trailChanged = false;
            if (!lastPt || Math.hypot(curPt.x - lastPt.x, curPt.y - lastPt.y) > 0.018) {
              boardTrail.push(curPt);
              if (boardTrail.length > 48) boardTrail.shift();
              trailChanged = true;
            }
            const speedNow = isDriving ? Math.round(Math.hypot(carVelX, carVelZ) * 4.2) : undefined;
            const buddyChanged = recruitedBuddyIds.length !== lastPubBuddyCount;
            const cpChanged = clearedCheckpointIds.length !== lastPubCheckpointCount;
            const movedChanged =
              Number.isNaN(lastPubPointX) ||
              Math.abs(curPt.x - lastPubPointX) >= 0.001 ||
              Math.abs(curPt.y - lastPubPointY) >= 0.001 ||
              Math.abs(heroYaw - lastPubYaw) >= 0.03 ||
              speedNow !== lastPubSpeed;

            if (trailChanged || buddyChanged || cpChanged || movedChanged) {
              const [mapX, mapZ] = revealAtHero();
              liveHeroTransformRef.current = { x: heroX, z: heroZ, yaw: heroYaw };
              if (buddyChanged) {
                lastPubBuddyCount = recruitedBuddyIds.length;
                cachedRecruitedBuddyIds = [...recruitedBuddyIds];
              }
              if (cpChanged) {
                lastPubCheckpointCount = clearedCheckpointIds.length;
                cachedClearedCheckpointIds = [...clearedCheckpointIds];
              }
              if (trailChanged || cachedTrailSnapshot.length === 0) {
                cachedTrailSnapshot = [...boardTrail];
              }
              lastPubPointX = curPt.x;
              lastPubPointY = curPt.y;
              lastPubYaw = heroYaw;
              lastPubSpeed = speedNow;
              publishLivePlayerTelemetry({
                levelId: activeLevel.id,
                point: curPt,
                yaw: heroYaw,
                worldX: mapX,
                worldZ: mapZ,
                speedKmh: speedNow,
                buddiesFound: recruitedBuddyIds.length,
                buddiesTotal: buddyEntities.length,
                recruitedBuddyIds: cachedRecruitedBuddyIds,
                checkpointsHit: carCheckpointsHit,
                checkpointsTotal: drivingCheckpointsTotal,
                clearedCheckpointIds: cachedClearedCheckpointIds,
                trail: cachedTrailSnapshot,
                roguelikeFloorLevel: isRoguelikeLevel ? activeLevel : undefined,
              });
            }
          }
        }

        // Evaluate forest canopy density & sightline tree obstruction (for ALL scatter tree kinds + entity trees)
        const refOuterCamMode = camBeforeAutoClose ?? camModeNow;
        const isRefRpgIso = activeLevel.gameplayMode === 'rpg' && refOuterCamMode === 'isometric';
        const refCamDist = inp.cameraDistance;
        let refCamX = heroX + Math.sin(inp.cameraYaw) * refCamDist;
        let refCamY =
          heroY +
          (isRefRpgIso
            ? 18.0
            : refOuterCamMode === 'isometric'
            ? 11.5
            : refOuterCamMode === 'cozy'
            ? 2.7
            : 4.2);
        let refCamZ = heroZ + Math.cos(inp.cameraYaw) * refCamDist;
        if (refOuterCamMode === 'front') {
          const d = Math.max(8.2, refCamDist);
          refCamX = heroX - Math.sin(heroYaw) * d;
          refCamY = heroY + 4.6;
          refCamZ = heroZ - Math.cos(heroYaw) * d;
        } else if (refOuterCamMode === 'heroFront') {
          const d = Math.max(8.2, Math.min(15.5, refCamDist));
          refCamX = heroX + Math.sin(heroYaw) * d;
          refCamY = heroY + 4.6 + (d - 9.2) * 0.28;
          refCamZ = heroZ + Math.cos(heroYaw) * d;
        }

        const focusY = heroY + 1.25;
        const refSegDX = refCamX - heroX;
        const refSegDY = refCamY - focusY;
        const refSegDZ = refCamZ - heroZ;
        const refSegLenXZSq = refSegDX * refSegDX + refSegDZ * refSegDZ;

        let rawCanopyObstruction = 0;
        let sightlineTreeHits = 0;
        let nearbyDenseTreeCount = 0;
        if (!isDriving && env === 'openWorld' && !heroInsideWalkInBuilding && !pausedNow) {
          const testCanopyCylinder = (
            ox: number,
            oz: number,
            radius: number,
            minY: number,
            maxY: number,
            isTree: boolean
          ) => {
            if (isTree) {
              const dHero = Math.hypot(ox - heroX, oz - heroZ);
              if (dHero < 11.5) {
                nearbyDenseTreeCount += dHero < 6.5 ? 1.25 : 1.0;
              }
            }
            if (refSegLenXZSq <= 4.0) return;
            const tProj = ((ox - heroX) * refSegDX + (oz - heroZ) * refSegDZ) / refSegLenXZSq;
            if (tProj <= 0.05 || tProj >= 0.96) return;
            const cx = heroX + refSegDX * tProj;
            const cy = focusY + refSegDY * tProj;
            const cz = heroZ + refSegDZ * tProj;
            if (cy < minY || cy > maxY) return;
            const distXZ = Math.hypot(ox - cx, oz - cz);
            if (distXZ < radius) {
              if (isTree) sightlineTreeHits += 1;
              const strength = Math.min(1, (1 - distXZ / radius) * 1.45);
              if (strength > rawCanopyObstruction) {
                rawCanopyObstruction = strength;
              }
            }
          };

          // 1. Check ALL scatter forest trees (tree, pine, oak, birch)
          const scatterList = activeLevel.terrain?.scatter;
          if (scatterList && scatterList.length > 0) {
            for (let si = 0; si < scatterList.length; si++) {
              const scItem = scatterList[si];
              if (
                scItem.kind !== 'tree' &&
                scItem.kind !== 'pine' &&
                scItem.kind !== 'oak' &&
                scItem.kind !== 'birch'
              ) {
                continue;
              }
              if (Math.abs(scItem.x - heroX) > 28 || Math.abs(scItem.z - heroZ) > 28) continue;
              const treeKey = `scatter_${si}`;
              if (choppedTreeIds.has(treeKey)) continue;
              const sc = Math.max(0.6, scItem.size || 1);
              const treeBaseY = sampleLevelHeight(activeLevel, scItem.x, scItem.z);
              testCanopyCylinder(
                scItem.x,
                scItem.z,
                2.85 * sc,
                treeBaseY + 2.6 * sc,
                treeBaseY + 13.0 * sc,
                true
              );
            }
          }

          // 2. Check placed EZ-Tree / Canopy Tree / Tropical Jungle Tree / Hollow Tree / Tall Building entities
          for (let ri = 0; ri < runtimeEntities.length; ri++) {
            const rt = runtimeEntities[ri];
            if (!rt.alive || choppedTreeIds.has(rt.id)) continue;
            if (Math.abs(rt.x - heroX) > 28 || Math.abs(rt.z - heroZ) > 28) continue;
            const lName = rt.name.toLowerCase();
            const isTreeEnt =
              Boolean(rt.mesh.userData?.canopyTree) ||
              lName.includes('tree') ||
              lName.includes('tropical') ||
              lName.includes('canopy') ||
              lName.includes('jungle');
            if (isTreeEnt) {
              const sc = Math.max(0.6, rt.mesh.scale.x || 1);
              const tBaseY = sampleLevelHeight(activeLevel, rt.x, rt.z);
              testCanopyCylinder(rt.x, rt.z, 3.05 * sc, tBaseY + 2.6 * sc, tBaseY + 13.4 * sc, true);
            } else if (rt.mesh.userData?.walkInBuilding && rt.mesh.userData?.walkInSpec) {
              const spec = rt.mesh.userData.walkInSpec as WalkInBuildingSpec;
              const bBaseY = sampleLevelHeight(activeLevel, rt.x, rt.z);
              testCanopyCylinder(
                rt.x,
                rt.z,
                Math.max(spec.halfW, spec.halfD) * 0.92,
                bBaseY + 1.2,
                bBaseY + spec.wallHeight + 3.0,
                false
              );
            }
          }
        }

        const isDenseForestNow =
          (nearbyDenseTreeCount >= 3 && rawCanopyObstruction > 0.14) ||
          nearbyDenseTreeCount >= 4 ||
          sightlineTreeHits >= 2 ||
          rawCanopyObstruction > 0.52;
        const isForestClearNow =
          nearbyDenseTreeCount < 2 && rawCanopyObstruction < 0.12 && sightlineTreeHits === 0;

        if (isDenseForestNow) {
          forestDenseHoldTimer += dt;
          forestClearHoldTimer = 0;
        } else if (isForestClearNow) {
          forestClearHoldTimer += dt;
          forestDenseHoldTimer = 0;
        } else {
          forestDenseHoldTimer = Math.max(0, forestDenseHoldTimer - dt * 0.5);
          forestClearHoldTimer = 0;
        }

        // Smoothly pull camera inside the cavern / building / dense forest and auto-switch to 'close' view
        const heroInCave =
          env === 'openWorld' && isInsideAnyCave(activeLevel.terrain, heroX, heroZ);
        if (heroInCave && !shownCaveTip && !pausedNow) {
          shownCaveTip = true;
          showToast('Entered the Mountain Cave — Close View');
        }
        const insideInteriorOrCave = heroInsideWalkInBuilding || heroInCave;
        const wantsForestAutoClose =
          !insideInteriorOrCave &&
          ((autoCloseReason === 'forest' && forestClearHoldTimer < 0.55) ||
            (autoCloseReason !== 'forest' && forestDenseHoldTimer >= 0.18));
        const wantsAutoClose = insideInteriorOrCave || wantsForestAutoClose;

        if (wantsAutoClose && !wasInsideAutoClose) {
          wasInsideAutoClose = true;
          autoCloseReason = insideInteriorOrCave ? 'interior' : 'forest';
          if (
            !isDriving &&
            envType !== 'sideScroller' &&
            camModeNow !== 'firstPerson' &&
            camModeNow !== 'close' &&
            camModeNow !== 'front'
          ) {
            camBeforeAutoClose = camModeNow;
            if (camModeNow === 'heroFront') {
              inp.cameraYaw = heroYaw;
            }
            resolvedCamModeRef.current = 'close';
            setLiveCamMode('close');
            if (!insideInteriorOrCave && gameElapsed - lastAutoCloseToastAt > 3.5) {
              lastAutoCloseToastAt = gameElapsed;
              showToast('Dense Forest — Close View');
            }
          }
        } else if (wantsAutoClose && insideInteriorOrCave) {
          autoCloseReason = 'interior';
        } else if (!wantsAutoClose && wasInsideAutoClose) {
          const prevReason = autoCloseReason;
          wasInsideAutoClose = false;
          autoCloseReason = null;
          if (camBeforeAutoClose && resolvedCamModeRef.current === 'close') {
            const restoreMode = camBeforeAutoClose;
            camBeforeAutoClose = null;
            resolvedCamModeRef.current = restoreMode;
            setLiveCamMode(restoreMode);
            if (prevReason === 'forest' && gameElapsed - lastAutoCloseToastAt > 3.5) {
              lastAutoCloseToastAt = gameElapsed;
              showToast(
                restoreMode === 'isometric'
                  ? 'Clear Area — Isometric View'
                  : 'Clear Area — Restored View'
              );
            }
          } else {
            camBeforeAutoClose = null;
          }
        }
        caveCamBlend = THREE.MathUtils.damp(caveCamBlend, heroInCave ? 1 : 0, 6.5, dt);
        interiorCamBlend = THREE.MathUtils.damp(
          interiorCamBlend,
          heroInsideWalkInBuilding ? 1 : 0,
          5.5,
          dt
        );

        // Universal Camera Sightline Occlusion Helper (for non-close outer camera modes)
        const applyUniversalCameraAutoZoom = () => {
          if (camModeNow === 'firstPerson' || camModeNow === 'close') return;
          canopyOcclusionBlend = THREE.MathUtils.damp(
            canopyOcclusionBlend,
            rawCanopyObstruction > 0.05 ? Math.min(1, rawCanopyObstruction) : 0,
            rawCanopyObstruction > 0.05 ? 5.8 : 3.4,
            dt
          );

          // Combine Walk-In Building Interior Zoom and Forest Canopy Auto-Zoom
          const zoomInFactor = Math.max(interiorCamBlend * 0.52, canopyOcclusionBlend * 0.45);
          const heightDropFactor = Math.max(interiorCamBlend * 0.54, canopyOcclusionBlend * 0.42);
          if (zoomInFactor > 0.005) {
            _targetCamPos.x = THREE.MathUtils.lerp(_targetCamPos.x, heroX + shakeX, zoomInFactor);
            _targetCamPos.z = THREE.MathUtils.lerp(_targetCamPos.z, heroZ, zoomInFactor);
            _targetCamPos.y = THREE.MathUtils.lerp(
              _targetCamPos.y,
              Math.max(heroY + 2.35, focusY + 1.4),
              heightDropFactor
            );
          }
        };

        // Responsive camera presets (zero-allocation)
        const camDist = inp.cameraDistance;
        const shakeX = shakeTimer > 0 ? (Math.random() - 0.5) * 0.28 : 0;
        const shakeY = shakeTimer > 0 ? (Math.random() - 0.5) * 0.28 : 0;

        if (isDriving && carRig) {
          const driveView: DrivingCameraView = drivingCfgRef.current.cameraView ?? 'closeChase';
          carRig.driverHead.visible = driveView !== 'driverPov';

          // Always orient camera toward the car's heading + active wheel steering
          const steerLead = steerVis * (driveView === 'driverPov' ? 0.32 : 0.42);
          const desiredDriveYaw = heroYaw + steerLead;
          const driveYawDiff = Math.atan2(
            Math.sin(desiredDriveYaw - driveCamYaw),
            Math.cos(desiredDriveYaw - driveCamYaw)
          );
          const yawRate = driveView === 'driverPov' ? 18 : driveView === 'closeChase' ? 12.5 : 10;
          driveCamYaw += driveYawDiff * Math.min(1, dt * yawRate);

          const carSpeedNow = Math.hypot(carVelX, carVelZ);
          const speedFovBoost = Math.min(4.2, carSpeedNow * 0.14);
          const baseDriveFov =
            driveView === 'driverPov' ? 62 : driveView === 'closeChase' ? 54 : 50;
          const nextFov = THREE.MathUtils.damp(camera.fov, baseDriveFov + speedFovBoost, 8, dt);
          if (Math.abs(nextFov - camera.fov) > 0.04) {
            camera.fov = nextFov;
            camera.updateProjectionMatrix();
          }

          if (driveView === 'driverPov') {
            carRig.group.updateMatrixWorld(true);
            carRig.driverEyeAnchor.getWorldPosition(_carCamEyePos);
            _targetCamPos.set(
              _carCamEyePos.x + shakeX * 0.3,
              _carCamEyePos.y + shakeY * 0.3,
              _carCamEyePos.z
            );
            _lookTarget.set(
              _carCamEyePos.x + Math.sin(driveCamYaw) * 18,
              _carCamEyePos.y - Math.sin(carPitch) * 10 - 0.52,
              _carCamEyePos.z + Math.cos(driveCamYaw) * 18
            );
            if (activeCutaway) {
              _cutBaseCamPos.copy(_targetCamPos);
              _cutBaseCamLook.copy(_lookTarget);
            } else {
              camera.position.copy(_targetCamPos);
              camera.lookAt(_lookTarget);
              _cutCurrLook.copy(_lookTarget);
              camera.updateMatrixWorld();
            }
          } else {
            const isFar = driveView === 'farChase';
            const chaseDist = isFar ? 11.4 : 5.4;
            const chaseHeight = isFar ? 4.85 : 2.35;
            const lookAhead = isFar ? 6.2 : 4.5;
            const lookHeight = isFar ? 1.45 : 1.28;

            _targetCamPos.set(
              heroX - Math.sin(driveCamYaw) * chaseDist + shakeX,
              heroY + chaseHeight + shakeY,
              heroZ - Math.cos(driveCamYaw) * chaseDist
            );
            const camGroundY = sampleLevelHeight(activeLevel, _targetCamPos.x, _targetCamPos.z);
            _targetCamPos.y = Math.max(_targetCamPos.y, camGroundY + 1.15);

            _lookTarget.set(
              heroX + Math.sin(driveCamYaw) * lookAhead,
              heroY + lookHeight,
              heroZ + Math.cos(driveCamYaw) * lookAhead
            );
            if (activeCutaway) {
              _cutBaseCamPos.copy(_targetCamPos);
              _cutBaseCamLook.copy(_lookTarget);
            } else {
              camera.position.lerp(_targetCamPos, isFar ? 0.24 : 0.34);
              camera.lookAt(_lookTarget);
              _cutCurrLook.copy(_lookTarget);
              camera.updateMatrixWorld();
            }
          }
        } else {
          const isRpgIsoNow = activeLevel.gameplayMode === 'rpg' && camModeNow === 'isometric';
          if (camModeNow !== prevCamModeForSnap) {
            if (camModeNow === 'front' || camModeNow === 'heroFront') {
              smoothCamYaw = heroYaw;
            }
            prevCamModeForSnap = camModeNow;
          }
          const targetFov =
            camModeNow === 'firstPerson'
              ? 68
              : camModeNow === 'front'
              ? 58
              : camModeNow === 'heroFront'
              ? 58
              : camModeNow === 'close'
              ? 56
              : camModeNow === 'sideScroll'
              ? 42
              : camModeNow === 'cozy'
              ? 48
              : isRpgIsoNow
              ? 35
              : camModeNow === 'isometric'
              ? 42
              : 52;
          if (!activeCutaway) {
            const nextFov = THREE.MathUtils.damp(camera.fov, targetFov, 10, dt);
            if (Math.abs(nextFov - camera.fov) > 0.04) {
              camera.fov = nextFov;
              camera.updateProjectionMatrix();
            }
          }

          if (camModeNow === 'firstPerson') {
            const pitch = THREE.MathUtils.clamp(inp.lookPitchOffset, -1.15, 1.15);
            const cosP = Math.cos(pitch);
            const sinP = Math.sin(pitch);
            const rawEyeY =
              heroY + (isSitting ? 1.18 : isSwimming ? 0.98 : 1.56) + shakeY * 0.3;
            const clampedEyeY = heroInCave
              ? Math.min(rawEyeY, MountainCave.floorY + MountainCave.ceilingHeight - 0.55)
              : heroInsideWalkInBuilding
              ? Math.min(rawEyeY, insideBuildingCeilingY - 0.55)
              : rawEyeY;
            _targetCamPos.set(heroX + shakeX * 0.3, clampedEyeY, heroZ);
            _lookTarget.set(
              heroX - Math.sin(inp.cameraYaw) * cosP * 14,
              clampedEyeY + sinP * 14,
              heroZ - Math.cos(inp.cameraYaw) * cosP * 14
            );
            if (activeCutaway) {
              _cutBaseCamPos.copy(_targetCamPos);
              _cutBaseCamLook.copy(_lookTarget);
            } else {
              camera.position.copy(_targetCamPos);
              camera.lookAt(_lookTarget);
              _cutCurrLook.copy(_lookTarget);
              camera.updateMatrixWorld();
            }
          } else {
            if (camModeNow === 'sideScroll') {
              const sideY = heroInSecretRoom ? heroY + 2.2 : Math.max(1.8, heroY + 2.5);
              const sideLookY = heroInSecretRoom ? heroY + 1.15 : Math.max(0.6, heroY + 1.15);
              const sideDistZ = sideCfgInit?.layoutStyle === 'verticalClimber' ? 16.5 : 14.5;
              _targetCamPos.set(heroX + 1.8 + shakeX, sideY + shakeY, sideDistZ);
              _lookTarget.set(heroX + 1.8, sideLookY, 0);
            } else if (camModeNow === 'close') {
              // Dedicated Close View (4th camera mode): preserves inp.cameraYaw so all directional keys stay 100% consistent with Isometric
              const closeDist = heroInCave ? 3.85 : heroInsideWalkInBuilding ? 4.05 : 5.15;
              const closeHeight =
                (heroInCave ? 1.95 : heroInsideWalkInBuilding ? 2.15 : 3.05) +
                inp.lookPitchOffset * 0.4;

              _targetCamPos.set(
                heroX + Math.sin(inp.cameraYaw) * closeDist + shakeX,
                heroY + closeHeight + shakeY,
                heroZ + Math.cos(inp.cameraYaw) * closeDist
              );
              if (heroInCave || caveCamBlend > 0.35) {
                _targetCamPos.y = Math.min(
                  _targetCamPos.y,
                  MountainCave.floorY + MountainCave.ceilingHeight - 0.65
                );
              }
              if (heroInsideWalkInBuilding && insideBuildingCeilingY < 900) {
                _targetCamPos.y = Math.min(_targetCamPos.y, insideBuildingCeilingY - 0.52);
              }
              if (!heroInCave && !heroInsideWalkInBuilding) {
                _targetCamPos.y = Math.max(
                  _targetCamPos.y,
                  sampleLevelHeight(activeLevel, _targetCamPos.x, _targetCamPos.z) + 1.25
                );
              }
              _lookTarget.set(heroX, heroY + 1.18, heroZ);
            } else if (camModeNow === 'front') {
              // Front View: tight, eye-level just-behind chase camera (not isometric) keeping hero right in front & always looking forward
              const openDist = THREE.MathUtils.clamp(
                activeLevel.gameplayMode === 'rpg' ? 5.25 : Math.min(6.4, Math.max(4.4, camDist * 0.56)),
                4.2,
                6.8
              );
              const closeBlend = Math.max(caveCamBlend, interiorCamBlend);
              const dist = THREE.MathUtils.lerp(openDist, 3.55, closeBlend);
              const camH = THREE.MathUtils.lerp(
                2.25 + inp.lookPitchOffset * 0.45,
                1.75 + inp.lookPitchOffset * 0.22,
                closeBlend
              );
              const desiredCamYaw = heroYaw + inp.lookYawOffset;
              const yawDiff = Math.atan2(
                Math.sin(desiredCamYaw - smoothCamYaw),
                Math.cos(desiredCamYaw - smoothCamYaw)
              );
              smoothCamYaw += yawDiff * Math.min(1, dt * 15);

              _targetCamPos.set(
                heroX - Math.sin(smoothCamYaw) * dist + shakeX,
                heroY + camH + shakeY,
                heroZ - Math.cos(smoothCamYaw) * dist
              );
              if (caveCamBlend > 0.35) {
                _targetCamPos.y = Math.min(
                  _targetCamPos.y,
                  MountainCave.floorY + MountainCave.ceilingHeight - 0.65
                );
              }
              if (heroInsideWalkInBuilding && insideBuildingCeilingY < 900) {
                _targetCamPos.y = Math.min(_targetCamPos.y, insideBuildingCeilingY - 0.52);
              }
              if (!heroInCave && !heroInsideWalkInBuilding) {
                _targetCamPos.y = Math.max(
                  _targetCamPos.y,
                  sampleLevelHeight(activeLevel, _targetCamPos.x, _targetCamPos.z) + 0.95
                );
              }
              const lookAheadDist = THREE.MathUtils.lerp(4.4, 2.2, closeBlend);
              _lookTarget.set(
                heroX + Math.sin(smoothCamYaw) * lookAheadDist,
                heroY + 1.38,
                heroZ + Math.cos(smoothCamYaw) * lookAheadDist
              );
            } else if (camModeNow === 'heroFront') {
              const openDist = Math.max(8.2, Math.min(15.5, camDist));
              const dist = THREE.MathUtils.lerp(openDist, 4.4, caveCamBlend);
              const openCamH = 4.6 + (openDist - 9.2) * 0.28 + inp.lookPitchOffset;
              const camH = THREE.MathUtils.lerp(
                openCamH,
                2.1 + inp.lookPitchOffset * 0.25,
                caveCamBlend
              );
              const desiredCamYaw = heroYaw + inp.lookYawOffset;
              const yawDiff = Math.atan2(
                Math.sin(desiredCamYaw - smoothCamYaw),
                Math.cos(desiredCamYaw - smoothCamYaw)
              );
              smoothCamYaw += yawDiff * Math.min(1, dt * 9);

              _targetCamPos.set(
                heroX + Math.sin(smoothCamYaw) * dist + shakeX,
                heroY + camH + shakeY,
                heroZ + Math.cos(smoothCamYaw) * dist
              );
              if (caveCamBlend > 0.35) {
                _targetCamPos.y = Math.min(
                  _targetCamPos.y,
                  MountainCave.floorY + MountainCave.ceilingHeight - 0.65
                );
              } else {
                _targetCamPos.y = Math.max(
                  _targetCamPos.y,
                  sampleLevelHeight(activeLevel, _targetCamPos.x, _targetCamPos.z) + 1.8
                );
              }
              if (heroInsideWalkInBuilding && insideBuildingCeilingY < 900) {
                _targetCamPos.y = Math.min(_targetCamPos.y, insideBuildingCeilingY - 0.52);
              }
              const lookAhead = THREE.MathUtils.lerp(
                THREE.MathUtils.clamp(openDist * 0.24, 1.4, 3.6),
                1.1,
                caveCamBlend
              );
              _lookTarget.set(
                heroX + Math.sin(smoothCamYaw) * lookAhead,
                heroY + THREE.MathUtils.lerp(0.95, 1.05, caveCamBlend),
                heroZ + Math.cos(smoothCamYaw) * lookAhead
              );
            } else {
              const baseDist = THREE.MathUtils.lerp(camDist, 4.1, caveCamBlend);
              const openHeight =
                (isRpgIsoNow ? 18.0 : camModeNow === 'isometric' ? 11.5 : camModeNow === 'cozy' ? 2.7 : 3.8) +
                inp.lookPitchOffset;
              const camHeight = THREE.MathUtils.lerp(openHeight, 2.05, caveCamBlend);
              _targetCamPos.set(
                heroX + Math.sin(inp.cameraYaw) * baseDist + shakeX,
                heroY + camHeight + shakeY,
                heroZ + Math.cos(inp.cameraYaw) * baseDist
              );
              if (caveCamBlend > 0.35) {
                _targetCamPos.y = Math.min(
                  _targetCamPos.y,
                  MountainCave.floorY + MountainCave.ceilingHeight - 0.65
                );
              }
              if (heroInsideWalkInBuilding && insideBuildingCeilingY < 900) {
                _targetCamPos.y = Math.min(_targetCamPos.y, insideBuildingCeilingY - 0.52);
              }
              _lookTarget.set(heroX, heroY + 1.15, heroZ);
            }

            if (!activeCutaway) {
              applyUniversalCameraAutoZoom();
            }

            if (activeCutaway) {
              _cutBaseCamPos.copy(_targetCamPos);
              _cutBaseCamLook.copy(_lookTarget);
            } else {
              camera.position.lerp(_targetCamPos, 0.2);
              camera.lookAt(_lookTarget);
              _cutCurrLook.copy(_lookTarget);
              camera.updateMatrixWorld();
            }
          }
        }
        wasCloseCamMode = resolvedCamModeRef.current === 'close';

        // Override camera cleanly during Live Camera Cutaway / Skit playback
        if (activeCutaway) {
          const easeSmooth = (u: number) =>
            u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
          const easeWhip = (u: number) => 1 - Math.pow(1 - u, 4);

          const curBeat = activeCutaway.skit.beats[activeCutaway.beatIndex];
          const transKind =
            activeCutaway.phase === 'out'
              ? activeCutaway.skit.returnTransition
              : curBeat?.transition ?? 'whipPan';
          const rawT =
            activeCutaway.phase === 'hold'
              ? 1
              : THREE.MathUtils.clamp(
                  activeCutaway.phaseElapsed /
                    Math.max(
                      0.016,
                      activeCutaway.phase === 'out'
                        ? activeCutaway.returnDuration
                        : activeCutaway.phaseDuration
                    ),
                  0,
                  1
                );
          const eased =
            transKind === 'snapCut'
              ? 1
              : transKind === 'whipPan'
              ? easeWhip(rawT)
              : easeSmooth(rawT);

          if (activeCutaway.phase === 'out') {
            camera.position.lerpVectors(activeCutaway.fromPos, _cutBaseCamPos, eased);
            _cutCurrLook.lerpVectors(activeCutaway.fromLook, _cutBaseCamLook, eased);
            const whipFov = transKind === 'whipPan' ? Math.sin(rawT * Math.PI) * 5.5 : 0;
            const outFov = THREE.MathUtils.lerp(activeCutaway.fromFov, 50, eased) + whipFov;
            if (Math.abs(outFov - camera.fov) > 0.05) {
              camera.fov = outFov;
              camera.updateProjectionMatrix();
            }
          } else {
            // Keep target tracking live moving actors during hold/in
            if (curBeat) {
              resolveCutawayPose(curBeat, activeCutaway.goalPos, activeCutaway.goalLook);
            }
            camera.position.lerpVectors(activeCutaway.fromPos, activeCutaway.goalPos, eased);
            _cutCurrLook.lerpVectors(activeCutaway.fromLook, activeCutaway.goalLook, eased);
            const whipFov =
              activeCutaway.phase === 'in' && transKind === 'whipPan'
                ? Math.sin(rawT * Math.PI) * 5.5
                : 0;
            const beatFov =
              THREE.MathUtils.lerp(activeCutaway.fromFov, activeCutaway.goalFov, eased) + whipFov;
            if (Math.abs(beatFov - camera.fov) > 0.05) {
              camera.fov = beatFov;
              camera.updateProjectionMatrix();
            }
          }

          camera.lookAt(_cutCurrLook);
          camera.updateMatrixWorld();
        } else if (vultureAerialTimer > 0 && !isDriving) {
          const orbitAng = heroYaw + (5.5 - vultureAerialTimer) * 0.22;
          _targetCamPos.set(
            heroX - Math.sin(orbitAng) * 16,
            heroY + 21,
            heroZ - Math.cos(orbitAng) * 16
          );
          _lookTarget.set(
            heroX + Math.sin(heroYaw) * 6,
            heroY + 1.5,
            heroZ + Math.cos(heroYaw) * 6
          );
          camera.position.lerp(_targetCamPos, 0.08);
          _cutCurrLook.lerp(_lookTarget, 0.1);
          camera.lookAt(_cutCurrLook);
          camera.updateMatrixWorld();
        }

        // Keep visible overhead enemy health bars cleanly billboarded toward the camera
        for (const rt of runtimeEntities) {
          if (rt.hpBar && rt.hpBar.group.visible) {
            rt.hpBar.group.quaternion.copy(camera.quaternion);
          }
        }

        // Project active 3D-tracked character chat bubbles to screen coordinates (zero-GC, 60fps)
        if (chatSettingsRef.current.displayMode === 'bubbles' && activeSpeechesRef.current.length > 0) {
          const vw = container?.clientWidth || window.innerWidth;
          const vh = container?.clientHeight || window.innerHeight;
          for (const sp of activeSpeechesRef.current) {
            if (sp.outputMode === 'audio') continue;
            const el = bubbleDomRefs.current[sp.key];
            if (!el) continue;

            let wx = heroX;
            let wy = heroY + 2.05 + sp.style.floatHeight;
            let wz = heroZ;
            let visible = true;

            if (sp.entityId === 'duckling') {
              if (!ducklingMesh) {
                visible = false;
              } else {
                wx = ducklingMesh.position.x;
                wy = ducklingMesh.position.y + 1.25;
                wz = ducklingMesh.position.z;
              }
            } else if (sp.entityId !== 'hero') {
              const rt = runtimeEntities.find((r) => r.id === sp.entityId);
              if (!rt || !rt.alive) {
                visible = false;
              } else {
                wx = rt.mesh.position.x;
                wy = rt.mesh.position.y + rt.headHeight + sp.style.floatHeight;
                wz = rt.mesh.position.z;
              }
            }

            if (!visible) {
              el.style.opacity = '0';
              el.style.pointerEvents = 'none';
              continue;
            }

            _bubbleProjVec.set(wx, wy, wz);
            const distToCam = camera.position.distanceTo(_bubbleProjVec);
            _bubbleProjVec.project(camera);

            if (_bubbleProjVec.z > 1) {
              el.style.opacity = '0';
              el.style.pointerEvents = 'none';
              continue;
            }

            const rawX = (_bubbleProjVec.x * 0.5 + 0.5) * vw;
            const rawY = (-_bubbleProjVec.y * 0.5 + 0.5) * vh;
            const halfClampX = Math.min(vw * 0.34, Math.max(96, sp.style.maxWidth * 0.5 + 14));
            const px = THREE.MathUtils.clamp(rawX, halfClampX, vw - halfClampX);
            const py = THREE.MathUtils.clamp(rawY, 84, vh - 90);
            const sc = THREE.MathUtils.clamp(1.08 - distToCam * 0.015, 0.78, 1.05);

            el.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) translate(-50%, -100%) scale(${sc.toFixed(3)})`;
            el.style.opacity = '1';
            el.style.pointerEvents = 'auto';
          }
        }

        syncSkyDomeToCamera(scene, camera.position);

        monsterVfx.update(dt);

        islandHandles.updateTerrainQualityUniforms?.(liveQualityValuesRef.current.terrainQuality);
        if (scene.userData.__makerTerrainQuality !== liveQualityValuesRef.current.terrainQuality) {
          applyAtmosphereQualityToScene(scene, liveQualityValuesRef.current.terrainQuality);
        }
        islandHandles.chunkedTerrain?.updateLOD(
          camera.position,
          liveQualityValuesRef.current.terrainQuality
        );

        islandHandles.grassSystem?.update(
          camera,
          sun,
          hemi,
          scene,
          gameElapsed,
          islandHandles.windUniform.value,
          heroRoot.position
        );

        // Wave 2: Step Rapier dynamic props/tumbles, living wildlife flocks (hero-reactive fish!), and cave eye adaptation
        if (!pausedNow && rapierPhysics?.isReady()) {
          rapierPhysics.step(dt, heroX, heroY, heroZ);
        }
        wildlifeSystem?.update(dt, gameElapsed, heroRoot.position);
        if (env !== 'dungeon') {
          const inCaveNow = isInsideAnyCave(activeLevel.terrain, heroX, heroZ);
          caveEyeAdaptBlend = THREE.MathUtils.damp(caveEyeAdaptBlend, inCaveNow ? 1 : 0, 2.6, dt);
          if (caveEyeAdaptBlend > 0.002) {
            renderer.toneMappingExposure = basePlayExposure * (1 + caveEyeAdaptBlend * 0.24);
            hemi.color.copy(baseHemiSkyColor).lerp(caveHemiSkyColor, caveEyeAdaptBlend * 0.65);
            hemi.groundColor
              .copy(baseHemiGroundColor)
              .lerp(caveHemiGroundColor, caveEyeAdaptBlend * 0.72);
            hemi.intensity = baseHemiIntensity * (1 - caveEyeAdaptBlend * 0.34);
            caveFillLight.position.set(heroX, heroY + 2.1, heroZ);
            caveFillLight.intensity = caveEyeAdaptBlend * 1.45;
          } else {
            if (caveFillLight.intensity > 0) {
              renderer.toneMappingExposure = basePlayExposure;
              hemi.color.copy(baseHemiSkyColor);
              hemi.groundColor.copy(baseHemiGroundColor);
              hemi.intensity = baseHemiIntensity;
              caveFillLight.intensity = 0;
            }
          }
        }

        try {
          if (postPipeline) {
            postPipeline.render({
              config: activeProject.postProcessing,
              sunPosition: _sunOffset,
              sunColor: sun.color,
              sunIntensity: sun.intensity,
              isDungeon: env === 'dungeon',
              dt,
              elapsedTime: gameElapsed,
            });
          } else {
            renderer.render(scene, camera);
          }
        } catch (renderErr) {
          console.error('PlayMode post-pipeline error; falling back to direct render:', renderErr);
          renderer.render(scene, camera);
        }

        perfFrames++;
        const nowPerfMs = performance.now();
        const elapsedPerfMs = nowPerfMs - perfWindowStart;
        if (elapsedPerfMs >= 350) {
          const fps = Math.round((perfFrames * 1000) / Math.max(1, elapsedPerfMs));
          const frameMs = Number((elapsedPerfMs / Math.max(1, perfFrames)).toFixed(1));
          if (
            showPerfHudRef.current ||
            (nowPerfMs - lastPerfHudUiMs >= 900 &&
              (lastCompactFps < 0 || Math.abs(fps - lastCompactFps) >= 2))
          ) {
            lastPerfHudUiMs = nowPerfMs;
            lastCompactFps = fps;
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

          // Adaptive FPS governor: adjust grass view distance cleanly without resizing render targets mid-walk
          if (!pausedNow && !isSoftwareGl) {
            if (fps < 36) {
              lowFpsStreak++;
              highFpsStreak = 0;
              if (lowFpsStreak >= 3 && adaptiveScale > 0.7) {
                lowFpsStreak = 0;
                adaptiveScale = adaptiveScale > 0.88 ? 0.85 : 0.7;
                islandHandles.grassSystem?.setDynamicViewScale(adaptiveScale);
              }
            } else if (fps >= 52 && adaptiveScale < 1) {
              highFpsStreak++;
              lowFpsStreak = 0;
              if (highFpsStreak >= 8) {
                highFpsStreak = 0;
                adaptiveScale = adaptiveScale < 0.8 ? 0.85 : 1;
                islandHandles.grassSystem?.setDynamicViewScale(adaptiveScale);
              }
            } else {
              lowFpsStreak = Math.max(0, lowFpsStreak - 1);
            }
          }

          perfFrames = 0;
          perfWindowStart = nowPerfMs;
        }
      } catch (tickErr) {
        console.error('PlayMode tick error:', tickErr);
      } finally {
        if (!disposed) {
          if (isSoftwareGl) {
            afterDraw(tick);
          } else {
            frameId = requestAnimationFrame(tick);
          }
        }
      }
      }

      if (!isIOS && islandHandles.pendingFoliagePromise) {
        await islandHandles.pendingFoliagePromise;
      }
      if (disposed) return;

      // Snap camera to hero spawn and trigger initial shadow pass before precompiling GPU pipelines
      const initCamYaw = inputRef.current.cameraYaw;
      const initCamDist = inputRef.current.cameraDistance;
      camera.position.set(
        heroX + Math.sin(initCamYaw) * initCamDist,
        heroY + 3.8,
        heroZ + Math.cos(initCamYaw) * initCamDist
      );
      camera.lookAt(heroX, heroY + 1.15, heroZ);
      camera.updateMatrixWorld();
      if (!isSoftwareGl && sun.castShadow) {
        sun.shadow.needsUpdate = true;
      }
      try {
        if (postPipeline) {
          await postPipeline.precompileAsync(currentProject?.postProcessing);
        } else {
          await renderer.compileAsync(scene, camera);
        }
      } catch {
        // ignore if fallback adapter skips precompile
      }
      if (disposed) return;

      liveQualityTargetRef.current = {
        renderer,
        sun,
        postPipeline,
        container,
        isSoftwareGl,
      };
      if (pendingResize) {
        const next = pendingResize;
        pendingResize = null;
        applyContainerResize(next.w, next.h);
      }
      applyLiveRendererQuality(
        renderer,
        sun,
        postPipeline,
        container.clientWidth || 800,
        container.clientHeight || 600,
        isSoftwareGl,
        liveQualityValuesRef.current.resolutionScale,
        liveQualityValuesRef.current.shadowQuality
      );

      perfWindowStart = performance.now();
      tick();
    };

    void bootAndRun();

    return () => {
      disposed = true;
      sameLevelTravelFnRef.current = null;
      liveStatsGetterRef.current = null;
      liveGrantCurrencyRef.current = () => {};
      chestOpeningLockRef.current = false;
      setIsChestOpeningAnim(false);
      setActiveChestLoot(null);
      islandAbort?.abort();
      islandAbort = null;
      setHarvestPrompt(null);
      setDoorInteractPrompt(null);
      setChestInteractPrompt(null);
      setSitPrompt(null);
      setClimbPrompt(null);
      setWorldActionPrompt(null);
      setGlidePrompt(null);
      liveQualityTargetRef.current = null;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      ro.disconnect();
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      dom.removeEventListener('wheel', onWheel);
      timer.dispose();
      islandHandlesRef?.grassSystem?.dispose();
      islandHandlesRef = null;
      wildlifeSystem?.dispose();
      wildlifeSystem = null;
      worldInteract?.dispose();
      worldInteract = null;
      navMeshEngine?.dispose();
      navMeshEngine = null;
      rapierPhysics?.dispose();
      rapierPhysics = null;
      rapierTumblingIds.clear();
      for (const fx of activeFxRuntimes) {
        fx.dispose();
      }
      monsterVfx.dispose();
      heroEffects.dispose();
      for (const rt of activeRuntimeEntities) {
        rt.hpBar?.tex.dispose();
      }
      scentPuffGeo.dispose();
      sonarRingGeo.dispose();
      revealBeaconGeo.dispose();
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
        isIOS && typeof renderer.getContext === 'function' ? renderer.getContext() : null;
      try {
        renderer.dispose();
      } catch {
        // ignore if device already lost
      }
      if (isIOS) {
        forceReleaseRendererContext(renderer, preCapturedGl);
      }
    };
  }, [
    currentLevel?.id,
    currentProject?.id,
    resetTick,
    isRoguelike ? roguelikeRun.floorNumber : 0,
    isRoguelike ? roguelikeRun.runSeed : 0,
  ]);

  if (!currentProject || !currentLevel) return null;

  const currentIdx = currentProject.levels.findIndex((l) => l.id === currentLevel.id);
  const nextLevel =
    currentProject.levels.find((l) => l.id === currentLevel.nextLevelID) ??
    (currentIdx >= 0 && currentIdx + 1 < currentProject.levels.length
      ? currentProject.levels[currentIdx + 1]
      : null);

  const handleSelectRelic = (relic: RoguelikeRelicDef) => {
    AudioEngine.playSound('sparkle');
    AudioEngine.playSound('chime');
    const nextFloor = roguelikeRun.floorNumber + 1;
    setRoguelikeRun((prev) => {
      const nextRelics = [...prev.activeRelics, relic.id];
      const nextMods = aggregateRelicModifiers(nextRelics);
      const baseMax = Math.max(
        2,
        Math.round(
          currentLevel.roguelikeConfig?.startingMaxHealth ??
            DEFAULT_ROGUELIKE_CONFIG.startingMaxHealth
        )
      );
      const nextMax = baseMax + nextMods.maxHealthBonus;
      const healAmt = (relic.modifiers.healNow ?? 0) + nextMods.portalHeal;
      const nextHp = Math.min(
        nextMax,
        Math.max(1, prev.currentHealth + (relic.modifiers.maxHealthBonus ?? 0) + healAmt)
      );
      return {
        ...prev,
        floorNumber: nextFloor,
        activeRelics: nextRelics,
        currentHealth: nextHp,
        draftOptions: null,
      };
    });
    showToastGlobal(`Claimed ${relic.name} — descending to Floor ${nextFloor}`);
  };

  const handleFastTravelToPlinth = useCallback(
    (target: SavePlinthTarget) => {
      if (!currentProject || !activePlayLevel) return;
      AudioEngine.playSound('chime');
      const plinthKey = makePlinthKey(target.levelId, target.entityId);
      markPlinthDiscovered(currentProject.id, plinthKey);
      setDiscoveredPlinthKeys(getDiscoveredPlinthKeys(currentProject.id));
      setFastTravelState(null);
      setWorldMapOpen(false);
      if (target.levelId === activePlayLevel.id && sameLevelTravelFnRef.current) {
        sameLevelTravelFnRef.current(target);
        return;
      }
      const liveStats = liveStatsGetterRef.current?.();
      if (liveStats) {
        crossLevelCarryRef.current = liveStats;
      }
      setPendingPlinthTravel({
        projectId: currentProject.id,
        levelId: target.levelId,
        plinthEntityId: target.entityId,
        plinthName: target.name,
        localX: target.localX,
        localZ: target.localZ,
        coins: liveStats?.coins ?? 0,
        keys: liveStats?.keys ?? 0,
        health: liveStats?.health ?? 6,
        maxHealth: liveStats?.maxHealth ?? 6,
        inventoryStacks: inventoryStacksRef.current,
        equipment: equipmentRef.current,
      });
      store.setSelectedLevelID(target.levelId);
      setResetTick((t) => t + 1);
      showToastGlobal(`Traveling to ${target.levelName} · ${target.name}`);
    },
    [currentProject, activePlayLevel, store, showToastGlobal]
  );

  const handleRestart = () => {
    AudioEngine.stopVoice();
    if (isRoguelike) {
      setRoguelikeRun(
        createFreshRoguelikeRun(currentLevel.roguelikeConfig ?? DEFAULT_ROGUELIKE_CONFIG)
      );
    }
    if (currentProject) {
      resetExploration(currentProject.id);
      clearDiscoveredPlinths(currentProject.id);
      clearSavedPlayProgress(currentProject.id);
      setDiscoveredPlinthKeys(new Set());
    }
    resumeSavedRef.current = null;
    crossLevelCarryRef.current = null;
    setWorldMapOpen(false);
    setFastTravelState(null);
    setFinished(false);
    setDead(false);
    setPaused(false);
    setInventoryOpen(false);
    setInventoryMode('bag');
    setNearCraftingBench(false);
    setFishingBanner('none');
    setActiveSpeeches([]);
    setChatHistory([]);
    introSpokenRef.current = false;
    setBuddyHud({
      found: 0,
      total: 0,
      names: [],
      celebrating: false,
      celebrationBannerOpen: false,
    });
    setStoryStats({ puzzlesSolved: 0, crittersWarmed: 0 });
    setHeroStatusBanner(null);
    setBossVictoryBanner(null);
    store.resetRuntimeDurability();
    setInventoryStacks([
      { itemId: 'iron_sword', qty: 1, durability: 100, maxDurability: 100 },
      { itemId: 'oak_shield', qty: 1, durability: 120, maxDurability: 120 },
      { itemId: 'wood_axe', qty: 1, durability: 90, maxDurability: 90 },
      { itemId: 'parachute_blanket', qty: 1, durability: 100, maxDurability: 100 },
    ]);
    setEquipment({
      heldItemId: 'iron_sword',
      offhandItemId: 'oak_shield',
      headItemId: null,
      bodyItemId: null,
      accessoryItemId: null,
    });
    setResetTick((t) => t + 1);
  };

  const handleStickPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    const el = e.currentTarget;
    const pointerId = e.pointerId;
    try {
      el.setPointerCapture(pointerId);
    } catch {
      // Ignore if pointer capture isn't supported
    }

    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = Math.max(18, rect.width * 0.36);

    const update = (clientX: number, clientY: number) => {
      const dx = clientX - cx;
      const dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
      const clamped = Math.min(maxR, dist);
      const ang = Math.atan2(dy, dx);
      const ox = dist > 0.5 ? Math.cos(ang) * clamped : 0;
      const oy = dist > 0.5 ? Math.sin(ang) * clamped : 0;
      setStickOffset({ x: ox, y: oy });
      inputRef.current.joyX = ox / maxR;
      inputRef.current.joyY = oy / maxR;
    };

    update(e.clientX, e.clientY);

    const onMove = (me: PointerEvent) => {
      if (me.pointerId !== pointerId) return;
      update(me.clientX, me.clientY);
    };
    const cleanup = (ue: PointerEvent) => {
      if (ue.pointerId !== pointerId) return;
      setStickOffset({ x: 0, y: 0 });
      inputRef.current.joyX = 0;
      inputRef.current.joyY = 0;
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', cleanup);
      el.removeEventListener('pointercancel', cleanup);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', cleanup);
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', cleanup);
    el.addEventListener('pointercancel', cleanup);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', cleanup);
  };

  const handleActionPointerDown = (
    action: ActionButtonBinding,
    e: React.PointerEvent<HTMLButtonElement>
  ) => {
    e.stopPropagation();
    e.preventDefault();
    if (action === 'jump') {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture isn't supported
      }
      inputRef.current.jumpQueued = true;
      inputRef.current.jumpPointerDown = true;
      inputRef.current.jumpPressQueuedCount += 1;
    } else if (action === 'attack') {
      inputRef.current.attackQueued = true;
    } else if (action === 'interact') {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture isn't supported
      }
      inputRef.current.interactQueued = true;
      inputRef.current.interactPointerDown = true;
    } else if (action === 'magicBolt') {
      inputRef.current.magicQueued = true;
    } else if (action === 'heal') {
      inputRef.current.healQueued = true;
    }
  };

  const handleActionPointerUp = (
    action: ActionButtonBinding,
    e: React.PointerEvent<HTMLButtonElement>
  ) => {
    e.stopPropagation();
    if (action === 'jump') {
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore if pointer capture isn't supported
      }
      inputRef.current.jumpPointerDown = false;
    } else if (action === 'interact') {
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore if pointer capture isn't supported
      }
      inputRef.current.interactPointerDown = false;
    }
  };

  const controlsActive =
    !showTitle &&
    !paused &&
    !finished &&
    !dead &&
    !panelPausesMovement &&
    !inventoryOpen &&
    !worldMapOpen &&
    !activeChestLoot &&
    fastTravelState === null;

  return (
    <div className="fixed inset-0 z-50 bg-black select-none overflow-hidden">
      {/* 3D Canvas */}
      <div ref={mountRef} className="w-full h-full touch-none" />

      {/* Custom Game HUD & Controls Overlay */}
      {!showTitle && (
        <div className="pointer-events-none fixed inset-0 z-20">
          {currentProject.hud.widgets.map((w) => {
            if (isRpgMode && w.kind !== 'joystick' && w.kind !== 'actionButton') return null;
            if (w.kind === 'bossBar' && !hudState.bossName) return null;
            if (w.kind === 'dialogue' || w.kind === 'minimap') return null;
            const isInteractiveWidget =
              w.kind === 'joystick' ||
              w.kind === 'actionButton' ||
              w.kind === 'pauseButton' ||
              w.kind === 'inventoryGrid';
            if (isInteractiveWidget && !controlsActive && w.kind !== 'pauseButton') {
              return null;
            }
            const pos = computeWidgetPosition(w, viewSize.w, viewSize.h);
            const overlapsTopChrome =
              pos.top < 60 &&
              pos.left + w.width > viewSize.w / 2 - 220 &&
              pos.left < viewSize.w / 2 + 220;
            const safeTop = overlapsTopChrome ? 62 : pos.top;
            const autoHeight = w.kind === 'objectiveList';
            return (
              <div
                key={w.id}
                className={`absolute ${
                  isInteractiveWidget ? 'pointer-events-auto' : 'pointer-events-none'
                }`}
                style={{
                  left: pos.left,
                  top: safeTop,
                  width: w.width,
                  ...(autoHeight ? { minHeight: w.height } : { height: w.height }),
                }}
              >
                <HUDWidgetView
                  widget={w}
                  state={hudState}
                  interactive={controlsActive}
                  stickOffset={stickOffset}
                  onStickPointerDown={handleStickPointer}
                  onActionPointerDown={handleActionPointerDown}
                  onActionPointerUp={handleActionPointerUp}
                  onOpenInventory={() => {
                    setInventoryMode('bag');
                    setInventoryOpen(true);
                  }}
                  onPauseTrigger={(e) => {
                    e.stopPropagation();
                    setPaused((p) => !p);
                  }}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Top-center Play Chrome (Non-RPG modes; RPG uses RpgGameHudOverlay) */}
      {!showTitle && !isRpgMode && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
          <div className="px-4 py-1.5 rounded-xl bg-black/70 text-white text-xs font-extrabold whitespace-nowrap">
            {activePlayLevel?.name ?? currentLevel.name}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              setFastTravelState(null);
              setWorldMapOpen((o) => !o);
            }}
            className={`px-3 h-9 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              worldMapOpen || fastTravelState !== null
                ? 'bg-[#0EA5E9] border-[#0EA5E9] text-white'
                : 'bg-black/70 border-white/15 text-white hover:bg-black/85'
            }`}
            title="Open World Map (M)"
          >
            <MapIcon size={14} />
            <span>Map</span>
            <span className="px-1.5 py-0.5 rounded bg-white/15 text-[10px] font-bold">M</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              setInventoryMode('bag');
              setInventoryOpen((o) => !o);
            }}
            className={`px-3 h-9 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              inventoryOpen
                ? 'bg-[#20B46A] border-[#20B46A] text-white'
                : 'bg-black/70 border-white/15 text-white hover:bg-black/85'
            }`}
            title={`Open ${inventoryConfig.panelTitle} (${formatKeyCodeLabel(inventoryConfig.toggleKey)})`}
          >
            <Backpack size={14} />
            <span>Bag</span>
            <span className="tabular-nums text-[11px] text-white/80">
              ({inventoryStacks.reduce((sum, s) => sum + s.qty, 0)})
            </span>
            <span className="px-1.5 py-0.5 rounded bg-white/15 text-[10px] font-bold">
              {formatKeyCodeLabel(inventoryConfig.toggleKey)}
            </span>
          </button>
          {!isDrivingMode && envType !== 'sideScroller' && (
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                toggleCharacterPov();
              }}
              className={`px-3 h-9 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                resolvedCamMode === 'firstPerson'
                  ? 'bg-[#7C5CFF] border-[#7C5CFF] text-white'
                  : resolvedCamMode === 'front'
                  ? 'bg-[#10B981] border-[#10B981] text-white'
                  : resolvedCamMode === 'heroFront'
                  ? 'bg-[#0EA5E9] border-[#0EA5E9] text-white'
                  : resolvedCamMode === 'close'
                  ? 'bg-[#F59E0B] border-[#F59E0B] text-slate-950'
                  : 'bg-black/55 border-white/15 text-white hover:bg-black/75'
              }`}
              title="Cycle Camera View: Isometric / Front / Close / Face / POV (V)"
            >
              <Eye size={14} />
              <span>
                {resolvedCamMode === 'firstPerson'
                  ? 'POV'
                  : resolvedCamMode === 'front'
                  ? 'Front'
                  : resolvedCamMode === 'heroFront'
                  ? 'Face'
                  : resolvedCamMode === 'close'
                  ? 'Close'
                  : resolvedCamMode === 'isometric'
                  ? 'Isometric'
                  : 'Chase'}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-white/15 text-[10px] font-bold">V</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="w-9 h-9 rounded-xl bg-black/70 text-white flex items-center justify-center hover:bg-black/85"
            title="Pause"
          >
            <Pause size={15} />
          </button>
          <button
            type="button"
            onClick={() => {
              const next = !muted;
              setMuted(next);
              AudioEngine.setMuted(next);
            }}
            className="w-9 h-9 rounded-xl bg-black/70 text-white flex items-center justify-center hover:bg-black/85"
            title="Toggle sound"
          >
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
          <button
            type="button"
            onClick={handleRestart}
            className="w-9 h-9 rounded-xl bg-black/70 text-white flex items-center justify-center hover:bg-black/85"
            title="Restart level"
          >
            <RotateCcw size={15} />
          </button>
          <button
            type="button"
            onClick={() => {
              const nextMode =
                chatSettings.displayMode === 'bubbles' ? 'bottomPanel' : 'bubbles';
              store.updateProject('toggle chat display mode', (p) => ({
                ...p,
                chatSettings: {
                  ...resolveChatDisplaySettings(p.chatSettings),
                  displayMode: nextMode,
                },
              }));
              showToastGlobal(
                nextMode === 'bubbles'
                  ? 'Switched to 3D Chat Bubbles'
                  : 'Switched to Bottom Chat Panel'
              );
            }}
            className="px-2.5 h-9 rounded-xl bg-black/70 border border-white/15 text-white text-xs font-bold inline-flex items-center gap-1.5 hover:bg-black/85 whitespace-nowrap"
            title="Switch between 3D Chat Bubbles and Bottom Chat Panel"
          >
            {chatSettings.displayMode === 'bubbles' ? (
              <>
                <MessageCircle size={14} />
                <span className="hidden sm:inline">Bubbles</span>
              </>
            ) : (
              <>
                <PanelBottom size={14} />
                <span className="hidden sm:inline">Bottom Panel</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              AudioEngine.stopMusic();
              store.setPlayFromPoint(null);
              store.setIsPlaying(false);
            }}
            className="px-3.5 py-2 rounded-xl bg-[#171A23] text-white border border-white/15 text-xs font-extrabold hover:bg-[#1F2430] whitespace-nowrap"
          >
            Back to Editor
          </button>
        </div>
      )}

      {/* Top-right Framerate Viewer (sits cleanly above Minimap HUD at z-[60]) */}
      {!showTitle && (
        <div className="fixed top-4 right-4 z-[60] flex flex-col items-end gap-1.5">
          <button
            type="button"
            onClick={() =>
              setShowPerfHud((v) => {
                if (!v) setPerfStats({ ...latestPerfSnapshotRef.current });
                return !v;
              })
            }
            className="px-2.5 py-1.5 rounded-xl bg-black/75 hover:bg-black/90 text-white text-[11px] font-mono font-bold border border-white/15 inline-flex items-center gap-1.5 tabular-nums shadow-lg"
            title="Toggle detailed framerate, frame time, draw calls, triangles, and JS heap"
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
            <span ref={compactMsTextRef} className="text-white/55 text-[10px] font-sans">
              {showPerfHud ? '▲' : `${perfStats.frameMs.toFixed(0)}ms`}
            </span>
          </button>
          {showPerfHud && (
            <div className="px-3 py-2 rounded-xl bg-black/85 text-white text-[11px] font-mono border border-white/15 shadow-xl space-y-0.5 tabular-nums min-w-[170px]">
              <div className="flex items-center justify-between gap-4 pb-1 mb-1 border-b border-white/10">
                <span className="font-sans font-bold text-[10px] uppercase tracking-wider text-slate-300">
                  Play Stats
                </span>
                <span className="text-[10px] font-sans font-semibold text-emerald-400">
                  {perfStats.backend}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Frame</span>
                <span>{perfStats.frameMs.toFixed(1)} ms</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Draws</span>
                <span>{perfStats.calls.toLocaleString()}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Triangles</span>
                <span>{perfStats.triangles.toLocaleString()}</span>
              </div>
              {perfStats.heapMB !== undefined && (
                <div className="flex justify-between gap-4">
                  <span className="text-slate-400">JS Heap</span>
                  <span>
                    {perfStats.heapMB.toFixed(1)} MB
                    {perfStats.heapLimitMB ? ` / ${Math.round(perfStats.heapLimitMB)}` : ''}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Roguelike Run HUD Strip (Floor, Boss Countdown, Foes / Portal, Active Relics) */}
      {controlsActive && isRoguelike && (() => {
        const bossInterval = Math.max(1, Math.round(roguelikeConfig.bossInterval || 3));
        const isBossFloor = roguelikeRun.floorNumber % bossInterval === 0;
        const bossIn = bossInterval - (roguelikeRun.floorNumber % bossInterval);
        const relicCounts = new Map<string, number>();
        for (const id of roguelikeRun.activeRelics) {
          relicCounts.set(id, (relicCounts.get(id) ?? 0) + 1);
        }
        const uniqueRelics = Array.from(relicCounts.entries())
          .map(([id, count]) => ({ def: getRelicById(id), count }))
          .filter((x): x is { def: RoguelikeRelicDef; count: number } => Boolean(x.def));

        return (
          <div className="fixed top-16 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1.5 pointer-events-none">
            <div className="px-3.5 py-1.5 rounded-xl bg-[#11141D]/90 border border-white/15 text-white text-xs font-bold flex items-center gap-2.5 shadow-lg whitespace-nowrap">
              <Flame size={13} className="text-[#E11D48] shrink-0" />
              <span className="tabular-nums font-extrabold">Floor {roguelikeRun.floorNumber}</span>
              <span className="text-white/30">·</span>
              {isBossFloor ? (
                <span className="text-[#F59E0B] font-extrabold">Boss Vault</span>
              ) : (
                <span className="text-white/75 tabular-nums">
                  Boss in {bossIn}
                </span>
              )}
              <span className="text-white/30">·</span>
              {roguelikeHud.portalUnlocked ? (
                <span className="text-[#4ADE80] font-extrabold">Portal Unlocked</span>
              ) : (
                <span className="text-[#FCA5A5] tabular-nums">
                  {roguelikeHud.baddiesLeft}/{roguelikeHud.baddiesTotal} foes left
                </span>
              )}
            </div>

            {uniqueRelics.length > 0 && (
              <div className="pointer-events-auto flex items-center gap-1 px-2 py-1 rounded-xl bg-[#11141D]/85 border border-white/12 shadow-md">
                {uniqueRelics.map(({ def, count }) => (
                  <div
                    key={def.id}
                    title={`${def.name}: ${def.shortEffect}`}
                    className="relative w-7 h-7 rounded-lg flex items-center justify-center border border-white/10"
                    style={{ backgroundColor: `${def.colorHex}26`, color: def.colorHex }}
                  >
                    <MakerIcon symbol={def.symbol} size={13} />
                    {count > 1 && (
                      <span className="absolute -bottom-1 -right-1 px-1 rounded bg-[#11141D] border border-white/20 text-[9px] font-black text-white tabular-nums leading-tight">
                        {count}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Buddies Quest Progress Strip & Tavern Feast Celebration */}
      {controlsActive && isBuddiesMode && buddyHud.total > 0 && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 pointer-events-none">
          <div className="px-3.5 py-1.5 rounded-xl bg-[#11141D]/85 border border-white/15 text-white text-xs font-bold flex items-center gap-2.5 shadow-lg">
            <Users size={13} className="text-[#FACC15]" />
            <span className="tabular-nums">
              Buddies {buddyHud.found}/{buddyHud.total}
            </span>
            {buddyHud.names.length > 0 && (
              <span className="text-[11px] text-[#4ADE80] font-semibold">
                · {buddyHud.names.join(' · ')}
              </span>
            )}
            {buddyHud.found >= buddyHud.total && !buddyHud.celebrating && (
              <span className="text-[11px] text-[#FACC15] font-semibold">
                · Head to Woodland Tavern!
              </span>
            )}
          </div>

          {buddyHud.celebrationBannerOpen && (
            <div className="pointer-events-auto max-w-md rounded-2xl bg-[#11141D]/92 border border-[#FACC15]/45 p-4 text-center text-white shadow-2xl space-y-2.5">
              <div className="text-sm font-black text-[#FACC15] inline-flex items-center gap-1.5">
                <Sparkles size={15} />
                <span>Acorn Feast Celebration at the Lantern Tavern!</span>
              </div>
              <p className="text-xs text-white/80">
                All three woodland buddies arrived safely! +25 Coins &amp; Golden Crown unlocked in your satchel.
              </p>
              <div className="flex items-center justify-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() =>
                    setBuddyHud((prev) => ({ ...prev, celebrationBannerOpen: false }))
                  }
                  className="px-3 py-1.5 rounded-xl bg-white/12 hover:bg-white/20 text-xs font-bold"
                >
                  Keep Celebrating
                </button>
                <button
                  type="button"
                  onClick={() => {
                    AudioEngine.playSound('fanfare');
                    const parts = (hudState.timeText || '00:01')
                      .split(':')
                      .map((n) => parseInt(n, 10) || 0);
                    const parsedSec =
                      parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0] || 1;
                    setElapsedSec((prev) => Math.max(prev, parsedSec));
                    setFinished(true);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-[#20B46A] hover:opacity-95 text-xs font-extrabold"
                >
                  Finish Adventure
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Driving HUD Deck: Speedometer, Boost, Checkpoints & Live Vehicle/Physics/Driver Switcher */}
      {controlsActive && isDrivingMode && !activeBottomSpeech && (
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1.5 w-[94vw] max-w-3xl">
          <div className="w-full rounded-2xl bg-[#11141D]/90 border border-white/15 px-3.5 py-2.5 text-white shadow-2xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Gauge size={18} className="text-[#38BDF8]" />
                <div>
                  <div className="text-lg font-black leading-none tabular-nums">
                    {driveHud.speedKmh}{' '}
                    <span className="text-[10px] font-bold text-white/60">KM/H</span>
                  </div>
                  <div className="text-[10px] font-semibold text-white/60">
                    {driveHud.airborne
                      ? 'Airborne!'
                      : driveHud.drifting
                      ? 'Drifting'
                      : 'Grip'}
                  </div>
                </div>
              </div>

              <div className="w-24 space-y-1">
                <div className="flex justify-between text-[10px] font-bold text-white/75">
                  <span>Boost</span>
                  <span className="tabular-nums">{driveHud.boost}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/15 overflow-hidden">
                  <div
                    className="h-full bg-[#38BDF8] transition-all duration-75"
                    style={{ width: `${driveHud.boost}%` }}
                  />
                </div>
              </div>

              {driveHud.checkpointsTotal > 0 && (
                <div className="text-xs font-extrabold tabular-nums text-[#4ADE80]">
                  {driveHud.checkpointsHit}/{driveHud.checkpointsTotal}{' '}
                  <span className="text-[10px] font-semibold text-white/65">Arches</span>
                </div>
              )}

              {driveHud.flightSeconds > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#38BDF8]/25 border border-[#38BDF8]/60 text-xs font-black tabular-nums text-[#38BDF8] animate-pulse shadow-[0_0_12px_rgba(56,189,248,0.35)]">
                  <span>🪽 Flight Mode</span>
                  <span>{driveHud.flightSeconds}s</span>
                </div>
              )}

              {driveHud.flightSeconds === 0 && driveHud.hasWings && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-400/40 text-[11px] font-bold text-purple-300">
                  <span>🪽 Wings Equipped</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div
                className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[#1B2030] border border-white/15"
                title="Select driving camera view (C)"
              >
                <Camera size={12} className="text-[#38BDF8] mx-1.5 shrink-0" />
                {DRIVING_CAMERA_VIEWS.map((view) => {
                  const activeView: DrivingCameraView = drivingCfg.cameraView ?? 'closeChase';
                  const isActive = activeView === view.id;
                  return (
                    <button
                      key={view.id}
                      type="button"
                      onClick={(e) => {
                        setDrivingCfg((prev) => ({ ...prev, cameraView: view.id }));
                        e.currentTarget.blur();
                      }}
                      title={view.blurb}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors whitespace-nowrap ${
                        isActive
                          ? 'bg-[#0EA5E9] text-white'
                          : 'text-white/70 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {view.shortLabel}
                    </button>
                  );
                })}
              </div>

              <label className="flex items-center gap-1 text-[10px] font-bold text-white/65">
                <Car size={12} className="text-[#38BDF8]" />
                <select
                  value={drivingCfg.carId}
                  onChange={(e) => {
                    const next = e.target.value as CarPresetId;
                    setDrivingCfg((prev) => ({ ...prev, carId: next }));
                    e.currentTarget.blur();
                  }}
                  className="px-2 py-1 rounded-lg bg-[#1B2030] border border-white/15 text-[11px] font-bold text-white focus:outline-none"
                >
                  {CAR_PRESETS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <select
                value={drivingCfg.physicsId}
                onChange={(e) => {
                  const next = e.target.value as DrivingPhysicsId;
                  setDrivingCfg((prev) => ({ ...prev, physicsId: next }));
                  e.currentTarget.blur();
                }}
                className="px-2 py-1 rounded-lg bg-[#1B2030] border border-white/15 text-[11px] font-bold text-white focus:outline-none"
                title="Driving Physics"
              >
                {DRIVING_PHYSICS_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              <select
                value={drivingCfg.driverId}
                onChange={(e) => {
                  const next = e.target.value as DriverTypeId;
                  setDrivingCfg((prev) => ({ ...prev, driverId: next }));
                  e.currentTarget.blur();
                }}
                className="px-2 py-1 rounded-lg bg-[#1B2030] border border-white/15 text-[11px] font-bold text-white focus:outline-none"
                title="Driver Type"
              >
                {DRIVER_TYPES.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pointer-events-none text-[10px] font-semibold text-white/80 bg-black/55 px-3 py-1 rounded-lg whitespace-nowrap">
            W/S Accelerate &amp; Reverse · A/D Steer · Space Handbrake / Hold in Air to Glide · Shift Boost · C Camera View · R Reset to road
          </div>
        </div>
      )}

      {/* Active Fishing Prompt Callout */}
      {controlsActive && fishingBanner !== 'none' && (
        <div
          className={`fixed ${
            isRpgMode ? 'bottom-28' : unlockedPowers.length > 0 ? 'bottom-32' : 'bottom-24'
          } left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl border text-xs font-extrabold shadow-xl z-30 flex items-center gap-2 ${
            fishingBanner === 'bite'
              ? 'bg-[#0EA5E9] border-white/40 text-white animate-bounce'
              : 'bg-black/75 border-white/15 text-white/90'
          }`}
        >
          <Fish size={15} />
          <span>
            {fishingBanner === 'bite'
              ? 'Fish on the line! Press F or Hit to pull it in!'
              : 'Line cast — waiting for a bite… (Move to cancel)'}
          </span>
        </div>
      )}

      {/* Crafting Bench Interaction Prompt */}
      {controlsActive && nearCraftingBench && !harvestPrompt && (
        <div
          className={`fixed ${
            isRpgMode ? 'bottom-28' : unlockedPowers.length > 0 ? 'bottom-32' : 'bottom-24'
          } left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-[#11141D]/92 border border-[#F59E0B]/50 text-white text-xs font-extrabold shadow-xl z-30 flex items-center gap-2 whitespace-nowrap`}
        >
          <Anvil size={14} className="text-[#F59E0B]" />
          <span>
            Press <span className="px-1.5 py-0.5 mx-0.5 rounded bg-white/15 font-mono text-[11px]">E</span> to use{' '}
            <span className="text-[#F59E0B]">Crafting Bench</span>
          </span>
        </div>
      )}

      {/* World Interaction Prompts */}
      <PlayInteractionPrompts
        controlsActive={controlsActive}
        unlockedPowersCount={unlockedPowers.length}
        nearCraftingBench={nearCraftingBench}
        isChestOpeningAnim={isChestOpeningAnim}
        chestInteractPrompt={chestInteractPrompt}
        doorInteractPrompt={doorInteractPrompt}
        harvestPrompt={harvestPrompt}
        sitPrompt={sitPrompt}
        climbPrompt={climbPrompt}
        glidePrompt={glidePrompt}
        worldActionPrompt={worldActionPrompt}
        isRpgMode={isRpgMode}
      />

      {/* Quick Misfit Powers + Held-Tool Bar + Subtle Control Hint (Non-RPG modes) */}
      {controlsActive && !activeBottomSpeech && !isDrivingMode && !isRpgMode && (
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 z-20">
          {unlockedPowers.length > 0 && (
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#11141D]/88 border border-white/15 shadow-lg">
              {unlockedPowers.map((abId) => {
                const meta = MisfitAbilityById[abId];
                const isSelected = activePower === abId;
                const isCooling = coolingPowerId === abId;
                return (
                  <button
                    key={abId}
                    type="button"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      if (vultureLookoutActive) {
                        inputRef.current.vultureExitQueued = true;
                        return;
                      }
                      if (activePowerRef.current !== abId) {
                        activePowerRef.current = abId;
                        setActivePower(abId);
                        showToastGlobal(`${meta.title}: ${meta.strengthLabel}`);
                      } else {
                        inputRef.current.misfitPowerQueued = true;
                      }
                    }}
                    title={`${meta.title} (${meta.flawLabel} -> ${meta.strengthLabel}) · Press Q to use, X to cycle`}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                      isSelected
                        ? 'text-[#0F1117]'
                        : 'bg-white/6 text-white/80 hover:bg-white/14'
                    } ${isCooling ? 'opacity-55' : ''}`}
                    style={isSelected ? { backgroundColor: meta.colorHex } : undefined}
                  >
                    <MakerIcon
                      symbol={meta.symbol}
                      size={13}
                      color={isSelected ? '#0F1117' : meta.colorHex}
                    />
                    <span>{meta.title}</span>
                    {isSelected && (
                      <span className="px-1 py-0.2 rounded bg-black/20 text-[9px] font-black">
                        {vultureLookoutActive ? 'Land' : 'Q'}
                      </span>
                    )}
                  </button>
                );
              })}
              {unlockedPowers.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    const idx = activePower ? unlockedPowers.indexOf(activePower) : -1;
                    const next = unlockedPowers[(idx + 1) % unlockedPowers.length];
                    activePowerRef.current = next;
                    setActivePower(next);
                    AudioEngine.playSound('step');
                    showToastGlobal(`${MisfitAbilityById[next].title}: ${MisfitAbilityById[next].strengthLabel}`);
                  }}
                  className="px-2 py-1.5 rounded-lg bg-white/8 hover:bg-white/15 text-[10px] font-bold text-white/75 whitespace-nowrap"
                  title="Switch Misfit Power (X)"
                >
                  X
                </button>
              )}
            </div>
          )}

          {quickHotbarTools.length > 0 && (
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#11141D]/85 border border-white/15">
              {quickHotbarTools.map(({ def }, idx) => {
                const isHeld = equipment.heldItemId === def.id;
                return (
                  <button
                    key={def.id}
                    type="button"
                    onClick={() => handleHoldItem(def.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1.5 transition-colors ${
                      isHeld
                        ? 'bg-[#7C5CFF] text-white'
                        : 'bg-white/6 text-white/80 hover:bg-white/14'
                    }`}
                    title={`${def.name} (Press ${idx + 3})`}
                  >
                    <InventoryItemIcon
                      icon={def.icon}
                      size={13}
                      color={isHeld ? '#FFFFFF' : def.colorHex}
                    />
                    <span className="max-w-[96px] truncate">{def.name}</span>
                    <span className="text-[9px] opacity-65">{idx + 3}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setInventoryMode('bag');
                  setInventoryOpen(true);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-[#20B46A]/20 hover:bg-[#20B46A]/35 text-[#4ADE80] text-[11px] font-extrabold inline-flex items-center gap-1 whitespace-nowrap"
                title={`Open ${inventoryConfig.panelTitle} (${formatKeyCodeLabel(inventoryConfig.toggleKey)})`}
              >
                <Backpack size={13} />
                <span>{formatKeyCodeLabel(inventoryConfig.toggleKey)}</span>
              </button>
            </div>
          )}

          <div className="pointer-events-none text-[10px] font-semibold text-white/80 bg-black/55 px-3 py-1 rounded-lg whitespace-nowrap">
            {vultureLookoutActive
              ? 'High Sight Aerial Lookout · Press Q or Space to return to trail'
              : resolvedCamMode === 'sideScroll'
              ? `A/D or Stick move · W/Space/Shift jump · F/Ctrl hit · E/Alt use · M map · ${formatKeyCodeLabel(inventoryConfig.toggleKey)} bag`
              : isBuddiesMode
              ? `WASD move · Q use power · X switch power · E/Alt gather/talk · M map · ${formatKeyCodeLabel(inventoryConfig.toggleKey)} bag · V view`
              : resolvedCamMode === 'firstPerson'
              ? `W/S move · A/D turn · Space/Shift jump · F/Ctrl hit · E/Alt use · M map · ${formatKeyCodeLabel(inventoryConfig.toggleKey)} bag · V view`
              : resolvedCamMode === 'front'
              ? `W/S move · A/D turn world · Space/Shift jump · F/Ctrl hit · E/Alt use · M map · ${formatKeyCodeLabel(inventoryConfig.toggleKey)} bag · V view`
              : resolvedCamMode === 'heroFront'
              ? `WASD or Stick move · Space/Shift jump · F/Ctrl hit · E/Alt use · M map · ${formatKeyCodeLabel(inventoryConfig.toggleKey)} bag · V view`
              : `WASD move · Space/Shift jump · F/Ctrl hit · E/Alt use · M map · ${formatKeyCodeLabel(inventoryConfig.toggleKey)} bag · V view`}
          </div>
        </div>
      )}

      {/* Active Hero Combat Status Indicator */}
      {controlsActive && heroStatusBanner && (
        <div
          className={`fixed top-16 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-xl border text-xs font-extrabold shadow-lg z-30 flex items-center gap-2 whitespace-nowrap ${
            heroStatusBanner.kind === 'burn'
              ? 'bg-orange-950/90 border-orange-400/60 text-orange-200'
              : heroStatusBanner.kind === 'freeze'
              ? 'bg-sky-950/90 border-sky-300/60 text-sky-100'
              : heroStatusBanner.kind === 'shock'
              ? 'bg-amber-950/90 border-yellow-300/60 text-yellow-100'
              : heroStatusBanner.kind === 'poison'
              ? 'bg-emerald-950/90 border-emerald-400/60 text-emerald-100'
              : 'bg-stone-900/92 border-amber-400/50 text-amber-100'
          }`}
        >
          <Flame size={13} />
          <span>{heroStatusBanner.label}</span>
        </div>
      )}

      {/* Active Terrain / Temperature / Environment Trait Indicator */}
      {controlsActive && heroTraitBanner && !heroStatusBanner && (
        <div
          className={`fixed top-16 left-1/2 -translate-x-1/2 px-3 py-1 rounded-xl border text-[11px] font-bold shadow-md z-25 whitespace-nowrap ${
            heroTraitBanner.tone === 'strength'
              ? 'bg-emerald-950/85 border-emerald-400/50 text-emerald-100'
              : 'bg-rose-950/85 border-rose-400/50 text-rose-100'
          }`}
        >
          {heroTraitBanner.label}
        </div>
      )}

      {/* Boss Victory Banner */}
      {controlsActive && bossVictoryBanner && (
        <div className="fixed top-28 left-1/2 -translate-x-1/2 px-5 py-3 rounded-2xl bg-[#141722]/95 border border-[#FACC15]/70 text-white shadow-2xl z-30 flex items-center gap-3">
          <Sparkles size={18} className="text-[#FACC15]" />
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-[#FACC15]">
              Boss Vanquished!
            </div>
            <div className="text-xs font-bold text-white/90">
              {bossVictoryBanner.bossName} defeated — open the Great Treasure Chest!
            </div>
          </div>
        </div>
      )}

      {/* Toast message */}
      {toast && (
        <div className="fixed top-18 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-[#171A23]/95 border border-white/10 text-white text-xs font-bold shadow-lg z-30">
          {toast}
        </div>
      )}

      {/* In-Game World Map & Save Plinth Fast-Travel Overlay */}
      {(worldMapOpen || fastTravelState !== null) && !showTitle && !dead && !finished && activePlayLevel && (
        <InGameWorldMapModal
          project={currentProject}
          currentLevel={activePlayLevel}
          mode={fastTravelState ? 'fastTravel' : 'worldMap'}
          currentPlinthEntityId={fastTravelState?.plinthEntityId}
          currentPlinthName={fastTravelState?.plinthName}
          heroLocalX={liveHeroTransformRef.current.x}
          heroLocalZ={liveHeroTransformRef.current.z}
          heroYaw={liveHeroTransformRef.current.yaw}
          discoveredPlinthKeys={discoveredPlinthKeys}
          onFastTravel={handleFastTravelToPlinth}
          onClose={() => {
            setFastTravelState(null);
            setWorldMapOpen(false);
          }}
        />
      )}

      {/* Inventory & Crafting Bench Modal Overlay */}
      {inventoryOpen && !showTitle && (
        <InventoryModal
          heroName={currentProject.heroName}
          inventoryConfig={inventoryConfig}
          initialMode={inventoryMode}
          nearWorldBench={nearCraftingBench}
          stacks={effectiveInventoryStacks}
          equipment={equipment}
          catalog={itemCatalog}
          recipes={craftingRecipes}
          health={hudState.health}
          maxHealth={hudState.maxHealth}
          stamina={hudState.stamina}
          magic={hudState.magic}
          attackPower={heroBonusStats.attackPower}
          defensePower={heroBonusStats.defensePower}
          speedPct={heroBonusStats.speedPct}
          onSelectItem={store.setSelectedInventoryItemId}
          onHoldItem={handleHoldItem}
          onWearItem={handleWearItem}
          onUnequipSlot={handleUnequipSlot}
          onConsumeItem={handleConsumeItem}
          onMixItems={handleMixItems}
          onCraftRecipe={handleCraftRecipe}
          onRepairItem={handleRepairItem}
          onClose={() => setInventoryOpen(false)}
        />
      )}

      {/* Treasure Chest Contents Selection Modal */}
      {activeChestLoot && !showTitle && !dead && !finished && (
        <ChestLootModal
          chestName={activeChestLoot.chestName}
          entries={activeChestLoot.entries}
          onTakeEntry={handleTakeChestEntry}
          onTakeAll={handleTakeAllChestEntries}
          onClose={() => setActiveChestLoot(null)}
        />
      )}

      {/* Dynamic 3D-Tracked Character Chat Bubbles Overlay */}
      {!showTitle &&
        chatSettings.displayMode === 'bubbles' &&
        activeSpeeches.some(
          (s) => s.outputMode !== 'audio' && Boolean((s.lines[s.lineIndex] ?? '').trim())
        ) && (
        <div className="pointer-events-none fixed inset-0 z-25 overflow-hidden">
          {activeSpeeches
            .filter(
              (sp) =>
                sp.outputMode !== 'audio' && Boolean((sp.lines[sp.lineIndex] ?? '').trim())
            )
            .map((sp) => {
            const currentLine = sp.lines[sp.lineIndex] ?? sp.lines[0] ?? '';
            const hasMore = sp.lineIndex + 1 < sp.lines.length;
            const counter =
              sp.lines.length > 1 ? `${sp.lineIndex + 1}/${sp.lines.length}` : undefined;
            const hint = sp.isProximity
              ? sp.lines.length > 1
                ? 'Press E'
                : undefined
              : hasMore
              ? 'Next (E)'
              : sp.expiresAt === null
              ? 'Done (E)'
              : undefined;
            return (
              <div
                key={sp.key}
                ref={(el) => {
                  bubbleDomRefs.current[sp.key] = el;
                }}
                className="fixed left-0 top-0 will-change-transform"
                style={{
                  opacity: 0,
                  transform: 'translate3d(-9999px, -9999px, 0)',
                }}
              >
                <ChatBubbleView
                  speaker={sp.speaker}
                  text={currentLine}
                  style={sp.style}
                  kind={sp.kind}
                  replayNonce={sp.nonce}
                  lineCounter={counter}
                  actionHint={hint}
                  onClick={() => advanceOrDismissSpeech(sp.key)}
                  onDismiss={
                    sp.expiresAt === null && !sp.isProximity
                      ? () => dismissCharacterSpeech(sp.key)
                      : undefined
                  }
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Live Cutaway Letterbox Bars, "Meanwhile..." Caption, Narrator Storybook Banner & Skip */}
      <PlayCutawayOverlay
        show={!showTitle}
        cutaway={activeCutawayHud}
        onSkip={() => {
          skipCutawaySignalRef.current = true;
        }}
      />

      {/* Bottom-of-Screen Chat Panel Mode Overlay */}
      {!showTitle && chatSettings.displayMode === 'bottomPanel' && activeBottomSpeech && (
        <div
          className={`fixed inset-x-0 bottom-5 z-30 flex justify-center px-4 ${
            chatSettings.panelPauseGame ? '' : 'pointer-events-none'
          }`}
          onClick={
            chatSettings.panelPauseGame
              ? () => advanceOrDismissSpeech(activeBottomSpeech.key)
              : undefined
          }
        >
          <div className="w-full max-w-2xl pointer-events-auto">
            <BottomChatPanelView
              speaker={activeBottomSpeech.speaker}
              roleLabel={activeBottomSpeech.roleLabel}
              text={
                activeBottomSpeech.lines[activeBottomSpeech.lineIndex] ??
                activeBottomSpeech.lines[0] ??
                ''
              }
              characterStyle={activeBottomSpeech.style}
              kind={activeBottomSpeech.kind}
              settings={chatSettings}
              history={chatHistory}
              lineIndex={activeBottomSpeech.lineIndex}
              totalLines={activeBottomSpeech.lines.length}
              replayNonce={activeBottomSpeech.nonce}
              onAdvance={() => advanceOrDismissSpeech(activeBottomSpeech.key)}
              onClose={() => dismissCharacterSpeech(activeBottomSpeech.key)}
            />
          </div>
        </div>
      )}

      {/* Storybook Chapter Banner (briefly shown when entering gameplay) */}
      {!showTitle && currentProject.storybook?.enabled && (
        <StorybookChapterBanner
          level={currentLevel}
          storybook={currentProject.storybook}
          visible={chapterBannerVisible && !activeCutawayHud}
        />
      )}

      {/* Title / Storybook Cover Screen */}
      {showTitle &&
        (currentProject.storybook?.enabled ? (
          <StorybookCoverModal
            project={currentProject}
            level={currentLevel}
            storybook={currentProject.storybook}
            onStart={() => setShowTitle(false)}
            onBackToEditor={() => {
              store.setPlayFromPoint(null);
              store.setIsPlaying(false);
            }}
          />
        ) : (
          <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#171A23] text-slate-900 dark:text-[#F3F5FA] border border-slate-200/80 dark:border-white/[0.1] p-7 text-center shadow-2xl space-y-5">
              <div className="flex justify-center">
                <IconBadge
                  symbol={currentProject.symbol}
                  tint={currentProject.colorHex}
                  size={68}
                />
              </div>
              <div className="space-y-1.5">
                <h1 className="text-3xl font-black">{currentProject.name}</h1>
                <p className="text-sm text-slate-500 dark:text-[#949BB0]">
                  {currentProject.coverTagline || currentProject.tagline}
                </p>
              </div>
              <div className="flex items-center justify-center gap-3">
                <Pill text={`Hero: ${currentProject.heroName}`} tint="#7C5CFF" />
                <span className="text-slate-400">·</span>
                <Pill text={currentProject.difficulty} tint="#F59E0B" />
              </div>
              <div className="pt-2 space-y-2">
                {savedProgressForTitle && (
                  <button
                    type="button"
                    onClick={() => {
                      (document.activeElement as HTMLElement | null)?.blur?.();
                      AudioEngine.unlock();
                      const { saved } = savedProgressForTitle;
                      hydrateExploration(currentProject.id, saved.explorationB64);
                      hydrateDiscoveredPlinths(currentProject.id, saved.discoveredPlinthKeys);
                      setDiscoveredPlinthKeys(getDiscoveredPlinthKeys(currentProject.id));
                      resumeSavedRef.current = saved;
                      const hasBlanket = saved.inventoryStacks.some(
                        (s) => s.itemId === 'parachute_blanket'
                      );
                      setInventoryStacks(
                        hasBlanket
                          ? saved.inventoryStacks
                          : [
                              ...saved.inventoryStacks,
                              {
                                itemId: 'parachute_blanket',
                                qty: 1,
                                durability: 100,
                                maxDurability: 100,
                              },
                            ]
                      );
                      setEquipment(saved.equipment);
                      if (saved.levelId !== currentLevel.id) {
                        store.setSelectedLevelID(saved.levelId);
                      }
                      setShowTitle(false);
                    }}
                    className="w-full py-3 rounded-2xl bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-sm font-extrabold inline-flex items-center justify-center gap-2 shadow-md px-3"
                  >
                    <Play size={16} fill="currentColor" />
                    <span className="truncate">
                      Continue at {savedProgressForTitle.saved.plinthName} ({savedProgressForTitle.levelName})
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    (document.activeElement as HTMLElement | null)?.blur?.();
                    AudioEngine.unlock();
                    if (savedProgressForTitle) {
                      resetExploration(currentProject.id);
                      clearDiscoveredPlinths(currentProject.id);
                      clearSavedPlayProgress(currentProject.id);
                      setDiscoveredPlinthKeys(new Set());
                      resumeSavedRef.current = null;
                    }
                    setShowTitle(false);
                  }}
                  className={`w-full py-3.5 rounded-2xl text-white text-base font-extrabold hover:opacity-95 inline-flex items-center justify-center gap-2 shadow-md ${
                    savedProgressForTitle ? 'bg-[#20B46A]/90' : 'bg-[#20B46A]'
                  }`}
                >
                  <Play size={18} fill="currentColor" />
                  <span>{savedProgressForTitle ? 'Start Fresh Adventure' : 'Start Adventure'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    store.setPlayFromPoint(null);
                    store.setIsPlaying(false);
                  }}
                  className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-[#1F2430] text-xs font-bold text-slate-600 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white"
                >
                  Back to Editor
                </button>
              </div>
            </div>
          </div>
        ))}

      {/* Pause Modal */}
      <PlayPauseModal
        isOpen={Boolean(paused && !finished && !dead && !roguelikeRun.draftOptions)}
        isRoguelike={isRoguelike}
        onResume={() => setPaused(false)}
        onOpenWorldMap={() => {
          setPaused(false);
          setFastTravelState(null);
          setWorldMapOpen(true);
        }}
        onRestart={handleRestart}
        onBackToEditor={() => {
          AudioEngine.stopMusic();
          store.setPlayFromPoint(null);
          store.setIsPlaying(false);
        }}
      />

      {/* Roguelike Floor Cleared — 3-Choice Relic Draft Modal */}
      <RoguelikeRelicDraftModal
        isOpen={Boolean(isRoguelike && roguelikeRun.draftOptions && !dead && !finished)}
        floorNumber={roguelikeRun.floorNumber}
        enemiesSlain={roguelikeRun.enemiesSlain}
        activeRelics={roguelikeRun.activeRelics}
        draftOptions={roguelikeRun.draftOptions}
        onSelectRelic={handleSelectRelic}
      />

      {/* Out of Health / Permadeath Run Summary Modal */}
      <PlayGameOverModal
        isDead={dead}
        isRoguelike={isRoguelike}
        roguelikeSummary={
          dead && isRoguelike
            ? roguelikeRun.runSummary ?? {
                floorReached: roguelikeRun.floorNumber,
                enemiesSlain: roguelikeRun.enemiesSlain,
                bossesSlain: roguelikeRun.bossesSlain,
                coinsEarned: roguelikeRun.coinsEarned,
                relicIds: roguelikeRun.activeRelics,
                runSeed: roguelikeRun.runSeed,
              }
            : null
        }
        onRestart={handleRestart}
        onBackToEditor={() => {
          AudioEngine.stopMusic();
          store.setPlayFromPoint(null);
          store.setIsPlaying(false);
        }}
      />

      {/* Cohesive Full-Screen Isometric RPG HUD System */}
      {isRpgMode && !showTitle && !dead && !finished && (
        <RpgGameHudOverlay
          heroName={currentProject.heroName}
          levelName={activePlayLevel?.name ?? currentLevel.name}
          hudState={hudState}
          rpgStats={rpgStats}
          heroAttackBonus={heroBonusStats.attackPower}
          heroDefenseBonus={heroBonusStats.defensePower}
          buddyHud={buddyHud}
          allBuddyNames={(activePlayLevel ?? currentLevel).entities
            .filter((e) => e.kind === 'npc' && e.isBuddy)
            .map((e) => e.name)}
          quickHotbarTools={quickHotbarTools}
          heldItemId={equipment.heldItemId}
          bagCount={inventoryStacks.reduce((sum, s) => sum + s.qty, 0)}
          bagKeyLabel={formatKeyCodeLabel(inventoryConfig.toggleKey)}
          resolvedCamMode={resolvedCamMode}
          worldMapOpen={worldMapOpen || fastTravelState !== null}
          inventoryOpen={inventoryOpen}
          muted={muted}
          chatDisplayMode={chatSettings.displayMode}
          allowFannedCards={
            currentLevel.rpgConfig?.lootMode === 'fannedCards' ||
            currentLevel.rpgConfig?.lootMode === 'both' ||
            !currentLevel.rpgConfig
          }
          onTriggerSword={() => {
            setRpgStats((prev) => ({ ...prev, activeCombatStyle: 'sword' }));
            inputRef.current.attackQueued = true;
          }}
          onTriggerArrow={() => {
            setRpgStats((prev) => ({ ...prev, activeCombatStyle: 'arrow' }));
            inputRef.current.arrowQueued = true;
          }}
          onTriggerMagic={() => {
            setRpgStats((prev) => ({ ...prev, activeCombatStyle: 'magic' }));
            inputRef.current.magicQueued = true;
          }}
          onTriggerHeal={() => {
            inputRef.current.healQueued = true;
          }}
          onOpenTreasureCards={() => {
            openRpgCardModalRef.current('Destiny Treasure Cards');
          }}
          onHoldTool={(itemId) => handleHoldItem(itemId)}
          onToggleMap={() => {
            setFastTravelState(null);
            setWorldMapOpen((o) => !o);
          }}
          onToggleInventory={() => {
            setInventoryMode('bag');
            setInventoryOpen((o) => !o);
          }}
          onCycleCamera={() => toggleCharacterPov()}
          onTogglePause={() => setPaused((p) => !p)}
          onToggleMute={() => {
            const next = !muted;
            setMuted(next);
            AudioEngine.setMuted(next);
          }}
          onRestart={handleRestart}
          onToggleChatMode={() => {
            const nextMode =
              chatSettings.displayMode === 'bubbles' ? 'bottomPanel' : 'bubbles';
            store.updateProject('toggle chat display mode', (p) => ({
              ...p,
              chatSettings: {
                ...resolveChatDisplaySettings(p.chatSettings),
                displayMode: nextMode,
              },
            }));
            showToastGlobal(
              nextMode === 'bubbles'
                ? 'Switched to 3D Chat Bubbles'
                : 'Switched to Bottom Chat Panel'
            );
          }}
          onBackToEditor={() => {
            AudioEngine.stopMusic();
            store.setPlayFromPoint(null);
            store.setIsPlaying(false);
          }}
        />
      )}

      {/* Isometric RPG Fanned-Out Colorful Treasure & Skill Cards Modal */}
      {rpgCardModal && (
        <RpgRewardCardsModal
          sourceTitle={rpgCardModal.sourceTitle}
          cards={rpgCardModal.cards}
          onSelectCard={(card) => {
            liveRpgApplyRewardRef.current?.(card);
            setRpgCardModal(null);
          }}
          onDismiss={() => setRpgCardModal(null)}
        />
      )}

      {/* Level Complete / Storybook Epilogue Modal */}
      <PlayLevelCompleteModal
        finished={finished}
        project={currentProject}
        level={currentLevel}
        storybook={currentProject.storybook}
        elapsedSec={elapsedSec}
        coins={hudState.coins}
        buddyHud={buddyHud}
        storyStats={storyStats}
        nextLevel={nextLevel}
        onNextLevel={() => {
          if (!nextLevel) return;
          store.setSelectedLevelID(nextLevel.id);
          setFinished(false);
          setResetTick((t) => t + 1);
        }}
        onPlayAgain={handleRestart}
        onBackToEditor={() => {
          AudioEngine.stopMusic();
          store.setPlayFromPoint(null);
          store.setIsPlaying(false);
        }}
      />
    </div>
  );
};
