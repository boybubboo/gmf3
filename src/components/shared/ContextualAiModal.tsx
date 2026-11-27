import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bone,
  Check,
  ChevronDown,
  ChevronUp,
  Cpu,
  ImagePlus,
  Layers,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Sparkles,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import {
  fetchAiProviderStatus,
  fetchLocalAiModels,
  runContextualAiGeneration,
  useAiPreferences,
  type AiProviderKind,
  type AiProviderServerStatus,
} from '../../ai/aiPreferences';
import {
  applyInterfacePlanToStore,
  applyLogicMultiLevelToStore,
  applyWorldTerraformToStore,
  sanitizeCharacterMakerResult,
  sanitizeMonsterResult,
  sanitizeMotionResult,
  sanitizeObjectMakerResult,
  sanitizePlantMakerResult,
  sanitizeTreeCanopyResult,
} from '../../ai/aiAppliers';
import {
  AI_CONTEXT_META,
  DRIVING_WORLD_STARTER_PROMPTS,
  PLATFORMER_WORLD_STARTER_PROMPTS,
  ROGUELIKE_WORLD_STARTER_PROMPTS,
  RPG_WORLD_STARTER_PROMPTS,
  buildContextualAiPrompts,
  type GlbAiSummary,
} from '../../ai/contextPacks';
import {
  getActiveStudioAiBridge,
  resolveContextFromStage,
  useActiveStudioAiBridge,
  type AiReferenceImage,
  type AiStudioContextId,
  type CharacterGuideArchetype,
  type CharacterGuideExtra,
  type CharacterGuideExtremity,
  type CharacterGuideSurface,
  type CharacterPromptGuide,
  type DrivingGuideMod,
  type DrivingGuideVehicleStyle,
  type DrivingPromptGuide,
  type PlatformerGuideMechanic,
  type PlatformerPromptGuide,
  type RoguelikeGuideTrap,
  type RoguelikePromptGuide,
  type RoguelikeScenarioPreset,
  type RpgPromptGuide,
  type RpgScenarioPreset,
} from '../../ai/studioBridge';
import { createEntity } from '../../data/registries';
import type { MakerStore } from '../../store/useMakerStore';
import {
  getCachedAssetSync,
  loadCustomAssetToCache,
} from '../../three/gltfAssetManager';
import { inspectModelSkeleton } from '../../three/proceduralRigAnimator';
import type {
  CustomAssetMeta,
  SideScrollerLayoutStyle,
  SideScrollerThemeId,
} from '../../types/maker';
import { getEnvironmentType } from '../../utils/terrain';

export interface ContextualAiPanelProps {
  store: MakerStore;
  initialContext?: AiStudioContextId;
  embedded?: boolean;
  onClose?: () => void;
}

export interface ContextualAiModalProps {
  store: MakerStore;
  initialContext?: AiStudioContextId;
  onClose: () => void;
}

type ModalTab = 'create' | 'preferences';

const GEMINI_MODELS = [
  { id: 'gemini-4-hydrogen', label: 'Gemini Flash (Fast & Low Cost)' },
  { id: 'gemini-4-neon', label: 'Gemini Pro (Deep Reasoning)' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
];

const DEFAULT_CHARACTER_GUIDE: CharacterPromptGuide = {
  archetype: 'auto',
  extremities: 'auto',
  surface: 'auto',
  extras: [],
};

const CHAR_ARCHETYPE_OPTIONS: { id: CharacterGuideArchetype; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'humanoid', label: 'Human' },
  { id: 'animal', label: 'Animal' },
  { id: 'bird', label: 'Bird' },
  { id: 'fantasy', label: 'Fantasy' },
  { id: 'bug', label: 'Bug' },
];

const CHAR_EXTREMITY_OPTIONS: { id: CharacterGuideExtremity; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'hands', label: 'Hands' },
  { id: 'paw', label: 'Paws' },
  { id: 'claw', label: 'Claws' },
  { id: 'hoof', label: 'Hooves' },
  { id: 'nub', label: 'Nubs' },
];

const CHAR_SURFACE_OPTIONS: { id: CharacterGuideSurface; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'smooth', label: 'Smooth' },
  { id: 'armor', label: 'Armor' },
  { id: 'furShort', label: 'Short Fur' },
  { id: 'furLong', label: 'Fluffy' },
  { id: 'scales', label: 'Scales' },
];

const CHAR_EXTRA_OPTIONS: { id: CharacterGuideExtra; label: string }[] = [
  { id: 'helmetOrHat', label: 'Helmet / Hat' },
  { id: 'pauldronsOrArmor', label: 'Pauldrons' },
  { id: 'capeOrCloak', label: 'Cape' },
  { id: 'beardOrMustache', label: 'Beard' },
  { id: 'eyewear', label: 'Visor / Glasses' },
  { id: 'wings', label: 'Wings' },
  { id: 'horns', label: 'Horns' },
  { id: 'tail', label: 'Tail' },
  { id: 'spikes', label: 'Spikes' },
];

const DEFAULT_PLATFORMER_GUIDE: PlatformerPromptGuide = {
  layoutStyle: 'auto',
  theme: 'auto',
  mechanics: [],
};

const PLATFORMER_LAYOUT_OPTIONS: { id: 'auto' | SideScrollerLayoutStyle; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'flat2D', label: '2D Flat Run' },
  { id: 'verticalClimber', label: 'Tower Climb' },
  { id: 'layeredJungle', label: 'Jungle Canopy' },
  { id: 'underwater', label: 'Underwater' },
  { id: 'skyTemple', label: 'Sky Temple' },
];

const PLATFORMER_THEME_OPTIONS: { id: 'auto' | SideScrollerThemeId; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'sunnyCliffs', label: 'Sunny Cliffs' },
  { id: 'jungleCanopy', label: 'Jungle' },
  { id: 'underwaterCoral', label: 'Coral Reef' },
  { id: 'volcanicForge', label: 'Forge' },
  { id: 'crystalCavern', label: 'Cavern' },
];

const PLATFORMER_MECHANIC_OPTIONS: { id: PlatformerGuideMechanic; label: string }[] = [
  { id: 'movingPlatforms', label: 'Moving Plats' },
  { id: 'vinesAndLadders', label: 'Vines / Ladders' },
  { id: 'secretRooms', label: 'Secret Room' },
  { id: 'springsAndCannons', label: 'Springs & Cannons' },
  { id: 'spinningHazards', label: 'Spin Hazards' },
  { id: 'traps', label: 'Floor Traps' },
  { id: 'platformBaddies', label: 'Branch Baddies' },
];

const DEFAULT_DRIVING_GUIDE: DrivingPromptGuide = {
  vehicleStyle: 'auto',
  trackStyle: 'auto',
  mods: [],
};

const DRIVING_VEHICLE_OPTIONS: { id: DrivingGuideVehicleStyle; label: string; icon: string }[] = [
  { id: 'flintstones', label: 'Flintstones', icon: '🦴' },
  { id: 'f1Racer', label: 'Formula 1', icon: '🏎️' },
  { id: 'sportCoupe', label: 'Sport Coupe / Porsche', icon: '🚗' },
  { id: 'motorbike', label: 'Scrambler Bike', icon: '🏍️' },
  { id: 'trailBuggy', label: 'Trail Buggy', icon: '🚙' },
  { id: 'rallyCoupe', label: 'Rally Coupe', icon: '🏎️' },
  { id: 'forestTruck', label: '4x4 Truck', icon: '🛻' },
  { id: 'vintageRoadster', label: 'Vintage Roadster', icon: '🚘' },
];

const DRIVING_MOD_OPTIONS: { id: DrivingGuideMod; label: string; icon: string }[] = [
  { id: 'thickMagWheels', label: 'Thick Mag Wheels', icon: '🛞' },
  { id: 'stoneRollerWheels', label: 'Stone Rollers', icon: '🪨' },
  { id: 'slickWheels', label: 'F1 Slicks', icon: '🏁' },
  { id: 'tintedSunroof', label: 'Tinted Sunroof', icon: '🪟' },
  { id: 'openRoadster', label: 'Open Roadster', icon: '🕶️' },
  { id: 'chasmGliderWings', label: 'Chasm Glider Wings', icon: '🪽' },
  { id: 'turboJetWings', label: 'Turbo Jet Wings', icon: '🚀' },
  { id: 'neonBoostPads', label: 'Neon Boost Pads', icon: '⚡' },
  { id: 'flightBonusCubes', label: 'Flight Bonus Cubes', icon: '📦' },
  { id: 'stuntRamps', label: 'Timber Stunt Ramps', icon: '📐' },
  { id: 'carvedChasms', label: 'Carved Canyon Chasms', icon: '🏞️' },
];

const DEFAULT_ROGUELIKE_GUIDE: RoguelikePromptGuide = {
  scenario: 'auto',
  traps: [],
  enemyDensity: 'balanced',
  bossTheme: 'auto',
};

const ROGUELIKE_SCENARIO_OPTIONS: { id: RoguelikeScenarioPreset; label: string; icon: string }[] = [
  { id: 'ancientCrypt', label: 'Ancient Crypt', icon: '💀' },
  { id: 'cyberpunkLab', label: 'Cyberpunk Lab', icon: '🤖' },
  { id: 'overgrownJungle', label: 'Jungle Ruins', icon: '🌿' },
  { id: 'volcanicAbyss', label: 'Volcanic Abyss', icon: '🌋' },
  { id: 'frostCitadel', label: 'Frost Citadel', icon: '❄️' },
  { id: 'sunkenTemple', label: 'Sunken Temple', icon: '🌊' },
  { id: 'desertPyramid', label: 'Desert Pyramid', icon: '🏜️' },
  { id: 'astralVoid', label: 'Astral Void', icon: '✨' },
];

const ROGUELIKE_TRAP_OPTIONS: { id: RoguelikeGuideTrap; label: string; icon: string }[] = [
  { id: 'laserTripwires', label: 'Laser Tripwires', icon: '⚡' },
  { id: 'poisonDartPillars', label: 'Poison Darts', icon: '🎯' },
  { id: 'fireGeysers', label: 'Fire Geysers', icon: '🔥' },
  { id: 'frostSpikes', label: 'Frost Spikes', icon: '🧊' },
  { id: 'acidPuddles', label: 'Acid Puddles', icon: '🧪' },
  { id: 'whirlpoolVortex', label: 'Whirlpool Vortex', icon: '🌀' },
  { id: 'sawBlades', label: 'Saw Blades', icon: '🪚' },
  { id: 'ironSpikes', label: 'Iron Spikes', icon: '🗡️' },
  { id: 'emberPlates', label: 'Ember Plates', icon: '♨️' },
  { id: 'cursedRunes', label: 'Cursed Runes', icon: '🔮' },
];

const DEFAULT_RPG_GUIDE: RpgPromptGuide = {
  scenario: 'auto',
  lootStyle: 'mixed',
  companionRecruits: 'knightAndMage',
  worldAtmosphere: 'lushFoggy',
  pathStyle: 'weatheredStone',
};

