import * as THREE from 'three';
import type {
  BeamOrientation,
  BuildingBlockConfig,
  BuildingMaterialId,
  BuildingShapeId,
  DoorConfig,
  FenceStyleId,
  GameLevel,
  LevelEntity,
  RoofStyleId,
} from '../types/maker';
import { getTerrainTextureAtlas } from './proceduralTextures';

export interface BuildingMaterialMeta {
  id: BuildingMaterialId;
  label: string;
  swatch: string;
  roughness: number;
  metalness: number;
  category: 'stone' | 'earth' | 'wood' | 'roof' | 'metal';
}

export const BUILDING_MATERIALS: BuildingMaterialMeta[] = [
  { id: 'hewnStone', label: 'Hewn Stone', swatch: '#7D828F', roughness: 0.88, metalness: 0.04, category: 'stone' },
  { id: 'sandstone', label: 'Sandstone', swatch: '#D6B37C', roughness: 0.92, metalness: 0.0, category: 'stone' },
  { id: 'randomCobble', label: 'Cobblestone', swatch: '#767D73', roughness: 0.9, metalness: 0.03, category: 'stone' },
  { id: 'squareFlagstone', label: 'Flagstone', swatch: '#59606D', roughness: 0.86, metalness: 0.04, category: 'stone' },
  { id: 'crackedSlate', label: 'Cracked Slate', swatch: '#454B59', roughness: 0.84, metalness: 0.06, category: 'stone' },
  { id: 'masonryBrick', label: 'Masonry Brick', swatch: '#9A5140', roughness: 0.88, metalness: 0.02, category: 'stone' },
  { id: 'wattlePlaster', label: 'Lime Plaster', swatch: '#DFD4BC', roughness: 0.93, metalness: 0.0, category: 'stone' },
  { id: 'packedDirt', label: 'Packed Dirt', swatch: '#7D6147', roughness: 0.96, metalness: 0.0, category: 'earth' },
  { id: 'timberPlank', label: 'Timber Plank', swatch: '#8B5A34', roughness: 0.82, metalness: 0.02, category: 'wood' },
  { id: 'roundLogs', label: 'Cabin Logs', swatch: '#70482A', roughness: 0.9, metalness: 0.0, category: 'wood' },
  { id: 'weatheredSlats', label: 'Weathered Slats', swatch: '#7E7466', roughness: 0.92, metalness: 0.0, category: 'wood' },
  { id: 'thatchedStraw', label: 'Thatched Straw', swatch: '#BA9648', roughness: 0.95, metalness: 0.0, category: 'roof' },
  { id: 'clayTile', label: 'Clay Tile', swatch: '#B8553B', roughness: 0.8, metalness: 0.04, category: 'roof' },
  { id: 'woodShingle', label: 'Wood Shingle', swatch: '#7A573B', roughness: 0.87, metalness: 0.02, category: 'roof' },
  { id: 'rustedIron', label: 'Forged Iron', swatch: '#464C54', roughness: 0.52, metalness: 0.72, category: 'metal' },
];

export interface BuildingShapeMeta {
  id: BuildingShapeId;
  label: string;
  defaultName: string;
  defaultMaterial: BuildingMaterialId;
  stackHeight: number;
  baseSize: [number, number, number];
  blurb: string;
}

export const BUILDING_SHAPES: BuildingShapeMeta[] = [
  { id: 'wallCube', label: 'Wall Cube', defaultName: 'Stone Wall Cube', defaultMaterial: 'hewnStone', stackHeight: 2.0, baseSize: [2.0, 2.0, 2.0], blurb: '2×2×2m stackable masonry block' },
  { id: 'wallCubeHalf', label: 'Half Wall Cube', defaultName: 'Half Wall Cube', defaultMaterial: 'hewnStone', stackHeight: 1.0, baseSize: [1.0, 1.0, 1.0], blurb: '1×1×1m half-size block for quaint cottage walls' },
  { id: 'halfWall', label: 'Half Wall', defaultName: 'Low Wall', defaultMaterial: 'hewnStone', stackHeight: 1.0, baseSize: [2.0, 1.0, 0.72], blurb: '2×1m parapet & ledge wall' },
  { id: 'pillar', label: 'Pillar', defaultName: 'Stone Pillar', defaultMaterial: 'hewnStone', stackHeight: 2.0, baseSize: [0.88, 2.0, 0.88], blurb: '2m column with plinth & capital' },
  { id: 'floorTile', label: 'Floor Tile', defaultName: 'Floor Slab', defaultMaterial: 'squareFlagstone', stackHeight: 0.24, baseSize: [2.0, 0.24, 2.0], blurb: '2×2m walkable floor tile' },
  { id: 'stairsStraight', label: 'Stairs', defaultName: 'Stone Stairs', defaultMaterial: 'hewnStone', stackHeight: 2.0, baseSize: [1.96, 2.0, 2.0], blurb: 'Walkable 2m-tall staircase' },
  { id: 'stairsSpiral', label: 'Spiral Stairs', defaultName: 'Spiral Stairs', defaultMaterial: 'hewnStone', stackHeight: 2.0, baseSize: [2.2, 2.0, 2.2], blurb: 'Turning column & radial steps' },
  { id: 'archway', label: 'Archway', defaultName: 'Stone Archway', defaultMaterial: 'hewnStone', stackHeight: 2.4, baseSize: [2.0, 2.4, 0.74], blurb: 'Walk-through arched/rect gate' },
  { id: 'windowWall', label: 'Window Wall', defaultName: 'Window Wall', defaultMaterial: 'hewnStone', stackHeight: 2.0, baseSize: [2.0, 2.0, 0.56], blurb: 'Wall with open, barred, shuttered or paned window' },
  { id: 'roofAFrame', label: 'A-Frame Roof', defaultName: 'A-Frame Roof', defaultMaterial: 'thatchedStraw', stackHeight: 1.35, baseSize: [2.36, 1.35, 2.1], blurb: 'Pitched medieval A-frame roof with timber truss' },
  { id: 'roofSlope', label: 'Roof Slope', defaultName: 'Roof Slope', defaultMaterial: 'clayTile', stackHeight: 1.4, baseSize: [2.08, 1.4, 2.1], blurb: 'Single pitched roof bay for cabins & village shops' },
  { id: 'roofGable', label: 'Gable Wall', defaultName: 'Medieval Gable', defaultMaterial: 'wattlePlaster', stackHeight: 1.35, baseSize: [2.0, 1.35, 0.52], blurb: 'Triangular timber-framed gable end wall' },
  { id: 'fence', label: 'Fence', defaultName: 'Rustic Fence', defaultMaterial: 'timberPlank', stackHeight: 0.95, baseSize: [2.0, 0.95, 0.24], blurb: 'Modular picket, split-rail or medieval X-brace fence' },
  { id: 'porchSteps', label: 'Door Steps', defaultName: 'Front Door Steps', defaultMaterial: 'timberPlank', stackHeight: 0.56, baseSize: [2.0, 0.56, 1.12], blurb: 'Walkable wood or stone steps up to front doors' },
  { id: 'beamLarge', label: 'Large Beam', defaultName: 'Large Lumber Beam', defaultMaterial: 'timberPlank', stackHeight: 0.26, baseSize: [2.0, 0.26, 0.26], blurb: '2m structural timber beam (0°, 45°, 90° angles)' },
  { id: 'beamSmall', label: 'Small Beam', defaultName: 'Small Lumber Beam', defaultMaterial: 'timberPlank', stackHeight: 0.16, baseSize: [1.0, 0.16, 0.16], blurb: '1m window sill, brace & border trim beam' },
  { id: 'plankTrim', label: 'Wood Plank', defaultName: 'Rustic Plank', defaultMaterial: 'weatheredSlats', stackHeight: 0.12, baseSize: [2.0, 0.10, 0.38], blurb: '2m wide timber plank for siding, trim & shelves' },
  { id: 'trapdoor', label: 'Trapdoor', defaultName: 'Floor Trapdoor', defaultMaterial: 'timberPlank', stackHeight: 0.14, baseSize: [1.52, 0.14, 1.52], blurb: 'Interactive hinged floor hatch' },
  { id: 'wallTorch', label: 'Wall Torch', defaultName: 'Wall Sconce', defaultMaterial: 'rustedIron', stackHeight: 0.6, baseSize: [0.35, 0.6, 0.4], blurb: 'Mounted torch with flicker light' },
];

export function getBuildingShapeBaseSize(shape: BuildingShapeId): [number, number, number] {
  return BUILDING_SHAPES.find((s) => s.id === shape)?.baseSize ?? [2.0, 2.0, 2.0];
}

export function getBuildingBlockDimensions(
  bb: BuildingBlockConfig,
  entityScale = 1
): [number, number, number] {
  const [bw, bh, bd] = getBuildingShapeBaseSize(bb.shape);
  const s = Math.max(0.25, entityScale || 1);
  return [
    bw * s * (bb.scaleX ?? 1),
    bh * s * (bb.scaleY ?? 1),
    bd * s * (bb.scaleZ ?? 1),
  ];
}

export const DEFAULT_DOOR_CONFIG: DoorConfig = {
  frameShape: 'arched',
  leafStyle: 'woodPlank',
  openMode: 'hingedSide',
  slotStyle: 'none',
  frameMaterial: 'hewnStone',
  requiresKey: false,
};

export function roofStyleToMaterial(style: RoofStyleId): BuildingMaterialId {
  switch (style) {
    case 'thatched':
      return 'thatchedStraw';
    case 'tiled':
      return 'clayTile';
    case 'shingled':
      return 'woodShingle';
    case 'woodSlats':
      return 'weatheredSlats';
  }
}

export function inferRoofStyleFromMaterial(material: BuildingMaterialId): RoofStyleId {
  switch (material) {
    case 'clayTile':
      return 'tiled';
    case 'woodShingle':
      return 'shingled';
    case 'weatheredSlats':
    case 'timberPlank':
    case 'roundLogs':
      return 'woodSlats';
    case 'thatchedStraw':
    default:
      return 'thatched';
  }
}

interface CachedMaterialTexturePair {
  map: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
}

