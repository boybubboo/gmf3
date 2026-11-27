import type {
  BonePoseAngles,
  CreatureBodyId,
  CustomClipSlot,
  CustomMotionPreset,
  CustomPoseKeyframe,
  CustomRigSettings,
  MotionActorCategory,
  MotionActorTarget,
  MotionAssignmentScope,
  MotionEasing,
  MotionEventKind,
  MotionEventMarker,
  MotionFitReport,
  MotionFitWarning,
  MotionFitWarningCode,
  MotionRigArchetype,
  RigAnimationMode,
  RigBoneRole,
  RigSwingAxis,
  SavedPosePreset,
  SlotMotionTuning,
} from './motion';

import type {
  CraftingRecipe,
  CraftingRecipeCategory,
  GameInventoryConfig,
  HeroEquipment,
  InventoryCategoryConfig,
  InventoryCustomStat,
  InventoryItemCategory,
  InventoryItemDef,
  InventoryStack,
  InventoryStatProfile,
  ItemMetadata,
  ItemRarity,
  ObjectAttachBodyPart,
  PickupMeshKind,
  ToolActionKind,
  WearSlot,
  WorldCollectibleRule,
  WorldCollectibleScatterKind,
} from './inventory';

export * from './motion';
export * from './inventory';

export type StudioTheme = 'dark' | 'light';

export type VisualStyleId = 'painterlyPBR' | 'celToon' | 'softFantasy';

export type CameraMode = 'front' | 'heroFront' | 'chase' | 'cozy' | 'isometric' | 'sideScroll' | 'firstPerson';

export type EnvironmentType = 'openWorld' | 'dungeon' | 'castle' | 'sideScroller' | 'scifi';

export type AssetCategory = 'character' | 'prop' | 'scenery' | 'plant' | 'tree' | 'building';

export type ObjectInteractionAttributeId =
  | 'sit'
  | 'hold'
  | 'swing'
  | 'throw'
  | 'sleep'
  | 'jump'
  | 'fishing'
  | 'lift'
  | 'pull'
  | 'push'
  | 'dig'
  | 'climbVertical'
  | 'climbStairs'
  | 'crouch'
  | 'sneak'
  | 'stab'
  | 'bowPull';

export type CharacterInteractionMotionId = 'hug' | 'punch' | 'push' | 'kick';

export interface ObjectInteractionCalibration {
  offset: [number, number, number];
  yawDeg: number;
  presetId?: string;
}

export type MechanismKind =
  | 'hinge'
  | 'slider'
  | 'spinner'
  | 'pendulum'
  | 'springBounce'
  | 'transporter';
export type MechanismAxis = 'x' | 'y' | 'z';
export type MechanismPlaybackMode = 'toggle' | 'once' | 'autoReturn' | 'loop';
export type MechanismTriggerEvent =
  | 'playerUses'
  | 'playerNear'
  | 'playerTouches'
  | 'flagSet'
  | 'levelStarts';
export type MechanismConditionKind =
  | 'none'
  | 'hasKey'
  | 'hasItem'
  | 'flagSet'
  | 'baddiesGone';
export type MechanismActionMode = 'toggle' | 'open' | 'close';
export type BuiltinMechanismTemplate =
  | 'treasureChest'
  | 'slidingDoor'
  | 'leverSwitch'
  | 'drawbridge'
  | 'bounceSpring'
  | 'spinHazard'
  | 'pendulumVine'
  | 'warpCannon';

export interface MechanismTriggerRule {
  id: string;
  event: MechanismTriggerEvent;
  /** Interaction / proximity radius in world units */
  radius: number;
  /** Flag name watched when event === 'flagSet' */
  eventFlag?: string;
  condition: MechanismConditionKind;
  /** Flag name (flagSet) or inventory item ID (hasItem) */
  conditionValue?: string;
  /** Consume the key or required item on trigger */
  consumeRequired?: boolean;
  /** Feedback shown when player triggers interaction while condition is unmet */
  lockedMessage?: string;
  /** Action applied to this mechanism */
  action: MechanismActionMode;
  /** Optional game flag raised when mechanism opens (enables cross-object puzzle chains) */
  setFlagOnOpen?: string;
  /** Clear setFlagOnOpen when mechanism closes */
  clearFlagOnClose?: boolean;
  /** Optional coins awarded the first time this mechanism opens */
  rewardCoins?: number;
  /** Optional inventory item ID granted the first time this mechanism opens */
  rewardItemId?: string;
  /** Optional toast shown on activation */
  message?: string;
  /** Sound cue on activation */
  sound?: 'door' | 'coin' | 'sparkle' | 'chime' | 'jump' | 'whoosh' | 'none';
}

export interface ObjectMechanism {
  id: string;
  name: string;
  /** Stable hierarchical path to the movable child Object3D (e.g. "Chest_Lid") */
  targetNodePath: string;
  /** Human-readable display label of the targeted child mesh/group */
  targetLabel: string;
  kind: MechanismKind;
  axis: MechanismAxis;
  /** Local-space pivot coordinate [x, y, z] relative to model root (used by hinges) */
  pivot: [number, number, number];
  /** Hinge rest angle in degrees */
  restAngleDeg: number;
  /** Hinge activated/open angle in degrees */
  openAngleDeg: number;
  /** Linear slider rest offset in model units */
  restOffset: number;
  /** Linear slider activated/open offset in model units */
  openOffset: number;
  /** Motion duration in seconds */
  duration: number;
  easing: MotionEasing;
  playbackMode: MechanismPlaybackMode;
  /** Hold seconds before auto-return closes (when playbackMode === 'autoReturn') */
  autoReturnDelay?: number;
  /** Continuous angular speed in deg/s (used by 'spinner') */
  spinSpeedDegPerSec?: number;
  /** Peak swing amplitude in degrees (used by 'pendulum') */
  swingAmplitudeDeg?: number;
  /** Swing frequency in Hz (used by 'pendulum') */
  swingFrequencyHz?: number;
  /** Upward launch impulse m/s on touch/use (used by 'springBounce') */
  bounceVelocity?: number;
  /** Optional horizontal forward impulse m/s (used by 'springBounce' / 'transporter') */
  bounceForwardBoost?: number;
  /** Destination board coordinate when triggered (used by 'transporter') */
  transportTarget?: BoardPoint;
  /** Optional explicit destination world Y (used by 'transporter') */
  transportTargetY?: number;
  /** Optional secret room ID to warp inside (used by 'transporter') */
  transportToSecretRoomId?: string;
  /** Optional toast label shown on warp */
  transportLabel?: string;
  /** Marks spinning/pendulum contraption as hazardous on contact */
  isHazard?: boolean;
  /** Conditional game triggers controlling this mechanism */
  triggers: MechanismTriggerRule[];
}

export type EntityRolePreset = 'buddy' | 'enemy' | 'neutralSpeaker' | 'neutralSilent';

export interface CustomAssetMeta {
  id: string;
  name: string;
  category: AssetCategory;
  fileName: string;
  byteSize: number;
  hasSkeleton: boolean;
  boneNames?: string[];
  animationClips: string[];
  clipMap: Partial<Record<CustomClipSlot, string>>;
  rigSettings?: CustomRigSettings;
  customAnimations?: CustomMotionPreset[];
  savedPoses?: SavedPosePreset[];
  mechanisms?: ObjectMechanism[];
  interactionAttributes?: ObjectInteractionAttributeId[];
  interactionCalibrations?: Partial<Record<ObjectInteractionAttributeId, ObjectInteractionCalibration>>;
  objectRecipe?: ObjectMakerDoc;
  characterRecipe?: CharacterMakerDoc;
  treeRecipe?: StylizedCanopyConfig;
  buildingBlock?: BuildingBlockConfig;
  vertexPaintStrokes?: VertexPaintStroke[];
  favorite?: boolean;
  defaultRolePreset?: EntityRolePreset;
  defaultDialogue?: string;
  defaultPickupItemId?: string;
  defaultLoot?: string;
  defaultSlotPresets?: Partial<Record<CustomClipSlot, string>>;
  attachBodyPart?: ObjectAttachBodyPart;
  linkedInventoryItemId?: string;
  groundOffset: number;
  defaultScale: number;
  animSpeed: number;
  thumbnailDataUrl?: string;
  createdAt: string;
}

export type PlantLeafPatternId =
  | 'solid'
  | 'veins'
  | 'ribs'
  | 'variegated'
  | 'spotted'
  | 'striped'
  | 'gradientTip'
  | 'bioluminescent';

export type PlantShapeId =
  | 'leafBanana'
  | 'leafElephantEar'
  | 'leafTeardrop'
  | 'leafBlade'
  | 'leafMonstera'
  | 'leafFern'
  | 'leafLotus'
  | 'leafHeartVine'
  | 'petalRound'
  | 'petalPointed'
  | 'petalRuffled'
  | 'petalOrchid'
  | 'flowerCenter'
  | 'stemCurved'
  | 'bulbCorm'
  | 'vineTendril'
  | 'fantasyBell'
  | 'fantasyMushroom'
  | 'fantasySpiralRibbon'
  | 'fantasySporeOrb'
  | 'fantasyTrumpet';

export interface PlantPartConfig {
  pattern?: PlantLeafPatternId;
  accentColor?: string;
  tipColor?: string;
  emissiveColor?: string;
  emissiveIntensity?: number;
  /** Downward arch (+1) or upward cup (-1) along leaf/petal length */
  droop?: number;
  /** Midrib V-fold / bowl cupping (0..1) */
  cup?: number;
  /** Sinusoidal edge frill / undulation (0..1) */
  ruffle?: number;
  /** Organic helical twist (-1..1) */
  twist?: number;
  /** Asymmetrical left/right lobe skew (-1..1) */
  asymSkew?: number;
  /** Natural splits, notches & weathered tip curl (0..1) */
  tatter?: number;
  /** Procedural rib/vein relief amplitude (0..1) */
  veinDepth?: number;
  doubleSided?: boolean;
}

export type PlantClusterTarget = 'leaf' | 'petal' | 'fantasy';
export type PlantClusterLayout = 'fan' | 'randomCenter' | 'spiral';

export interface PlantClusterRecipe {
  target: PlantClusterTarget;
  shape: PlantShapeId;
  /** Grouping limit from 1 to 20 parts */
  count: number;
  layout: PlantClusterLayout;
  symmetrical: boolean;
  /** Organic random jitter (0..1) in angle, size, pitch, twist & hue */
  randomness: number;
  /** Fan tilt angle in degrees (10..85) outward from center axis */
  fanAngleDeg: number;
  /** Radial arc span in degrees (60..360) */
  arcSpanDeg: number;
  /** Radial offset distance from center hub */
  centerRadius: number;
  /** Vertical hub height above floor */
  hubHeight: number;
  /** Size multiplier min & max */
  minScale: number;
  maxScale: number;
  /** Multi-ring layered tiers (1..3) */
  tierLayers: number;
  includeFlowerCore?: boolean;
  coreColor?: string;
  baseDimensions: [number, number, number];
  basePlant: PlantPartConfig;
  baseColor: string;
  seed: number;
}

export type ObjectPrimitiveShapeId =
  | 'cube'
  | 'halfCube'
  | 'sphere'
  | 'hemisphere'
  | 'cylinder'
  | 'cone'
  | 'capsule'
  | 'torus'
  | 'wedge'
  | 'arch'
  | 'prism'
  | 'plank'
  | 'beamLarge'
  | 'beamSmall'
  | 'stairs'
  | 'pillar'
  | 'fence'
  | 'roofAFrame'
  | 'roofSlope'
  | 'splineTube'
  | 'lathe'
  | 'sdfBlob'
  | 'csgResult'
  | PlantShapeId;

export interface ObjectSurfaceFinish {
  materialId?: BuildingMaterialId;
  color: string;
  roughness: number;
  metalness: number;
  emissive?: string;
  emissiveIntensity?: number;
  weathering?: WeatheringPreset;
  weatheringIntensity?: number;
  proceduralSurface?: 'logBark' | 'logRings';
}

export interface ObjectGeometryModifiers {
  bevel: number;
  chamfer: number;
  roundness: number;
  edgeWear: number;
  segments?: number;
  taperStart?: number;
  taperEnd?: number;
  taperSmoothStart?: number;
  taperSmoothEnd?: number;
  bendAngle?: number;
  bendAxis?: 'x' | 'z';
  twistAngle?: number;
}

export type ObjectSplineProfile = 'round' | 'oval' | 'flatStave' | 'beveledBar';

export interface ObjectSplineConfig {
  points: [number, number, number][];
  pointRadii?: number[];
  profile: ObjectSplineProfile;
  radius: number;
  ovalness?: number;
  taperStart: number;
  taperEnd: number;
  taperSmoothStart: number;
  taperSmoothEnd: number;
  closed?: boolean;
  steps?: number;
  radialSegments?: number;
  mirrorSymmetry?: 'none' | 'y' | 'x';
}

export interface ObjectSdfNode {
  kind: 'capsule' | 'ellipsoid' | 'roundedBox';
  op?: 'add' | 'sub';
  a: [number, number, number];
  b: [number, number, number];
  startRadius?: number;
  midRadius?: number;
  endRadius?: number;
  curvature?: number;
  blendScale?: number;
  roundness?: number;
}

export interface ObjectSdfBlobConfig {
  primitives: ObjectSdfNode[];
  resolution?: number;
  blendK?: number;
}

export interface ObjectSerializedGeometry {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices?: number[];
}

export interface ObjectPartSpec {
  id: string;
  name: string;
  parentGroupId?: string | null;
  shape: ObjectPrimitiveShapeId;
  position: [number, number, number];
  rotation: [number, number, number];
  dimensions: [number, number, number];
  modifiers: ObjectGeometryModifiers;
  material: ObjectSurfaceFinish;
  splineConfig?: ObjectSplineConfig;
  latheProfile?: [number, number][];
  sdfBlobConfig?: ObjectSdfBlobConfig;
  plantParams?: PlantPartConfig;
  bakedGeometry?: ObjectSerializedGeometry;
  hidden?: boolean;
  isCutter?: boolean;
}

export interface ObjectGroupSpec {
  id: string;
  name: string;
  parentGroupId?: string | null;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  plantCluster?: PlantClusterRecipe;
}

export type CurveGuidePresetId = 'arc' | 'sCurve' | 'arch' | 'semiCircle' | 'circle' | 'free';

export interface CurveGuideConfig {
  preset: CurveGuidePresetId;
  points: [number, number, number][];
  closed: boolean;
  segments: number;
  radius: number;
  elevationArch: number;
  alignToTangent: boolean;
}

export interface ObjectMakerDoc {
  version: 1;
  parts: ObjectPartSpec[];
  groups: ObjectGroupSpec[];
  curveGuide?: CurveGuideConfig;
  vertexPaintStrokes?: VertexPaintStroke[];
  interactionAttributes?: ObjectInteractionAttributeId[];
  interactionCalibrations?: Partial<Record<ObjectInteractionAttributeId, ObjectInteractionCalibration>>;
  attachBodyPart?: ObjectAttachBodyPart;
  linkedInventoryItemId?: string;
}

