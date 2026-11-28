import type {
  ActionButtonBinding,
  ActionGroup,
  BehaviorCard,
  BindableStat,
  BiomeId,
  BuildingBlockConfig,
  CameraMode,
  CharacterAction,
  ClauseDefinition,
  CompleteCondition,
  CraftingRecipe,
  DoorConfig,
  EntityKind,
  EntitySection,
  EnvironmentType,
  GameInventoryConfig,
  GameLevel,
  GameProject,
  GameTemplate,
  HUDProfile,
  HUDWidget,
  InventoryCategoryConfig,
  InventoryItemDef,
  InventoryStack,
  ItemMetadata,
  ItemRarity,
  LevelAudio,
  LevelEntity,
  MisfitAbilityId,
  MusicMood,
  RuleRecipe,
  SkyPresetId,
  SoundEffect,
  StorybookConfig,
  StorybookThemeId,
  StorySkit,
  TerrainBrush,
  VistaPresetId,
  VistaPropKind,
  WeatherKind,
  WidgetAnchor,
  WidgetKind,
  WorldCollectibleRule,
} from '../types/maker';
import { createDefaultFxEmitterConfig } from './fxEmitterPresets';
import { createShowcaseTwinFlameDrakeBlueprint } from './baddieActionLibrary';
import { createPlatformerModuleEntity, DEFAULT_PLATFORMER_MOVEMENT } from './platformerCatalog';
import { DEFAULT_ROGUELIKE_CONFIG, generateRoguelikeFloor } from './roguelikeEngine';
import {
  BuddiesLandmarks,
  carveRpgRiverGorgeTerrain,
  createBuddiesTerrain,
  createDrivingTerrain,
  createFloatingIslandTerrain,
  createInitialTerrain,
  DrivingWaypoints,
  fromMountainCaveLocal,
  IslandTerrain,
  levelWorldToBoard,
  RiverCrossing,
  uid,
} from '../utils/terrain';
import { buildCanopyConfigFromUserDefaults } from '../utils/defaultTreeStyles';

export const Palette = {
  background: '#0F1117',
  surface: '#171A23',
  surfaceAlt: '#1F2430',
  ink: '#F3F5FA',
  inkSoft: '#949BB0',
  inkFaint: '#6B7285',
  hairline: '#2A3040',
  accent: '#7C5CFF',
  plum: '#A855F7',
  amber: '#F59E0B',
  mint: '#20B46A',
  coral: '#F2545B',
  sky: '#38BDF8',
  gold: '#FACC15',
};

export const VisualStyles: {
  id: 'painterlyPBR' | 'celToon' | 'softFantasy';
  title: string;
  blurb: string;
}[] = [
  { id: 'painterlyPBR', title: 'Painterly PBR', blurb: 'Rich tactile PBR with atmospheric haze & sunlit bounce' },
  { id: 'celToon', title: 'BotW Stylized', blurb: 'Soft wrapped shading, cool shadow tint & sunlit sky rim' },
  { id: 'softFantasy', title: 'Soft Fantasy', blurb: 'Warm atmospheric bounce and gentle cozy highlights' },
];

export const CameraModes: {
  id: CameraMode;
  title: string;
  blurb: string;
}[] = [
  { id: 'front', title: 'Front', blurb: 'Close behind-the-hero view — hero stays right in front facing forward and the world turns with you' },
  { id: 'heroFront', title: 'Face View (Facing You)', blurb: 'Camera in front of your hero so you see them walk toward you with clear near foreground ahead' },
  { id: 'chase', title: 'Adventure Chase', blurb: 'Free look over-the-shoulder camera (drag sky to turn)' },
  { id: 'firstPerson', title: 'Character POV', blurb: 'First-person eye-level view from your character — drag mouse to look around' },
  { id: 'cozy', title: 'Cozy Close', blurb: 'Closer warm view framing your hero' },
  {
    id: 'close',
    title: 'Close View',
    blurb: 'Closer hero & interior perspective (auto-used inside cottages, taverns & caves)',
  },
  { id: 'isometric', title: 'Isometric Diorama', blurb: 'High angled classic adventure perspective' },
  { id: 'sideScroll', title: 'Side-Scroll 2.5D', blurb: 'Locked side-view camera showcasing 3D parallax layers' },
];

export const EnvironmentTypes: {
  id: EnvironmentType;
  title: string;
  blurb: string;
}[] = [
  { id: 'openWorld', title: 'Open World', blurb: 'Expansive 312m forested island with pine, oak & birch woods, winding river & dirt trail' },
  { id: 'dungeon', title: 'Dungeon', blurb: 'Damp stone chambers, craggy moss caves & wall torches' },
  { id: 'castle', title: 'Castle Hall', blurb: 'Grand stone courtyard, pillars, banners & throne dais' },
  { id: 'sideScroller', title: 'Platformer', blurb: 'Side-scrolling 3D cliff lane with multi-layer depth parallax' },
  { id: 'scifi', title: 'Sci-Fi Base', blurb: 'Alloy deck plating, energy conduits & crater rim' },
];

export const ActionButtonBindings: {
  id: ActionButtonBinding;
  title: string;
  shortcut: string;
  defaultColor: string;
}[] = [
  { id: 'jump', title: 'Jump', shortcut: 'Space / Shift', defaultColor: '#20B46A' },
  { id: 'attack', title: 'Hit / Sword', shortcut: 'F / Ctrl', defaultColor: '#F2545B' },
  { id: 'interact', title: 'Use / Talk', shortcut: 'E / Alt', defaultColor: '#F59E0B' },
  { id: 'magicBolt', title: 'Magic Bolt', shortcut: 'R', defaultColor: '#38BDF8' },
  { id: 'heal', title: 'Heal', shortcut: 'H', defaultColor: '#A855F7' },
];

export interface BiomeConfig {
  id: BiomeId;
  title: string;
  symbol: string;
  ground: string;
  detail: string;
  water: string;
}

export const Biomes: BiomeConfig[] = [
  { id: 'meadow', title: 'Meadow', symbol: 'leaf.fill', ground: '#8FD158', detail: '#5A9E38', water: '#2A88F0' },
  { id: 'island', title: 'Island', symbol: 'sun.max.fill', ground: '#EBD38F', detail: '#C4A552', water: '#2482EB' },
  { id: 'forest', title: 'Forest', symbol: 'tree.fill', ground: '#629952', detail: '#3D6E33', water: '#2B80E8' },
  { id: 'snow', title: 'Snow', symbol: 'snowflake', ground: '#DCE9F5', detail: '#B2C6DB', water: '#4696EA' },
  { id: 'desert', title: 'Desert', symbol: 'sun.dust.fill', ground: '#E8BC76', detail: '#C99048', water: '#2C84E6' },
  { id: 'cave', title: 'Cave', symbol: 'mountain.2.fill', ground: '#6A627A', detail: '#453F57', water: '#2A6BC4' },
  { id: 'swamp', title: 'Swamp', symbol: 'drop.fill', ground: '#738552', detail: '#4D5E34', water: '#3474C8' },
  { id: 'night', title: 'Night', symbol: 'moon.stars.fill', ground: '#4A557A', detail: '#313957', water: '#2560B8' },
];

export function getBiome(id: BiomeId): BiomeConfig {
  return Biomes.find((b) => b.id === id) ?? Biomes[0];
}

export interface SkyConfig {
  id: SkyPresetId;
  title: string;
  symbol: string;
  tint: string;
  bgHex: string;
  fogHex: string;
  sunColor: string;
  sunIntensity: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
}

export const SkyPresets: SkyConfig[] = [
  {
    id: 'sunny',
    title: 'Sunny noon',
    symbol: 'sun.max.fill',
    tint: Palette.sky,
    bgHex: '#8EC2E6',
    fogHex: '#A7CFE8',
    sunColor: '#FFF0D4',
    sunIntensity: 1.56,
    hemiSky: '#A8D2F0',
    hemiGround: '#4F663C',
    hemiIntensity: 0.66,
  },
  {
    id: 'golden',
    title: 'Golden hour',
    symbol: 'sunset.fill',
    tint: Palette.amber,
    bgHex: '#D88E5A',
    fogHex: '#C58258',
    sunColor: '#FFA95C',
    sunIntensity: 1.48,
    hemiSky: '#988DB2',
    hemiGround: '#3E3026',
    hemiIntensity: 0.62,
  },
  {
    id: 'night',
    title: 'Starry night',
    symbol: 'moon.stars.fill',
    tint: Palette.plum,
    bgHex: '#18213D',
    fogHex: '#1F2A4A',
    sunColor: '#B5C8FF',
    sunIntensity: 1.15,
    hemiSky: '#3A4D80',
    hemiGround: '#1E2438',
    hemiIntensity: 0.55,
  },
  {
    id: 'mist',
    title: 'Foggy morning',
    symbol: 'cloud.fog.fill',
    tint: Palette.inkSoft,
    bgHex: '#CBD8E2',
    fogHex: '#D5E0E8',
    sunColor: '#F4F7FA',
    sunIntensity: 1.3,
    hemiSky: '#DCE6EE',
    hemiGround: '#6A757D',
    hemiIntensity: 0.85,
  },
  {
    id: 'storm',
    title: 'Storm',
    symbol: 'cloud.bolt.fill',
    tint: '#5A6472',
    bgHex: '#435061',
    fogHex: '#505D70',
    sunColor: '#BFD0E8',
    sunIntensity: 1.1,
    hemiSky: '#68798F',
    hemiGround: '#2C3542',
    hemiIntensity: 0.65,
  },
  {
    id: 'cave',
    title: 'Underground',
    symbol: 'mountain.2.fill',
    tint: Palette.plum,
    bgHex: '#1D1829',
    fogHex: '#251F35',
    sunColor: '#D4B5FF',
    sunIntensity: 1.15,
    hemiSky: '#584480',
    hemiGround: '#221C30',
    hemiIntensity: 0.65,
  },
];

export function getSky(id: SkyPresetId): SkyConfig {
  return SkyPresets.find((s) => s.id === id) ?? SkyPresets[0];
}

export const WeatherOptions: { id: WeatherKind; title: string; symbol: string }[] = [
  { id: 'none', title: 'Clear', symbol: 'sun.max.fill' },
  { id: 'fireflies', title: 'Fireflies', symbol: 'sparkles' },
  { id: 'leaves', title: 'Leaves', symbol: 'leaf.fill' },
  { id: 'rain', title: 'Rain', symbol: 'cloud.rain.fill' },
  { id: 'storm', title: 'Stormy', symbol: 'cloud.bolt.fill' },
  { id: 'snow', title: 'Snow', symbol: 'snowflake' },
];

export const VistaPresets: { id: VistaPresetId; title: string; blurb: string }[] = [
  { id: 'alpineValley', title: 'Alpine Valley', blurb: 'Endless surrounding pine forests, rolling hills & snowy mountain peaks' },
  { id: 'coastalArchipelago', title: 'Archipelago', blurb: 'Distant forested islands & sea stacks dotted across the horizon' },
  { id: 'mistyHills', title: 'Misty Hills', blurb: 'Soft layered woodland hills stretching to the far horizon' },
  { id: 'volcanicPeaks', title: 'Craggy Peaks', blurb: 'Dramatic jagged mountains & rocky forest ridges' },
  { id: 'none', title: 'Ocean Only', blurb: 'Open endless sea horizon with no distant landmasses' },
];

export const VistaPropKinds: { id: VistaPropKind; title: string }[] = [
  { id: 'mountain', title: 'Mountain' },
  { id: 'pineCluster', title: 'Pines' },
  { id: 'oakCluster', title: 'Oaks' },
  { id: 'birchCluster', title: 'Birches' },
  { id: 'boulderRidge', title: 'Rocks' },
  { id: 'castleRuins', title: 'Tower' },
];

export const CompleteConditions: { id: CompleteCondition; title: string; symbol: string }[] = [
  { id: 'reachPortal', title: 'Reach the portal', symbol: 'sparkles' },
  { id: 'gatherBuddies', title: 'Gather all buddies & reach tavern', symbol: 'pawprint.fill' },
  { id: 'completeCourse', title: 'Drive through all checkpoints', symbol: 'car.fill' },
  { id: 'collectAll', title: 'Collect treasures', symbol: 'gift.fill' },
  { id: 'defeatAll', title: 'Defeat every baddie', symbol: 'bolt.fill' },
  { id: 'solvePuzzle', title: 'Solve the puzzle', symbol: 'square.grid.2x2.fill' },
  { id: 'collectKeys', title: 'Find the keys', symbol: 'key.fill' },
  { id: 'talkToNPC', title: 'Talk to someone', symbol: 'bubble.left.fill' },
];

export const EntitySectionMeta: {
  id: EntitySection;
  title: string;
  symbol: string;
  blurb: string;
}[] = [
  { id: 'cast', title: 'Cast', symbol: 'person.2.fill', blurb: 'Hero, friends and baddies.' },
  { id: 'things', title: 'Things', symbol: 'gift.fill', blurb: 'Chests, keys, doors and pickups.' },
  { id: 'hazards', title: 'Hazards', symbol: 'exclamationmark.triangle.fill', blurb: 'Traps and spawners.' },
  { id: 'puzzles', title: 'Puzzles', symbol: 'square.grid.2x2.fill', blurb: 'Plates, levers and torches.' },
  { id: 'scenery', title: 'Scenery', symbol: 'leaf.fill', blurb: 'Props, plants, platforms and lights.' },
  { id: 'markers', title: 'Markers', symbol: 'flag.fill', blurb: 'The portal and checkpoints.' },
];

export const EntityKindMeta: Record<
  EntityKind,
  {
    title: string;
    symbol: string;
    tint: string;
    section: EntitySection;
    defaultName: string;
    isAddable: boolean;
    usesStats: boolean;
  }
> = {
  hero: { title: 'Hero', symbol: 'figure.stand', tint: Palette.accent, section: 'cast', defaultName: 'Hero', isAddable: false, usesStats: false },
  npc: { title: 'NPC', symbol: 'bubble.left.fill', tint: Palette.sky, section: 'cast', defaultName: 'Friend', isAddable: true, usesStats: true },
  baddie: { title: 'Baddie', symbol: 'bolt.fill', tint: Palette.coral, section: 'cast', defaultName: 'Baddie', isAddable: true, usesStats: true },
  treasure: { title: 'Treasure', symbol: 'gift.fill', tint: Palette.gold, section: 'things', defaultName: 'Treasure chest', isAddable: true, usesStats: false },
  key: { title: 'Key', symbol: 'key.fill', tint: Palette.amber, section: 'things', defaultName: 'Gold key', isAddable: true, usesStats: false },
  door: { title: 'Door', symbol: 'lock.open.fill', tint: '#A9744F', section: 'things', defaultName: 'Locked door', isAddable: true, usesStats: false },
  pickup: { title: 'Pickup', symbol: 'bag.fill', tint: Palette.mint, section: 'things', defaultName: 'Pickup', isAddable: true, usesStats: false },
  trap: { title: 'Trap', symbol: 'exclamationmark.triangle.fill', tint: '#E4572E', section: 'hazards', defaultName: 'Spike trap', isAddable: true, usesStats: false },
  spawner: { title: 'Spawner', symbol: 'arrow.triangle.2.circlepath', tint: Palette.coral, section: 'hazards', defaultName: 'Spawner', isAddable: true, usesStats: false },
  puzzle: { title: 'Puzzle', symbol: 'square.grid.2x2.fill', tint: Palette.plum, section: 'puzzles', defaultName: 'Pressure plate', isAddable: true, usesStats: false },
  prop: { title: 'Prop', symbol: 'cube.fill', tint: Palette.mint, section: 'scenery', defaultName: 'Barrel', isAddable: true, usesStats: false },
  scenery: { title: 'Scenery', symbol: 'leaf.fill', tint: '#3E8E5A', section: 'scenery', defaultName: 'Tree', isAddable: true, usesStats: false },
  platform: { title: 'Platform', symbol: 'square.stack.3d.up.fill', tint: Palette.inkSoft, section: 'scenery', defaultName: 'Moving platform', isAddable: true, usesStats: false },
  sign: { title: 'Sign', symbol: 'text.bubble.fill', tint: '#C08A3E', section: 'scenery', defaultName: 'Sign', isAddable: true, usesStats: false },
  light: { title: 'Light', symbol: 'lightbulb.fill', tint: Palette.amber, section: 'scenery', defaultName: 'Torch', isAddable: true, usesStats: false },
  fxEmitter: { title: 'FX Emitter', symbol: 'sparkles', tint: Palette.sky, section: 'scenery', defaultName: 'FX Emitter', isAddable: true, usesStats: false },
  portal: { title: 'Portal', symbol: 'sparkles', tint: Palette.accent, section: 'markers', defaultName: 'Portal', isAddable: false, usesStats: false },
  checkpoint: { title: 'Checkpoint', symbol: 'flag.fill', tint: Palette.mint, section: 'markers', defaultName: 'Checkpoint', isAddable: true, usesStats: false },
};

export const ActionGroups: {
  id: ActionGroup;
  title: string;
  symbol: string;
  tint: string;
  blurb: string;
}[] = [
  { id: 'movement', title: 'Moving', symbol: 'figure.walk', tint: Palette.mint, blurb: 'Walk, run, jump and climb around the island.' },
  { id: 'combat', title: 'Fighting', symbol: 'bolt.fill', tint: Palette.coral, blurb: 'Punch, swing a sword, block and dodge.' },
  { id: 'interaction', title: 'Using things', symbol: 'hand.point.up.fill', tint: Palette.sky, blurb: 'Open doors, pick up treasure and talk to friends.' },
  { id: 'emotes', title: 'Showing off', symbol: 'hand.wave.fill', tint: Palette.amber, blurb: 'Wave, dance and celebrate.' },
  { id: 'skills', title: 'Magic & tricks', symbol: 'sparkles', tint: Palette.plum, blurb: 'Bolts, healing, shields and spin attacks.' },
];

export const ActionRegistry: CharacterAction[] = [
  // Movement
  { id: 'idle', title: 'Stand', symbol: 'figure.stand', group: 'movement', blurb: 'Breathe gently while waiting.', button: 'Automatic' },
  { id: 'walk', title: 'Walk', symbol: 'figure.walk', group: 'movement', blurb: 'Stroll across the island.', button: 'Stick / WASD' },
  { id: 'run', title: 'Run', symbol: 'figure.run', group: 'movement', blurb: 'Dash along the path.', button: 'Stick / Shift' },
  { id: 'sprint', title: 'Sprint', symbol: 'hare.fill', group: 'movement', blurb: 'Burst of fast running.', button: 'Hold Shift' },
  { id: 'jump', title: 'Jump', symbol: 'arrow.up', group: 'movement', blurb: 'Hop over gaps and traps.', button: 'A / Space' },
  { id: 'doubleJump', title: 'Double jump', symbol: 'arrow.up.circle.fill', group: 'movement', blurb: 'Jump a second time in mid-air.', button: 'Space in air' },
  { id: 'crouch', title: 'Crouch', symbol: 'arrow.down', group: 'movement', blurb: 'Duck low to sneak past.', button: 'C' },
  { id: 'climb', title: 'Climb', symbol: 'mountain.2.fill', group: 'movement', blurb: 'Scramble up steep hills.', button: 'Toward hill' },
  { id: 'swim', title: 'Swim', symbol: 'drop.fill', group: 'movement', blurb: 'Paddle in the sea around the island.', button: 'In water' },
  // Combat
  { id: 'punch', title: 'Punch', symbol: 'hand.raised.fill', group: 'combat', blurb: 'A quick close-up hit.', button: 'X / F' },
  { id: 'kick', title: 'Kick', symbol: 'figure.kickboxing', group: 'combat', blurb: 'Knocks baddies back.', button: 'X / F' },
  { id: 'swordLight', title: 'Sword swing', symbol: 'flame.fill', group: 'combat', blurb: 'Fast slash with your weapon.', button: 'Y / F' },
  { id: 'swordHeavy', title: 'Heavy smash', symbol: 'hammer.fill', group: 'combat', blurb: 'Big swing that deals extra damage.', button: 'Hold F' },
  { id: 'block', title: 'Block', symbol: 'shield.fill', group: 'combat', blurb: 'Hold up a shield against hits.', button: 'B / Q' },
  { id: 'parry', title: 'Parry', symbol: 'shield.checkerboard', group: 'combat', blurb: 'Deflect an attack at the last moment.', button: 'Tap Q' },
  { id: 'dodge', title: 'Dodge roll', symbol: 'arrow.right.circle.fill', group: 'combat', blurb: 'Roll out of the way in any direction.', button: 'B / Shift' },
  { id: 'shoot', title: 'Shoot', symbol: 'scope', group: 'combat', blurb: 'Fire an arrow or bolt at something far away.', button: 'Y with bow' },
  { id: 'throw', title: 'Throw', symbol: 'arrow.up.right', group: 'combat', blurb: 'Lob a rock or item.', button: 'Y with item' },
  { id: 'takeDamage', title: 'Get hit', symbol: 'heart.slash.fill', group: 'combat', blurb: 'The flinch when something hurts you.', button: 'Automatic' },
  { id: 'die', title: 'Fall over', symbol: 'heart.fill', group: 'combat', blurb: 'What happens when health runs out.', button: 'Automatic' },
  // Interaction
  { id: 'pickUp', title: 'Pick up', symbol: 'hand.point.up.fill', group: 'interaction', blurb: 'Grab coins, keys and treasure.', button: 'A / E near item' },
  { id: 'open', title: 'Open', symbol: 'lock.open.fill', group: 'interaction', blurb: 'Open doors, chests and gates.', button: 'E near door' },
  { id: 'talk', title: 'Talk', symbol: 'bubble.left.fill', group: 'interaction', blurb: 'Start a chat with an NPC.', button: 'E near friend' },
  { id: 'read', title: 'Read', symbol: 'book.fill', group: 'interaction', blurb: 'Read signs and books for hints.', button: 'E near sign' },
  { id: 'push', title: 'Push', symbol: 'arrow.right.to.line', group: 'interaction', blurb: 'Shove crates and boulders.', button: 'Walk into prop' },
  // Emotes
  { id: 'wave', title: 'Wave', symbol: 'hand.wave.fill', group: 'emotes', blurb: 'A friendly hello.', button: '1 / Emote' },
  { id: 'dance', title: 'Dance', symbol: 'figure.dance', group: 'emotes', blurb: 'A silly dance. Kids will press this a lot.', button: '2 / Emote' },
  { id: 'cheer', title: 'Cheer', symbol: 'hand.thumbsup.fill', group: 'emotes', blurb: 'Throw your arms up and celebrate.', button: '3 / Emote' },
  { id: 'laugh', title: 'Laugh', symbol: 'face.smiling.fill', group: 'emotes', blurb: 'A big cartoon laugh.', button: 'Emote' },
  // Skills
  { id: 'magicBolt', title: 'Magic bolt', symbol: 'sparkles', group: 'skills', blurb: 'Fires a glowing bolt. Costs magic.', button: 'R / Magic' },
  { id: 'heal', title: 'Heal', symbol: 'cross.case.fill', group: 'skills', blurb: 'Get some health back. Costs magic.', button: 'H / Heal' },
  { id: 'shieldSpell', title: 'Magic shield', symbol: 'shield.checkerboard', group: 'skills', blurb: 'A bubble that blocks hits for a while.', button: 'Spell' },
  { id: 'teleport', title: 'Teleport', symbol: 'sparkles', group: 'skills', blurb: 'Blink a short distance forwards.', button: 'Spell' },
  { id: 'spinAttack', title: 'Spin attack', symbol: 'arrow.triangle.2.circlepath', group: 'skills', blurb: 'Spin with your sword out to hit nearby baddies.', button: 'Hold F' },
];