const extraMaterialTextures = new Map<string, CachedMaterialTexturePair>();

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(size = 256): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function toColorTex(canvas: HTMLCanvasElement, repeatX = 1, repeatY = 1): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function toDataTex(canvas: HTMLCanvasElement, repeatX = 1, repeatY = 1): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function getTimberPlankTextures(): CachedMaterialTexturePair {
  const cached = extraMaterialTextures.get('timberPlank');
  if (cached) return cached;
  const size = 256;
  const [c, ctx] = makeCanvas(size);
  const [b, bCtx] = makeCanvas(size);
  const rand = mulberry32(4101);

  ctx.fillStyle = '#4B2E19';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#303030';
  bCtx.fillRect(0, 0, size, size);

  const planks = 5;
  const ph = size / planks;
  for (let p = 0; p < planks; p++) {
    const y = p * ph + 2;
    const h = ph - 4;
    const baseR = 132 + Math.round((rand() - 0.5) * 26);
    const baseG = 86 + Math.round((rand() - 0.5) * 18);
    const baseB = 48 + Math.round((rand() - 0.5) * 12);
    ctx.fillStyle = `rgb(${baseR}, ${baseG}, ${baseB})`;
    ctx.fillRect(0, y, size, h);
    bCtx.fillStyle = '#C8C8C8';
    bCtx.fillRect(0, y, size, h);

    // Longitudinal grain streaks
    for (let g = 0; g < 22; g++) {
      const gy = y + 3 + rand() * (h - 6);
      const bright = rand() > 0.5;
      ctx.strokeStyle = bright ? 'rgba(204, 152, 102, 0.28)' : 'rgba(56, 32, 16, 0.34)';
      ctx.lineWidth = 1.2 + rand() * 1.4;
      bCtx.strokeStyle = bright ? 'rgba(220,220,220,0.35)' : 'rgba(90,90,90,0.35)';
      bCtx.lineWidth = ctx.lineWidth;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.bezierCurveTo(size * 0.33, gy + (rand() - 0.5) * 5, size * 0.66, gy + (rand() - 0.5) * 5, size, gy);
      ctx.stroke();
      bCtx.beginPath();
      bCtx.moveTo(0, gy);
      bCtx.lineTo(size, gy);
      bCtx.stroke();
    }

    // Iron nails at plank joint
    const jointX = ((p * 97 + 42) % (size - 24)) + 12;
    ctx.fillStyle = 'rgba(28, 20, 14, 0.85)';
    ctx.fillRect(jointX, y, 2, h);
    bCtx.fillStyle = '#242424';
    bCtx.fillRect(jointX, y, 2, h);
    for (const ny of [y + h * 0.28, y + h * 0.72]) {
      ctx.fillStyle = '#2B2F36';
      ctx.beginPath();
      ctx.arc(jointX - 7, ny, 2.2, 0, Math.PI * 2);
      ctx.arc(jointX + 8, ny, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const pair = { map: toColorTex(c), bump: toDataTex(b) };
  extraMaterialTextures.set('timberPlank', pair);
  return pair;
}

function getRoundLogsTextures(): CachedMaterialTexturePair {
  const cached = extraMaterialTextures.get('roundLogs');
  if (cached) return cached;
  const size = 256;
  const [c, ctx] = makeCanvas(size);
  const [b, bCtx] = makeCanvas(size);
  const rand = mulberry32(4202);

  ctx.fillStyle = '#332012';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#222222';
  bCtx.fillRect(0, 0, size, size);

  const logs = 4;
  const lh = size / logs;
  for (let l = 0; l < logs; l++) {
    const y0 = l * lh;
    const grad = ctx.createLinearGradient(0, y0, 0, y0 + lh);
    const tone = Math.round((rand() - 0.5) * 14);
    grad.addColorStop(0.0, '#362112');
    grad.addColorStop(0.18, `rgb(${112 + tone}, ${72 + tone}, ${42})`);
    grad.addColorStop(0.45, `rgb(${138 + tone}, ${90 + tone}, ${52})`);
    grad.addColorStop(0.82, `rgb(${84 + tone}, ${52 + tone}, ${30})`);
    grad.addColorStop(1.0, '#2C1A0E');
    ctx.fillStyle = grad;
    ctx.fillRect(0, y0, size, lh);

    const bGrad = bCtx.createLinearGradient(0, y0, 0, y0 + lh);
    bGrad.addColorStop(0.0, '#282828');
    bGrad.addColorStop(0.45, '#EAEAEA');
    bGrad.addColorStop(1.0, '#282828');
    bCtx.fillStyle = bGrad;
    bCtx.fillRect(0, y0, size, lh);

    // Rustic bark grain lines
    for (let g = 0; g < 26; g++) {
      const gy = y0 + 6 + rand() * (lh - 12);
      ctx.strokeStyle = rand() > 0.4 ? 'rgba(42, 24, 12, 0.36)' : 'rgba(176, 124, 80, 0.22)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(size, gy + (rand() - 0.5) * 4);
      ctx.stroke();
    }
  }
  const pair = { map: toColorTex(c), bump: toDataTex(b) };
  extraMaterialTextures.set('roundLogs', pair);
  return pair;
}

function getMasonryBrickTextures(): CachedMaterialTexturePair {
  const cached = extraMaterialTextures.get('masonryBrick');
  if (cached) return cached;
  const size = 256;
  const [c, ctx] = makeCanvas(size);
  const [b, bCtx] = makeCanvas(size);
  const rand = mulberry32(4303);

  ctx.fillStyle = '#736C62';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#383838';
  bCtx.fillRect(0, 0, size, size);

  const rows = 8;
  const cols = 4;
  const bh = size / rows;
  const bw = size / cols;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * (bw * 0.5);
    for (let col = -1; col <= cols; col++) {
      const x = col * bw + off + 2;
      const y = r * bh + 2;
      const w = bw - 4;
      const h = bh - 4;
      const red = Math.round(138 + rand() * 38);
      const grn = Math.round(68 + rand() * 24);
      const blu = Math.round(52 + rand() * 18);
      ctx.fillStyle = `rgb(${red}, ${grn}, ${blu})`;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(255, 215, 190, 0.14)';
      ctx.fillRect(x, y, w, 3);
      ctx.fillStyle = 'rgba(30, 12, 10, 0.25)';
      ctx.fillRect(x, y + h - 3, w, 3);

      const bv = Math.round(170 + rand() * 48);
      bCtx.fillStyle = `rgb(${bv}, ${bv}, ${bv})`;
      bCtx.fillRect(x, y, w, h);
    }
  }
  const pair = { map: toColorTex(c), bump: toDataTex(b) };
  extraMaterialTextures.set('masonryBrick', pair);
  return pair;
}

function getCrackedSlateTextures(): CachedMaterialTexturePair {
  const cached = extraMaterialTextures.get('crackedSlate');
  if (cached) return cached;
  const size = 256;
  const [c, ctx] = makeCanvas(size);
  const [b, bCtx] = makeCanvas(size);
  const rand = mulberry32(4404);

  ctx.fillStyle = '#2B303A';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#404040';
  bCtx.fillRect(0, 0, size, size);

  const rows = 4;
  const cols = 3;
  const bh = size / rows;
  const bw = size / cols;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * (bw * 0.35);
    for (let col = -1; col <= cols; col++) {
      const x = col * bw + off + 2;
      const y = r * bh + 2;
      const w = bw - 4;
      const h = bh - 4;
      const lum = Math.round(62 + rand() * 28);
      ctx.fillStyle = `rgb(${lum}, ${lum + 4}, ${lum + 13})`;
      ctx.fillRect(x, y, w, h);
      bCtx.fillStyle = `rgb(${155 + Math.round(rand() * 50)}, 175, 175)`;
      bCtx.fillRect(x, y, w, h);

      // Sharp angular fracture lines
      if (rand() > 0.35) {
        ctx.strokeStyle = 'rgba(18, 20, 28, 0.72)';
        ctx.lineWidth = 1.6;
        bCtx.strokeStyle = '#1E1E1E';
        bCtx.lineWidth = 2.0;
        const sx = x + w * (0.15 + rand() * 0.65);
        const sy = y + h * (0.1 + rand() * 0.35);
        const mx = sx + (rand() - 0.5) * 28;
        const my = sy + h * 0.38;
        const ex = mx + (rand() - 0.5) * 22;
        const ey = y + h - 3;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(mx, my);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        bCtx.beginPath();
        bCtx.moveTo(sx, sy);
        bCtx.lineTo(mx, my);
        bCtx.lineTo(ex, ey);
        bCtx.stroke();
      }
    }
  }
  const pair = { map: toColorTex(c), bump: toDataTex(b) };
  extraMaterialTextures.set('crackedSlate', pair);
  return pair;
}

function getRustedIronTextures(): CachedMaterialTexturePair {
  const cached = extraMaterialTextures.get('rustedIron');
  if (cached) return cached;
  const size = 256;
  const [c, ctx] = makeCanvas(size);
  const [b, bCtx] = makeCanvas(size);
  const rand = mulberry32(4505);

  ctx.fillStyle = '#4B525B';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#B8B8B8';
  bCtx.fillRect(0, 0, size, size);

  // Subtle hammered iron mottling & warm oxidation spots
  for (let i = 0; i < 120; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const rad = 6 + rand() * 18;
    const isRust = rand() > 0.62;
    ctx.fillStyle = isRust ? 'rgba(128, 66, 36, 0.24)' : 'rgba(98, 108, 120, 0.24)';
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
    bCtx.fillStyle = isRust ? 'rgba(84, 84, 84, 0.3)' : 'rgba(190, 190, 190, 0.25)';
    bCtx.beginPath();
    bCtx.arc(x, y, rad * 0.8, 0, Math.PI * 2);
    bCtx.fill();
  }

  // Border plate seam + corner rivets
  ctx.strokeStyle = 'rgba(22, 24, 28, 0.8)';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, size - 4, size - 4);
  bCtx.strokeStyle = '#383838';
  bCtx.lineWidth = 5;
  bCtx.strokeRect(2, 2, size - 4, size - 4);

  const rivetCoords = [18, size * 0.5, size - 18];
  for (const rx of rivetCoords) {
    for (const ry of rivetCoords) {
      if (rx === size * 0.5 && ry === size * 0.5) continue;
      ctx.fillStyle = '#6E7684';
      ctx.beginPath();
      ctx.arc(rx, ry, 5, 0, Math.PI * 2);
      ctx.fill();
      bCtx.fillStyle = '#FFFFFF';
      bCtx.beginPath();
      bCtx.arc(rx, ry, 5, 0, Math.PI * 2);
      bCtx.fill();
    }
  }
  const pair = { map: toColorTex(c), bump: toDataTex(b) };
  extraMaterialTextures.set('rustedIron', pair);
  return pair;
}

function getWattlePlasterTextures(): CachedMaterialTexturePair {
  const cached = extraMaterialTextures.get('wattlePlaster');
  if (cached) return cached;
  const size = 256;
  const [c, ctx] = makeCanvas(size);
  const [b, bCtx] = makeCanvas(size);
  const rand = mulberry32(4606);

  ctx.fillStyle = '#DCD0B7';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#B8B8B8';
  bCtx.fillRect(0, 0, size, size);

  for (let i = 0; i < 180; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 8 + rand() * 24;
    const warm = rand() > 0.45;
    ctx.fillStyle = warm ? 'rgba(232, 224, 204, 0.26)' : 'rgba(176, 160, 134, 0.22)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    bCtx.fillStyle = warm ? 'rgba(210, 210, 210, 0.22)' : 'rgba(148, 148, 148, 0.22)';
    bCtx.beginPath();
    bCtx.arc(x, y, r * 0.85, 0, Math.PI * 2);
    bCtx.fill();
  }

  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = 'rgba(130, 114, 90, 0.16)';
    ctx.lineWidth = 1;
    const sx = rand() * size;
    const sy = rand() * size;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + (rand() - 0.5) * 28, sy + (rand() - 0.5) * 28);
    ctx.stroke();
  }

  const pair = { map: toColorTex(c), bump: toDataTex(b) };
  extraMaterialTextures.set('wattlePlaster', pair);
  return pair;
}