export interface ExportedAssetBundle {
  meta: CustomAssetMeta;
  base64Glb: string;
}

export interface VoiceClipMeta {
  id: string;
  name: string;
  mimeType: string;
  byteSize: number;
  durationSec: number;
  createdAt: string;
}

export interface ExportedVoiceBundle {
  meta: VoiceClipMeta;
  mimeType: string;
  base64Audio: string;
}

export type SceneryTextureSlot =
  | 'treeCanopy'
  | 'treeBark'
  | 'fruit'
  | 'rocks'
  | 'grass'
  | 'bushes'
  | 'flowerPetals'
  | 'flowerStems'
  | 'pathRoad'
  | 'cave'
  | 'woodStructures';

export type CustomTextureResolution = 256 | 512 | 1024;

export interface CustomTextureAssetMeta {
  id: string;
  name: string;
  fileName: string;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  byteSize: number;
  thumbnailDataUrl: string;
  createdAt: string;
}

export type WeatheringPreset =
  | 'none'
  | 'moss'
  | 'snow'
  | 'wet'
  | 'cracked'
  | 'chipped'
  | 'scorched'
  | 'muddy'
  | 'bleached'
  | 'rusted';

export interface EntityMaterialVariant {
  enabled?: boolean;
  colorHex?: string;
  roughness?: number;
  diffuseRoughness?: number;
  weathering?: WeatheringPreset;
  weatheringIntensity?: number;
  wearFactor?: number;
}

export interface SurfaceTextureSettings {
  textureId?: string;
  enabled: boolean;
  /** Horizontal tile repeat / inverse size (0.15..8.0) */
  repeatX: number;
  /** Vertical tile repeat / inverse size (0.15..8.0) */
  repeatY: number;
  /** Lock X/Y tile scale together */
  lockScale?: boolean;
  /** Horizontal UV position offset (-1..1) */
  offsetX: number;
  /** Vertical UV position offset (-1..1) */
  offsetY: number;
  /** UV rotation in degrees (0..360) */
  rotationDeg: number;
  /** Mirror texture horizontally */
  flipX: boolean;
  /** Mirror texture vertically */
  flipY: boolean;
  /** Auto-derived Sobel normal/bump relief intensity (0..1) */
  bumpStrength: number;
  /** Perceptual hue shift in degrees (-180..180) */
  hueShift: number;
  /** Saturation adjustment (-1..1) */
  saturation: number;
  /** Value / brightness adjustment (-0.6..0.6) */
  value: number;
  /** Contrast multiplier (0.5..1.8) */
  contrast: number;
  /** Surface roughness (0.05..1.0) */
  roughness: number;
  /** Energy-preserving diffuse roughness (EON) for matte stone, dirt, and wood (0..1) */
  diffuseRoughness?: number;
  /** Zero-stutter NodeMaterialInstance weathering preset */
  weathering?: WeatheringPreset;
  /** Weathering blend strength (0..1) */
  weatheringIntensity?: number;
  /** Blend with biome/palette tint (0 = pure custom texture, 1 = full biome tint) */
  tintStrength?: number;
}

export interface ExportedTextureBundle {
  meta: CustomTextureAssetMeta;
  mimeType: string;
  base64Image: string;
}

export type VertexPaintMode = 'paint' | 'hueShift' | 'organicJitter' | 'degrade' | 'erase';
export type VertexPaintTarget = 'all' | 'leaves' | 'branches';

export interface VertexPaintStroke {
  id: string;
  /** Local-space 3D dab points [x, y, z] sampled along the brush stroke */
  points: [number, number, number][];
  /** Brush sphere radius in local object units (0.12..2.5) */
  radius: number;
  /** Brush opacity / strength per dab (0.05..1.0) */
  opacity: number;
  /** Brush edge softness / radial falloff (0.1..1.0) */
  softness: number;
  mode: VertexPaintMode;
  target: VertexPaintTarget;
  /** Base brush hex color */
  color: string;
  /** Color hue shift in degrees (-180..+180) */
  hueShift: number;
  /** Optional saturation shift (-0.8..+0.8) */
  saturationShift?: number;
  /** Optional brightness/value shift (-0.5..+0.5) */
  valueShift?: number;
  /** Organic per-vertex random hue scatter in degrees (0..90) */
  hueJitter?: number;
  /** Weathering / degradation form applied when mode === 'degrade' */
  degradeForm?: WeatheringPreset;
  /** Physical vertex dent / chip depth (0..1) when degrading stone/wood geometry */
  degradeChipDepth?: number;
  seed: number;
}

export type StageTab =
  | 'world'
  | 'cast'
  | 'motion'
  | 'logic'
  | 'interface';

export type MotionStudioSection = 'gait' | 'pose' | 'actions';
export type LogicWorkspaceMode = 'rules' | 'flow';

export type BiomeId =
  | 'meadow'
  | 'island'
  | 'forest'
  | 'snow'
  | 'desert'
  | 'cave'
  | 'swamp'
  | 'night';

export type SkyPresetId =
  | 'sunny'
  | 'golden'
  | 'night'
  | 'mist'
  | 'storm'
  | 'cave';

export type WeatherKind = 'none' | 'fireflies' | 'leaves' | 'rain' | 'snow';

export type VistaPresetId =
  | 'alpineValley'
  | 'coastalArchipelago'
  | 'mistyHills'
  | 'volcanicPeaks'
  | 'none';

export type VistaPropKind =
  | 'mountain'
  | 'pineCluster'
  | 'oakCluster'
  | 'birchCluster'
  | 'boulderRidge'
  | 'castleRuins'
  | 'custom';

export interface VistaPropItem {
  id: string;
  kind: VistaPropKind;
  name: string;
  angle: number; // degrees 0..360
  distance: number; // 195..380
  scale: number; // 0.6..3.0
  customAssetId?: string;
}

export type LevelStyle = 'openWorld' | 'roomChain';

export type CompleteCondition =
  | 'reachPortal'
  | 'collectAll'
  | 'defeatAll'
  | 'solvePuzzle'
  | 'collectKeys'
  | 'talkToNPC'
  | 'gatherBuddies'
  | 'completeCourse';

export type TemplateCategory = 'all' | 'worlds' | 'stories' | 'vehicles';

export type CritterAttitude = 'none' | 'teasing' | 'nervous' | 'grumpy';
export type CritterWarmTrigger = 'nearbyPower' | 'allBuddies' | 'flagSet';

export type MisfitAbilityId = 'skunkScent' | 'porcupineQuills' | 'moleSonar' | 'vultureSight';

export type PropPresetId =
  | 'tavern'
  | 'cottage'
  | 'dock'
  | 'signpost'
  | 'campfire'
  | 'craftingBench'
  | 'ramp'
  | 'checkpointArch'
  | 'savePlinth'
  | 'flightCube'
  | 'boostPad'
  | 'roadBarrier';

export type CarPresetId =
  | 'trailBuggy'
  | 'rallyCoupe'
  | 'forestTruck'
  | 'vintageRoadster'
  | 'flintstones'
  | 'f1Racer'
  | 'sportCoupe'
  | 'motorbike';

export type DrivingPhysicsId =
  | 'arcadeDrift'
  | 'grippyRally'
  | 'offroadCrawler'
  | 'turboSport';

export type DriverTypeId = 'ranger' | 'stunt' | 'skunk' | 'bot';

export type DrivingCameraView = 'driverPov' | 'closeChase' | 'farChase';

export type GameplayMode = 'adventure' | 'buddies' | 'driving' | 'roguelike' | 'rpg';

export type RpgScenarioId =
  | 'medievalVillage'
  | 'jungleRuins'
  | 'deepWoodedForest'
  | 'stoneTemple'
  | 'coastalVillage'
  | 'interiorCottage'
  | 'interiorTavern'
  | 'interiorCave';

export type RpgLootMode = 'both' | 'traditional' | 'fannedCards';

export type RpgPathStyle =
  | 'weatheredStone'
  | 'ropeBridgeSlats'
  | 'mossyCobble'
  | 'woodPlankWalkway';

export interface RpgLevelConfig {
  scenario: RpgScenarioId;
  lootMode: RpgLootMode;
  pathStyle: RpgPathStyle;
  isInterior?: boolean;
  volumetricLanterns?: boolean;
  cameraZoom?: number;
}

export type BuildingShapeId =
  | 'wallCube'
  | 'wallCubeHalf'
  | 'halfWall'
  | 'pillar'
  | 'floorTile'
  | 'stairsStraight'
  | 'stairsSpiral'
  | 'archway'
  | 'windowWall'
  | 'trapdoor'
  | 'wallTorch'
  | 'roofAFrame'
  | 'roofSlope'
  | 'roofGable'
  | 'fence'
  | 'porchSteps'
  | 'beamLarge'
  | 'beamSmall'
  | 'plankTrim';

export type BuildingMaterialId =
  | 'hewnStone'
  | 'sandstone'
  | 'randomCobble'
  | 'squareFlagstone'
  | 'crackedSlate'
  | 'masonryBrick'
  | 'wattlePlaster'
  | 'packedDirt'
  | 'timberPlank'
  | 'roundLogs'
  | 'weatheredSlats'
  | 'thatchedStraw'
  | 'clayTile'
  | 'woodShingle'
  | 'rustedIron';

export type RoofStyleId = 'thatched' | 'tiled' | 'shingled' | 'woodSlats';
export type BeamOrientation = 'horizontal' | 'vertical' | 'diag45' | 'diagNeg45';
export type FenceStyleId = 'picket' | 'rail' | 'medieval';

export interface BuildingBlockConfig {
  shape: BuildingShapeId;
  material: BuildingMaterialId;
  archStyle?: 'arched' | 'rectangular';
  windowStyle?: 'open' | 'barred' | 'shuttered' | 'paned';
  roofStyle?: RoofStyleId;
  roofMedievalTruss?: boolean;
  beamOrientation?: BeamOrientation;
  fenceStyle?: FenceStyleId;
  scaleX?: number;
  scaleY?: number;
  scaleZ?: number;
  /** Organic edge bevel, chamfer & stone-joint erosion intensity (0..1) */
  edgeWear?: number;
  requiresKey?: boolean;
}

export type DoorFrameShape = 'rectangular' | 'arched';
export type DoorLeafStyle = 'woodPlank' | 'rusticWood' | 'solidMetal' | 'ironBars' | 'jailCage';
export type DoorOpenMode = 'hingedSide' | 'doubleSplit' | 'sliding';
export type DoorSlotStyle = 'none' | 'peepSlot' | 'barredWindow';

export interface DoorConfig {
  frameShape: DoorFrameShape;
  leafStyle: DoorLeafStyle;
  openMode: DoorOpenMode;
  slotStyle: DoorSlotStyle;
  frameMaterial?: BuildingMaterialId;
  requiresKey?: boolean;
}

export interface WallColliderBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
  kind?: 'stoneWall' | 'caveRock' | 'castleWall' | 'pillar' | 'bulkhead';
}

export interface RoguelikeTorchAnchor {
  x: number;
  y: number;
  z: number;
  nx: number;
  nz: number;
  light: boolean;
}

export type RoguelikeScenarioKind =
  | 'ancientCrypt'
  | 'cyberpunkLab'
  | 'overgrownJungle'
  | 'volcanicAbyss'
  | 'frostCitadel'
  | 'sunkenTemple'
  | 'desertPyramid'
  | 'astralVoid';

export type DungeonWallStyle =
  | 'dampMasonry'
  | 'obsidianBasalt'
  | 'mossyRuins'
  | 'gildedCrypt'
  | 'crimsonCatacombs'
  | 'cyberPanels'
  | 'overgrownStone'
  | 'glacialIce'
  | 'sunkenCoral'
  | 'sandstoneHieroglyphs'
  | 'astralVoid';

export type DungeonFloorStyle =
  | 'flagstone'
  | 'checkerMarble'
  | 'crackedSlate'
  | 'emberBasalt'
  | 'mossyCobble'
  | 'cyberGrid'
  | 'jungleEarth'
  | 'frozenPermafrost'
  | 'abyssalSand'
  | 'desertSandstone'
  | 'cosmicTiles';

export type DungeonPropStyle =
  | 'cryptBarrels'
  | 'arcaneBraziers'
  | 'boneRelics'
  | 'gildedUrns'
  | 'cyberTerminals'
  | 'jungleMonoliths'
  | 'glacialCrystals'
  | 'coralRelics'
  | 'desertSarcophagi'
  | 'astralPylons';

export type DungeonTrapStyle =
  | 'ironSpikes'
  | 'emberPlates'
  | 'cursedRunes'
  | 'sawBlades'
  | 'laserTripwires'
  | 'poisonDartPillars'
  | 'fireGeysers'
  | 'frostSpikes'
  | 'acidPuddles'
  | 'whirlpoolVortex';

export interface DungeonStyleConfig {
  scenarioKind?: RoguelikeScenarioKind;
  wallStyle: DungeonWallStyle;
  floorStyle: DungeonFloorStyle;
  propStyle: DungeonPropStyle;
  trapStyle: DungeonTrapStyle;
  wallTint?: string;
  floorTint?: string;
  propTint?: string;
  trapTint?: string;
}

export type DungeonRoomRole = 'entrance' | 'combat' | 'treasure' | 'boss';

export interface DungeonRoomSpec {
  id: string;
  role: DungeonRoomRole;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  centerX: number;
  centerZ: number;
  gx: number;
  gz: number;
  gw: number;
  gd: number;
}

export interface RoguelikeConfig {
  scenarioKind?: RoguelikeScenarioKind;
  bossInterval: number;
  difficultyScale: number;
  relicChoicesPerFloor: number;
  trapDensity: number;
  startingMaxHealth: number;
  seedMode: 'random' | 'fixed';
  fixedSeed?: number;
  dungeonStyle?: DungeonStyleConfig;
}

export type RoguelikeRelicCategory = 'offense' | 'defense' | 'mobility' | 'arcane';
export type RoguelikeRelicRarity = 'common' | 'rare' | 'mythic';

export interface RoguelikeRelicDef {
  id: string;
  name: string;
  category: RoguelikeRelicCategory;
  rarity: RoguelikeRelicRarity;
  symbol: string;
  colorHex: string;
  shortEffect: string;
  description: string;
  maxStacks?: number;
  modifiers: {
    attackBonus?: number;
    maxHealthBonus?: number;
    healNow?: number;
    defenseBonus?: number;
    speedBonus?: number;
    lifestealOnKill?: number;
    thornsDamage?: number;
    coinBonusOnKill?: number;
    staminaRegenMult?: number;
    magicBoltBonus?: number;
    portalHeal?: number;
  };
}

export type VehicleWheelStyle =
  | 'standard'
  | 'thickMag'
  | 'offroadKnobby'
  | 'stoneRoller'
  | 'slick';

export type VehicleRoofStyle =
  | 'standard'
  | 'openTop'
  | 'sunroof'
  | 'rollCage';

