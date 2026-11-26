import type {
  CanopyBaseGradientScope,
  CanopyBasePattern,
  CanopyCrownSilhouette,
  CanopyLeafShape,
  CanopyTargetTrees,
  ConiferShapeStyle,
  EzTreeFoliageMode,
  EzTreeLeafStyle,
  EzTreeParams,
  FeatureFrequency,
  FoliageTextureStyle,
  FruitDistributionMode,
  LeafSeasonPresetId,
  StylizedCanopyConfig,
  TreeBarkStyle,
  TreeSpeciesType,
} from '../types/maker';

export interface CanopyStylePreset {
  id: string;
  name: string;
  species: TreeSpeciesType;
  blurb: string;
  swatchHex: string;
  accentHex: string;
  patch: Partial<StylizedCanopyConfig>;
}

export const TREE_SPECIES_OPTIONS: {
  id: TreeSpeciesType;
  label: string;
  blurb: string;
}[] = [
  { id: 'oak', label: 'Oak', blurb: 'Broadleaf canopy, gnarl, arched roots, owl hollows & fruit' },
  { id: 'conifer', label: 'Conifer', blurb: 'Wind-swaying evergreen tiers with spacing, droop & layer gradients' },
  { id: 'birch', label: 'Birch', blurb: 'Papery bark, fine tapered twigs & leafy clusters with hue spread' },
  { id: 'fantasy', label: 'Fantasy', blurb: 'Mystical elderwood gnarl, sweeping boughs & glowing lantern orbs' },
  { id: 'custom', label: 'Custom', blurb: 'Renameable custom tree with full GLB, root, hollow & fruit tools' },
];

export const TREE_BARK_STYLE_OPTIONS: { id: TreeBarkStyle; label: string }[] = [
  { id: 'oak', label: 'Oak' },
  { id: 'pine', label: 'Pine' },
  { id: 'birch', label: 'Birch' },
  { id: 'rough', label: 'Rough' },
  { id: 'painterly', label: 'Painterly' },
  { id: 'textural', label: 'Textural' },
  { id: 'cartoony', label: 'Cartoony' },
  { id: 'knotty', label: 'Knotty' },
  { id: 'fantasy', label: 'Fantasy' },
];

export const CONIFER_SHAPE_OPTIONS: { id: ConiferShapeStyle; label: string }[] = [
  { id: 'classic', label: 'Stylized Pine' },
  { id: 'spire', label: 'Nordic Spire' },
  { id: 'snowDroop', label: 'Snow-Heavy' },
  { id: 'flatBough', label: 'Alpine Cedar' },
  { id: 'weeping', label: 'Weeping Hemlock' },
];

export const FEATURE_FREQUENCY_OPTIONS: { id: FeatureFrequency; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'some', label: 'Some' },
  { id: 'lots', label: 'Lots' },
  { id: 'all', label: 'All' },
];

export const FOLIAGE_TEXTURE_OPTIONS: { id: FoliageTextureStyle; label: string }[] = [
  { id: 'cleanBase', label: 'Clean Base (No Leaves)' },
  { id: 'painted', label: 'Painted Texture' },
  { id: 'clustered', label: 'Oak Rosettes' },
  { id: 'softBrush', label: 'Soft Brush' },
  { id: 'crispStylized', label: 'Crisp Stylized' },
];

export const CANOPY_BASE_PATTERN_OPTIONS: {
  id: CanopyBasePattern;
  label: string;
  blurb: string;
}[] = [
  { id: 'smooth', label: 'Smooth', blurb: 'Clean velvety solid base' },
  { id: 'grain', label: 'Fine Grain', blurb: 'Subtle organic vector-paint grain' },
  { id: 'noise', label: 'Organic Noise', blurb: 'Multi-octave mottled painterly noise' },
  { id: 'dappled', label: 'Dappled', blurb: 'Soft sunlit blotches & shade' },
];

export const CANOPY_BASE_GRADIENT_SCOPE_OPTIONS: {
  id: CanopyBaseGradientScope;
  label: string;
}[] = [
  { id: 'whole', label: 'Whole Canopy' },
  { id: 'perPuff', label: 'Per Puff' },
  { id: 'both', label: 'Both' },
];

export const CANOPY_LEAF_SHAPE_OPTIONS: {
  id: CanopyLeafShape;
  label: string;
  blurb: string;
}[] = [
  { id: 'basic', label: 'Basic Leaf', blurb: 'Two curved edges meeting at pointed ends' },
  { id: 'oak', label: 'Oak Leaf', blurb: 'Classic wavy multi-lobed oak silhouette' },
  { id: 'maple', label: 'Maple Leaf', blurb: 'Crisp 5-point palmate maple silhouette' },
  { id: 'triple', label: 'Triple Leaf', blurb: 'Three fanned basic leaves joined at stem' },
];

export interface LeafSeasonPresetMeta {
  id: Exclude<LeafSeasonPresetId, 'custom'>;
  label: string;
  blurb: string;
  swatchA: string;
  swatchB: string;
  leafColor: string;
  hueSpread: number;
  valueSpread: number;
  baseColor: string;
  baseTopColor: string;
  baseBottomColor: string;
}

