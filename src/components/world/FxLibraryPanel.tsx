import React, { useMemo, useState } from 'react';
import {
  Bird,
  Bug,
  CloudFog,
  CloudRain,
  Droplets,
  Flame,
  GripVertical,
  Leaf,
  Plus,
  Search,
  Snowflake,
  Sparkles,
  Sun,
  Trash2,
  Wind,
  X,
  Zap,
} from 'lucide-react';
import {
  FX_LIBRARY_CATEGORY_LABELS,
  type FxLibraryCategory,
  type FxLibraryIconKey,
  type FxLibraryTemplate,
} from '../../data/fxEffectLibrary';

interface FxLibraryPanelProps {
  templates: FxLibraryTemplate[];
  activePlaceTemplateId: string | null;
  wideMode?: boolean;
  onSelectPlaceTemplate: (template: FxLibraryTemplate | null) => void;
  onQuickPlaceCenter: (template: FxLibraryTemplate) => void;
  onDragStartTemplate: (template: FxLibraryTemplate) => void;
  onDragEndTemplate: () => void;
  onDeleteCustomTemplate: (templateId: string) => void;
  onClose: () => void;
}

export const FX_DRAG_MIME = 'application/x-maker-fx-template';

const CATEGORY_TABS: FxLibraryCategory[] = [
  'all',
  'fireHeat',
  'weather',
  'magic',
  'nature',
  'critters',
  'custom',
];

function FxTemplateGlyph({ icon, size = 16 }: { icon: FxLibraryIconKey; size?: number }) {
  switch (icon) {
    case 'flame':
      return <Flame size={size} />;
    case 'cloudRain':
      return <CloudRain size={size} />;
    case 'sparkles':
      return <Sparkles size={size} />;
    case 'bug':
      return <Bug size={size} />;
    case 'bird':
      return <Bird size={size} />;
    case 'droplets':
      return <Droplets size={size} />;
    case 'leaf':
      return <Leaf size={size} />;
    case 'snowflake':
      return <Snowflake size={size} />;
    case 'cloudFog':
      return <CloudFog size={size} />;
    case 'zap':
      return <Zap size={size} />;
    case 'sun':
      return <Sun size={size} />;
    case 'wind':
      return <Wind size={size} />;
  }
}

