import type {
  GameLevel,
  ProceduralNoiseKind,
  ProceduralNoiseLayerConfig,
  ProceduralTerrainConfig,
  ProceduralTerrainPresetId,
  TerrainBrush,
  TerrainBrushFalloff,
  TerrainBrushOptions,
  TerrainData,
} from '../types/maker';
import { runTerrainErosion } from '../three/terrainErosion';

export interface ProtectedTerrainAnchor {
  x: number;
  z: number;
  radius: number;
  blendRadius: number;
  targetHeight?: number;
}

export interface ProceduralPresetMeta {
  id: ProceduralTerrainPresetId;
  label: string;
  desc: string;
  accent: string;
  config: ProceduralTerrainConfig;
}

function quintic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * c * (c * (c * 6 - 15) + 10);
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Deterministic 2D integer-grid hash returning a reproducible pseudo-random float in [0, 1).
 */
function hash2(ix: number, iz: number, seed: number): number {
  let h = (ix * 374761393 + iz * 668265263 + seed * 1442695041) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

/**
 * Smooth 2D gradient noise in [-1, 1] with quintic C2 interpolation (zero grid faceting).
 */
export function gradientNoise2D(x: number, z: number, seed = 1337): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;

  const ux = quintic(fx);
  const uz = quintic(fz);

  const grad = (gx: number, gz: number, dx: number, dz: number): number => {
    const a = hash2(gx, gz, seed) * Math.PI * 2;
    return Math.cos(a) * dx + Math.sin(a) * dz;
  };

  const n00 = grad(ix, iz, fx, fz);
  const n10 = grad(ix + 1, iz, fx - 1, fz);
  const n01 = grad(ix, iz + 1, fx, fz - 1);
  const n11 = grad(ix + 1, iz + 1, fx - 1, fz - 1);

  const nx0 = n00 + (n10 - n00) * ux;
  const nx1 = n01 + (n11 - n01) * ux;
  return clamp((nx0 + (nx1 - nx0) * uz) * 1.414, -1, 1);
}

export function fbm2D(
  x: number,
  z: number,
  seed: number,
  octaves = 4,
  lacunarity = 2.04,
  gain = 0.5
): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    // Rotate domain slightly per octave to break axis alignment
    const rx = x * freq * 0.866 - z * freq * 0.5;
    const rz = x * freq * 0.5 + z * freq * 0.866;
    sum += amp * (gradientNoise2D(rx, rz, seed + i * 97) * 0.5 + 0.5);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return norm > 0 ? sum / norm : 0.5;
}

/**
 * Ridged multifractal synthesis inspired by Musgrave / ZyFou GPU mountain layers:
 * produces crisp asymmetric crests and V-shaped alpine valleys.
 */
export function ridgedMultifractal2D(
  x: number,
  z: number,
  seed: number,
  octaves = 5,
  lacunarity = 2.12,
  gain = 0.55
): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let weight = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const rx = x * freq * 0.8 - z * freq * 0.6;
    const rz = x * freq * 0.6 + z * freq * 0.8;
    let signal = 1.0 - Math.abs(gradientNoise2D(rx, rz, seed + i * 131));
    signal *= signal;
    signal *= weight;
    weight = clamp(signal * 1.85, 0.15, 1.0);
    sum += signal * amp;
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return norm > 0 ? clamp(sum / norm, 0, 1) : 0;
}

export function domainWarpedFbm2D(
  x: number,
  z: number,
  seed: number,
  warpStrength = 0.9,
  octaves = 4,
  lacunarity = 2.06,
  gain = 0.5
): number {
  const qx = fbm2D(x + 1.7, z + 9.2, seed + 19, 3, lacunarity, 0.5);
  const qz = fbm2D(x + 8.3, z + 2.8, seed + 53, 3, lacunarity, 0.5);
  const wx = x + (qx - 0.5) * 3.2 * warpStrength;
  const wz = z + (qz - 0.5) * 3.2 * warpStrength;
  const rx = fbm2D(wx + 4.1, wz + 1.3, seed + 89, 2, lacunarity, 0.5);
  const rz = fbm2D(wx + 2.7, wz + 6.9, seed + 149, 2, lacunarity, 0.5);
  return fbm2D(
    x + (rx - 0.5) * 3.6 * warpStrength,
    z + (rz - 0.5) * 3.6 * warpStrength,
    seed + 211,
    octaves,
    lacunarity,
    gain
  );
}

