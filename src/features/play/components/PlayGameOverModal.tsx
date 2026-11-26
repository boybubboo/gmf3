import React from 'react';
import { RotateCcw, Skull } from 'lucide-react';
import { IconBadge } from '../../../components/shared/MakerUI';
import { MakerIcon } from '../../../components/shared/IconMap';
import { getRelicById } from '../../../data/roguelikeEngine';
import type { RoguelikeRelicDef } from '../../../types/maker';

export interface RoguelikeRunSummaryData {
  floorReached: number;
  enemiesSlain: number;
  bossesSlain: number;
  coinsEarned: number;
  relicIds: string[];
  runSeed: number;
}

export interface PlayGameOverModalProps {
  isDead: boolean;
  isRoguelike: boolean;
  roguelikeSummary: RoguelikeRunSummaryData | null;
  onRestart: () => void;
  onBackToEditor: () => void;
}

export const PlayGameOverModal: React.FC<PlayGameOverModalProps> = ({
  isDead,
  isRoguelike,
  roguelikeSummary,
  onRestart,
  onBackToEditor,
}) => {
  if (!isDead) return null;

  if (isRoguelike && roguelikeSummary) {
    const relicCounts = new Map<string, number>();
    for (const id of roguelikeSummary.relicIds) {
      relicCounts.set(id, (relicCounts.get(id) ?? 0) + 1);
    }
    const collectedRelics = Array.from(relicCounts.entries())
      .map(([id, count]) => ({ def: getRelicById(id), count }))
      .filter((x): x is { def: RoguelikeRelicDef; count: number } => Boolean(x.def));

    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="w-full max-w-md rounded-3xl bg-[#12151E] text-[#F3F5FA] border border-white/12 p-6 shadow-2xl space-y-5 maker-panel-rise">
          <div className="text-center space-y-2">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-[#E11D48]/18 border border-[#E11D48]/35 text-[#FB7185] flex items-center justify-center">
              <Skull size={28} />
            </div>
            <h2 className="text-2xl font-black">Run Ended</h2>
            <p className="text-xs text-white/65 tabular-nums">
              Fallen on Floor {roguelikeSummary.floorReached} · Run Seed #{roguelikeSummary.runSeed}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl bg-[#181C28] border border-white/8 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                Floor Reached
              </div>
              <div className="text-xl font-black tabular-nums mt-0.5">
                {roguelikeSummary.floorReached}
              </div>
            </div>
            <div className="rounded-2xl bg-[#181C28] border border-white/8 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                Foes Slain
              </div>
              <div className="text-xl font-black tabular-nums mt-0.5">
                {roguelikeSummary.enemiesSlain}
              </div>
            </div>
            <div className="rounded-2xl bg-[#181C28] border border-white/8 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                Bosses Slain
              </div>
              <div className="text-xl font-black tabular-nums text-[#F59E0B] mt-0.5">
                {roguelikeSummary.bossesSlain}
              </div>
            </div>
            <div className="rounded-2xl bg-[#181C28] border border-white/8 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                Coins Earned
              </div>
              <div className="text-xl font-black tabular-nums text-[#FACC15] mt-0.5">
                {roguelikeSummary.coinsEarned}
              </div>
            </div>
          </div>

          {collectedRelics.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                Relics Drafted ({roguelikeSummary.relicIds.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {collectedRelics.map(({ def, count }) => (
                  <div
                    key={def.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#181C28] border border-white/10 text-[11px] font-bold"
                    title={def.shortEffect}
                  >
                    <span style={{ color: def.colorHex }}>
                      <MakerIcon symbol={def.symbol} size={12} />
                    </span>
                    <span>{def.name}</span>
                    {count > 1 && (
                      <span className="text-white/50 tabular-nums">×{count}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={onRestart}
              className="w-full py-3 rounded-xl bg-[#E11D48] hover:opacity-95 text-white text-sm font-extrabold inline-flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <RotateCcw size={15} />
              <span>Start New Run</span>
            </button>
            <button
              type="button"
              onClick={onBackToEditor}
              className="w-full py-2.5 rounded-xl bg-white/8 hover:bg-white/12 text-xs font-bold text-white/75"
            >
              Back to Editor
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#171A23] text-slate-900 dark:text-[#F3F5FA] border border-slate-200/80 dark:border-white/[0.1] p-6 text-center shadow-2xl space-y-4">
        <div className="flex justify-center">
          <IconBadge symbol="heart.slash.fill" tint="#F2545B" size={56} />
        </div>
        <div>
          <h2 className="text-xl font-black">Ouch! Out of health</h2>
          <p className="text-xs text-slate-500 dark:text-[#949BB0] mt-1">
            Give it another go! Use Ctrl or F to swing your sword or dodge traps.
          </p>
        </div>
        <div className="space-y-2">
          <button
            type="button"
            onClick={onRestart}
            className="w-full py-3 rounded-xl bg-[#7C5CFF] text-white text-sm font-bold"
          >
            Try Again
          </button>
          <button
            type="button"
            onClick={onBackToEditor}
            className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-[#1F2430] text-xs font-bold text-slate-600 dark:text-[#949BB0]"
          >
            Back to Editor
          </button>
        </div>
      </div>
    </div>
  );
};
