import React, { useMemo, useState } from 'react';
import { Backpack, Plus, SlidersHorizontal } from 'lucide-react';
import { getProjectInventoryItems } from '../../data/registries';
import type { MakerStore } from '../../store/useMakerStore';
import type {
  InventoryItemCategory,
  InventoryItemDef,
  LevelEntity,
  PickupMeshKind,
  ToolActionKind,
  WearSlot,
} from '../../types/maker';
import { uid } from '../../utils/terrain';
import { InventoryStudioModal } from './InventoryStudioModal';
import { ItemThumbnailArt } from './ItemThumbnailArt';
import { FieldLabel } from './MakerUI';

const NON_ASSIGNABLE_KINDS = new Set(['hero', 'portal', 'door', 'platform', 'trap', 'checkpoint']);

export const EntityItemAssignPanel: React.FC<{
  entity: LevelEntity;
  store: MakerStore;
}> = ({ entity, store }) => {
  const [creatingNew, setCreatingNew] = useState(false);
  const [showingStudio, setShowingStudio] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<InventoryItemCategory>('consumable');
  const [newColor, setNewColor] = useState('#22C55E');
  const [newHeal, setNewHeal] = useState(2);
  const [newToolKind, setNewToolKind] = useState<ToolActionKind>('axe');
  const [newWearSlot, setNewWearSlot] = useState<WearSlot>('head');

  const catalog = useMemo(
    () => getProjectInventoryItems(store.currentProject),
    [store.currentProject]
  );

  if (NON_ASSIGNABLE_KINDS.has(entity.kind)) {
    return null;
  }

  const isEnabled = Boolean(entity.pickupable || entity.pickupItemId || entity.kind === 'pickup');
  const assignedItem = catalog.find((i) => i.id === entity.pickupItemId);

  const actionLabel =
    entity.kind === 'baddie'
      ? 'Drops item when defeated'
      : entity.kind === 'treasure'
      ? 'Grants item when opened'
      : entity.kind === 'npc'
      ? 'Gifts item when talked to'
      : entity.kind === 'pickup'
      ? 'Collectible inventory item'
      : 'Can be picked up into bag';

  const handleToggle = (checked: boolean) => {
    store.updateEntity(entity.id, 'toggle pickup item', (ent) => ({
      ...ent,
      pickupable: checked,
      pickupItemId: checked ? ent.pickupItemId || catalog[0]?.id || 'wild_berries' : undefined,
      pickupQty: checked ? ent.pickupQty ?? 1 : undefined,
    }));
  };

  const handleCreateCustomItem = () => {
    const clean = newName.trim();
    if (!clean) return;
    const meshKind: PickupMeshKind =
      newCategory === 'tool'
        ? newToolKind === 'fishingPole'
          ? 'fishingPole'
          : newToolKind === 'torch'
          ? 'torch'
          : 'axe'
        : newCategory === 'weapon'
        ? 'sword'
        : newCategory === 'wearable'
        ? newWearSlot === 'head'
          ? 'hat'
          : newWearSlot === 'body'
          ? 'cloak'
          : 'amulet'
        : newCategory === 'consumable'
        ? 'potion'
        : 'gem';

    const icon =
      newCategory === 'tool'
        ? newToolKind === 'fishingPole'
          ? 'fish'
          : newToolKind === 'torch'
          ? 'flame'
          : 'axe'
        : newCategory === 'weapon'
        ? 'sword'
        : newCategory === 'wearable'
        ? newWearSlot === 'head'
          ? 'crown'
          : newWearSlot === 'body'
          ? 'shirt'
          : 'shield'
        : newCategory === 'consumable'
        ? 'flask'
        : 'gem';

    const item: InventoryItemDef = {
      id: `custom_${uid()}`,
      name: clean,
      category: newCategory,
      colorHex: newColor,
      icon,
      meshKind,
      description:
        newCategory === 'consumable'
          ? `Custom consumable (+${newHeal} Health).`
          : newCategory === 'wearable'
          ? `Custom wearable (${newWearSlot} slot).`
          : newCategory === 'tool'
          ? `Custom ${newToolKind} tool.`
          : 'Custom adventure item.',
      ...(newCategory === 'tool' ? { toolKind: newToolKind } : {}),
      ...(newCategory === 'weapon' ? { toolKind: 'sword' as const, attackBonus: 1 } : {}),
      ...(newCategory === 'consumable' ? { healAmount: newHeal, staminaAmount: 25 } : {}),
      ...(newCategory === 'wearable'
        ? {
            wearSlot: newWearSlot,
            wearColorHex: newColor,
            maxHealthBonus: newWearSlot === 'body' ? 2 : 0,
            speedBonus: newWearSlot === 'head' ? 0.1 : 0,
            attackBonus: newWearSlot === 'accessory' ? 1 : 0,
          }
        : {}),
      metadata: {
        power: newCategory === 'weapon' ? 12 : newCategory === 'consumable' ? newHeal * 4 : 8,
        durability: newCategory === 'consumable' ? 1 : 100,
        maxDurability: newCategory === 'consumable' ? 1 : 100,
        magic_effect:
          newCategory === 'consumable'
            ? `Restores +${newHeal} HP & +25 Stamina.`
            : 'Custom crafted adventure item.',
        rarity: 'common',
        weight: 0.8,
        repairable: newCategory === 'weapon' || newCategory === 'tool' || newCategory === 'wearable',
      },
    };

    store.addInventoryItem(item);
    store.updateEntity(entity.id, `assign ${item.name}`, (ent) => ({
      ...ent,
      pickupable: true,
      pickupItemId: item.id,
      pickupQty: ent.pickupQty ?? 1,
      name: ent.kind === 'pickup' ? item.name : ent.name,
    }));
    setNewName('');
    setCreatingNew(false);
  };

  return (
    <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-[#1F2430] space-y-2.5 border border-slate-200/60 dark:border-white/[0.06]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Backpack size={13} className="text-[#20B46A]" />
          <FieldLabel text="Inventory Pickup" />
        </div>
        {entity.kind !== 'pickup' && (
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(e) => handleToggle(e.target.checked)}
            className="accent-[#20B46A] w-4 h-4 cursor-pointer"
            title={actionLabel}
          />
        )}
      </div>

      <p className="text-[11px] text-slate-500 dark:text-[#949BB0] leading-snug">{actionLabel}</p>

      {isEnabled && (
        <div className="space-y-2 pt-0.5">
          <div className="flex items-center gap-2">
            {assignedItem && (
              <ItemThumbnailArt
                meshKind={assignedItem.meshKind}
                colorHex={assignedItem.colorHex}
                size={34}
                className="shrink-0"
              />
            )}
            <select
              value={entity.pickupItemId ?? ''}
              onChange={(e) => {
                const chosenId = e.target.value || undefined;
                const chosen = catalog.find((c) => c.id === chosenId);
                store.updateEntity(entity.id, 'assign pickup item', (ent) => ({
                  ...ent,
                  pickupable: Boolean(chosenId),
                  pickupItemId: chosenId,
                  pickupQty: ent.pickupQty ?? 1,
                  name: ent.kind === 'pickup' && chosen ? chosen.name : ent.name,
                }));
              }}
              className="flex-1 min-w-0 px-2.5 py-2 rounded-xl bg-white dark:bg-[#171A23] text-xs font-semibold border border-slate-200/70 dark:border-white/[0.08]"
            >
              <option value="">None</option>
              <optgroup label="Hold & Tools">
                {catalog
                  .filter((i) => i.category === 'tool' || i.category === 'weapon')
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Consumables">
                {catalog
                  .filter((i) => i.category === 'consumable')
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Wearables">
                {catalog
                  .filter((i) => i.category === 'wearable')
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Resources &amp; Materials">
                {catalog
                  .filter((i) => i.category === 'resource' || i.category === 'material')
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>

          {entity.pickupItemId && (
            <div className="flex items-center justify-between gap-2 text-xs font-semibold">
              <span className="text-slate-500 dark:text-[#949BB0]">Quantity</span>
              <div className="inline-flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    store.updateEntity(entity.id, 'change pickup qty', (ent) => ({
                      ...ent,
                      pickupQty: Math.max(1, (ent.pickupQty ?? 1) - 1),
                    }))
                  }
                  className="w-6 h-6 rounded-lg bg-white dark:bg-[#171A23] border border-slate-200/70 dark:border-white/[0.08] font-bold"
                >
                  −
                </button>
                <span className="w-6 text-center tabular-nums">{entity.pickupQty ?? 1}</span>
                <button
                  type="button"
                  onClick={() =>
                    store.updateEntity(entity.id, 'change pickup qty', (ent) => ({
                      ...ent,
                      pickupQty: Math.min(10, (ent.pickupQty ?? 1) + 1),
                    }))
                  }
                  className="w-6 h-6 rounded-lg bg-white dark:bg-[#171A23] border border-slate-200/70 dark:border-white/[0.08] font-bold"
                >
                  +
                </button>
              </div>
            </div>
          )}

          {!creatingNew ? (
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setCreatingNew(true)}
                className="flex-1 py-1.5 rounded-xl bg-[#20B46A]/15 text-[#20B46A] text-[11px] font-bold hover:bg-[#20B46A]/25 inline-flex items-center justify-center gap-1"
              >
                <Plus size={12} />
                <span>New item</span>
              </button>
              <button
                type="button"
                onClick={() => setShowingStudio(true)}
                className="px-2.5 py-1.5 rounded-xl bg-[#7C5CFF]/15 text-[#7C5CFF] text-[11px] font-bold hover:bg-[#7C5CFF]/25 inline-flex items-center justify-center gap-1 whitespace-nowrap"
                title="Customize inventory panel, categories, stats & world collectibles"
              >
                <SlidersHorizontal size={11} />
                <span>Studio</span>
              </button>
            </div>
          ) : (
            <div className="p-2.5 rounded-xl bg-white dark:bg-[#171A23] border border-slate-200/70 dark:border-white/[0.08] space-y-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Item name (e.g. Golden Apple)…"
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#20B46A]"
              />
              <div className="flex gap-1.5">
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as InventoryItemCategory)}
                  className="flex-1 px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-[11px] font-semibold"
                >
                  <option value="consumable">Consume</option>
                  <option value="tool">Tool (Hold)</option>
                  <option value="weapon">Weapon (Hold)</option>
                  <option value="wearable">Wearable</option>
                  <option value="resource">Resource</option>
                  <option value="material">Material</option>
                </select>
                <input
                  type="color"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  className="w-8 h-8 rounded-lg border-0 bg-transparent cursor-pointer"
                  title="Item color"
                />
              </div>

              {newCategory === 'tool' && (
                <select
                  value={newToolKind}
                  onChange={(e) => setNewToolKind(e.target.value as ToolActionKind)}
                  className="w-full px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-[11px] font-semibold"
                >
                  <option value="axe">Axe (chops trees)</option>
                  <option value="fishingPole">Fishing Pole (fishes water)</option>
                  <option value="torch">Torch (lights caves)</option>
                  <option value="sword">Blade / Weapon</option>
                </select>
              )}

              {newCategory === 'wearable' && (
                <select
                  value={newWearSlot}
                  onChange={(e) => setNewWearSlot(e.target.value as WearSlot)}
                  className="w-full px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-[11px] font-semibold"
                >
                  <option value="head">Headgear (+Speed)</option>
                  <option value="body">Cloak / Armor (+2 Max HP)</option>
                  <option value="accessory">Amulet (+1 Attack)</option>
                </select>
              )}

              {newCategory === 'consumable' && (
                <div className="flex items-center justify-between text-[11px] font-semibold">
                  <span>Restores HP</span>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={newHeal}
                    onChange={(e) => setNewHeal(Math.max(1, Math.min(8, Number(e.target.value))))}
                    className="w-14 px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-center"
                  />
                </div>
              )}

              <div className="flex gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setCreatingNew(false)}
                  className="flex-1 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-[11px] font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateCustomItem}
                  className="flex-1 py-1.5 rounded-lg bg-[#20B46A] text-white text-[11px] font-bold"
                >
                  Save & Assign
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {showingStudio && (
        <InventoryStudioModal
          store={store}
          initialTab="items"
          onClose={() => setShowingStudio(false)}
        />
      )}
    </div>
  );
};
