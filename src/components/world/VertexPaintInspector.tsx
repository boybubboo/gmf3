import React, { useState } from 'react';
import {
  Eraser,
  GitBranch,
  Hammer,
  Hand,
  Leaf,
  Paintbrush,
  Palette,
  Redo2,
  RotateCcw,
  Sparkles,
  Trees,
  Undo2,
  Wand2,
} from 'lucide-react';
import { WEATHERING_PRESETS } from '../../three/nodeMaterialUtils';
import {
  computeShiftedHexColor,
  type VertexPaintBrushSettings,
} from '../../three/vertexPainter';
import type {
  VertexPaintMode,
  VertexPaintTarget,
} from '../../types/maker';

export interface VertexPaintInspectorProps {
  brush: VertexPaintBrushSettings;
  onChangeBrush: React.Dispatch<React.SetStateAction<VertexPaintBrushSettings>>;
  interactionTool: 'paint' | 'orbit';
  onChangeInteractionTool: (mode: 'paint' | 'orbit') => void;
  strokeCount: number;
  canRedo: boolean;
  onUndoStroke: () => void;
  onRedoStroke: () => void;
  onClearAllPaint: () => void;
  onAutoDapple: () => void;
  showPartTargets?: boolean;
  partTargetLabels?: { all: string; leaves: string; branches: string };
  accentColor?: string;
}

const GENERAL_SWATCHES = [
  { label: 'Warm Oak', hex: '#7D573D' },
  { label: 'Meadow Green', hex: '#4EA343' },
  { label: 'Sunlit Lime', hex: '#A4DF54' },
  { label: 'Autumn Gold', hex: '#F0B838' },
  { label: 'Crimson', hex: '#C6362C' },
  { label: 'Sky Teal', hex: '#38BDF8' },
  { label: 'Slate Stone', hex: '#6E7485' },
  { label: 'Ivory Chalk', hex: '#EAE4D7' },
  { label: 'Deep Shadow', hex: '#2F2734' },
  { label: 'Mystic Violet', hex: '#8B5CF6' },
];

const MODE_OPTIONS: {
  id: VertexPaintMode;
  label: string;
  desc: string;
  icon: React.ReactNode;
}[] = [
  { id: 'paint', label: 'Color', desc: 'Paint direct vertex tint', icon: <Paintbrush size={12} /> },
  { id: 'hueShift', label: 'Hue', desc: 'Shift texture hue', icon: <Palette size={12} /> },
  { id: 'organicJitter', label: 'Organic', desc: 'Multi-tone natural mottling', icon: <Sparkles size={12} /> },
  { id: 'degrade', label: 'Degrade', desc: 'Chips, cracks, moss, rust', icon: <Hammer size={12} /> },
  { id: 'erase', label: 'Erase', desc: 'Restore original look', icon: <Eraser size={12} /> },
];

