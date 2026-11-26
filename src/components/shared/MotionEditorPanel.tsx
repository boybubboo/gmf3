import React, { useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  FlipHorizontal2,
  Ghost,
  KeyRound,
  Pause,
  Play,
  Plus,
  Repeat,
  RotateCcw,
  Save,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react';
import type {
  BonePoseAngles,
  CustomAssetMeta,
  CustomClipSlot,
  CustomMotionPreset,
  CustomPoseKeyframe,
  CustomRigSettings,
  MotionEasing,
  RigBoneRole,
} from '../../types/maker';
import { RIG_BONE_ROLES } from '../../three/proceduralRigAnimator';
import { FieldLabel } from './MakerUI';

export interface MotionEditorProps {
  asset: CustomAssetMeta;
  rigSettings: CustomRigSettings;
  boneNames: string[];
  draft: CustomMotionPreset;
  savedPresetId: string | null;
  playhead: number; // 0..1
  isPlaying: boolean;
  workingBones: Record<string, BonePoseAngles>;
  workingHipsY: number;
  isDirtyPose: boolean;
  selectedBone: string | null;
  showLoopGhost: boolean;
  onSelectBone: (boneName: string) => void;
  onChangeBoneAngles: (boneName: string, angles: BonePoseAngles) => void;
  onChangeHipsY: (hipsY: number) => void;
  onResetJoint: (boneName: string) => void;
  onResetPose: () => void;
  onApplyPose: (bones: Record<string, BonePoseAngles>, hipsY: number) => void;
  onScrub: (timeNorm: number) => void;
  onTogglePlay: () => void;
  onUpdateDraft: (patch: Partial<CustomMotionPreset>) => void;
  onSaveKeyframe: () => void;
  onDeleteKeyframe: (kfId: string) => void;
  onMatchEndToStart: () => void;
  onGrabLivePose: (slot: CustomClipSlot) => void;
  onToggleLoopGhost: () => void;
  onLoadPreset: (preset: CustomMotionPreset) => void;
  onCreateNewDraft: (slot: CustomClipSlot) => void;
  onSaveOverwrite: () => void;
  onSaveAsNew: (name: string) => void;
  onDeletePreset: (presetId: string) => void;
  onSetDefaultForSlot: (slot: CustomClipSlot, presetId: string | null) => void;
}

export const EASING_OPTIONS: { value: MotionEasing; label: string; short: string }[] = [
  { value: 'linear', label: 'Linear', short: 'Linear' },
  { value: 'smooth', label: 'Ease In-Out (Smooth)', short: 'Ease In-Out' },
  { value: 'easeIn', label: 'Ease In', short: 'Ease In' },
  { value: 'easeOut', label: 'Ease Out', short: 'Ease Out' },
  { value: 'elastic', label: 'Elastic (Spring)', short: 'Elastic' },
];

export const EasingCurveIcon: React.FC<{ easing: MotionEasing; className?: string }> = ({
  easing,
  className = 'w-4 h-3.5 shrink-0 text-[#7C5CFF]',
}) => {
  const path =
    easing === 'linear'
      ? 'M 2 12 L 16 2'
      : easing === 'easeIn'
      ? 'M 2 12 C 10 12 14 10 16 2'
      : easing === 'easeOut'
      ? 'M 2 12 C 4 4 8 2 16 2'
      : easing === 'elastic'
      ? 'M 2 12 C 5 12 7 1 10 1 C 11.5 1 12.2 4.5 13.5 3.2 C 14.5 2 15.2 2 16 2'
      : 'M 2 12 C 7 12 11 2 16 2';
  return (
    <svg viewBox="0 0 18 14" fill="none" className={className} aria-hidden="true">
      <path
        d={path}
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export type MirrorPoseMode = 'flip' | 'leftToRight' | 'rightToLeft';

const SLOT_OPTIONS: { slot: CustomClipSlot; label: string }[] = [
  { slot: 'idle', label: 'Idle' },
  { slot: 'walk', label: 'Walk' },
  { slot: 'run', label: 'Run' },
  { slot: 'jump', label: 'Jump' },
  { slot: 'swim', label: 'Swim' },
  { slot: 'attack', label: 'Attack' },
  { slot: 'interact', label: 'Wave / Interact' },
];

export interface QuickJointItem {
  boneName: string;
  label: string;
  group: 'core' | 'arms' | 'legs' | 'wings' | 'tail';
}

export function getFriendlyBoneLabel(
  boneName: string,
  boneMap: Partial<Record<RigBoneRole, string>>
): string {
  // Quadruped & Procedural Creature / Baddie readable names first
  if (boneName === 'MonsterBodyPivot') return 'Body Pivot';
  if (boneName === 'MonsterChest') return 'Front Chest';
  if (boneName === 'MonsterTorso') return 'Mid Torso';
  if (boneName === 'MonsterHips') return 'Rear Hips';
  const neckMatch = /^MonsterNeck_(\d+)_(\d+)$/.exec(boneName);
  if (neckMatch) {
    const h = Number(neckMatch[1]) + 1;
    const s = Number(neckMatch[2]) + 1;
    return `Neck ${h}.${s}`;
  }
  const headMatch = /^MonsterHead_(\d+)$/.exec(boneName);
  if (headMatch) return `Head ${Number(headMatch[1]) + 1}`;
  const jawMatch = /^MonsterJaw_(\d+)$/.exec(boneName);
  if (jawMatch) return `Jaw ${Number(jawMatch[1]) + 1}`;
  const legMatch = /^Leg_(\d+)_([LR])_(Hip|Knee|Paw)$/.exec(boneName);
  if (legMatch) {
    const pairLabel = legMatch[1] === '0' ? 'Front' : 'Back';
    return `${legMatch[2]} ${pairLabel} ${legMatch[3]}`;
  }
  const tailMatch = /^MonsterTail_(\d+)$/.exec(boneName);
  if (tailMatch) return `Tail ${Number(tailMatch[1]) + 1}`;
  if (boneName === 'Wing_L_Inner') return 'L Wing Inner';
  if (boneName === 'Wing_L_Outer') return 'L Wing Tip';
  if (boneName === 'Wing_R_Inner') return 'R Wing Inner';
  if (boneName === 'Wing_R_Outer') return 'R Wing Tip';
  if (boneName === 'LeftWing') return 'L Wing';
  if (boneName === 'RightWing') return 'R Wing';
  if (boneName === 'Tail') return 'Tail';

  for (const meta of RIG_BONE_ROLES) {
    if (boneMap[meta.role] === boneName) {
      return meta.label
        .replace(' / Upper Spine', '')
        .replace(' / Torso', '')
        .replace(' / Pelvis', '')
        .replace(' / Knee', '');
    }
  }
  const clean = boneName
    .replace(/^mixamorig\d*[:_.-]?/i, '')
    .replace(/^armature[:_.-]?/i, '')
    .replace(/^(def|org|mch|j_bip|bip\d+|cc_base)[:_.-]?/i, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_.-]+/g, ' ')
    .trim();
  return clean || boneName;
}

export function buildQuickJointList(
  boneNames: string[],
  boneMap: Partial<Record<RigBoneRole, string>>
): QuickJointItem[] {
  const items: QuickJointItem[] = [];
  const seen = new Set<string>();

  const push = (
    boneName: string | undefined,
    label: string,
    group: QuickJointItem['group']
  ) => {
    if (!boneName || seen.has(boneName) || !boneNames.includes(boneName)) return;
    seen.add(boneName);
    items.push({ boneName, label, group });
  };

  const isQuadruped = boneNames.some(
    (b) => b === 'MonsterChest' || b.startsWith('Leg_0_') || b.startsWith('MonsterHead_')
  );

  if (isQuadruped) {
    push('MonsterHead_0', 'Head 1', 'core');
    push('MonsterJaw_0', 'Jaw 1', 'core');
    push('MonsterHead_1', 'Head 2', 'core');
    push('MonsterJaw_1', 'Jaw 2', 'core');
    push('MonsterNeck_0_0', 'Neck 1 Base', 'core');
    push('MonsterNeck_0_1', 'Neck 1 Mid', 'core');
    push('MonsterNeck_1_0', 'Neck 2 Base', 'core');
    push('MonsterNeck_1_1', 'Neck 2 Mid', 'core');
    push('MonsterChest', 'Front Chest', 'core');
    push('MonsterTorso', 'Mid Torso', 'core');
    push('MonsterHips', 'Rear Hips', 'core');
    push('MonsterBodyPivot', 'Body Pivot', 'core');

    // Wings
    push('Wing_L_Inner', 'L Wing Inner', 'wings');
    push('Wing_L_Outer', 'L Wing Tip', 'wings');
    push('Wing_R_Inner', 'R Wing Inner', 'wings');
    push('Wing_R_Outer', 'R Wing Tip', 'wings');

    // Quadruped Front & Hind Legs
    for (const pair of [0, 1]) {
      const pfx = pair === 0 ? 'Front' : 'Back';
      push(`Leg_${pair}_L_Hip`, `L ${pfx} Hip`, 'legs');
      push(`Leg_${pair}_L_Knee`, `L ${pfx} Knee`, 'legs');
      push(`Leg_${pair}_R_Hip`, `R ${pfx} Hip`, 'legs');
      push(`Leg_${pair}_R_Knee`, `R ${pfx} Knee`, 'legs');
    }

    // Tail Chain
    for (let i = 0; i < 6; i++) {
      push(`MonsterTail_${i}`, `Tail ${i + 1}`, 'tail');
    }
    return items;
  }

  // Humanoid / Critter / Procedural Baddie
  push(boneMap.head, 'Head', 'core');
  push(boneMap.neck, 'Neck', 'core');
  push(boneMap.chest, 'Chest', 'core');
  push(boneMap.spine, 'Spine', 'core');
  push(boneMap.hips, 'Hips', 'core');

  // Arms + Hands
  push(boneMap.leftUpperArm, 'L Upper Arm', 'arms');
  push(boneMap.leftLowerArm, 'L Forearm', 'arms');
  const leftHand = boneNames.find(
    (b) => !seen.has(b) && /(left|(^|_)l_)/i.test(b) && /(hand|wrist)/i.test(b) && !/finger|thumb|index|middle|ring|pinky/i.test(b)
  );
  push(leftHand, 'L Hand', 'arms');

  push(boneMap.rightUpperArm, 'R Upper Arm', 'arms');
  push(boneMap.rightLowerArm, 'R Forearm', 'arms');
  const rightHand = boneNames.find(
    (b) => !seen.has(b) && /(right|(^|_)r_)/i.test(b) && /(hand|wrist)/i.test(b) && !/finger|thumb|index|middle|ring|pinky/i.test(b)
  );
  push(rightHand, 'R Hand', 'arms');

  // Legs + Feet
  push(boneMap.leftUpperLeg, 'L Thigh', 'legs');
  push(boneMap.leftLowerLeg, 'L Shin', 'legs');
  const leftFoot = boneNames.find(
    (b) => !seen.has(b) && /(left|(^|_)l_)/i.test(b) && /(foot|ankle)/i.test(b) && !/toe/i.test(b)
  );
  push(leftFoot, 'L Foot', 'legs');

  push(boneMap.rightUpperLeg, 'R Thigh', 'legs');
  push(boneMap.rightLowerLeg, 'R Shin', 'legs');
  const rightFoot = boneNames.find(
    (b) => !seen.has(b) && /(right|(^|_)r_)/i.test(b) && /(foot|ankle)/i.test(b) && !/toe/i.test(b)
  );
  push(rightFoot, 'R Foot', 'legs');

  // Hybrid critter/flyer Wings & Tail
  const leftWing = boneNames.find((b) => !seen.has(b) && /^(leftwing|wing_l)$/i.test(b));
  const rightWing = boneNames.find((b) => !seen.has(b) && /^(rightwing|wing_r)$/i.test(b));
  push(leftWing, 'L Wing', 'wings');
  push(rightWing, 'R Wing', 'wings');

  const tail = boneNames.find((b) => !seen.has(b) && /^tail$/i.test(b));
  push(tail, 'Tail', 'tail');

  return items;
}

export function buildSymmetryMaps(
  boneNames: string[],
  boneMap: Partial<Record<RigBoneRole, string>>
): { pairMap: Map<string, string>; sideMap: Map<string, 'left' | 'right'> } {
  const pairMap = new Map<string, string>();
  const sideMap = new Map<string, 'left' | 'right'>();
  const rolePairs: [RigBoneRole, RigBoneRole][] = [
    ['leftUpperArm', 'rightUpperArm'],
    ['leftLowerArm', 'rightLowerArm'],
    ['leftUpperLeg', 'rightUpperLeg'],
    ['leftLowerLeg', 'rightLowerLeg'],
  ];
  for (const [lRole, rRole] of rolePairs) {
    const l = boneMap[lRole];
    const r = boneMap[rRole];
    if (l && r) {
      pairMap.set(l, r);
      pairMap.set(r, l);
      sideMap.set(l, 'left');
      sideMap.set(r, 'right');
    }
  }

  // Also match left/right hands, feet, wings, quadruped legs & dual dragon heads/necks
  const extraPairs: [string, string][] = [
    ['LeftWing', 'RightWing'],
    ['Wing_L_Inner', 'Wing_R_Inner'],
    ['Wing_L_Outer', 'Wing_R_Outer'],
    ['MonsterHead_0', 'MonsterHead_1'],
    ['MonsterJaw_0', 'MonsterJaw_1'],
    ['MonsterNeck_0_0', 'MonsterNeck_1_0'],
    ['MonsterNeck_0_1', 'MonsterNeck_1_1'],
    ['Leg_0_L_Hip', 'Leg_0_R_Hip'],
    ['Leg_0_L_Knee', 'Leg_0_R_Knee'],
    ['Leg_0_L_Paw', 'Leg_0_R_Paw'],
    ['Leg_1_L_Hip', 'Leg_1_R_Hip'],
    ['Leg_1_L_Knee', 'Leg_1_R_Knee'],
    ['Leg_1_L_Paw', 'Leg_1_R_Paw'],
  ];
  for (const [lName, rName] of extraPairs) {
    if (boneNames.includes(lName) && boneNames.includes(rName)) {
      pairMap.set(lName, rName);
      pairMap.set(rName, lName);
      sideMap.set(lName, 'left');
      sideMap.set(rName, 'right');
    }
  }

  for (const name of boneNames) {
    if (pairMap.has(name)) continue;
    let counterpart: string | null = null;
    let side: 'left' | 'right' | null = null;
    if (/left/i.test(name)) {
      counterpart = name.replace(/left/i, (m) => (m[0] === 'L' ? 'Right' : 'right'));
      side = 'left';
    } else if (/right/i.test(name)) {
      counterpart = name.replace(/right/i, (m) => (m[0] === 'R' ? 'Left' : 'left'));
      side = 'right';
    } else if (/(^|[_.-])l($|[_.-])/i.test(name)) {
      counterpart = name.replace(/(^|[_.-])l($|[_.-])/i, '$1R$2');
      side = 'left';
    } else if (/(^|[_.-])r($|[_.-])/i.test(name)) {
      counterpart = name.replace(/(^|[_.-])r($|[_.-])/i, '$1L$2');
      side = 'right';
    }
    if (counterpart && side) {
      const exact = boneNames.find((b) => b.toLowerCase() === counterpart!.toLowerCase());
      if (exact && exact !== name) {
        pairMap.set(name, exact);
        pairMap.set(exact, name);
        sideMap.set(name, side);
        sideMap.set(exact, side === 'left' ? 'right' : 'left');
      }
    }
  }

  return { pairMap, sideMap };
}

export function getMirroredBoneCounterpart(
  boneName: string,
  boneNames: string[],
  boneMap: Partial<Record<RigBoneRole, string>>
): string | null {
  const { pairMap } = buildSymmetryMaps(boneNames, boneMap);
  return pairMap.get(boneName) ?? null;
}

export function mirrorPoseBones(
  bones: Record<string, BonePoseAngles>,
  boneNames: string[],
  boneMap: Partial<Record<RigBoneRole, string>>,
  mode: MirrorPoseMode = 'flip'
): Record<string, BonePoseAngles> {
  const { pairMap, sideMap } = buildSymmetryMaps(boneNames, boneMap);
  const out: Record<string, BonePoseAngles> = {};

  if (mode === 'flip') {
    for (const [name, [rx, ry, rz]] of Object.entries(bones)) {
      const target = pairMap.get(name) ?? name;
      // Mirroring across the sagittal (X=0) plane preserves pitch (X) and negates yaw (Y) & roll (Z)
      out[target] = [rx, -ry, -rz];
    }
    return out;
  }

  const sourceSide: 'left' | 'right' = mode === 'leftToRight' ? 'left' : 'right';
  for (const [name, [rx, ry, rz]] of Object.entries(bones)) {
    const side = sideMap.get(name);
    if (!side) {
      // Center bone (head, neck, spine, chest, hips): keep forward/back pitch, center side tilt & twist
      if (Math.abs(rx) >= 0.5) {
        out[name] = [rx, 0, 0];
      }
    } else if (side === sourceSide) {
      out[name] = [rx, ry, rz];
      const opp = pairMap.get(name);
      if (opp) {
        out[opp] = [rx, -ry, -rz];
      }
    }
  }
  return out;
}

export interface LoopSeamReport {
  isSeamless: boolean;
  isAutoClosed: boolean;
  matchPercent: number;
  maxDiffDeg: number;
  mismatchedJoints: string[];
}

export function analyzeLoopSeam(
  preset: CustomMotionPreset,
  boneMap: Partial<Record<RigBoneRole, string>>
): LoopSeamReport {
  const sorted = [...preset.keyframes].sort((a, b) => a.time - b.time);
  if (!preset.loop || sorted.length <= 1) {
    return {
      isSeamless: true,
      isAutoClosed: Boolean(preset.loop && preset.autoCloseLoop !== false),
      matchPercent: 100,
      maxDiffDeg: 0,
      mismatchedJoints: [],
    };
  }

  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  // If autoCloseLoop is enabled and there is room after the last keyframe to blend back to 0%, it's auto-seamless
  if (preset.autoCloseLoop !== false && last.time < 0.97) {
    return {
      isSeamless: true,
      isAutoClosed: true,
      matchPercent: 100,
      maxDiffDeg: 0,
      mismatchedJoints: [],
    };
  }

  const boneSet = new Set([...Object.keys(first.bones), ...Object.keys(last.bones)]);
  let maxDiffDeg = 0;
  const diffs: { label: string; deg: number }[] = [];

  for (const b of boneSet) {
    const a = first.bones[b] ?? [0, 0, 0];
    const c = last.bones[b] ?? [0, 0, 0];
    const diff = Math.max(
      Math.abs(a[0] - c[0]),
      Math.abs(a[1] - c[1]),
      Math.abs(a[2] - c[2])
    );
    if (diff > maxDiffDeg) maxDiffDeg = diff;
    if (diff >= 4) {
      diffs.push({ label: getFriendlyBoneLabel(b, boneMap), deg: Math.round(diff) });
    }
  }

  diffs.sort((x, y) => y.deg - x.deg);
  const matchPercent = Math.max(0, Math.round(100 - (maxDiffDeg / 90) * 100));
  return {
    isSeamless: maxDiffDeg < 4,
    isAutoClosed: false,
    matchPercent,
    maxDiffDeg: Math.round(maxDiffDeg),
    mismatchedJoints: diffs.slice(0, 3).map((d) => `${d.label} (${d.deg}°)`),
  };
}

export const MotionEditorPanel: React.FC<MotionEditorProps> = ({
  asset,
  rigSettings,
  boneNames,
  draft,
  savedPresetId,
  playhead,
  isPlaying,
  workingBones,
  workingHipsY,
  isDirtyPose,
  selectedBone,
  showLoopGhost,
  onSelectBone,
  onChangeBoneAngles,
  onChangeHipsY,
  onResetJoint,
  onResetPose,
  onApplyPose,
  onScrub,
  onTogglePlay,
  onUpdateDraft,
  onSaveKeyframe,
  onDeleteKeyframe,
  onMatchEndToStart,
  onGrabLivePose,
  onToggleLoopGhost,
  onLoadPreset,
  onCreateNewDraft,
  onSaveOverwrite,
  onSaveAsNew,
  onDeletePreset,
  onSetDefaultForSlot,
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [clipboardPose, setClipboardPose] = useState<{
    bones: Record<string, BonePoseAngles>;
    hipsY: number;
  } | null>(null);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  const savedPresets = asset.customAnimations ?? [];
  const defaultPresetForDraftSlot = asset.defaultSlotPresets?.[draft.slot] ?? null;
  const isCurrentDefault = Boolean(savedPresetId && defaultPresetForDraftSlot === savedPresetId);

  const sortedKeyframes = useMemo(
    () => [...draft.keyframes].sort((a, b) => a.time - b.time),
    [draft.keyframes]
  );

  const activeKeyframe = useMemo(
    () => sortedKeyframes.find((kf) => Math.abs(kf.time - playhead) < 0.018) ?? null,
    [sortedKeyframes, playhead]
  );

  const quickJoints = useMemo(
    () => buildQuickJointList(boneNames, rigSettings.boneMap),
    [boneNames, rigSettings.boneMap]
  );

  const loopReport = useMemo(
    () => analyzeLoopSeam(draft, rigSettings.boneMap),
    [draft, rigSettings.boneMap]
  );

  const selectedAngles: BonePoseAngles = selectedBone
    ? workingBones[selectedBone] ?? [0, 0, 0]
    : [0, 0, 0];

  const selectedLabel = selectedBone
    ? getFriendlyBoneLabel(selectedBone, rigSettings.boneMap)
    : 'None';

  const flashToast = (msg: string) => {
    setSaveToast(msg);
    window.setTimeout(() => setSaveToast((cur) => (cur === msg ? null : cur)), 2000);
  };

  const scrubFromClientX = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const norm = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    // Snap to 1% increments for crisp timeline scrubbing
    onScrub(Math.round(norm * 100) / 100);
  };

  const handleTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    scrubFromClientX(e.clientX);
  };

  const handleTrackPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1) return;
    scrubFromClientX(e.clientX);
  };

  const lastKeyTime =
    sortedKeyframes.length > 0 ? sortedKeyframes[sortedKeyframes.length - 1].time : 0;

  if (boneNames.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-slate-500 dark:text-[#949BB0]">
        This model has no detected rig bones, so keyframe animations cannot be created for it.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 1. COMPACT KEYFRAME TIMELINE */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.1] bg-slate-50 dark:bg-[#12151E] p-3.5 space-y-3">
        {/* Transport & Timing Row */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={onTogglePlay}
              disabled={sortedKeyframes.length < 2}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors disabled:opacity-40 ${
                isPlaying
                  ? 'bg-[#F59E0B] text-slate-950'
                  : 'bg-[#7C5CFF] hover:bg-[#6A48F5] text-white'
              }`}
            >
              {isPlaying ? <Pause size={13} /> : <Play size={13} />}
              <span>{isPlaying ? 'Pause' : 'Play Move'}</span>
            </button>

            <button
              type="button"
              onClick={onSaveKeyframe}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                isDirtyPose
                  ? 'bg-[#20B46A] hover:bg-[#1A9E5C] text-white'
                  : 'bg-slate-200 dark:bg-[#23293A] hover:bg-slate-300 dark:hover:bg-[#2D354A] text-slate-800 dark:text-white'
              }`}
            >
              <KeyRound size={13} />
              <span>{activeKeyframe ? 'Update Keyframe' : 'Save Keyframe'}</span>
            </button>

            {activeKeyframe && sortedKeyframes.length > 1 && (
              <button
                type="button"
                onClick={() => onDeleteKeyframe(activeKeyframe.id)}
                title="Delete keyframe at playhead"
                className="px-2.5 py-1.5 rounded-lg bg-[#F2545B]/12 text-[#F2545B] hover:bg-[#F2545B]/20 text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap"
              >
                <Trash2 size={12} />
                <span>Delete Key</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono tabular-nums text-slate-600 dark:text-[#A8B0C6]">
            <span>
              {(playhead * draft.duration).toFixed(2)}s / {draft.duration.toFixed(1)}s
            </span>
            <span aria-hidden="true">·</span>
            <span>{Math.round(playhead * 100)}%</span>
            <span aria-hidden="true">·</span>
            <span>
              {sortedKeyframes.length} {sortedKeyframes.length === 1 ? 'key' : 'keys'}
            </span>
          </div>
        </div>

        {/* Scrubber Track */}
        <div className="space-y-1">
          <div
            ref={trackRef}
            onPointerDown={handleTrackPointerDown}
            onPointerMove={handleTrackPointerMove}
            className="relative h-11 rounded-xl bg-slate-200/80 dark:bg-[#0B0E16] border border-slate-300/80 dark:border-white/[0.08] cursor-ew-resize select-none touch-none overflow-hidden"
          >
            {/* Quarter tick marks */}
            {[0, 25, 50, 75, 100].map((pct) => (
              <div
                key={pct}
                style={{ left: `${pct}%` }}
                className="absolute top-0 bottom-0 w-px bg-slate-400/25 dark:bg-white/[0.08] pointer-events-none"
              />
            ))}

            {/* Auto-Close Loop Return Visual Guide */}
            {draft.loop && draft.autoCloseLoop !== false && sortedKeyframes.length >= 2 && lastKeyTime < 0.98 && (
              <div
                style={{
                  left: `${lastKeyTime * 100}%`,
                  width: `${(1 - lastKeyTime) * 100}%`,
                }}
                title="Auto-loop smoothly blends back to the 0% Start Keyframe"
                className="absolute top-2 bottom-2 bg-[#06B6D4]/15 border-y border-dashed border-[#06B6D4]/55 pointer-events-none flex items-center justify-center"
              >
                <span className="text-[9px] font-bold text-[#0891B2] dark:text-[#22D3EE] truncate px-1">
                  → Loop Start
                </span>
              </div>
            )}

            {/* Filled progress bar */}
            <div
              style={{ width: `${playhead * 100}%` }}
              className="absolute top-0 bottom-0 left-0 bg-[#7C5CFF]/15 pointer-events-none"
            />

            {/* Keyframe diamonds */}
            {sortedKeyframes.map((kf, idx) => {
              const isSelected = activeKeyframe?.id === kf.id;
              const isStart = idx === 0;
              return (
                <button
                  key={kf.id}
                  type="button"
                  title={`Keyframe ${idx + 1} (${(kf.time * draft.duration).toFixed(2)}s · ${Math.round(kf.time * 100)}%)`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onScrub(kf.time);
                  }}
                  style={{ left: `${kf.time * 100}%` }}
                  className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center z-10 group"
                >
                  <span
                    className={`w-3.5 h-3.5 rotate-45 rounded-[2px] border-2 transition-transform ${
                      isSelected
                        ? 'bg-[#F59E0B] border-white scale-110'
                        : isStart
                        ? 'bg-[#06B6D4] border-white/90 group-hover:scale-110'
                        : 'bg-[#7C5CFF] border-white/85 group-hover:scale-110'
                    }`}
                  />
                </button>
              );
            })}

            {/* Playhead needle */}
            <div
              style={{ left: `${playhead * 100}%` }}
              className="absolute top-0 bottom-0 w-0.5 bg-[#F59E0B] -translate-x-1/2 pointer-events-none z-20"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] border border-white -translate-x-[4px] -translate-y-0.5" />
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-[#8E96AB] tabular-nums px-0.5">
            <span>0.0s (Start)</span>
            <span>{(draft.duration * 0.25).toFixed(2)}s</span>
            <span>{(draft.duration * 0.5).toFixed(2)}s</span>
            <span>{(draft.duration * 0.75).toFixed(2)}s</span>
            <span>{draft.duration.toFixed(1)}s (End)</span>
          </div>
        </div>

        {/* Timeline Settings & Pose Helpers Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/70 dark:border-white/[0.08]">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <label className="inline-flex items-center gap-1.5 font-semibold text-slate-600 dark:text-[#A5AEC4]">
              <span>Length</span>
              <input
                type="number"
                min={0.3}
                max={6}
                step={0.1}
                value={draft.duration}
                onChange={(e) => {
                  const v = Math.max(0.3, Math.min(6, Number(e.target.value) || 1.2));
                  onUpdateDraft({ duration: Math.round(v * 10) / 10 });
                }}
                className="w-14 px-1.5 py-1 rounded-md bg-white dark:bg-[#1F2430] border border-slate-200 dark:border-white/[0.08] text-xs font-mono tabular-nums text-center"
              />
              <span>s</span>
            </label>

            <button
              type="button"
              onClick={() => onUpdateDraft({ loop: !draft.loop })}
              className={`px-2 py-1 rounded-md text-[11px] font-bold inline-flex items-center gap-1 whitespace-nowrap ${
                draft.loop
                  ? 'bg-[#06B6D4]/20 text-[#0E7490] dark:text-[#22D3EE]'
                  : 'bg-slate-200/80 dark:bg-[#1F2430] text-slate-500 dark:text-[#949BB0]'
              }`}
            >
              <Repeat size={11} />
              <span>{draft.loop ? 'Loop On' : 'Play Once'}</span>
            </button>

            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white dark:bg-[#1F2430] border border-slate-200 dark:border-white/[0.08]">
              <EasingCurveIcon easing={draft.easing} />
              <select
                value={draft.easing}
                onChange={(e) => onUpdateDraft({ easing: e.target.value as MotionEasing })}
                aria-label="Easing function between keyframes"
                className="bg-transparent py-0.5 text-[11px] font-semibold focus:outline-none"
              >
                {EASING_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Pose utility buttons */}
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => onGrabLivePose(draft.slot)}
              title="Copy the character's current live move pose into this frame to customize it"
              className="px-2 py-1 rounded-md bg-[#7C5CFF]/15 text-[#7C5CFF] hover:bg-[#7C5CFF]/25 text-[11px] font-bold inline-flex items-center gap-1 whitespace-nowrap"
            >
              <Sparkles size={11} />
              <span>Grab {SLOT_OPTIONS.find((s) => s.slot === draft.slot)?.label ?? 'Live'} Pose</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setClipboardPose({
                  bones: JSON.parse(JSON.stringify(workingBones)),
                  hipsY: workingHipsY,
                });
                flashToast('Pose copied');
              }}
              className="px-2 py-1 rounded-md bg-slate-200/70 dark:bg-[#1F2430] hover:bg-slate-300 dark:hover:bg-[#2A3142] text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap"
            >
              <Copy size={11} />
              <span>Copy</span>
            </button>

            {clipboardPose && (
              <button
                type="button"
                onClick={() => onApplyPose(clipboardPose.bones, clipboardPose.hipsY)}
                className="px-2 py-1 rounded-md bg-slate-200/70 dark:bg-[#1F2430] hover:bg-slate-300 dark:hover:bg-[#2A3142] text-[11px] font-semibold whitespace-nowrap"
              >
                Paste
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                onApplyPose(
                  mirrorPoseBones(workingBones, boneNames, rigSettings.boneMap, 'flip'),
                  workingHipsY
                )
              }
              title="Mirror left and right limbs symmetrically"
              className="px-2 py-1 rounded-md bg-slate-200/70 dark:bg-[#1F2430] hover:bg-slate-300 dark:hover:bg-[#2A3142] text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap"
            >
              <FlipHorizontal2 size={11} />
              <span>Mirror L↔R</span>
            </button>
          </div>
        </div>

        {/* SEAMLESS LOOP GUIDE BAR */}
        {draft.loop && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-white/[0.08] text-[11px]">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span
                className={`font-bold ${
                  loopReport.isSeamless
                    ? 'text-[#16A34A] dark:text-[#34D399]'
                    : 'text-[#D97706] dark:text-[#FBBF24]'
                }`}
              >
                {loopReport.isAutoClosed
                  ? 'Loop Guide · Auto-Blend to Start (100% seamless)'
                  : loopReport.isSeamless
                  ? 'Loop Guide · Start & End Match (100% seamless)'
                  : `Loop Seam · ${loopReport.matchPercent}% match (${loopReport.maxDiffDeg}° off)`}
              </span>
              {!loopReport.isSeamless && loopReport.mismatchedJoints.length > 0 && (
                <span className="text-slate-500 dark:text-[#949BB0] truncate">
                  Adjust: {loopReport.mismatchedJoints.join(', ')}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <label className="inline-flex items-center gap-1 font-semibold text-slate-600 dark:text-[#A5AEC4] cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.autoCloseLoop !== false}
                  onChange={(e) => onUpdateDraft({ autoCloseLoop: e.target.checked })}
                  className="accent-[#06B6D4] w-3.5 h-3.5"
                />
                <span>Auto-Close Loop</span>
              </label>

              <button
                type="button"
                onClick={onToggleLoopGhost}
                title="Show a translucent 3D skeleton ghost of the 0% Start Keyframe so you can align the end pose visually"
                className={`px-2.5 py-1 rounded-lg font-bold inline-flex items-center gap-1 whitespace-nowrap transition-colors ${
                  showLoopGhost
                    ? 'bg-[#06B6D4] text-slate-950'
                    : 'bg-slate-200/80 dark:bg-[#1F2430] text-slate-700 dark:text-[#C8D0E4] hover:bg-slate-300 dark:hover:bg-[#2A3142]'
                }`}
              >
                <Ghost size={12} />
                <span>{showLoopGhost ? 'Start Ghost On' : 'Start Pose Ghost'}</span>
              </button>

              <button
                type="button"
                onClick={onMatchEndToStart}
                disabled={sortedKeyframes.length === 0}
                title="Copy Keyframe 1 (Start) directly to 100% (End) for a guaranteed loop"
                className="px-2.5 py-1 rounded-lg bg-[#20B46A]/15 text-[#16A34A] dark:text-[#34D399] hover:bg-[#20B46A]/25 font-bold whitespace-nowrap disabled:opacity-40"
              >
                Match End to Start
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. BODY PART SELECTOR + 3D JOINT ROTATION CONTROLLER */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        {/* Left: Quick Body-Part Picker */}
        <div className="md:col-span-6 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <FieldLabel text="Select Joint (or click body part in 3D)" />
            <button
              type="button"
              onClick={onResetPose}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 dark:text-[#949BB0] dark:hover:text-white inline-flex items-center gap-1"
            >
              <RotateCcw size={11} />
              <span>Reset Pose</span>
            </button>
          </div>

          <div className="space-y-1.5">
            {(
              [
                ['core', 'Head & Torso'],
                ['arms', 'Arms & Hands'],
                ['legs', 'Legs & Feet'],
                ['wings', 'Wings'],
                ['tail', 'Tail'],
              ] as const
            ).map(([grp, title]) => {
              const items = quickJoints.filter((q) => q.group === grp);
              if (items.length === 0) return null;
              return (
                <div key={grp} className="space-y-1">
                  <div className="text-[10px] font-bold text-slate-500 dark:text-[#8E96AB]">
                    {title}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {items.map((item) => {
                      const active = selectedBone === item.boneName;
                      const hasEdit = Boolean(workingBones[item.boneName]);
                      return (
                        <button
                          key={item.boneName}
                          type="button"
                          onClick={() => onSelectBone(item.boneName)}
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap ${
                            active
                              ? 'bg-[#F59E0B] text-slate-950'
                              : hasEdit
                              ? 'bg-[#7C5CFF]/18 text-[#6A48F5] dark:text-[#C4B5FD] border border-[#7C5CFF]/35'
                              : 'bg-slate-100 dark:bg-[#1F2430] text-slate-700 dark:text-[#B8C0D6] hover:bg-slate-200 dark:hover:bg-[#2A3142]'
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Full skeleton bone selector for extra joints (hands, fingers, tails, etc.) */}
            <div className="pt-1 flex items-center gap-2">
              <span className="text-[10px] font-semibold text-slate-500 dark:text-[#8E96AB] whitespace-nowrap">
                All Bones:
              </span>
              <select
                value={selectedBone ?? ''}
                onChange={(e) => e.target.value && onSelectBone(e.target.value)}
                className="flex-1 min-w-0 px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-[11px] font-semibold border border-slate-200/70 dark:border-white/[0.08]"
              >
                {boneNames.map((bn) => (
                  <option key={bn} value={bn}>
                    {getFriendlyBoneLabel(bn, rigSettings.boneMap)} ({bn})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Right: Rotation Controller (synced with 3D Gizmo Rings) */}
        <div className="md:col-span-6 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50 dark:bg-[#12151E] p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs font-extrabold truncate text-slate-900 dark:text-white">
                Rotate: {selectedLabel}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-[#8E96AB]">
                Drag colored 3D rings on the character or slide below
              </div>
            </div>
            {selectedBone && (
              <button
                type="button"
                onClick={() => onResetJoint(selectedBone)}
                className="px-2 py-1 rounded-lg bg-slate-200/80 dark:bg-[#1F2430] hover:bg-slate-300 dark:hover:bg-[#2A3142] text-[11px] font-semibold whitespace-nowrap shrink-0"
              >
                Zero Joint
              </button>
            )}
          </div>

          {(
            [
              [0, 'Forward / Back (X)', '#EF4444'],
              [1, 'Turn / Twist (Y)', '#22C55E'],
              [2, 'Side Tilt / Raise (Z)', '#3B82F6'],
            ] as const
          ).map(([idx, label, color]) => (
            <div key={idx} className="space-y-0.5">
              <div className="flex items-center justify-between text-[11px] font-semibold">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    style={{ backgroundColor: color }}
                    className="w-2 h-2 rounded-xs inline-block shrink-0"
                  />
                  <span>{label}</span>
                </span>
                <span className="font-mono tabular-nums text-slate-600 dark:text-[#A5AEC4]">
                  {selectedAngles[idx] > 0 ? '+' : ''}
                  {selectedAngles[idx]}°
                </span>
              </div>
              <input
                type="range"
                min={-165}
                max={165}
                step={0.5}
                disabled={!selectedBone}
                value={selectedAngles[idx]}
                onChange={(e) => {
                  if (!selectedBone) return;
                  const next: BonePoseAngles = [...selectedAngles] as BonePoseAngles;
                  next[idx] = Number(e.target.value);
                  onChangeBoneAngles(selectedBone, next);
                }}
                className="w-full accent-[#F59E0B] disabled:opacity-40"
              />
            </div>
          ))}

          {/* Optional Hips Height / Bounce */}
          <div className="space-y-0.5 pt-1.5 border-t border-slate-200/70 dark:border-white/[0.08]">
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <span>Body Bounce / Crouch (Hips Y)</span>
              <span className="font-mono tabular-nums text-slate-600 dark:text-[#A5AEC4]">
                {workingHipsY > 0 ? '+' : ''}
                {workingHipsY.toFixed(2)}m
              </span>
            </div>
            <input
              type="range"
              min={-0.35}
              max={0.35}
              step={0.01}
              value={workingHipsY}
              onChange={(e) => onChangeHipsY(Number(e.target.value))}
              className="w-full accent-[#7C5CFF]"
            />
          </div>
        </div>
      </div>

      {/* 3. PRESET SAVE, OVERWRITE & DEFAULT ASSIGNMENT */}
      <div className="space-y-3 pt-2 border-t border-slate-200/70 dark:border-white/[0.08]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <FieldLabel text="Save & Assign Custom Move Preset" />
          {saveToast && (
            <span className="text-xs font-bold text-[#20B46A] inline-flex items-center gap-1">
              <Check size={13} />
              <span>{saveToast}</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
          <input
            type="text"
            value={draft.name}
            onChange={(e) => onUpdateDraft({ name: e.target.value })}
            placeholder="Move name (e.g. Hero Idle, Victory Wave)"
            aria-label="Custom move preset name"
            className="sm:col-span-5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#1F2430] border border-slate-200 dark:border-white/[0.08] text-xs font-bold"
          />

          <select
            value={draft.slot}
            onChange={(e) => onUpdateDraft({ slot: e.target.value as CustomClipSlot })}
            aria-label="Target action slot"
            className="sm:col-span-3 px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-[#1F2430] border border-slate-200 dark:border-white/[0.08] text-xs font-semibold"
          >
            {SLOT_OPTIONS.map((opt) => (
              <option key={opt.slot} value={opt.slot}>
                Slot: {opt.label}
              </option>
            ))}
          </select>

          <div className="sm:col-span-4 flex items-center gap-1.5">
            {savedPresetId && (
              <button
                type="button"
                onClick={() => {
                  onSaveOverwrite();
                  flashToast(`Saved "${draft.name || 'Custom Move'}"`);
                }}
                className="flex-1 px-3 py-2 rounded-xl bg-[#7C5CFF] hover:bg-[#6A48F5] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <Save size={13} />
                <span>Save</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                const name = draft.name.trim() || `Custom ${draft.slot}`;
                onSaveAsNew(name);
                flashToast(`Saved new preset "${name}"`);
              }}
              className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${
                savedPresetId
                  ? 'bg-slate-200 dark:bg-[#23293A] hover:bg-slate-300 dark:hover:bg-[#2D354A] text-slate-900 dark:text-white'
                  : 'bg-[#7C5CFF] hover:bg-[#6A48F5] text-white'
              }`}
            >
              <Plus size={13} />
              <span>{savedPresetId ? 'Save As New' : 'Save Preset'}</span>
            </button>
          </div>
        </div>

        {/* Saved Custom Presets Library for this Character */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-[#949BB0]">
            <span>Saved Custom Moves ({savedPresets.length})</span>
            <button
              type="button"
              onClick={() => onCreateNewDraft(draft.slot)}
              className="text-[#7C5CFF] font-bold hover:underline inline-flex items-center gap-1"
            >
              <Plus size={11} />
              <span>New Blank Move</span>
            </button>
          </div>

          {savedPresets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-white/[0.1] px-3.5 py-3 text-xs text-slate-500 dark:text-[#949BB0]">
              Click any body part above, pose the joint, click <strong>Save Keyframe</strong>, scrub
              forward on the timeline, pose again, and save as a reusable move preset.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {savedPresets.map((preset) => {
                const isEditing = savedPresetId === preset.id;
                const isDefault = asset.defaultSlotPresets?.[preset.slot] === preset.id;
                const slotTitle =
                  SLOT_OPTIONS.find((s) => s.slot === preset.slot)?.label ?? preset.slot;
                return (
                  <div
                    key={preset.id}
                    className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border transition-colors ${
                      isEditing
                        ? 'border-[#7C5CFF] bg-[#7C5CFF]/10'
                        : 'border-slate-200/80 dark:border-white/[0.08] bg-slate-50 dark:bg-[#12151E]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onLoadPreset(preset)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="text-xs font-extrabold truncate text-slate-900 dark:text-white">
                        {preset.name}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-[#949BB0] tabular-nums truncate">
                        {slotTitle} · {preset.duration.toFixed(1)}s · {preset.keyframes.length} keys
                        {isDefault ? ' · Default' : ''}
                      </div>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          onSetDefaultForSlot(preset.slot, isDefault ? null : preset.id)
                        }
                        title={
                          isDefault
                            ? `Unset as default ${slotTitle} animation`
                            : `Set as default ${slotTitle} animation`
                        }
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 whitespace-nowrap ${
                          isDefault
                            ? 'bg-[#20B46A] text-white'
                            : 'bg-slate-200/80 dark:bg-[#1F2430] text-slate-700 dark:text-[#C8D0E4] hover:bg-[#7C5CFF] hover:text-white'
                        }`}
                      >
                        <Star size={11} className={isDefault ? 'fill-current' : ''} />
                        <span>{isDefault ? 'Default' : 'Use'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeletePreset(preset.id)}
                        title="Delete preset"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-[#F2545B] hover:bg-[#F2545B]/10"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {savedPresetId && (
            <div className="flex items-center justify-between rounded-xl bg-slate-100/80 dark:bg-[#12151E] px-3 py-2 text-xs">
              <span className="text-slate-600 dark:text-[#A5AEC4]">
                Active default for{' '}
                <strong className="text-slate-900 dark:text-white">
                  {SLOT_OPTIONS.find((s) => s.slot === draft.slot)?.label}
                </strong>
                :{' '}
                {isCurrentDefault
                  ? draft.name
                  : defaultPresetForDraftSlot
                  ? savedPresets.find((p) => p.id === defaultPresetForDraftSlot)?.name ??
                    'Custom Preset'
                  : 'Built-in / GLB Clip'}
              </span>
              <button
                type="button"
                onClick={() =>
                  onSetDefaultForSlot(draft.slot, isCurrentDefault ? null : savedPresetId)
                }
                className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap ${
                  isCurrentDefault
                    ? 'bg-slate-200 dark:bg-[#23293A] text-slate-700 dark:text-[#D5DCF0]'
                    : 'bg-[#20B46A] text-white hover:bg-[#1A9E5C]'
                }`}
              >
                {isCurrentDefault ? 'Revert to Built-in' : 'Set as Default'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
