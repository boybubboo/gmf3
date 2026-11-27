import React, { useState } from 'react';
import {
  Aperture,
  ChevronDown,
  ChevronRight,
  Droplets,
  Film,
  Gauge,
  Palette,
  RotateCcw,
  Sparkles,
  Sun,
  X,
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

interface CinematicBundle {
  id: string;
  label: string;
  sub: string;
  gradient: string;
  patch: Partial<PostProcessingConfig>;
}

const CINEMATIC_BUNDLES: CinematicBundle[] = [
  {
    id: 'blockbuster',
    label: 'Blockbuster',
    sub: 'Teal/Orange + 34% Vignette',
    gradient: 'linear-gradient(135deg, #0EA5E9 0%, #1E293B 48%, #F97316 100%)',
    patch: {
      enabled: true,
      bloomEnabled: true,
      bloomIntensity: 0.56,
      bloomThreshold: 0.7,
      bloomRadius: 0.58,
      lensFlareEnabled: true,
      lensFlareIntensity: 0.65,
      colorGradingEnabled: true,
      colorGradingPreset: 'cinematicTealOrange',
      exposure: 1.02,
      contrast: 0.18,
      saturation: 0.08,
      temperature: 0.12,
      tint: -0.05,
      highlightsWarmth: 0.32,
      shadowsCoolness: 0.34,
      vignetteEnabled: true,
      vignette: 0.34,
      vignetteSoftness: 0.52,
    },
  },
  {
    id: 'goldenDream',
    label: 'Golden Dream',
    sub: 'Warm Glow + Soft Halo',
    gradient: 'linear-gradient(135deg, #FBBF24 0%, #EA580C 60%, #7C2D12 100%)',
    patch: {
      enabled: true,
      bloomEnabled: true,
      bloomIntensity: 0.78,
      bloomThreshold: 0.62,
      bloomRadius: 0.72,
      lensFlareEnabled: true,
      lensFlareIntensity: 0.85,
      colorGradingEnabled: true,
      colorGradingPreset: 'goldenHour',
      exposure: 1.06,
      contrast: 0.1,
      saturation: 0.14,
      temperature: 0.36,
      tint: 0.06,
      highlightsWarmth: 0.28,
      shadowsCoolness: 0.08,
      vignetteEnabled: true,
      vignette: 0.24,
      vignetteSoftness: 0.65,
    },
  },
  {
    id: 'silverNoir',
    label: 'Silver Noir',
    sub: 'B&W + Dramatic Frame',
    gradient: 'linear-gradient(135deg, #F8FAFC 0%, #52525B 55%, #09090B 100%)',
    patch: {
      enabled: true,
      bloomEnabled: true,
      bloomIntensity: 0.35,
      bloomThreshold: 0.78,
      bloomRadius: 0.48,
      lensFlareEnabled: false,
      colorGradingEnabled: true,
      colorGradingPreset: 'noirMono',
      exposure: 1.02,
      contrast: 0.34,
      saturation: -1.0,
      temperature: -0.05,
      tint: 0.0,
      highlightsWarmth: 0.04,
      shadowsCoolness: 0.08,
      vignetteEnabled: true,
      vignette: 0.56,
      vignetteSoftness: 0.44,
    },
  },
  {
    id: 'studioClean',
    label: 'Studio Clean',
    sub: 'Crisp Natural + Light Bloom',
    gradient: 'linear-gradient(135deg, #38BDF8 0%, #94A3B8 55%, #E2E8F0 100%)',
    patch: {
      enabled: true,
      bloomEnabled: true,
      bloomIntensity: 0.28,
      bloomThreshold: 0.84,
      bloomRadius: 0.45,
      lensFlareEnabled: true,
      lensFlareIntensity: 0.35,
      colorGradingEnabled: true,
      colorGradingPreset: 'neutral',
      exposure: 1.0,
      contrast: 0.04,
      saturation: 0.02,
      temperature: 0.0,
      tint: 0.0,
      highlightsWarmth: 0.0,
      shadowsCoolness: 0.0,
      vignetteEnabled: false,
      vignette: 0.0,
      vignetteSoftness: 0.6,
    },
  },
];

const BLOOM_QUICK_PRESETS: {
  label: string;
  intensity: number;
  threshold: number;
  radius: number;
}[] = [
  { label: 'Subtle', intensity: 0.3, threshold: 0.82, radius: 0.45 },
  { label: 'Cinema', intensity: 0.6, threshold: 0.68, radius: 0.6 },
  { label: 'Dreamy', intensity: 1.05, threshold: 0.52, radius: 0.85 },
];

const VIGNETTE_QUICK_PRESETS: { label: string; value: number; softness: number }[] = [
  { label: 'Off', value: 0, softness: 0.55 },
  { label: 'Subtle', value: 0.22, softness: 0.65 },
  { label: 'Cinema', value: 0.42, softness: 0.52 },
  { label: 'Dramatic', value: 0.68, softness: 0.38 },
];

export function getActivePostFxLabel(cfg?: PostProcessingConfig | null): string | null {
  if (!cfg?.enabled) return null;
  if (cfg.colorGradingEnabled) {
    const preset = COLOR_GRADING_PRESETS.find((p) => p.id === cfg.colorGradingPreset);
    if (preset) return preset.label;
  }
  if (cfg.bloomEnabled) return 'Bloom';
  if ((cfg.vignetteEnabled ?? true) && cfg.vignette > 0.01) return 'Vignette';
  return 'On';
}

const SwitchToggle: React.FC<{
  checked: boolean;
  onChange: (next: boolean) => void;
  accent: string;
  ariaLabel: string;
}> = ({ checked, onChange, accent, ariaLabel }) => (
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

const EffectSlider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  accent: string;
  onChange: (v: number) => void;
}> = ({ label, value, min, max, step, display, accent, onChange }) => (
  <div className="space-y-1">
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

export const PostProcessingMenuModal: React.FC<{
  store: MakerStore;
  onClose: () => void;
}> = ({ store, onClose }) => {
  const { currentProject } = store;
  const [showFineTune, setShowFineTune] = useState(false);
  const [showLensFlare, setShowLensFlare] = useState(false);

  if (!currentProject) return null;

  const cfg = resolvePostProcessingConfig(currentProject.postProcessing);
  const vignetteEnabled = cfg.vignetteEnabled ?? cfg.vignette > 0.001;
  const vignetteSoftness = cfg.vignetteSoftness ?? 0.55;

  const patchPost = (
    patch: Partial<PostProcessingConfig>,
    opts?: { recordUndo?: boolean; autoEnable?: boolean }
  ) => {
    const autoEnable = opts?.autoEnable ?? true;
    store.updateProject(
      'update post-processing effects',
      (p) => ({
        ...p,
        postProcessing: {
          ...resolvePostProcessingConfig(p.postProcessing),
          ...(autoEnable ? { enabled: true } : {}),
          ...patch,
        },
      }),
      opts?.recordUndo ?? false
    );
  };

  const applyFilterPreset = (presetId: ColorGradingPresetId) => {
    const preset = COLOR_GRADING_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    patchPost(
      {
        enabled: true,
        colorGradingEnabled: true,
        colorGradingPreset: presetId,
        exposure: preset.values.exposure,
        contrast: preset.values.contrast,
        saturation: preset.values.saturation,
        temperature: preset.values.temperature,
        tint: preset.values.tint,
        highlightsWarmth: preset.values.highlightsWarmth,
        shadowsCoolness: preset.values.shadowsCoolness,
        vignette: preset.values.vignette,
        vignetteEnabled: preset.values.vignette > 0.001,
      },
      { recordUndo: true }
    );
  };

  const handleReset = () => {
    const defaults = createDefaultPostProcessingConfig();
    patchPost(
      { ...defaults, enabled: cfg.enabled },
      { recordUndo: true, autoEnable: false }
    );
  };

  const formatSignedPct = (v: number) => {
    const pct = Math.round(v * 100);
    return `${pct > 0 ? '+' : ''}${pct}%`;
  };

  return (
    <aside
      aria-label="Post-Processing Effects Menu"
      className="fixed top-16 right-4 bottom-4 w-[368px] max-w-[calc(100vw-2rem)] z-40 flex flex-col rounded-2xl bg-white dark:bg-[#151822] border border-slate-200 dark:border-white/[0.12] shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200/80 dark:border-white/[0.08]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#EC4899]/15 text-[#EC4899] flex items-center justify-center shrink-0">
            <Film size={16} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold leading-tight truncate">
              Post-Processing FX
            </h2>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-[#949BB0] truncate">
              {cfg.enabled
                ? `${getActivePostFxLabel(cfg) ?? 'Active'} · Live Cinema Pipeline`
                : 'Bypassed · Toggle on or pick a look'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <SwitchToggle
            checked={cfg.enabled}
            onChange={(next) =>
              patchPost({ enabled: next }, { recordUndo: true, autoEnable: false })
            }
            accent="#EC4899"
            ariaLabel="Toggle Post-Processing Effects"
          />
          <button
            type="button"
            onClick={handleReset}
            title="Reset effects to defaults"
            className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#C5CCE0] hover:text-slate-900 dark:hover:text-white flex items-center justify-center"
          >
            <RotateCcw size={13} />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close Post-Processing Effects"
            className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-slate-500 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white flex items-center justify-center"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto maker-scroll p-4 space-y-4">
        {/* One-Click Cinematic Looks */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB]">
              Cinematic Looks
            </span>
            <span className="text-[10px] font-semibold text-slate-400 dark:text-[#6B7285]">
              All levels
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {CINEMATIC_BUNDLES.map((bundle) => {
              const active =
                cfg.enabled &&
                cfg.colorGradingEnabled &&
                cfg.colorGradingPreset === bundle.patch.colorGradingPreset;
              return (
                <button
                  key={bundle.id}
                  type="button"
                  onClick={() => patchPost(bundle.patch, { recordUndo: true })}
                  className={`group flex flex-col justify-end p-2.5 h-16 rounded-xl border text-left relative overflow-hidden transition-transform active:scale-[0.98] ${
                    active
                      ? 'border-[#EC4899] ring-1 ring-[#EC4899]/50'
                      : 'border-slate-200/70 dark:border-white/[0.1] hover:border-slate-400 dark:hover:border-white/25'
                  }`}
                  style={{ background: bundle.gradient }}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                  <span className="relative text-xs font-extrabold text-white leading-tight">
                    {bundle.label}
                  </span>
                  <span className="relative text-[10px] font-medium text-white/80 truncate">
                    {bundle.sub}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 1. Bloom Glow Controls */}
        <section className="p-3 rounded-2xl bg-slate-50 dark:bg-[#1C212E] border border-slate-200/70 dark:border-white/[0.06] space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-extrabold">
              <Sparkles size={14} className="text-[#F59E0B]" />
              <span>Bloom Glow</span>
            </div>
            <SwitchToggle
              checked={cfg.enabled && cfg.bloomEnabled}
              onChange={(next) =>
                patchPost(
                  { bloomEnabled: next },
                  { recordUndo: true, autoEnable: next }
                )
              }
              accent="#F59E0B"
              ariaLabel="Toggle Bloom Glow"
            />
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {BLOOM_QUICK_PRESETS.map((bp) => {
              const active =
                cfg.enabled &&
                cfg.bloomEnabled &&
                Math.abs(cfg.bloomIntensity - bp.intensity) < 0.08;
              return (
                <button
                  key={bp.label}
                  type="button"
                  onClick={() =>
                    patchPost(
                      {
                        bloomEnabled: true,
                        bloomIntensity: bp.intensity,
                        bloomThreshold: bp.threshold,
                        bloomRadius: bp.radius,
                      },
                      { recordUndo: true }
                    )
                  }
                  className={`py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                    active
                      ? 'bg-[#F59E0B] text-white border-[#F59E0B]'
                      : 'bg-white dark:bg-[#151822] border-slate-200/70 dark:border-white/[0.07] text-slate-600 dark:text-[#A8B1C6] hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {bp.label}
                </button>
              );
            })}
          </div>

          <div className="space-y-2 pt-0.5">
            <EffectSlider
              label="Bloom Intensity"
              value={cfg.bloomIntensity}
              min={0}
              max={2.2}
              step={0.02}
              display={`${Math.round(cfg.bloomIntensity * 100)}%`}
              accent="#F59E0B"
              onChange={(v) => patchPost({ bloomEnabled: true, bloomIntensity: v })}
            />
            <EffectSlider
              label="Highlight Threshold"
              value={cfg.bloomThreshold}
              min={0}
              max={1.2}
              step={0.02}
              display={cfg.bloomThreshold.toFixed(2)}
              accent="#F59E0B"
              onChange={(v) => patchPost({ bloomEnabled: true, bloomThreshold: v })}
            />
            <EffectSlider
              label="Glow Radius"
              value={cfg.bloomRadius}
              min={0}
              max={1.2}
              step={0.02}
              display={cfg.bloomRadius.toFixed(2)}
              accent="#F59E0B"
              onChange={(v) => patchPost({ bloomEnabled: true, bloomRadius: v })}
            />
          </div>
        </section>

        {/* 2. Color Grading Filters */}
        <section className="p-3 rounded-2xl bg-slate-50 dark:bg-[#1C212E] border border-slate-200/70 dark:border-white/[0.06] space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-extrabold">
              <Palette size={14} className="text-[#EC4899]" />
              <span>Color Grading Filters</span>
            </div>
            <SwitchToggle
              checked={cfg.enabled && cfg.colorGradingEnabled}
              onChange={(next) =>
                patchPost(
                  { colorGradingEnabled: next },
                  { recordUndo: true, autoEnable: next }
                )
              }
              accent="#EC4899"
              ariaLabel="Toggle Color Grading Filters"
            />
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {COLOR_GRADING_PRESETS.map((preset) => {
              const active =
                cfg.enabled &&
                cfg.colorGradingEnabled &&
                cfg.colorGradingPreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  title={preset.blurb}
                  onClick={() => applyFilterPreset(preset.id)}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border text-left transition-colors ${
                    active
                      ? 'border-[#EC4899] bg-[#EC4899]/14 text-[#DB2777] dark:text-[#F472B6]'
                      : 'border-transparent bg-white dark:bg-[#151822] text-slate-700 dark:text-[#B8C0D4] hover:border-slate-300 dark:hover:border-white/15'
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full shrink-0 border border-black/20"
                    style={{
                      background: `linear-gradient(135deg, ${preset.swatchA}, ${preset.swatchB})`,
                    }}
                  />
                  <span className="text-[11px] font-bold truncate">{preset.label}</span>
                </button>
              );
            })}
          </div>

          {/* Expandable Fine-Tune Color Sliders */}
          <div className="pt-1 border-t border-slate-200/70 dark:border-white/[0.06]">
            <button
              type="button"
              onClick={() => setShowFineTune((v) => !v)}
              className="w-full flex items-center justify-between py-1 text-[11px] font-bold text-slate-600 dark:text-[#A8B1C6] hover:text-slate-900 dark:hover:text-white"
            >
              <span>Fine-Tune Color Balance</span>
              {showFineTune ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </button>

            {showFineTune && (
              <div className="space-y-2 pt-2">
                <EffectSlider
                  label="Exposure"
                  value={cfg.exposure}
                  min={0.5}
                  max={1.8}
                  step={0.02}
                  display={`${cfg.exposure.toFixed(2)}×`}
                  accent="#EC4899"
                  onChange={(v) => patchPost({ colorGradingEnabled: true, exposure: v })}
                />
                <EffectSlider
                  label="Contrast"
                  value={cfg.contrast}
                  min={-0.5}
                  max={0.6}
                  step={0.02}
                  display={formatSignedPct(cfg.contrast)}
                  accent="#EC4899"
                  onChange={(v) => patchPost({ colorGradingEnabled: true, contrast: v })}
                />
                <EffectSlider
                  label="Saturation"
                  value={cfg.saturation}
                  min={-1.0}
                  max={0.8}
                  step={0.02}
                  display={formatSignedPct(cfg.saturation)}
                  accent="#EC4899"
                  onChange={(v) => patchPost({ colorGradingEnabled: true, saturation: v })}
                />
                <EffectSlider
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
                  onChange={(v) => patchPost({ colorGradingEnabled: true, temperature: v })}
                />
                <EffectSlider
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
                  onChange={(v) => patchPost({ colorGradingEnabled: true, tint: v })}
                />
                <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                  <EffectSlider
                    label="Highlights"
                    value={cfg.highlightsWarmth}
                    min={-0.5}
                    max={0.5}
                    step={0.02}
                    display={formatSignedPct(cfg.highlightsWarmth)}
                    accent="#F59E0B"
                    onChange={(v) =>
                      patchPost({ colorGradingEnabled: true, highlightsWarmth: v })
                    }
                  />
                  <EffectSlider
                    label="Shadows"
                    value={cfg.shadowsCoolness}
                    min={-0.5}
                    max={0.5}
                    step={0.02}
                    display={formatSignedPct(cfg.shadowsCoolness)}
                    accent="#6366F1"
                    onChange={(v) =>
                      patchPost({ colorGradingEnabled: true, shadowsCoolness: v })
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 3. Cinematic Vignette Controls */}
        <section className="p-3 rounded-2xl bg-slate-50 dark:bg-[#1C212E] border border-slate-200/70 dark:border-white/[0.06] space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-extrabold">
              <Aperture size={14} className="text-[#7C5CFF]" />
              <span>Cinematic Vignette</span>
            </div>
            <SwitchToggle
              checked={cfg.enabled && vignetteEnabled}
              onChange={(next) =>
                patchPost(
                  {
                    vignetteEnabled: next,
                    vignette: next && cfg.vignette < 0.05 ? 0.32 : cfg.vignette,
                  },
                  { recordUndo: true, autoEnable: next }
                )
              }
              accent="#7C5CFF"
              ariaLabel="Toggle Cinematic Vignette"
            />
          </div>

          {/* Live Vignette Frame Preview */}
          <div className="h-12 rounded-xl overflow-hidden border border-slate-200/70 dark:border-white/[0.08] relative bg-gradient-to-br from-[#38BDF8]/35 via-[#20B46A]/25 to-[#F59E0B]/30">
            <div
              className="absolute inset-0 transition-opacity"
              style={{
                opacity: cfg.enabled && vignetteEnabled ? 1 : 0.15,
                background: `radial-gradient(ellipse at center, transparent ${Math.round(
                  (1 - vignetteSoftness * 0.55) * 58
                )}%, rgba(8, 10, 18, ${(cfg.vignette * 0.92).toFixed(2)}) 100%)`,
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-extrabold tracking-wide uppercase text-slate-900/75 dark:text-white/85 tabular-nums">
              {cfg.enabled && vignetteEnabled && cfg.vignette > 0.005
                ? `Frame Darkening · ${Math.round(cfg.vignette * 100)}%`
                : 'Vignette Off'}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {VIGNETTE_QUICK_PRESETS.map((vp) => {
              const active =
                vp.value === 0
                  ? !vignetteEnabled || cfg.vignette < 0.02
                  : cfg.enabled &&
                    vignetteEnabled &&
                    Math.abs(cfg.vignette - vp.value) < 0.06;
              return (
                <button
                  key={vp.label}
                  type="button"
                  onClick={() =>
                    patchPost(
                      {
                        vignetteEnabled: vp.value > 0,
                        vignette: vp.value,
                        vignetteSoftness: vp.softness,
                      },
                      { recordUndo: true, autoEnable: vp.value > 0 }
                    )
                  }
                  className={`py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                    active
                      ? 'bg-[#7C5CFF] text-white border-[#7C5CFF]'
                      : 'bg-white dark:bg-[#151822] border-slate-200/70 dark:border-white/[0.07] text-slate-600 dark:text-[#A8B1C6] hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {vp.label}
                </button>
              );
            })}
          </div>

          <div className="space-y-2 pt-0.5">
            <EffectSlider
              label="Vignette Intensity"
              value={cfg.vignette}
              min={0}
              max={1.0}
              step={0.02}
              display={`${Math.round(cfg.vignette * 100)}%`}
              accent="#7C5CFF"
              onChange={(v) =>
                patchPost({
                  vignetteEnabled: v > 0.005,
                  vignette: v,
                })
              }
            />
            <EffectSlider
              label="Edge Feathering"
              value={vignetteSoftness}
              min={0.1}
              max={1.0}
              step={0.02}
              display={`${Math.round(vignetteSoftness * 100)}%`}
              accent="#7C5CFF"
              onChange={(v) =>
                patchPost({
                  vignetteEnabled: true,
                  vignetteSoftness: v,
                })
              }
            />
          </div>
        </section>

        {/* 4. Optional Optical Sun Lens Flare (Collapsible) */}
        <section className="p-3 rounded-2xl bg-slate-50 dark:bg-[#1C212E] border border-slate-200/70 dark:border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowLensFlare((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-extrabold text-left"
            >
              {showLensFlare ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <Sun size={13} className="text-[#38BDF8]" />
              <span>Optical Lens Flare</span>
            </button>
            <SwitchToggle
              checked={cfg.enabled && cfg.lensFlareEnabled}
              onChange={(next) =>
                patchPost(
                  { lensFlareEnabled: next },
                  { recordUndo: true, autoEnable: next }
                )
              }
              accent="#38BDF8"
              ariaLabel="Toggle Optical Lens Flare"
            />
          </div>

          {showLensFlare && (
            <div className="space-y-2 pt-1 border-t border-slate-200/70 dark:border-white/[0.06]">
              <EffectSlider
                label="Flare Intensity"
                value={cfg.lensFlareIntensity}
                min={0}
                max={2.0}
                step={0.02}
                display={`${Math.round(cfg.lensFlareIntensity * 100)}%`}
                accent="#38BDF8"
                onChange={(v) =>
                  patchPost({ lensFlareEnabled: true, lensFlareIntensity: v })
                }
              />
              <EffectSlider
                label="Optical Ghosts"
                value={cfg.lensFlareGhosts}
                min={0}
                max={1.5}
                step={0.02}
                display={`${Math.round(cfg.lensFlareGhosts * 100)}%`}
                accent="#38BDF8"
                onChange={(v) =>
                  patchPost({ lensFlareEnabled: true, lensFlareGhosts: v })
                }
              />
              <EffectSlider
                label="Halo & Streaks"
                value={cfg.lensFlareHalo}
                min={0}
                max={1.5}
                step={0.02}
                display={`${Math.round(cfg.lensFlareHalo * 100)}%`}
                accent="#38BDF8"
                onChange={(v) =>
                  patchPost({ lensFlareEnabled: true, lensFlareHalo: v })
                }
              />
            </div>
          )}
        </section>

        {/* 4b. Screen-Space Reflections (Optional, OFF by default) */}
        <section className="p-3 rounded-2xl bg-slate-50 dark:bg-[#1C212E] border border-slate-200/70 dark:border-white/[0.06] space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-extrabold">
              <Droplets size={14} className="text-[#06B6D4]" />
              <span>Screen-Space Reflections</span>
            </div>
            <SwitchToggle
              checked={cfg.enabled && Boolean(cfg.ssrEnabled)}
              onChange={(next) =>
                patchPost({ ssrEnabled: next }, { recordUndo: true, autoEnable: next })
              }
              accent="#06B6D4"
              ariaLabel="Toggle Screen-Space Reflections"
            />
          </div>

          {cfg.ssrEnabled && (
            <div className="space-y-2 pt-0.5">
              <EffectSlider
                label="Reflection Intensity"
                value={cfg.ssrIntensity ?? 0.65}
                min={0}
                max={1.5}
                step={0.02}
                display={`${Math.round((cfg.ssrIntensity ?? 0.65) * 100)}%`}
                accent="#06B6D4"
                onChange={(v) => patchPost({ ssrEnabled: true, ssrIntensity: v })}
              />
              <EffectSlider
                label="Max Roughness"
                value={cfg.ssrMaxRoughness ?? 0.55}
                min={0.1}
                max={0.9}
                step={0.02}
                display={(cfg.ssrMaxRoughness ?? 0.55).toFixed(2)}
                accent="#06B6D4"
                onChange={(v) => patchPost({ ssrEnabled: true, ssrMaxRoughness: v })}
              />
            </div>
          )}
        </section>

        {/* 5. Live Renderer Quality */}
        <section className="p-3 rounded-2xl bg-slate-50 dark:bg-[#1C212E] border border-slate-200/70 dark:border-white/[0.06] space-y-2.5">
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
              <span className="font-mono tabular-nums">
                {Math.round(store.viewportResolutionScale * 100)}%
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {([0.5, 0.75, 1, 1.25, 1.5] as ViewportResolutionScale[]).map((scale) => {
                const active = store.viewportResolutionScale === scale;
                return (
                  <button
                    key={scale}
                    type="button"
                    onClick={() => store.setViewportResolutionScale(scale)}
                    className={`py-1 rounded-lg text-[10px] font-bold tabular-nums border transition-colors ${
                      active
                        ? 'bg-[#20B46A] text-white border-[#20B46A]'
                        : 'bg-white dark:bg-[#151822] border-slate-200/70 dark:border-white/[0.07] text-slate-600 dark:text-[#A8B1C6] hover:text-slate-900 dark:hover:text-white'
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
              {(
                [
                  { id: 'off', label: 'Off' },
                  { id: 'low', label: 'Low' },
                  { id: 'medium', label: 'Med' },
                  { id: 'high', label: 'High' },
                ] as { id: ViewportShadowQuality; label: string }[]
              ).map((opt) => {
                const active = store.viewportShadowQuality === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => store.setViewportShadowQuality(opt.id)}
                    className={`py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                      active
                        ? 'bg-[#7C5CFF] text-white border-[#7C5CFF]'
                        : 'bg-white dark:bg-[#151822] border-slate-200/70 dark:border-white/[0.07] text-slate-600 dark:text-[#A8B1C6] hover:text-slate-900 dark:hover:text-white'
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
                        ? 'bg-[#EA580C] text-white border-[#EA580C]'
                        : 'bg-white dark:bg-[#151822] border-slate-200/70 dark:border-white/[0.07] text-slate-600 dark:text-[#A8B1C6] hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 py-2.5 bg-slate-50 dark:bg-[#11141D] border-t border-slate-200/80 dark:border-white/[0.08] text-[11px] font-semibold text-slate-500 dark:text-[#8E96AB]">
        Applies live across both World editing and Play Mode
      </div>
    </aside>
  );
};
