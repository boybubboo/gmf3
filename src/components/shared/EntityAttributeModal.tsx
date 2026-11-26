import React, { useMemo, useState } from 'react';
import {
  Box,
  MessageCircle,
  Shield,
  Sparkles,
  Swords,
  UserCheck,
  UserX,
  Users,
  X,
} from 'lucide-react';
import {
  EntityKindMeta,
  MisfitAbilityCatalog,
  PresetLibrary,
  getProjectInventoryItems,
} from '../../data/registries';
import {
  BADDIE_ACTION_BY_ID,
  BADDIE_ACTION_LIBRARY,
  DETECTION_MODE_OPTIONS,
  FLIGHT_PATTERN_OPTIONS,
  PATROL_PATTERN_OPTIONS,
  WINDUP_CLUE_OPTIONS,
  resolveBaddieAIConfig,
} from '../../data/baddieActionLibrary';
import type { MakerStore } from '../../store/useMakerStore';
import type {
  BaddieAIConfig,
  BaddieDetectionMode,
  BaddieFlightPattern,
  BaddiePatrolPattern,
  BaddieWindupClueStyle,
  CreatureBodyId,
  CritterAttitude,
  CritterWarmTrigger,
  EntityRolePreset,
  LevelEntity,
  MisfitAbilityId,
  MonsterAttackType,
  ObjectInteractionAttributeId,
  ObjectInteractionCalibration,
} from '../../types/maker';
import { OBJECT_INTERACTION_ATTRIBUTES } from '../../data/motionLibrary';
import { AssetThumbnail } from './AssetThumbnail';
import { ChatBubbleStudioModal } from './ChatBubbleStudioModal';
import { DialogueVoiceEditor } from './DialogueVoiceEditor';
import { EntityItemAssignPanel } from './EntityItemAssignPanel';
import { FieldLabel } from './MakerUI';
import { ObjectInteractionTestModal } from './ObjectInteractionTestModal';

const ROLE_PRESET_OPTIONS: {
  id: EntityRolePreset;
  label: string;
  desc: string;
  accent: string;
  Icon: React.FC<{ size?: number; className?: string }>;
}[] = [
  {
    id: 'buddy',
    label: 'Recruitable Buddy',
    desc: 'Friendly ally who joins your party & grants a Misfit power.',
    accent: '#20B46A',
    Icon: UserCheck,
  },
  {
    id: 'enemy',
    label: 'Hostile Enemy',
    desc: 'Patrols or chases hero, deals damage & can become a Boss.',
    accent: '#F2545B',
    Icon: Swords,
  },
  {
    id: 'neutralSpeaker',
    label: 'Neutral Speaker',
    desc: 'Talks with dialogue lines, voice clips & custom chat bubble.',
    accent: '#7C5CFF',
    Icon: Users,
  },
  {
    id: 'neutralSilent',
    label: 'Neutral Non-Speaker',
    desc: 'Quiet townsfolk or scenic actor with optional item gift.',
    accent: '#64748B',
    Icon: UserX,
  },
];

function inferEntityRolePreset(entity: LevelEntity): EntityRolePreset {
  if (entity.kind === 'baddie') return 'enemy';
  if (entity.kind === 'npc') {
    if (entity.isBuddy) return 'buddy';
    return entity.dialogue.trim() ? 'neutralSpeaker' : 'neutralSilent';
  }
  return 'neutralSpeaker';
}

