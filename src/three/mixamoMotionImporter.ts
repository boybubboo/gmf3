import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type {
  BonePoseAngles,
  CustomClipSlot,
  CustomMotionPreset,
  CustomPoseKeyframe,
  CustomRigSettings,
  MotionActorCategory,
  MotionRigArchetype,
  RigBoneRole,
} from '../types/maker';
import { uid } from '../utils/terrain';
import { autoMapAnimationClips, type CachedGLTF } from './gltfAssetManager';
import {
  collectRiggableNodes,
  inspectAnimationClip,
  inspectModelSkeleton,
  measureArmAngleFromDownDeg,
  RIG_BONE_ROLES,
  type ClipDiagnostics,
  type SkeletonInspection,
} from './proceduralRigAnimator';

export interface ParsedMotionSource {
  fileName: string;
  format: 'fbx' | 'glb' | 'embedded';
  root: THREE.Object3D;
  clips: THREE.AnimationClip[];
  diagnostics: ClipDiagnostics[];
  skeletonInfo: SkeletonInspection;
  sourceArmAngleFromDownDeg: number;
}

const fbxLoader = new FBXLoader();
const gltfLoader = new GLTFLoader();

const DEFAULT_SAMPLE_COUNT = 64;

function guessClipSlotFromName(name: string): CustomClipSlot {
  const auto = autoMapAnimationClips([name]);
  const entries = Object.entries(auto) as [CustomClipSlot, string | undefined][];
  // Prefer specific non-idle match first (autoMapAnimationClips falls back to idle on slot 0)
  for (const [slot, val] of entries) {
    if (slot !== 'idle' && val) return slot;
  }
  if (/idle|stand|breath|wait/i.test(name)) return 'idle';
  if (/dying|death|die|fall/i.test(name)) return 'dying';
  if (/dance|cheer|emote|wave|victory/i.test(name)) return 'interact';
  if (/block|guard|shield/i.test(name)) return 'block';
  return 'attack';
}

export function suggestSlotForMotionClip(clipName: string): CustomClipSlot {
  return guessClipSlotFromName(clipName);
}

/**
 * Loads an external Mixamo/Blender .fbx or .glb/.gltf animation file into a clean rest-pose
 * skeleton + parsed AnimationClips ready for timeline conversion.
 */
export async function parseMotionAssetFile(file: File): Promise<ParsedMotionSource> {
  const lower = file.name.toLowerCase();
  const isFbx = /\.fbx$/i.test(lower);
  const isGlb = /\.(glb|gltf)$/i.test(lower);
  if (!isFbx && !isGlb) {
    throw new Error(`Unsupported file "${file.name}". Upload a Mixamo .fbx or .glb/.gltf file.`);
  }

  const buffer = await file.arrayBuffer();
  let root: THREE.Object3D;
  let clips: THREE.AnimationClip[] = [];

  if (isFbx) {
    const group = fbxLoader.parse(buffer, '');
    root = group;
    clips = (group.animations ?? []) as THREE.AnimationClip[];
  } else {
    const gltf = await gltfLoader.parseAsync(buffer, '');
    root = gltf.scene;
    clips = gltf.animations ?? [];
  }

  if (clips.length === 0) {
    throw new Error(
      `No animation tracks were found in "${file.name}". Export with animation keyframes enabled.`
    );
  }

  // Filter out empty/zero-duration clips where possible
  const nonEmptyClips = clips.filter((c) => c.tracks.length > 0 && c.duration > 0.02);
  const usableClips = nonEmptyClips.length > 0 ? nonEmptyClips : clips;

  const skeletonInfo = inspectModelSkeleton(root);
  const { nodes } = collectRiggableNodes(root);
  if (nodes.length === 0) {
    throw new Error(
      `No skeleton bones found in "${file.name}". Ensure the Mixamo FBX or GLB includes armature bones.`
    );
  }

  const rawArmAngle = measureArmAngleFromDownDeg(root, nodes, skeletonInfo.autoBoneMap);
  const sourceArmAngleFromDownDeg = rawArmAngle ?? 88;
  const baseLabel = file.name.replace(/\.(fbx|glb|gltf)$/i, '').replace(/[_-]+/g, ' ').trim();
  const diagnostics = usableClips.map((c, idx) =>
    inspectAnimationClip(c, usableClips.length === 1 ? baseLabel : `${baseLabel} ${idx + 1}`)
  );

  return {
    fileName: file.name,
    format: isFbx ? 'fbx' : 'glb',
    root,
    clips: usableClips,
    diagnostics,
    skeletonInfo,
    sourceArmAngleFromDownDeg,
  };
}

