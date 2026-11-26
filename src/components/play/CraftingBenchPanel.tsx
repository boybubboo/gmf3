import React, { useMemo, useState } from 'react';
import {
  Anvil,
  Check,
  FlaskConical,
  Hammer,
  Sparkles,
  Wrench,
} from 'lucide-react';
import {
  findCraftingRecipe,
  resolveItemMetadata,
  type ResolvedItemMetadata,
} from '../../data/registries';
import type {
  CraftingRecipe,
  InventoryItemCategory,
  InventoryItemDef,
  InventoryStack,
} from '../../types/maker';
import { ItemThumbnailArt } from '../shared/ItemThumbnailArt';
import type { TooltipHoverState } from './ItemTooltip';

type RecipeFilter = 'all' | 'craftable' | 'weapon' | 'consumable' | 'wearable' | 'alchemy';

const RARITY_COLOR: Record<string, string> = {
  common: '#94A3B8',
  uncommon: '#20B46A',
  rare: '#38BDF8',
  epic: '#A855F7',
  legendary: '#FACC15',
};

interface CraftingBenchPanelProps {
  catalog: InventoryItemDef[];
  recipes: CraftingRecipe[];
  stacks: InventoryStack[];
  nearWorldBench?: boolean;
  onCraftRecipe: (recipe: CraftingRecipe) => void;
  onMixItems: (itemIdA: string, itemIdB: string) => void;
  onRepairItem?: (itemId: string) => void;
  onSelectItem?: (itemId: string) => void;
  onHoverTooltip?: (hover: TooltipHoverState | null) => void;
}

