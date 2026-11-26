import {
  computePivotPresetForPart,
  getDefaultMechanismsForTemplate,
  type ObjectPartNode,
  type PivotSnapPreset,
} from '../three/mechanismController';
import type {
  BuiltinMechanismTemplate,
  EntityKind,
  MechanismAxis,
  MechanismKind,
  MechanismPlaybackMode,
  MechanismTriggerRule,
  MotionEasing,
  ObjectMechanism,
} from '../types/maker';
import { uid } from '../utils/terrain';

export type PresetCategory = 'doors' | 'chests' | 'switches' | 'traps' | 'contraptions' | 'saved';

export interface MechanismPresetDef {
  id: string;
  name: string;
  category: PresetCategory;
  summary: string;
  kind: MechanismKind;
  axis: MechanismAxis;
  pivotSnap: PivotSnapPreset;
  restAngleDeg: number;
  openAngleDeg: number;
  restOffset: number;
  openOffset: number;
  duration: number;
  easing: MotionEasing;
  playbackMode: MechanismPlaybackMode;
  autoReturnDelay?: number;
  spinSpeedDegPerSec?: number;
  swingAmplitudeDeg?: number;
  swingFrequencyHz?: number;
  bounceVelocity?: number;
  transportTarget?: { x: number; y: number };
  isHazard?: boolean;
  triggers: Omit<MechanismTriggerRule, 'id'>[];
  isCustom?: boolean;
}

export interface PuzzleChainPresetDef {
  id: string;
  name: string;
  summary: string;
  flagName: string;
  items: {
    name: string;
    entityKind: EntityKind;
    mechTemplate: BuiltinMechanismTemplate;
    mechanismsFactory: () => ObjectMechanism[];
  }[];
}

