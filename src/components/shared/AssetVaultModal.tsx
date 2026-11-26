import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bone,
  Box,
  Camera,
  Check,
  Compass,
  Eye,
  Film,
  KeyRound,
  Layers,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  Sliders,
  Sparkles,
  Trash2,
  Upload,
  User,
  Wand2,
  X,
} from 'lucide-react';
import type { MakerStore } from '../../store/useMakerStore';
import { setCustomAssetThumbnailCache } from '../../three/assetThumbnailer';
import {
  autoMapAnimationClips,
  getCachedAssetSync,
  loadCustomAssetToCache,
  regenerateCustomAssetThumbnail,
  resolveRigSettings,
  type CachedGLTF,
} from '../../three/gltfAssetManager';
import {
  RIG_BONE_ROLES,
  sampleMotionPresetToPose,
  type RigTestOverride,
} from '../../three/proceduralRigAnimator';
import type {
  AssetCategory,
  BonePoseAngles,
  CustomAssetMeta,
  CustomClipSlot,
  CustomMotionPreset,
  CustomPoseKeyframe,
  CustomRigSettings,
  RigAnimationMode,
  RigBoneRole,
  RigSwingAxis,
} from '../../types/maker';
import { formatBytes } from '../../utils/assetVault';
import { uid } from '../../utils/terrain';
import { FieldLabel } from './MakerUI';
import { MotionEditorPanel } from './MotionEditorPanel';
import { RigPreviewStage, type StageCameraPreset } from './RigPreviewStage';

const CLIP_SLOTS: { slot: CustomClipSlot; label: string; short: string }[] = [
  { slot: 'idle', label: 'Idle', short: 'Idle' },
  { slot: 'walk', label: 'Walk', short: 'Walk' },
  { slot: 'run', label: 'Run', short: 'Run' },
  { slot: 'jump', label: 'Jump', short: 'Jump' },
  { slot: 'swim', label: 'Swim', short: 'Swim' },
  { slot: 'attack', label: 'Attack', short: 'Attack' },
  { slot: 'interact', label: 'Interact / Wave', short: 'Wave' },
];

const CATEGORIES: { id: AssetCategory; label: string; hint: string }[] = [
  { id: 'character', label: 'Character / Rig', hint: 'Hero, NPC, Baddie' },
  { id: 'prop', label: 'Prop', hint: 'Chest, crate, artifact' },
  { id: 'scenery', label: 'Scenery', hint: 'Rocks, ruins, props' },
  { id: 'plant', label: 'Plant', hint: 'Foliage, shrubs, flowers' },
  { id: 'tree', label: 'Tree', hint: 'Trees & groves' },
  { id: 'building', label: 'Building', hint: 'Walls, arches, roofs' },
];

const FACING_PRESETS = [0, 90, 180, -90];

const SWING_AXIS_OPTIONS: { value: RigSwingAxis; label: string }[] = [
  { value: 'auto', label: 'Auto (Character Space)' },
  { value: 'x', label: 'Bone Local +X' },
  { value: '-x', label: 'Bone Local -X' },
  { value: 'z', label: 'Bone Local +Z' },
  { value: '-z', label: 'Bone Local -Z' },
  { value: 'y', label: 'Bone Local +Y' },
  { value: '-y', label: 'Bone Local -Y' },
];

type InspectorTab = 'animation' | 'motion' | 'rig' | 'assign';
type CameraPreset = StageCameraPreset;

function createBlankMotionDraft(slot: CustomClipSlot): CustomMotionPreset {
  const slotTitle = CLIP_SLOTS.find((s) => s.slot === slot)?.short ?? 'Move';
  return {
    id: uid(),
    name: `Custom ${slotTitle}`,
    slot,
    duration: slot === 'attack' ? 0.7 : slot === 'idle' ? 2.0 : 1.2,
    loop: slot !== 'attack' && slot !== 'jump',
    autoCloseLoop: true,
    easing: 'smooth',
    keyframes: [
      {
        id: uid(),
        time: 0,
        bones: {},
        hipsOffsetY: 0,
      },
    ],
    updatedAt: new Date().toISOString(),
  };
}

