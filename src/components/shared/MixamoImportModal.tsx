import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Film,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import type {
  CustomAssetMeta,
  CustomClipSlot,
  CustomMotionPreset,
  CustomRigSettings,
  MotionActorCategory,
  MotionRigArchetype,
} from '../../types/maker';
import type { CachedGLTF } from '../../three/gltfAssetManager';
import {
  convertClipToMotionPreset,
  parseMotionAssetFile,
  parseMotionFromCachedGLTF,
  suggestSlotForMotionClip,
  type ParsedMotionSource,
} from '../../three/mixamoMotionImporter';
import { getSlotsForActorCategory } from '../../data/motionLibrary';

interface MixamoImportModalProps {
  actorLabel: string;
  targetCategory: MotionActorCategory;
  targetArchetype: MotionRigArchetype;
  targetRig: CustomRigSettings | null;
  targetBoneNames: string[];
  targetHipsHeightRef: number;
  selectedAsset: CustomAssetMeta | null;
  cachedInfo: CachedGLTF | null;
  onImportPreset: (preset: CustomMotionPreset, summary: string) => void;
  onClose: () => void;
}

const KEYFRAME_DENSITIES: { count: number; label: string; hint: string }[] = [
  { count: 10, label: 'Compact (10)', hint: 'Easy hand-editing' },
  { count: 16, label: 'Balanced (16)', hint: 'Recommended' },
  { count: 24, label: 'Detailed (24)', hint: 'High fidelity' },
];