export const BUILTIN_MECHANISM_PRESETS: MechanismPresetDef[] = [
  {
    id: 'preset_treasure_lid',
    name: 'Treasure Chest Lid',
    category: 'chests',
    summary: 'Back-edge hinge that swings open once on Interact and awards coins.',
    kind: 'hinge',
    axis: 'x',
    pivotSnap: 'backEdge',
    restAngleDeg: 0,
    openAngleDeg: -105,
    restOffset: 0,
    openOffset: 0,
    duration: 0.78,
    easing: 'smooth',
    playbackMode: 'once',
    triggers: [
      {
        event: 'playerUses',
        radius: 2.5,
        condition: 'none',
        action: 'open',
        rewardCoins: 50,
        message: 'Found 50 gold coins!',
        sound: 'coin',
      },
    ],
  },
  {
    id: 'preset_locked_chest',
    name: 'Key-Locked Vault Lid',
    category: 'chests',
    summary: 'Requires and consumes a Key to open, awarding a high-value hoard.',
    kind: 'hinge',
    axis: 'x',
    pivotSnap: 'backEdge',
    restAngleDeg: 0,
    openAngleDeg: -110,
    restOffset: 0,
    openOffset: 0,
    duration: 0.85,
    easing: 'easeOut',
    playbackMode: 'once',
    triggers: [
      {
        event: 'playerUses',
        radius: 2.4,
        condition: 'hasKey',
        consumeRequired: true,
        lockedMessage: 'Locked — find a Key first!',
        action: 'open',
        rewardCoins: 100,
        message: 'Unlocked the treasure vault! +100 coins',
        sound: 'sparkle',
      },
    ],
  },
  {
    id: 'preset_swing_door',
    name: 'Swinging Hinged Door',
    category: 'doors',
    summary: 'Left-edge Y hinge that toggles open and closed when the player uses it.',
    kind: 'hinge',
    axis: 'y',
    pivotSnap: 'leftEdge',
    restAngleDeg: 0,
    openAngleDeg: 95,
    restOffset: 0,
    openOffset: 0,
    duration: 0.85,
    easing: 'smooth',
    playbackMode: 'toggle',
    triggers: [
      {
        event: 'playerUses',
        radius: 2.6,
        condition: 'none',
        action: 'toggle',
        sound: 'door',
      },
    ],
  },
  {
    id: 'preset_auto_sliding_door',
    name: 'Proximity Sliding Door',
    category: 'doors',
    summary: 'Slides smoothly sideways when the player approaches and auto-closes.',
    kind: 'slider',
    axis: 'x',
    pivotSnap: 'partCenter',
    restAngleDeg: 0,
    openAngleDeg: 0,
    restOffset: 0,
    openOffset: 1.35,
    duration: 0.9,
    easing: 'easeOut',
    playbackMode: 'autoReturn',
    autoReturnDelay: 2.8,
    triggers: [
      {
        event: 'playerNear',
        radius: 3.4,
        condition: 'none',
        action: 'open',
        sound: 'door',
      },
    ],
  },
  {
    id: 'preset_rising_portcullis',
    name: 'Flag-Driven Rising Gate',
    category: 'doors',
    summary: 'Heavy vertical slider that lifts upward when flag "gate_open" activates.',
    kind: 'slider',
    axis: 'y',
    pivotSnap: 'partCenter',
    restAngleDeg: 0,
    openAngleDeg: 0,
    restOffset: 0,
    openOffset: 2.1,
    duration: 1.35,
    easing: 'smooth',
    playbackMode: 'once',
    triggers: [
      {
        event: 'flagSet',
        eventFlag: 'gate_open',
        radius: 3.0,
        condition: 'none',
        action: 'open',
        message: 'A heavy stone gate rumbles open!',
        sound: 'door',
      },
    ],
  },
  {
    id: 'preset_arena_victory_gate',
    name: 'Baddies-Cleared Exit Gate',
    category: 'doors',
    summary: 'Slides open automatically once all enemies in the level are defeated.',
    kind: 'slider',
    axis: 'y',
    pivotSnap: 'partCenter',
    restAngleDeg: 0,
    openAngleDeg: 0,
    restOffset: 0,
    openOffset: 2.3,
    duration: 1.4,
    easing: 'easeOut',
    playbackMode: 'once',
    triggers: [
      {
        event: 'playerNear',
        radius: 4.5,
        condition: 'baddiesGone',
        lockedMessage: 'Defeat all baddies to unlock this gate!',
        action: 'open',
        message: 'Victory! The exit gate opens.',
        sound: 'sparkle',
      },
    ],
  },
  {
    id: 'preset_sliding_window',
    name: 'Sliding Window Sash',
    category: 'doors',
    summary: 'Vertical sliding panel that toggles open/closed on Interact.',
    kind: 'slider',
    axis: 'y',
    pivotSnap: 'partCenter',
    restAngleDeg: 0,
    openAngleDeg: 0,
    restOffset: 0,
    openOffset: 0.85,
    duration: 0.55,
    easing: 'easeOut',
    playbackMode: 'toggle',
    triggers: [
      {
        event: 'playerUses',
        radius: 2.3,
        condition: 'none',
        action: 'toggle',
        sound: 'door',
      },
    ],
  },
  {
    id: 'preset_puzzle_lever',
    name: 'Puzzle Lever Switch',
    category: 'switches',
    summary: 'Pivots forward with elastic spring feel and broadcasts flag "gate_open".',
    kind: 'hinge',
    axis: 'x',
    pivotSnap: 'bottomCenter',
    restAngleDeg: -26,
    openAngleDeg: 32,
    restOffset: 0,
    openOffset: 0,
    duration: 0.45,
    easing: 'elastic',
    playbackMode: 'toggle',
    triggers: [
      {
        event: 'playerUses',
        radius: 2.3,
        condition: 'none',
        action: 'toggle',
        setFlagOnOpen: 'gate_open',
        clearFlagOnClose: true,
        message: 'Lever pulled!',
        sound: 'chime',
      },
    ],
  },
  {
    id: 'preset_pressure_plate',
    name: 'Floor Pressure Plate',
    category: 'switches',
    summary: 'Sinks on touch, broadcasts "plate_pressed", then springs back up.',
    kind: 'slider',
    axis: 'y',
    pivotSnap: 'partCenter',
    restAngleDeg: 0,
    openAngleDeg: 0,
    restOffset: 0,
    openOffset: -0.14,
    duration: 0.22,
    easing: 'easeOut',
    playbackMode: 'autoReturn',
    autoReturnDelay: 3.0,
    triggers: [
      {
        event: 'playerTouches',
        radius: 1.6,
        condition: 'none',
        action: 'open',
        setFlagOnOpen: 'plate_pressed',
        clearFlagOnClose: true,
        message: 'Pressure plate depressed!',
        sound: 'chime',
      },
    ],
  },
  {
    id: 'preset_push_button',
    name: 'Wall Push Button',
    category: 'switches',
    summary: 'Slides inward on Use, emits flag "button_pressed", and auto-resets.',
    kind: 'slider',
    axis: 'z',
    pivotSnap: 'partCenter',
    restAngleDeg: 0,
    openAngleDeg: 0,
    restOffset: 0,
    openOffset: -0.16,
    duration: 0.2,
    easing: 'elastic',
    playbackMode: 'autoReturn',
    autoReturnDelay: 1.4,
    triggers: [
      {
        event: 'playerUses',
        radius: 2.2,
        condition: 'none',
        action: 'open',
        setFlagOnOpen: 'button_pressed',
        message: 'Button clicked!',
        sound: 'chime',
      },
    ],
  },
  {
    id: 'preset_trapdoor_drop',
    name: 'Spring Trapdoor',
    category: 'traps',
    summary: 'Swings downward suddenly when stepped on, then resets after 2.5s.',
    kind: 'hinge',
    axis: 'x',
    pivotSnap: 'backEdge',
    restAngleDeg: 0,
    openAngleDeg: 92,
    restOffset: 0,
    openOffset: 0,
    duration: 0.35,
    easing: 'elastic',
    playbackMode: 'autoReturn',
    autoReturnDelay: 2.5,
    triggers: [
      {
        event: 'playerTouches',
        radius: 1.8,
        condition: 'none',
        action: 'open',
        message: 'Trapdoor sprung!',
        sound: 'door',
      },
    ],
  },
  {
    id: 'preset_drawbridge_lower',
    name: 'Heavy Castle Drawbridge',
    category: 'traps',
    summary: 'Bottom-edge hinge that lowers smoothly on flag "bridge_lowered" or Use.',
    kind: 'hinge',
    axis: 'x',
    pivotSnap: 'bottomCenter',
    restAngleDeg: 0,
    openAngleDeg: 88,
    restOffset: 0,
    openOffset: 0,
    duration: 1.65,
    easing: 'smooth',
    playbackMode: 'once',
    triggers: [
      {
        event: 'flagSet',
        eventFlag: 'bridge_lowered',
        radius: 3.5,
        condition: 'none',
        action: 'open',
        message: 'The drawbridge lowers across the chasm!',
        sound: 'door',
      },
      {
        event: 'playerUses',
        radius: 3.0,
        condition: 'none',
        action: 'toggle',
        sound: 'door',
      },
    ],
  },
  {
    id: 'preset_giant_spring',
    name: 'Giant Launch Spring',
    category: 'contraptions',
    summary: 'Squashes & stretches upward on touch, launching the hero high into upper tiers.',
    kind: 'springBounce',
    axis: 'y',
    pivotSnap: 'bottomCenter',
    restAngleDeg: 0,
    openAngleDeg: 0,
    restOffset: 0,
    openOffset: 0.85,
    duration: 0.28,
    easing: 'elastic',
    playbackMode: 'autoReturn',
    autoReturnDelay: 0.35,
    bounceVelocity: 19.0,
    triggers: [
      {
        event: 'playerTouches',
        radius: 1.5,
        condition: 'none',
        action: 'open',
        message: 'BOING! High launch!',
        sound: 'jump',
      },
    ],
  },
  {
    id: 'preset_spinning_saw',
    name: 'Continuous Spinning Rotor',
    category: 'contraptions',
    summary: 'Continuously rotates around its axis (ideal for saw blades, millwheels, propellers).',
    kind: 'spinner',
    axis: 'z',
    pivotSnap: 'partCenter',
    restAngleDeg: 0,
    openAngleDeg: 360,
    restOffset: 0,
    openOffset: 0,
    duration: 1.0,
    easing: 'linear',
    playbackMode: 'toggle',
    spinSpeedDegPerSec: 165,
    isHazard: true,
    triggers: [],
  },
  {
    id: 'preset_pendulum_vine',
    name: 'Swinging Pendulum',
    category: 'contraptions',
    summary: 'Swings back and forth rhythmically from its top pivot (wrecking balls, axes, vines).',
    kind: 'pendulum',
    axis: 'z',
    pivotSnap: 'topCenter',
    restAngleDeg: 0,
    openAngleDeg: 48,
    restOffset: 0,
    openOffset: 0,
    duration: 1.0,
    easing: 'smooth',
    playbackMode: 'toggle',
    swingAmplitudeDeg: 50,
    swingFrequencyHz: 0.65,
    isHazard: true,
    triggers: [],
  },
  {
    id: 'preset_warp_cannon',
    name: 'Transporter / Warp Pad',
    category: 'contraptions',
    summary: 'Teleports or blasts the player to another spot or secret room on Interact or Touch.',
    kind: 'transporter',
    axis: 'y',
    pivotSnap: 'partCenter',
    restAngleDeg: 0,
    openAngleDeg: 0,
    restOffset: 0,
    openOffset: 0.3,
    duration: 0.45,
    easing: 'elastic',
    playbackMode: 'autoReturn',
    autoReturnDelay: 0.5,
    transportTarget: { x: 0.72, y: 0.5 },
    triggers: [
      {
        event: 'playerUses',
        radius: 2.1,
        condition: 'none',
        action: 'open',
        message: 'Warped through transporter!',
        sound: 'sparkle',
      },
    ],
  },
];