function getWeatheredSlatsTextures(): CachedMaterialTexturePair {
  const cached = extraMaterialTextures.get('weatheredSlats');
  if (cached) return cached;
  const size = 256;
  const [c, ctx] = makeCanvas(size);
  const [b, bCtx] = makeCanvas(size);
  const rand = mulberry32(4707);

  ctx.fillStyle = '#38312A';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#242424';
  bCtx.fillRect(0, 0, size, size);

  const slats = 7;
  const sh = size / slats;
  for (let s = 0; s < slats; s++) {
    const y = s * sh + 2;
    const h = sh - 4;
    const base = 108 + Math.round((rand() - 0.5) * 28);
    const warm = Math.round((rand() - 0.5) * 14);
    ctx.fillStyle = `rgb(${base + 12 + warm}, ${base + 4 + Math.round(warm * 0.5)}, ${base - 8})`;
    ctx.fillRect(0, y, size, h);
    bCtx.fillStyle = `rgb(${175 + Math.round(rand() * 35)}, ${175 + Math.round(rand() * 35)}, ${175 + Math.round(rand() * 35)})`;
    bCtx.fillRect(0, y, size, h);

    // Sun-bleached streaks & dark split checks
    for (let g = 0; g < 18; g++) {
      const gy = y + 2 + rand() * (h - 4);
      const isSilver = rand() > 0.42;
      ctx.strokeStyle = isSilver ? 'rgba(182, 174, 160, 0.28)' : 'rgba(42, 34, 26, 0.34)';
      ctx.lineWidth = 1 + rand() * 1.3;
      bCtx.strokeStyle = isSilver ? 'rgba(218,218,218,0.28)' : 'rgba(65,65,65,0.35)';
      bCtx.lineWidth = ctx.lineWidth;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(size, gy + (rand() - 0.5) * 3);
      ctx.stroke();
      bCtx.beginPath();
      bCtx.moveTo(0, gy);
      bCtx.lineTo(size, gy);
      bCtx.stroke();
    }

    // Slat end seam + oxidized nail dots
    const seamX = ((s * 83 + 56) % (size - 28)) + 14;
    ctx.fillStyle = 'rgba(28, 22, 18, 0.8)';
    ctx.fillRect(seamX, y, 2, h);
    ctx.fillStyle = '#2B2B2D';
    ctx.beginPath();
    ctx.arc(seamX - 6, y + h * 0.5, 2, 0, Math.PI * 2);
    ctx.arc(seamX + 7, y + h * 0.5, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  const pair = { map: toColorTex(c), bump: toDataTex(b) };
  extraMaterialTextures.set('weatheredSlats', pair);
  return pair;
}

function getThatchTextures(): CachedMaterialTexturePair {
  const cached = extraMaterialTextures.get('thatchedStraw');
  if (cached) return cached;
  const size = 256;
  const [c, ctx] = makeCanvas(size);
  const [b, bCtx] = makeCanvas(size);
  const rand = mulberry32(4808);

  ctx.fillStyle = '#7C5D24';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#4A4A4A';
  bCtx.fillRect(0, 0, size, size);

  const courses = 6;
  const ch = size / courses;
  for (let row = 0; row < courses; row++) {
    const y0 = row * ch;
    const grad = ctx.createLinearGradient(0, y0, 0, y0 + ch);
    grad.addColorStop(0.0, '#6B5120');
    grad.addColorStop(0.25, '#BA9544');
    grad.addColorStop(0.78, '#CFA954');
    grad.addColorStop(1.0, '#4E3914');
    ctx.fillStyle = grad;
    ctx.fillRect(0, y0, size, ch);

    const bGrad = bCtx.createLinearGradient(0, y0, 0, y0 + ch);
    bGrad.addColorStop(0.0, '#3C3C3C');
    bGrad.addColorStop(0.65, '#DEDEDE');
    bGrad.addColorStop(1.0, '#282828');
    bCtx.fillStyle = bGrad;
    bCtx.fillRect(0, y0, size, ch);

    // Dense combed reed fibers along each course
    for (let s = 0; s < 140; s++) {
      const sx = rand() * size;
      const len = ch * (0.55 + rand() * 0.45);
      const sy = y0 + rand() * (ch - len * 0.4);
      const bright = rand() > 0.44;
      ctx.strokeStyle = bright ? 'rgba(232, 202, 118, 0.42)' : 'rgba(92, 66, 22, 0.44)';
      ctx.lineWidth = 1.2 + rand() * 1.4;
      bCtx.strokeStyle = bright ? 'rgba(242,242,242,0.45)' : 'rgba(62,62,62,0.42)';
      bCtx.lineWidth = ctx.lineWidth;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + (rand() - 0.5) * 4, Math.min(y0 + ch, sy + len));
      ctx.stroke();
      bCtx.beginPath();
      bCtx.moveTo(sx, sy);
      bCtx.lineTo(sx + (rand() - 0.5) * 3, Math.min(y0 + ch, sy + len));
      bCtx.stroke();
    }
  }

  const pair = { map: toColorTex(c), bump: toDataTex(b) };
  extraMaterialTextures.set('thatchedStraw', pair);
  return pair;
}

function getClayTileTextures(): CachedMaterialTexturePair {
  const cached = extraMaterialTextures.get('clayTile');
  if (cached) return cached;
  const size = 256;
  const [c, ctx] = makeCanvas(size);
  const [b, bCtx] = makeCanvas(size);
  const rand = mulberry32(4909);

  ctx.fillStyle = '#5C261A';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#323232';
  bCtx.fillRect(0, 0, size, size);

  const rows = 5;
  const cols = 6;
  const rh = size / rows;
  const cw = size / cols;
  for (let r = 0; r < rows; r++) {
    const y = r * rh;
    for (let col = 0; col < cols; col++) {
      const x = col * cw;
      const shade = Math.round((rand() - 0.5) * 26);
      const grad = ctx.createLinearGradient(x, y, x + cw, y);
      grad.addColorStop(0.0, `rgb(${128 + shade}, ${54 + Math.round(shade * 0.4)}, ${36})`);
      grad.addColorStop(0.45, `rgb(${198 + shade}, ${92 + Math.round(shade * 0.5)}, ${62})`);
      grad.addColorStop(1.0, `rgb(${114 + shade}, ${46 + Math.round(shade * 0.4)}, ${32})`);
      ctx.fillStyle = grad;
      ctx.fillRect(x + 1, y + 2, cw - 2, rh - 4);

      const bGrad = bCtx.createLinearGradient(x, y, x + cw, y);
      bGrad.addColorStop(0.0, '#4A4A4A');
      bGrad.addColorStop(0.48, '#F0F0F0');
      bGrad.addColorStop(1.0, '#3C3C3C');
      bCtx.fillStyle = bGrad;
      bCtx.fillRect(x + 1, y + 2, cw - 2, rh - 4);

      // Overlap bottom course shadow
      ctx.fillStyle = 'rgba(34, 12, 8, 0.48)';
      ctx.fillRect(x, y + rh - 5, cw, 5);
      bCtx.fillStyle = '#202020';
      bCtx.fillRect(x, y + rh - 4, cw, 4);
    }
  }

  const pair = { map: toColorTex(c), bump: toDataTex(b) };
  extraMaterialTextures.set('clayTile', pair);
  return pair;
}

function getWoodShingleTextures(): CachedMaterialTexturePair {
  const cached = extraMaterialTextures.get('woodShingle');
  if (cached) return cached;
  const size = 256;
  const [c, ctx] = makeCanvas(size);
  const [b, bCtx] = makeCanvas(size);
  const rand = mulberry32(5010);

  ctx.fillStyle = '#3B281A';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#2A2A2A';
  bCtx.fillRect(0, 0, size, size);

  const rows = 6;
  const cols = 5;
  const rh = size / rows;
  const cw = size / cols;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * (cw * 0.5);
    const y = r * rh;
    for (let col = -1; col <= cols; col++) {
      const x = col * cw + off + 1;
      const w = cw - 3;
      const h = rh - 3;
      const tone = Math.round((rand() - 0.5) * 28);
      ctx.fillStyle = `rgb(${118 + tone}, ${84 + Math.round(tone * 0.7)}, ${56 + Math.round(tone * 0.5)})`;
      ctx.fillRect(x, y + 1, w, h);

      const bVal = 155 + Math.round(rand() * 55);
      bCtx.fillStyle = `rgb(${bVal}, ${bVal}, ${bVal})`;
      bCtx.fillRect(x, y + 1, w, h);

      for (let g = 0; g < 6; g++) {
        const gx = x + 4 + rand() * (w - 8);
        ctx.strokeStyle = rand() > 0.5 ? 'rgba(60, 38, 22, 0.35)' : 'rgba(164, 126, 88, 0.22)';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(gx, y + 2);
        ctx.lineTo(gx + (rand() - 0.5) * 2, y + h);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(26, 16, 10, 0.42)';
      ctx.fillRect(x, y + h - 3, w, 3);
    }
  }

  const pair = { map: toColorTex(c), bump: toDataTex(b) };
  extraMaterialTextures.set('woodShingle', pair);
  return pair;
}

function getSandstoneTextures(): CachedMaterialTexturePair {
  const cached = extraMaterialTextures.get('sandstone');
  if (cached) return cached;
  const size = 256;
  const [c, ctx] = makeCanvas(size);
  const [b, bCtx] = makeCanvas(size);
  const rand = mulberry32(4955);

  const img = ctx.createImageData(size, size);
  const bImg = bCtx.createImageData(size, size);
  const d = img.data;
  const bd = bImg.data;

  // Seamless periodic sedimentary sandstone grain (zero block/grid lines)
  const TAU = Math.PI * 2;
  for (let y = 0; y < size; y++) {
    const v = (y / size) * TAU;
    for (let x = 0; x < size; x++) {
      const u = (x / size) * TAU;
      // Gentle sedimentary bedding waves + broad desert mineral mottling
      const strata =
        Math.sin(v * 3 + Math.sin(u * 2) * 0.65) * 0.55 +
        Math.sin(v * 7 - Math.cos(u * 3) * 0.45) * 0.3 +
        Math.cos(u * 2 + v * 1.0) * 0.15;
      const mottle =
        Math.sin(u * 4 + v * 2) * Math.cos(u * 3 - v * 5) * 0.6 +
        Math.sin(u * 9 + v * 8) * 0.4;
      const grit = (rand() - 0.5) * 2.0;

      const idx = (y * size + x) * 4;
      const tone = strata * 7.5 + mottle * 6.0 + grit * 7.0;
      d[idx] = Math.max(0, Math.min(255, Math.round(218 + tone)));
      d[idx + 1] = Math.max(0, Math.min(255, Math.round(181 + tone * 0.85)));
      d[idx + 2] = Math.max(0, Math.min(255, Math.round(126 + tone * 0.65)));
      d[idx + 3] = 255;

      const bumpVal = Math.max(
        0,
        Math.min(255, Math.round(132 + strata * 16 + mottle * 14 + grit * 26))
      );
      bd[idx] = bumpVal;
      bd[idx + 1] = bumpVal;
      bd[idx + 2] = bumpVal;
      bd[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  bCtx.putImageData(bImg, 0, 0);

  // Subtle mineral flecks & micro wind-eroded sand pits (wrapped across tile edges)
  for (let i = 0; i < 420; i++) {
    const px = rand() * size;
    const py = rand() * size;
    const rad = 0.6 + rand() * 1.4;
    const dark = rand() > 0.35;
    ctx.fillStyle = dark ? 'rgba(136, 98, 54, 0.18)' : 'rgba(248, 232, 198, 0.18)';
    bCtx.fillStyle = dark ? 'rgba(65, 65, 65, 0.24)' : 'rgba(208, 208, 208, 0.16)';
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const cx = px + ox;
        const cy = py + oy;
        if (cx < -4 || cx > size + 4 || cy < -4 || cy > size + 4) continue;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, TAU);
        ctx.fill();
        bCtx.beginPath();
        bCtx.arc(cx, cy, rad, 0, TAU);
        bCtx.fill();
      }
    }
  }

  const pair = { map: toColorTex(c), bump: toDataTex(b) };
  extraMaterialTextures.set('sandstone', pair);
  return pair;
}

export function createBuildingSurfaceMaterial(materialId: BuildingMaterialId): THREE.MeshStandardMaterial {
  const atlas = getTerrainTextureAtlas();
  const meta = BUILDING_MATERIALS.find((m) => m.id === materialId) ?? BUILDING_MATERIALS[0];
  let map: THREE.Texture | null = null;
  let bumpMap: THREE.Texture | null = null;
  let bumpScale = 0.08;
  let color = '#FFFFFF';

  switch (materialId) {
    case 'hewnStone':
      map = atlas.castleWall;
      bumpMap = atlas.castleWall;
      bumpScale = 0.08;
      color = '#D8DCE6';
      break;
    case 'sandstone': {
      const pair = getSandstoneTextures();
      map = pair.map;
      bumpMap = pair.bump;
      bumpScale = 0.095;
      color = '#F7EBD8';
      break;
    }
    case 'randomCobble':
      map = atlas.cobble;
      bumpMap = atlas.cobble;
      bumpScale = 0.11;
      color = '#DFDDD6';
      break;
    case 'squareFlagstone':
      map = atlas.dungeonFlagstone;
      bumpMap = atlas.dungeonFlagstone;
      bumpScale = 0.09;
      color = '#D2D8E4';
      break;
    case 'crackedSlate': {
      const pair = getCrackedSlateTextures();
      map = pair.map;
      bumpMap = pair.bump;
      bumpScale = 0.12;
      break;
    }
    case 'masonryBrick': {
      const pair = getMasonryBrickTextures();
      map = pair.map;
      bumpMap = pair.bump;
      bumpScale = 0.1;
      break;
    }
    case 'wattlePlaster': {
      const pair = getWattlePlasterTextures();
      map = pair.map;
      bumpMap = pair.bump;
      bumpScale = 0.06;
      break;
    }
    case 'packedDirt':
      map = atlas.dirt;
      bumpMap = atlas.dirt;
      bumpScale = 0.06;
      color = '#C9B296';
      break;
    case 'timberPlank': {
      const pair = getTimberPlankTextures();
      map = pair.map;
      bumpMap = pair.bump;
      bumpScale = 0.09;
      break;
    }
    case 'roundLogs': {
      const pair = getRoundLogsTextures();
      map = pair.map;
      bumpMap = pair.bump;
      bumpScale = 0.14;
      break;
    }
    case 'weatheredSlats': {
      const pair = getWeatheredSlatsTextures();
      map = pair.map;
      bumpMap = pair.bump;
      bumpScale = 0.1;
      break;
    }
    case 'thatchedStraw': {
      const pair = getThatchTextures();
      map = pair.map;
      bumpMap = pair.bump;
      bumpScale = 0.15;
      break;
    }
    case 'clayTile': {
      const pair = getClayTileTextures();
      map = pair.map;
      bumpMap = pair.bump;
      bumpScale = 0.13;
      break;
    }
    case 'woodShingle': {
      const pair = getWoodShingleTextures();
      map = pair.map;
      bumpMap = pair.bump;
      bumpScale = 0.12;
      break;
    }
    case 'rustedIron': {
      const pair = getRustedIronTextures();
      map = pair.map;
      bumpMap = pair.bump;
      bumpScale = 0.08;
      break;
    }
    default:
      map = atlas.castleWall;
      color = meta.swatch;
      break;
  }

  return new THREE.MeshStandardMaterial({
    color,
    map,
    bumpMap,
    bumpScale,
    roughness: meta.roughness,
    metalness: meta.metalness,
  });
}

export function createIronHardwareMaterial(): THREE.MeshStandardMaterial {
  const pair = getRustedIronTextures();
  return new THREE.MeshStandardMaterial({
    color: '#9AA2B0',
    map: pair.map,
    bumpMap: pair.bump,
    bumpScale: 0.06,
    roughness: 0.42,
    metalness: 0.8,
  });
}

export function createDarkWoodMaterial(): THREE.MeshStandardMaterial {
  const pair = getTimberPlankTextures();
  return new THREE.MeshStandardMaterial({
    color: '#D6C2AA',
    map: pair.map,
    bumpMap: pair.bump,
    bumpScale: 0.07,
    roughness: 0.8,
    metalness: 0.04,
  });
}

export function enableShadows(mesh: THREE.Object3D): void {
  mesh.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = !o.userData?.noCastShadow;
      o.receiveShadow = true;
    }
  });
}

