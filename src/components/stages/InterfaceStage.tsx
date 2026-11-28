import React, { useRef, useState } from 'react';
import {
  Backpack,
  Copy,
  Gamepad2,
  Layers,
  MessageCircle,
  Palette,
  PanelBottom,
  Plus,
  RotateCcw,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  CHAT_FONT_OPTIONS,
  resolveChatBubbleStyle,
  resolveChatDisplaySettings,
} from '../../data/chatBubblePresets';
import {
  applyHudThemeToWidgets,
  HUD_THEME_PRESETS,
  type HudThemePreset,
} from '../../data/hudStylePresets';
import {
  ActionButtonBindings,
  formatKeyCodeLabel,
  resolveGameInventoryConfig,
  StatLibrary,
  WidgetAnchors,
  WidgetKindMeta,
} from '../../data/registries';
import type { MakerStore } from '../../store/useMakerStore';
import type {
  ActionButtonBinding,
  ChatFontId,
  DialogueOutputMode,
  HUDWidget,
  WidgetAnchor,
  WidgetKind,
} from '../../types/maker';
import {
  HUD_BAR_STYLES,
  HUD_BORDER_STYLES,
  HUD_BUTTON_STYLES,
  HUD_JOYSTICK_STYLES,
  HUD_SURFACE_TEXTURES,
  HUD_WIDGET_SHAPES,
} from '../../utils/hudMaterials';
import { BottomChatPanelView, ChatBubbleView } from '../shared/ChatBubbleRenderer';
import { ChatBubbleStudioModal } from '../shared/ChatBubbleStudioModal';
import { DefaultPreviewHUDState, HUDWidgetView } from '../shared/HUDWidgetPreview';
import { MakerIcon } from '../shared/IconMap';
import { InventoryStudioModal } from '../shared/InventoryStudioModal';
import { FieldLabel } from '../shared/MakerUI';
import {
  setContextualAiPanelOpen,
  useContextualAiPanelState,
} from '../../ai/studioBridge';
import { ContextualAiPanel } from '../shared/ContextualAiModal';

const SWATCHES = [
  '#F2545B',
  '#F59E0B',
  '#FACC15',
  '#20B46A',
  '#38BDF8',
  '#7C5CFF',
  '#E8D2A9',
  '#6B4223',
  '#1E2434',
  '#FFFFFF',
];

type PreviewBackdropId = 'meadow' | 'dungeon' | 'scifi' | 'parchment';
type InspectorTabId = 'style' | 'shape' | 'controls' | 'layout';

const PREVIEW_BACKDROPS: { id: PreviewBackdropId; label: string; bg: string }[] = [
  {
    id: 'meadow',
    label: 'Daylight',
    bg: 'linear-gradient(180deg, #4B9AE8 0%, #86CEF7 52%, #68B35B 52%, #47873E 100%)',
  },
  {
    id: 'dungeon',
    label: 'Night / Dungeon',
    bg: 'radial-gradient(circle at 50% 35%, #2B263B 0%, #15121F 55%, #09080E 100%)',
  },
  {
    id: 'scifi',
    label: 'Deep Space',
    bg: 'radial-gradient(circle at 72% 28%, #103A5C 0%, #071326 54%, #020611 100%)',
  },
  {
    id: 'parchment',
    label: 'Warm Dusk',
    bg: 'linear-gradient(180deg, #C87B49 0%, #E7B983 48%, #5D4A36 48%, #342619 100%)',
  },
];

export function computeWidgetPosition(
  widget: HUDWidget,
  width: number,
  height: number
): { left: number; top: number } {
  const pad = 16;
  const hw = widget.width / 2;
  const hh = widget.height / 2;

  let cx = width / 2;
  let cy = height / 2;

  switch (widget.anchor) {
    case 'topLeading':
      cx = pad + hw;
      cy = pad + hh;
      break;
    case 'top':
      cx = width / 2;
      cy = pad + hh;
      break;
    case 'topTrailing':
      cx = width - pad - hw;
      cy = pad + hh;
      break;
    case 'bottomLeading':
      cx = pad + hw;
      cy = height - pad - hh;
      break;
    case 'bottom':
      cx = width / 2;
      cy = height - pad - hh;
      break;
    case 'bottomTrailing':
      cx = width - pad - hw;
      cy = height - pad - hh;
      break;
    case 'center':
      cx = width / 2;
      cy = height / 2;
      break;
  }

  return {
    left: cx + widget.offsetX - hw,
    top: cy + widget.offsetY - hh,
  };
}