export const StarterActions: string[] = [
  'idle',
  'walk',
  'run',
  'jump',
  'swim',
  'pickUp',
  'open',
  'talk',
  'punch',
  'swordLight',
  'block',
  'wave',
  'dance',
];

export const ActionPresets: { id: string; name: string; symbol: string; ids: string[] }[] = [
  {
    id: 'adventurer',
    name: 'Adventurer',
    symbol: 'figure.walk',
    ids: ['idle', 'walk', 'run', 'jump', 'climb', 'swim', 'pickUp', 'open', 'talk', 'punch', 'swordLight', 'block', 'wave', 'dance'],
  },
  {
    id: 'ninja',
    name: 'Ninja',
    symbol: 'figure.run',
    ids: ['idle', 'walk', 'run', 'sprint', 'jump', 'doubleJump', 'crouch', 'climb', 'dodge', 'punch', 'kick', 'swordLight', 'throw', 'block', 'wave'],
  },
  {
    id: 'knight',
    name: 'Knight',
    symbol: 'shield.fill',
    ids: ['idle', 'walk', 'run', 'jump', 'block', 'parry', 'swordLight', 'swordHeavy', 'takeDamage', 'open', 'pickUp', 'wave'],
  },
  {
    id: 'wizard',
    name: 'Wizard',
    symbol: 'sparkles',
    ids: ['idle', 'walk', 'run', 'jump', 'magicBolt', 'heal', 'shieldSpell', 'teleport', 'read', 'talk', 'wave', 'dance'],
  },
];

export const PresetLibrary = {
  brains: ['Patroller', 'Chaser', 'Charger', 'Shooter', 'Flyer', 'Lurker', 'Boss'],
  puzzles: ['Pressure plate', 'Lever', 'Key & lock', 'Push block', 'Torch light', 'Rune order', 'Timer gate', 'Counter lock'],
  loot: ['Coins', 'Gems', 'Keys', 'Health', 'Magic', 'Nothing'],
  personalities: ['Friendly', 'Grumpy', 'Sleepy', 'Excited', 'Shy', 'Brave', 'Sneaky'],
  heroBodies: [
    'Adventurer',
    'Knight',
    'Explorer',
    'Ninja',
    'Wizard',
    'Robot',
    'Skunk',
    'Porcupine',
    'Mole Rat',
    'Vulture',
  ],
  themes: ['Adventure', 'Candy', 'Spooky', 'Sci-Fi', 'Paper', 'Neon', 'Nature', 'Pirate'],
};

export const BehaviorVocabulary = {
  events: [
    { key: 'levelStarts', label: 'the level starts', needsDetail: false, detailHint: '', symbol: 'flag.fill' },
    { key: 'playerTouches', label: 'the player touches me', needsDetail: false, detailHint: '', symbol: 'hand.tap.fill' },
    { key: 'playerNear', label: 'the player comes near', needsDetail: true, detailHint: '14m (optional range)', symbol: 'figure.walk' },
    { key: 'seesPlayer', label: 'I see the player', needsDetail: true, detailHint: '24m sight or spatial (optional)', symbol: 'eye.fill' },
    { key: 'takesDamage', label: 'I get hit', needsDetail: false, detailHint: '', symbol: 'heart.slash.fill' },
    { key: 'healthLow', label: 'my health gets low', needsDetail: false, detailHint: '', symbol: 'heart.fill' },
    { key: 'baddiesGone', label: 'all the baddies are gone', needsDetail: false, detailHint: '', symbol: 'bolt.fill' },
    { key: 'playerTalks', label: 'the player talks to me', needsDetail: false, detailHint: '', symbol: 'bubble.left.fill' },
    { key: 'playerUses', label: 'the player presses use near me', needsDetail: false, detailHint: '', symbol: 'hand.point.up.fill' },
    { key: 'misfitPowerUsed', label: 'a misfit power is used', needsDetail: true, detailHint: 'skunkScent', symbol: 'sparkles' },
    { key: 'puzzleSolved', label: 'this puzzle is solved', needsDetail: false, detailHint: '', symbol: 'checkmark.circle.fill' },
    { key: 'timer', label: 'a timer ticks', needsDetail: true, detailHint: 'every 3 seconds', symbol: 'timer' },
  ] as ClauseDefinition[],

  conditions: [
    { key: 'hasKey', label: 'the player has a key', needsDetail: false, detailHint: '', symbol: 'key.fill' },
    { key: 'playerClose', label: 'the player is close', needsDetail: false, detailHint: '', symbol: 'figure.stand' },
    { key: 'isFlying', label: 'I am flying', needsDetail: false, detailHint: '', symbol: 'wind' },
    { key: 'isGrounded', label: 'I am on the ground', needsDetail: false, detailHint: '', symbol: 'figure.stand' },
    { key: 'flagSet', label: 'something already happened', needsDetail: true, detailHint: 'found the sword', symbol: 'flag.fill' },
    { key: 'isBoss', label: 'this is a boss', needsDetail: false, detailHint: '', symbol: 'crown.fill' },
    { key: 'healthFull', label: 'the player is at full health', needsDetail: false, detailHint: '', symbol: 'heart.fill' },
  ] as ClauseDefinition[],

  actions: [
    { key: 'chase', label: 'chase the player', needsDetail: false, detailHint: '', symbol: 'figure.run' },
    { key: 'patrol', label: 'walk my patrol path', needsDetail: false, detailHint: '', symbol: 'arrow.triangle.2.circlepath' },
    { key: 'flyPattern', label: 'fly a sky pattern', needsDetail: true, detailHint: 'figure8 / circle / swoop', symbol: 'wind' },
    { key: 'flee', label: 'run away', needsDetail: false, detailHint: '', symbol: 'arrow.left.circle.fill' },
    { key: 'attack', label: 'attack (library action)', needsDetail: true, detailHint: 'fireBreath / groundPound / clawSlash', symbol: 'flame.fill' },
    { key: 'randomAttack', label: 'pick primary or secondary attack', needsDetail: false, detailHint: '', symbol: 'sparkles' },
    { key: 'landAndAttack', label: 'land and ground-slam', needsDetail: true, detailHint: 'groundPound', symbol: 'hammer.fill' },
    { key: 'enrage', label: 'enrage (faster & fiercer)', needsDetail: false, detailHint: '', symbol: 'flame.fill' },
    { key: 'playAnimation', label: 'play an action', needsDetail: true, detailHint: 'dance', symbol: 'figure.dance' },
    { key: 'say', label: 'say something', needsDetail: true, detailHint: 'Welcome, traveller!', symbol: 'bubble.left.fill' },
    { key: 'playSound', label: 'play a sound', needsDetail: true, detailHint: 'coin chime', symbol: 'speaker.wave.2.fill' },
    { key: 'openDoor', label: 'open the door', needsDetail: false, detailHint: '', symbol: 'lock.open.fill' },
    { key: 'activateMechanism', label: 'activate object mechanism', needsDetail: true, detailHint: 'lever_pulled', symbol: 'interaction.designer' },
    { key: 'unlockMisfitPower', label: 'unlock misfit power', needsDetail: true, detailHint: 'porcupineQuills', symbol: 'sparkles' },
    { key: 'giveTreasure', label: 'give a treasure', needsDetail: true, detailHint: '3 coins', symbol: 'gift.fill' },
    { key: 'giveItem', label: 'give the player an item', needsDetail: true, detailHint: 'Gold key', symbol: 'bag.fill' },
    { key: 'spawn', label: 'make a baddie appear', needsDetail: true, detailHint: 'Slime', symbol: 'plus.circle.fill' },
    { key: 'heal', label: 'get some health back', needsDetail: false, detailHint: '', symbol: 'heart.fill' },
    { key: 'takeDamage', label: 'take damage', needsDetail: true, detailHint: '1 heart', symbol: 'heart.slash.fill' },
    { key: 'setFlag', label: 'remember something happened', needsDetail: true, detailHint: 'torch lit', symbol: 'flag.fill' },
    { key: 'endLevel', label: 'finish the level', needsDetail: false, detailHint: '', symbol: 'sparkles' },
    { key: 'shakeCamera', label: 'shake the camera', needsDetail: false, detailHint: '', symbol: 'waveform.path' },
    { key: 'showMessage', label: 'show a message', needsDetail: true, detailHint: 'The gate is locked!', symbol: 'text.bubble.fill' },
    { key: 'unlockPortal', label: 'open the portal', needsDetail: false, detailHint: '', symbol: 'sparkles' },
    { key: 'playSkit', label: 'play a story skit', needsDetail: true, detailHint: 'Skit name', symbol: 'film' },
    { key: 'cutawayCamera', label: 'swoop camera to shot', needsDetail: true, detailHint: 'Camera shot name', symbol: 'eye.fill' },
    { key: 'destroySelf', label: 'disappear', needsDetail: false, detailHint: '', symbol: 'xmark.circle.fill' },
  ] as ClauseDefinition[],
};

export interface MisfitAbilityMeta {
  id: MisfitAbilityId;
  title: string;
  shortTag: string;
  flawLabel: string;
  strengthLabel: string;
  blurb: string;
  colorHex: string;
  symbol: string;
  cooldownSec: number;
}

export const MisfitAbilityCatalog: MisfitAbilityMeta[] = [
  {
    id: 'skunkScent',
    title: 'Skunk Scent',
    shortTag: 'Scent',
    flawLabel: 'Too Stinky',
    strengthLabel: 'Clears Bramble & Shoos Pests',
    blurb: 'Puffs a breezy cloud that clears thorny briars and shoos grumpy pests away.',
    colorHex: '#A3E635',
    symbol: 'sparkles',
    cooldownSec: 1.6,
  },
  {
    id: 'porcupineQuills',
    title: 'Quill Shot',
    shortTag: 'Quills',
    flawLabel: 'Too Prickly',
    strengthLabel: 'Snaps Far Acorn Latches',
    blurb: 'Launches 3 fanned quills to pop high hanging latches and startle baddies.',
    colorHex: '#F59E0B',
    symbol: 'bolt.fill',
    cooldownSec: 1.0,
  },
  {
    id: 'moleSonar',
    title: 'Ear Sonar',
    shortTag: 'Sonar',
    flawLabel: 'Poor Eyesight',
    strengthLabel: 'Finds Buried Secrets & Trails',
    blurb: 'Sends golden echo waves that reveal hidden buddies, buried truffles, and chests.',
    colorHex: '#38BDF8',
    symbol: 'waveform.path',
    cooldownSec: 2.2,
  },
  {
    id: 'vultureSight',
    title: 'High Sight',
    shortTag: 'Lookout',
    flawLabel: 'Gliding Scavenger',
    strengthLabel: 'Spots Distant Buddies & Goals',
    blurb: 'Soars into a wide sky-lookout view, beaming golden beacons on far landmarks.',
    colorHex: '#C084FC',
    symbol: 'eye.fill',
    cooldownSec: 3.0,
  },
];

export const MisfitAbilityById: Record<MisfitAbilityId, MisfitAbilityMeta> = {
  skunkScent: MisfitAbilityCatalog[0],
  porcupineQuills: MisfitAbilityCatalog[1],
  moleSonar: MisfitAbilityCatalog[2],
  vultureSight: MisfitAbilityCatalog[3],
};

export interface StorybookThemeMeta {
  id: StorybookThemeId;
  title: string;
  paperBg: string;
  paperSurface: string;
  inkHex: string;
  mutedHex: string;
  accentHex: string;
  borderHex: string;
}

export const StorybookThemeCatalog: StorybookThemeMeta[] = [
  {
    id: 'woodland',
    title: 'Woodland Parchment',
    paperBg: '#F6EEDF',
    paperSurface: '#EFE3CE',
    inkHex: '#2B2118',
    mutedHex: '#6E5A47',
    accentHex: '#8C4A27',
    borderHex: '#D5C3A8',
  },
  {
    id: 'goldenMeadow',
    title: 'Golden Meadow',
    paperBg: '#FBF4DE',
    paperSurface: '#F3E7C5',
    inkHex: '#2A2315',
    mutedHex: '#6F6140',
    accentHex: '#B45309',
    borderHex: '#DEC99A',
  },
  {
    id: 'moonlitFable',
    title: 'Moonlit Fable',
    paperBg: '#1B1F2E',
    paperSurface: '#242A3E',
    inkHex: '#F3EFE4',
    mutedHex: '#B6B1A6',
    accentHex: '#E9B44C',
    borderHex: '#3B435E',
  },
];

export const StorybookThemeById: Record<StorybookThemeId, StorybookThemeMeta> = {
  woodland: StorybookThemeCatalog[0],
  goldenMeadow: StorybookThemeCatalog[1],
  moonlitFable: StorybookThemeCatalog[2],
};

export function defaultStorybookConfig(): StorybookConfig {
  return {
    enabled: false,
    theme: 'woodland',
    subtitle: 'An Interactive Forest Fable',
    authorCredit: '',
    prologueText: '',
    epilogueTitle: 'And So the Journey Continues…',
    epilogueText: '',
    moralLine: '',
  };
}

export function ruleSentence(card: BehaviorCard): string {
  const phrase = (def: ClauseDefinition | undefined, detail: string, fallback: string) => {
    if (!def) return fallback;
    return detail.trim() ? `${def.label} (${detail.trim()})` : def.label;
  };
  const when = phrase(
    BehaviorVocabulary.events.find((e) => e.key === card.when.key),
    card.when.detail,
    'something happens'
  );
  const pieces = [`When ${when}`];
  if (card.conditions.length > 0) {
    const words = card.conditions.map((c) =>
      phrase(
        BehaviorVocabulary.conditions.find((d) => d.key === c.key),
        c.detail,
        'something is true'
      )
    );
    pieces.push(`if ${joinList(words)}`);
  }
  if (card.actions.length === 0) {
    pieces.push('then nothing yet');
  } else {
    const words = card.actions.map((a) =>
      phrase(
        BehaviorVocabulary.actions.find((d) => d.key === a.key),
        a.detail,
        'do something'
      )
    );
    pieces.push(`then ${joinList(words)}`);
  }
  let text = pieces.join(', ') + '.';
  if (card.isOnce) text += ' Only the first time.';
  return text;
}

