import * as THREE from 'three';
import type { CanopyBasePattern, FoliageTextureStyle, TreeBarkStyle } from '../types/maker';

export interface ProceduralTexturePair {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
}

const MAX_CACHE = 48;
const barkCache = new Map<string, ProceduralTexturePair>();
const foliageCache = new Map<string, ProceduralTexturePair>();
const canopyBaseCache = new Map<string, ProceduralTexturePair>();
const externalNormalCache = new WeakMap<THREE.Texture, THREE.CanvasTexture>();

function hash2D(x: number, y: number, seed: number): number {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function makeSeededRand(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shiftHexLightness(hex: string, deltaL: number, deltaS = 0, deltaH = 0): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(
    (hsl.h + deltaH + 1) % 1,
    THREE.MathUtils.clamp(hsl.s + deltaS, 0, 1),
    THREE.MathUtils.clamp(hsl.l + deltaL, 0.03, 0.97)
  );
  return `#${c.getHexString()}`;
}

function deriveBumpAndNormalFromCanvas(
  srcCanvas: HTMLCanvasElement,
  contrast = 1.25,
  normalStrength = 3.2
): { bumpMap: THREE.CanvasTexture; normalMap: THREE.CanvasTexture } {
  const w = srcCanvas.width;
  const h = srcCanvas.height;
  const sCtx = srcCanvas.getContext('2d')!;
  const srcData = sCtx.getImageData(0, 0, w, h);
  const sd = srcData.data;

  // 1. Luminance height field (0..1) + grayscale bump canvas
  const heights = new Float32Array(w * h);
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = w;
  bumpCanvas.height = h;
  const bCtx = bumpCanvas.getContext('2d')!;
  const bOut = bCtx.createImageData(w, h);
  const bd = bOut.data;

  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    const lum = sd[i] * 0.299 + sd[i + 1] * 0.587 + sd[i + 2] * 0.114;
    const v = THREE.MathUtils.clamp((lum - 128) * contrast + 128, 0, 255);
    heights[p] = v / 255;
    bd[i] = v;
    bd[i + 1] = v;
    bd[i + 2] = v;
    bd[i + 3] = 255;
  }
  bCtx.putImageData(bOut, 0, 0);

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.needsUpdate = true;

  // 2. Pre-smoothed seamless 3x3 Sobel tangent-space Normal Map (tactile relief without 1px aliasing sparkles)
  const smoothH = new Float32Array(w * h);
  const sampleRawH = (x: number, y: number): number => {
    const wx = ((x % w) + w) % w;
    const wy = ((y % h) + h) % h;
    return heights[wy * w + wx];
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      smoothH[y * w + x] =
        (sampleRawH(x, y) * 4 +
          (sampleRawH(x - 1, y) + sampleRawH(x + 1, y) + sampleRawH(x, y - 1) + sampleRawH(x, y + 1)) * 2 +
          (sampleRawH(x - 1, y - 1) + sampleRawH(x + 1, y - 1) + sampleRawH(x - 1, y + 1) + sampleRawH(x + 1, y + 1))) /
        16;
    }
  }

  const normCanvas = document.createElement('canvas');
  normCanvas.width = w;
  normCanvas.height = h;
  const nCtx = normCanvas.getContext('2d')!;
  const nOut = nCtx.createImageData(w, h);
  const nd = nOut.data;

  const sampleH = (x: number, y: number): number => {
    const wx = ((x % w) + w) % w;
    const wy = ((y % h) + h) % h;
    return smoothH[wy * w + wx];
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = sampleH(x - 1, y - 1);
      const t = sampleH(x, y - 1);
      const tr = sampleH(x + 1, y - 1);
      const l = sampleH(x - 1, y);
      const r = sampleH(x + 1, y);
      const bl = sampleH(x - 1, y + 1);
      const b = sampleH(x, y + 1);
      const br = sampleH(x + 1, y + 1);

      const dX = (tr + 2 * r + br - (tl + 2 * l + bl)) * normalStrength;
      const dY = (bl + 2 * b + br - (tl + 2 * t + tr)) * normalStrength;
      const nx = -dX;
      const ny = dY;
      const nz = 1.0;
      const invLen = 1 / Math.hypot(nx, ny, nz);

      const idx = (y * w + x) * 4;
      nd[idx] = Math.round((nx * invLen * 0.5 + 0.5) * 255);
      nd[idx + 1] = Math.round((ny * invLen * 0.5 + 0.5) * 255);
      nd[idx + 2] = Math.round((nz * invLen * 0.5 + 0.5) * 255);
      nd[idx + 3] = 255;
    }
  }
  nCtx.putImageData(nOut, 0, 0);

  const normalMap = new THREE.CanvasTexture(normCanvas);
  normalMap.colorSpace = THREE.NoColorSpace;
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.generateMipmaps = true;
  normalMap.minFilter = THREE.LinearMipmapLinearFilter;
  normalMap.magFilter = THREE.LinearFilter;
  normalMap.anisotropy = 4;
  normalMap.needsUpdate = true;

  return { bumpMap, normalMap };
}

