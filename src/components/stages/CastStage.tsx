import React, { useState } from 'react';
import { Box, MessageCircle, Paintbrush, PanelBottom, Plus, SlidersHorizontal, Sparkles, Trash2, Upload, User } from 'lucide-react';
import {
  getChatFontOption,
  resolveChatBubbleStyle,
  resolveChatDisplaySettings,
} from '../../data/chatBubblePresets';
import {
  EntityKindMeta,
  EntitySectionMeta,
  MisfitAbilityCatalog,
  PresetLibrary,
} from '../../data/registries';
import { resolveHeroProfile } from '../../data/heroTraits';
import type { MakerStore } from '../../store/useMakerStore';
import type {
  CreatureBodyId,
  CritterAttitude,
  CritterWarmTrigger,
  LevelEntity,
  MisfitAbilityId,
  PlatformMotionType,
  PlatformPreset,
} from '../../types/maker';
import { PlatformMotion } from '../../utils/terrain';
import { AddEntityModal } from '../shared/AddEntityModal';
import { AssetThumbnail } from '../shared/AssetThumbnail';
import { ChatBubbleView } from '../shared/ChatBubbleRenderer';
import { ChatBubbleStudioModal, type ChatStudioTarget } from '../shared/ChatBubbleStudioModal';
import { DialogueVoiceEditor } from '../shared/DialogueVoiceEditor';
import { EntityItemAssignPanel } from '../shared/EntityItemAssignPanel';
import { MakerIcon } from '../shared/IconMap';
import { EmptyHint, FieldLabel, MakerCard } from '../shared/MakerUI';
import { VertexPaintModal } from '../world/VertexPaintModal';
import { CastScaleViewport3D } from './CastScaleViewport3D';
import { HeroInspector } from './HeroInspector';
import {
  setContextualAiPanelOpen,
  useContextualAiPanelState,
} from '../../ai/studioBridge';
import { ContextualAiPanel } from '../shared/ContextualAiModal';

