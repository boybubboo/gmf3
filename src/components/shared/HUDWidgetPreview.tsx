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
import {
  buildSurfaceVisualStyles,
  getHudFontStack,
  getShapeGeometry,
  hexToRgba,
} from '../../utils/hudMaterials';
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

function ActionBindingIcon({
  binding,
  size = 18,
  color = 'currentColor',
}: {
  binding?: ActionButtonBinding;
  size?: number;
  color?: string;
}) {
  switch (binding) {
    case 'attack':
      return <Swords size={size} color={color} />;
    case 'interact':
      return <Hand size={size} color={color} />;
    case 'magicBolt':
      return <Wand2 size={size} color={color} />;
    case 'heal':
      return <Heart size={size} color={color} />;
    case 'jump':
    default:
      return <ArrowUp size={size} strokeWidth={2.8} color={color} />;
  }
}

function hashWidgetSeed(id: string): number {
  let h = 1;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) % 997;
  }
  return Math.max(1, h);
}

/**
 * Renders decorative medieval rivets or sci-fi corner ticks for ornate / wood / metal surfaces
 */
function SurfaceOrnaments({
  isOrnate,
  borderHex,
  texture,
}: {
  isOrnate: boolean;
  borderHex: string;
  texture?: string;
}) {
  if (!isOrnate && texture !== 'holoGlass' && texture !== 'circuitTech') return null;
  if (texture === 'holoGlass' || texture === 'circuitTech') {
    return (
      <>
        <span
          className="pointer-events-none absolute top-1 left-1 w-2 h-2 border-t-2 border-l-2 opacity-80"
          style={{ borderColor: borderHex }}
        />
        <span
          className="pointer-events-none absolute top-1 right-1 w-2 h-2 border-t-2 border-r-2 opacity-80"
          style={{ borderColor: borderHex }}
        />
        <span
          className="pointer-events-none absolute bottom-1 left-1 w-2 h-2 border-b-2 border-l-2 opacity-80"
          style={{ borderColor: borderHex }}
        />
        <span
          className="pointer-events-none absolute bottom-1 right-1 w-2 h-2 border-b-2 border-r-2 opacity-80"
          style={{ borderColor: borderHex }}
        />
      </>
    );
  }
  return (
    <>
      <span
        className="pointer-events-none absolute top-1 left-1 w-1.5 h-1.5 rounded-full opacity-80"
        style={{ backgroundColor: borderHex }}
      />
      <span
        className="pointer-events-none absolute top-1 right-1 w-1.5 h-1.5 rounded-full opacity-80"
        style={{ backgroundColor: borderHex }}
      />
      <span
        className="pointer-events-none absolute bottom-1 left-1 w-1.5 h-1.5 rounded-full opacity-80"
        style={{ backgroundColor: borderHex }}
      />
      <span
        className="pointer-events-none absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full opacity-80"
        style={{ backgroundColor: borderHex }}
      />
    </>
  );
}

/**
 * Renders customizable tactile Joystick styles:
 * modern | 3dThumbstick | metalMachined | woodenLever | arcadeBall | sciFiHolo | stoneRune
 */