export const CraftingBenchPanel: React.FC<CraftingBenchPanelProps> = ({
  catalog,
  recipes,
  stacks,
  nearWorldBench = false,
  onCraftRecipe,
  onMixItems,
  onRepairItem,
  onSelectItem,
  onHoverTooltip,
}) => {
  const [filter, setFilter] = useState<RecipeFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>(recipes[0]?.id ?? '');
  const [mixSlotA, setMixSlotA] = useState<string | null>(null);
  const [mixSlotB, setMixSlotB] = useState<string | null>(null);

  const itemById = useMemo(() => {
    const m = new Map<string, InventoryItemDef>();
    for (const d of catalog) m.set(d.id, d);
    return m;
  }, [catalog]);

  const stackQty = (id: string | null) =>
    id ? stacks.find((s) => s.itemId === id)?.qty ?? 0 : 0;

  const canCraftRecipe = (r: CraftingRecipe) => {
    if (r.ingredientA === r.ingredientB) {
      return stackQty(r.ingredientA) >= 2;
    }
    return stackQty(r.ingredientA) >= 1 && stackQty(r.ingredientB) >= 1;
  };

  const inferRecipeBucket = (r: CraftingRecipe): Exclude<RecipeFilter, 'all' | 'craftable'> => {
    if (r.category === 'tool' || r.category === 'weapon') return 'weapon';
    if (r.category === 'consumable' || r.category === 'wearable' || r.category === 'alchemy') {
      return r.category;
    }
    const res = itemById.get(r.resultItemId);
    if (!res) return 'consumable';
    if (res.category === 'weapon' || res.category === 'tool') return 'weapon';
    if (res.category === 'wearable') return 'wearable';
    return 'consumable';
  };

  const filteredRecipes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recipes.filter((r) => {
      const res = itemById.get(r.resultItemId);
      const ingA = itemById.get(r.ingredientA);
      const ingB = itemById.get(r.ingredientB);
      if (!res || !ingA || !ingB) return false;

      if (filter === 'craftable' && !canCraftRecipe(r)) return false;
      if (filter !== 'all' && filter !== 'craftable' && inferRecipeBucket(r) !== filter) {
        return false;
      }

      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        res.name.toLowerCase().includes(q) ||
        ingA.name.toLowerCase().includes(q) ||
        ingB.name.toLowerCase().includes(q)
      );
    });
  }, [recipes, filter, search, itemById, stacks]);

  const selectedRecipe =
    filteredRecipes.find((r) => r.id === selectedRecipeId) ??
    recipes.find((r) => r.id === selectedRecipeId) ??
    filteredRecipes[0] ??
    recipes[0] ??
    null;

  const selectedOutputDef = selectedRecipe
    ? itemById.get(selectedRecipe.resultItemId) ?? null
    : null;
  const selectedOutputMeta: ResolvedItemMetadata | null = selectedOutputDef
    ? resolveItemMetadata(selectedOutputDef)
    : null;

  // Experimental mixer validation
  const validSlotA = mixSlotA && stackQty(mixSlotA) > 0 ? mixSlotA : null;
  const validSlotB =
    mixSlotB &&
    (mixSlotB === validSlotA ? stackQty(mixSlotB) >= 2 : stackQty(mixSlotB) > 0)
      ? mixSlotB
      : null;

  const matchedMixRecipe = useMemo(() => {
    if (!validSlotA || !validSlotB) return null;
    return findCraftingRecipe(recipes, validSlotA, validSlotB);
  }, [recipes, validSlotA, validSlotB]);

  const matchedMixResult = matchedMixRecipe
    ? itemById.get(matchedMixRecipe.resultItemId) ?? null
    : null;

  const canMixImprovised = Boolean(
    validSlotA &&
      validSlotB &&
      !matchedMixRecipe &&
      (() => {
        const a = itemById.get(validSlotA);
        const b = itemById.get(validSlotB);
        if (!a || !b) return false;
        const okCat = (c: InventoryItemCategory) =>
          c === 'consumable' || c === 'resource' || c === 'material';
        return okCat(a.category) && okCat(b.category);
      })()
  );

  // Repairable worn equipment in bag
  const wornEquipment = useMemo(() => {
    return stacks
      .filter((st) => st.qty > 0)
      .map((st) => {
        const def = itemById.get(st.itemId);
        if (!def) return null;
        const meta = resolveItemMetadata(def, st);
        if (!meta.repairable || meta.maxDurability <= 1) return null;
        if (meta.durability >= meta.maxDurability) return null;
        return { stack: st, def, meta };
      })
      .filter(
        (x): x is { stack: InventoryStack; def: InventoryItemDef; meta: ResolvedItemMetadata } =>
          Boolean(x)
      );
  }, [stacks, itemById]);

  const mixableBagStacks = useMemo(() => {
    return stacks.filter((st) => {
      if (st.qty <= 0) return false;
      const def = itemById.get(st.itemId);
      if (!def) return false;
      return (
        def.category === 'resource' ||
        def.category === 'material' ||
        def.category === 'consumable'
      );
    });
  }, [stacks, itemById]);

  const handleAssignMixSlot = (itemId: string) => {
    onSelectItem?.(itemId);
    if (!validSlotA) {
      setMixSlotA(itemId);
    } else if (!validSlotB) {
      if (itemId === validSlotA && stackQty(itemId) < 2) return;
      setMixSlotB(itemId);
    } else {
      setMixSlotA(itemId);
      setMixSlotB(null);
    }
  };

  return (
    <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-y-auto lg:overflow-hidden">
      {/* Left: Blueprint Catalog */}
      <section className="lg:col-span-6 p-4 sm:p-5 lg:overflow-y-auto maker-scroll border-b lg:border-b-0 lg:border-r border-white/8 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Anvil size={16} className="text-[#F59E0B]" />
            <h3 className="text-sm font-extrabold text-white">Crafting Blueprints</h3>
            {nearWorldBench && (
              <span className="text-[11px] font-bold text-[#20B46A]">
                · World Bench Active
              </span>
            )}
          </div>
          <span className="text-xs font-semibold text-[#64748B] tabular-nums">
            {filteredRecipes.filter(canCraftRecipe).length}/{filteredRecipes.length} ready
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search blueprints or ingredients…"
            className="flex-1 min-w-[160px] px-3 py-1.5 rounded-lg bg-[#0D1018] border border-white/10 text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-[#7C5CFF]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#0D1018] border border-white/8">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'craftable', label: 'Ready' },
              { id: 'weapon', label: 'Weapons & Tools' },
              { id: 'consumable', label: 'Food & Stew' },
              { id: 'alchemy', label: 'Alchemy' },
              { id: 'wearable', label: 'Apparel' },
            ] as { id: RecipeFilter; label: string }[]
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap shrink-0 ${
                filter === f.id
                  ? 'bg-[#7C5CFF] text-white'
                  : 'text-[#949BB0] hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filteredRecipes.length === 0 ? (
          <div className="py-10 text-center rounded-xl border border-dashed border-white/10 text-xs text-[#949BB0] px-4">
            No matching crafting blueprints. Try switching filter or gather more forest mushrooms, herbs, logs, and stones!
          </div>
        ) : (
          <div className="space-y-2">
            {filteredRecipes.map((r) => {
              const ingA = itemById.get(r.ingredientA);
              const ingB = itemById.get(r.ingredientB);
              const res = itemById.get(r.resultItemId);
              if (!ingA || !ingB || !res) return null;

              const ready = canCraftRecipe(r);
              const active = selectedRecipe?.id === r.id;
              const needSame = r.ingredientA === r.ingredientB;
              const qtyA = stackQty(r.ingredientA);
              const qtyB = stackQty(r.ingredientB);
              const resMeta = resolveItemMetadata(res);

              return (
                <div
                  key={r.id}
                  onClick={() => {
                    setSelectedRecipeId(r.id);
                    onSelectItem?.(res.id);
                  }}
                  className={`p-3 rounded-xl border cursor-pointer transition-colors flex items-center justify-between gap-3 ${
                    active
                      ? 'bg-[#1B2233] border-[#7C5CFF]'
                      : ready
                      ? 'bg-[#151D2B] border-[#20B46A]/35 hover:border-[#20B46A]/65'
                      : 'bg-[#141925] border-white/8 hover:border-white/18'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      onMouseEnter={(e) =>
                        onHoverTooltip?.({
                          item: res,
                          stack: stacks.find((s) => s.itemId === res.id) ?? null,
                          x: e.clientX,
                          y: e.clientY,
                          statusTag: ready ? 'Ready to Craft' : 'Blueprint',
                          hint: 'Click blueprint to inspect or Craft to forge',
                        })
                      }
                      onMouseMove={(e) =>
                        onHoverTooltip?.({
                          item: res,
                          stack: stacks.find((s) => s.itemId === res.id) ?? null,
                          x: e.clientX,
                          y: e.clientY,
                          statusTag: ready ? 'Ready to Craft' : 'Blueprint',
                          hint: 'Click blueprint to inspect or Craft to forge',
                        })
                      }
                      onMouseLeave={() => onHoverTooltip?.(null)}
                      className="shrink-0"
                    >
                      <ItemThumbnailArt
                        meshKind={res.meshKind}
                        colorHex={res.colorHex}
                        size={44}
                        className="shrink-0"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-extrabold text-white truncate">
                          {r.title}
                        </span>
                        {r.resultQty > 1 && (
                          <span className="text-[11px] font-bold text-[#94A3B8] tabular-nums">
                            ×{r.resultQty}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#94A3B8] mt-0.5 truncate">
                        {needSame ? (
                          <span className={qtyA >= 2 ? 'text-[#4ADE80]' : 'text-[#94A3B8]'}>
                            2× {ingA.name} ({qtyA}/2)
                          </span>
                        ) : (
                          <>
                            <span className={qtyA >= 1 ? 'text-[#4ADE80]' : 'text-[#94A3B8]'}>
                              {ingA.name} ({qtyA}/1)
                            </span>
                            <span className="mx-1 text-[#64748B]">+</span>
                            <span className={qtyB >= 1 ? 'text-[#4ADE80]' : 'text-[#94A3B8]'}>
                              {ingB.name} ({qtyB}/1)
                            </span>
                          </>
                        )}
                      </div>
                      <div className="text-[10px] font-semibold mt-0.5 text-[#7D879F] capitalize">
                        <span style={{ color: RARITY_COLOR[resMeta.rarity] ?? '#94A3B8' }}>
                          {resMeta.rarity}
                        </span>
                        {' · '}PWR {resMeta.power}
                        {resMeta.maxDurability > 1 ? ` · DUR ${resMeta.maxDurability}` : ''}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!ready}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCraftRecipe(r);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap transition-colors ${
                      ready
                        ? 'bg-[#20B46A] hover:bg-[#199958] text-white'
                        : 'bg-white/6 text-[#64748B] cursor-not-allowed'
                    }`}
                  >
                    <Hammer size={12} />
                    <span>Craft</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Right: Output Metadata Preview, Experimental Bench Mix & Repair Anvil */}
      <section className="lg:col-span-6 p-4 sm:p-5 lg:overflow-y-auto maker-scroll space-y-4 bg-[#131723]">
        {/* Selected Blueprint Output Inspector */}
        {selectedRecipe && selectedOutputDef && selectedOutputMeta && (
          <div className="p-4 rounded-xl bg-[#191F2F] border border-white/10 space-y-3.5">
            <div className="flex items-start gap-4">
              <div
                className="w-20 h-20 rounded-2xl shrink-0 flex items-center justify-center border border-white/12 bg-[#0E131E]"
                style={{ boxShadow: `inset 0 0 26px ${selectedOutputDef.colorHex}26` }}
              >
                <ItemThumbnailArt
                  meshKind={selectedOutputDef.meshKind}
                  colorHex={selectedOutputDef.colorHex}
                  size={66}
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-extrabold text-white truncate">
                    {selectedOutputDef.name}
                  </div>
                  <span className="text-[11px] font-bold text-[#94A3B8] tabular-nums shrink-0">
                    Owned: {stackQty(selectedOutputDef.id)}
                  </span>
                </div>
                <div className="text-[11px] font-semibold text-[#94A3B8] capitalize">
                  <span style={{ color: RARITY_COLOR[selectedOutputMeta.rarity] }}>
                    {selectedOutputMeta.rarity}
                  </span>
                  {' · '}
                  {selectedOutputDef.category}
                  {' · '}
                  {selectedOutputMeta.weight.toFixed(1)} kg
                </div>
                <p className="text-xs text-[#CBD5E1] leading-relaxed">
                  {selectedOutputDef.description}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="px-2.5 py-2 rounded-lg bg-[#0F1420] border border-white/8">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                  Power
                </div>
                <div className="text-xs font-extrabold text-[#38BDF8] tabular-nums mt-0.5">
                  {selectedOutputMeta.power}
                </div>
              </div>
              <div className="px-2.5 py-2 rounded-lg bg-[#0F1420] border border-white/8">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                  Durability
                </div>
                <div className="text-xs font-extrabold text-[#FACC15] tabular-nums mt-0.5">
                  {selectedOutputMeta.maxDurability > 1
                    ? `${selectedOutputMeta.durability}/${selectedOutputMeta.maxDurability}`
                    : 'Single Use'}
                </div>
              </div>
              <div className="px-2.5 py-2 rounded-lg bg-[#0F1420] border border-white/8">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                  Output Yield
                </div>
                <div className="text-xs font-extrabold text-[#20B46A] tabular-nums mt-0.5">
                  ×{selectedRecipe.resultQty}
                </div>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-[#0F1420] border border-white/8 flex items-start gap-2 text-[11px] text-[#C084FC]">
              <Sparkles size={13} className="shrink-0 mt-0.5" />
              <span>{selectedOutputMeta.magic_effect}</span>
            </div>

            <button
              type="button"
              disabled={!canCraftRecipe(selectedRecipe)}
              onClick={() => onCraftRecipe(selectedRecipe)}
              className={`w-full py-2.5 rounded-xl text-xs font-extrabold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
                canCraftRecipe(selectedRecipe)
                  ? 'bg-[#20B46A] hover:bg-[#199958] text-white'
                  : 'bg-white/6 text-[#64748B] cursor-not-allowed'
              }`}
            >
              <Hammer size={14} />
              <span>
                {canCraftRecipe(selectedRecipe)
                  ? `Craft ${selectedOutputDef.name}`
                  : 'Missing Required Ingredients'}
              </span>
            </button>
          </div>
        )}

        {/* Custom 2-Slot Bench Mixer */}
        <div className="p-4 rounded-xl bg-[#191F2F] border border-white/10 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-white">
              <FlaskConical size={14} className="text-[#A855F7]" />
              <span>Experimental Mixing Anvil</span>
            </div>
            {(validSlotA || validSlotB) && (
              <button
                type="button"
                onClick={() => {
                  setMixSlotA(null);
                  setMixSlotB(null);
                }}
                className="text-[11px] font-bold text-[#94A3B8] hover:text-white"
              >
                Clear
              </button>
            )}
          </div>

          <div className="grid grid-cols-5 items-center gap-2">
            {[
              { id: validSlotA, clear: () => setMixSlotA(null), placeholder: 'Slot A' },
              { id: validSlotB, clear: () => setMixSlotB(null), placeholder: 'Slot B' },
            ].map((slot, idx) => {
              const def = slot.id ? itemById.get(slot.id) : null;
              return (
                <React.Fragment key={idx}>
                  <button
                    type="button"
                    onClick={slot.clear}
                    className="col-span-2 p-2 rounded-xl bg-[#0F1420] border border-white/10 text-left flex items-center gap-2 min-h-[50px]"
                  >
                    {def ? (
                      <>
                        <ItemThumbnailArt
                          meshKind={def.meshKind}
                          colorHex={def.colorHex}
                          size={30}
                          className="shrink-0"
                        />
                        <span className="text-[11px] font-bold truncate text-white">
                          {def.name}
                        </span>
                      </>
                    ) : (
                      <span className="text-[11px] text-[#64748B] font-semibold px-1">
                        {slot.placeholder}
                      </span>
                    )}
                  </button>
                  {idx === 0 && (
                    <div className="col-span-1 text-center text-sm font-black text-[#64748B]">
                      +
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>

            {mixableBagStacks.length > 0 && (
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto maker-scroll">
                {mixableBagStacks.map((st) => {
                  const def = itemById.get(st.itemId);
                  if (!def) return null;
                  return (
                    <button
                      key={st.itemId}
                      type="button"
                      onClick={() => handleAssignMixSlot(st.itemId)}
                      onMouseEnter={(e) =>
                        onHoverTooltip?.({
                          item: def,
                          stack: st,
                          x: e.clientX,
                          y: e.clientY,
                          hint: 'Click to place into mixing slot',
                        })
                      }
                      onMouseMove={(e) =>
                        onHoverTooltip?.({
                          item: def,
                          stack: st,
                          x: e.clientX,
                          y: e.clientY,
                          hint: 'Click to place into mixing slot',
                        })
                      }
                      onMouseLeave={() => onHoverTooltip?.(null)}
                      className="px-2 py-1 rounded-lg bg-[#0F1420] hover:bg-[#232A3E] border border-white/10 text-[11px] font-semibold text-[#E2E8F0] inline-flex items-center gap-1.5"
                    >
                      <ItemThumbnailArt
                        meshKind={def.meshKind}
                        colorHex={def.colorHex}
                        size={18}
                        className="shrink-0"
                      />
                      <span className="truncate max-w-[110px]">{def.name}</span>
                      <span className="text-[10px] text-[#94A3B8] tabular-nums">×{st.qty}</span>
                    </button>
                  );
                })}
              </div>
            )}

          {validSlotA && validSlotB && (
            <div className="p-2.5 rounded-xl bg-[#0F1420] border border-white/10 flex items-center justify-between gap-2">
              {matchedMixResult ? (
                <div className="flex items-center gap-2 min-w-0">
                  <ItemThumbnailArt
                    meshKind={matchedMixResult.meshKind}
                    colorHex={matchedMixResult.colorHex}
                    size={28}
                    className="shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-[#20B46A] truncate">
                      → {matchedMixResult.name}
                    </div>
                    <div className="text-[10px] text-[#94A3B8] truncate">
                      {resolveItemMetadata(matchedMixResult).magic_effect}
                    </div>
                  </div>
                </div>
              ) : canMixImprovised ? (
                <div className="text-xs font-bold text-[#F59E0B]">
                  → Woodland Healing Tonic (Improvised Mix)
                </div>
              ) : (
                <div className="text-[11px] text-[#94A3B8]">
                  These two items do not combine.
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            disabled={!(matchedMixRecipe || canMixImprovised)}
            onClick={() => {
              if (!validSlotA || !validSlotB) return;
              onMixItems(validSlotA, validSlotB);
              setMixSlotA(null);
              setMixSlotB(null);
            }}
            className={`w-full py-2 rounded-xl text-xs font-extrabold transition-colors whitespace-nowrap shrink-0 ${
              matchedMixRecipe || canMixImprovised
                ? 'bg-[#A855F7] hover:bg-[#9333EA] text-white'
                : 'bg-white/6 text-[#64748B] cursor-not-allowed'
            }`}
          >
            Combine on Bench
          </button>
        </div>

        {/* Gear Repair & Whetstone Station */}
        {onRepairItem && (
          <div className="p-4 rounded-xl bg-[#191F2F] border border-white/10 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-white">
                <Wrench size={14} className="text-[#38BDF8]" />
                <span>Repair &amp; Whetstone</span>
              </div>
              <span className="text-[10px] text-[#94A3B8]">
                {wornEquipment.length === 0 ? 'All gear 100%' : `${wornEquipment.length} worn`}
              </span>
            </div>

            {wornEquipment.length === 0 ? (
              <div className="p-2.5 rounded-lg bg-[#0F1420] border border-white/8 text-[11px] text-[#94A3B8] flex items-center gap-2">
                <Check size={13} className="text-[#20B46A] shrink-0" />
                <span>All weapons, tools, and apparel are in top condition.</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                {wornEquipment.map(({ def, meta }) => {
                  const pct = Math.round((meta.durability / meta.maxDurability) * 100);
                  return (
                    <div
                      key={def.id}
                      className="p-2 rounded-lg bg-[#0F1420] border border-white/8 flex items-center justify-between gap-2"
                    >
                      <div
                        className="flex items-center gap-2 min-w-0"
                        onMouseEnter={(e) =>
                          onHoverTooltip?.({
                            item: def,
                            stack: wornEquipment.find((w) => w.def.id === def.id)?.stack ?? null,
                            x: e.clientX,
                            y: e.clientY,
                            statusTag: `Worn ${pct}%`,
                            hint: 'Click Repair to restore full durability',
                          })
                        }
                        onMouseMove={(e) =>
                          onHoverTooltip?.({
                            item: def,
                            stack: wornEquipment.find((w) => w.def.id === def.id)?.stack ?? null,
                            x: e.clientX,
                            y: e.clientY,
                            statusTag: `Worn ${pct}%`,
                            hint: 'Click Repair to restore full durability',
                          })
                        }
                        onMouseLeave={() => onHoverTooltip?.(null)}
                      >
                        <ItemThumbnailArt
                          meshKind={def.meshKind}
                          colorHex={def.colorHex}
                          size={28}
                          className="shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">{def.name}</div>
                          <div className="text-[10px] text-[#F59E0B] tabular-nums">
                            Durability {meta.durability}/{meta.maxDurability} ({pct}%)
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRepairItem(def.id)}
                        className="px-2.5 py-1 rounded-lg bg-[#38BDF8] hover:bg-[#0EA5E9] text-slate-950 text-[11px] font-extrabold whitespace-nowrap shrink-0"
                      >
                        Repair
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
