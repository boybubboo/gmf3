import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Building2,
  Check,
  ChevronDown,
  ChevronLeft,
  Copy,
  Edit3,
  FolderUp,
  Grid3x3,
  Layers,
  LayoutGrid,
  Leaf,
  List,
  Plus,
  Search,
  Star,
  Trash2,
  Trees,
  User,
  Wrench,
  X,
} from 'lucide-react';
import type { MakerStore } from '../../store/useMakerStore';
import type { CustomAssetMeta } from '../../types/maker';
import { AssetThumbnail } from '../shared/AssetThumbnail';

export const MAKER_ASSET_DRAG_MIME = 'application/x-maker-asset-id';

export type AssetsPanelSectionId = 'all' | 'objects' | 'characters' | 'plants' | 'trees' | 'buildings';
export type AssetsViewMode = 'list' | 'grid3' | 'grid4';
export type AssetsSourceFilter = 'all' | 'procedural' | 'glb';

export interface LeftAssetsPanelProps {
  store: MakerStore;
  activePlacementAssetId: string | null;
  hideBuildingsSection?: boolean;
  onSelectPlacementAsset: (asset: CustomAssetMeta) => void;
  onEditAssetInObjectMaker: (assetId: string) => void;
  onEditAssetInPlantMaker?: (assetId: string) => void;
  onEditAssetInCharacterMaker?: (assetId: string) => void;
  onEditAssetInTreeMaker?: (assetId: string) => void;
  onCreateNewObject: () => void;
  onCreateNewPlant?: () => void;
  onCreateNewCharacter?: () => void;
  onCreateNewTree?: () => void;
  onCreateNewBuilding?: () => void;
  onSwitchToLevelPanel: () => void;
  onCollapseLeftPanel: () => void;
  embedded?: boolean;
}

interface SectionMeta {
  id: AssetsPanelSectionId;
  label: string;
  makerLabel: string;
  makerTitle: string;
  accentHex: string;
  Icon: React.FC<{ size?: number; className?: string }>;
  matches: (a: CustomAssetMeta) => boolean;
}

const SECTIONS: SectionMeta[] = [
  {
    id: 'all',
    label: 'All Categories',
    makerLabel: 'Object Maker',
    makerTitle: 'New in Object Maker',
    accentHex: '#7C5CFF',
    Icon: Layers,
    matches: () => true,
  },
  {
    id: 'objects',
    label: 'Objects',
    makerLabel: 'Object Maker',
    makerTitle: 'New in Object Maker',
    accentHex: '#7C5CFF',
    Icon: Box,
    matches: (a) => a.category === 'prop' || a.category === 'scenery',
  },
  {
    id: 'characters',
    label: 'Characters',
    makerLabel: 'Character Maker',
    makerTitle: 'New in Character Maker',
    accentHex: '#A855F7',
    Icon: User,
    matches: (a) => a.category === 'character',
  },
  {
    id: 'plants',
    label: 'Plants',
    makerLabel: 'Plant Maker',
    makerTitle: 'New in Plant Maker',
    accentHex: '#20B46A',
    Icon: Leaf,
    matches: (a) => a.category === 'plant',
  },
  {
    id: 'trees',
    label: 'Trees',
    makerLabel: 'Tree Maker',
    makerTitle: 'New in Tree Maker',
    accentHex: '#10B981',
    Icon: Trees,
    matches: (a) => a.category === 'tree',
  },
  {
    id: 'buildings',
    label: 'Buildings',
    makerLabel: 'Building Maker',
    makerTitle: 'New in Building Maker',
    accentHex: '#F59E0B',
    Icon: Building2,
    matches: (a) => a.category === 'building',
  },
];

export function isProceduralAsset(asset: CustomAssetMeta): boolean {
  return Boolean(
    asset.objectRecipe ||
      asset.characterRecipe ||
      asset.treeRecipe ||
      asset.buildingBlock
  );
}

