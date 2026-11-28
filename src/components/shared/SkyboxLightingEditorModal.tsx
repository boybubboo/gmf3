import React, { useMemo } from 'react';
import {
  Cloud,
  CloudRain,
  CloudSun,
  Compass,
  Moon,
  RotateCcw,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  Wind,
  X,
} from 'lucide-react';
import type { MakerStore } from '../../store/useMakerStore';
import { computeAtmosphereState } from '../../three/islandScene';
import type { GameLevel, SkyPresetId, TimeOfDayPresetId, WeatherKind } from '../../types/maker';

export interface TimeOfDayPresetDef {
  id: TimeOfDayPresetId;
  label: string;
  clockLabel: string;
  timeOfDay: number;
  sky: SkyPresetId;
  sunAngle: number;
  fog: number;
  sunIntensityScale: number;
  ambientIntensityScale: number;
  atmosphereWarmth: number;
  starIntensity: number;
  gradient: [string, string, string];
  orbColor: string;
}

export const TIME_OF_DAY_PRESETS: TimeOfDayPresetDef[] = [
  {
    id: 'dawn',
    label: 'Dawn',
    clockLabel: '06:30',
    timeOfDay: 6.5,
    sky: 'golden',
    sunAngle: 28,
    fog: 0.24,
    sunIntensityScale: 1.0,
    ambientIntensityScale: 1.02,
    atmosphereWarmth: 0.14,
    starIntensity: 0.45,
    gradient: ['#2D4E88', '#B5727A', '#F2A36F'],
    orbColor: '#FFC98E',
  },
  {
    id: 'noon',
    label: 'Noon',
    clockLabel: '12:30',
    timeOfDay: 12.5,
    sky: 'sunny',
    sunAngle: 52,
    fog: 0.14,
    sunIntensityScale: 1.05,
    ambientIntensityScale: 1.0,
    atmosphereWarmth: 0,
    starIntensity: 0,
    gradient: ['#3674BA', '#6CA5DA', '#9AC9EC'],
    orbColor: '#FFF6DC',
  },
  {
    id: 'dusk',
    label: 'Dusk',
    clockLabel: '18:00',
    timeOfDay: 18.0,
    sky: 'golden',
    sunAngle: 152,
    fog: 0.26,
    sunIntensityScale: 1.02,
    ambientIntensityScale: 0.96,
    atmosphereWarmth: 0.18,
    starIntensity: 0.65,
    gradient: ['#2A3660', '#A25B62', '#DF8A52'],
    orbColor: '#FFA45B',
  },
  {
    id: 'night',
    label: 'Night',
    clockLabel: '23:00',
    timeOfDay: 23.0,
    sky: 'night',
    sunAngle: 218,
    fog: 0.2,
    sunIntensityScale: 0.95,
    ambientIntensityScale: 0.92,
    atmosphereWarmth: -0.1,
    starIntensity: 1.15,
    gradient: ['#080D1F', '#121C3A', '#1B2A52'],
    orbColor: '#CFE0FF',
  },
];

const CLOUD_QUICK_PRESETS: { label: string; value: number }[] = [
  { label: 'Clear', value: 0 },
  { label: 'Light', value: 0.3 },
  { label: 'Fluffy', value: 0.6 },
  { label: 'Overcast', value: 0.92 },
];

const SKY_MOOD_OPTIONS: { id: SkyPresetId; label: string }[] = [
  { id: 'sunny', label: 'Sunny' },
  { id: 'golden', label: 'Golden' },
  { id: 'mist', label: 'Misty' },
  { id: 'storm', label: 'Storm' },
  { id: 'night', label: 'Night' },
  { id: 'cave', label: 'Cavern' },
];

const WEATHER_OPTIONS: { id: WeatherKind; label: string }[] = [
  { id: 'none', label: 'Clear' },
  { id: 'rain', label: 'Rain' },
  { id: 'storm', label: 'Stormy' },
  { id: 'snow', label: 'Snow' },
  { id: 'fireflies', label: 'Fireflies' },
  { id: 'leaves', label: 'Leaves' },
];

