import React from 'react';
import { Sparkles } from 'lucide-react';
import type { GameLevel, GameProject, StorybookConfig } from '../../../types/maker';
import { StorybookEpilogueModal } from '../../../components/play/StorybookFrameOverlay';

export interface PlayLevelCompleteModalProps {
  finished: boolean;
  project: GameProject;
  level: GameLevel;
  storybook?: StorybookConfig;
  elapsedSec: number;
  coins: number;
  buddyHud: { found: number; total: number };
  storyStats: { puzzlesSolved: number; crittersWarmed: number };
  nextLevel?: GameLevel | null;
  onNextLevel: () => void;
  onPlayAgain: () => void;
  onBackToEditor: () => void;
}

export const PlayLevelCompleteModal: React.FC<PlayLevelCompleteModalProps> = ({
  finished,
  project,
  level,
  storybook,
  elapsedSec,
  coins,
  buddyHud,
  storyStats,
  nextLevel,
  onNextLevel,
  onPlayAgain,
  onBackToEditor,
}) => {
  if (!finished) return null;

  if (storybook?.enabled) {
    return (
      <StorybookEpilogueModal
        project={project}
        level={level}
        storybook={storybook}
        elapsedSec={elapsedSec}
        coins={coins}
        buddiesFound={buddyHud.found}
        buddiesTotal={buddyHud.total}
        puzzlesSolved={storyStats.puzzlesSolved}
        crittersWarmed={storyStats.crittersWarmed}
        nextLevel={nextLevel ?? null}
        onNextLevel={onNextLevel}
        onPlayAgain={onPlayAgain}
        onBackToEditor={onBackToEditor}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#171A23] text-slate-900 dark:text-[#F3F5FA] border border-slate-200/80 dark:border-white/[0.1] p-6 text-center shadow-2xl space-y-4">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-[#20B46A]/15 text-[#20B46A] flex items-center justify-center">
            <Sparkles size={32} />
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-black">Level Complete!</h2>
          <p className="text-xs text-slate-500 dark:text-[#949BB0] mt-1">
            Finished {level.name} in {elapsedSec}s with {coins} coins.
          </p>
        </div>
        <div className="space-y-2">
          {nextLevel && (
            <button
              type="button"
              onClick={onNextLevel}
              className="w-full py-3 rounded-xl bg-[#20B46A] text-white text-sm font-bold"
            >
              Next Level: {nextLevel.name}
            </button>
          )}
          <button
            type="button"
            onClick={onPlayAgain}
            className="w-full py-2.5 rounded-xl bg-[#7C5CFF]/15 text-[#7C5CFF] text-sm font-bold"
          >
            Play Again
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
