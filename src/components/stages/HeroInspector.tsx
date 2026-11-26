import React, { useMemo, useState } from 'react';
import {
  Box,
  Compass,
  Flame,
  Heart,
  MessageCircle,
  Mountain,
  RotateCcw,
  Shield,
  Sparkles,
  Swords,
  Thermometer,
  Upload,
  User,
  Zap,
} from 'lucide-react';
import {
  AFFINITY_LABELS,
  DEFAULT_HERO_PROFILE,
  DEFAULT_HERO_STATS,
  HERO_ARCHETYPE_PRESETS,
  HERO_SKILL_CATALOG,
  resolveHeroProfile,
} from '../../data/heroTraits';
import { PresetLibrary } from '../../data/registries';
import type { MakerStore } from '../../store/useMakerStore';
import type {
  HeroAffinityRating,
  HeroEnemyMatchups,
  HeroEnvironmentAffinities,
  HeroProfileConfig,
  HeroSkillId,
  HeroStatsConfig,
  HeroTerrainAffinities,
} from '../../types/maker';
import { AssetThumbnail } from '../shared/AssetThumbnail';
import { FieldLabel } from '../shared/MakerUI';

type HeroInspectorTab = 'stats' | 'skills' | 'terrain' | 'matchups' | 'look';

const AFFINITY_STEPS: HeroAffinityRating[] = [-2, -1, 0, 1, 2];

const TERRAIN_ROWS: {
  key: keyof HeroTerrainAffinities;
  label: string;
  hint: string;
}[] = [
  { key: 'grassland', label: 'Grass & Trails', hint: 'Meadows, dirt paths & forest floor' },
  { key: 'sandAndCoast', label: 'Sand & Coast', hint: 'Beaches, dunes & riverbanks' },
  { key: 'rockAndAlpine', label: 'Rock & Cliffs', hint: 'Stone ridges & vertical climbing' },
  { key: 'mudAndSwamp', label: 'Mud & Swamp', hint: 'Boggy banks & dense damp moss' },
  { key: 'snowAndIce', label: 'Snow & Ice', hint: 'Snowfields & frost-covered ground' },
  { key: 'waterAndSwim', label: 'Water & Swim', hint: 'Deep rivers, lakes & splash drag' },
];

const ENEMY_ROWS: {
  key: keyof HeroEnemyMatchups;
  label: string;
  hint: string;
}[] = [
  { key: 'bosses', label: 'Bosses', hint: 'Major bosses like Twin-Flame Drake' },
  { key: 'flying', label: 'Flying & Winged', hint: 'Airborne drakes, bats & swoopers' },
  { key: 'beasts', label: 'Beasts & Monsters', hint: 'Quadruped predators & wild packs' },
  { key: 'elemental', label: 'Elemental & Hazards', hint: 'Fire, frost, shock & poison attacks' },
  { key: 'heavyBrutes', label: 'Heavy Brutes', hint: 'Armored ogres, trolls & knockdown hits' },
];

const ENVIRONMENT_ROWS: {
  key: keyof HeroEnvironmentAffinities;
  label: string;
  hint: string;
}[] = [
  { key: 'openWilds', label: 'Open Wilds', hint: 'Islands, meadows & sunlit forests' },
  { key: 'underground', label: 'Underground', hint: 'Caves, grottos & enclosed dungeons' },
  { key: 'stormAndRain', label: 'Storm & Rain', hint: 'Heavy rain & high wind conditions' },
  { key: 'nightAndShadow', label: 'Night & Shadow', hint: 'Nighttime hours & dark biomes' },
  { key: 'highAltitude', label: 'High Altitude', hint: 'Mountain summits & high cliffs' },
];