/**
 * Wraps an already-loaded CachedGLTF so its embedded GLB animations can also be baked
 * onto editable timeline keyframes for any character.
 */
export function parseMotionFromCachedGLTF(
  cached: CachedGLTF,
  assetName: string
): ParsedMotionSource {
  const { nodes } = collectRiggableNodes(cached.scene);
  const rawArmAngle = measureArmAngleFromDownDeg(
    cached.scene,
    nodes,
    cached.skeletonInfo.autoBoneMap
  );
  return {
    fileName: `${assetName}.glb`,
    format: 'embedded',
    root: cached.scene,
    clips: cached.animations,
    diagnostics: cached.clipDiagnostics,
    skeletonInfo: cached.skeletonInfo,
    sourceArmAngleFromDownDeg: rawArmAngle ?? 85,
  };
}

interface SourceBoneRest {
  node: THREE.Object3D;
  role: RigBoneRole;
  targetKey: string;
  restQuat: THREE.Quaternion;
  restQuatInv: THREE.Quaternion;
  restPos: THREE.Vector3;
  parentCharQuat: THREE.Quaternion;
  parentCharQuatInv: THREE.Quaternion;
}

interface SampledFrame {
  time: number;
  quats: Map<string, THREE.Quaternion>;
  hipsOffsetY: number;
}

function resolveTargetBindArmAngle(
  targetCached: CachedGLTF | null | undefined,
  targetRig: CustomRigSettings | null | undefined
): number {
  if (targetCached) {
    const { nodes } = collectRiggableNodes(targetCached.scene);
    const boneMap = targetRig?.boneMap ?? targetCached.skeletonInfo.autoBoneMap;
    const measured = measureArmAngleFromDownDeg(targetCached.scene, nodes, boneMap);
    if (measured !== null) return measured;
  }
  if (targetRig && targetRig.armRelaxAngle > 0) {
    return THREE.MathUtils.clamp(targetRig.armRelaxAngle + 8, 12, 90);
  }
  // Procedural built-in Maker Hero starts in canonical T-pose (~88 deg from -Y)
  return 88;
}

function slerpQuatMapFrame(
  a: SampledFrame,
  b: SampledFrame,
  alpha: number,
  keys: string[],
  out: Map<string, THREE.Quaternion>
) {
  for (const k of keys) {
    const qa = a.quats.get(k);
    const qb = b.quats.get(k);
    if (!qa && !qb) continue;
    const dest = out.get(k) ?? new THREE.Quaternion();
    if (qa && qb) {
      dest.copy(qa).slerp(qb, alpha);
    } else if (qa) {
      dest.copy(qa);
    } else if (qb) {
      dest.copy(qb);
    }
    out.set(k, dest);
  }
}

function computeFrameErrorDeg(
  actual: SampledFrame,
  interpQuats: Map<string, THREE.Quaternion>,
  interpHipsY: number,
  hipsRef: number,
  keys: string[]
): number {
  let maxErrDeg = 0;
  for (const k of keys) {
    const qAct = actual.quats.get(k);
    const qInt = interpQuats.get(k);
    if (!qAct && !qInt) continue;
    const qa = qAct ?? _identQ;
    const qb = qInt ?? _identQ;
    const dot = Math.min(1, Math.abs(qa.dot(qb)));
    const angDeg = THREE.MathUtils.radToDeg(2 * Math.acos(dot));
    if (angDeg > maxErrDeg) maxErrDeg = angDeg;
  }
  const hipsErrDeg = (Math.abs(actual.hipsOffsetY - interpHipsY) / Math.max(0.1, hipsRef)) * 110;
  return Math.max(maxErrDeg, hipsErrDeg);
}

const _identQ = new THREE.Quaternion();