function CustomJoystickRenderer({
  widget,
  interactive,
  stickOffset,
  onStickPointerDown,
  seed,
}: {
  widget: HUDWidget;
  interactive: boolean;
  stickOffset: { x: number; y: number };
  onStickPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  seed: number;
}) {
  const styleId = widget.joystickStyle ?? 'modern';
  const shape = widget.shape ?? 'circle';
  const knobPct = Math.max(25, Math.min(65, widget.knobSizePct ?? 42));
  const baseBg = widget.bgHex ?? widget.fillHex ?? '#1F2937';
  const knobHex = widget.knobColorHex || '#FFFFFF';
  const borderHex = widget.borderHex ?? '#94A3B8';
  const glowHex = widget.glowHex ?? borderHex;
  const geom = getShapeGeometry(shape, widget.cornerRadius ?? 18, widget.paperTears ?? 0, seed);
  const baseVisual = buildSurfaceVisualStyles({
    surfaceTexture:
      widget.surfaceTexture ??
      (styleId === 'woodenLever'
        ? 'wood'
        : styleId === 'metalMachined'
        ? 'brushedMetal'
        : styleId === 'stoneRune'
        ? 'stone'
        : styleId === 'sciFiHolo'
        ? 'holoGlass'
        : 'smooth'),
    shape,
    bgHex: baseBg,
    borderHex,
    borderStyle: widget.borderStyle ?? 'solid',
    borderWidth: widget.borderWidth ?? 2,
    cornerRadius: widget.cornerRadius ?? 18,
    edgeWear: widget.edgeWear,
    burnedEdges: widget.burnedEdges,
    paperTears: widget.paperTears,
    glowIntensity:
      widget.glowIntensity ?? (styleId === 'sciFiHolo' ? 0.65 : styleId === 'stoneRune' ? 0.35 : 0),
    glowHex,
    shadowDepth: widget.shadowDepth ?? 0.55,
    opacity: 1,
    seed,
  });

  const dx = stickOffset.x;
  const dy = stickOffset.y;
  const shaftDist = Math.hypot(dx, dy);
  const shaftAngle = Math.atan2(dy, dx) * (180 / Math.PI);

  // 1) 3D CONSOLE GAMEPAD THUMBSTICK
  if (styleId === '3dThumbstick') {
    return (
      <div
        onPointerDown={interactive ? onStickPointerDown : undefined}
        className={`w-full h-full relative flex items-center justify-center ${
          interactive ? 'touch-none cursor-grab pointer-events-auto' : ''
        }`}
        style={{
          ...baseVisual.surfaceStyle,
          backgroundImage: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.22), transparent 55%), radial-gradient(circle at 50% 50%, rgba(0,0,0,0.72) 28%, rgba(15,23,42,0.88) 72%, rgba(255,255,255,0.12) 100%)`,
          boxShadow:
            'inset 0 10px 18px rgba(0,0,0,0.75), inset 0 -4px 10px rgba(255,255,255,0.16), 0 6px 16px rgba(0,0,0,0.45)',
        }}
      >
        {/* Recessed gimbal well */}
        <div
          className="w-[74%] h-[74%] rounded-full flex items-center justify-center relative"
          style={{
            background: 'radial-gradient(circle at 50% 55%, #070B12 0%, #161E2E 68%, #283548 100%)',
            boxShadow: 'inset 0 6px 12px rgba(0,0,0,0.85)',
          }}
        >
          {/* 3D Angled shaft connecting well to dome */}
          {shaftDist > 1 && (
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 origin-left rounded-full"
              style={{
                width: `${shaftDist}px`,
                height: '12px',
                marginTop: '-6px',
                transform: `rotate(${shaftAngle}deg)`,
                background: 'linear-gradient(180deg, #94A3B8 0%, #334155 55%, #0F172A 100%)',
                boxShadow: '0 3px 6px rgba(0,0,0,0.65)',
              }}
            />
          )}
          {/* Sculpted concave rubberized thumb cap */}
          <div
            className="rounded-full relative flex items-center justify-center transition-transform duration-75"
            style={{
              width: `${knobPct + 12}%`,
              height: `${knobPct + 12}%`,
              transform: `translate(${dx}px, ${dy}px)`,
              background: `radial-gradient(circle at 35% 28%, rgba(255,255,255,0.34), transparent 45%), radial-gradient(circle at 50% 50%, ${knobHex} 0%, #111827 95%)`,
              boxShadow:
                '0 8px 14px rgba(0,0,0,0.72), inset 0 2px 3px rgba(255,255,255,0.35), inset 0 -4px 8px rgba(0,0,0,0.7)',
              border: '2px solid rgba(255,255,255,0.16)',
            }}
          >
            {/* Inner concave dish + grip dots */}
            <div
              className="w-[68%] h-[68%] rounded-full relative"
              style={{
                background:
                  'radial-gradient(circle at 60% 65%, rgba(255,255,255,0.16), rgba(0,0,0,0.45) 75%)',
                boxShadow: 'inset 0 3px 6px rgba(0,0,0,0.72)',
              }}
            >
              <span className="absolute top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white/35" />
              <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white/35" />
              <span className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-white/35" />
              <span className="absolute right-1 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-white/35" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2) MACHINED METAL JOYSTICK
  if (styleId === 'metalMachined') {
    return (
      <div
        onPointerDown={interactive ? onStickPointerDown : undefined}
        className={`w-full h-full relative flex items-center justify-center ${
          interactive ? 'touch-none cursor-grab pointer-events-auto' : ''
        }`}
        style={{
          ...baseVisual.surfaceStyle,
          background: `conic-gradient(from 45deg, #94A3B8, #334155, #CBD5E1, #1E293B, #94A3B8)`,
          border: `3px solid ${borderHex}`,
          boxShadow:
            'inset 0 2px 4px rgba(255,255,255,0.55), inset 0 -5px 10px rgba(0,0,0,0.65), 0 8px 16px rgba(0,0,0,0.5)',
        }}
      >
        {/* 4 corner machined hex bolts */}
        {[
          'top-2 left-2',
          'top-2 right-2',
          'bottom-2 left-2',
          'bottom-2 right-2',
        ].map((pos, i) => (
          <span
            key={i}
            className={`pointer-events-none absolute ${pos} w-2 h-2 rounded-full border border-black/60`}
            style={{
              background: 'linear-gradient(135deg, #F1F5F9, #475569)',
              boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.8)',
            }}
          />
        ))}
        {/* Steel well */}
        <div
          className="w-[68%] h-[68%] rounded-full flex items-center justify-center relative"
          style={{
            background: 'radial-gradient(circle, #0B1120 0%, #1E293B 68%, #64748B 100%)',
            boxShadow: 'inset 0 6px 12px rgba(0,0,0,0.85)',
          }}
        >
          {shaftDist > 1 && (
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 origin-left rounded-full"
              style={{
                width: `${shaftDist}px`,
                height: '10px',
                marginTop: '-5px',
                transform: `rotate(${shaftAngle}deg)`,
                background: 'linear-gradient(180deg, #F8FAFC 0%, #64748B 50%, #0F172A 100%)',
              }}
            />
          )}
          <div
            className="rounded-full flex items-center justify-center"
            style={{
              width: `${knobPct + 10}%`,
              height: `${knobPct + 10}%`,
              transform: `translate(${dx}px, ${dy}px)`,
              background: `radial-gradient(circle at 30% 25%, #FFFFFF 0%, ${knobHex} 38%, #1E293B 100%)`,
              boxShadow:
                '0 7px 14px rgba(0,0,0,0.75), inset 0 2px 3px rgba(255,255,255,0.75)',
              border: '1.5px solid rgba(255,255,255,0.45)',
            }}
          >
            <div className="w-[46%] h-[46%] rounded-full border border-white/40 bg-black/20" />
          </div>
        </div>
      </div>
    );
  }

  // 3) CARVED WOODEN LEVER (MEDIEVAL / FANTASY)
  if (styleId === 'woodenLever') {
    return (
      <div
        onPointerDown={interactive ? onStickPointerDown : undefined}
        className={`w-full h-full relative flex items-center justify-center ${
          interactive ? 'touch-none cursor-grab pointer-events-auto' : ''
        }`}
        style={{
          ...baseVisual.surfaceStyle,
          border: `3.5px solid ${borderHex}`,
          boxShadow:
            'inset 0 3px 6px rgba(255,220,170,0.3), inset 0 -6px 12px rgba(24,10,2,0.72), 0 8px 16px rgba(0,0,0,0.52)',
        }}
      >
        {/* Brass rivets */}
        {['top-1.5 left-1/2 -translate-x-1/2', 'bottom-1.5 left-1/2 -translate-x-1/2', 'left-1.5 top-1/2 -translate-y-1/2', 'right-1.5 top-1/2 -translate-y-1/2'].map(
          (pos, i) => (
            <span
              key={i}
              className={`pointer-events-none absolute ${pos} w-2 h-2 rounded-full`}
              style={{
                background: 'radial-gradient(circle at 30% 30%, #FDE68A, #92400E)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.7)',
              }}
            />
          )
        )}
        {/* Dark carved wood socket */}
        <div
          className="w-[66%] h-[66%] rounded-full flex items-center justify-center relative"
          style={{
            background: 'radial-gradient(circle, #1E0D04 0%, #3F210D 75%, #6B3E1E 100%)',
            boxShadow: 'inset 0 6px 12px rgba(0,0,0,0.85)',
          }}
        >
          {shaftDist > 1 && (
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 origin-left rounded-full"
              style={{
                width: `${shaftDist}px`,
                height: '11px',
                marginTop: '-5.5px',
                transform: `rotate(${shaftAngle}deg)`,
                background: 'linear-gradient(180deg, #D2965B 0%, #6B3E1E 60%, #2B1507 100%)',
              }}
            />
          )}
          {/* Turned burl-wood ball knob */}
          <div
            className="rounded-full flex items-center justify-center"
            style={{
              width: `${knobPct + 12}%`,
              height: `${knobPct + 12}%`,
              transform: `translate(${dx}px, ${dy}px)`,
              background: `radial-gradient(circle at 32% 28%, #F7D3A3 0%, ${knobHex} 45%, #2D1506 100%)`,
              boxShadow:
                '0 8px 14px rgba(0,0,0,0.72), inset 0 2px 3px rgba(255,235,200,0.45)',
              border: '2px solid #C28A4B',
            }}
          >
            <div className="w-[45%] h-[45%] rounded-full border border-amber-200/35" />
          </div>
        </div>
      </div>
    );
  }

  // 4) ARCADE BALL-TOP STICK
  if (styleId === 'arcadeBall') {
    return (
      <div
        onPointerDown={interactive ? onStickPointerDown : undefined}
        className={`w-full h-full relative flex items-center justify-center ${
          interactive ? 'touch-none cursor-grab pointer-events-auto' : ''
        }`}
        style={{
          ...baseVisual.surfaceStyle,
          background: 'radial-gradient(circle, #1F2433 0%, #0E1118 80%)',
          border: `3px solid ${borderHex}`,
          boxShadow: 'inset 0 5px 14px rgba(0,0,0,0.9), 0 8px 18px rgba(0,0,0,0.55)',
        }}
      >
        {/* Octagonal arcade restrictor gate */}
        <div
          className="w-[74%] h-[74%] flex items-center justify-center relative"
          style={{
            clipPath:
              'polygon(29% 0%, 71% 0%, 100% 29%, 100% 71%, 71% 100%, 29% 100%, 0% 71%, 0% 29%)',
            background: 'radial-gradient(circle, #06080D 0%, #1C2333 100%)',
            border: '2px solid rgba(255,255,255,0.16)',
          }}
        >
          {/* Dust washer */}
          <div className="w-[42%] h-[42%] rounded-full bg-black/85 border border-white/15" />
          {/* Chrome arcade shaft */}
          {shaftDist > 1 && (
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 origin-left rounded-full"
              style={{
                width: `${shaftDist}px`,
                height: '8px',
                marginTop: '-4px',
                transform: `rotate(${shaftAngle}deg)`,
                background: 'linear-gradient(180deg, #FFFFFF 0%, #94A3B8 55%, #1E293B 100%)',
                boxShadow: '0 3px 6px rgba(0,0,0,0.8)',
              }}
            />
          )}
          {/* Candy-gloss arcade ball top */}
          <div
            className="absolute rounded-full"
            style={{
              width: `${knobPct + 14}%`,
              height: `${knobPct + 14}%`,
              transform: `translate(${dx}px, ${dy}px)`,
              background: `radial-gradient(circle at 30% 26%, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.35) 16%, ${knobHex} 42%, #180814 100%)`,
              boxShadow: `0 10px 16px rgba(0,0,0,0.8), 0 0 12px ${hexToRgba(knobHex, 0.45)}`,
            }}
          />
        </div>
      </div>
    );
  }

  // 5) SCI-FI HOLOGRAPHIC RETICLE JOYSTICK
  if (styleId === 'sciFiHolo') {
    return (
      <div
        onPointerDown={interactive ? onStickPointerDown : undefined}
        className={`w-full h-full relative flex items-center justify-center ${
          interactive ? 'touch-none cursor-grab pointer-events-auto' : ''
        }`}
        style={{
          ...baseVisual.surfaceStyle,
          border: `2px solid ${borderHex}`,
          boxShadow: `inset 0 0 22px ${hexToRgba(glowHex, 0.36)}, 0 0 16px ${hexToRgba(glowHex, 0.35)}`,
        }}
      >
        {/* Radar crosshairs & segmented ring */}
        <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 w-full h-full opacity-70">
          <circle
            cx="50"
            cy="50"
            r="38"
            fill="none"
            stroke={borderHex}
            strokeWidth="1.5"
            strokeDasharray="10 6"
          />
          <line x1="50" y1="6" x2="50" y2="20" stroke={borderHex} strokeWidth="2" />
          <line x1="50" y1="80" x2="50" y2="94" stroke={borderHex} strokeWidth="2" />
          <line x1="6" y1="50" x2="20" y2="50" stroke={borderHex} strokeWidth="2" />
          <line x1="80" y1="50" x2="94" y2="50" stroke={borderHex} strokeWidth="2" />
          {shaftDist > 2 && (
            <line
              x1="50"
              y1="50"
              x2={50 + (dx / Math.max(1, widget.width * 0.5)) * 45}
              y2={50 + (dy / Math.max(1, widget.height * 0.5)) * 45}
              stroke={knobHex}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          )}
        </svg>
        {/* Luminous energy puck */}
        <div
          className="rounded-full flex items-center justify-center"
          style={{
            width: `${knobPct}%`,
            height: `${knobPct}%`,
            transform: `translate(${dx}px, ${dy}px)`,
            background: `radial-gradient(circle, #FFFFFF 0%, ${knobHex} 55%, ${hexToRgba(knobHex, 0.25)} 100%)`,
            border: `2px solid ${borderHex}`,
            boxShadow: `0 0 16px ${knobHex}, inset 0 0 8px #FFFFFF`,
          }}
        >
          <div className="w-[38%] h-[38%] rounded-full bg-white/90" />
        </div>
      </div>
    );
  }

  // 6) ANCIENT STONE RUNE DIAL
  if (styleId === 'stoneRune') {
    return (
      <div
        onPointerDown={interactive ? onStickPointerDown : undefined}
        className={`w-full h-full relative flex items-center justify-center ${
          interactive ? 'touch-none cursor-grab pointer-events-auto' : ''
        }`}
        style={{
          ...baseVisual.surfaceStyle,
          border: `3px solid ${borderHex}`,
          boxShadow: 'inset 0 6px 14px rgba(0,0,0,0.7), 0 8px 16px rgba(0,0,0,0.55)',
        }}
      >
        <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 w-full h-full opacity-55">
          <circle cx="50" cy="50" r="38" fill="none" stroke={glowHex} strokeWidth="1.2" strokeDasharray="4 5" />
          <polygon points="50,12 54,20 46,20" fill={glowHex} />
          <polygon points="50,88 54,80 46,80" fill={glowHex} />
          <polygon points="12,50 20,54 20,46" fill={glowHex} />
          <polygon points="88,50 80,54 80,46" fill={glowHex} />
        </svg>
        <div
          className="rounded-full flex items-center justify-center"
          style={{
            width: `${knobPct + 4}%`,
            height: `${knobPct + 4}%`,
            transform: `translate(${dx}px, ${dy}px)`,
            background: `radial-gradient(circle at 35% 30%, #FFFFFF 0%, ${knobHex} 45%, #1F172A 100%)`,
            border: `2px solid ${borderHex}`,
            boxShadow: `0 0 16px ${hexToRgba(glowHex, 0.72)}, 0 6px 12px rgba(0,0,0,0.75)`,
          }}
        />
      </div>
    );
  }

  // 7) MODERN DEFAULT (still respects custom shape, surface texture, knob size & colors!)
  return (
    <div
      onPointerDown={interactive ? onStickPointerDown : undefined}
      className={`w-full h-full flex items-center justify-center shadow-inner relative overflow-hidden ${
        interactive ? 'touch-none cursor-grab pointer-events-auto' : ''
      }`}
      style={{
        ...baseVisual.surfaceStyle,
        borderRadius: geom.borderRadius,
        clipPath: geom.clipPath,
      }}
    >
      <div
        className="shadow-lg border border-black/25"
        style={{
          width: `${knobPct}%`,
          height: `${knobPct}%`,
          borderRadius: shape === 'circle' ? '9999px' : '12px',
          backgroundColor: knobHex,
          transform: `translate(${dx}px, ${dy}px)`,
        }}
      />
    </div>
  );
}

