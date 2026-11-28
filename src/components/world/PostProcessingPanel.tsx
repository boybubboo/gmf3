import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Droplets,
  Gauge,
  Palette,
  RotateCcw,
  Sparkles,
  Sun,
} from 'lucide-react';
import {
  COLOR_GRADING_PRESETS,
  createDefaultPostProcessingConfig,
  resolvePostProcessingConfig,
} from '../../data/postProcessingPresets';
import type { MakerStore } from '../../store/useMakerStore';
import type {
  ColorGradingPresetId,
  PostProcessingConfig,
  TerrainQualityTier,
  ViewportResolutionScale,
  ViewportShadowQuality,
} from '../../types/maker';
import { FieldLabel } from '../shared/MakerUI';

interface TogglePillProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  accent?: string;
  ariaLabel: string;
}

const ToggleSwitch: React.FC<TogglePillProps> = ({
  checked,
  onChange,
  accent = '#7C5CFF',
  ariaLabel,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    onClick={(e) => {
      e.stopPropagation();
      onChange(!checked);
    }}
    style={{ backgroundColor: checked ? accent : undefined }}
    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
      checked ? '' : 'bg-slate-300 dark:bg-[#2C3346]'
    }`}
  >
    <span
      className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
        checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
      }`}
    />
  </button>
);

interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  accent: string;
  onChange: (val: number) => void;
}

