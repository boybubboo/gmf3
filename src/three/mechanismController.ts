import * as THREE from 'three';
import type {
  BuiltinMechanismTemplate,
  MechanismActionMode,
  MechanismAxis,
  ObjectMechanism,
} from '../types/maker';
import { evaluateMotionEasing } from './proceduralRigAnimator';

export interface TreasureChestAnimRig {
  lidPivot: THREE.Object3D | null;
  innerGlowMesh: THREE.Mesh;
  innerGlowMat: THREE.MeshBasicMaterial;
  auraGroup: THREE.Group;
  auraMats: THREE.MeshBasicMaterial[];
  glowLight: THREE.PointLight;
  openProgress: number;
  opening: boolean;
  openDuration: number;
  openElapsed: number;
  useMechController?: boolean;
}

/**
 * Attaches an emissive golden interior glow plane, rising additive gold light beams,
 * and a dynamic PointLight inside any treasure chest mouth (no fixed coin/item meshes).
 */
export function attachChestGoldenGlow(
  parentGroup: THREE.Group,
  innerW: number,
  innerD: number,
  mouthY: number,
  lidPivot: THREE.Object3D | null,
  useMechController = false
): TreasureChestAnimRig {
  const innerGlowMat = new THREE.MeshBasicMaterial({
    color: '#FFE97D',
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  innerGlowMat.userData = { preserveGlowMat: true };
  const innerGlowMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(innerW * 1.04, innerD * 1.04),
    innerGlowMat
  );
  innerGlowMesh.name = 'Chest_Gold_Glow_Core';
  innerGlowMesh.rotation.x = -Math.PI / 2;
  innerGlowMesh.position.set(0, mouthY, 0);
  innerGlowMesh.visible = false;
  innerGlowMesh.userData.ignoreInHierarchy = true;
  parentGroup.add(innerGlowMesh);

  const auraGroup = new THREE.Group();
  auraGroup.name = 'Chest_Gold_Aura';
  auraGroup.position.set(0, mouthY, 0);
  auraGroup.visible = false;
  auraGroup.userData.ignoreInHierarchy = true;

  const auraMats: THREE.MeshBasicMaterial[] = [];

  // Expanding golden volumetric cone fanning upward from chest interior
  const beamConeMat = new THREE.MeshBasicMaterial({
    color: '#FFD24C',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  beamConeMat.userData = { preserveGlowMat: true };
  auraMats.push(beamConeMat);
  const beamCone = new THREE.Mesh(
    new THREE.CylinderGeometry(innerW * 0.78, innerW * 0.44, 1.05, 16, 1, true),
    beamConeMat
  );
  beamCone.position.set(0, 0.52, 0);
  beamCone.scale.set(1, 1, Math.max(0.68, innerD / Math.max(0.1, innerW)));
  auraGroup.add(beamCone);

  // Soft crossed rising gold rays
  for (const ry of [0, Math.PI / 3, -Math.PI / 3]) {
    const rayMat = new THREE.MeshBasicMaterial({
      color: '#FFF2A6',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    rayMat.userData = { preserveGlowMat: true };
    auraMats.push(rayMat);
    const ray = new THREE.Mesh(
      new THREE.PlaneGeometry(innerW * 1.18, 1.15),
      rayMat
    );
    ray.position.set(0, 0.56, 0);
    ray.rotation.y = ry;
    auraGroup.add(ray);
  }

  // Radiant golden halo pool just above mouth
  const haloMat = new THREE.MeshBasicMaterial({
    color: '#FFBF2E',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  haloMat.userData = { preserveGlowMat: true };
  auraMats.push(haloMat);
  const halo = new THREE.Mesh(new THREE.CircleGeometry(innerW * 0.72, 20), haloMat);
  halo.rotation.x = -Math.PI / 2;
  halo.position.set(0, 0.06, 0);
  auraGroup.add(halo);

  parentGroup.add(auraGroup);

  const glowLight = new THREE.PointLight('#FFD24C', 0, 7.2, 1.45);
  glowLight.position.set(0, mouthY + 0.4, 0.06);
  glowLight.userData.ignoreInHierarchy = true;
  parentGroup.add(glowLight);

  const rig: TreasureChestAnimRig = {
    lidPivot,
    innerGlowMesh,
    innerGlowMat,
    auraGroup,
    auraMats,
    glowLight,
    openProgress: 0,
    opening: false,
    openDuration: 1.05,
    openElapsed: 0,
    useMechController,
  };
  parentGroup.userData.chestAnim = rig;
  return rig;
}

const _chestPivotOffset = new THREE.Vector3();
const _chestPivotOrigin = new THREE.Vector3(0, 0.56, -0.38);

/**
 * Advances a treasure chest's spring-open lid animation and radiant interior gold glow.
 * Returns true on the exact frame the opening animation finishes.
 */
export function updateTreasureChestRig(
  rig: TreasureChestAnimRig,
  dt: number,
  elapsedSec: number,
  hasRemainingLoot: boolean,
  externalProgress?: number
): boolean {
  let justFinished = false;
  const clampedDt = Math.min(0.08, Math.max(0, dt));

  if (rig.opening) {
    rig.openElapsed += clampedDt;
    const rawT = Math.min(1, rig.openElapsed / Math.max(0.2, rig.openDuration));
    rig.openProgress = rawT;
    if (rawT >= 1) {
      rig.opening = false;
      rig.openProgress = 1;
      justFinished = true;
    }
  } else if (typeof externalProgress === 'number') {
    rig.openProgress = THREE.MathUtils.clamp(externalProgress, 0, 1);
  }

  const p = rig.openProgress;

  // Drive lid hinge if not already driven by MechanismRuntimeController
  if (typeof externalProgress !== 'number' && rig.lidPivot) {
    const lidT = THREE.MathUtils.clamp(p / 0.84, 0, 1);
    const easedLid = evaluateMotionEasing('elastic', lidT);
    const angleRad = THREE.MathUtils.degToRad(-108 * easedLid);
    if (!rig.useMechController) {
      rig.lidPivot.rotation.x = angleRad;
    } else {
      _chestPivotOffset.set(0, 0, 0).sub(_chestPivotOrigin);
      _chestPivotOffset.applyAxisAngle(new THREE.Vector3(1, 0, 0), angleRad);
      rig.lidPivot.position.copy(_chestPivotOrigin).add(_chestPivotOffset);
      rig.lidPivot.rotation.set(angleRad, 0, 0);
    }
  }

  // Interior pure bright gold glow (hides interior so no fixed contents are visible)
  const coreVisible = p > 0.04;
  rig.innerGlowMesh.visible = coreVisible;
  if (coreVisible) {
    const coreRamp = THREE.MathUtils.clamp((p - 0.04) / 0.24, 0, 1);
    const shimmer = 0.94 + 0.06 * Math.sin(elapsedSec * 5.2);
    rig.innerGlowMat.opacity = coreRamp * (hasRemainingLoot ? 1.0 : 0.72) * shimmer;
  } else {
    rig.innerGlowMat.opacity = 0;
  }

  // Rising golden aura beams & halo
  const auraVisible = p > 0.08;
  rig.auraGroup.visible = auraVisible;
  if (auraVisible) {
    const auraRamp = THREE.MathUtils.clamp((p - 0.08) / 0.32, 0, 1);
    const burstBoost = rig.opening ? 1 + 0.45 * Math.sin(Math.min(1, p) * Math.PI) : 1;
    const targetScaleY = auraRamp * (hasRemainingLoot ? 1.0 : 0.55) * burstBoost;
    const pulse = 1 + 0.05 * Math.sin(elapsedSec * 4.4);
    rig.auraGroup.scale.set(
      (0.5 + 0.5 * auraRamp) * pulse,
      Math.max(0.05, targetScaleY),
      (0.5 + 0.5 * auraRamp) * pulse
    );
    rig.auraGroup.rotation.y += clampedDt * 0.55;

    const lootMult = hasRemainingLoot ? 1.0 : 0.34;
    const baseAlpha = auraRamp * lootMult * burstBoost;
    const shimmer = 0.9 + 0.1 * Math.sin(elapsedSec * 6.1);
    if (rig.auraMats[0]) rig.auraMats[0].opacity = Math.min(0.75, 0.42 * baseAlpha * shimmer);
    for (let i = 1; i <= 3; i++) {
      if (rig.auraMats[i]) rig.auraMats[i].opacity = Math.min(0.75, 0.38 * baseAlpha * shimmer);
    }
    if (rig.auraMats[4]) rig.auraMats[4].opacity = Math.min(0.85, 0.62 * baseAlpha * shimmer);
  } else {
    for (const m of rig.auraMats) m.opacity = 0;
  }

  // Dynamic golden PointLight illuminating chest & hero
  if (p > 0.04) {
    const lightPulse = 0.92 + 0.08 * Math.sin(elapsedSec * 5.0);
    const peakBurst = rig.opening ? 3.8 * Math.sin(Math.min(1, p) * Math.PI) : 0;
    const steadyGlow = hasRemainingLoot ? 3.4 : 0.95;
    rig.glowLight.intensity = (steadyGlow * THREE.MathUtils.clamp(p * 1.4, 0, 1) + peakBurst) * lightPulse;
  } else {
    rig.glowLight.intensity = 0;
  }

  return justFinished;
}

export interface ObjectPartNode {
  /** Stable hierarchical path relative to modelRoot, e.g. "0:Chest_Body" or "1:Chest_Lid/0:Lid_Dome" */
  path: string;
  name: string;
  label: string;
  depth: number;
  isMesh: boolean;
  meshCount: number;
  boundsMin: [number, number, number];
  boundsMax: [number, number, number];
  center: [number, number, number];
}

export type PivotSnapPreset =
  | 'backEdge'
  | 'frontEdge'
  | 'leftEdge'
  | 'rightEdge'
  | 'bottomCenter'
  | 'topCenter'
  | 'partCenter';

export interface BuiltinMechanismMeta {
  id: BuiltinMechanismTemplate;
  name: string;
  summary: string;
  entityKind: 'treasure' | 'door' | 'puzzle' | 'prop';
}

export const BUILTIN_MECHANISM_TEMPLATES: BuiltinMechanismMeta[] = [
  {
    id: 'treasureChest',
    name: 'Treasure Chest',
    summary: 'Hinged domed lid over timber chest with brass hasp & gold hoard',
    entityKind: 'treasure',
  },
  {
    id: 'slidingDoor',
    name: 'Sliding Temple Door',
    summary: 'Carved stone slab sliding cleanly into a recessed lintel wall pocket',
    entityKind: 'door',
  },
  {
    id: 'leverSwitch',
    name: 'Floor Lever Switch',
    summary: 'Bolted iron housing with a pivoting lever arm that sets game flags',
    entityKind: 'puzzle',
  },
  {
    id: 'drawbridge',
    name: 'Castle Drawbridge',
    summary: 'Twin stone gate pillars with a heavy hinged timber drawbridge deck',
    entityKind: 'prop',
  },
];

// Reusable math temporaries — zero allocations inside per-frame update
const _invRootMat = new THREE.Matrix4();
const _invParentMat = new THREE.Matrix4();
const _rootToParent = new THREE.Matrix4();
const _pivotLocal = new THREE.Vector3();
const _axisLocal = new THREE.Vector3();
const _offsetVec = new THREE.Vector3();
const _rotQuat = new THREE.Quaternion();
const _dispOrigin = new THREE.Vector3();
const _dispEnd = new THREE.Vector3();
const _box = new THREE.Box3();
const _childBox = new THREE.Box3();
const _corner = new THREE.Vector3();

function getAxisVector(axis: MechanismAxis, out: THREE.Vector3): THREE.Vector3 {
  if (axis === 'x') return out.set(1, 0, 0);
  if (axis === 'y') return out.set(0, 1, 0);
  return out.set(0, 0, 1);
}

function cleanPartLabel(rawName: string, index: number, isMesh: boolean): string {
  const cleaned = rawName
    .replace(/^node_/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned) return cleaned;
  return isMesh ? `Mesh ${index + 1}` : `Part Group ${index + 1}`;
}

function buildChildSegment(child: THREE.Object3D, siblingIndex: number): string {
  const safeName = (child.name || '').replace(/\//g, '_').trim();
  return safeName ? `${siblingIndex}:${safeName}` : `${siblingIndex}`;
}

/**
 * Computes the bounding box of `node` in `modelRoot`'s local coordinate space.
 */
export function computeNodeBoundsInRoot(
  modelRoot: THREE.Object3D,
  node: THREE.Object3D
): THREE.Box3 {
  modelRoot.updateMatrixWorld(true);
  _invRootMat.copy(modelRoot.matrixWorld).invert();
  const result = new THREE.Box3();
  result.makeEmpty();

  node.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const gb = mesh.geometry.boundingBox;
    if (!gb) return;
    _childBox.copy(gb);
    // Transform all 8 corners from mesh local -> world -> modelRoot local
    const min = _childBox.min;
    const max = _childBox.max;
    for (let ix = 0; ix < 2; ix++) {
      for (let iy = 0; iy < 2; iy++) {
        for (let iz = 0; iz < 2; iz++) {
          _corner
            .set(ix ? max.x : min.x, iy ? max.y : min.y, iz ? max.z : min.z)
            .applyMatrix4(mesh.matrixWorld)
            .applyMatrix4(_invRootMat);
          result.expandByPoint(_corner);
        }
      }
    }
  });

  return result;
}

/**
 * Inspects a model's child hierarchy and returns selectable nested groups and meshes
 * with stable paths and model-root-space bounds.
 */
export function inspectObjectHierarchy(modelRoot: THREE.Object3D): ObjectPartNode[] {
  modelRoot.updateMatrixWorld(true);
  const nodes: ObjectPartNode[] = [];

  const countMeshes = (obj: THREE.Object3D): number => {
    let count = 0;
    obj.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) count++;
    });
    return count;
  };

  const walk = (parent: THREE.Object3D, prefix: string, depth: number) => {
    parent.children.forEach((child, idx) => {
      if (child.userData?.ignoreInHierarchy) return;
      const isBone = (child as THREE.Bone).isBone;
      if (isBone) return;
      const meshCount = countMeshes(child);
      if (meshCount === 0) return;

      const segment = buildChildSegment(child, idx);
      const path = prefix ? `${prefix}/${segment}` : segment;
      const isMesh = Boolean((child as THREE.Mesh).isMesh);
      const bounds = computeNodeBoundsInRoot(modelRoot, child);
      const min: [number, number, number] = bounds.isEmpty()
        ? [0, 0, 0]
        : [
            Math.round(bounds.min.x * 1000) / 1000,
            Math.round(bounds.min.y * 1000) / 1000,
            Math.round(bounds.min.z * 1000) / 1000,
          ];
      const max: [number, number, number] = bounds.isEmpty()
        ? [0, 0, 0]
        : [
            Math.round(bounds.max.x * 1000) / 1000,
            Math.round(bounds.max.y * 1000) / 1000,
            Math.round(bounds.max.z * 1000) / 1000,
          ];
      const center: [number, number, number] = [
        Math.round(((min[0] + max[0]) / 2) * 1000) / 1000,
        Math.round(((min[1] + max[1]) / 2) * 1000) / 1000,
        Math.round(((min[2] + max[2]) / 2) * 1000) / 1000,
      ];

      nodes.push({
        path,
        name: child.name || segment,
        label: cleanPartLabel(child.name || '', idx, isMesh),
        depth,
        isMesh,
        meshCount,
        boundsMin: min,
        boundsMax: max,
        center,
      });

      if (child.children.length > 0 && depth < 5) {
        walk(child, path, depth + 1);
      }
    });
  };

  walk(modelRoot, '', 0);
  return nodes;
}

/**
 * Resolves a stored targetNodePath (or fallback node name) back to its live Object3D inside modelRoot.
 */
export function resolveTargetNode(
  modelRoot: THREE.Object3D,
  targetNodePath: string
): THREE.Object3D | null {
  if (!targetNodePath) return null;

  // 1. Exact hierarchical path walk
  const segments = targetNodePath.split('/');
  let cur: THREE.Object3D | null = modelRoot;
  let matchedExact = true;

  for (const seg of segments) {
    if (!cur) {
      matchedExact = false;
      break;
    }
    const colonIdx = seg.indexOf(':');
    const idxStr = colonIdx >= 0 ? seg.slice(0, colonIdx) : seg;
    const expectedName = colonIdx >= 0 ? seg.slice(colonIdx + 1) : '';
    const siblingIdx = Number.parseInt(idxStr, 10);

    let found: THREE.Object3D | null = null;
    if (
      Number.isFinite(siblingIdx) &&
      siblingIdx >= 0 &&
      siblingIdx < cur.children.length
    ) {
      const candidate: THREE.Object3D = cur.children[siblingIdx];
      if (!expectedName || candidate.name.replace(/\//g, '_').trim() === expectedName) {
        found = candidate;
      }
    }
    if (!found && expectedName) {
      found =
        cur.children.find((c) => c.name.replace(/\//g, '_').trim() === expectedName) ?? null;
    }
    if (!found) {
      matchedExact = false;
      break;
    }
    cur = found;
  }

  if (matchedExact && cur && cur !== modelRoot) {
    return cur;
  }

  // 2. Fallback: match by raw Object3D name anywhere in subtree
  const lastSeg = segments[segments.length - 1] ?? targetNodePath;
  const fallbackName = lastSeg.includes(':') ? lastSeg.slice(lastSeg.indexOf(':') + 1) : lastSeg;
  if (!fallbackName) return null;

  let byName: THREE.Object3D | null = null;
  modelRoot.traverse((obj) => {
    if (byName || obj === modelRoot) return;
    if (obj.name.replace(/\//g, '_').trim() === fallbackName) {
      byName = obj;
    }
  });
  return byName;
}

/**
 * Finds the stable hierarchy path for an Object3D clicked via raycasting.
 * Prefers a named direct mechanism group if the clicked mesh sits inside a named group
 * whose parent is modelRoot (e.g., clicking a strap on "Chest_Lid" selects "Chest_Lid").
 */
export function findBestPartPathForObject(
  modelRoot: THREE.Object3D,
  clickedObj: THREE.Object3D
): string | null {
  const chain: THREE.Object3D[] = [];
  let cur: THREE.Object3D | null = clickedObj;
  while (cur && cur !== modelRoot) {
    chain.unshift(cur);
    cur = cur.parent;
  }
  if (chain.length === 0) return null;

  // Build path up to clicked object, but if top-level child is a meaningful multi-mesh group
  // (like Chest_Lid, Door_Panel, Lever_Arm), select that group unless the user explicitly picks
  // deeper sub-meshes in the tree.
  let targetDepth = chain.length - 1;
  if (chain.length >= 2) {
    const topChild = chain[0];
    if (topChild.name && !(topChild as THREE.Mesh).isMesh && topChild.children.length > 0) {
      targetDepth = 0;
    }
  }

  const segments: string[] = [];
  let parent: THREE.Object3D = modelRoot;
  for (let i = 0; i <= targetDepth; i++) {
    const node = chain[i];
    const idx = parent.children.indexOf(node);
    if (idx < 0) return null;
    segments.push(buildChildSegment(node, idx));
    parent = node;
  }
  return segments.join('/');
}

/**
 * Snaps a hinge pivot point cleanly onto a seam edge of the target child element.
 */
export function computePivotPresetForPart(
  part: ObjectPartNode,
  preset: PivotSnapPreset
): [number, number, number] {
  const [minX, minY, minZ] = part.boundsMin;
  const [maxX, maxY, maxZ] = part.boundsMax;
  const [cx, cy, cz] = part.center;
  const r = (n: number) => Math.round(n * 1000) / 1000;

  switch (preset) {
    case 'backEdge':
      return [r(cx), r(minY), r(minZ)];
    case 'frontEdge':
      return [r(cx), r(minY), r(maxZ)];
    case 'leftEdge':
      return [r(minX), r(cy), r(cz)];
    case 'rightEdge':
      return [r(maxX), r(cy), r(cz)];
    case 'bottomCenter':
      return [r(cx), r(minY), r(cz)];
    case 'topCenter':
      return [r(cx), r(maxY), r(cz)];
    case 'partCenter':
    default:
      return [r(cx), r(cy), r(cz)];
  }
}

interface MechanismStateEntry {
  mechanism: ObjectMechanism;
  target: THREE.Object3D;
  depth: number;
  restPos: THREE.Vector3;
  restQuat: THREE.Quaternion;
  restScale: THREE.Vector3;
  progress: number;
  targetProgress: number;
  holdTimer: number;
  hasRewardedOnce: boolean;
}

/**
 * Runtime & studio kinematic driver for hinge and linear slider constraints
 * on nested child elements of any complex 3D object.
 */
export class MechanismRuntimeController {
  private modelRoot: THREE.Object3D;
  private entries: MechanismStateEntry[] = [];
  private entryById = new Map<string, MechanismStateEntry>();

  constructor(modelRoot: THREE.Object3D, mechanisms: ObjectMechanism[]) {
    this.modelRoot = modelRoot;
    this.setMechanisms(mechanisms);
  }

  public setMechanisms(mechanisms: ObjectMechanism[]) {
    // Restore previous rest transforms before re-binding so re-configuration never drifts
    this.restoreAllToRest();
    this.entries = [];
    this.entryById.clear();

    this.modelRoot.updateMatrixWorld(true);

    for (const mech of mechanisms) {
      const target = resolveTargetNode(this.modelRoot, mech.targetNodePath);
      if (!target) continue;

      let depth = 0;
      let p = target.parent;
      while (p && p !== this.modelRoot) {
        depth++;
        p = p.parent;
      }

      const entry: MechanismStateEntry = {
        mechanism: mech,
        target,
        depth,
        restPos: target.position.clone(),
        restQuat: target.quaternion.clone(),
        restScale: target.scale.clone(),
        progress: 0,
        targetProgress: 0,
        holdTimer: 0,
        hasRewardedOnce: false,
      };
      this.entries.push(entry);
      this.entryById.set(mech.id, entry);
    }

    // Apply shallower ancestors before deeper nested children
    this.entries.sort((a, b) => a.depth - b.depth);
    this.applyAll();
  }

  public restoreAllToRest() {
    for (const entry of this.entries) {
      entry.target.position.copy(entry.restPos);
      entry.target.quaternion.copy(entry.restQuat);
      entry.target.scale.copy(entry.restScale);
      entry.target.updateMatrix();
    }
    this.modelRoot.updateMatrixWorld(true);
  }

  public getProgress(mechId: string): number {
    return this.entryById.get(mechId)?.progress ?? 0;
  }

  public getTargetProgress(mechId: string): number {
    return this.entryById.get(mechId)?.targetProgress ?? 0;
  }

  public isOpen(mechId: string): boolean {
    const e = this.entryById.get(mechId);
    return e ? e.targetProgress >= 0.5 : false;
  }

  public markRewarded(mechId: string): boolean {
    const e = this.entryById.get(mechId);
    if (!e || e.hasRewardedOnce) return false;
    e.hasRewardedOnce = true;
    return true;
  }

  /** Direct scrub preview (0 = rest, 1 = activated/open) */
  public setProgressImmediate(mechId: string, progress01: number) {
    const entry = this.entryById.get(mechId);
    if (!entry) return;
    const clamped = Math.max(0, Math.min(1, progress01));
    entry.progress = clamped;
    entry.targetProgress = clamped;
    entry.holdTimer = 0;
    this.applyAll();
  }

  /** Triggers a mechanism open, close, or toggle according to its playback mode */
  public trigger(mechId: string, action: MechanismActionMode): boolean {
    const entry = this.entryById.get(mechId);
    if (!entry) return false;

    const mode = entry.mechanism.playbackMode;
    let nextTarget = entry.targetProgress;

    if (action === 'open') {
      nextTarget = 1;
    } else if (action === 'close') {
      nextTarget = mode === 'once' && entry.targetProgress >= 1 ? 1 : 0;
    } else {
      // toggle
      if (mode === 'once') {
        nextTarget = 1;
      } else {
        nextTarget = entry.targetProgress >= 0.5 ? 0 : 1;
      }
    }

    if (nextTarget === entry.targetProgress) {
      if (mode === 'autoReturn' && nextTarget >= 0.5) {
        entry.holdTimer = Math.max(0.25, entry.mechanism.autoReturnDelay ?? 2.2);
      }
      return false;
    }

    entry.targetProgress = nextTarget;
    if (mode === 'autoReturn' && nextTarget >= 0.5) {
      entry.holdTimer = Math.max(0.25, entry.mechanism.autoReturnDelay ?? 2.2);
    } else {
      entry.holdTimer = 0;
    }
    return true;
  }

  /** Frame-rate independent animation step; returns true if any mechanism moved */
  public update(dt: number): boolean {
    if (this.entries.length === 0) return false;
    const clampedDt = Math.min(0.1, Math.max(0, dt));
    let dirty = false;

    for (const entry of this.entries) {
      const duration = Math.max(0.08, entry.mechanism.duration || 0.75);

      if (
        entry.mechanism.playbackMode === 'autoReturn' &&
        entry.targetProgress >= 1 &&
        entry.progress >= 0.999
      ) {
        entry.holdTimer -= clampedDt;
        if (entry.holdTimer <= 0) {
          entry.targetProgress = 0;
          dirty = true;
        }
      }

      if (Math.abs(entry.targetProgress - entry.progress) > 0.0001) {
        const step = clampedDt / duration;
        if (entry.progress < entry.targetProgress) {
          entry.progress = Math.min(entry.targetProgress, entry.progress + step);
        } else {
          entry.progress = Math.max(entry.targetProgress, entry.progress - step);
        }
        dirty = true;
      }
    }

    if (dirty) {
      this.applyAll();
    }
    return dirty;
  }

  /** Applies exact pivot-hinge or linear-slider transforms to all managed child elements */
  public applyAll() {
    if (this.entries.length === 0) return;

    // 1. Reset every controlled target to its rest transform first
    for (const entry of this.entries) {
      entry.target.position.copy(entry.restPos);
      entry.target.quaternion.copy(entry.restQuat);
      entry.target.scale.copy(entry.restScale);
      entry.target.updateMatrix();
    }
    this.modelRoot.updateMatrixWorld(true);

    // 2. Apply each mechanism in shallow-to-deep order
    for (const entry of this.entries) {
      const { mechanism, target, restPos, restQuat, progress } = entry;
      const parent = target.parent;
      if (!parent) continue;

      const eased = evaluateMotionEasing(mechanism.easing, progress);

      // Compute transform from modelRoot local space -> target.parent local space
      parent.updateMatrixWorld(true);
      _invParentMat.copy(parent.matrixWorld).invert();
      _rootToParent.multiplyMatrices(_invParentMat, this.modelRoot.matrixWorld);

      if (mechanism.kind === 'hinge') {
        const angleDeg =
          mechanism.restAngleDeg + (mechanism.openAngleDeg - mechanism.restAngleDeg) * eased;
        const angleRad = THREE.MathUtils.degToRad(angleDeg);

        _pivotLocal
          .set(mechanism.pivot[0], mechanism.pivot[1], mechanism.pivot[2])
          .applyMatrix4(_rootToParent);
        getAxisVector(mechanism.axis, _axisLocal).transformDirection(_rootToParent).normalize();

        _rotQuat.setFromAxisAngle(_axisLocal, angleRad);
        _offsetVec.copy(restPos).sub(_pivotLocal).applyQuaternion(_rotQuat);
        target.position.copy(_pivotLocal).add(_offsetVec);
        target.quaternion.copy(_rotQuat).multiply(restQuat);
      } else {
        const dist =
          mechanism.restOffset + (mechanism.openOffset - mechanism.restOffset) * eased;
        _dispOrigin.set(0, 0, 0).applyMatrix4(_rootToParent);
        getAxisVector(mechanism.axis, _dispEnd)
          .multiplyScalar(dist)
          .applyMatrix4(_rootToParent)
          .sub(_dispOrigin);
        target.position.copy(restPos).add(_dispEnd);
      }

      target.updateMatrix();
      target.updateMatrixWorld(true);
    }
  }
}

/**
 * Builds rich, multi-part procedural PBR complex objects (6-12 parts, grounded bottom-center,
 * varied roughness/metalness, clean named child groups) for instant testing & placement.
 */
export function createBuiltinMechanismModel(template: BuiltinMechanismTemplate): THREE.Group {
  const root = new THREE.Group();
  root.name = `Builtin_${template}`;

  const setShadow = (mesh: THREE.Mesh) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  if (template === 'treasureChest') {
    const woodMat = new THREE.MeshStandardMaterial({
      color: '#6E4226',
      roughness: 0.78,
      metalness: 0.04,
    });
    const darkWoodMat = new THREE.MeshStandardMaterial({
      color: '#472816',
      roughness: 0.84,
      metalness: 0.05,
    });
    const ironMat = new THREE.MeshStandardMaterial({
      color: '#3A414E',
      roughness: 0.42,
      metalness: 0.78,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: '#F2B830',
      roughness: 0.22,
      metalness: 0.92,
    });

    // Stationary Chest Base
    const baseGroup = new THREE.Group();
    baseGroup.name = 'Chest_Base';
    const boxBody = setShadow(new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.56, 0.76), woodMat));
    boxBody.name = 'Wood_Hull';
    boxBody.position.set(0, 0.28, 0);
    baseGroup.add(boxBody);

    const interiorCavity = setShadow(
      new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.14, 0.62), darkWoodMat)
    );
    interiorCavity.name = 'Inner_Rim';
    interiorCavity.position.set(0, 0.51, 0);
    baseGroup.add(interiorCavity);

    // Iron base bands & corner brackets
    for (const sx of [-0.46, 0.46]) {
      const band = setShadow(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.58, 0.8), ironMat));
      band.name = sx < 0 ? 'Left_Iron_Band' : 'Right_Iron_Band';
      band.position.set(sx, 0.29, 0);
      baseGroup.add(band);
    }
    const lockPlate = setShadow(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.06), goldMat));
    lockPlate.name = 'Lock_Plate';
    lockPlate.position.set(0, 0.43, 0.39);
    baseGroup.add(lockPlate);

    root.add(baseGroup);

    // Movable Hinged Chest Lid
    const lidGroup = new THREE.Group();
    lidGroup.name = 'Chest_Lid';

    const lidSlab = setShadow(new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.14, 0.78), woodMat));
    lidSlab.name = 'Lid_Rim';
    lidSlab.position.set(0, 0.63, 0);
    lidGroup.add(lidSlab);

    const lidDome = setShadow(
      new THREE.Mesh(
        new THREE.CylinderGeometry(0.38, 0.38, 1.16, 18, 1, false, 0, Math.PI),
        woodMat
      )
    );
    lidDome.name = 'Lid_Dome';
    lidDome.rotation.z = Math.PI / 2;
    lidDome.rotation.y = Math.PI / 2;
    lidDome.position.set(0, 0.69, 0);
    lidGroup.add(lidDome);

    for (const sx of [-0.46, 0.46]) {
      const lidStrap = setShadow(
        new THREE.Mesh(
          new THREE.CylinderGeometry(0.398, 0.398, 0.085, 18, 1, false, 0, Math.PI),
          ironMat
        )
      );
      lidStrap.name = sx < 0 ? 'Left_Lid_Strap' : 'Right_Lid_Strap';
      lidStrap.rotation.z = Math.PI / 2;
      lidStrap.rotation.y = Math.PI / 2;
      lidStrap.position.set(sx, 0.69, 0);
      lidGroup.add(lidStrap);
    }

    const clasp = setShadow(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.07), goldMat));
    clasp.name = 'Front_Clasp';
    clasp.position.set(0, 0.59, 0.4);
    lidGroup.add(clasp);

    root.add(lidGroup);
    attachChestGoldenGlow(root, 0.94, 0.54, 0.585, lidGroup, true);
  } else if (template === 'slidingDoor') {
    const stoneMat = new THREE.MeshStandardMaterial({
      color: '#6C7382',
      roughness: 0.86,
      metalness: 0.06,
    });
    const darkStoneMat = new THREE.MeshStandardMaterial({
      color: '#3D4454',
      roughness: 0.78,
      metalness: 0.12,
    });
    const bronzeMat = new THREE.MeshStandardMaterial({
      color: '#B88442',
      roughness: 0.32,
      metalness: 0.84,
    });
    const runeMat = new THREE.MeshStandardMaterial({
      color: '#38BDF8',
      emissive: '#0EA5E9',
      emissiveIntensity: 0.7,
      roughness: 0.25,
      metalness: 0.2,
    });

    // Stationary Stone Frame & Wall Pocket
    const frameGroup = new THREE.Group();
    frameGroup.name = 'Door_Frame';

    const leftPillar = setShadow(new THREE.Mesh(new THREE.BoxGeometry(0.34, 2.35, 0.52), stoneMat));
    leftPillar.name = 'Left_Pillar';
    leftPillar.position.set(-0.92, 1.175, 0);
    frameGroup.add(leftPillar);

    const rightPillar = setShadow(new THREE.Mesh(new THREE.BoxGeometry(0.34, 2.35, 0.52), stoneMat));
    rightPillar.name = 'Right_Pillar';
    rightPillar.position.set(0.92, 1.175, 0);
    frameGroup.add(rightPillar);

    const lintel = setShadow(new THREE.Mesh(new THREE.BoxGeometry(2.38, 0.38, 0.62), stoneMat));
    lintel.name = 'Top_Lintel';
    lintel.position.set(0, 2.48, 0);
    frameGroup.add(lintel);

    const threshold = setShadow(new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.12, 0.56), darkStoneMat));
    threshold.name = 'Threshold_Track';
    threshold.position.set(0, 0.06, 0);
    frameGroup.add(threshold);

    const keystone = setShadow(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.44, 0.68), bronzeMat));
    keystone.name = 'Center_Keystone';
    keystone.position.set(0, 2.52, 0);
    frameGroup.add(keystone);

    root.add(frameGroup);

    // Movable Sliding Door Slab
    const panelGroup = new THREE.Group();
    panelGroup.name = 'Door_Panel';

    const slab = setShadow(new THREE.Mesh(new THREE.BoxGeometry(1.52, 2.18, 0.22), darkStoneMat));
    slab.name = 'Door_Slab';
    slab.position.set(0, 1.2, 0);
    panelGroup.add(slab);

    const bronzeBorder = setShadow(
      new THREE.Mesh(new THREE.BoxGeometry(1.26, 1.88, 0.25), bronzeMat)
    );
    bronzeBorder.name = 'Bronze_Inlay';
    bronzeBorder.position.set(0, 1.2, 0);
    panelGroup.add(bronzeBorder);

    const innerPanel = setShadow(
      new THREE.Mesh(new THREE.BoxGeometry(1.06, 1.68, 0.27), darkStoneMat)
    );
    innerPanel.name = 'Recessed_Core';
    innerPanel.position.set(0, 1.2, 0);
    panelGroup.add(innerPanel);

    const runeCore = setShadow(new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), runeMat));
    runeCore.name = 'Energy_Seal';
    runeCore.scale.set(1, 1.4, 0.45);
    runeCore.position.set(0, 1.32, 0.15);
    panelGroup.add(runeCore);

    const handle = setShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.44, 12), bronzeMat));
    handle.name = 'Door_Handle';
    handle.position.set(-0.56, 1.08, 0.16);
    panelGroup.add(handle);

    root.add(panelGroup);
  } else if (template === 'leverSwitch') {
    const stoneBaseMat = new THREE.MeshStandardMaterial({
      color: '#575E6E',
      roughness: 0.85,
      metalness: 0.08,
    });
    const ironMat = new THREE.MeshStandardMaterial({
      color: '#2F3643',
      roughness: 0.36,
      metalness: 0.86,
    });
    const steelMat = new THREE.MeshStandardMaterial({
      color: '#B6C0D2',
      roughness: 0.24,
      metalness: 0.92,
    });
    const gripMat = new THREE.MeshStandardMaterial({
      color: '#E11D48',
      roughness: 0.28,
      metalness: 0.14,
    });

    const baseGroup = new THREE.Group();
    baseGroup.name = 'Lever_Base';

    const plinth = setShadow(new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.18, 1.18), stoneBaseMat));
    plinth.name = 'Stone_Plinth';
    plinth.position.set(0, 0.09, 0);
    baseGroup.add(plinth);

    const slotPlate = setShadow(new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.12, 0.86), ironMat));
    slotPlate.name = 'Iron_Housing';
    slotPlate.position.set(0, 0.22, 0);
    baseGroup.add(slotPlate);

    for (const sx of [-0.14, 0.14]) {
      const cheek = setShadow(
        new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.07, 16), ironMat)
      );
      cheek.name = sx < 0 ? 'Left_Pivot_Cheek' : 'Right_Pivot_Cheek';
      cheek.rotation.z = Math.PI / 2;
      cheek.position.set(sx, 0.34, 0);
      baseGroup.add(cheek);
    }

    root.add(baseGroup);

    const armGroup = new THREE.Group();
    armGroup.name = 'Lever_Arm';

    const hub = setShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.24, 16), steelMat));
    hub.name = 'Pivot_Hub';
    hub.rotation.z = Math.PI / 2;
    hub.position.set(0, 0.34, 0);
    armGroup.add(hub);

    const shaft = setShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 1.18, 14), steelMat));
    shaft.name = 'Steel_Shaft';
    shaft.position.set(0, 0.92, 0);
    armGroup.add(shaft);

    const collar = setShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.065, 0.14, 14), ironMat));
    collar.name = 'Handle_Collar';
    collar.position.set(0, 1.44, 0);
    armGroup.add(collar);

    const knob = setShadow(new THREE.Mesh(new THREE.SphereGeometry(0.14, 18, 14), gripMat));
    knob.name = 'Grip_Orb';
    knob.position.set(0, 1.58, 0);
    armGroup.add(knob);

    root.add(armGroup);
  } else {
    // drawbridge
    const stoneMat = new THREE.MeshStandardMaterial({
      color: '#737A88',
      roughness: 0.88,
      metalness: 0.05,
    });
    const timberMat = new THREE.MeshStandardMaterial({
      color: '#7B4F2B',
      roughness: 0.78,
      metalness: 0.04,
    });
    const ironMat = new THREE.MeshStandardMaterial({
      color: '#343B48',
      roughness: 0.4,
      metalness: 0.82,
    });

    const gateGroup = new THREE.Group();
    gateGroup.name = 'Gatehouse_Pillars';

    for (const sx of [-1.08, 1.08]) {
      const tower = setShadow(new THREE.Mesh(new THREE.BoxGeometry(0.46, 2.3, 0.56), stoneMat));
      tower.name = sx < 0 ? 'Left_Gate_Pillar' : 'Right_Gate_Pillar';
      tower.position.set(sx, 1.15, -0.18);
      gateGroup.add(tower);

      const cap = setShadow(new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.22, 0.66), stoneMat));
      cap.name = sx < 0 ? 'Left_Cap' : 'Right_Cap';
      cap.position.set(sx, 2.38, -0.18);
      gateGroup.add(cap);

      const ring = setShadow(new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.028, 10, 18), ironMat));
      ring.name = sx < 0 ? 'Left_Winch_Ring' : 'Right_Winch_Ring';
      ring.position.set(sx, 1.88, 0.14);
      gateGroup.add(ring);
    }

    const sill = setShadow(new THREE.Mesh(new THREE.BoxGeometry(2.58, 0.16, 0.62), stoneMat));
    sill.name = 'Stone_Sill';
    sill.position.set(0, 0.08, -0.18);
    gateGroup.add(sill);

    root.add(gateGroup);

    // Movable Hinged Timber Bridge Deck (resting upright at Z = 0, lowers forward along +Z)
    const deckGroup = new THREE.Group();
    deckGroup.name = 'Bridge_Deck';

    const plankSlab = setShadow(new THREE.Mesh(new THREE.BoxGeometry(1.72, 2.05, 0.16), timberMat));
    plankSlab.name = 'Timber_Deck';
    plankSlab.position.set(0, 1.16, 0.04);
    deckGroup.add(plankSlab);

    for (const sy of [0.42, 1.16, 1.88]) {
      const brace = setShadow(new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.12, 0.2), ironMat));
      brace.name = `Iron_Crossbeam_${Math.round(sy * 10)}`;
      brace.position.set(0, sy, 0.04);
      deckGroup.add(brace);
    }

    for (const sx of [-0.72, 0.72]) {
      const rail = setShadow(new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.02, 0.22), ironMat));
      rail.name = sx < 0 ? 'Left_Side_Rail' : 'Right_Side_Rail';
      rail.position.set(sx, 1.16, 0.04);
      deckGroup.add(rail);
    }

    root.add(deckGroup);
  }

  root.updateMatrixWorld(true);
  return root;
}

