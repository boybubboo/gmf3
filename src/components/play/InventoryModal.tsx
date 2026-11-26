import React, { useEffect, useMemo, useState } from 'react';
import {
  Anvil,
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  Backpack,
  FlaskConical,
  Hammer,
  Hand,
  Heart,
  Shield,
  Shirt,
  Sparkles,
  Swords,
  Utensils,
  X,
  Zap,
} from 'lucide-react';
import {
  findCraftingRecipe,
  formatKeyCodeLabel,
  resolveGameInventoryConfig,
  resolveItemMetadata,
} from '../../data/registries';
import type {
  CraftingRecipe,
  GameInventoryConfig,
  HeroEquipment,
  InventoryItemCategory,
  InventoryItemDef,
  InventoryStack,
} from '../../types/maker';
import { ItemThumbnailArt } from '../shared/ItemThumbnailArt';
import { CraftingBenchPanel } from './CraftingBenchPanel';
import {
  buildContextualStats,
  ItemTooltip,
  RARITY_COLORS,
  RARITY_RANK,
  type TooltipHoverState,
} from './ItemTooltip';

type TypeFilterId = 'all' | 'weapon' | 'tool' | 'wearable' | 'consumable' | 'resource';
type SortById = 'default' | 'power' | 'rarity' | 'durability' | 'category' | 'name' | 'qty';

interface InventoryModalProps {
  heroName: string;
  stacks: InventoryStack[];
  equipment: HeroEquipment;
  catalog: InventoryItemDef[];
  recipes: CraftingRecipe[];
  inventoryConfig?: GameInventoryConfig;
  initialMode?: 'bag' | 'bench';
  nearWorldBench?: boolean;
  health: number;
  maxHealth: number;
  stamina: number;
  magic: number;
  attackPower: number;
  defensePower: number;
  speedPct: number;
  onSelectItem?: (itemId: string) => void;
  onHoldItem: (itemId: string | null) => void;
  onWearItem: (item: InventoryItemDef) => void;
  onUnequipSlot: (slot: 'head' | 'body' | 'accessory' | 'offhand') => void;
  onConsumeItem: (item: InventoryItemDef) => void;
  onMixItems: (itemIdA: string, itemIdB: string) => void;
  onCraftRecipe?: (recipe: CraftingRecipe) => void;
  onRepairItem?: (itemId: string) => void;
  onClose: () => void;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({
  heroName,
  stacks,
  equipment,
  catalog,
  recipes,
  inventoryConfig,
  initialMode = 'bag',
  nearWorldBench = false,
  health,
  maxHealth,
  stamina,
  magic,
  attackPower,
  defensePower,
  speedPct,
  onSelectItem,
  onHoldItem,
  onWearItem,
  onUnequipSlot,
  onConsumeItem,
  onMixItems,
  onCraftRecipe,
  onRepairItem,
  onClose,
}) => {
  const cfg = useMemo(
    () => inventoryConfig ?? resolveGameInventoryConfig(null),
    [inventoryConfig]
  );
  const categories = cfg.categories;
  const [modalMode, setModalMode] = useState<'bag' | 'bench'>(initialMode);
  const [filterId, setFilterId] = useState<string>(categories[0]?.id ?? 'all');
  const [typeFilter, setTypeFilter] = useState<TypeFilterId>('all');
  const [sortBy, setSortBy] = useState<SortById>('default');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [hoverTooltip, setHoverTooltip] = useState<TooltipHoverState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    equipment.heldItemId ?? stacks[0]?.itemId ?? null
  );
  const [mixSlotA, setMixSlotA] = useState<string | null>(null);
  const [mixSlotB, setMixSlotB] = useState<string | null>(null);

  useEffect(() => {
    setModalMode(initialMode);
    setHoverTooltip(null);
  }, [initialMode]);

  useEffect(() => {
    setHoverTooltip(null);
  }, [modalMode]);

  useEffect(() => {
    if (selectedId) {
      onSelectItem?.(selectedId);
    }
  }, [selectedId, onSelectItem]);

  const activeCategory =
    categories.find((c) => c.id === filterId) ?? categories[0];

  const itemById = useMemo(() => {
    const m = new Map<string, InventoryItemDef>();
    for (const item of catalog) m.set(item.id, item);
    return m;
  }, [catalog]);

  const stackQty = (id: string | null) =>
    id ? stacks.find((s) => s.itemId === id)?.qty ?? 0 : 0;

  const matchesTypeFilter = (def: InventoryItemDef, tf: TypeFilterId): boolean => {
    if (tf === 'all') return true;
    if (tf === 'resource') return def.category === 'resource' || def.category === 'material';
    return def.category === tf;
  };

  const typeCounts = useMemo(() => {
    const counts: Record<TypeFilterId, number> = {
      all: 0,
      weapon: 0,
      tool: 0,
      wearable: 0,
      consumable: 0,
      resource: 0,
    };
    for (const st of stacks) {
      if (st.qty <= 0) continue;
      const def = itemById.get(st.itemId);
      if (!def) continue;
      counts.all += 1;
      if (def.category === 'resource' || def.category === 'material') {
        counts.resource += 1;
      } else if (def.category in counts) {
        counts[def.category as TypeFilterId] += 1;
      }
    }
    return counts;
  }, [stacks, itemById]);

