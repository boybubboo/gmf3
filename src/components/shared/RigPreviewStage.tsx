import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { WebGPURenderer } from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import {
  getCachedAssetSync,
  instantiateCustomModel,
  loadCustomAssetToCache,
  type CustomModelInstance,
} from '../../three/gltfAssetManager';
import {
  createMakerRenderer,
  detectSoftwareGl,
  disposeObject3D,
  setupSceneEnvironment,
} from '../../three/islandScene';
import { isWebGPUFallbackAdapter } from '../../three/webglUtils';
import {
  getBoneWorldPosition,
  type RigTestOverride,
} from '../../three/proceduralRigAnimator';
import type {
  BonePoseAngles,
  CustomAssetMeta,
  CustomClipSlot,
  CustomRigSettings,
  GameLevel,
  GameProject,
  MotionActorTarget,
  MotionRigArchetype,
  VisualStyleId,
} from '../../types/maker';
import {
  applyContextPropsToHeroRig,
  describeTargetKey,
  instantiateStudioActor,
  listStudioActors,
  type StudioActorDescriptor,
  type StudioActorRuntime,
  type StudioContextPropsState,
} from '../../three/universalMotionAdapter';
import { getProjectInventoryItems } from '../../data/registries';
import { applyStudioInventoryAttachment } from '../../three/heroEquipmentAttachments';
import { buildQuickJointList } from './MotionEditorPanel';

export type StageCameraPreset = 'front' | 'side' | 'back' | 'threeQuarter';
export type GizmoAxisFilter = 'all' | 'X' | 'Y' | 'Z';

export interface OnionSkinPose {
  bones: Record<string, BonePoseAngles>;
  hipsOffsetY: number;
}

export interface OnionSkinConfig {
  enabled: boolean;
  prevPose: OnionSkinPose | null;
  nextPose: OnionSkinPose | null;
  opacity?: number;
}

const _markerPos = new THREE.Vector3();
const _gizmoPos = new THREE.Vector3();
const _gizmoQuat = new THREE.Quaternion();
const _jointCenterTmp = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();

type InternalGizmoGroup = THREE.Object3D & {
  gizmo?: Record<string, THREE.Object3D>;
  picker?: Record<string, THREE.Object3D>;
};

/**
 * Replaces Three.js TransformControls' razor-thin default rotation rings (0.0075 tube)
 * and narrow pickers with bold full-360° rings and generous touch-friendly hit toruses.
 */
function upgradeRotateGizmoForTouch(transformControls: TransformControls) {
  const helper = transformControls.getHelper() as unknown as InternalGizmoGroup;
  const gizmoRotate = helper?.gizmo?.rotate;
  const pickerRotate = helper?.picker?.rotate;

  const bakeMatrix = (geo: THREE.BufferGeometry, rot?: [number, number, number]) => {
    if (!rot) return geo;
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rot[0], rot[1], rot[2]));
    geo.applyMatrix4(m);
    return geo;
  };

  const makeRingGeo = (
    radius: number,
    tube: number,
    radialSegs: number,
    tubularSegs: number,
    rot?: [number, number, number]
  ) => {
    const geo = new THREE.TorusGeometry(radius, tube, radialSegs, tubularSegs, Math.PI * 2);
    // Match TransformControls CircleGeometry base alignment (YZ plane, axis = X)
    geo.rotateY(Math.PI / 2);
    geo.rotateX(Math.PI / 2);
    return bakeMatrix(geo, rot);
  };

  if (gizmoRotate) {
    gizmoRotate.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const oldGeo = mesh.geometry;
      const mat = mesh.material as THREE.MeshBasicMaterial | undefined;

      if (mesh.name === 'X') {
        mesh.geometry = makeRingGeo(0.5, 0.026, 12, 64);
        if (mat?.color) {
          mat.color.set('#FF4D6D');
          mat.opacity = 0.94;
        }
        oldGeo.dispose();
      } else if (mesh.name === 'Y') {
        mesh.geometry = makeRingGeo(0.5, 0.026, 12, 64, [0, 0, -Math.PI / 2]);
        if (mat?.color) {
          mat.color.set('#22C55E');
          mat.opacity = 0.94;
        }
        oldGeo.dispose();
      } else if (mesh.name === 'Z') {
        mesh.geometry = makeRingGeo(0.5, 0.026, 12, 64, [0, Math.PI / 2, 0]);
        if (mat?.color) {
          mat.color.set('#38BDF8');
          mat.opacity = 0.94;
        }
        oldGeo.dispose();
      } else if (mesh.name === 'E') {
        mesh.geometry = makeRingGeo(0.76, 0.02, 12, 64, [0, Math.PI / 2, 0]);
        if (mat?.color) {
          mat.color.set('#FBBF24');
          mat.opacity = 0.78;
        }
        oldGeo.dispose();
      } else if (mesh.name === 'XYZE') {
        mesh.geometry = makeRingGeo(0.5, 0.011, 8, 48, [0, Math.PI / 2, 0]);
        if (mat?.color) {
          mat.color.set('#E2E8F0');
          mat.opacity = 0.28;
        }
        oldGeo.dispose();
      }
    });
  }

  if (pickerRotate) {
    pickerRotate.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const oldGeo = mesh.geometry;

      if (mesh.name === 'X') {
        mesh.geometry = bakeMatrix(new THREE.TorusGeometry(0.5, 0.19, 10, 28), [
          0,
          -Math.PI / 2,
          -Math.PI / 2,
        ]);
        oldGeo.dispose();
      } else if (mesh.name === 'Y') {
        mesh.geometry = bakeMatrix(new THREE.TorusGeometry(0.5, 0.19, 10, 28), [
          Math.PI / 2,
          0,
          0,
        ]);
        oldGeo.dispose();
      } else if (mesh.name === 'Z') {
        mesh.geometry = bakeMatrix(new THREE.TorusGeometry(0.5, 0.19, 10, 28), [
          0,
          0,
          -Math.PI / 2,
        ]);
        oldGeo.dispose();
      } else if (mesh.name === 'E') {
        mesh.geometry = new THREE.TorusGeometry(0.76, 0.18, 10, 28);
        oldGeo.dispose();
      } else if (mesh.name === 'XYZE') {
        // Keep center freeball strictly inside the inner hole of the fat X/Y/Z rings
        mesh.geometry = new THREE.SphereGeometry(0.24, 12, 10);
        oldGeo.dispose();
      }
    });
  }
}

function applyAxisFilterToGizmo(
  transformControls: TransformControls,
  filter: GizmoAxisFilter,
  detachedStore: { parent: THREE.Object3D; child: THREE.Object3D }[]
) {
  transformControls.showX = filter === 'all' || filter === 'X';
  transformControls.showY = filter === 'all' || filter === 'Y';
  transformControls.showZ = filter === 'all' || filter === 'Z';

  // Restore any previously detached E / XYZE handles first
  while (detachedStore.length > 0) {
    const entry = detachedStore.pop()!;
    if (entry.child.parent !== entry.parent) {
      entry.parent.add(entry.child);
    }
  }

  // When isolating a single axis (X, Y, or Z), detach E / XYZE handles from both
  // gizmo.rotate and picker.rotate so TransformControls neither draws nor raycasts them.
  if (filter !== 'all') {
    const helper = transformControls.getHelper() as unknown as InternalGizmoGroup;
    for (const container of [helper?.gizmo?.rotate, helper?.picker?.rotate]) {
      if (!container) continue;
      const toDetach = container.children.filter((c) => c.name === 'E' || c.name === 'XYZE');
      for (const child of toDetach) {
        container.remove(child);
        detachedStore.push({ parent: container, child });
      }
    }
  }
}

interface StageRefs {
  renderer: WebGPURenderer;
  rendererInitialized: boolean;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  transformControls: TransformControls;
  detachedGizmoHandles: { parent: THREE.Object3D; child: THREE.Object3D }[];
  gizmoTarget: THREE.Object3D;
  gizmoDragging: boolean;
  lastGizmoDragEndMs: number;
  modelContainer: THREE.Group;
  onionContainer: THREE.Group;
  prevGhostInstance: CustomModelInstance | null;
  nextGhostInstance: CustomModelInstance | null;
  prevGhostMat: THREE.MeshStandardMaterial | null;
  nextGhostMat: THREE.MeshStandardMaterial | null;
  skeletonHelper: THREE.SkeletonHelper | null;
  jointMarker: THREE.Mesh;
  jointHandlesGroup: THREE.Group;
  jointHandleMeshes: Map<string, THREE.Mesh>;
  jointHitMeshes: Map<string, THREE.Mesh>;
  jointHandleScale: number;
  jointHandleSignature: string;
  ghostLines: THREE.LineSegments;
  ghostPoints: THREE.Points;
  floorMesh: THREE.Mesh;
  groundRingMesh: THREE.Mesh;
  gridHelper: THREE.GridHelper;
  arrowMesh: THREE.Mesh;
  instance: CustomModelInstance | null;
  studioRuntime: StudioActorRuntime | null;
  camGoalPos: THREE.Vector3 | null;
  camGoalTarget: THREE.Vector3 | null;
}

