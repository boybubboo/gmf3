import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Camera,
  Clapperboard,
  Copy,
  Eye,
  Film,
  Footprints,
  MapPin,
  Play,
  Plus,
  Sparkles,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import type { MakerStore } from '../../store/useMakerStore';
import type {
  BoardPoint,
  CameraCutawayTransition,
  SkitBeat,
  SkitBeatEmote,
  SkitBeatSpeakerKind,
  StoryCameraShot,
  StorySkit,
  StorySkitTriggerKind,
} from '../../types/maker';
import { getDirectorViewportBridge } from '../../utils/directorBridge';
import { uid } from '../../utils/terrain';
import { DialogueVoiceEditor } from './DialogueVoiceEditor';
import { FieldLabel } from './MakerUI';

const TRANSITION_OPTIONS: { value: CameraCutawayTransition; label: string }[] = [
  { value: 'whipPan', label: 'Whip Pan' },
  { value: 'glide', label: 'Smooth Glide' },
  { value: 'snapCut', label: 'Instant Cut' },
];

const EMOTE_OPTIONS: { value: SkitBeatEmote; label: string }[] = [
  { value: 'none', label: 'Idle / Natural' },
  { value: 'shock', label: 'Startled / Shocked' },
  { value: 'angry', label: 'Grumpy / Yelling' },
  { value: 'shy', label: 'Shy / Nervous' },
  { value: 'wave', label: 'Friendly Wave' },
  { value: 'laugh', label: 'Laughing' },
  { value: 'cheer', label: 'Excited Cheer' },
  { value: 'dance', label: 'Happy Dance' },
];

const TRIGGER_OPTIONS: { value: StorySkitTriggerKind; label: string }[] = [
  { value: 'nearEntity', label: 'Hero walks near character' },
  { value: 'talkToEntity', label: 'Hero talks to character (E)' },
  { value: 'levelStart', label: 'When level begins' },
  { value: 'flagSet', label: 'When story flag is set' },
  { value: 'buddyCount', label: 'When buddies joined reach count' },
  { value: 'manual', label: 'Manual (Logic Rule / Rehearsal)' },
];

const CAMERA_ANGLE_PRESETS: {
  label: string;
  yaw: number;
  pitch: number;
  distance: number;
  heightOffset: number;
  fov: number;
}[] = [
  { label: 'Front 3/4', yaw: 28, pitch: 18, distance: 7.5, heightOffset: 1.25, fov: 46 },
  { label: 'Close-Up', yaw: 14, pitch: 10, distance: 4.2, heightOffset: 1.35, fov: 40 },
  { label: 'Side Two-Shot', yaw: 78, pitch: 14, distance: 8.6, heightOffset: 1.2, fov: 46 },
  { label: 'High Diorama', yaw: -32, pitch: 38, distance: 13.5, heightOffset: 1.1, fov: 48 },
  { label: 'Low Dramatic', yaw: -18, pitch: 7, distance: 5.2, heightOffset: 1.45, fov: 42 },
];

function clamp01(n: number) {
  return Math.max(0.05, Math.min(0.95, n));
}

function makeDefaultBeat(firstEntityId?: string): SkitBeat {
  return {
    id: uid(),
    speakerKind: firstEntityId ? 'entity' : 'narrator',
    speakerEntityId: firstEntityId,
    text: firstEntityId ? 'Whoa—watch where you are poking those!' : 'Meanwhile, across the woods...',
    cameraShotId: undefined,
    transition: 'whipPan',
    emote: firstEntityId ? 'shock' : 'none',
    lookAtKind: 'camera',
    durationSec: 3.4,
    waitForVoice: true,
  };
}

