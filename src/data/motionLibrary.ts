import type {
  BonePoseAngles,
  CharacterInteractionMotionId,
  CustomClipSlot,
  CustomMotionPreset,
  CustomPoseKeyframe,
  MotionActorCategory,
  MotionEasing,
  MotionEventMarker,
  MotionRigArchetype,
  ObjectInteractionAttributeId,
  ObjectInteractionCalibration,
} from '../types/maker';
import { uid } from '../utils/terrain';

export interface ObjectInteractionAttrDef {
  id: ObjectInteractionAttributeId;
  label: string;
  shortLabel: string;
  description: string;
  clipSlot: CustomClipSlot;
  defaultCalibration: ObjectInteractionCalibration;
}

export const OBJECT_INTERACTION_ATTRIBUTES: ObjectInteractionAttrDef[] = [
  {
    id: 'sit',
    label: 'Sit (Chair / Log / Rock / Stump)',
    shortLabel: 'Sit',
    description: 'Player can press Use in front of it to turn around and sit down to recover Energy.',
    clipSlot: 'sit',
    defaultCalibration: { offset: [0, 0.42, 0.22], yawDeg: 0 },
  },
  {
    id: 'hold',
    label: 'Hold / Carry',
    shortLabel: 'Hold',
    description: 'Character grips and carries the item cleanly in hand.',
    clipSlot: 'hold',
    defaultCalibration: { offset: [0.3, 0.85, 0.35], yawDeg: 0 },
  },
  {
    id: 'swing',
    label: 'Swing (Axe / Sword / Tool)',
    shortLabel: 'Swing',
    description: 'Wide forehand right-hand swing with elbow wind-up.',
    clipSlot: 'swing',
    defaultCalibration: { offset: [0, 0, 1.05], yawDeg: 0 },
  },
  {
    id: 'throw',
    label: 'Throw',
    shortLabel: 'Throw',
    description: 'Overhand wind-up and forward release.',
    clipSlot: 'throw',
    defaultCalibration: { offset: [0, 0, 1.1], yawDeg: 0 },
  },
  {
    id: 'sleep',
    label: 'Sleep / Lie Down',
    shortLabel: 'Sleep',
    description: 'Recline horizontally on a bed, mat, or camp roll.',
    clipSlot: 'sleep',
    defaultCalibration: { offset: [0, 0.45, 0], yawDeg: 90 },
  },
  {
    id: 'jump',
    label: 'Jump / Spring',
    shortLabel: 'Jump',
    description: 'Vertical leap or springboard launch motion.',
    clipSlot: 'jump',
    defaultCalibration: { offset: [0, 0.5, 0], yawDeg: 0 },
  },
  {
    id: 'fishing',
    label: 'Fishing',
    shortLabel: 'Fishing',
    description: 'Cast line, wait on dock/bank, and reel in.',
    clipSlot: 'fishing',
    defaultCalibration: { offset: [0, 0, -0.9], yawDeg: 0 },
  },
  {
    id: 'lift',
    label: 'Lift Heavy Object',
    shortLabel: 'Lift',
    description: 'Bend knees and hoist overhead or chest-high.',
    clipSlot: 'lift',
    defaultCalibration: { offset: [0, 0, -0.75], yawDeg: 0 },
  },
  {
    id: 'pull',
    label: 'Pull (Lever / Crate / Rope)',
    shortLabel: 'Pull',
    description: 'Lean back with both hands gripping and drawing inward.',
    clipSlot: 'pull',
    defaultCalibration: { offset: [0, 0, -0.82], yawDeg: 0 },
  },
  {
    id: 'push',
    label: 'Push (Block / Crate / Cart)',
    shortLabel: 'Push',
    description: 'Brace forward with both palms pressed against surface.',
    clipSlot: 'push',
    defaultCalibration: { offset: [0, 0, -0.82], yawDeg: 0 },
  },
  {
    id: 'dig',
    label: 'Dig (Shovel / Pick)',
    shortLabel: 'Dig',
    description: 'Two-handed downward scoop and earth-toss cycle.',
    clipSlot: 'dig',
    defaultCalibration: { offset: [0, 0, -0.85], yawDeg: 0 },
  },
  {
    id: 'climbVertical',
    label: 'Climb Up / Down (Ladder / Tree / Cliff)',
    shortLabel: 'Climb Vertical',
    description: 'Alternating hand-over-hand & knee drive vertical climb.',
    clipSlot: 'climbVertical',
    defaultCalibration: { offset: [0, 0.2, -0.62], yawDeg: 0 },
  },
  {
    id: 'climbStairs',
    label: 'Climb Stairs (Up / Down)',
    shortLabel: 'Climb Stairs',
    description: 'Higher-knee stair stepping gait for stairs and ramps.',
    clipSlot: 'climbStairs',
    defaultCalibration: { offset: [0, 0.35, 0], yawDeg: 0 },
  },
  {
    id: 'crouch',
    label: 'Crouch / Inspect Low',
    shortLabel: 'Crouch',
    description: 'Lowered stance with bent knees for low passages or inspection.',
    clipSlot: 'crouch',
    defaultCalibration: { offset: [0, 0, -0.75], yawDeg: 0 },
  },
  {
    id: 'sneak',
    label: 'Sneak / Creep',
    shortLabel: 'Sneak',
    description: 'Quiet low-profile crouched tip-toe walk past objects.',
    clipSlot: 'sneak',
    defaultCalibration: { offset: [0, 0, -0.85], yawDeg: 0 },
  },
  {
    id: 'stab',
    label: 'Stab / Thrust',
    shortLabel: 'Stab',
    description: 'Direct forward lunge and weapon thrust.',
    clipSlot: 'stab',
    defaultCalibration: { offset: [0, 0, -1.05], yawDeg: 0 },
  },
  {
    id: 'bowPull',
    label: 'Pull Bowstring',
    shortLabel: 'Bow Pull',
    description: 'Left arm extended aiming forward while right hand draws bowstring.',
    clipSlot: 'bowPull',
    defaultCalibration: { offset: [0, 0, -1.0], yawDeg: 0 },
  },
];

export const OBJECT_ATTRIBUTE_BY_ID: Record<
  ObjectInteractionAttributeId,
  ObjectInteractionAttrDef
> = OBJECT_INTERACTION_ATTRIBUTES.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<ObjectInteractionAttributeId, ObjectInteractionAttrDef>
);

export function getClipSlotForObjectAttribute(
  attr: ObjectInteractionAttributeId
): CustomClipSlot {
  return OBJECT_ATTRIBUTE_BY_ID[attr]?.clipSlot ?? 'interact';
}

export interface CharacterInteractionMotionDef {
  id: CharacterInteractionMotionId;
  clipSlot: CustomClipSlot;
  label: string;
  description: string;
}

export const CHARACTER_INTERACTION_MOTIONS: CharacterInteractionMotionDef[] = [
  {
    id: 'hug',
    clipSlot: 'hug',
    label: 'Hug (Character Interaction)',
    description: 'Warm forward lean with both arms wrapping around a friend.',
  },
  {
    id: 'punch',
    clipSlot: 'punch',
    label: 'Punch (Character Interaction)',
    description: 'Crisp cross-body right fist strike with guard left hand.',
  },
  {
    id: 'push',
    clipSlot: 'push',
    label: 'Push (Character / Object)',
    description: 'Two-handed forward shove stance.',
  },
  {
    id: 'kick',
    clipSlot: 'kick',
    label: 'Kick (Character Interaction)',
    description: 'Balanced high front snap kick.',
  },
];

export interface StandardMotionSlotOption {
  slot: CustomClipSlot;
  label: string;
  group: 'core' | 'object' | 'character';
  hint: string;
}

export const STANDARD_MOTION_SLOTS: StandardMotionSlotOption[] = [
  { slot: 'idle', label: 'Idle (Stand)', group: 'core', hint: 'Default standing breathing stance' },
  { slot: 'walk', label: 'Walk Cycle', group: 'core', hint: 'Balanced walking gait' },
  { slot: 'run', label: 'Run Cycle', group: 'core', hint: 'Energetic sprint cycle' },
  { slot: 'jump', label: 'Jump', group: 'core', hint: 'Airborne leap / springboard jump' },
  { slot: 'swim', label: 'Swim', group: 'core', hint: 'Water stroke and kick' },
  { slot: 'attack', label: 'Attack (Sword Swing)', group: 'core', hint: 'Primary forehand melee strike' },
  { slot: 'block', label: 'Shield Lift (Block)', group: 'core', hint: 'Hold shield up defensively in front of torso' },
  { slot: 'interact', label: 'Interact / Wave', group: 'core', hint: 'General hand wave / use emote' },
  // Object interactions
  { slot: 'sit', label: 'Sit', group: 'object', hint: 'Seated hip & knee bend for chairs, logs, rocks, stumps' },
  { slot: 'hold', label: 'Hold / Carry', group: 'object', hint: 'Grip pose for held items' },
  { slot: 'swing', label: 'Swing Tool (Axe)', group: 'object', hint: 'Forehand axe or heavy tool swing' },
  { slot: 'throw', label: 'Throw', group: 'object', hint: 'Overhand wind-up & release' },
  { slot: 'sleep', label: 'Sleep / Lie Down', group: 'object', hint: 'Reclined rest pose' },
  { slot: 'fishing', label: 'Fishing', group: 'object', hint: 'Cast and hold fishing rod' },
  { slot: 'lift', label: 'Lift', group: 'object', hint: 'Hoist crate or rock upward' },
  { slot: 'pull', label: 'Pull', group: 'object', hint: 'Lean back pulling rope or lever' },
  { slot: 'push', label: 'Push', group: 'object', hint: 'Two-handed forward push (objects & characters)' },
  { slot: 'dig', label: 'Dig', group: 'object', hint: 'Shovel plunge and earth toss' },
  { slot: 'climbVertical', label: 'Climb Vertical', group: 'object', hint: 'Climb ladders, trees, and rockfaces' },
  { slot: 'climbStairs', label: 'Climb Stairs', group: 'object', hint: 'High-step ascending/descending stairs' },
  { slot: 'crouch', label: 'Crouch', group: 'object', hint: 'Low crouched stance' },
  { slot: 'sneak', label: 'Sneak', group: 'object', hint: 'Stealthy low creep cycle' },
  { slot: 'stab', label: 'Stab / Thrust', group: 'object', hint: 'Forward lunge weapon thrust' },
  { slot: 'bowPull', label: 'Pull Bowstring', group: 'object', hint: 'Aiming bow and drawing string back' },
  // Character-to-character interactions
  { slot: 'hug', label: 'Hug', group: 'character', hint: 'Warm two-armed embrace' },
  { slot: 'punch', label: 'Punch', group: 'character', hint: 'Quick right-hand punch' },
  { slot: 'kick', label: 'Kick', group: 'character', hint: 'Front snap kick' },
];

export type MotionSlotRoleCategory = 'locomotion' | 'combat' | 'windup' | 'reaction' | 'social' | 'object';

export interface MotionSlotMetadata {
  slot: CustomClipSlot;
  label: string;
  roleCategory: MotionSlotRoleCategory;
  categories: MotionActorCategory[];
  recommendedDurationSec: [number, number];
  defaultDuration: number;
  loop: boolean;
  description: string;
}

