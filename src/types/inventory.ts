// Inventory, Crafting, Equipment & Collectible Types

export type InventoryItemCategory =
  | 'tool'
  | 'weapon'
  | 'consumable'
  | 'wearable'
  | 'resource'
  | 'material';

export type ToolActionKind = 'sword' | 'axe' | 'fishingPole' | 'torch';
export type WearSlot = 'head' | 'body' | 'accessory' | 'offhand';

export type ObjectAttachBodyPart =
  | 'rightHand'
  | 'leftHand'
  | 'head'
  | 'chest'
  | 'back'
  | 'neck'
  | 'hips'
  | 'leftArm'
  | 'rightArm'
  | 'leftFoot'
  | 'rightFoot'
  | 'leftWing'
  | 'rightWing'
  | 'tail';

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export type PickupMeshKind =
  | 'sword'
  | 'axe'
  | 'fishingPole'
  | 'woodLog'
  | 'fish'
  | 'berries'
  | 'herbs'
  | 'mushroom'
  | 'flower'
  | 'potion'
  | 'hat'
  | 'cloak'
  | 'armor'
  | 'shield'
  | 'amulet'
  | 'torch'
  | 'staff'
  | 'scroll'
  | 'stone'
  | 'moss'
  | 'bone'
  | 'gem'
  | 'blanket';

export interface InventoryCustomStat {
  label: string;
  value: string;
}

export interface ItemMetadata {
  power?: number;
  durability?: number;
  maxDurability?: number;
  magic_effect?: string;
  rarity?: ItemRarity;
  weight?: number;
  craftable?: boolean;
  repairable?: boolean;
  properties?: Record<string, string | number | boolean>;
}

export interface InventoryItemDef {
  id: string;
  name: string;
  category: InventoryItemCategory;
  customCategoryId?: string;
  colorHex: string;
  icon: string;
  description: string;
  lore?: string;
  magicEffect?: string;
  meshKind: PickupMeshKind;
  customAssetId?: string;
  attachBodyPart?: ObjectAttachBodyPart;
  toolKind?: ToolActionKind;
  handedness?: 'oneHand' | 'twoHand';
  wearSlot?: WearSlot;
  wearColorHex?: string;
  blockReduction?: number;
  healAmount?: number;
  staminaAmount?: number;
  magicAmount?: number;
  attackBonus?: number;
  defenseBonus?: number;
  weaponRange?: number;
  speedBonus?: number;
  maxHealthBonus?: number;
  metadata?: ItemMetadata;
  customStats?: InventoryCustomStat[];
}

export type InventoryStatProfile =
  | 'auto'
  | 'weapon'
  | 'apparel'
  | 'consumable'
  | 'material'
  | 'magic'
  | 'custom';

export interface InventoryCategoryConfig {
  id: string;
  label: string;
  matchCategories: InventoryItemCategory[];
  statProfile: InventoryStatProfile;
  statLabels?: {
    primary?: string;
    secondary?: string;
    tertiary?: string;
  };
}

export type WorldCollectibleScatterKind =
  | 'mushroom'
  | 'berryBush'
  | 'fern'
  | 'broadleaf'
  | 'flower'
  | 'rock';

export interface WorldCollectibleRule {
  scatterKind: WorldCollectibleScatterKind;
  label: string;
  enabled: boolean;
  itemId: string;
  qty: number;
  collectMethod: 'interact' | 'walkOver';
}

export interface GameInventoryConfig {
  panelTitle: string;
  panelSubtitle: string;
  toggleKey: string;
  allowMixWorkbench: boolean;
  mixTitle: string;
  mixButtonLabel: string;
  categories: InventoryCategoryConfig[];
  worldCollectibles: WorldCollectibleRule[];
}

export type CraftingRecipeCategory = 'weapon' | 'consumable' | 'wearable' | 'tool' | 'alchemy';

export interface CraftingRecipe {
  id: string;
  title: string;
  ingredientA: string;
  ingredientB: string;
  resultItemId: string;
  resultQty: number;
  category?: CraftingRecipeCategory;
}

export interface InventoryStack {
  itemId: string;
  qty: number;
  durability?: number;
  maxDurability?: number;
}

export interface HeroEquipment {
  heldItemId: string | null;
  offhandItemId?: string | null;
  headItemId: string | null;
  bodyItemId: string | null;
  accessoryItemId: string | null;
}
