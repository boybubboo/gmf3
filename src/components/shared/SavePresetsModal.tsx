import React, { useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  CloudSun,
  CopyPlus,
  Download,
  FolderOpen,
  Layers,
  Map as MapIcon,
  Pencil,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Trees,
  Upload,
  X,
} from 'lucide-react';
import type { MakerStore } from '../../store/useMakerStore';
import type { SavePresetEntry, SavePresetScope } from '../../types/maker';
import { readMakerFileAsText } from '../../utils/makerArchive';
import { downloadSavePresetsFile } from '../../utils/presetVault';
import { formatRelativeTime } from './MakerUI';

interface SavePresetsModalProps {
  store: MakerStore;
  onClose: () => void;
  initialScope?: SavePresetScope;
}

const SCOPE_META: Record<
  SavePresetScope,
  {
    label: string;
    shortLabel: string;
    blurb: string;
    accent: string;
    icon: React.ReactNode;
  }
> = {
  fullGame: {
    label: 'Full Game Design',
    shortLabel: 'Full Game',
    blurb: 'All levels, terrain, trees, cast, rules, HUD, post-FX, models & textures',
    accent: '#7C5CFF',
    icon: <Layers size={14} />,
  },
  worldLevel: {
    label: 'Current Level & World',
    shortLabel: 'Level',
    blurb: 'Terrain, biome, trees, scenery textures, entities & lighting',
    accent: '#20B46A',
    icon: <MapIcon size={14} />,
  },
  treeStudio: {
    label: 'Tree Maker Design',
    shortLabel: 'Trees',
    blurb: 'Bark, branches, roots, canopy base, 3D leaves, fruit & all species',
    accent: '#10B981',
    icon: <Trees size={14} />,
  },
  atmosphere: {
    label: 'Atmosphere & Post-FX',
    shortLabel: 'Atmosphere',
    blurb: 'Sky, weather, wind, distant vista, bloom, lens flare & color grading',
    accent: '#38BDF8',
    icon: <CloudSun size={14} />,
  },
};

function defaultNameForScope(store: MakerStore, scope: SavePresetScope): string {
  const proj = store.currentProject;
  const lvl = store.currentLevel;
  if (!proj) return 'My Game Design';
  if (scope === 'fullGame') return `${proj.name} Design`;
  if (scope === 'worldLevel') return `${lvl?.name ?? 'Level 1'} World`;
  if (scope === 'treeStudio') {
    const sp = lvl?.canopyEngine?.treeType ?? 'oak';
    const spName =
      sp === 'custom'
        ? lvl?.canopyEngine?.customTypeName?.trim() || 'Custom'
        : sp.charAt(0).toUpperCase() + sp.slice(1);
    return `${spName} Tree Preset`;
  }
  const sky = lvl?.sky ? lvl.sky.charAt(0).toUpperCase() + lvl.sky.slice(1) : 'Golden';
  return `${sky} Atmosphere`;
}

