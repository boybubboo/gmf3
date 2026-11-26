import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { WebGPURenderer } from 'three/webgpu';
import { uniform } from 'three/tsl';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  Eraser,
  Eye,
  EyeOff,
  GitBranch,
  Hammer,
  Hand,
  Leaf,
  Paintbrush,
  Palette,
  Redo2,
  RotateCcw,
  Sparkles,
  Trash2,
  Trees,
  Undo2,
  Wand2,
  X,
} from 'lucide-react';
import {
  createDefaultCanopyConfig,
  createDefaultSpeciesConfig,
} from '../../data/canopyEnginePresets';
import type { MakerStore } from '../../store/useMakerStore';
import { buildSingleCanopyTreeGroup } from '../../three/canopyClusterBuilder';
import {
  collectReferencedTextureIds,
  loadCustomTextureToCache,
  subscribeCustomTextureCache,
} from '../../three/customTextureManager';
import {
  applyVisualStyleToObject,
  getCachedAssetSync,
  instantiateCustomModel,
  loadCustomAssetToCache,
  subscribeAssetCache,
} from '../../three/gltfAssetManager';
import {
  createMakerRenderer,
  detectSoftwareGl,
  disposeObject3D,
  setupSceneEnvironment,
} from '../../three/islandScene';
import { buildEntityMesh } from '../../three/proceduralModels';
import { WEATHERING_PRESETS } from '../../three/nodeMaterialUtils';
import {
  applyVertexPaintDab,
  applyVertexPaintStrokesToObject,
  computeShiftedHexColor,
  generateOrganicDappleStroke,
  prepareObjectForVertexPainting,
  resetObjectVertexPaint,
  type VertexPaintBrushSettings,
} from '../../three/vertexPainter';
import type {
  LevelEntity,
  StylizedCanopyConfig,
  TreeSpeciesType,
  VertexPaintMode,
  VertexPaintStroke,
  VertexPaintTarget,
  VisualStyleId,
} from '../../types/maker';

interface VertexPaintModalProps {
  store: MakerStore;
  /** Optional initial entity ID to paint; defaults to selected entity or Level Tree Studio tree */
  initialEntityId?: string | null;
  onClose: () => void;
}

const LEAF_SWATCHES = [
  { label: 'Sunlit Lime', hex: '#A4DF54' },
  { label: 'Meadow Green', hex: '#4EA343' },
  { label: 'Deep Pine', hex: '#1F5C36' },
  { label: 'Autumn Gold', hex: '#F0B838' },
  { label: 'Russet Orange', hex: '#E06E26' },
  { label: 'Crimson Maple', hex: '#C6362C' },
  { label: 'Frost Mint', hex: '#9EE0D4' },
  { label: 'Mystic Bloom', hex: '#9C6CE8' },
];

const BARK_SWATCHES = [
  { label: 'Warm Oak', hex: '#7D573D' },
  { label: 'Mossy Lichen', hex: '#5D7B3B' },
  { label: 'Red Cedar', hex: '#8F4D34' },
  { label: 'Birch Silver', hex: '#DFD8CC' },
  { label: 'Dark Crevice', hex: '#3B2C24' },
  { label: 'Weathered Gray', hex: '#6E6B66' },
];

const MODE_OPTIONS: {
  id: VertexPaintMode;
  label: string;
  desc: string;
  icon: React.ReactNode;
}[] = [
  {
    id: 'paint',
    label: 'Color',
    desc: 'Paint color tint + hue shift',
    icon: <Paintbrush size={13} />,
  },
  {
    id: 'hueShift',
    label: 'Hue Shift',
    desc: 'Shift existing texture hue',
    icon: <Palette size={13} />,
  },
  {
    id: 'organicJitter',
    label: 'Organic',
    desc: 'Multi-tone natural mottling',
    icon: <Sparkles size={13} />,
  },
  {
    id: 'degrade',
    label: 'Degrade',
    desc: 'Chips, cracks, moss, scorch, rust',
    icon: <Hammer size={13} />,
  },
  {
    id: 'erase',
    label: 'Erase',
    desc: 'Restore original colors & geometry',
    icon: <Eraser size={13} />,
  },
];

const TARGET_OPTIONS: {
  id: VertexPaintTarget;
  label: string;
  icon: React.ReactNode;
}[] = [
  { id: 'all', label: 'All Parts', icon: <Trees size={12} /> },
  { id: 'leaves', label: 'Leaves Only', icon: <Leaf size={12} /> },
  { id: 'branches', label: 'Branches & Bark', icon: <GitBranch size={12} /> },
];

interface BrushSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display?: string;
  accent?: string;
  hint?: string;
  trackBg?: string;
  onChange: (v: number) => void;
}

const BrushSlider: React.FC<BrushSliderProps> = ({
  label,
  value,
  min,
  max,
  step,
  display,
  accent = '#7C5CFF',
  hint,
  trackBg,
  onChange,
}) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between gap-2 text-xs font-semibold">
      <span className="text-slate-700 dark:text-slate-200 truncate">{label}</span>
      <span className="tabular-nums font-mono text-[11px] text-slate-500 dark:text-[#949BB0] shrink-0">
        {display ?? value.toFixed(step >= 1 ? 0 : 2)}
      </span>
    </div>
    {trackBg && (
      <div
        className="h-1.5 w-full rounded-full mb-0.5"
        style={{ background: trackBg }}
      />
    )}
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