export const EntityAttributeModal: React.FC<{ store: MakerStore }> = ({ store }) => {
  const target = store.attributeModifierTarget;
  const currentProject = store.currentProject;
  const currentLevel = store.currentLevel;
  const [chatTargetId, setChatTargetId] = useState<string | null>(null);
  const [showInteractionTester, setShowInteractionTester] = useState(false);

  const entity = useMemo(() => {
    if (!target || target.kind !== 'entity' || !currentLevel) return null;
    return currentLevel.entities.find((e) => e.id === target.entityId) ?? null;
  }, [target, currentLevel]);

  const assetMeta = useMemo(() => {
    if (!target || target.kind !== 'assetMeta') return null;
    return store.customAssets.find((a) => a.id === target.assetId) ?? null;
  }, [target, store.customAssets]);

  const catalogItems = useMemo(
    () => getProjectInventoryItems(currentProject),
    [currentProject]
  );

  if (!target || !currentProject) return null;

  if (target.kind === 'entity' && !entity) {
    return (
      <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.1] p-5 space-y-3 shadow-2xl">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold">Entity no longer in level</h3>
            <button
              type="button"
              onClick={() => store.setAttributeModifierTarget(null)}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1F2430]"
            >
              <X size={15} />
            </button>
          </div>
          <p className="text-xs text-slate-500 dark:text-[#949BB0]">
            The selected object or character was removed from this level.
          </p>
        </div>
      </div>
    );
  }

  if (target.kind === 'assetMeta' && !assetMeta) {
    return null;
  }

  // Placed entity attribute modifier mode
  if (target.kind === 'entity' && entity) {
    const meta = EntityKindMeta[entity.kind];
    const boundAsset = entity.customAssetId
      ? store.customAssets.find((a) => a.id === entity.customAssetId) ?? null
      : null;
    const isActorKind = entity.kind === 'npc' || entity.kind === 'baddie';
    const activeRole = inferEntityRolePreset(entity);

    const applyEntityRolePreset = (role: EntityRolePreset) => {
      store.updateEntity(entity.id, `set role to ${role}`, (ent) => {
        if (role === 'enemy') {
          return {
            ...ent,
            kind: 'baddie',
            isBuddy: false,
            critterAttitude: undefined,
            brain: ent.brain || 'Patrol',
            health: Math.max(1, ent.health || 3),
            speed: Math.max(1, ent.speed || 3),
          };
        }
        if (role === 'buddy') {
          return {
            ...ent,
            kind: 'npc',
            isBuddy: true,
            isBoss: false,
            critterAttitude: 'none',
            dialogue:
              ent.dialogue || "Count me in! Let's stick together on this trail.",
          };
        }
        if (role === 'neutralSpeaker') {
          return {
            ...ent,
            kind: 'npc',
            isBuddy: false,
            isBoss: false,
            dialogue: ent.dialogue || 'Hello, traveler! Enjoy exploring the woods.',
          };
        }
        return {
          ...ent,
          kind: 'npc',
          isBuddy: false,
          isBoss: false,
          dialogue: '',
        };
      });
    };

    return (
      <div
        className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-3 sm:p-5"
        onClick={(e) => {
          if (e.target === e.currentTarget) store.setAttributeModifierTarget(null);
        }}
      >
        <div className="w-full max-w-2xl max-h-[90vh] rounded-3xl bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.1] shadow-2xl flex flex-col overflow-hidden">
          <header className="shrink-0 px-5 py-3.5 border-b border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-[#131720]">
            <div className="flex items-center gap-3 min-w-0">
              <AssetThumbnail
                entity={entity}
                customAsset={boundAsset}
                size={44}
                rounded="rounded-xl"
              />
              <div className="min-w-0">
                <input
                  type="text"
                  value={entity.name}
                  onChange={(e) =>
                    store.updateEntity(
                      entity.id,
                      'rename entity',
                      (ent) => ({ ...ent, name: e.target.value }),
                      false
                    )
                  }
                  className="text-sm sm:text-base font-extrabold bg-transparent focus:outline-none border-b border-transparent focus:border-[#7C5CFF] w-full"
                />
                <div className="text-[11px] font-semibold text-slate-500 dark:text-[#949BB0]">
                  Attributes &amp; Role ·{' '}
                  <span style={{ color: meta.tint }}>{meta.title}</span>
                  {boundAsset ? ` · ${boundAsset.name}` : ''}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => store.setAttributeModifierTarget(null)}
              className="h-8 px-3 rounded-xl bg-[#7C5CFF] hover:bg-[#6A48F5] text-white text-xs font-extrabold whitespace-nowrap shrink-0"
            >
              Done
            </button>
          </header>

          <div className="flex-1 min-h-0 overflow-y-auto maker-scroll p-5 space-y-4">
            {/* Role Preset Switcher for Actors */}
            {(isActorKind || entity.kind === 'prop' || entity.kind === 'scenery') && (
              <div className="space-y-2">
                <FieldLabel text="Character Role Preset" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ROLE_PRESET_OPTIONS.map((opt) => {
                    const Icon = opt.Icon;
                    const active = isActorKind && activeRole === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => applyEntityRolePreset(opt.id)}
                        className={`p-2.5 rounded-2xl border text-left transition-all flex items-start gap-2.5 ${
                          active
                            ? 'bg-slate-900/5 dark:bg-white/[0.06] border-[#7C5CFF] shadow-xs'
                            : 'bg-slate-50 dark:bg-[#1C212E] border-slate-200/70 dark:border-white/[0.06] hover:border-[#7C5CFF]/50'
                        }`}
                      >
                        <span
                          className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                          style={{
                            backgroundColor: `${opt.accent}22`,
                            color: opt.accent,
                          }}
                        >
                          <Icon size={14} />
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                            {opt.label}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-[#949BB0] leading-snug">
                            {opt.desc}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* NPC & Creature Details */}
            {entity.kind === 'npc' && (
              <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2.5">
                <FieldLabel text="Woodland Look & Companion Details" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-[#949BB0]">
                      Built-in Creature Body
                    </span>
                    <select
                      value={entity.creatureType ?? ''}
                      onChange={(e) =>
                        store.updateEntity(entity.id, 'change creature look', (ent) => ({
                          ...ent,
                          creatureType: (e.target.value || undefined) as CreatureBodyId | undefined,
                        }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-xs font-semibold border border-slate-200/70 dark:border-white/[0.08]"
                    >
                      <option value="">Default Townsperson</option>
                      <option value="Skunk">Skunk</option>
                      <option value="Porcupine">Porcupine</option>
                      <option value="Mole Rat">Mole Rat</option>
                      <option value="Vulture">Vulture</option>
                      <option value="Duckling">Duckling</option>
                      <option value="Squirrel">Squirrel</option>
                      <option value="Badger">Badger</option>
                      <option value="Owl">Owl</option>
                    </select>
                  </label>

                  <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white dark:bg-[#171A23] border border-slate-200/70 dark:border-white/[0.08] text-xs font-bold cursor-pointer self-end">
                    <span>Recruitable Buddy</span>
                    <input
                      type="checkbox"
                      checked={Boolean(entity.isBuddy)}
                      onChange={(e) =>
                        store.updateEntity(entity.id, 'toggle buddy', (ent) => ({
                          ...ent,
                          isBuddy: e.target.checked,
                        }))
                      }
                      className="accent-[#20B46A] w-4 h-4"
                    />
                  </label>
                </div>

                {entity.isBuddy ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <label className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-[#949BB0]">
                        Detour / Area Label
                      </span>
                      <input
                        type="text"
                        value={entity.buddyAreaLabel ?? ''}
                        onChange={(e) =>
                          store.updateEntity(
                            entity.id,
                            'edit buddy area label',
                            (ent) => ({ ...ent, buddyAreaLabel: e.target.value }),
                            false
                          )
                        }
                        placeholder="e.g. Mountain Cave"
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-xs font-medium border border-slate-200/70 dark:border-white/[0.08]"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-[#949BB0]">
                        Misfit Power Granted
                      </span>
                      <select
                        value={entity.misfitAbility ?? ''}
                        onChange={(e) =>
                          store.updateEntity(entity.id, 'set misfit ability', (ent) => ({
                            ...ent,
                            misfitAbility: (e.target.value || undefined) as MisfitAbilityId | undefined,
                          }))
                        }
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-xs font-semibold border border-slate-200/70 dark:border-white/[0.08]"
                      >
                        <option value="">None (companion only)</option>
                        {MisfitAbilityCatalog.map((ab) => (
                          <option key={ab.id} value={ab.id}>
                            {ab.title} — {ab.strengthLabel}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : (
                  <div className="space-y-2 pt-1 border-t border-slate-200/70 dark:border-white/[0.06]">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 dark:text-[#949BB0]">
                          Critter Reaction
                        </span>
                        <select
                          value={entity.critterAttitude ?? 'none'}
                          onChange={(e) => {
                            const nextAtt = e.target.value as CritterAttitude;
                            store.updateEntity(entity.id, 'set critter attitude', (ent) => ({
                              ...ent,
                              critterAttitude: nextAtt === 'none' ? undefined : nextAtt,
                              critterWarmOn:
                                nextAtt === 'none'
                                  ? ent.critterWarmOn
                                  : ent.critterWarmOn ?? 'nearbyPower',
                            }));
                          }}
                          className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-xs font-semibold border border-slate-200/70 dark:border-white/[0.08]"
                        >
                          <option value="none">Friendly</option>
                          <option value="teasing">Teasing / Scolding initially</option>
                          <option value="nervous">Shy / Backs away initially</option>
                          <option value="grumpy">Grumpy / Skeptical initially</option>
                        </select>
                      </label>
                      {entity.critterAttitude && entity.critterAttitude !== 'none' && (
                        <label className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-500 dark:text-[#949BB0]">
                            Warms Up Trigger
                          </span>
                          <select
                            value={entity.critterWarmOn ?? 'nearbyPower'}
                            onChange={(e) =>
                              store.updateEntity(entity.id, 'set warm trigger', (ent) => ({
                                ...ent,
                                critterWarmOn: e.target.value as CritterWarmTrigger,
                              }))
                            }
                            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-xs font-semibold border border-slate-200/70 dark:border-white/[0.08]"
                          >
                            <option value="nearbyPower">Nearby Misfit power / puzzle</option>
                            <option value="allBuddies">All buddies reunited</option>
                            <option value="flagSet">Story flag raised</option>
                          </select>
                        </label>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Enemy / Stats & Behavior */}
            {meta.usesStats && (
              <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2.5">
                <div className="flex items-center justify-between">
                  <FieldLabel text="Combat Stats & Brain" />
                  <Shield size={13} className="text-[#F59E0B]" />
                </div>
                {entity.kind === 'baddie' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-xs font-bold cursor-pointer">
                      <span>Make it a Boss</span>
                      <input
                        type="checkbox"
                        checked={entity.isBoss}
                        onChange={(e) =>
                          store.updateEntity(entity.id, 'toggle boss', (ent) => ({
                            ...ent,
                            isBoss: e.target.checked,
                          }))
                        }
                        className="accent-[#F59E0B] w-4 h-4"
                      />
                    </label>
                    <select
                      value={entity.brain}
                      onChange={(e) =>
                        store.updateEntity(entity.id, 'change brain', (ent) => ({
                          ...ent,
                          brain: e.target.value,
                        }))
                      }
                      className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-xs font-semibold"
                    >
                      {PresetLibrary.brains.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span>Health</span>
                      <span className="tabular-nums">{entity.health}</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={40}
                      value={entity.health}
                      onChange={(e) =>
                        store.updateEntity(entity.id, 'change health', (ent) => ({
                          ...ent,
                          health: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-[#F2545B]"
                    />
                  </label>
                  <label className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span>Speed</span>
                      <span className="tabular-nums">{entity.speed}</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={8}
                      value={entity.speed}
                      onChange={(e) =>
                        store.updateEntity(entity.id, 'change speed', (ent) => ({
                          ...ent,
                          speed: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-[#7C5CFF]"
                    />
                  </label>
                </div>

                {entity.kind === 'baddie' && (() => {
                  const ai = resolveBaddieAIConfig(entity);
                  const canFly = Boolean(entity.monsterConfig?.canFly || entity.brain === 'Flyer');
                  const patchAI = (partial: Partial<BaddieAIConfig>, label: string) => {
                    store.updateEntity(entity.id, label, (ent) => {
                      const nextAI = { ...resolveBaddieAIConfig(ent), ...partial };
                      return {
                        ...ent,
                        baddieAI: nextAI,
                        monsterConfig: ent.monsterConfig
                          ? {
                              ...ent.monsterConfig,
                              primaryAttack: nextAI.primaryAction,
                              secondaryAttack: nextAI.secondaryAction,
                              baddieAI: nextAI,
                            }
                          : ent.monsterConfig,
                      };
                    });
                  };
                  const primMeta = BADDIE_ACTION_BY_ID[ai.primaryAction];
                  const secMeta = BADDIE_ACTION_BY_ID[ai.secondaryAction];
                  return (
                    <div className="pt-2.5 mt-1 border-t border-slate-200/80 dark:border-white/[0.08] space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-[#A5AEC4]">
                          AI Intelligence, Territory &amp; Action Library
                        </span>
                        <span className="text-[10px] font-bold text-[#7C5CFF]">
                          {canFly ? 'Air + Ground' : 'Ground'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <label className="space-y-1">
                          <span className="text-[11px] font-semibold text-slate-500 dark:text-[#949BB0]">
                            Primary Attack
                          </span>
                          <select
                            value={ai.primaryAction}
                            onChange={(e) =>
                              patchAI({ primaryAction: e.target.value as MonsterAttackType }, 'set primary action')
                            }
                            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-xs font-semibold"
                          >
                            {BADDIE_ACTION_LIBRARY.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.label} ({a.heroEffect})
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="space-y-1">
                          <span className="text-[11px] font-semibold text-slate-500 dark:text-[#949BB0]">
                            Secondary Attack
                          </span>
                          <select
                            value={ai.secondaryAction}
                            onChange={(e) =>
                              patchAI({ secondaryAction: e.target.value as MonsterAttackType }, 'set secondary action')
                            }
                            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-xs font-semibold"
                          >
                            {BADDIE_ACTION_LIBRARY.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.label} ({a.heroEffect})
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-[#949BB0] leading-snug">
                        {primMeta.label} ({primMeta.flightMode === 'groundOnly' ? 'Ground only' : 'Air/Ground'}) · {secMeta.label} ({secMeta.flightMode === 'groundOnly' ? 'Lands to smash' : 'Air/Ground'})
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <label className="space-y-1">
                          <span className="text-[11px] font-semibold text-slate-500 dark:text-[#949BB0]">
                            Detection Mode
                          </span>
                          <select
                            value={ai.detectionMode}
                            onChange={(e) =>
                              patchAI({ detectionMode: e.target.value as BaddieDetectionMode }, 'set detection mode')
                            }
                            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-xs font-semibold"
                          >
                            {DETECTION_MODE_OPTIONS.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="space-y-1">
                          <span className="text-[11px] font-semibold text-slate-500 dark:text-[#949BB0]">
                            {canFly ? 'Flight Pattern' : 'Patrol Pattern'}
                          </span>
                          <select
                            value={canFly ? ai.flightPattern : ai.patrolPattern}
                            onChange={(e) =>
                              canFly
                                ? patchAI({ flightPattern: e.target.value as BaddieFlightPattern }, 'set flight pattern')
                                : patchAI({ patrolPattern: e.target.value as BaddiePatrolPattern }, 'set patrol pattern')
                            }
                            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-xs font-semibold"
                          >
                            {(canFly ? FLIGHT_PATTERN_OPTIONS : PATROL_PATTERN_OPTIONS).map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <label className="space-y-1">
                          <div className="flex justify-between text-[11px] font-semibold">
                            <span>Aggro Range</span>
                            <span className="tabular-nums">{ai.aggroRange}m</span>
                          </div>
                          <input
                            type="range"
                            min={6}
                            max={45}
                            step={1}
                            value={ai.aggroRange}
                            onChange={(e) => patchAI({ aggroRange: Number(e.target.value) }, 'set aggro range')}
                            className="w-full accent-[#7C5CFF]"
                          />
                        </label>
                        <label className="space-y-1">
                          <div className="flex justify-between text-[11px] font-semibold">
                            <span>Territory Radius</span>
                            <span className="tabular-nums">{ai.territoryRadius}m</span>
                          </div>
                          <input
                            type="range"
                            min={6}
                            max={50}
                            step={1}
                            value={ai.territoryRadius}
                            onChange={(e) => patchAI({ territoryRadius: Number(e.target.value) }, 'set territory radius')}
                            className="w-full accent-[#20B46A]"
                          />
                        </label>
                        <label className="space-y-1">
                          <div className="flex justify-between text-[11px] font-semibold">
                            <span>Random Variety</span>
                            <span className="tabular-nums">{Math.round(ai.varietyFactor * 100)}%</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={ai.varietyFactor}
                            onChange={(e) => patchAI({ varietyFactor: Number(e.target.value) }, 'set variety factor')}
                            className="w-full accent-[#F59E0B]"
                          />
                        </label>
                        {canFly ? (
                          <label className="space-y-1">
                            <div className="flex justify-between text-[11px] font-semibold">
                              <span>Flight Altitude</span>
                              <span className="tabular-nums">{ai.flightAltitude.toFixed(1)}m</span>
                            </div>
                            <input
                              type="range"
                              min={1.2}
                              max={9}
                              step={0.2}
                              value={ai.flightAltitude}
                              onChange={(e) => patchAI({ flightAltitude: Number(e.target.value) }, 'set flight altitude')}
                              className="w-full accent-[#38BDF8]"
                            />
                          </label>
                        ) : (
                          <label className="space-y-1">
                            <div className="flex justify-between text-[11px] font-semibold">
                              <span>Sight Cone</span>
                              <span className="tabular-nums">{ai.sightAngleDeg}&deg;</span>
                            </div>
                            <input
                              type="range"
                              min={45}
                              max={180}
                              step={5}
                              value={ai.sightAngleDeg}
                              onChange={(e) => patchAI({ sightAngleDeg: Number(e.target.value) }, 'set sight cone')}
                              className="w-full accent-[#38BDF8]"
                            />
                          </label>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <label className="space-y-1">
                          <span className="text-[11px] font-semibold text-slate-500 dark:text-[#949BB0]">
                            Pre-Attack Windup Clue
                          </span>
                          <select
                            value={ai.windupClueStyle ?? 'auto'}
                            onChange={(e) =>
                              patchAI(
                                { windupClueStyle: e.target.value as BaddieWindupClueStyle },
                                'set windup clue style'
                              )
                            }
                            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-xs font-semibold"
                          >
                            {WINDUP_CLUE_OPTIONS.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        {canFly && (
                          <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white dark:bg-[#171A23] border border-sky-500/30 text-xs font-bold cursor-pointer self-end">
                            <div className="min-w-0">
                              <div className="text-[11px] font-bold text-slate-800 dark:text-white leading-tight">
                                Land Between Air Attacks
                              </div>
                              <div className="text-[10px] font-normal text-slate-500 dark:text-[#949BB0] truncate">
                                Hover &amp; land after 1 aerial strike
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={ai.landAfterAirAttack !== false}
                              onChange={(e) =>
                                patchAI(
                                  { landAfterAirAttack: e.target.checked },
                                  'toggle land after air attack'
                                )
                              }
                              className="accent-[#38BDF8] w-4 h-4 shrink-0"
                            />
                          </label>
                        )}
                      </div>

                      {entity.isBoss && (
                        <label className="block space-y-1">
                          <div className="flex justify-between text-[11px] font-semibold">
                            <span>Victory Treasure Chest Gold</span>
                            <span className="tabular-nums">{ai.bossRewardCoins ?? 25} Coins</span>
                          </div>
                          <input
                            type="range"
                            min={5}
                            max={100}
                            step={5}
                            value={ai.bossRewardCoins ?? 25}
                            onChange={(e) =>
                              patchAI({ bossRewardCoins: Number(e.target.value) }, 'set boss reward coins')
                            }
                            className="w-full accent-[#FBBF24]"
                          />
                        </label>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Treasure Loot */}
            {entity.kind === 'treasure' && (
              <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2">
                <FieldLabel text="Chest Contents" />
                <select
                  value={entity.loot}
                  onChange={(e) =>
                    store.updateEntity(entity.id, 'change loot', (ent) => ({
                      ...ent,
                      loot: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#171A23] text-xs font-semibold"
                >
                  {PresetLibrary.loot.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Puzzle Config */}
            {entity.kind === 'puzzle' && (
              <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2">
                <FieldLabel text="Puzzle & Misfit Requirement" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    value={entity.puzzleType}
                    onChange={(e) =>
                      store.updateEntity(entity.id, 'change puzzle', (ent) => ({
                        ...ent,
                        puzzleType: e.target.value,
                      }))
                    }
                    className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-xs font-semibold"
                  >
                    {PresetLibrary.puzzles.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <select
                    value={entity.puzzleRequires ?? ''}
                    onChange={(e) =>
                      store.updateEntity(entity.id, 'set puzzle misfit requirement', (ent) => ({
                        ...ent,
                        puzzleRequires: (e.target.value || undefined) as MisfitAbilityId | undefined,
                      }))
                    }
                    className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-xs font-semibold"
                  >
                    <option value="">Walk over / Touch (default)</option>
                    {MisfitAbilityCatalog.map((ab) => (
                      <option key={ab.id} value={ab.id}>
                        {ab.title} ({ab.flawLabel})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Dialogue, Voice & Chat Bubble Studio */}
            {(entity.kind === 'npc' || entity.kind === 'sign' || entity.kind === 'baddie') && (
              <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <FieldLabel
                    text={entity.kind === 'baddie' ? 'Battle Cry & Speech' : 'Dialogue & Voice'}
                  />
                  <button
                    type="button"
                    onClick={() => setChatTargetId(entity.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#38BDF8]/15 hover:bg-[#38BDF8]/25 text-[#0EA5E9] dark:text-[#38BDF8] text-[11px] font-bold whitespace-nowrap"
                  >
                    <MessageCircle size={12} />
                    <span>Chat Bubble Style</span>
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={entity.dialogue}
                  onChange={(e) =>
                    store.updateEntity(
                      entity.id,
                      'edit dialogue',
                      (ent) => ({ ...ent, dialogue: e.target.value }),
                      false
                    )
                  }
                  placeholder="Enter lines separated by new lines (leave blank for non-speaker)…"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#171A23] text-xs font-medium resize-none border border-slate-200/70 dark:border-white/[0.08] focus:outline-none focus:ring-2 focus:ring-[#7C5CFF]"
                />
                <DialogueVoiceEditor
                  dialogueText={entity.dialogue}
                  voiceConfig={entity.voiceConfig}
                  projectChatSettings={currentProject.chatSettings}
                  onChange={(nextVoice) =>
                    store.updateEntity(entity.id, 'update dialogue voice', (ent) => ({
                      ...ent,
                      voiceConfig: nextVoice,
                    }))
                  }
                />
              </div>
            )}

            {/* Inventory / Pickup / Reward */}
            <EntityItemAssignPanel entity={entity} store={store} />

            {/* Interaction Attributes & Character Calibration */}
            {entity.kind !== 'fxEmitter' && entity.kind !== 'hero' && (() => {
              const resolvedAttrs =
                entity.interactionAttributes ?? boundAsset?.interactionAttributes ?? [];
              const resolvedCals =
                entity.interactionCalibrations ?? boundAsset?.interactionCalibrations ?? {};
              return (
                <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <FieldLabel text="Interaction Attributes (Object Actions)" />
                    <button
                      type="button"
                      onClick={() => setShowInteractionTester(true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#7C5CFF] hover:bg-[#6A48F5] text-white text-[11px] font-bold whitespace-nowrap"
                    >
                      <Sparkles size={12} />
                      <span>Test & Calibrate Character</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {OBJECT_INTERACTION_ATTRIBUTES.map((attr) => {
                      const checked = resolvedAttrs.includes(attr.id);
                      return (
                        <label
                          key={attr.id}
                          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer ${
                            checked
                              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                              : 'bg-white dark:bg-[#171A23] border-slate-200/70 dark:border-white/[0.06] text-slate-600 dark:text-[#A5AEC4]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const next = checked
                                ? resolvedAttrs.filter((id) => id !== attr.id)
                                : [...resolvedAttrs, attr.id];
                              store.updateEntity(
                                entity.id,
                                `toggle ${attr.label} attribute`,
                                (ent) => ({
                                  ...ent,
                                  interactionAttributes: next,
                                })
                              );
                            }}
                            className="accent-[#10B981] w-3.5 h-3.5 shrink-0"
                          />
                          <span className="truncate">{attr.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  {showInteractionTester && (
                    <ObjectInteractionTestModal
                      title={entity.name}
                      attributes={resolvedAttrs}
                      calibrations={resolvedCals}
                      customAssetId={entity.customAssetId}
                      entity={entity}
                      customHeroAssetId={
                        currentLevel?.entities.find((e) => e.kind === 'hero')?.customAssetId
                      }
                      onSaveCalibration={(attr, cal) => {
                        const nextAttrs = resolvedAttrs.includes(attr)
                          ? resolvedAttrs
                          : [...resolvedAttrs, attr];
                        const nextCals: Partial<
                          Record<ObjectInteractionAttributeId, ObjectInteractionCalibration>
                        > = { ...resolvedCals, [attr]: cal };
                        store.updateEntity(
                          entity.id,
                          `calibrate ${attr} interaction`,
                          (ent) => ({
                            ...ent,
                            interactionAttributes: nextAttrs,
                            interactionCalibrations: nextCals,
                          })
                        );
                      }}
                      onClose={() => setShowInteractionTester(false)}
                    />
                  )}
                </div>
              );
            })()}

            {/* 3D Model Binding */}
            {entity.kind !== 'fxEmitter' && (
              <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-[#1F2430] flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-extrabold">3D Model Appearance</div>
                  <div className="text-[11px] text-slate-500 dark:text-[#949BB0]">
                    {boundAsset ? `Bound: ${boundAsset.name}` : `Using built-in ${meta.title}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => store.setShowingAssetVault(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#7C5CFF] hover:bg-[#6A48F5] text-white text-xs font-bold whitespace-nowrap"
                  >
                    <Box size={13} />
                    <span>{boundAsset ? 'Swap 3D GLB Model' : 'Bind 3D GLB Model'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {chatTargetId && (
          <ChatBubbleStudioModal
            store={store}
            initialTarget={chatTargetId}
            onClose={() => setChatTargetId(null)}
          />
        )}
      </div>
    );
  }

  // Asset template default attributes mode (triggered from Character Maker or Object Maker)
  if (target.kind === 'assetMeta' && assetMeta) {
    const activeRole: EntityRolePreset = assetMeta.defaultRolePreset ?? 'neutralSpeaker';
    const saveMetaPatch = (patch: Partial<typeof assetMeta>) => {
      void store.updateCustomAssetMeta({
        ...assetMeta,
        ...patch,
      });
    };

    return (
      <div
        className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-3 sm:p-5"
        onClick={(e) => {
          if (e.target === e.currentTarget) store.setAttributeModifierTarget(null);
        }}
      >
        <div className="w-full max-w-xl max-h-[88vh] rounded-3xl bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.1] shadow-2xl flex flex-col overflow-hidden">
          <header className="shrink-0 px-5 py-3.5 border-b border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-[#131720]">
            <div className="flex items-center gap-3 min-w-0">
              <AssetThumbnail customAsset={assetMeta} size={42} rounded="rounded-xl" />
              <div className="min-w-0">
                <div className="text-sm font-extrabold truncate">{assetMeta.name}</div>
                <div className="text-[11px] font-semibold text-slate-500 dark:text-[#949BB0]">
                  Default Spawn Attributes ({assetMeta.category})
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => store.setAttributeModifierTarget(null)}
              className="h-8 px-3 rounded-xl bg-[#7C5CFF] hover:bg-[#6A48F5] text-white text-xs font-extrabold whitespace-nowrap"
            >
              Done
            </button>
          </header>

          <div className="flex-1 min-h-0 overflow-y-auto maker-scroll p-5 space-y-4">
            <div className="p-3 rounded-2xl bg-[#7C5CFF]/10 border border-[#7C5CFF]/25 flex items-start gap-2 text-xs text-slate-700 dark:text-[#D5DCF0]">
              <Sparkles size={14} className="text-[#7C5CFF] shrink-0 mt-0.5" />
              <span>
                Defaults saved here automatically apply whenever you drag or drop{' '}
                <strong>{assetMeta.name}</strong> into any level.
              </span>
            </div>

            <div className="space-y-2">
              <FieldLabel text="Default Spawn Role" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ROLE_PRESET_OPTIONS.map((opt) => {
                  const Icon = opt.Icon;
                  const active = activeRole === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => saveMetaPatch({ defaultRolePreset: opt.id })}
                      className={`p-2.5 rounded-2xl border text-left transition-all flex items-start gap-2.5 ${
                        active
                          ? 'bg-slate-900/5 dark:bg-white/[0.06] border-[#7C5CFF]'
                          : 'bg-slate-50 dark:bg-[#1C212E] border-slate-200/70 dark:border-white/[0.06]'
                      }`}
                    >
                      <span
                        className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                        style={{
                          backgroundColor: `${opt.accent}22`,
                          color: opt.accent,
                        }}
                      >
                        <Icon size={14} />
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold">{opt.label}</div>
                        <div className="text-[10px] text-slate-500 dark:text-[#949BB0] leading-snug">
                          {opt.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {activeRole !== 'neutralSilent' && (
              <div className="space-y-1.5">
                <FieldLabel text="Default Dialogue / Battle Cry" />
                <textarea
                  rows={3}
                  value={assetMeta.defaultDialogue ?? ''}
                  onChange={(e) => saveMetaPatch({ defaultDialogue: e.target.value })}
                  placeholder="Default speech shown when placed as an NPC or Enemy…"
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#1F2430] text-xs font-medium resize-none border border-slate-200/70 dark:border-white/[0.08]"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1">
                <FieldLabel text="Default Inventory Gift / Drop" />
                <select
                  value={assetMeta.defaultPickupItemId ?? ''}
                  onChange={(e) =>
                    saveMetaPatch({ defaultPickupItemId: e.target.value || undefined })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#1F2430] text-xs font-semibold"
                >
                  <option value="">None</option>
                  {catalogItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.category})
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <FieldLabel text="Default Treasure Loot" />
                <select
                  value={assetMeta.defaultLoot ?? ''}
                  onChange={(e) =>
                    saveMetaPatch({ defaultLoot: e.target.value || undefined })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#1F2430] text-xs font-semibold"
                >
                  <option value="">Default Loot</option>
                  {PresetLibrary.loot.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {(() => {
              const metaAttrs = assetMeta.interactionAttributes ?? [];
              const metaCals = assetMeta.interactionCalibrations ?? {};
              return (
                <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <FieldLabel text="Default Interaction Attributes" />
                    <button
                      type="button"
                      onClick={() => setShowInteractionTester(true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#7C5CFF] hover:bg-[#6A48F5] text-white text-[11px] font-bold whitespace-nowrap"
                    >
                      <Sparkles size={12} />
                      <span>Test & Calibrate Character</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {OBJECT_INTERACTION_ATTRIBUTES.map((attr) => {
                      const checked = metaAttrs.includes(attr.id);
                      return (
                        <label
                          key={attr.id}
                          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer ${
                            checked
                              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                              : 'bg-white dark:bg-[#171A23] border-slate-200/70 dark:border-white/[0.06] text-slate-600 dark:text-[#A5AEC4]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const next = checked
                                ? metaAttrs.filter((id) => id !== attr.id)
                                : [...metaAttrs, attr.id];
                              saveMetaPatch({ interactionAttributes: next });
                            }}
                            className="accent-[#10B981] w-3.5 h-3.5 shrink-0"
                          />
                          <span className="truncate">{attr.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  {showInteractionTester && (
                    <ObjectInteractionTestModal
                      title={assetMeta.name}
                      attributes={metaAttrs}
                      calibrations={metaCals}
                      objectDoc={assetMeta.objectRecipe}
                      customAssetId={assetMeta.id}
                      customHeroAssetId={
                        currentLevel?.entities.find((e) => e.kind === 'hero')?.customAssetId
                      }
                      onSaveCalibration={(attr, cal) => {
                        const nextAttrs = metaAttrs.includes(attr)
                          ? metaAttrs
                          : [...metaAttrs, attr];
                        const nextCals: Partial<
                          Record<ObjectInteractionAttributeId, ObjectInteractionCalibration>
                        > = { ...metaCals, [attr]: cal };
                        saveMetaPatch({
                          interactionAttributes: nextAttrs,
                          interactionCalibrations: nextCals,
                        });
                      }}
                      onClose={() => setShowInteractionTester(false)}
                    />
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    );
  }

  return null;
};
