import React, { Profiler, useEffect, useRef, useState } from 'react';
import {
  Box,
  ChevronDown,
  ChevronLeft,
  Clapperboard,
  CloudSun,
  FileArchive,
  Layers,
  Lightbulb,
  Mountain,
  Paintbrush,
  Play,
  Redo2,
  Save,
  Settings,
  Shapes,
  Sparkles,
  Sprout,
  Trees,
  Undo2,
  User,
  Wand2,
} from 'lucide-react';
import type { MakerStore } from '../../store/useMakerStore';
import type { StageTab } from '../../types/maker';
import { PlayModeView } from '../play/PlayModeView';
import { CastStage } from '../stages/CastStage';
import { InterfaceStage } from '../stages/InterfaceStage';
import { LogicStage } from '../stages/LogicStage';
import { MotionStage } from '../stages/MotionStage';
import { PublishModal } from '../stages/PublishStage';
import { WorldStage } from '../stages/WorldStage';
import { AtmosphereDrawer } from '../world/AtmosphereDrawer';
import { CanopyEngineModal } from '../world/CanopyEngineModal';
import { CharacterMakerModal } from '../world/CharacterMakerModal';
import { ObjectMakerModal } from '../world/ObjectMakerModal';
import { PlantMakerModal } from '../world/PlantMakerModal';
import { TextureStudioModal } from '../world/TextureStudioModal';
import { VertexPaintModal } from '../world/VertexPaintModal';
import { AssetVaultModal } from './AssetVaultModal';
import { EntityAttributeModal } from './EntityAttributeModal';
import { ExportProjectZipModal } from './ExportProjectZipModal';
import { MakerIcon } from './IconMap';
import { IdeasModal } from './IdeasModal';
import { ThemeToggle } from './MakerUI';
import { MonsterBuilderModal } from './MonsterBuilderModal';
import { PersistentMinimapHUD } from './PersistentMinimapHUD';
import { PostProcessingMenuModal } from './PostProcessingMenuModal';
import { SavePresetsModal } from './SavePresetsModal';
import {
  detectTimeOfDayPreset,
  SkyboxLightingEditorModal,
  TimeOfDayIcon,
} from './SkyboxLightingEditorModal';
import { StoryDirectorModal } from './StoryDirectorModal';
import { TerrainEditorModal } from './TerrainEditorModal';
import { ContextualAiModal } from './ContextualAiModal';
import {
  setContextualAiPanelOpen,
  toggleContextualAiPanel,
  useContextualAiPanelState,
} from '../../ai/studioBridge';
import { useHintsEnabled } from '../../utils/editorPrefs';
import {
  onEditorProfilerRender,
  useEditorResourceMonitor,
} from '../../utils/resourceMonitor';

const STAGE_TABS: {
  id: StageTab;
  title: string;
  symbol: string;
  accent: string;
}[] = [
  { id: 'world', title: 'World', symbol: 'map.fill', accent: '#16A34A' },
  { id: 'cast', title: 'Cast', symbol: 'person.2.fill', accent: '#0284C7' },
  { id: 'motion', title: 'Motion', symbol: 'motion.studio', accent: '#6D4AFF' },
  { id: 'logic', title: 'Logic', symbol: 'arrow.triangle.branch', accent: '#9333EA' },
  { id: 'interface', title: 'Interface', symbol: 'slider.horizontal.3', accent: '#D97706' },
];

const AUTO_SAVE_META_DEBOUNCE_MS = 2500;
const EDITOR_AUTOSAVE_META_KEY = 'maker.autosave.meta.v1';