const PREVIEW_STARS = [
  { x: 11, y: 14, r: 1.2 },
  { x: 22, y: 26, r: 0.9 },
  { x: 31, y: 11, r: 1.4 },
  { x: 44, y: 20, r: 1.0 },
  { x: 56, y: 13, r: 1.3 },
  { x: 67, y: 25, r: 0.9 },
  { x: 77, y: 15, r: 1.2 },
  { x: 88, y: 22, r: 1.1 },
  { x: 16, y: 36, r: 0.8 },
  { x: 39, y: 33, r: 1.1 },
  { x: 62, y: 34, r: 0.9 },
  { x: 83, y: 37, r: 1.0 },
  { x: 49, y: 8, r: 0.9 },
  { x: 92, y: 12, r: 1.2 },
];

export function resolveEffectiveHour(level: GameLevel): number {
  if (level.timeOfDay !== undefined) {
    return ((level.timeOfDay % 24) + 24) % 24;
  }
  if (level.sky === 'night' || level.sky === 'cave') return 23;
  if (level.sky === 'golden') return 17.8;
  return 12.5;
}

export function detectTimeOfDayPreset(level: GameLevel): TimeOfDayPresetId {
  const hour = resolveEffectiveHour(level);
  if (hour >= 4.75 && hour < 9.25) return 'dawn';
  if (hour >= 9.25 && hour < 16.0) return 'noon';
  if (hour >= 16.0 && hour < 20.25) return 'dusk';
  return 'night';
}

