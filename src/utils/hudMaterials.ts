import React from 'react';
import type {
  ChatFontId,
  HudBarStyle,
  HudBorderStyle,
  HudButtonStyle,
  HudJoystickStyle,
  HudSurfaceTexture,
  HudWidgetShape,
} from '../types/maker';

export interface HudTextureOption {
  id: HudSurfaceTexture;
  label: string;
  blurb: string;
  previewBg: string;
  defaultBgHex: string;
  defaultBorderHex: string;
  defaultTextHex: string;
}

export interface HudShapeOption {
  id: HudWidgetShape;
  label: string;
  icon: string;
}

export interface HudBorderOption {
  id: HudBorderStyle;
  label: string;
}

export interface HudButtonStyleOption {
  id: HudButtonStyle;
  label: string;
  blurb: string;
}

export interface HudJoystickStyleOption {
  id: HudJoystickStyle;
  label: string;
  blurb: string;
}

export interface HudBarStyleOption {
  id: HudBarStyle;
  label: string;
}

export const HUD_SURFACE_TEXTURES: HudTextureOption[] = [
  {
    id: 'smooth',
    label: 'Smooth Glass',
    blurb: 'Clean modern translucent finish',
    previewBg: 'linear-gradient(135deg, #273244, #141B26)',
    defaultBgHex: '#121822',
    defaultBorderHex: '#475569',
    defaultTextHex: '#F8FAFC',
  },
  {
    id: 'parchment',
    label: 'Aged Parchment',
    blurb: 'Distressed sepia paper fibers & foxing',
    previewBg: 'linear-gradient(135deg, #F0DCBA, #C69E68)',
    defaultBgHex: '#E8D2A9',
    defaultBorderHex: '#6E4725',
    defaultTextHex: '#2C1B0E',
  },
  {
    id: 'wood',
    label: 'Carved Wood',
    blurb: 'Warm timber plank grain & bevels',
    previewBg: 'linear-gradient(135deg, #8B5A32, #4E2F16)',
    defaultBgHex: '#6B4223',
    defaultBorderHex: '#A67242',
    defaultTextHex: '#FEF3D6',
  },
  {
    id: 'brushedMetal',
    label: 'Brushed Steel',
    blurb: 'Machined satin aluminum & rivets',
    previewBg: 'linear-gradient(135deg, #94A3B8, #334155)',
    defaultBgHex: '#3B4758',
    defaultBorderHex: '#CBD5E1',
    defaultTextHex: '#F8FAFC',
  },
  {
    id: 'forgedIron',
    label: 'Forged Iron',
    blurb: 'Hammered dark blacksmith steel',
    previewBg: 'linear-gradient(135deg, #474A54, #1B1C22)',
    defaultBgHex: '#25272E',
    defaultBorderHex: '#717684',
    defaultTextHex: '#E5E7EB',
  },
  {
    id: 'stone',
    label: 'Carved Stone',
    blurb: 'Weathered dungeon granite & chisel lines',
    previewBg: 'linear-gradient(135deg, #787771, #3D3C38)',
    defaultBgHex: '#4F4E49',
    defaultBorderHex: '#9E9B90',
    defaultTextHex: '#F5F5F0',
  },
  {
    id: 'leather',
    label: 'Stitched Leather',
    blurb: 'Saddle hide with stitched edge seam',
    previewBg: 'linear-gradient(135deg, #7C4124, #3E1D0E)',
    defaultBgHex: '#5A2D18',
    defaultBorderHex: '#C58B52',
    defaultTextHex: '#FDF1DC',
  },
  {
    id: 'holoGlass',
    label: 'Sci-Fi Holo',
    blurb: 'Luminous HUD scanlines & translucent energy',
    previewBg: 'linear-gradient(135deg, #0EA5E9, #0B1933)',
    defaultBgHex: '#071B30',
    defaultBorderHex: '#22D3EE',
    defaultTextHex: '#E0F9FF',
  },
  {
    id: 'circuitTech',
    label: 'Cyber Circuit',
    blurb: 'Dark titanium with glowing micro-traces',
    previewBg: 'linear-gradient(135deg, #1E293B, #090D18)',
    defaultBgHex: '#0C1322',
    defaultBorderHex: '#38BDF8',
    defaultTextHex: '#E2F5FF',
  },
  {
    id: 'arcadePlastic',
    label: 'Arcade Gloss',
    blurb: 'Candy-coat specular cabinet plastic',
    previewBg: 'linear-gradient(135deg, #F43F5E, #9F1239)',
    defaultBgHex: '#261438',
    defaultBorderHex: '#F472B6',
    defaultTextHex: '#FFFFFF',
  },
  {
    id: 'comicHalftone',
    label: 'Comic Halftone',
    blurb: 'Ben-Day ink dots & graphic novel print',
    previewBg: 'linear-gradient(135deg, #FDE047, #F97316)',
    defaultBgHex: '#FFFBEB',
    defaultBorderHex: '#111827',
    defaultTextHex: '#111827',
  },
  {
    id: 'fabricCanvas',
    label: 'Woven Canvas',
    blurb: 'Cross-hatched cloth & tapestry weave',
    previewBg: 'linear-gradient(135deg, #D6C7B2, #8C7A63)',
    defaultBgHex: '#CBB89D',
    defaultBorderHex: '#635340',
    defaultTextHex: '#221B14',
  },
];

