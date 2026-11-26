import type { FxEmitterConfig, FxEmitterPresetId } from '../types/maker';
import { createDefaultFxEmitterConfig, getFxPresetMeta } from './fxEmitterPresets';

export type FxLibraryCategory =
  | 'all'
  | 'fireHeat'
  | 'weather'
  | 'magic'
  | 'nature'
  | 'critters'
  | 'custom';

export type FxLibraryIconKey =
  | 'flame'
  | 'cloudRain'
  | 'sparkles'
  | 'bug'
  | 'bird'
  | 'droplets'
  | 'leaf'
  | 'snowflake'
  | 'cloudFog'
  | 'zap'
  | 'sun'
  | 'wind';

export interface FxLibraryLayer {
  nameSuffix: string;
  /** Optional small world-relative board offset [dx, dy] */
  offset?: [number, number];
  scale?: number;
  config: FxEmitterConfig;
}

export interface FxLibraryTemplate {
  id: string;
  name: string;
  category: Exclude<FxLibraryCategory, 'all'>;
  summary: string;
  accentHex: string;
  secondaryHex: string;
  icon: FxLibraryIconKey;
  tags: string[];
  layers: FxLibraryLayer[];
  isCustom?: boolean;
}

export const FX_LIBRARY_CATEGORY_LABELS: Record<FxLibraryCategory, string> = {
  all: 'All Effects',
  fireHeat: 'Fire & Heat',
  weather: 'Weather',
  magic: 'Magic & Energy',
  nature: 'Nature',
  critters: 'Swarms',
  custom: 'Saved',
};

function cfg(
  preset: FxEmitterPresetId,
  overrides: Partial<FxEmitterConfig> = {}
): FxEmitterConfig {
  const base = createDefaultFxEmitterConfig(preset);
  return {
    ...base,
    ...overrides,
    preset,
    targetOffset: overrides.targetOffset
      ? ([...overrides.targetOffset] as [number, number, number])
      : ([...base.targetOffset] as [number, number, number]),
  };
}

