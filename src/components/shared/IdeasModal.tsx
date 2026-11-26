import React from 'react';
import { Lightbulb, X } from 'lucide-react';
import type { MakerStore } from '../../store/useMakerStore';
import { EmptyHint, IconBadge } from './MakerUI';

export const IdeasModal: React.FC<{
  store: MakerStore;
  onClose: () => void;
}> = ({ store, onClose }) => {
  const { suggestions, currentProject } = store;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-slate-50 dark:bg-[#12151E] text-slate-900 dark:text-[#F3F5FA] rounded-3xl shadow-2xl border border-slate-200/80 dark:border-white/[0.1] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-[#171A23] border-b border-slate-200/80 dark:border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/15 text-[#F59E0B] flex items-center justify-center">
              <Lightbulb size={20} />
            </div>
            <div>
              <h2 className="text-base font-extrabold">One step at a time</h2>
              <p className="text-xs text-slate-500 dark:text-[#949BB0]">
                Maker looks at {currentProject?.name ?? 'your game'} and suggests what to try next.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-[#1F2430] flex items-center justify-center text-slate-500 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto maker-scroll">
          {suggestions.length === 0 ? (
            <div className="bg-white dark:bg-[#171A23] rounded-2xl p-4 border border-slate-200/80 dark:border-white/[0.08]">
              <EmptyHint
                symbol="checkmark.seal.fill"
                title="This game looks good"
                message="Everything Maker would suggest is already done. Add another level and there will be more to do."
              />
            </div>
          ) : (
            suggestions.map((s) => (
              <div
                key={s.id}
                className="flex items-start gap-3 p-4 rounded-2xl bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.08]"
              >
                <IconBadge symbol={s.symbol} tint={s.tint} size={40} />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="text-sm font-bold">{s.title}</div>
                  <p className="text-xs text-slate-500 dark:text-[#949BB0] leading-relaxed">
                    {s.detail}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      s.perform();
                      onClose();
                    }}
                    className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold transition-opacity hover:opacity-90"
                    style={{ backgroundColor: `${s.tint}24`, color: s.tint }}
                  >
                    {s.actionTitle}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
