import React from 'react';
import { ArrowRight, ArrowUpRight, CloudSun, Compass, Lightbulb, Sparkles, X } from 'lucide-react';
import type { EnvironmentType, GameplayMode, WorldDomainId } from '../../types/maker';
import {
  type AtmosphereSectionId,
  useActiveGuidanceHint,
} from '../../utils/editorPrefs';
import type { LeftCreationTab } from './WorldLeftCreationPanel';

export interface WorldGuidanceBannerProps {
  visible: boolean;
  isWorldMapScope: boolean;
  hasWorldTerrain: boolean;
  landCount: number;
  firstLandName?: string;
  currentLandName: string;
  envType: EnvironmentType;
  gameplayMode?: GameplayMode;
  leftActiveTab: LeftCreationTab;
  activeWorldDomain: WorldDomainId;
  atmosphereSection: AtmosphereSectionId;
  onDismiss: () => void;
  onJumpToLands?: () => void;
}

const DOMAIN_OVERVIEW: Partial<Record<WorldDomainId, { badge: string; title: string; detail: string }>> = {
  mountains: {
    badge: 'Land Elements',
    title: 'Sculpting Mountains & Cliffs',
    detail: 'Drag across terrain to raise peaks, or pick Lower, Smooth, Flatten, or Snow/Rock brushes on the right.',
  },
  water: {
    badge: 'Land Elements',
    title: 'Adding Water & Rivers',
    detail: 'Click or drag on terrain to paint lakes and creeks. Tune water level, clarity, and ripples on the right.',
  },
  caves: {
    badge: 'Land Elements',
    title: 'Carving Walk-In Caves',
    detail: 'Click terrain points to trace a tunnel and double-click to carve. Set tunnel width and ceiling height on the right.',
  },
  grass: {
    badge: 'Land Elements',
    title: 'Painting Lush Grass',
    detail: 'Brush meadows across the ground, then adjust blade height, wind sway, density, and tint on the right.',
  },
  dirtRoads: {
    badge: 'Land Elements',
    title: 'Painting Dirt & Roads',
    detail: 'Brush dirt, trails, and stone paths onto the land or generate curved roads with border pebbles on the right.',
  },
  flora: {
    badge: 'Land Elements',
    title: 'Placing Flora & Rocks',
    detail: 'Brush trees, tiered boulders & pebbles, custom flowers, and plants onto your land from the right panel.',
  },
  particleFx: {
    badge: 'Land Elements',
    title: 'Placing Particle FX',
    detail: 'Pick or drag fireflies, embers, waterfalls, sparkles, and custom FX emitters from the right panel into your land.',
  },
  buildings: {
    badge: 'Land Elements',
    title: 'Building Structures',
    detail: 'Pick a wall, roof, arch, or door shape below, choose a material, and click in the 3D scene to snap pieces together.',
  },
  platformerKit: {
    badge: 'Platformer',
    title: 'Jump & Feel Tuning',
    detail: 'Pick animated mechanics on the left to drop in your course, or tune gravity, coyote time, and air-dash on the right.',
  },
};

const ATMOSPHERE_OVERVIEW: Record<AtmosphereSectionId, { title: string; detail: string }> = {
  skyTime: {
    title: 'Sky & Time of Day',
    detail: 'Pick a sky mood or drag the Sun Clock slider on the right to preview sunrise, golden hour, or night.',
  },
  fogMist: {
    title: 'Fog & Ground Mist',
    detail: 'Toggle Rolling Valley Mist on the right and adjust Edge Spread, Blur/Crispness, Noise, Patches, and Drift Speed.',
  },
  weatherWind: {
    title: 'Weather & Wind',
    detail: 'Choose Rain, Snow, Storm, or Clear sky on the right and slide Wind Strength to make trees and mist react.',
  },
  sunRays: {
    title: 'God Rays & Dust',
    detail: 'Turn on 3D Volumetric Light Shafts on the right and tune beam intensity and floating sunbeam dust motes.',
  },
  styleBiome: {
    title: 'Visual Style & Biome',
    detail: 'Switch between Painterly, Cel-Toon, or Soft Fantasy shading and pick a Biome color palette on the right.',
  },
  postFx: {
    title: 'Post FX & Lighting',
    detail: 'Adjust bloom glow, vignette, contrast, and saturation on the right to dial in your game’s final look.',
  },
  horizonVista: {
    title: '360° Horizon Vista',
    detail: 'Choose distant mountain ridges and horizon forests on the right, and tune mountain height, tree density, and distance.',
  },
};