export const BUILTIN_FX_EFFECT_LIBRARY: FxLibraryTemplate[] = [
  {
    id: 'fx_tpl_fireplace',
    name: 'Fireplace',
    category: 'fireHeat',
    summary: 'Warm roaring hearth flames layered with crackling embers and soft rising chimney smoke.',
    accentHex: '#FF6B1A',
    secondaryHex: '#FFD166',
    icon: 'flame',
    tags: ['fire', 'hearth', 'embers', 'smoke', 'cozy'],
    layers: [
      {
        nameSuffix: 'Flames',
        scale: 1.0,
        config: cfg('fire', {
          elevationY: 0.2,
          maxParticles: 90,
          spawnRate: 38,
          lifetime: 1.05,
          startSize: 0.72,
          endSize: 0.14,
          startColor: '#FFF3A1',
          endColor: '#E63900',
          emissiveIntensity: 2.35,
          speed: 1.45,
          spreadAngle: 20,
          gravity: 2.1,
          turbulence: 0.85,
          fadeIn: 0.08,
          fadeOut: 0.5,
        }),
      },
      {
        nameSuffix: 'Embers',
        scale: 1.0,
        config: cfg('sparks', {
          elevationY: 0.45,
          maxParticles: 42,
          spawnRate: 14,
          lifetime: 1.35,
          startSize: 0.12,
          endSize: 0.04,
          startColor: '#FFF5B8',
          endColor: '#FF5A1F',
          emissiveIntensity: 2.8,
          speed: 1.85,
          spreadAngle: 34,
          gravity: 1.65,
          turbulence: 1.45,
          fadeIn: 0.06,
          fadeOut: 0.48,
        }),
      },
      {
        nameSuffix: 'Smoke',
        scale: 1.0,
        config: cfg('smoke', {
          elevationY: 1.15,
          maxParticles: 34,
          spawnRate: 6,
          lifetime: 3.1,
          startSize: 0.36,
          endSize: 1.55,
          startColor: '#B8C2D1',
          endColor: '#475569',
          emissiveIntensity: 0,
          speed: 0.8,
          spreadAngle: 18,
          gravity: 0.65,
          turbulence: 0.55,
          fadeIn: 0.22,
          fadeOut: 0.6,
        }),
      },
    ],
  },
  {
    id: 'fx_tpl_rainstorm',
    name: 'Rainstorm',
    category: 'weather',
    summary: 'Heavy wind-slanted downpour paired with periodic forked lightning strikes and low storm mist.',
    accentHex: '#38BDF8',
    secondaryHex: '#818CF8',
    icon: 'cloudRain',
    tags: ['rain', 'storm', 'lightning', 'weather', 'mist'],
    layers: [
      {
        nameSuffix: 'Downpour',
        scale: 1.0,
        config: cfg('rain', {
          elevationY: 0.5,
          maxParticles: 165,
          density: 150,
          areaRadius: 9.5,
          areaHeight: 11.5,
          fallSpeed: 19.5,
          windDrift: 3.8,
          windAngle: 35,
          startSize: 0.14,
          startColor: '#BAE6FD',
          endColor: '#60A5FA',
          emissiveIntensity: 0.35,
        }),
      },
      {
        nameSuffix: 'Lightning',
        scale: 1.0,
        config: cfg('lightning', {
          elevationY: 10.5,
          maxParticles: 24,
          boltLength: 10.2,
          targetOffset: [1.1, -10.2, 0.4],
          branchAmount: 0.72,
          jitterAmount: 0.9,
          boltThickness: 0.12,
          startColor: '#E0F2FE',
          endColor: '#60A5FA',
          emissiveIntensity: 3.2,
          flickerRate: 7.0,
          burstInterval: 4.2,
        }),
      },
      {
        nameSuffix: 'Storm Mist',
        scale: 1.0,
        config: cfg('fog', {
          elevationY: 0.85,
          maxParticles: 18,
          density: 16,
          areaRadius: 8.5,
          areaHeight: 2.2,
          startSize: 3.8,
          endSize: 5.2,
          startColor: '#CBD5E1',
          endColor: '#64748B',
          windDrift: 1.4,
          windAngle: 35,
          lifetime: 5.5,
        }),
      },
    ],
  },
  {
    id: 'fx_tpl_magic_portal',
    name: 'Magic Portal',
    category: 'magic',
    summary: 'Swirling arcane vortex with violet-to-cyan star sparkles, glowing mist core, and orbiting wisps.',
    accentHex: '#A855F7',
    secondaryHex: '#22D3EE',
    icon: 'sparkles',
    tags: ['portal', 'magic', 'arcane', 'vortex', 'fantasy'],
    layers: [
      {
        nameSuffix: 'Arcane Core',
        scale: 1.0,
        config: cfg('magic', {
          elevationY: 1.35,
          maxParticles: 110,
          spawnRate: 36,
          lifetime: 1.95,
          startSize: 0.44,
          endSize: 0.08,
          startColor: '#F0ABFC',
          endColor: '#22D3EE',
          emissiveIntensity: 2.75,
          speed: 1.35,
          spreadAngle: 140,
          gravity: 0.35,
          turbulence: 2.35,
          fadeIn: 0.14,
          fadeOut: 0.46,
        }),
      },
      {
        nameSuffix: 'Vortex Mist',
        scale: 1.0,
        config: cfg('smoke', {
          elevationY: 1.05,
          maxParticles: 34,
          spawnRate: 9,
          lifetime: 2.6,
          startSize: 0.85,
          endSize: 2.25,
          startColor: '#7C3AED',
          endColor: '#0EA5E9',
          emissiveIntensity: 1.25,
          speed: 0.55,
          spreadAngle: 110,
          gravity: 0.2,
          turbulence: 1.5,
          fadeIn: 0.24,
          fadeOut: 0.52,
        }),
      },
      {
        nameSuffix: 'Runic Wisps',
        scale: 1.0,
        config: cfg('fireflies', {
          elevationY: 1.4,
          maxParticles: 20,
          critterCount: 12,
          roamRadius: 2.4,
          moveSpeed: 2.1,
          erraticness: 0.45,
          flutterSpeed: 10,
          critterSize: 0.18,
          startColor: '#E879F9',
          endColor: '#38BDF8',
          glowEnabled: true,
          emissiveIntensity: 2.6,
        }),
      },
    ],
  },
  {
    id: 'fx_tpl_swarm',
    name: 'Swarm',
    category: 'critters',
    summary: 'Lively buzzing swarm of golden bees darting around an area with sunlit floating pollen.',
    accentHex: '#FACC15',
    secondaryHex: '#F59E0B',
    icon: 'bug',
    tags: ['swarm', 'bees', 'insects', 'critters', 'living'],
    layers: [
      {
        nameSuffix: 'Bees',
        scale: 1.0,
        config: cfg('bees', {
          elevationY: 1.35,
          maxParticles: 34,
          critterCount: 24,
          roamRadius: 3.1,
          moveSpeed: 3.2,
          erraticness: 0.78,
          flutterSpeed: 28,
          critterSize: 0.22,
          startColor: '#FACC15',
          endColor: '#1E293B',
          glowEnabled: false,
        }),
      },
      {
        nameSuffix: 'Pollen',
        scale: 1.0,
        config: cfg('dust', {
          elevationY: 1.2,
          maxParticles: 32,
          spawnRate: 9,
          lifetime: 2.6,
          startSize: 0.16,
          endSize: 0.24,
          startColor: '#FEF08A',
          endColor: '#FDE047',
          emissiveIntensity: 0.55,
          speed: 0.4,
          spreadAngle: 140,
          gravity: 0.05,
          turbulence: 0.9,
          fadeIn: 0.22,
          fadeOut: 0.5,
        }),
      },
    ],
  },
  {
    id: 'fx_tpl_campfire',
    name: 'Campfire',
    category: 'fireHeat',
    summary: 'Compact outdoor campfire blaze with lively floating sparks and warm amber glow.',
    accentHex: '#FB923C',
    secondaryHex: '#EF4444',
    icon: 'flame',
    tags: ['camp', 'fire', 'torch', 'outdoor'],
    layers: [
      {
        nameSuffix: 'Blaze',
        scale: 0.9,
        config: cfg('fire', {
          elevationY: 0.22,
          maxParticles: 72,
          spawnRate: 30,
          lifetime: 0.95,
          startSize: 0.52,
          endSize: 0.1,
          startColor: '#FEF08A',
          endColor: '#EA580C',
          emissiveIntensity: 2.2,
          speed: 1.55,
          spreadAngle: 24,
          gravity: 1.9,
          turbulence: 1.0,
        }),
      },
      {
        nameSuffix: 'Sparks',
        scale: 0.9,
        config: cfg('sparks', {
          elevationY: 0.4,
          maxParticles: 32,
          spawnRate: 10,
          lifetime: 1.15,
          startSize: 0.1,
          endSize: 0.03,
          startColor: '#FFFBEB',
          endColor: '#F97316',
          emissiveIntensity: 2.5,
          speed: 2.2,
          spreadAngle: 45,
          gravity: 0.9,
          turbulence: 1.3,
        }),
      },
    ],
  },
  {
    id: 'fx_tpl_waterfall_splash',
    name: 'Waterfall Splash',
    category: 'weather',
    summary: 'Foaming upward droplet bursts combined with cool drifting water spray mist.',
    accentHex: '#0EA5E9',
    secondaryHex: '#E0F2FE',
    icon: 'droplets',
    tags: ['water', 'splash', 'fountain', 'waterfall'],
    layers: [
      {
        nameSuffix: 'Droplets',
        scale: 1.0,
        config: cfg('waterSplash', {
          elevationY: 0.15,
          maxParticles: 95,
          burstCount: 38,
          burstInterval: 0.95,
          splashSize: 0.36,
          speed: 5.4,
          spreadAngle: 52,
          gravity: -11.5,
          lifetime: 1.05,
          startColor: '#E0F2FE',
          endColor: '#38BDF8',
          emissiveIntensity: 0.35,
        }),
      },
      {
        nameSuffix: 'Spray Mist',
        scale: 1.0,
        config: cfg('fog', {
          elevationY: 0.65,
          maxParticles: 16,
          density: 14,
          areaRadius: 2.8,
          areaHeight: 1.5,
          startSize: 2.2,
          endSize: 3.4,
          startColor: '#F0F9FF',
          endColor: '#BAE6FD',
          windDrift: 0.55,
          lifetime: 3.6,
        }),
      },
    ],
  },
  {
    id: 'fx_tpl_autumn_canopy',
    name: 'Autumn Canopy',
    category: 'nature',
    summary: 'Crisp autumn leaves fluttering, swaying, and tumbling gently down from overhead.',
    accentHex: '#EA580C',
    secondaryHex: '#F59E0B',
    icon: 'leaf',
    tags: ['leaves', 'autumn', 'trees', 'custom mesh', 'nature'],
    layers: [
      {
        nameSuffix: 'Leaves',
        scale: 1.0,
        config: cfg('fallingLeaves', {
          elevationY: 5.8,
          maxParticles: 65,
          spawnRate: 9,
          lifetime: 6.4,
          areaRadius: 5.0,
          fallSpeed: 1.15,
          windDrift: 1.05,
          windAngle: 30,
          swayAmplitude: 0.95,
          swayFrequency: 1.7,
          tumbleSpeed: 2.5,
          startSize: 0.48,
          scaleVariation: 0.4,
          startColor: '#F97316',
          endColor: '#B91C1C',
        }),
      },
    ],
  },
  {
    id: 'fx_tpl_blizzard',
    name: 'Snowfall Blizzard',
    category: 'weather',
    summary: 'Swirling wind-blown snowflakes layered with chilled low-lying winter frost fog.',
    accentHex: '#E0F2FE',
    secondaryHex: '#93C5FD',
    icon: 'snowflake',
    tags: ['snow', 'blizzard', 'winter', 'frost', 'weather'],
    layers: [
      {
        nameSuffix: 'Snow',
        scale: 1.0,
        config: cfg('snow', {
          elevationY: 0.5,
          maxParticles: 150,
          density: 125,
          areaRadius: 9.0,
          areaHeight: 10.0,
          fallSpeed: 2.35,
          windDrift: 2.2,
          windAngle: 45,
          startSize: 0.24,
          startColor: '#FFFFFF',
          endColor: '#DBEAFE',
          emissiveIntensity: 0.25,
        }),
      },
      {
        nameSuffix: 'Frost Fog',
        scale: 1.0,
        config: cfg('fog', {
          elevationY: 0.7,
          maxParticles: 16,
          density: 14,
          areaRadius: 8.5,
          areaHeight: 2.0,
          startSize: 4.0,
          endSize: 5.4,
          startColor: '#F1F5F9',
          endColor: '#CBD5E1',
          windDrift: 1.2,
          windAngle: 45,
        }),
      },
    ],
  },
  {
    id: 'fx_tpl_haunted_fog',
    name: 'Haunted Fog',
    category: 'magic',
    summary: 'Eerie creeping dungeon mist haunted by pale glowing moths circling in the gloom.',
    accentHex: '#34D399',
    secondaryHex: '#475569',
    icon: 'cloudFog',
    tags: ['fog', 'spooky', 'dungeon', 'moths', 'mist'],
    layers: [
      {
        nameSuffix: 'Mist',
        scale: 1.0,
        config: cfg('fog', {
          elevationY: 0.65,
          maxParticles: 24,
          density: 22,
          areaRadius: 7.2,
          areaHeight: 1.8,
          startSize: 3.8,
          endSize: 5.6,
          startColor: '#A7F3D0',
          endColor: '#334155',
          emissiveIntensity: 0.25,
          windDrift: 0.45,
          lifetime: 6.5,
        }),
      },
      {
        nameSuffix: 'Moths',
        scale: 1.0,
        config: cfg('moths', {
          elevationY: 1.4,
          maxParticles: 20,
          critterCount: 11,
          roamRadius: 3.4,
          moveSpeed: 1.65,
          erraticness: 0.55,
          flutterSpeed: 16,
          critterSize: 0.28,
          startColor: '#D1FAE5',
          endColor: '#6EE7B7',
          glowEnabled: true,
          emissiveIntensity: 1.35,
        }),
      },
    ],
  },
  {
    id: 'fx_tpl_tesla_coil',
    name: 'Arc Lightning Coil',
    category: 'magic',
    summary: 'Crackling cyan-white forked electrical arcs paired with high-velocity metallic sparks.',
    accentHex: '#38BDF8',
    secondaryHex: '#C084FC',
    icon: 'zap',
    tags: ['lightning', 'electric', 'tesla', 'sparks', 'arc'],
    layers: [
      {
        nameSuffix: 'Arc Bolt',
        scale: 1.0,
        config: cfg('lightning', {
          elevationY: 0.6,
          maxParticles: 28,
          boltLength: 5.2,
          targetOffset: [0, 5.2, 0],
          branchAmount: 0.78,
          jitterAmount: 0.85,
          boltThickness: 0.11,
          startColor: '#E0F2FE',
          endColor: '#38BDF8',
          emissiveIntensity: 3.1,
          flickerRate: 8.5,
          burstInterval: 1.4,
        }),
      },
      {
        nameSuffix: 'Arc Sparks',
        scale: 1.0,
        config: cfg('sparks', {
          elevationY: 0.8,
          maxParticles: 65,
          spawnRate: 26,
          lifetime: 0.75,
          startSize: 0.18,
          endSize: 0.04,
          startColor: '#E0F2FE',
          endColor: '#38BDF8',
          emissiveIntensity: 2.8,
          speed: 5.2,
          spreadAngle: 80,
          gravity: -9.5,
        }),
      },
    ],
  },
  {
    id: 'fx_tpl_firefly_glade',
    name: 'Firefly Glade',
    category: 'critters',
    summary: 'Enchanted evening clearing filled with bioluminescent fireflies and soft golden motes.',
    accentHex: '#BEF264',
    secondaryHex: '#4ADE80',
    icon: 'sun',
    tags: ['fireflies', 'night', 'glow', 'forest', 'ambient'],
    layers: [
      {
        nameSuffix: 'Fireflies',
        scale: 1.0,
        config: cfg('fireflies', {
          elevationY: 1.25,
          maxParticles: 36,
          critterCount: 24,
          roamRadius: 4.8,
          moveSpeed: 1.35,
          erraticness: 0.42,
          flutterSpeed: 11,
          critterSize: 0.18,
          startColor: '#D9F99D',
          endColor: '#84CC16',
          glowEnabled: true,
          emissiveIntensity: 2.5,
        }),
      },
      {
        nameSuffix: 'Twilight Motes',
        scale: 1.0,
        config: cfg('magic', {
          elevationY: 1.0,
          maxParticles: 34,
          spawnRate: 8,
          lifetime: 2.8,
          startSize: 0.22,
          endSize: 0.06,
          startColor: '#ECFCCB',
          endColor: '#4ADE80',
          emissiveIntensity: 1.8,
          speed: 0.45,
          spreadAngle: 140,
          gravity: 0.15,
          turbulence: 1.1,
        }),
      },
    ],
  },
  {
    id: 'fx_tpl_butterfly_meadow',
    name: 'Butterfly Meadow',
    category: 'critters',
    summary: 'Graceful butterflies flapping wide colorful wings lazily through a sunlit garden.',
    accentHex: '#F472B6',
    secondaryHex: '#FB923C',
    icon: 'wind',
    tags: ['butterflies', 'meadow', 'garden', 'critters', 'wings'],
    layers: [
      {
        nameSuffix: 'Butterflies',
        scale: 1.0,
        config: cfg('butterflies', {
          elevationY: 1.3,
          maxParticles: 28,
          critterCount: 14,
          roamRadius: 4.8,
          moveSpeed: 1.65,
          erraticness: 0.45,
          flutterSpeed: 7.5,
          wingFlapAmplitude: 74,
          critterSize: 0.38,
          startColor: '#F472B6',
          endColor: '#FDBA74',
          glowEnabled: false,
        }),
      },
    ],
  },
  {
    id: 'fx_tpl_birds_v_formation',
    name: 'V-Formation Flock',
    category: 'critters',
    summary: 'Migrating flock of birds flying together in a sweeping directional V-formation across the sky.',
    accentHex: '#38BDF8',
    secondaryHex: '#6366F1',
    icon: 'bird',
    tags: ['birds', 'flock', 'v-formation', 'migration', 'directional', 'flying'],
    layers: [
      {
        nameSuffix: 'V-Flock',
        scale: 1.0,
        config: cfg('birds', {
          elevationY: 8.5,
          maxParticles: 24,
          critterCount: 9,
          roamRadius: 18.0,
          moveSpeed: 6.4,
          erraticness: 0.16,
          flutterSpeed: 6.8,
          wingFlapAmplitude: 56,
          critterSize: 0.62,
          startColor: '#F8FAFC',
          endColor: '#334155',
          flightPattern: 'vFormation',
          flightMode: 'directional',
          flightHeading: 35,
          landingEnabled: false,
          landingFrequency: 0,
        }),
      },
    ],
  },
  {
    id: 'fx_tpl_songbirds_perch',
    name: 'Perching Songbirds',
    category: 'critters',
    summary: 'A few cheerful songbirds flitting randomly nearby and occasionally landing to rest & hop.',
    accentHex: '#60A5FA',
    secondaryHex: '#F59E0B',
    icon: 'bird',
    tags: ['birds', 'songbirds', 'landing', 'perch', 'few', 'random'],
    layers: [
      {
        nameSuffix: 'Songbirds',
        scale: 1.0,
        config: cfg('birds', {
          elevationY: 3.4,
          maxParticles: 16,
          critterCount: 5,
          roamRadius: 8.5,
          moveSpeed: 4.4,
          erraticness: 0.42,
          flutterSpeed: 9.0,
          wingFlapAmplitude: 62,
          critterSize: 0.42,
          startColor: '#38BDF8',
          endColor: '#F59E0B',
          flightPattern: 'wander',
          flightMode: 'random',
          landingEnabled: true,
          landingFrequency: 0.55,
        }),
      },
    ],
  },
  {
    id: 'fx_tpl_soaring_hawk',
    name: 'Soaring Hawk',
    category: 'critters',
    summary: 'A solitary majestic bird circling and gliding smoothly high above the landscape.',
    accentHex: '#B45309',
    secondaryHex: '#FDE68A',
    icon: 'bird',
    tags: ['bird', 'hawk', 'eagle', 'solo', 'circle', 'soar'],
    layers: [
      {
        nameSuffix: 'Hawk',
        scale: 1.0,
        config: cfg('birds', {
          elevationY: 11.0,
          maxParticles: 6,
          critterCount: 1,
          roamRadius: 14.0,
          moveSpeed: 5.8,
          erraticness: 0.12,
          flutterSpeed: 5.2,
          wingFlapAmplitude: 48,
          critterSize: 0.92,
          startColor: '#78350F',
          endColor: '#D97706',
          flightPattern: 'circle',
          flightMode: 'random',
          landingEnabled: false,
          landingFrequency: 0,
        }),
      },
    ],
  },
];

