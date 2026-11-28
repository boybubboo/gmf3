import React, { useMemo, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import {
  PLATFORMER_CATEGORY_META,
  PLATFORMER_MODULES,
  PLATFORMER_MODULE_DRAG_MIME,
  type PlatformerModuleSpec,
} from '../../data/platformerCatalog';
import type { PlatformerAddonCategory, PlatformerModuleId } from '../../types/maker';
import { PlatformerModuleAnim } from './PlatformerModuleAnim';

interface PlatformerKitPanelProps {
  activeModuleId: PlatformerModuleId | null;
  onSelectPlaceModule: (spec: PlatformerModuleSpec | null) => void;
  onQuickPlaceCenter: (spec: PlatformerModuleSpec) => void;
  onDragStartModule?: (spec: PlatformerModuleSpec) => void;
  onDragEndModule?: () => void;
  onClose?: () => void;
}

export const PlatformerKitPanel: React.FC<PlatformerKitPanelProps> = ({
  activeModuleId,
  onSelectPlaceModule,
  onQuickPlaceCenter,
  onDragStartModule,
  onDragEndModule,
  onClose,
}) => {
  const [activeCategory, setActiveCategory] = useState<PlatformerAddonCategory | 'all'>('platforms');
  const [query, setQuery] = useState('');

  const filteredModules = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PLATFORMER_MODULES.filter((m) => {
      if (!q && activeCategory !== 'all' && m.category !== activeCategory) return false;
      if (!q) return true;
      return (
        m.label.toLowerCase().includes(q) ||
        m.shortDesc.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q)
      );
    });
  }, [activeCategory, query]);

  return (
    <div className="rounded-2xl bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.08] p-2 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold transition-colors ${
              activeCategory === 'all'
                ? 'bg-[#7C5CFF] text-white'
                : 'bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All ({PLATFORMER_MODULES.length})
          </button>
          {PLATFORMER_CATEGORY_META.map((cat) => {
            const active = activeCategory === cat.id && !query.trim();
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-extrabold transition-colors ${
                  active
                    ? 'text-white'
                    : 'bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white'
                }`}
                style={active ? { backgroundColor: cat.accent } : undefined}
              >
                <span
                  className="w-2 h-2 rounded-sm shrink-0"
                  style={{ backgroundColor: active ? '#FFFFFF' : cat.accent }}
                />
                <span>{cat.shortLabel}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5">
          <div className="relative flex items-center">
            <Search size={11} className="absolute left-2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find mechanic..."
              className="w-36 pl-6 pr-2 py-0.5 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-[10px] font-semibold focus:outline-none focus:ring-1 focus:ring-[#7C5CFF]"
            />
          </div>
          {activeModuleId && (
            <button
              type="button"
              onClick={() => onSelectPlaceModule(null)}
              className="px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-white/10 text-[10px] font-bold text-slate-700 dark:text-slate-200"
            >
              Cancel Place
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1F2430] text-slate-500"
              title="Close Platformer Kit"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 maker-scroll">
        {filteredModules.map((spec) => {
          const armed = activeModuleId === spec.id;
          return (
            <div
              key={spec.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(PLATFORMER_MODULE_DRAG_MIME, spec.id);
                e.dataTransfer.setData('text/plain', spec.id);
                e.dataTransfer.effectAllowed = 'copy';
                onDragStartModule?.(spec);
              }}
              onDragEnd={() => onDragEndModule?.()}
              className={`relative shrink-0 w-[108px] group rounded-2xl border transition-all cursor-grab active:cursor-grabbing ${
                armed
                  ? 'bg-[#16A34A]/12 border-[#16A34A] ring-2 ring-[#16A34A]/30 text-slate-950 dark:text-white'
                  : 'bg-slate-50 dark:bg-[#1B1F2B] border-slate-200/80 dark:border-white/[0.08] hover:border-[#6D4AFF]/55 text-slate-800 dark:text-[#E2E8F0]'
              }`}
              title={`${spec.shortDesc} — Drag into 3D viewport or click to arm & place`}
            >
              <button
                type="button"
                onClick={() => onSelectPlaceModule(armed ? null : spec)}
                className="w-full p-1.5 flex flex-col items-center text-center"
              >
                <div className="w-full h-11 rounded-xl bg-white dark:bg-[#11141D] border border-slate-200/60 dark:border-white/[0.06] flex items-center justify-center overflow-hidden text-slate-600 dark:text-slate-300">
                  <PlatformerModuleAnim
                    moduleId={spec.id}
                    accent={spec.accent}
                    className="w-[76px] h-[40px]"
                  />
                </div>
                <span className="mt-1 text-[10px] font-extrabold leading-tight line-clamp-2 min-h-[24px] flex items-center justify-center">
                  {spec.label}
                </span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickPlaceCenter(spec);
                }}
                title={`Drop ${spec.label} at center`}
                aria-label={`Drop ${spec.label}`}
                className={`absolute top-2 right-2 w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                  armed
                    ? 'opacity-100 bg-[#16A34A] border-[#16A34A] text-white'
                    : 'opacity-0 group-hover:opacity-100 focus:opacity-100 bg-white/95 dark:bg-[#252B3B]/95 border-slate-200/80 dark:border-white/[0.1] text-[#16A34A] hover:bg-[#16A34A] hover:text-white'
                }`}
              >
                <Plus size={10} strokeWidth={2.6} />
              </button>
            </div>
          );
        })}
        {filteredModules.length === 0 && (
          <div className="px-2 py-1 text-[11px] text-slate-400 font-semibold">
            No matching platformer add-ons.
          </div>
        )}
      </div>
    </div>
  );
};