export const FxLibraryPanel: React.FC<FxLibraryPanelProps> = ({
  templates,
  activePlaceTemplateId,
  wideMode = false,
  onSelectPlaceTemplate,
  onQuickPlaceCenter,
  onDragStartTemplate,
  onDragEndTemplate,
  onDeleteCustomTemplate,
  onClose,
}) => {
  const [category, setCategory] = useState<FxLibraryCategory>('all');
  const [query, setQuery] = useState('');

  const customCount = useMemo(
    () => templates.filter((t) => t.isCustom).length,
    [templates]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates.filter((tpl) => {
      if (category !== 'all' && tpl.category !== category) return false;
      if (!q) return true;
      return (
        tpl.name.toLowerCase().includes(q) ||
        tpl.summary.toLowerCase().includes(q) ||
        tpl.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [templates, category, query]);

  const categoryButtons = (
    <div className="flex items-center gap-1 overflow-x-auto pb-0.5 maker-scroll">
      {CATEGORY_TABS.map((cat) => {
        if (cat === 'custom' && customCount === 0) return null;
        const active = category === cat;
        return (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-bold transition-colors ${
              active
                ? 'bg-[#7C5CFF] text-white'
                : 'bg-slate-100 dark:bg-[#10131B] text-slate-600 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {FX_LIBRARY_CATEGORY_LABELS[cat]}
            {cat === 'custom' && customCount > 0 ? ` (${customCount})` : ''}
          </button>
        );
      })}
    </div>
  );

  return (
    <div
      className={`rounded-2xl bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.09] shadow-sm ${
        wideMode ? 'p-2 space-y-1.5' : 'p-2.5 space-y-2'
      }`}
    >
      {/* Header row (combines category tabs inline when wideMode is active) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-6 h-6 rounded-lg bg-[#7C5CFF]/15 text-[#7C5CFF] flex items-center justify-center">
            <Sparkles size={13} />
          </div>
          <div>
            <div className="text-xs font-extrabold text-slate-900 dark:text-white leading-tight">
              Particle FX Library
            </div>
            {!wideMode && (
              <div className="text-[10px] font-medium text-slate-500 dark:text-[#8E96AB]">
                Drag any effect directly onto the 3D scene — or click a card to stamp it
              </div>
            )}
          </div>
        </div>

        {wideMode && <div className="flex-1 min-w-0 px-1">{categoryButtons}</div>}

        <div className="flex items-center gap-1.5 shrink-0">
          <div className="relative">
            <Search
              size={12}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter FX..."
              className="w-32 sm:w-36 pl-7 pr-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#10131B] border border-slate-200/80 dark:border-white/[0.08] text-[11px] font-semibold outline-none focus:border-[#7C5CFF]"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06]"
            title="Close FX Library"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Category tabs on separate row only when narrow */}
      {!wideMode && categoryButtons}

      {/* Draggable FX Cards strip */}
      {filtered.length === 0 ? (
        <div className="py-3 text-center text-xs font-semibold text-slate-400 dark:text-[#7E879E]">
          No particle effects match "{query}".
        </div>
      ) : (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 maker-scroll">
          {filtered.map((tpl) => {
            const isSelectedForClickDrop = activePlaceTemplateId === tpl.id;
            const layerCount = tpl.layers.length;
            return (
              <div
                key={tpl.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(FX_DRAG_MIME, tpl.id);
                  e.dataTransfer.setData('text/plain', tpl.id);
                  e.dataTransfer.effectAllowed = 'copy';
                  onDragStartTemplate(tpl);
                }}
                onDragEnd={() => onDragEndTemplate()}
                onClick={() =>
                  onSelectPlaceTemplate(isSelectedForClickDrop ? null : tpl)
                }
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectPlaceTemplate(isSelectedForClickDrop ? null : tpl);
                  }
                }}
                className={`group relative shrink-0 rounded-xl border text-left transition-all cursor-grab active:cursor-grabbing select-none ${
                  wideMode ? 'w-44 p-2' : 'w-44 p-2.5'
                } ${
                  isSelectedForClickDrop
                    ? 'bg-[#7C5CFF]/12 border-[#7C5CFF] ring-1 ring-[#7C5CFF]/40'
                    : 'bg-slate-50/90 dark:bg-[#11141D] border-slate-200/80 dark:border-white/[0.08] hover:border-[#7C5CFF]/70 hover:bg-white dark:hover:bg-[#1A1F2D]'
                }`}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`rounded-lg shrink-0 flex items-center justify-center text-white shadow-sm ${
                        wideMode ? 'w-7 h-7' : 'w-8 h-8'
                      }`}
                      style={{
                        background: `linear-gradient(135deg, ${tpl.accentHex}, ${tpl.secondaryHex})`,
                      }}
                    >
                      <FxTemplateGlyph icon={tpl.icon} size={wideMode ? 14 : 15} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                        {tpl.name}
                      </div>
                      <div className="text-[10px] font-semibold text-slate-500 dark:text-[#8E96AB]">
                        {layerCount > 1 ? `${layerCount} FX layers` : '1 FX emitter'}
                      </div>
                    </div>
                  </div>
                  <GripVertical
                    size={13}
                    className="shrink-0 text-slate-300 dark:text-[#4B546B] group-hover:text-[#7C5CFF] mt-0.5"
                  />
                </div>

                <p
                  className={`text-[10px] leading-snug text-slate-500 dark:text-[#949BB0] ${
                    wideMode ? 'mt-1 line-clamp-1' : 'mt-1.5 line-clamp-2'
                  }`}
                >
                  {tpl.summary}
                </p>

                <div className={`flex items-center justify-between gap-1 ${wideMode ? 'mt-1' : 'mt-2'}`}>
                  <span
                    className="text-[10px] font-bold"
                    style={{ color: isSelectedForClickDrop ? '#7C5CFF' : tpl.accentHex }}
                  >
                    {isSelectedForClickDrop ? 'Click scene to place' : 'Drag to scene'}
                  </span>
                  <div className="flex items-center gap-1">
                    {tpl.isCustom && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteCustomTemplate(tpl.id);
                        }}
                        className="p-1 rounded-md text-slate-400 hover:text-[#F2545B] hover:bg-[#F2545B]/10"
                        title="Delete saved effect"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onQuickPlaceCenter(tpl);
                      }}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-slate-200/80 dark:bg-white/[0.08] hover:bg-[#7C5CFF] hover:text-white text-[10px] font-bold text-slate-700 dark:text-[#C8D0E4] transition-colors"
                      title={`Place ${tpl.name} near center of scene`}
                    >
                      <Plus size={10} />
                      <span>Add</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
