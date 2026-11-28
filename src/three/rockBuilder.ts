import * as THREE from 'three';
import type {
  FloraScatterSettings,
  RockPatternKind,
  RockScatterStyleConfig,
  RockShapeKind,
  RockSizeClass,
} from '../types/maker';

export interface RockClassMeta {
  id: RockSizeClass;
  label: string;
  interactionLabel: string;
  description: string;
  defaultMinSize: number;
  defaultMaxSize: number;
  sliderMin: number;
  sliderMax: number;
  sliderStep: number;
}

export const ROCK_CLASS_META: RockClassMeta[] = [
  {
    id: 'largeBoulder',
    label: 'Large Boulders',
    interactionLabel: 'Sit On Only',
    description: 'Massive resting boulders the hero can sit on to rest (cannot lift).',
    defaultMinSize: 1.35,
    defaultMaxSize: 2.15,
    sliderMin: 0.9,
    sliderMax: 3.4,
    sliderStep: 0.05,
  },
  {
    id: 'boulder',
    label: 'Boulders',
    interactionLabel: 'Lift (2 Hands)',
    description: 'Heavy medium boulders lifted with both hands and hurled at targets.',
    defaultMinSize: 0.54,
    defaultMaxSize: 0.84,
    sliderMin: 0.42,
    sliderMax: 1.15,
    sliderStep: 0.02,
  },
  {
    id: 'rock',
    label: 'Rocks',
    interactionLabel: 'Throw (1 Hand)',
    description: 'Hand-sized field stones picked up and thrown with one hand.',
    defaultMinSize: 0.24,
    defaultMaxSize: 0.38,
    sliderMin: 0.16,
    sliderMax: 0.5,
    sliderStep: 0.02,
  },
  {
    id: 'pebble',
    label: 'Pebbles',
    interactionLabel: 'River & Trail Detail',
    description: 'Tiny scattered riverbeds, shore gravel & path pebbles.',
    defaultMinSize: 0.08,
    defaultMaxSize: 0.17,
    sliderMin: 0.04,
    sliderMax: 0.26,
    sliderStep: 0.01,
  },
];

export const ROCK_PATTERN_OPTIONS: { id: RockPatternKind; label: string }[] = [
  { id: 'solid', label: 'Natural Matte' },
  { id: 'speckled', label: 'Granite Speckle' },
  { id: 'stratified', label: 'Stratified Bands' },
  { id: 'marbled', label: 'Mineral Veins' },
  { id: 'mossyCracks', label: 'Mossy Cracks' },
];

export const ROCK_SHAPE_OPTIONS: { id: RockShapeKind; label: string }[] = [
  { id: 'mixed', label: 'Mixed Natural' },
  { id: 'crag', label: 'Angular Crag' },
  { id: 'cobble', label: 'Smooth Cobble' },
  { id: 'slab', label: 'Flat Slab' },
  { id: 'blocky', label: 'Blocky Shelf' },
];

export function createDefaultRockScatterConfig(): RockScatterStyleConfig {
  return {
    enabledTiers: {
      largeBoulder: false,
      boulder: true,
      rock: true,
      pebble: true,
    },
    tierScales: {
      largeBoulder: { minSize: 1.35, maxSize: 2.15 },
      boulder: { minSize: 0.54, maxSize: 0.84 },
      rock: { minSize: 0.24, maxSize: 0.38 },
      pebble: { minSize: 0.08, maxSize: 0.17 },
    },
    colorMode: 'gradient',
    primaryColor: '#7A828C',
    secondaryColor: '#9D9384',
    colorVariation: 0.35,
    pattern: 'speckled',
    patternNoise: 0.55,
    shape: 'mixed',
    shapeVariation: 0.5,
  };
}

export function createDefaultFloraScatterSettings(): FloraScatterSettings {
  return {
    rocks: createDefaultRockScatterConfig(),
    flowerSlots: [
      'flower:meadowBlossom',
      'flower:sunlitDaisy',
      'flower:violetOrchid',
      'flower:crimsonTulip',
    ],
    flowerEnabledSlots: [true, true, true, true],
    flowerPaintAll: true,
    activeFlowerSlot: 0,
    plantSlots: [
      'plant:bananaClump',
      'plant:elephantEar',
      'plant:swordAgave',
      'plant:fairyLantern',
    ],
    plantEnabledSlots: [true, true, true, true],
    plantPaintAll: true,
    activePlantSlot: 0,
  };
}

