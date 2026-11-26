import * as THREE from 'three';
import type {
  BonePoseAngles,
  CustomClipSlot,
  CustomMotionPreset,
  CustomPoseKeyframe,
  CustomRigSettings,
  MotionEasing,
  RigBoneRole,
  RigSwingAxis,
  SlotMotionTuning,
} from '../types/maker';

export const DEFAULT_SLOT_MOTION_TUNING: SlotMotionTuning = {
  speedMultiplier: 1.0,
  strideLength: 1.0,
  kneeBend: 1.0,
  armSwing: 1.0,
  armSideOffsetDeg: 0,
  bounce: 1.0,
  torsoLean: 0,
};

export function resolveSlotMotionTuning(
  settings: CustomRigSettings | undefined,
  slot: CustomClipSlot
): SlotMotionTuning {
  const raw = settings?.slotTuning?.[slot];
  if (!raw) return DEFAULT_SLOT_MOTION_TUNING;
  return {
    speedMultiplier: THREE.MathUtils.clamp(raw.speedMultiplier ?? 1, 0.25, 2.4),
    strideLength: THREE.MathUtils.clamp(raw.strideLength ?? 1, 0.25, 1.85),
    kneeBend: THREE.MathUtils.clamp(raw.kneeBend ?? 1, 0.15, 1.85),
    armSwing: THREE.MathUtils.clamp(raw.armSwing ?? 1, 0, 1.85),
    armSideOffsetDeg: THREE.MathUtils.clamp(raw.armSideOffsetDeg ?? 0, -25, 45),
    bounce: THREE.MathUtils.clamp(raw.bounce ?? 1, 0, 1.85),
    torsoLean: THREE.MathUtils.clamp(raw.torsoLean ?? 0, -18, 28),
  };
}

export interface RigRoleMeta {
  role: RigBoneRole;
  label: string;
  group: 'core' | 'arms' | 'legs';
}

export const RIG_BONE_ROLES: RigRoleMeta[] = [
  { role: 'head', label: 'Head', group: 'core' },
  { role: 'neck', label: 'Neck', group: 'core' },
  { role: 'chest', label: 'Chest / Upper Spine', group: 'core' },
  { role: 'spine', label: 'Spine / Torso', group: 'core' },
  { role: 'hips', label: 'Hips / Pelvis', group: 'core' },
  { role: 'leftShoulder', label: 'Left Clavicle / Shoulder', group: 'arms' },
  { role: 'leftUpperArm', label: 'Left Upper Arm', group: 'arms' },
  { role: 'leftLowerArm', label: 'Left Forearm', group: 'arms' },
  { role: 'leftHand', label: 'Left Hand / Wrist', group: 'arms' },
  { role: 'rightShoulder', label: 'Right Clavicle / Shoulder', group: 'arms' },
  { role: 'rightUpperArm', label: 'Right Upper Arm', group: 'arms' },
  { role: 'rightLowerArm', label: 'Right Forearm', group: 'arms' },
  { role: 'rightHand', label: 'Right Hand / Wrist', group: 'arms' },
  { role: 'leftUpperLeg', label: 'Left Thigh', group: 'legs' },
  { role: 'leftLowerLeg', label: 'Left Shin / Knee', group: 'legs' },
  { role: 'leftFoot', label: 'Left Foot / Ankle', group: 'legs' },
  { role: 'rightUpperLeg', label: 'Right Thigh', group: 'legs' },
  { role: 'rightLowerLeg', label: 'Right Shin / Knee', group: 'legs' },
  { role: 'rightFoot', label: 'Right Foot / Ankle', group: 'legs' },
];

export interface SkeletonInspection {
  hasSkeleton: boolean;
  isSkinned: boolean;
  skinnedMeshCount: number;
  boneNames: string[];
  autoBoneMap: Partial<Record<RigBoneRole, string>>;
  suggestedArmRelaxAngle: number;
  suggestedFacingOffsetDeg: number;
}

export interface ClipDiagnostics {
  name: string;
  duration: number;
  trackCount: number;
  hasMotion: boolean;
}

export type RigTestOverride =
  | null
  | { kind: 'limbCycle' }
  | { kind: 'role'; role: RigBoneRole }
  | { kind: 'manualBone'; boneName: string; rxDeg: number; ryDeg: number; rzDeg: number }
  | { kind: 'poseSnapshot'; bones: Record<string, BonePoseAngles>; hipsOffsetY?: number }
  | { kind: 'presetPreview'; preset: CustomMotionPreset; timeNorm: number; playing: boolean; playbackSpeed?: number }
  | { kind: 'glide'; sway?: number; steerBank?: number }
  | { kind: 'block'; speedNorm?: number };

// Reusable scratch math objects (zero allocations inside per-frame animation update)
const _qDeltaChar = new THREE.Quaternion();
const _qDeltaLocal = new THREE.Quaternion();
const _qStep = new THREE.Quaternion();
const _qPoseA = new THREE.Quaternion();
const _qPoseB = new THREE.Quaternion();
const _qRootWorld = new THREE.Quaternion();
const _qRootInv = new THREE.Quaternion();
const _qParentLive = new THREE.Quaternion();
const _qParentLiveInv = new THREE.Quaternion();
const _axisVec = new THREE.Vector3();
const _bonePosA = new THREE.Vector3();
const _bonePosB = new THREE.Vector3();
const _euler = new THREE.Euler();
const _eulerA = new THREE.Euler();
const _eulerB = new THREE.Euler();
const _matRootInv = new THREE.Matrix4();
const _footProbe = new THREE.Vector3();
const _tmpScale = new THREE.Vector3();
const _tmpRootScale = new THREE.Vector3();

const CHAR_X = new THREE.Vector3(1, 0, 0);
const CHAR_Y = new THREE.Vector3(0, 1, 0);
const CHAR_Z = new THREE.Vector3(0, 0, 1);

function roundHalfDeg(deg: number): number {
  return Math.round(deg * 2) / 2;
}

/**
 * Evaluates a MotionEasing curve for normalized segment progress t in [0, 1].
 * Note: 'elastic' intentionally overshoots past 1.0 and springs back to 1.0.
 */
export function evaluateMotionEasing(easing: MotionEasing | undefined, tRaw: number): number {
  const t = THREE.MathUtils.clamp(tRaw, 0, 1);
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  switch (easing) {
    case 'linear':
      return t;
    case 'easeIn':
      return t * t * t;
    case 'easeOut':
      return 1 - Math.pow(1 - t, 3);
    case 'elastic': {
      const c4 = (2 * Math.PI) / 3;
      return Math.pow(2, -8 * t) * Math.sin((t * 8 - 0.75) * c4) + 1;
    }
    case 'smooth':
    default:
      return t * t * (3 - 2 * t);
  }
}

/**
 * Shortest-path quaternion SLERP that smoothly extrapolates when alpha > 1 or alpha < 0
 * (used by elastic spring easing so joints bounce naturally along the exact rotation arc).
 */
function slerpWithOvershoot(
  out: THREE.Quaternion,
  qA: THREE.Quaternion,
  qB: THREE.Quaternion,
  alpha: number
): THREE.Quaternion {
  if (Math.abs(alpha) < 1e-6) return out.copy(qA);
  if (Math.abs(alpha - 1) < 1e-6) return out.copy(qB);

  let bx = qB.x;
  let by = qB.y;
  let bz = qB.z;
  let bw = qB.w;

  let cosHalfTheta = qA.x * bx + qA.y * by + qA.z * bz + qA.w * bw;
  if (cosHalfTheta < 0) {
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
    cosHalfTheta = -cosHalfTheta;
  }

  if (cosHalfTheta >= 0.99995) {
    out.set(
      qA.x + (bx - qA.x) * alpha,
      qA.y + (by - qA.y) * alpha,
      qA.z + (bz - qA.z) * alpha,
      qA.w + (bw - qA.w) * alpha
    );
    return out.normalize();
  }

  const halfTheta = Math.acos(Math.min(1, cosHalfTheta));
  const sinHalfTheta = Math.sqrt(Math.max(1e-10, 1 - cosHalfTheta * cosHalfTheta));
  const ratioA = Math.sin((1 - alpha) * halfTheta) / sinHalfTheta;
  const ratioB = Math.sin(alpha * halfTheta) / sinHalfTheta;

  out.set(
    qA.x * ratioA + bx * ratioB,
    qA.y * ratioA + by * ratioB,
    qA.z * ratioA + bz * ratioB,
    qA.w * ratioA + bw * ratioB
  );
  return out.normalize();
}

/**
 * Resolves the two bracketing keyframes and eased interpolation factor for a CustomMotionPreset
 * at normalized time rawTimeNorm. Supports linear/smooth/easeIn/easeOut/elastic easing and seamless auto-close looping.
 */
export function resolveKeyframeSegment(
  preset: CustomMotionPreset,
  rawTimeNorm: number
): {
  keyA: CustomPoseKeyframe;
  keyB: CustomPoseKeyframe;
  alpha: number;
} | null {
  const keys = preset.keyframes;
  if (!keys || keys.length === 0) return null;
  const sorted = [...keys].sort((a, b) => a.time - b.time);
  if (sorted.length === 1) {
    return { keyA: sorted[0], keyB: sorted[0], alpha: 0 };
  }

  let t = rawTimeNorm;
  if (preset.loop) {
    t = ((t % 1) + 1) % 1;
  } else {
    t = THREE.MathUtils.clamp(t, 0, 1);
  }

  const autoClose = preset.loop && preset.autoCloseLoop !== false;
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  let keyA = first;
  let keyB = last;
  let segAlpha = 0;

  if (t <= first.time) {
    if (autoClose && (first.time > 0.0005 || last.time < 0.9995)) {
      const span = 1 - last.time + first.time;
      const dist = t + (1 - last.time);
      keyA = last;
      keyB = first;
      segAlpha = span > 0.0001 ? THREE.MathUtils.clamp(dist / span, 0, 1) : 0;
    } else {
      keyA = first;
      keyB = first;
      segAlpha = 0;
    }
  } else if (t >= last.time) {
    if (autoClose && (last.time < 0.9995 || first.time > 0.0005)) {
      const span = 1 - last.time + first.time;
      const dist = t - last.time;
      keyA = last;
      keyB = first;
      segAlpha = span > 0.0001 ? THREE.MathUtils.clamp(dist / span, 0, 1) : 0;
    } else {
      keyA = last;
      keyB = last;
      segAlpha = 0;
    }
  } else {
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      if (t >= a.time && t <= b.time) {
        keyA = a;
        keyB = b;
        const span = b.time - a.time;
        segAlpha = span > 0.0001 ? THREE.MathUtils.clamp((t - a.time) / span, 0, 1) : 0;
        break;
      }
    }
  }

  const easing = keyA.easing ?? preset.easing;
  const eased = evaluateMotionEasing(easing, segAlpha);

  return { keyA, keyB, alpha: eased };
}

/**
 * Samples a CustomMotionPreset at a normalized time [0..1] into a plain BonePoseAngles map
 * using quaternion SLERP per bone (so timeline scrubbing and editing start from exact tweened poses).
 */
export function sampleMotionPresetToPose(
  preset: CustomMotionPreset,
  timeNorm: number
): { bones: Record<string, BonePoseAngles>; hipsOffsetY: number } {
  const seg = resolveKeyframeSegment(preset, timeNorm);
  if (!seg) return { bones: {}, hipsOffsetY: 0 };

  const { keyA, keyB, alpha } = seg;
  const boneSet = new Set<string>([
    ...Object.keys(keyA.bones),
    ...Object.keys(keyB.bones),
  ]);
  const bones: Record<string, BonePoseAngles> = {};
  const qA = new THREE.Quaternion();
  const qB = new THREE.Quaternion();
  const qOut = new THREE.Quaternion();
  const eA = new THREE.Euler();
  const eB = new THREE.Euler();

  for (const name of boneSet) {
    const a = keyA.bones[name] ?? [0, 0, 0];
    const b = keyB.bones[name] ?? [0, 0, 0];
    eA.set(
      THREE.MathUtils.degToRad(a[0]),
      THREE.MathUtils.degToRad(a[1]),
      THREE.MathUtils.degToRad(a[2]),
      'XYZ'
    );
    eB.set(
      THREE.MathUtils.degToRad(b[0]),
      THREE.MathUtils.degToRad(b[1]),
      THREE.MathUtils.degToRad(b[2]),
      'XYZ'
    );
    qA.setFromEuler(eA);
    qB.setFromEuler(eB);
    slerpWithOvershoot(qOut, qA, qB, alpha);
    eA.setFromQuaternion(qOut, 'XYZ');
    const rx = roundHalfDeg(THREE.MathUtils.radToDeg(eA.x));
    const ry = roundHalfDeg(THREE.MathUtils.radToDeg(eA.y));
    const rz = roundHalfDeg(THREE.MathUtils.radToDeg(eA.z));
    if (Math.abs(rx) >= 0.5 || Math.abs(ry) >= 0.5 || Math.abs(rz) >= 0.5) {
      bones[name] = [rx, ry, rz];
    }
  }

  const hA = keyA.hipsOffsetY ?? 0;
  const hB = keyB.hipsOffsetY ?? 0;
  const hipsOffsetY = Math.round(THREE.MathUtils.lerp(hA, hB, alpha) * 1000) / 1000;
  return { bones, hipsOffsetY };
}

/**
 * Inspects an AnimationClip to see whether its keyframes actually vary over time
 * (catches static T-pose / rest-pose exports that look like clips but never move limbs).
 */
export function inspectAnimationClip(clip: THREE.AnimationClip, fallbackName: string): ClipDiagnostics {
  const name = clip.name || fallbackName;
  let hasMotion = false;
  for (const track of clip.tracks) {
    const stride = track.getValueSize();
    const vals = track.values;
    if (vals.length <= stride) continue;
    for (let i = stride; i < vals.length; i++) {
      if (Math.abs(vals[i] - vals[i % stride]) > 0.0025) {
        hasMotion = true;
        break;
      }
    }
    if (hasMotion) break;
  }
  return {
    name,
    duration: Number(clip.duration.toFixed(2)),
    trackCount: clip.tracks.length,
    hasMotion,
  };
}

/**
 * Collects all riggable bones (from SkinnedMesh skeletons + Bone nodes; if none exist,
 * also checks for named articulated part groups so rigid-part character GLBs can animate).
 */
export function collectRiggableNodes(root: THREE.Object3D): {
  nodes: THREE.Object3D[];
  isSkinned: boolean;
  skinnedMeshCount: number;
} {
  const boneSet = new Set<THREE.Object3D>();
  const ordered: THREE.Object3D[] = [];
  let skinnedMeshCount = 0;

  const pushUnique = (obj: THREE.Object3D) => {
    if (!obj.name || boneSet.has(obj)) return;
    boneSet.add(obj);
    ordered.push(obj);
  };

  root.traverse((obj) => {
    const sm = obj as THREE.SkinnedMesh;
    if (sm.isSkinnedMesh) {
      skinnedMeshCount++;
      if (sm.skeleton) {
        for (const b of sm.skeleton.bones) {
          pushUnique(b);
        }
      }
    }
  });

  root.traverse((obj) => {
    if ((obj as THREE.Bone).isBone) {
      pushUnique(obj);
    }
  });

  if (ordered.length > 0) {
    return { nodes: ordered, isSkinned: skinnedMeshCount > 0, skinnedMeshCount };
  }

  // Fallback for non-skinned articulated character hierarchies (e.g. HeroRig, NPC, Buddy, Baddie nodes)
  const partPattern =
    /(head|neck|spine|chest|torso|hips|pelvis|arm|forearm|hand|leg|thigh|shin|calf|foot|shoulder|tail|wing|jaw|body_?pivot|knee|paw)/i;
  root.traverse((obj) => {
    if (obj !== root && obj.name && partPattern.test(obj.name)) {
      pushUnique(obj);
    }
  });

  return { nodes: ordered, isSkinned: false, skinnedMeshCount: 0 };
}