export const MixamoImportModal: React.FC<MixamoImportModalProps> = ({
  actorLabel,
  targetCategory,
  targetArchetype,
  targetRig,
  targetBoneNames,
  targetHipsHeightRef,
  selectedAsset,
  cachedInfo,
  onImportPreset,
  onClose,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [source, setSource] = useState<ParsedMotionSource | null>(null);
  const [selectedClipIdx, setSelectedClipIdx] = useState<number>(0);
  const [moveName, setMoveName] = useState<string>('');
  const [slot, setSlot] = useState<CustomClipSlot>('walk');
  const [targetKeyframes, setTargetKeyframes] = useState<number>(16);
  const [loop, setLoop] = useState<boolean>(true);
  const [fitArmRestPose, setFitArmRestPose] = useState<boolean>(true);
  const [armSpreadAdjustDeg, setArmSpreadAdjustDeg] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const slotOptions = useMemo(
    () => getSlotsForActorCategory(targetCategory, targetArchetype),
    [targetCategory, targetArchetype]
  );

  const applyClipSelection = (src: ParsedMotionSource, idx: number) => {
    const diag = src.diagnostics[idx];
    const clipTitle = diag?.name || src.clips[idx]?.name || 'Mixamo Motion';
    const guessedSlot = suggestSlotForMotionClip(clipTitle);
    const isOneShot =
      guessedSlot === 'attack' ||
      guessedSlot === 'jump' ||
      guessedSlot === 'dying' ||
      guessedSlot === 'swing' ||
      guessedSlot === 'throw' ||
      guessedSlot === 'punch' ||
      guessedSlot === 'kick' ||
      guessedSlot === 'stab';
    setSelectedClipIdx(idx);
    setMoveName(clipTitle.replace(/^mixamo\.com$/i, 'Mixamo Motion'));
    setSlot(guessedSlot);
    setLoop(!isOneShot);
  };

  useEffect(() => {
    if (!source && cachedInfo && cachedInfo.animations.length > 0 && selectedAsset) {
      const embedded = parseMotionFromCachedGLTF(cachedInfo, selectedAsset.name);
      setSource(embedded);
      applyClipSelection(embedded, 0);
    }
  }, [cachedInfo, selectedAsset, source]);

  const handleFile = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setLoading(true);
    try {
      const parsed = await parseMotionAssetFile(files[0]);
      setSource(parsed);
      applyClipSelection(parsed, 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse animation file.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!source) return;
    setError(null);
    try {
      const result = convertClipToMotionPreset({
        source,
        clipIndex: selectedClipIdx,
        name: moveName,
        slot,
        targetKeyframes,
        loop,
        fitArmRestPose,
        armSpreadAdjustDeg,
        targetRig,
        targetCached: cachedInfo,
        targetBoneNames,
        targetHipsHeightRef,
        targetArchetype,
        targetCategory,
      });
      const note = result.warning
        ? `Imported "${result.preset.name}" (${result.matchedRoles} bones)`
        : `Loaded Mixamo "${result.preset.name}" (${result.preset.keyframes.length} keys)`;
      onImportPreset(result.preset, note);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not convert animation clip.');
    }
  };

  const activeDiag = source?.diagnostics[selectedClipIdx];
  const mappedRoleCount = source ? Object.keys(source.skeletonInfo.autoBoneMap).length : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-3 sm:p-6">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-[#171A23] border border-slate-200 dark:border-white/[0.1] shadow-2xl overflow-hidden text-slate-900 dark:text-white">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200/80 dark:border-white/[0.08]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#7C5CFF]/15 text-[#7C5CFF] flex items-center justify-center shrink-0">
              <Film size={16} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-extrabold truncate">
                Import Mixamo Motion · {actorLabel}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-[#949BB0] truncate">
                Convert Mixamo .fbx or .glb animations into editable timeline keyframes
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Mixamo importer"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1F2430]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Upload Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              void handleFile(e.dataTransfer.files);
            }}
            className="rounded-xl border-2 border-dashed border-slate-300 dark:border-white/[0.14] bg-slate-50 dark:bg-[#12151E] p-4 flex flex-col sm:flex-row items-center justify-between gap-3"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".fbx,.glb,.gltf"
              className="hidden"
              onChange={(e) => {
                void handleFile(e.target.files);
                e.target.value = '';
              }}
            />
            <div className="space-y-0.5 text-center sm:text-left">
              <div className="text-xs font-bold">
                {source && source.format !== 'embedded'
                  ? `Loaded: ${source.fileName}`
                  : 'Upload a Mixamo .FBX or .GLB Motion File'}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-[#949BB0]">
                Works with Mixamo &ldquo;Without Skin&rdquo; FBX downloads, full character FBXs, or animated GLBs.
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {cachedInfo && cachedInfo.animations.length > 0 && selectedAsset && source?.format !== 'embedded' && (
                <button
                  type="button"
                  onClick={() => {
                    const emb = parseMotionFromCachedGLTF(cachedInfo, selectedAsset.name);
                    setSource(emb);
                    applyClipSelection(emb, 0);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-200/80 dark:bg-[#1F2430] hover:bg-slate-300 dark:hover:bg-[#2A3142] text-xs font-bold whitespace-nowrap"
                >
                  Use GLB Clip
                </button>
              )}
              <button
                type="button"
                disabled={loading}
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 rounded-lg bg-[#7C5CFF] hover:bg-[#6A48F5] text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Upload size={13} />
                <span>{loading ? 'Reading…' : 'Choose .FBX / .GLB'}</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-[#F2545B]/40 bg-[#F2545B]/10 px-3.5 py-2.5 text-xs text-[#DC2626] dark:text-[#FCA5A5] flex items-start gap-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {source && (
            <>
              {/* Source Rig Status */}
              <div className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50 dark:bg-[#12151E] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-[#20B46A] shrink-0" />
                  <span className="font-semibold">
                    {source.format === 'embedded'
                      ? 'Embedded GLB Clip Source'
                      : `${source.format.toUpperCase()} Armature`}
                  </span>
                  <span className="text-slate-500 dark:text-[#949BB0]">
                    · {mappedRoleCount} humanoid roles mapped · Source arms{' '}
                    {Math.round(source.sourceArmAngleFromDownDeg)}°
                  </span>
                </div>
                {activeDiag && (
                  <span className="font-mono text-[11px] text-slate-600 dark:text-[#A5AEC4]">
                    {activeDiag.duration}s · {activeDiag.trackCount} tracks
                  </span>
                )}
              </div>

              {/* Clip selector if > 1 clip */}
              {source.clips.length > 1 && (
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-[#A5AEC4]">
                    Animation Clip
                  </label>
                  <select
                    value={selectedClipIdx}
                    onChange={(e) => applyClipSelection(source, Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-[#1F2430] border border-slate-200/80 dark:border-white/[0.08] text-xs font-semibold"
                  >
                    {source.diagnostics.map((d, i) => (
                      <option key={`${d.name}_${i}`} value={i}>
                        {d.name} ({d.duration}s{d.hasMotion ? '' : ' · static'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Name & Action Slot */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-[#A5AEC4]">
                    Move Name
                  </label>
                  <input
                    type="text"
                    value={moveName}
                    onChange={(e) => setMoveName(e.target.value)}
                    placeholder="e.g. Mixamo Swagger Walk"
                    className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-[#1F2430] border border-slate-200/80 dark:border-white/[0.08] text-xs font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-[#A5AEC4]">
                    Action Slot
                  </label>
                  <select
                    value={slot}
                    onChange={(e) => setSlot(e.target.value as CustomClipSlot)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-[#1F2430] border border-slate-200/80 dark:border-white/[0.08] text-xs font-semibold"
                  >
                    {slotOptions.map((opt) => (
                      <option key={opt.slot} value={opt.slot}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Keyframe Density */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-[#A5AEC4]">
                  <span>Timeline Keyframe Density</span>
                  <span>Preserves peaks &amp; contact poses</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {KEYFRAME_DENSITIES.map((opt) => {
                    const active = targetKeyframes === opt.count;
                    return (
                      <button
                        key={opt.count}
                        type="button"
                        onClick={() => setTargetKeyframes(opt.count)}
                        className={`p-2 rounded-xl border text-left transition-colors ${
                          active
                            ? 'border-[#7C5CFF] bg-[#7C5CFF]/12 text-slate-900 dark:text-white'
                            : 'border-slate-200/80 dark:border-white/[0.08] bg-slate-50 dark:bg-[#12151E] text-slate-600 dark:text-[#949BB0]'
                        }`}
                      >
                        <div className="text-xs font-bold">{opt.label}</div>
                        <div className="text-[10px] opacity-80">{opt.hint}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Loop & Retarget Fit Options */}
              <div className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50 dark:bg-[#12151E] p-3.5 space-y-3">
                <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={loop}
                      onChange={(e) => setLoop(e.target.checked)}
                      className="accent-[#7C5CFF] w-4 h-4"
                    />
                    <span>Seamless Loop</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fitArmRestPose}
                      onChange={(e) => setFitArmRestPose(e.target.checked)}
                      className="accent-[#7C5CFF] w-4 h-4"
                    />
                    <span>Auto-Fit T-Pose ↔ A-Pose Arms</span>
                  </label>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold">
                    <span className="text-slate-600 dark:text-[#A5AEC4]">
                      Shoulder Width Trim (prevent hip clipping on stylized characters)
                    </span>
                    <span className="font-mono tabular-nums">
                      {armSpreadAdjustDeg > 0 ? '+' : ''}
                      {armSpreadAdjustDeg}°
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-25}
                    max={35}
                    step={1}
                    value={armSpreadAdjustDeg}
                    onChange={(e) => setArmSpreadAdjustDeg(Number(e.target.value))}
                    className="w-full accent-[#7C5CFF]"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#12151E]">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-[#A5AEC4] hover:bg-slate-200/70 dark:hover:bg-[#1F2430]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!source}
            onClick={handleConfirm}
            className="px-4 py-2 rounded-xl bg-[#7C5CFF] hover:bg-[#6A48F5] disabled:opacity-40 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm"
          >
            <Sparkles size={13} />
            <span>Load onto Timeline</span>
          </button>
        </div>
      </div>
    </div>
  );
};