export const HUD_WIDGET_SHAPES: HudShapeOption[] = [
  { id: 'rounded', label: 'Rounded', icon: '▢' },
  { id: 'circle', label: 'Circle', icon: '●' },
  { id: 'sharp', label: 'Sharp', icon: '■' },
  { id: 'chamfer', label: 'Chamfer', icon: '⬡' },
  { id: 'hex', label: 'Hexagon', icon: '⬢' },
  { id: 'diamond', label: 'Diamond', icon: '◆' },
  { id: 'shield', label: 'Shield', icon: '🛡' },
  { id: 'scroll', label: 'Scroll', icon: '📜' },
  { id: 'arch', label: 'Gothic Arch', icon: '⋂' },
  { id: 'slant', label: 'Slant', icon: '▱' },
  { id: 'cloud', label: 'Organic Blob', icon: '☁' },
  { id: 'tornOrganic', label: 'Torn Edge', icon: '✂' },
];

export const HUD_BORDER_STYLES: HudBorderOption[] = [
  { id: 'solid', label: 'Solid' },
  { id: 'double', label: 'Double' },
  { id: 'dashed', label: 'Stitched' },
  { id: 'etched', label: '3D Etched' },
  { id: 'ornate', label: 'Ornate Trim' },
  { id: 'glowing', label: 'Neon Glow' },
  { id: 'none', label: 'None' },
];

export const HUD_BUTTON_STYLES: HudButtonStyleOption[] = [
  { id: 'flat', label: 'Classic Flat', blurb: 'Clean tactile surface button' },
  { id: 'arcadeDome', label: '3D Arcade Dome', blurb: 'Glossy convex cabinet plunger & bezel' },
  { id: 'gamepad3d', label: '3D Gamepad Key', blurb: 'Sculpted console face button' },
  { id: 'woodCarved', label: 'Carved Wood', blurb: 'Medieval oak button with brass rivets' },
  { id: 'sciFiHolokey', label: 'Sci-Fi Holokey', blurb: 'Chamfered metallic key with LED glow' },
  { id: 'waxSeal', label: 'Wax Seal', blurb: 'Stamped medieval royal wax medallion' },
  { id: 'comicPop', label: 'Comic Pop', blurb: 'Bold ink outline, halftone & hard shadow' },
  { id: 'bevel3d', label: '3D Extruded', blurb: 'Raised tactile mechanical keycap' },
];

export const HUD_JOYSTICK_STYLES: HudJoystickStyleOption[] = [
  { id: 'modern', label: 'Modern Touch', blurb: 'Clean translucent thumbpad' },
  { id: '3dThumbstick', label: '3D Gamepad Stick', blurb: 'Sculpted concave rubber dome & 3D shaft' },
  { id: 'metalMachined', label: 'Machined Metal', blurb: 'Brushed steel bezel, bolts & chrome stick' },
  { id: 'woodenLever', label: 'Wooden Lever', blurb: 'Medieval oak socket, brass rim & burl knob' },
  { id: 'arcadeBall', label: 'Arcade Ball-Top', blurb: 'Octagonal gate, chrome shaft & candy ball' },
  { id: 'sciFiHolo', label: 'Sci-Fi Holo', blurb: 'Glowing HUD reticle & energy tether' },
  { id: 'stoneRune', label: 'Carved Stone', blurb: 'Ancient rune dial with glowing orb' },
];

export const HUD_BAR_STYLES: HudBarStyleOption[] = [
  { id: 'smooth', label: 'Smooth' },
  { id: 'segmented', label: 'Segmented' },
  { id: 'beveled', label: '3D Beveled' },
  { id: 'neon', label: 'Neon Energy' },
  { id: 'ornate', label: 'Medieval Ornate' },
];

const svgUri = (svg: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}")`;

/**
 * Hermetic procedural SVG data-URI textures layered over any user-chosen base color.
 * Zero external network URLs; crisp at any widget size.
 */
