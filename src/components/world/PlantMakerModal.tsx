import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { WebGPURenderer } from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import {
  ChevronDown,
  Copy,
  Dices,
  Eye,
  EyeOff,
  Flower2,
  FolderOpen,
  Grid3X3,
  Group,
  Layers,
  Leaf,
  MousePointer2,
  Move,
  Paintbrush,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Save,
  Scaling,
  Sparkles,
  Spline,
  Sprout,
  Trash2,
  Undo2,
  Ungroup,
  Wand2,
  Wind,
  X,
} from 'lucide-react';
import {
  requestOpenContextualAiModal,
  useRegisterStudioAiBridge,
} from '../../ai/studioBridge';
import { sanitizePlantMakerResult } from '../../ai/aiAppliers';
import type { MakerStore } from '../../store/useMakerStore';
import { WEATHERING_PRESETS } from '../../three/nodeMaterialUtils';
import {
  buildCurveInstance,
  buildCurveSweepGeometry,
  computeCurveLength,
  createCurvePresetPoints,
  createDefaultCurveGuide,
  sampleCurveTransforms,
} from '../../three/curveGuide';
import { combineGeometriesWorldSpace, serializeBufferGeometry } from '../../three/meshCsg';
import { enhanceTransformControlsGizmo } from '../../three/gizmoEnhancer';
import {
  buildAndExportObjectDocToGlb,
  buildObjectMakerSceneGroup,
  buildPartGeometry,
  centerAndGroundObjectDoc,
  computePartWorldMatrix,
  sanitizeObjectNodeName,
} from '../../three/objectMakerBuilder';
import {
  FLOWER_STARTER_RECIPES,
  PLANT_COLOR_PALETTES,
  PLANT_PATTERN_OPTIONS,
  PLANT_SHAPE_CATALOG,
  PLANT_STARTER_PRESETS,
  buildFlowerDocFromRecipe,
  buildPlantClusterParts,
  createClusterGroupAndParts,
  createDefaultFlowerRecipe,
  createDefaultPlantPartSpec,
  createStarterPlantDoc,
  getPlantShapeMeta,
  isPlantShape,
  type PlantShapeCategory,
} from '../../three/plantMakerBuilder';
import {
  createMakerRenderer,
  detectSoftwareGl,
  disposeObject3D,
  initMakerRenderer,
  setupSceneEnvironment,
} from '../../three/islandScene';
import {
  GRASS_MEADOW_PRESETS,
  GrassSamplePreview,
  type GrassSampleStats,
} from '../../three/grassSamplePreview';
import {
  createDefaultGrassConfig,
  resolveGrassConfig,
} from '../../three/stylizedGrassSystem';
import { isWebGPUFallbackAdapter } from '../../three/webglUtils';
import {
  applyVertexPaintStrokesToObject,
  generateOrganicDappleStroke,
  prepareObjectForVertexPainting,
  resetObjectVertexPaint,
  type VertexPaintBrushSettings,
} from '../../three/vertexPainter';
import {
  MakerVertexPaintSession,
  shiftVertexPaintStrokes,
} from '../../three/vertexPaintViewportHelper';
import { VertexPaintInspector } from './VertexPaintInspector';
import type {
  AssetCategory,
  CurveGuideConfig,
  CurveGuidePresetId,
  CustomAssetMeta,
  FlowerMakerRecipe,
  GrassFieldConfig,
  GrassQuality,
  ObjectGroupSpec,
  ObjectMakerDoc,
  ObjectPartSpec,
  PlantClusterLayout,
  PlantClusterRecipe,
  PlantLeafPatternId,
  PlantPartConfig,
  PlantShapeId,
  VertexPaintStroke,
  WeatheringPreset,
} from '../../types/maker';
import { uid } from '../../utils/terrain';
import { AssetThumbnail } from '../shared/AssetThumbnail';

export interface PlantMakerModalProps {
  store: MakerStore;
  initialAssetId?: string | null;
  initialSection?: 'plant' | 'flower' | 'grass';
  onClose: () => void;
}

type StudioSection = 'plant' | 'flower' | 'grass';
type StudioToolMode = 'select' | 'translate' | 'rotate' | 'scale';
type InspectorTab = 'cluster' | 'shape' | 'pattern' | 'paint';
type CameraPreset = 'threeQuarter' | 'front' | 'top' | 'close';
type ShapeFilter = 'all' | PlantShapeCategory;

const CURVE_PRESET_LABELS: { id: CurveGuidePresetId; label: string }[] = [
  { id: 'arc', label: 'Vine Arc' },
  { id: 'sCurve', label: 'S-Vine' },
  { id: 'arch', label: 'Creeping Arch' },
  { id: 'semiCircle', label: 'Half Ring' },
  { id: 'circle', label: 'Garland' },
];

const CLUSTER_SHAPE_IDS: PlantShapeId[] = [
  'leafBanana',
  'leafElephantEar',
  'leafTeardrop',
  'leafBlade',
  'leafMonstera',
  'leafFern',
  'leafLotus',
  'leafHeartVine',
  'petalRound',
  'petalPointed',
  'petalRuffled',
  'petalOrchid',
  'fantasyBell',
  'fantasySpiralRibbon',
  'fantasyTrumpet',
  'fantasyMushroom',
];

function createDefaultClusterRecipe(): PlantClusterRecipe {
  const meta = getPlantShapeMeta('leafBanana');
  return {
    target: 'leaf',
    shape: 'leafBanana',
    count: 8,
    layout: 'fan',
    symmetrical: false,
    randomness: 0.32,
    fanAngleDeg: 52,
    arcSpanDeg: 360,
    centerRadius: 0.08,
    hubHeight: 0.14,
    minScale: 0.8,
    maxScale: 1.18,
    tierLayers: 2,
    includeFlowerCore: false,
    coreColor: '#F59E0B',
    baseDimensions: [...meta.defaultSize] as [number, number, number],
    basePlant: {
      pattern: meta.defaultPattern,
      accentColor: meta.defaultAccentColor,
      tipColor: meta.defaultTipColor,
      droop: meta.defaultDroop,
      cup: meta.defaultCup,
      ruffle: meta.defaultRuffle,
      asymSkew: meta.defaultAsymSkew ?? 0,
      tatter: 0,
      veinDepth: 0.48,
      doubleSided: true,
    },
    baseColor: meta.defaultColor,
    seed: Math.floor(Math.random() * 9000 + 100),
  };
}

function ensureUniquePlantNodeNames(doc: ObjectMakerDoc): ObjectMakerDoc {
  const seen = new Set<string>();
  const makeUnique = (raw: string, fallback: string): string => {
    const base = sanitizeObjectNodeName(raw, fallback);
    if (!seen.has(base)) {
      seen.add(base);
      return base;
    }
    let idx = 2;
    while (seen.has(`${base}_${idx}`)) idx++;
    const unique = `${base}_${idx}`;
    seen.add(unique);
    return unique;
  };
  return {
    ...doc,
    groups: doc.groups.map((g, idx) => ({
      ...g,
      name: makeUnique(g.name, `PlantGroup_${idx + 1}`),
    })),
    parts: doc.parts.map((p, idx) => ({
      ...p,
      name: makeUnique(p.name, `BotanicalPart_${idx + 1}`),
    })),
  };
}