function normalizeBoneName(raw: string): string {
  // Split camelCase / PascalCase BEFORE lowercasing so LeftArm -> left_arm, UpperArm_L -> upper_arm_l
  // while leaving words like Pelvis/Clavicle/Lower intact.
  const spaced = raw
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();

  return spaced
    .replace(/^mixamorig\d*[:_.-]?/, '')
    .replace(/^armature[:_.-]?/, '')
    .replace(/^(tripo(?:_rig)?|def|org|mch|j_bip|bip\d+|valve_?biped|cc_base|character\d*)[:_.-]?/, '')
    .replace(/[:.\-\s]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getSide(norm: string): 'left' | 'right' | null {
  const tokens = norm.split('_').filter(Boolean);
  if (tokens.includes('left') || tokens.includes('l')) return 'left';
  if (tokens.includes('right') || tokens.includes('r')) return 'right';
  const joined = tokens.join('_');
  if (/^(left|l)(arm|up_?arm|upper_?arm|fore_?arm|lower_?arm|hand|wrist|leg|up_?leg|upper_?leg|lower_?leg|thigh|shin|calf|foot|toe|shoulder|clavicle)/.test(joined)) {
    return 'left';
  }
  if (/^(right|r)(arm|up_?arm|upper_?arm|fore_?arm|lower_?arm|hand|wrist|leg|up_?leg|upper_?leg|lower_?leg|thigh|shin|calf|foot|toe|shoulder|clavicle)/.test(joined)) {
    return 'right';
  }
  return null;
}

function matchBoneMapByName(nodes: THREE.Object3D[]): Partial<Record<RigBoneRole, string>> {
  const map: Partial<Record<RigBoneRole, string>> = {};
  const entries = nodes.map((node) => {
    const norm = normalizeBoneName(node.name);
    return {
      node,
      name: node.name,
      norm,
      side: getSide(norm),
    };
  });

  const pick = (pred: (e: (typeof entries)[number]) => number): string | undefined => {
    let bestScore = 0;
    let bestName: string | undefined;
    for (const e of entries) {
      const s = pred(e);
      if (s > bestScore) {
        bestScore = s;
        bestName = e.name;
      }
    }
    return bestName;
  };

  map.hips = pick((e) => {
    if (/twist|end|leaf|nub|ik/.test(e.norm)) return 0;
    if (/^(hips|pelvis|hip|root_hip|cog|mixamorig_hips|monster_?body_?pivot|monster_?hips)$/.test(e.norm)) return 10;
    if (/(hips|pelvis|body_?pivot)/.test(e.norm) && !e.side) return 8;
    return 0;
  });

  map.head = pick((e) => {
    if (/head_?end|headtop|hair|hat|eye|jaw|ear|brow|teeth|tongue|anchor|nub/.test(e.norm)) return 0;
    if (/^(head|skull|cranium|monster_?head_?0)$/.test(e.norm)) return 10;
    if (/head/.test(e.norm) && !e.side) return 7;
    return 0;
  });

  map.neck = pick((e) => {
    if (/end|nub|twist/.test(e.norm)) return 0;
    if (/^(neck|neck_?0?1|monster_?neck_?0_?0)$/.test(e.norm)) return 10;
    if (/neck/.test(e.norm) && !e.side) return 7;
    return 0;
  });

  map.chest = pick((e) => {
    if (/anchor|twist|end|nub/.test(e.norm)) return 0;
    if (/^(chest|upper_?chest|spine_?0?2|spine_?0?3|thorax|monster_?chest)$/.test(e.norm)) return 10;
    if (/(chest|upper_?chest|spine_?2)/.test(e.norm) && !e.side) return 8;
    return 0;
  });

  map.spine = pick((e) => {
    if (e.name === map.chest || /twist|end|nub/.test(e.norm)) return 0;
    if (/^(spine|spine_?0?1|waist|torso|abdomen|monster_?torso)$/.test(e.norm)) return 10;
    if (/(spine|waist|torso)/.test(e.norm) && !e.side) return 7;
    return 0;
  });

  const matchLimb = (
    side: 'left' | 'right',
    kind:
      | 'shoulder'
      | 'upperArm'
      | 'lowerArm'
      | 'hand'
      | 'upperLeg'
      | 'lowerLeg'
      | 'foot'
  ): string | undefined => {
    return pick((e) => {
      if (e.side !== side) return 0;
      const n = e.norm;
      if (/twist|roll|ik|pole|target|end|nub/.test(n)) return 0;
      if (kind === 'shoulder') {
        if (/upper_?arm|forearm|elbow|hand|wrist|finger|thumb/.test(n)) return 0;
        if (/(clavicle|collar)/.test(n)) return 10;
        if (/(^|_)shoulder($|_|\d)/.test(n)) return 9;
        return 0;
      }
      if (kind === 'upperArm') {
        if (/fore_?arm|lower_?arm|elbow|hand|wrist|finger|thumb|clavicle|collar/.test(n)) return 0;
        if (/(upper_?arm|up_?arm|u_?arm|humerus)/.test(n)) return 10;
        if (/(^|_)arm($|_|\d)|arm_/.test(n)) return 8;
        if (/wing_?(l|r)_?inner/.test(n)) return 6;
        if (/leg_?0_?(l|r)_?hip/.test(n)) return 4;
        return 0;
      }
      if (kind === 'lowerArm') {
        if (/hand|wrist|finger|thumb/.test(n)) return 0;
        if (/(fore_?arm|lower_?arm|low_?arm|elbow|radius|ulna)/.test(n)) return 10;
        if (/wing_?(l|r)_?outer/.test(n)) return 6;
        if (/leg_?0_?(l|r)_?knee/.test(n)) return 4;
        return 0;
      }
      if (kind === 'hand') {
        if (/finger|thumb|index|middle|ring|pinky/.test(n)) return 0;
        if (/(^|_)(hand|wrist|palm)($|_|\d)/.test(n)) return 10;
        if (/(hand|wrist)/.test(n)) return 7;
        return 0;
      }
      if (kind === 'upperLeg') {
        if (/lower|shin|calf|knee|foot|ankle|toe/.test(n)) return 0;
        if (/(up_?leg|upper_?leg|thigh|femur|hip_?leg)/.test(n)) return 10;
        if (/(^|_)leg($|_|\d)/.test(n)) return 5;
        if (/leg_?[123]_?(l|r)_?hip/.test(n)) return 6;
        return 0;
      }
      if (kind === 'lowerLeg') {
        if (/foot|ankle|toe|heel|thigh|up_?leg|upper_?leg/.test(n)) return 0;
        if (/(lower_?leg|low_?leg|shin|calf|knee|tibia)/.test(n)) return 10;
        // Mixamo uses LeftUpLeg + LeftLeg for thigh + shin
        if (/(^|_)leg($|_|\d)/.test(n)) return 8;
        if (/leg_?[123]_?(l|r)_?knee/.test(n)) return 6;
        return 0;
      }
      if (kind === 'foot') {
        if (/toe|ball/.test(n)) return 3;
        if (/(^|_)(foot|ankle|paw)($|_|\d)/.test(n)) return 10;
        if (/(foot|ankle)/.test(n)) return 8;
        return 0;
      }
      return 0;
    });
  };

  map.leftShoulder = matchLimb('left', 'shoulder');
  map.leftUpperArm = matchLimb('left', 'upperArm');
  map.leftLowerArm = matchLimb('left', 'lowerArm');
  map.leftHand = matchLimb('left', 'hand');
  map.rightShoulder = matchLimb('right', 'shoulder');
  map.rightUpperArm = matchLimb('right', 'upperArm');
  map.rightLowerArm = matchLimb('right', 'lowerArm');
  map.rightHand = matchLimb('right', 'hand');
  map.leftUpperLeg = matchLimb('left', 'upperLeg');
  map.leftLowerLeg = matchLimb('left', 'lowerLeg');
  map.leftFoot = matchLimb('left', 'foot');
  map.rightUpperLeg = matchLimb('right', 'upperLeg');
  map.rightLowerLeg = matchLimb('right', 'lowerLeg');
  map.rightFoot = matchLimb('right', 'foot');

  // Avoid assigning the exact same bone to both upper & lower leg when only "LeftLeg" exists
  if (map.leftUpperLeg && map.leftUpperLeg === map.leftLowerLeg) {
    map.leftLowerLeg = undefined;
  }
  if (map.rightUpperLeg && map.rightUpperLeg === map.rightLowerLeg) {
    map.rightLowerLeg = undefined;
  }

  return map;
}

/**
 * Estimates whether a humanoid GLB (such as Tripo 3D exports) was authored facing -Z, +X, or -X
 * relative to Maker's +Z forward axis, returning a clean 90° increment (0 | 90 | -90 | 180).
 */
export function detectModelFacingOffsetDeg(
  root: THREE.Object3D,
  nodes: THREE.Object3D[],
  map: Partial<Record<RigBoneRole, string>>
): number {
  if (nodes.length < 3) return 0;
  root.updateMatrixWorld(true);
  const byName = new Map<string, THREE.Object3D>();
  nodes.forEach((n) => byName.set(n.name, n));

  const getPos = (role: RigBoneRole): THREE.Vector3 | null => {
    const name = map[role];
    if (!name) return null;
    const node = byName.get(name);
    if (!node) return null;
    return node.getWorldPosition(new THREE.Vector3());
  };

  // Signal 1: (CharacterLeft - CharacterRight) × Up(+Y) = CharacterForward
  const leftPt = getPos('leftUpperArm') ?? getPos('leftLowerArm') ?? getPos('leftUpperLeg');
  const rightPt = getPos('rightUpperArm') ?? getPos('rightLowerArm') ?? getPos('rightUpperLeg');
  const fwdVec = new THREE.Vector3();
  let hasLeftRightCross = false;
  if (leftPt && rightPt) {
    const lr = leftPt.clone().sub(rightPt);
    lr.y = 0;
    if (lr.lengthSq() > 0.002) {
      // In Three.js right-handed coords (+Y up), Left(+X) × Up(+Y) = Forward(+Z)
      fwdVec.crossVectors(lr, CHAR_Y);
      fwdVec.y = 0;
      if (fwdVec.lengthSq() > 0.002) {
        fwdVec.normalize();
        hasLeftRightCross = true;
      }
    }
  }

  // Signal 2: Foot/toe extension forward from ankle/shin, OR lowest mesh vertices vs lowerLeg bone XZ
  const footFwd = new THREE.Vector3();
  let hasFootSignal = false;
  const ankleL = getPos('leftLowerLeg') ?? getPos('leftFoot');
  const ankleR = getPos('rightLowerLeg') ?? getPos('rightFoot');
  const toeNodes = nodes.filter((n) => /toe|ball|foot/i.test(n.name) && n.name !== map.leftLowerLeg && n.name !== map.rightLowerLeg);
  if (toeNodes.length > 0 && (ankleL || ankleR)) {
    const avgAnkle = new THREE.Vector3();
    let ac = 0;
    if (ankleL) { avgAnkle.add(ankleL); ac++; }
    if (ankleR) { avgAnkle.add(ankleR); ac++; }
    avgAnkle.divideScalar(ac);

    const avgToe = new THREE.Vector3();
    toeNodes.forEach((t) => avgToe.add(t.getWorldPosition(new THREE.Vector3())));
    avgToe.divideScalar(toeNodes.length);

    footFwd.subVectors(avgToe, avgAnkle);
    footFwd.y = 0;
    if (footFwd.lengthSq() > 0.0004) {
      footFwd.normalize();
      hasFootSignal = true;
    }
  }

  // Fallback mesh-sole check (only if no named foot/LR cross yet): feet stick out toward character's forward facing
  if (!hasFootSignal) {
    const box = new THREE.Box3().setFromObject(root);
    if (!box.isEmpty()) {
      const h = Math.max(0.05, box.max.y - box.min.y);
      const footCutoffY = box.min.y + h * 0.12;
      const soleSum = new THREE.Vector3();
      let soleCount = 0;
      const vTmp = new THREE.Vector3();
      root.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh || !mesh.geometry) return;
        const pos = mesh.geometry.getAttribute('position');
        if (!pos) return;
        const step = Math.max(1, Math.floor(pos.count / 900));
        for (let i = 0; i < pos.count; i += step) {
          vTmp.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
          if (vTmp.y <= footCutoffY) {
            soleSum.add(vTmp);
            soleCount++;
          }
        }
      });
      if (soleCount >= 8) {
        soleSum.divideScalar(soleCount);
        const refCenter = getPos('hips') ?? box.getCenter(new THREE.Vector3());
        footFwd.set(soleSum.x - refCenter.x, 0, soleSum.z - refCenter.z);
        if (footFwd.lengthSq() > h * h * 0.001) {
          footFwd.normalize();
          hasFootSignal = true;
        }
      }
    }
  }

  let bestFwd: THREE.Vector3 | null = null;
  if (hasLeftRightCross) {
    bestFwd = fwdVec;
  } else if (hasFootSignal) {
    bestFwd = footFwd;
  }
  if (!bestFwd) return 0;

  // Angle of model's current forward vector around +Y relative to +Z
  // Rotation needed on scaledRoot.rotation.y to align bestFwd -> +Z: -atan2(bestFwd.x, bestFwd.z)
  const rawDeg = THREE.MathUtils.radToDeg(Math.atan2(-bestFwd.x, bestFwd.z));
  const snapped = Math.round(rawDeg / 90) * 90;
  if (snapped === -180) return 180;
  if (snapped === 0 || snapped === 90 || snapped === -90 || snapped === 180) {
    return snapped;
  }
  return 0;
}

const HELPER_BONE_RE = /twist|roll|ik|pole|target|end|nub|leaf|eye|jaw|ear|hair|hat|thumb|index|middle|ring|pinky|toe/i;

function computeObjectOrBoneBox(root: THREE.Object3D, nodes: THREE.Object3D[]): THREE.Box3 {
  const box = new THREE.Box3().setFromObject(root);
  if (!box.isEmpty()) return box;
  const wp = new THREE.Vector3();
  for (const n of nodes) {
    n.getWorldPosition(wp);
    box.expandByPoint(wp);
  }
  return box;
}

/**
 * Topology + Spatial recognition for rigs with non-standard or generic bone names (Tripo generic joints, Bone.001, Joint_3).
 * Traces the parent/child skeleton tree from pelvis outward to legs, spine/chest/head, and clavicle/arms/hands.
 */