export function terracedMesa2D(
  x: number,
  z: number,
  seed: number,
  steps = 6,
  octaves = 4,
  warpStrength = 0.45
): number {
  const base = domainWarpedFbm2D(x, z, seed, warpStrength, octaves, 2.02, 0.5);
  const clampedSteps = Math.max(2, Math.round(steps));
  const scaled = base * clampedSteps;
  const floorStep = Math.floor(scaled);
  const frac = scaled - floorStep;
  // Crisp plateau shelves separated by steep stratified rock risers
  const smoothRiser = quintic(clamp((frac - 0.62) / 0.38, 0, 1));
  return clamp((floorStep + smoothRiser) / clampedSteps, 0, 1);
}

export function billow2D(
  x: number,
  z: number,
  seed: number,
  octaves = 4,
  lacunarity = 2.0,
  gain = 0.5
): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = Math.abs(gradientNoise2D(x * freq, z * freq, seed + i * 71));
    sum += amp * n;
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return norm > 0 ? clamp(sum / norm, 0, 1) : 0;
}

export function createNoiseLayer(
  id: string,
  name: string,
  kind: ProceduralNoiseKind,
  overrides?: Partial<ProceduralNoiseLayerConfig>
): ProceduralNoiseLayerConfig {
  return {
    id,
    name,
    enabled: true,
    kind,
    frequency: 1.2,
    amplitude: 6.5,
    octaves: 4,
    lacunarity: 2.08,
    gain: 0.52,
    warpStrength: 0.75,
    terraceSteps: 5,
    weight: 1.0,
    ...overrides,
  };
}

export const PROCEDURAL_TERRAIN_PRESETS: ProceduralPresetMeta[] = [
  {
    id: 'nottinghamHighlands',
    label: 'Nottingham Highlands',
    desc: 'Lush rolling glades framed by craggy cliff spurs',
    accent: '#20B46A',
    config: {
      presetId: 'nottinghamHighlands',
      seed: 4208,
      cliffSlopeThreshold: 0.44,
      autoSlopeBlend: 0.85,
      triplanarStrength: 0.92,
      microNormalStrength: 0.82,
      curvatureMoss: 0.76,
      erosionStrength: 0.48,
      preserveSettlements: true,
      islandFalloff: 0.82,
      noiseLayers: [
        createNoiseLayer('nh-base', 'Rolling Glades', 'domainWarped', {
          frequency: 0.95,
          amplitude: 5.2,
          octaves: 4,
          warpStrength: 0.85,
          weight: 0.9,
        }),
        createNoiseLayer('nh-ridge', 'Forest Crag Spurs', 'ridgedMultifractal', {
          frequency: 1.35,
          amplitude: 8.6,
          octaves: 5,
          gain: 0.56,
          weight: 0.72,
        }),
        createNoiseLayer('nh-detail', 'Micro Undulation', 'simplexFbm', {
          frequency: 3.2,
          amplitude: 1.2,
          octaves: 3,
          weight: 0.55,
        }),
      ],
    },
  },
  {
    id: 'alpineCrags',
    label: 'Alpine Crags',
    desc: 'Sharp ridged peaks, glacial passes & rocky spires',
    accent: '#38BDF8',
    config: {
      presetId: 'alpineCrags',
      seed: 7719,
      cliffSlopeThreshold: 0.36,
      autoSlopeBlend: 0.96,
      triplanarStrength: 1.15,
      microNormalStrength: 0.95,
      curvatureMoss: 0.45,
      erosionStrength: 0.68,
      preserveSettlements: true,
      islandFalloff: 0.85,
      noiseLayers: [
        createNoiseLayer('ac-massif', 'Alpine Massif', 'ridgedMultifractal', {
          frequency: 1.05,
          amplitude: 14.5,
          octaves: 5,
          lacunarity: 2.15,
          gain: 0.58,
          weight: 1.1,
        }),
        createNoiseLayer('ac-warp', 'Folded Foothills', 'domainWarped', {
          frequency: 1.65,
          amplitude: 4.8,
          octaves: 4,
          warpStrength: 1.05,
          weight: 0.65,
        }),
      ],
    },
  },
  {
    id: 'terracedCanyon',
    label: 'Terraced Mesas',
    desc: 'Stratified flat-top rock shelves & canyon ledges',
    accent: '#F59E0B',
    config: {
      presetId: 'terracedCanyon',
      seed: 2915,
      cliffSlopeThreshold: 0.38,
      autoSlopeBlend: 0.92,
      triplanarStrength: 1.2,
      microNormalStrength: 0.88,
      curvatureMoss: 0.52,
      erosionStrength: 0.55,
      preserveSettlements: true,
      islandFalloff: 0.78,
      noiseLayers: [
        createNoiseLayer('tc-steps', 'Limestone Shelves', 'terracedMesa', {
          frequency: 1.15,
          amplitude: 12.2,
          octaves: 4,
          terraceSteps: 6,
          warpStrength: 0.65,
          weight: 1.05,
        }),
        createNoiseLayer('tc-billow', 'Bench Outcrops', 'billowCrags', {
          frequency: 2.1,
          amplitude: 2.6,
          octaves: 3,
          weight: 0.5,
        }),
      ],
    },
  },
  {
    id: 'riverGorge',
    label: 'River Gorge',
    desc: 'Sculpted valley basins carved between high ridges',
    accent: '#0EA5E9',
    config: {
      presetId: 'riverGorge',
      seed: 6104,
      cliffSlopeThreshold: 0.4,
      autoSlopeBlend: 0.9,
      triplanarStrength: 1.05,
      microNormalStrength: 0.86,
      curvatureMoss: 0.88,
      erosionStrength: 0.82,
      preserveSettlements: true,
      islandFalloff: 0.8,
      noiseLayers: [
        createNoiseLayer('rg-warp', 'Valley Carve', 'domainWarped', {
          frequency: 0.85,
          amplitude: 7.4,
          octaves: 4,
          warpStrength: 1.25,
          weight: 0.95,
        }),
        createNoiseLayer('rg-rim', 'Gorge Escarpment', 'ridgedMultifractal', {
          frequency: 1.55,
          amplitude: 9.8,
          octaves: 4,
          weight: 0.75,
        }),
      ],
    },
  },
  {
    id: 'volcanicCaldera',
    label: 'Volcanic Caldera',
    desc: 'Dramatic basalt rim wall & sunken inner basin',
    accent: '#EF4444',
    config: {
      presetId: 'volcanicCaldera',
      seed: 9031,
      cliffSlopeThreshold: 0.35,
      autoSlopeBlend: 0.94,
      triplanarStrength: 1.25,
      microNormalStrength: 1.0,
      curvatureMoss: 0.35,
      erosionStrength: 0.62,
      preserveSettlements: true,
      islandFalloff: 0.88,
      noiseLayers: [
        createNoiseLayer('vc-rim', 'Basalt Rim', 'ridgedMultifractal', {
          frequency: 1.3,
          amplitude: 13.0,
          octaves: 5,
          weight: 1.0,
        }),
        createNoiseLayer('vc-terr', 'Lava Flows', 'terracedMesa', {
          frequency: 1.9,
          amplitude: 4.4,
          octaves: 3,
          terraceSteps: 5,
          warpStrength: 0.95,
          weight: 0.65,
        }),
      ],
    },
  },
];

