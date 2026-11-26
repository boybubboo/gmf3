import type { BehaviorCard, InventoryItemDef, ObjectMechanism } from '../../../types/maker';
import type { ChestLootEntry } from '../../../components/play/ChestLootModal';
import { resolveItemMetadata } from '../../../data/registries';

export function buildChestLootEntriesForEntity(
  ent: {
    id: string;
    name: string;
    loot?: string;
    pickupItemId?: string;
    pickupQty?: number;
    cards?: BehaviorCard[];
  },
  mechs: ObjectMechanism[],
  itemById: Map<string, InventoryItemDef>,
  itemCatalog: InventoryItemDef[],
  isRoguelike: boolean
): ChestLootEntry[] {
  const entries: ChestLootEntry[] = [];
  const addedItemIds = new Set<string>();
  const lowerName = ent.name.toLowerCase();

  // 1. Determine coin hoard from mechanism rewards, giveTreasure cards, or chest tier
  let coinCount = 0;
  for (const mech of mechs) {
    for (const trig of mech.triggers) {
      if (trig.rewardCoins && trig.rewardCoins > 0) {
        coinCount = Math.max(coinCount, trig.rewardCoins);
      }
    }
  }
  for (const card of ent.cards ?? []) {
    for (const act of card.actions ?? []) {
      if (act.key === 'giveTreasure' && act.detail) {
        const m = act.detail.match(/(\d+)/);
        if (m) coinCount = Math.max(coinCount, Number(m[1]));
      }
    }
  }
  if (coinCount <= 0) {
    coinCount =
      lowerName.includes('vault') || lowerName.includes('boss')
        ? 10 + Math.floor(Math.random() * 6)
        : 4 + Math.floor(Math.random() * 5);
  }

  // 2. Include explicitly configured pickup item or mechanism reward item
  const addItemEntry = (itemId: string, qty = 1, subtitle = 'Chest Treasure') => {
    const def = itemById.get(itemId);
    if (!def) return;
    const meta = resolveItemMetadata(def);
    addedItemIds.add(itemId);
    entries.push({
      uid: `${ent.id}_item_${itemId}_${entries.length}`,
      kind: 'item',
      qty: Math.max(1, qty),
      label: def.name,
      subtitle,
      rarity: meta.rarity,
      itemId: def.id,
      itemDef: def,
    });
  };

  if (ent.pickupItemId) {
    addItemEntry(ent.pickupItemId, ent.pickupQty ?? 1, 'Featured Treasure');
  }
  for (const mech of mechs) {
    for (const trig of mech.triggers) {
      if (trig.rewardItemId && !addedItemIds.has(trig.rewardItemId)) {
        addItemEntry(trig.rewardItemId, 1, 'Vault Reward');
      }
    }
  }
  if (lowerName.includes('crown') && !addedItemIds.has('golden_crown')) {
    addItemEntry('golden_crown', 1, 'Royal Relic');
  }
  if (ent.loot?.toLowerCase().includes('health') && !addedItemIds.has('healing_tonic')) {
    addItemEntry('healing_tonic', 1, 'Restorative Brew');
  }

  // 3. Roll 1–2 dynamic extra items so chests have varied ever-changing contents to browse
  const pool = itemCatalog.filter(
    (item) =>
      item.id !== 'parachute_blanket' &&
      item.id !== 'iron_sword' &&
      !addedItemIds.has(item.id)
  );
  const targetExtraItems = entries.length === 0 ? 2 : isRoguelike || Math.random() < 0.75 ? 1 : 0;
  if (pool.length > 0 && targetExtraItems > 0) {
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(targetExtraItems, shuffled.length); i++) {
      const pick = shuffled[i];
      const qty =
        pick.category === 'consumable' || pick.category === 'resource'
          ? 1 + (Math.random() < 0.35 ? 1 : 0)
          : 1;
      addItemEntry(pick.id, qty, 'Hidden Treasure');
    }
  }

  // 4. Add Gold Coins entry
  if (coinCount > 0) {
    entries.push({
      uid: `${ent.id}_coins`,
      kind: 'coin',
      qty: coinCount,
      label: 'Gold Coins',
      subtitle: 'Gleaming Treasure',
      rarity: coinCount >= 12 ? 'rare' : coinCount >= 6 ? 'uncommon' : 'common',
    });
  }

  return entries;
}
