import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import type {
  ObjectGroupSpec,
  ObjectMakerDoc,
  ObjectPartSpec,
  ObjectSurfaceFinish,
  PlantClusterRecipe,
  PlantLeafPatternId,
  PlantPartConfig,
  PlantShapeId,
  WeatheringPreset,
} from '../types/maker';
import { uid } from '../utils/terrain';

export type PlantShapeCategory = 'leaf' | 'petal' | 'stem' | 'fantasy';

export interface PlantShapeMeta {
  id: PlantShapeId;
  label: string;
  defaultName: string;
  category: PlantShapeCategory;
  defaultSize: [number, number, number];
  defaultColor: string;
  defaultPattern: PlantLeafPatternId;
  defaultAccentColor: string;
  defaultTipColor: string;
  defaultDroop: number;
  defaultCup: number;
  defaultRuffle: number;
  defaultAsymSkew?: number;
  defaultEmissiveIntensity?: number;
  hint: string;
}

export const PLANT_SHAPE_CATALOG: PlantShapeMeta[] = [
  // --- LEAVES ---
  {
    id: 'leafBanana',
    label: 'Banana Leaf',
    defaultName: 'BananaLeaf',
    category: 'leaf',
    defaultSize: [0.68, 0.24, 1.55],
    defaultColor: '#2E8B47',
    defaultPattern: 'ribs',
    defaultAccentColor: '#7BE06B',
    defaultTipColor: '#88D448',
    defaultDroop: 0.42,
    defaultCup: 0.35,
    defaultRuffle: 0.14,
    hint: 'Broad tropical paddle with deep cross-ribs & graceful droop',
  },
  {
    id: 'leafElephantEar',
    label: 'Elephant Ear',
    defaultName: 'ElephantEar',
    category: 'leaf',
    defaultSize: [1.05, 0.28, 1.35],
    defaultColor: '#246B43',
    defaultPattern: 'veins',
    defaultAccentColor: '#9BE584',
    defaultTipColor: '#4BA462',
    defaultDroop: 0.35,
    defaultCup: 0.45,
    defaultRuffle: 0.28,
    hint: 'Wide heart-ear blade with bold lobes & rippling margins',
  },
  {
    id: 'leafTeardrop',
    label: 'Teardrop Leaf',
    defaultName: 'TeardropLeaf',
    category: 'leaf',
    defaultSize: [0.56, 0.18, 0.98],
    defaultColor: '#3B9452',
    defaultPattern: 'veins',
    defaultAccentColor: '#A2E382',
    defaultTipColor: '#69C463',
    defaultDroop: 0.28,
    defaultCup: 0.25,
    defaultRuffle: 0.06,
    hint: 'Classic rounded droplet tapering to an elegant drip-tip',
  },
  {
    id: 'leafBlade',
    label: 'Pointed Blade',
    defaultName: 'PointedBlade',
    category: 'leaf',
    defaultSize: [0.22, 0.25, 1.48],
    defaultColor: '#3F9E4C',
    defaultPattern: 'gradientTip',
    defaultAccentColor: '#8AD968',
    defaultTipColor: '#D6EB6A',
    defaultDroop: 0.48,
    defaultCup: 0.52,
    defaultRuffle: 0.04,
    hint: 'Long slender sword/agave blade with V-keel spine',
  },
  {
    id: 'leafMonstera',
    label: 'Split Monstera',
    defaultName: 'MonsteraLeaf',
    category: 'leaf',
    defaultSize: [0.95, 0.22, 1.15],
    defaultColor: '#1E6E46',
    defaultPattern: 'variegated',
    defaultAccentColor: '#E9F5D8',
    defaultTipColor: '#39A368',
    defaultDroop: 0.32,
    defaultCup: 0.22,
    defaultRuffle: 0.12,
    hint: 'Fenestrated jungle leaf with deep organic side lobes',
  },
  {
    id: 'leafFern',
    label: 'Fern Frond',
    defaultName: 'FernFrond',
    category: 'leaf',
    defaultSize: [0.55, 0.24, 1.45],
    defaultColor: '#3A8D3E',
    defaultPattern: 'ribs',
    defaultAccentColor: '#84CF63',
    defaultTipColor: '#9CE26A',
    defaultDroop: 0.55,
    defaultCup: 0.18,
    defaultRuffle: 0.08,
    hint: 'Feathered arching frond with alternating leaflet pinnae',
  },
  {
    id: 'leafLotus',
    label: 'Cupped Lily Pad',
    defaultName: 'LilyPad',
    category: 'leaf',
    defaultSize: [0.92, 0.14, 0.92],
    defaultColor: '#2B8A5B',
    defaultPattern: 'veins',
    defaultAccentColor: '#88DBA0',
    defaultTipColor: '#56B87A',
    defaultDroop: -0.22,
    defaultCup: 0.55,
    defaultRuffle: 0.12,
    hint: 'Upturned notched circular pad with radiating water veins',
  },
  {
    id: 'leafHeartVine',
    label: 'Heart Vine Leaf',
    defaultName: 'HeartLeaf',
    category: 'leaf',
    defaultSize: [0.52, 0.16, 0.68],
    defaultColor: '#348C5E',
    defaultPattern: 'variegated',
    defaultAccentColor: '#DDF2B8',
    defaultTipColor: '#6AD489',
    defaultDroop: 0.36,
    defaultCup: 0.28,
    defaultRuffle: 0.08,
    hint: 'Plump trailing heart leaf suited for vines & hanging baskets',
  },

  // --- FLOWER PETALS & CORES ---
  {
    id: 'petalRound',
    label: 'Round Petal',
    defaultName: 'RoundPetal',
    category: 'petal',
    defaultSize: [0.46, 0.16, 0.62],
    defaultColor: '#F472B6',
    defaultPattern: 'gradientTip',
    defaultAccentColor: '#FDE68A',
    defaultTipColor: '#FBCFE8',
    defaultDroop: -0.18,
    defaultCup: 0.44,
    defaultRuffle: 0.1,
    hint: 'Soft cupped rose/buttercup petal',
  },
  {
    id: 'petalPointed',
    label: 'Pointed Petal',
    defaultName: 'PointedPetal',
    category: 'petal',
    defaultSize: [0.34, 0.2, 0.72],
    defaultColor: '#FB7185',
    defaultPattern: 'striped',
    defaultAccentColor: '#FEF08A',
    defaultTipColor: '#FFF1F2',
    defaultDroop: 0.14,
    defaultCup: 0.35,
    defaultRuffle: 0.08,
    hint: 'Graceful lily & tulip petal with recurved pointed tip',
  },
  {
    id: 'petalRuffled',
    label: 'Ruffled Petal',
    defaultName: 'RuffledPetal',
    category: 'petal',
    defaultSize: [0.56, 0.2, 0.68],
    defaultColor: '#C084FC',
    defaultPattern: 'veins',
    defaultAccentColor: '#FDE047',
    defaultTipColor: '#F5D0FE',
    defaultDroop: 0.08,
    defaultCup: 0.28,
    defaultRuffle: 0.62,
    hint: 'Poppy & hibiscus petal with delicate frilled margin',
  },
  {
    id: 'petalOrchid',
    label: 'Orchid Wing',
    defaultName: 'OrchidPetal',
    category: 'petal',
    defaultSize: [0.52, 0.22, 0.72],
    defaultColor: '#A855F7',
    defaultPattern: 'spotted',
    defaultAccentColor: '#FDE047',
    defaultTipColor: '#FCE7F3',
    defaultDroop: 0.2,
    defaultCup: 0.38,
    defaultRuffle: 0.32,
    defaultAsymSkew: 0.45,
    hint: 'Asymmetrical sculpted orchid petal with pinched throat',
  },
  {
    id: 'flowerCenter',
    label: 'Flower Stamen Core',
    defaultName: 'FlowerCore',
    category: 'petal',
    defaultSize: [0.38, 0.24, 0.38],
    defaultColor: '#F59E0B',
    defaultPattern: 'spotted',
    defaultAccentColor: '#FEF08A',
    defaultTipColor: '#F97316',
    defaultDroop: 0,
    defaultCup: 0.3,
    defaultRuffle: 0,
    hint: 'Pollen cushion dome ringed with stamen filaments',
  },

  // --- STEMS & BUDS ---
  {
    id: 'stemCurved',
    label: 'Curved Stem',
    defaultName: 'CurvedStem',
    category: 'stem',
    defaultSize: [0.14, 1.15, 0.14],
    defaultColor: '#3B7A3E',
    defaultPattern: 'solid',
    defaultAccentColor: '#76B958',
    defaultTipColor: '#569E4B',
    defaultDroop: 0.22,
    defaultCup: 0,
    defaultRuffle: 0.06,
    hint: 'Organic tapered stalk with subtle flex & growth nodes',
  },
  {
    id: 'bulbCorm',
    label: 'Corm / Bud Base',
    defaultName: 'PlantBulb',
    category: 'stem',
    defaultSize: [0.52, 0.56, 0.52],
    defaultColor: '#4D7C3F',
    defaultPattern: 'striped',
    defaultAccentColor: '#92C264',
    defaultTipColor: '#7AB356',
    defaultDroop: 0,
    defaultCup: 0.15,
    defaultRuffle: 0.1,
    hint: 'Fluted teardrop bulb / rosette heart base',
  },
  {
    id: 'vineTendril',
    label: 'Curly Tendril',
    defaultName: 'CurlyTendril',
    category: 'stem',
    defaultSize: [0.38, 0.95, 0.38],
    defaultColor: '#4ADE80',
    defaultPattern: 'gradientTip',
    defaultAccentColor: '#A3E635',
    defaultTipColor: '#D9F99D',
    defaultDroop: 0.15,
    defaultCup: 0,
    defaultRuffle: 0.2,
    hint: 'Corkscrew curling climbing vine shoot',
  },

  // --- FANTASY PLANTS ---
  {
    id: 'fantasyBell',
    label: 'Lantern Bell Pod',
    defaultName: 'LanternBell',
    category: 'fantasy',
    defaultSize: [0.56, 0.72, 0.56],
    defaultColor: '#38BDF8',
    defaultPattern: 'bioluminescent',
    defaultAccentColor: '#A5F3FC',
    defaultTipColor: '#E0F2FE',
    defaultDroop: 0,
    defaultCup: 0.4,
    defaultRuffle: 0.35,
    defaultEmissiveIntensity: 0.55,
    hint: 'Glowing fairybell skirt pod with scalloped petal rim',
  },
  {
    id: 'fantasyMushroom',
    label: 'Toadstool Cap',
    defaultName: 'ToadstoolCap',
    category: 'fantasy',
    defaultSize: [0.78, 0.42, 0.78],
    defaultColor: '#EC4899',
    defaultPattern: 'spotted',
    defaultAccentColor: '#FFFBEB',
    defaultTipColor: '#FDE68A',
    defaultDroop: 0.2,
    defaultCup: 0.25,
    defaultRuffle: 0.28,
    defaultEmissiveIntensity: 0.25,
    hint: 'Wavy-rimmed fantasy fungal cap with glowing spots',
  },
  {
    id: 'fantasySpiralRibbon',
    label: 'Helix Ribbon Frond',
    defaultName: 'HelixRibbon',
    category: 'fantasy',
    defaultSize: [0.38, 0.35, 1.45],
    defaultColor: '#2DD4BF',
    defaultPattern: 'bioluminescent',
    defaultAccentColor: '#F0ABFC',
    defaultTipColor: '#67E8F9',
    defaultDroop: 0.18,
    defaultCup: 0.2,
    defaultRuffle: 0.45,
    defaultEmissiveIntensity: 0.6,
    hint: 'Twisting alien kelp & bioluminescent ribbon tendril',
  },
  {
    id: 'fantasySporeOrb',
    label: 'Dew Spore Cluster',
    defaultName: 'SporeOrb',
    category: 'fantasy',
    defaultSize: [0.46, 0.46, 0.46],
    defaultColor: '#818CF8',
    defaultPattern: 'bioluminescent',
    defaultAccentColor: '#FDE047',
    defaultTipColor: '#C4B5FD',
    defaultDroop: 0,
    defaultCup: 0,
    defaultRuffle: 0.2,
    defaultEmissiveIntensity: 0.65,
    hint: 'Glowing dew-berry & floating magic spore cluster',
  },
  {
    id: 'fantasyTrumpet',
    label: 'Star Trumpet Bloom',
    defaultName: 'StarTrumpet',
    category: 'fantasy',
    defaultSize: [0.68, 0.78, 0.68],
    defaultColor: '#A855F7',
    defaultPattern: 'gradientTip',
    defaultAccentColor: '#22D3EE',
    defaultTipColor: '#F0ABFC',
    defaultDroop: 0,
    defaultCup: 0.3,
    defaultRuffle: 0.4,
    defaultEmissiveIntensity: 0.45,
    hint: '5-pointed star trumpet pitcher blossom',
  },
];

