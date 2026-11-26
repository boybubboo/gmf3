// Universal Motion Studio, Rigging & Animation Types

export type CustomClipSlot =
  | 'idle'
  | 'walk'
  | 'run'
  | 'jump'
  | 'swim'
  | 'attack'
  | 'interact'
  | 'sit'
  | 'hold'
  | 'swing'
  | 'throw'
  | 'sleep'
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
  | 'bowPull'
  | 'hug'
  | 'punch'
  | 'kick'
  // Hero defense, combat reactions & celebration
  | 'block'
  | 'parry'
  | 'knockdown'
  | 'getUp'
  | 'hurt'
  | 'die'
  | 'celebrate'
  | 'wave'
  | 'dance'
  // NPC & Buddy expressions / misfit skills
  | 'talk'
  | 'laugh'
  | 'cheer'
  | 'shy'
  | 'grumpy'
  | 'misfitPower'
  // Enemies, Flyers & Bosses (windup clues, attacks, reactions & death)
  | 'fly'
  | 'windup_headSway3'
  | 'windup_footMarch'
  | 'windup_wingFlare'
  | 'windup_crouchPounce'
  | 'fireBreath'
  | 'iceBreath'
  | 'waterJet'
  | 'electricShock'
  | 'poisonSpit'
  | 'shadowBeam'
  | 'solarBeam'
  | 'groundPound'
  | 'clawSlash'
  | 'tailSmash'
  | 'chargeGore'
  | 'sonicRoar'
  | 'stagger'
  | 'dying';

export type MotionActorCategory = 'hero' | 'npc' | 'buddy' | 'enemy';

export type MotionRigArchetype = 'humanoid' | 'critter' | 'quadruped' | 'baddie';

export type MotionEventKind =
  | 'windupLock'
  | 'impactStart'
  | 'impactEnd'
  | 'footstep'
  | 'grounded'
  | 'impact'
  | 'recover'
  | 'collapse'
  | 'custom';

export interface MotionEventMarker {
  id: string;
  time: number; // normalized [0, 1]
  kind: MotionEventKind;
  label?: string;
}

export type MotionFitWarningCode =
  | 'tooLong'
  | 'tooShort'
  | 'floorClip'
  | 'extremeAngle'
  | 'boneMismatch'
  | 'missingOptionalPart'
  | 'loopSeamJump';

export interface MotionFitWarning {
  code: MotionFitWarningCode;
  severity: 'info' | 'caution';
  message: string;
}

export interface MotionFitReport {
  status: 'safe' | 'caution';
  warnings: MotionFitWarning[];
  matchedBoneCount: number;
  totalPresetBones: number;
  loopSeamDeg: number;
}

export type CreatureBodyId =
  | 'Skunk'
  | 'Porcupine'
  | 'Mole Rat'
  | 'Vulture'
  | 'Duckling'
  | 'Squirrel'
  | 'Badger'
  | 'Owl';

export type MotionActorTarget =
  | { kind: 'builtInHero'; category: 'hero'; label: string }
  | { kind: 'customAsset'; category: MotionActorCategory; assetId: string; label: string }
  | { kind: 'proceduralNpc'; category: 'npc'; entityId?: string; label: string }
  | { kind: 'buddyCritter'; category: 'buddy'; creatureType: CreatureBodyId; entityId?: string; label: string }
  | { kind: 'proceduralBaddie'; category: 'enemy'; variant: 'ground' | 'flyer' | 'boss'; entityId?: string; label: string }
  | { kind: 'monsterBlueprint'; category: 'enemy'; monsterId: string; entityId?: string; label: string };

export type MotionAssignmentScope =
  | 'heroDefault'
  | 'npcDefault'
  | 'buddyDefault'
  | 'baddieDefault'
  | 'monsterBlueprint'
  | 'entityOverride'
  | 'customAsset';

export type RigBoneRole =
  | 'hips'
  | 'spine'
  | 'chest'
  | 'neck'
  | 'head'
  | 'leftShoulder'
  | 'leftUpperArm'
  | 'leftLowerArm'
  | 'leftHand'
  | 'rightShoulder'
  | 'rightUpperArm'
  | 'rightLowerArm'
  | 'rightHand'
  | 'leftUpperLeg'
  | 'leftLowerLeg'
  | 'leftFoot'
  | 'rightUpperLeg'
  | 'rightLowerLeg'
  | 'rightFoot';

export type RigAnimationMode = 'auto' | 'clips' | 'procedural';

export type RigSwingAxis = 'auto' | 'x' | '-x' | 'y' | '-y' | 'z' | '-z';

export interface SlotMotionTuning {
  speedMultiplier: number;
  strideLength: number;
  kneeBend: number;
  armSwing: number;
  armSideOffsetDeg: number;
  bounce: number;
  torsoLean: number;
}

export interface CustomRigSettings {
  mode: RigAnimationMode;
  boneMap: Partial<Record<RigBoneRole, string>>;
  invertedRoles?: Partial<Record<RigBoneRole, boolean>>;
  limbSwingAxis: RigSwingAxis;
  armRelaxAngle: number;
  armSpreadAngle: number;
  idleArmSpreadAngle: number;
  mirrorArmRelax: boolean;
  mirrorLimbSwing: boolean;
  motionStrength: number;
  headMotion: number;
  facingOffsetDeg: number;
  armRelaxAutoVersion?: number;
  slotTuning?: Partial<Record<CustomClipSlot, Partial<SlotMotionTuning>>>;
}

export type MotionEasing = 'linear' | 'smooth' | 'easeIn' | 'easeOut' | 'elastic';

/** Character-space Euler delta angles [rxDeg, ryDeg, rzDeg] relative to a bone's rest pose */
export type BonePoseAngles = [number, number, number];

export interface CustomPoseKeyframe {
  id: string;
  /** Normalized timeline position in [0, 1] */
  time: number;
  /** Map of boneName -> [rxDeg, ryDeg, rzDeg] character-space delta angles */
  bones: Record<string, BonePoseAngles>;
  /** Optional vertical hips bounce offset in model units */
  hipsOffsetY?: number;
  /** Optional per-segment easing override from this keyframe to the next */
  easing?: MotionEasing;
}

export interface CustomMotionPreset {
  id: string;
  name: string;
  slot: CustomClipSlot;
  duration: number;
  loop: boolean;
  autoCloseLoop?: boolean;
  easing: MotionEasing;
  keyframes: CustomPoseKeyframe[];
  updatedAt: string;
  /** Optional Universal Motion Studio provenance & retargeting metadata */
  actorCategory?: MotionActorCategory;
  rigArchetype?: MotionRigArchetype;
  hipsHeightRef?: number;
  sourcePresetId?: string;
  sourceType?: 'builtin' | 'custom' | 'ai' | 'mixamo';
  events?: MotionEventMarker[];
}

export interface SavedPosePreset {
  id: string;
  name: string;
  /** Map of boneName -> [rxDeg, ryDeg, rzDeg] character-space delta angles */
  bones: Record<string, BonePoseAngles>;
  /** Vertical hips bounce offset in model units */
  hipsOffsetY: number;
  /** Captured studio 3D thumbnail data URL */
  thumbnailDataUrl?: string;
  createdAt: string;
}
