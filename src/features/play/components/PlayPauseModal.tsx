import React from 'react';

export interface PlayPauseModalProps {
  isOpen: boolean;
  isRoguelike: boolean;
  onResume: () => void;
  onOpenWorldMap: () => void;
  onRestart: () => void;
  onBackToEditor: () => void;
}

export const PlayPauseModal: React.FC<PlayPauseModalProps> = ({
  isOpen,
  isRoguelike,
  onResume,
  onOpenWorldMap,
  onRestart,
  onBackToEditor,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-xs rounded-3xl bg-white dark:bg-[#171A23] text-slate-900 dark:text-[#F3F5FA] border border-slate-200/80 dark:border-white/[0.1] p-6 text-center shadow-2xl space-y-3">
        <h2 className="text-xl font-black">Paused</h2>
        <button
          type="button"
          onClick={onResume}
          className="w-full py-2.5 rounded-xl bg-[#7C5CFF] text-white text-sm font-bold"
        >
          Keep Playing
        </button>
        <button
          type="button"
          onClick={onOpenWorldMap}
          className="w-full py-2.5 rounded-xl bg-[#0EA5E9]/15 text-[#0284C7] dark:text-[#38BDF8] text-sm font-bold"
        >
          World Map (M)
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-[#1F2430] text-sm font-bold"
        >
          {isRoguelike ? 'Restart Run' : 'Restart Level'}
        </button>
        <button
          type="button"
          onClick={onBackToEditor}
          className="w-full py-2.5 rounded-xl bg-[#F2545B]/12 text-sm font-bold text-[#F2545B]"
        >
          Back to Editor
        </button>
      </div>
    </div>
  );
};