export const PLANT_PATTERN_OPTIONS: {
  id: PlantLeafPatternId;
  label: string;
  blurb: string;
}[] = [
  { id: 'solid', label: 'Natural', blurb: 'Soft chlorophyll grain' },
  { id: 'veins', label: 'Veined', blurb: 'Midrib & arched pinnate veins' },
  { id: 'ribs', label: 'Ribbed', blurb: 'Deep pleated parallel ribs' },
  { id: 'variegated', label: 'Variegated', blurb: 'Creamy marbled jungle splashes' },
  { id: 'spotted', label: 'Spotted', blurb: 'Freckles & toadstool spots' },
  { id: 'striped', label: 'Striped', blurb: 'Chevron / tiger stripes' },
  { id: 'gradientTip', label: 'Tip Fade', blurb: 'Ombré blush to tips' },
  { id: 'bioluminescent', label: 'Bio-Glow', blurb: 'Luminous fantasy veins & specks' },
];

export interface PlantColorPalette {
  id: string;
  label: string;
  base: string;
  accent: string;
  tip: string;
  emissive?: string;
}

export const PLANT_COLOR_PALETTES: PlantColorPalette[] = [
  { id: 'tropical', label: 'Tropical', base: '#247A44', accent: '#8BE57B', tip: '#B7F06B' },
  { id: 'oliveSage', label: 'Sage Mist', base: '#4E7C64', accent: '#B4D6BE', tip: '#D6E8CA' },
  { id: 'autumn', label: 'Autumn', base: '#B44522', accent: '#F59E0B', tip: '#FDE047' },
  { id: 'sakura', label: 'Sakura', base: '#F472B6', accent: '#FEF08A', tip: '#FFF1F2' },
  { id: 'sunflower', label: 'Sunburst', base: '#EAB308', accent: '#78350F', tip: '#FEF9C3' },
  { id: 'orchid', label: 'Orchid', base: '#9333EA', accent: '#FDE047', tip: '#F5D0FE' },
  {
    id: 'fairyBio',
    label: 'Abyssal Glow',
    base: '#0E7490',
    accent: '#67E8F9',
    tip: '#E0F2FE',
    emissive: '#38BDF8',
  },
  {
    id: 'neonFungi',
    label: 'Fey Neon',
    base: '#BE185D',
    accent: '#F9A8D4',
    tip: '#A5F3FC',
    emissive: '#F472B6',
  },
];

const PLANT_SHAPE_ID_SET = new Set<string>(PLANT_SHAPE_CATALOG.map((p) => p.id));

export function isPlantShape(shape: string): shape is PlantShapeId {
  return PLANT_SHAPE_ID_SET.has(shape);
}