export const WORLD_TEX_TILE_METERS = 2.0;

function materialHasDiffuseMap(material: THREE.Material | THREE.Material[]): boolean {
  const mats = Array.isArray(material) ? material : [material];
  return mats.some((m) => Boolean((m as THREE.MeshStandardMaterial).map));
}

/**
 * Re-projects/scales UVs on textured sub-meshes so surface textures (bricks, stone,
 * planks, shingles, thatch, plaster) maintain constant real-world texel density
 * (~2.0m per repeat) regardless of Width/Height/Length or uniform Size scaling.
 */
export function normalizeWorldSpaceUVs(
  root: THREE.Group,
  totalSx: number,
  totalSy: number,
  totalSz: number
): void {
  const sx = Math.max(0.05, totalSx);
  const sy = Math.max(0.05, totalSy);
  const sz = Math.max(0.05, totalSz);

  root.updateMatrixWorld(true);
  const scaleMat = new THREE.Matrix4().makeScale(sx, sy, sz);
  const physMat = new THREE.Matrix4();
  const normMat = new THREE.Matrix3();

  const seenGeos = new Set<THREE.BufferGeometry>();
  const p0 = new THREE.Vector3();
  const p1 = new THREE.Vector3();
  const p2 = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const nTmp = new THREE.Vector3();

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData?.noUvNormalize) return;
    if (!materialHasDiffuseMap(mesh.material)) return;

    let geo = mesh.geometry;
    if (!geo || geo.type === 'TorusGeometry') return;

    const posAttr = geo.attributes.position as THREE.BufferAttribute | undefined;
    const uvAttr = geo.attributes.uv as THREE.BufferAttribute | undefined;
    if (!posAttr || !uvAttr) return;

    if (seenGeos.has(geo)) {
      geo = geo.clone();
      mesh.geometry = geo;
    }
    seenGeos.add(geo);

    const pos = geo.attributes.position as THREE.BufferAttribute;
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    const norm = geo.attributes.normal as THREE.BufferAttribute | undefined;

    physMat.multiplyMatrices(scaleMat, mesh.matrixWorld);

    if (mesh.userData?.usePlanarMeterUV && norm) {
      normMat.getNormalMatrix(physMat);
      for (let i = 0; i < pos.count; i++) {
        p0.fromBufferAttribute(pos, i).applyMatrix4(physMat);
        nTmp.fromBufferAttribute(norm, i).applyMatrix3(normMat).normalize();
        const ax = Math.abs(nTmp.x);
        const ay = Math.abs(nTmp.y);
        const az = Math.abs(nTmp.z);
        if (az >= ax && az >= ay) {
          uv.setXY(i, p0.x / WORLD_TEX_TILE_METERS + 0.5, p0.y / WORLD_TEX_TILE_METERS);
        } else if (ax >= az && ax >= ay) {
          uv.setXY(i, p0.z / WORLD_TEX_TILE_METERS + 0.5, p0.y / WORLD_TEX_TILE_METERS);
        } else {
          uv.setXY(i, p0.x / WORLD_TEX_TILE_METERS + 0.5, p0.z / WORLD_TEX_TILE_METERS + 0.5);
        }
      }
      uv.needsUpdate = true;
      return;
    }

    const vCount = pos.count;
    const uSum = new Float64Array(vCount);
    const vSum = new Float64Array(vCount);
    const wSum = new Float64Array(vCount);

    const idx = geo.index;
    const triCount = idx ? Math.floor(idx.count / 3) : Math.floor(vCount / 3);

    for (let t = 0; t < triCount; t++) {
      const i0 = idx ? idx.getX(t * 3) : t * 3;
      const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
      const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;

      p0.fromBufferAttribute(pos, i0).applyMatrix4(physMat);
      p1.fromBufferAttribute(pos, i1).applyMatrix4(physMat);
      p2.fromBufferAttribute(pos, i2).applyMatrix4(physMat);

      const u0 = uv.getX(i0);
      const v0 = uv.getY(i0);
      const u1 = uv.getX(i1);
      const v1 = uv.getY(i1);
      const u2 = uv.getX(i2);
      const v2 = uv.getY(i2);

      const du1 = u1 - u0;
      const dv1 = v1 - v0;
      const du2 = u2 - u0;
      const dv2 = v2 - v0;
      const det = du1 * dv2 - du2 * dv1;
      const absDet = Math.abs(det);
      if (absDet < 1e-8) continue;

      e1.subVectors(p1, p0);
      e2.subVectors(p2, p0);

      const invDet = 1 / det;
      const dpduX = (e1.x * dv2 - e2.x * dv1) * invDet;
      const dpduY = (e1.y * dv2 - e2.y * dv1) * invDet;
      const dpduZ = (e1.z * dv2 - e2.z * dv1) * invDet;
      const uMeters = Math.hypot(dpduX, dpduY, dpduZ);

      const dpdvX = (e2.x * du1 - e1.x * du2) * invDet;
      const dpdvY = (e2.y * du1 - e1.y * du2) * invDet;
      const dpdvZ = (e2.z * du1 - e1.z * du2) * invDet;
      const vMeters = Math.hypot(dpdvX, dpdvY, dpdvZ);

      const w = absDet;
      uSum[i0] += uMeters * w;
      uSum[i1] += uMeters * w;
      uSum[i2] += uMeters * w;
      vSum[i0] += vMeters * w;
      vSum[i1] += vMeters * w;
      vSum[i2] += vMeters * w;
      wSum[i0] += w;
      wSum[i1] += w;
      wSum[i2] += w;
    }

    const isCylinder = geo.type === 'CylinderGeometry';
    let barrelUSum = 0;
    let barrelW = 0;
    if (isCylinder && norm) {
      for (let i = 0; i < vCount; i++) {
        if (wSum[i] > 0 && Math.abs(norm.getY(i)) < 0.7) {
          barrelUSum += uSum[i] / wSum[i];
          barrelW += 1;
        }
      }
    }
    const barrelUScale =
      barrelW > 0 ? Math.max(1, Math.round(barrelUSum / barrelW / WORLD_TEX_TILE_METERS)) : 1;

    for (let i = 0; i < vCount; i++) {
      if (wSum[i] <= 0) continue;
      let uScale = uSum[i] / wSum[i] / WORLD_TEX_TILE_METERS;
      const vScale = vSum[i] / wSum[i] / WORLD_TEX_TILE_METERS;
      if (isCylinder && norm && Math.abs(norm.getY(i)) < 0.7) {
        uScale = barrelUScale;
      }
      uv.setXY(i, uv.getX(i) * uScale, uv.getY(i) * vScale);
    }

    uv.needsUpdate = true;
  });
}

function smoothstepJs(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0 || 1e-6), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Builds a subdivided, watertight beveled & chamfered stone block where edges
 * naturally taper inward so stacked blocks create authentic recessed joints and
 * contact shadows without drawn grid lines.
 * `edgeWear` (0..1) considerably erodes bevels, chamfers, and corners.
 */
export function createOrganicStoneBoxGeometry(
  baseW: number,
  baseH: number,
  baseD: number,
  sx: number,
  sy: number,
  sz: number,
  edgeWear: number,
  seed = 0,
  minChamfer = 0.06
): THREE.BufferGeometry {
  const physW = Math.max(0.15, baseW * sx);
  const physH = Math.max(0.15, baseH * sy);
  const physD = Math.max(0.15, baseD * sz);

  const segX = Math.max(8, Math.min(18, Math.round(physW * 7)));
  const segY = Math.max(8, Math.min(18, Math.round(physH * 7)));
  const segZ = Math.max(8, Math.min(18, Math.round(physD * 7)));

  const geo = new THREE.BoxGeometry(baseW, baseH, baseD, segX, segY, segZ);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const origNorm = geo.attributes.normal as THREE.BufferAttribute;
  const uv = geo.attributes.uv as THREE.BufferAttribute;

  const hx = physW * 0.5;
  const hy = physH * 0.5;
  const hz = physD * 0.5;
  const minHalf = Math.min(hx, hy, hz);
  const w = THREE.MathUtils.clamp(edgeWear, 0, 1);

  const baseR = Math.min(minHalf * 0.32, minChamfer);
  const maxBevel = Math.min(minHalf * 0.45, baseR + w * 0.28);

  const pA = ((seed * 1.731) % 100) * 0.13 + 0.4;
  const pB = ((seed * 3.197) % 100) * 0.17 + 1.1;
  const pC = ((seed * 5.413) % 100) * 0.19 + 2.3;

  // Bake meter-locked face UVs before tapering so bevels wrap smoothly without stretching
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i) * sx;
    const py = pos.getY(i) * sy;
    const pz = pos.getZ(i) * sz;
    const nx = origNorm.getX(i);
    const ny = origNorm.getY(i);
    const nz = origNorm.getZ(i);

    if (Math.abs(nz) >= Math.abs(nx) && Math.abs(nz) >= Math.abs(ny)) {
      uv.setXY(i, (px + hx) / WORLD_TEX_TILE_METERS, (py + hy) / WORLD_TEX_TILE_METERS);
    } else if (Math.abs(nx) >= Math.abs(nz) && Math.abs(nx) >= Math.abs(ny)) {
      uv.setXY(i, (pz + hz) / WORLD_TEX_TILE_METERS, (py + hy) / WORLD_TEX_TILE_METERS);
    } else {
      uv.setXY(i, (px + hx) / WORLD_TEX_TILE_METERS, (pz + hz) / WORLD_TEX_TILE_METERS);
    }

    // Spatial organic stone noise fields in physical meters
    const nMacro =
      Math.sin(px * 1.85 + pA) * Math.cos(py * 1.65 - pB) * 0.55 +
      Math.sin(pz * 1.95 + py * 1.4 - pC) * 0.45;
    const nMed =
      Math.sin(px * 4.3 + py * 3.9 + pB) * Math.cos(pz * 4.7 - px * 2.8 + pA) * 0.6 +
      Math.sin(py * 5.6 - pz * 4.1 + pC) * 0.4;
    const nChip =
      Math.sin(px * 8.9 - pz * 7.7 + pC) * Math.cos(py * 9.3 + px * 6.1 - pA) * 0.65 +
      Math.sin((px + py + pz) * 11.4 + pB) * 0.35;

    const fx = hx - Math.abs(px);
    const fy = hy - Math.abs(py);
    const fz = hz - Math.abs(pz);

    // Sort face distances ascending -> dMid = distance to nearest edge
    let dMin = fx;
    let dMid = fy;
    let dMax = fz;
    if (dMin > dMid) [dMin, dMid] = [dMid, dMin];
    if (dMid > dMax) [dMid, dMax] = [dMax, dMid];
    if (dMin > dMid) [dMin, dMid] = [dMid, dMin];

    const rRaw = maxBevel * (0.8 + 0.28 * nMacro + 0.38 * w * nMed);
    const rLocal = THREE.MathUtils.clamp(rRaw, Math.min(minHalf * 0.25, minChamfer * 0.6), minHalf * 0.48);

    const cx = Math.max(0, hx - rLocal);
    const cy = Math.max(0, hy - rLocal);
    const cz = Math.max(0, hz - rLocal);

    const qx = THREE.MathUtils.clamp(px, -cx, cx);
    const qy = THREE.MathUtils.clamp(py, -cy, cy);
    const qz = THREE.MathUtils.clamp(pz, -cz, cz);

    const dx = px - qx;
    const dy = py - qy;
    const dz = pz - qz;
    const dLen = Math.hypot(dx, dy, dz);

    let outX = px;
    let outY = py;
    let outZ = pz;

    if (dLen > 1e-6) {
      const dirX = dx / dLen;
      const dirY = dy / dLen;
      const dirZ = dz / dLen;

      // Rounded bevel vs flat 45-degree stone chamfer blend
      const roundX = qx + dirX * rLocal;
      const roundY = qy + dirY * rLocal;
      const roundZ = qz + dirZ * rLocal;

      const l1 = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
      const chamferScale = l1 > 1e-6 ? Math.min(1, rLocal / Math.max(rLocal, l1 * 0.72)) : 1;
      const chamX = qx + dx * chamferScale;
      const chamY = qy + dy * chamferScale;
      const chamZ = qz + dz * chamferScale;

      const chamferBlend = THREE.MathUtils.clamp(0.45 - w * 0.14 + nMacro * 0.3, 0, 1);
      outX = THREE.MathUtils.lerp(roundX, chamX, chamferBlend);
      outY = THREE.MathUtils.lerp(roundY, chamY, chamferBlend);
      outZ = THREE.MathUtils.lerp(roundZ, chamZ, chamferBlend);

      // Edge & corner spall chips that eat considerably into bevels/chamfers at high edgeWear
      const edgeProx = 1 - smoothstepJs(0, maxBevel * 1.45 + 0.04, dMid);
      const cornerProx = 1 - smoothstepJs(0, maxBevel * 1.9 + 0.06, dMid + dMax * 0.42);
      const spallFactor = Math.max(0, nChip * 0.65 + nMed * 0.35 + 0.22);
      const edgeChip =
        edgeProx * w * (0.032 + 0.145 * spallFactor) +
        cornerProx * w * (0.045 + 0.095 * Math.max(0, nMacro + 0.45));

      // Gentle inward organic stone undulation across faces (<= 0 so stacked blocks never protrude)
      const faceRelief =
        (1 - edgeProx) *
        (0.006 + 0.026 * w) *
        Math.max(0, nMed * 0.55 + nMacro * 0.25 + 0.35);

      const totalInset = Math.min(minHalf * 0.42, edgeChip + faceRelief);
      outX -= dirX * totalInset;
      outY -= dirY * totalInset;
      outZ -= dirZ * totalInset;
    }

    pos.setXYZ(i, outX / sx, outY / sy, outZ / sz);
  }

  pos.needsUpdate = true;
  uv.needsUpdate = true;
  geo.computeVertexNormals();

  // Weld spatial normals across BoxGeometry seam edges so beveled joints shade smoothly
  const norm = geo.attributes.normal as THREE.BufferAttribute;
  const acc = new Map<string, [number, number, number]>();
  for (let i = 0; i < pos.count; i++) {
    const key = `${Math.round(pos.getX(i) * 400)},${Math.round(pos.getY(i) * 400)},${Math.round(pos.getZ(i) * 400)}`;
    const entry = acc.get(key);
    const nx = norm.getX(i);
    const ny = norm.getY(i);
    const nz = norm.getZ(i);
    if (entry) {
      entry[0] += nx;
      entry[1] += ny;
      entry[2] += nz;
    } else {
      acc.set(key, [nx, ny, nz]);
    }
  }
  for (let i = 0; i < pos.count; i++) {
    const key = `${Math.round(pos.getX(i) * 400)},${Math.round(pos.getY(i) * 400)},${Math.round(pos.getZ(i) * 400)}`;
    const sum = acc.get(key)!;
    const len = Math.hypot(sum[0], sum[1], sum[2]) || 1;
    norm.setXYZ(i, sum[0] / len, sum[1] / len, sum[2] / len);
  }
  norm.needsUpdate = true;
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Builds a modular structural dungeon / cabin building block mesh with
 * subdivided geometries compatible with Wear Intensity denting & Vertex Paint.
 */
