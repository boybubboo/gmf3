import React, { useEffect, useState } from 'react';
import { EntityKindMeta } from '../../data/registries';
import {
  getOrLoadCustomAssetThumbnail,
  getOrQueueEntityThumbnail,
  getOrQueueHeroThumbnail,
  subscribeAssetThumbnails,
} from '../../three/assetThumbnailer';
import type { CustomAssetMeta, EntityKind, LevelEntity } from '../../types/maker';
import { MakerIcon } from './IconMap';

export interface AssetThumbnailProps {
  /** Built-in entity kind to preview as a 3D thumbnail */
  kind?: EntityKind;
  /** Optional entity instance (used for boss/platform/name variant hints) */
  entity?: Pick<LevelEntity, 'kind' | 'name' | 'isBoss' | 'platformPreset' | 'monsterConfig'>;
  /** Custom uploaded GLB asset metadata (takes precedence over built-in kind if present) */
  customAsset?: CustomAssetMeta | null;
  /** Hero rig appearance preview (takes precedence when no customAsset is provided) */
  hero?: {
    body: string;
    colors: { tunic: string; cloak: string; hair: string; skin: string };
  };
  /** Square pixel dimension */
  size?: number;
  /** Optional custom border-radius utility */
  rounded?: string;
  /** Optional additional container classes */
  className?: string;
  /** Accessible alt text */
  alt?: string;
}

export const AssetThumbnail: React.FC<AssetThumbnailProps> = ({
  kind,
  entity,
  customAsset,
  hero,
  size = 44,
  rounded = 'rounded-xl',
  className = '',
  alt,
}) => {
  const [, setTick] = useState(0);

  useEffect(() => {
    return subscribeAssetThumbnails(() => setTick((t) => t + 1));
  }, []);

  const resolvedKind: EntityKind | undefined = entity?.kind ?? kind;

  let dataUrl: string | undefined;
  if (customAsset) {
    dataUrl = getOrLoadCustomAssetThumbnail(
      customAsset.id,
      customAsset.category,
      customAsset.thumbnailDataUrl
    );
  } else if (hero) {
    dataUrl = getOrQueueHeroThumbnail(hero.body, hero.colors);
  } else if (resolvedKind) {
    dataUrl = getOrQueueEntityThumbnail(resolvedKind, {
      isBoss: entity?.isBoss,
      platformPreset: entity?.platformPreset,
      name: entity?.name,
      monsterConfig: entity?.monsterConfig,
    });
  }

  const meta = resolvedKind ? EntityKindMeta[resolvedKind] : null;
  const customFallbackTint =
    customAsset?.category === 'tree' || customAsset?.category === 'plant'
      ? '#20B46A'
      : customAsset?.category === 'building'
      ? '#F59E0B'
      : customAsset?.category === 'character'
      ? '#A855F7'
      : '#7C5CFF';
  const customFallbackSymbol =
    customAsset?.category === 'tree'
      ? 'tree.fill'
      : customAsset?.category === 'plant'
      ? 'leaf.fill'
      : customAsset?.category === 'building'
      ? 'house.fill'
      : customAsset?.category === 'character'
      ? 'figure.stand'
      : 'cube.fill';
  const fallbackTint = meta?.tint ?? customFallbackTint;
  const fallbackSymbol = hero
    ? 'figure.stand'
    : meta?.symbol ?? (customAsset ? customFallbackSymbol : 'cube.fill');
  const label = alt ?? customAsset?.name ?? entity?.name ?? (hero ? hero.body : meta?.title ?? 'Asset');

  return (
    <div
      style={{ width: size, height: size }}
      className={`relative shrink-0 overflow-hidden border border-slate-200/80 dark:border-white/[0.09] bg-gradient-to-b from-slate-100 to-slate-200/85 dark:from-[#252B3D] dark:to-[#171B26] flex items-center justify-center select-none ${rounded} ${className}`}
    >
      {dataUrl ? (
        <img
          src={dataUrl}
          alt={label}
          referrerPolicy="no-referrer"
          draggable={false}
          className="w-full h-full object-contain p-0.5 pointer-events-none"
        />
      ) : (
        <MakerIcon
          symbol={fallbackSymbol}
          size={Math.max(12, Math.round(size * 0.46))}
          color={fallbackTint}
        />
      )}
    </div>
  );
};
