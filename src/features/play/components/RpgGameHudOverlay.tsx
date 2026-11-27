import React from 'react';
import {
  Backpack,
  Compass,
  Eye,
  FlaskConical,
  Heart,
  KeyRound,
  Map as MapIcon,
  MessageCircle,
  PanelBottom,
  Pause,
  RotateCcw,
  Shield,
  Skull,
  Sparkles,
  Sword,
  Target,
  Users,
  Volume2,
  VolumeX,
  Wand2,
} from 'lucide-react';
import type { HUDState, InventoryItemDef } from '../../../types/maker';
import { InventoryItemIcon } from '../../../components/shared/InventoryItemIcon';

export interface RpgStatsState {
  atkBonus: number;
  defBonus: number;
  magicBonus: number;
  potions: number;
  herbs: number;
  weaponName: string;
  activeCombatStyle: 'sword' | 'arrow' | 'magic';
}

export interface RpgGameHudOverlayProps {
  heroName: string;
  levelName: string;
  hudState: HUDState;
  rpgStats: RpgStatsState;
  heroAttackBonus: number;
  heroDefenseBonus: number;
  buddyHud: {
    found: number;
    total: number;
    names: string[];
  };
  allBuddyNames: string[];
  quickHotbarTools: { def: InventoryItemDef }[];
  heldItemId?: string | null;
  bagCount: number;
  bagKeyLabel: string;
  resolvedCamMode: string;
  worldMapOpen: boolean;
  inventoryOpen: boolean;
  muted: boolean;
  chatDisplayMode: 'bubbles' | 'bottomPanel';
  allowFannedCards: boolean;
  onTriggerSword: () => void;
  onTriggerArrow: () => void;
  onTriggerMagic: () => void;
  onTriggerHeal: () => void;
  onOpenTreasureCards: () => void;
  onHoldTool: (itemId: string) => void;
  onToggleMap: () => void;
  onToggleInventory: () => void;
  onCycleCamera: () => void;
  onTogglePause: () => void;
  onToggleMute: () => void;
  onRestart: () => void;
  onToggleChatMode: () => void;
  onBackToEditor: () => void;
}

