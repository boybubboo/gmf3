import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { WebGPURenderer } from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Bone,
  Check,
  Eye,
  FlipHorizontal2,
  Hand,
  Layers,
  Paintbrush,
  Play,
  Redo2,
  RotateCcw,
  Scissors,
  Sparkles,
  Square,
  Stamp,
  Undo2,
  Upload,
  Waves,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type {
  CharacterMakerDoc,
  MonsterSculptBoneOffset,
  MonsterSculptData,
} from '../../types/maker';
import {
  createMakerRenderer,
  detectSoftwareGl,
  disposeObject3D,
  initMakerRenderer,
  setupSceneEnvironment,
} from '../../three/islandScene';
import { isWebGPUFallbackAdapter } from '../../three/webglUtils';
import {
  buildCharacterRigAndMesh,
  type BuiltCharacterAsset,
} from '../../three/characterMakerBuilder';
import {
  createDefaultRigSettings,
  inspectModelSkeleton,
  ProceduralRigController,
} from '../../three/proceduralRigAnimator';
import {
  applyGrabDelta,
  applyMonsterSculptData,
  applySculptBrushDab,
  beginGrabSession,
  buildVertexAdjacency,
  computeAutoFitBoneOffsets,
  createImagePatternSamplerFromFile,
  createProceduralPatternSampler,
  extractMonsterSculptData,
  type GrabSession,
  type PatternSampler,
  type SculptToolId,
  type SeamlessPatternId,
  type StampApplyMode,
} from '../../three/creatureSculptEngine';

export interface CharacterSketchModalProps {
  doc: CharacterMakerDoc;
  charName?: string;
  onSave: (updatedDoc: CharacterMakerDoc) => void;
  onClose: () => void;
}

type SculptCameraPreset = 'full' | 'front' | 'side' | 'back' | 'top' | 'head';

interface UndoSnapshot {
  pos: Float32Array;
  col: Float32Array | null;
  boneOffsets: MonsterSculptBoneOffset[];
}

const BRUSH_TOOLS: {
  id: SculptToolId;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'pull', label: 'Pull', hint: 'Raise clay bumps, muscles & crests', icon: ArrowUpFromLine },
  { id: 'push', label: 'Push', hint: 'Indent eye sockets & hollows', icon: ArrowDownToLine },
  { id: 'grab', label: 'Grab', hint: 'Stretch limbs, ears, noses & hair', icon: Hand },
  { id: 'pinch', label: 'Pinch', hint: 'Sharpen ridges, horns & tips', icon: Scissors },
  { id: 'carve', label: 'Carve', hint: 'Cut creases & muscle grooves', icon: Paintbrush },
  { id: 'smooth', label: 'Smooth', hint: 'Soften & blend sculpted clay', icon: Waves },
  { id: 'stamp', label: 'Stamp', hint: 'Emboss & paint seamless textures', icon: Stamp },
];

const PROCEDURAL_PATTERN_IDS: Exclude<SeamlessPatternId, 'custom'>[] = [
  'scales',
  'fur',
  'chitin',
  'pebble',
  'spikes',
  'paintOnly',
];

const RESOLUTION_OPTIONS: { value: 36 | 48 | 64 | 72; label: string }[] = [
  { value: 36, label: 'Draft 36' },
  { value: 48, label: 'Standard 48' },
  { value: 64, label: 'High 64' },
  { value: 72, label: 'Ultra 72' },
];

const BASE_MAGNIFY_DISTANCE = 3.1;

function snapCharacterRigToRestPose(
  built: BuiltCharacterAsset,
  initialBoneLocalPos: Map<THREE.Bone, THREE.Vector3>,
  initialBoneWorldPos: Map<THREE.Bone, THREE.Vector3>,
  boneOffsets: MonsterSculptBoneOffset[]
): void {
  for (const bone of built.bones) {
    bone.rotation.set(0, 0, 0);
    bone.scale.set(1, 1, 1);
    const origLocal = initialBoneLocalPos.get(bone);
    if (origLocal) bone.position.copy(origLocal);
  }
  built.root.updateMatrixWorld(true);

  if (boneOffsets.length > 0) {
    const offsetMap = new Map(boneOffsets.map((o) => [o.boneName, o.delta]));
    const targetWorldByBone = new Map<THREE.Bone, THREE.Vector3>();
    for (const bone of built.bones) {
      const d = offsetMap.get(bone.name);
      const baseW = initialBoneWorldPos.get(bone);
      if (d && baseW) {
        targetWorldByBone.set(
          bone,
          new THREE.Vector3(baseW.x + d[0], baseW.y + d[1], baseW.z + d[2])
        );
      }
    }
    for (const bone of built.bones) {
      const targetWp = targetWorldByBone.get(bone);
      if (targetWp && bone.parent) {
        bone.parent.updateMatrixWorld(true);
        bone.position.copy(bone.parent.worldToLocal(targetWp.clone()));
      }
    }
    built.root.updateMatrixWorld(true);
  }

  built.skinnedMesh.bind(built.skeleton, new THREE.Matrix4());
}

function createWalkControllerForBuilt(
  holder: THREE.Group,
  built: BuiltCharacterAsset
): ProceduralRigController {
  const info = inspectModelSkeleton(built.root);
  const rigSettings = createDefaultRigSettings(info, false);
  return new ProceduralRigController(holder, built.root, rigSettings);
}

function getTriangleLocalNormal(
  geometry: THREE.BufferGeometry,
  face: THREE.Face | null | undefined,
  out: THREE.Vector3
): THREE.Vector3 {
  if (!face) return out.set(0, 1, 0);
  const pos = geometry.attributes.position as THREE.BufferAttribute | undefined;
  if (!pos) return out.copy(face.normal).normalize();

  const ax = pos.getX(face.a);
  const ay = pos.getY(face.a);
  const az = pos.getZ(face.a);
  const bx = pos.getX(face.b);
  const by = pos.getY(face.b);
  const bz = pos.getZ(face.b);
  const cx = pos.getX(face.c);
  const cy = pos.getY(face.c);
  const cz = pos.getZ(face.c);

  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const acx = cx - ax;
  const acy = cy - ay;
  const acz = cz - az;

  out.set(
    aby * acz - abz * acy,
    abz * acx - abx * acz,
    abx * acy - aby * acx
  );
  if (out.lengthSq() < 1e-10) return out.copy(face.normal).normalize();
  return out.normalize();
}

