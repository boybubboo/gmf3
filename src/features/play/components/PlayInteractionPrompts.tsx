import React from 'react';
import { PackageOpen, Sparkles } from 'lucide-react';

export interface PlayInteractionPromptsProps {
  controlsActive: boolean;
  unlockedPowersCount: number;
  nearCraftingBench: boolean;
  isChestOpeningAnim: boolean;
  chestInteractPrompt: {
    label: string;
    isOpen: boolean;
    locked: boolean;
    lockedMessage?: string;
    itemCount: number;
  } | null;
  doorInteractPrompt: {
    label: string;
    isOpen: boolean;
    locked: boolean;
  } | null;
  harvestPrompt: {
    label: string;
    itemName: string;
    method: 'interact' | 'walkOver';
  } | null;
  sitPrompt: {
    label: string;
    isSitting: boolean;
  } | null;
  climbPrompt: {
    label: string;
    active: boolean;
  } | null;
  glidePrompt: 'ready' | 'readySecond' | 'gliding' | null;
  isRpgMode?: boolean;
}

export const PlayInteractionPrompts: React.FC<PlayInteractionPromptsProps> = ({
  controlsActive,
  unlockedPowersCount,
  nearCraftingBench,
  isChestOpeningAnim,
  chestInteractPrompt,
  doorInteractPrompt,
  harvestPrompt,
  sitPrompt,
  climbPrompt,
  glidePrompt,
  isRpgMode = false,
}) => {
  if (!controlsActive) return null;

  const bottomClass = isRpgMode
    ? 'bottom-28'
    : unlockedPowersCount > 0
    ? 'bottom-32'
    : 'bottom-24';
  const effectiveGlidePrompt =
    isRpgMode && glidePrompt !== 'gliding' ? null : glidePrompt;

  return (
    <>
      {/* Treasure Chest Interaction Prompt */}
      {!isChestOpeningAnim && chestInteractPrompt && !nearCraftingBench && !harvestPrompt && (
        <div
          className={`fixed ${bottomClass} left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-[#0B0E17]/95 border border-amber-400/55 text-white text-xs font-extrabold shadow-2xl z-30 flex items-center gap-2 whitespace-nowrap`}
        >
          <PackageOpen size={15} className="text-[#FACC15]" />
          <span>
            {chestInteractPrompt.locked ? (
              <>
                {chestInteractPrompt.lockedMessage || (
                  <>
                    <span className="text-[#FACC15]">{chestInteractPrompt.label}</span> is locked — find a key!
                  </>
                )}
              </>
            ) : chestInteractPrompt.isOpen ? (
              <>
                Press <span className="px-1.5 py-0.5 mx-0.5 rounded bg-white/15 font-mono text-[11px]">E</span> to check{' '}
                <span className="text-[#FACC15]">{chestInteractPrompt.label}</span>{' '}
                <span className="text-amber-200/80 font-bold">
                  ({chestInteractPrompt.itemCount} left)
                </span>
              </>
            ) : (
              <>
                Press <span className="px-1.5 py-0.5 mx-0.5 rounded bg-white/15 font-mono text-[11px]">E</span> (Use) to open{' '}
                <span className="text-[#FACC15]">{chestInteractPrompt.label}</span>
              </>
            )}
          </span>
        </div>
      )}

      {/* Door / Trapdoor Interaction Prompt */}
      {doorInteractPrompt && !chestInteractPrompt && !nearCraftingBench && !harvestPrompt && (
        <div
          className={`fixed ${bottomClass} left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-[#11141D]/92 border border-[#7C5CFF]/55 text-white text-xs font-extrabold shadow-xl z-30 flex items-center gap-2 whitespace-nowrap`}
        >
          <span>
            {doorInteractPrompt.locked ? (
              <>
                <span className="text-[#FACC15]">{doorInteractPrompt.label}</span> is locked — find a key!
              </>
            ) : (
              <>
                Press <span className="px-1.5 py-0.5 mx-0.5 rounded bg-white/15 font-mono text-[11px]">E</span> to{' '}
                {doorInteractPrompt.isOpen ? 'close' : 'open'}{' '}
                <span className="text-[#A78BFA]">{doorInteractPrompt.label}</span>
              </>
            )}
          </span>
        </div>
      )}

      {/* Harvest World Collectible Prompt */}
      {harvestPrompt && (
        <div
          className={`fixed ${bottomClass} left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-[#11141D]/92 border border-[#20B46A]/45 text-white text-xs font-extrabold shadow-xl z-30 flex items-center gap-2 whitespace-nowrap`}
        >
          <Sparkles size={14} className="text-[#4ADE80]" />
          {harvestPrompt.method === 'interact' ? (
            <span>
              Press <span className="px-1.5 py-0.5 mx-0.5 rounded bg-white/15 font-mono text-[11px]">E</span> to gather{' '}
              <span className="text-[#4ADE80]">{harvestPrompt.itemName}</span>
            </span>
          ) : (
            <span>
              Walk over {harvestPrompt.label} to collect <span className="text-[#4ADE80]">{harvestPrompt.itemName}</span>
            </span>
          )}
        </div>
      )}

      {/* Sit / Stand Prompt */}
      {sitPrompt && !chestInteractPrompt && !nearCraftingBench && !doorInteractPrompt && !harvestPrompt && (
        <div
          className={`fixed ${bottomClass} left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-[#11141D]/92 border border-[#FACC15]/50 text-white text-xs font-extrabold shadow-xl z-30 flex items-center gap-2 whitespace-nowrap`}
        >
          <span>
            {sitPrompt.isSitting ? (
              <>
                Resting · Press <span className="px-1.5 py-0.5 mx-0.5 rounded bg-white/15 font-mono text-[11px]">E / Alt</span> or move to stand up
              </>
            ) : (
              <>
                Press <span className="px-1.5 py-0.5 mx-0.5 rounded bg-white/15 font-mono text-[11px]">E / Alt</span> to sit on{' '}
                <span className="text-[#FACC15]">{sitPrompt.label}</span>
                {sitPrompt.label === 'Smooth River Stone' && (
                  <span className="text-slate-300 font-normal ml-1.5">· Hit (Ctrl / F) to gather</span>
                )}
              </>
            )}
          </span>
        </div>
      )}

      {/* Climb Prompt */}
      {climbPrompt && !sitPrompt && !chestInteractPrompt && !nearCraftingBench && !doorInteractPrompt && !harvestPrompt && (
        <div
          className={`fixed ${bottomClass} left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-[#11141D]/92 border border-[#38BDF8]/50 text-white text-xs font-extrabold shadow-xl z-30 flex items-center gap-2 whitespace-nowrap`}
        >
          <span>
            {climbPrompt.active ? (
              <>
                Climbing <span className="text-[#38BDF8]">{climbPrompt.label}</span> · W/S Up &amp; Down · Shift/Space Jump off
              </>
            ) : (
              <>
                Walk forward into <span className="text-[#38BDF8]">{climbPrompt.label}</span> to climb
              </>
            )}
          </span>
        </div>
      )}

      {/* Parachute Blanket Glide Prompt */}
      {effectiveGlidePrompt && !climbPrompt && !sitPrompt && !nearCraftingBench && !doorInteractPrompt && !harvestPrompt && (
        <div
          className={`fixed ${bottomClass} left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-[#11141D]/92 border border-[#E06D44]/60 text-white text-xs font-extrabold shadow-xl z-30 flex items-center gap-2 whitespace-nowrap`}
        >
          <span>
            {effectiveGlidePrompt === 'gliding' ? (
              <>
                <span className="text-[#F4C95D]">Parachute Blanket</span> · Hold <span className="px-1.5 py-0.5 mx-0.5 rounded bg-white/15 font-mono text-[11px]">Jump</span> to fly · Release to stow
              </>
            ) : effectiveGlidePrompt === 'readySecond' ? (
              <>
                Press &amp; hold <span className="px-1.5 py-0.5 mx-0.5 rounded bg-white/15 font-mono text-[11px]">Jump</span> again to open <span className="text-[#F4C95D]">Parachute Blanket</span>
              </>
            ) : (
              <>
                Double-press &amp; hold <span className="px-1.5 py-0.5 mx-0.5 rounded bg-white/15 font-mono text-[11px]">Jump</span> to open <span className="text-[#F4C95D]">Parachute Blanket</span>
              </>
            )}
          </span>
        </div>
      )}
    </>
  );
};
