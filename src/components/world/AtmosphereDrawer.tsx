import React, { useMemo, useState } from 'react';
import { Clock, CloudFog, CloudSun, Film, Mountain, Sun, Trash2, Trees, Wind, X } from 'lucide-react';
import {
  Biomes,
  SkyPresets,
  VisualStyles,
  VistaPresets,
  VistaPropKinds,
  WeatherOptions,
} from '../../data/registries';
import type { MakerStore } from '../../store/useMakerStore';
import type { VistaPresetId, VistaPropItem, VistaPropKind } from '../../types/maker';
import { useDefaultTreeStyles } from '../../utils/defaultTreeStyles';
import { getEnvironmentType, uid } from '../../utils/terrain';
import { MakerIcon } from '../shared/IconMap';
import { FieldLabel } from '../shared/MakerUI';
import { PostProcessingPanel } from './PostProcessingPanel';

function formatClock(hour: number): string {
  const h = Math.floor(hour) % 24;
  const m = Math.round((hour - Math.floor(hour)) * 60) % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export const AtmosphereDrawer: React.FC<{ store: MakerStore }> = ({ store }) => {
  const { currentLevel } = store;
  const defaultTreePrefs = useDefaultTreeStyles();
  const [vistaCustomAssetId, setVistaCustomAssetId] = useState<string>(
    () => store.customAssets[0]?.id ?? ''
  );

  const activeVistaAssetId = useMemo(() => {
    if (vistaCustomAssetId && store.customAssets.some((a) => a.id === vistaCustomAssetId)) {
      return vistaCustomAssetId;
    }
    return store.customAssets[0]?.id ?? '';
  }, [vistaCustomAssetId, store.customAssets]);

  if (!store.showingAtmosphereDrawer || !currentLevel) return null;

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

  const handleAddVistaItem = (kind: VistaPropKind, customAssetId?: string, customLabel?: string) => {
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

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) store.setShowingAtmosphereDrawer(false);
      }}
    >
      <aside className="w-full max-w-[360px] h-full bg-white dark:bg-[#171A23] border-l border-slate-200/80 dark:border-white/[0.1] shadow-2xl flex flex-col overflow-hidden">
        <header className="shrink-0 px-4 py-3 border-b border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between gap-2 bg-slate-50/80 dark:bg-[#131720]">
          <div className="flex items-center gap-2">
            <CloudSun size={16} className="text-[#38BDF8]" />
            <div>
              <h2 className="text-sm font-extrabold">Atmosphere, Sky &amp; Vista</h2>
              <p className="text-[10px] text-slate-500 dark:text-[#949BB0]">
                Lighting, weather, visual style &amp; distant horizon
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => store.setShowingAtmosphereDrawer(false)}
            aria-label="Close Atmosphere Drawer"
            className="p-1.5 rounded-lg hover:bg-slate-200/70 dark:hover:bg-[#23293A]"
          >
            <X size={15} />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto maker-scroll p-4 space-y-4">
          {/* Quick Links to Deep Skybox & PostFX Modals */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                store.setShowingAtmosphereDrawer(false);
                store.setShowingSkybox(true);
              }}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#38BDF8]/15 hover:bg-[#38BDF8]/25 text-[#0284C7] dark:text-[#38BDF8] text-xs font-extrabold whitespace-nowrap"
            >
              <Sun size={13} />
              <span>Skybox &amp; Clouds</span>
            </button>
            <button
              type="button"
              onClick={() => {
                store.setShowingAtmosphereDrawer(false);
                store.setShowingPostFx(true);
              }}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#EC4899]/15 hover:bg-[#EC4899]/25 text-[#DB2777] dark:text-[#F472B6] text-xs font-extrabold whitespace-nowrap"
            >
              <Film size={13} />
              <span>Post FX Menu</span>
            </button>
          </div>

          {/* 3D Visual Style */}
          <div className="space-y-1.5">
            <FieldLabel text="3D Visual Style" />
            <div className="grid grid-cols-3 gap-1.5">
              {VisualStyles.map((st) => {
                const active = visualStyle === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    title={st.blurb}
                    onClick={() =>
                      store.updateLevel('change visual style', (lvl) => ({
                        ...lvl,
                        visualStyle: st.id,
                      }))
                    }
                    className={`px-2 py-2 rounded-xl text-[11px] font-bold border transition-colors ${
                      active
                        ? 'border-[#7C5CFF] bg-[#7C5CFF]/15 text-[#7C5CFF]'
                        : 'border-transparent bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#949BB0]'
                    }`}
                  >
                    {st.title.split(' ')[0]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time of Day */}
          <div className="space-y-2 p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] border border-slate-200/70 dark:border-white/[0.06]">
            <div className="flex items-center justify-between">
              <FieldLabel text="Time of day" />
              <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-[#F59E0B] tabular-nums">
                <Clock size={11} />
                {currentLevel.timeOfDay !== undefined ? formatClock(timeOfDay) : 'Preset'}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={23.75}
              step={0.25}
              value={timeOfDay}
              onChange={(e) =>
                store.updateLevel(
                  'set time of day',
                  (lvl) => ({ ...lvl, timeOfDay: Number(e.target.value) }),
                  false
                )
              }
              className="w-full accent-[#F59E0B]"
            />
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
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
                  className="accent-[#7C5CFF]"
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
                  className="text-[#7C5CFF] hover:underline"
                >
                  Use sky
                </button>
              )}
            </div>
          </div>

          {/* Biome */}
          <div className="space-y-2">
            <FieldLabel text="Biome Palette" />
            <div className="grid grid-cols-4 gap-1.5">
              {Biomes.map((b) => {
                const active = currentLevel.biome === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() =>
                      store.updateLevel('change biome', (lvl) => ({ ...lvl, biome: b.id }))
                    }
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-[10px] font-bold transition-all ${
                      active
                        ? 'border-[#7C5CFF] bg-[#7C5CFF]/15 text-[#7C5CFF]'
                        : 'border-transparent bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span
                      className="w-4 h-4 rounded-full border border-black/15"
                      style={{ backgroundColor: b.ground }}
                    />
                    <span className="truncate w-full text-center">{b.title}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sky & Weather */}
          <div className="space-y-2">
            <FieldLabel text="Sky & Weather" />
            <div className="grid grid-cols-3 gap-1.5">
              {SkyPresets.map((s) => {
                const active = currentLevel.sky === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() =>
                      store.updateLevel('change sky', (lvl) => ({
                        ...lvl,
                        sky: s.id,
                        timeOfDay: undefined,
                      }))
                    }
                    className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] font-semibold border ${
                      active
                        ? 'border-[#7C5CFF] bg-[#7C5CFF]/15 text-[#7C5CFF]'
                        : 'border-transparent bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#949BB0]'
                    }`}
                  >
                    <MakerIcon symbol={s.symbol} size={12} color={active ? '#7C5CFF' : s.tint} />
                    <span className="truncate">{s.title.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              {WeatherOptions.map((w) => {
                const active = currentLevel.weather === w.id;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() =>
                      store.updateLevel('change weather', (lvl) => ({ ...lvl, weather: w.id }))
                    }
                    className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-[11px] font-semibold ${
                      active
                        ? 'bg-[#38BDF8]/18 text-[#38BDF8]'
                        : 'bg-slate-100 dark:bg-[#1F2430] text-slate-600 dark:text-[#949BB0]'
                    }`}
                  >
                    <MakerIcon symbol={w.symbol} size={11} />
                    <span className="truncate">{w.title}</span>
                  </button>
                );
              })}
            </div>
            <div className="pt-1 space-y-1">
              <div className="flex items-center justify-between text-[11px] font-semibold">
                <span className="inline-flex items-center gap-1 text-slate-600 dark:text-[#949BB0]">
                  <Wind size={11} />
                  <span>Wind Strength</span>
                </span>
                <span className="tabular-nums text-[#38BDF8] font-bold">
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

          {/* Post Processing Quick Controls */}
          <PostProcessingPanel store={store} />

          {/* Distance Fog & Atmospheric Haze */}
          <div className="space-y-2.5 p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] border border-slate-200/70 dark:border-white/[0.06]">
            <div className="flex items-center justify-between">
              <FieldLabel text="Distance Fog & Horizon Haze" />
              <CloudFog size={13} className="text-[#38BDF8]" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-semibold">
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
              <div className="flex justify-between text-[11px] font-semibold">
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

          {/* Volumetric Fog & Light Shafts (God Rays) */}
          <div className="space-y-3 p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] border border-slate-200/70 dark:border-white/[0.06]">
            <div className="flex items-center justify-between">
              <FieldLabel text="Volumetric Atmosphere & God Rays" />
              <Sun size={13} className="text-[#F59E0B]" />
            </div>

            {/* Volumetric Ground Fog Toggle */}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <span className="text-[11px] font-bold text-slate-700 dark:text-[#E2E8F0]">
                Rolling Valley Mist
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={currentLevel.volumetricFogEnabled ?? true}
                onClick={() =>
                  store.updateLevel(
                    'toggle volumetric fog',
                    (lvl) => ({ ...lvl, volumetricFogEnabled: !(lvl.volumetricFogEnabled ?? true) }),
                    true
                  )
                }
                style={{ backgroundColor: (currentLevel.volumetricFogEnabled ?? true) ? '#38BDF8' : undefined }}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                  (currentLevel.volumetricFogEnabled ?? true) ? '' : 'bg-slate-300 dark:bg-[#2C3346]'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                    (currentLevel.volumetricFogEnabled ?? true) ? 'translate-x-[18px]' : 'translate-x-[3px]'
                  }`}
                />
              </button>
            </div>

            {(currentLevel.volumetricFogEnabled ?? true) && (
              <div className="space-y-2.5 pl-1 border-l-2 border-[#38BDF8]/30">
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-semibold">
                    <span className="text-slate-600 dark:text-[#C8D0E4]">Mist Density</span>
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
                    <span className="text-slate-600 dark:text-[#C8D0E4]">Mist Elevation</span>
                    <span className="tabular-nums font-mono text-[10px] text-slate-500 dark:text-[#949BB0]">
                      {(currentLevel.volumetricFogHeight !== undefined ? currentLevel.volumetricFogHeight : 2.2).toFixed(1)}m
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-4}
                    max={20}
                    step={0.5}
                    value={currentLevel.volumetricFogHeight !== undefined ? currentLevel.volumetricFogHeight : 2.2}
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

                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[11px] font-semibold">
                    <span className="text-slate-600 dark:text-[#C8D0E4]">Edge Spread (Transition)</span>
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

                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[11px] font-semibold">
                    <span className="text-slate-600 dark:text-[#C8D0E4]">Edge Blur &harr; Crispness</span>
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

                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[11px] font-semibold">
                    <span className="text-slate-600 dark:text-[#C8D0E4]">Noise Breakup &amp; Undulation</span>
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

                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[11px] font-semibold">
                    <span className="text-slate-600 dark:text-[#C8D0E4]">Patch Separation (Fog Banks)</span>
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

                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[11px] font-semibold">
                    <span className="text-slate-600 dark:text-[#C8D0E4]">Slow Drift Speed</span>
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

            {/* Volumetric Light Shafts (God Rays) Toggle */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-white/[0.06]">
              <span className="text-[11px] font-bold text-slate-700 dark:text-[#E2E8F0]">
                3D Volumetric Light Shafts
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={currentLevel.godRaysEnabled ?? true}
                onClick={() =>
                  store.updateLevel(
                    'toggle volumetric god rays',
                    (lvl) => ({ ...lvl, godRaysEnabled: !(lvl.godRaysEnabled ?? true) }),
                    true
                  )
                }
                style={{ backgroundColor: (currentLevel.godRaysEnabled ?? true) ? '#F59E0B' : undefined }}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                  (currentLevel.godRaysEnabled ?? true) ? '' : 'bg-slate-300 dark:bg-[#2C3346]'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                    (currentLevel.godRaysEnabled ?? true) ? 'translate-x-[18px]' : 'translate-x-[3px]'
                  }`}
                />
              </button>
            </div>

            {(currentLevel.godRaysEnabled ?? true) && (
              <div className="space-y-2.5 pl-1 border-l-2 border-[#F59E0B]/30">
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-semibold">
                    <span className="text-slate-600 dark:text-[#C8D0E4]">Shafts Intensity</span>
                    <span className="tabular-nums font-mono text-[10px] text-slate-500 dark:text-[#949BB0]">
                      {Math.round((currentLevel.godRaysIntensity ?? 0.75) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1.8}
                    step={0.05}
                    value={currentLevel.godRaysIntensity ?? 0.75}
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
              </div>
            )}

            {/* Ambient Sunbeam Dust Motes Slider */}
            <div className="space-y-1 pt-1 border-t border-slate-200/60 dark:border-white/[0.06]">
              <div className="flex justify-between text-[11px] font-semibold">
                <span className="text-slate-600 dark:text-[#C8D0E4]">Sunbeam Dust Motes</span>
                <span className="tabular-nums font-mono text-[10px] text-slate-500 dark:text-[#949BB0]">
                  {Math.round((currentLevel.atmosphericDust ?? 0.5) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={currentLevel.atmosphericDust ?? 0.5}
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

          {/* Distant Vista */}
          {(envType === 'openWorld' || envType === 'castle') && (
            <div className="space-y-2.5 p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] border border-slate-200/70 dark:border-white/[0.06]">
              <div className="flex items-center justify-between gap-2">
                <FieldLabel text="360° Distant Horizon Vista" />
                <Mountain size={12} className="text-[#20B46A]" />
              </div>

              <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-white/80 dark:bg-[#171A23] border border-slate-200/70 dark:border-white/[0.06]">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-600 dark:text-[#949BB0] truncate">
                  <Trees size={11} className="text-[#20B46A] shrink-0" />
                  <span className="truncate">
                    {hasSavedDefaultTrees || currentLevel.canopyEngine?.enabled
                      ? 'Trees synced to your defaults'
                      : 'Using built-in horizon trees'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    store.setShowingAtmosphereDrawer(false);
                    store.openTreeMaker();
                  }}
                  className="shrink-0 text-[10px] font-extrabold text-[#20B46A] hover:underline"
                >
                  Tree Maker
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {VistaPresets.map((vp) => {
                  const active = vistaPreset === vp.id;
                  return (
                    <button
                      key={vp.id}
                      type="button"
                      title={vp.blurb}
                      onClick={() =>
                        store.updateLevel('change distant vista', (lvl) => ({
                          ...lvl,
                          vistaPreset: vp.id,
                        }))
                      }
                      className={`px-2 py-1.5 rounded-xl text-[11px] font-bold border text-left truncate transition-colors ${
                        active
                          ? 'border-[#7C5CFF] bg-[#7C5CFF]/15 text-[#7C5CFF]'
                          : 'border-transparent bg-white dark:bg-[#171A23] text-slate-600 dark:text-[#949BB0]'
                      }`}
                    >
                      {vp.title}
                    </button>
                  );
                })}
              </div>

              {vistaPreset !== 'none' && (
                <div className="space-y-2.5 pt-1">
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
                      className="w-full accent-[#7C5CFF]"
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

              <div className="space-y-1.5 pt-1 border-t border-slate-200/70 dark:border-white/[0.06]">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB]">
                  Add Horizon Landmarks
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {VistaPropKinds.map((vk) => (
                    <button
                      key={vk.id}
                      type="button"
                      onClick={() => handleAddVistaItem(vk.id)}
                      className="px-2 py-1 rounded-lg bg-white dark:bg-[#171A23] hover:bg-[#7C5CFF]/15 hover:text-[#7C5CFF] text-[10px] font-bold transition-colors"
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
                      className="flex-1 min-w-0 px-2 py-1 rounded-lg bg-white dark:bg-[#171A23] text-[11px] font-semibold"
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
                        if (activeVistaAssetId) handleAddVistaItem('custom', activeVistaAssetId);
                      }}
                      className="shrink-0 px-2.5 py-1 rounded-lg bg-[#20B46A] text-white text-[10px] font-bold"
                    >
                      + GLB
                    </button>
                  </div>
                )}
              </div>

              {vistaItems.length > 0 && (
                <div className="space-y-2 pt-1 max-h-48 overflow-y-auto maker-scroll">
                  {vistaItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-2 rounded-xl bg-white dark:bg-[#171A23] space-y-1.5 border border-slate-200/60 dark:border-white/[0.06]"
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
                            className="w-full accent-[#7C5CFF]"
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
                                    v.id === item.id
                                      ? { ...v, distance: Number(e.target.value) }
                                      : v
                                  ),
                                }),
                                false
                              )
                            }
                            className="w-full accent-[#20B46A]"
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
      </aside>
    </div>
  );
};