export function getPlantShapeMeta(shape: PlantShapeId): PlantShapeMeta {
  return PLANT_SHAPE_CATALOG.find((s) => s.id === shape) ?? PLANT_SHAPE_CATALOG[0];
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function createDefaultPlantPartSpec(
  shape: PlantShapeId,
  overrides: Partial<ObjectPartSpec> = {}
): ObjectPartSpec {
  const meta = getPlantShapeMeta(shape);
  const dims: [number, number, number] = overrides.dimensions
    ? ([...overrides.dimensions] as [number, number, number])
    : ([...meta.defaultSize] as [number, number, number]);

  const isGroundAnchoredStem =
    shape === 'stemCurved' || shape === 'bulbCorm' || shape === 'vineTendril';
  const defaultPos: [number, number, number] =
    overrides.position ?? [0, isGroundAnchoredStem ? 0 : 0.12, 0];

  const defaultPlant: PlantPartConfig = {
    pattern: meta.defaultPattern,
    accentColor: meta.defaultAccentColor,
    tipColor: meta.defaultTipColor,
    emissiveColor:
      (meta.defaultEmissiveIntensity ?? 0) > 0 ? meta.defaultAccentColor : '#000000',
    emissiveIntensity: meta.defaultEmissiveIntensity ?? 0,
    droop: meta.defaultDroop,
    cup: meta.defaultCup,
    ruffle: meta.defaultRuffle,
    twist: 0,
    asymSkew: meta.defaultAsymSkew ?? 0,
    tatter: 0,
    veinDepth: 0.45,
    doubleSided: meta.category === 'leaf' || meta.category === 'petal' || shape === 'fantasySpiralRibbon',
  };

  return {
    id: overrides.id ?? uid(),
    name: overrides.name ?? `${meta.defaultName}_${Math.floor(Math.random() * 90 + 10)}`,
    parentGroupId: overrides.parentGroupId ?? null,
    shape,
    position: defaultPos,
    rotation: overrides.rotation ?? [0, 0, 0],
    dimensions: dims,
    modifiers: {
      bevel: 0.08,
      chamfer: 0,
      roundness: 0.2,
      edgeWear: 0,
      segments: 16,
      ...(overrides.modifiers ?? {}),
    },
    material: {
      color: meta.defaultColor,
      roughness: meta.category === 'petal' ? 0.56 : 0.44,
      metalness: 0.02,
      weathering: 'none',
      weatheringIntensity: 0.35,
      ...(overrides.material ?? {}),
    },
    plantParams: {
      ...defaultPlant,
      ...(overrides.plantParams ?? {}),
    },
    hidden: overrides.hidden,
    isCutter: false,
  };
}

function shiftHexColor(hex: string, hueDegDelta: number, lightDelta: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  const nextH = ((hsl.h + hueDegDelta / 360) % 1 + 1) % 1;
  const nextL = THREE.MathUtils.clamp(hsl.l + lightDelta, 0.1, 0.92);
  const out = new THREE.Color().setHSL(nextH, hsl.s, nextL);
  return `#${out.getHexString()}`;
}

/**
 * Generates an organic fanned rosette, radial flower head, or random-from-center cluster
 * with strict 1..20 part count control and symmetrical vs asymmetrical modes.
 */
export function buildPlantClusterParts(
  recipe: PlantClusterRecipe,
  groupId: string
): ObjectPartSpec[] {
  const count = Math.max(1, Math.min(20, Math.round(recipe.count)));
  const rand = mulberry32(recipe.seed + 17);
  const meta = getPlantShapeMeta(recipe.shape);
  const parts: ObjectPartSpec[] = [];

  if (recipe.includeFlowerCore) {
    parts.push(
      createDefaultPlantPartSpec('flowerCenter', {
        parentGroupId: groupId,
        name: 'Flower_Center_Core',
        position: [0, 0.02, 0],
        rotation: [0, 0, 0],
        dimensions: [
          Math.max(0.18, recipe.baseDimensions[0] * 0.62),
          Math.max(0.14, recipe.baseDimensions[0] * 0.36),
          Math.max(0.18, recipe.baseDimensions[0] * 0.62),
        ],
        material: {
          color: recipe.coreColor || '#F59E0B',
          roughness: 0.68,
          metalness: 0.02,
          weathering: 'none',
          weatheringIntensity: 0,
        },
      })
    );
  }

  const tiers = Math.max(1, Math.min(3, Math.round(recipe.tierLayers || 1)));
  const randomAmt = recipe.symmetrical ? recipe.randomness * 0.08 : Math.max(0.15, recipe.randomness);
  const arcRad = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(recipe.arcSpanDeg, 45, 360));
  const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // 137.508 deg phyllotaxis

  for (let i = 0; i < count; i++) {
    const tier = tiers === 1 ? 0 : i % tiers;
    const tierFrac = tiers === 1 ? 0 : tier / (tiers - 1);

    // Compute radial azimuth angle around center
    let yawRad: number;
    if (recipe.layout === 'spiral') {
      yawRad = i * goldenAngle + (rand() - 0.5) * randomAmt * 0.45;
    } else if (recipe.layout === 'randomCenter') {
      const baseAngle = (i / Math.max(1, count)) * arcRad;
      yawRad = baseAngle + (rand() - 0.5) * (arcRad / Math.max(2, count * 0.6)) * (0.4 + randomAmt * 1.4);
    } else {
      // 'fan': evenly distributed around arcSpan, shifted slightly per tier
      const denom = arcRad >= Math.PI * 1.98 ? count : Math.max(1, count - 1);
      const frac = count === 1 ? 0.5 : i / denom;
      const tierOffset = tiers > 1 ? (tier * Math.PI) / Math.max(2, count) : 0;
      const centeredFrac = arcRad >= Math.PI * 1.98 ? frac : frac - 0.5;
      yawRad = centeredFrac * arcRad + tierOffset + (rand() - 0.5) * randomAmt * 0.34;
    }

    // Fan tilt upward vs outward (negative rotX in Three.js tilts +Z blade upward toward +Y!)
    const baseTiltDeg = 90 - THREE.MathUtils.clamp(recipe.fanAngleDeg, 8, 86);
    const tierPitchShift = tiers > 1 ? (0.5 - tierFrac) * 18 : 0;
    const jitterPitch = (rand() - 0.5) * randomAmt * 26;
    const pitchDeg = -(baseTiltDeg + tierPitchShift + jitterPitch);
    const rollDeg = (rand() - 0.5) * randomAmt * 24;

    // Radial offset from center
    const radialSpread =
      recipe.centerRadius *
      (recipe.layout === 'randomCenter'
        ? 0.25 + rand() * 0.95
        : tiers > 1
        ? 0.55 + tierFrac * 0.55
        : 1.0);
    const px = Math.sin(yawRad) * radialSpread;
    const pz = Math.cos(yawRad) * radialSpread;
    const py =
      tiers > 1
        ? (1 - tierFrac) * 0.08 + (rand() - 0.5) * randomAmt * 0.1
        : (rand() - 0.5) * randomAmt * 0.06;

    // Per-leaf/petal scale & asymmetry
    const sRange = recipe.maxScale - recipe.minScale;
    const tierScale = tiers > 1 ? 1 - (1 - tierFrac) * 0.22 : 1;
    const uniformRand = recipe.symmetrical
      ? (recipe.minScale + recipe.maxScale) * 0.5 + (rand() - 0.5) * randomAmt * 0.12
      : recipe.minScale + rand() * Math.max(0.05, sRange);
    const wJitter = 1 + (rand() - 0.5) * randomAmt * 0.36;
    const lJitter = 1 + (rand() - 0.5) * randomAmt * 0.32;

    const dims: [number, number, number] = [
      Number(Math.max(0.08, recipe.baseDimensions[0] * uniformRand * tierScale * wJitter).toFixed(3)),
      Number(Math.max(0.06, recipe.baseDimensions[1] * uniformRand * tierScale).toFixed(3)),
      Number(Math.max(0.12, recipe.baseDimensions[2] * uniformRand * tierScale * lJitter).toFixed(3)),
    ];

    const hueShiftDeg = (rand() - 0.5) * randomAmt * 18;
    const lightShift = (rand() - 0.5) * randomAmt * 0.1;
    const partColor =
      randomAmt > 0.04 ? shiftHexColor(recipe.baseColor, hueShiftDeg, lightShift) : recipe.baseColor;

    const asymSign = recipe.symmetrical
      ? 0
      : ((rand() - 0.5) * 0.8 + (recipe.basePlant.asymSkew ?? 0));

    parts.push(
      createDefaultPlantPartSpec(recipe.shape, {
        parentGroupId: groupId,
        name: `${meta.defaultName}_${i + 1}`,
        position: [Number(px.toFixed(3)), Number(py.toFixed(3)), Number(pz.toFixed(3))],
        rotation: [
          Number(pitchDeg.toFixed(1)),
          Number(THREE.MathUtils.radToDeg(yawRad).toFixed(1)),
          Number(rollDeg.toFixed(1)),
        ],
        dimensions: dims,
        material: {
          color: partColor,
          roughness: meta.category === 'petal' ? 0.54 : 0.42,
          metalness: 0.02,
          weathering: 'none',
          weatheringIntensity: 0.3,
        },
        plantParams: {
          ...recipe.basePlant,
          droop: THREE.MathUtils.clamp(
            (recipe.basePlant.droop ?? meta.defaultDroop) + (rand() - 0.5) * randomAmt * 0.28,
            -1,
            1
          ),
          twist: THREE.MathUtils.clamp(
            (recipe.basePlant.twist ?? 0) + (rand() - 0.5) * randomAmt * 0.45,
            -1,
            1
          ),
          asymSkew: THREE.MathUtils.clamp(asymSign, -1, 1),
        },
      })
    );
  }

  return parts;
}

