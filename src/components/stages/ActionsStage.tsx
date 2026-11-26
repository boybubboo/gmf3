import React, { useState } from 'react';
import { ArrowDownCircle, CheckCircle, RotateCcw } from 'lucide-react';
import { ActionGroups, ActionPresets, ActionRegistry } from '../../data/registries';
import type { MakerStore } from '../../store/useMakerStore';
import type { ActionGroup } from '../../types/maker';
import { MakerIcon } from '../shared/IconMap';
import { IconBadge, MakerCard, Pill } from '../shared/MakerUI';

export const ActionsStage: React.FC<{ store: MakerStore }> = ({ store }) => {
  const { currentProject } = store;
  const [filter, setFilter] = useState<ActionGroup | null>(null);

  if (!currentProject) return null;

  const enabled = new Set(currentProject.enabledActions);
  const groups = filter ? ActionGroups.filter((g) => g.id === filter) : ActionGroups;

  return (
    <div className="h-full min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden maker-scroll">
      {/* Left Sidebar */}
      <aside className="w-full lg:w-68 shrink-0 lg:h-full lg:min-h-0 bg-white dark:bg-[#171A23] border-b lg:border-b-0 lg:border-r border-slate-200/80 dark:border-white/[0.08] lg:overflow-y-auto maker-scroll p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold">Move groups</h2>
          <span className="text-xs font-bold text-slate-500 dark:text-[#949BB0] tabular-nums">
            {enabled.size} on
          </span>
        </div>

        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => setFilter(null)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold ${
              filter === null
                ? 'bg-[#7C5CFF]/15 text-[#7C5CFF]'
                : 'text-slate-600 dark:text-[#949BB0] hover:bg-slate-100 dark:hover:bg-[#1F2430]'
            }`}
          >
            <span>All moves</span>
            <span>{ActionRegistry.length}</span>
          </button>

          {ActionGroups.map((g) => {
            const count = ActionRegistry.filter((a) => a.group === g.id && enabled.has(a.id)).length;
            const total = ActionRegistry.filter((a) => a.group === g.id).length;
            const active = filter === g.id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setFilter(g.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                  active
                    ? 'bg-slate-100 dark:bg-[#1F2430] text-slate-900 dark:text-white'
                    : 'text-slate-600 dark:text-[#949BB0] hover:bg-slate-100/70 dark:hover:bg-[#1F2430]/70'
                }`}
              >
                <MakerIcon symbol={g.symbol} size={14} color={g.tint} />
                <span className="flex-1 text-left">{g.title}</span>
                <span className="tabular-nums text-[11px] text-slate-400 dark:text-[#6B7285]">
                  {count}/{total}
                </span>
              </button>
            );
          })}
        </div>

        <div className="pt-3 border-t border-slate-200/70 dark:border-white/[0.08] space-y-2">
          <button
            type="button"
            onClick={() => store.enableAllActions()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#1F2430] text-xs font-bold hover:bg-slate-200 dark:hover:bg-[#272D3C]"
          >
            <CheckCircle size={14} className="text-[#20B46A]" />
            <span>Turn everything on</span>
          </button>
          <button
            type="button"
            onClick={() => store.resetActions()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#1F2430] text-xs font-semibold text-slate-600 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white"
          >
            <RotateCcw size={14} />
            <span>Back to starter set</span>
          </button>
        </div>
      </aside>

      {/* Center Content */}
      <main className="shrink-0 lg:shrink lg:flex-1 lg:h-full lg:min-h-0 lg:min-w-0 lg:overflow-y-auto maker-scroll p-4 sm:p-6 space-y-6">
        <MakerCard className="flex flex-wrap items-center gap-4">
          <IconBadge symbol="figure.run" tint="#F59E0B" size={50} />
          <div className="flex-1 min-w-[200px]">
            <h2 className="text-lg font-extrabold">What can the hero do?</h2>
            <p className="text-xs text-slate-500 dark:text-[#949BB0]">
              Turn a move on and it gets an on-screen button, animation and sound in Play.
            </p>
          </div>
          <Pill text={currentProject.heroBody} symbol="person.fill" tint="#7C5CFF" />
        </MakerCard>

        {groups.map((group) => {
          const actions = ActionRegistry.filter((a) => a.group === group.id);
          const onCount = actions.filter((a) => enabled.has(a.id)).length;
          return (
            <section key={group.id} className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MakerIcon symbol={group.symbol} size={15} color={group.tint} />
                  <h3 className="text-base font-extrabold">{group.title}</h3>
                </div>
                <span className="text-xs font-bold text-slate-400 dark:text-[#6B7285] tabular-nums">
                  {onCount}/{actions.length}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-[#949BB0]">{group.blurb}</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                {actions.map((action) => {
                  const isOn = enabled.has(action.id);
                  return (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => store.toggleAction(action.id)}
                      className={`flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-[#171A23] border text-left transition-all ${
                        isOn ? 'shadow-xs' : 'opacity-75'
                      }`}
                      style={{
                        borderColor: isOn ? `${group.tint}88` : undefined,
                      }}
                    >
                      <IconBadge symbol={action.symbol} tint={group.tint} size={38} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold">{action.title}</div>
                        <div className="text-[11px] text-slate-500 dark:text-[#949BB0] line-clamp-1">
                          {action.blurb}
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 dark:text-[#6B7285] mt-0.5">
                          Control: {action.button}
                        </div>
                      </div>
                      <div
                        className={`w-10 h-6 rounded-full p-0.5 transition-colors shrink-0 ${
                          isOn ? '' : 'bg-slate-300 dark:bg-[#2A3040]'
                        }`}
                        style={{ backgroundColor: isOn ? group.tint : undefined }}
                      >
                        <div
                          className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                            isOn ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>

      {/* Right Inspector: Quick Sets */}
      <aside className="w-full lg:w-72 shrink-0 lg:h-full lg:min-h-0 bg-white dark:bg-[#171A23] border-t lg:border-t-0 lg:border-l border-slate-200/80 dark:border-white/[0.08] lg:overflow-y-auto maker-scroll p-4 space-y-4">
        <div>
          <h3 className="text-base font-extrabold">Quick sets</h3>
          <p className="text-xs text-slate-500 dark:text-[#949BB0] mt-0.5">
            Start from a hero that already feels right, then change what you like.
          </p>
        </div>

        <div className="space-y-2">
          {ActionPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() =>
                store.updateProject(`use ${preset.name} set`, (p) => ({
                  ...p,
                  enabledActions: [...preset.ids],
                }))
              }
              className="w-full flex items-center gap-3 p-2.5 rounded-2xl bg-slate-100 dark:bg-[#1F2430] hover:bg-slate-200 dark:hover:bg-[#272D3C] text-left transition-colors"
            >
              <IconBadge symbol={preset.symbol} tint="#F59E0B" size={34} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold">{preset.name}</div>
                <div className="text-[11px] text-slate-500 dark:text-[#949BB0]">
                  {preset.ids.length} moves
                </div>
              </div>
              <ArrowDownCircle size={16} className="text-[#F59E0B]" />
            </button>
          ))}
        </div>

        <div className="pt-3 border-t border-slate-200/70 dark:border-white/[0.08] space-y-1">
          <div className="text-xs font-bold">Good to know</div>
          <p className="text-[11px] text-slate-500 dark:text-[#949BB0] leading-relaxed">
            Walk and Jump are the two moves a game really needs. Without them a player cannot get anywhere.
          </p>
        </div>
      </aside>
    </div>
  );
};
