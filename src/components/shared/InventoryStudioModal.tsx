import React, { useEffect, useMemo, useState } from 'react';
import {
  Backpack,
  FlaskConical,
  Keyboard,
  Layers,
  Plus,
  RotateCcw,
  Sparkles,
  Sprout,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import {
  createDefaultInventoryConfig,
  formatKeyCodeLabel,
  getProjectCraftingRecipes,
  getProjectInventoryItems,
  resolveGameInventoryConfig,
  resolveItemMetadata,
} from '../../data/registries';
import type { MakerStore } from '../../store/useMakerStore';
import type {
  CraftingRecipe,
  InventoryCategoryConfig,
  InventoryCustomStat,
  InventoryItemCategory,
  InventoryItemDef,
  InventoryStatProfile,
  ItemMetadata,
  ItemRarity,
  ObjectAttachBodyPart,
  PickupMeshKind,
  ToolActionKind,
  WearSlot,
  WorldCollectibleRule,
} from '../../types/maker';
import {
  OBJECT_BODY_PART_OPTIONS,
  resolveItemAttachBodyPart,
} from '../../three/heroEquipmentAttachments';
import { uid } from '../../utils/terrain';
import { ItemThumbnailArt } from './ItemThumbnailArt';

type StudioTab = 'panel' | 'items' | 'recipes' | 'world';

const MESH_OPTIONS: { kind: PickupMeshKind; label: string; defaultIcon: string }[] = [
  { kind: 'sword', label: 'Sword', defaultIcon: 'sword' },
  { kind: 'axe', label: 'Axe', defaultIcon: 'axe' },
  { kind: 'staff', label: 'Magic Staff', defaultIcon: 'sparkles' },
  { kind: 'fishingPole', label: 'Fishing Pole', defaultIcon: 'fish' },
  { kind: 'torch', label: 'Torch', defaultIcon: 'flame' },
  { kind: 'mushroom', label: 'Mushroom', defaultIcon: 'sprout' },
  { kind: 'berries', label: 'Berries', defaultIcon: 'cherry' },
  { kind: 'herbs', label: 'Herbs / Plant', defaultIcon: 'leaf' },
  { kind: 'flower', label: 'Flower', defaultIcon: 'sparkles' },
  { kind: 'potion', label: 'Potion / Stew', defaultIcon: 'flask' },
  { kind: 'scroll', label: 'Spell Scroll', defaultIcon: 'sparkles' },
  { kind: 'hat', label: 'Hat / Crown', defaultIcon: 'crown' },
  { kind: 'cloak', label: 'Cloak', defaultIcon: 'shirt' },
  { kind: 'armor', label: 'Armor', defaultIcon: 'shield' },
  { kind: 'shield', label: 'Shield (Off-Hand)', defaultIcon: 'shield' },
  { kind: 'amulet', label: 'Amulet', defaultIcon: 'shield' },
  { kind: 'woodLog', label: 'Wood Log', defaultIcon: 'trees' },
  { kind: 'fish', label: 'Fish', defaultIcon: 'fish' },
  { kind: 'stone', label: 'Stone', defaultIcon: 'gem' },
  { kind: 'moss', label: 'Glow Moss', defaultIcon: 'sprout' },
  { kind: 'bone', label: 'Bone Relic', defaultIcon: 'bone' },
  { kind: 'gem', label: 'Crystal Gem', defaultIcon: 'gem' },
  { kind: 'blanket', label: 'Parachute Blanket', defaultIcon: 'blanket' },
];

const QUICK_KEYS = [
  { code: 'Tab', label: 'Tab' },
  { code: 'KeyI', label: 'I' },
  { code: 'KeyB', label: 'B' },
  { code: 'KeyQ', label: 'Q' },
  { code: 'KeyC', label: 'C' },
];

export const InventoryStudioModal: React.FC<{
  store: MakerStore;
  initialTab?: StudioTab;
  onClose: () => void;
}> = ({ store, initialTab = 'panel', onClose }) => {
  const { currentProject } = store;
  const [tab, setTab] = useState<StudioTab>(initialTab);
  const [capturingKey, setCapturingKey] = useState(false);

  const catalog = useMemo(
    () => getProjectInventoryItems(currentProject),
    [currentProject]
  );
  const recipes = useMemo(
    () => getProjectCraftingRecipes(currentProject),
    [currentProject]
  );
  const config = useMemo(
    () => resolveGameInventoryConfig(currentProject),
    [currentProject]
  );

  const [selectedItemId, setSelectedItemId] = useState<string>(
    store.selectedInventoryItemId || catalog[0]?.id || ''
  );
  const [itemSearch, setItemSearch] = useState('');

  useEffect(() => {
    if (selectedItemId) {
      store.setSelectedInventoryItemId(selectedItemId);
    }
  }, [selectedItemId, store]);

  // Recipe builder state
  const [newRecipeTitle, setNewRecipeTitle] = useState('');
  const [newRecA, setNewRecA] = useState(catalog[0]?.id ?? 'wild_mushroom');
  const [newRecB, setNewRecB] = useState(catalog[1]?.id ?? 'forest_herbs');
  const [newRecResult, setNewRecResult] = useState(catalog[2]?.id ?? 'mushroom_stew');
  const [newRecQty, setNewRecQty] = useState(1);

  useEffect(() => {
    if (!capturingKey) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') {
        setCapturingKey(false);
        return;
      }
      store.updateInventoryConfig('set inventory toggle key', (cfg) => ({
        ...cfg,
        toggleKey: e.code,
      }));
      setCapturingKey(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [capturingKey, store]);

  if (!currentProject) return null;

  const selectedItem =
    catalog.find((i) => i.id === selectedItemId) ?? catalog[0] ?? null;
  const resolvedSelectedMeta = selectedItem ? resolveItemMetadata(selectedItem) : null;

  const filteredCatalog = catalog.filter((item) => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      item.name.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q)
    );
  });

  const handleCreateBlankItem = () => {
    const id = `item_${uid()}`;
    const created: InventoryItemDef = {
      id,
      name: 'New Relic',
      category: 'consumable',
      colorHex: '#A855F7',
      icon: 'sparkles',
      meshKind: 'potion',
      description: 'Custom adventure item created for your world.',
      lore: 'Discovered while exploring the wilderness.',
      magicEffect: 'Restores +2 HP and +25 Magic.',
      healAmount: 2,
      magicAmount: 25,
      staminaAmount: 20,
      metadata: {
        power: 15,
        durability: 1,
        maxDurability: 1,
        magic_effect: 'Restores +2 HP and +25 Magic.',
        rarity: 'uncommon',
        weight: 0.4,
      },
      customStats: [{ label: 'Origin', value: 'Wilderness' }],
    };
    store.addInventoryItem(created);
    setSelectedItemId(id);
    store.setSelectedInventoryItemId(id);
  };

  const handleDuplicateItem = (item: InventoryItemDef) => {
    const id = `item_${uid()}`;
    const copy: InventoryItemDef = {
      ...item,
      id,
      name: `${item.name} Copy`,
      metadata: item.metadata
        ? { ...item.metadata, properties: item.metadata.properties ? { ...item.metadata.properties } : undefined }
        : undefined,
      customStats: item.customStats ? item.customStats.map((s) => ({ ...s })) : undefined,
    };
    store.addInventoryItem(copy);
    setSelectedItemId(id);
    store.setSelectedInventoryItemId(id);
  };

  const patchSelectedItem = (patch: Partial<InventoryItemDef>) => {
    if (!selectedItem) return;
    store.updateInventoryItem({ ...selectedItem, ...patch });
  };

  const patchSelectedMeta = (patch: Partial<ItemMetadata>) => {
    if (!selectedItem) return;
    store.updateInventoryItemMetadata(selectedItem.id, patch);
  };

  const handleAddCategory = () => {
    const newCat: InventoryCategoryConfig = {
      id: `cat_${uid()}`,
      label: 'New Category',
      matchCategories: ['consumable', 'material'],
      statProfile: 'custom',
      statLabels: { primary: 'Power', secondary: 'Affinity', tertiary: 'Notes' },
    };
    store.updateInventoryConfig('add inventory category', (cfg) => ({
      ...cfg,
      categories: [...cfg.categories, newCat],
    }));
  };

  const updateCategory = (
    catId: string,
    updater: (c: InventoryCategoryConfig) => InventoryCategoryConfig
  ) => {
    store.updateInventoryConfig('update inventory category', (cfg) => ({
      ...cfg,
      categories: cfg.categories.map((c) => (c.id === catId ? updater(c) : c)),
    }));
  };

  const deleteCategory = (catId: string) => {
    store.updateInventoryConfig('delete inventory category', (cfg) => ({
      ...cfg,
      categories: cfg.categories.filter((c) => c.id !== catId),
    }));
  };

  const updateWorldRule = (
    scatterKind: WorldCollectibleRule['scatterKind'],
    patch: Partial<WorldCollectibleRule>
  ) => {
    store.updateInventoryConfig('update world collectible rule', (cfg) => ({
      ...cfg,
      worldCollectibles: cfg.worldCollectibles.map((r) =>
        r.scatterKind === scatterKind ? { ...r, ...patch } : r
      ),
    }));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl bg-[#111520] text-[#F1F5F9] border border-white/12 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bar */}
        <header className="px-5 py-3.5 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 bg-[#161B29]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#20B46A]/18 border border-[#20B46A]/35 flex items-center justify-center text-[#20B46A]">
              <Backpack size={18} />
            </div>
            <div>
              <h2 className="text-sm font-extrabold tracking-tight">
                Inventory &amp; Item Maker
              </h2>
              <p className="text-[11px] text-[#94A3B8]">
                Tailor categories, item readouts, keybinds, recipes, and world harvestables for {currentProject.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                store.updateInventoryConfig('reset inventory settings', () =>
                  createDefaultInventoryConfig()
                )
              }
              className="px-2.5 py-1.5 rounded-lg bg-white/6 hover:bg-white/12 text-[11px] font-bold text-[#CBD5E1] inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <RotateCcw size={12} />
              <span>Reset Defaults</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/8 hover:bg-white/15 flex items-center justify-center text-[#CBD5E1]"
              aria-label="Close Inventory &amp; Item Maker"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {/* Sub-nav Tabs */}
        <div className="px-5 py-2.5 border-b border-white/8 bg-[#131824] flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'panel', label: 'Panel & Categories', icon: Layers },
              { id: 'items', label: `Items & Stats (${catalog.length})`, icon: Sparkles },
              { id: 'recipes', label: `Mixing Recipes (${recipes.length})`, icon: FlaskConical },
              { id: 'world', label: 'World Collectibles', icon: Sprout },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#7C5CFF] text-white'
                    : 'text-[#94A3B8] hover:text-white hover:bg-white/6'
                }`}
              >
                <Icon size={13} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Main Content */}
        <div className="flex-1 min-h-0 overflow-y-auto maker-scroll p-5">
          {tab === 'panel' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-5 space-y-4">
                <div className="p-4 rounded-xl bg-[#161C2B] border border-white/8 space-y-3">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-[#94A3B8]">
                    Popup Window &amp; Keybind
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-[#CBD5E1]">
                      Panel Title (use {'{heroName}'} for character name)
                    </label>
                    <input
                      type="text"
                      value={config.panelTitle}
                      onChange={(e) =>
                        store.updateInventoryConfig('rename inventory panel', (cfg) => ({
                          ...cfg,
                          panelTitle: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 rounded-lg bg-[#0E131E] border border-white/10 text-xs font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-[#CBD5E1]">
                      Subtitle / Prompt
                    </label>
                    <input
                      type="text"
                      value={config.panelSubtitle}
                      onChange={(e) =>
                        store.updateInventoryConfig('edit inventory subtitle', (cfg) => ({
                          ...cfg,
                          panelSubtitle: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 rounded-lg bg-[#0E131E] border border-white/10 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-[#CBD5E1] flex items-center gap-1.5">
                      <Keyboard size={13} className="text-[#7C5CFF]" />
                      <span>Open / Close Hotkey</span>
                    </label>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCapturingKey(true)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-extrabold border transition-colors ${
                          capturingKey
                            ? 'bg-[#7C5CFF] border-[#7C5CFF] text-white animate-pulse'
                            : 'bg-[#0E131E] border-white/15 text-white hover:border-[#7C5CFF]'
                        }`}
                      >
                        {capturingKey
                          ? 'Press any key…'
                          : `Key: ${formatKeyCodeLabel(config.toggleKey)}`}
                      </button>
                      {QUICK_KEYS.map((qk) => (
                        <button
                          key={qk.code}
                          type="button"
                          onClick={() =>
                            store.updateInventoryConfig('assign hotkey', (cfg) => ({
                              ...cfg,
                              toggleKey: qk.code,
                            }))
                          }
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border ${
                            config.toggleKey === qk.code
                              ? 'bg-[#20B46A]/20 border-[#20B46A] text-[#4ADE80]'
                              : 'bg-[#0E131E] border-white/10 text-[#94A3B8] hover:text-white'
                          }`}
                        >
                          {qk.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/8 space-y-2.5">
                    <label className="flex items-center justify-between text-xs font-bold cursor-pointer">
                      <span>Enable Mixing / Crafting Workbench</span>
                      <input
                        type="checkbox"
                        checked={config.allowMixWorkbench}
                        onChange={(e) =>
                          store.updateInventoryConfig('toggle mix workbench', (cfg) => ({
                            ...cfg,
                            allowMixWorkbench: e.target.checked,
                          }))
                        }
                        className="accent-[#7C5CFF] w-4 h-4"
                      />
                    </label>
                    {config.allowMixWorkbench && (
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={config.mixTitle}
                          onChange={(e) =>
                            store.updateInventoryConfig('rename workbench', (cfg) => ({
                              ...cfg,
                              mixTitle: e.target.value,
                            }))
                          }
                          placeholder="Workbench title"
                          className="px-2.5 py-1.5 rounded-lg bg-[#0E131E] border border-white/10 text-xs font-semibold"
                        />
                        <input
                          type="text"
                          value={config.mixButtonLabel}
                          onChange={(e) =>
                            store.updateInventoryConfig('rename mix button', (cfg) => ({
                              ...cfg,
                              mixButtonLabel: e.target.value,
                            }))
                          }
                          placeholder="Mix button label"
                          className="px-2.5 py-1.5 rounded-lg bg-[#0E131E] border border-white/10 text-xs font-semibold"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Custom Data Categories */}
              <div className="lg:col-span-7 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#94A3B8]">
                      Custom Inventory Categories &amp; Contextual Stat Labels
                    </h3>
                    <p className="text-[11px] text-[#64748B]">
                      Adapt tabs &amp; readout labels to match your genre (e.g. Weapons, Apparel, Herbs &amp; Alchemy, Relics)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    className="px-3 py-1.5 rounded-lg bg-[#7C5CFF] hover:bg-[#6A48F5] text-white text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                  >
                    <Plus size={13} />
                    <span>Add Category</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {config.categories.map((cat) => (
                    <div
                      key={cat.id}
                      className="p-3.5 rounded-xl bg-[#161C2B] border border-white/8 space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={cat.label}
                          onChange={(e) =>
                            updateCategory(cat.id, (c) => ({ ...c, label: e.target.value }))
                          }
                          className="flex-1 min-w-[140px] px-2.5 py-1.5 rounded-lg bg-[#0E131E] border border-white/10 text-xs font-bold"
                        />
                        <select
                          value={cat.statProfile}
                          onChange={(e) =>
                            updateCategory(cat.id, (c) => ({
                              ...c,
                              statProfile: e.target.value as InventoryStatProfile,
                            }))
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-[#0E131E] border border-white/10 text-xs font-semibold"
                          title="Contextual inspector layout for items in this category"
                        >
                          <option value="auto">Auto by Item Type</option>
                          <option value="weapon">Weapon / Combat Stats</option>
                          <option value="apparel">Clothing / Armor Stats</option>
                          <option value="consumable">Plant / Potion / Food Stats</option>
                          <option value="material">Material / Craft Stats</option>
                          <option value="magic">Magic / Relic Focus</option>
                          <option value="custom">Custom Stat Labels</option>
                        </select>
                        {config.categories.length > 1 && cat.id !== 'all' && (
                          <button
                            type="button"
                            onClick={() => deleteCategory(cat.id)}
                            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#F2545B] hover:bg-white/6"
                            title="Delete category"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>

                      {cat.id !== 'all' && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-bold text-[#64748B] mr-1">
                            Includes:
                          </span>
                          {(
                            [
                              { id: 'weapon', label: 'Weapons' },
                              { id: 'tool', label: 'Tools' },
                              { id: 'wearable', label: 'Apparel' },
                              { id: 'consumable', label: 'Plants/Food' },
                              { id: 'resource', label: 'Resources' },
                              { id: 'material', label: 'Materials' },
                            ] as { id: InventoryItemCategory; label: string }[]
                          ).map((mc) => {
                            const checked = cat.matchCategories.includes(mc.id);
                            return (
                              <button
                                key={mc.id}
                                type="button"
                                onClick={() =>
                                  updateCategory(cat.id, (c) => ({
                                    ...c,
                                    matchCategories: checked
                                      ? c.matchCategories.filter((x) => x !== mc.id)
                                      : [...c.matchCategories, mc.id],
                                  }))
                                }
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors ${
                                  checked
                                    ? 'bg-[#7C5CFF]/25 border-[#7C5CFF]/60 text-white'
                                    : 'bg-[#0E131E] border-white/8 text-[#64748B]'
                                }`}
                              >
                                {mc.label}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {cat.id !== 'all' && (
                        <div className="grid grid-cols-3 gap-2 pt-1">
                          <input
                            type="text"
                            value={cat.statLabels?.primary ?? ''}
                            onChange={(e) =>
                              updateCategory(cat.id, (c) => ({
                                ...c,
                                statLabels: { ...c.statLabels, primary: e.target.value },
                              }))
                            }
                            placeholder="Primary stat label"
                            className="px-2 py-1 rounded-md bg-[#0E131E] border border-white/8 text-[11px]"
                          />
                          <input
                            type="text"
                            value={cat.statLabels?.secondary ?? ''}
                            onChange={(e) =>
                              updateCategory(cat.id, (c) => ({
                                ...c,
                                statLabels: { ...c.statLabels, secondary: e.target.value },
                              }))
                            }
                            placeholder="Secondary label"
                            className="px-2 py-1 rounded-md bg-[#0E131E] border border-white/8 text-[11px]"
                          />
                          <input
                            type="text"
                            value={cat.statLabels?.tertiary ?? ''}
                            onChange={(e) =>
                              updateCategory(cat.id, (c) => ({
                                ...c,
                                statLabels: { ...c.statLabels, tertiary: e.target.value },
                              }))
                            }
                            placeholder="Tertiary label"
                            className="px-2 py-1 rounded-md bg-[#0E131E] border border-white/8 text-[11px]"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'items' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Item List */}
              <div className="lg:col-span-5 space-y-2.5">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    placeholder="Filter items…"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-[#161C2B] border border-white/10 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleCreateBlankItem}
                    className="px-3 py-1.5 rounded-lg bg-[#20B46A] hover:bg-[#199958] text-white text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap"
                  >
                    <Plus size={13} />
                    <span>New Item</span>
                  </button>
                </div>

                <div className="space-y-1.5 max-h-[58vh] overflow-y-auto maker-scroll pr-1">
                  {filteredCatalog.map((item) => {
                    const active = selectedItem?.id === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedItemId(item.id)}
                        className={`w-full p-2.5 rounded-xl border text-left flex items-center gap-3 transition-colors ${
                          active
                            ? 'bg-[#1D2436] border-[#7C5CFF]'
                            : 'bg-[#161C2B] border-white/6 hover:border-white/20'
                        }`}
                      >
                        <ItemThumbnailArt
                          meshKind={item.meshKind}
                          colorHex={item.colorHex}
                          size={38}
                          className="shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold truncate text-white">{item.name}</div>
                          <div className="text-[10px] text-[#94A3B8] capitalize truncate">
                            {item.category}
                            {item.attackBonus ? ` · +${item.attackBonus} ATK` : ''}
                            {item.defenseBonus ? ` · +${item.defenseBonus} DEF` : ''}
                            {item.healAmount ? ` · +${item.healAmount} HP` : ''}
                            {item.magicAmount ? ` · +${item.magicAmount} MP` : ''}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Item Editor */}
              <div className="lg:col-span-7">
                {selectedItem ? (
                  <div className="p-4 rounded-xl bg-[#161C2B] border border-white/10 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <ItemThumbnailArt
                          meshKind={selectedItem.meshKind}
                          colorHex={selectedItem.colorHex}
                          size={60}
                        />
                        <div>
                          <div className="text-sm font-extrabold">{selectedItem.name}</div>
                          <div className="text-[11px] text-[#94A3B8] font-mono">
                            {selectedItem.id}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleDuplicateItem(selectedItem)}
                          className="px-2.5 py-1.5 rounded-lg bg-white/8 hover:bg-white/14 text-xs font-bold"
                        >
                          Duplicate
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            store.deleteInventoryItem(selectedItem.id);
                            setSelectedItemId('');
                          }}
                          className="p-1.5 rounded-lg bg-[#F2545B]/15 text-[#F2545B] hover:bg-[#F2545B]/25"
                          title="Delete item"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-[10px] font-bold uppercase text-[#94A3B8]">
                          Item Name
                        </label>
                        <input
                          type="text"
                          value={selectedItem.name}
                          onChange={(e) => patchSelectedItem({ name: e.target.value })}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-[#0E131E] border border-white/10 text-xs font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-[#94A3B8]">
                          Tint Color
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={selectedItem.colorHex}
                            onChange={(e) =>
                              patchSelectedItem({
                                colorHex: e.target.value,
                                wearColorHex: e.target.value,
                              })
                            }
                            className="w-9 h-8 rounded border-0 bg-transparent cursor-pointer"
                          />
                          <span className="text-[11px] font-mono text-[#CBD5E1]">
                            {selectedItem.colorHex}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-[#94A3B8]">
                          Behavior Category
                        </label>
                        <select
                          value={selectedItem.category}
                          onChange={(e) =>
                            patchSelectedItem({
                              category: e.target.value as InventoryItemCategory,
                            })
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg bg-[#0E131E] border border-white/10 text-xs font-semibold"
                        >
                          <option value="weapon">Weapon (Hold &amp; Fight)</option>
                          <option value="tool">Tool (Hold &amp; Use)</option>
                          <option value="wearable">Wearable / Clothing</option>
                          <option value="consumable">Plant / Food / Potion</option>
                          <option value="resource">Resource (Gather &amp; Craft)</option>
                          <option value="material">Material / Relic</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-[#94A3B8]">
                          Artwork &amp; 3D Mesh
                        </label>
                        <select
                          value={selectedItem.meshKind}
                          onChange={(e) => {
                            const mk = e.target.value as PickupMeshKind;
                            const opt = MESH_OPTIONS.find((m) => m.kind === mk);
                            patchSelectedItem({
                              meshKind: mk,
                              icon: opt?.defaultIcon ?? selectedItem.icon,
                            });
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-[#0E131E] border border-white/10 text-xs font-semibold"
                        >
                          {MESH_OPTIONS.map((m) => (
                            <option key={m.kind} value={m.kind}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-[#94A3B8]">
                          Custom Tab Override
                        </label>
                        <select
                          value={selectedItem.customCategoryId ?? ''}
                          onChange={(e) =>
                            patchSelectedItem({
                              customCategoryId: e.target.value || undefined,
                            })
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg bg-[#0E131E] border border-white/10 text-xs font-semibold"
                        >
                          <option value="">Auto by Category</option>
                          {config.categories
                            .filter((c) => c.id !== 'all')
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.label}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>

                    {/* Character Body Part Attachment */}
                    <div className="flex flex-wrap items-end gap-2.5 p-3 rounded-lg bg-[#0E131E] border border-white/8">
                      <div className="flex-1 min-w-[200px] space-y-1">
                        <label className="text-[10px] font-bold uppercase text-[#94A3B8]">
                          Attach Body Part (Motion Studio)
                        </label>
                        <select
                          value={
                            resolveItemAttachBodyPart(selectedItem, store.customAssets) ?? ''
                          }
                          onChange={(e) =>
                            patchSelectedItem({
                              attachBodyPart: e.target.value
                                ? (e.target.value as ObjectAttachBodyPart)
                                : undefined,
                            })
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg bg-[#161C2B] border border-white/10 text-xs font-semibold"
                        >
                          <option value="">Unassigned (Assign in Object Editor)</option>
                          {OBJECT_BODY_PART_OPTIONS.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => store.openObjectMakerForInventoryItem(selectedItem.id)}
                        className="px-3 py-1.5 rounded-lg bg-[#7C5CFF] hover:bg-[#6A48F5] text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Wrench size={12} />
                        <span>Open in Object Editor</span>
                      </button>
                    </div>

                    {/* Contextual Fields by Type */}
                    {(selectedItem.category === 'tool' || selectedItem.category === 'weapon') && (
                      <div className="grid grid-cols-3 gap-2.5 p-3 rounded-lg bg-[#0E131E] border border-white/8">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-[#94A3B8]">
                            Tool Action
                          </label>
                          <select
                            value={selectedItem.toolKind ?? 'sword'}
                            onChange={(e) =>
                              patchSelectedItem({ toolKind: e.target.value as ToolActionKind })
                            }
                            className="w-full px-2 py-1 rounded bg-[#161C2B] text-xs font-semibold"
                          >
                            <option value="sword">Blade / Melee</option>
                            <option value="axe">Axe (Chop Trees)</option>
                            <option value="fishingPole">Fishing Pole</option>
                            <option value="torch">Torch (Light)</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-[#94A3B8]">
                            Attack / Damage
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={20}
                            value={selectedItem.attackBonus ?? 0}
                            onChange={(e) =>
                              patchSelectedItem({ attackBonus: Number(e.target.value) })
                            }
                            className="w-full px-2 py-1 rounded bg-[#161C2B] text-xs font-bold tabular-nums"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-[#94A3B8]">
                            Reach (m)
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={8}
                            step={0.2}
                            value={selectedItem.weaponRange ?? 2.8}
                            onChange={(e) =>
                              patchSelectedItem({ weaponRange: Number(e.target.value) })
                            }
                            className="w-full px-2 py-1 rounded bg-[#161C2B] text-xs font-bold tabular-nums"
                          />
                        </div>
                      </div>
                    )}

                    {selectedItem.category === 'wearable' && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-lg bg-[#0E131E] border border-white/8">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-[#94A3B8]">Slot</label>
                          <select
                            value={selectedItem.wearSlot ?? 'body'}
                            onChange={(e) =>
                              patchSelectedItem({ wearSlot: e.target.value as WearSlot })
                            }
                            className="w-full px-2 py-1 rounded bg-[#161C2B] text-xs font-semibold"
                          >
                            <option value="head">Headgear</option>
                            <option value="body">Body / Armor</option>
                            <option value="accessory">Accessory</option>
                            <option value="offhand">Off-Hand (Shield)</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-[#94A3B8]">Defense</label>
                          <input
                            type="number"
                            min={0}
                            max={20}
                            value={selectedItem.defenseBonus ?? 0}
                            onChange={(e) =>
                              patchSelectedItem({ defenseBonus: Number(e.target.value) })
                            }
                            className="w-full px-2 py-1 rounded bg-[#161C2B] text-xs font-bold tabular-nums"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-[#94A3B8]">+Max HP</label>
                          <input
                            type="number"
                            min={0}
                            max={12}
                            value={selectedItem.maxHealthBonus ?? 0}
                            onChange={(e) =>
                              patchSelectedItem({ maxHealthBonus: Number(e.target.value) })
                            }
                            className="w-full px-2 py-1 rounded bg-[#161C2B] text-xs font-bold tabular-nums"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-[#94A3B8]">+Speed %</label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={Math.round((selectedItem.speedBonus ?? 0) * 100)}
                            onChange={(e) =>
                              patchSelectedItem({ speedBonus: Number(e.target.value) / 100 })
                            }
                            className="w-full px-2 py-1 rounded bg-[#161C2B] text-xs font-bold tabular-nums"
                          />
                        </div>
                      </div>
                    )}

                    {(selectedItem.category === 'consumable' ||
                      selectedItem.category === 'resource' ||
                      selectedItem.category === 'material') && (
                      <div className="grid grid-cols-3 gap-2.5 p-3 rounded-lg bg-[#0E131E] border border-white/8">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-[#94A3B8]">
                            Restore HP
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={20}
                            value={selectedItem.healAmount ?? 0}
                            onChange={(e) =>
                              patchSelectedItem({ healAmount: Number(e.target.value) })
                            }
                            className="w-full px-2 py-1 rounded bg-[#161C2B] text-xs font-bold tabular-nums"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-[#94A3B8]">
                            Stamina
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={selectedItem.staminaAmount ?? 0}
                            onChange={(e) =>
                              patchSelectedItem({ staminaAmount: Number(e.target.value) })
                            }
                            className="w-full px-2 py-1 rounded bg-[#161C2B] text-xs font-bold tabular-nums"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-[#94A3B8]">
                            Magic / Mana
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={selectedItem.magicAmount ?? 0}
                            onChange={(e) =>
                              patchSelectedItem({ magicAmount: Number(e.target.value) })
                            }
                            className="w-full px-2 py-1 rounded bg-[#161C2B] text-xs font-bold tabular-nums"
                          />
                        </div>
                      </div>
                    )}

                    {/* Dynamic Rich Metadata Schema (power, durability, magic_effect, rarity, weight) */}
                    {resolvedSelectedMeta && (
                      <div className="p-3 rounded-lg bg-[#0E131E] border border-[#7C5CFF]/25 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#A78BFA]">
                            Item Metadata Schema
                          </span>
                          <span className="text-[10px] text-[#94A3B8] font-mono">
                            power: {resolvedSelectedMeta.power} · dur: {resolvedSelectedMeta.durability}/{resolvedSelectedMeta.maxDurability}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-[#94A3B8]">Power</label>
                            <input
                              type="number"
                              min={0}
                              max={999}
                              value={resolvedSelectedMeta.power}
                              onChange={(e) =>
                                patchSelectedMeta({ power: Math.max(0, Number(e.target.value)) })
                              }
                              className="w-full px-2 py-1 rounded bg-[#161C2B] text-xs font-bold tabular-nums"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-[#94A3B8]">Durability</label>
                            <input
                              type="number"
                              min={1}
                              max={999}
                              value={resolvedSelectedMeta.durability}
                              onChange={(e) => {
                                const val = Math.max(1, Number(e.target.value));
                                patchSelectedMeta({
                                  durability: val,
                                  maxDurability: Math.max(val, resolvedSelectedMeta.maxDurability),
                                });
                              }}
                              className="w-full px-2 py-1 rounded bg-[#161C2B] text-xs font-bold tabular-nums"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-[#94A3B8]">Rarity</label>
                            <select
                              value={resolvedSelectedMeta.rarity}
                              onChange={(e) =>
                                patchSelectedMeta({ rarity: e.target.value as ItemRarity })
                              }
                              className="w-full px-2 py-1 rounded bg-[#161C2B] text-xs font-semibold capitalize"
                            >
                              <option value="common">Common</option>
                              <option value="uncommon">Uncommon</option>
                              <option value="rare">Rare</option>
                              <option value="epic">Epic</option>
                              <option value="legendary">Legendary</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-[#94A3B8]">Weight (kg)</label>
                            <input
                              type="number"
                              min={0.1}
                              max={99}
                              step={0.1}
                              value={resolvedSelectedMeta.weight}
                              onChange={(e) =>
                                patchSelectedMeta({ weight: Math.max(0.1, Number(e.target.value)) })
                              }
                              className="w-full px-2 py-1 rounded bg-[#161C2B] text-xs font-bold tabular-nums"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Descriptions, Lore & Magic Notes */}
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-[#94A3B8]">
                          Summary Description
                        </label>
                        <textarea
                          rows={2}
                          value={selectedItem.description}
                          onChange={(e) => patchSelectedItem({ description: e.target.value })}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-[#0E131E] border border-white/10 text-xs"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-[#94A3B8]">
                            Magic Effect (magic_effect)
                          </label>
                          <input
                            type="text"
                            value={selectedItem.metadata?.magic_effect ?? selectedItem.magicEffect ?? ''}
                            onChange={(e) => {
                              patchSelectedItem({
                                magicEffect: e.target.value,
                                metadata: {
                                  ...(selectedItem.metadata ?? {}),
                                  magic_effect: e.target.value,
                                },
                              });
                            }}
                            placeholder="e.g. Heals +3 HP, grants forest clarity"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-[#0E131E] border border-white/10 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-[#94A3B8]">
                            World Lore / Notes
                          </label>
                          <input
                            type="text"
                            value={selectedItem.lore ?? ''}
                            onChange={(e) => patchSelectedItem({ lore: e.target.value })}
                            placeholder="e.g. Gathered under mossy oaks"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-[#0E131E] border border-white/10 text-xs"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Creator Custom Contextual Stat Rows */}
                    <div className="space-y-2 pt-2 border-t border-white/8">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-[#94A3B8]">
                          Custom Contextual Stat Rows (displayed in Workbench Inspector)
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const next: InventoryCustomStat[] = [
                              ...(selectedItem.customStats ?? []),
                              { label: 'Attribute', value: 'Value' },
                            ];
                            patchSelectedItem({ customStats: next });
                          }}
                          className="text-[11px] font-bold text-[#7C5CFF] hover:underline inline-flex items-center gap-1"
                        >
                          <Plus size={12} />
                          <span>Add Stat Row</span>
                        </button>
                      </div>
                      {(selectedItem.customStats ?? []).map((st, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={st.label}
                            onChange={(e) => {
                              const next = [...(selectedItem.customStats ?? [])];
                              next[idx] = { ...next[idx], label: e.target.value };
                              patchSelectedItem({ customStats: next });
                            }}
                            placeholder="Label (e.g. Element)"
                            className="w-36 px-2.5 py-1 rounded-lg bg-[#0E131E] border border-white/10 text-xs font-semibold"
                          />
                          <input
                            type="text"
                            value={st.value}
                            onChange={(e) => {
                              const next = [...(selectedItem.customStats ?? [])];
                              next[idx] = { ...next[idx], value: e.target.value };
                              patchSelectedItem({ customStats: next });
                            }}
                            placeholder="Value (e.g. Woodland)"
                            className="flex-1 px-2.5 py-1 rounded-lg bg-[#0E131E] border border-white/10 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const next = (selectedItem.customStats ?? []).filter(
                                (_, i) => i !== idx
                              );
                              patchSelectedItem({ customStats: next });
                            }}
                            className="p-1 text-[#94A3B8] hover:text-[#F2545B]"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-6 rounded-xl bg-[#161C2B] border border-white/8 text-xs text-[#94A3B8]">
                    Select or create an item on the left to customize its artwork, lore, magic properties, and contextual stats.
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'recipes' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#161C2B] border border-white/10 space-y-3">
                <div className="text-xs font-extrabold uppercase tracking-wider text-[#94A3B8]">
                  Create Mixing / Crafting Recipe
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                  <div className="sm:col-span-3 space-y-1">
                    <label className="text-[10px] font-bold text-[#94A3B8]">Ingredient A</label>
                    <select
                      value={newRecA}
                      onChange={(e) => setNewRecA(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-lg bg-[#0E131E] border border-white/10 text-xs font-semibold"
                    >
                      {catalog.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-3 space-y-1">
                    <label className="text-[10px] font-bold text-[#94A3B8]">Ingredient B</label>
                    <select
                      value={newRecB}
                      onChange={(e) => setNewRecB(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-lg bg-[#0E131E] border border-white/10 text-xs font-semibold"
                    >
                      {catalog.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-3 space-y-1">
                    <label className="text-[10px] font-bold text-[#94A3B8]">Result Item</label>
                    <select
                      value={newRecResult}
                      onChange={(e) => setNewRecResult(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-lg bg-[#0E131E] border border-white/10 text-xs font-semibold"
                    >
                      {catalog.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-1 space-y-1">
                    <label className="text-[10px] font-bold text-[#94A3B8]">Qty</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={newRecQty}
                      onChange={(e) => setNewRecQty(Math.max(1, Number(e.target.value)))}
                      className="w-full px-2 py-2 rounded-lg bg-[#0E131E] border border-white/10 text-xs font-bold text-center tabular-nums"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={() => {
                        const resItem = catalog.find((i) => i.id === newRecResult);
                        const rec: CraftingRecipe = {
                          id: `recipe_${uid()}`,
                          title: newRecipeTitle.trim() || resItem?.name || 'Custom Craft',
                          ingredientA: newRecA,
                          ingredientB: newRecB,
                          resultItemId: newRecResult,
                          resultQty: newRecQty,
                        };
                        store.addCraftingRecipe(rec);
                        setNewRecipeTitle('');
                      }}
                      className="w-full py-2 px-3 rounded-lg bg-[#A855F7] hover:bg-[#9333EA] text-white text-xs font-extrabold whitespace-nowrap"
                    >
                      Add Recipe
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {recipes.map((r) => {
                  const a = catalog.find((i) => i.id === r.ingredientA);
                  const b = catalog.find((i) => i.id === r.ingredientB);
                  const res = catalog.find((i) => i.id === r.resultItemId);
                  if (!a || !b || !res) return null;
                  return (
                    <div
                      key={r.id}
                      className="p-3 rounded-xl bg-[#161C2B] border border-white/8 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <ItemThumbnailArt meshKind={a.meshKind} colorHex={a.colorHex} size={32} />
                        <span className="text-xs font-bold text-[#94A3B8]">+</span>
                        <ItemThumbnailArt meshKind={b.meshKind} colorHex={b.colorHex} size={32} />
                        <span className="text-xs font-bold text-[#94A3B8]">→</span>
                        <ItemThumbnailArt meshKind={res.meshKind} colorHex={res.colorHex} size={34} />
                        <div className="min-w-0 ml-1">
                          <div className="text-xs font-extrabold truncate text-white">
                            {res.name} {r.resultQty > 1 ? `×${r.resultQty}` : ''}
                          </div>
                          <div className="text-[10px] text-[#94A3B8] truncate">
                            {a.name} + {b.name}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => store.deleteCraftingRecipe(r.id)}
                        className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#F2545B] hover:bg-white/6 shrink-0"
                        title="Remove recipe"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'world' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-[#161C2B] border border-white/8 flex flex-wrap items-center justify-between gap-2 text-xs text-[#CBD5E1]">
                <div>
                  Enable which world terrain props players can harvest directly in Play Mode. Collected props vanish cleanly from the terrain and go straight into the player&apos;s inventory.
                </div>
                <span className="text-[11px] font-semibold text-[#4ADE80]">
                  Forest trees are also choppable with an Axe into Wood Logs!
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {config.worldCollectibles.map((rule) => {
                  const dropItem = catalog.find((i) => i.id === rule.itemId);
                  return (
                    <div
                      key={rule.scatterKind}
                      className={`p-4 rounded-xl border transition-colors space-y-3 ${
                        rule.enabled
                          ? 'bg-[#161C2B] border-[#20B46A]/35'
                          : 'bg-[#131722] border-white/6 opacity-75'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          {dropItem && (
                            <ItemThumbnailArt
                              meshKind={dropItem.meshKind}
                              colorHex={dropItem.colorHex}
                              size={36}
                            />
                          )}
                          <div>
                            <div className="text-xs font-extrabold text-white">{rule.label}</div>
                            <div className="text-[10px] font-mono text-[#64748B]">
                              scatter:{rule.scatterKind}
                            </div>
                          </div>
                        </div>
                        <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                          <span className={rule.enabled ? 'text-[#4ADE80]' : 'text-[#64748B]'}>
                            {rule.enabled ? 'Collectible' : 'Scenery Only'}
                          </span>
                          <input
                            type="checkbox"
                            checked={rule.enabled}
                            onChange={(e) =>
                              updateWorldRule(rule.scatterKind, { enabled: e.target.checked })
                            }
                            className="accent-[#20B46A] w-4 h-4"
                          />
                        </label>
                      </div>

                      {rule.enabled && (
                        <div className="grid grid-cols-12 gap-2">
                          <div className="col-span-6 space-y-1">
                            <label className="text-[10px] font-bold text-[#94A3B8]">
                              Grants Item
                            </label>
                            <select
                              value={rule.itemId}
                              onChange={(e) =>
                                updateWorldRule(rule.scatterKind, { itemId: e.target.value })
                              }
                              className="w-full px-2 py-1.5 rounded-lg bg-[#0E131E] border border-white/10 text-xs font-semibold"
                            >
                              {catalog.map((i) => (
                                <option key={i.id} value={i.id}>
                                  {i.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="col-span-2 space-y-1">
                            <label className="text-[10px] font-bold text-[#94A3B8]">Qty</label>
                            <input
                              type="number"
                              min={1}
                              max={5}
                              value={rule.qty}
                              onChange={(e) =>
                                updateWorldRule(rule.scatterKind, {
                                  qty: Math.max(1, Math.min(5, Number(e.target.value))),
                                })
                              }
                              className="w-full px-2 py-1.5 rounded-lg bg-[#0E131E] border border-white/10 text-xs font-bold text-center tabular-nums"
                            />
                          </div>
                          <div className="col-span-4 space-y-1">
                            <label className="text-[10px] font-bold text-[#94A3B8]">
                              Method
                            </label>
                            <select
                              value={rule.collectMethod}
                              onChange={(e) =>
                                updateWorldRule(rule.scatterKind, {
                                  collectMethod: e.target.value as 'interact' | 'walkOver',
                                })
                              }
                              className="w-full px-2 py-1.5 rounded-lg bg-[#0E131E] border border-white/10 text-xs font-semibold"
                            >
                              <option value="interact">Press E</option>
                              <option value="walkOver">Walk-Over</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