export const InterfaceStage: React.FC<{ store: MakerStore }> = ({ store }) => {
  const { currentProject, currentLevel, currentWidget } = store;
  const aiPanelState = useContextualAiPanelState();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [showingChatStudio, setShowingChatStudio] = useState(false);
  const [showingInventoryStudio, setShowingInventoryStudio] = useState(false);
  const [backdrop, setBackdrop] = useState<PreviewBackdropId>('meadow');
  const [inspectorTab, setInspectorTab] = useState<InspectorTabId>('style');
  const [notice, setNotice] = useState<string | null>(null);

  if (!currentProject) return null;

  const invConfig = resolveGameInventoryConfig(currentProject);
  const chatSettings = resolveChatDisplaySettings(currentProject.chatSettings);
  const sampleNpc = currentLevel?.entities.find((e) => e.kind === 'npc' || e.kind === 'sign');
  const sampleStyle = resolveChatBubbleStyle(sampleNpc?.chatBubble, sampleNpc?.kind ?? 'npc');
  const sampleSpeaker = sampleNpc?.name ?? 'Mira';
  const sampleText =
    sampleNpc?.dialogue?.trim().split('\n')[0] || 'A key? The guard dropped one by the well.';

  const widgets = currentProject.hud.widgets;
  const stageWidth = 680;
  const stageHeight = 420;
  const activeBackdrop =
    PREVIEW_BACKDROPS.find((b) => b.id === backdrop) ?? PREVIEW_BACKDROPS[0];

  const flashNotice = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 2600);
  };

  const applyFullInterfaceTheme = (preset: HudThemePreset) => {
    store.updateProject(`apply ${preset.name} interface theme`, (p) => {
      const styledWidgets = applyHudThemeToWidgets(p.hud.widgets, preset);
      const nextHeroBubble = {
        ...resolveChatBubbleStyle(p.heroChatBubble, 'hero'),
        ...preset.chatBubbleStyle,
      };
      const nextChatSettings = {
        ...resolveChatDisplaySettings(p.chatSettings),
        ...preset.chatPanelSettings,
      };
      const nextLevels = p.levels.map((lvl) => ({
        ...lvl,
        entities: lvl.entities.map((ent) =>
          ent.kind === 'npc' || ent.kind === 'sign' || ent.kind === 'baddie'
            ? {
                ...ent,
                chatBubble: {
                  ...resolveChatBubbleStyle(ent.chatBubble, ent.kind),
                  ...preset.chatBubbleStyle,
                },
              }
            : ent
        ),
      }));
      return {
        ...p,
        hud: {
          ...p.hud,
          themeName: preset.name,
          presetId: preset.id,
          defaultFontFamily: preset.fontFamily,
          defaultTexture: preset.surfaceTexture,
          defaultOpacity: preset.opacity,
          widgets: styledWidgets,
        },
        heroChatBubble: nextHeroBubble,
        chatSettings: nextChatSettings,
        levels: nextLevels,
      };
    });
    flashNotice(`Applied "${preset.name}" across HUD, controls & speech bubbles`);
  };

  const handleCopyStyleToAllWidgets = () => {
    if (!currentWidget) return;
    store.updateProject('apply widget style to all HUD elements', (p) => ({
      ...p,
      hud: {
        ...p.hud,
        widgets: p.hud.widgets.map((w) => ({
          ...w,
          surfaceTexture: currentWidget.surfaceTexture,
          bgHex: currentWidget.bgHex,
          borderHex: currentWidget.borderHex,
          textHex: currentWidget.textHex,
          glowHex: currentWidget.glowHex,
          borderStyle: currentWidget.borderStyle,
          borderWidth: currentWidget.borderWidth,
          cornerRadius: currentWidget.cornerRadius,
          edgeWear: currentWidget.edgeWear,
          burnedEdges: currentWidget.burnedEdges,
          paperTears: w.kind === 'joystick' || w.kind === 'actionButton' ? 0 : currentWidget.paperTears,
          organicWobble: currentWidget.organicWobble,
          glowIntensity: currentWidget.glowIntensity,
          shadowDepth: currentWidget.shadowDepth,
          opacity: currentWidget.opacity,
          fontFamily: currentWidget.fontFamily,
          uppercase: currentWidget.uppercase,
          textGlow: currentWidget.textGlow,
          ...(w.kind === 'actionButton' || w.kind === 'pauseButton'
            ? { buttonStyle: currentWidget.buttonStyle ?? w.buttonStyle }
            : {}),
          ...(w.kind === 'joystick'
            ? { joystickStyle: currentWidget.joystickStyle ?? w.joystickStyle }
            : {}),
          ...(w.kind === 'bar' || w.kind === 'bossBar'
            ? { barStyle: currentWidget.barStyle ?? w.barStyle }
            : {}),
        })),
      },
    }));
    flashNotice('Copied surface, wear, typography & opacity to every widget');
  };

  const handleDuplicateSelected = () => {
    if (!currentWidget) return;
    const dupId = `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    store.updateProject('duplicate HUD widget', (p) => ({
      ...p,
      hud: {
        ...p.hud,
        widgets: [
          ...p.hud.widgets,
          {
            ...currentWidget,
            id: dupId,
            offsetX: currentWidget.offsetX + 18,
            offsetY: currentWidget.offsetY + 18,
          },
        ],
      },
    }));
    store.setSelectedWidgetID(dupId);
  };

  const handleWidgetDragStart = (widget: HUDWidget, e: React.PointerEvent) => {
    e.stopPropagation();
    store.setSelectedWidgetID(widget.id);
    const stageRect = stageRef.current?.getBoundingClientRect();
    const scaleX = stageRect ? stageWidth / Math.max(1, stageRect.width) : 1;
    const scaleY = stageRect ? stageHeight / Math.max(1, stageRect.height) : 1;
    const startX = e.clientX;
    const startY = e.clientY;
    const origOX = widget.offsetX;
    const origOY = widget.offsetY;

    const onMove = (me: PointerEvent) => {
      const dx = (me.clientX - startX) * scaleX;
      const dy = (me.clientY - startY) * scaleY;
      store.updateWidget(
        widget.id,
        'move HUD widget',
        (w) => ({
          ...w,
          offsetX: Math.round(origOX + dx),
          offsetY: Math.round(origOY + dy),
        }),
        false
      );
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const updateCurrent = (
    label: string,
    updater: (w: HUDWidget) => HUDWidget,
    recordUndo = true
  ) => {
    if (!currentWidget) return;
    store.updateWidget(currentWidget.id, label, updater, recordUndo);
  };

  return (
    <div className="h-full min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden maker-scroll">
      {/* Left Sidebar: AI Interface Designer OR Themes, Chat, Inventory & Widget List */}
      {aiPanelState.isOpen ? (
        <aside className="w-full lg:w-80 shrink-0 lg:h-full lg:min-h-0 bg-white dark:bg-[#171A23] border-b lg:border-b-0 lg:border-r border-slate-200/80 dark:border-white/[0.08] overflow-hidden flex flex-col">
          <ContextualAiPanel
            store={store}
            initialContext={aiPanelState.preferredContext ?? 'interface'}
            embedded
            onClose={() => setContextualAiPanelOpen(false)}
          />
        </aside>
      ) : (
        <aside className="w-full lg:w-76 shrink-0 lg:h-full lg:min-h-0 bg-white dark:bg-[#171A23] border-b lg:border-b-0 lg:border-r border-slate-200/80 dark:border-white/[0.08] lg:overflow-y-auto maker-scroll p-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-extrabold">Interface Studio</h2>
            <button
              type="button"
              onClick={() => store.resetHUDToDefault()}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-[10px] font-bold text-slate-600 dark:text-[#949BB0] hover:text-[#7C5CFF] whitespace-nowrap"
              title="Reset controls & HUD layout"
            >
              <RotateCcw size={10} />
              <span>Reset</span>
            </button>
          </div>

          {/* Direct AI Interface Stylist CTA */}
          <button
            type="button"
            onClick={() => setContextualAiPanelOpen(true, 'interface')}
            className="w-full p-3 rounded-2xl bg-gradient-to-r from-[#7C5CFF] to-[#EC4899] text-white text-left shadow-sm hover:brightness-105 transition-all flex items-center gap-2.5"
          >
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Sparkles size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-extrabold leading-tight">Design Interface with AI</div>
              <div className="text-[10px] text-white/85 leading-snug truncate">
                Describe parchment, sci-fi metal, 3D arcade, comic…
              </div>
            </div>
          </button>

          {/* One-Click Full-Interface Theme Gallery */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <FieldLabel text="Interface Themes" />
              <span className="text-[10px] text-slate-400 font-semibold">Full HUD + Bubbles</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {HUD_THEME_PRESETS.map((preset) => {
                const active = currentProject.hud.presetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyFullInterfaceTheme(preset)}
                    className={`p-2 rounded-xl border text-left transition-all ${
                      active
                        ? 'border-[#7C5CFF] ring-2 ring-[#7C5CFF]/25 bg-[#7C5CFF]/10'
                        : 'border-slate-200/80 dark:border-white/[0.08] bg-slate-50 dark:bg-[#1B1F2B] hover:border-[#7C5CFF]/45'
                    }`}
                    title={preset.tagline}
                  >
                    <div
                      className="w-full h-3.5 rounded-md mb-1.5 border border-black/15"
                      style={{ background: preset.swatchGradient }}
                    />
                    <div className="text-[10.5px] font-extrabold leading-tight truncate">
                      {preset.name}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dialogue Display Mode: Floating 3D Chat Bubbles vs Bottom Chat Panel */}
          <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2.5">
            <div className="flex items-center justify-between">
              <FieldLabel text="Speech Bubbles & Chat" />
              <button
                type="button"
                onClick={() => setShowingChatStudio(true)}
                className="text-[11px] font-bold text-[#7C5CFF] hover:underline inline-flex items-center gap-1 whitespace-nowrap"
              >
                <SlidersHorizontal size={11} />
                <span>Style Studio</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-white dark:bg-[#171A23]">
              <button
                type="button"
                onClick={() =>
                  store.updateProject('switch to 3D chat bubbles', (p) => ({
                    ...p,
                    chatSettings: {
                      ...resolveChatDisplaySettings(p.chatSettings),
                      displayMode: 'bubbles',
                    },
                  }))
                }
                className={`py-1.5 px-2 rounded-lg text-[11px] font-bold inline-flex items-center justify-center gap-1 transition-colors whitespace-nowrap ${
                  chatSettings.displayMode === 'bubbles'
                    ? 'bg-[#7C5CFF] text-white'
                    : 'text-slate-600 dark:text-[#949BB0]'
                }`}
              >
                <MessageCircle size={12} />
                <span>Chat Bubbles</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  store.updateProject('switch to bottom chat panel', (p) => ({
                    ...p,
                    chatSettings: {
                      ...resolveChatDisplaySettings(p.chatSettings),
                      displayMode: 'bottomPanel',
                    },
                  }))
                }
                className={`py-1.5 px-2 rounded-lg text-[11px] font-bold inline-flex items-center justify-center gap-1 transition-colors whitespace-nowrap ${
                  chatSettings.displayMode === 'bottomPanel'
                    ? 'bg-[#7C5CFF] text-white'
                    : 'text-slate-600 dark:text-[#949BB0]'
                }`}
              >
                <PanelBottom size={12} />
                <span>Bottom Panel</span>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-200/70 dark:border-white/[0.08] space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-[#949BB0]">
                <span>Dialogue Format</span>
                <span>
                  {(chatSettings.dialogueMode ?? 'both') === 'both'
                    ? 'Text + Audio'
                    : chatSettings.dialogueMode === 'audio'
                    ? 'Audio only'
                    : 'Text only'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-white dark:bg-[#171A23]">
                {(
                  [
                    { id: 'text', label: 'Text' },
                    { id: 'audio', label: 'Audio' },
                    { id: 'both', label: 'Both' },
                  ] as { id: DialogueOutputMode; label: string }[]
                ).map((opt) => {
                  const active = (chatSettings.dialogueMode ?? 'both') === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        store.updateProject(`set dialogue format to ${opt.id}`, (p) => ({
                          ...p,
                          chatSettings: {
                            ...resolveChatDisplaySettings(p.chatSettings),
                            dialogueMode: opt.id,
                          },
                        }))
                      }
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-[#7C5CFF] text-white'
                          : 'text-slate-600 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Inventory & Workbench Customizer */}
          <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Backpack size={13} className="text-[#20B46A]" />
                <FieldLabel text="Inventory & Workbench" />
              </div>
              <button
                type="button"
                onClick={() => setShowingInventoryStudio(true)}
                className="text-[11px] font-bold text-[#7C5CFF] hover:underline inline-flex items-center gap-1 whitespace-nowrap"
              >
                <SlidersHorizontal size={11} />
                <span>Customize</span>
              </button>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-[#949BB0]">
              <span>Hotkey: {formatKeyCodeLabel(invConfig.toggleKey)}</span>
              <span className="tabular-nums">
                {invConfig.categories.length} tabs ·{' '}
                {invConfig.worldCollectibles.filter((w) => w.enabled).length} harvestable
              </span>
            </div>
          </div>

          {/* On-Screen Widgets List */}
          <div className="space-y-1.5">
            <FieldLabel text={`On-Screen Elements (${widgets.length})`} />
            {widgets.map((w) => {
              const meta = WidgetKindMeta[w.kind];
              const stat = StatLibrary.find((s) => s.id === w.binding);
              const selected = w.id === store.selectedWidgetID;
              const subtitle =
                w.kind === 'actionButton'
                  ? ActionButtonBindings.find((b) => b.id === (w.actionId ?? 'jump'))?.title ??
                    'Button'
                  : w.kind === 'joystick'
                  ? HUD_JOYSTICK_STYLES.find((j) => j.id === (w.joystickStyle ?? 'modern'))
                      ?.label ?? 'Thumbstick'
                  : stat?.title ?? meta.title;
              return (
                <div
                  key={w.id}
                  onClick={() => store.setSelectedWidgetID(w.id)}
                  className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer ${
                    selected
                      ? 'bg-[#7C5CFF]/15 border-[#7C5CFF]/50'
                      : 'border-transparent hover:bg-slate-100 dark:hover:bg-[#1F2430]'
                  }`}
                >
                  <MakerIcon symbol={meta.symbol} size={15} color={w.fillHex} />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold truncate">{w.label || meta.title}</div>
                    <div className="text-[10px] text-slate-500 dark:text-[#949BB0] truncate">
                      {subtitle} · {w.width}×{w.height}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      store.deleteWidget(w.id);
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:text-[#F2545B]"
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-200/70 dark:border-white/[0.08] space-y-2">
            <FieldLabel text="Add a HUD or control part" />
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(WidgetKindMeta) as WidgetKind[]).map((kind) => {
                const meta = WidgetKindMeta[kind];
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => store.addWidget(kind)}
                    className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-[#1F2430] hover:bg-slate-200 dark:hover:bg-[#272D3C] text-[11px] font-bold text-left"
                  >
                    <Plus size={11} className="text-[#7C5CFF] shrink-0" />
                    <span className="truncate">{meta.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
      )}

      {/* Center: Interactive Live HUD & Controls Canvas */}
      <main className="shrink-0 lg:shrink lg:flex-1 lg:h-full lg:min-h-0 lg:min-w-0 flex flex-col items-center p-4 sm:p-6 lg:overflow-auto maker-scroll">
        <div className="w-full max-w-[780px] space-y-2.5 my-auto">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200">
                Live UI & Controls Canvas
              </span>
              {notice && (
                <span className="text-[11px] font-bold text-[#20B46A]">{notice}</span>
              )}
            </div>
            {/* Backdrop switcher for testing ghost opacity & glowing themes */}
            <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-[#1F2430] p-0.5 rounded-xl">
              {PREVIEW_BACKDROPS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBackdrop(b.id)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors whitespace-nowrap ${
                    backdrop === b.id
                      ? 'bg-white dark:bg-[#2D3446] text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          <div
            ref={stageRef}
            onClick={() => store.setSelectedWidgetID(null)}
            className="relative w-full aspect-[16/10] rounded-3xl overflow-hidden shadow-xl border border-black/25 dark:border-white/[0.12] select-none"
            style={{ background: activeBackdrop.bg }}
          >
            <div className="absolute left-1/2 top-[56%] -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />

            {/* Live preview of either overhead Chat Bubble or docked Bottom Chat Panel */}
            {chatSettings.displayMode === 'bubbles' ? (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setShowingChatStudio(true);
                }}
                className="absolute left-1/2 top-[34%] -translate-x-1/2 -translate-y-1/2 z-10 cursor-pointer hover:scale-[1.02] transition-transform"
                title="Click to customize character speech bubbles"
              >
                <ChatBubbleView
                  speaker={sampleSpeaker}
                  text={sampleText}
                  style={sampleStyle}
                  kind={sampleNpc?.kind ?? 'npc'}
                  compact
                />
              </div>
            ) : (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setShowingChatStudio(true);
                }}
                className="absolute inset-x-10 bottom-3 z-20 cursor-pointer"
                title="Click to customize the bottom chat panel"
              >
                <BottomChatPanelView
                  speaker={sampleSpeaker}
                  roleLabel="NPC"
                  text={sampleText}
                  characterStyle={sampleStyle}
                  kind={sampleNpc?.kind ?? 'npc'}
                  settings={chatSettings}
                  previewMode
                />
              </div>
            )}

            {widgets.map((w) => {
              const pos = computeWidgetPosition(w, stageWidth, stageHeight);
              const leftPct = (pos.left / stageWidth) * 100;
              const topPct = (pos.top / stageHeight) * 100;
              const widthPct = (w.width / stageWidth) * 100;
              const heightPct = (w.height / stageHeight) * 100;
              return (
                <div
                  key={w.id}
                  onPointerDown={(e) => handleWidgetDragStart(w, e)}
                  className="absolute cursor-move touch-none"
                  style={{
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    width: `${widthPct}%`,
                    height: `${heightPct}%`,
                  }}
                >
                  <HUDWidgetView
                    widget={w}
                    state={DefaultPreviewHUDState}
                    isSelected={w.id === store.selectedWidgetID}
                  />
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-[#949BB0] px-1">
            <span>Drag any control or HUD panel to place it. Click speech bubble to style dialogue.</span>
            <span className="font-semibold tabular-nums">
              Theme: {currentProject.hud.themeName || 'Custom'}
            </span>
          </div>
        </div>
      </main>

      {/* Right Inspector: Unrestricted Material, Shape & Wear, 3D Controls & Layout Studio */}
      <aside className="w-full lg:w-84 shrink-0 lg:h-full lg:min-h-0 bg-white dark:bg-[#171A23] border-t lg:border-t-0 lg:border-l border-slate-200/80 dark:border-white/[0.08] flex flex-col overflow-hidden">
        {currentWidget ? (
          <>
            <div className="p-4 pb-2 border-b border-slate-200/80 dark:border-white/[0.08] space-y-2.5 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-extrabold truncate">
                  {currentWidget.label || WidgetKindMeta[currentWidget.kind].title}
                </h3>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleCopyStyleToAllWidgets}
                    className="px-2 py-1 rounded-lg bg-[#7C5CFF]/15 text-[#7C5CFF] hover:bg-[#7C5CFF]/25 text-[10px] font-bold inline-flex items-center gap-1 whitespace-nowrap"
                    title="Apply this element's material, wear, font & opacity to every HUD widget"
                  >
                    <Copy size={10} />
                    <span>Apply to All</span>
                  </button>
                </div>
              </div>

              {/* 4 clean single-line studio tabs */}
              <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#1F2430]">
                {(
                  [
                    { id: 'style', label: 'Style', icon: Palette },
                    { id: 'shape', label: 'Shape', icon: Scissors },
                    { id: 'controls', label: 'Controls', icon: Gamepad2 },
                    { id: 'layout', label: 'Layout', icon: Layers },
                  ] as const
                ).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setInspectorTab(id)}
                    className={`py-1.5 px-1 rounded-lg text-[10.5px] font-bold inline-flex items-center justify-center gap-1 transition-colors whitespace-nowrap ${
                      inspectorTab === id
                        ? 'bg-[#7C5CFF] text-white shadow-xs'
                        : 'text-slate-600 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon size={11} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto maker-scroll p-4 space-y-4">
              {/* TAB 1: SURFACE MATERIAL, COLORS, TYPOGRAPHY & GHOST OPACITY */}
              {inspectorTab === 'style' && (
                <>
                  {/* Material Texture Swatches */}
                  <div className="space-y-1.5">
                    <FieldLabel text="Surface Material & Texture" />
                    <div className="grid grid-cols-2 gap-1.5">
                      {HUD_SURFACE_TEXTURES.map((tex) => {
                        const active = (currentWidget.surfaceTexture ?? 'smooth') === tex.id;
                        return (
                          <button
                            key={tex.id}
                            type="button"
                            onClick={() =>
                              updateCurrent(`set material ${tex.label}`, (w) => ({
                                ...w,
                                surfaceTexture: tex.id,
                                bgHex: w.bgHex ? w.bgHex : tex.defaultBgHex,
                                borderHex: w.borderHex ? w.borderHex : tex.defaultBorderHex,
                                textHex:
                                  tex.id === 'parchment' ||
                                  tex.id === 'comicHalftone' ||
                                  tex.id === 'fabricCanvas'
                                    ? tex.defaultTextHex
                                    : w.textHex ?? tex.defaultTextHex,
                              }))
                            }
                            className={`px-2 py-1.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                              active
                                ? 'border-[#7C5CFF] bg-[#7C5CFF]/12 text-[#7C5CFF]'
                                : 'border-slate-200/70 dark:border-white/[0.08] bg-slate-50 dark:bg-[#1B1F2B] hover:border-[#7C5CFF]/40'
                            }`}
                            title={tex.blurb}
                          >
                            <span
                              className="w-4 h-4 rounded-md shrink-0 border border-black/20"
                              style={{ background: tex.previewBg }}
                            />
                            <span className="text-[11px] font-bold truncate">{tex.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Unrestricted Color Pickers */}
                  <div className="space-y-2 pt-3 border-t border-slate-200/70 dark:border-white/[0.08]">
                    <FieldLabel text="Colors (Unrestricted)" />
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          {
                            key: 'fillHex',
                            label: currentWidget.kind === 'joystick' ? 'Base Fill' : 'Accent / Fill',
                            fallback: '#7C5CFF',
                          },
                          { key: 'bgHex', label: 'Surface BG', fallback: '#121822' },
                          { key: 'borderHex', label: 'Border Trim', fallback: '#94A3B8' },
                          { key: 'textHex', label: 'Text / Icon', fallback: '#FFFFFF' },
                          { key: 'glowHex', label: 'Glow Aura', fallback: '#38BDF8' },
                        ] as const
                      ).map(({ key, label, fallback }) => {
                        const val =
                          (currentWidget[key] as string | undefined) ??
                          (key === 'fillHex' ? currentWidget.fillHex : fallback);
                        const safeHex = val.startsWith('#') && val.length === 7 ? val : fallback;
                        return (
                          <label
                            key={key}
                            className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1F2430] text-[11px] font-semibold cursor-pointer"
                          >
                            <span className="truncate">{label}</span>
                            <input
                              type="color"
                              value={safeHex}
                              onChange={(e) =>
                                updateCurrent(
                                  `change ${label}`,
                                  (w) => ({ ...w, [key]: e.target.value }),
                                  false
                                )
                              }
                              className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer shrink-0"
                            />
                          </label>
                        );
                      })}
                    </div>

                    {/* Quick Swatches for primary fill */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {SWATCHES.map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() =>
                            updateCurrent('widget color', (w) => ({ ...w, fillHex: hex }))
                          }
                          className={`w-6 h-6 rounded-full border ${
                            currentWidget.fillHex === hex
                              ? 'ring-2 ring-slate-900 dark:ring-white ring-offset-1 dark:ring-offset-[#171A23]'
                              : 'border-black/20'
                          }`}
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Ghost Opacity, Glow Aura & 3D Depth */}
                  <div className="space-y-2.5 pt-3 border-t border-slate-200/70 dark:border-white/[0.08]">
                    <FieldLabel text="Opacity, Glow & Depth" />
                    <label className="block space-y-1">
                      <div className="flex justify-between text-[11px] font-semibold">
                        <span>Opacity (Ghost Back)</span>
                        <span className="tabular-nums text-slate-500">
                          {Math.round((currentWidget.opacity ?? 0.92) * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.08}
                        max={1}
                        step={0.02}
                        value={currentWidget.opacity ?? 0.92}
                        onChange={(e) =>
                          updateCurrent(
                            'widget opacity',
                            (w) => ({ ...w, opacity: Number(e.target.value) }),
                            false
                          )
                        }
                        className="w-full accent-[#7C5CFF]"
                      />
                    </label>

                    <label className="block space-y-1">
                      <div className="flex justify-between text-[11px] font-semibold">
                        <span>Neon / Magic Glow</span>
                        <span className="tabular-nums text-slate-500">
                          {Math.round((currentWidget.glowIntensity ?? 0) * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={currentWidget.glowIntensity ?? 0}
                        onChange={(e) =>
                          updateCurrent(
                            'widget glow',
                            (w) => ({ ...w, glowIntensity: Number(e.target.value) }),
                            false
                          )
                        }
                        className="w-full accent-[#7C5CFF]"
                      />
                    </label>

                    <label className="block space-y-1">
                      <div className="flex justify-between text-[11px] font-semibold">
                        <span>3D Shadow Depth</span>
                        <span className="tabular-nums text-slate-500">
                          {Math.round((currentWidget.shadowDepth ?? 0.35) * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={currentWidget.shadowDepth ?? 0.35}
                        onChange={(e) =>
                          updateCurrent(
                            'widget shadow',
                            (w) => ({ ...w, shadowDepth: Number(e.target.value) }),
                            false
                          )
                        }
                        className="w-full accent-[#7C5CFF]"
                      />
                    </label>
                  </div>

                  {/* Typography */}
                  <div className="space-y-2 pt-3 border-t border-slate-200/70 dark:border-white/[0.08]">
                    <FieldLabel text="Typeface & Lettering" />
                    <select
                      value={currentWidget.fontFamily ?? 'sans'}
                      onChange={(e) =>
                        updateCurrent('widget font', (w) => ({
                          ...w,
                          fontFamily: e.target.value as ChatFontId,
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#1F2430] text-xs font-semibold"
                    >
                      {CHAT_FONT_OPTIONS.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.label} — {f.sample}
                        </option>
                      ))}
                    </select>

                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          updateCurrent('toggle uppercase', (w) => ({
                            ...w,
                            uppercase: !w.uppercase,
                          }))
                        }
                        className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-colors whitespace-nowrap ${
                          currentWidget.uppercase
                            ? 'bg-[#7C5CFF] border-[#7C5CFF] text-white'
                            : 'bg-slate-100 dark:bg-[#1F2430] border-transparent text-slate-600 dark:text-[#949BB0]'
                        }`}
                      >
                        ALL CAPS
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateCurrent('toggle text glow', (w) => ({
                            ...w,
                            textGlow: !w.textGlow,
                          }))
                        }
                        className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-colors whitespace-nowrap ${
                          currentWidget.textGlow
                            ? 'bg-[#7C5CFF] border-[#7C5CFF] text-white'
                            : 'bg-slate-100 dark:bg-[#1F2430] border-transparent text-slate-600 dark:text-[#949BB0]'
                        }`}
                      >
                        Text Glow
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* TAB 2: ARBITRARY SHAPE, BORDERS, ORGANIC WEAR, BURNS & TEARS */}
              {inspectorTab === 'shape' && (
                <>
                  <div className="space-y-1.5">
                    <FieldLabel text="Element Shape (Any Silhouette)" />
                    <div className="grid grid-cols-3 gap-1.5">
                      {HUD_WIDGET_SHAPES.map((sh) => {
                        const active = (currentWidget.shape ?? 'rounded') === sh.id;
                        return (
                          <button
                            key={sh.id}
                            type="button"
                            onClick={() =>
                              updateCurrent(`shape ${sh.label}`, (w) => ({
                                ...w,
                                shape: sh.id,
                              }))
                            }
                            className={`py-1.5 px-1.5 rounded-xl text-[10.5px] font-bold border flex items-center justify-center gap-1 transition-colors whitespace-nowrap ${
                              active
                                ? 'border-[#7C5CFF] bg-[#7C5CFF]/15 text-[#7C5CFF]'
                                : 'border-transparent bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#949BB0]'
                            }`}
                          >
                            <span>{sh.icon}</span>
                            <span className="truncate">{sh.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Border Style & Corner Radius */}
                  <div className="space-y-2.5 pt-3 border-t border-slate-200/70 dark:border-white/[0.08]">
                    <FieldLabel text="Border & Frame Trim" />
                    <div className="grid grid-cols-3 gap-1.5">
                      {HUD_BORDER_STYLES.map((bs) => {
                        const active = (currentWidget.borderStyle ?? 'solid') === bs.id;
                        return (
                          <button
                            key={bs.id}
                            type="button"
                            onClick={() =>
                              updateCurrent(`border ${bs.label}`, (w) => ({
                                ...w,
                                borderStyle: bs.id,
                              }))
                            }
                            className={`py-1.5 px-1.5 rounded-xl text-[10.5px] font-bold border transition-colors whitespace-nowrap ${
                              active
                                ? 'border-[#7C5CFF] bg-[#7C5CFF]/15 text-[#7C5CFF]'
                                : 'border-transparent bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#949BB0]'
                            }`}
                          >
                            {bs.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="space-y-1">
                        <div className="flex justify-between text-[11px] font-semibold">
                          <span>Border Width</span>
                          <span className="tabular-nums text-slate-500">
                            {currentWidget.borderWidth ?? 1.5}px
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={6}
                          step={0.5}
                          value={currentWidget.borderWidth ?? 1.5}
                          onChange={(e) =>
                            updateCurrent(
                              'border width',
                              (w) => ({ ...w, borderWidth: Number(e.target.value) }),
                              false
                            )
                          }
                          className="w-full accent-[#7C5CFF]"
                        />
                      </label>
                      <label className="space-y-1">
                        <div className="flex justify-between text-[11px] font-semibold">
                          <span>Corner Radius</span>
                          <span className="tabular-nums text-slate-500">
                            {currentWidget.cornerRadius ?? 12}px
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={48}
                          step={1}
                          value={currentWidget.cornerRadius ?? 12}
                          onChange={(e) =>
                            updateCurrent(
                              'corner radius',
                              (w) => ({ ...w, cornerRadius: Number(e.target.value) }),
                              false
                            )
                          }
                          className="w-full accent-[#7C5CFF]"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Organic Wear, Scorched/Burned Edges, Paper Tears & Tilt */}
                  <div className="space-y-2.5 pt-3 border-t border-slate-200/70 dark:border-white/[0.08]">
                    <FieldLabel text="Organic Edge Wear, Burns & Tears" />
                    <label className="block space-y-1">
                      <div className="flex justify-between text-[11px] font-semibold">
                        <span>Organic Rough Edge Wear</span>
                        <span className="tabular-nums text-slate-500">
                          {Math.round((currentWidget.edgeWear ?? 0) * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={currentWidget.edgeWear ?? 0}
                        onChange={(e) =>
                          updateCurrent(
                            'edge wear',
                            (w) => ({ ...w, edgeWear: Number(e.target.value) }),
                            false
                          )
                        }
                        className="w-full accent-[#7C5CFF]"
                      />
                    </label>

                    <label className="block space-y-1">
                      <div className="flex justify-between text-[11px] font-semibold">
                        <span>Burned / Scorched Edges</span>
                        <span className="tabular-nums text-slate-500">
                          {Math.round((currentWidget.burnedEdges ?? 0) * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={currentWidget.burnedEdges ?? 0}
                        onChange={(e) =>
                          updateCurrent(
                            'burned edges',
                            (w) => ({ ...w, burnedEdges: Number(e.target.value) }),
                            false
                          )
                        }
                        className="w-full accent-[#7C5CFF]"
                      />
                    </label>

                    <label className="block space-y-1">
                      <div className="flex justify-between text-[11px] font-semibold">
                        <span>Torn / Deckled Paper Bites</span>
                        <span className="tabular-nums text-slate-500">
                          {Math.round((currentWidget.paperTears ?? 0) * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={currentWidget.paperTears ?? 0}
                        onChange={(e) =>
                          updateCurrent(
                            'paper tears',
                            (w) => ({ ...w, paperTears: Number(e.target.value) }),
                            false
                          )
                        }
                        className="w-full accent-[#7C5CFF]"
                      />
                    </label>

                    <label className="block space-y-1">
                      <div className="flex justify-between text-[11px] font-semibold">
                        <span>Organic Wobble / Hand Tilt</span>
                        <span className="tabular-nums text-slate-500">
                          {Math.round((currentWidget.organicWobble ?? 0) * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={currentWidget.organicWobble ?? 0}
                        onChange={(e) =>
                          updateCurrent(
                            'organic wobble',
                            (w) => ({ ...w, organicWobble: Number(e.target.value) }),
                            false
                          )
                        }
                        className="w-full accent-[#7C5CFF]"
                      />
                    </label>

                    <label className="block space-y-1">
                      <div className="flex justify-between text-[11px] font-semibold">
                        <span>Custom Rotation Angle</span>
                        <span className="tabular-nums text-slate-500">
                          {currentWidget.rotationDeg ?? 0}°
                        </span>
                      </div>
                      <input
                        type="range"
                        min={-25}
                        max={25}
                        step={1}
                        value={currentWidget.rotationDeg ?? 0}
                        onChange={(e) =>
                          updateCurrent(
                            'widget rotation',
                            (w) => ({ ...w, rotationDeg: Number(e.target.value) }),
                            false
                          )
                        }
                        className="w-full accent-[#7C5CFF]"
                      />
                    </label>
                  </div>
                </>
              )}

              {/* TAB 3: TACTILE CONTROLS (3D BUTTONS, CUSTOM JOYSTICK, BAR STYLE & BINDING) */}
              {inspectorTab === 'controls' && (
                <>
                  <div className="space-y-1.5">
                    <FieldLabel text="Display Label" />
                    <input
                      type="text"
                      value={currentWidget.label}
                      onChange={(e) =>
                        updateCurrent('label widget', (w) => ({ ...w, label: e.target.value }), false)
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#1F2430] text-xs font-semibold"
                    />
                  </div>

                  {/* Action Button Style + Action Binding */}
                  {(currentWidget.kind === 'actionButton' || currentWidget.kind === 'pauseButton') && (
                    <>
                      {currentWidget.kind === 'actionButton' && (
                        <div className="space-y-1.5">
                          <FieldLabel text="Button Action" />
                          <select
                            value={currentWidget.actionId ?? 'jump'}
                            onChange={(e) => {
                              const nextAction = e.target.value as ActionButtonBinding;
                              const meta = ActionButtonBindings.find((b) => b.id === nextAction);
                              updateCurrent('change button action', (w) => ({
                                ...w,
                                actionId: nextAction,
                                label: meta ? meta.title.split(' ')[0] : w.label,
                                fillHex: meta ? meta.defaultColor : w.fillHex,
                              }));
                            }}
                            className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#1F2430] text-xs font-semibold"
                          >
                            {ActionButtonBindings.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.title} ({b.shortcut})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="space-y-1.5 pt-2 border-t border-slate-200/70 dark:border-white/[0.08]">
                        <FieldLabel text="3D / Tactile Button Style" />
                        <div className="grid grid-cols-1 gap-1.5">
                          {HUD_BUTTON_STYLES.map((bs) => {
                            const active = (currentWidget.buttonStyle ?? 'flat') === bs.id;
                            return (
                              <button
                                key={bs.id}
                                type="button"
                                onClick={() =>
                                  updateCurrent(`button style ${bs.label}`, (w) => ({
                                    ...w,
                                    buttonStyle: bs.id,
                                  }))
                                }
                                className={`p-2 rounded-xl border text-left transition-all ${
                                  active
                                    ? 'border-[#7C5CFF] bg-[#7C5CFF]/15'
                                    : 'border-slate-200/70 dark:border-white/[0.08] bg-slate-50 dark:bg-[#1B1F2B] hover:border-[#7C5CFF]/40'
                                }`}
                              >
                                <div className="text-xs font-extrabold">{bs.label}</div>
                                <div className="text-[10px] text-slate-500 dark:text-[#949BB0]">
                                  {bs.blurb}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Joystick Hardware Style + Knob Color & Size */}
                  {currentWidget.kind === 'joystick' && (
                    <>
                      <div className="space-y-1.5 pt-2 border-t border-slate-200/70 dark:border-white/[0.08]">
                        <FieldLabel text="Joystick Hardware Style" />
                        <div className="grid grid-cols-1 gap-1.5">
                          {HUD_JOYSTICK_STYLES.map((js) => {
                            const active = (currentWidget.joystickStyle ?? 'modern') === js.id;
                            return (
                              <button
                                key={js.id}
                                type="button"
                                onClick={() =>
                                  updateCurrent(`joystick style ${js.label}`, (w) => ({
                                    ...w,
                                    joystickStyle: js.id,
                                  }))
                                }
                                className={`p-2 rounded-xl border text-left transition-all ${
                                  active
                                    ? 'border-[#7C5CFF] bg-[#7C5CFF]/15'
                                    : 'border-slate-200/70 dark:border-white/[0.08] bg-slate-50 dark:bg-[#1B1F2B] hover:border-[#7C5CFF]/40'
                                }`}
                              >
                                <div className="text-xs font-extrabold">{js.label}</div>
                                <div className="text-[10px] text-slate-500 dark:text-[#949BB0]">
                                  {js.blurb}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-slate-200/70 dark:border-white/[0.08]">
                        <label className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-[#1F2430] text-[11px] font-semibold cursor-pointer">
                          <span>Stick / Ball-Top Knob Color</span>
                          <input
                            type="color"
                            value={currentWidget.knobColorHex ?? '#FFFFFF'}
                            onChange={(e) =>
                              updateCurrent(
                                'knob color',
                                (w) => ({ ...w, knobColorHex: e.target.value }),
                                false
                              )
                            }
                            className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer shrink-0"
                          />
                        </label>

                        <label className="block space-y-1">
                          <div className="flex justify-between text-[11px] font-semibold">
                            <span>Thumb Knob Size</span>
                            <span className="tabular-nums text-slate-500">
                              {currentWidget.knobSizePct ?? 42}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={25}
                            max={65}
                            step={1}
                            value={currentWidget.knobSizePct ?? 42}
                            onChange={(e) =>
                              updateCurrent(
                                'knob size',
                                (w) => ({ ...w, knobSizePct: Number(e.target.value) }),
                                false
                              )
                            }
                            className="w-full accent-[#7C5CFF]"
                          />
                        </label>
                      </div>
                    </>
                  )}

                  {/* Bar Fill Style */}
                  {(currentWidget.kind === 'bar' || currentWidget.kind === 'bossBar') && (
                    <div className="space-y-1.5 pt-2 border-t border-slate-200/70 dark:border-white/[0.08]">
                      <FieldLabel text="Meter Fill Style" />
                      <div className="grid grid-cols-2 gap-1.5">
                        {HUD_BAR_STYLES.map((bs) => {
                          const active = (currentWidget.barStyle ?? 'smooth') === bs.id;
                          return (
                            <button
                              key={bs.id}
                              type="button"
                              onClick={() =>
                                updateCurrent(`bar style ${bs.label}`, (w) => ({
                                  ...w,
                                  barStyle: bs.id,
                                }))
                              }
                              className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-colors whitespace-nowrap ${
                                active
                                  ? 'border-[#7C5CFF] bg-[#7C5CFF]/15 text-[#7C5CFF]'
                                  : 'border-transparent bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#949BB0]'
                              }`}
                            >
                              {bs.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {WidgetKindMeta[currentWidget.kind].usesBinding && (
                    <div className="space-y-1.5 pt-2 border-t border-slate-200/70 dark:border-white/[0.08]">
                      <FieldLabel text="Bound Stat / Counter" />
                      <select
                        value={currentWidget.binding}
                        onChange={(e) =>
                          updateCurrent('bind stat', (w) => ({
                            ...w,
                            binding: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#1F2430] text-xs font-semibold"
                      >
                        {StatLibrary.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              {/* TAB 4: DIMENSIONS, ANCHOR, POSITION, DUPLICATE & REMOVE */}
              {inspectorTab === 'layout' && (
                <>
                  <div className="space-y-1.5">
                    <FieldLabel text="Anchor Corner" />
                    <select
                      value={currentWidget.anchor}
                      onChange={(e) =>
                        updateCurrent('move widget', (w) => ({
                          ...w,
                          anchor: e.target.value as WidgetAnchor,
                          offsetX: 0,
                          offsetY: 0,
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#1F2430] text-xs font-semibold"
                    >
                      {WidgetAnchors.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2.5 pt-2 border-t border-slate-200/70 dark:border-white/[0.08]">
                    <div className="flex items-center justify-between">
                      <FieldLabel text="Unrestricted Dimensions" />
                      <button
                        type="button"
                        onClick={() =>
                          updateCurrent('square size', (w) => ({ ...w, height: w.width }))
                        }
                        className="text-[10px] font-bold text-[#7C5CFF] hover:underline"
                      >
                        Make square
                      </button>
                    </div>

                    <label className="block space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span>Width</span>
                        <span className="tabular-nums">{currentWidget.width}px</span>
                      </div>
                      <input
                        type="range"
                        min={28}
                        max={420}
                        value={currentWidget.width}
                        onChange={(e) =>
                          updateCurrent(
                            'resize widget',
                            (w) => ({ ...w, width: Number(e.target.value) }),
                            false
                          )
                        }
                        className="w-full accent-[#7C5CFF]"
                      />
                    </label>

                    <label className="block space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span>Height</span>
                        <span className="tabular-nums">{currentWidget.height}px</span>
                      </div>
                      <input
                        type="range"
                        min={16}
                        max={240}
                        value={currentWidget.height}
                        onChange={(e) =>
                          updateCurrent(
                            'resize widget',
                            (w) => ({ ...w, height: Number(e.target.value) }),
                            false
                          )
                        }
                        className="w-full accent-[#7C5CFF]"
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <label className="space-y-1">
                        <span className="text-[10.5px] font-semibold text-slate-500">Offset X</span>
                        <input
                          type="number"
                          value={currentWidget.offsetX}
                          onChange={(e) =>
                            updateCurrent(
                              'offset X',
                              (w) => ({ ...w, offsetX: Number(e.target.value) || 0 }),
                              false
                            )
                          }
                          className="w-full px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1F2430] text-xs font-bold tabular-nums"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[10.5px] font-semibold text-slate-500">Offset Y</span>
                        <input
                          type="number"
                          value={currentWidget.offsetY}
                          onChange={(e) =>
                            updateCurrent(
                              'offset Y',
                              (w) => ({ ...w, offsetY: Number(e.target.value) || 0 }),
                              false
                            )
                          }
                          className="w-full px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1F2430] text-xs font-bold tabular-nums"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200/70 dark:border-white/[0.08] space-y-2">
                    <button
                      type="button"
                      onClick={handleDuplicateSelected}
                      className="w-full py-2 rounded-xl bg-slate-100 dark:bg-[#1F2430] hover:bg-slate-200 dark:hover:bg-[#272D3C] text-xs font-bold inline-flex items-center justify-center gap-1.5"
                    >
                      <Copy size={13} />
                      <span>Duplicate element</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => store.deleteWidget(currentWidget.id)}
                      className="w-full py-2 rounded-xl bg-[#F2545B]/12 text-[#F2545B] text-xs font-bold hover:bg-[#F2545B]/20 inline-flex items-center justify-center gap-1.5"
                    >
                      <Trash2 size={13} />
                      <span>Take off screen</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto maker-scroll p-4 space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-extrabold">Global Interface Controls</h3>
              <p className="text-[11px] text-slate-500 dark:text-[#949BB0] leading-relaxed">
                Click any joystick, button, bar, or panel on the canvas to customize its material,
                organic wear, burned edges, 3D button style, shape, font, and size — or adjust all
                elements together below.
              </p>
            </div>

            {/* Global Ghost Opacity */}
            <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2">
              <FieldLabel text="Ghost Back All HUD Elements" />
              <label className="block space-y-1">
                <div className="flex justify-between text-[11px] font-semibold">
                  <span>Global Opacity</span>
                  <span className="tabular-nums text-slate-500">
                    {Math.round((currentProject.hud.defaultOpacity ?? 0.92) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.02}
                  value={currentProject.hud.defaultOpacity ?? 0.92}
                  onChange={(e) => {
                    const nextOp = Number(e.target.value);
                    store.updateProject(
                      'set global HUD opacity',
                      (p) => ({
                        ...p,
                        hud: {
                          ...p.hud,
                          defaultOpacity: nextOp,
                          widgets: p.hud.widgets.map((w) => ({ ...w, opacity: nextOp })),
                        },
                      }),
                      false
                    );
                  }}
                  className="w-full accent-[#7C5CFF]"
                />
              </label>
            </div>

            {/* Global Typeface */}
            <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2">
              <FieldLabel text="Global HUD Typeface" />
              <select
                value={currentProject.hud.defaultFontFamily ?? 'sans'}
                onChange={(e) => {
                  const nextFont = e.target.value as ChatFontId;
                  store.updateProject('set global HUD typeface', (p) => ({
                    ...p,
                    hud: {
                      ...p.hud,
                      defaultFontFamily: nextFont,
                      widgets: p.hud.widgets.map((w) => ({ ...w, fontFamily: nextFont })),
                    },
                  }));
                }}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#171A23] text-xs font-semibold"
              >
                {CHAT_FONT_OPTIONS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label} — {f.sample}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setContextualAiPanelOpen(true, 'interface')}
              className="w-full py-2.5 px-3 rounded-xl bg-[#7C5CFF] hover:bg-[#6A4AF0] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5"
            >
              <Sparkles size={14} />
              <span>Let AI Materialize Your UI</span>
            </button>
          </div>
        )}
      </aside>

      {showingChatStudio && (
        <ChatBubbleStudioModal
          store={store}
          initialTarget={sampleNpc?.id ?? 'hero'}
          initialTab={chatSettings.displayMode === 'bottomPanel' ? 'panel' : 'bubble'}
          onClose={() => setShowingChatStudio(false)}
        />
      )}
      {showingInventoryStudio && (
        <InventoryStudioModal
          store={store}
          onClose={() => setShowingInventoryStudio(false)}
        />
      )}
    </div>
  );
};