export const WorldGuidanceBanner: React.FC<WorldGuidanceBannerProps> = ({
  visible,
  isWorldMapScope,
  hasWorldTerrain,
  landCount,
  firstLandName,
  currentLandName,
  envType,
  gameplayMode,
  leftActiveTab,
  activeWorldDomain,
  atmosphereSection,
  onDismiss,
  onJumpToLands,
}) => {
  const liveHint = useActiveGuidanceHint();

  if (!visible) return null;

  let badge = 'Guide';
  let title = '';
  let detail = '';
  let showScopeArrow = false;
  let ctaLabel: string | null = null;

  if (liveHint) {
    badge = liveHint.badge || 'Control Guide';
    title = liveHint.title;
    detail = liveHint.detail;
    if (isWorldMapScope && hasWorldTerrain) {
      showScopeArrow = true;
      ctaLabel = landCount > 0 ? `Open ${firstLandName || 'Land 1'}` : 'Create Land 1';
    }
  } else if (isWorldMapScope) {
    if (!hasWorldTerrain) {
      badge = 'World Map';
      title = 'Paint the geography of your world';
      detail =
        'Choose Paint Land on the left and brush across the blue ocean to draw continents and islands.';
    } else {
      badge = 'World Map';
      title = 'Assign individual lands by color';
      detail =
        'Create or pick a color-coded Land on the left to paint territories, or use the World Map menu above to edit inside a Land.';
      showScopeArrow = true;
      ctaLabel = landCount > 0 ? `Open ${firstLandName || 'Land 1'}` : 'Create Land 1';
    }
  } else if (leftActiveTab === 'atmosphere' || activeWorldDomain === 'atmosphere') {
    const info = ATMOSPHERE_OVERVIEW[atmosphereSection];
    badge = 'Atmosphere';
    title = info.title;
    detail = info.detail;
  } else if (leftActiveTab === 'props') {
    badge = 'Props & Cast';
    title = `Populating ${currentLandName}`;
    detail =
      'Drag any character, creature, tree, or prop from the left and drop it anywhere in the 3D scene — or inspect Scene Contents.';
  } else if (activeWorldDomain !== 'select' && DOMAIN_OVERVIEW[activeWorldDomain]) {
    const info = DOMAIN_OVERVIEW[activeWorldDomain]!;
    badge = info.badge;
    title = info.title;
    detail = info.detail;
  } else if (envType === 'sideScroller') {
    badge = 'Platformer Kit';
    title = 'Build your side-scrolling course';
    detail =
      'Hover any animated tile on the left to preview its motion, then drag it into your level or click anywhere to place.';
  } else if (gameplayMode === 'driving') {
    badge = 'Garage & Track';
    title = 'Customize your car & stunt track';
    detail =
      'Pick chassis and drift physics on the left, drop boost pads and ramps, and press Play to test drive.';
  } else if (envType === 'openWorld') {
    badge = 'Land Elements';
    title = `Forming ${currentLandName}`;
    detail =
      'Select Mountains, Water, Caves, Grass, Dirt & Roads, Flora, or Buildings on the left, then tune its controls on the right.';
  } else {
    badge = 'Level Kit';
    title = `Building ${currentLandName}`;
    detail =
      'Choose structural pieces, Props & Cast, or Atmosphere on the left, and adjust any selected item on the right.';
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="shrink-0 flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl bg-white dark:bg-[#171B26] border border-[#6366F1]/25 dark:border-[#6366F1]/35 shadow-xs"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="w-7 h-7 rounded-lg bg-[#6366F1]/12 text-[#4F46E5] dark:text-[#A5B4FC] flex items-center justify-center shrink-0">
          {showScopeArrow ? (
            <Compass size={15} />
          ) : leftActiveTab === 'atmosphere' || activeWorldDomain === 'atmosphere' ? (
            <CloudSun size={15} />
          ) : (
            <Lightbulb size={15} />
          )}
        </span>
        <div className="min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[11px] font-bold text-[#4F46E5] dark:text-[#A5B4FC] whitespace-nowrap">
            {badge}
          </span>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
            ·
          </span>
          <span className="text-xs font-extrabold text-slate-900 dark:text-white whitespace-nowrap">
            {title}
          </span>
          <span className="text-xs text-slate-600 dark:text-[#A3ACC2] truncate max-w-[66ch]">
            {detail}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {showScopeArrow && onJumpToLands && (
          <button
            type="button"
            onClick={onJumpToLands}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-bold transition-colors whitespace-nowrap"
          >
            <Sparkles size={12} />
            <span>{ctaLabel}</span>
            <ArrowRight size={12} />
          </button>
        )}
        {showScopeArrow && (
          <span
            className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-[#4F46E5] dark:text-[#A5B4FC] whitespace-nowrap"
            title="Look at the World Map dropdown above"
          >
            <span>Look up right</span>
            <ArrowUpRight size={14} className="animate-bounce" />
          </span>
        )}
        <button
          type="button"
          onClick={onDismiss}
          title="Hide hints (turn back on anytime via Hints or Settings)"
          aria-label="Hide hints"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
