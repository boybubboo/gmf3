import type {
  ChatBubbleAnim,
  ChatBubblePresetId,
  ChatBubbleShadow,
  ChatBubbleShape,
  ChatBubbleStyle,
  ChatBubbleTailStyle,
  ChatDisplaySettings,
  ChatFontId,
  ChatPanelThemeId,
  DialogueOutputMode,
  DialogueVoiceConfig,
  EntityKind,
} from '../types/maker';

export interface ChatFontOption {
  id: ChatFontId;
  label: string;
  sample: string;
  cssFamily: string;
  letterSpacing?: string;
}

export const CHAT_FONT_OPTIONS: ChatFontOption[] = [
  {
    id: 'sans',
    label: 'Modern Sans',
    sample: 'Clean & readable',
    cssFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  {
    id: 'display',
    label: 'Friendly Round',
    sample: 'Warm geometric',
    cssFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif",
  },
  {
    id: 'serif',
    label: 'Storybook Serif',
    sample: 'Classic fantasy',
    cssFamily: "'Lora', Georgia, serif",
  },
  {
    id: 'cartoon',
    label: 'Cartoon Bubbly',
    sample: 'Playful bounce',
    cssFamily: "'Fredoka', 'Outfit', sans-serif",
  },
  {
    id: 'comic',
    label: 'Comic Action',
    sample: 'Bold shout!',
    cssFamily: "'Bangers', 'Outfit', cursive",
    letterSpacing: '0.06em',
  },
  {
    id: 'handwritten',
    label: 'Handwritten',
    sample: 'Ink & journal',
    cssFamily: "'Patrick Hand', cursive",
    letterSpacing: '0.02em',
  },
  {
    id: 'pixel',
    label: 'Retro Pixel',
    sample: '8-bit RPG',
    cssFamily: "'Silkscreen', 'JetBrains Mono', monospace",
    letterSpacing: '-0.02em',
  },
  {
    id: 'mono',
    label: 'Terminal Mono',
    sample: 'Sci-fi comms',
    cssFamily: "'JetBrains Mono', ui-monospace, monospace",
  },
];

export function getChatFontOption(id: ChatFontId): ChatFontOption {
  return CHAT_FONT_OPTIONS.find((f) => f.id === id) ?? CHAT_FONT_OPTIONS[0];
}

export const CHAT_SHAPE_OPTIONS: { id: ChatBubbleShape; label: string }[] = [
  { id: 'rounded', label: 'Rounded' },
  { id: 'pill', label: 'Pill' },
  { id: 'comic', label: 'Comic' },
  { id: 'sharp', label: 'RPG Box' },
  { id: 'thought', label: 'Thought' },
  { id: 'shout', label: 'Shout' },
  { id: 'scroll', label: 'Scroll' },
];

export const CHAT_TAIL_OPTIONS: { id: ChatBubbleTailStyle; label: string }[] = [
  { id: 'pointer', label: 'Pointer' },
  { id: 'curved', label: 'Curved' },
  { id: 'dots', label: 'Thought Dots' },
  { id: 'none', label: 'None' },
];

export const CHAT_SHADOW_OPTIONS: { id: ChatBubbleShadow; label: string }[] = [
  { id: 'soft', label: 'Soft' },
  { id: 'hard', label: 'Comic Hard' },
  { id: 'glow', label: 'Glow' },
  { id: 'none', label: 'Flat' },
];

export const CHAT_ANIM_OPTIONS: { id: ChatBubbleAnim; label: string }[] = [
  { id: 'pop', label: 'Pop In' },
  { id: 'float', label: 'Pop + Float' },
  { id: 'fade', label: 'Fade Up' },
  { id: 'none', label: 'Instant' },
];

export interface ChatBubblePresetMeta {
  id: ChatBubblePresetId;
  name: string;
  blurb: string;
  style: ChatBubbleStyle;
}

export const CHAT_BUBBLE_PRESETS: ChatBubblePresetMeta[] = [
  {
    id: 'classic',
    name: 'Classic Cream',
    blurb: 'Crisp warm bubble for villagers & guides',
    style: {
      presetId: 'classic',
      shape: 'rounded',
      tailStyle: 'pointer',
      bgColor: '#FFFDF7',
      textColor: '#1E2430',
      borderColor: '#D6CCBA',
      speakerColor: '#6C4CF1',
      opacity: 0.97,
      borderWidth: 2,
      borderRadius: 16,
      shadowStyle: 'soft',
      fontFamily: 'display',
      fontSize: 13,
      fontWeight: 'semibold',
      italic: false,
      textAlign: 'left',
      showSpeakerName: true,
      typewriterEffect: true,
      typewriterSpeed: 42,
      entranceAnim: 'pop',
      maxWidth: 256,
      floatHeight: 0.35,
      autoShowOnApproach: true,
      autoShowDistance: 4.8,
    },
  },
  {
    id: 'comic',
    name: 'Comic Pop',
    blurb: 'Bold ink outline with hard offset drop shadow',
    style: {
      presetId: 'comic',
      shape: 'comic',
      tailStyle: 'curved',
      bgColor: '#FFF8D6',
      textColor: '#141720',
      borderColor: '#141720',
      speakerColor: '#E11D48',
      opacity: 1,
      borderWidth: 3,
      borderRadius: 14,
      shadowStyle: 'hard',
      fontFamily: 'cartoon',
      fontSize: 14,
      fontWeight: 'bold',
      italic: false,
      textAlign: 'center',
      showSpeakerName: true,
      typewriterEffect: true,
      typewriterSpeed: 52,
      entranceAnim: 'pop',
      maxWidth: 250,
      floatHeight: 0.4,
      autoShowOnApproach: true,
      autoShowDistance: 5.0,
    },
  },
  {
    id: 'parchment',
    name: 'Fantasy Scroll',
    blurb: 'Aged parchment, gold trim & storybook serif',
    style: {
      presetId: 'parchment',
      shape: 'scroll',
      tailStyle: 'pointer',
      bgColor: '#F6E8C8',
      textColor: '#3B2816',
      borderColor: '#9C7338',
      speakerColor: '#8B4513',
      opacity: 0.98,
      borderWidth: 2,
      borderRadius: 8,
      shadowStyle: 'soft',
      fontFamily: 'serif',
      fontSize: 13,
      fontWeight: 'normal',
      italic: false,
      textAlign: 'left',
      showSpeakerName: true,
      typewriterEffect: true,
      typewriterSpeed: 36,
      entranceAnim: 'fade',
      maxWidth: 276,
      floatHeight: 0.35,
      autoShowOnApproach: true,
      autoShowDistance: 4.6,
    },
  },
  {
    id: 'retroPixel',
    name: 'Retro RPG',
    blurb: 'Classic 8-bit navy box with pixel typography',
    style: {
      presetId: 'retroPixel',
      shape: 'sharp',
      tailStyle: 'pointer',
      bgColor: '#111B3A',
      textColor: '#F8FAFC',
      borderColor: '#E2E8F0',
      speakerColor: '#FACC15',
      opacity: 0.96,
      borderWidth: 3,
      borderRadius: 2,
      shadowStyle: 'hard',
      fontFamily: 'pixel',
      fontSize: 11,
      fontWeight: 'normal',
      italic: false,
      textAlign: 'left',
      showSpeakerName: true,
      typewriterEffect: true,
      typewriterSpeed: 34,
      entranceAnim: 'pop',
      maxWidth: 272,
      floatHeight: 0.4,
      autoShowOnApproach: false,
      autoShowDistance: 4.5,
    },
  },
  {
    id: 'thought',
    name: 'Dreamy Cloud',
    blurb: 'Soft thought cloud with floating bubble dots',
    style: {
      presetId: 'thought',
      shape: 'thought',
      tailStyle: 'dots',
      bgColor: '#F5F7FF',
      textColor: '#334155',
      borderColor: '#A5B4FC',
      speakerColor: '#6366F1',
      opacity: 0.94,
      borderWidth: 2,
      borderRadius: 24,
      shadowStyle: 'soft',
      fontFamily: 'handwritten',
      fontSize: 16,
      fontWeight: 'normal',
      italic: true,
      textAlign: 'center',
      showSpeakerName: false,
      typewriterEffect: true,
      typewriterSpeed: 36,
      entranceAnim: 'float',
      maxWidth: 244,
      floatHeight: 0.52,
      autoShowOnApproach: true,
      autoShowDistance: 5.2,
    },
  },
  {
    id: 'shout',
    name: 'Action Shout',
    blurb: 'High-impact jagged frame for bosses & rivals',
    style: {
      presetId: 'shout',
      shape: 'shout',
      tailStyle: 'pointer',
      bgColor: '#FEF08A',
      textColor: '#18181B',
      borderColor: '#DC2626',
      speakerColor: '#B91C1C',
      opacity: 1,
      borderWidth: 3,
      borderRadius: 6,
      shadowStyle: 'hard',
      fontFamily: 'comic',
      fontSize: 17,
      fontWeight: 'bold',
      italic: false,
      textAlign: 'center',
      showSpeakerName: true,
      typewriterEffect: false,
      typewriterSpeed: 70,
      entranceAnim: 'pop',
      maxWidth: 248,
      floatHeight: 0.48,
      autoShowOnApproach: false,
      autoShowDistance: 6.5,
    },
  },
  {
    id: 'sleekDark',
    name: 'Midnight Slate',
    blurb: 'Modern dark card with crisp high-contrast ink',
    style: {
      presetId: 'sleekDark',
      shape: 'rounded',
      tailStyle: 'pointer',
      bgColor: '#151923',
      textColor: '#F3F5FA',
      borderColor: '#38BDF8',
      speakerColor: '#38BDF8',
      opacity: 0.93,
      borderWidth: 1.5,
      borderRadius: 14,
      shadowStyle: 'soft',
      fontFamily: 'sans',
      fontSize: 13,
      fontWeight: 'semibold',
      italic: false,
      textAlign: 'left',
      showSpeakerName: true,
      typewriterEffect: true,
      typewriterSpeed: 46,
      entranceAnim: 'fade',
      maxWidth: 264,
      floatHeight: 0.36,
      autoShowOnApproach: true,
      autoShowDistance: 4.8,
    },
  },
  {
    id: 'neonTerminal',
    name: 'Sci-Fi Comms',
    blurb: 'Radio transmission frame with luminous glow',
    style: {
      presetId: 'neonTerminal',
      shape: 'sharp',
      tailStyle: 'none',
      bgColor: '#0A121C',
      textColor: '#A7F3D0',
      borderColor: '#10B981',
      speakerColor: '#34D399',
      opacity: 0.94,
      borderWidth: 1.5,
      borderRadius: 6,
      shadowStyle: 'glow',
      fontFamily: 'mono',
      fontSize: 12,
      fontWeight: 'semibold',
      italic: false,
      textAlign: 'left',
      showSpeakerName: true,
      typewriterEffect: true,
      typewriterSpeed: 58,
      entranceAnim: 'fade',
      maxWidth: 278,
      floatHeight: 0.45,
      autoShowOnApproach: true,
      autoShowDistance: 5.5,
    },
  },
];

export function getPresetStyle(presetId: ChatBubblePresetId): ChatBubbleStyle {
  const found = CHAT_BUBBLE_PRESETS.find((p) => p.id === presetId) ?? CHAT_BUBBLE_PRESETS[0];
  return { ...found.style };
}

export function createDefaultChatBubbleStyle(kind?: EntityKind | 'hero'): ChatBubbleStyle {
  if (kind === 'baddie') {
    return getPresetStyle('shout');
  }
  if (kind === 'sign') {
    return {
      ...getPresetStyle('parchment'),
      tailStyle: 'none',
      autoShowOnApproach: true,
      autoShowDistance: 4.0,
    };
  }
  if (kind === 'hero') {
    return {
      ...getPresetStyle('sleekDark'),
      borderColor: '#7C5CFF',
      speakerColor: '#A78BFA',
      autoShowOnApproach: false,
    };
  }
  return getPresetStyle('classic');
}

export function resolveChatBubbleStyle(
  style: Partial<ChatBubbleStyle> | undefined,
  kind?: EntityKind | 'hero'
): ChatBubbleStyle {
  const base = createDefaultChatBubbleStyle(kind);
  if (!style) return base;
  return {
    ...base,
    ...style,
  };
}

export interface ChatPanelThemeMeta {
  id: ChatPanelThemeId;
  label: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  opacity: number;
}

export const CHAT_PANEL_THEMES: ChatPanelThemeMeta[] = [
  {
    id: 'classic',
    label: 'Midnight Slate',
    bgColor: '#131722',
    borderColor: '#31394F',
    textColor: '#F3F5FA',
    opacity: 0.95,
  },
  {
    id: 'parchment',
    label: 'Storybook Parchment',
    bgColor: '#F5E7C6',
    borderColor: '#9C7338',
    textColor: '#362312',
    opacity: 0.98,
  },
  {
    id: 'retro',
    label: 'Retro RPG Box',
    bgColor: '#0E1A3C',
    borderColor: '#E2E8F0',
    textColor: '#F8FAFC',
    opacity: 0.96,
  },
  {
    id: 'light',
    label: 'Crisp Paper',
    bgColor: '#FFFFFF',
    borderColor: '#D6DBE5',
    textColor: '#151923',
    opacity: 0.97,
  },
];

export function createDefaultChatDisplaySettings(): ChatDisplaySettings {
  return {
    displayMode: 'bubbles',
    dialogueMode: 'both',
    panelTheme: 'classic',
    panelBgColor: '#131722',
    panelBorderColor: '#31394F',
    panelTextColor: '#F3F5FA',
    panelOpacity: 0.95,
    panelUseCharacterStyle: true,
    panelShowPortrait: true,
    panelShowHistory: true,
    panelPauseGame: true,
    panelCompact: false,
  };
}

export function resolveChatDisplaySettings(
  settings?: Partial<ChatDisplaySettings>
): ChatDisplaySettings {
  const base = createDefaultChatDisplaySettings();
  if (!settings) return base;
  return {
    ...base,
    ...settings,
    dialogueMode: settings.dialogueMode ?? base.dialogueMode,
  };
}

export function resolveEffectiveDialogueMode(
  settings?: Partial<ChatDisplaySettings>,
  voiceConfig?: DialogueVoiceConfig
): DialogueOutputMode {
  if (voiceConfig?.mode && voiceConfig.mode !== 'inherit') {
    return voiceConfig.mode;
  }
  return settings?.dialogueMode ?? 'both';
}

export function resolveVoiceClipForLine(
  voiceConfig: DialogueVoiceConfig | undefined,
  lineIndex: number
): string | undefined {
  if (!voiceConfig) return undefined;
  const perLine = voiceConfig.lineClipIds?.[lineIndex];
  if (perLine) return perLine;
  if (lineIndex === 0 && voiceConfig.clipId) return voiceConfig.clipId;
  return undefined;
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  if (full.length !== 6) return `rgba(20, 23, 32, ${alpha})`;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return `rgba(20, 23, 32, ${alpha})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}