export function createClusterGroupAndParts(
  recipe: PlantClusterRecipe,
  groupName: string
): { group: ObjectGroupSpec; parts: ObjectPartSpec[] } {
  const groupId = uid();
  const group: ObjectGroupSpec = {
    id: groupId,
    name: groupName,
    parentGroupId: null,
    position: [0, recipe.hubHeight, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    plantCluster: {
      ...recipe,
      baseDimensions: [...recipe.baseDimensions] as [number, number, number],
      basePlant: { ...recipe.basePlant },
    },
  };
  const parts = buildPlantClusterParts(recipe, groupId);
  return { group, parts };
}

// ---------------------------------------------------------------------------
// PARAMETRIC ORGANIC 3D LEAF, PETAL, STEM & FANTASY GEOMETRY BUILDERS
// ---------------------------------------------------------------------------

function leafHalfWidthAt(
  shape: PlantShapeId,
  t: number,
  uSign: number,
  asymSkew: number,
  tatter: number,
  seed: number
): number {
  const s = THREE.MathUtils.clamp(t, 0, 1);
  let w = 0;

  switch (shape) {
    case 'leafBanana': {
      // Short collar stem at base, broad rectangular-oval middle, blunt rounded apex
      const baseFlare = THREE.MathUtils.smoothstep(s, 0.03, 0.24);
      const tipRound = 1 - Math.pow(THREE.MathUtils.smoothstep(s, 0.72, 1.0), 1.6);
      w = (0.14 + 0.86 * baseFlare) * tipRound;
      // Natural banana wind-splits along blade when tatter > 0
      if (tatter > 0.03 && s > 0.18 && s < 0.9) {
        const splitPos = uSign > 0 ? 0.42 : 0.64;
        const dist = Math.abs(s - splitPos);
        if (dist < 0.045) {
          w *= 1 - tatter * 0.72 * (1 - dist / 0.045);
        }
      }
      break;
    }

    case 'leafElephantEar': {
      // Prominent broad basal cordate lobes curving wide around t=0.22..0.42, sharp tip
      const lobe = Math.sin(Math.pow(s, 0.68) * Math.PI);
      const ear = Math.exp(-Math.pow((s - 0.16) / 0.16, 2)) * 0.26;
      const tipTaper = 1 - Math.pow(s, 2.3);
      w = (lobe * 0.86 + ear) * (0.25 + 0.75 * tipTaper);
      // Slight wavy scalloping along edge
      w *= 1 + 0.045 * Math.sin(s * Math.PI * 10);
      break;
    }

    case 'leafTeardrop': {
      // Full rounded base swell at ~0.3, slender tapering drip-tip at 1.0
      w = Math.pow(Math.sin(Math.pow(s, 0.64) * Math.PI), 0.85) * (1 - 0.22 * s);
      break;
    }

    case 'leafBlade': {
      // Narrow arching sword / grass blade tapering finely from base
      w = (0.85 * Math.sin(Math.pow(s, 0.48) * Math.PI * 0.96) + 0.15 * (1 - s)) * (1 - Math.pow(s, 2.6));
      break;
    }

    case 'leafMonstera': {
      // Broad tropical heart leaf with 3 dramatic fenestration notches per side
      let baseProfile = Math.sin(Math.pow(s, 0.65) * Math.PI) * (0.94 + 0.14 * (1 - s));
      const slits = uSign > 0 ? [0.34, 0.56, 0.76] : [0.27, 0.49, 0.71];
      for (const sp of slits) {
        const d = Math.abs(s - sp);
        if (d < 0.055) {
          const cut = 1 - Math.pow(Math.cos((d / 0.055) * (Math.PI / 2)), 0.8);
          baseProfile *= 0.34 + 0.66 * cut;
        }
      }
      w = baseProfile;
      break;
    }

    case 'leafFern': {
      // Feather frond with rhythmic pinnae lobes tapering along rachis
      const env = Math.sin(Math.pow(s, 0.58) * Math.PI);
      const pinnae = 0.28 + 0.72 * Math.pow(Math.abs(Math.sin(s * Math.PI * 9.5)), 0.52);
      w = s < 0.08 ? 0.12 : env * pinnae;
      break;
    }

    case 'leafLotus': {
      // Circular lily pad anchored near center-notch extending forward
      const circ = Math.sin(Math.pow(s, 0.75) * Math.PI);
      w = Math.max(0.08, circ);
      break;
    }

    case 'leafHeartVine': {
      // Wide rounded shoulder near base, graceful pointed heart tip
      const shoulder = Math.exp(-Math.pow((s - 0.22) / 0.2, 2)) * 0.45;
      w = (Math.sin(Math.pow(s, 0.55) * Math.PI) * 0.85 + shoulder) * (1 - Math.pow(s, 3.2) * 0.6);
      break;
    }

    case 'petalRound': {
      // Narrow claw at t=0 swelling to wide rounded obovate apex around t=0.68
      const obovate = Math.sin(Math.pow(s, 1.38) * Math.PI);
      w = Math.max(0.06, 0.16 * (1 - s) + obovate * 0.96);
      break;
    }

    case 'petalPointed': {
      // Elliptical swell at middle tapering to sharp point
      w = 0.12 * (1 - s) + Math.pow(Math.sin(s * Math.PI), 0.78) * 0.92;
      break;
    }

    case 'petalRuffled': {
      // Broad fan-like poppy/hibiscus petal
      w = 0.14 * (1 - s) + Math.sin(Math.pow(s, 1.55) * Math.PI) * 1.05;
      break;
    }

    case 'petalOrchid': {
      // Pinched waist at t=0.35 + asymmetrical flared side lobes
      const waist = 1 - 0.42 * Math.exp(-Math.pow((s - 0.34) / 0.14, 2));
      const flare = Math.sin(Math.pow(s, 1.2) * Math.PI) * waist;
      const sideBias = 1 + uSign * asymSkew * 0.34 * s;
      w = Math.max(0.08, flare * sideBias);
      break;
    }

    case 'fantasySpiralRibbon': {
      // Wavy serrated alien ribbon blade
      w = (0.2 + 0.8 * Math.sin(Math.pow(s, 0.7) * Math.PI)) * (1 + 0.22 * Math.sin(s * Math.PI * 7));
      break;
    }

    default: {
      w = Math.sin(s * Math.PI);
      break;
    }
  }

  // Asymmetric left/right width & natural tatter bite notches
  const asymFactor = 1 + uSign * asymSkew * 0.26 * Math.sin(s * Math.PI);
  let bite = 1;
  if (tatter > 0.04 && s > 0.22 && s < 0.92) {
    const p = ((seed % 37) / 37) * 0.45 + 0.32;
    const bd = Math.abs(s - p);
    if (bd < 0.06 && uSign * ((seed % 2) * 2 - 1) > 0) {
      bite = 1 - tatter * 0.45 * (1 - bd / 0.06);
    }
  }
  return Math.max(0.015, w * asymFactor * bite);
}

function buildOrganicSheetGeometry(
  shape: PlantShapeId,
  dims: [number, number, number],
  plant: PlantPartConfig,
  seed: number
): THREE.BufferGeometry {
  const w = Math.max(0.08, dims[0]);
  const h = Math.max(0.04, dims[1]);
  const d = Math.max(0.1, dims[2]);

  const uSegs = 14;
  const vSegs = shape === 'leafFern' || shape === 'leafMonstera' || shape === 'fantasySpiralRibbon' ? 28 : 20;

  const droop = plant.droop ?? 0.3;
  const cup = plant.cup ?? 0.3;
  const ruffle = plant.ruffle ?? 0.1;
  const twist = plant.twist ?? 0;
  const asymSkew = plant.asymSkew ?? 0;
  const tatter = plant.tatter ?? 0;
  const veinDepth = plant.veinDepth ?? 0.45;

  const cols = uSegs + 1;
  const rows = vSegs + 1;
  const positions = new Float32Array(cols * rows * 3);
  const uvs = new Float32Array(cols * rows * 2);
  const indices: number[] = [];

  const isHeartBase = shape === 'leafElephantEar' || shape === 'leafHeartVine' || shape === 'leafLotus';

  for (let iy = 0; iy < rows; iy++) {
    const t = iy / vSegs; // 0 = stem attachment base, 1 = tip
    for (let ix = 0; ix < cols; ix++) {
      const u = (ix / uSegs) * 2 - 1; // -1 left edge .. +1 right edge
      const absU = Math.abs(u);
      const uSign = u < 0 ? -1 : 1;

      const halfW = leafHalfWidthAt(shape, t, uSign, asymSkew, tatter, seed);
      let px = u * halfW * (w * 0.5) + asymSkew * 0.08 * w * Math.sin(t * Math.PI);
      let pz = t * d;

      // Cordate/heart basal lobes tuck slightly behind stem anchor at base
      if (isHeartBase && t < 0.25) {
        const lobeBack = (1 - t / 0.25) * Math.sin(absU * Math.PI * 0.85) * d * 0.16;
        pz -= lobeBack;
      }

      // Vertical spine arch + droop (starts near 0 at stem, arches gently, then droops or cups up)
      const archLift = Math.sin(t * Math.PI * 0.72) * h * 0.65;
      const tipDroop = -Math.pow(t, 1.85) * droop * h * 1.45;
      let py = archLift + tipDroop;

      // Midrib V-fold / spoon cup across width (absU^1.5)
      if (shape === 'petalRound' || shape === 'petalPointed' || shape === 'leafLotus') {
        // Soft bowl spoon cupping
        py += Math.pow(absU, 1.8) * cup * h * 0.72 * Math.sin(t * Math.PI);
      } else {
        // V-shaped leaf crease with subtle arched shoulder fold
        const crease = absU * cup * h * 0.58 * (1 - 0.35 * t);
        const midribGroove = -Math.exp(-Math.pow(absU / 0.14, 2)) * 0.016 * (0.4 + veinDepth);
        py += crease + midribGroove;
      }

      // Parallel leaf rib pleats (banana/palm corrugation)
      if ((shape === 'leafBanana' || shape === 'leafElephantEar') && veinDepth > 0.05) {
        const rib = Math.sin(t * Math.PI * 16 - absU * 2.4) * 0.012 * veinDepth * (1 - absU * 0.3);
        py += rib * Math.sin(t * Math.PI);
      }

      // Edge ruffle / frill wave near margin
      if (ruffle > 0.02) {
        const freq = shape === 'petalRuffled' ? 5.5 : 4.0;
        const edgeMask = Math.pow(absU, 1.4) * Math.sin(t * Math.PI * 0.92);
        const wave = Math.sin(t * Math.PI * freq + u * 2.5 + seed * 0.13) * ruffle * h * 0.42 * edgeMask;
        py += wave;
      }

      // Helix torsion / organic twist around spine axis
      const totalTwist =
        (shape === 'fantasySpiralRibbon' ? 2.4 + twist * 1.5 : twist * 0.85) * t;
      if (Math.abs(totalTwist) > 0.005) {
        const ct = Math.cos(totalTwist);
        const st = Math.sin(totalTwist);
        const rx = px * ct - py * st;
        const ry = px * st + py * ct;
        px = rx;
        py = ry;
      }

      // Extra corkscrew lateral sway for fantasy spiral ribbon
      if (shape === 'fantasySpiralRibbon') {
        px += Math.sin(t * Math.PI * 3.0) * w * 0.32 * t;
      }

      const vIdx = iy * cols + ix;
      positions[vIdx * 3] = px;
      positions[vIdx * 3 + 1] = py;
      positions[vIdx * 3 + 2] = pz;

      uvs[vIdx * 2] = (u + 1) * 0.5;
      uvs[vIdx * 2 + 1] = t;
    }
  }

  for (let iy = 0; iy < vSegs; iy++) {
    for (let ix = 0; ix < uSegs; ix++) {
      const a = iy * cols + ix;
      const b = a + 1;
      const c = a + cols;
      const dIdx = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, dIdx);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildFlowerCoreGeometry(dims: [number, number, number]): THREE.BufferGeometry {
  const rx = Math.max(0.06, dims[0] * 0.5);
  const ry = Math.max(0.05, dims[1]);
  const rz = Math.max(0.06, dims[2] * 0.5);

  const parts: THREE.BufferGeometry[] = [];
  // Plump cushion dome with organic seed dimples
  const dome = new THREE.SphereGeometry(1, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62);
  const pos = dome.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const bump = 1 + 0.08 * Math.sin(x * 11 + z * 9) * Math.cos(y * 8);
    pos.setXYZ(i, x * rx * bump, y * ry * 0.85 * bump, z * rz * bump);
  }
  dome.computeVertexNormals();
  parts.push(dome.toNonIndexed());

  // Ring of 10 delicate stamen filaments + anther tips
  const stamenCount = 10;
  for (let i = 0; i < stamenCount; i++) {
    const ang = (i / stamenCount) * Math.PI * 2;
    const tilt = 0.42 + (i % 2) * 0.14;
    const filLen = Math.max(rx, ry) * 0.92;
    const fil = new THREE.CylinderGeometry(rx * 0.04, rx * 0.065, filLen, 6);
    fil.translate(0, filLen * 0.5, 0);
    fil.rotateZ(-tilt);
    fil.rotateY(ang);
    fil.translate(Math.cos(ang) * rx * 0.58, ry * 0.28, -Math.sin(ang) * rz * 0.58);
    parts.push(fil.toNonIndexed());

    const bud = new THREE.SphereGeometry(rx * 0.11, 8, 6);
    bud.scale(1.1, 0.75, 0.9);
    const tipDist = rx * 0.58 + Math.sin(tilt) * filLen;
    const tipY = ry * 0.28 + Math.cos(tilt) * filLen;
    bud.translate(Math.cos(ang) * tipDist, tipY, -Math.sin(ang) * tipDist * (rz / rx));
    parts.push(bud.toNonIndexed());
  }

  const merged = BufferGeometryUtils.mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  dome.dispose();
  if (!merged) return new THREE.SphereGeometry(rx, 16, 12);
  merged.computeVertexNormals();
  return merged;
}

function buildStemGeometry(
  dims: [number, number, number],
  plant: PlantPartConfig,
  seed: number
): THREE.BufferGeometry {
  const r = Math.max(0.025, Math.min(dims[0], dims[2]) * 0.5);
  const h = Math.max(0.15, dims[1]);
  const droop = plant.droop ?? 0.2;
  const twist = plant.twist ?? 0;

  const bendX = droop * h * 0.28;
  const bendZ = twist * h * 0.22;
  const pts = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(bendX * 0.25, h * 0.34, bendZ * 0.2),
    new THREE.Vector3(bendX * 0.75, h * 0.68, -bendZ * 0.35),
    new THREE.Vector3(bendX, h, bendZ * 0.45),
  ];
  const curve = new THREE.CatmullRomCurve3(pts);
  const tubularSegs = 18;
  const radialSegs = 10;
  const geo = new THREE.TubeGeometry(curve, tubularSegs, r, radialSegs, false);

  // Taper radius smoothly from sturdy base collar (1.3x) to slender top tip (0.55x) + subtle growth nodes
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const ringVerts = radialSegs + 1;
  for (let s = 0; s <= tubularSegs; s++) {
    const t = s / tubularSegs;
    const center = curve.getPointAt(t);
    const baseBulge = t < 0.14 ? 1 + (1 - t / 0.14) * 0.35 : 1;
    const nodeBump = 1 + 0.08 * Math.sin(t * Math.PI * 5 + (seed % 7));
    const scaleR = THREE.MathUtils.lerp(1.15, 0.52, t) * baseBulge * nodeBump;
    for (let j = 0; j < ringVerts; j++) {
      const idx = s * ringVerts + j;
      if (idx >= pos.count) continue;
      const vx = pos.getX(idx) - center.x;
      const vy = pos.getY(idx) - center.y;
      const vz = pos.getZ(idx) - center.z;
      pos.setXYZ(idx, center.x + vx * scaleR, center.y + vy * scaleR, center.z + vz * scaleR);
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function buildTendrilGeometry(
  dims: [number, number, number],
  plant: PlantPartConfig
): THREE.BufferGeometry {
  const radius = Math.max(0.08, Math.min(dims[0], dims[2]) * 0.42);
  const h = Math.max(0.2, dims[1]);
  const turns = 2.4 + (plant.ruffle ?? 0.2) * 2.0;
  const tubeR = Math.max(0.018, radius * 0.16);

  const pts: THREE.Vector3[] = [];
  const steps = 28;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const ang = t * Math.PI * 2 * turns;
    const r = radius * Math.sin(t * Math.PI * 0.82 + 0.18) * (1 - t * 0.35);
    pts.push(new THREE.Vector3(Math.cos(ang) * r, t * h, Math.sin(ang) * r));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, 36, tubeR, 8, false);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let s = 0; s <= 36; s++) {
    const t = s / 36;
    const center = curve.getPointAt(t);
    const taper = THREE.MathUtils.lerp(1.15, 0.24, t);
    for (let j = 0; j < 9; j++) {
      const idx = s * 9 + j;
      if (idx >= pos.count) continue;
      pos.setXYZ(
        idx,
        center.x + (pos.getX(idx) - center.x) * taper,
        center.y + (pos.getY(idx) - center.y) * taper,
        center.z + (pos.getZ(idx) - center.z) * taper
      );
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function buildCormBulbGeometry(dims: [number, number, number], plant: PlantPartConfig): THREE.BufferGeometry {
  const rx = Math.max(0.08, dims[0] * 0.5);
  const h = Math.max(0.12, dims[1]);
  const rz = Math.max(0.08, dims[2] * 0.5);

  const pts: THREE.Vector2[] = [];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r =
      t === 0 || t === 1
        ? 0.001
        : Math.sin(Math.pow(t, 0.65) * Math.PI) * (1 + 0.14 * (1 - t));
    pts.push(new THREE.Vector2(Math.max(0.001, r), t * h));
  }
  const geo = new THREE.LatheGeometry(pts, 20);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const flute = 0.06 + (plant.ruffle ?? 0.1) * 0.1;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ang = Math.atan2(z, x);
    const rib = 1 + flute * Math.cos(ang * 7) * Math.sin((y / h) * Math.PI);
    pos.setXYZ(i, x * rx * rib, y, z * rz * rib);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function buildFantasyBellGeometry(
  dims: [number, number, number],
  plant: PlantPartConfig
): THREE.BufferGeometry {
  const rx = Math.max(0.08, dims[0] * 0.5);
  const h = Math.max(0.15, dims[1]);
  const rz = Math.max(0.08, dims[2] * 0.5);
  const ruffle = plant.ruffle ?? 0.35;

  // Inverted fairybell lantern skirt: narrow top calyx at y=h, bulbous belly, flared scalloped skirt at y=0
  const profile: THREE.Vector2[] = [];
  const steps = 16;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps; // 0 = bottom flared rim, 1 = top stem attachment
    const bell =
      t < 0.25
        ? THREE.MathUtils.lerp(1.0, 0.72, t / 0.25)
        : t < 0.75
        ? 0.72 + Math.sin(((t - 0.25) / 0.5) * Math.PI) * 0.26
        : THREE.MathUtils.lerp(0.72, 0.1, (t - 0.75) / 0.25);
    profile.push(new THREE.Vector2(Math.max(0.02, bell), t * h));
  }
  const skirt = new THREE.LatheGeometry(profile, 24);
  const pos = skirt.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = y / h;
    const ang = Math.atan2(z, x);
    // 5-petal scalloped flare around lower skirt
    const petalWave = (1 - THREE.MathUtils.smoothstep(t, 0, 0.5)) * (0.14 + ruffle * 0.22);
    const scallopR = 1 + petalWave * Math.cos(ang * 5);
    const scallopY = petalWave * h * 0.35 * Math.cos(ang * 5);
    pos.setXYZ(i, x * rx * scallopR, Math.max(0, y + scallopY), z * rz * scallopR);
  }
  skirt.computeVertexNormals();

  // Inner glowing clapper orb suspended inside bell
  const clapper = new THREE.SphereGeometry(Math.min(rx, rz) * 0.24, 12, 10);
  clapper.translate(0, h * 0.22, 0);

  const merged = BufferGeometryUtils.mergeGeometries([skirt.toNonIndexed(), clapper.toNonIndexed()], false);
  skirt.dispose();
  clapper.dispose();
  if (!merged) return new THREE.ConeGeometry(rx, h, 16, 1, true);
  merged.computeVertexNormals();
  return merged;
}

function buildFantasyMushroomGeometry(
  dims: [number, number, number],
  plant: PlantPartConfig
): THREE.BufferGeometry {
  const rx = Math.max(0.1, dims[0] * 0.5);
  const h = Math.max(0.08, dims[1]);
  const rz = Math.max(0.1, dims[2] * 0.5);
  const ruffle = plant.ruffle ?? 0.25;
  const skew = plant.asymSkew ?? 0;

  // Dome cap with wavy organic margin + concave underside
  const profile: THREE.Vector2[] = [];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = Math.sin(t * Math.PI * 0.5) * 1.0;
    const y = Math.cos(t * Math.PI * 0.5) * 0.92 + 0.08 * Math.sin(t * Math.PI);
    profile.push(new THREE.Vector2(Math.max(0.002, r), y * h));
  }
  // Tuck inner underside rim inward slightly
  profile.push(new THREE.Vector2(0.45, h * 0.14));
  profile.push(new THREE.Vector2(0.002, h * 0.22));

  const cap = new THREE.LatheGeometry(profile, 24);
  const pos = cap.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ang = Math.atan2(z, x);
    const rFrac = Math.hypot(x, z);
    const rimWave = rFrac * rFrac * (ruffle * 0.24 * Math.sin(ang * 5 + 0.6) + 0.08 * Math.cos(ang * 3));
    const bump = 1 + 0.08 * Math.sin(ang * 4) * rFrac;
    pos.setXYZ(
      i,
      x * rx * bump + skew * rx * 0.15 * (y / h),
      y + rimWave * h,
      z * rz * bump
    );
  }
  pos.needsUpdate = true;
  cap.computeVertexNormals();
  return cap;
}

function buildFantasySporeOrbGeometry(dims: [number, number, number]): THREE.BufferGeometry {
  const r = Math.max(0.06, Math.min(dims[0], dims[1], dims[2]) * 0.34);
  const cluster: THREE.BufferGeometry[] = [];
  const offsets: [number, number, number, number][] = [
    [0, r * 1.15, 0, 1.0],
    [-r * 0.72, r * 0.62, r * 0.35, 0.7],
    [r * 0.72, r * 0.75, -r * 0.25, 0.65],
    [0.1 * r, r * 0.52, -r * 0.76, 0.58],
    [-r * 0.25, r * 1.65, -0.1 * r, 0.45],
  ];
  for (const [ox, oy, oz, sc] of offsets) {
    const sph = new THREE.SphereGeometry(r * sc, 12, 10);
    sph.scale(dims[0] / Math.max(0.1, dims[1]), 1, dims[2] / Math.max(0.1, dims[1]));
    sph.translate(ox, oy, oz);
    cluster.push(sph.toNonIndexed());
  }
  const merged = BufferGeometryUtils.mergeGeometries(cluster, false);
  cluster.forEach((g) => g.dispose());
  if (!merged) return new THREE.SphereGeometry(r, 14, 10);
  merged.computeVertexNormals();
  return merged;
}

function buildFantasyTrumpetGeometry(
  dims: [number, number, number],
  plant: PlantPartConfig
): THREE.BufferGeometry {
  const rx = Math.max(0.1, dims[0] * 0.5);
  const h = Math.max(0.18, dims[1]);
  const rz = Math.max(0.1, dims[2] * 0.5);
  const ruffle = plant.ruffle ?? 0.38;

  const profile: THREE.Vector2[] = [];
  const steps = 15;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps; // 0 = base throat, 1 = wide flared star mouth
    const flare = 0.14 + Math.pow(t, 2.15) * 0.88;
    profile.push(new THREE.Vector2(flare, t * h));
  }
  const horn = new THREE.LatheGeometry(profile, 25);
  const pos = horn.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = y / h;
    const ang = Math.atan2(z, x);
    // 5-pointed star flare & gentle S-tilt near throat
    const star = 1 + Math.pow(t, 1.5) * (0.2 + ruffle * 0.28) * Math.cos(ang * 5);
    const tiltZ = Math.pow(t, 1.3) * (plant.droop ?? 0.15) * rx * 0.5;
    pos.setXYZ(i, x * rx * star, y, z * rz * star + tiltZ);
  }
  pos.needsUpdate = true;
  horn.computeVertexNormals();
  return horn;
}

