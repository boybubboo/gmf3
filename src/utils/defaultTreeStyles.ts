import { useEffect, useState } from 'react';
import {
  CANOPY_STYLE_PRESETS,
  EZ_TREE_PRESETS,
  LEAF_SEASON_PRESETS,
  createDefaultCanopyConfig,
  createDefaultSpeciesConfig,
  resolveSpeciesConfig,
} from '../data/canopyEnginePresets';
import type {
  CustomAssetMeta,
  GameLevel,
  StylizedCanopyConfig,
  TreeSpeciesType,
} from '../types/maker';

export type SpawnTreeCategory = 'conifer' | 'oak' | 'birch';

export interface SavedDefaultTreeEntry {
  label: string;
  presetId?: string;
  config: Omit<StylizedCanopyConfig, 'speciesProfiles'>;
}

export interface DefaultTreeStylesPrefs {
  autoApplyOnNewMaps: boolean;
  defaultActiveSpecies?: TreeSpeciesType;
  species: Partial<Record<TreeSpeciesType, SavedDefaultTreeEntry>>;
}

export interface TreeStyleChoiceItem {
  id: string;
  label: string;
  group: 'stylized' | 'ezTree' | 'customAsset';
  blurb: string;
  swatchHex: string;
  accentHex: string;
  buildConfig: () => Omit<StylizedCanopyConfig, 'speciesProfiles'>;
}

export const DEFAULT_TREE_STYLES_STORAGE_KEY = 'maker.defaultTreeStyles.v1';
const DEFAULT_TREES_CHANGED_EVENT = 'maker-default-trees-changed';

const EMPTY_PREFS: DefaultTreeStylesPrefs = {
  autoApplyOnNewMaps: true,
  defaultActiveSpecies: 'oak',
  species: {},
};

let cachedPrefs: DefaultTreeStylesPrefs | null = null;

export function stripCanopyProfiles(
  config: StylizedCanopyConfig
): Omit<StylizedCanopyConfig, 'speciesProfiles'> {
  const { speciesProfiles: _unused, ...rest } = config;
  return JSON.parse(JSON.stringify(rest)) as Omit<StylizedCanopyConfig, 'speciesProfiles'>;
}

function notifyDefaultTreeStylesChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(DEFAULT_TREES_CHANGED_EVENT));
  }
}

export function loadDefaultTreeStyles(): DefaultTreeStylesPrefs {
  if (cachedPrefs) return cachedPrefs;
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...EMPTY_PREFS, species: {} };
  }
  try {
    const raw = window.localStorage.getItem(DEFAULT_TREE_STYLES_STORAGE_KEY);
    if (!raw) {
      cachedPrefs = { ...EMPTY_PREFS, species: {} };
      return cachedPrefs;
    }
    const parsed = JSON.parse(raw) as Partial<DefaultTreeStylesPrefs> | null;
    cachedPrefs = {
      autoApplyOnNewMaps: parsed?.autoApplyOnNewMaps !== false,
      defaultActiveSpecies: parsed?.defaultActiveSpecies ?? 'oak',
      species: parsed?.species && typeof parsed.species === 'object' ? parsed.species : {},
    };
    return cachedPrefs;
  } catch {
    cachedPrefs = { ...EMPTY_PREFS, species: {} };
    return cachedPrefs;
  }
}

function persistDefaultTreeStyles(next: DefaultTreeStylesPrefs) {
  cachedPrefs = next;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(DEFAULT_TREE_STYLES_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota / private mode failures
    }
  }
  notifyDefaultTreeStylesChanged();
}

export function hasCustomDefaultTreeStyles(): boolean {
  const prefs = loadDefaultTreeStyles();
  if (!prefs.autoApplyOnNewMaps) return false;
  return Object.keys(prefs.species).length > 0;
}

export function getSavedDefaultTreeEntry(
  species: TreeSpeciesType
): SavedDefaultTreeEntry | undefined {
  return loadDefaultTreeStyles().species[species];
}