export const MOTION_SLOT_METADATA: MotionSlotMetadata[] = [
  // Shared locomotion
  { slot: 'idle', label: 'Idle / Breathing Stance', roleCategory: 'locomotion', categories: ['hero', 'npc', 'buddy', 'enemy'], recommendedDurationSec: [1.0, 3.6], defaultDuration: 2.0, loop: true, description: 'Calm alert breathing & subtle head look.' },
  { slot: 'walk', label: 'Walk Cycle', roleCategory: 'locomotion', categories: ['hero', 'npc', 'buddy', 'enemy'], recommendedDurationSec: [0.55, 1.5], defaultDuration: 0.9, loop: true, description: 'Balanced stride with counter-swinging limbs.' },
  { slot: 'run', label: 'Run / Charge Cycle', roleCategory: 'locomotion', categories: ['hero', 'npc', 'buddy', 'enemy'], recommendedDurationSec: [0.35, 1.05], defaultDuration: 0.62, loop: true, description: 'Energetic forward sprint or bounding gallop.' },
  { slot: 'jump', label: 'Jump / Leap', roleCategory: 'locomotion', categories: ['hero', 'npc', 'buddy'], recommendedDurationSec: [0.45, 1.3], defaultDuration: 0.78, loop: false, description: 'Spring takeoff, mid-air tuck, and landing absorb.' },
  { slot: 'swim', label: 'Swim Stroke', roleCategory: 'locomotion', categories: ['hero', 'npc', 'buddy'], recommendedDurationSec: [0.6, 1.6], defaultDuration: 1.0, loop: true, description: 'Alternating water strokes and flutter kick.' },
  { slot: 'fly', label: 'Fly / Hover Flap', roleCategory: 'locomotion', categories: ['buddy', 'enemy'], recommendedDurationSec: [0.45, 1.4], defaultDuration: 0.78, loop: true, description: 'Sweeping aerial wingbeat hover for flying creatures.' },

  // Hero combat & defense
  { slot: 'attack', label: 'Sword Swing', roleCategory: 'combat', categories: ['hero', 'npc'], recommendedDurationSec: [0.32, 0.95], defaultDuration: 0.52, loop: false, description: 'Backswing windup into crisp forehand blade cleave.' },
  { slot: 'swing', label: 'Axe / Heavy Chop', roleCategory: 'combat', categories: ['hero', 'npc'], recommendedDurationSec: [0.4, 1.1], defaultDuration: 0.65, loop: false, description: 'Two-beat overhead & diagonal heavy tool chop.' },
  { slot: 'block', label: 'Shield Lift (Block)', roleCategory: 'combat', categories: ['hero'], recommendedDurationSec: [0.2, 1.6], defaultDuration: 0.8, loop: true, description: 'Raises left-arm shield across front guard with sword ready.' },
  { slot: 'parry', label: 'Shield Bash / Parry', roleCategory: 'combat', categories: ['hero'], recommendedDurationSec: [0.25, 0.75], defaultDuration: 0.45, loop: false, description: 'Snap shield forward to deflect incoming blows.' },
  { slot: 'stab', label: 'Forward Stab / Thrust', roleCategory: 'combat', categories: ['hero', 'npc'], recommendedDurationSec: [0.3, 0.85], defaultDuration: 0.52, loop: false, description: 'Quick lunge and forward point thrust.' },
  { slot: 'bowPull', label: 'Draw Bowstring', roleCategory: 'combat', categories: ['hero', 'npc'], recommendedDurationSec: [0.45, 1.4], defaultDuration: 0.85, loop: false, description: 'Sideways stance drawing string cleanly to cheek.' },
  { slot: 'throw', label: 'Overhand Throw', roleCategory: 'combat', categories: ['hero', 'npc'], recommendedDurationSec: [0.38, 1.0], defaultDuration: 0.65, loop: false, description: 'Wind-up and forward release arc.' },

  // Reactions & deaths
  { slot: 'knockdown', label: 'Knockdown + Bounce + Get Up', roleCategory: 'reaction', categories: ['hero', 'npc'], recommendedDurationSec: [0.9, 2.4], defaultDuration: 1.45, loop: false, description: 'Hero lands on rump after heavy ground pound, bounces once, and rises.' },
  { slot: 'getUp', label: 'Quick Recover / Get Up', roleCategory: 'reaction', categories: ['hero', 'npc'], recommendedDurationSec: [0.45, 1.3], defaultDuration: 0.75, loop: false, description: 'Push off ground back to combat footing.' },
  { slot: 'hurt', label: 'Hit Flinch / Recoil', roleCategory: 'reaction', categories: ['hero', 'npc', 'buddy'], recommendedDurationSec: [0.22, 0.7], defaultDuration: 0.42, loop: false, description: 'Sharp stagger recoil on taking damage.' },
  { slot: 'stagger', label: 'Monster Stagger', roleCategory: 'reaction', categories: ['enemy'], recommendedDurationSec: [0.35, 1.1], defaultDuration: 0.68, loop: false, description: 'Heavy backward recoil when struck by the hero.' },
  { slot: 'die', label: 'Hero / NPC Defeat', roleCategory: 'reaction', categories: ['hero', 'npc'], recommendedDurationSec: [0.9, 2.6], defaultDuration: 1.4, loop: false, description: 'Dramatic knee drop into defeated collapse.' },
  { slot: 'dying', label: 'Dragon / Monster Death', roleCategory: 'reaction', categories: ['enemy'], recommendedDurationSec: [1.1, 3.2], defaultDuration: 1.85, loop: false, description: 'Rears up in defeat, then rolls & collapses onto side with wings folded.' },

  // Social / NPC / Buddy emotes
  { slot: 'celebrate', label: 'Victory / Treasure Celebrate', roleCategory: 'social', categories: ['hero', 'npc', 'buddy', 'enemy'], recommendedDurationSec: [0.8, 2.5], defaultDuration: 1.35, loop: true, description: 'Jubilant hop and raised-arms victory cheer.' },
  { slot: 'wave', label: 'Friendly Wave', roleCategory: 'social', categories: ['hero', 'npc', 'buddy'], recommendedDurationSec: [0.7, 2.0], defaultDuration: 1.15, loop: true, description: 'Warm greeting wave with friendly head tilt.' },
  { slot: 'interact', label: 'Interact / Inspect', roleCategory: 'social', categories: ['hero', 'npc'], recommendedDurationSec: [0.45, 1.5], defaultDuration: 0.85, loop: false, description: 'Reach forward to pull levers, open chests, or talk.' },
  { slot: 'talk', label: 'Animated Chatting', roleCategory: 'social', categories: ['npc', 'hero'], recommendedDurationSec: [0.9, 2.8], defaultDuration: 1.5, loop: true, description: 'Expressive hand gestures and conversational head nods.' },
  { slot: 'laugh', label: 'Hearty Laugh', roleCategory: 'social', categories: ['npc', 'hero', 'buddy'], recommendedDurationSec: [0.7, 2.0], defaultDuration: 1.15, loop: true, description: 'Leaning chuckle bounce with jovial arm motion.' },
  { slot: 'dance', label: 'Island Victory Dance', roleCategory: 'social', categories: ['hero', 'npc', 'buddy'], recommendedDurationSec: [0.8, 2.4], defaultDuration: 1.3, loop: true, description: 'Rhythmic side-step groove with upbeat arm swings.' },
  { slot: 'cheer', label: 'Buddy Cheer', roleCategory: 'social', categories: ['buddy', 'npc', 'hero'], recommendedDurationSec: [0.65, 1.8], defaultDuration: 1.0, loop: true, description: 'Happy hop and wing/paw bounce.' },
  { slot: 'shy', label: 'Shy Tuck & Peek', roleCategory: 'social', categories: ['buddy', 'npc'], recommendedDurationSec: [0.8, 2.2], defaultDuration: 1.3, loop: true, description: 'Coy downward head tuck with hesitant side peek.' },
  { slot: 'grumpy', label: 'Grumpy Stomp / Hmph', roleCategory: 'social', categories: ['buddy', 'npc', 'enemy'], recommendedDurationSec: [0.7, 2.0], defaultDuration: 1.1, loop: true, description: 'Crossed stance with impatient shake and huff.' },
  { slot: 'misfitPower', label: 'Misfit Companion Power', roleCategory: 'combat', categories: ['buddy'], recommendedDurationSec: [0.6, 1.6], defaultDuration: 0.95, loop: false, description: 'Signature companion flare, spin, or battle cry.' },

  // Enemy windup clues & boss attacks
  { slot: 'windup_headSway3', label: '3x Head Sway Windup', roleCategory: 'windup', categories: ['enemy'], recommendedDurationSec: [0.7, 2.0], defaultDuration: 1.15, loop: false, description: 'Three rhythmic head sways followed by a sharp strike pullback.' },
  { slot: 'windup_footMarch', label: 'Foot March Windup', roleCategory: 'windup', categories: ['enemy'], recommendedDurationSec: [0.7, 2.0], defaultDuration: 1.15, loop: false, description: 'Alternating paw stomps in place before lunging.' },
  { slot: 'windup_wingFlare', label: 'Wing Flare Windup', roleCategory: 'windup', categories: ['enemy'], recommendedDurationSec: [0.7, 2.0], defaultDuration: 1.1, loop: false, description: 'Three wide wingbeat threat pulses rising to full arch.' },
  { slot: 'windup_crouchPounce', label: 'Crouch Pounce Coil', roleCategory: 'windup', categories: ['enemy'], recommendedDurationSec: [0.65, 1.9], defaultDuration: 1.05, loop: false, description: 'Low predatory coil swaying side to side before spring.' },
  { slot: 'fireBreath', label: 'Fire Breath Sweep', roleCategory: 'combat', categories: ['enemy'], recommendedDurationSec: [0.6, 1.8], defaultDuration: 1.05, loop: false, description: 'Jaw opens wide sweeping blazing breath arc side to side.' },
  { slot: 'iceBreath', label: 'Frost Breath Sweep', roleCategory: 'combat', categories: ['enemy'], recommendedDurationSec: [0.6, 1.8], defaultDuration: 1.05, loop: false, description: 'Sweeping freezing torrent breath.' },
  { slot: 'waterJet', label: 'Hydro Jet Surge', roleCategory: 'combat', categories: ['enemy'], recommendedDurationSec: [0.55, 1.7], defaultDuration: 0.95, loop: false, description: 'Braced high-pressure forward water blast.' },
  { slot: 'electricShock', label: 'Lightning Surge', roleCategory: 'combat', categories: ['enemy'], recommendedDurationSec: [0.55, 1.6], defaultDuration: 0.9, loop: false, description: 'Chest flare discharging crackling arc sweep.' },
  { slot: 'poisonSpit', label: 'Venom Volley', roleCategory: 'combat', categories: ['enemy'], recommendedDurationSec: [0.45, 1.4], defaultDuration: 0.8, loop: false, description: 'Snap head upward & forward spitting toxic glob.' },
  { slot: 'shadowBeam', label: 'Shadow Beam', roleCategory: 'combat', categories: ['enemy'], recommendedDurationSec: [0.65, 1.9], defaultDuration: 1.1, loop: false, description: 'Locked dark energy beam channel.' },
  { slot: 'solarBeam', label: 'Solar Flare Beam', roleCategory: 'combat', categories: ['enemy'], recommendedDurationSec: [0.65, 1.9], defaultDuration: 1.1, loop: false, description: 'Radiant beam sweep across target.' },
  { slot: 'groundPound', label: 'Ground Pound Slam', roleCategory: 'combat', categories: ['enemy'], recommendedDurationSec: [0.5, 1.4], defaultDuration: 0.85, loop: false, description: 'Rear up high and slam front limbs into the earth.' },
  { slot: 'clawSlash', label: 'Heavy Claw Slash', roleCategory: 'combat', categories: ['enemy'], recommendedDurationSec: [0.4, 1.2], defaultDuration: 0.68, loop: false, description: 'High front-paw swipe tearing across hero.' },
  { slot: 'tailSmash', label: 'Spinning Tail Smash', roleCategory: 'combat', categories: ['enemy'], recommendedDurationSec: [0.5, 1.4], defaultDuration: 0.85, loop: false, description: 'Coil body and whip tail segments across a wide arc.' },
  { slot: 'chargeGore', label: 'Horned Charge Gore', roleCategory: 'combat', categories: ['enemy'], recommendedDurationSec: [0.5, 1.5], defaultDuration: 0.88, loop: false, description: 'Lowered head bull-rush gore lunge.' },
  { slot: 'sonicRoar', label: 'Shockwave Sonic Roar', roleCategory: 'combat', categories: ['enemy'], recommendedDurationSec: [0.65, 1.8], defaultDuration: 1.05, loop: false, description: 'Heads skyward roaring with trembling chest and jaws wide.' },

  // Hero object & character interactions
  { slot: 'sit', label: 'Sit Down', roleCategory: 'object', categories: ['hero', 'npc'], recommendedDurationSec: [0.8, 2.5], defaultDuration: 1.4, loop: true, description: 'Relaxed seated idle.' },
  { slot: 'hold', label: 'Hold / Carry', roleCategory: 'object', categories: ['hero', 'npc'], recommendedDurationSec: [0.7, 2.2], defaultDuration: 1.2, loop: true, description: 'Carry tool or item in front.' },
  { slot: 'sleep', label: 'Sleep / Lie Down', roleCategory: 'object', categories: ['hero', 'npc'], recommendedDurationSec: [1.2, 3.5], defaultDuration: 2.0, loop: true, description: 'Horizontal resting breathe.' },
  { slot: 'fishing', label: 'Fishing Cast & Hold', roleCategory: 'object', categories: ['hero', 'npc'], recommendedDurationSec: [0.8, 2.5], defaultDuration: 1.4, loop: true, description: 'Steady rod hold with subtle tug check.' },
  { slot: 'lift', label: 'Lift Heavy Crate', roleCategory: 'object', categories: ['hero', 'npc'], recommendedDurationSec: [0.6, 1.8], defaultDuration: 1.0, loop: false, description: 'Squat down and hoist overhead.' },
  { slot: 'pull', label: 'Pull Lever / Rope', roleCategory: 'object', categories: ['hero', 'npc'], recommendedDurationSec: [0.5, 1.6], defaultDuration: 0.9, loop: true, description: 'Lean back tugging steadily.' },
  { slot: 'push', label: 'Push Block', roleCategory: 'object', categories: ['hero', 'npc'], recommendedDurationSec: [0.5, 1.6], defaultDuration: 0.9, loop: true, description: 'Braced forward push cycle.' },
  { slot: 'dig', label: 'Dig Earth', roleCategory: 'object', categories: ['hero', 'npc'], recommendedDurationSec: [0.55, 1.6], defaultDuration: 0.95, loop: true, description: 'Scoop and toss cycle.' },
  { slot: 'climbVertical', label: 'Climb Ladder / Vine', roleCategory: 'object', categories: ['hero', 'npc'], recommendedDurationSec: [0.55, 1.5], defaultDuration: 0.9, loop: true, description: 'Hand-over-hand vertical climb.' },
  { slot: 'climbStairs', label: 'Climb Stairs', roleCategory: 'object', categories: ['hero', 'npc'], recommendedDurationSec: [0.45, 1.3], defaultDuration: 0.78, loop: true, description: 'High-knee stair ascent.' },
  { slot: 'crouch', label: 'Crouch Low', roleCategory: 'object', categories: ['hero', 'npc'], recommendedDurationSec: [0.7, 2.2], defaultDuration: 1.2, loop: true, description: 'Low braced crouch.' },
  { slot: 'sneak', label: 'Sneak Creep', roleCategory: 'object', categories: ['hero', 'npc'], recommendedDurationSec: [0.6, 1.7], defaultDuration: 1.05, loop: true, description: 'Stealthy tip-toe crouch walk.' },
  { slot: 'hug', label: 'Friendly Hug', roleCategory: 'social', categories: ['hero', 'npc'], recommendedDurationSec: [0.7, 2.0], defaultDuration: 1.2, loop: false, description: 'Warm embrace.' },
  { slot: 'punch', label: 'Quick Punch', roleCategory: 'combat', categories: ['hero', 'npc'], recommendedDurationSec: [0.3, 0.9], defaultDuration: 0.55, loop: false, description: 'Cross-body punch.' },
  { slot: 'kick', label: 'Snap Kick', roleCategory: 'combat', categories: ['hero', 'npc'], recommendedDurationSec: [0.35, 1.0], defaultDuration: 0.65, loop: false, description: 'Balanced front snap kick.' },
];

export const MOTION_SLOT_META_BY_SLOT: Record<CustomClipSlot, MotionSlotMetadata> =
  MOTION_SLOT_METADATA.reduce(
    (acc, item) => {
      acc[item.slot] = item;
      return acc;
    },
    {} as Record<CustomClipSlot, MotionSlotMetadata>
  );

export const CUSTOM_CLIP_SLOT_LABELS: Record<CustomClipSlot, string> = MOTION_SLOT_METADATA.reduce(
  (acc, item) => {
    acc[item.slot] = item.label;
    return acc;
  },
  {} as Record<CustomClipSlot, string>
);

export function getSlotsForActorCategory(
  category: MotionActorCategory,
  rigArchetype?: MotionRigArchetype
): MotionSlotMetadata[] {
  return MOTION_SLOT_METADATA.filter((m) => {
    if (!m.categories.includes(category)) return false;
    if (rigArchetype === 'quadruped' && m.roleCategory === 'object') return false;
    return true;
  });
}

type RolePoseMap = Partial<
  Record<
    | 'hips'
    | 'spine'
    | 'chest'
    | 'neck'
    | 'head'
    | 'leftUpperArm'
    | 'leftLowerArm'
    | 'rightUpperArm'
    | 'rightLowerArm'
    | 'leftUpperLeg'
    | 'leftLowerLeg'
    | 'rightUpperLeg'
    | 'rightLowerLeg',
    BonePoseAngles
  >
>;

function mapRolePosesToBoneMap(
  boneMap: Partial<Record<string, string>>,
  roles: RolePoseMap
): Record<string, BonePoseAngles> {
  const out: Record<string, BonePoseAngles> = {};
  for (const [role, angles] of Object.entries(roles)) {
    const boneName = boneMap[role] || role;
    if (boneName && angles) {
      out[boneName] = angles;
    }
  }
  return out;
}

