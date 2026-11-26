import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Coins,
  KeyRound,
  PackageOpen,
  Sparkles,
  X,
} from 'lucide-react';
import { resolveItemMetadata } from '../../data/registries';
import type { InventoryItemDef, ItemRarity } from '../../types/maker';
import { ItemThumbnailArt } from '../shared/ItemThumbnailArt';
import { RARITY_COLORS } from './ItemTooltip';

export interface ChestLootEntry {
  uid: string;
  kind: 'coin' | 'key' | 'item';
  qty: number;
  label: string;
  subtitle: string;
  rarity: ItemRarity;
  itemId?: string;
  itemDef?: InventoryItemDef;
}

interface ChestLootModalProps {
  chestName: string;
  entries: ChestLootEntry[];
  onTakeEntry: (entryUid: string) => void;
  onTakeAll: () => void;
  onClose: () => void;
}

export const ChestLootModal: React.FC<ChestLootModalProps> = ({
  chestName,
  entries,
  onTakeEntry,
  onTakeAll,
  onClose,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const rowRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    setSelectedIndex((prev) => {
      if (entries.length === 0) return 0;
      return Math.max(0, Math.min(prev, entries.length - 1));
    });
  }, [entries.length]);

  const activeEntry = entries[selectedIndex] ?? entries[0] ?? null;

  useEffect(() => {
    const el = rowRefs.current[selectedIndex];
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  const stepSelection = (delta: -1 | 1) => {
    if (entries.length <= 1) return;
    setSelectedIndex((prev) => (prev + delta + entries.length) % entries.length);
  };

  const mountedAtRef = useRef<number>(typeof performance !== 'undefined' ? performance.now() : 0);

  useEffect(() => {
    mountedAtRef.current = typeof performance !== 'undefined' ? performance.now() : 0;
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'ArrowUp' || e.code === 'ArrowLeft' || e.code === 'KeyW' || e.code === 'KeyA') {
        e.preventDefault();
        e.stopPropagation();
        if (entries.length > 0) {
          setSelectedIndex((prev) => (prev - 1 + entries.length) % entries.length);
        }
        return;
      }
      if (e.code === 'ArrowDown' || e.code === 'ArrowRight' || e.code === 'KeyS' || e.code === 'KeyD') {
        e.preventDefault();
        e.stopPropagation();
        if (entries.length > 0) {
          setSelectedIndex((prev) => (prev + 1) % entries.length);
        }
        return;
      }
      const justMounted =
        typeof performance !== 'undefined' && performance.now() - mountedAtRef.current < 140;
      if ((e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') && !e.repeat) {
        e.preventDefault();
        e.stopPropagation();
        if (justMounted) return;
        const target = entries[selectedIndex] ?? entries[0];
        if (target) onTakeEntry(target.uid);
        return;
      }
      if ((e.code === 'KeyF' || e.code === 'KeyT') && !e.repeat) {
        e.preventDefault();
        e.stopPropagation();
        if (justMounted) return;
        if (entries.length > 0) onTakeAll();
        return;
      }
      if ((e.code === 'Escape' || e.code === 'Tab') && !e.repeat) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [entries, selectedIndex, onTakeEntry, onTakeAll, onClose]);

  const activeMeta = useMemo(
    () => (activeEntry?.itemDef ? resolveItemMetadata(activeEntry.itemDef) : null),
    [activeEntry]
  );

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl rounded-3xl bg-[#131722] text-[#F3F5FA] border border-[#FACC15]/35 shadow-2xl overflow-hidden maker-panel-rise">
        {/* Golden Chest Header */}
        <div className="relative flex items-center justify-between gap-3 px-6 py-4 bg-gradient-to-r from-[#2A200E] via-[#1B1D29] to-[#151926] border-b border-[#FACC15]/20">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-[#FACC15]/18 border border-[#FACC15]/45 text-[#FACC15] flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(250,204,21,0.28)]">
              <PackageOpen size={22} />
            </div>
            <div className="min-w-0">
              <div className="text-[10.5px] font-extrabold uppercase tracking-widest text-[#FACC15]">
                Treasure Chest Contents
              </div>
              <h2 className="text-lg sm:text-xl font-black truncate">{chestName}</h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="px-2.5 py-1 rounded-lg bg-white/8 border border-white/10 text-[11px] font-bold text-amber-200 tabular-nums">
              {entries.length} {entries.length === 1 ? 'item' : 'items'} inside
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close chest"
              className="p-2 rounded-xl bg-white/8 hover:bg-white/15 text-slate-300 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Main Content: Scrollable Chest Contents + Directional Arrows + Item Detail */}
        <div className="p-5 grid grid-cols-1 md:grid-cols-[1.2fr_0.95fr] gap-4">
          {/* Left: Contents List + On-Screen Directional Arrows */}
          <div className="flex flex-col gap-2.5 min-h-0">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 px-1">
              <span>Use &uarr; &darr; arrows to browse contents</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => stepSelection(-1)}
                  disabled={entries.length <= 1}
                  aria-label="Previous item"
                  className="p-1 rounded-lg bg-white/8 hover:bg-white/15 disabled:opacity-35 text-amber-200 border border-white/10"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => stepSelection(1)}
                  disabled={entries.length <= 1}
                  aria-label="Next item"
                  className="p-1 rounded-lg bg-white/8 hover:bg-white/15 disabled:opacity-35 text-amber-200 border border-white/10"
                >
                  <ChevronDown size={14} />
                </button>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {entries.map((entry, idx) => {
                const isSelected = idx === selectedIndex;
                const rarityColor = RARITY_COLORS[entry.rarity] ?? RARITY_COLORS.common;
                return (
                  <button
                    key={entry.uid}
                    ref={(el) => {
                      rowRefs.current[idx] = el;
                    }}
                    type="button"
                    onClick={() => setSelectedIndex(idx)}
                    onDoubleClick={() => onTakeEntry(entry.uid)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? 'bg-[#FACC15]/14 border-[#FACC15] shadow-[0_0_16px_rgba(250,204,21,0.16)]'
                        : 'bg-[#1A1F2E] border-white/10 hover:border-white/25 hover:bg-[#202638]'
                    }`}
                  >
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border"
                      style={{
                        backgroundColor:
                          entry.kind === 'coin'
                            ? 'rgba(250,204,21,0.15)'
                            : entry.kind === 'key'
                            ? 'rgba(56,189,248,0.15)'
                            : 'rgba(255,255,255,0.05)',
                        borderColor:
                          entry.kind === 'coin'
                            ? 'rgba(250,204,21,0.45)'
                            : entry.kind === 'key'
                            ? 'rgba(56,189,248,0.45)'
                            : `${rarityColor}66`,
                      }}
                    >
                      {entry.kind === 'coin' ? (
                        <Coins size={22} className="text-[#FACC15]" />
                      ) : entry.kind === 'key' ? (
                        <KeyRound size={21} className="text-[#38BDF8]" />
                      ) : entry.itemDef ? (
                        <ItemThumbnailArt
                          meshKind={entry.itemDef.meshKind}
                          colorHex={entry.itemDef.colorHex}
                          size={34}
                        />
                      ) : (
                        <Sparkles size={20} className="text-[#FACC15]" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold truncate text-white">
                          {entry.label}
                        </span>
                        {entry.qty > 1 && (
                          <span className="px-1.5 py-0.5 rounded-md bg-white/10 text-[11px] font-black text-amber-200 tabular-nums shrink-0">
                            &times;{entry.qty}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400 truncate">
                        <span
                          className="font-bold uppercase tracking-wider text-[10px]"
                          style={{ color: rarityColor }}
                        >
                          {entry.rarity}
                        </span>
                        <span>&middot;</span>
                        <span className="truncate">{entry.subtitle}</span>
                      </div>
                    </div>

                    {isSelected && (
                      <span className="px-2 py-1 rounded-lg bg-[#FACC15] text-[#171206] text-[10.5px] font-black uppercase tracking-wider shrink-0">
                        Focus
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Focused Entry Inspector & Action Buttons */}
          <div className="flex flex-col justify-between rounded-2xl bg-[#181D2B] border border-white/10 p-4 space-y-4">
            {activeEntry ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-black/30 border border-white/10 flex items-center justify-center shrink-0">
                    {activeEntry.kind === 'coin' ? (
                      <Coins size={26} className="text-[#FACC15]" />
                    ) : activeEntry.kind === 'key' ? (
                      <KeyRound size={24} className="text-[#38BDF8]" />
                    ) : activeEntry.itemDef ? (
                      <ItemThumbnailArt
                        meshKind={activeEntry.itemDef.meshKind}
                        colorHex={activeEntry.itemDef.colorHex}
                        size={40}
                      />
                    ) : (
                      <Sparkles size={24} className="text-[#FACC15]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-base font-black text-white leading-tight truncate">
                      {activeEntry.label}
                    </div>
                    <div className="text-xs font-semibold text-amber-300 tabular-nums mt-0.5">
                      {activeEntry.kind === 'coin'
                        ? `+${activeEntry.qty} Coins`
                        : activeEntry.kind === 'key'
                        ? `+${activeEntry.qty} Key`
                        : `Quantity: ${activeEntry.qty}`}
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {activeEntry.itemDef?.description || activeEntry.subtitle}
                </p>

                {activeEntry.itemDef && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {activeEntry.itemDef.attackBonus ? (
                      <span className="px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-400/30 text-[10.5px] font-bold text-rose-200">
                        +{activeEntry.itemDef.attackBonus} ATK
                      </span>
                    ) : null}
                    {activeEntry.itemDef.defenseBonus ? (
                      <span className="px-2 py-0.5 rounded-md bg-sky-500/15 border border-sky-400/30 text-[10.5px] font-bold text-sky-200">
                        +{activeEntry.itemDef.defenseBonus} DEF
                      </span>
                    ) : null}
                    {activeEntry.itemDef.maxHealthBonus ? (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/30 text-[10.5px] font-bold text-emerald-200">
                        +{activeEntry.itemDef.maxHealthBonus} Max HP
                      </span>
                    ) : null}
                    {activeEntry.itemDef.healAmount ? (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/30 text-[10.5px] font-bold text-emerald-200">
                        +{activeEntry.itemDef.healAmount} Heal
                      </span>
                    ) : null}
                    {activeEntry.itemDef.speedBonus ? (
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-400/30 text-[10.5px] font-bold text-amber-200">
                        +{Math.round(activeEntry.itemDef.speedBonus * 100)}% Speed
                      </span>
                    ) : null}
                    {activeMeta?.magic_effect && (
                      <div className="w-full text-[11px] text-amber-200/85 pt-1">
                        {activeMeta.magic_effect}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-400">Chest is empty.</div>
            )}

            <div className="space-y-2 pt-2 border-t border-white/10">
              <button
                type="button"
                disabled={!activeEntry}
                onClick={() => activeEntry && onTakeEntry(activeEntry.uid)}
                className="w-full py-2.5 px-3 rounded-xl bg-[#FACC15] hover:bg-[#FDE047] disabled:opacity-40 text-[#171206] text-xs font-black flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <span>Take Selected</span>
                <span className="px-1.5 py-0.5 rounded bg-black/15 font-mono text-[10px]">
                  Enter / E
                </span>
              </button>

              <button
                type="button"
                disabled={entries.length === 0}
                onClick={onTakeAll}
                className="w-full py-2.5 px-3 rounded-xl bg-[#20B46A] hover:bg-[#24C876] disabled:opacity-40 text-white text-xs font-extrabold flex items-center justify-center gap-2 transition-colors"
              >
                <CheckCheck size={15} />
                <span>Take All ({entries.length})</span>
                <span className="px-1.5 py-0.5 rounded bg-black/20 font-mono text-[10px]">
                  F
                </span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2 rounded-xl bg-white/8 hover:bg-white/14 text-xs font-bold text-slate-300"
              >
                Close &amp; Leave Rest (Esc)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