/**
 * Default playable mechanisms + conditional game triggers for each built-in complex object.
 */
export function getDefaultMechanismsForTemplate(
  template: BuiltinMechanismTemplate
): ObjectMechanism[] {
  if (template === 'treasureChest') {
    return [
      {
        id: 'mech_chest_lid',
        name: 'Chest Lid Hinge',
        targetNodePath: '1:Chest_Lid',
        targetLabel: 'Chest Lid',
        kind: 'hinge',
        axis: 'x',
        pivot: [0, 0.56, -0.38],
        restAngleDeg: 0,
        openAngleDeg: -108,
        restOffset: 0,
        openOffset: 0,
        duration: 0.75,
        easing: 'elastic',
        playbackMode: 'once',
        triggers: [
          {
            id: 'trig_chest_open',
            event: 'playerUses',
            radius: 2.3,
            condition: 'hasKey',
            consumeRequired: true,
            lockedMessage: 'Locked! Bring a Key to open the chest.',
            action: 'open',
            setFlagOnOpen: 'chest_opened',
            rewardCoins: 5,
            message: 'Chest opened! +5 coins',
            sound: 'coin',
          },
        ],
      },
    ];
  }

  if (template === 'slidingDoor') {
    return [
      {
        id: 'mech_sliding_door',
        name: 'Temple Door Slider',
        targetNodePath: '1:Door_Panel',
        targetLabel: 'Door Panel',
        kind: 'slider',
        axis: 'x',
        pivot: [0, 1.2, 0],
        restAngleDeg: 0,
        openAngleDeg: 0,
        restOffset: 0,
        openOffset: 1.55,
        duration: 1.1,
        easing: 'smooth',
        playbackMode: 'toggle',
        triggers: [
          {
            id: 'trig_door_flag',
            event: 'flagSet',
            radius: 2.8,
            eventFlag: 'lever_pulled',
            condition: 'none',
            action: 'open',
            message: 'The stone temple door slides open!',
            sound: 'door',
          },
          {
            id: 'trig_door_use',
            event: 'playerUses',
            radius: 2.6,
            condition: 'flagSet',
            conditionValue: 'lever_pulled',
            lockedMessage: 'Sealed shut! Pull the floor lever first.',
            action: 'toggle',
            sound: 'door',
          },
        ],
      },
    ];
  }

  if (template === 'leverSwitch') {
    return [
      {
        id: 'mech_lever_arm',
        name: 'Lever Arm Pivot',
        targetNodePath: '1:Lever_Arm',
        targetLabel: 'Lever Arm',
        kind: 'hinge',
        axis: 'x',
        pivot: [0, 0.34, 0],
        restAngleDeg: -36,
        openAngleDeg: 38,
        restOffset: 0,
        openOffset: 0,
        duration: 0.45,
        easing: 'easeOut',
        playbackMode: 'toggle',
        triggers: [
          {
            id: 'trig_lever_pull',
            event: 'playerUses',
            radius: 2.2,
            condition: 'none',
            action: 'toggle',
            setFlagOnOpen: 'lever_pulled',
            clearFlagOnClose: true,
            message: 'Lever pulled! Distant mechanisms unlocked.',
            sound: 'sparkle',
          },
        ],
      },
    ];
  }

  // drawbridge
  return [
    {
      id: 'mech_bridge_deck',
      name: 'Drawbridge Hinge',
      targetNodePath: '1:Bridge_Deck',
      targetLabel: 'Bridge Deck',
      kind: 'hinge',
      axis: 'x',
      pivot: [0, 0.14, 0.04],
      restAngleDeg: 0,
      openAngleDeg: 88,
      restOffset: 0,
      openOffset: 0,
      duration: 1.6,
      easing: 'easeIn',
      playbackMode: 'toggle',
      triggers: [
        {
          id: 'trig_bridge_use',
          event: 'playerUses',
          radius: 3.0,
          condition: 'flagSet',
          conditionValue: 'lever_pulled',
          lockedMessage: 'Winch locked! Pull the lever to lower the drawbridge.',
          action: 'toggle',
          setFlagOnOpen: 'bridge_lowered',
          message: 'Drawbridge lowered!',
          sound: 'door',
        },
      ],
    },
  ];
}