export function buildBuildingBlockMesh(
  config: BuildingBlockConfig,
  entityScale = 1,
  blockSeed = 0
): THREE.Group {
  const group = new THREE.Group();
  const mat = createBuildingSurfaceMaterial(config.material);
  const ironMat = createIronHardwareMaterial();
  const trimWoodMat = createDarkWoodMaterial();

  const sx = THREE.MathUtils.clamp(config.scaleX ?? 1, 0.1, 8);
  const sy = THREE.MathUtils.clamp(config.scaleY ?? 1, 0.1, 8);
  const sz = THREE.MathUtils.clamp(config.scaleZ ?? 1, 0.1, 8);
  const uniformScale = THREE.MathUtils.clamp(entityScale, 0.25, 8);

  const isSandstone = config.material === 'sandstone';
  // Sandstone is strictly a solid organic stone cube (2m or 1m half cube)
  const resolvedShape: BuildingShapeId = isSandstone
    ? config.shape === 'wallCubeHalf'
      ? 'wallCubeHalf'
      : 'wallCube'
    : config.shape;
  const effectiveEdgeWear =
    config.edgeWear !== undefined
      ? THREE.MathUtils.clamp(config.edgeWear, 0, 1)
      : isSandstone
      ? 0.35
      : 0;

  switch (resolvedShape) {
    case 'wallCube': {
      const useOrganicBevel = isSandstone || effectiveEdgeWear > 0.005;
      const cubeGeo = useOrganicBevel
        ? createOrganicStoneBoxGeometry(
            2.0,
            2.0,
            2.0,
            sx * uniformScale,
            sy * uniformScale,
            sz * uniformScale,
            effectiveEdgeWear,
            blockSeed,
            isSandstone ? 0.065 : 0.03
          )
        : new THREE.BoxGeometry(2.0, 2.0, 2.0, 6, 6, 6);
      const cube = new THREE.Mesh(cubeGeo, mat);
      if (useOrganicBevel) cube.userData.noUvNormalize = true;
      cube.position.y = 1.0;
      group.add(cube);
      break;
    }

    case 'wallCubeHalf': {
      const useOrganicBevel = isSandstone || effectiveEdgeWear > 0.005;
      const cubeGeo = useOrganicBevel
        ? createOrganicStoneBoxGeometry(
            1.0,
            1.0,
            1.0,
            sx * uniformScale,
            sy * uniformScale,
            sz * uniformScale,
            effectiveEdgeWear,
            blockSeed,
            isSandstone ? 0.055 : 0.025
          )
        : new THREE.BoxGeometry(1.0, 1.0, 1.0, 5, 5, 5);
      const cube = new THREE.Mesh(cubeGeo, mat);
      if (useOrganicBevel) cube.userData.noUvNormalize = true;
      cube.position.y = 0.5;
      group.add(cube);
      break;
    }

    case 'halfWall': {
      const useOrganicBevel = effectiveEdgeWear > 0.005;
      const bodyGeo = useOrganicBevel
        ? createOrganicStoneBoxGeometry(
            2.0,
            0.9,
            0.68,
            sx * uniformScale,
            sy * uniformScale,
            sz * uniformScale,
            effectiveEdgeWear,
            blockSeed,
            0.025
          )
        : new THREE.BoxGeometry(2.0, 0.9, 0.68, 6, 4, 3);
      const body = new THREE.Mesh(bodyGeo, mat);
      if (useOrganicBevel) body.userData.noUvNormalize = true;
      body.position.y = 0.45;
      const capGeo = useOrganicBevel
        ? createOrganicStoneBoxGeometry(
            2.04,
            0.12,
            0.76,
            sx * uniformScale,
            sy * uniformScale,
            sz * uniformScale,
            effectiveEdgeWear,
            blockSeed + 17,
            0.02
          )
        : new THREE.BoxGeometry(2.04, 0.12, 0.76, 6, 1, 2);
      const cap = new THREE.Mesh(capGeo, mat);
      if (useOrganicBevel) cap.userData.noUvNormalize = true;
      cap.position.y = 0.95;
      group.add(body, cap);
      break;
    }

    case 'pillar': {
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.24, 0.88, 3, 2, 3), mat);
      plinth.position.y = 0.12;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 1.54, 10, 6), mat);
      shaft.position.y = 1.01;
      const capital = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.22, 0.84, 3, 2, 3), mat);
      capital.position.y = 1.89;
      group.add(plinth, shaft, capital);
      break;
    }

    case 'floorTile': {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.24, 2.0, 6, 2, 6), mat);
      slab.position.y = 0.12;
      group.add(slab);
      break;
    }

    case 'stairsStraight': {
      const stepCount = 8;
      const totalRun = 2.0;
      const totalRise = 2.0;
      const stepDepth = totalRun / stepCount;
      const stepHeight = totalRise / stepCount;
      for (let i = 0; i < stepCount; i++) {
        const h = stepHeight * (i + 1);
        const zCenter = 1.0 - stepDepth * (i + 0.5);
        const tread = new THREE.Mesh(
          new THREE.BoxGeometry(1.96, h, stepDepth + 0.01, 5, Math.max(2, Math.ceil(h * 2)), 2),
          mat
        );
        tread.position.set(0, h * 0.5, zCenter);
        group.add(tread);
      }
      break;
    }

    case 'stairsSpiral': {
      const column = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 2.1, 10, 6), mat);
      column.position.y = 1.05;
      group.add(column);

      const stepCount = 10;
      const totalRise = 2.0;
      const totalTurn = Math.PI * 1.25;
      for (let i = 0; i < stepCount; i++) {
        const frac = (i + 1) / stepCount;
        const yaw = i * (totalTurn / stepCount);
        const h = 0.18;
        const yCenter = frac * totalRise - h * 0.5;
        const pivot = new THREE.Group();
        pivot.position.y = yCenter;
        pivot.rotation.y = yaw;
        const tread = new THREE.Mesh(new THREE.BoxGeometry(1.18, h, 0.44, 4, 2, 2), mat);
        tread.position.x = 0.72;
        pivot.add(tread);
        group.add(pivot);
      }
      break;
    }

    case 'archway': {
      const jambGeo = new THREE.BoxGeometry(0.42, 1.92, 0.7, 3, 6, 3);
      const jambL = new THREE.Mesh(jambGeo, mat);
      jambL.position.set(-0.79, 0.96, 0);
      const jambR = new THREE.Mesh(jambGeo, mat);
      jambR.position.set(0.79, 0.96, 0);
      group.add(jambL, jambR);

      if (config.archStyle === 'rectangular') {
        const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.46, 0.76, 6, 3, 3), mat);
        lintel.position.y = 2.15;
        group.add(lintel);
      } else {
        // 5-voussoir stone arch spanning x = -0.79 .. +0.79
        for (let i = 0; i < 5; i++) {
          const theta = Math.PI * 0.12 + (i / 4) * Math.PI * 0.76;
          const block = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.42, 0.74, 3, 2, 3), mat);
          block.position.set(-Math.cos(theta) * 0.76, 1.72 + Math.sin(theta) * 0.62, 0);
          block.rotation.z = theta - Math.PI / 2;
          group.add(block);
        }
      }
      break;
    }

    case 'windowWall': {
      const sill = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.84, 0.56, 6, 3, 3), mat);
      sill.position.y = 0.42;
      const pierGeo = new THREE.BoxGeometry(0.52, 0.84, 0.56, 3, 4, 3);
      const pierL = new THREE.Mesh(pierGeo, mat);
      pierL.position.set(-0.74, 1.26, 0);
      const pierR = new THREE.Mesh(pierGeo, mat);
      pierR.position.set(0.74, 1.26, 0);
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.34, 0.56, 6, 2, 3), mat);
      lintel.position.y = 1.85;
      const sillLedge = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 0.66, 4, 1, 2), mat);
      sillLedge.position.y = 0.86;
      group.add(sill, pierL, pierR, lintel, sillLedge);

      const wStyle = config.windowStyle ?? 'barred';
      if (wStyle === 'barred') {
        for (const bx of [-0.28, 0, 0.28]) {
          const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.84, 8), ironMat);
          bar.position.set(bx, 1.26, 0);
          group.add(bar);
        }
        const cross = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.05, 0.07), ironMat);
        cross.position.set(0, 1.26, 0);
        group.add(cross);
      } else if (wStyle === 'shuttered') {
        const shutterGeo = new THREE.BoxGeometry(0.46, 0.8, 0.06, 2, 3, 1);
        const sL = new THREE.Mesh(shutterGeo, trimWoodMat);
        sL.position.set(-0.46, 1.26, 0.32);
        sL.rotation.y = -0.95;
        const sR = new THREE.Mesh(shutterGeo, trimWoodMat);
        sR.position.set(0.46, 1.26, 0.32);
        sR.rotation.y = 0.95;
        group.add(sL, sR);
      } else if (wStyle === 'paned') {
        const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.055, 0.11, 4, 1, 1), trimWoodMat);
        topRail.position.set(0, 1.652, 0);
        const botRail = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.055, 0.11, 4, 1, 1), trimWoodMat);
        botRail.position.set(0, 0.908, 0);
        const stileL = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.8, 0.11, 1, 3, 1), trimWoodMat);
        stileL.position.set(-0.452, 1.28, 0);
        const stileR = stileL.clone();
        stileR.position.x = 0.452;

        // 6-pane wooden muntin grid (2 vertical mullions + 1 horizontal transom)
        const mullionGeo = new THREE.BoxGeometry(0.036, 0.72, 0.075, 1, 3, 1);
        const mullionL = new THREE.Mesh(mullionGeo, trimWoodMat);
        mullionL.position.set(-0.155, 1.28, 0);
        const mullionR = new THREE.Mesh(mullionGeo, trimWoodMat);
        mullionR.position.set(0.155, 1.28, 0);
        const transom = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.036, 0.075, 4, 1, 1), trimWoodMat);
        transom.position.set(0, 1.28, 0);

        const glassMat = new THREE.MeshStandardMaterial({
          color: '#B7DDF2',
          transparent: true,
          opacity: 0.42,
          roughness: 0.12,
          metalness: 0.18,
          depthWrite: false,
        });
        const glassPane = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.72, 0.024), glassMat);
        glassPane.position.set(0, 1.28, 0);
        glassPane.userData.noCastShadow = true;

        group.add(topRail, botRail, stileL, stileR, mullionL, mullionR, transom, glassPane);
      }
      break;
    }

    case 'trapdoor': {
      // Heavy frame rim around a recessed shadow pit + hinged leaf
      const rimMat = ironMat;
      const frameN = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.14, 0.18, 4, 1, 1), rimMat);
      frameN.position.set(0, 0.07, -0.74);
      const frameS = frameN.clone();
      frameS.position.z = 0.74;
      const frameW = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 1.32, 1, 1, 4), rimMat);
      frameW.position.set(-0.74, 0.07, 0);
      const frameE = frameW.clone();
      frameE.position.x = 0.74;

      const pit = new THREE.Mesh(
        new THREE.PlaneGeometry(1.3, 1.3),
        new THREE.MeshBasicMaterial({ color: '#090A0E' })
      );
      pit.rotation.x = -Math.PI / 2;
      pit.position.y = 0.02;

      const pivot = new THREE.Group();
      pivot.position.set(0, 0.12, -0.66);
      pivot.userData.trapdoorPivot = true;
      const hatch = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.08, 1.32, 4, 1, 4), mat);
      hatch.position.set(0, 0.0, 0.66);
      const strap1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 1.24), rimMat);
      strap1.position.set(-0.36, 0.01, 0.66);
      const strap2 = strap1.clone();
      strap2.position.x = 0.36;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.024, 6, 12), rimMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 0.07, 1.12);
      pivot.add(hatch, strap1, strap2, ring);

      group.add(frameN, frameS, frameW, frameE, pit, pivot);
      break;
    }

    case 'wallTorch': {
      const backplate = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.56, 0.08, 2, 2, 1), ironMat);
      backplate.position.set(0, 1.25, -0.2);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.38), ironMat);
      arm.position.set(0, 1.22, -0.02);
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.09, 0.12, 8), ironMat);
      collar.position.set(0, 1.28, 0.16);
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.04, 0.64, 8), trimWoodMat);
      stick.position.set(0, 1.36, 0.2);
      stick.rotation.x = 0.28;
      const flameMat = new THREE.MeshStandardMaterial({
        color: '#FFB732',
        emissive: '#FF6A00',
        emissiveIntensity: 1.75,
        roughness: 0.25,
      });
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.36, 8), flameMat);
      flame.position.set(0, 1.78, 0.3);
      flame.userData.torchFlame = true;
      flame.userData.baseY = 1.78;
      group.add(backplate, arm, collar, stick, flame);
      group.userData.hasWallTorchLight = true;
      break;
    }

    case 'roofAFrame': {
      const rStyle = config.roofStyle ?? inferRoofStyleFromMaterial(config.material);
      const isRoofSkinMaterial =
        config.material === 'thatchedStraw' ||
        config.material === 'clayTile' ||
        config.material === 'woodShingle' ||
        config.material === 'weatheredSlats';
      const roofMat =
        !isRoofSkinMaterial && config.roofStyle
          ? createBuildingSurfaceMaterial(roofStyleToMaterial(config.roofStyle))
          : mat;
      const showTruss = config.roofMedievalTruss !== false;

      const peakY = 1.35;
      const eaveX = 1.18;
      const eaveY = -0.04;
      const pitchAngle = Math.atan2(peakY - eaveY, eaveX);
      const slopeLen = Math.hypot(eaveX, peakY - eaveY) + 0.1;
      const deckThick = rStyle === 'thatched' ? 0.2 : 0.14;

      const slopeGeo = new THREE.BoxGeometry(slopeLen, deckThick, 2.16, 6, 2, 6);
      const leftSlope = new THREE.Mesh(slopeGeo, roofMat);
      leftSlope.position.set(-eaveX * 0.5, (peakY + eaveY) * 0.5, 0);
      leftSlope.rotation.z = pitchAngle;
      const rightSlope = new THREE.Mesh(slopeGeo, roofMat);
      rightSlope.position.set(eaveX * 0.5, (peakY + eaveY) * 0.5, 0);
      rightSlope.rotation.z = -pitchAngle;
      group.add(leftSlope, rightSlope);

      if (rStyle === 'thatched') {
        const eaveRollGeo = new THREE.CylinderGeometry(0.11, 0.12, 2.18, 8, 6);
        eaveRollGeo.rotateX(Math.PI / 2);
        const rollL = new THREE.Mesh(eaveRollGeo, roofMat);
        rollL.position.set(-eaveX + 0.04, eaveY + 0.04, 0);
        const rollR = new THREE.Mesh(eaveRollGeo, roofMat);
        rollR.position.set(eaveX - 0.04, eaveY + 0.04, 0);
        const ridgeRollGeo = new THREE.CylinderGeometry(0.14, 0.14, 2.22, 8, 6);
        ridgeRollGeo.rotateX(Math.PI / 2);
        const ridgeRoll = new THREE.Mesh(ridgeRollGeo, roofMat);
        ridgeRoll.position.set(0, peakY + 0.06, 0);
        group.add(rollL, rollR, ridgeRoll);
      } else if (rStyle === 'tiled') {
        for (let i = 0; i < 6; i++) {
          const tz = -0.88 + i * 0.35;
          const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.36, 8, 2), roofMat);
          cap.rotation.x = Math.PI / 2;
          cap.position.set(0, peakY + 0.07, tz);
          group.add(cap);
        }
      } else if (rStyle === 'shingled') {
        for (let tier = 0; tier < 3; tier++) {
          const frac = 0.2 + tier * 0.3;
          const tierGeo = new THREE.BoxGeometry(0.46, 0.06, 2.16, 3, 1, 5);
          const tL = new THREE.Mesh(tierGeo, roofMat);
          tL.position.set(-eaveX * (1 - frac), eaveY + (peakY - eaveY) * frac + 0.07, 0);
          tL.rotation.z = pitchAngle;
          const tR = new THREE.Mesh(tierGeo, roofMat);
          tR.position.set(eaveX * (1 - frac), eaveY + (peakY - eaveY) * frac + 0.07, 0);
          tR.rotation.z = -pitchAngle;
          group.add(tL, tR);
        }
        const ridgeCap = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 2.2, 2, 1, 6), trimWoodMat);
        ridgeCap.position.set(0, peakY + 0.07, 0);
        group.add(ridgeCap);
      } else {
        // weathered wood slats
        for (let sIdx = 0; sIdx < 4; sIdx++) {
          const frac = 0.16 + sIdx * 0.24;
          const slatGeo = new THREE.BoxGeometry(0.36, 0.055, 2.16, 3, 1, 5);
          const sL = new THREE.Mesh(slatGeo, roofMat);
          sL.position.set(-eaveX * (1 - frac), eaveY + (peakY - eaveY) * frac + 0.07, 0);
          sL.rotation.z = pitchAngle;
          const sR = new THREE.Mesh(slatGeo, roofMat);
          sR.position.set(eaveX * (1 - frac), eaveY + (peakY - eaveY) * frac + 0.07, 0);
          sR.rotation.z = -pitchAngle;
          group.add(sL, sR);
        }
        const ridgeBoard = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 2.24, 2, 1, 6), trimWoodMat);
        ridgeBoard.position.set(0, peakY + 0.06, 0);
        group.add(ridgeBoard);
      }

      if (showTruss) {
        // Medieval exposed timber framework: bargeboards, projecting ridge purlin, collar tie, king post & 45° knee braces
        const bargeGeo = new THREE.BoxGeometry(slopeLen + 0.04, 0.14, 0.11, 5, 2, 1);
        for (const bz of [-1.02, 1.02]) {
          const bargeL = new THREE.Mesh(bargeGeo, trimWoodMat);
          bargeL.position.set(-eaveX * 0.5, (peakY + eaveY) * 0.5 - 0.06, bz);
          bargeL.rotation.z = pitchAngle;
          const bargeR = new THREE.Mesh(bargeGeo, trimWoodMat);
          bargeR.position.set(eaveX * 0.5, (peakY + eaveY) * 0.5 - 0.06, bz);
          bargeR.rotation.z = -pitchAngle;
          const collar = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.14, 0.12, 5, 2, 1), trimWoodMat);
          collar.position.set(0, 0.46, bz * 0.94);
          const kingPost = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.8, 0.12, 2, 4, 1), trimWoodMat);
          kingPost.position.set(0, 0.88, bz * 0.94);
          const braceGeo = new THREE.BoxGeometry(0.58, 0.1, 0.1, 3, 1, 1);
          const braceL = new THREE.Mesh(braceGeo, trimWoodMat);
          braceL.position.set(-0.32, 0.72, bz * 0.94);
          braceL.rotation.z = Math.PI / 4;
          const braceR = new THREE.Mesh(braceGeo, trimWoodMat);
          braceR.position.set(0.32, 0.72, bz * 0.94);
          braceR.rotation.z = -Math.PI / 4;
          group.add(bargeL, bargeR, collar, kingPost, braceL, braceR);
        }
        const ridgePurlin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 2.48, 2, 2, 6), trimWoodMat);
        ridgePurlin.position.set(0, peakY - 0.1, 0);
        group.add(ridgePurlin);
      }
      break;
    }

    case 'roofSlope': {
      const rStyle = config.roofStyle ?? inferRoofStyleFromMaterial(config.material);
      const isRoofSkinMaterial =
        config.material === 'thatchedStraw' ||
        config.material === 'clayTile' ||
        config.material === 'woodShingle' ||
        config.material === 'weatheredSlats';
      const roofMat =
        !isRoofSkinMaterial && config.roofStyle
          ? createBuildingSurfaceMaterial(roofStyleToMaterial(config.roofStyle))
          : mat;

      const rise = 1.4;
      const run = 2.0;
      const pitchX = Math.atan2(rise, run);
      const slopeLen = Math.hypot(run, rise) + 0.24;
      const deckThick = rStyle === 'thatched' ? 0.2 : 0.14;

      const deck = new THREE.Mesh(new THREE.BoxGeometry(2.04, deckThick, slopeLen, 6, 2, 6), roofMat);
      deck.position.set(0, rise * 0.5 - 0.02, 0.06);
      deck.rotation.x = pitchX;
      group.add(deck);

      if (rStyle === 'thatched') {
        const eaveRoll = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.06, 8, 6), roofMat);
        eaveRoll.rotation.z = Math.PI / 2;
        eaveRoll.position.set(0, 0.02, 1.12);
        group.add(eaveRoll);
      } else if (rStyle === 'tiled') {
        for (let i = 0; i < 5; i++) {
          const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, slopeLen, 6, 4), roofMat);
          rib.rotation.x = Math.PI / 2 + pitchX;
          rib.position.set(-0.8 + i * 0.4, rise * 0.5 + 0.06, 0.06);
          group.add(rib);
        }
      } else if (rStyle === 'shingled' || rStyle === 'woodSlats') {
        const steps = rStyle === 'woodSlats' ? 5 : 4;
        for (let i = 0; i < steps; i++) {
          const frac = (i + 0.5) / steps;
          const zPos = 1.0 - frac * 2.0;
          const yPos = frac * rise + 0.07;
          const strip = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.055, 0.42, 6, 1, 2), roofMat);
          strip.position.set(0, yPos, zPos);
          strip.rotation.x = pitchX;
          group.add(strip);
        }
      }

      if (config.roofMedievalTruss !== false) {
        const rafterGeo = new THREE.BoxGeometry(0.13, 0.15, slopeLen, 2, 2, 6);
        for (const rx of [-0.84, 0, 0.84]) {
          const rafter = new THREE.Mesh(rafterGeo, trimWoodMat);
          rafter.position.set(rx, rise * 0.5 - 0.12, 0.06);
          rafter.rotation.x = pitchX;
          group.add(rafter);
        }
        const eaveFascia = new THREE.Mesh(new THREE.BoxGeometry(2.06, 0.14, 0.1, 6, 1, 1), trimWoodMat);
        eaveFascia.position.set(0, -0.02, 1.1);
        group.add(eaveFascia);
      }
      break;
    }

    case 'roofGable': {
      // Subdivided tapered box forming a watertight triangular gable wall compatible with wear & weathering
      const peakH = 1.35;
      const gableGeo = new THREE.BoxGeometry(2.0, peakH, 0.48, 8, 6, 3);
      const posAttr = gableGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < posAttr.count; i++) {
        const vx = posAttr.getX(i);
        const vy = posAttr.getY(i);
        const yNorm = THREE.MathUtils.clamp((vy + peakH * 0.5) / peakH, 0, 1);
        posAttr.setX(i, vx * (1 - yNorm * 0.985));
        posAttr.setY(i, vy + peakH * 0.5);
      }
      posAttr.needsUpdate = true;
      gableGeo.computeVertexNormals();
      const gableWall = new THREE.Mesh(gableGeo, mat);
      gableWall.userData.usePlanarMeterUV = true;
      group.add(gableWall);

      if (config.roofMedievalTruss !== false) {
        const rAngle = Math.atan2(peakH, 1.0);
        const rLen = Math.hypot(1.0, peakH) + 0.16;
        const rafterGeo = new THREE.BoxGeometry(rLen, 0.15, 0.56, 5, 2, 2);
        const rL = new THREE.Mesh(rafterGeo, trimWoodMat);
        rL.position.set(-0.5, peakH * 0.5, 0);
        rL.rotation.z = rAngle;
        const rR = new THREE.Mesh(rafterGeo, trimWoodMat);
        rR.position.set(0.5, peakH * 0.5, 0);
        rR.rotation.z = -rAngle;
        const tieBeam = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.16, 0.56, 6, 2, 2), trimWoodMat);
        tieBeam.position.set(0, 0.08, 0);
        const king = new THREE.Mesh(new THREE.BoxGeometry(0.14, peakH - 0.1, 0.54, 2, 4, 2), trimWoodMat);
        king.position.set(0, peakH * 0.5, 0);
        const strutGeo = new THREE.BoxGeometry(0.56, 0.11, 0.53, 3, 1, 2);
        const strutL = new THREE.Mesh(strutGeo, trimWoodMat);
        strutL.position.set(-0.28, 0.42, 0);
        strutL.rotation.z = Math.PI / 4;
        const strutR = new THREE.Mesh(strutGeo, trimWoodMat);
        strutR.position.set(0.28, 0.42, 0);
        strutR.rotation.z = -Math.PI / 4;
        group.add(rL, rR, tieBeam, king, strutL, strutR);
      }
      break;
    }

    case 'fence': {
      const fStyle: FenceStyleId = config.fenceStyle ?? 'rail';
      const postGeo = new THREE.BoxGeometry(0.18, 0.98, 0.18, 2, 5, 2);
      const postL = new THREE.Mesh(postGeo, mat);
      postL.position.set(-0.88, 0.49, 0);
      const postR = new THREE.Mesh(postGeo, mat);
      postR.position.set(0.88, 0.49, 0);
      const capGeo = new THREE.BoxGeometry(0.22, 0.07, 0.22, 2, 1, 2);
      const capL = new THREE.Mesh(capGeo, mat);
      capL.position.set(-0.88, 1.0, 0);
      const capR = new THREE.Mesh(capGeo, mat);
      capR.position.set(0.88, 1.0, 0);
      group.add(postL, postR, capL, capR);

      if (fStyle === 'picket') {
        for (const ry of [0.28, 0.72]) {
          const backRail = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.08, 0.06, 6, 1, 1), mat);
          backRail.position.set(0, ry, -0.02);
          group.add(backRail);
        }
        const picketOffsets = [-0.56, -0.28, 0, 0.28, 0.56];
        for (let i = 0; i < picketOffsets.length; i++) {
          const hVar = i % 2 === 0 ? 0.86 : 0.81;
          const picket = new THREE.Mesh(new THREE.BoxGeometry(0.19, hVar, 0.055, 2, 4, 1), mat);
          picket.position.set(picketOffsets[i], hVar * 0.5 + 0.05, 0.04);
          group.add(picket);
        }
      } else if (fStyle === 'medieval') {
        const botBeam = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.13, 0.14, 6, 2, 2), mat);
        botBeam.position.set(0, 0.14, 0);
        const topBeam = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.13, 0.14, 6, 2, 2), mat);
        topBeam.position.set(0, 0.86, 0);
        const xGeo = new THREE.BoxGeometry(1.76, 0.1, 0.09, 5, 1, 1);
        const braceA = new THREE.Mesh(xGeo, mat);
        braceA.position.set(0, 0.5, 0);
        braceA.rotation.z = 0.41;
        const braceB = new THREE.Mesh(xGeo, mat);
        braceB.position.set(0, 0.5, 0);
        braceB.rotation.z = -0.41;
        const midPost = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.88, 0.14, 2, 4, 2), mat);
        midPost.position.set(0, 0.46, 0);
        group.add(botBeam, topBeam, braceA, braceB, midPost);
      } else {
        // split-rail fence
        for (const ry of [0.34, 0.72]) {
          const rail = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.11, 0.09, 6, 2, 1), mat);
          rail.position.set(0, ry, 0);
          group.add(rail);
        }
      }
      break;
    }

    case 'porchSteps': {
      // 3 wide welcoming front-door steps (2m wide × 1.12m deep × 0.56m rise)
      const stepCount = 3;
      const totalDepth = 1.12;
      const totalRise = 0.56;
      const stepD = totalDepth / stepCount;
      const stepH = totalRise / stepCount;
      for (let i = 0; i < stepCount; i++) {
        const h = stepH * (i + 1);
        const zCenter = totalDepth * 0.5 - stepD * (i + 0.5);
        const tread = new THREE.Mesh(
          new THREE.BoxGeometry(1.86, h, stepD + 0.02, 6, 2, 2),
          mat
        );
        tread.position.set(0, h * 0.5, zCenter);
        group.add(tread);
      }
      // Subtle side cheek stringers
      const stringerGeo = new THREE.BoxGeometry(0.12, 0.58, totalDepth + 0.04, 2, 3, 4);
      const strL = new THREE.Mesh(stringerGeo, mat);
      strL.position.set(-0.96, 0.29, 0);
      const strR = new THREE.Mesh(stringerGeo, mat);
      strR.position.set(0.96, 0.29, 0);
      group.add(strL, strR);
      break;
    }

    case 'beamLarge':
    case 'beamSmall':
    case 'plankTrim': {
      const orient: BeamOrientation = config.beamOrientation ?? 'horizontal';
      const isLarge = config.shape === 'beamLarge';
      const isPlank = config.shape === 'plankTrim';
      const length = config.shape === 'beamSmall' ? 1.0 : 2.0;
      const crossH = isLarge ? 0.26 : isPlank ? 0.1 : 0.16;
      const crossD = isLarge ? 0.26 : isPlank ? 0.38 : 0.16;
      const beamLen =
        orient === 'diag45' || orient === 'diagNeg45'
          ? isLarge
            ? 2.4
            : isPlank
            ? 2.2
            : 1.32
          : length;

      const beamMesh = new THREE.Mesh(
        new THREE.BoxGeometry(beamLen, crossH, crossD, 8, 3, 3),
        mat
      );
      if (orient === 'vertical') {
        beamMesh.rotation.z = Math.PI / 2;
        beamMesh.position.set(0, beamLen * 0.5, 0);
      } else if (orient === 'diag45') {
        beamMesh.rotation.z = Math.PI / 4;
        beamMesh.position.set(0, beamLen * 0.36, 0);
      } else if (orient === 'diagNeg45') {
        beamMesh.rotation.z = -Math.PI / 4;
        beamMesh.position.set(0, beamLen * 0.36, 0);
      } else {
        beamMesh.position.set(0, crossH * 0.5, 0);
      }
      group.add(beamMesh);
      break;
    }
  }

  normalizeWorldSpaceUVs(group, sx * uniformScale, sy * uniformScale, sz * uniformScale);

  if (sx !== 1 || sy !== 1 || sz !== 1) {
    group.scale.set(sx, sy, sz);
  }

  enableShadows(group);
  return group;
}

