import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { WebGPURenderer } from 'three/webgpu';
import { uniform } from 'three/tsl';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  Apple,
  Check,
  Cloud,
  Dices,
  Eye,
  EyeOff,
  GitBranch,
  Leaf,
  Paintbrush,
  Palette,
  Plus,
  RotateCcw,
  RotateCw,
  Save,
  Sparkles,
  Trees,
  Upload,
  Wand2,
  Wind,
  X,
} from 'lucide-react';
import {
  requestOpenContextualAiModal,
  useRegisterStudioAiBridge,
} from '../../ai/studioBridge';
import { sanitizeTreeCanopyResult } from '../../ai/aiAppliers';
import {
  CANOPY_BASE_GRADIENT_SCOPE_OPTIONS,
  CANOPY_BASE_PATTERN_OPTIONS,
  CANOPY_LEAF_SHAPE_OPTIONS,
  CANOPY_SILHOUETTE_OPTIONS,
  CANOPY_STYLE_PRESETS,
  CANOPY_TARGET_OPTIONS,
  CONIFER_SHAPE_OPTIONS,
  EZ_TREE_FOLIAGE_MODE_OPTIONS,
  EZ_TREE_LEAF_STYLE_OPTIONS,
  EZ_TREE_PRESETS,
  createDefaultCanopyConfig,
  createDefaultEzTreeParams,
  createDefaultSpeciesConfig,
  FEATURE_FREQUENCY_OPTIONS,
  FOLIAGE_TEXTURE_OPTIONS,
  FRUIT_DISTRIBUTION_OPTIONS,
  LEAF_SEASON_PRESETS,
  resolveEzTreeParams,
  resolveSpeciesConfig,
  TREE_BARK_STYLE_OPTIONS,
  TREE_SPECIES_OPTIONS,
  type CanopyStylePreset,
  type EzTreePresetMeta,
  type LeafSeasonPresetMeta,
} from '../../data/canopyEnginePresets';
import type { MakerStore } from '../../store/useMakerStore';
import {
  buildCanopyConfigFromUserDefaults,
  clearDefaultTreeStyle,
  saveDefaultTreeStyle,
  useDefaultTreeStyles,
} from '../../utils/defaultTreeStyles';
import {
  buildSingleCanopyTreeGroup,
  computeWeatherWindFactor,
} from '../../three/canopyClusterBuilder';
import {
  collectReferencedTextureIds,
  loadCustomTextureToCache,
  subscribeCustomTextureCache,
} from '../../three/customTextureManager';
import {
  getCachedAssetSync,
  loadCustomAssetToCache,
  renderObject3DThumbnail,
  subscribeAssetCache,
} from '../../three/gltfAssetManager';
import {
  createMakerRenderer,
  detectSoftwareGl,
  disposeObject3D,
  setupSceneEnvironment,
} from '../../three/islandScene';
import { exportObjectGroupToGlbBuffer } from '../../three/objectMakerBuilder';
import {
  applyVertexPaintStrokesToObject,
  generateOrganicDappleStroke,
  prepareObjectForVertexPainting,
  resetObjectVertexPaint,
  type VertexPaintBrushSettings,
} from '../../three/vertexPainter';
import { MakerVertexPaintSession } from '../../three/vertexPaintViewportHelper';
import { isWebGPUFallbackAdapter } from '../../three/webglUtils';
import { SurfaceTextureControls } from './SurfaceTextureControls';
import { VertexPaintInspector } from './VertexPaintInspector';
import type {
  CanopyBaseGradientScope,
  CanopyBasePattern,
  CanopyCrownSilhouette,
  CanopyLeafShape,
  CanopyTargetTrees,
  ConiferShapeStyle,
  EzTreeBillboardMode,
  EzTreeFoliageMode,
  EzTreeGrowthType,
  EzTreeLeafStyle,
  EzTreeParams,
  FeatureFrequency,
  FoliageTextureStyle,
  FruitDistributionMode,
  StylizedCanopyConfig,
  TreeBarkStyle,
  TreeGeneratorMode,
  TreeSpeciesType,
  VertexPaintStroke,
  VisualStyleId,
} from '../../types/maker';

type StudioTab = 'base' | 'roots' | 'canopy' | 'leaves' | 'color' | 'fruit' | 'paint';
type UploadSlot = 'canopy' | 'trunk' | 'fruit';
type PreviewWindMode = 'level' | 'calm' | 'breeze' | 'gusty';

const LeafShapeSvg: React.FC<{ shape: CanopyLeafShape; active?: boolean }> = ({
  shape,
  active = false,
}) => {
  const stroke = active ? '#20B46A' : 'currentColor';
  const fill = active ? 'rgba(32,180,106,0.22)' : 'rgba(148,155,176,0.16)';
  if (shape === 'basic') {
    return (
      <svg viewBox="0 0 36 36" className="w-7 h-7 shrink-0" fill="none">
        <path
          d="M18 32 C10 24, 9 12, 18 4 C27 12, 26 24, 18 32 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.9"
          strokeLinejoin="round"
        />
        <path d="M18 32 L18 7" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }
  if (shape === 'oak') {
    return (
      <svg viewBox="0 0 36 36" className="w-7 h-7 shrink-0" fill="none">
        <path
          d="M18 33 L18 29 C15 28, 12 26, 13 23 C9 22, 8 18, 12 16 C8 14, 9 9, 14 9 C14 5, 16 3, 18 3 C20 3, 22 5, 22 9 C27 9, 28 14, 24 16 C28 18, 27 22, 23 23 C24 26, 21 28, 18 29 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path d="M18 31 L18 8" stroke={stroke} strokeWidth="1.25" strokeLinecap="round" />
      </svg>
    );
  }
  if (shape === 'maple') {
    return (
      <svg viewBox="0 0 36 36" className="w-7 h-7 shrink-0" fill="none">
        <path
          d="M18 33 L18 26 L11 27 L13 22 L5 19 L9 15 L6 11 L13 13 L14 7 L18 3 L22 7 L23 13 L30 11 L27 15 L31 19 L23 22 L25 27 L18 26 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 36 36" className="w-7 h-7 shrink-0" fill="none">
      {/* Center pointed leaf */}
      <path
        d="M18 28 C14 21, 14 11, 18 4 C22 11, 22 21, 18 28 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Left fanned leaf */}
      <path
        d="M18 28 C11 25, 6 19, 5 12 C11 13, 16 19, 18 28 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Right fanned leaf */}
      <path
        d="M18 28 C25 25, 30 19, 31 12 C25 13, 20 19, 18 28 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M18 33 L18 28" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
};

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display?: string;
  accent?: string;
  hint?: string;
  onChange: (next: number) => void;
}

const SliderRow: React.FC<SliderRowProps> = ({
  label,
  value,
  min,
  max,
  step,
  display,
  accent = '#20B46A',
  hint,
  onChange,
}) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between gap-2 text-xs font-semibold">
      <span className="text-slate-700 dark:text-slate-200 truncate">{label}</span>
      <span className="tabular-nums font-mono text-[11px] text-slate-500 dark:text-[#949BB0] shrink-0">
        {display ?? value.toFixed(step >= 1 ? 0 : 2)}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ accentColor: accent }}
      className="w-full h-1.5 cursor-pointer"
    />
    {hint && (
      <p className="text-[10px] text-slate-400 dark:text-[#7D859B] leading-snug">{hint}</p>
    )}
  </div>
);

function stripProfiles(
  config: StylizedCanopyConfig
): Omit<StylizedCanopyConfig, 'speciesProfiles'> {
  const { speciesProfiles: _unused, ...rest } = config;
  return rest;
}

function cloneExportSafeTreeGroup(src: THREE.Object3D): THREE.Group {
  const cloneMaterialSafe = (srcMat: THREE.Material): THREE.MeshStandardMaterial => {
    const anyMat = srcMat as unknown as {
      color?: THREE.Color;
      vertexColors?: boolean;
      roughness?: number;
      metalness?: number;
      transparent?: boolean;
      opacity?: number;
      alphaTest?: number;
      side?: THREE.Side;
      map?: THREE.Texture | null;
      emissive?: THREE.Color;
      emissiveIntensity?: number;
    };
    return new THREE.MeshStandardMaterial({
      color: anyMat.color ? anyMat.color.clone() : new THREE.Color('#ffffff'),
      vertexColors: Boolean(anyMat.vertexColors),
      roughness: typeof anyMat.roughness === 'number' ? anyMat.roughness : 0.78,
      metalness: typeof anyMat.metalness === 'number' ? anyMat.metalness : 0.02,
      transparent: Boolean(anyMat.transparent),
      opacity: typeof anyMat.opacity === 'number' ? anyMat.opacity : 1,
      alphaTest: typeof anyMat.alphaTest === 'number' ? anyMat.alphaTest : 0,
      side: anyMat.side ?? THREE.FrontSide,
      map: anyMat.map ?? null,
      emissive: anyMat.emissive ? anyMat.emissive.clone() : new THREE.Color('#000000'),
      emissiveIntensity: typeof anyMat.emissiveIntensity === 'number' ? anyMat.emissiveIntensity : 0,
    });
  };

  const cloneNode = (node: THREE.Object3D): THREE.Object3D => {
    if (node instanceof THREE.Mesh) {
      const geo = node.geometry.clone();
      const mat = Array.isArray(node.material)
        ? node.material.map(cloneMaterialSafe)
        : cloneMaterialSafe(node.material);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(node.position);
      mesh.rotation.copy(node.rotation);
      mesh.scale.copy(node.scale);
      mesh.castShadow = node.castShadow;
      mesh.receiveShadow = node.receiveShadow;
      if (node.userData?.paintPart) {
        mesh.userData.paintPart = node.userData.paintPart;
      }
      if (node.userData?.noVertexPaint) {
        mesh.userData.noVertexPaint = true;
      }
      return mesh;
    }
    const grp = new THREE.Group();
    grp.name = node.name;
    grp.position.copy(node.position);
    grp.rotation.copy(node.rotation);
    grp.scale.copy(node.scale);
    for (const child of node.children) {
      grp.add(cloneNode(child));
    }
    return grp;
  };

  const out = cloneNode(src);
  return out instanceof THREE.Group ? out : new THREE.Group().add(out);
}

const BARK_SWATCHES = ['#72503A', '#5D3F2E', '#8A6345', '#E8E1D5', '#4E4440', '#4A3A63'];
const FRUIT_SWATCHES = ['#D93B3B', '#F29F38', '#E6C23E', '#7D4AD1', '#FFE08A'];
const BIRCH_PALETTES: {
  label: string;
  leafColor: string;
  hueVariation: number;
  saturationShift: number;
  valueShift: number;
  swatch: string;
}[] = [
  {
    label: 'Spring Green',
    leafColor: '#88C846',
    hueVariation: 16,
    saturationShift: 0.04,
    valueShift: 0.02,
    swatch: '#88C846',
  },
  {
    label: 'Golden Fall',
    leafColor: '#EBB634',
    hueVariation: 24,
    saturationShift: 0.1,
    valueShift: 0.04,
    swatch: '#EBB634',
  },
  {
    label: 'Autumn Flame',
    leafColor: '#E57D28',
    hueVariation: 48,
    saturationShift: 0.14,
    valueShift: 0.02,
    swatch: '#E57D28',
  },
  {
    label: 'Russet Crimson',
    leafColor: '#C94A2A',
    hueVariation: 42,
    saturationShift: 0.12,
    valueShift: -0.02,
    swatch: '#C94A2A',
  },
];

const CONIFER_PALETTES: {
  label: string;
  top: string;
  bottom: string;
}[] = [
  { label: 'Stylized Pine', top: '#98D45A', bottom: '#254F24' },
  { label: 'Forest Pine', top: '#72C25E', bottom: '#1B4B36' },
  { label: 'Blue Spruce', top: '#70B8B0', bottom: '#1D4454' },
  { label: 'Frosted Mint', top: '#CBEAE4', bottom: '#204C52' },
  { label: 'Golden Larch', top: '#E8B848', bottom: '#6E4622' },
  { label: 'Mystic Pine', top: '#9C82E8', bottom: '#2A2358' },
];

interface CanopyEngineModalProps {
  store: MakerStore;
  initialAssetId?: string | null;
  initialSpecies?: TreeSpeciesType | null;
  onClose: () => void;
  onOpenVertexPainter?: () => void;
}