  const filteredStacks = useMemo(() => {
    const list = stacks.filter((st) => {
      if (st.qty <= 0) return false;
      const def = itemById.get(st.itemId);
      if (!def) return false;

      if (!matchesTypeFilter(def, typeFilter)) return false;

      if (!activeCategory || activeCategory.id === 'all') return true;
      if (def.customCategoryId) {
        return def.customCategoryId === activeCategory.id;
      }
      if (
        (def.category === 'resource' || def.category === 'material') &&
        (activeCategory.matchCategories.includes('resource') ||
          activeCategory.matchCategories.includes('material'))
      ) {
        return true;
      }
      return activeCategory.matchCategories.includes(def.category);
    });

    if (sortBy === 'default') return list;

    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      const defA = itemById.get(a.itemId);
      const defB = itemById.get(b.itemId);
      if (!defA || !defB) return 0;
      const metaA = resolveItemMetadata(defA, a);
      const metaB = resolveItemMetadata(defB, b);

      let cmp = 0;
      if (sortBy === 'power') {
        cmp = metaA.power - metaB.power;
      } else if (sortBy === 'rarity') {
        cmp = (RARITY_RANK[metaA.rarity] ?? 1) - (RARITY_RANK[metaB.rarity] ?? 1);
        if (cmp === 0) cmp = metaA.power - metaB.power;
      } else if (sortBy === 'durability') {
        const durA = metaA.maxDurability > 1 ? metaA.durability / metaA.maxDurability : 1;
        const durB = metaB.maxDurability > 1 ? metaB.durability / metaB.maxDurability : 1;
        cmp = durA - durB;
        if (cmp === 0) cmp = metaA.maxDurability - metaB.maxDurability;
      } else if (sortBy === 'category') {
        cmp = defA.category.localeCompare(defB.category);
        if (cmp === 0) cmp = metaB.power - metaA.power;
      } else if (sortBy === 'qty') {
        cmp = a.qty - b.qty;
      } else if (sortBy === 'name') {
        cmp = defA.name.localeCompare(defB.name);
      }

      if (cmp === 0) cmp = defA.name.localeCompare(defB.name);
      return cmp * dir;
    });
  }, [stacks, itemById, activeCategory, typeFilter, sortBy, sortDir]);

  const handleTypeFilterClick = (tf: TypeFilterId) => {
    setTypeFilter(tf);
    if (tf !== 'all' && activeCategory && activeCategory.id !== 'all') {
      const matchTarget =
        tf === 'resource'
          ? activeCategory.matchCategories.includes('resource') ||
            activeCategory.matchCategories.includes('material')
          : activeCategory.matchCategories.includes(tf);
      if (!matchTarget) {
        setFilterId(categories[0]?.id ?? 'all');
      }
    }
  };

  const handleSortClick = (nextSort: SortById) => {
    if (nextSort === 'default') {
      setSortBy('default');
      return;
    }
    if (sortBy === nextSort) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(nextSort);
      setSortDir(nextSort === 'name' || nextSort === 'category' ? 'asc' : 'desc');
    }
  };

  const selectedStack = selectedId ? stacks.find((s) => s.itemId === selectedId) ?? null : null;
  const selectedDef = selectedId ? itemById.get(selectedId) ?? null : null;
  const selectedQty = selectedStack?.qty ?? 0;
  const selectedMetadata = useMemo(
    () => (selectedDef ? resolveItemMetadata(selectedDef, selectedStack) : null),
    [selectedDef, selectedStack]
  );

  const validSlotA = mixSlotA && stackQty(mixSlotA) > 0 ? mixSlotA : null;
  const validSlotB =
    mixSlotB &&
    (mixSlotB === validSlotA ? stackQty(mixSlotB) >= 2 : stackQty(mixSlotB) > 0)
      ? mixSlotB
      : null;

  const matchedRecipe = useMemo(() => {
    if (!validSlotA || !validSlotB) return null;
    return findCraftingRecipe(recipes, validSlotA, validSlotB);
  }, [recipes, validSlotA, validSlotB]);

  const matchedResultDef = matchedRecipe
    ? itemById.get(matchedRecipe.resultItemId) ?? null
    : null;

  const canMixFallback = Boolean(
    validSlotA &&
      validSlotB &&
      !matchedRecipe &&
      (() => {
        const a = itemById.get(validSlotA);
        const b = itemById.get(validSlotB);
        if (!a || !b) return false;
        const mixable = (cat: InventoryItemCategory) =>
          cat === 'consumable' || cat === 'resource' || cat === 'material';
        return mixable(a.category) && mixable(b.category);
      })()
  );

  const handleSelectItemId = (id: string) => {
    setSelectedId(id);
    onSelectItem?.(id);
  };

  const handleAddToMix = (itemId: string) => {
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

  const handleCommitMix = () => {
    if (!validSlotA || !validSlotB) return;
    onMixItems(validSlotA, validSlotB);
    setMixSlotA(null);
    setMixSlotB(null);
  };

  const handleCraft = (recipe: CraftingRecipe) => {
    if (onCraftRecipe) {
      onCraftRecipe(recipe);
    } else {
      onMixItems(recipe.ingredientA, recipe.ingredientB);
    }
  };

  const quickCraftCandidate = useMemo(() => {
    const isBasicToolOrWeapon = (r: CraftingRecipe, res: InventoryItemDef) =>
      r.category === 'tool' ||
      r.category === 'weapon' ||
      res.category === 'tool' ||
      res.category === 'weapon';

    const tryMatchPair = (idA: string, idB: string) => {
      const recipe = findCraftingRecipe(recipes, idA, idB);
      if (!recipe) return null;
      const res = itemById.get(recipe.resultItemId);
      const ingA = itemById.get(recipe.ingredientA);
      const ingB = itemById.get(recipe.ingredientB);
      if (!res || !ingA || !ingB) return null;
      const ok =
        recipe.ingredientA === recipe.ingredientB
          ? stackQty(recipe.ingredientA) >= 2
          : stackQty(recipe.ingredientA) >= 1 && stackQty(recipe.ingredientB) >= 1;
      if (!ok) return null;
      return { recipe, res, ingA, ingB, isTool: isBasicToolOrWeapon(recipe, res) };
    };

    const scanAdjacent = (list: InventoryStack[], preferToolsOnly: boolean) => {
      for (let i = 0; i < list.length - 1; i++) {
        const a = list[i];
        const b = list[i + 1];
        if (!a || !b || a.qty <= 0 || b.qty <= 0) continue;
        const m = tryMatchPair(a.itemId, b.itemId);
        if (m && (!preferToolsOnly || m.isTool)) return { ...m, adjacent: true };
      }
      return null;
    };

    // 1. Prefer adjacent pairs in visible bag that craft basic tools / weapons (e.g. wood + stone)
    const adjVisibleTool = scanAdjacent(filteredStacks, true);
    if (adjVisibleTool) return adjVisibleTool;
    const adjAllTool = scanAdjacent(stacks, true);
    if (adjAllTool) return adjAllTool;

    // 2. Adjacent pairs in visible or full bag that match any recipe
    const adjVisibleAny = scanAdjacent(filteredStacks, false);
    if (adjVisibleAny) return adjVisibleAny;
    const adjAllAny = scanAdjacent(stacks, false);
    if (adjAllAny) return adjAllAny;

    // 3. Same-stack qty >= 2 matching a basic tool recipe (e.g. 2x Wood Log -> Pine Torch)
    for (const st of [...filteredStacks, ...stacks]) {
      if (st.qty < 2) continue;
      const m = tryMatchPair(st.itemId, st.itemId);
      if (m && m.isTool) return { ...m, adjacent: true };
    }

    // 4. Any ready basic tool/weapon recipe in bag, then any ready recipe
    for (const r of recipes) {
      const m = tryMatchPair(r.ingredientA, r.ingredientB);
      if (m && m.isTool) return { ...m, adjacent: false };
    }
    for (const r of recipes) {
      const m = tryMatchPair(r.ingredientA, r.ingredientB);
      if (m) return { ...m, adjacent: false };
    }

    return null;
  }, [filteredStacks, stacks, recipes, itemById]);

  const handleQuickCraft = () => {
    if (!quickCraftCandidate) return;
    handleCraft(quickCraftCandidate.recipe);
  };

  const isWorn = (def: InventoryItemDef) => {
    if (!def.wearSlot) return false;
    if (def.wearSlot === 'head') return equipment.headItemId === def.id;
    if (def.wearSlot === 'body') return equipment.bodyItemId === def.id;
    if (def.wearSlot === 'offhand') return equipment.offhandItemId === def.id;
    return equipment.accessoryItemId === def.id;
  };

  const heldDef = equipment.heldItemId ? itemById.get(equipment.heldItemId) : null;
  const offhandDef = equipment.offhandItemId ? itemById.get(equipment.offhandItemId) : null;
  const headDef = equipment.headItemId ? itemById.get(equipment.headItemId) : null;
  const bodyDef = equipment.bodyItemId ? itemById.get(equipment.bodyItemId) : null;
  const accDef = equipment.accessoryItemId ? itemById.get(equipment.accessoryItemId) : null;
  const twoHandedStowsShield =
    Boolean(offhandDef) &&
    (heldDef?.handedness === 'twoHand' ||
      heldDef?.toolKind === 'axe' ||
      heldDef?.toolKind === 'fishingPole');

  const resolvedTitle = cfg.panelTitle.replace('{heroName}', heroName);
  const toggleKeyLabel = formatKeyCodeLabel(cfg.toggleKey);
  const contextualStats = selectedDef
    ? buildContextualStats(selectedDef, activeCategory)
    : [];

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl bg-[#111520] text-[#F3F5FA] border border-white/12 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header + Hero Live Stats */}
        <header className="px-5 py-3.5 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 bg-[#161B29]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#20B46A]/18 border border-[#20B46A]/35 flex items-center justify-center text-[#20B46A]">
              <Backpack size={19} />
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight">{resolvedTitle}</h2>
              <p className="text-xs text-[#94A3B8]">{cfg.panelSubtitle}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
            {/* Mode Switcher: Bag & Inspector vs Crafting Bench */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0D1018] border border-white/10">
              <button
                type="button"
                onClick={() => setModalMode('bag')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                  modalMode === 'bag'
                    ? 'bg-[#7C5CFF] text-white'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                <Backpack size={12} />
                <span>Bag &amp; Gear</span>
              </button>
              <button
                type="button"
                onClick={() => setModalMode('bench')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                  modalMode === 'bench'
                    ? 'bg-[#F59E0B] text-slate-950'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                <Anvil size={12} />
                <span>Crafting Bench</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 text-[#F2545B]">
              <Heart size={13} />
              <span className="tabular-nums">
                {health}/{maxHealth}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[#F59E0B]">
              <Zap size={13} />
              <span className="tabular-nums">{Math.round(stamina)}%</span>
            </div>
            <div className="flex items-center gap-1.5 text-[#A855F7]">
              <Sparkles size={13} />
              <span className="tabular-nums">{Math.round(magic)} MP</span>
            </div>
            <div className="flex items-center gap-1.5 text-[#38BDF8]">
              <Swords size={13} />
              <span className="tabular-nums">ATK {attackPower}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[#94A3B8]">
              <Shield size={13} />
              <span className="tabular-nums">DEF {defensePower}</span>
            </div>
            <div className="text-[#20B46A] tabular-nums">SPD {speedPct}%</div>
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 h-8 rounded-lg bg-white/8 hover:bg-white/14 flex items-center gap-1.5 text-[#D0D6E5] text-[11px] font-bold whitespace-nowrap shrink-0"
              title={`Close (${toggleKeyLabel} / Esc)`}
            >
              <span>{toggleKeyLabel}</span>
              <X size={14} />
            </button>
          </div>
        </header>

        {/* Equipped Loadout Strip */}
        <div className="px-5 py-2.5 border-b border-white/8 bg-[#141926] grid grid-cols-2 sm:grid-cols-5 gap-2">
          {(
            [
              { label: 'Main Hand', def: heldDef, onClear: () => onHoldItem(null) },
              { label: 'Off-Hand', def: offhandDef, onClear: () => onUnequipSlot('offhand') },
              { label: 'Head', def: headDef, onClear: () => onUnequipSlot('head') },
              { label: 'Body', def: bodyDef, onClear: () => onUnequipSlot('body') },
              { label: 'Accessory', def: accDef, onClear: () => onUnequipSlot('accessory') },
            ] as const
          ).map(({ label, def, onClear }) => (
              <div
                key={label}
                onClick={() => {
                  if (def) {
                    handleSelectItemId(def.id);
                    setModalMode('bag');
                  }
                }}
                onMouseEnter={(e) => {
                  if (!def) return;
                  setHoverTooltip({
                    item: def,
                    stack: stacks.find((s) => s.itemId === def.id) ?? null,
                    x: e.clientX,
                    y: e.clientY,
                    statusTag:
                      label === 'Off-Hand' && twoHandedStowsShield ? 'Stowed (2H)' : label,
                    hint:
                      label === 'Off-Hand'
                        ? twoHandedStowsShield
                          ? 'Equip a 1-handed weapon to raise your shield with Use'
                          : 'Hold Use (E/Alt) in battle to block'
                        : 'Equipped · Click to inspect or Off to unequip',
                  });
                }}
                onMouseMove={(e) => {
                  if (!def) return;
                  setHoverTooltip({
                    item: def,
                    stack: stacks.find((s) => s.itemId === def.id) ?? null,
                    x: e.clientX,
                    y: e.clientY,
                    statusTag:
                      label === 'Off-Hand' && twoHandedStowsShield ? 'Stowed (2H)' : label,
                    hint:
                      label === 'Off-Hand'
                        ? twoHandedStowsShield
                          ? 'Equip a 1-handed weapon to raise your shield with Use'
                          : 'Hold Use (E/Alt) in battle to block'
                        : 'Equipped · Click to inspect or Off to unequip',
                  });
                }}
                onMouseLeave={() => setHoverTooltip(null)}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-[#0E131D] border border-white/8 cursor-pointer hover:border-white/18 transition-colors"
              >
                {def ? (
                  (() => {
                    const eqStack = stacks.find((s) => s.itemId === def.id) ?? null;
                    const eqMeta = resolveItemMetadata(def, eqStack);
                    const eqDurPct =
                      eqMeta.maxDurability > 1
                        ? Math.max(
                            0,
                            Math.min(100, Math.round((eqMeta.durability / eqMeta.maxDurability) * 100))
                          )
                        : null;
                    return (
                      <div className="shrink-0 flex flex-col items-center gap-1">
                        <ItemThumbnailArt
                          meshKind={def.meshKind}
                          colorHex={def.colorHex}
                          size={34}
                        />
                        {eqDurPct !== null && (
                          <div className="w-[34px] h-1 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full transition-all"
                              style={{
                                width: `${eqDurPct}%`,
                                backgroundColor:
                                  eqDurPct <= 25
                                    ? '#F2545B'
                                    : eqDurPct <= 60
                                    ? '#F59E0B'
                                    : '#20B46A',
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <div className="w-[34px] h-[34px] rounded-lg shrink-0 flex items-center justify-center border border-white/8 bg-white/[0.02] text-[10px] text-[#64748B]">
                    —
                  </div>
                )}
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1">
                  <span>{label}</span>
                  {label === 'Off-Hand' && twoHandedStowsShield && (
                    <span className="text-[9px] text-[#F59E0B]">· Stowed</span>
                  )}
                </div>
                <div className="text-xs font-bold truncate text-[#E7ECF5]">
                  {def ? def.name : 'Empty'}
                </div>
              </div>
              {def && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClear();
                  }}
                  className="text-[10px] font-bold text-[#94A3B8] hover:text-white px-1.5 py-0.5 rounded bg-white/6 shrink-0"
                  title={`Unequip ${def.name}`}
                >
                  Off
                </button>
              )}
            </div>
          ))}
        </div>

        {modalMode === 'bench' ? (
          <CraftingBenchPanel
            catalog={catalog}
            recipes={recipes}
            stacks={stacks}
            nearWorldBench={nearWorldBench}
            onCraftRecipe={handleCraft}
            onMixItems={onMixItems}
            onRepairItem={onRepairItem}
            onSelectItem={handleSelectItemId}
            onHoverTooltip={setHoverTooltip}
          />
        ) : (
        /* Main Split Body */
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-y-auto lg:overflow-hidden">
          {/* Left: Dynamic Category Tabs + Type Filter + Property Sort + Thumbnail Grid */}
          <section className="lg:col-span-6 p-4 sm:p-5 lg:overflow-y-auto maker-scroll border-b lg:border-b-0 lg:border-r border-white/8 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#0D1018] border border-white/8">
                {categories.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setFilterId(tab.id);
                      setTypeFilter('all');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                      activeCategory?.id === tab.id && typeFilter === 'all'
                        ? 'bg-[#7C5CFF] text-white'
                        : 'text-[#949BB0] hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <span className="text-xs font-semibold text-[#64748B] tabular-nums">
                {filteredStacks.length} item{filteredStacks.length === 1 ? '' : 's'}
              </span>
            </div>

            {/* Category Type Filter + Property Sort Controls */}
            <div className="p-2.5 rounded-xl bg-[#0D1018] border border-white/8 space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#64748B] mr-0.5">
                  Filter:
                </span>
                {(
                  [
                    { id: 'all', label: 'All Types' },
                    { id: 'weapon', label: 'Weapon' },
                    { id: 'tool', label: 'Tool' },
                    { id: 'wearable', label: 'Wearable' },
                    { id: 'consumable', label: 'Consumable' },
                    { id: 'resource', label: 'Resource' },
                  ] as { id: TypeFilterId; label: string }[]
                ).map((tf) => {
                  const count = typeCounts[tf.id];
                  const active = typeFilter === tf.id;
                  return (
                    <button
                      key={tf.id}
                      type="button"
                      onClick={() => handleTypeFilterClick(tf.id)}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1 ${
                        active
                          ? 'bg-[#38BDF8]/22 text-[#38BDF8] border border-[#38BDF8]/45'
                          : 'bg-[#141926] text-[#94A3B8] border border-white/6 hover:text-white hover:border-white/16'
                      }`}
                    >
                      <span>{tf.label}</span>
                      <span className="text-[10px] opacity-70 tabular-nums">{count}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-white/6">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#64748B] mr-0.5 inline-flex items-center gap-1">
                  <ArrowDownUp size={10} />
                  <span>Sort:</span>
                </span>
                {(
                  [
                    { id: 'default', label: 'Bag Order' },
                    { id: 'power', label: 'Power' },
                    { id: 'rarity', label: 'Rarity' },
                    { id: 'durability', label: 'Durability' },
                    { id: 'category', label: 'Category' },
                    { id: 'qty', label: 'Qty' },
                    { id: 'name', label: 'Name' },
                  ] as { id: SortById; label: string }[]
                ).map((s) => {
                  const active = sortBy === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSortClick(s.id)}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1 ${
                        active
                          ? 'bg-[#7C5CFF] text-white'
                          : 'bg-[#141926] text-[#94A3B8] border border-white/6 hover:text-white hover:border-white/16'
                      }`}
                    >
                      <span>{s.label}</span>
                      {active && s.id !== 'default' && (
                        sortDir === 'desc' ? <ArrowDown size={10} /> : <ArrowUp size={10} />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Quick Craft Shortcut Strip */}
              <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-white/6">
                <div className="min-w-0 flex items-center gap-2 text-[11px]">
                  {quickCraftCandidate ? (
                    <>
                      <ItemThumbnailArt
                        meshKind={quickCraftCandidate.res.meshKind}
                        colorHex={quickCraftCandidate.res.colorHex}
                        size={20}
                        className="shrink-0"
                      />
                      <span className="truncate text-[#CBD5E1] font-semibold">
                        <span className="text-[#4ADE80] font-bold">
                          {quickCraftCandidate.res.name}
                        </span>
                        <span className="text-[#64748B] ml-1.5">
                          ({quickCraftCandidate.ingA.name} + {quickCraftCandidate.ingB.name})
                        </span>
                      </span>
                    </>
                  ) : (
                    <span className="text-[#64748B] truncate">
                      Collect Wood + Stone or Berries + Herbs to Quick Craft
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  disabled={!quickCraftCandidate}
                  onClick={handleQuickCraft}
                  onMouseEnter={(e) => {
                    if (!quickCraftCandidate) return;
                    setHoverTooltip({
                      item: quickCraftCandidate.res,
                      stack: stacks.find((s) => s.itemId === quickCraftCandidate.res.id) ?? null,
                      x: e.clientX,
                      y: e.clientY,
                      statusTag: quickCraftCandidate.adjacent ? 'Adjacent Match' : 'Bag Match',
                      hint: `Quick Craft: ${quickCraftCandidate.ingA.name} + ${quickCraftCandidate.ingB.name}`,
                    });
                  }}
                  onMouseMove={(e) => {
                    if (!quickCraftCandidate) return;
                    setHoverTooltip({
                      item: quickCraftCandidate.res,
                      stack: stacks.find((s) => s.itemId === quickCraftCandidate.res.id) ?? null,
                      x: e.clientX,
                      y: e.clientY,
                      statusTag: quickCraftCandidate.adjacent ? 'Adjacent Match' : 'Bag Match',
                      hint: `Quick Craft: ${quickCraftCandidate.ingA.name} + ${quickCraftCandidate.ingB.name}`,
                    });
                  }}
                  onMouseLeave={() => setHoverTooltip(null)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                    quickCraftCandidate
                      ? 'bg-[#20B46A] hover:bg-[#199958] text-white'
                      : 'bg-white/6 text-[#64748B] cursor-not-allowed'
                  }`}
                >
                  <Hammer size={12} />
                  <span>Quick Craft</span>
                </button>
              </div>
            </div>

            {filteredStacks.length === 0 ? (
              <div className="py-12 text-center rounded-xl border border-dashed border-white/10 text-xs text-[#949BB0] px-4 space-y-2">
                <div>
                  No items match this filter yet. Harvest mushrooms, herbs, berries, chop forest trees, or open chests in the world!
                </div>
                {(typeFilter !== 'all' || activeCategory?.id !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterId(categories[0]?.id ?? 'all');
                      setTypeFilter('all');
                    }}
                    className="px-3 py-1 rounded-lg bg-white/8 hover:bg-white/14 text-[#E2E8F0] font-bold"
                  >
                    Show All Items
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {filteredStacks.map((st) => {
                  const def = itemById.get(st.itemId);
                  if (!def) return null;
                  const meta = resolveItemMetadata(def, st);
                  const active = selectedId === st.itemId;
                  const held = equipment.heldItemId === st.itemId;
                  const offhandWorn = equipment.offhandItemId === st.itemId;
                  const worn = isWorn(def);
                  const statusTag = held
                    ? 'Main Hand'
                    : offhandWorn
                    ? 'Off-Hand'
                    : worn
                    ? 'Worn'
                    : undefined;
                  const rarityColor = RARITY_COLORS[meta.rarity] ?? '#94A3B8';
                  const durPct =
                    meta.maxDurability > 1
                      ? Math.round((meta.durability / meta.maxDurability) * 100)
                      : null;

                  return (
                    <button
                      key={st.itemId}
                      type="button"
                      onClick={() => handleSelectItemId(st.itemId)}
                      className={`p-2.5 rounded-xl border text-left transition-colors relative group ${
                        active
                          ? 'bg-[#1B2233] border-[#7C5CFF]'
                          : 'bg-[#151B29] border-white/8 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div
                          onMouseEnter={(e) =>
                            setHoverTooltip({
                              item: def,
                              stack: st,
                              x: e.clientX,
                              y: e.clientY,
                              statusTag,
                              hint: 'Click to inspect · Hover icon for stats & magic effect',
                            })
                          }
                          onMouseMove={(e) =>
                            setHoverTooltip({
                              item: def,
                              stack: st,
                              x: e.clientX,
                              y: e.clientY,
                              statusTag,
                              hint: 'Click to inspect · Hover icon for stats & magic effect',
                            })
                          }
                          onMouseLeave={() => setHoverTooltip(null)}
                          className="rounded-lg p-0.5 -m-0.5 hover:bg-white/6 transition-colors"
                        >
                          <ItemThumbnailArt
                            meshKind={def.meshKind}
                            colorHex={def.colorHex}
                            size={44}
                          />
                          {durPct !== null && (
                            <div
                              className="mt-1 h-1 w-[44px] rounded-full bg-black/60 border border-white/10 overflow-hidden"
                              title={`Durability: ${meta.durability}/${meta.maxDurability} (${durPct}%)`}
                            >
                              <div
                                className="h-full transition-all"
                                style={{
                                  width: `${durPct}%`,
                                  backgroundColor:
                                    durPct <= 25
                                      ? '#F2545B'
                                      : durPct <= 60
                                      ? '#F59E0B'
                                      : '#20B46A',
                                }}
                              />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-xs font-extrabold tabular-nums text-[#D4DBE8]">
                            ×{st.qty}
                          </span>
                          <span className="text-[10px] font-bold tabular-nums text-[#38BDF8]">
                            PWR {meta.power}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: rarityColor }}
                        />
                        <div className="text-xs font-bold truncate text-white">{def.name}</div>
                      </div>
                      <div className="text-[10px] font-semibold capitalize text-[#8B93A8] mt-0.5 truncate">
                        {def.category}
                        {held ? ' · Held' : equipment.offhandItemId === st.itemId ? ' · Off-Hand' : worn ? ' · Worn' : ''}
                        {durPct !== null && durPct < 100 ? ` · ${durPct}%` : ''}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Right: Dynamic Metadata Inspector Spotlight + Quick Workbench */}
          <section className="lg:col-span-6 p-4 sm:p-5 lg:overflow-y-auto maker-scroll space-y-4 bg-[#131723]">
            {/* Selected Item Workbench Inspector */}
            {selectedDef && selectedQty > 0 && selectedMetadata ? (
              <div className="p-4 rounded-xl bg-[#191F2F] border border-white/10 space-y-3.5">
                <div className="flex items-start gap-4">
                  <div
                    className="w-24 h-24 rounded-2xl shrink-0 flex flex-col items-center justify-center border border-white/12 bg-[#0E131E] relative overflow-hidden"
                    style={{
                      boxShadow: `inset 0 0 28px ${selectedDef.colorHex}26`,
                    }}
                  >
                    <ItemThumbnailArt
                      meshKind={selectedDef.meshKind}
                      colorHex={selectedDef.colorHex}
                      size={74}
                    />
                    {selectedMetadata.maxDurability > 1 && (
                      <div className="absolute bottom-1.5 left-2 right-2 h-1.5 rounded-full bg-black/65 border border-white/10 overflow-hidden">
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${Math.max(
                              0,
                              Math.min(
                                100,
                                Math.round(
                                  (selectedMetadata.durability / selectedMetadata.maxDurability) * 100
                                )
                              )
                            )}%`,
                            backgroundColor:
                              selectedMetadata.durability / selectedMetadata.maxDurability <= 0.25
                                ? '#F2545B'
                                : selectedMetadata.durability / selectedMetadata.maxDurability <= 0.6
                                ? '#F59E0B'
                                : '#20B46A',
                          }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="text-base font-extrabold text-white truncate">
                      {selectedDef.name}
                    </div>
                    <div className="text-[11px] font-semibold text-[#94A3B8] capitalize">
                      <span style={{ color: RARITY_COLORS[selectedMetadata.rarity] ?? '#94A3B8' }}>
                        {selectedMetadata.rarity}
                      </span>
                      {' · '}
                      {selectedDef.category}
                      {' · '}
                      Qty {selectedQty}
                      {' · '}
                      {selectedMetadata.weight.toFixed(1)}kg
                      {equipment.heldItemId === selectedDef.id ? ' · Main Hand' : ''}
                      {equipment.offhandItemId === selectedDef.id ? ' · Off-Hand' : ''}
                      {isWorn(selectedDef) && equipment.offhandItemId !== selectedDef.id ? ' · Worn' : ''}
                    </div>
                    <p className="text-xs text-[#CBD5E1] leading-relaxed pt-1">
                      {selectedDef.description}
                    </p>
                  </div>
                </div>

                {/* Live Rich Metadata Core Bar: Power & Durability */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="px-3 py-2 rounded-lg bg-[#0F1420] border border-white/8 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                      Power
                    </span>
                    <span className="text-sm font-extrabold text-[#38BDF8] tabular-nums">
                      {selectedMetadata.power}
                    </span>
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-[#0F1420] border border-white/8 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                      <span className="text-[#64748B]">Durability</span>
                      <span className="text-[#FACC15] tabular-nums">
                        {selectedMetadata.maxDurability > 1
                          ? `${selectedMetadata.durability}/${selectedMetadata.maxDurability}`
                          : 'Consumable'}
                      </span>
                    </div>
                    {selectedMetadata.maxDurability > 1 && (
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${Math.round(
                              (selectedMetadata.durability / selectedMetadata.maxDurability) * 100
                            )}%`,
                            backgroundColor:
                              selectedMetadata.durability / selectedMetadata.maxDurability <= 0.25
                                ? '#F2545B'
                                : selectedMetadata.durability / selectedMetadata.maxDurability <= 0.6
                                ? '#F59E0B'
                                : '#20B46A',
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Contextual Stats Grid (Adapts per Item Type & Game Category Settings) */}
                {contextualStats.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {contextualStats.map((st, idx) => (
                      <div
                        key={`${st.label}_${idx}`}
                        className="px-2.5 py-2 rounded-lg bg-[#0F1420] border border-white/8"
                      >
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] truncate">
                          {st.label}
                        </div>
                        <div
                          className="text-xs font-extrabold tabular-nums truncate mt-0.5"
                          style={{ color: st.accent ?? '#F8FAFC' }}
                        >
                          {st.value}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Dynamic Metadata Properties & Magic Effect Readout */}
                <div className="p-2.5 rounded-lg bg-[#0F1420] border border-white/8 space-y-1.5 text-[11px]">
                  <div className="flex items-start gap-1.5 text-[#C084FC]">
                    <Sparkles size={13} className="shrink-0 mt-0.5" />
                    <span>{selectedMetadata.magic_effect}</span>
                  </div>
                  {Object.keys(selectedMetadata.properties).length > 0 && (
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#94A3B8] pt-1 border-t border-white/6">
                      {Object.entries(selectedMetadata.properties).map(([k, v]) => (
                        <span key={k}>
                          <span className="text-[#64748B] capitalize">{k}:</span>{' '}
                          <span className="text-[#E2E8F0] font-semibold">{String(v)}</span>
                        </span>
                      ))}
                    </div>
                  )}
                  {selectedDef.lore && (
                    <div className="text-[#94A3B8] italic pt-0.5">{selectedDef.lore}</div>
                  )}
                </div>

                {/* Primary Actions: Hold / Equip Off-Hand / Wear / Consume / Add to Workbench */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-0.5">
                  {selectedDef.wearSlot !== 'offhand' && (
                    <button
                      type="button"
                      onClick={() =>
                        onHoldItem(equipment.heldItemId === selectedDef.id ? null : selectedDef.id)
                      }
                      className={`py-2 px-3 rounded-xl text-xs font-extrabold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                        equipment.heldItemId === selectedDef.id
                          ? 'bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/40'
                          : 'bg-[#7C5CFF] hover:bg-[#6A48F5] text-white'
                      }`}
                    >
                      <Hand size={13} />
                      <span>{equipment.heldItemId === selectedDef.id ? 'Put Away' : 'Hold'}</span>
                    </button>
                  )}

                  {selectedDef.category === 'wearable' && selectedDef.wearSlot && (
                    <button
                      type="button"
                      onClick={() =>
                        isWorn(selectedDef)
                          ? onUnequipSlot(selectedDef.wearSlot!)
                          : onWearItem(selectedDef)
                      }
                      className={`py-2 px-3 rounded-xl text-xs font-extrabold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                        isWorn(selectedDef)
                          ? 'bg-white/10 text-white'
                          : 'bg-[#20B46A] hover:bg-[#199958] text-white'
                      }`}
                    >
                      {selectedDef.wearSlot === 'offhand' ? <Shield size={13} /> : <Shirt size={13} />}
                      <span>
                        {selectedDef.wearSlot === 'offhand'
                          ? isWorn(selectedDef)
                            ? 'Remove Shield'
                            : 'Equip Off-Hand'
                          : isWorn(selectedDef)
                          ? 'Take Off'
                          : 'Wear'}
                      </span>
                    </button>
                  )}

                  {selectedDef.category === 'consumable' && (
                    <button
                      type="button"
                      onClick={() => onConsumeItem(selectedDef)}
                      className="py-2 px-3 rounded-xl bg-[#F59E0B] hover:bg-[#D97706] text-slate-950 text-xs font-extrabold inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                    >
                      <Utensils size={13} />
                      <span>Use / Consume</span>
                    </button>
                  )}

                  {cfg.allowMixWorkbench && (
                    <button
                      type="button"
                      onClick={() => handleAddToMix(selectedDef.id)}
                      className="py-2 px-3 rounded-xl bg-[#0F1420] hover:bg-[#232A3E] border border-white/12 text-xs font-extrabold inline-flex items-center justify-center gap-1.5 text-[#E5EAF5] whitespace-nowrap"
                    >
                      <FlaskConical size={13} className="text-[#A855F7]" />
                      <span>Workbench</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-[#191F2F] border border-white/8 text-xs text-[#949BB0]">
                Select any item on the left to inspect its thumbnail, contextual stats, magic effects, or equip it.
              </div>
            )}

            {/* Mixing / Crafting Workbench */}
            {cfg.allowMixWorkbench && (
              <div className="p-4 rounded-xl bg-[#191F2F] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold">
                    <FlaskConical size={14} className="text-[#A855F7]" />
                    <span>{cfg.mixTitle}</span>
                  </div>
                  {(validSlotA || validSlotB) && (
                    <button
                      type="button"
                      onClick={() => {
                        setMixSlotA(null);
                        setMixSlotB(null);
                      }}
                      className="text-[11px] font-bold text-[#949BB0] hover:text-white"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-5 items-center gap-2">
                  {[
                    { id: validSlotA, clear: () => setMixSlotA(null), placeholder: 'Ingredient A' },
                    { id: validSlotB, clear: () => setMixSlotB(null), placeholder: 'Ingredient B' },
                  ].map((slot, idx) => {
                    const def = slot.id ? itemById.get(slot.id) : null;
                    return (
                      <React.Fragment key={idx}>
                        <button
                          type="button"
                          onClick={slot.clear}
                          onMouseEnter={(e) => {
                            if (!def) return;
                            setHoverTooltip({
                              item: def,
                              stack: stacks.find((s) => s.itemId === def.id) ?? null,
                              x: e.clientX,
                              y: e.clientY,
                              statusTag: idx === 0 ? 'Mix Slot A' : 'Mix Slot B',
                              hint: 'Click slot to remove ingredient',
                            });
                          }}
                          onMouseMove={(e) => {
                            if (!def) return;
                            setHoverTooltip({
                              item: def,
                              stack: stacks.find((s) => s.itemId === def.id) ?? null,
                              x: e.clientX,
                              y: e.clientY,
                              statusTag: idx === 0 ? 'Mix Slot A' : 'Mix Slot B',
                              hint: 'Click slot to remove ingredient',
                            });
                          }}
                          onMouseLeave={() => setHoverTooltip(null)}
                          className="col-span-2 p-2 rounded-xl bg-[#0F1420] border border-white/10 text-left flex items-center gap-2 min-h-[52px]"
                          title={def ? 'Click to remove from slot' : 'Select an item and click Workbench'}
                        >
                          {def ? (
                            <>
                              <ItemThumbnailArt
                                meshKind={def.meshKind}
                                colorHex={def.colorHex}
                                size={32}
                                className="shrink-0"
                              />
                              <span className="text-[11px] font-bold truncate">{def.name}</span>
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

                {validSlotA && validSlotB && (
                  <div className="p-2.5 rounded-xl bg-[#0F1420] border border-white/10 flex items-center justify-between gap-2">
                    {matchedResultDef ? (
                      <div
                        className="flex items-center gap-2.5 min-w-0"
                        onMouseEnter={(e) =>
                          setHoverTooltip({
                            item: matchedResultDef,
                            stack: stacks.find((s) => s.itemId === matchedResultDef.id) ?? null,
                            x: e.clientX,
                            y: e.clientY,
                            statusTag: 'Craft Output',
                          })
                        }
                        onMouseMove={(e) =>
                          setHoverTooltip({
                            item: matchedResultDef,
                            stack: stacks.find((s) => s.itemId === matchedResultDef.id) ?? null,
                            x: e.clientX,
                            y: e.clientY,
                            statusTag: 'Craft Output',
                          })
                        }
                        onMouseLeave={() => setHoverTooltip(null)}
                      >
                        <ItemThumbnailArt
                          meshKind={matchedResultDef.meshKind}
                          colorHex={matchedResultDef.colorHex}
                          size={34}
                          className="shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold text-[#20B46A] truncate">
                            → {matchedResultDef.name}
                          </div>
                          <div className="text-[10px] text-[#94A3B8] truncate">
                            {matchedResultDef.magicEffect || matchedResultDef.description}
                          </div>
                        </div>
                      </div>
                    ) : canMixFallback ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <Sparkles size={15} className="text-[#F59E0B] shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold text-[#F59E0B] truncate">
                            → Woodland Healing Tonic
                          </div>
                          <div className="text-[10px] text-[#94A3B8]">
                            Improvised herbal &amp; alchemy brew
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-[11px] text-[#94A3B8]">
                        These items don&apos;t combine. Try herbs, mushrooms, berries, stones, or logs!
                      </span>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  disabled={!(matchedRecipe || canMixFallback)}
                  onClick={handleCommitMix}
                  className={`w-full py-2.5 rounded-xl text-xs font-extrabold transition-colors ${
                    matchedRecipe || canMixFallback
                      ? 'bg-[#A855F7] hover:bg-[#9333EA] text-white'
                      : 'bg-white/6 text-[#64748B] cursor-not-allowed'
                  }`}
                >
                  {cfg.mixButtonLabel}
                </button>

                {/* Quick Recipe Guide */}
                <div className="pt-2 border-t border-white/8 space-y-1.5">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#8B93A8]">
                    Known Recipes
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto maker-scroll">
                    {recipes.map((r) => {
                      const a = itemById.get(r.ingredientA);
                      const b = itemById.get(r.ingredientB);
                      const res = itemById.get(r.resultItemId);
                      if (!a || !b || !res) return null;
                      const haveEnough =
                        r.ingredientA === r.ingredientB
                          ? stackQty(r.ingredientA) >= 2
                          : stackQty(r.ingredientA) >= 1 && stackQty(r.ingredientB) >= 1;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => {
                            if (!haveEnough) return;
                            setMixSlotA(r.ingredientA);
                            setMixSlotB(r.ingredientB);
                          }}
                          className={`w-full px-2.5 py-1.5 rounded-lg text-left text-[11px] flex items-center justify-between gap-2 transition-colors ${
                            haveEnough
                              ? 'bg-[#20B46A]/14 border border-[#20B46A]/35 text-white hover:bg-[#20B46A]/22'
                              : 'bg-[#0F1420] text-[#7D859B]'
                          }`}
                        >
                          <span className="truncate">
                            {a.name} + {b.name}
                          </span>
                          <span className="shrink-0 font-extrabold text-[10px] text-[#D8E0F0]">
                            → {res.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
        )}
      </div>
      <ItemTooltip hover={hoverTooltip} activeTab={activeCategory} />
    </div>
  );
};