export const LEAF_SEASON_PRESETS: LeafSeasonPresetMeta[] = [
  {
    id: 'spring',
    label: 'Spring',
    blurb: 'Fresh luminous lime & bright meadow greens',
    swatchA: '#A5E655',
    swatchB: '#48A842',
    leafColor: '#86D64B',
    hueSpread: 16,
    valueSpread: 0.16,
    baseColor: '#56A844',
    baseTopColor: '#98DA55',
    baseBottomColor: '#2B692D',
  },
  {
    id: 'summer',
    label: 'Summer',
    blurb: 'Deep lush emerald canopy with sunlit tips',
    swatchA: '#5CC248',
    swatchB: '#1E5E2E',
    leafColor: '#4BA83E',
    hueSpread: 12,
    valueSpread: 0.15,
    baseColor: '#3B8A38',
    baseTopColor: '#72C24B',
    baseBottomColor: '#1B4B28',
  },
  {
    id: 'earlyFall',
    label: 'Early Fall',
    blurb: 'Golden honey, chartreuse & warm amber hues',
    swatchA: '#F5C942',
    swatchB: '#D97B29',
    leafColor: '#E5AE34',
    hueSpread: 28,
    valueSpread: 0.18,
    baseColor: '#C48A2D',
    baseTopColor: '#F2C94C',
    baseBottomColor: '#78461E',
  },
  {
    id: 'peakAutumn',
    label: 'Peak Autumn',
    blurb: 'Fiery crimson, burnt orange, gold & russet mix',
    swatchA: '#E85328',
    swatchB: '#F2B938',
    leafColor: '#DF6B26',
    hueSpread: 44,
    valueSpread: 0.22,
    baseColor: '#B54E24',
    baseTopColor: '#F09835',
    baseBottomColor: '#66241B',
  },
  {
    id: 'winter',
    label: 'Winter Frost',
    blurb: 'Frosted ice-sage, pale cyan & snowy highlights',
    swatchA: '#E2F3FA',
    swatchB: '#7BA9C4',
    leafColor: '#C5E3F2',
    hueSpread: 14,
    valueSpread: 0.14,
    baseColor: '#8DB2C7',
    baseTopColor: '#E6F5FC',
    baseBottomColor: '#48657D',
  },
  {
    id: 'blossom',
    label: 'Blossom',
    blurb: 'Soft cherry-blossom rose, blush & cream petals',
    swatchA: '#F9B8CE',
    swatchB: '#E0628F',
    leafColor: '#F29BB8',
    hueSpread: 18,
    valueSpread: 0.16,
    baseColor: '#D9799B',
    baseTopColor: '#FCD0DF',
    baseBottomColor: '#8F3E5F',
  },
  {
    id: 'mystic',
    label: 'Mystic',
    blurb: 'Enchanted twilight teal, violet & aurora glow',
    swatchA: '#6EE2F0',
    swatchB: '#8B5CF6',
    leafColor: '#6AD2E8',
    hueSpread: 34,
    valueSpread: 0.2,
    baseColor: '#469AB8',
    baseTopColor: '#8AE8F5',
    baseBottomColor: '#2E3B78',
  },
];

export const FRUIT_DISTRIBUTION_OPTIONS: { id: FruitDistributionMode; label: string }[] = [
  { id: 'outerCrown', label: 'Outer Crown' },
  { id: 'underCanopy', label: 'Under Canopy' },
  { id: 'hanging', label: 'Hanging Boughs' },
];

export const CANOPY_SILHOUETTE_OPTIONS: {
  id: CanopyCrownSilhouette;
  label: string;
  blurb: string;
}[] = [
  { id: 'dome', label: 'Dome / Storybook', blurb: 'Rounded overlapping puffs perched around a hero crown' },
  { id: 'umbrella', label: 'Wide Umbrella', blurb: 'Broad flat overlapping canopy clouds with airy trunk reveal' },
  { id: 'cypress', label: 'Tall Plume', blurb: 'Stacked vertical squished puffs tapering upward' },
  { id: 'tiered', label: 'Tiered Bonsai', blurb: 'Stepped sculptural foliage shelves at staggered heights' },
  { id: 'windswept', label: 'Wind-Swept', blurb: 'Asymmetric painterly drift leaning gracefully to one side' },
];

export const CANOPY_TARGET_OPTIONS: {
  id: CanopyTargetTrees;
  label: string;
}[] = [
  { id: 'matching', label: 'Match Species' },
  { id: 'broadleaf', label: 'Oaks & Birches' },
  { id: 'oak', label: 'Oaks Only' },
  { id: 'all', label: 'All Island Trees' },
  { id: 'placedOnly', label: 'Placed Only' },
];

