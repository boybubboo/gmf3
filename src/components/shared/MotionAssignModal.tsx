import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, RotateCcw, ShieldCheck, Sparkles, Wand2, X } from 'lucide-react';
import {
  getSlotsForActorCategory,
  MOTION_SLOT_META_BY_SLOT,
  STANDARD_MOTION_SLOTS,
} from '../../data/motionLibrary';
import {
  autoBlendLoopSeam,
  autoFitPresetTiming,
  clampPresetToNaturalRange,
  evaluateMotionSafety,
  resolveMonsterBlueprintForTarget,
} from '../../three/universalMotionAdapter';
import type {
  CustomAssetMeta,
  CustomClipSlot,
  CustomMotionPreset,
  GameLevel,
  GameProject,
  MotionActorCategory,
  MotionActorTarget,
  MotionAssignmentScope,
  MotionRigArchetype,
} from '../../types/maker';

export interface MotionAssignModalProps {
  preset: CustomMotionPreset;
  target: MotionActorTarget;
  category: MotionActorCategory;
  archetype: MotionRigArchetype;
  boneNames: string[];
  project: GameProject | null;
  currentLevel: GameLevel | null;
  customAsset?: CustomAssetMeta | null;
  onUpdatePreset: (next: CustomMotionPreset) => void;
  onAssign: (opts: {
    preset: CustomMotionPreset;
    slot: CustomClipSlot;
    scope: MotionAssignmentScope;
    entityId?: string;
    blueprintId?: string;
  }) => Promise<void> | void;
  onRestoreDefault: (opts: {
    slot: CustomClipSlot;
    scope: MotionAssignmentScope;
    entityId?: string;
  }) => Promise<void> | void;
  onClose: () => void;
}

function getDefaultScopeForTarget(target: MotionActorTarget): MotionAssignmentScope {
  switch (target.kind) {
    case 'builtInHero':
      return 'heroDefault';
    case 'proceduralNpc':
      return target.entityId ? 'entityOverride' : 'npcDefault';
    case 'buddyCritter':
      return target.entityId ? 'entityOverride' : 'buddyDefault';
    case 'proceduralBaddie':
      return target.entityId ? 'entityOverride' : 'baddieDefault';
    case 'monsterBlueprint':
      return target.entityId ? 'entityOverride' : 'monsterBlueprint';
    case 'customAsset':
      return 'customAsset';
  }
}