function joinList(words: string[]): string {
  if (words.length <= 1) return words[0] ?? '';
  if (words.length === 2) return `${words[0]} and ${words[1]}`;
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

export const RecipeLibrary: RuleRecipe[] = [
  { id: 'chase', title: 'Chase the player', symbol: 'figure.run', blurb: 'Sees you, then runs after you.', whenKey: 'seesPlayer', conditionKeys: [], actionKeys: ['chase', 'say'], kinds: ['baddie'] },
  { id: 'patrol', title: 'Guard a path', symbol: 'arrow.triangle.2.circlepath', blurb: 'Walks back and forth, then attacks.', whenKey: 'seesPlayer', conditionKeys: ['playerClose'], actionKeys: ['attack'], kinds: ['baddie'] },
  { id: 'lockedDoor', title: 'Locked door', symbol: 'lock.open.fill', blurb: 'Only opens with a key.', whenKey: 'playerUses', conditionKeys: ['hasKey'], actionKeys: ['openDoor', 'playSound'], kinds: ['door'] },
  { id: 'openWhenDone', title: 'Opens when all gone', symbol: 'bolt.fill', blurb: 'Opens once every baddie is beaten.', whenKey: 'baddiesGone', conditionKeys: [], actionKeys: ['openDoor', 'showMessage'], kinds: ['door', 'portal'] },
  { id: 'chest', title: 'Treasure chest', symbol: 'gift.fill', blurb: 'Gives coins when you touch it.', whenKey: 'playerTouches', conditionKeys: [], actionKeys: ['giveTreasure', 'playSound', 'destroySelf'], kinds: ['treasure'] },
  { id: 'chat', title: 'Friendly hello', symbol: 'bubble.left.fill', blurb: 'Says a line when you talk.', whenKey: 'playerTalks', conditionKeys: [], actionKeys: ['say', 'playAnimation'], kinds: ['npc'] },
  { id: 'quest', title: 'Give a quest', symbol: 'list.bullet', blurb: 'Asks for help and gives a key.', whenKey: 'playerTalks', conditionKeys: ['flagSet'], actionKeys: ['say', 'giveItem'], kinds: ['npc'] },
  { id: 'trap', title: 'Hidden trap', symbol: 'exclamationmark.triangle.fill', blurb: 'Hurts whoever steps on it.', whenKey: 'playerTouches', conditionKeys: [], actionKeys: ['takeDamage', 'playSound'], kinds: ['trap'] },
  { id: 'plate', title: 'Plate opens door', symbol: 'square.grid.2x2.fill', blurb: 'Stand on it and a door opens.', whenKey: 'playerTouches', conditionKeys: [], actionKeys: ['setFlag', 'playSound'], kinds: ['puzzle'] },
  { id: 'checkpoint', title: 'Checkpoint', symbol: 'flag.fill', blurb: 'Remembers you were here.', whenKey: 'playerTouches', conditionKeys: [], actionKeys: ['setFlag', 'playSound', 'showMessage'], kinds: ['checkpoint'] },
  { id: 'bossPhase', title: 'Boss second phase', symbol: 'crown.fill', blurb: 'Gets angry and fierce when health is low.', whenKey: 'healthLow', conditionKeys: ['isBoss'], actionKeys: ['say', 'enrage', 'shakeCamera'], kinds: ['baddie'] },
  { id: 'airborneHunt', title: 'Sight hunt & breath', symbol: 'wind', blurb: 'Spots hero by sight/range, chases & uses random action.', whenKey: 'seesPlayer', conditionKeys: [], actionKeys: ['chase', 'randomAttack'], kinds: ['baddie'] },
  { id: 'flyerLandingSmash', title: 'Land & ground-slam', symbol: 'hammer.fill', blurb: 'When flying close to hero, lands to slam the earth.', whenKey: 'playerNear', conditionKeys: ['isFlying'], actionKeys: ['landAndAttack'], kinds: ['baddie'] },
  { id: 'spawnWave', title: 'Summon a wave', symbol: 'plus.circle.fill', blurb: 'Calls for help when hurt.', whenKey: 'takesDamage', conditionKeys: [], actionKeys: ['spawn', 'say'], kinds: ['baddie', 'spawner'] },
];

export const StatLibrary: BindableStat[] = [
  { id: 'health', title: 'Health', symbol: 'heart.fill', isLive: true },
  { id: 'stamina', title: 'Stamina', symbol: 'figure.run', isLive: true },
  { id: 'energy', title: 'Energy', symbol: 'bolt.fill', isLive: true },
  { id: 'magic', title: 'Magic', symbol: 'sparkles', isLive: true },
  { id: 'coins', title: 'Coins', symbol: 'circle.fill', isLive: true },
  { id: 'gems', title: 'Gems', symbol: 'diamond.fill', isLive: false },
  { id: 'keys', title: 'Keys', symbol: 'key.fill', isLive: true },
  { id: 'timer', title: 'Timer', symbol: 'timer', isLive: true },
  { id: 'objectives', title: 'Objectives', symbol: 'list.bullet', isLive: true },
  { id: 'inventory', title: 'Inventory', symbol: 'bag.fill', isLive: false },
  { id: 'map', title: 'Minimap', symbol: 'map.fill', isLive: true },
  { id: 'pause', title: 'Pause', symbol: 'pause.fill', isLive: false },
];

export const WidgetKindMeta: Record<
  WidgetKind,
  {
    title: string;
    symbol: string;
    blurb: string;
    defaultWidth: number;
    defaultHeight: number;
    usesBinding: boolean;
  }
> = {
  bar: { title: 'Stat bar', symbol: 'chart.bar.fill', blurb: 'Shows health, stamina or magic.', defaultWidth: 190, defaultHeight: 28, usesBinding: true },
  counter: { title: 'Counter', symbol: 'number.circle.fill', blurb: 'Counts coins, gems or keys.', defaultWidth: 108, defaultHeight: 34, usesBinding: true },
  inventoryGrid: { title: 'Bag slots', symbol: 'square.grid.3x3.fill', blurb: 'A row of slots for items.', defaultWidth: 184, defaultHeight: 44, usesBinding: false },
  minimap: { title: 'Minimap', symbol: 'map.fill', blurb: 'A little map of where you are.', defaultWidth: 112, defaultHeight: 88, usesBinding: false },
  objectiveList: { title: 'To-do list', symbol: 'list.bullet', blurb: 'What to do next.', defaultWidth: 236, defaultHeight: 76, usesBinding: false },
  dialogue: { title: 'Speech box', symbol: 'bubble.left.fill', blurb: 'What a character is saying.', defaultWidth: 280, defaultHeight: 74, usesBinding: false },
  pauseButton: { title: 'Pause button', symbol: 'pause.fill', blurb: 'Stops the game.', defaultWidth: 42, defaultHeight: 42, usesBinding: false },
  timer: { title: 'Timer', symbol: 'timer', blurb: 'Counts down or up.', defaultWidth: 94, defaultHeight: 32, usesBinding: false },
  bossBar: { title: 'Boss bar', symbol: 'figure.arms.open', blurb: 'Big health bar for a boss.', defaultWidth: 240, defaultHeight: 32, usesBinding: true },
  tutorial: { title: 'Tip bubble', symbol: 'hand.tap.fill', blurb: 'A hint that pops up.', defaultWidth: 210, defaultHeight: 42, usesBinding: false },
  joystick: { title: 'Joystick', symbol: 'arrow.triangle.2.circlepath', blurb: 'Movable & resizable thumbstick for steering.', defaultWidth: 114, defaultHeight: 114, usesBinding: false },
  actionButton: { title: 'Action button', symbol: 'hand.tap.fill', blurb: 'Touch/click button for Jump, Hit, Use or Magic.', defaultWidth: 64, defaultHeight: 64, usesBinding: false },
};

export const WidgetAnchors: { id: WidgetAnchor; title: string }[] = [
  { id: 'topLeading', title: 'Top left' },
  { id: 'top', title: 'Top center' },
  { id: 'topTrailing', title: 'Top right' },
  { id: 'bottomLeading', title: 'Bottom left' },
  { id: 'bottom', title: 'Bottom center' },
  { id: 'bottomTrailing', title: 'Bottom right' },
  { id: 'center', title: 'Center' },
];

export function makeWidget(
  kind: WidgetKind,
  anchor: WidgetAnchor,
  binding = 'health',
  fillHex = Palette.accent,
  label = '',
  offsetX = 0,
  offsetY = 0,
  extra: Partial<HUDWidget> = {}
): HUDWidget {
  const meta = WidgetKindMeta[kind];
  return {
    id: uid(),
    kind,
    anchor,
    offsetX,
    offsetY,
    width: extra.width ?? meta.defaultWidth,
    height: extra.height ?? meta.defaultHeight,
    binding,
    fillHex,
    label,
    shape: kind === 'joystick' || kind === 'pauseButton' || kind === 'actionButton' ? 'circle' : 'rounded',
    opacity: 0.9,
    knobColorHex: kind === 'joystick' ? '#FFFFFF' : undefined,
    actionId: kind === 'actionButton' ? 'jump' : undefined,
    ...extra,
  };
}

export function defaultHUDProfile(): HUDProfile {
  return {
    id: uid(),
    name: 'Adventure',
    themeName: 'Adventure',
    widgets: [
      makeWidget('bar', 'topLeading', 'health', '#F2545B', 'Health', 0, 0),
      makeWidget('bar', 'topLeading', 'stamina', '#22B573', 'Stamina', 0, 34),
      makeWidget('bar', 'topLeading', 'magic', '#3AA0FF', 'Magic', 0, 68),
      makeWidget('bar', 'topLeading', 'energy', '#FACC15', 'Energy', 0, 102),
      makeWidget('counter', 'topTrailing', 'coins', '#F2C230', 'Coins', -52, 0),
      makeWidget('pauseButton', 'topTrailing', 'pause', '#F2545B', 'Pause', 0, 0),
      makeWidget('minimap', 'topTrailing', 'map', '#6C4CF1', 'Map', 0, 48),
      makeWidget('objectiveList', 'topLeading', 'objectives', '#6C4CF1', 'Objectives', 0, 138),
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
}

export const MusicMoodOptions: { id: MusicMood; title: string; symbol: string }[] = [
  { id: 'none', title: 'No music', symbol: 'speaker.slash.fill' },
  { id: 'calm', title: 'Calm', symbol: 'leaf.fill' },
  { id: 'adventure', title: 'Adventure', symbol: 'map.fill' },
  { id: 'tense', title: 'Tense', symbol: 'exclamationmark.triangle.fill' },
  { id: 'battle', title: 'Battle', symbol: 'flame.fill' },
  { id: 'mystery', title: 'Mystery', symbol: 'moon.stars.fill' },
  { id: 'triumph', title: 'Triumph', symbol: 'crown.fill' },
];

export const SoundEffectOptions: { id: SoundEffect; title: string; symbol: string }[] = [
  { id: 'none', title: 'Silent', symbol: 'speaker.slash' },
  { id: 'coin', title: 'Coin chime', symbol: 'circle.fill' },
  { id: 'chime', title: 'Bell', symbol: 'bell.fill' },
  { id: 'hit', title: 'Thud', symbol: 'hammer.fill' },
  { id: 'creak', title: 'Door creak', symbol: 'lock.open.fill' },
  { id: 'whoosh', title: 'Whoosh', symbol: 'wind' },
  { id: 'jump', title: 'Hop', symbol: 'arrow.up' },
  { id: 'step', title: 'Footstep', symbol: 'figure.walk' },
  { id: 'fanfare', title: 'Fanfare', symbol: 'crown.fill' },
  { id: 'sparkle', title: 'Sparkle', symbol: 'sparkles' },
  { id: 'hurt', title: 'Ouch', symbol: 'heart.slash.fill' },
];

export const TemplateLibrary: GameTemplate[] = [
  {
    id: 'floatingIsland',
    name: 'Floating Island',
    symbol: 'sun.max.fill',
    colorHex: '#20B46A',
    blurb: '312m forested sky island with emerald lagoon, stone lifts, river crossing & cliff summit.',
    category: 'worlds',
    prototypeType: 'Open World Prototype',
    biomeLabel: 'Forest Island',
    highlights: [
      'River footbridge, mountain cave & eastern cove lagoon',
      'Moving stone lifts & elevated summit portal shrine',
      'Starter axe, fishing rod & gatherable ingredients',
    ],
  },
  {
    id: 'platformer',
    name: 'Platformer',
    symbol: 'figure.run',
    colorHex: '#22B573',
    blurb: 'Side-scrolling 2.5D cliff lanes, swinging bridges, checkpoints & treasure chests.',
    category: 'worlds',
    prototypeType: '2.5D Platformer',
    biomeLabel: 'Sunny Cliffs',
    highlights: [
      'Locked 2.5D side-scroll camera & parallax layers',
      'Swinging sky bridges across cliff chasms',
      'Patrolling crabs, checkpoint flag & cliff chest',
    ],
  },
  {
    id: 'buddies',
    name: 'Buddies',
    symbol: 'pawprint.fill',
    colorHex: '#FF9F1C',
    blurb: 'Lead Pepper the Skunk down a lush forest road, detour off-path to find 3 woodland friends, and celebrate at the Tavern.',
    category: 'stories',
    prototypeType: 'Story Adventure',
    biomeLabel: 'Deep Woodland',
    highlights: [
      'Skunk hero intro voice bubble + 3 creature buddies',
      'Off-path detours to Cottage Home, Enterable Cave & Forest Lake',
      'Woodland Lantern Tavern feast reward & celebration',
    ],
  },
  {
    id: 'driving',
    name: 'Driving',
    symbol: 'car.fill',
    colorHex: '#38BDF8',
    blurb: 'Blast through a banked forest rally circuit with selectable cars, physics presets, stunt ramps & driver types.',
    category: 'vehicles',
    prototypeType: 'Vehicle Prototype',
    biomeLabel: 'Forest Rally Loop',
    highlights: [
      '4 cars, 4 driving physics presets & 4 driver types',
      'Wide dirt rally loop with stunt ramps & drift bends',
      '6 checkpoint arches & live speedometer + boost HUD',
    ],
  },
  {
    id: 'roguelike',
    name: 'Roguelike',
    symbol: 'flame.fill',
    colorHex: '#E11D48',
    blurb: 'Procedural torchlit stone dungeon floors with escalating bosses, permadeath runs & post-room relic drafts.',
    category: 'worlds',
    prototypeType: 'Roguelike Dungeon',
    biomeLabel: 'Torchlit Crypt',
    highlights: [
      'Isometric diorama view in procedural stone chambers',
      'Escalating Floor Bosses every 3rd floor',
      'Permadeath runs with 3-choice Relic Drafts',
    ],
  },
  {
    id: 'rpg',
    name: 'Isometric RPG',
    symbol: 'shield.fill',
    colorHex: '#8B5CF6',
    blurb: 'Rich isometric fantasy RPG with medieval village, companion party, sword/arrow/magic combat, floating damage numbers & fanned-out loot cards.',
    category: 'stories',
    prototypeType: 'Isometric Fantasy RPG',
    biomeLabel: 'Medieval Village & Ruins',
    highlights: [
      'Refined isometric diorama view with volumetric lanterns & fog',
      'Recruited companion party fighting alongside the hero',
      'Sword, arrow & magic spell combat with floating enemy health bars & damage numbers',
      'Traditional chests and fanned-out reward card choices for skills & potions',
    ],
  },
  {
    id: 'adventure',
    name: 'Castle Adventure',
    symbol: 'castle.fill',
    colorHex: '#6C4CF1',
    blurb: 'Multi-level castle quest with keys, dungeons, boss battles & story dialogue.',
    category: 'stories',
    prototypeType: '3-Level Campaign',
    biomeLabel: 'Castle & Dungeon',
    highlights: ['3 connected levels', 'Key & door puzzle + Guard Captain boss', 'NPC hint dialogue'],
  },
  {
    id: 'quest',
    name: 'Village Quest',
    symbol: 'bubble.left.fill',
    colorHex: '#F59E0B',
    blurb: 'Townsfolk who ask for help, guard trails and reward brave explorers.',
    category: 'stories',
    prototypeType: 'Town & Trail',
    biomeLabel: 'Meadow Woods',
    highlights: ['Quest-giving Mayor', 'Starter tools & crafting items', 'Golden hour vista'],
  },
  {
    id: 'dungeon',
    name: 'Dungeon',
    symbol: 'flame.fill',
    colorHex: '#9B5DE5',
    blurb: 'Torchlit stone vaults, pressure plates, flying bats and mossy caverns.',
    category: 'worlds',
    prototypeType: 'Dungeon Crawler',
    biomeLabel: 'Underground',
    highlights: ['Stone chambers & cave grottos', 'Torch puzzles & traps', 'Vault treasures'],
  },
  {
    id: 'dungeonBuilder',
    name: 'Dungeon Builder',
    symbol: 'cube.fill',
    colorHex: '#F59E0B',
    blurb: 'Modular masonry sandbox with snap-grid stone walls, multi-style animated doors, stairs, mezzanines & torches.',
    category: 'worlds',
    prototypeType: 'Modular Builder',
    biomeLabel: 'Stone Keep & Crypt',
    highlights: [
      '10 snap-grid masonry & cabin shapes + wear/moss weathering',
      'Sliding iron-bar gate, double split door & interactive trapdoor',
      'Walkable straight & spiral stairs leading to a 2m upper mezzanine',
    ],
  },
  {
    id: 'scifi',
    name: 'Sci-Fi Base',
    symbol: 'sparkles',
    colorHex: '#3AA0FF',
    blurb: 'Lunar crater alloy decks, patrol drones and orbital energy cores.',
    category: 'worlds',
    prototypeType: 'Sci-Fi Arena',
    biomeLabel: 'Crater Outpost',
    highlights: ['Metallic crater perimeter', 'Patrol drones & Pilot Vega', 'Night sky & glowing beacons'],
  },
  {
    id: 'blank',
    name: 'Blank Island',
    symbol: 'cube.fill',
    colorHex: '#8E8E93',
    blurb: 'A clean sculpted island canvas ready for your own world and rules.',
    category: 'worlds',
    prototypeType: 'Clean Canvas',
    biomeLabel: 'Meadow',
    highlights: ['Full 312m terrain & river', 'Hero start & portal', 'Empty entity palette'],
  },
];

export function defaultLevelAudio(mood: MusicMood = 'adventure'): LevelAudio {
  return {
    mood,
    coin: 'coin',
    hit: 'hit',
    door: 'creak',
    portal: 'whoosh',
    jump: 'jump',
    step: 'step',
  };
}

export function createEntity(
  kind: EntityKind,
  name: string,
  x: number,
  y: number,
  opts: Partial<LevelEntity> = {}
): LevelEntity {
  return {
    id: uid(),
    kind,
    name,
    position: { x, y },
    rotation: 0,
    scale: 1,
    isBoss: false,
    brain: 'Patroller',
    health: 3,
    speed: 3,
    damage: 1,
    loot: 'Coins',
    puzzleType: 'Pressure plate',
    dialogue: '',
    platformPreset: 'stoneLift',
    platformMotion: 'slide',
    platformSpeed: 1,
    platformWait: 1,
    platformRunning: true,
    conversation: [],
    notes: '',
    cards: [],
    ...(kind === 'fxEmitter' ? { fxEmitter: createDefaultFxEmitterConfig('fire') } : {}),
    ...opts,
  };
}

export const DefaultInventoryItems: InventoryItemDef[] = [
  {
    id: 'iron_sword',
    name: 'Iron Sword',
    category: 'weapon',
    colorHex: '#94A3B8',
    icon: 'sword',
    description: 'Balanced steel blade for fast sweeping combat strikes.',
    lore: 'Forged in river-cooled iron with a brass crossguard.',
    magicEffect: 'Crisp melee arc; dependable against woodland foes.',
    meshKind: 'sword',
    toolKind: 'sword',
    handedness: 'oneHand',
    attackBonus: 1,
    weaponRange: 2.8,
    metadata: {
      power: 12,
      durability: 100,
      maxDurability: 100,
      magic_effect: 'Crisp melee arc; pairs cleanly with a shield in your off-hand.',
      rarity: 'common',
      weight: 2.4,
      repairable: true,
      properties: { damageType: 'Slashing', handedness: '1-Handed', alloy: 'River Iron' },
    },
  },
  {
    id: 'wood_axe',
    name: "Woodcutter's Axe",
    category: 'tool',
    colorHex: '#D97706',
    icon: 'axe',
    description: 'Hold and swing near any forest tree to chop it down into Wood Logs.',
    lore: 'Hickory-handled forester hatchet balanced for felling timber.',
    meshKind: 'axe',
    toolKind: 'axe',
    handedness: 'twoHand',
    attackBonus: 1,
    weaponRange: 2.8,
    metadata: {
      power: 10,
      durability: 90,
      maxDurability: 90,
      magic_effect: 'Fells woodland timber and splits kindling in 3 clean chops.',
      rarity: 'common',
      weight: 2.9,
      repairable: true,
      properties: { harvestTarget: 'Forest Trees', handedness: '2-Handed', handle: 'Seasoned Hickory' },
    },
  },
  {
    id: 'fishing_pole',
    name: 'Bamboo Fishing Pole',
    category: 'tool',
    colorHex: '#38BDF8',
    icon: 'fish',
    description: 'Face the river or sea and press Hit (F) to whip out your line and catch fish.',
    lore: 'Supple cured bamboo fitted with a brass reel and red cork float.',
    meshKind: 'fishingPole',
    toolKind: 'fishingPole',
    handedness: 'twoHand',
    metadata: {
      power: 6,
      durability: 80,
      maxDurability: 80,
      magic_effect: 'Bobs in shallow & deep water to lure fresh river trout.',
      rarity: 'common',
      weight: 1.1,
      repairable: true,
      properties: { lineLength: '4.5m', handedness: '2-Handed', baitType: 'Red Cork Float' },
    },
  },
  {
    id: 'campfire_torch',
    name: 'Pine Torch',
    category: 'tool',
    colorHex: '#F97316',
    icon: 'flame',
    description: 'Warm glowing torch that lights up dark mountain caves.',
    lore: 'Resin-soaked pine bough wrapped in oiled linen.',
    magicEffect: 'Casts warm dynamic light around your hero in dark caverns.',
    meshKind: 'torch',
    toolKind: 'torch',
    handedness: 'oneHand',
    metadata: {
      power: 7,
      durability: 60,
      maxDurability: 60,
      magic_effect: 'Casts warm dynamic light around your hero in dark caverns.',
      rarity: 'common',
      weight: 0.9,
      craftable: true,
      repairable: true,
      properties: { lightRadius: '11m', handedness: '1-Handed', fuel: 'Pine Resin' },
    },
  },
  {
    id: 'parachute_blanket',
    name: 'Parachute Blanket',
    category: 'tool',
    colorHex: '#E06D44',
    icon: 'blanket',
    description:
      'A lightweight wind-sail blanket packed in your backpack. Jump off a cliff or mountain and hold Use (E / Alt) to grip two corners overhead and glide gently down.',
    lore: 'Tightly woven traveler blanket stitched with reinforced corner loops that catch mountain updrafts.',
    magicEffect: 'Automatically deploys overhead when airborne above high drops; release Use or land to fold back into your bag.',
    meshKind: 'blanket',
    metadata: {
      power: 14,
      durability: 100,
      maxDurability: 100,
      magic_effect: 'Catches mountain wind in a cupped sail curve for gentle gliding flight.',
      rarity: 'uncommon',
      weight: 0.6,
      repairable: false,
      properties: { activation: 'Jump & Hold Use', stow: 'Release or Touch Ground' },
    },
  },
  {
    id: 'timber_club',
    name: 'Heavy Timber Club',
    category: 'weapon',
    colorHex: '#A16207',
    icon: 'hammer',
    description: 'Sturdy crafted bludgeon that deals heavy melee damage.',
    lore: 'Dense oak heartwood bound with river stone counterweights.',
    meshKind: 'woodLog',
    toolKind: 'sword',
    handedness: 'oneHand',
    attackBonus: 2,
    weaponRange: 2.6,
    metadata: {
      power: 18,
      durability: 120,
      maxDurability: 120,
      magic_effect: 'Heavy impact knocks woodland foes off balance.',
      rarity: 'uncommon',
      weight: 4.1,
      craftable: true,
      repairable: true,
      properties: { damageType: 'Crushing', handedness: '1-Handed', knockback: 'High', core: 'Oak & Basalt' },
    },
  },
  {
    id: 'wood_log',
    name: 'Fresh Wood Log',
    category: 'resource',
    colorHex: '#92400E',
    icon: 'trees',
    description: 'Chopped timber. Mix two logs for a Torch, or craft handles and campfires.',
    lore: 'Seasoned woodland timber harvested from felled island trees.',
    meshKind: 'woodLog',
    metadata: {
      power: 4,
      durability: 40,
      maxDurability: 40,
      magic_effect: 'Burns cleanly for hearth cooking and tool hafting.',
      rarity: 'common',
      weight: 1.8,
      properties: { resourceTier: 'Timber', origin: 'Chopped Trees' },
    },
  },
  {
    id: 'raw_fish',
    name: 'Fresh River Trout',
    category: 'consumable',
    colorHex: '#38BDF8',
    icon: 'fish',
    description: 'Fresh catch from the water. Eat raw (+1 HP) or mix with Wood Log for Grilled Trout.',
    meshKind: 'fish',
    healAmount: 1,
    staminaAmount: 20,
    metadata: {
      power: 5,
      durability: 1,
      maxDurability: 1,
      magic_effect: 'Light coastal nourishment (+1 HP, +20 Stamina).',
      rarity: 'common',
      weight: 0.7,
      properties: { harvestSource: 'Island River & Sea', cookable: true },
    },
  },
  {
    id: 'wild_berries',
    name: 'Wild Forest Berries',
    category: 'consumable',
    colorHex: '#E11D48',
    icon: 'cherry',
    description: 'Sweet woodland berries (+1 HP, +25 Stamina). Mix with Herbs or Mushrooms for potent brews.',
    lore: 'Plump ruby fruit gathered from sunlit forest shrubs.',
    magicEffect: 'Quick burst of natural trail stamina.',
    meshKind: 'berries',
    healAmount: 1,
    staminaAmount: 25,
    metadata: {
      power: 6,
      durability: 1,
      maxDurability: 1,
      magic_effect: 'Quick burst of natural trail stamina (+1 HP, +25% Stamina).',
      rarity: 'common',
      weight: 0.25,
      properties: { botanical: 'Rubus Sylvestris', reagent: 'Sweet Base' },
    },
  },
  {
    id: 'orchard_apple',
    name: 'Sunlit Orchard Fruit',
    category: 'consumable',
    colorHex: '#EF4444',
    icon: 'apple',
    description: 'Crisp fresh fruit picked right from a tree canopy (+2 HP, +35 Stamina).',
    lore: 'Sun-ripened woodland orchard fruit harvested high among the branches.',
    magicEffect: 'Restores 2 Hearts and 35% Stamina instantly.',
    meshKind: 'berries',
    healAmount: 2,
    staminaAmount: 35,
    metadata: {
      power: 10,
      durability: 1,
      maxDurability: 1,
      magic_effect: 'Crisp canopy fruit (+2 HP, +35% Stamina).',
      rarity: 'common',
      weight: 0.35,
      properties: { harvestSource: 'Climbed Fruit Trees', freshness: 'Tree-Picked' },
    },
  },
  {
    id: 'forest_herbs',
    name: 'Fragrant Forest Herbs',
    category: 'consumable',
    colorHex: '#22C55E',
    icon: 'leaf',
    description: 'Soothing green herbs (+1 HP, +35 Magic). Mix with Berries or Mushrooms for healing brews.',
    lore: 'Aromatic woodland ferns and silverleaf prized by island apothecaries.',
    magicEffect: 'Recharges arcane spirit (+35 Magic) and mixes into potions.',
    meshKind: 'herbs',
    healAmount: 1,
    magicAmount: 35,
    metadata: {
      power: 8,
      durability: 1,
      maxDurability: 1,
      magic_effect: 'Recharges arcane spirit (+35 Magic) and binds herbal tonics.',
      rarity: 'common',
      weight: 0.2,
      properties: { botanical: 'Silverleaf & Fern', reagent: 'Mana Catalyst' },
    },
  },
  {
    id: 'wild_mushroom',
    name: 'Woodland Cap Mushroom',
    category: 'consumable',
    colorHex: '#D97706',
    icon: 'sprout',
    description: 'Earthy forest mushroom (+1 HP, +20 Stamina, +15 Magic). Mix with Herbs for Savory Stew!',
    lore: 'Nutty amber-capped fungus found beneath mossy oaks and pines.',
    magicEffect: 'Mild forest mana infusion; amplifies herbal stews and elixirs.',
    meshKind: 'mushroom',
    healAmount: 1,
    staminaAmount: 20,
    magicAmount: 15,
    metadata: {
      power: 9,
      durability: 1,
      maxDurability: 1,
      magic_effect: 'Mild forest mana infusion; amplifies herbal stews and elixirs.',
      rarity: 'uncommon',
      weight: 0.3,
      properties: { mycology: 'Amber Woodland Cap', culinary: 'SavoryUmami' },
    },
  },
  {
    id: 'mushroom_stew',
    name: 'Hearty Mushroom Stew',
    category: 'consumable',
    colorHex: '#EA580C',
    icon: 'utensils',
    description: 'Warm woodland potage brewed from Wild Mushrooms & Herbs (+4 HP, +65 Stamina, +30 Magic).',
    lore: 'Simmered wild caps steeped with fragrant forest greens.',
    magicEffect: 'Sustained warmth and balanced body-spirit restoration.',
    meshKind: 'potion',
    healAmount: 4,
    staminaAmount: 65,
    magicAmount: 30,
    metadata: {
      power: 22,
      durability: 1,
      maxDurability: 1,
      magic_effect: 'Sustained hearth warmth (+4 HP, +65 Stamina, +30 Magic).',
      rarity: 'rare',
      weight: 0.8,
      craftable: true,
      properties: { brewType: 'Hearth Potage', potency: 'High' },
    },
  },
  {
    id: 'healing_tonic',
    name: 'Woodland Healing Tonic',
    category: 'consumable',
    colorHex: '#F43F5E',
    icon: 'flask',
    description: 'Rich crimson brew that restores +4 Health and +35 Stamina.',
    lore: 'Distilled woodland berry nectar infused with sweet meadow herbs.',
    magicEffect: 'Instant restorative draft for active exploration.',
    meshKind: 'potion',
    healAmount: 4,
    staminaAmount: 35,
    metadata: {
      power: 20,
      durability: 1,
      maxDurability: 1,
      magic_effect: 'Instant restorative draft (+4 HP, +35% Stamina).',
      rarity: 'uncommon',
      weight: 0.45,
      craftable: true,
      properties: { brewType: 'Alchemical Elixir', vessel: 'Corked Vial' },
    },
  },
  {
    id: 'roasted_fish',
    name: 'Campfire Grilled Trout',
    category: 'consumable',
    colorHex: '#F59E0B',
    icon: 'utensils',
    description: 'Savory hearth-cooked trout (+5 Health, +75 Stamina).',
    meshKind: 'fish',
    healAmount: 5,
    staminaAmount: 75,
    metadata: {
      power: 24,
      durability: 1,
      maxDurability: 1,
      magic_effect: 'Deep trail vitality meal (+5 HP, +75% Stamina).',
      rarity: 'uncommon',
      weight: 0.65,
      craftable: true,
      properties: { preparation: 'Hearth Seared', servings: 1 },
    },
  },
  {
    id: 'moss_elixir',
    name: 'Glowing Moss Brew',
    category: 'consumable',
    colorHex: '#10B981',
    icon: 'sparkles',
    description: 'Luminous cavern tonic (+2 Health, full Stamina & +65 Magic).',
    lore: 'Bioluminescent cave spores steeped in berry essence.',
    magicEffect: 'Surges spell energy (+65 Magic) and refreshes full endurance.',
    meshKind: 'potion',
    healAmount: 2,
    staminaAmount: 100,
    magicAmount: 65,
    metadata: {
      power: 28,
      durability: 1,
      maxDurability: 1,
      magic_effect: 'Surges spell energy (+65 Magic) and restores full endurance.',
      rarity: 'rare',
      weight: 0.4,
      craftable: true,
      properties: { element: 'Bioluminescent Mana', glow: 'Emerald' },
    },
  },
  {
    id: 'river_stone',
    name: 'Smooth River Stone',
    category: 'resource',
    colorHex: '#64748B',
    icon: 'gem',
    description: 'Dense river cobble. Craft with Wood Log for a Timber Club, or whet blades.',
    lore: 'Water-polished basalt ideal for toolheads, cairns, and whetstones.',
    meshKind: 'stone',
    metadata: {
      power: 5,
      durability: 60,
      maxDurability: 60,
      magic_effect: 'Shapes durable toolheads and sharpens dulled metal edges.',
      rarity: 'common',
      weight: 2.2,
      properties: { mineral: 'River Basalt', grain: 'Fine Whetstone' },
    },
  },
  {
    id: 'cave_moss',
    name: 'Glowing Cave Moss',
    category: 'resource',
    colorHex: '#34D399',
    icon: 'sprout',
    description: 'Damp glowing moss from the Mountain Cave. Craft into Moss Brew or Amulets.',
    lore: 'Phosphorescent lichen humming with subterranean vitality.',
    magicEffect: 'Key catalyst for magical brews and enchanted talismans.',
    meshKind: 'moss',
    metadata: {
      power: 14,
      durability: 25,
      maxDurability: 25,
      magic_effect: 'Luminescent arcane reagent for elixirs and runic charms.',
      rarity: 'uncommon',
      weight: 0.35,
      properties: { biomeOrigin: 'Mountain Cave', luminescence: 'Active' },
    },
  },
  {
    id: 'ancient_bone',
    name: 'Beast Bone Trophy',
    category: 'resource',
    colorHex: '#E7E5E4',
    icon: 'bone',
    description: 'Weathered relic from the Mountain Cave. Craft with Cave Moss for a Beast Amulet.',
    meshKind: 'bone',
    metadata: {
      power: 16,
      durability: 85,
      maxDurability: 85,
      magic_effect: 'Holds carved runic grooves that channel battle strength.',
      rarity: 'rare',
      weight: 1.4,
      properties: { relicOrigin: 'Cavern Beast', carving: 'Runic Ready' },
    },
  },
  {
    id: 'ranger_hat',
    name: 'Forester Wide Hat',
    category: 'wearable',
    colorHex: '#B45309',
    icon: 'crown',
    description: 'Sturdy woodland explorer hat (+12% movement speed when worn).',
    lore: 'Waxed felt trail hat trimmed with a hawk feather.',
    meshKind: 'hat',
    wearSlot: 'head',
    wearColorHex: '#9A5B2F',
    speedBonus: 0.12,
    defenseBonus: 1,
    metadata: {
      power: 9,
      durability: 110,
      maxDurability: 110,
      magic_effect: 'Feather-light stride grants +12% travel agility and +1 DEF.',
      rarity: 'uncommon',
      weight: 0.6,
      repairable: true,
      properties: { slot: 'Headgear', weatherproof: true },
    },
  },
  {
    id: 'leaf_cloak',
    name: 'Woodland Cloak',
    category: 'wearable',
    colorHex: '#15803D',
    icon: 'shirt',
    description: 'Woven emerald ranger cape (+2 Max Health & +2 DEF when worn).',
    lore: 'Weatherproof moss-dyed mantle worn by forest wardens.',
    magicEffect: 'Bolsters vitality (+2 Max HP) against harsh weather and blows.',
    meshKind: 'cloak',
    wearSlot: 'body',
    wearColorHex: '#256F3E',
    maxHealthBonus: 2,
    defenseBonus: 2,
    metadata: {
      power: 15,
      durability: 130,
      maxDurability: 130,
      magic_effect: 'Bolsters vitality (+2 Max HP, +2 DEF) in dense forest.',
      rarity: 'rare',
      weight: 1.5,
      craftable: true,
      repairable: true,
      properties: { slot: 'Body Mantle', weave: 'Enchanted Leafcloth' },
    },
  },
  {
    id: 'bone_amulet',
    name: 'Cave Beast Amulet',
    category: 'wearable',
    colorHex: '#2DD4BF',
    icon: 'shield',
    description: 'Carved bone & glowing moss talisman (+1 Attack Power when worn).',
    lore: 'Inscribed with ancient cavern runes that sharpen every strike.',
    magicEffect: '+1 Attack Power & +1 Defense aura while worn.',
    meshKind: 'amulet',
    wearSlot: 'accessory',
    wearColorHex: '#2DD4BF',
    attackBonus: 1,
    defenseBonus: 1,
    metadata: {
      power: 19,
      durability: 150,
      maxDurability: 150,
      magic_effect: 'Channels cavern rune force (+1 Attack Power, +1 Defense).',
      rarity: 'epic',
      weight: 0.4,
      craftable: true,
      repairable: true,
      properties: { slot: 'Talisman', resonance: 'Subterranean Rune' },
    },
  },
  {
    id: 'golden_crown',
    name: 'Sunlit Crown',
    category: 'wearable',
    colorHex: '#FACC15',
    icon: 'crown',
    description: 'Gleaming faceted crown (+2 Max Health & +15% speed when worn).',
    lore: 'Ceremonial laurel awarded to heroes of the Lantern Tavern.',
    magicEffect: '+2 Max HP, +2 Defense, and +15% sunlit swiftness.',
    meshKind: 'hat',
    wearSlot: 'head',
    wearColorHex: '#FACC15',
    maxHealthBonus: 2,
    speedBonus: 0.15,
    defenseBonus: 2,
    metadata: {
      power: 26,
      durability: 200,
      maxDurability: 200,
      magic_effect: '+2 Max HP, +2 DEF, and +15% sunlit swiftness.',
      rarity: 'legendary',
      weight: 1.0,
      repairable: true,
      properties: { slot: 'Royal Crown', blessing: 'Lantern Festival' },
    },
  },
  {
    id: 'oak_shield',
    name: 'Woodland Oak Shield',
    category: 'wearable',
    colorHex: '#B47634',
    icon: 'shield',
    description:
      'Sturdy iron-rimmed oak shield carried in your off-hand alongside a 1-handed weapon. Press Use (E / Alt) when attacked to raise your shield and absorb incoming blows.',
    lore: 'Seasoned heartwood plank braced with riveted brass bands and a central iron boss.',
    magicEffect: 'Reduces blocked incoming damage by 65% and prevents knockdown stun while guarding.',
    meshKind: 'shield',
    wearSlot: 'offhand',
    wearColorHex: '#B47634',
    defenseBonus: 1,
    blockReduction: 0.65,
    metadata: {
      power: 14,
      durability: 120,
      maxDurability: 120,
      magic_effect: 'Raise with Use (E) to block 65% of incoming strike damage and brace against knockdowns.',
      rarity: 'common',
      weight: 2.8,
      craftable: true,
      repairable: true,
      properties: { slot: 'Off-Hand Shield', blockReduce: '65%', pairsWith: '1-Handed Weapons' },
    },
  },
  {
    id: 'iron_kite_shield',
    name: 'Iron Kite Shield',
    category: 'wearable',
    colorHex: '#94A3B8',
    icon: 'shield',
    description:
      'Reinforced steel kite shield for boss battles. Press Use (E / Alt) to raise it in front of you and blunt ferocious elemental and claw attacks.',
    lore: 'Tempered dragon-warding iron shield crested with an ember sigil.',
    magicEffect: 'Reduces blocked incoming damage by 80% and halves elemental burn/shock/freeze buildup.',
    meshKind: 'shield',
    wearSlot: 'offhand',
    wearColorHex: '#94A3B8',
    defenseBonus: 2,
    blockReduction: 0.8,
    metadata: {
      power: 22,
      durability: 180,
      maxDurability: 180,
      magic_effect: 'Raise with Use (E) to absorb 80% of strike damage and halve elemental status duration.',
      rarity: 'rare',
      weight: 4.0,
      craftable: true,
      repairable: true,
      properties: { slot: 'Off-Hand Shield', blockReduce: '80%', pairsWith: '1-Handed Weapons' },
    },
  },
];

export interface ResolvedItemMetadata {
  power: number;
  durability: number;
  maxDurability: number;
  magic_effect: string;
  rarity: ItemRarity;
  weight: number;
  craftable: boolean;
  repairable: boolean;
  properties: Record<string, string | number | boolean>;
}

export function resolveItemMetadata(
  item: InventoryItemDef,
  stack?: InventoryStack | null
): ResolvedItemMetadata {
  const m = item.metadata ?? {};
  const defaultPower =
    item.category === 'weapon' || item.category === 'tool'
      ? (1 + (item.attackBonus ?? 0)) * 6
      : item.category === 'wearable'
      ? (item.defenseBonus ?? 0) * 5 + (item.maxHealthBonus ?? 0) * 4 + (item.attackBonus ?? 0) * 6
      : item.category === 'consumable'
      ? (item.healAmount ?? 0) * 4 + Math.round((item.staminaAmount ?? 0) / 10) + Math.round((item.magicAmount ?? 0) / 5)
      : 5;

  const defaultMaxDurability =
    item.category === 'weapon' || item.category === 'tool'
      ? 100
      : item.category === 'wearable'
      ? 120
      : item.category === 'resource' || item.category === 'material'
      ? 50
      : 1;

  const maxDurability = Math.max(1, m.maxDurability ?? stack?.maxDurability ?? defaultMaxDurability);
  const rawDurability = stack?.durability ?? m.durability ?? maxDurability;
  const durability = Math.max(0, Math.min(maxDurability, rawDurability));

  const inferredRarity: ItemRarity =
    m.rarity ??
    ((item.attackBonus ?? 0) >= 2 || (item.healAmount ?? 0) >= 4 || (item.maxHealthBonus ?? 0) >= 2
      ? 'rare'
      : (item.magicAmount ?? 0) > 20 || (item.defenseBonus ?? 0) >= 1
      ? 'uncommon'
      : 'common');

  const magic_effect =
    (m.magic_effect ?? item.magicEffect ?? '').trim() ||
    (item.healAmount || item.magicAmount || item.staminaAmount
      ? [
          item.healAmount ? `+${item.healAmount} Health` : '',
          item.staminaAmount ? `+${item.staminaAmount}% Stamina` : '',
          item.magicAmount ? `+${item.magicAmount} Magic` : '',
        ]
          .filter(Boolean)
          .join(' · ')
      : item.category === 'resource' || item.category === 'material'
      ? 'Refineable at a Crafting Bench into tools, brews, or gear.'
      : 'Standard field-ready equipment.');

  const dynamicProps: Record<string, string | number | boolean> = {
    category: item.category,
    ...(item.toolKind ? { toolAction: item.toolKind } : {}),
    ...(item.wearSlot ? { wearSlot: item.wearSlot } : {}),
    ...(item.weaponRange ? { reach: `${item.weaponRange.toFixed(1)}m` } : {}),
    ...(item.attackBonus ? { attackBonus: `+${item.attackBonus}` } : {}),
    ...(item.defenseBonus ? { defenseBonus: `+${item.defenseBonus}` } : {}),
    ...(item.healAmount ? { healAmount: `+${item.healAmount} HP` } : {}),
    ...(item.magicAmount ? { magicRestore: `+${item.magicAmount} MP` } : {}),
    ...(m.properties ?? {}),
  };

  return {
    power: m.power ?? Math.max(1, defaultPower),
    durability,
    maxDurability,
    magic_effect,
    rarity: inferredRarity,
    weight: m.weight ?? (item.category === 'weapon' ? 2.5 : item.category === 'wearable' ? 1.0 : 0.4),
    craftable: Boolean(m.craftable),
    repairable: m.repairable ?? (item.category === 'weapon' || item.category === 'tool' || item.category === 'wearable'),
    properties: dynamicProps,
  };
}

export const DefaultCraftingRecipes: CraftingRecipe[] = [
  {
    id: 'recipe_tonic',
    title: 'Woodland Healing Tonic',
    ingredientA: 'wild_berries',
    ingredientB: 'forest_herbs',
    resultItemId: 'healing_tonic',
    resultQty: 1,
    category: 'alchemy',
  },
  {
    id: 'recipe_mushroom_stew',
    title: 'Hearty Mushroom Stew',
    ingredientA: 'wild_mushroom',
    ingredientB: 'forest_herbs',
    resultItemId: 'mushroom_stew',
    resultQty: 1,
    category: 'consumable',
  },
  {
    id: 'recipe_mushroom_tonic',
    title: 'Wild Berry Mushroom Brew',
    ingredientA: 'wild_mushroom',
    ingredientB: 'wild_berries',
    resultItemId: 'healing_tonic',
    resultQty: 1,
    category: 'alchemy',
  },
  {
    id: 'recipe_grilled_fish',
    title: 'Campfire Grilled Trout',
    ingredientA: 'raw_fish',
    ingredientB: 'wood_log',
    resultItemId: 'roasted_fish',
    resultQty: 1,
    category: 'consumable',
  },
  {
    id: 'recipe_torch',
    title: 'Pine Torch',
    ingredientA: 'wood_log',
    ingredientB: 'wood_log',
    resultItemId: 'campfire_torch',
    resultQty: 1,
    category: 'tool',
  },
  {
    id: 'recipe_club',
    title: 'Heavy Timber Club',
    ingredientA: 'wood_log',
    ingredientB: 'river_stone',
    resultItemId: 'timber_club',
    resultQty: 1,
    category: 'weapon',
  },
  {
    id: 'recipe_moss_brew',
    title: 'Glowing Moss Brew',
    ingredientA: 'cave_moss',
    ingredientB: 'wild_berries',
    resultItemId: 'moss_elixir',
    resultQty: 1,
    category: 'alchemy',
  },
  {
    id: 'recipe_amulet',
    title: 'Cave Beast Amulet',
    ingredientA: 'ancient_bone',
    ingredientB: 'cave_moss',
    resultItemId: 'bone_amulet',
    resultQty: 1,
    category: 'wearable',
  },
  {
    id: 'recipe_cloak',
    title: 'Woodland Cloak',
    ingredientA: 'forest_herbs',
    ingredientB: 'cave_moss',
    resultItemId: 'leaf_cloak',
    resultQty: 1,
    category: 'wearable',
  },
  {
    id: 'recipe_oak_shield',
    title: 'Woodland Oak Shield',
    ingredientA: 'wood_log',
    ingredientB: 'ancient_bone',
    resultItemId: 'oak_shield',
    resultQty: 1,
    category: 'wearable',
  },
  {
    id: 'recipe_kite_shield',
    title: 'Iron Kite Shield',
    ingredientA: 'oak_shield',
    ingredientB: 'river_stone',
    resultItemId: 'iron_kite_shield',
    resultQty: 1,
    category: 'wearable',
  },
];

export const DefaultInventoryCategories: InventoryCategoryConfig[] = [
  {
    id: 'all',
    label: 'All Items',
    matchCategories: ['tool', 'weapon', 'consumable', 'wearable', 'resource', 'material'],
    statProfile: 'auto',
  },
  {
    id: 'hold',
    label: 'Weapons & Tools',
    matchCategories: ['weapon', 'tool'],
    statProfile: 'weapon',
    statLabels: { primary: 'Damage', secondary: 'Reach', tertiary: 'Role' },
  },
  {
    id: 'wear',
    label: 'Apparel & Gear',
    matchCategories: ['wearable'],
    statProfile: 'apparel',
    statLabels: { primary: 'Defense', secondary: 'Vitality', tertiary: 'Agility' },
  },
  {
    id: 'consume',
    label: 'Plants & Potions',
    matchCategories: ['consumable'],
    statProfile: 'consumable',
    statLabels: { primary: 'Heal', secondary: 'Stamina', tertiary: 'Magic' },
  },
  {
    id: 'material',
    label: 'Resources & Relics',
    matchCategories: ['resource', 'material'],
    statProfile: 'material',
    statLabels: { primary: 'Craft Use', secondary: 'Magic', tertiary: 'Origin' },
  },
];

export const DefaultWorldCollectibles: WorldCollectibleRule[] = [
  {
    scatterKind: 'mushroom',
    label: 'Forest Mushrooms',
    enabled: true,
    itemId: 'wild_mushroom',
    qty: 1,
    collectMethod: 'interact',
  },
  {
    scatterKind: 'berryBush',
    label: 'Wild Berry Bushes',
    enabled: true,
    itemId: 'wild_berries',
    qty: 2,
    collectMethod: 'interact',
  },
  {
    scatterKind: 'fern',
    label: 'Woodland Ferns',
    enabled: true,
    itemId: 'forest_herbs',
    qty: 1,
    collectMethod: 'interact',
  },
  {
    scatterKind: 'broadleaf',
    label: 'Broadleaf Herbs',
    enabled: true,
    itemId: 'forest_herbs',
    qty: 1,
    collectMethod: 'interact',
  },
  {
    scatterKind: 'flower',
    label: 'Wildflowers',
    enabled: true,
    itemId: 'forest_herbs',
    qty: 1,
    collectMethod: 'interact',
  },
  {
    scatterKind: 'rock',
    label: 'River & Trail Stones',
    enabled: true,
    itemId: 'river_stone',
    qty: 1,
    collectMethod: 'interact',
  },
];

export function createDefaultInventoryConfig(): GameInventoryConfig {
  return {
    panelTitle: "{heroName}'s Pack & Workbench",
    panelSubtitle: 'Inspect gear, study plants & magic properties, or mix items together',
    toggleKey: 'Tab',
    allowMixWorkbench: true,
    mixTitle: 'Mixing Workbench',
    mixButtonLabel: 'Mix Items',
    categories: DefaultInventoryCategories.map((c) => ({
      ...c,
      matchCategories: [...c.matchCategories],
      statLabels: c.statLabels ? { ...c.statLabels } : undefined,
    })),
    worldCollectibles: DefaultWorldCollectibles.map((r) => ({ ...r })),
  };
}

export function resolveGameInventoryConfig(
  project: GameProject | null | undefined
): GameInventoryConfig {
  const def = createDefaultInventoryConfig();
  const raw = project?.inventoryConfig;
  if (!raw) return def;
  const worldMap = new Map<string, WorldCollectibleRule>();
  for (const r of def.worldCollectibles) worldMap.set(r.scatterKind, r);
  for (const r of raw.worldCollectibles ?? []) worldMap.set(r.scatterKind, r);
  return {
    panelTitle: raw.panelTitle?.trim() ? raw.panelTitle : def.panelTitle,
    panelSubtitle: raw.panelSubtitle?.trim() ? raw.panelSubtitle : def.panelSubtitle,
    toggleKey: raw.toggleKey || def.toggleKey,
    allowMixWorkbench: raw.allowMixWorkbench ?? def.allowMixWorkbench,
    mixTitle: raw.mixTitle?.trim() ? raw.mixTitle : def.mixTitle,
    mixButtonLabel: raw.mixButtonLabel?.trim() ? raw.mixButtonLabel : def.mixButtonLabel,
    categories:
      raw.categories && raw.categories.length > 0
        ? raw.categories
        : def.categories,
    worldCollectibles: Array.from(worldMap.values()),
  };
}

export function formatKeyCodeLabel(code: string): string {
  if (!code) return 'Tab';
  if (code === 'Tab') return 'Tab';
  if (code === 'Backquote') return '`';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}

export function getProjectInventoryItems(project: GameProject | null | undefined): InventoryItemDef[] {
  const custom = project?.inventoryItems ?? [];
  if (custom.length === 0) return DefaultInventoryItems;
  const map = new Map<string, InventoryItemDef>();
  for (const d of DefaultInventoryItems) map.set(d.id, d);
  for (const c of custom) map.set(c.id, c);
  return Array.from(map.values());
}

export function getProjectCraftingRecipes(project: GameProject | null | undefined): CraftingRecipe[] {
  const custom = project?.craftingRecipes ?? [];
  if (custom.length === 0) return DefaultCraftingRecipes;
  const map = new Map<string, CraftingRecipe>();
  for (const d of DefaultCraftingRecipes) map.set(d.id, d);
  for (const c of custom) map.set(c.id, c);
  return Array.from(map.values());
}

export function findCraftingRecipe(
  recipes: CraftingRecipe[],
  idA: string,
  idB: string
): CraftingRecipe | null {
  return (
    recipes.find(
      (r) =>
        (r.ingredientA === idA && r.ingredientB === idB) ||
        (r.ingredientA === idB && r.ingredientB === idA)
    ) ?? null
  );
}

export function createStarterOpenWorldPickups(): LevelEntity[] {
  const riverBankPt = IslandTerrain.worldToBoard(RiverCrossing.x - 7.5, RiverCrossing.z + 9.5);
  const [caveMossX, caveMossZ] = fromMountainCaveLocal(-1.8, -4.6);
  const caveMossPt = IslandTerrain.worldToBoard(caveMossX, caveMossZ);
  const [caveBoneX, caveBoneZ] = fromMountainCaveLocal(1.4, -7.2);
  const caveBonePt = IslandTerrain.worldToBoard(caveBoneX, caveBoneZ);

  return [
    createEntity('prop', 'Crafting Bench', 0.172, 0.77, {
      propPreset: 'craftingBench',
      rotation: 20,
    }),
    createEntity('pickup', "Woodcutter's Axe", 0.16, 0.768, {
      pickupable: true,
      pickupItemId: 'wood_axe',
      pickupQty: 1,
      loot: "Woodcutter's Axe",
    }),
    createEntity('pickup', 'Bamboo Fishing Pole', 0.132, 0.762, {
      pickupable: true,
      pickupItemId: 'fishing_pole',
      pickupQty: 1,
      loot: 'Bamboo Fishing Pole',
    }),
    createEntity('pickup', 'Riverbank Fishing Pole', riverBankPt.x, riverBankPt.y, {
      pickupable: true,
      pickupItemId: 'fishing_pole',
      pickupQty: 1,
      loot: 'Bamboo Fishing Pole',
    }),
    createEntity('pickup', 'Wild Forest Berries', 0.178, 0.785, {
      pickupable: true,
      pickupItemId: 'wild_berries',
      pickupQty: 2,
      loot: 'Wild Forest Berries',
    }),
    createEntity('pickup', 'Fragrant Forest Herbs', 0.195, 0.755, {
      pickupable: true,
      pickupItemId: 'forest_herbs',
      pickupQty: 2,
      loot: 'Fragrant Forest Herbs',
    }),
    createEntity('pickup', 'Forester Wide Hat', 0.155, 0.728, {
      pickupable: true,
      pickupItemId: 'ranger_hat',
      pickupQty: 1,
      loot: 'Forester Wide Hat',
    }),
    createEntity('pickup', 'Glowing Cave Moss', caveMossPt.x, caveMossPt.y, {
      pickupable: true,
      pickupItemId: 'cave_moss',
      pickupQty: 2,
      loot: 'Glowing Cave Moss',
    }),
    createEntity('pickup', 'Beast Bone Trophy', caveBonePt.x, caveBonePt.y, {
      pickupable: true,
      pickupItemId: 'ancient_bone',
      pickupQty: 1,
      loot: 'Beast Bone Trophy',
    }),
  ];
}

function makeCard(
  whenKey: string,
  actionKeys: string[],
  detail = '',
  conditionKeys: string[] = [],
  whenDetail = ''
): BehaviorCard {
  return {
    id: uid(),
    when: { id: uid(), key: whenKey, detail: whenDetail },
    conditions: conditionKeys.map((k) => ({ id: uid(), key: k, detail: '' })),
    actions: actionKeys.map((k) => ({
      id: uid(),
      key: k,
      detail:
        k === 'say' ||
        k === 'giveTreasure' ||
        k === 'playAnimation' ||
        k === 'showMessage' ||
        k === 'setFlag' ||
        k === 'attack' ||
        k === 'flyPattern' ||
        k === 'landAndAttack'
          ? detail
          : '',
    })),
    isOnce: false,
    isEnabled: true,
  };
}

export function createBlankLevel(
  name = 'New level',
  biome: BiomeId = 'meadow',
  environmentType: EnvironmentType = 'openWorld'
): GameLevel {
  return {
    id: uid(),
    name,
    style: 'openWorld',
    environmentType,
    cameraMode: environmentType === 'sideScroller' ? 'sideScroll' : 'front',
    biome,
    sky: environmentType === 'openWorld' ? 'golden' : 'sunny',
    sunAngle: environmentType === 'openWorld' ? 32 : 45,
    fog: environmentType === 'openWorld' ? 0.24 : 0.15,
    hasStart: true,
    hasPortal: true,
    completeCondition: 'reachPortal',
    requiredCount: 3,
    objectives: [{ id: uid(), text: 'Reach the portal', isOptional: false }],
    entities: [],
    terrain: createInitialTerrain(),
    audio: defaultLevelAudio('calm'),
    weather: environmentType === 'openWorld' ? 'fireflies' : 'none',
    vistaPreset: environmentType === 'openWorld' || environmentType === 'castle' ? 'alpineValley' : 'none',
    vistaDensity: 0.85,
    vistaItems: [],
    canopyEngine: buildCanopyConfigFromUserDefaults(undefined),
    wind: 0.3,
    canSwim: true,
    notes: '',
  };
}

function buildCastleProject(name: string): GameProject {
  const courtyard: GameLevel = {
    ...createBlankLevel('The Courtyard', 'meadow', 'castle'),
    sky: 'sunny',
    cameraMode: 'front',
    audio: defaultLevelAudio('adventure'),
    objectives: [
      { id: uid(), text: 'Find the gold key', isOptional: false },
      { id: uid(), text: 'Open the big door', isOptional: false },
    ],
    entities: [
      createEntity('npc', 'Mira the Merchant', 0.24, 0.62, {
        dialogue: 'A key? The guard dropped one by the well.',
        cards: [makeCard('playerTalks', ['say', 'playAnimation'], 'A key? The guard dropped one by the well.')],
      }),
      createEntity('key', 'Gold key', 0.58, 0.72),
      createEntity('baddie', 'Guard', 0.42, 0.34, {
        health: 3,
        brain: 'Patroller',
        cards: [makeCard('seesPlayer', ['chase', 'say'], 'Oi! Come back here!')],
      }),
      createEntity('treasure', 'Wooden chest', 0.72, 0.58, {
        cards: [makeCard('playerTouches', ['giveTreasure', 'playSound', 'destroySelf'], '3 coins')],
      }),
      createEntity('trap', 'Spike trap', 0.34, 0.48),
      createEntity('prop', 'Barrel', 0.18, 0.42),
      createEntity('door', 'Big door', 0.86, 0.5, {
        cards: [makeCard('playerUses', ['openDoor', 'showMessage'], 'The door creaks open.', ['hasKey'])],
      }),
      createEntity('platform', 'Stone lift', 0.52, 0.52, {
        platformEnd: { x: 0.64, y: 0.42 },
      }),
    ],
  };

  const dungeon: GameLevel = {
    ...createBlankLevel('The Dungeon', 'cave', 'dungeon'),
    sky: 'cave',
    cameraMode: 'front',
    completeCondition: 'defeatAll',
    audio: defaultLevelAudio('tense'),
    objectives: [
      { id: uid(), text: 'Light the two torches', isOptional: false },
      { id: uid(), text: 'Get past the bats', isOptional: false },
    ],
    entities: [
      createEntity('baddie', 'Bat', 0.32, 0.3, { health: 2, brain: 'Flyer' }),
      createEntity('baddie', 'Bat', 0.55, 0.42, { health: 2, brain: 'Flyer' }),
      createEntity('puzzle', 'Torch light', 0.24, 0.66, {
        puzzleType: 'Torch light',
        cards: [makeCard('playerTouches', ['playSound', 'setFlag'], 'torch lit')],
      }),
      createEntity('trap', 'Dart wall', 0.66, 0.6),
      createEntity('treasure', 'Old chest', 0.78, 0.3, {
        cards: [makeCard('playerTouches', ['giveTreasure', 'playSound', 'destroySelf'], '6 coins')],
      }),
      createEntity('light', 'Torch', 0.2, 0.28),
      createEntity('checkpoint', 'Checkpoint', 0.5, 0.72),
    ],
  };

  const throne: GameLevel = {
    ...createBlankLevel('The Throne Room', 'cave', 'castle'),
    sky: 'night',
    cameraMode: 'front',
    completeCondition: 'defeatAll',
    audio: defaultLevelAudio('battle'),
    objectives: [
      { id: uid(), text: 'Defeat the guard captain', isOptional: false },
      { id: uid(), text: 'Reach the portal', isOptional: false },
    ],
    entities: [
      createEntity('baddie', 'Captain', 0.6, 0.36, {
        health: 8,
        brain: 'Boss',
        isBoss: true,
        cards: [makeCard('healthLow', ['say', 'shakeCamera', 'chase'], 'You are stronger than you look!', ['isBoss'])],
      }),
      createEntity('treasure', 'Crown', 0.8, 0.62),
      createEntity('prop', 'Throne', 0.5, 0.14),
      createEntity('light', 'Candle', 0.3, 0.3),
      createEntity('light', 'Candle', 0.7, 0.3),
    ],
  };

  courtyard.nextLevelID = dungeon.id;
  dungeon.nextLevelID = throne.id;

  return {
    id: uid(),
    name,
    tagline: 'Save the castle from the grumpy guard.',
    symbol: 'castle.fill',
    colorHex: '#6C4CF1',
    updatedAt: new Date().toISOString(),
    levels: [courtyard, dungeon, throne],
    heroName: 'Pip',
    heroBody: 'Adventurer',
    heroColors: { tunic: '#6C4CF1', cloak: '#F2545B', hair: '#5A3825', skin: '#F4C7A1' },
    enabledActions: [...StarterActions],
    hud: defaultHUDProfile(),
    currencies: ['Coins', 'Gems', 'Keys'],
    coverTagline: 'One key. Three levels. A very grumpy guard.',
    difficulty: 'Easy',
    published: false,
  };
}

function buildThemedProject(
  name: string,
  biome: BiomeId,
  sky: SkyPresetId,
  levels: string[],
  baddie: string,
  npc: string,
  symbol: string,
  colorHex: string,
  tagline: string,
  heroBody = 'Explorer',
  environmentType: EnvironmentType = 'openWorld'
): GameProject {
  const built: GameLevel[] = levels.map((title, idx) => {
    const level = createBlankLevel(title, biome, environmentType);
    level.sky = sky;
    level.cameraMode = environmentType === 'sideScroller' ? 'sideScroll' : 'front';
    level.audio = defaultLevelAudio(idx === 0 ? 'adventure' : 'mystery');
    level.objectives = [
      { id: uid(), text: 'Find the treasure', isOptional: false },
      { id: uid(), text: 'Reach the portal', isOptional: false },
    ];
    if (environmentType === 'sideScroller') {
      level.platformerTuning = { ...DEFAULT_PLATFORMER_MOVEMENT };
      level.entities = [
        createEntity('npc', npc, 0.13, 0.5, {
          dialogue: 'Jump, air-dash (C), bounce on springs, and grab all 3 Star Coins!',
          cards: [makeCard('playerTalks', ['say', 'playAnimation'], 'Use Space to jump, C to air-dash!')],
        }),
        createPlatformerModuleEntity('coinTrail', { x: 0.2, y: 0.5 }, { elevationY: 0.2 }),
        createPlatformerModuleEntity('shuttlePlatform', { x: 0.26, y: 0.5 }, { elevationY: 1.5 }),
        createPlatformerModuleEntity('starCoin', { x: 0.28, y: 0.5 }, {
          elevationY: 3.4,
          configPatch: { starIndex: 1 },
        }),
        createPlatformerModuleEntity('oneWayPlatform', { x: 0.35, y: 0.5 }, { elevationY: 2.1 }),
        createPlatformerModuleEntity('enemyPatroller', { x: 0.4, y: 0.5 }),
        createPlatformerModuleEntity('checkpointFlag', { x: 0.45, y: 0.5 }),
        createPlatformerModuleEntity('bounceSpring', { x: 0.5, y: 0.5 }),
        createPlatformerModuleEntity('dashCrystal', { x: 0.55, y: 0.5 }, { elevationY: 4.0 }),
        createPlatformerModuleEntity('crumblingPlatform', { x: 0.6, y: 0.5 }, { elevationY: 2.0 }),
        createPlatformerModuleEntity('enemyFlyer', { x: 0.66, y: 0.5 }, { elevationY: 2.8 }),
        createPlatformerModuleEntity('starCoin', { x: 0.67, y: 0.5 }, {
          elevationY: 4.8,
          configPatch: { starIndex: 2 },
        }),
        createPlatformerModuleEntity('barrelCannon', { x: 0.73, y: 0.5 }, { elevationY: 0.5 }),
        createPlatformerModuleEntity('secretWall', { x: 0.8, y: 0.5 }),
        createPlatformerModuleEntity('starCoin', { x: 0.82, y: 0.5 }, {
          elevationY: 1.3,
          configPatch: { starIndex: 3 },
        }),
        createPlatformerModuleEntity('finishGoal', { x: 0.89, y: 0.5 }),
      ];
    } else {
      level.entities = [
        createEntity('npc', npc, 0.22, 0.62, {
          dialogue: 'Careful out there!',
          cards: [makeCard('playerTalks', ['say', 'playAnimation'], 'Careful out there!')],
        }),
        createEntity('baddie', baddie, 0.5, 0.36, {
          health: 3,
          brain: 'Chaser',
          cards: [makeCard('seesPlayer', ['chase'])],
        }),
        createEntity('treasure', 'Hidden treasure', 0.74, 0.3, {
          pickupable: true,
          pickupItemId: 'leaf_cloak',
          pickupQty: 1,
          cards: [makeCard('playerTouches', ['giveTreasure', 'playSound', 'destroySelf'], '5 coins')],
        }),
        createEntity('trap', 'Trap', 0.38, 0.56),
        createEntity('prop', 'Crate', 0.62, 0.66, {
          pickupable: true,
          pickupItemId: 'river_stone',
          pickupQty: 2,
        }),
        createEntity('scenery', 'Bush', 0.82, 0.6),
        ...(environmentType === 'openWorld' && idx === 0 ? createStarterOpenWorldPickups() : []),
      ];
      if (name === 'Island Explorer' && idx === 0) {
        const drakeBp = createShowcaseTwinFlameDrakeBlueprint();
        level.entities.push(
          createEntity('baddie', 'Twin-Flame Drake', 0.35, 0.62, {
            isBoss: true,
            brain: 'Boss',
            health: drakeBp.health ?? 18,
            speed: drakeBp.speed ?? 4,
            damage: 2,
            scale: 1.3,
            monsterConfig: drakeBp,
            baddieAI: drakeBp.baddieAI,
            dialogue: 'Twice the jaws, twice the fire!',
            cards: [
              makeCard('seesPlayer', ['chase', 'randomAttack'], '', [], '26m'),
              makeCard('playerNear', ['landAndAttack'], 'groundPound', ['isFlying'], '5m'),
              makeCard('healthLow', ['say', 'enrage', 'shakeCamera'], 'Now feel our twin inferno!', ['isBoss']),
            ],
          })
        );
        level.objectives.unshift({
          id: uid(),
          text: 'Defeat the Twin-Flame Drake boss',
          isOptional: false,
        });
      }
      if (idx > 0) {
        level.entities.push(createEntity('key', 'Old key', 0.3, 0.3));
        level.objectives.push({ id: uid(), text: 'Find the old key', isOptional: true });
      }
    }
    return level;
  });

  for (let i = 0; i < built.length - 1; i++) {
    built[i].nextLevelID = built[i + 1].id;
  }

  return {
    id: uid(),
    name,
    tagline,
    symbol,
    colorHex,
    updatedAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    levels: built,
    heroName: 'Sam',
    heroBody,
    heroColors: { tunic: colorHex, cloak: '#FF9F1C', hair: '#2C2C34', skin: '#F4C7A1' },
    enabledActions: [...StarterActions],
    hud: defaultHUDProfile(),
    currencies: ['Coins', 'Gems', 'Keys'],
    coverTagline: tagline,
    difficulty: 'Easy',
    published: false,
  };
}

function buildFloatingIslandProject(name: string): GameProject {
  const skyIsland = createBlankLevel('Floating Island Sanctuary', 'meadow', 'openWorld');
  skyIsland.sky = 'sunny';
  skyIsland.sunAngle = 42;
  skyIsland.fog = 0.14;
  skyIsland.weather = 'leaves';
  skyIsland.vistaPreset = 'coastalArchipelago';
  skyIsland.terrain = createFloatingIslandTerrain();
  skyIsland.audio = defaultLevelAudio('adventure');
  skyIsland.objectives = [
    { id: uid(), text: 'Explore the central shrine & cove lagoon', isOptional: false },
    { id: uid(), text: 'Cross the river bridge & reach the summit portal', isOptional: false },
  ];

  const shrineCenter = IslandTerrain.worldToBoard(0, 0);
  const shrineGuard = IslandTerrain.worldToBoard(12, 10);
  const coveChest = IslandTerrain.worldToBoard(46, 52);
  const liftStart = IslandTerrain.worldToBoard(92, -52);
  const liftEnd = IslandTerrain.worldToBoard(106, -68);

  skyIsland.entities = [
    createEntity('npc', 'Skipper the Islander', 0.16, 0.77, {
      dialogue: 'Welcome to the Floating Island! Check the central shrine and eastern cove before heading up to the summit portal.',
      cards: [makeCard('playerTalks', ['say', 'playAnimation'], 'Check the shrine and cove lagoon before taking the bridge!')],
    }),
    createEntity('prop', 'Lantern Signpost', 0.21, 0.74, {
      propPreset: 'signpost',
      dialogue: 'Trail East: River Footbridge & Summit · Trail Center: Sky Shrine · South Cove: Tidal Lagoon',
    }),
    createEntity('treasure', 'Shrine Chest', shrineCenter.x, shrineCenter.y, {
      mechTemplate: 'treasureChest',
      cards: [makeCard('playerTouches', ['giveTreasure', 'playSound', 'destroySelf'], '5 coins')],
    }),
    createEntity('baddie', 'Reef Crab', shrineGuard.x, shrineGuard.y, {
      health: 3,
      brain: 'Patroller',
      cards: [makeCard('seesPlayer', ['chase'])],
    }),
    createEntity('treasure', 'Lagoon Chest', coveChest.x, coveChest.y, {
      pickupable: true,
      pickupItemId: 'golden_crown',
      pickupQty: 1,
      cards: [makeCard('playerTouches', ['giveTreasure', 'playSound', 'destroySelf'], '6 coins')],
    }),
    createEntity('platform', 'Sky Stone Lift', liftStart.x, liftStart.y, {
      platformPreset: 'stoneLift',
      platformSpeed: 2.2,
      platformEnd: liftEnd,
    }),
    ...createStarterOpenWorldPickups(),
  ];

  return {
    id: uid(),
    name,
    tagline: 'A lush floating island paradise with sky lifts, caves, and hidden coves.',
    symbol: 'sun.max.fill',
    colorHex: '#20B46A',
    updatedAt: new Date().toISOString(),
    levels: [skyIsland],
    heroName: 'Pip',
    heroBody: 'Explorer',
    heroColors: { tunic: '#20B46A', cloak: '#F59E0B', hair: '#4A3122', skin: '#F4C7A1' },
    enabledActions: [...StarterActions],
    hud: defaultHUDProfile(),
    currencies: ['Coins', 'Gems', 'Keys'],
    coverTagline: 'Coves, bridges, mountain grottos and a summit shrine.',
    difficulty: 'Easy',
    published: false,
  };
}

function buildBuddiesProject(name: string): GameProject {
  const forest = createBlankLevel('Acorn Feast Trail', 'forest', 'openWorld');
  forest.sky = 'golden';
  forest.sunAngle = 28;
  forest.timeOfDay = 16.5;
  forest.fog = 0.18;
  forest.weather = 'leaves';
  forest.vistaPreset = 'alpineValley';
  forest.vistaDensity = 1.0;
  forest.gameplayMode = 'buddies';
  forest.startWithDuckling = true;
  forest.completeCondition = 'gatherBuddies';
  forest.requiredCount = 3;
  forest.startPoint = BuddiesLandmarks.startBoard;
  forest.portalPoint = BuddiesLandmarks.portalBoard;
  forest.heroIntroSpeech =
    "Hang tight, little duckling! Let's gather Digby, Prickles, and Pippa — each misfit's quirky talent unlocks a new power (Q) for our journey to the Woodland Tavern!";
  forest.chapterNumber = 1;
  forest.chapterTitle = 'The Stinky Little Hero';
  forest.chapterSummary =
    'With a lost baby duckling waddling close behind, Pepper the Skunk sets off across Whispering Woods to prove that odd quirks make the finest heroes.';
  forest.terrain = createBuddiesTerrain();
  forest.audio = defaultLevelAudio('adventure');
  forest.objectives = [
    { id: uid(), text: 'Detour NW into the Mountain Cave to find Digby the Mole Rat', isOptional: false },
    { id: uid(), text: 'Follow the south forest path to Prickles the Porcupine’s cottage', isOptional: false },
    { id: uid(), text: 'Cross the footbridge & detour to Whispering Lake for Pippa the Vulture', isOptional: false },
    { id: uid(), text: 'Bring all 3 buddies to the Woodland Tavern for your reward', isOptional: false },
  ];

  const [caveMossX, caveMossZ] = fromMountainCaveLocal(-1.7, -4.4);
  const caveMossBoard = IslandTerrain.worldToBoard(caveMossX, caveMossZ);
  const [caveTorchX, caveTorchZ] = fromMountainCaveLocal(-1.9, -9.2);
  const caveTorchBoard = IslandTerrain.worldToBoard(caveTorchX, caveTorchZ);
  const caveLamp2 = IslandTerrain.worldToBoard(...fromMountainCaveLocal(2.1, -6.5));
  const tavernHost = IslandTerrain.worldToBoard(BuddiesLandmarks.tavernWorld[0] - 2.5, BuddiesLandmarks.tavernWorld[1] + 5.2);
  const tavernFeastChest = IslandTerrain.worldToBoard(BuddiesLandmarks.tavernWorld[0] + 5.2, BuddiesLandmarks.tavernWorld[1] + 2.5);
  const tavernFire = IslandTerrain.worldToBoard(BuddiesLandmarks.tavernWorld[0] - 6.0, BuddiesLandmarks.tavernWorld[1] + 6.4);
  const berriesSpot = IslandTerrain.worldToBoard(26, 85);
  const fishSpot = IslandTerrain.worldToBoard(BuddiesLandmarks.dockSpotWorld[0] + 4.5, BuddiesLandmarks.dockSpotWorld[1] + 2.5);
  const scentBrambleSpot = IslandTerrain.worldToBoard(-98, 86);
  const quillLatchSpot = IslandTerrain.worldToBoard(22, 85);
  const sonarMoundSpot = IslandTerrain.worldToBoard(-19, -43);
  const lookoutTotemSpot = IslandTerrain.worldToBoard(58, -38);

  forest.entities = [
    // Detour signposts
    createEntity('sign', 'Signpost: Mountain Cave', BuddiesLandmarks.caveSignBoard.x, BuddiesLandmarks.caveSignBoard.y, {
      propPreset: 'signpost',
      dialogue: 'North Spur: Whispering Mountain Cave (Watch your step — Digby the Mole Rat is digging deep inside!)',
    }),
    createEntity('sign', 'Signpost: Burrow Home', BuddiesLandmarks.homeSignBoard.x, BuddiesLandmarks.homeSignBoard.y, {
      propPreset: 'signpost',
      dialogue: 'South Trail Detour: Pine-Needle Hollow — Home of Prickles the Porcupine.',
    }),
    createEntity('sign', 'Signpost: Forest Lake & Tavern', BuddiesLandmarks.lakeSignBoard.x, BuddiesLandmarks.lakeSignBoard.y, {
      propPreset: 'signpost',
      dialogue: 'NW Fork: Whispering Forest Lake & Village Dock (Pippa!) · NE Main Road: Woodland Acorn Tavern',
    }),

    // Misfit Trait Puzzles showcasing each buddy's flaw-turned-superpower
    createEntity('puzzle', 'Grumpy Briar Bramble', scentBrambleSpot.x, scentBrambleSpot.y, {
      puzzleRequires: 'skunkScent',
      puzzleFlag: 'briar_bramble_cleared',
      puzzleRewardText: 'Your Skunk Scent cleared the thorny briar patch! (+5 Coins)',
      notes: 'Use Q (Skunk Scent) nearby to clear the stinky-allergic bramble.',
    }),
    createEntity('puzzle', 'Hanging Acorn Latch', quillLatchSpot.x, quillLatchSpot.y, {
      puzzleRequires: 'porcupineQuills',
      puzzleFlag: 'acorn_latch_snapped',
      puzzleRewardText: "Prickles's Quill Shot snapped the high acorn latch! (+5 Coins)",
      notes: 'Recruit Prickles, switch to Quill Shot (X), and fire (Q) at the hanging latch!',
    }),
    createEntity('puzzle', 'Buried Truffle Mound', sonarMoundSpot.x, sonarMoundSpot.y, {
      puzzleRequires: 'moleSonar',
      puzzleFlag: 'truffle_mound_unearthed',
      puzzleRewardText: "Digby's Ear Sonar unearthed a hidden Truffle Cache! (+5 Coins)",
      notes: 'Use Ear Sonar (Q) near the lake clearing to ping & unearth hidden truffles!',
    }),
    createEntity('puzzle', 'Sky-Lookout Totem', lookoutTotemSpot.x, lookoutTotemSpot.y, {
      puzzleRequires: 'vultureSight',
      puzzleFlag: 'lookout_totem_charted',
      puzzleRewardText: "Pippa's High Sight charted the Lantern Tavern valley! (+5 Coins)",
      notes: 'Activate High Sight (Q) near the ridge totem to survey the forest from above.',
    }),

    // Buddy 1: Digby the Mole Rat deep inside the enterable Mountain Cave!
    createEntity('npc', 'Digby the Mole Rat', BuddiesLandmarks.caveInteriorBoard.x, BuddiesLandmarks.caveInteriorBoard.y, {
      creatureType: 'Mole Rat',
      isBuddy: true,
      misfitAbility: 'moleSonar',
      buddyAreaLabel: 'Mountain Cave',
      speed: 5.2,
      dialogue:
        "Whoa, you braved the mountain cavern! My eyes are squinty, yet my ears hear everything — press X to pick Ear Sonar and Q to ping buried secrets!",
      cards: [makeCard('playerTalks', ['say', 'playSound'], "Lead the way out of the cave, Pepper! My ears are yours!")],
    }),
    createEntity('light', 'Cave Torch West', caveTorchBoard.x, caveTorchBoard.y),
    createEntity('light', 'Cave Torch East', caveLamp2.x, caveLamp2.y),
    createEntity('pickup', 'Glowing Cave Moss', caveMossBoard.x, caveMossBoard.y, {
      pickupable: true,
      pickupItemId: 'cave_moss',
      pickupQty: 2,
    }),

    // Buddy 2: Prickles the Porcupine at Southern Forest Home Clearing
    createEntity('prop', 'Pine-Needle Cottage', BuddiesLandmarks.homeCottageBoard.x, BuddiesLandmarks.homeCottageBoard.y, {
      propPreset: 'cottage',
      rotation: -140,
    }),
    createEntity('npc', 'Prickles the Porcupine', BuddiesLandmarks.porcupineBoard.x, BuddiesLandmarks.porcupineBoard.y, {
      creatureType: 'Porcupine',
      isBuddy: true,
      misfitAbility: 'porcupineQuills',
      buddyAreaLabel: 'Forest Home',
      speed: 5.2,
      dialogue:
        "Everyone says I'm too prickly, Pepper, yet watch my quills pop high targets! Press X to switch to Quill Shot and Q to fire!",
      cards: [makeCard('playerTalks', ['say', 'playSound'], "Let's roll out, my quills are ready!")],
    }),
    createEntity('npc', 'Nutkin the Squirrel', IslandTerrain.worldToBoard(28, 84).x, IslandTerrain.worldToBoard(28, 84).y, {
      creatureType: 'Squirrel',
      critterAttitude: 'teasing',
      critterWarmOn: 'nearbyPower',
      dialogue:
        "Haha, a stinky skunk and a prickly porcupine? Don't poke my acorns! Bet you can't even reach that Hanging Acorn Latch!",
      critterWarmLines:
        "Whoa — you snapped that latch in one clean shot! Guess sharp quills are pretty amazing after all.\nSee you at the Lantern Tavern!",
    }),
    createEntity('pickup', 'Wild Forest Berries', berriesSpot.x, berriesSpot.y, {
      pickupable: true,
      pickupItemId: 'wild_berries',
      pickupQty: 3,
    }),

    // Buddy 3: Pippa the Vulture at Whispering Lake & Village Dock
    createEntity('prop', 'Whispering Lake Dock', BuddiesLandmarks.dockBoard.x, BuddiesLandmarks.dockBoard.y, {
      propPreset: 'dock',
      rotation: -55,
    }),
    createEntity('light', 'Village Campfire', BuddiesLandmarks.campfireBoard.x, BuddiesLandmarks.campfireBoard.y, {
      propPreset: 'campfire',
    }),
    createEntity('npc', 'Pippa the Vulture', BuddiesLandmarks.vultureBoard.x, BuddiesLandmarks.vultureBoard.y, {
      creatureType: 'Vulture',
      isBuddy: true,
      misfitAbility: 'vultureSight',
      buddyAreaLabel: 'Lakeside Village',
      speed: 5.4,
      dialogue:
        "Folks side-eye a vulture, yet nobody spots trouble faster from the clouds! Use High Sight (X then Q) to scout landmarks!",
      cards: [makeCard('playerTalks', ['say', 'playSound'], "Wingmates stick together! To the Lantern Tavern!")],
    }),
    createEntity('npc', 'Barnaby the Badger', IslandTerrain.worldToBoard(-20, -47).x, IslandTerrain.worldToBoard(-20, -47).y, {
      creatureType: 'Badger',
      critterAttitude: 'grumpy',
      critterWarmOn: 'nearbyPower',
      dialogue:
        "Hmph. No mole rat with squinty eyes is going to find truffles around MY lake dock.",
      critterWarmLines:
        "Well, butter my whiskers — Digby's Ear Sonar found the truffles right under my nose!\nMy apologies, little misfits. You're true forest scouts!",
    }),
    createEntity('pickup', 'Bamboo Fishing Pole', fishSpot.x, fishSpot.y, {
      pickupable: true,
      pickupItemId: 'fishing_pole',
      pickupQty: 1,
    }),

    // Final Area: Woodland Acorn & Lantern Tavern + Innkeeper + Celebration Campfire & Reward Chest
    createEntity('prop', 'Woodland Lantern Tavern', BuddiesLandmarks.tavernBoard.x, BuddiesLandmarks.tavernBoard.y, {
      propPreset: 'tavern',
      rotation: -135,
    }),
    createEntity('light', 'Tavern Courtyard Bonfire', tavernFire.x, tavernFire.y, {
      propPreset: 'campfire',
    }),
    createEntity('npc', 'Hootie the Owl', IslandTerrain.worldToBoard(98, -68).x, IslandTerrain.worldToBoard(98, -68).y, {
      creatureType: 'Owl',
      critterAttitude: 'nervous',
      critterWarmOn: 'allBuddies',
      dialogue:
        "Hoo-hoo... a skunk AND a vulture on the road? I'll just stay perched at the edge of the courtyard, thank you!",
      critterWarmLines:
        "Hoo! You brought everyone safely to the Lantern Tavern — and the baby duckling too!\nEvery critter in Whispering Woods owes you an apology!",
    }),
    createEntity('npc', 'Bram the Innkeeper', tavernHost.x, tavernHost.y, {
      dialogue:
        'Welcome to the Lantern Tavern! Bring all three woodland buddies here and our Acorn Feast celebration begins!',
      cards: [
        makeCard(
          'playerTalks',
          ['say'],
          'Gather Digby from the cave, Prickles from her cottage, and Pippa from the lake village — then step up to the feast altar!'
        ),
      ],
    }),
    createEntity('treasure', 'Acorn Feast Reward Chest', tavernFeastChest.x, tavernFeastChest.y, {
      cards: [makeCard('playerTouches', ['giveTreasure', 'playSound', 'destroySelf'], '15 coins')],
    }),
    ...createStarterOpenWorldPickups().slice(0, 3),
  ];

  const digby = forest.entities.find((e) => e.name.includes('Digby'));
  const prickles = forest.entities.find((e) => e.name.includes('Prickles'));
  const pippa = forest.entities.find((e) => e.name.includes('Pippa'));
  const nutkin = forest.entities.find((e) => e.name.includes('Nutkin'));
  forest.storyShots = [
    ...(digby
      ? [
          {
            id: uid(),
            name: 'Digby in Cave',
            targetMode: 'entity' as const,
            targetEntityId: digby.id,
            yaw: 25,
            pitch: 18,
            distance: 6.5,
            heightOffset: 1.3,
            fov: 46,
          },
        ]
      : []),
    ...(prickles
      ? [
          {
            id: uid(),
            name: 'Prickles at Hollow',
            targetMode: 'entity' as const,
            targetEntityId: prickles.id,
            yaw: -32,
            pitch: 20,
            distance: 7.5,
            heightOffset: 1.4,
            fov: 48,
          },
        ]
      : []),
    ...(nutkin
      ? [
          {
            id: uid(),
            name: 'Nutkin Scolding',
            targetMode: 'entity' as const,
            targetEntityId: nutkin.id,
            yaw: 28,
            pitch: 16,
            distance: 6.2,
            heightOffset: 1.35,
            fov: 44,
          },
        ]
      : []),
    ...(pippa
      ? [
          {
            id: uid(),
            name: 'Pippa by Lake',
            targetMode: 'entity' as const,
            targetEntityId: pippa.id,
            yaw: 40,
            pitch: 22,
            distance: 8.2,
            heightOffset: 1.5,
            fov: 48,
          },
        ]
      : []),
  ];

  if (nutkin && prickles) {
    const nutkinShot = forest.storyShots.find((s) => s.targetEntityId === nutkin.id);
    const pricklesShot = forest.storyShots.find((s) => s.targetEntityId === prickles.id);
    const sampleSkit: StorySkit = {
      id: uid(),
      name: 'Nutkin Teases Prickles',
      caption: 'Meanwhile, over by the cottage fence...',
      triggerKind: 'nearEntity',
      triggerEntityId: prickles.id,
      triggerRadius: 15,
      playOnce: true,
      pauseHeroMovement: true,
      returnTransition: 'whipPan',
      showLetterbox: true,
      beats: [
        {
          id: uid(),
          speakerKind: 'narrator',
          text: 'Over by the cottage fence, Nutkin the Squirrel was loudly warning Prickles to keep those quills to herself.',
          cameraShotId: nutkinShot?.id,
          transition: 'whipPan',
          lookAtKind: 'entity',
          lookAtEntityId: prickles.id,
          emote: 'angry',
          durationSec: 3.4,
          waitForVoice: true,
        },
        {
          id: uid(),
          speakerKind: 'entity',
          speakerEntityId: nutkin.id,
          text: 'Careful with those needles, Prickles! Nobody wants a walking pincushion near the acorn patch!',
          cameraShotId: nutkinShot?.id,
          transition: 'glide',
          lookAtKind: 'entity',
          lookAtEntityId: prickles.id,
          emote: 'angry',
          durationSec: 3.2,
          waitForVoice: true,
        },
        {
          id: uid(),
          speakerKind: 'entity',
          speakerEntityId: prickles.id,
          text: "I'm sorry... I didn't mean to get too close again.",
          cameraShotId: pricklesShot?.id,
          transition: 'glide',
          lookAtKind: 'entity',
          lookAtEntityId: nutkin.id,
          emote: 'shy',
          durationSec: 3.2,
          waitForVoice: true,
        },
      ],
    };
    forest.storySkits = [sampleSkit];
  }

  return {
    id: uid(),
    name,
    tagline: 'Detour off the forest trail to gather your three woodland buddies and celebrate at the Tavern.',
    symbol: 'pawprint.fill',
    colorHex: '#FF9F1C',
    updatedAt: new Date().toISOString(),
    levels: [forest],
    heroName: 'Pepper',
    heroBody: 'Skunk',
    heroColors: { tunic: '#1E2028', cloak: '#F8FAFC', hair: '#1A1B22', skin: '#1E2028' },
    enabledActions: [...StarterActions],
    hud: defaultHUDProfile(),
    currencies: ['Coins', 'Gems', 'Keys'],
    storybook: {
      enabled: true,
      theme: 'woodland',
      subtitle: 'Book I · The Misfits of Whispering Woods',
      authorCredit: 'An Interactive Road-Trip Storybook',
      prologueText:
        'Deep in Whispering Woods, everyone crossed to the other side of the trail whenever Pepper the Skunk strolled by. Yet when a lost baby duckling peeped for help, four overlooked misfits set out together—about to prove that every seeming flaw hides a wonder.',
      epilogueTitle: 'Warm Lanterns & New Friends',
      epilogueText:
        'By the time Pepper, Digby, Prickles, Pippa, and the little duckling reached the Lantern Tavern, every squirrel, badger, and owl who had teased or hidden from them was cheering along the trail.',
      moralLine:
        'The very things that make you feel out of place are often the gifts the world needs most.',
    },
    coverTagline: 'A skunk, a porcupine, a mole rat, a vulture — and one legendary Tavern feast.',
    difficulty: 'Easy',
    published: false,
  };
}

function buildDrivingProject(name: string): GameProject {
  const rally = createBlankLevel('Timberline Rally Loop', 'forest', 'openWorld');
  rally.sky = 'sunny';
  rally.sunAngle = 38;
  rally.fog = 0.14;
  rally.weather = 'leaves';
  rally.vistaPreset = 'alpineValley';
  rally.gameplayMode = 'driving';
  rally.completeCondition = 'completeCourse';
  rally.cameraMode = 'chase';
  rally.drivingConfig = {
    carId: 'trailBuggy',
    physicsId: 'arcadeDrift',
    driverId: 'stunt',
    cameraView: 'closeChase',
  };
  rally.terrain = createDrivingTerrain();
  rally.audio = defaultLevelAudio('adventure');

  const startPt = IslandTerrain.worldToBoard(DrivingWaypoints[0][0], DrivingWaypoints[0][1]);
  const portalPt = IslandTerrain.worldToBoard(DrivingWaypoints[DrivingWaypoints.length - 2][0], DrivingWaypoints[DrivingWaypoints.length - 2][1]);
  rally.startPoint = startPt;
  rally.portalPoint = portalPt;

  const checkpointIndices = [1, 3, 4, 6, 7, 9];
  const checkpoints: LevelEntity[] = checkpointIndices.map((wpIdx, order) => {
    const p = DrivingWaypoints[wpIdx];
    const next = DrivingWaypoints[Math.min(DrivingWaypoints.length - 1, wpIdx + 1)];
    const yawDeg = (Math.atan2(next[0] - p[0], next[1] - p[1]) * 180) / Math.PI;
    const bp = IslandTerrain.worldToBoard(p[0], p[1]);
    return createEntity('checkpoint', `Checkpoint Arch ${order + 1}`, bp.x, bp.y, {
      propPreset: 'checkpointArch',
      rotation: yawDeg,
      checkpointOrder: order + 1,
    });
  });

  // Stunt ramps aligned smoothly along straight sections of the loop
  const rampIndices = [2, 5, 8];
  const ramps: LevelEntity[] = rampIndices.map((wpIdx, idx) => {
    const p = DrivingWaypoints[wpIdx];
    const next = DrivingWaypoints[Math.min(DrivingWaypoints.length - 1, wpIdx + 1)];
    const yawDeg = (Math.atan2(next[0] - p[0], next[1] - p[1]) * 180) / Math.PI;
    const bp = IslandTerrain.worldToBoard(p[0], p[1]);
    return createEntity('prop', `Timber Stunt Ramp ${idx + 1}`, bp.x, bp.y, {
      propPreset: 'ramp',
      rotation: yawDeg,
    });
  });

  // Trackside scenic props & lakeside vista tavern
  const vistaTavern = IslandTerrain.worldToBoard(112, -52);
  rally.entities = [
    ...checkpoints,
    ...ramps,
    createEntity('prop', 'Pit Stop Tavern', vistaTavern.x, vistaTavern.y, {
      propPreset: 'tavern',
      rotation: -120,
    }),
    createEntity('sign', 'Rally Pit Board', 0.2, 0.72, {
      propPreset: 'signpost',
      dialogue: 'Switch your Car, Physics Mode, or Driver Type anytime using the Driving Deck!',
    }),
  ];

  rally.objectives = [
    { id: uid(), text: 'Blast through all 6 forest rally checkpoint arches', isOptional: false },
    { id: uid(), text: 'Hit the timber stunt ramps & test different cars & physics presets', isOptional: true },
  ];

  return {
    id: uid(),
    name,
    tagline: 'Switch cars, physics presets, and drivers across a banked forest rally loop.',
    symbol: 'car.fill',
    colorHex: '#38BDF8',
    updatedAt: new Date().toISOString(),
    levels: [rally],
    heroName: 'Ace',
    heroBody: 'Explorer',
    heroColors: { tunic: '#38BDF8', cloak: '#F59E0B', hair: '#1F2937', skin: '#F4C7A1' },
    enabledActions: [...StarterActions],
    hud: defaultHUDProfile(),
    currencies: ['Coins', 'Gems', 'Keys'],
    coverTagline: '4 vehicles · 4 physics presets · 4 drivers · Stunt ramps.',
    difficulty: 'Easy',
    published: false,
  };
}

function buildRpgProject(name: string): GameProject {
  const rpgLevel: GameLevel = {
    ...createBlankLevel('Nottingham Forest · Oakhollow & Cursed Caves', 'forest', 'openWorld'),
    style: 'openWorld',
    environmentType: 'openWorld',
    visualStyle: 'painterlyPBR',
    cameraMode: 'isometric',
    biome: 'forest',
    sky: 'golden',
    sunAngle: 38,
    fog: 0.24,
    weather: 'fireflies',
    vistaPreset: 'none',
    canSwim: false,
    gameplayMode: 'rpg',
    completeCondition: 'defeatAll',
    audio: defaultLevelAudio('adventure'),
    rpgConfig: {
      scenario: 'medievalVillage',
      lootMode: 'both',
      pathStyle: 'weatheredStone',
      isInterior: false,
      volumetricLanterns: true,
      cameraZoom: 25,
    },
    notes: 'Nottingham Forest isometric RPG featuring Forest Crossroads spawn, compact Oakhollow village with tavern/blacksmith/cottage/watermill/windmill/livestock, stone arch river bridge, peak-to-peak rope bridge, and 5-room walkable MountainCave.',
  };

  if (rpgLevel.terrain) {
    rpgLevel.terrain = carveRpgRiverGorgeTerrain(rpgLevel.terrain, 0, -14);
  }

  const at = (wx: number, wz: number) => levelWorldToBoard(rpgLevel, wx, wz);
  const place = (
    kind: EntityKind,
    label: string,
    wx: number,
    wz: number,
    extra?: Partial<LevelEntity> & { rotation?: number }
  ) => {
    const pt = at(wx, wz);
    return createEntity(kind, label, pt.x, pt.y, extra);
  };

  const [caveHubX, caveHubZ] = fromMountainCaveLocal(0, -13.0);
  const [caveWestX, caveWestZ] = fromMountainCaveLocal(-8.5, -14.2);
  const [caveBossX, caveBossZ] = fromMountainCaveLocal(0, -27.5);
  const [caveGuardX, caveGuardZ] = fromMountainCaveLocal(1.4, -3.5);

  rpgLevel.startPoint = at(0, 34);
  rpgLevel.portalPoint = at(0, -39);

  rpgLevel.entities = [
    // Crossroads Signpost & Companion Party greeting hero at Forest Crossroads (0, 34)
    place('prop', 'Forest Crossroads Signpost', 3.2, 33.0, {
      notes: 'RPG Prop: crossroadsSignpost',
      scale: 1.0,
      rotation: 0,
    }),
    place('npc', 'Sir Alden (Companion Knight)', -2.6, 30.8, {
      isBuddy: true,
      dialogue: 'Ahead lies Oakhollow Village, with the Cursed Caves in the western crags! Walk to any building door and press E to explore inside.',
      health: 40,
      styleTint: '#3B82F6',
      notes: 'RPG Companion: knight',
    }),
    place('npc', 'Lyra (Companion Mage)', 2.6, 30.8, {
      isBuddy: true,
      dialogue: 'Cross the Stone Arch Bridge north of Oakhollow, or climb to the Peak Rope Bridge between the twin mountain crags!',
      health: 32,
      styleTint: '#A855F7',
      notes: 'RPG Companion: mage',
    }),
    place('npc', 'Rowan (Companion Ranger)', 0, 29.2, {
      isBuddy: true,
      dialogue: 'Watch the western trail—torchlit Cursed Caves cut deep beneath the crags, while bandits hold the North Temple.',
      health: 34,
      styleTint: '#10B981',
      notes: 'RPG Companion: ranger',
    }),

    // Strolling Medieval Villagers walking Oakhollow lanes
    place('npc', 'Miller Gareth (Village Peddler)', -1.5, 22.0, {
      brain: 'wander',
      speed: 1.35,
      dialogue: 'Fine morning in Oakhollow! Fresh bread at the market stalls, and the sawmill wheel is turning down by the river.',
      styleTint: '#B45309',
      notes: 'RPG Villager: roadWalker',
    }),
    place('npc', 'Elspeth (Village Weaver)', 1.8, 8.5, {
      brain: 'wander',
      speed: 1.25,
      dialogue: 'Hear that ringing? Master Brom is forging a red-hot blade inside the Ironhearth Blacksmith!',
      styleTint: '#15803D',
      notes: 'RPG Villager: roadWalker',
    }),
    place('npc', 'Old Toma (Bridge Watchman)', -1.4, -5.5, {
      brain: 'wander',
      speed: 1.15,
      dialogue: 'The Stone Arch Bridge carries wagons over the emerald river, while daredevils still brave the high peak Rope Bridge to the northwest!',
      styleTint: '#475569',
      notes: 'RPG Villager: roadWalker',
    }),

    // Full-Sized Walk-In Enterable Buildings (Press E at front door; interior shifts smoothly to Close camera with roof intact!)
    place('prop', 'Golden Acorn Walk-In Tavern', -13, 11, {
      notes: 'RPG Building: tavern',
      scale: 1.0,
      rotation: 0,
    }),
    place('prop', 'Ironhearth Walk-In Blacksmith Forge', 13, 11, {
      notes: 'RPG Building: blacksmith',
      scale: 1.0,
      rotation: 0,
    }),
    place('prop', 'Forest Herbalist Walk-In Cottage', -16.5, -1.5, {
      notes: 'RPG Building: cottage',
      scale: 1.0,
      rotation: 90,
    }),
    place('prop', 'Ancient Vine Stone Temple Sanctum', 0, -33, {
      notes: 'RPG Building: stoneShrine',
      scale: 1.0,
      rotation: 0,
    }),

    // River Sawmill / Watermill, Hilltop Windmill & Market Stalls
    place('prop', 'Nottingham River Watermill & Sawmill', 23, -5.5, {
      notes: 'RPG Prop: watermill',
      scale: 1.0,
      rotation: 18,
    }),
    place('prop', 'Hilltop Timber Windmill', 28, 28, {
      notes: 'RPG Prop: windmill',
      scale: 1.0,
      rotation: -28,
    }),
    place('prop', 'Crimson Banner Market Stall', -6.8, 22.0, {
      notes: 'RPG Prop: marketStall',
      styleTint: '#B91C1C',
      scale: 1.0,
      rotation: 90,
    }),
    place('prop', 'Emerald Herb Market Stall', 6.8, 22.0, {
      notes: 'RPG Prop: marketStall',
      styleTint: '#15803D',
      scale: 1.0,
      rotation: -90,
    }),

    // Tethered Saddle Horses outside the Tavern & Villager Raking Yard Leaves outside the Cottage
    place('prop', 'Tethered Tavern Horses & Hitching Post', -7.2, 16.5, {
      notes: 'RPG Prop: tetheredHorses',
      scale: 1.0,
      rotation: 0,
    }),
    place('prop', 'Villager Raking Yard Leaves', -9.8, 2.2, {
      notes: 'RPG Prop: rakingVillager',
      scale: 1.0,
      rotation: 24,
    }),

    // 1) Chamfered Stone Arch Bridge across the main Nottingham River road (0, -14)
    place('prop', 'Ancient Chamfered Stone Arch Bridge', 0, -14, {
      notes: 'RPG Prop: stoneArchBridge',
      scale: 1.0,
      rotation: 0,
    }),
    // 2) Peak-to-Peak Rope & Broken-Slat Suspension Bridge between the twin northwest mountain peaks (-32, -33)
    place('prop', 'Peak-to-Peak Rope Bridge with Broken Slat', -32, -33, {
      notes: 'RPG Prop: ropeBridge',
      scale: 1.0,
      rotation: 0,
    }),

    // Hanging Lamps on Posts flanking the crossroads, village square & bridge approaches
    place('prop', 'Village Hanging Lamp Post', -3.6, 25.0, {
      notes: 'RPG Prop: hangingLampPost',
      scale: 1.0,
      rotation: 0,
    }),
    place('prop', 'Village Hanging Lamp Post', 3.6, 25.0, {
      notes: 'RPG Prop: hangingLampPost',
      scale: 1.0,
      rotation: 180,
    }),
    place('prop', 'Village Hanging Lamp Post', -3.6, 11.5, {
      notes: 'RPG Prop: hangingLampPost',
      scale: 1.0,
      rotation: 0,
    }),
    place('prop', 'Village Hanging Lamp Post', 3.6, 11.5, {
      notes: 'RPG Prop: hangingLampPost',
      scale: 1.0,
      rotation: 180,
    }),
    place('prop', 'Village Hanging Lamp Post', -3.6, -4.5, {
      notes: 'RPG Prop: hangingLampPost',
      scale: 1.0,
      rotation: 0,
    }),
    place('prop', 'Village Hanging Lamp Post', 3.6, -4.5, {
      notes: 'RPG Prop: hangingLampPost',
      scale: 1.0,
      rotation: 180,
    }),

    // Weathered Broken Organic Stone Path Slabs along the village lane & bridge approaches
    place('prop', 'Weathered Broken Stone Path', 0, 28, {
      notes: 'RPG Prop: weatheredStonePath',
      scale: 1.15,
      rotation: 6,
    }),
    place('prop', 'Weathered Broken Stone Path', 0, 20, {
      notes: 'RPG Prop: weatheredStonePath',
      scale: 1.15,
      rotation: -8,
    }),
    place('prop', 'Weathered Broken Stone Path', 0, 12.5, {
      notes: 'RPG Prop: weatheredStonePath',
      scale: 1.15,
      rotation: 12,
    }),
    place('prop', 'Weathered Broken Stone Path', -6.4, 15.8, {
      notes: 'RPG Prop: weatheredStonePath',
      scale: 1.1,
      rotation: 20,
    }),
    place('prop', 'Weathered Broken Stone Path', 6.4, 15.8, {
      notes: 'RPG Prop: weatheredStonePath',
      scale: 1.1,
      rotation: -18,
    }),
    place('prop', 'Weathered Broken Stone Path', 0, 3.5, {
      notes: 'RPG Prop: weatheredStonePath',
      scale: 1.15,
      rotation: -10,
    }),
    place('prop', 'Weathered Broken Stone Path', 0, -23.5, {
      notes: 'RPG Prop: weatheredStonePath',
      scale: 1.15,
      rotation: -12,
    }),

    // Enclosed Chicken Coop Pen around (11, 19)
    place('prop', 'Distressed Split-Rail Fence', 9.8, 16.8, { notes: 'RPG Prop: fence', scale: 1.0, rotation: 4 }),
    place('prop', 'Distressed Split-Rail Fence', 12.2, 16.8, { notes: 'RPG Prop: fence', scale: 1.0, rotation: -5 }),
    place('prop', 'Distressed Split-Rail Fence', 9.8, 21.2, { notes: 'RPG Prop: fence', scale: 1.0, rotation: -4 }),
    place('prop', 'Distressed Split-Rail Fence', 12.2, 21.2, { notes: 'RPG Prop: fence', scale: 1.0, rotation: 5 }),
    place('prop', 'Distressed Split-Rail Fence', 8.6, 19.0, { notes: 'RPG Prop: fence', scale: 1.0, rotation: 92 }),
    place('prop', 'Distressed Split-Rail Fence', 13.4, 19.0, { notes: 'RPG Prop: fence', scale: 1.0, rotation: 88 }),
    place('prop', 'Wandering White Chicken', 10.4, 18.4, { notes: 'RPG Prop: chicken', scale: 0.9, styleTint: '#FFFBEB' }),
    place('prop', 'Wandering Speckled Hen', 11.6, 19.3, { notes: 'RPG Prop: chicken', scale: 0.86, styleTint: '#FDE68A' }),
    place('prop', 'Wandering Brown Hen', 10.7, 20.0, { notes: 'RPG Prop: chicken', scale: 0.88, styleTint: '#D97706' }),
    place('prop', 'Wandering Copper Rooster', 11.9, 18.2, { notes: 'RPG Prop: chicken', scale: 0.94, styleTint: '#B45309' }),

    // Enclosed Pasture with Dairy Cows & Farm Pigs around (11, 2)
    place('prop', 'Distressed Split-Rail Fence', 9.6, -0.4, { notes: 'RPG Prop: fence', scale: 1.0, rotation: -3 }),
    place('prop', 'Distressed Split-Rail Fence', 12.4, -0.4, { notes: 'RPG Prop: fence', scale: 1.0, rotation: 4 }),
    place('prop', 'Distressed Split-Rail Fence', 9.6, 4.4, { notes: 'RPG Prop: fence', scale: 1.0, rotation: 3 }),
    place('prop', 'Distressed Split-Rail Fence', 12.4, 4.4, { notes: 'RPG Prop: fence', scale: 1.0, rotation: -4 }),
    place('prop', 'Distressed Split-Rail Fence', 8.2, 2.0, { notes: 'RPG Prop: fence', scale: 1.0, rotation: 90 }),
    place('prop', 'Distressed Split-Rail Fence', 13.8, 2.0, { notes: 'RPG Prop: fence', scale: 1.0, rotation: 90 }),
    place('prop', 'Oakhollow Dairy Cow', 9.8, 1.4, { notes: 'RPG Prop: pastureCow', scale: 1.0, rotation: 35 }),
    place('prop', 'Oakhollow Spotted Cow', 12.2, 2.8, { notes: 'RPG Prop: pastureCow', scale: 0.94, rotation: -125 }),
    place('prop', 'Pasture Farm Pig', 11.4, 0.9, { notes: 'RPG Prop: pasturePig', scale: 0.95, rotation: 60 }),
    place('prop', 'Pasture Piglet', 10.2, 3.1, { notes: 'RPG Prop: pasturePig', scale: 0.82, rotation: -40 }),

    // Village Well & Hollow Magic Forest Tree
    place('prop', 'Village Stone Well', -4.8, 13.5, { notes: 'RPG Prop: well', scale: 1.0 }),
    place('prop', 'Hollow Magic Forest Tree', -24.5, 42.0, { notes: 'RPG Prop: hollowMagicTree', scale: 1.12 }),

    // Volumetric Lanterns
    place('light', 'Crossroads Volumetric Lantern', -2.8, 34.0, { notes: 'RPG Volumetric Lantern', styleTint: '#FFAE34' }),
    place('light', 'Courtyard Volumetric Lantern', -4.2, 16.5, { notes: 'RPG Volumetric Lantern', styleTint: '#FFAE34' }),
    place('light', 'Temple Volumetric Lantern', -3.4, -26.8, { notes: 'RPG Volumetric Lantern', styleTint: '#FFAE34' }),

    // Enemies guarding North Temple Ruins across the Stone Arch Bridge
    place('baddie', 'Bandit Raider', -5.2, -23.5, {
      brain: 'Chaser',
      health: 24,
      speed: 2.7,
      damage: 1,
      styleTint: '#EF4444',
    }),
    place('baddie', 'Dark Forest Cultist', 5.4, -24.0, {
      brain: 'patrol',
      health: 22,
      speed: 2.5,
      damage: 1,
      styleTint: '#8B5CF6',
    }),
    place('baddie', 'Ogre Brute Warlord', 0, -24.2, {
      brain: 'Chaser',
      health: 48,
      speed: 2.2,
      damage: 2,
      scale: 1.38,
      isBoss: true,
      styleTint: '#991B1B',
      notes: 'RPG Boss: ogre',
    }),

    // Encounters & Treasure INSIDE the 5-room walkable MountainCave ("The Cursed Caves")
    place('baddie', 'Cave Tunnel Sentry', caveGuardX, caveGuardZ, {
      brain: 'patrol',
      health: 20,
      speed: 2.3,
      damage: 1,
      styleTint: '#6366F1',
    }),
    place('baddie', 'Crystal Cavern Stalker', caveHubX, caveHubZ, {
      brain: 'Chaser',
      health: 28,
      speed: 2.6,
      damage: 1,
      styleTint: '#0EA5E9',
    }),
    place('baddie', 'Deep Sanctum Cave Troll', caveBossX, caveBossZ, {
      brain: 'Chaser',
      health: 52,
      speed: 2.1,
      damage: 2,
      scale: 1.32,
      isBoss: true,
      styleTint: '#4338CA',
      notes: 'RPG Boss: ogre',
    }),
    place('treasure', 'Crystal Grotto Vault Chest', caveWestX, caveWestZ, {
      loot: 'Coins',
      pickupable: true,
      pickupItemId: 'health_potion',
      pickupQty: 3,
      notes: 'RPG Cave Crystal Grotto Treasure',
    }),

    // Dual Treasure at North Temple
    place('treasure', 'Adventurer Loot Chest', -4.5, -26.5, {
      loot: 'Health',
      pickupable: true,
      pickupItemId: 'health_potion',
      pickupQty: 2,
      notes: 'RPG Traditional Chest',
    }),
    place('treasure', 'Fanned Skill & Loot Cards Shrine', 4.5, -26.5, {
      loot: 'Coins',
      notes: 'RPG Card Choice: Fanned-out colorful reward cards (Crimson Sunblade, Emerald Elixir & Herb Bundle, Arcane Storm Tome)',
      cards: [makeCard('playerTouches', ['giveTreasure', 'playSound', 'destroySelf'], 'Choose Skill Reward')],
    }),
  ];

  rpgLevel.objectives = [
    { id: uid(), text: 'Explore Oakhollow Village & press E at Tavern or Blacksmith doors (auto-switches to Close View)', isOptional: false },
    { id: uid(), text: 'Cross the Stone Arch Bridge or Peak-to-Peak Rope Bridge to defeat the Ogre Brute Warlord', isOptional: false },
    { id: uid(), text: 'Follow the western trail into The Cursed Caves to vanquish the Deep Sanctum Cave Troll', isOptional: false },
    { id: uid(), text: 'Loot the Crystal Grotto chest or choose a reward card at the North Temple shrine', isOptional: true },
  ];

  return {
    id: uid(),
    name,
    tagline: 'Nottingham Forest isometric RPG with village taverns, mills, livestock, stone & rope bridges, and 5-room walkable mountain caves.',
    symbol: 'shield.fill',
    colorHex: '#8B5CF6',
    updatedAt: new Date().toISOString(),
    levels: [rpgLevel],
    heroName: 'Valen',
    heroBody: 'Knight',
    heroColors: { tunic: '#8B5CF6', cloak: '#1F2430', hair: '#3B2820', skin: '#F4C7A1' },
    enabledActions: [
      'idle',
      'walk',
      'run',
      'sprint',
      'jump',
      'dodge',
      'swordLight',
      'swordHeavy',
      'block',
      'magicBolt',
      'heal',
      'open',
      'pickUp',
    ],
    hud: {
      ...defaultHUDProfile(),
      name: 'RPG',
      themeName: 'Fantasy',
    },
    currencies: ['Coins', 'Gems', 'Keys'],
    coverTagline: 'Isometric Diorama · Companion Party · Sword/Magic Combat · Loot Cards.',
    difficulty: 'Normal',
    published: false,
  };
}

function buildRoguelikeProject(name: string): GameProject {
  const baseFloor: GameLevel = {
    ...createBlankLevel('Floor 1 · Torchlit Crypt', 'cave', 'dungeon'),
    style: 'roomChain',
    environmentType: 'dungeon',
    visualStyle: 'painterlyPBR',
    cameraMode: 'isometric',
    biome: 'cave',
    sky: 'cave',
    sunAngle: 35,
    fog: 0.45,
    weather: 'none',
    vistaPreset: 'none',
    canSwim: false,
    gameplayMode: 'roguelike',
    completeCondition: 'defeatAll',
    audio: defaultLevelAudio('tense'),
    roguelikeConfig: { ...DEFAULT_ROGUELIKE_CONFIG },
    notes: 'Procedural isometric roguelike crypt with escalating bosses and relic drafts.',
  };

  const floor1 = generateRoguelikeFloor(
    baseFloor,
    DEFAULT_ROGUELIKE_CONFIG.fixedSeed ?? 104729,
    1,
    DEFAULT_ROGUELIKE_CONFIG
  );

  return {
    id: uid(),
    name,
    tagline: 'Descend through procedural stone vaults, draft relics & survive escalating bosses.',
    symbol: 'flame.fill',
    colorHex: '#E11D48',
    updatedAt: new Date().toISOString(),
    levels: [floor1],
    heroName: 'Delver',
    heroBody: 'Knight',
    heroColors: { tunic: '#E11D48', cloak: '#1F2430', hair: '#3B2820', skin: '#F4C7A1' },
    enabledActions: [
      'idle',
      'walk',
      'run',
      'sprint',
      'jump',
      'dodge',
      'swordLight',
      'swordHeavy',
      'block',
      'magicBolt',
      'heal',
      'open',
      'pickUp',
    ],
    hud: {
      ...defaultHUDProfile(),
      name: 'Roguelike',
      themeName: 'Crypt',
    },
    currencies: ['Coins', 'Gems', 'Keys'],
    coverTagline: 'Procedural dungeon floors · Relic drafts · Escalating bosses · Permadeath.',
    difficulty: 'Tricky',
    published: false,
  };
}

function buildDungeonBuilderProject(name: string): GameProject {
  const crypt: GameLevel = {
    ...createBlankLevel('Crypt Keep · Floor 1', 'cave', 'dungeon'),
    style: 'roomChain',
    environmentType: 'dungeon',
    visualStyle: 'painterlyPBR',
    cameraMode: 'front',
    biome: 'cave',
    sky: 'cave',
    sunAngle: 32,
    fog: 0.34,
    weather: 'none',
    vistaPreset: 'none',
    canSwim: false,
    completeCondition: 'reachPortal',
    audio: defaultLevelAudio('tense'),
    notes: 'Starter dungeon chamber built on the 2m snap grid with modular masonry blocks, stairs, torches, and animated doors.',
  };

  const at = (wx: number, wz: number) => levelWorldToBoard(crypt, wx, wz);
  const block = (
    nameLabel: string,
    wx: number,
    wz: number,
    bb: BuildingBlockConfig,
    opts: Partial<LevelEntity> = {}
  ): LevelEntity => {
    const bp = at(wx, wz);
    return createEntity(bb.shape === 'wallTorch' ? 'light' : 'prop', nameLabel, bp.x, bp.y, {
      buildingBlock: bb,
      ...opts,
    });
  };
  const modDoor = (
    nameLabel: string,
    wx: number,
    wz: number,
    dc: DoorConfig,
    opts: Partial<LevelEntity> = {}
  ): LevelEntity => {
    const bp = at(wx, wz);
    return createEntity('door', nameLabel, bp.x, bp.y, {
      doorConfig: dc,
      ...opts,
    });
  };

  const entities: LevelEntity[] = [];

  // Courtyard stone flagstone & cobble floor grid (x: -4..4, z: -4..4, 2m tiles)
  for (let gx = -4; gx <= 4; gx += 2) {
    for (let gz = -4; gz <= 4; gz += 2) {
      // Leave pit gap under trapdoor tile at (2, 2)
      if (gx === 2 && gz === 2) continue;
      const isCenterCross = gx === 0 || gz === 0;
      const worn = (gx + gz) % 4 === 0;
      entities.push(
        block(
          isCenterCross ? 'Flagstone Floor' : 'Cobble Floor',
          gx,
          gz,
          { shape: 'floorTile', material: isCenterCross ? 'squareFlagstone' : 'randomCobble' },
          worn ? { materialVariant: { wearFactor: 0.36, weathering: 'moss', weatheringIntensity: 0.45 } } : {}
        )
      );
    }
  }

  // Interactive floor trapdoor at (2, 2)
  entities.push(
    block('Cellar Trapdoor', 2, 2, { shape: 'trapdoor', material: 'timberPlank' }, {
      materialVariant: { wearFactor: 0.28, weathering: 'muddy', weatheringIntensity: 0.4 },
    })
  );

  // North chamber wall along z = -6 with central archway + barred/shuttered windows
  entities.push(
    block('North Wall NW', -6, -6, { shape: 'wallCube', material: 'hewnStone' }, {
      materialVariant: { wearFactor: 0.48, weathering: 'moss', weatheringIntensity: 0.55 },
    }),
    block('Shuttered Window', -4, -6, { shape: 'windowWall', material: 'hewnStone', windowStyle: 'shuttered' }),
    block('North Wall W', -2, -6, { shape: 'wallCube', material: 'hewnStone' }, {
      materialVariant: { wearFactor: 0.24, weathering: 'cracked', weatheringIntensity: 0.5 },
    }),
    block('Main Vault Archway', 0, -6, { shape: 'archway', material: 'hewnStone', archStyle: 'arched' }),
    block('North Wall E', 2, -6, { shape: 'wallCube', material: 'hewnStone' }),
    block('Barred Window', 4, -6, { shape: 'windowWall', material: 'hewnStone', windowStyle: 'barred' }),
    block('North Wall NE', 6, -6, { shape: 'wallCube', material: 'hewnStone' }, {
      materialVariant: { wearFactor: 0.42, weathering: 'moss', weatheringIntensity: 0.5 },
    })
  );

  // Inner vault chamber behind North wall (z = -8..-12)
  for (let gx = -2; gx <= 2; gx += 2) {
    for (let gz = -12; gz <= -8; gz += 2) {
      entities.push(
        block('Vault Floor', gx, gz, { shape: 'floorTile', material: 'crackedSlate' })
      );
    }
  }
  entities.push(
    modDoor(
      'Double Vault Door',
      0,
      -8,
      {
        frameShape: 'rectangular',
        leafStyle: 'woodPlank',
        openMode: 'doubleSplit',
        slotStyle: 'peepSlot',
        frameMaterial: 'masonryBrick',
        requiresKey: true,
      },
      { materialVariant: { wearFactor: 0.2, weathering: 'muddy', weatheringIntensity: 0.35 } }
    ),
    block('Vault Wall W', -2, -8, { shape: 'wallCube', material: 'masonryBrick' }),
    block('Vault Wall E', 2, -8, { shape: 'wallCube', material: 'masonryBrick' }),
    block('Vault Back W', -2, -12, { shape: 'wallCube', material: 'hewnStone' }),
    block('Vault Back C', 0, -12, { shape: 'wallCube', material: 'hewnStone' }),
    block('Vault Back E', 2, -12, { shape: 'wallCube', material: 'hewnStone' })
  );

  // West cell alcove (x = -6..-8) guarded by a sliding iron-bar portcullis
  entities.push(
    block('Cell Wall N', -6, -4, { shape: 'wallCube', material: 'hewnStone' }),
    modDoor(
      'Iron Cell Portcullis',
      -6,
      -2,
      {
        frameShape: 'arched',
        leafStyle: 'ironBars',
        openMode: 'sliding',
        slotStyle: 'none',
        frameMaterial: 'hewnStone',
        requiresKey: false,
      },
      { rotation: 90 }
    ),
    block('Cell Wall S', -6, 0, { shape: 'wallCube', material: 'hewnStone' }),
    block('Cell Floor N', -8, -4, { shape: 'floorTile', material: 'packedDirt' }),
    block('Cell Floor C', -8, -2, { shape: 'floorTile', material: 'packedDirt' }),
    block('Cell Floor S', -8, 0, { shape: 'floorTile', material: 'packedDirt' }),
    block('Cell Back N', -10, -4, { shape: 'wallCube', material: 'hewnStone' }),
    block('Cell Back C', -10, -2, { shape: 'windowWall', material: 'hewnStone', windowStyle: 'barred' }, { rotation: 90 }),
    block('Cell Back S', -10, 0, { shape: 'wallCube', material: 'hewnStone' })
  );

  // East wall & 2m upper mezzanine staircase (climb straight stairs at (4, 2) onto (+4, 0) & (+4, -2))
  entities.push(
    block('Stone Straight Stairs', 4, 2, { shape: 'stairsStraight', material: 'hewnStone' }),
    block('Mezzanine Floor S', 4, 0, { shape: 'floorTile', material: 'timberPlank' }, { elevationY: 2 }),
    block('Mezzanine Floor N', 4, -2, { shape: 'floorTile', material: 'timberPlank' }, { elevationY: 2 }),
    block('Mezzanine Wall E', 6, 0, { shape: 'wallCube', material: 'hewnStone' }),
    block('Mezzanine Wall NE', 6, -2, { shape: 'wallCube', material: 'hewnStone' }),
    block('Mezzanine Parapet W', 2, -2, { shape: 'halfWall', material: 'hewnStone' }, { elevationY: 2, rotation: 90 }),

    // West spiral stairs climbing up to a lookout pillar platform
    block('Dungeon Spiral Stairs', -4, 2, { shape: 'stairsSpiral', material: 'hewnStone' }),
    block('Watchtower Platform', -4, 0, { shape: 'floorTile', material: 'timberPlank' }, { elevationY: 2 }),

    // Pillars framing the courtyard
    block('Courtyard Pillar NW', -2, -2, { shape: 'pillar', material: 'hewnStone' }),
    block('Courtyard Pillar NE', 2, -2, { shape: 'pillar', material: 'hewnStone' }),

    // Mounted wall torches lighting the courtyard & vault
    block('Arch Torch W', -2, -5, { shape: 'wallTorch', material: 'rustedIron' }),
    block('Arch Torch E', 2, -5, { shape: 'wallTorch', material: 'rustedIron' }),
    block('Vault Torch', 0, -11, { shape: 'wallTorch', material: 'rustedIron' }),
    block('Mezzanine Torch', 5, -2, { shape: 'wallTorch', material: 'rustedIron' }, { elevationY: 2, rotation: -90 })
  );

  // Interactive game objects: Key in the West cell, chest on mezzanine, patrolling Skeleton
  const cellKeyPt = at(-8, -2);
  const mezzChestPt = at(4, -2);
  const skelPt = at(0, -2);
  entities.push(
    createEntity('key', 'Vault Key', cellKeyPt.x, cellKeyPt.y),
    createEntity('treasure', 'Upper Gallery Chest', mezzChestPt.x, mezzChestPt.y, {
      elevationY: 2.24,
      cards: [makeCard('playerTouches', ['giveTreasure', 'playSound', 'destroySelf'], '5 coins')],
    }),
    createEntity('baddie', 'Crypt Skeleton', skelPt.x, skelPt.y, {
      health: 3,
      speed: 2.6,
      brain: 'Patroller',
      cards: [makeCard('seesPlayer', ['chase', 'say'], 'None shall pass!')],
    })
  );

  crypt.entities = entities;
  crypt.startPoint = at(0, 4);
  crypt.portalPoint = at(0, -10);
  crypt.objectives = [
    { id: uid(), text: 'Open the West Iron Cell Gate (Press E) & grab the Vault Key', isOptional: false },
    { id: uid(), text: 'Climb the stone or spiral stairs to the 2m upper mezzanine', isOptional: true },
    { id: uid(), text: 'Unlock the Double Vault Door & reach the exit portal', isOptional: false },
  ];

  return {
    id: uid(),
    name,
    tagline: 'Build & explore multi-level snap-grid dungeons with animated gates, stairs & weathering.',
    symbol: 'cube.fill',
    colorHex: '#F59E0B',
    updatedAt: new Date().toISOString(),
    levels: [crypt],
    heroName: 'Warden',
    heroBody: 'Knight',
    heroColors: { tunic: '#6366F1', cloak: '#F59E0B', hair: '#3B2820', skin: '#F4C7A1' },
    enabledActions: [...StarterActions],
    hud: defaultHUDProfile(),
    currencies: ['Coins', 'Gems', 'Keys'],
    coverTagline: '2m Snap Grid · Multi-style Doors · Stairs & Mezzanine · Wear & Moss.',
    difficulty: 'Easy',
    published: false,
  };
}

export function projectFromTemplate(name: string, template: GameTemplate): GameProject {
  const cleanName = name.trim() || template.name;
  switch (template.id) {
    case 'rpg':
      return buildRpgProject(cleanName);
    case 'floatingIsland':
      return buildFloatingIslandProject(cleanName);
    case 'buddies':
      return buildBuddiesProject(cleanName);
    case 'driving':
      return buildDrivingProject(cleanName);
    case 'roguelike':
      return buildRoguelikeProject(cleanName);
    case 'dungeonBuilder':
      return buildDungeonBuilderProject(cleanName);
    case 'adventure':
      return buildCastleProject(cleanName);
    case 'platformer':
      return buildThemedProject(
        cleanName,
        'island',
        'sunny',
        ['Sunny Cliffs', 'Sky Bridges'],
        'Crab',
        'Skipper',
        'figure.run',
        '#22B573',
        'Side-scrolling cliffs, bridges, and multi-layer 3D skies.',
        'Explorer',
        'sideScroller'
      );
    case 'quest':
      return buildThemedProject(
        cleanName,
        'meadow',
        'golden',
        ['Oak Village', 'Whispering Woods'],
        'Bandit',
        'Mayor Elm',
        'bubble.left.fill',
        '#FF9F1C',
        'Help the village find the lost lantern.',
        'Adventurer',
        'openWorld'
      );
    case 'dungeon':
      return buildThemedProject(
        cleanName,
        'cave',
        'cave',
        ['Outer Gate', 'Deep Vault'],
        'Skeleton',
        'Scholar',
        'flame.fill',
        '#9B5DE5',
        'Damp stone chambers, mossy caves & torchlit fights.',
        'Knight',
        'dungeon'
      );
    case 'scifi':
      return buildThemedProject(
        cleanName,
        'night',
        'night',
        ['Crater Base', 'Orbital Core'],
        'Drone',
        'Pilot Vega',
        'sparkles',
        '#3AA0FF',
        'Fix the base and get home.',
        'Robot',
        'scifi'
      );
    case 'dojo':
      return buildThemedProject(
        cleanName,
        'forest',
        'golden',
        ['The Courtyard', 'The Bell Tower'],
        'Ninja',
        'Master',
        'shield.fill',
        '#F2545B',
        'Sneak in and ring the bell.',
        'Ninja',
        'castle'
      );
    default: {
      const level = createBlankLevel('Level 1', 'meadow', 'openWorld');
      return {
        id: uid(),
        name: cleanName,
        tagline: 'Your very own world.',
        symbol: template.symbol,
        colorHex: template.colorHex,
        updatedAt: new Date().toISOString(),
        levels: [level],
        heroName: 'Pip',
        heroBody: 'Adventurer',
        heroColors: { tunic: '#6C4CF1', cloak: '#F2545B', hair: '#5A3825', skin: '#F4C7A1' },
        enabledActions: [...StarterActions],
        hud: defaultHUDProfile(),
        currencies: ['Coins', 'Gems', 'Keys'],
        coverTagline: 'A brand new adventure.',
        difficulty: 'Easy',
        published: false,
      };
    }
  }
}

export function starterProjects(): GameProject[] {
  return [
    buildCastleProject('Castle Adventure'),
    buildThemedProject(
      'Island Explorer',
      'forest',
      'golden',
      ['Pinewood Trail', 'Hidden Cave'],
      'Crab',
      'Skipper',
      'sun.max.fill',
      '#22B573',
      'Explore a warm twilight-lit forest island and uncover hidden grottos.',
      'Explorer',
      'openWorld'
    ),
  ];
}