export function resolveFloraScatterSettings(
  raw?: Partial<FloraScatterSettings> | null
): FloraScatterSettings {
  const def = createDefaultFloraScatterSettings();
  if (!raw) return def;
  const rawRocks = raw.rocks;
  const rocks: RockScatterStyleConfig = rawRocks
    ? {
        enabledTiers: {
          ...def.rocks.enabledTiers,
          ...(rawRocks.enabledTiers ?? {}),
        },
        tierScales: {
          largeBoulder: {
            ...def.rocks.tierScales.largeBoulder,
            ...(rawRocks.tierScales?.largeBoulder ?? {}),
          },
          boulder: {
            ...def.rocks.tierScales.boulder,
            ...(rawRocks.tierScales?.boulder ?? {}),
          },
          rock: {
            ...def.rocks.tierScales.rock,
            ...(rawRocks.tierScales?.rock ?? {}),
          },
          pebble: {
            ...def.rocks.tierScales.pebble,
            ...(rawRocks.tierScales?.pebble ?? {}),
          },
        },
        colorMode: rawRocks.colorMode ?? def.rocks.colorMode,
        primaryColor: rawRocks.primaryColor ?? def.rocks.primaryColor,
        secondaryColor: rawRocks.secondaryColor ?? def.rocks.secondaryColor,
        colorVariation:
          typeof rawRocks.colorVariation === 'number'
            ? rawRocks.colorVariation
            : def.rocks.colorVariation,
        pattern: rawRocks.pattern ?? def.rocks.pattern,
        patternNoise:
          typeof rawRocks.patternNoise === 'number'
            ? rawRocks.patternNoise
            : def.rocks.patternNoise,
        shape: rawRocks.shape ?? def.rocks.shape,
        shapeVariation:
          typeof rawRocks.shapeVariation === 'number'
            ? rawRocks.shapeVariation
            : def.rocks.shapeVariation,
      }
    : def.rocks;

  const flowerSlots: [string, string, string, string] = [
    raw.flowerSlots?.[0] ?? def.flowerSlots[0],
    raw.flowerSlots?.[1] ?? def.flowerSlots[1],
    raw.flowerSlots?.[2] ?? def.flowerSlots[2],
    raw.flowerSlots?.[3] ?? def.flowerSlots[3],
  ];
  const plantSlots: [string, string, string, string] = [
    raw.plantSlots?.[0] ?? def.plantSlots[0],
    raw.plantSlots?.[1] ?? def.plantSlots[1],
    raw.plantSlots?.[2] ?? def.plantSlots[2],
    raw.plantSlots?.[3] ?? def.plantSlots[3],
  ];

  const activeFlowerSlot = Math.max(0, Math.min(3, raw.activeFlowerSlot ?? def.activeFlowerSlot));
  const activePlantSlot = Math.max(0, Math.min(3, raw.activePlantSlot ?? def.activePlantSlot));
  const flowerPaintAll = raw.flowerPaintAll ?? def.flowerPaintAll;
  const plantPaintAll = raw.plantPaintAll ?? def.plantPaintAll;

  const flowerEnabledSlots: [boolean, boolean, boolean, boolean] = raw.flowerEnabledSlots
    ? [
        Boolean(raw.flowerEnabledSlots[0]),
        Boolean(raw.flowerEnabledSlots[1]),
        Boolean(raw.flowerEnabledSlots[2]),
        Boolean(raw.flowerEnabledSlots[3]),
      ]
    : flowerPaintAll
    ? [true, true, true, true]
    : [
        activeFlowerSlot === 0,
        activeFlowerSlot === 1,
        activeFlowerSlot === 2,
        activeFlowerSlot === 3,
      ];

  const plantEnabledSlots: [boolean, boolean, boolean, boolean] = raw.plantEnabledSlots
    ? [
        Boolean(raw.plantEnabledSlots[0]),
        Boolean(raw.plantEnabledSlots[1]),
        Boolean(raw.plantEnabledSlots[2]),
        Boolean(raw.plantEnabledSlots[3]),
      ]
    : plantPaintAll
    ? [true, true, true, true]
    : [
        activePlantSlot === 0,
        activePlantSlot === 1,
        activePlantSlot === 2,
        activePlantSlot === 3,
      ];

  return {
    rocks,
    flowerSlots,
    flowerEnabledSlots,
    flowerPaintAll: flowerEnabledSlots.every(Boolean),
    activeFlowerSlot,
    plantSlots,
    plantEnabledSlots,
    plantPaintAll: plantEnabledSlots.every(Boolean),
    activePlantSlot,
  };
}