export function formatClock24(hour: number): string {
  const norm = ((hour % 24) + 24) % 24;
  const h = Math.floor(norm);
  const m = Math.round((norm - h) * 60) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const TimeOfDayIcon: React.FC<{ preset: TimeOfDayPresetId; size?: number; className?: string }> = ({
  preset,
  size = 14,
  className,
}) => {
  if (preset === 'dawn') return <Sunrise size={size} className={className} />;
  if (preset === 'noon') return <Sun size={size} className={className} />;
  if (preset === 'dusk') return <Sunset size={size} className={className} />;
  return <Moon size={size} className={className} />;
};

interface SkyboxLightingEditorModalProps {
  store: MakerStore;
  onClose: () => void;
}

export const SkyboxLightingEditorModal: React.FC<SkyboxLightingEditorModalProps> = ({
  store,
  onClose,
}) => {
  const level = store.currentLevel;

  const effectiveHour = level ? resolveEffectiveHour(level) : 12.5;
  const activePreset = level ? detectTimeOfDayPreset(level) : 'noon';
  const cloudDensity =
    level?.cloudDensity ?? (level?.sky === 'storm' ? 0.85 : level?.sky === 'mist' ? 0.72 : 0.58);
  const sunIntensityScale = level?.sunIntensityScale ?? 1;
  const ambientIntensityScale = level?.ambientIntensityScale ?? 1;
  const atmosphereWarmth = level?.atmosphereWarmth ?? 0;
  const starIntensity = level?.starIntensity ?? 1;
  const fog = level?.fog ?? 0.2;
  const wind = level?.wind ?? 0.35;
  const sunAngle = level?.sunAngle ?? 42;

  const previewAtmo = useMemo(() => {
    if (!level) return null;
    return computeAtmosphereState(level);
  }, [level]);

  if (!level || !previewAtmo) return null;

  const patchLevel = (
    label: string,
    patch: Partial<GameLevel>,
    recordUndo = false
  ) => {
    store.updateLevel(label, (l) => ({ ...l, ...patch }), recordUndo);
  };

  const applyTimePreset = (preset: TimeOfDayPresetDef) => {
    patchLevel(
      `sky preset: ${preset.label}`,
      {
        sky: preset.sky,
        timeOfDay: preset.timeOfDay,
        sunAngle: preset.sunAngle,
        fog: preset.fog,
        sunIntensityScale: preset.sunIntensityScale,
        ambientIntensityScale: preset.ambientIntensityScale,
        atmosphereWarmth: preset.atmosphereWarmth,
        starIntensity: preset.starIntensity,
      },
      true
    );
  };

  const resetAtmosphere = () => {
    patchLevel(
      'reset sky & lighting',
      {
        sky: 'sunny',
        timeOfDay: 12.5,
        autoCycleTime: false,
        cloudDensity: 0.58,
        sunAngle: 48,
        fog: 0.16,
        sunIntensityScale: 1,
        ambientIntensityScale: 1,
        atmosphereWarmth: 0,
        starIntensity: 1,
        weather: 'none',
        wind: 0.35,
      },
      true
    );
  };

  // Compute orb placement in preview banner
  const sunRad = ((effectiveHour - 6) / 24) * Math.PI * 2;
  const orbX = 50 + Math.cos(sunRad) * 34;
  const elev = Math.sin(sunRad);
  const isNightOrb = elev < -0.05;
  const orbY = isNightOrb ? 26 + Math.abs(elev) * 14 : Math.max(16, 78 - elev * 60);
  const starOpacity = Math.max(
    0,
    Math.min(1, previewAtmo.nightFactor * starIntensity * (1 - cloudDensity * 0.45))
  );

  const zenHex = `#${previewAtmo.zenithColor.getHexString()}`;
  const midHex = `#${previewAtmo.midColor.getHexString()}`;
  const horHex = `#${previewAtmo.horizonColor.getHexString()}`;
  const sunHex = `#${previewAtmo.sunColor.getHexString()}`;

  return (
    <aside
      aria-label="Skybox and Atmospheric Lighting Editor"
      className="fixed top-16 right-4 bottom-4 z-40 w-[372px] max-w-[calc(100vw-2rem)] flex flex-col rounded-2xl bg-white dark:bg-[#171A23] border border-slate-200/90 dark:border-white/[0.11] shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200/80 dark:border-white/[0.08]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#38BDF8]/15 text-[#0EA5E9] dark:text-[#38BDF8] flex items-center justify-center shrink-0">
            <CloudSun size={17} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold truncate">Skybox & Lighting</h2>
            <p className="text-[11px] text-slate-500 dark:text-[#949BB0] truncate">
              {level.name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={resetAtmosphere}
            title="Reset atmosphere to default noon"
            className="w-8 h-8 rounded-xl text-slate-500 dark:text-[#949BB0] hover:bg-slate-100 dark:hover:bg-[#232838] flex items-center justify-center transition-colors"
          >
            <RotateCcw size={14} />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close Skybox & Lighting Editor"
            className="w-8 h-8 rounded-xl text-slate-500 dark:text-[#949BB0] hover:bg-slate-100 dark:hover:bg-[#232838] flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 min-h-0 overflow-y-auto maker-scroll p-4 space-y-5">
        {/* Live Sky Dome Preview */}
        <div
          className="relative h-28 rounded-xl overflow-hidden border border-slate-200/80 dark:border-white/[0.1]"
          style={{
            background: `linear-gradient(180deg, ${zenHex} 0%, ${midHex} 54%, ${horHex} 100%)`,
          }}
        >
          {/* Stars */}
          {starOpacity > 0.03 && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 100 50"
              preserveAspectRatio="none"
            >
              {PREVIEW_STARS.map((st, idx) => (
                <circle
                  key={idx}
                  cx={st.x}
                  cy={st.y}
                  r={st.r * 0.48}
                  fill="#FFFFFF"
                  opacity={starOpacity * (0.55 + (idx % 3) * 0.2)}
                />
              ))}
            </svg>
          )}

          {/* Sun / Moon Orb */}
          <div
            className="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none transition-all duration-150"
            style={{
              left: `${orbX}%`,
              top: `${orbY}%`,
              backgroundColor: isNightOrb ? '#DCE7FF' : sunHex,
              boxShadow: isNightOrb
                ? '0 0 16px 4px rgba(176,204,255,0.45)'
                : `0 0 24px 8px ${sunHex}AA`,
            }}
          />

          {/* Procedural Cloud Silhouettes */}
          {cloudDensity > 0.02 && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 320 112"
              preserveAspectRatio="none"
            >
              <g
                fill={previewAtmo.nightFactor > 0.55 ? '#8AA0C8' : '#FFFFFF'}
                opacity={Math.min(0.88, 0.16 + cloudDensity * 0.72)}
              >
                <ellipse cx="64" cy="46" rx={18 + cloudDensity * 24} ry={8 + cloudDensity * 6} />
                <ellipse cx="82" cy="42" rx={12 + cloudDensity * 16} ry={7 + cloudDensity * 5} />
                {cloudDensity > 0.2 && (
                  <>
                    <ellipse cx="222" cy="36" rx={22 + cloudDensity * 26} ry={9 + cloudDensity * 6} />
                    <ellipse cx="246" cy="39" rx={14 + cloudDensity * 18} ry={7 + cloudDensity * 5} />
                  </>
                )}
                {cloudDensity > 0.45 && (
                  <>
                    <ellipse cx="148" cy="56" rx={20 + cloudDensity * 26} ry={8 + cloudDensity * 7} />
                    <ellipse cx="288" cy="54" rx={18 + cloudDensity * 20} ry={7 + cloudDensity * 5} />
                  </>
                )}
                {cloudDensity > 0.72 && (
                  <ellipse cx="24" cy="60" rx={26 + cloudDensity * 22} ry={10 + cloudDensity * 6} />
                )}
              </g>
            </svg>
          )}

          {/* Horizon Silhouette */}
          <svg
            className="absolute bottom-0 inset-x-0 w-full h-9 pointer-events-none"
            viewBox="0 0 320 36"
            preserveAspectRatio="none"
          >
            <path
              d="M0 36 L0 22 Q45 10 92 20 T192 16 T282 22 L320 16 L320 36 Z"
              fill={previewAtmo.nightFactor > 0.55 ? '#0B1020' : '#1E2A38'}
              opacity={0.42}
            />
          </svg>

          {/* Compact Readout Overlay */}
          <div className="absolute top-2 left-2.5 right-2.5 flex items-center justify-between text-[11px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]">
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <TimeOfDayIcon preset={activePreset} size={13} />
              <span>{formatClock24(effectiveHour)}</span>
              <span className="opacity-85 capitalize">{activePreset}</span>
            </span>
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Cloud size={12} />
              <span>{Math.round(cloudDensity * 100)}%</span>
            </span>
          </div>
        </div>

        {/* Time-of-Day Presets */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#949BB0]">
              Time of Day Presets
            </h3>
            <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-[#C5CBE0] cursor-pointer">
              <input
                type="checkbox"
                checked={!!level.autoCycleTime}
                onChange={(e) =>
                  patchLevel('toggle day/night cycle', { autoCycleTime: e.target.checked }, true)
                }
                className="accent-[#7C5CFF] rounded"
              />
              <span>Auto cycle</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {TIME_OF_DAY_PRESETS.map((preset) => {
              const isSelected = activePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyTimePreset(preset)}
                  className={`group relative flex items-center gap-2.5 p-2 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'border-[#7C5CFF] bg-[#7C5CFF]/10 ring-1 ring-[#7C5CFF]/40'
                      : 'border-slate-200/80 dark:border-white/[0.08] bg-slate-50 dark:bg-[#1E2230] hover:border-[#7C5CFF]/50'
                  }`}
                >
                  <div
                    className="w-9 h-9 rounded-lg shrink-0 relative overflow-hidden border border-black/10"
                    style={{
                      background: `linear-gradient(180deg, ${preset.gradient[0]}, ${preset.gradient[1]} 55%, ${preset.gradient[2]})`,
                    }}
                  >
                    <span
                      className="absolute w-2.5 h-2.5 rounded-full left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                      style={{
                        backgroundColor: preset.orbColor,
                        boxShadow: `0 0 8px ${preset.orbColor}`,
                      }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-extrabold flex items-center gap-1.5">
                      <TimeOfDayIcon
                        preset={preset.id}
                        size={13}
                        className={isSelected ? 'text-[#7C5CFF]' : 'text-slate-500 dark:text-[#949BB0]'}
                      />
                      <span>{preset.label}</span>
                    </div>
                    <div className="text-[11px] font-semibold text-slate-500 dark:text-[#949BB0] tabular-nums">
                      {preset.clockLabel}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 24h Scrubber */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-600 dark:text-[#C5CBE0]">Solar Clock</span>
              <span className="tabular-nums font-bold text-[#7C5CFF]">
                {formatClock24(effectiveHour)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={24}
              step={0.25}
              value={effectiveHour}
              onChange={(e) =>
                patchLevel('time of day', { timeOfDay: Number(e.target.value) }, false)
              }
              className="w-full accent-[#7C5CFF]"
            />
            <div
              className="h-1.5 rounded-full w-full opacity-85"
              style={{
                background:
                  'linear-gradient(90deg, #0D142C 0%, #50406A 20%, #F2A36F 28%, #5CA1DE 52%, #DF8A52 75%, #242A54 85%, #0D142C 100%)',
              }}
            />
          </div>
        </section>

        {/* Cloud Density & Wind */}
        <section className="space-y-3 pt-3 border-t border-slate-200/80 dark:border-white/[0.08]">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#949BB0] flex items-center gap-1.5">
              <Cloud size={12} />
              <span>Cloud Cover</span>
            </h3>
            <span className="text-xs font-extrabold tabular-nums text-[#0EA5E9] dark:text-[#38BDF8]">
              {Math.round(cloudDensity * 100)}%
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={cloudDensity}
            onChange={(e) =>
              patchLevel('cloud density', { cloudDensity: Number(e.target.value) }, false)
            }
            className="w-full accent-[#38BDF8]"
          />

          <div className="grid grid-cols-4 gap-1.5">
            {CLOUD_QUICK_PRESETS.map((cp) => {
              const active = Math.abs(cloudDensity - cp.value) < 0.08;
              return (
                <button
                  key={cp.label}
                  type="button"
                  onClick={() => patchLevel(`cloud density: ${cp.label}`, { cloudDensity: cp.value }, true)}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#38BDF8]/18 text-[#0284C7] dark:text-[#38BDF8] ring-1 ring-[#38BDF8]/40'
                      : 'bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#949BB0] hover:bg-slate-200/80 dark:hover:bg-[#272D3C]'
                  }`}
                >
                  {cp.label}
                </button>
              );
            })}
          </div>

          <SliderRow
            label="Edge Softness"
            valueText={`${Math.round((level.cloudSoftness ?? 0.72) * 100)}%`}
            min={0}
            max={1}
            step={0.02}
            value={level.cloudSoftness ?? 0.72}
            onChange={(v) => patchLevel('cloud softness', { cloudSoftness: v }, false)}
          />

          <SliderRow
            label="Cloud Opacity"
            valueText={`${Math.round((level.cloudOpacity ?? 0.85) * 100)}%`}
            min={0}
            max={1}
            step={0.02}
            value={level.cloudOpacity ?? 0.85}
            onChange={(v) => patchLevel('cloud opacity', { cloudOpacity: v }, false)}
          />

          <SliderRow
            label="Cloud Height"
            valueText={`${Math.round(level.cloudHeight ?? 0)}m`}
            min={-20}
            max={60}
            step={1}
            value={level.cloudHeight ?? 0}
            onChange={(v) => patchLevel('cloud height', { cloudHeight: v }, false)}
          />

          <SliderRow
            icon={<Wind size={12} />}
            label="Cloud Movement Speed"
            valueText={`${Math.round((level.cloudSpeed ?? 1.0) * 100)}%`}
            min={0}
            max={3}
            step={0.05}
            value={level.cloudSpeed ?? 1.0}
            onChange={(v) => patchLevel('cloud speed', { cloudSpeed: v }, false)}
          />

          <div className="grid grid-cols-2 gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => {
                const next = !(level.stormClouds ?? (level.weather === 'storm' || level.sky === 'storm'));
                patchLevel('toggle storm clouds', { stormClouds: next, stormLightning: next }, true);
              }}
              className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap ${
                level.stormClouds ?? (level.weather === 'storm' || level.sky === 'storm')
                  ? 'bg-[#6366F1] text-white'
                  : 'bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#949BB0]'
              }`}
            >
              Storm Clouds
            </button>
            <button
              type="button"
              onClick={() =>
                patchLevel('toggle aurora borealis', { auroraEnabled: !(level.auroraEnabled ?? false) }, true)
              }
              className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap ${
                level.auroraEnabled
                  ? 'bg-[#10B981] text-white'
                  : 'bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#949BB0]'
              }`}
            >
              Aurora Borealis
            </button>
          </div>

          <SliderRow
            icon={<Wind size={12} />}
            label="Wind Strength"
            valueText={`${Math.round(wind * 100)}%`}
            min={0}
            max={2}
            step={0.05}
            value={wind}
            onChange={(v) => patchLevel('wind speed', { wind: v }, false)}
          />
        </section>

        {/* Atmospheric Lighting Sliders */}
        <section className="space-y-3 pt-3 border-t border-slate-200/80 dark:border-white/[0.08]">
          <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#949BB0]">
            Atmospheric Lighting
          </h3>

          <SliderRow
            icon={<Compass size={12} />}
            label="Sun Azimuth"
            valueText={`${Math.round(sunAngle)}°`}
            min={0}
            max={360}
            step={2}
            value={sunAngle}
            onChange={(v) => patchLevel('sun azimuth', { sunAngle: v }, false)}
          />

          <SliderRow
            icon={<Sun size={12} />}
            label="Sun / Moon Intensity"
            valueText={`${Math.round(sunIntensityScale * 100)}%`}
            min={0.3}
            max={1.8}
            step={0.05}
            value={sunIntensityScale}
            onChange={(v) => patchLevel('sun intensity', { sunIntensityScale: v }, false)}
          />

          <SliderRow
            icon={<CloudSun size={12} />}
            label="Ambient Sky Fill"
            valueText={`${Math.round(ambientIntensityScale * 100)}%`}
            min={0.3}
            max={1.8}
            step={0.05}
            value={ambientIntensityScale}
            onChange={(v) => patchLevel('ambient sky fill', { ambientIntensityScale: v }, false)}
          />

          <SliderRow
            label="Atmospheric Fog"
            valueText={`${Math.round(fog * 100)}%`}
            min={0}
            max={1}
            step={0.02}
            value={fog}
            onChange={(v) => patchLevel('fog density', { fog: v }, false)}
          />

          <SliderRow
            label="Horizon Warmth"
            valueText={
              atmosphereWarmth > 0.02
                ? `+${Math.round(atmosphereWarmth * 100)}`
                : atmosphereWarmth < -0.02
                ? `${Math.round(atmosphereWarmth * 100)}`
                : 'Neutral'
            }
            min={-0.5}
            max={0.5}
            step={0.02}
            value={atmosphereWarmth}
            onChange={(v) => patchLevel('horizon warmth', { atmosphereWarmth: v }, false)}
          />

          <SliderRow
            icon={<Sparkles size={12} />}
            label="Starfield Brightness"
            valueText={`${Math.round(starIntensity * 100)}%`}
            min={0}
            max={1.5}
            step={0.05}
            value={starIntensity}
            onChange={(v) => patchLevel('star brightness', { starIntensity: v }, false)}
          />
        </section>

        {/* Sky Tint & Weather */}
        <section className="space-y-3 pt-3 border-t border-slate-200/80 dark:border-white/[0.08]">
          <div className="space-y-1.5">
            <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#949BB0]">
              Sky Atmosphere Tint
            </h3>
            <div className="grid grid-cols-3 gap-1.5">
              {SKY_MOOD_OPTIONS.map((opt) => {
                const active = level.sky === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => patchLevel(`sky mood: ${opt.label}`, { sky: opt.id }, true)}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-[#7C5CFF] text-white'
                        : 'bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#949BB0] hover:bg-slate-200/80 dark:hover:bg-[#272D3C]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#949BB0] flex items-center gap-1.5">
              <CloudRain size={12} />
              <span>Weather</span>
            </h3>
            <div className="grid grid-cols-3 gap-1">
              {WEATHER_OPTIONS.map((w) => {
                const active = level.weather === w.id;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() =>
                      patchLevel(
                        `weather: ${w.label}`,
                        w.id === 'storm'
                          ? {
                              weather: 'storm',
                              wind: Math.max(level.wind ?? 0.45, 1.15),
                              cloudDensity: Math.max(level.cloudDensity ?? 0.55, 0.88),
                              stormClouds: true,
                              stormLightning: level.stormLightning ?? true,
                            }
                          : {
                              weather: w.id,
                              stormClouds: level.weather === 'storm' ? undefined : level.stormClouds,
                            },
                        true
                      )
                    }
                    className={`py-1.5 px-1 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-[#7C5CFF] text-white'
                        : 'bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#949BB0] hover:bg-slate-200/80 dark:hover:bg-[#272D3C]'
                    }`}
                  >
                    {w.label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </aside>
  );
};

interface SliderRowProps {
  icon?: React.ReactNode;
  label: string;
  valueText: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}

const SliderRow: React.FC<SliderRowProps> = ({
  icon,
  label,
  valueText,
  min,
  max,
  step,
  value,
  onChange,
}) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between text-xs font-semibold">
      <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-[#C5CBE0]">
        {icon && <span className="text-slate-400 dark:text-[#7E869E]">{icon}</span>}
        <span>{label}</span>
      </span>
      <span className="tabular-nums text-[11px] font-bold text-slate-500 dark:text-[#949BB0]">
        {valueText}
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
