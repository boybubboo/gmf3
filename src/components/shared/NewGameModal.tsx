import React, { useState } from 'react';
import { X } from 'lucide-react';
import { TemplateLibrary } from '../../data/registries';
import type { GameTemplate } from '../../types/maker';
import { FieldLabel, IconBadge } from './MakerUI';

export const NewGameModal: React.FC<{
  onClose: () => void;
  onCreate: (name: string, template: GameTemplate) => void;
}> = ({ onClose, onCreate }) => {
  const [name, setName] = useState('My Adventure');
  const [selected, setSelected] = useState<GameTemplate>(TemplateLibrary[0]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-slate-50 dark:bg-[#12151E] text-slate-900 dark:text-[#F3F5FA] rounded-3xl shadow-2xl border border-slate-200/80 dark:border-white/[0.1] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-[#171A23] border-b border-slate-200/80 dark:border-white/[0.08]">
          <h2 className="text-lg font-extrabold">New game</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-[#1F2430] flex items-center justify-center text-slate-500 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto maker-scroll">
          <div className="space-y-2">
            <FieldLabel text="Game name" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Adventure"
              className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-[#1F2430] border border-slate-200 dark:border-white/[0.08] text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#7C5CFF]"
            />
          </div>

          <div className="space-y-2">
            <FieldLabel text="Project template" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {TemplateLibrary.map((tpl) => {
                const active = tpl.id === selected.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => {
                      setSelected(tpl);
                      if (
                        name === 'My Adventure' ||
                        TemplateLibrary.some((t) => t.name === name)
                      ) {
                        setName(tpl.name);
                      }
                    }}
                    className={`flex items-start gap-3 p-3 rounded-2xl text-left border transition-all ${
                      active
                        ? 'bg-white dark:bg-[#171A23] border-[#7C5CFF] ring-2 ring-[#7C5CFF]/25'
                        : 'bg-white dark:bg-[#171A23] border-slate-200/80 dark:border-white/[0.08] hover:border-[#7C5CFF]/50'
                    }`}
                  >
                    <IconBadge symbol={tpl.symbol} tint={tpl.colorHex} size={38} />
                    <div className="min-w-0">
                      <div className="text-sm font-bold truncate">{tpl.name}</div>
                      {tpl.prototypeType && (
                        <div className="text-[10px] font-semibold text-slate-400 dark:text-[#6B7285] truncate">
                          {tpl.prototypeType}
                        </div>
                      )}
                      <div className="text-xs text-slate-500 dark:text-[#949BB0] line-clamp-2 mt-0.5">
                        {tpl.blurb}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 bg-white dark:bg-[#171A23] border-t border-slate-200/80 dark:border-white/[0.08]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-[#1F2430] text-sm font-semibold text-slate-600 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onCreate(name, selected)}
            className="px-5 py-2 rounded-xl bg-[#7C5CFF] text-white text-sm font-bold hover:bg-[#6A48F5]"
          >
            Create game
          </button>
        </div>
      </div>
    </div>
  );
};