/**
 * Downsamples dense sampled frames into the requested count of sparse keyframes while preserving
 * peaks, extremes, start pose, and (if one-shot) end pose.
 */
function decimateSampledFrames(
  samples: SampledFrame[],
  keys: string[],
  hipsRef: number,
  targetCount: number,
  loop: boolean
): SampledFrame[] {
  const n = samples.length;
  if (n <= targetCount) return samples;

  const selected = new Set<number>([0]);
  if (!loop || n > 2) {
    selected.add(n - 1);
  }

  const interpBuf = new Map<string, THREE.Quaternion>();

  while (selected.size < targetCount) {
    const sortedIndices = Array.from(selected).sort((a, b) => a - b);
    let worstIdx = -1;
    let worstErr = -1;

    for (let s = 0; s < sortedIndices.length - 1; s++) {
      const i0 = sortedIndices[s];
      const i1 = sortedIndices[s + 1];
      if (i1 - i0 <= 1) continue;
      const f0 = samples[i0];
      const f1 = samples[i1];
      const span = Math.max(1e-6, f1.time - f0.time);

      for (let k = i0 + 1; k < i1; k++) {
        const fk = samples[k];
        const alpha = (fk.time - f0.time) / span;
        slerpQuatMapFrame(f0, f1, alpha, keys, interpBuf);
        const interpHips = THREE.MathUtils.lerp(f0.hipsOffsetY, f1.hipsOffsetY, alpha);
        const err = computeFrameErrorDeg(fk, interpBuf, interpHips, hipsRef, keys);
        if (err > worstErr) {
          worstErr = err;
          worstIdx = k;
        }
      }
    }

    if (worstIdx < 0 || worstErr < 0.35) break;
    selected.add(worstIdx);
  }

  const finalIdx = Array.from(selected).sort((a, b) => a - b);
  return finalIdx.map((i) => samples[i]);
}

function roundHalfDeg(deg: number): number {
  return Math.round(deg * 2) / 2;
}

export interface ConvertMixamoClipOptions {
  source: ParsedMotionSource;
  clipIndex: number;
  name: string;
  slot: CustomClipSlot;
  targetKeyframes?: number;
  loop?: boolean;
  fitArmRestPose?: boolean;
  armSpreadAdjustDeg?: number;
  targetRig?: CustomRigSettings | null;
  targetCached?: CachedGLTF | null;
  targetBoneNames?: string[];
  targetHipsHeightRef?: number;
  targetArchetype?: MotionRigArchetype;
  targetCategory?: MotionActorCategory;
}

export interface ConvertMixamoClipResult {
  preset: CustomMotionPreset;
  matchedRoles: number;
  totalSourceRoles: number;
  warning?: string;
}

/**
 * Extracts character-space joint rotations from any Mixamo FBX or GLB clip, automatically
 * adapts T-pose vs A-pose shoulder rest elevation + root height scaling, and outputs
 * a clean editable CustomMotionPreset ready for the Motion Studio timeline.
 */
