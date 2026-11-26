import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Shield, Swords, Weight, Zap } from 'lucide-react';
import { resolveItemMetadata } from '../../data/registries';
import type {
  InventoryCategoryConfig,
  InventoryItemDef,
  InventoryStack,
  InventoryStatProfile,
} from '../../types/maker';
import { ItemThumbnailArt } from '../shared/ItemThumbnailArt';

export const RARITY_COLORS: Record<string, string> = {
  common: '#94A3B8',
  uncommon: '#20B46A',
  rare: '#38BDF8',
  epic: '#A855F7',
  legendary: '#FACC15',
};

export const RARITY_RANK: Record<string, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
  legendary: 5,
};

export interface StatReadout {
  label: string;
  value: string;
  accent?: string;
}

export function buildContextualStats(
  item: InventoryItemDef,
  activeTab?: InventoryCategoryConfig
): StatReadout[] {
  const rows: StatReadout[] = [];
  const profile: InventoryStatProfile =
    activeTab && activeTab.statProfile !== 'auto'
      ? activeTab.statProfile
      : item.category === 'weapon' || item.category === 'tool'
      ? 'weapon'
      : item.category === 'wearable'
      ? 'apparel'
      : item.category === 'consumable'
      ? 'consumable'
      : 'material';

  const l1 = activeTab?.statLabels?.primary?.trim();
  const l2 = activeTab?.statLabels?.secondary?.trim();
  const l3 = activeTab?.statLabels?.tertiary?.trim();

  if (profile === 'weapon') {
    const dmg = 1 + (item.attackBonus ?? 0);
    rows.push({
      label: l1 || 'Damage',
      value: `${dmg} ATK`,
      accent: '#38BDF8',
    });
    rows.push({
      label: l2 || 'Reach',
      value: `${(item.weaponRange ?? 2.6).toFixed(1)}m`,
      accent: '#E2E8F0',
    });
    rows.push({
      label: l3 || 'Role',
      value:
        item.toolKind === 'axe'
          ? 'Timber & Melee'
          : item.toolKind === 'fishingPole'
          ? 'Angling Rod'
          : item.toolKind === 'torch'
          ? 'Cave Light'
          : 'Combat Strike',
      accent: '#FACC15',
    });
  } else if (profile === 'apparel') {
    rows.push({
      label: l1 || 'Defense',
      value: `+${item.defenseBonus ?? 0} DEF`,
      accent: '#38BDF8',
    });
    if (item.wearSlot === 'offhand' || typeof item.blockReduction === 'number') {
      rows.push({
        label: l2 || 'Guard Block',
        value: `${Math.round((item.blockReduction ?? 0.65) * 100)}% DMG`,
        accent: '#60A5FA',
      });
    } else {
      rows.push({
        label: l2 || 'Vitality',
        value: item.maxHealthBonus ? `+${item.maxHealthBonus} Max HP` : 'Standard',
        accent: '#F2545B',
      });
    }
    rows.push({
      label: l3 || 'Agility',
      value: item.speedBonus
        ? `+${Math.round(item.speedBonus * 100)}% SPD`
        : item.attackBonus
        ? `+${item.attackBonus} ATK`
        : item.wearSlot === 'offhand'
        ? 'Off-Hand'
        : item.wearSlot ?? 'Equip',
      accent: '#20B46A',
    });
  } else if (profile === 'consumable') {
    rows.push({
      label: l1 || 'Heal',
      value: item.healAmount ? `+${item.healAmount} HP` : '—',
      accent: '#F2545B',
    });
    rows.push({
      label: l2 || 'Stamina',
      value: item.staminaAmount ? `+${item.staminaAmount}%` : '—',
      accent: '#F59E0B',
    });
    rows.push({
      label: l3 || 'Magic',
      value: item.magicAmount ? `+${item.magicAmount} MP` : '—',
      accent: '#A855F7',
    });
  } else if (profile === 'magic') {
    rows.push({
      label: l1 || 'Magic Power',
      value: item.magicAmount
        ? `+${item.magicAmount} MP`
        : item.attackBonus
        ? `+${item.attackBonus} ATK`
        : 'Arcane',
      accent: '#A855F7',
    });
    rows.push({
      label: l2 || 'Heal',
      value: item.healAmount ? `+${item.healAmount} HP` : '—',
      accent: '#20B46A',
    });
    rows.push({
      label: l3 || 'Class',
      value: item.category,
      accent: '#38BDF8',
    });
  } else {
    rows.push({
      label: l1 || 'Craft Use',
      value: 'Mixable',
      accent: '#A855F7',
    });
    if (item.magicAmount || item.magicEffect) {
      rows.push({
        label: l2 || 'Magic',
        value: item.magicAmount ? `+${item.magicAmount} MP` : 'Active',
        accent: '#34D399',
      });
    }
    rows.push({
      label: l3 || 'Type',
      value: item.category,
      accent: '#CBD5E1',
    });
  }

  if (item.customStats && item.customStats.length > 0) {
    for (const cs of item.customStats) {
      if (cs.label.trim() && cs.value.trim()) {
        rows.push({ label: cs.label.trim(), value: cs.value.trim(), accent: '#E2E8F0' });
      }
    }
  }
  return rows;
}

