import React, { useState } from 'react';
import { BookmarkPlus, Box, Check, Power, RotateCcw, Sparkles, Zap } from 'lucide-react';
import {
  createDefaultFxEmitterConfig,
  FX_CATEGORY_LABELS,
  FX_EMITTER_PRESETS,
  getFxPresetMeta,
} from '../../data/fxEmitterPresets';
import type { MakerStore } from '../../store/useMakerStore';
import type {
  BirdFlightMode,
  BirdFlightPattern,
  FxEmitterCategory,
  FxEmitterConfig,
  FxEmitterPresetId,
  LevelEntity,
} from '../../types/maker';

interface FxEmitterInspectorProps {
  entity: LevelEntity;
  store: MakerStore;
  onTriggerBurst: (entityId: string) => void;
  onSaveToLibrary?: (entity: LevelEntity) => void;
}

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  decimals?: number;
  onChange: (v: number) => void;
}

const SliderRow: React.FC<SliderRowProps> = ({
  label,
  value,
  min,
  max,
  step,
  unit = '',
  decimals = 2,
  onChange,
}) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between text-[11px] font-semibold">
      <span className="text-slate-700 dark:text-[#C8D0E4]">{label}</span>
      <span className="font-mono tabular-nums text-slate-500 dark:text-[#949BB0]">
        {decimals === 0 ? Math.round(value) : value.toFixed(decimals)}
        {unit}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-[#7C5CFF]"
    />
  </div>
);

const CATEGORY_ORDER: FxEmitterCategory[] = [
  'classic',
  'customMesh',
  'burstArc',
  'weather',
  'critter',
  'arcane',
];