export function getActiveFlowerVariantKeys(cfg: FloraScatterSettings): string[] {
  const enabled = cfg.flowerEnabledSlots;
  if (enabled) {
    const picked = cfg.flowerSlots.filter((_, idx) => enabled[idx]);
    if (picked.length > 0) return picked;
  }
  if (cfg.flowerPaintAll) return [...cfg.flowerSlots];
  return [cfg.flowerSlots[cfg.activeFlowerSlot] ?? cfg.flowerSlots[0]];
}

export function getActivePlantVariantKeys(cfg: FloraScatterSettings): string[] {
  const enabled = cfg.plantEnabledSlots;
  if (enabled) {
    const picked = cfg.plantSlots.filter((_, idx) => enabled[idx]);
    if (picked.length > 0) return picked;
  }
  if (cfg.plantPaintAll) return [...cfg.plantSlots];
  return [cfg.plantSlots[cfg.activePlantSlot] ?? cfg.plantSlots[0]];
}

export function inferRockSizeClass(
  explicit?: RockSizeClass,
  size = 1.0
): RockSizeClass {
  if (explicit) return explicit;
  if (size >= 1.1) return 'largeBoulder';
  if (size >= 0.48) return 'boulder';
  if (size >= 0.2) return 'rock';
  return 'pebble';
}

