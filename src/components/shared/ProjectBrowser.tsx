import React, { useMemo, useRef, useState } from 'react';
import {
  Archive,
  Box,
  Boxes,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  FolderOpen,
  HardDrive,
  Plus,
  PlusCircle,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { TemplateLibrary } from '../../data/registries';
import type { MakerStore } from '../../store/useMakerStore';
import type { GameProject, TemplateCategory } from '../../types/maker';
import { formatBytes } from '../../utils/assetVault';
import { projectToMakerFilename, type CompressedMakerResult } from '../../utils/makerArchive';
import { AssetVaultModal } from './AssetVaultModal';
import { EmptyHint, formatRelativeTime, IconBadge, ThemeToggle } from './MakerUI';
import { NewGameModal } from './NewGameModal';
import { SavePresetsModal } from './SavePresetsModal';

export const ProjectBrowser: React.FC<{ store: MakerStore }> = ({ store }) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [exportModalProjectId, setExportModalProjectId] = useState<string | null>(null);
  const [exportIncludeAssets, setExportIncludeAssets] = useState(true);
  const [exportAuthor, setExportAuthor] = useState('');
  const [exporting, setExporting] = useState(false);
  const [lastExportResult, setLastExportResult] = useState<CompressedMakerResult | null>(null);
  const [templateFilter, setTemplateFilter] = useState<TemplateCategory>('all');

  const filteredTemplates = useMemo(() => {
    if (templateFilter === 'all') return TemplateLibrary;
    return TemplateLibrary.filter((tpl) => tpl.category === templateFilter);
  }, [templateFilter]);

  const exportTargetProject: GameProject | null = useMemo(() => {
    if (!exportModalProjectId) return null;
    return (
      store.projects.find((p) => p.id === exportModalProjectId) ?? store.projects[0] ?? null
    );
  }, [exportModalProjectId, store.projects]);

  const openExportModal = (projectId: string) => {
    setExportModalProjectId(projectId);
    setLastExportResult(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const res = await store.importProjectFile(file);
    if (!res.ok) {
      setImportError(res.error ?? 'Could not open that file.');
    } else {
      setImportError(null);
    }
  };

  const handleRunCompressedExport = async () => {
    if (!exportTargetProject) return;
    setExporting(true);
    try {
      const result = await store.exportCompressedMakerFile(exportTargetProject, {
        includeAssets: exportIncludeAssets,
        sharedBy: exportAuthor.trim() || undefined,
      });
      setLastExportResult(result);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[#F4F5F8] dark:bg-[#0F1117] text-slate-900 dark:text-[#F3F5FA] transition-colors">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8 space-y-8">
        {/* Header */}
        <header className="flex flex-wrap items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#7C5CFF] text-white flex items-center justify-center shadow-lg shadow-[#7C5CFF]/25 shrink-0">
            <Boxes size={26} strokeWidth={2.2} />
          </div>
          <div className="flex-1 min-w-[200px]">
            <h1 className="text-3xl font-black tracking-tight">Maker</h1>
            <p className="text-sm text-slate-500 dark:text-[#949BB0]">
              Craft rich 3D adventures with custom rigged models, dynamic lighting, and open worlds.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <ThemeToggle theme={store.theme} onChange={store.setTheme} />

            <button
              type="button"
              onClick={() => store.setShowingPresets(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.1] text-xs font-bold hover:border-[#20B46A]/60 transition-colors whitespace-nowrap"
            >
              <Save size={14} className="text-[#20B46A]" />
              <span>Presets ({store.savedPresets.length})</span>
            </button>

            <button
              type="button"
              onClick={() => store.setShowingAssetVault(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.1] text-xs font-bold hover:border-[#7C5CFF]/60 transition-colors whitespace-nowrap"
            >
              <Box size={14} className="text-[#7C5CFF]" />
              <span>3D Assets ({store.customAssets.length})</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".maker,.zip,.json,.txt"
              className="hidden"
              onChange={(e) => void handleFileChange(e)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Open an exported .zip adventure, compressed .maker backup, or .json game file"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.1] text-xs font-bold hover:border-[#7C5CFF]/60 transition-colors whitespace-nowrap"
            >
              <FolderOpen size={14} className="text-[#38BDF8]" />
              <span>Open</span>
            </button>

            {store.projects.length > 0 && (
              <button
                type="button"
                onClick={() => openExportModal(store.projects[0].id)}
                title="Export a project as a compressed .maker file for sharing or backup"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.1] text-xs font-bold hover:border-[#7C5CFF]/60 transition-colors whitespace-nowrap"
              >
                <Archive size={14} className="text-[#7C5CFF]" />
                <span>Export .maker</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => store.setShowingNewGame(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#7C5CFF] text-white text-xs font-bold hover:bg-[#6A48F5] transition-colors shadow-sm shadow-[#7C5CFF]/25 whitespace-nowrap"
            >
              <Plus size={15} strokeWidth={2.6} />
              <span>New game</span>
            </button>
          </div>
        </header>

        {importError && (
          <div className="p-3.5 rounded-2xl bg-[#F2545B]/12 border border-[#F2545B]/30 text-xs font-semibold text-[#F2545B] flex items-center justify-between">
            <span>{importError}</span>
            <button
              type="button"
              onClick={() => setImportError(null)}
              className="underline font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Your games */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-extrabold">Your games</h2>
            <span className="text-xs text-slate-500 dark:text-[#949BB0] tabular-nums">
              {store.projects.length} saved in this browser
            </span>
          </div>

          {store.projects.length === 0 ? (
            <div className="bg-white dark:bg-[#171A23] rounded-2xl border border-slate-200/80 dark:border-white/[0.08]">
              <EmptyHint
                symbol="cube.fill"
                title="No games yet"
                message="Pick a template and make it yours. Everything saves as you go."
                actionTitle="Start a game"
                onAction={() => store.setShowingNewGame(true)}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {store.projects.map((project) => {
                const firstBiome = project.levels[0]?.biome ?? 'meadow';
                return (
                  <div
                    key={project.id}
                    onClick={() => store.openProject(project.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') store.openProject(project.id);
                    }}
                    className="group relative bg-white dark:bg-[#171A23] rounded-2xl border border-slate-200/80 dark:border-white/[0.08] p-5 h-48 flex flex-col justify-between text-left hover:border-[#7C5CFF]/65 hover:shadow-lg dark:hover:shadow-[0_10px_28px_rgba(0,0,0,0.45)] transition-all cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <IconBadge symbol={project.symbol} tint={project.colorHex} size={50} />
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          title="Export compressed .maker backup"
                          onClick={(e) => {
                            e.stopPropagation();
                            openExportModal(project.id);
                          }}
                          className="p-2 rounded-xl text-slate-400 dark:text-[#6B7285] hover:text-[#7C5CFF] hover:bg-[#7C5CFF]/10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                        >
                          <Archive size={14} />
                        </button>
                        <button
                          type="button"
                          title="Make a copy"
                          onClick={(e) => {
                            e.stopPropagation();
                            store.duplicateProject(project.id);
                          }}
                          className="p-2 rounded-xl text-slate-400 dark:text-[#6B7285] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1F2430] opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          type="button"
                          title="Delete game"
                          onClick={(e) => {
                            e.stopPropagation();
                            store.deleteProject(project.id);
                          }}
                          className="p-2 rounded-xl text-slate-400 dark:text-[#6B7285] hover:text-[#F2545B] hover:bg-[#F2545B]/10 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={14} />
                        </button>
                        <ChevronRight
                          size={16}
                          className="text-slate-400 dark:text-[#6B7285] group-hover:text-[#7C5CFF] ml-1"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <h3 className="text-lg font-extrabold line-clamp-1">{project.name}</h3>
                        <p className="text-xs text-slate-500 dark:text-[#949BB0] line-clamp-1">
                          {project.tagline}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-[#8E96AB] capitalize tabular-nums">
                        <span style={{ color: project.colorHex }}>
                          {project.levels.length} level{project.levels.length === 1 ? '' : 's'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{firstBiome}</span>
                        <span aria-hidden="true">·</span>
                        <span className="normal-case">
                          {project.sharedBy
                            ? `From ${project.sharedBy}`
                            : formatRelativeTime(project.updatedAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Project Templates */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">Project Templates</h2>
              <p className="text-xs text-slate-500 dark:text-[#949BB0]">
                Start from a playable 3D prototype — open worlds, creature adventures, side-scrollers &amp; forest driving
              </p>
            </div>
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.08]">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'worlds', label: 'Worlds' },
                  { id: 'stories', label: 'Stories' },
                  { id: 'vehicles', label: 'Vehicles' },
                ] as const
              ).map((tab) => {
                const active = templateFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTemplateFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-[#7C5CFF] text-white shadow-sm'
                        : 'text-slate-600 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => store.createProject(tpl.name, tpl)}
                className="group relative bg-white dark:bg-[#171A23] rounded-2xl border border-slate-200/80 dark:border-white/[0.08] p-5 flex flex-col justify-between gap-4 text-left hover:border-[#7C5CFF]/70 hover:shadow-lg dark:hover:shadow-[0_12px_30px_rgba(0,0,0,0.45)] transition-all"
              >
                <div className="space-y-3 w-full">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <IconBadge symbol={tpl.symbol} tint={tpl.colorHex} size={46} />
                      <div className="min-w-0">
                        <div className="text-base font-extrabold tracking-tight truncate group-hover:text-[#7C5CFF] transition-colors">
                          {tpl.name}
                        </div>
                        <div className="text-[11px] font-semibold text-slate-500 dark:text-[#8E96AB] truncate">
                          {tpl.prototypeType ?? 'Game Prototype'}
                          {tpl.biomeLabel ? ` · ${tpl.biomeLabel}` : ''}
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-[#A3ACBF] leading-relaxed line-clamp-2">
                    {tpl.blurb}
                  </p>

                  {tpl.highlights && tpl.highlights.length > 0 && (
                    <ul className="space-y-1 pt-0.5">
                      {tpl.highlights.slice(0, 3).map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-1.5 text-[11px] text-slate-500 dark:text-[#949BB0]"
                        >
                          <Check
                            size={12}
                            strokeWidth={2.6}
                            className="shrink-0 mt-0.5"
                            style={{ color: tpl.colorHex }}
                          />
                          <span className="line-clamp-1">{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="w-full pt-3 border-t border-slate-200/70 dark:border-white/[0.06] flex items-center justify-between text-xs font-extrabold">
                  <span className="inline-flex items-center gap-1.5" style={{ color: tpl.colorHex }}>
                    <PlusCircle size={14} />
                    <span>Launch prototype</span>
                  </span>
                  <ChevronRight
                    size={15}
                    className="text-slate-400 dark:text-[#6B7285] group-hover:text-[#7C5CFF] group-hover:translate-x-0.5 transition-all"
                  />
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="flex items-center gap-2 text-xs text-slate-400 dark:text-[#6B7285] pt-2">
          <HardDrive size={13} />
          <span>
            Games and custom 3D `.glb` models save locally in your browser. Export a compressed `.maker` file anytime to share or back up.
          </span>
        </footer>
      </div>

      {/* Compressed .maker Export Modal */}
      {exportTargetProject && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.1] shadow-2xl overflow-hidden">
            <header className="px-5 py-4 border-b border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#7C5CFF]/15 text-[#7C5CFF] flex items-center justify-center shrink-0">
                  <Archive size={17} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-extrabold truncate">Export Compressed .maker</h2>
                  <p className="text-[11px] text-slate-500 dark:text-[#949BB0] truncate">
                    Compact gzip archive for sharing or local backup
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExportModalProjectId(null)}
                aria-label="Close export modal"
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-500"
              >
                <X size={16} />
              </button>
            </header>

            <div className="p-5 space-y-4">
              {/* Project selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-[#A3ACBF]">
                  Project to export
                </label>
                <select
                  value={exportTargetProject.id}
                  onChange={(e) => {
                    setExportModalProjectId(e.target.value);
                    setLastExportResult(null);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#1F2430] border border-slate-200/80 dark:border-white/[0.08] text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#7C5CFF]"
                >
                  {store.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.levels.length} level{p.levels.length === 1 ? '' : 's'})
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-[#949BB0] tabular-nums pt-0.5">
                  <span>
                    {exportTargetProject.levels.length} level
                    {exportTargetProject.levels.length === 1 ? '' : 's'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {exportTargetProject.levels.reduce((s, l) => s + l.entities.length, 0)} entities
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono truncate">
                    {projectToMakerFilename(exportTargetProject.name)}
                  </span>
                </div>
              </div>

              {/* Creator / Backup tag */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-[#A3ACBF]">
                  Creator or backup label (optional)
                </label>
                <input
                  type="text"
                  value={exportAuthor}
                  onChange={(e) => setExportAuthor(e.target.value)}
                  placeholder="e.g. Matt · v1 backup"
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#1F2430] border border-slate-200/80 dark:border-white/[0.08] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#7C5CFF]"
                />
              </div>

              {/* Embed assets toggle */}
              <label className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-[#1F2430] text-xs font-semibold cursor-pointer">
                <span>Include custom 3D `.glb` models &amp; textures</span>
                <input
                  type="checkbox"
                  checked={exportIncludeAssets}
                  onChange={(e) => setExportIncludeAssets(e.target.checked)}
                  className="accent-[#7C5CFF] w-4 h-4 shrink-0"
                />
              </label>

              {/* Compression result feedback */}
              {lastExportResult && (
                <div className="p-3 rounded-xl bg-[#20B46A]/12 border border-[#20B46A]/25 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-extrabold text-[#20B46A]">
                    <CheckCircle2 size={14} />
                    <span>Exported {lastExportResult.filename}</span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-[#A3ACBF] font-mono tabular-nums">
                    {formatBytes(lastExportResult.rawBytes)} →{' '}
                    {formatBytes(lastExportResult.compressedBytes)}
                    {lastExportResult.compressed && lastExportResult.rawBytes > 0
                      ? ` (${Math.max(
                          0,
                          Math.round(
                            (1 - lastExportResult.compressedBytes / lastExportResult.rawBytes) * 100
                          )
                        )}% smaller)`
                      : ''}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setExportModalProjectId(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-[#1F2430] hover:bg-slate-200 dark:hover:bg-[#272D3C] text-xs font-bold"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={exporting}
                  onClick={() => void handleRunCompressedExport()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#7C5CFF] hover:bg-[#6A48F5] text-white text-xs font-extrabold disabled:opacity-50"
                >
                  <Download size={14} />
                  <span>{exporting ? 'Compressing…' : 'Download .maker'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {store.showingNewGame && (
        <NewGameModal
          onClose={() => store.setShowingNewGame(false)}
          onCreate={(name, tpl) => store.createProject(name, tpl)}
        />
      )}

      {store.showingAssetVault && (
        <AssetVaultModal
          store={store}
          onClose={() => store.setShowingAssetVault(false)}
        />
      )}

      {store.showingPresets && (
        <SavePresetsModal
          store={store}
          onClose={() => store.setShowingPresets(false)}
        />
      )}
    </div>
  );
};