function filterToPresentBones(
  bones: Record<string, BonePoseAngles>,
  available?: Set<string> | null
): Record<string, BonePoseAngles> {
  if (!available || available.size === 0) return bones;
  const out: Record<string, BonePoseAngles> = {};
  for (const [k, v] of Object.entries(bones)) {
    if (available.has(k)) {
      out[k] = v;
    }
  }
  return out;
}

export interface BuildPresetTemplateOptions {
  customName?: string;
  rigArchetype?: MotionRigArchetype;
  actorCategory?: MotionActorCategory;
  availableBoneNames?: string[];
  hipsHeightRef?: number;
}

function buildQuadrupedPresetKeyframes(
  slot: CustomClipSlot,
  availableSet: Set<string> | null
): { duration: number; loop: boolean; keyframes: CustomPoseKeyframe[]; events?: MotionEventMarker[] } {
  const mkQ = (
    time: number,
    rawBones: Record<string, BonePoseAngles>,
    hipsOffsetY = 0,
    easing: MotionEasing = 'smooth'
  ): CustomPoseKeyframe => ({
    id: uid(),
    time,
    bones: filterToPresentBones(rawBones, availableSet),
    hipsOffsetY,
    easing,
  });

  // Helper to populate both Head 0 and optional Head 1 cleanly
  const setHeads = (
    b: Record<string, BonePoseAngles>,
    h0: { neckP?: number; neckY?: number; headP?: number; headY?: number; headR?: number; jaw?: number },
    mirrorHead1 = false
  ) => {
    const nP = h0.neckP ?? 0;
    const nY = h0.neckY ?? 0;
    b.MonsterNeck_0_0 = [nP * 0.5, nY * 0.5, 0];
    b.MonsterNeck_0_1 = [nP * 0.5, nY * 0.5, 0];
    b.MonsterHead_0 = [h0.headP ?? 0, h0.headY ?? 0, h0.headR ?? 0];
    b.MonsterJaw_0 = [h0.jaw ?? 0, 0, 0];
    if (!availableSet || availableSet.has('MonsterHead_1')) {
      const sign = mirrorHead1 ? -1 : 1;
      b.MonsterNeck_1_0 = [nP * 0.5, sign * nY * 0.5, 0];
      b.MonsterNeck_1_1 = [nP * 0.5, sign * nY * 0.5, 0];
      b.MonsterHead_1 = [h0.headP ?? 0, sign * (h0.headY ?? 0), sign * (h0.headR ?? 0)];
      b.MonsterJaw_1 = [h0.jaw ?? 0, 0, 0];
    }
  };

  switch (slot) {
    case 'dying': {
      const f0: Record<string, BonePoseAngles> = {
        MonsterBodyPivot: [0, 0, 0],
        Wing_L_Inner: [0, 0, 8],
        Wing_R_Inner: [0, 0, -8],
      };
      setHeads(f0, { neckP: 0, headP: 0, jaw: 8 });

      const f1: Record<string, BonePoseAngles> = {
        MonsterBodyPivot: [-30, 0, 4],
        MonsterChest: [-10, 0, 0],
        Leg_0_L_Hip: [-26, 0, 8],
        Leg_0_R_Hip: [-24, 0, -8],
        Leg_0_L_Knee: [22, 0, 0],
        Leg_0_R_Knee: [22, 0, 0],
        Leg_1_L_Hip: [18, 0, 0],
        Leg_1_R_Hip: [18, 0, 0],
        Wing_L_Inner: [0, 0, -34],
        Wing_R_Inner: [0, 0, 34],
        Wing_L_Outer: [0, 0, 14],
        Wing_R_Outer: [0, 0, -14],
        MonsterTail_0: [-10, 10, 0],
      };
      setHeads(f1, { neckP: -26, headP: -16, jaw: 44 });

      const f2: Record<string, BonePoseAngles> = {
        MonsterBodyPivot: [-8, 0, 32],
        Leg_0_L_Hip: [22, 0, 14],
        Leg_0_R_Hip: [14, 0, -18],
        Leg_0_L_Knee: [44, 0, 0],
        Leg_0_R_Knee: [38, 0, 0],
        Leg_1_L_Hip: [-20, 0, 16],
        Leg_1_R_Hip: [-16, 0, -16],
        Wing_L_Inner: [0, 0, 12],
        Wing_R_Inner: [0, 0, -10],
        Wing_L_Outer: [0, 0, -24],
        Wing_R_Outer: [0, 0, 24],
        MonsterTail_0: [-12, -16, 0],
      };
      setHeads(f2, { neckP: 18, neckY: -12, headP: 12, headR: 18, jaw: 26 }, true);

      const f3: Record<string, BonePoseAngles> = {
        MonsterBodyPivot: [12, 0, 56],
        MonsterTorso: [0, 0, 8],
        Leg_0_L_Hip: [36, 0, 22],
        Leg_0_R_Hip: [30, 0, -24],
        Leg_0_L_Knee: [56, 0, 0],
        Leg_0_R_Knee: [52, 0, 0],
        Leg_0_L_Paw: [22, 0, 0],
        Leg_0_R_Paw: [22, 0, 0],
        Leg_1_L_Hip: [-34, 0, 22],
        Leg_1_R_Hip: [-30, 0, -22],
        Leg_1_L_Knee: [54, 0, 0],
        Leg_1_R_Knee: [52, 0, 0],
        Wing_L_Inner: [0, 0, 30],
        Wing_R_Inner: [0, 0, -30],
        Wing_L_Outer: [0, 0, -28],
        Wing_R_Outer: [0, 0, 28],
        MonsterTail_0: [-14, 0, 0],
        MonsterTail_1: [-12, 8, 0],
        MonsterTail_2: [-10, 12, 0],
      };
      setHeads(f3, { neckP: 34, neckY: -14, headP: 20, headR: 24, jaw: 6 }, true);

      return {
        duration: 1.85,
        loop: false,
        keyframes: [
          mkQ(0, f0, 0, 'easeOut'),
          mkQ(0.28, f1, 0.24, 'easeIn'),
          mkQ(0.65, f2, -0.34, 'smooth'),
          mkQ(1.0, f3, -0.58, 'easeOut'),
        ],
        events: [
          { id: uid(), time: 0.28, kind: 'custom', label: 'Rear Peak' },
          { id: uid(), time: 0.92, kind: 'collapse', label: 'Ground Thud' },
        ],
      };
    }

    case 'windup_headSway3': {
      const f0: Record<string, BonePoseAngles> = {
        MonsterBodyPivot: [-6, 0, 0],
        Wing_L_Inner: [0, 0, -14],
        Wing_R_Inner: [0, 0, 14],
      };
      setHeads(f0, { neckP: -8, jaw: 12 });

      const f1: Record<string, BonePoseAngles> = {
        MonsterBodyPivot: [-8, 10, -6],
        Wing_L_Inner: [0, 0, -22],
        Wing_R_Inner: [0, 0, 22],
      };
      setHeads(f1, { neckP: -12, neckY: 32, headY: 22, headR: -15, jaw: 22 }, true);

      const f2: Record<string, BonePoseAngles> = {
        MonsterBodyPivot: [-8, -10, 6],
        Wing_L_Inner: [0, 0, -24],
        Wing_R_Inner: [0, 0, 24],
      };
      setHeads(f2, { neckP: -12, neckY: -34, headY: -24, headR: 15, jaw: 24 }, true);

      const f3: Record<string, BonePoseAngles> = {
        MonsterBodyPivot: [-10, 10, -6],
        Wing_L_Inner: [0, 0, -26],
        Wing_R_Inner: [0, 0, 26],
      };
      setHeads(f3, { neckP: -14, neckY: 34, headY: 24, headR: -15, jaw: 28 }, true);

      const f4: Record<string, BonePoseAngles> = {
        MonsterBodyPivot: [-28, 0, 0],
        Leg_0_L_Hip: [-44, 0, 0],
        Leg_0_R_Hip: [-44, 0, 0],
        Leg_0_L_Knee: [36, 0, 0],
        Leg_0_R_Knee: [36, 0, 0],
        Wing_L_Inner: [0, 0, -34],
        Wing_R_Inner: [0, 0, 34],
      };
      setHeads(f4, { neckP: -48, headP: -26, jaw: 45 });

      return {
        duration: 1.15,
        loop: false,
        keyframes: [
          mkQ(0, f0, 0.03),
          mkQ(0.22, f1, 0.06),
          mkQ(0.48, f2, 0.06),
          mkQ(0.72, f3, 0.08),
          mkQ(0.95, f4, 0.14, 'easeOut'),
          mkQ(1.0, f4, 0.14),
        ],
        events: [{ id: uid(), time: 0.76, kind: 'windupLock', label: 'Target Lock Pullback' }],
      };
    }

    case 'windup_footMarch': {
      const mkStep = (leftUp: boolean, pull = false) => {
        const b: Record<string, BonePoseAngles> = {
          MonsterBodyPivot: [pull ? -26 : -6, 0, leftUp ? 6 : -6],
          Leg_0_L_Hip: [leftUp ? -46 : 10, 0, 0],
          Leg_0_L_Knee: [leftUp ? 54 : 8, 0, 0],
          Leg_0_R_Hip: [leftUp ? 10 : -46, 0, 0],
          Leg_0_R_Knee: [leftUp ? 8 : 54, 0, 0],
          Leg_1_L_Hip: [leftUp ? 12 : -42, 0, 0],
          Leg_1_L_Knee: [leftUp ? -8 : -36, 0, 0],
          Leg_1_R_Hip: [leftUp ? -42 : 12, 0, 0],
          Leg_1_R_Knee: [leftUp ? -36 : -8, 0, 0],
        };
        setHeads(b, { neckP: pull ? -24 : -6, headP: pull ? -14 : 4, jaw: pull ? 34 : 16 });
        return b;
      };
      return {
        duration: 1.15,
        loop: false,
        keyframes: [
          mkQ(0, mkStep(true), 0.06),
          mkQ(0.26, mkStep(false), 0.08),
          mkQ(0.52, mkStep(true), 0.08),
          mkQ(0.76, mkStep(false), 0.06),
          mkQ(1.0, mkStep(true, true), 0.16),
        ],
        events: [{ id: uid(), time: 0.78, kind: 'windupLock', label: 'Ready Slam' }],
      };
    }

    case 'windup_wingFlare': {
      const pulse = (liftDeg: number, pitchDeg: number, jaw: number) => {
        const b: Record<string, BonePoseAngles> = {
          MonsterBodyPivot: [pitchDeg, 0, 0],
          Wing_L_Inner: [0, 0, -liftDeg],
          Wing_R_Inner: [0, 0, liftDeg],
          Wing_L_Outer: [0, 0, liftDeg * 0.35],
          Wing_R_Outer: [0, 0, -liftDeg * 0.35],
        };
        setHeads(b, { neckP: pitchDeg * 0.85, headP: pitchDeg * 0.45, jaw });
        return b;
      };
      return {
        duration: 1.1,
        loop: false,
        keyframes: [
          mkQ(0, pulse(8, -6, 12), 0.02),
          mkQ(0.28, pulse(38, -16, 28), 0.12),
          mkQ(0.54, pulse(16, -8, 18), 0.04),
          mkQ(0.84, pulse(50, -28, 46), 0.18),
          mkQ(1.0, pulse(48, -28, 46), 0.18),
        ],
        events: [{ id: uid(), time: 0.78, kind: 'windupLock', label: 'Apex Flare' }],
      };
    }

    case 'windup_crouchPounce': {
      const b0: Record<string, BonePoseAngles> = { MonsterBodyPivot: [6, 0, 0] };
      setHeads(b0, { neckP: 10, headP: -12, jaw: 16 });
      const b1: Record<string, BonePoseAngles> = {
        MonsterBodyPivot: [12, -8, 5],
        Leg_0_L_Hip: [22, 0, -10],
        Leg_0_R_Hip: [22, 0, 10],
        Leg_0_L_Knee: [40, 0, 0],
        Leg_0_R_Knee: [40, 0, 0],
        Leg_1_L_Hip: [-28, 0, -10],
        Leg_1_R_Hip: [-28, 0, 10],
        Leg_1_L_Knee: [-36, 0, 0],
        Leg_1_R_Knee: [-36, 0, 0],
      };
      setHeads(b1, { neckP: 14, neckY: -12, headP: -16, jaw: 20 });
      const b2: Record<string, BonePoseAngles> = {
        ...b1,
        MonsterBodyPivot: [14, 8, -5],
      };
      setHeads(b2, { neckP: 16, neckY: 12, headP: -18, jaw: 22 });
      const b3: Record<string, BonePoseAngles> = {
        ...b1,
        MonsterBodyPivot: [18, 0, 0],
      };
      setHeads(b3, { neckP: -18, headP: -16, jaw: 34 });
      return {
        duration: 1.05,
        loop: false,
        keyframes: [
          mkQ(0, b0, 0),
          mkQ(0.32, b1, -0.14),
          mkQ(0.66, b2, -0.16),
          mkQ(1.0, b3, -0.18),
        ],
        events: [{ id: uid(), time: 0.76, kind: 'windupLock', label: 'Coiled Spring' }],
      };
    }

    case 'fireBreath':
    case 'iceBreath':
    case 'waterJet':
    case 'electricShock':
    case 'poisonSpit':
    case 'shadowBeam':
    case 'solarBeam': {
      const fStart: Record<string, BonePoseAngles> = { MonsterBodyPivot: [-14, 0, 0], Wing_L_Inner: [0, 0, -24], Wing_R_Inner: [0, 0, 24] };
      setHeads(fStart, { neckP: -20, headP: -10, jaw: 38 });
      const fLeft: Record<string, BonePoseAngles> = { MonsterBodyPivot: [8, -12, 0], Wing_L_Inner: [0, 0, -10], Wing_R_Inner: [0, 0, 10] };
      setHeads(fLeft, { neckP: 16, neckY: -18, headP: -8, jaw: 44 }, true);
      const fRight: Record<string, BonePoseAngles> = { MonsterBodyPivot: [8, 12, 0], Wing_L_Inner: [0, 0, -14], Wing_R_Inner: [0, 0, 14] };
      setHeads(fRight, { neckP: 16, neckY: 18, headP: -8, jaw: 44 }, true);
      const fEnd: Record<string, BonePoseAngles> = { MonsterBodyPivot: [0, 0, 0] };
      setHeads(fEnd, { neckP: 0, headP: 0, jaw: 6 });
      return {
        duration: 1.05,
        loop: false,
        keyframes: [
          mkQ(0, fStart, 0.06),
          mkQ(0.28, fLeft, 0),
          mkQ(0.64, fRight, 0),
          mkQ(1.0, fEnd, 0),
        ],
        events: [
          { id: uid(), time: 0.2, kind: 'impact', label: 'Beam Ignition' },
          { id: uid(), time: 0.75, kind: 'recover', label: 'Breath Fade' },
        ],
      };
    }

    case 'groundPound': {
      const b0: Record<string, BonePoseAngles> = {
        MonsterBodyPivot: [-32, 0, 0],
        Leg_0_L_Hip: [-52, 0, 0],
        Leg_0_R_Hip: [-52, 0, 0],
        Leg_0_L_Knee: [42, 0, 0],
        Leg_0_R_Knee: [42, 0, 0],
        Wing_L_Inner: [0, 0, -36],
        Wing_R_Inner: [0, 0, 36],
      };
      setHeads(b0, { neckP: -26, headP: -16, jaw: 38 });
      const bSlam: Record<string, BonePoseAngles> = {
        MonsterBodyPivot: [18, 0, 0],
        Leg_0_L_Hip: [18, 0, -12],
        Leg_0_R_Hip: [18, 0, 12],
        Leg_0_L_Knee: [28, 0, 0],
        Leg_0_R_Knee: [28, 0, 0],
        Wing_L_Inner: [0, 0, 18],
        Wing_R_Inner: [0, 0, -18],
      };
      setHeads(bSlam, { neckP: 14, headP: -10, jaw: 42 });
      const bEnd: Record<string, BonePoseAngles> = { MonsterBodyPivot: [0, 0, 0] };
      setHeads(bEnd, { jaw: 8 });
      return {
        duration: 0.85,
        loop: false,
        keyframes: [
          mkQ(0, b0, 0.2),
          mkQ(0.45, bSlam, -0.18, 'easeIn'),
          mkQ(0.68, bSlam, -0.12),
          mkQ(1.0, bEnd, 0),
        ],
        events: [{ id: uid(), time: 0.45, kind: 'impact', label: 'Shockwave Slam' }],
      };
    }

    case 'clawSlash': {
      const b0: Record<string, BonePoseAngles> = {
        MonsterBodyPivot: [-14, -14, 0],
        Leg_0_R_Hip: [-60, 0, 12],
        Leg_0_R_Knee: [44, 0, 0],
      };
      setHeads(b0, { neckP: -14, jaw: 24 });
      const b1: Record<string, BonePoseAngles> = {
        MonsterBodyPivot: [18, 18, -6],
        Leg_0_R_Hip: [45, 0, -16],
        Leg_0_R_Knee: [-8, 0, 0],
      };
      setHeads(b1, { neckP: 16, headY: 14, jaw: 42 });
      const b2: Record<string, BonePoseAngles> = { MonsterBodyPivot: [0, 0, 0] };
      setHeads(b2, { jaw: 6 });
      return {
        duration: 0.68,
        loop: false,
        keyframes: [
          mkQ(0, b0, 0.08),
          mkQ(0.42, b1, 0, 'easeOut'),
          mkQ(1.0, b2, 0),
        ],
        events: [{ id: uid(), time: 0.42, kind: 'impact', label: 'Claw Strike' }],
      };
    }

    case 'tailSmash': {
      const b0: Record<string, BonePoseAngles> = {
        MonsterBodyPivot: [-6, 36, 0],
        MonsterTail_0: [0, -24, 0],
        MonsterTail_1: [0, -24, 0],
        MonsterTail_2: [0, -22, 0],
        MonsterTail_3: [0, -18, 0],
      };
      const b1: Record<string, BonePoseAngles> = {
        MonsterBodyPivot: [4, -72, 10],
        MonsterTail_0: [0, 32, 0],
        MonsterTail_1: [0, 32, 0],
        MonsterTail_2: [0, 28, 0],
        MonsterTail_3: [0, 24, 0],
      };
      const b2: Record<string, BonePoseAngles> = { MonsterBodyPivot: [0, 0, 0] };
      return {
        duration: 0.85,
        loop: false,
        keyframes: [
          mkQ(0, b0, 0),
          mkQ(0.45, b1, 0.06, 'easeOut'),
          mkQ(1.0, b2, 0),
        ],
        events: [{ id: uid(), time: 0.45, kind: 'impact', label: 'Tail Sweep Hit' }],
      };
    }

    case 'chargeGore': {
      const b0: Record<string, BonePoseAngles> = {
        MonsterBodyPivot: [14, 0, 0],
        Leg_0_L_Hip: [24, 0, 0],
        Leg_0_R_Hip: [24, 0, 0],
        Leg_1_L_Hip: [-28, 0, 0],
        Leg_1_R_Hip: [-28, 0, 0],
      };
      setHeads(b0, { neckP: 26, headP: 20, jaw: 18 });
      const b1: Record<string, BonePoseAngles> = {
        MonsterBodyPivot: [-18, 0, 0],
        Leg_0_L_Hip: [-36, 0, 0],
        Leg_0_R_Hip: [-36, 0, 0],
      };
      setHeads(b1, { neckP: -24, headP: -22, jaw: 34 });
      const b2: Record<string, BonePoseAngles> = { MonsterBodyPivot: [0, 0, 0] };
      setHeads(b2, { jaw: 6 });
      return {
        duration: 0.88,
        loop: false,
        keyframes: [
          mkQ(0, b0, -0.06),
          mkQ(0.48, b1, 0.14, 'easeOut'),
          mkQ(1.0, b2, 0),
        ],
        events: [{ id: uid(), time: 0.48, kind: 'impact', label: 'Horn Gore Uppercut' }],
      };
    }

    case 'sonicRoar': {
      const b0: Record<string, BonePoseAngles> = { MonsterBodyPivot: [-8, 0, 0] };
      setHeads(b0, { neckP: -10, jaw: 14 });
      const b1: Record<string, BonePoseAngles> = {
        MonsterBodyPivot: [-28, 0, -5],
        Wing_L_Inner: [0, 0, -40],
        Wing_R_Inner: [0, 0, 40],
      };
      setHeads(b1, { neckP: -32, headP: -22, jaw: 50 });
      const b2: Record<string, BonePoseAngles> = {
        MonsterBodyPivot: [-24, 0, 5],
        Wing_L_Inner: [0, 0, -36],
        Wing_R_Inner: [0, 0, 36],
      };
      setHeads(b2, { neckP: -28, headP: -20, jaw: 48 });
      const b3: Record<string, BonePoseAngles> = { MonsterBodyPivot: [0, 0, 0] };
      setHeads(b3, { jaw: 6 });
      return {
        duration: 1.05,
        loop: false,
        keyframes: [
          mkQ(0, b0, 0),
          mkQ(0.28, b1, 0.14),
          mkQ(0.68, b2, 0.12),
          mkQ(1.0, b3, 0),
        ],
        events: [{ id: uid(), time: 0.3, kind: 'impact', label: 'Roar Shockwave' }],
      };
    }

    case 'fly': {
      const up: Record<string, BonePoseAngles> = {
        MonsterBodyPivot: [-6, 0, 0],
        Leg_0_L_Hip: [-20, 0, 0],
        Leg_0_R_Hip: [-20, 0, 0],
        Leg_1_L_Hip: [26, 0, 0],
        Leg_1_R_Hip: [26, 0, 0],
        Leg_0_L_Knee: [32, 0, 0],
        Leg_0_R_Knee: [32, 0, 0],
        Wing_L_Inner: [0, 0, -36],
        Wing_R_Inner: [0, 0, 36],
        Wing_L_Outer: [0, 0, 22],
        Wing_R_Outer: [0, 0, -22],
      };
      const down: Record<string, BonePoseAngles> = {
        MonsterBodyPivot: [4, 0, 0],
        Leg_0_L_Hip: [-20, 0, 0],
        Leg_0_R_Hip: [-20, 0, 0],
        Leg_1_L_Hip: [26, 0, 0],
        Leg_1_R_Hip: [26, 0, 0],
        Leg_0_L_Knee: [32, 0, 0],
        Leg_0_R_Knee: [32, 0, 0],
        Wing_L_Inner: [0, 0, 36],
        Wing_R_Inner: [0, 0, -36],
        Wing_L_Outer: [0, 0, -22],
        Wing_R_Outer: [0, 0, 22],
      };
      return {
        duration: 0.78,
        loop: true,
        keyframes: [mkQ(0, up, 0.62), mkQ(0.5, down, 0.34)],
      };
    }

    case 'walk':
    case 'run': {
      const isRun = slot === 'run';
      const amp = isRun ? 35 : 24;
      const knee = isRun ? 58 : 42;
      const a: Record<string, BonePoseAngles> = {
        MonsterBodyPivot: [isRun ? 6 : 2, 0, 2],
        Leg_0_L_Hip: [-amp, 0, 0],
        Leg_0_R_Hip: [amp, 0, 0],
        Leg_1_L_Hip: [amp * 0.85, 0, 0],
        Leg_1_R_Hip: [-amp * 0.85, 0, 0],
        Leg_0_L_Knee: [knee * 0.45, 0, 0],
        Leg_0_R_Knee: [12, 0, 0],
        Leg_1_L_Knee: [-12, 0, 0],
        Leg_1_R_Knee: [-knee * 0.45, 0, 0],
        MonsterTail_0: [0, 10, 0],
        MonsterTail_1: [0, 12, 0],
      };
      const b: Record<string, BonePoseAngles> = {
        MonsterBodyPivot: [isRun ? -4 : 0, 0, -2],
        Leg_0_L_Hip: [amp, 0, 0],
        Leg_0_R_Hip: [-amp, 0, 0],
        Leg_1_L_Hip: [-amp * 0.85, 0, 0],
        Leg_1_R_Hip: [amp * 0.85, 0, 0],
        Leg_0_L_Knee: [12, 0, 0],
        Leg_0_R_Knee: [knee * 0.45, 0, 0],
        Leg_1_L_Knee: [-knee * 0.45, 0, 0],
        Leg_1_R_Knee: [-12, 0, 0],
        MonsterTail_0: [0, -10, 0],
        MonsterTail_1: [0, -12, 0],
      };
      return {
        duration: isRun ? 0.62 : 0.9,
        loop: true,
        keyframes: [mkQ(0, a, isRun ? 0.08 : 0.03), mkQ(0.5, b, isRun ? 0.08 : 0.03)],
      };
    }

    case 'stagger': {
      const s0: Record<string, BonePoseAngles> = {
        MonsterBodyPivot: [-18, 0, -10],
        Wing_L_Inner: [0, 0, -24],
        Wing_R_Inner: [0, 0, 24],
      };
      setHeads(s0, { neckP: -18, headR: -14, jaw: 32 });
      const s1: Record<string, BonePoseAngles> = { MonsterBodyPivot: [0, 0, 0] };
      setHeads(s1, { jaw: 6 });
      return {
        duration: 0.68,
        loop: false,
        keyframes: [mkQ(0, s0, 0.06), mkQ(0.45, { ...s0, MonsterBodyPivot: [-10, 0, 8] }, 0.02), mkQ(1, s1, 0)],
      };
    }

    case 'celebrate':
    case 'cheer': {
      const i0: Record<string, BonePoseAngles> = {
        MonsterBodyPivot: [6, 0, 2],
        Wing_L_Inner: [0, 0, -10],
        Wing_R_Inner: [0, 0, 10],
        MonsterTail_0: [10, 14, 0],
      };
      setHeads(i0, { neckP: 6, neckY: 12, headY: 10, headR: 8, jaw: 12 }, true);
      const i1: Record<string, BonePoseAngles> = {
        MonsterBodyPivot: [-10, 0, -2],
        Wing_L_Inner: [0, 0, -34],
        Wing_R_Inner: [0, 0, 34],
        MonsterTail_0: [16, -14, 0],
      };
      setHeads(i1, { neckP: -14, neckY: -12, headY: -10, headR: -8, jaw: 22 }, true);
      return {
        duration: 1.05,
        loop: true,
        keyframes: [mkQ(0, i0, 0), mkQ(0.45, i1, 0.14, 'easeOut'), mkQ(1.0, i0, 0)],
      };
    }

    case 'grumpy': {
      const g0: Record<string, BonePoseAngles> = {
        MonsterBodyPivot: [6, -6, 3],
        Wing_L_Inner: [0, 0, -16],
        Wing_R_Inner: [0, 0, 16],
        MonsterTail_0: [16, 16, 0],
      };
      setHeads(g0, { neckP: 14, neckY: -16, headY: -12, headR: 12, jaw: 16 });
      const g1: Record<string, BonePoseAngles> = {
        MonsterBodyPivot: [8, 6, -3],
        Leg_0_L_Hip: [-24, 0, 0],
        Wing_L_Inner: [0, 0, -20],
        Wing_R_Inner: [0, 0, 20],
        MonsterTail_0: [18, -16, 0],
      };
      setHeads(g1, { neckP: 16, neckY: 16, headY: 12, headR: -12, jaw: 20 });
      return {
        duration: 1.0,
        loop: true,
        keyframes: [mkQ(0, g0, 0), mkQ(0.5, g1, 0), mkQ(1.0, g0, 0)],
      };
    }

    case 'idle':
    default: {
      const i0: Record<string, BonePoseAngles> = {
        MonsterChest: [2, 0, 1],
        MonsterTorso: [2, 0, 0],
        Wing_L_Inner: [0, 0, -6],
        Wing_R_Inner: [0, 0, 6],
        MonsterTail_0: [0, 10, 0],
      };
      setHeads(i0, { neckP: 4, neckY: 8, headY: 6, headR: 5, jaw: 4 }, true);
      const i1: Record<string, BonePoseAngles> = {
        MonsterChest: [-2, 0, -1],
        MonsterTorso: [-2, 0, 0],
        Wing_L_Inner: [0, 0, -12],
        Wing_R_Inner: [0, 0, 12],
        MonsterTail_0: [0, -10, 0],
      };
      setHeads(i1, { neckP: -4, neckY: -8, headY: -6, headR: -5, jaw: 8 }, true);
      return {
        duration: 2.0,
        loop: true,
        keyframes: [mkQ(0, i0, 0), mkQ(0.5, i1, 0)],
      };
    }
  }
}

