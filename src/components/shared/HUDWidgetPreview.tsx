import React from 'react';
import {
  ArrowUp,
  Hand,
  Heart,
  List,
  Pause,
  Swords,
  Timer,
  Wand2,
} from 'lucide-react';
import { StatLibrary } from '../../data/registries';
import type { ActionButtonBinding, HUDState, HUDWidget } from '../../types/maker';
import { MakerIcon } from '../shared/IconMap';
import { InventoryItemIcon } from '../shared/InventoryItemIcon';

export const DefaultPreviewHUDState: HUDState = {
  health: 6,
  maxHealth: 6,
  stamina: 85,
  energy: 92,
  magic: 100,
  coins: 12,
  keys: 1,
  timeText: '0:42',
  objectives: ['Find the gold key', 'Open the big door'],
  heroPoint: { x: 0.28, y: 0.65 },
  portalPoint: { x: 0.88, y: 0.24 },
  baddiePoints: [
    { x: 0.48, y: 0.38 },
    { x: 0.62, y: 0.52 },
  ],
  flashHealth: false,
  bossName: 'Captain',
  bossHealth: 6,
  bossMaxHealth: 8,
};

function ActionBindingIcon({ binding, size = 18 }: { binding?: ActionButtonBinding; size?: number }) {
  switch (binding) {
    case 'attack':
      return <Swords size={size} />;
    case 'interact':
      return <Hand size={size} />;
    case 'magicBolt':
      return <Wand2 size={size} />;
    case 'heal':
      return <Heart size={size} />;
    case 'jump':
    default:
      return <ArrowUp size={size} strokeWidth={2.8} />;
  }
}