export interface RigPreviewStageProps {
  asset?: CustomAssetMeta | null;
  actorTarget?: MotionActorTarget | null;
  project?: GameProject | null;
  currentLevel?: GameLevel | null;
  customAssets?: CustomAssetMeta[];
  contextProps?: StudioContextPropsState;
  rigSettings: CustomRigSettings;
  boneNames: string[];
  previewSlot: CustomClipSlot;
  paused: boolean;
  showSkeleton: boolean;
  xrayMesh: boolean;
  cameraPreset: StageCameraPreset;
  cameraResetNonce: number;
  testOverride: RigTestOverride;
  highlightBoneName: string | null;
  poseMode: boolean;
  motionPlaying: boolean;
  workingBones: Record<string, BonePoseAngles>;
  ghostStartPose: { bones: Record<string, BonePoseAngles>; hipsOffsetY: number } | null;
  onionSkin?: OnionSkinConfig | null;
  showGizmo?: boolean;
  showJointDots?: boolean;
  gizmoSize?: number;
  gizmoAxisFilter?: GizmoAxisFilter;
  lockCameraOrbit?: boolean;
  containerClassName?: string;
  onSelectPoseBone: (boneName: string) => void;
  onGizmoRotateBone: (boneName: string, angles: BonePoseAngles) => void;
  onPlayheadTick: (timeNorm: number) => void;
  captureLivePoseRef: React.MutableRefObject<
    ((slot: CustomClipSlot) => { bones: Record<string, BonePoseAngles>; hipsOffsetY: number } | null) | null
  >;
  capturePoseThumbnailRef?: React.MutableRefObject<(() => string | null) | null>;
  onRuntimeReady?: (info: {
    boneNames: string[];
    rigSettings: CustomRigSettings;
    archetype: MotionRigArchetype;
    hipsHeightRef: number;
    hasTelegraph: boolean;
    hasHeroProps: boolean;
  }) => void;
  onDriverChange?: (label: string) => void;
  onTestStatusChange?: (status: string | null) => void;
}