const TEXTURE_PATTERN_URIS: Record<HudSurfaceTexture, { image: string; size: string; blend?: string }> = {
  smooth: { image: 'none', size: 'auto' },
  parchment: {
    image: svgUri(
      `<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'>
        <filter id='p'><feTurbulence type='fractalNoise' baseFrequency='0.065' numOctaves='4' seed='7'/><feColorMatrix type='matrix' values='0.35 0 0 0 0.25  0.22 0 0 0 0.16  0.08 0 0 0 0.05  0 0 0 0.34 0'/></filter>
        <rect width='140' height='140' filter='url(#p)'/>
        <circle cx='28' cy='42' r='16' fill='#7c4a1d' fill-opacity='0.08'/>
        <circle cx='104' cy='96' r='22' fill='#5c3411' fill-opacity='0.07'/>
        <path d='M0 24 Q 40 20, 70 26 T 140 23' stroke='#6d441f' stroke-opacity='0.09' fill='none'/>
        <path d='M0 88 Q 50 93, 95 86 T 140 90' stroke='#5a3614' stroke-opacity='0.08' fill='none'/>
      </svg>`
    ),
    size: '140px 140px',
  },
  wood: {
    image: svgUri(
      `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='80'>
        <path d='M0 8 Q 40 3, 80 9 T 160 7' stroke='#261306' stroke-opacity='0.34' stroke-width='2' fill='none'/>
        <path d='M0 20 Q 50 25, 100 18 T 160 22' stroke='#d9a36c' stroke-opacity='0.14' stroke-width='1.5' fill='none'/>
        <path d='M0 34 Q 35 28, 90 36 T 160 32' stroke='#1f0e04' stroke-opacity='0.28' stroke-width='1.8' fill='none'/>
        <path d='M0 48 Q 60 54, 115 45 T 160 50' stroke='#f3c995' stroke-opacity='0.12' stroke-width='1.3' fill='none'/>
        <path d='M0 64 Q 45 59, 95 66 T 160 62' stroke='#1b0c03' stroke-opacity='0.32' stroke-width='2.2' fill='none'/>
        <ellipse cx='112' cy='38' rx='12' ry='4.5' stroke='#1f0e04' stroke-opacity='0.28' stroke-width='1.4' fill='#2a1507' fill-opacity='0.16'/>
        <line x1='0' y1='79' x2='160' y2='79' stroke='#140902' stroke-opacity='0.35' stroke-width='1.2'/>
      </svg>`
    ),
    size: '160px 80px',
  },
  brushedMetal: {
    image: svgUri(
      `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='60'>
        <defs>
          <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
            <stop offset='0%' stop-color='#ffffff' stop-opacity='0.26'/>
            <stop offset='45%' stop-color='#000000' stop-opacity='0.06'/>
            <stop offset='65%' stop-color='#ffffff' stop-opacity='0.18'/>
            <stop offset='100%' stop-color='#000000' stop-opacity='0.2'/>
          </linearGradient>
        </defs>
        <rect width='120' height='60' fill='url(#g)'/>
        <g stroke='#ffffff' stroke-opacity='0.11' stroke-width='0.7'>
          <line x1='0' y1='4' x2='120' y2='4'/><line x1='0' y1='11' x2='120' y2='11'/>
          <line x1='0' y1='19' x2='120' y2='19'/><line x1='0' y1='27' x2='120' y2='27'/>
          <line x1='0' y1='35' x2='120' y2='35'/><line x1='0' y1='43' x2='120' y2='43'/>
          <line x1='0' y1='52' x2='120' y2='52'/>
        </g>
        <g stroke='#000000' stroke-opacity='0.14' stroke-width='0.6'>
          <line x1='0' y1='7' x2='120' y2='7'/><line x1='0' y1='23' x2='120' y2='23'/>
          <line x1='0' y1='39' x2='120' y2='39'/><line x1='0' y1='56' x2='120' y2='56'/>
        </g>
      </svg>`
    ),
    size: '120px 60px',
  },
  forgedIron: {
    image: svgUri(
      `<svg xmlns='http://www.w3.org/2000/svg' width='90' height='90'>
        <filter id='f'><feTurbulence type='turbulence' baseFrequency='0.14' numOctaves='3' seed='3'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncA type='linear' slope='0.28'/></feComponentTransfer></filter>
        <rect width='90' height='90' filter='url(#f)'/>
        <circle cx='18' cy='22' r='8' fill='#ffffff' fill-opacity='0.06'/>
        <circle cx='58' cy='16' r='10' fill='#000000' fill-opacity='0.16'/>
        <circle cx='34' cy='62' r='11' fill='#000000' fill-opacity='0.14'/>
        <circle cx='72' cy='68' r='9' fill='#ffffff' fill-opacity='0.05'/>
      </svg>`
    ),
    size: '90px 90px',
  },
  stone: {
    image: svgUri(
      `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'>
        <filter id='s'><feTurbulence type='fractalNoise' baseFrequency='0.11' numOctaves='4' seed='11'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncA type='linear' slope='0.3'/></feComponentTransfer></filter>
        <rect width='120' height='120' filter='url(#s)'/>
        <path d='M0 40 L48 42 L60 36 L120 40' stroke='#1c1917' stroke-opacity='0.28' stroke-width='1.5' fill='none'/>
        <path d='M0 86 L74 82 L88 90 L120 85' stroke='#ffffff' stroke-opacity='0.11' stroke-width='1' fill='none'/>
        <path d='M52 0 L50 40 M84 40 L82 86 M26 86 L28 120' stroke='#1c1917' stroke-opacity='0.22' stroke-width='1.2' fill='none'/>
      </svg>`
    ),
    size: '120px 120px',
  },
  leather: {
    image: svgUri(
      `<svg xmlns='http://www.w3.org/2000/svg' width='72' height='72'>
        <filter id='l'><feTurbulence type='turbulence' baseFrequency='0.22' numOctaves='2' seed='19'/><feColorMatrix type='matrix' values='0.3 0 0 0 0.1  0.15 0 0 0 0.05  0.05 0 0 0 0.02  0 0 0 0.3 0'/></filter>
        <rect width='72' height='72' filter='url(#l)'/>
        <path d='M0 18 Q 18 14, 36 18 T 72 18 M0 54 Q 18 58, 36 54 T 72 54' stroke='#000000' stroke-opacity='0.16' fill='none'/>
      </svg>`
    ),
    size: '72px 72px',
  },
  holoGlass: {
    image: svgUri(
      `<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'>
        <g stroke='#38bdf8' stroke-opacity='0.16' stroke-width='1'>
          <line x1='0' y1='4' x2='64' y2='4'/><line x1='0' y1='12' x2='64' y2='12'/>
          <line x1='0' y1='20' x2='64' y2='20'/><line x1='0' y1='28' x2='64' y2='28'/>
          <line x1='0' y1='36' x2='64' y2='36'/><line x1='0' y1='44' x2='64' y2='44'/>
          <line x1='0' y1='52' x2='64' y2='52'/><line x1='0' y1='60' x2='64' y2='60'/>
        </g>
        <polygon points='0,0 18,0 0,18' fill='#7dd3fc' fill-opacity='0.15'/>
      </svg>`
    ),
    size: '64px 64px',
  },
  circuitTech: {
    image: svgUri(
      `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'>
        <g stroke='#38bdf8' stroke-opacity='0.24' stroke-width='1.2' fill='none'>
          <path d='M6 16 H28 L38 26 H68'/>
          <path d='M12 68 H34 L46 56 H88'/>
          <path d='M78 10 V38 L66 50 V84'/>
          <path d='M22 36 V82'/>
        </g>
        <g fill='#38bdf8' fill-opacity='0.42'>
          <circle cx='68' cy='26' r='2.4'/><circle cx='12' cy='68' r='2.4'/>
          <circle cx='78' cy='10' r='2.4'/><circle cx='22' cy='36' r='2.2'/>
          <circle cx='66' cy='84' r='2.2'/>
        </g>
      </svg>`
    ),
    size: '96px 96px',
  },
  arcadePlastic: {
    image: svgUri(
      `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'>
        <defs>
          <linearGradient id='a' x1='0' y1='0' x2='0' y2='1'>
            <stop offset='0%' stop-color='#ffffff' stop-opacity='0.34'/>
            <stop offset='38%' stop-color='#ffffff' stop-opacity='0.04'/>
            <stop offset='52%' stop-color='#000000' stop-opacity='0.06'/>
            <stop offset='100%' stop-color='#000000' stop-opacity='0.24'/>
          </linearGradient>
        </defs>
        <rect width='120' height='120' fill='url(#a)'/>
      </svg>`
    ),
    size: '100% 100%',
  },
  comicHalftone: {
    image: svgUri(
      `<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'>
        <circle cx='4' cy='4' r='1.7' fill='#000000' fill-opacity='0.14'/>
        <circle cx='12' cy='12' r='1.7' fill='#000000' fill-opacity='0.14'/>
      </svg>`
    ),
    size: '12px 12px',
  },
  fabricCanvas: {
    image: svgUri(
      `<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20'>
        <path d='M0 5 H20 M0 15 H20' stroke='#000000' stroke-opacity='0.11' stroke-width='1'/>
        <path d='M5 0 V20 M15 0 V20' stroke='#ffffff' stroke-opacity='0.12' stroke-width='1'/>
        <path d='M0 10 H20 M10 0 V20' stroke='#000000' stroke-opacity='0.07' stroke-width='0.8'/>
      </svg>`
    ),
    size: '14px 14px',
  },
};