export const PUZZLE_CHAIN_PRESETS: PuzzleChainPresetDef[] = [
  {
    id: 'chain_lever_temple_door',
    name: 'Lever → Sliding Temple Door',
    summary: 'Spawns a Floor Lever wired via flag "temple_door_open" to a dual-panel Sliding Door.',
    flagName: 'temple_door_open',
    items: [
      {
        name: 'Temple Switch Lever',
        entityKind: 'puzzle',
        mechTemplate: 'leverSwitch',
        mechanismsFactory: () => {
          const mechs = getDefaultMechanismsForTemplate('leverSwitch');
          if (mechs[0]?.triggers[0]) {
            mechs[0].triggers[0].setFlagOnOpen = 'temple_door_open';
            mechs[0].triggers[0].clearFlagOnClose = false;
            mechs[0].triggers[0].message = 'Lever pulled — Temple Door unlocked!';
          }
          return mechs;
        },
      },
      {
        name: 'Linked Temple Door',
        entityKind: 'door',
        mechTemplate: 'slidingDoor',
        mechanismsFactory: () => {
          const mechs = getDefaultMechanismsForTemplate('slidingDoor');
          for (const m of mechs) {
            m.triggers = [
              {
                id: uid(),
                event: 'flagSet',
                eventFlag: 'temple_door_open',
                radius: 3.2,
                condition: 'none',
                action: 'open',
                message: 'The Temple Door slides open!',
                sound: 'door',
              },
            ];
          }
          return mechs;
        },
      },
    ],
  },
  {
    id: 'chain_lever_drawbridge',
    name: 'Lever → Castle Drawbridge',
    summary: 'Spawns a Switch Lever wired via flag "drawbridge_down" to lower a Castle Drawbridge.',
    flagName: 'drawbridge_down',
    items: [
      {
        name: 'Bridge Winch Lever',
        entityKind: 'puzzle',
        mechTemplate: 'leverSwitch',
        mechanismsFactory: () => {
          const mechs = getDefaultMechanismsForTemplate('leverSwitch');
          if (mechs[0]?.triggers[0]) {
            mechs[0].triggers[0].setFlagOnOpen = 'drawbridge_down';
            mechs[0].triggers[0].clearFlagOnClose = false;
            mechs[0].triggers[0].message = 'Winch engaged — lowering drawbridge!';
          }
          return mechs;
        },
      },
      {
        name: 'Linked Drawbridge',
        entityKind: 'door',
        mechTemplate: 'drawbridge',
        mechanismsFactory: () => {
          const mechs = getDefaultMechanismsForTemplate('drawbridge');
          if (mechs[0]) {
            mechs[0].triggers = [
              {
                id: uid(),
                event: 'flagSet',
                eventFlag: 'drawbridge_down',
                radius: 3.5,
                condition: 'none',
                action: 'open',
                message: 'The Castle Drawbridge lowers!',
                sound: 'door',
              },
            ];
          }
          return mechs;
        },
      },
    ],
  },
  {
    id: 'chain_locked_chest_vault',
    name: 'Key-Locked Vault Chest',
    summary: 'Spawns a Treasure Chest requiring a Key to swing open its lid for +100 gold.',
    flagName: 'vault_opened',
    items: [
      {
        name: 'Locked Royal Chest',
        entityKind: 'treasure',
        mechTemplate: 'treasureChest',
        mechanismsFactory: () => {
          const mechs = getDefaultMechanismsForTemplate('treasureChest');
          if (mechs[0]) {
            mechs[0].triggers = [
              {
                id: uid(),
                event: 'playerUses',
                radius: 2.5,
                condition: 'hasKey',
                consumeRequired: true,
                lockedMessage: 'This Royal Chest needs a Key!',
                action: 'open',
                setFlagOnOpen: 'vault_opened',
                rewardCoins: 100,
                message: 'Royal Chest unlocked! +100 coins',
                sound: 'sparkle',
              },
            ];
          }
          return mechs;
        },
      },
    ],
  },
];