export const CharacterSketchModal: React.FC<CharacterSketchModalProps> = ({
  doc,
  charName,
  onSave,
  onClose,
}) => {
  const initialRes = useMemo<36 | 48 | 64 | 72>(() => {
    const r = doc.sculptData?.resolution ?? 48;
    if (r >= 70) return 72;
    if (r >= 60) return 64;
    if (r >= 44) return 48;
    return 36;
  }, [doc.sculptData?.resolution]);

  const [sculptRes, setSculptRes] = useState<36 | 48 | 64 | 72>(initialRes);
  const [tool, setTool] = useState<SculptToolId>('pull');
  const [brushSize, setBrushSize] = useState<number>(0.18);
  const [brushStrength, setBrushStrength] = useState<number>(0.58);
  const [symmetry, setSymmetry] = useState<boolean>(true);
  const [xrayMode, setXrayMode] = useState<boolean>(false);
  const [walkTest, setWalkTest] = useState<boolean>(false);
  const [magnify, setMagnify] = useState<number>(1.0);
  const [contextLost, setContextLost] = useState<boolean>(false);

  // Seamless pattern & paint state
  const proceduralPatterns = useMemo(() => {
    const map: Record<Exclude<SeamlessPatternId, 'custom'>, PatternSampler> = {
      scales: createProceduralPatternSampler('scales'),
      fur: createProceduralPatternSampler('fur'),
      chitin: createProceduralPatternSampler('chitin'),
      pebble: createProceduralPatternSampler('pebble'),
      spikes: createProceduralPatternSampler('spikes'),
      paintOnly: createProceduralPatternSampler('paintOnly'),
    };
    return map;
  }, []);

  const [selectedPatternId, setSelectedPatternId] = useState<SeamlessPatternId>('scales');
  const [customPattern, setCustomPattern] = useState<PatternSampler | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [stampMode, setStampMode] = useState<StampApplyMode>('both');
  const [stampTileScale, setStampTileScale] = useState<number>(1.25);
  const [embossDepth, setEmbossDepth] = useState<number>(0.55);
  const [paintColor, setPaintColor] = useState<string>(doc.extremityTipColor || doc.torso.color || '#7C5CFF');
  const [paintMix, setPaintMix] = useState<number>(0.65);

  const [boneOffsets, setBoneOffsets] = useState<MonsterSculptBoneOffset[]>(
    () => (doc.sculptData?.boneOffsets ? [...doc.sculptData.boneOffsets] : [])
  );
  const [boneStatusNote, setBoneStatusNote] = useState<string | null>(null);
  const [undoCount, setUndoCount] = useState<number>(0);
  const [redoCount, setRedoCount] = useState<number>(0);
  const [vertexCountLabel, setVertexCountLabel] = useState<number>(0);

  const activePattern: PatternSampler =
    selectedPatternId === 'custom' && customPattern
      ? customPattern
      : proceduralPatterns[selectedPatternId === 'custom' ? 'scales' : selectedPatternId];

  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const undoStackRef = useRef<UndoSnapshot[]>([]);
  const redoStackRef = useRef<UndoSnapshot[]>([]);

  const stateRef = useRef({
    tool,
    brushSize,
    brushStrength,
    symmetry,
    xrayMode,
    walkTest,
    stampMode,
    stampTileScale,
    embossDepth,
    paintColor,
    paintMix,
    activePattern,
    boneOffsets,
  });
  stateRef.current = {
    tool,
    brushSize,
    brushStrength,
    symmetry,
    xrayMode,
    walkTest,
    stampMode,
    stampTileScale,
    embossDepth,
    paintColor,
    paintMix,
    activePattern,
    boneOffsets,
  };

  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: WebGPURenderer | THREE.WebGLRenderer;
    controls: OrbitControls;
    holder: THREE.Group;
    built: BuiltCharacterAsset | null;
    rigController: ProceduralRigController | null;
    adjacency: Int32Array[];
    basePositions: Float32Array | null;
    baseColors: Float32Array | null;
    initialBoneLocalPos: Map<THREE.Bone, THREE.Vector3>;
    initialBoneWorldPos: Map<THREE.Bone, THREE.Vector3>;
    skeletonHelper: THREE.SkeletonHelper | null;
    jointMarkers: THREE.Group | null;
    cursorRing: THREE.Mesh;
    mirrorCursorRing: THREE.Mesh;
    cameraFocusAnim: { targetPos: THREE.Vector3; targetLook: THREE.Vector3 } | null;
    currentRes: number;
  } | null>(null);

  const strokeRef = useRef<{
    active: boolean;
    grabSession: GrabSession | null;
    grabStartLocal: THREE.Vector3;
    grabPlane: THREE.Plane;
    lastDabLocal: THREE.Vector3;
  }>({
    active: false,
    grabSession: null,
    grabStartLocal: new THREE.Vector3(),
    grabPlane: new THREE.Plane(),
    lastDabLocal: new THREE.Vector3(),
  });

  const pushUndoSnapshot = useCallback(() => {
    const st = sceneRef.current;
    if (!st?.built) return;
    const geo = st.built.skinnedMesh.geometry;
    const pos = geo.attributes.position as THREE.BufferAttribute | undefined;
    if (!pos) return;
    const col = geo.attributes.color as THREE.BufferAttribute | undefined;

    undoStackRef.current.push({
      pos: new Float32Array(pos.array as Float32Array),
      col: col ? new Float32Array(col.array as Float32Array) : null,
      boneOffsets: stateRef.current.boneOffsets.map((b) => ({
        boneName: b.boneName,
        delta: [b.delta[0], b.delta[1], b.delta[2]],
      })),
    });
    if (undoStackRef.current.length > 22) {
      undoStackRef.current.shift();
    }
    redoStackRef.current = [];
    setUndoCount(undoStackRef.current.length);
    setRedoCount(0);
  }, []);

  const applyUndoSnapshot = useCallback((snap: UndoSnapshot) => {
    const st = sceneRef.current;
    if (!st?.built) return;
    const geo = st.built.skinnedMesh.geometry;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const col = geo.attributes.color as THREE.BufferAttribute | undefined;

    if (snap.pos.length === pos.array.length) {
      (pos.array as Float32Array).set(snap.pos);
      pos.needsUpdate = true;
    }
    if (col && snap.col && snap.col.length === col.array.length) {
      (col.array as Float32Array).set(snap.col);
      col.needsUpdate = true;
    }
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    geo.computeBoundingSphere();

    snapCharacterRigToRestPose(
      st.built,
      st.initialBoneLocalPos,
      st.initialBoneWorldPos,
      snap.boneOffsets
    );
    st.rigController = createWalkControllerForBuilt(st.holder, st.built);
    setBoneOffsets(snap.boneOffsets);
  }, []);

  const handleUndo = useCallback(() => {
    const st = sceneRef.current;
    if (!st?.built || undoStackRef.current.length === 0) return;
    const geo = st.built.skinnedMesh.geometry;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const col = geo.attributes.color as THREE.BufferAttribute | undefined;

    redoStackRef.current.push({
      pos: new Float32Array(pos.array as Float32Array),
      col: col ? new Float32Array(col.array as Float32Array) : null,
      boneOffsets: stateRef.current.boneOffsets.map((b) => ({
        boneName: b.boneName,
        delta: [b.delta[0], b.delta[1], b.delta[2]],
      })),
    });
    const prev = undoStackRef.current.pop()!;
    applyUndoSnapshot(prev);
    setUndoCount(undoStackRef.current.length);
    setRedoCount(redoStackRef.current.length);
  }, [applyUndoSnapshot]);

  const handleRedo = useCallback(() => {
    const st = sceneRef.current;
    if (!st?.built || redoStackRef.current.length === 0) return;
    const geo = st.built.skinnedMesh.geometry;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const col = geo.attributes.color as THREE.BufferAttribute | undefined;

    undoStackRef.current.push({
      pos: new Float32Array(pos.array as Float32Array),
      col: col ? new Float32Array(col.array as Float32Array) : null,
      boneOffsets: stateRef.current.boneOffsets.map((b) => ({
        boneName: b.boneName,
        delta: [b.delta[0], b.delta[1], b.delta[2]],
      })),
    });
    const next = redoStackRef.current.pop()!;
    applyUndoSnapshot(next);
    setUndoCount(undoStackRef.current.length);
    setRedoCount(redoStackRef.current.length);
  }, [applyUndoSnapshot]);

  // Helper: build/rebuild the viewport character at a target resolution, transferring any current sculpt work
  const rebuildCharacterInViewport = useCallback(
    (targetRes: number, sculptToApply: MonsterSculptData | undefined) => {
      const st = sceneRef.current;
      if (!st) return;

      if (st.skeletonHelper) {
        st.scene.remove(st.skeletonHelper);
        st.skeletonHelper.dispose();
        st.skeletonHelper = null;
      }
      if (st.jointMarkers) {
        st.scene.remove(st.jointMarkers);
        disposeObject3D(st.jointMarkers);
        st.jointMarkers = null;
      }
      disposeObject3D(st.holder);
      st.holder.clear();

      // Always build base un-sculpted SDF mesh first so basePositions / baseColors remain exact reference
      const built = buildCharacterRigAndMesh(
        {
          ...doc,
          sculptData: undefined,
        },
        targetRes,
        false
      );
      st.holder.add(built.root);
      st.built = built;
      st.currentRes = targetRes;

      const geo = built.skinnedMesh.geometry;
      const posAttr = geo.attributes.position as THREE.BufferAttribute;
      const colAttr = geo.attributes.color as THREE.BufferAttribute | undefined;

      st.basePositions = new Float32Array(posAttr.array as Float32Array);
      st.baseColors = colAttr ? new Float32Array(colAttr.array as Float32Array) : null;
      st.adjacency = buildVertexAdjacency(geo);
      setVertexCountLabel(posAttr.count);

      // Capture base bone rest positions before any bone offsets
      st.initialBoneLocalPos.clear();
      st.initialBoneWorldPos.clear();
      built.root.updateMatrixWorld(true);
      const wp = new THREE.Vector3();
      for (const bone of built.bones) {
        st.initialBoneLocalPos.set(bone, bone.position.clone());
        bone.getWorldPosition(wp);
        st.initialBoneWorldPos.set(bone, wp.clone());
      }

      // Apply sculpted geometry + vertex colors + bone offsets
      if (sculptToApply?.enabled) {
        applyMonsterSculptData(geo, sculptToApply, targetRes);
      }

      const activeBoneOffsets = sculptToApply?.boneOffsets ?? stateRef.current.boneOffsets;
      snapCharacterRigToRestPose(
        built,
        st.initialBoneLocalPos,
        st.initialBoneWorldPos,
        activeBoneOffsets
      );
      st.rigController = createWalkControllerForBuilt(st.holder, built);

      // Setup X-ray SkeletonHelper & Glowing Joint Spheres
      const helper = new THREE.SkeletonHelper(built.root);
      const hMat = helper.material as THREE.LineBasicMaterial;
      if (hMat) {
        hMat.depthTest = false;
        hMat.transparent = true;
        hMat.opacity = 0.9;
      }
      helper.renderOrder = 998;
      helper.visible = stateRef.current.xrayMode;
      st.scene.add(helper);
      st.skeletonHelper = helper;

      const jointsGroup = new THREE.Group();
      jointsGroup.visible = stateRef.current.xrayMode;
      const dotGeo = new THREE.SphereGeometry(0.022, 10, 8);
      const dotMat = new THREE.MeshBasicMaterial({
        color: '#FACC15',
        depthTest: false,
        transparent: true,
        opacity: 0.95,
      });
      for (const bone of built.bones) {
        const dot = new THREE.Mesh(dotGeo, dotMat);
        dot.renderOrder = 999;
        dot.userData.trackBone = bone;
        bone.getWorldPosition(wp);
        dot.position.copy(wp);
        jointsGroup.add(dot);
      }
      st.scene.add(jointsGroup);
      st.jointMarkers = jointsGroup;

      // Apply current X-Ray material state
      const mats = Array.isArray(built.skinnedMesh.material)
        ? built.skinnedMesh.material
        : [built.skinnedMesh.material];
      for (const m of mats) {
        const clayMat = m as THREE.MeshStandardMaterial;
        if (clayMat) {
          clayMat.transparent = stateRef.current.xrayMode;
          clayMat.opacity = stateRef.current.xrayMode ? 0.42 : 1.0;
          clayMat.depthWrite = !stateRef.current.xrayMode;
          clayMat.needsUpdate = true;
        }
      }

      // Reset undo stack when resolution rebuilds because vertex count changes
      undoStackRef.current = [];
      redoStackRef.current = [];
      setUndoCount(0);
      setRedoCount(0);
    },
    [doc]
  );

  // Initialize Three.js Viewport
  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;

    const isSoftwareGl = detectSoftwareGl();
    const width = Math.max(320, host.clientWidth);
    const height = Math.max(280, host.clientHeight);

    let renderer = createMakerRenderer(isSoftwareGl);
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSoftwareGl ? 1 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    host.innerHTML = '';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#111520');
    scene.fog = new THREE.FogExp2('#111520', 0.025);
    let envTex: THREE.Texture | null = null;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.04, 80);
    camera.position.set(1.85, 1.38, 2.55);

    const hemi = new THREE.HemisphereLight('#DAE4FF', '#232837', 0.9);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight('#FFF7EA', 1.8);
    keyLight.position.set(4.5, 6.8, 4.4);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#7DD3FC', 0.85);
    rimLight.position.set(-4.0, 3.0, -4.2);
    scene.add(rimLight);

    const floorMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(1.8, 1.95, 0.08, 48),
      new THREE.MeshStandardMaterial({ color: '#181E2D', roughness: 0.82, metalness: 0.08 })
    );
    floorMesh.position.y = -0.04;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    const grid = new THREE.GridHelper(7, 14, '#2C344D', '#1C2233');
    grid.position.y = -0.001;
    scene.add(grid);

    const holder = new THREE.Group();
    scene.add(holder);

    // 3D Surface Brush Cursor Rings
    const ringGeo = new THREE.RingGeometry(0.86, 1.0, 36);
    const cursorRing = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({
        color: '#38BDF8',
        side: THREE.DoubleSide,
        depthTest: false,
        transparent: true,
        opacity: 0.92,
      })
    );
    cursorRing.renderOrder = 1000;
    cursorRing.visible = false;
    scene.add(cursorRing);

    const mirrorCursorRing = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({
        color: '#A78BFA',
        side: THREE.DoubleSide,
        depthTest: false,
        transparent: true,
        opacity: 0.55,
      })
    );
    mirrorCursorRing.renderOrder = 1000;
    mirrorCursorRing.visible = false;
    scene.add(mirrorCursorRing);

    const createControls = (dom: HTMLElement) => {
      dom.style.touchAction = 'none';
      const c = new OrbitControls(camera, dom);
      c.enableDamping = !isSoftwareGl;
      c.dampingFactor = 0.08;
      c.target.set(0, 0.88, 0);
      c.minDistance = 0.45;
      c.maxDistance = 10.5;
      c.maxPolarAngle = Math.PI * 0.54;
      c.update();
      return c;
    };
    let controls = createControls(renderer.domElement);

    const state = {
      scene,
      camera,
      renderer,
      controls,
      holder,
      built: null as BuiltCharacterAsset | null,
      rigController: null as ProceduralRigController | null,
      adjacency: [] as Int32Array[],
      basePositions: null as Float32Array | null,
      baseColors: null as Float32Array | null,
      initialBoneLocalPos: new Map<THREE.Bone, THREE.Vector3>(),
      initialBoneWorldPos: new Map<THREE.Bone, THREE.Vector3>(),
      skeletonHelper: null as THREE.SkeletonHelper | null,
      jointMarkers: null as THREE.Group | null,
      cursorRing,
      mirrorCursorRing,
      cameraFocusAnim: null as { targetPos: THREE.Vector3; targetLook: THREE.Vector3 } | null,
      currentRes: initialRes,
    };
    sceneRef.current = state;

    controls.addEventListener('start', () => {
      state.cameraFocusAnim = null;
    });

    // Build initial character
    rebuildCharacterInViewport(initialRes, doc.sculptData);

    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const tmpNormal = new THREE.Vector3();
    const tmpWorldPt = new THREE.Vector3();
    const tmpWorldNormal = new THREE.Vector3();
    const zUp = new THREE.Vector3(0, 0, 1);
    const tmpQuat = new THREE.Quaternion();
    const tmpBoneW = new THREE.Vector3();

    const updatePointerNdc = (clientX: number, clientY: number) => {
      const rect = state.renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
    };

    const raycastCharacter = (clientX: number, clientY: number) => {
      if (!state.built) return null;
      updatePointerNdc(clientX, clientY);
      raycaster.setFromCamera(pointerNdc, state.camera);
      const hits = raycaster.intersectObject(state.built.skinnedMesh, false);
      if (hits.length === 0) return null;
      const hit = hits[0];
      const geo = state.built.skinnedMesh.geometry;
      const localPoint = state.built.skinnedMesh.worldToLocal(hit.point.clone());
      const localNormal = getTriangleLocalNormal(geo, hit.face, tmpNormal.clone());
      return {
        worldPoint: hit.point.clone(),
        localPoint,
        localNormal,
      };
    };

    const updateBrushCursor = (hit: ReturnType<typeof raycastCharacter>) => {
      const cur = stateRef.current;
      if (!hit || cur.walkTest || !state.built) {
        cursorRing.visible = false;
        mirrorCursorRing.visible = false;
        return;
      }
      const meshMatWorld = state.built.skinnedMesh.matrixWorld;
      const r = cur.brushSize;

      tmpWorldPt.copy(hit.localPoint).applyMatrix4(meshMatWorld);
      tmpWorldNormal.copy(hit.localNormal).transformDirection(meshMatWorld).normalize();

      cursorRing.position.copy(tmpWorldPt).addScaledVector(tmpWorldNormal, 0.008);
      tmpQuat.setFromUnitVectors(zUp, tmpWorldNormal);
      cursorRing.quaternion.copy(tmpQuat);
      cursorRing.scale.setScalar(r);
      cursorRing.visible = true;

      if (cur.symmetry && Math.abs(hit.localPoint.x) > 0.012) {
        const mLocalPt = new THREE.Vector3(
          -hit.localPoint.x,
          hit.localPoint.y,
          hit.localPoint.z
        );
        const mLocalNorm = new THREE.Vector3(
          -hit.localNormal.x,
          hit.localNormal.y,
          hit.localNormal.z
        ).normalize();
        tmpWorldPt.copy(mLocalPt).applyMatrix4(meshMatWorld);
        tmpWorldNormal.copy(mLocalNorm).transformDirection(meshMatWorld).normalize();
        mirrorCursorRing.position.copy(tmpWorldPt).addScaledVector(tmpWorldNormal, 0.008);
        tmpQuat.setFromUnitVectors(zUp, tmpWorldNormal);
        mirrorCursorRing.quaternion.copy(tmpQuat);
        mirrorCursorRing.scale.setScalar(r);
        mirrorCursorRing.visible = true;
      } else {
        mirrorCursorRing.visible = false;
      }
    };

    const getBrushParams = () => {
      const cur = stateRef.current;
      return {
        tool: cur.tool,
        radius: cur.brushSize,
        strength: cur.brushStrength,
        symmetry: cur.symmetry,
        stampMode: cur.stampMode,
        stampTileScale: cur.stampTileScale,
        embossDepth: cur.embossDepth,
        paintColor: cur.paintColor,
        paintMix: cur.paintMix,
        pattern: cur.activePattern,
      };
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return; // Right/middle click always orbits/pans
      if (stateRef.current.walkTest || !state.built) return;

      const hit = raycastCharacter(e.clientX, e.clientY);
      if (!hit) {
        // Clicked outside mesh -> allow OrbitControls to orbit freely
        state.controls.enabled = true;
        return;
      }

      // Sculpt stroke on character mesh
      state.controls.enabled = false;
      state.cameraFocusAnim = null;
      (state.renderer.domElement as HTMLElement).setPointerCapture?.(e.pointerId);

      pushUndoSnapshot();
      strokeRef.current.active = true;
      strokeRef.current.lastDabLocal.copy(hit.localPoint);

      const geo = state.built.skinnedMesh.geometry;
      const cur = stateRef.current;

      if (cur.tool === 'grab') {
        const camDir = new THREE.Vector3();
        state.camera.getWorldDirection(camDir);
        strokeRef.current.grabPlane.setFromNormalAndCoplanarPoint(camDir, hit.worldPoint);
        strokeRef.current.grabStartLocal.copy(hit.localPoint);
        strokeRef.current.grabSession = beginGrabSession(
          geo,
          hit.localPoint,
          cur.brushSize,
          cur.symmetry
        );
      } else {
        strokeRef.current.grabSession = null;
        applySculptBrushDab(
          geo,
          state.adjacency,
          hit.localPoint,
          hit.localNormal,
          getBrushParams()
        );
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!state.built) return;

      if (!strokeRef.current.active) {
        const hoverHit = raycastCharacter(e.clientX, e.clientY);
        updateBrushCursor(hoverHit);
        return;
      }

      const cur = stateRef.current;
      const geo = state.built.skinnedMesh.geometry;

      if (cur.tool === 'grab' && strokeRef.current.grabSession) {
        updatePointerNdc(e.clientX, e.clientY);
        raycaster.setFromCamera(pointerNdc, state.camera);
        const worldIntersect = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(strokeRef.current.grabPlane, worldIntersect)) {
          const curLocal = state.built.skinnedMesh.worldToLocal(worldIntersect.clone());
          const totalDelta = curLocal.sub(strokeRef.current.grabStartLocal);
          applyGrabDelta(geo, strokeRef.current.grabSession, totalDelta, cur.brushStrength);
        }
        return;
      }

      const hit = raycastCharacter(e.clientX, e.clientY);
      updateBrushCursor(hit);
      if (!hit) return;

      const prev = strokeRef.current.lastDabLocal;
      const dist = prev.distanceTo(hit.localPoint);
      const stepDist = Math.max(0.015, cur.brushSize * 0.26);
      const steps = Math.min(6, Math.max(1, Math.floor(dist / stepDist)));
      const params = getBrushParams();

      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const pt = new THREE.Vector3().lerpVectors(prev, hit.localPoint, t);
        applySculptBrushDab(geo, state.adjacency, pt, hit.localNormal, params);
      }
      strokeRef.current.lastDabLocal.copy(hit.localPoint);
    };

    const endStroke = (e?: PointerEvent) => {
      if (strokeRef.current.active) {
        strokeRef.current.active = false;
        strokeRef.current.grabSession = null;
      }
      state.controls.enabled = true;
      if (e) {
        try {
          (state.renderer.domElement as HTMLElement).releasePointerCapture?.(e.pointerId);
        } catch {
          // ignore
        }
      }
    };

    const onPointerLeave = () => {
      cursorRing.visible = false;
      mirrorCursorRing.visible = false;
    };

    const attachPointerListeners = (dom: HTMLElement) => {
      dom.addEventListener('pointerdown', onPointerDown);
      dom.addEventListener('pointermove', onPointerMove);
      dom.addEventListener('pointerup', endStroke);
      dom.addEventListener('pointercancel', endStroke);
      dom.addEventListener('pointerleave', onPointerLeave);
    };

    const detachPointerListeners = (dom: HTMLElement) => {
      dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('pointermove', onPointerMove);
      dom.removeEventListener('pointerup', endStroke);
      dom.removeEventListener('pointercancel', endStroke);
      dom.removeEventListener('pointerleave', onPointerLeave);
    };

    attachPointerListeners(renderer.domElement);

    const handleLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleRestored = () => setContextLost(false);
    renderer.domElement.addEventListener('webglcontextlost', handleLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleRestored);

    let disposed = false;
    let frameId = 0;
    let lastTime = performance.now();
    let prevWalkTest = false;
    let lastMagnifyUpdate = 0;

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      try {
        const cur = stateRef.current;
        const built = state.built;
        if (built) {
          if (state.rigController) {
            if (cur.walkTest) {
              state.rigController.update(dt, 'walk', 1.0);
            } else if (prevWalkTest) {
              state.rigController.resetToRestPose();
              snapCharacterRigToRestPose(
                built,
                state.initialBoneLocalPos,
                state.initialBoneWorldPos,
                cur.boneOffsets
              );
            }
          }
          prevWalkTest = cur.walkTest;

          if (state.skeletonHelper) {
            state.skeletonHelper.visible = cur.xrayMode;
          }
          if (state.jointMarkers) {
            state.jointMarkers.visible = cur.xrayMode;
            if (cur.xrayMode) {
              for (const child of state.jointMarkers.children) {
                const b = child.userData.trackBone as THREE.Bone | undefined;
                if (b) {
                  b.getWorldPosition(tmpBoneW);
                  child.position.copy(tmpBoneW);
                }
              }
            }
          }
        }

        if (state.cameraFocusAnim) {
          const alpha = isSoftwareGl ? 1 : 1 - Math.exp(-10 * dt);
          camera.position.lerp(state.cameraFocusAnim.targetPos, alpha);
          state.controls.target.lerp(state.cameraFocusAnim.targetLook, alpha);
          if (
            camera.position.distanceToSquared(state.cameraFocusAnim.targetPos) < 1e-4 &&
            state.controls.target.distanceToSquared(state.cameraFocusAnim.targetLook) < 1e-4
          ) {
            camera.position.copy(state.cameraFocusAnim.targetPos);
            state.controls.target.copy(state.cameraFocusAnim.targetLook);
            state.cameraFocusAnim = null;
          }
        }

        state.controls.update();

        // Sync Magnify readout at ~12Hz so React doesn't thrash every frame
        if (now - lastMagnifyUpdate > 85) {
          lastMagnifyUpdate = now;
          const dist = camera.position.distanceTo(state.controls.target);
          const mag = THREE.MathUtils.clamp(BASE_MAGNIFY_DISTANCE / Math.max(0.35, dist), 0.5, 4.0);
          setMagnify((prev) => (Math.abs(prev - mag) > 0.04 ? Number(mag.toFixed(2)) : prev));
        }

        renderer.render(scene, camera);
      } catch {
        // transient render error
      } finally {
        if (!disposed) {
          if (isSoftwareGl) frameId = window.setTimeout(tick, 60);
          else frameId = requestAnimationFrame(tick);
        }
      }
    };

    const switchToWebGLFallback = async (): Promise<boolean> => {
      if (disposed) return false;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      detachPointerListeners(renderer.domElement);
      renderer.domElement.removeEventListener('webglcontextlost', handleLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleRestored);
      controls.dispose();
      envTex?.dispose();
      envTex = null;
      try {
        renderer.dispose();
      } catch {
        // ignore
      }
      renderer = createMakerRenderer(isSoftwareGl, true);
      renderer.setSize(Math.max(320, host.clientWidth), Math.max(280, host.clientHeight));
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSoftwareGl ? 1 : 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.06;
      host.innerHTML = '';
      host.appendChild(renderer.domElement);
      attachPointerListeners(renderer.domElement);
      renderer.domElement.addEventListener('webglcontextlost', handleLost);
      renderer.domElement.addEventListener('webglcontextrestored', handleRestored);
      controls = createControls(renderer.domElement);
      controls.addEventListener('start', () => {
        state.cameraFocusAnim = null;
      });
      state.renderer = renderer;
      state.controls = controls;
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
      const w = Math.max(320, host.clientWidth);
      const h = Math.max(280, host.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(host);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      ro.disconnect();
      detachPointerListeners(renderer.domElement);
      if (state.skeletonHelper) {
        scene.remove(state.skeletonHelper);
        state.skeletonHelper.dispose();
      }
      if (state.jointMarkers) {
        scene.remove(state.jointMarkers);
        disposeObject3D(state.jointMarkers);
      }
      state.controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', handleLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleRestored);
      disposeObject3D(scene);
      envTex?.dispose();
      try {
        renderer.dispose();
      } catch {
        // ignore
      }
      if (renderer.domElement.parentNode === host) {
        host.removeChild(renderer.domElement);
      }
      sceneRef.current = null;
    };
  }, [doc.sculptData, initialRes, pushUndoSnapshot, rebuildCharacterInViewport]);

  // Toggle X-Ray Material Translucency live
  useEffect(() => {
    const st = sceneRef.current;
    if (!st?.built) return;
    const mats = Array.isArray(st.built.skinnedMesh.material)
      ? st.built.skinnedMesh.material
      : [st.built.skinnedMesh.material];
    for (const m of mats) {
      const clayMat = m as THREE.MeshStandardMaterial;
      if (clayMat) {
        clayMat.transparent = xrayMode;
        clayMat.opacity = xrayMode ? 0.42 : 1.0;
        clayMat.depthWrite = !xrayMode;
        clayMat.needsUpdate = true;
      }
    }
  }, [xrayMode]);

  // Keyboard shortcuts for Undo / Redo
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo]);

  const setCameraPreset = (preset: SculptCameraPreset) => {
    const st = sceneRef.current;
    if (!st) return;
    const headAnchor = st.built?.partAnchors.find((a) => a.key === 'head')?.worldPos;
    const hy = headAnchor ? headAnchor.y : 1.45;
    const map: Record<SculptCameraPreset, { pos: [number, number, number]; look: [number, number, number] }> = {
      full: { pos: [1.85, 1.38, 2.55], look: [0, 0.88, 0] },
      front: { pos: [0, 1.05, 2.7], look: [0, 0.88, 0] },
      side: { pos: [2.75, 1.02, 0.1], look: [0, 0.88, 0] },
      back: { pos: [0, 1.08, -2.7], look: [0, 0.88, 0] },
      top: { pos: [0, 3.6, 0.25], look: [0, 0.88, 0] },
      head: { pos: [0.35, hy + 0.04, 1.15], look: [0, hy, 0.06] },
    };
    const cfg = map[preset];
    st.cameraFocusAnim = {
      targetPos: new THREE.Vector3(...cfg.pos),
      targetLook: new THREE.Vector3(...cfg.look),
    };
  };

  const applyMagnifyLevel = (nextMag: number) => {
    const clamped = THREE.MathUtils.clamp(nextMag, 0.5, 4.0);
    setMagnify(Number(clamped.toFixed(2)));
    const st = sceneRef.current;
    if (!st) return;
    st.cameraFocusAnim = null;
    const dir = st.camera.position.clone().sub(st.controls.target);
    if (dir.lengthSq() < 1e-6) dir.set(0, 0.3, 1);
    dir.normalize();
    const targetDist = BASE_MAGNIFY_DISTANCE / clamped;
    st.camera.position.copy(st.controls.target).addScaledVector(dir, targetDist);
    st.controls.update();
  };

  const handleResolutionChange = (newRes: 36 | 48 | 64 | 72) => {
    if (newRes === sculptRes) return;
    const st = sceneRef.current;
    let currentSculpt: MonsterSculptData | undefined;
    if (st?.built && st.basePositions) {
      currentSculpt = extractMonsterSculptData(
        st.built.skinnedMesh.geometry,
        st.basePositions,
        st.baseColors,
        st.currentRes,
        stateRef.current.boneOffsets
      );
    }
    setSculptRes(newRes);
    rebuildCharacterInViewport(newRes, currentSculpt);
  };

  const handleAutoFitBones = () => {
    const st = sceneRef.current;
    if (!st?.built || !st.basePositions) return;
    pushUndoSnapshot();
    const offsets = computeAutoFitBoneOffsets(
      st.built.skinnedMesh.geometry,
      st.basePositions,
      st.built.bones
    ).filter((o) => o.boneName !== 'Hips');
    setBoneOffsets(offsets);
    snapCharacterRigToRestPose(
      st.built,
      st.initialBoneLocalPos,
      st.initialBoneWorldPos,
      offsets
    );
    st.rigController = createWalkControllerForBuilt(st.holder, st.built);
    if (offsets.length === 0) {
      setBoneStatusNote('No major limb or head shift detected yet. Pull or grab a limb first.');
    } else {
      setBoneStatusNote(
        `Adjusted ${offsets.length} existing bone pivot${offsets.length === 1 ? '' : 's'} to match sculpt.`
      );
      setXrayMode(true);
    }
  };

  const handleResetBones = () => {
    const st = sceneRef.current;
    if (!st?.built) return;
    pushUndoSnapshot();
    setBoneOffsets([]);
    snapCharacterRigToRestPose(
      st.built,
      st.initialBoneLocalPos,
      st.initialBoneWorldPos,
      []
    );
    st.rigController = createWalkControllerForBuilt(st.holder, st.built);
    setBoneStatusNote('Bone pivots reset to base proportions.');
  };

  const handleResetAllSculpt = () => {
    const st = sceneRef.current;
    if (!st?.built || !st.basePositions) return;
    pushUndoSnapshot();
    const geo = st.built.skinnedMesh.geometry;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const col = geo.attributes.color as THREE.BufferAttribute | undefined;
    (pos.array as Float32Array).set(st.basePositions);
    pos.needsUpdate = true;
    if (col && st.baseColors) {
      (col.array as Float32Array).set(st.baseColors);
      col.needsUpdate = true;
    }
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    geo.computeBoundingSphere();

    setBoneOffsets([]);
    snapCharacterRigToRestPose(
      st.built,
      st.initialBoneLocalPos,
      st.initialBoneWorldPos,
      []
    );
    st.rigController = createWalkControllerForBuilt(st.holder, st.built);
    setBoneStatusNote('Sculpt and paint cleared back to base character.');
  };

  const handleTextureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    try {
      const sampler = await createImagePatternSamplerFromFile(file);
      setCustomPattern(sampler);
      setSelectedPatternId('custom');
      setTool('stamp');
      setWalkTest(false);
    } catch {
      setUploadError('Could not load image. Please choose a valid PNG, JPG, or WEBP.');
    } finally {
      e.target.value = '';
    }
  };

  const handleApply = () => {
    const st = sceneRef.current;
    if (!st?.built || !st.basePositions) {
      onClose();
      return;
    }
    const sculptData = extractMonsterSculptData(
      st.built.skinnedMesh.geometry,
      st.basePositions,
      st.baseColors,
      st.currentRes,
      stateRef.current.boneOffsets
    );
    onSave({
      ...doc,
      sculptData: sculptData.enabled ? sculptData : undefined,
    });
    onClose();
  };

  const swatchPalette = useMemo(
    () =>
      Array.from(
        new Set([
          doc.torso.color,
          doc.head.color,
          doc.bellyColor,
          doc.upperArm.color,
          doc.extremityTipColor,
          '#F8FAFC',
          '#1E293B',
          '#DC2626',
          '#16A34A',
          '#F59E0B',
          '#7C5CFF',
        ].filter(Boolean))
      ),
    [doc.torso.color, doc.head.color, doc.bellyColor, doc.upperArm.color, doc.extremityTipColor]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4">
      <div className="w-full max-w-[1380px] h-[92dvh] bg-[#141824] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100">
        {/* Top Studio Bar (3 zones) */}
        <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-white/10 bg-[#181D2B] shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-white truncate">
              3D Sculpt &amp; Texture Stamp Studio
            </h2>
            <p className="text-xs text-slate-400 truncate">
              {charName || 'Custom Character'} &middot;{' '}
              <span className="tabular-nums">{vertexCountLabel.toLocaleString()}</span> vertices
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <button
              type="button"
              disabled={undoCount === 0}
              onClick={handleUndo}
              title="Undo (Ctrl+Z)"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/10 text-xs font-semibold text-slate-200 disabled:opacity-40 whitespace-nowrap shrink-0"
            >
              <Undo2 className="w-3.5 h-3.5" />
              Undo
            </button>
            <button
              type="button"
              disabled={redoCount === 0}
              onClick={handleRedo}
              title="Redo (Ctrl+Y)"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/10 text-xs font-semibold text-slate-200 disabled:opacity-40 whitespace-nowrap shrink-0"
            >
              <Redo2 className="w-3.5 h-3.5" />
              Redo
            </button>
            <button
              type="button"
              onClick={handleResetAllSculpt}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/10 text-xs font-semibold text-slate-200 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>

            <div className="h-5 w-px bg-white/10 mx-1 hidden sm:block" />

            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/10 text-xs font-semibold text-slate-300 whitespace-nowrap shrink-0"
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#20B46A] hover:bg-[#199958] text-xs font-bold text-white shadow-sm whitespace-nowrap shrink-0"
            >
              <Check className="w-4 h-4" />
              Apply Sculpt
            </button>
          </div>
        </div>

        {/* Main 3-Column Workspace */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          {/* Left Rail: Sculpt Brushes & Mesh Detail */}
          <aside className="w-full lg:w-[244px] border-b lg:border-b-0 lg:border-r border-white/10 bg-[#161B28] p-4 flex flex-col gap-5 overflow-y-auto shrink-0">
            <div>
              <div className="text-xs font-semibold text-slate-300 mb-2">Sculpt Brushes</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-1.5">
                {BRUSH_TOOLS.map((b) => {
                  const Icon = b.icon;
                  const active = tool === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      title={b.hint}
                      onClick={() => {
                        setTool(b.id);
                        if (walkTest) setWalkTest(false);
                      }}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left text-xs font-semibold transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-[#7C5CFF] border-[#7C5CFF] text-white'
                          : 'bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.08]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{b.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                {BRUSH_TOOLS.find((b) => b.id === tool)?.hint}
              </p>
            </div>

            <div className="h-px bg-white/10" />

            {/* Brush Size & Strength */}
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-slate-300">Brush Size</span>
                  <span className="font-mono text-slate-400 tabular-nums">
                    {Math.round(brushSize * 100)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.04"
                  max="0.45"
                  step="0.01"
                  value={brushSize}
                  onChange={(e) => setBrushSize(parseFloat(e.target.value))}
                  className="w-full accent-[#7C5CFF]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-slate-300">Strength</span>
                  <span className="font-mono text-slate-400 tabular-nums">
                    {Math.round(brushStrength * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.02"
                  value={brushStrength}
                  onChange={(e) => setBrushStrength(parseFloat(e.target.value))}
                  className="w-full accent-[#7C5CFF]"
                />
              </div>
            </div>

            <div className="h-px bg-white/10" />

            {/* Symmetry & X-Ray Toggles */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setSymmetry((v) => !v)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                  symmetry
                    ? 'bg-[#7C5CFF]/15 border-[#7C5CFF]/50 text-white'
                    : 'bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.08]'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <FlipHorizontal2 className="w-3.5 h-3.5" />
                  Symmetry X
                </span>
                <span className="text-[11px] font-mono tabular-nums">
                  {symmetry ? 'On' : 'Off'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setXrayMode((v) => !v)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                  xrayMode
                    ? 'bg-sky-500/20 border-sky-400/60 text-sky-100'
                    : 'bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.08]'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5" />
                  X-Ray Bones
                </span>
                <span className="text-[11px] font-mono tabular-nums">
                  {xrayMode ? 'On' : 'Off'}
                </span>
              </button>
            </div>

            <div className="h-px bg-white/10" />

            {/* Mesh Resolution */}
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-slate-300 inline-flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  Clay Resolution
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {RESOLUTION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleResolutionChange(opt.value)}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold tabular-nums whitespace-nowrap transition-colors ${
                      sculptRes === opt.value
                        ? 'bg-white/15 border-white/30 text-white'
                        : 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/[0.07]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                Higher resolution holds sharper crests and stamped textures.
              </p>
            </div>
          </aside>

          {/* Center 3D Sculpting Canvas */}
          <div className="flex-1 min-w-0 min-h-[320px] flex flex-col bg-[#111520] relative">
            {/* Viewport HUD Top Bar */}
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-[#151A27]/95 border-b border-white/10 flex-wrap z-10">
              <div className="flex items-center gap-1">
                {(
                  [
                    { id: 'full', label: 'Full' },
                    { id: 'front', label: 'Front' },
                    { id: 'side', label: 'Side' },
                    { id: 'back', label: 'Back' },
                    { id: 'top', label: 'Top' },
                    { id: 'head', label: 'Head' },
                  ] as { id: SculptCameraPreset; label: string }[]
                ).map((cam) => (
                  <button
                    key={cam.id}
                    type="button"
                    onClick={() => setCameraPreset(cam.id)}
                    className="px-2.5 py-1 rounded-md text-xs font-medium bg-white/[0.06] hover:bg-white/15 text-slate-300 hover:text-white whitespace-nowrap shrink-0"
                  >
                    {cam.label}
                  </button>
                ))}
              </div>

              {/* Magnify Control + Pose Toggle */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1">
                  <button
                    type="button"
                    aria-label="Zoom out"
                    onClick={() => applyMagnifyLevel(magnify - 0.35)}
                    className="p-0.5 text-slate-300 hover:text-white"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="range"
                    aria-label="Magnify level"
                    min="0.5"
                    max="4.0"
                    step="0.05"
                    value={magnify}
                    onChange={(e) => applyMagnifyLevel(parseFloat(e.target.value))}
                    className="w-20 accent-[#7C5CFF]"
                  />
                  <button
                    type="button"
                    aria-label="Zoom in"
                    onClick={() => applyMagnifyLevel(magnify + 0.35)}
                    className="p-0.5 text-slate-300 hover:text-white"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] font-mono text-slate-300 tabular-nums w-9 text-right">
                    {magnify.toFixed(1)}x
                  </span>
                </div>

                <div className="flex items-center gap-1 p-0.5 bg-white/[0.05] rounded-lg border border-white/10">
                  <button
                    type="button"
                    onClick={() => setWalkTest(false)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap ${
                      !walkTest ? 'bg-[#7C5CFF] text-white' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Sculpt Pose
                  </button>
                  <button
                    type="button"
                    onClick={() => setWalkTest(true)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap ${
                      walkTest ? 'bg-[#7C5CFF] text-white' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Play className="w-3 h-3" />
                    Walk Test
                  </button>
                </div>
              </div>
            </div>

            {/* 3D Canvas Host */}
            <div className="relative flex-1 min-h-0">
              <div
                ref={canvasHostRef}
                className={`w-full h-full ${walkTest ? 'cursor-grab' : 'cursor-crosshair'}`}
              />
              {contextLost && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#111520]/90 text-xs text-slate-300">
                  Restoring 3D sculpting viewport...
                </div>
              )}

              <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
                <div className="px-3 py-1.5 rounded-lg bg-[#0D1018]/85 border border-white/10 text-[11px] text-slate-300">
                  {walkTest
                    ? 'Previewing walk animation · Drag to orbit · Switch to Sculpt Pose to edit clay'
                    : 'Left-drag character to sculpt · Left-drag background or Right-drag to orbit · Scroll to magnify'}
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel: Auto-Fit Bones & Seamless Texture Stamp / Paint */}
          <aside className="w-full lg:w-[296px] border-t lg:border-t-0 lg:border-l border-white/10 bg-[#161B28] p-4 flex flex-col gap-5 overflow-y-auto shrink-0">
            {/* Skeleton & Bone Adjustment */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5">
                  <Bone className="w-3.5 h-3.5 text-amber-400" />
                  Skeleton &amp; Bone Fit
                </span>
                <span className="text-[11px] text-slate-400 tabular-nums">
                  {boneOffsets.length} fitted
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAutoFitBones}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-xs font-semibold text-amber-200 whitespace-nowrap"
                >
                  <Bone className="w-3.5 h-3.5" />
                  Auto-Fit Bones
                </button>
                <button
                  type="button"
                  disabled={boneOffsets.length === 0}
                  onClick={handleResetBones}
                  className="px-3 py-2 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/10 text-xs font-semibold text-slate-300 disabled:opacity-40 whitespace-nowrap"
                >
                  Reset
                </button>
              </div>

              {boneStatusNote && (
                <p className="text-[11px] text-amber-200/90 leading-snug">{boneStatusNote}</p>
              )}
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Shifts existing limb, neck, head, and tail joints to follow stretched limbs. Sculpted additions move with their parent body bone.
              </p>
            </div>

            <div className="h-px bg-white/10" />

            {/* Seamless Texture Stamp & Paint */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#7C5CFF]" />
                  Seamless Texture Stamp
                </span>
                {tool !== 'stamp' && (
                  <button
                    type="button"
                    onClick={() => {
                      setTool('stamp');
                      setWalkTest(false);
                    }}
                    className="text-[11px] font-semibold text-[#A78BFA] hover:underline whitespace-nowrap"
                  >
                    Use Stamp Brush
                  </button>
                )}
              </div>

              {/* Pattern Swatches */}
              <div className="grid grid-cols-3 gap-1.5">
                {PROCEDURAL_PATTERN_IDS.map((pid) => {
                  const pat = proceduralPatterns[pid];
                  const active = selectedPatternId === pid;
                  return (
                    <button
                      key={pid}
                      type="button"
                      onClick={() => {
                        setSelectedPatternId(pid);
                        setTool('stamp');
                        setWalkTest(false);
                      }}
                      className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border text-center transition-colors ${
                        active
                          ? 'bg-[#7C5CFF]/20 border-[#7C5CFF] text-white'
                          : 'bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.08]'
                      }`}
                    >
                      {pat.previewDataUrl ? (
                        <img
                          src={pat.previewDataUrl}
                          alt={pat.label}
                          className="w-full h-10 object-cover rounded border border-white/10"
                        />
                      ) : (
                        <div className="w-full h-10 rounded bg-white/10 flex items-center justify-center">
                          <Square className="w-4 h-4" />
                        </div>
                      )}
                      <span className="text-[10.5px] font-medium truncate w-full">{pat.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Upload Custom Seamless Texture */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleTextureUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                    selectedPatternId === 'custom' && customPattern
                      ? 'bg-[#7C5CFF]/20 border-[#7C5CFF] text-white'
                      : 'bg-white/[0.04] border-white/10 text-slate-200 hover:bg-white/10'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  {customPattern ? `Custom: ${customPattern.label}` : 'Load Seamless Texture'}
                </button>
                {customPattern && (
                  <div className="mt-2 flex items-center gap-2">
                    <img
                      src={customPattern.previewDataUrl}
                      alt={customPattern.label}
                      className="w-10 h-10 rounded object-cover border border-white/15 shrink-0"
                    />
                    <span className="text-[11px] text-slate-400 truncate">
                      Loaded custom seamless tile ready to stamp
                    </span>
                  </div>
                )}
                {uploadError && <p className="text-[11px] text-rose-400 mt-1">{uploadError}</p>}
              </div>

              {/* Stamp Apply Mode */}
              <div>
                <div className="text-xs font-medium text-slate-300 mb-1.5">Stamp Effect</div>
                <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-white/[0.04] border border-white/10">
                  {(
                    [
                      { id: 'both', label: '3D + Paint' },
                      { id: 'emboss', label: '3D Emboss' },
                      { id: 'paint', label: 'Paint Only' },
                    ] as { id: StampApplyMode; label: string }[]
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setStampMode(m.id)}
                      className={`py-1.5 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors ${
                        stampMode === m.id
                          ? 'bg-[#7C5CFF] text-white'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tile Scale & Emboss Depth */}
              <div className="space-y-2.5">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-300">Tile Scale</span>
                    <span className="font-mono text-slate-400 tabular-nums">
                      {stampTileScale.toFixed(2)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.4"
                    max="3.5"
                    step="0.05"
                    value={stampTileScale}
                    onChange={(e) => setStampTileScale(parseFloat(e.target.value))}
                    className="w-full accent-[#7C5CFF]"
                  />
                </div>

                {stampMode !== 'paint' && selectedPatternId !== 'paintOnly' && (
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-300">Emboss Depth</span>
                      <span className="font-mono text-slate-400 tabular-nums">
                        {Math.round(embossDepth * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="1.5"
                      step="0.05"
                      value={embossDepth}
                      onChange={(e) => setEmbossDepth(parseFloat(e.target.value))}
                      className="w-full accent-[#7C5CFF]"
                    />
                  </div>
                )}

                {stampMode !== 'emboss' && (
                  <>
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-slate-300">Paint Color</span>
                        <input
                          type="color"
                          aria-label="Paint color"
                          value={paintColor}
                          onChange={(e) => setPaintColor(e.target.value)}
                          className="w-7 h-5 rounded cursor-pointer bg-transparent border border-white/20"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {swatchPalette.map((hex) => (
                          <button
                            key={hex}
                            type="button"
                            aria-label={`Color ${hex}`}
                            onClick={() => setPaintColor(hex)}
                            className={`w-5 h-5 rounded-md border transition-transform ${
                              paintColor.toLowerCase() === hex.toLowerCase()
                                ? 'border-white scale-110'
                                : 'border-white/20'
                            }`}
                            style={{ backgroundColor: hex }}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-300">Paint Opacity</span>
                        <span className="font-mono text-slate-400 tabular-nums">
                          {Math.round(paintMix * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="1.0"
                        step="0.05"
                        value={paintMix}
                        onChange={(e) => setPaintMix(parseFloat(e.target.value))}
                        className="w-full accent-[#7C5CFF]"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