const CUSTOM_FX_LIBRARY_STORAGE_KEY = 'maker_custom_fx_library_v1';

export function loadCustomFxTemplates(): FxLibraryTemplate[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_FX_LIBRARY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is FxLibraryTemplate =>
        Boolean(item && typeof item.id === 'string' && typeof item.name === 'string' && Array.isArray(item.layers))
    );
  } catch {
    return [];
  }
}

export function saveCustomFxTemplates(templates: FxLibraryTemplate[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CUSTOM_FX_LIBRARY_STORAGE_KEY, JSON.stringify(templates));
  } catch {
    // ignore storage quota errors
  }
}

export function createCustomFxTemplate(
  name: string,
  config: FxEmitterConfig,
  scale = 1
): FxLibraryTemplate {
  const presetMeta = getFxPresetMeta(config.preset);
  const iconByPreset: Record<FxEmitterPresetId, FxLibraryIconKey> = {
    fire: 'flame',
    smoke: 'cloudFog',
    sparks: 'zap',
    magic: 'sparkles',
    dust: 'wind',
    fallingLeaves: 'leaf',
    waterSplash: 'droplets',
    lightning: 'zap',
    rain: 'cloudRain',
    snow: 'snowflake',
    fog: 'cloudFog',
    bees: 'bug',
    flies: 'bug',
    butterflies: 'wind',
    moths: 'wind',
    fireflies: 'sun',
    birds: 'bird',
  };

  return {
    id: `fx_custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim() || `${presetMeta.name} FX`,
    category: 'custom',
    summary: `Custom saved ${presetMeta.name} effect (${config.maxParticles} max particles).`,
    accentHex: config.startColor || presetMeta.accentHex,
    secondaryHex: config.endColor || presetMeta.accentHex,
    icon: iconByPreset[config.preset] ?? 'sparkles',
    tags: [presetMeta.name.toLowerCase(), config.preset.toLowerCase(), 'saved', 'custom'],
    isCustom: true,
    layers: [
      {
        nameSuffix: '',
        scale,
        config: {
          ...config,
          targetOffset: [...config.targetOffset] as [number, number, number],
        },
      },
    ],
  };
}