export const EditorShell: React.FC<{ store: MakerStore }> = ({ store }) => {
  const { currentProject, currentLevel } = store;
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [showingExportZip, setShowingExportZip] = useState(false);
  const [hintsEnabled, setHintsEnabled] = useHintsEnabled();
  const aiPanelState = useContextualAiPanelState();

  const lastMetaSigRef = useRef<string>('');
  const autoSaveTimerRef = useRef<number | null>(null);

  useEditorResourceMonitor({
    stage: store.selectedTab,
    projectId: currentProject?.id ?? null,
  });

  // Lightweight debounced session metadata marker (full project persistence runs asynchronously in useMakerStore)
  useEffect(() => {
    if (!currentProject) {
      lastMetaSigRef.current = '';
      return;
    }

    const levelId = currentLevel?.id ?? null;
    const tab = store.selectedTab;
    const projectId = currentProject.id;
    const sig = `${projectId}:${levelId ?? ''}:${tab}`;
    if (lastMetaSigRef.current === sig) return;
    lastMetaSigRef.current = sig;

    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = window.setTimeout(() => {
      autoSaveTimerRef.current = null;
      try {
        localStorage.setItem(
          EDITOR_AUTOSAVE_META_KEY,
          JSON.stringify({
            projectId,
            levelId,
            tab,
            savedAt: new Date().toISOString(),
          })
        );
      } catch {
        // ignore localStorage quota errors
      }
    }, AUTO_SAVE_META_DEBOUNCE_MS);

    return () => {
      if (autoSaveTimerRef.current !== null) {
        window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [currentProject?.id, currentLevel?.id, store.selectedTab]);

  if (!currentProject) return null;

  const activeTimePreset = currentLevel ? detectTimeOfDayPreset(currentLevel) : 'noon';
  const hasBlockingPublishIssue = store.issues.some((i) => i.isBlocking);

  return (
    <div className="h-dvh min-h-0 flex flex-col bg-[#F4F5F8] dark:bg-[#0F1117] text-slate-900 dark:text-[#F3F5FA] overflow-hidden transition-colors">
      {/* Unified Studio Header: Project | 5 High-Contrast Stage Tabs | Create, AI, History, Settings, Publish, Play */}
      <Profiler id="EditorShell.Header" onRender={onEditorProfilerRender}>
        <header className="shrink-0 bg-white dark:bg-[#151822] border-b border-slate-200/80 dark:border-white/[0.08] px-3 sm:px-4 py-2 flex items-center justify-between gap-4 z-30">
          {/* Left: Back + Project Title */}
          <div className="flex items-center gap-2.5 shrink-0 min-w-0">
            <button
              type="button"
              onClick={() => store.closeProject()}
              title="Back to all games"
              aria-label="Back to all games"
              className="h-9 px-2.5 rounded-xl bg-slate-100 dark:bg-[#1E2331] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 hover:bg-slate-200/80 dark:hover:bg-[#272D3E] inline-flex items-center gap-1.5 text-xs font-bold transition-colors shrink-0 whitespace-nowrap"
            >
              <ChevronLeft size={15} strokeWidth={2.5} />
              <span className="hidden xl:inline">Games</span>
            </button>

            <h1 className="hidden md:block text-sm sm:text-[15px] font-display font-bold tracking-tight text-slate-900 dark:text-white truncate max-w-[165px]">
              {currentProject.name}
            </h1>
          </div>

          {/* Center: Bold, Contrasty Stage Tabs */}
          <nav
            aria-label="Editor Stages"
            className="flex items-center justify-center gap-1.5 p-1 rounded-2xl bg-slate-100/90 dark:bg-[#10131C] border border-slate-200/80 dark:border-white/[0.07] shrink-0"
          >
            {STAGE_TABS.map((tab) => {
              const active = store.selectedTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => store.setSelectedTab(tab.id)}
                  className={`h-8 sm:h-9 inline-flex items-center gap-2 px-3 sm:px-4 rounded-xl text-xs sm:text-[13px] font-extrabold tracking-tight transition-all shrink-0 whitespace-nowrap ${
                    active
                      ? 'text-white shadow-sm'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-[#1C2130] hover:text-slate-950 dark:hover:text-white'
                  }`}
                  style={
                    active
                      ? { backgroundColor: tab.accent }
                      : undefined
                  }
                >
                  <MakerIcon
                    symbol={tab.symbol}
                    size={15}
                    color={active ? '#FFFFFF' : tab.accent}
                  />
                  <span>{tab.title}</span>
                </button>
              );
            })}
          </nav>

          {/* Right: Focused Creation & Action Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Create Studio Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setCreateMenuOpen((v) => !v);
                  setSettingsMenuOpen(false);
                }}
                className={`h-9 inline-flex items-center gap-1.5 px-3 rounded-xl text-xs font-extrabold whitespace-nowrap transition-colors border ${
                  createMenuOpen
                    ? 'bg-[#6D4AFF] border-[#6D4AFF] text-white'
                    : 'bg-[#6D4AFF]/12 dark:bg-[#7C5CFF]/18 border-[#6D4AFF]/25 text-[#5B3DF5] dark:text-[#C4B5FD] hover:bg-[#6D4AFF]/20'
                }`}
              >
                <Wand2 size={14} />
                <span>Create</span>
                <ChevronDown size={12} />
              </button>

              {createMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setCreateMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-[#171A23] shadow-2xl border border-slate-200/80 dark:border-white/[0.1] py-1.5 z-30">
                    <div className="px-3.5 py-1 text-[11px] font-bold text-slate-400">
                      Maker Studios
                    </div>
                    {[
                      {
                        label: 'Object Maker',
                        desc: 'Sculpt props & mechanisms',
                        Icon: Shapes,
                        color: '#7C5CFF',
                        action: () => store.openObjectMaker(),
                      },
                      {
                        label: 'Plant Maker',
                        desc: 'Leaves, fans & flowers',
                        Icon: Sprout,
                        color: '#20B46A',
                        action: () => store.openPlantMaker(),
                      },
                      {
                        label: 'Character Maker',
                        desc: 'Clay rig, morphs & voices',
                        Icon: User,
                        color: '#A855F7',
                        action: () => store.openCharacterMaker(),
                      },
                      {
                        label: 'Creature Maker',
                        desc: 'Animals, beasts & abilities',
                        Icon: Sparkles,
                        color: '#EC4899',
                        action: () => store.openMonsterMaker(),
                      },
                      {
                        label: 'Tree Maker',
                        desc: 'Canopy trunks & branches',
                        Icon: Trees,
                        color: '#16A34A',
                        action: () => store.openTreeMaker(),
                      },
                      {
                        label: 'Building Maker Kit',
                        desc: 'Modular walls, roofs & doors',
                        Icon: Box,
                        color: '#F59E0B',
                        action: () => {
                          store.setSelectedTab('world');
                          store.setActiveWorldDomain('buildings');
                          store.setWorldTool('add');
                        },
                      },
                    ].map((item) => {
                      const Icon = item.Icon;
                      return (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => {
                            setCreateMenuOpen(false);
                            item.action();
                          }}
                          className="w-full px-3.5 py-2 flex items-center gap-2.5 text-left hover:bg-slate-100 dark:hover:bg-[#1F2430]"
                        >
                          <span
                            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${item.color}20`, color: item.color }}
                          >
                            <Icon size={14} />
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold leading-tight">{item.label}</div>
                            <div className="text-[11px] text-slate-500 dark:text-[#949BB0]">
                              {item.desc}
                            </div>
                          </div>
                        </button>
                      );
                    })}

                    <div className="my-1.5 border-t border-slate-200/70 dark:border-white/[0.08]" />
                    <div className="px-3.5 py-1 text-[11px] font-bold text-slate-400">
                      Sky, Surfaces &amp; Effects
                    </div>
                    {[
                      {
                        label: 'Atmosphere & Sky',
                        Icon: CloudSun,
                        color: '#0EA5E9',
                        action: () => store.setShowingAtmosphereDrawer(!store.showingAtmosphereDrawer),
                      },
                      {
                        label: 'Texture Maker',
                        Icon: Layers,
                        color: '#7C5CFF',
                        action: () => store.setShowingTextureStudio(true),
                      },
                      {
                        label: 'FX Library',
                        Icon: Sparkles,
                        color: '#F59E0B',
                        action: () => {
                          store.setSelectedTab('world');
                          store.setShowingFxLibrary(true);
                        },
                      },
                      {
                        label: 'Vertex Paint',
                        Icon: Paintbrush,
                        color: '#EC4899',
                        action: () =>
                          store.setVertexPaintTarget(store.selectedEntityID ?? 'forestTree'),
                      },
                      {
                        label: 'Terrain Heightmap',
                        Icon: Mountain,
                        color: '#20B46A',
                        action: () => store.setShowingTerrainEditor(true),
                      },
                    ].map((item) => {
                      const Icon = item.Icon;
                      return (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => {
                            setCreateMenuOpen(false);
                            item.action();
                          }}
                          className="w-full px-3.5 py-1.5 flex items-center gap-2.5 text-left text-xs font-bold hover:bg-slate-100 dark:hover:bg-[#1F2430]"
                        >
                          <Icon size={14} style={{ color: item.color }} />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* AI Helper */}
            <button
              type="button"
              onClick={() => toggleContextualAiPanel()}
              title="AI Helper"
              aria-label="Toggle AI Helper"
              aria-pressed={aiPanelState.isOpen}
              className={`h-9 inline-flex items-center gap-1.5 px-3 rounded-xl text-xs font-extrabold whitespace-nowrap transition-colors shrink-0 border ${
                aiPanelState.isOpen
                  ? 'bg-[#6D4AFF] border-[#6D4AFF] text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-[#1E2331] border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 hover:border-[#6D4AFF]/50'
              }`}
            >
              <Sparkles size={14} className={aiPanelState.isOpen ? 'text-white' : 'text-[#F59E0B]'} />
              <span>AI</span>
            </button>

            {/* Undo / Redo Group */}
            <div className="hidden sm:inline-flex items-center h-9 rounded-xl bg-slate-100 dark:bg-[#1E2331] border border-slate-200/80 dark:border-white/[0.08] p-0.5 shrink-0">
              <button
                type="button"
                disabled={!store.canUndo}
                onClick={() => store.undo()}
                title={store.canUndo ? `Undo ${store.undoLabel}` : 'Undo'}
                aria-label="Undo"
                className="w-8 h-full rounded-lg flex items-center justify-center disabled:opacity-35 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-[#2A3142] transition-colors"
              >
                <Undo2 size={14} />
              </button>
              <button
                type="button"
                disabled={!store.canRedo}
                onClick={() => store.redo()}
                title="Redo"
                aria-label="Redo"
                className="w-8 h-full rounded-lg flex items-center justify-center disabled:opacity-35 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-[#2A3142] transition-colors"
              >
                <Redo2 size={14} />
              </button>
            </div>

            {/* Settings & Project Menu (Theme, Hints, Atmosphere, Vault, Save, Director, Export) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setSettingsMenuOpen((v) => !v);
                  setCreateMenuOpen(false);
                }}
                aria-expanded={settingsMenuOpen}
                title="Studio Settings, Theme, Hints & Project Tools"
                className={`h-9 inline-flex items-center gap-1.5 px-3 rounded-xl text-xs font-extrabold whitespace-nowrap transition-colors border shrink-0 ${
                  settingsMenuOpen
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent'
                    : 'bg-slate-100 dark:bg-[#1E2331] border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 hover:bg-slate-200/80 dark:hover:bg-[#272D3E]'
                }`}
              >
                <Settings size={14} />
                <span className="hidden lg:inline">Settings</span>
              </button>

              {settingsMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setSettingsMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white dark:bg-[#171A23] shadow-2xl border border-slate-200/80 dark:border-white/[0.1] p-2.5 space-y-2 z-30">
                    <div className="px-1.5 py-0.5 text-[11px] font-bold text-slate-400">
                      Preferences
                    </div>

                    <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#12151E] border border-slate-200/70 dark:border-white/[0.06]">
                      <span className="text-xs font-bold">Appearance</span>
                      <ThemeToggle theme={store.theme} onChange={store.setTheme} compact />
                    </div>

                    <label className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#12151E] border border-slate-200/70 dark:border-white/[0.06] cursor-pointer">
                      <span className="text-xs font-bold">Guided Workflow Hints</span>
                      <input
                        type="checkbox"
                        checked={hintsEnabled}
                        onChange={(e) => setHintsEnabled(e.target.checked)}
                        className="accent-[#6D4AFF] w-4 h-4"
                      />
                    </label>

                    <div className="border-t border-slate-200/70 dark:border-white/[0.08] pt-1.5">
                      <div className="px-1.5 pb-1 text-[11px] font-bold text-slate-400">
                        World &amp; Project Tools
                      </div>
                      <div className="space-y-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSettingsMenuOpen(false);
                            store.setShowingAtmosphereDrawer(!store.showingAtmosphereDrawer);
                          }}
                          className="w-full px-2.5 py-2 rounded-xl flex items-center justify-between gap-2 text-left text-xs font-bold hover:bg-slate-100 dark:hover:bg-[#1F2430]"
                        >
                          <span className="flex items-center gap-2.5">
                            <TimeOfDayIcon
                              preset={activeTimePreset}
                              size={14}
                              className="text-[#0EA5E9]"
                            />
                            <span>Atmosphere &amp; Sky</span>
                          </span>
                          <CloudSun size={13} className="text-slate-400" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSettingsMenuOpen(false);
                            store.setShowingAssetVault(true);
                          }}
                          className="w-full px-2.5 py-2 rounded-xl flex items-center justify-between gap-2 text-left text-xs font-bold hover:bg-slate-100 dark:hover:bg-[#1F2430]"
                        >
                          <span className="flex items-center gap-2.5">
                            <Box size={14} className="text-[#7C5CFF]" />
                            <span>3D Asset Vault</span>
                          </span>
                          <span className="text-[11px] font-bold tabular-nums text-slate-400">
                            {store.customAssets.length}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSettingsMenuOpen(false);
                            store.setShowingPresets(true);
                          }}
                          className="w-full px-2.5 py-2 rounded-xl flex items-center gap-2.5 text-left text-xs font-bold hover:bg-slate-100 dark:hover:bg-[#1F2430]"
                        >
                          <Save size={14} className="text-[#20B46A]" />
                          <span>Save &amp; Load Presets</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSettingsMenuOpen(false);
                            store.setShowingDirector(true);
                          }}
                          className="w-full px-2.5 py-2 rounded-xl flex items-center gap-2.5 text-left text-xs font-bold hover:bg-slate-100 dark:hover:bg-[#1F2430]"
                        >
                          <Clapperboard size={14} className="text-[#F59E0B]" />
                          <span>Story Director</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSettingsMenuOpen(false);
                            store.setShowingIdeas(true);
                          }}
                          className="w-full px-2.5 py-2 rounded-xl flex items-center gap-2.5 text-left text-xs font-bold hover:bg-slate-100 dark:hover:bg-[#1F2430]"
                        >
                          <Lightbulb size={14} className="text-[#F59E0B]" />
                          <span>Ideas Coach</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSettingsMenuOpen(false);
                            setShowingExportZip(true);
                          }}
                          className="w-full px-2.5 py-2 rounded-xl flex items-center gap-2.5 text-left text-xs font-bold hover:bg-slate-100 dark:hover:bg-[#1F2430]"
                        >
                          <FileArchive size={14} className="text-[#7C5CFF]" />
                          <span>Export Adventure ZIP</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Publish */}
            <button
              type="button"
              onClick={() => store.setShowingPublish(true)}
              title="Publish & Share Game"
              className={`relative h-9 inline-flex items-center gap-1.5 px-3 rounded-xl text-xs font-extrabold whitespace-nowrap transition-colors border shrink-0 ${
                store.showingPublish
                  ? 'bg-[#0284C7] border-[#0284C7] text-white'
                  : 'bg-[#0EA5E9]/12 border-[#0EA5E9]/30 text-[#0284C7] dark:text-[#38BDF8] hover:bg-[#0EA5E9]/20'
              }`}
            >
              <MakerIcon
                symbol="paperplane.fill"
                size={13}
                color={store.showingPublish ? '#FFFFFF' : '#0EA5E9'}
              />
              <span className="hidden sm:inline">Publish</span>
              {hasBlockingPublishIssue && !store.showingPublish && (
                <span
                  aria-hidden="true"
                  className="w-2 h-2 rounded-full bg-[#F59E0B]"
                />
              )}
            </button>

            {/* Play CTA */}
            <button
              type="button"
              onClick={() => {
                store.setPlayFromPoint(null);
                store.setIsPlaying(true);
              }}
              className="h-9 inline-flex items-center gap-1.5 px-4 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-xs sm:text-[13px] font-extrabold shadow-sm shrink-0 whitespace-nowrap transition-colors"
            >
              <Play size={13} fill="currentColor" />
              <span>Play</span>
            </button>
          </div>
        </header>
      </Profiler>

      {/* Main Stage */}
      <Profiler id={`EditorShell.Stage.${store.selectedTab}`} onRender={onEditorProfilerRender}>
        <div className="flex-1 min-h-0 overflow-hidden">
          {store.selectedTab === 'world' && <WorldStage store={store} />}
          {store.selectedTab === 'cast' && <CastStage store={store} />}
          {store.selectedTab === 'motion' && <MotionStage store={store} />}
          {store.selectedTab === 'logic' && <LogicStage store={store} />}
          {store.selectedTab === 'interface' && <InterfaceStage store={store} />}
        </div>
      </Profiler>

      {/* Global Overlays, Drawers & Maker Studios */}
      <Profiler id="EditorShell.Overlays" onRender={onEditorProfilerRender}>
        {store.showingAtmosphereDrawer && <AtmosphereDrawer store={store} />}
        {store.attributeModifierTarget !== null && <EntityAttributeModal store={store} />}

        {store.showingIdeas && (
          <IdeasModal store={store} onClose={() => store.setShowingIdeas(false)} />
        )}

        {store.showingAssetVault && (
          <AssetVaultModal store={store} onClose={() => store.setShowingAssetVault(false)} />
        )}

        {store.showingPresets && (
          <SavePresetsModal store={store} onClose={() => store.setShowingPresets(false)} />
        )}

        {store.showingPublish && (
          <PublishModal store={store} onClose={() => store.setShowingPublish(false)} />
        )}

        {store.showingDirector && (
          <StoryDirectorModal store={store} onClose={() => store.setShowingDirector(false)} />
        )}

        {store.showingSkybox && (
          <SkyboxLightingEditorModal
            store={store}
            onClose={() => store.setShowingSkybox(false)}
          />
        )}

        {store.showingTerrainEditor && (
          <TerrainEditorModal
            store={store}
            onClose={() => store.setShowingTerrainEditor(false)}
          />
        )}

        {store.showingPostFx && (
          <PostProcessingMenuModal
            store={store}
            onClose={() => store.setShowingPostFx(false)}
          />
        )}

        {store.showingTextureStudio && (
          <TextureStudioModal
            store={store}
            onClose={() => store.setShowingTextureStudio(false)}
          />
        )}

        {store.vertexPaintTarget !== null && (
          <VertexPaintModal
            store={store}
            initialEntityId={
              store.vertexPaintTarget === 'forestTree' ? null : store.vertexPaintTarget
            }
            onClose={() => store.setVertexPaintTarget(null)}
          />
        )}

        {store.treeMakerOpen && (
          <CanopyEngineModal
            store={store}
            initialAssetId={store.treeMakerTargetAssetId}
            initialSpecies={store.treeMakerInitialSpecies}
            onClose={() => {
              store.setTreeMakerInitialSpecies(null);
              store.setTreeMakerOpen(false);
            }}
            onOpenVertexPainter={() => {
              store.setTreeMakerOpen(false);
              store.setVertexPaintTarget('forestTree');
            }}
          />
        )}

        {store.objectMakerOpen && (
          <ObjectMakerModal
            store={store}
            initialAssetId={store.objectMakerTargetAssetId}
            initialInventoryItemId={store.objectMakerInventoryItemId}
            onClose={() => store.setObjectMakerOpen(false)}
          />
        )}

        {store.plantMakerOpen && (
          <PlantMakerModal
            store={store}
            initialAssetId={store.plantMakerTargetAssetId}
            initialSection={store.plantMakerInitialSection}
            onClose={() => store.setPlantMakerOpen(false)}
          />
        )}

        {store.characterMakerOpen && (
          <CharacterMakerModal
            store={store}
            initialAssetId={store.characterMakerTargetAssetId}
            onClose={() => store.setCharacterMakerOpen(false)}
          />
        )}

        {store.monsterMakerOpen && (
          <MonsterBuilderModal
            store={store}
            initialBlueprint={store.monsterMakerInitialBlueprint}
            editingEntityId={store.monsterMakerTargetEntityId}
            onClose={() => store.setMonsterMakerOpen(false)}
          />
        )}

        {showingExportZip && (
          <ExportProjectZipModal store={store} onClose={() => setShowingExportZip(false)} />
        )}

        {aiPanelState.isOpen &&
          (store.treeMakerOpen ||
            store.objectMakerOpen ||
            store.plantMakerOpen ||
            store.characterMakerOpen ||
            store.monsterMakerOpen ||
            store.showingTextureStudio ||
            store.vertexPaintTarget !== null) && (
            <ContextualAiModal
              store={store}
              initialContext={aiPanelState.preferredContext}
              onClose={() => setContextualAiPanelOpen(false)}
            />
          )}

        {store.isPlaying && <PersistentMinimapHUD store={store} />}
      </Profiler>

      {store.isPlaying && (
        <Profiler id="EditorShell.PlayMode" onRender={onEditorProfilerRender}>
          <PlayModeView store={store} />
        </Profiler>
      )}
    </div>
  );
};