export type VehicleWingStyle =
  | 'none'
  | 'gliderWings'
  | 'aeroFins'
  | 'jetWing';

export interface VehicleCustomSpec {
  bodyColor?: string;
  accentColor?: string;
  rimColor?: string;
  wheelStyle?: VehicleWheelStyle;
  wheelScale?: number;
  roofStyle?: VehicleRoofStyle;
  wingStyle?: VehicleWingStyle;
  hasSpoiler?: boolean;
  hasBullbar?: boolean;
  hasTwinExhaust?: boolean;
}

export interface DrivingConfig {
  carId: CarPresetId;
  physicsId: DrivingPhysicsId;
  driverId: DriverTypeId;
  cameraView?: DrivingCameraView;
  customVehicle?: VehicleCustomSpec;
}

export type EntitySection =
  | 'cast'
  | 'things'
  | 'hazards'
  | 'puzzles'
  | 'scenery'
  | 'markers';

export type EntityKind =
  | 'hero'
  | 'npc'
  | 'baddie'
  | 'treasure'
  | 'key'
  | 'door'
  | 'pickup'
  | 'trap'
  | 'spawner'
  | 'puzzle'
  | 'prop'
  | 'scenery'
  | 'platform'
  | 'sign'
  | 'light'
  | 'fxEmitter'
  | 'portal'
  | 'checkpoint';

export type FxEmitterCategory =
  | 'classic'
  | 'customMesh'
  | 'burstArc'
  | 'weather'
  | 'critter';

export type FxEmitterPresetId =
  | 'smoke'
  | 'fire'
  | 'sparks'
  | 'magic'
  | 'dust'
  | 'fallingLeaves'
  | 'waterSplash'
  | 'lightning'
  | 'rain'
  | 'snow'
  | 'fog'
  | 'bees'
  | 'flies'
  | 'butterflies'
  | 'moths'
  | 'fireflies'
  | 'birds';

export type BirdFlightPattern = 'wander' | 'vFormation' | 'flock' | 'circle';
export type BirdFlightMode = 'random' | 'directional';

export interface FxEmitterConfig {
  enabled: boolean;
  preset: FxEmitterPresetId;
  /** Vertical offset above terrain in world units */
  elevationY: number;
  /** Hard per-emitter pool cap for performance */
  maxParticles: number;

  // Classic & shared ballistic controls
  spawnRate: number;
  lifetime: number;
  startSize: number;
  endSize: number;
  startColor: string;
  endColor: string;
  emissiveIntensity: number;
  speed: number;
  spreadAngle: number; // degrees 0..180
  gravity: number; // negative = pulls down, positive = buoyancy up
  turbulence: number;
  fadeIn: number; // 0..0.5 normalized life fraction
  fadeOut: number; // 0..0.8 normalized life fraction

  // Custom-object particle controls (Falling Leaves)
  customMeshAssetId?: string;
  fallSpeed: number;
  windDrift: number;
  swayAmplitude: number;
  swayFrequency: number;
  tumbleSpeed: number;
  scaleVariation: number;

  // Burst & Splash controls
  burstCount: number;
  burstInterval: number; // 0 = manual trigger only, >0 = repeating seconds
  splashSize: number;

  // Lightning arc controls
  boltLength: number;
  targetOffset: [number, number, number];
  branchAmount: number; // 0..1
  jitterAmount: number;
  boltThickness: number;
  flickerRate: number; // flashes per second

  // Weather / Atmosphere controls
  density: number;
  windAngle: number; // degrees 0..360
  areaRadius: number;
  areaHeight: number;

  // Living / Critter swarm & bird controls
  critterCount: number;
  roamRadius: number;
  moveSpeed: number;
  erraticness: number;
  flutterSpeed: number;
  /** Wing flap sweep angle in degrees (0..85) */
  wingFlapAmplitude?: number;
  critterSize: number;
  glowEnabled: boolean;
  /** Bird flock pattern */
  flightPattern?: BirdFlightPattern;
  /** Bird random local roam vs directional fly-by */
  flightMode?: BirdFlightMode;
  /** Directional flight heading in degrees (0..360) */
  flightHeading?: number;
  /** Whether birds occasionally descend and land on the ground */
  landingEnabled?: boolean;
  /** Probability/frequency of landing (0..1) */
  landingFrequency?: number;
}

export type CanopyCrownSilhouette = 'dome' | 'umbrella' | 'cypress' | 'tiered' | 'windswept';
export type CanopyTargetTrees = 'matching' | 'broadleaf' | 'oak' | 'all' | 'placedOnly';
export type TreeSpeciesType = 'oak' | 'conifer' | 'birch' | 'fantasy' | 'custom';
export type TreeBarkStyle =
  | 'oak'
  | 'pine'
  | 'birch'
  | 'rough'
  | 'painterly'
  | 'textural'
  | 'cartoony'
  | 'knotty'
  | 'fantasy';
export type ConiferShapeStyle = 'classic' | 'spire' | 'snowDroop' | 'flatBough' | 'weeping';
export type FeatureFrequency = 'none' | 'some' | 'lots' | 'all';
export type FruitDistributionMode = 'outerCrown' | 'underCanopy' | 'hanging';
export type FoliageTextureStyle =
  | 'cleanBase'
  | 'painted'
  | 'clustered'
  | 'softBrush'
  | 'crispStylized';
export type CanopyBasePattern = 'smooth' | 'grain' | 'noise' | 'dappled';
export type CanopyBaseGradientScope = 'whole' | 'perPuff' | 'both';
export type CanopyLeafShape = 'basic' | 'oak' | 'maple' | 'triple';
export type LeafSeasonPresetId =
  | 'custom'
  | 'spring'
  | 'summer'
  | 'earlyFall'
  | 'peakAutumn'
  | 'winter'
  | 'blossom'
  | 'mystic';

export type TreeGeneratorMode = 'stylized' | 'ezTree';
export type EzTreeLeafStyle = 'oak' | 'ash' | 'aspen' | 'pine';
export type EzTreeBillboardMode = 'single' | 'double';
export type EzTreeFoliageMode = 'leafCards' | 'canopyPuffs' | 'both';
export type EzTreeGrowthType = 'deciduous' | 'evergreen';

export interface EzTreeParams {
  growthType: EzTreeGrowthType;
  /** Branch recursion depth beyond trunk (1..3 -> up to 4 generations total) */
  levels: number;
  /** Child branches spawned at parent levels [trunk->1, lvl1->2, lvl2->3] */
  children: [number, number, number];
  /** Split angle in degrees from parent tangent per level */
  angle: [number, number, number];
  /** Where along parent branch child limbs begin spawning (0..0.9) */
  start: [number, number, number];
  /** Organic directional gnarl/wobble per level [trunk, l1, l2, l3] */
  gnarliness: [number, number, number, number];
  /** Segment chain length in meters (pre-scale) per level [trunk, l1, l2, l3] */
  length: [number, number, number, number];
  /** Radius ratio / trunk base radius per level [trunk, l1, l2, l3] */
  radius: [number, number, number, number];
  /** End taper (0.1..0.98) per level [trunk, l1, l2, l3] */
  taper: [number, number, number, number];
  /** Spiral helical twist (-0.6..0.6) per level [trunk, l1, l2, l3] */
  twist: [number, number, number, number];
  /** Growth tropism direction [x, y, z] */
  forceDirection: [number, number, number];
  /** Growth pull strength (-0.16..0.16): negative droops (weeping), positive reaches skyward */
  forceStrength: number;
  /** Active preset id for UI highlighting */
  presetId?: string;
  /** Foliage rendering mode on top of EZ-Tree branch skeleton */
  foliageMode: EzTreeFoliageMode;
  leavesEnabled: boolean;
  leafStyle: EzTreeLeafStyle;
  billboard: EzTreeBillboardMode;
  /** Number of leaf cards distributed along each terminal branch */
  leafCount: number;
  /** Leaf card world size (0.3..2.6m) */
  leafSize: number;
  /** Maximum leaf tilt spread in degrees (10..85) */
  leafAngle: number;
  /** Starting fraction along terminal branch where leaves sprout (0..0.85) */
  leafStart: number;
  /** Alpha cutout threshold (0.15..0.72) */
  leafAlphaTest: number;
  /** Base leaf tint hex */
  leafTint: string;
}

export interface StylizedCanopyConfig {
  enabled: boolean;
  targetTrees: CanopyTargetTrees;
  /** Active tree species profile edited in Tree Studio */
  treeType?: TreeSpeciesType;
  /** Procedural geometry architecture: classic Stylized Canopy or EZ-Tree recursive branching */
  treeGeneratorMode?: TreeGeneratorMode;
  /** Full recursive EZ-Tree branch & leaf-cluster parameters when treeGeneratorMode === 'ezTree' */
  ezTree?: EzTreeParams;
  /** User-renameable label when treeType === 'custom' */
  customTypeName?: string;
  /** Optional per-species saved profiles so Oak, Conifer, Birch, Fantasy & Custom persist independently */
  speciesProfiles?: Partial<Record<TreeSpeciesType, Omit<StylizedCanopyConfig, 'speciesProfiles'>>>;

  /** Imported stylized sphere treetop GLB asset ID (optional; uses sculpted puff fallback) */
  canopyAssetId?: string;
  /** Optional custom trunk GLB asset ID (uses procedural organic trunk when omitted) */
  trunkAssetId?: string;
  /** Master deterministic seed for unique per-tree variation */
  seed: number;

  // --- TREE BASE MAKER: Bark, Trunk & Branches ---
  barkStyle?: TreeBarkStyle;
  barkColor: string;
  /** Uneven vertical bark highlight lines just lighter than barkColor (0..1) */
  barkLineIntensity?: number;
  /** Density of vertical bark lines (0.4..2.0) */
  barkLineDensity?: number;
  /** Bark bump/normal depth from bark texture (0..1) */
  barkBumpStrength?: number;

  trunkHeight: number;
  trunkThickness: number;
  /** Top-to-bottom taper ratio (0.15..0.85) */
  trunkTaper?: number;
  trunkLean: number;
  /** Per-tree organic variety in height, girth, twist, and bend (0..1) */
  trunkVariety?: number;

  /** Separate Major Canopy-Mount Branches */
  majorBranchCount?: number; // 0..7
  majorBranchLength?: number; // 0.4..2.8
  majorBranchThickness?: number; // 0.3..1.8
  /** Taper from base to tip (0 = thick blunt limbs, 1 = tapers to a fine point) */
  majorBranchTaper?: number; // 0..1
  majorBranchSpread?: number; // 0.2..1.4 (outward angle)
  majorBranchUpward?: number; // -0.3..1.0 (upward lift for obvious treetop cradle)
  /** Bidirectional droop: -1 = curves upward, 0 = neutral center, +1 = droops downward */
  majorBranchDroop?: number; // -1..1

  /** Gnarl & Knots (Oak, Fantasy, Custom) */
  gnarlAmount?: number; // 0..1

  /** Owl Hollow Hole (Oak, Fantasy, Custom) */
  hollowMode?: FeatureFrequency;
  hollowHeight?: number; // 0.25..0.8 fraction of trunk height
  hollowSize?: number; // 0.4..1.6

  /** Curved Ground-Entering Roots (Oak, Fantasy, Custom) */
  rootMode?: FeatureFrequency;
  rootCount?: number; // 2..9
  /** How high the root collar starts on the trunk (-0.45..1.1m; negative/low lets roots sit partially underground) */
  rootBaseHeight?: number;
  /** How far roots grow away from the trunk before curving down into the ground (0.5..3.2m) */
  rootReach?: number;
  rootArchHeight?: number; // 0.0..1.1
  rootThickness?: number; // 0.4..1.8
  rootRandomness?: number; // 0..1

  // --- CANOPY: Oak / Fantasy / Custom Clustering ---
  minPuffs: number;
  maxPuffs: number;
  silhouette: CanopyCrownSilhouette;
  clusterSpread: number;
  overlapTightness: number;
  verticalSpread: number;
  /** Preference to distribute smaller canopies onto prominent main branches (0 = central mass, 1 = branch crowns) */
  canopyBranchAttach?: number;
  /** Relative size of main-branch canopies compared to the primary central crown (0.4..0.95) */
  branchCanopyScale?: number;

  // Height & reshaping
  canopyHeight: number;
  heightVariation: number;
  basePuffSize: number;
  sizeVariation: number;
  squishY: number;
  ovalnessXZ: number;
  squishVariation: number;
  tiltAmount: number; // degrees 0..45

  /** Oak & Custom foliage texture style & texture-guided bump/normal intensity */
  foliageTextureStyle?: FoliageTextureStyle;
  foliageBaseColor?: string;
  /** Uses the foliage texture itself as a bump/normal guide (0..1) */
  foliageBumpStrength?: number;

  /** Leaf-free Canopy Base procedural grain/noise & top-to-bottom vertical gradient */
  canopyBasePattern?: CanopyBasePattern;
  canopyBaseGrainStrength?: number; // 0..1
  canopyBaseGrainScale?: number; // 0.4..3.0
  canopyBaseTopColor?: string;
  canopyBaseBottomColor?: string;
  canopyBaseGradientStrength?: number; // 0..1
  canopyBaseGradientScope?: CanopyBaseGradientScope;

  /** 3D Contour-Following Canopy Leaves (added separately over the canopy base, like fruit) */
  canopyLeavesEnabled?: boolean;
  canopyLeafShape?: CanopyLeafShape;
  canopyLeafSeason?: LeafSeasonPresetId;
  canopyLeafColor?: string;
  canopyLeafCount?: number; // 20..650
  canopyLeafSize?: number; // 0.14..0.75m
  /** 0 = perfectly uniform size, 1 = wide organic randomness */
  canopyLeafSizeRandomness?: number; // 0..1
  /** Per-leaf hue spread in degrees (0..90) */
  canopyLeafHueSpread?: number; // 0..90
  /** Per-leaf brightness / lightness scatter (0..0.45) */
  canopyLeafValueSpread?: number; // 0..0.45
  /** Outward 3D lift outside the canopy base contour (0..0.42m) */
  canopyLeafSurfaceOffset?: number; // 0..0.42
  /** 0 = smoothly hugs canopy contour, 1 = fluttery outward 3D tilt */
  canopyLeafTiltRandomness?: number; // 0..1
  /** Leaf flutter response to scene wind & weather (0..2.2) */
  canopyLeafWindFlutter?: number; // 0..2.2

  // --- CANOPY: Conifer / Pine Layered Wind-Swaying Boughs ---
  coniferTiers?: number; // 3..11
  /** Amount of sculpted painted frond-leaves around the circumference of each tier (3..16) */
  coniferLeavesPerTier?: number;
  coniferShape?: ConiferShapeStyle;
  /** Spreads tiers further apart upward so wood trunk shows between layers (0..1) */
  coniferScarcity?: number;
  /** Leaf spread / droop angle (-1.0 nearly vertical upward .. 0 horizontal .. +1.0 steep downward droop) */
  coniferDroop?: number;
  coniferWidth?: number; // 0.6..2.4
  /** Per-tier vertical gradient from top to bottom of each individual layer */
  coniferTopColor?: string;
  coniferBottomColor?: string;
  coniferGradientStrength?: number; // 0..1
  /** Whole-tree vertical gradient across all tiers from crown top to lowest tier bottom */
  coniferWholeTopColor?: string;
  coniferWholeBottomColor?: string;
  coniferWholeGradientStrength?: number; // 0..1