export const StoryDirectorModal: React.FC<{ store: MakerStore; onClose: () => void }> = ({
  store,
  onClose,
}) => {
  const { currentProject, currentLevel } = store;
  const shots = currentLevel?.storyShots ?? [];
  const skits = currentLevel?.storySkits ?? [];
  const entities = currentLevel?.entities ?? [];

  const [selectedSkitId, setSelectedSkitId] = useState<string | null>(() => skits[0]?.id ?? null);
  const [selectedShotId, setSelectedShotId] = useState<string | null>(() => shots[0]?.id ?? null);
  const [rightTab, setRightTab] = useState<'skit' | 'shot'>(() =>
    skits.length > 0 ? 'skit' : shots.length > 0 ? 'shot' : 'skit'
  );
  const [walkPickBeatId, setWalkPickBeatId] = useState<string | null>(null);
  const [bridgeAvailable, setBridgeAvailable] = useState(() => Boolean(getDirectorViewportBridge()));

  useEffect(() => {
    setBridgeAvailable(Boolean(getDirectorViewportBridge()));
  }, [currentLevel?.id]);

  useEffect(() => {
    if (selectedSkitId && !skits.some((s) => s.id === selectedSkitId)) {
      setSelectedSkitId(skits[0]?.id ?? null);
    } else if (!selectedSkitId && skits.length > 0) {
      setSelectedSkitId(skits[0].id);
    }
  }, [skits, selectedSkitId]);

  useEffect(() => {
    if (selectedShotId && !shots.some((s) => s.id === selectedShotId)) {
      setSelectedShotId(shots[0]?.id ?? null);
    } else if (!selectedShotId && shots.length > 0) {
      setSelectedShotId(shots[0].id);
    }
  }, [shots, selectedShotId]);

  const selectedSkit = useMemo(
    () => skits.find((s) => s.id === selectedSkitId) ?? null,
    [skits, selectedSkitId]
  );
  const selectedShot = useMemo(
    () => shots.find((s) => s.id === selectedShotId) ?? null,
    [shots, selectedShotId]
  );

  if (!currentProject || !currentLevel) return null;

  const updateShots = (label: string, mutator: (prev: StoryCameraShot[]) => StoryCameraShot[]) => {
    store.updateLevel(label, (lvl) => ({
      ...lvl,
      storyShots: mutator(lvl.storyShots ?? []),
    }));
  };

  const updateSkits = (label: string, mutator: (prev: StorySkit[]) => StorySkit[]) => {
    store.updateLevel(label, (lvl) => ({
      ...lvl,
      storySkits: mutator(lvl.storySkits ?? []),
    }));
  };

  const handleCaptureFromViewport = () => {
    const bridge = getDirectorViewportBridge();
    if (!bridge) return;
    const captured = bridge.captureCurrentShot(`Shot ${shots.length + 1}`);
    if (!captured) return;
    updateShots('capture camera shot', (prev) => [...prev, captured]);
    setSelectedShotId(captured.id);
    setRightTab('shot');
  };

  const handleCreateBlankShot = () => {
    const firstEnt = entities.find((e) => e.kind === 'npc' || e.kind === 'baddie') ?? entities[0];
    const nextShot: StoryCameraShot = {
      id: uid(),
      name: firstEnt ? `${firstEnt.name} Close-Up` : `Camera Shot ${shots.length + 1}`,
      targetMode: firstEnt ? 'entity' : 'point',
      targetEntityId: firstEnt?.id,
      point: firstEnt?.position ?? { x: 0.5, y: 0.5 },
      yaw: 26,
      pitch: 17,
      distance: 7.2,
      heightOffset: 1.25,
      fov: 46,
    };
    updateShots('add camera shot', (prev) => [...prev, nextShot]);
    setSelectedShotId(nextShot.id);
    setRightTab('shot');
  };

  const handlePreviewShot = (shot: StoryCameraShot) => {
    getDirectorViewportBridge()?.previewShot(shot, currentLevel);
  };

  const handleCreateSkit = () => {
    const firstNpc = entities.find((e) => e.kind === 'npc') ?? entities[0];
    const nextSkit: StorySkit = {
      id: uid(),
      name: `Cutaway Skit ${skits.length + 1}`,
      caption: 'Meanwhile, across the woods...',
      triggerKind: firstNpc ? 'nearEntity' : 'manual',
      triggerEntityId: firstNpc?.id,
      triggerRadius: 6,
      playOnce: true,
      pauseHeroMovement: true,
      showLetterbox: true,
      returnTransition: 'whipPan',
      beats: [makeDefaultBeat(firstNpc?.id)],
    };
    updateSkits('add story skit', (prev) => [...prev, nextSkit]);
    setSelectedSkitId(nextSkit.id);
    setRightTab('skit');
  };

  const handleCreateSampleCutaway = () => {
    const npcs = entities.filter((e) => e.kind === 'npc');
    const actorA = npcs[0] ?? entities[0];
    const actorB = npcs[1] ?? entities[1] ?? actorA;
    let targetShotId = shots[0]?.id;

    if (!targetShotId && actorA) {
      const autoShot: StoryCameraShot = {
        id: uid(),
        name: `${actorA.name} Cutaway`,
        targetMode: 'entity',
        targetEntityId: actorA.id,
        yaw: 24,
        pitch: 16,
        distance: 6.4,
        heightOffset: 1.25,
        fov: 44,
      };
      updateShots('create cutaway shot', (prev) => [...prev, autoShot]);
      targetShotId = autoShot.id;
    }

    const sample: StorySkit = {
      id: uid(),
      name: actorA ? `Meanwhile: ${actorA.name}` : 'Meanwhile in the Forest',
      caption: 'Meanwhile, over in another clearing...',
      triggerKind: 'levelStart',
      triggerRadius: 7,
      playOnce: true,
      pauseHeroMovement: true,
      showLetterbox: true,
      returnTransition: 'whipPan',
      beats: [
        {
          id: uid(),
          speakerKind: 'narrator',
          text: actorA
            ? `Across the forest, ${actorA.name} was having a very prickly afternoon.`
            : 'Across the forest, someone was having a very prickly afternoon.',
          cameraShotId: targetShotId,
          transition: 'whipPan',
          emote: 'none',
          lookAtKind: 'camera',
          durationSec: 3.2,
          waitForVoice: true,
        },
        {
          id: uid(),
          speakerKind: actorA ? 'entity' : 'hero',
          speakerEntityId: actorA?.id,
          text: 'Hey! Watch the quills! I cannot help being a little pointy!',
          cameraShotId: targetShotId,
          transition: 'glide',
          emote: 'shock',
          lookAtKind: 'camera',
          durationSec: 3.5,
          waitForVoice: true,
        },
        ...(actorB && actorB.id !== actorA?.id
          ? [
              {
                id: uid(),
                speakerKind: 'entity' as SkitBeatSpeakerKind,
                speakerEntityId: actorB.id,
                text: 'We ought to check on them once we find the trail!',
                cameraShotId: undefined,
                transition: 'whipPan' as CameraCutawayTransition,
                emote: 'wave' as SkitBeatEmote,
                lookAtKind: 'hero' as const,
                durationSec: 3.0,
                waitForVoice: true,
              },
            ]
          : []),
        {
          id: uid(),
          speakerKind: 'hero',
          text: "Hang tight! We're on our way!",
          cameraShotId: undefined,
          transition: 'whipPan',
          emote: 'cheer',
          lookAtKind: 'camera',
          durationSec: 2.6,
          waitForVoice: true,
        },
      ],
    };

    updateSkits('create sample cutaway skit', (prev) => [...prev, sample]);
    setSelectedSkitId(sample.id);
    setRightTab('skit');
  };

  const updateSelectedSkit = (label: string, mutator: (skit: StorySkit) => StorySkit) => {
    if (!selectedSkit) return;
    updateSkits(label, (prev) => prev.map((s) => (s.id === selectedSkit.id ? mutator(s) : s)));
  };

  const updateSelectedShot = (label: string, mutator: (shot: StoryCameraShot) => StoryCameraShot) => {
    if (!selectedShot) return;
    updateShots(label, (prev) => prev.map((s) => (s.id === selectedShot.id ? mutator(s) : s)));
  };

  const moveBeat = (idx: number, dir: -1 | 1) => {
    if (!selectedSkit) return;
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= selectedSkit.beats.length) return;
    updateSelectedSkit('reorder skit beat', (sk) => {
      const copy = [...sk.beats];
      const [item] = copy.splice(idx, 1);
      copy.splice(targetIdx, 0, item);
      return { ...sk, beats: copy };
    });
  };

  const handleRehearseSkit = (skitId: string) => {
    store.setRehearseSkitId(skitId);
    onClose();
    store.setIsPlaying(true);
  };

  const renderMapPad = (
    point: BoardPoint | undefined,
    onPick: (pt: BoardPoint) => void,
    accentColor: string,
    markerLabel: string
  ) => (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = clamp01((e.clientX - rect.left) / rect.width);
        const y = clamp01((e.clientY - rect.top) / rect.height);
        onPick({ x: Number(x.toFixed(3)), y: Number(y.toFixed(3)) });
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onPick(point ?? { x: 0.5, y: 0.5 });
        }
      }}
      className="relative h-36 rounded-xl bg-slate-100 dark:bg-[#131620] border border-slate-200/90 dark:border-white/[0.1] overflow-hidden cursor-crosshair select-none"
      title="Click anywhere on the island map to set position"
    >
      {/* Subtle island silhouette */}
      <div className="absolute inset-3 rounded-[44%] border border-dashed border-emerald-500/35 bg-emerald-500/[0.06]" />
      {/* Hero spawn dot */}
      <div
        className="absolute w-2.5 h-2.5 -ml-1.25 -mt-1.25 rounded-full bg-[#20B46A] ring-2 ring-white/80"
        style={{
          left: `${(currentLevel.startPoint ?? { x: 0.5, y: 0.5 }).x * 100}%`,
          top: `${(currentLevel.startPoint ?? { x: 0.5, y: 0.5 }).y * 100}%`,
        }}
        title="Hero Start"
      />
      {/* Entity dots */}
      {entities.map((ent) => (
        <div
          key={ent.id}
          className="absolute w-2 h-2 -ml-1 -mt-1 rounded-full bg-slate-400/80 dark:bg-slate-400/70"
          style={{
            left: `${ent.position.x * 100}%`,
            top: `${ent.position.y * 100}%`,
          }}
          title={ent.name}
        />
      ))}
      {/* Selected point marker */}
      {point && (
        <div
          className="absolute -ml-2.5 -mt-2.5 flex items-center gap-1 pointer-events-none"
          style={{
            left: `${point.x * 100}%`,
            top: `${point.y * 100}%`,
          }}
        >
          <span
            className="w-5 h-5 rounded-full flex items-center justify-center text-white shadow-md ring-2 ring-white"
            style={{ backgroundColor: accentColor }}
          >
            <MapPin size={11} />
          </span>
          <span className="px-1.5 py-0.5 rounded bg-black/80 text-white text-[10px] font-bold whitespace-nowrap">
            {markerLabel}
          </span>
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-5">
      <div className="w-full max-w-6xl h-[90vh] max-h-[860px] rounded-3xl bg-white dark:bg-[#171A23] text-slate-900 dark:text-[#F3F5FA] border border-slate-200/80 dark:border-white/[0.1] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <header className="shrink-0 px-5 py-3.5 border-b border-slate-200/80 dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#F59E0B]/15 text-[#F59E0B] flex items-center justify-center shrink-0">
              <Clapperboard size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black leading-tight truncate">
                Story Director — Live Camera Cutaways & Skits
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#949BB0] truncate">
                Stage "Meanwhile..." camera swoops, character emotes, and voiced storybook beats on{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {currentLevel.name}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedSkit && (
              <button
                type="button"
                onClick={() => handleRehearseSkit(selectedSkit.id)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#20B46A] text-white text-xs font-extrabold hover:opacity-95 whitespace-nowrap"
              >
                <Play size={13} fill="currentColor" />
                <span>Rehearse in Play Mode</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#1F2430] hover:bg-slate-200 dark:hover:bg-[#272D3C] flex items-center justify-center text-slate-500 dark:text-[#949BB0]"
              aria-label="Close Story Director"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          {/* Left Rail: Skits & Camera Shots */}
          <aside className="w-full lg:w-80 shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200/80 dark:border-white/[0.08] overflow-y-auto maker-scroll p-4 space-y-5 bg-slate-50/70 dark:bg-[#13161F]">
            {/* Story Skits Section */}
            <section className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Film size={14} className="text-[#F59E0B]" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-[#949BB0]">
                    Story Skits ({skits.length})
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleCreateSampleCutaway}
                    title="Auto-build a sample 'Meanwhile...' cutaway skit"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#F59E0B]/15 text-[#D97706] dark:text-[#FBBF24] text-[11px] font-bold hover:bg-[#F59E0B]/25 whitespace-nowrap"
                  >
                    <Sparkles size={11} />
                    <span>Sample</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateSkit}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#7C5CFF] text-white text-[11px] font-bold hover:opacity-90 whitespace-nowrap"
                  >
                    <Plus size={11} />
                    <span>New Skit</span>
                  </button>
                </div>
              </div>

              {skits.length === 0 ? (
                <div className="p-3 rounded-2xl border border-dashed border-slate-300 dark:border-white/[0.12] text-xs text-slate-500 dark:text-[#949BB0] space-y-2">
                  <p>
                    No skits yet. Create a skit to swoop the live camera across the island, play
                    voices, and cut back to your hero.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {skits.map((skit) => {
                    const active = rightTab === 'skit' && skit.id === selectedSkitId;
                    return (
                      <div
                        key={skit.id}
                        className={`group flex items-center gap-2 p-2.5 rounded-xl border transition-colors ${
                          active
                            ? 'bg-[#7C5CFF]/15 border-[#7C5CFF]/60'
                            : 'bg-white dark:bg-[#1A1E29] border-slate-200/80 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/20'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSkitId(skit.id);
                            setRightTab('skit');
                          }}
                          className="flex-1 min-w-0 text-left"
                        >
                          <div className="text-xs font-extrabold truncate">{skit.name}</div>
                          <div className="text-[11px] text-slate-500 dark:text-[#949BB0] truncate">
                            {skit.beats.length} beat{skit.beats.length === 1 ? '' : 's'} ·{' '}
                            {skit.triggerKind === 'levelStart'
                              ? 'On Level Start'
                              : skit.triggerKind === 'nearEntity'
                              ? 'Near Character'
                              : skit.triggerKind === 'talkToEntity'
                              ? 'On Talk'
                              : skit.triggerKind === 'flagSet'
                              ? 'On Flag'
                              : skit.triggerKind === 'buddyCount'
                              ? 'Buddy Count'
                              : 'Manual'}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const cloned: StorySkit = {
                              ...skit,
                              id: uid(),
                              name: `${skit.name} Copy`,
                              beats: skit.beats.map((b) => ({ ...b, id: uid() })),
                            };
                            updateSkits('duplicate story skit', (prev) => [...prev, cloned]);
                            setSelectedSkitId(cloned.id);
                            setRightTab('skit');
                          }}
                          title="Duplicate skit"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10"
                        >
                          <Copy size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateSkits('delete story skit', (prev) =>
                              prev.filter((s) => s.id !== skit.id)
                            )
                          }
                          title="Delete skit"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-[#F2545B] hover:bg-[#F2545B]/10"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Camera Shots Section */}
            <section className="pt-4 border-t border-slate-200/80 dark:border-white/[0.08] space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Camera size={14} className="text-[#38BDF8]" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-[#949BB0]">
                    Camera Shots ({shots.length})
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {bridgeAvailable && (
                    <button
                      type="button"
                      onClick={handleCaptureFromViewport}
                      title="Capture your current 3D World viewport camera angle as a reusable shot"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#38BDF8]/15 text-[#0284C7] dark:text-[#38BDF8] text-[11px] font-bold hover:bg-[#38BDF8]/25 whitespace-nowrap"
                    >
                      <Video size={11} />
                      <span>Capture 3D</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleCreateBlankShot}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-200 dark:bg-[#232938] text-slate-800 dark:text-slate-100 text-[11px] font-bold hover:opacity-90 whitespace-nowrap"
                  >
                    <Plus size={11} />
                    <span>New</span>
                  </button>
                </div>
              </div>

              {shots.length === 0 ? (
                <p className="text-[11px] text-slate-500 dark:text-[#949BB0]">
                  Add camera shots to aim cutaways at specific clearings, props, or characters.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {shots.map((shot) => {
                    const active = rightTab === 'shot' && shot.id === selectedShotId;
                    const targetEnt =
                      shot.targetMode === 'entity' && shot.targetEntityId
                        ? entities.find((e) => e.id === shot.targetEntityId)
                        : null;
                    return (
                      <div
                        key={shot.id}
                        className={`flex items-center gap-1.5 p-2 rounded-xl border transition-colors ${
                          active
                            ? 'bg-[#38BDF8]/15 border-[#38BDF8]/60'
                            : 'bg-white dark:bg-[#1A1E29] border-slate-200/80 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/20'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedShotId(shot.id);
                            setRightTab('shot');
                          }}
                          className="flex-1 min-w-0 text-left"
                        >
                          <div className="text-xs font-bold truncate">{shot.name}</div>
                          <div className="text-[11px] text-slate-500 dark:text-[#949BB0] truncate">
                            {targetEnt ? `Focus: ${targetEnt.name}` : 'World spot'} · {shot.distance}m
                          </div>
                        </button>
                        {bridgeAvailable && (
                          <button
                            type="button"
                            onClick={() => handlePreviewShot(shot)}
                            title="Preview this shot in the 3D World viewport behind this window"
                            className="p-1.5 rounded-lg text-[#38BDF8] hover:bg-[#38BDF8]/15"
                          >
                            <Eye size={13} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            updateShots('delete camera shot', (prev) =>
                              prev.filter((s) => s.id !== shot.id)
                            )
                          }
                          title="Delete camera shot"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-[#F2545B] hover:bg-[#F2545B]/10"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </aside>

          {/* Right Pane: Skit Beat Sequencer OR Shot Inspector */}
          <main className="flex-1 min-w-0 overflow-y-auto maker-scroll p-4 sm:p-6 space-y-5">
            {/* Switch Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-white/[0.08] pb-3">
              <button
                type="button"
                onClick={() => setRightTab('skit')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-colors ${
                  rightTab === 'skit'
                    ? 'bg-[#7C5CFF] text-white'
                    : 'bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#949BB0]'
                }`}
              >
                <Film size={13} />
                <span>Skit Sequencer</span>
              </button>
              <button
                type="button"
                onClick={() => setRightTab('shot')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-colors ${
                  rightTab === 'shot'
                    ? 'bg-[#0284C7] text-white'
                    : 'bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#949BB0]'
                }`}
              >
                <Camera size={13} />
                <span>Camera Shot Framing</span>
              </button>
            </div>

            {rightTab === 'shot' ? (
              selectedShot ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <input
                      type="text"
                      value={selectedShot.name}
                      onChange={(e) =>
                        updateSelectedShot('rename camera shot', (s) => ({
                          ...s,
                          name: e.target.value,
                        }))
                      }
                      className="text-lg font-black bg-slate-100 dark:bg-[#1F2430] rounded-xl px-3.5 py-2 border border-slate-200/80 dark:border-white/[0.08] flex-1 min-w-[200px]"
                      placeholder="Camera shot name"
                    />
                    {bridgeAvailable && (
                      <button
                        type="button"
                        onClick={() => handlePreviewShot(selectedShot)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#38BDF8]/18 text-[#0284C7] dark:text-[#38BDF8] text-xs font-extrabold hover:bg-[#38BDF8]/25 whitespace-nowrap"
                      >
                        <Eye size={14} />
                        <span>Preview in 3D</span>
                      </button>
                    )}
                  </div>

                  {/* Angle Presets */}
                  <div className="space-y-1.5">
                    <FieldLabel text="Quick Framing Angles" />
                    <div className="flex flex-wrap gap-2">
                      {CAMERA_ANGLE_PRESETS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() =>
                            updateSelectedShot('apply camera angle preset', (s) => ({
                              ...s,
                              yaw: preset.yaw,
                              pitch: preset.pitch,
                              distance: preset.distance,
                              heightOffset: preset.heightOffset,
                              fov: preset.fov,
                            }))
                          }
                          className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1F2430] hover:bg-slate-200 dark:hover:bg-[#272D3C] text-xs font-bold"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Target */}
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#13161F] border border-slate-200/80 dark:border-white/[0.08] space-y-3">
                      <FieldLabel text="What does this camera aim at?" />
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateSelectedShot('aim shot at entity', (s) => ({
                              ...s,
                              targetMode: 'entity',
                              targetEntityId: s.targetEntityId ?? entities[0]?.id,
                            }))
                          }
                          className={`py-2 rounded-xl text-xs font-bold border ${
                            selectedShot.targetMode === 'entity'
                              ? 'bg-[#38BDF8]/18 border-[#38BDF8] text-[#0284C7] dark:text-[#38BDF8]'
                              : 'bg-white dark:bg-[#1A1E29] border-slate-200/80 dark:border-white/[0.08]'
                          }`}
                        >
                          Follow Character / Prop
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateSelectedShot('aim shot at world spot', (s) => ({
                              ...s,
                              targetMode: 'point',
                              point: s.point ?? { x: 0.5, y: 0.5 },
                            }))
                          }
                          className={`py-2 rounded-xl text-xs font-bold border ${
                            selectedShot.targetMode === 'point'
                              ? 'bg-[#38BDF8]/18 border-[#38BDF8] text-[#0284C7] dark:text-[#38BDF8]'
                              : 'bg-white dark:bg-[#1A1E29] border-slate-200/80 dark:border-white/[0.08]'
                          }`}
                        >
                          Fixed Island Spot
                        </button>
                      </div>

                      {selectedShot.targetMode === 'entity' ? (
                        <div>
                          <FieldLabel text="Target Character / Object" />
                          <select
                            value={selectedShot.targetEntityId ?? ''}
                            onChange={(e) =>
                              updateSelectedShot('change shot target entity', (s) => ({
                                ...s,
                                targetEntityId: e.target.value || undefined,
                              }))
                            }
                            className="w-full rounded-xl bg-white dark:bg-[#1F2430] border border-slate-200/80 dark:border-white/[0.08] px-3 py-2 text-xs font-semibold"
                          >
                            <option value="">Hero / Center</option>
                            {entities.map((ent) => (
                              <option key={ent.id} value={ent.id}>
                                {ent.name} ({ent.kind})
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <FieldLabel text="Click Map to Aim Camera" />
                          {renderMapPad(
                            selectedShot.point ?? { x: 0.5, y: 0.5 },
                            (pt) =>
                              updateSelectedShot('move camera shot aim point', (s) => ({
                                ...s,
                                point: pt,
                              })),
                            '#0284C7',
                            selectedShot.name
                          )}
                        </div>
                      )}
                    </div>

                    {/* Sliders */}
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#13161F] border border-slate-200/80 dark:border-white/[0.08] space-y-3">
                      <div>
                        <div className="flex justify-between text-xs font-bold mb-1">
                          <span>Orbit Angle (Yaw)</span>
                          <span className="tabular-nums text-slate-500">{selectedShot.yaw}°</span>
                        </div>
                        <input
                          type="range"
                          min={-180}
                          max={180}
                          step={2}
                          value={selectedShot.yaw}
                          onChange={(e) =>
                            updateSelectedShot('adjust shot yaw', (s) => ({
                              ...s,
                              yaw: Number(e.target.value),
                            }))
                          }
                          className="w-full accent-[#38BDF8]"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs font-bold mb-1">
                          <span>Camera Elevation (Pitch)</span>
                          <span className="tabular-nums text-slate-500">{selectedShot.pitch}°</span>
                        </div>
                        <input
                          type="range"
                          min={5}
                          max={70}
                          step={1}
                          value={selectedShot.pitch}
                          onChange={(e) =>
                            updateSelectedShot('adjust shot pitch', (s) => ({
                              ...s,
                              pitch: Number(e.target.value),
                            }))
                          }
                          className="w-full accent-[#38BDF8]"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs font-bold mb-1">
                          <span>Distance</span>
                          <span className="tabular-nums text-slate-500">{selectedShot.distance}m</span>
                        </div>
                        <input
                          type="range"
                          min={3}
                          max={28}
                          step={0.5}
                          value={selectedShot.distance}
                          onChange={(e) =>
                            updateSelectedShot('adjust shot distance', (s) => ({
                              ...s,
                              distance: Number(e.target.value),
                            }))
                          }
                          className="w-full accent-[#38BDF8]"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="flex justify-between text-xs font-bold mb-1">
                            <span>Aim Height</span>
                            <span className="tabular-nums text-slate-500">
                              {selectedShot.heightOffset.toFixed(1)}m
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={6}
                            step={0.1}
                            value={selectedShot.heightOffset}
                            onChange={(e) =>
                              updateSelectedShot('adjust shot height', (s) => ({
                                ...s,
                                heightOffset: Number(e.target.value),
                              }))
                            }
                            className="w-full accent-[#38BDF8]"
                          />
                        </div>
                        <div>
                          <div className="flex justify-between text-xs font-bold mb-1">
                            <span>Lens FOV</span>
                            <span className="tabular-nums text-slate-500">
                              {selectedShot.fov ?? 48}°
                            </span>
                          </div>
                          <input
                            type="range"
                            min={32}
                            max={68}
                            step={1}
                            value={selectedShot.fov ?? 48}
                            onChange={(e) =>
                              updateSelectedShot('adjust shot fov', (s) => ({
                                ...s,
                                fov: Number(e.target.value),
                              }))
                            }
                            className="w-full accent-[#38BDF8]"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 rounded-2xl border border-dashed border-slate-300 dark:border-white/[0.12] text-center space-y-3">
                  <Camera size={28} className="mx-auto text-[#38BDF8]" />
                  <div className="text-sm font-extrabold">No Camera Shot Selected</div>
                  <p className="text-xs text-slate-500 dark:text-[#949BB0] max-w-md mx-auto">
                    Add a shot or orbit your 3D World behind this window and click "Capture 3D" to
                    save that exact camera framing.
                  </p>
                  <button
                    type="button"
                    onClick={handleCreateBlankShot}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0284C7] text-white text-xs font-bold"
                  >
                    <Plus size={14} />
                    <span>New Camera Shot</span>
                  </button>
                </div>
              )
            ) : selectedSkit ? (
              <div className="space-y-5">
                {/* Skit Settings Header */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#13161F] border border-slate-200/80 dark:border-white/[0.08] space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <FieldLabel text="Skit Title" />
                      <input
                        type="text"
                        value={selectedSkit.name}
                        onChange={(e) =>
                          updateSelectedSkit('rename story skit', (s) => ({
                            ...s,
                            name: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl bg-white dark:bg-[#1F2430] border border-slate-200/80 dark:border-white/[0.08] px-3 py-2 text-sm font-extrabold"
                      />
                    </div>
                    <div>
                      <FieldLabel text="Cutaway Banner Caption (optional)" />
                      <input
                        type="text"
                        value={selectedSkit.caption ?? ''}
                        onChange={(e) =>
                          updateSelectedSkit('edit skit caption', (s) => ({
                            ...s,
                            caption: e.target.value,
                          }))
                        }
                        placeholder="e.g. Meanwhile, across the forest..."
                        className="w-full rounded-xl bg-white dark:bg-[#1F2430] border border-slate-200/80 dark:border-white/[0.08] px-3 py-2 text-xs font-semibold"
                      />
                    </div>
                  </div>

                  {/* Trigger Configuration */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <FieldLabel text="When does this cutaway play?" />
                      <select
                        value={selectedSkit.triggerKind}
                        onChange={(e) =>
                          updateSelectedSkit('change skit trigger', (s) => ({
                            ...s,
                            triggerKind: e.target.value as StorySkitTriggerKind,
                          }))
                        }
                        className="w-full rounded-xl bg-white dark:bg-[#1F2430] border border-slate-200/80 dark:border-white/[0.08] px-3 py-2 text-xs font-semibold"
                      >
                        {TRIGGER_OPTIONS.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {(selectedSkit.triggerKind === 'nearEntity' ||
                      selectedSkit.triggerKind === 'talkToEntity') && (
                      <>
                        <div>
                          <FieldLabel text="Target Character / Object" />
                          <select
                            value={selectedSkit.triggerEntityId ?? ''}
                            onChange={(e) =>
                              updateSelectedSkit('change trigger entity', (s) => ({
                                ...s,
                                triggerEntityId: e.target.value || undefined,
                              }))
                            }
                            className="w-full rounded-xl bg-white dark:bg-[#1F2430] border border-slate-200/80 dark:border-white/[0.08] px-3 py-2 text-xs font-semibold"
                          >
                            <option value="">Choose character...</option>
                            {entities.map((ent) => (
                              <option key={ent.id} value={ent.id}>
                                {ent.name} ({ent.kind})
                              </option>
                            ))}
                          </select>
                        </div>
                        {selectedSkit.triggerKind === 'nearEntity' && (
                          <div>
                            <FieldLabel
                              text={`Trigger Radius (${selectedSkit.triggerRadius ?? 6}m)`}
                            />
                            <input
                              type="range"
                              min={2}
                              max={22}
                              step={1}
                              value={selectedSkit.triggerRadius ?? 6}
                              onChange={(e) =>
                                updateSelectedSkit('change trigger radius', (s) => ({
                                  ...s,
                                  triggerRadius: Number(e.target.value),
                                }))
                              }
                              className="w-full accent-[#7C5CFF] mt-2"
                            />
                          </div>
                        )}
                      </>
                    )}

                    {selectedSkit.triggerKind === 'flagSet' && (
                      <div>
                        <FieldLabel text="Story Flag Name" />
                        <input
                          type="text"
                          value={selectedSkit.triggerFlag ?? ''}
                          onChange={(e) =>
                            updateSelectedSkit('edit trigger flag', (s) => ({
                              ...s,
                              triggerFlag: e.target.value,
                            }))
                          }
                          placeholder="e.g. found_duckling"
                          className="w-full rounded-xl bg-white dark:bg-[#1F2430] border border-slate-200/80 dark:border-white/[0.08] px-3 py-2 text-xs font-semibold"
                        />
                      </div>
                    )}

                    {selectedSkit.triggerKind === 'buddyCount' && (
                      <div>
                        <FieldLabel text="Buddies Joined Count" />
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={selectedSkit.triggerBuddyCount ?? 1}
                          onChange={(e) =>
                            updateSelectedSkit('edit trigger buddy count', (s) => ({
                              ...s,
                              triggerBuddyCount: Math.max(1, Number(e.target.value) || 1),
                            }))
                          }
                          className="w-full rounded-xl bg-white dark:bg-[#1F2430] border border-slate-200/80 dark:border-white/[0.08] px-3 py-2 text-xs font-semibold"
                        />
                      </div>
                    )}
                  </div>

                  {/* Playback Flags & Return Transition */}
                  <div className="flex flex-wrap items-center gap-4 pt-1 text-xs font-semibold">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedSkit.playOnce}
                        onChange={(e) =>
                          updateSelectedSkit('toggle play once', (s) => ({
                            ...s,
                            playOnce: e.target.checked,
                          }))
                        }
                        className="accent-[#7C5CFF]"
                      />
                      <span>Play once</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedSkit.pauseHeroMovement}
                        onChange={(e) =>
                          updateSelectedSkit('toggle pause hero movement', (s) => ({
                            ...s,
                            pauseHeroMovement: e.target.checked,
                          }))
                        }
                        className="accent-[#7C5CFF]"
                      />
                      <span>Hold hero movement during skit</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedSkit.showLetterbox}
                        onChange={(e) =>
                          updateSelectedSkit('toggle letterbox bars', (s) => ({
                            ...s,
                            showLetterbox: e.target.checked,
                          }))
                        }
                        className="accent-[#7C5CFF]"
                      />
                      <span>Cinema bars</span>
                    </label>

                    <div className="inline-flex items-center gap-1.5 ml-auto">
                      <span className="text-[11px] text-slate-500 dark:text-[#949BB0]">
                        Return to hero:
                      </span>
                      <select
                        value={selectedSkit.returnTransition}
                        onChange={(e) =>
                          updateSelectedSkit('change return transition', (s) => ({
                            ...s,
                            returnTransition: e.target.value as CameraCutawayTransition,
                          }))
                        }
                        className="rounded-lg bg-white dark:bg-[#1F2430] border border-slate-200/80 dark:border-white/[0.08] px-2 py-1 text-xs font-bold"
                      >
                        {TRANSITION_OPTIONS.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="inline-flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-500 dark:text-[#949BB0]">
                        Set flag after:
                      </span>
                      <input
                        type="text"
                        value={selectedSkit.setFlagOnComplete ?? ''}
                        onChange={(e) =>
                          updateSelectedSkit('edit completion flag', (s) => ({
                            ...s,
                            setFlagOnComplete: e.target.value || undefined,
                          }))
                        }
                        placeholder="optional"
                        className="w-28 rounded-lg bg-white dark:bg-[#1F2430] border border-slate-200/80 dark:border-white/[0.08] px-2 py-1 text-xs font-semibold"
                      />
                    </div>
                  </div>
                </div>

                {/* Beat Timeline */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-extrabold">
                        Skit Beats ({selectedSkit.beats.length})
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-[#949BB0]">
                        Each beat frames a camera shot, plays optional recorded voice, and animates
                        your character.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        updateSelectedSkit('add skit beat', (s) => ({
                          ...s,
                          beats: [...s.beats, makeDefaultBeat(entities[0]?.id)],
                        }))
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#7C5CFF] text-white text-xs font-extrabold hover:opacity-90 whitespace-nowrap"
                    >
                      <Plus size={13} />
                      <span>Add Beat</span>
                    </button>
                  </div>

                  {selectedSkit.beats.map((beat, idx) => {
                    const updateBeat = (label: string, mutator: (b: SkitBeat) => SkitBeat) => {
                      updateSelectedSkit(label, (sk) => ({
                        ...sk,
                        beats: sk.beats.map((item) => (item.id === beat.id ? mutator(item) : item)),
                      }));
                    };
                    const speakerEntity =
                      beat.speakerKind === 'entity' && beat.speakerEntityId
                        ? entities.find((e) => e.id === beat.speakerEntityId)
                        : null;
                    const speakerLabel =
                      beat.speakerKind === 'narrator'
                        ? beat.speakerNameOverride?.trim() || 'Narrator'
                        : beat.speakerKind === 'hero'
                        ? beat.speakerNameOverride?.trim() || currentProject.heroName || 'Hero'
                        : speakerEntity?.name || 'Character';

                    return (
                      <div
                        key={beat.id}
                        className="p-4 rounded-2xl bg-white dark:bg-[#1B1F2B] border border-slate-200/80 dark:border-white/[0.09] space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-[#7C5CFF]/15 text-[#7C5CFF] text-xs font-black flex items-center justify-center tabular-nums">
                              {idx + 1}
                            </span>
                            <span className="text-xs font-extrabold">{speakerLabel}</span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moveBeat(idx, -1)}
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-[#252B3B] disabled:opacity-35"
                              title="Move beat up"
                            >
                              <ArrowUp size={12} />
                            </button>
                            <button
                              type="button"
                              disabled={idx === selectedSkit.beats.length - 1}
                              onClick={() => moveBeat(idx, 1)}
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-[#252B3B] disabled:opacity-35"
                              title="Move beat down"
                            >
                              <ArrowDown size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateSelectedSkit('duplicate beat', (sk) => {
                                  const copy = [...sk.beats];
                                  copy.splice(idx + 1, 0, { ...beat, id: uid() });
                                  return { ...sk, beats: copy };
                                })
                              }
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-[#252B3B]"
                              title="Duplicate beat"
                            >
                              <Copy size={12} />
                            </button>
                            {selectedSkit.beats.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateSelectedSkit('remove beat', (sk) => ({
                                    ...sk,
                                    beats: sk.beats.filter((b) => b.id !== beat.id),
                                  }))
                                }
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-[#252B3B] text-[#F2545B]"
                                title="Delete beat"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Speaker, Camera Shot, Transition */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                          <div>
                            <FieldLabel text="Speaker" />
                            <select
                              value={beat.speakerKind}
                              onChange={(e) =>
                                updateBeat('change beat speaker kind', (b) => ({
                                  ...b,
                                  speakerKind: e.target.value as SkitBeatSpeakerKind,
                                  speakerEntityId:
                                    e.target.value === 'entity'
                                      ? b.speakerEntityId ?? entities[0]?.id
                                      : b.speakerEntityId,
                                }))
                              }
                              className="w-full rounded-xl bg-slate-100 dark:bg-[#13161F] px-2.5 py-2 text-xs font-semibold"
                            >
                              <option value="entity">Woodland Character / Entity</option>
                              <option value="hero">{currentProject.heroName || 'Hero'}</option>
                              <option value="narrator">Storybook Narrator</option>
                            </select>
                          </div>

                          {beat.speakerKind === 'entity' ? (
                            <div>
                              <FieldLabel text="Which Character?" />
                              <select
                                value={beat.speakerEntityId ?? ''}
                                onChange={(e) =>
                                  updateBeat('change beat speaker entity', (b) => ({
                                    ...b,
                                    speakerEntityId: e.target.value || undefined,
                                  }))
                                }
                                className="w-full rounded-xl bg-slate-100 dark:bg-[#13161F] px-2.5 py-2 text-xs font-semibold"
                              >
                                <option value="">Choose character...</option>
                                {entities.map((ent) => (
                                  <option key={ent.id} value={ent.id}>
                                    {ent.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <div>
                              <FieldLabel text="Display Name" />
                              <input
                                type="text"
                                value={beat.speakerNameOverride ?? ''}
                                onChange={(e) =>
                                  updateBeat('edit beat speaker label', (b) => ({
                                    ...b,
                                    speakerNameOverride: e.target.value,
                                  }))
                                }
                                placeholder={
                                  beat.speakerKind === 'narrator'
                                    ? 'Narrator'
                                    : currentProject.heroName || 'Hero'
                                }
                                className="w-full rounded-xl bg-slate-100 dark:bg-[#13161F] px-2.5 py-2 text-xs font-semibold"
                              />
                            </div>
                          )}

                          <div>
                            <FieldLabel text="Camera Shot" />
                            <select
                              value={beat.cameraShotId ?? ''}
                              onChange={(e) =>
                                updateBeat('change beat camera shot', (b) => ({
                                  ...b,
                                  cameraShotId: e.target.value || undefined,
                                }))
                              }
                              className="w-full rounded-xl bg-slate-100 dark:bg-[#13161F] px-2.5 py-2 text-xs font-semibold"
                            >
                              <option value="">Auto-frame Speaker</option>
                              {shots.map((sh) => (
                                <option key={sh.id} value={sh.id}>
                                  {sh.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <FieldLabel text="Camera Swoop" />
                            <select
                              value={beat.transition ?? 'whipPan'}
                              onChange={(e) =>
                                updateBeat('change beat transition', (b) => ({
                                  ...b,
                                  transition: e.target.value as CameraCutawayTransition,
                                }))
                              }
                              className="w-full rounded-xl bg-slate-100 dark:bg-[#13161F] px-2.5 py-2 text-xs font-semibold"
                            >
                              {TRANSITION_OPTIONS.map((t) => (
                                <option key={t.value} value={t.value}>
                                  {t.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Dialogue Text */}
                        <div>
                          <FieldLabel text="Line / Narration" />
                          <input
                            type="text"
                            value={beat.text}
                            onChange={(e) =>
                              updateBeat('edit beat line', (b) => ({
                                ...b,
                                text: e.target.value,
                              }))
                            }
                            placeholder="What is said or narrated in this beat?"
                            className="w-full rounded-xl bg-slate-100 dark:bg-[#13161F] px-3 py-2 text-sm font-semibold"
                          />
                        </div>

                        {/* Emote, LookAt, Duration, Walk-To */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 items-end">
                          <div>
                            <FieldLabel text="Actor Emote" />
                            <select
                              value={beat.emote ?? 'none'}
                              onChange={(e) =>
                                updateBeat('change beat emote', (b) => ({
                                  ...b,
                                  emote: e.target.value as SkitBeatEmote,
                                }))
                              }
                              className="w-full rounded-xl bg-slate-100 dark:bg-[#13161F] px-2.5 py-2 text-xs font-semibold"
                            >
                              {EMOTE_OPTIONS.map((em) => (
                                <option key={em.value} value={em.value}>
                                  {em.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <FieldLabel text="Look Toward" />
                            <select
                              value={beat.lookAtKind ?? 'camera'}
                              onChange={(e) =>
                                updateBeat('change beat lookAt', (b) => ({
                                  ...b,
                                  lookAtKind: e.target.value as 'camera' | 'hero' | 'entity',
                                }))
                              }
                              className="w-full rounded-xl bg-slate-100 dark:bg-[#13161F] px-2.5 py-2 text-xs font-semibold"
                            >
                              <option value="camera">Look at Camera</option>
                              <option value="hero">Look at Hero</option>
                              <option value="entity">Look at Another Entity</option>
                            </select>
                          </div>

                          <div>
                            <FieldLabel text={`Min Duration (${beat.durationSec.toFixed(1)}s)`} />
                            <input
                              type="range"
                              min={1.2}
                              max={12}
                              step={0.2}
                              value={beat.durationSec}
                              onChange={(e) =>
                                updateBeat('adjust beat duration', (b) => ({
                                  ...b,
                                  durationSec: Number(e.target.value),
                                }))
                              }
                              className="w-full accent-[#7C5CFF] mb-2"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-2 pb-1">
                            <label className="inline-flex items-center gap-1.5 text-[11px] font-bold cursor-pointer">
                              <input
                                type="checkbox"
                                checked={beat.waitForVoice}
                                onChange={(e) =>
                                  updateBeat('toggle wait for voice', (b) => ({
                                    ...b,
                                    waitForVoice: e.target.checked,
                                  }))
                                }
                                className="accent-[#7C5CFF]"
                              />
                              <span>Wait for voice</span>
                            </label>
                            {beat.speakerKind === 'entity' && (
                              <button
                                type="button"
                                onClick={() =>
                                  setWalkPickBeatId((cur) => (cur === beat.id ? null : beat.id))
                                }
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap ${
                                  beat.moveToPoint || walkPickBeatId === beat.id
                                    ? 'bg-[#20B46A]/18 text-[#16A34A] dark:text-[#4ADE80]'
                                    : 'bg-slate-100 dark:bg-[#252B3B] text-slate-600 dark:text-[#949BB0]'
                                }`}
                                title="Optional: have this character walk to a spot during this beat"
                              >
                                <Footprints size={11} />
                                <span>{beat.moveToPoint ? 'Walk Spot' : 'Walk To'}</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {beat.lookAtKind === 'entity' && (
                          <div>
                            <FieldLabel text="Look-At Target Entity" />
                            <select
                              value={beat.lookAtEntityId ?? ''}
                              onChange={(e) =>
                                updateBeat('set lookAt target', (b) => ({
                                  ...b,
                                  lookAtEntityId: e.target.value || undefined,
                                }))
                              }
                              className="w-full rounded-xl bg-slate-100 dark:bg-[#13161F] px-2.5 py-2 text-xs font-semibold"
                            >
                              <option value="">Select target...</option>
                              {entities.map((ent) => (
                                <option key={ent.id} value={ent.id}>
                                  {ent.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {walkPickBeatId === beat.id && (
                          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#13161F] border border-slate-200/80 dark:border-white/[0.08] space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold">
                              <span>Click where {speakerLabel} should walk during this beat</span>
                              {beat.moveToPoint && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateBeat('clear walk spot', (b) => ({
                                      ...b,
                                      moveToPoint: undefined,
                                    }))
                                  }
                                  className="text-[#F2545B] text-[11px] font-bold"
                                >
                                  Clear Spot
                                </button>
                              )}
                            </div>
                            {renderMapPad(
                              beat.moveToPoint,
                              (pt) =>
                                updateBeat('set beat walk spot', (b) => ({
                                  ...b,
                                  moveToPoint: pt,
                                })),
                              '#20B46A',
                              'Walk Here'
                            )}
                          </div>
                        )}

                        {/* Embedded Voice Recorder / Uploader */}
                        <DialogueVoiceEditor
                          dialogueText={beat.text}
                          voiceConfig={beat.voiceConfig}
                          projectChatSettings={currentProject.chatSettings}
                          singleLineOnly
                          compact
                          labelPrefix={`Beat ${idx + 1} (${speakerLabel})`}
                          onChange={(nextVoice) =>
                            updateBeat('update beat voice clip', (b) => ({
                              ...b,
                              voiceConfig: nextVoice,
                            }))
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-8 rounded-2xl border border-dashed border-slate-300 dark:border-white/[0.12] text-center space-y-3">
                <Clapperboard size={30} className="mx-auto text-[#F59E0B]" />
                <div className="text-sm font-extrabold">Build Your First Storybook Cutaway</div>
                <p className="text-xs text-slate-500 dark:text-[#949BB0] max-w-md mx-auto">
                  Start with a one-click sample cutaway or create a blank skit to stage characters,
                  swoop the live 3D camera across the island, and record voices.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCreateSampleCutaway}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#F59E0B] text-white text-xs font-extrabold"
                  >
                    <Sparkles size={13} />
                    <span>Sample Cutaway</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateSkit}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#7C5CFF] text-white text-xs font-extrabold"
                  >
                    <Plus size={13} />
                    <span>New Blank Skit</span>
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};
