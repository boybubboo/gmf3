import React, { useMemo, useState } from 'react';
import {
  Clock,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudSun,
  Film,
  Moon,
  Mountain,
  Palette,
  Sparkles,
  Sun,
  Trash2,
  Trees,
  Wind,
  Zap,
} from 'lucide-react';
import {
  Biomes,
  SkyPresets,
  VisualStyles,
  VistaPresets,
  VistaPropKinds,
  WeatherOptions,
} from '../../data/registries';
import type { MakerStore } from '../../store/useMakerStore';
import type {
  MoonVisibilityMode,
  StarTintMode,
  VistaPresetId,
  VistaPropItem,
  VistaPropKind,
} from '../../types/maker';
import {
  type AtmosphereSectionId,
  publishGuidanceHint,
} from '../../utils/editorPrefs';
import { useDefaultTreeStyles } from '../../utils/defaultTreeStyles';
import { getEnvironmentType, uid } from '../../utils/terrain';
import { MakerIcon } from '../shared/IconMap';
import { FieldLabel } from '../shared/MakerUI';
import { PostProcessingPanel } from './PostProcessingPanel';

type SkySubTab = 'sun' | 'moonStars' | 'aurora' | 'clouds';

const MOON_COLOR_SWATCHES: { label: string; hex: string }[] = [
  { label: 'Silver', hex: '#DDE8FF' },
  { label: 'Harvest', hex: '#FFE7B3' },
  { label: 'Blood', hex: '#F87171' },
  { label: 'Ice', hex: '#BAE6FD' },
];

const AURORA_PRESETS: { label: string; a: string; b: string }[] = [
  { label: 'Arctic', a: '#34D399', b: '#8B5CF6' },
  { label: 'Polar Cyan', a: '#22D3EE', b: '#3B82F6' },
  { label: 'Magenta', a: '#F472B6', b: '#A855F7' },
  { label: 'Golden Veil', a: '#FBBF24', b: '#10B981' },
];

const CLOUD_COVER_PRESETS: { label: string; density: number; storm?: boolean }[] = [
  { label: 'Clear', density: 0 },
  { label: 'Light', density: 0.3 },
  { label: 'Fluffy', density: 0.58 },
  { label: 'Overcast', density: 0.9 },
  { label: 'Storm', density: 0.95, storm: true },
];

function formatClock(hour: number): string {
  const h = Math.floor(hour) % 24;
  const m = Math.round((hour - Math.floor(hour)) * 60) % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function moonPhaseLabel(phase: number): string {
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.07 || p >= 0.93) return 'New Moon';
  if (p < 0.21) return 'Waxing Crescent';
  if (p < 0.31) return 'First Quarter';
  if (p < 0.44) return 'Waxing Gibbous';
  if (p < 0.57) return 'Full Moon';
  if (p < 0.71) return 'Waning Gibbous';
  if (p < 0.81) return 'Last Quarter';
  return 'Waning Crescent';
}

interface AtmosphereInspectorPanelProps {
  store: MakerStore;
  section: AtmosphereSectionId;
  onAddVistaItem?: (kind: VistaPropKind, customAssetId?: string, customLabel?: string) => void;
}