export function buildPlantPartGeometry(part: ObjectPartSpec): THREE.BufferGeometry {
  const shape = part.shape as PlantShapeId;
  const dims = part.dimensions;
  const plant: PlantPartConfig = {
    droop: part.plantParams?.droop ?? getPlantShapeMeta(shape).defaultDroop,
    cup: part.plantParams?.cup ?? getPlantShapeMeta(shape).defaultCup,
    ruffle: part.plantParams?.ruffle ?? getPlantShapeMeta(shape).defaultRuffle,
    twist: part.plantParams?.twist ?? 0,
    asymSkew: part.plantParams?.asymSkew ?? getPlantShapeMeta(shape).defaultAsymSkew ?? 0,
    tatter: part.plantParams?.tatter ?? part.modifiers.edgeWear ?? 0,
    veinDepth: part.plantParams?.veinDepth ?? 0.45,
    ...part.plantParams,
  };
  const seed = hashSeed(part.id);

  switch (shape) {
    case 'flowerCenter':
      return buildFlowerCoreGeometry(dims);
    case 'stemCurved':
      return buildStemGeometry(dims, plant, seed);
    case 'vineTendril':
      return buildTendrilGeometry(dims, plant);
    case 'bulbCorm':
      return buildCormBulbGeometry(dims, plant);
    case 'fantasyBell':
      return buildFantasyBellGeometry(dims, plant);
    case 'fantasyMushroom':
      return buildFantasyMushroomGeometry(dims, plant);
    case 'fantasySporeOrb':
      return buildFantasySporeOrbGeometry(dims);
    case 'fantasyTrumpet':
      return buildFantasyTrumpetGeometry(dims, plant);
    default:
      return buildOrganicSheetGeometry(shape, dims, plant, seed);
  }
}