export const VertexPaintInspector: React.FC<VertexPaintInspectorProps> = ({
  brush,
  onChangeBrush,
  interactionTool,
  onChangeInteractionTool,
  strokeCount,
  canRedo,
  onUndoStroke,
  onRedoStroke,
  onClearAllPaint,
  onAutoDapple,
  showPartTargets = false,
  partTargetLabels = { all: 'All Parts', leaves: 'Leaves / Petals', branches: 'Stems / Bark' },
  accentColor = '#EC4899',
}) => {
  const [confirmClear, setConfirmClear] = useState(false);

  const effectiveHex = computeShiftedHexColor(
    brush.color,
    brush.hueShift,
    brush.saturationShift,
    brush.valueShift
  );

  const targets: { id: VertexPaintTarget; label: string; icon: React.ReactNode }[] = [
    { id: 'all', label: partTargetLabels.all, icon: <Trees size={11} /> },
    { id: 'leaves', label: partTargetLabels.leaves, icon: <Leaf size={11} /> },
    { id: 'branches', label: partTargetLabels.branches, icon: <GitBranch size={11} /> },
  ];

  return (
    <div className="space-y-3">
      {/* Paint vs Orbit + Undo / Redo / Clear */}
      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#191E2A] border border-slate-200/80 dark:border-white/[0.08] space-y-2">
        <div className="flex items-center justify-between gap-1.5">
          <div className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-slate-200/70 dark:bg-[#11141C]">
            <button
              type="button"
              onClick={() => onChangeInteractionTool('paint')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-extrabold transition-colors whitespace-nowrap ${
                interactionTool === 'paint'
                  ? 'text-white shadow-xs'
                  : 'text-slate-600 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white'
              }`}
              style={interactionTool === 'paint' ? { backgroundColor: accentColor } : undefined}
            >
              <Paintbrush size={11} />
              <span>Paint Brush</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeInteractionTool('orbit')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-extrabold transition-colors whitespace-nowrap ${
                interactionTool === 'orbit'
                  ? 'bg-[#7C5CFF] text-white shadow-xs'
                  : 'text-slate-600 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Hand size={11} />
              <span>Orbit</span>
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onUndoStroke}
              disabled={strokeCount === 0}
              title="Undo last paint stroke"
              className="p-1.5 rounded-lg bg-white dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 disabled:opacity-35 hover:border-[#7C5CFF]"
            >
              <Undo2 size={12} />
            </button>
            <button
              type="button"
              onClick={onRedoStroke}
              disabled={!canRedo}
              title="Redo paint stroke"
              className="p-1.5 rounded-lg bg-white dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 disabled:opacity-35 hover:border-[#7C5CFF]"
            >
              <Redo2 size={12} />
            </button>
            {confirmClear ? (
              <button
                type="button"
                onClick={() => {
                  setConfirmClear(false);
                  onClearAllPaint();
                }}
                onMouseLeave={() => setConfirmClear(false)}
                className="px-2 py-1 rounded-lg bg-red-600 text-white text-[10px] font-extrabold whitespace-nowrap"
              >
                Confirm Clear
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                disabled={strokeCount === 0}
                title="Clear all vertex paint on this asset"
                className="p-1.5 rounded-lg bg-white dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.08] text-slate-500 hover:text-red-500 disabled:opacity-35"
              >
                <RotateCcw size={12} />
              </button>
            )}
          </div>
        </div>
        <p className="text-[10px] text-slate-500 dark:text-[#8E96AB] leading-snug">
          Drag directly on the 3D model to paint. Hold <strong className="text-slate-700 dark:text-slate-200">Space</strong> or right-drag to orbit · <strong className="text-slate-700 dark:text-slate-200">[ / ]</strong> resizes brush · {strokeCount} stroke{strokeCount === 1 ? '' : 's'}
        </p>
      </div>

      {/* Mode Selector */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
          Brush Mode
        </div>
        <div className="grid grid-cols-5 gap-1">
          {MODE_OPTIONS.map((m) => {
            const active = brush.mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                title={m.desc}
                onClick={() => onChangeBrush((b) => ({ ...b, mode: m.id }))}
                className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl border text-[10px] font-extrabold transition-colors ${
                  active
                    ? 'text-white shadow-xs border-transparent'
                    : 'bg-slate-50 dark:bg-[#191E2A] border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 hover:border-slate-300'
                }`}
                style={
                  active
                    ? {
                        backgroundColor:
                          m.id === 'erase'
                            ? '#EF4444'
                            : m.id === 'degrade'
                            ? '#F59E0B'
                            : accentColor,
                      }
                    : undefined
                }
              >
                {m.icon}
                <span className="truncate max-w-full">{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Optional Part Mask (Plants & Trees) */}
      {showPartTargets && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Paint Target Mask
          </div>
          <div className="grid grid-cols-3 gap-1">
            {targets.map((t) => {
              const active = brush.target === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onChangeBrush((b) => ({ ...b, target: t.id }))}
                  className={`inline-flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-lg border text-[10px] font-bold transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#20B46A] border-[#20B46A] text-white'
                      : 'bg-slate-50 dark:bg-[#191E2A] border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {t.icon}
                  <span className="truncate">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Degrade / Weathering controls */}
      {brush.mode === 'degrade' && (
        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-2">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-300">
            Weathering &amp; Wear Form
          </div>
          <div className="grid grid-cols-2 gap-1">
            {WEATHERING_PRESETS.filter((w) => w.id !== 'none').map((preset) => {
              const active = (brush.degradeForm ?? 'cracked') === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onChangeBrush((b) => ({ ...b, degradeForm: preset.id }))}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-bold text-left transition-colors ${
                    active
                      ? 'bg-[#F59E0B] border-[#F59E0B] text-white'
                      : 'bg-white/80 dark:bg-[#131720] border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/20"
                    style={{ backgroundColor: preset.swatch }}
                  />
                  <span className="truncate">{preset.label}</span>
                </button>
              );
            })}
          </div>
          {(brush.degradeForm === 'chipped' || brush.degradeForm === 'cracked' || !brush.degradeForm) && (
            <label className="block space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-slate-700 dark:text-slate-200">Physical Chip Depth</span>
                <span className="tabular-nums text-[10px] text-slate-500">
                  {Math.round((brush.degradeChipDepth ?? 0.45) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={brush.degradeChipDepth ?? 0.45}
                onChange={(e) =>
                  onChangeBrush((b) => ({ ...b, degradeChipDepth: Number(e.target.value) }))
                }
                className="w-full h-1.5 accent-[#F59E0B] cursor-pointer"
              />
            </label>
          )}
        </div>
      )}

      {/* Color & Swatches when painting/hue-shifting */}
      {brush.mode !== 'erase' && brush.mode !== 'degrade' && (
        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#191E2A] border border-slate-200/80 dark:border-white/[0.08] space-y-2.5">
          {brush.mode !== 'hueShift' && (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200">
                  Brush Color
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className="w-5 h-5 rounded-md border border-black/20"
                    style={{ backgroundColor: effectiveHex }}
                    title={`Resulting tint: ${effectiveHex}`}
                  />
                  <input
                    type="color"
                    value={brush.color}
                    onChange={(e) => onChangeBrush((b) => ({ ...b, color: e.target.value }))}
                    className="w-7 h-6 rounded border-0 bg-transparent cursor-pointer"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {GENERAL_SWATCHES.map((sw) => {
                  const active = brush.color.toLowerCase() === sw.hex.toLowerCase();
                  return (
                    <button
                      key={sw.hex}
                      type="button"
                      title={sw.label}
                      onClick={() =>
                        onChangeBrush((b) => ({
                          ...b,
                          color: sw.hex,
                          hueShift: 0,
                          saturationShift: 0,
                          valueShift: 0,
                        }))
                      }
                      className={`w-5 h-5 rounded-full border transition-transform ${
                        active
                          ? 'scale-115 ring-2 ring-[#EC4899] border-white'
                          : 'border-black/20 hover:scale-110'
                      }`}
                      style={{ backgroundColor: sw.hex }}
                    />
                  );
                })}
              </div>
            </>
          )}

          {/* Hue Shift Slider */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="text-slate-700 dark:text-slate-200">Hue Shift</span>
              <span className="tabular-nums font-mono text-[10px] text-slate-500">
                {brush.hueShift > 0 ? `+${brush.hueShift}°` : `${brush.hueShift}°`}
              </span>
            </div>
            <div
              className="h-1.5 w-full rounded-full"
              style={{
                background:
                  'linear-gradient(90deg, #ff3b30, #ff9500, #ffcc00, #34c759, #00c7be, #007aff, #af52de, #ff2d55, #ff3b30)',
              }}
            />
            <input
              type="range"
              min={-180}
              max={180}
              step={2}
              value={brush.hueShift}
              onChange={(e) => onChangeBrush((b) => ({ ...b, hueShift: Number(e.target.value) }))}
              className="w-full h-1.5 accent-[#EC4899] cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-bold">
                <span className="text-slate-600 dark:text-slate-300">Saturation</span>
                <span className="tabular-nums text-slate-500">
                  {brush.saturationShift >= 0 ? '+' : ''}
                  {Math.round(brush.saturationShift * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={-0.7}
                max={0.7}
                step={0.05}
                value={brush.saturationShift}
                onChange={(e) =>
                  onChangeBrush((b) => ({ ...b, saturationShift: Number(e.target.value) }))
                }
                className="w-full h-1.5 accent-[#EC4899] cursor-pointer"
              />
            </label>
            <label className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-bold">
                <span className="text-slate-600 dark:text-slate-300">Brightness</span>
                <span className="tabular-nums text-slate-500">
                  {brush.valueShift >= 0 ? '+' : ''}
                  {Math.round(brush.valueShift * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={-0.45}
                max={0.45}
                step={0.05}
                value={brush.valueShift}
                onChange={(e) =>
                  onChangeBrush((b) => ({ ...b, valueShift: Number(e.target.value) }))
                }
                className="w-full h-1.5 accent-[#EC4899] cursor-pointer"
              />
            </label>
          </div>

          <label className="block space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="text-slate-700 dark:text-slate-200">Organic Scatter</span>
              <span className="tabular-nums text-[10px] text-slate-500">{brush.hueJitter}°</span>
            </div>
            <input
              type="range"
              min={0}
              max={75}
              step={2}
              value={brush.hueJitter}
              onChange={(e) => onChangeBrush((b) => ({ ...b, hueJitter: Number(e.target.value) }))}
              className="w-full h-1.5 accent-[#20B46A] cursor-pointer"
            />
          </label>
        </div>
      )}

      {/* Brush Size, Opacity & Falloff */}
      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#191E2A] border border-slate-200/80 dark:border-white/[0.08] space-y-2">
        <label className="block space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className="text-slate-700 dark:text-slate-200">Brush Size</span>
            <span className="tabular-nums font-mono text-[10px] text-slate-500">
              {brush.radius.toFixed(2)}m
            </span>
          </div>
          <input
            type="range"
            min={0.12}
            max={2.4}
            step={0.04}
            value={brush.radius}
            onChange={(e) => onChangeBrush((b) => ({ ...b, radius: Number(e.target.value) }))}
            style={{ accentColor }}
            className="w-full h-1.5 cursor-pointer"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <div className="flex items-center justify-between text-[10px] font-bold">
              <span className="text-slate-600 dark:text-slate-300">Opacity</span>
              <span className="tabular-nums text-slate-500">
                {Math.round(brush.opacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.05}
              max={1}
              step={0.05}
              value={brush.opacity}
              onChange={(e) => onChangeBrush((b) => ({ ...b, opacity: Number(e.target.value) }))}
              style={{ accentColor }}
              className="w-full h-1.5 cursor-pointer"
            />
          </label>
          <label className="space-y-1">
            <div className="flex items-center justify-between text-[10px] font-bold">
              <span className="text-slate-600 dark:text-slate-300">Softness</span>
              <span className="tabular-nums text-slate-500">
                {Math.round(brush.softness * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={brush.softness}
              onChange={(e) => onChangeBrush((b) => ({ ...b, softness: Number(e.target.value) }))}
              style={{ accentColor }}
              className="w-full h-1.5 cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* Auto Dapple / Weather */}
      <button
        type="button"
        onClick={onAutoDapple}
        className="w-full py-2 px-3 rounded-xl bg-slate-900 dark:bg-[#23293A] hover:opacity-95 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
      >
        <Wand2 size={13} className="text-[#EC4899]" />
        <span>
          {brush.mode === 'degrade'
            ? `Auto-Apply ${
                WEATHERING_PRESETS.find((w) => w.id === (brush.degradeForm ?? 'cracked'))?.label ??
                'Weathering'
              }`
            : 'Auto-Dapple Natural Variation'}
        </span>
      </button>
    </div>
  );
};
