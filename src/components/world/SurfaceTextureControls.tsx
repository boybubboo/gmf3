import React, { useRef, useState } from 'react';
import {
  FlipHorizontal2,
  FlipVertical2,
  Image as ImageIcon,
  Link2,
  Link2Off,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import type { MakerStore } from '../../store/useMakerStore';
import { createDefaultSurfaceTextureSettings } from '../../three/customTextureManager';
import { WEATHERING_PRESETS } from '../../three/nodeMaterialUtils';
import type {
  CustomTextureResolution,
  SceneryTextureSlot,
  SurfaceTextureSettings,
} from '../../types/maker';

interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display?: string;
  accent?: string;
  onChange: (v: number) => void;
}

const SliderControl: React.FC<SliderControlProps> = ({
  label,
  value,
  min,
  max,
  step,
  display,
  accent = '#7C5CFF',
  onChange,
}) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
      <span className="text-slate-600 dark:text-slate-300 truncate">{label}</span>
      <span className="font-mono tabular-nums text-[10px] text-slate-500 dark:text-[#949BB0] shrink-0">
        {display ?? value.toFixed(step >= 1 ? 0 : 2)}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ accentColor: accent }}
      className="w-full h-1.5 cursor-pointer"
    />
  </div>
);

interface SurfaceTextureControlsProps {
  store: MakerStore;
  slot?: SceneryTextureSlot;
  title?: string;
  value: SurfaceTextureSettings | undefined;
  onChange: (next: SurfaceTextureSettings | undefined, recordUndo?: boolean) => void;
  compact?: boolean;
  accent?: string;
}

const RES_OPTIONS: CustomTextureResolution[] = [256, 512, 1024];