function buildDoorLeafContent(
  leafStyle: DoorConfig['leafStyle'],
  slotStyle: DoorConfig['slotStyle'],
  width: number,
  height: number,
  woodMat: THREE.MeshStandardMaterial,
  ironMat: THREE.MeshStandardMaterial
): THREE.Group {
  const leaf = new THREE.Group();
  const isOpenGrille = leafStyle === 'ironBars' || leafStyle === 'jailCage';

  if (isOpenGrille) {
    const railMat = ironMat;
    const topRail = new THREE.Mesh(new THREE.BoxGeometry(width, 0.09, 0.1, 3, 1, 1), railMat);
    topRail.position.y = height - 0.045;
    const botRail = new THREE.Mesh(new THREE.BoxGeometry(width, 0.09, 0.1, 3, 1, 1), railMat);
    botRail.position.y = 0.045;
    const midRail = new THREE.Mesh(new THREE.BoxGeometry(width, 0.08, 0.09, 3, 1, 1), railMat);
    midRail.position.y = height * 0.5;
    const stileL = new THREE.Mesh(new THREE.BoxGeometry(0.08, height, 0.1, 1, 4, 1), railMat);
    stileL.position.set(-width * 0.5 + 0.04, height * 0.5, 0);
    const stileR = stileL.clone();
    stileR.position.x = width * 0.5 - 0.04;
    leaf.add(topRail, botRail, midRail, stileL, stileR);

    const barCount = leafStyle === 'jailCage' ? Math.max(4, Math.round(width * 6.2)) : Math.max(3, Math.round(width * 4.2));
    for (let i = 1; i < barCount; i++) {
      const bx = -width * 0.5 + (i / barCount) * width;
      const bar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.026, 0.026, height - 0.08, 8),
        railMat
      );
      bar.position.set(bx, height * 0.5, 0);
      leaf.add(bar);
    }

    if (leafStyle === 'jailCage') {
      for (const hy of [height * 0.26, height * 0.74]) {
        const cross = new THREE.Mesh(new THREE.BoxGeometry(width, 0.055, 0.075, 3, 1, 1), railMat);
        cross.position.y = hy;
        leaf.add(cross);
      }
      const lockPlate = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.14), railMat);
      lockPlate.position.set(width * 0.25, height * 0.48, 0);
      leaf.add(lockPlate);
    }
    return leaf;
  }

  const isRusticWood = leafStyle === 'rusticWood';
  const baseMat = leafStyle === 'solidMetal' ? ironMat : woodMat;
  const trimMat = isRusticWood ? createDarkWoodMaterial() : ironMat;
  const thickness = 0.14;

  if (slotStyle === 'none') {
    if (isRusticWood) {
      const planks = width < 0.8 ? 3 : 4;
      const pw = width / planks;
      for (let i = 0; i < planks; i++) {
        const px = -width * 0.5 + pw * (i + 0.5);
        const depthJitter = i % 2 === 0 ? 0.008 : -0.004;
        const plank = new THREE.Mesh(
          new THREE.BoxGeometry(pw - 0.012, height, thickness + depthJitter, 2, 6, 2),
          baseMat
        );
        plank.position.set(px, height * 0.5, 0);
        leaf.add(plank);
      }
    } else {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(width, height, thickness, 4, 6, 2), baseMat);
      slab.position.y = height * 0.5;
      leaf.add(slab);
    }
  } else {
    // Build solid door around an actual see-through cutout at eye height
    const slitH = slotStyle === 'peepSlot' ? 0.14 : 0.44;
    const slitW = Math.min(width * 0.58, slotStyle === 'peepSlot' ? 0.42 : 0.46);
    const slitY = slotStyle === 'peepSlot' ? 1.48 : 1.42;
    const botH = slitY - slitH * 0.5;
    const topH = Math.max(0.15, height - (slitY + slitH * 0.5));
    const sideW = Math.max(0.06, (width - slitW) * 0.5);

    const lower = new THREE.Mesh(new THREE.BoxGeometry(width, botH, thickness, 4, 4, 2), baseMat);
    lower.position.y = botH * 0.5;
    const upper = new THREE.Mesh(new THREE.BoxGeometry(width, topH, thickness, 4, 2, 2), baseMat);
    upper.position.y = height - topH * 0.5;
    const sideL = new THREE.Mesh(new THREE.BoxGeometry(sideW, slitH, thickness, 2, 2, 1), baseMat);
    sideL.position.set(-width * 0.5 + sideW * 0.5, slitY, 0);
    const sideR = sideL.clone();
    sideR.position.x = width * 0.5 - sideW * 0.5;
    leaf.add(lower, upper, sideL, sideR);

    // Frame & iron grille inside the cutout
    const rimTop = new THREE.Mesh(new THREE.BoxGeometry(slitW + 0.06, 0.04, thickness + 0.03), trimMat);
    rimTop.position.set(0, slitY + slitH * 0.5, 0);
    const rimBot = rimTop.clone();
    rimBot.position.y = slitY - slitH * 0.5;
    leaf.add(rimTop, rimBot);

    const bars = slotStyle === 'peepSlot' ? 2 : 3;
    for (let i = 1; i <= bars; i++) {
      const bx = -slitW * 0.5 + (i / (bars + 1)) * slitW;
      const grilleBar = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, slitH, 6), ironMat);
      grilleBar.position.set(bx, slitY, 0);
      leaf.add(grilleBar);
    }
  }

  if (isRusticWood) {
    // Rustic wooden Z-brace battens & wrought-iron hinge straps
    for (const by of [0.34, height - 0.3]) {
      const batten = new THREE.Mesh(new THREE.BoxGeometry(width - 0.04, 0.12, thickness + 0.045, 4, 1, 1), trimMat);
      batten.position.y = by;
      leaf.add(batten);
      const strap = new THREE.Mesh(new THREE.BoxGeometry(width * 0.45, 0.055, thickness + 0.055, 3, 1, 1), ironMat);
      strap.position.set(-width * 0.24, by, 0);
      leaf.add(strap);
    }
    if (slotStyle === 'none') {
      const diagLen = Math.hypot(width * 0.72, height - 0.74);
      const diag = new THREE.Mesh(new THREE.BoxGeometry(0.11, diagLen, thickness + 0.035, 1, 4, 1), trimMat);
      diag.position.set(0, height * 0.5, 0);
      diag.rotation.z = -Math.atan2(width * 0.72, height - 0.74);
      leaf.add(diag);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.02, 6, 12), ironMat);
    ring.position.set(width * 0.32, 0.94, thickness * 0.65);
    leaf.add(ring);
  } else {
    // Iron reinforcing bands & handle ring
    for (const by of [0.42, height - 0.34]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(width + 0.01, 0.09, thickness + 0.03, 4, 1, 1), trimMat);
      band.position.y = by;
      leaf.add(band);
    }
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.08, 0.02, 6, 12),
      new THREE.MeshStandardMaterial({ color: '#D4A838', roughness: 0.32, metalness: 0.85 })
    );
    ring.position.set(width * 0.32, 0.94, thickness * 0.6);
    leaf.add(ring);
  }

  return leaf;
}