/**
 * Renders customizable tactile Action & Pause Buttons:
 * flat | arcadeDome | gamepad3d | woodCarved | sciFiHolokey | waxSeal | comicPop | bevel3d
 */
function CustomButtonRenderer({
  widget,
  interactive,
  isPause,
  onActionPointerDown,
  onActionPointerUp,
  onPauseTrigger,
  seed,
}: {
  widget: HUDWidget;
  interactive: boolean;
  isPause: boolean;
  onActionPointerDown?: (action: ActionButtonBinding, e: React.PointerEvent<HTMLButtonElement>) => void;
  onActionPointerUp?: (action: ActionButtonBinding, e: React.PointerEvent<HTMLButtonElement>) => void;
  onPauseTrigger?: (e: React.PointerEvent<HTMLButtonElement>) => void;
  seed: number;
}) {
  const btnStyle = widget.buttonStyle ?? 'flat';
  const shape = widget.shape ?? 'circle';
  const fillHex = widget.fillHex || '#3B82F6';
  const borderHex = widget.borderHex ?? '#FFFFFF';
  const textHex = widget.textHex ?? '#FFFFFF';
  const glowHex = widget.glowHex ?? fillHex;
  const fontStack = getHudFontStack(widget.fontFamily);
  const iconSize = isPause
    ? Math.max(13, Math.min(20, Math.round(Math.min(widget.width, widget.height) * 0.42)))
    : Math.max(13, Math.min(26, Math.round(Math.min(widget.width, widget.height) * 0.34)));

  const geom = getShapeGeometry(shape, widget.cornerRadius ?? 14, widget.paperTears ?? 0, seed);

  const surface = buildSurfaceVisualStyles({
    surfaceTexture:
      widget.surfaceTexture ??
      (btnStyle === 'woodCarved'
        ? 'wood'
        : btnStyle === 'sciFiHolokey'
        ? 'circuitTech'
        : btnStyle === 'arcadeDome'
        ? 'arcadePlastic'
        : btnStyle === 'comicPop'
        ? 'comicHalftone'
        : 'smooth'),
    shape,
    bgHex: fillHex,
    borderHex,
    borderStyle: widget.borderStyle ?? 'solid',
    borderWidth: widget.borderWidth ?? 2,
    cornerRadius: widget.cornerRadius ?? 14,
    edgeWear: widget.edgeWear,
    burnedEdges: widget.burnedEdges,
    paperTears: widget.paperTears,
    glowIntensity: widget.glowIntensity ?? (btnStyle === 'sciFiHolokey' ? 0.65 : 0),
    glowHex,
    shadowDepth: widget.shadowDepth ?? 0.5,
    opacity: 1,
    seed,
  });

  const labelEl = !isPause && widget.label && (
    <span
      className="leading-none tracking-tight relative z-10 px-1 truncate max-w-full"
      style={{
        fontFamily: fontStack,
        fontSize: `${widget.fontSize ?? Math.max(9, Math.min(12, Math.round(widget.height * 0.17)))}px`,
        textTransform: widget.uppercase ? 'uppercase' : undefined,
        letterSpacing: widget.letterSpacing ? `${widget.letterSpacing}px` : undefined,
        textShadow: widget.textGlow ? `0 0 8px ${glowHex}` : '0 1px 2px rgba(0,0,0,0.55)',
      }}
    >
      {widget.label}
    </span>
  );

  const iconEl = (
    <span className="relative z-10 flex items-center justify-center">
      {isPause ? (
        <Pause size={iconSize} color={textHex} />
      ) : (
        <ActionBindingIcon binding={widget.actionId ?? 'jump'} size={iconSize} color={textHex} />
      )}
    </span>
  );

  // Per-button-style extra tactile decoration & CSS
  let extraStyle: React.CSSProperties = {
    ...surface.surfaceStyle,
    color: textHex,
  };
  let overlayNodes: React.ReactNode = null;

  if (btnStyle === 'arcadeDome') {
    extraStyle = {
      ...extraStyle,
      background: `radial-gradient(circle at 32% 24%, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.22) 22%, ${fillHex} 52%, rgba(0,0,0,0.45) 100%)`,
      backgroundColor: fillHex,
      border: `4px solid #1E2433`,
      boxShadow: `0 6px 0 #0B0F19, 0 9px 16px rgba(0,0,0,0.65), inset 0 3px 5px rgba(255,255,255,0.7), inset 0 -5px 8px rgba(0,0,0,0.45)`,
    };
    overlayNodes = (
      <span
        className="pointer-events-none absolute inset-[10%] border border-white/35"
        style={{ borderRadius: geom.borderRadius, clipPath: geom.clipPath }}
      />
    );
  } else if (btnStyle === 'gamepad3d') {
    extraStyle = {
      ...extraStyle,
      background: `linear-gradient(155deg, rgba(255,255,255,0.34) 0%, ${fillHex} 42%, rgba(0,0,0,0.42) 100%)`,
      backgroundColor: fillHex,
      border: `2.5px solid rgba(255,255,255,0.28)`,
      boxShadow: `0 5px 0 rgba(10,14,22,0.85), 0 8px 14px rgba(0,0,0,0.55), inset 0 2px 3px rgba(255,255,255,0.5), inset 0 -4px 6px rgba(0,0,0,0.48)`,
    };
  } else if (btnStyle === 'woodCarved') {
    extraStyle = {
      ...extraStyle,
      border: `3px solid ${borderHex}`,
      boxShadow:
        '0 5px 0 #291306, 0 8px 14px rgba(0,0,0,0.55), inset 0 2px 4px rgba(255,220,165,0.35), inset 0 -4px 8px rgba(28,12,4,0.68)',
    };
    overlayNodes = (
      <>
        <span className="pointer-events-none absolute top-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-300/80 shadow-sm" />
        <span className="pointer-events-none absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-300/80 shadow-sm" />
      </>
    );
  } else if (btnStyle === 'sciFiHolokey') {
    extraStyle = {
      ...extraStyle,
      backgroundColor: hexToRgba(fillHex, 0.24),
      border: `2px solid ${borderHex}`,
      boxShadow: `inset 0 0 18px ${hexToRgba(glowHex, 0.48)}, 0 0 14px ${hexToRgba(glowHex, 0.55)}`,
    };
    overlayNodes = (
      <span
        className="pointer-events-none absolute inset-[4px] border opacity-55"
        style={{
          borderColor: glowHex,
          borderRadius: geom.borderRadius,
          clipPath: geom.clipPath,
        }}
      />
    );
  } else if (btnStyle === 'waxSeal') {
    extraStyle = {
      ...extraStyle,
      background: `radial-gradient(circle at 34% 30%, rgba(255,255,255,0.3), transparent 46%), radial-gradient(circle at 50% 50%, ${fillHex} 58%, rgba(20,4,4,0.75) 100%)`,
      backgroundColor: fillHex,
      border: `4px double ${hexToRgba('#000000', 0.42)}`,
      boxShadow:
        '0 4px 10px rgba(0,0,0,0.55), inset 0 2px 4px rgba(255,255,255,0.32), inset 0 -4px 8px rgba(0,0,0,0.55)',
    };
    overlayNodes = (
      <span
        className="pointer-events-none absolute inset-[5px] rounded-full border border-white/25"
        style={{ boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.45)' }}
      />
    );
  } else if (btnStyle === 'comicPop') {
    extraStyle = {
      ...extraStyle,
      border: `3px solid #111827`,
      boxShadow: `4px 4px 0 #111827`,
    };
  } else if (btnStyle === 'bevel3d') {
    extraStyle = {
      ...extraStyle,
      borderTop: '2.5px solid rgba(255,255,255,0.55)',
      borderLeft: '2.5px solid rgba(255,255,255,0.35)',
      borderRight: '2.5px solid rgba(0,0,0,0.45)',
      borderBottom: '4px solid rgba(0,0,0,0.65)',
      boxShadow: '0 6px 0 rgba(0,0,0,0.55), 0 8px 14px rgba(0,0,0,0.4)',
    };
  }

  const pointerHandlers = interactive
    ? isPause
      ? {
          onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
            e.stopPropagation();
            onPauseTrigger?.(e);
          },
        }
      : {
          onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) =>
            onActionPointerDown?.(widget.actionId ?? 'jump', e),
          onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) =>
            onActionPointerUp?.(widget.actionId ?? 'jump', e),
          onPointerLeave: (e: React.PointerEvent<HTMLButtonElement>) =>
            onActionPointerUp?.(widget.actionId ?? 'jump', e),
          onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) =>
            onActionPointerUp?.(widget.actionId ?? 'jump', e),
        }
    : {};

  return (
    <button
      type="button"
      {...pointerHandlers}
      title={isPause ? 'Pause' : widget.label}
      className={`w-full h-full relative flex flex-col items-center justify-center gap-0.5 font-extrabold transition-transform overflow-hidden ${
        interactive
          ? 'touch-none active:scale-90 active:translate-y-0.5 pointer-events-auto cursor-pointer'
          : 'pointer-events-none'
      }`}
      style={extraStyle}
    >
      {overlayNodes}
      {surface.burnOverlayStyle && (
        <span
          className="pointer-events-none absolute inset-0"
          style={surface.burnOverlayStyle}
        />
      )}
      {iconEl}
      {labelEl}
    </button>
  );
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
  const seed = hashWidgetSeed(widget.id);
  const opacity = Math.max(0.08, Math.min(1, widget.opacity ?? 0.92));

  const defaultBgHex =
    widget.kind === 'minimap' ? '#0B2239' : '#0F1521';
  const bgHex = widget.bgHex ?? defaultBgHex;
  const borderHex = widget.borderHex ?? 'rgba(255,255,255,0.22)';
  const textHex = widget.textHex ?? '#FFFFFF';
  const glowHex = widget.glowHex ?? widget.fillHex ?? borderHex;
  const fontStack = getHudFontStack(widget.fontFamily);

  const defaultShape =
    widget.kind === 'counter' || widget.kind === 'timer' || widget.kind === 'tutorial'
      ? 'circle'
      : widget.kind === 'joystick' || widget.kind === 'actionButton' || widget.kind === 'pauseButton'
      ? 'circle'
      : 'rounded';
  const resolvedShape = widget.shape ?? defaultShape;

  const surface = buildSurfaceVisualStyles({
    surfaceTexture: widget.surfaceTexture ?? 'smooth',
    shape: resolvedShape,
    bgHex,
    borderHex,
    borderStyle: widget.borderStyle ?? 'solid',
    borderWidth: widget.borderWidth ?? 1.5,
    cornerRadius: widget.cornerRadius ?? 12,
    edgeWear: widget.edgeWear ?? 0,
    burnedEdges: widget.burnedEdges ?? 0,
    paperTears: widget.paperTears ?? 0,
    organicWobble: widget.organicWobble ?? 0,
    glowIntensity: widget.glowIntensity ?? 0,
    glowHex,
    shadowDepth: widget.shadowDepth ?? 0.35,
    rotationDeg: widget.rotationDeg ?? 0,
    opacity,
    seed,
  });

  const textStyle: React.CSSProperties = {
    fontFamily: fontStack,
    color: textHex,
    textTransform: widget.uppercase ? 'uppercase' : undefined,
    letterSpacing: widget.letterSpacing ? `${widget.letterSpacing}px` : undefined,
    textShadow: widget.textGlow ? `0 0 8px ${glowHex}` : undefined,
  };

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

  const barStyle = widget.barStyle ?? 'smooth';
  const barFillBg =
    state.flashHealth && widget.binding === 'health'
      ? '#FFFFFF'
      : barStyle === 'beveled'
      ? `linear-gradient(180deg, rgba(255,255,255,0.42) 0%, ${widget.fillHex} 40%, rgba(0,0,0,0.32) 100%)`
      : barStyle === 'neon'
      ? `linear-gradient(90deg, ${hexToRgba(widget.fillHex, 0.75)} 0%, ${widget.fillHex} 60%, #FFFFFF 100%)`
      : barStyle === 'segmented'
      ? `repeating-linear-gradient(90deg, ${widget.fillHex} 0px, ${widget.fillHex} 10px, rgba(0,0,0,0.42) 10px, rgba(0,0,0,0.42) 12px)`
      : barStyle === 'ornate'
      ? `linear-gradient(180deg, rgba(255,235,190,0.35) 0%, ${widget.fillHex} 45%, rgba(35,14,4,0.45) 100%)`
      : widget.fillHex;

  return (
    <div
      className="w-full h-full relative select-none"
      style={{
        ...surface.outerStyle,
        outline: isSelected ? '2.5px solid #6C4CF1' : 'none',
        outlineOffset: '3px',
        borderRadius: resolvedShape === 'circle' ? '9999px' : '12px',
      }}
    >
      {/* Inner wrapper carrying optional organic SVG edge-wear displacement filter */}
      <div
        className="w-full h-full relative"
        style={{
          filter: surface.wearFilterUrl,
        }}
      >
        {(widget.kind === 'bar' || widget.kind === 'bossBar') && (
          <div
            className="w-full h-full overflow-hidden relative flex items-center px-2.5"
            style={surface.surfaceStyle}
          >
            <div
              className="absolute inset-y-0 left-0 transition-all duration-150"
              style={{
                width: `${Math.max(6, fraction * 100)}%`,
                background: barFillBg,
                boxShadow:
                  barStyle === 'neon'
                    ? `0 0 12px ${widget.fillHex}`
                    : undefined,
              }}
            />
            {surface.burnOverlayStyle && (
              <span
                className="pointer-events-none absolute inset-0 z-[5]"
                style={surface.burnOverlayStyle}
              />
            )}
            <SurfaceOrnaments
              isOrnate={surface.isOrnate}
              borderHex={borderHex}
              texture={widget.surfaceTexture}
            />
            <div
              className="relative z-10 flex items-center justify-between w-full text-[11px] font-extrabold"
              style={textStyle}
            >
              <span className="flex items-center gap-1.5 truncate">
                <MakerIcon symbol={stat?.symbol ?? 'heart.fill'} size={11} color={textHex} />
                <span className="truncate">
                  {widget.kind === 'bossBar' ? state.bossName || widget.label : widget.label}
                </span>
              </span>
              <span className="tabular-nums text-[10px] shrink-0">{Math.round(fraction * 100)}%</span>
            </div>
          </div>
        )}

        {widget.kind === 'counter' && (
          <div
            className="w-full h-full px-3 flex items-center justify-center gap-1.5 text-xs font-extrabold tabular-nums relative overflow-hidden"
            style={{ ...surface.surfaceStyle, ...textStyle }}
          >
            {surface.burnOverlayStyle && (
              <span className="pointer-events-none absolute inset-0" style={surface.burnOverlayStyle} />
            )}
            <SurfaceOrnaments
              isOrnate={surface.isOrnate}
              borderHex={borderHex}
              texture={widget.surfaceTexture}
            />
            <MakerIcon symbol={stat?.symbol ?? 'circle.fill'} size={13} color={widget.fillHex} />
            <span className="relative z-10">× {counterValue}</span>
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
                  className="flex items-center justify-center relative text-[10px] font-bold overflow-hidden"
                  style={{
                    ...surface.surfaceStyle,
                    borderColor: item?.held ? '#38BDF8' : borderHex,
                    color: textHex,
                    fontFamily: fontStack,
                  }}
                >
                  {surface.burnOverlayStyle && (
                    <span className="pointer-events-none absolute inset-0" style={surface.burnOverlayStyle} />
                  )}
                  {item ? (
                    <>
                      <InventoryItemIcon icon={item.icon} size={15} color={item.colorHex} />
                      {item.qty > 1 && (
                        <span
                          className="absolute bottom-0 right-0.5 text-[8px] font-black"
                          style={{ color: textHex }}
                        >
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
          <div
            className="w-full h-full relative overflow-hidden flex items-center justify-center p-1.5"
            style={surface.surfaceStyle}
          >
            <svg viewBox="0 0 100 100" className="w-full h-full relative z-10">
              <circle
                cx="50"
                cy="50"
                r="46"
                fill={widget.surfaceTexture === 'parchment' ? '#C7A972' : '#2D5A3D'}
                stroke={widget.surfaceTexture === 'holoGlass' ? '#22D3EE' : '#DFC78B'}
                strokeWidth="2.5"
              />
              <path
                d="M8,62 Q38,44 62,56 T94,42"
                fill="none"
                stroke={widget.surfaceTexture === 'parchment' ? '#6B7D8C' : '#2B8CE6'}
                strokeWidth="4"
                strokeLinecap="round"
              />
              <path
                d="M18,78 Q46,66 64,46 T86,24"
                fill="none"
                stroke={widget.surfaceTexture === 'parchment' ? '#5E3817' : '#D9B27A'}
                strokeWidth="2.5"
                strokeDasharray="3 2"
              />
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
            {surface.burnOverlayStyle && (
              <span className="pointer-events-none absolute inset-0 z-20" style={surface.burnOverlayStyle} />
            )}
            <SurfaceOrnaments
              isOrnate={surface.isOrnate}
              borderHex={borderHex}
              texture={widget.surfaceTexture}
            />
          </div>
        )}

        {widget.kind === 'objectiveList' && (
          <div
            className="w-full min-h-full px-3 py-2 flex flex-col justify-center gap-0.5 relative overflow-hidden"
            style={{ ...surface.surfaceStyle, ...textStyle }}
          >
            {surface.burnOverlayStyle && (
              <span className="pointer-events-none absolute inset-0" style={surface.burnOverlayStyle} />
            )}
            <SurfaceOrnaments
              isOrnate={surface.isOrnate}
              borderHex={borderHex}
              texture={widget.surfaceTexture}
            />
            <div className="relative z-10 flex items-center justify-between gap-2 mb-0.5">
              <div
                className="flex items-center gap-1 text-[9px] font-black tracking-wider uppercase"
                style={{ color: widget.fillHex }}
              >
                <List size={10} />
                <span>{widget.label || 'TO DO'}</span>
              </div>
              {(state.buddiesTotal ?? 0) > 0 && (
                <span className="text-[10px] font-extrabold tabular-nums text-[#FACC15]">
                  Buddies {state.buddiesFound ?? 0}/{state.buddiesTotal}
                </span>
              )}
            </div>
            {state.objectives.length === 0 ? (
              <div className="relative z-10 text-[11px] font-semibold opacity-80 leading-snug">
                Explore the world
              </div>
            ) : (
              state.objectives.slice(0, 3).map((goal, idx) => (
                <div key={idx} className="relative z-10 text-[11px] font-semibold leading-snug break-words">
                  • {goal}
                </div>
              ))
            )}
          </div>
        )}

        {widget.kind === 'dialogue' && (
          <div
            className="w-full h-full p-2.5 flex flex-col justify-center relative overflow-hidden"
            style={{ ...surface.surfaceStyle, ...textStyle }}
          >
            {surface.burnOverlayStyle && (
              <span className="pointer-events-none absolute inset-0" style={surface.burnOverlayStyle} />
            )}
            <SurfaceOrnaments
              isOrnate={surface.isOrnate}
              borderHex={borderHex}
              texture={widget.surfaceTexture}
            />
            <div className="relative z-10 text-[11px] font-extrabold" style={{ color: widget.fillHex }}>
              Mira
            </div>
            <div className="relative z-10 text-[11px] line-clamp-2 opacity-90">
              A key? The guard dropped one by the well.
            </div>
          </div>
        )}

        {widget.kind === 'pauseButton' && (
          <CustomButtonRenderer
            widget={widget}
            interactive={interactive}
            isPause={true}
            onPauseTrigger={onPauseTrigger}
            seed={seed}
          />
        )}

        {widget.kind === 'timer' && (
          <div
            className="w-full h-full px-3 flex items-center justify-center gap-1.5 text-xs font-extrabold tabular-nums relative overflow-hidden"
            style={{ ...surface.surfaceStyle, ...textStyle }}
          >
            {surface.burnOverlayStyle && (
              <span className="pointer-events-none absolute inset-0" style={surface.burnOverlayStyle} />
            )}
            <Timer size={12} className="relative z-10" />
            <span className="relative z-10">{state.timeText}</span>
          </div>
        )}

        {widget.kind === 'tutorial' && (
          <div
            className="w-full h-full px-3 flex items-center justify-center gap-1.5 text-[11px] font-semibold relative overflow-hidden"
            style={{ ...surface.surfaceStyle, ...textStyle }}
          >
            {surface.burnOverlayStyle && (
              <span className="pointer-events-none absolute inset-0" style={surface.burnOverlayStyle} />
            )}
            <span className="relative z-10 truncate">{widget.label || 'Move with WASD or stick'}</span>
          </div>
        )}

        {widget.kind === 'joystick' && (
          <CustomJoystickRenderer
            widget={widget}
            interactive={interactive}
            stickOffset={stickOffset}
            onStickPointerDown={onStickPointerDown}
            seed={seed}
          />
        )}

        {widget.kind === 'actionButton' && (
          <CustomButtonRenderer
            widget={widget}
            interactive={interactive}
            isPause={false}
            onActionPointerDown={onActionPointerDown}
            onActionPointerUp={onActionPointerUp}
            seed={seed}
          />
        )}
      </div>
    </div>
  );
};