export const SurfaceTextureControls: React.FC<SurfaceTextureControlsProps> = ({
  store,
  slot,
  title,
  value,
  onChange,
  compact = false,
  accent = '#7C5CFF',
}) => {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [maxRes, setMaxRes] = useState<CustomTextureResolution>(512);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const settings: SurfaceTextureSettings = value
    ? { ...createDefaultSurfaceTextureSettings(slot), ...value }
    : createDefaultSurfaceTextureSettings(slot);

  const activeMeta = settings.textureId
    ? store.customTextures.find((t) => t.id === settings.textureId) ?? null
    : null;

  const patch = (partial: Partial<SurfaceTextureSettings>, recordUndo = false) => {
    onChange({ ...settings, ...partial }, recordUndo);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const meta = await store.uploadCustomTexture(file, maxRes);
      onChange(
        {
          ...createDefaultSurfaceTextureSettings(slot, meta.id),
          ...value,
          textureId: meta.id,
          enabled: true,
        },
        true
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load that image.');
    } finally {
      setBusy(false);
    }
  };

  const handleDownsizeActive = async (target: CustomTextureResolution) => {
    if (!activeMeta) return;
    setBusy(true);
    setError(null);
    try {
      await store.resizeCustomTexture(activeMeta.id, target);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resize texture.');
    } finally {
      setBusy(false);
    }
  };

  const handleScaleChange = (axis: 'x' | 'y', nextVal: number) => {
    if (settings.lockScale !== false) {
      patch({ repeatX: nextVal, repeatY: nextVal });
    } else if (axis === 'x') {
      patch({ repeatX: nextVal });
    } else {
      patch({ repeatY: nextVal });
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Header & Upload Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {title ? (
          <span className="text-xs font-extrabold">{title}</span>
        ) : (
          <span className="text-xs font-extrabold">Custom Seamless Map</span>
        )}

        <div className="flex items-center gap-1.5 flex-wrap">
          {settings.textureId && (
            <label className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.08] text-[11px] font-bold cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => patch({ enabled: e.target.checked }, true)}
                style={{ accentColor: accent }}
              />
              <span>Active</span>
            </label>
          )}

          <select
            value={maxRes}
            onChange={(e) => setMaxRes(Number(e.target.value) as CustomTextureResolution)}
            title="Auto-resize uploaded images down to this max power-of-2 resolution"
            className="px-2 py-1 rounded-lg bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.08] text-[11px] font-bold"
          >
            {RES_OPTIONS.map((r) => (
              <option key={r} value={r}>
                Max {r}px
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            style={{ backgroundColor: `${accent}22`, color: accent, borderColor: `${accent}55` }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-extrabold hover:opacity-90 whitespace-nowrap"
          >
            <Upload size={11} />
            <span>{busy ? 'Processing...' : 'Upload Image'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-[11px] font-semibold text-red-500">
          {error}
        </div>
      )}

      {/* Active Texture Badge + On-the-spot Downsize */}
      {activeMeta && (
        <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white dark:bg-[#151922] border border-slate-200/80 dark:border-white/[0.08]">
          <img
            src={activeMeta.thumbnailDataUrl}
            alt={activeMeta.name}
            className="w-11 h-11 rounded-lg object-cover border border-black/15 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold truncate">{activeMeta.name}</div>
            <div className="text-[10px] font-mono text-slate-500 dark:text-[#8E96AB] flex flex-wrap items-center gap-1.5">
              <span>
                {activeMeta.width}×{activeMeta.height}
              </span>
              {activeMeta.originalWidth !== activeMeta.width && (
                <span>
                  (from {activeMeta.originalWidth}×{activeMeta.originalHeight})
                </span>
              )}
              <span>· {formatBytes(activeMeta.byteSize)}</span>
            </div>
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              <span className="text-[10px] text-slate-400">Resize down:</span>
              {RES_OPTIONS.map((r) => {
                const isCur = Math.max(activeMeta.width, activeMeta.height) === r;
                const canDownsize = Math.max(activeMeta.width, activeMeta.height) > r;
                return (
                  <button
                    key={r}
                    type="button"
                    disabled={busy || isCur || !canDownsize}
                    onClick={() => handleDownsizeActive(r)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                      isCur
                        ? 'bg-slate-200 dark:bg-white/[0.12] border-transparent text-slate-700 dark:text-white'
                        : canDownsize
                        ? 'border-slate-200 dark:border-white/[0.12] text-slate-600 dark:text-slate-300 hover:border-[#7C5CFF]'
                        : 'opacity-35 border-transparent text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {r}px
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onChange(undefined, true)}
            title="Clear custom texture from this surface"
            className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-white/[0.06] hover:bg-red-500/15 hover:text-red-500 text-[11px] font-bold shrink-0"
          >
            Clear
          </button>
        </div>
      )}

      {/* Project Texture Library Picker */}
      {store.customTextures.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#8E96AB]">
            <span>Project Texture Library ({store.customTextures.length})</span>
            <span>Click to assign</span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {store.customTextures.map((tex) => {
              const selected = settings.textureId === tex.id && settings.enabled;
              return (
                <div
                  key={tex.id}
                  className={`relative group shrink-0 w-16 rounded-lg overflow-hidden border transition-all ${
                    selected
                      ? 'border-[#7C5CFF] ring-2 ring-[#7C5CFF]/40'
                      : 'border-slate-200/80 dark:border-white/[0.1] hover:border-slate-400'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      onChange(
                        {
                          ...settings,
                          textureId: tex.id,
                          enabled: true,
                        },
                        true
                      )
                    }
                    className="block w-full text-left"
                  >
                    <img
                      src={tex.thumbnailDataUrl}
                      alt={tex.name}
                      className="w-16 h-12 object-cover block"
                    />
                    <div className="px-1 py-0.5 bg-white dark:bg-[#151922] text-[9px] font-bold truncate">
                      {tex.name}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      if (settings.textureId === tex.id) {
                        onChange(undefined, true);
                      }
                      void store.removeCustomTexture(tex.id);
                    }}
                    title="Delete texture from library"
                    className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/70 text-white opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-opacity"
                  >
                    <Trash2 size={9} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!activeMeta && store.customTextures.length === 0 && (
        <div className="p-3 rounded-xl border border-dashed border-slate-300 dark:border-white/[0.12] text-center space-y-1">
          <ImageIcon size={16} className="mx-auto text-slate-400" />
          <p className="text-[11px] font-semibold text-slate-500 dark:text-[#8E96AB]">
            Upload any seamless PNG, JPG, or WebP map. Large textures auto-resize cleanly to power-of-2.
          </p>
        </div>
      )}

      {/* Placement, Transform, Bump & Color Controls (visible once a texture is assigned) */}
      {settings.textureId && settings.enabled && (
        <div className="space-y-3 pt-2 border-t border-slate-200/70 dark:border-white/[0.08]">
          {/* Flip H / Flip V / Lock Aspect / Reset */}
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => patch({ flipX: !settings.flipX }, true)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                  settings.flipX
                    ? 'bg-[#7C5CFF]/15 border-[#7C5CFF] text-[#7C5CFF]'
                    : 'bg-white dark:bg-[#171A23] border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-300'
                }`}
              >
                <FlipHorizontal2 size={11} />
                <span>Flip H</span>
              </button>
              <button
                type="button"
                onClick={() => patch({ flipY: !settings.flipY }, true)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                  settings.flipY
                    ? 'bg-[#7C5CFF]/15 border-[#7C5CFF] text-[#7C5CFF]'
                    : 'bg-white dark:bg-[#171A23] border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-300'
                }`}
              >
                <FlipVertical2 size={11} />
                <span>Flip V</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  patch({
                    lockScale: settings.lockScale === false ? true : false,
                    repeatY: settings.lockScale === false ? settings.repeatX : settings.repeatY,
                  })
                }
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                  settings.lockScale !== false
                    ? 'bg-slate-200/80 dark:bg-white/[0.1] border-transparent text-slate-700 dark:text-slate-200'
                    : 'bg-white dark:bg-[#171A23] border-slate-200/80 dark:border-white/[0.08] text-slate-500'
                }`}
                title="Lock horizontal & vertical tiling scale together"
              >
                {settings.lockScale !== false ? <Link2 size={11} /> : <Link2Off size={11} />}
                <span>{settings.lockScale !== false ? 'Locked X/Y' : 'Free X/Y'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() =>
                onChange(createDefaultSurfaceTextureSettings(slot, settings.textureId), true)
              }
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white"
            >
              <RotateCcw size={11} />
              <span>Reset</span>
            </button>
          </div>

          {/* Tiling Size & Position */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
            {settings.lockScale !== false ? (
              <SliderControl
                label="Tile Scale (Repeat)"
                value={settings.repeatX}
                min={0.15}
                max={6.0}
                step={0.05}
                accent={accent}
                display={`${settings.repeatX.toFixed(2)}×`}
                onChange={(v) => handleScaleChange('x', v)}
              />
            ) : (
              <>
                <SliderControl
                  label="Tile Scale X"
                  value={settings.repeatX}
                  min={0.15}
                  max={6.0}
                  step={0.05}
                  accent={accent}
                  display={`${settings.repeatX.toFixed(2)}×`}
                  onChange={(v) => handleScaleChange('x', v)}
                />
                <SliderControl
                  label="Tile Scale Y"
                  value={settings.repeatY}
                  min={0.15}
                  max={6.0}
                  step={0.05}
                  accent={accent}
                  display={`${settings.repeatY.toFixed(2)}×`}
                  onChange={(v) => handleScaleChange('y', v)}
                />
              </>
            )}

            <SliderControl
              label="Rotation"
              value={settings.rotationDeg}
              min={0}
              max={360}
              step={1}
              accent={accent}
              display={`${Math.round(settings.rotationDeg)}°`}
              onChange={(v) => patch({ rotationDeg: v })}
            />

            <SliderControl
              label="Position X"
              value={settings.offsetX}
              min={-1}
              max={1}
              step={0.02}
              accent={accent}
              display={`${settings.offsetX >= 0 ? '+' : ''}${settings.offsetX.toFixed(2)}`}
              onChange={(v) => patch({ offsetX: v })}
            />

            <SliderControl
              label="Position Y"
              value={settings.offsetY}
              min={-1}
              max={1}
              step={0.02}
              accent={accent}
              display={`${settings.offsetY >= 0 ? '+' : ''}${settings.offsetY.toFixed(2)}`}
              onChange={(v) => patch({ offsetY: v })}
            />
          </div>

          {/* Bump, Roughness & Color Grading */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 pt-2 border-t border-slate-200/60 dark:border-white/[0.06]">
            <SliderControl
              label="Bump / Normal Relief"
              value={settings.bumpStrength}
              min={0}
              max={1}
              step={0.02}
              accent="#20B46A"
              display={`${Math.round(settings.bumpStrength * 100)}%`}
              onChange={(v) => patch({ bumpStrength: v })}
            />

            <SliderControl
              label="Roughness"
              value={settings.roughness}
              min={0.05}
              max={1.0}
              step={0.02}
              accent="#20B46A"
              display={`${Math.round(settings.roughness * 100)}%`}
              onChange={(v) => patch({ roughness: v })}
            />

            <SliderControl
              label="Hue Shift"
              value={settings.hueShift}
              min={-180}
              max={180}
              step={1}
              accent="#F59E0B"
              display={`${settings.hueShift >= 0 ? '+' : ''}${Math.round(settings.hueShift)}°`}
              onChange={(v) => patch({ hueShift: v })}
            />

            <SliderControl
              label="Saturation"
              value={settings.saturation}
              min={-1}
              max={1}
              step={0.02}
              accent="#F59E0B"
              display={`${settings.saturation >= 0 ? '+' : ''}${Math.round(settings.saturation * 100)}%`}
              onChange={(v) => patch({ saturation: v })}
            />

            <SliderControl
              label="Value (Brightness)"
              value={settings.value}
              min={-0.6}
              max={0.6}
              step={0.02}
              accent="#F59E0B"
              display={`${settings.value >= 0 ? '+' : ''}${Math.round(settings.value * 100)}%`}
              onChange={(v) => patch({ value: v })}
            />

            <SliderControl
              label="Contrast"
              value={settings.contrast}
              min={0.5}
              max={1.8}
              step={0.02}
              accent="#F59E0B"
              display={`${Math.round(settings.contrast * 100)}%`}
              onChange={(v) => patch({ contrast: v })}
            />

            <SliderControl
              label="Matte Diffuse (EON)"
              value={settings.diffuseRoughness ?? 0.65}
              min={0}
              max={1}
              step={0.02}
              accent="#20B46A"
              display={`${Math.round((settings.diffuseRoughness ?? 0.65) * 100)}%`}
              onChange={(v) => patch({ diffuseRoughness: v })}
            />

            <div className="col-span-2 space-y-1">
              <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                Weathering / Degrading Form
              </div>
              <div className="grid grid-cols-5 gap-1">
                {WEATHERING_PRESETS.map((wp) => {
                  const active = (settings.weathering ?? 'none') === wp.id;
                  return (
                    <button
                      key={wp.id}
                      type="button"
                      title={wp.shortDesc}
                      onClick={() => patch({ weathering: wp.id }, true)}
                      className={`flex items-center justify-center gap-1 py-1 px-1 rounded-lg text-[10px] font-bold border transition-colors ${
                        active
                          ? 'bg-[#20B46A]/18 border-[#20B46A] text-[#20B46A]'
                          : 'bg-white dark:bg-[#171A23] border-slate-200/80 dark:border-white/[0.08] text-slate-500 dark:text-slate-300'
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full border border-black/20 shrink-0"
                        style={{ backgroundColor: wp.swatch }}
                      />
                      <span className="truncate">{wp.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {(settings.weathering ?? 'none') !== 'none' && (
              <div className="col-span-2">
                <SliderControl
                  label="Weathering Intensity"
                  value={settings.weatheringIntensity ?? 0.65}
                  min={0.05}
                  max={1}
                  step={0.02}
                  accent="#20B46A"
                  display={`${Math.round((settings.weatheringIntensity ?? 0.65) * 100)}%`}
                  onChange={(v) => patch({ weatheringIntensity: v })}
                />
              </div>
            )}

            {!compact && (
              <div className="col-span-2">
                <SliderControl
                  label="Biome / Palette Tint Blend"
                  value={settings.tintStrength ?? 0.15}
                  min={0}
                  max={1}
                  step={0.02}
                  accent={accent}
                  display={
                    (settings.tintStrength ?? 0.15) < 0.02
                      ? 'Pure Texture'
                      : `${Math.round((settings.tintStrength ?? 0.15) * 100)}%`
                  }
                  onChange={(v) => patch({ tintStrength: v })}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