export function createDefaultSpeciesConfig(
  species: TreeSpeciesType,
  overrides: Partial<StylizedCanopyConfig> = {}
): StylizedCanopyConfig {
  const base: StylizedCanopyConfig = {
    enabled: false,
    targetTrees: 'matching',
    treeType: species,
    customTypeName: 'My Custom Tree',
    seed: 1042,

    // Tree Base Maker defaults
    barkStyle: 'oak',
    barkColor: '#72503A',
    barkLineIntensity: 0.58,
    barkLineDensity: 1.0,
    barkBumpStrength: 0.45,

    trunkHeight: 2.85,
    trunkThickness: 1.05,
    trunkTaper: 0.46,
    trunkLean: 0.28,
    trunkVariety: 0.35,

    majorBranchCount: 4,
    majorBranchLength: 1.45,
    majorBranchThickness: 0.95,
    majorBranchTaper: 0.72,
    majorBranchSpread: 0.84,
    majorBranchUpward: 0.52,
    majorBranchDroop: 0.0,

    gnarlAmount: 0.35,
    hollowMode: 'some',
    hollowHeight: 0.48,
    hollowSize: 0.95,

    rootMode: 'some',
    rootCount: 5,
    rootBaseHeight: 0.22,
    rootReach: 1.45,
    rootArchHeight: 0.34,
    rootThickness: 1.0,
    rootRandomness: 0.45,

    // Canopy defaults (Oak / Custom)
    minPuffs: 4,
    maxPuffs: 6,
    silhouette: 'dome',
    clusterSpread: 1.0,
    overlapTightness: 0.54,
    verticalSpread: 0.68,
    canopyBranchAttach: 0.72,
    branchCanopyScale: 0.68,

    canopyHeight: 3.25,
    heightVariation: 0.36,
    basePuffSize: 1.18,
    sizeVariation: 0.42,
    squishY: 0.76,
    ovalnessXZ: 0.34,
    squishVariation: 0.28,
    tiltAmount: 16,

    foliageTextureStyle: 'cleanBase',
    foliageBaseColor: '#4EA343',
    foliageBumpStrength: 0.34,

    // Canopy Base Grain/Noise & Gradient defaults
    canopyBasePattern: 'noise',
    canopyBaseGrainStrength: 0.42,
    canopyBaseGrainScale: 1.2,
    canopyBaseTopColor: '#8FD652',
    canopyBaseBottomColor: '#245A29',
    canopyBaseGradientStrength: 0.58,
    canopyBaseGradientScope: 'both',

    // 3D Contour Canopy Leaves defaults
    canopyLeavesEnabled: true,
    canopyLeafShape: 'basic',
    canopyLeafSeason: 'summer',
    canopyLeafColor: '#58B446',
    canopyLeafCount: 220,
    canopyLeafSize: 0.34,
    canopyLeafSizeRandomness: 0.45,
    canopyLeafHueSpread: 16,
    canopyLeafValueSpread: 0.16,
    canopyLeafSurfaceOffset: 0.08,
    canopyLeafTiltRandomness: 0.48,
    canopyLeafWindFlutter: 1.0,

    // Conifer defaults
    coniferTiers: 8,
    coniferLeavesPerTier: 7,
    coniferShape: 'classic',
    coniferScarcity: 0.16,
    coniferDroop: 0.34,
    coniferWidth: 1.52,
    coniferTopColor: '#98D45A',
    coniferBottomColor: '#254F24',
    coniferGradientStrength: 0.92,
    coniferWholeTopColor: '#B8EA5C',
    coniferWholeBottomColor: '#173A24',
    coniferWholeGradientStrength: 0,

    // Birch defaults
    birchTwigDensity: 1.15,
    birchLeafDensity: 1.25,
    birchLeafSize: 1.05,
    birchBranchDroop: 0.28,
    birchLeafColor: '#88C846',

    // Fruit defaults
    fruitEnabled: false,
    fruitCount: 10,
    fruitSize: 0.17,
    fruitColor: '#D93B3B',
    fruitDistribution: 'outerCrown',
    fruitGlow: 0,

    // Color & Wind
    hueShift: 0,
    hueVariation: 14,
    saturationShift: 0.04,
    valueShift: 0.02,
    valueVariation: 0.14,
    sunCrownGradient: 0.22,
    windSway: 0.88,
  };

  if (species === 'conifer') {
    return {
      ...base,
      treeType: 'conifer',
      barkStyle: 'pine',
      barkColor: '#8A6248',
      barkLineIntensity: 0.56,
      barkBumpStrength: 0.55,
      trunkHeight: 4.5,
      trunkThickness: 0.92,
      trunkTaper: 0.28,
      trunkLean: 0.08,
      majorBranchCount: 0,
      gnarlAmount: 0.1,
      hollowMode: 'none',
      rootMode: 'none',
      canopyHeight: 1.25,
      coniferTiers: 8,
      coniferLeavesPerTier: 7,
      coniferShape: 'classic',
      coniferScarcity: 0.16,
      coniferDroop: 0.34,
      coniferWidth: 1.52,
      coniferTopColor: '#98D45A',
      coniferBottomColor: '#254F24',
      coniferGradientStrength: 0.92,
      coniferWholeTopColor: '#B8EA5C',
      coniferWholeBottomColor: '#173A24',
      coniferWholeGradientStrength: 0,
      foliageBumpStrength: 0.55,
      hueVariation: 8,
      windSway: 0.92,
      ...overrides,
    };
  }

  if (species === 'birch') {
    return {
      ...base,
      treeType: 'birch',
      barkStyle: 'birch',
      barkColor: '#E5DFD5',
      barkLineIntensity: 0.25,
      barkBumpStrength: 0.3,
      trunkHeight: 3.45,
      trunkThickness: 0.64,
      trunkTaper: 0.34,
      trunkLean: 0.34,
      majorBranchCount: 5,
      majorBranchLength: 1.45,
      majorBranchThickness: 0.62,
      majorBranchSpread: 0.72,
      majorBranchUpward: 0.68,
      majorBranchDroop: 0.32,
      gnarlAmount: 0.12,
      hollowMode: 'none',
      rootMode: 'none',
      canopyHeight: 3.1,
      birchTwigDensity: 1.25,
      birchLeafDensity: 1.35,
      birchLeafSize: 1.05,
      birchBranchDroop: 0.36,
      birchLeafColor: '#98D14A',
      hueVariation: 22,
      valueVariation: 0.16,
      windSway: 1.15,
      ...overrides,
    };
  }

  if (species === 'fantasy') {
    return {
      ...base,
      treeType: 'fantasy',
      barkStyle: 'fantasy',
      barkColor: '#4E3F63',
      barkLineIntensity: 0.72,
      barkLineDensity: 1.15,
      barkBumpStrength: 0.6,
      trunkHeight: 3.25,
      trunkThickness: 1.18,
      trunkTaper: 0.42,
      trunkLean: 0.54,
      trunkVariety: 0.55,
      majorBranchCount: 5,
      majorBranchLength: 1.85,
      majorBranchThickness: 0.95,
      majorBranchSpread: 1.05,
      majorBranchUpward: 0.62,
      majorBranchDroop: -0.15,
      majorBranchTaper: 0.85,
      gnarlAmount: 0.76,
      hollowMode: 'lots',
      hollowHeight: 0.46,
      hollowSize: 1.1,
      rootMode: 'all',
      rootCount: 6,
      rootBaseHeight: 0.32,
      rootReach: 2.05,
      rootArchHeight: 0.56,
      rootThickness: 1.15,
      rootRandomness: 0.65,
      minPuffs: 4,
      maxPuffs: 6,
      canopyBranchAttach: 0.82,
      branchCanopyScale: 0.66,
      silhouette: 'tiered',
      clusterSpread: 1.28,
      overlapTightness: 0.46,
      verticalSpread: 0.84,
      canopyHeight: 3.65,
      basePuffSize: 1.16,
      squishY: 0.66,
      ovalnessXZ: 0.42,
      foliageTextureStyle: 'cleanBase',
      foliageBaseColor: '#4EA4C2',
      foliageBumpStrength: 0.3,
      canopyBasePattern: 'dappled',
      canopyBaseGrainStrength: 0.48,
      canopyBaseGrainScale: 1.1,
      canopyBaseTopColor: '#8AE8F5',
      canopyBaseBottomColor: '#2E3B78',
      canopyBaseGradientStrength: 0.68,
      canopyBaseGradientScope: 'both',
      canopyLeavesEnabled: true,
      canopyLeafShape: 'triple',
      canopyLeafSeason: 'mystic',
      canopyLeafColor: '#6AD2E8',
      canopyLeafCount: 240,
      canopyLeafSize: 0.36,
      canopyLeafSizeRandomness: 0.5,
      canopyLeafHueSpread: 34,
      canopyLeafValueSpread: 0.2,
      canopyLeafSurfaceOffset: 0.1,
      canopyLeafTiltRandomness: 0.55,
      canopyLeafWindFlutter: 1.15,
      fruitEnabled: true,
      fruitCount: 14,
      fruitSize: 0.18,
      fruitColor: '#FFE08A',
      fruitDistribution: 'hanging',
      fruitGlow: 1.15,
      hueShift: 0,
      hueVariation: 28,
      saturationShift: 0.12,
      valueShift: 0.08,
      sunCrownGradient: 0.34,
      windSway: 1.05,
      ...overrides,
    };
  }

  if (species === 'custom') {
    return {
      ...base,
      treeType: 'custom',
      customTypeName: 'My Custom Tree',
      barkStyle: 'painterly',
      barkColor: '#6D4E3B',
      barkLineIntensity: 0.62,
      gnarlAmount: 0.4,
      hollowMode: 'some',
      rootMode: 'some',
      fruitEnabled: false,
      ...overrides,
    };
  }

  return { ...base, ...overrides };
}

