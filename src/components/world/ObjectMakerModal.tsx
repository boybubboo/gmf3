import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { WebGPURenderer } from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import {
  ArrowLeftRight,
  Bookmark,
  BookmarkPlus,
  Box,
  Check,
  ChevronDown,
  Copy,
  Download,
  Eye,
  EyeOff,
  FolderOpen,
  GitBranch,
  Group,
  Layers,
  Maximize2,
  MousePointer2,
  Move,
  Move3d,
  Paintbrush,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Save,
  Scaling,
  Scissors,
  Search,
  Shapes,
  SlidersHorizontal,
  Sparkles,
  Spline,
  Trash2,
  Undo2,
  Ungroup,
  Wand2,
  Wrench,
  X,
} from 'lucide-react';
import {
  requestOpenContextualAiModal,
  useRegisterStudioAiBridge,
} from '../../ai/studioBridge';
import { sanitizeObjectMakerResult } from '../../ai/aiAppliers';
import type { MakerStore } from '../../store/useMakerStore';
import {
  BUILDING_MATERIALS,
} from '../../three/buildingBlocks';
import { WEATHERING_PRESETS } from '../../three/nodeMaterialUtils';
import {
  createCurvePresetPoints,
  createDefaultCurveGuide,
  buildCurveInstance,
  buildCurveSweepGeometry,
  computeCurveLength,
  sampleCurveTransforms,
} from '../../three/curveGuide';
import {
  combineGeometriesWorldSpace,
  performBooleanCsg,
  serializeBufferGeometry,
  type BooleanOperation,
} from '../../three/meshCsg';
import { enhanceTransformControlsGizmo } from '../../three/gizmoEnhancer';
import {
  OBJECT_PRIMITIVE_CATALOG,
  buildAndExportObjectDocToGlb,
  buildObjectMakerSceneGroup,
  buildPartGeometry,
  centerAndGroundObjectDoc,
  computePartWorldMatrix,
  createDefaultMaterialFinish,
  createDefaultPartSpec,
  createSavePlinthObjectDoc,
  createStarterObjectDoc,
  sanitizeObjectNodeName,
} from '../../three/objectMakerBuilder';
import {
  BUILTIN_MECHANISM_TEMPLATES,
  MechanismRuntimeController,
  computePivotPresetForPart,
  createBuiltinMechanismModel,
  findBestPartPathForObject,
  getDefaultMechanismsForTemplate,
  inspectObjectHierarchy,
  resolveTargetNode,
  type ObjectPartNode,
  type PivotSnapPreset,
} from '../../three/mechanismController';
import {
  BUILTIN_MECHANISM_PRESETS,
  createPresetFromMechanism,
  instantiatePresetForPart,
  loadSavedMechanismPresets,
  saveCustomMechanismPresets,
  type MechanismPresetDef,
  type PresetCategory,
} from '../../data/mechanismPresets';
import {
  getCachedAssetSync,
  loadCustomAssetToCache,
  regenerateCustomAssetThumbnail,
} from '../../three/gltfAssetManager';
import {
  createMakerRenderer,
  detectSoftwareGl,
  disposeObject3D,
  setupSceneEnvironment,
} from '../../three/islandScene';
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
  BuildingMaterialId,
  BuiltinMechanismTemplate,
  CurveGuideConfig,
  CurveGuidePresetId,
  CustomAssetMeta,
  InventoryItemCategory,
  InventoryItemDef,
  MechanismActionMode,
  MechanismAxis,
  MechanismConditionKind,
  MechanismKind,
  MechanismPlaybackMode,
  MechanismTriggerEvent,
  MechanismTriggerRule,
  MotionEasing,
  ObjectAttachBodyPart,
  ObjectGroupSpec,
  ObjectInteractionAttributeId,
  ObjectInteractionCalibration,
  ObjectMakerDoc,
  ObjectMechanism,
  ObjectPartSpec,
  ObjectPrimitiveShapeId,
  VertexPaintStroke,
  WeatheringPreset,
} from '../../types/maker';
import { OBJECT_INTERACTION_ATTRIBUTES } from '../../data/motionLibrary';
import { getProjectInventoryItems } from '../../data/registries';
import {
  OBJECT_BODY_PART_OPTIONS,
  resolveItemAttachBodyPart,
} from '../../three/heroEquipmentAttachments';
import { uid } from '../../utils/terrain';
import { AssetThumbnail } from '../shared/AssetThumbnail';
import { EASING_OPTIONS, EasingCurveIcon } from '../shared/MotionEditorPanel';
import { ObjectInteractionTestModal } from '../shared/ObjectInteractionTestModal';

export interface ObjectMakerModalProps {
  store: MakerStore;
  initialAssetId?: string | null;
  initialInventoryItemId?: string | null;
  onClose: () => void;
}

type StudioToolMode = 'select' | 'translate' | 'rotate' | 'scale';
type InspectorTab = 'shape' | 'material' | 'paint' | 'mechanics' | 'actions';
type CameraPreset = 'threeQuarter' | 'front' | 'top';
type HoleShapeKind = 'round' | 'square' | 'arch';
type HoleAxisKind = 'x' | 'y' | 'z';

const TRIGGER_EVENT_LABELS: Record<MechanismTriggerEvent, string> = {
  playerUses: 'Player presses Interact (E / Use)',
  playerNear: 'Player walks near object',
  playerTouches: 'Player touches / steps on object',
  flagSet: 'Game flag becomes active',
  levelStarts: 'Level starts',
};

const CONDITION_LABELS: Record<MechanismConditionKind, string> = {
  none: 'Always (no condition)',
  hasKey: 'Player has a Key',
  hasItem: 'Player has Inventory Item',
  flagSet: 'Game flag is set',
  baddiesGone: 'All baddies are defeated',
};

const ACTION_LABELS: Record<MechanismActionMode, string> = {
  toggle: 'Toggle Open / Closed',
  open: 'Open / Activate',
  close: 'Close / Reset',
};

const SNAP_PRESETS: { id: PivotSnapPreset; label: string }[] = [
  { id: 'backEdge', label: 'Back Edge' },
  { id: 'frontEdge', label: 'Front Edge' },
  { id: 'leftEdge', label: 'Left Edge' },
  { id: 'rightEdge', label: 'Right Edge' },
  { id: 'bottomCenter', label: 'Bottom' },
  { id: 'partCenter', label: 'Center' },
];

const CURVE_PRESET_LABELS: { id: CurveGuidePresetId; label: string }[] = [
  { id: 'arc', label: 'Arc' },
  { id: 'sCurve', label: 'S-Curve' },
  { id: 'arch', label: 'Arch' },
  { id: 'semiCircle', label: 'Half Circle' },
  { id: 'circle', label: 'Circle' },
];

function createDefaultTriggerRule(): MechanismTriggerRule {
  return {
    id: uid(),
    event: 'playerUses',
    radius: 2.4,
    condition: 'none',
    action: 'toggle',
    sound: 'door',
  };
}

function summarizeTriggerRule(
  rule: MechanismTriggerRule,
  mechName: string,
  itemNames: Map<string, string>
): string {
  const whenStr =
    rule.event === 'flagSet'
      ? `When flag "${rule.eventFlag?.trim() || 'switch_on'}" is set`
      : rule.event === 'levelStarts'
      ? 'When the level starts'
      : `When ${TRIGGER_EVENT_LABELS[rule.event].toLowerCase()} (${rule.radius.toFixed(1)}m)`;

  let ifStr = '';
  if (rule.condition === 'hasKey') {
    ifStr = rule.consumeRequired ? ', spending a Key' : ', requiring a Key';
  } else if (rule.condition === 'hasItem') {
    const itemName = (rule.conditionValue && itemNames.get(rule.conditionValue)) || 'item';
    ifStr = `, requiring ${itemName}`;
  } else if (rule.condition === 'flagSet') {
    ifStr = `, if flag "${rule.conditionValue?.trim() || 'lever_pulled'}"`;
  } else if (rule.condition === 'baddiesGone') {
    ifStr = ', if all baddies defeated';
  }

  return `${whenStr}${ifStr} → ${ACTION_LABELS[rule.action].toLowerCase()} "${mechName || 'part'}"`;
}

function ensureUniquePartAndGroupNames(doc: ObjectMakerDoc): ObjectMakerDoc {
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
      name: makeUnique(g.name, `Group_${idx + 1}`),
    })),
    parts: doc.parts.map((p, idx) => ({
      ...p,
      name: makeUnique(p.name, `Part_${idx + 1}`),
    })),
  };
}

