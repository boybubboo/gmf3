import React from 'react';
import { Dices, Paintbrush, Sliders, Trees } from 'lucide-react';
import {
  CANOPY_LEAF_SHAPE_OPTIONS,
  createDefaultSpeciesConfig,
  TREE_SPECIES_OPTIONS,
} from '../../data/canopyEnginePresets';
import type { MakerStore } from '../../store/useMakerStore';
import type { LevelEntity, StylizedCanopyConfig, TreeSpeciesType } from '../../types/maker';

interface CanopyTreeInspectorProps {
  entity: LevelEntity;
  store: MakerStore;
  onOpenStudio: () => void;
  onOpenVertexPainter?: () => void;
}

export const CanopyTreeInspector: React.FC<CanopyTreeInspectorProps> = ({
  entity,
  store,
  onOpenStudio,
  onOpenVertexPainter,
}) => {
  if (!entity.canopyTree) return null;
  const species: TreeSpeciesType = entity.canopyTree.treeType ?? 'oak';
  const cfg: StylizedCanopyConfig = {
    ...createDefaultSpeciesConfig(species),
    ...entity.canopyTree,
  };

  const speciesLabel =
    species === 'custom'
      ? cfg.customTypeName?.trim() || 'Custom Tree'
      : TREE_SPECIES_OPTIONS.find((s) => s.id === species)?.label ?? 'Oak';

  const patchTree = (patch: Partial<StylizedCanopyConfig>, recordUndo = false) => {
    store.updateEntity(
      entity.id,
      'edit stylized tree',
      (ent) => ({
        ...ent,
        canopyTree: {
          ...createDefaultSpeciesConfig(ent.canopyTree?.treeType ?? 'oak'),
          ...(ent.canopyTree ?? {}),
          ...patch,
        },
      }),
      recordUndo
    );
  };

  const supportsFruit = species === 'oak' || species === 'fantasy' || species === 'custom';

  return (
    <div className="space-y-3 pt-2 border-t border-slate-200/70 dark:border-white/[0.08]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-extrabold text-[#20B46A] truncate">
          {speciesLabel} Tree
        </span>
        <button
          type="button"
          onClick={() => patchTree({ seed: Math.floor(Math.random() * 90000) + 1000 }, true)}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#20B46A]/15 hover:bg-[#20B46A]/25 text-[#20B46A] text-[11px] font-bold shrink-0"
        >
          <Dices size={11} />
          <span>Re-Roll</span>
        </button>
      </div>

      {/* Trunk Height & Roots Quick Controls */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-semibold">
            <span>Trunk</span>
            <span className="tabular-nums text-slate-500">{(cfg.trunkHeight ?? 2.85).toFixed(1)}m</span>
          </div>
          <input
            type="range"
            min={1.4}
            max={6.0}
            step={0.1}
            value={cfg.trunkHeight ?? 2.85}
            onChange={(e) => patchTree({ trunkHeight: Number(e.target.value) })}
            className="w-full accent-[#20B46A]"
          />
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-semibold">
            <span>Gnarl</span>
            <span className="tabular-nums text-slate-500">
              {Math.round((cfg.gnarlAmount ?? 0.35) * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.04}
            value={cfg.gnarlAmount ?? 0.35}
            onChange={(e) => patchTree({ gnarlAmount: Number(e.target.value) })}
            className="w-full accent-[#D97706]"
          />
        </div>
      </div>

      {/* Species-Specific Quick Sliders */}
      {species === 'conifer' ? (
        <>
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-semibold">
              <span>Layer Scarcity (Gaps)</span>
              <span className="tabular-nums text-slate-500">
                {Math.round((cfg.coniferScarcity ?? 0.28) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={cfg.coniferScarcity ?? 0.28}
              onChange={(e) => patchTree({ coniferScarcity: Number(e.target.value) })}
              className="w-full accent-[#20B46A]"
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-semibold">
              <span>Leaf Angle / Droop</span>
              <span className="tabular-nums text-slate-500">
                {(() => {
                  const d = cfg.coniferDroop ?? 0.34;
                  if (d < -0.02) return `Up ${Math.round(Math.abs(d) * 100)}%`;
                  if (d <= 0.02) return 'Level (0°)';
                  return `Droop ${Math.round(d * 100)}%`;
                })()}
              </span>
            </div>
            <input
              type="range"
              min={-1}
              max={1}
              step={0.02}
              value={cfg.coniferDroop ?? 0.34}
              onChange={(e) => patchTree({ coniferDroop: Number(e.target.value) })}
              className="w-full accent-[#20B46A]"
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-semibold">
              <span>Leaves per Tier</span>
              <span className="tabular-nums text-slate-500">
                {Math.round(cfg.coniferLeavesPerTier ?? 7)} / ring
              </span>
            </div>
            <input
              type="range"
              min={3}
              max={16}
              step={1}
              value={cfg.coniferLeavesPerTier ?? 7}
              onChange={(e) => patchTree({ coniferLeavesPerTier: Number(e.target.value) })}
              className="w-full accent-[#20B46A]"
            />
          </div>
        </>
      ) : species === 'birch' ? (
        <>
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-semibold">
              <span>Leaf Density</span>
              <span className="tabular-nums text-slate-500">
                {(cfg.birchLeafDensity ?? 1.25).toFixed(2)}×
              </span>
            </div>
            <input
              type="range"
              min={0.4}
              max={2.2}
              step={0.05}
              value={cfg.birchLeafDensity ?? 1.25}
              onChange={(e) => patchTree({ birchLeafDensity: Number(e.target.value) })}
              className="w-full accent-[#20B46A]"
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-semibold">
              <span>Autumn Hue Scatter</span>
              <span className="tabular-nums text-slate-500">±{Math.round(cfg.hueVariation)}°</span>
            </div>
            <input
              type="range"
              min={0}
              max={90}
              step={1}
              value={cfg.hueVariation}
              onChange={(e) => patchTree({ hueVariation: Number(e.target.value) })}
              className="w-full accent-[#F59E0B]"
            />
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-semibold">
                <span>Min Puffs</span>
                <span className="tabular-nums text-slate-500">{cfg.minPuffs}</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={cfg.minPuffs}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  patchTree({ minPuffs: v, maxPuffs: Math.max(v, cfg.maxPuffs) });
                }}
                className="w-full accent-[#20B46A]"
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-semibold">
                <span>Max Puffs</span>
                <span className="tabular-nums text-slate-500">{cfg.maxPuffs}</span>
              </div>
              <input
                type="range"
                min={1}
                max={12}
                step={1}
                value={cfg.maxPuffs}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  patchTree({ maxPuffs: v, minPuffs: Math.min(v, cfg.minPuffs) });
                }}
                className="w-full accent-[#20B46A]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-semibold">
              <span>Vertical Squish</span>
              <span className="tabular-nums text-slate-500">{cfg.squishY.toFixed(2)}×</span>
            </div>
            <input
              type="range"
              min={0.35}
              max={1.65}
              step={0.02}
              value={cfg.squishY}
              onChange={(e) => patchTree({ squishY: Number(e.target.value) })}
              className="w-full accent-[#20B46A]"
            />
          </div>

          {supportsFruit && (
            <div className="space-y-1.5">
              <label className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-[11px] font-bold cursor-pointer">
                <span>
                  3D Leaves (
                  {CANOPY_LEAF_SHAPE_OPTIONS.find((s) => s.id === (cfg.canopyLeafShape ?? 'basic'))
                    ?.label ?? 'Basic'}{' '}
                  · {cfg.canopyLeafCount ?? 220})
                </span>
                <input
                  type="checkbox"
                  checked={cfg.canopyLeavesEnabled ?? true}
                  onChange={(e) => patchTree({ canopyLeavesEnabled: e.target.checked }, true)}
                  className="accent-[#20B46A]"
                />
              </label>
              <label className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-[11px] font-bold cursor-pointer">
                <span>Grow Fruit ({cfg.fruitCount ?? 12})</span>
                <input
                  type="checkbox"
                  checked={Boolean(cfg.fruitEnabled)}
                  onChange={(e) => patchTree({ fruitEnabled: e.target.checked }, true)}
                  className="accent-[#E11D48]"
                />
              </label>
            </div>
          )}
        </>
      )}

      {/* Hue Shift */}
      <div className="space-y-1">
        <div className="flex justify-between text-[11px] font-semibold">
          <span>Hue Shift</span>
          <span className="tabular-nums text-slate-500">
            {cfg.hueShift > 0 ? '+' : ''}
            {Math.round(cfg.hueShift)}°
          </span>
        </div>
        <input
          type="range"
          min={-180}
          max={180}
          step={1}
          value={cfg.hueShift}
          onChange={(e) => patchTree({ hueShift: Number(e.target.value) })}
          className="w-full accent-[#7C5CFF]"
        />
      </div>

      <div className="space-y-1.5 pt-1">
        {onOpenVertexPainter && (
          <button
            type="button"
            onClick={onOpenVertexPainter}
            className="w-full py-2 rounded-xl bg-[#7C5CFF]/15 hover:bg-[#7C5CFF]/25 text-[#7C5CFF] text-xs font-bold inline-flex items-center justify-center gap-1.5"
          >
            <Paintbrush size={13} />
            <span>Vertex Paint Leaves &amp; Branches</span>
            {(cfg.vertexPaintStrokes?.length ?? 0) > 0 && (
              <span className="tabular-nums text-[10px] opacity-85">
                ({cfg.vertexPaintStrokes!.length})
              </span>
            )}
          </button>
        )}

        <button
          type="button"
          onClick={() =>
            store.updateLevel(
              'apply tree style to island forest',
              (lvl) => ({
                ...lvl,
                canopyEngine: {
                  ...cfg,
                  enabled: true,
                  targetTrees:
                    cfg.targetTrees === 'placedOnly' ? 'matching' : cfg.targetTrees,
                },
              }),
              true
            )
          }
          className="w-full py-2 rounded-xl bg-[#20B46A]/15 hover:bg-[#20B46A]/25 text-[#20B46A] text-xs font-bold inline-flex items-center justify-center gap-1.5"
        >
          <Trees size={13} />
          <span>Apply to Island Forest</span>
        </button>

        <button
          type="button"
          onClick={onOpenStudio}
          className="w-full py-2 rounded-xl bg-slate-100 dark:bg-[#1F2430] hover:bg-slate-200 dark:hover:bg-[#272D3C] text-xs font-bold inline-flex items-center justify-center gap-1.5"
        >
          <Sliders size={13} />
          <span>Open Tree Maker</span>
        </button>
      </div>
    </div>
  );
};