function buildCritterPresetKeyframes(
  slot: CustomClipSlot,
  availableSet: Set<string> | null
): { duration: number; loop: boolean; keyframes: CustomPoseKeyframe[]; events?: MotionEventMarker[] } | null {
  const mkC = (
    time: number,
    rawBones: Record<string, BonePoseAngles>,
    hipsOffsetY = 0,
    easing: MotionEasing = 'smooth'
  ): CustomPoseKeyframe => ({
    id: uid(),
    time,
    bones: filterToPresentBones(rawBones, availableSet),
    hipsOffsetY,
    easing,
  });

  switch (slot) {
    case 'idle':
      return {
        duration: 2.0,
        loop: true,
        keyframes: [
          mkC(
            0,
            {
              Spine: [2, 2, 0],
              Head: [4, 12, 6],
              LeftUpperArm: [4, 0, 8],
              RightUpperArm: [-4, 0, -8],
              LeftLowerArm: [-12, 0, 0],
              RightLowerArm: [-12, 0, 0],
              Tail: [4, 14, 0],
              LeftWing: [0, 0, -6],
              RightWing: [0, 0, 6],
            },
            0
          ),
          mkC(
            0.5,
            {
              Spine: [5, -2, 0],
              Head: [-4, -12, -6],
              LeftUpperArm: [-4, 0, 10],
              RightUpperArm: [4, 0, -10],
              LeftLowerArm: [-16, 0, 0],
              RightLowerArm: [-16, 0, 0],
              Tail: [8, -14, 0],
              LeftWing: [0, 0, -12],
              RightWing: [0, 0, 12],
            },
            0
          ),
        ],
      };

    case 'walk':
    case 'run': {
      const isRun = slot === 'run';
      const legStride = isRun ? 42 : 26;
      const armSwing = isRun ? 46 : 28;
      const elbowBend = isRun ? -52 : -22;
      const elbowBack = isRun ? -28 : -12;
      const spineLean = isRun ? 14 : 6;
      const spineTwist = isRun ? 10 : 6;
      const headPitch = isRun ? -10 : -4;
      const headYaw = isRun ? 10 : 8;
      const headRoll = isRun ? 7 : 5;
      const dropY = isRun ? -0.04 : -0.02;
      return {
        duration: isRun ? 0.56 : 0.82,
        loop: true,
        keyframes: [
          mkC(
            0,
            {
              Hips: [isRun ? 6 : 3, -5, 3],
              Spine: [spineLean, spineTwist, -2],
              Head: [headPitch, -headYaw, -headRoll],
              LeftUpperLeg: [-legStride, 0, 0],
              RightUpperLeg: [legStride, 0, 0],
              LeftUpperArm: [armSwing, 0, 8],
              LeftLowerArm: [elbowBack, 0, 0],
              RightUpperArm: [-armSwing, 0, -8],
              RightLowerArm: [elbowBend, 0, 0],
              Tail: [8, 16, 0],
              LeftWing: [0, 0, -16],
              RightWing: [0, 0, 16],
            },
            0
          ),
          mkC(
            0.25,
            {
              Hips: [isRun ? 8 : 4, 0, 4],
              Spine: [spineLean + 3, 0, -3],
              Head: [headPitch + 5, 0, 0],
              LeftUpperLeg: [-8, 0, 0],
              RightUpperLeg: [8, 0, 0],
              LeftUpperArm: [12, 0, 10],
              LeftLowerArm: [elbowBend * 0.7, 0, 0],
              RightUpperArm: [-12, 0, -10],
              RightLowerArm: [elbowBend * 0.7, 0, 0],
              Tail: [12, 0, 0],
              LeftWing: [0, 0, -28],
              RightWing: [0, 0, 28],
            },
            dropY
          ),
          mkC(
            0.5,
            {
              Hips: [isRun ? 6 : 3, 5, -3],
              Spine: [spineLean, -spineTwist, 2],
              Head: [headPitch, headYaw, headRoll],
              LeftUpperLeg: [legStride, 0, 0],
              RightUpperLeg: [-legStride, 0, 0],
              LeftUpperArm: [-armSwing, 0, 8],
              LeftLowerArm: [elbowBend, 0, 0],
              RightUpperArm: [armSwing, 0, -8],
              RightLowerArm: [elbowBack, 0, 0],
              Tail: [8, -16, 0],
              LeftWing: [0, 0, -16],
              RightWing: [0, 0, 16],
            },
            0
          ),
          mkC(
            0.75,
            {
              Hips: [isRun ? 8 : 4, 0, -4],
              Spine: [spineLean + 3, 0, 3],
              Head: [headPitch + 5, 0, 0],
              LeftUpperLeg: [8, 0, 0],
              RightUpperLeg: [-8, 0, 0],
              LeftUpperArm: [-12, 0, 10],
              LeftLowerArm: [elbowBend * 0.7, 0, 0],
              RightUpperArm: [12, 0, -10],
              RightLowerArm: [elbowBend * 0.7, 0, 0],
              Tail: [12, 0, 0],
              LeftWing: [0, 0, -28],
              RightWing: [0, 0, 28],
            },
            dropY
          ),
        ],
      };
    }

    case 'fly':
      return {
        duration: 0.65,
        loop: true,
        keyframes: [
          mkC(
            0,
            {
              Hips: [-8, 0, 0],
              Spine: [10, 0, 0],
              Head: [-12, 0, 0],
              LeftUpperArm: [-28, 0, 52],
              RightUpperArm: [-28, 0, -52],
              LeftLowerArm: [-18, 0, 0],
              RightLowerArm: [-18, 0, 0],
              LeftWing: [0, 0, -45],
              RightWing: [0, 0, 45],
              LeftUpperLeg: [24, 0, 0],
              RightUpperLeg: [24, 0, 0],
              Tail: [12, 0, 0],
            },
            0.22
          ),
          mkC(
            0.5,
            {
              Hips: [4, 0, 0],
              Spine: [4, 0, 0],
              Head: [-4, 0, 0],
              LeftUpperArm: [12, 0, 18],
              RightUpperArm: [12, 0, -18],
              LeftLowerArm: [-28, 0, 0],
              RightLowerArm: [-28, 0, 0],
              LeftWing: [0, 0, 38],
              RightWing: [0, 0, -38],
              LeftUpperLeg: [18, 0, 0],
              RightUpperLeg: [18, 0, 0],
              Tail: [-8, 0, 0],
            },
            0.12
          ),
        ],
      };

    case 'cheer':
    case 'celebrate':
      return {
        duration: 0.95,
        loop: true,
        keyframes: [
          mkC(
            0,
            {
              Spine: [8, 0, 0],
              Head: [6, 0, 0],
              LeftUpperArm: [-38, 0, 20],
              RightUpperArm: [-38, 0, -20],
              LeftLowerArm: [-28, 0, 0],
              RightLowerArm: [-28, 0, 0],
              LeftUpperLeg: [-18, 0, 0],
              RightUpperLeg: [-18, 0, 0],
              LeftWing: [0, 0, 10],
              RightWing: [0, 0, -10],
            },
            -0.04
          ),
          mkC(
            0.45,
            {
              Hips: [-10, 0, 0],
              Spine: [-8, 0, 0],
              Head: [-16, 12, 10],
              LeftUpperArm: [-142, 0, 24],
              RightUpperArm: [-142, 0, -24],
              LeftLowerArm: [-18, 0, 0],
              RightLowerArm: [-18, 0, 0],
              LeftUpperLeg: [-28, 0, 0],
              RightUpperLeg: [-28, 0, 0],
              LeftWing: [0, 0, -48],
              RightWing: [0, 0, 48],
              Tail: [18, 12, 0],
            },
            0.22,
            'easeOut'
          ),
          mkC(
            0.9,
            {
              Spine: [6, 0, 0],
              Head: [4, -10, -8],
              LeftUpperArm: [-110, 0, 30],
              RightUpperArm: [-110, 0, -30],
              LeftLowerArm: [-24, 0, 0],
              RightLowerArm: [-24, 0, 0],
              LeftWing: [0, 0, 8],
              RightWing: [0, 0, -8],
            },
            -0.02
          ),
        ],
      };

    case 'shy':
      return {
        duration: 1.3,
        loop: true,
        keyframes: [
          mkC(
            0,
            {
              Hips: [4, 12, 0],
              Spine: [8, 10, 0],
              Head: [18, -24, 14],
              LeftUpperArm: [-26, 22, -6],
              RightUpperArm: [-26, -22, 6],
              LeftLowerArm: [-68, 0, 0],
              RightLowerArm: [-68, 0, 0],
              LeftWing: [0, 0, 14],
              RightWing: [0, 0, -14],
              Tail: [-14, 0, 0],
            },
            -0.02
          ),
          mkC(
            0.5,
            {
              Hips: [6, -12, 0],
              Spine: [10, -10, 0],
              Head: [20, 24, -14],
              LeftUpperArm: [-30, 24, -6],
              RightUpperArm: [-30, -24, 6],
              LeftLowerArm: [-72, 0, 0],
              RightLowerArm: [-72, 0, 0],
              LeftWing: [0, 0, 16],
              RightWing: [0, 0, -16],
              Tail: [-18, 8, 0],
            },
            -0.03
          ),
        ],
      };

    case 'grumpy':
      return {
        duration: 1.0,
        loop: true,
        keyframes: [
          mkC(
            0,
            {
              Hips: [6, -8, 4],
              Spine: [10, -10, 0],
              Head: [16, 12, -12],
              LeftUpperArm: [-46, 38, -10],
              RightUpperArm: [-46, -38, 10],
              LeftLowerArm: [-84, 0, 0],
              RightLowerArm: [-84, 0, 0],
              LeftWing: [0, 0, -18],
              RightWing: [0, 0, 18],
              Tail: [22, 0, 0],
            },
            0
          ),
          mkC(
            0.35,
            {
              Hips: [10, 8, -4],
              Spine: [12, 10, 0],
              Head: [18, -14, 12],
              LeftUpperArm: [-48, 38, -12],
              RightUpperArm: [-48, -38, 12],
              LeftLowerArm: [-86, 0, 0],
              RightLowerArm: [-86, 0, 0],
              LeftUpperLeg: [-28, 0, 0],
              Tail: [26, 16, 0],
            },
            0.04
          ),
          mkC(
            0.7,
            {
              Hips: [6, -6, 4],
              Spine: [10, -8, 0],
              Head: [16, 10, -10],
              LeftUpperArm: [-46, 38, -10],
              RightUpperArm: [-46, -38, 10],
              LeftLowerArm: [-84, 0, 0],
              RightLowerArm: [-84, 0, 0],
              RightUpperLeg: [-28, 0, 0],
              Tail: [22, -16, 0],
            },
            0
          ),
        ],
      };

    case 'misfitPower':
      return {
        duration: 0.95,
        loop: false,
        keyframes: [
          mkC(
            0,
            {
              Hips: [14, 0, 0],
              Spine: [14, 0, 0],
              Head: [12, 0, 0],
              LeftUpperArm: [24, 0, 12],
              RightUpperArm: [24, 0, -12],
              LeftLowerArm: [-44, 0, 0],
              RightLowerArm: [-44, 0, 0],
              LeftUpperLeg: [-24, 0, 0],
              RightUpperLeg: [-24, 0, 0],
            },
            -0.06
          ),
          mkC(
            0.42,
            {
              Hips: [-14, 180, 0],
              Spine: [-10, 0, 0],
              Head: [-18, 0, 0],
              LeftUpperArm: [-128, 0, 44],
              RightUpperArm: [-128, 0, -44],
              LeftLowerArm: [-16, 0, 0],
              RightLowerArm: [-16, 0, 0],
              LeftUpperLeg: [-36, 0, 0],
              RightUpperLeg: [-20, 0, 0],
              LeftWing: [0, 0, -52],
              RightWing: [0, 0, 52],
              Tail: [24, 0, 0],
            },
            0.28,
            'easeOut'
          ),
          mkC(
            1.0,
            {
              Hips: [0, 360, 0],
              Spine: [0, 0, 0],
              Head: [0, 0, 0],
              LeftUpperArm: [0, 0, 0],
              RightUpperArm: [0, 0, 0],
            },
            0
          ),
        ],
        events: [{ id: uid(), time: 0.42, kind: 'impact', label: 'Misfit Trigger' }],
      };

    case 'wave':
      return {
        duration: 1.15,
        loop: true,
        keyframes: [
          mkC(
            0,
            {
              Spine: [-4, -6, 4],
              Head: [-6, 10, 8],
              RightUpperArm: [-124, 0, -30],
              RightLowerArm: [-32, 0, -24],
              LeftUpperArm: [6, 0, 10],
              LeftLowerArm: [-18, 0, 0],
              Tail: [8, 16, 0],
              LeftWing: [0, 0, -10],
              RightWing: [0, 0, 26],
            },
            0
          ),
          mkC(
            0.5,
            {
              Spine: [-4, 6, -4],
              Head: [-6, -10, -8],
              RightUpperArm: [-128, 0, -18],
              RightLowerArm: [-36, 0, 24],
              LeftUpperArm: [6, 0, 10],
              LeftLowerArm: [-18, 0, 0],
              Tail: [8, -16, 0],
              LeftWing: [0, 0, -10],
              RightWing: [0, 0, 12],
            },
            0
          ),
        ],
      };

    case 'laugh':
      return {
        duration: 1.15,
        loop: true,
        keyframes: [
          mkC(
            0,
            {
              Spine: [-10, 0, 0],
              Head: [-16, 0, 8],
              LeftUpperArm: [-38, 22, 10],
              RightUpperArm: [-38, -22, -10],
              LeftLowerArm: [-82, 0, 0],
              RightLowerArm: [-82, 0, 0],
              Tail: [16, 18, 0],
            },
            0
          ),
          mkC(
            0.25,
            {
              Spine: [-18, 8, 0],
              Head: [-24, 8, -8],
              LeftUpperArm: [-46, 26, 16],
              RightUpperArm: [-46, -26, -16],
              LeftLowerArm: [-92, 0, 0],
              RightLowerArm: [-92, 0, 0],
              Tail: [20, -18, 0],
              LeftWing: [0, 0, -26],
              RightWing: [0, 0, 26],
            },
            0.05
          ),
          mkC(0.5, { Spine: [-8, 0, 0], Head: [-12, 0, 8], Tail: [12, 14, 0] }, 0),
          mkC(
            0.75,
            {
              Spine: [-18, -8, 0],
              Head: [-24, -8, 8],
              LeftUpperArm: [-46, 26, 16],
              RightUpperArm: [-46, -26, -16],
              LeftLowerArm: [-92, 0, 0],
              RightLowerArm: [-92, 0, 0],
              Tail: [20, -18, 0],
              LeftWing: [0, 0, -26],
              RightWing: [0, 0, 26],
            },
            0.05
          ),
        ],
      };

    case 'dance':
      return {
        duration: 1.3,
        loop: true,
        keyframes: [
          mkC(
            0,
            {
              Hips: [4, -10, 6],
              Spine: [4, 12, -4],
              Head: [-6, 6, 10],
              LeftUpperArm: [-74, 0, 28],
              RightUpperArm: [-24, 0, -20],
              LeftLowerArm: [-68, 0, 0],
              RightLowerArm: [-42, 0, 0],
              LeftUpperLeg: [-18, 0, 0],
              Tail: [14, 22, 0],
              LeftWing: [0, 0, -24],
              RightWing: [0, 0, 12],
            },
            -0.03
          ),
          mkC(
            0.25,
            {
              Hips: [0, 0, 0],
              Spine: [-6, 0, 0],
              Head: [-10, 0, 0],
              LeftUpperArm: [-52, 0, 20],
              RightUpperArm: [-52, 0, -20],
              Tail: [18, 0, 0],
            },
            0.04
          ),
          mkC(
            0.5,
            {
              Hips: [4, 10, -6],
              Spine: [4, -12, 4],
              Head: [-6, -6, -10],
              LeftUpperArm: [-24, 0, 20],
              RightUpperArm: [-74, 0, -28],
              LeftLowerArm: [-42, 0, 0],
              RightLowerArm: [-68, 0, 0],
              RightUpperLeg: [-18, 0, 0],
              Tail: [14, -22, 0],
              LeftWing: [0, 0, -12],
              RightWing: [0, 0, 24],
            },
            -0.03
          ),
          mkC(
            0.75,
            {
              Hips: [0, 0, 0],
              Spine: [-6, 0, 0],
              Head: [-10, 0, 0],
              LeftUpperArm: [-52, 0, 20],
              RightUpperArm: [-52, 0, -20],
              Tail: [18, 0, 0],
            },
            0.04
          ),
        ],
      };

    case 'hurt':
      return {
        duration: 0.44,
        loop: false,
        keyframes: [
          mkC(
            0,
            {
              Spine: [-18, -12, 8],
              Head: [-18, 12, 12],
              LeftUpperArm: [-36, 0, 28],
              RightUpperArm: [-28, 0, -32],
              LeftLowerArm: [-24, 0, 0],
              RightLowerArm: [-24, 0, 0],
              LeftWing: [0, 0, -34],
              RightWing: [0, 0, 34],
              Tail: [-16, 0, 0],
            },
            -0.02,
            'easeOut'
          ),
          mkC(0.55, { Spine: [8, 4, 0], Head: [6, 0, 0], Tail: [4, 0, 0] }, 0),
          mkC(1.0, { Spine: [0, 0, 0], Head: [0, 0, 0] }, 0),
        ],
      };

    default:
      // All remaining slots (jump, swim, talk, interact, attack, swing, die, etc.)
      // return null so buildStandardMotionPresetTemplate uses the full articulated preset mapped to critter bones!
      return null;
  }
}

