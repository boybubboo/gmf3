import React, { useMemo, useState } from 'react';
import {
  Copy,
  MessageCircle,
  PanelBottom,
  Play,
  RotateCcw,
  User,
  X,
} from 'lucide-react';
import {
  CHAT_ANIM_OPTIONS,
  CHAT_BUBBLE_PRESETS,
  CHAT_FONT_OPTIONS,
  CHAT_PANEL_THEMES,
  CHAT_SHADOW_OPTIONS,
  CHAT_SHAPE_OPTIONS,
  CHAT_TAIL_OPTIONS,
  createDefaultChatBubbleStyle,
  getPresetStyle,
  resolveChatBubbleStyle,
  resolveChatDisplaySettings,
  resolveEffectiveDialogueMode,
  resolveVoiceClipForLine,
} from '../../data/chatBubblePresets';
import { EntityKindMeta } from '../../data/registries';
import type { MakerStore } from '../../store/useMakerStore';
import type {
  ChatBubbleStyle,
  ChatDisplaySettings,
  DialogueOutputMode,
  LevelEntity,
} from '../../types/maker';
import { AudioEngine } from '../../utils/audio';
import { HUD_SURFACE_TEXTURES, HUD_WIDGET_SHAPES } from '../../utils/hudMaterials';
import { BottomChatPanelView, ChatBubbleView } from './ChatBubbleRenderer';
import { DialogueVoiceEditor } from './DialogueVoiceEditor';
import { FieldLabel } from './MakerUI';

export type ChatStudioTarget = 'hero' | string; // 'hero' or entity.id

interface ChatBubbleStudioModalProps {
  store: MakerStore;
  initialTarget: ChatStudioTarget;
  initialTab?: 'bubble' | 'panel';
  onClose: () => void;
}

