import type {
  ChatBubbleStyle,
  ChatDisplaySettings,
  ChatFontId,
  HUDWidget,
  HudBarStyle,
  HudBorderStyle,
  HudButtonStyle,
  HudJoystickStyle,
  HudSurfaceTexture,
  HudThemePresetId,
  HudWidgetShape,
} from '../types/maker';

export interface HudThemePreset {
  id: HudThemePresetId;
  name: string;
  tagline: string;
  accentHex: string;
  swatchGradient: string;
  fontFamily: ChatFontId;
  surfaceTexture: HudSurfaceTexture;
  panelShape: HudWidgetShape;
  buttonShape: HudWidgetShape;
  joystickShape: HudWidgetShape;
  buttonStyle: HudButtonStyle;
  joystickStyle: HudJoystickStyle;
  barStyle: HudBarStyle;
  bgHex: string;
  borderHex: string;
  textHex: string;
  glowHex: string;
  fillHex: string;
  knobColorHex: string;
  borderStyle: HudBorderStyle;
  borderWidth: number;
  cornerRadius: number;
  edgeWear: number;
  burnedEdges: number;
  paperTears: number;
  organicWobble: number;
  glowIntensity: number;
  shadowDepth: number;
  opacity: number;
  uppercase: boolean;
  textGlow: boolean;
  chatBubbleStyle: Partial<ChatBubbleStyle>;
  chatPanelSettings: Partial<ChatDisplaySettings>;
}

