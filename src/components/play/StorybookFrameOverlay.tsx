import React, { useEffect, useState } from 'react';
import { BookOpen, ChevronRight, Play, RotateCcw, Sparkles, Square, Volume2 } from 'lucide-react';
import type { GameLevel, GameProject, StorybookConfig, StorybookThemeId } from '../../types/maker';
import { AudioEngine } from '../../utils/audio';

interface StorybookPaletteClasses {
  pageBg: string;
  insetBg: string;
  ink: string;
  muted: string;
  accentText: string;
  ruleBorder: string;
  primaryBtn: string;
  secondaryBtn: string;
}

const THEME_CLASSES: Record<StorybookThemeId, StorybookPaletteClasses> = {
  woodland: {
    pageBg: 'bg-[#F6EEDF]',
    insetBg: 'bg-[#EFE3CE]',
    ink: 'text-[#2B2118]',
    muted: 'text-[#6E5A47]',
    accentText: 'text-[#8C4A27]',
    ruleBorder: 'border-[#D5C3A8]',
    primaryBtn: 'bg-[#207A4B] hover:bg-[#1A653E] text-white',
    secondaryBtn: 'bg-[#E6D7BE] hover:bg-[#DECBB0] text-[#4A3B2C]',
  },
  goldenMeadow: {
    pageBg: 'bg-[#FBF4DE]',
    insetBg: 'bg-[#F3E7C5]',
    ink: 'text-[#2A2315]',
    muted: 'text-[#6F6140]',
    accentText: 'text-[#B45309]',
    ruleBorder: 'border-[#DEC99A]',
    primaryBtn: 'bg-[#B45309] hover:bg-[#92400E] text-white',
    secondaryBtn: 'bg-[#ECE0BC] hover:bg-[#E4D3A4] text-[#493D22]',
  },
  moonlitFable: {
    pageBg: 'bg-[#1B1F2E]',
    insetBg: 'bg-[#242A3E]',
    ink: 'text-[#F3EFE4]',
    muted: 'text-[#B6B1A6]',
    accentText: 'text-[#E9B44C]',
    ruleBorder: 'border-[#3B435E]',
    primaryBtn: 'bg-[#D99B26] hover:bg-[#C2881B] text-[#151822]',
    secondaryBtn: 'bg-[#2D354C] hover:bg-[#37405C] text-[#E6E1D5]',
  },
};

function getThemeClasses(theme?: StorybookThemeId): StorybookPaletteClasses {
  return THEME_CLASSES[theme ?? 'woodland'] ?? THEME_CLASSES.woodland;
}

function getClipIdForVoice(voice?: { clipId?: string; lineClipIds?: Record<number, string> }): string | undefined {
  if (!voice) return undefined;
  return voice.clipId || voice.lineClipIds?.[0];
}