function fillMissingBonesSpatially(
  root: THREE.Object3D,
  nodes: THREE.Object3D[],
  map: Partial<Record<RigBoneRole, string>>,
  facingOffsetDeg = 0
): void {
  if (nodes.length < 3) return;

  root.updateMatrixWorld(true);
  const box = computeObjectOrBoneBox(root, nodes);
  if (box.isEmpty()) return;

  const facingQuat = new THREE.Quaternion().setFromAxisAngle(
    CHAR_Y,
    THREE.MathUtils.degToRad(facingOffsetDeg)
  );

  const boxCenter = new THREE.Vector3();
  box.getCenter(boxCenter);
  const rotBox = new THREE.Box3();
  const cornerTmp = new THREE.Vector3();
  for (const cx of [box.min.x, box.max.x]) {
    for (const cy of [box.min.y, box.max.y]) {
      for (const cz of [box.min.z, box.max.z]) {
        cornerTmp.set(cx - boxCenter.x, cy - box.min.y, cz - boxCenter.z).applyQuaternion(facingQuat);
        rotBox.expandByPoint(cornerTmp);
      }
    }
  }

  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  rotBox.getSize(size);
  rotBox.getCenter(center);
  const height = Math.max(0.01, size.y);
  const halfWidth = Math.max(0.01, size.x * 0.5);

  const nodeSet = new Set(nodes);
  const used = new Set(Object.values(map).filter(Boolean) as string[]);

  interface SpatialBoneInfo {
    node: THREE.Object3D;
    name: string;
    pos: THREE.Vector3;
    normY: number;
    normX: number;
    childBones: THREE.Object3D[];
  }

  const infoMap = new Map<string, SpatialBoneInfo>();

  const infos: SpatialBoneInfo[] = nodes.map((node) => {
    const rawPos = new THREE.Vector3();
    node.getWorldPosition(rawPos);
    const pos = rawPos
      .sub(new THREE.Vector3(boxCenter.x, box.min.y, boxCenter.z))
      .applyQuaternion(facingQuat);
    const childBones = node.children.filter((c) => nodeSet.has(c));
    const entry: SpatialBoneInfo = {
      node,
      name: node.name,
      pos,
      normY: (pos.y - rotBox.min.y) / height,
      normX: (pos.x - center.x) / halfWidth,
      childBones,
    };
    infoMap.set(node.name, entry);
    return entry;
  });

  const isMajorBone = (name: string) => !HELPER_BONE_RE.test(name);
  const countDescendants = (node: THREE.Object3D): number => {
    let count = 0;
    const stack = [...node.children];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      if (nodeSet.has(cur)) count++;
      cur.children.forEach((c) => stack.push(c));
    }
    return count;
  };

  // --- Phase A: Skeleton Graph Topology Traversal ---
  // 1. Hips / Pelvis: central bone with downward leg branch(es) or >=3 child branches
  if (!map.hips) {
    const pelvisCand = infos
      .filter((b) => !used.has(b.name) && isMajorBone(b.name) && Math.abs(b.pos.x - center.x) < height * 0.14 && b.normY > 0.25 && b.normY < 0.68)
      .sort((a, b) => {
        const aDown = a.childBones.filter((c) => {
          const ci = infoMap.get(c.name);
          return ci && ci.pos.y < a.pos.y - height * 0.03;
        }).length;
        const bDown = b.childBones.filter((c) => {
          const ci = infoMap.get(c.name);
          return ci && ci.pos.y < b.pos.y - height * 0.03;
        }).length;
        if (aDown !== bDown) return bDown - aDown;
        if (a.childBones.length !== b.childBones.length) return b.childBones.length - a.childBones.length;
        return Math.abs(a.normY - 0.5) - Math.abs(b.normY - 0.5);
      })[0];
    if (pelvisCand) {
      map.hips = pelvisCand.name;
      used.add(pelvisCand.name);
    }
  }

  // 2. Walk Spine -> Chest -> Arm Fork -> Neck -> Head from Hips
  const hipsInfo = map.hips ? infoMap.get(map.hips) : undefined;
  if (hipsInfo) {
    const spinePath: SpatialBoneInfo[] = [];
    let cur: SpatialBoneInfo | undefined = hipsInfo;
    let armFork: SpatialBoneInfo | null = null;
    for (let step = 0; step < 8 && cur; step++) {
      const curNode: SpatialBoneInfo = cur;
      const upChildren: SpatialBoneInfo[] = curNode.childBones
        .map((c) => infoMap.get(c.name))
        .filter((ci): ci is SpatialBoneInfo => Boolean(ci && ci.pos.y >= curNode.pos.y - height * 0.015));
      if (upChildren.length === 0) break;

      // Check if current node already forks into lateral left/right arm branches (supports narrow clavicles too)
      const lateralThreshold = Math.max(0.015, height * 0.018);
      const lateralChildren = upChildren.filter((c) => Math.abs(c.pos.x - curNode.pos.x) > lateralThreshold);
      const hasLeftBranch = lateralChildren.some((c) => c.pos.x > curNode.pos.x + lateralThreshold);
      const hasRightBranch = lateralChildren.some((c) => c.pos.x < curNode.pos.x - lateralThreshold);
      if (hasLeftBranch && hasRightBranch && curNode !== hipsInfo) {
        armFork = curNode;
        break;
      }

      // Advance up central trunk child with largest subtree (strictly near sagittal midline, no lateral clavicles)
      const centralNext: SpatialBoneInfo | undefined = upChildren
        .filter(
          (c) =>
            Math.abs(c.pos.x - center.x) < height * 0.045 &&
            c.pos.y > curNode.pos.y + height * 0.015 &&
            isMajorBone(c.name)
        )
        .sort((a, b) => countDescendants(b.node) - countDescendants(a.node))[0];
      if (!centralNext) break;
      spinePath.push(centralNext);
      cur = centralNext;
    }

    if (spinePath.length >= 2) {
      if (!map.spine && !used.has(spinePath[0].name)) {
        map.spine = spinePath[0].name;
        used.add(map.spine);
      }
      const chestCand = spinePath[spinePath.length - 1];
      if (!map.chest && !used.has(chestCand.name)) {
        map.chest = chestCand.name;
        used.add(map.chest);
      }
    } else if (spinePath.length === 1 && !map.spine && !used.has(spinePath[0].name)) {
      map.spine = spinePath[0].name;
      used.add(map.spine);
    }

    if (armFork) {
      const forkNode = armFork;
      const upFromFork: SpatialBoneInfo[] = forkNode.childBones
        .map((c) => infoMap.get(c.name))
        .filter((ci): ci is SpatialBoneInfo => Boolean(ci));

      // Central neck -> head chain above arm fork (strictly closest to sagittal midline)
      const neckStart = upFromFork
        .filter((c) => Math.abs(c.pos.x - center.x) < height * 0.05 && c.pos.y > forkNode.pos.y && isMajorBone(c.name))
        .sort((a, b) => Math.abs(a.pos.x - center.x) - Math.abs(b.pos.x - center.x) || a.pos.y - b.pos.y)[0];
      if (neckStart) {
        const headChain: SpatialBoneInfo[] = [neckStart];
        let hc: SpatialBoneInfo | undefined = neckStart;
        for (let k = 0; k < 4 && hc; k++) {
          const curHc: SpatialBoneInfo = hc;
          const next: SpatialBoneInfo | undefined = curHc.childBones
            .map((c) => infoMap.get(c.name))
            .filter((ci): ci is SpatialBoneInfo => Boolean(ci && isMajorBone(ci.name) && ci.pos.y >= curHc.pos.y))
            .sort((a, b) => b.pos.y - a.pos.y)[0];
          if (!next) break;
          headChain.push(next);
          hc = next;
        }
        if (headChain.length >= 2) {
          if (!map.neck && !used.has(headChain[0].name)) {
            map.neck = headChain[0].name;
            used.add(map.neck);
          }
          const headNode = headChain[headChain.length - 1];
          if (!map.head && !used.has(headNode.name)) {
            map.head = headNode.name;
            used.add(map.head);
          }
        } else if (headChain.length === 1 && !map.head && !used.has(headChain[0].name)) {
          map.head = headChain[0].name;
          used.add(map.head);
        }
      }

      // Left & Right arm chains from fork
      const traceArmSide = (isLeft: boolean) => {
        const armThreshold = Math.max(0.015, height * 0.018);
        const branchStart = upFromFork
          .filter((c) => c.name !== neckStart?.name && (isLeft ? c.pos.x > forkNode.pos.x + armThreshold : c.pos.x < forkNode.pos.x - armThreshold))
          .sort((a, b) => countDescendants(b.node) - countDescendants(a.node))[0];
        if (!branchStart) return;
        const chain: SpatialBoneInfo[] = [branchStart];
        let ac: SpatialBoneInfo | undefined = branchStart;
        for (let k = 0; k < 5 && ac; k++) {
          const curAc: SpatialBoneInfo = ac;
          const next: SpatialBoneInfo | undefined = curAc.childBones
            .map((c) => infoMap.get(c.name))
            .filter((ci): ci is SpatialBoneInfo => Boolean(ci && !/finger|thumb|index|middle|ring|pinky|twist|roll|end|nub/i.test(ci.name)))
            .sort((a, b) => countDescendants(b.node) - countDescendants(a.node))[0];
          if (!next) break;
          chain.push(next);
          ac = next;
        }
        // Distinguish [clavicle, upperArm, lowerArm, hand] vs [upperArm, lowerArm, hand]
        let idxOffset = 0;
        if (
          chain.length >= 3 &&
          Math.abs(chain[0].pos.x - center.x) < height * 0.11 &&
          Math.abs(chain[1].pos.x - chain[0].pos.x) > height * 0.06
        ) {
          const shRole: RigBoneRole = isLeft ? 'leftShoulder' : 'rightShoulder';
          if (!map[shRole] && !used.has(chain[0].name)) {
            map[shRole] = chain[0].name;
            used.add(chain[0].name);
          }
          idxOffset = 1;
        }
        const uaRole: RigBoneRole = isLeft ? 'leftUpperArm' : 'rightUpperArm';
        const laRole: RigBoneRole = isLeft ? 'leftLowerArm' : 'rightLowerArm';
        const hRole: RigBoneRole = isLeft ? 'leftHand' : 'rightHand';
        if (chain[idxOffset] && !map[uaRole] && !used.has(chain[idxOffset].name)) {
          map[uaRole] = chain[idxOffset].name;
          used.add(chain[idxOffset].name);
        }
        if (chain[idxOffset + 1] && !map[laRole] && !used.has(chain[idxOffset + 1].name)) {
          map[laRole] = chain[idxOffset + 1].name;
          used.add(chain[idxOffset + 1].name);
        }
        if (chain[idxOffset + 2] && !map[hRole] && !used.has(chain[idxOffset + 2].name)) {
          map[hRole] = chain[idxOffset + 2].name;
          used.add(chain[idxOffset + 2].name);
        }
      };
      traceArmSide(true);
      traceArmSide(false);
    }
  }

  // --- Phase B: Spatial Bounding-Box Fallbacks (handles disconnected rigs & missed slots) ---
  // Head fallback: highest major bone near center X
  if (!map.head) {
    const cand = infos
      .filter((b) => !used.has(b.name) && isMajorBone(b.name) && b.normY > 0.72 && Math.abs(b.normX) < 0.25)
      .sort((a, b) => b.normY - a.normY)[0];
    if (cand) {
      map.head = cand.name;
      used.add(cand.name);
    }
  }

  // Hips fallback
  if (!map.hips) {
    const cand = infos
      .filter((b) => !used.has(b.name) && b.normY > 0.34 && b.normY < 0.62 && Math.abs(b.normX) < 0.18)
      .sort((a, b) => b.childBones.length - a.childBones.length)[0];
    if (cand) {
      map.hips = cand.name;
      used.add(cand.name);
    }
  }

  // Spine fallback
  if (!map.spine) {
    const cand = infos
      .filter((b) => !used.has(b.name) && b.normY > 0.48 && b.normY < 0.78 && Math.abs(b.normX) < 0.18)
      .sort((a, b) => Math.abs(a.normY - 0.6) - Math.abs(b.normY - 0.6))[0];
    if (cand) {
      map.spine = cand.name;
      used.add(cand.name);
    }
  }

  // Arms fallback: symmetric lateral bones in upper torso
  if (!map.leftUpperArm || !map.rightUpperArm) {
    const upperCandidates = infos.filter(
      (b) => !used.has(b.name) && isMajorBone(b.name) && b.normY > 0.56 && b.normY < 0.88 && Math.abs(b.normX) > 0.12 && b.childBones.length > 0
    );
    const posX = upperCandidates
      .filter((b) => b.normX > 0)
      .sort((a, b) => Math.abs(a.normX - 0.32) - Math.abs(b.normX - 0.32))[0];
    const negX = upperCandidates
      .filter((b) => b.normX < 0)
      .sort((a, b) => Math.abs(a.normX + 0.32) - Math.abs(b.normX + 0.32))[0];
    if (!map.leftUpperArm && posX) {
      map.leftUpperArm = posX.name;
      used.add(posX.name);
      const lowerChild = posX.childBones.find((c) => !used.has(c.name));
      if (!map.leftLowerArm && lowerChild) {
        map.leftLowerArm = lowerChild.name;
        used.add(lowerChild.name);
        const handChild = lowerChild.children.find((c) => nodeSet.has(c) && !used.has(c.name) && isMajorBone(c.name));
        if (!map.leftHand && handChild) {
          map.leftHand = handChild.name;
          used.add(handChild.name);
        }
      }
    }
    if (!map.rightUpperArm && negX) {
      map.rightUpperArm = negX.name;
      used.add(negX.name);
      const lowerChild = negX.childBones.find((c) => !used.has(c.name));
      if (!map.rightLowerArm && lowerChild) {
        map.rightLowerArm = lowerChild.name;
        used.add(lowerChild.name);
        const handChild = lowerChild.children.find((c) => nodeSet.has(c) && !used.has(c.name) && isMajorBone(c.name));
        if (!map.rightHand && handChild) {
          map.rightHand = handChild.name;
          used.add(handChild.name);
        }
      }
    }
  }

  // Legs fallback: symmetric bones descending downward near pelvis
  if (!map.leftUpperLeg || !map.rightUpperLeg || !map.leftFoot || !map.rightFoot) {
    const legCandidates = infos.filter((b) => {
      if (used.has(b.name) || b.normY < 0.24 || b.normY > 0.62 || Math.abs(b.normX) < 0.04) return false;
      return b.childBones.some((cb) => {
        const ci = infoMap.get(cb.name);
        return ci && ci.pos.y < b.pos.y - height * 0.05;
      });
    });
    const pickLegChain = (cand: (typeof infos)[number] | undefined, isLeft: boolean) => {
      if (!cand) return;
      const ul: RigBoneRole = isLeft ? 'leftUpperLeg' : 'rightUpperLeg';
      const ll: RigBoneRole = isLeft ? 'leftLowerLeg' : 'rightLowerLeg';
      const ft: RigBoneRole = isLeft ? 'leftFoot' : 'rightFoot';
      if (!map[ul]) {
        map[ul] = cand.name;
        used.add(cand.name);
      }
      const shin = cand.childBones.find((c) => !used.has(c.name) && isMajorBone(c.name)) ?? cand.childBones[0];
      if (!map[ll] && shin && !used.has(shin.name)) {
        map[ll] = shin.name;
        used.add(shin.name);
        const foot = shin.children.find((c) => nodeSet.has(c) && !used.has(c.name) && !/twist|roll|end|nub/i.test(c.name));
        if (!map[ft] && foot) {
          map[ft] = foot.name;
          used.add(foot.name);
        }
      }
    };
    if (!map.leftUpperLeg) {
      pickLegChain(legCandidates.filter((b) => b.normX > 0).sort((a, b) => b.normY - a.normY)[0], true);
    }
    if (!map.rightUpperLeg) {
      pickLegChain(legCandidates.filter((b) => b.normX < 0).sort((a, b) => b.normY - a.normY)[0], false);
    }
  }
}

export function measureArmAngleFromDownDeg(
  root: THREE.Object3D,
  nodes: THREE.Object3D[],
  map: Partial<Record<RigBoneRole, string>>
): number | null {
  const byName = new Map<string, THREE.Object3D>();
  nodes.forEach((n) => byName.set(n.name, n));

  const pairs: [string | undefined, string | undefined][] = [
    [map.leftUpperArm, map.leftLowerArm],
    [map.rightUpperArm, map.rightLowerArm],
  ];

  root.updateMatrixWorld(true);
  const pA = new THREE.Vector3();
  const pB = new THREE.Vector3();

  let angleSum = 0;
  let angleCount = 0;

  for (const [uName, lName] of pairs) {
    if (!uName) continue;
    const upper = byName.get(uName);
    if (!upper) continue;
    const lower = (lName ? byName.get(lName) : undefined) ?? upper.children[0];
    if (!lower) continue;
    upper.getWorldPosition(pA);
    lower.getWorldPosition(pB);
    const dir = pB.sub(pA);
    const len = dir.length();
    if (len < 0.001) continue;
    dir.divideScalar(len);
    const horiz = Math.hypot(dir.x, dir.z);
    const angleFromDownDeg = THREE.MathUtils.radToDeg(Math.atan2(horiz, -dir.y));
    angleSum += angleFromDownDeg;
    angleCount++;
  }

  if (angleCount === 0) return null;
  return angleSum / angleCount;
}

export function estimateArmRelaxAngle(
  root: THREE.Object3D,
  nodes: THREE.Object3D[],
  map: Partial<Record<RigBoneRole, string>>
): number {
  const avgAngleFromDown = measureArmAngleFromDownDeg(root, nodes, map);
  if (avgAngleFromDown === null) return 0;
  // Already hanging cleanly near body sides
  if (avgAngleFromDown <= 13) return 0;
  // Leave ~8 deg natural side clearance so arms rest by sides without clipping hips
  return THREE.MathUtils.clamp(Math.round(avgAngleFromDown - 8), 0, 82);
}

export function inspectModelSkeleton(root: THREE.Object3D): SkeletonInspection {
  const { nodes, isSkinned, skinnedMeshCount } = collectRiggableNodes(root);
  const boneNames = nodes.map((n) => n.name);
  const nameBoneMap = matchBoneMapByName(nodes);
  let autoBoneMap: Partial<Record<RigBoneRole, string>> = { ...nameBoneMap };
  let suggestedFacingOffsetDeg = detectModelFacingOffsetDeg(root, nodes, autoBoneMap);
  fillMissingBonesSpatially(root, nodes, autoBoneMap, suggestedFacingOffsetDeg);

  // If named L/R bones were absent on the initial pass (generic Bone_001 rigs), re-check foot forward
  // vector using topology-discovered ankle->foot bones; if facing flips, re-run spatial L/R assignment.
  const hasNamedLR = Boolean(
    nameBoneMap.leftUpperArm || nameBoneMap.rightUpperArm || nameBoneMap.leftUpperLeg || nameBoneMap.rightUpperLeg
  );
  if (!hasNamedLR && suggestedFacingOffsetDeg === 0) {
    const byName = new Map<string, THREE.Object3D>();
    nodes.forEach((n) => byName.set(n.name, n));
    const ankleL = autoBoneMap.leftLowerLeg ? byName.get(autoBoneMap.leftLowerLeg) : undefined;
    const footL = autoBoneMap.leftFoot ? byName.get(autoBoneMap.leftFoot) : undefined;
    const ankleR = autoBoneMap.rightLowerLeg ? byName.get(autoBoneMap.rightLowerLeg) : undefined;
    const footR = autoBoneMap.rightFoot ? byName.get(autoBoneMap.rightFoot) : undefined;
    const pairs: [THREE.Object3D, THREE.Object3D][] = [];
    if (ankleL && footL) pairs.push([ankleL, footL]);
    if (ankleR && footR) pairs.push([ankleR, footR]);
    if (pairs.length > 0) {
      root.updateMatrixWorld(true);
      const fFwd = new THREE.Vector3();
      const pa = new THREE.Vector3();
      const pf = new THREE.Vector3();
      for (const [a, f] of pairs) {
        a.getWorldPosition(pa);
        f.getWorldPosition(pf);
        fFwd.x += pf.x - pa.x;
        fFwd.z += pf.z - pa.z;
      }
      if (fFwd.lengthSq() > 0.0004) {
        fFwd.normalize();
        const rawDeg = THREE.MathUtils.radToDeg(Math.atan2(-fFwd.x, fFwd.z));
        const snapped = Math.round(rawDeg / 90) * 90;
        const normalized = snapped === -180 ? 180 : snapped;
        if (normalized !== 0 && (normalized === 90 || normalized === -90 || normalized === 180)) {
          suggestedFacingOffsetDeg = normalized;
          autoBoneMap = { ...nameBoneMap };
          fillMissingBonesSpatially(root, nodes, autoBoneMap, suggestedFacingOffsetDeg);
        }
      }
    }
  }

  const suggestedArmRelaxAngle = estimateArmRelaxAngle(root, nodes, autoBoneMap);

  return {
    hasSkeleton: isSkinned || Object.keys(autoBoneMap).length >= 2,
    isSkinned,
    skinnedMeshCount,
    boneNames,
    autoBoneMap,
    suggestedArmRelaxAngle,
    suggestedFacingOffsetDeg,
  };
}

export function createDefaultRigSettings(
  inspection: SkeletonInspection,
  hasMovingClips: boolean
): CustomRigSettings {
  return {
    mode: hasMovingClips ? 'auto' : 'procedural',
    boneMap: { ...inspection.autoBoneMap },
    limbSwingAxis: 'auto',
    armRelaxAngle: inspection.suggestedArmRelaxAngle,
    armRelaxAutoVersion: 2,
    armSpreadAngle: 0,
    idleArmSpreadAngle: 0,
    mirrorArmRelax: true,
    mirrorLimbSwing: false,
    motionStrength: 1.0,
    headMotion: 1.0,
    facingOffsetDeg: inspection.suggestedFacingOffsetDeg ?? 0,
  };
}

interface CapturedBone {
  node: THREE.Object3D;
  restQuat: THREE.Quaternion;
  restQuatInv: THREE.Quaternion;
  restPos: THREE.Vector3;
  parentCharQuat: THREE.Quaternion;
  parentCharQuatInv: THREE.Quaternion;
  charPosX: number;
  hasPostClipQuat: boolean;
  prePostClipQuat: THREE.Quaternion;
  postClipQuat: THREE.Quaternion;
  smoothQuat: THREE.Quaternion;
  hasSmoothQuat: boolean;
}

function axisFromSetting(axis: Exclude<RigSwingAxis, 'auto'>, out: THREE.Vector3): THREE.Vector3 {
  switch (axis) {
    case 'x':
      return out.set(1, 0, 0);
    case '-x':
      return out.set(-1, 0, 0);
    case 'y':
      return out.set(0, 1, 0);
    case '-y':
      return out.set(0, -1, 0);
    case 'z':
      return out.set(0, 0, 1);
    case '-z':
      return out.set(0, 0, -1);
  }
}

interface CapturedEyelid {
  node: THREE.Object3D;
  role: 'top' | 'bottom';
  restClosedFrac: number;
  minOpenRad: number;
  maxCloseRad: number;
  restAngleRad: number;
}

interface CapturedFootAnchor {
  node: THREE.Object3D;
  localAnchor: THREE.Vector3;
  restCharY: number;
}

export class ProceduralRigController {
  private readonly charRoot: THREE.Object3D;
  private readonly allBones = new Map<string, CapturedBone>();
  private readonly allBonesLower = new Map<string, CapturedBone>();
  private readonly footAnchors: CapturedFootAnchor[] = [];
  private readonly eyelids: CapturedEyelid[] = [];
  private settings: CustomRigSettings;
  private customAnimations: CustomMotionPreset[] = [];
  private defaultSlotPresets: Partial<Record<CustomClipSlot, string>> = {};
  private elapsed = 0;
  private slotElapsed = 0;
  private attackElapsed = 0;
  private locoPhase = 0;
  private runBlend = 0;
  private lastSlot: CustomClipSlot = 'idle';
  private testOverride: RigTestOverride = null;
  private previewTimeNorm = 0;
  private previewHoldElapsed = 0;
  private blinkTimer = 1.6 + Math.random() * 2.4;
  private blinkActiveElapsed = -1;

  constructor(
    charRoot: THREE.Object3D,
    modelClone: THREE.Object3D,
    settings: CustomRigSettings,
    customAnimations?: CustomMotionPreset[],
    defaultSlotPresets?: Partial<Record<CustomClipSlot, string>>
  ) {
    this.charRoot = charRoot;
    this.settings = {
      ...settings,
      boneMap: { ...settings.boneMap },
      invertedRoles: settings.invertedRoles ? { ...settings.invertedRoles } : undefined,
    };
    this.customAnimations = customAnimations ? [...customAnimations] : [];
    this.defaultSlotPresets = defaultSlotPresets ? { ...defaultSlotPresets } : {};
    this.captureRestPose(modelClone);
  }

  private captureRestPose(modelClone: THREE.Object3D) {
    const { nodes } = collectRiggableNodes(modelClone);
    this.charRoot.updateMatrixWorld(true);

    const rootWorldQuat = new THREE.Quaternion();
    const rootWorldQuatInv = new THREE.Quaternion();
    const rootWorldMatInv = new THREE.Matrix4();
    this.charRoot.getWorldQuaternion(rootWorldQuat);
    rootWorldQuatInv.copy(rootWorldQuat).invert();
    rootWorldMatInv.copy(this.charRoot.matrixWorld).invert();

    const wp = new THREE.Vector3();
    const pq = new THREE.Quaternion();

    for (const node of nodes) {
      if (node.parent) {
        node.parent.getWorldQuaternion(pq);
        pq.premultiply(rootWorldQuatInv);
      } else {
        pq.identity();
      }
      node.getWorldPosition(wp);
      wp.applyMatrix4(rootWorldMatInv);

      const cap: CapturedBone = {
        node,
        restQuat: node.quaternion.clone(),
        restQuatInv: node.quaternion.clone().invert(),
        restPos: node.position.clone(),
        parentCharQuat: pq.clone(),
        parentCharQuatInv: pq.clone().invert(),
        charPosX: wp.x,
        hasPostClipQuat: false,
        prePostClipQuat: node.quaternion.clone(),
        postClipQuat: node.quaternion.clone(),
        smoothQuat: node.quaternion.clone(),
        hasSmoothQuat: false,
      };
      this.allBones.set(node.name, cap);
      this.allBonesLower.set(node.name.toLowerCase(), cap);
    }
    this.captureFootAnchors();

    // Collect procedural Character Maker eyelid shells (or any node tagged with eyelidRole)
    this.eyelids.length = 0;
    modelClone.traverse((obj) => {
      const ud = obj.userData as {
        eyelidRole?: 'top' | 'bottom';
        restClosedFrac?: number;
        minOpenRad?: number;
        maxCloseRad?: number;
        autoBlink?: boolean;
      } | undefined;
      if (ud?.eyelidRole === 'top' || ud?.eyelidRole === 'bottom') {
        if (ud.autoBlink === false) return;
        this.eyelids.push({
          node: obj,
          role: ud.eyelidRole,
          restClosedFrac: THREE.MathUtils.clamp(ud.restClosedFrac ?? 0.08, 0, 1),
          minOpenRad: ud.minOpenRad ?? (ud.eyelidRole === 'top' ? -Math.PI * 0.5 : Math.PI * 0.52),
          maxCloseRad: ud.maxCloseRad ?? (ud.eyelidRole === 'top' ? Math.PI * 0.48 : 0),
          restAngleRad: obj.rotation.x,
        });
      }
    });
  }