export const HUD_THEME_PRESETS: HudThemePreset[] = [
  {
    id: 'medievalParchment',
    name: 'Medieval Parchment & Wood',
    tagline: 'Distressed sepia scrolls, burned edges, carved oak controls & wax seals',
    accentHex: '#B45309',
    swatchGradient: 'linear-gradient(135deg, #EAD1A3 0%, #9E6833 55%, #4A250E 100%)',
    fontFamily: 'cinzel',
    surfaceTexture: 'parchment',
    panelShape: 'tornOrganic',
    buttonShape: 'circle',
    joystickShape: 'circle',
    buttonStyle: 'woodCarved',
    joystickStyle: 'woodenLever',
    barStyle: 'ornate',
    bgHex: '#E7CFA1',
    borderHex: '#6B3E1B',
    textHex: '#2B180A',
    glowHex: '#D97706',
    fillHex: '#A12722',
    knobColorHex: '#7A4824',
    borderStyle: 'ornate',
    borderWidth: 3,
    cornerRadius: 8,
    edgeWear: 0.55,
    burnedEdges: 0.72,
    paperTears: 0.52,
    organicWobble: 0.35,
    glowIntensity: 0.08,
    shadowDepth: 0.55,
    opacity: 0.96,
    uppercase: true,
    textGlow: false,
    chatBubbleStyle: {
      presetId: 'burnedScroll',
      shape: 'parchmentTorn',
      tailStyle: 'curved',
      bgColor: '#EBD4A7',
      textColor: '#2B180A',
      borderColor: '#6B3E1B',
      speakerColor: '#8B261D',
      opacity: 0.96,
      borderWidth: 2,
      borderRadius: 6,
      shadowStyle: 'soft',
      fontFamily: 'garamond',
      fontSize: 15,
      fontWeight: 'semibold',
      surfaceTexture: 'parchment',
      edgeWear: 0.5,
      burnedEdges: 0.75,
      paperTears: 0.55,
      depth3d: 0.25,
    },
    chatPanelSettings: {
      panelTheme: 'parchment',
      panelBgColor: '#E8D0A0',
      panelBorderColor: '#6B3E1B',
      panelTextColor: '#2B180A',
      panelOpacity: 0.96,
      panelTexture: 'parchment',
      panelShape: 'tornOrganic',
      panelEdgeWear: 0.45,
      panelBurnedEdges: 0.7,
      panelPaperTears: 0.42,
      panelFontFamily: 'cinzel',
    },
  },
  {
    id: 'sciFiHolo',
    name: 'Sci-Fi Holographic Metal',
    tagline: 'Chamfered cybernetic alloys, glowing cyan holokeys & translucent HUD',
    accentHex: '#06B6D4',
    swatchGradient: 'linear-gradient(135deg, #22D3EE 0%, #0E3A5D 55%, #06101F 100%)',
    fontFamily: 'orbitron',
    surfaceTexture: 'circuitTech',
    panelShape: 'chamfer',
    buttonShape: 'hex',
    joystickShape: 'circle',
    buttonStyle: 'sciFiHolokey',
    joystickStyle: 'sciFiHolo',
    barStyle: 'neon',
    bgHex: '#071729',
    borderHex: '#22D3EE',
    textHex: '#E0F9FF',
    glowHex: '#06B6D4',
    fillHex: '#00E5FF',
    knobColorHex: '#38BDF8',
    borderStyle: 'glowing',
    borderWidth: 2,
    cornerRadius: 4,
    edgeWear: 0,
    burnedEdges: 0,
    paperTears: 0,
    organicWobble: 0,
    glowIntensity: 0.72,
    shadowDepth: 0.45,
    opacity: 0.86,
    uppercase: true,
    textGlow: true,
    chatBubbleStyle: {
      presetId: 'holoHud',
      shape: 'sciFiHolo',
      tailStyle: 'pointer',
      bgColor: '#061A2E',
      textColor: '#CFFAFE',
      borderColor: '#22D3EE',
      speakerColor: '#38BDF8',
      opacity: 0.88,
      borderWidth: 2,
      borderRadius: 4,
      shadowStyle: 'glow',
      fontFamily: 'tactical',
      fontSize: 13,
      fontWeight: 'semibold',
      surfaceTexture: 'holoGlass',
      edgeWear: 0,
      burnedEdges: 0,
      paperTears: 0,
      depth3d: 0.2,
      glowColor: '#22D3EE',
    },
    chatPanelSettings: {
      panelTheme: 'sciFi',
      panelBgColor: '#061A2E',
      panelBorderColor: '#22D3EE',
      panelTextColor: '#E0F9FF',
      panelOpacity: 0.88,
      panelTexture: 'circuitTech',
      panelShape: 'chamfer',
      panelEdgeWear: 0,
      panelBurnedEdges: 0,
      panelPaperTears: 0,
      panelFontFamily: 'tactical',
    },
  },
  {
    id: 'arcadeCabinet',
    name: '3D Arcade Cabinet',
    tagline: 'Glossy 3D plunger dome buttons, ball-top joystick & neon pixel energy',
    accentHex: '#F43F5E',
    swatchGradient: 'linear-gradient(135deg, #FB7185 0%, #7C3AED 55%, #1E1B4B 100%)',
    fontFamily: 'arcade',
    surfaceTexture: 'arcadePlastic',
    panelShape: 'rounded',
    buttonShape: 'circle',
    joystickShape: 'circle',
    buttonStyle: 'arcadeDome',
    joystickStyle: 'arcadeBall',
    barStyle: 'segmented',
    bgHex: '#1D1233',
    borderHex: '#F472B6',
    textHex: '#FFF1F2',
    glowHex: '#F43F5E',
    fillHex: '#FB7185',
    knobColorHex: '#EF4444',
    borderStyle: 'solid',
    borderWidth: 3,
    cornerRadius: 14,
    edgeWear: 0,
    burnedEdges: 0,
    paperTears: 0,
    organicWobble: 0,
    glowIntensity: 0.5,
    shadowDepth: 0.72,
    opacity: 0.96,
    uppercase: true,
    textGlow: true,
    chatBubbleStyle: {
      presetId: 'bubble3d',
      shape: 'glass3d',
      tailStyle: 'pointer',
      bgColor: '#22143E',
      textColor: '#FEF08A',
      borderColor: '#F472B6',
      speakerColor: '#38BDF8',
      opacity: 0.96,
      borderWidth: 3,
      borderRadius: 16,
      shadowStyle: 'hard',
      fontFamily: 'pixel',
      fontSize: 12,
      fontWeight: 'bold',
      surfaceTexture: 'arcadePlastic',
      depth3d: 0.8,
      glowColor: '#F472B6',
    },
    chatPanelSettings: {
      panelTheme: 'retro',
      panelBgColor: '#1B1130',
      panelBorderColor: '#F472B6',
      panelTextColor: '#FEF08A',
      panelOpacity: 0.95,
      panelTexture: 'arcadePlastic',
      panelShape: 'rounded',
      panelFontFamily: 'pixel',
    },
  },
  {
    id: 'consoleGamepad',
    name: '3D Console Gamepad',
    tagline: 'Sculpted 3D analog thumbstick, tactile face keys & brushed aluminum HUD',
    accentHex: '#3B82F6',
    swatchGradient: 'linear-gradient(135deg, #60A5FA 0%, #334155 55%, #0F172A 100%)',
    fontFamily: 'display',
    surfaceTexture: 'brushedMetal',
    panelShape: 'rounded',
    buttonShape: 'circle',
    joystickShape: 'circle',
    buttonStyle: 'gamepad3d',
    joystickStyle: '3dThumbstick',
    barStyle: 'beveled',
    bgHex: '#1F2937',
    borderHex: '#64748B',
    textHex: '#F8FAFC',
    glowHex: '#3B82F6',
    fillHex: '#22C55E',
    knobColorHex: '#334155',
    borderStyle: 'etched',
    borderWidth: 2,
    cornerRadius: 14,
    edgeWear: 0,
    burnedEdges: 0,
    paperTears: 0,
    organicWobble: 0,
    glowIntensity: 0.22,
    shadowDepth: 0.65,
    opacity: 0.94,
    uppercase: false,
    textGlow: false,
    chatBubbleStyle: {
      presetId: 'bubble3d',
      shape: 'glass3d',
      tailStyle: 'curved',
      bgColor: '#1E293B',
      textColor: '#F8FAFC',
      borderColor: '#60A5FA',
      speakerColor: '#38BDF8',
      opacity: 0.94,
      borderWidth: 2,
      borderRadius: 18,
      shadowStyle: 'soft',
      fontFamily: 'display',
      fontSize: 13,
      fontWeight: 'semibold',
      surfaceTexture: 'smooth',
      depth3d: 0.68,
    },
    chatPanelSettings: {
      panelTheme: 'classic',
      panelBgColor: '#111827',
      panelBorderColor: '#475569',
      panelTextColor: '#F8FAFC',
      panelOpacity: 0.92,
      panelTexture: 'brushedMetal',
      panelShape: 'rounded',
      panelFontFamily: 'display',
    },
  },
  {
    id: 'comicGraphic',
    name: 'Graphic Novel & Comic',
    tagline: 'Halftone print dots, slanted action frames, bold ink outlines & comic pop keys',
    accentHex: '#F59E0B',
    swatchGradient: 'linear-gradient(135deg, #FDE047 0%, #FB923C 55%, #18181B 100%)',
    fontFamily: 'comic',
    surfaceTexture: 'comicHalftone',
    panelShape: 'slant',
    buttonShape: 'diamond',
    joystickShape: 'circle',
    buttonStyle: 'comicPop',
    joystickStyle: 'modern',
    barStyle: 'segmented',
    bgHex: '#FFFDF0',
    borderHex: '#111827',
    textHex: '#111827',
    glowHex: '#F59E0B',
    fillHex: '#EF4444',
    knobColorHex: '#FACC15',
    borderStyle: 'solid',
    borderWidth: 3,
    cornerRadius: 4,
    edgeWear: 0.14,
    burnedEdges: 0,
    paperTears: 0,
    organicWobble: 0.45,
    glowIntensity: 0,
    shadowDepth: 0.85,
    opacity: 0.98,
    uppercase: true,
    textGlow: false,
    chatBubbleStyle: {
      presetId: 'graphicNovel',
      shape: 'graphicNovel',
      tailStyle: 'pointer',
      bgColor: '#FFFDF2',
      textColor: '#111827',
      borderColor: '#111827',
      speakerColor: '#DC2626',
      opacity: 1,
      borderWidth: 3,
      borderRadius: 4,
      shadowStyle: 'hard',
      fontFamily: 'comic',
      fontSize: 15,
      fontWeight: 'bold',
      surfaceTexture: 'comicHalftone',
      rotationDeg: -1.5,
      depth3d: 0.35,
    },
    chatPanelSettings: {
      panelTheme: 'comic',
      panelBgColor: '#FFFDF0',
      panelBorderColor: '#111827',
      panelTextColor: '#111827',
      panelOpacity: 0.98,
      panelTexture: 'comicHalftone',
      panelShape: 'slant',
      panelFontFamily: 'comic',
    },
  },
  {
    id: 'ancientStone',
    name: 'Dungeon Stone & Runes',
    tagline: 'Chiseled weathered granite slabs, rune-stone dial & arcane wax seals',
    accentHex: '#A855F7',
    swatchGradient: 'linear-gradient(135deg, #9CA3AF 0%, #44403C 55%, #581C87 100%)',
    fontFamily: 'gothic',
    surfaceTexture: 'stone',
    panelShape: 'arch',
    buttonShape: 'shield',
    joystickShape: 'circle',
    buttonStyle: 'waxSeal',
    joystickStyle: 'stoneRune',
    barStyle: 'ornate',
    bgHex: '#43413D',
    borderHex: '#9C968B',
    textHex: '#F5F3EE',
    glowHex: '#A855F7',
    fillHex: '#9333EA',
    knobColorHex: '#A855F7',
    borderStyle: 'etched',
    borderWidth: 3,
    cornerRadius: 10,
    edgeWear: 0.62,
    burnedEdges: 0.22,
    paperTears: 0,
    organicWobble: 0.25,
    glowIntensity: 0.42,
    shadowDepth: 0.7,
    opacity: 0.95,
    uppercase: false,
    textGlow: true,
    chatBubbleStyle: {
      presetId: 'woodenTavern',
      shape: 'woodenPlaque',
      tailStyle: 'curved',
      bgColor: '#3E3C38',
      textColor: '#F5F3EE',
      borderColor: '#9C968B',
      speakerColor: '#C084FC',
      opacity: 0.96,
      borderWidth: 3,
      borderRadius: 10,
      shadowStyle: 'soft',
      fontFamily: 'cinzel',
      fontSize: 14,
      fontWeight: 'semibold',
      surfaceTexture: 'stone',
      edgeWear: 0.55,
      depth3d: 0.45,
    },
    chatPanelSettings: {
      panelTheme: 'classic',
      panelBgColor: '#363430',
      panelBorderColor: '#9C968B',
      panelTextColor: '#F5F3EE',
      panelOpacity: 0.95,
      panelTexture: 'stone',
      panelShape: 'arch',
      panelEdgeWear: 0.5,
      panelFontFamily: 'cinzel',
    },
  },
  {
    id: 'steampunkBrass',
    name: 'Steampunk Leather & Steel',
    tagline: 'Stitched saddle leather, machined steel joystick & brass rivets',
    accentHex: '#D97706',
    swatchGradient: 'linear-gradient(135deg, #D97706 0%, #6D3B1E 55%, #27272A 100%)',
    fontFamily: 'garamond',
    surfaceTexture: 'leather',
    panelShape: 'chamfer',
    buttonShape: 'circle',
    joystickShape: 'circle',
    buttonStyle: 'bevel3d',
    joystickStyle: 'metalMachined',
    barStyle: 'beveled',
    bgHex: '#522914',
    borderHex: '#D49A4A',
    textHex: '#FEF3D6',
    glowHex: '#F59E0B',
    fillHex: '#D97706',
    knobColorHex: '#B45309',
    borderStyle: 'dashed',
    borderWidth: 3,
    cornerRadius: 10,
    edgeWear: 0.25,
    burnedEdges: 0.35,
    paperTears: 0,
    organicWobble: 0.1,
    glowIntensity: 0.18,
    shadowDepth: 0.65,
    opacity: 0.96,
    uppercase: true,
    textGlow: false,
    chatBubbleStyle: {
      presetId: 'woodenTavern',
      shape: 'woodenPlaque',
      tailStyle: 'curved',
      bgColor: '#522914',
      textColor: '#FEF3D6',
      borderColor: '#D49A4A',
      speakerColor: '#FBBF24',
      opacity: 0.96,
      borderWidth: 3,
      borderRadius: 12,
      shadowStyle: 'soft',
      fontFamily: 'garamond',
      fontSize: 15,
      fontWeight: 'semibold',
      surfaceTexture: 'leather',
      burnedEdges: 0.3,
      depth3d: 0.5,
    },
    chatPanelSettings: {
      panelTheme: 'wood',
      panelBgColor: '#4A2411',
      panelBorderColor: '#D49A4A',
      panelTextColor: '#FEF3D6',
      panelOpacity: 0.95,
      panelTexture: 'leather',
      panelShape: 'chamfer',
      panelBurnedEdges: 0.28,
      panelFontFamily: 'garamond',
    },
  },
  {
    id: 'ghostMinimal',
    name: 'Ghost Minimalist Glass',
    tagline: 'Ultra-light ghosted opacity so your 3D world takes center stage',
    accentHex: '#94A3B8',
    swatchGradient: 'linear-gradient(135deg, rgba(255,255,255,0.45) 0%, rgba(148,163,184,0.2) 100%)',
    fontFamily: 'sans',
    surfaceTexture: 'smooth',
    panelShape: 'rounded',
    buttonShape: 'circle',
    joystickShape: 'circle',
    buttonStyle: 'flat',
    joystickStyle: 'modern',
    barStyle: 'smooth',
    bgHex: '#0F172A',
    borderHex: '#E2E8F0',
    textHex: '#FFFFFF',
    glowHex: '#FFFFFF',
    fillHex: '#38BDF8',
    knobColorHex: '#FFFFFF',
    borderStyle: 'solid',
    borderWidth: 1,
    cornerRadius: 16,
    edgeWear: 0,
    burnedEdges: 0,
    paperTears: 0,
    organicWobble: 0,
    glowIntensity: 0.1,
    shadowDepth: 0.15,
    opacity: 0.42,
    uppercase: false,
    textGlow: false,
    chatBubbleStyle: {
      presetId: 'sleekDark',
      shape: 'rounded',
      tailStyle: 'curved',
      bgColor: '#0F172A',
      textColor: '#F8FAFC',
      borderColor: '#CBD5E1',
      speakerColor: '#7DD3FC',
      opacity: 0.55,
      borderWidth: 1,
      borderRadius: 18,
      shadowStyle: 'soft',
      fontFamily: 'sans',
      fontSize: 13,
      fontWeight: 'normal',
      surfaceTexture: 'smooth',
    },
    chatPanelSettings: {
      panelTheme: 'classic',
      panelBgColor: '#0F172A',
      panelBorderColor: '#94A3B8',
      panelTextColor: '#F8FAFC',
      panelOpacity: 0.5,
      panelTexture: 'smooth',
      panelShape: 'rounded',
      panelFontFamily: 'sans',
    },
  },
];

