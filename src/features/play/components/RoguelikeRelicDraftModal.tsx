import React from 'react';
import { ChevronRight } from 'lucide-react';
import type { RoguelikeRelicDef } from '../../../types/maker';
import { MakerIcon } from '../../../components/shared/IconMap';

export interface RoguelikeRelicDraftModalProps {
  isOpen: boolean;
  floorNumber: number;
  enemiesSlain: number;
  activeRelics: string[];
  draftOptions: RoguelikeRelicDef[] | null;
  onSelectRelic: (relic: RoguelikeRelicDef) => void;
}

export const RoguelikeRelicDraftModal: React.FC<RoguelikeRelicDraftModalProps> = ({
  isOpen,
  floorNumber,
  enemiesSlain,
  activeRelics,
  draftOptions,
  onSelectRelic,
}) => {
  if (!isOpen || !draftOptions || draftOptions.length === 0) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl rounded-3xl bg-[#12151E] text-[#F3F5FA] border border-white/12 p-6 md:p-7 shadow-2xl space-y-5 maker-panel-rise">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="space-y-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#F59E0B] tabular-nums">
              Floor {floorNumber} Cleared · Descending to Floor {floorNumber + 1}
            </div>
            <h2 className="text-2xl font-black tracking-tight">Choose a Relic</h2>
          </div>
          <div className="text-right text-xs text-white/65 tabular-nums">
            <div>{enemiesSlain} foes slain</div>
            <div>{activeRelics.length} relics carried</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {draftOptions.map((relic) => {
            const ownedCount = activeRelics.filter((id) => id === relic.id).length;
            return (
              <button
                key={relic.id}
                type="button"
                onClick={() => onSelectRelic(relic)}
                className="group text-left rounded-2xl bg-[#181C28] hover:bg-[#1E2333] border border-white/10 hover:border-white/25 p-4 flex flex-col justify-between gap-4 transition-colors duration-150"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="text-[10px] font-extrabold uppercase tracking-wider"
                      style={{
                        color:
                          relic.rarity === 'mythic'
                            ? '#F59E0B'
                            : relic.rarity === 'rare'
                            ? '#38BDF8'
                            : '#94A3B8',
                      }}
                    >
                      {relic.rarity} · {relic.category}
                    </span>
                    {ownedCount > 0 && (
                      <span className="text-[10px] font-bold text-white/55 tabular-nums">
                        Owned ×{ownedCount}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border border-white/10"
                      style={{ backgroundColor: `${relic.colorHex}22`, color: relic.colorHex }}
                    >
                      <MakerIcon symbol={relic.symbol} size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-base font-black text-white leading-tight">
                        {relic.name}
                      </div>
                      <div
                        className="text-xs font-extrabold mt-0.5"
                        style={{ color: relic.colorHex }}
                      >
                        {relic.shortEffect}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-white/70 leading-relaxed">{relic.description}</p>
                </div>

                <div className="pt-2 border-t border-white/8 flex items-center justify-between text-xs font-extrabold text-white/85 group-hover:text-white whitespace-nowrap">
                  <span>Select Relic</span>
                  <ChevronRight
                    size={15}
                    className="text-white/50 group-hover:translate-x-0.5 transition-transform duration-150"
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