  private updateEyelidBlinks(dt: number) {
    if (this.eyelids.length === 0) return;
    const blinkDuration = 0.17;
    let blinkT = 0;

    if (this.blinkActiveElapsed >= 0) {
      this.blinkActiveElapsed += dt;
      if (this.blinkActiveElapsed >= blinkDuration) {
        this.blinkActiveElapsed = -1;
        this.blinkTimer = 2.4 + Math.random() * 3.1;
        blinkT = 0;
      } else {
        const u = this.blinkActiveElapsed / blinkDuration;
        if (u < 0.38) {
          const k = u / 0.38;
          blinkT = k * k;
        } else if (u < 0.52) {
          blinkT = 1;
        } else {
          const k = 1 - (u - 0.52) / 0.48;
          blinkT = k * (2 - k);
        }
      }
    } else {
      this.blinkTimer -= dt;
      if (this.blinkTimer <= 0) {
        this.blinkActiveElapsed = 0;
      }
    }

    for (let i = 0; i < this.eyelids.length; i++) {
      const lid = this.eyelids[i];
      const frac = THREE.MathUtils.lerp(lid.restClosedFrac, 1, blinkT);
      lid.node.rotation.x = THREE.MathUtils.lerp(lid.minOpenRad, lid.maxCloseRad, frac);
    }
  }

  public getBoneCount(): number {
    return this.allBones.size;
  }

  public getAllBoneNames(): string[] {
    return Array.from(this.allBones.keys());
  }

  public setCustomAnimations(
    presets: CustomMotionPreset[] | undefined,
    defaults: Partial<Record<CustomClipSlot, string>> | undefined
  ) {
    this.customAnimations = presets ? [...presets] : [];
    this.defaultSlotPresets = defaults ? { ...defaults } : {};
  }

  public getDefaultPresetForSlot(slot: CustomClipSlot): CustomMotionPreset | null {
    const presetId = this.defaultSlotPresets[slot];
    if (!presetId) return null;
    const found = this.customAnimations.find((p) => p.id === presetId);
    if (!found || found.keyframes.length === 0) return null;
    return found;
  }

  public getPreviewTimeNorm(): number {
    return this.previewTimeNorm;
  }

  public getBoneNode(name: string | undefined): THREE.Object3D | null {
    if (!name) return null;
    return this.allBones.get(name)?.node ?? null;
  }

  public getRoleBoneNode(role: RigBoneRole): THREE.Object3D | null {
    return this.getBoneNode(this.settings.boneMap[role]);
  }

  public updateSettings(next: CustomRigSettings) {
    this.settings = {
      ...next,
      boneMap: { ...next.boneMap },
      invertedRoles: next.invertedRoles ? { ...next.invertedRoles } : undefined,
    };
    this.captureFootAnchors();
  }

  private captureFootAnchors() {
    this.footAnchors.length = 0;
    if (this.allBones.size === 0) return;
    this.charRoot.updateWorldMatrix(true, true);
    _matRootInv.copy(this.charRoot.matrixWorld).invert();

    const candidateNames = new Set<string>();
    const footL = this.settings.boneMap.leftFoot;
    const footR = this.settings.boneMap.rightFoot;
    const lowerLegL = this.settings.boneMap.leftLowerLeg;
    const lowerLegR = this.settings.boneMap.rightLowerLeg;
    const upperLegL = this.settings.boneMap.leftUpperLeg;
    const upperLegR = this.settings.boneMap.rightUpperLeg;
    if (footL) candidateNames.add(footL);
    else if (lowerLegL) candidateNames.add(lowerLegL);
    else if (upperLegL) candidateNames.add(upperLegL);
    if (footR) candidateNames.add(footR);
    else if (lowerLegR) candidateNames.add(lowerLegR);
    else if (upperLegR) candidateNames.add(upperLegR);

    if (candidateNames.size === 0) {
      this.allBones.forEach((_cap, name) => {
        if (/^(left|right)?(lower|upper)?leg$|^leg_\d+_[lr]_(lower|foot|hip)$/i.test(name) || /foot|ankle|toe|paw/i.test(name)) {
          candidateNames.add(name);
        }
      });
    }

    const pickDeepestFootNode = (startNode: THREE.Object3D): THREE.Object3D => {
      let bestNode = startNode;
      let bestCharY = Infinity;
      const wp = new THREE.Vector3();
      startNode.traverse((child) => {
        if (child === startNode || /foot|toe|ankle|ball|paw/i.test(child.name)) {
          if ((child as THREE.Bone).isBone || child === startNode) {
            child.getWorldPosition(wp).applyMatrix4(_matRootInv);
            if (wp.y < bestCharY - 0.005 || (Math.abs(wp.y - bestCharY) <= 0.005 && /toe|foot|paw/i.test(child.name))) {
              bestCharY = wp.y;
              bestNode = child;
            }
          }
        }
      });
      return bestNode;
    };

    const usedNodes = new Set<THREE.Object3D>();
    const nodeMatInv = new THREE.Matrix4();
    const corner = new THREE.Vector3();
    for (const cName of candidateNames) {
      const cap = this.allBones.get(cName);
      if (!cap) continue;
      const anchorNode = pickDeepestFootNode(cap.node);
      if (usedNodes.has(anchorNode)) continue;
      usedNodes.add(anchorNode);

      const localAnchor = new THREE.Vector3(0, 0, 0);
      // For non-skinned procedural legs (boots/shoes attached directly to leg group), find lowest mesh point in node space
      let hasChildSkinned = false;
      anchorNode.traverse((obj) => {
        if ((obj as THREE.SkinnedMesh).isSkinnedMesh) hasChildSkinned = true;
      });
      if (!hasChildSkinned) {
        const box = new THREE.Box3();
        let foundMesh = false;
        anchorNode.traverse((obj) => {
          const m = obj as THREE.Mesh;
          if (!m.isMesh || !m.visible || /shadow/i.test(m.name)) return;
          box.expandByObject(m);
          foundMesh = true;
        });
        if (foundMesh && !box.isEmpty()) {
          nodeMatInv.copy(anchorNode.matrixWorld).invert();
          const cx = (box.min.x + box.max.x) * 0.5;
          const cz = (box.min.z + box.max.z) * 0.5;
          corner.set(cx, box.min.y, cz).applyMatrix4(nodeMatInv);
          localAnchor.copy(corner);
        }
      }

      const restPosChar = localAnchor.clone().applyMatrix4(anchorNode.matrixWorld).applyMatrix4(_matRootInv);
      this.footAnchors.push({
        node: anchorNode,
        localAnchor,
        restCharY: restPosChar.y,
      });
    }
  }

  private pinFeetToGround() {
    if (this.footAnchors.length === 0) return;
    const hipsName =
      this.settings.boneMap.hips ??
      this.resolvePresetBoneTarget('hips')?.node.name;
    const hipsCap = hipsName ? this.allBones.get(hipsName) : undefined;
    if (!hipsCap) return;

    this.charRoot.updateWorldMatrix(true, true);
    _matRootInv.copy(this.charRoot.matrixWorld).invert();

    let maxNeededShift = -Infinity;
    for (let i = 0; i < this.footAnchors.length; i++) {
      const anchor = this.footAnchors[i];
      _footProbe.copy(anchor.localAnchor).applyMatrix4(anchor.node.matrixWorld).applyMatrix4(_matRootInv);
      const neededShift = anchor.restCharY - _footProbe.y;
      if (neededShift > maxNeededShift) {
        maxNeededShift = neededShift;
      }
    }
    if (!Number.isFinite(maxNeededShift) || Math.abs(maxNeededShift) < 0.0002) return;

    const clampedShift = THREE.MathUtils.clamp(maxNeededShift, -0.45, 0.45);
    let parentScaleRatio = 1;
    if (hipsCap.node.parent) {
      hipsCap.node.parent.getWorldScale(_tmpScale);
      this.charRoot.getWorldScale(_tmpRootScale);
      const r = _tmpScale.y / Math.max(0.0001, _tmpRootScale.y);
      if (r > 0.0001) parentScaleRatio = r;
    }
    hipsCap.node.position.y += clampedShift / parentScaleRatio;
  }

  public recaptureAfterFacingChange() {
    this.resetToRestPose();
    this.charRoot.updateMatrixWorld(true);
    const rootWorldQuat = new THREE.Quaternion();
    const rootWorldQuatInv = new THREE.Quaternion();
    const rootWorldMatInv = new THREE.Matrix4();
    this.charRoot.getWorldQuaternion(rootWorldQuat);
    rootWorldQuatInv.copy(rootWorldQuat).invert();
    rootWorldMatInv.copy(this.charRoot.matrixWorld).invert();

    const wp = new THREE.Vector3();
    const pq = new THREE.Quaternion();
    this.allBones.forEach((cap) => {
      if (cap.node.parent) {
        cap.node.parent.getWorldQuaternion(pq);
        pq.premultiply(rootWorldQuatInv);
      } else {
        pq.identity();
      }
      cap.node.getWorldPosition(wp);
      wp.applyMatrix4(rootWorldMatInv);
      cap.parentCharQuat.copy(pq);
      cap.parentCharQuatInv.copy(pq).invert();
      cap.charPosX = wp.x;
    });
    this.captureFootAnchors();
  }

  public hasMappedBones(): boolean {
    return Object.values(this.settings.boneMap).some((name) => Boolean(name && this.allBones.has(name)));
  }

  public setTestOverride(override: RigTestOverride) {
    const prev = this.testOverride;
    this.testOverride = override;
    if (override?.kind === 'presetPreview') {
      if (
        prev?.kind !== 'presetPreview' ||
        prev.preset.id !== override.preset.id ||
        !override.playing
      ) {
        this.previewTimeNorm = THREE.MathUtils.clamp(override.timeNorm, 0, 1);
        this.previewHoldElapsed = 0;
      }
    }
    if (!override) {
      this.previewHoldElapsed = 0;
      this.resetToRestPose();
    }
  }

  public getTestLabel(): string | null {
    const override = this.testOverride;
    if (!override) return null;
    if (override.kind === 'role') {
      const meta = RIG_BONE_ROLES.find((r) => r.role === override.role);
      return meta ? `Testing ${meta.label}` : null;
    }
    if (override.kind === 'manualBone') {
      return `Posing ${override.boneName}`;
    }
    if (override.kind === 'poseSnapshot') {
      return 'Motion Editor · Posing Keyframe';
    }
    if (override.kind === 'presetPreview') {
      return `Motion Editor · ${override.preset.name}`;
    }
    // limbCycle
    const phase = Math.floor(this.elapsed / 1.4) % 5;
    const labels = [
      'Testing Head (nod & turn)',
      'Testing Left Arm',
      'Testing Right Arm',
      'Testing Left Leg',
      'Testing Right Leg',
    ];
    return labels[phase];
  }

  public resetToRestPose() {
    this.allBones.forEach((b) => {
      b.node.quaternion.copy(b.restQuat);
      b.node.position.copy(b.restPos);
      b.hasPostClipQuat = false;
    });
  }

  private smoothLiveBoneQuaternions(dt: number, lambda = 16) {
    const alpha = 1 - Math.exp(-lambda * Math.max(0.001, dt));
    this.allBones.forEach((b) => {
      if (!b.hasSmoothQuat) {
        b.smoothQuat.copy(b.node.quaternion);
        b.hasSmoothQuat = true;
      } else {
        b.smoothQuat.slerp(b.node.quaternion, alpha);
        b.node.quaternion.copy(b.smoothQuat);
      }
    });
  }

  /**
   * Applies a character-space Euler delta [rxDeg, ryDeg, rzDeg] to any riggable bone by name.
   */
  public applyCharSpaceBoneAngles(boneName: string, angles: BonePoseAngles) {
    const cap = this.allBones.get(boneName);
    if (!cap) return;
    const [rxDeg, ryDeg, rzDeg] = angles;
    if (Math.abs(rxDeg) < 0.05 && Math.abs(ryDeg) < 0.05 && Math.abs(rzDeg) < 0.05) {
      cap.node.quaternion.copy(cap.restQuat);
      return;
    }
    _euler.set(
      THREE.MathUtils.degToRad(rxDeg),
      THREE.MathUtils.degToRad(ryDeg),
      THREE.MathUtils.degToRad(rzDeg),
      'XYZ'
    );
    _qDeltaChar.setFromEuler(_euler);
    _qDeltaLocal
      .copy(cap.parentCharQuatInv)
      .multiply(_qDeltaChar)
      .multiply(cap.parentCharQuat);
    cap.node.quaternion.copy(_qDeltaLocal).multiply(cap.restQuat);
  }

  private resolvePresetBoneTarget(presetBoneName: string): CapturedBone | undefined {
    const direct = this.allBones.get(presetBoneName);
    if (direct) return direct;

    const lower = presetBoneName.toLowerCase();
    const lowerDirect = this.allBonesLower.get(lower);
    if (lowerDirect) return lowerDirect;

    // Role-based fallback if the preset was saved with canonical role keys or another rig's bone names
    const mappedByRole = this.settings.boneMap[presetBoneName as RigBoneRole];
    if (mappedByRole) {
      const cap = this.allBones.get(mappedByRole);
      if (cap) return cap;
    }

    const roleAlias: Record<string, RigBoneRole> = {
      hips: 'hips',
      pelvis: 'hips',
      monsterbodypivot: 'hips',
      monsterhips: 'hips',
      spine: 'spine',
      monstertorso: 'spine',
      chest: 'chest',
      monsterchest: 'chest',
      neck: 'neck',
      monsterneck_0_0: 'neck',
      head: 'head',
      monsterhead_0: 'head',
      leftshoulder: 'leftShoulder',
      leftclavicle: 'leftShoulder',
      leftupperarm: 'leftUpperArm',
      leftlowerarm: 'leftLowerArm',
      lefthand: 'leftHand',
      rightshoulder: 'rightShoulder',
      rightclavicle: 'rightShoulder',
      rightupperarm: 'rightUpperArm',
      rightlowerarm: 'rightLowerArm',
      righthand: 'rightHand',
      leftupperleg: 'leftUpperLeg',
      leftlowerleg: 'leftLowerLeg',
      leftfoot: 'leftFoot',
      rightupperleg: 'rightUpperLeg',
      rightlowerleg: 'rightLowerLeg',
      rightfoot: 'rightFoot',
    };
    const role = roleAlias[lower];
    if (role) {
      const mapped = this.settings.boneMap[role];
      if (mapped) {
        const cap = this.allBones.get(mapped);
        if (cap) return cap;
      }
      const canonicalCap = this.allBonesLower.get(role.toLowerCase());
      if (canonicalCap) return canonicalCap;
    }
    return undefined;
  }

  public getHipsHeightRef(): number {
    const hipsName = this.settings.boneMap.hips;
    const hipsCap = hipsName ? this.allBones.get(hipsName) : undefined;
    if (hipsCap && Math.abs(hipsCap.restPos.y) > 0.05) {
      return Math.abs(hipsCap.restPos.y);
    }
    return 0.72;
  }

  /**
   * Applies a complete pose snapshot map + optional hips vertical offset cleanly from bind pose.
   */
  public applyPoseSnapshot(bones: Record<string, BonePoseAngles>, hipsOffsetY = 0, hipsHeightRef?: number) {
    this.resetToRestPose();
    for (const [boneName, angles] of Object.entries(bones)) {
      const cap = this.resolvePresetBoneTarget(boneName);
      if (cap) {
        this.applyCharSpaceBoneAngles(cap.node.name, angles);
      }
    }
    if (Math.abs(hipsOffsetY) > 0.0005) {
      const hipsName = this.settings.boneMap.hips;
      const hipsCap = hipsName ? this.allBones.get(hipsName) : undefined;
      if (hipsCap) {
        const targetRef = this.getHipsHeightRef();
        const scaleRatio =
          hipsHeightRef && hipsHeightRef > 0.05
            ? THREE.MathUtils.clamp(targetRef / hipsHeightRef, 0.35, 2.8)
            : 1;
        const scaledOffset = hipsOffsetY * scaleRatio;
        hipsCap.node.position.y = Math.max(-hipsCap.restPos.y + 0.05, hipsCap.restPos.y + scaledOffset);
      }
    }
  }

  /**
   * Evaluates a CustomMotionPreset at normalized time [0..1] directly onto the skeleton using SLERP.
   */
  public applyCustomPresetAtTime(preset: CustomMotionPreset, timeNorm: number) {
    this.resetToRestPose();
    const seg = resolveKeyframeSegment(preset, timeNorm);
    if (!seg) return;
    const { keyA, keyB, alpha } = seg;
    const appliedTargets = new Set<string>();

    // Collect union of bones present in either bracketing keyframe
    for (const [name, anglesA] of Object.entries(keyA.bones)) {
      const cap = this.resolvePresetBoneTarget(name);
      if (!cap) continue;
      appliedTargets.add(cap.node.name);
      const anglesB = keyB.bones[name];
      _eulerA.set(
        THREE.MathUtils.degToRad(anglesA[0]),
        THREE.MathUtils.degToRad(anglesA[1]),
        THREE.MathUtils.degToRad(anglesA[2]),
        'XYZ'
      );
      _qPoseA.setFromEuler(_eulerA);
      if (anglesB) {
        _eulerB.set(
          THREE.MathUtils.degToRad(anglesB[0]),
          THREE.MathUtils.degToRad(anglesB[1]),
          THREE.MathUtils.degToRad(anglesB[2]),
          'XYZ'
        );
        _qPoseB.setFromEuler(_eulerB);
      } else {
        _qPoseB.identity();
      }
      slerpWithOvershoot(_qDeltaChar, _qPoseA, _qPoseB, alpha);
      _qDeltaLocal
        .copy(cap.parentCharQuatInv)
        .multiply(_qDeltaChar)
        .multiply(cap.parentCharQuat);
      cap.node.quaternion.copy(_qDeltaLocal).multiply(cap.restQuat);
    }

    for (const [name, anglesB] of Object.entries(keyB.bones)) {
      if (name in keyA.bones) continue;
      const cap = this.resolvePresetBoneTarget(name);
      if (!cap || appliedTargets.has(cap.node.name)) continue;
      appliedTargets.add(cap.node.name);
      _qPoseA.identity();
      _eulerB.set(
        THREE.MathUtils.degToRad(anglesB[0]),
        THREE.MathUtils.degToRad(anglesB[1]),
        THREE.MathUtils.degToRad(anglesB[2]),
        'XYZ'
      );
      _qPoseB.setFromEuler(_eulerB);
      slerpWithOvershoot(_qDeltaChar, _qPoseA, _qPoseB, alpha);
      _qDeltaLocal
        .copy(cap.parentCharQuatInv)
        .multiply(_qDeltaChar)
        .multiply(cap.parentCharQuat);
      cap.node.quaternion.copy(_qDeltaLocal).multiply(cap.restQuat);
    }

    const hipsY = THREE.MathUtils.lerp(keyA.hipsOffsetY ?? 0, keyB.hipsOffsetY ?? 0, alpha);
    if (Math.abs(hipsY) > 0.0005) {
      const hipsName =
        this.settings.boneMap.hips ??
        this.resolvePresetBoneTarget('hips')?.node.name;
      const hipsCap = hipsName ? this.allBones.get(hipsName) : undefined;
      if (hipsCap) {
        const targetRef = this.getHipsHeightRef();
        const scaleRatio =
          preset.hipsHeightRef && preset.hipsHeightRef > 0.05
            ? THREE.MathUtils.clamp(targetRef / preset.hipsHeightRef, 0.35, 2.8)
            : 1;
        const scaledY = hipsY * scaleRatio;
        const minAllowY = preset.slot === 'dying' || preset.slot === 'sleep' || preset.slot === 'knockdown'
          ? 0.04
          : Math.max(0.06, hipsCap.restPos.y * 0.12);
        hipsCap.node.position.y = Math.max(minAllowY, hipsCap.restPos.y + scaledY);
      }
    }
    if (preset.slot === 'idle' && Math.abs(hipsY) < 0.05) {
      this.pinFeetToGround();
    }
  }