// ---------------------------------------------------------------------------
// PROCEDURAL BOTANICAL PATTERN CANVAS TEXTURES (CACHED)
// ---------------------------------------------------------------------------

const patternTextureCache = new Map<string, { colorMap: THREE.CanvasTexture; emissiveMap?: THREE.CanvasTexture }>();

function getOrCreatePlantPatternMaps(
  pattern: PlantLeafPatternId,
  baseHex: string,
  accentHex: string,
  tipHex: string,
  emissiveHex: string
): { colorMap: THREE.CanvasTexture; emissiveMap?: THREE.CanvasTexture } {
  const key = `${pattern}|${baseHex}|${accentHex}|${tipHex}|${emissiveHex}`;
  const existing = patternTextureCache.get(key);
  if (existing) return existing;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Base gradient fill (UV y=1 is tip -> canvas top when flipY=true, UV y=0 is base -> canvas bottom)
  if (pattern === 'gradientTip' || pattern === 'variegated' || pattern === 'veins') {
    const grad = ctx.createLinearGradient(0, size, 0, 0);
    grad.addColorStop(0, baseHex);
    grad.addColorStop(0.58, baseHex);
    grad.addColorStop(1, tipHex);
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = baseHex;
  }
  ctx.fillRect(0, 0, size, size);

  // Subtle organic chlorophyll speckle noise
  const rand = mulberry32(hashSeed(key));
  ctx.globalAlpha = 0.08;
  for (let i = 0; i < 240; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#FFFFFF' : '#0B1910';
    ctx.beginPath();
    ctx.arc(rand() * size, rand() * size, 1.5 + rand() * 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  let emCanvas: HTMLCanvasElement | null = null;
  let emCtx: CanvasRenderingContext2D | null = null;
  if (pattern === 'bioluminescent') {
    emCanvas = document.createElement('canvas');
    emCanvas.width = size;
    emCanvas.height = size;
    emCtx = emCanvas.getContext('2d')!;
    emCtx.fillStyle = '#000000';
    emCtx.fillRect(0, 0, size, size);
  }

  if (pattern === 'veins' || pattern === 'bioluminescent') {
    const veinColor = pattern === 'bioluminescent' ? accentHex : accentHex;
    const drawVeins = (targetCtx: CanvasRenderingContext2D, stroke: string, glow: boolean) => {
      targetCtx.save();
      targetCtx.strokeStyle = stroke;
      targetCtx.lineCap = 'round';
      // Central midrib
      targetCtx.globalAlpha = glow ? 0.95 : 0.78;
      targetCtx.lineWidth = glow ? 5 : 4;
      targetCtx.beginPath();
      targetCtx.moveTo(size * 0.5, size);
      targetCtx.lineTo(size * 0.5, size * 0.05);
      targetCtx.stroke();

      // Arching pinnate lateral veins
      const pairs = 8;
      for (let i = 0; i < pairs; i++) {
        const yBase = size * (0.88 - i * 0.095);
        const span = size * (0.44 - Math.abs(i - 3) * 0.035);
        targetCtx.lineWidth = glow ? 3.0 : 2.2;
        targetCtx.globalAlpha = glow ? 0.85 : 0.58;
        for (const side of [-1, 1]) {
          targetCtx.beginPath();
          targetCtx.moveTo(size * 0.5, yBase);
          targetCtx.quadraticCurveTo(
            size * 0.5 + side * span * 0.55,
            yBase - size * 0.035,
            size * 0.5 + side * span,
            yBase - size * 0.12
          );
          targetCtx.stroke();
        }
      }
      targetCtx.restore();
    };
    drawVeins(ctx, veinColor, pattern === 'bioluminescent');
    if (emCtx) {
      drawVeins(emCtx, emissiveHex || accentHex, true);
      // Bioluminescent stardust speckles
      emCtx.fillStyle = tipHex;
      for (let i = 0; i < 55; i++) {
        emCtx.globalAlpha = 0.4 + rand() * 0.6;
        emCtx.beginPath();
        emCtx.arc(rand() * size, rand() * size, 1.5 + rand() * 4.5, 0, Math.PI * 2);
        emCtx.fill();
      }
    }
  } else if (pattern === 'ribs') {
    // Deep parallel corrugated banana/palm/fern ribs
    const ribCount = 16;
    for (let i = 0; i < ribCount; i++) {
      const y = (i / ribCount) * size;
      ctx.fillStyle = i % 2 === 0 ? accentHex : '#0B2414';
      ctx.globalAlpha = i % 2 === 0 ? 0.22 : 0.18;
      ctx.fillRect(0, y, size, size / ribCount / 2);
    }
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(size * 0.5, size);
    ctx.lineTo(size * 0.5, 8);
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (pattern === 'variegated') {
    // Creamy marbled botanical patches & edge splashes
    ctx.fillStyle = accentHex;
    for (let i = 0; i < 24; i++) {
      ctx.globalAlpha = 0.35 + rand() * 0.45;
      const rx = 14 + rand() * 34;
      const ry = 8 + rand() * 24;
      const cx = (i % 2 === 0 ? 0.22 : 0.78) * size + (rand() - 0.5) * 70;
      const cy = rand() * size;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((rand() - 0.5) * 1.1);
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  } else if (pattern === 'spotted') {
    // Polka-dots / toadstool spots / orchid freckles
    for (let i = 0; i < 42; i++) {
      const r = 4 + rand() * 14;
      const cx = rand() * size;
      const cy = rand() * size;
      ctx.globalAlpha = 0.78;
      ctx.fillStyle = i % 4 === 0 ? tipHex : accentHex;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else if (pattern === 'striped') {
    // Calathea / tulip chevron & radial stripes
    ctx.strokeStyle = accentHex;
    ctx.lineCap = 'round';
    for (let i = 0; i < 12; i++) {
      const y = size * (0.1 + i * 0.08);
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 6 + rand() * 4;
      ctx.beginPath();
      ctx.moveTo(size * 0.5, y);
      ctx.lineTo(0, y - 34);
      ctx.moveTo(size * 0.5, y);
      ctx.lineTo(size, y - 34);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  const colorMap = new THREE.CanvasTexture(canvas);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.needsUpdate = true;

  let emissiveMap: THREE.CanvasTexture | undefined;
  if (emCanvas) {
    emissiveMap = new THREE.CanvasTexture(emCanvas);
    emissiveMap.colorSpace = THREE.SRGBColorSpace;
    emissiveMap.needsUpdate = true;
  }

  const entry = { colorMap, emissiveMap };
  if (patternTextureCache.size > 160) {
    patternTextureCache.clear();
  }
  patternTextureCache.set(key, entry);
  return entry;
}

const WEATHERING_TINT: Record<WeatheringPreset, { hex: string; roughnessDelta: number }> = {
  none: { hex: '#FFFFFF', roughnessDelta: 0 },
  moss: { hex: '#5A8448', roughnessDelta: 0.08 },
  snow: { hex: '#E6EFF8', roughnessDelta: 0.05 },
  wet: { hex: '#7A8290', roughnessDelta: -0.35 },
  cracked: { hex: '#8A8378', roughnessDelta: 0.1 },
  chipped: { hex: '#B4ABA0', roughnessDelta: 0.1 },
  scorched: { hex: '#3B3430', roughnessDelta: 0.12 },
  muddy: { hex: '#6A5138', roughnessDelta: 0.1 },
  bleached: { hex: '#E8E0D0', roughnessDelta: 0.08 },
  rusted: { hex: '#8C4D30', roughnessDelta: 0.12 },
};

export function createPlantPartMaterial(
  finish: ObjectSurfaceFinish,
  plantParams?: PlantPartConfig
): THREE.MeshStandardMaterial {
  const pattern: PlantLeafPatternId = plantParams?.pattern ?? 'veins';
  const baseHex = finish.color || '#3B9452';
  const accentHex = plantParams?.accentColor || '#A2E382';
  const tipHex = plantParams?.tipColor || '#69C463';
  const emissiveIntensity = plantParams?.emissiveIntensity ?? 0;
  const emissiveHex =
    emissiveIntensity > 0.01
      ? plantParams?.emissiveColor && plantParams.emissiveColor !== '#000000'
        ? plantParams.emissiveColor
        : accentHex
      : '#000000';

  const maps = getOrCreatePlantPatternMaps(pattern, baseHex, accentHex, tipHex, emissiveHex);

  const mat = new THREE.MeshStandardMaterial({
    color: '#FFFFFF',
    map: maps.colorMap,
    roughness: finish.roughness ?? 0.45,
    metalness: finish.metalness ?? 0.02,
    side: plantParams?.doubleSided !== false ? THREE.DoubleSide : THREE.FrontSide,
  });

  if (emissiveIntensity > 0.01) {
    mat.emissive = new THREE.Color(emissiveHex);
    mat.emissiveIntensity = emissiveIntensity;
    if (maps.emissiveMap) {
      mat.emissiveMap = maps.emissiveMap;
    }
  }

  const wPreset = finish.weathering ?? 'none';
  const wAmt = THREE.MathUtils.clamp(finish.weatheringIntensity ?? 0.35, 0, 1);
  if (wPreset !== 'none' && wAmt > 0.01) {
    const wt = WEATHERING_TINT[wPreset];
    mat.color.lerp(new THREE.Color(wt.hex), wAmt * 0.5);
    mat.roughness = THREE.MathUtils.clamp(mat.roughness + wt.roughnessDelta * wAmt, 0.08, 0.99);
  }

  return mat;
}

// ---------------------------------------------------------------------------
// CURATED BOTANICAL & FANTASY STARTER PRESETS
// ---------------------------------------------------------------------------

export interface PlantStarterPreset {
  id: string;
  name: string;
  summary: string;
  build: () => ObjectMakerDoc;
}

export function createStarterPlantDoc(): ObjectMakerDoc {
  return PLANT_STARTER_PRESETS[0].build();
}

export const PLANT_STARTER_PRESETS: PlantStarterPreset[] = [
  {
    id: 'bananaClump',
    name: 'Tropical Banana Clump',
    summary: '9 ribbed banana leaves fanning out from a basal corm',
    build: () => {
      const corm = createDefaultPlantPartSpec('bulbCorm', {
        name: 'Banana_Corm_Base',
        position: [0, 0, 0],
        dimensions: [0.42, 0.44, 0.42],
        material: { color: '#426B35', roughness: 0.65, metalness: 0.02 },
      });
      const fan = createClusterGroupAndParts(
        {
          target: 'leaf',
          shape: 'leafBanana',
          count: 9,
          layout: 'fan',
          symmetrical: false,
          randomness: 0.35,
          fanAngleDeg: 52,
          arcSpanDeg: 360,
          centerRadius: 0.08,
          hubHeight: 0.24,
          minScale: 0.82,
          maxScale: 1.18,
          tierLayers: 2,
          baseDimensions: [0.64, 0.24, 1.48],
          basePlant: {
            pattern: 'ribs',
            accentColor: '#90EE7E',
            tipColor: '#7BD453',
            droop: 0.44,
            cup: 0.34,
            ruffle: 0.14,
            tatter: 0.28,
            veinDepth: 0.55,
            doubleSided: true,
          },
          baseColor: '#2D8A47',
          seed: 104,
        },
        'Banana_Leaf_Fan'
      );
      return {
        version: 1,
        groups: [fan.group],
        parts: [corm, ...fan.parts],
      };
    },
  },
  {
    id: 'elephantEar',
    name: 'Elephant Ear Taro',
    summary: '6 broad veined heart-ear leaves bursting from center',
    build: () => {
      const cluster = createClusterGroupAndParts(
        {
          target: 'leaf',
          shape: 'leafElephantEar',
          count: 6,
          layout: 'randomCenter',
          symmetrical: false,
          randomness: 0.42,
          fanAngleDeg: 48,
          arcSpanDeg: 360,
          centerRadius: 0.14,
          hubHeight: 0.32,
          minScale: 0.78,
          maxScale: 1.24,
          tierLayers: 2,
          baseDimensions: [1.02, 0.28, 1.28],
          basePlant: {
            pattern: 'veins',
            accentColor: '#A9F08D',
            tipColor: '#4BA462',
            droop: 0.34,
            cup: 0.46,
            ruffle: 0.28,
            doubleSided: true,
          },
          baseColor: '#22693E',
          seed: 211,
        },
        'ElephantEar_Clump'
      );
      const stems = [
        createDefaultPlantPartSpec('stemCurved', {
          name: 'Central_Stalk',
          position: [0, 0, 0],
          dimensions: [0.18, 0.48, 0.18],
          material: { color: '#397343', roughness: 0.55, metalness: 0.02 },
        }),
      ];
      return {
        version: 1,
        groups: [cluster.group],
        parts: [...stems, ...cluster.parts],
      };
    },
  },
  {
    id: 'wildflower',
    name: 'Meadow Blossom',
    summary: 'Asymmetric pink petals + stamen core + teardrop leaves on stem',
    build: () => {
      const stem = createDefaultPlantPartSpec('stemCurved', {
        name: 'Flower_Stem',
        position: [0, 0, 0],
        dimensions: [0.12, 1.18, 0.12],
        plantParams: { droop: 0.18, twist: 0.12, pattern: 'solid' },
        material: { color: '#3D8442', roughness: 0.54, metalness: 0.02 },
      });
      const flower = createClusterGroupAndParts(
        {
          target: 'petal',
          shape: 'petalRuffled',
          count: 8,
          layout: 'fan',
          symmetrical: false,
          randomness: 0.28,
          fanAngleDeg: 66,
          arcSpanDeg: 360,
          centerRadius: 0.07,
          hubHeight: 1.12,
          minScale: 0.85,
          maxScale: 1.15,
          tierLayers: 1,
          includeFlowerCore: true,
          coreColor: '#F59E0B',
          baseDimensions: [0.46, 0.16, 0.62],
          basePlant: {
            pattern: 'gradientTip',
            accentColor: '#FDE047',
            tipColor: '#FCE7F3',
            droop: 0.06,
            cup: 0.34,
            ruffle: 0.52,
            doubleSided: true,
          },
          baseColor: '#EC4899',
          seed: 319,
        },
        'Blossom_Petals'
      );
      const baseLeaves = createClusterGroupAndParts(
        {
          target: 'leaf',
          shape: 'leafTeardrop',
          count: 5,
          layout: 'fan',
          symmetrical: false,
          randomness: 0.36,
          fanAngleDeg: 62,
          arcSpanDeg: 360,
          centerRadius: 0.06,
          hubHeight: 0.06,
          minScale: 0.8,
          maxScale: 1.15,
          tierLayers: 1,
          baseDimensions: [0.5, 0.16, 0.88],
          basePlant: {
            pattern: 'veins',
            accentColor: '#9FE884',
            tipColor: '#66C95E',
            droop: 0.32,
            cup: 0.28,
            ruffle: 0.08,
            doubleSided: true,
          },
          baseColor: '#368C4D',
          seed: 325,
        },
        'Basal_Teardrop_Leaves'
      );
      return {
        version: 1,
        groups: [flower.group, baseLeaves.group],
        parts: [stem, ...flower.parts, ...baseLeaves.parts],
      };
    },
  },
  {
    id: 'swordAgave',
    name: 'Spiraling Sword Agave',
    summary: '14 sharp pointed blades spiraling out in a tight succulent rosette',
    build: () => {
      const rosette = createClusterGroupAndParts(
        {
          target: 'leaf',
          shape: 'leafBlade',
          count: 14,
          layout: 'spiral',
          symmetrical: true,
          randomness: 0.15,
          fanAngleDeg: 54,
          arcSpanDeg: 360,
          centerRadius: 0.06,
          hubHeight: 0.1,
          minScale: 0.72,
          maxScale: 1.18,
          tierLayers: 3,
          baseDimensions: [0.24, 0.24, 1.38],
          basePlant: {
            pattern: 'gradientTip',
            accentColor: '#A7F3D0',
            tipColor: '#FDE68A',
            droop: 0.24,
            cup: 0.62,
            ruffle: 0.04,
            doubleSided: true,
          },
          baseColor: '#2E7D6B',
          seed: 407,
        },
        'Agave_Spiral_Fan'
      );
      return {
        version: 1,
        groups: [rosette.group],
        parts: [...rosette.parts],
      };
    },
  },
  {
    id: 'fairyLantern',
    name: 'Fairy Glow-Bell Plant',
    summary: 'Bioluminescent bell pods, curly tendrils & floating spore berries',
    build: () => {
      const stalk = createDefaultPlantPartSpec('stemCurved', {
        name: 'Luminescent_Stalk',
        position: [0, 0, 0],
        dimensions: [0.14, 1.45, 0.14],
        plantParams: {
          pattern: 'bioluminescent',
          accentColor: '#67E8F9',
          tipColor: '#E0F2FE',
          emissiveColor: '#38BDF8',
          emissiveIntensity: 0.45,
          droop: 0.55,
        },
        material: { color: '#0F4C5C', roughness: 0.36, metalness: 0.05 },
      });
      const tendrilL = createDefaultPlantPartSpec('vineTendril', {
        name: 'Curly_Tendril_L',
        position: [-0.08, 0.32, 0.04],
        rotation: [12, -35, 18],
        dimensions: [0.42, 0.92, 0.42],
        plantParams: {
          pattern: 'bioluminescent',
          accentColor: '#A5F3FC',
          emissiveColor: '#22D3EE',
          emissiveIntensity: 0.55,
        },
        material: { color: '#155E75', roughness: 0.34, metalness: 0.05 },
      });
      const bell = createDefaultPlantPartSpec('fantasyBell', {
        name: 'Hanging_Lantern_Bell',
        position: [0.4, 1.02, 0.02],
        rotation: [10, 0, 22],
        dimensions: [0.56, 0.68, 0.56],
        plantParams: {
          pattern: 'bioluminescent',
          accentColor: '#BAE6FD',
          tipColor: '#F0F9FF',
          emissiveColor: '#38BDF8',
          emissiveIntensity: 0.72,
          ruffle: 0.4,
        },
        material: { color: '#0284C7', roughness: 0.28, metalness: 0.06 },
      });
      const spores = createDefaultPlantPartSpec('fantasySporeOrb', {
        name: 'Base_Dew_Spores',
        position: [-0.22, 0, 0.18],
        dimensions: [0.44, 0.44, 0.44],
        plantParams: {
          pattern: 'bioluminescent',
          accentColor: '#F0ABFC',
          emissiveColor: '#E879F9',
          emissiveIntensity: 0.65,
        },
        material: { color: '#6D28D9', roughness: 0.25, metalness: 0.08 },
      });
      const leafFan = createClusterGroupAndParts(
        {
          target: 'fantasy',
          shape: 'fantasySpiralRibbon',
          count: 5,
          layout: 'fan',
          symmetrical: false,
          randomness: 0.3,
          fanAngleDeg: 58,
          arcSpanDeg: 300,
          centerRadius: 0.08,
          hubHeight: 0.08,
          minScale: 0.75,
          maxScale: 1.05,
          tierLayers: 1,
          baseDimensions: [0.34, 0.26, 1.05],
          basePlant: {
            pattern: 'bioluminescent',
            accentColor: '#5EEAD4',
            tipColor: '#F0ABFC',
            emissiveColor: '#2DD4BF',
            emissiveIntensity: 0.5,
            droop: 0.22,
            ruffle: 0.42,
            doubleSided: true,
          },
          baseColor: '#0F766E',
          seed: 518,
        },
        'Bio_Ribbon_Base'
      );
      return {
        version: 1,
        groups: [leafFan.group],
        parts: [stalk, tendrilL, bell, spores, ...leafFan.parts],
      };
    },
  },
  {
    id: 'toadstoolFern',
    name: 'Fairy Toadstool & Fern',
    summary: 'Spotted mushroom trio surrounded by feathered fern fronds',
    build: () => {
      const shroomStems = [
        createDefaultPlantPartSpec('stemCurved', {
          name: 'Big_Mushroom_Stem',
          position: [0, 0, 0],
          dimensions: [0.22, 0.85, 0.22],
          plantParams: { droop: 0.14, pattern: 'solid' },
          material: { color: '#F5EDE0', roughness: 0.72, metalness: 0.02 },
        }),
        createDefaultPlantPartSpec('fantasyMushroom', {
          name: 'Big_Mushroom_Cap',
          position: [0.12, 0.78, 0],
          rotation: [6, 18, -8],
          dimensions: [0.88, 0.44, 0.88],
          plantParams: {
            pattern: 'spotted',
            accentColor: '#FFFBEB',
            tipColor: '#FDE68A',
            emissiveColor: '#F472B6',
            emissiveIntensity: 0.24,
            ruffle: 0.34,
          },
          material: { color: '#DB2777', roughness: 0.42, metalness: 0.02 },
        }),
        createDefaultPlantPartSpec('stemCurved', {
          name: 'Small_Mushroom_Stem',
          position: [-0.34, 0, 0.24],
          dimensions: [0.14, 0.5, 0.14],
          plantParams: { droop: -0.18, pattern: 'solid' },
          material: { color: '#F5EDE0', roughness: 0.72, metalness: 0.02 },
        }),
        createDefaultPlantPartSpec('fantasyMushroom', {
          name: 'Small_Mushroom_Cap',
          position: [-0.42, 0.46, 0.24],
          rotation: [-8, -24, 12],
          dimensions: [0.54, 0.28, 0.54],
          plantParams: {
            pattern: 'spotted',
            accentColor: '#FFFBEB',
            emissiveColor: '#F472B6',
            emissiveIntensity: 0.28,
            ruffle: 0.28,
          },
          material: { color: '#EC4899', roughness: 0.42, metalness: 0.02 },
        }),
      ];
      const ferns = createClusterGroupAndParts(
        {
          target: 'leaf',
          shape: 'leafFern',
          count: 7,
          layout: 'fan',
          symmetrical: false,
          randomness: 0.35,
          fanAngleDeg: 58,
          arcSpanDeg: 320,
          centerRadius: 0.14,
          hubHeight: 0.08,
          minScale: 0.75,
          maxScale: 1.1,
          tierLayers: 1,
          baseDimensions: [0.52, 0.22, 1.25],
          basePlant: {
            pattern: 'ribs',
            accentColor: '#86EFAC',
            tipColor: '#BEF264',
            droop: 0.52,
            cup: 0.18,
            ruffle: 0.1,
            doubleSided: true,
          },
          baseColor: '#2E7D3B',
          seed: 640,
        },
        'Fern_Frond_Fan'
      );
      return {
        version: 1,
        groups: [ferns.group],
        parts: [...shroomStems, ...ferns.parts],
      };
    },
  },
];