const RPG_SCENARIO_OPTIONS: { id: RpgScenarioPreset; label: string; icon: string }[] = [
  { id: 'medievalVillage', label: 'Medieval Village', icon: '🏘️' },
  { id: 'jungleRuins', label: 'Jungle Ruins', icon: '🌴' },
  { id: 'deepWoodedForest', label: 'Deep Forest', icon: '🌲' },
  { id: 'stoneTemple', label: 'Stone Temple', icon: '🏛️' },
  { id: 'coastalVillage', label: 'Coastal Village', icon: '⚓' },
  { id: 'interiorCottage', label: 'Cottage Interior', icon: '🕯️' },
  { id: 'interiorTavern', label: 'Tavern Interior', icon: '🍺' },
  { id: 'interiorCave', label: 'Cavern Interior', icon: '💎' },
];

async function encodeReferenceImageFile(file: File): Promise<AiReferenceImage> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not decode selected image.'));
      el.src = objectUrl;
    });
    const maxDim = 896;
    const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
    const w = Math.max(1, Math.round((img.width || 512) * scale));
    const h = Math.max(1, Math.round((img.height || 512) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D unavailable');
    ctx.drawImage(img, 0, 0, w, h);
    const usePng = file.type === 'image/png';
    const mimeType: AiReferenceImage['mimeType'] = usePng ? 'image/png' : 'image/jpeg';
    const dataUrl = canvas.toDataURL(mimeType, 0.86);
    const data = dataUrl.replace(/^data:image\/[a-z0-9+.-]+;base64,/i, '');
    return {
      mimeType,
      data,
      fileName: file.name,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export const ContextualAiPanel: React.FC<ContextualAiPanelProps> = ({
  store,
  initialContext,
  embedded = false,
  onClose,
}) => {
  const activeBridge = useActiveStudioAiBridge();
  const [prefs, updatePrefs, resetPrefs] = useAiPreferences();

  const resolvedContext: AiStudioContextId =
    activeBridge?.context ??
    initialContext ??
    resolveContextFromStage(store.selectedTab);

  const [targetContext, setTargetContext] =
    useState<AiStudioContextId>(resolvedContext);

  useEffect(() => {
    if (activeBridge?.context) {
      setTargetContext(activeBridge.context);
    } else if (initialContext) {
      setTargetContext(initialContext);
    } else {
      setTargetContext(resolveContextFromStage(store.selectedTab));
    }
  }, [activeBridge?.context, initialContext, store.selectedTab]);

  const isSideScrollerWorld =
    targetContext === 'world' &&
    Boolean(store.currentLevel && getEnvironmentType(store.currentLevel) === 'sideScroller');

  const isDrivingWorld =
    targetContext === 'world' &&
    Boolean(store.currentLevel && store.currentLevel.gameplayMode === 'driving');

  const isRoguelikeWorld =
    targetContext === 'world' &&
    Boolean(store.currentLevel && store.currentLevel.gameplayMode === 'roguelike');

  const isRpgWorld =
    targetContext === 'world' &&
    Boolean(store.currentLevel && store.currentLevel.gameplayMode === 'rpg');

  const contextMeta = useMemo(() => {
    const base = AI_CONTEXT_META[targetContext];
    if (isSideScrollerWorld) {
      return {
        ...base,
        title: 'Platformer Director AI',
        tagline:
          'Builds 2D flat runs, vertical towers, layered jungles, underwater worlds, vines, secret rooms & contraptions.',
        starterPrompts: PLATFORMER_WORLD_STARTER_PROMPTS,
      };
    }
    if (isDrivingWorld) {
      return {
        ...base,
        title: 'Vehicle & Driving Course AI',
        tagline:
          'Builds custom vehicles (Flintstones, F1, Porsche coupe, motorbike), thick mags, sunroofs, glider wings & winding island tracks with flight bonus cubes & chasms.',
        starterPrompts: DRIVING_WORLD_STARTER_PROMPTS,
      };
    }
    if (isRoguelikeWorld) {
      return {
        ...base,
        title: 'Roguelike Scenario Director AI',
        tagline:
          'Builds multi-scenario roguelikes (Cyberpunk Lab, Jungle Ruins, Volcanic Abyss, Frost Citadel, Sunken Temple, Desert Pyramid, Astral Void) with themed enemies, traps & bosses.',
        starterPrompts: ROGUELIKE_WORLD_STARTER_PROMPTS,
      };
    }
    if (isRpgWorld) {
      return {
        ...base,
        title: 'Isometric RPG World Director AI',
        tagline:
          'Builds detailed medieval villages, vine-draped jungle ruins, deep forests & cutaway interiors with companions, weathered stone/rope bridges, volumetric lanterns & fanned reward cards.',
        starterPrompts: RPG_WORLD_STARTER_PROMPTS,
      };
    }
    return base;
  }, [targetContext, isSideScrollerWorld, isDrivingWorld, isRoguelikeWorld, isRpgWorld]);

  const [tab, setTab] = useState<ModalTab>('create');
  const [prompt, setPrompt] = useState<string>('');
  const [modifyExisting, setModifyExisting] = useState<boolean>(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const [lastRawData, setLastRawData] = useState<Record<string, unknown> | null>(
    null
  );
  const [lastModelUsed, setLastModelUsed] = useState<string | null>(null);
  const [showJsonPreview, setShowJsonPreview] = useState(false);
  const [appliedOnce, setAppliedOnce] = useState(false);

  // Preferences server status & local models probe
  const [serverStatus, setServerStatus] = useState<AiProviderServerStatus | null>(
    null
  );
  const [localModels, setLocalModels] = useState<string[]>([]);
  const [probingLocal, setProbingLocal] = useState(false);
  const [probeError, setProbeError] = useState<string | null>(null);

  // Optional GLB Rig Inspector state
  const glbInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedGlbAssetId, setSelectedGlbAssetId] = useState<string | null>(
    () => store.motionAssetId ?? null
  );
  const [glbSummary, setGlbSummary] = useState<GlbAiSummary | null>(null);
  const [loadingGlb, setLoadingGlb] = useState(false);

  // Optional Multimodal Reference Image & Character Prompt Helper
  const refImageInputRef = useRef<HTMLInputElement | null>(null);
  const [referenceImage, setReferenceImage] = useState<AiReferenceImage | null>(null);
  const [loadingRefImage, setLoadingRefImage] = useState(false);
  const [showCharGuide, setShowCharGuide] = useState(true);
  const [characterGuide, setCharacterGuide] = useState<CharacterPromptGuide>(
    DEFAULT_CHARACTER_GUIDE
  );
  const [showPlatGuide, setShowPlatGuide] = useState(true);
  const [platformerGuide, setPlatformerGuide] = useState<PlatformerPromptGuide>(
    DEFAULT_PLATFORMER_GUIDE
  );
  const [showDrivingGuide, setShowDrivingGuide] = useState(true);
  const [drivingGuide, setDrivingGuide] = useState<DrivingPromptGuide>(
    DEFAULT_DRIVING_GUIDE
  );
  const [showRoguelikeGuide, setShowRoguelikeGuide] = useState(true);
  const [roguelikeGuide, setRoguelikeGuide] = useState<RoguelikePromptGuide>(
    DEFAULT_ROGUELIKE_GUIDE
  );
  const [showRpgGuide, setShowRpgGuide] = useState(true);
  const [rpgGuide, setRpgGuide] = useState<RpgPromptGuide>(DEFAULT_RPG_GUIDE);

  useEffect(() => {
    void fetchAiProviderStatus()
      .then((s) => setServerStatus(s))
      .catch(() => setServerStatus(null));
  }, []);

  // Load GLB inspection when an asset ID is chosen
  useEffect(() => {
    if (!selectedGlbAssetId) {
      setGlbSummary(null);
      return;
    }
    const meta = store.customAssets.find((a) => a.id === selectedGlbAssetId);
    if (!meta) return;

    let cancelled = false;
    const populateFromCached = async () => {
      setLoadingGlb(true);
      try {
        const cached =
          getCachedAssetSync(meta.id) ??
          (await loadCustomAssetToCache(meta.id, meta.category));
        if (cancelled || !cached) return;
        setGlbSummary({
          fileName: meta.fileName || meta.name,
          inspection: cached.skeletonInfo,
          animationClips: meta.animationClips ?? [],
        });
      } finally {
        if (!cancelled) setLoadingGlb(false);
      }
    };
    void populateFromCached();
    return () => {
      cancelled = true;
    };
  }, [selectedGlbAssetId, store.customAssets]);

  const glbCandidates = useMemo(
    () =>
      store.customAssets.filter(
        (a) => a.hasSkeleton || a.category === 'character' || a.boneNames?.length
      ),
    [store.customAssets]
  );

  const buildCurrentSnapshot = (): Record<string, unknown> => {
    const liveBridge = activeBridge ?? getActiveStudioAiBridge();
    if (
      liveBridge &&
      (liveBridge.context === targetContext ||
        (liveBridge.context === 'creature' && (targetContext === 'creature' || targetContext === 'cast')))
    ) {
      return liveBridge.getSnapshot();
    }
    const lvl = store.currentLevel;
    const proj = store.currentProject;

    if (targetContext === 'world' && lvl) {
      const envType = getEnvironmentType(lvl);
      return {
        levelName: lvl.name,
        gameplayMode: lvl.gameplayMode,
        drivingConfig: lvl.drivingConfig,
        environmentType: envType,
        worldEditorScope: store.worldEditorScope,
        biome: lvl.biome,
        sky: lvl.sky,
        weather: lvl.weather,
        sideScrollerConfig: envType === 'sideScroller' ? lvl.sideScrollerConfig ?? null : undefined,
        dungeonStyle: lvl.dungeonStyle ?? lvl.roguelikeConfig?.dungeonStyle,
        roguelikeConfig: lvl.roguelikeConfig,
        vistaPreset: lvl.vistaPreset ?? 'none',
        mountainConfig: lvl.terrain?.mountainConfig ?? null,
        cavesCount: lvl.terrain?.caves?.length ?? 0,
        caveNames: (lvl.terrain?.caves ?? []).map((c) => c.name),
        roadsCount: lvl.terrain?.roads?.length ?? 0,
        roadNames: (lvl.terrain?.roads ?? []).map((r) => r.name),
        waterCount: lvl.terrain?.waterBodies?.length ?? 0,
        waterNames: (lvl.terrain?.waterBodies ?? []).map((w) => w.name),
        entityCount: lvl.entities.length,
        landmarkNames: lvl.entities.map((e) => `${e.name} (${e.kind})`).slice(0, 24),
      };
    }

    if (targetContext === 'logic' && proj) {
      return {
        projectTitle: proj.name,
        heroName: proj.heroName,
        levels: proj.levels.map((l) => ({
          name: l.name,
          biome: l.biome,
          entities: l.entities.length,
          completeCondition: l.completeCondition,
        })),
      };
    }

    if (targetContext === 'motion') {
      return {
        boneNames: glbSummary?.inspection.boneNames ?? [],
        autoBoneMap: glbSummary?.inspection.autoBoneMap ?? {},
        selectedAssetId: selectedGlbAssetId,
      };
    }

    if (targetContext === 'cast' && lvl) {
      return {
        levelName: lvl.name,
        castNames: lvl.entities
          .filter((e) => e.kind === 'npc' || e.kind === 'baddie')
          .map((e) => `${e.name} (${e.kind}${e.isBoss ? ', boss' : ''})`),
        savedMonsters: (proj?.customMonsters ?? []).map((m) => m.name),
      };
    }

    if (targetContext === 'interface' && proj) {
      return {
        themeName: proj.hud.themeName,
        widgetCount: proj.hud.widgets.length,
        widgets: proj.hud.widgets.map((w) => ({
          kind: w.kind,
          label: w.label,
          anchor: w.anchor,
        })),
        storybookEnabled: Boolean(proj.storybook?.enabled),
      };
    }

    return { projectName: proj?.name ?? 'Maker Game' };
  };

  const applyGeneratedData = (
    data: Record<string, unknown>,
    useModify: boolean
  ): string => {
    const activeCharGuide =
      targetContext === 'character' ? characterGuide : undefined;
    const liveBridge = activeBridge ?? getActiveStudioAiBridge();
    if (
      liveBridge &&
      (liveBridge.context === targetContext ||
        (liveBridge.context === 'creature' && (targetContext === 'creature' || targetContext === 'cast')))
    ) {
      return liveBridge.applyResult(data, {
        modifyExisting: useModify,
        characterGuide: activeCharGuide,
      });
    }

    if (targetContext === 'world') {
      return applyWorldTerraformToStore(store, data, {
        modifyExisting: useModify,
        platformerGuide: isSideScrollerWorld ? platformerGuide : undefined,
        drivingGuide: isDrivingWorld ? drivingGuide : undefined,
        roguelikeGuide: isRoguelikeWorld ? roguelikeGuide : undefined,
        rpgGuide: isRpgWorld ? rpgGuide : undefined,
      });
    }
    if (targetContext === 'logic') {
      return applyLogicMultiLevelToStore(store, data, { modifyExisting: useModify });
    }
    if (targetContext === 'interface') {
      return applyInterfacePlanToStore(store, data, { modifyExisting: useModify });
    }
    if (targetContext === 'cast' || targetContext === 'creature') {
      const selectedEnt = store.currentEntity;
      const baseBlueprint =
        useModify && selectedEnt?.monsterConfig
          ? selectedEnt.monsterConfig
          : useModify && selectedEnt
          ? store.currentProject?.customMonsters?.find(
              (m) => m.name.toLowerCase() === selectedEnt.name.toLowerCase()
            )
          : undefined;
      const { blueprint, summary } = sanitizeMonsterResult(data, baseBlueprint);
      store.saveCustomMonster(blueprint);
      if (
        selectedEnt &&
        (selectedEnt.kind === 'baddie' || selectedEnt.kind === 'npc' || selectedEnt.monsterConfig)
      ) {
        store.updateEntity(selectedEnt.id, 'AI replace creature', (prev) => ({
          ...prev,
          name: blueprint.name,
          kind: blueprint.role === 'baddie' ? 'baddie' : 'npc',
          isBuddy: blueprint.role === 'buddy',
          isBoss: Boolean(blueprint.isBoss),
          brain: blueprint.canFly ? 'Flyer' : blueprint.role === 'baddie' ? 'Chaser' : 'Walker',
          speed: blueprint.speed ?? 4,
          health: blueprint.health ?? (blueprint.role === 'baddie' ? 5 : 4),
          dialogue: blueprint.dialogue ?? prev.dialogue,
          monsterConfig: blueprint,
        }));
        return `${summary} (replaced active ${selectedEnt.name} in viewport)`;
      } else {
        const spawned = store.spawnMonsterEntity(blueprint);
        store.setSelectedEntityID(spawned.id);
        return `${summary} (placed and active in viewport)`;
      }
    }
    if (targetContext === 'character') {
      const baseDoc = useModify ? store.customAssets.find((a) => a.id === store.currentProject?.heroCustomAssetId)?.characterRecipe : undefined;
      const res = sanitizeCharacterMakerResult(data, baseDoc, characterGuide);
      store.updateProject('AI update hero character', (prev) => ({
        ...prev,
        heroName: res.name,
      }));
      return `${res.summary} (replaced Hero in viewport)`;
    }
    if (targetContext === 'object') {
      const selectedEnt = store.currentEntity;
      const baseCustomAsset =
        useModify && selectedEnt?.customAssetId
          ? store.customAssets.find((a) => a.id === selectedEnt.customAssetId)
          : undefined;
      const baseDoc = baseCustomAsset?.objectRecipe ?? undefined;
      const res = sanitizeObjectMakerResult(data, {
        doc: baseDoc ?? { version: 1, parts: [], groups: [] },
        mechanisms: selectedEnt?.mechanisms ?? [],
        name: selectedEnt?.name,
        modifyExisting: useModify,
      });
      if (selectedEnt) {
        store.updateEntity(selectedEnt.id, 'AI replace object', (prev) => ({
          ...prev,
          name: res.name,
          mechanisms: res.mechanisms,
        }));
        return `${res.summary} (replaced ${selectedEnt.name} in viewport)`;
      } else {
        const curLevel = store.currentLevel;
        if (curLevel) {
          const ent = createEntity('prop', res.name, 0.5, 0.5, {
            mechanisms: res.mechanisms,
          });
          store.updateLevel(`place ${res.name}`, (lvl) => ({
            ...lvl,
            entities: [...lvl.entities, ent],
          }));
          store.setSelectedEntityID(ent.id);
        }
        return `${res.summary} (placed in level & selected in viewport)`;
      }
    }
    if (targetContext === 'plant') {
      const selectedEnt = store.currentEntity;
      const baseCustomAsset =
        useModify && selectedEnt?.customAssetId
          ? store.customAssets.find((a) => a.id === selectedEnt.customAssetId)
          : undefined;
      const baseDoc = baseCustomAsset?.objectRecipe ?? undefined;
      const res = sanitizePlantMakerResult(data, {
        doc: baseDoc ?? { version: 1, parts: [], groups: [] },
        name: selectedEnt?.name,
        modifyExisting: useModify,
      });
      if (selectedEnt) {
        store.updateEntity(selectedEnt.id, 'AI replace plant', (prev) => ({
          ...prev,
          name: res.name,
        }));
        return `${res.summary} (replaced ${selectedEnt.name} in viewport)`;
      } else {
        const curLevel = store.currentLevel;
        if (curLevel) {
          const ent = createEntity('prop', res.name, 0.5, 0.5, {});
          store.updateLevel(`place ${res.name}`, (lvl) => ({
            ...lvl,
            entities: [...lvl.entities, ent],
          }));
          store.setSelectedEntityID(ent.id);
        }
        return `${res.summary} (placed in level & selected in viewport)`;
      }
    }
    if (targetContext === 'tree') {
      const selectedEnt = store.currentEntity;
      const baseCfg =
        useModify && selectedEnt?.canopyTree ? selectedEnt.canopyTree : undefined;
      const res = sanitizeTreeCanopyResult(data, baseCfg);
      if (selectedEnt) {
        store.updateEntity(selectedEnt.id, 'AI replace tree', (prev) => ({
          ...prev,
          name: res.name,
          canopyTree: res.config,
        }));
        return `${res.summary} (replaced ${selectedEnt.name} in viewport)`;
      } else {
        const curLevel = store.currentLevel;
        if (curLevel) {
          const ent = createEntity('scenery', res.name, 0.5, 0.5, { canopyTree: res.config });
          store.updateLevel(`place ${res.name}`, (lvl) => ({
            ...lvl,
            entities: [...lvl.entities, ent],
          }));
          store.setSelectedEntityID(ent.id);
        }
        return `${res.summary} (placed in level & selected in viewport)`;
      }
    }
    if (targetContext === 'motion') {
      const bones = glbSummary?.inspection.boneNames ?? [];
      const autoMap = glbSummary?.inspection.autoBoneMap ?? {};
      const { preset, summary } = sanitizeMotionResult(data, bones, autoMap);
      if (selectedGlbAssetId) {
        const asset = store.customAssets.find((a) => a.id === selectedGlbAssetId);
        if (asset) {
          void store.saveUniversalMotionPreset(
            preset,
            { kind: 'customAsset', category: 'hero', assetId: asset.id, label: asset.name },
            asset
          );
          return `${summary} (saved onto ${asset.name})`;
        }
      }
      void store.saveUniversalMotionPreset(preset, {
        kind: 'builtInHero',
        category: 'hero',
        label: store.currentProject?.heroName || 'Hero',
      });
      return `${summary} (saved to Hero Motion Library)`;
    }

    return 'Generated preview ready. Open its matching studio to apply.';
  };

  const handleGenerate = async () => {
    const effectiveRequest =
      prompt.trim() ||
      (referenceImage
        ? 'Build a faithful 3D Maker model matching the uploaded visual guide image.'
        : '');
    if (!effectiveRequest || generating) return;
    setGenerating(true);
    setErrorMsg(null);
    setStatusBanner(null);
    setAppliedOnce(false);

    try {
      const snapshot = buildCurrentSnapshot();
      const { systemPrompt, userPrompt } = buildContextualAiPrompts({
        context: targetContext,
        userRequest: effectiveRequest,
        snapshot,
        glbSummary,
        modifyExisting,
        characterGuide: targetContext === 'character' ? characterGuide : undefined,
        platformerGuide: isSideScrollerWorld ? platformerGuide : undefined,
        drivingGuide: isDrivingWorld ? drivingGuide : undefined,
        roguelikeGuide: isRoguelikeWorld ? roguelikeGuide : undefined,
        rpgGuide: isRpgWorld ? rpgGuide : undefined,
        hasReferenceImage: Boolean(referenceImage),
      });

      const res = await runContextualAiGeneration({
        prefs,
        systemPrompt,
        userPrompt,
        referenceImage,
      });

      setLastRawData(res.data);
      setLastModelUsed(res.modelUsed);

      if (prefs.autoApplyOnGenerate) {
        const summary = applyGeneratedData(res.data, modifyExisting);
        setAppliedOnce(true);
        setStatusBanner(summary);
      } else {
        setStatusBanner(
          `Generated with ${res.modelUsed}. Click "Apply to Viewport" to load it.`
        );
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'AI generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  const handleUploadRefImage = async (file: File) => {
    setLoadingRefImage(true);
    setErrorMsg(null);
    try {
      const encoded = await encodeReferenceImageFile(file);
      setReferenceImage(encoded);
      setStatusBanner(`Attached guide image "${file.name}".`);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Could not load guide image.'
      );
    } finally {
      setLoadingRefImage(false);
    }
  };

  const handleApplyToStudio = () => {
    if (!lastRawData) return;
    setErrorMsg(null);
    try {
      const msg = applyGeneratedData(lastRawData, modifyExisting);
      setAppliedOnce(true);
      setStatusBanner(msg);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to apply result.');
    }
  };

  const handleSaveToRelativeArea = async () => {
    if (!lastRawData || saving) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      if (!appliedOnce) {
        applyGeneratedData(lastRawData, modifyExisting);
        setAppliedOnce(true);
      }
      const suggestedName =
        typeof lastRawData.name === 'string' ? lastRawData.name : undefined;

      const liveBridge = activeBridge ?? getActiveStudioAiBridge();
      if (
        liveBridge &&
        (liveBridge.context === targetContext ||
          (liveBridge.context === 'creature' && (targetContext === 'creature' || targetContext === 'cast'))) &&
        liveBridge.saveAsset
      ) {
        const savedNote = await liveBridge.saveAsset(suggestedName);
        setStatusBanner(savedNote || `Saved to ${contextMeta.saveAreaLabel}!`);
      } else if (targetContext === 'cast' || targetContext === 'creature') {
        setStatusBanner('Saved creature & placed into level.');
      } else {
        setStatusBanner(`Applied and persisted to project (${contextMeta.saveAreaLabel}).`);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not save asset.');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadGlb = async (file: File) => {
    setLoadingGlb(true);
    setErrorMsg(null);
    try {
      const cat =
        targetContext === 'object'
          ? 'prop'
          : targetContext === 'plant'
          ? 'plant'
          : targetContext === 'tree'
          ? 'tree'
          : 'character';
      const meta: CustomAssetMeta = await store.uploadCustomGlb(file, cat);
      const cached =
        getCachedAssetSync(meta.id) ??
        (await loadCustomAssetToCache(meta.id, meta.category));
      const inspection =
        cached?.skeletonInfo ?? inspectModelSkeleton(cached?.scene ?? ({} as never));
      setSelectedGlbAssetId(meta.id);
      setGlbSummary({
        fileName: meta.fileName,
        inspection,
        animationClips: meta.animationClips ?? [],
      });
      if (targetContext === 'motion') {
        store.setMotionAssetId(meta.id);
      }
      setStatusBanner(
        inspection.hasSkeleton
          ? `Recognized GLB rig "${meta.name}" with ${inspection.boneNames.length} bones.`
          : `Loaded GLB "${meta.name}" (static mesh, no skeleton bones).`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'GLB inspection failed.');
    } finally {
      setLoadingGlb(false);
    }
  };

  const handleProbeLocalModels = async () => {
    setProbingLocal(true);
    setProbeError(null);
    try {
      const models = await fetchLocalAiModels(prefs.localBaseUrl);
      setLocalModels(models);
      if (models.length > 0 && !models.includes(prefs.localModel)) {
        updatePrefs({ localModel: models[0] });
      }
      if (models.length === 0) {
        setProbeError('Connected, but no models were listed.');
      }
    } catch (err) {
      setLocalModels([]);
      setProbeError(
        err instanceof Error
          ? err.message
          : 'Could not reach local AI server on localhost.'
      );
    } finally {
      setProbingLocal(false);
    }
  };

  const allowContextPicker = !activeBridge;

  const selectableContexts: AiStudioContextId[] = [
    'world',
    'logic',
    'character',
    'creature',
    'motion',
    'object',
    'plant',
    'tree',
    'interface',
  ];

  const handleSwitchTargetContext = (ctx: AiStudioContextId) => {
    setTargetContext(ctx);
    setLastRawData(null);
    setAppliedOnce(false);
    setErrorMsg(null);
    setStatusBanner(null);
  };

  const handleQuickJumpToStudio = () => {
    if (targetContext === 'object') store.openObjectMaker();
    else if (targetContext === 'plant') store.openPlantMaker();
    else if (targetContext === 'tree') store.openTreeMaker();
    else if (targetContext === 'character') store.openCharacterMaker();
    else if (targetContext === 'creature') store.openMonsterMaker();
    else if (targetContext === 'motion') store.setSelectedTab('motion');
    else if (targetContext === 'logic') store.setSelectedTab('logic');
    else if (targetContext === 'world') store.setSelectedTab('world');
    else if (targetContext === 'interface') store.setSelectedTab('interface');
  };

  const providerBadgeText =
    prefs.provider === 'local'
      ? `Local (${prefs.localModel})`
      : prefs.provider === 'openaiCompat'
      ? `Compat (${prefs.openaiModel})`
      : `Gemini (${prefs.geminiModel === 'gemini-4-neon' ? 'Pro' : 'Flash'})`;

  const generatedName =
    lastRawData && typeof lastRawData.name === 'string'
      ? lastRawData.name
      : lastRawData && typeof lastRawData.projectTitle === 'string'
      ? lastRawData.projectTitle
      : null;
  const generatedSummary =
    lastRawData && typeof lastRawData.summary === 'string'
      ? lastRawData.summary
      : null;

  return (
    <div
      className={
        embedded
          ? 'h-full min-h-0 flex flex-col bg-white dark:bg-[#171A23] text-slate-900 dark:text-[#F3F5FA]'
          : 'w-full h-full rounded-2xl bg-[#141720] text-[#F3F5FA] border border-white/15 shadow-2xl flex flex-col overflow-hidden'
      }
    >
      {/* Top Studio Bar */}
      <header
        className={`shrink-0 px-3 py-2.5 border-b space-y-2 ${
          embedded
            ? 'bg-slate-50/90 dark:bg-[#131720] border-slate-200/80 dark:border-white/[0.08]'
            : 'bg-[#171A23] border-white/[0.08]'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{
                backgroundColor: `${contextMeta.accentHex}22`,
                color: contextMeta.accentHex,
                border: `1px solid ${contextMeta.accentHex}44`,
              }}
            >
              <Wand2 size={15} />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs font-extrabold tracking-tight truncate">
                {contextMeta.title}
              </h2>
              <p
                className={`text-[10px] truncate ${
                  embedded ? 'text-slate-500 dark:text-[#949BB0]' : 'text-[#949BB0]'
                }`}
              >
                {activeBridge
                  ? `Connected live to ${activeBridge.title}`
                  : contextMeta.tagline}
              </p>
            </div>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Close AI panel (restore Assets / Contents underneath)"
              aria-label="Close AI Creator"
              className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                embedded
                  ? 'text-slate-500 hover:text-slate-900 dark:text-[#949BB0] dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-[#1F2430]'
                  : 'text-[#949BB0] hover:text-white hover:bg-white/[0.08]'
              }`}
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-1.5">
          <div
            className={`inline-flex p-0.5 rounded-xl border ${
              embedded
                ? 'bg-slate-200/70 dark:bg-[#0F1117] border-slate-200/80 dark:border-white/[0.08]'
                : 'bg-[#0F1117] border-white/[0.08]'
            }`}
          >
            <button
              type="button"
              onClick={() => setTab('create')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 whitespace-nowrap transition-colors ${
                tab === 'create'
                  ? 'bg-[#7C5CFF] text-white'
                  : embedded
                  ? 'text-slate-600 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white'
                  : 'text-[#949BB0] hover:text-white'
              }`}
            >
              <Sparkles size={11} />
              <span>Assistant</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('preferences')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 whitespace-nowrap transition-colors ${
                tab === 'preferences'
                  ? 'bg-[#7C5CFF] text-white'
                  : embedded
                  ? 'text-slate-600 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white'
                  : 'text-[#949BB0] hover:text-white'
              }`}
            >
              <SlidersHorizontal size={11} />
              <span>Preferences</span>
            </button>
          </div>

          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap truncate max-w-[140px] ${
              embedded
                ? 'bg-slate-200/70 dark:bg-white/[0.06] text-slate-600 dark:text-[#949BB0]'
                : 'bg-white/[0.06] text-[#949BB0]'
            }`}
            title={providerBadgeText}
          >
            <Sparkles size={9} className="text-[#F59E0B] shrink-0" />
            <span className="truncate">{providerBadgeText}</span>
          </span>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto maker-scroll p-3 space-y-3">
        {tab === 'create' ? (
          <>
            {/* Context Switcher when invoked from main top bar */}
            {allowContextPicker && (
              <div className="space-y-1.5">
                <div
                  className={`flex items-center justify-between text-[10px] font-bold ${
                    embedded ? 'text-slate-500 dark:text-[#949BB0]' : 'text-[#949BB0]'
                  }`}
                >
                  <span>Target Studio Context</span>
                  {!['world', 'logic', 'motion', 'interface', 'cast'].includes(
                    targetContext
                  ) && (
                    <button
                      type="button"
                      onClick={handleQuickJumpToStudio}
                      className="text-[#7C5CFF] hover:underline font-bold"
                    >
                      Open Studio →
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {selectableContexts.map((ctxId) => {
                    const meta = AI_CONTEXT_META[ctxId];
                    const active = ctxId === targetContext;
                    return (
                      <button
                        key={ctxId}
                        type="button"
                        onClick={() => handleSwitchTargetContext(ctxId)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors whitespace-nowrap ${
                          active
                            ? 'text-white shadow-xs'
                            : embedded
                            ? 'bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#949BB0] border border-slate-200/70 dark:border-white/[0.08] hover:text-slate-900 dark:hover:text-white'
                            : 'bg-[#171A23] text-[#949BB0] border border-white/[0.08] hover:text-white'
                        }`}
                        style={
                          active
                            ? { backgroundColor: meta.accentHex }
                            : undefined
                        }
                      >
                        {meta.title.replace(' AI', '')}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* GLB Rig Recognition Strip */}
            {(targetContext === 'motion' ||
              targetContext === 'character' ||
              targetContext === 'creature' ||
              targetContext === 'object') && (
              <div
                className={`p-2.5 rounded-xl border space-y-2 ${
                  embedded
                    ? 'bg-slate-50 dark:bg-[#12151E] border-slate-200/80 dark:border-white/[0.08]'
                    : 'bg-[#171A23] border-white/[0.08]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold">
                    <Bone size={13} className="text-[#38BDF8]" />
                    <span>GLB Rig Recognition</span>
                    {loadingGlb && (
                      <Loader2 size={11} className="animate-spin text-[#38BDF8]" />
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {glbCandidates.length > 0 && (
                      <select
                        value={selectedGlbAssetId ?? ''}
                        onChange={(e) =>
                          setSelectedGlbAssetId(e.target.value || null)
                        }
                        className={`h-7 px-2 rounded-lg border text-[10px] font-semibold max-w-[145px] ${
                          embedded
                            ? 'bg-white dark:bg-[#0F1117] border-slate-200 dark:border-white/10 text-slate-900 dark:text-[#F3F5FA]'
                            : 'bg-[#0F1117] border-white/10 text-[#F3F5FA]'
                        }`}
                      >
                        <option value="">Built-in SDF / Rig</option>
                        {glbCandidates.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({a.boneNames?.length ?? 0})
                          </option>
                        ))}
                      </select>
                    )}

                    <input
                      ref={glbInputRef}
                      type="file"
                      accept=".glb,.gltf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleUploadGlb(file);
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => glbInputRef.current?.click()}
                      className="h-7 px-2 rounded-lg bg-[#38BDF8]/15 hover:bg-[#38BDF8]/25 text-[#0284C7] dark:text-[#38BDF8] text-[10px] font-bold inline-flex items-center gap-1 whitespace-nowrap"
                    >
                      <Upload size={10} />
                      <span>Load .GLB</span>
                    </button>
                  </div>
                </div>

                {glbSummary && (
                  <div
                    className={`text-[10px] flex flex-wrap items-center gap-x-2 gap-y-0.5 ${
                      embedded ? 'text-slate-600 dark:text-[#949BB0]' : 'text-[#949BB0]'
                    }`}
                  >
                    <strong className={embedded ? 'text-slate-900 dark:text-[#F3F5FA]' : 'text-[#F3F5FA]'}>
                      {glbSummary.fileName}
                    </strong>
                    <span>
                      {glbSummary.inspection.hasSkeleton
                        ? `${glbSummary.inspection.boneNames.length} bones`
                        : 'Static mesh'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Visual Guide Image Upload (Multimodal) */}
            {(targetContext === 'character' ||
              targetContext === 'creature' ||
              targetContext === 'object' ||
              targetContext === 'plant' ||
              targetContext === 'tree') && (
              <div
                className={`p-2.5 rounded-xl border space-y-2 ${
                  embedded
                    ? 'bg-slate-50 dark:bg-[#12151E] border-slate-200/80 dark:border-white/[0.08]'
                    : 'bg-[#171A23] border-white/[0.08]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold">
                    <ImagePlus size={13} className="text-[#A855F7]" />
                    <span>Guide Image (Optional)</span>
                    {loadingRefImage && (
                      <Loader2 size={11} className="animate-spin text-[#A855F7]" />
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      ref={refImageInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleUploadRefImage(file);
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => refImageInputRef.current?.click()}
                      className="h-7 px-2 rounded-lg bg-[#A855F7]/15 hover:bg-[#A855F7]/25 text-[#9333EA] dark:text-[#C084FC] text-[10px] font-bold inline-flex items-center gap-1 whitespace-nowrap"
                    >
                      <Upload size={10} />
                      <span>{referenceImage ? 'Change' : 'Load Image'}</span>
                    </button>
                    {referenceImage && (
                      <button
                        type="button"
                        onClick={() => setReferenceImage(null)}
                        title="Remove guide image"
                        className="h-7 w-7 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-500 inline-flex items-center justify-center"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                </div>
                {referenceImage ? (
                  <div className="flex items-center gap-2.5">
                    <img
                      src={`data:${referenceImage.mimeType};base64,${referenceImage.data}`}
                      alt={referenceImage.fileName || 'Guide preview'}
                      className="w-12 h-12 rounded-lg object-cover border border-white/15 shrink-0"
                    />
                    <div className="min-w-0 text-[10px] leading-snug">
                      <div className="font-bold truncate">
                        {referenceImage.fileName || 'Reference Guide'}
                      </div>
                      <div
                        className={
                          embedded ? 'text-slate-500 dark:text-[#949BB0]' : 'text-[#949BB0]'
                        }
                      >
                        AI will match proportions, colors &amp; silhouette from this image.
                      </div>
                    </div>
                  </div>
                ) : (
                  <p
                    className={`text-[10px] leading-snug ${
                      embedded ? 'text-slate-500 dark:text-[#949BB0]' : 'text-[#949BB0]'
                    }`}
                  >
                    Attach concept art or a sketch so the AI mirrors colors, silhouette &amp; gear.
                  </p>
                )}
              </div>
            )}

            {/* Character Prompt Helper Checklist */}
            {targetContext === 'character' && (
              <div
                className={`p-2.5 rounded-xl border space-y-2 ${
                  embedded
                    ? 'bg-slate-50 dark:bg-[#12151E] border-slate-200/80 dark:border-white/[0.08]'
                    : 'bg-[#171A23] border-white/[0.08]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCharGuide((v) => !v)}
                    className="flex items-center gap-1.5 text-[11px] font-bold text-left"
                  >
                    {showCharGuide ? (
                      <ChevronUp size={13} className="text-[#A855F7]" />
                    ) : (
                      <ChevronDown size={13} className="text-[#A855F7]" />
                    )}
                    <span>Character Prompt Helper</span>
                  </button>
                  {(characterGuide.archetype !== 'auto' ||
                    characterGuide.extremities !== 'auto' ||
                    characterGuide.surface !== 'auto' ||
                    characterGuide.extras.length > 0) && (
                    <button
                      type="button"
                      onClick={() => setCharacterGuide(DEFAULT_CHARACTER_GUIDE)}
                      className="text-[10px] font-bold text-[#A855F7] hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {showCharGuide && (
                  <div className="space-y-2 pt-0.5">
                    <div className="space-y-1">
                      <div
                        className={`text-[10px] font-bold ${
                          embedded ? 'text-slate-500 dark:text-[#949BB0]' : 'text-[#949BB0]'
                        }`}
                      >
                        Body Type
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {CHAR_ARCHETYPE_OPTIONS.map((opt) => {
                          const active = characterGuide.archetype === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() =>
                                setCharacterGuide((prev) => ({
                                  ...prev,
                                  archetype: opt.id,
                                }))
                              }
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                                active
                                  ? 'bg-[#A855F7] border-[#A855F7] text-white'
                                  : embedded
                                  ? 'bg-white dark:bg-[#1A1F2B] border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-[#C8D0E4]'
                                  : 'bg-[#11141C] border-white/[0.08] text-[#C8D0E4] hover:border-white/20'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div
                        className={`text-[10px] font-bold ${
                          embedded ? 'text-slate-500 dark:text-[#949BB0]' : 'text-[#949BB0]'
                        }`}
                      >
                        Hands &amp; Feet
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {CHAR_EXTREMITY_OPTIONS.map((opt) => {
                          const active = characterGuide.extremities === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() =>
                                setCharacterGuide((prev) => ({
                                  ...prev,
                                  extremities: opt.id,
                                }))
                              }
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                                active
                                  ? 'bg-[#A855F7] border-[#A855F7] text-white'
                                  : embedded
                                  ? 'bg-white dark:bg-[#1A1F2B] border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-[#C8D0E4]'
                                  : 'bg-[#11141C] border-white/[0.08] text-[#C8D0E4] hover:border-white/20'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div
                        className={`text-[10px] font-bold ${
                          embedded ? 'text-slate-500 dark:text-[#949BB0]' : 'text-[#949BB0]'
                        }`}
                      >
                        Surface &amp; Coat
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {CHAR_SURFACE_OPTIONS.map((opt) => {
                          const active = characterGuide.surface === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() =>
                                setCharacterGuide((prev) => ({
                                  ...prev,
                                  surface: opt.id,
                                }))
                              }
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                                active
                                  ? 'bg-[#A855F7] border-[#A855F7] text-white'
                                  : embedded
                                  ? 'bg-white dark:bg-[#1A1F2B] border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-[#C8D0E4]'
                                  : 'bg-[#11141C] border-white/[0.08] text-[#C8D0E4] hover:border-white/20'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div
                        className={`text-[10px] font-bold ${
                          embedded ? 'text-slate-500 dark:text-[#949BB0]' : 'text-[#949BB0]'
                        }`}
                      >
                        Tick Extras to Force
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {CHAR_EXTRA_OPTIONS.map((opt) => {
                          const checked = characterGuide.extras.includes(opt.id);
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() =>
                                setCharacterGuide((prev) => ({
                                  ...prev,
                                  extras: checked
                                    ? prev.extras.filter((x) => x !== opt.id)
                                    : [...prev.extras, opt.id],
                                }))
                              }
                              className={`px-1.5 py-1 rounded-lg text-[10px] font-bold border inline-flex items-center justify-center gap-1 transition-colors ${
                                checked
                                  ? 'bg-[#20B46A]/20 border-[#20B46A] text-emerald-700 dark:text-emerald-200'
                                  : embedded
                                  ? 'bg-white dark:bg-[#1A1F2B] border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-[#C8D0E4]'
                                  : 'bg-[#11141C] border-white/[0.08] text-[#C8D0E4] hover:border-white/20'
                              }`}
                            >
                              {checked && <Check size={9} className="shrink-0" />}
                              <span className="truncate">{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Platformer Director Helper Checklist (only when World level is Side-Scroller) */}
            {isSideScrollerWorld && (
              <div
                className={`p-2.5 rounded-xl border space-y-2 ${
                  embedded
                    ? 'bg-slate-50 dark:bg-[#12151E] border-slate-200/80 dark:border-white/[0.08]'
                    : 'bg-[#171A23] border-white/[0.08]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPlatGuide((v) => !v)}
                    className="flex items-center gap-1.5 text-[11px] font-bold text-left"
                  >
                    {showPlatGuide ? (
                      <ChevronUp size={13} className="text-[#20B46A]" />
                    ) : (
                      <ChevronDown size={13} className="text-[#20B46A]" />
                    )}
                    <span>Platformer Style &amp; Mechanics</span>
                  </button>
                  {(platformerGuide.layoutStyle !== 'auto' ||
                    platformerGuide.theme !== 'auto' ||
                    platformerGuide.mechanics.length > 0) && (
                    <button
                      type="button"
                      onClick={() => setPlatformerGuide(DEFAULT_PLATFORMER_GUIDE)}
                      className="text-[10px] font-bold text-[#20B46A] hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {showPlatGuide && (
                  <div className="space-y-2 pt-0.5">
                    <div className="space-y-1">
                      <div
                        className={`text-[10px] font-bold ${
                          embedded ? 'text-slate-500 dark:text-[#949BB0]' : 'text-[#949BB0]'
                        }`}
                      >
                        Layout Architecture
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {PLATFORMER_LAYOUT_OPTIONS.map((opt) => {
                          const active = platformerGuide.layoutStyle === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() =>
                                setPlatformerGuide((prev) => ({ ...prev, layoutStyle: opt.id }))
                              }
                              className={`px-1.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                                active
                                  ? 'bg-[#20B46A] border-[#20B46A] text-white'
                                  : embedded
                                  ? 'bg-white dark:bg-[#1A1F2B] border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-[#C8D0E4]'
                                  : 'bg-[#11141C] border-white/[0.08] text-[#C8D0E4] hover:border-white/20'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div
                        className={`text-[10px] font-bold ${
                          embedded ? 'text-slate-500 dark:text-[#949BB0]' : 'text-[#949BB0]'
                        }`}
                      >
                        World Theme &amp; Layers
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {PLATFORMER_THEME_OPTIONS.map((opt) => {
                          const active = platformerGuide.theme === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() =>
                                setPlatformerGuide((prev) => ({ ...prev, theme: opt.id }))
                              }
                              className={`px-1.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                                active
                                  ? 'bg-[#20B46A] border-[#20B46A] text-white'
                                  : embedded
                                  ? 'bg-white dark:bg-[#1A1F2B] border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-[#C8D0E4]'
                                  : 'bg-[#11141C] border-white/[0.08] text-[#C8D0E4] hover:border-white/20'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div
                        className={`text-[10px] font-bold ${
                          embedded ? 'text-slate-500 dark:text-[#949BB0]' : 'text-[#949BB0]'
                        }`}
                      >
                        Tick Mechanics to Include
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {PLATFORMER_MECHANIC_OPTIONS.map((opt) => {
                          const checked = platformerGuide.mechanics.includes(opt.id);
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() =>
                                setPlatformerGuide((prev) => ({
                                  ...prev,
                                  mechanics: checked
                                    ? prev.mechanics.filter((x) => x !== opt.id)
                                    : [...prev.mechanics, opt.id],
                                }))
                              }
                              className={`px-1.5 py-1 rounded-lg text-[10px] font-bold border inline-flex items-center justify-center gap-1 transition-colors ${
                                checked
                                  ? 'bg-[#20B46A]/20 border-[#20B46A] text-emerald-700 dark:text-emerald-200'
                                  : embedded
                                  ? 'bg-white dark:bg-[#1A1F2B] border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-[#C8D0E4]'
                                  : 'bg-[#11141C] border-white/[0.08] text-[#C8D0E4] hover:border-white/20'
                              }`}
                            >
                              {checked && <Check size={9} className="shrink-0" />}
                              <span className="truncate">{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Driving & Vehicle Director Helper (only when World level is Driving) */}
            {isDrivingWorld && (
              <div
                className={`p-2.5 rounded-xl border space-y-2 ${
                  embedded
                    ? 'bg-slate-50 dark:bg-[#12151E] border-slate-200/80 dark:border-white/[0.08]'
                    : 'bg-[#171A23] border-white/[0.08]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDrivingGuide((v) => !v)}
                    className="flex items-center gap-1.5 text-[11px] font-bold text-left"
                  >
                    {showDrivingGuide ? (
                      <ChevronUp size={13} className="text-[#38BDF8]" />
                    ) : (
                      <ChevronDown size={13} className="text-[#38BDF8]" />
                    )}
                    <span>Vehicle Archetype &amp; Modifications</span>
                  </button>
                  {(drivingGuide.vehicleStyle !== 'auto' || (drivingGuide.mods && drivingGuide.mods.length > 0)) && (
                    <button
                      type="button"
                      onClick={() => setDrivingGuide(DEFAULT_DRIVING_GUIDE)}
                      className="text-[10px] font-bold text-[#38BDF8] hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {showDrivingGuide && (
                  <div className="space-y-2 pt-0.5">
                    <div className="space-y-1">
                      <div
                        className={`text-[10px] font-bold ${
                          embedded ? 'text-slate-500 dark:text-[#949BB0]' : 'text-[#949BB0]'
                        }`}
                      >
                        Vehicle Chassis Archetype
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                        {DRIVING_VEHICLE_OPTIONS.map((opt) => {
                          const active = drivingGuide.vehicleStyle === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() =>
                                setDrivingGuide((prev) => ({
                                  ...prev,
                                  vehicleStyle: active ? 'auto' : opt.id,
                                }))
                              }
                              className={`px-1.5 py-1 rounded-lg text-[10px] font-bold border transition-colors flex items-center gap-1 truncate ${
                                active
                                  ? 'bg-[#0284C7] border-[#38BDF8] text-white shadow-sm'
                                  : embedded
                                  ? 'bg-white dark:bg-[#1A1F2B] border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-[#C8D0E4]'
                                  : 'bg-[#11141C] border-white/[0.08] text-[#C8D0E4] hover:border-white/20'
                              }`}
                            >
                              <span>{opt.icon}</span>
                              <span className="truncate">{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div
                        className={`text-[10px] font-bold ${
                          embedded ? 'text-slate-500 dark:text-[#949BB0]' : 'text-[#949BB0]'
                        }`}
                      >
                        Active Mods &amp; Course Mechanics
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                        {DRIVING_MOD_OPTIONS.map((opt) => {
                          const checked = (drivingGuide.mods ?? []).includes(opt.id);
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() =>
                                setDrivingGuide((prev) => ({
                                  ...prev,
                                  mods: checked
                                    ? (prev.mods ?? []).filter((x) => x !== opt.id)
                                    : [...(prev.mods ?? []), opt.id],
                                }))
                              }
                              className={`px-1.5 py-1 rounded-lg text-[10px] font-bold border inline-flex items-center gap-1 transition-colors ${
                                checked
                                  ? 'bg-[#38BDF8]/20 border-[#38BDF8] text-sky-700 dark:text-sky-200'
                                  : embedded
                                  ? 'bg-white dark:bg-[#1A1F2B] border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-[#C8D0E4]'
                                  : 'bg-[#11141C] border-white/[0.08] text-[#C8D0E4] hover:border-white/20'
                              }`}
                            >
                              <span>{opt.icon}</span>
                              <span className="truncate">{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Roguelike Scenario Director Helper (only when World level is Roguelike) */}
            {isRoguelikeWorld && (
              <div
                className={`p-2.5 rounded-xl border space-y-2 ${
                  embedded
                    ? 'bg-slate-50 dark:bg-[#12151E] border-slate-200/80 dark:border-white/[0.08]'
                    : 'bg-[#171A23] border-white/[0.08]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRoguelikeGuide((v) => !v)}
                    className="flex items-center gap-1.5 text-[11px] font-bold text-left"
                  >
                    {showRoguelikeGuide ? (
                      <ChevronUp size={13} className="text-[#A855F7]" />
                    ) : (
                      <ChevronDown size={13} className="text-[#A855F7]" />
                    )}
                    <span>Roguelike Scenario &amp; Traps Director</span>
                  </button>
                  {(roguelikeGuide.scenario !== 'auto' ||
                    (roguelikeGuide.traps && roguelikeGuide.traps.length > 0) ||
                    roguelikeGuide.bossTheme !== 'auto') && (
                    <button
                      type="button"
                      onClick={() => setRoguelikeGuide(DEFAULT_ROGUELIKE_GUIDE)}
                      className="text-[10px] font-bold text-[#A855F7] hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {showRoguelikeGuide && (
                  <div className="space-y-2 pt-0.5">
                    <div className="space-y-1">
                      <div
                        className={`text-[10px] font-bold ${
                          embedded ? 'text-slate-500 dark:text-[#949BB0]' : 'text-[#949BB0]'
                        }`}
                      >
                        Scenario Environment Theme
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                        {ROGUELIKE_SCENARIO_OPTIONS.map((opt) => {
                          const active = roguelikeGuide.scenario === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() =>
                                setRoguelikeGuide((prev) => ({
                                  ...prev,
                                  scenario: active ? 'auto' : opt.id,
                                }))
                              }
                              className={`px-1.5 py-1 rounded-lg text-[10px] font-bold border transition-colors flex items-center gap-1 truncate ${
                                active
                                  ? 'bg-[#9333EA] border-[#A855F7] text-white shadow-sm'
                                  : embedded
                                  ? 'bg-white dark:bg-[#1A1F2B] border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-[#C8D0E4]'
                                  : 'bg-[#11141C] border-white/[0.08] text-[#C8D0E4] hover:border-white/20'
                              }`}
                            >
                              <span>{opt.icon}</span>
                              <span className="truncate">{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div
                        className={`text-[10px] font-bold ${
                          embedded ? 'text-slate-500 dark:text-[#949BB0]' : 'text-[#949BB0]'
                        }`}
                      >
                        Hazards &amp; Trap Mechanics (Multi-Select)
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                        {ROGUELIKE_TRAP_OPTIONS.map((opt) => {
                          const checked = (roguelikeGuide.traps ?? []).includes(opt.id);
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() =>
                                setRoguelikeGuide((prev) => ({
                                  ...prev,
                                  traps: checked
                                    ? (prev.traps ?? []).filter((x) => x !== opt.id)
                                    : [...(prev.traps ?? []), opt.id],
                                }))
                              }
                              className={`px-1.5 py-1 rounded-lg text-[10px] font-bold border inline-flex items-center gap-1 transition-colors ${
                                checked
                                  ? 'bg-[#9333EA]/20 border-[#A855F7] text-purple-700 dark:text-purple-200'
                                  : embedded
                                  ? 'bg-white dark:bg-[#1A1F2B] border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-[#C8D0E4]'
                                  : 'bg-[#11141C] border-white/[0.08] text-[#C8D0E4] hover:border-white/20'
                              }`}
                            >
                              <span>{opt.icon}</span>
                              <span className="truncate">{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <div
                          className={`text-[10px] font-bold ${
                            embedded ? 'text-slate-500 dark:text-[#949BB0]' : 'text-[#949BB0]'
                          }`}
                        >
                          Enemy Density
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          {(['light', 'balanced', 'intense', 'nightmare'] as const).map((density) => {
                            const active = roguelikeGuide.enemyDensity === density;
                            return (
                              <button
                                key={density}
                                type="button"
                                onClick={() =>
                                  setRoguelikeGuide((prev) => ({
                                    ...prev,
                                    enemyDensity: density,
                                  }))
                                }
                                className={`px-1.5 py-1 rounded-lg text-[9px] font-bold border capitalize transition-colors truncate ${
                                  active
                                    ? 'bg-[#9333EA] border-[#A855F7] text-white shadow-sm'
                                    : embedded
                                    ? 'bg-white dark:bg-[#1A1F2B] border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-[#C8D0E4]'
                                    : 'bg-[#11141C] border-white/[0.08] text-[#C8D0E4] hover:border-white/20'
                                }`}
                              >
                                {density}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div
                          className={`text-[10px] font-bold ${
                            embedded ? 'text-slate-500 dark:text-[#949BB0]' : 'text-[#949BB0]'
                          }`}
                        >
                          Boss Encounter Theme
                        </div>
                        <select
                          value={roguelikeGuide.bossTheme}
                          onChange={(e) =>
                            setRoguelikeGuide((prev) => ({
                              ...prev,
                              bossTheme: e.target.value as RoguelikePromptGuide['bossTheme'],
                            }))
                          }
                          className={`w-full px-2 py-1.5 rounded-lg text-[10px] font-bold border ${
                            embedded
                              ? 'bg-white dark:bg-[#1A1F2B] border-slate-200 dark:border-white/[0.08] text-slate-800 dark:text-[#E2E8F0]'
                              : 'bg-[#11141C] border-white/[0.08] text-[#E2E8F0]'
                          }`}
                        >
                          <option value="auto">Auto Scenario Boss</option>
                          <option value="cyberMecha">Cyber Mecha Titan</option>
                          <option value="jungleTitan">Jungle Behemoth</option>
                          <option value="magmaLord">Infernal Dreadlord</option>
                          <option value="frostLich">Glacial Sovereign</option>
                          <option value="abyssalGod">Leviathan Kraken</option>
                          <option value="pharaoh">Pharaoh Guardian</option>
                          <option value="voidHorror">Void Dreadlord</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Isometric RPG World & Loot Director Helper (only when World level is RPG) */}
            {isRpgWorld && (
              <div
                className={`p-2.5 rounded-xl border space-y-2 ${
                  embedded
                    ? 'bg-slate-50 dark:bg-[#12151E] border-slate-200/80 dark:border-white/[0.08]'
                    : 'bg-[#171A23] border-white/[0.08]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRpgGuide((v) => !v)}
                    className="flex items-center gap-1.5 text-[11px] font-bold text-left"
                  >
                    {showRpgGuide ? (
                      <ChevronUp size={13} className="text-[#8B5CF6]" />
                    ) : (
                      <ChevronDown size={13} className="text-[#8B5CF6]" />
                    )}
                    <span>Isometric RPG Scenario, Paths &amp; Loot Cards Director</span>
                  </button>
                  {rpgGuide.scenario !== 'auto' && (
                    <button
                      type="button"
                      onClick={() => setRpgGuide(DEFAULT_RPG_GUIDE)}
                      className="text-[10px] font-bold text-[#8B5CF6] hover:underline"
                    >
                      Reset
                    </button>
                  )}
                </div>

                {showRpgGuide && (
                  <div className="space-y-2 pt-0.5">
                    <div className="space-y-1">
                      <div
                        className={`text-[10px] font-bold ${
                          embedded ? 'text-slate-500 dark:text-[#949BB0]' : 'text-[#949BB0]'
                        }`}
                      >
                        Scenario &amp; Interior Diorama Style
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                        {RPG_SCENARIO_OPTIONS.map((opt) => {
                          const active = rpgGuide.scenario === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() =>
                                setRpgGuide((prev) => ({
                                  ...prev,
                                  scenario: active ? 'auto' : opt.id,
                                }))
                              }
                              className={`px-1.5 py-1 rounded-lg text-[10px] font-bold border transition-colors flex items-center gap-1 truncate ${
                                active
                                  ? 'bg-[#7C3AED] border-[#A78BFA] text-white shadow-sm'
                                  : embedded
                                  ? 'bg-white dark:bg-[#1A1F2B] border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-[#C8D0E4]'
                                  : 'bg-[#11141C] border-white/[0.08] text-[#C8D0E4] hover:border-white/20'
                              }`}
                            >
                              <span>{opt.icon}</span>
                              <span className="truncate">{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <div
                          className={`text-[10px] font-bold ${
                            embedded ? 'text-slate-500 dark:text-[#949BB0]' : 'text-[#949BB0]'
                          }`}
                        >
                          Path &amp; Bridge Style
                        </div>
                        <select
                          value={rpgGuide.pathStyle ?? 'weatheredStone'}
                          onChange={(e) =>
                            setRpgGuide((prev) => ({
                              ...prev,
                              pathStyle: e.target.value as RpgPromptGuide['pathStyle'],
                            }))
                          }
                          className={`w-full px-2 py-1.5 rounded-lg text-[10px] font-bold border ${
                            embedded
                              ? 'bg-white dark:bg-[#1A1F2B] border-slate-200 dark:border-white/[0.08] text-slate-800 dark:text-[#E2E8F0]'
                              : 'bg-[#11141C] border-white/[0.08] text-[#E2E8F0]'
                          }`}
                        >
                          <option value="weatheredStone">Weathered Broken Stones</option>
                          <option value="ropeBridgeSlats">Rope Bridge &amp; Broken Slats</option>
                          <option value="mossyCobble">Ancient Mossy Cobbles</option>
                          <option value="woodPlankWalkway">Distressed Wood Slats</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <div
                          className={`text-[10px] font-bold ${
                            embedded ? 'text-slate-500 dark:text-[#949BB0]' : 'text-[#949BB0]'
                          }`}
                        >
                          Treasure &amp; Reward Style
                        </div>
                        <select
                          value={rpgGuide.lootStyle}
                          onChange={(e) =>
                            setRpgGuide((prev) => ({
                              ...prev,
                              lootStyle: e.target.value as RpgPromptGuide['lootStyle'],
                            }))
                          }
                          className={`w-full px-2 py-1.5 rounded-lg text-[10px] font-bold border ${
                            embedded
                              ? 'bg-white dark:bg-[#1A1F2B] border-slate-200 dark:border-white/[0.08] text-slate-800 dark:text-[#E2E8F0]'
                              : 'bg-[#11141C] border-white/[0.08] text-[#E2E8F0]'
                          }`}
                        >
                          <option value="mixed">Both Chests &amp; Fanned Cards</option>
                          <option value="cardChoice">Fanned Reward Cards Choice</option>
                          <option value="traditionalChests">Traditional Chests &amp; Drops</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <div
                          className={`text-[10px] font-bold ${
                            embedded ? 'text-slate-500 dark:text-[#949BB0]' : 'text-[#949BB0]'
                          }`}
                        >
                          Recruited Party Allies
                        </div>
                        <select
                          value={rpgGuide.companionRecruits}
                          onChange={(e) =>
                            setRpgGuide((prev) => ({
                              ...prev,
                              companionRecruits: e.target.value as RpgPromptGuide['companionRecruits'],
                            }))
                          }
                          className={`w-full px-2 py-1.5 rounded-lg text-[10px] font-bold border ${
                            embedded
                              ? 'bg-white dark:bg-[#1A1F2B] border-slate-200 dark:border-white/[0.08] text-slate-800 dark:text-[#E2E8F0]'
                              : 'bg-[#11141C] border-white/[0.08] text-[#E2E8F0]'
                          }`}
                        >
                          <option value="knightAndMage">Knight &amp; Mage Allies</option>
                          <option value="rangerAndThief">Ranger &amp; Rogue Allies</option>
                          <option value="clericAndWarrior">Cleric &amp; Paladin Allies</option>
                          <option value="soloHero">Solo Hero</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Starter Idea Chips */}
            <div className="space-y-1">
              <div
                className={`text-[10px] font-bold ${
                  embedded ? 'text-slate-500 dark:text-[#949BB0]' : 'text-[#949BB0]'
                }`}
              >
                Quick Examples
              </div>
              <div className="flex flex-col gap-1">
                {contextMeta.starterPrompts.map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => setPrompt(sample)}
                    className={`text-left px-2.5 py-1.5 rounded-xl border text-[10px] font-semibold transition-colors line-clamp-2 ${
                      embedded
                        ? 'bg-slate-50 dark:bg-[#1F2430] hover:bg-slate-100 dark:hover:bg-[#272E3F] border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-[#C8D0E4]'
                        : 'bg-[#171A23] hover:bg-[#1F2430] border-white/[0.08] text-[#C8D0E4]'
                    }`}
                    title={sample}
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>

            {/* Main Prompt Input + Modify Checkbox */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold">
                {modifyExisting
                  ? `Describe changes to existing ${contextMeta.title.replace(' AI', '')}`
                  : `Describe what to build in ${contextMeta.title.replace(' AI', '')}`}
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    void handleGenerate();
                  }
                }}
                rows={4}
                placeholder={
                  modifyExisting
                    ? 'Ask to tweak, add, or recolor only specific parts (e.g. "add a wooden bridge over the river")…'
                    : `Describe your ${targetContext} idea in plain English (Ctrl+Enter)…`
                }
                className={`w-full rounded-xl border p-2.5 text-xs leading-relaxed focus:outline-none focus:border-[#7C5CFF] resize-y ${
                  embedded
                    ? 'bg-slate-50 dark:bg-[#0F1117] border-slate-200 dark:border-white/10 text-slate-900 dark:text-[#F3F5FA] placeholder:text-slate-400 dark:placeholder:text-[#6B7285]'
                    : 'bg-[#0F1117] border-white/10 text-[#F3F5FA] placeholder:text-[#6B7285]'
                }`}
              />

              {/* Mode toggles: Modify Existing vs Fresh Reset + Auto-Apply */}
              <div
                className={`p-2 rounded-xl border space-y-1.5 ${
                  embedded
                    ? 'bg-slate-50/90 dark:bg-[#12151E] border-slate-200/70 dark:border-white/[0.08]'
                    : 'bg-[#171A23] border-white/[0.08]'
                }`}
              >
                <label className="flex items-start gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={modifyExisting}
                    onChange={(e) => setModifyExisting(e.target.checked)}
                    className="mt-0.5 accent-[#F59E0B] w-3.5 h-3.5 shrink-0"
                  />
                  <span className="min-w-0">
                    <span className="block text-[11px] font-extrabold leading-tight">
                      Modify existing only
                    </span>
                    <span
                      className={`block text-[10px] leading-snug ${
                        embedded ? 'text-slate-500 dark:text-[#949BB0]' : 'text-[#949BB0]'
                      }`}
                    >
                      {modifyExisting
                        ? 'Keeps current scene & edits only what you ask.'
                        : 'Unchecked = resets old snow, ground & leftovers fresh.'}
                    </span>
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none pt-1 border-t border-slate-200/60 dark:border-white/[0.06]">
                  <input
                    type="checkbox"
                    checked={prefs.autoApplyOnGenerate}
                    onChange={(e) =>
                      updatePrefs({ autoApplyOnGenerate: e.target.checked })
                    }
                    className="accent-[#20B46A] w-3.5 h-3.5 shrink-0"
                  />
                  <span
                    className={`text-[11px] font-semibold ${
                      embedded ? 'text-slate-700 dark:text-[#C8D0E4]' : 'text-[#C8D0E4]'
                    }`}
                  >
                    Auto-apply live to viewport
                  </span>
                </label>
              </div>

              <button
                type="button"
                disabled={generating || (!prompt.trim() && !referenceImage)}
                onClick={() => void handleGenerate()}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold text-white shadow-sm disabled:opacity-45 whitespace-nowrap transition-opacity hover:opacity-95"
                style={{ backgroundColor: contextMeta.accentHex }}
              >
                {generating ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>{modifyExisting ? 'Modifying…' : 'Building Fresh…'}</span>
                  </>
                ) : (
                  <>
                    <Wand2 size={14} />
                    <span>{modifyExisting ? 'Modify Selected' : 'Generate Fresh'}</span>
                  </>
                )}
              </button>
            </div>

            {/* Error or Status Feedback */}
            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/35 text-[11px] font-semibold text-rose-700 dark:text-rose-200 flex items-start justify-between gap-2">
                <span>{errorMsg}</span>
                <button
                  type="button"
                  onClick={() => setTab('preferences')}
                  className="shrink-0 underline font-bold"
                >
                  Preferences
                </button>
              </div>
            )}

            {statusBanner && (
              <div className="p-2.5 rounded-xl bg-[#20B46A]/15 border border-[#20B46A]/35 text-[11px] font-semibold text-emerald-800 dark:text-emerald-200 flex items-start gap-2">
                <Check size={13} className="shrink-0 text-[#20B46A] mt-0.5" />
                <span>{statusBanner}</span>
              </div>
            )}

            {/* Generated Result Card + Relative Save Actions */}
            {lastRawData && (
              <div
                className={`rounded-xl border p-3 space-y-2.5 ${
                  embedded
                    ? 'bg-slate-50 dark:bg-[#12151E] border-slate-200/80 dark:border-white/10'
                    : 'bg-[#171A23] border-white/10'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs font-extrabold truncate">
                    {generatedName || 'Generated Studio Result'}
                  </div>
                  {generatedSummary && (
                    <div
                      className={`text-[10px] mt-0.5 ${
                        embedded ? 'text-slate-600 dark:text-[#949BB0]' : 'text-[#949BB0]'
                      }`}
                    >
                      {generatedSummary}
                    </div>
                  )}
                  {lastModelUsed && (
                    <div className="text-[10px] text-slate-400 dark:text-[#6B7285] mt-0.5">
                      Model: {lastModelUsed}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleApplyToStudio}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold inline-flex items-center gap-1 whitespace-nowrap ${
                      embedded
                        ? 'bg-slate-200/80 dark:bg-white/[0.08] hover:bg-slate-300/80 dark:hover:bg-white/[0.14] text-slate-800 dark:text-white'
                        : 'bg-white/[0.08] hover:bg-white/[0.14] text-white'
                    }`}
                  >
                    <Layers size={12} />
                    <span>{appliedOnce ? 'Re-Apply' : 'Apply'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleSaveToRelativeArea()}
                    className="flex-1 px-2.5 py-1.5 rounded-xl bg-[#20B46A] hover:opacity-95 text-white text-[11px] font-extrabold inline-flex items-center justify-center gap-1 whitespace-nowrap disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Save size={12} />
                    )}
                    <span className="truncate">{contextMeta.saveAreaLabel}</span>
                  </button>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => setShowJsonPreview((v) => !v)}
                    className={`text-[10px] font-bold inline-flex items-center gap-1 ${
                      embedded
                        ? 'text-slate-500 hover:text-slate-900 dark:text-[#949BB0] dark:hover:text-white'
                        : 'text-[#949BB0] hover:text-white'
                    }`}
                  >
                    {showJsonPreview ? (
                      <ChevronUp size={12} />
                    ) : (
                      <ChevronDown size={12} />
                    )}
                    <span>{showJsonPreview ? 'Hide raw JSON' : 'Inspect raw JSON'}</span>
                  </button>
                  {showJsonPreview && (
                    <pre
                      className={`mt-1.5 p-2 rounded-lg border text-[10px] font-mono max-h-48 overflow-auto maker-scroll ${
                        embedded
                          ? 'bg-white dark:bg-[#0F1117] border-slate-200 dark:border-white/[0.06] text-slate-700 dark:text-[#C8D0E4]'
                          : 'bg-[#0F1117] border-white/[0.06] text-[#C8D0E4]'
                      }`}
                    >
                      {JSON.stringify(lastRawData, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          /* PREFERENCES TAB (Persisted automatically to localStorage, zero secret keys in UI) */
          <div className="space-y-3">
            <div className="p-2.5 rounded-xl bg-[#7C5CFF]/10 border border-[#7C5CFF]/30 flex items-center justify-between gap-2 text-[11px]">
              <div className="space-y-0.5 min-w-0">
                <div className="font-bold text-[#7C5CFF] dark:text-[#C4B5FD]">
                  Saved locally on this device
                </div>
                <div
                  className={`text-[10px] ${
                    embedded ? 'text-slate-600 dark:text-[#949BB0]' : 'text-[#949BB0]'
                  }`}
                >
                  Provider, model &amp; URL reload automatically every session.
                </div>
              </div>
              <button
                type="button"
                onClick={resetPrefs}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 whitespace-nowrap shrink-0 ${
                  embedded
                    ? 'bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-transparent'
                    : 'bg-white/[0.06] hover:bg-white/[0.12]'
                }`}
              >
                <RotateCcw size={11} />
                <span>Reset</span>
              </button>
            </div>

            {/* Provider Selector Cards */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold">AI Provider</div>
              <div className="space-y-1.5">
                {(
                  [
                    {
                      id: 'gemini',
                      title: 'Gemini Flash / Pro',
                      desc: 'Fast, low-cost JSON schema planning via server proxy.',
                    },
                    {
                      id: 'local',
                      title: 'Local AI (Qwen / Ollama)',
                      desc: 'Free offline inference on localhost / LM Studio.',
                    },
                    {
                      id: 'openaiCompat',
                      title: 'OpenAI-Compatible Cloud',
                      desc: 'Custom HTTPS endpoint (Groq, Together, OpenAI).',
                    },
                  ] as { id: AiProviderKind; title: string; desc: string }[]
                ).map((opt) => {
                  const active = prefs.provider === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updatePrefs({ provider: opt.id })}
                      className={`w-full p-2.5 rounded-xl border text-left transition-colors space-y-0.5 ${
                        active
                          ? 'bg-[#7C5CFF]/15 border-[#7C5CFF]'
                          : embedded
                          ? 'bg-slate-50 dark:bg-[#12151E] border-slate-200/80 dark:border-white/[0.08] hover:border-[#7C5CFF]/50'
                          : 'bg-[#171A23] border-white/[0.08] text-[#C8D0E4] hover:border-white/25'
                      }`}
                    >
                      <div className="text-[11px] font-extrabold flex items-center justify-between gap-1">
                        <span>{opt.title}</span>
                        {active && <Check size={12} className="text-[#7C5CFF]" />}
                      </div>
                      <div
                        className={`text-[10px] leading-snug ${
                          embedded ? 'text-slate-500 dark:text-[#949BB0]' : 'text-[#949BB0]'
                        }`}
                      >
                        {opt.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Provider-Specific Configuration */}
            {prefs.provider === 'gemini' && (
              <div
                className={`p-3 rounded-xl border space-y-2 ${
                  embedded
                    ? 'bg-slate-50 dark:bg-[#12151E] border-slate-200/80 dark:border-white/[0.08]'
                    : 'bg-[#171A23] border-white/[0.08]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
                  <span className="font-bold">Gemini Model</span>
                  <strong
                    className={
                      serverStatus?.geminiConfigured
                        ? 'text-[#20B46A]'
                        : 'text-[#F59E0B]'
                    }
                  >
                    {serverStatus
                      ? serverStatus.geminiConfigured
                        ? 'Key configured'
                        : 'Server key missing'
                      : 'Checking…'}
                  </strong>
                </div>
                <select
                  value={prefs.geminiModel}
                  onChange={(e) => updatePrefs({ geminiModel: e.target.value })}
                  className={`w-full h-8 px-2.5 rounded-xl border text-[11px] font-semibold ${
                    embedded
                      ? 'bg-white dark:bg-[#0F1117] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white'
                      : 'bg-[#0F1117] border-white/10 text-white'
                  }`}
                >
                  {GEMINI_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label} ({m.id})
                    </option>
                  ))}
                </select>
                <p
                  className={`text-[10px] leading-relaxed ${
                    embedded ? 'text-slate-500 dark:text-[#949BB0]' : 'text-[#949BB0]'
                  }`}
                >
                  Credentials stay exclusively on the server via{' '}
                  <code>GEMINI_API_KEY</code>.
                </p>
              </div>
            )}

            {prefs.provider === 'local' && (
              <div
                className={`p-3 rounded-xl border space-y-2.5 ${
                  embedded
                    ? 'bg-slate-50 dark:bg-[#12151E] border-slate-200/80 dark:border-white/[0.08]'
                    : 'bg-[#171A23] border-white/[0.08]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold">
                    <Cpu size={13} className="text-[#20B46A]" />
                    <span>Local Endpoint</span>
                  </div>
                  <button
                    type="button"
                    disabled={probingLocal}
                    onClick={() => void handleProbeLocalModels()}
                    className="px-2 py-1 rounded-lg bg-[#20B46A]/15 hover:bg-[#20B46A]/25 text-[#20B46A] text-[10px] font-bold inline-flex items-center gap-1 whitespace-nowrap"
                  >
                    <RefreshCw
                      size={10}
                      className={probingLocal ? 'animate-spin' : ''}
                    />
                    <span>Detect Models</span>
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="space-y-1">
                    <label
                      className={`text-[10px] font-bold ${
                        embedded ? 'text-slate-500 dark:text-[#949BB0]' : 'text-[#949BB0]'
                      }`}
                    >
                      Local Server URL (localhost / 127.0.0.1)
                    </label>
                    <input
                      type="text"
                      value={prefs.localBaseUrl}
                      onChange={(e) =>
                        updatePrefs({ localBaseUrl: e.target.value })
                      }
                      placeholder="http://localhost:11434/v1"
                      className={`w-full h-8 px-2.5 rounded-xl border text-[11px] font-mono ${
                        embedded
                          ? 'bg-white dark:bg-[#0F1117] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white'
                          : 'bg-[#0F1117] border-white/10 text-white'
                      }`}
                    />
                  </div>
                  <div className="space-y-1">
                    <label
                      className={`text-[10px] font-bold ${
                        embedded ? 'text-slate-500 dark:text-[#949BB0]' : 'text-[#949BB0]'
                      }`}
                    >
                      Model Name (e.g. qwen2.5:14b)
                    </label>
                    <input
                      type="text"
                      value={prefs.localModel}
                      onChange={(e) =>
                        updatePrefs({ localModel: e.target.value })
                      }
                      placeholder="qwen2.5:14b"
                      className={`w-full h-8 px-2.5 rounded-xl border text-[11px] font-mono ${
                        embedded
                          ? 'bg-white dark:bg-[#0F1117] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white'
                          : 'bg-[#0F1117] border-white/10 text-white'
                      }`}
                    />
                  </div>
                </div>

                {localModels.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {localModels.slice(0, 10).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => updatePrefs({ localModel: m })}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-mono ${
                          prefs.localModel === m
                            ? 'bg-[#20B46A] text-white font-bold'
                            : embedded
                            ? 'bg-white dark:bg-[#0F1117] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-[#C8D0E4]'
                            : 'bg-[#0F1117] border border-white/10 text-[#C8D0E4]'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                )}

                {probeError && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-300">{probeError}</p>
                )}
              </div>
            )}

            {prefs.provider === 'openaiCompat' && (
              <div
                className={`p-3 rounded-xl border space-y-2.5 ${
                  embedded
                    ? 'bg-slate-50 dark:bg-[#12151E] border-slate-200/80 dark:border-white/[0.08]'
                    : 'bg-[#171A23] border-white/[0.08]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
                  <span className="font-bold">OpenAI-Compatible Cloud</span>
                  <strong
                    className={
                      serverStatus?.openaiCompatConfigured
                        ? 'text-[#20B46A]'
                        : 'text-[#F59E0B]'
                    }
                  >
                    {serverStatus
                      ? serverStatus.openaiCompatConfigured
                        ? 'Key configured'
                        : 'Server key missing'
                      : 'Checking…'}
                  </strong>
                </div>

                <div className="space-y-2">
                  <div className="space-y-1">
                    <label
                      className={`text-[10px] font-bold ${
                        embedded ? 'text-slate-500 dark:text-[#949BB0]' : 'text-[#949BB0]'
                      }`}
                    >
                      HTTPS Base URL
                    </label>
                    <input
                      type="url"
                      value={prefs.openaiBaseUrl}
                      onChange={(e) =>
                        updatePrefs({ openaiBaseUrl: e.target.value })
                      }
                      placeholder="https://api.openai.com/v1"
                      className={`w-full h-8 px-2.5 rounded-xl border text-[11px] font-mono ${
                        embedded
                          ? 'bg-white dark:bg-[#0F1117] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white'
                          : 'bg-[#0F1117] border-white/10 text-white'
                      }`}
                    />
                  </div>
                  <div className="space-y-1">
                    <label
                      className={`text-[10px] font-bold ${
                        embedded ? 'text-slate-500 dark:text-[#949BB0]' : 'text-[#949BB0]'
                      }`}
                    >
                      Model ID
                    </label>
                    <input
                      type="text"
                      value={prefs.openaiModel}
                      onChange={(e) =>
                        updatePrefs({ openaiModel: e.target.value })
                      }
                      placeholder="gpt-4o-mini"
                      className={`w-full h-8 px-2.5 rounded-xl border text-[11px] font-mono ${
                        embedded
                          ? 'bg-white dark:bg-[#0F1117] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white'
                          : 'bg-[#0F1117] border-white/10 text-white'
                      }`}
                    />
                  </div>
                </div>
                <p
                  className={`text-[10px] leading-relaxed ${
                    embedded ? 'text-slate-500 dark:text-[#949BB0]' : 'text-[#949BB0]'
                  }`}
                >
                  Routes securely through <code>/api/ai/generate</code> using{' '}
                  <code>OPENAI_COMPAT_API_KEY</code> on the server.
                </p>
              </div>
            )}

            {/* Creativity / Temperature Slider */}
            <div
              className={`p-3 rounded-xl border space-y-1.5 ${
                embedded
                  ? 'bg-slate-50 dark:bg-[#12151E] border-slate-200/80 dark:border-white/[0.08]'
                  : 'bg-[#171A23] border-white/[0.08]'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span>Creativity (Temperature)</span>
                <span className="tabular-nums font-mono text-slate-500 dark:text-[#949BB0]">
                  {prefs.temperature.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={prefs.temperature}
                onChange={(e) =>
                  updatePrefs({ temperature: Number(e.target.value) })
                }
                className="w-full h-1.5 accent-[#7C5CFF] cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-slate-400 dark:text-[#6B7285]">
                <span>0.0 · Strict</span>
                <span>0.45 · Balanced</span>
                <span>1.0 · Wild</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const ContextualAiModal: React.FC<ContextualAiModalProps> = ({
  store,
  initialContext,
  onClose,
}) => {
  return (
    <div
      className="fixed left-2 sm:left-3 top-14 bottom-3 z-[80] w-[335px] sm:w-[365px] max-w-[calc(100vw-1rem)] pointer-events-auto"
      role="dialog"
      aria-label="Contextual AI Creator"
    >
      <ContextualAiPanel
        store={store}
        initialContext={initialContext}
        onClose={onClose}
      />
    </div>
  );
};