/**
 * Generates an editable keyframe preset for ANY built-in Hero, NPC, Buddy, or Monster/Enemy motion
 * so creators can inspect, tweak, and safely assign any animation in Motion Studio.
 */
export function buildStandardMotionPresetTemplate(
  slot: CustomClipSlot,
  boneMap: Partial<Record<string, string>>,
  customNameOrOpts?: string | BuildPresetTemplateOptions
): CustomMotionPreset {
  const opts: BuildPresetTemplateOptions =
    typeof customNameOrOpts === 'string'
      ? { customName: customNameOrOpts }
      : customNameOrOpts ?? {};

  const slotMeta = MOTION_SLOT_META_BY_SLOT[slot];
  const fallbackMeta = STANDARD_MOTION_SLOTS.find((s) => s.slot === slot);
  const archetype = opts.rigArchetype ?? 'humanoid';
  const availableSet =
    opts.availableBoneNames && opts.availableBoneNames.length > 0
      ? new Set(opts.availableBoneNames)
      : null;

  const mkFrame = (
    time: number,
    roles: RolePoseMap,
    hipsOffsetY = 0,
    easing: MotionEasing = 'smooth'
  ): CustomPoseKeyframe => ({
    id: uid(),
    time,
    bones: mapRolePosesToBoneMap(boneMap, roles),
    hipsOffsetY,
    easing,
  });

  if (archetype === 'quadruped') {
    const q = buildQuadrupedPresetKeyframes(slot, availableSet);
    return {
      id: uid(),
      name: opts.customName ?? slotMeta?.label ?? fallbackMeta?.label ?? slot,
      slot,
      duration: q.duration,
      loop: q.loop,
      autoCloseLoop: q.loop,
      easing: 'smooth',
      keyframes: q.keyframes,
      events: q.events,
      actorCategory: opts.actorCategory ?? 'enemy',
      rigArchetype: 'quadruped',
      hipsHeightRef: opts.hipsHeightRef ?? 0.9,
      sourcePresetId: `builtin_${slot}`,
      updatedAt: new Date().toISOString(),
    };
  }

  if (archetype === 'critter') {
    const c = buildCritterPresetKeyframes(slot, availableSet);
    if (c) {
      return {
        id: uid(),
        name: opts.customName ?? slotMeta?.label ?? fallbackMeta?.label ?? slot,
        slot,
        duration: c.duration,
        loop: c.loop,
        autoCloseLoop: c.loop,
        easing: 'smooth',
        keyframes: c.keyframes,
        events: c.events,
        actorCategory: opts.actorCategory ?? 'buddy',
        rigArchetype: 'critter',
        hipsHeightRef: opts.hipsHeightRef ?? 0.36,
        sourcePresetId: `builtin_${slot}`,
        updatedAt: new Date().toISOString(),
      };
    }
  }

  // Humanoid / Articulated NPC / Procedural Baddie / Critter-Humanoid fallback sequence templates
  let duration = slotMeta?.defaultDuration ?? 1.0;
  let loop = slotMeta?.loop ?? true;
  let keyframes: CustomPoseKeyframe[];
  let events: MotionEventMarker[] | undefined;

  switch (slot) {
    case 'idle':
      duration = 2.0;
      loop = true;
      keyframes = [
        mkFrame(0, { spine: [2, 0, 0], chest: [2, 0, 0], head: [2, 6, 2], leftUpperArm: [2, 0, -6], rightUpperArm: [-2, 0, 6], leftLowerArm: [-8, 0, 0], rightLowerArm: [-8, 0, 0] }, 0),
        mkFrame(0.5, { spine: [4, 0, 0], chest: [4, 0, 0], head: [-2, -6, -2], leftUpperArm: [-2, 0, -8], rightUpperArm: [2, 0, 8], leftLowerArm: [-10, 0, 0], rightLowerArm: [-10, 0, 0] }, 0),
      ];
      break;

    case 'walk':
      duration = 0.9;
      loop = true;
      keyframes = [
        mkFrame(0, { hips: [2, -4, 2], spine: [3, 4, -1], chest: [2, 3, 0], head: [-2, -3, 0], leftUpperLeg: [-28, 0, 0], leftLowerLeg: [8, 0, 0], rightUpperLeg: [24, 0, 0], rightLowerLeg: [16, 0, 0], leftUpperArm: [18, 0, -4], leftLowerArm: [-14, 0, 0], rightUpperArm: [-18, 0, 4], rightLowerArm: [-24, 0, 0] }, 0),
        mkFrame(0.25, { hips: [3, 0, 3], spine: [4, 0, -2], chest: [2, 0, 0], leftUpperLeg: [-8, 0, 0], leftLowerLeg: [22, 0, 0], rightUpperLeg: [6, 0, 0], rightLowerLeg: [48, 0, 0], leftUpperArm: [6, 0, -4], rightUpperArm: [-6, 0, 4] }, -0.025),
        mkFrame(0.5, { hips: [2, 4, -2], spine: [3, -4, 1], chest: [2, -3, 0], head: [-2, 3, 0], leftUpperLeg: [24, 0, 0], leftLowerLeg: [16, 0, 0], rightUpperLeg: [-28, 0, 0], rightLowerLeg: [8, 0, 0], leftUpperArm: [-18, 0, -4], leftLowerArm: [-24, 0, 0], rightUpperArm: [18, 0, 4], rightLowerArm: [-14, 0, 0] }, 0),
        mkFrame(0.75, { hips: [3, 0, -3], spine: [4, 0, 2], chest: [2, 0, 0], leftUpperLeg: [6, 0, 0], leftLowerLeg: [48, 0, 0], rightUpperLeg: [-8, 0, 0], rightLowerLeg: [22, 0, 0], leftUpperArm: [-6, 0, -4], rightUpperArm: [6, 0, 4] }, -0.025),
      ];
      break;

    case 'run':
      duration = 0.62;
      loop = true;
      keyframes = [
        mkFrame(0, { hips: [6, -7, 3], spine: [10, 7, -2], chest: [6, 6, 0], head: [-8, -5, 0], leftUpperLeg: [-42, 0, 0], leftLowerLeg: [14, 0, 0], rightUpperLeg: [36, 0, 0], rightLowerLeg: [44, 0, 0], leftUpperArm: [34, 0, -6], leftLowerArm: [-44, 0, 0], rightUpperArm: [-36, 0, 6], rightLowerArm: [-54, 0, 0] }, 0.02),
        mkFrame(0.25, { hips: [8, 0, 4], spine: [12, 0, -3], leftUpperLeg: [-10, 0, 0], leftLowerLeg: [34, 0, 0], rightUpperLeg: [-14, 0, 0], rightLowerLeg: [76, 0, 0], leftUpperArm: [12, 0, -6], rightUpperArm: [-12, 0, 6] }, -0.045),
        mkFrame(0.5, { hips: [6, 7, -3], spine: [10, -7, 2], chest: [6, -6, 0], head: [-8, 5, 0], leftUpperLeg: [36, 0, 0], leftLowerLeg: [44, 0, 0], rightUpperLeg: [-42, 0, 0], rightLowerLeg: [14, 0, 0], leftUpperArm: [-36, 0, -6], leftLowerArm: [-54, 0, 0], rightUpperArm: [34, 0, 6], rightLowerArm: [-44, 0, 0] }, 0.02),
        mkFrame(0.75, { hips: [8, 0, -4], spine: [12, 0, 3], leftUpperLeg: [-14, 0, 0], leftLowerLeg: [76, 0, 0], rightUpperLeg: [-10, 0, 0], rightLowerLeg: [34, 0, 0], leftUpperArm: [-12, 0, -6], rightUpperArm: [12, 0, 6] }, -0.045),
      ];
      break;

    case 'jump':
      duration = 0.78;
      loop = false;
      keyframes = [
        mkFrame(0, { spine: [12, 0, 0], leftUpperLeg: [-28, 0, 0], rightUpperLeg: [-28, 0, 0], leftLowerLeg: [44, 0, 0], rightLowerLeg: [44, 0, 0], leftUpperArm: [24, 0, -8], rightUpperArm: [24, 0, 8] }, -0.08, 'easeIn'),
        mkFrame(0.38, { spine: [-6, 0, 0], head: [-10, 0, 0], leftUpperArm: [-105, 0, -28], rightUpperArm: [-105, 0, 28], leftLowerArm: [-32, 0, 0], rightLowerArm: [-32, 0, 0], leftUpperLeg: [-42, 0, 0], leftLowerLeg: [64, 0, 0], rightUpperLeg: [-20, 0, 0], rightLowerLeg: [40, 0, 0] }, 0.24, 'easeOut'),
        mkFrame(0.78, { spine: [14, 0, 0], leftUpperLeg: [-32, 0, 0], rightUpperLeg: [-32, 0, 0], leftLowerLeg: [52, 0, 0], rightLowerLeg: [52, 0, 0], leftUpperArm: [-16, 0, -18], rightUpperArm: [-16, 0, 18] }, -0.09),
        mkFrame(1.0, { spine: [0, 0, 0] }, 0),
      ];
      events = [{ id: uid(), time: 0.78, kind: 'grounded', label: 'Foot Land' }];
      break;

    case 'swim':
      duration = 1.0;
      loop = true;
      keyframes = [
        mkFrame(0, { spine: [14, 10, 0], chest: [10, 8, 0], head: [-20, 8, 0], leftUpperArm: [-88, 0, -22], rightUpperArm: [-18, 0, 22], leftLowerArm: [-24, 0, 0], rightLowerArm: [-44, 0, 0], leftUpperLeg: [24, 0, 0], rightUpperLeg: [-4, 0, 0] }, 0),
        mkFrame(0.5, { spine: [14, -10, 0], chest: [10, -8, 0], head: [-20, -8, 0], leftUpperArm: [-18, 0, -22], rightUpperArm: [-88, 0, 22], leftLowerArm: [-44, 0, 0], rightLowerArm: [-24, 0, 0], leftUpperLeg: [-4, 0, 0], rightUpperLeg: [24, 0, 0] }, 0),
      ];
      break;

    case 'attack':
      duration = 0.52;
      loop = false;
      keyframes = [
        mkFrame(0, { spine: [-6, -26, 0], chest: [-4, -16, 0], head: [0, 22, 0], rightUpperArm: [22, -44, 62], rightLowerArm: [54, 0, 20], leftUpperArm: [-14, 0, -14], leftLowerArm: [-28, 0, 0], leftUpperLeg: [-14, 0, 0], rightUpperLeg: [14, 0, 0] }, 0, 'easeOut'),
        mkFrame(0.45, { spine: [14, 34, 0], chest: [10, 22, 0], head: [-4, -26, 0], rightUpperArm: [-68, 56, 26], rightLowerArm: [-24, 0, -16], leftUpperArm: [22, 0, -10], leftLowerArm: [-26, 0, 0], leftUpperLeg: [-18, 0, 0], leftLowerLeg: [24, 0, 0], rightUpperLeg: [18, 0, 0] }, -0.02, 'easeOut'),
        mkFrame(0.76, { spine: [10, 18, 0], rightUpperArm: [-52, 42, 16], rightLowerArm: [-36, 0, 0], leftUpperArm: [-10, 0, -12] }, 0),
        mkFrame(1.0, { spine: [0, 0, 0], rightUpperArm: [-8, 0, 6], rightLowerArm: [-14, 0, 0], leftUpperArm: [0, 0, -6] }, 0),
      ];
      events = [{ id: uid(), time: 0.45, kind: 'impact', label: 'Blade Hit Window' }];
      break;

    case 'swing':
      duration = 0.65;
      loop = false;
      keyframes = [
        mkFrame(0, { spine: [-14, -30, 0], chest: [-10, -18, 0], rightUpperArm: [-125, -24, 36], rightLowerArm: [-46, 0, 0], leftUpperArm: [-48, 22, -16], leftLowerArm: [-42, 0, 0] }, 0.02, 'easeOut'),
        mkFrame(0.45, { spine: [22, 28, 0], chest: [14, 20, 0], rightUpperArm: [-45, 38, 18], rightLowerArm: [-18, 0, 0], leftUpperArm: [18, 0, -14], leftUpperLeg: [-22, 0, 0], leftLowerLeg: [30, 0, 0] }, -0.05, 'easeIn'),
        mkFrame(0.75, { spine: [10, 10, 0], rightUpperArm: [-26, 16, 10] }, -0.02),
        mkFrame(1.0, { spine: [0, 0, 0] }, 0),
      ];
      events = [{ id: uid(), time: 0.45, kind: 'impact', label: 'Axe Chop Impact' }];
      break;

    case 'block':
      // Matches Hero Front Shield Guard Pose (shield held upright directly in front of chest)
      duration = 0.8;
      loop = true;
      keyframes = [
        mkFrame(0, { hips: [5, 11, 0], spine: [6, 10, 0], chest: [5, 9, 0], head: [-3, -12, 0], leftUpperArm: [-36, -39, -12], leftLowerArm: [-60, -48, 0], rightUpperArm: [-16, -8, 10], rightLowerArm: [-26, 0, 0], leftUpperLeg: [-6, 0, 0], rightUpperLeg: [4, 0, 0], leftLowerLeg: [10, 0, 0], rightLowerLeg: [8, 0, 0] }, -0.02),
        mkFrame(0.5, { hips: [6, 13, 0], spine: [7, 11, 0], chest: [6, 10, 0], head: [-4, -14, 0], leftUpperArm: [-39, -42, -14], leftLowerArm: [-63, -50, 0], rightUpperArm: [-18, -10, 10], rightLowerArm: [-28, 0, 0], leftUpperLeg: [-8, 0, 0], rightUpperLeg: [6, 0, 0], leftLowerLeg: [12, 0, 0], rightLowerLeg: [10, 0, 0] }, -0.03),
      ];
      break;

    case 'parry':
      duration = 0.45;
      loop = false;
      keyframes = [
        mkFrame(0, { spine: [6, 14, 0], leftUpperArm: [-38, -38, -12], leftLowerArm: [-62, -48, 0] }, -0.02),
        mkFrame(0.36, { spine: [10, -24, 0], chest: [8, -18, 0], leftUpperArm: [-78, 12, -22], leftLowerArm: [-22, -12, 0], rightUpperArm: [18, 0, 12] }, 0.02, 'easeOut'),
        mkFrame(1.0, { spine: [4, 10, 0], leftUpperArm: [-36, -38, -12], leftLowerArm: [-60, -48, 0] }, -0.01),
      ];
      events = [{ id: uid(), time: 0.36, kind: 'impact', label: 'Parry Deflect' }];
      break;

    case 'knockdown':
      // Lands on rump, bounces lightly, then automatically pushes back up!
      duration = 1.45;
      loop = false;
      keyframes = [
        mkFrame(0, { spine: [-18, 0, 0], head: [14, 0, 0], leftUpperArm: [-62, 0, -32], rightUpperArm: [-62, 0, 32], leftUpperLeg: [-48, 10, 0], rightUpperLeg: [-48, -10, 0] }, 0.14, 'easeIn'),
        mkFrame(0.28, { hips: [-34, 0, 0], spine: [-20, 0, 0], head: [18, 0, 0], leftUpperArm: [24, 0, -34], rightUpperArm: [24, 0, 34], leftLowerArm: [-32, 0, 0], rightLowerArm: [-32, 0, 0], leftUpperLeg: [-78, 14, 0], rightUpperLeg: [-78, -14, 0], leftLowerLeg: [36, 0, 0], rightLowerLeg: [36, 0, 0] }, -0.34, 'elastic'),
        mkFrame(0.48, { hips: [-28, 0, 0], spine: [-10, 0, 0], head: [12, 6, 0], leftUpperArm: [16, 0, -28], rightUpperArm: [16, 0, 28], leftUpperLeg: [-72, 12, 0], rightUpperLeg: [-72, -12, 0], leftLowerLeg: [48, 0, 0], rightLowerLeg: [48, 0, 0] }, -0.26, 'smooth'),
        mkFrame(0.76, { hips: [0, 0, 0], spine: [26, 0, 0], head: [-14, 0, 0], leftUpperArm: [-48, 0, -16], rightUpperArm: [-48, 0, 16], leftUpperLeg: [-64, 0, 0], rightUpperLeg: [-24, 0, 0], leftLowerLeg: [82, 0, 0], rightLowerLeg: [42, 0, 0] }, -0.14, 'easeOut'),
        mkFrame(1.0, { spine: [0, 0, 0] }, 0),
      ];
      events = [
        { id: uid(), time: 0.28, kind: 'impact', label: 'Rump Hit & Bounce' },
        { id: uid(), time: 0.92, kind: 'recover', label: 'Back On Feet' },
      ];
      break;

    case 'getUp':
      duration = 0.75;
      loop = false;
      keyframes = [
        mkFrame(0, { hips: [-24, 0, 0], spine: [28, 0, 0], leftUpperLeg: [-72, 0, 0], rightUpperLeg: [-36, 0, 0], leftLowerLeg: [84, 0, 0], rightLowerLeg: [62, 0, 0] }, -0.26),
        mkFrame(0.55, { spine: [18, 0, 0], leftUpperLeg: [-32, 0, 0], rightUpperLeg: [12, 0, 0], leftLowerLeg: [42, 0, 0] }, -0.08),
        mkFrame(1.0, { spine: [0, 0, 0] }, 0),
      ];
      break;

    case 'hurt':
      duration = 0.42;
      loop = false;
      keyframes = [
        mkFrame(0, { spine: [-16, -10, 6], head: [-14, 8, 8], leftUpperArm: [-32, 0, -24], rightUpperArm: [-24, 0, 28] }, -0.02, 'easeOut'),
        mkFrame(0.55, { spine: [6, 4, 0], head: [4, 0, 0] }, 0),
        mkFrame(1.0, { spine: [0, 0, 0] }, 0),
      ];
      break;

    case 'die':
    case 'dying':
      duration = 1.4;
      loop = false;
      keyframes = [
        mkFrame(0, { spine: [-14, 0, 0], head: [-14, 0, 0], leftUpperArm: [-26, 0, -24], rightUpperArm: [-26, 0, 24] }, 0),
        mkFrame(0.36, { hips: [10, 0, 0], spine: [24, 0, 0], head: [20, 0, 0], leftUpperLeg: [-62, 0, 0], rightUpperLeg: [-62, 0, 0], leftLowerLeg: [92, 0, 0], rightLowerLeg: [92, 0, 0], leftUpperArm: [12, 0, -20], rightUpperArm: [12, 0, 20] }, -0.22, 'easeIn'),
        mkFrame(1.0, { hips: [78, 0, 14], spine: [10, 0, 0], head: [14, 18, 12], leftUpperArm: [-120, 0, -34], rightUpperArm: [-110, 0, 34], leftUpperLeg: [-14, 0, -8], rightUpperLeg: [-18, 0, 8] }, -0.44, 'easeOut'),
      ];
      events = [{ id: uid(), time: 0.92, kind: 'collapse', label: 'Defeat Collapse' }];
      break;

    case 'celebrate':
    case 'cheer':
      duration = 1.35;
      loop = true;
      keyframes = [
        mkFrame(0, { spine: [6, 0, 0], leftUpperLeg: [-18, 0, 0], rightUpperLeg: [-18, 0, 0], leftLowerLeg: [28, 0, 0], rightLowerLeg: [28, 0, 0], leftUpperArm: [-40, 0, -18], rightUpperArm: [-40, 0, 18] }, -0.05),
        mkFrame(0.35, { spine: [-8, 0, 0], head: [-14, 8, 8], leftUpperArm: [-148, 0, -28], rightUpperArm: [-148, 0, 28], leftLowerArm: [-16, 0, 0], rightLowerArm: [-16, 0, 0], leftUpperLeg: [-24, 0, 0], leftLowerLeg: [44, 0, 0], rightUpperLeg: [-24, 0, 0], rightLowerLeg: [44, 0, 0] }, 0.22, 'easeOut'),
        mkFrame(0.7, { spine: [4, 0, 0], leftUpperArm: [-120, 0, -36], rightUpperArm: [-120, 0, 36] }, -0.03),
      ];
      break;

    case 'wave':
    case 'interact':
      duration = 1.15;
      loop = true;
      keyframes = [
        mkFrame(0, { spine: [-3, -6, 3], head: [-4, 8, 8], rightUpperArm: [-118, 0, 34], rightLowerArm: [-32, 0, -22], leftUpperArm: [4, 0, -8], leftLowerArm: [-14, 0, 0] }, 0),
        mkFrame(0.5, { spine: [-3, 4, -3], head: [-4, -8, -8], rightUpperArm: [-122, 0, 22], rightLowerArm: [-36, 0, 24], leftUpperArm: [4, 0, -8], leftLowerArm: [-14, 0, 0] }, 0.015),
      ];
      break;

    case 'talk':
      duration = 1.5;
      loop = true;
      keyframes = [
        mkFrame(0, { spine: [4, -10, 0], head: [-4, 12, 6], rightUpperArm: [-46, 12, 16], rightLowerArm: [-68, 0, 0], leftUpperArm: [-32, -8, -12], leftLowerArm: [-52, 0, 0] }, 0),
        mkFrame(0.35, { spine: [2, 8, 0], head: [6, -8, -4], rightUpperArm: [-62, -6, 22], rightLowerArm: [-52, 0, 0], leftUpperArm: [-56, 12, -20], leftLowerArm: [-66, 0, 0] }, 0.01),
        mkFrame(0.7, { spine: [5, -6, 0], head: [-6, 4, 8], rightUpperArm: [-54, 14, 12], rightLowerArm: [-78, 0, 0], leftUpperArm: [-38, 0, -14], leftLowerArm: [-44, 0, 0] }, 0),
      ];
      break;

    case 'laugh':
      duration = 1.15;
      loop = true;
      keyframes = [
        mkFrame(0, { spine: [-8, 0, 0], head: [-14, 0, 6], leftUpperArm: [-38, 22, -10], rightUpperArm: [-38, -22, 10], leftLowerArm: [-84, 0, 0], rightLowerArm: [-84, 0, 0] }, 0),
        mkFrame(0.25, { spine: [-14, 6, 0], head: [-20, 6, -6], leftUpperArm: [-44, 24, -14], rightUpperArm: [-44, -24, 14], leftLowerArm: [-92, 0, 0], rightLowerArm: [-92, 0, 0] }, 0.04),
        mkFrame(0.5, { spine: [-6, 0, 0], head: [-10, 0, 6] }, -0.01),
        mkFrame(0.75, { spine: [-14, -6, 0], head: [-20, -6, 6], leftUpperArm: [-44, 24, -14], rightUpperArm: [-44, -24, 14], leftLowerArm: [-92, 0, 0], rightLowerArm: [-92, 0, 0] }, 0.04),
      ];
      break;

    case 'dance':
      duration = 1.3;
      loop = true;
      keyframes = [
        mkFrame(0, { hips: [4, -10, 6], spine: [4, 10, -4], head: [-4, 0, 8], leftUpperArm: [-68, 0, -28], rightUpperArm: [-24, 0, 22], leftLowerArm: [-68, 0, 0], rightLowerArm: [-42, 0, 0], leftUpperLeg: [-14, 0, 0], leftLowerLeg: [24, 0, 0] }, -0.03),
        mkFrame(0.25, { hips: [0, 0, 0], spine: [-4, 0, 0], leftUpperArm: [-48, 0, -20], rightUpperArm: [-48, 0, 20] }, 0.03),
        mkFrame(0.5, { hips: [4, 10, -6], spine: [4, -10, 4], head: [-4, 0, -8], leftUpperArm: [-24, 0, -22], rightUpperArm: [-68, 0, 28], leftLowerArm: [-42, 0, 0], rightLowerArm: [-68, 0, 0], rightUpperLeg: [-14, 0, 0], rightLowerLeg: [24, 0, 0] }, -0.03),
        mkFrame(0.75, { hips: [0, 0, 0], spine: [-4, 0, 0], leftUpperArm: [-48, 0, -20], rightUpperArm: [-48, 0, 20] }, 0.03),
      ];
      break;

    case 'shy':
      duration = 1.3;
      loop = true;
      keyframes = [
        mkFrame(0, { spine: [6, 12, 0], head: [14, -22, 12], leftUpperArm: [-24, 22, -6], rightUpperArm: [-24, -22, 6], leftLowerArm: [-64, 0, 0], rightLowerArm: [-64, 0, 0] }, -0.02),
        mkFrame(0.5, { spine: [8, -12, 0], head: [16, 22, -12], leftUpperArm: [-28, 24, -6], rightUpperArm: [-28, -24, 6], leftLowerArm: [-68, 0, 0], rightLowerArm: [-68, 0, 0] }, -0.03),
      ];
      break;

    case 'grumpy':
      duration = 1.1;
      loop = true;
      keyframes = [
        mkFrame(0, { spine: [8, -8, 0], head: [12, 10, -6], leftUpperArm: [-46, 38, 12], rightUpperArm: [-46, -38, -12], leftLowerArm: [-84, 0, 0], rightLowerArm: [-84, 0, 0] }, 0),
        mkFrame(0.5, { spine: [10, 8, 0], head: [14, -10, 6], leftUpperLeg: [-18, 0, 0], leftLowerLeg: [24, 0, 0], leftUpperArm: [-46, 38, 12], rightUpperArm: [-46, -38, -12], leftLowerArm: [-84, 0, 0], rightLowerArm: [-84, 0, 0] }, 0.02),
      ];
      break;

    case 'sit':
      duration = 1.4;
      loop = true;
      keyframes = [
        mkFrame(0, { spine: [4, 0, 0], leftUpperLeg: [-82, 6, 0], rightUpperLeg: [-82, -6, 0], leftLowerLeg: [84, 0, 0], rightLowerLeg: [84, 0, 0], leftUpperArm: [-24, 0, -12], rightUpperArm: [-24, 0, 12], leftLowerArm: [-35, 0, 0], rightLowerArm: [-35, 0, 0] }, -0.28),
        mkFrame(0.5, { spine: [8, 0, 0], head: [4, 4, 0], leftUpperLeg: [-82, 6, 0], rightUpperLeg: [-82, -6, 0], leftLowerLeg: [84, 0, 0], rightLowerLeg: [84, 0, 0], leftUpperArm: [-22, 0, -12], rightUpperArm: [-22, 0, 12], leftLowerArm: [-36, 0, 0], rightLowerArm: [-36, 0, 0] }, -0.29),
      ];
      break;

    case 'hold':
      duration = 1.2;
      loop = true;
      keyframes = [
        mkFrame(0, { spine: [4, 0, 0], rightUpperArm: [-42, 8, 10], rightLowerArm: [-48, 0, 0], leftUpperArm: [2, 0, -6], leftLowerArm: [-12, 0, 0] }, 0),
        mkFrame(0.5, { spine: [6, 0, 0], rightUpperArm: [-45, 8, 10], rightLowerArm: [-50, 0, 0], leftUpperArm: [4, 0, -6] }, 0.015),
      ];
      break;

    case 'throw':
      duration = 0.65;
      loop = false;
      keyframes = [
        mkFrame(0, { spine: [-10, -28, 0], rightUpperArm: [-135, -18, 32], rightLowerArm: [-68, 0, 0], leftUpperArm: [-42, 16, -14] }, 0),
        mkFrame(0.42, { spine: [18, 32, 0], rightUpperArm: [-48, 22, 12], rightLowerArm: [-14, 0, 0], leftUpperArm: [18, 0, -14] }, 0, 'easeOut'),
        mkFrame(1.0, { spine: [0, 0, 0] }, 0),
      ];
      events = [{ id: uid(), time: 0.42, kind: 'impact', label: 'Projectile Release' }];
      break;

    case 'sleep':
      duration = 2.0;
      loop = true;
      keyframes = [
        mkFrame(0, { hips: [-86, 0, 0], spine: [2, 0, 0], head: [6, 8, 6], leftUpperArm: [-10, 0, -14], rightUpperArm: [-10, 0, 14], leftUpperLeg: [-6, 0, 0], rightUpperLeg: [-8, 0, 0] }, -0.44),
        mkFrame(0.5, { hips: [-86, 0, 0], spine: [5, 0, 0], chest: [4, 0, 0], head: [6, 8, 6], leftUpperArm: [-10, 0, -14], rightUpperArm: [-10, 0, 14] }, -0.44),
      ];
      break;

    case 'fishing':
      duration = 1.4;
      loop = true;
      keyframes = [
        mkFrame(0, { spine: [4, 8, 0], rightUpperArm: [-44, 8, 12], rightLowerArm: [-28, 0, 0], leftUpperArm: [-26, -12, -12], leftLowerArm: [-36, 0, 0] }, 0),
        mkFrame(0.5, { spine: [6, 10, 0], rightUpperArm: [-52, 8, 12], rightLowerArm: [-34, 0, 0], leftUpperArm: [-30, -12, -12], leftLowerArm: [-38, 0, 0] }, 0.015),
      ];
      break;

    case 'lift':
      duration = 1.0;
      loop = false;
      keyframes = [
        mkFrame(0, { spine: [24, 0, 0], leftUpperLeg: [-44, 0, 0], rightUpperLeg: [-44, 0, 0], leftLowerLeg: [62, 0, 0], rightLowerLeg: [62, 0, 0], leftUpperArm: [-56, 0, -12], rightUpperArm: [-56, 0, 12] }, -0.18),
        mkFrame(0.6, { spine: [-4, 0, 0], leftUpperArm: [-128, 0, -14], rightUpperArm: [-128, 0, 14], leftLowerArm: [-42, 0, 0], rightLowerArm: [-42, 0, 0] }, 0.02, 'easeOut'),
        mkFrame(1.0, { spine: [0, 0, 0], leftUpperArm: [-68, 0, -10], rightUpperArm: [-68, 0, 10], leftLowerArm: [-44, 0, 0], rightLowerArm: [-44, 0, 0] }, 0),
      ];
      break;

    case 'pull':
      duration = 0.9;
      loop = true;
      keyframes = [
        mkFrame(0, { spine: [-10, 0, 0], leftUpperArm: [-64, 10, -10], rightUpperArm: [-64, -10, 10], leftLowerArm: [-42, 0, 0], rightLowerArm: [-42, 0, 0], leftUpperLeg: [-24, 0, 0], rightUpperLeg: [14, 0, 0] }, 0),
        mkFrame(0.5, { spine: [-20, 0, 0], leftUpperArm: [-46, 10, -10], rightUpperArm: [-46, -10, 10], leftLowerArm: [-72, 0, 0], rightLowerArm: [-72, 0, 0], leftUpperLeg: [-30, 0, 0], rightUpperLeg: [18, 0, 0] }, -0.04),
      ];
      break;

    case 'push':
      duration = 0.9;
      loop = true;
      keyframes = [
        mkFrame(0, { spine: [20, 0, 0], leftUpperArm: [-78, 0, -12], rightUpperArm: [-78, 0, 12], leftLowerArm: [-28, 0, 0], rightLowerArm: [-28, 0, 0], leftUpperLeg: [-24, 0, 0], rightUpperLeg: [28, 0, 0] }, 0),
        mkFrame(0.5, { spine: [28, 0, 0], leftUpperArm: [-88, 0, -8], rightUpperArm: [-88, 0, 8], leftLowerArm: [-10, 0, 0], rightLowerArm: [-10, 0, 0], leftUpperLeg: [-32, 0, 0], rightUpperLeg: [36, 0, 0] }, -0.02),
      ];
      break;

    case 'dig':
      duration = 0.95;
      loop = true;
      keyframes = [
        mkFrame(0, { spine: [12, -10, 0], rightUpperArm: [-48, 12, 12], leftUpperArm: [-64, -12, -12], rightLowerArm: [-36, 0, 0], leftLowerArm: [-30, 0, 0], leftUpperLeg: [-20, 0, 0], rightUpperLeg: [14, 0, 0] }, 0),
        mkFrame(0.45, { spine: [34, 8, 0], rightUpperArm: [-78, 14, 10], leftUpperArm: [-82, -14, -10], rightLowerArm: [-20, 0, 0], leftLowerArm: [-20, 0, 0], leftUpperLeg: [-28, 0, 0], leftLowerLeg: [38, 0, 0] }, -0.06),
      ];
      break;

    case 'climbVertical':
      duration = 0.9;
      loop = true;
      keyframes = [
        mkFrame(0, { spine: [10, 0, 0], leftUpperArm: [-138, 0, -16], leftLowerArm: [-44, 0, 0], rightUpperArm: [-70, 0, 16], rightLowerArm: [-68, 0, 0], leftUpperLeg: [-26, 0, 0], leftLowerLeg: [52, 0, 0], rightUpperLeg: [-76, 0, 0], rightLowerLeg: [92, 0, 0] }, 0),
        mkFrame(0.5, { spine: [10, 0, 0], leftUpperArm: [-70, 0, -16], leftLowerArm: [-68, 0, 0], rightUpperArm: [-138, 0, 16], rightLowerArm: [-44, 0, 0], leftUpperLeg: [-76, 0, 0], leftLowerLeg: [92, 0, 0], rightUpperLeg: [-26, 0, 0], rightLowerLeg: [52, 0, 0] }, 0),
      ];
      break;

    case 'climbStairs':
      duration = 0.78;
      loop = true;
      keyframes = [
        mkFrame(0, { spine: [12, 4, 0], leftUpperLeg: [-54, 0, 0], leftLowerLeg: [78, 0, 0], rightUpperLeg: [12, 0, 0], rightLowerLeg: [18, 0, 0], leftUpperArm: [24, 0, -8], rightUpperArm: [-28, 0, 8] }, 0.02),
        mkFrame(0.5, { spine: [12, -4, 0], leftUpperLeg: [12, 0, 0], leftLowerLeg: [18, 0, 0], rightUpperLeg: [-54, 0, 0], rightLowerLeg: [78, 0, 0], leftUpperArm: [-28, 0, -8], rightUpperArm: [24, 0, 8] }, 0.02),
      ];
      break;

    case 'crouch':
    case 'sneak':
      duration = slot === 'sneak' ? 1.05 : 1.2;
      loop = true;
      keyframes = [
        mkFrame(0, { spine: [18, 0, 0], head: [-20, 6, 0], leftUpperLeg: [-50, 0, 0], rightUpperLeg: [-44, 0, 0], leftLowerLeg: [78, 0, 0], rightLowerLeg: [72, 0, 0], leftUpperArm: [-16, 0, -12], rightUpperArm: [-16, 0, 12], leftLowerArm: [-42, 0, 0], rightLowerArm: [-42, 0, 0] }, -0.18),
        mkFrame(0.5, { spine: [20, 0, 0], head: [-22, -6, 0], leftUpperLeg: slot === 'sneak' ? [-36, 0, 0] : [-50, 0, 0], rightUpperLeg: slot === 'sneak' ? [-58, 0, 0] : [-44, 0, 0], leftLowerLeg: [72, 0, 0], rightLowerLeg: [82, 0, 0], leftUpperArm: [-20, 0, -12], rightUpperArm: [-12, 0, 12], leftLowerArm: [-44, 0, 0], rightLowerArm: [-44, 0, 0] }, -0.19),
      ];
      break;

    case 'stab':
      duration = 0.52;
      loop = false;
      keyframes = [
        mkFrame(0, { spine: [8, -22, 0], rightUpperArm: [-24, -10, 12], rightLowerArm: [-68, 0, 0], leftUpperArm: [-28, 0, -14], leftUpperLeg: [-14, 0, 0] }, 0),
        mkFrame(0.45, { spine: [16, 22, 0], rightUpperArm: [-88, 12, 6], rightLowerArm: [-6, 0, 0], leftUpperLeg: [-34, 0, 0], leftLowerLeg: [42, 0, 0], rightUpperLeg: [24, 0, 0] }, -0.04, 'easeOut'),
        mkFrame(1.0, { spine: [0, 0, 0] }, 0),
      ];
      events = [{ id: uid(), time: 0.45, kind: 'impact', label: 'Thrust Hit' }];
      break;

    case 'bowPull':
      duration = 0.85;
      loop = false;
      keyframes = [
        mkFrame(0, { spine: [4, -18, 0], head: [0, 24, 0], leftUpperArm: [-82, 24, -10], leftLowerArm: [-10, 0, 0], rightUpperArm: [-68, -14, 16], rightLowerArm: [-54, 0, 0] }, 0),
        mkFrame(0.65, { spine: [4, -26, 0], head: [-2, 34, 0], leftUpperArm: [-86, 32, -10], leftLowerArm: [-6, 0, 0], rightUpperArm: [-72, -26, 24], rightLowerArm: [-96, 0, 0] }, 0),
        mkFrame(1.0, { spine: [2, -16, 0], head: [0, 22, 0], leftUpperArm: [-84, 28, -10], rightUpperArm: [-66, -18, 18], rightLowerArm: [-36, 0, 0] }, 0),
      ];
      events = [{ id: uid(), time: 0.72, kind: 'impact', label: 'Arrow Loose' }];
      break;

    case 'hug':
      duration = 1.2;
      loop = false;
      keyframes = [
        mkFrame(0, { spine: [10, 0, 0], leftUpperArm: [-68, 28, -18], rightUpperArm: [-68, -28, 18], leftLowerArm: [-52, 0, 0], rightLowerArm: [-52, 0, 0] }, 0),
        mkFrame(0.5, { spine: [16, 0, 0], head: [6, 10, 8], leftUpperArm: [-78, 48, -8], rightUpperArm: [-78, -48, 8], leftLowerArm: [-68, 0, 0], rightLowerArm: [-68, 0, 0] }, 0),
        mkFrame(1.0, { spine: [0, 0, 0] }, 0),
      ];
      break;

    case 'punch':
      duration = 0.55;
      loop = false;
      keyframes = [
        mkFrame(0, { spine: [6, -24, 0], leftUpperArm: [-52, 16, -18], leftLowerArm: [-74, 0, 0], rightUpperArm: [18, -12, 24], rightLowerArm: [-88, 0, 0] }, 0),
        mkFrame(0.35, { spine: [14, 34, 0], chest: [6, 18, 0], leftUpperArm: [-40, 12, -22], leftLowerArm: [-86, 0, 0], rightUpperArm: [-92, 12, 6], rightLowerArm: [-8, 0, 0] }, 0, 'easeOut'),
        mkFrame(1.0, { spine: [4, 0, 0], leftUpperArm: [-36, 10, -16], rightUpperArm: [-36, -10, 16] }, 0),
      ];
      events = [{ id: uid(), time: 0.35, kind: 'impact', label: 'Punch Connect' }];
      break;

    case 'kick':
      duration = 0.65;
      loop = false;
      keyframes = [
        mkFrame(0, { spine: [-8, 0, 0], rightUpperLeg: [-36, 0, 0], rightLowerLeg: [92, 0, 0], leftUpperArm: [-42, 0, -26], rightUpperArm: [-20, 0, 28] }, 0),
        mkFrame(0.42, { spine: [-16, -14, 0], rightUpperLeg: [-92, 0, 0], rightLowerLeg: [8, 0, 0], leftUpperLeg: [14, 0, 0], leftLowerLeg: [12, 0, 0] }, 0, 'easeOut'),
        mkFrame(1.0, { spine: [0, 0, 0], rightUpperLeg: [0, 0, 0], rightLowerLeg: [6, 0, 0] }, 0),
      ];
      events = [{ id: uid(), time: 0.42, kind: 'impact', label: 'Kick Snap' }];
      break;

    case 'windup_headSway3':
      duration = 1.15;
      loop = false;
      keyframes = [
        mkFrame(0, { spine: [-4, 0, 0], head: [-6, 0, 0] }, 0),
        mkFrame(0.24, { spine: [-4, 12, 0], head: [-4, 24, -12], leftUpperArm: [-30, 0, -22], rightUpperArm: [-30, 0, 22] }, 0.02),
        mkFrame(0.5, { spine: [-4, -12, 0], head: [-4, -24, 12], leftUpperArm: [-34, 0, -24], rightUpperArm: [-34, 0, 24] }, 0.02),
        mkFrame(0.76, { spine: [-16, 0, 0], head: [-18, 0, 0], leftUpperArm: [-78, 0, -28], rightUpperArm: [-78, 0, 28] }, 0.06),
        mkFrame(1.0, { spine: [-16, 0, 0], head: [-18, 0, 0], leftUpperArm: [-80, 0, -28], rightUpperArm: [-80, 0, 28] }, 0.06),
      ];
      events = [{ id: uid(), time: 0.76, kind: 'windupLock', label: 'Strike Ready' }];
      break;

    default:
      duration = slotMeta?.defaultDuration ?? 0.9;
      loop = slotMeta?.loop ?? false;
      keyframes = [
        mkFrame(0, { spine: [-10, -14, 0], rightUpperArm: [-68, -16, 24], leftUpperArm: [-32, 12, -16] }, 0),
        mkFrame(0.45, { spine: [18, 16, 0], rightUpperArm: [-92, 24, 14], leftUpperArm: [-44, -10, -18] }, 0.04, 'easeOut'),
        mkFrame(1.0, { spine: [0, 0, 0] }, 0),
      ];
      break;
  }

  return {
    id: uid(),
    name: opts.customName ?? slotMeta?.label ?? fallbackMeta?.label ?? slot,
    slot,
    duration,
    loop,
    autoCloseLoop: loop,
    easing: 'smooth',
    keyframes,
    events,
    actorCategory: opts.actorCategory ?? 'hero',
    rigArchetype: archetype,
    hipsHeightRef: opts.hipsHeightRef ?? 0.56,
    sourcePresetId: `builtin_${slot}`,
    updatedAt: new Date().toISOString(),
  };
}