const AffinityStepper: React.FC<{
  label: string;
  hint?: string;
  value: HeroAffinityRating;
  onChange: (val: HeroAffinityRating) => void;
}> = ({ label, hint, value, onChange }) => {
  const meta = AFFINITY_LABELS[value];
  return (
    <div className="py-2 border-b border-slate-200/70 dark:border-white/[0.06] last:border-b-0 space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
            {label}
          </div>
          {hint && (
            <div className="text-[10px] text-slate-500 dark:text-[#949BB0] truncate">{hint}</div>
          )}
        </div>
        <span
          className="text-[11px] font-extrabold tabular-nums shrink-0"
          style={{ color: meta.color }}
        >
          {meta.short} · {meta.label}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-1 p-0.5 rounded-lg bg-slate-200/70 dark:bg-[#141822]">
        {AFFINITY_STEPS.map((step) => {
          const active = value === step;
          const stepMeta = AFFINITY_LABELS[step];
          return (
            <button
              key={step}
              type="button"
              onClick={() => onChange(step)}
              className={`py-1 rounded-md text-[11px] font-extrabold tabular-nums transition-colors ${
                active
                  ? 'text-white shadow-xs'
                  : 'text-slate-500 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white'
              }`}
              style={{
                backgroundColor: active ? stepMeta.color : 'transparent',
              }}
              title={stepMeta.label}
            >
              {stepMeta.short}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const HeroInspector: React.FC<{
  store: MakerStore;
  onOpenChatStudio: (tab?: 'bubble' | 'panel') => void;
}> = ({ store, onOpenChatStudio }) => {
  const { currentProject } = store;
  const [activeTab, setActiveTab] = useState<HeroInspectorTab>('stats');

  const profile = useMemo(() => resolveHeroProfile(currentProject), [currentProject]);

  if (!currentProject) return null;

  const heroCustomAsset = currentProject.heroCustomAssetId
    ? store.customAssets.find((a) => a.id === currentProject.heroCustomAssetId) ?? null
    : null;

  const updateProfile = (
    label: string,
    updater: (prev: HeroProfileConfig) => HeroProfileConfig,
    recordHistory = true
  ) => {
    store.updateProject(
      label,
      (proj) => ({
        ...proj,
        heroProfile: updater(resolveHeroProfile(proj)),
      }),
      recordHistory
    );
  };

  const updateStat = <K extends keyof HeroStatsConfig>(
    key: K,
    val: HeroStatsConfig[K],
    recordHistory = false
  ) => {
    updateProfile(
      `hero ${key}`,
      (prev) => ({
        ...prev,
        archetype: 'Custom',
        stats: { ...prev.stats, [key]: val },
      }),
      recordHistory
    );
  };

  const toggleSkill = (skillId: HeroSkillId) => {
    updateProfile('toggle hero skill', (prev) => {
      const exists = prev.skills.includes(skillId);
      const nextSkills = exists
        ? prev.skills.filter((s) => s !== skillId)
        : [...prev.skills, skillId];
      return { ...prev, archetype: 'Custom', skills: nextSkills };
    });
  };

  const strengthCount = [
    ...Object.values(profile.terrain),
    ...Object.values(profile.enemies),
    ...Object.values(profile.environments),
    profile.temperature.coldResistance,
    profile.temperature.heatResistance,
  ].filter((v) => v > 0).length;

  const flawCount =
    [
      ...Object.values(profile.terrain),
      ...Object.values(profile.enemies),
      ...Object.values(profile.environments),
      profile.temperature.coldResistance,
      profile.temperature.heatResistance,
    ].filter((v) => v < 0).length +
    HERO_SKILL_CATALOG.filter((s) => s.kind === 'flaw' && profile.skills.includes(s.id)).length;

  const tabs: { id: HeroInspectorTab; label: string }[] = [
    { id: 'stats', label: 'Stats' },
    { id: 'skills', label: 'Skills' },
    { id: 'terrain', label: 'Terrain' },
    { id: 'matchups', label: 'Matchups' },
    { id: 'look', label: 'Look' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <AssetThumbnail
          customAsset={heroCustomAsset}
          hero={{
            body: currentProject.heroBody,
            colors: currentProject.heroColors,
          }}
          size={52}
          rounded="rounded-xl"
          alt={currentProject.heroName}
        />
        <div className="min-w-0 flex-1">
          <input
            type="text"
            value={currentProject.heroName}
            onChange={(e) =>
              store.updateProject('rename hero', (p) => ({ ...p, heroName: e.target.value }), false)
            }
            className="w-full text-base font-extrabold bg-transparent focus:outline-none border-b border-transparent focus:border-[#7C5CFF]"
          />
          <div className="text-[11px] font-semibold text-slate-500 dark:text-[#949BB0] mt-0.5 tabular-nums truncate">
            <span className="text-[#7C5CFF] font-bold">Playable Hero</span>
            <span> · {profile.stats.maxHealth} HP</span>
            <span> · {profile.stats.baseAttack} ATK</span>
            <span> · {strengthCount} Str / {flawCount} Flaws</span>
          </div>
        </div>
      </div>

      {/* Archetype Preset Bar */}
      <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2">
        <div className="flex items-center justify-between gap-2">
          <FieldLabel text="Hero Build Archetype" />
          <button
            type="button"
            onClick={() =>
              updateProfile('reset hero profile', () => ({
                ...DEFAULT_HERO_PROFILE,
                stats: { ...DEFAULT_HERO_STATS },
                skills: [],
              }))
            }
            className="text-[10px] font-bold text-slate-500 hover:text-[#7C5CFF] inline-flex items-center gap-1"
            title="Reset all stats, skills, and affinities to neutral"
          >
            <RotateCcw size={10} />
            <span>Reset</span>
          </button>
        </div>
        <select
          value={
            HERO_ARCHETYPE_PRESETS.some((p) => p.name === profile.archetype)
              ? profile.archetype
              : 'Custom'
          }
          onChange={(e) => {
            const preset = HERO_ARCHETYPE_PRESETS.find((p) => p.name === e.target.value);
            if (!preset) return;
            updateProfile(`apply ${preset.name} build`, () => ({
              ...preset.profile,
              stats: { ...preset.profile.stats },
              skills: [...preset.profile.skills],
              terrain: { ...preset.profile.terrain },
              temperature: { ...preset.profile.temperature },
              enemies: { ...preset.profile.enemies },
              environments: { ...preset.profile.environments },
            }));
          }}
          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#171A23] text-xs font-bold border border-slate-200/70 dark:border-white/[0.08]"
        >
          {HERO_ARCHETYPE_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.name}>
              {preset.name}
            </option>
          ))}
          <option value="Custom">Custom Hero Build</option>
        </select>
        <p className="text-[11px] text-slate-500 dark:text-[#949BB0] leading-snug">
          {HERO_ARCHETYPE_PRESETS.find((p) => p.name === profile.archetype)?.blurb ??
            profile.bio ??
            'Custom hero build balancing strengths and vulnerabilities.'}
        </p>
      </div>

      {/* Contextual Tabs */}
      <div className="grid grid-cols-5 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#1F2430]">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`py-1.5 px-1 rounded-lg text-[11px] font-extrabold transition-colors whitespace-nowrap truncate ${
                active
                  ? 'bg-[#7C5CFF] text-white shadow-xs'
                  : 'text-slate-600 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: STATS */}
      {activeTab === 'stats' && (
        <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-3">
          <div className="flex items-center justify-between">
            <FieldLabel text="Core Combat & Mobility Stats" />
            <Heart size={13} className="text-[#F2545B]" />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs font-semibold">
              <span>Base Max Health</span>
              <span className="tabular-nums font-extrabold text-[#F2545B]">
                {profile.stats.maxHealth} HP
              </span>
            </div>
            <input
              type="range"
              min={3}
              max={20}
              step={1}
              value={profile.stats.maxHealth}
              onChange={(e) => updateStat('maxHealth', Number(e.target.value), false)}
              className="w-full accent-[#F2545B]"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs font-semibold">
              <span>Base Attack Power</span>
              <span className="tabular-nums font-extrabold text-[#F59E0B]">
                +{profile.stats.baseAttack} DMG
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={8}
              step={1}
              value={profile.stats.baseAttack}
              onChange={(e) => updateStat('baseAttack', Number(e.target.value), false)}
              className="w-full accent-[#F59E0B]"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs font-semibold">
              <span>Base Defense / Guard</span>
              <span className="tabular-nums font-extrabold text-[#38BDF8]">
                {profile.stats.baseDefense} DEF
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={5}
              step={1}
              value={profile.stats.baseDefense}
              onChange={(e) => updateStat('baseDefense', Number(e.target.value), false)}
              className="w-full accent-[#38BDF8]"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs font-semibold">
              <span>Magic Bolt Power</span>
              <span className="tabular-nums font-extrabold text-[#A855F7]">
                {profile.stats.magicPower} PWR
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={8}
              step={1}
              value={profile.stats.magicPower}
              onChange={(e) => updateStat('magicPower', Number(e.target.value), false)}
              className="w-full accent-[#A855F7]"
            />
          </div>

          <div className="pt-2 border-t border-slate-200/70 dark:border-white/[0.08] space-y-2.5">
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold">
                <span>Move &amp; Sprint Speed</span>
                <span className="tabular-nums font-extrabold">
                  {profile.stats.moveSpeedMult.toFixed(2)}×
                </span>
              </div>
              <input
                type="range"
                min={0.65}
                max={1.5}
                step={0.05}
                value={profile.stats.moveSpeedMult}
                onChange={(e) => updateStat('moveSpeedMult', Number(e.target.value), false)}
                className="w-full accent-[#7C5CFF]"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold">
                <span>Jump Power</span>
                <span className="tabular-nums font-extrabold">
                  {profile.stats.jumpPowerMult.toFixed(2)}×
                </span>
              </div>
              <input
                type="range"
                min={0.75}
                max={1.45}
                step={0.05}
                value={profile.stats.jumpPowerMult}
                onChange={(e) => updateStat('jumpPowerMult', Number(e.target.value), false)}
                className="w-full accent-[#7C5CFF]"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold">
                <span>Max Stamina</span>
                <span className="tabular-nums font-extrabold">{profile.stats.staminaMax}</span>
              </div>
              <input
                type="range"
                min={60}
                max={160}
                step={10}
                value={profile.stats.staminaMax}
                onChange={(e) => updateStat('staminaMax', Number(e.target.value), false)}
                className="w-full accent-[#20B46A]"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold">
                <span>Stamina Recovery</span>
                <span className="tabular-nums font-extrabold">
                  {profile.stats.staminaRegenMult.toFixed(2)}×
                </span>
              </div>
              <input
                type="range"
                min={0.6}
                max={1.8}
                step={0.05}
                value={profile.stats.staminaRegenMult}
                onChange={(e) => updateStat('staminaRegenMult', Number(e.target.value), false)}
                className="w-full accent-[#20B46A]"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold">
                <span>Dodge Recovery Window</span>
                <span className="tabular-nums font-extrabold">
                  {profile.stats.dodgeInvulnMult.toFixed(2)}×
                </span>
              </div>
              <input
                type="range"
                min={0.7}
                max={1.5}
                step={0.05}
                value={profile.stats.dodgeInvulnMult}
                onChange={(e) => updateStat('dodgeInvulnMult', Number(e.target.value), false)}
                className="w-full accent-[#7C5CFF]"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SKILLS & FLAWS */}
      {activeTab === 'skills' && (
        <div className="space-y-3">
          <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2">
            <div className="flex items-center justify-between">
              <FieldLabel text="Hero Skills & Strengths" />
              <Zap size={13} className="text-[#20B46A]" />
            </div>
            <div className="space-y-1.5">
              {HERO_SKILL_CATALOG.filter((s) => s.kind === 'skill').map((skill) => {
                const active = profile.skills.includes(skill.id);
                return (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => toggleSkill(skill.id)}
                    className={`w-full p-2.5 rounded-xl border text-left transition-colors ${
                      active
                        ? 'bg-[#20B46A]/15 border-[#20B46A] text-slate-900 dark:text-white'
                        : 'bg-white dark:bg-[#171A23] border-slate-200/70 dark:border-white/[0.06] text-slate-600 dark:text-[#949BB0]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold">{skill.title}</span>
                      <span
                        className={`text-[10px] font-bold tabular-nums ${
                          active ? 'text-[#20B46A]' : 'text-slate-400'
                        }`}
                      >
                        {active ? 'Active' : 'Off'}
                      </span>
                    </div>
                    <div className="text-[11px] font-semibold text-[#20B46A] mt-0.5">
                      {skill.effectSummary}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-[#949BB0] mt-0.5 leading-snug">
                      {skill.detail}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2">
            <div className="flex items-center justify-between">
              <FieldLabel text="Flaws & Tradeoffs" />
              <Flame size={13} className="text-[#F97316]" />
            </div>
            <div className="space-y-1.5">
              {HERO_SKILL_CATALOG.filter((s) => s.kind === 'flaw').map((flaw) => {
                const active = profile.skills.includes(flaw.id);
                return (
                  <button
                    key={flaw.id}
                    type="button"
                    onClick={() => toggleSkill(flaw.id)}
                    className={`w-full p-2.5 rounded-xl border text-left transition-colors ${
                      active
                        ? 'bg-[#F97316]/15 border-[#F97316] text-slate-900 dark:text-white'
                        : 'bg-white dark:bg-[#171A23] border-slate-200/70 dark:border-white/[0.06] text-slate-600 dark:text-[#949BB0]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold">{flaw.title}</span>
                      <span
                        className={`text-[10px] font-bold tabular-nums ${
                          active ? 'text-[#F97316]' : 'text-slate-400'
                        }`}
                      >
                        {active ? 'Equipped' : 'Off'}
                      </span>
                    </div>
                    <div className="text-[11px] font-semibold text-[#F97316] mt-0.5">
                      {flaw.effectSummary}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-[#949BB0] mt-0.5 leading-snug">
                      {flaw.detail}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => store.openHeroActions()}
            className="w-full py-2.5 rounded-xl bg-[#F59E0B]/15 text-[#F59E0B] text-xs font-extrabold hover:bg-[#F59E0B]/25"
          >
            Configure Playable Moves ({currentProject.enabledActions.length}) →
          </button>
        </div>
      )}

      {/* TAB 3: TERRAIN & TEMPERATURE */}
      {activeTab === 'terrain' && (
        <div className="space-y-3">
          <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2.5">
            <div className="flex items-center justify-between">
              <FieldLabel text="Temperature Tolerance" />
              <Thermometer size={13} className="text-[#38BDF8]" />
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-[#949BB0]">
                Preferred Climate
              </span>
              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-white dark:bg-[#171A23]">
                {(['cold', 'temperate', 'warm'] as const).map((temp) => {
                  const active = profile.temperature.preferredTemp === temp;
                  return (
                    <button
                      key={temp}
                      type="button"
                      onClick={() =>
                        updateProfile('hero preferred climate', (prev) => ({
                          ...prev,
                          archetype: 'Custom',
                          temperature: { ...prev.temperature, preferredTemp: temp },
                        }))
                      }
                      className={`py-1.5 rounded-lg text-xs font-bold capitalize transition-colors ${
                        active
                          ? 'bg-[#7C5CFF] text-white'
                          : 'text-slate-500 dark:text-[#949BB0]'
                      }`}
                    >
                      {temp}
                    </button>
                  );
                })}
              </div>
            </div>

            <AffinityStepper
              label="Cold Resistance"
              hint="Snow weather, frost, night chill & freeze attacks"
              value={profile.temperature.coldResistance}
              onChange={(val) =>
                updateProfile('hero cold resistance', (prev) => ({
                  ...prev,
                  archetype: 'Custom',
                  temperature: { ...prev.temperature, coldResistance: val },
                }))
              }
            />
            <AffinityStepper
              label="Heat Resistance"
              hint="Scorching sun, desert heat & fire/burn attacks"
              value={profile.temperature.heatResistance}
              onChange={(val) =>
                updateProfile('hero heat resistance', (prev) => ({
                  ...prev,
                  archetype: 'Custom',
                  temperature: { ...prev.temperature, heatResistance: val },
                }))
              }
            />
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-1">
            <div className="flex items-center justify-between pb-1">
              <FieldLabel text="Terrain Strengths & Flaws" />
              <Mountain size={13} className="text-[#7C5CFF]" />
            </div>
            {TERRAIN_ROWS.map((row) => (
              <AffinityStepper
                key={row.key}
                label={row.label}
                hint={row.hint}
                value={profile.terrain[row.key]}
                onChange={(val) =>
                  updateProfile(`hero terrain ${row.key}`, (prev) => ({
                    ...prev,
                    archetype: 'Custom',
                    terrain: { ...prev.terrain, [row.key]: val },
                  }))
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: ENEMIES & ENVIRONMENTS */}
      {activeTab === 'matchups' && (
        <div className="space-y-3">
          <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-1">
            <div className="flex items-center justify-between pb-1">
              <FieldLabel text="Enemy Matchups" />
              <Swords size={13} className="text-[#F2545B]" />
            </div>
            {ENEMY_ROWS.map((row) => (
              <AffinityStepper
                key={row.key}
                label={row.label}
                hint={row.hint}
                value={profile.enemies[row.key]}
                onChange={(val) =>
                  updateProfile(`hero enemy ${row.key}`, (prev) => ({
                    ...prev,
                    archetype: 'Custom',
                    enemies: { ...prev.enemies, [row.key]: val },
                  }))
                }
              />
            ))}
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-1">
            <div className="flex items-center justify-between pb-1">
              <FieldLabel text="Environment Affinities" />
              <Compass size={13} className="text-[#20B46A]" />
            </div>
            {ENVIRONMENT_ROWS.map((row) => (
              <AffinityStepper
                key={row.key}
                label={row.label}
                hint={row.hint}
                value={profile.environments[row.key]}
                onChange={(val) =>
                  updateProfile(`hero environment ${row.key}`, (prev) => ({
                    ...prev,
                    archetype: 'Custom',
                    environments: { ...prev.environments, [row.key]: val },
                  }))
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: LOOK, 3D MODEL & MOVES */}
      {activeTab === 'look' && (
        <div className="space-y-3">
          <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-3">
            <div className="flex items-center justify-between">
              <FieldLabel text="3D Appearance & Colors" />
              <Shield size={13} className="text-[#7C5CFF]" />
            </div>

            <select
              value={currentProject.heroBody}
              onChange={(e) =>
                store.updateProject('change hero look', (p) => ({ ...p, heroBody: e.target.value }))
              }
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#171A23] text-xs font-bold border border-slate-200/70 dark:border-white/[0.08]"
            >
              {PresetLibrary.heroBodies.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-2.5">
              {(
                [
                  { key: 'tunic', label: 'Tunic' },
                  { key: 'cloak', label: 'Cloak' },
                  { key: 'hair', label: 'Hair' },
                  { key: 'skin', label: 'Skin' },
                ] as const
              ).map(({ key, label }) => (
                <label
                  key={key}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#171A23] text-xs font-semibold"
                >
                  <span>{label}</span>
                  <input
                    type="color"
                    value={currentProject.heroColors[key]}
                    onChange={(e) =>
                      store.updateProject(
                        'change hero color',
                        (p) => ({
                          ...p,
                          heroColors: { ...p.heroColors, [key]: e.target.value },
                        }),
                        false
                      )
                    }
                    className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer"
                  />
                </label>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-200/70 dark:border-white/[0.08] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold flex items-center gap-1.5">
                  <Box size={12} className="text-[#7C5CFF]" />
                  <span>3D Model Source</span>
                </span>
                <button
                  type="button"
                  onClick={() => store.setShowingAssetVault(true)}
                  className="text-[11px] font-bold text-[#7C5CFF] hover:underline inline-flex items-center gap-1"
                >
                  <Upload size={11} />
                  <span>Upload .glb</span>
                </button>
              </div>
              <select
                value={currentProject.heroCustomAssetId ?? ''}
                onChange={(e) =>
                  store.updateProject('change hero 3D model', (p) => ({
                    ...p,
                    heroCustomAssetId: e.target.value || undefined,
                  }))
                }
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#171A23] text-xs font-semibold border border-slate-200/70 dark:border-white/[0.08]"
              >
                <option value="">Native Look ({currentProject.heroBody})</option>
                {store.customAssets.map((a) => (
                  <option key={a.id} value={a.id}>
                    GLB: {a.name} ({a.animationClips.length} clips)
                  </option>
                ))}
              </select>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-semibold">
                  <span>World Scale</span>
                  <span className="tabular-nums">
                    {(currentProject.heroModelScale ?? 1).toFixed(2)}×
                  </span>
                </div>
                <input
                  type="range"
                  min={0.25}
                  max={3.5}
                  step={0.05}
                  value={currentProject.heroModelScale ?? 1}
                  onChange={(e) =>
                    store.updateProject(
                      'hero model scale',
                      (p) => ({ ...p, heroModelScale: Number(e.target.value) }),
                      false
                    )
                  }
                  className="w-full accent-[#7C5CFF]"
                />
              </div>

              {heroCustomAsset && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-semibold">
                    <span>Animation Speed</span>
                    <span className="tabular-nums">
                      {(currentProject.heroAnimSpeed ?? 1).toFixed(1)}×
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.4}
                    max={2.4}
                    step={0.1}
                    value={currentProject.heroAnimSpeed ?? 1}
                    onChange={(e) =>
                      store.updateProject(
                        'hero anim speed',
                        (p) => ({ ...p, heroAnimSpeed: Number(e.target.value) }),
                        false
                      )
                    }
                    className="w-full accent-[#7C5CFF]"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() =>
                heroCustomAsset?.category === 'character'
                  ? store.openCharacterMaker(heroCustomAsset.id)
                  : store.openCharacterMaker()
              }
              className="w-full py-2.5 rounded-xl bg-[#A855F7] text-white text-xs font-extrabold hover:bg-[#9333EA] inline-flex items-center justify-center gap-1.5"
            >
              <User size={13} />
              <span>
                {heroCustomAsset?.category === 'character'
                  ? 'Edit in Character Maker'
                  : 'Open Character Maker'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onOpenChatStudio('bubble')}
              className="w-full py-2 rounded-xl bg-[#7C5CFF]/15 text-[#7C5CFF] text-xs font-bold hover:bg-[#7C5CFF]/25 inline-flex items-center justify-center gap-1.5"
            >
              <MessageCircle size={13} />
              <span>Hero Chat Bubble &amp; Font</span>
            </button>

            <button
              type="button"
              onClick={() => store.openHeroActions()}
              className="w-full py-2 rounded-xl bg-[#F59E0B]/15 text-[#F59E0B] text-xs font-bold hover:bg-[#F59E0B]/25 inline-flex items-center justify-center gap-1.5"
            >
              <Sparkles size={13} />
              <span>Change Hero Moves ({currentProject.enabledActions.length})</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