export const HUDWidgetView: React.FC<{
  widget: HUDWidget;
  state: HUDState;
  isSelected?: boolean;
  interactive?: boolean;
  stickOffset?: { x: number; y: number };
  onStickPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onActionPointerDown?: (action: ActionButtonBinding, e: React.PointerEvent<HTMLButtonElement>) => void;
  onActionPointerUp?: (action: ActionButtonBinding, e: React.PointerEvent<HTMLButtonElement>) => void;
  onPauseTrigger?: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onOpenInventory?: () => void;
}> = ({
  widget,
  state,
  isSelected = false,
  interactive = false,
  stickOffset = { x: 0, y: 0 },
  onStickPointerDown,
  onActionPointerDown,
  onActionPointerUp,
  onPauseTrigger,
  onOpenInventory,
}) => {
  const stat = StatLibrary.find((s) => s.id === widget.binding);
  const opacity = widget.opacity ?? 0.92;
  const isCircle = widget.shape !== 'rounded';

  const fraction = (() => {
    if (widget.kind === 'bossBar') {
      const max = Math.max(1, state.bossMaxHealth ?? 8);
      return Math.min(1, Math.max(0, (state.bossHealth ?? 6) / max));
    }
    switch (widget.binding) {
      case 'health':
        return Math.min(1, Math.max(0, state.health / Math.max(1, state.maxHealth)));
      case 'stamina':
        return Math.min(1, Math.max(0, state.stamina / 100));
      case 'energy':
        return Math.min(1, Math.max(0, (state.energy ?? 100) / 100));
      case 'magic':
        return Math.min(1, Math.max(0, state.magic / 100));
      default:
        return 0.75;
    }
  })();

  const counterValue =
    widget.binding === 'coins' ? state.coins : widget.binding === 'keys' ? state.keys : 0;

  return (
    <div
      className="w-full h-full relative select-none"
      style={{
        opacity,
        outline: isSelected ? '2.5px solid #6C4CF1' : 'none',
        outlineOffset: '3px',
        borderRadius: isCircle ? '9999px' : '14px',
      }}
    >
      {(widget.kind === 'bar' || widget.kind === 'bossBar') && (
        <div
          className={`w-full h-full ${
            widget.shape === 'circle' ? 'rounded-full' : 'rounded-xl'
          } bg-black/55 border border-white/15 overflow-hidden relative flex items-center px-2.5 text-white`}
        >
          <div
            className={`absolute inset-y-0 left-0 transition-all duration-150 ${
              widget.shape === 'circle' ? 'rounded-full' : 'rounded-xl'
            }`}
            style={{
              width: `${Math.max(6, fraction * 100)}%`,
              backgroundColor: state.flashHealth && widget.binding === 'health' ? '#FFFFFF' : widget.fillHex,
            }}
          />
          <div className="relative z-10 flex items-center justify-between w-full text-[11px] font-extrabold">
            <span className="flex items-center gap-1.5 truncate">
              <MakerIcon symbol={stat?.symbol ?? 'heart.fill'} size={11} color="#FFFFFF" />
              <span>{widget.kind === 'bossBar' ? state.bossName || widget.label : widget.label}</span>
            </span>
            <span className="tabular-nums text-[10px]">{Math.round(fraction * 100)}%</span>
          </div>
        </div>
      )}

      {widget.kind === 'counter' && (
        <div className="w-full h-full rounded-full bg-black/55 border border-white/15 px-3 flex items-center gap-1.5 text-white text-xs font-extrabold tabular-nums">
          <MakerIcon symbol={stat?.symbol ?? 'circle.fill'} size={12} color={widget.fillHex} />
          <span>× {counterValue}</span>
        </div>
      )}

      {widget.kind === 'inventoryGrid' && (
        <div
          onClick={interactive ? onOpenInventory : undefined}
          className={`w-full h-full grid grid-cols-4 gap-1.5 ${
            interactive ? 'pointer-events-auto cursor-pointer' : ''
          }`}
          title="Open Inventory (I)"
        >
          {[0, 1, 2, 3].map((slot) => {
            const item = state.hotbarItems?.[slot];
            return (
              <div
                key={slot}
                className={`rounded-lg bg-black/55 border flex items-center justify-center relative text-white/80 text-[10px] font-bold ${
                  item?.held ? 'border-[#38BDF8] bg-[#38BDF8]/20' : 'border-white/25'
                }`}
              >
                {item ? (
                  <>
                    <InventoryItemIcon icon={item.icon} size={15} color={item.colorHex} />
                    {item.qty > 1 && (
                      <span className="absolute bottom-0 right-0.5 text-[8px] font-black text-white">
                        {item.qty}
                      </span>
                    )}
                  </>
                ) : slot === 0 && state.keys > 0 ? (
                  <MakerIcon symbol="key.fill" size={14} color="#FFD140" />
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {widget.kind === 'minimap' && (
        <div className="w-full h-full rounded-xl bg-[#0B2239]/90 border border-white/25 relative overflow-hidden flex items-center justify-center p-1.5">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#2D5A3D" stroke="#DFC78B" strokeWidth="2.5" />
            <path d="M8,62 Q38,44 62,56 T94,42" fill="none" stroke="#2B8CE6" strokeWidth="4" strokeLinecap="round" />
            <path d="M18,78 Q46,66 64,46 T86,24" fill="none" stroke="#D9B27A" strokeWidth="2.5" strokeDasharray="3 2" />
            <circle
              cx={state.portalPoint.x * 100}
              cy={state.portalPoint.y * 100}
              r="5"
              fill={widget.fillHex}
              stroke="#FFFFFF"
              strokeWidth="1.2"
            />
            {state.baddiePoints.map((bp, i) => (
              <circle
                key={i}
                cx={bp.x * 100}
                cy={bp.y * 100}
                r="3.2"
                fill="#F2545B"
                stroke="#FFFFFF"
                strokeWidth="0.8"
              />
            ))}
            <polygon
              points="0,-6 4.5,4.5 0,2 -4.5,4.5"
              transform={`translate(${(state.heroPoint.x * 100).toFixed(1)} ${(state.heroPoint.y * 100).toFixed(1)}) rotate(32)`}
              fill="#FFFFFF"
              stroke="#16A34A"
              strokeWidth="1.2"
            />
          </svg>
        </div>
      )}

      {widget.kind === 'objectiveList' && (
        <div className="w-full min-h-full rounded-xl bg-black/60 border border-white/20 px-3 py-2 text-white flex flex-col justify-center gap-0.5 shadow-md">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <div
              className="flex items-center gap-1 text-[9px] font-black tracking-wider uppercase"
              style={{ color: widget.fillHex }}
            >
              <List size={10} />
              <span>TO DO</span>
            </div>
            {(state.buddiesTotal ?? 0) > 0 && (
              <span className="text-[10px] font-extrabold tabular-nums text-[#FACC15]">
                Buddies {state.buddiesFound ?? 0}/{state.buddiesTotal}
              </span>
            )}
          </div>
          {state.objectives.length === 0 ? (
            <div className="text-[11px] font-semibold opacity-80 leading-snug">Explore the world</div>
          ) : (
            state.objectives.slice(0, 3).map((goal, idx) => (
              <div key={idx} className="text-[11px] font-semibold leading-snug break-words">
                • {goal}
              </div>
            ))
          )}
        </div>
      )}

      {widget.kind === 'dialogue' && (
        <div className="w-full h-full rounded-xl bg-black/55 p-2.5 text-white flex flex-col justify-center">
          <div className="text-[11px] font-extrabold" style={{ color: widget.fillHex }}>
            Mira
          </div>
          <div className="text-[11px] line-clamp-2 opacity-90">
            A key? The guard dropped one by the well.
          </div>
        </div>
      )}

      {widget.kind === 'pauseButton' && (
        interactive ? (
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onPauseTrigger?.(e);
            }}
            className={`w-full h-full flex items-center justify-center text-white border border-white/25 shadow-md active:scale-95 pointer-events-auto ${
              isCircle ? 'rounded-full' : 'rounded-xl'
            }`}
            style={{ backgroundColor: widget.fillHex }}
            title="Pause"
          >
            <Pause size={15} />
          </button>
        ) : (
          <div
            className={`w-full h-full flex items-center justify-center text-white border border-white/25 ${
              isCircle ? 'rounded-full' : 'rounded-xl'
            }`}
            style={{ backgroundColor: widget.fillHex }}
          >
            <Pause size={15} />
          </div>
        )
      )}

      {widget.kind === 'timer' && (
        <div className="w-full h-full rounded-full bg-black/55 px-3 flex items-center justify-center gap-1.5 text-white text-xs font-extrabold tabular-nums">
          <Timer size={12} />
          <span>{state.timeText}</span>
        </div>
      )}

      {widget.kind === 'tutorial' && (
        <div className="w-full h-full rounded-full bg-black/55 px-3 flex items-center justify-center gap-1.5 text-white text-[11px] font-semibold">
          <span>Move with WASD or stick</span>
        </div>
      )}

      {widget.kind === 'joystick' && (
        <div
          onPointerDown={interactive ? onStickPointerDown : undefined}
          className={`w-full h-full border-2 border-white/40 flex items-center justify-center shadow-inner ${
            isCircle ? 'rounded-full' : 'rounded-2xl'
          } ${interactive ? 'touch-none cursor-grab pointer-events-auto' : ''}`}
          style={{ backgroundColor: widget.fillHex }}
        >
          <div
            className={`${isCircle ? 'rounded-full' : 'rounded-xl'} shadow-lg border border-black/20`}
            style={{
              width: '42%',
              height: '42%',
              backgroundColor: widget.knobColorHex || '#FFFFFF',
              transform: `translate(${stickOffset.x}px, ${stickOffset.y}px)`,
            }}
          />
        </div>
      )}

      {widget.kind === 'actionButton' && (
        <button
          type="button"
          onPointerDown={
            interactive
              ? (e) => onActionPointerDown?.(widget.actionId ?? 'jump', e)
              : undefined
          }
          onPointerUp={
            interactive
              ? (e) => onActionPointerUp?.(widget.actionId ?? 'jump', e)
              : undefined
          }
          onPointerLeave={
            interactive
              ? (e) => onActionPointerUp?.(widget.actionId ?? 'jump', e)
              : undefined
          }
          onPointerCancel={
            interactive
              ? (e) => onActionPointerUp?.(widget.actionId ?? 'jump', e)
              : undefined
          }
          className={`w-full h-full flex flex-col items-center justify-center gap-0.5 text-white font-extrabold shadow-lg border-2 border-white/30 transition-transform ${
            isCircle ? 'rounded-full' : 'rounded-2xl'
          } ${interactive ? 'touch-none active:scale-90 pointer-events-auto' : 'pointer-events-none'}`}
          style={{ backgroundColor: widget.fillHex }}
        >
          <ActionBindingIcon
            binding={widget.actionId ?? 'jump'}
            size={Math.max(13, Math.min(24, Math.round(Math.min(widget.width, widget.height) * 0.34)))}
          />
          {widget.label && (
            <span className="text-[10px] leading-none tracking-tight">{widget.label}</span>
          )}
        </button>
      )}
    </div>
  );
};