  /**
   * Captures the character's current live bone rotations back into a serializable BonePoseAngles map.
   * Works whether the character is currently driven by an embedded clip or procedural animation!
   */
  public captureCurrentCharSpacePose(): {
    bones: Record<string, BonePoseAngles>;
    hipsOffsetY: number;
  } {
    const bones: Record<string, BonePoseAngles> = {};
    this.allBones.forEach((cap, name) => {
      _qDeltaLocal.copy(cap.node.quaternion).multiply(cap.restQuatInv);
      _qDeltaChar
        .copy(cap.parentCharQuat)
        .multiply(_qDeltaLocal)
        .multiply(cap.parentCharQuatInv);
      _euler.setFromQuaternion(_qDeltaChar, 'XYZ');
      const rx = roundHalfDeg(THREE.MathUtils.radToDeg(_euler.x));
      const ry = roundHalfDeg(THREE.MathUtils.radToDeg(_euler.y));
      const rz = roundHalfDeg(THREE.MathUtils.radToDeg(_euler.z));
      if (Math.abs(rx) >= 0.5 || Math.abs(ry) >= 0.5 || Math.abs(rz) >= 0.5) {
        bones[name] = [rx, ry, rz];
      }
    });

    let hipsOffsetY = 0;
    const hipsName = this.settings.boneMap.hips;
    const hipsCap = hipsName ? this.allBones.get(hipsName) : undefined;
    if (hipsCap) {
      hipsOffsetY = Math.round((hipsCap.node.position.y - hipsCap.restPos.y) * 1000) / 1000;
    }
    return { bones, hipsOffsetY };
  }

  /**
   * Computes world-space position & orientation for a 3D rotation gizmo attached to a bone.
   */
  public getBoneGizmoWorldTransform(
    boneName: string,
    angles: BonePoseAngles,
    outPos: THREE.Vector3,
    outQuat: THREE.Quaternion
  ): boolean {
    const cap = this.allBones.get(boneName);
    if (!cap) return false;
    this.charRoot.updateWorldMatrix(true, true);
    cap.node.getWorldPosition(outPos);
    this.charRoot.getWorldQuaternion(_qRootWorld);
    _euler.set(
      THREE.MathUtils.degToRad(angles[0]),
      THREE.MathUtils.degToRad(angles[1]),
      THREE.MathUtils.degToRad(angles[2]),
      'XYZ'
    );
    _qDeltaChar.setFromEuler(_euler);
    outQuat.copy(_qRootWorld).multiply(_qDeltaChar);
    return true;
  }

  /**
   * Converts a 3D rotation gizmo's world quaternion back into character-space [rxDeg, ryDeg, rzDeg].
   */
  public computeAnglesFromGizmoWorldQuat(gizmoWorldQuat: THREE.Quaternion): BonePoseAngles {
    this.charRoot.updateWorldMatrix(true, false);
    this.charRoot.getWorldQuaternion(_qRootWorld);
    _qRootInv.copy(_qRootWorld).invert();
    _qDeltaChar.copy(_qRootInv).multiply(gizmoWorldQuat);
    _euler.setFromQuaternion(_qDeltaChar, 'XYZ');
    return [
      THREE.MathUtils.clamp(roundHalfDeg(THREE.MathUtils.radToDeg(_euler.x)), -175, 175),
      THREE.MathUtils.clamp(roundHalfDeg(THREE.MathUtils.radToDeg(_euler.y)), -175, 175),
      THREE.MathUtils.clamp(roundHalfDeg(THREE.MathUtils.radToDeg(_euler.z)), -175, 175),
    ];
  }

  /**
   * Finds the nearest riggable bone to a 3D world-space hit point (e.g. clicking directly on the mesh).
   */
  public findNearestBoneToWorldPoint(worldPoint: THREE.Vector3, maxDistance = 0.55): string | null {
    this.charRoot.updateWorldMatrix(true, true);
    let bestName: string | null = null;
    let bestDistSq = maxDistance * maxDistance;

    // Prefer major body bones over tiny finger/end-tip bones if nearly equidistant
    this.allBones.forEach((cap, name) => {
      if (/end|tip|leaf|thumb|index|middle|ring|pinky|toe|eye|jaw|hair/i.test(name)) return;
      cap.node.getWorldPosition(_bonePosA);
      const dSq = _bonePosA.distanceToSquared(worldPoint);
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestName = name;
      }
    });

    if (bestName) return bestName;