export const AssetVaultModal: React.FC<{
  store: MakerStore;
  onClose: () => void;
}> = ({ store, onClose }) => {
  const [filterCat, setFilterCat] = useState<'all' | AssetCategory>('all');
  const [uploadCat, setUploadCat] = useState<AssetCategory>('character');
  const [selectedId, setSelectedId] = useState<string | null>(
    store.customAssets[0]?.id ?? null
  );
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Live preview & rig testing state
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('animation');
  const [previewSlot, setPreviewSlot] = useState<CustomClipSlot>('walk');
  const [paused, setPaused] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [xrayMesh, setXrayMesh] = useState(false);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('threeQuarter');
  const [cameraResetNonce, setCameraResetNonce] = useState(0);
  const [testOverride, setTestOverride] = useState<RigTestOverride>(null);
  const [manualBoneName, setManualBoneName] = useState<string>('');
  const [manualAngles, setManualAngles] = useState<{ rx: number; ry: number; rz: number }>({
    rx: 0,
    ry: 0,
    rz: 0,
  });
  const [activeDriverLabel, setActiveDriverLabel] = useState<string>('Ready');
  const [liveTestStatus, setLiveTestStatus] = useState<string | null>(null);
  const [cachedInfo, setCachedInfo] = useState<CachedGLTF | null>(null);
  const [assignedToast, setAssignedToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Pose & Keyframe Motion Editor state
  const [motionDraft, setMotionDraft] = useState<CustomMotionPreset>(() =>
    createBlankMotionDraft('idle')
  );
  const [savedPresetId, setSavedPresetId] = useState<string | null>(null);
  const [motionPlayhead, setMotionPlayhead] = useState<number>(0);
  const [motionPlaying, setMotionPlaying] = useState<boolean>(false);
  const [motionSpeed, setMotionSpeed] = useState<number>(1);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [workingBones, setWorkingBones] = useState<Record<string, BonePoseAngles>>({});
  const [workingHipsY, setWorkingHipsY] = useState<number>(0);
  const [isDirtyPose, setIsDirtyPose] = useState<boolean>(false);
  const [selectedPoseBone, setSelectedPoseBone] = useState<string | null>(null);
  const [showLoopGhost, setShowLoopGhost] = useState<boolean>(false);
  const playStartNormRef = useRef<number>(0);
  const captureLivePoseRef = useRef<
    ((slot: CustomClipSlot) => { bones: Record<string, BonePoseAngles>; hipsOffsetY: number } | null) | null
  >(null);

  const filteredAssets = useMemo(() => {
    if (filterCat === 'all') return store.customAssets;
    return store.customAssets.filter((a) => a.category === filterCat);
  }, [store.customAssets, filterCat]);

  const selectedAsset = useMemo(
    () => store.customAssets.find((a) => a.id === selectedId) ?? filteredAssets[0] ?? null,
    [store.customAssets, filteredAssets, selectedId]
  );

  // Ensure selected asset is parsed into cache so we have full bone names, auto-map, and clip diagnostics
  useEffect(() => {
    if (!selectedAsset) {
      setCachedInfo(null);
      return;
    }
    let cancelled = false;
    const sync = getCachedAssetSync(selectedAsset.id);
    if (sync) {
      setCachedInfo(sync);
    } else {
      setCachedInfo(null);
      void loadCustomAssetToCache(selectedAsset.id, selectedAsset.category).then((loaded) => {
        if (!cancelled) setCachedInfo(loaded);
      });
    }
    // Reset active test overrides and initialize Motion Editor draft for newly selected asset
    setTestOverride(null);
    setManualBoneName('');
    setManualAngles({ rx: 0, ry: 0, rz: 0 });
    setMotionPlaying(false);
    setMotionPlayhead(0);
    setIsDirtyPose(false);
    const existing = selectedAsset.customAnimations?.[0];
    if (existing) {
      const cloned: CustomMotionPreset = JSON.parse(JSON.stringify(existing));
      setMotionDraft(cloned);
      setSavedPresetId(cloned.id);
      const startSample = sampleMotionPresetToPose(cloned, 0);
      setWorkingBones(startSample.bones);
      setWorkingHipsY(startSample.hipsOffsetY);
    } else {
      const fresh = createBlankMotionDraft('idle');
      setMotionDraft(fresh);
      setSavedPresetId(null);
      setWorkingBones({});
      setWorkingHipsY(0);
    }
    return () => {
      cancelled = true;
    };
  }, [selectedAsset?.id, selectedAsset?.category]);

  const boneNames = useMemo(() => {
    if (cachedInfo?.skeletonInfo.boneNames.length) return cachedInfo.skeletonInfo.boneNames;
    return selectedAsset?.boneNames ?? [];
  }, [cachedInfo, selectedAsset]);

  const effectiveRig: CustomRigSettings | null = useMemo(() => {
    if (!selectedAsset) return null;
    if (cachedInfo) return resolveRigSettings(cachedInfo, selectedAsset);
    if (selectedAsset.rigSettings) return selectedAsset.rigSettings;
    return {
      mode: selectedAsset.animationClips.length > 0 ? 'auto' : 'procedural',
      boneMap: {},
      limbSwingAxis: 'auto',
      armRelaxAngle: 0,
      armSpreadAngle: 0,
      idleArmSpreadAngle: 0,
      mirrorArmRelax: true,
      mirrorLimbSwing: false,
      motionStrength: 1,
      headMotion: 1,
      facingOffsetDeg: 0,
    };
  }, [cachedInfo, selectedAsset]);

  // Keep manual pose bone selector & Motion Editor selected joint populated with a valid bone
  useEffect(() => {
    if (boneNames.length > 0 && (!manualBoneName || !boneNames.includes(manualBoneName))) {
      const preferred =
        effectiveRig?.boneMap.head ??
        effectiveRig?.boneMap.rightUpperArm ??
        boneNames[0];
      setManualBoneName(preferred);
    }
    if (boneNames.length > 0 && (!selectedPoseBone || !boneNames.includes(selectedPoseBone))) {
      const preferred =
        effectiveRig?.boneMap.rightUpperArm ??
        effectiveRig?.boneMap.head ??
        boneNames[0];
      setSelectedPoseBone(preferred);
    }
  }, [boneNames, effectiveRig?.boneMap.head, effectiveRig?.boneMap.rightUpperArm, manualBoneName, selectedPoseBone]);

  const mappedRoleCount = useMemo(() => {
    if (!effectiveRig) return 0;
    return RIG_BONE_ROLES.filter((r) => Boolean(effectiveRig.boneMap[r.role])).length;
  }, [effectiveRig]);

  const missingCoreRoles = useMemo(() => {
    if (!effectiveRig) return [];
    const coreCheck: RigBoneRole[] = [
      'head',
      'leftUpperArm',
      'rightUpperArm',
      'leftUpperLeg',
      'rightUpperLeg',
    ];
    return coreCheck
      .filter((r) => !effectiveRig.boneMap[r])
      .map((r) => RIG_BONE_ROLES.find((m) => m.role === r)?.label ?? r);
  }, [effectiveRig]);

  const allClipsStatic = useMemo(() => {
    if (!cachedInfo || cachedInfo.clipDiagnostics.length === 0) return false;
    return cachedInfo.clipDiagnostics.every((d) => !d.hasMotion);
  }, [cachedInfo]);

  const isMotionMode = inspectorTab === 'motion' && boneNames.length > 0;

  const effectiveTestOverride: RigTestOverride = useMemo(() => {
    if (isMotionMode) {
      if (motionPlaying && motionDraft.keyframes.length >= 2) {
        return {
          kind: 'presetPreview',
          preset: motionDraft,
          timeNorm: playStartNormRef.current,
          playing: true,
          playbackSpeed: motionSpeed,
        };
      }
      return {
        kind: 'poseSnapshot',
        bones: workingBones,
        hipsOffsetY: workingHipsY,
      };
    }
    return testOverride;
  }, [
    isMotionMode,
    motionPlaying,
    motionSpeed,
    motionDraft,
    motionPlaying ? 0 : motionPlayhead,
    workingBones,
    workingHipsY,
    testOverride,
  ]);

  const ghostStartPose = useMemo(() => {
    if (!isMotionMode || !showLoopGhost || !motionDraft.loop) return null;
    if (motionDraft.keyframes.length === 0) return null;
    const sorted = [...motionDraft.keyframes].sort((a, b) => a.time - b.time);
    return {
      bones: sorted[0].bones,
      hipsOffsetY: sorted[0].hipsOffsetY ?? 0,
    };
  }, [isMotionMode, showLoopGhost, motionDraft]);

  const highlightBoneName = useMemo(() => {
    if (isMotionMode) return selectedPoseBone;
    if (!testOverride) return null;
    if (testOverride.kind === 'manualBone') return testOverride.boneName;
    if (testOverride.kind === 'role') return effectiveRig?.boneMap[testOverride.role] ?? null;
    return null;
  }, [isMotionMode, selectedPoseBone, testOverride, effectiveRig]);

  // Motion Editor & 3D Rig Pick Handlers
  const handleSelectPoseBone = useCallback(
    (boneName: string) => {
      if (inspectorTab === 'rig') {
        setManualBoneName(boneName);
        setManualAngles({ rx: 0, ry: 0, rz: 0 });
        setShowSkeleton(true);
        setTestOverride({
          kind: 'manualBone',
          boneName,
          rxDeg: 0,
          ryDeg: 0,
          rzDeg: 0,
        });
        return;
      }
      setMotionPlaying(false);
      setSelectedPoseBone(boneName);
    },
    [inspectorTab]
  );

  const handleChangePoseBoneAngles = useCallback((boneName: string, angles: BonePoseAngles) => {
    setMotionPlaying(false);
    setIsDirtyPose(true);
    setWorkingBones((prev) => {
      const next = { ...prev };
      if (
        Math.abs(angles[0]) < 0.25 &&
        Math.abs(angles[1]) < 0.25 &&
        Math.abs(angles[2]) < 0.25
      ) {
        delete next[boneName];
      } else {
        next[boneName] = [
          Math.round(angles[0] * 2) / 2,
          Math.round(angles[1] * 2) / 2,
          Math.round(angles[2] * 2) / 2,
        ];
      }
      return next;
    });
  }, []);

  const handleChangeHipsY = useCallback((hipsY: number) => {
    setMotionPlaying(false);
    setIsDirtyPose(true);
    setWorkingHipsY(Math.round(hipsY * 100) / 100);
  }, []);

  const handleResetJoint = useCallback((boneName: string) => {
    setMotionPlaying(false);
    setIsDirtyPose(true);
    setWorkingBones((prev) => {
      if (!(boneName in prev)) return prev;
      const next = { ...prev };
      delete next[boneName];
      return next;
    });
  }, []);

  const handleResetPose = useCallback(() => {
    setMotionPlaying(false);
    setIsDirtyPose(true);
    setWorkingBones({});
    setWorkingHipsY(0);
  }, []);

  const handleApplyPose = useCallback(
    (bones: Record<string, BonePoseAngles>, hipsY: number) => {
      setMotionPlaying(false);
      setIsDirtyPose(true);
      setWorkingBones({ ...bones });
      setWorkingHipsY(hipsY);
    },
    []
  );

  const handleScrubMotion = useCallback(
    (timeNorm: number) => {
      setMotionPlaying(false);
      setMotionPlayhead(timeNorm);
      const sampled = sampleMotionPresetToPose(motionDraft, timeNorm);
      setWorkingBones(sampled.bones);
      setWorkingHipsY(sampled.hipsOffsetY);
      setIsDirtyPose(false);
    },
    [motionDraft]
  );

  const handleToggleMotionPlay = useCallback(() => {
    if (motionPlaying) {
      const sampled = sampleMotionPresetToPose(motionDraft, motionPlayhead);
      setWorkingBones(sampled.bones);
      setWorkingHipsY(sampled.hipsOffsetY);
      setIsDirtyPose(false);
      setMotionPlaying(false);
      return;
    }
    if (motionDraft.keyframes.length < 2) return;
    const startNorm = motionPlayhead >= 0.98 ? 0 : motionPlayhead;
    playStartNormRef.current = startNorm;
    if (startNorm !== motionPlayhead) {
      setMotionPlayhead(0);
    }
    setMotionPlaying(true);
  }, [motionDraft, motionPlayhead, motionPlaying]);

  const handleSaveKeyframe = useCallback(() => {
    setMotionPlaying(false);
    setMotionDraft((prev) => {
      const clonedBones: Record<string, BonePoseAngles> = {};
      for (const [k, v] of Object.entries(workingBones)) {
        clonedBones[k] = [v[0], v[1], v[2]];
      }
      const existingIdx = prev.keyframes.findIndex(
        (kf) => Math.abs(kf.time - motionPlayhead) < 0.018
      );
      let nextKeys: CustomPoseKeyframe[];
      if (existingIdx >= 0) {
        nextKeys = prev.keyframes.map((kf, i) =>
          i === existingIdx
            ? { ...kf, bones: clonedBones, hipsOffsetY: workingHipsY }
            : kf
        );
      } else {
        nextKeys = [
          ...prev.keyframes,
          {
            id: uid(),
            time: Math.round(motionPlayhead * 100) / 100,
            bones: clonedBones,
            hipsOffsetY: workingHipsY,
          },
        ].sort((a, b) => a.time - b.time);
      }
      return { ...prev, keyframes: nextKeys, updatedAt: new Date().toISOString() };
    });
    setIsDirtyPose(false);
  }, [workingBones, workingHipsY, motionPlayhead]);

  const handleDeleteKeyframe = useCallback(
    (kfId: string) => {
      setMotionPlaying(false);
      setMotionDraft((prev) => {
        if (prev.keyframes.length <= 1) return prev;
        const nextKeys = prev.keyframes.filter((k) => k.id !== kfId);
        const nextDraft = { ...prev, keyframes: nextKeys, updatedAt: new Date().toISOString() };
        const sampled = sampleMotionPresetToPose(nextDraft, motionPlayhead);
        setWorkingBones(sampled.bones);
        setWorkingHipsY(sampled.hipsOffsetY);
        setIsDirtyPose(false);
        return nextDraft;
      });
    },
    [motionPlayhead]
  );

  const handleMatchEndToStart = useCallback(() => {
    setMotionPlaying(false);
    setMotionDraft((prev) => {
      const sorted = [...prev.keyframes].sort((a, b) => a.time - b.time);
      if (sorted.length === 0) return prev;
      const start = sorted[0];
      const startBonesCopy: Record<string, BonePoseAngles> = {};
      for (const [k, v] of Object.entries(start.bones)) {
        startBonesCopy[k] = [v[0], v[1], v[2]];
      }
      const startHips = start.hipsOffsetY ?? 0;
      const endIdx = sorted.findIndex((kf) => kf.time >= 0.98);
      let nextKeys: CustomPoseKeyframe[];
      if (endIdx >= 0 && sorted[endIdx].id !== start.id) {
        nextKeys = sorted.map((kf, idx) =>
          idx === endIdx
            ? { ...kf, time: 1, bones: startBonesCopy, hipsOffsetY: startHips }
            : kf
        );
      } else {
        nextKeys = [
          ...sorted,
          {
            id: uid(),
            time: 1,
            bones: startBonesCopy,
            hipsOffsetY: startHips,
          },
        ];
      }
      setMotionPlayhead(1);
      setWorkingBones(startBonesCopy);
      setWorkingHipsY(startHips);
      setIsDirtyPose(false);
      return { ...prev, keyframes: nextKeys, updatedAt: new Date().toISOString() };
    });
  }, []);

  const handleGrabLivePose = useCallback((slot: CustomClipSlot) => {
    setMotionPlaying(false);
    const captured = captureLivePoseRef.current?.(slot);
    if (!captured) return;
    setWorkingBones(captured.bones);
    setWorkingHipsY(captured.hipsOffsetY);
    setIsDirtyPose(true);
  }, []);

  const buildFinalizedDraftForSave = (presetId: string, name: string): CustomMotionPreset => {
    // Automatically include any unkeyed pose edits at the current playhead so nothing is lost on save
    let keys = motionDraft.keyframes;
    if (isDirtyPose || keys.length === 0) {
      const clonedBones: Record<string, BonePoseAngles> = {};
      for (const [k, v] of Object.entries(workingBones)) {
        clonedBones[k] = [v[0], v[1], v[2]];
      }
      const existingIdx = keys.findIndex((kf) => Math.abs(kf.time - motionPlayhead) < 0.018);
      if (existingIdx >= 0) {
        keys = keys.map((kf, i) =>
          i === existingIdx ? { ...kf, bones: clonedBones, hipsOffsetY: workingHipsY } : kf
        );
      } else {
        keys = [
          ...keys,
          {
            id: uid(),
            time: Math.round(motionPlayhead * 100) / 100,
            bones: clonedBones,
            hipsOffsetY: workingHipsY,
          },
        ].sort((a, b) => a.time - b.time);
      }
    }
    return {
      ...motionDraft,
      id: presetId,
      name: name.trim() || motionDraft.name.trim() || `Custom ${motionDraft.slot}`,
      keyframes: keys,
      updatedAt: new Date().toISOString(),
    };
  };

  const handleSavePresetOverwrite = () => {
    if (!selectedAsset || !savedPresetId) return;
    const finalized = buildFinalizedDraftForSave(savedPresetId, motionDraft.name);
    const list = selectedAsset.customAnimations ?? [];
    const exists = list.some((p) => p.id === savedPresetId);
    const nextList = exists
      ? list.map((p) => (p.id === savedPresetId ? finalized : p))
      : [...list, finalized];
    setMotionDraft(finalized);
    setIsDirtyPose(false);
    void store.updateCustomAssetMeta({
      ...selectedAsset,
      customAnimations: nextList,
    });
  };

  const handleSavePresetAsNew = (name: string) => {
    if (!selectedAsset) return;
    const newId = uid();
    const finalized = buildFinalizedDraftForSave(newId, name);
    const nextList = [...(selectedAsset.customAnimations ?? []), finalized];
    setMotionDraft(finalized);
    setSavedPresetId(newId);
    setIsDirtyPose(false);
    void store.updateCustomAssetMeta({
      ...selectedAsset,
      customAnimations: nextList,
    });
  };

  const handleLoadPreset = (preset: CustomMotionPreset) => {
    const cloned: CustomMotionPreset = JSON.parse(JSON.stringify(preset));
    setMotionPlaying(false);
    setMotionDraft(cloned);
    setSavedPresetId(cloned.id);
    setMotionPlayhead(0);
    const startSample = sampleMotionPresetToPose(cloned, 0);
    setWorkingBones(startSample.bones);
    setWorkingHipsY(startSample.hipsOffsetY);
    setIsDirtyPose(false);
  };

  const handleCreateNewDraft = (slot: CustomClipSlot) => {
    const fresh = createBlankMotionDraft(slot);
    setMotionPlaying(false);
    setMotionDraft(fresh);
    setSavedPresetId(null);
    setMotionPlayhead(0);
    setWorkingBones({});
    setWorkingHipsY(0);
    setIsDirtyPose(false);
  };

  const handleDeletePreset = (presetId: string) => {
    if (!selectedAsset) return;
    const nextList = (selectedAsset.customAnimations ?? []).filter((p) => p.id !== presetId);
    const nextDefaults = { ...(selectedAsset.defaultSlotPresets ?? {}) };
    (Object.keys(nextDefaults) as CustomClipSlot[]).forEach((slot) => {
      if (nextDefaults[slot] === presetId) {
        delete nextDefaults[slot];
      }
    });
    if (savedPresetId === presetId) {
      setSavedPresetId(null);
    }
    void store.updateCustomAssetMeta({
      ...selectedAsset,
      customAnimations: nextList,
      defaultSlotPresets: nextDefaults,
    });
  };

  const handleSetDefaultForSlot = (slot: CustomClipSlot, presetId: string | null) => {
    if (!selectedAsset) return;
    const nextDefaults = { ...(selectedAsset.defaultSlotPresets ?? {}) };
    if (presetId) {
      nextDefaults[slot] = presetId;
    } else {
      delete nextDefaults[slot];
    }
    const nextRig =
      presetId && effectiveRig?.mode === 'clips'
        ? { ...effectiveRig, mode: 'auto' as RigAnimationMode }
        : effectiveRig ?? undefined;
    void store.updateCustomAssetMeta({
      ...selectedAsset,
      defaultSlotPresets: nextDefaults,
      rigSettings: nextRig,
    });
  };

  const updateRig = (patch: Partial<CustomRigSettings>) => {
    if (!selectedAsset || !effectiveRig) return;
    const nextRig: CustomRigSettings = {
      ...effectiveRig,
      ...patch,
      boneMap: patch.boneMap ? { ...patch.boneMap } : { ...effectiveRig.boneMap },
      invertedRoles:
        'invertedRoles' in patch
          ? patch.invertedRoles
            ? { ...patch.invertedRoles }
            : undefined
          : effectiveRig.invertedRoles
          ? { ...effectiveRig.invertedRoles }
          : undefined,
    };
    void store.updateCustomAssetMeta({
      ...selectedAsset,
      boneNames: boneNames.length > 0 ? boneNames : selectedAsset.boneNames,
      rigSettings: nextRig,
    });
  };

  const updateBoneRole = (role: RigBoneRole, boneName: string) => {
    if (!effectiveRig) return;
    const nextMap = { ...effectiveRig.boneMap };
    if (boneName) nextMap[role] = boneName;
    else delete nextMap[role];
    updateRig({ boneMap: nextMap });
  };

  const toggleInvertRole = (role: RigBoneRole) => {
    if (!effectiveRig) return;
    const nextInv = { ...(effectiveRig.invertedRoles ?? {}) };
    if (nextInv[role]) {
      delete nextInv[role];
    } else {
      nextInv[role] = true;
    }
    updateRig({ invertedRoles: Object.keys(nextInv).length > 0 ? nextInv : undefined });
  };

  const backfilledThumbIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    let cancelled = false;
    const missing = store.customAssets.filter(
      (a) => !a.thumbnailDataUrl && !backfilledThumbIdsRef.current.has(a.id)
    );
    if (missing.length === 0) return;

    void (async () => {
      for (const asset of missing) {
        if (cancelled) return;
        backfilledThumbIdsRef.current.add(asset.id);
        await new Promise<void>((resolve) => {
          if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => resolve());
          } else {
            window.setTimeout(resolve, 16);
          }
        });
        if (cancelled) return;
        const fresh = await regenerateCustomAssetThumbnail(asset.id, asset.category);
        if (fresh && !cancelled) {
          setCustomAssetThumbnailCache(asset.id, fresh);
          await store.updateCustomAssetMeta({
            ...asset,
            thumbnailDataUrl: fresh,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [store.customAssets, store.updateCustomAssetMeta]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadErr(null);
    setUploading(true);
    try {
      let lastId: string | null = null;
      for (const file of Array.from(files)) {
        if (!/\.(glb|gltf)$/i.test(file.name)) {
          throw new Error(`"${file.name}" is not a .glb or .gltf file.`);
        }
        const meta = await store.uploadCustomGlb(file, uploadCat);
        lastId = meta.id;
      }
      if (lastId) {
        setSelectedId(lastId);
        setPreviewSlot('walk');
      }
    } catch (err) {
      setUploadErr(err instanceof Error ? err.message : 'Could not load that 3D model.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAsset = (assetId: string) => {
    setConfirmDeleteId(null);
    if (selectedId === assetId) {
      const remaining = filteredAssets.filter((a) => a.id !== assetId);
      setSelectedId(remaining[0]?.id ?? null);
    }
    void store.removeCustomAsset(assetId);
  };

  const flashAssigned = (msg: string) => {
    setAssignedToast(msg);
    window.setTimeout(() => setAssignedToast((cur) => (cur === msg ? null : cur)), 2200);
  };

  const triggerCamera = (preset: CameraPreset) => {
    setCameraPreset(preset);
    setCameraResetNonce((n) => n + 1);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-2.5 sm:p-5"
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl max-h-[92dvh] flex flex-col bg-slate-50 dark:bg-[#12151E] text-slate-900 dark:text-[#F3F5FA] rounded-3xl shadow-2xl border border-slate-200/80 dark:border-white/[0.1] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="shrink-0 flex flex-wrap items-center justify-between gap-3 px-5 sm:px-6 py-3.5 bg-white dark:bg-[#171A23] border-b border-slate-200/80 dark:border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#7C5CFF]/15 text-[#7C5CFF] flex items-center justify-center">
              <Box size={19} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight leading-tight">
                3D Asset Vault &amp; Rig Maker
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#949BB0]">
                Import GLB / GLTF models, inspect skeletons, test limb animations, and fine-tune rigging.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Asset Vault"
            className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#1F2430] flex items-center justify-center text-slate-500 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden maker-scroll">
          {/* Left Column: Upload + Library */}
          <div className="w-full lg:w-[340px] xl:w-[360px] shrink-0 lg:h-full lg:overflow-y-auto maker-scroll p-4 sm:p-5 space-y-4 border-b lg:border-b-0 lg:border-r border-slate-200/80 dark:border-white/[0.08]">
            {/* Upload zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                void handleFiles(e.dataTransfer.files);
              }}
              className={`rounded-2xl border-2 border-dashed p-3.5 transition-colors space-y-3 ${
                dragActive
                  ? 'border-[#7C5CFF] bg-[#7C5CFF]/10'
                  : 'border-slate-300 dark:border-white/[0.14] bg-white dark:bg-[#171A23]'
              }`}
            >
              <div className="space-y-1">
                <div className="text-xs font-bold flex items-center gap-1.5">
                  <Upload size={14} className="text-[#7C5CFF]" />
                  <span>{uploading ? 'Processing 3D model…' : 'Drop .glb / .gltf files here'}</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-[#949BB0]">
                  Auto-detects skeletons, bones, and embedded animation clips.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={uploadCat}
                  onChange={(e) => setUploadCat(e.target.value as AssetCategory)}
                  className="flex-1 min-w-0 px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-[#1F2430] text-xs font-semibold border border-slate-200 dark:border-white/[0.08]"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".glb,.gltf"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    void handleFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 rounded-xl bg-[#7C5CFF] hover:bg-[#6A48F5] text-white text-xs font-bold disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  Choose GLB
                </button>
              </div>

              {uploadErr && (
                <div className="px-3 py-2 rounded-xl bg-[#F2545B]/15 text-[#F2545B] text-xs font-semibold">
                  {uploadErr}
                </div>
              )}
            </div>

            {/* Category filter */}
            <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-[#171A23] border border-slate-200 dark:border-white/[0.08]">
              {(['all', 'character', 'prop', 'scenery', 'plant', 'tree', 'building'] as const).map((cat) => {
                const active = filterCat === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFilterCat(cat)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold capitalize transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-[#7C5CFF] text-white'
                        : 'text-slate-600 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {cat === 'all' ? `All (${store.customAssets.length})` : cat}
                  </button>
                );
              })}
            </div>

            {/* Model list grid */}
            {filteredAssets.length === 0 ? (
              <div className="rounded-2xl bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.08] p-7 text-center space-y-2">
                <div className="mx-auto w-11 h-11 rounded-2xl bg-[#7C5CFF]/15 text-[#7C5CFF] flex items-center justify-center">
                  <Layers size={20} />
                </div>
                <div className="text-sm font-bold">No custom 3D models yet</div>
                <p className="text-xs text-slate-500 dark:text-[#949BB0]">
                  Drop a `.glb` character, creature, or prop above to inspect its rig and animations.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {filteredAssets.map((asset) => {
                  const active = selectedAsset?.id === asset.id;
                  const isConfirming = confirmDeleteId === asset.id;
                  return (
                    <div
                      key={asset.id}
                      onMouseLeave={() => {
                        if (isConfirming) setConfirmDeleteId(null);
                      }}
                      className={`relative group rounded-2xl bg-white dark:bg-[#171A23] border p-2 text-left transition-all ${
                        active
                          ? 'border-[#7C5CFF] ring-2 ring-[#7C5CFF]/25'
                          : 'border-slate-200/80 dark:border-white/[0.08] hover:border-[#7C5CFF]/50'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmDeleteId(null);
                          setSelectedId(asset.id);
                        }}
                        className="w-full text-left"
                      >
                        <div className="aspect-square rounded-xl border border-slate-200/70 dark:border-white/[0.07] bg-gradient-to-b from-slate-100 to-slate-200/80 dark:from-[#242A3B] dark:to-[#131621] overflow-hidden flex items-center justify-center mb-2">
                          {asset.thumbnailDataUrl ? (
                            <img
                              src={asset.thumbnailDataUrl}
                              alt={asset.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-contain p-1"
                            />
                          ) : (
                            <Box size={24} className="text-slate-400 dark:text-[#6B7285]" />
                          )}
                        </div>
                        <div className="text-xs font-extrabold truncate">{asset.name}</div>
                        <div className="text-[11px] text-slate-500 dark:text-[#949BB0] mt-0.5 truncate tabular-nums">
                          {asset.hasSkeleton ? 'Rigged' : 'Static'} · {asset.animationClips.length} clips
                        </div>
                      </button>

                      {/* Card-level Delete control */}
                      <div className="absolute top-3 right-3 z-10">
                        {isConfirming ? (
                          <div className="flex items-center gap-1 rounded-lg bg-white/95 dark:bg-[#12151E]/95 p-0.5 shadow-lg border border-[#F2545B]/40">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteAsset(asset.id);
                              }}
                              className="px-1.5 py-0.5 rounded-md bg-[#F2545B] hover:bg-[#DC2626] text-white text-[10px] font-extrabold whitespace-nowrap"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteId(null);
                              }}
                              aria-label="Cancel delete"
                              className="p-0.5 rounded-md text-slate-500 hover:text-slate-900 dark:text-[#949BB0] dark:hover:text-white"
                            >
                              <X size={11} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            title={`Delete "${asset.name}" from Vault`}
                            aria-label={`Delete ${asset.name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(asset.id);
                            }}
                            className={`p-1.5 rounded-lg bg-white/90 dark:bg-[#12151E]/90 border border-slate-200/80 dark:border-white/[0.1] text-slate-500 hover:text-[#F2545B] hover:border-[#F2545B]/50 shadow-sm transition-opacity ${
                              active ? 'opacity-100' : 'opacity-80 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100'
                            }`}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Main Stage: Visual Rig Tester + Tabbed Inspector */}
          <div className="flex-1 min-w-0 lg:h-full lg:overflow-y-auto maker-scroll bg-white dark:bg-[#171A23] p-4 sm:p-5 space-y-4">
            {selectedAsset && effectiveRig ? (
              <>
                {/* Top Identity Row */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <input
                      type="text"
                      value={selectedAsset.name}
                      onChange={(e) =>
                        void store.updateCustomAssetMeta({
                          ...selectedAsset,
                          name: e.target.value,
                        })
                      }
                      aria-label="Model name"
                      className="w-full text-base sm:text-lg font-black bg-transparent border-b border-transparent focus:border-[#7C5CFF] focus:outline-none"
                    />
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-[#949BB0] mt-0.5 tabular-nums">
                      <span className="truncate max-w-[200px]">{selectedAsset.fileName}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatBytes(selectedAsset.byteSize)}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {boneNames.length > 0
                          ? `${boneNames.length} bones (${mappedRoleCount} mapped)`
                          : 'No skeleton'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{selectedAsset.animationClips.length} clips</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      title="Re-render 3D studio thumbnail for this model"
                      onClick={async () => {
                        const fresh = await regenerateCustomAssetThumbnail(
                          selectedAsset.id,
                          selectedAsset.category,
                          selectedAsset.vertexPaintStrokes
                        );
                        if (fresh) {
                          setCustomAssetThumbnailCache(selectedAsset.id, fresh);
                          void store.updateCustomAssetMeta({
                            ...selectedAsset,
                            thumbnailDataUrl: fresh,
                          });
                        }
                      }}
                      className="px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-[#1F2430] hover:bg-slate-200 dark:hover:bg-[#272D3C] text-xs font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                    >
                      <Camera size={13} className="text-[#7C5CFF]" />
                      <span className="hidden sm:inline">Refresh Thumb</span>
                    </button>

                    {boneNames.length > 0 && (
                      <button
                        type="button"
                        onClick={() => store.openMotionStudio(selectedAsset.id)}
                        title="Open this character in the dedicated full-page Character Motion Maker"
                        className="px-3 py-2 rounded-xl bg-[#7C5CFF] hover:bg-[#6A48F5] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                      >
                        <Maximize2 size={13} />
                        <span>Full Motion Page</span>
                      </button>
                    )}

                    {confirmDeleteId === selectedAsset.id ? (
                      <div className="inline-flex items-center gap-1 rounded-xl bg-[#F2545B]/12 border border-[#F2545B]/35 p-0.5">
                        <button
                          type="button"
                          onClick={() => handleDeleteAsset(selectedAsset.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-[#F2545B] hover:bg-[#DC2626] text-white text-xs font-bold whitespace-nowrap transition-colors"
                        >
                          Confirm Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-[#A5AEC4] hover:text-slate-900 dark:hover:text-white"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        title="Delete imported model from 3D Asset Vault"
                        onClick={() => setConfirmDeleteId(selectedAsset.id)}
                        className="px-2.5 py-2 rounded-xl border border-[#F2545B]/25 bg-[#F2545B]/8 text-[#F2545B] hover:bg-[#F2545B]/18 text-xs font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                      >
                        <Trash2 size={14} />
                        <span>Delete Model</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Live Interactive 3D Rig & Animation Stage */}
                <RigPreviewStage
                  asset={selectedAsset}
                  rigSettings={effectiveRig}
                  boneNames={boneNames}
                  previewSlot={previewSlot}
                  paused={isMotionMode ? false : paused}
                  showSkeleton={showSkeleton}
                  xrayMesh={xrayMesh}
                  cameraPreset={cameraPreset}
                  cameraResetNonce={cameraResetNonce}
                  testOverride={effectiveTestOverride}
                  highlightBoneName={highlightBoneName}
                  poseMode={isMotionMode}
                  allowJointPick={inspectorTab === 'rig' && boneNames.length > 0}
                  motionPlaying={motionPlaying}
                  workingBones={workingBones}
                  ghostStartPose={ghostStartPose}
                  onSelectPoseBone={handleSelectPoseBone}
                  onGizmoRotateBone={handleChangePoseBoneAngles}
                  onPlayheadTick={setMotionPlayhead}
                  captureLivePoseRef={captureLivePoseRef}
                  onDriverChange={setActiveDriverLabel}
                  onTestStatusChange={setLiveTestStatus}
                />

                {/* Stage Controls Row: Camera, Bone View, Play/Pause */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (isMotionMode) {
                          handleToggleMotionPlay();
                        } else {
                          setPaused((p) => !p);
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1F2430] hover:bg-slate-200 dark:hover:bg-[#2A3142] font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      {(isMotionMode ? !motionPlaying : paused) ? (
                        <Play size={13} />
                      ) : (
                        <Pause size={13} />
                      )}
                      <span>{(isMotionMode ? !motionPlaying : paused) ? 'Play' : 'Pause'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowSkeleton((v) => !v)}
                      className={`px-3 py-1.5 rounded-lg font-bold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                        showSkeleton
                          ? 'bg-[#06B6D4] text-slate-950'
                          : 'bg-slate-100 dark:bg-[#1F2430] text-slate-700 dark:text-[#C8D0E4] hover:bg-slate-200 dark:hover:bg-[#2A3142]'
                      }`}
                    >
                      <Bone size={13} />
                      <span>{showSkeleton ? 'Bones On' : 'Show Bones'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setXrayMesh((v) => !v)}
                      className={`px-3 py-1.5 rounded-lg font-bold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                        xrayMesh
                          ? 'bg-[#7C5CFF] text-white'
                          : 'bg-slate-100 dark:bg-[#1F2430] text-slate-700 dark:text-[#C8D0E4] hover:bg-slate-200 dark:hover:bg-[#2A3142]'
                      }`}
                    >
                      <Eye size={13} />
                      <span>X-Ray</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    {(
                      [
                        ['front', 'Front'],
                        ['side', 'Side'],
                        ['back', 'Back'],
                        ['threeQuarter', 'Reset'],
                      ] as const
                    ).map(([preset, label]) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => triggerCamera(preset)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1F2430] hover:bg-slate-200 dark:hover:bg-[#2A3142] text-[11px] font-semibold text-slate-600 dark:text-[#A5AEC4] whitespace-nowrap"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Action Test Strip (hidden while inside Motion Editor so timeline sits cleanly under viewport) */}
                {!isMotionMode && (
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-[#949BB0]">
                      <span className="font-semibold text-slate-700 dark:text-[#D7DDF0]">
                        Test Animation
                      </span>
                      <span>
                        {liveTestStatus ? liveTestStatus : `Active: ${activeDriverLabel}`}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {CLIP_SLOTS.map(({ slot, short }) => {
                        const active = !testOverride && previewSlot === slot;
                        const hasCustomDef = Boolean(selectedAsset.defaultSlotPresets?.[slot]);
                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => {
                              setTestOverride(null);
                              setPreviewSlot(slot);
                              setPaused(false);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                              active
                                ? 'bg-[#7C5CFF] text-white'
                                : hasCustomDef
                                ? 'bg-[#20B46A]/15 text-[#16A34A] dark:text-[#34D399] hover:bg-[#20B46A]/25'
                                : 'bg-slate-100 dark:bg-[#1F2430] text-slate-700 dark:text-[#B8C0D6] hover:bg-slate-200 dark:hover:bg-[#282F40]'
                            }`}
                          >
                            {short}
                            {hasCustomDef ? ' ★' : ''}
                          </button>
                        );
                      })}

                      {boneNames.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setPaused(false);
                            setShowSkeleton(true);
                            setTestOverride((cur) =>
                              cur?.kind === 'limbCycle' ? null : { kind: 'limbCycle' }
                            );
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                            testOverride?.kind === 'limbCycle'
                              ? 'bg-[#F59E0B] text-slate-950'
                              : 'bg-[#F59E0B]/15 text-[#D97706] dark:text-[#FBBF24] hover:bg-[#F59E0B]/25'
                          }`}
                        >
                          <Activity size={13} />
                          <span>
                            {testOverride?.kind === 'limbCycle'
                              ? 'Stop Limb Test'
                              : 'Test All Limbs'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Diagnostic Advisory Banner */}
                {boneNames.length === 0 ? (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2.5">
                    <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-500" />
                    <div>
                      <span className="font-bold">No rig bones detected in this GLB.</span> This
                      file appears to be an unrigged static mesh, so individual arms, legs, and head
                      cannot bend. Export with a humanoid armature/skeleton from Tripo, Mixamo, or
                      Blender to animate limbs.
                    </div>
                  </div>
                ) : selectedAsset.clipMap.idle &&
                  effectiveRig.mode !== 'procedural' &&
                  (selectedAsset.clipMap.idle === selectedAsset.clipMap.walk ||
                    /walk|run|sprint|move/i.test(selectedAsset.clipMap.idle)) ? (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-800 dark:text-amber-200 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1 min-w-[200px]">
                      <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-500" />
                      <span>
                        <strong>Idle</strong> is mapped to a walking clip (
                        <code>{selectedAsset.clipMap.idle}</code>), so the character walks in place
                        when standing still.
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const nextMap = { ...selectedAsset.clipMap };
                          delete nextMap.idle;
                          void store.updateCustomAssetMeta({
                            ...selectedAsset,
                            clipMap: nextMap,
                            rigSettings: {
                              ...effectiveRig,
                              mode: 'auto',
                            },
                          });
                          setTestOverride(null);
                          setPreviewSlot('idle');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#7C5CFF] text-white font-bold whitespace-nowrap"
                      >
                        Stand Still When Idle
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void store.updateCustomAssetMeta({
                            ...selectedAsset,
                            clipMap: {},
                            rigSettings: {
                              ...effectiveRig,
                              mode: 'procedural',
                            },
                          });
                          setTestOverride(null);
                          setPreviewSlot('idle');
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-900/10 dark:bg-white/10 font-semibold whitespace-nowrap"
                      >
                        Remove All Clips
                      </button>
                    </div>
                  </div>
                ) : allClipsStatic && effectiveRig.mode === 'clips' ? (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-800 dark:text-amber-200 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1 min-w-[200px]">
                      <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-500" />
                      <span>
                        Embedded clip keyframes appear static (no limb movement). Switch to
                        Procedural Rig to drive the skeleton automatically.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateRig({ mode: 'procedural' })}
                      className="px-3 py-1.5 rounded-lg bg-[#7C5CFF] text-white font-bold whitespace-nowrap"
                    >
                      Use Procedural Rig
                    </button>
                  </div>
                ) : missingCoreRoles.length > 0 ? (
                  <div className="rounded-xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#12151E] px-3.5 py-2.5 text-xs text-slate-600 dark:text-[#A8B0C6] flex flex-wrap items-center justify-between gap-2">
                    <span>
                      Unmapped limbs: <strong className="text-slate-900 dark:text-white">{missingCoreRoles.join(', ')}</strong>.
                      Map their bones so they move naturally.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setInspectorTab('rig');
                        setShowSkeleton(true);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-[#7C5CFF]/15 text-[#7C5CFF] font-bold hover:bg-[#7C5CFF]/25 whitespace-nowrap"
                    >
                      Open Rig &amp; Bones
                    </button>
                  </div>
                ) : null}

                {/* Inspector Section Tabs */}
                <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.08]">
                  {(
                    [
                      ['animation', 'Animation & Motion', Film],
                      [
                        'motion',
                        (selectedAsset.customAnimations?.length ?? 0) > 0
                          ? `Motion Editor (${selectedAsset.customAnimations!.length})`
                          : 'Motion Editor',
                        KeyRound,
                      ],
                      ['rig', `Rig & Bones (${boneNames.length})`, Bone],
                      ['assign', 'Scale & Assign', Sliders],
                    ] as const
                  ).map(([tabId, label, Icon]) => {
                    const active = inspectorTab === tabId;
                    return (
                      <button
                        key={tabId}
                        type="button"
                        onClick={() => {
                          setInspectorTab(tabId);
                          if (tabId !== 'motion') {
                            setMotionPlaying(false);
                          }
                        }}
                        className={`flex-1 px-2.5 py-2 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                          active
                            ? 'bg-white dark:bg-[#1F2430] text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <Icon size={13} />
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* TAB 1B: CUSTOM MOTION & KEYFRAME EDITOR */}
                {inspectorTab === 'motion' && (
                  <div className="space-y-3">
                    {boneNames.length > 0 && (
                      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-[#7C5CFF]/10 border border-[#7C5CFF]/25">
                        <span className="text-xs font-semibold text-slate-700 dark:text-[#CBD2E4]">
                          Want a larger 3D stage, full-width timeline, and body-map joint picker?
                        </span>
                        <button
                          type="button"
                          onClick={() => store.openMotionStudio(selectedAsset.id)}
                          className="px-3 py-1.5 rounded-lg bg-[#7C5CFF] hover:bg-[#6A48F5] text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <Maximize2 size={12} />
                          <span>Open Full Motion Page</span>
                        </button>
                      </div>
                    )}
                    <MotionEditorPanel
                      asset={selectedAsset}
                      rigSettings={effectiveRig}
                      boneNames={boneNames}
                      draft={motionDraft}
                      savedPresetId={savedPresetId}
                      playhead={motionPlayhead}
                      isPlaying={motionPlaying}
                      workingBones={workingBones}
                      workingHipsY={workingHipsY}
                      isDirtyPose={isDirtyPose}
                      selectedBone={selectedPoseBone}
                      showLoopGhost={showLoopGhost}
                      onSelectBone={handleSelectPoseBone}
                      onChangeBoneAngles={handleChangePoseBoneAngles}
                      onChangeHipsY={handleChangeHipsY}
                      onResetJoint={handleResetJoint}
                      onResetPose={handleResetPose}
                      onApplyPose={handleApplyPose}
                      onScrub={handleScrubMotion}
                      onTogglePlay={handleToggleMotionPlay}
                      onUpdateDraft={(patch) =>
                        setMotionDraft((prev) => ({ ...prev, ...patch }))
                      }
                      onSaveKeyframe={handleSaveKeyframe}
                      onDeleteKeyframe={handleDeleteKeyframe}
                      onMatchEndToStart={handleMatchEndToStart}
                      onGrabLivePose={handleGrabLivePose}
                      onToggleLoopGhost={() => setShowLoopGhost((v) => !v)}
                      onLoadPreset={handleLoadPreset}
                      onCreateNewDraft={handleCreateNewDraft}
                      onSaveOverwrite={handleSavePresetOverwrite}
                      onSaveAsNew={handleSavePresetAsNew}
                      onDeletePreset={handleDeletePreset}
                      onSetDefaultForSlot={handleSetDefaultForSlot}
                      playbackSpeed={motionSpeed}
                      onChangePlaybackSpeed={setMotionSpeed}
                    />
                  </div>
                )}

                {/* TAB 1: ANIMATION & MOTION */}
                {inspectorTab === 'animation' && (
                  <div className="space-y-4">
                    {/* Animation Driver Mode */}
                    <div className="space-y-2">
                      <FieldLabel text="Animation Driver" />
                      <div className="grid grid-cols-3 gap-1.5">
                        {(
                          [
                            ['auto', 'Auto', 'Clips + rig fallback'],
                            ['procedural', 'Procedural Rig', 'Drive bones directly'],
                            ['clips', 'Embedded Clips', 'GLB clips only'],
                          ] as [RigAnimationMode, string, string][]
                        ).map(([mode, title, sub]) => {
                          const active = effectiveRig.mode === mode;
                          return (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => updateRig({ mode })}
                              className={`p-2.5 rounded-xl border text-left transition-colors ${
                                active
                                  ? 'border-[#7C5CFF] bg-[#7C5CFF]/12 text-slate-900 dark:text-white'
                                  : 'border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-[#12151E] text-slate-600 dark:text-[#949BB0] hover:border-[#7C5CFF]/40'
                              }`}
                            >
                              <div className="text-xs font-bold">{title}</div>
                              <div className="text-[11px] opacity-75 mt-0.5">{sub}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Facing Direction & Playback Speed */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200/70 dark:border-white/[0.08]">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="inline-flex items-center gap-1.5">
                            <Compass size={13} className="text-[#7C5CFF]" />
                            Forward Facing
                          </span>
                          <div className="flex items-center gap-2">
                            {cachedInfo && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateRig({
                                    facingOffsetDeg: cachedInfo.skeletonInfo.suggestedFacingOffsetDeg ?? 0,
                                  })
                                }
                                title="Auto-align character forward direction from shoulder/foot orientation"
                                className="px-1.5 py-0.5 rounded bg-[#7C5CFF]/15 text-[#7C5CFF] hover:bg-[#7C5CFF]/25 text-[10px] font-bold"
                              >
                                Auto ({cachedInfo.skeletonInfo.suggestedFacingOffsetDeg ?? 0}°)
                              </button>
                            )}
                            <span className="tabular-nums text-slate-500 dark:text-[#949BB0]">
                              {effectiveRig.facingOffsetDeg}°
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                          {FACING_PRESETS.map((deg) => (
                            <button
                              key={deg}
                              type="button"
                              onClick={() => updateRig({ facingOffsetDeg: deg })}
                              className={`py-1.5 rounded-lg text-xs font-bold tabular-nums ${
                                effectiveRig.facingOffsetDeg === deg
                                  ? 'bg-[#7C5CFF] text-white'
                                  : 'bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#A5AEC4]'
                              }`}
                            >
                              {deg}°
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold">
                          <span>Animation Speed</span>
                          <span className="tabular-nums text-slate-500 dark:text-[#949BB0]">
                            {selectedAsset.animSpeed.toFixed(1)}×
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.4}
                          max={2.4}
                          step={0.1}
                          value={selectedAsset.animSpeed}
                          onChange={(e) =>
                            void store.updateCustomAssetMeta({
                              ...selectedAsset,
                              animSpeed: Number(e.target.value),
                            })
                          }
                          className="w-full accent-[#7C5CFF]"
                        />
                      </div>
                    </div>

                    {/* Independent Idle & Walk Arm Width Sliders (works in ALL modes: Auto, Procedural, & Embedded Clips) */}
                    {boneNames.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200/70 dark:border-white/[0.08]">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs font-semibold">
                              <span>Idle Arm Width</span>
                              {Math.abs(effectiveRig.idleArmSpreadAngle ?? 0) >= 1 && (
                                <button
                                  type="button"
                                  onClick={() => updateRig({ idleArmSpreadAngle: 0 })}
                                  className="text-[11px] font-semibold text-[#7C5CFF] hover:underline"
                                >
                                  Reset
                                </button>
                              )}
                            </div>
                            <span className="text-xs font-semibold tabular-nums text-slate-500 dark:text-[#949BB0]">
                              {(effectiveRig.idleArmSpreadAngle ?? 0) > 0 ? '+' : ''}
                              {Math.round(effectiveRig.idleArmSpreadAngle ?? 0)}°
                            </span>
                          </div>
                          <input
                            type="range"
                            min={-65}
                            max={45}
                            step={1}
                            value={effectiveRig.idleArmSpreadAngle ?? 0}
                            onChange={(e) => {
                              setTestOverride(null);
                              setPreviewSlot('idle');
                              updateRig({ idleArmSpreadAngle: Number(e.target.value) });
                            }}
                            className="w-full accent-[#7C5CFF]"
                          />
                          <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-[#8E96AB]">
                            <span>Closer (-65°)</span>
                            <span>Standing idle only</span>
                            <span>Wider (+45°)</span>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs font-semibold">
                              <span>Walk / Action Arm Width</span>
                              {Math.abs(effectiveRig.armSpreadAngle ?? 0) >= 1 && (
                                <button
                                  type="button"
                                  onClick={() => updateRig({ armSpreadAngle: 0 })}
                                  className="text-[11px] font-semibold text-[#7C5CFF] hover:underline"
                                >
                                  Reset
                                </button>
                              )}
                            </div>
                            <span className="text-xs font-semibold tabular-nums text-slate-500 dark:text-[#949BB0]">
                              {(effectiveRig.armSpreadAngle ?? 0) > 0 ? '+' : ''}
                              {Math.round(effectiveRig.armSpreadAngle ?? 0)}°
                            </span>
                          </div>
                          <input
                            type="range"
                            min={-25}
                            max={55}
                            step={1}
                            value={effectiveRig.armSpreadAngle ?? 0}
                            onChange={(e) => {
                              if (previewSlot === 'idle') {
                                setTestOverride(null);
                                setPreviewSlot('walk');
                              }
                              updateRig({ armSpreadAngle: Number(e.target.value) });
                            }}
                            className="w-full accent-[#7C5CFF]"
                          />
                          <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-[#8E96AB]">
                            <span>Closer (-25°)</span>
                            <span>Walk / run / actions</span>
                            <span>Wider (+55°)</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Procedural Rig Motion Tuning */}
                    {boneNames.length > 0 && effectiveRig.mode !== 'clips' && (
                      <div className="space-y-3 pt-2 border-t border-slate-200/70 dark:border-white/[0.08]">
                        <FieldLabel text="Rig Pose &amp; Motion Adjustments" />

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs font-semibold">
                              <span>Base Arm Lower</span>
                              <span className="tabular-nums text-slate-500 dark:text-[#949BB0]">
                                {Math.round(effectiveRig.armRelaxAngle)}°
                              </span>
                            </div>
                            <input
                              type="range"
                              min={-30}
                              max={95}
                              step={1}
                              value={effectiveRig.armRelaxAngle}
                              onChange={(e) =>
                                updateRig({ armRelaxAngle: Number(e.target.value) })
                              }
                              className="w-full accent-[#7C5CFF]"
                            />
                            <div className="text-[10px] text-slate-500 dark:text-[#8E96AB]">
                              Lowers T-pose arms toward sides
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-xs font-semibold">
                              <span>Limb Swing</span>
                              <span className="tabular-nums text-slate-500 dark:text-[#949BB0]">
                                {effectiveRig.motionStrength.toFixed(2)}×
                              </span>
                            </div>
                            <input
                              type="range"
                              min={0.25}
                              max={2.0}
                              step={0.05}
                              value={effectiveRig.motionStrength}
                              onChange={(e) =>
                                updateRig({ motionStrength: Number(e.target.value) })
                              }
                              className="w-full accent-[#7C5CFF]"
                            />
                            <div className="text-[10px] text-slate-500 dark:text-[#8E96AB]">
                              Arm, leg, and torso stride energy
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-xs font-semibold">
                              <span>Head Motion</span>
                              <span className="tabular-nums text-slate-500 dark:text-[#949BB0]">
                                {effectiveRig.headMotion.toFixed(2)}×
                              </span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={2.0}
                              step={0.05}
                              value={effectiveRig.headMotion}
                              onChange={(e) =>
                                updateRig({ headMotion: Number(e.target.value) })
                              }
                              className="w-full accent-[#7C5CFF]"
                            />
                            <div className="text-[10px] text-slate-500 dark:text-[#8E96AB]">
                              Idle look-around and nod depth
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center pt-1">
                          <div className="space-y-1">
                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-[#A5AEC4]">
                              Limb Swing Axis
                            </label>
                            <select
                              value={effectiveRig.limbSwingAxis}
                              onChange={(e) =>
                                updateRig({ limbSwingAxis: e.target.value as RigSwingAxis })
                              }
                              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-xs font-semibold border border-slate-200/70 dark:border-white/[0.08]"
                            >
                              {SWING_AXIS_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer pt-4">
                            <input
                              type="checkbox"
                              checked={effectiveRig.mirrorArmRelax}
                              onChange={(e) =>
                                updateRig({ mirrorArmRelax: e.target.checked })
                              }
                              className="accent-[#7C5CFF] w-4 h-4"
                            />
                            <span>Mirror Arm Lower</span>
                          </label>

                          <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer pt-4">
                            <input
                              type="checkbox"
                              checked={effectiveRig.mirrorLimbSwing}
                              onChange={(e) =>
                                updateRig({ mirrorLimbSwing: e.target.checked })
                              }
                              className="accent-[#7C5CFF] w-4 h-4"
                            />
                            <span>Flip Right Limb Axis</span>
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Embedded GLB Animation Clip Mapper */}
                    {selectedAsset.animationClips.length > 0 && (
                      <div className="space-y-2.5 pt-2 border-t border-slate-200/70 dark:border-white/[0.08]">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <FieldLabel text="Embedded GLB Clips" />
                            <p className="text-[11px] text-slate-500 dark:text-[#949BB0] mt-0.5">
                              Set any slot to None to stand still or use Procedural Rig instead of an imported clip.
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {Object.keys(selectedAsset.clipMap).length > 0 ? (
                              <button
                                type="button"
                                onClick={() => {
                                  void store.updateCustomAssetMeta({
                                    ...selectedAsset,
                                    clipMap: {},
                                    rigSettings: {
                                      ...effectiveRig,
                                      mode: 'procedural',
                                    },
                                  });
                                }}
                                className="px-2.5 py-1 rounded-lg bg-[#F2545B]/12 text-[#F2545B] hover:bg-[#F2545B]/20 text-[11px] font-bold whitespace-nowrap"
                              >
                                Clear All Clips
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  void store.updateCustomAssetMeta({
                                    ...selectedAsset,
                                    clipMap: autoMapAnimationClips(selectedAsset.animationClips),
                                    rigSettings: {
                                      ...effectiveRig,
                                      mode: 'auto',
                                    },
                                  });
                                }}
                                className="px-2.5 py-1 rounded-lg bg-[#7C5CFF]/15 text-[#7C5CFF] hover:bg-[#7C5CFF]/25 text-[11px] font-bold whitespace-nowrap"
                              >
                                Auto-Map Clips
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {CLIP_SLOTS.map(({ slot, label }) => (
                            <div key={slot} className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setTestOverride(null);
                                  setPreviewSlot(slot);
                                }}
                                className={`w-24 shrink-0 px-2.5 py-1.5 rounded-lg text-left text-[11px] font-bold transition-colors ${
                                  !testOverride && previewSlot === slot
                                    ? 'bg-[#7C5CFF] text-white'
                                    : 'bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#A5AEC4]'
                                }`}
                              >
                                {label}
                              </button>
                              <select
                                value={selectedAsset.clipMap[slot] ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value || undefined;
                                  const nextMap = { ...selectedAsset.clipMap, [slot]: val };
                                  if (!val) delete nextMap[slot];
                                  void store.updateCustomAssetMeta({
                                    ...selectedAsset,
                                    clipMap: nextMap,
                                  });
                                  setTestOverride(null);
                                  setPreviewSlot(slot);
                                }}
                                className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-xs font-semibold border border-slate-200/60 dark:border-white/[0.06]"
                              >
                                <option value="">None (Procedural / Standing)</option>
                                {selectedAsset.animationClips.map((c, idx) => {
                                  const diag = cachedInfo?.clipDiagnostics[idx];
                                  const suffix = diag
                                    ? diag.hasMotion
                                      ? ` (${diag.duration}s)`
                                      : ' (static)'
                                    : '';
                                  return (
                                    <option key={c} value={c}>
                                      {c}
                                      {suffix}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Custom Saved Motion Presets Default Selector */}
                    {(selectedAsset.customAnimations?.length ?? 0) > 0 && (
                      <div className="space-y-2 pt-2 border-t border-slate-200/70 dark:border-white/[0.08]">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <FieldLabel text="Default Custom Move per Action" />
                            <p className="text-[11px] text-slate-500 dark:text-[#949BB0] mt-0.5">
                              Choose which saved custom keyframe move plays by default for each action.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setInspectorTab('motion')}
                            className="px-2.5 py-1 rounded-lg bg-[#7C5CFF]/15 text-[#7C5CFF] hover:bg-[#7C5CFF]/25 text-[11px] font-bold whitespace-nowrap"
                          >
                            Edit Moves
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {CLIP_SLOTS.map(({ slot, label }) => {
                            const activePresetId = selectedAsset.defaultSlotPresets?.[slot] ?? '';
                            return (
                              <div key={slot} className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTestOverride(null);
                                    setPreviewSlot(slot);
                                  }}
                                  className={`w-24 shrink-0 px-2.5 py-1.5 rounded-lg text-left text-[11px] font-bold transition-colors ${
                                    !testOverride && previewSlot === slot
                                      ? 'bg-[#7C5CFF] text-white'
                                      : 'bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#A5AEC4]'
                                  }`}
                                >
                                  {label}
                                </button>
                                <select
                                  value={activePresetId}
                                  onChange={(e) => {
                                    handleSetDefaultForSlot(slot, e.target.value || null);
                                    setTestOverride(null);
                                    setPreviewSlot(slot);
                                  }}
                                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-xs font-semibold border border-slate-200/60 dark:border-white/[0.06]"
                                >
                                  <option value="">Built-in / GLB Clip</option>
                                  {selectedAsset.customAnimations!.map((preset) => (
                                    <option key={preset.id} value={preset.id}>
                                      Custom: {preset.name} ({preset.duration.toFixed(1)}s)
                                    </option>
                                  ))}
                                </select>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: RIG & BONES */}
                {inspectorTab === 'rig' && (
                  <div className="space-y-4">
                    {boneNames.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-500 dark:text-[#949BB0]">
                        This model has no detected bones or named limb nodes.
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <FieldLabel text="Humanoid Bone Mapping" />
                            <p className="text-[11px] text-slate-500 dark:text-[#949BB0] mt-0.5">
                              Click any bone dot in 3D to inspect it, Test to wiggle, or ± to invert a limb axis.
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                if (!cachedInfo) return;
                                updateRig({
                                  boneMap: { ...cachedInfo.skeletonInfo.autoBoneMap },
                                  armRelaxAngle: cachedInfo.skeletonInfo.suggestedArmRelaxAngle,
                                  facingOffsetDeg: cachedInfo.skeletonInfo.suggestedFacingOffsetDeg ?? 0,
                                  invertedRoles: undefined,
                                });
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-[#7C5CFF]/15 text-[#7C5CFF] hover:bg-[#7C5CFF]/25 text-xs font-bold inline-flex items-center gap-1.5"
                            >
                              <Wand2 size={12} />
                              <span>Auto-Detect</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setTestOverride(null);
                                if (cachedInfo) {
                                  updateRig({
                                    ...cachedInfo.defaultRigSettings,
                                    invertedRoles: undefined,
                                  });
                                }
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1F2430] hover:bg-slate-200 dark:hover:bg-[#2A3142] text-xs font-semibold inline-flex items-center gap-1"
                            >
                              <RotateCcw size={12} />
                              <span>Reset</span>
                            </button>
                          </div>
                        </div>

                        {/* Quick-Map Bar for 3D-Clicked Bone */}
                        {manualBoneName && (
                          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#06B6D4]/10 border border-[#06B6D4]/30 text-xs">
                            <span className="font-semibold text-slate-700 dark:text-[#D5DCF0] truncate">
                              Selected Bone: <code className="font-bold text-[#0E7490] dark:text-[#22D3EE]">{manualBoneName}</code>
                            </span>
                            <select
                              value=""
                              onChange={(e) => {
                                const role = e.target.value as RigBoneRole;
                                if (role) updateBoneRole(role, manualBoneName);
                              }}
                              className="px-2 py-1 rounded-lg bg-white dark:bg-[#1F2430] text-xs font-bold border border-slate-200/80 dark:border-white/[0.1]"
                            >
                              <option value="">Map to Role…</option>
                              {RIG_BONE_ROLES.map((r) => (
                                <option key={r.role} value={r.role}>
                                  {r.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Grouped Role Rows */}
                        {(
                          [
                            ['core', 'Head & Torso'],
                            ['arms', 'Arms'],
                            ['legs', 'Legs'],
                          ] as const
                        ).map(([groupKey, groupTitle]) => (
                          <div key={groupKey} className="space-y-1.5">
                            <div className="text-[11px] font-bold text-slate-500 dark:text-[#949BB0]">
                              {groupTitle}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {RIG_BONE_ROLES.filter((r) => r.group === groupKey).map(
                                ({ role, label }) => {
                                  const assigned = effectiveRig.boneMap[role] ?? '';
                                  const isTesting =
                                    testOverride?.kind === 'role' && testOverride.role === role;
                                  const isInverted = Boolean(effectiveRig.invertedRoles?.[role]);
                                  return (
                                    <div
                                      key={role}
                                      className={`flex items-center gap-1.5 p-1.5 rounded-xl border ${
                                        isTesting
                                          ? 'border-[#F59E0B] bg-[#F59E0B]/10'
                                          : 'border-slate-200/80 dark:border-white/[0.08] bg-slate-50 dark:bg-[#12151E]'
                                      }`}
                                    >
                                      <span className="w-28 shrink-0 text-[11px] font-semibold truncate px-1">
                                        {label}
                                      </span>
                                      <select
                                        value={assigned}
                                        onChange={(e) => updateBoneRole(role, e.target.value)}
                                        className="flex-1 min-w-0 px-2 py-1 rounded-lg bg-white dark:bg-[#1F2430] text-xs font-medium border border-slate-200/70 dark:border-white/[0.08]"
                                      >
                                        <option value="">Unassigned</option>
                                        {boneNames.map((bn) => (
                                          <option key={bn} value={bn}>
                                            {bn}
                                          </option>
                                        ))}
                                      </select>
                                      <button
                                        type="button"
                                        disabled={!assigned}
                                        onClick={() => toggleInvertRole(role)}
                                        title="Invert bend direction for this limb"
                                        className={`px-1.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-colors disabled:opacity-35 ${
                                          isInverted
                                            ? 'bg-[#EF4444]/20 text-[#DC2626] dark:text-[#F87171]'
                                            : 'bg-slate-200/60 dark:bg-[#232837] text-slate-500 dark:text-[#8E96AB] hover:text-slate-900 dark:hover:text-white'
                                        }`}
                                      >
                                        ±
                                      </button>
                                      <button
                                        type="button"
                                        disabled={!assigned}
                                        onClick={() => {
                                          setPaused(false);
                                          setShowSkeleton(true);
                                          setTestOverride((cur) =>
                                            cur?.kind === 'role' && cur.role === role
                                              ? null
                                              : { kind: 'role', role }
                                          );
                                        }}
                                        className={`px-2 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-colors disabled:opacity-35 ${
                                          isTesting
                                            ? 'bg-[#F59E0B] text-slate-950'
                                            : 'bg-slate-200/80 dark:bg-[#272D3D] text-slate-700 dark:text-[#D5DCF0] hover:bg-[#7C5CFF] hover:text-white'
                                        }`}
                                      >
                                        {isTesting ? 'Stop' : 'Test'}
                                      </button>
                                    </div>
                                  );
                                }
                              )}
                            </div>
                          </div>
                        ))}

                        {/* Direct Bone Pose Tester (verify any bone's skinning weights live) */}
                        <div className="space-y-3 pt-3 border-t border-slate-200/70 dark:border-white/[0.08]">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <FieldLabel text="Direct Bone Pose Tester" />
                              <p className="text-[11px] text-slate-500 dark:text-[#949BB0] mt-0.5">
                                Rotate any individual bone in the skeleton to verify it bends the mesh.
                              </p>
                            </div>
                            {testOverride?.kind === 'manualBone' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setManualAngles({ rx: 0, ry: 0, rz: 0 });
                                  setTestOverride(null);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-xs font-semibold hover:bg-slate-200 dark:hover:bg-[#2A3142]"
                              >
                                Exit Pose Test
                              </button>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={manualBoneName}
                              onChange={(e) => {
                                const nextName = e.target.value;
                                setManualBoneName(nextName);
                                setManualAngles({ rx: 0, ry: 0, rz: 0 });
                                setShowSkeleton(true);
                                setTestOverride({
                                  kind: 'manualBone',
                                  boneName: nextName,
                                  rxDeg: 0,
                                  ryDeg: 0,
                                  rzDeg: 0,
                                });
                              }}
                              className="flex-1 min-w-[180px] px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-xs font-semibold border border-slate-200/70 dark:border-white/[0.08]"
                            >
                              {boneNames.map((bn) => (
                                <option key={bn} value={bn}>
                                  {bn}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                setManualAngles({ rx: 0, ry: 0, rz: 0 });
                                if (manualBoneName) {
                                  setTestOverride({
                                    kind: 'manualBone',
                                    boneName: manualBoneName,
                                    rxDeg: 0,
                                    ryDeg: 0,
                                    rzDeg: 0,
                                  });
                                }
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-xs font-semibold"
                            >
                              Zero Angles
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {(
                              [
                                ['rx', 'Rotate X (Pitch)'],
                                ['ry', 'Rotate Y (Yaw)'],
                                ['rz', 'Rotate Z (Roll)'],
                              ] as const
                            ).map(([axis, label]) => (
                              <div key={axis} className="space-y-1">
                                <div className="flex justify-between text-xs font-semibold">
                                  <span>{label}</span>
                                  <span className="tabular-nums text-slate-500 dark:text-[#949BB0]">
                                    {manualAngles[axis]}°
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={-120}
                                  max={120}
                                  step={1}
                                  value={manualAngles[axis]}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    const next = { ...manualAngles, [axis]: val };
                                    setManualAngles(next);
                                    setShowSkeleton(true);
                                    setTestOverride({
                                      kind: 'manualBone',
                                      boneName: manualBoneName,
                                      rxDeg: next.rx,
                                      ryDeg: next.ry,
                                      rzDeg: next.rz,
                                    });
                                  }}
                                  className="w-full accent-[#06B6D4]"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* TAB 3: SCALE & ASSIGN */}
                {inspectorTab === 'assign' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold">
                          <span>Default Scale</span>
                          <span className="tabular-nums text-slate-500 dark:text-[#949BB0]">
                            {selectedAsset.defaultScale.toFixed(2)}×
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.05}
                          max={6}
                          step={0.05}
                          value={selectedAsset.defaultScale}
                          onChange={(e) =>
                            void store.updateCustomAssetMeta({
                              ...selectedAsset,
                              defaultScale: Number(e.target.value),
                            })
                          }
                          className="w-full accent-[#7C5CFF]"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold">
                          <span>Ground Height Offset</span>
                          <span className="tabular-nums text-slate-500 dark:text-[#949BB0]">
                            {(
                              selectedAsset.groundOffset -
                              (cachedInfo?.baseGroundOffset ?? selectedAsset.groundOffset)
                            ).toFixed(2)}
                            m
                          </span>
                        </div>
                        <input
                          type="range"
                          min={-1.2}
                          max={1.2}
                          step={0.02}
                          value={Number(
                            (
                              selectedAsset.groundOffset -
                              (cachedInfo?.baseGroundOffset ?? selectedAsset.groundOffset)
                            ).toFixed(2)
                          )}
                          onChange={(e) => {
                            const delta = Number(e.target.value);
                            const base = cachedInfo?.baseGroundOffset ?? 0;
                            void store.updateCustomAssetMeta({
                              ...selectedAsset,
                              groundOffset: Number((base + delta).toFixed(3)),
                            });
                          }}
                          className="w-full accent-[#7C5CFF]"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-slate-600 dark:text-[#A5AEC4]">
                        Asset Category:
                      </span>
                      {CATEGORIES.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() =>
                            void store.updateCustomAssetMeta({
                              ...selectedAsset,
                              category: c.id,
                            })
                          }
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                            selectedAsset.category === c.id
                              ? 'bg-[#7C5CFF] text-white'
                              : 'bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#A5AEC4]'
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>

                    {store.currentProject && (
                      <div className="space-y-2 pt-3 border-t border-slate-200/70 dark:border-white/[0.08]">
                        <FieldLabel text="Use in Current Game" />
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              store.updateProject('set hero 3D model', (p) => ({
                                ...p,
                                heroCustomAssetId: selectedAsset.id,
                              }));
                              flashAssigned(`Hero set to ${selectedAsset.name}`);
                            }}
                            className="py-2.5 px-3 rounded-xl bg-[#7C5CFF] hover:bg-[#6A48F5] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5"
                          >
                            <User size={14} />
                            <span>Use as Hero Model</span>
                          </button>

                          {store.currentEntity && (
                            <button
                              type="button"
                              onClick={() => {
                                store.updateEntity(
                                  store.currentEntity!.id,
                                  'assign 3D model',
                                  (ent) => ({ ...ent, customAssetId: selectedAsset.id })
                                );
                                flashAssigned(`Assigned to ${store.currentEntity!.name}`);
                              }}
                              className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-[#1F2430] hover:bg-slate-200 dark:hover:bg-[#272D3C] text-xs font-bold inline-flex items-center justify-center gap-1.5"
                            >
                              <Sparkles size={14} className="text-[#F59E0B]" />
                              <span className="truncate">
                                Assign to &ldquo;{store.currentEntity.name}&rdquo;
                              </span>
                            </button>
                          )}

                          {store.currentLevel && (
                            <button
                              type="button"
                              onClick={() => {
                                const kind =
                                  selectedAsset.category === 'character'
                                    ? 'npc'
                                    : selectedAsset.category === 'scenery'
                                    ? 'scenery'
                                    : 'prop';
                                store.addEntity(
                                  kind,
                                  selectedAsset.name,
                                  {
                                    x: 0.45 + Math.random() * 0.15,
                                    y: 0.45 + Math.random() * 0.15,
                                  },
                                  selectedAsset.id
                                );
                                flashAssigned(`Dropped ${selectedAsset.name} onto level`);
                              }}
                              className="py-2.5 px-3 rounded-xl bg-[#20B46A]/15 text-[#20B46A] hover:bg-[#20B46A]/25 text-xs font-bold inline-flex items-center justify-center gap-1.5"
                            >
                              <Box size={14} />
                              <span>Drop onto Level</span>
                            </button>
                          )}
                        </div>

                        {assignedToast && (
                          <div className="flex items-center gap-1.5 text-xs font-bold text-[#20B46A] pt-1">
                            <Check size={14} />
                            <span>{assignedToast}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="h-full min-h-[320px] flex flex-col items-center justify-center text-center px-6 py-12 space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-[#7C5CFF]/15 text-[#7C5CFF] flex items-center justify-center">
                  <Bone size={22} />
                </div>
                <div className="text-sm font-bold">Select or upload a 3D model</div>
                <p className="text-xs text-slate-500 dark:text-[#949BB0] max-w-sm">
                  Inspect bones visually, test walk/run/attack/limb animations, and adjust rigging
                  settings right before bringing your model into the game.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