export function instantiatePresetForPart(
  preset: MechanismPresetDef,
  part: ObjectPartNode
): ObjectMechanism {
  const pivot = computePivotPresetForPart(part, preset.pivotSnap);
  return {
    id: uid(),
    name: `${part.label} · ${preset.name}`,
    targetNodePath: part.path,
    targetLabel: part.label,
    kind: preset.kind,
    axis: preset.axis,
    pivot,
    restAngleDeg: preset.restAngleDeg,
    openAngleDeg: preset.openAngleDeg,
    restOffset: preset.restOffset,
    openOffset: preset.openOffset,
    duration: preset.duration,
    easing: preset.easing,
    playbackMode: preset.playbackMode,
    autoReturnDelay: preset.autoReturnDelay,
    spinSpeedDegPerSec: preset.spinSpeedDegPerSec,
    swingAmplitudeDeg: preset.swingAmplitudeDeg,
    swingFrequencyHz: preset.swingFrequencyHz,
    bounceVelocity: preset.bounceVelocity,
    transportTarget: preset.transportTarget,
    isHazard: preset.isHazard,
    triggers: preset.triggers.map((t) => ({ ...t, id: uid() })),
  };
}

const CUSTOM_PRESETS_STORAGE_KEY = 'maker_interaction_custom_presets_v1';