const SliderControl: React.FC<SliderControlProps> = ({
  label,
  value,
  min,
  max,
  step,
  display,
  accent,
  onChange,
}) => (
  <div className="space-y-0.5">
    <div className="flex items-center justify-between text-[11px] font-semibold">
      <span className="text-slate-600 dark:text-[#C8D0E4]">{label}</span>
      <span className="tabular-nums font-mono text-[10px] text-slate-500 dark:text-[#949BB0]">
        {display}
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

export const PostProcessingPanel: React.FC<{ store: MakerStore }> = ({ store }) => {
  const { currentProject } = store;
  const [expanded, setExpanded] = useState(true);

  if (!currentProject) return null;

  const cfg = resolvePostProcessingConfig(currentProject.postProcessing);

  const patchPost = (patch: Partial<PostProcessingConfig>, recordUndo = false) => {
    store.updateProject(
      'update global post-processing',
      (p) => ({
        ...p,
        postProcessing: {
          ...resolvePostProcessingConfig(p.postProcessing),
          ...patch,
        },
      }),
      recordUndo
    );
  };

  const applyPreset = (presetId: ColorGradingPresetId) => {
    const preset = COLOR_GRADING_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    patchPost(
      {
        enabled: true,
        colorGradingEnabled: true,
        colorGradingPreset: presetId,
        ...preset.values,
        vignetteEnabled: preset.values.vignette > 0.001,
      },
      true
    );
  };

  const handleReset = () => {
    const defaults = createDefaultPostProcessingConfig();
    patchPost({ ...defaults, enabled: cfg.enabled }, true);
  };

  const formatSignedPct = (v: number) => {
    const pct = Math.round(v * 100);
    return `${pct > 0 ? '+' : ''}${pct}%`;
  };

  const resolutionOptions: ViewportResolutionScale[] = [0.5, 0.75, 1, 1.25, 1.5];
  const shadowOptions: { id: ViewportShadowQuality; label: string }[] = [
    { id: 'off', label: 'Off' },
    { id: 'low', label: 'Low' },
    { id: 'medium', label: 'Med' },
    { id: 'high', label: 'High' },
  ];

  return (
    <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] border border-slate-200/70 dark:border-white/[0.06] space-y-3">
      {/* Live WebGPU Renderer Quality Controls */}
      <div className="space-y-2 p-2.5 rounded-xl bg-white dark:bg-[#171A23] border border-slate-200/60 dark:border-white/[0.06]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-extrabold">
            <Gauge size={13} className="text-[#20B46A]" />
            <span>Renderer Quality</span>
          </div>
          <span className="text-[10px] font-mono font-bold text-[#20B46A] tabular-nums">
            {store.viewportResolutionScale}× · {store.viewportShadowQuality.toUpperCase()}
          </span>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-[#949BB0]">
            <span>Resolution Scale</span>
            <span className="font-mono tabular-nums">{Math.round(store.viewportResolutionScale * 100)}%</span>
          </div>
          <div className="grid grid-cols-5 gap-1">
            {resolutionOptions.map((scale) => {
              const active = store.viewportResolutionScale === scale;
              return (
                <button
                  key={scale}
                  type="button"
                  onClick={() => store.setViewportResolutionScale(scale)}
                  className={`py-1 rounded-lg text-[10px] font-bold tabular-nums border transition-colors ${
                    active
                      ? 'border-[#20B46A] bg-[#20B46A]/18 text-[#16A34A] dark:text-[#20B46A]'
                      : 'border-transparent bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {scale}×
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-[#949BB0]">
            <span>Shadow Map Quality</span>
            <span className="font-mono">
              {store.viewportShadowQuality === 'off'
                ? 'Disabled'
                : store.viewportShadowQuality === 'low'
                ? '512px'
                : store.viewportShadowQuality === 'medium'
                ? '1024px'
                : '2048px'}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {shadowOptions.map((opt) => {
              const active = store.viewportShadowQuality === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => store.setViewportShadowQuality(opt.id)}
                  className={`py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                    active
                      ? 'border-[#7C5CFF] bg-[#7C5CFF]/18 text-[#7C5CFF]'
                      : 'border-transparent bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-[#949BB0]">
            <span>Terrain LOD &amp; Shader</span>
            <span className="font-mono capitalize">{store.terrainQuality}</span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {(
              [
                { id: 'performance', label: 'Performance' },
                { id: 'balanced', label: 'Balanced' },
                { id: 'ultra', label: 'Ultra' },
              ] as { id: TerrainQualityTier; label: string }[]
            ).map((opt) => {
              const active = store.terrainQuality === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => store.setTerrainQuality(opt.id)}
                  className={`py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                    active
                      ? 'border-[#EA580C] bg-[#EA580C]/18 text-[#EA580C]'
                      : 'border-transparent bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {/* Header Row */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 min-w-0 text-left group"
        >
          {expanded ? (
            <ChevronDown size={13} className="text-slate-400 shrink-0" />
          ) : (
            <ChevronRight size={13} className="text-slate-400 shrink-0" />
          )}
          <FieldLabel text="Post-Processing" />
          <span className="px-1.5 py-0.5 rounded-md bg-[#7C5CFF]/15 text-[#7C5CFF] text-[9px] font-extrabold uppercase tracking-wider shrink-0">
            Global
          </span>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          {cfg.enabled && expanded && (
            <button
              type="button"
              onClick={handleReset}
              title="Reset post-processing to defaults"
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-white/[0.06] transition-colors"
            >
              <RotateCcw size={12} />
            </button>
          )}
          <ToggleSwitch
            checked={cfg.enabled}
            onChange={(next) => {
              patchPost({ enabled: next }, true);
              if (next) setExpanded(true);
            }}
            accent="#7C5CFF"
            ariaLabel="Toggle Global Post-Processing"
          />
        </div>
      </div>

      {!cfg.enabled && expanded && (
        <p className="text-[11px] text-slate-500 dark:text-[#8E96AB] leading-snug">
          Enable bloom, optical sun lens flare, and atmospheric color grading across every level in
          your game world.
        </p>
      )}

      {cfg.enabled && expanded && (
        <div className="space-y-3 pt-1 border-t border-slate-200/70 dark:border-white/[0.06]">
          {/* 1. Bloom Section */}
          <div className="space-y-2 p-2.5 rounded-xl bg-white dark:bg-[#171A23] border border-slate-200/60 dark:border-white/[0.06]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-extrabold">
                <Sparkles size={13} className="text-[#F59E0B]" />
                <span>Bloom Glow</span>
              </div>
              <ToggleSwitch
                checked={cfg.bloomEnabled}
                onChange={(next) => patchPost({ bloomEnabled: next }, true)}
                accent="#F59E0B"
                ariaLabel="Toggle Bloom"
              />
            </div>

            {cfg.bloomEnabled && (
              <div className="space-y-2 pt-1">
                <SliderControl
                  label="Bloom Intensity"
                  value={cfg.bloomIntensity}
                  min={0}
                  max={2.2}
                  step={0.02}
                  display={`${Math.round(cfg.bloomIntensity * 100)}%`}
                  accent="#F59E0B"
                  onChange={(v) => patchPost({ bloomIntensity: v })}
                />
                <SliderControl
                  label="Threshold"
                  value={cfg.bloomThreshold}
                  min={0}
                  max={1.2}
                  step={0.02}
                  display={cfg.bloomThreshold.toFixed(2)}
                  accent="#F59E0B"
                  onChange={(v) => patchPost({ bloomThreshold: v })}
                />
                <SliderControl
                  label="Spread Radius"
                  value={cfg.bloomRadius}
                  min={0}
                  max={1.2}
                  step={0.02}
                  display={cfg.bloomRadius.toFixed(2)}
                  accent="#F59E0B"
                  onChange={(v) => patchPost({ bloomRadius: v })}
                />
              </div>
            )}
          </div>

          {/* 2. Lens Flare Section */}
          <div className="space-y-2 p-2.5 rounded-xl bg-white dark:bg-[#171A23] border border-slate-200/60 dark:border-white/[0.06]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-extrabold">
                <Sun size={13} className="text-[#38BDF8]" />
                <span>Lens Flare</span>
              </div>
              <ToggleSwitch
                checked={cfg.lensFlareEnabled}
                onChange={(next) => patchPost({ lensFlareEnabled: next }, true)}
                accent="#38BDF8"
                ariaLabel="Toggle Lens Flare"
              />
            </div>

            {cfg.lensFlareEnabled && (
              <div className="space-y-2 pt-1">
                <SliderControl
                  label="Flare Intensity"
                  value={cfg.lensFlareIntensity}
                  min={0}
                  max={2.0}
                  step={0.02}
                  display={`${Math.round(cfg.lensFlareIntensity * 100)}%`}
                  accent="#38BDF8"
                  onChange={(v) => patchPost({ lensFlareIntensity: v })}
                />
                <SliderControl
                  label="Optical Ghosts"
                  value={cfg.lensFlareGhosts}
                  min={0}
                  max={1.5}
                  step={0.02}
                  display={`${Math.round(cfg.lensFlareGhosts * 100)}%`}
                  accent="#38BDF8"
                  onChange={(v) => patchPost({ lensFlareGhosts: v })}
                />
                <SliderControl
                  label="Halo & Streaks"
                  value={cfg.lensFlareHalo}
                  min={0}
                  max={1.5}
                  step={0.02}
                  display={`${Math.round(cfg.lensFlareHalo * 100)}%`}
                  accent="#38BDF8"
                  onChange={(v) => patchPost({ lensFlareHalo: v })}
                />
              </div>
            )}
          </div>

          {/* 2b. Screen-Space Reflections (Optional, OFF by default) */}
          <div className="space-y-2 p-2.5 rounded-xl bg-white dark:bg-[#171A23] border border-slate-200/60 dark:border-white/[0.06]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-extrabold">
                <Droplets size={13} className="text-[#06B6D4]" />
                <span>Screen-Space Reflections</span>
              </div>
              <ToggleSwitch
                checked={Boolean(cfg.ssrEnabled)}
                onChange={(next) => patchPost({ ssrEnabled: next }, true)}
                accent="#06B6D4"
                ariaLabel="Toggle Screen-Space Reflections"
              />
            </div>

            {cfg.ssrEnabled && (
              <div className="space-y-2 pt-1">
                <SliderControl
                  label="Reflection Intensity"
                  value={cfg.ssrIntensity ?? 0.65}
                  min={0}
                  max={1.5}
                  step={0.02}
                  display={`${Math.round((cfg.ssrIntensity ?? 0.65) * 100)}%`}
                  accent="#06B6D4"
                  onChange={(v) => patchPost({ ssrIntensity: v })}
                />
                <SliderControl
                  label="Max Roughness"
                  value={cfg.ssrMaxRoughness ?? 0.55}
                  min={0.1}
                  max={0.9}
                  step={0.02}
                  display={(cfg.ssrMaxRoughness ?? 0.55).toFixed(2)}
                  accent="#06B6D4"
                  onChange={(v) => patchPost({ ssrMaxRoughness: v })}
                />
              </div>
            )}
          </div>

          {/* 2c. Half-Res Ambient Occlusion (GTAO) */}
          <div className="space-y-2 p-2.5 rounded-xl bg-white dark:bg-[#171A23] border border-slate-200/60 dark:border-white/[0.06]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-extrabold">
                <Sparkles size={13} className="text-[#8B5CF6]" />
                <span>Ambient Occlusion (GTAO)</span>
              </div>
              <ToggleSwitch
                checked={cfg.gtaoEnabled ?? true}
                onChange={(next) => patchPost({ gtaoEnabled: next }, true)}
                accent="#8B5CF6"
                ariaLabel="Toggle Ambient Occlusion"
              />
            </div>

            {(cfg.gtaoEnabled ?? true) && (
              <div className="space-y-2 pt-1">
                <SliderControl
                  label="Crevice Depth"
                  value={cfg.gtaoIntensity ?? 0.72}
                  min={0}
                  max={1.6}
                  step={0.02}
                  display={`${Math.round((cfg.gtaoIntensity ?? 0.72) * 100)}%`}
                  accent="#8B5CF6"
                  onChange={(v) => patchPost({ gtaoIntensity: v })}
                />
                <SliderControl
                  label="AO Radius"
                  value={cfg.gtaoRadius ?? 0.85}
                  min={0.2}
                  max={2.4}
                  step={0.05}
                  display={`${(cfg.gtaoRadius ?? 0.85).toFixed(2)}m`}
                  accent="#8B5CF6"
                  onChange={(v) => patchPost({ gtaoRadius: v })}
                />
              </div>
            )}
          </div>

          {/* 2d. Volumetric Sun Shafts & Filmic Tone Mapper */}
          <div className="space-y-2 p-2.5 rounded-xl bg-white dark:bg-[#171A23] border border-slate-200/60 dark:border-white/[0.06]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-extrabold">
                <Sun size={13} className="text-[#F59E0B]" />
                <span>Volumetric Sun Shafts</span>
              </div>
              <ToggleSwitch
                checked={cfg.godRaysEnabled ?? true}
                onChange={(next) => patchPost({ godRaysEnabled: next }, true)}
                accent="#F59E0B"
                ariaLabel="Toggle Volumetric Sun Shafts"
              />
            </div>

            {(cfg.godRaysEnabled ?? true) && (
              <div className="space-y-2 pt-1">
                <SliderControl
                  label="Shaft Intensity"
                  value={cfg.godRaysIntensity ?? 0.52}
                  min={0}
                  max={1.4}
                  step={0.02}
                  display={`${Math.round((cfg.godRaysIntensity ?? 0.52) * 100)}%`}
                  accent="#F59E0B"
                  onChange={(v) => patchPost({ godRaysIntensity: v })}
                />
                <SliderControl
                  label="Atmospheric Dust"
                  value={cfg.atmosphericDust ?? 0.5}
                  min={0}
                  max={1.0}
                  step={0.05}
                  display={`${Math.round((cfg.atmosphericDust ?? 0.5) * 100)}%`}
                  accent="#F59E0B"
                  onChange={(v) => patchPost({ atmosphericDust: v })}
                />
              </div>
            )}

            <div className="pt-2 border-t border-slate-200/60 dark:border-white/[0.06] flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-600 dark:text-[#949BB0]">
                Tone Mapper
              </span>
              <div className="inline-flex rounded-lg bg-slate-100 dark:bg-[#12151E] p-0.5">
                {(['agx', 'aces'] as const).map((tm) => {
                  const active = (cfg.toneMapping ?? 'agx') === tm;
                  return (
                    <button
                      key={tm}
                      type="button"
                      onClick={() => patchPost({ toneMapping: tm }, true)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase transition-colors ${
                        active
                          ? 'bg-[#7C5CFF] text-white'
                          : 'text-slate-600 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {tm === 'agx' ? 'AgX' : 'ACES'}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200/60 dark:border-white/[0.06] flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-600 dark:text-[#949BB0]">
                Anti-Shimmer (TRAA)
              </span>
              <ToggleSwitch
                checked={Boolean(cfg.traaEnabled)}
                onChange={(next) => patchPost({ traaEnabled: next }, true)}
                accent="#10B981"
                ariaLabel="Toggle Temporal Anti-Aliasing (TRAA)"
              />
            </div>
          </div>

          {/* 3. Color Grading Section */}
          <div className="space-y-2.5 p-2.5 rounded-xl bg-white dark:bg-[#171A23] border border-slate-200/60 dark:border-white/[0.06]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-extrabold">
                <Palette size={13} className="text-[#EC4899]" />
                <span>Color Grading</span>
              </div>
              <ToggleSwitch
                checked={cfg.colorGradingEnabled}
                onChange={(next) => patchPost({ colorGradingEnabled: next }, true)}
                accent="#EC4899"
                ariaLabel="Toggle Color Grading"
              />
            </div>

            {cfg.colorGradingEnabled && (
              <div className="space-y-2.5 pt-1">
                {/* Curated Look Presets */}
                <div className="grid grid-cols-2 gap-1.5">
                  {COLOR_GRADING_PRESETS.map((preset) => {
                    const active = cfg.colorGradingPreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        title={preset.blurb}
                        onClick={() => applyPreset(preset.id)}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-bold border text-left transition-colors ${
                          active
                            ? 'border-[#EC4899] bg-[#EC4899]/15 text-[#EC4899]'
                            : 'border-transparent bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <span
                          className="w-3 h-3 rounded-full shrink-0 border border-black/15"
                          style={{
                            background: `linear-gradient(135deg, ${preset.swatchA}, ${preset.swatchB})`,
                          }}
                        />
                        <span className="truncate">{preset.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Fine-tune Sliders */}
                <div className="space-y-2 pt-1 border-t border-slate-200/60 dark:border-white/[0.06]">
                  <SliderControl
                    label="Exposure"
                    value={cfg.exposure}
                    min={0.5}
                    max={1.8}
                    step={0.02}
                    display={`${cfg.exposure.toFixed(2)}×`}
                    accent="#EC4899"
                    onChange={(v) => patchPost({ exposure: v })}
                  />
                  <SliderControl
                    label="Contrast"
                    value={cfg.contrast}
                    min={-0.5}
                    max={0.6}
                    step={0.02}
                    display={formatSignedPct(cfg.contrast)}
                    accent="#EC4899"
                    onChange={(v) => patchPost({ contrast: v })}
                  />
                  <SliderControl
                    label="Saturation"
                    value={cfg.saturation}
                    min={-1.0}
                    max={0.8}
                    step={0.02}
                    display={formatSignedPct(cfg.saturation)}
                    accent="#EC4899"
                    onChange={(v) => patchPost({ saturation: v })}
                  />
                  <SliderControl
                    label="Temperature"
                    value={cfg.temperature}
                    min={-1.0}
                    max={1.0}
                    step={0.02}
                    display={
                      cfg.temperature > 0.02
                        ? `Warm ${Math.round(cfg.temperature * 100)}%`
                        : cfg.temperature < -0.02
                        ? `Cool ${Math.round(Math.abs(cfg.temperature) * 100)}%`
                        : 'Neutral'
                    }
                    accent={cfg.temperature >= 0 ? '#F59E0B' : '#38BDF8'}
                    onChange={(v) => patchPost({ temperature: v })}
                  />
                  <SliderControl
                    label="Tint"
                    value={cfg.tint}
                    min={-1.0}
                    max={1.0}
                    step={0.02}
                    display={
                      cfg.tint > 0.02
                        ? `Magenta ${Math.round(cfg.tint * 100)}%`
                        : cfg.tint < -0.02
                        ? `Green ${Math.round(Math.abs(cfg.tint) * 100)}%`
                        : 'Neutral'
                    }
                    accent={cfg.tint >= 0 ? '#EC4899' : '#20B46A'}
                    onChange={(v) => patchPost({ tint: v })}
                  />
                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <SliderControl
                      label="Highlights"
                      value={cfg.highlightsWarmth}
                      min={-0.5}
                      max={0.5}
                      step={0.02}
                      display={formatSignedPct(cfg.highlightsWarmth)}
                      accent="#F59E0B"
                      onChange={(v) => patchPost({ highlightsWarmth: v })}
                    />
                    <SliderControl
                      label="Shadows"
                      value={cfg.shadowsCoolness}
                      min={-0.5}
                      max={0.5}
                      step={0.02}
                      display={formatSignedPct(cfg.shadowsCoolness)}
                      accent="#6366F1"
                      onChange={(v) => patchPost({ shadowsCoolness: v })}
                    />
                  </div>
                  <SliderControl
                    label="Vignette"
                    value={cfg.vignette}
                    min={0}
                    max={1.0}
                    step={0.02}
                    display={`${Math.round(cfg.vignette * 100)}%`}
                    accent="#7C5CFF"
                    onChange={(v) => patchPost({ vignetteEnabled: v > 0.005, vignette: v })}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