export function saveDefaultTreeStyle(
  species: TreeSpeciesType,
  config: StylizedCanopyConfig | Omit<StylizedCanopyConfig, 'speciesProfiles'>,
  label?: string,
  presetId?: string
): DefaultTreeStylesPrefs {
  const current = loadDefaultTreeStyles();
  const clean = stripCanopyProfiles({
    ...config,
    enabled: true,
    targetTrees: config.targetTrees === 'placedOnly' ? 'matching' : config.targetTrees ?? 'matching',
  });
  const speciesTitle =
    species === 'conifer'
      ? 'Conifer'
      : species === 'birch'
      ? 'Birch'
      : species === 'fantasy'
      ? 'Fantasy'
      : species === 'custom'
      ? config.customTypeName?.trim() || 'Custom'
      : 'Oak';
  const resolvedLabel =
    label?.trim() ||
    (clean.treeGeneratorMode === 'ezTree'
      ? `EZ-Tree ${clean.ezTree?.presetId?.replace(/^ez/, '') || speciesTitle}`
      : `Custom ${speciesTitle}`);

  const next: DefaultTreeStylesPrefs = {
    ...current,
    autoApplyOnNewMaps: true,
    defaultActiveSpecies: current.defaultActiveSpecies ?? species,
    species: {
      ...current.species,
      [species]: {
        label: resolvedLabel,
        presetId,
        config: clean,
      },
    },
  };
  persistDefaultTreeStyles(next);
  return next;
}

export function clearDefaultTreeStyle(species: TreeSpeciesType): DefaultTreeStylesPrefs {
  const current = loadDefaultTreeStyles();
  const nextSpecies = { ...current.species };
  delete nextSpecies[species];
  const next: DefaultTreeStylesPrefs = {
    ...current,
    species: nextSpecies,
  };
  persistDefaultTreeStyles(next);
  return next;
}

export function resetAllDefaultTreeStyles(): DefaultTreeStylesPrefs {
  const next: DefaultTreeStylesPrefs = {
    autoApplyOnNewMaps: true,
    defaultActiveSpecies: 'oak',
    species: {},
  };
  persistDefaultTreeStyles(next);
  return next;
}

export function setAutoApplyDefaultTreeStyles(enabled: boolean): DefaultTreeStylesPrefs {
  const current = loadDefaultTreeStyles();
  const next: DefaultTreeStylesPrefs = {
    ...current,
    autoApplyOnNewMaps: enabled,
  };
  persistDefaultTreeStyles(next);
  return next;
}