function createRockRng(seed: number): () => number {
  let a = (seed | 0) || 1337;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2D(ix: number, iy: number, seed: number): number {
  const n = Math.sin(ix * 127.1 + iy * 311.7 + seed * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

function valueNoise2D(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2D(ix, iy, seed);
  const b = hash2D(ix + 1, iy, seed);
  const c = hash2D(ix, iy + 1, seed);
  const d = hash2D(ix + 1, iy + 1, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm2D(x: number, y: number, seed: number): number {
  return (
    valueNoise2D(x, y, seed) * 0.55 +
    valueNoise2D(x * 2.07 + 4.1, y * 2.07 - 1.9, seed + 19) * 0.3 +
    valueNoise2D(x * 4.21 - 2.3, y * 4.21 + 3.7, seed + 47) * 0.15
  );
}

const rockTextureCache = new Map<string, THREE.CanvasTexture>();

export function getOrCreateRockPatternTexture(
  pattern: RockPatternKind,
  primaryHex: string,
  secondaryHex: string,
  noiseIntensity = 0.55
): THREE.CanvasTexture {
  const noiseQ = Math.round(THREE.MathUtils.clamp(noiseIntensity, 0, 1) * 10);
  const key = `${pattern}|${primaryHex.toLowerCase()}|${secondaryHex.toLowerCase()}|${noiseQ}`;
  const cached = rockTextureCache.get(key);
  if (cached) return cached;

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  const c1 = new THREE.Color(primaryHex || '#7A828C');
  const c2 = new THREE.Color(secondaryHex || primaryHex || '#9D9384');
  const tmp = new THREE.Color();
  const mossCol = new THREE.Color('#4A7C43');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const noiseAmt = THREE.MathUtils.clamp(noiseIntensity, 0, 1);

  for (let py = 0; py < size; py++) {
    const v = py / size;
    for (let px = 0; px < size; px++) {
      const u = px / size;
      const idx = (py * size + px) * 4;
      const nLarge = fbm2D(u * 5.2, v * 5.2, 17);
      const nFine = fbm2D(u * 18.0, v * 18.0, 91);

      let blend = 0.5;
      let grain = (nFine - 0.5) * 0.24 * noiseAmt;

      if (pattern === 'solid') {
        blend = THREE.MathUtils.clamp(v * 0.6 + nLarge * 0.4, 0, 1);
        grain = (nFine - 0.5) * 0.14 * noiseAmt;
      } else if (pattern === 'speckled') {
        blend = THREE.MathUtils.clamp(nLarge * 0.72 + (1 - v) * 0.28, 0, 1);
        const fleck = hash2D(px, py, 307);
        if (fleck > 1 - 0.18 * (0.3 + noiseAmt)) {
          grain += 0.22;
        } else if (fleck < 0.14 * (0.3 + noiseAmt)) {
          grain -= 0.22;
        }
      } else if (pattern === 'stratified') {
        const strata = Math.sin((v * 7.5 + nLarge * 1.4 * (0.35 + noiseAmt)) * Math.PI * 2);
        blend = THREE.MathUtils.clamp(0.5 + strata * 0.45, 0, 1);
        grain = (nFine - 0.5) * 0.16 * noiseAmt;
      } else if (pattern === 'marbled') {
        const warp = fbm2D(u * 4.5 + nLarge * 1.8, v * 4.5 - nLarge * 1.5, 55);
        const vein = 1 - Math.abs(Math.sin((u * 2.2 + warp * (1.2 + noiseAmt * 1.4)) * Math.PI * 2));
        blend = THREE.MathUtils.clamp(Math.pow(vein, 2.2) * 0.9 + nLarge * 0.2, 0, 1);
      } else if (pattern === 'mossyCracks') {
        blend = THREE.MathUtils.clamp(v * 0.45 + nLarge * 0.55, 0, 1);
      }

      tmp.copy(c1).lerp(c2, blend);
      if (pattern === 'mossyCracks') {
        const crackVal = Math.abs(fbm2D(u * 7.5, v * 7.5, 73) - 0.5);
        if (crackVal < 0.055 * (0.5 + noiseAmt)) {
          tmp.multiplyScalar(0.62);
        } else if (v < 0.42 && nLarge > 0.56 - noiseAmt * 0.16) {
          tmp.lerp(mossCol, 0.58 * (0.5 + noiseAmt * 0.5));
        }
      }

      const r = THREE.MathUtils.clamp(tmp.r + grain, 0, 1);
      const g = THREE.MathUtils.clamp(tmp.g + grain, 0, 1);
      const b = THREE.MathUtils.clamp(tmp.b + grain, 0, 1);
      data[idx] = Math.round(r * 255);
      data[idx + 1] = Math.round(g * 255);
      data[idx + 2] = Math.round(b * 255);
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  if (rockTextureCache.size > 96) {
    rockTextureCache.clear();
  }
  rockTextureCache.set(key, tex);
  return tex;
}

function applyRockBoxUVs(geo: THREE.BufferGeometry, uvScale = 0.8): void {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const norm = geo.attributes.normal as THREE.BufferAttribute;
  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = Math.abs(norm.getX(i));
    const ny = Math.abs(norm.getY(i));
    const nz = Math.abs(norm.getZ(i));
    if (ny >= nx && ny >= nz) {
      uvs[i * 2] = x * uvScale + 0.5;
      uvs[i * 2 + 1] = z * uvScale + 0.5;
    } else if (nx >= nz) {
      uvs[i * 2] = z * uvScale + 0.5;
      uvs[i * 2 + 1] = y * uvScale + 0.5;
    } else {
      uvs[i * 2] = x * uvScale + 0.5;
      uvs[i * 2 + 1] = y * uvScale + 0.5;
    }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
}

export function buildSculptedRockGeometry(
  shape: Exclude<RockShapeKind, 'mixed'>,
  variation = 0.5,
  seed = 7,
  baseRadius = 0.72,
  nonIndexed = true
): THREE.BufferGeometry {
  const v = THREE.MathUtils.clamp(variation, 0, 1);
  const rng = createRockRng(seed);
  const detail = shape === 'cobble' ? 2 : 2;
  const raw =
    shape === 'blocky'
      ? new THREE.BoxGeometry(baseRadius * 1.8, baseRadius * 1.32, baseRadius * 1.56, 3, 2, 3)
      : new THREE.IcosahedronGeometry(baseRadius, detail);
  const geo = nonIndexed && raw.index ? raw.toNonIndexed() : raw;
  if (geo !== raw) raw.dispose();

  const pos = geo.attributes.position as THREE.BufferAttribute;
  const axes: Array<[number, number, number, number, number]> = [];
  const planeCount = shape === 'crag' ? 6 : shape === 'slab' ? 4 : 5;
  for (let k = 0; k < planeCount; k++) {
    const theta = rng() * Math.PI * 2;
    const phi = Math.acos(2 * rng() - 1);
    axes.push([
      Math.sin(phi) * Math.cos(theta),
      Math.cos(phi),
      Math.sin(phi) * Math.sin(theta),
      0.14 + rng() * 0.22,
      rng() * Math.PI * 2,
    ]);
  }

  const sx =
    shape === 'slab'
      ? 1.28 + rng() * 0.24
      : shape === 'cobble'
      ? 1.05 + rng() * 0.2
      : 0.94 + rng() * 0.3;
  const sy =
    shape === 'slab'
      ? 0.44 + rng() * 0.14
      : shape === 'cobble'
      ? 0.68 + rng() * 0.16
      : shape === 'blocky'
      ? 0.85 + rng() * 0.18
      : 0.82 + rng() * 0.26;
  const sz =
    shape === 'slab'
      ? 1.18 + rng() * 0.24
      : shape === 'cobble'
      ? 0.95 + rng() * 0.22
      : 0.92 + rng() * 0.3;

  for (let i = 0; i < pos.count; i++) {
    let vx = pos.getX(i);
    let vy = pos.getY(i);
    let vz = pos.getZ(i);
    const len = Math.max(0.0001, Math.hypot(vx, vy, vz));
    const nx = vx / len;
    const ny = vy / len;
    const nz = vz / len;

    let disp = 1.0;
    if (shape === 'crag') {
      for (const [ax, ay, az, amp, ph] of axes) {
        const d = nx * ax + ny * ay + nz * az;
        if (d > 0.35) {
          disp -= (d - 0.35) * amp * (0.7 + v * 1.1);
        }
        disp += Math.sin(d * 4.8 + ph) * amp * 0.38 * (0.35 + v);
      }
      if (ny > 0.35) {
        disp += (ny - 0.35) * 0.22 * (0.3 + v * 0.8);
      }
    } else if (shape === 'cobble') {
      const wave =
        Math.sin(nx * 2.5 + seed) * Math.cos(nz * 2.3 - seed * 0.5) * 0.08 * (0.3 + v);
      disp = 0.96 + wave;
    } else if (shape === 'slab') {
      const ledge = Math.sin(nx * 3.1 + seed) * Math.cos(nz * 2.9) * 0.12 * (0.35 + v);
      disp = 0.98 + ledge;
      if (Math.abs(ny) > 0.42) {
        vy *= 0.64;
      }
    } else {
      // blocky shelf
      const bevel = Math.sin(nx * 4.2 + seed) * Math.cos(ny * 3.4 - seed) * 0.1 * (0.35 + v);
      disp = 0.96 + bevel;
    }

    const bottomFlat = ny < -0.35 ? 0.78 : 1.0;
    vx = vx * disp * sx;
    vy = vy * disp * sy * bottomFlat;
    vz = vz * disp * sz;
    pos.setXYZ(i, vx, vy, vz);
  }
  pos.needsUpdate = true;
  geo.computeBoundingBox();
  if (geo.boundingBox) {
    // Seat rock firmly with slight buried lip so it never floats above terrain slopes
    const liftY = -geo.boundingBox.min.y * 0.68;
    geo.translate(0, liftY, 0);
  }
  geo.computeVertexNormals();
  applyRockBoxUVs(geo, 0.72);
  geo.computeBoundingSphere();
  return geo;
}