export function createDefaultCanopyConfig(
  overrides: Partial<StylizedCanopyConfig> = {}
): StylizedCanopyConfig {
  return createDefaultSpeciesConfig(overrides.treeType ?? 'oak', overrides);
}

/**
 * Resolves the effective species config for a given tree species, reading from
 * `config.speciesProfiles[species]` if customized or falling back cleanly.
 */
export function resolveSpeciesConfig(
  rootConfig: StylizedCanopyConfig,
  species: TreeSpeciesType
): StylizedCanopyConfig {
  const activeType = rootConfig.treeType ?? 'oak';
  if (activeType === species) {
    return rootConfig;
  }
  const saved = rootConfig.speciesProfiles?.[species];
  if (saved) {
    const keepSpecialType =
      saved.treeGeneratorMode === 'ezTree' ||
      saved.treeType === 'fantasy' ||
      saved.treeType === 'custom';
    const resolvedType = keepSpecialType && saved.treeType ? saved.treeType : species;
    return {
      ...createDefaultSpeciesConfig(resolvedType),
      ...saved,
      treeType: resolvedType,
      enabled: rootConfig.enabled,
      targetTrees: rootConfig.targetTrees,
    };
  }
  return createDefaultSpeciesConfig(species, {
    enabled: rootConfig.enabled,
    targetTrees: rootConfig.targetTrees,
    seed: rootConfig.seed,
  });
}

