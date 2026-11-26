import React, { useRef, useState } from 'react';
import { Backpack, MessageCircle, PanelBottom, Plus, RotateCcw, SlidersHorizontal, Trash2, X } from 'lucide-react';
import {
  resolveChatBubbleStyle,
  resolveChatDisplaySettings,
} from '../../data/chatBubblePresets';
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
  DialogueOutputMode,
  HUDWidget,
  WidgetAnchor,
  WidgetKind,
} from '../../types/maker';
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
  '#1E2434',
  '#FFFFFF',
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

  return (
    <div className="h-full min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden maker-scroll">
      {/* Left Sidebar: AI Creator OR Widgets & Controls on screen */}
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
          <h2 className="text-base font-extrabold">Controls & HUD</h2>
          <button
            type="button"
            onClick={() => store.resetHUDToDefault()}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-[10px] font-bold text-slate-600 dark:text-[#949BB0] hover:text-[#7C5CFF]"
            title="Reset controls & HUD layout"
          >
            <RotateCcw size={10} />
            <span>Reset</span>
          </button>
        </div>

        {/* Dialogue Display Mode: Floating 3D Chat Bubbles vs Bottom Chat Panel */}
        <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2.5">
          <div className="flex items-center justify-between">
            <FieldLabel text="Character Chat Style" />
            <button
              type="button"
              onClick={() => setShowingChatStudio(true)}
              className="text-[11px] font-bold text-[#7C5CFF] hover:underline inline-flex items-center gap-1"
            >
              <SlidersHorizontal size={11} />
              <span>Customize</span>
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
          <p className="text-[11px] text-slate-500 dark:text-[#949BB0] leading-snug">
            {chatSettings.displayMode === 'bubbles'
              ? 'Each character speaks in their own customized 3D overhead chat bubble.'
              : 'Dialogue renders in a customizable chat panel docked at the bottom of the screen.'}
          </p>

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
              className="text-[11px] font-bold text-[#7C5CFF] hover:underline inline-flex items-center gap-1"
            >
              <SlidersHorizontal size={11} />
              <span>Customize</span>
            </button>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-[#949BB0]">
            <span>Hotkey: {formatKeyCodeLabel(invConfig.toggleKey)}</span>
            <span className="tabular-nums">
              {invConfig.categories.length} tabs · {invConfig.worldCollectibles.filter((w) => w.enabled).length} harvestable
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          {widgets.map((w) => {
            const meta = WidgetKindMeta[w.kind];
            const stat = StatLibrary.find((s) => s.id === w.binding);
            const selected = w.id === store.selectedWidgetID;
            const subtitle =
              w.kind === 'actionButton'
                ? ActionButtonBindings.find((b) => b.id === (w.actionId ?? 'jump'))?.title ?? 'Button'
                : w.kind === 'joystick'
                ? 'Thumbstick'
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
                  <div className="text-xs font-bold truncate">
                    {w.label || meta.title}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-[#949BB0]">
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

      {/* Center: Interactive HUD Canvas */}
      <main className="shrink-0 lg:shrink lg:flex-1 lg:h-full lg:min-h-0 lg:min-w-0 flex flex-col items-center p-4 sm:p-6 lg:overflow-auto maker-scroll">
        <div className="w-full max-w-[740px] space-y-2 my-auto">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#949BB0] px-1">
            <span className="font-semibold">Live UI & Controls Designer</span>
            <span>Drag your joystick, buttons, health bars or minimap anywhere</span>
          </div>

          <div
            ref={stageRef}
            onClick={() => store.setSelectedWidgetID(null)}
            className="relative w-full aspect-[16/10] rounded-3xl overflow-hidden shadow-lg border border-black/20 dark:border-white/[0.1] select-none"
            style={{
              background:
                'linear-gradient(180deg, #4B9AE8 0%, #86CEF7 52%, #68B35B 52%, #47873E 100%)',
            }}
          >
            <div className="absolute left-1/2 top-[56%] -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full bg-white/15 pointer-events-none" />

            {/* Live preview of either overhead Chat Bubble or docked Bottom Chat Panel */}
            {chatSettings.displayMode === 'bubbles' ? (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setShowingChatStudio(true);
                }}
                className="absolute left-1/2 top-[34%] -translate-x-1/2 -translate-y-1/2 z-10 cursor-pointer hover:scale-[1.02] transition-transform"
                title="Click to customize character chat bubbles"
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
        </div>
      </main>

      {/* Right Inspector */}
      <aside className="w-full lg:w-72 shrink-0 lg:h-full lg:min-h-0 bg-white dark:bg-[#171A23] border-t lg:border-t-0 lg:border-l border-slate-200/80 dark:border-white/[0.08] lg:overflow-y-auto maker-scroll p-4 space-y-4">
        {currentWidget ? (
          <>
            <h3 className="text-base font-extrabold">
              This {WidgetKindMeta[currentWidget.kind].title.toLowerCase()}
            </h3>

            <div className="space-y-1.5">
              <FieldLabel text="Label" />
              <input
                type="text"
                value={currentWidget.label}
                onChange={(e) =>
                  store.updateWidget(
                    currentWidget.id,
                    'label widget',
                    (w) => ({ ...w, label: e.target.value }),
                    false
                  )
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#1F2430] text-xs font-semibold"
              />
            </div>

            {currentWidget.kind === 'actionButton' && (
              <div className="space-y-1.5">
                <FieldLabel text="Button action" />
                <select
                  value={currentWidget.actionId ?? 'jump'}
                  onChange={(e) => {
                    const nextAction = e.target.value as ActionButtonBinding;
                    const meta = ActionButtonBindings.find((b) => b.id === nextAction);
                    store.updateWidget(currentWidget.id, 'change button action', (w) => ({
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

            {WidgetKindMeta[currentWidget.kind].usesBinding && (
              <div className="space-y-1.5">
                <FieldLabel text="Shows" />
                <select
                  value={currentWidget.binding}
                  onChange={(e) =>
                    store.updateWidget(currentWidget.id, 'bind stat', (w) => ({
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

            {(currentWidget.kind === 'joystick' ||
              currentWidget.kind === 'actionButton' ||
              currentWidget.kind === 'pauseButton' ||
              currentWidget.kind === 'bar') && (
              <div className="space-y-1.5">
                <FieldLabel text="Shape" />
                <div className="grid grid-cols-2 gap-1.5">
                  {(['circle', 'rounded'] as const).map((shape) => (
                    <button
                      key={shape}
                      type="button"
                      onClick={() =>
                        store.updateWidget(currentWidget.id, 'change shape', (w) => ({
                          ...w,
                          shape,
                        }))
                      }
                      className={`py-2 rounded-xl text-xs font-bold capitalize border ${
                        (currentWidget.shape ?? 'circle') === shape
                          ? 'border-[#7C5CFF] bg-[#7C5CFF]/15 text-[#7C5CFF]'
                          : 'border-transparent bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#949BB0]'
                      }`}
                    >
                      {shape === 'circle' ? 'Circle / Pill' : 'Rounded Box'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <FieldLabel text={currentWidget.kind === 'joystick' ? 'Base colour' : 'Colour'} />
              <div className="flex flex-wrap gap-2">
                {SWATCHES.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() =>
                      store.updateWidget(currentWidget.id, 'widget color', (w) => ({
                        ...w,
                        fillHex: hex,
                      }))
                    }
                    className={`w-7 h-7 rounded-full border ${
                      currentWidget.fillHex === hex
                        ? 'ring-2 ring-slate-900 dark:ring-white ring-offset-1 dark:ring-offset-[#171A23]'
                        : 'border-black/15'
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </div>

            {currentWidget.kind === 'joystick' && (
              <div className="space-y-2">
                <FieldLabel text="Thumb knob colour" />
                <div className="flex flex-wrap gap-2">
                  {SWATCHES.map((hex) => (
                    <button
                      key={`knob-${hex}`}
                      type="button"
                      onClick={() =>
                        store.updateWidget(currentWidget.id, 'knob color', (w) => ({
                          ...w,
                          knobColorHex: hex,
                        }))
                      }
                      className={`w-7 h-7 rounded-full border ${
                        (currentWidget.knobColorHex ?? '#FFFFFF') === hex
                          ? 'ring-2 ring-slate-900 dark:ring-white ring-offset-1 dark:ring-offset-[#171A23]'
                          : 'border-black/15'
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold">
                <span>Opacity</span>
                <span>{Math.round((currentWidget.opacity ?? 0.92) * 100)}%</span>
              </div>
              <input
                type="range"
                min={0.35}
                max={1}
                step={0.05}
                value={currentWidget.opacity ?? 0.92}
                onChange={(e) =>
                  store.updateWidget(
                    currentWidget.id,
                    'widget opacity',
                    (w) => ({ ...w, opacity: Number(e.target.value) }),
                    false
                  )
                }
                className="w-full accent-[#7C5CFF]"
              />
            </div>

            <div className="space-y-1.5">
              <FieldLabel text="Anchor corner" />
              <select
                value={currentWidget.anchor}
                onChange={(e) =>
                  store.updateWidget(currentWidget.id, 'move widget', (w) => ({
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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <FieldLabel text="Size" />
                {(currentWidget.kind === 'joystick' ||
                  currentWidget.kind === 'actionButton' ||
                  currentWidget.kind === 'pauseButton') && (
                  <button
                    type="button"
                    onClick={() =>
                      store.updateWidget(currentWidget.id, 'square size', (w) => ({
                        ...w,
                        height: w.width,
                      }))
                    }
                    className="text-[10px] font-bold text-[#7C5CFF] hover:underline"
                  >
                    Make square
                  </button>
                )}
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span>Width</span>
                  <span>{currentWidget.width}px</span>
                </div>
                <input
                  type="range"
                  min={36}
                  max={360}
                  value={currentWidget.width}
                  onChange={(e) =>
                    store.updateWidget(
                      currentWidget.id,
                      'resize widget',
                      (w) => ({
                        ...w,
                        width: Number(e.target.value),
                        ...(w.kind === 'joystick'
                          ? { height: Number(e.target.value) }
                          : {}),
                      }),
                      false
                    )
                  }
                  className="w-full accent-[#7C5CFF]"
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span>Height</span>
                  <span>{currentWidget.height}px</span>
                </div>
                <input
                  type="range"
                  min={18}
                  max={200}
                  value={currentWidget.height}
                  onChange={(e) =>
                    store.updateWidget(
                      currentWidget.id,
                      'resize widget',
                      (w) => ({
                        ...w,
                        height: Number(e.target.value),
                        ...(w.kind === 'joystick'
                          ? { width: Number(e.target.value) }
                          : {}),
                      }),
                      false
                    )
                  }
                  className="w-full accent-[#7C5CFF]"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => store.deleteWidget(currentWidget.id)}
              className="w-full py-2 rounded-xl bg-[#F2545B]/12 text-[#F2545B] text-xs font-bold hover:bg-[#F2545B]/20 inline-flex items-center justify-center gap-1.5"
            >
              <Trash2 size={13} />
              <span>Take off screen</span>
            </button>
          </>
        ) : (
          <div className="text-xs text-slate-500 dark:text-[#949BB0] py-6 text-center leading-relaxed">
            Click your joystick, action button, health bar or minimap to move, resize, reshape and recolour it.
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