const VALID_MECH_KINDS: MechanismKind[] = [
  'hinge',
  'slider',
  'spinner',
  'pendulum',
  'springBounce',
  'transporter',
];

export function loadSavedMechanismPresets(): MechanismPresetDef[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PRESETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p) =>
        p &&
        typeof p.id === 'string' &&
        typeof p.name === 'string' &&
        VALID_MECH_KINDS.includes(p.kind)
    );
  } catch {
    return [];
  }
}

export function saveCustomMechanismPresets(presets: MechanismPresetDef[]): void {
  try {
    localStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // Ignore storage quota errors
  }
}

export function createPresetFromMechanism(
  mech: ObjectMechanism,
  customName: string
): MechanismPresetDef {
  const kindLabel =
    mech.kind === 'hinge'
      ? `Hinge ${mech.axis.toUpperCase()} (${mech.openAngleDeg}°)`
      : mech.kind === 'spinner'
      ? `Spinner ${mech.axis.toUpperCase()} (${mech.spinSpeedDegPerSec ?? 140}°/s)`
      : mech.kind === 'pendulum'
      ? `Pendulum ${mech.axis.toUpperCase()} (±${mech.swingAmplitudeDeg ?? 46}°)`
      : mech.kind === 'springBounce'
      ? `Spring Bounce (${mech.bounceVelocity ?? 18.5}m/s)`
      : mech.kind === 'transporter'
      ? `Transporter Warp`
      : `Slider ${mech.axis.toUpperCase()} (${mech.openOffset}m)`;
  return {
    id: `custom_${uid()}`,
    name: customName.trim() || mech.name,
    category: 'saved',
    summary: `${kindLabel} · ${mech.triggers.length} trigger${mech.triggers.length === 1 ? '' : 's'}`,
    kind: mech.kind,
    axis: mech.axis,
    pivotSnap:
      mech.kind === 'hinge'
        ? 'backEdge'
        : mech.kind === 'pendulum'
        ? 'topCenter'
        : 'partCenter',
    restAngleDeg: mech.restAngleDeg,
    openAngleDeg: mech.openAngleDeg,
    restOffset: mech.restOffset,
    openOffset: mech.openOffset,
    duration: mech.duration,
    easing: mech.easing,
    playbackMode: mech.playbackMode,
    autoReturnDelay: mech.autoReturnDelay,
    spinSpeedDegPerSec: mech.spinSpeedDegPerSec,
    swingAmplitudeDeg: mech.swingAmplitudeDeg,
    swingFrequencyHz: mech.swingFrequencyHz,
    bounceVelocity: mech.bounceVelocity,
    transportTarget: mech.transportTarget,
    isHazard: mech.isHazard,
    triggers: mech.triggers.map(({ id: _omit, ...rest }) => ({ ...rest })),
    isCustom: true,
  };
}