export const RigPreviewStage: React.FC<RigPreviewStageProps> = ({
  asset = null,
  actorTarget = null,
  project = null,
  currentLevel = null,
  customAssets = [],
  contextProps,
  rigSettings,
  boneNames,
  previewSlot,
  paused,
  showSkeleton,
  xrayMesh,
  cameraPreset,
  cameraResetNonce,
  testOverride,
  highlightBoneName,
  poseMode,
  motionPlaying,
  workingBones,
  ghostStartPose,
  onionSkin = null,
  showGizmo = true,
  showJointDots = true,
  gizmoSize = 1.25,
  gizmoAxisFilter = 'all',
  lockCameraOrbit = false,
  containerClassName = 'w-full h-64 sm:h-72 rounded-2xl border border-slate-200 dark:border-white/[0.1]',
  onSelectPoseBone,
  onGizmoRotateBone,
  onPlayheadTick,
  captureLivePoseRef,
  capturePoseThumbnailRef,
  onRuntimeReady,
  onDriverChange,
  onTestStatusChange,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<StageRefs | null>(null);
  const stateRef = useRef({
    paused,
    animSpeed: asset?.animSpeed ?? 1,
    highlightBoneName,
    rigSettings,
    boneNames,
    previewSlot,
    testOverride,
    showSkeleton,
    xrayMesh,
    poseMode,
    motionPlaying,
    workingBones,
    ghostStartPose,
    onionSkin,
    showGizmo,
    showJointDots,
    gizmoSize,
    gizmoAxisFilter,
    lockCameraOrbit,
    contextProps,
    onSelectPoseBone,
    onGizmoRotateBone,
    onPlayheadTick,
    onRuntimeReady,
    onDriverChange,
    onTestStatusChange,
  });

  stateRef.current = {
    paused,
    animSpeed: asset?.animSpeed ?? 1,
    highlightBoneName,
    rigSettings,
    boneNames,
    previewSlot,
    testOverride,
    showSkeleton,
    xrayMesh,
    poseMode,
    motionPlaying,
    workingBones,
    ghostStartPose,
    onionSkin,
    showGizmo,
    showJointDots,
    gizmoSize,
    gizmoAxisFilter,
    lockCameraOrbit,
    contextProps,
    onSelectPoseBone,
    onGizmoRotateBone,
    onPlayheadTick,
    onRuntimeReady,
    onDriverChange,
    onTestStatusChange,
  };

  // Expose live pose capture function so "Grab Live Pose" can snapshot Idle/Walk/Run/Attack/Wave
  useEffect(() => {
    captureLivePoseRef.current = (slot: CustomClipSlot) => {
      const inst = stageRef.current?.instance;
      if (!inst?.proceduralRig) return null;
      const prevOverride = stateRef.current.testOverride;
      const prevSlot = inst.currentSlot;
      inst.setTestOverride(null);
      inst.setAction(slot, 0);
      inst.update(0.05, 1);
      const snapshot = inst.proceduralRig.captureCurrentCharSpacePose();
      inst.setAction(prevSlot, 0);
      inst.setTestOverride(prevOverride);
      inst.update(0, 1);
      return snapshot;
    };
    return () => {
      captureLivePoseRef.current = null;
    };
  }, [captureLivePoseRef]);

  // Expose clean 3D pose thumbnail capture (hides gizmo, joint dots, onion skins, and skeleton overlays)
  useEffect(() => {
    if (!capturePoseThumbnailRef) return;
    capturePoseThumbnailRef.current = () => {
      const refs = stageRef.current;
      if (!refs || !refs.instance || !refs.rendererInitialized) return null;

      const gizmoHelper = refs.transformControls.getHelper();
      const prevGizmoVis = gizmoHelper.visible;
      const prevJointDotsVis = refs.jointHandlesGroup.visible;
      const prevJointMarkerVis = refs.jointMarker.visible;
      const prevOnionVis = refs.onionContainer.visible;
      const prevGhostLinesVis = refs.ghostLines.visible;
      const prevGhostPointsVis = refs.ghostPoints.visible;
      const prevSkelVis = refs.skeletonHelper?.visible ?? false;
      const wasXray = stateRef.current.xrayMesh;

      try {
        gizmoHelper.visible = false;
        refs.jointHandlesGroup.visible = false;
        refs.jointMarker.visible = false;
        refs.onionContainer.visible = false;
        refs.ghostLines.visible = false;
        refs.ghostPoints.visible = false;
        if (refs.skeletonHelper) refs.skeletonHelper.visible = false;
        if (wasXray) applyXrayToInstance(refs.instance, false);

        refs.instance.update(0, 1);
        refs.modelContainer.updateMatrixWorld(true);

        const srcCanvas = refs.renderer.domElement;
        const srcW = srcCanvas.width;
        const srcH = srcCanvas.height;
        if (srcW < 4 || srcH < 4) return null;

        const aspect = srcW / srcH;
        const thumbCam = new THREE.PerspectiveCamera(34, aspect, 0.1, 45);
        const box = new THREE.Box3().setFromObject(refs.modelContainer);
        const center = new THREE.Vector3(0, 0.95, 0);
        const size = new THREE.Vector3(1.2, 1.9, 1.2);
        if (!box.isEmpty()) {
          box.getCenter(center);
          box.getSize(size);
        }
        const maxDim = Math.max(size.x, size.y, size.z, 1.15);
        const portraitFactor = aspect < 1 ? 1 / Math.max(0.45, aspect) : 1;
        const dist = maxDim * 1.72 * portraitFactor;
        thumbCam.position.set(
          center.x + dist * 0.42,
          center.y + maxDim * 0.12,
          center.z + dist * 0.92
        );
        thumbCam.lookAt(center.x, center.y, center.z);
        thumbCam.updateProjectionMatrix();

        refs.renderer.render(refs.scene, thumbCam);

        const thumbSize = 240;
        const outCanvas = document.createElement('canvas');
        outCanvas.width = thumbSize;
        outCanvas.height = thumbSize;
        const ctx = outCanvas.getContext('2d');
        if (!ctx) return null;

        const cropSide = Math.min(srcW, srcH);
        const cropX = Math.floor((srcW - cropSide) * 0.5);
        const cropY = Math.floor((srcH - cropSide) * 0.5);
        ctx.drawImage(srcCanvas, cropX, cropY, cropSide, cropSide, 0, 0, thumbSize, thumbSize);

        return outCanvas.toDataURL('image/jpeg', 0.86);
      } catch {
        return null;
      } finally {
        gizmoHelper.visible = prevGizmoVis;
        refs.jointHandlesGroup.visible = prevJointDotsVis;
        refs.jointMarker.visible = prevJointMarkerVis;
        refs.onionContainer.visible = prevOnionVis;
        refs.ghostLines.visible = prevGhostLinesVis;
        refs.ghostPoints.visible = prevGhostPointsVis;
        if (refs.skeletonHelper) refs.skeletonHelper.visible = prevSkelVis;
        if (wasXray) applyXrayToInstance(refs.instance, true);
        try {
          refs.renderer.render(refs.scene, refs.camera);
        } catch {
          // ignore if context unavailable during unmount
        }
      }
    };
    return () => {
      capturePoseThumbnailRef.current = null;
    };
  }, [capturePoseThumbnailRef]);

  const applyXrayToInstance = (inst: CustomModelInstance | null, enabled: boolean) => {
    if (!inst) return;
    inst.modelRoot.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        const std = m as THREE.MeshStandardMaterial;
        if (std.userData.origTransparent === undefined) {
          std.userData.origTransparent = std.transparent;
          std.userData.origOpacity = std.opacity;
          std.userData.origDepthWrite = std.depthWrite;
        }
        if (enabled) {
          std.transparent = true;
          std.opacity = 0.36;
          std.depthWrite = false;
        } else {
          std.transparent = Boolean(std.userData.origTransparent);
          std.opacity = Number(std.userData.origOpacity ?? 1);
          std.depthWrite = Boolean(std.userData.origDepthWrite ?? true);
        }
        std.needsUpdate = true;
      }
    });
  };

  const rebuildJointHandles = (
    refs: StageRefs,
    names: string[],
    rig: CustomRigSettings,
    actorRadius?: number
  ) => {
    while (refs.jointHandlesGroup.children.length > 0) {
      const child = refs.jointHandlesGroup.children[0] as THREE.Mesh;
      refs.jointHandlesGroup.remove(child);
      child.geometry.dispose();
      (child.material as THREE.Material).dispose();
    }
    refs.jointHandleMeshes.clear();
    refs.jointHitMeshes.clear();

    const quick = buildQuickJointList(names, rig.boneMap);
    const list =
      quick.length > 0
        ? quick.map((q) => q.boneName)
        : names
            .filter((n) => !/end|tip|thumb|index|middle|ring|pinky|toe|eye|jaw|hair/i.test(n))
            .slice(0, 18);

    const handleScale =
      typeof actorRadius === 'number' && Number.isFinite(actorRadius)
        ? THREE.MathUtils.clamp(actorRadius * 0.85, 1.0, 2.4)
        : 1.0;
    refs.jointHandleScale = handleScale;
    refs.jointHandleSignature = `${names.join(',')}|${JSON.stringify(rig.boneMap)}|${handleScale.toFixed(2)}`;

    const sphereGeo = new THREE.SphereGeometry(0.062 * handleScale, 14, 12);
    const hitGeo = new THREE.SphereGeometry(0.13 * handleScale, 10, 8);
    const hitMat = new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    });
    for (const boneName of list) {
      const mat = new THREE.MeshBasicMaterial({
        color: '#22D3EE',
        depthTest: false,
        transparent: true,
        opacity: 0.78,
      });
      const mesh = new THREE.Mesh(sphereGeo.clone(), mat);
      mesh.renderOrder = 997;
      mesh.userData.boneName = boneName;
      refs.jointHandlesGroup.add(mesh);
      refs.jointHandleMeshes.set(boneName, mesh);

      // Larger invisible touch-friendly picking sphere so fingers easily select joints
      const hitMesh = new THREE.Mesh(hitGeo.clone(), hitMat.clone());
      hitMesh.userData.boneName = boneName;
      refs.jointHandlesGroup.add(hitMesh);
      refs.jointHitMeshes.set(boneName, hitMesh);

      const node = refs.instance?.proceduralRig?.getBoneNode(boneName);
      if (node) {
        getBoneWorldPosition(node, _markerPos);
        mesh.position.copy(_markerPos);
        hitMesh.position.copy(_markerPos);
      }
    }
    sphereGeo.dispose();
    hitGeo.dispose();
    hitMat.dispose();
  };

  const pickJointBoneAtRay = (refs: StageRefs, raycaster: THREE.Raycaster): string | null => {
    refs.jointHandlesGroup.updateMatrixWorld(true);

    const pickClosestCenter = (meshes: THREE.Mesh[]): string | null => {
      if (meshes.length === 0) return null;
      const hits = raycaster.intersectObjects(meshes, false);
      if (hits.length === 0) return null;
      let bestName: string | null = null;
      let bestScore = Infinity;
      for (const hit of hits) {
        const bName = String(hit.object.userData.boneName || '');
        if (!bName) continue;
        hit.object.getWorldPosition(_jointCenterTmp);
        const rayDistSq = raycaster.ray.distanceSqToPoint(_jointCenterTmp);
        const score = rayDistSq + hit.distance * 1e-5;
        if (score < bestScore) {
          bestScore = score;
          bestName = bName;
        }
      }
      return bestName;
    };

    const visibleMeshes = Array.from(refs.jointHandleMeshes.values()).filter((m) => m.visible);
    const direct = pickClosestCenter(visibleMeshes);
    if (direct) return direct;

    const hitMeshes = Array.from(refs.jointHitMeshes.values()).filter((m) => m.visible);
    return pickClosestCenter(hitMeshes);
  };

  // 1. Mount persistent Three.js stage once (with automatic WebGPU -> WebGL2 fallback)
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();
    let renderer = createMakerRenderer(isSoftwareGl);
    renderer.setSize(container.clientWidth || 640, container.clientHeight || 360);
    renderer.domElement.style.touchAction = 'none';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#111521');
    let envTex: THREE.Texture | null = null;

    const camera = new THREE.PerspectiveCamera(
      38,
      (container.clientWidth || 640) / Math.max(1, container.clientHeight || 360),
      0.08,
      80
    );
    camera.position.set(2.35, 1.8, 3.1);

    const gizmoTarget = new THREE.Object3D();
    scene.add(gizmoTarget);

    const detachedGizmoHandles: { parent: THREE.Object3D; child: THREE.Object3D }[] = [];

    const hemi = new THREE.HemisphereLight('#DCEBFF', '#293042', 0.95);
    const key = new THREE.DirectionalLight('#FFF5E0', 1.85);
    key.position.set(3.5, 6, 4.2);
    const rim = new THREE.DirectionalLight('#8B7CFF', 0.9);
    rim.position.set(-4, 3.5, -3.5);
    scene.add(hemi, key, rim);

    // Turntable floor + grid + forward (+Z) indicator chevron
    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(1.85, 1.95, 0.08, 44),
      new THREE.MeshStandardMaterial({ color: '#1B2030', roughness: 0.85, metalness: 0.08 })
    );
    floor.position.y = -0.04;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(3.4, 12, '#3A4462', '#262D42');
    grid.position.y = 0.004;
    scene.add(grid);

    // Clear floor-contact ring at y = 0.006 so creators immediately see foot/belly clearance
    const groundRingMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.46, 0.505, 44),
      new THREE.MeshBasicMaterial({
        color: '#22D3EE',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.48,
      })
    );
    groundRingMesh.rotation.x = -Math.PI / 2;
    groundRingMesh.position.y = 0.006;
    scene.add(groundRingMesh);

    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(0, 0.32);
    arrowShape.lineTo(0.18, 0.04);
    arrowShape.lineTo(0.07, 0.04);
    arrowShape.lineTo(0.07, -0.18);
    arrowShape.lineTo(-0.07, -0.18);
    arrowShape.lineTo(-0.07, 0.04);
    arrowShape.lineTo(-0.18, 0.04);
    arrowShape.closePath();
    const arrowGeo = new THREE.ShapeGeometry(arrowShape);
    arrowGeo.rotateX(Math.PI / 2);
    const arrowMesh = new THREE.Mesh(
      arrowGeo,
      new THREE.MeshBasicMaterial({ color: '#7C5CFF', side: THREE.DoubleSide })
    );
    arrowMesh.position.set(0, 0.012, 1.32);
    scene.add(arrowMesh);

    const modelContainer = new THREE.Group();
    scene.add(modelContainer);

    const onionContainer = new THREE.Group();
    scene.add(onionContainer);

    const jointMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.068, 16, 12),
      new THREE.MeshBasicMaterial({
        color: '#F59E0B',
        depthTest: false,
        transparent: true,
        opacity: 0.95,
      })
    );
    jointMarker.renderOrder = 999;
    jointMarker.visible = false;
    scene.add(jointMarker);

    const jointHandlesGroup = new THREE.Group();
    jointHandlesGroup.visible = false;
    scene.add(jointHandlesGroup);

    const ghostLinesGeo = new THREE.BufferGeometry();
    const ghostLinesMat = new THREE.LineBasicMaterial({
      color: '#22D3EE',
      depthTest: false,
      transparent: true,
      opacity: 0.85,
    });
    const ghostLines = new THREE.LineSegments(ghostLinesGeo, ghostLinesMat);
    ghostLines.renderOrder = 996;
    ghostLines.visible = false;
    scene.add(ghostLines);

    const ghostPointsGeo = new THREE.BufferGeometry();
    const ghostPointsMat = new THREE.PointsMaterial({
      color: '#34D399',
      size: 0.078,
      sizeAttenuation: true,
      depthTest: false,
      transparent: true,
      opacity: 0.92,
    });
    const ghostPoints = new THREE.Points(ghostPointsGeo, ghostPointsMat);
    ghostPoints.renderOrder = 996;
    ghostPoints.visible = false;
    scene.add(ghostPoints);

    // Placeholder references initialized right below via bindDomControls
    let transformControls!: TransformControls;
    let controls!: OrbitControls;

    const refs: StageRefs = {
      renderer,
      rendererInitialized: false,
      scene,
      camera,
      controls,
      transformControls,
      detachedGizmoHandles,
      gizmoTarget,
      gizmoDragging: false,
      lastGizmoDragEndMs: 0,
      modelContainer,
      onionContainer,
      prevGhostInstance: null,
      nextGhostInstance: null,
      prevGhostMat: null,
      nextGhostMat: null,
      skeletonHelper: null,
      jointMarker,
      jointHandlesGroup,
      jointHandleMeshes: new Map(),
      jointHitMeshes: new Map(),
      jointHandleScale: 1.0,
      jointHandleSignature: '',
      ghostLines,
      ghostPoints,
      floorMesh: floor,
      groundRingMesh,
      gridHelper: grid,
      arrowMesh,
      instance: null,
      studioRuntime: null,
      camGoalPos: null,
      camGoalTarget: null,
    };

    let downX = 0;
    let downY = 0;
    let downButton = 0;
    let wasGizmoDown = false;
    let downGizmoAxis: string | null = null;
    let downJointBone: string | null = null;
    let gizmoDragMoved = false;
    let lastHoverTime = 0;
    let hoveredBone: string | null = null;

    const onGizmoDraggingChanged = (e: { value: unknown }) => {
      const dragging = Boolean(e.value);
      refs.gizmoDragging = dragging;
      if (!dragging) {
        refs.lastGizmoDragEndMs = performance.now();
      }
      refs.controls.enabled = !dragging && !stateRef.current.lockCameraOrbit;
    };

    const onGizmoObjectChange = () => {
      if (!refs.gizmoDragging || !gizmoDragMoved) return;
      const cur = stateRef.current;
      const inst = refs.instance;
      if (!cur.poseMode || cur.motionPlaying || !cur.highlightBoneName || !inst?.proceduralRig) {
        return;
      }
      const nextAngles = inst.proceduralRig.computeAnglesFromGizmoWorldQuat(gizmoTarget.quaternion);
      inst.proceduralRig.applyCharSpaceBoneAngles(cur.highlightBoneName, nextAngles);
      cur.onGizmoRotateBone(cur.highlightBoneName, nextAngles);
    };

    const cancelCamGoal = () => {
      refs.camGoalPos = null;
      refs.camGoalTarget = null;
    };

    const setNdcFromEvent = (ev: PointerEvent) => {
      const rect = refs.renderer.domElement.getBoundingClientRect();
      _ndc.x = ((ev.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      _ndc.y = -((ev.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
    };

    const onPointerDown = (ev: PointerEvent) => {
      downX = ev.clientX;
      downY = ev.clientY;
      downButton = ev.button;
      // TransformControls runs before us, so refs.gizmoDragging & axis are already set if user touched a ring
      wasGizmoDown = refs.gizmoDragging;
      downGizmoAxis = wasGizmoDown ? refs.transformControls.axis : null;
      gizmoDragMoved = false;
      const cur = stateRef.current;
      if (cur.poseMode && !cur.motionPlaying && cur.showJointDots && refs.jointHandlesGroup.visible) {
        setNdcFromEvent(ev);
        _raycaster.setFromCamera(_ndc, camera);
        downJointBone = pickJointBoneAtRay(refs, _raycaster);
      } else {
        downJointBone = null;
      }
    };

    const onPointerMove = (ev: PointerEvent) => {
      const cur = stateRef.current;
      if (refs.gizmoDragging || wasGizmoDown) {
        const onOtherJoint = Boolean(downJointBone && downJointBone !== cur.highlightBoneName);
        const dragDeadzone = onOtherJoint
          ? ev.pointerType === 'touch'
            ? 14
            : 6
          : ev.pointerType === 'touch'
          ? 6
          : 3;
        if (Math.hypot(ev.clientX - downX, ev.clientY - downY) >= dragDeadzone) {
          gizmoDragMoved = true;
        }
      }
      const domEl = refs.renderer.domElement;
      if (!cur.poseMode || cur.motionPlaying || refs.gizmoDragging || ev.pointerType === 'touch') {
        if (hoveredBone !== null) hoveredBone = null;
        domEl.style.cursor = refs.gizmoDragging ? 'grabbing' : 'grab';
        return;
      }
      const now = performance.now();
      if (now - lastHoverTime < 40) return;
      lastHoverTime = now;

      if (cur.showJointDots && refs.jointHandlesGroup.visible) {
        setNdcFromEvent(ev);
        _raycaster.setFromCamera(_ndc, camera);
        hoveredBone = pickJointBoneAtRay(refs, _raycaster);
      } else {
        hoveredBone = null;
      }
      domEl.style.cursor = hoveredBone ? 'pointer' : 'grab';
    };

    const onPointerCancel = () => {
      wasGizmoDown = false;
      downGizmoAxis = null;
      downJointBone = null;
      gizmoDragMoved = false;
    };

    const onPointerUp = (ev: PointerEvent) => {
      const cur = stateRef.current;
      const inst = refs.instance;
      const didDragGizmo =
        gizmoDragMoved &&
        (wasGizmoDown || refs.gizmoDragging || performance.now() - refs.lastGizmoDragEndMs < 180);
      const axisOnDown = downGizmoAxis;
      wasGizmoDown = false;
      downGizmoAxis = null;
      downJointBone = null;
      gizmoDragMoved = false;

      if (!cur.poseMode || cur.motionPlaying || !inst?.proceduralRig) return;
      if (ev.pointerType !== 'touch' && downButton !== 0 && ev.button !== 0) return;

      const maxTapMove = ev.pointerType === 'touch' ? 16 : 6;
      const moved = Math.hypot(ev.clientX - downX, ev.clientY - downY);
      if (moved > maxTapMove || didDragGizmo) return;

      setNdcFromEvent(ev);
      _raycaster.setFromCamera(_ndc, camera);

      // 1. Always prioritize clicking joint pivot circles on a clean tap — even when the dot
      //    sits inside the currently active gizmo's oversized invisible rotation pickers.
      if (cur.showJointDots && refs.jointHandlesGroup.visible) {
        const pickedBone = pickJointBoneAtRay(refs, _raycaster);
        if (pickedBone) {
          cur.onSelectPoseBone(pickedBone);
          return;
        }
      }

      // 2. Fallback: tapping on a character body part selects its nearest joint
      //    (unless the tap landed directly on an X/Y/Z axis ring).
      const touchedAxisRing = axisOnDown === 'X' || axisOnDown === 'Y' || axisOnDown === 'Z';
      if (!touchedAxisRing) {
        const meshHits = _raycaster.intersectObject(inst.modelRoot, true);
        if (meshHits.length > 0) {
          const maxMeshDist = Math.max(0.75, (refs.studioRuntime?.radius ?? 1.0) * 0.65);
          const nearest = inst.proceduralRig.findNearestBoneToWorldPoint(
            meshHits[0].point,
            maxMeshDist
          );
          if (nearest) {
            cur.onSelectPoseBone(nearest);
          }
        }
      }
    };

    const bindDomControls = (
      domEl: HTMLElement,
      prevTarget = new THREE.Vector3(0, 0.95, 0),
      prevMinDist = 0.85,
      prevMaxDist = 12
    ) => {
      domEl.style.touchAction = 'none';

      // IMPORTANT: Register TransformControls BEFORE OrbitControls so touch pointerdown
      // hits the gizmo FIRST and disables OrbitControls before camera orbit can hijack the touch!
      transformControls = new TransformControls(camera, domEl);
      transformControls.setMode('rotate');
      transformControls.setSpace('local');
      transformControls.setSize(stateRef.current.gizmoSize);
      upgradeRotateGizmoForTouch(transformControls);
      applyAxisFilterToGizmo(
        transformControls,
        stateRef.current.gizmoAxisFilter,
        detachedGizmoHandles
      );
      const gizmoHelper = transformControls.getHelper();
      gizmoHelper.renderOrder = 1000;
      scene.add(gizmoHelper);
      transformControls.addEventListener('dragging-changed', onGizmoDraggingChanged);
      transformControls.addEventListener('objectChange', onGizmoObjectChange);

      controls = new OrbitControls(camera, domEl);
      controls.target.copy(prevTarget);
      controls.enableDamping = !isSoftwareGl;
      controls.minDistance = prevMinDist;
      controls.maxDistance = prevMaxDist;
      controls.enabled = !stateRef.current.lockCameraOrbit;
      controls.update();
      controls.addEventListener('start', cancelCamGoal);

      domEl.addEventListener('pointerdown', onPointerDown);
      domEl.addEventListener('pointermove', onPointerMove);
      domEl.addEventListener('pointerup', onPointerUp);
      domEl.addEventListener('pointercancel', onPointerCancel);

      refs.transformControls = transformControls;
      refs.controls = controls;
    };

    const unbindDomControls = () => {
      const domEl = refs.renderer.domElement;
      domEl.removeEventListener('pointerdown', onPointerDown);
      domEl.removeEventListener('pointermove', onPointerMove);
      domEl.removeEventListener('pointerup', onPointerUp);
      domEl.removeEventListener('pointercancel', onPointerCancel);
      if (refs.transformControls) {
        refs.transformControls.removeEventListener('dragging-changed', onGizmoDraggingChanged);
        refs.transformControls.removeEventListener('objectChange', onGizmoObjectChange);
        applyAxisFilterToGizmo(refs.transformControls, 'all', detachedGizmoHandles);
        scene.remove(refs.transformControls.getHelper());
        refs.transformControls.detach();
        refs.transformControls.dispose();
      }
      if (refs.controls) {
        refs.controls.removeEventListener('start', cancelCamGoal);
        refs.controls.dispose();
      }
    };

    bindDomControls(renderer.domElement);
    stageRef.current = refs;

    const resizeObserver = new ResizeObserver(() => {
      if (!active) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w <= 0 || h <= 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      refs.renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    let active = true;
    let loopRunning = false;
    let frameId = 0;
    let lastDriverText = '';
    let lastTestText: string | null = null;
    let lastPlayheadEmit = 0;
    const timer = new THREE.Timer();

    function afterDraw(cb: () => void) {
      const activeRenderer = refs.renderer;
      const gl =
        typeof activeRenderer.getContext === 'function'
          ? (activeRenderer.getContext() as Partial<WebGL2RenderingContext> | null)
          : null;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE ?? 0x9117, 0);
      gl.flush?.();
      const poll = () => {
        if (!active) {
          if (sync) gl.deleteSync?.(sync);
          return;
        }
        const status = sync && gl.getSyncParameter?.(sync, gl.SYNC_STATUS ?? 0x9114);
        if (status === (gl.UNSIGNALED ?? 0x9118)) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync?.(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (!active) {
        loopRunning = false;
        return;
      }
      loopRunning = true;
      timer.update();
      const dt = Math.min(0.08, timer.getDelta());
      const cur = stateRef.current;
      const inst = refs.instance;

      try {
        if (inst) {
          if (!cur.paused) {
            inst.update(dt, 1);
          } else if (
            cur.testOverride?.kind === 'manualBone' ||
            cur.testOverride?.kind === 'poseSnapshot' ||
            cur.testOverride?.kind === 'presetPreview'
          ) {
            inst.update(0, 1);
          }

          if (cur.motionPlaying && inst.proceduralRig) {
            const now = performance.now();
            if (now - lastPlayheadEmit > 34) {
              lastPlayheadEmit = now;
              cur.onPlayheadTick(inst.proceduralRig.getPreviewTimeNorm());
            }
          }

          const driverLabel =
            inst.activeDriver === 'custom'
              ? 'Custom Preset'
              : inst.activeDriver === 'clip'
              ? 'Embedded Clip'
              : inst.activeDriver === 'procedural'
              ? 'Procedural Rig'
              : 'Static Pose';
          if (driverLabel !== lastDriverText) {
            lastDriverText = driverLabel;
            cur.onDriverChange?.(driverLabel);
          }

          const testLabel = inst.proceduralRig?.getTestLabel() ?? null;
          if (testLabel !== lastTestText) {
            lastTestText = testLabel;
            cur.onTestStatusChange?.(testLabel);
          }

          const showHandles = cur.poseMode && !cur.motionPlaying && cur.showJointDots;
          refs.jointHandlesGroup.visible = showHandles;
          if (showHandles && inst.proceduralRig) {
            refs.jointHandleMeshes.forEach((mesh, bName) => {
              const node = inst.proceduralRig!.getBoneNode(bName);
              const hitMesh = refs.jointHitMeshes.get(bName);
              if (!node) {
                mesh.visible = false;
                if (hitMesh) hitMesh.visible = false;
                return;
              }
              mesh.visible = true;
              getBoneWorldPosition(node, _markerPos);
              mesh.position.copy(_markerPos);
              if (hitMesh) {
                hitMesh.position.copy(_markerPos);
                hitMesh.visible = true;
              }
              const isSelected = cur.highlightBoneName === bName;
              const isHovered = hoveredBone === bName;
              const hasEdit = Boolean(cur.workingBones[bName]);
              const mat = mesh.material as THREE.MeshBasicMaterial;
              if (isSelected) {
                mat.color.set('#F59E0B');
                mat.opacity = 0.98;
                mesh.scale.setScalar(1.38);
              } else if (isHovered) {
                mat.color.set('#FDE047');
                mat.opacity = 0.95;
                mesh.scale.setScalar(1.25);
              } else if (hasEdit) {
                mat.color.set('#A78BFA');
                mat.opacity = 0.9;
                mesh.scale.setScalar(1.08);
              } else {
                mat.color.set('#22D3EE');
                mat.opacity = 0.7;
                mesh.scale.setScalar(0.92);
              }
            });
          }

          const targetNode = cur.highlightBoneName
            ? inst.proceduralRig?.getBoneNode(cur.highlightBoneName)
            : null;
          if (targetNode) {
            getBoneWorldPosition(targetNode, _markerPos);
            refs.jointMarker.position.copy(_markerPos);
            refs.jointMarker.scale.setScalar(refs.jointHandleScale);
            refs.jointMarker.visible = !showHandles;
          } else {
            refs.jointMarker.visible = false;
          }

          const enableGizmo = Boolean(
            cur.poseMode &&
              !cur.motionPlaying &&
              cur.showGizmo &&
              cur.highlightBoneName &&
              inst.proceduralRig
          );
          if (enableGizmo && cur.highlightBoneName && inst.proceduralRig) {
            if (refs.transformControls.object !== gizmoTarget) {
              refs.transformControls.attach(gizmoTarget);
            }
            if (!refs.gizmoDragging) {
              const angles = cur.workingBones[cur.highlightBoneName] ?? [0, 0, 0];
              inst.proceduralRig.getBoneGizmoWorldTransform(
                cur.highlightBoneName,
                angles,
                _gizmoPos,
                _gizmoQuat
              );
              gizmoTarget.position.copy(_gizmoPos);
              gizmoTarget.quaternion.copy(_gizmoQuat);
            }
          } else if (refs.transformControls.object) {
            refs.transformControls.detach();
          }
        }

        if (refs.camGoalPos && refs.camGoalTarget) {
          const lambda = 7.5;
          camera.position.x = THREE.MathUtils.damp(camera.position.x, refs.camGoalPos.x, lambda, dt);
          camera.position.y = THREE.MathUtils.damp(camera.position.y, refs.camGoalPos.y, lambda, dt);
          camera.position.z = THREE.MathUtils.damp(camera.position.z, refs.camGoalPos.z, lambda, dt);
          refs.controls.target.x = THREE.MathUtils.damp(
            refs.controls.target.x,
            refs.camGoalTarget.x,
            lambda,
            dt
          );
          refs.controls.target.y = THREE.MathUtils.damp(
            refs.controls.target.y,
            refs.camGoalTarget.y,
            lambda,
            dt
          );
          refs.controls.target.z = THREE.MathUtils.damp(
            refs.controls.target.z,
            refs.camGoalTarget.z,
            lambda,
            dt
          );
          if (
            camera.position.distanceTo(refs.camGoalPos) < 0.02 &&
            refs.controls.target.distanceTo(refs.camGoalTarget) < 0.02
          ) {
            refs.camGoalPos = null;
            refs.camGoalTarget = null;
          }
        }

        refs.controls.update();
        refs.renderer.render(scene, camera);
      } catch {
        // Keep the loop alive across transient frame errors
      } finally {
        if (active) {
          if (isSoftwareGl) afterDraw(tick);
          else frameId = requestAnimationFrame(tick);
        } else {
          loopRunning = false;
        }
      }
    }

    const startLoop = () => {
      if (!active || loopRunning) return;
      tick();
    };

    const switchToWebGLFallback = async (): Promise<boolean> => {
      if (!active) return false;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      loopRunning = false;
      const prevTarget = refs.controls ? refs.controls.target.clone() : new THREE.Vector3(0, 0.95, 0);
      const prevMinDist = refs.controls ? refs.controls.minDistance : 0.85;
      const prevMaxDist = refs.controls ? refs.controls.maxDistance : 12;

      unbindDomControls();
      envTex?.dispose();
      envTex = null;
      scene.environment = null;
      refs.rendererInitialized = false;
      try {
        refs.renderer.dispose();
      } catch {
        // ignore dispose error on failed WebGPU adapter
      }

      renderer = createMakerRenderer(isSoftwareGl, true);
      renderer.setSize(container.clientWidth || 640, container.clientHeight || 360);
      container.innerHTML = '';
      container.appendChild(renderer.domElement);
      refs.renderer = renderer;
      bindDomControls(renderer.domElement, prevTarget, prevMinDist, prevMaxDist);

      try {
        await renderer.init();
        if (!active) return false;
        refs.rendererInitialized = true;
        try {
          envTex = setupSceneEnvironment(scene, renderer);
        } catch {
          // ignore PMREM failures on constrained contexts
        }
        return true;
      } catch {
        return false;
      }
    };

    void (async () => {
      let initOk = false;
      try {
        await renderer.init();
        if (!active) return;
        if (!isSoftwareGl && isWebGPUFallbackAdapter(renderer)) {
          initOk = await switchToWebGLFallback();
        } else {
          initOk = true;
        }
      } catch {
        initOk = await switchToWebGLFallback();
      }
      if (!active || !initOk) return;
      refs.rendererInitialized = true;
      const backend = refs.renderer.backend as {
        isWebGPUBackend?: boolean;
        device?: GPUDevice;
      } | undefined;
      if (backend?.isWebGPUBackend && backend.device?.lost) {
        void backend.device.lost.then((info) => {
          if (!active || info.reason === 'destroyed') return;
          void switchToWebGLFallback().then((ok) => {
            if (ok && active) startLoop();
          });
        });
      }
      if (!envTex) {
        try {
          envTex = setupSceneEnvironment(scene, refs.renderer);
        } catch {
          // ignore PMREM failures on constrained contexts
        }
      }
      startLoop();
    })();

    return () => {
      active = false;
      loopRunning = false;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      unbindDomControls();
      timer.dispose();
      // Remove onion skin ghost groups before disposeObject3D so shared cached geometries aren't disposed twice
      refs.onionContainer.clear();
      refs.prevGhostMat?.dispose();
      refs.nextGhostMat?.dispose();
      refs.prevGhostMat = null;
      refs.nextGhostMat = null;
      refs.prevGhostInstance = null;
      refs.nextGhostInstance = null;
      envTex?.dispose();
      disposeObject3D(scene);
      try {
        refs.renderer.dispose();
      } catch {
        // ignore dispose errors on failed renderer
      }
      stageRef.current = null;
    };
  }, []);

  // Helper to build a lightweight translucent ghost character silhouette for onion skinning
  const createGhostSilhouette = (
    targetAsset: CustomAssetMeta,
    rig: CustomRigSettings,
    colorHex: string,
    opacity: number
  ): { inst: CustomModelInstance; mat: THREE.MeshStandardMaterial } | null => {
    const inst = instantiateCustomModel(targetAsset.id, {
      ...targetAsset,
      rigSettings: rig,
    });
    if (!inst) return null;

    // Remove the contact shadow disc from ghost instances so there are no stacked floor shadows
    const extraChildren = inst.group.children.filter((c) => c !== inst.scaledRoot);
    for (const extra of extraChildren) {
      inst.group.remove(extra);
      const m = extra as THREE.Mesh;
      if (m.isMesh) {
        m.geometry?.dispose();
        if (Array.isArray(m.material)) m.material.forEach((mm) => mm.dispose());
        else m.material?.dispose();
      }
    }

    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(colorHex),
      emissive: new THREE.Color(colorHex),
      emissiveIntensity: 0.48,
      roughness: 0.55,
      metalness: 0.05,
      transparent: true,
      opacity,
      depthWrite: false,
      side: THREE.FrontSide,
    });

    inst.modelRoot.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      // Do NOT dispose original material (shared with cached.scene) — only swap to ghostMat
      mesh.material = mat;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.renderOrder = 6;
    });

    inst.group.visible = false;
    return { inst, mat };
  };

  // Sync previous & next keyframe ghostly silhouettes
  const syncOnionSkins = (
    refs: StageRefs,
    targetAsset: CustomAssetMeta,
    rig: CustomRigSettings,
    cfg: OnionSkinConfig | null | undefined,
    isPose: boolean,
    isPlayingNow: boolean
  ) => {
    const shouldShow = Boolean(cfg?.enabled && isPose && !isPlayingNow && refs.instance);
    if (!shouldShow) {
      if (refs.prevGhostInstance) refs.prevGhostInstance.group.visible = false;
      if (refs.nextGhostInstance) refs.nextGhostInstance.group.visible = false;
      return;
    }

    const opacity = Math.max(0.08, Math.min(0.75, cfg?.opacity ?? 0.32));
    const cached = getCachedAssetSync(targetAsset.id);

    const updateOne = (
      kind: 'prev' | 'next',
      pose: OnionSkinPose | null,
      colorHex: string
    ) => {
      let inst = kind === 'prev' ? refs.prevGhostInstance : refs.nextGhostInstance;
      let mat = kind === 'prev' ? refs.prevGhostMat : refs.nextGhostMat;

      if (!pose) {
        if (inst) inst.group.visible = false;
        return;
      }

      // Lazily instantiate ghost clone only when first needed
      if (!inst && cached) {
        const created = createGhostSilhouette(targetAsset, rig, colorHex, opacity);
        if (created) {
          inst = created.inst;
          mat = created.mat;
          refs.onionContainer.add(inst.group);
          if (kind === 'prev') {
            refs.prevGhostInstance = inst;
            refs.prevGhostMat = mat;
          } else {
            refs.nextGhostInstance = inst;
            refs.nextGhostMat = mat;
          }
        }
      }
      if (!inst || !mat) return;

      mat.opacity = opacity;
      if (cached) {
        const scale = targetAsset.defaultScale;
        const baseNormalizedY =
          (cached.baseGroundOffset / Math.max(0.0001, cached.baseScale)) * scale;
        const userGroundDelta = targetAsset.groundOffset - cached.baseGroundOffset;
        inst.scaledRoot.scale.setScalar(scale);
        inst.scaledRoot.position.y = baseNormalizedY + userGroundDelta;
      }
      inst.applyRigSettings(rig);
      inst.setTestOverride({
        kind: 'poseSnapshot',
        bones: pose.bones,
        hipsOffsetY: pose.hipsOffsetY,
      });
      inst.group.visible = true;
      inst.update(0, 1);
      inst.group.updateMatrixWorld(true);
    };

    updateOne('prev', cfg?.prevPose ?? null, '#FB7185');
    updateOne('next', cfg?.nextPose ?? null, '#34D399');
  };

  // Update gizmo size, axis filter, and camera orbit lock dynamically
  useEffect(() => {
    const refs = stageRef.current;
    if (refs) {
      refs.transformControls.setSize(gizmoSize);
    }
  }, [gizmoSize]);

  useEffect(() => {
    const refs = stageRef.current;
    if (refs) {
      applyAxisFilterToGizmo(refs.transformControls, gizmoAxisFilter, refs.detachedGizmoHandles);
    }
  }, [gizmoAxisFilter]);

  useEffect(() => {
    const refs = stageRef.current;
    if (refs) {
      refs.controls.enabled = !lockCameraOrbit && !refs.gizmoDragging;
    }
  }, [lockCameraOrbit]);

  // 2. Load / swap the model instance when asset OR universal actorTarget changes
  const clipMapSignature = useMemo(() => JSON.stringify(asset?.clipMap ?? {}), [asset?.clipMap]);
  const actorTargetKey = useMemo(
    () => (actorTarget ? describeTargetKey(actorTarget) : `legacy:${asset?.id ?? 'none'}`),
    [actorTarget, asset?.id]
  );

  const computeCameraVectorsForBounds = (
    center: THREE.Vector3,
    radius: number,
    preset: StageCameraPreset
  ): { pos: THREE.Vector3; target: THREE.Vector3 } => {
    const dist = Math.max(2.3, radius * 3.0);
    const target = center.clone();
    if (preset === 'front') {
      return { pos: new THREE.Vector3(center.x, center.y + radius * 0.35, center.z + dist), target };
    }
    if (preset === 'side') {
      return { pos: new THREE.Vector3(center.x + dist, center.y + radius * 0.35, center.z + 0.15), target };
    }
    if (preset === 'back') {
      return { pos: new THREE.Vector3(center.x, center.y + radius * 0.45, center.z - dist), target };
    }
    return {
      pos: new THREE.Vector3(center.x + dist * 0.68, center.y + radius * 0.72, center.z + dist * 0.88),
      target,
    };
  };

  useEffect(() => {
    const refs = stageRef.current;
    if (!refs) return;
    let cancelled = false;

    const clearCurrentModel = () => {
      if (refs.skeletonHelper) {
        refs.scene.remove(refs.skeletonHelper);
        refs.skeletonHelper.dispose();
        refs.skeletonHelper = null;
      }
      refs.transformControls.detach();
      // Clear onion skin ghosts safely without disposing shared cached geometries
      refs.onionContainer.clear();
      refs.prevGhostMat?.dispose();
      refs.nextGhostMat?.dispose();
      refs.prevGhostMat = null;
      refs.nextGhostMat = null;
      refs.prevGhostInstance = null;
      refs.nextGhostInstance = null;

      disposeObject3D(refs.modelContainer);
      refs.modelContainer.clear();
      refs.instance = null;
      refs.studioRuntime = null;
      refs.jointMarker.visible = false;
      refs.ghostLines.visible = false;
      refs.ghostPoints.visible = false;
    };

    clearCurrentModel();

    const mountLoadedInstance = (
      inst: CustomModelInstance,
      runtime: StudioActorRuntime | null,
      legacyAsset: CustomAssetMeta | null
    ) => {
      const cur = stateRef.current;
      refs.instance = inst;
      refs.studioRuntime = runtime;
      refs.modelContainer.add(inst.group);

      const loadedBones = inst.proceduralRig?.getAllBoneNames() ?? cur.boneNames;
      const initialRig =
        Object.keys(cur.rigSettings.boneMap).length > 0 ? cur.rigSettings : inst.rigSettings;
      rebuildJointHandles(refs, loadedBones, initialRig, runtime?.radius);

      const helper = new THREE.SkeletonHelper(inst.modelRoot);
      const helperMat = helper.material as THREE.LineBasicMaterial;
      helperMat.color.set('#22D3EE');
      helperMat.depthTest = false;
      helperMat.transparent = true;
      helperMat.opacity = 0.9;
      helper.renderOrder = 998;
      helper.visible = cur.showSkeleton;
      refs.skeletonHelper = helper;
      refs.scene.add(helper);

      // Scale turntable smoothly for large dragons vs compact critters
      const stageRadius = runtime ? Math.max(1.0, Math.min(4.8, runtime.radius)) : 1.0;
      const floorScale = stageRadius > 1.4 ? stageRadius / 1.45 : 1.0;
      refs.floorMesh.scale.set(floorScale, 1, floorScale);
      refs.groundRingMesh.scale.set(floorScale, floorScale, 1);
      refs.gridHelper.scale.set(floorScale, 1, floorScale);
      refs.arrowMesh.position.set(0, 0.012, 1.32 * floorScale);
      refs.controls.maxDistance = Math.max(12, stageRadius * 6);
      refs.controls.minDistance = Math.max(0.6, stageRadius * 0.45);

      if (runtime) {
        const framed = computeCameraVectorsForBounds(runtime.boundsCenter, runtime.radius, cameraPreset);
        refs.camGoalPos = framed.pos;
        refs.camGoalTarget = framed.target;
      }

      applyXrayToInstance(inst, cur.xrayMesh);
      inst.setAction(cur.previewSlot, 0.05);
      if (cur.testOverride) {
        inst.setTestOverride(cur.testOverride);
        if (cur.testOverride.kind === 'poseSnapshot' || cur.testOverride.kind === 'presetPreview') {
          inst.update(0, 1);
        }
      }
      if (cur.ghostStartPose && inst.proceduralRig) {
        const { linePositions, jointPositions } =
          inst.proceduralRig.computePoseSkeletonSegments(
            cur.ghostStartPose.bones,
            cur.ghostStartPose.hipsOffsetY
          );
        refs.ghostLines.geometry.setAttribute(
          'position',
          new THREE.Float32BufferAttribute(linePositions, 3)
        );
        refs.ghostLines.geometry.computeBoundingSphere();
        refs.ghostLines.visible = linePositions.length > 0;
        refs.ghostPoints.geometry.setAttribute(
          'position',
          new THREE.Float32BufferAttribute(jointPositions, 3)
        );
        refs.ghostPoints.geometry.computeBoundingSphere();
        refs.ghostPoints.visible = jointPositions.length > 0;
      }
      if (legacyAsset) {
        syncOnionSkins(refs, legacyAsset, cur.rigSettings, cur.onionSkin, cur.poseMode, cur.motionPlaying);
      }

      if (runtime) {
        const ctx = cur.contextProps;
        if (ctx && ctx.inventoryItemId !== undefined) {
          const item =
            ctx.inventoryItemId === null
              ? null
              : getProjectInventoryItems(project).find((i) => i.id === ctx.inventoryItemId) ?? null;
          const stageVisualStyle: VisualStyleId =
            currentLevel?.visualStyle ?? project?.levels?.[0]?.visualStyle ?? 'painterlyPBR';
          if (item?.customAssetId && !getCachedAssetSync(item.customAssetId)) {
            void loadCustomAssetToCache(item.customAssetId, 'prop').then(() => {
              if (cancelled || stageRef.current?.studioRuntime !== runtime) return;
              applyStudioInventoryAttachment({
                runtime,
                item,
                customAssets,
                visualStyle: stageVisualStyle,
              });
            });
          } else {
            applyStudioInventoryAttachment({
              runtime,
              item,
              customAssets,
              visualStyle: stageVisualStyle,
            });
          }
        }
        cur.onRuntimeReady?.({
          boneNames: loadedBones,
          rigSettings: {
            ...inst.rigSettings,
            boneMap: { ...inst.rigSettings.boneMap },
            slotTuning: inst.rigSettings.slotTuning
              ? { ...inst.rigSettings.slotTuning }
              : undefined,
          },
          archetype: runtime.archetype,
          hipsHeightRef: runtime.hipsHeightRef,
          hasTelegraph: Boolean(runtime.telegraphGroup),
          hasHeroProps: Boolean(
            runtime.heroRig ||
              runtime.instance?.proceduralRig ||
              runtime.baddieRig ||
              runtime.quadrupedRig
          ),
        });
      }
    };

    if (actorTarget) {
      const prepare = async () => {
        if (actorTarget.kind === 'customAsset') {
          const meta = customAssets.find((a) => a.id === actorTarget.assetId) ?? asset;
          await loadCustomAssetToCache(actorTarget.assetId, meta?.category ?? 'character');
        }
        if (cancelled || !stageRef.current) return;

        const actors = listStudioActors(project, currentLevel, customAssets);
        const key = describeTargetKey(actorTarget);
        const descriptor: StudioActorDescriptor =
          actors.find((d) => describeTargetKey(d.target) === key) ?? {
            id: key,
            label: actorTarget.label,
            subtitle: '',
            category: actorTarget.category,
            archetype:
              actorTarget.kind === 'monsterBlueprint'
                ? 'quadruped'
                : actorTarget.kind === 'buddyCritter'
                ? 'critter'
                : actorTarget.kind === 'proceduralBaddie'
                ? 'baddie'
                : 'humanoid',
            target: actorTarget,
            entityId: 'entityId' in actorTarget ? actorTarget.entityId : undefined,
          };

        const runtime = instantiateStudioActor(
          descriptor,
          project,
          currentLevel,
          customAssets,
          stateRef.current.contextProps
        );
        if (!runtime) return;
        mountLoadedInstance(runtime.instance, runtime, runtime.assetMeta ?? null);
      };
      void prepare();
    } else if (asset) {
      void loadCustomAssetToCache(asset.id, asset.category).then(() => {
        if (cancelled || !stageRef.current) return;
        const cur = stateRef.current;
        const inst = instantiateCustomModel(asset.id, {
          ...asset,
          rigSettings: cur.rigSettings,
        });
        if (!inst) return;
        mountLoadedInstance(inst, null, asset);
      });
    }

    return () => {
      cancelled = true;
    };
  }, [actorTargetKey, asset?.id, asset?.category, clipMapSignature]);

  // 3. Zero-flicker live updates
  useEffect(() => {
    const refs = stageRef.current;
    if (!refs?.instance) return;
    if (asset && (!actorTarget || actorTarget.kind === 'customAsset')) {
      const cached = getCachedAssetSync(asset.id);
      if (cached) {
        const scale = asset.defaultScale;
        const baseNormalizedY = (cached.baseGroundOffset / Math.max(0.0001, cached.baseScale)) * scale;
        const userGroundDelta = asset.groundOffset - cached.baseGroundOffset;
        refs.instance.scaledRoot.scale.setScalar(scale);
        refs.instance.scaledRoot.position.y = baseNormalizedY + userGroundDelta;
      }
      refs.instance.setAnimSpeed(asset.animSpeed);
      refs.instance.applyRigSettings(rigSettings);
      refs.instance.setCustomAnimations(asset.customAnimations, asset.defaultSlotPresets);
    } else {
      const hasIncomingMap = Object.keys(rigSettings.boneMap).length > 0;
      const alreadyMapped = Boolean(refs.instance.proceduralRig?.hasMappedBones());
      if (hasIncomingMap || !alreadyMapped) {
        refs.instance.applyRigSettings(rigSettings);
      }
    }
    if (refs.instance.proceduralRig) {
      const loadedBones = refs.instance.proceduralRig.getAllBoneNames();
      const handleRig =
        Object.keys(rigSettings.boneMap).length > 0 ? rigSettings : refs.instance.rigSettings;
      const radius = refs.studioRuntime?.radius;
      const handleScale =
        typeof radius === 'number' && Number.isFinite(radius)
          ? THREE.MathUtils.clamp(radius * 0.85, 1.0, 2.4)
          : 1.0;
      const sig = `${loadedBones.join(',')}|${JSON.stringify(handleRig.boneMap)}|${handleScale.toFixed(2)}`;
      if (sig !== refs.jointHandleSignature) {
        rebuildJointHandles(refs, loadedBones, handleRig, radius);
      }
    }
    if (stateRef.current.paused) {
      refs.instance.update(0, 1);
    }
  }, [
    actorTargetKey,
    asset?.id,
    asset?.defaultScale,
    asset?.groundOffset,
    asset?.animSpeed,
    asset?.customAnimations,
    asset?.defaultSlotPresets,
    rigSettings,
  ]);

  // Live toggle context props (Inventory Objects attached to body parts + Enemy Telegraph ring)
  useEffect(() => {
    const rt = stageRef.current?.studioRuntime;
    if (!rt) return;
    let cancelled = false;

    if (contextProps?.inventoryItemId !== undefined) {
      const item =
        contextProps.inventoryItemId === null
          ? null
          : getProjectInventoryItems(project).find((i) => i.id === contextProps.inventoryItemId) ??
            null;
      const stageVisualStyle: VisualStyleId =
        currentLevel?.visualStyle ?? project?.levels?.[0]?.visualStyle ?? 'painterlyPBR';
      if (item?.customAssetId && !getCachedAssetSync(item.customAssetId)) {
        void loadCustomAssetToCache(item.customAssetId, 'prop').then(() => {
          if (cancelled || stageRef.current?.studioRuntime !== rt) return;
          applyStudioInventoryAttachment({
            runtime: rt,
            item,
            customAssets,
            visualStyle: stageVisualStyle,
          });
        });
      } else {
        applyStudioInventoryAttachment({
          runtime: rt,
          item,
          customAssets,
          visualStyle: stageVisualStyle,
        });
      }
    } else {
      applyContextPropsToHeroRig(rt.heroRig, contextProps);
    }

    if (rt.telegraphGroup) {
      rt.telegraphGroup.visible = Boolean(contextProps?.showTelegraph);
    }
    return () => {
      cancelled = true;
    };
  }, [
    actorTargetKey,
    contextProps?.inventoryItemId,
    contextProps?.weapon,
    contextProps?.shield,
    contextProps?.showTelegraph,
    project?.inventoryItems,
    currentLevel?.visualStyle,
    customAssets,
  ]);

  useEffect(() => {
    const refs = stageRef.current;
    if (!refs?.instance) return;
    refs.instance.setAction(previewSlot, 0.14);
  }, [previewSlot]);

  useEffect(() => {
    const refs = stageRef.current;
    if (!refs?.instance) return;
    refs.instance.setTestOverride(testOverride);
    if (testOverride?.kind === 'poseSnapshot' || testOverride?.kind === 'presetPreview') {
      refs.instance.update(0, 1);
    }
  }, [testOverride]);

  useEffect(() => {
    const refs = stageRef.current;
    if (!refs) return;
    if (!ghostStartPose || !refs.instance?.proceduralRig) {
      refs.ghostLines.visible = false;
      refs.ghostPoints.visible = false;
      return;
    }
    const { linePositions, jointPositions } =
      refs.instance.proceduralRig.computePoseSkeletonSegments(
        ghostStartPose.bones,
        ghostStartPose.hipsOffsetY
      );
    refs.ghostLines.geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(linePositions, 3)
    );
    refs.ghostLines.geometry.computeBoundingSphere();
    refs.ghostLines.visible = linePositions.length > 0;

    refs.ghostPoints.geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(jointPositions, 3)
    );
    refs.ghostPoints.geometry.computeBoundingSphere();
    refs.ghostPoints.visible = jointPositions.length > 0;
  }, [ghostStartPose, asset?.defaultScale, asset?.groundOffset, rigSettings.facingOffsetDeg]);

  useEffect(() => {
    const refs = stageRef.current;
    if (!refs || !asset || (actorTarget && actorTarget.kind !== 'customAsset')) return;
    syncOnionSkins(refs, asset, rigSettings, onionSkin, poseMode, motionPlaying);
  }, [
    actorTargetKey,
    onionSkin,
    poseMode,
    motionPlaying,
    asset?.id,
    asset?.defaultScale,
    asset?.groundOffset,
    rigSettings,
  ]);

  useEffect(() => {
    const refs = stageRef.current;
    if (!refs) return;
    if (refs.skeletonHelper) {
      refs.skeletonHelper.visible = showSkeleton;
    }
  }, [showSkeleton]);

  useEffect(() => {
    const refs = stageRef.current;
    if (!refs?.instance) return;
    applyXrayToInstance(refs.instance, xrayMesh);
  }, [xrayMesh]);

  // 4. Camera angle presets (proportional to loaded actor size)
  useEffect(() => {
    const refs = stageRef.current;
    if (!refs || cameraResetNonce === 0) return;
    const rt = refs.studioRuntime;
    if (rt) {
      const framed = computeCameraVectorsForBounds(rt.boundsCenter, rt.radius, cameraPreset);
      refs.camGoalPos = framed.pos;
      refs.camGoalTarget = framed.target;
      return;
    }
    refs.camGoalTarget = new THREE.Vector3(0, 0.95, 0);
    if (cameraPreset === 'front') {
      refs.camGoalPos = new THREE.Vector3(0, 1.35, 3.5);
    } else if (cameraPreset === 'side') {
      refs.camGoalPos = new THREE.Vector3(3.5, 1.35, 0.15);
    } else if (cameraPreset === 'back') {
      refs.camGoalPos = new THREE.Vector3(0, 1.45, -3.5);
    } else {
      refs.camGoalPos = new THREE.Vector3(2.35, 1.8, 3.1);
    }
  }, [cameraPreset, cameraResetNonce]);

  return (
    <div className={`overflow-hidden bg-[#111521] relative ${containerClassName}`}>
      <div ref={mountRef} className="w-full h-full touch-none" />
      <div className="pointer-events-none absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[11px] font-medium text-white/75">
        <span>
          {poseMode
            ? 'Tap any body part or joint · Drag large rings to rotate'
            : 'Drag to orbit · Pinch or scroll to zoom'}
        </span>
        <span className="hidden sm:inline">
          {poseMode && onionSkin?.enabled && !motionPlaying
            ? 'Rose = Prev Key · Green = Next Key'
            : poseMode && ghostStartPose
            ? 'Cyan skeleton = 0% Start Pose'
            : 'Purple arrow = Forward (+Z)'}
        </span>
      </div>
    </div>
  );
};