export const PlantMakerModal: React.FC<PlantMakerModalProps> = ({
  store,
  initialAssetId = null,
  initialSection = 'plant',
  onClose,
}) => {
  const [studioSection, setStudioSection] = useState<StudioSection>(
    initialAssetId ? 'plant' : initialSection
  );
  const [editingAssetId, setEditingAssetId] = useState<string | null>(initialAssetId);
  const [flowerRecipe, setFlowerRecipe] = useState<FlowerMakerRecipe>(() =>
    createDefaultFlowerRecipe()
  );
  const [plantName, setPlantName] = useState<string>(() =>
    !initialAssetId && initialSection === 'flower'
      ? FLOWER_STARTER_RECIPES[0].name
      : 'Tropical Banana Clump'
  );
  const [assetCategory, setAssetCategory] = useState<AssetCategory>('plant');
  const [doc, setDoc] = useState<ObjectMakerDoc>(() =>
    !initialAssetId && initialSection === 'flower'
      ? buildFlowerDocFromRecipe(FLOWER_STARTER_RECIPES[0])
      : createStarterPlantDoc()
  );

  // Grass & Meadow Maker sampler state (synced live to currentLevel.grass)
  const [localGrassFallback, setLocalGrassFallback] = useState<GrassFieldConfig>(() =>
    createDefaultGrassConfig()
  );
  const [grassPatchSize, setGrassPatchSize] = useState<2.5 | 4 | 6>(4);
  const [grassSeed, setGrassSeed] = useState<number>(1);
  const [showGrassGuides, setShowGrassGuides] = useState<boolean>(true);
  const [grassPreviewWind, setGrassPreviewWind] = useState<number>(0.45);
  const [grassStats, setGrassStats] = useState<GrassSampleStats>({
    patchSizeM: 4,
    patchAreaSqM: 16,
    bladeCount: 50,
    bladesPerSqM: 3.1,
    clumpCount: 6,
    cellSpacingM: 0.818,
    bladesPerCell: 2,
  });

  // Undo / Redo stacks
  const [undoStack, setUndoStack] = useState<ObjectMakerDoc[]>([]);
  const [redoStack, setRedoStack] = useState<ObjectMakerDoc[]>([]);

  // Studio Tools & UI state
  const [toolMode, setToolMode] = useState<StudioToolMode>('translate');
  const [gridSnapStep, setGridSnapStep] = useState<0 | 0.05 | 0.1 | 0.25>(0);
  const [selectedPartIds, setSelectedPartIds] = useState<string[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(
    () => doc.groups[0]?.id ?? null
  );
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('cluster');
  const [shapeFilter, setShapeFilter] = useState<ShapeFilter>('all');
  const [showLeftDock, setShowLeftDock] = useState<boolean>(true);
  const [showLoadMenu, setShowLoadMenu] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [placeOnSave, setPlaceOnSave] = useState<boolean>(() => !initialAssetId);
  const [toast, setToast] = useState<string | null>(null);
  const [gizmoHudText, setGizmoHudText] = useState<string | null>(null);

  // Embedded Vertex Paint state
  const [paintStrokes, setPaintStrokes] = useState<VertexPaintStroke[]>([]);
  const [paintRedoStack, setPaintRedoStack] = useState<VertexPaintStroke[]>([]);
  const [paintTool, setPaintTool] = useState<'paint' | 'orbit'>('paint');
  const [spaceOrbiting, setSpaceOrbiting] = useState<boolean>(false);
  const [paintBrush, setPaintBrush] = useState<VertexPaintBrushSettings>({
    radius: 0.32,
    opacity: 0.72,
    softness: 0.6,
    mode: 'paint',
    target: 'all',
    color: '#2F9E44',
    hueShift: 18,
    saturationShift: 0.14,
    valueShift: 0.04,
    hueJitter: 26,
    degradeForm: 'moss',
    degradeChipDepth: 0.35,
  });

  // Cluster draft state used when spawning a brand-new rosette/flower/fan cluster
  const [draftCluster, setDraftCluster] = useState<PlantClusterRecipe>(() =>
    createDefaultClusterRecipe()
  );

  // Curve Guide state (trailing stems, vines & leaf arrays along curve)
  const [curveEnabled, setCurveEnabled] = useState<boolean>(false);
  const [curveCfg, setCurveCfg] = useState<CurveGuideConfig>(() =>
    createDefaultCurveGuide('arc')
  );
  const [activeCurvePtIdx, setActiveCurvePtIdx] = useState<number | null>(null);
  const [curveBend, setCurveBend] = useState<number>(1.0);
  const [curveSweepWidth, setCurveSweepWidth] = useState<number>(0.08);
  const [curveArrayCount, setCurveArrayCount] = useState<number>(7);

  const [marqueeRect, setMarqueeRect] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  const flashToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 2400);
  }, []);

  const currentLevel = store.currentLevel;
  const grassCfg = useMemo(
    () => resolveGrassConfig(currentLevel?.grass ?? localGrassFallback),
    [currentLevel?.grass, localGrassFallback]
  );

  const patchGrassConfig = useCallback(
    (patch: Partial<GrassFieldConfig>, recordUndo = false) => {
      if (store.currentLevel) {
        store.updateLevel(
          'adjust grass in Plant Maker',
          (lvl) => ({
            ...lvl,
            grass: {
              ...resolveGrassConfig(lvl.grass),
              ...patch,
            },
          }),
          recordUndo
        );
      } else {
        setLocalGrassFallback((prev) => ({
          ...resolveGrassConfig(prev),
          ...patch,
        }));
      }
    },
    [store]
  );

  // Derived selections
  const selectedGroup = useMemo(
    () => doc.groups.find((g) => g.id === selectedGroupId) ?? null,
    [doc.groups, selectedGroupId]
  );

  const activeClusterGroup = useMemo(() => {
    if (selectedGroup?.plantCluster) return selectedGroup;
    if (selectedPartIds.length === 1) {
      const part = doc.parts.find((p) => p.id === selectedPartIds[0]);
      if (part?.parentGroupId) {
        const parent = doc.groups.find((g) => g.id === part.parentGroupId);
        if (parent?.plantCluster) return parent;
      }
    }
    return null;
  }, [doc.groups, doc.parts, selectedGroup, selectedPartIds]);

  const selectedParts = useMemo(() => {
    if (selectedPartIds.length > 0) {
      return doc.parts.filter((p) => selectedPartIds.includes(p.id));
    }
    if (selectedGroupId) {
      return doc.parts.filter((p) => p.parentGroupId === selectedGroupId);
    }
    return [];
  }, [doc.parts, selectedPartIds, selectedGroupId]);

  const primaryPart = selectedParts[0] ?? null;

  const pushHistory = useCallback((snapshot: ObjectMakerDoc) => {
    setUndoStack((prev) => [
      ...prev.slice(-24),
      JSON.parse(JSON.stringify(snapshot)) as ObjectMakerDoc,
    ]);
    setRedoStack([]);
  }, []);

  const commitDoc = useCallback(
    (updater: (prev: ObjectMakerDoc) => ObjectMakerDoc, recordHistory = true) => {
      setDoc((prev) => {
        if (recordHistory) {
          setUndoStack((h) => [
            ...h.slice(-24),
            JSON.parse(JSON.stringify(prev)) as ObjectMakerDoc,
          ]);
          setRedoStack([]);
        }
        return updater(prev);
      });
    },
    []
  );

  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setRedoStack((r) => [
        JSON.parse(JSON.stringify(doc)) as ObjectMakerDoc,
        ...r.slice(0, 24),
      ]);
      setDoc(last);
      return prev.slice(0, -1);
    });
  }, [doc]);

  const handleRedo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const next = prev[0];
      setUndoStack((u) => [
        ...u,
        JSON.parse(JSON.stringify(doc)) as ObjectMakerDoc,
      ]);
      setDoc(next);
      return prev.slice(1);
    });
  }, [doc]);

  // Load existing plant / object recipe
  const loadExistingAsset = useCallback(
    (asset: CustomAssetMeta) => {
      setEditingAssetId(asset.id);
      setPlantName(asset.name);
      setAssetCategory(asset.category === 'scenery' ? 'scenery' : 'plant');
      setUndoStack([]);
      setRedoStack([]);
      setPlaceOnSave(false);
      setShowLoadMenu(false);

      if (asset.plantSubKind === 'flower' && asset.flowerRecipe) {
        setFlowerRecipe(JSON.parse(JSON.stringify(asset.flowerRecipe)) as FlowerMakerRecipe);
        setStudioSection('flower');
      } else {
        setStudioSection('plant');
      }

      if (asset.objectRecipe && asset.objectRecipe.parts.length > 0) {
        const cloned = JSON.parse(JSON.stringify(asset.objectRecipe)) as ObjectMakerDoc;
        const loadedStrokes = asset.vertexPaintStrokes ?? cloned.vertexPaintStrokes ?? [];
        setDoc(cloned);
        setPaintStrokes(JSON.parse(JSON.stringify(loadedStrokes)) as VertexPaintStroke[]);
        setPaintRedoStack([]);
        const firstCluster = cloned.groups.find((g) => Boolean(g.plantCluster));
        if (firstCluster) {
          setSelectedGroupId(firstCluster.id);
          setSelectedPartIds([]);
        } else {
          setSelectedGroupId(null);
          setSelectedPartIds(cloned.parts[0] ? [cloned.parts[0].id] : []);
        }
        flashToast(`Loaded "${asset.name}" for editing`);
      } else {
        flashToast(`"${asset.name}" is an external GLB — edit in Object Maker`);
      }
    },
    [flashToast]
  );

  const updateFlowerRecipe = useCallback(
    (updater: (prev: FlowerMakerRecipe) => FlowerMakerRecipe) => {
      setFlowerRecipe((prev) => {
        const next = updater(prev);
        const built = buildFlowerDocFromRecipe(next);
        setDoc(built);
        setSelectedGroupId(built.groups[0]?.id ?? null);
        setSelectedPartIds([]);
        return next;
      });
    },
    []
  );

  const loadStarterFlower = useCallback(
    (preset: FlowerMakerRecipe) => {
      const cloned: FlowerMakerRecipe = { ...preset, seed: preset.seed };
      setEditingAssetId(null);
      setFlowerRecipe(cloned);
      setPlantName(cloned.name);
      setAssetCategory('plant');
      const built = buildFlowerDocFromRecipe(cloned);
      setDoc(built);
      setPaintStrokes([]);
      setPaintRedoStack([]);
      setSelectedGroupId(built.groups[0]?.id ?? null);
      setSelectedPartIds([]);
      flashToast(`Loaded "${cloned.name}"`);
    },
    [flashToast]
  );

  useEffect(() => {
    if (!initialAssetId) return;
    const found = store.customAssets.find((a) => a.id === initialAssetId);
    if (found) {
      loadExistingAsset(found);
    }
  }, [initialAssetId]);

  // Filtered organic shapes catalog
  const filteredCatalog = useMemo(() => {
    if (shapeFilter === 'all') return PLANT_SHAPE_CATALOG;
    return PLANT_SHAPE_CATALOG.filter((s) => s.category === shapeFilter);
  }, [shapeFilter]);

  // Add single organic leaf / petal / stem / fantasy shape
  const addOrganicPart = (shape: PlantShapeId) => {
    const meta = getPlantShapeMeta(shape);
    const isCenteredBase =
      shape === 'stemCurved' || shape === 'bulbCorm' || shape === 'vineTendril' || shape === 'flowerCenter';
    const part = createDefaultPlantPartSpec(shape, {
      name: `${meta.defaultName}_${doc.parts.length + 1}`,
      position: isCenteredBase
        ? [0, 0, 0]
        : [
            Number(((Math.random() - 0.5) * 0.28).toFixed(2)),
            0.14,
            Number(((Math.random() - 0.5) * 0.28).toFixed(2)),
          ],
    });
    commitDoc((prev) =>
      ensureUniquePlantNodeNames({
        ...prev,
        parts: [...prev.parts, part],
      })
    );
    setSelectedPartIds([part.id]);
    setSelectedGroupId(null);
    setActiveCurvePtIdx(null);
    setInspectorTab('shape');
  };

  // Mutate selected part(s) (or entire selected group children)
  const updateTargetParts = useCallback(
    (updater: (p: ObjectPartSpec) => ObjectPartSpec, recordHistory = false) => {
      const targetIds = new Set(selectedParts.map((p) => p.id));
      if (targetIds.size === 0) return;
      commitDoc(
        (prev) => ({
          ...prev,
          parts: prev.parts.map((p) => (targetIds.has(p.id) ? updater(p) : p)),
        }),
        recordHistory
      );
    },
    [commitDoc, selectedParts]
  );

  // Live update an existing Cluster Group's PlantClusterRecipe & regenerate its 1..20 fanned parts
  const updateClusterRecipe = useCallback(
    (
      updater: (prev: PlantClusterRecipe) => PlantClusterRecipe,
      recordHistory = false
    ) => {
      if (!activeClusterGroup?.plantCluster) {
        setDraftCluster((prev) => updater(prev));
        return;
      }
      const targetGroupId = activeClusterGroup.id;
      commitDoc((prev) => {
        const grp = prev.groups.find((g) => g.id === targetGroupId);
        if (!grp?.plantCluster) return prev;
        const nextRecipe = updater(grp.plantCluster);
        const clampedRecipe: PlantClusterRecipe = {
          ...nextRecipe,
          count: Math.max(1, Math.min(20, Math.round(nextRecipe.count))),
        };
        const nextParts = buildPlantClusterParts(clampedRecipe, targetGroupId);
        const preservedParts = prev.parts.filter((p) => p.parentGroupId !== targetGroupId);
        return ensureUniquePlantNodeNames({
          ...prev,
          groups: prev.groups.map((g) =>
            g.id === targetGroupId
              ? {
                  ...g,
                  position: [g.position[0], clampedRecipe.hubHeight, g.position[2]],
                  plantCluster: clampedRecipe,
                }
              : g
          ),
          parts: [...preservedParts, ...nextParts],
        });
      }, recordHistory);
    },
    [activeClusterGroup, commitDoc]
  );

  // Spawn a brand-new Cluster Group (Fan / Random Center / Spiral, 1-20 parts)
  const handleSpawnNewCluster = (presetOverride?: Partial<PlantClusterRecipe>) => {
    const base = activeClusterGroup?.plantCluster ?? draftCluster;
    const nextRecipe: PlantClusterRecipe = {
      ...base,
      ...presetOverride,
      seed: Math.floor(Math.random() * 90000 + 100),
      baseDimensions: presetOverride?.baseDimensions ?? ([...base.baseDimensions] as [number, number, number]),
      basePlant: { ...base.basePlant, ...(presetOverride?.basePlant ?? {}) },
    };
    const meta = getPlantShapeMeta(nextRecipe.shape);
    const { group, parts } = createClusterGroupAndParts(
      nextRecipe,
      `${meta.defaultName}_Fan_${doc.groups.length + 1}`
    );
    commitDoc((prev) =>
      ensureUniquePlantNodeNames({
        ...prev,
        groups: [...prev.groups, group],
        parts: [...prev.parts, ...parts],
      })
    );
    setSelectedGroupId(group.id);
    setSelectedPartIds([]);
    setActiveCurvePtIdx(null);
    setInspectorTab('cluster');
    flashToast(`Spawned ${nextRecipe.count} ${meta.label}s`);
  };

  // Update Pattern & Color on either selected parts or active Cluster Group (keeps cluster recipe in sync!)
  const applyPatternAndColors = (patch: {
    baseColor?: string;
    pattern?: PlantLeafPatternId;
    accentColor?: string;
    tipColor?: string;
    emissiveColor?: string;
    emissiveIntensity?: number;
    roughness?: number;
    weathering?: WeatheringPreset;
    weatheringIntensity?: number;
  }) => {
    if (activeClusterGroup?.plantCluster && selectedGroupId === activeClusterGroup.id) {
      updateClusterRecipe((prev) => ({
        ...prev,
        ...(patch.baseColor ? { baseColor: patch.baseColor } : {}),
        basePlant: {
          ...prev.basePlant,
          ...(patch.pattern !== undefined ? { pattern: patch.pattern } : {}),
          ...(patch.accentColor !== undefined ? { accentColor: patch.accentColor } : {}),
          ...(patch.tipColor !== undefined ? { tipColor: patch.tipColor } : {}),
          ...(patch.emissiveColor !== undefined ? { emissiveColor: patch.emissiveColor } : {}),
          ...(patch.emissiveIntensity !== undefined
            ? { emissiveIntensity: patch.emissiveIntensity }
            : {}),
        },
      }));
      // Also apply material roughness/weathering immediately to existing cluster children
      if (
        patch.roughness !== undefined ||
        patch.weathering !== undefined ||
        patch.weatheringIntensity !== undefined
      ) {
        updateTargetParts((p) => ({
          ...p,
          material: {
            ...p.material,
            ...(patch.roughness !== undefined ? { roughness: patch.roughness } : {}),
            ...(patch.weathering !== undefined ? { weathering: patch.weathering } : {}),
            ...(patch.weatheringIntensity !== undefined
              ? { weatheringIntensity: patch.weatheringIntensity }
              : {}),
          },
        }));
      }
      return;
    }

    updateTargetParts((p) => ({
      ...p,
      material: {
        ...p.material,
        ...(patch.baseColor ? { color: patch.baseColor } : {}),
        ...(patch.roughness !== undefined ? { roughness: patch.roughness } : {}),
        ...(patch.weathering !== undefined ? { weathering: patch.weathering } : {}),
        ...(patch.weatheringIntensity !== undefined
          ? { weatheringIntensity: patch.weatheringIntensity }
          : {}),
      },
      plantParams: {
        ...p.plantParams,
        ...(patch.pattern !== undefined ? { pattern: patch.pattern } : {}),
        ...(patch.accentColor !== undefined ? { accentColor: patch.accentColor } : {}),
        ...(patch.tipColor !== undefined ? { tipColor: patch.tipColor } : {}),
        ...(patch.emissiveColor !== undefined ? { emissiveColor: patch.emissiveColor } : {}),
        ...(patch.emissiveIntensity !== undefined
          ? { emissiveIntensity: patch.emissiveIntensity }
          : {}),
      },
    }));
  };

  // Grouping / Ungrouping / Combine / Duplicate / Delete
  const handleGroupSelected = () => {
    if (selectedPartIds.length < 2) {
      flashToast('Select 2 or more parts to group');
      return;
    }
    const idSet = new Set(selectedPartIds);
    const chosen = doc.parts.filter((p) => idSet.has(p.id));
    const cx = chosen.reduce((s, p) => s + p.position[0], 0) / chosen.length;
    const cy = chosen.reduce((s, p) => s + p.position[1], 0) / chosen.length;
    const cz = chosen.reduce((s, p) => s + p.position[2], 0) / chosen.length;
    const grpId = uid();
    const grp: ObjectGroupSpec = {
      id: grpId,
      name: `PlantGroup_${doc.groups.length + 1}`,
      parentGroupId: null,
      position: [Number(cx.toFixed(3)), Number(cy.toFixed(3)), Number(cz.toFixed(3))],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    };
    commitDoc((prev) =>
      ensureUniquePlantNodeNames({
        ...prev,
        groups: [...prev.groups, grp],
        parts: prev.parts.map((p) =>
          idSet.has(p.id)
            ? {
                ...p,
                parentGroupId: grpId,
                position: [
                  Number((p.position[0] - grp.position[0]).toFixed(4)),
                  Number((p.position[1] - grp.position[1]).toFixed(4)),
                  Number((p.position[2] - grp.position[2]).toFixed(4)),
                ],
              }
            : p
        ),
      })
    );
    setSelectedGroupId(grpId);
    setSelectedPartIds([]);
    flashToast(`Grouped ${chosen.length} botanical parts`);
  };

  const handleUngroup = (groupId: string) => {
    const grp = doc.groups.find((g) => g.id === groupId);
    if (!grp) return;
    const gMat = new THREE.Matrix4().compose(
      new THREE.Vector3(...grp.position),
      new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
          THREE.MathUtils.degToRad(grp.rotation[0]),
          THREE.MathUtils.degToRad(grp.rotation[1]),
          THREE.MathUtils.degToRad(grp.rotation[2])
        )
      ),
      new THREE.Vector3(...grp.scale)
    );
    const releasedIds: string[] = [];
    commitDoc((prev) => ({
      ...prev,
      groups: prev.groups.filter((g) => g.id !== groupId),
      parts: prev.parts.map((p) => {
        if (p.parentGroupId !== groupId) return p;
        releasedIds.push(p.id);
        const worldPos = new THREE.Vector3(...p.position).applyMatrix4(gMat);
        return {
          ...p,
          parentGroupId: grp.parentGroupId,
          position: [
            Number(worldPos.x.toFixed(4)),
            Number(worldPos.y.toFixed(4)),
            Number(worldPos.z.toFixed(4)),
          ],
        };
      }),
    }));
    setSelectedGroupId(null);
    setSelectedPartIds(releasedIds);
    flashToast('Released leaves/petals as individual parts');
  };

  const handleCombineSelected = () => {
    if (selectedParts.length < 2) {
      flashToast('Select at least 2 parts to combine');
      return;
    }
    const base = selectedParts[0];
    const idSet = new Set(selectedParts.map((p) => p.id));
    const entries = selectedParts.map((p) => ({
      geometry: buildPartGeometry(p),
      matrix: computePartWorldMatrix(doc, p),
    }));
    const res = combineGeometriesWorldSpace(entries);
    entries.forEach((e) => e.geometry.dispose());
    if (!res) {
      flashToast('Combine produced empty geometry');
      return;
    }
    res.geometry.computeBoundingBox();
    const size = new THREE.Vector3();
    res.geometry.boundingBox?.getSize(size);
    const baked = serializeBufferGeometry(res.geometry);
    res.geometry.dispose();

    const combinedPart: ObjectPartSpec = {
      ...JSON.parse(JSON.stringify(base)),
      id: uid(),
      name: `${base.name}_Merged`,
      parentGroupId: null,
      shape: 'csgResult',
      position: [
        Number(res.center.x.toFixed(4)),
        Number(res.center.y.toFixed(4)),
        Number(res.center.z.toFixed(4)),
      ],
      rotation: [0, 0, 0],
      dimensions: [
        Number(Math.max(0.08, size.x).toFixed(3)),
        Number(Math.max(0.08, size.y).toFixed(3)),
        Number(Math.max(0.08, size.z).toFixed(3)),
      ],
      bakedGeometry: baked,
    };
    commitDoc((prev) =>
      ensureUniquePlantNodeNames({
        ...prev,
        parts: [...prev.parts.filter((p) => !idSet.has(p.id)), combinedPart],
      })
    );
    setSelectedGroupId(null);
    setSelectedPartIds([combinedPart.id]);
    flashToast(`Merged ${selectedParts.length} botanical parts`);
  };

  const handleDuplicateSelected = () => {
    if (selectedPartIds.length === 0) return;
    const src = doc.parts.filter((p) => selectedPartIds.includes(p.id));
    const clones = src.map((p) => ({
      ...(JSON.parse(JSON.stringify(p)) as ObjectPartSpec),
      id: uid(),
      parentGroupId: null,
      name: `${p.name}_Copy`,
      position: [
        Number((p.position[0] + 0.25).toFixed(3)),
        p.position[1],
        Number((p.position[2] + 0.25).toFixed(3)),
      ] as [number, number, number],
    }));
    commitDoc((prev) =>
      ensureUniquePlantNodeNames({
        ...prev,
        parts: [...prev.parts, ...clones],
      })
    );
    setSelectedGroupId(null);
    setSelectedPartIds(clones.map((c) => c.id));
  };

  const handleDeleteSelected = useCallback(() => {
    if (selectedGroupId) {
      const gid = selectedGroupId;
      commitDoc((prev) => ({
        ...prev,
        groups: prev.groups.filter((g) => g.id !== gid),
        parts: prev.parts.filter((p) => p.parentGroupId !== gid),
      }));
      setSelectedGroupId(null);
      return;
    }
    if (selectedPartIds.length === 0) return;
    const idSet = new Set(selectedPartIds);
    commitDoc((prev) => ({
      ...prev,
      parts: prev.parts.filter((p) => !idSet.has(p.id)),
    }));
    setSelectedPartIds([]);
  }, [commitDoc, selectedGroupId, selectedPartIds]);

  const handleDropSelectedToFloor = () => {
    if (selectedParts.length === 0) return;
    const idSet = new Set(selectedParts.map((p) => p.id));
    commitDoc((prev) => ({
      ...prev,
      parts: prev.parts.map((p) => {
        if (!idSet.has(p.id)) return p;
        const geo = buildPartGeometry(p);
        geo.computeBoundingBox();
        const minY = geo.boundingBox ? geo.boundingBox.min.y : 0;
        geo.dispose();
        return {
          ...p,
          position: [p.position[0], Number((p.position[1] - minY).toFixed(4)), p.position[2]],
        };
      }),
    }));
  };

  // Curve Guide handlers for winding vines & trailing leaf arrays
  const handleSelectCurvePreset = (preset: CurveGuidePresetId) => {
    const pts = createCurvePresetPoints(preset, { span: 2.6, bend: curveBend, height: 1.3 });
    setCurveCfg((prev) => ({
      ...prev,
      preset,
      points: pts,
      closed: preset === 'circle',
      elevationArch: preset === 'arch' ? 1.3 : 0.35,
    }));
    setActiveCurvePtIdx(0);
    setCurveEnabled(true);
  };

  const handleSweepVineAlongCurve = (profile: 'tube' | 'ribbon') => {
    const geo = buildCurveSweepGeometry(curveCfg, profile, curveSweepWidth, 16);
    geo.computeBoundingBox();
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    geo.boundingBox?.getCenter(center);
    geo.boundingBox?.getSize(size);
    geo.translate(-center.x, -center.y, -center.z);
    const baked = serializeBufferGeometry(geo);
    geo.dispose();

    const sweptPart = createDefaultPlantPartSpec('stemCurved', {
      name: `Vine_${profile === 'tube' ? 'Stem' : 'Ribbon'}_${doc.parts.length + 1}`,
      shape: 'csgResult',
      position: [
        Number(center.x.toFixed(4)),
        Number(center.y.toFixed(4)),
        Number(center.z.toFixed(4)),
      ],
      dimensions: [
        Number(Math.max(0.08, size.x).toFixed(3)),
        Number(Math.max(0.08, size.y).toFixed(3)),
        Number(Math.max(0.08, size.z).toFixed(3)),
      ],
      material: primaryPart?.material
        ? { ...primaryPart.material }
        : { color: '#3B7A3E', roughness: 0.5, metalness: 0.02 },
      plantParams: {
        pattern: 'veins',
        accentColor: '#86EFAC',
        tipColor: '#BEF264',
        doubleSided: true,
      },
      bakedGeometry: baked,
    });

    commitDoc((prev) =>
      ensureUniquePlantNodeNames({
        ...prev,
        parts: [...prev.parts, sweptPart],
      })
    );
    setSelectedGroupId(null);
    setSelectedPartIds([sweptPart.id]);
    setActiveCurvePtIdx(null);
    flashToast(`Created ${profile === 'tube' ? 'vine stem' : 'ribbon frond'} along curve`);
  };

  const handleArrayLeavesAlongCurve = () => {
    const source =
      primaryPart && isPlantShape(primaryPart.shape)
        ? primaryPart
        : createDefaultPlantPartSpec('leafHeartVine');
    const samples = sampleCurveTransforms(curveCfg, curveArrayCount, false);
    const clones: ObjectPartSpec[] = samples.map((s, idx) => {
      const sideSign = idx % 2 === 0 ? 1 : -1;
      return {
        ...(JSON.parse(JSON.stringify(source)) as ObjectPartSpec),
        id: uid(),
        parentGroupId: null,
        name: `${source.name}_Vine${idx + 1}`,
        position: [
          Number(s.position.x.toFixed(4)),
          Number(s.position.y.toFixed(4)),
          Number(s.position.z.toFixed(4)),
        ],
        rotation: [
          Number((-24 + (idx % 3) * 8).toFixed(1)),
          Number((s.yawDeg + sideSign * 62).toFixed(1)),
          Number((sideSign * 14).toFixed(1)),
        ],
      };
    });
    commitDoc((prev) =>
      ensureUniquePlantNodeNames({
        ...prev,
        parts: [...prev.parts, ...clones],
      })
    );
    setSelectedGroupId(null);
    setSelectedPartIds(clones.map((c) => c.id));
    setActiveCurvePtIdx(null);
    flashToast(`Sprouted ${clones.length} leaves along vine curve`);
  };

  // Save built GLB + recipe + vertex paint to Asset Vault (`category: 'plant'`)
  const handleSaveAsset = async (opts?: { asCopy?: boolean; placeNow?: boolean }) => {
    if (doc.parts.length === 0) {
      flashToast('Add at least one leaf, petal, stem, or cluster before saving');
      return;
    }
    const cleanName = plantName.trim() || 'Custom Plant';
    setSaving(true);
    try {
      const uniqueDoc = ensureUniquePlantNodeNames(doc);
      const { doc: groundedDoc, shift } = centerAndGroundObjectDoc(uniqueDoc);
      const shiftedStrokes =
        paintStrokes.length > 0 ? shiftVertexPaintStrokes(paintStrokes, shift) : [];
      const docWithPaint: ObjectMakerDoc = {
        ...groundedDoc,
        vertexPaintStrokes: shiftedStrokes.length > 0 ? shiftedStrokes : undefined,
      };
      const { buffer } = await buildAndExportObjectDocToGlb(docWithPaint);
      const targetId = opts?.asCopy ? undefined : editingAssetId ?? undefined;
      const isFlowerMode = studioSection === 'flower';
      const meta = await store.saveGeneratedAsset({
        existingAssetId: targetId,
        name: cleanName,
        category: isFlowerMode ? 'plant' : assetCategory,
        buffer,
        objectRecipe: docWithPaint,
        vertexPaintStrokes: shiftedStrokes.length > 0 ? shiftedStrokes : undefined,
        keepMetricScale: true,
        plantSubKind: isFlowerMode ? 'flower' : 'plant',
        flowerRecipe: isFlowerMode ? { ...flowerRecipe, name: cleanName } : undefined,
      });
      setDoc(docWithPaint);
      setPaintStrokes(shiftedStrokes);
      setEditingAssetId(meta.id);
      flashToast(
        targetId
          ? `Saved "${meta.name}"`
          : isFlowerMode
          ? `Saved "${meta.name}" to Flowers`
          : `Added "${meta.name}" to Plants`
      );

      if (opts?.placeNow) {
        const hero = store.currentLevel?.entities.find((e) => e.kind === 'hero');
        const bx = hero ? Math.min(0.86, hero.position.x + 0.08) : 0.5;
        const by = hero ? Math.min(0.86, hero.position.y + 0.06) : 0.5;
        const placed = store.addEntity('scenery', meta.name, { x: bx, y: by }, meta.id);
        if (placed && meta.vertexPaintStrokes?.length) {
          store.updateEntity(
            placed.id,
            `attach vertex paint to ${meta.name}`,
            (ent) => ({
              ...ent,
              vertexPaintStrokes: JSON.parse(
                JSON.stringify(meta.vertexPaintStrokes)
              ) as VertexPaintStroke[],
            }),
            false
          );
        }
        flashToast(`Saved & placed "${meta.name}" in level`);
      }
    } catch (err) {
      flashToast(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  useRegisterStudioAiBridge({
    id: 'modal-plant',
    context: 'plant',
    title: `Plant Maker · ${plantName}`,
    subtitle: 'AI sculpts leaf clusters, petals & glow flora',
    saveLabel: 'Save to Plants',
    getSnapshot: () => ({
      name: plantName,
      partsCount: doc.parts.length,
      groupsCount: doc.groups.length,
      cluster: doc.groups[0]?.plantCluster ?? null,
    }),
    applyResult: (raw, options) => {
      const res = sanitizePlantMakerResult(raw, {
        doc,
        name: plantName,
        modifyExisting: Boolean(options?.modifyExisting),
      });
      setUndoStack((u) => [...u.slice(-24), doc]);
      setStudioSection('plant');
      if (!options?.modifyExisting) {
        setEditingAssetId(null);
      }
      setPlantName(res.name);
      setDoc(res.doc);
      setSelectedPartIds([res.doc.parts[0]?.id].filter(Boolean));
      flashToast(res.summary);
      return res.summary;
    },
    saveAsset: async (suggestedName) => {
      if (suggestedName) setPlantName(suggestedName);
      await handleSaveAsset({ placeNow: false });
      return `Saved "${suggestedName || plantName}" to Plants`;
    },
  });

  // ---------------------------------------------------------------------------
  // 3D BOTANICAL VIEWPORT (Fat Gizmos + Marquee + Curve Handles + WebGPU/WebGL)
  // ---------------------------------------------------------------------------
  const viewportMountRef = useRef<HTMLDivElement | null>(null);
  const studioRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: WebGPURenderer;
    controls: OrbitControls;
    transformControls: TransformControls;
    objectRootHolder: THREE.Group;
    curveGroup: THREE.Group;
    selectionBoxGroup: THREE.Group;
    soilRing: THREE.Mesh;
    grid: THREE.GridHelper;
    hemi: THREE.HemisphereLight;
    keyLight: THREE.DirectionalLight;
    grassPreview: GrassSamplePreview;
    partMeshes: Map<string, THREE.Mesh>;
    groupNodes: Map<string, THREE.Group>;
    curveHandleMeshes: THREE.Mesh[];
    multiProxy: THREE.Group;
    isDraggingGizmo: boolean;
    paintSession: MakerVertexPaintSession;
    paintableMeshes: THREE.Mesh[];
  } | null>(null);

  const latestRef = useRef({
    studioSection,
    grassPreviewWind,
    doc,
    toolMode,
    gridSnapStep,
    selectedPartIds,
    selectedGroupId,
    curveEnabled,
    curveCfg,
    activeCurvePtIdx,
    inspectorTab,
    paintTool,
    spaceOrbiting,
    paintBrush,
  });
  latestRef.current = {
    studioSection,
    grassPreviewWind,
    doc,
    toolMode,
    gridSnapStep,
    selectedPartIds,
    selectedGroupId,
    curveEnabled,
    curveCfg,
    activeCurvePtIdx,
    inspectorTab,
    paintTool,
    spaceOrbiting,
    paintBrush,
  };

  useEffect(() => {
    const container = viewportMountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();
    const width = container.clientWidth || 900;
    const height = container.clientHeight || 620;

    let renderer = createMakerRenderer(isSoftwareGl);
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSoftwareGl ? 1 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#101915');
    let envTex: THREE.Texture | null = null;

    const camera = new THREE.PerspectiveCamera(42, width / Math.max(1, height), 0.05, 160);
    camera.position.set(2.85, 2.05, 3.25);

    const hemi = new THREE.HemisphereLight('#E7F9EE', '#1F2F28', 0.92);
    const keyLight = new THREE.DirectionalLight('#FFF7E2', 1.82);
    keyLight.position.set(5, 8.5, 6);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 26;
    const fillLight = new THREE.DirectionalLight('#86EFAC', 0.55);
    fillLight.position.set(-4.5, 3.5, -4);
    scene.add(hemi, keyLight, fillLight);

    // Botanical garden soil plinth & grid
    const floorMat = new THREE.MeshStandardMaterial({
      color: '#17231D',
      roughness: 0.9,
      metalness: 0.04,
    });
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.55, 0.08, 56), floorMat);
    floor.position.y = -0.04;
    floor.receiveShadow = true;
    scene.add(floor);

    const soilMat = new THREE.MeshStandardMaterial({
      color: '#2A221C',
      roughness: 0.95,
      metalness: 0.02,
    });
    const soilRing = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.03, 36), soilMat);
    soilRing.position.y = 0.005;
    soilRing.receiveShadow = true;
    scene.add(soilRing);

    const grid = new THREE.GridHelper(8.0, 16, '#2E4C3E', '#1F332A');
    grid.position.y = 0.002;
    scene.add(grid);

    const objectRootHolder = new THREE.Group();
    const curveGroup = new THREE.Group();
    const selectionBoxGroup = new THREE.Group();
    const multiProxy = new THREE.Group();
    const grassPreview = new GrassSamplePreview();
    grassPreview.group.visible = latestRef.current.studioSection === 'grass';
    scene.add(objectRootHolder, curveGroup, selectionBoxGroup, multiProxy, grassPreview.group);

    const isCoarsePointer =
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(pointer: coarse)').matches || (navigator.maxTouchPoints ?? 0) > 0);
    const transformControls = new TransformControls(camera, renderer.domElement);
    enhanceTransformControlsGizmo(transformControls);
    transformControls.setSize(isCoarsePointer ? 1.38 : 1.18);
    const gizmoHelper = transformControls.getHelper();
    gizmoHelper.renderOrder = 999;
    scene.add(gizmoHelper);

    const createControls = (domEl: HTMLElement) => {
      const c = new OrbitControls(camera, domEl);
      c.target.set(0, 0.55, 0);
      c.enableDamping = !isSoftwareGl;
      c.dampingFactor = 0.08;
      c.minDistance = 0.7;
      c.maxDistance = 22;
      c.maxPolarAngle = Math.PI * 0.495;
      c.update();
      return c;
    };
    let controls = createControls(renderer.domElement);
    const paintSession = new MakerVertexPaintSession(scene);

    const studioState = {
      scene,
      camera,
      renderer,
      controls,
      transformControls,
      objectRootHolder,
      curveGroup,
      selectionBoxGroup,
      soilRing,
      grid,
      hemi,
      keyLight,
      grassPreview,
      partMeshes: new Map<string, THREE.Mesh>(),
      groupNodes: new Map<string, THREE.Group>(),
      curveHandleMeshes: [] as THREE.Mesh[],
      multiProxy,
      isDraggingGizmo: false,
      paintSession,
      paintableMeshes: [] as THREE.Mesh[],
    };
    studioRef.current = studioState;

    let dragPreSnapshot: ObjectMakerDoc | null = null;
    let multiStartSnapshot: {
      center: THREE.Vector3;
      parts: { id: string; pos: THREE.Vector3; quat: THREE.Quaternion }[];
    } | null = null;

    const refreshLiveSelectionBoxes = () => {
      disposeObject3D(studioState.selectionBoxGroup);
      studioState.selectionBoxGroup.clear();
      const cur = latestRef.current;
      const box = new THREE.Box3();
      for (const pid of cur.selectedPartIds) {
        const mesh = studioState.partMeshes.get(pid);
        if (!mesh) continue;
        mesh.updateMatrixWorld(true);
        box.setFromObject(mesh);
        if (!box.isEmpty()) {
          studioState.selectionBoxGroup.add(new THREE.Box3Helper(box.clone(), new THREE.Color('#34D399')));
        }
      }
      if (cur.selectedGroupId) {
        const grp = studioState.groupNodes.get(cur.selectedGroupId);
        if (grp) {
          grp.updateMatrixWorld(true);
          box.setFromObject(grp);
          if (!box.isEmpty()) {
            studioState.selectionBoxGroup.add(new THREE.Box3Helper(box.clone(), new THREE.Color('#A855F7')));
          }
        }
      }
    };

    const onDraggingChanged = (event: { value?: unknown }) => {
      const dragging = Boolean(event.value);
      studioState.isDraggingGizmo = dragging;
      studioState.controls.enabled = !dragging && latestRef.current.toolMode !== 'select';
      const cur = latestRef.current;
      const attached = transformControls.object;

      if (dragging) {
        dragPreSnapshot = JSON.parse(JSON.stringify(cur.doc)) as ObjectMakerDoc;
        if (
          cur.activeCurvePtIdx === null &&
          cur.selectedPartIds.length > 1 &&
          attached === multiProxy
        ) {
          multiProxy.rotation.set(0, 0, 0);
          multiProxy.scale.set(1, 1, 1);
          const pts = cur.doc.parts.filter((p) => cur.selectedPartIds.includes(p.id));
          multiStartSnapshot = {
            center: multiProxy.position.clone(),
            parts: pts.map((p) => {
              const mesh = studioState.partMeshes.get(p.id);
              return {
                id: p.id,
                pos: mesh ? mesh.position.clone() : new THREE.Vector3(...p.position),
                quat: mesh
                  ? mesh.quaternion.clone()
                  : new THREE.Quaternion().setFromEuler(
                      new THREE.Euler(
                        THREE.MathUtils.degToRad(p.rotation[0]),
                        THREE.MathUtils.degToRad(p.rotation[1]),
                        THREE.MathUtils.degToRad(p.rotation[2])
                      )
                    ),
              };
            }),
          };
        } else {
          multiStartSnapshot = null;
        }
        return;
      }

      setGizmoHudText(null);
      if (!attached || !dragPreSnapshot) {
        dragPreSnapshot = null;
        multiStartSnapshot = null;
        return;
      }

      const preSnap = dragPreSnapshot;
      dragPreSnapshot = null;

      if (typeof attached.userData.curvePtIdx === 'number') {
        multiStartSnapshot = null;
        return;
      }

      if (attached.userData.groupId) {
        const gid = attached.userData.groupId as string;
        const pos = attached.position.clone();
        const rot = attached.rotation.clone();
        const scl = attached.scale.clone();
        pushHistory(preSnap);
        setDoc((prev) => ({
          ...prev,
          groups: prev.groups.map((g) =>
            g.id === gid
              ? {
                  ...g,
                  position: [
                    Number(pos.x.toFixed(3)),
                    Number(pos.y.toFixed(3)),
                    Number(pos.z.toFixed(3)),
                  ],
                  rotation: [
                    Number(THREE.MathUtils.radToDeg(rot.x).toFixed(1)),
                    Number(THREE.MathUtils.radToDeg(rot.y).toFixed(1)),
                    Number(THREE.MathUtils.radToDeg(rot.z).toFixed(1)),
                  ],
                  scale: [
                    Number(Math.max(0.1, scl.x).toFixed(3)),
                    Number(Math.max(0.1, scl.y).toFixed(3)),
                    Number(Math.max(0.1, scl.z).toFixed(3)),
                  ],
                  plantCluster: g.plantCluster
                    ? { ...g.plantCluster, hubHeight: Number(pos.y.toFixed(3)) }
                    : undefined,
                }
              : g
          ),
        }));
        multiStartSnapshot = null;
        return;
      }

      if (attached === multiProxy && multiStartSnapshot) {
        const snap = multiStartSnapshot;
        multiStartSnapshot = null;
        const offsetMat = new THREE.Matrix4().compose(
          multiProxy.position,
          multiProxy.quaternion,
          multiProxy.scale
        );
        const centerInv = new THREE.Matrix4().makeTranslation(
          -snap.center.x,
          -snap.center.y,
          -snap.center.z
        );
        const deltaMat = new THREE.Matrix4().multiplyMatrices(offsetMat, centerInv);
        const scl = multiProxy.scale.clone();
        const proxyQuat = multiProxy.quaternion.clone();
        const snapMap = new Map(snap.parts.map((p) => [p.id, p]));
        const didScale =
          Math.abs(scl.x - 1) > 0.002 || Math.abs(scl.y - 1) > 0.002 || Math.abs(scl.z - 1) > 0.002;

        pushHistory(preSnap);
        setDoc((prev) => ({
          ...prev,
          parts: prev.parts.map((p) => {
            const st = snapMap.get(p.id);
            if (!st) return p;
            const worldPos = st.pos.clone().applyMatrix4(deltaMat);
            const nextQuat = proxyQuat.clone().multiply(st.quat);
            const nextEuler = new THREE.Euler().setFromQuaternion(nextQuat, 'XYZ');
            const nextDims: [number, number, number] = didScale
              ? [
                  Number(Math.max(0.05, p.dimensions[0] * Math.abs(scl.x)).toFixed(3)),
                  Number(Math.max(0.04, p.dimensions[1] * Math.abs(scl.y)).toFixed(3)),
                  Number(Math.max(0.05, p.dimensions[2] * Math.abs(scl.z)).toFixed(3)),
                ]
              : p.dimensions;
            const mesh = studioState.partMeshes.get(p.id);
            if (mesh) mesh.scale.set(1, 1, 1);
            return {
              ...p,
              position: [
                Number(worldPos.x.toFixed(3)),
                Number(worldPos.y.toFixed(3)),
                Number(worldPos.z.toFixed(3)),
              ],
              rotation: [
                Number(THREE.MathUtils.radToDeg(nextEuler.x).toFixed(1)),
                Number(THREE.MathUtils.radToDeg(nextEuler.y).toFixed(1)),
                Number(THREE.MathUtils.radToDeg(nextEuler.z).toFixed(1)),
              ],
              dimensions: nextDims,
            };
          }),
        }));
        multiProxy.rotation.set(0, 0, 0);
        multiProxy.scale.set(1, 1, 1);
        return;
      }

      if (attached.userData.partId) {
        const pid = attached.userData.partId as string;
        const pos = attached.position.clone();
        const rot = attached.rotation.clone();
        const scl = attached.scale.clone();
        const didScale =
          Math.abs(scl.x - 1) > 0.002 || Math.abs(scl.y - 1) > 0.002 || Math.abs(scl.z - 1) > 0.002;
        attached.scale.set(1, 1, 1);

        pushHistory(preSnap);
        setDoc((prev) => ({
          ...prev,
          parts: prev.parts.map((p) => {
            if (p.id !== pid) return p;
            const nextDims: [number, number, number] = didScale
              ? [
                  Number(Math.max(0.05, p.dimensions[0] * Math.abs(scl.x)).toFixed(3)),
                  Number(Math.max(0.04, p.dimensions[1] * Math.abs(scl.y)).toFixed(3)),
                  Number(Math.max(0.05, p.dimensions[2] * Math.abs(scl.z)).toFixed(3)),
                ]
              : p.dimensions;
            return {
              ...p,
              position: [
                Number(pos.x.toFixed(3)),
                Number(pos.y.toFixed(3)),
                Number(pos.z.toFixed(3)),
              ],
              rotation: [
                Number(THREE.MathUtils.radToDeg(rot.x).toFixed(1)),
                Number(THREE.MathUtils.radToDeg(rot.y).toFixed(1)),
                Number(THREE.MathUtils.radToDeg(rot.z).toFixed(1)),
              ],
              dimensions: nextDims,
            };
          }),
        }));
      }
      multiStartSnapshot = null;
    };

    const onGizmoObjectChange = () => {
      const attached = transformControls.object;
      if (!attached) return;
      const cur = latestRef.current;

      if (typeof attached.userData.curvePtIdx === 'number') {
        const ptIdx = attached.userData.curvePtIdx as number;
        const p = attached.position;
        setCurveCfg((prev) => ({
          ...prev,
          preset: 'free',
          points: prev.points.map((pt, i) =>
            i === ptIdx
              ? [Number(p.x.toFixed(3)), Number(p.y.toFixed(3)), Number(p.z.toFixed(3))]
              : pt
          ),
        }));
        setGizmoHudText(`Vine Pt ${ptIdx + 1}: ${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}m`);
        return;
      }

      if (attached === multiProxy && multiStartSnapshot) {
        const snap = multiStartSnapshot;
        const offsetMat = new THREE.Matrix4().compose(
          multiProxy.position,
          multiProxy.quaternion,
          multiProxy.scale
        );
        const centerInv = new THREE.Matrix4().makeTranslation(
          -snap.center.x,
          -snap.center.y,
          -snap.center.z
        );
        const deltaMat = new THREE.Matrix4().multiplyMatrices(offsetMat, centerInv);
        for (const st of snap.parts) {
          const mesh = studioState.partMeshes.get(st.id);
          if (!mesh) continue;
          mesh.position.copy(st.pos).applyMatrix4(deltaMat);
          mesh.quaternion.copy(multiProxy.quaternion).multiply(st.quat);
          mesh.scale.copy(multiProxy.scale);
        }
        refreshLiveSelectionBoxes();
        const mode = transformControls.getMode();
        if (mode === 'scale') {
          setGizmoHudText(
            `Scale: ${multiProxy.scale.x.toFixed(2)} × ${multiProxy.scale.y.toFixed(2)} × ${multiProxy.scale.z.toFixed(2)}`
          );
        } else if (mode === 'rotate') {
          setGizmoHudText(
            `Rotate: ${Math.round(THREE.MathUtils.radToDeg(multiProxy.rotation.x))}° · ${Math.round(THREE.MathUtils.radToDeg(multiProxy.rotation.y))}° · ${Math.round(THREE.MathUtils.radToDeg(multiProxy.rotation.z))}°`
          );
        } else {
          const d = multiProxy.position.clone().sub(snap.center);
          setGizmoHudText(`Move Δ: ${d.x.toFixed(2)}, ${d.y.toFixed(2)}, ${d.z.toFixed(2)}m`);
        }
        return;
      }

      if (attached.userData.partId || attached.userData.groupId) {
        refreshLiveSelectionBoxes();
        const mode = transformControls.getMode();
        if (mode === 'scale') {
          const partSpec = attached.userData.partId
            ? cur.doc.parts.find((p) => p.id === attached.userData.partId)
            : null;
          if (partSpec) {
            const w = Math.max(0.05, partSpec.dimensions[0] * Math.abs(attached.scale.x));
            const h = Math.max(0.04, partSpec.dimensions[1] * Math.abs(attached.scale.y));
            const d = Math.max(0.05, partSpec.dimensions[2] * Math.abs(attached.scale.z));
            setGizmoHudText(`Size: ${w.toFixed(2)} × ${h.toFixed(2)} × ${d.toFixed(2)}m`);
          } else {
            setGizmoHudText(
              `Scale: ${attached.scale.x.toFixed(2)} × ${attached.scale.y.toFixed(2)} × ${attached.scale.z.toFixed(2)}`
            );
          }
        } else if (mode === 'rotate') {
          setGizmoHudText(
            `Rotate: ${Math.round(THREE.MathUtils.radToDeg(attached.rotation.x))}° · ${Math.round(THREE.MathUtils.radToDeg(attached.rotation.y))}° · ${Math.round(THREE.MathUtils.radToDeg(attached.rotation.z))}°`
          );
        } else {
          setGizmoHudText(
            `Move: ${attached.position.x.toFixed(2)}, ${attached.position.y.toFixed(2)}, ${attached.position.z.toFixed(2)}m`
          );
        }
      }
    };

    transformControls.addEventListener('dragging-changed', onDraggingChanged);
    transformControls.addEventListener('objectChange', onGizmoObjectChange);

    // Pointer Selection + Marquee
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    let marqueeStart: { x: number; y: number } | null = null;
    let pointerDownClient: { x: number; y: number } | null = null;

    const getCanvasRect = () => renderer.domElement.getBoundingClientRect();

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || studioState.isDraggingGizmo) return;
      const cur = latestRef.current;
      if (cur.studioSection === 'grass') return;
      const isPaintingNow =
        cur.inspectorTab === 'paint' && cur.paintTool === 'paint' && !cur.spaceOrbiting;
      if (isPaintingNow) {
        const paintRoot = objectRootHolder.children[0];
        if (
          paintRoot &&
          studioState.paintSession.handlePointerDown({
            event: e,
            domEl: studioState.renderer.domElement,
            camera,
            paintRoot,
            paintableMeshes: studioState.paintableMeshes,
            brush: cur.paintBrush,
          })
        ) {
          return;
        }
      }

      const rect = getCanvasRect();
      pointerDownClient = { x: e.clientX, y: e.clientY };
      if (cur.toolMode === 'select' && cur.inspectorTab !== 'paint') {
        marqueeStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const cur = latestRef.current;
      const isPaintingNow =
        cur.inspectorTab === 'paint' && cur.paintTool === 'paint' && !cur.spaceOrbiting;
      if (isPaintingNow) {
        const paintRoot = objectRootHolder.children[0];
        if (paintRoot) {
          studioState.paintSession.handlePointerMove({
            event: e,
            domEl: studioState.renderer.domElement,
            camera,
            paintRoot,
            paintableMeshes: studioState.paintableMeshes,
            brush: cur.paintBrush,
          });
        }
        if (studioState.paintSession.brushing) return;
      }

      if (!marqueeStart) return;
      const rect = getCanvasRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const x = Math.min(marqueeStart.x, cx);
      const y = Math.min(marqueeStart.y, cy);
      const w = Math.abs(cx - marqueeStart.x);
      const h = Math.abs(cy - marqueeStart.y);
      if (w > 4 || h > 4) {
        setMarqueeRect({ x, y, w, h });
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (latestRef.current.studioSection === 'grass') {
        marqueeStart = null;
        pointerDownClient = null;
        setMarqueeRect(null);
        return;
      }
      if (studioState.paintSession.brushing) {
        const completed = studioState.paintSession.finishStroke(
          studioState.renderer.domElement,
          e.pointerId
        );
        if (completed) {
          setPaintStrokes((prev) => [...prev, completed]);
          setPaintRedoStack([]);
        }
        marqueeStart = null;
        pointerDownClient = null;
        setMarqueeRect(null);
        return;
      }

      if (e.button !== 0) {
        marqueeStart = null;
        pointerDownClient = null;
        setMarqueeRect(null);
        return;
      }

      const rect = getCanvasRect();
      const startM = marqueeStart;
      const startPt = pointerDownClient;
      marqueeStart = null;
      pointerDownClient = null;
      setMarqueeRect(null);

      if (startM && latestRef.current.toolMode === 'select') {
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const rx = Math.min(startM.x, cx);
        const ry = Math.min(startM.y, cy);
        const rw = Math.abs(cx - startM.x);
        const rh = Math.abs(cy - startM.y);

        if (rw > 7 && rh > 7) {
          const hitIds: string[] = [];
          const corner = new THREE.Vector3();
          const box = new THREE.Box3();
          objectRootHolder.updateMatrixWorld(true);

          for (const [partId, mesh] of studioState.partMeshes.entries()) {
            if (!mesh.visible) continue;
            box.setFromObject(mesh);
            if (box.isEmpty()) continue;
            let minSX = Infinity;
            let minSY = Infinity;
            let maxSX = -Infinity;
            let maxSY = -Infinity;
            let anyInFront = false;

            for (let ix = 0; ix < 2; ix++) {
              for (let iy = 0; iy < 2; iy++) {
                for (let iz = 0; iz < 2; iz++) {
                  corner.set(
                    ix ? box.max.x : box.min.x,
                    iy ? box.max.y : box.min.y,
                    iz ? box.max.z : box.min.z
                  );
                  corner.project(camera);
                  if (corner.z <= 1) anyInFront = true;
                  const sx = ((corner.x + 1) * 0.5) * rect.width;
                  const sy = ((-corner.y + 1) * 0.5) * rect.height;
                  minSX = Math.min(minSX, sx);
                  minSY = Math.min(minSY, sy);
                  maxSX = Math.max(maxSX, sx);
                  maxSY = Math.max(maxSY, sy);
                }
              }
            }

            if (anyInFront && maxSX >= rx && minSX <= rx + rw && maxSY >= ry && minSY <= ry + rh) {
              hitIds.push(partId);
            }
          }

          if (e.shiftKey) {
            setSelectedPartIds((prev) => Array.from(new Set([...prev, ...hitIds])));
          } else {
            setSelectedPartIds(hitIds);
            setSelectedGroupId(null);
          }
          return;
        }
      }

      if (!startPt || Math.hypot(e.clientX - startPt.x, e.clientY - startPt.y) > 6) {
        return;
      }
      if (studioState.isDraggingGizmo) return;

      pointerNdc.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(pointerNdc, camera);

      if (latestRef.current.curveEnabled && studioState.curveHandleMeshes.length > 0) {
        const handleHits = raycaster.intersectObjects(studioState.curveHandleMeshes, false);
        if (handleHits.length > 0) {
          const ptIdx = handleHits[0].object.userData.curvePtIdx;
          if (typeof ptIdx === 'number') {
            setActiveCurvePtIdx(ptIdx);
            setToolMode('translate');
            return;
          }
        }
      }

      const hits = raycaster.intersectObjects(objectRootHolder.children, true);
      if (hits.length === 0) {
        if (!e.shiftKey && latestRef.current.toolMode === 'select') {
          setSelectedPartIds([]);
          setSelectedGroupId(null);
        }
        return;
      }

      const hitObj = hits[0].object;
      const partId = hitObj.userData.partId as string | undefined;
      if (partId) {
        setActiveCurvePtIdx(null);
        if (e.shiftKey || e.metaKey || e.ctrlKey) {
          setSelectedPartIds((prev) =>
            prev.includes(partId) ? prev.filter((id) => id !== partId) : [...prev, partId]
          );
          setSelectedGroupId(null);
        } else {
          const pSpec = latestRef.current.doc.parts.find((p) => p.id === partId);
          // Alt+Click or clicking when group isn't selected: if part belongs to a cluster group and we aren't already targeting a single child, select the part cleanly
          if (pSpec?.parentGroupId && e.altKey) {
            setSelectedGroupId(pSpec.parentGroupId);
            setSelectedPartIds([]);
          } else {
            setSelectedPartIds([partId]);
            setSelectedGroupId(null);
          }
        }
      }
    };

    const onPointerHoverCursor = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || studioState.isDraggingGizmo) return;
      const axis = (transformControls as unknown as { axis?: string | null }).axis;
      studioState.renderer.domElement.style.cursor = axis ? 'grab' : '';
    };

    const onPointerCancel = () => {
      marqueeStart = null;
      pointerDownClient = null;
      setMarqueeRect(null);
      studioState.paintSession.finishStroke();
      if (studioState.isDraggingGizmo) {
        transformControls.pointerUp(null);
      }
    };

    const attachCanvasPointerListeners = (domEl: HTMLElement) => {
      domEl.style.touchAction = 'none';
      domEl.addEventListener('pointerdown', onPointerDown);
      domEl.addEventListener('pointermove', onPointerHoverCursor);
      domEl.addEventListener('pointercancel', onPointerCancel);
    };

    const detachCanvasPointerListeners = (domEl: HTMLElement) => {
      domEl.removeEventListener('pointerdown', onPointerDown);
      domEl.removeEventListener('pointermove', onPointerHoverCursor);
      domEl.removeEventListener('pointercancel', onPointerCancel);
    };

    attachCanvasPointerListeners(renderer.domElement);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

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
            frameId = window.setTimeout(cb, 65);
          }
        };
        frameId = window.setTimeout(poll, 6);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    };

    const animStartMs = performance.now();
    const tick = () => {
      if (disposed) return;
      try {
        studioState.controls.update();
        if (latestRef.current.studioSection === 'grass') {
          const elapsedSec = (performance.now() - animStartMs) * 0.001;
          studioState.grassPreview.update(
            elapsedSec,
            camera,
            keyLight,
            hemi,
            latestRef.current.grassPreviewWind
          );
        }
        renderer.render(scene, camera);
      } catch {
        // tolerate transient frame error
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
      detachCanvasPointerListeners(studioState.renderer.domElement);
      transformControls.disconnect();
      controls.dispose();
      envTex?.dispose();
      envTex = null;
      try {
        renderer.dispose();
      } catch {
        // ignore
      }
      renderer = createMakerRenderer(isSoftwareGl, true);
      renderer.setSize(container.clientWidth || 900, container.clientHeight || 620);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSoftwareGl ? 1 : 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      container.innerHTML = '';
      container.appendChild(renderer.domElement);
      transformControls.connect(renderer.domElement);
      controls = createControls(renderer.domElement);
      attachCanvasPointerListeners(renderer.domElement);
      studioState.renderer = renderer;
      studioState.controls = controls;
      try {
        await initMakerRenderer(renderer);
        if (disposed) return false;
        envTex = setupSceneEnvironment(scene, renderer);
        return true;
      } catch {
        return false;
      }
    };

    void (async () => {
      let ok = false;
      try {
        await initMakerRenderer(renderer);
        if (!isSoftwareGl && isWebGPUFallbackAdapter(renderer)) {
          ok = await switchToWebGLFallback();
        } else {
          ok = true;
        }
      } catch {
        ok = await switchToWebGLFallback();
      }
      if (disposed || !ok) return;
      if (!envTex) {
        envTex = setupSceneEnvironment(scene, renderer);
      }
      tick();
    })();

    const ro = new ResizeObserver(() => {
      if (disposed) return;
      const w = container.clientWidth || 900;
      const h = container.clientHeight || 620;
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(container);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      ro.disconnect();
      detachCanvasPointerListeners(studioState.renderer.domElement);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      transformControls.removeEventListener('dragging-changed', onDraggingChanged);
      transformControls.removeEventListener('objectChange', onGizmoObjectChange);
      transformControls.detach();
      transformControls.dispose();
      studioState.paintSession.dispose(scene);
      studioState.grassPreview.dispose();
      studioState.controls.dispose();
      envTex?.dispose();
      disposeObject3D(scene);
      try {
        renderer.dispose();
      } catch {
        // ignore
      }
      studioRef.current = null;
    };
  }, [pushHistory]);

  // Rebuild botanical 3D scene whenever doc changes
  useEffect(() => {
    const s = studioRef.current;
    if (!s || s.isDraggingGizmo) return;

    s.transformControls.detach();
    disposeObject3D(s.objectRootHolder);
    s.objectRootHolder.clear();
    s.partMeshes.clear();
    s.groupNodes.clear();
    s.paintableMeshes = [];

    const built = buildObjectMakerSceneGroup(doc, true);
    s.objectRootHolder.add(built.root);
    s.partMeshes = built.partMeshes;
    s.groupNodes = built.groupNodes;
    s.paintableMeshes = prepareObjectForVertexPainting(built.root);
  }, [doc]);

  // Replay non-destructive vertex paint strokes whenever doc rebuilds or paintStrokes change
  useEffect(() => {
    const s = studioRef.current;
    const root = s?.objectRootHolder.children[0];
    if (!s || !root || s.isDraggingGizmo || s.paintSession.brushing) return;
    resetObjectVertexPaint(root);
    if (paintStrokes.length > 0) {
      applyVertexPaintStrokesToObject(root, paintStrokes);
    }
  }, [paintStrokes, doc]);

  // Rebuild Curve Guide spline & draggable control points
  useEffect(() => {
    const s = studioRef.current;
    if (!s) return;
    disposeObject3D(s.curveGroup);
    s.curveGroup.clear();
    s.curveHandleMeshes = [];
    if (!curveEnabled) return;

    const curve = buildCurveInstance(curveCfg);
    const pts = curve.getPoints(48);
    const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const lineMat = new THREE.LineBasicMaterial({ color: '#34D399' });
    s.curveGroup.add(new THREE.Line(lineGeo, lineMat));

    const sphereGeo = new THREE.SphereGeometry(0.11, 16, 12);
    curveCfg.points.forEach((pt, idx) => {
      const active = activeCurvePtIdx === idx;
      const mat = new THREE.MeshBasicMaterial({
        color: active ? '#F59E0B' : '#34D399',
      });
      const handle = new THREE.Mesh(sphereGeo, mat);
      handle.position.set(pt[0], pt[1], pt[2]);
      handle.userData.curvePtIdx = idx;
      s.curveGroup.add(handle);
      s.curveHandleMeshes.push(handle);
    });
  }, [curveEnabled, curveCfg, activeCurvePtIdx]);

  // Sync Grass Sample Patch visibility & live uniforms when Grass Maker section is active
  useEffect(() => {
    const s = studioRef.current;
    if (!s) return;
    const isGrass = studioSection === 'grass';

    s.objectRootHolder.visible = !isGrass;
    s.curveGroup.visible = !isGrass;
    s.selectionBoxGroup.visible = !isGrass;
    s.soilRing.visible = !isGrass;
    s.grid.visible = !isGrass;
    s.transformControls.getHelper().visible = !isGrass;
    s.grassPreview.group.visible = isGrass;

    if (isGrass) {
      s.transformControls.detach();
      s.paintSession.hideCursor();
      const stats = s.grassPreview.sync({
        config: grassCfg,
        patchSizeM: grassPatchSize,
        biome: store.currentLevel?.biome ?? 'meadow',
        seedOffset: grassSeed,
        showGuides: showGrassGuides,
      });
      setGrassStats(stats);
    }
  }, [
    studioSection,
    grassCfg,
    grassPatchSize,
    grassSeed,
    showGrassGuides,
    store.currentLevel?.biome,
  ]);

  // Frame camera smoothly when switching into Grass Maker
  useEffect(() => {
    const s = studioRef.current;
    if (!s) return;
    if (studioSection === 'grass') {
      const dist = grassPatchSize >= 6 ? 4.8 : grassPatchSize <= 2.5 ? 2.45 : 3.45;
      s.camera.position.set(dist, dist * 0.62, dist * 1.12);
      s.controls.target.set(0, 0.28, 0);
      s.controls.update();
    } else {
      s.camera.position.set(2.85, 2.05, 3.25);
      s.controls.target.set(0, 0.55, 0);
      s.controls.update();
    }
  }, [studioSection, grassPatchSize]);

  // Sync Selection Bounding Boxes + TransformControls attachment + Paint OrbitControls
  useEffect(() => {
    const s = studioRef.current;
    if (!s || s.isDraggingGizmo) return;

    if (studioSection === 'grass') {
      s.controls.enabled = true;
      s.controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE,
      };
      s.controls.touches = {
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      };
      s.transformControls.detach();
      s.paintSession.hideCursor();
      return;
    }

    const paintBrushingActive =
      inspectorTab === 'paint' && paintTool === 'paint' && !spaceOrbiting;
    s.controls.enabled =
      !s.isDraggingGizmo && (inspectorTab === 'paint' || toolMode !== 'select');
    s.controls.mouseButtons = {
      LEFT: paintBrushingActive ? (null as unknown as THREE.MOUSE) : THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    s.controls.touches = {
      ONE: paintBrushingActive ? (null as unknown as THREE.TOUCH) : THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };
    if (!paintBrushingActive) {
      s.paintSession.hideCursor();
    }

    const tc = s.transformControls;
    const snap = gridSnapStep > 0 ? gridSnapStep : null;
    tc.setTranslationSnap(snap);
    tc.setRotationSnap(gridSnapStep > 0 ? THREE.MathUtils.degToRad(15) : null);
    tc.setScaleSnap(gridSnapStep > 0 ? gridSnapStep : null);

    disposeObject3D(s.selectionBoxGroup);
    s.selectionBoxGroup.clear();
    if (inspectorTab === 'paint') {
      tc.detach();
      return;
    }

    const box = new THREE.Box3();
    for (const pid of selectedPartIds) {
      const mesh = s.partMeshes.get(pid);
      if (!mesh) continue;
      box.setFromObject(mesh);
      if (!box.isEmpty()) {
        s.selectionBoxGroup.add(new THREE.Box3Helper(box.clone(), new THREE.Color('#34D399')));
      }
    }
    if (selectedGroupId) {
      const grp = s.groupNodes.get(selectedGroupId);
      if (grp) {
        box.setFromObject(grp);
        if (!box.isEmpty()) {
          s.selectionBoxGroup.add(new THREE.Box3Helper(box.clone(), new THREE.Color('#A855F7')));
        }
      }
    }

    if (curveEnabled && activeCurvePtIdx !== null && s.curveHandleMeshes[activeCurvePtIdx]) {
      tc.setMode('translate');
      tc.attach(s.curveHandleMeshes[activeCurvePtIdx]);
      return;
    }

    if (toolMode === 'select') {
      tc.detach();
      return;
    }

    tc.setMode(toolMode);
    if (selectedGroupId && s.groupNodes.has(selectedGroupId)) {
      tc.attach(s.groupNodes.get(selectedGroupId)!);
    } else if (selectedPartIds.length === 1 && s.partMeshes.has(selectedPartIds[0])) {
      tc.attach(s.partMeshes.get(selectedPartIds[0])!);
    } else if (selectedPartIds.length > 1) {
      const chosen = doc.parts.filter((p) => selectedPartIds.includes(p.id));
      if (chosen.length > 1) {
        s.multiProxy.position.set(
          chosen.reduce((acc, p) => acc + p.position[0], 0) / chosen.length,
          chosen.reduce((acc, p) => acc + p.position[1], 0) / chosen.length,
          chosen.reduce((acc, p) => acc + p.position[2], 0) / chosen.length
        );
        s.multiProxy.rotation.set(0, 0, 0);
        s.multiProxy.scale.set(1, 1, 1);
        tc.attach(s.multiProxy);
      } else {
        tc.detach();
      }
    } else {
      tc.detach();
    }
  }, [
    studioSection,
    doc,
    toolMode,
    gridSnapStep,
    selectedPartIds,
    selectedGroupId,
    curveEnabled,
    curveCfg,
    activeCurvePtIdx,
    inspectorTab,
    paintTool,
    spaceOrbiting,
  ]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.code === 'Space' && inspectorTab === 'paint') {
        e.preventDefault();
        setSpaceOrbiting(true);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      if (inspectorTab === 'paint') {
        if (e.key === '[') {
          setPaintBrush((b) => ({
            ...b,
            radius: Math.max(0.06, Number((b.radius - 0.05).toFixed(2))),
          }));
          return;
        }
        if (e.key === ']') {
          setPaintBrush((b) => ({
            ...b,
            radius: Math.min(1.6, Number((b.radius + 0.05).toFixed(2))),
          }));
          return;
        }
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        handleDeleteSelected();
      } else if (e.key.toLowerCase() === 'q') {
        setToolMode('select');
      } else if (e.key.toLowerCase() === 'w') {
        setToolMode('translate');
      } else if (e.key.toLowerCase() === 'e') {
        setToolMode('rotate');
      } else if (e.key.toLowerCase() === 'r') {
        setToolMode('scale');
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
  }, [handleDeleteSelected, handleRedo, handleUndo, inspectorTab]);

  const setCameraPreset = (preset: CameraPreset) => {
    const s = studioRef.current;
    if (!s) return;
    if (studioSection === 'grass') {
      const scale = grassPatchSize >= 6 ? 1.35 : grassPatchSize <= 2.5 ? 0.72 : 1.0;
      if (preset === 'front') {
        s.camera.position.set(0, 0.68 * scale, 3.3 * scale);
        s.controls.target.set(0, 0.28, 0);
      } else if (preset === 'top') {
        s.camera.position.set(0, 5.4 * scale, 0.01);
        s.controls.target.set(0, 0, 0);
      } else if (preset === 'close') {
        s.camera.position.set(1.2, 0.72, 1.35);
        s.controls.target.set(0, 0.25, 0);
      } else {
        s.camera.position.set(3.45 * scale, 2.15 * scale, 3.85 * scale);
        s.controls.target.set(0, 0.28, 0);
      }
      s.controls.update();
      return;
    }

    if (preset === 'front') {
      s.camera.position.set(0, 1.15, 3.8);
      s.controls.target.set(0, 0.55, 0);
    } else if (preset === 'top') {
      s.camera.position.set(0, 4.6, 0.01);
      s.controls.target.set(0, 0, 0);
    } else if (preset === 'close') {
      s.camera.position.set(1.65, 1.25, 1.85);
      s.controls.target.set(0, 0.5, 0);
    } else {
      s.camera.position.set(2.85, 2.05, 3.25);
      s.controls.target.set(0, 0.55, 0);
    }
    s.controls.update();
  };

  const activeClusterRecipe: PlantClusterRecipe = activeClusterGroup?.plantCluster ?? draftCluster;
  const savedPlantAssets = useMemo(
    () => store.customAssets.filter((a) => a.category === 'plant'),
    [store.customAssets]
  );
  const otherEditableAssets = useMemo(
    () => store.customAssets.filter((a) => a.category !== 'plant' && Boolean(a.objectRecipe?.parts.length)),
    [store.customAssets]
  );
  const curveLength = useMemo(() => computeCurveLength(curveCfg), [curveCfg]);

  // Resolved pattern & colors for Pattern & Glow tab
  const activeFinishState = useMemo(() => {
    if (activeClusterGroup?.plantCluster && selectedGroupId === activeClusterGroup.id) {
      const r = activeClusterGroup.plantCluster;
      const firstChild = doc.parts.find((p) => p.parentGroupId === activeClusterGroup.id);
      return {
        color: r.baseColor,
        pattern: r.basePlant.pattern ?? 'veins',
        accentColor: r.basePlant.accentColor ?? '#A2E382',
        tipColor: r.basePlant.tipColor ?? '#69C463',
        emissiveColor: r.basePlant.emissiveColor ?? '#38BDF8',
        emissiveIntensity: r.basePlant.emissiveIntensity ?? 0,
        roughness: firstChild?.material.roughness ?? 0.44,
        weathering: (firstChild?.material.weathering ?? 'none') as WeatheringPreset,
        weatheringIntensity: firstChild?.material.weatheringIntensity ?? 0.35,
      };
    }
    return {
      color: primaryPart?.material.color ?? '#3B9452',
      pattern: primaryPart?.plantParams?.pattern ?? 'veins',
      accentColor: primaryPart?.plantParams?.accentColor ?? '#A2E382',
      tipColor: primaryPart?.plantParams?.tipColor ?? '#69C463',
      emissiveColor: primaryPart?.plantParams?.emissiveColor ?? '#38BDF8',
      emissiveIntensity: primaryPart?.plantParams?.emissiveIntensity ?? 0,
      roughness: primaryPart?.material.roughness ?? 0.44,
      weathering: (primaryPart?.material.weathering ?? 'none') as WeatheringPreset,
      weatheringIntensity: primaryPart?.material.weatheringIntensity ?? 0.35,
    };
  }, [activeClusterGroup, selectedGroupId, doc.parts, primaryPart]);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-1 sm:p-2">
      <div className="w-full max-w-[1760px] h-[95dvh] rounded-2xl bg-white dark:bg-[#171A23] text-slate-900 dark:text-[#F3F5FA] border border-slate-200/80 dark:border-white/[0.1] shadow-2xl flex flex-col overflow-hidden">
        {/* TOP STUDIO HEADER */}
        <header className="shrink-0 px-3.5 py-2.5 border-b border-slate-200/80 dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-[#171A23]">
          <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
            <div className="w-8 h-8 rounded-xl bg-[#20B46A]/15 text-[#20B46A] flex items-center justify-center shrink-0">
              <Sprout size={17} />
            </div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#20B46A] whitespace-nowrap">
              Plant Maker
            </span>

            {/* Section Switcher: Botanical Plants vs Flower Maker vs Grass & Meadow */}
            <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.08]">
              <button
                type="button"
                onClick={() => setStudioSection('plant')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-colors whitespace-nowrap ${
                  studioSection === 'plant'
                    ? 'bg-[#20B46A] text-white shadow-sm'
                    : 'text-slate-600 dark:text-[#A5AEC4] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Leaf size={12} />
                <span>Plants &amp; Foliage</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (studioSection !== 'flower') {
                    setStudioSection('flower');
                    const built = buildFlowerDocFromRecipe(flowerRecipe);
                    setDoc(built);
                    setPlantName(flowerRecipe.name);
                    setSelectedGroupId(built.groups[0]?.id ?? null);
                    setSelectedPartIds([]);
                  }
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-colors whitespace-nowrap ${
                  studioSection === 'flower'
                    ? 'bg-[#EC4899] text-white shadow-sm'
                    : 'text-slate-600 dark:text-[#A5AEC4] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Flower2 size={12} />
                <span>Flower Maker</span>
              </button>
              <button
                type="button"
                onClick={() => setStudioSection('grass')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-colors whitespace-nowrap ${
                  studioSection === 'grass'
                    ? 'bg-[#20B46A] text-white shadow-sm'
                    : 'text-slate-600 dark:text-[#A5AEC4] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Wind size={12} />
                <span>Grass &amp; Meadow</span>
              </button>
            </div>

            {studioSection !== 'grass' && (
              <div className="flex items-center gap-2 min-w-0">
                <input
                  type="text"
                  value={plantName}
                  onChange={(e) => {
                    setPlantName(e.target.value);
                    if (studioSection === 'flower') {
                      setFlowerRecipe((prev) => ({ ...prev, name: e.target.value }));
                    }
                  }}
                  maxLength={40}
                  placeholder={studioSection === 'flower' ? 'Flower name…' : 'Plant name…'}
                  className="w-40 sm:w-48 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.08] text-xs font-extrabold focus:outline-none focus:border-[#20B46A]"
                />
                {studioSection === 'plant' && (
                  <select
                    value={assetCategory}
                    onChange={(e) => setAssetCategory(e.target.value as AssetCategory)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.08] text-xs font-bold"
                  >
                    <option value="plant">Plant</option>
                    <option value="scenery">Scenery</option>
                  </select>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {studioSection !== 'grass' ? (
              <>
                {/* Load Saved Plants & Starter Presets Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowLoadMenu((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1F2430] hover:bg-slate-200 dark:hover:bg-[#282F3F] text-xs font-bold whitespace-nowrap"
                  >
                    <FolderOpen size={13} className="text-[#20B46A]" />
                    <span>Presets &amp; Saved</span>
                    <ChevronDown size={12} />
                  </button>

                  {showLoadMenu && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setShowLoadMenu(false)} />
                      <div className="absolute right-0 mt-1.5 w-84 max-h-[68vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#1B202C] shadow-2xl border border-slate-200/80 dark:border-white/[0.12] p-2.5 z-40 space-y-2.5 maker-scroll">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#20B46A]">
                            Saved Plants ({savedPlantAssets.length})
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAssetId(null);
                              setPlantName('Custom Botanical Plant');
                              const fresh = createStarterPlantDoc();
                              setDoc(fresh);
                              setPaintStrokes([]);
                              setPaintRedoStack([]);
                              setSelectedGroupId(fresh.groups[0]?.id ?? null);
                              setSelectedPartIds([]);
                              setShowLoadMenu(false);
                            }}
                            className="text-[11px] font-bold text-[#20B46A] hover:underline"
                          >
                            + Blank Starter
                          </button>
                        </div>

                        {savedPlantAssets.length === 0 ? (
                          <div className="text-xs text-slate-500 dark:text-[#8E96AB] px-2 py-1">
                            No saved plants yet — try a starter preset below or fan out leaves from the center!
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {savedPlantAssets.map((asset) => (
                              <button
                                key={asset.id}
                                type="button"
                                onClick={() => loadExistingAsset(asset)}
                                className={`w-full flex items-center gap-2.5 p-1.5 rounded-xl text-left transition-colors ${
                                  editingAssetId === asset.id
                                    ? 'bg-[#20B46A]/15 border border-[#20B46A]/40'
                                    : 'hover:bg-slate-100 dark:hover:bg-[#252B3B]'
                                }`}
                              >
                                <AssetThumbnail customAsset={asset} size={36} rounded="rounded-lg" />
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-bold truncate">{asset.name}</div>
                                  <div className="text-[10px] text-slate-500 dark:text-[#949BB0]">
                                    {asset.objectRecipe
                                      ? `${asset.objectRecipe.parts.length} parts`
                                      : 'External GLB'}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}

                        <div className="pt-2 border-t border-slate-200/80 dark:border-white/[0.08]">
                          <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#949BB0] px-1 mb-1">
                            Botanical &amp; Fantasy Starters
                          </div>
                          <div className="space-y-1">
                            {PLANT_STARTER_PRESETS.map((preset) => (
                              <button
                                key={preset.id}
                                type="button"
                                onClick={() => {
                                  const built = preset.build();
                                  setEditingAssetId(null);
                                  setPlantName(preset.name);
                                  setAssetCategory('plant');
                                  setDoc(built);
                                  setPaintStrokes([]);
                                  setPaintRedoStack([]);
                                  setSelectedGroupId(built.groups[0]?.id ?? null);
                                  setSelectedPartIds([]);
                                  setShowLoadMenu(false);
                                  flashToast(`Loaded "${preset.name}"`);
                                }}
                                className="w-full px-2.5 py-1.5 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-[#252B3B]"
                              >
                                <div className="text-xs font-bold">{preset.name}</div>
                                <div className="text-[10px] text-slate-500 dark:text-[#949BB0] truncate">
                                  {preset.summary}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>

                        {otherEditableAssets.length > 0 && (
                          <div className="pt-2 border-t border-slate-200/80 dark:border-white/[0.08]">
                            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#949BB0] px-1 mb-1">
                              Other Editable Recipes
                            </div>
                            <div className="space-y-1">
                              {otherEditableAssets.slice(0, 6).map((asset) => (
                                <button
                                  key={asset.id}
                                  type="button"
                                  onClick={() => loadExistingAsset(asset)}
                                  className="w-full px-2.5 py-1 rounded-lg text-left text-xs font-semibold hover:bg-slate-100 dark:hover:bg-[#252B3B] truncate"
                                >
                                  {asset.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => requestOpenContextualAiModal('plant')}
                  title="AI Plant Creator"
                  className="px-2.5 py-1.5 rounded-xl bg-[#20B46A]/15 hover:bg-[#20B46A]/25 text-[#20B46A] border border-[#20B46A]/35 text-xs font-extrabold inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <Wand2 size={13} />
                  <Sparkles size={11} className="text-[#F59E0B]" />
                  <span>AI</span>
                </button>

                <button
                  type="button"
                  disabled={undoStack.length === 0}
                  onClick={handleUndo}
                  title="Undo (Ctrl+Z)"
                  className="p-2 rounded-xl bg-slate-100 dark:bg-[#1F2430] disabled:opacity-35 hover:bg-slate-200 dark:hover:bg-[#282F3F]"
                >
                  <Undo2 size={14} />
                </button>
                <button
                  type="button"
                  disabled={redoStack.length === 0}
                  onClick={handleRedo}
                  title="Redo (Ctrl+Shift+Z)"
                  className="p-2 rounded-xl bg-slate-100 dark:bg-[#1F2430] disabled:opacity-35 hover:bg-slate-200 dark:hover:bg-[#282F3F]"
                >
                  <Redo2 size={14} />
                </button>

                <label className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1F2430] text-[11px] font-bold cursor-pointer whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={placeOnSave}
                    onChange={(e) => setPlaceOnSave(e.target.checked)}
                    className="accent-[#20B46A]"
                  />
                  <span>Drop in Level</span>
                </label>

                {editingAssetId && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleSaveAsset({ asCopy: true, placeNow: false })}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1F2430] hover:bg-slate-200 dark:hover:bg-[#282F3F] text-xs font-bold disabled:opacity-50 whitespace-nowrap"
                  >
                    Save Copy
                  </button>
                )}

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSaveAsset({ placeNow: placeOnSave })}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl hover:opacity-95 text-white text-xs font-extrabold shadow-sm disabled:opacity-50 whitespace-nowrap ${
                    studioSection === 'flower' ? 'bg-[#EC4899]' : 'bg-[#20B46A]'
                  }`}
                >
                  <Save size={13} />
                  <span>
                    {saving
                      ? 'Exporting GLB…'
                      : editingAssetId
                      ? 'Save Changes'
                      : studioSection === 'flower'
                      ? 'Save Flower'
                      : 'Save to Plants'}
                  </span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    patchGrassConfig(createDefaultGrassConfig(), true);
                    flashToast('Reset grass settings to defaults');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1F2430] hover:bg-slate-200 dark:hover:bg-[#282F3F] text-xs font-bold whitespace-nowrap"
                >
                  <RotateCcw size={13} />
                  <span>Reset Defaults</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#20B46A] hover:opacity-95 text-white text-xs font-extrabold shadow-sm whitespace-nowrap"
                >
                  <span>Done</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Close Plant Maker"
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-500"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {/* DEDICATED GRASS MAKER SUB-HEADER */}
        {studioSection === 'grass' && (
          <div className="shrink-0 px-4 py-2.5 border-b border-slate-200/80 dark:border-white/[0.08] bg-gradient-to-r from-[#20B46A]/10 via-emerald-500/5 to-transparent dark:from-[#20B46A]/15 dark:via-[#141A24] dark:to-[#171A23] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#20B46A]/20 border border-[#20B46A]/35 text-[#20B46A] flex items-center justify-center shrink-0">
                <Sprout size={18} />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
                  Grass &amp; Meadow Maker
                </h2>
                <p className="text-[11px] font-medium text-slate-600 dark:text-[#9AA3B8] truncate">
                  Inspect multi-clump spacing, tuft clumpiness, lushness, and wind flow on a live sample plot
                  {currentLevel ? ` · Synced with "${currentLevel.name}"` : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 rounded-xl bg-white/80 dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.08] p-1">
                {([
                  [2.5, '2.5×2.5m'],
                  [4, '4×4m'],
                  [6, '6×6m'],
                ] as const).map(([sz, lbl]) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setGrassPatchSize(sz)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold tabular-nums transition-colors whitespace-nowrap ${
                      grassPatchSize === sz
                        ? 'bg-[#20B46A] text-white'
                        : 'text-slate-600 dark:text-[#9FA8BE] hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowGrassGuides((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-colors whitespace-nowrap ${
                  showGrassGuides
                    ? 'bg-[#F59E0B]/15 border-[#F59E0B]/40 text-amber-700 dark:text-amber-300'
                    : 'bg-white/80 dark:bg-[#12151E] border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-[#A5AEC4]'
                }`}
              >
                <Grid3X3 size={13} />
                <span>1m Grid &amp; Clumps</span>
              </button>
              <button
                type="button"
                onClick={() => setGrassSeed((s) => s + 1)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/80 dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.08] hover:border-[#20B46A] text-[11px] font-bold whitespace-nowrap"
              >
                <Dices size={13} className="text-[#20B46A]" />
                <span>Reseed Sample</span>
              </button>
            </div>
          </div>
        )}

        {/* MAIN STUDIO WORKSPACE */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* LEFT DOCK */}
          {showLeftDock && studioSection === 'plant' && (
            <aside className="w-[258px] shrink-0 border-r border-slate-200/80 dark:border-white/[0.08] bg-slate-50 dark:bg-[#131720] flex flex-col min-h-0">
              {/* Organic Botanical & Fantasy Shapes Panel */}
              <div className="p-2.5 border-b border-slate-200/80 dark:border-white/[0.08] space-y-2 h-[50%] min-h-[210px] flex flex-col min-h-0">
                <div className="flex items-center justify-between gap-1 shrink-0">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB]">
                    Organic Shapes
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSpawnNewCluster()}
                    title="Spawn a new 1–20 fanning leaf or petal cluster at center"
                    className="px-2 py-0.5 rounded-md bg-[#20B46A]/15 hover:bg-[#20B46A] text-[#20B46A] hover:text-white text-[10px] font-extrabold transition-colors whitespace-nowrap"
                  >
                    + Fan Cluster
                  </button>
                </div>

                {/* Category Filter */}
                <div className="grid grid-cols-4 gap-1 shrink-0">
                  {(
                    [
                      ['all', 'All'],
                      ['leaf', 'Leaves'],
                      ['petal', 'Petals'],
                      ['fantasy', 'Fantasy'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setShapeFilter(id)}
                      className={`py-1 rounded-lg text-[10px] font-bold transition-colors ${
                        shapeFilter === id
                          ? 'bg-[#20B46A] text-white'
                          : 'bg-white dark:bg-[#1B202C] text-slate-500 dark:text-[#9FA8BE] hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto pr-1 maker-scroll">
                  <div className="grid grid-cols-2 gap-1.5 auto-rows-max content-start pb-1">
                    {filteredCatalog.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => addOrganicPart(item.id)}
                        title={item.hint}
                        className="min-h-[32px] px-2 py-1.5 rounded-lg bg-white dark:bg-[#1B202C] hover:bg-[#20B46A] hover:text-white border border-slate-200/80 dark:border-white/[0.06] text-left text-[11px] font-bold leading-snug truncate transition-colors"
                      >
                        {item.label}
                      </button>
                    ))}
                    {shapeFilter === 'fantasy' &&
                      PLANT_SHAPE_CATALOG.filter((s) => s.category === 'stem').map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => addOrganicPart(item.id)}
                          title={item.hint}
                          className="min-h-[32px] px-2 py-1.5 rounded-lg bg-white dark:bg-[#1B202C] hover:bg-[#20B46A] hover:text-white border border-slate-200/80 dark:border-white/[0.06] text-left text-[11px] font-bold leading-snug truncate transition-colors"
                        >
                          {item.label}
                        </button>
                      ))}
                  </div>
                </div>
              </div>

              {/* Plant Parts & Cluster Groups Hierarchy */}
              <div className="flex-1 min-h-0 flex flex-col p-2.5 space-y-2">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB]">
                    Foliage ({doc.parts.length})
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleGroupSelected}
                      disabled={selectedPartIds.length < 2}
                      title="Group selected parts"
                      className="p-1 rounded-md bg-white dark:bg-[#1B202C] border border-slate-200/80 dark:border-white/[0.06] disabled:opacity-35 hover:text-[#20B46A]"
                    >
                      <Group size={12} />
                    </button>
                    {selectedGroupId && (
                      <button
                        type="button"
                        onClick={() => handleUngroup(selectedGroupId)}
                        title="Ungroup cluster into independent leaves/petals"
                        className="p-1 rounded-md bg-white dark:bg-[#1B202C] border border-slate-200/80 dark:border-white/[0.06] hover:text-[#A855F7]"
                      >
                        <Ungroup size={12} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleDuplicateSelected}
                      disabled={selectedPartIds.length === 0}
                      title="Duplicate selected"
                      className="p-1 rounded-md bg-white dark:bg-[#1B202C] border border-slate-200/80 dark:border-white/[0.06] disabled:opacity-35 hover:text-[#38BDF8]"
                    >
                      <Copy size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteSelected}
                      disabled={selectedPartIds.length === 0 && !selectedGroupId}
                      title="Delete selected"
                      className="p-1 rounded-md bg-white dark:bg-[#1B202C] border border-slate-200/80 dark:border-white/[0.06] disabled:opacity-35 hover:text-rose-500"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto space-y-1 maker-scroll">
                  {doc.groups.map((grp) => {
                    const isGrpSel = selectedGroupId === grp.id;
                    const children = doc.parts.filter((p) => p.parentGroupId === grp.id);
                    return (
                      <div key={grp.id} className="space-y-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedGroupId(grp.id);
                            setSelectedPartIds([]);
                            if (grp.plantCluster) setInspectorTab('cluster');
                          }}
                          className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-extrabold text-left ${
                            isGrpSel
                              ? 'bg-[#A855F7]/20 text-[#A855F7] ring-1 ring-[#A855F7]/40'
                              : 'bg-white/75 dark:bg-[#1B202C] text-slate-700 dark:text-[#D5DCF0]'
                          }`}
                        >
                          {grp.plantCluster ? <Flower2 size={11} /> : <Layers size={11} />}
                          <span className="truncate flex-1">{grp.name}</span>
                          <span className="text-[10px] tabular-nums opacity-70">
                            {grp.plantCluster ? `×${grp.plantCluster.count}` : children.length}
                          </span>
                        </button>
                        <div className="pl-3 space-y-0.5">
                          {children.map((part) => {
                            const sel = selectedPartIds.includes(part.id);
                            return (
                              <div
                                key={part.id}
                                onClick={(e) => {
                                  if (e.shiftKey || e.metaKey || e.ctrlKey) {
                                    setSelectedPartIds((prev) =>
                                      prev.includes(part.id)
                                        ? prev.filter((id) => id !== part.id)
                                        : [...prev, part.id]
                                    );
                                  } else {
                                    setSelectedPartIds([part.id]);
                                  }
                                  setSelectedGroupId(null);
                                }}
                                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                                  sel
                                    ? 'bg-[#20B46A] text-white'
                                    : 'hover:bg-slate-200/70 dark:hover:bg-[#1F2533]'
                                }`}
                              >
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: part.material.color || '#20B46A' }}
                                />
                                <span className="truncate flex-1">{part.name}</span>
                                <button
                                  type="button"
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    commitDoc(
                                      (prev) => ({
                                        ...prev,
                                        parts: prev.parts.map((x) =>
                                          x.id === part.id ? { ...x, hidden: !x.hidden } : x
                                        ),
                                      }),
                                      false
                                    );
                                  }}
                                  className="opacity-70 hover:opacity-100"
                                >
                                  {part.hidden ? <EyeOff size={11} /> : <Eye size={11} />}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {doc.parts
                    .filter((p) => !p.parentGroupId)
                    .map((part) => {
                      const sel = selectedPartIds.includes(part.id);
                      return (
                        <div
                          key={part.id}
                          onClick={(e) => {
                            if (e.shiftKey || e.metaKey || e.ctrlKey) {
                              setSelectedPartIds((prev) =>
                                prev.includes(part.id)
                                  ? prev.filter((id) => id !== part.id)
                                  : [...prev, part.id]
                              );
                            } else {
                              setSelectedPartIds([part.id]);
                            }
                            setSelectedGroupId(null);
                          }}
                          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer ${
                            sel
                              ? 'bg-[#20B46A] text-white'
                              : 'bg-white dark:bg-[#1B202C] hover:bg-slate-200/70 dark:hover:bg-[#23293A]'
                          }`}
                        >
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: part.material.color || '#34D399' }}
                          />
                          <span className="truncate flex-1">{part.name}</span>
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              commitDoc(
                                (prev) => ({
                                  ...prev,
                                  parts: prev.parts.map((x) =>
                                    x.id === part.id ? { ...x, hidden: !x.hidden } : x
                                  ),
                                }),
                                false
                              );
                            }}
                            className="opacity-70 hover:opacity-100"
                          >
                            {part.hidden ? <EyeOff size={11} /> : <Eye size={11} />}
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>
            </aside>
          )}

          {/* LEFT DOCK: GRASS SAMPLE PLOT & MEADOW PRESETS */}
          {showLeftDock && studioSection === 'grass' && (
            <aside className="w-[268px] shrink-0 border-r border-slate-200/80 dark:border-white/[0.08] bg-slate-50 dark:bg-[#131720] flex flex-col min-h-0">
              <div className="p-3 border-b border-slate-200/80 dark:border-white/[0.08] space-y-2.5 shrink-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#20B46A]">
                    Patch Sample Metrics
                  </span>
                  <span className="text-[11px] font-mono font-bold tabular-nums text-slate-500 dark:text-[#949BB0]">
                    {grassStats.patchAreaSqM.toFixed(1)} m²
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <div className="p-2 rounded-xl bg-white dark:bg-[#1B202C] border border-slate-200/80 dark:border-white/[0.06]">
                    <div className="text-[10px] font-bold text-slate-500 dark:text-[#8E96AB]">
                      Blades in Patch
                    </div>
                    <div className="text-sm font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                      {grassStats.bladeCount}
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-[#1B202C] border border-slate-200/80 dark:border-white/[0.06]">
                    <div className="text-[10px] font-bold text-slate-500 dark:text-[#8E96AB]">
                      Density / m²
                    </div>
                    <div className="text-sm font-extrabold font-mono tabular-nums text-[#20B46A]">
                      {grassStats.bladesPerSqM.toFixed(1)}
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-[#1B202C] border border-slate-200/80 dark:border-white/[0.06]">
                    <div className="text-[10px] font-bold text-slate-500 dark:text-[#8E96AB]">
                      Tuft Clumps
                    </div>
                    <div className="text-sm font-extrabold font-mono tabular-nums text-amber-600 dark:text-amber-400">
                      {grassStats.clumpCount}
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-[#1B202C] border border-slate-200/80 dark:border-white/[0.06]">
                    <div className="text-[10px] font-bold text-slate-500 dark:text-[#8E96AB]">
                      Cell Spacing
                    </div>
                    <div className="text-sm font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                      {grassStats.cellSpacingM.toFixed(2)}m
                    </div>
                  </div>
                </div>

                <div className="space-y-1 pt-0.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-[#A5AEC4]">
                    <span>Preview Breeze</span>
                    <span className="font-mono tabular-nums">
                      {Math.round(grassPreviewWind * 100)}%
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {(
                      [
                        [0.12, 'Calm'],
                        [0.45, 'Breeze'],
                        [0.95, 'Gust'],
                      ] as const
                    ).map(([wVal, lbl]) => (
                      <button
                        key={lbl}
                        type="button"
                        onClick={() => setGrassPreviewWind(wVal)}
                        className={`py-1 rounded-lg text-[10px] font-extrabold transition-colors ${
                          Math.abs(grassPreviewWind - wVal) < 0.08
                            ? 'bg-[#20B46A] text-white'
                            : 'bg-white dark:bg-[#1B202C] border border-slate-200/80 dark:border-white/[0.06] text-slate-600 dark:text-[#9FA8BE]'
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex-1 min-h-0 flex flex-col p-3 space-y-2">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB] shrink-0">
                  Meadow Presets
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1 maker-scroll">
                  {GRASS_MEADOW_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        patchGrassConfig(preset.patch, true);
                        flashToast(`Applied "${preset.name}"`);
                      }}
                      className="w-full p-2.5 rounded-xl bg-white dark:bg-[#1B202C] hover:border-[#20B46A] border border-slate-200/80 dark:border-white/[0.06] text-left transition-colors space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                          {preset.name}
                        </span>
                        <div className="flex items-center -space-x-1 shrink-0">
                          <span
                            className="w-3 h-3 rounded-full border border-black/25"
                            style={{ backgroundColor: preset.patch.primaryColor }}
                          />
                          <span
                            className="w-3 h-3 rounded-full border border-black/25"
                            style={{ backgroundColor: preset.patch.secondaryColor }}
                          />
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-[#8E96AB] leading-snug">
                        {preset.summary}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </aside>
          )}

          {/* LEFT DOCK: FLOWER MAKER STARTER FLOWERS & SAVED FLOWERS */}
          {showLeftDock && studioSection === 'flower' && (
            <aside className="w-[262px] shrink-0 border-r border-slate-200/80 dark:border-white/[0.08] bg-slate-50 dark:bg-[#131720] flex flex-col min-h-0">
              <div className="p-3 border-b border-slate-200/80 dark:border-white/[0.08] space-y-2 shrink-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#EC4899]">
                    Premade Flowers
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      updateFlowerRecipe((prev) => ({
                        ...prev,
                        seed: Math.floor(Math.random() * 90000 + 100),
                      }))
                    }
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#EC4899] hover:underline"
                  >
                    <Dices size={12} />
                    <span>Reseed</span>
                  </button>
                </div>
                <div className="space-y-1.5">
                  {FLOWER_STARTER_RECIPES.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => loadStarterFlower(preset)}
                      className="w-full p-2 rounded-xl bg-white dark:bg-[#1B202C] hover:border-[#EC4899] border border-slate-200/80 dark:border-white/[0.06] text-left transition-colors space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                          {preset.name}
                        </span>
                        <div className="flex items-center -space-x-1 shrink-0">
                          <span
                            className="w-3 h-3 rounded-full border border-black/25"
                            style={{ backgroundColor: preset.primaryColor }}
                          />
                          <span
                            className="w-3 h-3 rounded-full border border-black/25"
                            style={{ backgroundColor: preset.stamenColor }}
                          />
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-[#8E96AB]">
                        {preset.petalCount} petals · {preset.stemHeight.toFixed(1)}m tall
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 min-h-0 flex flex-col p-3 space-y-2">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB] shrink-0">
                  Saved Flowers ({savedPlantAssets.filter((a) => a.plantSubKind === 'flower').length})
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1 maker-scroll">
                  {savedPlantAssets
                    .filter((a) => a.plantSubKind === 'flower')
                    .map((asset) => (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => loadExistingAsset(asset)}
                        className={`w-full flex items-center gap-2 p-2 rounded-xl border text-left transition-colors ${
                          editingAssetId === asset.id
                            ? 'bg-[#EC4899]/15 border-[#EC4899]/50'
                            : 'bg-white dark:bg-[#1B202C] border-slate-200/80 dark:border-white/[0.06] hover:border-[#EC4899]/50'
                        }`}
                      >
                        <AssetThumbnail customAsset={asset} size={34} rounded="rounded-lg" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold truncate">{asset.name}</div>
                          <div className="text-[10px] text-slate-500 dark:text-[#8E96AB]">
                            {asset.flowerRecipe
                              ? `${asset.flowerRecipe.petalCount} petals · ${asset.flowerRecipe.stemHeight.toFixed(1)}m`
                              : 'Custom flower'}
                          </div>
                        </div>
                      </button>
                    ))}
                  {savedPlantAssets.filter((a) => a.plantSubKind === 'flower').length === 0 && (
                    <div className="text-[11px] text-slate-500 dark:text-[#8E96AB] leading-snug">
                      Customize any flower on the right and click Save Flower so it appears in Flora scatter dropdowns.
                    </div>
                  )}
                </div>
              </div>
            </aside>
          )}

          {/* CENTER 3D VIEWPORT */}
          <div className="flex-1 min-w-0 relative bg-[#101915] select-none touch-none">
            <div ref={viewportMountRef} className="w-full h-full touch-none" />

            {/* Live Gizmo Readout */}
            {gizmoHudText && (
              <div className="absolute top-14 left-1/2 -translate-x-1/2 px-3 py-1 rounded-xl bg-[#0F1814]/95 border border-[#FFD32A]/60 text-xs font-mono font-extrabold text-[#FFD32A] shadow-xl pointer-events-none z-30">
                {gizmoHudText}
              </div>
            )}

            {/* 2D Marquee Box */}
            {marqueeRect && (
              <div
                className="absolute pointer-events-none border-2 border-dashed border-[#34D399] bg-[#34D399]/15 rounded-sm z-20"
                style={{
                  left: marqueeRect.x,
                  top: marqueeRect.y,
                  width: marqueeRect.w,
                  height: marqueeRect.h,
                }}
              />
            )}

            {/* Toast feedback */}
            {toast && (
              <div className="absolute top-14 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-xl bg-[#0F1814] border border-[#20B46A]/60 text-xs font-bold text-white shadow-xl pointer-events-none z-30">
                {toast}
              </div>
            )}

            {/* Top Viewport Toolbar */}
            {studioSection === 'plant' ? (
              <div className="absolute top-2.5 left-2.5 right-2.5 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
                <div className="flex items-center gap-1.5 bg-[#0F1814]/90 border border-white/[0.1] rounded-xl p-1 pointer-events-auto">
                  <button
                    type="button"
                    onClick={() => setShowLeftDock((v) => !v)}
                    className="px-2 py-1 rounded-lg text-[11px] font-bold text-slate-300 hover:bg-white/10 whitespace-nowrap"
                  >
                    {showLeftDock ? '« Shapes' : 'Shapes »'}
                  </button>
                  <div className="w-px h-4 bg-white/10" />
                  {(
                    [
                      ['select', 'Marquee', MousePointer2],
                      ['translate', 'Move', Move],
                      ['rotate', 'Rotate', RotateCw],
                      ['scale', 'Scale', Scaling],
                    ] as const
                  ).map(([id, label, Icon]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setToolMode(id);
                        if (id !== 'translate') setActiveCurvePtIdx(null);
                      }}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap ${
                        toolMode === id
                          ? 'bg-[#20B46A] text-white'
                          : 'text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <Icon size={12} />
                      <span>{label}</span>
                    </button>
                  ))}
                  <div className="w-px h-4 bg-white/10" />
                  <select
                    value={gridSnapStep}
                    onChange={(e) => setGridSnapStep(Number(e.target.value) as 0 | 0.05 | 0.1 | 0.25)}
                    className="bg-transparent text-[11px] font-bold text-slate-200 px-1.5 py-1 focus:outline-none cursor-pointer"
                  >
                    <option value={0} className="bg-[#121D18]">Snap: Free</option>
                    <option value={0.05} className="bg-[#121D18]">Snap: 0.05m</option>
                    <option value={0.1} className="bg-[#121D18]">Snap: 0.10m</option>
                    <option value={0.25} className="bg-[#121D18]">Snap: 0.25m</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 bg-[#0F1814]/90 border border-white/[0.1] rounded-xl p-1 pointer-events-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setCurveEnabled((v) => !v);
                      if (!curveEnabled) setInspectorTab('shape');
                    }}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap ${
                      curveEnabled
                        ? 'bg-[#20B46A] text-white'
                        : 'text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <Spline size={12} />
                    <span>Vine Curve</span>
                  </button>
                  <div className="w-px h-4 bg-white/10" />
                  {(
                    [
                      ['threeQuarter', '3/4'],
                      ['front', 'Front'],
                      ['top', 'Top'],
                      ['close', 'Close'],
                    ] as const
                  ).map(([preset, lbl]) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCameraPreset(preset)}
                      className="px-2 py-1 rounded-lg text-[11px] font-bold text-slate-300 hover:bg-white/10"
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="absolute top-2.5 left-2.5 right-2.5 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
                <div className="flex items-center gap-1.5 bg-[#0F1814]/90 border border-white/[0.1] rounded-xl p-1 pointer-events-auto">
                  <button
                    type="button"
                    onClick={() => setShowLeftDock((v) => !v)}
                    className="px-2 py-1 rounded-lg text-[11px] font-bold text-slate-300 hover:bg-white/10 whitespace-nowrap"
                  >
                    {showLeftDock ? '« Presets' : 'Presets »'}
                  </button>
                  <div className="w-px h-4 bg-white/10" />
                  <span className="px-2 py-1 text-[11px] font-bold text-[#34D399] tabular-nums whitespace-nowrap">
                    {grassPatchSize}×{grassPatchSize}m Plot · {grassStats.clumpCount} Clumps · {grassStats.bladeCount} Blades
                  </span>
                </div>

                <div className="flex items-center gap-1 bg-[#0F1814]/90 border border-white/[0.1] rounded-xl p-1 pointer-events-auto">
                  {(
                    [
                      ['threeQuarter', '3/4'],
                      ['front', 'Low Meadow'],
                      ['top', 'Top Grid'],
                      ['close', 'Close Tuft'],
                    ] as const
                  ).map(([preset, lbl]) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCameraPreset(preset)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-300 hover:bg-white/10 whitespace-nowrap"
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom Contextual Action Strip */}
            <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-center gap-2 pointer-events-none">
              {studioSection === 'grass' ? (
                <div className="px-3 py-1 rounded-xl bg-[#0F1814]/85 border border-white/[0.1] text-[11px] font-semibold text-slate-300">
                  Drag to orbit · Scroll to zoom · Amber rings mark clump centers on a 1m square grid
                </div>
              ) : activeClusterGroup?.plantCluster ? (
                <div className="flex flex-wrap items-center gap-2 px-3.5 py-2 rounded-2xl bg-[#0F1814]/95 border border-[#20B46A]/45 text-white pointer-events-auto shadow-xl">
                  <span className="text-[11px] font-extrabold text-[#34D399] whitespace-nowrap">
                    {activeClusterGroup.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-300 whitespace-nowrap">
                      Count: <strong className="font-mono text-[#34D399]">{activeClusterGroup.plantCluster.count}</strong>
                    </span>
                    <input
                      type="range"
                      min={1}
                      max={20}
                      step={1}
                      value={activeClusterGroup.plantCluster.count}
                      onChange={(e) =>
                        updateClusterRecipe((prev) => ({
                          ...prev,
                          count: Number(e.target.value),
                        }))
                      }
                      className="w-28 sm:w-36 accent-[#20B46A]"
                    />
                  </div>
                  <div className="flex items-center gap-1 bg-white/10 rounded-lg p-0.5">
                    {(
                      [
                        ['fan', 'Fan'],
                        ['randomCenter', 'Center'],
                        ['spiral', 'Spiral'],
                      ] as const
                    ).map(([mode, lbl]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() =>
                          updateClusterRecipe((prev) => ({ ...prev, layout: mode }))
                        }
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          activeClusterGroup.plantCluster?.layout === mode
                            ? 'bg-[#20B46A] text-white'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateClusterRecipe((prev) => ({
                        ...prev,
                        symmetrical: !prev.symmetrical,
                      }))
                    }
                    className={`px-2 py-1 rounded-lg text-[10px] font-extrabold whitespace-nowrap ${
                      activeClusterGroup.plantCluster.symmetrical
                        ? 'bg-[#38BDF8] text-slate-950'
                        : 'bg-white/10 text-slate-200'
                    }`}
                  >
                    {activeClusterGroup.plantCluster.symmetrical ? 'Symmetrical' : 'Asymmetrical'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateClusterRecipe((prev) => ({
                        ...prev,
                        seed: Math.floor(Math.random() * 90000 + 100),
                      }))
                    }
                    title="Randomize natural sprout arrangement"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 hover:bg-[#20B46A] text-[10px] font-bold"
                  >
                    <Dices size={12} />
                    <span>Reseed</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUngroup(activeClusterGroup.id)}
                    className="px-2 py-1 rounded-lg bg-[#A855F7]/25 hover:bg-[#A855F7] text-[10px] font-bold"
                  >
                    Ungroup
                  </button>
                </div>
              ) : selectedPartIds.length >= 2 ? (
                <div className="flex flex-wrap items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-[#0F1814]/95 border border-white/[0.12] text-white pointer-events-auto shadow-xl">
                  <span className="text-[11px] font-bold text-[#34D399] px-1">
                    {selectedPartIds.length} Selected:
                  </span>
                  <button
                    type="button"
                    onClick={handleGroupSelected}
                    className="px-2.5 py-1 rounded-lg bg-[#A855F7]/80 hover:bg-[#A855F7] text-[11px] font-bold"
                  >
                    Group
                  </button>
                  <button
                    type="button"
                    onClick={handleCombineSelected}
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-[#20B46A] text-[11px] font-bold"
                  >
                    Combine
                  </button>
                  <button
                    type="button"
                    onClick={handleDuplicateSelected}
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-[#38BDF8] text-[11px] font-bold"
                  >
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteSelected}
                    className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white text-[11px] font-bold"
                  >
                    Delete
                  </button>
                </div>
              ) : toolMode === 'select' ? (
                <div className="px-3 py-1 rounded-xl bg-[#0F1814]/85 border border-white/[0.1] text-[11px] font-semibold text-slate-300">
                  Drag box to marquee multi-select leaves &amp; petals · Alt+Click leaf for Cluster Group · Right-drag to orbit
                </div>
              ) : null}
            </div>
          </div>

          {/* RIGHT CONTEXTUAL INSPECTOR */}
          {studioSection === 'flower' ? (
            <aside className="w-[332px] xl:w-[360px] shrink-0 border-l border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#171A23] flex flex-col min-h-0">
              <div className="shrink-0 px-3.5 py-2.5 border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50 dark:bg-[#131720] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flower2 size={14} className="text-[#EC4899]" />
                  <span className="text-xs font-extrabold tracking-tight">Flower Parameters</span>
                </div>
                <span className="text-[11px] font-mono font-bold tabular-nums text-[#EC4899]">
                  {flowerRecipe.petalCount} petals · {flowerRecipe.stemHeight.toFixed(2)}m
                </span>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-4 maker-scroll">
                {/* PETAL SHAPE & COUNT */}
                <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2.5">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB]">
                    Petals
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span>Number of Petals</span>
                      <span className="font-mono tabular-nums text-[#EC4899]">{flowerRecipe.petalCount}</span>
                    </div>
                    <input
                      type="range"
                      min={3}
                      max={18}
                      step={1}
                      value={flowerRecipe.petalCount}
                      onChange={(e) =>
                        updateFlowerRecipe((prev) => ({ ...prev, petalCount: Number(e.target.value) }))
                      }
                      className="w-full accent-[#EC4899]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        ['petalRound', 'Round'],
                        ['petalPointed', 'Pointed'],
                        ['petalRuffled', 'Ruffled'],
                        ['petalOrchid', 'Orchid'],
                      ] as const
                    ).map(([sid, lbl]) => (
                      <button
                        key={sid}
                        type="button"
                        onClick={() => updateFlowerRecipe((prev) => ({ ...prev, petalShape: sid }))}
                        className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-colors whitespace-nowrap ${
                          flowerRecipe.petalShape === sid
                            ? 'bg-[#EC4899] border-[#EC4899] text-white'
                            : 'bg-white dark:bg-[#171A23] border-slate-200/80 dark:border-white/[0.08]'
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="block space-y-0.5">
                      <div className="flex justify-between text-[10px] font-semibold">
                        <span>Length</span>
                        <span className="tabular-nums">{flowerRecipe.petalLength.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min={0.28}
                        max={1.1}
                        step={0.02}
                        value={flowerRecipe.petalLength}
                        onChange={(e) =>
                          updateFlowerRecipe((prev) => ({ ...prev, petalLength: Number(e.target.value) }))
                        }
                        className="w-full accent-[#EC4899]"
                      />
                    </label>
                    <label className="block space-y-0.5">
                      <div className="flex justify-between text-[10px] font-semibold">
                        <span>Width</span>
                        <span className="tabular-nums">{flowerRecipe.petalWidth.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min={0.18}
                        max={0.85}
                        step={0.02}
                        value={flowerRecipe.petalWidth}
                        onChange={(e) =>
                          updateFlowerRecipe((prev) => ({ ...prev, petalWidth: Number(e.target.value) }))
                        }
                        className="w-full accent-[#EC4899]"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <label className="block space-y-0.5">
                      <div className="flex justify-between text-[10px] font-semibold">
                        <span>Cup</span>
                        <span className="tabular-nums">{Math.round(flowerRecipe.petalCup * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={0.85}
                        step={0.05}
                        value={flowerRecipe.petalCup}
                        onChange={(e) =>
                          updateFlowerRecipe((prev) => ({ ...prev, petalCup: Number(e.target.value) }))
                        }
                        className="w-full accent-[#EC4899]"
                      />
                    </label>
                    <label className="block space-y-0.5">
                      <div className="flex justify-between text-[10px] font-semibold">
                        <span>Droop</span>
                        <span className="tabular-nums">{flowerRecipe.petalDroop.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min={-0.4}
                        max={0.55}
                        step={0.02}
                        value={flowerRecipe.petalDroop}
                        onChange={(e) =>
                          updateFlowerRecipe((prev) => ({ ...prev, petalDroop: Number(e.target.value) }))
                        }
                        className="w-full accent-[#EC4899]"
                      />
                    </label>
                    <label className="block space-y-0.5">
                      <div className="flex justify-between text-[10px] font-semibold">
                        <span>Ruffle</span>
                        <span className="tabular-nums">{Math.round(flowerRecipe.petalRuffle * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={0.95}
                        step={0.05}
                        value={flowerRecipe.petalRuffle}
                        onChange={(e) =>
                          updateFlowerRecipe((prev) => ({ ...prev, petalRuffle: Number(e.target.value) }))
                        }
                        className="w-full accent-[#EC4899]"
                      />
                    </label>
                  </div>
                </div>

                {/* COLOR GRADIENT & TEXTURE NOISE */}
                <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB]">
                      Petal Color &amp; Noise
                    </span>
                    <div className="inline-flex rounded-lg bg-white dark:bg-[#171A23] p-0.5 border border-slate-200/80 dark:border-white/[0.08]">
                      {(
                        [
                          ['single', 'Single'],
                          ['gradient', 'Gradient'],
                        ] as const
                      ).map(([m, lbl]) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => updateFlowerRecipe((prev) => ({ ...prev, colorMode: m }))}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            flowerRecipe.colorMode === m
                              ? 'bg-[#EC4899] text-white'
                              : 'text-slate-600 dark:text-[#9FA8BE]'
                          }`}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.08] text-[11px] font-bold cursor-pointer">
                      <span>Base Color</span>
                      <input
                        type="color"
                        value={flowerRecipe.primaryColor}
                        onChange={(e) =>
                          updateFlowerRecipe((prev) => ({ ...prev, primaryColor: e.target.value }))
                        }
                        className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
                      />
                    </label>
                    {flowerRecipe.colorMode === 'gradient' ? (
                      <label className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.08] text-[11px] font-bold cursor-pointer">
                        <span>Tip Blend</span>
                        <input
                          type="color"
                          value={flowerRecipe.secondaryColor}
                          onChange={(e) =>
                            updateFlowerRecipe((prev) => ({
                              ...prev,
                              secondaryColor: e.target.value,
                            }))
                          }
                          className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
                        />
                      </label>
                    ) : (
                      <label className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.08] text-[11px] font-bold cursor-pointer">
                        <span>Stamen</span>
                        <input
                          type="color"
                          value={flowerRecipe.stamenColor}
                          onChange={(e) =>
                            updateFlowerRecipe((prev) => ({ ...prev, stamenColor: e.target.value }))
                          }
                          className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
                        />
                      </label>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 items-center">
                    <select
                      value={flowerRecipe.petalPattern}
                      onChange={(e) =>
                        updateFlowerRecipe((prev) => ({
                          ...prev,
                          petalPattern: e.target.value as PlantLeafPatternId,
                        }))
                      }
                      className="w-full px-2 py-1.5 rounded-xl bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.08] text-[11px] font-bold"
                    >
                      {PLANT_PATTERN_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <label className="block space-y-0.5">
                      <div className="flex justify-between text-[10px] font-semibold">
                        <span>Texture Noise</span>
                        <span className="tabular-nums">{Math.round(flowerRecipe.textureNoise * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={flowerRecipe.textureNoise}
                        onChange={(e) =>
                          updateFlowerRecipe((prev) => ({
                            ...prev,
                            textureNoise: Number(e.target.value),
                          }))
                        }
                        className="w-full accent-[#EC4899]"
                      />
                    </label>
                  </div>
                </div>

                {/* STAMEN CORE */}
                <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB]">
                    Stamen &amp; Core
                  </div>
                  <div className="grid grid-cols-2 gap-2 items-center">
                    <label className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.08] text-[11px] font-bold cursor-pointer">
                      <span>Stamen Color</span>
                      <input
                        type="color"
                        value={flowerRecipe.stamenColor}
                        onChange={(e) =>
                          updateFlowerRecipe((prev) => ({ ...prev, stamenColor: e.target.value }))
                        }
                        className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
                      />
                    </label>
                    <label className="block space-y-0.5">
                      <div className="flex justify-between text-[10px] font-semibold">
                        <span>Core Size</span>
                        <span className="tabular-nums">{flowerRecipe.stamenSize.toFixed(2)}×</span>
                      </div>
                      <input
                        type="range"
                        min={0.45}
                        max={1.8}
                        step={0.05}
                        value={flowerRecipe.stamenSize}
                        onChange={(e) =>
                          updateFlowerRecipe((prev) => ({
                            ...prev,
                            stamenSize: Number(e.target.value),
                          }))
                        }
                        className="w-full accent-[#F59E0B]"
                      />
                    </label>
                  </div>
                </div>

                {/* STEM HEIGHT & LEAVES RANGE */}
                <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2.5">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB]">
                    Stem &amp; Leaf Range
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block space-y-0.5">
                      <div className="flex justify-between text-[10px] font-semibold">
                        <span>Stem Height</span>
                        <span className="tabular-nums">{flowerRecipe.stemHeight.toFixed(2)}m</span>
                      </div>
                      <input
                        type="range"
                        min={0.45}
                        max={2.2}
                        step={0.05}
                        value={flowerRecipe.stemHeight}
                        onChange={(e) =>
                          updateFlowerRecipe((prev) => ({
                            ...prev,
                            stemHeight: Number(e.target.value),
                          }))
                        }
                        className="w-full accent-[#20B46A]"
                      />
                    </label>
                    <label className="block space-y-0.5">
                      <div className="flex justify-between text-[10px] font-semibold">
                        <span>Stem Arch</span>
                        <span className="tabular-nums">{Math.round(flowerRecipe.stemDroop * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={0.65}
                        step={0.02}
                        value={flowerRecipe.stemDroop}
                        onChange={(e) =>
                          updateFlowerRecipe((prev) => ({
                            ...prev,
                            stemDroop: Number(e.target.value),
                          }))
                        }
                        className="w-full accent-[#20B46A]"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.08] text-[11px] font-bold cursor-pointer">
                      <span>Stem Color</span>
                      <input
                        type="color"
                        value={flowerRecipe.stemColor}
                        onChange={(e) =>
                          updateFlowerRecipe((prev) => ({ ...prev, stemColor: e.target.value }))
                        }
                        className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
                      />
                    </label>
                    <label className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.08] text-[11px] font-bold cursor-pointer">
                      <span>Leaf Color</span>
                      <input
                        type="color"
                        value={flowerRecipe.leafColor}
                        onChange={(e) =>
                          updateFlowerRecipe((prev) => ({ ...prev, leafColor: e.target.value }))
                        }
                        className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="block space-y-0.5">
                      <div className="flex justify-between text-[10px] font-semibold">
                        <span>Min Stem Leaves</span>
                        <span className="tabular-nums">{flowerRecipe.leafCountMin}</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={8}
                        step={1}
                        value={flowerRecipe.leafCountMin}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          updateFlowerRecipe((prev) => ({
                            ...prev,
                            leafCountMin: v,
                            leafCountMax: Math.max(v, prev.leafCountMax),
                          }));
                        }}
                        className="w-full accent-[#20B46A]"
                      />
                    </label>
                    <label className="block space-y-0.5">
                      <div className="flex justify-between text-[10px] font-semibold">
                        <span>Max Stem Leaves</span>
                        <span className="tabular-nums">{flowerRecipe.leafCountMax}</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={10}
                        step={1}
                        value={flowerRecipe.leafCountMax}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          updateFlowerRecipe((prev) => ({
                            ...prev,
                            leafCountMax: v,
                            leafCountMin: Math.min(prev.leafCountMin, v),
                          }));
                        }}
                        className="w-full accent-[#20B46A]"
                      />
                    </label>
                  </div>

                  <label className="block space-y-0.5">
                    <div className="flex justify-between text-[10px] font-semibold">
                      <span>Leaf Size</span>
                      <span className="tabular-nums">{flowerRecipe.leafScale.toFixed(2)}×</span>
                    </div>
                    <input
                      type="range"
                      min={0.45}
                      max={1.55}
                      step={0.05}
                      value={flowerRecipe.leafScale}
                      onChange={(e) =>
                        updateFlowerRecipe((prev) => ({ ...prev, leafScale: Number(e.target.value) }))
                      }
                      className="w-full accent-[#20B46A]"
                    />
                  </label>
                </div>
              </div>
            </aside>
          ) : studioSection === 'grass' ? (
            <aside className="w-[332px] xl:w-[360px] shrink-0 border-l border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#171A23] flex flex-col min-h-0">
              <div className="shrink-0 px-3.5 py-2.5 border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50 dark:bg-[#131720] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sprout size={14} className="text-[#20B46A]" />
                  <span className="text-xs font-extrabold tracking-tight">Meadow Parameters</span>
                </div>
                <span className="text-[11px] font-mono font-bold tabular-nums text-[#20B46A]">
                  {grassCfg.enabled && grassCfg.quality !== 'off'
                    ? `LOD ${Math.round(grassCfg.viewDistance)}m`
                    : 'Disabled'}
                </span>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-4 maker-scroll">
                {/* Density Quality */}
                <div className="space-y-2">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB]">
                    Density Tier
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {(
                      [
                        { id: 'off', label: 'Off' },
                        { id: 'light', label: 'Light' },
                        { id: 'lush', label: 'Lush' },
                        { id: 'dense', label: 'Dense' },
                        { id: 'ultra', label: 'Ultra' },
                      ] as { id: GrassQuality; label: string }[]
                    ).map((q) => {
                      const activeQuality: GrassQuality = grassCfg.enabled ? grassCfg.quality : 'off';
                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() =>
                            patchGrassConfig(
                              q.id === 'off'
                                ? { enabled: false, quality: 'off' }
                                : { enabled: true, quality: q.id },
                              true
                            )
                          }
                          className={`py-1.5 rounded-xl text-[10px] font-extrabold border transition-colors ${
                            activeQuality === q.id
                              ? 'border-[#20B46A] bg-[#20B46A] text-white'
                              : 'border-slate-200/80 dark:border-white/[0.06] bg-slate-50 dark:bg-[#12151E] text-slate-600 dark:text-[#9FA8BE]'
                          }`}
                        >
                          {q.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {grassCfg.enabled && grassCfg.quality !== 'off' && (
                  <>
                    {/* Clumpiness & Lushness */}
                    <div className="space-y-2.5 pt-3 border-t border-slate-200/70 dark:border-white/[0.08]">
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB]">
                        Clumpiness &amp; Lushness
                      </div>
                      {(
                        [
                          {
                            key: 'tuftClumpiness',
                            label: 'Tuft Clumpiness',
                            min: 0,
                            max: 1,
                            step: 0.05,
                            fmt: (v: number) => `${Math.round(v * 100)}%`,
                          },
                          {
                            key: 'carexMix',
                            label: 'Tall Carex / Sedge Mix',
                            min: 0,
                            max: 1,
                            step: 0.05,
                            fmt: (v: number) => `${Math.round(v * 100)}%`,
                          },
                          {
                            key: 'bladeHeight',
                            label: 'Blade Height',
                            min: 0.35,
                            max: 1.45,
                            step: 0.05,
                            fmt: (v: number) => `${v.toFixed(2)}m`,
                          },
                          {
                            key: 'bladeWidth',
                            label: 'Blade Width',
                            min: 0.05,
                            max: 0.18,
                            step: 0.01,
                            fmt: (v: number) => `${v.toFixed(2)}m`,
                          },
                        ] as const
                      ).map((ctl) => {
                        const val = Number(
                          (grassCfg as unknown as Record<string, number>)[ctl.key] ?? 0.5
                        );
                        return (
                          <div key={ctl.key} className="space-y-0.5">
                            <div className="flex items-center justify-between text-[11px] font-semibold">
                              <span>{ctl.label}</span>
                              <span className="font-mono tabular-nums text-slate-500 dark:text-[#949BB0]">
                                {ctl.fmt(val)}
                              </span>
                            </div>
                            <input
                              type="range"
                              min={ctl.min}
                              max={ctl.max}
                              step={ctl.step}
                              value={val}
                              onChange={(e) =>
                                patchGrassConfig({ [ctl.key]: Number(e.target.value) })
                              }
                              className="w-full accent-[#20B46A]"
                            />
                          </div>
                        );
                      })}
                    </div>

                    {/* Dual-Tone Color & Lighting */}
                    <div className="space-y-2.5 pt-3 border-t border-slate-200/70 dark:border-white/[0.08]">
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB]">
                        Dual-Tone Colors &amp; Motion
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.06] text-[11px] font-bold">
                          <span>Primary</span>
                          <input
                            type="color"
                            value={grassCfg.primaryColor ?? '#54B049'}
                            onChange={(e) => patchGrassConfig({ primaryColor: e.target.value })}
                            className="w-7 h-5 rounded cursor-pointer border-0 bg-transparent"
                          />
                        </label>
                        <label className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.06] text-[11px] font-bold">
                          <span>Secondary</span>
                          <input
                            type="color"
                            value={grassCfg.secondaryColor ?? '#98D954'}
                            onChange={(e) => patchGrassConfig({ secondaryColor: e.target.value })}
                            className="w-7 h-5 rounded cursor-pointer border-0 bg-transparent"
                          />
                        </label>
                      </div>

                      {(
                        [
                          {
                            key: 'mixNoiseScale',
                            label: 'Dual-Tone Mix Scale',
                            min: 0.2,
                            max: 3,
                            step: 0.1,
                            fmt: (v: number) => `${v.toFixed(1)}×`,
                          },
                          {
                            key: 'windWaveStrength',
                            label: 'Wind Wave Flow',
                            min: 0.2,
                            max: 2.0,
                            step: 0.1,
                            fmt: (v: number) => `${Math.round(v * 100)}%`,
                          },
                          {
                            key: 'tipGlow',
                            label: 'Tip Sun Glow',
                            min: 0,
                            max: 1.2,
                            step: 0.05,
                            fmt: (v: number) => `${Math.round(v * 100)}%`,
                          },
                          {
                            key: 'viewDistance',
                            label: 'View Distance LOD',
                            min: 30,
                            max: 85,
                            step: 2,
                            fmt: (v: number) => `${Math.round(v)}m`,
                          },
                        ] as const
                      ).map((ctl) => {
                        const val = Number(
                          (grassCfg as unknown as Record<string, number>)[ctl.key] ?? 0.5
                        );
                        return (
                          <div key={ctl.key} className="space-y-0.5">
                            <div className="flex items-center justify-between text-[11px] font-semibold">
                              <span>{ctl.label}</span>
                              <span className="font-mono tabular-nums text-slate-500 dark:text-[#949BB0]">
                                {ctl.fmt(val)}
                              </span>
                            </div>
                            <input
                              type="range"
                              min={ctl.min}
                              max={ctl.max}
                              step={ctl.step}
                              value={val}
                              onChange={(e) =>
                                patchGrassConfig({ [ctl.key]: Number(e.target.value) })
                              }
                              className="w-full accent-[#20B46A]"
                            />
                          </div>
                        );
                      })}

                      <label className="flex items-center justify-between text-[11px] font-bold cursor-pointer pt-1">
                        <span>Part grass around hero</span>
                        <input
                          type="checkbox"
                          checked={grassCfg.interactiveParting}
                          onChange={(e) =>
                            patchGrassConfig({ interactiveParting: e.target.checked }, true)
                          }
                          className="accent-[#20B46A]"
                        />
                      </label>
                    </div>
                  </>
                )}
              </div>
            </aside>
          ) : (
            <aside className="w-[332px] xl:w-[360px] shrink-0 border-l border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#171A23] flex flex-col min-h-0">
            <div className="shrink-0 p-2 border-b border-slate-200/80 dark:border-white/[0.08] grid grid-cols-4 gap-1 bg-slate-50 dark:bg-[#131720]">
              <button
                type="button"
                onClick={() => setInspectorTab('cluster')}
                className={`py-1.5 px-1.5 rounded-lg text-[10px] font-extrabold inline-flex items-center justify-center gap-1 transition-colors whitespace-nowrap ${
                  inspectorTab === 'cluster'
                    ? 'bg-[#20B46A] text-white'
                    : 'text-slate-600 dark:text-[#A5AEC4] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Flower2 size={12} />
                <span>Cluster</span>
              </button>
              <button
                type="button"
                onClick={() => setInspectorTab('shape')}
                className={`py-1.5 px-1.5 rounded-lg text-[10px] font-extrabold inline-flex items-center justify-center gap-1 transition-colors whitespace-nowrap ${
                  inspectorTab === 'shape'
                    ? 'bg-[#20B46A] text-white'
                    : 'text-slate-600 dark:text-[#A5AEC4] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Leaf size={12} />
                <span>Shape</span>
              </button>
              <button
                type="button"
                onClick={() => setInspectorTab('pattern')}
                className={`py-1.5 px-1.5 rounded-lg text-[10px] font-extrabold inline-flex items-center justify-center gap-1 transition-colors whitespace-nowrap ${
                  inspectorTab === 'pattern'
                    ? 'bg-[#20B46A] text-white'
                    : 'text-slate-600 dark:text-[#A5AEC4] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Sparkles size={12} />
                <span>Pattern</span>
              </button>
              <button
                type="button"
                onClick={() => setInspectorTab('paint')}
                className={`py-1.5 px-1.5 rounded-lg text-[10px] font-extrabold inline-flex items-center justify-center gap-1 transition-colors whitespace-nowrap ${
                  inspectorTab === 'paint'
                    ? 'bg-[#EC4899] text-white'
                    : 'text-slate-600 dark:text-[#A5AEC4] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Paintbrush size={12} />
                <span>Paint{paintStrokes.length > 0 ? ` (${paintStrokes.length})` : ''}</span>
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-4 maker-scroll">
              {/* TAB 1: FAN & CENTER CLUSTER BUILDER (1..20 SLIDER) */}
              {inspectorTab === 'cluster' && (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#20B46A]">
                        {activeClusterGroup
                          ? `Editing: ${activeClusterGroup.name}`
                          : 'New Center Fan Generator'}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-[#949BB0]">
                        {activeClusterGroup
                          ? 'Changes update leaves/petals fanning from center live.'
                          : 'Configure leaf/petal fanning below, then spawn into the plant.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSpawnNewCluster()}
                      className="px-2.5 py-1.5 rounded-xl bg-[#20B46A] hover:opacity-95 text-white text-[11px] font-extrabold inline-flex items-center gap-1 shrink-0 whitespace-nowrap"
                    >
                      <Plus size={12} />
                      <span>{activeClusterGroup ? 'Add Layer' : 'Spawn Fan'}</span>
                    </button>
                  </div>

                  {/* Count Slider 1 to 20 */}
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.08] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold">Cluster Limit / Count</span>
                      <span className="font-mono text-sm font-extrabold tabular-nums text-[#20B46A]">
                        {activeClusterRecipe.count} / 20
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={20}
                      step={1}
                      value={activeClusterRecipe.count}
                      onChange={(e) =>
                        updateClusterRecipe((prev) => ({
                          ...prev,
                          count: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-[#20B46A]"
                    />
                    <div className="flex justify-between text-[10px] font-bold text-slate-400">
                      <span>1</span>
                      <span>5</span>
                      <span>10</span>
                      <span>15</span>
                      <span>20</span>
                    </div>
                  </div>

                  {/* Leaf / Petal / Fantasy Shape Picker */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB]">
                      Leaf / Petal / Fantasy Shape
                    </div>
                    <select
                      value={activeClusterRecipe.shape}
                      onChange={(e) => {
                        const nextShape = e.target.value as PlantShapeId;
                        const meta = getPlantShapeMeta(nextShape);
                        updateClusterRecipe((prev) => ({
                          ...prev,
                          target:
                            meta.category === 'petal'
                              ? 'petal'
                              : meta.category === 'fantasy'
                              ? 'fantasy'
                              : 'leaf',
                          shape: nextShape,
                          baseDimensions: [...meta.defaultSize] as [number, number, number],
                          baseColor: meta.defaultColor,
                          includeFlowerCore:
                            meta.category === 'petal' ? true : prev.includeFlowerCore,
                          basePlant: {
                            ...prev.basePlant,
                            pattern: meta.defaultPattern,
                            accentColor: meta.defaultAccentColor,
                            tipColor: meta.defaultTipColor,
                            emissiveColor:
                              (meta.defaultEmissiveIntensity ?? 0) > 0
                                ? meta.defaultAccentColor
                                : '#000000',
                            emissiveIntensity: meta.defaultEmissiveIntensity ?? 0,
                            droop: meta.defaultDroop,
                            cup: meta.defaultCup,
                            ruffle: meta.defaultRuffle,
                            asymSkew: meta.defaultAsymSkew ?? 0,
                          },
                        }));
                      }}
                      className="w-full px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.08] text-xs font-bold"
                    >
                      {CLUSTER_SHAPE_IDS.map((sid) => {
                        const m = getPlantShapeMeta(sid);
                        return (
                          <option key={sid} value={sid}>
                            {m.label} ({m.category})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Fanning Arrangement & Symmetry */}
                  <div className="space-y-2 pt-2 border-t border-slate-200/70 dark:border-white/[0.08]">
                    <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB]">
                      Grouping from Center
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {(
                        [
                          ['fan', 'Fan Out'],
                          ['randomCenter', 'Random Center'],
                          ['spiral', 'Spiral'],
                        ] as [PlantClusterLayout, string][]
                      ).map(([mode, lbl]) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() =>
                            updateClusterRecipe((prev) => ({ ...prev, layout: mode }))
                          }
                          className={`py-1.5 px-1.5 rounded-lg text-[10px] font-extrabold transition-colors ${
                            activeClusterRecipe.layout === mode
                              ? 'bg-[#20B46A] text-white'
                              : 'bg-slate-100 dark:bg-[#12151E] text-slate-600 dark:text-[#A5AEC4]'
                          }`}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          updateClusterRecipe((prev) => ({
                            ...prev,
                            symmetrical: true,
                          }))
                        }
                        className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold ${
                          activeClusterRecipe.symmetrical
                            ? 'bg-[#38BDF8] text-slate-950'
                            : 'bg-slate-100 dark:bg-[#12151E] text-slate-500 dark:text-[#9FA8BE]'
                        }`}
                      >
                        Symmetrical
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateClusterRecipe((prev) => ({
                            ...prev,
                            symmetrical: false,
                          }))
                        }
                        className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold ${
                          !activeClusterRecipe.symmetrical
                            ? 'bg-[#A855F7] text-white'
                            : 'bg-slate-100 dark:bg-[#12151E] text-slate-500 dark:text-[#9FA8BE]'
                        }`}
                      >
                        Asymmetrical / Wild
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateClusterRecipe((prev) => ({
                            ...prev,
                            seed: Math.floor(Math.random() * 90000 + 100),
                          }))
                        }
                        title="Reseed random placement"
                        className="p-1.5 rounded-lg bg-slate-100 dark:bg-[#1F2430] hover:bg-[#20B46A] hover:text-white"
                      >
                        <Dices size={14} />
                      </button>
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between text-[11px] font-semibold">
                        <span>Organic Randomness</span>
                        <span className="font-mono">{Math.round(activeClusterRecipe.randomness * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.02}
                        value={activeClusterRecipe.randomness}
                        onChange={(e) =>
                          updateClusterRecipe((prev) => ({
                            ...prev,
                            randomness: Number(e.target.value),
                          }))
                        }
                        className="w-full accent-[#A855F7]"
                      />
                    </div>
                  </div>

                  {/* Fan Angle, Arc Span, Center Spread, Height & Tiers */}
                  <div className="space-y-2.5 pt-2 border-t border-slate-200/70 dark:border-white/[0.08]">
                    <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB]">
                      Fan Geometry &amp; Spread
                    </div>

                    {[
                      {
                        label: 'Fan Tilt Angle',
                        value: activeClusterRecipe.fanAngleDeg,
                        min: 8,
                        max: 86,
                        step: 1,
                        unit: '°',
                        onChange: (v: number) =>
                          updateClusterRecipe((prev) => ({ ...prev, fanAngleDeg: v })),
                      },
                      {
                        label: 'Arc Span',
                        value: activeClusterRecipe.arcSpanDeg,
                        min: 45,
                        max: 360,
                        step: 5,
                        unit: '°',
                        onChange: (v: number) =>
                          updateClusterRecipe((prev) => ({ ...prev, arcSpanDeg: v })),
                      },
                      {
                        label: 'Center Radius',
                        value: activeClusterRecipe.centerRadius,
                        min: 0,
                        max: 0.65,
                        step: 0.01,
                        unit: 'm',
                        onChange: (v: number) =>
                          updateClusterRecipe((prev) => ({ ...prev, centerRadius: v })),
                      },
                      {
                        label: 'Hub Height (Y)',
                        value: activeClusterRecipe.hubHeight,
                        min: 0,
                        max: 2.4,
                        step: 0.02,
                        unit: 'm',
                        onChange: (v: number) =>
                          updateClusterRecipe((prev) => ({ ...prev, hubHeight: v })),
                      },
                    ].map((ctl) => (
                      <div key={ctl.label} className="space-y-0.5">
                        <div className="flex items-center justify-between text-[11px] font-semibold">
                          <span>{ctl.label}</span>
                          <span className="font-mono tabular-nums text-slate-500 dark:text-[#949BB0]">
                            {ctl.step < 1 ? ctl.value.toFixed(2) : Math.round(ctl.value)}
                            {ctl.unit}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={ctl.min}
                          max={ctl.max}
                          step={ctl.step}
                          value={ctl.value}
                          onChange={(e) => ctl.onChange(Number(e.target.value))}
                          className="w-full accent-[#20B46A]"
                        />
                      </div>
                    ))}

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-0.5">
                        <div className="flex justify-between text-[10px] font-semibold">
                          <span>Min Size</span>
                          <span className="font-mono">{activeClusterRecipe.minScale.toFixed(2)}×</span>
                        </div>
                        <input
                          type="range"
                          min={0.3}
                          max={1.4}
                          step={0.05}
                          value={activeClusterRecipe.minScale}
                          onChange={(e) =>
                            updateClusterRecipe((prev) => ({
                              ...prev,
                              minScale: Math.min(Number(e.target.value), prev.maxScale),
                            }))
                          }
                          className="w-full accent-[#20B46A]"
                        />
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex justify-between text-[10px] font-semibold">
                          <span>Max Size</span>
                          <span className="font-mono">{activeClusterRecipe.maxScale.toFixed(2)}×</span>
                        </div>
                        <input
                          type="range"
                          min={0.4}
                          max={1.8}
                          step={0.05}
                          value={activeClusterRecipe.maxScale}
                          onChange={(e) =>
                            updateClusterRecipe((prev) => ({
                              ...prev,
                              maxScale: Math.max(Number(e.target.value), prev.minScale),
                            }))
                          }
                          className="w-full accent-[#20B46A]"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-[11px] font-semibold">Tier Layers</span>
                      <div className="grid grid-cols-3 gap-1 w-32">
                        {[1, 2, 3].map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() =>
                              updateClusterRecipe((prev) => ({ ...prev, tierLayers: t }))
                            }
                            className={`py-1 rounded-md text-[11px] font-bold ${
                              (activeClusterRecipe.tierLayers ?? 1) === t
                                ? 'bg-[#20B46A] text-white'
                                : 'bg-slate-100 dark:bg-[#12151E] text-slate-500'
                            }`}
                          >
                            {t}L
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Base W / H / D per element */}
                    <div className="grid grid-cols-3 gap-1.5 pt-1">
                      {(['Width', 'Arch H', 'Length'] as const).map((lbl, idx) => (
                        <label key={lbl} className="space-y-0.5 text-[10px] font-bold text-slate-500 dark:text-[#949BB0]">
                          <span>{lbl}</span>
                          <input
                            type="number"
                            min={0.08}
                            max={4}
                            step={0.04}
                            value={activeClusterRecipe.baseDimensions[idx]}
                            onChange={(e) => {
                              const v = Math.max(0.08, Number(e.target.value) || 0.08);
                              updateClusterRecipe((prev) => {
                                const nextDims = [...prev.baseDimensions] as [number, number, number];
                                nextDims[idx] = v;
                                return { ...prev, baseDimensions: nextDims };
                              });
                            }}
                            className="w-full px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.08] font-mono text-xs text-slate-900 dark:text-white"
                          />
                        </label>
                      ))}
                    </div>

                    {/* Flower Stamen Core Toggle */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <label className="inline-flex items-center gap-1.5 text-[11px] font-bold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(activeClusterRecipe.includeFlowerCore)}
                          onChange={(e) =>
                            updateClusterRecipe((prev) => ({
                              ...prev,
                              includeFlowerCore: e.target.checked,
                            }))
                          }
                          className="accent-[#F59E0B]"
                        />
                        <span>Include Flower Stamen Core</span>
                      </label>
                      {activeClusterRecipe.includeFlowerCore && (
                        <input
                          type="color"
                          value={activeClusterRecipe.coreColor || '#F59E0B'}
                          onChange={(e) =>
                            updateClusterRecipe((prev) => ({
                              ...prev,
                              coreColor: e.target.value,
                            }))
                          }
                          className="w-8 h-6 rounded cursor-pointer border-0 bg-transparent"
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: INDIVIDUAL LEAF / PETAL SCULPT + VINE CURVE GUIDE */}
              {inspectorTab === 'shape' && (
                <>
                  {primaryPart ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          value={primaryPart.name}
                          onChange={(e) =>
                            updateTargetParts((p) => ({ ...p, name: e.target.value }))
                          }
                          className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.08] text-xs font-extrabold"
                        />
                        <button
                          type="button"
                          onClick={handleDropSelectedToFloor}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1F2430] hover:bg-[#20B46A] hover:text-white text-[11px] font-bold whitespace-nowrap transition-colors"
                        >
                          Floor Y=0
                        </button>
                      </div>

                      {primaryPart.shape !== 'csgResult' && (
                        <div className="space-y-1">
                          <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB]">
                            Botanical Form
                          </div>
                          <select
                            value={primaryPart.shape}
                            onChange={(e) => {
                              const nextShape = e.target.value as PlantShapeId;
                              updateTargetParts((p) => ({ ...p, shape: nextShape }));
                            }}
                            className="w-full px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.08] text-xs font-bold"
                          >
                            {PLANT_SHAPE_CATALOG.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Dimensions */}
                      <div className="space-y-1">
                        <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB]">
                          Size (Meters)
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(['Width X', 'Arch / H', 'Length Z'] as const).map((lbl, idx) => (
                            <label key={lbl} className="space-y-0.5 text-[10px] font-bold text-slate-500 dark:text-[#949BB0]">
                              <span>{lbl}</span>
                              <input
                                type="number"
                                min={0.05}
                                max={12}
                                step={0.04}
                                disabled={primaryPart.shape === 'csgResult'}
                                value={primaryPart.dimensions[idx]}
                                onChange={(e) => {
                                  const val = Math.max(0.05, Number(e.target.value) || 0.05);
                                  updateTargetParts((p) => {
                                    const next = [...p.dimensions] as [number, number, number];
                                    next[idx] = val;
                                    return { ...p, dimensions: next };
                                  });
                                }}
                                className="w-full px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.08] font-mono text-xs text-slate-900 dark:text-white disabled:opacity-50"
                              />
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Botanical Sculpting Controls */}
                      {primaryPart.shape !== 'csgResult' && (
                        <div className="space-y-2 pt-2 border-t border-slate-200/70 dark:border-white/[0.08]">
                          <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB]">
                            Organic Bend &amp; Asymmetry
                          </div>
                          {(
                            [
                              ['droop', 'Droop / Curl', -1, 1, primaryPart.plantParams?.droop ?? 0.3],
                              ['cup', 'Cup / V-Fold', 0, 1, primaryPart.plantParams?.cup ?? 0.3],
                              ['ruffle', 'Edge Ruffle', 0, 1, primaryPart.plantParams?.ruffle ?? 0.12],
                              ['twist', 'Helix Twist', -1, 1, primaryPart.plantParams?.twist ?? 0],
                              ['asymSkew', 'Asymmetry Skew', -1, 1, primaryPart.plantParams?.asymSkew ?? 0],
                              ['tatter', 'Natural Split / Tatter', 0, 1, primaryPart.plantParams?.tatter ?? 0],
                              ['veinDepth', 'Rib / Vein Relief', 0, 1, primaryPart.plantParams?.veinDepth ?? 0.45],
                            ] as [keyof PlantPartConfig, string, number, number, number][]
                          ).map(([key, label, minV, maxV, val]) => (
                            <div key={key} className="space-y-0.5">
                              <div className="flex items-center justify-between text-[11px] font-semibold">
                                <span>{label}</span>
                                <span className="font-mono tabular-nums text-slate-500 dark:text-[#949BB0]">
                                  {Math.round(val * 100)}%
                                </span>
                              </div>
                              <input
                                type="range"
                                min={minV}
                                max={maxV}
                                step={0.02}
                                value={val}
                                onChange={(e) => {
                                  const v = Number(e.target.value);
                                  updateTargetParts((p) => ({
                                    ...p,
                                    plantParams: { ...p.plantParams, [key]: v },
                                  }));
                                }}
                                className="w-full accent-[#20B46A]"
                              />
                            </div>
                          ))}

                          <label className="inline-flex items-center gap-2 text-[11px] font-bold pt-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={primaryPart.plantParams?.doubleSided !== false}
                              onChange={(e) =>
                                updateTargetParts((p) => ({
                                  ...p,
                                  plantParams: {
                                    ...p.plantParams,
                                    doubleSided: e.target.checked,
                                  },
                                }))
                              }
                              className="accent-[#20B46A]"
                            />
                            <span>Double-Sided Leaf / Petal</span>
                          </label>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 dark:border-white/[0.14] p-4 text-center text-xs text-slate-500 dark:text-[#8E96AB]">
                      Select a leaf, petal, or cluster group in the 3D scene to sculpt curl, cup, ruffle, asymmetry, or natural splits.
                    </div>
                  )}

                  {/* Vine Curve Guide Section */}
                  <div className="space-y-2.5 pt-3 border-t border-slate-200/80 dark:border-white/[0.08]">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#20B46A] inline-flex items-center gap-1">
                        <Spline size={12} />
                        <span>Vine &amp; Branch Curve</span>
                      </span>
                      <label className="inline-flex items-center gap-1.5 text-[11px] font-bold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={curveEnabled}
                          onChange={(e) => {
                            setCurveEnabled(e.target.checked);
                            if (e.target.checked && activeCurvePtIdx === null) {
                              setActiveCurvePtIdx(0);
                            }
                          }}
                          className="accent-[#20B46A]"
                        />
                        <span>Show Curve</span>
                      </label>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {CURVE_PRESET_LABELS.map((cp) => (
                        <button
                          key={cp.id}
                          type="button"
                          onClick={() => handleSelectCurvePreset(cp.id)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                            curveCfg.preset === cp.id && curveEnabled
                              ? 'bg-[#20B46A] text-white'
                              : 'bg-slate-100 dark:bg-[#12151E] text-slate-600 dark:text-[#A5AEC4]'
                          }`}
                        >
                          {cp.label}
                        </button>
                      ))}
                    </div>

                    {curveEnabled && (
                      <div className="space-y-2 p-2.5 rounded-xl bg-slate-50 dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.08]">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-[#949BB0]">
                          <span>Len: {curveLength.toFixed(2)}m · {curveCfg.points.length} pts</span>
                          <button
                            type="button"
                            onClick={() => {
                              const last = curveCfg.points[curveCfg.points.length - 1] ?? [0, 0.3, 0];
                              setCurveCfg((prev) => ({
                                ...prev,
                                preset: 'free',
                                points: [...prev.points, [last[0] + 0.65, last[1] + 0.15, last[2]]],
                              }));
                              setActiveCurvePtIdx(curveCfg.points.length);
                            }}
                            className="text-[#20B46A] font-bold hover:underline"
                          >
                            + Add Point
                          </button>
                        </div>

                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between text-[10px] font-bold">
                            <span>Vine Arch / Lift</span>
                            <span className="font-mono">{curveCfg.elevationArch.toFixed(2)}m</span>
                          </div>
                          <input
                            type="range"
                            min={-1.5}
                            max={2.8}
                            step={0.05}
                            value={curveCfg.elevationArch}
                            onChange={(e) =>
                              setCurveCfg((prev) => ({
                                ...prev,
                                elevationArch: Number(e.target.value),
                              }))
                            }
                            className="w-full accent-[#20B46A]"
                          />
                        </div>

                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between text-[10px] font-bold">
                            <span>Vine Stem Radius</span>
                            <span className="font-mono">{curveSweepWidth.toFixed(2)}m</span>
                          </div>
                          <input
                            type="range"
                            min={0.02}
                            max={0.35}
                            step={0.01}
                            value={curveSweepWidth}
                            onChange={(e) => setCurveSweepWidth(Number(e.target.value))}
                            className="w-full accent-[#20B46A]"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSweepVineAlongCurve('tube')}
                            className="py-1.5 rounded-lg bg-[#20B46A]/15 hover:bg-[#20B46A] text-[#20B46A] hover:text-white text-[10px] font-extrabold transition-colors"
                          >
                            Sweep Vine Stem
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSweepVineAlongCurve('ribbon')}
                            className="py-1.5 rounded-lg bg-[#20B46A]/15 hover:bg-[#20B46A] text-[#20B46A] hover:text-white text-[10px] font-extrabold transition-colors"
                          >
                            Sweep Ribbon
                          </button>
                        </div>

                        <div className="pt-1.5 border-t border-slate-200/70 dark:border-white/[0.06] flex items-center gap-2">
                          <input
                            type="range"
                            min={3}
                            max={20}
                            step={1}
                            value={curveArrayCount}
                            onChange={(e) => setCurveArrayCount(Number(e.target.value))}
                            className="flex-1 accent-[#A855F7]"
                          />
                          <button
                            type="button"
                            onClick={handleArrayLeavesAlongCurve}
                            className="px-2.5 py-1 rounded-lg bg-[#A855F7] text-white text-[10px] font-extrabold whitespace-nowrap"
                          >
                            Sprout ×{curveArrayCount} Leaves
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* TAB 3: BOTANICAL PATTERNS, PALETTES & FANTASY BIOLUMINESCENCE */}
              {inspectorTab === 'pattern' && (
                <>
                  {selectedParts.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 dark:border-white/[0.14] p-4 text-center text-xs text-slate-500 dark:text-[#8E96AB]">
                      Select a leaf, petal, or cluster group to apply veins, stripes, variegation, spots, or bioluminescent glow.
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      <div className="text-xs font-bold text-slate-600 dark:text-[#C8D0E4]">
                        {activeClusterGroup && selectedGroupId === activeClusterGroup.id
                          ? `Cluster Material: ${activeClusterGroup.name} (${selectedParts.length} parts)`
                          : `Applying to ${selectedParts.length} selected ${selectedParts.length === 1 ? 'part' : 'parts'}`}
                      </div>

                      {/* Color Palettes */}
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB]">
                          Botanical &amp; Fantasy Palettes
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {PLANT_COLOR_PALETTES.map((pal) => (
                            <button
                              key={pal.id}
                              type="button"
                              onClick={() =>
                                applyPatternAndColors({
                                  baseColor: pal.base,
                                  accentColor: pal.accent,
                                  tipColor: pal.tip,
                                  ...(pal.emissive
                                    ? {
                                        pattern: 'bioluminescent',
                                        emissiveColor: pal.emissive,
                                        emissiveIntensity: 0.65,
                                      }
                                    : {}),
                                })
                              }
                              className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-slate-50 dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.08] hover:border-[#20B46A] text-left transition-colors"
                            >
                              <div className="flex items-center -space-x-1 shrink-0">
                                <span
                                  className="w-3.5 h-3.5 rounded-full border border-black/25"
                                  style={{ backgroundColor: pal.base }}
                                />
                                <span
                                  className="w-3.5 h-3.5 rounded-full border border-black/25"
                                  style={{ backgroundColor: pal.accent }}
                                />
                                <span
                                  className="w-3.5 h-3.5 rounded-full border border-black/25"
                                  style={{ backgroundColor: pal.tip }}
                                />
                              </div>
                              <span className="text-[11px] font-bold truncate">{pal.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Procedural Leaf / Petal Pattern Picker */}
                      <div className="space-y-1.5 pt-2 border-t border-slate-200/70 dark:border-white/[0.08]">
                        <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB]">
                          Leaf &amp; Petal Pattern
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {PLANT_PATTERN_OPTIONS.map((opt) => {
                            const active = activeFinishState.pattern === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() =>
                                  applyPatternAndColors({
                                    pattern: opt.id,
                                    ...(opt.id === 'bioluminescent' &&
                                    activeFinishState.emissiveIntensity < 0.2
                                      ? { emissiveIntensity: 0.6 }
                                      : {}),
                                  })
                                }
                                title={opt.blurb}
                                className={`px-2.5 py-1.5 rounded-xl border text-left transition-colors ${
                                  active
                                    ? 'border-[#20B46A] bg-[#20B46A]/15 text-[#20B46A]'
                                    : 'border-slate-200/80 dark:border-white/[0.08] bg-slate-50 dark:bg-[#12151E]'
                                }`}
                              >
                                <div className="text-[11px] font-extrabold">{opt.label}</div>
                                <div className="text-[9px] text-slate-500 dark:text-[#8E96AB] truncate">
                                  {opt.blurb}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Color Pickers */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/70 dark:border-white/[0.08]">
                        <label className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-[#12151E] text-[11px] font-bold">
                          <span>Base</span>
                          <input
                            type="color"
                            value={activeFinishState.color}
                            onChange={(e) => applyPatternAndColors({ baseColor: e.target.value })}
                            className="w-7 h-5 rounded cursor-pointer border-0 bg-transparent"
                          />
                        </label>
                        <label className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-[#12151E] text-[11px] font-bold">
                          <span>Veins / Spots</span>
                          <input
                            type="color"
                            value={activeFinishState.accentColor}
                            onChange={(e) => applyPatternAndColors({ accentColor: e.target.value })}
                            className="w-7 h-5 rounded cursor-pointer border-0 bg-transparent"
                          />
                        </label>
                        <label className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-[#12151E] text-[11px] font-bold">
                          <span>Tip Blush</span>
                          <input
                            type="color"
                            value={activeFinishState.tipColor}
                            onChange={(e) => applyPatternAndColors({ tipColor: e.target.value })}
                            className="w-7 h-5 rounded cursor-pointer border-0 bg-transparent"
                          />
                        </label>
                        <label className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-[#12151E] text-[11px] font-bold">
                          <span>Glow Color</span>
                          <input
                            type="color"
                            value={activeFinishState.emissiveColor}
                            onChange={(e) =>
                              applyPatternAndColors({ emissiveColor: e.target.value })
                            }
                            className="w-7 h-5 rounded cursor-pointer border-0 bg-transparent"
                          />
                        </label>
                      </div>

                      {/* Sheen & Fantasy Bioluminescence */}
                      <div className="space-y-2 pt-2 border-t border-slate-200/70 dark:border-white/[0.08]">
                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between text-[11px] font-semibold">
                            <span className="inline-flex items-center gap-1">
                              <Sparkles size={11} className="text-[#38BDF8]" />
                              <span>Fantasy Bio-Glow</span>
                            </span>
                            <span className="font-mono">
                              {activeFinishState.emissiveIntensity.toFixed(2)}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={1.5}
                            step={0.04}
                            value={activeFinishState.emissiveIntensity}
                            onChange={(e) =>
                              applyPatternAndColors({
                                emissiveIntensity: Number(e.target.value),
                              })
                            }
                            className="w-full accent-[#38BDF8]"
                          />
                        </div>

                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between text-[11px] font-semibold">
                            <span>Waxy Sheen ↔ Velvety Matte</span>
                            <span className="font-mono">{activeFinishState.roughness.toFixed(2)}</span>
                          </div>
                          <input
                            type="range"
                            min={0.12}
                            max={0.95}
                            step={0.02}
                            value={activeFinishState.roughness}
                            onChange={(e) =>
                              applyPatternAndColors({ roughness: Number(e.target.value) })
                            }
                            className="w-full accent-[#20B46A]"
                          />
                        </div>
                      </div>

                      {/* Weathering */}
                      <div className="space-y-2 pt-2 border-t border-slate-200/70 dark:border-white/[0.08]">
                        <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB] inline-flex items-center gap-1">
                          <Wand2 size={11} className="text-[#20B46A]" />
                          <span>Dew, Moss &amp; Weathering</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {WEATHERING_PRESETS.map((wp) => {
                            const active = activeFinishState.weathering === wp.id;
                            return (
                              <button
                                key={wp.id}
                                type="button"
                                onClick={() =>
                                  applyPatternAndColors({ weathering: wp.id })
                                }
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                                  active
                                    ? 'bg-[#20B46A] text-white'
                                    : 'bg-slate-100 dark:bg-[#12151E] text-slate-600 dark:text-[#A5AEC4]'
                                }`}
                              >
                                {wp.label}
                              </button>
                            );
                          })}
                        </div>
                        {activeFinishState.weathering !== 'none' && (
                          <div className="space-y-0.5">
                            <div className="flex items-center justify-between text-[10px] font-semibold">
                              <span>Weathering Blend</span>
                              <span className="font-mono">
                                {Math.round(activeFinishState.weatheringIntensity * 100)}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min={0.05}
                              max={1}
                              step={0.02}
                              value={activeFinishState.weatheringIntensity}
                              onChange={(e) =>
                                applyPatternAndColors({
                                  weatheringIntensity: Number(e.target.value),
                                })
                              }
                              className="w-full accent-[#20B46A]"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* TAB 4: EMBEDDED 3D VERTEX PAINT */}
              {inspectorTab === 'paint' && (
                <VertexPaintInspector
                  brush={paintBrush}
                  onChangeBrush={setPaintBrush}
                  interactionTool={paintTool}
                  onChangeInteractionTool={setPaintTool}
                  strokeCount={paintStrokes.length}
                  canRedo={paintRedoStack.length > 0}
                  showPartTargets
                  partTargetLabels={{
                    all: 'All Parts',
                    leaves: 'Leaves & Petals',
                    branches: 'Stems & Roots',
                  }}
                  accentColor="#20B46A"
                  onUndoStroke={() => {
                    setPaintStrokes((prev) => {
                      if (prev.length === 0) return prev;
                      const popped = prev[prev.length - 1];
                      setPaintRedoStack((r) => [...r, popped]);
                      return prev.slice(0, -1);
                    });
                  }}
                  onRedoStroke={() => {
                    setPaintRedoStack((stack) => {
                      if (stack.length === 0) return stack;
                      const restored = stack[stack.length - 1];
                      setPaintStrokes((prev) => [...prev, restored]);
                      return stack.slice(0, -1);
                    });
                  }}
                  onClearAllPaint={() => {
                    setPaintStrokes([]);
                    setPaintRedoStack([]);
                    flashToast('Cleared vertex paint strokes');
                  }}
                  onAutoDapple={() => {
                    const root = studioRef.current?.objectRootHolder.children[0];
                    if (!root) return;
                    const stroke = generateOrganicDappleStroke(
                      root,
                      paintBrush,
                      Math.floor(Math.random() * 900000) + 100
                    );
                    if (stroke) {
                      setPaintStrokes((prev) => [...prev, stroke]);
                      setPaintRedoStack([]);
                      flashToast('Added botanical leaf dapple');
                    }
                  }}
                />
              )}
            </div>
          </aside>
          )}
        </div>
      </div>
    </div>
  );
};