export const EZ_TREE_LEAF_STYLE_OPTIONS: { id: EzTreeLeafStyle; label: string; blurb: string }[] = [
  { id: 'oak', label: 'Oak Cluster', blurb: 'Lobed broadleaf oak leaf sprigs' },
  { id: 'ash', label: 'Ash Compound', blurb: 'Feathery paired compound leaflets' },
  { id: 'aspen', label: 'Aspen Heart', blurb: 'Airy golden-green trembling leaves' },
  { id: 'pine', label: 'Pine Needles', blurb: 'Radiating evergreen needle fascicles' },
];

export const EZ_TREE_FOLIAGE_MODE_OPTIONS: { id: EzTreeFoliageMode; label: string }[] = [
  { id: 'leafCards', label: 'Leaf Cards' },
  { id: 'canopyPuffs', label: 'Stylized Puffs' },
  { id: 'both', label: 'Cards + Puffs' },
];

export function createDefaultEzTreeParams(species: TreeSpeciesType = 'oak'): EzTreeParams {
  if (species === 'conifer') {
    return {
      growthType: 'evergreen',
      levels: 2,
      children: [14, 5, 3],
      angle: [68, 46, 36],
      start: [0.22, 0.25, 0.3],
      gnarliness: [0.06, 0.14, 0.2, 0.2],
      length: [5.2, 2.2, 1.1, 0.65],
      radius: [0.36, 0.42, 0.56, 0.6],
      taper: [0.88, 0.72, 0.72, 0.7],
      twist: [0.0, 0.04, 0.08, 0.0],
      forceDirection: [0, 1, 0],
      forceStrength: -0.025,
      presetId: 'ezPine',
      foliageMode: 'leafCards',
      leavesEnabled: true,
      leafStyle: 'pine',
      billboard: 'double',
      leafCount: 14,
      leafSize: 1.18,
      leafAngle: 38,
      leafStart: 0.12,
      leafAlphaTest: 0.36,
      leafTint: '#3C7E3B',
    };
  }

  if (species === 'birch') {
    return {
      growthType: 'deciduous',
      levels: 3,
      children: [5, 4, 3],
      angle: [42, 46, 48],
      start: [0.36, 0.28, 0.28],
      gnarliness: [0.14, 0.22, 0.28, 0.22],
      length: [3.8, 2.35, 1.5, 0.9],
      radius: [0.26, 0.56, 0.62, 0.6],
      taper: [0.7, 0.68, 0.68, 0.72],
      twist: [0.05, 0.08, -0.06, 0.0],
      forceDirection: [0, 1, 0],
      forceStrength: 0.032,
      presetId: 'ezAspen',
      foliageMode: 'leafCards',
      leavesEnabled: true,
      leafStyle: 'aspen',
      billboard: 'double',
      leafCount: 12,
      leafSize: 1.05,
      leafAngle: 45,
      leafStart: 0.15,
      leafAlphaTest: 0.36,
      leafTint: '#8BC943',
    };
  }

  if (species === 'fantasy') {
    return {
      growthType: 'deciduous',
      levels: 3,
      children: [5, 4, 3],
      angle: [54, 52, 48],
      start: [0.34, 0.22, 0.22],
      gnarliness: [0.36, 0.44, 0.48, 0.36],
      length: [3.3, 2.75, 1.85, 1.15],
      radius: [0.46, 0.62, 0.62, 0.56],
      taper: [0.64, 0.66, 0.7, 0.72],
      twist: [0.14, 0.12, -0.1, 0.06],
      forceDirection: [0, -1, 0],
      forceStrength: 0.045,
      presetId: 'ezWillow',
      foliageMode: 'leafCards',
      leavesEnabled: true,
      leafStyle: 'ash',
      billboard: 'double',
      leafCount: 16,
      leafSize: 1.28,
      leafAngle: 35,
      leafStart: 0.08,
      leafAlphaTest: 0.36,
      leafTint: '#62C8DE',
    };
  }

  return {
    growthType: 'deciduous',
    levels: 3,
    children: [5, 4, 3],
    angle: [48, 52, 46],
    start: [0.38, 0.24, 0.22],
    gnarliness: [0.22, 0.34, 0.38, 0.28],
    length: [3.0, 2.45, 1.65, 1.0],
    radius: [0.44, 0.62, 0.62, 0.58],
    taper: [0.66, 0.68, 0.7, 0.72],
    twist: [0.06, 0.08, 0.05, 0.0],
    forceDirection: [0, 1, 0],
    forceStrength: 0.022,
    presetId: 'ezOakMedium',
    foliageMode: 'leafCards',
    leavesEnabled: true,
    leafStyle: 'oak',
    billboard: 'double',
    leafCount: 13,
    leafSize: 1.24,
    leafAngle: 44,
    leafStart: 0.12,
    leafAlphaTest: 0.36,
    leafTint: '#55AB42',
  };
}

