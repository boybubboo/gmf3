import React, { useMemo, useState } from 'react';
import {
  Camera,
  Check,
  FlipHorizontal2,
  KeyRound,
  Pencil,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  User,
  X,
} from 'lucide-react';
import type { SavedPosePreset } from '../../types/maker';

export interface SavedPosesSidebarProps {
  poses: SavedPosePreset[];
  activePoseId: string | null;
  currentPosedJointCount: number;
  currentPlayheadPercent: number;
  disabled?: boolean;
  onCapturePose: (name: string) => void;
  onApplyPose: (
    pose: SavedPosePreset,
    opts?: { mirror?: boolean; saveKeyframe?: boolean }
  ) => void;
  onOverwritePose: (poseId: string) => void;
  onRenamePose: (poseId: string, nextName: string) => void;
  onDeletePose: (poseId: string) => void;
}

export const SavedPosesSidebar: React.FC<SavedPosesSidebarProps> = ({
  poses,
  activePoseId,
  currentPosedJointCount,
  currentPlayheadPercent,
  disabled = false,
  onCapturePose,
  onApplyPose,
  onOverwritePose,
  onRenamePose,
  onDeletePose,
}) => {
  const [poseNameInput, setPoseNameInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingPoseId, setEditingPoseId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const filteredPoses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return poses;
    return poses.filter((p) => p.name.toLowerCase().includes(q));
  }, [poses, searchQuery]);

  const handleCaptureSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (disabled) return;
    onCapturePose(poseNameInput.trim());
    setPoseNameInput('');
  };

  const startRename = (pose: SavedPosePreset) => {
    setEditingPoseId(pose.id);
    setEditingName(pose.name);
  };

  const commitRename = () => {
    if (!editingPoseId) return;
    const trimmed = editingName.trim();
    if (trimmed) {
      onRenamePose(editingPoseId, trimmed);
    }
    setEditingPoseId(null);
    setEditingName('');
  };

  return (
    <div className="space-y-3">
      {/* Capture Current Pose Form */}
      <form
        onSubmit={handleCaptureSubmit}
        className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.08] space-y-2"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-slate-600 dark:text-[#C8D0E4]">
            Capture Pose
          </span>
          <span className="text-[10px] font-semibold tabular-nums text-slate-500 dark:text-[#8E96AB]">
            {currentPosedJointCount > 0 ? `${currentPosedJointCount} joints posed` : 'Rest pose'}
          </span>
        </div>

        <input
          type="text"
          value={poseNameInput}
          onChange={(e) => setPoseNameInput(e.target.value)}
          disabled={disabled}
          placeholder={`Pose ${poses.length + 1} (e.g. Walk Stride)`}
          aria-label="New saved pose name"
          className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#1A1F2C] border border-slate-200/80 dark:border-white/[0.1] text-xs font-semibold placeholder:text-slate-400 dark:placeholder:text-[#6B7285] focus:outline-none focus:border-[#7C5CFF] disabled:opacity-45"
        />

        <button
          type="submit"
          disabled={disabled}
          className="w-full py-2 px-3 rounded-lg bg-[#7C5CFF] hover:bg-[#6A48F5] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-45"
        >
          <Camera size={13} />
          <span>Capture Current Pose</span>
        </button>
      </form>

      {/* Search when library grows */}
      {poses.length >= 5 && (
        <div className="relative">
          <Search
            size={12}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter saved poses…"
            aria-label="Filter saved poses"
            className="w-full pl-7 pr-7 py-1.5 rounded-lg bg-slate-100 dark:bg-[#12151E] border border-slate-200/70 dark:border-white/[0.08] text-xs font-medium focus:outline-none focus:border-[#7C5CFF]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear pose filter"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}

      {/* Saved Pose Thumbnails Grid */}
      {poses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-white/[0.12] p-4 text-center space-y-2">
          <div className="mx-auto w-9 h-9 rounded-xl bg-[#7C5CFF]/15 text-[#7C5CFF] flex items-center justify-center">
            <Sparkles size={16} />
          </div>
          <div className="text-xs font-bold text-slate-700 dark:text-[#D5DCF0]">
            No Saved Poses Yet
          </div>
          <p className="text-[11px] text-slate-500 dark:text-[#8E96AB] leading-relaxed">
            Pose your character&apos;s joints in the 3D stage and click{' '}
            <strong className="text-slate-700 dark:text-white">Capture Current Pose</strong> to save
            reusable thumbnails you can drop onto any frame.
          </p>
        </div>
      ) : filteredPoses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-white/[0.1] p-3 text-center text-[11px] text-slate-500 dark:text-[#8E96AB]">
          No poses match &ldquo;{searchQuery}&rdquo;.
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-[#8E96AB]">
            <span>Tap thumbnail to apply to {currentPlayheadPercent}%</span>
            <span className="tabular-nums">{filteredPoses.length}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {filteredPoses.map((pose) => {
              const isActive = activePoseId === pose.id;
              const isEditing = editingPoseId === pose.id;
              const jointCount = Object.keys(pose.bones).length;

              return (
                <div
                  key={pose.id}
                  className={`group rounded-xl border overflow-hidden transition-colors flex flex-col ${
                    isActive
                      ? 'border-[#7C5CFF] bg-[#7C5CFF]/10'
                      : 'border-slate-200/80 dark:border-white/[0.08] bg-slate-50 dark:bg-[#12151E] hover:border-[#7C5CFF]/55'
                  }`}
                >
                  {/* Thumbnail Click Target: Apply Pose to Current Frame */}
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onApplyPose(pose)}
                    title={`Apply "${pose.name}" to current frame (${currentPlayheadPercent}%)`}
                    className="relative aspect-square w-full bg-[#111521] overflow-hidden focus:outline-none disabled:opacity-50"
                  >
                    {pose.thumbnailDataUrl ? (
                      <img
                        src={pose.thumbnailDataUrl}
                        alt={pose.name}
                        className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#5B647A]">
                        <User size={28} />
                      </div>
                    )}

                    {/* Joint count badge */}
                    <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-[#0F1117]/80 text-[9px] font-bold text-[#D5DCF0] tabular-nums">
                      {jointCount > 0 ? `${jointCount}j` : 'Rest'}
                    </span>

                    {/* Hover Apply prompt */}
                    <div className="absolute inset-0 bg-[#0F1117]/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-1.5">
                      <span className="px-2 py-1 rounded-lg bg-[#7C5CFF] text-white text-[10px] font-extrabold shadow">
                        Apply Frame
                      </span>
                    </div>
                  </button>

                  {/* Card Footer: Name + Quick Actions */}
                  <div className="p-1.5 space-y-1.5 flex-1 flex flex-col justify-between">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename();
                            if (e.key === 'Escape') {
                              setEditingPoseId(null);
                              setEditingName('');
                            }
                          }}
                          autoFocus
                          aria-label="Rename pose"
                          className="min-w-0 flex-1 px-1.5 py-0.5 rounded bg-white dark:bg-[#1F2430] border border-[#7C5CFF] text-[11px] font-bold focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={commitRename}
                          aria-label="Save pose name"
                          className="p-0.5 rounded text-[#20B46A] hover:bg-[#20B46A]/15"
                        >
                          <Check size={12} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className="text-[11px] font-extrabold truncate text-slate-800 dark:text-white"
                          title={pose.name}
                        >
                          {pose.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => startRename(pose)}
                          title="Rename pose"
                          aria-label={`Rename ${pose.name}`}
                          className="p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white shrink-0 opacity-70 hover:opacity-100"
                        >
                          <Pencil size={10} />
                        </button>
                      </div>
                    )}

                    {/* Quick Action Strip */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onApplyPose(pose, { saveKeyframe: true })}
                        title={`Apply "${pose.name}" and save keyframe at ${currentPlayheadPercent}%`}
                        className="flex-1 py-1 px-1.5 rounded-md bg-[#7C5CFF]/15 hover:bg-[#7C5CFF] text-[#6A48F5] dark:text-[#C4B5FD] hover:text-white text-[10px] font-bold inline-flex items-center justify-center gap-1 transition-colors disabled:opacity-40"
                      >
                        <KeyRound size={10} />
                        <span>+Key</span>
                      </button>

                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onApplyPose(pose, { mirror: true })}
                        title={`Apply mirrored (L↔R) version of "${pose.name}" to current frame`}
                        aria-label={`Apply mirrored ${pose.name}`}
                        className="p-1 rounded-md bg-slate-200/75 dark:bg-[#1F2430] text-slate-600 dark:text-[#B8C0D6] hover:bg-[#7C5CFF] hover:text-white transition-colors disabled:opacity-40"
                      >
                        <FlipHorizontal2 size={11} />
                      </button>

                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onOverwritePose(pose.id)}
                        title={`Overwrite "${pose.name}" with current pose & thumbnail`}
                        aria-label={`Update ${pose.name}`}
                        className="p-1 rounded-md bg-slate-200/75 dark:bg-[#1F2430] text-slate-600 dark:text-[#B8C0D6] hover:bg-slate-300 dark:hover:bg-[#2A3142] transition-colors disabled:opacity-40"
                      >
                        <RefreshCw size={10} />
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeletePose(pose.id)}
                        title={`Delete "${pose.name}"`}
                        aria-label={`Delete ${pose.name}`}
                        className="p-1 rounded-md text-slate-400 hover:text-[#F2545B] hover:bg-[#F2545B]/15 transition-colors"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