export interface DoorAnimationControl {
  openMode: DoorConfig['openMode'];
  pivotLeft?: THREE.Group;
  pivotRight?: THREE.Group;
  slidingLeaf?: THREE.Group;
  openProgress: number;
}

/**
 * Builds a modular doorway with rectangular/arched masonry frame, selectable leaf style
 * (wood plank, metal, iron bars, jail cage), window/peep slot, and animated hinge/split/slide pivots.
 */
export function buildModularDoorMesh(doorConfig: DoorConfig, entityScale = 1): THREE.Group {
  const group = new THREE.Group();
  const frameMat = createBuildingSurfaceMaterial(doorConfig.frameMaterial ?? 'hewnStone');
  const woodMat = createDarkWoodMaterial();
  const ironMat = createIronHardwareMaterial();

  // Frame jambs (outer width ~2.0m, inner clear doorway 1.28m wide × 2.02m tall)
  const jambGeo = new THREE.BoxGeometry(0.36, 2.06, 0.56, 3, 6, 3);
  const jambL = new THREE.Mesh(jambGeo, frameMat);
  jambL.position.set(-0.82, 1.03, 0);
  const jambR = new THREE.Mesh(jambGeo, frameMat);
  jambR.position.set(0.82, 1.03, 0);
  group.add(jambL, jambR);

  if (doorConfig.frameShape === 'arched') {
    for (let i = 0; i < 5; i++) {
      const theta = Math.PI * 0.14 + (i / 4) * Math.PI * 0.72;
      const block = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.38, 0.6, 3, 2, 2), frameMat);
      block.position.set(-Math.cos(theta) * 0.78, 1.82 + Math.sin(theta) * 0.52, 0);
      block.rotation.z = theta - Math.PI / 2;
      group.add(block);
    }
  } else {
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.38, 0.6, 6, 2, 2), frameMat);
    lintel.position.y = 2.22;
    group.add(lintel);
  }

  const clearW = 1.28;
  const clearH = 2.02;
  const control: DoorAnimationControl = {
    openMode: doorConfig.openMode,
    openProgress: 0,
  };

  if (doorConfig.openMode === 'doubleSplit') {
    const halfW = clearW * 0.5 - 0.01;
    const pivotL = new THREE.Group();
    pivotL.position.set(-clearW * 0.5, 0, 0);
    const leafL = buildDoorLeafContent(doorConfig.leafStyle, doorConfig.slotStyle, halfW, clearH, woodMat, ironMat);
    leafL.position.x = halfW * 0.5;
    pivotL.add(leafL);

    const pivotR = new THREE.Group();
    pivotR.position.set(clearW * 0.5, 0, 0);
    const leafR = buildDoorLeafContent(doorConfig.leafStyle, doorConfig.slotStyle, halfW, clearH, woodMat, ironMat);
    leafR.position.x = -halfW * 0.5;
    leafR.scale.x = -1;
    pivotR.add(leafR);

    group.add(pivotL, pivotR);
    control.pivotLeft = pivotL;
    control.pivotRight = pivotR;
  } else if (doorConfig.openMode === 'sliding') {
    const slideGroup = new THREE.Group();
    const leaf = buildDoorLeafContent(doorConfig.leafStyle, doorConfig.slotStyle, clearW, clearH, woodMat, ironMat);
    slideGroup.add(leaf);
    group.add(slideGroup);
    control.slidingLeaf = slideGroup;
  } else {
    const pivotL = new THREE.Group();
    pivotL.position.set(-clearW * 0.5, 0, 0);
    const leaf = buildDoorLeafContent(doorConfig.leafStyle, doorConfig.slotStyle, clearW, clearH, woodMat, ironMat);
    leaf.position.x = clearW * 0.5;
    pivotL.add(leaf);
    group.add(pivotL);
    control.pivotLeft = pivotL;
  }

  if (doorConfig.requiresKey) {
    const lock = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.22, 0.22),
      new THREE.MeshStandardMaterial({ color: '#F2C230', metalness: 0.85, roughness: 0.25 })
    );
    lock.position.set(doorConfig.openMode === 'doubleSplit' ? 0 : 0.42, 0.96, 0.04);
    (control.pivotLeft ?? control.slidingLeaf ?? group).add(lock);
  }

  const uniformScale = THREE.MathUtils.clamp(entityScale, 0.25, 8);
  normalizeWorldSpaceUVs(group, uniformScale, uniformScale, uniformScale);

  group.userData.doorControl = control;
  enableShadows(group);
  return group;
}