export const CanopyEngineModal: React.FC<CanopyEngineModalProps> = ({
  store,
  initialAssetId = null,
  initialSpecies = null,
  onClose,
  onOpenVertexPainter,
}) => {
  const { currentLevel, customAssets } = store;
  const defaultTreePrefs = useDefaultTreeStyles();
  const [activeTab, setActiveTab] = useState<StudioTab>('base');
  const [uploadingSlot, setUploadingSlot] = useState<UploadSlot | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [autoSpin, setAutoSpin] = useState(true);
  const [baseOnlyPreview, setBaseOnlyPreview] = useState(false);
  const [previewWindMode, setPreviewWindMode] = useState<PreviewWindMode>('level');
  const [savedTreePresetNote, setSavedTreePresetNote] = useState(false);
  const [savedDefaultNote, setSavedDefaultNote] = useState<string | null>(null);
  const [appliedAllNote, setAppliedAllNote] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(initialAssetId);
  const [treeAssetName, setTreeAssetName] = useState<string>('Stylized Tree');
  const [savingTreeAsset, setSavingTreeAsset] = useState(false);
  const [savedTreeAssetNote, setSavedTreeAssetNote] = useState<string | null>(null);
  const [cacheTick, setCacheTick] = useState(0);

  const [paintTool, setPaintTool] = useState<'paint' | 'orbit'>('paint');
  const [spaceOrbiting, setSpaceOrbiting] = useState(false);
  const [paintRedoStack, setPaintRedoStack] = useState<VertexPaintStroke[]>([]);
  const [paintBrush, setPaintBrush] = useState<VertexPaintBrushSettings>({
    mode: 'paint',
    target: 'all',
    radius: 0.9,
    opacity: 0.68,
    softness: 0.45,
    color: '#F0B838',
    hueShift: 0,
    saturationShift: 0,
    valueShift: 0,
    hueJitter: 22,
  });

  const canopyFileRef = useRef<HTMLInputElement | null>(null);
  const trunkFileRef = useRef<HTMLInputElement | null>(null);
  const fruitFileRef = useRef<HTMLInputElement | null>(null);
  const previewMountRef = useRef<HTMLDivElement | null>(null);
  const autoSpinRef = useRef(autoSpin);
  autoSpinRef.current = autoSpin;
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const paintToolRef = useRef(paintTool);
  paintToolRef.current = paintTool;
  const spaceOrbitingRef = useRef(spaceOrbiting);
  spaceOrbitingRef.current = spaceOrbiting;
  const paintBrushRef = useRef(paintBrush);
  paintBrushRef.current = paintBrush;

  const livePreviewWindFactor =
    previewWindMode === 'calm'
      ? 0.2
      : previewWindMode === 'breeze'
      ? 1.0
      : previewWindMode === 'gusty'
      ? 2.2
      : computeWeatherWindFactor(currentLevel?.weather, currentLevel?.wind);
  const previewWindFactorRef = useRef(livePreviewWindFactor);
  previewWindFactorRef.current = livePreviewWindFactor;

  const previewRefs = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    renderer: WebGPURenderer;
    treesContainer: THREE.Group;
    timeUniform: { value: number };
    windUniform: { value: number };
    paintSession: MakerVertexPaintSession;
    paintableMeshes: THREE.Mesh[];
    centerTree: THREE.Group | null;
  } | null>(null);

  useEffect(() => {
    const unsubAssets = subscribeAssetCache(() => setCacheTick((t) => t + 1));
    const unsubTextures = subscribeCustomTextureCache(() => setCacheTick((t) => t + 1));
    return () => {
      unsubAssets();
      unsubTextures();
    };
  }, []);

  const rawCfg = currentLevel?.canopyEngine;
  const defaultSeededCfg = rawCfg
    ? undefined
    : buildCanopyConfigFromUserDefaults(undefined);
  const effectiveRaw = rawCfg ?? defaultSeededCfg;
  const activeSpecies: TreeSpeciesType = effectiveRaw?.treeType ?? 'oak';
  const cfg: StylizedCanopyConfig = effectiveRaw
    ? { ...createDefaultSpeciesConfig(activeSpecies), ...effectiveRaw }
    : createDefaultCanopyConfig();
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
  const style: VisualStyleId = currentLevel?.visualStyle ?? 'painterlyPBR';
  const isEzTree = cfg.treeGeneratorMode === 'ezTree';
  const ezCfg = resolveEzTreeParams(cfg);

  const updateConfig = (
    patch: Partial<StylizedCanopyConfig>,
    label = 'update tree studio',
    recordUndo = false
  ) => {
    store.updateLevel(
      label,
      (lvl) => {
        const seeded = lvl.canopyEngine ?? buildCanopyConfigFromUserDefaults(undefined);
        const prev = seeded
          ? { ...createDefaultSpeciesConfig(seeded.treeType ?? 'oak'), ...seeded }
          : createDefaultCanopyConfig();
        const next: StylizedCanopyConfig = {
          ...prev,
          ...patch,
        };
        const sp: TreeSpeciesType = next.treeType ?? 'oak';
        next.speciesProfiles = {
          ...(prev.speciesProfiles ?? {}),
          [sp]: stripProfiles(next),
        };
        return {
          ...lvl,
          canopyEngine: next,
        };
      },
      recordUndo
    );
  };

  useEffect(() => {
    if (!initialAssetId) return;
    const found = store.customAssets.find((a) => a.id === initialAssetId);
    if (found) {
      setEditingAssetId(found.id);
      setTreeAssetName(found.name);
      setPaintRedoStack([]);
      if (found.treeRecipe) {
        const nextStrokes =
          found.vertexPaintStrokes && found.vertexPaintStrokes.length > 0
            ? found.vertexPaintStrokes
            : found.treeRecipe.vertexPaintStrokes;
        updateConfig(
          {
            ...found.treeRecipe,
            vertexPaintStrokes: nextStrokes ? JSON.parse(JSON.stringify(nextStrokes)) : undefined,
          },
          `load saved tree: ${found.name}`,
          true
        );
      }
    }
  }, [initialAssetId]);

  useEffect(() => {
    if (initialAssetId || !initialSpecies) return;
    if (initialSpecies !== activeSpecies) {
      switchSpecies(initialSpecies);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSpecies, initialAssetId]);

  const setTreePaintStrokes = (
    updater: (prev: VertexPaintStroke[]) => VertexPaintStroke[],
    label = 'paint tree vertices',
    recordUndo = true
  ) => {
    const prev = cfgRef.current.vertexPaintStrokes ?? [];
    const next = updater(prev);
    updateConfig(
      { vertexPaintStrokes: next.length > 0 ? next : undefined },
      label,
      recordUndo
    );
  };

  const switchSpecies = (nextSpecies: TreeSpeciesType) => {
    if (nextSpecies === activeSpecies) return;
    store.updateLevel(
      `switch tree type to ${nextSpecies}`,
      (lvl) => {
        const seeded = lvl.canopyEngine ?? buildCanopyConfigFromUserDefaults(undefined);
        const prev = seeded
          ? { ...createDefaultSpeciesConfig(seeded.treeType ?? 'oak'), ...seeded }
          : createDefaultCanopyConfig();
        const prevSp: TreeSpeciesType = prev.treeType ?? 'oak';
        const savedProfiles = {
          ...(prev.speciesProfiles ?? {}),
          [prevSp]: stripProfiles(prev),
        };
        const resolved = resolveSpeciesConfig(
          { ...prev, speciesProfiles: savedProfiles },
          nextSpecies
        );
        const next: StylizedCanopyConfig = {
          ...resolved,
          treeType: nextSpecies,
          enabled: prev.enabled,
          targetTrees: prev.targetTrees,
          speciesProfiles: {
            ...savedProfiles,
            [nextSpecies]: stripProfiles({ ...resolved, treeType: nextSpecies }),
          },
        };
        return {
          ...lvl,
          canopyEngine: next,
        };
      },
      true
    );
  };

  const applyPreset = (preset: CanopyStylePreset) => {
    store.updateLevel(
      `apply tree preset: ${preset.name}`,
      (lvl) => {
        const prev = lvl.canopyEngine
          ? { ...createDefaultSpeciesConfig(lvl.canopyEngine.treeType ?? 'oak'), ...lvl.canopyEngine }
          : createDefaultCanopyConfig();
        const prevSp: TreeSpeciesType = prev.treeType ?? 'oak';
        const savedProfiles = {
          ...(prev.speciesProfiles ?? {}),
          [prevSp]: stripProfiles(prev),
        };
        const built = createDefaultSpeciesConfig(preset.species, {
          ...preset.patch,
          enabled: true,
          targetTrees: prev.targetTrees ?? 'matching',
          seed: prev.seed,
          canopyAssetId:
            preset.species === prevSp ? prev.canopyAssetId : savedProfiles[preset.species]?.canopyAssetId,
          fruitAssetId:
            preset.species === prevSp ? prev.fruitAssetId : savedProfiles[preset.species]?.fruitAssetId,
        });
        return {
          ...lvl,
          canopyEngine: {
            ...built,
            speciesProfiles: {
              ...savedProfiles,
              [preset.species]: stripProfiles(built),
            },
          },
        };
      },
      true
    );
  };

  const updateEzTree = (
    patch: Partial<EzTreeParams>,
    label = 'update ez-tree parameters',
    recordUndo = false
  ) => {
    const baseEz = resolveEzTreeParams(cfg);
    updateConfig(
      {
        treeGeneratorMode: 'ezTree',
        ezTree: {
          ...baseEz,
          ...patch,
        },
      },
      label,
      recordUndo
    );
  };

  const applyEzPreset = (preset: EzTreePresetMeta) => {
    store.updateLevel(
      `apply ez-tree preset: ${preset.name}`,
      (lvl) => {
        const prev = lvl.canopyEngine
          ? { ...createDefaultSpeciesConfig(lvl.canopyEngine.treeType ?? 'oak'), ...lvl.canopyEngine }
          : createDefaultCanopyConfig();
        const prevSp: TreeSpeciesType = prev.treeType ?? 'oak';
        const savedProfiles = {
          ...(prev.speciesProfiles ?? {}),
          [prevSp]: stripProfiles(prev),
        };
        const built = createDefaultSpeciesConfig(preset.species, {
          enabled: true,
          targetTrees: prev.targetTrees ?? 'matching',
          seed: prev.seed,
          treeGeneratorMode: 'ezTree',
          barkStyle: preset.barkStyle,
          barkColor: preset.barkColor,
          ezTree: { ...preset.ezTree },
        });
        return {
          ...lvl,
          canopyEngine: {
            ...built,
            speciesProfiles: {
              ...savedProfiles,
              [preset.species]: stripProfiles(built),
            },
          },
        };
      },
      true
    );
  };

  // Preload referenced GLB assets into cache so preview & island update right away
  useEffect(() => {
    const loadIfMissing = (id?: string) => {
      if (id && !getCachedAssetSync(id)) {
        const meta = customAssets.find((a) => a.id === id);
        void loadCustomAssetToCache(id, meta?.category ?? 'scenery');
      }
    };
    loadIfMissing(cfg.canopyAssetId);
    loadIfMissing(cfg.trunkAssetId);
    loadIfMissing(cfg.fruitAssetId);
  }, [cfg.canopyAssetId, cfg.trunkAssetId, cfg.fruitAssetId, customAssets]);

  const hasBuiltPreviewOnceRef = useRef(false);

  // Mount live 3D Trio Turntable Preview once
  useEffect(() => {
    const container = previewMountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();
    let renderer = createMakerRenderer(isSoftwareGl);
    renderer.setSize(container.clientWidth || 540, container.clientHeight || 440);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#141A24');
    scene.fog = new THREE.FogExp2('#141A24', 0.02);
    let envTex: THREE.Texture | null = null;

    const camera = new THREE.PerspectiveCamera(
      42,
      (container.clientWidth || 540) / Math.max(1, container.clientHeight || 440),
      0.1,
      120
    );
    camera.position.set(0, 5.2, 14.2);

    const createControls = (domEl: HTMLElement) => {
      const c = new OrbitControls(camera, domEl);
      c.enableDamping = !isSoftwareGl;
      c.dampingFactor = 0.08;
      c.target.set(0, 2.75, 0);
      c.minDistance = 4.5;
      c.maxDistance = 28;
      c.maxPolarAngle = Math.PI * 0.49;
      return c;
    };

    let controls = createControls(renderer.domElement);

    const hemi = new THREE.HemisphereLight('#DDF0FF', '#44583E', 0.95);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight('#FFF6E3', 1.75);
    keyLight.position.set(10, 16, 12);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 45;
    keyLight.shadow.camera.left = -10;
    keyLight.shadow.camera.right = 10;
    keyLight.shadow.camera.top = 10;
    keyLight.shadow.camera.bottom = -10;
    keyLight.shadow.bias = -0.001;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#8CC8FF', 0.65);
    rimLight.position.set(-10, 7, -10);
    scene.add(rimLight);

    // Subtle earthy grass showcase plinth so arched ground-entering roots read clearly
    const stageGroup = new THREE.Group();
    const plinthGeo = new THREE.CylinderGeometry(7.2, 7.6, 0.55, 40);
    const plinthMat = new THREE.MeshStandardMaterial({
      color: '#46743E',
      roughness: 0.92,
      metalness: 0.0,
    });
    const plinth = new THREE.Mesh(plinthGeo, plinthMat);
    plinth.position.y = -0.275;
    plinth.receiveShadow = true;
    stageGroup.add(plinth);

    const ringGeo = new THREE.RingGeometry(6.95, 7.22, 48);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: '#20B46A',
      transparent: true,
      opacity: 0.25,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.015;
    stageGroup.add(ring);
    scene.add(stageGroup);

    const treesContainer = new THREE.Group();
    scene.add(treesContainer);

    const timeUniform = uniform(0);
    const windUniform = uniform(previewWindFactorRef.current);
    const paintSession = new MakerVertexPaintSession(scene);
    const refsObj = {
      scene,
      camera,
      controls,
      renderer,
      treesContainer,
      timeUniform,
      windUniform,
      paintSession,
      paintableMeshes: [] as THREE.Mesh[],
      centerTree: null as THREE.Group | null,
    };
    previewRefs.current = refsObj;

    const onPointerDown = (e: PointerEvent) => {
      const isPaintingNow =
        activeTabRef.current === 'paint' &&
        paintToolRef.current === 'paint' &&
        !spaceOrbitingRef.current;
      if (!isPaintingNow || e.button !== 0 || !refsObj.centerTree) return;
      const started = refsObj.paintSession.handlePointerDown({
        event: e,
        domEl: refsObj.renderer.domElement,
        camera,
        paintRoot: refsObj.centerTree,
        paintableMeshes: refsObj.paintableMeshes,
        brush: paintBrushRef.current,
      });
      if (started) {
        e.stopPropagation();
      }
    };

    const onPointerHoverCursor = (e: PointerEvent) => {
      const isPaintingNow =
        activeTabRef.current === 'paint' &&
        paintToolRef.current === 'paint' &&
        !spaceOrbitingRef.current;
      if (isPaintingNow && refsObj.centerTree && !refsObj.paintSession.brushing) {
        refsObj.paintSession.updateHoverCursor({
          event: e,
          domEl: refsObj.renderer.domElement,
          camera,
          paintRoot: refsObj.centerTree,
          paintableMeshes: refsObj.paintableMeshes,
          brush: paintBrushRef.current,
        });
      } else if (!refsObj.paintSession.brushing) {
        refsObj.paintSession.hideCursor();
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const isPaintingNow =
        activeTabRef.current === 'paint' &&
        paintToolRef.current === 'paint' &&
        !spaceOrbitingRef.current;
      if (isPaintingNow && refsObj.centerTree) {
        refsObj.paintSession.handlePointerMove({
          event: e,
          domEl: refsObj.renderer.domElement,
          camera,
          paintRoot: refsObj.centerTree,
          paintableMeshes: refsObj.paintableMeshes,
          brush: paintBrushRef.current,
        });
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (refsObj.paintSession.brushing) {
        const completed = refsObj.paintSession.finishStroke(refsObj.renderer.domElement, e.pointerId);
        if (completed) {
          setPaintRedoStack([]);
          setTreePaintStrokes((prev) => [...prev, completed], 'paint tree vertex stroke', true);
        }
      }
    };

    const attachCanvasPointerListeners = (domEl: HTMLElement) => {
      domEl.style.touchAction = 'none';
      domEl.addEventListener('pointerdown', onPointerDown);
      domEl.addEventListener('pointermove', onPointerHoverCursor);
    };
    const detachCanvasPointerListeners = (domEl: HTMLElement) => {
      domEl.removeEventListener('pointerdown', onPointerDown);
      domEl.removeEventListener('pointermove', onPointerHoverCursor);
    };

    attachCanvasPointerListeners(renderer.domElement);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    const timer = new THREE.Timer();
    let disposed = false;
    let frameId = 0;

    const afterDraw = (cb: () => void) => {
      const gl =
        typeof renderer.getContext === 'function'
          ? (renderer.getContext() as Partial<WebGL2RenderingContext> | null)
          : null;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE ?? 0x9117, 0);
        gl.flush?.();
        const poll = () => {
          if (disposed) {
            if (sync) gl.deleteSync?.(sync);
            return;
          }
          const st = sync
            ? gl.getSyncParameter?.(sync, gl.SYNC_STATUS ?? 0x9114)
            : (gl.SIGNALED ?? 0x9119);
          if (st === (gl.UNSIGNALED ?? 0x9118)) {
            frameId = window.setTimeout(poll, 6);
          } else {
            if (sync) gl.deleteSync?.(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 6);
      } else {
        frameId = window.setTimeout(cb, 90);
      }
    };

    const tick = () => {
      if (disposed) return;
      try {
        timer.update();
        const dt = Math.min(0.08, timer.getDelta());
        timeUniform.value = timer.getElapsed();
        const isPaintingTab = activeTabRef.current === 'paint';
        windUniform.value = isPaintingTab ? 0 : previewWindFactorRef.current;
        if (autoSpinRef.current && !isPaintingTab) {
          treesContainer.rotation.y += dt * 0.22;
        }
        controls.update();
        renderer.render(scene, camera);
      } catch (err) {
        console.warn('CanopyEngine preview render warning:', err);
      } finally {
        if (!disposed) {
          if (isSoftwareGl) afterDraw(tick);
          else frameId = requestAnimationFrame(tick);
        }
      }
    };

    const switchToWebGLFallback = async (): Promise<boolean> => {
      if (disposed) return false;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      detachCanvasPointerListeners(refsObj.renderer.domElement);
      controls.dispose();
      envTex?.dispose();
      envTex = null;
      try {
        renderer.dispose();
      } catch {
        // ignore dispose errors on failed adapter
      }
      renderer = createMakerRenderer(isSoftwareGl, true);
      renderer.setSize(container.clientWidth || 540, container.clientHeight || 440);
      container.innerHTML = '';
      container.appendChild(renderer.domElement);
      controls = createControls(renderer.domElement);
      attachCanvasPointerListeners(renderer.domElement);
      if (previewRefs.current) {
        previewRefs.current.renderer = renderer;
        previewRefs.current.controls = controls;
      }
      try {
        await renderer.init();
        if (disposed) return false;
        envTex = setupSceneEnvironment(scene, renderer);
        return true;
      } catch (fallbackErr) {
        console.error('CanopyEngine WebGL fallback init failed:', fallbackErr);
        return false;
      }
    };

    void (async () => {
      let initOk = false;
      try {
        await renderer.init();
        if (!isSoftwareGl && isWebGPUFallbackAdapter(renderer)) {
          console.warn('CanopyEngine WebGPU returned a software fallback adapter; switching to hardware WebGL2.');
          initOk = await switchToWebGLFallback();
        } else {
          initOk = true;
        }
      } catch (err) {
        console.warn('CanopyEngine WebGPU init failed; falling back to WebGL2:', err);
        initOk = await switchToWebGLFallback();
      }
      if (disposed || !initOk) return;

      const backend = renderer.backend as {
        isWebGPUBackend?: boolean;
        device?: GPUDevice;
      } | undefined;
      if (backend?.isWebGPUBackend && backend.device?.lost) {
        void backend.device.lost.then((info) => {
          if (disposed || info.reason === 'destroyed') return;
          console.warn('CanopyEngine WebGPU device lost; switching to WebGL2 fallback:', info.message);
          void switchToWebGLFallback().then((ok) => {
            if (ok && !disposed) tick();
          });
        });
      }

      if (!envTex) {
        envTex = setupSceneEnvironment(scene, renderer);
      }
      tick();
    })();

    const ro = new ResizeObserver(() => {
      if (disposed) return;
      const w = container.clientWidth || 540;
      const h = container.clientHeight || 440;
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(container);

    return () => {
      disposed = true;
      hasBuiltPreviewOnceRef.current = false;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      ro.disconnect();
      detachCanvasPointerListeners(refsObj.renderer.domElement);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      refsObj.paintSession.dispose(scene);
      controls.dispose();
      timer.dispose();
      envTex?.dispose();
      disposeObject3D(treesContainer);
      disposeObject3D(stageGroup);
      disposeObject3D(scene);
      try {
        renderer.dispose();
      } catch {
        // ignore if device already lost
      }
      previewRefs.current = null;
    };
  }, []);

  // Preload any custom seamless textures referenced by this tree config or the level
  useEffect(() => {
    const ids = collectReferencedTextureIds(currentLevel?.sceneryTextures, cfg);
    ids.forEach((id) => {
      void loadCustomTextureToCache(id);
    });
  }, [cfg.barkTexture?.textureId, cfg.canopyTexture?.textureId, cfg.fruitTexture?.textureId, currentLevel?.sceneryTextures]);

  const structuralTreeSig = React.useMemo(
    () =>
      JSON.stringify({
        ...cfg,
        vertexPaintStrokes: undefined,
        speciesProfiles: undefined,
      }),
    [cfg]
  );

  // Rebuild 3 side-by-side preview trees live (excludes vertexPaintStrokes so brushing never rebuilds meshes)
  useEffect(() => {
    const refs = previewRefs.current;
    if (!refs) return;

    const rebuildTrees = () => {
      const liveRefs = previewRefs.current;
      if (!liveRefs) return;

      disposeObject3D(liveRefs.treesContainer);
      liveRefs.treesContainer.clear();
      liveRefs.paintableMeshes = [];
      liveRefs.centerTree = null;

      const curCfg = cfgRef.current;
      const baseCfg: StylizedCanopyConfig = {
        ...curCfg,
        vertexPaintStrokes: undefined,
      };
      const strokes = curCfg.vertexPaintStrokes ?? [];

      const positions: [number, number, number, string][] = [
        [-4.2, 0, -0.5, 'preview_tree_alpha'],
        [0.0, 0, 0.85, 'preview_tree_beta'],
        [4.2, 0, -0.5, 'preview_tree_gamma'],
      ];

      positions.forEach(([px, py, pz, key], idx) => {
        const tree = buildSingleCanopyTreeGroup(
          baseCfg,
          `${key}_${idx}`,
          style,
          liveRefs.timeUniform,
          undefined,
          {
            baseOnly: baseOnlyPreview,
            previewIndex: idx,
            sceneryTextures: currentLevel?.sceneryTextures,
            weatherWindUniform: liveRefs.windUniform,
            enableVertexPaint: true,
          }
        );
        tree.position.set(px, py, pz);
        tree.rotation.y = idx * 1.95;
        liveRefs.treesContainer.add(tree);

        const meshes = prepareObjectForVertexPainting(tree);
        if (strokes.length > 0) {
          applyVertexPaintStrokesToObject(tree, strokes);
        }
        if (idx === 1) {
          liveRefs.centerTree = tree;
          liveRefs.paintableMeshes = meshes;
        }
      });
    };

    if (!hasBuiltPreviewOnceRef.current) {
      hasBuiltPreviewOnceRef.current = true;
      rebuildTrees();
      return;
    }

    const timerId = window.setTimeout(rebuildTrees, 55);
    return () => window.clearTimeout(timerId);
  }, [structuralTreeSig, style, cacheTick, baseOnlyPreview, currentLevel?.sceneryTextures]);

  // Replay non-destructive vertex paint strokes across all 3 showcase trees when strokes change
  useEffect(() => {
    const liveRefs = previewRefs.current;
    if (!liveRefs || liveRefs.paintSession.brushing) return;
    const strokes = cfg.vertexPaintStrokes ?? [];
    for (const tree of liveRefs.treesContainer.children) {
      resetObjectVertexPaint(tree);
      if (strokes.length > 0) {
        applyVertexPaintStrokesToObject(tree, strokes);
      }
    }
  }, [cfg.vertexPaintStrokes]);

  // Delegate OrbitControls left-button to brush while in Paint tab
  useEffect(() => {
    const liveRefs = previewRefs.current;
    if (!liveRefs) return;
    const paintBrushingActive =
      activeTab === 'paint' && paintTool === 'paint' && !spaceOrbiting;
    liveRefs.controls.mouseButtons = {
      LEFT: paintBrushingActive ? (null as unknown as THREE.MOUSE) : THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    liveRefs.controls.touches = {
      ONE: paintBrushingActive ? (null as unknown as THREE.TOUCH) : THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };
    if (!paintBrushingActive) {
      liveRefs.paintSession.hideCursor();
    }
  }, [activeTab, paintTool, spaceOrbiting]);

  // Paint keyboard shortcuts: Space to temporarily orbit, [ / ] to resize brush
  useEffect(() => {
    if (activeTab !== 'paint') {
      setSpaceOrbiting(false);
      return;
    }
    const isTextInput = (el: EventTarget | null) =>
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement;
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTextInput(e.target)) return;
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setSpaceOrbiting(true);
      } else if (e.key === '[') {
        setPaintBrush((prev) => ({
          ...prev,
          radius: Math.max(0.15, Number((prev.radius - 0.1).toFixed(2))),
        }));
      } else if (e.key === ']') {
        setPaintBrush((prev) => ({
          ...prev,
          radius: Math.min(3.5, Number((prev.radius + 0.1).toFixed(2))),
        }));
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpaceOrbiting(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [activeTab]);

  const handleUploadGlb = async (
    slot: UploadSlot,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadError(null);
    setUploadingSlot(slot);
    try {
      const meta = await store.uploadCustomGlb(file, 'scenery');
      if (slot === 'canopy') {
        updateConfig(
          { canopyAssetId: meta.id, enabled: true },
          `assign treetop GLB: ${meta.name}`,
          true
        );
      } else if (slot === 'trunk') {
        updateConfig(
          { trunkAssetId: meta.id, enabled: true },
          `assign trunk GLB: ${meta.name}`,
          true
        );
      } else {
        updateConfig(
          { fruitAssetId: meta.id, fruitEnabled: true, enabled: true },
          `assign fruit GLB: ${meta.name}`,
          true
        );
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Could not parse GLB file.');
    } finally {
      setUploadingSlot(null);
    }
  };

  if (!currentLevel) return null;

  const selectedCanopyAsset = cfg.canopyAssetId
    ? customAssets.find((a) => a.id === cfg.canopyAssetId)
    : null;
  const selectedTrunkAsset = cfg.trunkAssetId
    ? customAssets.find((a) => a.id === cfg.trunkAssetId)
    : null;
  const selectedFruitAsset = cfg.fruitAssetId
    ? customAssets.find((a) => a.id === cfg.fruitAssetId)
    : null;

  const activeSpeciesLabel =
    activeSpecies === 'custom'
      ? (cfg.customTypeName?.trim() || 'Custom Tree')
      : TREE_SPECIES_OPTIONS.find((s) => s.id === activeSpecies)?.label ?? 'Oak';

  const paintCount = cfg.vertexPaintStrokes?.length ?? 0;

  const handleSaveTreeAsset = async () => {
    if (savingTreeAsset) return;
    setSavingTreeAsset(true);
    setSavedTreeAssetNote(null);
    const liveRefs = previewRefs.current;
    const dummyTime = liveRefs?.timeUniform ?? { value: 0 };
    const cleanName = treeAssetName.trim() || `${activeSpeciesLabel} Tree`;
    const recipeToSave: StylizedCanopyConfig = JSON.parse(JSON.stringify(cfg));
    let builtTree: THREE.Group | null = null;
    let exportGroup: THREE.Group | null = null;
    let thumbGroup: THREE.Group | null = null;

    try {
      builtTree = buildSingleCanopyTreeGroup(
        { ...recipeToSave, vertexPaintStrokes: undefined },
        `tree_asset_${Date.now()}`,
        style,
        dummyTime,
        undefined,
        {
          sceneryTextures: currentLevel?.sceneryTextures,
          enableVertexPaint: true,
        }
      );
      exportGroup = cloneExportSafeTreeGroup(builtTree);
      const buffer = await exportObjectGroupToGlbBuffer(exportGroup);

      thumbGroup = cloneExportSafeTreeGroup(builtTree);
      if ((recipeToSave.vertexPaintStrokes?.length ?? 0) > 0) {
        prepareObjectForVertexPainting(thumbGroup);
        applyVertexPaintStrokesToObject(thumbGroup, recipeToSave.vertexPaintStrokes);
      }
      const thumbnailOverride = await renderObject3DThumbnail(thumbGroup, {
        azimuthRad: 0.45,
        elevationFactor: 0.34,
        zoom: 1.04,
      });

      const savedMeta = await store.saveGeneratedAsset({
        existingAssetId: editingAssetId ?? undefined,
        name: cleanName,
        category: 'tree',
        buffer,
        treeRecipe: recipeToSave,
        vertexPaintStrokes:
          recipeToSave.vertexPaintStrokes && recipeToSave.vertexPaintStrokes.length > 0
            ? recipeToSave.vertexPaintStrokes
            : undefined,
        thumbnailOverride,
        keepMetricScale: true,
      });
      setEditingAssetId(savedMeta.id);
      setSavedTreeAssetNote(editingAssetId ? 'Updated in Trees!' : 'Saved to Trees!');
      window.setTimeout(() => setSavedTreeAssetNote(null), 2600);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Could not save tree asset.');
    } finally {
      if (builtTree) disposeObject3D(builtTree);
      if (exportGroup) disposeObject3D(exportGroup);
      if (thumbGroup) disposeObject3D(thumbGroup);
      setSavingTreeAsset(false);
    }
  };

  useRegisterStudioAiBridge({
    id: 'modal-tree',
    context: 'tree',
    title: `Tree Studio · ${treeAssetName}`,
    subtitle: 'AI configures trunk, gnarl, roots, canopy & fruit',
    saveLabel: 'Save to Trees',
    getSnapshot: () => ({
      name: treeAssetName,
      species: activeSpecies,
      trunkHeight: cfg.trunkHeight,
      gnarlAmount: cfg.gnarlAmount,
      fruitEnabled: Boolean(cfg.fruitEnabled),
    }),
    applyResult: (raw, options) => {
      const res = sanitizeTreeCanopyResult(
        raw,
        options?.modifyExisting ? cfg : undefined
      );
      setTreeAssetName(
        options?.modifyExisting && typeof raw.name !== 'string'
          ? treeAssetName
          : res.name
      );
      updateConfig(res.config, 'AI update tree studio', true);
      return res.summary;
    },
    saveAsset: async (suggestedName) => {
      if (suggestedName) setTreeAssetName(suggestedName);
      await handleSaveTreeAsset();
      return `Saved "${suggestedName || treeAssetName}" to Trees`;
    },
  });

  const tabs: { id: StudioTab; label: string; icon: React.ReactNode }[] = [
    { id: 'base', label: 'Base', icon: <Trees size={12} /> },
    { id: 'roots', label: 'Roots', icon: <GitBranch size={12} /> },
    { id: 'canopy', label: 'Canopy', icon: <Cloud size={12} /> },
    { id: 'leaves', label: 'Leaves', icon: <Leaf size={12} /> },
    { id: 'color', label: 'Color', icon: <Palette size={12} /> },
    { id: 'fruit', label: 'Fruit', icon: <Apple size={12} /> },
    {
      id: 'paint',
      label: paintCount > 0 ? `Paint (${paintCount})` : 'Paint',
      icon: <Paintbrush size={12} />,
    },
  ];

  const supportsBroadleafCanopy =
    activeSpecies === 'oak' || activeSpecies === 'fantasy' || activeSpecies === 'custom';

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-2.5 sm:p-4">
      <div className="w-full max-w-7xl h-[min(93vh,820px)] rounded-2xl bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.1] shadow-2xl flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="shrink-0 px-5 py-3 border-b border-slate-200/80 dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-extrabold tracking-tight truncate">
              Tree Maker · Bark &amp; Canopy Designer
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#949BB0] truncate">
              Sculpt bark, branches, owl hollows, arched roots, multi-species canopies &amp; fruit
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => requestOpenContextualAiModal('tree')}
              title="AI Tree Designer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#16A34A]/15 hover:bg-[#16A34A]/25 text-[#20B46A] border border-[#20B46A]/35 text-xs font-extrabold whitespace-nowrap"
            >
              <Wand2 size={13} />
              <Sparkles size={11} className="text-[#F59E0B]" />
              <span>AI</span>
            </button>
            <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1F2430] border border-slate-200/70 dark:border-white/[0.08] text-xs font-bold cursor-pointer select-none whitespace-nowrap">
              <input
                type="checkbox"
                checked={cfg.enabled}
                onChange={(e) =>
                  updateConfig({ enabled: e.target.checked }, 'toggle tree studio on island', true)
                }
                className="accent-[#20B46A]"
              />
              <span>Active on Island</span>
            </label>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-500"
              aria-label="Close Tree Maker"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {/* Species Type Selector Strip */}
        <div className="shrink-0 px-5 py-2.5 bg-slate-50 dark:bg-[#131720] border-b border-slate-200/80 dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB] mr-1">
              Tree Type
            </span>
            {TREE_SPECIES_OPTIONS.map((sp) => {
              const isSelected = activeSpecies === sp.id;
              const hasDefaultSaved = Boolean(defaultTreePrefs.species[sp.id]);
              const label =
                sp.id === 'custom' && cfg.customTypeName?.trim()
                  ? cfg.customTypeName.trim()
                  : sp.label;
              return (
                <button
                  key={sp.id}
                  type="button"
                  onClick={() => switchSpecies(sp.id)}
                  title={
                    hasDefaultSaved
                      ? `${label} (Custom default style saved)`
                      : label
                  }
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-colors whitespace-nowrap ${
                    isSelected
                      ? 'bg-[#20B46A] text-white shadow-sm'
                      : 'bg-white dark:bg-[#1C212D] text-slate-700 dark:text-[#C8D0E4] border border-slate-200/80 dark:border-white/[0.08] hover:border-[#20B46A]'
                  }`}
                >
                  <span>{label}</span>
                  {hasDefaultSaved && (
                    <Check
                      size={11}
                      className={isSelected ? 'text-white' : 'text-[#20B46A]'}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Save / Apply Default Spawn Style for this Species */}
            <div className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  const styleSummary =
                    cfg.treeGeneratorMode === 'ezTree'
                      ? `EZ-Tree ${
                          EZ_TREE_PRESETS.find((p) => p.id === cfg.ezTree?.presetId)?.name ??
                          activeSpeciesLabel
                        }`
                      : activeSpecies === 'conifer'
                      ? CONIFER_SHAPE_OPTIONS.find((c) => c.id === cfg.coniferShape)?.label ??
                        'Custom Conifer'
                      : activeSpecies === 'birch'
                      ? 'Custom Birch'
                      : `Custom ${activeSpeciesLabel}`;
                  saveDefaultTreeStyle(activeSpecies, cfg, styleSummary);
                  if (!cfg.enabled) {
                    updateConfig(
                      { enabled: true, targetTrees: cfg.targetTrees === 'placedOnly' ? 'matching' : cfg.targetTrees },
                      `set default ${activeSpeciesLabel}`,
                      true
                    );
                  }
                  setSavedDefaultNote(activeSpeciesLabel);
                  window.setTimeout(() => setSavedDefaultNote(null), 2400);
                }}
                title={`Always spawn ${activeSpeciesLabel} trees with this look on new maps & islands`}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold border transition-colors whitespace-nowrap ${
                  savedDefaultNote === activeSpeciesLabel
                    ? 'bg-[#20B46A] border-[#20B46A] text-white'
                    : 'bg-white dark:bg-[#1C212D] border-[#20B46A]/45 text-[#20B46A] hover:bg-[#20B46A]/10'
                }`}
              >
                <Check size={12} />
                <span>
                  {savedDefaultNote === activeSpeciesLabel
                    ? `Saved ${activeSpeciesLabel} Default`
                    : `Set as Default ${activeSpeciesLabel}`}
                </span>
              </button>

              {defaultTreePrefs.species[activeSpecies] && (
                <button
                  type="button"
                  onClick={() => clearDefaultTreeStyle(activeSpecies)}
                  title={`Clear custom default for ${activeSpeciesLabel}`}
                  className="p-1.5 rounded-lg bg-white dark:bg-[#1C212D] border border-slate-200/80 dark:border-white/[0.08] text-slate-500 hover:text-red-500 transition-colors"
                  aria-label={`Reset default ${activeSpeciesLabel}`}
                >
                  <RotateCcw size={12} />
                </button>
              )}

              {Object.keys(defaultTreePrefs.species).length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    store.applyDefaultTreeStylesToLevels('all');
                    setAppliedAllNote(true);
                    window.setTimeout(() => setAppliedAllNote(false), 2200);
                  }}
                  title="Apply your saved default tree styles across every land & level in this game"
                  className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#1C212D] border border-slate-200/80 dark:border-white/[0.08] hover:border-[#20B46A] text-[11px] font-bold text-slate-700 dark:text-[#C8D0E4] whitespace-nowrap transition-colors"
                >
                  {appliedAllNote ? 'Applied to All Lands' : 'Apply to All Lands'}
                </button>
              )}
            </div>

            {/* Generator Engine Switcher: Stylized Canopy vs EZ-Tree Branching */}
            <div className="inline-flex items-center p-0.5 rounded-lg bg-white dark:bg-[#1C212D] border border-slate-200/80 dark:border-white/[0.08]">
              {([
                { id: 'stylized', label: 'Stylized Canopy' },
                { id: 'ezTree', label: 'EZ-Tree Branching' },
              ] as { id: TreeGeneratorMode; label: string }[]).map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() =>
                    updateConfig(
                      mode.id === 'ezTree'
                        ? {
                            treeGeneratorMode: 'ezTree',
                            ezTree: cfg.ezTree ?? createDefaultEzTreeParams(activeSpecies),
                          }
                        : { treeGeneratorMode: 'stylized' },
                      `switch tree engine to ${mode.label}`,
                      true
                    )
                  }
                  className={`px-2.5 py-1 rounded-md text-[11px] font-extrabold transition-colors whitespace-nowrap ${
                    (cfg.treeGeneratorMode ?? 'stylized') === mode.id
                      ? 'bg-[#20B46A] text-white shadow-sm'
                      : 'text-slate-600 dark:text-[#9FA8BE] hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {activeSpecies === 'custom' && (
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-bold text-slate-500 dark:text-[#949BB0] whitespace-nowrap">
                  Custom Name
                </label>
                <input
                  type="text"
                  value={cfg.customTypeName ?? 'My Custom Tree'}
                  maxLength={28}
                  onChange={(e) =>
                    updateConfig({ customTypeName: e.target.value }, 'rename custom tree type')
                  }
                  placeholder="Name your custom tree..."
                  className="w-40 px-2.5 py-1 rounded-lg bg-white dark:bg-[#1C212D] border border-slate-200 dark:border-white/[0.12] text-xs font-bold focus:outline-none focus:border-[#20B46A]"
                />
              </div>
            )}
          </div>
        </div>

        {/* Main 2-column body */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          {/* Left: Live 3D 3-Tree Showcase Viewport */}
          <div className="relative lg:w-[54%] h-72 lg:h-auto shrink-0 bg-[#141A24] border-b lg:border-b-0 lg:border-r border-slate-200/80 dark:border-white/[0.08]">
            <div ref={previewMountRef} className="w-full h-full" />

            {/* Top-left hint */}
            <div className="absolute top-3 left-3 pointer-events-none">
              <div className="px-3 py-1.5 rounded-xl bg-[#10151E]/90 border border-white/[0.1] text-[11px] font-semibold text-slate-200">
                3 Unique {activeSpeciesLabel} Variations · Drag to orbit · Scroll to zoom
              </div>
            </div>

            {/* Bottom floating viewport toolbar */}
            <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
              <div className="flex items-center gap-1.5 pointer-events-auto">
                <button
                  type="button"
                  onClick={() => setBaseOnlyPreview((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold whitespace-nowrap transition-colors ${
                    baseOnlyPreview
                      ? 'bg-[#D97706] border-[#F59E0B] text-white'
                      : 'bg-[#10151E]/90 hover:bg-[#1B2230] border-white/[0.12] text-slate-100'
                  }`}
                >
                  {baseOnlyPreview ? <Eye size={13} /> : <EyeOff size={13} />}
                  <span>{baseOnlyPreview ? 'Show Canopy' : 'Inspect Base Only'}</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    updateConfig(
                      { seed: Math.floor(Math.random() * 90000) + 1000 },
                      're-roll tree seed',
                      true
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#10151E]/90 hover:bg-[#1B2230] border border-white/[0.12] text-xs font-bold text-slate-100 whitespace-nowrap"
                >
                  <Dices size={13} />
                  <span>Re-Roll</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAutoSpin((s) => !s)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold whitespace-nowrap ${
                    autoSpin
                      ? 'bg-[#20B46A]/25 border-[#20B46A]/70 text-[#86EFAC]'
                      : 'bg-[#10151E]/90 border-white/[0.12] text-slate-300'
                  }`}
                >
                  <RotateCw size={12} />
                  <span>{autoSpin ? 'Spin On' : 'Spin Off'}</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setPreviewWindMode((m) =>
                      m === 'level'
                        ? 'breeze'
                        : m === 'breeze'
                        ? 'gusty'
                        : m === 'gusty'
                        ? 'calm'
                        : 'level'
                    )
                  }
                  title="Preview how leaves & canopy react to scene wind"
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold whitespace-nowrap transition-colors ${
                    previewWindMode === 'gusty'
                      ? 'bg-[#38BDF8]/25 border-[#38BDF8]/70 text-[#BAE6FD]'
                      : previewWindMode === 'calm'
                      ? 'bg-[#10151E]/90 border-white/[0.12] text-slate-400'
                      : 'bg-[#10151E]/90 hover:bg-[#1B2230] border-white/[0.12] text-slate-200'
                  }`}
                >
                  <Wind size={12} />
                  <span>
                    {previewWindMode === 'level'
                      ? 'World Wind'
                      : previewWindMode === 'calm'
                      ? 'Wind: Calm'
                      : previewWindMode === 'breeze'
                      ? 'Wind: Breeze'
                      : 'Wind: Gusty'}
                  </span>
                </button>
              </div>

              <div className="px-2.5 py-1 rounded-lg bg-[#10151E]/85 border border-white/[0.08] text-[11px] font-mono tabular-nums text-slate-300">
                Seed #{cfg.seed}
              </div>
            </div>
          </div>

          {/* Right: 6-Tab Control Deck */}
          <div className="flex-1 min-h-0 flex flex-col">
            {/* Hidden file inputs */}
            <input
              ref={canopyFileRef}
              type="file"
              accept=".glb,.gltf"
              className="hidden"
              onChange={(e) => handleUploadGlb('canopy', e)}
            />
            <input
              ref={trunkFileRef}
              type="file"
              accept=".glb,.gltf"
              className="hidden"
              onChange={(e) => handleUploadGlb('trunk', e)}
            />
            <input
              ref={fruitFileRef}
              type="file"
              accept=".glb,.gltf"
              className="hidden"
              onChange={(e) => handleUploadGlb('fruit', e)}
            />

            {/* Tab Navigation */}
            <div className="shrink-0 px-4 pt-3 pb-2 border-b border-slate-200/80 dark:border-white/[0.08] grid grid-cols-7 gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center justify-center gap-1 py-2 px-1 rounded-xl text-[10px] font-extrabold whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'bg-[#20B46A] text-white'
                      : 'bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#A3ACBF] hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Scrollable Tab Content */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {uploadError && (
                <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-500 font-semibold">
                  {uploadError}
                </div>
              )}

              {/* TAB 1: BASE & BARK */}
              {activeTab === 'base' && (
                <>
                  {isEzTree && (
                    <>
                      {/* EZ-Tree One-Click Species Presets */}
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1B202C] border border-[#20B46A]/35 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold">EZ-Tree Branch Presets</span>
                          <span className="text-[10px] font-semibold text-[#20B46A]">
                            Recursive WebGPU Builder
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {EZ_TREE_PRESETS.map((preset) => {
                            const selected = ezCfg.presetId === preset.id;
                            return (
                              <button
                                key={preset.id}
                                type="button"
                                onClick={() => applyEzPreset(preset)}
                                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left transition-colors ${
                                  selected
                                    ? 'bg-[#20B46A]/15 border-[#20B46A] text-[#20B46A]'
                                    : 'bg-white dark:bg-[#171A23] border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 hover:border-[#20B46A]/50'
                                }`}
                              >
                                <span
                                  className="w-3 h-3 rounded-full shrink-0"
                                  style={{
                                    background: `linear-gradient(135deg, ${preset.swatchHex}, ${preset.accentHex})`,
                                  }}
                                />
                                <span className="text-[11px] font-bold truncate">{preset.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* EZ-Tree Branch Hierarchy & Growth Tropism */}
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1B202C] border border-slate-200/70 dark:border-white/[0.07] space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold">
                            Recursive Branch Architecture
                          </span>
                          <div className="inline-flex p-0.5 rounded-lg bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.08]">
                            {(['deciduous', 'evergreen'] as EzTreeGrowthType[]).map((gt) => (
                              <button
                                key={gt}
                                type="button"
                                onClick={() =>
                                  updateEzTree({ growthType: gt }, `ez-tree type ${gt}`, true)
                                }
                                className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold capitalize ${
                                  ezCfg.growthType === gt
                                    ? 'bg-[#20B46A] text-white'
                                    : 'text-slate-500 dark:text-slate-400'
                                }`}
                              >
                                {gt}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <SliderRow
                            label="Branch Levels"
                            value={ezCfg.levels}
                            min={1}
                            max={3}
                            step={1}
                            display={`${ezCfg.levels} Tiers`}
                            onChange={(v) => updateEzTree({ levels: v })}
                          />
                          <SliderRow
                            label="Primary Limbs"
                            value={ezCfg.children[0]}
                            min={1}
                            max={16}
                            step={1}
                            onChange={(v) =>
                              updateEzTree({
                                children: [v, ezCfg.children[1], ezCfg.children[2]],
                              })
                            }
                          />
                          <SliderRow
                            label="Sub-Branches"
                            value={ezCfg.children[1]}
                            min={1}
                            max={8}
                            step={1}
                            onChange={(v) =>
                              updateEzTree({
                                children: [ezCfg.children[0], v, ezCfg.children[2]],
                              })
                            }
                          />
                          <SliderRow
                            label="Outer Twigs"
                            value={ezCfg.children[2]}
                            min={1}
                            max={6}
                            step={1}
                            onChange={(v) =>
                              updateEzTree({
                                children: [ezCfg.children[0], ezCfg.children[1], v],
                              })
                            }
                          />
                          <SliderRow
                            label="Limb Split Angle"
                            value={ezCfg.angle[0]}
                            min={12}
                            max={82}
                            step={1}
                            display={`${Math.round(ezCfg.angle[0])}°`}
                            onChange={(v) =>
                              updateEzTree({
                                angle: [v, ezCfg.angle[1], ezCfg.angle[2]],
                              })
                            }
                          />
                          <SliderRow
                            label="Limb Start Height"
                            value={ezCfg.start[0]}
                            min={0.08}
                            max={0.8}
                            step={0.02}
                            display={`${Math.round(ezCfg.start[0] * 100)}%`}
                            onChange={(v) =>
                              updateEzTree({
                                start: [v, ezCfg.start[1], ezCfg.start[2]],
                              })
                            }
                          />
                          <SliderRow
                            label="Branch Gnarliness"
                            value={ezCfg.gnarliness[1]}
                            min={0}
                            max={0.8}
                            step={0.02}
                            display={`${Math.round(ezCfg.gnarliness[1] * 100)}%`}
                            onChange={(v) =>
                              updateEzTree({
                                gnarliness: [
                                  v * 0.68,
                                  v,
                                  Math.min(0.85, v * 1.08),
                                  Math.min(0.75, v * 0.85),
                                ],
                              })
                            }
                          />
                          <SliderRow
                            label="Branch Spread Length"
                            value={ezCfg.length[1]}
                            min={0.8}
                            max={4.2}
                            step={0.05}
                            display={`${ezCfg.length[1].toFixed(2)}m`}
                            onChange={(v) =>
                              updateEzTree({
                                length: [ezCfg.length[0], v, v * 0.66, v * 0.42],
                              })
                            }
                          />
                          <SliderRow
                            label="Spiral Twist"
                            value={ezCfg.twist[1]}
                            min={-0.35}
                            max={0.35}
                            step={0.01}
                            display={`${ezCfg.twist[1].toFixed(2)}`}
                            onChange={(v) =>
                              updateEzTree({
                                twist: [v * 0.6, v, -v * 0.7, 0],
                              })
                            }
                          />
                          <SliderRow
                            label="Branch Taper"
                            value={ezCfg.taper[0]}
                            min={0.25}
                            max={0.95}
                            step={0.02}
                            display={`${Math.round(ezCfg.taper[0] * 100)}%`}
                            onChange={(v) =>
                              updateEzTree({
                                taper: [v, ezCfg.taper[1], ezCfg.taper[2], ezCfg.taper[3]],
                              })
                            }
                          />
                        </div>

                        <SliderRow
                          label="Growth Tropism (Weeping Droop ← 0 → Reach Skyward)"
                          value={
                            (ezCfg.forceDirection[1] < 0 ? -1 : 1) * ezCfg.forceStrength
                          }
                          min={-0.12}
                          max={0.12}
                          step={0.005}
                          accent="#38BDF8"
                          display={(() => {
                            const signed =
                              (ezCfg.forceDirection[1] < 0 ? -1 : 1) * ezCfg.forceStrength;
                            if (Math.abs(signed) < 0.005) return 'Neutral';
                            return signed < 0
                              ? `Willow Droop ${Math.round(Math.abs(signed) * 800)}%`
                              : `Reach Up ${Math.round(signed * 800)}%`;
                          })()}
                          hint="Slide left to make limbs drape downward like a weeping willow; slide right to curve toward the sun."
                          onChange={(signed) =>
                            updateEzTree({
                              forceDirection: [0, signed < 0 ? -1 : 1, 0],
                              forceStrength: Math.abs(signed),
                            })
                          }
                        />
                      </div>
                    </>
                  )}

                  {/* Bark Style */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB]">
                        Bark Style
                      </span>
                      <button
                        type="button"
                        onClick={() => setBaseOnlyPreview((v) => !v)}
                        className="text-[11px] font-bold text-[#20B46A] hover:underline"
                      >
                        {baseOnlyPreview ? 'Show Canopy' : 'Hide Canopy to Inspect Bark'}
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {TREE_BARK_STYLE_OPTIONS.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() =>
                            updateConfig({ barkStyle: b.id as TreeBarkStyle }, `bark style ${b.label}`, true)
                          }
                          className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-colors whitespace-nowrap ${
                            cfg.barkStyle === b.id
                              ? 'bg-[#20B46A]/15 border-[#20B46A] text-[#20B46A]'
                              : 'bg-slate-50 dark:bg-[#1C212D] border-slate-200/80 dark:border-white/[0.07] text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Bark Color & Lighter Uneven Vertical Lines */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1B202C] border border-slate-200/70 dark:border-white/[0.07] space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold">Bark Color &amp; Wood Grain</span>
                      <div className="flex items-center gap-1.5">
                        {BARK_SWATCHES.map((hex) => (
                          <button
                            key={hex}
                            type="button"
                            onClick={() => updateConfig({ barkColor: hex }, 'bark color')}
                            style={{ backgroundColor: hex }}
                            className={`w-5 h-5 rounded-md border ${
                              cfg.barkColor?.toLowerCase() === hex.toLowerCase()
                                ? 'border-[#20B46A] ring-2 ring-[#20B46A]/40'
                                : 'border-black/25'
                            }`}
                            aria-label={`Bark color ${hex}`}
                          />
                        ))}
                        <input
                          type="color"
                          value={cfg.barkColor ?? '#72503A'}
                          onChange={(e) => updateConfig({ barkColor: e.target.value }, 'bark color')}
                          className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                        />
                      </div>
                    </div>

                    <SliderRow
                      label="Lighter Vertical Bark Lines"
                      value={cfg.barkLineIntensity ?? 0.58}
                      min={0}
                      max={1}
                      step={0.02}
                      display={`${Math.round((cfg.barkLineIntensity ?? 0.58) * 100)}%`}
                      hint="Uneven wood grain streaks running up & down in a lighter tone than the bark."
                      onChange={(v) => updateConfig({ barkLineIntensity: v })}
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <SliderRow
                        label="Bark Line Density"
                        value={cfg.barkLineDensity ?? 1.0}
                        min={0.4}
                        max={2.0}
                        step={0.05}
                        display={`${(cfg.barkLineDensity ?? 1.0).toFixed(2)}×`}
                        onChange={(v) => updateConfig({ barkLineDensity: v })}
                      />
                      <SliderRow
                        label="Bark Bump Relief"
                        value={cfg.barkBumpStrength ?? 0.45}
                        min={0}
                        max={1}
                        step={0.02}
                        display={`${Math.round((cfg.barkBumpStrength ?? 0.45) * 100)}%`}
                        onChange={(v) => updateConfig({ barkBumpStrength: v })}
                      />
                    </div>
                  </div>

                  {/* Trunk Sculpting */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1B202C] border border-slate-200/70 dark:border-white/[0.07] space-y-3">
                    <span className="text-xs font-extrabold block">Trunk Shape &amp; Variety</span>
                    <div className="grid grid-cols-2 gap-3">
                      <SliderRow
                        label="Trunk Length"
                        value={cfg.trunkHeight ?? 2.85}
                        min={1.4}
                        max={6.5}
                        step={0.05}
                        display={`${(cfg.trunkHeight ?? 2.85).toFixed(2)}m`}
                        onChange={(v) => updateConfig({ trunkHeight: v })}
                      />
                      <SliderRow
                        label="Trunk Thickness"
                        value={cfg.trunkThickness ?? 1.05}
                        min={0.4}
                        max={2.1}
                        step={0.05}
                        display={`${(cfg.trunkThickness ?? 1.05).toFixed(2)}×`}
                        onChange={(v) => updateConfig({ trunkThickness: v })}
                      />
                      {!isEzTree && (
                        <>
                          <SliderRow
                            label="Trunk Taper"
                            value={cfg.trunkTaper ?? 0.46}
                            min={0.15}
                            max={0.85}
                            step={0.02}
                            display={`${Math.round((cfg.trunkTaper ?? 0.46) * 100)}%`}
                            onChange={(v) => updateConfig({ trunkTaper: v })}
                          />
                          <SliderRow
                            label="Curve &amp; Lean"
                            value={cfg.trunkLean ?? 0.28}
                            min={0}
                            max={1}
                            step={0.02}
                            display={`${Math.round((cfg.trunkLean ?? 0.28) * 100)}%`}
                            onChange={(v) => updateConfig({ trunkLean: v })}
                          />
                        </>
                      )}
                    </div>
                    <SliderRow
                      label="Per-Tree Variety"
                      value={cfg.trunkVariety ?? 0.35}
                      min={0}
                      max={1}
                      step={0.02}
                      display={`${Math.round((cfg.trunkVariety ?? 0.35) * 100)}%`}
                      hint="Varies height, girth, and lean organically between trees."
                      onChange={(v) => updateConfig({ trunkVariety: v })}
                    />
                  </div>

                  {/* Separate Major Branches (Classic Stylized Canopy Mount) */}
                  {!isEzTree && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1B202C] border border-slate-200/70 dark:border-white/[0.07] space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold">Major Branches (Canopy Mount)</span>
                        <span className="text-[11px] font-semibold text-slate-400">
                          Taper &amp; directional droop
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <SliderRow
                          label="Branch Count"
                          value={cfg.majorBranchCount ?? 4}
                          min={0}
                          max={7}
                          step={1}
                          onChange={(v) => updateConfig({ majorBranchCount: v })}
                        />
                        <SliderRow
                          label="Branch Length"
                          value={cfg.majorBranchLength ?? 1.45}
                          min={0.4}
                          max={3.0}
                          step={0.05}
                          display={`${(cfg.majorBranchLength ?? 1.45).toFixed(2)}m`}
                          onChange={(v) => updateConfig({ majorBranchLength: v })}
                        />
                        <SliderRow
                          label="Branch Thickness"
                          value={cfg.majorBranchThickness ?? 0.95}
                          min={0.35}
                          max={1.8}
                          step={0.05}
                          display={`${(cfg.majorBranchThickness ?? 0.95).toFixed(2)}×`}
                          onChange={(v) => updateConfig({ majorBranchThickness: v })}
                        />
                        <SliderRow
                          label="Branch Taper"
                          value={cfg.majorBranchTaper ?? 0.72}
                          min={0}
                          max={1}
                          step={0.02}
                          display={
                            (cfg.majorBranchTaper ?? 0.72) >= 0.98
                              ? 'Fine Point'
                              : `${Math.round((cfg.majorBranchTaper ?? 0.72) * 100)}%`
                          }
                          onChange={(v) => updateConfig({ majorBranchTaper: v })}
                        />
                        <SliderRow
                          label="Outward Spread"
                          value={cfg.majorBranchSpread ?? 0.84}
                          min={0.2}
                          max={1.6}
                          step={0.04}
                          display={`${Math.round((cfg.majorBranchSpread ?? 0.84) * 100)}%`}
                          onChange={(v) => updateConfig({ majorBranchSpread: v })}
                        />
                        <SliderRow
                          label="Upward Reach"
                          value={cfg.majorBranchUpward ?? 0.52}
                          min={0}
                          max={1.2}
                          step={0.04}
                          display={`${Math.round((cfg.majorBranchUpward ?? 0.52) * 100)}%`}
                          onChange={(v) => updateConfig({ majorBranchUpward: v })}
                        />
                      </div>
                      <SliderRow
                        label="Branch Droop (Upward ← 0 → Down)"
                        value={cfg.majorBranchDroop ?? 0.0}
                        min={-1}
                        max={1}
                        step={0.02}
                        display={
                          Math.abs(cfg.majorBranchDroop ?? 0) < 0.02
                            ? 'Neutral'
                            : (cfg.majorBranchDroop ?? 0) < 0
                            ? `Up ${Math.round(Math.abs(cfg.majorBranchDroop ?? 0) * 100)}%`
                            : `Down ${Math.round((cfg.majorBranchDroop ?? 0) * 100)}%`
                        }
                        hint="Starts in the middle: slide left to curve limbs upward, slide right to droop downward."
                        onChange={(v) => updateConfig({ majorBranchDroop: v })}
                      />
                    </div>
                  )}

                  {/* Optional Custom Trunk GLB Override */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1B202C] border border-slate-200/70 dark:border-white/[0.07] space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold">Custom Trunk .GLB (Optional)</span>
                      <div className="flex items-center gap-1.5">
                        {cfg.trunkAssetId && (
                          <button
                            type="button"
                            onClick={() =>
                              updateConfig({ trunkAssetId: undefined }, 'use procedural trunk', true)
                            }
                            className="px-2 py-1 rounded-lg bg-slate-200 dark:bg-white/[0.08] text-[11px] font-bold"
                          >
                            Use Procedural
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={uploadingSlot !== null}
                          onClick={() => trunkFileRef.current?.click()}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#20B46A]/15 text-[#20B46A] text-[11px] font-bold hover:bg-[#20B46A]/25"
                        >
                          <Upload size={11} />
                          <span>{uploadingSlot === 'trunk' ? 'Importing...' : 'Upload GLB'}</span>
                        </button>
                      </div>
                    </div>
                    {selectedTrunkAsset ? (
                      <p className="text-[11px] text-[#20B46A] font-semibold truncate">
                        Using custom trunk: {selectedTrunkAsset.name}
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-500 dark:text-[#8E96AB]">
                        Using procedural Tree Base Maker trunk with bark lines, branches &amp; roots.
                      </p>
                    )}
                  </div>

                  {/* Seamless Custom Bark / Trunk Texture Map */}
                  <SurfaceTextureControls
                    store={store}
                    slot="treeBark"
                    title="Custom Seamless Bark Texture"
                    value={cfg.barkTexture}
                    compact
                    accent="#20B46A"
                    onChange={(next, rec) =>
                      updateConfig({ barkTexture: next }, 'update bark texture', rec)
                    }
                  />
                </>
              )}

              {/* TAB 2: ROOTS, GNARL & OWL HOLLOWS */}
              {activeTab === 'roots' && (
                <>
                  {isEzTree && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2.5">
                      <p className="text-[11px] text-amber-800 dark:text-amber-200 leading-snug">
                        <strong>EZ-Tree Mode:</strong> Uses a built-in flared root collar and per-level branch gnarl/twist in the <strong>Base</strong> tab. Curved ground roots &amp; owl hollows apply to <strong>Stylized Canopy</strong> trees.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('base')}
                        className="shrink-0 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-100 text-[10px] font-extrabold whitespace-nowrap"
                      >
                        Branch Gnarl
                      </button>
                    </div>
                  )}
                  {/* Gnarl & Knots */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1B202C] border border-slate-200/70 dark:border-white/[0.07] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold">Trunk Gnarl &amp; Knots</span>
                      <button
                        type="button"
                        onClick={() => setBaseOnlyPreview((v) => !v)}
                        className="text-[11px] font-bold text-[#20B46A] hover:underline"
                      >
                        {baseOnlyPreview ? 'Show Canopy' : 'Base-Only View'}
                      </button>
                    </div>
                    <SliderRow
                      label="Gnarl, Twist &amp; Burls"
                      value={cfg.gnarlAmount ?? 0.35}
                      min={0}
                      max={1}
                      step={0.02}
                      display={`${Math.round((cfg.gnarlAmount ?? 0.35) * 100)}%`}
                      hint="Adds twisted organic wood fluting, knotted burls, and sculpted curvature."
                      onChange={(v) => updateConfig({ gnarlAmount: v })}
                    />
                  </div>

                  {/* Owl Hollow Hole */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1B202C] border border-slate-200/70 dark:border-white/[0.07] space-y-3">
                    <span className="text-xs font-extrabold block">Owl Hollow Cavity</span>
                    <div className="grid grid-cols-4 gap-1.5">
                      {FEATURE_FREQUENCY_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            updateConfig(
                              { hollowMode: opt.id as FeatureFrequency },
                              `owl hollow frequency ${opt.label}`,
                              true
                            )
                          }
                          className={`py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                            (cfg.hollowMode ?? 'none') === opt.id
                              ? 'bg-[#D97706]/15 border-[#D97706] text-[#D97706]'
                              : 'bg-white dark:bg-[#171A23] border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {(cfg.hollowMode ?? 'none') !== 'none' && (
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <SliderRow
                          label="Hollow Height"
                          value={cfg.hollowHeight ?? 0.48}
                          min={0.22}
                          max={0.78}
                          step={0.02}
                          accent="#D97706"
                          display={`${Math.round((cfg.hollowHeight ?? 0.48) * 100)}%`}
                          onChange={(v) => updateConfig({ hollowHeight: v })}
                        />
                        <SliderRow
                          label="Hollow Opening"
                          value={cfg.hollowSize ?? 0.95}
                          min={0.55}
                          max={1.65}
                          step={0.05}
                          accent="#D97706"
                          display={`${(cfg.hollowSize ?? 0.95).toFixed(2)}×`}
                          onChange={(v) => updateConfig({ hollowSize: v })}
                        />
                      </div>
                    )}
                  </div>

                  {/* Curved Ground-Entering Roots */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1B202C] border border-slate-200/70 dark:border-white/[0.07] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold">Curved Ground Roots</span>
                      <span className="text-[11px] font-semibold text-slate-400">
                        Arch out &amp; plunge into soil
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5">
                      {FEATURE_FREQUENCY_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            updateConfig(
                              { rootMode: opt.id as FeatureFrequency },
                              `tree roots frequency ${opt.label}`,
                              true
                            )
                          }
                          className={`py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                            (cfg.rootMode ?? 'none') === opt.id
                              ? 'bg-[#20B46A]/15 border-[#20B46A] text-[#20B46A]'
                              : 'bg-white dark:bg-[#171A23] border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {(cfg.rootMode ?? 'none') !== 'none' && (
                      <div className="space-y-3 pt-1">
                        <SliderRow
                          label="Root Base Height (at Trunk)"
                          value={cfg.rootBaseHeight ?? 0.22}
                          min={-0.45}
                          max={1.1}
                          step={0.02}
                          display={
                            (cfg.rootBaseHeight ?? 0.22) < 0
                              ? `${(cfg.rootBaseHeight ?? 0.22).toFixed(2)}m (Buried)`
                              : `+${(cfg.rootBaseHeight ?? 0.22).toFixed(2)}m`
                          }
                          hint="Lower below 0m so roots sit partially submerged under the ground surface."
                          onChange={(v) => updateConfig({ rootBaseHeight: v })}
                        />
                        <SliderRow
                          label="Outward Reach (Before Curve Down)"
                          value={cfg.rootReach ?? 1.45}
                          min={0.6}
                          max={3.4}
                          step={0.05}
                          display={`${(cfg.rootReach ?? 1.45).toFixed(2)}m`}
                          hint="How far roots extend away from the trunk before curving downward into the ground."
                          onChange={(v) => updateConfig({ rootReach: v })}
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <SliderRow
                            label="Root Count"
                            value={cfg.rootCount ?? 5}
                            min={2}
                            max={10}
                            step={1}
                            onChange={(v) => updateConfig({ rootCount: v })}
                          />
                          <SliderRow
                            label="Arch Height"
                            value={cfg.rootArchHeight ?? 0.34}
                            min={0.0}
                            max={1.15}
                            step={0.02}
                            display={`${(cfg.rootArchHeight ?? 0.34).toFixed(2)}m`}
                            onChange={(v) => updateConfig({ rootArchHeight: v })}
                          />
                          <SliderRow
                            label="Root Thickness"
                            value={cfg.rootThickness ?? 1.0}
                            min={0.45}
                            max={1.85}
                            step={0.05}
                            display={`${(cfg.rootThickness ?? 1.0).toFixed(2)}×`}
                            onChange={(v) => updateConfig({ rootThickness: v })}
                          />
                          <SliderRow
                            label="Root Randomness"
                            value={cfg.rootRandomness ?? 0.45}
                            min={0}
                            max={1}
                            step={0.02}
                            display={`${Math.round((cfg.rootRandomness ?? 0.45) * 100)}%`}
                            onChange={(v) => updateConfig({ rootRandomness: v })}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* TAB 3: SPECIES-ADAPTIVE CANOPY */}
              {activeTab === 'canopy' && (
                <>
                  {isEzTree && ezCfg.foliageMode === 'leafCards' && (
                    <div className="p-3 rounded-xl bg-[#20B46A]/10 border border-[#20B46A]/35 flex items-center justify-between gap-2.5">
                      <p className="text-[11px] text-slate-700 dark:text-slate-200 leading-snug">
                        Currently using <strong>Alpha Leaf Cards</strong> only. Enable hybrid mode to attach sculpted canopy puffs onto your EZ-Tree branch tips.
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          updateEzTree(
                            { foliageMode: 'both' },
                            'enable hybrid leaf cards + canopy puffs',
                            true
                          )
                        }
                        className="shrink-0 px-2.5 py-1.5 rounded-lg bg-[#20B46A] text-white text-[10px] font-extrabold hover:bg-[#1B9E5C] whitespace-nowrap"
                      >
                        Enable Hybrid Puffs
                      </button>
                    </div>
                  )}
                  {/* CONIFER / PINE TIERED WIND-SWAYING BOUGHS */}
                  {activeSpecies === 'conifer' && (
                    <>
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1B202C] border border-slate-200/70 dark:border-white/[0.07] space-y-2.5">
                        <span className="text-xs font-extrabold block">Evergreen Style</span>
                        <div className="grid grid-cols-2 gap-1.5">
                          {CONIFER_SHAPE_OPTIONS.map((sh) => (
                            <button
                              key={sh.id}
                              type="button"
                              onClick={() =>
                                updateConfig(
                                  { coniferShape: sh.id as ConiferShapeStyle },
                                  `conifer shape ${sh.label}`,
                                  true
                                )
                              }
                              className={`py-1.5 px-2.5 rounded-lg text-xs font-bold border text-left transition-colors ${
                                (cfg.coniferShape ?? 'classic') === sh.id
                                  ? 'bg-[#20B46A]/15 border-[#20B46A] text-[#20B46A]'
                                  : 'bg-white dark:bg-[#171A23] border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {sh.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1B202C] border border-slate-200/70 dark:border-white/[0.07] space-y-3">
                        <span className="text-xs font-extrabold block">
                          Tiered Foliage Layers (Wind-Animated)
                        </span>
                        <SliderRow
                          label="Leaf Angle / Droop"
                          value={cfg.coniferDroop ?? 0.34}
                          min={-1}
                          max={1}
                          step={0.02}
                          display={(() => {
                            const d = cfg.coniferDroop ?? 0.34;
                            if (d < -0.75) return `Up ${Math.round(Math.abs(d) * 100)}% (Vertical)`;
                            if (d < -0.02) return `Up ${Math.round(Math.abs(d) * 100)}%`;
                            if (d <= 0.02) return 'Level (0°)';
                            return `Droop ${Math.round(d * 100)}%`;
                          })()}
                          hint="Slide left to lift leaves upward (nearly vertical); slide right to droop downward."
                          onChange={(v) => updateConfig({ coniferDroop: v })}
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <SliderRow
                            label="Tier Rows"
                            value={cfg.coniferTiers ?? 8}
                            min={3}
                            max={11}
                            step={1}
                            onChange={(v) => updateConfig({ coniferTiers: v })}
                          />
                          <SliderRow
                            label="Leaves per Tier"
                            value={cfg.coniferLeavesPerTier ?? 7}
                            min={3}
                            max={16}
                            step={1}
                            display={`${Math.round(cfg.coniferLeavesPerTier ?? 7)} / ring`}
                            hint="Sculpted leaves around each tier's circumference."
                            onChange={(v) => updateConfig({ coniferLeavesPerTier: v })}
                          />
                          <SliderRow
                            label="Bough Width"
                            value={cfg.coniferWidth ?? 1.52}
                            min={0.65}
                            max={2.4}
                            step={0.04}
                            display={`${(cfg.coniferWidth ?? 1.52).toFixed(2)}×`}
                            onChange={(v) => updateConfig({ coniferWidth: v })}
                          />
                          <SliderRow
                            label="Lowest Tier Height"
                            value={cfg.canopyHeight ?? 1.25}
                            min={0.5}
                            max={3.5}
                            step={0.05}
                            display={`${(cfg.canopyHeight ?? 1.25).toFixed(2)}m`}
                            onChange={(v) => updateConfig({ canopyHeight: v })}
                          />
                        </div>
                        <SliderRow
                          label="Layer Scarcity (Trunk Gaps)"
                          value={cfg.coniferScarcity ?? 0.16}
                          min={0}
                          max={1}
                          step={0.02}
                          display={`${Math.round((cfg.coniferScarcity ?? 0.16) * 100)}%`}
                          hint="Spreads layers upward so you can see bark between evergreen tiers."
                          onChange={(v) => updateConfig({ coniferScarcity: v })}
                        />
                        <SliderRow
                          label="Needle / Leaf Texture Bump"
                          value={cfg.foliageBumpStrength ?? 0.55}
                          min={0}
                          max={1}
                          step={0.02}
                          display={`${Math.round((cfg.foliageBumpStrength ?? 0.55) * 100)}%`}
                          hint="Adds crisp normal-mapped pine-needle relief across every sculpted frond."
                          onChange={(v) => updateConfig({ foliageBumpStrength: v })}
                        />
                      </div>

                      {/* Per-Tier Top-to-Bottom Gradient (Repeats on Every Individual Tier) */}
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1B202C] border border-slate-200/70 dark:border-white/[0.07] space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold">
                            Per-Tier Gradient (Top → Bottom of Each Row)
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                          <label className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.08] text-xs font-bold cursor-pointer">
                            <span>Tier Top</span>
                            <input
                              type="color"
                              value={cfg.coniferTopColor ?? '#98D45A'}
                              onChange={(e) => updateConfig({ coniferTopColor: e.target.value })}
                              className="w-7 h-6 rounded cursor-pointer border-0 bg-transparent"
                            />
                          </label>
                          <label className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.08] text-xs font-bold cursor-pointer">
                            <span>Tier Bottom</span>
                            <input
                              type="color"
                              value={cfg.coniferBottomColor ?? '#254F24'}
                              onChange={(e) => updateConfig({ coniferBottomColor: e.target.value })}
                              className="w-7 h-6 rounded cursor-pointer border-0 bg-transparent"
                            />
                          </label>
                        </div>

                        <SliderRow
                          label="Per-Tier Gradient Strength"
                          value={cfg.coniferGradientStrength ?? 0.92}
                          min={0}
                          max={1}
                          step={0.02}
                          display={`${Math.round((cfg.coniferGradientStrength ?? 0.92) * 100)}%`}
                          hint="Blends from Tier Top to Tier Bottom on every individual tier of leaves."
                          onChange={(v) => updateConfig({ coniferGradientStrength: v })}
                        />

                        <div className="flex flex-wrap gap-1.5">
                          {CONIFER_PALETTES.map((pal) => (
                            <button
                              key={pal.label}
                              type="button"
                              onClick={() =>
                                updateConfig(
                                  {
                                    coniferTopColor: pal.top,
                                    coniferBottomColor: pal.bottom,
                                    coniferGradientStrength: 0.95,
                                  },
                                  `conifer tier palette ${pal.label}`,
                                  true
                                )
                              }
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.08] hover:border-[#20B46A] text-[11px] font-bold"
                            >
                              <span
                                className="w-3.5 h-3.5 rounded-sm shrink-0"
                                style={{
                                  background: `linear-gradient(180deg, ${pal.top}, ${pal.bottom})`,
                                }}
                              />
                              <span>{pal.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Whole-Tree Gradient (Spans Across ALL Tiers Top to Bottom) */}
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1B202C] border border-slate-200/70 dark:border-white/[0.07] space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold">
                            Whole-Tree Gradient (Across All Tiers)
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 dark:text-[#7D859B]">
                            {(cfg.coniferWholeGradientStrength ?? 0) > 0.01 ? 'Active' : 'Off'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                          <label className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.08] text-xs font-bold cursor-pointer">
                            <span>Tree Top</span>
                            <input
                              type="color"
                              value={cfg.coniferWholeTopColor ?? '#B8EA5C'}
                              onChange={(e) =>
                                updateConfig({
                                  coniferWholeTopColor: e.target.value,
                                  coniferWholeGradientStrength:
                                    (cfg.coniferWholeGradientStrength ?? 0) < 0.05
                                      ? 0.85
                                      : cfg.coniferWholeGradientStrength,
                                })
                              }
                              className="w-7 h-6 rounded cursor-pointer border-0 bg-transparent"
                            />
                          </label>
                          <label className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.08] text-xs font-bold cursor-pointer">
                            <span>Tree Bottom</span>
                            <input
                              type="color"
                              value={cfg.coniferWholeBottomColor ?? '#173A24'}
                              onChange={(e) =>
                                updateConfig({
                                  coniferWholeBottomColor: e.target.value,
                                  coniferWholeGradientStrength:
                                    (cfg.coniferWholeGradientStrength ?? 0) < 0.05
                                      ? 0.85
                                      : cfg.coniferWholeGradientStrength,
                                })
                              }
                              className="w-7 h-6 rounded cursor-pointer border-0 bg-transparent"
                            />
                          </label>
                        </div>

                        <SliderRow
                          label="Whole-Tree Gradient Strength"
                          value={cfg.coniferWholeGradientStrength ?? 0}
                          min={0}
                          max={1}
                          step={0.02}
                          accent="#7C5CFF"
                          display={`${Math.round((cfg.coniferWholeGradientStrength ?? 0) * 100)}%`}
                          hint="Sweeps from Tree Top to Tree Bottom across all tiers as a whole. Blend with Per-Tier or drag to 100% for a full-tree gradient."
                          onChange={(v) => updateConfig({ coniferWholeGradientStrength: v })}
                        />

                        <div className="flex flex-wrap gap-1.5">
                          {CONIFER_PALETTES.map((pal) => (
                            <button
                              key={`whole_${pal.label}`}
                              type="button"
                              onClick={() =>
                                updateConfig(
                                  {
                                    coniferWholeTopColor: pal.top,
                                    coniferWholeBottomColor: pal.bottom,
                                    coniferWholeGradientStrength:
                                      (cfg.coniferWholeGradientStrength ?? 0) < 0.2
                                        ? 0.9
                                        : cfg.coniferWholeGradientStrength,
                                  },
                                  `conifer whole-tree palette ${pal.label}`,
                                  true
                                )
                              }
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.08] hover:border-[#7C5CFF] text-[11px] font-bold"
                            >
                              <span
                                className="w-3.5 h-3.5 rounded-sm shrink-0"
                                style={{
                                  background: `linear-gradient(180deg, ${pal.top}, ${pal.bottom})`,
                                }}
                              />
                              <span>{pal.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* BIRCH FINE TAPERED TWIGS + CLUSTERED LEAVES */}
                  {activeSpecies === 'birch' && (
                    <>
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1B202C] border border-slate-200/70 dark:border-white/[0.07] space-y-3">
                        <span className="text-xs font-extrabold block">
                          Fine Tapered Twigs &amp; Leaf Sprigs
                        </span>
                        <div className="grid grid-cols-2 gap-3">
                          <SliderRow
                            label="Fine Twig Density"
                            value={cfg.birchTwigDensity ?? 1.15}
                            min={0.4}
                            max={2.0}
                            step={0.05}
                            display={`${(cfg.birchTwigDensity ?? 1.15).toFixed(2)}×`}
                            onChange={(v) => updateConfig({ birchTwigDensity: v })}
                          />
                          <SliderRow
                            label="Twig Weep / Droop"
                            value={cfg.birchBranchDroop ?? 0.28}
                            min={0}
                            max={1}
                            step={0.02}
                            display={`${Math.round((cfg.birchBranchDroop ?? 0.28) * 100)}%`}
                            onChange={(v) => updateConfig({ birchBranchDroop: v })}
                          />
                          <SliderRow
                            label="Leaf Cluster Density"
                            value={cfg.birchLeafDensity ?? 1.25}
                            min={0.4}
                            max={2.2}
                            step={0.05}
                            display={`${(cfg.birchLeafDensity ?? 1.25).toFixed(2)}×`}
                            onChange={(v) => updateConfig({ birchLeafDensity: v })}
                          />
                          <SliderRow
                            label="Leaf Blade Size"
                            value={cfg.birchLeafSize ?? 1.05}
                            min={0.55}
                            max={1.9}
                            step={0.05}
                            display={`${(cfg.birchLeafSize ?? 1.05).toFixed(2)}×`}
                            onChange={(v) => updateConfig({ birchLeafSize: v })}
                          />
                        </div>
                        <SliderRow
                          label="Leaf Texture Bump"
                          value={cfg.foliageBumpStrength ?? 0.48}
                          min={0}
                          max={1}
                          step={0.02}
                          display={`${Math.round((cfg.foliageBumpStrength ?? 0.48) * 100)}%`}
                          hint="Adds tactile leaf-vein texture and surface bump depth to every birch leaf."
                          onChange={(v) => updateConfig({ foliageBumpStrength: v })}
                        />
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1B202C] border border-slate-200/70 dark:border-white/[0.07] space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold">
                            Leaf Color &amp; Autumn Hue Scatter
                          </span>
                          <input
                            type="color"
                            value={cfg.birchLeafColor ?? '#88C846'}
                            onChange={(e) => updateConfig({ birchLeafColor: e.target.value })}
                            className="w-7 h-6 rounded cursor-pointer border-0 bg-transparent"
                          />
                        </div>

                        <SliderRow
                          label="Per-Leaf Hue Scatter"
                          value={cfg.hueVariation}
                          min={0}
                          max={90}
                          step={1}
                          accent="#F59E0B"
                          display={`±${Math.round(cfg.hueVariation)}°`}
                          hint="Randomly shifts leaves within a hue range — great for warm fall reds, oranges, browns & yellows!"
                          onChange={(v) => updateConfig({ hueVariation: v })}
                        />

                        <div className="grid grid-cols-2 gap-1.5">
                          {BIRCH_PALETTES.map((pal) => (
                            <button
                              key={pal.label}
                              type="button"
                              onClick={() =>
                                updateConfig(
                                  {
                                    birchLeafColor: pal.leafColor,
                                    hueVariation: pal.hueVariation,
                                    saturationShift: pal.saturationShift,
                                    valueShift: pal.valueShift,
                                    hueShift: 0,
                                  },
                                  `birch season ${pal.label}`,
                                  true
                                )
                              }
                              className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.08] hover:border-[#20B46A] text-xs font-bold"
                            >
                              <span
                                className="w-3.5 h-3.5 rounded-full shrink-0"
                                style={{ backgroundColor: pal.swatch }}
                              />
                              <span className="truncate">{pal.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* OAK, FANTASY & CUSTOM: OVERLAPPING GLB / TEXTURED PUFFS + BUMP GUIDE */}
                  {supportsBroadleafCanopy && (
                    <>
                      {/* Upload Stylized Treetop GLB */}
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1B202C] border border-slate-200/70 dark:border-white/[0.07] space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold">
                            Stylized Treetop .GLB Model
                          </span>
                          <div className="flex items-center gap-1.5">
                            {cfg.canopyAssetId && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateConfig(
                                    { canopyAssetId: undefined },
                                    'use procedural textured foliage',
                                    true
                                  )
                                }
                                className="px-2 py-1 rounded-lg bg-slate-200 dark:bg-white/[0.08] text-[11px] font-bold"
                              >
                                Use Textured
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={uploadingSlot !== null}
                              onClick={() => canopyFileRef.current?.click()}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#20B46A] text-white text-[11px] font-extrabold hover:bg-[#1B9E5C]"
                            >
                              <Upload size={11} />
                              <span>
                                {uploadingSlot === 'canopy' ? 'Importing...' : 'Upload GLB'}
                              </span>
                            </button>
                          </div>
                        </div>
                        {selectedCanopyAsset ? (
                          <p className="text-[11px] text-[#20B46A] font-semibold truncate">
                            Active GLB: {selectedCanopyAsset.name} (distributed in {cfg.minPuffs}–
                            {cfg.maxPuffs} overlapping puffs)
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-500 dark:text-[#8E96AB]">
                            Upload your sphere treetop .GLB or sculpt with built-in textured leaf
                            clouds below.
                          </p>
                        )}
                      </div>

                      {/* Canopy Base (Single Base Color, Grain / Noise Pattern & Vertical Gradient) */}
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1B202C] border border-slate-200/70 dark:border-white/[0.07] space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="text-xs font-extrabold block">
                              Canopy Base (Color, Grain &amp; Gradient)
                            </span>
                            <span className="text-[10px] text-slate-500 dark:text-[#8E96AB]">
                              Clean leaf-free base shell — add 3D leaves anytime in the Leaves tab.
                            </span>
                          </div>
                          {!cfg.canopyAssetId && (
                            <label className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.08] cursor-pointer shrink-0">
                              <input
                                type="color"
                                value={cfg.foliageBaseColor ?? '#4B9A40'}
                                onChange={(e) =>
                                  updateConfig({ foliageBaseColor: e.target.value })
                                }
                                className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                              />
                              <span className="text-[10px] font-mono uppercase text-slate-500 dark:text-[#949BB0]">
                                Base
                              </span>
                            </label>
                          )}
                        </div>

                        {/* Quick Single Base Color Swatches */}
                        {!cfg.canopyAssetId && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {[
                              { hex: '#4B9A40', label: 'Meadow' },
                              { hex: '#2F6E3E', label: 'Deep Moss' },
                              { hex: '#719A36', label: 'Warm Olive' },
                              { hex: '#C96B28', label: 'Autumn' },
                              { hex: '#3B7D72', label: 'Teal Sage' },
                              { hex: '#8A56C7', label: 'Mystic' },
                            ].map((sw) => {
                              const selected =
                                (cfg.foliageBaseColor ?? '#4B9A40').toLowerCase() ===
                                sw.hex.toLowerCase();
                              return (
                                <button
                                  key={sw.hex}
                                  type="button"
                                  title={`Set base color: ${sw.label}`}
                                  onClick={() =>
                                    updateConfig(
                                      { foliageBaseColor: sw.hex },
                                      `canopy base color ${sw.label}`,
                                      true
                                    )
                                  }
                                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                                    selected
                                      ? 'border-[#20B46A] bg-[#20B46A]/15 text-[#20B46A]'
                                      : 'border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#171A23] text-slate-600 dark:text-slate-300'
                                  }`}
                                >
                                  <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: sw.hex }}
                                  />
                                  <span>{sw.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {!cfg.canopyAssetId && (
                          <div className="space-y-1.5">
                            <span className="text-[11px] font-bold text-slate-500 dark:text-[#8E96AB] block">
                              Base Surface Mode
                            </span>
                            <div className="grid grid-cols-2 gap-1.5">
                              {FOLIAGE_TEXTURE_OPTIONS.map((ft) => (
                                <button
                                  key={ft.id}
                                  type="button"
                                  onClick={() =>
                                    updateConfig(
                                      { foliageTextureStyle: ft.id as FoliageTextureStyle },
                                      `canopy surface ${ft.label}`,
                                      true
                                    )
                                  }
                                  className={`py-1.5 px-2.5 rounded-lg text-xs font-bold border text-left transition-colors ${
                                    (cfg.foliageTextureStyle ?? 'cleanBase') === ft.id
                                      ? 'bg-[#20B46A]/15 border-[#20B46A] text-[#20B46A]'
                                      : 'bg-white dark:bg-[#171A23] border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  {ft.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Procedural Grain / Noise Pattern Controls (for Leaf-Free Clean Base) */}
                        {!cfg.canopyAssetId &&
                          (cfg.foliageTextureStyle ?? 'cleanBase') === 'cleanBase' && (
                            <div className="pt-2 border-t border-slate-200/70 dark:border-white/[0.07] space-y-2.5">
                              <span className="text-[11px] font-extrabold block text-slate-700 dark:text-slate-200">
                                Surface Grain &amp; Noise Pattern
                              </span>
                              <div className="grid grid-cols-4 gap-1.5">
                                {CANOPY_BASE_PATTERN_OPTIONS.map((pat) => (
                                  <button
                                    key={pat.id}
                                    type="button"
                                    title={pat.blurb}
                                    onClick={() =>
                                      updateConfig(
                                        { canopyBasePattern: pat.id as CanopyBasePattern },
                                        `canopy grain pattern ${pat.label}`,
                                        true
                                      )
                                    }
                                    className={`py-1.5 px-1.5 rounded-lg text-[11px] font-bold border text-center transition-colors ${
                                      (cfg.canopyBasePattern ?? 'noise') === pat.id
                                        ? 'bg-[#20B46A]/15 border-[#20B46A] text-[#20B46A]'
                                        : 'bg-white dark:bg-[#171A23] border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-300'
                                    }`}
                                  >
                                    {pat.label}
                                  </button>
                                ))}
                              </div>

                              {(cfg.canopyBasePattern ?? 'noise') !== 'smooth' && (
                                <div className="grid grid-cols-2 gap-3">
                                  <SliderRow
                                    label="Grain / Noise Depth"
                                    value={cfg.canopyBaseGrainStrength ?? 0.42}
                                    min={0}
                                    max={1}
                                    step={0.02}
                                    display={`${Math.round((cfg.canopyBaseGrainStrength ?? 0.42) * 100)}%`}
                                    onChange={(v) => updateConfig({ canopyBaseGrainStrength: v })}
                                  />
                                  <SliderRow
                                    label="Pattern Scale"
                                    value={cfg.canopyBaseGrainScale ?? 1.25}
                                    min={0.4}
                                    max={3.0}
                                    step={0.05}
                                    display={`${(cfg.canopyBaseGrainScale ?? 1.25).toFixed(2)}×`}
                                    onChange={(v) => updateConfig({ canopyBaseGrainScale: v })}
                                  />
                                </div>
                              )}
                            </div>
                          )}

                        <SliderRow
                          label="Surface Bump Relief"
                          value={cfg.foliageBumpStrength ?? 0.42}
                          min={0}
                          max={1}
                          step={0.02}
                          display={`${Math.round((cfg.foliageBumpStrength ?? 0.42) * 100)}%`}
                          hint="Drives tactile normal-map relief from the grain/noise pattern or custom texture."
                          onChange={(v) => updateConfig({ foliageBumpStrength: v })}
                        />

                        {/* Canopy Base Top-to-Bottom Vertical Gradient (like Conifer) */}
                        <div className="pt-2.5 border-t border-slate-200/70 dark:border-white/[0.07] space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200">
                              Canopy Base Gradient (Top → Bottom)
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const baseC = new THREE.Color(cfg.foliageBaseColor ?? '#4B9A40');
                                const topC = baseC.clone().offsetHSL(0.025, 0.06, 0.16);
                                const botC = baseC.clone().offsetHSL(-0.025, 0.05, -0.17);
                                updateConfig(
                                  {
                                    canopyBaseTopColor: `#${topC.getHexString()}`,
                                    canopyBaseBottomColor: `#${botC.getHexString()}`,
                                    canopyBaseGradientStrength: Math.max(
                                      0.65,
                                      cfg.canopyBaseGradientStrength ?? 0.65
                                    ),
                                  },
                                  'auto derive canopy gradient',
                                  true
                                );
                              }}
                              className="px-2 py-0.5 rounded-md bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.08] hover:border-[#20B46A] text-[10px] font-bold text-slate-600 dark:text-slate-300"
                            >
                              Auto From Base
                            </button>
                          </div>

                          <div
                            className="h-2.5 w-full rounded-full border border-black/10 dark:border-white/10"
                            style={{
                              background: `linear-gradient(90deg, ${
                                cfg.canopyBaseBottomColor ?? '#214F2A'
                              }, ${cfg.foliageBaseColor ?? '#4B9A40'}, ${
                                cfg.canopyBaseTopColor ?? '#8ED156'
                              })`,
                            }}
                          />

                          <div className="grid grid-cols-2 gap-2.5">
                            <label className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.08] cursor-pointer">
                              <span className="text-[11px] font-bold">Top Color</span>
                              <input
                                type="color"
                                value={cfg.canopyBaseTopColor ?? '#8ED156'}
                                onChange={(e) =>
                                  updateConfig({ canopyBaseTopColor: e.target.value })
                                }
                                className="w-6 h-5 rounded cursor-pointer border-0 bg-transparent"
                              />
                            </label>
                            <label className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.08] cursor-pointer">
                              <span className="text-[11px] font-bold">Bottom Color</span>
                              <input
                                type="color"
                                value={cfg.canopyBaseBottomColor ?? '#214F2A'}
                                onChange={(e) =>
                                  updateConfig({ canopyBaseBottomColor: e.target.value })
                                }
                                className="w-6 h-5 rounded cursor-pointer border-0 bg-transparent"
                              />
                            </label>
                          </div>

                          <SliderRow
                            label="Gradient Blend Strength"
                            value={cfg.canopyBaseGradientStrength ?? 0.65}
                            min={0}
                            max={1}
                            step={0.02}
                            display={`${Math.round((cfg.canopyBaseGradientStrength ?? 0.65) * 100)}%`}
                            hint="0% uses pure single Base Color; 100% applies full top-to-bottom shading."
                            onChange={(v) => updateConfig({ canopyBaseGradientStrength: v })}
                          />

                          <div className="grid grid-cols-3 gap-1.5">
                            {CANOPY_BASE_GRADIENT_SCOPE_OPTIONS.map((sc) => (
                              <button
                                key={sc.id}
                                type="button"
                                onClick={() =>
                                  updateConfig(
                                    { canopyBaseGradientScope: sc.id as CanopyBaseGradientScope },
                                    `canopy gradient scope ${sc.label}`,
                                    true
                                  )
                                }
                                className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border text-center transition-colors ${
                                  (cfg.canopyBaseGradientScope ?? 'both') === sc.id
                                    ? 'bg-[#20B46A]/15 border-[#20B46A] text-[#20B46A]'
                                    : 'bg-white dark:bg-[#171A23] border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-300'
                                }`}
                              >
                                {sc.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Grouping, Branch Distribution & Silhouette */}
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1B202C] border border-slate-200/70 dark:border-white/[0.07] space-y-3">
                        <span className="text-xs font-extrabold block">
                          Grouping, Branch Crowns &amp; Overlap
                        </span>

                        <div className="grid grid-cols-2 gap-3">
                          <SliderRow
                            label="Attach to Main Branches"
                            value={cfg.canopyBranchAttach ?? 0.72}
                            min={0}
                            max={1}
                            step={0.02}
                            display={
                              (cfg.canopyBranchAttach ?? 0.72) <= 0.04
                                ? 'Central Mass'
                                : `${Math.round((cfg.canopyBranchAttach ?? 0.72) * 100)}%`
                            }
                            hint="Every main branch emanating from the trunk automatically gets its own canopy sphere(s)."
                            onChange={(v) => updateConfig({ canopyBranchAttach: v })}
                          />
                          <SliderRow
                            label="Branch Canopy Size"
                            value={cfg.branchCanopyScale ?? 0.68}
                            min={0.38}
                            max={0.95}
                            step={0.02}
                            display={`${Math.round((cfg.branchCanopyScale ?? 0.68) * 100)}%`}
                            hint="Size of branch crowns relative to the main trunk crown."
                            onChange={(v) => updateConfig({ branchCanopyScale: v })}
                          />
                          <SliderRow
                            label="Min Puffs"
                            value={cfg.minPuffs}
                            min={1}
                            max={10}
                            step={1}
                            onChange={(v) =>
                              updateConfig({ minPuffs: v, maxPuffs: Math.max(v, cfg.maxPuffs) })
                            }
                          />
                          <SliderRow
                            label="Max Puffs"
                            value={cfg.maxPuffs}
                            min={1}
                            max={12}
                            step={1}
                            onChange={(v) =>
                              updateConfig({ maxPuffs: v, minPuffs: Math.min(v, cfg.minPuffs) })
                            }
                          />
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {CANOPY_SILHOUETTE_OPTIONS.map((sil) => (
                            <button
                              key={sil.id}
                              type="button"
                              onClick={() =>
                                updateConfig(
                                  { silhouette: sil.id as CanopyCrownSilhouette },
                                  `canopy silhouette ${sil.label}`,
                                  true
                                )
                              }
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                                cfg.silhouette === sil.id
                                  ? 'bg-[#20B46A]/15 border-[#20B46A] text-[#20B46A]'
                                  : 'bg-white dark:bg-[#171A23] border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {sil.label}
                            </button>
                          ))}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <SliderRow
                            label="Canopy Height"
                            value={cfg.canopyHeight}
                            min={1.4}
                            max={6.0}
                            step={0.05}
                            display={`${cfg.canopyHeight.toFixed(2)}m`}
                            onChange={(v) => updateConfig({ canopyHeight: v })}
                          />
                          <SliderRow
                            label="Overlap Tightness"
                            value={cfg.overlapTightness}
                            min={0}
                            max={1}
                            step={0.02}
                            display={`${Math.round(cfg.overlapTightness * 100)}%`}
                            onChange={(v) => updateConfig({ overlapTightness: v })}
                          />
                          <SliderRow
                            label="Cluster Spread"
                            value={cfg.clusterSpread}
                            min={0.4}
                            max={2.0}
                            step={0.04}
                            display={`${cfg.clusterSpread.toFixed(2)}×`}
                            onChange={(v) => updateConfig({ clusterSpread: v })}
                          />
                          <SliderRow
                            label="Vertical Spread"
                            value={cfg.verticalSpread}
                            min={0.15}
                            max={1.6}
                            step={0.04}
                            display={`${cfg.verticalSpread.toFixed(2)}m`}
                            onChange={(v) => updateConfig({ verticalSpread: v })}
                          />
                        </div>
                      </div>

                      {/* Squish & Reshape */}
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1B202C] border border-slate-200/70 dark:border-white/[0.07] space-y-3">
                        <span className="text-xs font-extrabold block">Squish &amp; Reshape</span>
                        <div className="grid grid-cols-2 gap-3">
                          <SliderRow
                            label="Base Puff Size"
                            value={cfg.basePuffSize}
                            min={0.5}
                            max={2.2}
                            step={0.04}
                            display={`${cfg.basePuffSize.toFixed(2)}×`}
                            onChange={(v) => updateConfig({ basePuffSize: v })}
                          />
                          <SliderRow
                            label="Size Variety"
                            value={cfg.sizeVariation}
                            min={0}
                            max={0.85}
                            step={0.02}
                            display={`${Math.round(cfg.sizeVariation * 100)}%`}
                            onChange={(v) => updateConfig({ sizeVariation: v })}
                          />
                          <SliderRow
                            label="Vertical Squish Y"
                            value={cfg.squishY}
                            min={0.35}
                            max={1.65}
                            step={0.02}
                            display={`${cfg.squishY.toFixed(2)}×`}
                            onChange={(v) => updateConfig({ squishY: v })}
                          />
                          <SliderRow
                            label="Horizontal Oval"
                            value={cfg.ovalnessXZ}
                            min={0}
                            max={0.8}
                            step={0.02}
                            display={`${Math.round(cfg.ovalnessXZ * 100)}%`}
                            onChange={(v) => updateConfig({ ovalnessXZ: v })}
                          />
                          <SliderRow
                            label="Squish Random"
                            value={cfg.squishVariation}
                            min={0}
                            max={0.65}
                            step={0.02}
                            display={`${Math.round(cfg.squishVariation * 100)}%`}
                            onChange={(v) => updateConfig({ squishVariation: v })}
                          />
                          <SliderRow
                            label="Organic Tilt"
                            value={cfg.tiltAmount}
                            min={0}
                            max={45}
                            step={1}
                            display={`${Math.round(cfg.tiltAmount)}°`}
                            onChange={(v) => updateConfig({ tiltAmount: v })}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Seamless Custom Canopy / Sphere / Leaf Texture Map */}
                  <SurfaceTextureControls
                    store={store}
                    slot="treeCanopy"
                    title="Custom Seamless Canopy / Sphere Texture"
                    value={cfg.canopyTexture}
                    compact
                    accent="#20B46A"
                    onChange={(next, rec) =>
                      updateConfig({ canopyTexture: next }, 'update canopy texture', rec)
                    }
                  />
                </>
              )}

              {/* TAB 4: LEAVES (EZ-Tree Alpha Leaf Clusters OR Stylized 3D Contour Leaves) */}
              {activeTab === 'leaves' && (
                <>
                  {isEzTree ? (
                    <>
                      {/* EZ-Tree Foliage Mode Switcher */}
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1B202C] border border-slate-200/70 dark:border-white/[0.07] space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold">EZ-Tree Foliage Style</span>
                          <label className="inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={ezCfg.leavesEnabled}
                              onChange={(e) =>
                                updateEzTree(
                                  { leavesEnabled: e.target.checked },
                                  'toggle ez-tree leaf cards',
                                  true
                                )
                              }
                              className="w-3.5 h-3.5 accent-[#20B46A]"
                            />
                            <span>Leaves On</span>
                          </label>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {EZ_TREE_FOLIAGE_MODE_OPTIONS.map((fm) => (
                            <button
                              key={fm.id}
                              type="button"
                              onClick={() =>
                                updateEzTree(
                                  { foliageMode: fm.id as EzTreeFoliageMode },
                                  `ez-tree foliage ${fm.label}`,
                                  true
                                )
                              }
                              className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-colors ${
                                ezCfg.foliageMode === fm.id
                                  ? 'bg-[#20B46A]/15 border-[#20B46A] text-[#20B46A]'
                                  : 'bg-white dark:bg-[#171A23] border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {fm.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {ezCfg.leavesEnabled && ezCfg.foliageMode !== 'canopyPuffs' && (
                        <>
                          {/* Leaf Sprite Type */}
                          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1B202C] border border-slate-200/70 dark:border-white/[0.07] space-y-2.5">
                            <span className="text-xs font-extrabold block">
                              Leaf Cluster Sprite
                            </span>
                            <div className="grid grid-cols-2 gap-1.5">
                              {EZ_TREE_LEAF_STYLE_OPTIONS.map((opt) => (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() =>
                                    updateEzTree(
                                      { leafStyle: opt.id as EzTreeLeafStyle },
                                      `ez leaf style ${opt.label}`,
                                      true
                                    )
                                  }
                                  className={`p-2 rounded-xl border text-left transition-colors ${
                                    ezCfg.leafStyle === opt.id
                                      ? 'bg-[#20B46A]/15 border-[#20B46A] text-[#20B46A]'
                                      : 'bg-white dark:bg-[#171A23] border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-200'
                                  }`}
                                >
                                  <span className="text-xs font-extrabold block">{opt.label}</span>
                                  <span className="text-[10px] text-slate-500 dark:text-[#8E96AB] block">
                                    {opt.blurb}
                                  </span>
                                </button>
                              ))}
                            </div>

                            <div className="flex items-center justify-between pt-1">
                              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                Billboard Cards
                              </span>
                              <div className="inline-flex p-0.5 rounded-lg bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.08]">
                                {([
                                  { id: 'single', label: 'Single' },
                                  { id: 'double', label: 'Crossed 3D' },
                                ] as { id: EzTreeBillboardMode; label: string }[]).map((b) => (
                                  <button
                                    key={b.id}
                                    type="button"
                                    onClick={() =>
                                      updateEzTree({ billboard: b.id }, `billboard ${b.label}`, true)
                                    }
                                    className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold ${
                                      ezCfg.billboard === b.id
                                        ? 'bg-[#20B46A] text-white'
                                        : 'text-slate-500 dark:text-slate-400'
                                    }`}
                                  >
                                    {b.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Leaf Tint & Season Swatches */}
                          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1B202C] border border-slate-200/70 dark:border-white/[0.07] space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-extrabold">Leaf Color &amp; Season</span>
                              <label className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.08] cursor-pointer">
                                <input
                                  type="color"
                                  value={ezCfg.leafTint}
                                  onChange={(e) => updateEzTree({ leafTint: e.target.value })}
                                  className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                                />
                                <span className="text-[10px] font-mono uppercase text-slate-500">
                                  Tint
                                </span>
                              </label>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                              {LEAF_SEASON_PRESETS.map((season) => (
                                <button
                                  key={season.id}
                                  type="button"
                                  onClick={() =>
                                    updateEzTree(
                                      { leafTint: season.leafColor },
                                      `ez leaf season ${season.label}`,
                                      true
                                    )
                                  }
                                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.08] hover:border-[#20B46A]/60 text-left"
                                >
                                  <span
                                    className="w-3.5 h-3.5 rounded-full shrink-0"
                                    style={{ backgroundColor: season.leafColor }}
                                  />
                                  <span className="text-[11px] font-bold truncate">
                                    {season.label}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Leaf Density, Size, Spread & Cutout */}
                          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1B202C] border border-slate-200/70 dark:border-white/[0.07] space-y-3">
                            <span className="text-xs font-extrabold block">
                              Leaf Distribution &amp; Cutout
                            </span>
                            <div className="grid grid-cols-2 gap-3">
                              <SliderRow
                                label="Leaves per Twig"
                                value={ezCfg.leafCount}
                                min={2}
                                max={22}
                                step={1}
                                onChange={(v) => updateEzTree({ leafCount: v })}
                              />
                              <SliderRow
                                label="Cluster Size"
                                value={ezCfg.leafSize}
                                min={0.35}
                                max={2.4}
                                step={0.05}
                                display={`${ezCfg.leafSize.toFixed(2)}m`}
                                onChange={(v) => updateEzTree({ leafSize: v })}
                              />
                              <SliderRow
                                label="Twig Start"
                                value={ezCfg.leafStart}
                                min={0}
                                max={0.85}
                                step={0.02}
                                display={`${Math.round(ezCfg.leafStart * 100)}%`}
                                onChange={(v) => updateEzTree({ leafStart: v })}
                              />
                              <SliderRow
                                label="Angle Spread"
                                value={ezCfg.leafAngle}
                                min={10}
                                max={85}
                                step={1}
                                display={`${Math.round(ezCfg.leafAngle)}°`}
                                onChange={(v) => updateEzTree({ leafAngle: v })}
                              />
                              <SliderRow
                                label="Alpha Cutout"
                                value={ezCfg.leafAlphaTest}
                                min={0.12}
                                max={0.72}
                                step={0.02}
                                display={`${Math.round(ezCfg.leafAlphaTest * 100)}%`}
                                onChange={(v) => updateEzTree({ leafAlphaTest: v })}
                              />
                              <SliderRow
                                label="Leaf Bump Relief"
                                value={cfg.foliageBumpStrength ?? 0.42}
                                min={0}
                                max={1}
                                step={0.02}
                                display={`${Math.round((cfg.foliageBumpStrength ?? 0.42) * 100)}%`}
                                onChange={(v) => updateConfig({ foliageBumpStrength: v })}
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  ) : !supportsBroadleafCanopy ? (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#1B202C] border border-slate-200/70 dark:border-white/[0.07] space-y-2.5">
                      <span className="text-xs font-extrabold block">
                        3D Contour Leaves for Oak, Fantasy &amp; Custom Trees
                      </span>
                      <p className="text-xs text-slate-500 dark:text-[#949BB0] leading-relaxed">
                        {activeSpecies === 'conifer'
                          ? 'Conifer trees use sculpted tiered evergreen needle whorls. Adjust frond count, leaf angle, and gradients in the Canopy tab.'
                          : 'Birch trees grow tapered twig leaf clusters along fine branches. Adjust leaf density and autumn hue scatter in the Canopy tab.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('canopy')}
                        className="px-3 py-1.5 rounded-lg bg-[#20B46A] text-white text-xs font-extrabold hover:bg-[#1B9E5C]"
                      >
                        Go to Canopy Controls
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Master Enable Toggle */}
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1B202C] border border-slate-200/70 dark:border-white/[0.07] space-y-2">
                        <label className="flex items-center justify-between gap-2 cursor-pointer select-none">
                          <div>
                            <span className="text-xs font-extrabold block">
                              Add 3D Contour Leaves
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-[#8E96AB]">
                              Wraps dimensional leaves around the canopy base contour &amp; flutters in weather wind.
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            checked={cfg.canopyLeavesEnabled ?? true}
                            onChange={(e) =>
                              updateConfig(
                                { canopyLeavesEnabled: e.target.checked },
                                'toggle 3D contour leaves',
                                true
                              )
                            }
                            className="w-4 h-4 accent-[#20B46A] shrink-0"
                          />
                        </label>
                      </div>

                      {(cfg.canopyLeavesEnabled ?? true) && (
                        <>
                          {/* Leaf Shape Presets */}
                          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1B202C] border border-slate-200/70 dark:border-white/[0.07] space-y-2.5">
                            <span className="text-xs font-extrabold block">
                              Leaf Preset Shape
                            </span>
                            <div className="grid grid-cols-2 gap-2">
                              {CANOPY_LEAF_SHAPE_OPTIONS.map((opt) => {
                                const isActive = (cfg.canopyLeafShape ?? 'basic') === opt.id;
                                return (
                                  <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() =>
                                      updateConfig(
                                        { canopyLeafShape: opt.id as CanopyLeafShape },
                                        `leaf shape ${opt.label}`,
                                        true
                                      )
                                    }
                                    className={`flex items-center gap-2.5 p-2 rounded-xl border text-left transition-colors ${
                                      isActive
                                        ? 'bg-[#20B46A]/15 border-[#20B46A] text-[#20B46A]'
                                        : 'bg-white dark:bg-[#171A23] border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 hover:border-[#20B46A]/50'
                                    }`}
                                  >
                                    <LeafShapeSvg shape={opt.id} active={isActive} />
                                    <div className="min-w-0">
                                      <span className="text-xs font-extrabold block truncate">
                                        {opt.label}
                                      </span>
                                      <span className="text-[10px] text-slate-500 dark:text-[#8E96AB] block leading-tight">
                                        {opt.blurb}
                                      </span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Seasonal Hue Presets */}
                          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1B202C] border border-slate-200/70 dark:border-white/[0.07] space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-extrabold">
                                Seasonal Hue Presets
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const activeSeason: LeafSeasonPresetMeta | undefined =
                                    LEAF_SEASON_PRESETS.find(
                                      (s) => s.id === (cfg.canopyLeafSeason ?? 'summer')
                                    );
                                  if (!activeSeason) return;
                                  updateConfig(
                                    {
                                      foliageBaseColor: activeSeason.baseColor,
                                      canopyBaseTopColor: activeSeason.baseTopColor,
                                      canopyBaseBottomColor: activeSeason.baseBottomColor,
                                    },
                                    `match canopy base to ${activeSeason.label}`,
                                    true
                                  );
                                }}
                                className="px-2 py-0.5 rounded-md bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.08] hover:border-[#20B46A] text-[10px] font-bold text-slate-600 dark:text-slate-300"
                              >
                                Match Base to Season
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                              {LEAF_SEASON_PRESETS.map((season) => {
                                const isActive = (cfg.canopyLeafSeason ?? 'summer') === season.id;
                                return (
                                  <button
                                    key={season.id}
                                    type="button"
                                    onClick={() =>
                                      updateConfig(
                                        {
                                          canopyLeafSeason: season.id,
                                          canopyLeafColor: season.leafColor,
                                          canopyLeafHueSpread: season.hueSpread,
                                          canopyLeafValueSpread: season.valueSpread,
                                        },
                                        `leaf season ${season.label}`,
                                        true
                                      )
                                    }
                                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left transition-colors ${
                                      isActive
                                        ? 'bg-[#20B46A]/15 border-[#20B46A] text-[#20B46A]'
                                        : 'bg-white dark:bg-[#171A23] border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:border-[#20B46A]/50'
                                    }`}
                                  >
                                    <span className="flex items-center -space-x-1 shrink-0">
                                      <span
                                        className="w-3.5 h-3.5 rounded-full border border-white/60 dark:border-black/40"
                                        style={{ backgroundColor: season.swatchA }}
                                      />
                                      <span
                                        className="w-3.5 h-3.5 rounded-full border border-white/60 dark:border-black/40"
                                        style={{ backgroundColor: season.swatchB }}
                                      />
                                    </span>
                                    <span className="text-[11px] font-bold truncate">
                                      {season.label}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Leaf Color & Hue Spread */}
                          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1B202C] border border-slate-200/70 dark:border-white/[0.07] space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-extrabold">
                                Leaf Color &amp; Hue Variance
                              </span>
                              <label className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.08] cursor-pointer">
                                <input
                                  type="color"
                                  value={cfg.canopyLeafColor ?? '#62B84A'}
                                  onChange={(e) =>
                                    updateConfig({
                                      canopyLeafColor: e.target.value,
                                      canopyLeafSeason: 'custom',
                                    })
                                  }
                                  className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                                />
                                <span className="text-[10px] font-mono uppercase text-slate-500 dark:text-[#949BB0]">
                                  Leaf
                                </span>
                              </label>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <SliderRow
                                label="Hue Spread"
                                value={cfg.canopyLeafHueSpread ?? 14}
                                min={0}
                                max={90}
                                step={1}
                                accent="#F59E0B"
                                display={
                                  (cfg.canopyLeafHueSpread ?? 14) <= 1
                                    ? 'Uniform (0°)'
                                    : `±${Math.round(cfg.canopyLeafHueSpread ?? 14)}°`
                                }
                                hint="0° keeps all leaves one crisp hue; higher values mix seasonal reds, golds & greens."
                                onChange={(v) => updateConfig({ canopyLeafHueSpread: v })}
                              />
                              <SliderRow
                                label="Brightness Variety"
                                value={cfg.canopyLeafValueSpread ?? 0.14}
                                min={0}
                                max={0.45}
                                step={0.01}
                                accent="#20B46A"
                                display={`±${Math.round((cfg.canopyLeafValueSpread ?? 0.14) * 100)}%`}
                                hint="Random light-to-shadow value variation across individual leaves."
                                onChange={(v) => updateConfig({ canopyLeafValueSpread: v })}
                              />
                            </div>
                          </div>

                          {/* Leaf Sizing, 3D Contour Offset & Wind Flutter */}
                          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1B202C] border border-slate-200/70 dark:border-white/[0.07] space-y-3">
                            <span className="text-xs font-extrabold block">
                              Contour Fit, 3D Offset &amp; Wind Motion
                            </span>

                            <div className="grid grid-cols-2 gap-3">
                              <SliderRow
                                label="Leaf Count"
                                value={cfg.canopyLeafCount ?? 220}
                                min={20}
                                max={650}
                                step={10}
                                display={`${Math.round(cfg.canopyLeafCount ?? 220)}`}
                                onChange={(v) => updateConfig({ canopyLeafCount: v })}
                              />
                              <SliderRow
                                label="Leaf Size"
                                value={cfg.canopyLeafSize ?? 0.34}
                                min={0.14}
                                max={0.75}
                                step={0.01}
                                display={`${(cfg.canopyLeafSize ?? 0.34).toFixed(2)}m`}
                                onChange={(v) => updateConfig({ canopyLeafSize: v })}
                              />
                              <SliderRow
                                label="Size Variety"
                                value={cfg.canopyLeafSizeRandomness ?? 0.45}
                                min={0}
                                max={1}
                                step={0.02}
                                display={
                                  (cfg.canopyLeafSizeRandomness ?? 0.45) <= 0.04
                                    ? 'Uniform'
                                    : `${Math.round((cfg.canopyLeafSizeRandomness ?? 0.45) * 100)}% Random`
                                }
                                hint="Slide left for uniform leaf sizes, right for organic size variety."
                                onChange={(v) => updateConfig({ canopyLeafSizeRandomness: v })}
                              />
                              <SliderRow
                                label="3D Surface Offset"
                                value={cfg.canopyLeafSurfaceOffset ?? 0.11}
                                min={0}
                                max={0.42}
                                step={0.01}
                                accent="#7C5CFF"
                                display={`+${(cfg.canopyLeafSurfaceOffset ?? 0.11).toFixed(2)}m`}
                                hint="Lifts leaves slightly outside the canopy shell for crisp 3D depth."
                                onChange={(v) => updateConfig({ canopyLeafSurfaceOffset: v })}
                              />
                              <SliderRow
                                label="Contour Tilt"
                                value={cfg.canopyLeafTiltRandomness ?? 0.36}
                                min={0}
                                max={1}
                                step={0.02}
                                display={
                                  (cfg.canopyLeafTiltRandomness ?? 0.36) <= 0.06
                                    ? 'Flush Contour'
                                    : `${Math.round((cfg.canopyLeafTiltRandomness ?? 0.36) * 100)}%`
                                }
                                hint="0% hugs the canopy surface tightly; higher adds layered 3D flutter tilt."
                                onChange={(v) => updateConfig({ canopyLeafTiltRandomness: v })}
                              />
                              <SliderRow
                                label="Wind Flutter"
                                value={cfg.canopyLeafWindFlutter ?? 1.0}
                                min={0}
                                max={2.2}
                                step={0.05}
                                accent="#38BDF8"
                                display={`${(cfg.canopyLeafWindFlutter ?? 1.0).toFixed(2)}×`}
                                hint="Blows & ripples dynamically with scene Weather & Wind Strength."
                                onChange={(v) => updateConfig({ canopyLeafWindFlutter: v })}
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </>
              )}

              {/* TAB 5: COLOR, HUE & WIND */}
              {activeTab === 'color' && (
                <>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1B202C] border border-slate-200/70 dark:border-white/[0.07] space-y-3">
                    <span className="text-xs font-extrabold block">
                      Hue, Saturation &amp; Value
                    </span>

                    <div className="space-y-1.5">
                      <div
                        className="h-2.5 w-full rounded-full"
                        style={{
                          background:
                            'linear-gradient(90deg, #ff4d4d, #f59e0b, #84cc16, #10b981, #06b6d4, #6366f1, #d946ef, #ff4d4d)',
                        }}
                      />
                      <SliderRow
                        label="Hue Shift"
                        value={cfg.hueShift}
                        min={-180}
                        max={180}
                        step={1}
                        accent="#7C5CFF"
                        display={`${cfg.hueShift > 0 ? '+' : ''}${Math.round(cfg.hueShift)}°`}
                        onChange={(v) => updateConfig({ hueShift: v })}
                      />
                    </div>

                    <SliderRow
                      label="Random Hue Variation"
                      value={cfg.hueVariation}
                      min={0}
                      max={90}
                      step={1}
                      accent="#F59E0B"
                      display={`±${Math.round(cfg.hueVariation)}°`}
                      hint="Spreads leaf & tree colors within a hue band (e.g. warm autumn mix or varied conifer greens)."
                      onChange={(v) => updateConfig({ hueVariation: v })}
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <SliderRow
                        label="Saturation"
                        value={cfg.saturationShift}
                        min={-0.6}
                        max={0.6}
                        step={0.02}
                        accent="#7C5CFF"
                        display={`${cfg.saturationShift >= 0 ? '+' : ''}${Math.round(
                          cfg.saturationShift * 100
                        )}%`}
                        onChange={(v) => updateConfig({ saturationShift: v })}
                      />
                      <SliderRow
                        label="Value (Brightness)"
                        value={cfg.valueShift}
                        min={-0.45}
                        max={0.45}
                        step={0.02}
                        accent="#F59E0B"
                        display={`${cfg.valueShift >= 0 ? '+' : ''}${Math.round(
                          cfg.valueShift * 100
                        )}%`}
                        onChange={(v) => updateConfig({ valueShift: v })}
                      />
                      <SliderRow
                        label="Value Variation"
                        value={cfg.valueVariation}
                        min={0}
                        max={0.35}
                        step={0.01}
                        accent="#F59E0B"
                        display={`±${Math.round(cfg.valueVariation * 100)}%`}
                        onChange={(v) => updateConfig({ valueVariation: v })}
                      />
                      <SliderRow
                        label="Sunlit Crown Lift"
                        value={cfg.sunCrownGradient}
                        min={0}
                        max={0.6}
                        step={0.02}
                        display={`${Math.round(cfg.sunCrownGradient * 100)}%`}
                        onChange={(v) => updateConfig({ sunCrownGradient: v })}
                      />
                    </div>
                  </div>

                  {/* Wind & Island Target */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1B202C] border border-slate-200/70 dark:border-white/[0.07] space-y-3">
                    <SliderRow
                      label="Living Wind Sway"
                      value={cfg.windSway}
                      min={0}
                      max={2.2}
                      step={0.05}
                      display={`${cfg.windSway.toFixed(2)}×`}
                      hint="Animates conifer tiers, birch leaves, and canopy clouds gently in the breeze."
                      onChange={(v) => updateConfig({ windSway: v })}
                    />

                    <div className="space-y-1.5 pt-1 border-t border-slate-200/70 dark:border-white/[0.07]">
                      <span className="text-xs font-extrabold block">
                        Apply Across Island Forest
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {CANOPY_TARGET_OPTIONS.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() =>
                              updateConfig(
                                { targetTrees: t.id as CanopyTargetTrees, enabled: true },
                                `target trees ${t.label}`,
                                true
                              )
                            }
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                              cfg.targetTrees === t.id
                                ? 'bg-[#20B46A]/15 border-[#20B46A] text-[#20B46A]'
                                : 'bg-white dark:bg-[#171A23] border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-slate-400 dark:text-[#7D859B]">
                        &ldquo;Match Species&rdquo; uses your Conifer profile for pines, Oak/Fantasy/Custom
                        for oaks, and Birch profile for birches simultaneously.
                      </p>
                    </div>
                  </div>
                </>
              )}

              {/* TAB 5: FRUIT & PRESETS */}
              {activeTab === 'fruit' && (
                <>
                  {/* Fruit Distribution (Oak, Fantasy & Custom) */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1B202C] border border-slate-200/70 dark:border-white/[0.07] space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-extrabold block">
                          Tree Fruit &amp; Orbs
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-[#8E96AB]">
                          {supportsBroadleafCanopy
                            ? 'Distribute stylized fruit spheres or your own custom Fruit .GLB'
                            : 'Switch to Oak, Fantasy, or Custom to grow canopy fruit'}
                        </span>
                      </div>
                      <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer select-none">
                        <input
                          type="checkbox"
                          disabled={!supportsBroadleafCanopy}
                          checked={Boolean(cfg.fruitEnabled)}
                          onChange={(e) =>
                            updateConfig(
                              { fruitEnabled: e.target.checked },
                              'toggle tree fruit',
                              true
                            )
                          }
                          className="accent-[#E11D48]"
                        />
                        <span>Enable</span>
                      </label>
                    </div>

                    {supportsBroadleafCanopy && cfg.fruitEnabled && (
                      <div className="space-y-3 pt-2 border-t border-slate-200/70 dark:border-white/[0.07]">
                        {/* Fruit Model Source */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate">
                            {selectedFruitAsset
                              ? `GLB: ${selectedFruitAsset.name}`
                              : 'Using Stylized 3D Spheres'}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {cfg.fruitAssetId && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateConfig(
                                    { fruitAssetId: undefined },
                                    'use sphere fruit',
                                    true
                                  )
                                }
                                className="px-2 py-1 rounded-lg bg-slate-200 dark:bg-white/[0.08] text-[11px] font-bold"
                              >
                                Spheres
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={uploadingSlot !== null}
                              onClick={() => fruitFileRef.current?.click()}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#E11D48]/15 text-[#E11D48] text-[11px] font-bold hover:bg-[#E11D48]/25"
                            >
                              <Upload size={11} />
                              <span>
                                {uploadingSlot === 'fruit' ? 'Importing...' : 'Upload Fruit GLB'}
                              </span>
                            </button>
                          </div>
                        </div>

                        {/* Fruit Color Swatches */}
                        {!cfg.fruitAssetId && (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold">Fruit Color</span>
                            <div className="flex items-center gap-1.5">
                              {FRUIT_SWATCHES.map((hex) => (
                                <button
                                  key={hex}
                                  type="button"
                                  onClick={() => updateConfig({ fruitColor: hex })}
                                  style={{ backgroundColor: hex }}
                                  className={`w-5 h-5 rounded-full border ${
                                    cfg.fruitColor?.toLowerCase() === hex.toLowerCase()
                                      ? 'border-white ring-2 ring-[#20B46A]'
                                      : 'border-black/25'
                                  }`}
                                  aria-label={`Fruit color ${hex}`}
                                />
                              ))}
                              <input
                                type="color"
                                value={cfg.fruitColor ?? '#D93B3B'}
                                onChange={(e) => updateConfig({ fruitColor: e.target.value })}
                                className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                              />
                            </div>
                          </div>
                        )}

                        {/* Distribution Mode */}
                        <div className="grid grid-cols-3 gap-1.5">
                          {FRUIT_DISTRIBUTION_OPTIONS.map((d) => (
                            <button
                              key={d.id}
                              type="button"
                              onClick={() =>
                                updateConfig(
                                  { fruitDistribution: d.id as FruitDistributionMode },
                                  `fruit layout ${d.label}`,
                                  true
                                )
                              }
                              className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-colors ${
                                (cfg.fruitDistribution ?? 'outerCrown') === d.id
                                  ? 'bg-[#E11D48]/15 border-[#E11D48] text-[#E11D48]'
                                  : 'bg-white dark:bg-[#171A23] border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {d.label}
                            </button>
                          ))}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <SliderRow
                            label="Fruit Count"
                            value={cfg.fruitCount ?? 12}
                            min={1}
                            max={32}
                            step={1}
                            accent="#E11D48"
                            onChange={(v) => updateConfig({ fruitCount: v })}
                          />
                          <SliderRow
                            label="Fruit Size"
                            value={cfg.fruitSize ?? 0.17}
                            min={0.08}
                            max={0.42}
                            step={0.01}
                            accent="#E11D48"
                            display={`${(cfg.fruitSize ?? 0.17).toFixed(2)}m`}
                            onChange={(v) => updateConfig({ fruitSize: v })}
                          />
                        </div>

                        <SliderRow
                          label="Fruit / Lantern Glow"
                          value={cfg.fruitGlow ?? 0}
                          min={0}
                          max={2.0}
                          step={0.05}
                          accent="#F59E0B"
                          display={`${Math.round((cfg.fruitGlow ?? 0) * 100)}%`}
                          onChange={(v) => updateConfig({ fruitGlow: v })}
                        />

                        <SurfaceTextureControls
                          store={store}
                          slot="fruit"
                          title="Custom Seamless Fruit Texture"
                          value={cfg.fruitTexture}
                          compact
                          accent="#E11D48"
                          onChange={(next, rec) =>
                            updateConfig({ fruitTexture: next }, 'update fruit texture', rec)
                          }
                        />
                      </div>
                    )}
                  </div>

                  {/* One-Click Showcase Presets */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={13} className="text-[#20B46A]" />
                      <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB]">
                        Species Showcase Presets
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {CANOPY_STYLE_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => applyPreset(preset)}
                          className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#1B202C] hover:bg-slate-100 dark:hover:bg-[#222838] border border-slate-200/80 dark:border-white/[0.08] text-left transition-colors space-y-1"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3.5 h-3.5 rounded-full shrink-0"
                              style={{
                                background: `linear-gradient(135deg, ${preset.swatchHex}, ${preset.accentHex})`,
                              }}
                            />
                            <span className="text-xs font-extrabold truncate">{preset.name}</span>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-[#8E96AB] leading-snug line-clamp-2">
                            {preset.blurb}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* TAB 7: EMBEDDED 3D VERTEX PAINT */}
              {activeTab === 'paint' && (
                <VertexPaintInspector
                  brush={paintBrush}
                  onChangeBrush={setPaintBrush}
                  interactionTool={paintTool}
                  onChangeInteractionTool={setPaintTool}
                  strokeCount={paintCount}
                  canRedo={paintRedoStack.length > 0}
                  showPartTargets
                  partTargetLabels={{
                    all: 'Whole Tree',
                    leaves: 'Leaves & Canopy',
                    branches: 'Bark & Branches',
                  }}
                  accentColor="#20B46A"
                  onUndoStroke={() => {
                    const prev = cfgRef.current.vertexPaintStrokes ?? [];
                    if (prev.length === 0) return;
                    const popped = prev[prev.length - 1];
                    setPaintRedoStack((r) => [...r, popped]);
                    setTreePaintStrokes((list) => list.slice(0, -1), 'undo tree paint stroke', true);
                  }}
                  onRedoStroke={() => {
                    setPaintRedoStack((stack) => {
                      if (stack.length === 0) return stack;
                      const restored = stack[stack.length - 1];
                      setTreePaintStrokes((list) => [...list, restored], 'redo tree paint stroke', true);
                      return stack.slice(0, -1);
                    });
                  }}
                  onClearAllPaint={() => {
                    setPaintRedoStack([]);
                    setTreePaintStrokes(() => [], 'clear tree vertex paint', true);
                  }}
                  onAutoDapple={() => {
                    const centerTree = previewRefs.current?.centerTree;
                    if (!centerTree) return;
                    const stroke = generateOrganicDappleStroke(
                      centerTree,
                      paintBrush,
                      Math.floor(Math.random() * 900000) + 100
                    );
                    if (stroke) {
                      setPaintRedoStack([]);
                      setTreePaintStrokes((list) => [...list, stroke], 'auto dapple tree leaves', true);
                    }
                  }}
                />
              )}
            </div>

            {/* Bottom Action Footer */}
            <footer className="shrink-0 px-4 py-3 border-t border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#131720] flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={treeAssetName}
                  onChange={(e) => setTreeAssetName(e.target.value)}
                  placeholder="Tree asset name…"
                  className="w-32 px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#1C212D] border border-slate-200 dark:border-white/[0.1] text-xs font-bold focus:outline-none focus:border-[#20B46A]"
                />
                <button
                  type="button"
                  disabled={savingTreeAsset}
                  onClick={() => void handleSaveTreeAsset()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#7C5CFF] hover:bg-[#6A48F5] text-white text-xs font-extrabold whitespace-nowrap disabled:opacity-50"
                >
                  <Save size={13} />
                  <span>
                    {savingTreeAsset
                      ? 'Saving…'
                      : savedTreeAssetNote ?? (editingAssetId ? 'Update Tree Asset' : 'Save to Trees')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    store.addCanopyTreeEntity(cfg, undefined, activeSpeciesLabel);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#20B46A] hover:bg-[#1B9E5C] text-white text-xs font-extrabold whitespace-nowrap"
                >
                  <Plus size={13} />
                  <span>Place 1 {activeSpeciesLabel}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    store.scatterCanopyGrove(cfg, 10);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#20B46A]/15 hover:bg-[#20B46A]/25 text-[#20B46A] text-xs font-extrabold whitespace-nowrap"
                >
                  <Trees size={13} />
                  <span>Scatter 10 Grove</span>
                </button>
                {onOpenVertexPainter && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('paint')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#EC4899]/15 hover:bg-[#EC4899]/25 text-[#EC4899] text-xs font-extrabold whitespace-nowrap"
                  >
                    <Paintbrush size={13} />
                    <span>Paint Brush</span>
                    {paintCount > 0 && (
                      <span className="tabular-nums text-[10px] opacity-85">({paintCount})</span>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    const saved = await store.saveDesignPreset({
                      name: `${activeSpeciesLabel} Tree Preset`,
                      scope: 'treeStudio',
                      includeAssets: true,
                    });
                    if (saved) {
                      setSavedTreePresetNote(true);
                      setTimeout(() => setSavedTreePresetNote(false), 2600);
                    }
                  }}
                  title="Save this Tree Maker design into your local saved presets library"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-200/80 dark:bg-[#1F2430] hover:bg-slate-300/80 dark:hover:bg-[#272D3C] text-xs font-extrabold whitespace-nowrap"
                >
                  <Save size={13} className="text-[#20B46A]" />
                  <span>{savedTreePresetNote ? 'Saved to Presets!' : 'Save Preset'}</span>
                </button>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-200/80 dark:bg-[#232938] hover:bg-slate-300 dark:hover:bg-[#2C3346] text-xs font-extrabold"
              >
                Done
              </button>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
};