export const CastStage: React.FC<{ store: MakerStore }> = ({ store }) => {
  const { currentProject, currentLevel, currentEntity, selectedSection, setSelectedSection } = store;
  const aiPanelState = useContextualAiPanelState();
  const [showingAdd, setShowingAdd] = useState(false);
  const [focusedTarget, setFocusedTarget] = useState<'hero' | 'entity'>('hero');
  const [vertexPaintEntityId, setVertexPaintEntityId] = useState<string | null>(null);
  const [chatStudioState, setChatStudioState] = useState<{
    target: ChatStudioTarget;
    tab?: 'bubble' | 'panel';
  } | null>(null);

  if (!currentProject || !currentLevel) return null;

  const sectionEntities = currentLevel.entities.filter(
    (e) => EntityKindMeta[e.kind].section === selectedSection
  );

  const heroCustomAsset = currentProject.heroCustomAssetId
    ? store.customAssets.find((a) => a.id === currentProject.heroCustomAssetId)
    : null;
  const heroProfile = resolveHeroProfile(currentProject);
  const heroSelected = focusedTarget === 'hero' || !currentEntity;

  return (
    <div className="h-full min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden maker-scroll">
      {/* Left Sidebar: AI Creator OR Sections + list */}
      {aiPanelState.isOpen ? (
        <aside className="w-full lg:w-80 shrink-0 lg:h-full lg:min-h-0 bg-white dark:bg-[#171A23] border-b lg:border-b-0 lg:border-r border-slate-200/80 dark:border-white/[0.08] overflow-hidden flex flex-col">
          <ContextualAiPanel
            store={store}
            initialContext={aiPanelState.preferredContext}
            embedded
            onClose={() => setContextualAiPanelOpen(false)}
          />
        </aside>
      ) : (
        <aside className="w-full lg:w-72 shrink-0 lg:h-full lg:min-h-0 bg-white dark:bg-[#171A23] border-b lg:border-b-0 lg:border-r border-slate-200/80 dark:border-white/[0.08] lg:overflow-y-auto maker-scroll p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold">What is here</h2>
          <button
            type="button"
            onClick={() => setShowingAdd(true)}
            className="w-8 h-8 rounded-xl bg-[#7C5CFF]/15 text-[#7C5CFF] flex items-center justify-center hover:bg-[#7C5CFF]/25"
            title="Add something"
          >
            <Plus size={16} strokeWidth={2.5} />
          </button>
        </div>

        <div className="grid grid-cols-3 lg:grid-cols-2 gap-2">
          {EntitySectionMeta.map((sec) => {
            const rawCount = currentLevel.entities.filter((e) => EntityKindMeta[e.kind].section === sec.id).length;
            const count = sec.id === 'cast' ? rawCount + 1 : rawCount;
            const active = selectedSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => {
                  setSelectedSection(sec.id);
                  if (sec.id === 'cast') {
                    store.setSelectedEntityID(null);
                    setFocusedTarget('hero');
                  } else {
                    const first = currentLevel.entities.find((e) => EntityKindMeta[e.kind].section === sec.id);
                    store.setSelectedEntityID(first?.id ?? null);
                    setFocusedTarget(first ? 'entity' : 'hero');
                  }
                }}
                className={`p-2.5 rounded-2xl text-center border transition-all ${
                  active
                    ? 'bg-[#7C5CFF]/15 border-[#7C5CFF] text-slate-900 dark:text-white'
                    : 'bg-slate-100 dark:bg-[#1F2430] border-transparent text-slate-600 dark:text-[#949BB0]'
                }`}
              >
                <div className="flex justify-center mb-1">
                  <MakerIcon symbol={sec.symbol} size={16} color={active ? '#7C5CFF' : 'currentColor'} />
                </div>
                <div className="text-[11px] font-bold">{sec.title}</div>
                <div className="text-[10px] text-slate-400 dark:text-[#6B7285] tabular-nums">{count}</div>
              </button>
            );
          })}
        </div>

        <div className="pt-2 border-t border-slate-200/70 dark:border-white/[0.08] space-y-1.5">
          <div className="text-xs font-extrabold">
            {EntitySectionMeta.find((s) => s.id === selectedSection)?.title}
          </div>

          {selectedSection === 'cast' && (
            <button
              type="button"
              onClick={() => {
                store.setSelectedEntityID(null);
                setFocusedTarget('hero');
              }}
              className={`w-full flex items-center gap-2.5 p-2 rounded-xl border text-left transition-colors ${
                heroSelected
                  ? 'bg-[#7C5CFF]/15 border-[#7C5CFF]/60'
                  : 'border-transparent hover:bg-slate-100 dark:hover:bg-[#1F2430]'
              }`}
            >
              <AssetThumbnail
                customAsset={heroCustomAsset}
                hero={{
                  body: currentProject.heroBody,
                  colors: currentProject.heroColors,
                }}
                size={36}
                rounded="rounded-lg"
                alt={currentProject.heroName}
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-extrabold truncate">{currentProject.heroName}</div>
                <div className="text-[11px] text-slate-500 dark:text-[#949BB0] truncate tabular-nums">
                  Hero · {heroProfile.stats.maxHealth} HP · {heroProfile.skills.length} skills
                </div>
              </div>
            </button>
          )}

          {sectionEntities.length === 0 && selectedSection !== 'cast' ? (
            <p className="text-xs text-slate-500 dark:text-[#949BB0]">Nothing here yet.</p>
          ) : (
            sectionEntities.map((ent) => {
              const meta = EntityKindMeta[ent.kind];
              const selected = !heroSelected && ent.id === store.selectedEntityID;
              const entCustom = ent.customAssetId
                ? store.customAssets.find((a) => a.id === ent.customAssetId) ?? null
                : null;
              return (
                <button
                  key={ent.id}
                  type="button"
                  onClick={() => {
                    store.setSelectedEntityID(ent.id);
                    setFocusedTarget('entity');
                  }}
                  className={`w-full flex items-center gap-2.5 p-2 rounded-xl border text-left transition-colors ${
                    selected
                      ? 'bg-[#7C5CFF]/15 border-[#7C5CFF]/50'
                      : 'border-transparent hover:bg-slate-100 dark:hover:bg-[#1F2430]'
                  }`}
                >
                  <AssetThumbnail
                    entity={ent}
                    customAsset={entCustom}
                    size={36}
                    rounded="rounded-lg"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold truncate">{ent.name}</div>
                    <div className="text-[11px] text-slate-500 dark:text-[#949BB0] truncate">
                      {meta.title}
                      {ent.customAssetId ? ' · 3D GLB' : ''}
                    </div>
                  </div>
                  {ent.cards.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-lg bg-[#A855F7]/15 text-[#A855F7] text-[10px] font-bold">
                      {ent.cards.length}
                    </span>
                  )}
                </button>
              );
            })
          )}

          <button
            type="button"
            onClick={() => setShowingAdd(true)}
            className="w-full mt-2 py-2.5 rounded-xl bg-[#7C5CFF]/15 text-[#7C5CFF] text-xs font-bold hover:bg-[#7C5CFF]/25 inline-flex items-center justify-center gap-1.5"
          >
            <Plus size={14} />
            <span>Add something</span>
          </button>

          <button
            type="button"
            onClick={() => store.openMonsterMaker()}
            className="w-full py-2.5 rounded-xl bg-[#EC4899]/15 text-[#EC4899] text-xs font-extrabold hover:bg-[#EC4899]/25 inline-flex items-center justify-center gap-1.5"
          >
            <Sparkles size={14} />
            <span>Design 4-Legged Monster</span>
          </button>
        </div>
        </aside>
      )}

      {/* Center Content: 3D Scale Stage + Hero card + Grid */}
      <main className="shrink-0 lg:shrink lg:flex-1 lg:h-full lg:min-h-0 lg:min-w-0 lg:overflow-y-auto maker-scroll p-4 sm:p-6 space-y-5">
        {/* Interactive 3D Cast Scale Comparison Stage */}
        <MakerCard className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-extrabold">3D Cast &amp; Conifer Scale Preview</h2>
              <p className="text-[11px] text-slate-500 dark:text-[#949BB0]">
                Rotate &amp; scale {focusedTarget === 'entity' && currentEntity ? currentEntity.name : currentProject.heroName} beside your world&apos;s conifer tree (this game only — saved Character Maker presets stay unchanged).
              </p>
            </div>
          </div>

          <CastScaleViewport3D
            project={currentProject}
            level={currentLevel}
            customAssets={store.customAssets}
            focusedTarget={focusedTarget}
            selectedEntity={currentEntity}
            onSelectTarget={(next) => {
              setFocusedTarget(next);
              if (next === 'hero') {
                store.setSelectedEntityID(null);
              }
            }}
          />

          {/* Quick World Scale Control linked directly to focused 3D character */}
          {(() => {
            const previewingEntity = focusedTarget === 'entity' && Boolean(currentEntity);
            const ent = previewingEntity ? currentEntity : null;
            const activeScale = ent
              ? ent.customAssetId
                ? ent.modelScaleAdjust ?? 1
                : ent.scale
              : currentProject.heroModelScale ?? 1;
            const setActiveScale = (val: number) => {
              if (ent) {
                store.updateEntity(
                  ent.id,
                  'world scale adjust',
                  (prev) =>
                    prev.customAssetId
                      ? { ...prev, modelScaleAdjust: val }
                      : { ...prev, scale: val },
                  false
                );
              } else {
                store.updateProject(
                  'hero world scale',
                  (p) => ({ ...p, heroModelScale: val }),
                  false
                );
              }
            };
            return (
              <div className="flex flex-wrap items-center gap-3 p-2.5 rounded-xl bg-slate-100 dark:bg-[#1F2430]">
                <div className="min-w-[140px]">
                  <div className="text-[11px] font-extrabold">
                    World Scale ({ent ? ent.name : currentProject.heroName})
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-[#949BB0]">
                    Game-only size vs conifer tree
                  </div>
                </div>
                <input
                  type="range"
                  min={0.25}
                  max={3.5}
                  step={0.05}
                  value={activeScale}
                  onChange={(e) => setActiveScale(Number(e.target.value))}
                  className="flex-1 min-w-[140px] accent-[#7C5CFF]"
                />
                <span className="text-xs font-extrabold tabular-nums w-12 text-right">
                  {activeScale.toFixed(2)}×
                </span>
                <button
                  type="button"
                  onClick={() => setActiveScale(1)}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.08] text-[11px] font-bold hover:border-[#7C5CFF]"
                >
                  Reset 1×
                </button>
              </div>
            );
          })()}
        </MakerCard>

        {/* Hero Card */}
        <MakerCard
          className={`space-y-4 ${
            heroSelected ? 'ring-2 ring-[#7C5CFF]/35 border-[#7C5CFF]/60' : ''
          }`}
        >
          <div
            className="flex flex-wrap items-center gap-4 cursor-pointer"
            onClick={() => {
              store.setSelectedEntityID(null);
              setFocusedTarget('hero');
            }}
          >
            <AssetThumbnail
              customAsset={heroCustomAsset}
              hero={{
                body: currentProject.heroBody,
                colors: currentProject.heroColors,
              }}
              size={58}
              rounded="rounded-2xl"
              alt={currentProject.heroName}
            />
            <div className="flex-1 min-w-[160px]">
              <FieldLabel text="Your Hero" />
              <input
                type="text"
                value={currentProject.heroName}
                onChange={(e) =>
                  store.updateProject('rename hero', (p) => ({ ...p, heroName: e.target.value }), false)
                }
                className="text-lg font-extrabold bg-transparent focus:outline-none border-b border-transparent focus:border-[#7C5CFF] w-full"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={currentProject.heroBody}
                onChange={(e) =>
                  store.updateProject('change hero look', (p) => ({ ...p, heroBody: e.target.value }))
                }
                className="px-3.5 py-2 rounded-xl bg-[#7C5CFF]/15 text-[#7C5CFF] text-xs font-bold focus:outline-none"
              >
                {PresetLibrary.heroBodies.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Hero colors */}
          <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-200/70 dark:border-white/[0.08]">
            {(
              [
                { key: 'tunic', label: 'Tunic' },
                { key: 'cloak', label: 'Cloak' },
                { key: 'hair', label: 'Hair' },
                { key: 'skin', label: 'Skin' },
              ] as const
            ).map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-[#949BB0]">
                <span>{label}</span>
                <input
                  type="color"
                  value={currentProject.heroColors[key]}
                  onChange={(e) =>
                    store.updateProject(
                      'change hero color',
                      (p) => ({
                        ...p,
                        heroColors: { ...p.heroColors, [key]: e.target.value },
                      }),
                      false
                    )
                  }
                  className="w-7 h-7 rounded-lg border-0 bg-transparent cursor-pointer"
                />
              </label>
            ))}

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setChatStudioState({ target: 'hero', tab: 'bubble' })}
                className="px-3.5 py-1.5 rounded-xl bg-[#7C5CFF]/15 text-[#7C5CFF] text-xs font-bold hover:bg-[#7C5CFF]/25 inline-flex items-center gap-1.5"
              >
                <MessageCircle size={13} />
                <span>Hero Chat Bubble</span>
              </button>
              <button
                type="button"
                onClick={() => store.openHeroActions()}
                className="px-3.5 py-1.5 rounded-xl bg-[#F59E0B]/15 text-[#F59E0B] text-xs font-bold hover:bg-[#F59E0B]/25"
              >
                Change their moves →
              </button>
            </div>
          </div>

          {/* Hero Custom Tripo 3D Rig Binding */}
          <div className="pt-3 border-t border-slate-200/70 dark:border-white/[0.08] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Box size={14} className="text-[#7C5CFF]" />
                <span className="text-xs font-extrabold">3D Model Source</span>
                <span className="text-[11px] text-slate-500 dark:text-[#949BB0]">
                  {heroCustomAsset
                    ? `Using rigged GLB: ${heroCustomAsset.name}`
                    : 'Using native placeholder rig'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={currentProject.heroCustomAssetId ?? ''}
                  onChange={(e) =>
                    store.updateProject('change hero 3D model', (p) => ({
                      ...p,
                      heroCustomAssetId: e.target.value || undefined,
                    }))
                  }
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1F2430] text-xs font-bold border border-slate-200/60 dark:border-white/[0.08]"
                >
                  <option value="">Native Look ({currentProject.heroBody})</option>
                  {store.customAssets.map((a) => (
                    <option key={a.id} value={a.id}>
                      GLB: {a.name} ({a.animationClips.length} clips)
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() =>
                    heroCustomAsset?.category === 'character'
                      ? store.openCharacterMaker(heroCustomAsset.id)
                      : store.openCharacterMaker()
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#A855F7] text-white text-xs font-bold hover:bg-[#9333EA] whitespace-nowrap"
                >
                  <User size={12} />
                  <span>
                    {heroCustomAsset?.category === 'character'
                      ? 'Edit in Character Maker'
                      : 'Character Maker'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => store.setShowingAssetVault(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#7C5CFF] text-white text-xs font-bold hover:bg-[#6A48F5] whitespace-nowrap"
                >
                  <Upload size={12} />
                  <span>Upload .glb</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-100 dark:bg-[#1F2430]">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-semibold">
                  <span>World Scale (This Game)</span>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums">{(currentProject.heroModelScale ?? 1).toFixed(2)}×</span>
                    {(currentProject.heroModelScale ?? 1) !== 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          store.updateProject('reset hero scale', (p) => ({ ...p, heroModelScale: 1 }))
                        }
                        className="text-[10px] font-bold text-[#7C5CFF] hover:underline"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="range"
                  min={0.25}
                  max={3.5}
                  step={0.05}
                  value={currentProject.heroModelScale ?? 1}
                  onChange={(e) => {
                    setFocusedTarget('hero');
                    store.updateProject(
                      'hero model scale',
                      (p) => ({ ...p, heroModelScale: Number(e.target.value) }),
                      false
                    );
                  }}
                  className="w-full accent-[#7C5CFF]"
                />
              </div>
              {heroCustomAsset ? (
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-semibold">
                    <span>Animation Speed</span>
                    <span className="tabular-nums">{(currentProject.heroAnimSpeed ?? 1).toFixed(1)}×</span>
                  </div>
                  <input
                    type="range"
                    min={0.4}
                    max={2.4}
                    step={0.1}
                    value={currentProject.heroAnimSpeed ?? 1}
                    onChange={(e) =>
                      store.updateProject(
                        'hero anim speed',
                        (p) => ({ ...p, heroAnimSpeed: Number(e.target.value) }),
                        false
                      )
                    }
                    className="w-full accent-[#7C5CFF]"
                  />
                </div>
              ) : (
                <div className="flex items-center text-[11px] text-slate-500 dark:text-[#949BB0]">
                  Sizes your hero relative to trees &amp; props in this project without altering saved character recipes.
                </div>
              )}
            </div>
          </div>
        </MakerCard>

        {/* Section Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-extrabold">
                {EntitySectionMeta.find((s) => s.id === selectedSection)?.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#949BB0]">
                {EntitySectionMeta.find((s) => s.id === selectedSection)?.blurb}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => store.openMonsterMaker()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#EC4899]/15 text-[#EC4899] hover:bg-[#EC4899]/25 text-xs font-extrabold"
              >
                <Sparkles size={13} />
                <span>Creature Maker</span>
              </button>
              <button
                type="button"
                onClick={() => setShowingAdd(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#7C5CFF]/15 text-[#7C5CFF] text-xs font-bold"
              >
                <Plus size={13} />
                <span>Add</span>
              </button>
            </div>
          </div>

          {(currentProject.customMonsters?.length ?? 0) > 0 && selectedSection === 'cast' && (
            <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#949BB0]">
                  Saved Animals &amp; Monsters
                </span>
                <button
                  type="button"
                  onClick={() => store.openMonsterMaker()}
                  className="text-[11px] font-bold text-[#EC4899] hover:underline"
                >
                  + Create New
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(currentProject.customMonsters ?? []).map((mon) => (
                  <div
                    key={mon.id}
                    className="flex items-center gap-2 pl-2 pr-1.5 py-1.5 rounded-xl bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.08]"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        store.openMonsterMaker({ blueprint: mon });
                      }}
                      className="text-left hover:text-[#EC4899] transition-colors"
                      title="Edit monster design"
                    >
                      <div className="text-xs font-bold leading-tight">{mon.name}</div>
                      <div className="text-[10px] text-slate-500 dark:text-[#949BB0]">
                        {mon.legPairs * 2}L · {mon.headCount}H{mon.canFly ? ' · Flies' : ''}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        store.spawnMonsterEntity(mon);
                        setSelectedSection('cast');
                        setFocusedTarget('entity');
                      }}
                      className="px-2 py-1 rounded-lg bg-[#7C5CFF]/15 text-[#7C5CFF] hover:bg-[#7C5CFF]/25 text-[10px] font-extrabold"
                      title="Place into level"
                    >
                      + Place
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {sectionEntities.length === 0 ? (
            <MakerCard>
              <EmptyHint
                symbol={EntitySectionMeta.find((s) => s.id === selectedSection)?.symbol ?? 'cube.fill'}
                title={`Nothing in ${EntitySectionMeta.find((s) => s.id === selectedSection)?.title.toLowerCase()} yet`}
                message={EntitySectionMeta.find((s) => s.id === selectedSection)?.blurb ?? ''}
                actionTitle="Add something"
                onAction={() => setShowingAdd(true)}
              />
            </MakerCard>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {sectionEntities.map((ent) => {
                const meta = EntityKindMeta[ent.kind];
                const selected = ent.id === store.selectedEntityID;
                const entCustom = ent.customAssetId
                  ? store.customAssets.find((a) => a.id === ent.customAssetId) ?? null
                  : null;
                return (
                  <button
                    key={ent.id}
                    type="button"
                    onClick={() => {
                      store.setSelectedEntityID(ent.id);
                      setFocusedTarget('entity');
                    }}
                    className={`p-3.5 rounded-2xl bg-white dark:bg-[#171A23] border text-left transition-all ${
                      selected
                        ? 'border-[#7C5CFF] ring-2 ring-[#7C5CFF]/25'
                        : 'border-slate-200/80 dark:border-white/[0.08] hover:border-[#7C5CFF]/50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2.5">
                      <AssetThumbnail
                        entity={ent}
                        customAsset={entCustom}
                        size={52}
                        rounded="rounded-xl"
                      />
                      {ent.customAssetId && (
                        <Box size={14} className="text-[#20B46A]" />
                      )}
                    </div>
                    <div className="text-sm font-bold truncate">{ent.name}</div>
                    <div className="text-[11px] text-slate-500 dark:text-[#949BB0]">
                      {meta.title}
                      {ent.cards.length > 0 ? ` · ${ent.cards.length} rules` : ''}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Right Inspector: Contextual Hero or Selected Entity Editor */}
      <aside className="w-full lg:w-[360px] shrink-0 lg:h-full lg:min-h-0 bg-white dark:bg-[#171A23] border-t lg:border-t-0 lg:border-l border-slate-200/80 dark:border-white/[0.08] lg:overflow-y-auto maker-scroll p-4 space-y-4">
        {!heroSelected && currentEntity ? (
          <EntityInspector
            entity={currentEntity}
            store={store}
            onOpenVertexPainter={() => setVertexPaintEntityId(currentEntity.id)}
            onOpenChatStudio={(tab = 'bubble') =>
              setChatStudioState({ target: currentEntity.id, tab })
            }
          />
        ) : (
          <HeroInspector
            store={store}
            onOpenChatStudio={(tab = 'bubble') =>
              setChatStudioState({ target: 'hero', tab })
            }
          />
        )}
      </aside>

      {showingAdd && (
        <AddEntityModal
          savedMonsters={currentProject.customMonsters}
          onOpenMonsterStudio={() => {
            setShowingAdd(false);
            store.openMonsterMaker();
          }}
          onSpawnMonster={(mon) => {
            store.spawnMonsterEntity(mon);
            setSelectedSection('cast');
            setFocusedTarget('entity');
          }}
          onClose={() => setShowingAdd(false)}
          onAdd={(kind, name) => {
            const added = store.addEntity(kind, name);
            setSelectedSection(EntityKindMeta[added.kind].section);
            setFocusedTarget('entity');
          }}
        />
      )}

      {vertexPaintEntityId !== null && (
        <VertexPaintModal
          store={store}
          initialEntityId={vertexPaintEntityId}
          onClose={() => setVertexPaintEntityId(null)}
        />
      )}

      {chatStudioState !== null && (
        <ChatBubbleStudioModal
          store={store}
          initialTarget={chatStudioState.target}
          initialTab={chatStudioState.tab}
          onClose={() => setChatStudioState(null)}
        />
      )}
    </div>
  );
};

const EntityInspector: React.FC<{
  entity: LevelEntity;
  store: MakerStore;
  onOpenVertexPainter: () => void;
  onOpenChatStudio: (tab?: 'bubble' | 'panel') => void;
}> = ({ entity, store, onOpenVertexPainter, onOpenChatStudio }) => {
  const meta = EntityKindMeta[entity.kind];
  const boundAsset = entity.customAssetId
    ? store.customAssets.find((a) => a.id === entity.customAssetId)
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <AssetThumbnail
          entity={entity}
          customAsset={boundAsset}
          size={52}
          rounded="rounded-xl"
        />
        <div className="min-w-0 flex-1">
          <input
            type="text"
            value={entity.name}
            onChange={(e) =>
              store.updateEntity(entity.id, 'rename', (ent) => ({ ...ent, name: e.target.value }), false)
            }
            className="w-full text-base font-extrabold bg-transparent focus:outline-none border-b border-transparent focus:border-[#7C5CFF]"
          />
          <div className="text-[11px] font-semibold text-slate-500 dark:text-[#949BB0] mt-0.5">
            <span style={{ color: meta.tint }}>{meta.title}</span>
            {entity.isBoss && <span className="text-[#F59E0B]"> · Boss</span>}
            {entity.isBuddy && <span className="text-[#20B46A]"> · Buddy</span>}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => store.setAttributeModifierTarget({ kind: 'entity', entityId: entity.id })}
        className="w-full py-2.5 px-3 rounded-xl bg-[#7C5CFF] hover:bg-[#6A48F5] text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-xs transition-colors"
      >
        <SlidersHorizontal size={14} />
        <span>Edit Attributes, Role &amp; Dialogue</span>
      </button>

      {/* 3D Appearance (Native vs Custom GLB) */}
      <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2.5">
        <div className="flex items-center justify-between">
          <FieldLabel text="3D Appearance" />
          <button
            type="button"
            onClick={() => store.setShowingAssetVault(true)}
            className="text-[11px] font-bold text-[#7C5CFF] hover:underline"
          >
            Open Vault
          </button>
        </div>

        <select
          value={entity.customAssetId ?? ''}
          onChange={(e) =>
            store.updateEntity(entity.id, 'bind 3D model', (ent) => ({
              ...ent,
              customAssetId: e.target.value || undefined,
            }))
          }
          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#171A23] text-xs font-semibold border border-slate-200/70 dark:border-white/[0.08]"
        >
          <option value="">Built-in Look ({meta.title})</option>
          {store.customAssets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.category})
            </option>
          ))}
        </select>

        {/* Non-permanent World Scale Adjuster (for both Custom GLB & Built-in Cast) */}
        <div className="space-y-2 pt-1">
          {boundAsset && (
            <div className="text-[11px] text-slate-500 dark:text-[#949BB0]">
              {boundAsset.hasSkeleton ? 'Rigged' : 'Static mesh'} · {boundAsset.animationClips.length} clips
            </div>
          )}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <span>World Scale (This Game)</span>
              <div className="flex items-center gap-2">
                <span className="tabular-nums">
                  {(boundAsset ? entity.modelScaleAdjust ?? 1 : entity.scale).toFixed(2)}×
                </span>
                {(boundAsset ? entity.modelScaleAdjust ?? 1 : entity.scale) !== 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      store.updateEntity(
                        entity.id,
                        'reset entity world scale',
                        (ent) => (boundAsset ? { ...ent, modelScaleAdjust: 1 } : { ...ent, scale: 1 })
                      )
                    }
                    className="text-[10px] font-bold text-[#7C5CFF] hover:underline"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
            <input
              type="range"
              min={0.25}
              max={3.5}
              step={0.05}
              value={boundAsset ? entity.modelScaleAdjust ?? 1 : entity.scale}
              onChange={(e) => {
                const val = Number(e.target.value);
                store.updateEntity(
                  entity.id,
                  'model scale',
                  (ent) => (boundAsset ? { ...ent, modelScaleAdjust: val } : { ...ent, scale: val }),
                  false
                );
              }}
              className="w-full accent-[#7C5CFF]"
            />
          </div>
          {boundAsset && (
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-semibold">
                <span>Ground Height (Y)</span>
                <span>{(entity.modelOffsetY ?? 0).toFixed(2)}m</span>
              </div>
              <input
                type="range"
                min={-1}
                max={1.5}
                step={0.05}
                value={entity.modelOffsetY ?? 0}
                onChange={(e) =>
                  store.updateEntity(
                    entity.id,
                    'model offset Y',
                    (ent) => ({ ...ent, modelOffsetY: Number(e.target.value) }),
                    false
                  )
                }
                className="w-full accent-[#7C5CFF]"
              />
            </div>
          )}
        </div>

        {(boundAsset?.category === 'character' ||
          entity.kind === 'npc' ||
          entity.kind === 'baddie' ||
          entity.kind === 'hero') && (
          <button
            type="button"
            onClick={() =>
              boundAsset?.category === 'character'
                ? store.openCharacterMaker(boundAsset.id)
                : store.openCharacterMaker()
            }
            className="w-full py-2 rounded-xl bg-[#A855F7]/15 hover:bg-[#A855F7]/25 text-[#A855F7] text-xs font-extrabold inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <User size={13} />
            <span>
              {boundAsset?.category === 'character'
                ? 'Edit in Character Maker'
                : 'Create in Character Maker'}
            </span>
          </button>
        )}

        {(entity.kind === 'npc' || entity.kind === 'baddie') && (
          <button
            type="button"
            onClick={() =>
              store.openMonsterMaker({
                entityId: entity.id,
                blueprint: entity.monsterConfig ?? undefined,
              })
            }
            className="w-full py-2 rounded-xl bg-[#EC4899]/15 hover:bg-[#EC4899]/25 text-[#EC4899] text-xs font-extrabold inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Sparkles size={13} />
            <span>
              {entity.monsterConfig
                ? 'Edit Monster Parts & Wings'
                : 'Make 4-Legged Animal / Monster'}
            </span>
          </button>
        )}

        {entity.kind !== 'fxEmitter' && (
          <button
            type="button"
            onClick={onOpenVertexPainter}
            className="w-full py-2 rounded-xl bg-[#EC4899]/15 hover:bg-[#EC4899]/25 text-[#EC4899] text-xs font-bold inline-flex items-center justify-center gap-1.5"
          >
            <Paintbrush size={13} />
            <span>
              {entity.canopyTree ? 'Vertex Paint Leaves & Branches' : 'Vertex Paint 3D Object'}
            </span>
            {((entity.canopyTree?.vertexPaintStrokes?.length ?? 0) +
              (entity.vertexPaintStrokes?.length ?? 0)) > 0 && (
              <span className="tabular-nums text-[10px] opacity-85">
                (
                {(entity.canopyTree?.vertexPaintStrokes?.length ?? 0) +
                  (entity.vertexPaintStrokes?.length ?? 0)}
                )
              </span>
            )}
          </button>
        )}
      </div>

      {entity.kind === 'npc' && (
        <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2.5">
          <FieldLabel text="Creature & Buddy Role" />
          <select
            value={entity.creatureType ?? ''}
            onChange={(e) =>
              store.updateEntity(entity.id, 'change creature appearance', (ent) => ({
                ...ent,
                creatureType: (e.target.value || undefined) as CreatureBodyId | undefined,
              }))
            }
            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#171A23] text-xs font-semibold border border-slate-200/70 dark:border-white/[0.08]"
          >
            <option value="">Default Townsperson</option>
            <option value="Skunk">Skunk</option>
            <option value="Porcupine">Porcupine</option>
            <option value="Mole Rat">Mole Rat</option>
            <option value="Vulture">Vulture</option>
            <option value="Duckling">Duckling</option>
            <option value="Squirrel">Squirrel</option>
            <option value="Badger">Badger</option>
            <option value="Owl">Owl</option>
          </select>

          <label className="flex items-center justify-between text-xs font-semibold cursor-pointer pt-0.5">
            <span>Recruitable Buddy Companion</span>
            <input
              type="checkbox"
              checked={Boolean(entity.isBuddy)}
              onChange={(e) =>
                store.updateEntity(entity.id, 'toggle recruitable buddy', (ent) => ({
                  ...ent,
                  isBuddy: e.target.checked,
                }))
              }
              className="accent-[#20B46A] w-4 h-4"
            />
          </label>

          {entity.isBuddy ? (
            <div className="space-y-2 pt-0.5">
              <input
                type="text"
                value={entity.buddyAreaLabel ?? ''}
                onChange={(e) =>
                  store.updateEntity(
                    entity.id,
                    'edit buddy area label',
                    (ent) => ({ ...ent, buddyAreaLabel: e.target.value }),
                    false
                  )
                }
                placeholder="Detour area (e.g. Mountain Cave)"
                className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-xs font-medium border border-slate-200/70 dark:border-white/[0.08]"
              />
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-[#949BB0]">
                  Misfit power granted on join
                </span>
                <select
                  value={entity.misfitAbility ?? ''}
                  onChange={(e) =>
                    store.updateEntity(entity.id, 'set buddy misfit ability', (ent) => ({
                      ...ent,
                      misfitAbility: (e.target.value || undefined) as MisfitAbilityId | undefined,
                    }))
                  }
                  className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-xs font-semibold border border-slate-200/70 dark:border-white/[0.08]"
                >
                  <option value="">None (companion only)</option>
                  {MisfitAbilityCatalog.map((ab) => (
                    <option key={ab.id} value={ab.id}>
                      {ab.title} — {ab.strengthLabel}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="space-y-2 pt-2 border-t border-slate-200/70 dark:border-white/[0.08]">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-[#949BB0]">
                  Woodland Critter Reaction
                </span>
                <select
                  value={entity.critterAttitude ?? 'none'}
                  onChange={(e) => {
                    const nextAtt = e.target.value as CritterAttitude;
                    store.updateEntity(entity.id, 'set critter attitude', (ent) => ({
                      ...ent,
                      critterAttitude: nextAtt === 'none' ? undefined : nextAtt,
                      critterWarmOn:
                        nextAtt === 'none'
                          ? ent.critterWarmOn
                          : ent.critterWarmOn ?? 'nearbyPower',
                    }));
                  }}
                  className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-xs font-semibold border border-slate-200/70 dark:border-white/[0.08]"
                >
                  <option value="none">Friendly (no special attitude)</option>
                  <option value="teasing">Teasing / Scolding initially</option>
                  <option value="nervous">Shy / Backs away initially</option>
                  <option value="grumpy">Grumpy / Skeptical initially</option>
                </select>
              </div>

              {entity.critterAttitude && entity.critterAttitude !== 'none' && (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-[#949BB0]">
                      Warms up &amp; cheers when…
                    </span>
                    <select
                      value={entity.critterWarmOn ?? 'nearbyPower'}
                      onChange={(e) =>
                        store.updateEntity(entity.id, 'set critter warm trigger', (ent) => ({
                          ...ent,
                          critterWarmOn: e.target.value as CritterWarmTrigger,
                        }))
                      }
                      className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-xs font-semibold border border-slate-200/70 dark:border-white/[0.08]"
                    >
                      <option value="nearbyPower">Nearby Misfit power or puzzle solved</option>
                      <option value="allBuddies">All buddies reunited</option>
                      <option value="flagSet">Story flag raised</option>
                    </select>
                  </div>

                  {entity.critterWarmOn === 'flagSet' && (
                    <input
                      type="text"
                      value={entity.critterWarmFlag ?? ''}
                      onChange={(e) =>
                        store.updateEntity(
                          entity.id,
                          'edit critter warm flag',
                          (ent) => ({ ...ent, critterWarmFlag: e.target.value }),
                          false
                        )
                      }
                      placeholder="Flag key (e.g. acorn_latch_snapped)"
                      className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-xs font-medium border border-slate-200/70 dark:border-white/[0.08]"
                    />
                  )}

                  <label className="block space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-[#949BB0]">
                      Won-over lines (one per line)
                    </span>
                    <textarea
                      rows={2}
                      value={entity.critterWarmLines ?? ''}
                      onChange={(e) =>
                        store.updateEntity(
                          entity.id,
                          'edit critter warm lines',
                          (ent) => ({ ...ent, critterWarmLines: e.target.value }),
                          false
                        )
                      }
                      placeholder="Whoa — you misfits really saved the day!"
                      className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-xs font-medium resize-none border border-slate-200/70 dark:border-white/[0.08]"
                    />
                  </label>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <EntityItemAssignPanel entity={entity} store={store} />

      {meta.usesStats && (
        <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-3">
          <FieldLabel text="Stats & Brain" />
          {entity.kind === 'baddie' && (
            <>
              <label className="flex items-center justify-between text-xs font-semibold cursor-pointer">
                <span>Make it a Boss</span>
                <input
                  type="checkbox"
                  checked={entity.isBoss}
                  onChange={(e) =>
                    store.updateEntity(entity.id, 'toggle boss', (ent) => ({
                      ...ent,
                      isBoss: e.target.checked,
                    }))
                  }
                  className="accent-[#F59E0B] w-4 h-4"
                />
              </label>
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-[#949BB0]">
                  Behavior style
                </span>
                <select
                  value={entity.brain}
                  onChange={(e) =>
                    store.updateEntity(entity.id, 'change brain', (ent) => ({
                      ...ent,
                      brain: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#171A23] text-xs font-semibold"
                >
                  {PresetLibrary.brains.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="space-y-1">
            <div className="flex justify-between text-xs font-semibold">
              <span>Health</span>
              <span>{entity.health}</span>
            </div>
            <input
              type="range"
              min={1}
              max={15}
              value={entity.health}
              onChange={(e) =>
                store.updateEntity(entity.id, 'change health', (ent) => ({
                  ...ent,
                  health: Number(e.target.value),
                }))
              }
              className="w-full accent-[#F2545B]"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs font-semibold">
              <span>Speed</span>
              <span>{entity.speed}</span>
            </div>
            <input
              type="range"
              min={1}
              max={8}
              value={entity.speed}
              onChange={(e) =>
                store.updateEntity(entity.id, 'change speed', (ent) => ({
                  ...ent,
                  speed: Number(e.target.value),
                }))
              }
              className="w-full accent-[#7C5CFF]"
            />
          </div>
        </div>
      )}

      {entity.kind === 'treasure' && (
        <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2">
          <FieldLabel text="What is inside" />
          <select
            value={entity.loot}
            onChange={(e) =>
              store.updateEntity(entity.id, 'change loot', (ent) => ({ ...ent, loot: e.target.value }))
            }
            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#171A23] text-xs font-semibold"
          >
            {PresetLibrary.loot.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
      )}

      {entity.kind === 'puzzle' && (
        <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2.5">
          <FieldLabel text="Puzzle & Misfit Trait" />
          <select
            value={entity.puzzleType}
            onChange={(e) =>
              store.updateEntity(entity.id, 'change puzzle', (ent) => ({
                ...ent,
                puzzleType: e.target.value,
              }))
            }
            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#171A23] text-xs font-semibold"
          >
            {PresetLibrary.puzzles.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-[#949BB0]">
              Misfit power required to solve
            </span>
            <select
              value={entity.puzzleRequires ?? ''}
              onChange={(e) =>
                store.updateEntity(entity.id, 'set puzzle misfit requirement', (ent) => ({
                  ...ent,
                  puzzleRequires: (e.target.value || undefined) as MisfitAbilityId | undefined,
                }))
              }
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#171A23] text-xs font-semibold border border-slate-200/70 dark:border-white/[0.08]"
            >
              <option value="">Walk over / Touch (default)</option>
              {MisfitAbilityCatalog.map((ab) => (
                <option key={ab.id} value={ab.id}>
                  {ab.title} ({ab.flawLabel})
                </option>
              ))}
            </select>
          </div>

          <input
            type="text"
            value={entity.puzzleFlag ?? ''}
            onChange={(e) =>
              store.updateEntity(
                entity.id,
                'edit puzzle flag',
                (ent) => ({ ...ent, puzzleFlag: e.target.value || undefined }),
                false
              )
            }
            placeholder="Flag set when solved (e.g. bramble_cleared)"
            className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-xs font-medium border border-slate-200/70 dark:border-white/[0.08]"
          />

          <input
            type="text"
            value={entity.puzzleRewardText ?? ''}
            onChange={(e) =>
              store.updateEntity(
                entity.id,
                'edit puzzle reward toast',
                (ent) => ({ ...ent, puzzleRewardText: e.target.value || undefined }),
                false
              )
            }
            placeholder="Message shown when solved"
            className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-xs font-medium border border-slate-200/70 dark:border-white/[0.08]"
          />
        </div>
      )}

      {(entity.kind === 'npc' || entity.kind === 'sign' || entity.kind === 'baddie') && (() => {
        const bubbleStyle = resolveChatBubbleStyle(entity.chatBubble, entity.kind);
        const fontOpt = getChatFontOption(bubbleStyle.fontFamily);
        const chatSettings = resolveChatDisplaySettings(store.currentProject?.chatSettings);
        const sampleLine =
          entity.dialogue.trim().split('\n')[0] ||
          (entity.kind === 'baddie' ? 'Hey! Come back here!' : 'Hello, traveller!');
        return (
          <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <FieldLabel
                text={
                  entity.kind === 'npc'
                    ? 'Dialogue & Chat Bubble'
                    : entity.kind === 'baddie'
                    ? 'Battle Cry & Chat Bubble'
                    : 'Sign Text & Bubble'
                }
              />
              <span className="text-[10px] font-semibold text-slate-500 dark:text-[#949BB0]">
                {fontOpt.label}
              </span>
            </div>

            <textarea
              rows={2}
              value={entity.dialogue}
              onChange={(e) =>
                store.updateEntity(
                  entity.id,
                  'edit dialogue',
                  (ent) => ({ ...ent, dialogue: e.target.value }),
                  false
                )
              }
              placeholder={
                entity.kind === 'baddie'
                  ? 'Write a taunt or battle cry...'
                  : 'Write a helpful hint (new lines for multi-page chat)...'
              }
              className="w-full p-2.5 rounded-xl bg-white dark:bg-[#171A23] text-xs focus:outline-none focus:ring-2 focus:ring-[#7C5CFF]"
            />

            <DialogueVoiceEditor
              dialogueText={entity.dialogue}
              voiceConfig={entity.voiceConfig}
              projectChatSettings={chatSettings}
              compact
              onChange={(nextVoice) =>
                store.updateEntity(
                  entity.id,
                  'update dialogue voice-over',
                  (ent) => ({ ...ent, voiceConfig: nextVoice }),
                  true
                )
              }
            />

            {/* Live compact preview of this character's customized bubble */}
            <div className="py-2.5 px-2 rounded-xl bg-slate-200/70 dark:bg-[#141822] flex justify-center overflow-hidden">
              <ChatBubbleView
                speaker={entity.name}
                text={sampleLine}
                style={bubbleStyle}
                kind={entity.kind}
                compact
              />
            </div>

            <button
              type="button"
              onClick={() => onOpenChatStudio('bubble')}
              className="w-full py-2 rounded-xl bg-[#7C5CFF] hover:bg-[#6A48F5] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors"
            >
              <MessageCircle size={13} />
              <span>Customize Bubble & Font</span>
            </button>

            {/* Quick Project Display Mode Toggle */}
            <div className="pt-2 border-t border-slate-200/70 dark:border-white/[0.08] space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-[#949BB0]">
                <span>Game Chat Display</span>
                <button
                  type="button"
                  onClick={() => onOpenChatStudio('panel')}
                  className="text-[#7C5CFF] hover:underline font-bold"
                >
                  Panel Options
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-white dark:bg-[#171A23]">
                <button
                  type="button"
                  onClick={() =>
                    store.updateProject('use 3D chat bubbles', (p) => ({
                      ...p,
                      chatSettings: {
                        ...resolveChatDisplaySettings(p.chatSettings),
                        displayMode: 'bubbles',
                      },
                    }))
                  }
                  className={`py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center justify-center gap-1 transition-colors ${
                    chatSettings.displayMode === 'bubbles'
                      ? 'bg-[#7C5CFF] text-white'
                      : 'text-slate-500 dark:text-[#949BB0]'
                  }`}
                >
                  <MessageCircle size={11} />
                  <span>Bubbles</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    store.updateProject('use bottom chat panel', (p) => ({
                      ...p,
                      chatSettings: {
                        ...resolveChatDisplaySettings(p.chatSettings),
                        displayMode: 'bottomPanel',
                      },
                    }))
                  }
                  className={`py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center justify-center gap-1 transition-colors ${
                    chatSettings.displayMode === 'bottomPanel'
                      ? 'bg-[#7C5CFF] text-white'
                      : 'text-slate-500 dark:text-[#949BB0]'
                  }`}
                >
                  <PanelBottom size={11} />
                  <span>Bottom Panel</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {entity.kind === 'platform' && (
        <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-3">
          <FieldLabel text="Moving platform" />
          <select
            value={entity.platformPreset}
            onChange={(e) =>
              store.updateEntity(entity.id, 'change platform', (ent) => ({
                ...ent,
                platformPreset: e.target.value as PlatformPreset,
              }))
            }
            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#171A23] text-xs font-semibold"
          >
            {PlatformMotion.presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-1.5">
            {(['slide', 'vertical', 'spin', 'pendulum'] as PlatformMotionType[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() =>
                  store.updateEntity(entity.id, 'platform motion', (ent) => ({
                    ...ent,
                    platformMotion: m,
                  }))
                }
                className={`py-1.5 rounded-xl text-xs font-bold capitalize ${
                  entity.platformMotion === m
                    ? 'bg-[#7C5CFF] text-white'
                    : 'bg-white dark:bg-[#171A23] text-slate-500 dark:text-[#949BB0]'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs font-semibold">
              <span>Speed</span>
              <span>{entity.platformSpeed.toFixed(1)}×</span>
            </div>
            <input
              type="range"
              min={0.3}
              max={3.5}
              step={0.1}
              value={entity.platformSpeed}
              onChange={(e) =>
                store.updateEntity(entity.id, 'platform speed', (ent) => ({
                  ...ent,
                  platformSpeed: Number(e.target.value),
                }))
              }
              className="w-full accent-[#7C5CFF]"
            />
          </div>
        </div>
      )}

      <div className="space-y-2 pt-2 border-t border-slate-200/70 dark:border-white/[0.08]">
        <button
          type="button"
          onClick={() => store.setSelectedTab('logic')}
          className="w-full py-2.5 rounded-xl bg-[#A855F7]/15 text-[#A855F7] text-xs font-bold hover:bg-[#A855F7]/25"
        >
          Open Logic Rules ({entity.cards.length})
        </button>

        <button
          type="button"
          onClick={() => store.deleteEntity(entity.id)}
          className="w-full py-2 rounded-xl bg-[#F2545B]/12 text-[#F2545B] text-xs font-bold hover:bg-[#F2545B]/20 inline-flex items-center justify-center gap-1.5"
        >
          <Trash2 size={13} />
          <span>Delete {entity.name}</span>
        </button>
      </div>
    </div>
  );
};
