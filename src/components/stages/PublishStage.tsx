import React, { useEffect, useState } from 'react';
import { CheckCircle2, Download, Sparkles, TriangleAlert, X } from 'lucide-react';
import type { MakerStore } from '../../store/useMakerStore';
import { MakerIcon } from '../shared/IconMap';
import { CountTile, FieldLabel, IconBadge, MakerCard } from '../shared/MakerUI';

export const PublishStage: React.FC<{ store: MakerStore; onClose?: () => void }> = ({
  store,
  onClose,
}) => {
  const { currentProject, issues } = store;
  const [nickname, setNickname] = useState('');
  const [includeAssets, setIncludeAssets] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportedNote, setExportedNote] = useState(false);

  if (!currentProject) return null;

  const totalEntities = currentProject.levels.reduce((sum, l) => sum + l.entities.length, 0);

  const handleDownload = async () => {
    setExporting(true);
    try {
      const bundleText = await store.exportProjectJSON(
        {
          ...currentProject,
          sharedBy: nickname.trim() || undefined,
        },
        includeAssets
      );
      const blob = new Blob([bundleText], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeName = currentProject.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'maker-game';
      a.href = url;
      a.download = `${safeName}.maker.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExportedNote(true);
      setTimeout(() => setExportedNote(false), 3000);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="h-full min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden maker-scroll">
      {/* Left Sidebar: Checklist */}
      <aside className="w-full lg:w-76 shrink-0 lg:h-full lg:min-h-0 bg-white dark:bg-[#171A23] border-b lg:border-b-0 lg:border-r border-slate-200/80 dark:border-white/[0.08] lg:overflow-y-auto maker-scroll p-4 space-y-4">
        <h2 className="text-base font-extrabold">Checklist</h2>

        {issues.length === 0 ? (
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#20B46A]/15">
            <CheckCircle2 size={22} className="text-[#20B46A] shrink-0" />
            <div>
              <div className="text-sm font-bold">All clear</div>
              <div className="text-[11px] text-slate-500 dark:text-[#949BB0]">
                Nothing is missing.
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {issues.map((issue) => (
              <button
                key={issue.id}
                type="button"
                onClick={() => {
                  if (issue.openPublish) return;
                  if (issue.motionSection) {
                    store.setMotionSection(issue.motionSection);
                  }
                  store.setSelectedTab(issue.tab);
                  onClose?.();
                }}
                className="w-full flex items-start gap-2.5 p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] hover:bg-slate-200 dark:hover:bg-[#272D3C] text-left transition-colors"
              >
                <TriangleAlert
                  size={15}
                  className={
                    issue.isBlocking
                      ? 'text-[#F2545B] shrink-0 mt-0.5'
                      : 'text-[#F59E0B] shrink-0 mt-0.5'
                  }
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold">{issue.title}</div>
                  <div className="text-[11px] text-slate-500 dark:text-[#949BB0] leading-snug">
                    {issue.detail}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="pt-3 border-t border-slate-200/70 dark:border-white/[0.08] space-y-2">
          <div className="text-xs font-extrabold">Levels</div>
          {currentProject.levels.map((lvl, idx) => (
            <div key={lvl.id} className="flex items-center gap-2 text-xs py-1">
              <span className="w-5 h-5 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-[10px] font-bold flex items-center justify-center">
                {idx + 1}
              </span>
              <span className="flex-1 truncate font-medium">{lvl.name}</span>
              {lvl.hasPortal ? (
                <Sparkles size={13} className="text-[#7C5CFF]" />
              ) : (
                <TriangleAlert size={13} className="text-[#F2545B]" />
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* Center Content */}
      <main className="shrink-0 lg:shrink lg:flex-1 lg:h-full lg:min-h-0 lg:min-w-0 lg:overflow-y-auto maker-scroll p-4 sm:p-6 space-y-5">
        {/* Cover preview */}
        <MakerCard className="space-y-4">
          <div className="flex items-center gap-4">
            <IconBadge symbol={currentProject.symbol} tint={currentProject.colorHex} size={58} />
            <div className="min-w-0 flex-1">
              <FieldLabel text="Cover preview" />
              <input
                type="text"
                value={currentProject.name}
                onChange={(e) =>
                  store.updateProject('rename game', (p) => ({ ...p, name: e.target.value }), false)
                }
                className="text-2xl font-black bg-transparent w-full focus:outline-none border-b border-transparent focus:border-[#7C5CFF]"
              />
              <p className="text-xs text-slate-500 dark:text-[#949BB0] truncate">
                {currentProject.coverTagline || currentProject.tagline}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500 dark:text-[#949BB0]">
            <span style={{ color: currentProject.colorHex }}>
              {currentProject.levels.length} level{currentProject.levels.length === 1 ? '' : 's'}
            </span>
            <span>·</span>
            <span className="text-[#F59E0B]">{currentProject.difficulty}</span>
            <span>·</span>
            <span className={currentProject.published ? 'text-[#20B46A]' : ''}>
              {currentProject.published ? 'Ready to share' : 'Draft'}
            </span>
          </div>
        </MakerCard>

        {/* Details */}
        <MakerCard className="space-y-4">
          <div className="space-y-1.5">
            <FieldLabel text="Cover tagline" />
            <input
              type="text"
              value={currentProject.coverTagline}
              onChange={(e) =>
                store.updateProject(
                  'edit tagline',
                  (p) => ({ ...p, coverTagline: e.target.value }),
                  false
                )
              }
              placeholder="One-line hook for your title screen…"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-[#1F2430] text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#7C5CFF]"
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel text="Difficulty" />
            <div className="flex gap-2">
              {(['Easy', 'Normal', 'Tricky'] as const).map((diff) => {
                const active = currentProject.difficulty === diff;
                return (
                  <button
                    key={diff}
                    type="button"
                    onClick={() =>
                      store.updateProject('set difficulty', (p) => ({ ...p, difficulty: diff }))
                    }
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${
                      active
                        ? 'bg-[#7C5CFF] text-white'
                        : 'bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#949BB0]'
                    }`}
                  >
                    {diff}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex items-center justify-between pt-2 border-t border-slate-200/70 dark:border-white/[0.08] cursor-pointer">
            <div className="flex items-center gap-2 text-sm font-bold">
              <MakerIcon symbol="checkmark.seal.fill" size={16} color="#20B46A" />
              <span>Mark as ready to play</span>
            </div>
            <input
              type="checkbox"
              checked={currentProject.published}
              onChange={(e) =>
                store.updateProject('toggle published', (p) => ({
                  ...p,
                  published: e.target.checked,
                }))
              }
              className="accent-[#20B46A] w-4 h-4"
            />
          </label>
        </MakerCard>

        {/* Share / Export card */}
        <MakerCard className="space-y-3">
          <div className="flex items-center gap-2">
            <MakerIcon symbol="cube.fill" size={18} color="#7C5CFF" />
            <h3 className="text-base font-extrabold">Share the game</h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-[#949BB0] leading-relaxed">
            Packs every level, sculpted terrain, cast, rules, HUD, and optionally your custom `.glb` models into one `.maker.json` bundle.
          </p>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 dark:text-[#949BB0]">Your name</span>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Maker Creator"
              className="flex-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#1F2430] text-xs font-semibold"
            />
          </div>

          <label className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-[#949BB0] cursor-pointer py-1">
            <span>Include custom 3D (.glb) models in bundle</span>
            <input
              type="checkbox"
              checked={includeAssets}
              onChange={(e) => setIncludeAssets(e.target.checked)}
              className="accent-[#7C5CFF] w-4 h-4"
            />
          </label>

          <button
            type="button"
            disabled={exporting}
            onClick={() => void handleDownload()}
            className="w-full py-3 rounded-xl bg-[#7C5CFF] text-white text-sm font-bold hover:bg-[#6A48F5] inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Download size={16} />
            <span>
              {exporting
                ? 'Packing bundle…'
                : exportedNote
                ? 'Downloaded!'
                : 'Download .maker.json'}
            </span>
          </button>
        </MakerCard>
      </main>

      {/* Right Inspector: Numbers */}
      <aside className="w-full lg:w-72 shrink-0 lg:h-full lg:min-h-0 bg-white dark:bg-[#171A23] border-t lg:border-t-0 lg:border-l border-slate-200/80 dark:border-white/[0.08] lg:overflow-y-auto maker-scroll p-4 space-y-4">
        <h3 className="text-base font-extrabold">The numbers</h3>
        <div className="grid grid-cols-2 gap-2.5">
          <CountTile value={`${currentProject.levels.length}`} label="Levels" tint="#20B46A" />
          <CountTile value={`${totalEntities}`} label="Things" tint="#38BDF8" />
          <CountTile value={`${currentProject.enabledActions.length}`} label="Moves" tint="#F59E0B" />
          <CountTile value={`${currentProject.hud.widgets.length}`} label="HUD parts" tint="#7C5CFF" />
        </div>

        <div className="pt-3 border-t border-slate-200/70 dark:border-white/[0.08] space-y-1">
          <FieldLabel text="Saved locally" />
          <p className="text-xs text-slate-500 dark:text-[#949BB0] leading-relaxed">
            Everything stays in your browser until you download a `.maker.json` bundle to share.
          </p>
        </div>
      </aside>
    </div>
  );
};

export const PublishModal: React.FC<{ store: MakerStore; onClose: () => void }> = ({
  store,
  onClose,
}) => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  if (!store.currentProject) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Publish and Share Game"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-6xl h-[min(90vh,820px)] rounded-2xl bg-[#F4F5F8] dark:bg-[#0F1117] border border-slate-200/80 dark:border-white/[0.1] shadow-2xl flex flex-col overflow-hidden"
      >
        <header className="shrink-0 px-5 py-3 bg-white dark:bg-[#171A23] border-b border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#0EA5E9]/15 text-[#0EA5E9] flex items-center justify-center shrink-0">
              <MakerIcon symbol="paperplane.fill" size={16} color="#0EA5E9" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-black tracking-tight truncate">
                Publish &amp; Share
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-[#949BB0] truncate">
                {store.currentProject.name} · Readiness checklist &amp; shareable bundle
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Publish"
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            <X size={16} />
          </button>
        </header>
        <div className="flex-1 min-h-0 overflow-hidden">
          <PublishStage store={store} onClose={onClose} />
        </div>
      </div>
    </div>
  );
};