export const FxEmitterInspector: React.FC<FxEmitterInspectorProps> = ({
  entity,
  store,
  onTriggerBurst,
  onSaveToLibrary,
}) => {
  const [savedFlash, setSavedFlash] = useState(false);

  if (entity.kind !== 'fxEmitter') return null;

  const cfg: FxEmitterConfig = entity.fxEmitter ?? createDefaultFxEmitterConfig('fire');
  const presetMeta = getFxPresetMeta(cfg.preset);
  const category = presetMeta.category;

  const patchFx = (patch: Partial<FxEmitterConfig>, recordUndo = false) => {
    store.updateEntity(
      entity.id,
      'edit fx emitter',
      (ent) => ({
        ...ent,
        fxEmitter: {
          ...(ent.fxEmitter ?? createDefaultFxEmitterConfig('fire')),
          ...patch,
        },
      }),
      recordUndo
    );
  };

  const applyPreset = (presetId: FxEmitterPresetId) => {
    const nextDefaults = createDefaultFxEmitterConfig(presetId);
    const meta = getFxPresetMeta(presetId);
    store.updateEntity(
      entity.id,
      `set fx preset ${meta.name}`,
      (ent) => ({
        ...ent,
        fxEmitter: {
          ...nextDefaults,
          enabled: cfg.enabled,
          // Preserve chosen custom mesh if staying on fallingLeaves
          customMeshAssetId:
            presetId === 'fallingLeaves' ? cfg.customMeshAssetId : undefined,
        },
      }),
      true
    );
  };

  const isClassic = category === 'classic';
  const isCustomMesh = category === 'customMesh';
  const isWaterSplash = cfg.preset === 'waterSplash';
  const isLightning = cfg.preset === 'lightning';
  const isWeather = category === 'weather';
  const isCritter = category === 'critter';
  const isArcane = category === 'arcane';

  return (
    <div className="space-y-3.5 pt-3 border-t border-slate-200/70 dark:border-white/[0.08]">
      {/* Header Controls: Enabled Toggle + Preview/Burst + Reset */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900 dark:text-white">
          <Sparkles size={13} style={{ color: presetMeta.accentHex }} />
          <span>FX Emitter</span>
        </div>
        <button
          type="button"
          onClick={() => patchFx({ enabled: !cfg.enabled }, true)}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition-colors whitespace-nowrap ${
            cfg.enabled
              ? 'bg-[#20B46A] text-white'
              : 'bg-slate-200 dark:bg-[#1F2430] text-slate-600 dark:text-[#949BB0]'
          }`}
        >
          <Power size={11} />
          <span>{cfg.enabled ? 'Enabled' : 'Paused'}</span>
        </button>
      </div>

      {/* Preview / Burst Action Row */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            if (!cfg.enabled) patchFx({ enabled: true }, false);
            onTriggerBurst(entity.id);
          }}
          className="flex-1 py-1.5 px-3 rounded-lg bg-[#7C5CFF] hover:bg-[#6A48F5] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors"
        >
          <Zap size={12} />
          <span>
            {isWaterSplash
              ? 'Trigger Splash Burst'
              : isLightning
              ? 'Strike Bolt Now'
              : isArcane
              ? 'Cast / Trigger Surge'
              : 'Preview / Burst'}
          </span>
        </button>
        {onSaveToLibrary && (
          <button
            type="button"
            onClick={() => {
              onSaveToLibrary(entity);
              setSavedFlash(true);
              window.setTimeout(() => setSavedFlash(false), 1600);
            }}
            title="Save this FX configuration to your draggable FX Library"
            className={`p-1.5 rounded-lg transition-colors ${
              savedFlash
                ? 'bg-[#20B46A] text-white'
                : 'bg-slate-100 dark:bg-[#1F2430] hover:bg-[#7C5CFF]/15 hover:text-[#7C5CFF] text-slate-600 dark:text-[#C8D0E4]'
            }`}
          >
            {savedFlash ? <Check size={13} /> : <BookmarkPlus size={13} />}
          </button>
        )}
        <button
          type="button"
          onClick={() => applyPreset(cfg.preset)}
          title="Reset parameters to preset defaults"
          className="p-1.5 rounded-lg bg-slate-100 dark:bg-[#1F2430] hover:bg-slate-200 dark:hover:bg-[#2A3142] text-slate-600 dark:text-[#C8D0E4]"
        >
          <RotateCcw size={13} />
        </button>
      </div>

      {/* Grouped Preset Selector */}
      <div className="space-y-1.5">
        <label className="block text-[11px] font-bold text-slate-500 dark:text-[#949BB0]">
          Effect Preset
        </label>
        <select
          value={cfg.preset}
          onChange={(e) => applyPreset(e.target.value as FxEmitterPresetId)}
          className="w-full px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.08] text-xs font-bold"
        >
          {CATEGORY_ORDER.map((cat) => (
            <optgroup key={cat} label={FX_CATEGORY_LABELS[cat]}>
              {FX_EMITTER_PRESETS.filter((p) => p.category === cat).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <p className="text-[11px] text-slate-500 dark:text-[#8E96AB] leading-snug">
          {presetMeta.summary}
        </p>
      </div>

      {/* Placement Height & Performance Cap */}
      <div className="space-y-2.5 pt-2.5 border-t border-slate-200/60 dark:border-white/[0.06]">
        <SliderRow
          label={cfg.preset === 'birds' ? 'Cruise Altitude (Y)' : 'Emitter Height (Y)'}
          value={cfg.elevationY}
          min={0}
          max={cfg.preset === 'birds' ? 24 : 12}
          step={0.1}
          unit="m"
          decimals={1}
          onChange={(v) => patchFx({ elevationY: v })}
        />
        {!isLightning && !isArcane && (
          <SliderRow
            label={isCritter ? 'Max Swarm Cap' : 'Max Particles Cap'}
            value={cfg.maxParticles}
            min={isCritter ? 4 : 10}
            max={isCritter ? 80 : 240}
            step={2}
            decimals={0}
            onChange={(v) => patchFx({ maxParticles: v })}
          />
        )}
      </div>

      {/* A. CLASSIC PARTICLES CONTROLS */}
      {isClassic && (
        <div className="space-y-2.5 pt-2.5 border-t border-slate-200/60 dark:border-white/[0.06]">
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-[11px] font-semibold">
              <span className="text-slate-600 dark:text-[#A5AEC4]">Start Color</span>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.08]">
                <input
                  type="color"
                  value={cfg.startColor}
                  onChange={(e) => patchFx({ startColor: e.target.value })}
                  className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                />
                <span className="font-mono text-[10px] uppercase">{cfg.startColor}</span>
              </div>
            </label>
            <label className="space-y-1 text-[11px] font-semibold">
              <span className="text-slate-600 dark:text-[#A5AEC4]">End Color</span>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.08]">
                <input
                  type="color"
                  value={cfg.endColor}
                  onChange={(e) => patchFx({ endColor: e.target.value })}
                  className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                />
                <span className="font-mono text-[10px] uppercase">{cfg.endColor}</span>
              </div>
            </label>
          </div>

          <SliderRow
            label="Spawn Rate"
            value={cfg.spawnRate}
            min={1}
            max={90}
            step={1}
            unit="/s"
            decimals={0}
            onChange={(v) => patchFx({ spawnRate: v })}
          />
          <SliderRow
            label="Lifetime"
            value={cfg.lifetime}
            min={0.2}
            max={6.0}
            step={0.1}
            unit="s"
            decimals={1}
            onChange={(v) => patchFx({ lifetime: v })}
          />
          <SliderRow
            label="Start Size"
            value={cfg.startSize}
            min={0.05}
            max={3.0}
            step={0.05}
            unit="m"
            onChange={(v) => patchFx({ startSize: v })}
          />
          <SliderRow
            label="End Size"
            value={cfg.endSize}
            min={0.02}
            max={4.0}
            step={0.05}
            unit="m"
            onChange={(v) => patchFx({ endSize: v })}
          />
          <SliderRow
            label="Emissive Glow"
            value={cfg.emissiveIntensity}
            min={0}
            max={3.5}
            step={0.1}
            decimals={1}
            onChange={(v) => patchFx({ emissiveIntensity: v })}
          />
          <SliderRow
            label="Speed"
            value={cfg.speed}
            min={0.1}
            max={12}
            step={0.1}
            unit="m/s"
            decimals={1}
            onChange={(v) => patchFx({ speed: v })}
          />
          <SliderRow
            label="Direction Spread"
            value={cfg.spreadAngle}
            min={2}
            max={180}
            step={2}
            unit="°"
            decimals={0}
            onChange={(v) => patchFx({ spreadAngle: v })}
          />
          <SliderRow
            label="Gravity / Buoyancy"
            value={cfg.gravity}
            min={-14}
            max={6}
            step={0.1}
            decimals={1}
            onChange={(v) => patchFx({ gravity: v })}
          />
          <SliderRow
            label="Turbulence / Swirl"
            value={cfg.turbulence}
            min={0}
            max={3.5}
            step={0.05}
            onChange={(v) => patchFx({ turbulence: v })}
          />
          <SliderRow
            label="Fade-In Fraction"
            value={cfg.fadeIn}
            min={0.02}
            max={0.48}
            step={0.02}
            onChange={(v) => patchFx({ fadeIn: v })}
          />
          <SliderRow
            label="Fade-Out Fraction"
            value={cfg.fadeOut}
            min={0.05}
            max={0.8}
            step={0.05}
            onChange={(v) => patchFx({ fadeOut: v })}
          />
        </div>
      )}

      {/* B. CUSTOM-OBJECT PARTICLES (FALLING LEAVES) */}
      {isCustomMesh && (
        <div className="space-y-2.5 pt-2.5 border-t border-slate-200/60 dark:border-white/[0.06]">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-500 dark:text-[#949BB0]">
              Particle 3D Mesh / Object
            </label>
            <select
              value={cfg.customMeshAssetId ?? ''}
              onChange={(e) =>
                patchFx({ customMeshAssetId: e.target.value || undefined }, true)
              }
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.08] text-xs font-bold"
            >
              <option value="">Built-in 3D Leaf (Fallback)</option>
              {store.customAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name} ({asset.category})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => store.setShowingAssetVault(true)}
              className="w-full py-1.5 px-2.5 rounded-lg bg-[#7C5CFF]/12 hover:bg-[#7C5CFF]/20 text-[#7C5CFF] text-[11px] font-bold inline-flex items-center justify-center gap-1.5"
            >
              <Box size={12} />
              <span>Import / Pick Custom 3D Model</span>
            </button>
          </div>

          {!cfg.customMeshAssetId && (
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1 text-[11px] font-semibold">
                <span className="text-slate-600 dark:text-[#A5AEC4]">Leaf Color A</span>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.08]">
                  <input
                    type="color"
                    value={cfg.startColor}
                    onChange={(e) => patchFx({ startColor: e.target.value })}
                    className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                  />
                  <span className="font-mono text-[10px] uppercase">{cfg.startColor}</span>
                </div>
              </label>
              <label className="space-y-1 text-[11px] font-semibold">
                <span className="text-slate-600 dark:text-[#A5AEC4]">Leaf Color B</span>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.08]">
                  <input
                    type="color"
                    value={cfg.endColor}
                    onChange={(e) => patchFx({ endColor: e.target.value })}
                    className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                  />
                  <span className="font-mono text-[10px] uppercase">{cfg.endColor}</span>
                </div>
              </label>
            </div>
          )}

          <SliderRow
            label="Spawn Rate"
            value={cfg.spawnRate}
            min={1}
            max={35}
            step={1}
            unit="/s"
            decimals={0}
            onChange={(v) => patchFx({ spawnRate: v })}
          />
          <SliderRow
            label="Spawn Canopy Radius"
            value={cfg.areaRadius}
            min={0.5}
            max={14}
            step={0.5}
            unit="m"
            decimals={1}
            onChange={(v) => patchFx({ areaRadius: v })}
          />
          <SliderRow
            label="Fall Speed"
            value={cfg.fallSpeed}
            min={0.2}
            max={5.0}
            step={0.1}
            unit="m/s"
            decimals={1}
            onChange={(v) => patchFx({ fallSpeed: v })}
          />
          <SliderRow
            label="Wind Drift"
            value={cfg.windDrift}
            min={0}
            max={5.0}
            step={0.1}
            unit="m/s"
            decimals={1}
            onChange={(v) => patchFx({ windDrift: v })}
          />
          <SliderRow
            label="Wind Angle"
            value={cfg.windAngle}
            min={0}
            max={360}
            step={5}
            unit="°"
            decimals={0}
            onChange={(v) => patchFx({ windAngle: v })}
          />
          <SliderRow
            label="Flutter / Sway Amplitude"
            value={cfg.swayAmplitude}
            min={0}
            max={2.5}
            step={0.05}
            onChange={(v) => patchFx({ swayAmplitude: v })}
          />
          <SliderRow
            label="Flutter Frequency"
            value={cfg.swayFrequency}
            min={0.3}
            max={6.0}
            step={0.1}
            unit="Hz"
            decimals={1}
            onChange={(v) => patchFx({ swayFrequency: v })}
          />
          <SliderRow
            label="Tumble / Spin Speed"
            value={cfg.tumbleSpeed}
            min={0}
            max={8.0}
            step={0.2}
            decimals={1}
            onChange={(v) => patchFx({ tumbleSpeed: v })}
          />
          <SliderRow
            label="Base Object Size"
            value={cfg.startSize}
            min={0.1}
            max={2.0}
            step={0.05}
            unit="m"
            onChange={(v) => patchFx({ startSize: v })}
          />
          <SliderRow
            label="Scale Variation"
            value={cfg.scaleVariation}
            min={0}
            max={0.8}
            step={0.05}
            onChange={(v) => patchFx({ scaleVariation: v })}
          />
          <SliderRow
            label="Lifetime"
            value={cfg.lifetime}
            min={1.0}
            max={12.0}
            step={0.2}
            unit="s"
            decimals={1}
            onChange={(v) => patchFx({ lifetime: v })}
          />
        </div>
      )}

      {/* C1. WATER SPLASH BURST CONTROLS */}
      {isWaterSplash && (
        <div className="space-y-2.5 pt-2.5 border-t border-slate-200/60 dark:border-white/[0.06]">
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-[11px] font-semibold">
              <span className="text-slate-600 dark:text-[#A5AEC4]">Foam Color</span>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.08]">
                <input
                  type="color"
                  value={cfg.startColor}
                  onChange={(e) => patchFx({ startColor: e.target.value })}
                  className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                />
                <span className="font-mono text-[10px] uppercase">{cfg.startColor}</span>
              </div>
            </label>
            <label className="space-y-1 text-[11px] font-semibold">
              <span className="text-slate-600 dark:text-[#A5AEC4]">Droplet Color</span>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.08]">
                <input
                  type="color"
                  value={cfg.endColor}
                  onChange={(e) => patchFx({ endColor: e.target.value })}
                  className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                />
                <span className="font-mono text-[10px] uppercase">{cfg.endColor}</span>
              </div>
            </label>
          </div>

          <SliderRow
            label="Droplets per Burst"
            value={cfg.burstCount}
            min={6}
            max={100}
            step={2}
            decimals={0}
            onChange={(v) => patchFx({ burstCount: v })}
          />
          <SliderRow
            label="Burst Interval (0 = Manual)"
            value={cfg.burstInterval}
            min={0}
            max={8.0}
            step={0.2}
            unit="s"
            decimals={1}
            onChange={(v) => patchFx({ burstInterval: v })}
          />
          <SliderRow
            label="Splash Droplet Size"
            value={cfg.splashSize}
            min={0.1}
            max={1.2}
            step={0.04}
            unit="m"
            onChange={(v) => patchFx({ splashSize: v })}
          />
          <SliderRow
            label="Upward / Outward Speed"
            value={cfg.speed}
            min={1.0}
            max={12.0}
            step={0.2}
            unit="m/s"
            decimals={1}
            onChange={(v) => patchFx({ speed: v })}
          />
          <SliderRow
            label="Spread Angle"
            value={cfg.spreadAngle}
            min={10}
            max={110}
            step={2}
            unit="°"
            decimals={0}
            onChange={(v) => patchFx({ spreadAngle: v })}
          />
          <SliderRow
            label="Gravity"
            value={cfg.gravity}
            min={-20}
            max={-2}
            step={0.5}
            decimals={1}
            onChange={(v) => patchFx({ gravity: v })}
          />
          <SliderRow
            label="Droplet Lifetime"
            value={cfg.lifetime}
            min={0.3}
            max={3.0}
            step={0.1}
            unit="s"
            decimals={1}
            onChange={(v) => patchFx({ lifetime: v })}
          />
        </div>
      )}

      {/* C2. LIGHTNING ARC CONTROLS */}
      {isLightning && (
        <div className="space-y-2.5 pt-2.5 border-t border-slate-200/60 dark:border-white/[0.06]">
          <label className="space-y-1 text-[11px] font-semibold block">
            <span className="text-slate-600 dark:text-[#A5AEC4]">Glow Color</span>
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.08]">
              <input
                type="color"
                value={cfg.startColor}
                onChange={(e) => patchFx({ startColor: e.target.value })}
                className="w-6 h-5 rounded cursor-pointer bg-transparent border-0"
              />
              <span className="font-mono text-xs uppercase">{cfg.startColor}</span>
            </div>
          </label>

          <SliderRow
            label="Bolt Length"
            value={cfg.boltLength}
            min={1.5}
            max={18}
            step={0.25}
            unit="m"
            decimals={2}
            onChange={(v) => patchFx({ boltLength: v })}
          />

          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-700 dark:text-[#C8D0E4]">
              Target Direction Offset (X, Y, Z)
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {(['X', 'Y', 'Z'] as const).map((axis, idx) => (
                <label
                  key={axis}
                  className="flex flex-col gap-0.5 text-[10px] font-bold text-slate-500 dark:text-[#8E96AB]"
                >
                  <span>{axis}</span>
                  <input
                    type="number"
                    step={0.5}
                    value={cfg.targetOffset[idx]}
                    onChange={(e) => {
                      const next: [number, number, number] = [...cfg.targetOffset] as [
                        number,
                        number,
                        number,
                      ];
                      next[idx] = Number(e.target.value) || 0;
                      patchFx({ targetOffset: next });
                    }}
                    className="w-full px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.08] font-mono text-xs tabular-nums"
                  />
                </label>
              ))}
            </div>
          </div>

          <SliderRow
            label="Branching / Forks"
            value={cfg.branchAmount}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => patchFx({ branchAmount: v })}
          />
          <SliderRow
            label="Jagged Jitter"
            value={cfg.jitterAmount}
            min={0.05}
            max={2.0}
            step={0.05}
            onChange={(v) => patchFx({ jitterAmount: v })}
          />
          <SliderRow
            label="Bolt Thickness"
            value={cfg.boltThickness}
            min={0.03}
            max={0.35}
            step={0.01}
            unit="m"
            onChange={(v) => patchFx({ boltThickness: v })}
          />
          <SliderRow
            label="Flash / Flicker Rate"
            value={cfg.flickerRate}
            min={0.5}
            max={16}
            step={0.5}
            unit="Hz"
            decimals={1}
            onChange={(v) => patchFx({ flickerRate: v })}
          />
          <SliderRow
            label="Storm Interval (0 = Continuous)"
            value={cfg.burstInterval}
            min={0}
            max={8}
            step={0.2}
            unit="s"
            decimals={1}
            onChange={(v) => patchFx({ burstInterval: v })}
          />
        </div>
      )}

      {/* D. WEATHER / ATMOSPHERE CONTROLS (RAIN, SNOW, FOG) */}
      {isWeather && (
        <div className="space-y-2.5 pt-2.5 border-t border-slate-200/60 dark:border-white/[0.06]">
          <label className="space-y-1 text-[11px] font-semibold block">
            <span className="text-slate-600 dark:text-[#A5AEC4]">Tint Color</span>
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.08]">
              <input
                type="color"
                value={cfg.startColor}
                onChange={(e) => patchFx({ startColor: e.target.value })}
                className="w-6 h-5 rounded cursor-pointer bg-transparent border-0"
              />
              <span className="font-mono text-xs uppercase">{cfg.startColor}</span>
            </div>
          </label>

          <SliderRow
            label="Density"
            value={cfg.density}
            min={cfg.preset === 'fog' ? 4 : 15}
            max={cfg.preset === 'fog' ? 32 : 200}
            step={cfg.preset === 'fog' ? 1 : 5}
            decimals={0}
            onChange={(v) => patchFx({ density: v })}
          />
          <SliderRow
            label="Area Radius"
            value={cfg.areaRadius}
            min={1.5}
            max={22}
            step={0.5}
            unit="m"
            decimals={1}
            onChange={(v) => patchFx({ areaRadius: v })}
          />
          <SliderRow
            label="Area Height"
            value={cfg.areaHeight}
            min={1.5}
            max={18}
            step={0.5}
            unit="m"
            decimals={1}
            onChange={(v) => patchFx({ areaHeight: v })}
          />
          {cfg.preset !== 'fog' && (
            <SliderRow
              label="Fall Speed"
              value={cfg.fallSpeed}
              min={0.5}
              max={24}
              step={0.5}
              unit="m/s"
              decimals={1}
              onChange={(v) => patchFx({ fallSpeed: v })}
            />
          )}
          <SliderRow
            label="Wind Strength"
            value={cfg.windDrift}
            min={0}
            max={6}
            step={0.1}
            unit="m/s"
            decimals={1}
            onChange={(v) => patchFx({ windDrift: v })}
          />
          <SliderRow
            label="Wind Angle"
            value={cfg.windAngle}
            min={0}
            max={360}
            step={5}
            unit="°"
            decimals={0}
            onChange={(v) => patchFx({ windAngle: v })}
          />
          <SliderRow
            label={cfg.preset === 'fog' ? 'Mist Card Scale' : 'Particle Size'}
            value={cfg.startSize}
            min={cfg.preset === 'fog' ? 1.5 : 0.06}
            max={cfg.preset === 'fog' ? 10.0 : 0.65}
            step={cfg.preset === 'fog' ? 0.25 : 0.02}
            unit="m"
            onChange={(v) => patchFx({ startSize: v, endSize: cfg.preset === 'fog' ? v * 1.25 : v })}
          />
        </div>
      )}

      {/* E. LIVING / CRITTER SWARM CONTROLS */}
      {isCritter && (
        <div className="space-y-2.5 pt-2.5 border-t border-slate-200/60 dark:border-white/[0.06]">
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-[11px] font-semibold">
              <span className="text-slate-600 dark:text-[#A5AEC4]">Primary Color</span>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.08]">
                <input
                  type="color"
                  value={cfg.startColor}
                  onChange={(e) => patchFx({ startColor: e.target.value })}
                  className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                />
                <span className="font-mono text-[10px] uppercase">{cfg.startColor}</span>
              </div>
            </label>
            <label className="space-y-1 text-[11px] font-semibold">
              <span className="text-slate-600 dark:text-[#A5AEC4]">Accent / Wing</span>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.08]">
                <input
                  type="color"
                  value={cfg.endColor}
                  onChange={(e) => patchFx({ endColor: e.target.value })}
                  className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                />
                <span className="font-mono text-[10px] uppercase">{cfg.endColor}</span>
              </div>
            </label>
          </div>

          <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#12151E] border border-slate-200/70 dark:border-white/[0.08] cursor-pointer">
            <span className="text-xs font-bold text-slate-700 dark:text-[#D5DCF0]">
              Glow / Emissive Aura
            </span>
            <input
              type="checkbox"
              checked={Boolean(cfg.glowEnabled)}
              onChange={(e) => patchFx({ glowEnabled: e.target.checked }, true)}
              className="accent-[#7C5CFF] w-4 h-4"
            />
          </label>

          <SliderRow
            label={cfg.preset === 'birds' ? 'Bird Count' : 'Critter Count'}
            value={cfg.critterCount}
            min={1}
            max={Math.max(4, cfg.maxParticles)}
            step={1}
            decimals={0}
            onChange={(v) => patchFx({ critterCount: v })}
          />

          {cfg.preset === 'birds' && (
            <div className="space-y-2.5 pt-1">
              {/* Quick count buttons: Solo / Pair / Few / Flock */}
              <div className="grid grid-cols-4 gap-1">
                {[
                  { label: 'Solo (1)', count: 1 },
                  { label: 'Pair (2)', count: 2 },
                  { label: 'Few (5)', count: 5 },
                  { label: 'Flock (12)', count: 12 },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => patchFx({ critterCount: opt.count }, true)}
                    className={`py-1 px-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                      cfg.critterCount === opt.count
                        ? 'bg-[#7C5CFF] text-white border-[#7C5CFF]'
                        : 'bg-slate-100 dark:bg-[#12151E] border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-[#A5AEC4] hover:border-[#7C5CFF]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Flight Pattern Selector */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-[#A5AEC4]">
                  Flight Formation / Pattern
                </label>
                <select
                  value={cfg.flightPattern ?? 'flock'}
                  onChange={(e) =>
                    patchFx({ flightPattern: e.target.value as BirdFlightPattern }, true)
                  }
                  className="w-full px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.08] text-xs font-bold"
                >
                  <option value="vFormation">V-Formation (Migrating)</option>
                  <option value="flock">Cohesive Flock</option>
                  <option value="wander">Free Wander / Random</option>
                  <option value="circle">Circling / Thermal Soar</option>
                </select>
              </div>

              {/* Random vs Directional Path */}
              <div className="space-y-1">
                <span className="block text-[11px] font-bold text-slate-600 dark:text-[#A5AEC4]">
                  Flight Direction
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { id: 'random', label: 'Random / Local' },
                      { id: 'directional', label: 'Directional Fly-By' },
                    ] as { id: BirdFlightMode; label: string }[]
                  ).map((mode) => {
                    const active = (cfg.flightMode ?? 'random') === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => patchFx({ flightMode: mode.id }, true)}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-colors ${
                          active
                            ? 'bg-[#7C5CFF] text-white border-[#7C5CFF]'
                            : 'bg-slate-100 dark:bg-[#12151E] border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-[#A5AEC4]'
                        }`}
                      >
                        {mode.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {(cfg.flightMode ?? 'random') === 'directional' && (
                <SliderRow
                  label="Flight Heading"
                  value={cfg.flightHeading ?? 40}
                  min={0}
                  max={360}
                  step={5}
                  unit="°"
                  decimals={0}
                  onChange={(v) => patchFx({ flightHeading: v })}
                />
              )}

              {/* Occasional Landing */}
              <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#12151E] border border-slate-200/70 dark:border-white/[0.08] cursor-pointer">
                <span className="text-xs font-bold text-slate-700 dark:text-[#D5DCF0]">
                  Land Occasionally
                </span>
                <input
                  type="checkbox"
                  checked={Boolean(cfg.landingEnabled)}
                  onChange={(e) => patchFx({ landingEnabled: e.target.checked }, true)}
                  className="accent-[#7C5CFF] w-4 h-4"
                />
              </label>

              {cfg.landingEnabled && (
                <SliderRow
                  label="Landing Frequency"
                  value={cfg.landingFrequency ?? 0.35}
                  min={0.05}
                  max={1.0}
                  step={0.05}
                  onChange={(v) => patchFx({ landingFrequency: v })}
                />
              )}
            </div>
          )}

          <SliderRow
            label={cfg.preset === 'birds' ? 'Flight Area Radius' : 'Roam Radius'}
            value={cfg.roamRadius}
            min={0.6}
            max={cfg.preset === 'birds' ? 28 : 14}
            step={cfg.preset === 'birds' ? 0.5 : 0.2}
            unit="m"
            decimals={1}
            onChange={(v) => patchFx({ roamRadius: v })}
          />
          <SliderRow
            label="Flight / Move Speed"
            value={cfg.moveSpeed}
            min={0.3}
            max={cfg.preset === 'birds' ? 12.0 : 7.0}
            step={0.1}
            unit="m/s"
            decimals={1}
            onChange={(v) => patchFx({ moveSpeed: v })}
          />
          <SliderRow
            label="Erraticness / Wander Jitter"
            value={cfg.erraticness}
            min={0}
            max={1.2}
            step={0.05}
            onChange={(v) => patchFx({ erraticness: v })}
          />
          <SliderRow
            label="Wing Flap Speed"
            value={cfg.flutterSpeed}
            min={2}
            max={40}
            step={0.5}
            unit="Hz"
            decimals={1}
            onChange={(v) => patchFx({ flutterSpeed: v })}
          />
          <SliderRow
            label="Wing Flap Angle"
            value={cfg.wingFlapAmplitude ?? (cfg.preset === 'butterflies' ? 72 : 54)}
            min={0}
            max={85}
            step={1}
            unit="°"
            decimals={0}
            onChange={(v) => patchFx({ wingFlapAmplitude: v })}
          />
          <SliderRow
            label={cfg.preset === 'birds' ? 'Bird Size' : 'Critter Size'}
            value={cfg.critterSize}
            min={0.06}
            max={cfg.preset === 'birds' ? 1.4 : 0.75}
            step={0.02}
            unit="m"
            onChange={(v) => patchFx({ critterSize: v })}
          />
        </div>
      )}

      {/* F. ARCANE, PORTALS & PROCEDURAL SPELL ABILITIES */}
      {isArcane && (
        <div className="space-y-2.5 pt-2.5 border-t border-slate-200/60 dark:border-white/[0.06]">
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-[11px] font-semibold">
              <span className="text-slate-600 dark:text-[#A5AEC4]">Core / Primary Color</span>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.08]">
                <input
                  type="color"
                  value={cfg.startColor}
                  onChange={(e) => patchFx({ startColor: e.target.value })}
                  className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
                />
                <span className="font-mono text-[10px] uppercase text-slate-600 dark:text-[#C8D0E4]">
                  {cfg.startColor}
                </span>
              </div>
            </label>
            <label className="space-y-1 text-[11px] font-semibold">
              <span className="text-slate-600 dark:text-[#A5AEC4]">Rim / Accent Color</span>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.08]">
                <input
                  type="color"
                  value={cfg.endColor}
                  onChange={(e) => patchFx({ endColor: e.target.value })}
                  className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
                />
                <span className="font-mono text-[10px] uppercase text-slate-600 dark:text-[#C8D0E4]">
                  {cfg.endColor}
                </span>
              </div>
            </label>
          </div>

          <SliderRow
            label={cfg.preset === 'dimensionalPortal' ? 'Portal Radius' : 'Effect Radius'}
            value={cfg.areaRadius}
            min={0.7}
            max={8.0}
            step={0.1}
            unit="m"
            decimals={1}
            onChange={(v) => patchFx({ areaRadius: v })}
          />
          {(cfg.preset === 'arcaneSigil' ||
            cfg.preset === 'crystalEruption' ||
            cfg.preset === 'energyPillar' ||
            cfg.preset === 'meteorStrike') && (
            <SliderRow
              label={
                cfg.preset === 'meteorStrike'
                  ? 'Meteor Drop Altitude'
                  : cfg.preset === 'crystalEruption'
                  ? 'Crystal Spire Height'
                  : cfg.preset === 'energyPillar'
                  ? 'Beam Height'
                  : 'Energy Veil Height'
              }
              value={cfg.areaHeight}
              min={1.0}
              max={18.0}
              step={0.2}
              unit="m"
              decimals={1}
              onChange={(v) => patchFx({ areaHeight: v })}
            />
          )}
          <SliderRow
            label="Animation / Spin Speed"
            value={cfg.speed}
            min={0.2}
            max={3.0}
            step={0.05}
            unit="x"
            decimals={2}
            onChange={(v) => patchFx({ speed: v })}
          />
          <SliderRow
            label="Emissive Glow Intensity"
            value={cfg.emissiveIntensity}
            min={0.4}
            max={4.0}
            step={0.1}
            decimals={1}
            onChange={(v) => patchFx({ emissiveIntensity: v })}
          />
          {(cfg.preset === 'arcaneSigil' ||
            cfg.preset === 'crystalEruption' ||
            cfg.preset === 'energyPillar' ||
            cfg.preset === 'meteorStrike') && (
            <SliderRow
              label="Cycle / Repeat Interval"
              value={cfg.burstInterval}
              min={1.2}
              max={12.0}
              step={0.2}
              unit="s"
              decimals={1}
              onChange={(v) => patchFx({ burstInterval: v })}
            />
          )}
        </div>
      )}
    </div>
  );
};
