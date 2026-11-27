import React, { useState } from 'react';
import { Flame, Heart, Shield, Sparkles, Sword, Wand2 } from 'lucide-react';

export interface RpgRewardCardOption {
  id: string;
  title: string;
  subtitle: string;
  category: 'weapon' | 'potion' | 'magic' | 'defense';
  rarity: 'Rare' | 'Epic' | 'Mythic';
  description: string;
  statLabel: string;
  colorFrom: string;
  colorTo: string;
  borderColor: string;
  glowColor: string;
  effect: {
    atkBonus?: number;
    defBonus?: number;
    magicBonus?: number;
    healHearts?: number;
    maxHeartsBonus?: number;
    manaRestore?: number;
    givePotionQty?: number;
    giveHerbQty?: number;
    coinsBonus?: number;
    grantWeaponName?: string;
  };
}

export const RPG_REWARD_CARD_POOL: RpgRewardCardOption[] = [
  {
    id: 'crimson_sunblade',
    title: 'Crimson Sunblade',
    subtitle: 'Forged Relic Sword',
    category: 'weapon',
    rarity: 'Epic',
    description: 'Imbues your sword slash with searing solar arcs that cleave through enemy armor.',
    statLabel: '+6 Sword ATK · +15 Gold',
    colorFrom: '#DC2626',
    colorTo: '#991B1B',
    borderColor: '#F59E0B',
    glowColor: 'rgba(245, 158, 11, 0.55)',
    effect: {
      atkBonus: 6,
      coinsBonus: 15,
      grantWeaponName: 'Crimson Sunblade',
    },
  },
  {
    id: 'emerald_life_draught',
    title: 'Emerald Elixir & Sun-Herbs',
    subtitle: 'Alchemist Apothecary Cache',
    category: 'potion',
    rarity: 'Rare',
    description: 'Restores full vitality immediately and stocks your satchel with Potions & Wild Healing Herbs.',
    statLabel: 'Full Heal · +2 Potions · +2 Herbs',
    colorFrom: '#059669',
    colorTo: '#065F46',
    borderColor: '#34D399',
    glowColor: 'rgba(52, 211, 153, 0.55)',
    effect: {
      healHearts: 4,
      maxHeartsBonus: 1,
      givePotionQty: 2,
      giveHerbQty: 2,
    },
  },
  {
    id: 'stormcaller_grimoire',
    title: 'Stormcaller Grimoire',
    subtitle: 'Arcane Lightning Spell',
    category: 'magic',
    rarity: 'Mythic',
    description: 'Amplifies your Magic Zap with high-voltage chain lightning and restores full Arcane Mana.',
    statLabel: '+8 Magic Zap · +100% Mana',
    colorFrom: '#7C3AED',
    colorTo: '#4C1D95',
    borderColor: '#C084FC',
    glowColor: 'rgba(192, 132, 252, 0.6)',
    effect: {
      magicBonus: 8,
      manaRestore: 100,
    },
  },
  {
    id: 'aegis_dragonscale',
    title: 'Dragonscale Aegis Ward',
    subtitle: 'Ancient Temple Blessing',
    category: 'defense',
    rarity: 'Epic',
    description: 'Hardens your party armor against Ogre Brute throws and grants an extra Heart container.',
    statLabel: '+5 DEF · +1 Max Heart · +1 Potion',
    colorFrom: '#2563EB',
    colorTo: '#1E3A8A',
    borderColor: '#60A5FA',
    glowColor: 'rgba(96, 165, 250, 0.55)',
    effect: {
      defBonus: 5,
      maxHeartsBonus: 1,
      healHearts: 2,
      givePotionQty: 1,
    },
  },
  {
    id: 'sylvan_longbow',
    title: 'Sylvan Vine Longbow',
    subtitle: 'Deepwood Ranger Relic',
    category: 'weapon',
    rarity: 'Epic',
    description: 'Carved from an ancient hollow magic tree; boosts arrow velocity and critical strike damage.',
    statLabel: '+5 Bow & Sword ATK · +2 Herbs',
    colorFrom: '#D97706',
    colorTo: '#78350F',
    borderColor: '#FDE047',
    glowColor: 'rgba(253, 224, 71, 0.55)',
    effect: {
      atkBonus: 5,
      giveHerbQty: 2,
      grantWeaponName: 'Sylvan Vine Longbow',
    },
  },
];