  // --- CANOPY: Birch Fine Tapered Branches & Clustered Leaf Sprigs ---
  birchTwigDensity?: number; // 0.3..2.0
  birchLeafDensity?: number; // 0.3..2.0
  birchLeafSize?: number; // 0.5..2.0
  birchBranchDroop?: number; // 0..1.0
  birchLeafColor?: string;

  // --- FRUIT (Oak, Fantasy & Custom) ---
  fruitEnabled?: boolean;
  /** Optional uploaded .GLB model for fruit; defaults to stylized 3D spheres */
  fruitAssetId?: string;
  fruitCount?: number; // 0..32
  fruitSize?: number; // 0.08..0.48
  fruitColor?: string;
  fruitDistribution?: FruitDistributionMode;
  fruitGlow?: number; // 0..1.5 (great for Fantasy lantern fruit!)

  // --- COLOR: Hue, Saturation & Value ---
  hueShift: number; // degrees -180..180
  hueVariation: number; // degrees 0..90
  saturationShift: number; // -0.8..0.8
  valueShift: number; // -0.5..0.5
  valueVariation: number; // 0..0.35
  sunCrownGradient: number; // 0..0.6

  // Atmosphere
  windSway: number; // 0..2

  // Optional Custom Seamless Texture Overrides (directly editable in Tree Studio or Texture Studio)
  barkTexture?: SurfaceTextureSettings;
  canopyTexture?: SurfaceTextureSettings;
  fruitTexture?: SurfaceTextureSettings;
  /** Hand-painted 3D vertex color & hue-shift strokes applied onto tree leaves and branches */
  vertexPaintStrokes?: VertexPaintStroke[];
}

export interface BoardPoint {
  x: number; // 0..1 normalized
  y: number; // 0..1 normalized
}

export interface CardClause {
  id: string;
  key: string;
  detail: string;
}

export interface BehaviorCard {
  id: string;
  when: CardClause;
  conditions: CardClause[];
  actions: CardClause[];
  isOnce: boolean;
  isEnabled: boolean;
}

export interface QuestStep {
  id: string;
  text: string;
  trigger: 'talkedTo' | 'foundKey' | 'openedTreasure' | 'beatBaddie' | 'touchedCheckpoint';
}

export interface Quest {
  title: string;
  steps: QuestStep[];
  rewardCoins: number;
  rewardKey: boolean;
}

export interface ConversationLine {
  id: string;
  isHero: boolean;
  words: string;
  replies: string[];
}

export type PlatformPreset =
  | 'stoneLift'
  | 'swingingBridge'
  | 'spinningDisc'
  | 'jungleVine'
  | 'bouncePad'
  | 'crumbleStone'
  | 'sawWheel';
export type PlatformMotionType = 'slide' | 'spin' | 'vertical' | 'pendulum';

export interface LevelEntity {
  id: string;
  kind: EntityKind;
  name: string;
  position: BoardPoint;
  rotation: number; // degrees
  scale: number;
  // Custom Tripo 3D / GLB model binding & interactive object mechanics
  customAssetId?: string;
  modelScaleAdjust?: number;
  modelOffsetY?: number;
  customAnimSpeed?: number;
  mechTemplate?: BuiltinMechanismTemplate;
  mechanisms?: ObjectMechanism[];
  interactionAttributes?: ObjectInteractionAttributeId[];
  interactionCalibrations?: Partial<Record<ObjectInteractionAttributeId, ObjectInteractionCalibration>>;
  // Particle & FX Emitter configuration
  fxEmitter?: FxEmitterConfig;
  // Stylized procedural / GLB treetop canopy tree configuration
  canopyTree?: StylizedCanopyConfig;
  // Hand-painted 3D vertex color & hue-shift strokes for non-tree objects/props
  vertexPaintStrokes?: VertexPaintStroke[];
  // Cast
  isBoss: boolean;
  brain: string;
  health: number;
  speed: number;
  damage: number;
  // Things / Puzzle / Pickupable Inventory Assignment
  loot: string;
  pickupable?: boolean;
  pickupItemId?: string;
  pickupQty?: number;
  puzzleType: string;
  dialogue: string;
  texture?: string;
  // Platforms
  platformPreset: PlatformPreset;
  platformMotion: PlatformMotionType;
  platformSpeed: number;
  platformWait: number;
  platformEnd?: BoardPoint;
  platformRunning: boolean;
  // Quests & Dialogue
  quest?: Quest;
  conversation: ConversationLine[];
  chatBubble?: ChatBubbleStyle;
  voiceConfig?: DialogueVoiceConfig;
  notes: string;
  cards: BehaviorCard[];
  // Prototype template specialization
  creatureType?: CreatureBodyId;
  propPreset?: PropPresetId;
  propStyle?: DungeonPropStyle;
  trapStyle?: DungeonTrapStyle;
  styleTint?: string;
  isBuddy?: boolean;
  buddyAreaLabel?: string;
  misfitAbility?: MisfitAbilityId;
  critterAttitude?: CritterAttitude;
  critterWarmOn?: CritterWarmTrigger;
  critterWarmFlag?: string;
  critterWarmLines?: string;
  puzzleRequires?: MisfitAbilityId;
  puzzleRewardText?: string;
  puzzleFlag?: string;
  checkpointOrder?: number;
  // Modular Dungeon & Masonry Building Kit
  elevationY?: number;
  buildingBlock?: BuildingBlockConfig;
  doorConfig?: DoorConfig;
  // Quadruped / Multi-Legged Animal & Fantastical Monster Blueprint
  monsterConfig?: MonsterBlueprint;
  // Extensible Baddie / Boss Combat AI, Territory, Flight & Action Library Config
  baddieAI?: BaddieAIConfig;
  // Per-entity custom motion overrides & saved variations
  motionSlotOverrides?: Partial<Record<CustomClipSlot, string>>;
  motionCustomAnimations?: CustomMotionPreset[];
  // WebGPU r187 pipeline & zero-stutter material variant overrides
  meshletEnabled?: boolean;
  materialVariant?: EntityMaterialVariant;
}

export interface LevelObjective {
  id: string;
  text: string;
  isOptional: boolean;
}

export type CameraCutawayTransition = 'whipPan' | 'glide' | 'snapCut';

export interface StoryCameraShot {
  id: string;
  name: string;
  targetMode: 'entity' | 'point';
  targetEntityId?: string;
  point?: BoardPoint;
  yaw: number; // degrees (-180..180)
  pitch: number; // degrees (5..70)
  distance: number; // meters (3..28)
  heightOffset: number; // meters (0..6)
  fov?: number; // 32..68
}

export type SkitBeatSpeakerKind = 'entity' | 'hero' | 'narrator';

export type SkitBeatEmote =
  | 'none'
  | 'wave'
  | 'dance'
  | 'cheer'
  | 'laugh'
  | 'shock'
  | 'angry'
  | 'shy';

export interface SkitBeat {
  id: string;
  speakerKind: SkitBeatSpeakerKind;
  speakerEntityId?: string;
  speakerNameOverride?: string;
  text: string;
  voiceConfig?: DialogueVoiceConfig;
  cameraShotId?: string; // undefined = auto-frame speaker
  transition?: CameraCutawayTransition;
  emote?: SkitBeatEmote;
  lookAtKind?: 'camera' | 'hero' | 'entity';
  lookAtEntityId?: string;
  moveToPoint?: BoardPoint;
  durationSec: number;
  waitForVoice: boolean;
}

export type StorySkitTriggerKind =
  | 'manual'
  | 'levelStart'
  | 'nearEntity'
  | 'talkToEntity'
  | 'flagSet'
  | 'buddyCount';

export interface StorySkit {
  id: string;
  name: string;
  caption?: string;
  triggerKind: StorySkitTriggerKind;
  triggerEntityId?: string;
  triggerRadius?: number;
  triggerFlag?: string;
  triggerBuddyCount?: number;
  playOnce: boolean;
  pauseHeroMovement: boolean;
  showLetterbox: boolean;
  returnTransition: CameraCutawayTransition;
  setFlagOnComplete?: string;
  beats: SkitBeat[];
}

export type WorldDomainId =
  | 'select'
  | 'mountains'
  | 'water'
  | 'caves'
  | 'grass'
  | 'dirtRoads'
  | 'flora'
  | 'buildings';

export type WorldViewMode = '3d' | '2d';

export type WorldEditorScope = 'worldMap' | string;

export interface WorldLandRegion {
  id: string;
  /** Numeric grid code stored in WorldMapData.regionGrid (1..255) */
  code: number;
  name: string;
  colorHex: string;
  /** Linked GameLevel ID inside GameProject.levels */
  levelId: string;
  /** World-space [originX, originZ] center of this Land's local map inside the 4x World Map */
  origin?: [number, number];
}

export interface WorldMapData {
  gridSize: number;
  /** Half-extent world radius in meters (640m = 1280m x 1280m, 4x rounded-up Land radius) */
  worldRadius?: number;
  /** 0 = ocean, 1 = painted landmass (unassigned yellow terrain or assigned land) */
  landMask: number[];
  /** 0 = unassigned yellow terrain, >0 = WorldLandRegion.code */
  regionGrid: number[];
  regions: WorldLandRegion[];
  revision: number;
}

export type TerrainBrush =
  | 'terrain'
  | 'raiseGround'
  | 'lowerGround'
  | 'smoothGround'
  | 'flattenGround'
  | 'plateauCliff'
  | 'carveRiver'
  | 'carveCave'
  | 'paintGrass'
  | 'paintGrassErase'
  | 'paintMoss'
  | 'paintCobble'
  | 'paintDirt'
  | 'paintRoad'
  | 'paintWaterLake'
  | 'paintSand'
  | 'paintRock'
  | 'paintSnow'
  | 'weatherMoss'
  | 'weatherCracks'
  | 'weatherErode'
  | 'weatherScorch'
  | 'weatherMud'
  | 'weatherFrost'
  | 'weatherClear'
  | 'scatterTree'
  | 'scatterRock'
  | 'scatterFlower'
  | 'scatterCustom';

export type TerrainBrushFalloff = 'smooth' | 'dome' | 'peak' | 'plateau';

export interface TerrainBrushOptions {
  strength?: number; // 0.1..1.5 (default 0.65)
  falloff?: TerrainBrushFalloff;
  flattenHeight?: number | null;
}

export interface ScatterItem {
  id: string;
  kind:
    | 'tree'
    | 'pine'
    | 'oak'
    | 'birch'
    | 'rock'
    | 'flower'
    | 'bush'
    | 'berryBush'
    | 'fern'
    | 'broadleaf'
    | 'mushroom'
    | 'reed'
    | 'cattail'
    | 'tallGrass'
    | 'custom';
  customAssetId?: string;
  x: number;
  z: number;
  size: number;
  rotation: number;
}

export type MountainNoiseType = 'fbm' | 'ridged' | 'billow' | 'terraced';

export interface MountainProfileConfig {
  rockStartHeight: number; // e.g. 5.5
  snowStartHeight: number; // e.g. 10.5
  bandTransition: number; // 0.05..1.0 sharpness vs gradual
  roughness: number; // 0.1..1.0
  noiseType: MountainNoiseType;
  noiseScale: number; // 0.3..3.0
  randomness: number; // 0..1
  autoSlopeWeathering: number; // 0..1
}

export type WaterBodyKind = 'lake' | 'river' | 'stream' | 'pond';

export interface WaterBodyConfig {
  id: string;
  name: string;
  kind: WaterBodyKind;
  center: [number, number];
  points?: [number, number][];
  radiusX: number;
  radiusZ: number;
  width: number;
  waterLevelOffset: number; // -1..1 relative to IslandTerrain.waterLevel
  waterColor: string;
  deepMurkColor: string;
  opacity: number; // 0.2..1.0
  depth: number; // 0.3..5.0m
  foamAmount: number; // 0..1.5
  waveSpeed: number; // 0..2.5
  windRipple: number; // 0..2.0
  flowSpeed: number; // 0..3.0
  flowAngleDeg: number; // 0..360
  bankSlope: number; // 0.15 steep .. 1.0 gradual
  bankSmoothness: number; // 0..1
  shoreNoise: number; // 0..1
}

export interface CaveGrotto {
  id: string;
  name?: string;
  x: number;
  z: number;
  rotation: number;
  scale: number;
  entranceWidth?: number; // 0.5..2.4
  entranceHeight?: number; // 0.5..2.4
  archSharpness?: number; // 0.1..1.0
  cavityDepth?: number; // 0.5..2.5
  cavityWidth?: number; // 0.5..2.5
  stalactiteDensity?: number; // 0..1.5
  stalagmiteDensity?: number; // 0..1.5
  crystalDensity?: number; // 0..1.5
  crystalColor?: string;
  hasSpring?: boolean;
  springFlow?: number; // 0.1..2.0
}

export type DirtNoiseKind = 'fineLoam' | 'crackedEarth' | 'rockyGritty' | 'patchy';
export type RoadBorderScatterKind = 'none' | 'wildflowers' | 'grass' | 'boulders' | 'mixed' | 'custom';

export interface RoadSpline {
  id: string;
  name: string;
  points: [number, number][];
  width: number; // 1.2..6.5
  recessDepth: number; // 0..1.0
  bankSlopeAngle: number; // 0.1..1.0
  edgeTransition: number; // 0.1..1.0
  borderScatter: RoadBorderScatterKind;
  borderDensity: number; // 0..1.5
  borderRandomness: number; // 0..1.0
  borderCustomAssetId?: string;
}

export interface DirtAndRoadConfig {
  heroColor: string;
  secondaryColor: string;
  noiseKind: DirtNoiseKind;
  noiseContrast: number; // 0..1
  bumpStrength: number; // 0..1
  degradeAmount: number; // 0..1
  pebbleDensity: number; // 0..1.5
  pebbleSpread: number; // 0..1
  pebbleShapeRandomness: number; // 0..1
  pebbleColor: string;
  pebbleHueVariance: number; // 0..1
  defaultRoadWidth: number;
  defaultRoadRecess: number;
  defaultRoadBankAngle: number;
  defaultRoadEdgeTransition: number;
  defaultBorderKind: RoadBorderScatterKind;
  defaultBorderDensity: number;
  defaultBorderRandomness: number;
  defaultBorderAssetId?: string;
}