export function convertClipToMotionPreset(
  opts: ConvertMixamoClipOptions
): ConvertMixamoClipResult {
  const {
    source,
    clipIndex,
    name,
    slot,
    targetKeyframes = 16,
    loop = slot !== 'attack' && slot !== 'jump' && slot !== 'dying' && slot !== 'swing' && slot !== 'throw' && slot !== 'punch' && slot !== 'kick' && slot !== 'stab',
    fitArmRestPose = true,
    armSpreadAdjustDeg = 0,
    targetRig = null,
    targetCached = null,
    targetBoneNames = [],
    targetHipsHeightRef = 0.82,
    targetArchetype = 'humanoid',
    targetCategory = 'hero',
  } = opts;

  const clip = source.clips[clipIndex] ?? source.clips[0];
  if (!clip) {
    throw new Error('Selected animation clip could not be found.');
  }

  const { nodes } = collectRiggableNodes(source.root);
  const byName = new Map<string, THREE.Object3D>();
  nodes.forEach((n) => byName.set(n.name, n));

  // Save initial local transforms so repeated conversions from the same ParsedMotionSource never drift
  const savedRest = nodes.map((n) => ({
    node: n,
    q: n.quaternion.clone(),
    p: n.position.clone(),
  }));

  source.root.updateMatrixWorld(true);
  const facingRad = THREE.MathUtils.degToRad(source.skeletonInfo.suggestedFacingOffsetDeg ?? 0);
  const facingQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), facingRad);
  const facingQuatInv = facingQuat.clone().invert();
  const pq = new THREE.Quaternion();

  const boneNameSet = new Set(targetBoneNames);
  const resolveOutputKey = (role: RigBoneRole): string => {
    const mapped = targetRig?.boneMap[role];
    if (mapped && (boneNameSet.size === 0 || boneNameSet.has(mapped))) {
      return mapped;
    }
    return role;
  };

  const capturedBones: SourceBoneRest[] = [];
  const usedTargetKeys = new Set<string>();
  const sourceRoleMap = source.skeletonInfo.autoBoneMap;

  for (const { role } of RIG_BONE_ROLES) {
    const srcBoneName = sourceRoleMap[role];
    if (!srcBoneName) continue;
    const node = byName.get(srcBoneName);
    if (!node) continue;

    if (node.parent) {
      node.parent.getWorldQuaternion(pq);
      // Apply source facing correction so +Z is forward, +X is Left, +Y is Up
      pq.premultiply(facingQuat);
    } else {
      pq.copy(facingQuat);
    }

    let targetKey = resolveOutputKey(role);
    if (usedTargetKeys.has(targetKey)) {
      targetKey = role;
    }
    usedTargetKeys.add(targetKey);

    capturedBones.push({
      node,
      role,
      targetKey,
      restQuat: node.quaternion.clone(),
      restQuatInv: node.quaternion.clone().invert(),
      restPos: node.position.clone(),
      parentCharQuat: pq.clone(),
      parentCharQuatInv: pq.clone().invert(),
    });
  }

  // Also capture target rig non-role bones if target & source share normalized names (e.g. wings/tail)
  const hipsEntry = capturedBones.find((b) => b.role === 'hips');
  const hipsRestY = hipsEntry ? Math.max(0.05, Math.abs(hipsEntry.restPos.y)) : 0.95;

  // T-Pose <-> A-Pose shoulder rest elevation compensation + user width adjustment
  const targetArmAngleDeg = resolveTargetBindArmAngle(targetCached, targetRig);
  const restFitDeg = fitArmRestPose
    ? THREE.MathUtils.clamp(source.sourceArmAngleFromDownDeg - targetArmAngleDeg, -65, 65)
    : 0;
  const charZAxis = new THREE.Vector3(0, 0, 1);
  const leftShoulderOffsetRad = THREE.MathUtils.degToRad(restFitDeg + armSpreadAdjustDeg);
  const rightShoulderOffsetRad = THREE.MathUtils.degToRad(-(restFitDeg + armSpreadAdjustDeg));
  const qLeftArmFit = new THREE.Quaternion().setFromAxisAngle(charZAxis, leftShoulderOffsetRad);
  const qRightArmFit = new THREE.Quaternion().setFromAxisAngle(charZAxis, rightShoulderOffsetRad);

  const mixer = new THREE.AnimationMixer(source.root);
  const action = mixer.clipAction(clip);
  action.reset();
  action.play();

  const duration = THREE.MathUtils.clamp(clip.duration || 1.2, 0.25, 6.0);
  const sampleCount = DEFAULT_SAMPLE_COUNT;
  const samples: SampledFrame[] = [];
  const qLocalDelta = new THREE.Quaternion();
  const qCharDelta = new THREE.Quaternion();

  try {
    for (let i = 0; i < sampleCount; i++) {
      const tNorm = i / Math.max(1, sampleCount - 1);
      const tSec = Math.min(duration * 0.9999, tNorm * duration);
      mixer.setTime(tSec);

      const quats = new Map<string, THREE.Quaternion>();
      for (const bone of capturedBones) {
        qLocalDelta.copy(bone.node.quaternion).multiply(bone.restQuatInv);
        qCharDelta
          .copy(bone.parentCharQuat)
          .multiply(qLocalDelta)
          .multiply(bone.parentCharQuatInv);

        if (bone.role === 'leftUpperArm' && Math.abs(leftShoulderOffsetRad) > 0.002) {
          qCharDelta.multiply(qLeftArmFit);
        } else if (bone.role === 'rightUpperArm' && Math.abs(rightShoulderOffsetRad) > 0.002) {
          qCharDelta.multiply(qRightArmFit);
        }

        qCharDelta.normalize();
        quats.set(bone.targetKey, qCharDelta.clone());
      }

      let hipsOffsetY = 0;
      if (hipsEntry) {
        const relY = (hipsEntry.node.position.y - hipsEntry.restPos.y) / hipsRestY;
        const clampedRelY = THREE.MathUtils.clamp(relY, -0.85, 0.6);
        hipsOffsetY = Math.round(clampedRelY * targetHipsHeightRef * 1000) / 1000;
      }

      samples.push({
        time: Math.round(tNorm * 100) / 100,
        quats,
        hipsOffsetY,
      });
    }
  } finally {
    mixer.stopAllAction();
    mixer.uncacheClip(clip);
    // Restore clean rest pose on cached source
    for (const s of savedRest) {
      s.node.quaternion.copy(s.q);
      s.node.position.copy(s.p);
    }
    source.root.updateMatrixWorld(true);
    void facingQuatInv;
  }

  const outputKeys = capturedBones.map((b) => b.targetKey);
  const reduced = decimateSampledFrames(
    samples,
    outputKeys,
    targetHipsHeightRef,
    THREE.MathUtils.clamp(targetKeyframes, 6, 36),
    loop
  );

  const euler = new THREE.Euler();
  const keyframes: CustomPoseKeyframe[] = reduced.map((frame, idx) => {
    const bones: Record<string, BonePoseAngles> = {};
    frame.quats.forEach((q, key) => {
      euler.setFromQuaternion(q, 'XYZ');
      const rx = THREE.MathUtils.clamp(roundHalfDeg(THREE.MathUtils.radToDeg(euler.x)), -170, 170);
      const ry = THREE.MathUtils.clamp(roundHalfDeg(THREE.MathUtils.radToDeg(euler.y)), -170, 170);
      const rz = THREE.MathUtils.clamp(roundHalfDeg(THREE.MathUtils.radToDeg(euler.z)), -170, 170);
      if (Math.abs(rx) >= 0.5 || Math.abs(ry) >= 0.5 || Math.abs(rz) >= 0.5) {
        bones[key] = [rx, ry, rz];
      }
    });

    const isFirst = idx === 0;
    const isLast = idx === reduced.length - 1;
    const timeVal = isFirst ? 0 : isLast && !loop ? 1 : frame.time;

    return {
      id: uid(),
      time: timeVal,
      bones,
      hipsOffsetY: Math.abs(frame.hipsOffsetY) >= 0.004 ? frame.hipsOffsetY : undefined,
    };
  });

  // Ensure strictly monotonic times if rounding collided
  for (let i = 1; i < keyframes.length; i++) {
    if (keyframes[i].time <= keyframes[i - 1].time) {
      keyframes[i].time = Math.min(1, Math.round((keyframes[i - 1].time + 0.01) * 100) / 100);
    }
  }

  const preset: CustomMotionPreset = {
    id: uid(),
    name: name.trim() || clip.name || 'Mixamo Motion',
    slot,
    duration: Number(duration.toFixed(2)),
    loop,
    autoCloseLoop: loop,
    easing: 'smooth',
    sourceType: 'mixamo',
    actorCategory: targetCategory,
    rigArchetype: targetArchetype,
    hipsHeightRef: Number(targetHipsHeightRef.toFixed(3)),
    keyframes,
    updatedAt: new Date().toISOString(),
  };

  let matchedOnTarget = 0;
  for (const bone of capturedBones) {
    if (boneNameSet.size === 0 || boneNameSet.has(bone.targetKey) || bone.targetKey in (targetRig?.boneMap ?? {})) {
      matchedOnTarget++;
    }
  }

  const warning =
    capturedBones.length < 6
      ? `Only ${capturedBones.length} source bones matched humanoid roles; results may be partial.`
      : undefined;

  return {
    preset,
    matchedRoles: matchedOnTarget,
    totalSourceRoles: capturedBones.length,
    warning,
  };
}