export const RpgGameHudOverlay: React.FC<RpgGameHudOverlayProps> = ({
  heroName,
  levelName,
  hudState,
  rpgStats,
  heroAttackBonus,
  heroDefenseBonus,
  buddyHud,
  allBuddyNames,
  quickHotbarTools,
  heldItemId,
  bagCount,
  bagKeyLabel,
  resolvedCamMode,
  worldMapOpen,
  inventoryOpen,
  muted,
  chatDisplayMode,
  allowFannedCards,
  onTriggerSword,
  onTriggerArrow,
  onTriggerMagic,
  onTriggerHeal,
  onOpenTreasureCards,
  onHoldTool,
  onToggleMap,
  onToggleInventory,
  onCycleCamera,
  onTogglePause,
  onToggleMute,
  onRestart,
  onToggleChatMode,
  onBackToEditor,
}) => {
  const maxHearts = Math.max(1, hudState.maxHealth);
  const curHearts = Math.max(0, Math.min(maxHearts, hudState.health));
  const hpPct = Math.min(100, Math.max(0, (curHearts / maxHearts) * 100));
  const hpDisplayCur = Math.round(curHearts * 20);
  const hpDisplayMax = Math.round(maxHearts * 20);

  const mpCur = Math.round(Math.max(0, Math.min(100, hudState.magic)));
  const mpPct = mpCur;

  const totalAtk = 10 + rpgStats.atkBonus + heroAttackBonus;
  const totalDef = 4 + rpgStats.defBonus + heroDefenseBonus;
  const totalMag = 12 + rpgStats.magicBonus;
  const totalRng = 8 + Math.round((rpgStats.atkBonus + heroAttackBonus) * 0.85);

  const bossMax = Math.max(1, hudState.bossMaxHealth ?? 10);
  const bossCur = Math.max(0, hudState.bossHealth ?? 0);
  const bossPct = Math.min(100, Math.max(0, (bossCur / bossMax) * 100));

  return (
    <>
      {/* =====================================================================
          ZONE 1 (TOP-LEFT): HERO STATUS CREST & PARTY COMPANION FRAMES
         ===================================================================== */}
      <div className="pointer-events-none fixed top-4 left-4 z-30 flex flex-col gap-2.5 w-[308px] max-w-[42vw]">
        {/* Primary Hero Character Plaque */}
        <div className="pointer-events-auto rounded-2xl bg-[#0B0E17]/92 border border-amber-500/35 backdrop-blur-md shadow-[0_16px_40px_rgba(0,0,0,0.75)] p-3.5 text-slate-100">
          {/* Header Row: Medallion + Hero Name & Weapon + Gold/Keys */}
          <div className="flex items-center justify-between gap-2.5 pb-2.5 border-b border-white/10">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/30 via-amber-700/20 to-slate-900 border border-amber-400/50 flex items-center justify-center shrink-0 shadow-inner">
                {rpgStats.activeCombatStyle === 'magic' ? (
                  <Wand2 className="w-5 h-5 text-purple-300" />
                ) : rpgStats.activeCombatStyle === 'arrow' ? (
                  <Target className="w-5 h-5 text-emerald-300" />
                ) : (
                  <Sword className="w-5 h-5 text-amber-300" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-black tracking-tight text-white truncate">
                  {heroName || 'Hero'}
                </div>
                <div className="text-[11px] font-bold text-amber-300/95 truncate">
                  {rpgStats.weaponName}
                </div>
              </div>
            </div>

            {/* Unboxed Clean Wealth & Keys Counter */}
            <div className="flex items-center gap-2 text-xs font-extrabold tabular-nums shrink-0 text-slate-200">
              <span className="text-amber-300" title="Gold Coins">
                {hudState.coins} Gold
              </span>
              {hudState.keys > 0 && (
                <>
                  <span className="text-white/25" aria-hidden="true">
                    ·
                  </span>
                  <span className="inline-flex items-center gap-1 text-amber-200" title="Keys">
                    <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                    {hudState.keys}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Vitality (HP) & Arcane Mana (MP) Bars */}
          <div className="mt-2.5 space-y-2">
            {/* HP Bar */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-extrabold mb-1">
                <span className="inline-flex items-center gap-1.5 text-rose-300">
                  <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-400" />
                  <span>Vitality</span>
                </span>
                <span className="tabular-nums text-white font-black">
                  {hpDisplayCur} / {hpDisplayMax}{' '}
                  <span className="text-[10px] font-bold text-rose-300/80">
                    ({curHearts}/{maxHearts})
                  </span>
                </span>
              </div>
              <div className="h-3.5 w-full rounded-lg bg-slate-950/90 border border-white/15 overflow-hidden relative p-0.5">
                <div
                  className="h-full rounded-md transition-all duration-150"
                  style={{
                    width: `${Math.max(4, hpPct)}%`,
                    background: hudState.flashHealth
                      ? '#FFFFFF'
                      : 'linear-gradient(90deg, #BE123C 0%, #E11D48 55%, #FB7185 100%)',
                  }}
                />
              </div>
            </div>

            {/* MP Bar */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-extrabold mb-1">
                <span className="inline-flex items-center gap-1.5 text-indigo-300">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Arcane Mana</span>
                </span>
                <span className="tabular-nums text-white font-black">{mpCur} / 100</span>
              </div>
              <div className="h-2.5 w-full rounded-lg bg-slate-950/90 border border-white/15 overflow-hidden relative p-0.5">
                <div
                  className="h-full rounded-md transition-all duration-150"
                  style={{
                    width: `${Math.max(3, mpPct)}%`,
                    background: 'linear-gradient(90deg, #4338CA 0%, #6366F1 55%, #A855F7 100%)',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Primary Combat Attributes Row (Clean unboxed tabular stats) */}
          <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-xs font-extrabold tabular-nums">
            <div className="flex items-center gap-1.5" title="Melee & Physical Attack Power">
              <span className="text-slate-400 font-bold">ATK</span>
              <span className="text-rose-300 text-sm font-black">{totalAtk}</span>
            </div>
            <span className="text-white/20" aria-hidden="true">
              ·
            </span>
            <div className="flex items-center gap-1.5" title="Armor & Damage Reduction">
              <span className="text-slate-400 font-bold">DEF</span>
              <span className="text-sky-300 text-sm font-black">{totalDef}</span>
            </div>
            <span className="text-white/20" aria-hidden="true">
              ·
            </span>
            <div className="flex items-center gap-1.5" title="Arcane Spell Power">
              <span className="text-slate-400 font-bold">MAG</span>
              <span className="text-purple-300 text-sm font-black">{totalMag}</span>
            </div>
            <span className="text-white/20" aria-hidden="true">
              ·
            </span>
            <div className="flex items-center gap-1.5" title="Stamina Reserve">
              <span className="text-slate-400 font-bold">STM</span>
              <span className="text-emerald-300 text-sm font-black">
                {Math.round(hudState.stamina)}%
              </span>
            </div>
          </div>
        </div>

        {/* Party Companion Frames */}
        {buddyHud.total > 0 && (
          <div className="pointer-events-auto rounded-xl bg-[#0B0E17]/88 border border-white/15 backdrop-blur-md px-3 py-2 shadow-xl">
            <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-300 mb-1.5">
              <span className="inline-flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-amber-400" />
                <span>Companion Party</span>
              </span>
              <span className="tabular-nums text-amber-300">
                {buddyHud.found} / {buddyHud.total} Joined
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {(allBuddyNames.length > 0 ? allBuddyNames : ['Sir Gareth', 'Lyra', 'Pip']).map(
                (fullName, idx) => {
                  const shortName = fullName.split(' ')[0];
                  const isRecruited =
                    buddyHud.names.some(
                      (n) =>
                        n.toLowerCase() === shortName.toLowerCase() ||
                        fullName.toLowerCase().includes(n.toLowerCase())
                    ) || idx < buddyHud.found;
                  return (
                    <div
                      key={`${fullName}-${idx}`}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-extrabold inline-flex items-center gap-1.5 transition-colors ${
                        isRecruited
                          ? 'bg-emerald-950/70 border-emerald-400/45 text-emerald-200'
                          : 'bg-slate-900/60 border-white/10 text-slate-400'
                      }`}
                    >
                      <Shield
                        className={`w-3 h-3 ${
                          isRecruited ? 'text-emerald-400' : 'text-slate-500'
                        }`}
                      />
                      <span className="truncate max-w-[92px]">{fullName}</span>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        )}
      </div>

      {/* =====================================================================
          ZONE 2 (TOP-CENTER): STREAMLINED RPG REGION HEADER & BOSS HEALTH BAR
         ===================================================================== */}
      <div className="pointer-events-none fixed top-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 max-w-[92vw]">
        <div className="pointer-events-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl bg-[#0B0E17]/92 border border-amber-500/35 backdrop-blur-md shadow-2xl text-white">
          <div className="flex items-center gap-2 px-2.5 py-1">
            <Compass className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-xs font-black tracking-tight text-amber-100 whitespace-nowrap truncate max-w-[200px]">
              {levelName}
            </span>
          </div>

          <div className="h-4 w-px bg-white/15" />

          <button
            type="button"
            onClick={onToggleMap}
            className={`px-2.5 h-8 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              worldMapOpen
                ? 'bg-amber-500 text-slate-950'
                : 'hover:bg-white/10 text-slate-200'
            }`}
            title="Open World Map (M)"
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span>Map</span>
            <span className="text-[10px] opacity-70 font-mono">M</span>
          </button>

          <button
            type="button"
            onClick={onToggleInventory}
            className={`px-2.5 h-8 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              inventoryOpen
                ? 'bg-amber-500 text-slate-950'
                : 'hover:bg-white/10 text-slate-200'
            }`}
            title={`Open Satchel & Equipment (${bagKeyLabel})`}
          >
            <Backpack className="w-3.5 h-3.5" />
            <span>Satchel</span>
            <span className="tabular-nums text-[11px] opacity-80">({bagCount})</span>
          </button>

          <button
            type="button"
            onClick={onCycleCamera}
            className="px-2.5 h-8 rounded-xl hover:bg-white/10 text-slate-200 text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            title="Cycle Camera View (V)"
          >
            <Eye className="w-3.5 h-3.5 text-amber-300" />
            <span>
              {resolvedCamMode === 'firstPerson'
                ? 'First-Person'
                : resolvedCamMode === 'heroFront'
                ? 'Hero Front'
                : 'Isometric'}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleChatMode}
            className="px-2 h-8 rounded-xl hover:bg-white/10 text-slate-200 text-xs font-bold inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
            title="Switch between 3D Chat Bubbles and Bottom Dialogue Panel"
          >
            {chatDisplayMode === 'bubbles' ? (
              <MessageCircle className="w-3.5 h-3.5" />
            ) : (
              <PanelBottom className="w-3.5 h-3.5" />
            )}
          </button>

          <div className="h-4 w-px bg-white/15" />

          <button
            type="button"
            onClick={onTogglePause}
            className="w-8 h-8 rounded-xl hover:bg-white/10 text-slate-200 flex items-center justify-center transition-colors shrink-0"
            title="Pause Game (Esc)"
          >
            <Pause className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            className="w-8 h-8 rounded-xl hover:bg-white/10 text-slate-200 flex items-center justify-center transition-colors shrink-0"
            title="Toggle Audio"
          >
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={onRestart}
            className="w-8 h-8 rounded-xl hover:bg-white/10 text-slate-200 flex items-center justify-center transition-colors shrink-0"
            title="Restart Adventure"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onBackToEditor}
            className="px-3 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-extrabold transition-colors whitespace-nowrap shrink-0"
          >
            Editor
          </button>
        </div>

        {/* Active Boss Health Bar */}
        {hudState.bossName && (
          <div className="w-[360px] max-w-[85vw] rounded-2xl bg-[#0B0E17]/94 border border-rose-500/50 px-4 py-2.5 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between text-xs font-black text-rose-200 mb-1">
              <span className="inline-flex items-center gap-1.5 truncate">
                <Skull className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="truncate">{hudState.bossName}</span>
              </span>
              <span className="tabular-nums text-rose-300">
                {Math.round(bossCur * 10)} / {Math.round(bossMax * 10)}
              </span>
            </div>
            <div className="h-3 w-full rounded-lg bg-slate-950 border border-rose-500/30 overflow-hidden p-0.5">
              <div
                className="h-full rounded-md bg-gradient-to-r from-rose-700 via-red-500 to-amber-400 transition-all duration-150"
                style={{ width: `${Math.max(4, bossPct)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* =====================================================================
          ZONE 3 (TOP-RIGHT): QUEST & CHRONICLE TRACKER
         ===================================================================== */}
      {hudState.objectives.length > 0 && (
        <div className="pointer-events-none fixed top-14 right-4 z-20 w-[240px] rounded-2xl bg-[#0B0E17]/88 border border-amber-500/25 backdrop-blur-md px-3.5 py-2.5 text-slate-100 shadow-xl hidden md:block">
          <div className="text-[11px] font-black tracking-wide text-amber-300 mb-1.5">
            Chronicle Objectives
          </div>
          <div className="space-y-1">
            {hudState.objectives.slice(0, 3).map((goal, idx) => (
              <div
                key={idx}
                className="text-xs font-semibold text-slate-200 leading-snug flex items-start gap-1.5"
              >
                <span className="text-amber-400 font-black">•</span>
                <span>{goal}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =====================================================================
          ZONE 4 (BOTTOM-CENTER): SINGLE UNIFIED ISOMETRIC RPG COMMAND DOCK
         ===================================================================== */}
      <div className="pointer-events-auto fixed bottom-4 left-1/2 -translate-x-1/2 z-30 max-w-[96vw]">
        <div className="flex flex-wrap items-center justify-center gap-2 px-3 py-2.5 rounded-2xl bg-[#0B0E17]/95 border border-amber-500/45 backdrop-blur-md shadow-[0_20px_50px_rgba(0,0,0,0.85)]">
          {/* [1] Sword Slash */}
          <button
            type="button"
            onClick={onTriggerSword}
            className={`group relative flex items-center gap-2.5 px-3.5 py-2 rounded-xl border text-left transition-all active:scale-95 whitespace-nowrap shrink-0 ${
              rpgStats.activeCombatStyle === 'sword'
                ? 'bg-gradient-to-b from-amber-500/35 to-amber-900/40 border-amber-400 text-white shadow-[0_0_20px_rgba(245,158,11,0.25)]'
                : 'bg-slate-900/90 hover:bg-slate-800/90 border-white/15 text-slate-200'
            }`}
            title="Melee Sword Slash (Press 1, J, or Space)"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
              <Sword className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-white">Sword Slash</span>
                <span className="px-1.5 py-0.2 rounded bg-black/40 border border-white/15 text-[10px] font-mono font-black text-amber-200">
                  1
                </span>
              </div>
              <div className="text-[10px] font-bold text-amber-300/90 tabular-nums">
                ATK {totalAtk} · Melee Arc
              </div>
            </div>
          </button>

          {/* [2] Bow & Arrow */}
          <button
            type="button"
            onClick={onTriggerArrow}
            className={`group relative flex items-center gap-2.5 px-3.5 py-2 rounded-xl border text-left transition-all active:scale-95 whitespace-nowrap shrink-0 ${
              rpgStats.activeCombatStyle === 'arrow'
                ? 'bg-gradient-to-b from-emerald-500/35 to-emerald-900/40 border-emerald-400 text-white shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                : 'bg-slate-900/90 hover:bg-slate-800/90 border-white/15 text-slate-200'
            }`}
            title="Shoot Ranged Bow & Arrow (Press 2 or R)"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
              <Target className="w-4 h-4 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-white">Bow &amp; Arrow</span>
                <span className="px-1.5 py-0.2 rounded bg-black/40 border border-white/15 text-[10px] font-mono font-black text-emerald-200">
                  2
                </span>
              </div>
              <div className="text-[10px] font-bold text-emerald-300/90 tabular-nums">
                DMG {totalRng} · Ranged
              </div>
            </div>
          </button>

          {/* [3] Magic Zap */}
          <button
            type="button"
            onClick={onTriggerMagic}
            className={`group relative flex items-center gap-2.5 px-3.5 py-2 rounded-xl border text-left transition-all active:scale-95 whitespace-nowrap shrink-0 ${
              rpgStats.activeCombatStyle === 'magic'
                ? 'bg-gradient-to-b from-purple-500/35 to-indigo-900/40 border-purple-400 text-white shadow-[0_0_20px_rgba(168,85,247,0.25)]'
                : 'bg-slate-900/90 hover:bg-slate-800/90 border-white/15 text-slate-200'
            }`}
            title="Cast Arcane Lightning Zap — Costs 18 MP (Press 3 or F)"
          >
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-400/40 flex items-center justify-center shrink-0">
              <Wand2 className="w-4 h-4 text-purple-300" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-white">Magic Zap</span>
                <span className="px-1.5 py-0.2 rounded bg-black/40 border border-white/15 text-[10px] font-mono font-black text-purple-200">
                  3
                </span>
              </div>
              <div className="text-[10px] font-bold text-purple-300/90 tabular-nums">
                MAG {totalMag} · 18 MP
              </div>
            </div>
          </button>

          <div className="h-8 w-px bg-white/15 mx-0.5 hidden sm:block" />

          {/* [4] Healing Draught (Potions & Wild Herbs) */}
          <button
            type="button"
            onClick={onTriggerHeal}
            className="group relative flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-rose-950/60 border border-rose-400/35 text-left transition-all active:scale-95 whitespace-nowrap shrink-0"
            title="Use Health Potion or Wild Healing Herb (Press 4 or H)"
          >
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-400/40 flex items-center justify-center shrink-0">
              <FlaskConical className="w-4 h-4 text-rose-300" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-white">Heal Elixir</span>
                <span className="px-1.5 py-0.2 rounded bg-black/40 border border-white/15 text-[10px] font-mono font-black text-rose-200">
                  4
                </span>
              </div>
              <div className="text-[10px] font-bold text-rose-200/90 tabular-nums">
                {rpgStats.potions} Potion · {rpgStats.herbs} Herb
              </div>
            </div>
          </button>

          {/* Integrated Utility Tool Slots (replaces the old overlapping bottom tool bar) */}
          {quickHotbarTools
            .filter(({ def }) => def.id !== 'parachute_blanket' && def.category === 'tool')
            .slice(0, 2)
            .map(({ def }) => {
              const isHeld = heldItemId === def.id;
              return (
                <button
                  key={def.id}
                  type="button"
                  onClick={() => onHoldTool(def.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all active:scale-95 whitespace-nowrap shrink-0 ${
                    isHeld
                      ? 'bg-sky-500/25 border-sky-400 text-white'
                      : 'bg-slate-900/85 hover:bg-slate-800 border-white/15 text-slate-300'
                  }`}
                  title={`Equip ${def.name}`}
                >
                  <div className="w-7 h-7 rounded-lg bg-black/35 border border-white/10 flex items-center justify-center shrink-0">
                    <InventoryItemIcon
                      icon={def.icon}
                      size={15}
                      color={isHeld ? '#38BDF8' : def.colorHex}
                    />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-white max-w-[92px] truncate">
                      {def.name}
                    </div>
                    <div className="text-[10px] font-bold text-slate-400">
                      {isHeld ? 'Equipped' : 'Tool'}
                    </div>
                  </div>
                </button>
              );
            })}

          {/* [★] Fanned Destiny Treasure Cards */}
          {allowFannedCards && (
            <>
              <div className="h-8 w-px bg-white/15 mx-0.5 hidden sm:block" />
              <button
                type="button"
                onClick={onOpenTreasureCards}
                className="group relative flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500/25 via-fuchsia-500/20 to-sky-500/25 hover:from-amber-500/40 hover:via-fuchsia-500/35 hover:to-sky-500/40 border border-amber-300/50 text-left transition-all active:scale-95 whitespace-nowrap shrink-0"
                title="Open Fanned-Out Colorful Destiny Reward Cards"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-400/20 border border-amber-300/50 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-amber-200" />
                </div>
                <div>
                  <div className="text-xs font-black text-amber-100">Destiny Cards</div>
                  <div className="text-[10px] font-bold text-amber-200/85">3-Card Choice</div>
                </div>
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
};