export interface TerrainData {
  size: number; // 64 (or legacy 48 auto-migrated)
  heights: number[]; // (size+1)*(size+1)
  layers: number[]; // 0=grass, 1=sand, 2=rock, 3=snow, 4=moss, 5=cobble, 6=dirt
  /** Optional packed 5-channel weathering/degradation grid (moss, cracks, scorch, mud, frost) */
  weathering?: number[];
  scatter: ScatterItem[];
  caves?: CaveGrotto[];
  mountainConfig?: MountainProfileConfig;
  waterBodies?: WaterBodyConfig[];
  dirtAndRoadConfig?: DirtAndRoadConfig;
  roads?: RoadSpline[];
  /** True when created from scratch or synced from WorldMapData (removes circular shore cutoff) */
  freeformWorld?: boolean;
  /** Half-extent in meters for Lands larger than the default 156m island window */
  worldRadius?: number;
  revision: number;
}

export type MusicMood =
  | 'none'
  | 'calm'
  | 'adventure'
  | 'tense'
  | 'battle'
  | 'mystery'
  | 'triumph';

export type SoundEffect =
  | 'none'
  | 'coin'
  | 'chime'
  | 'hit'
  | 'creak'
  | 'whoosh'
  | 'jump'
  | 'step'
  | 'fanfare'
  | 'sparkle'
  | 'hurt'
  | 'splash'
  | 'chop'
  | 'bite'
  | 'reel';

export interface LevelAudio {
  mood: MusicMood;
  coin: SoundEffect;
  hit: SoundEffect;
  door: SoundEffect;
  portal: SoundEffect;
  jump: SoundEffect;
  step: SoundEffect;
}

export type WidgetAnchor =
  | 'topLeading'
  | 'top'
  | 'topTrailing'
  | 'bottomLeading'
  | 'bottom'
  | 'bottomTrailing'
  | 'center';

export type ActionButtonBinding = 'jump' | 'attack' | 'interact' | 'magicBolt' | 'heal';

export type WidgetKind =
  | 'bar'
  | 'counter'
  | 'inventoryGrid'
  | 'minimap'
  | 'objectiveList'
  | 'dialogue'
  | 'pauseButton'
  | 'timer'
  | 'bossBar'
  | 'tutorial'
  | 'joystick'
  | 'actionButton';

export interface HUDWidget {
  id: string;
  kind: WidgetKind;
  anchor: WidgetAnchor;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  binding: string;
  fillHex: string;
  label: string;
  actionId?: ActionButtonBinding;
  shape?: 'circle' | 'rounded';
  opacity?: number;
  knobColorHex?: string;
}

export interface HUDProfile {
  id: string;
  name: string;
  themeName: string;
  widgets: HUDWidget[];
}

export interface HUDState {
  health: number;
  maxHealth: number;
  stamina: number;
  energy: number;
  magic: number;
  coins: number;
  keys: number;
  timeText: string;
  objectives: string[];
  heroPoint: BoardPoint;
  portalPoint: BoardPoint;
  baddiePoints: BoardPoint[];
  flashHealth: boolean;
  bossName?: string;
  bossHealth?: number;
  bossMaxHealth?: number;
  heldItemName?: string;
  heldItemColor?: string;
  bagCount?: number;
  hotbarItems?: {
    id: string;
    name: string;
    colorHex: string;
    icon: string;
    qty: number;
    held: boolean;
  }[];
  buddiesFound?: number;
  buddiesTotal?: number;
}

export interface PlayerTelemetry {
  levelId: string;
  point: BoardPoint;
  yaw: number;
  worldX?: number;
  worldZ?: number;
  speedKmh?: number;
  buddiesFound?: number;
  buddiesTotal?: number;
  recruitedBuddyIds?: string[];
  checkpointsHit?: number;
  checkpointsTotal?: number;
  clearedCheckpointIds?: string[];
  roguelikeFloorLevel?: GameLevel;
  trail: BoardPoint[];
}

export type GrassQuality = 'off' | 'light' | 'lush' | 'dense' | 'ultra';

export interface GrassFieldConfig {
  enabled: boolean;
  quality: GrassQuality;
  viewDistance: number; // 30..85m
  bladeHeight: number; // 0.35..1.45m
  bladeWidth: number; // 0.05..0.18m
  windWaveStrength: number; // 0.2..2.0
  tipGlow: number; // 0..1.2
  interactiveParting: boolean;
  primaryColor?: string;
  secondaryColor?: string;
  mixNoiseScale?: number; // 0.2..3.0
  carexMix?: number; // 0..1 (0 = lush short lawn, 1 = tall arching sedge/carex)
  tuftClumpiness?: number; // 0..1
}

export type SideScrollerLayoutStyle =
  | 'flat2D'
  | 'verticalClimber'
  | 'layeredJungle'
  | 'underwater'
  | 'skyTemple'
  | 'cavern';

export type SideScrollerThemeId =
  | 'sunnyCliffs'
  | 'jungleCanopy'
  | 'underwaterCoral'
  | 'volcanicForge'
  | 'crystalCavern'
  | 'skyTemple';

export type SideScrollerBackdropStyle =
  | 'cliffsAndPines'
  | 'jungleTreesAndVines'
  | 'coralReefAndKelp'
  | 'volcanicSpires'
  | 'crystalCaverns'
  | 'floatingTemples';

export type SidePlatformSegmentStyle =
  | 'cliff'
  | 'bridge'
  | 'stone'
  | 'jungleFloor'
  | 'branch'
  | 'girder'
  | 'coral'
  | 'crystal'
  | 'cloud';

export interface SidePlatformSegment {
  id?: string;
  minX: number;
  maxX: number;
  y: number;
  thickness: number;
  style: SidePlatformSegmentStyle;
  color?: string;
  oneWay?: boolean;
  isSecretFloor?: boolean;
  z?: number;
  depth?: number;
}

export interface SideScrollerVineOrLadder {
  id: string;
  kind: 'vine' | 'ladder' | 'bubbleStream';
  x: number;
  z?: number;
  bottomY: number;
  topY: number;
  color?: string;
}

export interface SideScrollerSecretRoom {
  id: string;
  name: string;
  entranceX: number;
  entranceY: number;
  roomCenterX: number;
  roomCenterY: number;
  width: number;
  height: number;
  floorColor?: string;
  wallColor?: string;
  accentColor?: string;
  exitX?: number;
  exitY?: number;
}

export interface SideScrollerLayersConfig {
  foregroundStyle:
    | 'shrubsAndRocks'
    | 'jungleFraming'
    | 'coralSilhouette'
    | 'cavernStalactites'
    | 'none';
  foregroundColor: string;
  heroLaneColor: string;
  heroTrimColor: string;
  midgroundStyle: SideScrollerBackdropStyle;
  midgroundColor: string;
  farStyle:
    | 'alpineMountains'
    | 'jungleMistCanopy'
    | 'deepOceanRays'
    | 'volcanoPeaks'
    | 'cavernVault'
    | 'cloudPillars';
  farColor: string;
  liquidType: 'water' | 'lava' | 'mist' | 'none';
  liquidLevelY: number;
  liquidColor: string;
}

export interface SideScrollerConfig {
  layoutStyle: SideScrollerLayoutStyle;
  theme: SideScrollerThemeId;
  segments: SidePlatformSegment[];
  vines: SideScrollerVineOrLadder[];
  secretRooms: SideScrollerSecretRoom[];
  layers: SideScrollerLayersConfig;
  gravityScale?: number;
  swimPhysics?: boolean;
}

export interface GameLevel {
  id: string;
  name: string;
  style: LevelStyle;
  environmentType?: EnvironmentType;
  visualStyle?: VisualStyleId;
  biome: BiomeId;
  sky: SkyPresetId;
  sunAngle: number;
  timeOfDay?: number; // 0..24 hours
  autoCycleTime?: boolean;
  cloudDensity?: number; // 0..1
  sunIntensityScale?: number; // 0.3..1.8
  ambientIntensityScale?: number; // 0.3..1.8
  atmosphereWarmth?: number; // -0.5..0.5
  starIntensity?: number; // 0..1.5
  cameraMode?: CameraMode;
  fog: number;
  hasStart: boolean;
  hasPortal: boolean;
  completeCondition: CompleteCondition;
  requiredCount: number;
  nextLevelID?: string;
  objectives: LevelObjective[];
  entities: LevelEntity[];
  terrain?: TerrainData;
  grass?: GrassFieldConfig;
  audio: LevelAudio;
  weather: WeatherKind;
  vistaPreset?: VistaPresetId;
  vistaDensity?: number;
  vistaTreeDensity?: number;
  vistaMountainScale?: number;
  vistaDistance?: number;
  vistaTreeScale?: number;
  vistaHeightFog?: number;
  vistaItems?: VistaPropItem[];
  canopyEngine?: StylizedCanopyConfig;
  sceneryTextures?: Partial<Record<SceneryTextureSlot, SurfaceTextureSettings>>;
  wind: number;
  canSwim: boolean;
  notes: string;
  gameplayMode?: GameplayMode;
  startWithDuckling?: boolean;
  heroIntroSpeech?: string;
  heroIntroVoice?: DialogueVoiceConfig;
  chapterNumber?: number;
  chapterTitle?: string;
  chapterSummary?: string;
  startPoint?: BoardPoint;
  portalPoint?: BoardPoint;
  drivingConfig?: DrivingConfig;
  roguelikeConfig?: RoguelikeConfig;
  rpgConfig?: RpgLevelConfig;
  dungeonStyle?: DungeonStyleConfig;
  dungeonRooms?: DungeonRoomSpec[];
  customWallBoxes?: WallColliderBox[];
  roguelikeTorchAnchors?: RoguelikeTorchAnchor[];
  sideScrollerConfig?: SideScrollerConfig;
  storyShots?: StoryCameraShot[];
  storySkits?: StorySkit[];
}

export type ColorGradingPresetId =
  | 'neutral'
  | 'goldenHour'
  | 'cinematicTealOrange'
  | 'fairyMeadow'
  | 'moonlitNoir'
  | 'vintageFilm'
  | 'arcticCrisp'
  | 'warmSunset'
  | 'noirMono'
  | 'sepiaRelic';

export interface PostProcessingConfig {
  enabled: boolean;
  // Bloom
  bloomEnabled: boolean;
  bloomIntensity: number; // 0..2.2
  bloomThreshold: number; // 0..1.2
  bloomRadius: number; // 0..1.2
  // Optical Lens Flare
  lensFlareEnabled: boolean;
  lensFlareIntensity: number; // 0..2.0
  lensFlareGhosts: number; // 0..1.5
  lensFlareHalo: number; // 0..1.5
  // Color Grading
  colorGradingEnabled: boolean;
  colorGradingPreset: ColorGradingPresetId;
  exposure: number; // 0.5..1.8
  contrast: number; // -0.5..0.6
  saturation: number; // -1.0..0.8
  temperature: number; // -1.0..1.0
  tint: number; // -1.0..1.0
  highlightsWarmth: number; // -0.5..0.5
  shadowsCoolness: number; // -0.5..0.5
  // Vignette
  vignetteEnabled?: boolean;
  vignette: number; // 0..1.0
  vignetteSoftness?: number; // 0.1..1.0
  // Screen-Space Reflections (r187 SSRNode, OFF by default)
  ssrEnabled?: boolean;
  ssrIntensity?: number; // 0..1.5
  ssrMaxRoughness?: number; // 0.1..0.9
}

export interface GameProject {
  id: string;
  name: string;
  tagline: string;
  symbol: string;
  colorHex: string;
  updatedAt: string; // ISO
  levels: GameLevel[];
  worldMap?: WorldMapData;
  worldMapFogOfWar?: boolean;
  savePlinthAssetId?: string;
  heroName: string;
  heroBody: string;
  heroColors: {
    tunic: string;
    cloak: string;
    hair: string;
    skin: string;
  };
  heroCustomAssetId?: string;
  heroModelScale?: number;
  heroModelOffsetY?: number;
  heroAnimSpeed?: number;
  heroChatBubble?: ChatBubbleStyle;
  heroProfile?: HeroProfileConfig;
  chatSettings?: ChatDisplaySettings;
  enabledActions: string[];
  hud: HUDProfile;
  currencies: string[];
  inventoryItems?: InventoryItemDef[];
  craftingRecipes?: CraftingRecipe[];
  inventoryConfig?: GameInventoryConfig;
  postProcessing?: PostProcessingConfig;
  storybook?: StorybookConfig;
  customMonsters?: MonsterBlueprint[];
  /** Universal Motion Studio project-wide variation library & slot defaults */
  customMotionLibrary?: CustomMotionPreset[];
  customPoseLibrary?: SavedPosePreset[];
  heroMotionSlots?: Partial<Record<CustomClipSlot, string>>;
  npcMotionSlots?: Partial<Record<CustomClipSlot, string>>;
  buddyMotionSlots?: Partial<Record<CustomClipSlot, string>>;
  buddyMotionSlotsByCreature?: Partial<Record<CreatureBodyId, Partial<Record<CustomClipSlot, string>>>>;
  baddieMotionSlots?: Partial<Record<CustomClipSlot, string>>;
  coverTagline: string;
  difficulty: 'Easy' | 'Normal' | 'Tricky';
  published: boolean;
  sharedBy?: string;
}

export type StorybookThemeId = 'woodland' | 'goldenMeadow' | 'moonlitFable';

export interface StorybookConfig {
  enabled: boolean;
  theme: StorybookThemeId;
  subtitle?: string;
  authorCredit?: string;
  prologueText?: string;
  prologueVoice?: DialogueVoiceConfig;
  epilogueTitle?: string;
  epilogueText?: string;
  epilogueVoice?: DialogueVoiceConfig;
  moralLine?: string;
}

export type ChatBubbleShape =
  | 'rounded'
  | 'pill'
  | 'comic'
  | 'sharp'
  | 'thought'
  | 'shout'
  | 'scroll';

export type ChatBubbleTailStyle = 'pointer' | 'curved' | 'dots' | 'none';

export type ChatFontId =
  | 'sans'
  | 'display'
  | 'serif'
  | 'cartoon'
  | 'comic'
  | 'handwritten'
  | 'pixel'
  | 'mono';

export type ChatBubbleShadow = 'none' | 'soft' | 'hard' | 'glow';
export type ChatBubbleAnim = 'pop' | 'float' | 'fade' | 'none';

export type ChatBubblePresetId =
  | 'classic'
  | 'comic'
  | 'parchment'
  | 'retroPixel'
  | 'thought'
  | 'shout'
  | 'sleekDark'
  | 'neonTerminal';

export interface ChatBubbleStyle {
  presetId?: ChatBubblePresetId;
  shape: ChatBubbleShape;
  tailStyle: ChatBubbleTailStyle;
  bgColor: string;
  textColor: string;
  borderColor: string;
  speakerColor: string;
  opacity: number; // 0.45..1.0
  borderWidth: number; // 0..5
  borderRadius: number; // 0..28
  shadowStyle: ChatBubbleShadow;
  fontFamily: ChatFontId;
  fontSize: number; // 11..22
  fontWeight: 'normal' | 'semibold' | 'bold';
  italic: boolean;
  textAlign: 'left' | 'center';
  showSpeakerName: boolean;
  typewriterEffect: boolean;
  typewriterSpeed: number; // chars per second (16..95)
  entranceAnim: ChatBubbleAnim;
  maxWidth: number; // 180..380 px
  floatHeight: number; // 0..2.2m extra Y above character head
  autoShowOnApproach: boolean;
  autoShowDistance: number; // 2.5..9.5m
}