function buildDocFromBuiltinTemplate(template: BuiltinMechanismTemplate | 'savePlinth'): {
  name: string;
  category: AssetCategory;
  doc: ObjectMakerDoc;
  mechanisms: ObjectMechanism[];
} {
  if (template === 'savePlinth') {
    return {
      name: 'Save / Spawn Plinth',
      category: 'prop',
      doc: createSavePlinthObjectDoc(),
      mechanisms: [],
    };
  }
  if (template === 'treasureChest') {
    const baseGroupId = uid();
    const lidGroupId = uid();
    const groups: ObjectGroupSpec[] = [
      { id: baseGroupId, name: 'Chest_Base', parentGroupId: null, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      { id: lidGroupId, name: 'Chest_Lid', parentGroupId: null, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    ];
    const parts: ObjectPartSpec[] = [
      createDefaultPartSpec('cube', {
        name: 'Wood_Hull',
        parentGroupId: baseGroupId,
        dimensions: [1.16, 0.56, 0.76],
        position: [0, 0.28, 0],
        modifiers: { bevel: 0.14, chamfer: 0.08, roundness: 0.15, edgeWear: 0.1 },
        material: createDefaultMaterialFinish('timberPlank'),
      }),
      createDefaultPartSpec('cube', {
        name: 'Left_Iron_Band',
        parentGroupId: baseGroupId,
        dimensions: [0.09, 0.58, 0.8],
        position: [-0.46, 0.29, 0],
        modifiers: { bevel: 0.2, chamfer: 0.2, roundness: 0.1, edgeWear: 0.05 },
        material: createDefaultMaterialFinish('rustedIron'),
      }),
      createDefaultPartSpec('cube', {
        name: 'Right_Iron_Band',
        parentGroupId: baseGroupId,
        dimensions: [0.09, 0.58, 0.8],
        position: [0.46, 0.29, 0],
        modifiers: { bevel: 0.2, chamfer: 0.2, roundness: 0.1, edgeWear: 0.05 },
        material: createDefaultMaterialFinish('rustedIron'),
      }),
      createDefaultPartSpec('cylinder', {
        name: 'Gold_Hoard',
        parentGroupId: baseGroupId,
        dimensions: [0.92, 0.14, 0.56],
        position: [0, 0.54, 0],
        material: { color: '#F2B830', roughness: 0.22, metalness: 0.9, weathering: 'none', weatheringIntensity: 0 },
      }),
      createDefaultPartSpec('halfCube', {
        name: 'Lid_Slab',
        parentGroupId: lidGroupId,
        dimensions: [1.18, 0.26, 0.78],
        position: [0, 0.69, 0],
        modifiers: { bevel: 0.35, chamfer: 0.12, roundness: 0.55, edgeWear: 0.08 },
        material: createDefaultMaterialFinish('timberPlank'),
      }),
      createDefaultPartSpec('cube', {
        name: 'Front_Clasp',
        parentGroupId: lidGroupId,
        dimensions: [0.16, 0.18, 0.08],
        position: [0, 0.59, 0.4],
        modifiers: { bevel: 0.2, chamfer: 0.2, roundness: 0.1, edgeWear: 0 },
        material: { color: '#F2B830', roughness: 0.25, metalness: 0.92, weathering: 'none', weatheringIntensity: 0 },
      }),
    ];
    return {
      name: 'Treasure Chest',
      category: 'prop',
      doc: { version: 1, parts, groups },
      mechanisms: getDefaultMechanismsForTemplate('treasureChest'),
    };
  }

  if (template === 'slidingDoor') {
    const frameGroupId = uid();
    const panelGroupId = uid();
    const groups: ObjectGroupSpec[] = [
      { id: frameGroupId, name: 'Door_Frame', parentGroupId: null, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      { id: panelGroupId, name: 'Door_Panel', parentGroupId: null, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    ];
    const parts: ObjectPartSpec[] = [
      createDefaultPartSpec('pillar', {
        name: 'Left_Pillar',
        parentGroupId: frameGroupId,
        dimensions: [0.36, 2.35, 0.52],
        position: [-0.92, 1.175, 0],
        modifiers: { bevel: 0.14, chamfer: 0.1, roundness: 0, edgeWear: 0.25 },
        material: createDefaultMaterialFinish('hewnStone'),
      }),
      createDefaultPartSpec('pillar', {
        name: 'Right_Pillar',
        parentGroupId: frameGroupId,
        dimensions: [0.36, 2.35, 0.52],
        position: [0.92, 1.175, 0],
        modifiers: { bevel: 0.14, chamfer: 0.1, roundness: 0, edgeWear: 0.25 },
        material: createDefaultMaterialFinish('hewnStone'),
      }),
      createDefaultPartSpec('cube', {
        name: 'Top_Lintel',
        parentGroupId: frameGroupId,
        dimensions: [2.38, 0.38, 0.62],
        position: [0, 2.48, 0],
        modifiers: { bevel: 0.18, chamfer: 0.2, roundness: 0, edgeWear: 0.22 },
        material: createDefaultMaterialFinish('hewnStone'),
      }),
      createDefaultPartSpec('cube', {
        name: 'Door_Slab',
        parentGroupId: panelGroupId,
        dimensions: [1.52, 2.18, 0.22],
        position: [0, 1.16, 0],
        modifiers: { bevel: 0.16, chamfer: 0.12, roundness: 0, edgeWear: 0.18 },
        material: createDefaultMaterialFinish('crackedSlate'),
      }),
      createDefaultPartSpec('cube', {
        name: 'Bronze_Inlay',
        parentGroupId: panelGroupId,
        dimensions: [1.14, 1.72, 0.25],
        position: [0, 1.16, 0],
        modifiers: { bevel: 0.12, chamfer: 0.15, roundness: 0, edgeWear: 0 },
        material: { color: '#B88442', roughness: 0.32, metalness: 0.84, weathering: 'none', weatheringIntensity: 0 },
      }),
    ];
    return {
      name: 'Sliding Temple Door',
      category: 'scenery',
      doc: { version: 1, parts, groups },
      mechanisms: getDefaultMechanismsForTemplate('slidingDoor'),
    };
  }

  if (template === 'leverSwitch') {
    const baseGroupId = uid();
    const armGroupId = uid();
    const groups: ObjectGroupSpec[] = [
      { id: baseGroupId, name: 'Lever_Base', parentGroupId: null, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      { id: armGroupId, name: 'Lever_Arm', parentGroupId: null, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    ];
    const parts: ObjectPartSpec[] = [
      createDefaultPartSpec('cube', {
        name: 'Stone_Plinth',
        parentGroupId: baseGroupId,
        dimensions: [0.92, 0.18, 1.18],
        position: [0, 0.09, 0],
        modifiers: { bevel: 0.16, chamfer: 0.2, roundness: 0, edgeWear: 0.25 },
        material: createDefaultMaterialFinish('hewnStone'),
      }),
      createDefaultPartSpec('cube', {
        name: 'Iron_Housing',
        parentGroupId: baseGroupId,
        dimensions: [0.56, 0.14, 0.84],
        position: [0, 0.23, 0],
        modifiers: { bevel: 0.15, chamfer: 0.2, roundness: 0, edgeWear: 0.1 },
        material: createDefaultMaterialFinish('rustedIron'),
      }),
      createDefaultPartSpec('cylinder', {
        name: 'Steel_Shaft',
        parentGroupId: armGroupId,
        dimensions: [0.11, 1.18, 0.11],
        position: [0, 0.92, 0],
        material: { color: '#B6C0D2', roughness: 0.26, metalness: 0.9, weathering: 'none', weatheringIntensity: 0 },
      }),
      createDefaultPartSpec('sphere', {
        name: 'Grip_Orb',
        parentGroupId: armGroupId,
        dimensions: [0.28, 0.28, 0.28],
        position: [0, 1.56, 0],
        material: { color: '#E11D48', roughness: 0.28, metalness: 0.14, weathering: 'none', weatheringIntensity: 0 },
      }),
    ];
    return {
      name: 'Floor Lever Switch',
      category: 'prop',
      doc: { version: 1, parts, groups },
      mechanisms: getDefaultMechanismsForTemplate('leverSwitch'),
    };
  }

  // drawbridge
  const gateGroupId = uid();
  const deckGroupId = uid();
  const groups: ObjectGroupSpec[] = [
    { id: gateGroupId, name: 'Gatehouse_Pillars', parentGroupId: null, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    { id: deckGroupId, name: 'Bridge_Deck', parentGroupId: null, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
  ];
  const parts: ObjectPartSpec[] = [
    createDefaultPartSpec('cube', {
      name: 'Left_Gate_Pillar',
      parentGroupId: gateGroupId,
      dimensions: [0.46, 2.3, 0.56],
      position: [-1.08, 1.15, -0.18],
      modifiers: { bevel: 0.14, chamfer: 0.15, roundness: 0, edgeWear: 0.28 },
      material: createDefaultMaterialFinish('hewnStone'),
    }),
    createDefaultPartSpec('cube', {
      name: 'Right_Gate_Pillar',
      parentGroupId: gateGroupId,
      dimensions: [0.46, 2.3, 0.56],
      position: [1.08, 1.15, -0.18],
      modifiers: { bevel: 0.14, chamfer: 0.15, roundness: 0, edgeWear: 0.28 },
      material: createDefaultMaterialFinish('hewnStone'),
    }),
    createDefaultPartSpec('plank', {
      name: 'Timber_Deck',
      parentGroupId: deckGroupId,
      dimensions: [1.72, 2.05, 0.16],
      position: [0, 1.16, 0.04],
      modifiers: { bevel: 0.12, chamfer: 0.1, roundness: 0, edgeWear: 0.16 },
      material: createDefaultMaterialFinish('timberPlank'),
    }),
    createDefaultPartSpec('beamSmall', {
      name: 'Iron_Crossbeam',
      parentGroupId: deckGroupId,
      dimensions: [1.76, 0.14, 0.2],
      position: [0, 1.16, 0.04],
      material: createDefaultMaterialFinish('rustedIron'),
    }),
  ];
  return {
    name: 'Castle Drawbridge',
    category: 'scenery',
    doc: { version: 1, parts, groups },
    mechanisms: getDefaultMechanismsForTemplate('drawbridge'),
  };
}

export const ObjectMakerModal: React.FC<ObjectMakerModalProps> = ({
  store,
  initialAssetId = null,
  initialInventoryItemId = null,
  onClose,
}) => {
  // Core studio document state
  const [editingAssetId, setEditingAssetId] = useState<string | null>(initialAssetId);
  const [objectName, setObjectName] = useState<string>('Medieval Oak Table');
  const [assetCategory, setAssetCategory] = useState<AssetCategory>('prop');
  const [doc, setDoc] = useState<ObjectMakerDoc>(() => createStarterObjectDoc());
  const [mechanisms, setMechanisms] = useState<ObjectMechanism[]>([]);
  const [attachBodyPart, setAttachBodyPart] = useState<ObjectAttachBodyPart | null>(null);
  const [linkedInventoryItemId, setLinkedInventoryItemId] = useState<string | null>(
    initialInventoryItemId ?? null
  );
  const [includeInInventory, setIncludeInInventory] = useState<boolean>(
    Boolean(initialInventoryItemId)
  );
  const [inventoryCategory, setInventoryCategory] = useState<InventoryItemCategory>('tool');
  const [geometryDirty, setGeometryDirty] = useState<boolean>(false);
  const [interactionAttributes, setInteractionAttributes] = useState<
    ObjectInteractionAttributeId[]
  >([]);
  const [interactionCalibrations, setInteractionCalibrations] = useState<
    Partial<Record<ObjectInteractionAttributeId, ObjectInteractionCalibration>>
  >({});
  const [showInteractionTester, setShowInteractionTester] = useState(false);
  const [externalGlbMode, setExternalGlbMode] = useState<boolean>(false);
  const [externalGlbVersion, setExternalGlbVersion] = useState<number>(0);

  // Undo/Redo stacks
  const [undoStack, setUndoStack] = useState<
    { doc: ObjectMakerDoc; mechanisms: ObjectMechanism[] }[]
  >([]);
  const [redoStack, setRedoStack] = useState<
    { doc: ObjectMakerDoc; mechanisms: ObjectMechanism[] }[]
  >([]);

  // Selection & tools
  const [toolMode, setToolMode] = useState<StudioToolMode>('translate');
  const [gridSnapStep, setGridSnapStep] = useState<0 | 0.05 | 0.1 | 0.25>(0.05);
  const [selectedPartIds, setSelectedPartIds] = useState<string[]>(() =>
    doc.parts[0] ? [doc.parts[0].id] : []
  );
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('shape');
  const [showLeftDock, setShowLeftDock] = useState<boolean>(true);
  const [showLoadMenu, setShowLoadMenu] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [placeOnSave, setPlaceOnSave] = useState<boolean>(() => !initialAssetId);
  const [toast, setToast] = useState<string | null>(null);
  const [gizmoHudText, setGizmoHudText] = useState<string | null>(null);

  // Quick Hole Cutter controls
  const [holeShape, setHoleShape] = useState<HoleShapeKind>('round');
  const [holeAxis, setHoleAxis] = useState<HoleAxisKind>('z');
  const [holeRadiusRatio, setHoleRadiusRatio] = useState<number>(0.42);

  // Curve Guide state (for Object Maker sweeps & arraying)
  const [curveEnabled, setCurveEnabled] = useState<boolean>(false);
  const [curveCfg, setCurveCfg] = useState<CurveGuideConfig>(() =>
    createDefaultCurveGuide('arc')
  );
  const [activeCurvePtIdx, setActiveCurvePtIdx] = useState<number | null>(null);
  const [curveBend, setCurveBend] = useState<number>(1.2);
  const [curveSweepWidth, setCurveSweepWidth] = useState<number>(0.14);
  const [curveArrayCount, setCurveArrayCount] = useState<number>(8);

  // Mechanics inspection & testing state
  const [scenePartNodes, setScenePartNodes] = useState<ObjectPartNode[]>([]);
  const [activeMechanismId, setActiveMechanismId] = useState<string | null>(null);
  const [selectedMechNodePath, setSelectedMechNodePath] = useState<string | null>(null);
  const [showPivotGizmo, setShowPivotGizmo] = useState<boolean>(true);
  const [mechProgress, setMechProgress] = useState<number>(0);
  const [mechTargetOpen, setMechTargetOpen] = useState<boolean | null>(null);
  const [presetFilter, setPresetFilter] = useState<'all' | PresetCategory>('all');
  const [presetSearch, setPresetSearch] = useState<string>('');
  const [customPresets, setCustomPresets] = useState<MechanismPresetDef[]>(() =>
    loadSavedMechanismPresets()
  );
  const [savingPreset, setSavingPreset] = useState<boolean>(false);
  const [newPresetName, setNewPresetName] = useState<string>('');

  // Embedded Vertex Paint state
  const [paintStrokes, setPaintStrokes] = useState<VertexPaintStroke[]>([]);
  const [paintRedoStack, setPaintRedoStack] = useState<VertexPaintStroke[]>([]);
  const [paintTool, setPaintTool] = useState<'paint' | 'orbit'>('paint');
  const [spaceOrbiting, setSpaceOrbiting] = useState(false);
  const [paintBrush, setPaintBrush] = useState<VertexPaintBrushSettings>({
    radius: 0.42,
    opacity: 0.55,
    softness: 0.72,
    mode: 'paint',
    target: 'all',
    color: '#A4DF54',
    hueShift: 0,
    saturationShift: 0,
    valueShift: 0,
    hueJitter: 12,
    degradeForm: 'cracked',
    degradeChipDepth: 0.45,
  });

  // Marquee 2D overlay state
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

  // Load initial asset if passed
  const loadExistingCustomAsset = useCallback(
    async (asset: CustomAssetMeta) => {
      setEditingAssetId(asset.id);
      setObjectName(asset.name);
      setAssetCategory(asset.category);
      setUndoStack([]);
      setRedoStack([]);
      setPaintRedoStack([]);
      setPaintStrokes(
        JSON.parse(
          JSON.stringify(asset.vertexPaintStrokes ?? asset.objectRecipe?.vertexPaintStrokes ?? [])
        ) as VertexPaintStroke[]
      );
      setInteractionAttributes([
        ...(asset.interactionAttributes ?? asset.objectRecipe?.interactionAttributes ?? []),
      ]);
      setInteractionCalibrations(
        JSON.parse(
          JSON.stringify(
            asset.interactionCalibrations ?? asset.objectRecipe?.interactionCalibrations ?? {}
          )
        ) as Partial<Record<ObjectInteractionAttributeId, ObjectInteractionCalibration>>
      );
      setPlaceOnSave(false);
      setShowLoadMenu(false);
      const nextAttach =
        asset.attachBodyPart ?? asset.objectRecipe?.attachBodyPart ?? null;
      const nextLinkedId =
        asset.linkedInventoryItemId ?? asset.objectRecipe?.linkedInventoryItemId ?? null;
      setAttachBodyPart(nextAttach);
      setLinkedInventoryItemId(nextLinkedId);
      setIncludeInInventory(Boolean(nextLinkedId));
      if (nextLinkedId) {
        const invMatch = getProjectInventoryItems(store.currentProject).find(
          (i) => i.id === nextLinkedId
        );
        if (invMatch) {
          setInventoryCategory(invMatch.category);
          if (!nextAttach) {
            setAttachBodyPart(resolveItemAttachBodyPart(invMatch, store.customAssets));
          }
        }
      }
      setGeometryDirty(false);

      if (asset.objectRecipe && asset.objectRecipe.parts.length > 0) {
        setExternalGlbMode(false);
        const clonedDoc = JSON.parse(JSON.stringify(asset.objectRecipe)) as ObjectMakerDoc;
        const clonedMechs = JSON.parse(
          JSON.stringify(asset.mechanisms ?? [])
        ) as ObjectMechanism[];
        setDoc(clonedDoc);
        setMechanisms(clonedMechs);
        setSelectedPartIds(clonedDoc.parts[0] ? [clonedDoc.parts[0].id] : []);
        setSelectedGroupId(null);
        setActiveMechanismId(clonedMechs[0]?.id ?? null);
        setSelectedMechNodePath(clonedMechs[0]?.targetNodePath ?? null);
        flashToast(`Loaded editable recipe "${asset.name}"`);
      } else {
        // Pre-existing GLB uploaded outside Object Maker: load directly into scene for inspection & hinges
        await loadCustomAssetToCache(asset.id, asset.category);
        setExternalGlbMode(true);
        setExternalGlbVersion((v) => v + 1);
        const clonedMechs = JSON.parse(
          JSON.stringify(asset.mechanisms ?? [])
        ) as ObjectMechanism[];
        setMechanisms(clonedMechs);
        setSelectedPartIds([]);
        setSelectedGroupId(null);
        setActiveMechanismId(clonedMechs[0]?.id ?? null);
        setSelectedMechNodePath(clonedMechs[0]?.targetNodePath ?? null);
        setInspectorTab('mechanics');
        flashToast(`Loaded GLB "${asset.name}" (Rig & Mechanics Editor)`);
      }
    },
    [flashToast, store.currentProject, store.customAssets]
  );

  useEffect(() => {
    if (!initialAssetId || initialInventoryItemId) return;
    const found = store.customAssets.find((a) => a.id === initialAssetId);
    if (found) {
      void loadExistingCustomAsset(found);
    }
  }, [initialAssetId, initialInventoryItemId]); // intentional mount-sync for initialAssetId

  useEffect(() => {
    if (!initialInventoryItemId) return;
    const invItem = getProjectInventoryItems(store.currentProject).find(
      (i) => i.id === initialInventoryItemId
    );
    if (!invItem) return;
    const resolvedPart = resolveItemAttachBodyPart(invItem, store.customAssets);
    setLinkedInventoryItemId(invItem.id);
    setIncludeInInventory(true);
    setInventoryCategory(invItem.category);
    setAttachBodyPart(resolvedPart);
    setPlaceOnSave(false);
    setInspectorTab('actions');

    if (invItem.customAssetId) {
      const linkedAsset = store.customAssets.find((a) => a.id === invItem.customAssetId);
      if (linkedAsset) {
        void loadExistingCustomAsset(linkedAsset).then(() => {
          setLinkedInventoryItemId(invItem.id);
          setIncludeInInventory(true);
          setAttachBodyPart(resolvedPart ?? linkedAsset.attachBodyPart ?? null);
          setInspectorTab('actions');
        });
        return;
      }
    }

    const starter = createStarterObjectDoc();
    if (starter.parts[0]) {
      starter.parts[0].name = invItem.name;
      starter.parts[0].material = {
        ...starter.parts[0].material,
        color: invItem.wearColorHex ?? invItem.colorHex ?? '#7C5CFF',
      };
    }
    setEditingAssetId(null);
    setExternalGlbMode(false);
    setObjectName(invItem.name);
    setAssetCategory('prop');
    setDoc(starter);
    setMechanisms([]);
    setSelectedPartIds(starter.parts[0] ? [starter.parts[0].id] : []);
    setGeometryDirty(false);
    flashToast(`Assign body part for "${invItem.name}"`);
  }, [initialInventoryItemId]);

  const pushHistory = useCallback(
    (snapshotDoc: ObjectMakerDoc, snapshotMechs: ObjectMechanism[]) => {
      setUndoStack((prev) => [
        ...prev.slice(-24),
        {
          doc: JSON.parse(JSON.stringify(snapshotDoc)) as ObjectMakerDoc,
          mechanisms: JSON.parse(JSON.stringify(snapshotMechs)) as ObjectMechanism[],
        },
      ]);
      setRedoStack([]);
    },
    []
  );

  const commitDoc = useCallback(
    (updater: (prev: ObjectMakerDoc) => ObjectMakerDoc, recordHistory = true) => {
      setGeometryDirty(true);
      setDoc((prev) => {
        if (recordHistory) {
          setUndoStack((h) => [
            ...h.slice(-24),
            {
              doc: JSON.parse(JSON.stringify(prev)) as ObjectMakerDoc,
              mechanisms: JSON.parse(JSON.stringify(mechanisms)) as ObjectMechanism[],
            },
          ]);
          setRedoStack([]);
        }
        return updater(prev);
      });
    },
    [mechanisms]
  );

  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setRedoStack((r) => [
        {
          doc: JSON.parse(JSON.stringify(doc)) as ObjectMakerDoc,
          mechanisms: JSON.parse(JSON.stringify(mechanisms)) as ObjectMechanism[],
        },
        ...r.slice(0, 24),
      ]);
      setDoc(last.doc);
      setMechanisms(last.mechanisms);
      return prev.slice(0, -1);
    });
  }, [doc, mechanisms]);

  const handleRedo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const next = prev[0];
      setUndoStack((u) => [
        ...u,
        {
          doc: JSON.parse(JSON.stringify(doc)) as ObjectMakerDoc,
          mechanisms: JSON.parse(JSON.stringify(mechanisms)) as ObjectMechanism[],
        },
      ]);
      setDoc(next.doc);
      setMechanisms(next.mechanisms);
      return prev.slice(1);
    });
  }, [doc, mechanisms]);

  // Derived selections
  const selectedParts = useMemo(
    () => doc.parts.filter((p) => selectedPartIds.includes(p.id)),
    [doc.parts, selectedPartIds]
  );
  const primaryPart = selectedParts[0] ?? null;
  const selectedGroup = useMemo(
    () => doc.groups.find((g) => g.id === selectedGroupId) ?? null,
    [doc.groups, selectedGroupId]
  );
  const activeMechanism = useMemo(
    () => mechanisms.find((m) => m.id === activeMechanismId) ?? null,
    [mechanisms, activeMechanismId]
  );
  const selectedMechNode = useMemo(
    () => scenePartNodes.find((n) => n.path === selectedMechNodePath) ?? null,
    [scenePartNodes, selectedMechNodePath]
  );

  const itemCatalog = store.currentProject?.inventoryItems ?? [];
  const itemNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of itemCatalog) map.set(item.id, item.name);
    return map;
  }, [itemCatalog]);

  // Helper: map doc part/group ID to resolved scene Object3D path in ObjectRoot
  const activeSceneNodePathForSelection = useMemo(() => {
    if (selectedMechNodePath) return selectedMechNodePath;
    if (selectedGroup) {
      return scenePartNodes.find((n) => n.name === selectedGroup.name)?.path ?? null;
    }
    if (primaryPart) {
      return scenePartNodes.find((n) => n.name === primaryPart.name)?.path ?? null;
    }
    return scenePartNodes[0]?.path ?? null;
  }, [selectedMechNodePath, selectedGroup, primaryPart, scenePartNodes]);

  // Keep doc mutations snappy
  const updateSelectedParts = useCallback(
    (updater: (p: ObjectPartSpec) => ObjectPartSpec, recordHistory = false) => {
      if (selectedPartIds.length === 0) return;
      const idSet = new Set(selectedPartIds);
      commitDoc(
        (prev) => ({
          ...prev,
          parts: prev.parts.map((p) => (idSet.has(p.id) ? updater(p) : p)),
        }),
        recordHistory
      );
    },
    [commitDoc, selectedPartIds]
  );

  const addPrimitivePart = (shape: ObjectPrimitiveShapeId, isCutter = false) => {
    const newPart = createDefaultPartSpec(shape, {
      isCutter,
      name: isCutter
        ? `Cutter_${doc.parts.length + 1}`
        : `${OBJECT_PRIMITIVE_CATALOG.find((c) => c.id === shape)?.defaultName ?? 'Part'}_${doc.parts.length + 1}`,
      position: [
        Number(((Math.random() - 0.5) * 0.35).toFixed(2)),
        Number(
          ((OBJECT_PRIMITIVE_CATALOG.find((c) => c.id === shape)?.defaultSize[1] ?? 1) * 0.5).toFixed(
            3
          )
        ),
        Number(((Math.random() - 0.5) * 0.35).toFixed(2)),
      ],
    });
    if (externalGlbMode) {
      setExternalGlbMode(false);
    }
    commitDoc((prev) => ensureUniquePartAndGroupNames({
      ...prev,
      parts: [...prev.parts, newPart],
    }));
    setSelectedPartIds([newPart.id]);
    setSelectedGroupId(null);
    setActiveCurvePtIdx(null);
  };

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
      name: `Group_${doc.groups.length + 1}`,
      parentGroupId: null,
      position: [Number(cx.toFixed(3)), Number(cy.toFixed(3)), Number(cz.toFixed(3))],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    };
    commitDoc((prev) =>
      ensureUniquePartAndGroupNames({
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
    flashToast(`Grouped ${chosen.length} parts`);
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
    flashToast('Ungrouped parts');
  };

  const handleDuplicateSelected = () => {
    if (selectedParts.length === 0) return;
    const clones = selectedParts.map((p) => ({
      ...(JSON.parse(JSON.stringify(p)) as ObjectPartSpec),
      id: uid(),
      name: `${p.name}_Copy`,
      position: [
        Number((p.position[0] + 0.28).toFixed(3)),
        p.position[1],
        Number((p.position[2] + 0.28).toFixed(3)),
      ] as [number, number, number],
    }));
    commitDoc((prev) =>
      ensureUniquePartAndGroupNames({
        ...prev,
        parts: [...prev.parts, ...clones],
      })
    );
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
    const idSet = new Set(selectedPartIds);
    commitDoc((prev) => ({
      ...prev,
      parts: prev.parts.map((p) => {
        if (!idSet.has(p.id)) return p;
        const geo = buildPartGeometry(p);
        geo.computeBoundingBox();
        const minY = geo.boundingBox ? geo.boundingBox.min.y : -p.dimensions[1] * 0.5;
        geo.dispose();
        const worldY = p.position[1] + minY;
        return {
          ...p,
          position: [p.position[0], Number((p.position[1] - worldY).toFixed(4)), p.position[2]],
        };
      }),
    }));
  };

  // Boolean / CSG Operations
  const handleRunBoolean = (op: BooleanOperation | 'combine') => {
    if (selectedParts.length < 2) {
      flashToast('Select at least 2 parts for Boolean / Combine');
      return;
    }
    const base = selectedParts[0];
    const others = selectedParts.slice(1);
    const idSet = new Set(selectedParts.map((p) => p.id));

    if (op === 'combine') {
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
        name: `${base.name}_Combined`,
        parentGroupId: null,
        shape: 'csgResult',
        isCutter: false,
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
        modifiers: { ...base.modifiers, bevel: 0, chamfer: 0, roundness: 0, edgeWear: 0 },
        bakedGeometry: baked,
      };
      commitDoc((prev) =>
        ensureUniquePartAndGroupNames({
          ...prev,
          parts: [...prev.parts.filter((p) => !idSet.has(p.id)), combinedPart],
        })
      );
      setSelectedPartIds([combinedPart.id]);
      setSelectedGroupId(null);
      flashToast(`Combined ${selectedParts.length} parts`);
      return;
    }

    let curGeo = buildPartGeometry(base);
    let curMat = computePartWorldMatrix(doc, base);
    let currentCenter = new THREE.Vector3();
    for (const cutter of others) {
      const cutGeo = buildPartGeometry(cutter);
      const cutMat = computePartWorldMatrix(doc, cutter);
      const res = performBooleanCsg(op, curGeo, curMat, cutGeo, cutMat);
      curGeo.dispose();
      cutGeo.dispose();
      if (!res) {
        flashToast('Boolean operation resulted in empty volume');
        return;
      }
      curGeo = res.geometry;
      currentCenter = res.center;
      curMat = new THREE.Matrix4().makeTranslation(currentCenter.x, currentCenter.y, currentCenter.z);
    }

    curGeo.computeBoundingBox();
    const size = new THREE.Vector3();
    curGeo.boundingBox?.getSize(size);
    const baked = serializeBufferGeometry(curGeo);
    curGeo.dispose();

    const resultPart: ObjectPartSpec = {
      ...JSON.parse(JSON.stringify(base)),
      id: uid(),
      name: `${base.name}_${op}`,
      parentGroupId: null,
      shape: 'csgResult',
      isCutter: false,
      position: [
        Number(currentCenter.x.toFixed(4)),
        Number(currentCenter.y.toFixed(4)),
        Number(currentCenter.z.toFixed(4)),
      ],
      rotation: [0, 0, 0],
      dimensions: [
        Number(Math.max(0.08, size.x).toFixed(3)),
        Number(Math.max(0.08, size.y).toFixed(3)),
        Number(Math.max(0.08, size.z).toFixed(3)),
      ],
      modifiers: { ...base.modifiers, bevel: 0, chamfer: 0, roundness: 0, edgeWear: 0 },
      bakedGeometry: baked,
    };

    commitDoc((prev) =>
      ensureUniquePartAndGroupNames({
        ...prev,
        parts: [...prev.parts.filter((p) => !idSet.has(p.id)), resultPart],
      })
    );
    setSelectedPartIds([resultPart.id]);
    setSelectedGroupId(null);
    flashToast(`Applied Boolean ${op}`);
  };

  // Subtract all red Cutter Volumes against non-cutter targets
  const handleApplyAllCutters = () => {
    const cutters = doc.parts.filter((p) => p.isCutter);
    const solids =
      selectedParts.filter((p) => !p.isCutter).length > 0
        ? selectedParts.filter((p) => !p.isCutter)
        : doc.parts.filter((p) => !p.isCutter);
    if (cutters.length === 0 || solids.length === 0) {
      flashToast('Add a Cut Volume over an object part first');
      return;
    }

    const updatedParts = [...doc.parts];
    let touched = 0;
    for (const solid of solids) {
      let curGeo = buildPartGeometry(solid);
      let curMat = computePartWorldMatrix(doc, solid);
      let center = new THREE.Vector3();
      let didCut = false;

      // Test bbox overlap quickly before BSP
      curGeo.computeBoundingBox();
      const sBox = new THREE.Box3();
      if (curGeo.boundingBox) sBox.copy(curGeo.boundingBox).applyMatrix4(curMat);

      for (const cutter of cutters) {
        const cGeo = buildPartGeometry(cutter);
        const cMat = computePartWorldMatrix(doc, cutter);
        cGeo.computeBoundingBox();
        const cBox = new THREE.Box3();
        if (cGeo.boundingBox) cBox.copy(cGeo.boundingBox).applyMatrix4(cMat);
        if (!sBox.intersectsBox(cBox)) {
          cGeo.dispose();
          continue;
        }
        const res = performBooleanCsg('subtract', curGeo, curMat, cGeo, cMat);
        cGeo.dispose();
        if (!res) continue;
        curGeo.dispose();
        curGeo = res.geometry;
        center = res.center;
        curMat = new THREE.Matrix4().makeTranslation(center.x, center.y, center.z);
        didCut = true;
      }

      if (didCut) {
        touched++;
        curGeo.computeBoundingBox();
        const sz = new THREE.Vector3();
        curGeo.boundingBox?.getSize(sz);
        const idx = updatedParts.findIndex((p) => p.id === solid.id);
        if (idx >= 0) {
          updatedParts[idx] = {
            ...solid,
            parentGroupId: null,
            shape: 'csgResult',
            position: [
              Number(center.x.toFixed(4)),
              Number(center.y.toFixed(4)),
              Number(center.z.toFixed(4)),
            ],
            rotation: [0, 0, 0],
            dimensions: [
              Number(Math.max(0.08, sz.x).toFixed(3)),
              Number(Math.max(0.08, sz.y).toFixed(3)),
              Number(Math.max(0.08, sz.z).toFixed(3)),
            ],
            modifiers: { ...solid.modifiers, bevel: 0, chamfer: 0, roundness: 0, edgeWear: 0 },
            bakedGeometry: serializeBufferGeometry(curGeo),
          };
        }
      }
      curGeo.dispose();
    }

    if (touched === 0) {
      flashToast('Cut Volumes did not overlap any solid parts');
      return;
    }

    const cutterIds = new Set(cutters.map((c) => c.id));
    commitDoc((prev) => ({
      ...prev,
      parts: updatedParts.filter((p) => !cutterIds.has(p.id)),
    }));
    flashToast(`Carved ${touched} part${touched > 1 ? 's' : ''} cleanly`);
  };

  // Instant 1-Click Cut Hole on selected part
  const handleQuickCutHole = () => {
    if (!primaryPart || primaryPart.isCutter) {
      flashToast('Select a solid part to cut a hole into');
      return;
    }
    const baseGeo = buildPartGeometry(primaryPart);
    const baseMat = computePartWorldMatrix(doc, primaryPart);
    const minSpan = Math.min(primaryPart.dimensions[0], primaryPart.dimensions[1], primaryPart.dimensions[2]);
    const holeDia = Math.max(0.12, minSpan * holeRadiusRatio);
    const maxThrough =
      Math.max(primaryPart.dimensions[0], primaryPart.dimensions[1], primaryPart.dimensions[2]) + 0.6;

    let cutGeo: THREE.BufferGeometry;
    if (holeShape === 'square') {
      cutGeo = new THREE.BoxGeometry(holeDia, holeDia, maxThrough);
    } else if (holeShape === 'arch') {
      const sh = new THREE.Shape();
      const hw = holeDia * 0.5;
      const leg = holeDia * 0.5;
      sh.moveTo(-hw, -leg);
      sh.lineTo(hw, -leg);
      sh.lineTo(hw, 0);
      sh.absarc(0, 0, hw, 0, Math.PI, false);
      sh.closePath();
      cutGeo = new THREE.ExtrudeGeometry(sh, { depth: maxThrough, bevelEnabled: false });
      cutGeo.center();
    } else {
      cutGeo = new THREE.CylinderGeometry(holeDia * 0.5, holeDia * 0.5, maxThrough, 18);
      cutGeo.rotateX(Math.PI / 2);
    }

    if (holeAxis === 'x') {
      cutGeo.rotateY(Math.PI / 2);
    } else if (holeAxis === 'y') {
      cutGeo.rotateX(Math.PI / 2);
    }

    const res = performBooleanCsg('subtract', baseGeo, baseMat, cutGeo, baseMat);
    baseGeo.dispose();
    cutGeo.dispose();
    if (!res) {
      flashToast('Hole size exceeded part thickness');
      return;
    }
    res.geometry.computeBoundingBox();
    const sz = new THREE.Vector3();
    res.geometry.boundingBox?.getSize(sz);
    const baked = serializeBufferGeometry(res.geometry);
    res.geometry.dispose();

    const holePart: ObjectPartSpec = {
      ...primaryPart,
      parentGroupId: null,
      shape: 'csgResult',
      position: [
        Number(res.center.x.toFixed(4)),
        Number(res.center.y.toFixed(4)),
        Number(res.center.z.toFixed(4)),
      ],
      rotation: [0, 0, 0],
      dimensions: [
        Number(Math.max(0.08, sz.x).toFixed(3)),
        Number(Math.max(0.08, sz.y).toFixed(3)),
        Number(Math.max(0.08, sz.z).toFixed(3)),
      ],
      modifiers: { ...primaryPart.modifiers, bevel: 0, chamfer: 0, roundness: 0, edgeWear: 0 },
      bakedGeometry: baked,
    };

    commitDoc((prev) => ({
      ...prev,
      parts: prev.parts.map((p) => (p.id === primaryPart.id ? holePart : p)),
    }));
    flashToast(`Cut ${holeShape} hole along ${holeAxis.toUpperCase()}`);
  };

  // Curve Guide generators
  const handleSelectCurvePreset = (preset: CurveGuidePresetId) => {
    const pts = createCurvePresetPoints(preset, { span: 3.2, bend: curveBend, height: 1.8 });
    setCurveCfg((prev) => ({
      ...prev,
      preset,
      points: pts,
      closed: preset === 'circle',
      elevationArch: preset === 'arch' ? 1.8 : 0,
    }));
    setActiveCurvePtIdx(0);
    setCurveEnabled(true);
  };

  const handleSweepAlongCurve = (profile: 'tube' | 'ribbon' | 'beveledBar') => {
    const geo = buildCurveSweepGeometry(curveCfg, profile, curveSweepWidth, 16);
    geo.computeBoundingBox();
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    geo.boundingBox?.getCenter(center);
    geo.boundingBox?.getSize(size);
    geo.translate(-center.x, -center.y, -center.z);
    const baked = serializeBufferGeometry(geo);
    geo.dispose();

    const matTemplate = primaryPart?.material ?? createDefaultMaterialFinish('hewnStone');
    const sweptPart = createDefaultPartSpec('csgResult', {
      name: `Curve_${profile === 'tube' ? 'Tube' : profile === 'ribbon' ? 'Ribbon' : 'Beam'}_${doc.parts.length + 1}`,
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
      material: { ...matTemplate },
      bakedGeometry: baked,
    });
    if (externalGlbMode) setExternalGlbMode(false);
    commitDoc((prev) =>
      ensureUniquePartAndGroupNames({
        ...prev,
        parts: [...prev.parts, sweptPart],
      })
    );
    setSelectedPartIds([sweptPart.id]);
    setActiveCurvePtIdx(null);
    flashToast(`Created ${profile} mesh along curve`);
  };

  const handleArrayAlongCurve = () => {
    const source = primaryPart ?? createDefaultPartSpec('beamSmall');
    const samples = sampleCurveTransforms(curveCfg, curveArrayCount, false);
    const clones: ObjectPartSpec[] = samples.map((s, idx) => ({
      ...(JSON.parse(JSON.stringify(source)) as ObjectPartSpec),
      id: uid(),
      parentGroupId: null,
      name: `${source.name}_C${idx + 1}`,
      position: [
        Number(s.position.x.toFixed(4)),
        Number(s.position.y.toFixed(4)),
        Number(s.position.z.toFixed(4)),
      ],
      rotation: curveCfg.alignToTangent ? s.eulerDeg : [...source.rotation] as [number, number, number],
    }));
    if (externalGlbMode) setExternalGlbMode(false);
    commitDoc((prev) =>
      ensureUniquePartAndGroupNames({
        ...prev,
        parts: [...prev.parts, ...clones],
      })
    );
    setSelectedPartIds(clones.map((c) => c.id));
    setActiveCurvePtIdx(null);
    flashToast(`Arrayed ${clones.length} copies along curve`);
  };

  // Mechanism Helpers
  const updateActiveMechanism = useCallback(
    (updater: (m: ObjectMechanism) => ObjectMechanism) => {
      if (!activeMechanismId) return;
      setMechanisms((prev) => prev.map((m) => (m.id === activeMechanismId ? updater(m) : m)));
    },
    [activeMechanismId]
  );

  const handleAddMechanism = (kind: MechanismKind) => {
    const fallbackNode =
      scenePartNodes.find((n) => n.path === activeSceneNodePathForSelection) ??
      scenePartNodes[scenePartNodes.length > 1 ? 1 : 0] ??
      scenePartNodes[0] ??
      null;
    if (!fallbackNode) {
      flashToast('Add at least one object part first');
      return;
    }
    const pivot = computePivotPresetForPart(
      fallbackNode,
      kind === 'hinge' ? 'backEdge' : 'partCenter'
    );
    const newMech: ObjectMechanism = {
      id: uid(),
      name: `${fallbackNode.label} ${kind === 'hinge' ? 'Hinge' : 'Slider'}`,
      targetNodePath: fallbackNode.path,
      targetLabel: fallbackNode.label,
      kind,
      axis: 'x',
      pivot,
      restAngleDeg: 0,
      openAngleDeg: kind === 'hinge' ? -95 : 0,
      restOffset: 0,
      openOffset: kind === 'slider' ? 1.1 : 0,
      duration: 0.8,
      easing: kind === 'hinge' ? 'smooth' : 'easeOut',
      playbackMode: 'toggle',
      triggers: [createDefaultTriggerRule()],
    };
    pushHistory(doc, mechanisms);
    setMechanisms((prev) => [...prev, newMech]);
    setActiveMechanismId(newMech.id);
    setSelectedMechNodePath(fallbackNode.path);
    setMechProgress(0);
    flashToast(`Added ${kind} to ${fallbackNode.label}`);
  };

  const handleApplyMechanismPreset = (preset: MechanismPresetDef, mode: 'replace' | 'add') => {
    const targetNode =
      selectedMechNode ??
      (activeMechanism
        ? scenePartNodes.find((n) => n.path === activeMechanism.targetNodePath)
        : null) ??
      scenePartNodes[scenePartNodes.length > 1 ? 1 : 0] ??
      scenePartNodes[0] ??
      null;
    if (!targetNode) {
      flashToast('Select a movable part first');
      return;
    }
    const built = instantiatePresetForPart(preset, targetNode);
    pushHistory(doc, mechanisms);
    if (mode === 'replace' && activeMechanism) {
      setMechanisms((prev) =>
        prev.map((m) => (m.id === activeMechanism.id ? { ...built, id: activeMechanism.id } : m))
      );
    } else {
      setMechanisms((prev) => [...prev, built]);
      setActiveMechanismId(built.id);
    }
    setSelectedMechNodePath(targetNode.path);
    setMechProgress(0);
    flashToast(`Applied "${preset.name}"`);
  };

  const handleSaveCurrentMechanismPreset = () => {
    if (!activeMechanism) return;
    const preset = createPresetFromMechanism(
      activeMechanism,
      newPresetName.trim() || activeMechanism.name
    );
    const next = [preset, ...customPresets];
    setCustomPresets(next);
    saveCustomMechanismPresets(next);
    setSavingPreset(false);
    setNewPresetName('');
    flashToast(`Saved preset "${preset.name}"`);
  };

  const handleApplyBodyPartToLinkedInventory = useCallback(async () => {
    if (!linkedInventoryItemId) return;
    const existingInv = getProjectInventoryItems(store.currentProject).find(
      (i) => i.id === linkedInventoryItemId
    );
    if (!existingInv) return;

    store.updateInventoryItem({
      ...existingInv,
      attachBodyPart: attachBodyPart ?? undefined,
    });
    if (editingAssetId) {
      const existingAsset = store.customAssets.find((a) => a.id === editingAssetId);
      if (existingAsset) {
        await store.updateCustomAssetMeta({
          ...existingAsset,
          attachBodyPart: attachBodyPart ?? undefined,
          linkedInventoryItemId,
        });
      }
    }
    flashToast(
      attachBodyPart
        ? `Assigned "${existingInv.name}" to ${
            OBJECT_BODY_PART_OPTIONS.find((o) => o.id === attachBodyPart)?.short ?? attachBodyPart
          }`
        : `Cleared body part for "${existingInv.name}"`
    );
  }, [linkedInventoryItemId, attachBodyPart, editingAssetId, store, flashToast]);

  // Save built GLB + recipe + mechanisms + vertex paint into Asset Vault & optional world placement
  const handleSaveAsset = async (opts?: { asCopy?: boolean; placeNow?: boolean }): Promise<string | null> => {
    const cleanName = objectName.trim() || 'Custom Object';
    setSaving(true);
    try {
      let meta: CustomAssetMeta | null = null;
      const strokesToSave = paintStrokes.length > 0 ? paintStrokes : undefined;

      // Fast-path when opened solely to assign a body part to an existing procedural inventory item without sculpting a new 3D mesh
      if (
        linkedInventoryItemId &&
        !editingAssetId &&
        !externalGlbMode &&
        !geometryDirty &&
        paintStrokes.length === 0 &&
        mechanisms.length === 0 &&
        !opts?.placeNow &&
        !opts?.asCopy
      ) {
        await handleApplyBodyPartToLinkedInventory();
        return null;
      }

      if (externalGlbMode && editingAssetId) {
        const existing = store.customAssets.find((a) => a.id === editingAssetId);
        if (!existing) throw new Error('Existing asset not found');
        const nextThumb = await regenerateCustomAssetThumbnail(
          existing.id,
          assetCategory,
          strokesToSave
        );
        meta = {
          ...existing,
          name: cleanName,
          category: assetCategory,
          mechanisms: mechanisms.length > 0 ? mechanisms : undefined,
          interactionAttributes:
            interactionAttributes.length > 0 ? interactionAttributes : undefined,
          interactionCalibrations:
            Object.keys(interactionCalibrations).length > 0
              ? interactionCalibrations
              : undefined,
          vertexPaintStrokes: strokesToSave,
          attachBodyPart: attachBodyPart ?? undefined,
          linkedInventoryItemId: linkedInventoryItemId ?? undefined,
          thumbnailDataUrl: nextThumb ?? existing.thumbnailDataUrl,
        };
        await store.updateCustomAssetMeta(meta);
        flashToast(`Updated "${cleanName}" in Assets`);
      } else {
        const uniqueDoc = ensureUniquePartAndGroupNames(doc);
        const { doc: groundedDoc, shift } = centerAndGroundObjectDoc(uniqueDoc);
        // Shift mechanism pivots and vertex paint strokes to stay aligned after X/Z centering & floor grounding
        const shiftedMechs = mechanisms.map((m) => ({
          ...m,
          pivot: [
            Number((m.pivot[0] + shift[0]).toFixed(4)),
            Number((m.pivot[1] + shift[1]).toFixed(4)),
            Number((m.pivot[2] + shift[2]).toFixed(4)),
          ] as [number, number, number],
        }));
        const shiftedStrokes = paintStrokes.length > 0 ? shiftVertexPaintStrokes(paintStrokes, shift) : [];
        const docWithPaint: ObjectMakerDoc = {
          ...groundedDoc,
          attachBodyPart: attachBodyPart ?? undefined,
          linkedInventoryItemId: linkedInventoryItemId ?? undefined,
          interactionAttributes:
            interactionAttributes.length > 0 ? interactionAttributes : undefined,
          interactionCalibrations:
            Object.keys(interactionCalibrations).length > 0
              ? interactionCalibrations
              : undefined,
          vertexPaintStrokes: shiftedStrokes.length > 0 ? shiftedStrokes : undefined,
        };

        const { buffer } = await buildAndExportObjectDocToGlb(docWithPaint);
        const targetId = opts?.asCopy ? undefined : editingAssetId ?? undefined;
        meta = await store.saveGeneratedAsset({
          existingAssetId: targetId,
          name: cleanName,
          category: assetCategory,
          buffer,
          mechanisms: shiftedMechs,
          interactionAttributes,
          interactionCalibrations,
          objectRecipe: docWithPaint,
          vertexPaintStrokes: shiftedStrokes.length > 0 ? shiftedStrokes : undefined,
          keepMetricScale: true,
          attachBodyPart,
          linkedInventoryItemId,
        });
        setDoc(docWithPaint);
        setMechanisms(shiftedMechs);
        setPaintStrokes(shiftedStrokes);
        setEditingAssetId(meta.id);
        setGeometryDirty(false);
        flashToast(targetId ? `Saved "${meta.name}"` : `Added "${meta.name}" to Assets`);
      }

      if (meta && !opts?.asCopy && (includeInInventory || linkedInventoryItemId)) {
        const existingInv = linkedInventoryItemId
          ? getProjectInventoryItems(store.currentProject).find(
              (i) => i.id === linkedInventoryItemId
            )
          : undefined;
        if (existingInv) {
          store.updateInventoryItem({
            ...existingInv,
            attachBodyPart: attachBodyPart ?? undefined,
            ...((geometryDirty || externalGlbMode || Boolean(existingInv.customAssetId))
              ? { customAssetId: meta.id }
              : {}),
          });
        } else if (includeInInventory) {
          const newItemId = `custom_item_${meta.id}`;
          const newItem: InventoryItemDef = {
            id: newItemId,
            name: cleanName,
            category: inventoryCategory,
            icon:
              inventoryCategory === 'weapon'
                ? 'sword'
                : inventoryCategory === 'wearable'
                ? 'shield'
                : 'sparkles',
            meshKind:
              inventoryCategory === 'weapon'
                ? 'sword'
                : inventoryCategory === 'wearable'
                ? 'shield'
                : 'gem',
            colorHex: doc.parts[0]?.material.color || '#7C5CFF',
            description: 'Custom object created in Object Editor.',
            customAssetId: meta.id,
            attachBodyPart: attachBodyPart ?? undefined,
            ...(attachBodyPart === 'rightHand'
              ? { toolKind: 'sword' as const }
              : attachBodyPart === 'leftHand'
              ? { wearSlot: 'offhand' as const }
              : attachBodyPart === 'head'
              ? { wearSlot: 'head' as const }
              : attachBodyPart === 'back' || attachBodyPart === 'chest'
              ? { wearSlot: 'body' as const }
              : attachBodyPart === 'neck'
              ? { wearSlot: 'accessory' as const }
              : {}),
          };
          store.addInventoryItem(newItem);
          setLinkedInventoryItemId(newItemId);
          await store.updateCustomAssetMeta({ ...meta, linkedInventoryItemId: newItemId });
          flashToast(`Saved "${cleanName}" to Inventory`);
        }
      }

      if (meta && opts?.placeNow) {
        const kind =
          assetCategory === 'character'
            ? 'npc'
            : assetCategory === 'prop' || assetCategory === 'building'
            ? 'prop'
            : 'scenery';
        const hero = store.currentLevel?.entities.find((e) => e.kind === 'hero');
        const bx = hero ? Math.min(0.86, hero.position.x + 0.08) : 0.5;
        const by = hero ? Math.min(0.86, hero.position.y + 0.06) : 0.5;
        const placed = store.addEntity(kind, meta.name, { x: bx, y: by }, meta.id);
        if (
          placed &&
          ((meta.mechanisms && meta.mechanisms.length > 0) ||
            meta.vertexPaintStrokes?.length ||
            meta.interactionAttributes?.length)
        ) {
          store.updateEntity(
            placed.id,
            `attach features to ${meta.name}`,
            (ent) => ({
              ...ent,
              ...(meta!.mechanisms?.length
                ? { mechanisms: JSON.parse(JSON.stringify(meta!.mechanisms)) }
                : {}),
              ...(meta!.interactionAttributes?.length
                ? { interactionAttributes: [...meta!.interactionAttributes] }
                : {}),
              ...(meta!.interactionCalibrations
                ? {
                    interactionCalibrations: JSON.parse(
                      JSON.stringify(meta!.interactionCalibrations)
                    ) as Partial<
                      Record<ObjectInteractionAttributeId, ObjectInteractionCalibration>
                    >,
                  }
                : {}),
              ...(meta!.vertexPaintStrokes?.length
                ? {
                    vertexPaintStrokes: JSON.parse(
                      JSON.stringify(meta!.vertexPaintStrokes)
                    ) as VertexPaintStroke[],
                  }
                : {}),
            }),
            false
          );
        }
        flashToast(`Saved & placed "${meta.name}" in level`);
      }
      return meta?.id ?? null;
    } catch (err) {
      flashToast(err instanceof Error ? err.message : 'Save failed');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAttributesModal = async () => {
    const id = editingAssetId ?? (await handleSaveAsset({ placeNow: false }));
    if (id) {
      store.setAttributeModifierTarget({ kind: 'assetMeta', assetId: id });
    }
  };

  useRegisterStudioAiBridge({
    id: 'modal-object',
    context: 'object',
    title: `Object Maker · ${objectName}`,
    subtitle: 'AI constructs multi-part props & mechanisms',
    saveLabel: 'Save to Objects',
    getSnapshot: () => ({
      name: objectName,
      category: assetCategory,
      attachBodyPart,
      partsCount: doc.parts.length,
      parts: doc.parts
        .map((p) => ({
          name: p.name,
          shape: p.shape,
          position: p.position,
          dimensions: p.dimensions,
          color: p.material.color,
        }))
        .slice(0, 14),
    }),
    applyResult: (raw, options) => {
      const res = sanitizeObjectMakerResult(raw, {
        doc,
        mechanisms,
        name: objectName,
        category: assetCategory,
        attachBodyPart,
        modifyExisting: Boolean(options?.modifyExisting),
      });
      setUndoStack((u) => [...u.slice(-24), { doc, mechanisms }]);
      setExternalGlbMode(false);
      if (!options?.modifyExisting) {
        setEditingAssetId(null);
      }
      setObjectName(res.name);
      setAssetCategory(res.category);
      setDoc(res.doc);
      setMechanisms(res.mechanisms);
      setAttachBodyPart(res.attachBodyPart);
      setSelectedPartIds([res.doc.parts[0]?.id].filter(Boolean));
      setGeometryDirty(true);
      flashToast(res.summary);
      return res.summary;
    },
    saveAsset: async (suggestedName) => {
      if (suggestedName) setObjectName(suggestedName);
      const id = await handleSaveAsset({ placeNow: false });
      return id ? `Saved "${suggestedName || objectName}" to Objects` : 'Save failed';
    },
  });

  // ---------------------------------------------------------------------------
  // UNIFIED 3D STUDIO VIEWPORT (Modeling + Curve Guide + Marquee + Mechanics)
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
    mechHelperGroup: THREE.Group;
    selectionBoxGroup: THREE.Group;
    partMeshes: Map<string, THREE.Mesh>;
    groupNodes: Map<string, THREE.Group>;
    curveHandleMeshes: THREE.Mesh[];
    multiProxy: THREE.Group;
    pivotProxy: THREE.Object3D;
    mechController: MechanismRuntimeController | null;
    isDraggingGizmo: boolean;
    paintSession: MakerVertexPaintSession;
    paintableMeshes: THREE.Mesh[];
  } | null>(null);

  // Latest state refs for smooth pointer/animation closures without tearing down renderer
  const latestRef = useRef({
    doc,
    mechanisms,
    externalGlbMode,
    editingAssetId,
    toolMode,
    gridSnapStep,
    selectedPartIds,
    selectedGroupId,
    inspectorTab,
    curveEnabled,
    curveCfg,
    activeCurvePtIdx,
    activeMechanismId,
    showPivotGizmo,
    mechProgress,
    mechTargetOpen,
    paintBrush,
    paintTool,
    spaceOrbiting,
  });
  latestRef.current = {
    doc,
    mechanisms,
    externalGlbMode,
    editingAssetId,
    toolMode,
    gridSnapStep,
    selectedPartIds,
    selectedGroupId,
    inspectorTab,
    curveEnabled,
    curveCfg,
    activeCurvePtIdx,
    activeMechanismId,
    showPivotGizmo,
    mechProgress,
    mechTargetOpen,
    paintBrush,
    paintTool,
    spaceOrbiting,
  };

  // Mount Three.js renderer once
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
    scene.background = new THREE.Color('#131822');
    let envTex: THREE.Texture | null = null;

    const camera = new THREE.PerspectiveCamera(42, width / Math.max(1, height), 0.05, 160);
    camera.position.set(3.4, 2.55, 3.9);

    const hemi = new THREE.HemisphereLight('#E2EEFF', '#283044', 0.85);
    const keyLight = new THREE.DirectionalLight('#FFF5E0', 1.8);
    keyLight.position.set(5, 8.5, 6);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 26;
    const fillLight = new THREE.DirectionalLight('#93C5FD', 0.65);
    fillLight.position.set(-4.5, 4, -4);
    scene.add(hemi, keyLight, fillLight);

    // Pedestal & crisp floor grid
    const floorMat = new THREE.MeshStandardMaterial({
      color: '#1A202D',
      roughness: 0.88,
      metalness: 0.06,
    });
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 4.95, 0.08, 56), floorMat);
    floor.position.y = -0.04;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(9.0, 18, '#3B4562', '#262E44');
    grid.position.y = 0.002;
    scene.add(grid);

    const objectRootHolder = new THREE.Group();
    const curveGroup = new THREE.Group();
    const mechHelperGroup = new THREE.Group();
    const selectionBoxGroup = new THREE.Group();
    const multiProxy = new THREE.Group();
    const pivotProxy = new THREE.Object3D();
    scene.add(
      objectRootHolder,
      curveGroup,
      mechHelperGroup,
      selectionBoxGroup,
      multiProxy,
      pivotProxy
    );

    // IMPORTANT: TransformControls MUST attach before OrbitControls so gizmo drags win
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
      c.target.set(0, 0.65, 0);
      c.enableDamping = !isSoftwareGl;
      c.dampingFactor = 0.08;
      c.minDistance = 0.9;
      c.maxDistance = 24;
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
      mechHelperGroup,
      selectionBoxGroup,
      partMeshes: new Map<string, THREE.Mesh>(),
      groupNodes: new Map<string, THREE.Group>(),
      curveHandleMeshes: [] as THREE.Mesh[],
      multiProxy,
      pivotProxy,
      mechController: null as MechanismRuntimeController | null,
      isDraggingGizmo: false,
      paintSession,
      paintableMeshes: [] as THREE.Mesh[],
    };
    studioRef.current = studioState;

    // Live non-destructive gizmo drag: mutate 3D objects smoothly during drag,
    // then commit a single clean Undo + Doc state update when the drag finishes.
    let dragPreSnapshot: { doc: ObjectMakerDoc; mechanisms: ObjectMechanism[] } | null = null;
    let multiStartSnapshot: {
      center: THREE.Vector3;
      parts: {
        id: string;
        pos: THREE.Vector3;
        quat: THREE.Quaternion;
      }[];
    } | null = null;

    const refreshLiveSelectionBoxes = () => {
      disposeObject3D(studioState.selectionBoxGroup);
      studioState.selectionBoxGroup.clear();
      const cur = latestRef.current;
      if (cur.externalGlbMode || cur.inspectorTab === 'mechanics') return;
      const box = new THREE.Box3();
      for (const pid of cur.selectedPartIds) {
        const mesh = studioState.partMeshes.get(pid);
        if (!mesh) continue;
        mesh.updateMatrixWorld(true);
        box.setFromObject(mesh);
        if (!box.isEmpty()) {
          studioState.selectionBoxGroup.add(new THREE.Box3Helper(box.clone(), new THREE.Color('#38BDF8')));
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
        dragPreSnapshot = {
          doc: JSON.parse(JSON.stringify(cur.doc)) as ObjectMakerDoc,
          mechanisms: JSON.parse(JSON.stringify(cur.mechanisms)) as ObjectMechanism[],
        };
        if (
          cur.inspectorTab !== 'mechanics' &&
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

      // Drag finished -> commit final transform cleanly once without mid-drag mesh destruction
      setGizmoHudText(null);
      if (!attached || !dragPreSnapshot) {
        dragPreSnapshot = null;
        multiStartSnapshot = null;
        return;
      }

      const preSnap = dragPreSnapshot;
      dragPreSnapshot = null;

      // 1. Mechanism Pivot Proxy commit (adds undo step)
      if (attached === pivotProxy && cur.activeMechanismId) {
        pushHistory(preSnap.doc, preSnap.mechanisms);
        multiStartSnapshot = null;
        return;
      }

      // 2. Curve handle already updated curveCfg
      if (typeof attached.userData.curvePtIdx === 'number') {
        multiStartSnapshot = null;
        return;
      }

      // 3. Single Group commit
      if (attached.userData.groupId) {
        const gid = attached.userData.groupId as string;
        const pos = attached.position.clone();
        const rot = attached.rotation.clone();
        const scl = attached.scale.clone();
        pushHistory(preSnap.doc, preSnap.mechanisms);
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
                }
              : g
          ),
        }));
        multiStartSnapshot = null;
        return;
      }

      // 4. Multi-part selection commit (supports Move, Rotate & Scale around centroid)
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

        pushHistory(preSnap.doc, preSnap.mechanisms);
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
                  Number(Math.max(0.06, p.dimensions[0] * Math.abs(scl.x)).toFixed(3)),
                  Number(Math.max(0.06, p.dimensions[1] * Math.abs(scl.y)).toFixed(3)),
                  Number(Math.max(0.06, p.dimensions[2] * Math.abs(scl.z)).toFixed(3)),
                ]
              : p.dimensions;
            let nextBaked = p.bakedGeometry;
            if (didScale && p.shape === 'csgResult' && p.bakedGeometry) {
              const oldPos = p.bakedGeometry.positions;
              const scaledPos = new Array<number>(oldPos.length);
              for (let i = 0; i < oldPos.length; i += 3) {
                scaledPos[i] = oldPos[i] * Math.abs(scl.x);
                scaledPos[i + 1] = oldPos[i + 1] * Math.abs(scl.y);
                scaledPos[i + 2] = oldPos[i + 2] * Math.abs(scl.z);
              }
              nextBaked = { ...p.bakedGeometry, positions: scaledPos };
            }
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
              bakedGeometry: nextBaked,
            };
          }),
        }));
        multiProxy.rotation.set(0, 0, 0);
        multiProxy.scale.set(1, 1, 1);
        return;
      }

      // 5. Single Part commit
      if (attached.userData.partId) {
        const pid = attached.userData.partId as string;
        const pos = attached.position.clone();
        const rot = attached.rotation.clone();
        const scl = attached.scale.clone();
        const didScale =
          Math.abs(scl.x - 1) > 0.002 || Math.abs(scl.y - 1) > 0.002 || Math.abs(scl.z - 1) > 0.002;
        attached.scale.set(1, 1, 1);

        pushHistory(preSnap.doc, preSnap.mechanisms);
        setDoc((prev) => ({
          ...prev,
          parts: prev.parts.map((p) => {
            if (p.id !== pid) return p;
            const nextDims: [number, number, number] = didScale
              ? [
                  Number(Math.max(0.06, p.dimensions[0] * Math.abs(scl.x)).toFixed(3)),
                  Number(Math.max(0.06, p.dimensions[1] * Math.abs(scl.y)).toFixed(3)),
                  Number(Math.max(0.06, p.dimensions[2] * Math.abs(scl.z)).toFixed(3)),
                ]
              : p.dimensions;
            let nextBaked = p.bakedGeometry;
            if (didScale && p.shape === 'csgResult' && p.bakedGeometry) {
              const oldPos = p.bakedGeometry.positions;
              const scaledPos = new Array<number>(oldPos.length);
              for (let i = 0; i < oldPos.length; i += 3) {
                scaledPos[i] = oldPos[i] * Math.abs(scl.x);
                scaledPos[i + 1] = oldPos[i + 1] * Math.abs(scl.y);
                scaledPos[i + 2] = oldPos[i + 2] * Math.abs(scl.z);
              }
              nextBaked = { ...p.bakedGeometry, positions: scaledPos };
            }
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
              bakedGeometry: nextBaked,
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

      // 1. Pivot Gizmo in Mechanics Mode (no doc rebuild!)
      if (attached === pivotProxy && cur.activeMechanismId) {
        const nextPivot: [number, number, number] = [
          Number(pivotProxy.position.x.toFixed(3)),
          Number(pivotProxy.position.y.toFixed(3)),
          Number(pivotProxy.position.z.toFixed(3)),
        ];
        setMechanisms((prev) =>
          prev.map((m) => (m.id === cur.activeMechanismId ? { ...m, pivot: nextPivot } : m))
        );
        setGizmoHudText(`Pivot: ${nextPivot[0].toFixed(2)}, ${nextPivot[1].toFixed(2)}, ${nextPivot[2].toFixed(2)}m`);
        return;
      }

      // 2. Curve Guide control point drag (no doc rebuild!)
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
        setGizmoHudText(`Point ${ptIdx + 1}: ${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}m`);
        return;
      }

      // 3. Multi-part selection live preview (Move, Rotate & Scale in Three.js directly)
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

      // 4. Single Part or Group live preview (attached mesh/group mutates smoothly without doc rebuild)
      if (attached.userData.partId || attached.userData.groupId) {
        refreshLiveSelectionBoxes();
        const mode = transformControls.getMode();
        if (mode === 'scale') {
          const partSpec = attached.userData.partId
            ? cur.doc.parts.find((p) => p.id === attached.userData.partId)
            : null;
          if (partSpec) {
            const w = Math.max(0.06, partSpec.dimensions[0] * Math.abs(attached.scale.x));
            const h = Math.max(0.06, partSpec.dimensions[1] * Math.abs(attached.scale.y));
            const d = Math.max(0.06, partSpec.dimensions[2] * Math.abs(attached.scale.z));
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

    // Pointer Selection + 2D Marquee Box handling
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    let marqueeStart: { x: number; y: number } | null = null;
    let pointerDownClient: { x: number; y: number } | null = null;

    const getCanvasRect = () => renderer.domElement.getBoundingClientRect();

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (studioState.isDraggingGizmo) return;
      const cur = latestRef.current;
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

      // 1. Marquee drag selection in 2D viewport
      if (startM && latestRef.current.toolMode === 'select') {
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const rx = Math.min(startM.x, cx);
        const ry = Math.min(startM.y, cy);
        const rw = Math.abs(cx - startM.x);
        const rh = Math.abs(cy - startM.y);

        if (rw > 7 && rh > 7 && !latestRef.current.externalGlbMode) {
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

            if (
              anyInFront &&
              maxSX >= rx &&
              minSX <= rx + rw &&
              maxSY >= ry &&
              minSY <= ry + rh
            ) {
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

      // 2. Single Click Picking (only if didn't drag camera)
      if (!startPt || Math.hypot(e.clientX - startPt.x, e.clientY - startPt.y) > 6) {
        return;
      }
      if (studioState.isDraggingGizmo) return;

      pointerNdc.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(pointerNdc, camera);

      // Check curve control point handles first if curve guide active
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

      // Click on object meshes
      const hits = raycaster.intersectObjects(objectRootHolder.children, true);
      if (hits.length === 0) {
        if (!e.shiftKey && latestRef.current.toolMode === 'select') {
          setSelectedPartIds([]);
          setSelectedGroupId(null);
        }
        return;
      }

      const hitObj = hits[0].object;

      // In Mechanics tab or external GLB mode, pick part hierarchy node directly
      if (latestRef.current.inspectorTab === 'mechanics' || latestRef.current.externalGlbMode) {
        const mechRoot = objectRootHolder.children[0];
        if (mechRoot) {
          const path = findBestPartPathForObject(mechRoot, hitObj);
          if (path) {
            setSelectedMechNodePath(path);
            const matchedMech = latestRef.current.mechanisms.find(
              (m) => m.targetNodePath === path
            );
            if (matchedMech) setActiveMechanismId(matchedMech.id);
          }
        }
      }

      if (!latestRef.current.externalGlbMode) {
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
            if (pSpec?.parentGroupId && latestRef.current.selectedGroupId !== pSpec.parentGroupId && !e.altKey) {
              setSelectedPartIds([partId]);
              setSelectedGroupId(null);
            } else {
              setSelectedPartIds([partId]);
              setSelectedGroupId(null);
            }
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
    const timer = new THREE.Timer();

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

    const tick = () => {
      if (disposed) return;
      try {
        timer.update();
        const dt = Math.min(0.06, timer.getDelta());
        // Step live mechanism test playback when in Mechanics tab
        if (studioState.mechController && latestRef.current.inspectorTab === 'mechanics') {
          const moved = studioState.mechController.update(dt);
          if (moved && latestRef.current.activeMechanismId) {
            setMechProgress(studioState.mechController.getProgress(latestRef.current.activeMechanismId));
          }
        }
        studioState.controls.update();
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
      // Connect TransformControls BEFORE OrbitControls so gizmo handle drags always take priority!
      transformControls.connect(renderer.domElement);
      controls = createControls(renderer.domElement);
      attachCanvasPointerListeners(renderer.domElement);
      studioState.renderer = renderer;
      studioState.controls = controls;
      try {
        await renderer.init();
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
        await renderer.init();
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
      studioState.controls.dispose();
      timer.dispose();
      envTex?.dispose();
      disposeObject3D(scene);
      try {
        renderer.dispose();
      } catch {
        // ignore
      }
      studioRef.current = null;
    };
  }, []);

  // Rebuild Object 3D scene whenever doc OR externalGlbMode/asset changes (skipped if mid-drag)
  useEffect(() => {
    const s = studioRef.current;
    if (!s || s.isDraggingGizmo) return;

    s.transformControls.detach();
    s.mechController = null;
    disposeObject3D(s.objectRootHolder);
    s.objectRootHolder.clear();
    s.partMeshes.clear();
    s.groupNodes.clear();
    s.paintableMeshes = [];

    if (externalGlbMode && editingAssetId) {
      const cached = getCachedAssetSync(editingAssetId);
      if (cached) {
        const clone = cached.scene.clone(true);
        clone.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(clone);
        const center = new THREE.Vector3();
        box.getCenter(center);
        clone.position.x -= center.x;
        clone.position.z -= center.z;
        clone.position.y -= box.min.y;
        s.objectRootHolder.add(clone);
        s.paintableMeshes = prepareObjectForVertexPainting(clone);
        const nodes = inspectObjectHierarchy(clone);
        setScenePartNodes(nodes);
        s.mechController = new MechanismRuntimeController(clone, mechanisms);
      }
      return;
    }

    const built = buildObjectMakerSceneGroup(doc, true);
    s.objectRootHolder.add(built.root);
    s.partMeshes = built.partMeshes;
    s.groupNodes = built.groupNodes;
    s.paintableMeshes = prepareObjectForVertexPainting(built.root);
    const nodes = inspectObjectHierarchy(built.root);
    setScenePartNodes(nodes);
    s.mechController = new MechanismRuntimeController(built.root, mechanisms);
  }, [doc, externalGlbMode, externalGlbVersion, editingAssetId]);

  // Replay non-destructive vertex paint strokes whenever doc rebuilds or paintStrokes change
  useEffect(() => {
    const s = studioRef.current;
    const root = s?.objectRootHolder.children[0];
    if (!s || !root || s.isDraggingGizmo || s.paintSession.brushing) return;
    resetObjectVertexPaint(root);
    if (paintStrokes.length > 0) {
      applyVertexPaintStrokesToObject(root, paintStrokes);
    }
  }, [paintStrokes, doc, externalGlbMode, externalGlbVersion, editingAssetId]);

  // Keep MechanismController synced when mechanisms list updates
  useEffect(() => {
    const s = studioRef.current;
    const root = s?.objectRootHolder.children[0];
    if (!s || !root) return;
    s.mechController = new MechanismRuntimeController(root, mechanisms);
    if (inspectorTab === 'mechanics' && activeMechanismId) {
      s.mechController.setProgressImmediate(activeMechanismId, mechProgress);
    }
  }, [mechanisms, inspectorTab]);

  // Scrub / Test playback sync
  useEffect(() => {
    const s = studioRef.current;
    if (!s?.mechController || !activeMechanismId) return;
    if (mechTargetOpen !== null) {
      s.mechController.trigger(activeMechanismId, mechTargetOpen ? 'open' : 'close');
      setMechTargetOpen(null);
    } else {
      s.mechController.setProgressImmediate(activeMechanismId, mechProgress);
    }
  }, [mechProgress, mechTargetOpen, activeMechanismId]);

  // Rebuild Curve Guide spline & larger grab-friendly control point spheres
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
    const lineMat = new THREE.LineBasicMaterial({ color: '#38BDF8' });
    const line = new THREE.Line(lineGeo, lineMat);
    s.curveGroup.add(line);

    const sphereGeo = new THREE.SphereGeometry(0.12, 16, 12);
    curveCfg.points.forEach((pt, idx) => {
      const active = activeCurvePtIdx === idx;
      const mat = new THREE.MeshBasicMaterial({
        color: active ? '#F59E0B' : '#38BDF8',
      });
      const handle = new THREE.Mesh(sphereGeo, mat);
      handle.position.set(pt[0], pt[1], pt[2]);
      handle.userData.curvePtIdx = idx;
      s.curveGroup.add(handle);
      s.curveHandleMeshes.push(handle);
    });
  }, [curveEnabled, curveCfg, activeCurvePtIdx]);

  // Rebuild Selection Bounding Boxes + TransformControls attachment + Mechanism Hinge/Slider Gizmo
  useEffect(() => {
    const s = studioRef.current;
    if (!s || s.isDraggingGizmo) return;

    // 1. Controls Orbit vs Select Marquee vs Vertex Paint mode
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

    // 2. Snap & Transform Mode
    const tc = s.transformControls;
    const snap = gridSnapStep > 0 ? gridSnapStep : null;
    tc.setTranslationSnap(snap);
    tc.setRotationSnap(gridSnapStep > 0 ? THREE.MathUtils.degToRad(15) : null);
    tc.setScaleSnap(gridSnapStep > 0 ? gridSnapStep : null);

    // 3. Selection Box outlines
    disposeObject3D(s.selectionBoxGroup);
    s.selectionBoxGroup.clear();
    if (!externalGlbMode && inspectorTab !== 'mechanics' && inspectorTab !== 'paint') {
      const box = new THREE.Box3();
      for (const pid of selectedPartIds) {
        const mesh = s.partMeshes.get(pid);
        if (!mesh) continue;
        box.setFromObject(mesh);
        if (!box.isEmpty()) {
          const helper = new THREE.Box3Helper(box.clone(), new THREE.Color('#38BDF8'));
          s.selectionBoxGroup.add(helper);
        }
      }
      if (selectedGroupId) {
        const grp = s.groupNodes.get(selectedGroupId);
        if (grp) {
          box.setFromObject(grp);
          if (!box.isEmpty()) {
            const helper = new THREE.Box3Helper(box.clone(), new THREE.Color('#A855F7'));
            s.selectionBoxGroup.add(helper);
          }
        }
      }
    }

    // 4. Mechanism Hinge Pivot & Axis / Slider Track Visualizer
    disposeObject3D(s.mechHelperGroup);
    s.mechHelperGroup.clear();
    if (inspectorTab === 'mechanics' && activeMechanism) {
      const axisColor =
        activeMechanism.axis === 'x'
          ? '#FF4D6D'
          : activeMechanism.axis === 'y'
          ? '#22C55E'
          : '#38BDF8';
      const [px, py, pz] = activeMechanism.pivot;

      if (activeMechanism.kind === 'hinge') {
        const pivotBall = new THREE.Mesh(
          new THREE.SphereGeometry(0.095, 16, 12),
          new THREE.MeshBasicMaterial({ color: '#F59E0B' })
        );
        pivotBall.position.set(px, py, pz);
        s.mechHelperGroup.add(pivotBall);

        const pinGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.96, 10);
        if (activeMechanism.axis === 'x') pinGeo.rotateZ(Math.PI / 2);
        else if (activeMechanism.axis === 'z') pinGeo.rotateX(Math.PI / 2);
        const pin = new THREE.Mesh(pinGeo, new THREE.MeshBasicMaterial({ color: axisColor }));
        pin.position.set(px, py, pz);
        s.mechHelperGroup.add(pin);
      } else {
        const dir = new THREE.Vector3(
          activeMechanism.axis === 'x' ? 1 : 0,
          activeMechanism.axis === 'y' ? 1 : 0,
          activeMechanism.axis === 'z' ? 1 : 0
        );
        const start = new THREE.Vector3(px, py, pz).addScaledVector(dir, activeMechanism.restOffset);
        const end = new THREE.Vector3(px, py, pz).addScaledVector(dir, activeMechanism.openOffset);
        const railGeo = new THREE.BufferGeometry().setFromPoints([start, end]);
        s.mechHelperGroup.add(
          new THREE.Line(railGeo, new THREE.LineBasicMaterial({ color: axisColor }))
        );
      }
    }

    // 5. TransformControls attachment target
    if (
      inspectorTab === 'mechanics' &&
      activeMechanism &&
      activeMechanism.kind === 'hinge' &&
      showPivotGizmo
    ) {
      s.pivotProxy.position.set(
        activeMechanism.pivot[0],
        activeMechanism.pivot[1],
        activeMechanism.pivot[2]
      );
      tc.setMode('translate');
      tc.attach(s.pivotProxy);
      return;
    }

    if (curveEnabled && activeCurvePtIdx !== null && s.curveHandleMeshes[activeCurvePtIdx]) {
      tc.setMode('translate');
      tc.attach(s.curveHandleMeshes[activeCurvePtIdx]);
      return;
    }

    if (externalGlbMode || toolMode === 'select' || inspectorTab === 'mechanics' || inspectorTab === 'paint') {
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
    doc,
    externalGlbMode,
    toolMode,
    gridSnapStep,
    selectedPartIds,
    selectedGroupId,
    inspectorTab,
    paintTool,
    spaceOrbiting,
    curveEnabled,
    curveCfg,
    activeCurvePtIdx,
    activeMechanism,
    showPivotGizmo,
  ]);

  // Keyboard shortcuts (Delete, Undo/Redo, W/E/R/Q, Space orbit & [ ] brush size in Paint tab)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (inspectorTab === 'paint') {
        if (e.code === 'Space') {
          e.preventDefault();
          setSpaceOrbiting(true);
          return;
        }
        if (e.key === '[') {
          setPaintBrush((b) => ({ ...b, radius: Math.max(0.12, Number((b.radius - 0.08).toFixed(2))) }));
          return;
        }
        if (e.key === ']') {
          setPaintBrush((b) => ({ ...b, radius: Math.min(2.4, Number((b.radius + 0.08).toFixed(2))) }));
          return;
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
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
      if (e.code === 'Space') setSpaceOrbiting(false);
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
    if (preset === 'front') {
      s.camera.position.set(0, 1.35, 4.6);
      s.controls.target.set(0, 0.7, 0);
    } else if (preset === 'top') {
      s.camera.position.set(0, 5.8, 0.01);
      s.controls.target.set(0, 0, 0);
    } else {
      s.camera.position.set(3.4, 2.55, 3.9);
      s.controls.target.set(0, 0.65, 0);
    }
    s.controls.update();
  };

  const cutterCount = useMemo(() => doc.parts.filter((p) => p.isCutter).length, [doc.parts]);
  const curveLength = useMemo(() => computeCurveLength(curveCfg), [curveCfg]);

  const filteredMechanismPresets = useMemo(() => {
    const q = presetSearch.trim().toLowerCase();
    return [...customPresets, ...BUILTIN_MECHANISM_PRESETS].filter((p) => {
      if (presetFilter !== 'all' && p.category !== presetFilter) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.summary.toLowerCase().includes(q);
    });
  }, [customPresets, presetFilter, presetSearch]);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-1 sm:p-2">
      <div className="w-full max-w-[1760px] h-[95dvh] rounded-2xl bg-white dark:bg-[#171A23] text-slate-900 dark:text-[#F3F5FA] border border-slate-200/80 dark:border-white/[0.1] shadow-2xl flex flex-col overflow-hidden">
        {/* TOP HEADER */}
        <header className="shrink-0 px-3.5 py-2.5 border-b border-slate-200/80 dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-[#171A23]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#7C5CFF]/15 text-[#7C5CFF] flex items-center justify-center shrink-0">
              <Shapes size={17} />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#7C5CFF] hidden sm:inline">
                Object Maker
              </span>
              <input
                type="text"
                value={objectName}
                onChange={(e) => setObjectName(e.target.value)}
                maxLength={40}
                placeholder="Object name…"
                className="w-40 sm:w-52 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.08] text-xs font-extrabold focus:outline-none focus:border-[#7C5CFF]"
              />
              <select
                value={assetCategory}
                onChange={(e) => setAssetCategory(e.target.value as AssetCategory)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.08] text-xs font-bold"
              >
                <option value="prop">Object / Prop</option>
                <option value="building">Building</option>
                <option value="scenery">Scenery</option>
                <option value="plant">Plant</option>
                <option value="tree">Tree</option>
                <option value="character">Character</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Load / Edit Existing Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLoadMenu((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1F2430] hover:bg-slate-200 dark:hover:bg-[#282F3F] text-xs font-bold"
              >
                <FolderOpen size={13} className="text-[#38BDF8]" />
                <span>Load / Edit Existing</span>
                <ChevronDown size={12} />
              </button>

              {showLoadMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowLoadMenu(false)} />
                  <div className="absolute right-0 mt-1.5 w-80 max-h-[65vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#1B202C] shadow-2xl border border-slate-200/80 dark:border-white/[0.12] p-2.5 z-40 space-y-2 maker-scroll">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#949BB0]">
                        Your Saved Assets ({store.customAssets.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAssetId(null);
                          setExternalGlbMode(false);
                          setObjectName('New Object');
                          setDoc(createStarterObjectDoc());
                          setMechanisms([]);
                          setShowLoadMenu(false);
                        }}
                        className="text-[11px] font-bold text-[#7C5CFF] hover:underline"
                      >
                        + Starter Table
                      </button>
                    </div>

                    {store.customAssets.length === 0 ? (
                      <div className="text-xs text-slate-500 dark:text-[#8E96AB] px-2 py-2">
                        No saved objects yet. Create one here or pick a template below!
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {store.customAssets.map((asset) => (
                          <button
                            key={asset.id}
                            type="button"
                            onClick={() => void loadExistingCustomAsset(asset)}
                            className={`w-full flex items-center gap-2.5 p-1.5 rounded-xl text-left transition-colors ${
                              editingAssetId === asset.id
                                ? 'bg-[#7C5CFF]/15 border border-[#7C5CFF]/40'
                                : 'hover:bg-slate-100 dark:hover:bg-[#252B3B]'
                            }`}
                          >
                            <AssetThumbnail customAsset={asset} size={36} rounded="rounded-lg" />
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold truncate">{asset.name}</div>
                              <div className="text-[10px] text-slate-500 dark:text-[#949BB0] flex items-center gap-1.5">
                                <span className="capitalize">{asset.category}</span>
                                <span>·</span>
                                <span>
                                  {asset.objectRecipe
                                    ? `${asset.objectRecipe.parts.length} parts`
                                    : 'Imported GLB'}
                                </span>
                                {asset.mechanisms && asset.mechanisms.length > 0 && (
                                  <span className="text-[#F59E0B] font-bold">
                                    · {asset.mechanisms.length} joint
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-200/80 dark:border-white/[0.08]">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#949BB0] px-1 mb-1">
                        Editable Mechanical &amp; Prop Starters
                      </div>
                      <div className="space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            const built = buildDocFromBuiltinTemplate('savePlinth');
                            setEditingAssetId(null);
                            setExternalGlbMode(false);
                            setObjectName(built.name);
                            setAssetCategory(built.category);
                            setDoc(built.doc);
                            setMechanisms([]);
                            setSelectedPartIds([built.doc.parts[0]?.id].filter(Boolean));
                            setActiveMechanismId(null);
                            setSelectedMechNodePath(null);
                            setInspectorTab('material');
                            setShowLoadMenu(false);
                            flashToast(`Loaded editable starter "${built.name}"`);
                          }}
                          className="w-full px-2.5 py-1.5 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-[#252B3B]"
                        >
                          <div className="text-xs font-bold text-[#38BDF8]">Save / Spawn Plinth</div>
                          <div className="text-[10px] text-slate-500 dark:text-[#949BB0] truncate">
                            Blue-glowing stone waystone with floating crystal
                          </div>
                        </button>
                        {BUILTIN_MECHANISM_TEMPLATES.map((tpl) => (
                          <button
                            key={tpl.id}
                            type="button"
                            onClick={() => {
                              const built = buildDocFromBuiltinTemplate(tpl.id);
                              setEditingAssetId(null);
                              setExternalGlbMode(false);
                              setObjectName(built.name);
                              setAssetCategory(built.category);
                              setDoc(built.doc);
                              setMechanisms(built.mechanisms);
                              setSelectedPartIds([built.doc.parts[0]?.id].filter(Boolean));
                              setActiveMechanismId(built.mechanisms[0]?.id ?? null);
                              setSelectedMechNodePath(built.mechanisms[0]?.targetNodePath ?? null);
                              setInspectorTab('mechanics');
                              setShowLoadMenu(false);
                              flashToast(`Loaded editable template "${built.name}"`);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-[#252B3B]"
                          >
                            <div className="text-xs font-bold">{tpl.name}</div>
                            <div className="text-[10px] text-slate-500 dark:text-[#949BB0] truncate">
                              {tpl.summary}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* AI Object Assistant */}
            <button
              type="button"
              onClick={() => requestOpenContextualAiModal('object')}
              title="AI Object Creator"
              className="px-2.5 py-1.5 rounded-xl bg-[#7C5CFF]/15 hover:bg-[#7C5CFF]/25 text-[#7C5CFF] dark:text-[#C4B5FD] border border-[#7C5CFF]/30 text-xs font-extrabold inline-flex items-center gap-1 whitespace-nowrap"
            >
              <Wand2 size={13} />
              <Sparkles size={11} className="text-[#F59E0B]" />
              <span>AI</span>
            </button>

            {/* Undo / Redo */}
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

            <button
              type="button"
              disabled={saving}
              onClick={() => void handleOpenAttributesModal()}
              title="Configure Role, Pickup & Dialogue defaults"
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1F2430] hover:bg-slate-200 dark:hover:bg-[#282F3F] text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
            >
              <SlidersHorizontal size={13} className="text-[#7C5CFF]" />
              <span className="hidden lg:inline">Attributes &amp; Role</span>
            </button>

            <label className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1F2430] text-[11px] font-bold cursor-pointer">
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
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1F2430] hover:bg-slate-200 dark:hover:bg-[#282F3F] text-xs font-bold disabled:opacity-50"
              >
                Save Copy
              </button>
            )}

            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSaveAsset({ placeNow: placeOnSave })}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#20B46A] hover:opacity-95 text-white text-xs font-extrabold shadow-sm disabled:opacity-50"
            >
              <Save size={13} />
              <span>{saving ? 'Exporting GLB…' : editingAssetId ? 'Save Changes' : 'Save to Assets'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close Object Maker"
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-500"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {/* MAIN STUDIO WORKSPACE */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* LEFT DOCK: Shape Spawner & Parts/Groups Tree */}
          {showLeftDock && (
            <aside className="w-[232px] shrink-0 border-r border-slate-200/80 dark:border-white/[0.08] bg-slate-50 dark:bg-[#131720] flex flex-col min-h-0">
              {!externalGlbMode ? (
                <>
                  {/* Primitives & Architectural Shapes */}
                  <div className="p-2.5 border-b border-slate-200/80 dark:border-white/[0.08] space-y-2 max-h-[46%] overflow-y-auto maker-scroll">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB]">
                        Add Shapes
                      </span>
                      <button
                        type="button"
                        onClick={() => addPrimitivePart('cube', true)}
                        title="Add a red boolean cutter block to carve holes or notches"
                        className="px-2 py-0.5 rounded-md bg-rose-500/15 hover:bg-rose-500 text-rose-500 hover:text-white text-[10px] font-extrabold transition-colors"
                      >
                        + Cut Volume
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {OBJECT_PRIMITIVE_CATALOG.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => addPrimitivePart(item.id, false)}
                          className="px-2 py-1.5 rounded-lg bg-white dark:bg-[#1B202C] hover:bg-[#7C5CFF] hover:text-white border border-slate-200/80 dark:border-white/[0.06] text-left text-[11px] font-bold truncate transition-colors"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Scene Hierarchy: Groups & Parts */}
                  <div className="flex-1 min-h-0 flex flex-col p-2.5 space-y-2">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB]">
                        Parts ({doc.parts.length})
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={handleGroupSelected}
                          disabled={selectedPartIds.length < 2}
                          title="Group selected parts"
                          className="p-1 rounded-md bg-white dark:bg-[#1B202C] border border-slate-200/80 dark:border-white/[0.06] disabled:opacity-35 hover:text-[#7C5CFF]"
                        >
                          <Group size={12} />
                        </button>
                        {selectedGroupId && (
                          <button
                            type="button"
                            onClick={() => handleUngroup(selectedGroupId)}
                            title="Ungroup"
                            className="p-1 rounded-md bg-white dark:bg-[#1B202C] border border-slate-200/80 dark:border-white/[0.06] hover:text-[#7C5CFF]"
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
                                const node = scenePartNodes.find((n) => n.name === grp.name);
                                if (node) setSelectedMechNodePath(node.path);
                              }}
                              className={`w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-extrabold text-left ${
                                isGrpSel
                                  ? 'bg-[#A855F7]/20 text-[#A855F7] ring-1 ring-[#A855F7]/40'
                                  : 'bg-white/70 dark:bg-[#1B202C] text-slate-700 dark:text-[#D5DCF0]'
                              }`}
                            >
                              <Layers size={11} />
                              <span className="truncate flex-1">{grp.name}</span>
                              <span className="text-[10px] opacity-60">{children.length}</span>
                            </button>
                            <div className="pl-3 space-y-0.5">
                              {children.map((part) => {
                                const sel = selectedPartIds.includes(part.id);
                                return (
                                  <div
                                    key={part.id}
                                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                                      sel
                                        ? 'bg-[#7C5CFF] text-white'
                                        : 'hover:bg-slate-200/70 dark:hover:bg-[#1F2533]'
                                    }`}
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
                                  >
                                    <span
                                      className={`w-2 h-2 rounded-full shrink-0 ${
                                        part.isCutter ? 'bg-rose-400' : 'bg-emerald-400'
                                      }`}
                                    />
                                    <span className="truncate flex-1">{part.name}</span>
                                    <button
                                      type="button"
                                      onClick={(ev) => {
                                        ev.stopPropagation();
                                        commitDoc((prev) => ({
                                          ...prev,
                                          parts: prev.parts.map((x) =>
                                            x.id === part.id ? { ...x, hidden: !x.hidden } : x
                                          ),
                                        }), false);
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
                                  ? 'bg-[#7C5CFF] text-white'
                                  : 'bg-white dark:bg-[#1B202C] hover:bg-slate-200/70 dark:hover:bg-[#23293A]'
                              }`}
                            >
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${
                                  part.isCutter ? 'bg-rose-400' : 'bg-[#38BDF8]'
                                }`}
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
                </>
              ) : (
                <div className="p-3 space-y-3 flex-1 min-h-0 flex flex-col">
                  <div className="rounded-xl bg-[#38BDF8]/10 border border-[#38BDF8]/30 p-2.5 space-y-1.5">
                    <div className="text-[11px] font-extrabold text-[#38BDF8]">
                      Imported GLB Mode
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-[#9FA8BE] leading-snug">
                      Inspect mesh parts below and attach Hinges, Sliders, or Triggers on the right.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setExternalGlbMode(false);
                        setEditingAssetId(null);
                        setDoc(createStarterObjectDoc());
                        setMechanisms([]);
                      }}
                      className="w-full py-1.5 rounded-lg bg-[#7C5CFF] text-white text-[11px] font-bold"
                    >
                      Start New Editable Object
                    </button>
                  </div>
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB]">
                    GLB Parts ({scenePartNodes.length})
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto space-y-1 maker-scroll">
                    {scenePartNodes.map((n) => (
                      <button
                        key={n.path}
                        type="button"
                        onClick={() => setSelectedMechNodePath(n.path)}
                        className={`w-full text-left px-2 py-1.5 rounded-lg text-[11px] font-semibold truncate ${
                          selectedMechNodePath === n.path
                            ? 'bg-[#7C5CFF] text-white'
                            : 'bg-white dark:bg-[#1B202C] hover:bg-slate-200/70 dark:hover:bg-[#23293A]'
                        }`}
                      >
                        {'— '.repeat(Math.min(n.depth, 3))}
                        {n.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          )}

          {/* CENTER 3D VIEWPORT */}
          <div className="flex-1 min-w-0 relative bg-[#131822] select-none touch-none">
            <div ref={viewportMountRef} className="w-full h-full touch-none" />

            {/* Live Gizmo Drag Readout */}
            {gizmoHudText && (
              <div className="absolute top-14 left-1/2 -translate-x-1/2 px-3 py-1 rounded-xl bg-[#0F1420]/95 border border-[#FFD32A]/60 text-xs font-mono font-extrabold text-[#FFD32A] shadow-xl pointer-events-none z-30">
                {gizmoHudText}
              </div>
            )}

            {/* 2D Marquee Box */}
            {marqueeRect && (
              <div
                className="absolute pointer-events-none border-2 border-dashed border-[#38BDF8] bg-[#38BDF8]/15 rounded-sm z-20"
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
              <div className="absolute top-14 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-xl bg-[#0F1420] border border-[#7C5CFF]/60 text-xs font-bold text-white shadow-xl pointer-events-none z-30">
                {toast}
              </div>
            )}

            {/* Top Viewport Controls Bar */}
            <div className="absolute top-2.5 left-2.5 right-2.5 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
              <div className="flex items-center gap-1.5 bg-[#0F141F]/90 border border-white/[0.1] rounded-xl p-1 pointer-events-auto">
                <button
                  type="button"
                  onClick={() => setShowLeftDock((v) => !v)}
                  className="px-2 py-1 rounded-lg text-[11px] font-bold text-slate-300 hover:bg-white/10"
                  title="Toggle Shapes & Parts Dock"
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
                    disabled={externalGlbMode && id !== 'select'}
                    onClick={() => {
                      setToolMode(id);
                      if (id !== 'translate') setActiveCurvePtIdx(null);
                    }}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-35 ${
                      toolMode === id
                        ? 'bg-[#7C5CFF] text-white'
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
                  title="Transform Snap Increment"
                >
                  <option value={0} className="bg-[#151A25]">Snap: Free</option>
                  <option value={0.05} className="bg-[#151A25]">Snap: 0.05m</option>
                  <option value={0.1} className="bg-[#151A25]">Snap: 0.10m</option>
                  <option value={0.25} className="bg-[#151A25]">Snap: 0.25m</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-[#0F141F]/90 border border-white/[0.1] rounded-xl p-1 pointer-events-auto">
                <button
                  type="button"
                  onClick={() => {
                    setCurveEnabled((v) => !v);
                    if (!curveEnabled) setInspectorTab('shape');
                  }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                    curveEnabled
                      ? 'bg-[#0EA5E9] text-white'
                      : 'text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <Spline size={12} />
                  <span>Curve Guide</span>
                </button>
                <div className="w-px h-4 bg-white/10" />
                {(
                  [
                    ['threeQuarter', '3/4'],
                    ['front', 'Front'],
                    ['top', 'Top'],
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

            {/* Bottom Contextual Action Strip */}
            <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-center gap-2 pointer-events-none">
              {inspectorTab === 'mechanics' && activeMechanism ? (
                <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-[#0F141F]/95 border border-white/[0.12] text-white pointer-events-auto shadow-xl">
                  <button
                    type="button"
                    onClick={() => setMechTargetOpen(mechProgress < 0.5)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#20B46A] text-white text-xs font-extrabold"
                  >
                    <Play size={12} fill="currentColor" />
                    <span>{mechProgress < 0.5 ? 'Test Open' : 'Test Close'}</span>
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={mechProgress}
                    onChange={(e) => {
                      setMechTargetOpen(null);
                      setMechProgress(Number(e.target.value));
                    }}
                    className="w-32 sm:w-44 accent-[#F59E0B]"
                  />
                  <span className="text-xs font-mono font-bold tabular-nums text-[#F59E0B]">
                    {activeMechanism.kind === 'hinge'
                      ? `${(
                          activeMechanism.restAngleDeg +
                          (activeMechanism.openAngleDeg - activeMechanism.restAngleDeg) *
                            mechProgress
                        ).toFixed(0)}°`
                      : `${(
                          activeMechanism.restOffset +
                          (activeMechanism.openOffset - activeMechanism.restOffset) * mechProgress
                        ).toFixed(2)}m`}
                  </span>
                  {activeMechanism.kind === 'hinge' && (
                    <button
                      type="button"
                      onClick={() => setShowPivotGizmo((v) => !v)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold ${
                        showPivotGizmo ? 'bg-[#F59E0B] text-slate-950' : 'bg-white/10 text-slate-200'
                      }`}
                    >
                      Pivot Gizmo
                    </button>
                  )}
                </div>
              ) : !externalGlbMode && selectedPartIds.length >= 2 ? (
                <div className="flex flex-wrap items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-[#0F141F]/95 border border-white/[0.12] text-white pointer-events-auto shadow-xl">
                  <span className="text-[11px] font-bold text-[#38BDF8] px-1">
                    {selectedPartIds.length} Selected:
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRunBoolean('union')}
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-[#7C5CFF] text-[11px] font-bold"
                  >
                    Union
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRunBoolean('subtract')}
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-[#7C5CFF] text-[11px] font-bold"
                  >
                    Subtract
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRunBoolean('intersect')}
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-[#7C5CFF] text-[11px] font-bold"
                  >
                    Intersect
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRunBoolean('combine')}
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-[#7C5CFF] text-[11px] font-bold"
                  >
                    Combine
                  </button>
                  <button
                    type="button"
                    onClick={handleGroupSelected}
                    className="px-2.5 py-1 rounded-lg bg-[#A855F7]/80 hover:bg-[#A855F7] text-[11px] font-bold"
                  >
                    Group
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteSelected}
                    className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white text-[11px] font-bold"
                  >
                    Delete
                  </button>
                </div>
              ) : !externalGlbMode && cutterCount > 0 ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-[#0F141F]/95 border border-rose-500/40 text-white pointer-events-auto shadow-xl">
                  <span className="text-[11px] font-bold text-rose-300">
                    {cutterCount} Cut Volume{cutterCount > 1 ? 's' : ''} active
                  </span>
                  <button
                    type="button"
                    onClick={handleApplyAllCutters}
                    className="px-3 py-1 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-extrabold"
                  >
                    Carve Cut Volumes
                  </button>
                </div>
              ) : toolMode === 'select' ? (
                <div className="px-3 py-1 rounded-xl bg-[#0F141F]/85 border border-white/[0.1] text-[11px] font-semibold text-slate-300">
                  Drag box to marquee multi-select · Shift+Click to add · Right-drag to orbit
                </div>
              ) : null}
            </div>
          </div>

          {/* RIGHT CONTEXTUAL INSPECTOR */}
          <aside className="w-[320px] xl:w-[348px] shrink-0 border-l border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#171A23] flex flex-col min-h-0">
            {/* 5 Tabs: Shape | Material | Paint | Joints | Actions */}
            <div className="shrink-0 p-2 border-b border-slate-200/80 dark:border-white/[0.08] grid grid-cols-5 gap-1 bg-slate-50 dark:bg-[#131720]">
              <button
                type="button"
                onClick={() => setInspectorTab('shape')}
                className={`py-1.5 px-1 rounded-lg text-[10px] font-extrabold inline-flex items-center justify-center gap-1 transition-colors whitespace-nowrap ${
                  inspectorTab === 'shape'
                    ? 'bg-[#7C5CFF] text-white'
                    : 'text-slate-600 dark:text-[#A5AEC4] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Box size={11} />
                <span>Shape</span>
              </button>
              <button
                type="button"
                onClick={() => setInspectorTab('material')}
                className={`py-1.5 px-1 rounded-lg text-[10px] font-extrabold inline-flex items-center justify-center gap-1 transition-colors whitespace-nowrap ${
                  inspectorTab === 'material'
                    ? 'bg-[#7C5CFF] text-white'
                    : 'text-slate-600 dark:text-[#A5AEC4] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Layers size={11} />
                <span>Material</span>
              </button>
              <button
                type="button"
                onClick={() => setInspectorTab('paint')}
                className={`py-1.5 px-1 rounded-lg text-[10px] font-extrabold inline-flex items-center justify-center gap-1 transition-colors whitespace-nowrap ${
                  inspectorTab === 'paint'
                    ? 'bg-[#EC4899] text-white'
                    : 'text-slate-600 dark:text-[#A5AEC4] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Paintbrush size={11} />
                <span>Paint{paintStrokes.length > 0 ? ` (${paintStrokes.length})` : ''}</span>
              </button>
              <button
                type="button"
                onClick={() => setInspectorTab('mechanics')}
                className={`py-1.5 px-1 rounded-lg text-[10px] font-extrabold inline-flex items-center justify-center gap-1 transition-colors whitespace-nowrap ${
                  inspectorTab === 'mechanics'
                    ? 'bg-[#7C5CFF] text-white'
                    : 'text-slate-600 dark:text-[#A5AEC4] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Wrench size={11} />
                <span>Joints ({mechanisms.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setInspectorTab('actions')}
                className={`py-1.5 px-1 rounded-lg text-[10px] font-extrabold inline-flex items-center justify-center gap-1 transition-colors whitespace-nowrap ${
                  inspectorTab === 'actions'
                    ? 'bg-[#10B981] text-white'
                    : 'text-slate-600 dark:text-[#A5AEC4] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Sparkles size={11} />
                <span>
                  Actions{interactionAttributes.length > 0 ? ` (${interactionAttributes.length})` : ''}
                </span>
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-4 maker-scroll">
              {/* TAB 1: SHAPE, MODIFIERS, CSG HOLES & CURVE GUIDE */}
              {inspectorTab === 'shape' && (
                <>
                  {externalGlbMode ? (
                    <div className="rounded-xl border border-dashed border-slate-300 dark:border-white/[0.14] p-4 text-center space-y-2">
                      <div className="text-xs font-extrabold">Imported GLB Geometry</div>
                      <p className="text-[11px] text-slate-500 dark:text-[#949BB0]">
                        Shape modifiers apply to objects sculpted in Object Maker. Switch to the Mechanics tab to rig hinges or sliders onto this GLB, or add a shape from the left dock.
                      </p>
                    </div>
                  ) : primaryPart ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          value={primaryPart.name}
                          onChange={(e) =>
                            updateSelectedParts((p) => ({ ...p, name: e.target.value }))
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

                      {/* Dimensions (W / H / D) */}
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB]">
                          Dimensions (Meters)
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(['Width X', 'Height Y', 'Depth Z'] as const).map((lbl, idx) => (
                            <label key={lbl} className="space-y-0.5 text-[10px] font-bold text-slate-500 dark:text-[#949BB0]">
                              <span>{lbl}</span>
                              <input
                                type="number"
                                min={0.06}
                                max={16}
                                step={0.05}
                                disabled={primaryPart.shape === 'csgResult'}
                                value={primaryPart.dimensions[idx]}
                                onChange={(e) => {
                                  const val = Math.max(0.06, Number(e.target.value) || 0.06);
                                  updateSelectedParts((p) => {
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

                      {/* Bevel / Chamfer / Round / Degrade Edges */}
                      {primaryPart.shape !== 'csgResult' && (
                        <div className="space-y-2.5 pt-2.5 border-t border-slate-200/70 dark:border-white/[0.08]">
                          <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB]">
                            Edge Sculpting
                          </div>
                          {(
                            [
                              ['bevel', 'Bevel', primaryPart.modifiers.bevel],
                              ['chamfer', 'Chamfer', primaryPart.modifiers.chamfer],
                              ['roundness', 'Round Corners', primaryPart.modifiers.roundness],
                              ['edgeWear', 'Degrade Edges', primaryPart.modifiers.edgeWear],
                            ] as const
                          ).map(([key, label, val]) => (
                            <div key={key} className="space-y-0.5">
                              <div className="flex items-center justify-between text-[11px] font-semibold">
                                <span>{label}</span>
                                <span className="font-mono tabular-nums text-slate-500 dark:text-[#949BB0]">
                                  {Math.round(val * 100)}%
                                </span>
                              </div>
                              <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.02}
                                value={val}
                                onChange={(e) => {
                                  const v = Number(e.target.value);
                                  updateSelectedParts((p) => ({
                                    ...p,
                                    modifiers: { ...p.modifiers, [key]: v },
                                  }));
                                }}
                                className="w-full accent-[#7C5CFF]"
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Quick 1-Click Hole Cutter */}
                      {!primaryPart.isCutter && (
                        <div className="space-y-2 pt-2.5 border-t border-slate-200/70 dark:border-white/[0.08]">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB] inline-flex items-center gap-1">
                              <Scissors size={11} className="text-rose-500" />
                              <span>Cut Hole</span>
                            </span>
                            <span className="text-[10px] text-slate-400">CSG Carve</span>
                          </div>
                          <div className="grid grid-cols-3 gap-1">
                            {(['round', 'square', 'arch'] as const).map((hs) => (
                              <button
                                key={hs}
                                type="button"
                                onClick={() => setHoleShape(hs)}
                                className={`py-1 rounded-lg text-[11px] font-bold capitalize ${
                                  holeShape === hs
                                    ? 'bg-[#7C5CFF] text-white'
                                    : 'bg-slate-100 dark:bg-[#12151E] text-slate-600 dark:text-[#A5AEC4]'
                                }`}
                              >
                                {hs}
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="grid grid-cols-3 gap-1 w-24 shrink-0">
                              {(['x', 'y', 'z'] as const).map((ax) => (
                                <button
                                  key={ax}
                                  type="button"
                                  onClick={() => setHoleAxis(ax)}
                                  className={`py-1 rounded-md text-[10px] font-extrabold uppercase ${
                                    holeAxis === ax
                                      ? 'bg-[#38BDF8] text-slate-950'
                                      : 'bg-slate-100 dark:bg-[#12151E] text-slate-500'
                                  }`}
                                >
                                  {ax}
                                </button>
                              ))}
                            </div>
                            <input
                              type="range"
                              min={0.18}
                              max={0.82}
                              step={0.02}
                              value={holeRadiusRatio}
                              onChange={(e) => setHoleRadiusRatio(Number(e.target.value))}
                              className="flex-1 accent-rose-500"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={handleQuickCutHole}
                            className="w-full py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500 text-rose-500 hover:text-white text-xs font-extrabold transition-colors"
                          >
                            Punch {holeShape} Hole Through Part
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 dark:border-white/[0.14] p-4 text-center text-xs text-slate-500 dark:text-[#8E96AB]">
                      Click a part in the 3D viewport or drag a Marquee box to edit dimensions, bevels, holes, and booleans.
                    </div>
                  )}

                  {/* Curve Guide Panel */}
                  <div className="space-y-2.5 pt-3 border-t border-slate-200/80 dark:border-white/[0.08]">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0EA5E9] inline-flex items-center gap-1">
                        <Spline size={12} />
                        <span>Curve Guide</span>
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
                          className="accent-[#0EA5E9]"
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
                              ? 'bg-[#0EA5E9] text-white'
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
                          <span>Length: {curveLength.toFixed(2)}m · {curveCfg.points.length} pts</span>
                          <button
                            type="button"
                            onClick={() => {
                              const last = curveCfg.points[curveCfg.points.length - 1] ?? [0, 0.35, 0];
                              setCurveCfg((prev) => ({
                                ...prev,
                                preset: 'free',
                                points: [...prev.points, [last[0] + 0.75, last[1], last[2]]],
                              }));
                              setActiveCurvePtIdx(curveCfg.points.length);
                            }}
                            className="text-[#0EA5E9] font-bold hover:underline"
                          >
                            + Add Point
                          </button>
                        </div>

                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between text-[10px] font-bold">
                            <span>Arch / Lift</span>
                            <span className="font-mono">{curveCfg.elevationArch.toFixed(2)}m</span>
                          </div>
                          <input
                            type="range"
                            min={-2}
                            max={3}
                            step={0.05}
                            value={curveCfg.elevationArch}
                            onChange={(e) =>
                              setCurveCfg((prev) => ({
                                ...prev,
                                elevationArch: Number(e.target.value),
                              }))
                            }
                            className="w-full accent-[#0EA5E9]"
                          />
                        </div>

                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between text-[10px] font-bold">
                            <span>Sweep Thickness</span>
                            <span className="font-mono">{curveSweepWidth.toFixed(2)}m</span>
                          </div>
                          <input
                            type="range"
                            min={0.04}
                            max={0.6}
                            step={0.01}
                            value={curveSweepWidth}
                            onChange={(e) => setCurveSweepWidth(Number(e.target.value))}
                            className="w-full accent-[#0EA5E9]"
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-1">
                          <button
                            type="button"
                            onClick={() => handleSweepAlongCurve('tube')}
                            className="py-1.5 rounded-lg bg-[#0EA5E9]/15 hover:bg-[#0EA5E9] text-[#0EA5E9] hover:text-white text-[10px] font-extrabold transition-colors"
                          >
                            Sweep Tube
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSweepAlongCurve('beveledBar')}
                            className="py-1.5 rounded-lg bg-[#0EA5E9]/15 hover:bg-[#0EA5E9] text-[#0EA5E9] hover:text-white text-[10px] font-extrabold transition-colors"
                          >
                            Sweep Bar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSweepAlongCurve('ribbon')}
                            className="py-1.5 rounded-lg bg-[#0EA5E9]/15 hover:bg-[#0EA5E9] text-[#0EA5E9] hover:text-white text-[10px] font-extrabold transition-colors"
                          >
                            Sweep Plank
                          </button>
                        </div>

                        <div className="pt-1.5 border-t border-slate-200/70 dark:border-white/[0.06] flex items-center gap-2">
                          <input
                            type="range"
                            min={3}
                            max={24}
                            step={1}
                            value={curveArrayCount}
                            onChange={(e) => setCurveArrayCount(Number(e.target.value))}
                            className="flex-1 accent-[#7C5CFF]"
                          />
                          <button
                            type="button"
                            onClick={handleArrayAlongCurve}
                            className="px-2.5 py-1 rounded-lg bg-[#7C5CFF] text-white text-[10px] font-extrabold whitespace-nowrap"
                          >
                            Array ×{curveArrayCount}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* TAB 2: MATERIALS & WEATHERING */}
              {inspectorTab === 'material' && (
                <>
                  {externalGlbMode ? (
                    <div className="rounded-xl border border-dashed border-slate-300 dark:border-white/[0.14] p-4 text-center text-xs text-slate-500 dark:text-[#8E96AB]">
                      Imported GLB keeps its embedded PBR materials. Load or build an editable Object Maker object to swap building stone/wood shaders &amp; weathering.
                    </div>
                  ) : selectedParts.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 dark:border-white/[0.14] p-4 text-center text-xs text-slate-500 dark:text-[#8E96AB]">
                      Select one or more parts to apply materials and surface finishes.
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span>
                          Applying to {selectedParts.length}{' '}
                          {selectedParts.length === 1 ? 'part' : 'parts'}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateSelectedParts((p) => ({
                              ...p,
                              material: createDefaultMaterialFinish(undefined, '#CBD5E1'),
                            }))
                          }
                          className="text-[11px] font-bold text-[#7C5CFF] hover:underline"
                        >
                          Use Solid Color
                        </button>
                      </div>

                      {/* Building Material Swatches */}
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB]">
                          Building Surfaces
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {BUILDING_MATERIALS.map((mat) => {
                            const active = primaryPart?.material.materialId === mat.id;
                            return (
                              <button
                                key={mat.id}
                                type="button"
                                onClick={() =>
                                  updateSelectedParts((p) => ({
                                    ...p,
                                    material: {
                                      ...p.material,
                                      materialId: mat.id as BuildingMaterialId,
                                      color: '#FFFFFF',
                                      roughness: mat.roughness,
                                      metalness: mat.metalness,
                                    },
                                  }))
                                }
                                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-left text-[10px] font-bold transition-colors ${
                                  active
                                    ? 'border-[#7C5CFF] bg-[#7C5CFF]/15 text-[#7C5CFF]'
                                    : 'border-slate-200/80 dark:border-white/[0.08] bg-slate-50 dark:bg-[#12151E]'
                                }`}
                              >
                                <span
                                  className="w-3.5 h-3.5 rounded shrink-0 border border-black/20"
                                  style={{ backgroundColor: mat.swatch }}
                                />
                                <span className="truncate">{mat.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Tint / PBR Finish */}
                      <div className="space-y-2.5 pt-2.5 border-t border-slate-200/70 dark:border-white/[0.08]">
                        <label className="flex items-center justify-between text-xs font-semibold">
                          <span>Color / Tint</span>
                          <input
                            type="color"
                            value={primaryPart?.material.color || '#FFFFFF'}
                            onChange={(e) => {
                              const hex = e.target.value;
                              updateSelectedParts((p) => ({
                                ...p,
                                material: { ...p.material, color: hex },
                              }));
                            }}
                            className="w-9 h-6 rounded cursor-pointer border-0 bg-transparent"
                          />
                        </label>

                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between text-[11px] font-semibold">
                            <span>Roughness</span>
                            <span className="font-mono">
                              {(primaryPart?.material.roughness ?? 0.65).toFixed(2)}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0.05}
                            max={1}
                            step={0.02}
                            value={primaryPart?.material.roughness ?? 0.65}
                            onChange={(e) => {
                              const r = Number(e.target.value);
                              updateSelectedParts((p) => ({
                                ...p,
                                material: { ...p.material, roughness: r },
                              }));
                            }}
                            className="w-full accent-[#7C5CFF]"
                          />
                        </div>

                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between text-[11px] font-semibold">
                            <span>Metalness</span>
                            <span className="font-mono">
                              {(primaryPart?.material.metalness ?? 0.05).toFixed(2)}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.02}
                            value={primaryPart?.material.metalness ?? 0.05}
                            onChange={(e) => {
                              const m = Number(e.target.value);
                              updateSelectedParts((p) => ({
                                ...p,
                                material: { ...p.material, metalness: m },
                              }));
                            }}
                            className="w-full accent-[#7C5CFF]"
                          />
                        </div>

                        <div className="space-y-1.5 pt-1.5 border-t border-slate-200/60 dark:border-white/[0.06]">
                          <label className="flex items-center justify-between text-xs font-semibold">
                            <span>Glow / Emissive Color</span>
                            <div className="flex items-center gap-1.5">
                              {primaryPart?.material.emissive && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateSelectedParts((p) => ({
                                      ...p,
                                      material: {
                                        ...p.material,
                                        emissive: undefined,
                                        emissiveIntensity: 0,
                                      },
                                    }))
                                  }
                                  className="text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-white"
                                >
                                  Clear
                                </button>
                              )}
                              <input
                                type="color"
                                value={primaryPart?.material.emissive || '#38BDF8'}
                                onChange={(e) => {
                                  const hex = e.target.value;
                                  updateSelectedParts((p) => ({
                                    ...p,
                                    material: {
                                      ...p.material,
                                      emissive: hex,
                                      emissiveIntensity: p.material.emissiveIntensity || 1.25,
                                    },
                                  }));
                                }}
                                className="w-9 h-6 rounded cursor-pointer border-0 bg-transparent"
                              />
                            </div>
                          </label>
                          <div className="space-y-0.5">
                            <div className="flex items-center justify-between text-[11px] font-semibold">
                              <span>Glow Strength</span>
                              <span className="font-mono">
                                {(primaryPart?.material.emissiveIntensity ?? 0).toFixed(2)}
                              </span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={2.5}
                              step={0.05}
                              value={primaryPart?.material.emissiveIntensity ?? 0}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                updateSelectedParts((p) => ({
                                  ...p,
                                  material: {
                                    ...p.material,
                                    emissive: val > 0 ? (p.material.emissive || '#38BDF8') : undefined,
                                    emissiveIntensity: val,
                                  },
                                }));
                              }}
                              className="w-full accent-[#38BDF8]"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Weathering */}
                      <div className="space-y-2 pt-2.5 border-t border-slate-200/70 dark:border-white/[0.08]">
                        <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB]">
                          Weathering &amp; Wear
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {WEATHERING_PRESETS.map((wp) => {
                            const active = (primaryPart?.material.weathering ?? 'none') === wp.id;
                            return (
                              <button
                                key={wp.id}
                                type="button"
                                onClick={() =>
                                  updateSelectedParts((p) => ({
                                    ...p,
                                    material: {
                                      ...p.material,
                                      weathering: wp.id as WeatheringPreset,
                                    },
                                  }))
                                }
                                className={`px-2 py-1 rounded-md text-[10px] font-bold capitalize ${
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
                        {(primaryPart?.material.weathering ?? 'none') !== 'none' && (
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={primaryPart?.material.weatheringIntensity ?? 0.35}
                            onChange={(e) => {
                              const wi = Number(e.target.value);
                              updateSelectedParts((p) => ({
                                ...p,
                                material: { ...p.material, weatheringIntensity: wi },
                              }));
                            }}
                            className="w-full accent-[#20B46A]"
                          />
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* TAB 3: EMBEDDED VERTEX PAINT & DEGRADER */}
              {inspectorTab === 'paint' && (
                <VertexPaintInspector
                  brush={paintBrush}
                  onChangeBrush={setPaintBrush}
                  interactionTool={paintTool}
                  onChangeInteractionTool={setPaintTool}
                  strokeCount={paintStrokes.length}
                  canRedo={paintRedoStack.length > 0}
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
                    flashToast('Cleared vertex paint');
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
                      flashToast('Applied natural paint variation');
                    }
                  }}
                />
              )}

              {/* TAB 4: HINGES, SLIDERS, TRIGGERS & PRESETS */}
              {inspectorTab === 'mechanics' && (
                <div className="space-y-3.5">
                  {/* Mechanisms Header & Add Joint */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB]">
                      Joints &amp; Mechanics
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleAddMechanism('hinge')}
                        className="px-2 py-1 rounded-lg bg-[#7C5CFF] hover:bg-[#6A48F5] text-white text-[10px] font-extrabold inline-flex items-center gap-1"
                      >
                        <RotateCw size={11} />
                        <span>+ Hinge</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddMechanism('slider')}
                        className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] hover:bg-slate-200 dark:hover:bg-[#2A3142] text-[10px] font-extrabold inline-flex items-center gap-1"
                      >
                        <ArrowLeftRight size={11} />
                        <span>+ Slider</span>
                      </button>
                    </div>
                  </div>

                  {/* List of Configured Joints */}
                  {mechanisms.length > 0 && (
                    <div className="space-y-1">
                      {mechanisms.map((m) => (
                        <div
                          key={m.id}
                          onClick={() => {
                            setActiveMechanismId(m.id);
                            setSelectedMechNodePath(m.targetNodePath);
                          }}
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl cursor-pointer text-xs font-bold ${
                            activeMechanismId === m.id
                              ? 'bg-[#7C5CFF]/15 text-[#7C5CFF] ring-1 ring-[#7C5CFF]/40'
                              : 'bg-slate-50 dark:bg-[#12151E]'
                          }`}
                        >
                          {m.kind === 'hinge' ? <RotateCw size={12} /> : <ArrowLeftRight size={12} />}
                          <div className="min-w-0 flex-1">
                            <div className="truncate">{m.name}</div>
                            <div className="text-[10px] opacity-70 truncate">
                              {m.targetLabel} · {m.axis.toUpperCase()} axis · {m.triggers.length} rules
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setMechanisms((prev) => prev.filter((x) => x.id !== m.id));
                              if (activeMechanismId === m.id) setActiveMechanismId(null);
                            }}
                            className="p-1 rounded hover:text-rose-500"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Active Mechanism Constraint + Trigger Rules */}
                  {activeMechanism ? (
                    <div className="space-y-3 pt-2 border-t border-slate-200/80 dark:border-white/[0.08]">
                      <div className="space-y-1.5">
                        <input
                          type="text"
                          value={activeMechanism.name}
                          onChange={(e) =>
                            updateActiveMechanism((m) => ({ ...m, name: e.target.value }))
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.08] text-xs font-bold"
                        />

                        <select
                          value={activeMechanism.targetNodePath}
                          onChange={(e) => {
                            const nextPath = e.target.value;
                            const matched = scenePartNodes.find((n) => n.path === nextPath);
                            setSelectedMechNodePath(nextPath);
                            updateActiveMechanism((m) => ({
                              ...m,
                              targetNodePath: nextPath,
                              targetLabel: matched?.label ?? nextPath,
                            }));
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.08] text-xs font-bold"
                        >
                          {scenePartNodes.map((n) => (
                            <option key={n.path} value={n.path}>
                              {'— '.repeat(Math.min(n.depth, 3))}
                              {n.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Kind & Axis */}
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateActiveMechanism((m) => ({ ...m, kind: 'hinge' }))}
                          className={`py-1.5 rounded-lg text-[11px] font-bold border ${
                            activeMechanism.kind === 'hinge'
                              ? 'border-[#7C5CFF] bg-[#7C5CFF]/15 text-[#7C5CFF]'
                              : 'border-slate-200/80 dark:border-white/[0.08]'
                          }`}
                        >
                          Hinge Pivot
                        </button>
                        <button
                          type="button"
                          onClick={() => updateActiveMechanism((m) => ({ ...m, kind: 'slider' }))}
                          className={`py-1.5 rounded-lg text-[11px] font-bold border ${
                            activeMechanism.kind === 'slider'
                              ? 'border-[#7C5CFF] bg-[#7C5CFF]/15 text-[#7C5CFF]'
                              : 'border-slate-200/80 dark:border-white/[0.08]'
                          }`}
                        >
                          Linear Slider
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-1">
                        {(['x', 'y', 'z'] as const).map((ax) => (
                          <button
                            key={ax}
                            type="button"
                            onClick={() =>
                              updateActiveMechanism((m) => ({ ...m, axis: ax as MechanismAxis }))
                            }
                            className={`py-1 rounded-lg text-[11px] font-extrabold uppercase ${
                              activeMechanism.axis === ax
                                ? 'bg-slate-900 dark:bg-white/15 text-white'
                                : 'bg-slate-100 dark:bg-[#12151E] text-slate-500'
                            }`}
                          >
                            {ax} Axis
                          </button>
                        ))}
                      </div>

                      {/* Hinge Pivot Seam Presets + Angle OR Slider Distance */}
                      {activeMechanism.kind === 'hinge' ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-3 gap-1">
                            {SNAP_PRESETS.map((sp) => (
                              <button
                                key={sp.id}
                                type="button"
                                onClick={() => {
                                  const node =
                                    scenePartNodes.find(
                                      (n) => n.path === activeMechanism.targetNodePath
                                    ) ?? selectedMechNode;
                                  if (!node) return;
                                  updateActiveMechanism((m) => ({
                                    ...m,
                                    pivot: computePivotPresetForPart(node, sp.id),
                                  }));
                                }}
                                className="py-1 px-1.5 rounded-md bg-slate-100 dark:bg-[#12151E] hover:bg-[#7C5CFF] hover:text-white text-[10px] font-bold transition-colors"
                              >
                                {sp.label}
                              </button>
                            ))}
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] font-semibold">
                              <span>Open Angle</span>
                              <span className="font-mono text-[#F59E0B] font-bold">
                                {activeMechanism.openAngleDeg}°
                              </span>
                            </div>
                            <input
                              type="range"
                              min={-180}
                              max={180}
                              step={1}
                              value={activeMechanism.openAngleDeg}
                              onChange={(e) => {
                                setMechTargetOpen(null);
                                setMechProgress(1);
                                updateActiveMechanism((m) => ({
                                  ...m,
                                  openAngleDeg: Number(e.target.value),
                                }));
                              }}
                              className="w-full accent-[#F59E0B]"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-semibold">
                            <span>Slide Distance</span>
                            <span className="font-mono text-[#F59E0B] font-bold">
                              {activeMechanism.openOffset.toFixed(2)}m
                            </span>
                          </div>
                          <input
                            type="range"
                            min={-4}
                            max={4}
                            step={0.05}
                            value={activeMechanism.openOffset}
                            onChange={(e) => {
                              setMechTargetOpen(null);
                              setMechProgress(1);
                              updateActiveMechanism((m) => ({
                                ...m,
                                openOffset: Number(e.target.value),
                              }));
                            }}
                            className="w-full accent-[#F59E0B]"
                          />
                        </div>
                      )}

                      {/* Duration, Easing & Activation Mode */}
                      <div className="space-y-2 pt-2 border-t border-slate-200/70 dark:border-white/[0.06]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.08]">
                            <EasingCurveIcon easing={activeMechanism.easing} />
                            <select
                              value={activeMechanism.easing}
                              onChange={(e) =>
                                updateActiveMechanism((m) => ({
                                  ...m,
                                  easing: e.target.value as MotionEasing,
                                }))
                              }
                              className="flex-1 bg-transparent text-[11px] font-bold focus:outline-none"
                            >
                              {EASING_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value} className="bg-white dark:bg-[#171A23]">
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <input
                            type="number"
                            min={0.15}
                            max={5}
                            step={0.1}
                            value={activeMechanism.duration}
                            onChange={(e) =>
                              updateActiveMechanism((m) => ({
                                ...m,
                                duration: Math.max(0.15, Number(e.target.value) || 0.7),
                              }))
                            }
                            className="w-16 px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#12151E] text-xs font-mono font-bold"
                            title="Duration (seconds)"
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-1">
                          {(
                            [
                              ['toggle', 'Toggle'],
                              ['once', 'Open Once'],
                              ['autoReturn', 'Auto-Close'],
                            ] as const
                          ).map(([mode, lbl]) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() =>
                                updateActiveMechanism((m) => ({
                                  ...m,
                                  playbackMode: mode as MechanismPlaybackMode,
                                }))
                              }
                              className={`py-1 rounded-md text-[10px] font-bold ${
                                activeMechanism.playbackMode === mode
                                  ? 'bg-[#7C5CFF] text-white'
                                  : 'bg-slate-100 dark:bg-[#12151E] text-slate-500'
                              }`}
                            >
                              {lbl}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Triggers & Rewards */}
                      <div className="space-y-2 pt-2 border-t border-slate-200/70 dark:border-white/[0.06]">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-extrabold text-slate-600 dark:text-[#C8D0E4] inline-flex items-center gap-1">
                            <GitBranch size={11} className="text-[#7C5CFF]" />
                            <span>Triggers &amp; Rewards ({activeMechanism.triggers.length})</span>
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateActiveMechanism((m) => ({
                                ...m,
                                triggers: [...m.triggers, createDefaultTriggerRule()],
                              }))
                            }
                            className="px-2 py-0.5 rounded-md bg-[#7C5CFF] text-white text-[10px] font-bold"
                          >
                            + Rule
                          </button>
                        </div>

                        {activeMechanism.triggers.map((rule) => {
                          const patchRule = (patch: Partial<MechanismTriggerRule>) => {
                            updateActiveMechanism((m) => ({
                              ...m,
                              triggers: m.triggers.map((t) =>
                                t.id === rule.id ? { ...t, ...patch } : t
                              ),
                            }));
                          };
                          return (
                            <div
                              key={rule.id}
                              className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.08] space-y-2"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-[10px] text-slate-500 dark:text-[#9FA8BE] leading-snug">
                                  {summarizeTriggerRule(rule, activeMechanism.name, itemNameMap)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateActiveMechanism((m) => ({
                                      ...m,
                                      triggers: m.triggers.filter((t) => t.id !== rule.id),
                                    }))
                                  }
                                  className="text-slate-400 hover:text-rose-500 shrink-0"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>

                              <select
                                value={rule.event}
                                onChange={(e) =>
                                  patchRule({ event: e.target.value as MechanismTriggerEvent })
                                }
                                className="w-full px-2 py-1 rounded-lg bg-white dark:bg-[#1B202E] border border-slate-200/80 dark:border-white/[0.08] text-[11px] font-semibold"
                              >
                                {(Object.keys(TRIGGER_EVENT_LABELS) as MechanismTriggerEvent[]).map(
                                  (ev) => (
                                    <option key={ev} value={ev}>
                                      {TRIGGER_EVENT_LABELS[ev]}
                                    </option>
                                  )
                                )}
                              </select>

                              <select
                                value={rule.condition}
                                onChange={(e) =>
                                  patchRule({ condition: e.target.value as MechanismConditionKind })
                                }
                                className="w-full px-2 py-1 rounded-lg bg-white dark:bg-[#1B202E] border border-slate-200/80 dark:border-white/[0.08] text-[11px] font-semibold"
                              >
                                {(Object.keys(CONDITION_LABELS) as MechanismConditionKind[]).map(
                                  (c) => (
                                    <option key={c} value={c}>
                                      {CONDITION_LABELS[c]}
                                    </option>
                                  )
                                )}
                              </select>

                              <div className="grid grid-cols-2 gap-1.5">
                                <input
                                  type="text"
                                  value={rule.setFlagOnOpen ?? ''}
                                  onChange={(e) => patchRule({ setFlagOnOpen: e.target.value })}
                                  placeholder="Set flag (opt)"
                                  className="px-2 py-1 rounded-lg bg-white dark:bg-[#1B202E] border border-slate-200/80 dark:border-white/[0.08] text-[10px] font-mono"
                                />
                                <input
                                  type="number"
                                  min={0}
                                  value={rule.rewardCoins ?? 0}
                                  onChange={(e) =>
                                    patchRule({
                                      rewardCoins: Math.max(0, Number(e.target.value) || 0),
                                    })
                                  }
                                  placeholder="Coins"
                                  title="Reward Coins"
                                  className="px-2 py-1 rounded-lg bg-white dark:bg-[#1B202E] border border-slate-200/80 dark:border-white/[0.08] text-[10px] font-mono"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 dark:border-white/[0.12] p-3 text-center text-[11px] text-slate-500 dark:text-[#8E96AB]">
                      Click any part in the 3D viewport and hit <b>+ Hinge</b> or <b>+ Slider</b>, or apply a preset below.
                    </div>
                  )}

                  {/* Built-in & Custom Mechanism Presets */}
                  <div className="space-y-2 pt-2.5 border-t border-slate-200/80 dark:border-white/[0.08]">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB]">
                        Quick Presets
                      </span>
                      {activeMechanism && (
                        <button
                          type="button"
                          onClick={() => {
                            setSavingPreset((v) => !v);
                            setNewPresetName(activeMechanism.name);
                          }}
                          className="text-[10px] font-bold text-[#7C5CFF] hover:underline"
                        >
                          Save Preset
                        </button>
                      )}
                    </div>

                    {savingPreset && activeMechanism && (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={newPresetName}
                          onChange={(e) => setNewPresetName(e.target.value)}
                          placeholder="Preset name…"
                          className="flex-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#12151E] text-xs"
                        />
                        <button
                          type="button"
                          onClick={handleSaveCurrentMechanismPreset}
                          className="px-2.5 py-1 rounded-lg bg-[#7C5CFF] text-white text-[11px] font-bold"
                        >
                          Save
                        </button>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1">
                      {(
                        [
                          ['all', 'All'],
                          ['doors', 'Doors'],
                          ['chests', 'Chests'],
                          ['switches', 'Switches'],
                          ['traps', 'Traps'],
                        ] as const
                      ).map(([cat, lbl]) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setPresetFilter(cat)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            presetFilter === cat
                              ? 'bg-[#7C5CFF] text-white'
                              : 'bg-slate-100 dark:bg-[#12151E] text-slate-500'
                          }`}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-1.5">
                      {filteredMechanismPresets.slice(0, 8).map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() =>
                            handleApplyMechanismPreset(preset, activeMechanism ? 'replace' : 'add')
                          }
                          className="w-full text-left p-2 rounded-xl bg-slate-50 dark:bg-[#12151E] hover:bg-[#7C5CFF]/15 border border-slate-200/80 dark:border-white/[0.06] transition-colors"
                        >
                          <div className="text-[11px] font-extrabold">{preset.name}</div>
                          <div className="text-[10px] text-slate-500 dark:text-[#8E96AB] truncate">
                            {preset.summary}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: CHARACTER INTERACTION ATTRIBUTES, BODY PART ATTACHMENT & CALIBRATION */}
              {inspectorTab === 'actions' && (
                <div className="space-y-3">
                  {/* Character Body Part Attachment & Inventory Link */}
                  <div className="rounded-xl bg-[#7C5CFF]/10 border border-[#7C5CFF]/30 p-3 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-[#6A48F5] dark:text-[#C4B5FD]">
                        Attach to Character Body Part
                      </span>
                      {attachBodyPart && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#20B46A]/20 text-[#059669] dark:text-[#34D399]">
                          {OBJECT_BODY_PART_OPTIONS.find((o) => o.id === attachBodyPart)?.short ??
                            attachBodyPart}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-[#949BB0] leading-snug">
                      Pick which hand, limb, or appendage holds or wears this object when loaded in Motion Studio.
                    </p>
                    <select
                      value={attachBodyPart ?? ''}
                      onChange={(e) =>
                        setAttachBodyPart(
                          e.target.value ? (e.target.value as ObjectAttachBodyPart) : null
                        )
                      }
                      aria-label="Character body part attachment"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.1] text-xs font-bold"
                    >
                      <option value="">Unassigned (Choose Body Part)</option>
                      {OBJECT_BODY_PART_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <label className="inline-flex items-center gap-1.5 text-[11px] font-bold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeInInventory || Boolean(linkedInventoryItemId)}
                          disabled={Boolean(linkedInventoryItemId)}
                          onChange={(e) => setIncludeInInventory(e.target.checked)}
                          className="accent-[#7C5CFF]"
                        />
                        <span>Include in Game Inventory</span>
                      </label>

                      {(includeInInventory || Boolean(linkedInventoryItemId)) &&
                        !linkedInventoryItemId && (
                          <select
                            value={inventoryCategory}
                            onChange={(e) =>
                              setInventoryCategory(e.target.value as InventoryItemCategory)
                            }
                            aria-label="Inventory category"
                            className="px-2 py-1 rounded-lg bg-white dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.1] text-[11px] font-bold"
                          >
                            <option value="weapon">Weapon</option>
                            <option value="tool">Tool</option>
                            <option value="wearable">Wearable</option>
                            <option value="consumable">Food / Potion</option>
                            <option value="resource">Resource</option>
                            <option value="material">Relic / Material</option>
                          </select>
                        )}
                    </div>

                    {linkedInventoryItemId && (
                      <button
                        type="button"
                        onClick={() => void handleApplyBodyPartToLinkedInventory()}
                        className="w-full py-1.5 px-3 rounded-lg bg-[#20B46A] hover:bg-[#1A9E5C] text-white text-[11px] font-extrabold inline-flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                      >
                        <Check size={12} />
                        <span>Apply Body Part to Inventory Item</span>
                      </button>
                    )}
                  </div>

                  <div className="rounded-xl bg-[#10B981]/10 border border-[#10B981]/25 p-3 space-y-2">
                    <div className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300">
                      Object Interaction Attributes
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-[#949BB0] leading-snug">
                      Check every action the hero can perform with this object, then test & calibrate character alignment on the 3D stage.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowInteractionTester(true)}
                      className="w-full py-2 px-3 rounded-xl bg-[#7C5CFF] hover:bg-[#6A48F5] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Play size={13} />
                      <span>Test & Calibrate Character</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-1.5">
                    {OBJECT_INTERACTION_ATTRIBUTES.map((attr) => {
                      const checked = interactionAttributes.includes(attr.id);
                      const hasCal = Boolean(interactionCalibrations[attr.id]);
                      return (
                        <label
                          key={attr.id}
                          className={`flex items-start gap-2.5 p-2 rounded-xl border cursor-pointer transition-colors ${
                            checked
                              ? 'bg-emerald-500/10 border-emerald-500/40'
                              : 'bg-slate-50 dark:bg-[#12151E] border-slate-200/80 dark:border-white/[0.06] hover:border-slate-300 dark:hover:border-white/[0.14]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setInteractionAttributes((prev) =>
                                prev.includes(attr.id)
                                  ? prev.filter((id) => id !== attr.id)
                                  : [...prev, attr.id]
                              )
                            }
                            className="mt-0.5 accent-[#10B981] w-3.5 h-3.5 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-extrabold">{attr.label}</span>
                              {hasCal && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#7C5CFF]/15 text-[#7C5CFF]">
                                  Calibrated
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-[#8E96AB] leading-snug">
                              {attr.description}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {showInteractionTester && (
        <ObjectInteractionTestModal
          title={objectName || 'Custom Object'}
          attributes={interactionAttributes}
          calibrations={interactionCalibrations}
          objectDoc={!externalGlbMode ? doc : undefined}
          customAssetId={externalGlbMode ? editingAssetId ?? undefined : undefined}
          customHeroAssetId={
            store.currentLevel?.entities.find((e) => e.kind === 'hero')?.customAssetId
          }
          onSaveCalibration={(attr, cal) => {
            setInteractionAttributes((prev) =>
              prev.includes(attr) ? prev : [...prev, attr]
            );
            setInteractionCalibrations((prev) => ({ ...prev, [attr]: cal }));
            flashToast(`Calibrated "${attr}" offset`);
          }}
          onClose={() => setShowInteractionTester(false)}
        />
      )}
    </div>
  );
};