export const ChatBubbleStudioModal: React.FC<ChatBubbleStudioModalProps> = ({
  store,
  initialTarget,
  initialTab = 'bubble',
  onClose,
}) => {
  const { currentProject, currentLevel } = store;
  const [target, setTarget] = useState<ChatStudioTarget>(initialTarget);
  const [activeTab, setActiveTab] = useState<'bubble' | 'panel'>(initialTab);
  const [replayNonce, setReplayNonce] = useState(0);
  const [heroSampleText, setHeroSampleText] = useState("Let's explore the island together!");
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);

  const talkableEntities = useMemo<LevelEntity[]>(() => {
    if (!currentLevel) return [];
    const primary = currentLevel.entities.filter(
      (e) => e.kind === 'npc' || e.kind === 'baddie' || e.kind === 'sign'
    );
    const selectedEnt =
      target !== 'hero' ? currentLevel.entities.find((e) => e.id === target) : undefined;
    if (selectedEnt && !primary.some((e) => e.id === selectedEnt.id)) {
      return [selectedEnt, ...primary];
    }
    return primary;
  }, [currentLevel, target]);

  if (!currentProject || !currentLevel) return null;

  const isHero = target === 'hero';
  const entity = isHero ? null : currentLevel.entities.find((e) => e.id === target) ?? null;

  const chatSettings = resolveChatDisplaySettings(currentProject.chatSettings);
  const activeStyle = resolveChatBubbleStyle(
    isHero ? currentProject.heroChatBubble : entity?.chatBubble,
    isHero ? 'hero' : entity?.kind
  );

  const speakerName = isHero ? currentProject.heroName || 'Hero' : entity?.name || 'Character';
  const roleLabel = isHero
    ? 'Hero'
    : entity
    ? entity.isBoss
      ? 'Boss'
      : EntityKindMeta[entity.kind].title
    : 'Character';

  const previewText = isHero
    ? heroSampleText
    : entity?.dialogue?.trim() ||
      entity?.cards.flatMap((c) => c.actions).find((a) => a.key === 'say')?.detail ||
      (entity?.kind === 'baddie'
        ? 'Hey! You shall not pass!'
        : 'Welcome, traveller! Have you seen the golden key?');

  const updateBubbleStyle = (
    updater: (prev: ChatBubbleStyle) => ChatBubbleStyle,
    recordUndo = true
  ) => {
    if (isHero) {
      store.updateProject(
        'customize hero chat bubble',
        (p) => ({
          ...p,
          heroChatBubble: updater(resolveChatBubbleStyle(p.heroChatBubble, 'hero')),
        }),
        recordUndo
      );
    } else if (entity) {
      store.updateEntity(
        entity.id,
        'customize chat bubble',
        (ent) => ({
          ...ent,
          chatBubble: updater(resolveChatBubbleStyle(ent.chatBubble, ent.kind)),
        }),
        recordUndo
      );
    }
  };

  const updateChatSettings = (
    updater: (prev: ChatDisplaySettings) => ChatDisplaySettings,
    recordUndo = true
  ) => {
    store.updateProject(
      'update chat display settings',
      (p) => ({
        ...p,
        chatSettings: updater(resolveChatDisplaySettings(p.chatSettings)),
      }),
      recordUndo
    );
  };

  const handleApplyToAllCharacters = () => {
    const snapshot: ChatBubbleStyle = { ...activeStyle };
    store.updateLevel('apply chat bubble to all characters', (lvl) => ({
      ...lvl,
      entities: lvl.entities.map((ent) =>
        ent.kind === 'npc' || ent.kind === 'baddie' || ent.kind === 'sign'
          ? { ...ent, chatBubble: { ...snapshot } }
          : ent
      ),
    }));
    setCopiedNotice('Applied to all characters in this level');
    window.setTimeout(() => setCopiedNotice(null), 2200);
  };

  const handleResetCharacterStyle = () => {
    const def = createDefaultChatBubbleStyle(isHero ? 'hero' : entity?.kind);
    updateBubbleStyle(() => def, true);
    setReplayNonce((n) => n + 1);
  };

  const effectiveDialogueMode = resolveEffectiveDialogueMode(
    chatSettings,
    entity?.voiceConfig
  );

  const handleReplayPreview = () => {
    setReplayNonce((n) => n + 1);
    if (entity && effectiveDialogueMode !== 'text') {
      const clipId = resolveVoiceClipForLine(entity.voiceConfig, 0);
      if (clipId) {
        AudioEngine.unlock();
        AudioEngine.playVoiceClip(clipId, {
          ownerKey: `studio-${entity.id}`,
          volume: entity.voiceConfig?.volume ?? 1.0,
          playbackRate: entity.voiceConfig?.playbackRate ?? 1.0,
        });
      }
    }
  };

  const previewHistory = [
    {
      id: 'h1',
      speaker: currentProject.heroName || 'Hero',
      speakerColor: resolveChatBubbleStyle(currentProject.heroChatBubble, 'hero').speakerColor,
      text: 'Any clues about the locked gate?',
    },
    {
      id: 'h2',
      speaker: speakerName,
      speakerColor: activeStyle.speakerColor,
      text: previewText,
    },
  ];

  const handleCloseModal = () => {
    AudioEngine.stopVoice();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-3 sm:p-5"
      onClick={handleCloseModal}
    >
      <div
        className="w-full max-w-5xl max-h-[92vh] rounded-2xl bg-white dark:bg-[#171A23] text-slate-900 dark:text-[#F3F5FA] border border-slate-200 dark:border-white/[0.1] shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Bar */}
        <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200/80 dark:border-white/[0.08] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#7C5CFF]/15 text-[#7C5CFF] flex items-center justify-center shrink-0">
              <MessageCircle size={17} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-extrabold leading-tight truncate">
                Chat Bubble Maker
              </h2>
              <div className="text-xs text-slate-500 dark:text-[#949BB0] truncate">
                {speakerName} · {roleLabel} ·{' '}
                {chatSettings.displayMode === 'bubbles' ? '3D Chat Bubbles' : 'Bottom Chat Panel'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <select
              value={target}
              onChange={(e) => {
                AudioEngine.stopVoice();
                setTarget(e.target.value);
                setReplayNonce((n) => n + 1);
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1F2430] border border-slate-200 dark:border-white/[0.08] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#7C5CFF]"
              aria-label="Choose character to customize"
            >
              <option value="hero">Hero: {currentProject.heroName || 'Hero'}</option>
              {talkableEntities.map((ent) => (
                <option key={ent.id} value={ent.id}>
                  {EntityKindMeta[ent.kind].title}: {ent.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleCloseModal}
              className="p-2 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-slate-500 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white transition-colors"
              aria-label="Close Chat Bubble Maker"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {/* Body Split: Left Live Stage + Right Controls */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          {/* Left: Live Interactive Preview Stage */}
          <div className="lg:w-[46%] shrink-0 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-200/80 dark:border-white/[0.08] p-4 sm:p-5 gap-4 overflow-y-auto maker-scroll">
            {/* Global Display Mode Switcher */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <FieldLabel text="In-Game Display Mode" />
                <span className="text-[11px] text-slate-500 dark:text-[#949BB0]">
                  Applies across this game
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-[#1F2430]">
                <button
                  type="button"
                  onClick={() => {
                    updateChatSettings((s) => ({ ...s, displayMode: 'bubbles' }));
                    setActiveTab('bubble');
                    setReplayNonce((n) => n + 1);
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                    chatSettings.displayMode === 'bubbles'
                      ? 'bg-[#7C5CFF] text-white shadow-sm'
                      : 'text-slate-600 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <MessageCircle size={14} />
                  <span>3D Chat Bubbles</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateChatSettings((s) => ({ ...s, displayMode: 'bottomPanel' }));
                    setActiveTab('panel');
                    setReplayNonce((n) => n + 1);
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                    chatSettings.displayMode === 'bottomPanel'
                      ? 'bg-[#7C5CFF] text-white shadow-sm'
                      : 'text-slate-600 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <PanelBottom size={14} />
                  <span>Bottom Chat Panel</span>
                </button>
              </div>
            </div>

            {/* Global Dialogue Output Mode: Text / Audio / Both */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <FieldLabel text="Default Dialogue Format" />
                <span className="text-[11px] text-slate-500 dark:text-[#949BB0]">
                  {(chatSettings.dialogueMode ?? 'both') === 'both'
                    ? 'Text + Voice audio'
                    : chatSettings.dialogueMode === 'audio'
                    ? 'Audio only'
                    : 'Text only'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#1F2430]">
                {(
                  [
                    { id: 'text', label: 'Text Only' },
                    { id: 'audio', label: 'Audio Only' },
                    { id: 'both', label: 'Text + Audio' },
                  ] as { id: DialogueOutputMode; label: string }[]
                ).map((opt) => {
                  const active = (chatSettings.dialogueMode ?? 'both') === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        updateChatSettings((s) => ({ ...s, dialogueMode: opt.id }))
                      }
                      className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-[#7C5CFF] text-white shadow-sm'
                          : 'text-slate-600 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Visual Preview Stage */}
            <div
              className="relative flex-1 min-h-[270px] rounded-xl border border-slate-200/80 dark:border-white/[0.1] overflow-hidden flex flex-col justify-between p-4"
              style={{
                background:
                  'linear-gradient(180deg, #3B7FD6 0%, #7AC0F2 48%, #5AA054 48.5%, #3B743B 100%)',
              }}
            >
              {/* Soft sun glow & hill silhouette */}
              <div
                className="pointer-events-none absolute top-4 right-8 w-16 h-16 rounded-full"
                style={{
                  background:
                    'radial-gradient(circle, rgba(255,247,204,0.85) 0%, rgba(255,247,204,0) 70%)',
                }}
              />
              <div className="pointer-events-none relative z-10 flex items-center justify-between text-[11px] font-semibold text-white/90">
                <span>
                  {chatSettings.displayMode === 'bubbles'
                    ? 'Floating overhead bubble preview'
                    : 'Bottom-of-screen chat panel preview'}
                </span>
                <button
                  type="button"
                  onClick={handleReplayPreview}
                  className="pointer-events-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/45 hover:bg-black/65 text-white text-[11px] font-bold transition-colors"
                >
                  <Play size={11} fill="currentColor" />
                  <span>Replay</span>
                </button>
              </div>

              {effectiveDialogueMode === 'audio' ? (
                <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-2 text-center px-4">
                  <div className="px-3.5 py-2 rounded-xl bg-black/50 text-white text-xs font-semibold">
                    Audio Only Mode — text dialogue box hidden in game
                  </div>
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-white shadow-md border-2 border-white/80"
                    style={{
                      backgroundColor: isHero
                        ? currentProject.heroColors.tunic
                        : entity
                        ? EntityKindMeta[entity.kind].tint
                        : '#7C5CFF',
                    }}
                  >
                    <User size={20} />
                  </div>
                </div>
              ) : chatSettings.displayMode === 'bubbles' ? (
                <div className="relative z-10 flex-1 flex flex-col items-center justify-end pb-3 gap-2">
                  <div
                    style={{
                      transform: `translateY(${-Math.round(activeStyle.floatHeight * 14)}px)`,
                      transition: 'transform 160ms ease-out',
                    }}
                  >
                    <ChatBubbleView
                      speaker={speakerName}
                      text={previewText}
                      style={activeStyle}
                      kind={isHero ? 'hero' : entity?.kind}
                      replayNonce={replayNonce}
                      actionHint="Press E"
                    />
                  </div>
                  {/* Stylized character stand-in */}
                  <div className="flex flex-col items-center">
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center text-white shadow-md border-2 border-white/80"
                      style={{
                        backgroundColor: isHero
                          ? currentProject.heroColors.tunic
                          : entity
                          ? EntityKindMeta[entity.kind].tint
                          : '#7C5CFF',
                      }}
                    >
                      <User size={20} />
                    </div>
                    <div className="w-10 h-2 rounded-full bg-black/30 mt-1" />
                  </div>
                </div>
              ) : (
                <div className="relative z-10 flex-1 flex flex-col justify-end gap-3 pt-6">
                  {/* Character in background */}
                  <div className="flex justify-center">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-md border-2 border-white/75"
                      style={{
                        backgroundColor: isHero
                          ? currentProject.heroColors.tunic
                          : entity
                          ? EntityKindMeta[entity.kind].tint
                          : '#7C5CFF',
                      }}
                    >
                      <User size={18} />
                    </div>
                  </div>
                  <BottomChatPanelView
                    speaker={speakerName}
                    roleLabel={roleLabel}
                    text={previewText}
                    characterStyle={activeStyle}
                    kind={isHero ? 'hero' : entity?.kind}
                    settings={chatSettings}
                    history={previewHistory}
                    replayNonce={replayNonce}
                    lineIndex={0}
                    totalLines={2}
                    onAdvance={() => setReplayNonce((n) => n + 1)}
                  />
                </div>
              )}
            </div>

            {/* Editable Live Dialogue Text */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <FieldLabel
                  text={
                    isHero
                      ? 'Test Bubble Text'
                      : entity?.kind === 'baddie'
                      ? 'Battle Cry / Taunt (separate lines with Enter)'
                      : 'Character Dialogue (separate lines with Enter)'
                  }
                />
              </div>
              <textarea
                rows={2}
                value={isHero ? heroSampleText : entity?.dialogue ?? ''}
                onChange={(e) => {
                  if (isHero) {
                    setHeroSampleText(e.target.value);
                  } else if (entity) {
                    store.updateEntity(
                      entity.id,
                      'edit dialogue',
                      (ent) => ({ ...ent, dialogue: e.target.value }),
                      false
                    );
                  }
                }}
                placeholder="Write what this character says..."
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#1F2430] border border-slate-200/70 dark:border-white/[0.08] text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#7C5CFF]"
              />
            </div>

            {entity && (
              <div className="p-3 rounded-xl bg-slate-100/90 dark:bg-[#1F2430] border border-slate-200/60 dark:border-white/[0.06]">
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
              </div>
            )}

            {/* Utility Footer Row */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={handleApplyToAllCharacters}
                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1F2430] hover:bg-slate-200 dark:hover:bg-[#272D3C] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                <Copy size={13} />
                <span>Copy style to all characters</span>
              </button>
              <button
                type="button"
                onClick={handleResetCharacterStyle}
                className="px-3 py-1.5 rounded-lg text-slate-500 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw size={13} />
                <span>Reset</span>
              </button>
            </div>
            {copiedNotice && (
              <div className="text-xs font-semibold text-[#20B46A]">{copiedNotice}</div>
            )}
          </div>

          {/* Right: Customization Controls */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* Inspector Sub-tabs */}
            <div className="flex items-center gap-1 px-5 pt-3 border-b border-slate-200/80 dark:border-white/[0.08] shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('bubble')}
                className={`px-3.5 py-2 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'bubble'
                    ? 'border-[#7C5CFF] text-[#7C5CFF]'
                    : 'border-transparent text-slate-500 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Character Bubble & Font
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('panel')}
                className={`px-3.5 py-2 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'panel'
                    ? 'border-[#7C5CFF] text-[#7C5CFF]'
                    : 'border-transparent text-slate-500 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Bottom Panel Settings
              </button>
            </div>

            <div className="flex-1 overflow-y-auto maker-scroll p-5 space-y-5">
              {activeTab === 'bubble' ? (
                <>
                  {/* 1. Quick Presets */}
                  <section className="space-y-2">
                    <FieldLabel text="Bubble Style Presets" />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {CHAT_BUBBLE_PRESETS.map((preset) => {
                        const isActive = activeStyle.presetId === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => {
                              updateBubbleStyle(() => getPresetStyle(preset.id), true);
                              setReplayNonce((n) => n + 1);
                            }}
                            className={`p-2 rounded-xl border text-left transition-all ${
                              isActive
                                ? 'border-[#7C5CFF] ring-2 ring-[#7C5CFF]/25 bg-[#7C5CFF]/10'
                                : 'border-slate-200/80 dark:border-white/[0.08] hover:border-[#7C5CFF]/50 bg-slate-50 dark:bg-[#1B1F2B]'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              <span
                                className="w-4 h-4 rounded shrink-0"
                                style={{
                                  backgroundColor: preset.style.bgColor,
                                  border: `2px solid ${preset.style.borderColor}`,
                                }}
                              />
                              <span className="text-[11px] font-bold truncate">{preset.name}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-[#949BB0] truncate">
                              {preset.blurb}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  {/* 2. Shape, Tail & Frame */}
                  <section className="space-y-3 pt-4 border-t border-slate-200/70 dark:border-white/[0.08]">
                    <FieldLabel text="Bubble Shape & Tail" />
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                      {CHAT_SHAPE_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            updateBubbleStyle((prev) => ({
                              ...prev,
                              presetId: undefined,
                              shape: opt.id,
                              tailStyle:
                                opt.id === 'thought'
                                  ? 'dots'
                                  : opt.id === 'comic'
                                  ? 'curved'
                                  : prev.tailStyle,
                            }))
                          }
                          className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-colors whitespace-nowrap ${
                            activeStyle.shape === opt.id
                              ? 'bg-[#7C5CFF] border-[#7C5CFF] text-white'
                              : 'bg-slate-100 dark:bg-[#1F2430] border-transparent text-slate-600 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-[#949BB0]">
                          Tail Pointer
                        </span>
                        <div className="grid grid-cols-2 gap-1.5">
                          {CHAT_TAIL_OPTIONS.map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() =>
                                updateBubbleStyle((prev) => ({
                                  ...prev,
                                  presetId: undefined,
                                  tailStyle: t.id,
                                }))
                              }
                              className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-colors whitespace-nowrap ${
                                activeStyle.tailStyle === t.id
                                  ? 'border-[#7C5CFF] bg-[#7C5CFF]/15 text-[#7C5CFF]'
                                  : 'border-transparent bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#949BB0]'
                              }`}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-[#949BB0]">
                          Drop Shadow
                        </span>
                        <div className="grid grid-cols-2 gap-1.5">
                          {CHAT_SHADOW_OPTIONS.map((sh) => (
                            <button
                              key={sh.id}
                              type="button"
                              onClick={() =>
                                updateBubbleStyle((prev) => ({
                                  ...prev,
                                  presetId: undefined,
                                  shadowStyle: sh.id,
                                }))
                              }
                              className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-colors whitespace-nowrap ${
                                activeStyle.shadowStyle === sh.id
                                  ? 'border-[#7C5CFF] bg-[#7C5CFF]/15 text-[#7C5CFF]'
                                  : 'border-transparent bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#949BB0]'
                              }`}
                            >
                              {sh.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <label className="space-y-1">
                        <div className="flex justify-between text-[11px] font-semibold">
                          <span>Corners</span>
                          <span className="tabular-nums text-slate-500">{activeStyle.borderRadius}px</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={28}
                          step={1}
                          value={activeStyle.borderRadius}
                          onChange={(e) =>
                            updateBubbleStyle(
                              (prev) => ({
                                ...prev,
                                presetId: undefined,
                                borderRadius: Number(e.target.value),
                              }),
                              false
                            )
                          }
                          className="w-full accent-[#7C5CFF]"
                        />
                      </label>

                      <label className="space-y-1">
                        <div className="flex justify-between text-[11px] font-semibold">
                          <span>Outline</span>
                          <span className="tabular-nums text-slate-500">{activeStyle.borderWidth}px</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={5}
                          step={0.5}
                          value={activeStyle.borderWidth}
                          onChange={(e) =>
                            updateBubbleStyle(
                              (prev) => ({
                                ...prev,
                                presetId: undefined,
                                borderWidth: Number(e.target.value),
                              }),
                              false
                            )
                          }
                          className="w-full accent-[#7C5CFF]"
                        />
                      </label>

                      <label className="space-y-1">
                        <div className="flex justify-between text-[11px] font-semibold">
                          <span>Max Width</span>
                          <span className="tabular-nums text-slate-500">{activeStyle.maxWidth}px</span>
                        </div>
                        <input
                          type="range"
                          min={180}
                          max={380}
                          step={8}
                          value={activeStyle.maxWidth}
                          onChange={(e) =>
                            updateBubbleStyle(
                              (prev) => ({
                                ...prev,
                                presetId: undefined,
                                maxWidth: Number(e.target.value),
                              }),
                              false
                            )
                          }
                          className="w-full accent-[#7C5CFF]"
                        />
                      </label>
                    </div>
                  </section>

                  {/* 3. Font & Typography */}
                  <section className="space-y-3 pt-4 border-t border-slate-200/70 dark:border-white/[0.08]">
                    <FieldLabel text="Font & Typography" />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {CHAT_FONT_OPTIONS.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() =>
                            updateBubbleStyle((prev) => ({
                              ...prev,
                              presetId: undefined,
                              fontFamily: f.id,
                            }))
                          }
                          className={`p-2 rounded-xl border text-left transition-colors ${
                            activeStyle.fontFamily === f.id
                              ? 'border-[#7C5CFF] bg-[#7C5CFF]/15'
                              : 'border-slate-200/70 dark:border-white/[0.08] bg-slate-50 dark:bg-[#1B1F2B] hover:border-[#7C5CFF]/40'
                          }`}
                        >
                          <div
                            className="text-xs font-bold truncate"
                            style={{
                              fontFamily: f.cssFamily,
                              letterSpacing: f.letterSpacing,
                            }}
                          >
                            {f.label}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-[#949BB0] truncate">
                            {f.sample}
                          </div>
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                      <label className="space-y-1">
                        <div className="flex justify-between text-[11px] font-semibold">
                          <span>Font Size</span>
                          <span className="tabular-nums text-slate-500">{activeStyle.fontSize}px</span>
                        </div>
                        <input
                          type="range"
                          min={11}
                          max={22}
                          step={1}
                          value={activeStyle.fontSize}
                          onChange={(e) =>
                            updateBubbleStyle(
                              (prev) => ({
                                ...prev,
                                presetId: undefined,
                                fontSize: Number(e.target.value),
                              }),
                              false
                            )
                          }
                          className="w-full accent-[#7C5CFF]"
                        />
                      </label>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {(['normal', 'semibold', 'bold'] as const).map((w) => (
                          <button
                            key={w}
                            type="button"
                            onClick={() =>
                              updateBubbleStyle((prev) => ({ ...prev, fontWeight: w }))
                            }
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold capitalize ${
                              activeStyle.fontWeight === w
                                ? 'bg-[#7C5CFF] text-white'
                                : 'bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#949BB0]'
                            }`}
                          >
                            {w}
                          </button>
                        ))}

                        <button
                          type="button"
                          onClick={() =>
                            updateBubbleStyle((prev) => ({ ...prev, italic: !prev.italic }))
                          }
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold italic ${
                            activeStyle.italic
                              ? 'bg-[#7C5CFF] text-white'
                              : 'bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#949BB0]'
                          }`}
                        >
                          Italic
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            updateBubbleStyle((prev) => ({
                              ...prev,
                              textAlign: prev.textAlign === 'center' ? 'left' : 'center',
                            }))
                          }
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#949BB0]"
                        >
                          Align: {activeStyle.textAlign === 'center' ? 'Center' : 'Left'}
                        </button>
                      </div>
                    </div>

                    <label className="flex items-center justify-between text-xs font-semibold cursor-pointer">
                      <span>Show character name above text</span>
                      <input
                        type="checkbox"
                        checked={activeStyle.showSpeakerName}
                        onChange={(e) =>
                          updateBubbleStyle((prev) => ({
                            ...prev,
                            showSpeakerName: e.target.checked,
                          }))
                        }
                        className="accent-[#7C5CFF] w-4 h-4"
                      />
                    </label>
                  </section>

                  {/* 4. Colors & Surface */}
                  <section className="space-y-3 pt-4 border-t border-slate-200/70 dark:border-white/[0.08]">
                    <FieldLabel text="Colors & Surface" />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {(
                        [
                          { key: 'bgColor', label: 'Bubble Fill' },
                          { key: 'textColor', label: 'Text Color' },
                          { key: 'borderColor', label: 'Border' },
                          { key: 'speakerColor', label: 'Name Accent' },
                        ] as const
                      ).map(({ key, label }) => (
                        <label
                          key={key}
                          className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-[#1F2430] text-[11px] font-semibold cursor-pointer"
                        >
                          <span className="truncate">{label}</span>
                          <input
                            type="color"
                            value={activeStyle[key]}
                            onChange={(e) =>
                              updateBubbleStyle(
                                (prev) => ({
                                  ...prev,
                                  presetId: undefined,
                                  [key]: e.target.value,
                                }),
                                false
                              )
                            }
                            className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer shrink-0"
                          />
                        </label>
                      ))}
                    </div>

                    <label className="block space-y-1">
                      <div className="flex justify-between text-[11px] font-semibold">
                        <span>Bubble Opacity (Ghost Back)</span>
                        <span className="tabular-nums text-slate-500">
                          {Math.round(activeStyle.opacity * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.1}
                        max={1}
                        step={0.01}
                        value={activeStyle.opacity}
                        onChange={(e) =>
                          updateBubbleStyle(
                            (prev) => ({ ...prev, opacity: Number(e.target.value) }),
                            false
                          )
                        }
                        className="w-full accent-[#7C5CFF]"
                      />
                    </label>

                    {/* Surface Material Texture */}
                    <div className="space-y-1.5 pt-2">
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-[#949BB0]">
                        Surface Material Texture
                      </span>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                        {HUD_SURFACE_TEXTURES.map((tex) => {
                          const selected = (activeStyle.surfaceTexture ?? 'smooth') === tex.id;
                          return (
                            <button
                              key={tex.id}
                              type="button"
                              onClick={() =>
                                updateBubbleStyle((prev) => ({
                                  ...prev,
                                  presetId: undefined,
                                  surfaceTexture: tex.id,
                                }))
                              }
                              className={`px-2 py-1.5 rounded-lg border text-[10px] font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                                selected
                                  ? 'border-[#7C5CFF] bg-[#7C5CFF]/15 text-[#7C5CFF]'
                                  : 'border-slate-200/70 dark:border-white/[0.08] bg-slate-50 dark:bg-[#1B1F2B] text-slate-600 dark:text-[#949BB0]'
                              }`}
                            >
                              <span
                                className="w-3.5 h-3.5 rounded shrink-0 border border-black/20"
                                style={{ background: tex.previewBg }}
                              />
                              <span className="truncate">{tex.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Organic Wear, Burned Edges, Paper Tears & 3D Depth */}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <label className="space-y-1">
                        <div className="flex justify-between text-[11px] font-semibold">
                          <span>Organic Edge Wear</span>
                          <span className="tabular-nums text-slate-500">
                            {Math.round((activeStyle.edgeWear ?? 0) * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={activeStyle.edgeWear ?? 0}
                          onChange={(e) =>
                            updateBubbleStyle(
                              (prev) => ({ ...prev, presetId: undefined, edgeWear: Number(e.target.value) }),
                              false
                            )
                          }
                          className="w-full accent-[#7C5CFF]"
                        />
                      </label>

                      <label className="space-y-1">
                        <div className="flex justify-between text-[11px] font-semibold">
                          <span>Burned / Scorched Edges</span>
                          <span className="tabular-nums text-slate-500">
                            {Math.round((activeStyle.burnedEdges ?? 0) * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={activeStyle.burnedEdges ?? 0}
                          onChange={(e) =>
                            updateBubbleStyle(
                              (prev) => ({ ...prev, presetId: undefined, burnedEdges: Number(e.target.value) }),
                              false
                            )
                          }
                          className="w-full accent-[#7C5CFF]"
                        />
                      </label>

                      <label className="space-y-1">
                        <div className="flex justify-between text-[11px] font-semibold">
                          <span>Torn Paper Edges</span>
                          <span className="tabular-nums text-slate-500">
                            {Math.round((activeStyle.paperTears ?? 0) * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={activeStyle.paperTears ?? 0}
                          onChange={(e) =>
                            updateBubbleStyle(
                              (prev) => ({ ...prev, presetId: undefined, paperTears: Number(e.target.value) }),
                              false
                            )
                          }
                          className="w-full accent-[#7C5CFF]"
                        />
                      </label>

                      <label className="space-y-1">
                        <div className="flex justify-between text-[11px] font-semibold">
                          <span>3D Extrusion Depth</span>
                          <span className="tabular-nums text-slate-500">
                            {Math.round((activeStyle.depth3d ?? 0) * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={activeStyle.depth3d ?? 0}
                          onChange={(e) =>
                            updateBubbleStyle(
                              (prev) => ({ ...prev, presetId: undefined, depth3d: Number(e.target.value) }),
                              false
                            )
                          }
                          className="w-full accent-[#7C5CFF]"
                        />
                      </label>
                    </div>
                  </section>

                  {/* 5. Dynamic Motion & Proximity */}
                  <section className="space-y-3 pt-4 border-t border-slate-200/70 dark:border-white/[0.08]">
                    <FieldLabel text="Dynamic Motion & Behavior" />
                    <div className="grid grid-cols-4 gap-1.5">
                      {CHAT_ANIM_OPTIONS.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => {
                            updateBubbleStyle((prev) => ({ ...prev, entranceAnim: a.id }));
                            setReplayNonce((n) => n + 1);
                          }}
                          className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-colors whitespace-nowrap ${
                            activeStyle.entranceAnim === a.id
                              ? 'border-[#7C5CFF] bg-[#7C5CFF]/15 text-[#7C5CFF]'
                              : 'border-transparent bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#949BB0]'
                          }`}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-2 p-3 rounded-xl bg-slate-100/80 dark:bg-[#1F2430]">
                        <label className="flex items-center justify-between text-xs font-semibold cursor-pointer">
                          <span>Typewriter text</span>
                          <input
                            type="checkbox"
                            checked={activeStyle.typewriterEffect}
                            onChange={(e) => {
                              updateBubbleStyle((prev) => ({
                                ...prev,
                                typewriterEffect: e.target.checked,
                              }));
                              setReplayNonce((n) => n + 1);
                            }}
                            className="accent-[#7C5CFF] w-4 h-4"
                          />
                        </label>
                        {activeStyle.typewriterEffect && (
                          <label className="block space-y-1">
                            <div className="flex justify-between text-[11px] font-semibold">
                              <span>Typing Speed</span>
                              <span className="tabular-nums text-slate-500">
                                {activeStyle.typewriterSpeed} ch/s
                              </span>
                            </div>
                            <input
                              type="range"
                              min={16}
                              max={95}
                              step={2}
                              value={activeStyle.typewriterSpeed}
                              onChange={(e) =>
                                updateBubbleStyle(
                                  (prev) => ({ ...prev, typewriterSpeed: Number(e.target.value) }),
                                  false
                                )
                              }
                              className="w-full accent-[#7C5CFF]"
                            />
                          </label>
                        )}
                      </div>

                      <div className="space-y-2 p-3 rounded-xl bg-slate-100/80 dark:bg-[#1F2430]">
                        <label className="block space-y-1">
                          <div className="flex justify-between text-[11px] font-semibold">
                            <span>Height Above Head</span>
                            <span className="tabular-nums text-slate-500">
                              +{activeStyle.floatHeight.toFixed(2)}m
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={2.2}
                            step={0.05}
                            value={activeStyle.floatHeight}
                            onChange={(e) =>
                              updateBubbleStyle(
                                (prev) => ({ ...prev, floatHeight: Number(e.target.value) }),
                                false
                              )
                            }
                            className="w-full accent-[#7C5CFF]"
                          />
                        </label>
                      </div>
                    </div>

                    {!isHero && (
                      <div className="p-3 rounded-xl bg-slate-100/80 dark:bg-[#1F2430] space-y-2">
                        <label className="flex items-center justify-between text-xs font-semibold cursor-pointer">
                          <span>Auto-show floating bubble when Hero walks near</span>
                          <input
                            type="checkbox"
                            checked={activeStyle.autoShowOnApproach}
                            onChange={(e) =>
                              updateBubbleStyle((prev) => ({
                                ...prev,
                                autoShowOnApproach: e.target.checked,
                              }))
                            }
                            className="accent-[#7C5CFF] w-4 h-4"
                          />
                        </label>
                        {activeStyle.autoShowOnApproach && (
                          <label className="block space-y-1">
                            <div className="flex justify-between text-[11px] font-semibold">
                              <span>Approach Distance</span>
                              <span className="tabular-nums text-slate-500">
                                {activeStyle.autoShowDistance.toFixed(1)}m
                              </span>
                            </div>
                            <input
                              type="range"
                              min={2.5}
                              max={9.5}
                              step={0.3}
                              value={activeStyle.autoShowDistance}
                              onChange={(e) =>
                                updateBubbleStyle(
                                  (prev) => ({
                                    ...prev,
                                    autoShowDistance: Number(e.target.value),
                                  }),
                                  false
                                )
                              }
                              className="w-full accent-[#7C5CFF]"
                            />
                          </label>
                        )}
                      </div>
                    )}
                  </section>
                </>
              ) : (
                /* Bottom Panel Settings Tab */
                <div className="space-y-5">
                  <section className="space-y-2">
                    <FieldLabel text="Bottom Panel Theme" />
                    <div className="grid grid-cols-2 gap-2">
                      {CHAT_PANEL_THEMES.map((theme) => {
                        const active = chatSettings.panelTheme === theme.id;
                        return (
                          <button
                            key={theme.id}
                            type="button"
                            onClick={() =>
                              updateChatSettings((s) => ({
                                ...s,
                                panelTheme: theme.id,
                                panelBgColor: theme.bgColor,
                                panelBorderColor: theme.borderColor,
                                panelTextColor: theme.textColor,
                                panelOpacity: theme.opacity,
                                panelTexture: theme.texture ?? 'smooth',
                                panelShape: theme.shape ?? 'rounded',
                                panelBurnedEdges: theme.burnedEdges ?? 0,
                                panelPaperTears: theme.paperTears ?? 0,
                                panelEdgeWear: theme.edgeWear ?? 0,
                                panelFontFamily: theme.fontFamily ?? 'sans',
                              }))
                            }
                            className={`p-3 rounded-xl border text-left transition-all ${
                              active
                                ? 'border-[#7C5CFF] ring-2 ring-[#7C5CFF]/25 bg-[#7C5CFF]/10'
                                : 'border-slate-200/80 dark:border-white/[0.08] bg-slate-50 dark:bg-[#1B1F2B]'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="w-5 h-5 rounded shrink-0"
                                style={{
                                  backgroundColor: theme.bgColor,
                                  border: `2px solid ${theme.borderColor}`,
                                }}
                              />
                              <span className="text-xs font-bold">{theme.label}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section className="space-y-3 pt-4 border-t border-slate-200/70 dark:border-white/[0.08]">
                    <label className="flex items-center justify-between gap-3 text-xs font-semibold cursor-pointer">
                      <div>
                        <div>Adapt panel to each character&apos;s font & colors</div>
                        <div className="text-[11px] font-normal text-slate-500 dark:text-[#949BB0]">
                          When on, each speaker&apos;s custom bubble font and palette style the bottom panel.
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={chatSettings.panelUseCharacterStyle}
                        onChange={(e) =>
                          updateChatSettings((s) => ({
                            ...s,
                            panelUseCharacterStyle: e.target.checked,
                          }))
                        }
                        className="accent-[#7C5CFF] w-4 h-4 shrink-0"
                      />
                    </label>

                    <div className="grid grid-cols-3 gap-2.5">
                      {(
                        [
                          { key: 'panelBgColor', label: 'Panel Fill' },
                          { key: 'panelBorderColor', label: 'Border' },
                          { key: 'panelTextColor', label: 'Text' },
                        ] as const
                      ).map(({ key, label }) => (
                        <label
                          key={key}
                          className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-[#1F2430] text-[11px] font-semibold cursor-pointer"
                        >
                          <span className="truncate">{label}</span>
                          <input
                            type="color"
                            value={chatSettings[key]}
                            onChange={(e) =>
                              updateChatSettings(
                                (s) => ({ ...s, [key]: e.target.value }),
                                false
                              )
                            }
                            className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer shrink-0"
                          />
                        </label>
                      ))}
                    </div>

                    <label className="block space-y-1">
                      <div className="flex justify-between text-[11px] font-semibold">
                        <span>Panel Opacity (Ghost Back)</span>
                        <span className="tabular-nums text-slate-500">
                          {Math.round(chatSettings.panelOpacity * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.15}
                        max={1}
                        step={0.01}
                        value={chatSettings.panelOpacity}
                        onChange={(e) =>
                          updateChatSettings(
                            (s) => ({ ...s, panelOpacity: Number(e.target.value) }),
                            false
                          )
                        }
                        className="w-full accent-[#7C5CFF]"
                      />
                    </label>

                    {/* Panel Material & Shape */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <label className="space-y-1">
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-[#949BB0]">
                          Panel Material
                        </span>
                        <select
                          value={chatSettings.panelTexture ?? 'smooth'}
                          onChange={(e) =>
                            updateChatSettings((s) => ({
                              ...s,
                              panelTexture: e.target.value as typeof s.panelTexture,
                            }))
                          }
                          className="w-full px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1F2430] text-xs font-semibold"
                        >
                          {HUD_SURFACE_TEXTURES.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-[#949BB0]">
                          Panel Shape
                        </span>
                        <select
                          value={chatSettings.panelShape ?? 'rounded'}
                          onChange={(e) =>
                            updateChatSettings((s) => ({
                              ...s,
                              panelShape: e.target.value as typeof s.panelShape,
                            }))
                          }
                          className="w-full px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1F2430] text-xs font-semibold"
                        >
                          {HUD_WIDGET_SHAPES.map((sh) => (
                            <option key={sh.id} value={sh.id}>
                              {sh.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <label className="space-y-1">
                        <div className="flex justify-between text-[10px] font-semibold">
                          <span>Wear</span>
                          <span className="tabular-nums text-slate-500">
                            {Math.round((chatSettings.panelEdgeWear ?? 0) * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={chatSettings.panelEdgeWear ?? 0}
                          onChange={(e) =>
                            updateChatSettings(
                              (s) => ({ ...s, panelEdgeWear: Number(e.target.value) }),
                              false
                            )
                          }
                          className="w-full accent-[#7C5CFF]"
                        />
                      </label>
                      <label className="space-y-1">
                        <div className="flex justify-between text-[10px] font-semibold">
                          <span>Burned</span>
                          <span className="tabular-nums text-slate-500">
                            {Math.round((chatSettings.panelBurnedEdges ?? 0) * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={chatSettings.panelBurnedEdges ?? 0}
                          onChange={(e) =>
                            updateChatSettings(
                              (s) => ({ ...s, panelBurnedEdges: Number(e.target.value) }),
                              false
                            )
                          }
                          className="w-full accent-[#7C5CFF]"
                        />
                      </label>
                      <label className="space-y-1">
                        <div className="flex justify-between text-[10px] font-semibold">
                          <span>Tears</span>
                          <span className="tabular-nums text-slate-500">
                            {Math.round((chatSettings.panelPaperTears ?? 0) * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={chatSettings.panelPaperTears ?? 0}
                          onChange={(e) =>
                            updateChatSettings(
                              (s) => ({ ...s, panelPaperTears: Number(e.target.value) }),
                              false
                            )
                          }
                          className="w-full accent-[#7C5CFF]"
                        />
                      </label>
                    </div>
                  </section>

                  <section className="space-y-3 pt-4 border-t border-slate-200/70 dark:border-white/[0.08]">
                    <FieldLabel text="Bottom Panel Layout & Behavior" />
                    <label className="flex items-center justify-between text-xs font-semibold cursor-pointer">
                      <span>Show character emblem / portrait badge</span>
                      <input
                        type="checkbox"
                        checked={chatSettings.panelShowPortrait}
                        onChange={(e) =>
                          updateChatSettings((s) => ({
                            ...s,
                            panelShowPortrait: e.target.checked,
                          }))
                        }
                        className="accent-[#7C5CFF] w-4 h-4"
                      />
                    </label>

                    <label className="flex items-center justify-between text-xs font-semibold cursor-pointer">
                      <span>Include expandable chat history log</span>
                      <input
                        type="checkbox"
                        checked={chatSettings.panelShowHistory}
                        onChange={(e) =>
                          updateChatSettings((s) => ({
                            ...s,
                            panelShowHistory: e.target.checked,
                          }))
                        }
                        className="accent-[#7C5CFF] w-4 h-4"
                      />
                    </label>

                    <label className="flex items-center justify-between text-xs font-semibold cursor-pointer">
                      <span>Pause character movement while reading</span>
                      <input
                        type="checkbox"
                        checked={chatSettings.panelPauseGame}
                        onChange={(e) =>
                          updateChatSettings((s) => ({
                            ...s,
                            panelPauseGame: e.target.checked,
                          }))
                        }
                        className="accent-[#7C5CFF] w-4 h-4"
                      />
                    </label>

                    <label className="flex items-center justify-between text-xs font-semibold cursor-pointer">
                      <span>Compact bottom bar height</span>
                      <input
                        type="checkbox"
                        checked={chatSettings.panelCompact}
                        onChange={(e) =>
                          updateChatSettings((s) => ({
                            ...s,
                            panelCompact: e.target.checked,
                          }))
                        }
                        className="accent-[#7C5CFF] w-4 h-4"
                      />
                    </label>
                  </section>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