export type ChatDisplayMode = 'bubbles' | 'bottomPanel';
export type ChatPanelThemeId = 'classic' | 'parchment' | 'retro' | 'light';

export type DialogueOutputMode = 'text' | 'audio' | 'both';

export interface DialogueVoiceConfig {
  mode?: 'inherit' | DialogueOutputMode;
  clipId?: string;
  lineClipIds?: Record<number, string>;
  volume?: number; // 0.1..1.5
  playbackRate?: number; // 0.7..1.4
  autoAdvance?: boolean;
}

export interface ChatDisplaySettings {
  displayMode: ChatDisplayMode;
  dialogueMode?: DialogueOutputMode;
  panelTheme: ChatPanelThemeId;
  panelBgColor: string;
  panelBorderColor: string;
  panelTextColor: string;
  panelOpacity: number; // 0.65..1.0
  panelUseCharacterStyle: boolean;
  panelShowPortrait: boolean;
  panelShowHistory: boolean;
  panelPauseGame: boolean;
  panelCompact: boolean;
}

export * from './inventory';

export interface GameTemplate {
  id: string;
  name: string;
  symbol: string;
  colorHex: string;
  blurb: string;
  category?: Exclude<TemplateCategory, 'all'>;
  prototypeType?: string;
  biomeLabel?: string;
  highlights?: string[];
}

export interface MakerIssue {
  id: string;
  title: string;
  detail: string;
  symbol: string;
  tab: StageTab;
  motionSection?: MotionStudioSection;
  openPublish?: boolean;
  isBlocking: boolean;
}

export type ActionGroup = 'movement' | 'combat' | 'interaction' | 'emotes' | 'skills';

export interface CharacterAction {
  id: string;
  title: string;
  symbol: string;
  group: ActionGroup;
  blurb: string;
  button: string;
}

export interface ClauseDefinition {
  key: string;
  label: string;
  needsDetail: boolean;
  detailHint: string;
  symbol: string;
}

export interface RuleRecipe {
  id: string;
  title: string;
  symbol: string;
  blurb: string;
  whenKey: string;
  conditionKeys: string[];
  actionKeys: string[];
  kinds: EntityKind[];
}

export interface BindableStat {
  id: string;
  title: string;
  symbol: string;
  isLive: boolean;
}

export type ViewportTool = 'move' | 'rotate' | 'scale' | 'terrain' | 'add';

export type ViewportShadowQuality = 'off' | 'low' | 'medium' | 'high';

export type ViewportResolutionScale = 0.5 | 0.75 | 1 | 1.25 | 1.5;

export type SavePresetScope = 'fullGame' | 'worldLevel' | 'treeStudio' | 'atmosphere';

export type TimeOfDayPresetId = 'dawn' | 'noon' | 'dusk' | 'night';

export interface AtmospherePresetPayload {
  sky: GameLevel['sky'];
  timeOfDay?: number;
  autoCycleTime?: boolean;
  cloudDensity?: number;
  sunIntensityScale?: number;
  ambientIntensityScale?: number;
  atmosphereWarmth?: number;
  starIntensity?: number;
  sunAngle: number;
  fog: number;
  weather: GameLevel['weather'];
  wind: number;
  visualStyle?: VisualStyleId;
  vistaPreset?: VistaPresetId;
  vistaDensity?: number;
  vistaTreeDensity?: number;
  vistaMountainScale?: number;
  vistaDistance?: number;
  vistaTreeScale?: number;
  vistaHeightFog?: number;
  postProcessing?: PostProcessingConfig;
}

export interface WorldLevelPresetPayload {
  level: GameLevel;
  postProcessing?: PostProcessingConfig;
}

export interface SavePresetEntry {
  id: string;
  name: string;
  notes?: string;
  scope: SavePresetScope;
  createdAt: string;
  updatedAt: string;
  summary: string;
  fullGame?: GameProject;
  worldLevel?: WorldLevelPresetPayload;
  treeStudio?: StylizedCanopyConfig;
  atmosphere?: AtmospherePresetPayload;
  assets?: ExportedAssetBundle[];
  textures?: ExportedTextureBundle[];
  voiceOvers?: ExportedVoiceBundle[];
}

export interface SavePresetsFileBundle {
  format: 'maker.savepresets.v1';
  exportedAt: string;
  presets: SavePresetEntry[];
}

// ============================================================================
// Character Maker (SDF Smooth-Union Clay Sculpt + Hierarchical Skeleton Rig)
// ============================================================================

export type CharacterBodyPartKey =
  | 'head'
  | 'headCrown'
  | 'headJaw'
  | 'neck'
  | 'torso'
  | 'belly'
  | 'hips'
  | 'muzzle'
  | 'upperArm'
  | 'lowerArm'
  | 'upperLeg'
  | 'lowerLeg'
  | 'tail'
  | 'extraArm'
  | 'extraLeg';

export interface CharacterLimbProfile {
  /** Radius at proximal / root end (m) */
  startRadius: number;
  /** Radius at midpoint bulge / pinch (m) */
  midRadius: number;
  /** Radius at distal / tip end (m) */
  endRadius: number;
  /** Curvature transition factor (-1 = sleek concave taper, 0 = smooth S-curve, +1 = plump convex clay) */
  curvature: number;
  /** Segment length in meters */
  length: number;
  /** Optional cross-section ovalness (width vs depth) */
  squashX?: number;
  squashZ?: number;
  /** Region color (smoothly blended across clay joints) */
  color: string;
}

export interface CharacterHeadSegmentProfile extends CharacterLimbProfile {
  /** Vertical offset relative to skull anchor (m) */
  offsetY: number;
  /** Forward/back offset relative to skull anchor (m) */
  offsetZ: number;
  /** Smooth-min clay blend tightness multiplier (0.15..1.0) */
  blendScale: number;
}

export type CharacterMuzzlePresetId =
  | 'none'
  | 'bunnySplit'
  | 'squirrelPuff'
  | 'catWhiskerPad'
  | 'foxTaper'
  | 'dogSnout'
  | 'horseMuzzle'
  | 'bearBroad'
  | 'lizardSnout'
  | 'custom';

export interface CharacterMuzzleSegment {
  /** Half-width (X radius in meters) */
  rx: number;
  /** Half-height (Y radius in meters) */
  ry: number;
}

export interface CharacterMuzzleConfig {
  preset: CharacterMuzzlePresetId;
  length: number;
  yOffset: number;
  tiltDeg: number;
  /** 0 = unified snout, 0.1..1.0 = dual oval sphere whisker pads with center cleft */
  splitCleft: number;
  /** 5 segments from head root -> upper bridge -> mid -> pre-tip -> nose/lip tip */
  segments: [
    CharacterMuzzleSegment,
    CharacterMuzzleSegment,
    CharacterMuzzleSegment,
    CharacterMuzzleSegment,
    CharacterMuzzleSegment
  ];
  color: string;
}

export type CharacterBeakStyle =
  | 'none'
  | 'songbird'
  | 'duck'
  | 'owl'
  | 'eagleHawk'
  | 'storkCrane'
  | 'pelican';

export type CharacterNoseStyle =
  | 'none'
  | 'buttonSphere'
  | 'oval'
  | 'flatButton'
  | 'longHuman'
  | 'bulbous'
  | 'triangleAnimal'
  | 'wideSnoutNose';

export type CharacterNostrilStyle = 'teardrop' | 'round' | 'slit';

export type CharacterTeethStyle =
  | 'none'
  | 'strips'
  | 'canine'
  | 'buck'
  | 'stripsAndCanine';

export type CharacterHandStyle =
  | 'nub'
  | 'fingers2'
  | 'fingers3'
  | 'fingers4'
  | 'fingers5'
  | 'paw'
  | 'claw'
  | 'hoof';

export type CharacterFootStyle = 'biped' | 'paw' | 'claw' | 'hoof';

export type CharacterEarStyle =
  | 'none'
  | 'human'
  | 'elfPointed'
  | 'rabbitLong'
  | 'rabbitFloppy'
  | 'squirrelRound'
  | 'catFoxTriangle'
  | 'dogFloppy'
  | 'horsePerked'
  | 'animalPerk'
  | 'floppy'
  | 'bat'
  | 'fin'
  | 'antennae';

export type CharacterHornStyle =
  | 'straight'
  | 'curvedBack'
  | 'ramSpiral'
  | 'devilSweep'
  | 'antler';

export type CharacterWingStyle =
  | 'none'
  | 'birdRound'
  | 'birdSoaring'
  | 'birdLong'
  | 'dragon'
  | 'bat'
  | 'feather'
  | 'fairy'
  | 'fairyButterfly'
  | 'angelFeather';

export type CharacterTailStyle =
  | 'none'
  | 'smooth'
  | 'bunnyCotton'
  | 'squirrelPlume'
  | 'horseTail'
  | 'catTail'
  | 'dogTail'
  | 'foxBrush'
  | 'lionTail'
  | 'geckoTail'
  | 'dragonTail'
  | 'fishTail'
  | 'birdTail'
  | 'bulbTip'
  | 'spiky'
  | 'fluffy'
  | 'fin';

export type CharacterHairStyle =
  | 'none'
  // Male / Unisex styles
  | 'shortCrop'
  | 'sidePart'
  | 'pompadour'
  | 'messySpiky'
  | 'undercut'
  | 'buzzFade'
  | 'surferCurtains'
  // Female / Long styles
  | 'longStraight'
  | 'longEndCurls'
  | 'bobCut'
  | 'bobFlip'
  | 'wavyShoulder'
  | 'twinPigtails'
  | 'highBun'
  | 'braidedCrown'
  | 'ponytail'
  | 'curlyAfro'
  // Creature & stylized presets
  | 'spikyTufts'
  | 'mohawk'
  | 'curlSwirl'
  | 'mushroomCap'
  | 'horseMane'
  | 'lionMane'
  | 'featherTuft'
  | 'fluffyBangs';

export type CharacterHairLayoutMode =
  | 'partedSides'
  | 'afroSides'
  | 'spikySides'
  | 'crest'
  | 'mane';

export type CharacterHairDetailStyle =
  | 'none'
  | 'endCurls'
  | 'bobFlip'
  | 'pigtails'
  | 'twinBuns'
  | 'ponytail'
  | 'highBun'
  | 'braidPlait'
  | 'pompCrest';

export interface CharacterHairSideConfig {
  enabled: boolean;
  /** Closeness / outward lift relative to skull (-0.03 = hugs tight .. +0.08 = lifted volume) */
  skinHug: number;
  /** Width & thickness of sculpted locks or puff clusters (0.4 .. 2.0) */
  fullness: number;
  /** Vertical flatten vs tall crown volume (0.35 = sleek/flat .. 1.8 = tall) */
  flatness: number;
  /** Draping length of locks / bangs reach (0.2 .. 2.2) */
  length: number;
  /** Sharpness/taper & spiky splay (0 = smooth rounded locks .. 1 = sharp spikes) */
  spikiness: number;
  /** Individual puff & curl cluster breakup (0 = sleek locks .. 1 = curly puffs) */
  puffiness: number;
  /** Scale of individual puffs/curls (0.4 .. 2.0) */
  puffScale: number;
  /** Side X offset (-0.12 .. +0.12) */
  offsetX: number;
  /** Side Y offset (-0.12 .. +0.12) */
  offsetY: number;
  /** Side Z offset (-0.12 .. +0.12) */
  offsetZ: number;
  /** Side scale multiplier (0.5 .. 1.8) */
  scale: number;
  /** Tip flare (-1 = tucked inward .. +1 = flared outward) */
  flare: number;
  /** Front bangs drop/coverage (0 = swept off forehead .. 1 = full framed bangs) */
  bangsDrop: number;
}

export interface CharacterHairSculptConfig {
  layout: CharacterHairLayoutMode;
  /** Center part gap width (-0.015 = overlapping .. +0.055 = clear scalp part) */
  partGap: number;
  /** Left/Right part line shift (-0.08 .. +0.08) */
  partShift: number;
  /** Mirror left & right side parameters until unlinked */
  mirrorSides: boolean;
  left: CharacterHairSideConfig;
  right: CharacterHairSideConfig;
  detailStyle: CharacterHairDetailStyle;
  detailScale: number;
  detailCurl: number;
  detailOffsetY: number;
}

export type CharacterSurfaceCoatMode =
  | 'none'
  | 'furShort'
  | 'furLong'
  | 'furClumped'
  | 'scalesFish'
  | 'scalesDragon'
  | 'scalesHex';

export interface CharacterSurfaceCoatConfig {
  mode: CharacterSurfaceCoatMode;
  /** Bump/texture contrast and 3D tuft relief intensity (0..1) */
  intensity: number;
  /** Coat coverage / tuft or shingle density (0.25..1.6) */
  density: number;
  /** Size multiplier for scales or fur tufts (0.5..2.0) */
  scaleSize: number;
  /** Fur clumping / lock grouping factor (0..1) */
  clumpiness: number;
  /** Tip or scale-edge highlight color */
  tipColor: string;
}

export type CharacterSpikesStyle =
  | 'porcupineQuills'
  | 'boneSpikes'
  | 'dorsalFins'
  | 'crystalSpines';

export type CharacterSpikesZone =
  | 'spine'
  | 'headAndBack'
  | 'shouldersAndBack'
  | 'fullBody';

export interface CharacterSpikesConfig {
  enabled: boolean;
  style: CharacterSpikesStyle;
  zone: CharacterSpikesZone;
  /** Density multiplier (0.25..1.6) */
  density: number;
  /** Spike/quill length in meters (0.05..0.38) */
  length: number;
  /** Thickness multiplier (0.5..2.0) */
  thickness: number;
  /** Backward sweep angle in degrees (-15..75) */
  sweepDeg: number;
  color: string;
  tipColor: string;
}

export type CharacterEyewearStyle =
  | 'none'
  | 'roundGlasses'
  | 'goggles'
  | 'cyberVisor'
  | 'monocle';

export type CharacterHeadGearStyle =
  | 'none'
  | 'adventurerCap'
  | 'wizardHat'
  | 'crown'
  | 'halo'
  | 'flowerCrown';

export type CharacterBodyGearStyle =
  | 'none'
  | 'backpack'
  | 'quiver'
  | 'cape'
  | 'scarf'
  | 'pauldrons';

export interface CharacterAddonConfig {
  eyewear: CharacterEyewearStyle;
  eyewearColor: string;
  eyewearLensColor: string;
  eyewearOffsetY: number;
  eyewearOffsetZ: number;
  eyewearScale: number;
  headGear: CharacterHeadGearStyle;
  headGearColor: string;
  headGearAccentColor: string;
  headGearOffsetY: number;
  headGearRotX: number;
  headGearScale: number;
  bodyGear: CharacterBodyGearStyle;
  bodyGearColor: string;
  bodyGearAccentColor: string;
  bodyGearScale: number;
}