export const SavePresetsModal: React.FC<SavePresetsModalProps> = ({
  store,
  onClose,
  initialScope = 'fullGame',
}) => {
  const hasOpenProject = Boolean(store.currentProject);
  const [scope, setScope] = useState<SavePresetScope>(initialScope);
  const [presetName, setPresetName] = useState(() => defaultNameForScope(store, initialScope));
  const [notes, setNotes] = useState('');
  const [includeAssets, setIncludeAssets] = useState(true);
  const [filterScope, setFilterScope] = useState<'all' | SavePresetScope>('all');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingNotes, setEditingNotes] = useState('');
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const importFileRef = useRef<HTMLInputElement | null>(null);

  const flashFeedback = (kind: 'ok' | 'error', text: string) => {
    setFeedback({ kind, text });
  };

  const handleScopeChange = (nextScope: SavePresetScope) => {
    setScope(nextScope);
    setPresetName(defaultNameForScope(store, nextScope));
  };

  const handleSavePreset = async (alsoDownloadFile: boolean) => {
    if (!hasOpenProject) return;
    setBusy(true);
    try {
      const saved = await store.saveDesignPreset({
        name: presetName.trim() || defaultNameForScope(store, scope),
        notes,
        scope,
        includeAssets,
      });
      if (!saved) {
        flashFeedback('error', 'Could not save preset — open a game first.');
        return;
      }
      setNotes('');
      if (alsoDownloadFile) {
        const nextList = [saved, ...store.savedPresets.filter((p) => p.id !== saved.id)];
        downloadSavePresetsFile(nextList, 'savepresets.json');
        flashFeedback(
          'ok',
          `Saved "${saved.name}" and downloaded savepresets.json (${nextList.length} preset${nextList.length === 1 ? '' : 's'}).`
        );
      } else {
        flashFeedback('ok', `Saved "${saved.name}" to your local presets library.`);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleOverwritePreset = async (preset: SavePresetEntry) => {
    if (!hasOpenProject) return;
    setBusy(true);
    try {
      const updated = await store.saveDesignPreset({
        name: preset.name,
        notes: preset.notes,
        scope: preset.scope,
        includeAssets,
        overwriteId: preset.id,
      });
      if (updated) {
        flashFeedback('ok', `Updated "${updated.name}" with your latest changes.`);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleLoadPreset = async (
    preset: SavePresetEntry,
    loadMode?: 'replaceCurrent' | 'asNewGame'
  ) => {
    setBusy(true);
    try {
      const res = await store.loadDesignPreset(preset, { loadMode });
      if (res.ok) {
        flashFeedback('ok', res.message);
        if (preset.scope === 'fullGame' && !hasOpenProject) {
          onClose();
        }
      } else {
        flashFeedback('error', res.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleExportAllFile = () => {
    if (store.savedPresets.length === 0) {
      flashFeedback('error', 'Save at least one preset first before downloading savepresets.json.');
      return;
    }
    const count = store.exportSavePresetsFile(undefined, 'savepresets.json');
    flashFeedback(
      'ok',
      `Downloaded savepresets.json with ${count} saved preset${count === 1 ? '' : 's'}.`
    );
  };

  const handleExportSingleFile = (preset: SavePresetEntry) => {
    const slug = preset.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'preset';
    store.exportSavePresetsFile([preset.id], `${slug}.savepresets.json`);
    flashFeedback('ok', `Downloaded ${slug}.savepresets.json.`);
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const raw = await readMakerFileAsText(file);
      const res = await store.importSavePresetsFile(raw, 'merge');
      if (res.ok) {
        flashFeedback(
          'ok',
          `Loaded ${res.count ?? 0} preset${res.count === 1 ? '' : 's'} from ${file.name}. Click Load on any preset to apply it.`
        );
      } else {
        flashFeedback('error', res.error ?? 'Could not load that presets file.');
      }
    } catch (err) {
      flashFeedback(
        'error',
        err instanceof Error ? err.message : 'Could not read that file.'
      );
    } finally {
      setBusy(false);
    }
  };

  const filteredPresets = useMemo(() => {
    const q = query.trim().toLowerCase();
    return store.savedPresets.filter((p) => {
      if (filterScope !== 'all' && p.scope !== filterScope) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.notes ?? '').toLowerCase().includes(q) ||
        p.summary.toLowerCase().includes(q)
      );
    });
  }, [filterScope, query, store.savedPresets]);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-2.5 sm:p-4">
      <div className="w-full max-w-5xl h-[min(90vh,760px)] rounded-2xl bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.1] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <header className="shrink-0 px-5 py-3.5 border-b border-slate-200/80 dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-extrabold tracking-tight flex items-center gap-2">
              <Save size={16} className="text-[#7C5CFF] shrink-0" />
              <span>Local Save Presets</span>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#1F2430] text-slate-500 dark:text-[#949BB0]">
                savepresets.json
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#949BB0] truncate">
              Save snapshots of your game design locally and export or reload your savepresets.json file anytime.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <input
              ref={importFileRef}
              type="file"
              accept=".json,.savepresets,.maker"
              className="hidden"
              onChange={handleImportFileChange}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => importFileRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1F2430] hover:bg-slate-200 dark:hover:bg-[#272D3C] text-xs font-bold transition-colors disabled:opacity-50"
            >
              <Upload size={13} className="text-[#38BDF8]" />
              <span>Load File</span>
            </button>
            <button
              type="button"
              disabled={busy || store.savedPresets.length === 0}
              onClick={handleExportAllFile}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#7C5CFF] hover:bg-[#6A48F5] text-white text-xs font-extrabold transition-colors disabled:opacity-45"
            >
              <Download size={13} />
              <span>Save savepresets.json</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Save Presets"
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-500"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {/* Feedback Banner */}
        {feedback && (
          <div
            className={`shrink-0 px-5 py-2 text-xs font-semibold flex items-center justify-between gap-2 border-b ${
              feedback.kind === 'ok'
                ? 'bg-[#20B46A]/12 border-[#20B46A]/25 text-[#20B46A]'
                : 'bg-[#F2545B]/12 border-[#F2545B]/25 text-[#F2545B]'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 size={14} className="shrink-0" />
              <span className="truncate">{feedback.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-[11px] font-bold underline shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          {/* Left Column: Save New Preset (when a project is open) */}
          {hasOpenProject && (
            <aside className="w-full lg:w-[360px] shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200/80 dark:border-white/[0.08] p-4 overflow-y-auto maker-scroll space-y-4 bg-slate-50/70 dark:bg-[#131720]">
              <div className="space-y-1">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB]">
                  Capture Current Design
                </span>
                <p className="text-[11px] text-slate-500 dark:text-[#949BB0]">
                  Choose whether to save your entire game or a focused design preset.
                </p>
              </div>

              {/* Scope Selector */}
              <div className="grid grid-cols-2 gap-2">
                {(['fullGame', 'worldLevel', 'treeStudio', 'atmosphere'] as SavePresetScope[]).map(
                  (sc) => {
                    const meta = SCOPE_META[sc];
                    const active = scope === sc;
                    return (
                      <button
                        key={sc}
                        type="button"
                        onClick={() => handleScopeChange(sc)}
                        className={`p-2.5 rounded-xl border text-left transition-colors space-y-1 ${
                          active
                            ? 'bg-white dark:bg-[#1B202C] border-[#7C5CFF] shadow-xs'
                            : 'bg-white/60 dark:bg-[#171A23] border-slate-200/70 dark:border-white/[0.07] hover:border-slate-300 dark:hover:border-white/[0.15]'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span style={{ color: meta.accent }}>{meta.icon}</span>
                          <span className="text-xs font-extrabold truncate">{meta.shortLabel}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-[#8E96AB] leading-snug line-clamp-2">
                          {meta.blurb}
                        </p>
                      </button>
                    );
                  }
                )}
              </div>

              {/* Name & Notes */}
              <div className="space-y-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-[#A3ACBF]">
                    Preset Name
                  </label>
                  <input
                    type="text"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="e.g. Autumn Forest Master"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#1B202C] border border-slate-200/80 dark:border-white/[0.1] text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#7C5CFF]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-[#A3ACBF]">
                    Notes (optional)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Maple leaves + sunset bloom + cave"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#1B202C] border border-slate-200/80 dark:border-white/[0.1] text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#7C5CFF]"
                  />
                </div>
              </div>

              {scope !== 'atmosphere' && (
                <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white dark:bg-[#1B202C] border border-slate-200/70 dark:border-white/[0.08] cursor-pointer text-[11px] font-semibold">
                  <span className="text-slate-600 dark:text-[#A3ACBF]">
                    Embed custom `.glb` models &amp; textures
                  </span>
                  <input
                    type="checkbox"
                    checked={includeAssets}
                    onChange={(e) => setIncludeAssets(e.target.checked)}
                    className="accent-[#7C5CFF] w-4 h-4 shrink-0"
                  />
                </label>
              )}

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleSavePreset(false)}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#20B46A] hover:bg-[#1B9E5C] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Save size={14} />
                  <span>{busy ? 'Saving…' : 'Save to Local Presets'}</span>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleSavePreset(true)}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#7C5CFF]/15 hover:bg-[#7C5CFF]/25 text-[#7C5CFF] text-xs font-extrabold inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Download size={14} />
                  <span>Save &amp; Download savepresets.json</span>
                </button>
              </div>
            </aside>
          )}

          {/* Right Column: Saved Presets Library */}
          <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* Filter & Search Bar */}
            <div className="shrink-0 px-4 py-3 border-b border-slate-200/70 dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 flex-wrap">
                {(['all', 'fullGame', 'worldLevel', 'treeStudio', 'atmosphere'] as const).map(
                  (f) => {
                    const active = filterScope === f;
                    const label = f === 'all' ? `All (${store.savedPresets.length})` : SCOPE_META[f].shortLabel;
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFilterScope(f)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                          active
                            ? 'bg-[#7C5CFF] text-white'
                            : 'bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  }
                )}
              </div>

              <div className="relative min-w-[170px] flex-1 sm:flex-initial">
                <Search
                  size={13}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter presets…"
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#7C5CFF]"
                />
              </div>
            </div>

            {/* Preset List */}
            <div className="flex-1 min-h-0 overflow-y-auto maker-scroll p-4 space-y-2.5">
              {filteredPresets.length === 0 ? (
                <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center p-6 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#7C5CFF]/15 text-[#7C5CFF] flex items-center justify-center">
                    <FolderOpen size={22} />
                  </div>
                  <div className="space-y-1 max-w-sm">
                    <h3 className="text-sm font-extrabold">
                      {store.savedPresets.length === 0
                        ? 'No saved presets yet'
                        : 'No presets match that filter'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-[#949BB0] leading-relaxed">
                      {store.savedPresets.length === 0
                        ? hasOpenProject
                          ? 'Save your current game design on the left, or load an existing savepresets.json file from your computer.'
                          : 'Load a savepresets.json file from your computer to restore saved games and design presets.'
                        : 'Try clearing the search box or switching to All.'}
                    </p>
                  </div>
                  {store.savedPresets.length === 0 && (
                    <button
                      type="button"
                      onClick={() => importFileRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#7C5CFF] text-white text-xs font-bold hover:bg-[#6A48F5]"
                    >
                      <Upload size={13} />
                      <span>Load savepresets.json File</span>
                    </button>
                  )}
                </div>
              ) : (
                filteredPresets.map((preset) => {
                  const meta = SCOPE_META[preset.scope];
                  const isEditing = editingId === preset.id;
                  const canLoadHere = hasOpenProject || preset.scope === 'fullGame';
                  const assetCount = preset.assets?.length ?? 0;
                  const texCount = preset.textures?.length ?? 0;

                  return (
                    <div
                      key={preset.id}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#1B202C] border border-slate-200/80 dark:border-white/[0.08] space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide"
                              style={{
                                backgroundColor: `${meta.accent}22`,
                                color: meta.accent,
                              }}
                            >
                              {meta.icon}
                              <span>{meta.shortLabel}</span>
                            </span>
                            {assetCount > 0 && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-white/[0.07] text-slate-600 dark:text-[#A3ACBF]">
                                {assetCount} 3D model{assetCount === 1 ? '' : 's'}
                              </span>
                            )}
                            {texCount > 0 && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-white/[0.07] text-slate-600 dark:text-[#A3ACBF]">
                                {texCount} texture{texCount === 1 ? '' : 's'}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400 dark:text-[#7D859B]">
                              {formatRelativeTime(preset.updatedAt || preset.createdAt)}
                            </span>
                          </div>

                          {isEditing ? (
                            <div className="flex flex-col sm:flex-row gap-1.5 pt-1">
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                className="flex-1 px-2.5 py-1 rounded-lg bg-white dark:bg-[#131720] border border-[#7C5CFF] text-xs font-bold focus:outline-none"
                              />
                              <input
                                type="text"
                                value={editingNotes}
                                onChange={(e) => setEditingNotes(e.target.value)}
                                placeholder="Notes…"
                                className="flex-1 px-2.5 py-1 rounded-lg bg-white dark:bg-[#131720] border border-slate-200/80 dark:border-white/[0.1] text-xs focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={async () => {
                                  await store.renameDesignPreset(preset.id, editingName, editingNotes);
                                  setEditingId(null);
                                  flashFeedback('ok', `Renamed preset to "${editingName.trim() || preset.name}".`);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-[#20B46A] text-white text-xs font-bold inline-flex items-center justify-center gap-1"
                              >
                                <Check size={12} />
                                <span>Save</span>
                              </button>
                            </div>
                          ) : (
                            <>
                              <h3 className="text-sm font-extrabold truncate">{preset.name}</h3>
                              <p className="text-[11px] text-slate-500 dark:text-[#949BB0]">
                                {preset.summary}
                                {preset.notes ? ` · ${preset.notes}` : ''}
                              </p>
                            </>
                          )}
                        </div>

                        {/* Utility Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            title="Rename preset"
                            onClick={() => {
                              setEditingId(preset.id);
                              setEditingName(preset.name);
                              setEditingNotes(preset.notes ?? '');
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-white/[0.08]"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            title="Download single preset file"
                            onClick={() => handleExportSingleFile(preset)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-[#7C5CFF] hover:bg-[#7C5CFF]/10"
                          >
                            <Download size={13} />
                          </button>
                          <button
                            type="button"
                            title="Delete preset"
                            onClick={async () => {
                              await store.deleteDesignPreset(preset.id);
                              flashFeedback('ok', `Deleted "${preset.name}".`);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-[#F2545B] hover:bg-[#F2545B]/10"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Load / Overwrite Actions */}
                      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/60 dark:border-white/[0.06]">
                        <button
                          type="button"
                          disabled={busy || !canLoadHere}
                          onClick={() =>
                            void handleLoadPreset(
                              preset,
                              hasOpenProject ? 'replaceCurrent' : 'asNewGame'
                            )
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#20B46A] hover:bg-[#1B9E5C] text-white text-xs font-extrabold transition-colors disabled:opacity-40"
                        >
                          <FolderOpen size={13} />
                          <span>
                            {preset.scope === 'fullGame'
                              ? hasOpenProject
                                ? 'Load into Current Game'
                                : 'Open Game'
                              : 'Load Preset'}
                          </span>
                        </button>

                        {preset.scope === 'fullGame' && hasOpenProject && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleLoadPreset(preset, 'asNewGame')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.1] hover:border-[#7C5CFF] text-xs font-bold transition-colors disabled:opacity-40"
                          >
                            <CopyPlus size={13} className="text-[#7C5CFF]" />
                            <span>Open as New Game</span>
                          </button>
                        )}

                        {hasOpenProject && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleOverwritePreset(preset)}
                            title="Update this saved preset slot with your current design"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.1] hover:border-[#20B46A] text-[11px] font-bold text-slate-600 dark:text-[#A3ACBF] hover:text-[#20B46A] transition-colors ml-auto disabled:opacity-40"
                          >
                            <RefreshCw size={12} />
                            <span>Update</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};
