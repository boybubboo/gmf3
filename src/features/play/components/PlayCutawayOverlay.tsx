import React from 'react';
import { Clapperboard, SkipForward } from 'lucide-react';

export interface CutawayHudState {
  showLetterbox: boolean;
  skitName: string;
  caption?: string;
  beatIndex: number;
  totalBeats: number;
  speakerLabel?: string;
  narratorText?: string;
}

export interface PlayCutawayOverlayProps {
  show: boolean;
  cutaway: CutawayHudState | null;
  onSkip: () => void;
}

export const PlayCutawayOverlay: React.FC<PlayCutawayOverlayProps> = ({
  show,
  cutaway,
  onSkip,
}) => {
  if (!show || !cutaway) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between">
      {/* Top Cinema Bar + Meanwhile Caption */}
      <div
        className={`w-full transition-all duration-300 flex items-center justify-between px-4 sm:px-8 ${
          cutaway.showLetterbox
            ? 'h-14 sm:h-16 bg-black/92 border-b border-white/10'
            : 'pt-16 pb-2'
        }`}
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-black/75 border border-white/15 text-white text-xs font-extrabold shadow-lg">
          <Clapperboard size={13} className="text-[#F59E0B]" />
          <span>{cutaway.caption?.trim() || cutaway.skitName}</span>
          {cutaway.totalBeats > 1 && (
            <span className="text-white/55 tabular-nums font-bold">
              {cutaway.beatIndex + 1}/{cutaway.totalBeats}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onSkip}
          className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-extrabold border border-white/20 transition-colors"
        >
          <SkipForward size={13} />
          <span>Skip (Space)</span>
        </button>
      </div>

      {/* Bottom Cinema Bar / Storybook Narrator Caption */}
      <div
        className={`w-full transition-all duration-300 flex flex-col items-center justify-end pb-4 px-4 ${
          cutaway.showLetterbox
            ? 'min-h-16 sm:min-h-20 bg-black/92 border-t border-white/10 pt-3'
            : 'pb-8'
        }`}
      >
        {cutaway.narratorText?.trim() && (
          <div className="max-w-2xl w-full rounded-2xl bg-[#181B26]/95 border border-amber-300/35 px-5 py-3 text-center shadow-2xl">
            {cutaway.speakerLabel && (
              <div className="text-[10px] font-black uppercase tracking-widest text-amber-300 mb-0.5">
                {cutaway.speakerLabel}
              </div>
            )}
            <p className="text-sm sm:text-base font-serif font-medium text-amber-50 leading-snug">
              {cutaway.narratorText}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
