import React from 'react';
import { X } from 'lucide-react';
import { EntityKindMeta, getBiome } from '../../data/registries';
import { HERO_START_ENTITY_ID, type GameLevel } from '../../types/maker';
import { getEnvironmentType } from '../../utils/terrain';
import { MakerIcon } from '../shared/IconMap';

export const LevelMapModal: React.FC<{
  level: GameLevel;
  selectedEntityID: string | null;
  onSelectEntity: (id: string) => void;
  onMoveEntity: (id: string, pos: { x: number; y: number }) => void;
  onClose: () => void;
}> = ({ level, selectedEntityID, onSelectEntity, onMoveEntity, onClose }) => {
  const biome = getBiome(level.biome);
  const env = getEnvironmentType(level);
  const startCoord = level.startPoint ?? (env === 'sideScroller' ? { x: 0.1, y: 0.5 } : { x: 0.14, y: 0.8 });
  const portalCoord = level.portalPoint ?? (env === 'sideScroller' ? { x: 0.92, y: 0.5 } : { x: 0.88, y: 0.24 });

  const handleBoardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedEntityID) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(0.94, Math.max(0.06, (e.clientX - rect.left) / rect.width));
    const y = Math.min(0.94, Math.max(0.06, (e.clientY - rect.top) / rect.height));
    onMoveEntity(selectedEntityID, { x, y });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-slate-50 dark:bg-[#12151E] text-slate-900 dark:text-[#F3F5FA] rounded-3xl shadow-2xl border border-slate-200/80 dark:border-white/[0.1] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-[#171A23] border-b border-slate-200/80 dark:border-white/[0.08]">
          <div>
            <h2 className="text-lg font-extrabold">{level.name} — Flat Map</h2>
            <p className="text-xs text-slate-500 dark:text-[#949BB0]">
              Click Hero or any item to select it, then click anywhere on the map to move it there.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-[#1F2430] flex items-center justify-center text-slate-500 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 flex items-center justify-center">
          <div
            onClick={handleBoardClick}
            className={`relative w-full ${
              env === 'sideScroller' ? 'max-w-[540px] aspect-[16/7]' : 'max-w-[460px] aspect-square'
            } rounded-3xl overflow-hidden shadow-inner border border-black/25 cursor-crosshair`}
            style={{
              backgroundColor:
                env === 'dungeon'
                  ? '#1A1D26'
                  : env === 'castle'
                  ? '#4E5566'
                  : env === 'scifi'
                  ? '#101828'
                  : env === 'sideScroller'
                  ? '#1D3557'
                  : biome.water,
            }}
          >
            {/* Scene floor layout */}
            {env === 'openWorld' && (
              <div
                className="absolute inset-[8%] rounded-full shadow-md border-4 border-[#F2E3B6]"
                style={{ backgroundColor: biome.ground }}
              />
            )}

            {env === 'dungeon' && (
              <div className="absolute inset-[5%] rounded-2xl bg-[#343A46] border-4 border-[#20242D]">
                <div className="absolute inset-y-0 left-[38%] w-2.5 bg-[#1B1F28]" />
                <div className="absolute inset-y-0 left-[71%] w-2.5 bg-[#1B1F28]" />
                <div className="absolute left-[38%] top-[34%] w-3 h-[14%] bg-[#343A46]" />
                <div className="absolute left-[38%] top-[66%] w-3 h-[16%] bg-[#343A46]" />
                <div className="absolute left-[71%] top-[28%] w-3 h-[16%] bg-[#343A46]" />
                <div className="absolute left-[71%] top-[62%] w-3 h-[16%] bg-[#343A46]" />
              </div>
            )}

            {env === 'castle' && (
              <div className="absolute inset-[5%] rounded-2xl bg-[#9096A1] border-4 border-[#636B7A]">
                <div className="absolute left-1/2 -translate-x-1/2 top-[18%] bottom-[8%] w-[12%] bg-[#8D1D2C]/80" />
                <div className="absolute left-[28%] right-[28%] top-[6%] h-[18%] rounded-lg bg-[#7A818E] border border-[#D4AF37]/60" />
              </div>
            )}

            {env === 'sideScroller' && (
              <div className="absolute inset-x-[4%] top-[28%] bottom-[28%] rounded-xl bg-[#4D7C45]/90 border-2 border-[#C2A878]" />
            )}

            {env === 'scifi' && (
              <div className="absolute inset-[7%] rounded-2xl bg-[#1E293B] border-2 border-[#38BDF8]/50" />
            )}

            {/* Start */}
            {level.hasStart && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectEntity(HERO_START_ENTITY_ID);
                }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[#7C5CFF] text-white flex items-center justify-center shadow text-[10px] font-black transition-transform ${
                  selectedEntityID === HERO_START_ENTITY_ID
                    ? 'ring-3 ring-[#FBBF24] scale-115 z-20'
                    : 'ring-2 ring-white hover:scale-105 z-10'
                }`}
                style={{ left: `${startCoord.x * 100}%`, top: `${startCoord.y * 100}%` }}
                title="Hero Start (click to select, then click map to move)"
              >
                HERO
              </button>
            )}

            {/* Portal */}
            {level.hasPortal && (
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[#7C5CFF] text-white flex items-center justify-center shadow ring-2 ring-white"
                style={{ left: `${portalCoord.x * 100}%`, top: `${portalCoord.y * 100}%` }}
                title="Level Portal"
              >
                <MakerIcon symbol="sparkles" size={16} color="#FFFFFF" />
              </div>
            )}

            {/* Entities */}
            {level.entities.map((ent) => {
              const meta = EntityKindMeta[ent.kind];
              const selected = ent.id === selectedEntityID;
              return (
                <button
                  key={ent.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectEntity(ent.id);
                  }}
                  title={ent.name}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center shadow-md transition-transform ${
                    selected
                      ? 'ring-3 ring-slate-900 dark:ring-white scale-115 z-10'
                      : 'ring-2 ring-white hover:scale-105'
                  }`}
                  style={{
                    left: `${ent.position.x * 100}%`,
                    top: `${ent.position.y * 100}%`,
                    backgroundColor: meta.tint,
                    color: '#FFFFFF',
                  }}
                >
                  <MakerIcon symbol={meta.symbol} size={15} color="#FFFFFF" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