export type CharacterEyePupilStyle = 'round' | 'catSlit' | 'oval' | 'starry' | 'glow';

export type CharacterEyebrowExpression = 'neutral' | 'determined' | 'friendly' | 'surprised' | 'sly';

export type CharacterMouthStyle =
  | 'none'
  | 'smile'
  | 'smirk'
  | 'frown'
  | 'catW'
  | 'fangs'
  | 'openSmile'
  | 'openSurprised'
  | 'openWorried'
  | 'openGrin'
  | 'beak';

export type CharacterMaterialFinish = 'clay' | 'toonSatin' | 'glossySlime' | 'velvetCreature';

export type CharacterPresetId =
  | 'standardHumanoid'
  | 'adventurer'
  | 'forestElf'
  | 'pocketCritter'
  | 'alienExplorer'
  | 'hornedMonster'
  | 'storyHorse'
  | 'storySquirrel'
  | 'storyRabbit'
  | 'storyFox'
  | 'storyGecko'
  | 'storyBear'
  | 'storyOwl'
  | 'storyTweety';

export interface CharacterMakerDoc {
  version: 1;
  presetId?: CharacterPresetId;
  materialFinish: CharacterMaterialFinish;
  sculptData?: MonsterSculptData;
  /** Global smooth minimum blending radius k (0.015..0.18m) */
  blendSmoothness: number;
  /** Body proportions & posture */
  shoulderWidth: number;
  hipWidth: number;
  armSpreadDeg: number; // T-pose / A-pose bind spread angle downward (5..55 deg)
  legStanceWidth: number;
  headForwardTilt: number;
  snoutLength: number;
  snoutWidth: number;
  snoutColor: string;
  /** Multi-segment sculpted muzzle (5 segments + optional rabbit/squirrel cheek split) */
  muzzle?: CharacterMuzzleConfig;
  bellyPatchEnabled: boolean;
  bellyColor: string;
  extremityTipColor: string;

  /** Core and limb radial circumference + curvature profiles */
  head: CharacterLimbProfile;
  /** Upper cranium / forehead / brow sculpt segment */
  headCrown?: CharacterHeadSegmentProfile;
  /** Lower jaw / chin / jowl sculpt segment */
  headJaw?: CharacterHeadSegmentProfile;
  neck: CharacterLimbProfile;
  torso: CharacterLimbProfile;
  belly: CharacterLimbProfile;
  hips: CharacterLimbProfile;
  upperArm: CharacterLimbProfile;
  lowerArm: CharacterLimbProfile;
  upperLeg: CharacterLimbProfile;
  lowerLeg: CharacterLimbProfile;

  /** Hands & Feet */
  handStyle: CharacterHandStyle;
  handScale: number;
  fingerSpread: number;
  footStyle: CharacterFootStyle;
  footScale: number;

  /** Modular Appendages */
  extraArmsEnabled: boolean;
  extraArmHeightOffset: number;
  extraArmProfile: CharacterLimbProfile;

  extraLegsEnabled: boolean;
  extraLegRearOffset: number;
  extraLegProfile: CharacterLimbProfile;

  tailStyle: CharacterTailStyle;
  tailCurl: number;
  tailProfile: CharacterLimbProfile;

  earStyle: CharacterEarStyle;
  earSize: number;
  earTilt: number;
  earColor: string;

  hornCount: 0 | 1 | 2 | 4;
  hornStyle: CharacterHornStyle;
  hornLength: number;
  hornThickness: number;
  hornColor: string;

  wingStyle: CharacterWingStyle;
  wingSpan: number;
  wingTilt: number;
  wingFold?: number;
  wingColor: string;
  wingTipColor?: string;

  whiskerPairs: 0 | 1 | 2 | 3;
  whiskerLength: number;
  whiskerDroop: number;
  whiskerColor: string;

  hairStyle: CharacterHairStyle;
  hairSize: number;
  hairColor: string;
  hairAccentColor?: string;
  hairOffsetX?: number;
  hairOffsetY?: number;
  hairOffsetZ?: number;
  hairRotX?: number;
  hairRotY?: number;
  hairRotZ?: number;
  hairScale?: number;
  /** Dual-side sculpted hair parameters & detail attachments */
  hairConfig?: CharacterHairSculptConfig;
  /** Active custom hair preset ID if loaded from or saved to Custom Hair Presets */
  customHairPresetId?: string;

  /** Surface Coat: fur (short, long, clumped) and scales (fish, dragon, hex) */
  surfaceCoat?: CharacterSurfaceCoatConfig;
  /** Spikes & Quills layered onto dorsal/body bones */
  spikes?: CharacterSpikesConfig;
  /** Fun bone-attached character accessories (eyewear, hats/crowns, packs/capes) */
  addons?: CharacterAddonConfig;

  /** Beak */
  beakStyle?: CharacterBeakStyle;
  beakLength?: number;
  beakWidth?: number;
  beakHeight?: number;
  beakHook?: number;
  beakOpen?: number;
  beakColor?: string;
  beakLowerColor?: string;

  /** Shapeable Nose & Movable Muzzle Nostrils */
  noseStyle?: CharacterNoseStyle;
  noseSize?: number;
  noseScaleX?: number;
  noseScaleY?: number;
  noseScaleZ?: number;
  noseOffsetY?: number;
  noseOffsetZ?: number;
  noseColor?: string;

  nostrilsEnabled?: boolean;
  nostrilStyle?: CharacterNostrilStyle;
  /** 0 = front end of muzzle, 90 = outer side walls of muzzle */
  nostrilSideAngleDeg?: number;
  nostrilHeightOffset?: number;
  nostrilForwardOffset?: number;
  nostrilSize?: number;
  nostrilColor?: string;

  /** Surface-mounted Eyes, Full-closing Eyelids, Eyebrows & Mouth */
  eyeCount: 1 | 2 | 3 | 4 | 6;
  /** 0.14 = flat cartoon disc .. 1.0 = full 3D sphere eyeball */
  eyeFlatness: number;
  eyeSize: number;
  eyeAspectX: number;
  eyeAspectY: number;
  eyeSpacing: number;
  eyeHeight: number;
  eyeDepthOffset?: number;
  pupilStyle: CharacterEyePupilStyle;
  pupilSize: number;
  scleraColor: string;
  irisColor: string;
  pupilColor: string;

  eyelidEnabled: boolean;
  /** 0 = wide open tucked up, 0.5 = half-closed sleepy, 1.0 = fully closed */
  eyelidRestHeight: number;
  eyelidLowerEnabled: boolean;
  eyelidColor: string;
  autoBlink: boolean;

  eyebrowEnabled: boolean;
  eyebrowExpression: CharacterEyebrowExpression;
  eyebrowSpacing?: number;
  eyebrowHeight: number;
  eyebrowTiltDeg: number;
  eyebrowArch: number;
  eyebrowThickness: number;
  eyebrowWidth: number;
  eyebrowColor: string;

  /** Optional per-side (Left / Right / Both) facial overrides */
  eyeSideConfig?: CharacterEyeSculptConfig;
  eyebrowSideConfig?: CharacterEyebrowSculptConfig;
  mouthSideConfig?: CharacterMouthSculptConfig;

  mouthStyle: CharacterMouthStyle;
  mouthSize: number;
  mouthColor: string;
  mouthWidthScale?: number;
  mouthOpenAmount?: number;
  mouthOffsetY?: number;
  mouthOffsetZ?: number;
  mouthTiltDeg?: number;
  mouthRecessEnabled?: boolean;
  mouthTongueEnabled?: boolean;
  mouthTongueColor?: string;
  mouthTeethStyle?: CharacterTeethStyle;
  buckTeethSize?: number;
  buckTeethTopWidth?: number;
  buckTeethBottomWidth?: number;
  vertexPaintStrokes?: VertexPaintStroke[];
  /** Beard, Mustache, Sideburns & Painted-On Stubble configuration */
  facialHair?: CharacterFacialHairConfig;
}

export interface CharacterEyeSideConfig {
  enabled: boolean;
  flatness: number;
  size: number;
  aspectX: number;
  aspectY: number;
  spacing: number;
  height: number;
  depthOffset: number;
  pupilStyle: CharacterEyePupilStyle;
  pupilSize: number;
  irisColor: string;
  scleraColor: string;
  eyelidEnabled: boolean;
  eyelidRestHeight: number;
  eyelidLowerEnabled: boolean;
  eyelidColor: string;
}

export interface CharacterEyeSculptConfig {
  mirrorSides: boolean;
  left: CharacterEyeSideConfig;
  right: CharacterEyeSideConfig;
}

export interface CharacterEyebrowSideConfig {
  enabled: boolean;
  expression: CharacterEyebrowExpression;
  spacing: number;
  height: number;
  tiltDeg: number;
  arch: number;
  thickness: number;
  width: number;
  color: string;
}

export interface CharacterEyebrowSculptConfig {
  mirrorSides: boolean;
  left: CharacterEyebrowSideConfig;
  right: CharacterEyebrowSideConfig;
}

export interface CharacterMouthSideConfig {
  enabled: boolean;
  size: number;
  widthScale: number;
  openAmount: number;
  offsetY: number;
  offsetZ: number;
  tiltDeg: number;
  color: string;
}

export interface CharacterMouthSculptConfig {
  mirrorSides: boolean;
  left: CharacterMouthSideConfig;
  right: CharacterMouthSideConfig;
}

export type CharacterMustacheStyle =
  | 'none'
  | 'pencil'
  | 'classicStraight'
  | 'chevron'
  | 'handlebar'
  | 'imperial'
  | 'dali'
  | 'walrus'
  | 'bushyBrush'
  | 'horseshoe'
  | 'fuManchu'
  | 'toothbrush';

export interface CharacterMustacheSideConfig {
  enabled: boolean;
  /** Strand thickness multiplier (0.25 = ultra-thin pencil .. 2.2 = thick bushy) */
  thickness: number;
  /** Outward span / wing length (0.3 .. 2.2) */
  length: number;
  /** Tip curvature (-1.2 = drooping .. 0 = straight .. +1.8 = handlebar curl up) */
  curl: number;
  /** Layered strand density & fluffiness (0 = sleek single sweep .. 1 = lush multi-layer bushy) */
  bushiness: number;
  /** Pitch/droop angle in degrees (-45 .. +45) */
  angleDeg: number;
  /** Horizontal philtrum gap / lateral shift (-0.03 .. +0.06 m) */
  offsetX: number;
  /** Vertical position offset (-0.05 .. +0.05 m) */
  offsetY: number;
  /** Depth offset (-0.035 = embedded into face .. +0.045 = lifted off face) */
  offsetZ: number;
  /** Overall side scale multiplier (0.4 .. 1.8) */
  scale: number;
}

export interface CharacterMustacheConfig {
  style: CharacterMustacheStyle;
  mirrorSides: boolean;
  left: CharacterMustacheSideConfig;
  right: CharacterMustacheSideConfig;
}

export type CharacterBeardStyle =
  | 'none'
  | 'soulPatch'
  | 'goatee'
  | 'vanDyke'
  | 'circleBeard'
  | 'chinStrap'
  | 'chinCurtain'
  | 'shortBoxed'
  | 'fullTrimmed'
  | 'bushyLumberjack'
  | 'ducktail'
  | 'wizardLong'
  | 'vikingBraided'
  | 'muttonChops';

export interface CharacterBeardConfig {
  style: CharacterBeardStyle;
  /** Overall beard drape length (0.25 .. 2.2) */
  length: number;
  /** Strand thickness & volume (0.35 .. 2.0) */
  thickness: number;
  /** Multi-layer bushiness & fluffiness (0 = sleek sculpted .. 1 = wild bushy layers) */
  bushiness: number;
  /** Width / cheek wrap spread (0.4 .. 1.8) */
  width: number;
  /** Tip curl / wave (0 = straight soft drape .. 1 = curled/wavy strands) */
  curl: number;
  /** Pointed taper vs rounded/broad bottom (-1 = broad rounded .. +1 = tapered point) */
  taper: number;
  /** Cheek hairline coverage height (0 = low jawline .. 1 = high cheekbones) */
  cheekHeight: number;
  /** Depth offset (-0.035 = embedded into face .. +0.045 = lifted off face) */
  depthOffset: number;
  /** Vertical offset (-0.05 .. +0.05 m) */
  offsetY: number;
  /** Forward/back offset (-0.04 .. +0.04 m) */
  offsetZ: number;
}

export type CharacterSideburnsStyle =
  | 'none'
  | 'shortNeat'
  | 'pointed'
  | 'flared'
  | 'muttonChops'
  | 'connectedFull';

export interface CharacterSideburnsConfig {
  style: CharacterSideburnsStyle;
  /** Extend upper root seamlessly into the temple/hairline */
  connectToHair: boolean;
  /** Curve lower sweep along jawline seamlessly into beard */
  connectToBeard: boolean;
  /** Vertical length down cheek/jaw (0.25 .. 1.7) */
  length: number;
  /** Width across cheek (0.3 .. 2.0) */
  width: number;
  /** Strand layer thickness (0.35 .. 2.0) */
  thickness: number;
  /** Outward tip flare / chop bushiness (-0.4 .. +1.0) */
  flare: number;
  /** Depth offset (-0.035 = embedded into face .. +0.045 = lifted off face) */
  depthOffset: number;
  /** Vertical offset (-0.04 .. +0.04 m) */
  offsetY: number;
  /** Forward/back offset (-0.04 .. +0.04 m) */
  offsetZ: number;
}

export type CharacterStubbleStyle =
  | 'none'
  | 'fiveOClock'
  | 'designer'
  | 'goatee'
  | 'mustache'
  | 'chinJaw'
  | 'fullHeavy';

export interface CharacterStubbleConfig {
  style: CharacterStubbleStyle;
  /** Painted-on skin shading opacity (0 .. 1) */
  opacity: number;
  /** Follicle grain / texture intensity (0 .. 1) */
  density: number;
  /** Softness of edge feathering (0.1 .. 1.0) */
  softness: number;
  /** Cheek coverage height (0 = low jaw .. 1 = high cheek) */
  cheekHeight: number;
  /** Custom stubble color override */
  color: string;
}

export interface CharacterFacialHairConfig {
  /** Base facial hair color */
  color: string;
  /** Optional subtle highlight/tip color */
  accentColor: string;
  /** Link facial hair color directly to head hairColor */
  matchHairColor: boolean;
  /** Global facial hair depth offset (-0.035 = embedded into face .. +0.045 = lifted off face) */
  depthOffset: number;
  mustache: CharacterMustacheConfig;
  beard: CharacterBeardConfig;
  sideburns: CharacterSideburnsConfig;
  stubble: CharacterStubbleConfig;
}

// ============================================================================
// Quadruped / Multi-Legged Animal & Fantastical Monster Builder
// ============================================================================