export function getHudThemePreset(id: HudThemePresetId): HudThemePreset {
  return HUD_THEME_PRESETS.find((p) => p.id === id) ?? HUD_THEME_PRESETS[0];
}

/**
 * Applies a full cohesive theme to every widget in a HUD while preserving
 * each widget's role, binding, position, and smart semantic accents (e.g.
 * wooden buttons on a medieval parchment theme!).
 */
export function applyHudThemeToWidgets(
  widgets: HUDWidget[],
  preset: HudThemePreset
): HUDWidget[] {
  return widgets.map((w) => {
    const isAction = w.kind === 'actionButton' || w.kind === 'pauseButton';
    const isStick = w.kind === 'joystick';
    const isBar = w.kind === 'bar' || w.kind === 'bossBar';

    // Keep distinct tactile material pairings per theme (e.g., wood buttons on parchment theme)
    let surfaceTexture: HudSurfaceTexture = preset.surfaceTexture;
    let bgHex = preset.bgHex;
    let textHex = preset.textHex;
    let borderHex = preset.borderHex;
    let shape: HudWidgetShape = preset.panelShape;
    let edgeWear = preset.edgeWear;
    let burnedEdges = preset.burnedEdges;
    let paperTears = preset.paperTears;

    if (isAction) {
      shape = preset.buttonShape;
      if (preset.id === 'medievalParchment') {
        surfaceTexture = 'wood';
        bgHex = '#6B4223';
        textHex = '#FEF3D6';
        borderHex = '#C28A4B';
        burnedEdges = 0.2;
        paperTears = 0;
      } else if (preset.id === 'sciFiHolo') {
        surfaceTexture = 'brushedMetal';
        bgHex = '#0C243B';
      }
    } else if (isStick) {
      shape = preset.joystickShape;
      paperTears = 0;
      if (preset.id === 'medievalParchment') {
        surfaceTexture = 'wood';
        bgHex = '#593419';
        borderHex = '#B87E41';
        burnedEdges = 0.18;
      }
    }

    // Preserve distinct button fill tints for readability across multiple buttons while aligning theme
    let fillHex = w.fillHex;
    if (isBar && w.binding === 'health') fillHex = preset.fillHex;
    else if (isAction && preset.id === 'medievalParchment') {
      fillHex = w.actionId === 'attack' ? '#8B261D' : w.actionId === 'jump' ? '#7B4A23' : '#5F4327';
    } else if (isAction && preset.id === 'sciFiHolo') {
      fillHex = w.actionId === 'attack' ? '#EC4899' : w.actionId === 'jump' ? '#06B6D4' : '#3B82F6';
    } else if (isAction && preset.id === 'arcadeCabinet') {
      fillHex = w.actionId === 'attack' ? '#EF4444' : w.actionId === 'jump' ? '#3B82F6' : '#F59E0B';
    } else if (isAction && preset.id === 'comicGraphic') {
      fillHex = w.actionId === 'attack' ? '#EF4444' : w.actionId === 'jump' ? '#FACC15' : '#38BDF8';
    } else if (isAction && preset.id === 'ancientStone') {
      fillHex = w.actionId === 'attack' ? '#991B1B' : w.actionId === 'jump' ? '#6D28D9' : '#4B5563';
    }

    return {
      ...w,
      shape,
      surfaceTexture,
      bgHex,
      borderHex,
      textHex,
      glowHex: preset.glowHex,
      fillHex,
      knobColorHex: preset.knobColorHex,
      borderStyle: preset.borderStyle,
      borderWidth: preset.borderWidth,
      cornerRadius: preset.cornerRadius,
      edgeWear,
      burnedEdges,
      paperTears,
      organicWobble: preset.organicWobble,
      glowIntensity: preset.glowIntensity,
      shadowDepth: preset.shadowDepth,
      opacity: preset.opacity,
      fontFamily: preset.fontFamily,
      uppercase: preset.uppercase,
      textGlow: preset.textGlow,
      buttonStyle: isAction ? preset.buttonStyle : w.buttonStyle,
      joystickStyle: isStick ? preset.joystickStyle : w.joystickStyle,
      barStyle: isBar ? preset.barStyle : w.barStyle,
    };
  });
}