export function applyDoorOpenAnimation(root: THREE.Object3D, isOpen: boolean, dt: number): void {
  const control = root.userData?.doorControl as DoorAnimationControl | undefined;
  if (control) {
    const target = isOpen ? 1 : 0;
    const speed = Math.min(1, dt * 8.5);
    control.openProgress += (target - control.openProgress) * speed;
    const p = control.openProgress;
    if (control.openMode === 'sliding' && control.slidingLeaf) {
      control.slidingLeaf.position.y = p * 2.02;
    } else if (control.openMode === 'doubleSplit') {
      if (control.pivotLeft) control.pivotLeft.rotation.y = -p * (Math.PI * 0.52);
      if (control.pivotRight) control.pivotRight.rotation.y = p * (Math.PI * 0.52);
    } else if (control.pivotLeft) {
      control.pivotLeft.rotation.y = -p * (Math.PI * 0.52);
    }
    return;
  }

  // Fallback for legacy wooden castle doors + trapdoors
  root.traverse((child) => {
    if (child.userData?.doorLeaf) {
      child.visible = !isOpen;
    }
    if (child.userData?.trapdoorPivot) {
      const targetRot = isOpen ? -Math.PI * 0.48 : 0;
      child.rotation.x += (targetRot - child.rotation.x) * Math.min(1, dt * 9);
    }
  });
}

export function getBuildingShapeStackHeight(shape: BuildingShapeId): number {
  return BUILDING_SHAPES.find((s) => s.id === shape)?.stackHeight ?? 2.0;
}

/**
 * Computes exact walkable floor height across modular floor tiles, wall cube tops,
 * straight stairs, spiral stairs, and closed trapdoors using a step-up ceiling guard
 * so multi-story interiors allow walking underneath upper floors without snapping up!
 */
export function sampleBuildingSurfaceY(
  ent: LevelEntity,
  wx: number,
  wz: number,
  baseY: number,
  actorX: number,
  actorZ: number,
  actorY: number,
  isOpened = false
): number | null {
  const bb = ent.buildingBlock;
  if (!bb) return null;
  const s = Math.max(0.25, ent.scale ?? 1);
  const bx = s * THREE.MathUtils.clamp(bb.scaleX ?? 1, 0.1, 8);
  const by = s * THREE.MathUtils.clamp(bb.scaleY ?? 1, 0.1, 8);
  const bz = s * THREE.MathUtils.clamp(bb.scaleZ ?? 1, 0.1, 8);
  const yaw = ((ent.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const dx = actorX - wx;
  const dz = actorZ - wz;
  // Rotate world delta into entity local space (inverse Y rotation)
  const lx = dx * cos - dz * sin;
  const lz = dx * sin + dz * cos;
  const maxStepUp = 0.78;

  switch (bb.shape) {
    case 'floorTile': {
      const halfX = 1.04 * bx;
      const halfZ = 1.04 * bz;
      if (Math.abs(lx) <= halfX && Math.abs(lz) <= halfZ) {
        const topY = baseY + 0.24 * by;
        if (topY <= actorY + maxStepUp) return topY;
      }
      return null;
    }
    case 'wallCube': {
      const halfX = 1.0 * bx;
      const halfZ = 1.0 * bz;
      if (Math.abs(lx) <= halfX && Math.abs(lz) <= halfZ) {
        const topY = baseY + 2.0 * by;
        if (topY <= actorY + maxStepUp) return topY;
      }
      return null;
    }
    case 'wallCubeHalf': {
      const halfX = 0.5 * bx;
      const halfZ = 0.5 * bz;
      if (Math.abs(lx) <= halfX && Math.abs(lz) <= halfZ) {
        const topY = baseY + 1.0 * by;
        if (topY <= actorY + maxStepUp) return topY;
      }
      return null;
    }
    case 'halfWall': {
      if (Math.abs(lx) <= 1.02 * bx && Math.abs(lz) <= 0.38 * bz) {
        const topY = baseY + 1.01 * by;
        if (topY <= actorY + maxStepUp) return topY;
      }
      return null;
    }
    case 'trapdoor': {
      if (isOpened) return null;
      const halfX = 0.82 * bx;
      const halfZ = 0.82 * bz;
      if (Math.abs(lx) <= halfX && Math.abs(lz) <= halfZ) {
        const topY = baseY + 0.16 * by;
        if (topY <= actorY + maxStepUp) return topY;
      }
      return null;
    }
    case 'stairsStraight': {
      const halfW = 1.04 * bx;
      const halfD = 1.08 * bz;
      if (Math.abs(lx) <= halfW && Math.abs(lz) <= halfD) {
        // Front bottom at lz = +1.0*bz, top step at lz = -1.0*bz
        const t = THREE.MathUtils.clamp((1.0 * bz - lz) / Math.max(0.01, 2.0 * bz), 0, 1);
        const stairY = baseY + (0.12 + t * 1.9) * by;
        if (stairY <= actorY + 0.95) return stairY;
      }
      return null;
    }
    case 'stairsSpiral': {
      const rScale = Math.max(bx, bz);
      const r = Math.hypot(lx, lz);
      if (r >= 0.22 * rScale && r <= 1.38 * rScale) {
        // Steps start at angle 0 (+X) and wind 225° counter-clockwise
        let ang = Math.atan2(-lz, lx);
        if (ang < -0.35) ang += Math.PI * 2;
        const maxTurn = Math.PI * 1.25;
        if (ang >= -0.35 && ang <= maxTurn + 0.35) {
          const t = THREE.MathUtils.clamp(ang / maxTurn, 0, 1);
          const stairY = baseY + (0.14 + t * 1.88) * by;
          if (stairY <= actorY + 0.95) return stairY;
        }
      }
      return null;
    }
    case 'porchSteps': {
      const halfW = 1.02 * bx;
      const halfD = 0.62 * bz;
      if (Math.abs(lx) <= halfW && Math.abs(lz) <= halfD) {
        const t = THREE.MathUtils.clamp((0.56 * bz - lz) / Math.max(0.01, 1.12 * bz), 0, 1);
        const stepY = baseY + (0.14 + t * 0.42) * by;
        if (stepY <= actorY + maxStepUp) return stepY;
      }
      return null;
    }
    case 'roofAFrame': {
      if (Math.abs(lx) <= 1.18 * bx && Math.abs(lz) <= 1.08 * bz) {
        const t = 1 - THREE.MathUtils.clamp(Math.abs(lx) / Math.max(0.01, 1.18 * bx), 0, 1);
        const roofY = baseY + (0.04 + t * 1.38) * by;
        if (roofY <= actorY + maxStepUp) return roofY;
      }
      return null;
    }
    case 'roofSlope': {
      if (Math.abs(lx) <= 1.04 * bx && Math.abs(lz) <= 1.1 * bz) {
        const t = THREE.MathUtils.clamp((1.0 * bz - lz) / Math.max(0.01, 2.0 * bz), 0, 1);
        const roofY = baseY + (0.05 + t * 1.4) * by;
        if (roofY <= actorY + maxStepUp) return roofY;
      }
      return null;
    }
    case 'beamLarge':
    case 'plankTrim': {
      if ((bb.beamOrientation ?? 'horizontal') === 'horizontal') {
        const halfD = (bb.shape === 'plankTrim' ? 0.22 : 0.16) * bz;
        const hTop = (bb.shape === 'plankTrim' ? 0.1 : 0.26) * by;
        if (Math.abs(lx) <= 1.02 * bx && Math.abs(lz) <= halfD) {
          const topY = baseY + hTop;
          if (topY <= actorY + maxStepUp) return topY;
        }
      }
      return null;
    }
    default:
      return null;
  }
}