export function resolveEzTreeParams(config: StylizedCanopyConfig): EzTreeParams {
  const base = createDefaultEzTreeParams(config.treeType ?? 'oak');
  const raw = config.ezTree;
  if (!raw) return base;
  return {
    ...base,
    ...raw,
    children: raw.children ?? base.children,
    angle: raw.angle ?? base.angle,
    start: raw.start ?? base.start,
    gnarliness: raw.gnarliness ?? base.gnarliness,
    length: raw.length ?? base.length,
    radius: raw.radius ?? base.radius,
    taper: raw.taper ?? base.taper,
    twist: raw.twist ?? base.twist,
    forceDirection: raw.forceDirection ?? base.forceDirection,
  };
}

export interface EzTreePresetMeta {
  id: string;
  name: string;
  species: TreeSpeciesType;
  blurb: string;
  swatchHex: string;
  accentHex: string;
  barkStyle: TreeBarkStyle;
  barkColor: string;
  ezTree: EzTreeParams;
}

export const EZ_TREE_PRESETS: EzTreePresetMeta[] = [
  {
    id: 'ezOakMedium',
    name: 'Oak Medium',
    species: 'oak',
    blurb: 'Classic spreading oak boughs with organic gnarled bark & full leaf crown',
    swatchHex: '#4F9E42',
    accentHex: '#84CC52',
    barkStyle: 'oak',
    barkColor: '#6E4F39',
    ezTree: createDefaultEzTreeParams('oak'),
  },
  {
    id: 'ezOakAncient',
    name: 'Ancient Gnarled Oak',
    species: 'oak',
    blurb: 'Heavy twisted trunk, wide low-hanging limbs & lush billowing canopy',
    swatchHex: '#3D8436',
    accentHex: '#A7D856',
    barkStyle: 'knotty',
    barkColor: '#5B402D',
    ezTree: {
      ...createDefaultEzTreeParams('oak'),
      presetId: 'ezOakAncient',
      children: [6, 4, 3],
      angle: [56, 54, 48],
      start: [0.32, 0.2, 0.2],
      gnarliness: [0.34, 0.48, 0.44, 0.35],
      length: [2.8, 2.75, 1.8, 1.1],
      radius: [0.56, 0.64, 0.62, 0.56],
      forceStrength: 0.014,
      leafCount: 15,
      leafSize: 1.32,
      leafTint: '#48993B',
    },
  },
  {
    id: 'ezPine',
    name: 'Evergreen Pine',
    species: 'conifer',
    blurb: 'Tall straight conifer spire with tiered whorled branches & needle fans',
    swatchHex: '#2F6F37',
    accentHex: '#71B45B',
    barkStyle: 'pine',
    barkColor: '#694A38',
    ezTree: createDefaultEzTreeParams('conifer'),
  },
  {
    id: 'ezAspen',
    name: 'Trembling Aspen',
    species: 'birch',
    blurb: 'Pale slender birch-aspen trunk with golden-lime fluttering leaf clusters',
    swatchHex: '#9CD343',
    accentHex: '#E5CA45',
    barkStyle: 'birch',
    barkColor: '#E8E1D4',
    ezTree: createDefaultEzTreeParams('birch'),
  },
  {
    id: 'ezAsh',
    name: 'Feather Ash',
    species: 'oak',
    blurb: 'Tall airy symmetrical tree with compound pinnate ash foliage',
    swatchHex: '#5BB44F',
    accentHex: '#9AE067',
    barkStyle: 'rough',
    barkColor: '#766151',
    ezTree: {
      ...createDefaultEzTreeParams('oak'),
      presetId: 'ezAsh',
      children: [5, 4, 3],
      angle: [38, 42, 42],
      start: [0.42, 0.26, 0.24],
      gnarliness: [0.12, 0.22, 0.24, 0.18],
      length: [3.6, 2.55, 1.65, 1.0],
      radius: [0.34, 0.58, 0.6, 0.56],
      forceStrength: 0.036,
      leafStyle: 'ash',
      leafCount: 13,
      leafSize: 1.18,
      leafTint: '#60B84F',
    },
  },
  {
    id: 'ezWillow',
    name: 'Weeping Willow',
    species: 'fantasy',
    blurb: 'Graceful arching limbs cascading downward in soft trailing leaf curtains',
    swatchHex: '#63B85A',
    accentHex: '#B6DF6E',
    barkStyle: 'knotty',
    barkColor: '#685442',
    ezTree: {
      ...createDefaultEzTreeParams('oak'),
      presetId: 'ezWillow',
      children: [6, 4, 3],
      angle: [54, 48, 36],
      start: [0.44, 0.3, 0.28],
      gnarliness: [0.24, 0.32, 0.26, 0.18],
      length: [2.85, 2.35, 1.95, 1.65],
      radius: [0.48, 0.58, 0.56, 0.48],
      forceDirection: [0, -1, 0],
      forceStrength: 0.068,
      leafStyle: 'ash',
      leafCount: 16,
      leafSize: 1.22,
      leafStart: 0.06,
      leafTint: '#72C258',
    },
  },
  {
    id: 'ezSakura',
    name: 'Sakura Blossom',
    species: 'custom',
    blurb: 'Sculptural dark cherry trunk with wide tiered cherry-blossom clouds',
    swatchHex: '#F39DBB',
    accentHex: '#FCE0EA',
    barkStyle: 'painterly',
    barkColor: '#4E3B3F',
    ezTree: {
      ...createDefaultEzTreeParams('oak'),
      presetId: 'ezSakura',
      children: [5, 4, 3],
      angle: [58, 48, 42],
      start: [0.36, 0.24, 0.22],
      gnarliness: [0.28, 0.36, 0.34, 0.24],
      length: [2.5, 2.4, 1.6, 0.95],
      radius: [0.42, 0.62, 0.6, 0.56],
      forceDirection: [0, 1, 0],
      forceStrength: 0.015,
      leafStyle: 'aspen',
      leafCount: 15,
      leafSize: 1.28,
      leafTint: '#F4A3BF',
    },
  },
  {
    id: 'ezBush',
    name: 'Woodland Thicket',
    species: 'custom',
    blurb: 'Low multi-stemmed shrub with dense branching from near ground level',
    swatchHex: '#4FA242',
    accentHex: '#8ED158',
    barkStyle: 'rough',
    barkColor: '#694F3C',
    ezTree: {
      ...createDefaultEzTreeParams('oak'),
      presetId: 'ezBush',
      levels: 2,
      children: [7, 4, 2],
      angle: [56, 52, 44],
      start: [0.12, 0.2, 0.2],
      gnarliness: [0.28, 0.36, 0.32, 0.22],
      length: [1.5, 1.85, 1.25, 0.75],
      radius: [0.28, 0.58, 0.62, 0.58],
      forceStrength: 0.02,
      leafStyle: 'oak',
      leafCount: 15,
      leafSize: 1.15,
      leafStart: 0.14,
      leafTint: '#54A742',
    },
  },
];