export const MotionAssignModal: React.FC<MotionAssignModalProps> = ({
  preset,
  target,
  category,
  archetype,
  boneNames,
  project,
  currentLevel,
  customAsset = null,
  onUpdatePreset,
  onAssign,
  onRestoreDefault,
  onClose,
}) => {
  const [slot, setSlot] = useState<CustomClipSlot>(preset.slot);
  const [scope, setScope] = useState<MotionAssignmentScope>(() => getDefaultScopeForTarget(target));
  const [selectedEntityId, setSelectedEntityId] = useState<string>(() => {
    if ('entityId' in target && target.entityId) return target.entityId;
    const first = currentLevel?.entities.find(
      (e) =>
        (category === 'npc' && e.kind === 'npc' && !e.isBuddy) ||
        (category === 'buddy' && e.isBuddy) ||
        (category === 'enemy' && e.kind === 'baddie')
    );
    return first?.id ?? '';
  });
  const [submitting, setSubmitting] = useState(false);

  const slotOptions = useMemo(() => {
    const primary = getSlotsForActorCategory(category, archetype);
    const seen = new Set(primary.map((s) => s.slot));
    const secondary = STANDARD_MOTION_SLOTS.filter((s) => !seen.has(s.slot));
    return { primary, secondary };
  }, [category, archetype]);

  const evaluatedPreset = useMemo(
    () => (slot === preset.slot ? preset : { ...preset, slot }),
    [preset, slot]
  );

  const fitReport = useMemo(
    () => evaluateMotionSafety(evaluatedPreset, boneNames, archetype),
    [evaluatedPreset, boneNames, archetype]
  );

  const levelCharacters = useMemo(() => {
    if (!currentLevel) return [];
    return currentLevel.entities.filter(
      (e) => e.kind === 'npc' || e.kind === 'baddie' || e.kind === 'hero'
    );
  }, [currentLevel]);

  const monsterBp = useMemo(() => {
    if (target.kind !== 'monsterBlueprint') return undefined;
    return resolveMonsterBlueprintForTarget(target.monsterId, target.entityId, project, currentLevel);
  }, [target, project, currentLevel]);

  const scopeChoices = useMemo(() => {
    const items: { scope: MotionAssignmentScope; label: string; hint: string }[] = [];
    if (category === 'hero' || target.kind === 'builtInHero') {
      items.push({
        scope: 'heroDefault',
        label: 'Hero Action Slot Default',
        hint: 'Used automatically whenever the Hero performs this move in Play Mode.',
      });
    }
    if (category === 'npc') {
      items.push({
        scope: 'npcDefault',
        label: 'Default NPCs',
        hint: 'Applies to all Townsfolk NPCs without a custom entity override.',
      });
    }
    if (category === 'buddy') {
      items.push({
        scope: 'buddyDefault',
        label:
          target.kind === 'buddyCritter'
            ? `All ${target.creatureType} Buddies`
            : 'Buddy Partners Default',
        hint: 'Applies whenever this buddy species cheers, walks, or runs with the Hero.',
      });
    }
    if (target.kind === 'monsterBlueprint' || monsterBp) {
      items.push({
        scope: 'monsterBlueprint',
        label: `Boss / Monster Blueprint (${monsterBp?.name ?? target.label})`,
        hint: 'Assigns to this monster blueprint and every matching monster on the level.',
      });
    }
    if (category === 'enemy') {
      items.push({
        scope: 'baddieDefault',
        label: 'All Procedural Enemies & Bosses',
        hint: 'Project-wide default action for procedural enemies and flyers.',
      });
    }
    if (levelCharacters.length > 0) {
      items.push({
        scope: 'entityOverride',
        label: 'Specific Placed Character',
        hint: 'Only overrides one placed NPC, Buddy, or Boss on the active level.',
      });
    }
    if (customAsset) {
      items.push({
        scope: 'customAsset',
        label: `Custom 3D Model (${customAsset.name})`,
        hint: 'Saved directly onto this uploaded GLB character asset.',
      });
    }
    return items;
  }, [category, target, monsterBp, levelCharacters.length, customAsset]);

  const slotMeta = MOTION_SLOT_META_BY_SLOT[slot];
  const hasTimingWarn = fitReport.warnings.some((w) => w.code === 'tooLong' || w.code === 'tooShort');
  const hasLoopWarn = fitReport.warnings.some((w) => w.code === 'loopSeamJump');
  const hasRangeWarn = fitReport.warnings.some(
    (w) => w.code === 'extremeAngle' || w.code === 'floorClip'
  );

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onAssign({
        preset: evaluatedPreset,
        slot,
        scope,
        entityId: scope === 'entityOverride' ? selectedEntityId || undefined : undefined,
        blueprintId:
          scope === 'monsterBlueprint' && target.kind === 'monsterBlueprint'
            ? target.monsterId
            : monsterBp?.id,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="motion-assign-title"
        className="w-full max-w-xl rounded-2xl bg-[#161923] border border-white/[0.12] text-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/[0.08]">
          <div className="min-w-0">
            <h2 id="motion-assign-title" className="text-base font-bold truncate">
              Assign Variation to Game
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 tabular-nums truncate">
              {evaluatedPreset.name} · {evaluatedPreset.duration.toFixed(2)}s ·{' '}
              {evaluatedPreset.keyframes.length} keys · {evaluatedPreset.loop ? 'Loop' : 'Once'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close assign dialog"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 overflow-y-auto maker-scroll">
          {/* Safety & Fit-Check Summary */}
          <div className="rounded-xl border border-white/[0.08] bg-[#10131C] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 text-xs font-bold">
                {fitReport.status === 'safe' ? (
                  <>
                    <ShieldCheck size={16} className="text-[#20B46A] shrink-0" />
                    <span className="text-[#34D399]">Fit-Check Passed — Safe to Assign</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={16} className="text-[#F59E0B] shrink-0" />
                    <span className="text-[#FBBF24]">Fit-Check Caution</span>
                  </>
                )}
              </div>
              <span className="text-[11px] font-mono tabular-nums text-slate-400">
                {fitReport.matchedBoneCount}/{fitReport.totalPresetBones || boneNames.length} joints fit
              </span>
            </div>

            {fitReport.warnings.length > 0 ? (
              <ul className="space-y-1 text-xs text-slate-300">
                {fitReport.warnings.map((w, i) => (
                  <li key={`${w.code}_${i}`} className="flex items-start gap-2">
                    <span
                      className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                        w.severity === 'caution' ? 'bg-[#F59E0B]' : 'bg-[#38BDF8]'
                      }`}
                    />
                    <span>{w.message}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-400">
                Timing ({slotMeta?.recommendedDurationSec[0]}s–{slotMeta?.recommendedDurationSec[1]}s),
                joint comfort bounds, floor clearance, and bone mapping look clean.
              </p>
            )}

            {(hasTimingWarn || hasLoopWarn || hasRangeWarn) && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {hasTimingWarn && (
                  <button
                    type="button"
                    onClick={() => onUpdatePreset(autoFitPresetTiming(evaluatedPreset))}
                    className="px-2.5 py-1 rounded-lg bg-[#7C5CFF]/20 hover:bg-[#7C5CFF]/30 text-[#C4B5FD] text-[11px] font-bold inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                  >
                    <Wand2 size={11} />
                    <span>Auto-Fit Timing</span>
                  </button>
                )}
                {hasLoopWarn && (
                  <button
                    type="button"
                    onClick={() => onUpdatePreset(autoBlendLoopSeam(evaluatedPreset))}
                    className="px-2.5 py-1 rounded-lg bg-[#06B6D4]/20 hover:bg-[#06B6D4]/30 text-[#67E8F9] text-[11px] font-bold inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                  >
                    <Sparkles size={11} />
                    <span>Blend Loop Seam</span>
                  </button>
                )}
                {hasRangeWarn && (
                  <button
                    type="button"
                    onClick={() => onUpdatePreset(clampPresetToNaturalRange(evaluatedPreset, archetype))}
                    className="px-2.5 py-1 rounded-lg bg-[#F59E0B]/20 hover:bg-[#F59E0B]/30 text-[#FCD34D] text-[11px] font-bold inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                  >
                    <CheckCircle2 size={11} />
                    <span>Clamp Natural Range</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 1. Target Action Slot */}
          <div className="space-y-1.5">
            <label htmlFor="assign-slot-select" className="block text-xs font-bold text-slate-300">
              1. Which move or behavior slot should this replace?
            </label>
            <select
              id="assign-slot-select"
              value={slot}
              onChange={(e) => setSlot(e.target.value as CustomClipSlot)}
              className="w-full px-3 py-2 rounded-xl bg-[#1F2430] border border-white/[0.1] text-xs font-bold text-white"
            >
              <optgroup label="Recommended for this character">
                {slotOptions.primary.map((s) => (
                  <option key={s.slot} value={s.slot}>
                    {s.label} · ({s.recommendedDurationSec[0]}s–{s.recommendedDurationSec[1]}s)
                  </option>
                ))}
              </optgroup>
              <optgroup label="All Other Slots">
                {slotOptions.secondary.map((s) => (
                  <option key={s.slot} value={s.slot}>
                    {s.label}
                  </option>
                ))}
              </optgroup>
            </select>
            {slotMeta && (
              <p className="text-[11px] text-slate-400">{slotMeta.description}</p>
            )}
          </div>

          {/* 2. Target Scope */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-300">
              2. Where should this variation apply?
            </div>
            <div className="space-y-1.5">
              {scopeChoices.map((ch) => {
                const active = scope === ch.scope;
                return (
                  <button
                    key={ch.scope}
                    type="button"
                    onClick={() => setScope(ch.scope)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl border transition-colors ${
                      active
                        ? 'border-[#7C5CFF] bg-[#7C5CFF]/15'
                        : 'border-white/[0.08] bg-[#10131C] hover:border-white/[0.18]'
                    }`}
                  >
                    <div className="text-xs font-bold text-white">{ch.label}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{ch.hint}</div>
                  </button>
                );
              })}
            </div>

            {scope === 'entityOverride' && levelCharacters.length > 0 && (
              <div className="pt-1">
                <select
                  value={selectedEntityId}
                  onChange={(e) => setSelectedEntityId(e.target.value)}
                  aria-label="Choose placed level character"
                  className="w-full px-3 py-2 rounded-xl bg-[#1F2430] border border-white/[0.1] text-xs font-semibold text-white"
                >
                  {levelCharacters.map((ent) => (
                    <option key={ent.id} value={ent.id}>
                      {ent.name} ({ent.kind === 'baddie' ? (ent.isBoss ? 'Boss' : 'Enemy') : ent.isBuddy ? 'Buddy' : 'NPC'})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Logic Rule Trigger Tip */}
          <div className="rounded-xl bg-[#10131C] border border-white/[0.06] px-3.5 py-2.5 text-[11px] text-slate-400">
            Logic Rules can also trigger this variation anytime using{' '}
            <span className="text-white font-semibold">play an action</span> →{' '}
            <span className="font-mono text-[#C4B5FD]">"{evaluatedPreset.name}"</span>.
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 border-t border-white/[0.08] bg-[#12151E]">
          <button
            type="button"
            disabled={submitting}
            onClick={async () => {
              setSubmitting(true);
              try {
                await onRestoreDefault({
                  slot,
                  scope,
                  entityId: scope === 'entityOverride' ? selectedEntityId || undefined : undefined,
                });
                onClose();
              } finally {
                setSubmitting(false);
              }
            }}
            className="px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-slate-300 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <RotateCcw size={13} />
            <span>Restore Built-In Default</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-slate-300 whitespace-nowrap shrink-0"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleConfirm()}
              className="px-4 py-2 rounded-xl bg-[#20B46A] hover:bg-[#1A9E5C] text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <CheckCircle2 size={14} />
              <span>{submitting ? 'Assigning…' : 'Assign Variation'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