export const StorybookCoverModal: React.FC<{
  project: GameProject;
  level: GameLevel;
  storybook: StorybookConfig;
  onStart: () => void;
  onBackToEditor: () => void;
}> = ({ project, level, storybook, onStart, onBackToEditor }) => {
  const palette = getThemeClasses(storybook.theme);
  const [voicePlaying, setVoicePlaying] = useState(false);
  const voiceClipId = getClipIdForVoice(storybook.prologueVoice);
  const chapterNum = level.chapterNumber ?? 1;
  const chapterName = level.chapterTitle?.trim() || level.name;
  const prologue =
    storybook.prologueText?.trim() ||
    level.chapterSummary?.trim() ||
    project.coverTagline ||
    project.tagline;

  useEffect(() => {
    return () => {
      AudioEngine.stopVoice('storybook_prologue');
    };
  }, []);

  const toggleVoice = async () => {
    if (voicePlaying) {
      AudioEngine.stopVoice('storybook_prologue');
      setVoicePlaying(false);
      return;
    }
    if (!voiceClipId) return;
    AudioEngine.unlock();
    setVoicePlaying(true);
    const started = await AudioEngine.playVoiceClip(voiceClipId, {
      ownerKey: 'storybook_prologue',
      volume: storybook.prologueVoice?.volume ?? 1,
      playbackRate: storybook.prologueVoice?.playbackRate ?? 1,
      onEnded: () => setVoicePlaying(false),
    });
    if (!started) setVoicePlaying(false);
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-4">
      <div
        className={`w-full max-w-xl rounded-2xl ${palette.pageBg} ${palette.ink} border ${palette.ruleBorder} shadow-2xl p-6 sm:p-8 maker-panel-rise`}
      >
        <div className={`border ${palette.ruleBorder} rounded-xl p-5 sm:p-7 space-y-5`}>
          <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-widest">
            <span className={`inline-flex items-center gap-1.5 ${palette.accentText}`}>
              <BookOpen size={14} />
              <span>Chapter {chapterNum}</span>
            </span>
            <span className={palette.muted}>
              Hero: {project.heroName} · {project.difficulty}
            </span>
          </div>

          <div className={`border-t ${palette.ruleBorder}`} />

          <div className="text-center space-y-2">
            {storybook.subtitle?.trim() && (
              <div className={`text-xs font-serif italic ${palette.muted}`}>
                {storybook.subtitle}
              </div>
            )}
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
              {project.name}
            </h1>
            <div className={`font-serif text-base font-bold ${palette.accentText}`}>
              {chapterName}
            </div>
          </div>

          {prologue && (
            <div className={`rounded-xl ${palette.insetBg} border ${palette.ruleBorder} p-4 sm:p-5 space-y-3`}>
              <p className="font-serif text-sm sm:text-base leading-relaxed">
                {prologue}
              </p>
              {voiceClipId && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={toggleVoice}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${palette.secondaryBtn}`}
                  >
                    {voicePlaying ? <Square size={12} /> : <Volume2 size={13} />}
                    <span>{voicePlaying ? 'Stop Reading' : 'Read Prologue Aloud'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {storybook.authorCredit?.trim() && (
            <div className={`text-center font-serif text-xs italic ${palette.muted}`}>
              {storybook.authorCredit}
            </div>
          )}

          <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                (document.activeElement as HTMLElement | null)?.blur?.();
                AudioEngine.stopVoice('storybook_prologue');
                AudioEngine.unlock();
                onStart();
              }}
              className={`flex-1 py-3 px-5 rounded-xl text-sm font-extrabold inline-flex items-center justify-center gap-2 shadow-sm transition-colors whitespace-nowrap ${palette.primaryBtn}`}
            >
              <Play size={16} fill="currentColor" />
              <span>Open Storybook</span>
            </button>
            <button
              type="button"
              onClick={() => {
                AudioEngine.stopVoice('storybook_prologue');
                onBackToEditor();
              }}
              className={`py-3 px-4 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${palette.secondaryBtn}`}
            >
              Back to Editor
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const StorybookChapterBanner: React.FC<{
  level: GameLevel;
  storybook: StorybookConfig;
  visible: boolean;
}> = ({ level, storybook, visible }) => {
  if (!visible) return null;
  const palette = getThemeClasses(storybook.theme);
  const chapterNum = level.chapterNumber ?? 1;
  const chapterName = level.chapterTitle?.trim() || level.name;

  return (
    <div className="pointer-events-none fixed top-20 left-1/2 -translate-x-1/2 z-20 maker-panel-rise">
      <div
        className={`px-6 py-2.5 rounded-xl ${palette.pageBg} ${palette.ink} border ${palette.ruleBorder} shadow-lg text-center`}
      >
        <div className={`text-[10px] font-extrabold uppercase tracking-widest ${palette.accentText}`}>
          Chapter {chapterNum}
        </div>
        <div className="font-serif text-sm sm:text-base font-bold leading-snug">
          {chapterName}
        </div>
      </div>
    </div>
  );
};

export const StorybookEpilogueModal: React.FC<{
  project: GameProject;
  level: GameLevel;
  storybook: StorybookConfig;
  elapsedSec: number;
  coins: number;
  buddiesFound: number;
  buddiesTotal: number;
  puzzlesSolved: number;
  crittersWarmed: number;
  nextLevel: GameLevel | null;
  onNextLevel: () => void;
  onPlayAgain: () => void;
  onBackToEditor: () => void;
}> = ({
  level,
  storybook,
  elapsedSec,
  coins,
  buddiesFound,
  buddiesTotal,
  puzzlesSolved,
  crittersWarmed,
  nextLevel,
  onNextLevel,
  onPlayAgain,
  onBackToEditor,
}) => {
  const palette = getThemeClasses(storybook.theme);
  const [voicePlaying, setVoicePlaying] = useState(false);
  const voiceClipId = getClipIdForVoice(storybook.epilogueVoice);
  const chapterNum = level.chapterNumber ?? 1;
  const title = storybook.epilogueTitle?.trim() || 'And So the Journey Continues…';
  const prose =
    storybook.epilogueText?.trim() ||
    `Finished ${level.chapterTitle?.trim() || level.name} in ${elapsedSec}s with ${coins} coins collected along the forest trail.`;

  useEffect(() => {
    return () => {
      AudioEngine.stopVoice('storybook_epilogue');
    };
  }, []);

  const toggleVoice = async () => {
    if (voicePlaying) {
      AudioEngine.stopVoice('storybook_epilogue');
      setVoicePlaying(false);
      return;
    }
    if (!voiceClipId) return;
    AudioEngine.unlock();
    setVoicePlaying(true);
    const started = await AudioEngine.playVoiceClip(voiceClipId, {
      ownerKey: 'storybook_epilogue',
      volume: storybook.epilogueVoice?.volume ?? 1,
      playbackRate: storybook.epilogueVoice?.playbackRate ?? 1,
      onEnded: () => setVoicePlaying(false),
    });
    if (!started) setVoicePlaying(false);
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-4">
      <div
        className={`w-full max-w-xl rounded-2xl ${palette.pageBg} ${palette.ink} border ${palette.ruleBorder} shadow-2xl p-6 sm:p-8 maker-panel-rise`}
      >
        <div className={`border ${palette.ruleBorder} rounded-xl p-5 sm:p-7 space-y-5`}>
          <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-widest">
            <span className={`inline-flex items-center gap-1.5 ${palette.accentText}`}>
              <Sparkles size={14} />
              <span>Chapter {chapterNum} Complete</span>
            </span>
            <span className={`tabular-nums ${palette.muted}`}>
              {elapsedSec}s · {coins} Coins
            </span>
          </div>

          <div className={`border-t ${palette.ruleBorder}`} />

          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-center leading-tight">
            {title}
          </h2>

          <div className={`rounded-xl ${palette.insetBg} border ${palette.ruleBorder} p-4 sm:p-5 space-y-3`}>
            <p className="font-serif text-sm sm:text-base leading-relaxed">{prose}</p>
            {storybook.moralLine?.trim() && (
              <p className={`font-serif italic text-xs sm:text-sm pt-2 border-t ${palette.ruleBorder} ${palette.accentText}`}>
                “{storybook.moralLine}”
              </p>
            )}
            {voiceClipId && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={toggleVoice}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${palette.secondaryBtn}`}
                >
                  {voicePlaying ? <Square size={12} /> : <Volume2 size={13} />}
                  <span>{voicePlaying ? 'Stop Reading' : 'Read Epilogue'}</span>
                </button>
              </div>
            )}
          </div>

          <div className={`grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center`}>
            <div className={`rounded-lg ${palette.insetBg} border ${palette.ruleBorder} px-2.5 py-2`}>
              <div className={`text-[10px] font-bold uppercase tracking-wider ${palette.muted}`}>
                Buddies
              </div>
              <div className="text-base font-extrabold tabular-nums mt-0.5">
                {buddiesTotal > 0 ? `${buddiesFound}/${buddiesTotal}` : buddiesFound}
              </div>
            </div>
            <div className={`rounded-lg ${palette.insetBg} border ${palette.ruleBorder} px-2.5 py-2`}>
              <div className={`text-[10px] font-bold uppercase tracking-wider ${palette.muted}`}>
                Critters Won
              </div>
              <div className="text-base font-extrabold tabular-nums mt-0.5">{crittersWarmed}</div>
            </div>
            <div className={`rounded-lg ${palette.insetBg} border ${palette.ruleBorder} px-2.5 py-2`}>
              <div className={`text-[10px] font-bold uppercase tracking-wider ${palette.muted}`}>
                Puzzles
              </div>
              <div className="text-base font-extrabold tabular-nums mt-0.5">{puzzlesSolved}</div>
            </div>
            <div className={`rounded-lg ${palette.insetBg} border ${palette.ruleBorder} px-2.5 py-2`}>
              <div className={`text-[10px] font-bold uppercase tracking-wider ${palette.muted}`}>
                Trail Time
              </div>
              <div className="text-base font-extrabold tabular-nums mt-0.5">{elapsedSec}s</div>
            </div>
          </div>

          <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {nextLevel && (
              <button
                type="button"
                onClick={() => {
                  AudioEngine.stopVoice('storybook_epilogue');
                  onNextLevel();
                }}
                className={`flex-1 py-3 px-4 rounded-xl text-sm font-extrabold inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${palette.primaryBtn}`}
              >
                <span>
                  Next Chapter: {nextLevel.chapterTitle?.trim() || nextLevel.name}
                </span>
                <ChevronRight size={15} />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                AudioEngine.stopVoice('storybook_epilogue');
                onPlayAgain();
              }}
              className={`py-3 px-4 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${
                nextLevel ? palette.secondaryBtn : `flex-1 ${palette.primaryBtn}`
              }`}
            >
              <RotateCcw size={14} />
              <span>Read Again</span>
            </button>
            <button
              type="button"
              onClick={() => {
                AudioEngine.stopVoice('storybook_epilogue');
                onBackToEditor();
              }}
              className={`py-3 px-4 rounded-xl text-xs font-bold whitespace-nowrap ${palette.secondaryBtn}`}
            >
              Back to Editor
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