export const CANOPY_STYLE_PRESETS: CanopyStylePreset[] = [
  {
    id: 'ancientOwlOak',
    name: 'Owl-Hollow Ancient Oak',
    species: 'oak',
    blurb: 'Gnarled knotty trunk, owl hollow, arching ground roots & rich textured canopy',
    swatchHex: '#4E9C42',
    accentHex: '#84CC52',
    patch: {
      treeType: 'oak',
      barkStyle: 'knotty',
      barkColor: '#694934',
      barkLineIntensity: 0.72,
      barkBumpStrength: 0.65,
      trunkHeight: 2.95,
      trunkThickness: 1.25,
      majorBranchCount: 4,
      majorBranchLength: 1.55,
      majorBranchSpread: 0.88,
      majorBranchUpward: 0.56,
      gnarlAmount: 0.72,
      hollowMode: 'all',
      hollowHeight: 0.46,
      hollowSize: 1.15,
      rootMode: 'all',
      rootCount: 6,
      rootReach: 1.85,
      rootArchHeight: 0.54,
      rootThickness: 1.15,
      rootRandomness: 0.55,
      minPuffs: 4,
      maxPuffs: 5,
      silhouette: 'dome',
      canopyHeight: 3.45,
      squishY: 0.76,
      foliageTextureStyle: 'clustered',
      foliageBaseColor: '#4D9D41',
      foliageBumpStrength: 0.58,
      fruitEnabled: false,
    },
  },
  {
    id: 'appleOrchardOak',
    name: 'Orchard Apple Oak',
    species: 'oak',
    blurb: 'Warm storybook oak loaded with bright red apples & gentle surface roots',
    swatchHex: '#D93B3B',
    accentHex: '#63B44B',
    patch: {
      treeType: 'oak',
      barkStyle: 'painterly',
      barkColor: '#7A543B',
      barkLineIntensity: 0.55,
      trunkHeight: 2.6,
      trunkThickness: 1.0,
      majorBranchCount: 4,
      majorBranchLength: 1.35,
      gnarlAmount: 0.34,
      hollowMode: 'some',
      rootMode: 'some',
      rootCount: 4,
      rootReach: 1.3,
      minPuffs: 3,
      maxPuffs: 5,
      canopyHeight: 3.05,
      squishY: 0.78,
      foliageTextureStyle: 'painted',
      foliageBaseColor: '#54A843',
      foliageBumpStrength: 0.45,
      fruitEnabled: true,
      fruitCount: 16,
      fruitSize: 0.17,
      fruitColor: '#E03939',
      fruitDistribution: 'outerCrown',
      fruitGlow: 0,
    },
  },
  {
    id: 'alpineGradientConifer',
    name: 'Stylized Scalloped Pine',
    species: 'conifer',
    blurb: 'Plump overlapping 5-lobe evergreen fronds with warm lime-to-deep-pine tier gradients',
    swatchHex: '#98D45A',
    accentHex: '#254F24',
    patch: {
      treeType: 'conifer',
      barkStyle: 'pine',
      barkColor: '#8A6248',
      barkLineIntensity: 0.58,
      barkBumpStrength: 0.55,
      trunkHeight: 4.6,
      trunkThickness: 0.92,
      canopyHeight: 1.25,
      coniferTiers: 8,
      coniferLeavesPerTier: 7,
      coniferShape: 'classic',
      coniferScarcity: 0.16,
      coniferDroop: 0.34,
      coniferWidth: 1.54,
      coniferTopColor: '#98D45A',
      coniferBottomColor: '#254F24',
      coniferGradientStrength: 0.92,
      coniferWholeTopColor: '#B8EA5C',
      coniferWholeBottomColor: '#173A24',
      coniferWholeGradientStrength: 0,
      foliageBumpStrength: 0.55,
      hueShift: 0,
      hueVariation: 8,
      windSway: 0.95,
    },
  },
  {
    id: 'snowySpireConifer',
    name: 'Frosted Nordic Spire',
    species: 'conifer',
    blurb: 'Tall snow-kissed evergreen spire with frosty mint tops & deep blue-pine undersides',
    swatchHex: '#B6E4DA',
    accentHex: '#204A52',
    patch: {
      treeType: 'conifer',
      barkStyle: 'rough',
      barkColor: '#523B31',
      barkLineIntensity: 0.5,
      trunkHeight: 5.2,
      trunkThickness: 0.82,
      canopyHeight: 1.15,
      coniferTiers: 8,
      coniferLeavesPerTier: 7,
      coniferShape: 'spire',
      coniferScarcity: 0.24,
      coniferDroop: 0.62,
      coniferWidth: 1.18,
      coniferTopColor: '#CBEAE4',
      coniferBottomColor: '#1E4C52',
      coniferGradientStrength: 0.95,
      coniferWholeTopColor: '#E2F5F2',
      coniferWholeBottomColor: '#183C46',
      coniferWholeGradientStrength: 0.25,
      hueShift: 0,
      hueVariation: 8,
      windSway: 0.82,
    },
  },
  {
    id: 'autumnFireBirch',
    name: 'Autumn Flame Birch',
    species: 'birch',
    blurb: 'White papery birch with tapered drooping twigs & warm red/orange/gold/brown leaves',
    swatchHex: '#E57A25',
    accentHex: '#F4C542',
    patch: {
      treeType: 'birch',
      barkStyle: 'birch',
      barkColor: '#E8E2D8',
      barkLineIntensity: 0.22,
      trunkHeight: 3.55,
      trunkThickness: 0.62,
      trunkLean: 0.34,
      majorBranchCount: 5,
      majorBranchLength: 1.5,
      majorBranchThickness: 0.58,
      majorBranchUpward: 0.72,
      birchTwigDensity: 1.35,
      birchLeafDensity: 1.45,
      birchLeafSize: 1.1,
      birchBranchDroop: 0.42,
      birchLeafColor: '#E8882C',
      hueShift: 0,
      hueVariation: 46,
      saturationShift: 0.14,
      valueShift: 0.04,
      valueVariation: 0.2,
      windSway: 1.25,
    },
  },
  {
    id: 'starlightFantasyElder',
    name: 'Starlight Elder Tree',
    species: 'fantasy',
    blurb: 'Twisted luminescent elderwood, giant arched roots, iridescent clouds & glowing lantern fruit',
    swatchHex: '#6A4FD6',
    accentHex: '#FFE08A',
    patch: {
      treeType: 'fantasy',
      barkStyle: 'fantasy',
      barkColor: '#4A3A63',
      barkLineIntensity: 0.78,
      trunkHeight: 3.4,
      trunkThickness: 1.22,
      trunkLean: 0.56,
      majorBranchCount: 5,
      majorBranchLength: 1.95,
      majorBranchSpread: 1.12,
      majorBranchUpward: 0.64,
      gnarlAmount: 0.82,
      hollowMode: 'lots',
      rootMode: 'all',
      rootCount: 6,
      rootReach: 2.2,
      rootArchHeight: 0.68,
      minPuffs: 4,
      maxPuffs: 6,
      silhouette: 'tiered',
      canopyHeight: 3.75,
      squishY: 0.64,
      foliageTextureStyle: 'softBrush',
      foliageBaseColor: '#58C4E0',
      fruitEnabled: true,
      fruitCount: 16,
      fruitSize: 0.19,
      fruitColor: '#FFE694',
      fruitDistribution: 'hanging',
      fruitGlow: 1.35,
      hueVariation: 34,
      windSway: 1.1,
    },
  },
];