    // Fallback: include all bones
    this.allBones.forEach((cap, name) => {
      cap.node.getWorldPosition(_bonePosA);
      const dSq = _bonePosA.distanceToSquared(worldPoint);
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestName = name;
      }
    });
    return bestName;
  }

  /**
   * Computes world-space bone segment pairs and joint coordinates for an arbitrary pose snapshot
   * (used to render the 3D Start-Pose Ghost Skeleton loop guide without disturbing the live pose).
   */
  public computePoseSkeletonSegments(
    bones: Record<string, BonePoseAngles>,
    hipsOffsetY = 0
  ): { linePositions: number[]; jointPositions: number[] } {
    // Save live transforms
    const saved = new Map<string, { q: THREE.Quaternion; p: THREE.Vector3 }>();
    this.allBones.forEach((cap, name) => {
      saved.set(name, {
        q: cap.node.quaternion.clone(),
        p: cap.node.position.clone(),
      });
    });

    // Apply reference pose and compute world positions
    this.applyPoseSnapshot(bones, hipsOffsetY);
    this.charRoot.updateWorldMatrix(true, true);

    const linePositions: number[] = [];
    const jointPositions: number[] = [];

    this.allBones.forEach((cap, name) => {
      if (/thumb|index|middle|ring|pinky|eye|hair|jaw/i.test(name)) return;
      cap.node.getWorldPosition(_bonePosA);
      jointPositions.push(_bonePosA.x, _bonePosA.y, _bonePosA.z);
      if (cap.node.parent && this.allBones.has(cap.node.parent.name)) {
        cap.node.parent.getWorldPosition(_bonePosB);
        linePositions.push(
          _bonePosB.x,
          _bonePosB.y,
          _bonePosB.z,
          _bonePosA.x,
          _bonePosA.y,
          _bonePosA.z
        );
      }
    });

    // Restore live transforms immediately
    this.allBones.forEach((cap, name) => {
      const s = saved.get(name);
      if (s) {
        cap.node.quaternion.copy(s.q);
        cap.node.position.copy(s.p);
      }
    });
    this.charRoot.updateWorldMatrix(true, true);

    return { linePositions, jointPositions };
  }

  /**
   * Applies a character-space delta rotation (pitchX = forward/back, yawY = turn, rollZ = side raise/lower)
   * onto a captured bone's bind pose in a way that works regardless of Blender/Mixamo/Tripo bone roll!
   */
  private applyCharSpacePose(
    role: RigBoneRole,
    pitchX: number,
    yawY: number,
    rollZ: number,
    isRightSide = false
  ) {
    const boneName = this.settings.boneMap[role];
    if (!boneName) return;
    const cap = this.allBones.get(boneName);
    if (!cap) return;

    const swingAxis = this.settings.limbSwingAxis;
    const roleInvert = this.settings.invertedRoles?.[role] ? -1 : 1;
    const mirrorSwing = (this.settings.mirrorLimbSwing && isRightSide ? -1 : 1) * roleInvert;

    if (swingAxis === 'auto') {
      // Build character-space delta quaternion: pitch around +X, yaw around +Y, roll around +Z
      _qDeltaChar.identity();
      if (Math.abs(rollZ) > 0.0001) {
        _qStep.setFromAxisAngle(CHAR_Z, rollZ * roleInvert);
        _qDeltaChar.premultiply(_qStep);
      }
      if (Math.abs(pitchX) > 0.0001) {
        _qStep.setFromAxisAngle(CHAR_X, pitchX * mirrorSwing);
        _qDeltaChar.premultiply(_qStep);
      }
      if (Math.abs(yawY) > 0.0001) {
        _qStep.setFromAxisAngle(CHAR_Y, yawY);
        _qDeltaChar.premultiply(_qStep);
      }

      // Convert character-space delta into parent-local delta: parentInv * Q_char * parent
      _qDeltaLocal
        .copy(cap.parentCharQuatInv)
        .multiply(_qDeltaChar)
        .multiply(cap.parentCharQuat);

      cap.node.quaternion.copy(_qDeltaLocal).multiply(cap.restQuat);
    } else {
      // Explicit local-axis override mode for exotic rigs
      axisFromSetting(swingAxis, _axisVec);
      _qDeltaLocal.setFromAxisAngle(_axisVec, pitchX * mirrorSwing);
      if (Math.abs(rollZ) > 0.0001) {
        // Orthogonal roll axis relative to chosen swing axis
        const alt = swingAxis.includes('z') ? CHAR_X : CHAR_Z;
        _qStep.setFromAxisAngle(alt, rollZ);
        _qDeltaLocal.multiply(_qStep);
      }
      if (Math.abs(yawY) > 0.0001) {
        _qStep.setFromAxisAngle(CHAR_Y, yawY);
        _qDeltaLocal.multiply(_qStep);
      }
      cap.node.quaternion.copy(cap.restQuat).multiply(_qDeltaLocal);
    }
  }

  /**
   * Applies a character-space delta onto a child bone (such as lower arm) using its parent's
   * LIVE animated orientation so elbow bends work cleanly regardless of upper-arm twist/relaxation.
   */
  private applyCharSpacePoseLiveParent(
    role: RigBoneRole,
    pitchX: number,
    yawY: number,
    rollZ: number,
    isRightSide = false
  ) {
    if (this.settings.limbSwingAxis !== 'auto') {
      this.applyCharSpacePose(role, pitchX, yawY, rollZ, isRightSide);
      return;
    }
    const boneName = this.settings.boneMap[role];
    if (!boneName) return;
    const cap = this.allBones.get(boneName);
    if (!cap) return;

    this.charRoot.updateWorldMatrix(true, false);
    this.charRoot.getWorldQuaternion(_qRootWorld);
    _qRootInv.copy(_qRootWorld).invert();

    if (cap.node.parent) {
      cap.node.parent.updateWorldMatrix(true, false);
      cap.node.parent.getWorldQuaternion(_qParentLive);
      _qParentLive.premultiply(_qRootInv);
    } else {
      _qParentLive.identity();
    }
    _qParentLiveInv.copy(_qParentLive).invert();

    const roleInvert = this.settings.invertedRoles?.[role] ? -1 : 1;
    _qDeltaChar.identity();
    if (Math.abs(rollZ) > 0.0001) {
      _qStep.setFromAxisAngle(CHAR_Z, rollZ * roleInvert);
      _qDeltaChar.premultiply(_qStep);
    }
    if (Math.abs(pitchX) > 0.0001) {
      _qStep.setFromAxisAngle(CHAR_X, pitchX * roleInvert);
      _qDeltaChar.premultiply(_qStep);
    }
    if (Math.abs(yawY) > 0.0001) {
      _qStep.setFromAxisAngle(CHAR_Y, yawY);
      _qDeltaChar.premultiply(_qStep);
    }

    _qDeltaLocal
      .copy(_qParentLiveInv)
      .multiply(_qDeltaChar)
      .multiply(_qParentLive);

    cap.node.quaternion.copy(_qDeltaLocal).multiply(cap.restQuat);
  }

  private getArmRelaxRoll(
    role: 'leftUpperArm' | 'rightUpperArm',
    slot: CustomClipSlot,
    extraSpreadDeg = 0
  ): number {
    const activeSpreadDeg =
      slot === 'idle'
        ? (this.settings.idleArmSpreadAngle ?? 0)
        : (this.settings.armSpreadAngle ?? 0);
    const netLowerDeg = this.settings.armRelaxAngle - activeSpreadDeg - extraSpreadDeg;
    if (Math.abs(netLowerDeg) < 0.25) return 0;
    const rad = THREE.MathUtils.degToRad(netLowerDeg);
    const boneName = this.settings.boneMap[role];
    const cap = boneName ? this.allBones.get(boneName) : undefined;
    // Lower arm toward hips based on its character-space X side (+X lowers via -Z, -X lowers via +Z)
    const naturalSign = cap && Math.abs(cap.charPosX) > 0.01 ? -Math.sign(cap.charPosX) : role === 'leftUpperArm' ? -1 : 1;
    if (!this.settings.mirrorArmRelax && role === 'rightUpperArm') {
      return -naturalSign * rad;
    }
    return naturalSign * rad;
  }

  /**
   * Applies additive upper-arm clearance on top of embedded AnimationMixer clips,
   * using idleArmSpreadAngle when Idle and armSpreadAngle when Walking/Moving.
   */
  public applyPostClipAdjustments(slot: CustomClipSlot = 'walk') {
    const spreadDeg =
      slot === 'idle'
        ? (this.settings.idleArmSpreadAngle ?? 0)
        : (this.settings.armSpreadAngle ?? 0);
    const roles: ('leftUpperArm' | 'rightUpperArm')[] = ['leftUpperArm', 'rightUpperArm'];

    // Restore prior base quaternion first if mixer did not overwrite the bone (e.g. paused or no arm track)
    const restoreIfUnchanged = (cap: CapturedBone) => {
      if (cap.hasPostClipQuat) {
        const dot = Math.abs(cap.node.quaternion.dot(cap.postClipQuat));
        if (dot > 0.999995) {
          cap.node.quaternion.copy(cap.prePostClipQuat);
        }
        cap.hasPostClipQuat = false;
      }
    };

    if (Math.abs(spreadDeg) < 0.25) {
      for (const role of roles) {
        const boneName = this.settings.boneMap[role];
        const cap = boneName ? this.allBones.get(boneName) : undefined;
        if (cap) restoreIfUnchanged(cap);
      }
      return;
    }

    const spreadRad = THREE.MathUtils.degToRad(spreadDeg);
    this.charRoot.updateWorldMatrix(true, false);
    this.charRoot.getWorldQuaternion(_qRootWorld);
    _qRootInv.copy(_qRootWorld).invert();

    for (const role of roles) {
      const boneName = this.settings.boneMap[role];
      if (!boneName) continue;
      const cap = this.allBones.get(boneName);
      if (!cap) continue;

      restoreIfUnchanged(cap);
      cap.prePostClipQuat.copy(cap.node.quaternion);

      if (cap.node.parent) {
        cap.node.parent.updateWorldMatrix(true, false);
        cap.node.parent.getWorldQuaternion(_qParentLive);
        _qParentLive.premultiply(_qRootInv);
      } else {
        _qParentLive.identity();
      }
      _qParentLiveInv.copy(_qParentLive).invert();

      // Outward away from torso: +X side rotates +Z, -X side rotates -Z
      let outwardSign =
        Math.abs(cap.charPosX) > 0.01
          ? Math.sign(cap.charPosX)
          : role === 'leftUpperArm'
          ? 1
          : -1;
      if (!this.settings.mirrorArmRelax && role === 'rightUpperArm') {
        outwardSign = -outwardSign;
      }

      _qDeltaChar.setFromAxisAngle(CHAR_Z, outwardSign * spreadRad);
      _qDeltaLocal
        .copy(_qParentLiveInv)
        .multiply(_qDeltaChar)
        .multiply(_qParentLive);

      cap.node.quaternion.premultiply(_qDeltaLocal);
      cap.postClipQuat.copy(cap.node.quaternion);
      cap.hasPostClipQuat = true;
    }
  }

  public update(dt: number, slot: CustomClipSlot, speed = 1) {
    const rawClampedDt = Math.min(0.08, Math.max(0, dt));
    this.updateEyelidBlinks(rawClampedDt);
    if (this.allBones.size === 0) return;

    const clampedDt = rawClampedDt;
    const slotTuning = resolveSlotMotionTuning(this.settings, slot);
    const effectiveSpeed = Math.max(0.15, speed * slotTuning.speedMultiplier);
    this.elapsed += clampedDt * effectiveSpeed;

    if (slot !== this.lastSlot) {
      this.slotElapsed = 0;
      if (slot === 'attack' || slot === 'swing') {
        this.attackElapsed = 0;
      }
    }
    this.lastSlot = slot;
    this.slotElapsed += clampedDt * effectiveSpeed;
    if (slot === 'attack' || slot === 'swing') {
      this.attackElapsed += clampedDt * Math.max(0.25, speed * slotTuning.speedMultiplier);
    }

    // 0. Motion Editor Pose Snapshot (direct interactive joint posing)
    if (this.testOverride && this.testOverride.kind === 'poseSnapshot') {
      this.applyPoseSnapshot(this.testOverride.bones, this.testOverride.hipsOffsetY ?? 0);
      return;
    }

    // 0b. Motion Editor Keyframe Preset Preview (play or scrub timeline)
    if (this.testOverride && this.testOverride.kind === 'presetPreview') {
      const { preset, playing, playbackSpeed = 1 } = this.testOverride;
      const dur = Math.max(0.15, preset.duration);
      if (playing) {
        const safePlaybackSpeed = THREE.MathUtils.clamp(playbackSpeed, 0.25, 2.0);
        const deltaNorm = (clampedDt * Math.max(0.15, speed * safePlaybackSpeed)) / dur;
        if (preset.loop) {
          this.previewHoldElapsed = 0;
          this.previewTimeNorm = (this.previewTimeNorm + deltaNorm) % 1;
        } else if (this.previewTimeNorm >= 1) {
          // Brief beat on the end keyframe so one-shot moves (Jump, Attack, Dying) replay cleanly
          this.previewHoldElapsed += clampedDt;
          if (this.previewHoldElapsed >= 0.28) {
            this.previewHoldElapsed = 0;
            this.previewTimeNorm = 0;
          }
        } else {
          const nextNorm = this.previewTimeNorm + deltaNorm;
          if (nextNorm >= 1) {
            this.previewTimeNorm = 1;
            this.previewHoldElapsed = 0;
          } else {
            this.previewTimeNorm = nextNorm;
          }
        }
      } else {
        this.previewHoldElapsed = 0;
        this.previewTimeNorm = THREE.MathUtils.clamp(this.testOverride.timeNorm, 0, 1);
      }
      this.applyCustomPresetAtTime(preset, this.previewTimeNorm);
      return;
    }

    // Start from clean bind pose each frame so transitions & test switches never drift
    this.resetToRestPose();

    // 1. Direct manual bone posing in the Rig Inspector
    if (this.testOverride && this.testOverride.kind === 'manualBone') {
      const cap = this.allBones.get(this.testOverride.boneName);
      if (cap) {
        _euler.set(
          THREE.MathUtils.degToRad(this.testOverride.rxDeg),
          THREE.MathUtils.degToRad(this.testOverride.ryDeg),
          THREE.MathUtils.degToRad(this.testOverride.rzDeg),
          'XYZ'
        );
        _qDeltaLocal.setFromEuler(_euler);
        cap.node.quaternion.copy(cap.restQuat).multiply(_qDeltaLocal);
      }
      return;
    }

    // 1b. If no test override is active and this action slot has a saved Custom Default Preset, play it!
    if (!this.testOverride) {
      const customPreset = this.getDefaultPresetForSlot(slot);
      if (customPreset) {
        const dur = Math.max(0.15, customPreset.duration);
        const rawNorm = this.slotElapsed / dur;
        const tNorm = customPreset.loop ? rawNorm % 1 : Math.min(1, rawNorm);
        this.applyCustomPresetAtTime(customPreset, tNorm);
        this.smoothLiveBoneQuaternions(clampedDt, 18);
        return;
      }
    }

    const strength = THREE.MathUtils.clamp(this.settings.motionStrength, 0.2, 2.2);
    const headMult = THREE.MathUtils.clamp(this.settings.headMotion, 0, 2.2);
    const leftRelax = this.getArmRelaxRoll('leftUpperArm', slot, slotTuning.armSideOffsetDeg);
    const rightRelax = this.getArmRelaxRoll('rightUpperArm', slot, slotTuning.armSideOffsetDeg);

    // 2. Single-role Wiggle Test in the Rig Inspector
    if (this.testOverride && this.testOverride.kind === 'role') {
      const role = this.testOverride.role;
      const w = Math.sin(this.elapsed * 4.5);
      // Keep arms relaxed while testing other limbs
      if (role !== 'leftUpperArm') this.applyCharSpacePose('leftUpperArm', 0, 0, leftRelax, false);
      if (role !== 'rightUpperArm') this.applyCharSpacePose('rightUpperArm', 0, 0, rightRelax, true);

      if (role === 'head' || role === 'neck') {
        this.applyCharSpacePose(role, Math.sin(this.elapsed * 3.6) * 0.28, w * 0.52, Math.cos(this.elapsed * 2.5) * 0.14);
      } else if (role === 'leftShoulder' || role === 'rightShoulder') {
        const isR = role === 'rightShoulder';
        this.applyCharSpacePose(role, -w * 0.14, 0, (isR ? -1 : 1) * (0.14 + w * 0.22), isR);
      } else if (role === 'leftUpperArm' || role === 'rightUpperArm') {
        const isR = role === 'rightUpperArm';
        const relax = isR ? rightRelax : leftRelax;
        this.applyCharSpacePose(role, -w * 0.85, 0, relax * 0.75 + (isR ? 0.15 : -0.15) * Math.abs(w), isR);
      } else if (role === 'leftLowerArm' || role === 'rightLowerArm') {
        const isR = role === 'rightLowerArm';
        this.applyCharSpacePose(role, -Math.max(0, w) * 1.15 - 0.15, 0, 0, isR);
      } else if (role === 'leftHand' || role === 'rightHand') {
        const isR = role === 'rightHand';
        this.applyCharSpacePose(role, w * 0.45, 0, w * 0.22, isR);
      } else if (role === 'leftUpperLeg' || role === 'rightUpperLeg') {
        const isR = role === 'rightUpperLeg';
        this.applyCharSpacePose(role, -w * 0.72, 0, 0, isR);
      } else if (role === 'leftLowerLeg' || role === 'rightLowerLeg') {
        const isR = role === 'rightLowerLeg';
        this.applyCharSpacePose(role, Math.max(0, w) * 1.05, 0, 0, isR);
      } else if (role === 'leftFoot' || role === 'rightFoot') {
        const isR = role === 'rightFoot';
        this.applyCharSpacePose(role, w * 0.55, 0, 0, isR);
      } else {
        this.applyCharSpacePose(role, w * 0.22, Math.cos(this.elapsed * 3.2) * 0.28, w * 0.12);
      }
      return;
    }

    // 2b. Parachute Blanket Aerial Glide Pose (both arms reaching high overhead gripping corners)
    if (this.testOverride && this.testOverride.kind === 'glide') {
      const sway = this.testOverride.sway ?? 0;
      const bank = this.testOverride.steerBank ?? 0;
      const hover = Math.sin(this.elapsed * 3.4);
      this.applyCharSpacePose('hips', 0.08, 0, bank * 0.45);
      this.applyCharSpacePose('spine', 0.14 * strength, 0, bank * 0.3);
      this.applyCharSpacePose('chest', 0.1 * strength, 0, bank * 0.2);
      this.applyCharSpacePose('head', -0.22 * headMult, -bank * 0.35 * headMult, 0);

      // Reach both arms high above head and angled out to hold the two sail corners
      this.applyCharSpacePose(
        'leftUpperArm',
        -2.55 + hover * 0.04,
        0,
        leftRelax * 0.25 + 0.52,
        false
      );
      this.applyCharSpacePose(
        'rightUpperArm',
        -2.55 - hover * 0.04,
        0,
        rightRelax * 0.25 - 0.52,
        true
      );
      this.applyCharSpacePose('leftLowerArm', -0.24, 0, 0, false);
      this.applyCharSpacePose('rightLowerArm', -0.24, 0, 0, true);

      // Legs trail relaxed beneath the sail with gentle breeze sway
      this.applyCharSpacePose('leftUpperLeg', 0.22 + sway * 0.16, 0, -0.06, false);
      this.applyCharSpacePose('rightUpperLeg', 0.3 - sway * 0.16, 0, 0.06, true);
      this.applyCharSpacePose('leftLowerLeg', 0.38, 0, 0, false);
      this.applyCharSpacePose('rightLowerLeg', 0.48, 0, 0, true);
      this.smoothLiveBoneQuaternions(clampedDt, 14);
      return;
    }

    // 2c. Shield Guard Pose (left arm & forearm raised across chest holding off-hand shield forward)
    if (this.testOverride && this.testOverride.kind === 'block') {
      const spdN = THREE.MathUtils.clamp(this.testOverride.speedNorm ?? 0, 0, 1.2);
      const isLocomoting = spdN > 0.08;
      if (isLocomoting) {
        this.locoPhase = (this.locoPhase + clampedDt * 5.2 * Math.max(0.35, spdN)) % (Math.PI * 200);
      }
      const stride = isLocomoting ? Math.cos(this.locoPhase) * 0.44 * Math.min(1, spdN) : 0;
      const kneeL = isLocomoting ? Math.max(0.08, Math.sin(this.locoPhase) * 0.65) : 0.14;
      const kneeR = isLocomoting ? Math.max(0.08, -Math.sin(this.locoPhase) * 0.65) : 0.12;

      this.applyCharSpacePose('hips', 0.08, 0.2, 0);
      this.applyCharSpacePose('spine', 0.1, 0.18, 0);
      this.applyCharSpacePose('chest', 0.08, 0.16, 0);
      this.applyCharSpacePose('head', -0.05, -0.22 * headMult, 0);

      // Left arm raises forward & across chest with live-parent elbow bend so shield faces +Z in front
      this.applyCharSpacePose('leftUpperArm', -0.62, -0.65, leftRelax - 0.16, false);
      this.applyCharSpacePoseLiveParent('leftLowerArm', -0.96, -0.12, 0, false);
      // Right sword arm holds ready at hip
      this.applyCharSpacePose('rightUpperArm', -0.28 - stride * 0.25, -0.15, rightRelax, true);
      this.applyCharSpacePose('rightLowerArm', -0.45, 0, 0, true);

      this.applyCharSpacePose('leftUpperLeg', -stride - 0.08, 0, 0, false);
      this.applyCharSpacePose('rightUpperLeg', stride + 0.06, 0, 0, true);
      this.applyCharSpacePose('leftLowerLeg', kneeL, 0, 0, false);
      this.applyCharSpacePose('rightLowerLeg', kneeR, 0, 0, true);
      this.smoothLiveBoneQuaternions(clampedDt, 18);
      return;
    }

    // 3. Automated All-Limbs Cycle Test (Head -> Left Arm -> Right Arm -> Left Leg -> Right Leg)
    if (this.testOverride && this.testOverride.kind === 'limbCycle') {
      const stage = Math.floor(this.elapsed / 1.4) % 5;
      const localT = (this.elapsed % 1.4) / 1.4;
      const wave = Math.sin(localT * Math.PI * 2);

      this.applyCharSpacePose('leftUpperArm', 0, 0, leftRelax, false);
      this.applyCharSpacePose('rightUpperArm', 0, 0, rightRelax, true);

      if (stage === 0) {
        this.applyCharSpacePose('head', Math.sin(localT * Math.PI * 4) * 0.24, wave * 0.55, wave * 0.12);
        this.applyCharSpacePose('neck', 0, wave * 0.2, 0);
      } else if (stage === 1) {
        this.applyCharSpacePose('leftUpperArm', -wave * 0.85, 0, leftRelax * 0.55, false);
        this.applyCharSpacePose('leftLowerArm', -Math.abs(wave) * 0.8, 0, 0, false);
      } else if (stage === 2) {
        this.applyCharSpacePose('rightUpperArm', -wave * 0.85, 0, rightRelax * 0.55, true);
        this.applyCharSpacePose('rightLowerArm', -Math.abs(wave) * 0.8, 0, 0, true);
      } else if (stage === 3) {
        this.applyCharSpacePose('leftUpperLeg', -Math.max(-0.35, wave) * 0.72, 0, 0, false);
        this.applyCharSpacePose('leftLowerLeg', Math.max(0, wave) * 0.95, 0, 0, false);
      } else {
        this.applyCharSpacePose('rightUpperLeg', -Math.max(-0.35, wave) * 0.72, 0, 0, true);
        this.applyCharSpacePose('rightLowerLeg', Math.max(0, wave) * 0.95, 0, 0, true);
      }
      return;
    }

    // 4. Full Procedural Humanoid Animations for Gameplay & Preview
    const t = this.elapsed;

    if (slot === 'idle') {
      const breath = Math.sin(t * 2.0);
      const lookYaw = Math.sin(t * 0.85) * 0.16 * headMult;
      const lookPitch = Math.sin(t * 1.35 + 0.6) * 0.055 * headMult;
      const lookRoll = Math.sin(t * 0.65) * 0.04 * headMult;
      const leanBias = THREE.MathUtils.degToRad(slotTuning.torsoLean);
      const kneeSoft = THREE.MathUtils.clamp(slotTuning.kneeBend, 0.15, 1.85);
      const armSway = 0.032 * strength * slotTuning.armSwing;

      const hipsCap = this.settings.boneMap.hips ? this.allBones.get(this.settings.boneMap.hips) : undefined;
      if (hipsCap) {
        hipsCap.node.position.y = hipsCap.restPos.y;
      }

      this.applyCharSpacePose('hips', leanBias * 0.25, Math.sin(t * 0.95) * 0.03 * strength, 0);
      this.applyCharSpacePose(
        'spine',
        leanBias * 0.45 + breath * 0.028 * strength,
        0,
        Math.sin(t * 0.95) * 0.02 * strength
      );
      this.applyCharSpacePose('chest', leanBias * 0.3 + breath * 0.035 * strength, 0, 0);
      this.applyCharSpacePose('neck', (-leanBias * 0.35 + lookPitch * 0.35) * headMult, lookYaw * 0.35, 0);
      this.applyCharSpacePose('head', -leanBias * 0.45 * headMult + lookPitch, lookYaw, lookRoll);

      // Arms hang relaxed by character's sides with subtle natural breathing sway
      this.applyCharSpacePose('leftUpperArm', Math.sin(t * 1.85) * armSway, 0, leftRelax + breath * 0.02, false);
      this.applyCharSpacePose('rightUpperArm', -Math.sin(t * 1.85) * armSway, 0, rightRelax - breath * 0.02, true);
      this.applyCharSpacePose('leftLowerArm', -0.15 * strength, 0, 0, false);
      this.applyCharSpacePose('rightLowerArm', -0.15 * strength, 0, 0, true);

      this.runBlend = THREE.MathUtils.damp(this.runBlend, 0, 8, clampedDt);
      const strideBias = 0.03 * strength * slotTuning.strideLength;
      this.applyCharSpacePose('leftUpperLeg', -0.04 * kneeSoft * strength - strideBias, 0, 0, false);
      this.applyCharSpacePose('rightUpperLeg', -0.02 * kneeSoft * strength + strideBias, 0, 0, true);
      this.applyCharSpacePose('leftLowerLeg', 0.09 * kneeSoft * strength, 0, 0, false);
      this.applyCharSpacePose('rightLowerLeg', 0.06 * kneeSoft * strength, 0, 0, true);
      this.smoothLiveBoneQuaternions(clampedDt, 16);
      this.pinFeetToGround();
      return;
    }

    if (slot === 'walk' || slot === 'run') {
      const targetRun = slot === 'run' ? 1 : 0;
      this.runBlend = THREE.MathUtils.damp(this.runBlend, targetRun, 7.5, clampedDt);
      const rb = this.runBlend;

      const walkTuning = resolveSlotMotionTuning(this.settings, 'walk');
      const runTuning = resolveSlotMotionTuning(this.settings, 'run');
      const speedMult = THREE.MathUtils.lerp(walkTuning.speedMultiplier, runTuning.speedMultiplier, rb);
      const strideScale = THREE.MathUtils.lerp(walkTuning.strideLength, runTuning.strideLength, rb);
      const kneeScale = THREE.MathUtils.lerp(walkTuning.kneeBend, runTuning.kneeBend, rb);
      const armSwingScale = THREE.MathUtils.lerp(walkTuning.armSwing, runTuning.armSwing, rb);
      const armSideOffset = THREE.MathUtils.lerp(walkTuning.armSideOffsetDeg, runTuning.armSideOffsetDeg, rb);
      const bounceScale = THREE.MathUtils.lerp(walkTuning.bounce, runTuning.bounce, rb);
      const leanBiasDeg = THREE.MathUtils.lerp(walkTuning.torsoLean, runTuning.torsoLean, rb);

      const walkArmRelaxL = this.getArmRelaxRoll('leftUpperArm', slot, armSideOffset);
      const walkArmRelaxR = this.getArmRelaxRoll('rightUpperArm', slot, armSideOffset);

      // Grounded, calm natural walk frequency (4.8 rad/s -> ~1.53 steps/s) blending smoothly into run (7.8 rad/s)
      const freq = THREE.MathUtils.lerp(4.8, 7.8, rb);
      const safeSpeed = THREE.MathUtils.clamp(speed * speedMult, 0.2, 2.2);
      this.locoPhase = (this.locoPhase + clampedDt * freq * safeSpeed) % (Math.PI * 200);

      // Phase aligned to Reference Cycle:
      // phi = 0 -> CONTACT | 0.28*PI -> DOWN | 0.55*PI -> PASSING (stance) | 0.80*PI -> UP | 1.44*PI -> PASSING (swing knee peak)
      const phiL = this.locoPhase;
      const phiR = this.locoPhase + Math.PI;
      const swingSin = Math.cos(phiL); // +1 when Left leg is forward (Contact), -1 when Right leg is forward

      const legAmp = THREE.MathUtils.lerp(0.45, 0.65, rb) * strength * strideScale;
      const armAmp = THREE.MathUtils.lerp(0.24, 0.56, rb) * strength * armSwingScale;
      const kneeAmp = THREE.MathUtils.lerp(0.95, 1.22, rb) * strength * kneeScale;
      const lean = THREE.MathUtils.lerp(0.045, 0.13, rb) * strength + THREE.MathUtils.degToRad(leanBiasDeg);

      // Double-frequency hip bob: dips DOWN on Down (0.25*PI / 1.25*PI), rises UP on Up (0.75*PI / 1.75*PI)
      const hipsCap = this.settings.boneMap.hips ? this.allBones.get(this.settings.boneMap.hips) : undefined;
      if (hipsCap) {
        const refLen = Math.max(0.05, Math.min(1.5, Math.abs(hipsCap.restPos.y) || 0.8));
        const bobWave = -Math.sin(2 * phiL);
        const dipRatio = THREE.MathUtils.lerp(0.042, 0.06, rb);
        const riseRatio = THREE.MathUtils.lerp(0.022, 0.044, rb);
        const bounce = (bobWave < 0 ? bobWave * dipRatio : bobWave * riseRatio) * refLen * bounceScale * strength;
        hipsCap.node.position.y = hipsCap.restPos.y + bounce;
      }

      this.applyCharSpacePose(
        'hips',
        lean * 0.25,
        -swingSin * THREE.MathUtils.lerp(0.065, 0.1, rb) * strength,
        swingSin * THREE.MathUtils.lerp(0.032, 0.042, rb) * strength
      );
      this.applyCharSpacePose(
        'spine',
        lean * 0.48,
        swingSin * THREE.MathUtils.lerp(0.07, 0.11, rb) * strength,
        -swingSin * 0.024 * strength
      );
      this.applyCharSpacePose(
        'chest',
        lean * 0.32,
        swingSin * THREE.MathUtils.lerp(0.055, 0.09, rb) * strength,
        0
      );
      this.applyCharSpacePose('neck', -lean * 0.35 * headMult, -swingSin * 0.045 * headMult, 0);
      this.applyCharSpacePose(
        'head',
        (-lean * 0.42 - Math.sin(phiL * 2) * 0.022) * headMult,
        -swingSin * 0.055 * headMult,
        0
      );

      // Compute symmetric Contact -> Down -> Passing -> Up thigh & knee angles
      const evalLeg = (phi: number) => {
        const thigh = -Math.cos(phi) * legAmp - 0.025 * legAmp;
        // Stance weight-absorption bend around Down (~0.28*PI)
        const stanceDown = Math.pow(Math.max(0, Math.cos(phi - 0.28 * Math.PI)), 2.6);
        // Swing knee flexion peaking cleanly at Passing (~1.44*PI) as leg bends to clear the floor
        const swingPass = Math.pow(Math.max(0, Math.cos(phi - 1.44 * Math.PI)), 1.65);
        const baseKnee = THREE.MathUtils.lerp(0.05, 0.14, rb);
        const stanceAmp = THREE.MathUtils.lerp(0.42, 0.52, rb);
        const swingPassAmp = THREE.MathUtils.lerp(0.95, 1.24, rb);
        const knee = (baseKnee + stanceDown * stanceAmp + swingPass * swingPassAmp) * kneeAmp;
        return { thigh, knee };
      };

      const leftLeg = evalLeg(phiL);
      const rightLeg = evalLeg(phiR);
      this.applyCharSpacePose('leftUpperLeg', leftLeg.thigh, 0, 0, false);
      this.applyCharSpacePose('rightUpperLeg', rightLeg.thigh, 0, 0, true);
      this.applyCharSpacePose('leftLowerLeg', leftLeg.knee, 0, 0, false);
      this.applyCharSpacePose('rightLowerLeg', rightLeg.knee, 0, 0, true);

      // Arms rest comfortably by character's sides and counter-swing gently opposite legs
      this.applyCharSpacePose('leftUpperArm', swingSin * armAmp, 0, walkArmRelaxL, false);
      this.applyCharSpacePose('rightUpperArm', -swingSin * armAmp, 0, walkArmRelaxR, true);

      const elbowBase = THREE.MathUtils.lerp(0.18, 0.58, rb) * strength;
      const elbowSwing = THREE.MathUtils.lerp(0.16, 0.34, rb) * strength * THREE.MathUtils.clamp(armSwingScale, 0.2, 1.6);
      const leftElbow = -elbowBase - Math.max(0, -swingSin) * elbowSwing;
      const rightElbow = -elbowBase - Math.max(0, swingSin) * elbowSwing;
      this.applyCharSpacePose('leftLowerArm', leftElbow, 0, 0, false);
      this.applyCharSpacePose('rightLowerArm', rightElbow, 0, 0, true);

      this.smoothLiveBoneQuaternions(clampedDt, 16);
      return;
    }

    // Smoothly decay runBlend when not walking/running
    this.runBlend = THREE.MathUtils.damp(this.runBlend, 0, 8, clampedDt);

    if (slot === 'jump') {
      const hover = Math.sin(t * 4.5);
      const kneeScale = slotTuning.kneeBend;
      const armScale = slotTuning.armSwing;
      const leanBias = THREE.MathUtils.degToRad(slotTuning.torsoLean);
      this.applyCharSpacePose('spine', (-0.08 * strength) + leanBias * 0.5, 0, 0);
      this.applyCharSpacePose('chest', (-0.06 * strength) + leanBias * 0.4, 0, 0);
      this.applyCharSpacePose('head', -0.14 * headMult, 0, 0);

      // Arms raised slightly outward/upward for balance
      this.applyCharSpacePose('leftUpperArm', -0.48 * strength * armScale, 0, leftRelax * 0.45 + hover * 0.08, false);
      this.applyCharSpacePose('rightUpperArm', -0.48 * strength * armScale, 0, rightRelax * 0.45 - hover * 0.08, true);
      this.applyCharSpacePose('leftLowerArm', -0.45 * strength, 0, 0, false);
      this.applyCharSpacePose('rightLowerArm', -0.45 * strength, 0, 0, true);

      // Knees tucked mid-air
      this.applyCharSpacePose('leftUpperLeg', -0.48 * strength * slotTuning.strideLength, 0, 0, false);
      this.applyCharSpacePose('rightUpperLeg', -0.26 * strength * slotTuning.strideLength, 0, 0, true);
      this.applyCharSpacePose('leftLowerLeg', 0.85 * strength * kneeScale, 0, 0, false);
      this.applyCharSpacePose('rightLowerLeg', 0.55 * strength * kneeScale, 0, 0, true);
      this.smoothLiveBoneQuaternions(clampedDt, 16);
      return;
    }

    if (slot === 'swim') {
      const stroke = Math.sin(t * 5.2);
      const strokeCos = Math.cos(t * 5.2);
      const kick = Math.sin(t * 10.4);
      const armScale = slotTuning.armSwing;
      const kneeScale = slotTuning.kneeBend;
      const leanBias = THREE.MathUtils.degToRad(slotTuning.torsoLean);

      this.applyCharSpacePose('spine', 0.22 * strength + leanBias * 0.5, stroke * 0.16 * strength, 0);
      this.applyCharSpacePose('chest', 0.15 * strength + leanBias * 0.4, stroke * 0.14 * strength, 0);
      this.applyCharSpacePose('head', -0.34 * headMult, stroke * 0.12 * headMult, 0);

      // Alternating sweeping swim strokes
      this.applyCharSpacePose('leftUpperArm', (-0.85 + stroke * 0.72 * armScale) * strength, 0, leftRelax * 0.4 + strokeCos * 0.28, false);
      this.applyCharSpacePose('rightUpperArm', (-0.85 - stroke * 0.72 * armScale) * strength, 0, rightRelax * 0.4 - strokeCos * 0.28, true);
      this.applyCharSpacePose('leftLowerArm', (-0.38 - Math.max(0, stroke) * 0.42) * strength, 0, 0, false);
      this.applyCharSpacePose('rightLowerArm', (-0.38 - Math.max(0, -stroke) * 0.42) * strength, 0, 0, true);

      // Flutter kick
      this.applyCharSpacePose('leftUpperLeg', (0.2 + kick * 0.38 * slotTuning.strideLength) * strength, 0, 0, false);
      this.applyCharSpacePose('rightUpperLeg', (0.2 - kick * 0.38 * slotTuning.strideLength) * strength, 0, 0, true);
      this.applyCharSpacePose('leftLowerLeg', (0.24 + Math.max(0, kick) * 0.32) * strength * kneeScale, 0, 0, false);
      this.applyCharSpacePose('rightLowerLeg', (0.24 + Math.max(0, -kick) * 0.32) * strength * kneeScale, 0, 0, true);
      this.smoothLiveBoneQuaternions(clampedDt, 16);
      return;
    }

    if (slot === 'attack' || slot === 'swing') {
      // Forehand right-hand swing: wind back outward to the right with elbow bent back -> swing inward -> recover
      const cycle = (this.attackElapsed % 0.48) / 0.48;
      const armScale = slotTuning.armSwing;
      const kneeScale = slotTuning.kneeBend;
      const leanBias = THREE.MathUtils.degToRad(slotTuning.torsoLean);

      let torsoYaw = 0;
      let torsoPitch = 0;
      let rArmPitch = 0;
      let rArmYaw = 0;
      let rArmRollOffset = 0;
      let rElbowPitch = -0.18;
      let rElbowRoll = 0;
      let lArmPitch = 0;
      let lArmRollOffset = 0;

      if (cycle < 0.30) {
        // Phase 1: Backswing outward to the right, bending back at the elbow joint
        const w = Math.sin((cycle / 0.30) * Math.PI * 0.5);
        torsoYaw = -0.44 * w;
        torsoPitch = -0.08 * w;
        rArmPitch = 0.34 * w;
        rArmYaw = -0.74 * w;
        rArmRollOffset = -1.16 * w;
        rElbowPitch = THREE.MathUtils.lerp(-0.18, 0.94, w);
        rElbowRoll = -0.36 * w;
        lArmPitch = -0.22 * w;
        lArmRollOffset = 0.22 * w;
      } else if (cycle < 0.68) {
        // Phase 2: Drive torso & right arm forward and inward across the front
        const s = (cycle - 0.30) / 0.38;
        const ease = 1 - Math.pow(1 - s, 2.8);
        torsoYaw = THREE.MathUtils.lerp(-0.44, 0.56, ease);
        torsoPitch = THREE.MathUtils.lerp(-0.08, 0.22, ease);
        rArmPitch = THREE.MathUtils.lerp(0.34, -1.08, ease);
        rArmYaw = THREE.MathUtils.lerp(-0.74, 1.18, ease);
        rArmRollOffset = THREE.MathUtils.lerp(-1.16, -0.46, ease);
        rElbowPitch =
          s < 0.45
            ? THREE.MathUtils.lerp(0.94, -0.24, s / 0.45)
            : THREE.MathUtils.lerp(-0.24, -0.68, (s - 0.45) / 0.55);
        rElbowRoll = THREE.MathUtils.lerp(-0.36, 0.28, ease);
        lArmPitch = THREE.MathUtils.lerp(-0.22, 0.38, ease);
        lArmRollOffset = THREE.MathUtils.lerp(0.22, 0.14, ease);
      } else {
        // Phase 3: Smooth recovery back to ready stance
        const r = (cycle - 0.68) / 0.32;
        const ease = r * r * (3 - 2 * r);
        torsoYaw = THREE.MathUtils.lerp(0.56, 0, ease);
        torsoPitch = THREE.MathUtils.lerp(0.22, 0, ease);
        rArmPitch = THREE.MathUtils.lerp(-1.08, 0, ease);
        rArmYaw = THREE.MathUtils.lerp(1.18, 0, ease);
        rArmRollOffset = THREE.MathUtils.lerp(-0.46, 0, ease);
        rElbowPitch = THREE.MathUtils.lerp(-0.68, -0.18, ease);
        rElbowRoll = THREE.MathUtils.lerp(0.28, 0, ease);
        lArmPitch = THREE.MathUtils.lerp(0.38, 0, ease);
        lArmRollOffset = THREE.MathUtils.lerp(0.14, 0, ease);
      }

      this.applyCharSpacePose('spine', torsoPitch * 0.6 * strength + leanBias * 0.5, torsoYaw * 0.55 * strength, 0);
      this.applyCharSpacePose('chest', torsoPitch * 0.45 * strength + leanBias * 0.4, torsoYaw * 0.45 * strength, 0);
      this.applyCharSpacePose('head', -torsoPitch * 0.25 * headMult, -torsoYaw * 0.65 * headMult, 0);

      this.applyCharSpacePose(
        'rightUpperArm',
        rArmPitch * strength * armScale,
        rArmYaw * strength,
        rightRelax + rArmRollOffset * strength * armScale,
        true
      );
      this.applyCharSpacePose(
        'rightLowerArm',
        rElbowPitch * strength,
        0,
        rElbowRoll * strength * armScale,
        true
      );

      // Left arm braces outward/back for balance
      this.applyCharSpacePose(
        'leftUpperArm',
        lArmPitch * strength * armScale,
        0,
        leftRelax + lArmRollOffset * strength,
        false
      );
      this.applyCharSpacePose('leftLowerArm', -0.45 * strength, 0, 0, false);

      // Athletic split stance
      this.applyCharSpacePose('leftUpperLeg', -0.24 * strength * slotTuning.strideLength, 0, 0, false);
      this.applyCharSpacePose('leftLowerLeg', 0.28 * strength * kneeScale, 0, 0, false);
      this.applyCharSpacePose('rightUpperLeg', 0.22 * strength * slotTuning.strideLength, 0, 0, true);
      this.applyCharSpacePose('rightLowerLeg', 0.24 * strength * kneeScale, 0, 0, true);
      this.smoothLiveBoneQuaternions(clampedDt, 24);
      return;
    }

    if (slot === 'sit') {
      const breath = Math.sin(t * 1.8);
      const lookYaw = Math.sin(t * 0.65) * 0.14 * headMult;
      const kneeScale = THREE.MathUtils.clamp(slotTuning.kneeBend, 0.4, 1.5);
      const hipsCap = this.settings.boneMap.hips ? this.allBones.get(this.settings.boneMap.hips) : undefined;
      if (hipsCap) {
        const refLen = Math.max(0.05, Math.abs(hipsCap.restPos.y) || 0.8);
        hipsCap.node.position.y = hipsCap.restPos.y - 0.8 * refLen;
      }
      this.applyCharSpacePose('hips', -0.06, 0, 0);
      this.applyCharSpacePose('spine', 0.08 + breath * 0.02, 0, 0);
      this.applyCharSpacePose('chest', 0.06 + breath * 0.025, 0, 0);
      this.applyCharSpacePose('head', -0.04 * headMult, lookYaw, 0);
      this.applyCharSpacePose('leftUpperLeg', -1.32 * strength, 0, -0.09, false);
      this.applyCharSpacePose('rightUpperLeg', -1.32 * strength, 0, 0.09, true);
      this.applyCharSpacePose('leftLowerLeg', 1.44 * kneeScale * strength, 0, 0, false);
      this.applyCharSpacePose('rightLowerLeg', 1.44 * kneeScale * strength, 0, 0, true);
      this.applyCharSpacePose('leftUpperArm', -0.42 * strength, 0, leftRelax * 0.85, false);
      this.applyCharSpacePose('rightUpperArm', -0.42 * strength, 0, rightRelax * 0.85, true);
      this.applyCharSpacePose('leftLowerArm', -0.62 * strength, 0, 0, false);
      this.applyCharSpacePose('rightLowerArm', -0.62 * strength, 0, 0, true);
      this.smoothLiveBoneQuaternions(clampedDt, 16);
      return;
    }

    if (slot === 'sleep') {
      const breath = Math.sin(t * 1.3);
      const hipsCap = this.settings.boneMap.hips ? this.allBones.get(this.settings.boneMap.hips) : undefined;
      if (hipsCap) {
        const refLen = Math.max(0.05, Math.min(1.5, Math.abs(hipsCap.restPos.y) || 0.8));
        hipsCap.node.position.y = hipsCap.restPos.y - 0.72 * refLen;
      }
      this.applyCharSpacePose('hips', -Math.PI * 0.48, 0, 0);
      this.applyCharSpacePose('spine', breath * 0.02, 0, 0);
      this.applyCharSpacePose('chest', breath * 0.03, 0, 0);
      this.applyCharSpacePose('head', 0.08 * headMult, 0.14 * headMult, 0.08 * headMult);
      this.applyCharSpacePose('leftUpperArm', -0.15, 0, leftRelax * 0.45, false);
      this.applyCharSpacePose('rightUpperArm', -0.15, 0, rightRelax * 0.45, true);
      this.applyCharSpacePose('leftLowerArm', -0.35, 0, 0, false);
      this.applyCharSpacePose('rightLowerArm', -0.35, 0, 0, true);
      this.applyCharSpacePose('leftUpperLeg', -0.08, 0, 0, false);
      this.applyCharSpacePose('rightUpperLeg', -0.12, 0, 0, true);
      this.applyCharSpacePose('leftLowerLeg', 0.12, 0, 0, false);
      this.applyCharSpacePose('rightLowerLeg', 0.16, 0, 0, true);
      this.smoothLiveBoneQuaternions(clampedDt, 14);
      return;
    }

    if (slot === 'climbVertical') {
      const cyc = t * 5.4;
      const reach = Math.sin(cyc);
      const reachCos = Math.cos(cyc);
      const armScale = slotTuning.armSwing;
      const kneeScale = slotTuning.kneeBend;
      this.applyCharSpacePose('hips', 0.06, reach * 0.09 * strength, 0);
      this.applyCharSpacePose('spine', 0.14 * strength, reach * 0.1 * strength, 0);
      this.applyCharSpacePose('chest', 0.1 * strength, reach * 0.08 * strength, 0);
      this.applyCharSpacePose('head', -0.36 * headMult, 0, 0);
      this.applyCharSpacePose('leftUpperArm', (-1.82 - reach * 0.62 * armScale) * strength, 0, leftRelax * 0.45, false);
      this.applyCharSpacePose('rightUpperArm', (-1.82 + reach * 0.62 * armScale) * strength, 0, rightRelax * 0.45, true);
      this.applyCharSpacePose('leftLowerArm', (-0.75 + reachCos * 0.35) * strength, 0, 0, false);
      this.applyCharSpacePose('rightLowerArm', (-0.75 - reachCos * 0.35) * strength, 0, 0, true);
      this.applyCharSpacePose('leftUpperLeg', (-0.78 + reach * 0.45) * strength, 0, 0, false);
      this.applyCharSpacePose('rightUpperLeg', (-0.78 - reach * 0.45) * strength, 0, 0, true);
      this.applyCharSpacePose('leftLowerLeg', (1.12 - reach * 0.52) * strength * kneeScale, 0, 0, false);
      this.applyCharSpacePose('rightLowerLeg', (1.12 + reach * 0.52) * strength * kneeScale, 0, 0, true);
      this.smoothLiveBoneQuaternions(clampedDt, 18);
      return;
    }

    if (slot === 'climbStairs') {
      const cyc = t * 6.4;
      const s = Math.sin(cyc);
      const c = Math.cos(cyc);
      const armScale = slotTuning.armSwing;
      const kneeScale = slotTuning.kneeBend;
      this.applyCharSpacePose('spine', 0.18 * strength, s * 0.07 * strength, 0);
      this.applyCharSpacePose('chest', 0.12 * strength, s * 0.06 * strength, 0);
      this.applyCharSpacePose('head', -0.14 * headMult, 0, 0);
      this.applyCharSpacePose('leftUpperLeg', (-0.52 + s * 0.54) * strength, 0, 0, false);
      this.applyCharSpacePose('rightUpperLeg', (-0.52 - s * 0.54) * strength, 0, 0, true);
      this.applyCharSpacePose('leftLowerLeg', (0.78 + Math.max(0, -s) * 0.65) * strength * kneeScale, 0, 0, false);
      this.applyCharSpacePose('rightLowerLeg', (0.78 + Math.max(0, s) * 0.65) * strength * kneeScale, 0, 0, true);
      this.applyCharSpacePose('leftUpperArm', -s * 0.42 * armScale * strength, 0, leftRelax, false);
      this.applyCharSpacePose('rightUpperArm', s * 0.42 * armScale * strength, 0, rightRelax, true);
      this.applyCharSpacePose('leftLowerArm', (-0.36 - Math.max(0, c) * 0.25) * strength, 0, 0, false);
      this.applyCharSpacePose('rightLowerArm', (-0.36 - Math.max(0, -c) * 0.25) * strength, 0, 0, true);
      this.smoothLiveBoneQuaternions(clampedDt, 18);
      return;
    }

    if (slot === 'crouch' || slot === 'sneak') {
      const isSneak = slot === 'sneak';
      const step = isSneak ? Math.sin(t * 4.2) : 0;
      const breath = Math.sin(t * 2.2) * 0.03;
      const hipsCap = this.settings.boneMap.hips ? this.allBones.get(this.settings.boneMap.hips) : undefined;
      if (hipsCap) {
        const refLen = Math.max(0.05, Math.min(1.5, Math.abs(hipsCap.restPos.y) || 0.8));
        hipsCap.node.position.y = hipsCap.restPos.y - (isSneak ? 0.24 : 0.28) * refLen;
      }
      this.applyCharSpacePose('spine', (isSneak ? 0.28 : 0.24) * strength + breath, step * 0.08, 0);
      this.applyCharSpacePose('chest', 0.16 * strength, step * 0.06, 0);
      this.applyCharSpacePose('head', -0.34 * headMult, Math.sin(t * 1.4) * 0.12 * headMult, 0);
      this.applyCharSpacePose('leftUpperLeg', (-0.82 + step * 0.36) * strength, 0, 0, false);
      this.applyCharSpacePose('rightUpperLeg', (-0.82 - step * 0.36) * strength, 0, 0, true);
      this.applyCharSpacePose('leftLowerLeg', (1.28 + Math.max(0, step) * 0.28) * strength, 0, 0, false);
      this.applyCharSpacePose('rightLowerLeg', (1.28 + Math.max(0, -step) * 0.28) * strength, 0, 0, true);
      this.applyCharSpacePose('leftUpperArm', (-0.28 - step * 0.25) * strength, 0, leftRelax * 1.1, false);
      this.applyCharSpacePose('rightUpperArm', (-0.28 + step * 0.25) * strength, 0, rightRelax * 1.1, true);
      this.applyCharSpacePose('leftLowerArm', -0.68 * strength, 0, 0, false);
      this.applyCharSpacePose('rightLowerArm', -0.68 * strength, 0, 0, true);
      this.smoothLiveBoneQuaternions(clampedDt, 16);
      return;
    }

    if (slot === 'hold') {
      const sway = Math.sin(t * 2.1) * 0.04;
      this.applyCharSpacePose('spine', 0.05 * strength, 0, 0);
      this.applyCharSpacePose('chest', 0.04 * strength, 0, 0);
      this.applyCharSpacePose('rightUpperArm', (-0.72 + sway) * strength, 0.15, rightRelax * 0.65, true);
      this.applyCharSpacePose('rightLowerArm', -0.82 * strength, 0, 0, true);
      this.applyCharSpacePose('leftUpperArm', sway * 0.5, 0, leftRelax, false);
      this.applyCharSpacePose('leftLowerArm', -0.22 * strength, 0, 0, false);
      this.smoothLiveBoneQuaternions(clampedDt, 16);
      return;
    }

    if (slot === 'throw') {
      const p = (this.slotElapsed % 0.85) / 0.85;
      if (p < 0.38) {
        const w = p / 0.38;
        this.applyCharSpacePose('spine', -0.1 * w, -0.45 * w, 0);
        this.applyCharSpacePose('rightUpperArm', -1.85 * w, -0.3 * w, rightRelax * 0.4 - 0.5 * w, true);
        this.applyCharSpacePose('rightLowerArm', -1.05 * w, 0, 0, true);
        this.applyCharSpacePose('leftUpperArm', -0.65 * w, 0.25 * w, leftRelax * 0.6, false);
      } else {
        const s = Math.min(1, (p - 0.38) / 0.34);
        this.applyCharSpacePose('spine', THREE.MathUtils.lerp(-0.1, 0.28, s), THREE.MathUtils.lerp(-0.45, 0.55, s), 0);
        this.applyCharSpacePose('rightUpperArm', THREE.MathUtils.lerp(-1.85, -0.42, s), THREE.MathUtils.lerp(-0.3, 0.45, s), rightRelax * 0.6, true);
        this.applyCharSpacePose('rightLowerArm', THREE.MathUtils.lerp(-1.05, -0.18, s), 0, 0, true);
        this.applyCharSpacePose('leftUpperArm', 0.25 * s, 0, leftRelax, false);
      }
      this.applyCharSpacePose('leftUpperLeg', -0.26 * strength, 0, 0, false);
      this.applyCharSpacePose('rightUpperLeg', 0.24 * strength, 0, 0, true);
      this.smoothLiveBoneQuaternions(clampedDt, 22);
      return;
    }

    if (slot === 'fishing') {
      const gentle = Math.sin(t * 2.0) * 0.05;
      this.applyCharSpacePose('spine', 0.06 * strength, 0.14 * strength, 0);
      this.applyCharSpacePose('chest', 0.04 * strength, 0.1 * strength, 0);
      this.applyCharSpacePose('head', -0.08 * headMult, 0.1 * headMult, 0);
      this.applyCharSpacePose('rightUpperArm', (-0.75 + gentle) * strength, 0.12, rightRelax * 0.5, true);
      this.applyCharSpacePose('rightLowerArm', -0.45 * strength, 0, 0, true);
      this.applyCharSpacePose('leftUpperArm', (-0.42 - gentle * 0.5) * strength, -0.2, leftRelax * 0.65, false);
      this.applyCharSpacePose('leftLowerArm', -0.58 * strength, 0, 0, false);
      this.applyCharSpacePose('leftUpperLeg', -0.15 * strength, 0, 0, false);
      this.applyCharSpacePose('rightUpperLeg', 0.15 * strength, 0, 0, true);
      this.smoothLiveBoneQuaternions(clampedDt, 16);
      return;
    }

    if (slot === 'lift') {
      const p = 0.5 + 0.5 * Math.sin(t * 2.6);
      const hipsCap = this.settings.boneMap.hips ? this.allBones.get(this.settings.boneMap.hips) : undefined;
      if (hipsCap) {
        const refLen = Math.max(0.05, Math.min(1.5, Math.abs(hipsCap.restPos.y) || 0.8));
        hipsCap.node.position.y = hipsCap.restPos.y - (1 - p) * 0.24 * refLen;
      }
      this.applyCharSpacePose('spine', THREE.MathUtils.lerp(0.36, -0.05, p) * strength, 0, 0);
      this.applyCharSpacePose('leftUpperArm', THREE.MathUtils.lerp(-0.95, -2.05, p) * strength, 0, leftRelax * 0.55, false);
      this.applyCharSpacePose('rightUpperArm', THREE.MathUtils.lerp(-0.95, -2.05, p) * strength, 0, rightRelax * 0.55, true);
      this.applyCharSpacePose('leftLowerArm', THREE.MathUtils.lerp(-0.4, -0.85, p) * strength, 0, 0, false);
      this.applyCharSpacePose('rightLowerArm', THREE.MathUtils.lerp(-0.4, -0.85, p) * strength, 0, 0, true);
      this.applyCharSpacePose('leftUpperLeg', THREE.MathUtils.lerp(-0.72, -0.12, p) * strength, 0, 0, false);
      this.applyCharSpacePose('rightUpperLeg', THREE.MathUtils.lerp(-0.72, -0.12, p) * strength, 0, 0, true);
      this.applyCharSpacePose('leftLowerLeg', THREE.MathUtils.lerp(1.05, 0.16, p) * strength, 0, 0, false);
      this.applyCharSpacePose('rightLowerLeg', THREE.MathUtils.lerp(1.05, 0.16, p) * strength, 0, 0, true);
      this.smoothLiveBoneQuaternions(clampedDt, 16);
      return;
    }

    if (slot === 'pull') {
      const tug = Math.sin(t * 3.8);
      this.applyCharSpacePose('spine', (-0.22 - tug * 0.14) * strength, 0, 0);
      this.applyCharSpacePose('chest', (-0.12 - tug * 0.08) * strength, 0, 0);
      this.applyCharSpacePose('leftUpperArm', (-1.05 + tug * 0.24) * strength, 0.15, leftRelax * 0.5, false);
      this.applyCharSpacePose('rightUpperArm', (-1.05 + tug * 0.24) * strength, -0.15, rightRelax * 0.5, true);
      this.applyCharSpacePose('leftLowerArm', (-0.82 - tug * 0.26) * strength, 0, 0, false);
      this.applyCharSpacePose('rightLowerArm', (-0.82 - tug * 0.26) * strength, 0, 0, true);
      this.applyCharSpacePose('leftUpperLeg', -0.45 * strength, 0, 0, false);
      this.applyCharSpacePose('rightUpperLeg', 0.26 * strength, 0, 0, true);
      this.applyCharSpacePose('leftLowerLeg', 0.55 * strength, 0, 0, false);
      this.applyCharSpacePose('rightLowerLeg', 0.32 * strength, 0, 0, true);
      this.smoothLiveBoneQuaternions(clampedDt, 16);
      return;
    }

    if (slot === 'push') {
      const shove = Math.sin(t * 4.4);
      this.applyCharSpacePose('spine', (0.34 + shove * 0.06) * strength, 0, 0);
      this.applyCharSpacePose('chest', (0.18 + shove * 0.04) * strength, 0, 0);
      this.applyCharSpacePose('head', -0.22 * headMult, 0, 0);
      this.applyCharSpacePose('leftUpperArm', (-1.42 - shove * 0.14) * strength, 0, leftRelax * 0.4, false);
      this.applyCharSpacePose('rightUpperArm', (-1.42 - shove * 0.14) * strength, 0, rightRelax * 0.4, true);
      this.applyCharSpacePose('leftLowerArm', -0.24 * strength, 0, 0, false);
      this.applyCharSpacePose('rightLowerArm', -0.24 * strength, 0, 0, true);
      this.applyCharSpacePose('leftUpperLeg', (-0.32 + shove * 0.28) * strength, 0, 0, false);
      this.applyCharSpacePose('rightUpperLeg', (0.38 - shove * 0.28) * strength, 0, 0, true);
      this.applyCharSpacePose('leftLowerLeg', 0.42 * strength, 0, 0, false);
      this.applyCharSpacePose('rightLowerLeg', 0.28 * strength, 0, 0, true);
      this.smoothLiveBoneQuaternions(clampedDt, 16);
      return;
    }

    if (slot === 'dig') {
      const cyc = (t * 1.15) % 1;
      const scoop = Math.sin(cyc * Math.PI * 2);
      this.applyCharSpacePose('spine', (0.28 + scoop * 0.26) * strength, scoop * 0.15, 0);
      this.applyCharSpacePose('chest', (0.16 + scoop * 0.14) * strength, scoop * 0.12, 0);
      this.applyCharSpacePose('head', (0.18 + scoop * 0.12) * headMult, 0, 0);
      this.applyCharSpacePose('rightUpperArm', (-0.85 + scoop * 0.45) * strength, 0.24, rightRelax * 0.55, true);
      this.applyCharSpacePose('leftUpperArm', (-1.05 + scoop * 0.35) * strength, -0.24, leftRelax * 0.55, false);
      this.applyCharSpacePose('rightLowerArm', (-0.65 - scoop * 0.2) * strength, 0, 0, true);
      this.applyCharSpacePose('leftLowerArm', (-0.52 - scoop * 0.2) * strength, 0, 0, false);
      this.applyCharSpacePose('leftUpperLeg', -0.34 * strength, 0, 0, false);
      this.applyCharSpacePose('rightUpperLeg', 0.24 * strength, 0, 0, true);
      this.applyCharSpacePose('leftLowerLeg', 0.46 * strength, 0, 0, false);
      this.smoothLiveBoneQuaternions(clampedDt, 18);
      return;
    }

    if (slot === 'stab') {
      const p = (this.slotElapsed % 0.62) / 0.62;
      const thrust = p < 0.28 ? -p / 0.28 : p < 0.6 ? (p - 0.28) / 0.32 : 1 - (p - 0.6) / 0.4;
      this.applyCharSpacePose('spine', 0.16 * thrust * strength, -0.32 * thrust * strength, 0);
      this.applyCharSpacePose('chest', 0.12 * thrust * strength, -0.22 * thrust * strength, 0);
      this.applyCharSpacePose('rightUpperArm', (-0.5 - thrust * 1.05) * strength, 0.1 * thrust, rightRelax * 0.45, true);
      this.applyCharSpacePose('rightLowerArm', (-0.95 + thrust * 0.85) * strength, 0, 0, true);
      this.applyCharSpacePose('leftUpperArm', -0.45 * strength, 0, leftRelax * 0.75, false);
      this.applyCharSpacePose('leftUpperLeg', (-0.22 - thrust * 0.34) * strength, 0, 0, false);
      this.applyCharSpacePose('rightUpperLeg', (0.22 + thrust * 0.32) * strength, 0, 0, true);
      this.applyCharSpacePose('leftLowerLeg', (0.3 + Math.max(0, thrust) * 0.42) * strength, 0, 0, false);
      this.smoothLiveBoneQuaternions(clampedDt, 24);
      return;
    }

    if (slot === 'bowPull') {
      const draw = 0.75 + Math.sin(t * 2.2) * 0.25;
      this.applyCharSpacePose('spine', 0.04 * strength, -0.42 * strength, 0);
      this.applyCharSpacePose('chest', 0.03 * strength, -0.28 * strength, 0);
      this.applyCharSpacePose('head', -0.04 * headMult, 0.56 * headMult, 0);
      this.applyCharSpacePose('leftUpperArm', -1.48 * strength, 0.55, leftRelax * 0.25, false);
      this.applyCharSpacePose('leftLowerArm', -0.12 * strength, 0, 0, false);
      this.applyCharSpacePose('rightUpperArm', -1.18 * strength, -0.42 * draw, rightRelax * 0.35 - 0.45, true);
      this.applyCharSpacePose('rightLowerArm', (-1.15 - 0.48 * draw) * strength, 0, 0, true);
      this.applyCharSpacePose('leftUpperLeg', -0.22 * strength, 0, 0, false);
      this.applyCharSpacePose('rightUpperLeg', 0.22 * strength, 0, 0, true);
      this.smoothLiveBoneQuaternions(clampedDt, 18);
      return;
    }

    if (slot === 'hug') {
      const squeeze = 0.5 + 0.5 * Math.sin(t * 2.8);
      this.applyCharSpacePose('spine', (0.16 + squeeze * 0.08) * strength, 0, 0);
      this.applyCharSpacePose('chest', (0.1 + squeeze * 0.05) * strength, 0, 0);
      this.applyCharSpacePose('head', 0.08 * headMult, 0.16 * headMult, 0.14 * headMult);
      this.applyCharSpacePose('leftUpperArm', (-1.18 - squeeze * 0.16) * strength, 0.45 + squeeze * 0.32, leftRelax * 0.45, false);
      this.applyCharSpacePose('rightUpperArm', (-1.18 - squeeze * 0.16) * strength, -0.45 - squeeze * 0.32, rightRelax * 0.45, true);
      this.applyCharSpacePose('leftLowerArm', (-0.88 - squeeze * 0.34) * strength, 0, 0, false);
      this.applyCharSpacePose('rightLowerArm', (-0.88 - squeeze * 0.34) * strength, 0, 0, true);
      this.smoothLiveBoneQuaternions(clampedDt, 16);
      return;
    }

    if (slot === 'punch') {
      const p = (this.slotElapsed % 0.68) / 0.68;
      let yaw = -0.35;
      let ext = 0;
      if (p < 0.25) {
        const w = p / 0.25;
        yaw = -0.42 * w;
        ext = -0.25 * w;
      } else if (p < 0.58) {
        const s = (p - 0.25) / 0.33;
        const ease = 1 - Math.pow(1 - s, 3);
        yaw = THREE.MathUtils.lerp(-0.42, 0.62, ease);
        ext = ease;
      } else {
        const r = (p - 0.58) / 0.42;
        yaw = THREE.MathUtils.lerp(0.62, 0, r);
        ext = 1 - r;
      }
      this.applyCharSpacePose('spine', 0.14 * ext * strength, yaw * 0.6 * strength, 0);
      this.applyCharSpacePose('chest', 0.08 * ext * strength, yaw * 0.45 * strength, 0);
      this.applyCharSpacePose('head', 0, -yaw * 0.55 * headMult, 0);
      this.applyCharSpacePose('rightUpperArm', (-0.42 - Math.max(0, ext) * 1.15) * strength, 0.18 * ext, rightRelax * 0.45, true);
      this.applyCharSpacePose('rightLowerArm', THREE.MathUtils.lerp(-1.42, -0.1, Math.max(0, ext)) * strength, 0, 0, true);
      this.applyCharSpacePose('leftUpperArm', -0.92 * strength, 0.25, leftRelax * 0.65, false);
      this.applyCharSpacePose('leftLowerArm', -1.25 * strength, 0, 0, false);
      this.applyCharSpacePose('leftUpperLeg', -0.26 * strength, 0, 0, false);
      this.applyCharSpacePose('rightUpperLeg', 0.26 * strength, 0, 0, true);
      this.smoothLiveBoneQuaternions(clampedDt, 26);
      return;
    }

    if (slot === 'kick') {
      const p = (this.slotElapsed % 0.78) / 0.78;
      let lift = 0;
      let kneeBend = 0;
      if (p < 0.28) {
        const w = p / 0.28;
        lift = 0.55 * w;
        kneeBend = 1.45 * w;
      } else if (p < 0.6) {
        const s = (p - 0.28) / 0.32;
        const ease = 1 - Math.pow(1 - s, 3);
        lift = THREE.MathUtils.lerp(0.55, 1.52, ease);
        kneeBend = THREE.MathUtils.lerp(1.45, 0.12, ease);
      } else {
        const r = (p - 0.6) / 0.4;
        lift = THREE.MathUtils.lerp(1.52, 0, r);
        kneeBend = THREE.MathUtils.lerp(0.12, 0.08, r);
      }
      this.applyCharSpacePose('spine', -0.22 * (lift / 1.52) * strength, -0.24 * (lift / 1.52) * strength, 0);
      this.applyCharSpacePose('chest', -0.14 * (lift / 1.52) * strength, 0, 0);
      this.applyCharSpacePose('leftUpperArm', -0.78 * strength, 0, leftRelax * 1.4, false);
      this.applyCharSpacePose('rightUpperArm', -0.45 * strength, 0, rightRelax * 1.4, true);
      this.applyCharSpacePose('rightUpperLeg', -lift * strength, 0, 0, true);
      this.applyCharSpacePose('rightLowerLeg', kneeBend * strength, 0, 0, true);
      this.applyCharSpacePose('leftUpperLeg', 0.18 * (lift / 1.52) * strength, 0, 0, false);
      this.applyCharSpacePose('leftLowerLeg', 0.16 * strength, 0, 0, false);
      this.smoothLiveBoneQuaternions(clampedDt, 24);
      return;
    }

    // 'interact' (friendly wave + head tilt)
    const wave = Math.sin(t * 7.2);
    const armScale = slotTuning.armSwing;
    const leanBias = THREE.MathUtils.degToRad(slotTuning.torsoLean);
    this.applyCharSpacePose('spine', -0.04 * strength + leanBias * 0.5, -0.08 * strength, Math.sin(t * 2.4) * 0.05 * strength);
    this.applyCharSpacePose('head', -0.06 * headMult, Math.sin(t * 2.2) * 0.14 * headMult, 0.14 * headMult);

    // Raise right arm overhead and wag forearm
    this.applyCharSpacePose('rightUpperArm', -0.35 * strength * armScale, 0, -rightRelax * 1.45 - 0.85, true);
    this.applyCharSpacePose('rightLowerArm', -0.42 * strength, 0, wave * 0.48 * strength * armScale, true);

    // Relaxed left arm
    this.applyCharSpacePose('leftUpperArm', 0.06 * strength, 0, leftRelax, false);
    this.applyCharSpacePose('leftLowerArm', -0.18 * strength, 0, 0, false);
    this.smoothLiveBoneQuaternions(clampedDt, 16);
  }
}

export function getBoneWorldPosition(node: THREE.Object3D, out: THREE.Vector3): THREE.Vector3 {
  node.updateWorldMatrix(true, false);
  return node.getWorldPosition(out);
}
