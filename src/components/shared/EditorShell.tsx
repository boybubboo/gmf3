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
  { id: 'world', title: 'World', symbol: 'map.fill', accent: '#20B46A' },
  { id: 'cast', title: 'Cast', symbol: 'person.2.fill', accent: '#0EA5E9' },
  { id: 'motion', title: 'Motion', symbol: 'motion.studio', accent: '#7C5CFF' },
  { id: 'logic', title: 'Logic', symbol: 'arrow.triangle.branch', accent: '#A855F7' },
  { id: 'interface', title: 'Interface', symbol: 'slider.horizontal.3', accent: '#F59E0B' },
];

const AUTO_SAVE_DEBOUNCE_MS = 600;
const EDITOR_AUTOSAVE_META_KEY = 'maker.autosave.meta.v1';

export const EditorShell: React.FC<{ store: MakerStore }> = ({ store }) => {
  const { currentProject, currentLevel, saveProjectStateNow } = store;
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [showingExportZip, setShowingExportZip] = useState(false);
  const aiPanelState = useContextualAiPanelState();

  const lastProjectIdRef = useRef<string | null>(null);
  const lastSeenProjectRef = useRef(currentProject);
  const pendingAutoSaveRef = useRef(false);
  const autoSaveTimerRef = useRef<number | null>(null);

  useEditorResourceMonitor({
    stage: store.selectedTab,
    projectId: currentProject?.id ?? null,
  });

  // Debounced auto-save: persists project state to localStorage after edits settle
  useEffect(() => {
    if (!currentProject) {
      lastProjectIdRef.current = null;
      lastSeenProjectRef.current = null;
      pendingAutoSaveRef.current = false;
      return;
    }

    if (lastProjectIdRef.current !== currentProject.id) {
      lastProjectIdRef.current = currentProject.id;
      lastSeenProjectRef.current = currentProject;
      pendingAutoSaveRef.current = false;
      return;
    }

    if (lastSeenProjectRef.current === currentProject) {
      return;
    }
    lastSeenProjectRef.current = currentProject;
    pendingAutoSaveRef.current = true;

    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
    }

    const levelId = currentLevel?.id ?? null;
    const tab = store.selectedTab;
    const projectId = currentProject.id;

    autoSaveTimerRef.current = window.setTimeout(() => {
      autoSaveTimerRef.current = null;
      pendingAutoSaveRef.current = false;
      saveProjectStateNow(true);
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
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (autoSaveTimerRef.current !== null) {
        window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [currentProject, currentLevel?.id, store.selectedTab, saveProjectStateNow]);

  useEffect(() => {
    const flushPending = () => {
      if (!pendingAutoSaveRef.current) return;
      if (autoSaveTimerRef.current !== null) {
        window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      pendingAutoSaveRef.current = false;
      saveProjectStateNow(true);
    };
    window.addEventListener('pagehide', flushPending);
    return () => {
      window.removeEventListener('pagehide', flushPending);
      flushPending();
    };
  }, [saveProjectStateNow]);

  if (!currentProject) return null;

  const activeTimePreset = currentLevel ? detectTimeOfDayPreset(currentLevel) : 'noon';

  const hasBlockingPublishIssue = store.issues.some((i) => i.isBlocking);

  return (
    <div className="h-dvh min-h-0 flex flex-col bg-[#F4F5F8] dark:bg-[#0F1117] text-slate-900 dark:text-[#F3F5FA] overflow-hidden transition-colors">
      {/* Unified Top Bar: Project + 5 Color-Coded Stages + Create / Atmosphere / Utilities / Play */}
      <Profiler id="EditorShell.Header" onRender={onEditorProfilerRender}>
        <header className="shrink-0 bg-white dark:bg-[#171A23] border-b border-slate-200/80 dark:border-white/[0.08] px-3 py-1.5 flex items-center justify-between gap-2 z-30">
          {/* Left: Back + Concise Project Title */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => store.closeProject()}
              title="All games"
              aria-label="Back to all games"
              className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-[#1F2430] text-[#7C5CFF] flex items-center justify-center hover:bg-slate-200 dark:hover:bg-[#272D3C] shrink-0"
            >
              <ChevronLeft size={16} strokeWidth={2.6} />
            </button>

            <h1 className="hidden lg:block text-sm font-black tracking-tight truncate max-w-[155px]">
              {currentProject.name}
            </h1>
          </div>

          {/* Center: Clean 5-Stage Bar with Bold Colored Typography (No Scrolling) */}
          <nav
            aria-label="Editor Stages"
            className="flex items-center justify-center gap-1 sm:gap-1.5 min-w-0 shrink-0"
          >
            {STAGE_TABS.map((tab) => {
              const active = store.selectedTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => store.setSelectedTab(tab.id)}
                  className={`relative flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-[13px] font-black tracking-tight transition-all shrink-0 whitespace-nowrap ${
                    active
                      ? 'bg-slate-100/90 dark:bg-[#1F2430]'
                      : 'hover:bg-slate-100/70 dark:hover:bg-[#1F2430]/70 opacity-85 hover:opacity-100'
                  }`}
                  style={{
                    color: tab.accent,
                    boxShadow: active ? `inset 0 0 0 1px ${tab.accent}40` : undefined,
                  }}
                >
                  <MakerIcon
                    symbol={tab.symbol}
                    size={14}
                    color={tab.accent}
                  />
                  <span>{tab.title}</span>
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute left-3 right-3 -bottom-[6px] h-[2.5px] rounded-full"
                      style={{ backgroundColor: tab.accent }}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right: AI Creator + Create Menu + Atmosphere + Global Utilities + Play */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => toggleContextualAiPanel()}
              title="Contextual AI Creator & Preferences (opens in left column)"
              aria-label="Toggle Contextual AI Creator"
              aria-pressed={aiPanelState.isOpen}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-colors shrink-0 ${
                aiPanelState.isOpen
                  ? 'bg-gradient-to-r from-[#7C5CFF] to-[#EC4899] text-white shadow-sm'
                  : 'bg-[#7C5CFF]/15 text-[#7C5CFF] dark:text-[#C4B5FD] hover:bg-[#7C5CFF]/25 border border-[#7C5CFF]/30'
              }`}
            >
              <Wand2 size={13} />
              <Sparkles size={11} className="text-[#F59E0B]" />
              <span className="hidden md:inline">AI</span>
            </button>

            {/* Global Create Maker Studio Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setCreateMenuOpen((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-colors ${
                  createMenuOpen
                    ? 'bg-[#7C5CFF] text-white'
                    : 'bg-[#7C5CFF]/15 text-[#7C5CFF] hover:bg-[#7C5CFF]/25'
                }`}
              >
                <Wand2 size={13} />
                <span>Create</span>
                <ChevronDown size={11} />
              </button>

              {createMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setCreateMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-60 rounded-2xl bg-white dark:bg-[#171A23] shadow-2xl border border-slate-200/80 dark:border-white/[0.1] py-1.5 z-30">
                    <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
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
                        desc: 'Animals, multi-limb beasts & abilities',
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
                          className="w-full px-3 py-2 flex items-center gap-2.5 text-left hover:bg-slate-100 dark:hover:bg-[#1F2430]"
                        >
                          <span
                            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${item.color}20`, color: item.color }}
                          >
                            <Icon size={14} />
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold leading-tight">{item.label}</div>
                            <div className="text-[10px] text-slate-500 dark:text-[#949BB0]">
                              {item.desc}
                            </div>
                          </div>
                        </button>
                      );
                    })}

                    <div className="my-1 border-t border-slate-200/70 dark:border-white/[0.08]" />
                    <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      Surfaces &amp; Tools
                    </div>
                    {[
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
                          className="w-full px-3 py-1.5 flex items-center gap-2 text-left text-xs font-bold hover:bg-slate-100 dark:hover:bg-[#1F2430]"
                        >
                          <Icon size={13} style={{ color: item.color }} />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Atmosphere, Sky, Style & Distant Vista Drawer */}
            <button
              type="button"
              onClick={() => store.setShowingAtmosphereDrawer(!store.showingAtmosphereDrawer)}
              title="Atmosphere, Time of Day, Skybox, Style & Distant Vista"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold shrink-0 whitespace-nowrap transition-colors ${
                store.showingAtmosphereDrawer
                  ? 'bg-[#38BDF8]/20 text-[#0284C7] dark:text-[#38BDF8] ring-1 ring-[#38BDF8]/40'
                  : 'bg-slate-100 dark:bg-[#1F2430] hover:bg-slate-200 dark:hover:bg-[#272D3C]'
              }`}
            >
              <TimeOfDayIcon
                preset={activeTimePreset}
                size={13}
                className={
                  activeTimePreset === 'night'
                    ? 'text-[#818CF8]'
                    : activeTimePreset === 'noon'
                    ? 'text-[#0EA5E9] dark:text-[#38BDF8]'
                    : 'text-[#F59E0B]'
                }
              />
              <span className="hidden 2xl:inline">Atmosphere</span>
              <CloudSun size={11} className="hidden sm:inline opacity-70" />
            </button>

            <button
              type="button"
              onClick={() => store.setShowingDirector(true)}
              title="Story Director — Camera cutaways & skits"
              className="hidden xl:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1F2430] hover:bg-slate-200 dark:hover:bg-[#272D3C] text-xs font-bold shrink-0 whitespace-nowrap"
            >
              <Clapperboard size={13} className="text-[#F59E0B]" />
              <span className="hidden 2xl:inline">Director</span>
            </button>

            {/* Save (Green Disc) + Publish (Icon-only Airplane) */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => store.setShowingPresets(true)}
                title="Save & Load Presets"
                aria-label="Save & Load Presets"
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-[#1F2430] hover:bg-slate-200 dark:hover:bg-[#272D3C] flex items-center justify-center shrink-0 transition-colors"
              >
                <Save size={14} className="text-[#20B46A]" />
              </button>

              <button
                type="button"
                onClick={() => store.setShowingPublish(true)}
                title="Publish & Share Game"
                aria-label="Publish & Share Game"
                className={`relative w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                  store.showingPublish
                    ? 'bg-[#0EA5E9] text-white'
                    : 'bg-slate-100 dark:bg-[#1F2430] hover:bg-[#0EA5E9]/15 text-[#0EA5E9]'
                }`}
              >
                <MakerIcon
                  symbol="paperplane.fill"
                  size={14}
                  color={store.showingPublish ? '#FFFFFF' : '#0EA5E9'}
                />
                {hasBlockingPublishIssue && !store.showingPublish && (
                  <span
                    aria-hidden="true"
                    className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#F59E0B]"
                  />
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={() => store.setShowingAssetVault(true)}
              title="3D Asset Vault (GLB)"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1F2430] hover:bg-slate-200 dark:hover:bg-[#272D3C] text-xs font-bold shrink-0 whitespace-nowrap"
            >
              <Box size={13} className="text-[#7C5CFF]" />
              <span className="tabular-nums text-[11px]">{store.customAssets.length}</span>
            </button>

            <button
              type="button"
              onClick={() => store.setShowingIdeas(true)}
              title="Ideas Coach"
              className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-[#1F2430] text-[#F59E0B] flex items-center justify-center hover:bg-slate-200 dark:hover:bg-[#272D3C] shrink-0"
            >
              <Lightbulb size={15} />
            </button>

            <div className="hidden lg:block">
              <ThemeToggle theme={store.theme} onChange={store.setTheme} compact />
            </div>

            <div className="hidden sm:flex items-center gap-1">
              <button
                type="button"
                disabled={!store.canUndo}
                onClick={() => store.undo()}
                title={store.canUndo ? `Undo ${store.undoLabel}` : 'Undo'}
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-[#1F2430] flex items-center justify-center disabled:opacity-35 text-slate-500 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white"
              >
                <Undo2 size={14} />
              </button>
              <button
                type="button"
                disabled={!store.canRedo}
                onClick={() => store.redo()}
                title="Redo"
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-[#1F2430] flex items-center justify-center disabled:opacity-35 text-slate-500 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white"
              >
                <Redo2 size={14} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowingExportZip(true)}
              title="Export adventure ZIP"
              className="w-8 h-8 sm:w-auto sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-100 dark:bg-[#1F2430] hover:bg-slate-200 dark:hover:bg-[#272D3C] text-xs font-bold inline-flex items-center justify-center gap-1 shrink-0 whitespace-nowrap"
            >
              <FileArchive size={13} className="text-[#7C5CFF]" />
              <span className="hidden xl:inline">Export</span>
            </button>

            <button
              type="button"
              onClick={() => {
                store.setPlayFromPoint(null);
                store.setIsPlaying(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#20B46A] text-white text-xs font-extrabold hover:opacity-95 shadow-sm shadow-[#20B46A]/25 shrink-0 whitespace-nowrap"
            >
              <Play size={12} fill="currentColor" />
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
        <AtmosphereDrawer store={store} />
        <EntityAttributeModal store={store} />

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
