import type { ColorGradingPresetId, PostProcessingConfig } from '../types/maker';

export interface ColorGradingPresetMeta {
  id: ColorGradingPresetId;
  label: string;
  blurb: string;
  swatchA: string;
  swatchB: string;
  values: {
    exposure: number;
    contrast: number;
    saturation: number;
    temperature: number;
    tint: number;
    highlightsWarmth: number;
    shadowsCoolness: number;
    vignette: number;
  };
}

export const COLOR_GRADING_PRESETS: ColorGradingPresetMeta[] = [
  {
    id: 'neutral',
    label: 'Neutral',
    blurb: 'Balanced natural filmic colors',
    swatchA: '#CBD5E1',
    swatchB: '#64748B',
    values: {
      exposure: 1.0,
      contrast: 0.0,
      saturation: 0.0,
      temperature: 0.0,
      tint: 0.0,
      highlightsWarmth: 0.0,
      shadowsCoolness: 0.0,
      vignette: 0.0,
    },
  },
  {
    id: 'goldenHour',
    label: 'Golden Hour',
    blurb: 'Sun-drenched amber glow & warm skies',
    swatchA: '#FBBF24',
    swatchB: '#D97706',
    values: {
      exposure: 1.06,
      contrast: 0.1,
      saturation: 0.14,
      temperature: 0.36,
      tint: 0.06,
      highlightsWarmth: 0.28,
      shadowsCoolness: 0.08,
      vignette: 0.24,
    },
  },
  {
    id: 'cinematicTealOrange',
    label: 'Cinematic',
    blurb: 'Teal shadows with warm sunlit highlights',
    swatchA: '#0EA5E9',
    swatchB: '#F97316',
    values: {
      exposure: 1.02,
      contrast: 0.18,
      saturation: 0.08,
      temperature: 0.12,
      tint: -0.05,
      highlightsWarmth: 0.32,
      shadowsCoolness: 0.34,
      vignette: 0.32,
    },
  },
  {
    id: 'fairyMeadow',
    label: 'Fairy Tale',
    blurb: 'Vibrant emerald foliage & dreamy highlights',
    swatchA: '#4ADE80',
    swatchB: '#FDE047',
    values: {
      exposure: 1.08,
      contrast: 0.05,
      saturation: 0.24,
      temperature: 0.14,
      tint: -0.08,
      highlightsWarmth: 0.18,
      shadowsCoolness: 0.12,
      vignette: 0.18,
    },
  },
  {
    id: 'moonlitNoir',
    label: 'Moonlit',
    blurb: 'Cool twilight blues with atmospheric depth',
    swatchA: '#6366F1',
    swatchB: '#1E293B',
    values: {
      exposure: 0.94,
      contrast: 0.2,
      saturation: -0.14,
      temperature: -0.44,
      tint: 0.08,
      highlightsWarmth: -0.12,
      shadowsCoolness: 0.38,
      vignette: 0.42,
    },
  },
  {
    id: 'vintageFilm',
    label: 'Vintage Film',
    blurb: 'Nostalgic warm analog tones & soft fade',
    swatchA: '#EAB308',
    swatchB: '#78716C',
    values: {
      exposure: 1.02,
      contrast: -0.06,
      saturation: -0.22,
      temperature: 0.24,
      tint: 0.1,
      highlightsWarmth: 0.22,
      shadowsCoolness: -0.14,
      vignette: 0.38,
    },
  },
  {
    id: 'arcticCrisp',
    label: 'Arctic Crisp',
    blurb: 'Clean cool daylight & sparkling contrast',
    swatchA: '#BAE6FD',
    swatchB: '#38BDF8',
    values: {
      exposure: 1.08,
      contrast: 0.12,
      saturation: -0.06,
      temperature: -0.32,
      tint: -0.04,
      highlightsWarmth: -0.18,
      shadowsCoolness: 0.22,
      vignette: 0.14,
    },
  },
  {
    id: 'warmSunset',
    label: 'Warm Sunset',
    blurb: 'Rich magenta-copper dusk & dramatic glow',
    swatchA: '#F43F5E',
    swatchB: '#F59E0B',
    values: {
      exposure: 1.0,
      contrast: 0.16,
      saturation: 0.22,
      temperature: 0.46,
      tint: 0.22,
      highlightsWarmth: 0.36,
      shadowsCoolness: 0.18,
      vignette: 0.36,
    },
  },
  {
    id: 'noirMono',
    label: 'B&W Noir',
    blurb: 'High-contrast monochrome cinema with deep ink shadows',
    swatchA: '#F8FAFC',
    swatchB: '#18181B',
    values: {
      exposure: 1.02,
      contrast: 0.34,
      saturation: -1.0,
      temperature: -0.05,
      tint: 0.0,
      highlightsWarmth: 0.04,
      shadowsCoolness: 0.08,
      vignette: 0.52,
    },
  },
  {
    id: 'sepiaRelic',
    label: 'Sepia Cinema',
    blurb: 'Warm archival sepia tone with soft antique highlights',
    swatchA: '#D6B17E',
    swatchB: '#5C4028',
    values: {
      exposure: 1.03,
      contrast: 0.08,
      saturation: -0.68,
      temperature: 0.56,
      tint: 0.12,
      highlightsWarmth: 0.34,
      shadowsCoolness: -0.18,
      vignette: 0.42,
    },
  },
];