export const VertexPaintModal: React.FC<VertexPaintModalProps> = ({
  store,
  initialEntityId,
  onClose,
}) => {
  const { currentLevel, customAssets } = store;

  // Choose initial target: explicit entity, selected paintable entity, or Level Forest Tree Studio
  const paintableEntities = useMemo(
    () => (currentLevel?.entities ?? []).filter((e) => e.kind !== 'fxEmitter'),
    [currentLevel?.entities]
  );

  const [targetSource, setTargetSource] = useState<'forestTree' | string>(() => {
    if (initialEntityId && paintableEntities.some((e) => e.id === initialEntityId)) {
      return initialEntityId;
    }
    if (
      store.selectedEntityID &&
      paintableEntities.some((e) => e.id === store.selectedEntityID)
    ) {
      return store.selectedEntityID;
    }
    const firstTree = paintableEntities.find((e) => Boolean(e.canopyTree));
    if (firstTree) return firstTree.id;
    return 'forestTree';
  });

  const activeEntity: LevelEntity | null = useMemo(
    () =>
      targetSource === 'forestTree'
        ? null
        : paintableEntities.find((e) => e.id === targetSource) ?? null,
    [targetSource, paintableEntities]
  );

  const isTreeTarget = targetSource === 'forestTree' || Boolean(activeEntity?.canopyTree);

  const resolvedTreeCfg: StylizedCanopyConfig | null = useMemo(() => {
    if (targetSource === 'forestTree') {
      const raw = currentLevel?.canopyEngine;
      const sp: TreeSpeciesType = raw?.treeType ?? 'oak';
      return raw ? { ...createDefaultSpeciesConfig(sp), ...raw } : createDefaultCanopyConfig();
    }
    if (activeEntity?.canopyTree) {
      const sp: TreeSpeciesType = activeEntity.canopyTree.treeType ?? 'oak';
      return { ...createDefaultSpeciesConfig(sp), ...activeEntity.canopyTree };
    }
    return null;
  }, [targetSource, currentLevel?.canopyEngine, activeEntity?.canopyTree]);

  const savedStrokes: VertexPaintStroke[] = useMemo(() => {
    if (targetSource === 'forestTree') {
      return resolvedTreeCfg?.vertexPaintStrokes ?? [];
    }
    if (activeEntity?.canopyTree) {
      return activeEntity.canopyTree.vertexPaintStrokes ?? [];
    }
    return activeEntity?.vertexPaintStrokes ?? [];
  }, [targetSource, resolvedTreeCfg?.vertexPaintStrokes, activeEntity]);

  const [redoStack, setRedoStack] = useState<VertexPaintStroke[]>([]);
  const [interactionTool, setInteractionTool] = useState<'paint' | 'orbit'>('paint');
  const [spaceOrbiting, setSpaceOrbiting] = useState(false);
  const [showLeaves, setShowLeaves] = useState(true);
  const [showBranches, setShowBranches] = useState(true);
  const [cacheTick, setCacheTick] = useState(0);

  const [brush, setBrush] = useState<VertexPaintBrushSettings>({
    radius: 0.65,
    opacity: 0.45,
    softness: 0.72,
    mode: 'paint',
    target: 'all',
    color: '#E8A838',
    hueShift: 0,
    saturationShift: 0,
    valueShift: 0,
    hueJitter: 18,
    degradeForm: 'cracked',
    degradeChipDepth: 0.45,
  });

  const mountRef = useRef<HTMLDivElement | null>(null);
  const brushRef = useRef(brush);
  brushRef.current = brush;
  const toolRef = useRef<'paint' | 'orbit'>(interactionTool);
  toolRef.current = spaceOrbiting ? 'orbit' : interactionTool;
  const strokesRef = useRef<VertexPaintStroke[]>(savedStrokes);
  strokesRef.current = savedStrokes;

  const sceneRefs = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    renderer: WebGPURenderer;
    objectContainer: THREE.Group;
    objectRoot: THREE.Object3D | null;
    paintableMeshes: THREE.Mesh[];
    cursorGroup: THREE.Group;
    cursorSphere: THREE.Mesh;
    cursorRing: THREE.Mesh;
    timeUniform: { value: number };
    initialCamPos: THREE.Vector3;
    initialTarget: THREE.Vector3;
  } | null>(null);

  const commitStrokesRef = useRef<(next: VertexPaintStroke[], clearRedo?: boolean) => void>(
    () => {}
  );

  const commitStrokes = (nextStrokes: VertexPaintStroke[], clearRedo = true) => {
    if (clearRedo) setRedoStack([]);
    if (targetSource === 'forestTree') {
      store.updateLevel(
        'vertex paint tree',
        (lvl) => {
          const prev = lvl.canopyEngine
            ? {
                ...createDefaultSpeciesConfig(lvl.canopyEngine.treeType ?? 'oak'),
                ...lvl.canopyEngine,
              }
            : createDefaultCanopyConfig();
          const next: StylizedCanopyConfig = {
            ...prev,
            enabled: true,
            vertexPaintStrokes: nextStrokes,
          };
          const sp: TreeSpeciesType = next.treeType ?? 'oak';
          next.speciesProfiles = {
            ...(prev.speciesProfiles ?? {}),
            [sp]: stripProfiles(next),
          };
          return { ...lvl, canopyEngine: next };
        },
        true
      );
    } else if (activeEntity) {
      store.updateEntity(
        activeEntity.id,
        'vertex paint object',
        (ent) => {
          if (ent.canopyTree) {
            return {
              ...ent,
              canopyTree: {
                ...ent.canopyTree,
                vertexPaintStrokes: nextStrokes,
              },
            };
          }
          return {
            ...ent,
            vertexPaintStrokes: nextStrokes,
          };
        },
        true
      );
    }
  };
  commitStrokesRef.current = commitStrokes;

  // Subscribe to custom GLB and custom texture caches
  useEffect(() => {
    const unsubAssets = subscribeAssetCache(() => setCacheTick((t) => t + 1));
    const unsubTex = subscribeCustomTextureCache(() => setCacheTick((t) => t + 1));
    return () => {
      unsubAssets();
      unsubTex();
    };
  }, []);

  // Preload referenced GLB & custom textures for active target
  useEffect(() => {
    const loadAsset = (id?: string) => {
      if (id && !getCachedAssetSync(id)) {
        const meta = customAssets.find((a) => a.id === id);
        void loadCustomAssetToCache(id, meta?.category ?? 'scenery');
      }
    };
    if (resolvedTreeCfg) {
      loadAsset(resolvedTreeCfg.canopyAssetId);
      loadAsset(resolvedTreeCfg.trunkAssetId);
      loadAsset(resolvedTreeCfg.fruitAssetId);
    }
    if (activeEntity?.customAssetId) {
      loadAsset(activeEntity.customAssetId);
    }
    const texIds = collectReferencedTextureIds(
      currentLevel?.sceneryTextures,
      resolvedTreeCfg ?? undefined
    );
    texIds.forEach((id) => void loadCustomTextureToCache(id));
  }, [
    resolvedTreeCfg,
    activeEntity?.customAssetId,
    customAssets,
    currentLevel?.sceneryTextures,
  ]);

  // Clear redo stack when switching target objects
  useEffect(() => {
    setRedoStack([]);
  }, [targetSource]);

  // Keyboard shortcuts: [ ] brush size, Space temp-orbit, Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z redo
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setSpaceOrbiting(true);
      } else if (e.key === '[') {
        setBrush((b) => ({ ...b, radius: Math.max(0.12, Number((b.radius - 0.1).toFixed(2))) }));
      } else if (e.key === ']') {
        setBrush((b) => ({ ...b, radius: Math.min(2.4, Number((b.radius + 0.1).toFixed(2))) }));
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          setRedoStack((stack) => {
            if (stack.length === 0) return stack;
            const restored = stack[stack.length - 1];
            commitStrokesRef.current([...strokesRef.current, restored], false);
            return stack.slice(0, -1);
          });
        } else {
          const curr = strokesRef.current;
          if (curr.length > 0) {
            const popped = curr[curr.length - 1];
            setRedoStack((s) => [...s, popped]);
            commitStrokesRef.current(curr.slice(0, -1), false);
          }
        }
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
  }, []);

  const style: VisualStyleId = currentLevel?.visualStyle ?? 'painterlyPBR';
  const effectivePreviewHex = useMemo(
    () =>
      computeShiftedHexColor(
        brush.color,
        brush.hueShift,
        brush.saturationShift,
        brush.valueShift
      ),
    [brush.color, brush.hueShift, brush.saturationShift, brush.valueShift]
  );

  // Sync 3D brush cursor color & radius live
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;
    refs.cursorGroup.scale.setScalar(brush.radius);
    const degradeSwatch =
      brush.mode === 'degrade'
        ? WEATHERING_PRESETS.find((p) => p.id === (brush.degradeForm ?? 'cracked'))?.swatch ?? '#57534E'
        : null;
    const colHex =
      brush.mode === 'erase'
        ? '#F8FAFC'
        : degradeSwatch
        ? degradeSwatch
        : brush.mode === 'hueShift'
        ? computeShiftedHexColor('#58D658', brush.hueShift, 0.2, 0.1)
        : effectivePreviewHex;
    (refs.cursorSphere.material as THREE.MeshBasicMaterial).color.set(colHex);
    (refs.cursorRing.material as THREE.MeshBasicMaterial).color.set(colHex);
  }, [brush.radius, brush.mode, brush.hueShift, brush.degradeForm, effectivePreviewHex]);

  // Sync OrbitControls mouse button mapping when toggling Paint vs Orbit mode
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;
    const isOrbit = spaceOrbiting || interactionTool === 'orbit';
    refs.controls.mouseButtons = {
      LEFT: isOrbit ? THREE.MOUSE.ROTATE : (null as unknown as THREE.MOUSE),
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    refs.controls.touches = {
      ONE: isOrbit ? THREE.TOUCH.ROTATE : (null as unknown as THREE.TOUCH),
      TWO: THREE.TOUCH.DOLLY_PAN,
    };
    if (isOrbit) {
      refs.cursorGroup.visible = false;
    }
  }, [interactionTool, spaceOrbiting]);

  // Sync Leaves / Branches visibility toggles live
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs || !refs.objectRoot) return;
    refs.objectRoot.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const part = child.userData.paintPart as string | undefined;
      if (part === 'leaves') child.visible = showLeaves;
      else if (part === 'branches') child.visible = showBranches;
    });
  }, [showLeaves, showBranches, targetSource]);

  // Mount Studio 3D Paint Viewport once
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSwGl = detectSoftwareGl();
    const renderer = createMakerRenderer(isSwGl);
    renderer.setSize(container.clientWidth || 640, container.clientHeight || 520);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#131822');
    let envTex: THREE.Texture | null = null;

    const camera = new THREE.PerspectiveCamera(
      40,
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
      0.1,
      140
    );
    camera.position.set(0, 3.6, 8.2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSwGl;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 2.4, 0);
    controls.minDistance = 1.6;
    controls.maxDistance = 24;
    controls.maxPolarAngle = Math.PI * 0.62;
    controls.mouseButtons = {
      LEFT: null as unknown as THREE.MOUSE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    controls.update();

    const hemi = new THREE.HemisphereLight('#E4F2FF', '#3F4B3E', 1.15);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight('#FFF6E6', 1.95);
    keyLight.position.set(8, 13, 10);
    keyLight.castShadow = !isSwGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 38;
    keyLight.shadow.camera.left = -7;
    keyLight.shadow.camera.right = 7;
    keyLight.shadow.camera.top = 9;
    keyLight.shadow.camera.bottom = -5;
    keyLight.shadow.bias = -0.0008;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#8AC7FF', 0.72);
    rimLight.position.set(-9, 6, -8);
    scene.add(rimLight);

    // Subtle earthy turntable plinth
    const stageGroup = new THREE.Group();
    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(3.4, 3.65, 0.34, 40),
      new THREE.MeshStandardMaterial({ color: '#26323F', roughness: 0.88, metalness: 0.06 })
    );
    plinth.position.y = -0.17;
    plinth.receiveShadow = true;
    stageGroup.add(plinth);

    const plinthRingGeo = new THREE.RingGeometry(3.25, 3.4, 48);
    plinthRingGeo.rotateX(-Math.PI / 2);
    const plinthRing = new THREE.Mesh(
      plinthRingGeo,
      new THREE.MeshBasicMaterial({ color: '#7C5CFF', transparent: true, opacity: 0.35 })
    );
    plinthRing.position.y = 0.008;
    stageGroup.add(plinthRing);
    scene.add(stageGroup);

    const objectContainer = new THREE.Group();
    scene.add(objectContainer);

    // 3D Live Brush Cursor Gizmo (translucent sphere + crisp ring)
    const cursorGroup = new THREE.Group();
    cursorGroup.visible = false;
    const cursorSphere = new THREE.Mesh(
      new THREE.SphereGeometry(1, 20, 14),
      new THREE.MeshBasicMaterial({
        color: '#E8A838',
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      })
    );
    const cursorRing = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.025, 8, 36),
      new THREE.MeshBasicMaterial({
        color: '#E8A838',
        transparent: true,
        opacity: 0.92,
        depthTest: false,
      })
    );
    cursorRing.renderOrder = 999;
    cursorGroup.add(cursorSphere, cursorRing);
    cursorGroup.scale.setScalar(brushRef.current.radius);
    scene.add(cursorGroup);

    const timeUniform = uniform(0);

    sceneRefs.current = {
      scene,
      camera,
      controls,
      renderer,
      objectContainer,
      objectRoot: null,
      paintableMeshes: [],
      cursorGroup,
      cursorSphere,
      cursorRing,
      timeUniform,
      initialCamPos: new THREE.Vector3(0, 3.6, 8.2),
      initialTarget: new THREE.Vector3(0, 2.4, 0),
    };

    // Raycaster & live pointer painting state
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const invRootMat = new THREE.Matrix4();
    const hitLocalPt = new THREE.Vector3();
    const lastDabLocalPt = new THREE.Vector3();
    const hitNormalWorld = new THREE.Vector3();
    const zAxis = new THREE.Vector3(0, 0, 1);

    let isPainting = false;
    let activeStrokePoints: [number, number, number][] = [];
    let activeStrokeSeed = 1;
    let activeStrokeBrush: VertexPaintBrushSettings | null = null;
    let hasLastDab = false;

    const getRaycastHit = (ev: PointerEvent) => {
      const refs = sceneRefs.current;
      if (!refs || !refs.objectRoot || refs.paintableMeshes.length === 0) return null;
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((ev.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      pointerNdc.y = -((ev.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;

      raycaster.setFromCamera(pointerNdc, camera);

      const target = brushRef.current.target;
      const candidates = refs.paintableMeshes.filter((m) => {
        if (!m.visible) return false;
        if (target === 'all') return true;
        const part = m.userData.paintPart as string | undefined;
        return !part || part === target;
      });
      if (candidates.length === 0) return null;

      const hits = raycaster.intersectObjects(candidates, false);
      return hits.length > 0 ? hits[0] : null;
    };

    const updateCursorFromHit = (hit: THREE.Intersection | null) => {
      const refs = sceneRefs.current;
      if (!refs) return;
      if (!hit || toolRef.current !== 'paint') {
        refs.cursorGroup.visible = false;
        return;
      }
      refs.cursorGroup.visible = true;
      refs.cursorGroup.position.copy(hit.point);
      if (hit.face) {
        hitNormalWorld
          .copy(hit.face.normal)
          .transformDirection(hit.object.matrixWorld)
          .normalize();
        refs.cursorRing.quaternion.setFromUnitVectors(zAxis, hitNormalWorld);
      }
    };

    const stampAtHit = (hit: THREE.Intersection, force = false) => {
      const refs = sceneRefs.current;
      if (!refs || !refs.objectRoot || !activeStrokeBrush) return;
      refs.objectRoot.updateMatrixWorld(true);
      invRootMat.copy(refs.objectRoot.matrixWorld).invert();
      hitLocalPt.copy(hit.point).applyMatrix4(invRootMat);

      const minStep = Math.max(0.04, activeStrokeBrush.radius * 0.22);
      if (!force && hasLastDab && hitLocalPt.distanceTo(lastDabLocalPt) < minStep) {
        return;
      }

      lastDabLocalPt.copy(hitLocalPt);
      hasLastDab = true;

      applyVertexPaintDab(
        refs.objectRoot,
        hitLocalPt,
        activeStrokeBrush,
        activeStrokeSeed,
        refs.paintableMeshes
      );

      activeStrokePoints.push([
        Number(hitLocalPt.x.toFixed(3)),
        Number(hitLocalPt.y.toFixed(3)),
        Number(hitLocalPt.z.toFixed(3)),
      ]);
    };

    const onPointerDown = (ev: PointerEvent) => {
      if (ev.button !== 0 || ev.shiftKey || ev.altKey || toolRef.current !== 'paint') return;
      const hit = getRaycastHit(ev);
      updateCursorFromHit(hit);
      if (!hit) return;

      ev.preventDefault();
      renderer.domElement.setPointerCapture(ev.pointerId);
      isPainting = true;
      hasLastDab = false;
      activeStrokePoints = [];
      activeStrokeSeed = Math.floor(Math.random() * 1000000) + 1;
      activeStrokeBrush = { ...brushRef.current };
      stampAtHit(hit, true);
    };

    const onPointerMove = (ev: PointerEvent) => {
      if (toolRef.current !== 'paint') {
        cursorGroup.visible = false;
        return;
      }
      const hit = getRaycastHit(ev);
      updateCursorFromHit(hit);
      if (isPainting && hit) {
        stampAtHit(hit, false);
      }
    };

    const finishStroke = () => {
      if (!isPainting) return;
      isPainting = false;
      hasLastDab = false;
      if (activeStrokePoints.length > 0 && activeStrokeBrush) {
        const newStroke: VertexPaintStroke = {
          id: `vp_${Date.now().toString(36)}_${activeStrokeSeed.toString(36)}`,
          points: activeStrokePoints,
          radius: activeStrokeBrush.radius,
          opacity: activeStrokeBrush.opacity,
          softness: activeStrokeBrush.softness,
          mode: activeStrokeBrush.mode,
          target: activeStrokeBrush.target,
          color: activeStrokeBrush.color,
          hueShift: activeStrokeBrush.hueShift,
          saturationShift: activeStrokeBrush.saturationShift,
          valueShift: activeStrokeBrush.valueShift,
          hueJitter: activeStrokeBrush.hueJitter,
          seed: activeStrokeSeed,
          ...(activeStrokeBrush.mode === 'degrade'
            ? {
                degradeForm: activeStrokeBrush.degradeForm ?? 'cracked',
                degradeChipDepth: activeStrokeBrush.degradeChipDepth ?? 0.45,
              }
            : {}),
        };
        commitStrokesRef.current([...strokesRef.current, newStroke], true);
      }
      activeStrokePoints = [];
      activeStrokeBrush = null;
    };

    const onPointerLeave = () => {
      if (!isPainting) cursorGroup.visible = false;
    };

    const onContextMenu = (ev: MouseEvent) => ev.preventDefault();

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', finishStroke);
    renderer.domElement.addEventListener('pointercancel', finishStroke);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);
    renderer.domElement.addEventListener('contextmenu', onContextMenu);

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
            frameId = window.setTimeout(cb, 50);
          }
        };
        frameId = window.setTimeout(poll, 6);
      } else {
        frameId = window.setTimeout(cb, 65);
      }
    };

    const tick = () => {
      if (disposed) return;
      controls.update();
      renderer.render(scene, camera);
      if (isSwGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    };

    void (async () => {
      try {
        await renderer.init();
      } catch {
        // ignore if unmounted
      }
      if (disposed) return;
      envTex = setupSceneEnvironment(scene, renderer);
      tick();
    })();

    const ro = new ResizeObserver(() => {
      if (disposed) return;
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(container);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', finishStroke);
      renderer.domElement.removeEventListener('pointercancel', finishStroke);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      renderer.domElement.removeEventListener('contextmenu', onContextMenu);
      controls.dispose();
      envTex?.dispose();
      disposeObject3D(objectContainer);
      disposeObject3D(stageGroup);
      disposeObject3D(cursorGroup);
      renderer.dispose();
      sceneRefs.current = null;
    };
  }, []);

  // Build the target 3D object whenever targetSource, tree config, textures, or custom assets change
  // NOTE: Exclude vertexPaintStrokes from structural rebuild trigger so live painting never flashes!
  const structuralKey = useMemo(() => {
    if (resolvedTreeCfg) {
      const { vertexPaintStrokes: _vp, speciesProfiles: _sp, ...rest } = resolvedTreeCfg;
      return JSON.stringify({ targetSource, style, rest, tex: currentLevel?.sceneryTextures });
    }
    return JSON.stringify({
      targetSource,
      style,
      kind: activeEntity?.kind,
      assetId: activeEntity?.customAssetId,
      scaleAdj: activeEntity?.modelScaleAdjust,
      offsetY: activeEntity?.modelOffsetY,
    });
  }, [
    targetSource,
    style,
    resolvedTreeCfg,
    activeEntity?.kind,
    activeEntity?.customAssetId,
    activeEntity?.modelScaleAdjust,
    activeEntity?.modelOffsetY,
    currentLevel?.sceneryTextures,
  ]);

  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;

    disposeObject3D(refs.objectContainer);
    refs.objectContainer.clear();

    let built: THREE.Object3D | null = null;
    if (resolvedTreeCfg) {
      // Freeze wind in Vertex Painter so leaves stay steady under your brush!
      const steadyCfg: StylizedCanopyConfig = {
        ...resolvedTreeCfg,
        windSway: 0,
        vertexPaintStrokes: [],
      };
      const treeKey =
        targetSource === 'forestTree'
          ? 'preview_tree_beta_1'
          : activeEntity?.id ?? 'vp_tree';
      built = buildSingleCanopyTreeGroup(
        steadyCfg,
        treeKey,
        style,
        refs.timeUniform,
        undefined,
        {
          previewIndex: targetSource === 'forestTree' ? 1 : undefined,
          sceneryTextures: currentLevel?.sceneryTextures,
          enableVertexPaint: true,
        }
      );
    } else if (activeEntity) {
      if (activeEntity.customAssetId) {
        const cached = getCachedAssetSync(activeEntity.customAssetId);
        if (cached) {
          const meta = customAssets.find((a) => a.id === activeEntity.customAssetId);
          const inst = instantiateCustomModel(activeEntity.customAssetId, meta, {
            scaleAdjust: activeEntity.modelScaleAdjust ?? 1,
            offsetY: activeEntity.modelOffsetY ?? 0,
            visualStyle: style,
          });
          if (inst) built = inst.group;
        }
      }
      if (!built) {
        built = buildEntityMesh(activeEntity);
        applyVisualStyleToObject(built, style);
      }
    }

    if (!built) return;

    const paintable = prepareObjectForVertexPainting(built);
    refs.objectContainer.add(built);
    refs.objectRoot = built;
    refs.paintableMeshes = paintable;

    // Replay current saved strokes immediately onto the fresh mesh
    if (strokesRef.current.length > 0) {
      applyVertexPaintStrokesToObject(built, strokesRef.current);
    }

    // Apply current Leaves/Branches visibility
    built.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const part = child.userData.paintPart as string | undefined;
      if (part === 'leaves') child.visible = showLeaves;
      else if (part === 'branches') child.visible = showBranches;
    });

    // Frame camera comfortably to fit object height
    const box = new THREE.Box3().setFromObject(built);
    if (!box.isEmpty()) {
      const center = new THREE.Vector3();
      const size = new THREE.Vector3();
      box.getCenter(center);
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z, 1.8);
      const dist = maxDim * 1.65;
      refs.initialTarget.copy(center);
      refs.initialCamPos.set(center.x + dist * 0.25, center.y + maxDim * 0.28, center.z + dist);
      refs.controls.target.copy(refs.initialTarget);
      refs.camera.position.copy(refs.initialCamPos);
      refs.controls.update();
    }
  }, [structuralKey, cacheTick]);

  // Replay strokes cleanly on Undo / Redo / Clear / Auto-Dapple without rebuilding geometry!
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs || !refs.objectRoot) return;
    resetObjectVertexPaint(refs.objectRoot);
    if (savedStrokes.length > 0) {
      applyVertexPaintStrokesToObject(refs.objectRoot, savedStrokes);
    }
  }, [savedStrokes]);

  const handleUndo = () => {
    if (savedStrokes.length === 0) return;
    const popped = savedStrokes[savedStrokes.length - 1];
    setRedoStack((s) => [...s, popped]);
    commitStrokes(savedStrokes.slice(0, -1), false);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const restored = redoStack[redoStack.length - 1];
    setRedoStack((s) => s.slice(0, -1));
    commitStrokes([...savedStrokes, restored], false);
  };

  const handleClearAll = () => {
    if (savedStrokes.length === 0) return;
    commitStrokes([], true);
  };

  const handleAutoDapple = () => {
    const refs = sceneRefs.current;
    if (!refs || !refs.objectRoot) return;
    const seed = Math.floor(Math.random() * 1000000) + 1;
    const stroke = generateOrganicDappleStroke(refs.objectRoot, brush, seed);
    if (stroke) {
      commitStrokes([...savedStrokes, stroke], true);
    }
  };

  const handleResetCamera = () => {
    const refs = sceneRefs.current;
    if (!refs) return;
    refs.controls.target.copy(refs.initialTarget);
    refs.camera.position.copy(refs.initialCamPos);
    refs.controls.update();
  };

  const activeTargetLabel =
    targetSource === 'forestTree'
      ? `Tree Maker (${resolvedTreeCfg?.treeType ?? 'oak'})`
      : activeEntity?.name ?? 'Object';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75">
      <div className="w-full max-w-[1320px] h-[92dvh] rounded-3xl bg-white dark:bg-[#141822] border border-slate-200/80 dark:border-white/[0.1] shadow-2xl flex flex-col overflow-hidden">
        {/* Top Studio Header */}
        <header className="shrink-0 px-4 py-3 border-b border-slate-200/80 dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-3 bg-slate-50/80 dark:bg-[#10141C]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#7C5CFF]/15 text-[#7C5CFF] flex items-center justify-center shrink-0">
              <Paintbrush size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black leading-tight truncate">
                Paint Maker &amp; Degrader
              </h2>
              <p className="text-[11px] font-semibold text-slate-500 dark:text-[#8E96AB] truncate">
                Paint color, hue shifts &amp; surface degradation (chips, cracks, moss, scorch, rust) ·{' '}
                <span className="text-[#7C5CFF] font-bold">{activeTargetLabel}</span>
              </p>
            </div>
          </div>

          {/* Target Object Switcher */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={targetSource}
              onChange={(e) => setTargetSource(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#1B202C] border border-slate-200/80 dark:border-white/[0.1] text-xs font-bold max-w-[220px]"
            >
              <option value="forestTree">
                Tree Maker ({currentLevel?.canopyEngine?.treeType ?? 'oak'} forest)
              </option>
              {paintableEntities.map((ent) => (
                <option key={ent.id} value={ent.id}>
                  {ent.canopyTree ? 'Tree: ' : 'Object: '}
                  {ent.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-200/80 dark:bg-[#232938] hover:bg-slate-300 dark:hover:bg-[#2E364A] flex items-center justify-center"
              aria-label="Close Vertex Painter"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {/* Main Split Body */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          {/* Left: Full 3D Interactive Paint Canvas */}
          <div className="relative flex-1 min-h-[300px] bg-[#131822] overflow-hidden">
            <div
              ref={mountRef}
              className={`w-full h-full ${
                spaceOrbiting || interactionTool === 'orbit'
                  ? 'cursor-grab active:cursor-grabbing'
                  : 'cursor-crosshair'
              }`}
            />

            {/* Top-Left Compact Controls Hint (solid dark surface, zero backdrop-blur) */}
            <div className="pointer-events-none absolute top-3 left-3 px-3 py-1.5 rounded-xl bg-[#0F131C]/90 border border-white/10 text-white text-[11px] font-semibold">
              {spaceOrbiting || interactionTool === 'orbit'
                ? 'Orbit Mode · Drag to rotate · Scroll to zoom'
                : 'Left-drag on leaves/branches to paint · Right-drag or hold Space to orbit · [ / ] size'}
            </div>

            {/* Bottom Center Ergonomic Action Dock */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 max-w-[96%] flex flex-wrap items-center justify-center gap-1.5 px-2.5 py-2 rounded-2xl bg-[#111622]/95 border border-white/12 shadow-xl">
              <div className="inline-flex items-center gap-1 p-0.5 rounded-xl bg-[#1C2232]">
                <button
                  type="button"
                  onClick={() => setInteractionTool('paint')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition-colors ${
                    interactionTool === 'paint' && !spaceOrbiting
                      ? 'bg-[#7C5CFF] text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Paintbrush size={12} />
                  <span>Paint</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInteractionTool('orbit')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition-colors ${
                    interactionTool === 'orbit' || spaceOrbiting
                      ? 'bg-[#7C5CFF] text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Hand size={12} />
                  <span>Orbit</span>
                </button>
              </div>

              {isTreeTarget && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowLeaves((v) => !v)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-colors ${
                      showLeaves
                        ? 'bg-[#20B46A]/20 border-[#20B46A]/60 text-[#7CE5AE]'
                        : 'bg-[#1C2232] border-white/10 text-slate-400'
                    }`}
                    title="Hide leaves to easily paint inner branches"
                  >
                    {showLeaves ? <Eye size={12} /> : <EyeOff size={12} />}
                    <span>Leaves</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBranches((v) => !v)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-colors ${
                      showBranches
                        ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                        : 'bg-[#1C2232] border-white/10 text-slate-400'
                    }`}
                    title="Hide trunk & branches to inspect canopy undersides"
                  >
                    {showBranches ? <Eye size={12} /> : <EyeOff size={12} />}
                    <span>Bark</span>
                  </button>
                </>
              )}

              <div className="w-px h-5 bg-white/10 mx-0.5" />

              <button
                type="button"
                disabled={savedStrokes.length === 0}
                onClick={handleUndo}
                title="Undo stroke (Ctrl/Cmd+Z)"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#1C2232] hover:bg-[#273046] disabled:opacity-40 text-slate-200 text-[11px] font-bold"
              >
                <Undo2 size={12} />
                <span>Undo</span>
              </button>
              <button
                type="button"
                disabled={redoStack.length === 0}
                onClick={handleRedo}
                title="Redo stroke (Ctrl/Cmd+Shift+Z)"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#1C2232] hover:bg-[#273046] disabled:opacity-40 text-slate-200 text-[11px] font-bold"
              >
                <Redo2 size={12} />
              </button>
              <button
                type="button"
                onClick={handleResetCamera}
                title="Reset camera angle"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#1C2232] hover:bg-[#273046] text-slate-200 text-[11px] font-bold"
              >
                <RotateCcw size={12} />
              </button>
              <button
                type="button"
                disabled={savedStrokes.length === 0}
                onClick={handleClearAll}
                title="Clear all vertex paint strokes"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 disabled:opacity-35 text-rose-300 text-[11px] font-bold"
              >
                <Trash2 size={12} />
                <span>Clear</span>
              </button>
            </div>
          </div>

          {/* Right: Brush Controls Inspector */}
          <aside className="w-full lg:w-[370px] shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200/80 dark:border-white/[0.08] flex flex-col min-h-0 bg-white dark:bg-[#141822]">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* 1. Target Surface Mask (Leaves vs Branches) */}
              {isTreeTarget && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1B202C] border border-slate-200/70 dark:border-white/[0.07] space-y-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB] block">
                    Paint Target Mask
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {TARGET_OPTIONS.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setBrush((b) => ({ ...b, target: t.id }))}
                        className={`flex flex-col items-center justify-center gap-1 py-2 px-1.5 rounded-xl text-[11px] font-bold border transition-colors ${
                          brush.target === t.id
                            ? 'bg-[#20B46A]/15 border-[#20B46A] text-[#20B46A]'
                            : 'bg-white dark:bg-[#151923] border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {t.icon}
                        <span className="truncate">{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. Brush Mode */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1B202C] border border-slate-200/70 dark:border-white/[0.07] space-y-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB] block">
                  Brush Mode
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {MODE_OPTIONS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setBrush((b) => ({
                          ...b,
                          mode: m.id,
                          // If switching into Hue Shift while hueShift is 0, nudge to a visible +32deg default
                          hueShift:
                            m.id === 'hueShift' && Math.abs(b.hueShift) < 2 ? 32 : b.hueShift,
                        }));
                        setInteractionTool('paint');
                      }}
                      className={`p-2 rounded-xl border text-left transition-colors ${
                        m.id === 'degrade' ? 'col-span-2' : ''
                      } ${
                        brush.mode === m.id
                          ? m.id === 'degrade'
                            ? 'bg-[#D97706]/15 border-[#D97706] text-[#D97706] dark:text-[#FBBF24]'
                            : 'bg-[#7C5CFF]/15 border-[#7C5CFF] text-[#7C5CFF]'
                          : 'bg-white dark:bg-[#151923] border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-extrabold">
                        {m.icon}
                        <span>{m.label}</span>
                      </div>
                      <p className="text-[10px] opacity-75 leading-tight mt-0.5">{m.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Brush Geometry: Size, Opacity & Softness */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1B202C] border border-slate-200/70 dark:border-white/[0.07] space-y-3">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB] block">
                  Brush Size &amp; Opacity
                </span>
                <BrushSlider
                  label="Brush Size"
                  value={brush.radius}
                  min={0.12}
                  max={2.4}
                  step={0.02}
                  display={`${brush.radius.toFixed(2)}m`}
                  accent="#7C5CFF"
                  onChange={(v) => setBrush((b) => ({ ...b, radius: v }))}
                />
                <BrushSlider
                  label="Opacity / Strength"
                  value={brush.opacity}
                  min={0.05}
                  max={1}
                  step={0.02}
                  display={`${Math.round(brush.opacity * 100)}%`}
                  accent="#7C5CFF"
                  onChange={(v) => setBrush((b) => ({ ...b, opacity: v }))}
                />
                <BrushSlider
                  label="Edge Softness"
                  value={brush.softness}
                  min={0.1}
                  max={1}
                  step={0.02}
                  display={`${Math.round(brush.softness * 100)}%`}
                  accent="#20B46A"
                  hint="Higher softness feathers paint smoothly into neighboring leaves and bark."
                  onChange={(v) => setBrush((b) => ({ ...b, softness: v }))}
                />
              </div>

              {/* 4. Degrade & Weathering Controls */}
              {brush.mode === 'degrade' && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1B202C] border border-slate-200/70 dark:border-white/[0.07] space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB]">
                      Degrade &amp; Weather Form
                    </span>
                    <span className="text-[10px] font-bold text-[#D97706] dark:text-[#FBBF24] capitalize">
                      {WEATHERING_PRESETS.find((p) => p.id === (brush.degradeForm ?? 'cracked'))?.label ?? 'Cracked'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {WEATHERING_PRESETS.filter((p) => p.id !== 'none').map((wp) => {
                      const active = (brush.degradeForm ?? 'cracked') === wp.id;
                      return (
                        <button
                          key={wp.id}
                          type="button"
                          title={wp.shortDesc}
                          onClick={() => setBrush((b) => ({ ...b, degradeForm: wp.id }))}
                          className={`flex items-center gap-1.5 py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-colors ${
                            active
                              ? 'bg-[#D97706]/15 border-[#D97706] text-[#D97706] dark:text-[#FBBF24]'
                              : 'bg-white dark:bg-[#151923] border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full border border-black/20 shrink-0"
                            style={{ backgroundColor: wp.swatch }}
                          />
                          <span className="truncate">{wp.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  {((brush.degradeForm ?? 'cracked') === 'chipped' ||
                    (brush.degradeForm ?? 'cracked') === 'cracked') && (
                    <BrushSlider
                      label="Physical Chip / Dent Depth"
                      value={brush.degradeChipDepth ?? 0.45}
                      min={0}
                      max={1}
                      step={0.02}
                      display={`${Math.round((brush.degradeChipDepth ?? 0.45) * 100)}%`}
                      accent="#D97706"
                      hint="Pushes & gouges subdivided stone, timber & mesh vertices inward for real organic dents."
                      onChange={(v) => setBrush((b) => ({ ...b, degradeChipDepth: v }))}
                    />
                  )}
                </div>
              )}

              {/* 5. Color & Hue Shift Controls */}
              {brush.mode !== 'erase' && brush.mode !== 'degrade' && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1B202C] border border-slate-200/70 dark:border-white/[0.07] space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB]">
                      Color &amp; Hue Shift
                    </span>
                    {brush.mode !== 'hueShift' && (
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-4 h-4 rounded-md border border-black/15"
                          style={{ backgroundColor: brush.color }}
                          title="Base brush color"
                        />
                        <span className="text-[10px] text-slate-400">→</span>
                        <span
                          className="w-5 h-5 rounded-md border border-white/30 shadow-sm"
                          style={{ backgroundColor: effectivePreviewHex }}
                          title="Active hue-shifted brush color"
                        />
                      </div>
                    )}
                  </div>

                  {brush.mode !== 'hueShift' && (
                    <>
                      <label className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-[#151923] border border-slate-200/80 dark:border-white/[0.08] text-xs font-bold cursor-pointer">
                        <span>Brush Color</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] text-slate-500 uppercase">
                            {brush.color}
                          </span>
                          <input
                            type="color"
                            value={brush.color}
                            onChange={(e) => setBrush((b) => ({ ...b, color: e.target.value }))}
                            className="w-7 h-6 rounded cursor-pointer border-0 bg-transparent"
                          />
                        </div>
                      </label>

                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-slate-500 dark:text-[#8E96AB] block">
                          Leaf &amp; Foliage Tones
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {LEAF_SWATCHES.map((sw) => (
                            <button
                              key={sw.label}
                              type="button"
                              title={sw.label}
                              onClick={() =>
                                setBrush((b) => ({ ...b, color: sw.hex, hueShift: 0 }))
                              }
                              className={`w-6 h-6 rounded-lg border-2 transition-transform hover:scale-110 ${
                                brush.color.toLowerCase() === sw.hex.toLowerCase()
                                  ? 'border-white ring-2 ring-[#7C5CFF]'
                                  : 'border-black/15 dark:border-white/15'
                              }`}
                              style={{ backgroundColor: sw.hex }}
                            />
                          ))}
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-[#8E96AB] block pt-1">
                          Bark &amp; Moss Tones
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {BARK_SWATCHES.map((sw) => (
                            <button
                              key={sw.label}
                              type="button"
                              title={sw.label}
                              onClick={() =>
                                setBrush((b) => ({ ...b, color: sw.hex, hueShift: 0 }))
                              }
                              className={`w-6 h-6 rounded-lg border-2 transition-transform hover:scale-110 ${
                                brush.color.toLowerCase() === sw.hex.toLowerCase()
                                  ? 'border-white ring-2 ring-[#7C5CFF]'
                                  : 'border-black/15 dark:border-white/15'
                              }`}
                              style={{ backgroundColor: sw.hex }}
                            />
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  <BrushSlider
                    label="Color Hue Shift"
                    value={brush.hueShift}
                    min={-180}
                    max={180}
                    step={1}
                    display={`${brush.hueShift > 0 ? '+' : ''}${Math.round(brush.hueShift)}°`}
                    accent="#7C5CFF"
                    trackBg="linear-gradient(90deg, #ff3b3b, #ffae24, #d4e83a, #32d260, #25c5d9, #4d6bff, #b84dff, #ff3b9a, #ff3b3b)"
                    hint={
                      brush.mode === 'hueShift'
                        ? 'Rotates the existing leaf/bark texture hue per-vertex while keeping every texture detail crisp.'
                        : 'Shifts your brush color around the color wheel for fast organic tonal painting.'
                    }
                    onChange={(v) => setBrush((b) => ({ ...b, hueShift: v }))}
                  />

                  <BrushSlider
                    label="Organic Hue Jitter"
                    value={brush.hueJitter}
                    min={0}
                    max={75}
                    step={1}
                    display={`±${Math.round(brush.hueJitter)}°`}
                    accent="#F59E0B"
                    hint="Adds natural per-cluster hue variation as you paint so foliage & bark never look uniform."
                    onChange={(v) => setBrush((b) => ({ ...b, hueJitter: v }))}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <BrushSlider
                      label="Saturation"
                      value={brush.saturationShift}
                      min={-0.6}
                      max={0.6}
                      step={0.02}
                      display={`${brush.saturationShift > 0 ? '+' : ''}${Math.round(
                        brush.saturationShift * 100
                      )}%`}
                      accent="#7C5CFF"
                      onChange={(v) => setBrush((b) => ({ ...b, saturationShift: v }))}
                    />
                    <BrushSlider
                      label="Brightness"
                      value={brush.valueShift}
                      min={-0.45}
                      max={0.45}
                      step={0.02}
                      display={`${brush.valueShift > 0 ? '+' : ''}${Math.round(
                        brush.valueShift * 100
                      )}%`}
                      accent="#7C5CFF"
                      onChange={(v) => setBrush((b) => ({ ...b, valueShift: v }))}
                    />
                  </div>
                </div>
              )}

              {/* 6. One-Click Auto-Dapple / Auto-Degrade Helper */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1B202C] border border-slate-200/70 dark:border-white/[0.07] space-y-2">
                <button
                  type="button"
                  onClick={handleAutoDapple}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-extrabold inline-flex items-center justify-center gap-1.5 transition-colors ${
                    brush.mode === 'degrade'
                      ? 'bg-[#D97706]/15 hover:bg-[#D97706]/25 text-[#D97706] dark:text-[#FBBF24]'
                      : 'bg-[#20B46A]/15 hover:bg-[#20B46A]/25 text-[#20B46A]'
                  }`}
                >
                  <Wand2 size={13} />
                  <span>
                    {brush.mode === 'degrade' ? 'Auto-Degrade' : 'Auto-Dapple'}{' '}
                    {brush.target === 'leaves'
                      ? 'Leaves'
                      : brush.target === 'branches'
                      ? 'Branches'
                      : 'Whole Object'}
                  </span>
                </button>
                <p className="text-[10px] text-slate-400 dark:text-[#7D859B] leading-snug">
                  {brush.mode === 'degrade'
                    ? 'Stamps organic weathering & surface wear patches using your active degrade form and strength. Fully undoable!'
                    : 'Stamps soft non-repetitive painterly color patches using your current brush & hue settings. Fully undoable!'}
                </p>
              </div>
            </div>

            {/* Bottom Footer */}
            <footer className="shrink-0 px-4 py-3 border-t border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#10141C] flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-500 dark:text-[#8E96AB] tabular-nums">
                {savedStrokes.length} {savedStrokes.length === 1 ? 'stroke' : 'strokes'} saved
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-[#7C5CFF] hover:bg-[#6B4AEF] text-white text-xs font-extrabold"
              >
                Done Painting
              </button>
            </footer>
          </aside>
        </div>
      </div>
    </div>
  );
};
