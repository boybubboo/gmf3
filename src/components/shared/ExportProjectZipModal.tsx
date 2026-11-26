import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileArchive,
  FileCode2,
  FileText,
  Layers,
  X,
} from 'lucide-react';
import type { MakerStore } from '../../store/useMakerStore';
import { formatBytes } from '../../utils/assetVault';
import { projectToZipFilename, type ZipProjectExportResult } from '../../utils/makerArchive';
import { IconBadge } from './MakerUI';

interface ExportProjectZipModalProps {
  store: MakerStore;
  onClose: () => void;
}

export const ExportProjectZipModal: React.FC<ExportProjectZipModalProps> = ({
  store,
  onClose,
}) => {
  const { currentProject } = store;
  const [includeAssets, setIncludeAssets] = useState(true);
  const [sharedBy, setSharedBy] = useState(currentProject?.sharedBy ?? '');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ZipProjectExportResult | null>(null);

  const stats = useMemo(() => {
    if (!currentProject) {
      return { levels: 0, entities: 0, widgets: 0, rules: 0 };
    }
    const levels = currentProject.levels.length;
    const entities = currentProject.levels.reduce((s, l) => s + l.entities.length, 0);
    const rules = currentProject.levels.reduce(
      (s, l) => s + l.entities.reduce((es, e) => es + e.cards.length, 0),
      0
    );
    const widgets = currentProject.hud.widgets.length;
    return { levels, entities, widgets, rules };
  }, [currentProject]);

  if (!currentProject) return null;

  const targetFilename = projectToZipFilename(currentProject.name);

  const handleExportZip = async () => {
    setExporting(true);
    setError(null);
    try {
      const result = await store.exportProjectZip(currentProject, {
        includeAssets,
        sharedBy: sharedBy.trim() || undefined,
      });
      setLastResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to build ZIP archive.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.1] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-4 border-b border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#7C5CFF]/15 text-[#7C5CFF] flex items-center justify-center shrink-0">
              <FileArchive size={17} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-extrabold truncate">Export Adventure (.zip)</h2>
              <p className="text-[11px] text-slate-500 dark:text-[#949BB0] truncate">
                Save your 3D world, rules, HUD &amp; assets locally
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close export modal"
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-500"
          >
            <X size={16} />
          </button>
        </header>

        <div className="p-5 space-y-4">
          {/* Project Summary Card */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-100 dark:bg-[#1F2430] border border-slate-200/70 dark:border-white/[0.06]">
            <IconBadge
              symbol={currentProject.symbol}
              tint={currentProject.colorHex}
              size={42}
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-extrabold truncate">{currentProject.name}</div>
              <div className="text-[11px] text-slate-500 dark:text-[#949BB0] tabular-nums">
                {stats.levels} level{stats.levels === 1 ? '' : 's'} · {stats.entities} entities ·{' '}
                {stats.rules} rule{stats.rules === 1 ? '' : 's'} · {stats.widgets} HUD parts
              </div>
              <div className="text-[11px] font-mono text-[#7C5CFF] truncate mt-0.5">
                {targetFilename}
              </div>
            </div>
          </div>

          {/* Creator / Version label */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 dark:text-[#A3ACBF]">
              Creator or version label (optional)
            </label>
            <input
              type="text"
              value={sharedBy}
              onChange={(e) => setSharedBy(e.target.value)}
              placeholder="e.g. Adventure Build v1"
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#1F2430] border border-slate-200/80 dark:border-white/[0.08] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#7C5CFF]"
            />
          </div>

          {/* Include binary assets toggle */}
          <label className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-[#1F2430] text-xs font-semibold cursor-pointer">
            <span>Include custom 3D `.glb` models, textures &amp; voiceovers</span>
            <input
              type="checkbox"
              checked={includeAssets}
              onChange={(e) => setIncludeAssets(e.target.checked)}
              className="accent-[#7C5CFF] w-4 h-4 shrink-0"
            />
          </label>

          {/* Bundle contents preview */}
          <div className="rounded-xl bg-slate-50 dark:bg-[#12151D] border border-slate-200/80 dark:border-white/[0.06] p-3 space-y-1.5">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-[#7D859A]">
              Included in ZIP
            </div>
            <div className="grid grid-cols-1 gap-1 text-[11px] text-slate-600 dark:text-[#A3ACBF]">
              <div className="flex items-center gap-2">
                <FileCode2 size={12} className="text-[#7C5CFF] shrink-0" />
                <span className="font-mono font-semibold">project.json</span>
                <span className="text-slate-400 dark:text-[#6B7285] truncate">
                  — Levels, terrain, cast, rules &amp; HUD
                </span>
              </div>
              <div className="flex items-center gap-2">
                <FileText size={12} className="text-[#38BDF8] shrink-0" />
                <span className="font-mono font-semibold">manifest.json &amp; README.txt</span>
                <span className="text-slate-400 dark:text-[#6B7285] truncate">
                  — Metadata &amp; index
                </span>
              </div>
              {includeAssets && (
                <div className="flex items-center gap-2">
                  <Layers size={12} className="text-[#20B46A] shrink-0" />
                  <span className="font-mono font-semibold">assets/ textures/ voiceovers/</span>
                  <span className="text-slate-400 dark:text-[#6B7285] truncate">
                    — Referenced binaries
                  </span>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-[#F2545B]/12 border border-[#F2545B]/30 text-xs font-semibold text-[#F2545B]">
              {error}
            </div>
          )}

          {lastResult && (
            <div className="p-3 rounded-xl bg-[#20B46A]/12 border border-[#20B46A]/25 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-extrabold text-[#20B46A]">
                <CheckCircle2 size={14} />
                <span>Downloaded {lastResult.filename}</span>
              </div>
              <div className="text-[11px] text-slate-600 dark:text-[#A3ACBF] font-mono tabular-nums">
                {formatBytes(lastResult.zipBytes)} · {lastResult.fileCount} files
                {lastResult.assetCount + lastResult.textureCount + lastResult.voiceCount > 0
                  ? ` (${lastResult.assetCount} 3D, ${lastResult.textureCount} tex, ${lastResult.voiceCount} audio)`
                  : ''}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-[#1F2430] hover:bg-slate-200 dark:hover:bg-[#272D3C] text-xs font-bold"
            >
              Close
            </button>
            <button
              type="button"
              disabled={exporting}
              onClick={() => void handleExportZip()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#7C5CFF] hover:bg-[#6A48F5] text-white text-xs font-extrabold disabled:opacity-50 shadow-sm shadow-[#7C5CFF]/25"
            >
              <Download size={14} />
              <span>{exporting ? 'Bundling ZIP…' : 'Download ZIP'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