export const AtmosphereInspectorPanel: React.FC<AtmosphereInspectorPanelProps> = ({
  store,
  section,
  onAddVistaItem,
}) => {
  const { currentLevel } = store;
  const defaultTreePrefs = useDefaultTreeStyles();
  const [skySubTab, setSkySubTab] = useState<SkySubTab>('sun');
  const [vistaCustomAssetId, setVistaCustomAssetId] = useState<string>(
    () => store.customAssets[0]?.id ?? ''
  );

  const activeVistaAssetId = useMemo(() => {
    if (vistaCustomAssetId && store.customAssets.some((a) => a.id === vistaCustomAssetId)) {
      return vistaCustomAssetId;
    }
    return store.customAssets[0]?.id ?? '';
  }, [vistaCustomAssetId, store.customAssets]);

  if (!currentLevel) return null;

  const envType = getEnvironmentType(currentLevel);
  const visualStyle = currentLevel.visualStyle ?? 'soft';
  const timeOfDay =
    currentLevel.timeOfDay !== undefined
      ? currentLevel.timeOfDay
      : currentLevel.sky === 'night' || currentLevel.sky === 'cave'
      ? 23.0
      : currentLevel.sky === 'golden'
      ? 18.0
      : currentLevel.sky === 'mist'
      ? 7.0
      : currentLevel.sky === 'storm'
      ? 15.0
      : 12.2;
  const vistaPreset: VistaPresetId = currentLevel.vistaPreset ?? 'alpineValley';
  const vistaDensity = currentLevel.vistaDensity ?? 0.85;
  const vistaTreeDensity = currentLevel.vistaTreeDensity ?? vistaDensity;
  const vistaMountainScale = currentLevel.vistaMountainScale ?? 1.0;
  const vistaDistance = currentLevel.vistaDistance ?? 0;
  const vistaTreeScale = currentLevel.vistaTreeScale ?? 1.0;
  const vistaHeightFog = currentLevel.vistaHeightFog ?? 1.0;
  const distanceFog = currentLevel.fog ?? 0.25;
  const vistaItems = currentLevel.vistaItems ?? [];
  const vistaMinDist = Math.max(
    envType === 'castle' ? 68 : 155,
    (envType === 'castle' ? 68 : 198) + vistaDistance + 8
  );
  const vistaMaxDist =
    (envType === 'castle' ? 195 : 440) + Math.max(0, vistaDistance) * 1.38;
  const hasSavedDefaultTrees = Object.keys(defaultTreePrefs.species).length > 0;

  const handleAddVista = (kind: VistaPropKind, customAssetId?: string, customLabel?: string) => {
    if (onAddVistaItem) {
      onAddVistaItem(kind, customAssetId, customLabel);
      return;
    }
    const labelMap: Record<VistaPropKind, string> = {
      mountain: 'Distant Peak',
      pineCluster: 'Pine Ridge',
      oakCluster: 'Oak Grove',
      birchCluster: 'Birch Woods',
      boulderRidge: 'Boulder Outcrop',
      castleRuins: 'Castle Ruins',
      custom:
        customLabel ||
        store.customAssets.find((a) => a.id === customAssetId)?.name ||
        'Horizon Landmark',
    };
    const nextItem: VistaPropItem = {
      id: uid(),
      kind,
      name: labelMap[kind],
      angle: Math.round((vistaItems.length * 47 + 28) % 360),
      distance:
        (envType === 'castle'
          ? 92 + (vistaItems.length % 4) * 18
          : 225 + (vistaItems.length % 4) * 32) + Math.max(0, vistaDistance),
      scale: kind === 'mountain' || kind === 'castleRuins' ? 1.45 : 1.15,
      customAssetId,
    };
    store.updateLevel(`place ${nextItem.name} on distant horizon`, (lvl) => ({
      ...lvl,
      vistaItems: [...(lvl.vistaItems ?? []), nextItem],
    }));
  };

  if (section === 'skyTime') {
    const sunVisible = currentLevel.sunVisible ?? true;
    const sunSize = currentLevel.sunSize ?? 1.0;
    const sunGlow = currentLevel.sunGlow ?? 1.0;
    const sunAngle = currentLevel.sunAngle ?? 42;
    const sunIntensityScale = currentLevel.sunIntensityScale ?? 1.0;
    const ambientIntensityScale = currentLevel.ambientIntensityScale ?? 1.0;
    const atmosphereWarmth = currentLevel.atmosphereWarmth ?? 0;

    const moonMode: MoonVisibilityMode = currentLevel.moonMode ?? 'auto';
    const moonPhase = currentLevel.moonPhase ?? 0.5;
    const moonSize = currentLevel.moonSize ?? 1.0;
    const moonGlow = currentLevel.moonGlow ?? 1.0;
    const moonColor = currentLevel.moonColor ?? '#DDE8FF';
    const moonAngle = currentLevel.moonAngle ?? 215;
    const moonElevation = currentLevel.moonElevation ?? 34;

    const starIntensity = currentLevel.starIntensity ?? 1.0;
    const starDensity = currentLevel.starDensity ?? 1.0;
    const starSize = currentLevel.starSize ?? 1.0;
    const starTwinkle = currentLevel.starTwinkle ?? 0.6;
    const starTint: StarTintMode = currentLevel.starTint ?? 'natural';

    const auroraEnabled = currentLevel.auroraEnabled ?? false;
    const auroraIntensity = currentLevel.auroraIntensity ?? 0.9;
    const auroraSpeed = currentLevel.auroraSpeed ?? 0.7;
    const auroraHeight = currentLevel.auroraHeight ?? 0.36;
    const auroraSpread = currentLevel.auroraSpread ?? 0.75;
    const auroraColorA = currentLevel.auroraColorA ?? '#34D399';
    const auroraColorB = currentLevel.auroraColorB ?? '#8B5CF6';

    const cloudDensity = currentLevel.cloudDensity ?? 0.55;
    const cloudSoftness = currentLevel.cloudSoftness ?? 0.72;
    const cloudOpacity = currentLevel.cloudOpacity ?? 0.85;
    const cloudHeight = currentLevel.cloudHeight ?? 0;
    const cloudSpeed = currentLevel.cloudSpeed ?? 1.0;
    const cloudScale = currentLevel.cloudScale ?? 1.0;
    const stormAutoActive = currentLevel.weather === 'storm' || currentLevel.sky === 'storm';
    const stormClouds = currentLevel.stormClouds ?? stormAutoActive;
    const stormIntensity = currentLevel.stormIntensity ?? (stormClouds ? 0.78 : 0.65);
    const stormLightning = currentLevel.stormLightning ?? stormClouds;

    return (
      <div className="space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CloudSun size={16} className="text-[#0EA5E9]" />
            <h2 className="text-sm font-extrabold">Sky, Celestials &amp; Clouds</h2>
          </div>
          <button
            type="button"
            onClick={() => store.setShowingSkybox(true)}
            className="text-[11px] font-bold text-[#0EA5E9] hover:underline whitespace-nowrap"
          >
            Skybox Studio
          </button>
        </div>

        {/* 4-Way Sky Sub-Tab Bar */}
        <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#1B1F2B] border border-slate-200/70 dark:border-white/[0.06]">
          {(
            [
              { id: 'sun', label: 'Sun', Icon: Sun, color: '#F59E0B' },
              { id: 'moonStars', label: 'Moon', Icon: Moon, color: '#818CF8' },
              { id: 'aurora', label: 'Aurora', Icon: Sparkles, color: '#34D399' },
              { id: 'clouds', label: 'Clouds', Icon: Cloud, color: '#38BDF8' },
            ] as const
          ).map((tab) => {
            const active = skySubTab === tab.id;
            const TabIcon = tab.Icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setSkySubTab(tab.id);
                  publishGuidanceHint({
                    badge: 'Sky Controls',
                    title:
                      tab.id === 'sun'
                        ? 'Sun & Time of Day'
                        : tab.id === 'moonStars'
                        ? 'Moon & Starfield'
                        : tab.id === 'aurora'
                        ? 'Aurora Borealis'
                        : 'Clouds & Storm Fronts',
                    detail:
                      tab.id === 'sun'
                        ? 'Sweep the sun across the sky, tune its disc size, halo glow, azimuth, and atmospheric warmth.'
                        : tab.id === 'moonStars'
                        ? 'Adjust lunar phases, moon visibility, color tint, starfield density, size, and twinkle.'
                        : tab.id === 'aurora'
                        ? 'Enable shimmering polar aurora curtains and customize their colors, altitude, and wave speed.'
                        : 'Sculpt cloud density, hi-res edge softness, opacity, altitude, drift speed, and storm clouds.',
                  });
                }}
                className={`flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-white dark:bg-[#272D3E] text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-[#8E96AB] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <TabIcon size={12} style={active ? { color: tab.color } : undefined} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* SUB-TAB 1: SUN & TIME */}
        {skySubTab === 'sun' && (
          <div className="space-y-3.5">
            {/* Sky Presets */}
            <div className="space-y-1.5">
              <FieldLabel text="Sky Mood Presets" />
              <div className="grid grid-cols-3 gap-1.5">
                {SkyPresets.map((s) => {
                  const active = currentLevel.sky === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        store.updateLevel('change sky', (lvl) => ({
                          ...lvl,
                          sky: s.id,
                          timeOfDay: undefined,
                          sunElevation: undefined,
                        }));
                        publishGuidanceHint({
                          badge: 'Sky Preset',
                          title: s.title,
                          detail: `Applied the ${s.title} lighting preset. Slide Sun Clock below to fine-tune the sun arc.`,
                        });
                      }}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-[11px] font-bold border transition-colors whitespace-nowrap ${
                        active
                          ? 'border-[#6D4AFF] bg-[#6D4AFF]/12 text-[#6D4AFF] dark:text-[#C4B5FD]'
                          : 'border-transparent bg-slate-100 dark:bg-[#1F2430] text-slate-700 dark:text-[#C8D0E4]'
                      }`}
                    >
                      <MakerIcon symbol={s.symbol} size={12} color={active ? '#6D4AFF' : s.tint} />
                      <span className="truncate">{s.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time of Day */}
            <div className="space-y-2.5 p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] border border-slate-200/70 dark:border-white/[0.06]">
              <div className="flex items-center justify-between">
                <FieldLabel text="Sun Clock" />
                <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-[#F59E0B] tabular-nums">
                  <Clock size={12} />
                  {currentLevel.timeOfDay !== undefined ? formatClock(timeOfDay) : 'Preset'}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={23.75}
                step={0.25}
                value={timeOfDay}
                data-hint-badge="Sky & Time"
                data-hint-title="Time of Day Slider"
                data-hint-detail="Drag left or right to sweep the sun across sunrise, noon, golden sunset, or starlight night."
                onChange={(e) =>
                  store.updateLevel(
                    'set time of day',
                    (lvl) => ({ ...lvl, timeOfDay: Number(e.target.value) }),
                    false
                  )
                }
                className="w-full accent-[#F59E0B]"
              />
              <div className="flex items-center justify-between text-xs font-semibold pt-0.5">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(currentLevel.autoCycleTime)}
                    onChange={(e) =>
                      store.updateLevel('toggle day night cycle', (lvl) => ({
                        ...lvl,
                        timeOfDay: lvl.timeOfDay ?? 12,
                        autoCycleTime: e.target.checked,
                      }))
                    }
                    className="accent-[#6D4AFF] w-4 h-4"
                  />
                  <span>Auto Day / Night in Play</span>
                </label>
                {currentLevel.timeOfDay !== undefined && (
                  <button
                    type="button"
                    onClick={() =>
                      store.updateLevel('use sky preset time', (lvl) => ({
                        ...lvl,
                        timeOfDay: undefined,
                        autoCycleTime: false,
                      }))
                    }
                    className="text-[#6D4AFF] hover:underline font-bold text-[11px]"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Sun Appearance & Position */}
            <div className="space-y-2.5 p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] border border-slate-200/70 dark:border-white/[0.06]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-slate-800 dark:text-[#E2E8F0]">
                  Sun Disc &amp; Lighting
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={sunVisible}
                  data-hint-badge="Sun Controls"
                  data-hint-title="Show Sun Disc"
                  data-hint-detail="Toggle the visible sun sphere and solar corona in the sky."
                  onClick={() =>
                    store.updateLevel(
                      'toggle sun disc',
                      (lvl) => ({ ...lvl, sunVisible: !(lvl.sunVisible ?? true) }),
                      true
                    )
                  }
                  style={{ backgroundColor: sunVisible ? '#F59E0B' : undefined }}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                    sunVisible ? '' : 'bg-slate-300 dark:bg-[#2C3346]'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                      sunVisible ? 'translate-x-[18px]' : 'translate-x-[3px]'
                    }`}
                  />
                </button>
              </div>

              {sunVisible && (
                <>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-semibold">
                      <span>Sun Size</span>
                      <span className="tabular-nums font-mono text-[10px] text-slate-500 dark:text-[#949BB0]">
                        {Math.round(sunSize * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.4}
                      max={2.4}
                      step={0.05}
                      value={sunSize}
                      data-hint-badge="Sun Controls"
                      data-hint-title="Sun Disc Size"
                      data-hint-detail="Resize the glowing solar orb from a crisp pinpoint to a dramatic cinematic sun."
                      onChange={(e) =>
                        store.updateLevel(
                          'adjust sun size',
                          (lvl) => ({ ...lvl, sunSize: Number(e.target.value) }),
                          false
                        )
                      }
                      className="w-full accent-[#F59E0B]"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-semibold">
                      <span>Solar Corona Glow</span>
                      <span className="tabular-nums font-mono text-[10px] text-slate-500 dark:text-[#949BB0]">
                        {Math.round(sunGlow * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={2.0}
                      step={0.05}
                      value={sunGlow}
                      data-hint-badge="Sun Controls"
                      data-hint-title="Solar Corona Glow"
                      data-hint-detail="Controls the soft atmospheric halo scattering around the sun."
                      onChange={(e) =>
                        store.updateLevel(
                          'adjust sun glow',
                          (lvl) => ({ ...lvl, sunGlow: Number(e.target.value) }),
                          false
                        )
                      }
                      className="w-full accent-[#F59E0B]"
                    />
                  </div>
                </>
              )}

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-semibold">
                  <span>Sun Compass Angle</span>
                  <span className="tabular-nums font-mono text-[10px] text-slate-500 dark:text-[#949BB0]">
                    {Math.round(sunAngle)}°
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={2}
                  value={sunAngle}
                  data-hint-badge="Sun Controls"
                  data-hint-title="Sun Azimuth"
                  data-hint-detail="Rotates the sun and shadows smoothly around the 360° horizon."
                  onChange={(e) =>
                    store.updateLevel(
                      'adjust sun azimuth',
                      (lvl) => ({ ...lvl, sunAngle: Number(e.target.value) }),
                      false
                    )
                  }
                  className="w-full accent-[#F59E0B]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-semibold">
                  <span>Sun Elevation</span>
                  <div className="flex items-center gap-1.5">
                    <span className="tabular-nums font-mono text-[10px] text-slate-500 dark:text-[#949BB0]">
                      {currentLevel.sunElevation !== undefined
                        ? `${Math.round(currentLevel.sunElevation)}°`
                        : 'Clock Auto'}
                    </span>
                    {currentLevel.sunElevation !== undefined && (
                      <button
                        type="button"
                        onClick={() =>
                          store.updateLevel('reset sun elevation', (lvl) => ({
                            ...lvl,
                            sunElevation: undefined,
                          }))
                        }
                        className="text-[10px] font-bold text-[#F59E0B] hover:underline"
                      >
                        Auto
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="range"
                  min={-12}
                  max={85}
                  step={1}
                  value={currentLevel.sunElevation ?? 38}
                  data-hint-badge="Sun Controls"
                  data-hint-title="Sun Elevation Override"
                  data-hint-detail="Manually raise or dip the sun above or below the horizon independently of the clock."
                  onChange={(e) =>
                    store.updateLevel(
                      'adjust sun elevation',
                      (lvl) => ({ ...lvl, sunElevation: Number(e.target.value) }),
                      false
                    )
                  }
                  className="w-full accent-[#F59E0B]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-semibold">
                  <span>Sunlight Intensity</span>
                  <span className="tabular-nums font-mono text-[10px] text-slate-500 dark:text-[#949BB0]">
                    {Math.round(sunIntensityScale * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.3}
                  max={1.8}
                  step={0.05}
                  value={sunIntensityScale}
                  onChange={(e) =>
                    store.updateLevel(
                      'adjust sun intensity',
                      (lvl) => ({ ...lvl, sunIntensityScale: Number(e.target.value) }),
                      false
                    )
                  }
                  className="w-full accent-[#F59E0B]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-semibold">
                  <span>Ambient Sky Fill</span>
                  <span className="tabular-nums font-mono text-[10px] text-slate-500 dark:text-[#949BB0]">
                    {Math.round(ambientIntensityScale * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.3}
                  max={1.8}
                  step={0.05}
                  value={ambientIntensityScale}
                  onChange={(e) =>
                    store.updateLevel(
                      'adjust ambient fill',
                      (lvl) => ({ ...lvl, ambientIntensityScale: Number(e.target.value) }),
                      false
                    )
                  }
                  className="w-full accent-[#F59E0B]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-semibold">
                  <span>Horizon Warmth</span>
                  <span className="tabular-nums font-mono text-[10px] text-slate-500 dark:text-[#949BB0]">
                    {atmosphereWarmth > 0.02
                      ? `+${Math.round(atmosphereWarmth * 100)}`
                      : atmosphereWarmth < -0.02
                      ? `${Math.round(atmosphereWarmth * 100)}`
                      : 'Neutral'}
                  </span>
                </div>
                <input
                  type="range"
                  min={-0.5}
                  max={0.5}
                  step={0.02}
                  value={atmosphereWarmth}
                  onChange={(e) =>
                    store.updateLevel(
                      'adjust horizon warmth',
                      (lvl) => ({ ...lvl, atmosphereWarmth: Number(e.target.value) }),
                      false
                    )
                  }
                  className="w-full accent-[#F59E0B]"
                />
              </div>
            </div>
          </div>
        )}

        {/* SUB-TAB 2: MOON & STARS */}
        {skySubTab === 'moonStars' && (
          <div className="space-y-3.5">
            {/* Moon Controls */}
            <div className="space-y-2.5 p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] border border-slate-200/70 dark:border-white/[0.06]">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-800 dark:text-[#E2E8F0]">
                  <Moon size={13} className="text-[#818CF8]" />
                  <span>Moon Controls</span>
                </span>
                <span className="text-[10.5px] font-bold text-[#818CF8]">
                  {moonPhaseLabel(moonPhase)}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    { id: 'auto', label: 'Auto Night' },
                    { id: 'always', label: 'Always' },
                    { id: 'off', label: 'Off' },
                  ] as { id: MoonVisibilityMode; label: string }[]
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      store.updateLevel('set moon visibility', (lvl) => ({
                        ...lvl,
                        moonMode: m.id,
                      }))
                    }
                    className={`py-1.5 px-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors ${
                      moonMode === m.id
                        ? 'bg-[#6366F1] text-white'
                        : 'bg-white dark:bg-[#171B26] text-slate-600 dark:text-[#949BB0]'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {moonMode !== 'off' && (
                <div className="space-y-2.5 pt-1">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-semibold">
                      <span>Lunar Phase</span>
                      <span className="tabular-nums font-mono text-[10px] text-slate-500 dark:text-[#949BB0]">
                        {Math.round(moonPhase * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={moonPhase}
                      data-hint-badge="Moon Controls"
                      data-hint-title="Lunar Phase"
                      data-hint-detail="Sweep from New Moon through Crescent, Quarter, Gibbous, and Full Moon."
                      onChange={(e) =>
                        store.updateLevel(
                          'adjust moon phase',
                          (lvl) => ({ ...lvl, moonPhase: Number(e.target.value) }),
                          false
                        )
                      }
                      className="w-full accent-[#818CF8]"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-semibold">
                      <span>Moon Size</span>
                      <span className="tabular-nums font-mono text-[10px] text-slate-500 dark:text-[#949BB0]">
                        {Math.round(moonSize * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.4}
                      max={2.6}
                      step={0.05}
                      value={moonSize}
                      onChange={(e) =>
                        store.updateLevel(
                          'adjust moon size',
                          (lvl) => ({ ...lvl, moonSize: Number(e.target.value) }),
                          false
                        )
                      }
                      className="w-full accent-[#818CF8]"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-semibold">
                      <span>Lunar Halo Glow</span>
                      <span className="tabular-nums font-mono text-[10px] text-slate-500 dark:text-[#949BB0]">
                        {Math.round(moonGlow * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={2.0}
                      step={0.05}
                      value={moonGlow}
                      onChange={(e) =>
                        store.updateLevel(
                          'adjust moon glow',
                          (lvl) => ({ ...lvl, moonGlow: Number(e.target.value) }),
                          false
                        )
                      }
                      className="w-full accent-[#818CF8]"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-semibold">
                      <span>Moon Azimuth</span>
                      <span className="tabular-nums font-mono text-[10px] text-slate-500 dark:text-[#949BB0]">
                        {Math.round(moonAngle)}°
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={360}
                      step={2}
                      value={moonAngle}
                      onChange={(e) =>
                        store.updateLevel(
                          'adjust moon azimuth',
                          (lvl) => ({ ...lvl, moonAngle: Number(e.target.value) }),
                          false
                        )
                      }
                      className="w-full accent-[#818CF8]"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-semibold">
                      <span>Moon Elevation</span>
                      <span className="tabular-nums font-mono text-[10px] text-slate-500 dark:text-[#949BB0]">
                        {Math.round(moonElevation)}°
                      </span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={80}
                      step={1}
                      value={moonElevation}
                      onChange={(e) =>
                        store.updateLevel(
                          'adjust moon elevation',
                          (lvl) => ({ ...lvl, moonElevation: Number(e.target.value) }),
                          false
                        )
                      }
                      className="w-full accent-[#818CF8]"
                    />
                  </div>

                  <div className="space-y-1.5 pt-0.5">
                    <div className="flex items-center justify-between text-[11px] font-semibold">
                      <span>Moon Tint</span>
                      <input
                        type="color"
                        value={moonColor}
                        onChange={(e) =>
                          store.updateLevel(
                            'set moon color',
                            (lvl) => ({ ...lvl, moonColor: e.target.value }),
                            false
                          )
                        }
                        className="w-6 h-5 rounded border border-slate-300 dark:border-white/15 bg-transparent cursor-pointer"
                      />
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {MOON_COLOR_SWATCHES.map((sw) => (
                        <button
                          key={sw.label}
                          type="button"
                          onClick={() =>
                            store.updateLevel('set moon tint', (lvl) => ({
                              ...lvl,
                              moonColor: sw.hex,
                            }))
                          }
                          className={`flex items-center justify-center gap-1 py-1 px-1 rounded-lg text-[10px] font-bold border whitespace-nowrap ${
                            moonColor.toLowerCase() === sw.hex.toLowerCase()
                              ? 'border-[#818CF8] bg-[#818CF8]/15 text-[#6366F1] dark:text-[#C7D2FE]'
                              : 'border-transparent bg-white dark:bg-[#171B26] text-slate-600 dark:text-[#949BB0]'
                          }`}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/15"
                            style={{ backgroundColor: sw.hex }}
                          />
                          <span>{sw.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Starfield Controls */}
            <div className="space-y-2.5 p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] border border-slate-200/70 dark:border-white/[0.06]">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-800 dark:text-[#E2E8F0]">
                  <Sparkles size={13} className="text-[#38BDF8]" />
                  <span>Starfield Controls</span>
                </span>
                <span className="tabular-nums font-mono text-[10px] text-slate-500 dark:text-[#949BB0]">
                  {Math.round(starIntensity * 100)}%
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-semibold">
                  <span>Star Brightness</span>
                  <span className="tabular-nums font-mono text-[10px] text-slate-500 dark:text-[#949BB0]">
                    {Math.round(starIntensity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1.5}
                  step={0.05}
                  value={starIntensity}
                  data-hint-badge="Star Controls"
                  data-hint-title="Starfield Brightness"
                  data-hint-detail="Brighten or dim the night sky starfield. Tip: switch Time of Day toward dusk or night to see stars shine."
                  onChange={(e) =>
                    store.updateLevel(
                      'adjust star brightness',
                      (lvl) => ({ ...lvl, starIntensity: Number(e.target.value) }),
                      false
                    )
                  }
                  className="w-full accent-[#38BDF8]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-semibold">
                  <span>Star Density</span>
                  <span className="tabular-nums font-mono text-[10px] text-slate-500 dark:text-[#949BB0]">
                    {Math.round(starDensity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={1.5}
                  step={0.05}
                  value={starDensity}
                  onChange={(e) =>
                    store.updateLevel(
                      'adjust star density',
                      (lvl) => ({ ...lvl, starDensity: Number(e.target.value) }),
                      false
                    )
                  }
                  className="w-full accent-[#38BDF8]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-semibold">
                  <span>Star Size</span>
                  <span className="tabular-nums font-mono text-[10px] text-slate-500 dark:text-[#949BB0]">
                    {Math.round(starSize * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.4}
                  max={2.4}
                  step={0.05}
                  value={starSize}
                  onChange={(e) =>
                    store.updateLevel(
                      'adjust star size',
                      (lvl) => ({ ...lvl, starSize: Number(e.target.value) }),
                      false
                    )
                  }
                  className="w-full accent-[#38BDF8]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-semibold">
                  <span>Twinkle Shimmer</span>
                  <span className="tabular-nums font-mono text-[10px] text-slate-500 dark:text-[#949BB0]">
                    {Math.round(starTwinkle * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={2.0}
                  step={0.05}
                  value={starTwinkle}
                  onChange={(e) =>
                    store.updateLevel(
                      'adjust star twinkle',
                      (lvl) => ({ ...lvl, starTwinkle: Number(e.target.value) }),
                      false
                    )
                  }
                  className="w-full accent-[#38BDF8]"
                />
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-semibold">Star Color Tint</span>
                <div className="grid grid-cols-3 gap-1">
                  {(
                    [
                      { id: 'natural', label: 'Natural' },
                      { id: 'cool', label: 'Cool Blue' },
                      { id: 'warm', label: 'Warm Gold' },
                    ] as { id: StarTintMode; label: string }[]
                  ).map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() =>
                        store.updateLevel('set star tint', (lvl) => ({ ...lvl, starTint: st.id }))
                      }
                      className={`py-1.5 px-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors ${
                        starTint === st.id
                          ? 'bg-[#0EA5E9] text-white'
                          : 'bg-white dark:bg-[#171B26] text-slate-600 dark:text-[#949BB0]'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUB-TAB 3: AURORA BOREALIS */}
        {skySubTab === 'aurora' && (
          <div className="space-y-3.5">
            <div className="space-y-3 p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] border border-slate-200/70 dark:border-white/[0.06]">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-800 dark:text-[#E2E8F0]">
                  <Sparkles size={13} className="text-[#34D399]" />
                  <span>Aurora Borealis</span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={auroraEnabled}
                  data-hint-badge="Aurora Borealis"
                  data-hint-title="Toggle Northern Lights"
                  data-hint-detail="Activate shimmering ribbons of aurora light drifting high across the sky dome."
                  onClick={() =>
                    store.updateLevel(
                      'toggle aurora borealis',
                      (lvl) => ({ ...lvl, auroraEnabled: !(lvl.auroraEnabled ?? false) }),
                      true
                    )
                  }
                  style={{ backgroundColor: auroraEnabled ? '#10B981' : undefined }}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                    auroraEnabled ? '' : 'bg-slate-300 dark:bg-[#2C3346]'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                      auroraEnabled ? 'translate-x-[18px]' : 'translate-x-[3px]'
                    }`}
                  />
                </button>
              </div>

              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-600 dark:text-[#949BB0]">
                  Quick Palettes
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {AURORA_PRESETS.map((ap) => {
                    const active =
                      auroraEnabled &&
                      auroraColorA.toLowerCase() === ap.a.toLowerCase() &&
                      auroraColorB.toLowerCase() === ap.b.toLowerCase();
                    return (
                      <button
                        key={ap.label}
                        type="button"
                        onClick={() =>
                          store.updateLevel(`aurora preset: ${ap.label}`, (lvl) => ({
                            ...lvl,
                            auroraEnabled: true,
                            auroraColorA: ap.a,
                            auroraColorB: ap.b,
                          }))
                        }
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-colors whitespace-nowrap ${
                          active
                            ? 'border-[#10B981] bg-[#10B981]/15 text-[#047857] dark:text-[#6EE7B7]'
                            : 'border-transparent bg-white dark:bg-[#171B26] text-slate-700 dark:text-[#C8D0E4]'
                        }`}
                      >
                        <span
                          className="w-4 h-3 rounded-full shrink-0"
                          style={{
                            background: `linear-gradient(90deg, ${ap.a}, ${ap.b})`,
                          }}
                        />
                        <span className="truncate">{ap.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {auroraEnabled && (
                <div className="space-y-2.5 pt-1">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center justify-between px-2 py-1.5 rounded-xl bg-white dark:bg-[#171B26] text-[11px] font-semibold">
                      <span>Lower Edge</span>
                      <input
                        type="color"
                        value={auroraColorA}
                        onChange={(e) =>
                          store.updateLevel(
                            'aurora lower color',
                            (lvl) => ({ ...lvl, auroraColorA: e.target.value }),
                            false
                          )
                        }
                        className="w-6 h-5 rounded border-0 bg-transparent cursor-pointer"
                      />
                    </label>
                    <label className="flex items-center justify-between px-2 py-1.5 rounded-xl bg-white dark:bg-[#171B26] text-[11px] font-semibold">
                      <span>Upper Crown</span>
                      <input
                        type="color"
                        value={auroraColorB}
                        onChange={(e) =>
                          store.updateLevel(
                            'aurora upper color',
                            (lvl) => ({ ...lvl, auroraColorB: e.target.value }),
                            false
                          )
                        }
                        className="w-6 h-5 rounded border-0 bg-transparent cursor-pointer"
                      />
                    </label>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-semibold">
                      <span>Ribbon Intensity</span>
                      <span className="tabular-nums font-mono text-[10px] text-slate-500 dark:text-[#949BB0]">
                        {Math.round(auroraIntensity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={2.0}
                      step={0.05}
                      value={auroraIntensity}
                      onChange={(e) =>
                        store.updateLevel(
                          'adjust aurora intensity',
                          (lvl) => ({ ...lvl, auroraIntensity: Number(e.target.value) }),
                          false
                        )
                      }
                      className="w-full accent-[#10B981]"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-semibold">
                      <span>Curtain Wave Speed</span>
                      <span className="tabular-nums font-mono text-[10px] text-slate-500 dark:text-[#949BB0]">
                        {Math.round(auroraSpeed * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={2.5}
                      step={0.05}
                      value={auroraSpeed}
                      onChange={(e) =>
                        store.updateLevel(
                          'adjust aurora speed',
                          (lvl) => ({ ...lvl, auroraSpeed: Number(e.target.value) }),
                          false
                        )
                      }
                      className="w-full accent-[#10B981]"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-semibold">
                      <span>Sky Altitude</span>
                      <span className="tabular-nums font-mono text-[10px] text-slate-500 dark:text-[#949BB0]">
                        {Math.round(auroraHeight * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.12}
                      max={0.75}
                      step={0.01}
                      value={auroraHeight}
                      onChange={(e) =>
                        store.updateLevel(
                          'adjust aurora altitude',
                          (lvl) => ({ ...lvl, auroraHeight: Number(e.target.value) }),
                          false
                        )
                      }
                      className="w-full accent-[#10B981]"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-semibold">
                      <span>Curtain Spread</span>
                      <span className="tabular-nums font-mono text-[10px] text-slate-500 dark:text-[#949BB0]">
                        {Math.round(auroraSpread * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.2}
                      max={1.5}
                      step={0.05}
                      value={auroraSpread}
                      onChange={(e) =>
                        store.updateLevel(
                          'adjust aurora spread',
                          (lvl) => ({ ...lvl, auroraSpread: Number(e.target.value) }),
                          false
                        )
                      }
                      className="w-full accent-[#10B981]"
                    />
                  </div>
                </div>
              )}

              {auroraEnabled && timeOfDay > 7 && timeOfDay < 17.5 && (
                <button
                  type="button"
                  onClick={() =>
                    store.updateLevel('set night sky for aurora', (lvl) => ({
                      ...lvl,
                      sky: 'night',
                      timeOfDay: 23.0,
                    }))
                  }
                  className="w-full py-1.5 px-2.5 rounded-xl bg-[#10B981]/15 text-[#047857] dark:text-[#6EE7B7] text-[11px] font-bold hover:bg-[#10B981]/25 transition-colors"
                >
                  Switch to Night Sky to Highlight Aurora
                </button>
              )}
            </div>
          </div>
        )}

        {/* SUB-TAB 4: CLOUDS & STORM FRONTS */}
        {skySubTab === 'clouds' && (
          <div className="space-y-3.5">
            <div className="space-y-2.5 p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] border border-slate-200/70 dark:border-white/[0.06]">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-800 dark:text-[#E2E8F0]">
                  <Cloud size={13} className="text-[#38BDF8]" />
                  <span>Cloud Layer Sculpting</span>
                </span>
                <span className="tabular-nums font-mono text-[10px] text-[#38BDF8] font-bold">
                  {Math.round(cloudDensity * 100)}%
                </span>
              </div>

              <div className="grid grid-cols-5 gap-1">
                {CLOUD_COVER_PRESETS.map((cp) => {
                  const active =
                    Math.abs(cloudDensity - cp.density) < 0.08 &&
                    Boolean(cp.storm) === Boolean(stormClouds);
                  return (
                    <button
                      key={cp.label}
                      type="button"
                      onClick={() =>
                        store.updateLevel(`cloud preset: ${cp.label}`, (lvl) => ({
                          ...lvl,
                          cloudDensity: cp.density,
                          stormClouds: cp.storm ? true : false,
                          stormLightning: cp.storm ? true : lvl.stormLightning,
                        }))
                      }
                      className={`py-1.5 px-1 rounded-lg text-[10.5px] font-bold whitespace-nowrap transition-colors ${
                        active
                          ? 'bg-[#0EA5E9] text-white'
                          : 'bg-white dark:bg-[#171B26] text-slate-600 dark:text-[#949BB0]'
                      }`}
                    >
                      {cp.label}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-semibold">
                  <span>Cloud Cover Density</span>
                  <span className="tabular-nums font-mono text-[10px] text-slate-500 dark:text-[#949BB0]">
                    {Math.round(cloudDensity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={cloudDensity}
                  data-hint-badge="Cloud Controls"
                  data-hint-title="Cloud Cover Density"
                  data-hint-detail="Controls how much of the sky is filled with both wispy sky-dome clouds and 3D volumetric cloud clusters."
                  onChange={(e) =>
                    store.updateLevel(
                      'adjust cloud density',
                      (lvl) => ({ ...lvl, cloudDensity: Number(e.target.value) }),
                      false
                    )
                  }
                  className="w-full accent-[#38BDF8]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-semibold">
                  <span>Edge Softness (Hi-Res Feather)</span>
                  <span className="tabular-nums font-mono text-[10px] text-slate-500 dark:text-[#949BB0]">
                    {Math.round(cloudSoftness * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={cloudSoftness}
                  data-hint-badge="Cloud Controls"
                  data-hint-title="Cloud Edge Softness"
                  data-hint-detail="Blends smooth multi-octave wispy fringes so cloud borders dissolve gently into the sky."
                  onChange={(e) =>
                    store.updateLevel(
                      'adjust cloud softness',
                      (lvl) => ({ ...lvl, cloudSoftness: Number(e.target.value) }),
                      false
                    )
                  }
                  className="w-full accent-[#38BDF8]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-semibold">
                  <span>Cloud Opacity</span>
                  <span className="tabular-nums font-mono text-[10px] text-slate-500 dark:text-[#949BB0]">
                    {Math.round(cloudOpacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={cloudOpacity}
                  data-hint-badge="Cloud Controls"
                  data-hint-title="Cloud Opacity"
                  data-hint-detail="Sets how sheer or dense the clouds appear against the sky gradient and stars."
                  onChange={(e) =>
                    store.updateLevel(
                      'adjust cloud opacity',
                      (lvl) => ({ ...lvl, cloudOpacity: Number(e.target.value) }),
                      false
                    )
                  }
                  className="w-full accent-[#38BDF8]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-semibold">
                  <span>Cloud Altitude / Height</span>
                  <span className="tabular-nums font-mono text-[10px] text-slate-500 dark:text-[#949BB0]">
                    {cloudHeight >= 0 ? `+${Math.round(cloudHeight)}m` : `${Math.round(cloudHeight)}m`}
                  </span>
                </div>
                <input
                  type="range"
                  min={-20}
                  max={60}
                  step={1}
                  value={cloudHeight}
                  data-hint-badge="Cloud Controls"
                  data-hint-title="Cloud Altitude"
                  data-hint-detail="Lowers clouds close to mountain peaks or lifts them high into the upper atmosphere."
                  onChange={(e) =>
                    store.updateLevel(
                      'adjust cloud height',
                      (lvl) => ({ ...lvl, cloudHeight: Number(e.target.value) }),
                      false
                    )
                  }
                  className="w-full accent-[#38BDF8]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-semibold">
                  <span>Cloud Drift Speed</span>
                  <span className="tabular-nums font-mono text-[10px] text-slate-500 dark:text-[#949BB0]">
                    {Math.round(cloudSpeed * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={3.0}
                  step={0.05}
                  value={cloudSpeed}
                  data-hint-badge="Cloud Controls"
                  data-hint-title="Cloud Drift Speed"
                  data-hint-detail="Controls how slowly or briskly clouds glide across the sky."
                  onChange={(e) =>
                    store.updateLevel(
                      'adjust cloud speed',
                      (lvl) => ({ ...lvl, cloudSpeed: Number(e.target.value) }),
                      false
                    )
                  }
                  className="w-full accent-[#38BDF8]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-semibold">
                  <span>Cloud Scale</span>
                  <span className="tabular-nums font-mono text-[10px] text-slate-500 dark:text-[#949BB0]">
                    {Math.round(cloudScale * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={2.0}
                  step={0.05}
                  value={cloudScale}
                  onChange={(e) =>
                    store.updateLevel(
                      'adjust cloud scale',
                      (lvl) => ({ ...lvl, cloudScale: Number(e.target.value) }),
                      false
                    )
                  }
                  className="w-full accent-[#38BDF8]"
                />
              </div>
            </div>

            {/* Storm Clouds Card */}
            <div className="space-y-2.5 p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] border border-slate-200/70 dark:border-white/[0.06]">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-800 dark:text-[#E2E8F0]">
                    <CloudLightning size={13} className="text-[#6366F1]" />
                    <span>Storm Clouds</span>
                  </div>
                  {stormAutoActive && currentLevel.stormClouds === undefined && (
                    <div className="text-[10px] font-semibold text-[#6366F1] dark:text-[#A5B4FC]">
                      Auto-enabled by Stormy weather
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={stormClouds}
                  onClick={() =>
                    store.updateLevel(
                      'toggle storm clouds',
                      (lvl) => ({ ...lvl, stormClouds: !stormClouds }),
                      true
                    )
                  }
                  style={{ backgroundColor: stormClouds ? '#6366F1' : undefined }}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                    stormClouds ? '' : 'bg-slate-300 dark:bg-[#2C3346]'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                      stormClouds ? 'translate-x-[18px]' : 'translate-x-[3px]'
                    }`}
                  />
                </button>
              </div>

              {stormClouds && (
                <div className="space-y-2.5 pt-0.5">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-semibold">
                      <span>Storm Darkness &amp; Build</span>
                      <span className="tabular-nums font-mono text-[10px] text-slate-500 dark:text-[#949BB0]">
                        {Math.round(stormIntensity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.02}
                      value={stormIntensity}
                      onChange={(e) =>
                        store.updateLevel(
                          'adjust storm intensity',
                          (lvl) => ({ ...lvl, stormIntensity: Number(e.target.value) }),
                          false
                        )
                      }
                      className="w-full accent-[#6366F1]"
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-semibold">
                    <span className="inline-flex items-center gap-1.5">
                      <Zap size={12} className="text-[#F59E0B]" />
                      <span>Cloud Sheet Lightning</span>
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={stormLightning}
                      onClick={() =>
                        store.updateLevel(
                          'toggle storm lightning',
                          (lvl) => ({ ...lvl, stormLightning: !stormLightning }),
                          true
                        )
                      }
                      style={{ backgroundColor: stormLightning ? '#F59E0B' : undefined }}
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                        stormLightning ? '' : 'bg-slate-300 dark:bg-[#2C3346]'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                          stormLightning ? 'translate-x-[18px]' : 'translate-x-[3px]'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (section === 'fogMist') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <CloudFog size={16} className="text-[#38BDF8]" />
          <h2 className="text-sm font-extrabold">Fog &amp; Ground Mist</h2>
        </div>

        {/* Distance Fog & Atmospheric Haze */}
        <div className="space-y-2.5 p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] border border-slate-200/70 dark:border-white/[0.06]">
          <FieldLabel text="Distance Fog &amp; Horizon Haze" />
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-semibold">
              <span>Distance fog depth</span>
              <span className="tabular-nums text-slate-500 dark:text-[#949BB0]">
                {Math.round(distanceFog * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={distanceFog}
              data-hint-badge="Fog & Mist"
              data-hint-title="Distance Fog Depth"
              data-hint-detail="Slide right to blend far hills and horizon silhouettes smoothly into the sky color."
              onChange={(e) =>
                store.updateLevel(
                  'adjust distance fog',
                  (lvl) => ({ ...lvl, fog: Number(e.target.value) }),
                  false
                )
              }
              className="w-full accent-[#38BDF8]"
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-semibold">
              <span>Valley &amp; horizon mist</span>
              <span className="tabular-nums text-slate-500 dark:text-[#949BB0]">
                {Math.round(vistaHeightFog * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={2}
              step={0.05}
              value={vistaHeightFog}
              data-hint-badge="Fog & Mist"
              data-hint-title="Valley & Horizon Mist"
              data-hint-detail="Fills low-lying distant valleys around your world with atmospheric haze."
              onChange={(e) =>
                store.updateLevel(
                  'adjust horizon valley mist',
                  (lvl) => ({ ...lvl, vistaHeightFog: Number(e.target.value) }),
                  false
                )
              }
              className="w-full accent-[#38BDF8]"
            />
          </div>
        </div>

        {/* Rolling Low-Lying Ground Mist */}
        <div className="space-y-3 p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] border border-slate-200/70 dark:border-white/[0.06]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-extrabold text-slate-800 dark:text-[#E2E8F0]">
              Rolling Valley Mist
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={currentLevel.volumetricFogEnabled ?? true}
              data-hint-badge="Ground Mist"
              data-hint-title="Rolling Valley Mist"
              data-hint-detail="Turn organic low-hanging ground mist on or off, then tune its spread, edge softness, and drift below."
              onClick={() =>
                store.updateLevel(
                  'toggle volumetric fog',
                  (lvl) => ({ ...lvl, volumetricFogEnabled: !(lvl.volumetricFogEnabled ?? true) }),
                  true
                )
              }
              style={{
                backgroundColor: (currentLevel.volumetricFogEnabled ?? true) ? '#38BDF8' : undefined,
              }}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                (currentLevel.volumetricFogEnabled ?? true) ? '' : 'bg-slate-300 dark:bg-[#2C3346]'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                  (currentLevel.volumetricFogEnabled ?? true)
                    ? 'translate-x-[18px]'
                    : 'translate-x-[3px]'
                }`}
              />
            </button>
          </div>

          {(currentLevel.volumetricFogEnabled ?? true) && (
            <div className="space-y-2.5 pt-1">
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-semibold">
                  <span>Mist Density</span>
                  <span className="tabular-nums font-mono text-[10px] text-slate-500 dark:text-[#949BB0]">
                    {Math.round((currentLevel.volumetricFogDensity ?? 1.0) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={2.5}
                  step={0.05}
                  value={currentLevel.volumetricFogDensity ?? 1.0}
                  data-hint-badge="Ground Mist"
                  data-hint-title="Mist Density"
                  data-hint-detail="Controls how thick or sheer the low-lying mist looks across the terrain."
                  onChange={(e) =>
                    store.updateLevel(
                      'adjust volumetric fog density',
                      (lvl) => ({ ...lvl, volumetricFogDensity: Number(e.target.value) }),
                      false
                    )
                  }
                  className="w-full accent-[#38BDF8]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-semibold">
                  <span>Mist Elevation</span>
                  <span className="tabular-nums font-mono text-[10px] text-slate-500 dark:text-[#949BB0]">
                    {(currentLevel.volumetricFogHeight !== undefined
                      ? currentLevel.volumetricFogHeight
                      : 2.2
                    ).toFixed(1)}
                    m
                  </span>
                </div>
                <input
                  type="range"
                  min={-4}
                  max={20}
                  step={0.5}
                  value={
                    currentLevel.volumetricFogHeight !== undefined
                      ? currentLevel.volumetricFogHeight
                      : 2.2
                  }
                  data-hint-badge="Ground Mist"
                  data-hint-title="Mist Elevation"
                  data-hint-detail="Raises or lowers the height ceiling where low-hanging mist settles in valleys."
                  onChange={(e) =>
                    store.updateLevel(
                      'adjust mist elevation',
                      (lvl) => ({ ...lvl, volumetricFogHeight: Number(e.target.value) }),
                      false
                    )
                  }
                  className="w-full accent-[#38BDF8]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-semibold">
                  <span>Edge Spread (Transition)</span>
                  <span className="tabular-nums font-mono text-[10px] text-slate-500 dark:text-[#949BB0]">
                    {(currentLevel.volumetricFogSoftness ?? 8.5).toFixed(1)}m
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={25}
                  step={0.5}
                  value={currentLevel.volumetricFogSoftness ?? 8.5}
                  data-hint-badge="Ground Mist"
                  data-hint-title="Edge Spread (Transition)"
                  data-hint-detail="Widens the vertical fade band between misty valleys and clear mountain air."
                  onChange={(e) =>
                    store.updateLevel(
                      'adjust fog spread',
                      (lvl) => ({ ...lvl, volumetricFogSoftness: Number(e.target.value) }),
                      false
                    )
                  }
                  className="w-full accent-[#38BDF8]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-semibold">
                  <span>Edge Blur &harr; Crispness</span>
                  <span className="tabular-nums font-mono text-[10px] text-slate-500 dark:text-[#949BB0]">
                    {Math.round((currentLevel.volumetricFogSharpness ?? 0.3) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1.0}
                  step={0.05}
                  value={currentLevel.volumetricFogSharpness ?? 0.3}
                  data-hint-badge="Ground Mist"
                  data-hint-title="Edge Blur & Crispness"
                  data-hint-detail="Slide left for feathery soft mist transitions or right for denser cloud-bank contours."
                  onChange={(e) =>
                    store.updateLevel(
                      'adjust fog edge sharpness',
                      (lvl) => ({ ...lvl, volumetricFogSharpness: Number(e.target.value) }),
                      false
                    )
                  }
                  className="w-full accent-[#38BDF8]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-semibold">
                  <span>Noise Breakup &amp; Undulation</span>
                  <span className="tabular-nums font-mono text-[10px] text-slate-500 dark:text-[#949BB0]">
                    {Math.round((currentLevel.volumetricFogNoise ?? 0.95) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={2.0}
                  step={0.05}
                  value={currentLevel.volumetricFogNoise ?? 0.95}
                  data-hint-badge="Ground Mist"
                  data-hint-title="Noise Breakup"
                  data-hint-detail="Adds organic ripples and natural uneven edges so mist never forms a flat stripe."
                  onChange={(e) =>
                    store.updateLevel(
                      'adjust fog noise',
                      (lvl) => ({ ...lvl, volumetricFogNoise: Number(e.target.value) }),
                      false
                    )
                  }
                  className="w-full accent-[#38BDF8]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-semibold">
                  <span>Patch Separation (Fog Banks)</span>
                  <span className="tabular-nums font-mono text-[10px] text-slate-500 dark:text-[#949BB0]">
                    {Math.round((currentLevel.volumetricFogPatchiness ?? 0.45) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1.0}
                  step={0.05}
                  value={currentLevel.volumetricFogPatchiness ?? 0.45}
                  data-hint-badge="Ground Mist"
                  data-hint-title="Patch Separation"
                  data-hint-detail="Breaks continuous fog into drifting isolated mist pockets with clear spaces in between."
                  onChange={(e) =>
                    store.updateLevel(
                      'adjust fog patchiness',
                      (lvl) => ({ ...lvl, volumetricFogPatchiness: Number(e.target.value) }),
                      false
                    )
                  }
                  className="w-full accent-[#38BDF8]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-semibold">
                  <span>Slow Drift Speed</span>
                  <span className="tabular-nums font-mono text-[10px] text-slate-500 dark:text-[#949BB0]">
                    {Math.round((currentLevel.volumetricFogSpeed ?? 0.75) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={3.0}
                  step={0.05}
                  value={currentLevel.volumetricFogSpeed ?? 0.75}
                  data-hint-badge="Ground Mist"
                  data-hint-title="Mist Drift Speed"
                  data-hint-detail="Sets how slowly or briskly the mist wisps and patches roll across the ground."
                  onChange={(e) =>
                    store.updateLevel(
                      'adjust fog speed',
                      (lvl) => ({ ...lvl, volumetricFogSpeed: Number(e.target.value) }),
                      false
                    )
                  }
                  className="w-full accent-[#38BDF8]"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (section === 'weatherWind') {
    const stormActive =
      currentLevel.stormClouds ?? (currentLevel.weather === 'storm' || currentLevel.sky === 'storm');
    const stormIntensity = currentLevel.stormIntensity ?? 0.8;
    const stormLightning = currentLevel.stormLightning ?? stormActive;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Wind size={16} className="text-[#0EA5E9]" />
          <h2 className="text-sm font-extrabold">Weather &amp; Wind</h2>
        </div>

        <div className="space-y-2">
          <FieldLabel text="Weather Condition" />
          <div className="grid grid-cols-2 gap-1.5">
            {WeatherOptions.map((w) => {
              const active = currentLevel.weather === w.id;
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => {
                    store.updateLevel('change weather', (lvl) => {
                      if (w.id === 'storm') {
                        return {
                          ...lvl,
                          weather: 'storm',
                          wind: Math.max(lvl.wind ?? 0.45, 1.15),
                          cloudDensity: Math.max(lvl.cloudDensity ?? 0.55, 0.88),
                          stormClouds: true,
                          stormLightning: lvl.stormLightning ?? true,
                        };
                      }
                      return {
                        ...lvl,
                        weather: w.id,
                        stormClouds: lvl.weather === 'storm' ? undefined : lvl.stormClouds,
                      };
                    });
                    publishGuidanceHint({
                      badge: 'Weather',
                      title: `${w.title} Weather`,
                      detail:
                        w.id === 'storm'
                          ? 'Stormy weather activated! Dark brooding storm clouds, gusting rain, and sheet lightning are now active.'
                          : `Active weather set to ${w.title}. Adjust Wind Strength below to control gusts and sway.`,
                    });
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                    active
                      ? 'bg-[#38BDF8]/18 border-[#38BDF8] text-[#0284C7] dark:text-[#38BDF8]'
                      : 'bg-slate-100 dark:bg-[#1F2430] border-transparent text-slate-700 dark:text-[#C8D0E4]'
                  }`}
                >
                  <MakerIcon symbol={w.symbol} size={13} />
                  <span className="truncate">{w.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {(currentLevel.weather === 'storm' || stormActive) && (
          <div className="p-3 rounded-2xl bg-[#6366F1]/10 dark:bg-[#6366F1]/15 border border-[#6366F1]/25 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#4338CA] dark:text-[#C7D2FE]">
                <CloudLightning size={13} />
                <span>Storm Clouds &amp; Lightning</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={stormLightning}
                onClick={() =>
                  store.updateLevel('toggle storm lightning', (lvl) => ({
                    ...lvl,
                    stormLightning: !stormLightning,
                  }))
                }
                style={{ backgroundColor: stormLightning ? '#F59E0B' : undefined }}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                  stormLightning ? '' : 'bg-slate-300 dark:bg-[#2C3346]'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                    stormLightning ? 'translate-x-[18px]' : 'translate-x-[3px]'
                  }`}
                />
              </button>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-semibold">
                <span>Storm Cloud Darkness</span>
                <span className="tabular-nums font-mono text-[10px] text-slate-500 dark:text-[#949BB0]">
                  {Math.round(stormIntensity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={stormIntensity}
                onChange={(e) =>
                  store.updateLevel(
                    'adjust storm intensity',
                    (lvl) => ({ ...lvl, stormIntensity: Number(e.target.value), stormClouds: true }),
                    false
                  )
                }
                className="w-full accent-[#6366F1]"
              />
            </div>
          </div>
        )}

        <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] border border-slate-200/70 dark:border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="inline-flex items-center gap-1.5">
              <Wind size={13} className="text-[#38BDF8]" />
              <span>Wind Strength</span>
            </span>
            <span className="tabular-nums text-[#38BDF8]">
              {(currentLevel.wind ?? 0.45) <= 0.12
                ? 'Calm'
                : (currentLevel.wind ?? 0.45) <= 0.65
                ? `Breeze (${Math.round((currentLevel.wind ?? 0.45) * 100)}%)`
                : (currentLevel.wind ?? 0.45) <= 1.25
                ? `Gusty (${Math.round((currentLevel.wind ?? 0.45) * 100)}%)`
                : `Gale (${Math.round((currentLevel.wind ?? 0.45) * 100)}%)`}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={2}
            step={0.05}
            value={currentLevel.wind ?? 0.45}
            data-hint-badge="Weather & Wind"
            data-hint-title="Wind Strength"
            data-hint-detail="Slide right to intensify wind sway on trees, grass blades, banners, and rain slant."
            onChange={(e) =>
              store.updateLevel('adjust wind strength', (lvl) => ({
                ...lvl,
                wind: Number(e.target.value),
              }))
            }
            className="w-full accent-[#38BDF8]"
          />
        </div>
      </div>
    );
  }

  if (section === 'sunRays') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Sun size={16} className="text-[#F59E0B]" />
          <h2 className="text-sm font-extrabold">God Rays &amp; Dust</h2>
        </div>

        <div className="space-y-3 p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] border border-slate-200/70 dark:border-white/[0.06]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-extrabold text-slate-800 dark:text-[#E2E8F0]">
              3D Volumetric Light Shafts
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={currentLevel.godRaysEnabled ?? true}
              data-hint-badge="God Rays"
              data-hint-title="Volumetric Light Shafts"
              data-hint-detail="Toggle dramatic sunbeams streaming through trees and mountain ridges."
              onClick={() =>
                store.updateLevel(
                  'toggle volumetric god rays',
                  (lvl) => ({ ...lvl, godRaysEnabled: !(lvl.godRaysEnabled ?? true) }),
                  true
                )
              }
              style={{
                backgroundColor: (currentLevel.godRaysEnabled ?? true) ? '#F59E0B' : undefined,
              }}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                (currentLevel.godRaysEnabled ?? true) ? '' : 'bg-slate-300 dark:bg-[#2C3346]'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                  (currentLevel.godRaysEnabled ?? true)
                    ? 'translate-x-[18px]'
                    : 'translate-x-[3px]'
                }`}
              />
            </button>
          </div>

          {(currentLevel.godRaysEnabled ?? true) && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold">
                <span>Shafts Intensity</span>
                <span className="tabular-nums font-mono text-[11px] text-slate-500 dark:text-[#949BB0]">
                  {Math.round((currentLevel.godRaysIntensity ?? 0.75) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1.8}
                step={0.05}
                value={currentLevel.godRaysIntensity ?? 0.75}
                data-hint-badge="God Rays"
                data-hint-title="Shafts Intensity"
                data-hint-detail="Adjust how bright and visible volumetric sunbeams shine across the scene."
                onChange={(e) =>
                  store.updateLevel(
                    'adjust god rays intensity',
                    (lvl) => ({ ...lvl, godRaysIntensity: Number(e.target.value) }),
                    false
                  )
                }
                className="w-full accent-[#F59E0B]"
              />
            </div>
          )}

          <div className="space-y-1 pt-2 border-t border-slate-200/60 dark:border-white/[0.06]">
            <div className="flex justify-between text-xs font-semibold">
              <span>Sunbeam Dust Motes</span>
              <span className="tabular-nums font-mono text-[11px] text-slate-500 dark:text-[#949BB0]">
                {Math.round((currentLevel.atmosphericDust ?? 0.5) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={currentLevel.atmosphericDust ?? 0.5}
              data-hint-badge="God Rays"
              data-hint-title="Sunbeam Dust Motes"
              data-hint-detail="Control how many tiny glowing dust particles drift gently through the sunlight."
              onChange={(e) =>
                store.updateLevel(
                  'adjust atmospheric dust motes',
                  (lvl) => ({ ...lvl, atmosphericDust: Number(e.target.value) }),
                  false
                )
              }
              className="w-full accent-[#F59E0B]"
            />
          </div>
        </div>
      </div>
    );
  }

  if (section === 'styleBiome') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Palette size={16} className="text-[#A855F7]" />
          <h2 className="text-sm font-extrabold">Visual Style &amp; Biome</h2>
        </div>

        <div className="space-y-1.5">
          <FieldLabel text="3D Rendering Style" />
          <div className="grid grid-cols-1 gap-1.5">
            {VisualStyles.map((st) => {
              const active = visualStyle === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    store.updateLevel('change visual style', (lvl) => ({
                      ...lvl,
                      visualStyle: st.id,
                    }));
                    publishGuidanceHint({
                      badge: 'Visual Style',
                      title: st.title,
                      detail: st.blurb,
                    });
                  }}
                  className={`px-3 py-2 rounded-xl text-left border transition-colors ${
                    active
                      ? 'border-[#6D4AFF] bg-[#6D4AFF]/12 text-[#6D4AFF] dark:text-[#C4B5FD]'
                      : 'border-transparent bg-slate-100 dark:bg-[#1F2430] text-slate-700 dark:text-[#C8D0E4]'
                  }`}
                >
                  <div className="text-xs font-extrabold">{st.title}</div>
                  <div className="text-[10px] opacity-75">{st.blurb}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <FieldLabel text="Biome Color Palette" />
          <div className="grid grid-cols-3 gap-1.5">
            {Biomes.map((b) => {
              const active = currentLevel.biome === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    store.updateLevel('change biome', (lvl) => ({ ...lvl, biome: b.id }));
                    publishGuidanceHint({
                      badge: 'Biome Palette',
                      title: `${b.title} Biome`,
                      detail: `Terrain base colors and natural ground palette switched to ${b.title}.`,
                    });
                  }}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-[11px] font-bold transition-all ${
                    active
                      ? 'border-[#6D4AFF] bg-[#6D4AFF]/12 text-[#6D4AFF] dark:text-[#C4B5FD]'
                      : 'border-transparent bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span
                    className="w-5 h-5 rounded-full border border-black/20"
                    style={{ backgroundColor: b.ground }}
                  />
                  <span className="truncate w-full text-center">{b.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (section === 'postFx') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Film size={16} className="text-[#EC4899]" />
            <h2 className="text-sm font-extrabold">Post FX &amp; Lighting</h2>
          </div>
          <button
            type="button"
            onClick={() => store.setShowingPostFx(true)}
            className="text-[11px] font-bold text-[#EC4899] hover:underline"
          >
            Full FX Menu
          </button>
        </div>

        <PostProcessingPanel store={store} />
      </div>
    );
  }

  // horizonVista
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Mountain size={16} className="text-[#16A34A]" />
          <h2 className="text-sm font-extrabold">360° Horizon Vista</h2>
        </div>
        <button
          type="button"
          onClick={() => store.openTreeMaker()}
          className="text-[11px] font-bold text-[#16A34A] hover:underline inline-flex items-center gap-1"
        >
          <Trees size={11} />
          <span>Tree Maker</span>
        </button>
      </div>

      {!(envType === 'openWorld' || envType === 'castle') ? (
        <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] text-xs text-slate-600 dark:text-[#949BB0] leading-relaxed">
          Distant 360° horizon mountains and forests are available in Open World and Castle templates. Try <strong className="text-slate-800 dark:text-slate-200">Fog &amp; Mist</strong> or <strong className="text-slate-800 dark:text-slate-200">Sky &amp; Time</strong> for this template!
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-[#8E96AB] flex items-center gap-1.5">
            <Trees size={12} className="text-[#16A34A] shrink-0" />
            <span>
              {hasSavedDefaultTrees || currentLevel.canopyEngine?.enabled
                ? 'Horizon trees synced to your Tree Maker defaults'
                : 'Using built-in horizon forest'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {VistaPresets.map((vp) => {
              const active = vistaPreset === vp.id;
              return (
                <button
                  key={vp.id}
                  type="button"
                  title={vp.blurb}
                  onClick={() => {
                    store.updateLevel('change distant vista', (lvl) => ({
                      ...lvl,
                      vistaPreset: vp.id,
                    }));
                    publishGuidanceHint({
                      badge: 'Horizon Vista',
                      title: vp.title,
                      detail: vp.blurb,
                    });
                  }}
                  className={`px-2.5 py-2 rounded-xl text-xs font-bold border text-left truncate transition-colors ${
                    active
                      ? 'border-[#16A34A] bg-[#16A34A]/12 text-[#16A34A]'
                      : 'border-transparent bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#949BB0]'
                  }`}
                >
                  {vp.title}
                </button>
              );
            })}
          </div>

          {vistaPreset !== 'none' && (
            <div className="space-y-2.5 p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] border border-slate-200/70 dark:border-white/[0.06]">
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-semibold">
                  <span>Horizon trees amount</span>
                  <span className="tabular-nums text-slate-500 dark:text-[#949BB0]">
                    {Math.round(vistaTreeDensity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1.5}
                  step={0.05}
                  value={vistaTreeDensity}
                  data-hint-badge="Horizon Vista"
                  data-hint-title="Horizon Trees Amount"
                  data-hint-detail="Increases or reduces how densely distant forests ring the outer horizon."
                  onChange={(e) =>
                    store.updateLevel(
                      'set vista tree density',
                      (lvl) => ({ ...lvl, vistaTreeDensity: Number(e.target.value) }),
                      false
                    )
                  }
                  className="w-full accent-[#20B46A]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-semibold">
                  <span>Horizon tree size</span>
                  <span className="tabular-nums text-slate-500 dark:text-[#949BB0]">
                    {vistaTreeScale.toFixed(2)}×
                  </span>
                </div>
                <input
                  type="range"
                  min={0.6}
                  max={2.0}
                  step={0.05}
                  value={vistaTreeScale}
                  onChange={(e) =>
                    store.updateLevel(
                      'set vista tree scale',
                      (lvl) => ({ ...lvl, vistaTreeScale: Number(e.target.value) }),
                      false
                    )
                  }
                  className="w-full accent-[#20B46A]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-semibold">
                  <span>Mountains height &amp; relief</span>
                  <span className="tabular-nums text-slate-500 dark:text-[#949BB0]">
                    {Math.round(vistaMountainScale * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1.8}
                  step={0.05}
                  value={vistaMountainScale}
                  onChange={(e) =>
                    store.updateLevel(
                      'set vista mountain scale',
                      (lvl) => ({ ...lvl, vistaMountainScale: Number(e.target.value) }),
                      false
                    )
                  }
                  className="w-full accent-[#6D4AFF]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-semibold">
                  <span>Vista distance from shore</span>
                  <span className="tabular-nums text-slate-500 dark:text-[#949BB0]">
                    {vistaDistance > 0
                      ? `+${Math.round(vistaDistance)}m`
                      : vistaDistance < 0
                      ? `${Math.round(vistaDistance)}m`
                      : 'Standard'}
                  </span>
                </div>
                <input
                  type="range"
                  min={-30}
                  max={260}
                  step={5}
                  value={vistaDistance}
                  onChange={(e) =>
                    store.updateLevel(
                      'set vista distance',
                      (lvl) => ({ ...lvl, vistaDistance: Number(e.target.value) }),
                      false
                    )
                  }
                  className="w-full accent-[#F59E0B]"
                />
              </div>
            </div>
          )}

          {/* Horizon Landmarks */}
          <div className="space-y-1.5 pt-1 border-t border-slate-200/70 dark:border-white/[0.06]">
            <div className="text-[11px] font-bold text-slate-500 dark:text-[#8E96AB]">
              Add Horizon Landmarks
            </div>
            <div className="grid grid-cols-3 gap-1">
              {VistaPropKinds.map((vk) => (
                <button
                  key={vk.id}
                  type="button"
                  onClick={() => handleAddVista(vk.id)}
                  className="px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1F2430] hover:bg-[#6D4AFF]/15 hover:text-[#6D4AFF] text-[10px] font-bold transition-colors"
                >
                  + {vk.title}
                </button>
              ))}
            </div>
            {store.customAssets.length > 0 && (
              <div className="flex gap-1 pt-0.5">
                <select
                  value={activeVistaAssetId}
                  onChange={(e) => setVistaCustomAssetId(e.target.value)}
                  className="flex-1 min-w-0 px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-[11px] font-semibold"
                >
                  {store.customAssets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (activeVistaAssetId) handleAddVista('custom', activeVistaAssetId);
                  }}
                  className="shrink-0 px-2.5 py-1 rounded-lg bg-[#16A34A] text-white text-[10px] font-bold"
                >
                  + GLB
                </button>
              </div>
            )}
          </div>

          {vistaItems.length > 0 && (
            <div className="space-y-2 pt-1 max-h-52 overflow-y-auto maker-scroll">
              {vistaItems.map((item) => (
                <div
                  key={item.id}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-[#1F2430] space-y-1.5 border border-slate-200/60 dark:border-white/[0.06]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold truncate">{item.name}</span>
                    <button
                      type="button"
                      onClick={() =>
                        store.updateLevel('remove vista landmark', (lvl) => ({
                          ...lvl,
                          vistaItems: (lvl.vistaItems ?? []).filter((v) => v.id !== item.id),
                        }))
                      }
                      className="text-slate-400 hover:text-[#F2545B]"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-[10px] text-slate-500 dark:text-[#949BB0]">
                    <label className="space-y-0.5">
                      <span className="block tabular-nums">Dir {Math.round(item.angle)}°</span>
                      <input
                        type="range"
                        min={0}
                        max={359}
                        value={item.angle}
                        onChange={(e) =>
                          store.updateLevel(
                            'move vista landmark',
                            (lvl) => ({
                              ...lvl,
                              vistaItems: (lvl.vistaItems ?? []).map((v) =>
                                v.id === item.id ? { ...v, angle: Number(e.target.value) } : v
                              ),
                            }),
                            false
                          )
                        }
                        className="w-full accent-[#6D4AFF]"
                      />
                    </label>
                    <label className="space-y-0.5">
                      <span className="block tabular-nums">Dist {Math.round(item.distance)}m</span>
                      <input
                        type="range"
                        min={vistaMinDist}
                        max={vistaMaxDist}
                        step={2}
                        value={item.distance}
                        onChange={(e) =>
                          store.updateLevel(
                            'move vista distance',
                            (lvl) => ({
                              ...lvl,
                              vistaItems: (lvl.vistaItems ?? []).map((v) =>
                                v.id === item.id ? { ...v, distance: Number(e.target.value) } : v
                              ),
                            }),
                            false
                          )
                        }
                        className="w-full accent-[#16A34A]"
                      />
                    </label>
                    <label className="space-y-0.5">
                      <span className="block tabular-nums">Size {item.scale.toFixed(1)}×</span>
                      <input
                        type="range"
                        min={0.6}
                        max={3.0}
                        step={0.1}
                        value={item.scale}
                        onChange={(e) =>
                          store.updateLevel(
                            'resize vista landmark',
                            (lvl) => ({
                              ...lvl,
                              vistaItems: (lvl.vistaItems ?? []).map((v) =>
                                v.id === item.id ? { ...v, scale: Number(e.target.value) } : v
                              ),
                            }),
                            false
                          )
                        }
                        className="w-full accent-[#F59E0B]"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