/**
 * Generates (and caches) a crisp tangent-space normalMap directly from any uploaded GLB's
 * diffuse texture so the Leaf Texture Bump slider works vividly on custom GLB treetops too!
 */
export function deriveNormalMapFromImageTexture(
  tex: THREE.Texture
): THREE.CanvasTexture | null {
  const cached = externalNormalCache.get(tex);
  if (cached) return cached;

  const img = tex.image as
    | HTMLImageElement
    | HTMLCanvasElement
    | ImageBitmap
    | undefined;
  if (!img) return null;

  try {
    const size = 256;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    const { bumpMap, normalMap } = deriveBumpAndNormalFromCanvas(c, 1.35, 2.0);
    bumpMap.dispose();
    normalMap.wrapS = tex.wrapS;
    normalMap.wrapT = tex.wrapT;
    normalMap.repeat.copy(tex.repeat);
    normalMap.offset.copy(tex.offset);
    normalMap.flipY = tex.flipY;
    externalNormalCache.set(tex, normalMap);
    return normalMap;
  } catch {
    return null;
  }
}

/**
 * Generates (and caches) a seamless stylized bark texture + matching luminance bump map
 * supporting 9 distinct bark styles AND uneven vertical lighter wood-bark lines!
 */
export function getProceduralBarkTextures(
  style: TreeBarkStyle,
  barkColor: string,
  lineIntensity = 0.58,
  lineDensity = 1.0
): ProceduralTexturePair {
  // Quantize floats so slider dragging hits cache cleanly without excessive allocations
  const qLine = Math.round(lineIntensity * 20) / 20;
  const qDens = Math.round(lineDensity * 10) / 10;
  const key = `${style}:${barkColor.toLowerCase()}:${qLine}:${qDens}`;

  const hit = barkCache.get(key);
  if (hit) return hit;

  if (barkCache.size >= MAX_CACHE) {
    const firstKey = barkCache.keys().next().value;
    if (firstKey) {
      const old = barkCache.get(firstKey);
      old?.map.dispose();
      old?.bumpMap.dispose();
      old?.normalMap.dispose();
      barkCache.delete(firstKey);
    }
  }

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = makeSeededRand(
    style.split('').reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 17)
  );

  // Base coat
  ctx.fillStyle = barkColor;
  ctx.fillRect(0, 0, size, size);

  const lighter = shiftHexLightness(barkColor, 0.11, -0.04);
  const brightLine = shiftHexLightness(barkColor, 0.16, -0.06);
  const subtleLight = shiftHexLightness(barkColor, 0.08, -0.02);
  const darker = shiftHexLightness(barkColor, -0.14, 0.05);
  const deepCrevice = shiftHexLightness(barkColor, -0.24, 0.06);

  // Style-specific base pattern
  if (style === 'birch') {
    // Pale papery birch bands + dark horizontal lenticel dashes & subtle amber peel
    for (let y = 0; y < size; y += 6) {
      ctx.fillStyle = rand() > 0.5 ? subtleLight : shiftHexLightness(barkColor, -0.04);
      ctx.globalAlpha = 0.35;
      ctx.fillRect(0, y, size, 2 + rand() * 5);
    }
    ctx.globalAlpha = 1;
    // Horizontal dark lenticels
    for (let i = 0; i < 95; i++) {
      const lx = rand() * size;
      const ly = rand() * size;
      const lw = 10 + rand() * 34;
      const lh = 1.4 + rand() * 3.2;
      ctx.fillStyle = rand() > 0.25 ? '#2B2724' : '#4C433B';
      ctx.globalAlpha = 0.55 + rand() * 0.35;
      ctx.beginPath();
      ctx.ellipse(lx, ly, lw * 0.5, lh * 0.5, (rand() - 0.5) * 0.08, 0, Math.PI * 2);
      ctx.fill();
      if (lx + lw > size) {
        ctx.beginPath();
        ctx.ellipse(lx - size, ly, lw * 0.5, lh * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Occasional dark triangular branch-scar knots
    for (let k = 0; k < 7; k++) {
      const kx = rand() * size;
      const ky = rand() * size;
      ctx.fillStyle = '#25211F';
      ctx.globalAlpha = 0.78;
      ctx.beginPath();
      ctx.moveTo(kx - 10, ky);
      ctx.quadraticCurveTo(kx, ky - 8, kx + 10, ky);
      ctx.quadraticCurveTo(kx, ky + 6, kx - 10, ky);
      ctx.fill();
    }
  } else if (style === 'pine') {
    // Plated reddish/warm conifer scales stacked vertically
    for (let i = 0; i < 85; i++) {
      const px = rand() * size;
      const py = rand() * size;
      const pw = 16 + rand() * 26;
      const ph = 28 + rand() * 44;
      ctx.fillStyle = rand() > 0.45 ? subtleLight : darker;
      ctx.globalAlpha = 0.42;
      ctx.beginPath();
      ctx.roundRect(px - pw * 0.5, py - ph * 0.5, pw, ph, 5);
      ctx.fill();
      ctx.strokeStyle = deepCrevice;
      ctx.lineWidth = 1.6;
      ctx.globalAlpha = 0.55;
      ctx.stroke();
    }
  } else if (style === 'rough') {
    // High-contrast craggy fissured patches
    for (let i = 0; i < 160; i++) {
      const rx = rand() * size;
      const ry = rand() * size;
      const rw = 4 + rand() * 14;
      const rh = 18 + rand() * 48;
      ctx.fillStyle = rand() > 0.5 ? deepCrevice : lighter;
      ctx.globalAlpha = 0.42;
      ctx.fillRect(rx, ry, rw, rh);
    }
  } else if (style === 'painterly') {
    // Broad soft hand-painted strokes with subtle warm/cool shift
    const warmTone = shiftHexLightness(barkColor, 0.06, 0.08, 0.025);
    const coolShadow = shiftHexLightness(barkColor, -0.09, 0.04, -0.03);
    for (let i = 0; i < 110; i++) {
      const bx = rand() * size;
      const by = rand() * size;
      const bw = 10 + rand() * 20;
      const bh = 30 + rand() * 58;
      ctx.fillStyle = rand() > 0.48 ? warmTone : coolShadow;
      ctx.globalAlpha = 0.36;
      ctx.beginPath();
      ctx.ellipse(bx, by, bw * 0.5, bh * 0.5, (rand() - 0.5) * 0.14, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (style === 'textural') {
    // Fine dense fibrous organic wood grain weave
    for (let y = 0; y < size; y += 2) {
      for (let x = 0; x < size; x += 6) {
        const n = hash2D(x, y, 13);
        ctx.fillStyle = n > 0.55 ? subtleLight : n < 0.3 ? darker : barkColor;
        ctx.globalAlpha = 0.34;
        ctx.fillRect(x, y, 4 + n * 4, 14 + n * 18);
      }
    }
  } else if (style === 'cartoony') {
    // Vintage Hanna-Barbera / mid-century hand-inked cartoon bark:
    // Wild looping S-squiggles, crooked gouache wood bands, quirky spiral knots & bold ink outlines!
    const inkColor = shiftHexLightness(barkColor, -0.34, 0.12);
    const warmPop = shiftHexLightness(barkColor, 0.13, 0.16, 0.025);
    const coolBand = shiftHexLightness(barkColor, -0.12, 0.06, -0.025);

    // Wavy, crooked vertical gouache color bands (seamless vertical repeat)
    for (let i = 0; i < 14; i++) {
      const baseX = (i / 14) * size;
      const bandW = 10 + rand() * 14;
      const amp = 12 + rand() * 14;
      const ph = rand() * Math.PI * 2;
      const freq = 1 + (i % 2);
      ctx.fillStyle = i % 3 === 0 ? warmPop : i % 3 === 1 ? coolBand : darker;
      ctx.globalAlpha = 0.56;
      ctx.beginPath();
      for (let y = 0; y <= size; y += 8) {
        const t = (y / size) * Math.PI * 2;
        const wx =
          baseX +
          Math.sin(t * freq + ph) * amp +
          Math.sin(t * (freq * 2) - ph * 1.4) * (amp * 0.42);
        if (y === 0) ctx.moveTo(wx, y);
        else ctx.lineTo(wx, y);
      }
      for (let y = size; y >= 0; y -= 8) {
        const t = (y / size) * Math.PI * 2;
        const wx =
          baseX +
          bandW +
          Math.sin(t * freq + ph + 0.35) * amp +
          Math.sin(t * (freq * 2) - ph * 1.4) * (amp * 0.42);
        ctx.lineTo(wx, y);
      }
      ctx.closePath();
      ctx.fill();
    }

    // Playful vintage cartoon spiral wood knots & crooked bark islands
    for (let k = 0; k < 6; k++) {
      const kx = rand() * size;
      const ky = rand() * size;
      const krx = 12 + rand() * 14;
      const kry = 20 + rand() * 20;
      const tilt = (rand() - 0.5) * 0.35;

      // Highlight blob behind knot
      ctx.fillStyle = warmPop;
      ctx.globalAlpha = 0.72;
      ctx.beginPath();
      ctx.ellipse(kx, ky, krx * 1.15, kry * 1.1, tilt, 0, Math.PI * 2);
      ctx.fill();

      // Bold spiral ink squiggle inside knot
      ctx.strokeStyle = inkColor;
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      for (let s = 0; s <= 28; s++) {
        const a = (s / 28) * Math.PI * 3.8;
        const rFrac = s / 28;
        const sx = kx + Math.cos(a + tilt) * krx * rFrac;
        const sy = ky + Math.sin(a + tilt) * kry * rFrac;
        if (s === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }

    // Wild hand-inked Hanna-Barbera squiggly vertical cracks with jagged kinks & hooks
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < 18; i++) {
      const baseX = ((i + rand() * 0.5) / 18) * size;
      const amp1 = 10 + rand() * 14;
      const amp2 = 5 + rand() * 8;
      const ph1 = rand() * Math.PI * 2;
      const ph2 = rand() * Math.PI * 2;
      const f1 = 1 + Math.floor(rand() * 2);
      const f2 = 3 + Math.floor(rand() * 3);

      // Thick comic ink squiggle
      ctx.strokeStyle = inkColor;
      ctx.lineWidth = 2.4 + rand() * 2.4;
      ctx.globalAlpha = 0.88;
      ctx.beginPath();
      for (let y = 0; y <= size; y += 6) {
        const t = (y / size) * Math.PI * 2;
        const x =
          baseX +
          Math.sin(t * f1 + ph1) * amp1 +
          Math.sin(t * f2 + ph2) * amp2 +
          Math.cos(t * 2 - ph1) * 4.5;
        if (y === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Paired playful bright highlight stroke next to the comic ink groove
      ctx.strokeStyle = brightLine;
      ctx.lineWidth = 1.8 + rand() * 1.6;
      ctx.globalAlpha = 0.65;
      ctx.beginPath();
      for (let y = 0; y <= size; y += 6) {
        const t = (y / size) * Math.PI * 2;
        const x =
          baseX +
          3.4 +
          Math.sin(t * f1 + ph1) * amp1 +
          Math.sin(t * f2 + ph2) * amp2 +
          Math.cos(t * 2 - ph1) * 4.5;
        if (y === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  } else if (style === 'knotty') {
    // Deep swirling wood rings & raised oval knots/whorls
    for (let k = 0; k < 10; k++) {
      const kx = rand() * size;
      const ky = rand() * size;
      const krx = 12 + rand() * 16;
      const kry = 18 + rand() * 26;
      for (let ring = 4; ring >= 1; ring--) {
        const rf = ring / 4;
        ctx.strokeStyle = ring % 2 === 0 ? deepCrevice : brightLine;
        ctx.lineWidth = 2.4;
        ctx.globalAlpha = 0.58;
        ctx.beginPath();
        ctx.ellipse(kx, ky, krx * rf, kry * rf, (rand() - 0.5) * 0.25, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = deepCrevice;
      ctx.globalAlpha = 0.72;
      ctx.beginPath();
      ctx.ellipse(kx, ky, krx * 0.28, kry * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (style === 'fantasy') {
    // Swirled ancient elderbark with subtle mystical teal/violet mossy veins
    const glowVein = shiftHexLightness(barkColor, 0.22, 0.32, 0.36);
    for (let i = 0; i < 24; i++) {
      const sx = (i / 24) * size;
      ctx.strokeStyle = i % 5 === 0 ? glowVein : darker;
      ctx.lineWidth = i % 5 === 0 ? 2.1 : 3.2;
      ctx.globalAlpha = i % 5 === 0 ? 0.55 : 0.45;
      ctx.beginPath();
      for (let y = 0; y <= size; y += 16) {
        const wx = sx + Math.sin((y / size) * Math.PI * 2 + i * 0.8) * 14;
        if (y === 0) ctx.moveTo(wx, y);
        else ctx.lineTo(wx, y);
      }
      ctx.stroke();
    }
  } else {
    // Classic 'oak' deeply furrowed bark ridges
    for (let i = 0; i < 65; i++) {
      const ox = rand() * size;
      const oy = rand() * size;
      const ow = 5 + rand() * 11;
      const oh = 32 + rand() * 68;
      ctx.fillStyle = rand() > 0.45 ? darker : subtleLight;
      ctx.globalAlpha = 0.38;
      ctx.beginPath();
      ctx.roundRect(ox, oy, ow, oh, 3);
      ctx.fill();
    }
  }

  // --- UNEVEN VERTICAL LIGHTER WOOD BARK LINES RUNNING UP & DOWN THE TREE ---
  if (qLine > 0.01) {
    const lineCount = Math.max(8, Math.round(28 * qDens));
    ctx.lineCap = 'round';
    for (let i = 0; i < lineCount; i++) {
      const baseX = ((i + rand() * 0.7) / lineCount) * size;
      const wobbleAmp = (style === 'cartoony' ? 11.5 : 6.2) * (0.5 + rand() * 0.85);
      const phase = rand() * Math.PI * 2;
      const freq = 1 + Math.floor(rand() * 2); // integer vertical cycles = seamless wrap!
      const width = (style === 'cartoony' ? 2.6 : 1.4) + rand() * 2.4;

      // Subtle paired shadow groove beside each lighter bark ridge for 3D depth
      ctx.strokeStyle = deepCrevice;
      ctx.lineWidth = width * 0.9;
      ctx.globalAlpha = qLine * (style === 'cartoony' ? 0.62 : 0.42);
      ctx.beginPath();
      for (let y = 0; y <= size; y += 8) {
        const t = (y / size) * Math.PI * 2;
        const wiggle =
          Math.sin(t * freq + phase) * wobbleAmp +
          (style === 'cartoony' ? Math.sin(t * 4 + phase * 2.1) * 4.2 : 0);
        const x = baseX - width * 0.85 + wiggle;
        if (y === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Lighter uneven bark ridge line just lighter than the bark color itself!
      ctx.strokeStyle = i % 3 === 0 ? brightLine : lighter;
      ctx.lineWidth = width;
      ctx.globalAlpha = THREE.MathUtils.clamp(qLine * (0.55 + rand() * 0.35), 0.12, 0.92);
      ctx.beginPath();
      for (let y = 0; y <= size; y += 8) {
        const t = (y / size) * Math.PI * 2;
        const jitter =
          Math.sin(t * (freq * 2) + phase * 1.7) * (wobbleAmp * (style === 'cartoony' ? 0.55 : 0.35));
        const x = baseX + Math.sin(t * freq + phase) * wobbleAmp + jitter;
        if (y === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  ctx.globalAlpha = 1;

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.needsUpdate = true;

  const { bumpMap, normalMap } = deriveBumpAndNormalFromCanvas(
    canvas,
    style === 'rough' || style === 'knotty' ? 1.45 : style === 'cartoony' ? 1.25 : 1.32,
    style === 'rough' || style === 'knotty' ? 2.8 : style === 'cartoony' ? 2.1 : 2.4
  );

  const pair: ProceduralTexturePair = { map, bumpMap, normalMap };
  barkCache.set(key, pair);
  return pair;
}

/**
 * Generates (and caches) a rich seamless stylized Oak / Broadleaf foliage texture
 * plus a matching luminance bump guide derived directly from the texture itself!
 */
export function getProceduralFoliageTextures(
  style: FoliageTextureStyle,
  baseColor: string
): ProceduralTexturePair {
  const key = `${style}:${baseColor.toLowerCase()}`;
  const hit = foliageCache.get(key);
  if (hit) return hit;

  if (foliageCache.size >= MAX_CACHE) {
    const firstKey = foliageCache.keys().next().value;
    if (firstKey) {
      const old = foliageCache.get(firstKey);
      old?.map.dispose();
      old?.bumpMap.dispose();
      old?.normalMap.dispose();
      foliageCache.delete(firstKey);
    }
  }

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = makeSeededRand(
    style.split('').reduce((acc, ch) => acc * 37 + ch.charCodeAt(0), 29)
  );

  const darkUnder = shiftHexLightness(baseColor, -0.18, 0.08, -0.02);
  const midTone = baseColor;
  const sunlit = shiftHexLightness(baseColor, 0.14, 0.04, 0.03);
  const highlight = shiftHexLightness(baseColor, 0.24, -0.02, 0.045);

  ctx.fillStyle = darkUnder;
  ctx.fillRect(0, 0, size, size);

  const drawWrapped = (fn: (ox: number, oy: number) => void) => {
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        fn(ox, oy);
      }
    }
  };

  if (style === 'clustered') {
    // Rich sculpted oak leaf rosettes
    for (let i = 0; i < 160; i++) {
      const cx = rand() * size;
      const cy = rand() * size;
      const r = 9 + rand() * 14;
      const tone = i < 45 ? darkUnder : i < 115 ? midTone : i < 145 ? sunlit : highlight;
      const rot = rand() * Math.PI * 2;
      ctx.fillStyle = tone;
      ctx.globalAlpha = 0.88;
      drawWrapped((ox, oy) => {
        if (cx + ox < -30 || cx + ox > size + 30 || cy + oy < -30 || cy + oy > size + 30) return;
        ctx.save();
        ctx.translate(cx + ox, cy + oy);
        ctx.rotate(rot);
        for (let p = 0; p < 3; p++) {
          ctx.beginPath();
          ctx.ellipse(Math.cos(p * 2.1) * r * 0.45, Math.sin(p * 2.1) * r * 0.45, r * 0.65, r * 0.36, p * 2.1, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });
    }
  } else if (style === 'softBrush') {
    // Soft painterly Ghibli-inspired brush dabs
    for (let i = 0; i < 140; i++) {
      const cx = rand() * size;
      const cy = rand() * size;
      const rx = 14 + rand() * 20;
      const ry = 10 + rand() * 14;
      const rot = rand() * Math.PI;
      ctx.fillStyle = i < 40 ? darkUnder : i < 100 ? midTone : sunlit;
      ctx.globalAlpha = 0.62;
      drawWrapped((ox, oy) => {
        if (cx + ox < -35 || cx + ox > size + 35 || cy + oy < -35 || cy + oy > size + 35) return;
        ctx.beginPath();
        ctx.ellipse(cx + ox, cy + oy, rx, ry, rot, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  } else if (style === 'crispStylized') {
    // Crisp high-contrast stylized geometric leaf blades
    for (let i = 0; i < 185; i++) {
      const cx = rand() * size;
      const cy = rand() * size;
      const len = 12 + rand() * 14;
      const wid = 6 + rand() * 7;
      const rot = rand() * Math.PI * 2;
      ctx.fillStyle = i < 50 ? darkUnder : i < 125 ? midTone : i < 165 ? sunlit : highlight;
      ctx.globalAlpha = 0.95;
      drawWrapped((ox, oy) => {
        if (cx + ox < -25 || cx + ox > size + 25 || cy + oy < -25 || cy + oy > size + 25) return;
        ctx.save();
        ctx.translate(cx + ox, cy + oy);
        ctx.rotate(rot);
        ctx.beginPath();
        ctx.moveTo(-len * 0.5, 0);
        ctx.quadraticCurveTo(0, -wid * 0.65, len * 0.5, 0);
        ctx.quadraticCurveTo(0, wid * 0.65, -len * 0.5, 0);
        ctx.fill();
        ctx.restore();
      });
    }
  } else {
    // Default 'painted': lush overlapping foliage strokes with bright rim dabs
    for (let i = 0; i < 190; i++) {
      const cx = rand() * size;
      const cy = rand() * size;
      const rx = 10 + rand() * 14;
      const ry = 6 + rand() * 9;
      const rot = rand() * Math.PI * 2;
      ctx.fillStyle = i < 55 ? darkUnder : i < 130 ? midTone : i < 170 ? sunlit : highlight;
      ctx.globalAlpha = 0.84;
      drawWrapped((ox, oy) => {
        if (cx + ox < -28 || cx + ox > size + 28 || cy + oy < -28 || cy + oy > size + 28) return;
        ctx.beginPath();
        ctx.ellipse(cx + ox, cy + oy, rx, ry, rot, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }

  ctx.globalAlpha = 1;
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.needsUpdate = true;

  const { bumpMap, normalMap } = deriveBumpAndNormalFromCanvas(canvas, 1.45, 2.1);
  const pair: ProceduralTexturePair = { map, bumpMap, normalMap };
  foliageCache.set(key, pair);
  return pair;
}

/**
 * Generates (and caches) a seamless, LEAF-FREE neutral-albedo procedural Canopy Base texture
 * (Smooth, Fine Grain, Organic Multi-Octave Noise, or Dappled Mottling) + Sobel normal map.
 * Neutral bright albedo ensures single base colors and vertex-color vertical gradients remain
 * pure and vivid while gaining tactile vector-paint grain or organic noise!
 */
export function getProceduralCanopyBaseTextures(
  pattern: CanopyBasePattern,
  strength = 0.42,
  scale = 1.2
): ProceduralTexturePair {
  const qStr = Math.round(THREE.MathUtils.clamp(strength, 0, 1) * 20) / 20;
  const qScale = Math.round(THREE.MathUtils.clamp(scale, 0.4, 3.0) * 10) / 10;
  const key = `${pattern}:${qStr}:${qScale}`;
  const hit = canopyBaseCache.get(key);
  if (hit) return hit;

  if (canopyBaseCache.size >= MAX_CACHE) {
    const firstKey = canopyBaseCache.keys().next().value;
    if (firstKey) {
      const old = canopyBaseCache.get(firstKey);
      old?.map.dispose();
      old?.bumpMap.dispose();
      old?.normalMap.dispose();
      canopyBaseCache.delete(firstKey);
    }
  }

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const d = img.data;

  // Periodic tileable value noise helper
  const periodicNoise = (x: number, y: number, period: number, seed: number): number => {
    const p = Math.max(2, Math.round(period));
    const fx = (x / size) * p;
    const fy = (y / size) * p;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const tx = fx - ix;
    const ty = fy - iy;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const x0 = ((ix % p) + p) % p;
    const y0 = ((iy % p) + p) % p;
    const x1 = (x0 + 1) % p;
    const y1 = (y0 + 1) % p;
    const v00 = hash2D(x0, y0, seed);
    const v10 = hash2D(x1, y0, seed);
    const v01 = hash2D(x0, y1, seed);
    const v11 = hash2D(x1, y1, seed);
    const a = v00 + (v10 - v00) * sx;
    const b = v01 + (v11 - v01) * sx;
    return a + (b - a) * sy;
  };

  const baseFreq = Math.max(3, Math.round(6 * qScale));
  const amp = pattern === 'smooth' ? qStr * 0.08 : qStr;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let n = 0.5;
      if (pattern === 'smooth') {
        const broad = periodicNoise(x, y, Math.max(2, Math.round(3 * qScale)), 11);
        n = 0.5 + (broad - 0.5) * 0.5;
      } else if (pattern === 'grain') {
        // Tactile paper / vector-paint fine grain + gentle broad undulation
        const fine = hash2D(
          Math.floor((x * Math.max(1, qScale)) % size),
          Math.floor((y * Math.max(1, qScale)) % size),
          47
        );
        const mid = periodicNoise(x, y, baseFreq * 3, 73);
        const broad = periodicNoise(x, y, baseFreq, 19);
        n = fine * 0.52 + mid * 0.3 + broad * 0.18;
      } else if (pattern === 'noise') {
        // Lush 3-octave seamless organic FBM noise
        const o1 = periodicNoise(x, y, baseFreq, 31);
        const o2 = periodicNoise(x, y, baseFreq * 2, 67);
        const o3 = periodicNoise(x, y, baseFreq * 4, 131);
        n = o1 * 0.56 + o2 * 0.3 + o3 * 0.14;
      } else {
        // 'dappled': painterly cloud-like dappled sunlight mottling
        const c1 = periodicNoise(x, y, Math.max(3, Math.round(4 * qScale)), 89);
        const c2 = periodicNoise(x, y, Math.max(6, Math.round(9 * qScale)), 173);
        const raw = c1 * 0.68 + c2 * 0.32;
        // Soft S-curve contrast for dappled light pools
        n = THREE.MathUtils.smoothstep(raw, 0.24, 0.78);
      }

      // Centered around neutral bright 228 so vertex color & base hex stay faithful and vivid
      const delta = (n - 0.5) * 124 * amp;
      const lum = THREE.MathUtils.clamp(Math.round(228 + delta), 112, 255);
      const idx = (y * size + x) * 4;
      d[idx] = lum;
      d[idx + 1] = lum;
      d[idx + 2] = lum;
      d[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.needsUpdate = true;

  const normalGain = pattern === 'smooth' ? 0.45 : pattern === 'grain' ? 1.1 : 1.7;
  const { bumpMap, normalMap } = deriveBumpAndNormalFromCanvas(canvas, 1.35, normalGain);
  const pair: ProceduralTexturePair = { map, bumpMap, normalMap };
  canopyBaseCache.set(key, pair);
  return pair;
}

let cachedLeafBladePair: ProceduralTexturePair | null = null;

/**
 * Generates (and caches) a crisp botanical veined leaf-blade texture + tangent-space normal map
 * so individual Birch leaves feel organically veined and textured under light!
 */
export function getProceduralLeafBladeTextures(): ProceduralTexturePair {
  if (cachedLeafBladePair) return cachedLeafBladePair;

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = makeSeededRand(9031);

  // Neutral bright albedo (tinted cleanly by per-leaf vertex colors!) with organic mottle & veins
  ctx.fillStyle = '#EEEEEE';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 240; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 3 + rand() * 9;
    ctx.fillStyle = rand() > 0.5 ? '#FFFFFF' : '#C8C8C8';
    ctx.globalAlpha = 0.32;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.65, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // Central midrib vein (bright raised ridge)
  ctx.globalAlpha = 0.95;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 3.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(size * 0.5, size * 0.04);
  ctx.lineTo(size * 0.5, size * 0.94);
  ctx.stroke();

  ctx.strokeStyle = '#969696';
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.moveTo(size * 0.5 - 2.4, size * 0.08);
  ctx.lineTo(size * 0.5 - 2.4, size * 0.9);
  ctx.stroke();

  for (let v = 1; v <= 6; v++) {
    const y0 = size * (0.12 + v * 0.125);
    const y1 = Math.min(size * 0.96, y0 + size * 0.16);
    const span = size * (0.42 - Math.abs(v - 3.2) * 0.07);
    for (const side of [-1, 1]) {
      ctx.strokeStyle = '#9C9C9C';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(size * 0.5, y0);
      ctx.quadraticCurveTo(size * 0.5 + side * span * 0.55, y0 + 5, size * 0.5 + side * span, y1);
      ctx.stroke();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(size * 0.5, y0 - 1.6);
      ctx.quadraticCurveTo(
        size * 0.5 + side * span * 0.55,
        y0 + 3.4,
        size * 0.5 + side * span,
        y1 - 1.6
      );
      ctx.stroke();
    }
  }

  ctx.globalAlpha = 1;
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.needsUpdate = true;

  const { bumpMap, normalMap } = deriveBumpAndNormalFromCanvas(canvas, 1.55, 2.2);
  cachedLeafBladePair = { map, bumpMap, normalMap };
  return cachedLeafBladePair;
}

let cachedPineFrondPair: ProceduralTexturePair | null = null;

/**
 * Generates (and caches) a neutral-white painterly pine-frond detail map + crisp tangent-space
 * normalMap! Neutral bright albedo ensures vertex-color Top-to-Bottom gradients stay 100% pure
 * and luminous while radiating needle ridges give tactile 3D surface relief!
 */
export function getProceduralPineFrondTextures(): ProceduralTexturePair {
  if (cachedPineFrondPair) return cachedPineFrondPair;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = makeSeededRand(7331);

  // Clean high-value base so vertex-color gradient is never muddied!
  ctx.fillStyle = '#EFEFEF';
  ctx.fillRect(0, 0, size, size);

  // Soft painterly mottled brush variation
  for (let i = 0; i < 160; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const rx = 6 + rand() * 14;
    const ry = 14 + rand() * 26;
    ctx.fillStyle = rand() > 0.45 ? '#FFFFFF' : '#D2D2D2';
    ctx.globalAlpha = 0.34;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, (rand() - 0.5) * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sculpted radiating pine needle grooves fanning lengthwise down each frond lobe (U = across, V = base->tip)
  ctx.lineCap = 'round';
  for (let i = 0; i < 140; i++) {
    const x0 = rand() * size;
    const y0 = rand() * size;
    const sideLean = (x0 / size - 0.5) * 28;
    const len = 26 + rand() * 38;
    const x1 = x0 + sideLean * 0.45 + (rand() - 0.5) * 10;
    const y1 = y0 + len;

    // Shadow groove
    ctx.strokeStyle = '#9E9E9E';
    ctx.lineWidth = 2.6;
    ctx.globalAlpha = 0.52;
    ctx.beginPath();
    ctx.moveTo(x0 - 1.5, y0);
    ctx.lineTo(x1 - 1.5, y1);
    ctx.stroke();

    // Raised bright needle spine
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.2;
    ctx.globalAlpha = 0.72;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  // Subtle central frond stem ridge
  ctx.strokeStyle = '#DCDCDC';
  ctx.lineWidth = 4.5;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.moveTo(size * 0.5, 0);
  ctx.lineTo(size * 0.5, size);
  ctx.stroke();

  ctx.globalAlpha = 1;
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.needsUpdate = true;

  const { bumpMap, normalMap } = deriveBumpAndNormalFromCanvas(canvas, 1.45, 2.1);
  cachedPineFrondPair = { map, bumpMap, normalMap };
  return cachedPineFrondPair;
}