export function createDefaultProceduralConfig(
  presetId: ProceduralTerrainPresetId = 'nottinghamHighlands'
): ProceduralTerrainConfig {
  const found =
    PROCEDURAL_TERRAIN_PRESETS.find((p) => p.id === presetId) ?? PROCEDURAL_TERRAIN_PRESETS[0];
  return {
    ...found.config,
    noiseLayers: found.config.noiseLayers.map((l) => ({ ...l })),
  };
}

export function normalizeProceduralConfig(
  cfg?: Partial<ProceduralTerrainConfig> | null
): ProceduralTerrainConfig {
  const def = createDefaultProceduralConfig(cfg?.presetId ?? 'nottinghamHighlands');
  if (!cfg) return def;
  const layers =
    Array.isArray(cfg.noiseLayers) && cfg.noiseLayers.length > 0
      ? cfg.noiseLayers.map((l, i) => ({
          ...createNoiseLayer(`layer-${i}`, l.name || `Layer ${i + 1}`, l.kind || 'simplexFbm'),
          ...l,
        }))
      : def.noiseLayers;
  return {
    presetId: cfg.presetId ?? def.presetId,
    seed: Number.isFinite(cfg.seed) ? Math.round(cfg.seed as number) : def.seed,
    cliffSlopeThreshold: clamp(cfg.cliffSlopeThreshold ?? def.cliffSlopeThreshold, 0.18, 0.88),
    autoSlopeBlend: clamp(cfg.autoSlopeBlend ?? def.autoSlopeBlend, 0, 1),
    triplanarStrength: clamp(cfg.triplanarStrength ?? def.triplanarStrength, 0, 1.5),
    microNormalStrength: clamp(cfg.microNormalStrength ?? def.microNormalStrength, 0, 1.5),
    curvatureMoss: clamp(cfg.curvatureMoss ?? def.curvatureMoss, 0, 1.25),
    erosionStrength: clamp(cfg.erosionStrength ?? def.erosionStrength, 0, 1),
    preserveSettlements: cfg.preserveSettlements ?? def.preserveSettlements,
    islandFalloff: clamp(cfg.islandFalloff ?? def.islandFalloff, 0, 1),
    noiseLayers: layers,
  };
}