interface RpgRewardCardsModalProps {
  sourceTitle: string;
  cards: RpgRewardCardOption[];
  onSelectCard: (card: RpgRewardCardOption) => void;
  onDismiss: () => void;
}

export const RpgRewardCardsModal: React.FC<RpgRewardCardsModalProps> = ({
  sourceTitle,
  cards,
  onSelectCard,
  onDismiss,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(1);

  const fanTransforms = [
    'rotate(-8deg) translateY(14px)',
    'rotate(0deg) translateY(-6px)',
    'rotate(8deg) translateY(14px)',
  ];

  const renderCategoryIcon = (category: RpgRewardCardOption['category']) => {
    switch (category) {
      case 'weapon':
        return <Sword className="w-8 h-8 text-amber-200 drop-shadow" />;
      case 'potion':
        return <Heart className="w-8 h-8 text-emerald-200 drop-shadow" />;
      case 'magic':
        return <Wand2 className="w-8 h-8 text-purple-200 drop-shadow" />;
      case 'defense':
        return <Shield className="w-8 h-8 text-sky-200 drop-shadow" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/75 backdrop-blur-md px-4 select-none animate-fadeIn">
      {/* Header Banner */}
      <div className="text-center mb-6 max-w-xl">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-black uppercase tracking-widest mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          Isometric RPG Treasure Choice
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight drop-shadow-md">
          {sourceTitle}
        </h2>
        <p className="text-xs sm:text-sm text-slate-300 mt-1">
          Choose one of the fanned-out destiny cards below to empower your hero & companion party
        </p>
      </div>

      {/* Fanned-Out Colorful Cards Container */}
      <div className="flex flex-wrap sm:flex-nowrap items-center justify-center gap-5 sm:gap-7 my-2 py-4 px-2 max-w-4xl w-full">
        {cards.slice(0, 3).map((card, idx) => {
          const isHovered = hoveredIdx === idx;
          return (
            <button
              key={card.id}
              type="button"
              onMouseEnter={() => setHoveredIdx(idx)}
              onClick={() => onSelectCard(card)}
              style={{
                transform: isHovered
                  ? 'rotate(0deg) translateY(-20px) scale(1.06)'
                  : fanTransforms[idx] ?? 'none',
                background: `linear-gradient(155deg, ${card.colorFrom} 0%, ${card.colorTo} 100%)`,
                borderColor: card.borderColor,
                boxShadow: isHovered
                  ? `0 24px 48px -12px ${card.glowColor}, 0 0 24px 2px ${card.glowColor}`
                  : '0 18px 36px -12px rgba(0,0,0,0.65)',
              }}
              className="group relative w-64 sm:w-68 rounded-2xl border-2 p-5 text-left transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[320px]"
            >
              {/* Top Rarity & Icon Medallion */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-4">
                  <span className="px-2.5 py-0.5 rounded-md bg-black/35 border border-white/20 text-[10px] font-black uppercase tracking-wider text-amber-200">
                    {card.rarity}
                  </span>
                  <span className="text-[11px] font-extrabold text-white/80 uppercase tracking-wider">
                    Card {idx + 1}
                  </span>
                </div>

                <div className="w-16 h-16 rounded-2xl bg-black/30 border border-white/25 flex items-center justify-center mb-4 mx-auto shadow-inner group-hover:scale-110 transition-transform">
                  {renderCategoryIcon(card.category)}
                </div>

                <h3 className="text-lg font-black text-white text-center leading-snug drop-shadow">
                  {card.title}
                </h3>
                <p className="text-[11px] font-bold text-amber-200/90 text-center uppercase tracking-wider mt-0.5">
                  {card.subtitle}
                </p>

                <p className="text-xs text-white/90 text-center mt-3 leading-relaxed">
                  {card.description}
                </p>
              </div>

              {/* Bottom Stat Pill & Claim CTA */}
              <div className="mt-5 pt-3 border-t border-white/20 flex flex-col items-center gap-2">
                <div className="w-full py-1.5 px-3 rounded-xl bg-black/40 border border-white/15 text-center text-xs font-black text-amber-300">
                  {card.statLabel}
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-black text-white group-hover:text-amber-200 transition-colors">
                  <Flame className="w-3.5 h-3.5" />
                  Claim Reward Card
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onDismiss}
        className="mt-4 px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-slate-300 transition-colors"
      >
        Skip Reward
      </button>
    </div>
  );
};