export function useDefaultTreeStyles(): DefaultTreeStylesPrefs {
  const [prefs, setPrefs] = useState<DefaultTreeStylesPrefs>(() => loadDefaultTreeStyles());

  useEffect(() => {
    const sync = () => {
      cachedPrefs = null;
      setPrefs(loadDefaultTreeStyles());
    };
    window.addEventListener(DEFAULT_TREES_CHANGED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(DEFAULT_TREES_CHANGED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return prefs;
}

/**
 * Builds a complete `StylizedCanopyConfig` incorporating the user's saved default styles
 * for Conifer, Oak, Birch (and Fantasy/Custom if saved). Returns `undefined` if no custom
 * defaults exist and `opts.forceEnable` is not requested.
 */
export function buildCanopyConfigFromUserDefaults(
  existing?: StylizedCanopyConfig | null,
  opts?: { forceEnable?: boolean; ignoreAutoApplyFlag?: boolean }
): StylizedCanopyConfig | undefined {
  const prefs = loadDefaultTreeStyles();
  const savedEntries = prefs.species;
  const hasSaved = Object.keys(savedEntries).length > 0;
  const shouldApplyDefaults =
    hasSaved && (opts?.ignoreAutoApplyFlag || opts?.forceEnable || prefs.autoApplyOnNewMaps);

  if (!shouldApplyDefaults && !existing) {
    return undefined;
  }

  const baseRoot: StylizedCanopyConfig = existing
    ? {
        ...createDefaultSpeciesConfig(existing.treeType ?? 'oak'),
        ...JSON.parse(JSON.stringify(existing)),
      }
    : createDefaultCanopyConfig({
        treeType: prefs.defaultActiveSpecies ?? 'oak',
        enabled: true,
        targetTrees: 'matching',
      });

  if (!shouldApplyDefaults) {
    return baseRoot;
  }

  const mergedProfiles: Partial<
    Record<TreeSpeciesType, Omit<StylizedCanopyConfig, 'speciesProfiles'>>
  > = {
    ...(baseRoot.speciesProfiles ?? {}),
  };

  for (const [spKey, entry] of Object.entries(savedEntries) as [
    TreeSpeciesType,
    SavedDefaultTreeEntry | undefined,
  ][]) {
    if (!entry?.config) continue;
    mergedProfiles[spKey] = stripCanopyProfiles({
      ...createDefaultSpeciesConfig(entry.config.treeType ?? spKey),
      ...entry.config,
      enabled: true,
      targetTrees: 'matching',
    });
  }

  const rootSpecies: TreeSpeciesType = existing?.treeType ?? prefs.defaultActiveSpecies ?? 'oak';
  const rootOverride = mergedProfiles[rootSpecies];

  const resolvedRoot: StylizedCanopyConfig = rootOverride
    ? {
        ...createDefaultSpeciesConfig(rootOverride.treeType ?? rootSpecies),
        ...JSON.parse(JSON.stringify(rootOverride)),
        enabled: opts?.forceEnable ? true : existing ? existing.enabled || prefs.autoApplyOnNewMaps : true,
        targetTrees:
          baseRoot.targetTrees && baseRoot.targetTrees !== 'placedOnly'
            ? baseRoot.targetTrees
            : 'matching',
        seed: existing?.seed ?? baseRoot.seed,
        speciesProfiles: mergedProfiles,
      }
    : {
        ...baseRoot,
        enabled: opts?.forceEnable ? true : existing ? existing.enabled || prefs.autoApplyOnNewMaps : true,
        targetTrees:
          baseRoot.targetTrees && baseRoot.targetTrees !== 'placedOnly'
            ? baseRoot.targetTrees
            : 'matching',
        speciesProfiles: mergedProfiles,
      };

  return resolvedRoot;
}

export function getDefaultTreeStylesSignature(): string {
  return JSON.stringify(loadDefaultTreeStyles());
}

/**
 * Resolves the exact Stylized/EZ-Tree configuration that should render for a tree species
 * on the 360° horizon vista so distant scenery matches the player's island & default trees.
 */
export function resolveEffectiveVistaTreeConfig(
  level: Pick<GameLevel, 'canopyEngine'>,
  species: SpawnTreeCategory
): StylizedCanopyConfig | null {
  const canopyCfg = level.canopyEngine;
  const canopyActive = Boolean(canopyCfg?.enabled && canopyCfg.targetTrees !== 'placedOnly');
  const prefs = loadDefaultTreeStyles();

  if (canopyActive && canopyCfg) {
    const target = canopyCfg.targetTrees ?? 'matching';
    if (target === 'all') {
      return canopyCfg;
    }
    if (target === 'broadleaf') {
      if (species === 'oak' || species === 'birch') return canopyCfg;
      const savedConifer = prefs.species.conifer?.config;
      if (savedConifer) {
        return {
          ...createDefaultSpeciesConfig(savedConifer.treeType ?? 'conifer'),
          ...savedConifer,
          enabled: true,
          targetTrees: 'matching',
        };
      }
      return null;
    }
    if (target === 'oak') {
      if (species === 'oak') return canopyCfg;
      const savedOther = prefs.species[species]?.config;
      if (savedOther) {
        return {
          ...createDefaultSpeciesConfig(savedOther.treeType ?? species),
          ...savedOther,
          enabled: true,
          targetTrees: 'matching',
        };
      }
      return null;
    }

    // target === 'matching'
    const activeType = canopyCfg.treeType ?? 'oak';
    if (species === 'oak' && (activeType === 'fantasy' || activeType === 'custom')) {
      return canopyCfg;
    }
    if (activeType === species) {
      return canopyCfg;
    }
    if (canopyCfg.speciesProfiles?.[species]) {
      return resolveSpeciesConfig(canopyCfg, species);
    }
    const saved = prefs.species[species]?.config;
    if (saved) {
      return {
        ...createDefaultSpeciesConfig(saved.treeType ?? species),
        ...saved,
        enabled: true,
        targetTrees: 'matching',
      };
    }
    return resolveSpeciesConfig(canopyCfg, species);
  }

  // Fallback for levels without an active canopyEngine: still honor saved Default Spawn Trees
  const saved = prefs.species[species]?.config;
  if (saved) {
    return {
      ...createDefaultSpeciesConfig(saved.treeType ?? species),
      ...saved,
      enabled: true,
      targetTrees: 'matching',
    };
  }
  return null;
}

/**
 * Curated + complete list of built-in Stylized Canopy presets, EZ-Tree Branching presets,
 * and saved Custom Tree Assets available to assign as the default look for Conifers, Oaks, or Birches.
 */
export function getTreeStyleChoiceCatalog(
  slot: SpawnTreeCategory,
  customAssets: CustomAssetMeta[] = []
): TreeStyleChoiceItem[] {
  const choices: TreeStyleChoiceItem[] = [];
  const addedIds = new Set<string>();

  const pushChoice = (item: TreeStyleChoiceItem) => {
    if (addedIds.has(item.id)) return;
    addedIds.add(item.id);
    choices.push(item);
  };

  // 1. Primary Stylized Presets matching the slot species
  for (const preset of CANOPY_STYLE_PRESETS) {
    if (preset.species !== slot) continue;
    pushChoice({
      id: `preset:${preset.id}`,
      label: preset.name,
      group: 'stylized',
      blurb: preset.blurb,
      swatchHex: preset.swatchHex,
      accentHex: preset.accentHex,
      buildConfig: () =>
        stripCanopyProfiles(
          createDefaultSpeciesConfig(preset.species, {
            ...preset.patch,
            enabled: true,
            targetTrees: 'matching',
          })
        ),
    });
  }

  // Extra Stylized variations tailored to each slot
  if (slot === 'conifer') {
    pushChoice({
      id: 'stylized:alpineCedar',
      label: 'Alpine Cedar (Layered)',
      group: 'stylized',
      blurb: 'Wide terraced flat evergreen boughs with cool forest shading',
      swatchHex: '#4E9A52',
      accentHex: '#1D462F',
      buildConfig: () =>
        stripCanopyProfiles(
          createDefaultSpeciesConfig('conifer', {
            enabled: true,
            targetTrees: 'matching',
            coniferShape: 'flatBough',
            coniferTiers: 7,
            coniferLeavesPerTier: 7,
            coniferWidth: 1.72,
            coniferDroop: 0.22,
            coniferTopColor: '#6EBD5C',
            coniferBottomColor: '#1B4634',
            coniferGradientStrength: 0.9,
          })
        ),
    });
    pushChoice({
      id: 'stylized:weepingHemlock',
      label: 'Weeping Hemlock',
      group: 'stylized',
      blurb: 'Gracefully drooping evergreen tiers with deep blue-spruce tones',
      swatchHex: '#70B8B0',
      accentHex: '#1D4454',
      buildConfig: () =>
        stripCanopyProfiles(
          createDefaultSpeciesConfig('conifer', {
            enabled: true,
            targetTrees: 'matching',
            coniferShape: 'weeping',
            coniferTiers: 8,
            coniferLeavesPerTier: 7,
            coniferDroop: 0.72,
            coniferWidth: 1.44,
            coniferTopColor: '#76C2B4',
            coniferBottomColor: '#1B4352',
            coniferGradientStrength: 0.94,
          })
        ),
    });
    pushChoice({
      id: 'stylized:goldenLarch',
      label: 'Golden Larch Conifer',
      group: 'stylized',
      blurb: 'Warm amber-gold needle tiers for autumn & highland forests',
      swatchHex: '#E8B848',
      accentHex: '#6E4622',
      buildConfig: () =>
        stripCanopyProfiles(
          createDefaultSpeciesConfig('conifer', {
            enabled: true,
            targetTrees: 'matching',
            coniferShape: 'classic',
            coniferTopColor: '#E8B848',
            coniferBottomColor: '#6E4622',
            coniferGradientStrength: 0.92,
          })
        ),
    });
  } else if (slot === 'oak') {
    const springSeason = LEAF_SEASON_PRESETS.find((s) => s.id === 'spring');
    const autumnSeason = LEAF_SEASON_PRESETS.find((s) => s.id === 'peakAutumn');
    if (springSeason) {
      pushChoice({
        id: 'stylized:springOak',
        label: 'Spring Meadow Oak',
        group: 'stylized',
        blurb: 'Lush lime-emerald storybook oak with sunlit 3D leaves',
        swatchHex: springSeason.swatchA,
        accentHex: springSeason.swatchB,
        buildConfig: () =>
          stripCanopyProfiles(
            createDefaultSpeciesConfig('oak', {
              enabled: true,
              targetTrees: 'matching',
              canopyLeavesEnabled: true,
              canopyLeafSeason: 'spring',
              canopyLeafColor: springSeason.leafColor,
              foliageBaseColor: springSeason.baseColor,
              canopyBaseTopColor: springSeason.baseTopColor,
              canopyBaseBottomColor: springSeason.baseBottomColor,
            })
          ),
      });
    }
    if (autumnSeason) {
      pushChoice({
        id: 'stylized:autumnOak',
        label: 'Peak Autumn Oak',
        group: 'stylized',
        blurb: 'Fiery amber, crimson & gold broadleaf oak canopy',
        swatchHex: autumnSeason.swatchA,
        accentHex: autumnSeason.swatchB,
        buildConfig: () =>
          stripCanopyProfiles(
            createDefaultSpeciesConfig('oak', {
              enabled: true,
              targetTrees: 'matching',
              canopyLeavesEnabled: true,
              canopyLeafSeason: 'peakAutumn',
              canopyLeafColor: autumnSeason.leafColor,
              canopyLeafHueSpread: autumnSeason.hueSpread,
              foliageBaseColor: autumnSeason.baseColor,
              canopyBaseTopColor: autumnSeason.baseTopColor,
              canopyBaseBottomColor: autumnSeason.baseBottomColor,
            })
          ),
      });
    }
  } else if (slot === 'birch') {
    const springSeason = LEAF_SEASON_PRESETS.find((s) => s.id === 'spring');
    pushChoice({
      id: 'stylized:springBirch',
      label: 'Spring Silver Birch',
      group: 'stylized',
      blurb: 'Crisp white bark & fresh spring lime-green fluttering sprigs',
      swatchHex: springSeason?.swatchA ?? '#A5E655',
      accentHex: '#E8E2D8',
      buildConfig: () =>
        stripCanopyProfiles(
          createDefaultSpeciesConfig('birch', {
            enabled: true,
            targetTrees: 'matching',
            birchLeafColor: '#88CF4B',
            hueVariation: 16,
          })
        ),
    });
  }

  // 2. Matching EZ-Tree Branching presets first, then other EZ-Tree & Stylized presets
  const matchingEz = EZ_TREE_PRESETS.filter((p) => p.species === slot);
  const otherEz = EZ_TREE_PRESETS.filter((p) => p.species !== slot);
  for (const ez of [...matchingEz, ...otherEz]) {
    pushChoice({
      id: `ez:${ez.id}`,
      label: `EZ-Tree · ${ez.name}`,
      group: 'ezTree',
      blurb: ez.blurb,
      swatchHex: ez.swatchHex,
      accentHex: ez.accentHex,
      buildConfig: () =>
        stripCanopyProfiles(
          createDefaultSpeciesConfig(ez.species, {
            enabled: true,
            targetTrees: 'matching',
            treeGeneratorMode: 'ezTree',
            barkStyle: ez.barkStyle,
            barkColor: ez.barkColor,
            ezTree: { ...ez.ezTree },
          })
        ),
    });
  }

  // Remaining Stylized Showcase presets (so e.g. Fantasy Elder can be set for Oaks)
  for (const preset of CANOPY_STYLE_PRESETS) {
    if (preset.species === slot) continue;
    pushChoice({
      id: `preset:${preset.id}`,
      label: preset.name,
      group: 'stylized',
      blurb: preset.blurb,
      swatchHex: preset.swatchHex,
      accentHex: preset.accentHex,
      buildConfig: () =>
        stripCanopyProfiles(
          createDefaultSpeciesConfig(preset.species, {
            ...preset.patch,
            enabled: true,
            targetTrees: 'matching',
          })
        ),
    });
  }

  // 3. User's own saved Tree Maker assets (with treeRecipe)
  for (const asset of customAssets) {
    if (!asset.treeRecipe) continue;
    pushChoice({
      id: `asset:${asset.id}`,
      label: `Saved Tree · ${asset.name}`,
      group: 'customAsset',
      blurb: 'Your saved Tree Maker asset design',
      swatchHex: asset.treeRecipe.foliageBaseColor ?? asset.treeRecipe.coniferTopColor ?? '#20B46A',
      accentHex: asset.treeRecipe.barkColor ?? '#6B4C35',
      buildConfig: () =>
        stripCanopyProfiles({
          ...createDefaultSpeciesConfig(asset.treeRecipe!.treeType ?? slot),
          ...asset.treeRecipe!,
          enabled: true,
          targetTrees: 'matching',
        }),
    });
  }

  return choices;
}