export function evaluateProceduralNoiseLayer(
  layer: ProceduralNoiseLayerConfig,
  x: number,
  z: number,
  seed: number,
  layerIndex = 0
): number {
  if (!layer.enabled || layer.weight <= 0 || layer.amplitude === 0) return 0;
  const freq = Math.max(0.1, layer.frequency) * 0.01;
  const sx = x * freq;
  const sz = z * freq;
  const layerSeed = seed + layerIndex * 1013;
  const oct = Math.max(1, Math.min(6, Math.round(layer.octaves)));

  let n = 0.5;
  switch (layer.kind) {
    case 'ridgedMultifractal':
      n = ridgedMultifractal2D(sx, sz, layerSeed, oct, layer.lacunarity, layer.gain);
      break;
    case 'domainWarped':
      n = domainWarpedFbm2D(
        sx,
        sz,
        layerSeed,
        layer.warpStrength,
        oct,
        layer.lacunarity,
        layer.gain
      );
      break;
    case 'terracedMesa':
      n = terracedMesa2D(sx, sz, layerSeed, layer.terraceSteps, oct, layer.warpStrength);
      break;
    case 'billowCrags':
      n = billow2D(sx, sz, layerSeed, oct, layer.lacunarity, layer.gain);
      break;
    case 'simplexFbm':
    default:
      n = fbm2D(sx, sz, layerSeed, oct, layer.lacunarity, layer.gain);
      break;
  }

  return (n - 0.28) * layer.amplitude * layer.weight;
}

export function evaluateProceduralStackHeight(
  cfg: ProceduralTerrainConfig,
  x: number,
  z: number,
  worldRadius: number,
  freeformWorld: boolean
): number {
  let h = 1.05;
  for (let i = 0; i < cfg.noiseLayers.length; i++) {
    h += evaluateProceduralNoiseLayer(cfg.noiseLayers[i], x, z, cfg.seed, i);
  }

  if (cfg.presetId === 'volcanicCaldera') {
    const rNorm = Math.hypot(x, z) / Math.max(24, worldRadius * 0.62);
    const rim = Math.exp(-Math.pow((rNorm - 0.52) / 0.19, 2)) * 9.5;
    const basin = rNorm < 0.34 ? (1 - quintic(rNorm / 0.34)) * 6.2 : 0;
    h += rim - basin;
  } else if (cfg.presetId === 'riverGorge') {
    const riverZ = Math.sin(x * 0.032 + cfg.seed * 0.001) * 32;
    const dRiver = Math.abs(z - riverZ);
    const carve = (1 - quintic(clamp((dRiver - 5) / 26, 0, 1))) * 6.5;
    h -= carve;
  }

  // Smooth island coastal falloff so beaches & cliffs meet the sea cleanly
  if (!freeformWorld && cfg.islandFalloff > 0.01) {
    const dist = Math.hypot(x, z);
    const startDrop = worldRadius * (0.68 + (1 - cfg.islandFalloff) * 0.22);
    const endDrop = worldRadius * 1.04;
    if (dist > startDrop) {
      const t = quintic(clamp((dist - startDrop) / Math.max(1, endDrop - startDrop), 0, 1));
      const coastY = dist > worldRadius * 0.99 ? -4.8 : -2.35;
      h = h * (1 - t) + coastY * t;
    }
  }

  return clamp(h, -4.8, 24.0);
}

function packWeather(moss: number, cracks: number, scorch: number, mud: number, frost: number): number {
  const m = Math.max(0, Math.min(63, Math.round(moss * 63)));
  const c = Math.max(0, Math.min(63, Math.round(cracks * 63)));
  const s = Math.max(0, Math.min(63, Math.round(scorch * 63)));
  const d = Math.max(0, Math.min(63, Math.round(mud * 63)));
  const f = Math.max(0, Math.min(63, Math.round(frost * 63)));
  return m | (c << 6) | (s << 12) | (d << 18) | (f << 24);
}

function unpackWeather(packed: number | undefined) {
  if (!packed) return { moss: 0, cracks: 0, scorch: 0, mud: 0, frost: 0 };
  return {
    moss: (packed & 63) / 63,
    cracks: ((packed >>> 6) & 63) / 63,
    scorch: ((packed >>> 12) & 63) / 63,
    mud: ((packed >>> 18) & 63) / 63,
    frost: ((packed >>> 24) & 63) / 63,
  };
}

/**
 * Fast slope + thermal/hydraulic erosion solver over a rectangular grid slice:
 * carves V-shaped rainwater gullies down steep slopes and settles sediment in hollows.
 */