export type MonsterHeadStyle = 'wolf' | 'dragon' | 'demon' | 'dino' | 'fluffy' | 'spider';
export type MonsterHornStyle =
  | 'none'
  | 'twinHorns'
  | 'ramCurl'
  | 'stagAntlers'
  | 'crownSpikes'
  | 'rhinoHorn'
  | 'unicorn'
  | 'devilSweep'
  | 'crystalCrown';
export type MonsterEarStyle =
  | 'none'
  | 'wolfPerk'
  | 'foxTall'
  | 'bearRound'
  | 'floppy'
  | 'batFin'
  | 'frill';
export type MonsterWingStyle =
  | 'none'
  | 'dragonBat'
  | 'feathered'
  | 'fairyInsect'
  | 'wyvern'
  | 'elementalEnergy';
export type MonsterTailStyle =
  | 'none'
  | 'bushy'
  | 'dragonSpiked'
  | 'club'
  | 'stinger'
  | 'shortStub'
  | 'whip'
  | 'bladeFin'
  | 'twinFork';
export type MonsterPawStyle = 'paw' | 'claw' | 'hoof' | 'talon' | 'arachnid' | 'stump';
export type MonsterSpikeStyle =
  | 'boneSpikes'
  | 'dorsalFins'
  | 'crystalSpines'
  | 'armoredPlates'
  | 'maneTufts';
export type MonsterRole = 'baddie' | 'npc' | 'buddy';
export type CreatureExpressionMood = 'closed' | 'open' | 'angry' | 'happy' | 'shy';

export type MonsterPartKey =
  | 'chest'
  | 'torso'
  | 'hips'
  | 'belly'
  | 'neck'
  | 'head'
  | 'muzzle'
  | 'nose'
  | 'mouth'
  | 'teeth'
  | 'eyes'
  | 'eyebrows'
  | 'ears'
  | 'horns'
  | 'frontLegs'
  | 'rearLegs'
  | 'midLegs'
  | 'wings'
  | 'tail'
  | 'spikes'
  | 'coat'
  | 'combat';

export type MonsterAttackType =
  | 'clawSlash'
  | 'groundPound'
  | 'tailSmash'
  | 'chargeGore'
  | 'sonicRoar'
  | 'fireBreath'
  | 'iceBreath'
  | 'waterJet'
  | 'electricShock'
  | 'poisonSpit'
  | 'shadowBeam'
  | 'solarBeam';

export type MonsterAbilityId =
  | 'none'
  | 'intimidate'
  | 'thickFat'
  | 'flameBody'
  | 'staticShell'
  | 'swiftStride'
  | 'galeWings'
  | 'berserk'
  | 'regenerator';

export type BaddieDetectionMode = 'spatial' | 'sight' | 'both';
export type BaddiePatrolPattern = 'pace' | 'wander' | 'orbit' | 'circuit' | 'guard';
export type BaddieFlightPattern = 'hover' | 'circle' | 'figure8' | 'swoop';
export type BaddieWindupClueStyle = 'auto' | 'headSway3' | 'footMarch' | 'wingFlare' | 'crouchPounce';
export type BaddieHeroEffectKind = 'none' | 'knockdown' | 'burn' | 'freeze' | 'shock' | 'poison' | 'soak' | 'stun';
export type HeroStatusEffectKind = 'burn' | 'freeze' | 'shock' | 'poison' | 'soak';

export interface BaddieAIConfig {
  detectionMode: BaddieDetectionMode;
  aggroRange: number;
  sightAngleDeg: number;
  territoryRadius: number;
  patrolPattern: BaddiePatrolPattern;
  flightPattern: BaddieFlightPattern;
  flightAltitude: number;
  hoverAttackHeight: number;
  landAfterAirAttack?: boolean; // when true, flying baddies perform 1 air attack, hover briefly, then land before attacking again
  windupClueStyle?: BaddieWindupClueStyle;
  canFly?: boolean;
  varietyFactor: number; // 0..1 randomness in attack choice, cadence & approach
  primaryAction: MonsterAttackType;
  secondaryAction: MonsterAttackType;
  actionPool?: MonsterAttackType[];
  bossRewardCoins?: number;
  bossRewardItems?: string[];
}

export interface MonsterSegmentProfile {
  startRadius: number;
  midRadius: number;
  endRadius: number;
  curvature: number;
  length: number;
  squashX: number;
  squashZ: number;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  blendScale: number;
  color: string;
}

export interface MonsterLegPairConfig {
  upper: MonsterSegmentProfile;
  lower: MonsterSegmentProfile;
  hipSpreadX: number;
  hipOffsetY: number;
  hipOffsetZ: number;
  stanceAngleDeg: number;
  kneeBendDeg: number;
  spiderSplay: number;
  pawStyle: MonsterPawStyle;
  pawScale: number;
  clawColor: string;
}

export interface MonsterMuzzleConfig {
  enabled: boolean;
  length: number;
  width: number;
  height: number;
  taper: number;
  splitCleft: number;
  fangSize: number;
  nostrils: boolean;
  tiltDeg: number;
  offsetY: number;
  offsetZ: number;
  blendScale: number;
  color: string;
}

export type MonsterNoseStyle = 'none' | 'round' | 'oval' | 'triangle' | 'snoutPad' | 'nostrilsOnly';

export interface MonsterNoseConfig {
  enabled: boolean;
  style: MonsterNoseStyle;
  width: number;
  height: number;
  depth3D: number; // 0.06 (flat conformed) .. 1.3 (full 3D)
  shine: number;
  showNostrils: boolean;
  nostrilScale: number;
  posX: number;
  posY: number;
  posZ: number;
  embed: number;
  tiltDeg: number;
  color: string;
  nostrilColor: string;
}

export interface MonsterMouthConfig {
  mood: CreatureExpressionMood;
  mouthOpen: number;
  smileCurve: number;
  width: number;
  lipThickness: number;
  tongueVisible: boolean;
  tongueStickOut?: number;
  tongueColor: string;
  interiorColor: string;
  lipColor: string;
  blushColor: string;
  offsetY: number;
  offsetZ: number;
}

export type MonsterTeethStyle = 'none' | 'strips' | 'canine' | 'stripsAndCanine' | 'buck';

export interface MonsterTeethConfig {
  style: MonsterTeethStyle;
  sharpness: number; // 0 = dull rounded, 1 = sharp pointed
  size: number;
  spreadX: number;
  showTop: boolean;
  showBottom: boolean;
  topOffsetY: number;
  bottomOffsetY: number;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  color: string;
}

export interface MonsterEyebrowsConfig {
  enabled: boolean;
  mood: CreatureExpressionMood;
  width: number;
  thickness: number;
  arch: number;
  tiltDeg: number;
  spacing: number;
  height: number;
  color: string;
}

export interface MonsterEarsConfig {
  style: MonsterEarStyle;
  size: number;
  thickness?: number;
  softness?: number;
  tiltDeg: number;
  spreadDeg: number;
  offsetY: number;
  offsetZ: number;
  color: string;
  innerColor: string;
}

export interface MonsterEyesConfig {
  count: 1 | 2 | 3 | 4 | 6 | 8;
  pupilStyle: CharacterEyePupilStyle;
  size: number;
  aspectX: number;
  aspectY: number;
  flatness: number;
  spacing: number;
  height: number;
  depthOffset: number;
  eyelidRest: number;
  scleraColor: string;
  irisColor: string;
  pupilColor: string;
  glowEmissive: number;
}

export interface MonsterHornsConfig {
  length: number;
  thickness: number;
  softness?: number;
  sweepDeg: number;
  spreadX: number;
  offsetY: number;
  offsetZ: number;
  color: string;
}

export interface MonsterWingsConfig {
  span: number;
  chordWidth: number;
  sweepBackDeg: number;
  liftDeg: number;
  foldDeg: number;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  ribCount: number;
  membraneOpacity?: number;
  wingColor: string;
  boneColor: string;
  tipColor: string;
}

export interface MonsterSpikesConfig {
  enabled: boolean;
  style: MonsterSpikeStyle;
  count: number;
  length: number;
  thickness: number;
  softness?: number;
  sinkDepth?: number;
  sweepDeg: number;
  startFrac: number;
  endFrac: number;
  color: string;
  tipColor: string;
}

export interface OrthogonalStroke {
  strokes?: { x: number; y: number }[][];
  points?: { x: number; y: number }[];
  softness: number; // 0..1
}

export interface MonsterSketchProfiles {
  enabled: boolean;
  part: 'body' | 'head' | 'frontLeg' | 'rearLeg' | 'arm' | 'wings';
  sideStroke: OrthogonalStroke;
  frontStroke: OrthogonalStroke;
  topStroke: OrthogonalStroke;
  mirrorLimbs: boolean;
}

export interface MonsterSculptSample {
  /** Base rest-pose position [x, y, z] in MonsterRoot local space */
  p: [number, number, number];
  /** Displacement delta [dx, dy, dz] */
  d: [number, number, number];
  /** Optional painted RGB color [r, g, b] in 0..1 */
  c?: [number, number, number];
}

export interface MonsterSculptSparseDelta {
  i: number;
  d: [number, number, number];
}

export interface MonsterSculptSparseColor {
  i: number;
  c: [number, number, number];
}

export interface MonsterSculptBoneOffset {
  boneName: string;
  delta: [number, number, number];
}

export interface MonsterSculptData {
  enabled: boolean;
  resolution: number;
  vertexCount: number;
  sparseDeltas: MonsterSculptSparseDelta[];
  sparseColors?: MonsterSculptSparseColor[];
  samples: MonsterSculptSample[];
  boneOffsets?: MonsterSculptBoneOffset[];
}

export interface MonsterBlueprint {
  id: string;
  name: string;
  presetId?: string;
  role: MonsterRole;
  /** Number of leg pairs: 2 = 4 legs, 3 = 6 legs, 4 = 8 legs */
  legPairs: 2 | 3 | 4;
  /** Number of heads: 1, 2, or 3 */
  headCount: 1 | 2 | 3;
  headStyle: MonsterHeadStyle;
  hornStyle: MonsterHornStyle;
  wingStyle: MonsterWingStyle;
  canFly: boolean;
  tailStyle: MonsterTailStyle;
  spineSpikes: boolean;
  bodyLength: number; // 0.75..1.65
  bodyWidth: number; // 0.75..1.55
  legHeight: number; // 0.65..1.55
  scale: number; // 0.65..2.2
  bodyColor: string;
  bellyColor: string;
  accentColor: string;
  eyeColor: string;
  wingColor: string;
  isBoss?: boolean;
  speed?: number;
  health?: number;
  dialogue?: string;

  /** Organic SDF Clay & Comprehensive Body Part Controls */
  materialFinish?: CharacterMaterialFinish;
  blendSmoothness?: number;
  chest?: MonsterSegmentProfile;
  torso?: MonsterSegmentProfile & { archY: number };
  hips?: MonsterSegmentProfile;
  belly?: MonsterSegmentProfile & { enabled: boolean };
  neck?: MonsterSegmentProfile & { segments: number; pitchDeg: number; spreadDeg: number };
  head?: MonsterSegmentProfile & {
    crownHeight: number;
    browFierce: number;
    jawWidth: number;
    jawDrop: number;
    craniumTiltDeg: number;
  };
  muzzle?: MonsterMuzzleConfig;
  nose?: MonsterNoseConfig;
  mouth?: MonsterMouthConfig;
  teeth?: MonsterTeethConfig;
  eyes?: MonsterEyesConfig;
  eyebrows?: MonsterEyebrowsConfig;
  ears?: MonsterEarsConfig;
  horns?: MonsterHornsConfig;
  frontLegs?: MonsterLegPairConfig;
  rearLegs?: MonsterLegPairConfig;
  midLegs?: MonsterLegPairConfig;
  wings?: MonsterWingsConfig;
  tail?: MonsterSegmentProfile & { segments: number; curlUp: number; tipScale: number; tipColor: string };
  spikes?: MonsterSpikesConfig;
  surfaceCoat?: CharacterSurfaceCoatConfig;

  /** 3D Orthogonal Sketch Extrusion Profiles (legacy) */
  sketchProfiles?: Record<string, MonsterSketchProfiles>;
  /** 3D Clay Sculpt & Texture Stamp Data */
  sculptData?: MonsterSculptData;

  /** Pokemon-style Special Attacks & Passive Abilities */
  primaryAttack?: MonsterAttackType;
  secondaryAttack?: MonsterAttackType;
  specialAbility?: MonsterAbilityId;
  attackPower?: number;
  attackRange?: number;
  attackCooldown?: number;
  /** Extensible AI behavior, territory, flight pattern & action library overrides */
  baddieAI?: BaddieAIConfig;
  /** Custom authored motion presets & slot overrides assigned directly to this monster/boss */
  customAnimations?: CustomMotionPreset[];
  defaultSlotPresets?: Partial<Record<CustomClipSlot, string>>;
}

export type HeroAffinityRating = -2 | -1 | 0 | 1 | 2;

export type HeroSkillId =
  | 'powerStrike'
  | 'swiftFootwork'
  | 'mountainClimber'
  | 'aquaLung'
  | 'ironResolve'
  | 'elementalWard'
  | 'giantSlayer'
  | 'acrobat'
  | 'frostBitten'
  | 'heatExhausted'
  | 'heavyArmorClumsy'
  | 'glassCannon';

export interface HeroStatsConfig {
  maxHealth: number; // 3..20
  baseAttack: number; // 1..8
  baseDefense: number; // 0..5
  moveSpeedMult: number; // 0.65..1.5
  jumpPowerMult: number; // 0.75..1.45
  staminaMax: number; // 60..160
  staminaRegenMult: number; // 0.6..1.8
  magicPower: number; // 1..8
  dodgeInvulnMult: number; // 0.7..1.5
}

export interface HeroTerrainAffinities {
  grassland: HeroAffinityRating;
  sandAndCoast: HeroAffinityRating;
  rockAndAlpine: HeroAffinityRating;
  mudAndSwamp: HeroAffinityRating;
  snowAndIce: HeroAffinityRating;
  waterAndSwim: HeroAffinityRating;
}

export interface HeroTemperatureProfile {
  preferredTemp: 'cold' | 'temperate' | 'warm';
  coldResistance: HeroAffinityRating;
  heatResistance: HeroAffinityRating;
}

export interface HeroEnemyMatchups {
  bosses: HeroAffinityRating;
  flying: HeroAffinityRating;
  beasts: HeroAffinityRating;
  elemental: HeroAffinityRating;
  heavyBrutes: HeroAffinityRating;
}

export interface HeroEnvironmentAffinities {
  openWilds: HeroAffinityRating;
  underground: HeroAffinityRating;
  stormAndRain: HeroAffinityRating;
  nightAndShadow: HeroAffinityRating;
  highAltitude: HeroAffinityRating;
}

export interface HeroProfileConfig {
  archetype?: string;
  bio?: string;
  stats: HeroStatsConfig;
  skills: HeroSkillId[];
  terrain: HeroTerrainAffinities;
  temperature: HeroTemperatureProfile;
  enemies: HeroEnemyMatchups;
  environments: HeroEnvironmentAffinities;
}