export const LeftAssetsPanel: React.FC<LeftAssetsPanelProps> = ({
  store,
  activePlacementAssetId,
  hideBuildingsSection = false,
  onSelectPlacementAsset,
  onEditAssetInObjectMaker,
  onEditAssetInPlantMaker,
  onEditAssetInCharacterMaker,
  onEditAssetInTreeMaker,
  onCreateNewObject,
  onCreateNewPlant,
  onCreateNewCharacter,
  onCreateNewTree,
  onCreateNewBuilding,
  onSwitchToLevelPanel,
  onCollapseLeftPanel,
  embedded = false,
}) => {
  const [activeSection, setActiveSection] = useState<AssetsPanelSectionId>('all');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<AssetsSourceFilter>('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [viewMode, setViewMode] = useState<AssetsViewMode>('grid3');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(
    activePlacementAssetId ?? store.customAssets[0]?.id ?? null
  );
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const dropdownContainerRef = useRef<HTMLDivElement | null>(null);

  const visibleSections = useMemo(
    () => (hideBuildingsSection ? SECTIONS.filter((s) => s.id !== 'buildings') : SECTIONS),
    [hideBuildingsSection]
  );

  useEffect(() => {
    if (hideBuildingsSection && activeSection === 'buildings') {
      setActiveSection('all');
    }
  }, [hideBuildingsSection, activeSection]);

  useEffect(() => {
    if (activePlacementAssetId) {
      setSelectedAssetId(activePlacementAssetId);
    }
  }, [activePlacementAssetId]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (
        dropdownContainerRef.current &&
        !dropdownContainerRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDropdownOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [dropdownOpen]);

  const baseFilteredAssets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return store.customAssets.filter((a) => {
      if (hideBuildingsSection && a.category === 'building') return false;
      if (favoritesOnly && !a.favorite) return false;
      const proc = isProceduralAsset(a);
      if (sourceFilter === 'procedural' && !proc) return false;
      if (sourceFilter === 'glb' && proc) return false;
      if (!q) return true;
      return a.name.toLowerCase().includes(q) || a.category.toLowerCase().includes(q);
    });
  }, [store.customAssets, hideBuildingsSection, search, sourceFilter, favoritesOnly]);

  const sectionCounts = useMemo(() => {
    const counts: Record<AssetsPanelSectionId, number> = {
      all: baseFilteredAssets.length,
      objects: 0,
      characters: 0,
      plants: 0,
      trees: 0,
      buildings: 0,
    };
    for (const a of baseFilteredAssets) {
      for (const sec of visibleSections) {
        if (sec.id !== 'all' && sec.matches(a)) {
          counts[sec.id] += 1;
          break;
        }
      }
    }
    return counts;
  }, [baseFilteredAssets, visibleSections]);

  const activeSectionMeta = useMemo(
    () => visibleSections.find((s) => s.id === activeSection) ?? visibleSections[0],
    [activeSection, visibleSections]
  );

  const visibleAssets = useMemo(() => {
    if (activeSection === 'all') return baseFilteredAssets;
    return baseFilteredAssets.filter((a) => activeSectionMeta.matches(a));
  }, [baseFilteredAssets, activeSection, activeSectionMeta]);

  const selectedAsset = useMemo(
    () =>
      store.customAssets.find((a) => a.id === selectedAssetId) ??
      visibleAssets[0] ??
      null,
    [store.customAssets, visibleAssets, selectedAssetId]
  );

  const handleCreateInSection = (id: AssetsPanelSectionId) => {
    if (id === 'plants' && onCreateNewPlant) {
      onCreateNewPlant();
    } else if (id === 'characters' && onCreateNewCharacter) {
      onCreateNewCharacter();
    } else if (id === 'trees' && onCreateNewTree) {
      onCreateNewTree();
    } else if (id === 'buildings' && onCreateNewBuilding) {
      onCreateNewBuilding();
    } else {
      onCreateNewObject();
    }
  };

  const handleEditAsset = (asset: CustomAssetMeta) => {
    if (asset.category === 'plant' && onEditAssetInPlantMaker) {
      onEditAssetInPlantMaker(asset.id);
    } else if (asset.category === 'character' && onEditAssetInCharacterMaker) {
      onEditAssetInCharacterMaker(asset.id);
    } else if (asset.category === 'tree' && onEditAssetInTreeMaker) {
      onEditAssetInTreeMaker(asset.id);
    } else if (asset.buildingBlock && onCreateNewBuilding) {
      onCreateNewBuilding();
    } else {
      onEditAssetInObjectMaker(asset.id);
    }
  };

  const favoriteCount = useMemo(
    () => store.customAssets.filter((a) => Boolean(a.favorite)).length,
    [store.customAssets]
  );

  const hasActiveFilter = Boolean(search.trim() || sourceFilter !== 'all' || favoritesOnly);
  const ActiveSectionIcon = activeSectionMeta.Icon;

  const content = (
    <>
      {!embedded && (
        <div className="shrink-0 p-2 border-b border-slate-200/80 dark:border-white/[0.08] flex items-center gap-1.5 bg-slate-50/80 dark:bg-[#131720]">
          <div className="flex-1 grid grid-cols-2 gap-1 p-0.5 rounded-xl bg-slate-200/70 dark:bg-[#1C212E]">
            <button
              type="button"
              onClick={onSwitchToLevelPanel}
              className="py-1 px-2 rounded-lg text-[11px] font-bold text-slate-600 dark:text-[#9FA8BE] hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap"
            >
              Contents
            </button>
            <button
              type="button"
              className="py-1 px-2 rounded-lg text-[11px] font-extrabold bg-white dark:bg-[#272E3F] text-[#7C5CFF] dark:text-white shadow-xs whitespace-nowrap"
            >
              Assets ({store.customAssets.length})
            </button>
          </div>
          <button
            type="button"
            onClick={onCollapseLeftPanel}
            title="Hide left panel to expand viewport"
            aria-label="Hide left panel"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-[#949BB0] dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-[#1F2430]"
          >
            <ChevronLeft size={15} />
          </button>
        </div>
      )}

      {/* Category Dropdown Selector + Search + Source/Favorite/View Controls */}
      <div className="shrink-0 px-2.5 py-2 border-b border-slate-200/70 dark:border-white/[0.06] space-y-2">
        {/* Single Category Dropdown Menu + Quick Create Button */}
        <div ref={dropdownContainerRef} className="relative flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setDropdownOpen((o) => !o)}
            aria-expanded={dropdownOpen}
            aria-haspopup="listbox"
            className="flex-1 min-w-0 flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.09] hover:border-[#7C5CFF] transition-colors text-left"
          >
            <span className="flex items-center gap-2 min-w-0">
              <span
                className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: `${activeSectionMeta.accentHex}22`,
                  color: activeSectionMeta.accentHex,
                }}
              >
                <ActiveSectionIcon size={12} />
              </span>
              <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                {activeSectionMeta.label}
              </span>
              <span className="text-[10px] font-bold tabular-nums text-slate-500 dark:text-[#8E96AB] shrink-0">
                ({sectionCounts[activeSection]})
              </span>
            </span>
            <ChevronDown
              size={14}
              className={`text-slate-400 shrink-0 transition-transform ${
                dropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          <button
            type="button"
            onClick={() => handleCreateInSection(activeSection)}
            title={activeSectionMeta.makerTitle}
            aria-label={activeSectionMeta.makerTitle}
            className="p-2 rounded-xl text-white shadow-xs transition-opacity hover:opacity-90 shrink-0"
            style={{ backgroundColor: activeSectionMeta.accentHex }}
          >
            <Plus size={14} />
          </button>

          {dropdownOpen && (
            <div
              role="listbox"
              aria-label="Asset categories"
              className="absolute left-0 right-0 top-full mt-1.5 z-40 rounded-2xl bg-white dark:bg-[#191E2B] border border-slate-200/90 dark:border-white/[0.12] shadow-xl p-1.5 space-y-0.5"
            >
              {visibleSections.map((sec) => {
                const Icon = sec.Icon;
                const isActive = activeSection === sec.id;
                const count = sectionCounts[sec.id];
                return (
                  <button
                    key={sec.id}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => {
                      setActiveSection(sec.id);
                      setDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-left transition-colors ${
                      isActive
                        ? 'bg-[#7C5CFF]/14 text-slate-950 dark:text-white'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#23293A]'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: `${sec.accentHex}22`,
                          color: sec.accentHex,
                        }}
                      >
                        <Icon size={12} />
                      </span>
                      <span className="text-xs font-bold truncate">{sec.label}</span>
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[11px] font-semibold tabular-nums text-slate-400 dark:text-[#8E96AB]">
                        {count}
                      </span>
                      {isActive && <Check size={13} className="text-[#7C5CFF]" />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Search + Quick Import GLB */}
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1 min-w-0">
            <Search
              size={12}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${activeSection === 'all' ? 'assets' : activeSectionMeta.label.toLowerCase()}…`}
              className="w-full pl-7 pr-6 py-1.5 rounded-xl bg-slate-100 dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.08] text-[11px] font-semibold focus:outline-none focus:border-[#7C5CFF]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X size={11} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => store.setShowingAssetVault(true)}
            title="Import external GLB / GLTF model"
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1C212E] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-[#D5DCF0] hover:border-[#7C5CFF] text-[10px] font-bold shrink-0 whitespace-nowrap"
          >
            <FolderUp size={12} />
            <span>GLB</span>
          </button>
        </div>

        {/* Filter & View Mode Row */}
        <div className="flex items-center justify-between gap-1.5">
          {/* Source Filter: All / Procedural / GLB */}
          <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-[#12151E] border border-slate-200/70 dark:border-white/[0.06]">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'procedural', label: 'Proc' },
                { id: 'glb', label: 'GLB' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSourceFilter(opt.id)}
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold transition-colors whitespace-nowrap ${
                  sourceFilter === opt.id
                    ? 'bg-white dark:bg-[#272E3F] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-[#8E96AB] hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Favorites Filter */}
            <button
              type="button"
              onClick={() => setFavoritesOnly((f) => !f)}
              title={
                favoritesOnly
                  ? 'Show all assets'
                  : `Filter favorites (${favoriteCount})`
              }
              className={`inline-flex items-center gap-0.5 px-1.5 py-1 rounded-lg border text-[10px] font-bold transition-colors whitespace-nowrap ${
                favoritesOnly
                  ? 'bg-[#F59E0B]/18 border-[#F59E0B] text-[#D97706] dark:text-[#FBBF24]'
                  : 'bg-slate-100 dark:bg-[#12151E] border-slate-200/70 dark:border-white/[0.06] text-slate-500 dark:text-[#8E96AB] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Star size={11} className={favoritesOnly ? 'fill-current' : ''} />
              {favoriteCount > 0 && (
                <span className="tabular-nums">{favoriteCount}</span>
              )}
            </button>

            {/* View Mode: List | 3x Thumbnails | 4x Thumbnails */}
            <div
              className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-[#12151E] border border-slate-200/70 dark:border-white/[0.06]"
              title="Asset browser view mode"
            >
              <button
                type="button"
                onClick={() => setViewMode('list')}
                title="Detailed list view"
                aria-label="List view"
                className={`p-1 rounded-md transition-colors ${
                  viewMode === 'list'
                    ? 'bg-[#7C5CFF] text-white shadow-xs'
                    : 'text-slate-500 dark:text-[#8E96AB] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <List size={11} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid3')}
                title="Thumbnails only (3 per row)"
                aria-label="3 thumbnails per row"
                className={`px-1 py-0.5 rounded-md text-[9px] font-extrabold inline-flex items-center gap-0.5 transition-colors ${
                  viewMode === 'grid3'
                    ? 'bg-[#7C5CFF] text-white shadow-xs'
                    : 'text-slate-500 dark:text-[#8E96AB] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <LayoutGrid size={10} />
                <span>3×</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid4')}
                title="Thumbnails only (4 per row)"
                aria-label="4 thumbnails per row"
                className={`px-1 py-0.5 rounded-md text-[9px] font-extrabold inline-flex items-center gap-0.5 transition-colors ${
                  viewMode === 'grid4'
                    ? 'bg-[#7C5CFF] text-white shadow-xs'
                    : 'text-slate-500 dark:text-[#8E96AB] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Grid3x3 size={10} />
                <span>4×</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Assets Area (100% dedicated to the selected dropdown section) */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 maker-scroll">
        {visibleAssets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-white/[0.12] p-5 text-center space-y-2.5 my-1">
            <div
              className="mx-auto w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                backgroundColor: `${activeSectionMeta.accentHex}1F`,
                color: activeSectionMeta.accentHex,
              }}
            >
              <ActiveSectionIcon size={18} />
            </div>
            <div className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
              {hasActiveFilter
                ? 'No matching assets'
                : activeSection === 'all'
                ? 'No assets saved yet'
                : `No ${activeSectionMeta.label.toLowerCase()} yet`}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-[#8E96AB] leading-snug">
              {hasActiveFilter
                ? favoritesOnly
                  ? 'Star any asset using its favorite button to access it here.'
                  : 'Try clearing the search box or switching source filters.'
                : `Create one in ${activeSectionMeta.makerLabel} or import a GLB file.`}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-0.5">
              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setSourceFilter('all');
                    setFavoritesOnly(false);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-[#272E3F] text-slate-800 dark:text-white text-[11px] font-bold"
                >
                  Reset Filters
                </button>
              )}
              <button
                type="button"
                onClick={() => handleCreateInSection(activeSection)}
                className="px-3 py-1.5 rounded-xl text-white text-[11px] font-extrabold inline-flex items-center gap-1 shadow-xs"
                style={{ backgroundColor: activeSectionMeta.accentHex }}
              >
                <Plus size={12} />
                <span>Open {activeSectionMeta.makerLabel}</span>
              </button>
            </div>
          </div>
        ) : viewMode === 'list' ? (
          <div className="space-y-1.5">
            {visibleAssets.map((asset) => {
              const isSelected = selectedAsset?.id === asset.id;
              const isArmed = activePlacementAssetId === asset.id;
              const mechCount = asset.mechanisms?.length ?? 0;
              const proc = isProceduralAsset(asset);
              return (
                <div
                  key={asset.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(MAKER_ASSET_DRAG_MIME, asset.id);
                    e.dataTransfer.setData('text/plain', asset.name);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => {
                    setSelectedAssetId(asset.id);
                    setConfirmDeleteId(null);
                    onSelectPlacementAsset(asset);
                  }}
                  title={`${asset.name} — Drag into 3D viewport or click to select`}
                  className={`group flex items-center gap-2 p-1.5 rounded-xl border cursor-grab active:cursor-grabbing transition-all ${
                    isSelected || isArmed
                      ? 'border-[#7C5CFF] bg-[#7C5CFF]/12 ring-1 ring-[#7C5CFF]/30'
                      : 'border-slate-200/70 dark:border-white/[0.07] bg-slate-50/70 dark:bg-[#131720] hover:border-[#7C5CFF]/50'
                  }`}
                >
                  <AssetThumbnail customAsset={asset} size={40} rounded="rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-extrabold truncate text-slate-900 dark:text-white">
                      {asset.name}
                    </div>
                    <div className="text-[10px] font-semibold text-slate-500 dark:text-[#8E96AB] flex items-center gap-1 truncate tabular-nums">
                      <span className="capitalize">{asset.category}</span>
                      <span>·</span>
                      <span>{proc ? 'Proc' : 'GLB'}</span>
                      {mechCount > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[#F59E0B]">
                          · <Wrench size={9} /> {mechCount}
                        </span>
                      )}
                      {(asset.vertexPaintStrokes?.length ?? 0) > 0 && (
                        <span className="text-[#EC4899]">· Painted</span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      store.toggleFavoriteCustomAsset(asset.id);
                    }}
                    title={asset.favorite ? 'Remove favorite' : 'Favorite asset'}
                    className={`p-1 rounded-md transition-colors shrink-0 ${
                      asset.favorite
                        ? 'text-[#F59E0B]'
                        : 'text-slate-300 dark:text-[#555D74] hover:text-[#F59E0B]'
                    }`}
                  >
                    <Star size={11} className={asset.favorite ? 'fill-current' : ''} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          /* Pure Thumbnails-Only Grid (3x or 4x per row) */
          <div
            className={`grid gap-1.5 ${
              viewMode === 'grid4' ? 'grid-cols-4' : 'grid-cols-3'
            }`}
          >
            {visibleAssets.map((asset) => {
              const isSelected = selectedAsset?.id === asset.id;
              const isArmed = activePlacementAssetId === asset.id;
              return (
                <div
                  key={asset.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(MAKER_ASSET_DRAG_MIME, asset.id);
                    e.dataTransfer.setData('text/plain', asset.name);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => {
                    setSelectedAssetId(asset.id);
                    setConfirmDeleteId(null);
                    onSelectPlacementAsset(asset);
                  }}
                  title={`${asset.name} (${asset.category} · ${
                    isProceduralAsset(asset) ? 'Procedural' : 'GLB'
                  })`}
                  className={`relative aspect-square rounded-xl cursor-grab active:cursor-grabbing transition-all overflow-hidden ${
                    isSelected || isArmed
                      ? 'ring-2 ring-[#7C5CFF] border border-[#7C5CFF]'
                      : 'border border-slate-200/80 dark:border-white/[0.08] hover:border-[#7C5CFF]/65'
                  }`}
                >
                  <AssetThumbnail
                    customAsset={asset}
                    size={viewMode === 'grid4' ? 56 : 78}
                    rounded="rounded-xl"
                    className="!w-full !h-full !border-0"
                  />
                  {asset.favorite && (
                    <span
                      className="absolute top-1 right-1 w-4 h-4 rounded-md bg-black/55 text-[#FBBF24] flex items-center justify-center pointer-events-none"
                      aria-label="Favorite"
                    >
                      <Star size={9} className="fill-current" />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Asset Action Bar (Favorite / Edit / Duplicate / Delete) */}
      {selectedAsset && (
        <div className="shrink-0 px-2.5 py-2 border-t border-slate-200/80 dark:border-white/[0.08] bg-slate-50/90 dark:bg-[#131720] space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-extrabold truncate text-slate-900 dark:text-white">
                {selectedAsset.name}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-[#8E96AB] truncate tabular-nums">
                <span className="capitalize">{selectedAsset.category}</span>
                <span> · </span>
                <span>{isProceduralAsset(selectedAsset) ? 'Procedural' : 'GLB'}</span>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => store.toggleFavoriteCustomAsset(selectedAsset.id)}
                title={selectedAsset.favorite ? 'Remove favorite' : 'Favorite asset'}
                className={`p-1.5 rounded-lg border transition-colors ${
                  selectedAsset.favorite
                    ? 'bg-[#F59E0B]/15 border-[#F59E0B] text-[#F59E0B]'
                    : 'bg-white dark:bg-[#1C212E] border-slate-200/80 dark:border-white/[0.08] text-slate-500 hover:text-[#F59E0B]'
                }`}
              >
                <Star size={12} className={selectedAsset.favorite ? 'fill-current' : ''} />
              </button>

              <button
                type="button"
                onClick={() => handleEditAsset(selectedAsset)}
                title="Open in Maker editor"
                className="p-1.5 rounded-lg bg-white dark:bg-[#1C212E] border border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 hover:text-[#7C5CFF] hover:border-[#7C5CFF]"
              >
                <Edit3 size={12} />
              </button>

              <button
                type="button"
                onClick={async () => {
                  const copy = await store.duplicateCustomAsset(selectedAsset.id);
                  if (copy) {
                    setSelectedAssetId(copy.id);
                    onSelectPlacementAsset(copy);
                  }
                }}
                title="Duplicate selected asset"
                className="p-1.5 rounded-lg bg-white dark:bg-[#1C212E] border border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 hover:text-[#20B46A] hover:border-[#20B46A]"
              >
                <Copy size={12} />
              </button>

              {confirmDeleteId === selectedAsset.id ? (
                <button
                  type="button"
                  onMouseLeave={() => setConfirmDeleteId(null)}
                  onClick={async () => {
                    const idToRemove = selectedAsset.id;
                    setConfirmDeleteId(null);
                    await store.removeCustomAsset(idToRemove);
                    setSelectedAssetId(null);
                  }}
                  className="px-2 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[10px] font-extrabold whitespace-nowrap"
                >
                  Confirm
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(selectedAsset.id)}
                  title="Delete selected asset"
                  className="p-1.5 rounded-lg bg-white dark:bg-[#1C212E] border border-slate-200/80 dark:border-white/[0.08] text-slate-500 hover:text-red-500 hover:border-red-500/60"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer Tip */}
      <div className="shrink-0 px-2.5 py-1.5 border-t border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#131720] flex items-center justify-between gap-2 text-[10px] font-semibold text-slate-500 dark:text-[#8E96AB]">
        <span>Drag onto 3D viewport</span>
        <button
          type="button"
          onClick={() => store.setShowingAssetVault(true)}
          className="text-[#7C5CFF] hover:underline font-bold"
        >
          Asset Vault
        </button>
      </div>
    </>
  );

  if (embedded) {
    return <div className="flex-1 min-h-0 flex flex-col overflow-hidden">{content}</div>;
  }

  return (
    <aside className="w-[268px] xl:w-[292px] shrink-0 rounded-2xl bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.08] flex flex-col min-h-0 overflow-hidden shadow-xs">
      {content}
    </aside>
  );
};