function runThermalHydraulicErosionPass(
  heights: number[],
  width: number,
  rowMin: number,
  rowMax: number,
  colMin: number,
  colMax: number,
  step: number,
  strength: number,
  protectionWeights?: Float32Array
): void {
  if (strength <= 0.01) return;
  const iterations = Math.max(1, Math.min(4, Math.round(1 + strength * 3)));
  const talus = 0.58 * step;
  const maxRowIdx = width - 1;
  const delta = new Float32Array(heights.length);

  for (let it = 0; it < iterations; it++) {
    delta.fill(0);
    for (let r = Math.max(1, rowMin); r <= Math.min(maxRowIdx - 1, rowMax); r++) {
      const rowOff = r * width;
      for (let c = Math.max(1, colMin); c <= Math.min(maxRowIdx - 1, colMax); c++) {
        const idx = rowOff + c;
        const prot = protectionWeights ? protectionWeights[idx] : 0;
        if (prot > 0.95) continue;

        const h = heights[idx];
        const nIdx = [idx - 1, idx + 1, idx - width, idx + width];
        let maxDrop = 0;
        let lowestNeighbor = -1;
        let sumDrop = 0;

        for (let k = 0; k < 4; k++) {
          const drop = h - heights[nIdx[k]];
          if (drop > talus) {
            sumDrop += drop - talus;
            if (drop > maxDrop) {
              maxDrop = drop;
              lowestNeighbor = nIdx[k];
            }
          }
        }

        if (lowestNeighbor >= 0 && maxDrop > talus) {
          const move = Math.min(maxDrop - talus, sumDrop * 0.25) * 0.42 * strength * (1 - prot);
          delta[idx] -= move;
          delta[lowestNeighbor] += move * 0.86;
        }
      }
    }

    for (let i = 0; i < heights.length; i++) {
      if (delta[i] !== 0) {
        heights[i] = clamp(heights[i] + delta[i], -4.8, 24);
      }
    }
  }
}

export function buildSettlementProtectionWeights(
  size: number,
  worldRadius: number,
  anchors: ProtectedTerrainAnchor[]
): Float32Array {
  const width = size + 1;
  const weights = new Float32Array(width * width);
  if (anchors.length === 0) return weights;
  const step = (2 * worldRadius) / size;

  for (let r = 0; r <= size; r++) {
    const vz = -worldRadius + r * step;
    const rowOff = r * width;
    for (let c = 0; c <= size; c++) {
      const vx = -worldRadius + c * step;
      let maxW = 0;
      for (let i = 0; i < anchors.length; i++) {
        const a = anchors[i];
        const d = Math.hypot(vx - a.x, vz - a.z);
        if (d <= a.radius) {
          maxW = 1;
          break;
        }
        if (d < a.radius + a.blendRadius) {
          const t = 1 - quintic((d - a.radius) / Math.max(0.01, a.blendRadius));
          if (t > maxW) maxW = t;
        }
      }
      weights[rowOff + c] = maxW;
    }
  }
  return weights;
}

export function collectLevelProtectedAnchors(
  level: Partial<GameLevel> | null | undefined,
  worldRadius: number
): ProtectedTerrainAnchor[] {
  const anchors: ProtectedTerrainAnchor[] = [];
  if (!level) return anchors;

  // Preserve Hero Spawn & Portal pads
  if (level.startPoint) {
    anchors.push({
      x: (level.startPoint.x - 0.5) * 2 * worldRadius,
      z: (level.startPoint.y - 0.5) * 2 * worldRadius,
      radius: 8,
      blendRadius: 10,
    });
  }
  if (level.portalPoint) {
    anchors.push({
      x: (level.portalPoint.x - 0.5) * 2 * worldRadius,
      z: (level.portalPoint.y - 0.5) * 2 * worldRadius,
      radius: 7,
      blendRadius: 9,
    });
  }

  // Preserve Buildings, Bridges & Landmark Props
  for (const ent of level.entities ?? []) {
    if (ent.kind !== 'prop' && !ent.buildingBlock) continue;
    const wx = (ent.position.x - 0.5) * 2 * worldRadius;
    const wz = (ent.position.y - 0.5) * 2 * worldRadius;
    const lower = `${ent.name ?? ''} ${ent.notes ?? ''}`.toLowerCase();
    const isMajor =
      Boolean(ent.buildingBlock) ||
      lower.includes('tavern') ||
      lower.includes('inn') ||
      lower.includes('blacksmith') ||
      lower.includes('temple') ||
      lower.includes('shrine') ||
      lower.includes('cottage') ||
      lower.includes('castle') ||
      lower.includes('bridge') ||
      ent.propPreset === 'tavern' ||
      ent.propPreset === 'cottage';
    if (isMajor) {
      const s = Math.max(0.7, ent.scale ?? 1);
      anchors.push({
        x: wx,
        z: wz,
        radius: ent.buildingBlock ? 6.5 * s : 10.5 * s,
        blendRadius: ent.buildingBlock ? 8 * s : 12 * s,
      });
    }
  }

  // Preserve Cave grottos & portals
  for (const cave of level.terrain?.caves ?? []) {
    anchors.push({
      x: cave.x,
      z: cave.z,
      radius: 14 * (cave.scale ?? 1),
      blendRadius: 14,
    });
  }

  // Preserve authored roads
  for (const road of level.terrain?.roads ?? []) {
    for (let i = 0; i < road.points.length; i += 2) {
      const pt = road.points[i];
      anchors.push({
        x: pt[0],
        z: pt[1],
        radius: Math.max(4, road.width * 1.4),
        blendRadius: 8,
      });
    }
  }

  return anchors;
}