export interface TooltipHoverState {
  item: InventoryItemDef;
  stack?: InventoryStack | null;
  x: number;
  y: number;
  statusTag?: string;
  hint?: string;
}

interface ItemTooltipProps {
  hover: TooltipHoverState | null;
  activeTab?: InventoryCategoryConfig;
}

export const ItemTooltip: React.FC<ItemTooltipProps> = ({ hover, activeTab }) => {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState<{ left: number; top: number }>({ left: 0, top: 0 });

  useLayoutEffect(() => {
    if (!hover || typeof window === 'undefined') return;
    const pad = 14;
    const el = boxRef.current;
    const w = el?.offsetWidth ?? 292;
    const h = el?.offsetHeight ?? 240;

    let left = hover.x + 16;
    if (left + w + pad > window.innerWidth) {
      left = Math.max(pad, hover.x - w - 16);
    }
    let top = hover.y + 16;
    if (top + h + pad > window.innerHeight) {
      top = Math.max(pad, window.innerHeight - h - pad);
    }
    setCoords({ left, top });
  }, [hover]);

  if (!hover || typeof document === 'undefined') return null;

  const { item, stack, statusTag, hint } = hover;
  const meta = resolveItemMetadata(item, stack);
  const rarityColor = RARITY_COLORS[meta.rarity] ?? '#94A3B8';
  const stats = buildContextualStats(item, activeTab).slice(0, 3);
  const propEntries = Object.entries(meta.properties).slice(0, 4);
  const durPct =
    meta.maxDurability > 1
      ? Math.max(0, Math.min(100, Math.round((meta.durability / meta.maxDurability) * 100)))
      : 100;

  return createPortal(
    <div
      ref={boxRef}
      role="tooltip"
      style={{ left: coords.left, top: coords.top }}
      className="fixed z-[120] w-[296px] pointer-events-none rounded-xl bg-[#0B0F1A] border border-white/18 shadow-2xl p-3 text-[#F3F5FA] space-y-2.5"
    >
      {/* Header */}
      <div className="flex items-start gap-2.5">
        <div
          className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center bg-[#141A29] border border-white/12"
          style={{ boxShadow: `inset 0 0 18px ${item.colorHex}2e` }}
        >
          <ItemThumbnailArt meshKind={item.meshKind} colorHex={item.colorHex} size={36} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-extrabold text-white truncate">{item.name}</span>
            {stack && stack.qty > 0 && (
              <span className="text-[11px] font-extrabold tabular-nums text-[#CBD5E1] shrink-0">
                ×{stack.qty}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold capitalize mt-0.5">
            <span style={{ color: rarityColor }}>{meta.rarity}</span>
            <span className="text-[#475569]">·</span>
            <span className="text-[#94A3B8]">{item.category}</span>
            {statusTag && (
              <>
                <span className="text-[#475569]">·</span>
                <span className="text-[#38BDF8]">{statusTag}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Power / Durability / Weight Bar */}
      <div className="grid grid-cols-3 gap-1.5 text-[10px]">
        <div className="px-2 py-1.5 rounded-lg bg-[#121827] border border-white/8">
          <div className="text-[#64748B] font-bold uppercase tracking-wider flex items-center gap-1">
            {item.category === 'wearable' ? (
              <Shield size={10} className="text-[#38BDF8]" />
            ) : item.category === 'consumable' ? (
              <Zap size={10} className="text-[#F59E0B]" />
            ) : (
              <Swords size={10} className="text-[#38BDF8]" />
            )}
            <span>Power</span>
          </div>
          <div className="text-xs font-extrabold text-[#38BDF8] tabular-nums mt-0.5">
            {meta.power}
          </div>
        </div>

        <div className="px-2 py-1.5 rounded-lg bg-[#121827] border border-white/8">
          <div className="text-[#64748B] font-bold uppercase tracking-wider">Durability</div>
          {meta.maxDurability > 1 ? (
            <div className="mt-0.5 space-y-1">
              <div className="text-[11px] font-extrabold text-[#FACC15] tabular-nums leading-none">
                {meta.durability}/{meta.maxDurability}
              </div>
              <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full"
                  style={{
                    width: `${durPct}%`,
                    backgroundColor:
                      durPct <= 25 ? '#F2545B' : durPct <= 60 ? '#F59E0B' : '#20B46A',
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="text-[11px] font-bold text-[#94A3B8] mt-0.5">Single Use</div>
          )}
        </div>

        <div className="px-2 py-1.5 rounded-lg bg-[#121827] border border-white/8">
          <div className="text-[#64748B] font-bold uppercase tracking-wider flex items-center gap-1">
            <Weight size={10} />
            <span>Weight</span>
          </div>
          <div className="text-xs font-extrabold text-[#E2E8F0] tabular-nums mt-0.5">
            {meta.weight.toFixed(1)}kg
          </div>
        </div>
      </div>

      {/* Contextual Stats */}
      {stats.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          {stats.map((st, idx) => (
            <div
              key={`${st.label}_${idx}`}
              className="px-2 py-1.5 rounded-lg bg-[#121827] border border-white/8"
            >
              <div className="text-[9px] font-bold uppercase tracking-wider text-[#64748B] truncate">
                {st.label}
              </div>
              <div
                className="text-[11px] font-extrabold tabular-nums truncate mt-0.5"
                style={{ color: st.accent ?? '#F8FAFC' }}
              >
                {st.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Magic Effect Highlight */}
      <div className="p-2 rounded-lg bg-[#151326] border border-[#A855F7]/28 flex items-start gap-1.5 text-[11px] text-[#D8B4FE] leading-snug">
        <Sparkles size={12} className="shrink-0 mt-0.5 text-[#C084FC]" />
        <span>{meta.magic_effect}</span>
      </div>

      {/* Dynamic Properties + Brief Description */}
      {propEntries.length > 0 && (
        <div className="flex flex-wrap gap-x-2.5 gap-y-1 text-[10px] text-[#94A3B8]">
          {propEntries.map(([k, v]) => (
            <span key={k}>
              <span className="text-[#64748B] capitalize">{k}:</span>{' '}
              <span className="text-[#E2E8F0] font-semibold">{String(v)}</span>
            </span>
          ))}
        </div>
      )}

      {hint && (
        <div className="pt-1.5 border-t border-white/8 text-[10px] font-semibold text-[#64748B]">
          {hint}
        </div>
      )}
    </div>,
    document.body
  );
};
