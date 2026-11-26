import React from 'react';
import { Clapperboard, Lightbulb, ListChecks, Plus, Sparkles, Trash2, Wand2, Workflow } from 'lucide-react';
import {
  requestOpenContextualAiModal,
  setContextualAiPanelOpen,
  useContextualAiPanelState,
} from '../../ai/studioBridge';
import {
  BehaviorVocabulary,
  EntityKindMeta,
  RecipeLibrary,
  ruleSentence,
} from '../../data/registries';
import { BADDIE_ACTION_LIBRARY, FLIGHT_PATTERN_OPTIONS } from '../../data/baddieActionLibrary';
import { MOTION_SLOT_METADATA } from '../../data/motionLibrary';
import type { MakerStore } from '../../store/useMakerStore';
import type { BehaviorCard, LevelEntity } from '../../types/maker';
import { uid } from '../../utils/terrain';
import { ContextualAiPanel } from '../shared/ContextualAiModal';
import { LogicFlowWorkspace } from '../shared/LogicFlowModal';
import { EmptyHint, FieldLabel, IconBadge, MakerCard } from '../shared/MakerUI';

export const LogicStage: React.FC<{ store: MakerStore }> = ({ store }) => {
  const { currentLevel, currentEntity } = store;
  const aiPanelState = useContextualAiPanelState();
  if (!currentLevel) return null;

  const logicMode = store.logicMode;
  const recipes = currentEntity
    ? RecipeLibrary.filter((r) => r.kinds.includes(currentEntity.kind))
    : [];
  const shownRecipes = recipes.length > 0 ? recipes : RecipeLibrary.slice(0, 4);
  const totalRules = currentLevel.entities.reduce((sum, ent) => sum + ent.cards.length, 0);

  return (
    <div className="h-full min-h-0 flex flex-col bg-[#F4F5F8] dark:bg-[#0F1117] overflow-hidden">
      {/* Unified Logic Stage Header: Basic Rules vs Advanced Flow Graph */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2.5 px-4 py-2 bg-white dark:bg-[#171A23] border-b border-slate-200/80 dark:border-white/[0.08]">
        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-2 pr-2.5 border-r border-slate-200/80 dark:border-white/[0.08]">
            <Workflow size={15} className="text-[#A855F7] shrink-0" />
            <span className="text-sm font-black tracking-tight whitespace-nowrap">
              Logic Studio
            </span>
          </div>

          <div
            role="tablist"
            aria-label="Logic workspace mode"
            className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-[#1F2430] border border-slate-200/80 dark:border-white/[0.08]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={logicMode === 'rules'}
              onClick={() => store.setLogicMode('rules')}
              className={`px-3 py-1 rounded-lg text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                logicMode === 'rules'
                  ? 'bg-[#A855F7] text-white shadow-sm'
                  : 'text-slate-600 dark:text-[#A5AEC4] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ListChecks size={13} />
              <span>Basic Rules</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={logicMode === 'flow'}
              onClick={() => store.setLogicMode('flow')}
              className={`px-3 py-1 rounded-lg text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                logicMode === 'flow'
                  ? 'bg-[#7C5CFF] text-white shadow-sm'
                  : 'text-slate-600 dark:text-[#A5AEC4] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Workflow size={13} />
              <span>Flow Graph</span>
            </button>
          </div>

          <span className="hidden sm:inline text-xs font-semibold text-slate-500 dark:text-[#949BB0] tabular-nums">
            {currentLevel.name} · {totalRules} rule{totalRules === 1 ? '' : 's'}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => requestOpenContextualAiModal('logic')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#7C5CFF]/15 text-[#7C5CFF] dark:text-[#C4B5FD] hover:bg-[#7C5CFF]/25 text-xs font-bold whitespace-nowrap"
          >
            <Wand2 size={13} />
            <Sparkles size={11} className="text-[#F59E0B]" />
            <span>AI Game Planner</span>
          </button>
          <button
            type="button"
            onClick={() => store.setShowingDirector(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F59E0B]/15 text-[#D97706] dark:text-[#FBBF24] hover:bg-[#F59E0B]/25 text-xs font-bold whitespace-nowrap"
          >
            <Clapperboard size={13} />
            <span>Story Director</span>
          </button>
          {currentEntity && (
            <button
              type="button"
              onClick={() => {
                store.addEmptyCard(currentEntity.id);
                if (logicMode !== 'rules') store.setLogicMode('rules');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#A855F7] text-white text-xs font-bold hover:opacity-90 whitespace-nowrap"
            >
              <Plus size={13} />
              <span>Write a rule</span>
            </button>
          )}
        </div>
      </div>

      {logicMode === 'flow' ? (
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          {aiPanelState.isOpen && (
            <aside className="w-full lg:w-80 shrink-0 lg:h-full lg:min-h-0 bg-white dark:bg-[#171A23] border-b lg:border-b-0 lg:border-r border-slate-200/80 dark:border-white/[0.08] overflow-hidden flex flex-col">
              <ContextualAiPanel
                store={store}
                initialContext={aiPanelState.preferredContext ?? 'logic'}
                embedded
                onClose={() => setContextualAiPanelOpen(false)}
              />
            </aside>
          )}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <LogicFlowWorkspace
              store={store}
              embedded
              onSwitchToRules={() => store.setLogicMode('rules')}
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden maker-scroll">
          {/* Left Sidebar: AI Creator OR Entities in level */}
          {aiPanelState.isOpen ? (
            <aside className="w-full lg:w-80 shrink-0 lg:h-full lg:min-h-0 bg-white dark:bg-[#171A23] border-b lg:border-b-0 lg:border-r border-slate-200/80 dark:border-white/[0.08] overflow-hidden flex flex-col">
              <ContextualAiPanel
                store={store}
                initialContext={aiPanelState.preferredContext ?? 'logic'}
                embedded
                onClose={() => setContextualAiPanelOpen(false)}
              />
            </aside>
          ) : (
            <aside className="w-full lg:w-72 shrink-0 lg:h-full lg:min-h-0 bg-white dark:bg-[#171A23] border-b lg:border-b-0 lg:border-r border-slate-200/80 dark:border-white/[0.08] lg:overflow-y-auto maker-scroll p-4 space-y-3">
              <h2 className="text-base font-extrabold">Rules in this level</h2>
              {currentLevel.entities.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-[#949BB0]">
                  Add something in the Cast or World tab and it will show up here.
                </p>
              ) : (
                <div className="space-y-1">
                  {currentLevel.entities.map((ent) => {
                    const meta = EntityKindMeta[ent.kind];
                    const selected = ent.id === store.selectedEntityID;
                    return (
                      <button
                        key={ent.id}
                        type="button"
                        onClick={() => store.setSelectedEntityID(ent.id)}
                        className={`w-full flex items-center gap-2.5 p-2 rounded-xl border text-left transition-colors ${
                          selected
                            ? 'bg-[#A855F7]/15 border-[#A855F7]/50'
                            : 'border-transparent hover:bg-slate-100 dark:hover:bg-[#1F2430]'
                        }`}
                      >
                        <IconBadge symbol={meta.symbol} tint={meta.tint} size={32} />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold truncate">{ent.name}</div>
                          <div className="text-[11px] text-slate-500 dark:text-[#949BB0]">
                            {ent.cards.length} rule{ent.cards.length === 1 ? '' : 's'}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="pt-3 border-t border-slate-200/70 dark:border-white/[0.08] flex items-center gap-2 text-[11px] text-slate-500 dark:text-[#949BB0]">
                <Lightbulb size={14} className="text-[#F59E0B] shrink-0" />
                <span>A rule is always: When, If, Then.</span>
              </div>
            </aside>
          )}

          {/* Main Content */}
          <main className="shrink-0 lg:shrink lg:flex-1 lg:h-full lg:min-h-0 lg:min-w-0 lg:overflow-y-auto maker-scroll p-4 sm:p-6 space-y-5">
            {currentEntity ? (
              <>
                <MakerCard className="flex flex-wrap items-center gap-4">
                  <IconBadge
                    symbol={EntityKindMeta[currentEntity.kind].symbol}
                    tint={EntityKindMeta[currentEntity.kind].tint}
                    size={48}
                  />
                  <div className="flex-1 min-w-[160px]">
                    <h2 className="text-lg font-extrabold">{currentEntity.name}</h2>
                    <p className="text-xs text-slate-500 dark:text-[#949BB0]">
                      {EntityKindMeta[currentEntity.kind].title} · {currentEntity.cards.length} rule
                      {currentEntity.cards.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => store.setLogicMode('flow')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#7C5CFF]/15 text-[#7C5CFF] hover:bg-[#7C5CFF]/25 text-xs font-bold whitespace-nowrap"
                    >
                      <Workflow size={14} />
                      <span>Inspect in Flow</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => store.addEmptyCard(currentEntity.id)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#A855F7] text-white text-xs font-bold hover:opacity-90 whitespace-nowrap"
                    >
                      <Plus size={14} />
                      <span>Write a rule</span>
                    </button>
                  </div>
                </MakerCard>

                {/* Recipe shelf */}
                <section className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-sm font-extrabold">Ready-made rules</h3>
                    <span className="text-[11px] text-slate-500 dark:text-[#949BB0]">One click to add</span>
                  </div>
                  <div className="flex gap-2.5 overflow-x-auto pb-1 maker-scroll">
                    {shownRecipes.map((recipe) => (
                      <button
                        key={recipe.id}
                        type="button"
                        onClick={() => store.applyRecipe(recipe)}
                        className="shrink-0 w-44 p-3 rounded-2xl bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.08] hover:border-[#A855F7] text-left space-y-1.5 transition-all"
                      >
                        <IconBadge symbol={recipe.symbol} tint="#A855F7" size={32} />
                        <div className="text-xs font-bold truncate">{recipe.title}</div>
                        <div className="text-[11px] text-slate-500 dark:text-[#949BB0] line-clamp-2 leading-snug">
                          {recipe.blurb}
                        </div>
                      </button>
                    ))}
                  </div>
                </section>

                {/* Rule Cards */}
                {currentEntity.cards.length === 0 ? (
                  <MakerCard>
                    <EmptyHint
                      symbol="arrow.triangle.branch"
                      title={`${currentEntity.name} does nothing yet`}
                      message="Pick a ready-made rule above, or write a rule from scratch."
                      actionTitle="Write a rule"
                      onAction={() => store.addEmptyCard(currentEntity.id)}
                    />
                  </MakerCard>
                ) : (
                  <div className="space-y-4">
                    {currentEntity.cards.map((card, idx) => (
                      <RuleCardEditor
                        key={card.id}
                        entity={currentEntity}
                        card={card}
                        number={idx + 1}
                        store={store}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <MakerCard>
                <EmptyHint
                  symbol="arrow.triangle.branch"
                  title="Pick something to give a rule"
                  message="Choose anything in the list on the left: a baddie, a door, a chest, or a trap."
                />
              </MakerCard>
            )}
          </main>
        </div>
      )}
    </div>
  );
};

const RuleCardEditor: React.FC<{
  entity: LevelEntity;
  card: BehaviorCard;
  number: number;
  store: MakerStore;
}> = ({ entity, card, number, store }) => {
  const updateCard = (updater: (c: BehaviorCard) => BehaviorCard, recordUndo = true) => {
    store.updateEntity(
      entity.id,
      'edit rule',
      (ent) => ({
        ...ent,
        cards: ent.cards.map((c) => (c.id === card.id ? updater(c) : c)),
      }),
      recordUndo
    );
  };

  const deleteCard = () => {
    store.updateEntity(entity.id, 'delete rule', (ent) => ({
      ...ent,
      cards: ent.cards.filter((c) => c.id !== card.id),
    }));
  };

  const whenDef = BehaviorVocabulary.events.find((e) => e.key === card.when.key);

  return (
    <MakerCard className={`space-y-4 ${card.isEnabled ? '' : 'opacity-60'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="px-2.5 py-1 rounded-lg bg-[#A855F7]/15 text-[#A855F7] text-xs font-extrabold">
            Rule {number}
          </span>
          <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-[#949BB0] cursor-pointer">
            <input
              type="checkbox"
              checked={card.isOnce}
              onChange={(e) => updateCard((c) => ({ ...c, isOnce: e.target.checked }))}
              className="accent-[#A855F7]"
            />
            <span>Only once</span>
          </label>
          <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-[#949BB0] cursor-pointer ml-2">
            <input
              type="checkbox"
              checked={card.isEnabled}
              onChange={(e) => updateCard((c) => ({ ...c, isEnabled: e.target.checked }))}
              className="accent-[#20B46A]"
            />
            <span>Active</span>
          </label>
        </div>

        <button
          type="button"
          onClick={deleteCard}
          className="p-1.5 rounded-xl text-slate-400 hover:text-[#F2545B] hover:bg-[#F2545B]/10"
          title="Delete rule"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {/* Live plain-English sentence */}
      <div className="px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-[#1F2430] text-xs font-semibold">
        {ruleSentence(card)}
      </div>

      {/* WHEN */}
      <div className="space-y-1.5">
        <FieldLabel text="When" />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={card.when.key}
            onChange={(e) =>
              updateCard((c) => ({ ...c, when: { ...c.when, key: e.target.value } }))
            }
            className="px-3 py-2 rounded-xl bg-[#7C5CFF]/15 text-[#7C5CFF] text-xs font-bold focus:outline-none"
          >
            {BehaviorVocabulary.events.map((ev) => (
              <option key={ev.key} value={ev.key}>
                {ev.label}
              </option>
            ))}
          </select>
          {whenDef?.needsDetail && (
            <input
              type="text"
              value={card.when.detail}
              placeholder={whenDef.detailHint}
              onChange={(e) =>
                updateCard((c) => ({ ...c, when: { ...c.when, detail: e.target.value } }), false)
              }
              className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#1F2430] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#7C5CFF]"
            />
          )}
        </div>
      </div>

      {/* IF */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <FieldLabel text="If (optional)" />
          <button
            type="button"
            onClick={() =>
              updateCard((c) => ({
                ...c,
                conditions: [...c.conditions, { id: uid(), key: 'hasKey', detail: '' }],
              }))
            }
            className="text-[11px] font-bold text-[#F59E0B] hover:underline"
          >
            + Add condition
          </button>
        </div>
        {card.conditions.length > 0 && (
          <div className="space-y-2">
            {card.conditions.map((cond) => {
              const def = BehaviorVocabulary.conditions.find((d) => d.key === cond.key);
              return (
                <div key={cond.id} className="flex flex-wrap items-center gap-2">
                  <select
                    value={cond.key}
                    onChange={(e) =>
                      updateCard((c) => ({
                        ...c,
                        conditions: c.conditions.map((x) =>
                          x.id === cond.id ? { ...x, key: e.target.value } : x
                        ),
                      }))
                    }
                    className="px-3 py-1.5 rounded-xl bg-[#F59E0B]/15 text-[#F59E0B] text-xs font-bold focus:outline-none"
                  >
                    {BehaviorVocabulary.conditions.map((cd) => (
                      <option key={cd.key} value={cd.key}>
                        {cd.label}
                      </option>
                    ))}
                  </select>
                  {def?.needsDetail && (
                    <input
                      type="text"
                      value={cond.detail}
                      placeholder={def.detailHint}
                      onChange={(e) =>
                        updateCard(
                          (c) => ({
                            ...c,
                            conditions: c.conditions.map((x) =>
                              x.id === cond.id ? { ...x, detail: e.target.value } : x
                            ),
                          }),
                          false
                        )
                      }
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1F2430] text-xs font-semibold"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      updateCard((c) => ({
                        ...c,
                        conditions: c.conditions.filter((x) => x.id !== cond.id),
                      }))
                    }
                    className="text-xs text-slate-400 hover:text-[#F2545B]"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* THEN */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <FieldLabel text="Then" />
          <button
            type="button"
            onClick={() =>
              updateCard((c) => ({
                ...c,
                actions: [...c.actions, { id: uid(), key: 'say', detail: 'Hello!' }],
              }))
            }
            className="text-[11px] font-bold text-[#20B46A] hover:underline"
          >
            + Add action
          </button>
        </div>
        <div className="space-y-2">
          {card.actions.map((act) => {
            const def = BehaviorVocabulary.actions.find((d) => d.key === act.key);
            return (
              <div key={act.id} className="flex flex-wrap items-center gap-2">
                <select
                  value={act.key}
                  onChange={(e) =>
                    updateCard((c) => ({
                      ...c,
                      actions: c.actions.map((x) =>
                        x.id === act.id ? { ...x, key: e.target.value } : x
                      ),
                    }))
                  }
                  className="px-3 py-1.5 rounded-xl bg-[#20B46A]/15 text-[#20B46A] text-xs font-bold focus:outline-none"
                >
                  {BehaviorVocabulary.actions.map((ad) => (
                    <option key={ad.key} value={ad.key}>
                      {ad.label}
                    </option>
                  ))}
                </select>
                  {def?.needsDetail && (
                  <input
                    type="text"
                    value={act.detail}
                    placeholder={def.detailHint}
                    list={
                      act.key === 'attack' || act.key === 'landAndAttack'
                        ? 'baddie-action-library-list'
                        : act.key === 'flyPattern'
                          ? 'baddie-flight-pattern-list'
                          : act.key === 'playAnimation'
                            ? 'logic-motion-presets-list'
                            : undefined
                    }
                    onChange={(e) =>
                      updateCard(
                        (c) => ({
                          ...c,
                          actions: c.actions.map((x) =>
                            x.id === act.id ? { ...x, detail: e.target.value } : x
                          ),
                        }),
                        false
                      )
                    }
                    className="flex-1 min-w-[140px] px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1F2430] text-xs font-semibold"
                  />
                )}
                <button
                  type="button"
                  onClick={() =>
                    updateCard((c) => ({
                      ...c,
                      actions: c.actions.filter((x) => x.id !== act.id),
                    }))
                  }
                  className="text-xs text-slate-400 hover:text-[#F2545B]"
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <datalist id="baddie-action-library-list">
        {BADDIE_ACTION_LIBRARY.map((a) => (
          <option key={a.id} value={a.id}>
            {a.label} ({a.heroEffect})
          </option>
        ))}
      </datalist>
      <datalist id="baddie-flight-pattern-list">
        {FLIGHT_PATTERN_OPTIONS.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label}
          </option>
        ))}
      </datalist>
      <datalist id="logic-motion-presets-list">
        {(store.currentProject?.customMotionLibrary ?? []).map((p) => (
          <option key={p.id} value={p.name}>
            {p.name} ({p.slot})
          </option>
        ))}
        {MOTION_SLOT_METADATA.map((m) => (
          <option key={m.slot} value={m.slot}>
            {m.label}
          </option>
        ))}
      </datalist>
    </MakerCard>
  );
};