/**
 * Generates or regenerates terrain using the layered ZyFou/ProceduralTerrains noise stack,
 * thermal/hydraulic erosion, protected settlement/cave blending, and automatic slope/curvature biome painting.
 */
export function generateProceduralTerrainFromConfig(
  rawTerrain: TerrainData,
  rawCfg?: Partial<ProceduralTerrainConfig> | null,
  levelForAnchors?: Partial<GameLevel> | null
): TerrainData {
  const cfg = normalizeProceduralConfig(rawCfg ?? rawTerrain.proceduralConfig);
  const size = rawTerrain.size;
  const width = size + 1;
  const worldRadius = rawTerrain.worldRadius && rawTerrain.worldRadius > 0 ? rawTerrain.worldRadius : 156;
  const step = (2 * worldRadius) / size;
  const isFreeform = Boolean(rawTerrain.freeformWorld);

  const anchors = cfg.preserveSettlements
    ? collectLevelProtectedAnchors({ ...levelForAnchors, terrain: rawTerrain }, worldRadius)
    : [];
  const protectionWeights = buildSettlementProtectionWeights(size, worldRadius, anchors);

  const nextHeights = new Array<number>(width * width);
  const nextLayers = [...rawTerrain.layers];
  const nextWeather =
    rawTerrain.weathering && rawTerrain.weathering.length === width * width
      ? [...rawTerrain.weathering]
      : new Array<number>(width * width).fill(0);

  for (let r = 0; r <= size; r++) {
    const vz = -worldRadius + r * step;
    const rowOff = r * width;
    for (let c = 0; c <= size; c++) {
      const vx = -worldRadius + c * step;
      const idx = rowOff + c;
      const procH = evaluateProceduralStackHeight(cfg, vx, vz, worldRadius, isFreeform);
      const prot = protectionWeights[idx];
      nextHeights[idx] = prot > 0 ? procH * (1 - prot) + (rawTerrain.heights[idx] ?? 1.15) * prot : procH;
    }
  }

  runThermalHydraulicErosionPass(
    nextHeights,
    width,
    1,
    size - 1,
    1,
    size - 1,
    step,
    cfg.erosionStrength,
    protectionWeights
  );

  const rockStart = rawTerrain.mountainConfig?.rockStartHeight ?? 5.5;
  const snowStart = rawTerrain.mountainConfig?.snowStartHeight ?? 10.6;
  const waterLevel = -1.65;

  for (let r = 0; r <= size; r++) {
    const rU = Math.max(0, r - 1);
    const rD = Math.min(size, r + 1);
    const rowOff = r * width;
    for (let c = 0; c <= size; c++) {
      const cL = Math.max(0, c - 1);
      const cR = Math.min(size, c + 1);
      const idx = rowOff + c;
      const prot = protectionWeights[idx];
      const existingLayer = nextLayers[idx] ?? 0;

      // Never overwrite roads/cobble inside protected settlements
      if (prot > 0.55 && (existingLayer === 5 || existingLayer === 6)) continue;

      const h = nextHeights[idx];
      const gx = (nextHeights[rowOff + cR] - nextHeights[rowOff + cL]) / (2 * step);
      const gz = (nextHeights[rD * width + c] - nextHeights[rU * width + c]) / (2 * step);
      const slope = Math.hypot(gx, gz);
      const avgNeighbor =
        (nextHeights[rowOff + cL] +
          nextHeights[rowOff + cR] +
          nextHeights[rU * width + c] +
          nextHeights[rD * width + c]) *
        0.25;
      const concavity = clamp((avgNeighbor - h) * 1.4, -1, 1);

      const curW = unpackWeather(nextWeather[idx]);
      let moss = curW.moss * 0.35;
      let cracks = curW.cracks * 0.35;
      let mud = curW.mud * 0.35;
      let frost = curW.frost * 0.35;

      if (h < waterLevel - 0.35) {
        nextLayers[idx] = 1; // riverbed/coast
      } else if (h >= snowStart && slope < 0.72) {
        nextLayers[idx] = 3; // alpine snow
        frost = Math.max(frost, 0.52);
      } else if (slope > cfg.cliffSlopeThreshold || h >= rockStart + 1.4) {
        nextLayers[idx] = 2; // rock cliff
        cracks = Math.max(cracks, clamp(slope * 0.75 * cfg.autoSlopeBlend, 0, 0.85));
      } else if (concavity > 0.16 && h > waterLevel + 0.3) {
        nextLayers[idx] = 4; // damp mossy hollow
        moss = Math.max(moss, clamp(concavity * 0.9 * cfg.curvatureMoss, 0, 0.88));
      } else if (prot < 0.35) {
        nextLayers[idx] = h < waterLevel + 0.35 ? 4 : 0; // lush meadow / damp bank
      }

      if (h < waterLevel + 0.65 && slope < 0.32) {
        mud = Math.max(mud, 0.28);
      }

      nextWeather[idx] = packWeather(moss, cracks, curW.scorch, mud, frost);
    }
  }

  return {
    ...rawTerrain,
    heights: nextHeights,
    layers: nextLayers,
    weathering: nextWeather,
    proceduralConfig: cfg,
    revision: (rawTerrain.revision ?? 1) + 1,
  };
}