export function hexToRgba(hex: string, alpha: number): string {
  const clean = (hex || '#111827').replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6);
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return `rgba(17,24,39,${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

export function getHudFontStack(fontId?: ChatFontId): string {
  switch (fontId) {
    case 'display':
      return "'Outfit', 'Plus Jakarta Sans', system-ui, sans-serif";
    case 'serif':
      return "'Lora', Georgia, serif";
    case 'cartoon':
      return "'Fredoka', 'Plus Jakarta Sans', sans-serif";
    case 'comic':
      return "'Bangers', 'Fredoka', Impact, cursive";
    case 'handwritten':
      return "'Patrick Hand', cursive";
    case 'pixel':
      return "'Silkscreen', 'JetBrains Mono', monospace";
    case 'mono':
      return "'JetBrains Mono', ui-monospace, monospace";
    case 'cinzel':
      return "'Cinzel', 'Lora', Georgia, serif";
    case 'gothic':
      return "'UnifrakturMaguntia', 'Cinzel', Georgia, serif";
    case 'orbitron':
      return "'Orbitron', 'Chakra Petch', sans-serif";
    case 'arcade':
      return "'Press Start 2P', 'Silkscreen', monospace";
    case 'garamond':
      return "'Cormorant Garamond', 'Lora', Georgia, serif";
    case 'tactical':
      return "'Chakra Petch', 'Outfit', sans-serif";
    default:
      return "'Plus Jakarta Sans', system-ui, sans-serif";
  }
}

/**
 * Generates an organic hand-torn / deckled paper polygon clip-path.
 * Scales tooth depth smoothly with `tearAmount` (0..1).
 */
export function buildTornPaperClipPath(tearAmount: number, seed = 1): string {
  const t = Math.max(0.08, Math.min(1, tearAmount));
  const amp = 1.6 + t * 4.4;
  const pts: string[] = [];
  const stepsX = 14;
  const stepsY = 8;

  const jitter = (i: number, salt: number) => {
    const v = Math.sin((i + 1) * 12.9898 + (salt + seed) * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };

  // Top edge (left to right)
  for (let i = 0; i <= stepsX; i++) {
    const x = (i / stepsX) * 100;
    const bite = i === 4 || i === 10 ? amp * (1.2 + t * 1.1) : amp * jitter(i, 1);
    const y = i === 0 || i === stepsX ? amp * 0.45 : bite;
    pts.push(`${x.toFixed(1)}% ${y.toFixed(1)}%`);
  }
  // Right edge (top to bottom)
  for (let i = 1; i <= stepsY; i++) {
    const y = (i / stepsY) * 100;
    const bite = i === 3 ? amp * (1.1 + t * 0.9) : amp * jitter(i, 2);
    const x = 100 - (i === stepsY ? amp * 0.45 : bite);
    pts.push(`${x.toFixed(1)}% ${y.toFixed(1)}%`);
  }
  // Bottom edge (right to left)
  for (let i = stepsX - 1; i >= 0; i--) {
    const x = (i / stepsX) * 100;
    const bite = i === 6 || i === 12 ? amp * (1.3 + t * 1.1) : amp * jitter(i, 3);
    const y = 100 - (i === 0 ? amp * 0.45 : bite);
    pts.push(`${x.toFixed(1)}% ${y.toFixed(1)}%`);
  }
  // Left edge (bottom to top)
  for (let i = stepsY - 1; i >= 1; i--) {
    const y = (i / stepsY) * 100;
    const bite = i === 5 ? amp * (1.15 + t * 0.9) : amp * jitter(i, 4);
    const x = bite;
    pts.push(`${x.toFixed(1)}% ${y.toFixed(1)}%`);
  }

  return `polygon(${pts.join(', ')})`;
}

export interface ShapeGeometry {
  borderRadius: string;
  clipPath?: string;
  usesClipPath: boolean;
}

export function getShapeGeometry(
  shape: HudWidgetShape = 'rounded',
  cornerRadius = 12,
  paperTears = 0,
  seed = 1
): ShapeGeometry {
  const r = Math.max(0, Math.min(48, cornerRadius));

  if (shape === 'tornOrganic' || paperTears >= 0.14) {
    const tearStrength = shape === 'tornOrganic' ? Math.max(0.45, paperTears) : paperTears;
    return {
      borderRadius: `${Math.min(6, r)}px`,
      clipPath: buildTornPaperClipPath(tearStrength, seed),
      usesClipPath: true,
    };
  }

  switch (shape) {
    case 'circle':
      return { borderRadius: '9999px', usesClipPath: false };
    case 'sharp':
      return { borderRadius: '2px', usesClipPath: false };
    case 'chamfer':
      return {
        borderRadius: '0px',
        clipPath:
          'polygon(11px 0%, calc(100% - 11px) 0%, 100% 11px, 100% calc(100% - 11px), calc(100% - 11px) 100%, 11px 100%, 0% calc(100% - 11px), 0% 11px)',
        usesClipPath: true,
      };
    case 'hex':
      return {
        borderRadius: '0px',
        clipPath: 'polygon(14% 0%, 86% 0%, 100% 50%, 86% 100%, 14% 100%, 0% 50%)',
        usesClipPath: true,
      };
    case 'diamond':
      return {
        borderRadius: '0px',
        clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
        usesClipPath: true,
      };
    case 'shield':
      return {
        borderRadius: '0px',
        clipPath:
          'polygon(5% 0%, 95% 0%, 100% 12%, 96% 68%, 50% 100%, 4% 68%, 0% 12%)',
        usesClipPath: true,
      };
    case 'scroll':
      return {
        borderRadius: '4px 16px 4px 16px',
        usesClipPath: false,
      };
    case 'arch':
      return {
        borderRadius: '999px 999px 10px 10px',
        usesClipPath: false,
      };
    case 'slant':
      return {
        borderRadius: '4px',
        clipPath: 'polygon(10px 0%, 100% 0%, calc(100% - 10px) 100%, 0% 100%)',
        usesClipPath: true,
      };
    case 'cloud':
      return {
        borderRadius: '38% 62% 52% 48% / 44% 38% 62% 56%',
        usesClipPath: false,
      };
    default:
      return { borderRadius: `${r}px`, usesClipPath: false };
  }
}

export interface SurfaceVisualParams {
  surfaceTexture?: HudSurfaceTexture;
  shape?: HudWidgetShape;
  bgHex?: string;
  borderHex?: string;
  borderStyle?: HudBorderStyle;
  borderWidth?: number;
  cornerRadius?: number;
  edgeWear?: number;
  burnedEdges?: number;
  paperTears?: number;
  organicWobble?: number;
  glowIntensity?: number;
  glowHex?: string;
  shadowDepth?: number;
  rotationDeg?: number;
  opacity?: number;
  seed?: number;
}

export interface SurfaceVisualOutput {
  outerStyle: React.CSSProperties;
  surfaceStyle: React.CSSProperties;
  wearFilterUrl?: string;
  burnOverlayStyle?: React.CSSProperties;
  isOrnate: boolean;
  usesClipPath: boolean;
}

/**
 * Computes cohesive outer wrapper + inner surface styles for any HUD widget or speech bubble,
 * combining procedural texture, burned/scorched vignette, organic edge wear SVG filter,
 * arbitrary polygon shapes, 3D depth shadows, neon glow, and full ghost-back opacity.
 */
export function buildSurfaceVisualStyles(params: SurfaceVisualParams): SurfaceVisualOutput {
  const texture = params.surfaceTexture ?? 'smooth';
  const shape = params.shape ?? 'rounded';
  const bgHex = params.bgHex ?? '#121822';
  const borderHex = params.borderHex ?? '#475569';
  const borderStyle = params.borderStyle ?? 'solid';
  const borderWidth = borderStyle === 'none' ? 0 : Math.max(0, Math.min(6, params.borderWidth ?? 1.5));
  const cornerRadius = params.cornerRadius ?? 12;
  const edgeWear = Math.max(0, Math.min(1, params.edgeWear ?? 0));
  const burnedEdges = Math.max(0, Math.min(1, params.burnedEdges ?? 0));
  const paperTears = Math.max(0, Math.min(1, params.paperTears ?? 0));
  const organicWobble = Math.max(0, Math.min(1, params.organicWobble ?? 0));
  const glowIntensity = Math.max(0, Math.min(1, params.glowIntensity ?? 0));
  const glowHex = params.glowHex ?? borderHex;
  const shadowDepth = Math.max(0, Math.min(1, params.shadowDepth ?? 0.35));
  const rotationDeg = params.rotationDeg ?? 0;
  const opacity = Math.max(0.08, Math.min(1, params.opacity ?? 0.94));
  const seed = params.seed ?? 1;

  const geom = getShapeGeometry(shape, cornerRadius, paperTears, seed);
  const texDef = TEXTURE_PATTERN_URIS[texture] ?? TEXTURE_PATTERN_URIS.smooth;

  // Pick SVG organic displacement filter bucket when edgeWear > 0
  let wearFilterUrl: string | undefined;
  if (edgeWear >= 0.66) wearFilterUrl = 'url(#maker-hud-wear-lg)';
  else if (edgeWear >= 0.3) wearFilterUrl = 'url(#maker-hud-wear-md)';
  else if (edgeWear > 0.04) wearFilterUrl = 'url(#maker-hud-wear-sm)';

  // Outer drop-shadows (survive clip-path polygons & torn edges!)
  const filters: string[] = [];
  if (shadowDepth > 0.02) {
    const dy = Math.round(2 + shadowDepth * 9);
    const blur = Math.round(3 + shadowDepth * 14);
    filters.push(`drop-shadow(0 ${dy}px ${blur}px rgba(0,0,0,${(0.28 + shadowDepth * 0.42).toFixed(2)}))`);
  }
  if (glowIntensity > 0.02 || borderStyle === 'glowing') {
    const g = Math.max(glowIntensity, borderStyle === 'glowing' ? 0.55 : 0);
    const radius = Math.round(5 + g * 18);
    filters.push(`drop-shadow(0 0 ${radius}px ${hexToRgba(glowHex, 0.42 + g * 0.48)})`);
  }

  // Slight organic tilt from organicWobble
  const wobbleTilt =
    organicWobble > 0.02
      ? (((seed * 37) % 11) - 5) * 0.45 * organicWobble
      : 0;
  const totalRotation = rotationDeg + wobbleTilt;

  // CSS border style mapping
  let cssBorderStyle: React.CSSProperties['borderStyle'] = 'solid';
  if (borderStyle === 'double' || borderStyle === 'ornate') cssBorderStyle = 'double';
  else if (borderStyle === 'dashed') cssBorderStyle = 'dashed';
  else if (borderStyle === 'etched') cssBorderStyle = 'ridge';
  else if (borderStyle === 'none') cssBorderStyle = 'none';

  const effectiveBorderWidth =
    borderStyle === 'double' || borderStyle === 'ornate'
      ? Math.max(3, borderWidth)
      : borderWidth;

  // Layered inset lighting + etched/leather stitching + scorched burns
  const insetShadows: string[] = [];
  if (texture === 'parchment' || texture === 'fabricCanvas') {
    insetShadows.push('inset 0 0 18px rgba(105, 64, 22, 0.24)');
  }
  if (texture === 'wood' || texture === 'stone' || texture === 'forgedIron') {
    insetShadows.push('inset 0 1px 0 rgba(255,255,255,0.22)', 'inset 0 -2px 5px rgba(0,0,0,0.45)');
  }
  if (texture === 'brushedMetal') {
    insetShadows.push('inset 0 1px 1px rgba(255,255,255,0.48)', 'inset 0 -2px 3px rgba(15,23,42,0.48)');
  }
  if (texture === 'leather') {
    insetShadows.push('inset 0 0 0 2px rgba(20, 8, 2, 0.45)', 'inset 0 2px 6px rgba(0,0,0,0.42)');
  }
  if (texture === 'holoGlass' || texture === 'circuitTech') {
    insetShadows.push(`inset 0 0 14px ${hexToRgba(glowHex, 0.28)}`, 'inset 0 1px 0 rgba(255,255,255,0.22)');
  }
  if (texture === 'arcadePlastic') {
    insetShadows.push('inset 0 2px 2px rgba(255,255,255,0.52)', 'inset 0 -3px 5px rgba(0,0,0,0.38)');
  }
  if (burnedEdges > 0.03) {
    const spread = Math.round(4 + burnedEdges * 18);
    const blur = Math.round(10 + burnedEdges * 26);
    insetShadows.push(
      `inset 0 0 ${blur}px ${spread}px rgba(42, 19, 5, ${(0.35 + burnedEdges * 0.52).toFixed(2)})`,
      `inset 0 0 ${Math.round(4 + burnedEdges * 10)}px rgba(16, 6, 2, ${(0.45 + burnedEdges * 0.45).toFixed(2)})`
    );
  }
  if (borderStyle === 'glowing' || glowIntensity > 0.25) {
    insetShadows.push(`inset 0 0 ${Math.round(6 + glowIntensity * 12)}px ${hexToRgba(glowHex, 0.32)}`);
  }

  // Background layering: procedural texture SVG + optional subtle sheen + base hex
  const bgImages: string[] = [];
  const bgSizes: string[] = [];
  if (texDef.image !== 'none') {
    bgImages.push(texDef.image);
    bgSizes.push(texDef.size);
  }
  if (texture === 'parchment') {
    bgImages.push(
      'radial-gradient(ellipse at 30% 25%, rgba(255,248,225,0.28), transparent 65%), radial-gradient(ellipse at 80% 80%, rgba(120,72,26,0.22), transparent 62%)'
    );
    bgSizes.push('100% 100%');
  } else if (texture === 'holoGlass') {
    bgImages.push(
      `linear-gradient(160deg, ${hexToRgba(glowHex, 0.22)} 0%, transparent 45%, ${hexToRgba(glowHex, 0.14)} 100%)`
    );
    bgSizes.push('100% 100%');
  }

  const outerStyle: React.CSSProperties = {
    opacity,
    transform: Math.abs(totalRotation) > 0.05 ? `rotate(${totalRotation.toFixed(2)}deg)` : undefined,
    filter: filters.length > 0 ? filters.join(' ') : undefined,
  };

  const surfaceStyle: React.CSSProperties = {
    backgroundColor:
      texture === 'holoGlass'
        ? hexToRgba(bgHex, Math.min(0.84, Math.max(0.62, opacity)))
        : bgHex,
    backgroundImage: bgImages.length > 0 ? bgImages.join(', ') : undefined,
    backgroundSize: bgSizes.length > 0 ? bgSizes.join(', ') : undefined,
    borderRadius: geom.borderRadius,
    clipPath: geom.clipPath,
    borderWidth: effectiveBorderWidth > 0 ? `${effectiveBorderWidth}px` : 0,
    borderStyle: effectiveBorderWidth > 0 ? cssBorderStyle : 'none',
    borderColor: effectiveBorderWidth > 0 ? borderHex : 'transparent',
    boxShadow: insetShadows.length > 0 ? insetShadows.join(', ') : undefined,
  };

  const burnOverlayStyle: React.CSSProperties | undefined =
    burnedEdges > 0.04
      ? {
          backgroundImage: `radial-gradient(ellipse at 50% 50%, transparent ${Math.max(
            26,
            72 - burnedEdges * 38
          )}%, rgba(88, 43, 12, ${(0.34 * burnedEdges).toFixed(2)}) ${Math.max(
            56,
            88 - burnedEdges * 22
          )}%, rgba(22, 9, 3, ${(0.78 * burnedEdges).toFixed(2)}) 100%)`,
          mixBlendMode: 'multiply',
        }
      : undefined;

  return {
    outerStyle,
    surfaceStyle,
    wearFilterUrl,
    burnOverlayStyle,
    isOrnate: borderStyle === 'ornate',
    usesClipPath: geom.usesClipPath,
  };
}

/**
 * Shared hidden SVG <filter> defs for genuine organic edge roughness/wear
 * (feTurbulence + feDisplacementMap). Mount once inside InterfaceStage,
 * ChatBubbleStudioModal, and PlayModeView.
 */
export const HudSvgFilters: React.FC = () =>
  React.createElement(
    'svg',
    {
      'aria-hidden': 'true',
      width: 0,
      height: 0,
      style: {
        position: 'absolute',
        width: 0,
        height: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      },
    },
    React.createElement(
      'defs',
      null,
      React.createElement(
        'filter',
        { id: 'maker-hud-wear-sm', x: '-8%', y: '-8%', width: '116%', height: '116%' },
        React.createElement('feTurbulence', {
          type: 'fractalNoise',
          baseFrequency: '0.065',
          numOctaves: 3,
          seed: 4,
          result: 'noise',
        }),
        React.createElement('feDisplacementMap', {
          in: 'SourceGraphic',
          in2: 'noise',
          scale: 2.2,
          xChannelSelector: 'R',
          yChannelSelector: 'G',
        })
      ),
      React.createElement(
        'filter',
        { id: 'maker-hud-wear-md', x: '-10%', y: '-10%', width: '120%', height: '120%' },
        React.createElement('feTurbulence', {
          type: 'fractalNoise',
          baseFrequency: '0.055',
          numOctaves: 4,
          seed: 9,
          result: 'noise',
        }),
        React.createElement('feDisplacementMap', {
          in: 'SourceGraphic',
          in2: 'noise',
          scale: 4.6,
          xChannelSelector: 'R',
          yChannelSelector: 'G',
        })
      ),
      React.createElement(
        'filter',
        { id: 'maker-hud-wear-lg', x: '-12%', y: '-12%', width: '124%', height: '124%' },
        React.createElement('feTurbulence', {
          type: 'fractalNoise',
          baseFrequency: '0.048',
          numOctaves: 4,
          seed: 14,
          result: 'noise',
        }),
        React.createElement('feDisplacementMap', {
          in: 'SourceGraphic',
          in2: 'noise',
          scale: 7.5,
          xChannelSelector: 'R',
          yChannelSelector: 'G',
        })
      )
    )
  );