export function createDefaultPostProcessingConfig(): PostProcessingConfig {
  return {
    enabled: false,
    bloomEnabled: true,
    bloomIntensity: 0.48,
    bloomThreshold: 0.72,
    bloomRadius: 0.55,
    lensFlareEnabled: true,
    lensFlareIntensity: 0.65,
    lensFlareGhosts: 0.6,
    lensFlareHalo: 0.55,
    colorGradingEnabled: true,
    colorGradingPreset: 'goldenHour',
    exposure: 1.04,
    contrast: 0.08,
    saturation: 0.1,
    temperature: 0.14,
    tint: 0.02,
    highlightsWarmth: 0.16,
    shadowsCoolness: 0.1,
    vignetteEnabled: true,
    vignette: 0.2,
    vignetteSoftness: 0.55,
    ssrEnabled: false,
    ssrIntensity: 0.65,
    ssrMaxRoughness: 0.55,
    toneMapping: 'agx',
    gtaoEnabled: true,
    gtaoIntensity: 0.72,
    gtaoRadius: 0.85,
    godRaysEnabled: true,
    godRaysIntensity: 0.52,
    volumetricFogEnabled: true,
    volumetricFogDensity: 1.0,
    volumetricFogHeight: 2.2,
    volumetricFogSoftness: 8.5,
    volumetricFogSharpness: 0.3,
    volumetricFogNoise: 0.95,
    volumetricFogPatchiness: 0.45,
    volumetricFogSpeed: 0.75,
    atmosphericDust: 0.5,
    traaEnabled: false,
  };
}

export function resolvePostProcessingConfig(
  cfg?: Partial<PostProcessingConfig> | null
): PostProcessingConfig {
  const base = createDefaultPostProcessingConfig();
  if (!cfg) return base;
  const merged: PostProcessingConfig = {
    ...base,
    ...cfg,
  };
  if (cfg.vignetteEnabled === undefined) {
    merged.vignetteEnabled = (merged.vignette ?? 0) > 0.001;
  }
  if (cfg.vignetteSoftness === undefined) {
    merged.vignetteSoftness = 0.55;
  }
  if (cfg.ssrEnabled === undefined) {
    merged.ssrEnabled = false;
  }
  if (cfg.ssrIntensity === undefined) {
    merged.ssrIntensity = 0.65;
  }
  if (cfg.ssrMaxRoughness === undefined) {
    merged.ssrMaxRoughness = 0.55;
  }
  if (cfg.toneMapping === undefined) {
    merged.toneMapping = 'agx';
  }
  if (cfg.gtaoEnabled === undefined) {
    merged.gtaoEnabled = true;
  }
  if (cfg.gtaoIntensity === undefined) {
    merged.gtaoIntensity = 0.72;
  }
  if (cfg.gtaoRadius === undefined) {
    merged.gtaoRadius = 0.85;
  }
  if (cfg.godRaysEnabled === undefined) {
    merged.godRaysEnabled = true;
  }
  if (cfg.godRaysIntensity === undefined) {
    merged.godRaysIntensity = 0.52;
  }
  if (cfg.volumetricFogEnabled === undefined) {
    merged.volumetricFogEnabled = true;
  }
  if (cfg.volumetricFogDensity === undefined) {
    merged.volumetricFogDensity = 1.0;
  }
  if (cfg.volumetricFogHeight === undefined) {
    merged.volumetricFogHeight = 2.2;
  }
  if (cfg.volumetricFogSoftness === undefined) {
    merged.volumetricFogSoftness = 8.5;
  }
  if (cfg.volumetricFogSharpness === undefined) {
    merged.volumetricFogSharpness = 0.3;
  }
  if (cfg.volumetricFogNoise === undefined) {
    merged.volumetricFogNoise = 0.95;
  }
  if (cfg.volumetricFogPatchiness === undefined) {
    merged.volumetricFogPatchiness = 0.45;
  }
  if (cfg.volumetricFogSpeed === undefined) {
    merged.volumetricFogSpeed = 0.75;
  }
  if (cfg.atmosphericDust === undefined) {
    merged.atmosphericDust = 0.5;
  }
  if (cfg.traaEnabled === undefined) {
    merged.traaEnabled = false;
  }
  return merged;
}