function evalFalloff(normDist: number, falloff: TerrainBrushFalloff): number {
  const d = clamp(normDist, 0, 1);
  const inv = 1 - d;
  if (falloff === 'dome') return Math.sqrt(Math.max(0, 1 - d * d));
  if (falloff === 'peak') return inv * inv;
  if (falloff === 'plateau') {
    if (d <= 0.48) return 1;
    return quintic(1 - (d - 0.48) / 0.52);
  }
  return quintic(inv);
}

/**
 * Procedural stamp & hydraulic erosion brushes for the sculpt toolbar.
 */
export function applyProceduralTerrainStamp(
  terrain: TerrainData,
  brush: TerrainBrush,
  x: number,
  z: number,
  radius: number,
  options?: TerrainBrushOptions
): TerrainData {
  const size = terrain.size;
  const width = size + 1;
  const worldRadius = terrain.worldRadius && terrain.worldRadius > 0 ? terrain.worldRadius : 156;
  const step = (2 * worldRadius) / size;
  const strength = clamp(options?.strength ?? 0.65, 0.1, 1.5);
  const falloffMode: TerrainBrushFalloff = options?.falloff ?? 'smooth';
  const seed = terrain.proceduralConfig?.seed ?? 4208;

  const minCol = Math.max(0, Math.floor(((x - radius + worldRadius) / (2 * worldRadius)) * size) - 1);
  const maxCol = Math.min(size, Math.ceil(((x + radius + worldRadius) / (2 * worldRadius)) * size) + 1);
  const minRow = Math.max(0, Math.floor(((z - radius + worldRadius) / (2 * worldRadius)) * size) - 1);
  const maxRow = Math.min(size, Math.ceil(((z + radius + worldRadius) / (2 * worldRadius)) * size) + 1);

  const updatedHeights = [...terrain.heights];
  const updatedLayers = [...terrain.layers];
  const updatedWeather =
    terrain.weathering && terrain.weathering.length === width * width
      ? [...terrain.weathering]
      : new Array<number>(width * width).fill(0);

  if (brush === 'hydraulicErosion') {
    // Run real particle-based hydraulic rain-droplet + thermal scree erosion inside brush radius
    const eroded = runTerrainErosion(terrain, {
      region: { x, z, radius },
      droplets: Math.round(520 + Math.min(45, radius) * 18),
      maxSteps: 22,
      strength: clamp(strength * 0.95, 0.25, 1.8),
      thermalPasses: 1,
    });
    for (let i = 0; i < updatedHeights.length && i < eroded.heights.length; i++) {
      updatedHeights[i] = eroded.heights[i];
    }
    for (let i = 0; i < updatedLayers.length && i < eroded.layers.length; i++) {
      updatedLayers[i] = eroded.layers[i];
    }

    // Add fine weathering cracks, silt & cliff exposure along newly carved gullies
    for (let row = minRow; row <= maxRow; row++) {
      const vz = -worldRadius + row * step;
      const rowOff = row * width;
      for (let col = minCol; col <= maxCol; col++) {
        const vx = -worldRadius + col * step;
        const d = Math.hypot(vx - x, vz - z);
        if (d > radius) continue;
        const soft = evalFalloff(d / Math.max(0.01, radius), falloffMode);
        const idx = rowOff + col;

        const gully = domainWarpedFbm2D(vx * 0.06, vz * 0.06, seed + 511, 0.9, 3, 2.1, 0.5);
        const rillCarve = (0.5 - gully) * 0.72 * soft * strength;
        updatedHeights[idx] = clamp(updatedHeights[idx] + rillCarve, -4.5, 24);

        const cL = Math.max(0, col - 1);
        const cR = Math.min(size, col + 1);
        const rU = Math.max(0, row - 1);
        const rD = Math.min(size, row + 1);
        const gx = (updatedHeights[rowOff + cR] - updatedHeights[rowOff + cL]) / (2 * step);
        const gz = (updatedHeights[rD * width + col] - updatedHeights[rU * width + col]) / (2 * step);
        const slope = Math.hypot(gx, gz);

        const cw = unpackWeather(updatedWeather[idx]);
        const cracks = Math.min(1, cw.cracks + soft * (0.28 + slope * 0.45) * strength);
        const mud =
          slope < 0.25
            ? Math.min(1, cw.mud + soft * 0.25 * strength)
            : cw.mud;
        updatedWeather[idx] = packWeather(cw.moss, cracks, cw.scorch, mud, cw.frost);

        if (slope > 0.48 && soft > 0.22) {
          updatedLayers[idx] = 2; // expose rock on eroded banks
        }
      }
    }

    return {
      ...terrain,
      heights: updatedHeights,
      layers: updatedLayers,
      weathering: updatedWeather,
      revision: terrain.revision + 1,
    };
  }

  for (let row = minRow; row <= maxRow; row++) {
    const vz = -worldRadius + row * step;
    const rowOff = row * width;
    for (let col = minCol; col <= maxCol; col++) {
      const vx = -worldRadius + col * step;
      const d = Math.hypot(vx - x, vz - z);
      if (d > radius) continue;
      const soft = evalFalloff(d / Math.max(0.01, radius), falloffMode);
      const idx = rowOff + col;
      const curH = terrain.heights[idx] ?? 1.15;
      const cw = unpackWeather(updatedWeather[idx]);

      if (brush === 'proceduralRidge') {
        const ridge = ridgedMultifractal2D(vx * 0.045, vz * 0.045, seed + 17, 4, 2.15, 0.56);
        const lift = (0.35 + ridge * 1.45) * soft * 1.35 * strength;
        updatedHeights[idx] = clamp(curH + lift, -4.5, 24);
        if (ridge > 0.52 && soft > 0.28) {
          updatedLayers[idx] = updatedHeights[idx] > (terrain.mountainConfig?.snowStartHeight ?? 11) ? 3 : 2;
        }
        updatedWeather[idx] = packWeather(
          cw.moss,
          Math.min(1, cw.cracks + ridge * soft * 0.35),
          cw.scorch,
          cw.mud,
          cw.frost
        );
      } else if (brush === 'proceduralMesa') {
        const mesa = terracedMesa2D(vx * 0.04, vz * 0.04, seed + 73, 5, 3, 0.5);
        const targetLift = (0.55 + mesa * 1.15) * soft * 1.3 * strength;
        const rawTarget = curH + targetLift;
        // Snap lightly toward clean shelf steps for crisp mesa risers
        const shelfH = Math.round(rawTarget / 1.65) * 1.65;
        updatedHeights[idx] = clamp(rawTarget * 0.55 + shelfH * 0.45, -4.5, 24);
        if (soft > 0.22 && d > radius * 0.35) {
          updatedLayers[idx] = 2; // rocky cliff rim
        }
      } else if (brush === 'proceduralCrag') {
        const crag = domainWarpedFbm2D(vx * 0.055, vz * 0.055, seed + 241, 1.05, 4, 2.08, 0.54);
        const lift = (crag - 0.18) * 1.65 * soft * strength;
        updatedHeights[idx] = clamp(curH + lift, -4.5, 24);
        if (crag > 0.58 && soft > 0.25) {
          updatedLayers[idx] = 2;
        } else if (crag < 0.35 && soft > 0.3) {
          updatedLayers[idx] = 4; // mossy crag pocket
          updatedWeather[idx] = packWeather(
            Math.min(1, cw.moss + 0.32 * soft),
            cw.cracks,
            cw.scorch,
            cw.mud,
            cw.frost
          );
        }
      }
    }
  }

  return {
    ...terrain,
    heights: updatedHeights,
    layers: updatedLayers,
    weathering: updatedWeather,
    revision: terrain.revision + 1,
  };
}
