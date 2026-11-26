import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
  Fn,
  If,
  abs,
  attribute,
  cameraPosition,
  cameraProjectionMatrix,
  cameraViewMatrix,
  clamp,
  cos,
  dot,
  exp,
  float,
  floor,
  fract,
  frontFacing,
  length,
  max,
  min,
  mix,
  modelWorldMatrix,
  normalize,
  positionGeometry,
  pow,
  select,
  sin,
  smoothstep,
  sqrt,
  texture,
  uniform,
  uv,
  varying,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import type {
  BiomeId,
  GrassFieldConfig,
  GrassQuality,
  TerrainData,
  VisualStyleId,
  WorldMapData,
} from '../types/maker';
import {
  type BotwFogUniformBundle,
  createDriftingCloudShadowNode,
  getSharedBotwUniforms,
} from './botwStyleUtils';
import { ensureUpgradedTerrain, getTerrainRadius, IslandTerrain, sampleTerrainHeight } from '../utils/terrain';
import { sampleWorldMapAtWorld } from '../utils/worldMap';
import { isIOSDevice } from './webglUtils';

export function createDefaultGrassConfig(): GrassFieldConfig {
  return {
    enabled: true,
    quality: 'lush',
    viewDistance: 74,
    bladeHeight: 0.74,
    bladeWidth: 0.104,
    windWaveStrength: 1.0,
    tipGlow: 0.68,
    interactiveParting: true,
    primaryColor: '#54B049',
    secondaryColor: '#98D954',
    mixNoiseScale: 1.0,
    carexMix: 0.34,
    tuftClumpiness: 0.56,
  };
}

export function resolveGrassConfig(cfg?: Partial<GrassFieldConfig> | null): GrassFieldConfig {
  const base = createDefaultGrassConfig();
  if (!cfg) return base;
  return {
    ...base,
    ...cfg,
  };
}

interface BiomeGrassPalette {
  rootHex: string;
  midHex: string;
  tipHex: string;
  crestHex: string;
  densityBias: number;
}

export function getBiomeGrassPalette(
  biome: BiomeId,
  biomeGroundHex: string,
  biomeDetailHex: string
): BiomeGrassPalette {
  switch (biome) {
    case 'meadow':
      return {
        rootHex: '#3B7C30',
        midHex: '#59A63B',
        tipHex: '#B6DF5B',
        crestHex: '#E8F78A',
        densityBias: 1.0,
      };
    case 'island':
      return {
        rootHex: '#37823B',
        midHex: '#54B049',
        tipHex: '#AEE05B',
        crestHex: '#E6FA8C',
        densityBias: 1.0,
      };
    case 'forest':
      return {
        rootHex: '#2B622F',
        midHex: '#448B3B',
        tipHex: '#8CC951',
        crestHex: '#CBE87B',
        densityBias: 1.0,
      };
    case 'swamp':
      return {
        rootHex: '#3A5834',
        midHex: '#587E3D',
        tipHex: '#93B254',
        crestHex: '#C6D97C',
        densityBias: 0.92,
      };
    case 'snow':
      return {
        rootHex: '#5F847B',
        midHex: '#86ADA1',
        tipHex: '#CBE2DC',
        crestHex: '#EFFAF8',
        densityBias: 0.62,
      };
    case 'desert':
      return {
        rootHex: '#8A7B3D',
        midHex: '#B8A24F',
        tipHex: '#DFCC78',
        crestHex: '#F7E9A6',
        densityBias: 0.48,
      };
    case 'cave':
      return {
        rootHex: '#324A40',
        midHex: '#4A7260',
        tipHex: '#7FB29A',
        crestHex: '#B4DFCA',
        densityBias: 0.65,
      };
    case 'night':
      return {
        rootHex: '#254C46',
        midHex: '#37736A',
        tipHex: '#6DB9A5',
        crestHex: '#A9EAD6',
        densityBias: 0.94,
      };
    default: {
      const root = new THREE.Color(biomeGroundHex).multiplyScalar(0.84);
      const mid = new THREE.Color(biomeGroundHex).lerp(new THREE.Color(biomeDetailHex), 0.35);
      const tip = mid.clone().lerp(new THREE.Color('#D5EC6E'), 0.45);
      const crest = tip.clone().lerp(new THREE.Color('#F3FA9A'), 0.45);
      return {
        rootHex: `#${root.getHexString()}`,
        midHex: `#${mid.getHexString()}`,
        tipHex: `#${tip.getHexString()}`,
        crestHex: `#${crest.getHexString()}`,
        densityBias: 0.92,
      };
    }
  }
}

/**
 * Builds a stylized curved grass blade geometry with a subtle center V-fold ridge
 * for near LOD (7 triangles, 3 vertical bend segments).
 */
export function createNearBladeGeometry(widthScale = 1.0): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const hw = 0.5 * widthScale;

  const positions = new Float32Array([
    -hw * 1.0,  0.0,   0.0,
     hw * 1.0,  0.0,   0.0,
    -hw * 0.82, 0.34,  0.025,
     hw * 0.82, 0.34,  0.025,
    -hw * 0.48, 0.69,  0.085,
     hw * 0.48, 0.69,  0.085,
     0.0,       1.0,   0.185,
  ]);
  const uvs = new Float32Array([
    0.0, 0.0,
    1.0, 0.0,
    0.0, 0.34,
    1.0, 0.34,
    0.0, 0.69,
    1.0, 0.69,
    0.5, 1.0,
  ]);
  const indices = new Uint16Array([
    0, 1, 2,
    2, 1, 3,
    2, 3, 4,
    4, 3, 5,
    4, 5, 6,
  ]);
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  return geo;
}

/**
 * Builds a 3-blade fanned grass tuft card (9 opaque triangles, zero alpha cutout/overdraw)
 * for the camera-facing far LOD tier, giving 3x perceived distant meadow density per instance.
 */
function createFarTuftCardGeometry(widthScale = 1.0): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const hw = 0.55 * widthScale;

  // 3 fanned sub-blades: left lean, tall center, right lean
  const specs: { baseOffX: number; leanX: number; heightScale: number; bladeW: number; archZ: number }[] = [
    { baseOffX: -hw * 0.85, leanX: -hw * 1.05, heightScale: 0.86, bladeW: hw * 0.88, archZ: 0.08 },
    { baseOffX: 0.0,        leanX: 0.0,        heightScale: 1.04, bladeW: hw * 0.96, archZ: 0.14 },
    { baseOffX: hw * 0.85,  leanX: hw * 1.05,  heightScale: 0.88, bladeW: hw * 0.88, archZ: 0.08 },
  ];

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  specs.forEach((sp, bi) => {
    const vStart = bi * 5;
    const h = sp.heightScale;
    const w0 = sp.bladeW;
    const w1 = sp.bladeW * 0.58;
    const x0 = sp.baseOffX;
    const x1 = sp.baseOffX + sp.leanX * 0.52;
    const x2 = sp.baseOffX + sp.leanX;

    positions.push(
      x0 - w0, 0.0,      0.0,
      x0 + w0, 0.0,      0.0,
      x1 - w1, h * 0.52, sp.archZ * 0.38,
      x1 + w1, h * 0.52, sp.archZ * 0.38,
      x2,      h,        sp.archZ
    );
    uvs.push(
      0.0, 0.0,
      1.0, 0.0,
      0.0, 0.52,
      1.0, 0.52,
      0.5, 1.0
    );
    indices.push(
      vStart + 0, vStart + 1, vStart + 2,
      vStart + 2, vStart + 1, vStart + 3,
      vStart + 2, vStart + 3, vStart + 4
    );
  });

  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
  geo.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
  return geo;
}

/**
 * Generates integer cell offsets (dx, dz) inside a single spatial grass tile
 * ([0..cellsPerSide-1] x [0..cellsPerSide-1]), plus a per-blade sub-index.
 */
function buildChunkInstancedGeometry(
  baseBlade: THREE.BufferGeometry,
  cellsPerSide: number,
  bladesPerCell: number,
  chunkSize: number
): { geometry: THREE.InstancedBufferGeometry; instanceCount: number } {
  const totalInstances = cellsPerSide * cellsPerSide * bladesPerCell;
  const offsets = new Float32Array(totalInstances * 2);
  const subIndices = new Float32Array(totalInstances);

  let o = 0;
  let s = 0;
  for (let dz = 0; dz < cellsPerSide; dz++) {
    for (let dx = 0; dx < cellsPerSide; dx++) {
      for (let b = 0; b < bladesPerCell; b++) {
        offsets[o++] = dx;
        offsets[o++] = dz;
        subIndices[s++] = b;
      }
    }
  }

  const instGeo = new THREE.InstancedBufferGeometry();
  instGeo.index = baseBlade.index;
  instGeo.attributes.position = baseBlade.attributes.position;
  instGeo.attributes.uv = baseBlade.attributes.uv;
  instGeo.setAttribute('aCellOffset', new THREE.InstancedBufferAttribute(offsets, 2));
  instGeo.setAttribute('aBladeSub', new THREE.InstancedBufferAttribute(subIndices, 1));
  instGeo.instanceCount = totalInstances;

  const half = chunkSize * 0.5;
  instGeo.boundingSphere = new THREE.Sphere(
    new THREE.Vector3(half, 0, half),
    chunkSize * 0.95
  );

  return { geometry: instGeo, instanceCount: totalInstances };
}

export interface GrassWorldMapMaskContext {
  worldMap?: WorldMapData;
  activeRegionCode?: number;
  activeRegionOrigin?: [number, number];
}

/**
 * Packs terrain height (R), feathered grass mask (G), surface slope normal (B=nx, A=nz),
 * AND ground paint tint color map (`groundColorData`, RGBA8) for terrain-matched meadow coloring.
 */
function populateTerrainAndColorTextures(
  terrain: TerrainData,
  texData: Float32Array,
  groundColorData: Uint8Array,
  densityBias: number,
  biomeGroundHex: string,
  biomeDetailHex: string,
  bounds?: { minRow: number; maxRow: number; minCol: number; maxCol: number },
  worldMapCtx?: GrassWorldMapMaskContext
): void {
  const size = terrain.size;
  const width = size + 1;
  const worldRadius = getTerrainRadius(terrain);
  const step = (2 * worldRadius) / size;
  const waterLevel = IslandTerrain.waterLevel;
  const caves = terrain.caves ?? [];

  const rStart = bounds ? Math.max(0, bounds.minRow) : 0;
  const rEnd = bounds ? Math.min(size, bounds.maxRow) : size;
  const cStart = bounds ? Math.max(0, bounds.minCol) : 0;
  const cEnd = bounds ? Math.min(size, bounds.maxCol) : size;

  const k = [1, 2, 1];

  // Ground layer tint colors (matches terrain shader palette for seamless blade root integration)
  const cGrass = new THREE.Color(biomeGroundHex).lerp(new THREE.Color('#7AC44E'), 0.25);
  const cMoss = new THREE.Color(biomeDetailHex).lerp(new THREE.Color('#4A7C3A'), 0.45);
  const cSand = new THREE.Color('#DFCA8B');
  const cRock = new THREE.Color('#7D848B');
  const cSnow = new THREE.Color('#E8F3F6');
  const cCobble = new THREE.Color('#9A9589');
  const cDirt = new THREE.Color('#9C784E');

  const hGridRStart = Math.max(0, rStart - 1);
  const hGridREnd = Math.min(size, rEnd + 1);
  const hGridCStart = Math.max(0, cStart - 1);
  const hGridCEnd = Math.min(size, cEnd + 1);
  const hGridCols = hGridCEnd - hGridCStart + 1;
  const hGridRows = hGridREnd - hGridRStart + 1;
  const heightCache = new Float32Array(hGridRows * hGridCols);

  for (let r = hGridRStart; r <= hGridREnd; r++) {
    const wz = -worldRadius + r * step;
    const rowOff = (r - hGridRStart) * hGridCols;
    for (let c = hGridCStart; c <= hGridCEnd; c++) {
      const wx = -worldRadius + c * step;
      heightCache[rowOff + (c - hGridCStart)] = sampleTerrainHeight(terrain, wx, wz);
    }
  }

  const getCachedHeight = (r: number, c: number, wx: number, wz: number): number => {
    if (r >= hGridRStart && r <= hGridREnd && c >= hGridCStart && c <= hGridCEnd) {
      return heightCache[(r - hGridRStart) * hGridCols + (c - hGridCStart)];
    }
    return sampleTerrainHeight(terrain, wx, wz);
  };

  for (let row = rStart; row <= rEnd; row++) {
    const wz = -worldRadius + row * step;
    for (let col = cStart; col <= cEnd; col++) {
      const wx = -worldRadius + col * step;
      const idx = row * width + col;
      const h = getCachedHeight(row, col, wx, wz);

      const hL = col > 0 ? getCachedHeight(row, col - 1, wx - step, wz) : sampleTerrainHeight(terrain, wx - step, wz);
      const hR = col < size ? getCachedHeight(row, col + 1, wx + step, wz) : sampleTerrainHeight(terrain, wx + step, wz);
      const hD = row > 0 ? getCachedHeight(row - 1, col, wx, wz - step) : sampleTerrainHeight(terrain, wx, wz - step);
      const hU = row < size ? getCachedHeight(row + 1, col, wx, wz + step) : sampleTerrainHeight(terrain, wx, wz + step);
      let nx = hL - hR;
      let ny = 2.0 * step;
      let nz = hD - hU;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;

      let grassW = 0;
      let totalW = 0;
      let colR = 0;
      let colG = 0;
      let colB = 0;

      for (let dr = -1; dr <= 1; dr++) {
        const nr = Math.max(0, Math.min(size, row + dr));
        const wy = k[dr + 1];
        const rowOff = nr * width;
        for (let dc = -1; dc <= 1; dc++) {
          const nc = Math.max(0, Math.min(size, col + dc));
          const wt = wy * k[dc + 1];
          const layer = terrain.layers[rowOff + nc] ?? 0;
          const contrib = layer === 0 ? 1.0 : layer === 4 ? 0.88 : 0.0;
          grassW += contrib * wt;
          totalW += wt;

          const lc =
            layer === 1
              ? cSand
              : layer === 2
              ? cRock
              : layer === 3
              ? cSnow
              : layer === 4
              ? cMoss
              : layer === 5
              ? cCobble
              : layer === 6
              ? cDirt
              : cGrass;
          colR += lc.r * wt;
          colG += lc.g * wt;
          colB += lc.b * wt;
        }
      }

      let mask = totalW > 0 ? grassW / totalW : 0;
      const invW = totalW > 0 ? 1 / totalW : 1;

      const aboveWater = THREE.MathUtils.smoothstep(h, waterLevel + 0.28, waterLevel + 1.05);
      mask *= aboveWater;

      const flatEnough = THREE.MathUtils.smoothstep(ny, 0.74, 0.91);
      mask *= flatEnough;

      if (mask > 0.01 && caves.length > 0) {
        for (let ci = 0; ci < caves.length; ci++) {
          const c = caves[ci];
          const caveRadius = 4.2 * (c.scale || 1);
          const cd = Math.hypot(wx - c.x, wz - c.z);
          if (cd < caveRadius * 1.35) {
            mask *= THREE.MathUtils.smoothstep(cd, caveRadius * 0.82, caveRadius * 1.35);
          }
        }
      }

      const edgeDist = Math.max(Math.abs(wx), Math.abs(wz));
      const insideIsland = 1.0 - THREE.MathUtils.smoothstep(edgeDist, worldRadius - 6.0, worldRadius - 1.2);
      mask *= insideIsland * densityBias;

      if (worldMapCtx?.worldMap && worldMapCtx.activeRegionCode && worldMapCtx.activeRegionCode > 0) {
        const ox = worldMapCtx.activeRegionOrigin?.[0] ?? 0;
        const oz = worldMapCtx.activeRegionOrigin?.[1] ?? 0;
        const wm = sampleWorldMapAtWorld(worldMapCtx.worldMap, ox + wx, oz + wz);
        if (wm.land === 1 && wm.regionCode !== worldMapCtx.activeRegionCode) {
          mask = 0;
        }
      }

      const o = idx * 4;
      texData[o] = h;
      texData[o + 1] = THREE.MathUtils.clamp(mask, 0, 1);
      texData[o + 2] = nx * 0.5 + 0.5;
      texData[o + 3] = nz * 0.5 + 0.5;

      // Subtle warm/dry organic 2D noise baked into the ground color map (no axial sine stripes)
      const gHash = (gx: number, gz: number) => {
        const px = (gx + 17.31) * 127.1;
        const py = (gz + 43.87) * 311.7;
        const s = Math.sin(px + py) * 43758.5453123;
        return s - Math.floor(s);
      };
      const gValNoise = (nx: number, nz: number) => {
        const ix = Math.floor(nx);
        const iz = Math.floor(nz);
        const fx = nx - ix;
        const fz = nz - iz;
        const ux = fx * fx * (3 - 2 * fx);
        const uz = fz * fz * (3 - 2 * fz);
        const a = gHash(ix, iz);
        const b = gHash(ix + 1, iz);
        const c = gHash(ix, iz + 1);
        const d = gHash(ix + 1, iz + 1);
        return (a + (b - a) * ux) * (1 - uz) + (c + (d - c) * ux) * uz;
      };
      const patchDry = gValNoise(wx * 0.045, wz * 0.045) * 0.65 + gValNoise(wx * 0.11 + 5.7, wz * 0.11 - 3.2) * 0.35;
      const rFin = THREE.MathUtils.clamp(colR * invW + patchDry * 0.06, 0, 1);
      const gFin = THREE.MathUtils.clamp(colG * invW + (1 - patchDry) * 0.04, 0, 1);
      const bFin = THREE.MathUtils.clamp(colB * invW, 0, 1);

      groundColorData[o] = Math.round(rFin * 255);
      groundColorData[o + 1] = Math.round(gFin * 255);
      groundColorData[o + 2] = Math.round(bFin * 255);
      groundColorData[o + 3] = 255;
    }
  }
}

function packTerrainHalfFloat(
  floatData: Float32Array,
  halfData: Uint16Array,
  texSize: number,
  bounds?: { minRow: number; maxRow: number; minCol: number; maxCol: number }
): void {
  const maxIdx = texSize - 1;
  const rStart = bounds ? Math.max(0, bounds.minRow) : 0;
  const rEnd = bounds ? Math.min(maxIdx, bounds.maxRow) : maxIdx;
  const cStart = bounds ? Math.max(0, bounds.minCol) : 0;
  const cEnd = bounds ? Math.min(maxIdx, bounds.maxCol) : maxIdx;
  const toHalf = THREE.DataUtils.toHalfFloat;
  for (let row = rStart; row <= rEnd; row++) {
    const rowOff = row * texSize;
    for (let col = cStart; col <= cEnd; col++) {
      const o = (rowOff + col) * 4;
      halfData[o] = toHalf(floatData[o]);
      halfData[o + 1] = toHalf(floatData[o + 1]);
      halfData[o + 2] = toHalf(floatData[o + 2]);
      halfData[o + 3] = toHalf(floatData[o + 3]);
    }
  }
}

interface GrassMaterialBundle {
  material: MeshBasicNodeMaterial;
  uniforms: {
    uLodInnerStart: { value: number };
    uLodInnerEnd: { value: number };
    uLodOuterStart: { value: number };
    uLodOuterEnd: { value: number };
    uBladeHeight: { value: number };
    uBladeWidth: { value: number };
    uWindWaveStrength: { value: number };
    uTipGlow: { value: number };
    uPrimaryCol: { value: THREE.Color };
    uSecondaryCol: { value: THREE.Color };
    uUseCustomDualTone: { value: number };
    uMixNoiseScale: { value: number };
    uCarexMix: { value: number };
    uTuftClumpiness: { value: number };
    uCameraPos: { value: THREE.Vector3 };
    uTime: { value: number };
    uWindStrength: { value: number };
    uSunDir: { value: THREE.Vector3 };
    uSunColor: { value: THREE.Color };
    uSunIntensity: { value: number };
    uSkyColor: { value: THREE.Color };
    uGroundHemiColor: { value: THREE.Color };
    uHemiIntensity: { value: number };
    uFogColor: { value: THREE.Color };
    uFogDensity: { value: number };
    uFogNear: { value: number };
    uFogFar: { value: number };
    uFogMode: { value: number };
    uHeightFogDensity: { value: number };
    uHeightFogLevel: { value: number };
    uSunInscatterColor: { value: THREE.Color };
    uSunInscatterStrength: { value: number };
    uShadowCoolColor: { value: THREE.Color };
    uShadowLiftStrength: { value: number };
    uRimStrength: { value: number };
    uHeroActive: { value: number };
    uHeroPos: { value: THREE.Vector3 };
  };
}

const gHash21Tsl = Fn(([pIn]: [any]) => {
  const p = vec2(fract(vec2(pIn).add(vec2(17.31, 43.87)).mul(vec2(127.1, 311.7)))).toVar();
  p.addAssign(dot(p, p.add(34.345)));
  return fract(p.x.mul(p.y));
});

const gHash22Tsl = Fn(([p]: [any]) => {
  const pv = vec2(p).add(vec2(31.73, 19.41));
  const p3 = vec3(fract(vec3(pv.x, pv.y, pv.x).mul(vec3(0.1031, 0.103, 0.0973)))).toVar();
  p3.addAssign(dot(p3, vec3(p3.y, p3.z, p3.x).add(33.33)));
  return fract(vec2(p3.x.add(p3.y), p3.y.add(p3.z)).mul(vec2(p3.z, p3.y)));
});

const gNoise2DTsl = Fn(([p]: [any]) => {
  const i = floor(p);
  const fRaw = fract(p);
  const f = fRaw.mul(fRaw).mul(vec2(3.0).sub(fRaw.mul(2.0)));
  const a = gHash21Tsl(i);
  const b = gHash21Tsl(i.add(vec2(1.0, 0.0)));
  const c = gHash21Tsl(i.add(vec2(0.0, 1.0)));
  const d = gHash21Tsl(i.add(vec2(1.0, 1.0)));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
});

function createGrassNodeMaterial(opts: {
  terrainTex: THREE.DataTexture;
  groundColorTex: THREE.DataTexture;
  trailTex: THREE.DataTexture;
  terrainTexSize: number;
  trailTexSize: number;
  worldRadius: number;
  cellSpacing: number;
  isFarTuft: boolean;
  innerStart: number;
  innerEnd: number;
  outerStart: number;
  outerEnd: number;
  bladeHeight: number;
  bladeWidth: number;
  windWaveStrength: number;
  tipGlow: number;
  celMode: boolean;
  rootHex: string;
  midHex: string;
  tipHex: string;
  crestHex: string;
  primaryColorHex?: string;
  secondaryColorHex?: string;
  useCustomDualTone?: boolean;
  mixNoiseScale?: number;
  carexMix?: number;
  tuftClumpiness?: number;
}): GrassMaterialBundle {
  const safeOuterEnd = Math.max(opts.outerEnd, opts.outerStart + 0.01);
  const hasInnerFade = opts.innerEnd > opts.innerStart + 0.001 && opts.innerStart > 0.0;

  const uTerrainTexSize = float(opts.terrainTexSize);
  const uTrailTexSize = float(opts.trailTexSize);
  const uWorldRadius = float(opts.worldRadius);
  const uCellSpacing = float(opts.cellSpacing);
  const uLodInnerStart = uniform(opts.innerStart);
  const uLodInnerEnd = uniform(Math.max(opts.innerEnd, opts.innerStart + 0.01));
  const uLodOuterStart = uniform(opts.outerStart);
  const uLodOuterEnd = uniform(safeOuterEnd);
  const uBladeHeight = uniform(opts.bladeHeight);
  const uBladeWidth = uniform(opts.bladeWidth);
  const uWindWaveStrength = uniform(opts.windWaveStrength);
  const uTipGlow = uniform(opts.tipGlow);
  const uPrimaryCol = uniform(new THREE.Color(opts.primaryColorHex ?? opts.midHex));
  const uSecondaryCol = uniform(new THREE.Color(opts.secondaryColorHex ?? opts.tipHex));
  const uUseCustomDualTone = uniform(opts.useCustomDualTone ? 1.0 : 0.0);
  const uMixNoiseScale = uniform(opts.mixNoiseScale ?? 1.0);
  const uCarexMix = uniform(opts.carexMix ?? 0.32);
  const uTuftClumpiness = uniform(opts.tuftClumpiness ?? 0.45);

  const toColorVec3 = (hex: string) => {
    const c = new THREE.Color(hex);
    return vec3(c.r, c.g, c.b);
  };
  const uRootColor = toColorVec3(opts.rootHex);
  const uMidColor = toColorVec3(opts.midHex);
  const uTipColor = toColorVec3(opts.tipHex);
  const uCrestColor = toColorVec3(opts.crestHex);

  const uCameraPos = uniform(new THREE.Vector3(0, 12, 30));
  const uTime = uniform(0);
  const uWindStrength = uniform(0.45);
  const uSunDir = uniform(new THREE.Vector3(0.4, 0.75, 0.5).normalize());
  const uSunColor = uniform(new THREE.Color('#FFF5E0'));
  const uSunIntensity = uniform(1.5);
  const uSkyColor = uniform(new THREE.Color('#B8E4FF'));
  const uGroundHemiColor = uniform(new THREE.Color('#5F7844'));
  const uHemiIntensity = uniform(0.75);
  const uFogColor = uniform(new THREE.Color('#B9DCFA'));
  const uFogDensity = uniform(0.0022);
  const uFogNear = uniform(50);
  const uFogFar = uniform(220);
  const uFogMode = uniform(2.0);
  const uHeightFogDensity = uniform(0.0);
  const uHeightFogLevel = uniform(1.8);
  const uSunInscatterColor = uniform(new THREE.Color('#FFD29D'));
  const uSunInscatterStrength = uniform(0.32);
  const uShadowCoolColor = uniform(new THREE.Color('#34528A'));
  const uShadowLiftStrength = uniform(0.14);
  const uRimStrength = uniform(0.14);
  const uHeroActive = uniform(0.0);
  const uHeroPos = uniform(new THREE.Vector3(0, -999, 0));

  const vHeight = varying(float());
  const vSide = varying(float());
  const vWaveCrest = varying(float());
  const vColorVar = varying(float());
  const vSpeciesMix = varying(float());
  const vCloudShade = varying(float());
  const vGroundTint = varying(vec3());
  const vWorldPos = varying(vec3());
  const vTerrainNormal = varying(vec3());
  const vBladeNormal = varying(vec3());

  const mat = new MeshBasicNodeMaterial({
    side: THREE.DoubleSide,
    toneMapped: true,
    fog: false,
  });

  mat.vertexNode = Fn(() => {
    const aCellOffset = attribute('aCellOffset', 'vec2');
    const aBladeSub = attribute('aBladeSub', 'float');

    const chunkOrigin = modelWorldMatrix.mul(vec4(0, 0, 0, 1)).xyz;
    const chunkOriginXZ = vec2(chunkOrigin.x, chunkOrigin.z);
    const baseCell = floor(chunkOriginXZ.div(uCellSpacing).add(0.5)).add(aCellOffset);
    const hashSeed = baseCell.add(vec2(aBladeSub.mul(37.13), aBladeSub.mul(91.7)));
    const jitter = gHash22Tsl(hashSeed).sub(0.5);
    // Wide cross-cell jitter lets blades mingle across grid lines so no square lattice ever forms
    const rawWorldXZ = baseCell.add(0.5).add(jitter.mul(1.52)).mul(uCellSpacing);

    // Domain-warped 2x2 Voronoi clump field (irregular organic tufts, no square clump grid)
    const warpX = gNoise2DTsl(rawWorldXZ.mul(0.28).add(vec2(5.2, 1.3))).sub(0.5);
    const warpZ = gNoise2DTsl(rawWorldXZ.mul(0.28).add(vec2(18.7, 9.4))).sub(0.5);
    const warpedXZ = rawWorldXZ.add(vec2(warpX, warpZ).mul(1.35));
    const clumpGridScale = float(0.58);
    const warpedScaled = warpedXZ.mul(clumpGridScale);
    const baseClump = floor(warpedScaled.sub(0.5));

    const evalSite = (ox: number, oz: number) => {
      const c = baseClump.add(vec2(ox, oz));
      const h = gHash22Tsl(c);
      const w = gHash21Tsl(c.add(vec2(7.7, 23.1)));
      const siteScaled = c.add(0.14).add(h.mul(0.72));
      const diffScaled = siteScaled.sub(warpedScaled);
      const d2 = dot(diffScaled, diffScaled).mul(mix(0.68, 1.42, w));
      return { diffScaled, h, w, d2 };
    };

    const s00 = evalSite(0, 0);
    const s10 = evalSite(1, 0);
    const s01 = evalSite(0, 1);
    const s11 = evalSite(1, 1);

    const pickA = s00.d2.lessThanEqual(s10.d2);
    const aDiff = select(pickA, s00.diffScaled, s10.diffScaled);
    const aHash = select(pickA, s00.h, s10.h);
    const aW = select(pickA, s00.w, s10.w);
    const aD2 = min(s00.d2, s10.d2);

    const pickB = s01.d2.lessThanEqual(s11.d2);
    const bDiff = select(pickB, s01.diffScaled, s11.diffScaled);
    const bHash = select(pickB, s01.h, s11.h);
    const bW = select(pickB, s01.w, s11.w);
    const bD2 = min(s01.d2, s11.d2);

    const pickBest = aD2.lessThanEqual(bD2);
    const clumpDiffXZ = select(pickBest, aDiff, bDiff).div(clumpGridScale);
    const clumpHash = select(pickBest, aHash, bHash);
    const clumpWeight = select(pickBest, aW, bW);

    const clumpCenterXZ = rawWorldXZ.add(clumpDiffXZ);
    const clumpDist = length(clumpDiffXZ);
    const bladePullRnd = gHash21Tsl(hashSeed.add(vec2(29.4, 51.8)));
    const clumpPull = clamp(uTuftClumpiness, 0.0, 1.0)
      .mul(0.66)
      .mul(mix(0.62, 1.0, clumpWeight))
      .mul(mix(0.45, 1.0, bladePullRnd));
    const worldXZ = mix(rawWorldXZ, clumpCenterXZ, clumpPull);

    const clipPos = vec4(2.0, 2.0, 2.0, 1.0).toVar();

    const insideWorld = abs(worldXZ.x)
      .lessThanEqual(uWorldRadius.sub(1.5))
      .and(abs(worldXZ.y).lessThanEqual(uWorldRadius.sub(1.5)));

    const toBladeXZ = worldXZ.sub(vec2(uCameraPos.x, uCameraPos.z));
    const distXZ = length(toBladeXZ);
    const insideLodRange =
      opts.innerStart > 0.0
        ? distXZ.lessThanEqual(uLodOuterEnd).and(distXZ.greaterThanEqual(uLodInnerStart))
        : distXZ.lessThanEqual(uLodOuterEnd);

    If(insideWorld.and(insideLodRange), () => {
      const worldNormUv = clamp(
        worldXZ.add(vec2(uWorldRadius, uWorldRadius)).div(uWorldRadius.mul(2.0)),
        0.0,
        1.0
      );
      // Single-tap hardware bilinear lookup on HalfFloat terrain + GroundColor DataTextures
      const tUv = worldNormUv
        .mul(uTerrainTexSize.sub(1.0))
        .add(0.5)
        .div(uTerrainTexSize);
      const tData = texture(opts.terrainTex, tUv);

      const terrainY = float(tData.r);
      const grassMask = float(tData.g);
      const densityRnd = float(gHash21Tsl(hashSeed.add(vec2(17.3, 5.9))));
      // Organic meadow density drift + tuft gap thinning so solid preset fields never blanket evenly
      const meadowDrift = gNoise2DTsl(worldXZ.mul(0.15).add(vec2(3.1, 8.7)))
        .mul(0.62)
        .add(gNoise2DTsl(worldXZ.mul(0.42).add(vec2(19.4, 2.3))).mul(0.38));
      const clumpAffinity = float(1.0).sub(smoothstep(0.22, 1.12, clumpDist));
      const baseNaturalDensity = mix(0.76, 1.0, smoothstep(0.16, 0.78, meadowDrift));
      const clumpGapMod = mix(
        0.42,
        1.0,
        clamp(clumpAffinity.mul(0.72).add(meadowDrift.mul(0.28)), 0.0, 1.0)
      );
      const organicDensity = mix(
        baseNaturalDensity,
        clumpGapMod,
        clamp(uTuftClumpiness, 0.0, 1.0).mul(0.68)
      );
      const maskKeep = grassMask
        .greaterThanEqual(0.08)
        .and(densityRnd.lessThanEqual(smoothstep(0.06, 0.72, grassMask).mul(organicDensity)));

      If(maskKeep, () => {
        const rootClip = cameraProjectionMatrix
          .mul(cameraViewMatrix)
          .mul(vec4(worldXZ.x, terrainY, worldXZ.y, 1.0));

        const inClip = rootClip.w.greaterThanEqual(-0.9).and(
          rootClip.w.lessThanEqual(2.2).or(
            abs(rootClip.x)
              .lessThanEqual(rootClip.w.mul(1.25).add(1.0))
              .and(rootClip.y.lessThanEqual(rootClip.w.mul(1.25).add(1.0)))
              .and(rootClip.y.greaterThanEqual(rootClip.w.mul(1.9).add(2.4).negate()))
          )
        );

        If(inClip, () => {
          const clumpNoise = gNoise2DTsl(worldXZ.mul(0.14));
          const bladeRnd = gHash21Tsl(hashSeed.add(vec2(43.1, 88.4)));

          // Break up circular LOD arcs with low-frequency meadow patch wobble + per-blade scatter
          const organicDist = distXZ
            .add(clumpNoise.sub(0.5).mul(6.8))
            .add(bladeRnd.sub(0.5).mul(2.4));

          const fadeIn = hasInnerFade
            ? smoothstep(uLodInnerStart, uLodInnerEnd, organicDist)
            : float(1.0);
          const fadeOut = float(1.0).sub(smoothstep(uLodOuterStart, uLodOuterEnd, organicDist));
          const baseFade = fadeIn.mul(fadeOut);

          // Soft diffuse stochastic fade: stagger each blade's dissolve window instead of shrinking all at one line
          const staggerOffset = bladeRnd.mul(0.68).add(clumpNoise.mul(0.12));
          const lodScale = smoothstep(
            staggerOffset,
            min(float(1.0), staggerOffset.add(0.32)),
            baseFade
          );

          If(lodScale.greaterThanEqual(0.03), () => {
            const groundSample = texture(opts.groundColorTex, tUv).rgb;
            const trailUv = worldNormUv
              .mul(uTrailTexSize.sub(1.0))
              .add(0.5)
              .div(uTrailTexSize);
            const trailData = texture(opts.trailTex, trailUv);
            const trampleAmt = float(trailData.r);

            // Dual species selection: Carex / Tall Sedge vs Lush Short Lawn
            const speciesPatch = gNoise2DTsl(worldXZ.mul(0.11).add(vec2(12.3, 4.7)));
            const isCarex = smoothstep(
              float(0.68).sub(uCarexMix.mul(0.65)),
              float(0.95).sub(uCarexMix.mul(0.5)),
              speciesPatch.mul(0.62).add(bladeRnd.mul(0.38))
            ).mul(clamp(uCarexMix.mul(1.35), 0.0, 1.0));

            const clumpHeightSpan = mix(0.14, 0.54, clamp(uTuftClumpiness, 0.0, 1.0));
            const clumpScaledMul = float(1.0).sub(clumpHeightSpan.mul(0.45)).add(clumpHash.y.mul(clumpHeightSpan));

            const borderShrink = smoothstep(0.08, 0.65, grassMask);
            const speciesHeightMul = mix(0.84, 1.48, isCarex);
            const heightScale = uBladeHeight
              .mul(float(0.58).add(clumpNoise.mul(0.54)).add(bladeRnd.mul(0.28)))
              .mul(clumpScaledMul)
              .mul(speciesHeightMul)
              .mul(borderShrink)
              .mul(lodScale);
            const widthScale = uBladeWidth
              .mul(mix(1.05, 0.78, isCarex))
              .mul(float(0.84).add(bladeRnd.mul(0.36)))
              .mul(float(0.7).add(lodScale.mul(0.3)));

            const tnx = tData.b.mul(2.0).sub(1.0);
            const tnz = tData.a.mul(2.0).sub(1.0);
            const tny = sqrt(max(0.05, float(1.0).sub(tnx.mul(tnx)).sub(tnz.mul(tnz))));
            const terrainN = normalize(vec3(tnx, tny, tnz));

            const toCamXZ = normalize(vec2(uCameraPos.x, uCameraPos.z).sub(worldXZ).add(vec2(0.0001)));

            // Clumped yaw orientation (neighboring blades lean loosely in tuft clusters)
            const clumpYaw = clumpHash.x.mul(6.2831853);
            const indivYaw = gHash21Tsl(hashSeed.add(vec2(9.2, 61.7))).mul(6.2831853);
            const yaw = mix(clumpYaw, indivYaw, mix(0.76, 0.24, clamp(uTuftClumpiness, 0.0, 1.0)));

            // For far billboarded tuft cards: orient card toward camera with subtle normalized tilt
            const farBasis = normalize(
              vec2(
                toCamXZ.y.add(indivYaw.sin().mul(0.18)),
                toCamXZ.x.negate().add(indivYaw.cos().mul(0.18))
              )
            );
            const cy = opts.isFarTuft ? farBasis.x : cos(yaw);
            const sy = opts.isFarTuft ? farBasis.y : sin(yaw);

            const bladeUv = uv();
            const hT = bladeUv.y;
            const side = bladeUv.x.mul(2.0).sub(1.0);

            // View-space edge-on blade thickening on near 3D blades to prevent thin disappearing slivers
            const faceAlign = abs(dot(vec2(sy.negate(), cy), toCamXZ));
            const edgeThicken = opts.isFarTuft
              ? float(1.16)
              : float(1.0).add(pow(float(1.0).sub(faceAlign), 2.0).mul(0.88));

            // Per-blade procedural quadratic curvature variation (Carex bends gracefully outward)
            const curveRnd = gHash21Tsl(hashSeed.add(vec2(71.9, 13.4)));
            const archBend = hT
              .mul(hT)
              .mul(heightScale)
              .mul(float(0.14).add(curveRnd.mul(0.28)).add(isCarex.mul(0.26)));

            const localZ = positionGeometry.z
              .mul(heightScale)
              .mul(float(0.75).add(bladeRnd.mul(0.55)))
              .add(archBend);

            const localX = positionGeometry.x.mul(widthScale).mul(edgeThicken);
            const localY = positionGeometry.y.mul(heightScale);

            const rotX = localX.mul(cy).sub(localZ.mul(sy)).toVar();
            const rotY = localY.toVar();
            const rotZ = localX.mul(sy).add(localZ.mul(cy)).toVar();

            const windDir = normalize(vec2(0.84, 0.54));
            const wSpeed = float(0.85).add(uWindStrength.mul(0.95));
            const wAmp = float(0.18).add(uWindStrength.mul(0.42)).mul(uWindWaveStrength);

            const waveCoord = worldXZ.mul(0.052).sub(windDir.mul(uTime.mul(wSpeed).mul(0.62)));
            const macroWave = gNoise2DTsl(waveCoord)
              .mul(0.65)
              .add(gNoise2DTsl(waveCoord.mul(2.15).add(vec2(4.2, 1.7))).mul(0.35));
            const wavePulse = smoothstep(0.28, 0.84, macroWave);

            const phase = worldXZ.x.mul(0.24).add(worldXZ.y.mul(0.19)).add(bladeRnd.mul(6.283));
            const flutter = sin(uTime.mul(float(2.6).add(uWindStrength.mul(1.4))).add(phase)).mul(0.24);
            const gust = macroWave.mul(1.15).add(flutter.mul(0.45)).mul(wAmp);

            const bendT = hT.mul(hT);
            const windPerp = vec2(windDir.y.negate(), windDir.x);
            const windPush = windDir
              .mul(gust.mul(heightScale).mul(bendT))
              .add(
                windPerp.mul(
                  sin(uTime.mul(1.9).add(phase.mul(0.7)))
                    .mul(0.12)
                    .mul(wAmp)
                    .mul(heightScale)
                    .mul(bendT)
                )
              );

            rotX.addAssign(windPush.x);
            rotZ.addAssign(windPush.y);
            rotY.subAssign(min(heightScale.mul(0.42), dot(windPush, windPush).mul(0.42)));

            // Persistent trampled trail compression & directional bend from trailTex
            If(trampleAmt.greaterThan(0.02), () => {
              const tDirRaw = trailData.gb.mul(2.0).sub(1.0);
              const tDirLen = max(0.001, length(tDirRaw));
              const tDir = tDirRaw.div(tDirLen);
              const tBend = trampleAmt.mul(0.68).mul(heightScale).mul(hT);
              rotX.addAssign(tDir.x.mul(tBend));
              rotZ.addAssign(tDir.y.mul(tBend));
              rotY.mulAssign(float(1.0).sub(trampleAmt.mul(0.62).mul(hT)));
            });

            // Immediate radial hero parting spring
            If(uHeroActive.greaterThan(0.5), () => {
              const fromHero = worldXZ.sub(vec2(uHeroPos.x, uHeroPos.z));
              const hDist = length(fromHero);
              const vertGap = abs(terrainY.sub(uHeroPos.y));
              If(hDist.lessThan(1.8).and(vertGap.lessThan(2.5)), () => {
                const pushAmt = float(1.0).sub(smoothstep(0.18, 1.8, hDist));
                const pushDir = select(
                  hDist.greaterThan(0.001),
                  fromHero.div(max(hDist, 0.001)),
                  vec2(cy, sy)
                );
                const pushMag = pushAmt.mul(0.84).mul(heightScale).mul(hT);
                rotX.addAssign(pushDir.x.mul(pushMag));
                rotZ.addAssign(pushDir.y.mul(pushMag));
                rotY.mulAssign(float(1.0).sub(pushAmt.mul(0.56).mul(hT)));
              });
            });

            const worldPos = vec3(
              worldXZ.x.add(rotX),
              terrainY.sub(0.04).add(rotY),
              worldXZ.y.add(rotZ)
            );

            // Smooth curved blade normal from root to tip for specular wind glint & soft lighting
            const localN = normalize(vec3(side.mul(0.44), float(0.48).add(hT.mul(0.44)), -0.7));
            const bladeN = normalize(
              vec3(
                localN.x.mul(cy).sub(localN.z.mul(sy)),
                localN.y,
                localN.x.mul(sy).add(localN.z.mul(cy))
              )
            );

            vHeight.assign(hT);
            vSide.assign(side);
            vWaveCrest.assign(wavePulse.mul(clamp(uWindStrength.mul(0.85).add(0.35), 0.0, 1.35)));
            vColorVar.assign(clumpNoise.mul(0.65).add(bladeRnd.mul(0.35)));
            vSpeciesMix.assign(isCarex);
            vCloudShade.assign(createDriftingCloudShadowNode(vec2(worldPos.x, worldPos.z)));
            vGroundTint.assign(groundSample);
            vWorldPos.assign(worldPos);
            vTerrainNormal.assign(terrainN);
            vBladeNormal.assign(bladeN);

            clipPos.assign(cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(worldPos, 1.0)));
          });
        });
      });
    });

    return clipPos;
  })();

  mat.colorNode = Fn(() => {
    const worldXZFrag = vec2(vWorldPos.x, vWorldPos.z);
    const dapple1 = gNoise2DTsl(worldXZFrag.mul(0.048).add(vec2(2.7, 9.1))).sub(0.5);
    const dapple2 = gNoise2DTsl(worldXZFrag.mul(0.13).add(vec2(14.3, 6.4))).sub(0.5);
    const meadowVar = float(0.95).add(dapple1.mul(0.12)).add(dapple2.mul(0.07));

    // Dual-tone noise-driven blend between primary and secondary grass palette colors
    const patchNoise = gNoise2DTsl(vec2(vWorldPos.x, vWorldPos.z).mul(float(0.045).mul(uMixNoiseScale)));
    const dualBlend = smoothstep(0.22, 0.78, patchNoise.mul(0.72).add(vSpeciesMix.mul(0.28)));
    const customRoot = mix(uPrimaryCol.mul(0.62), uSecondaryCol.mul(0.62), dualBlend);
    const customMid = mix(uPrimaryCol, uSecondaryCol, dualBlend);
    const customTip = mix(uPrimaryCol.mul(1.24), uSecondaryCol.mul(1.28), dualBlend);

    const effRoot = mix(uRootColor, customRoot, uUseCustomDualTone);
    const effMid = mix(uMidColor, customMid, uUseCustomDualTone);
    const effTip = mix(uTipColor, customTip, uUseCustomDualTone);

    const gradCol = mix(effRoot, effMid, smoothstep(0.0, 0.55, vHeight));
    const baseTip = mix(gradCol, effTip, smoothstep(0.45, 1.0, vHeight));

    const warmShift = mix(vec3(0.92, 0.97, 0.94), vec3(1.1, 1.04, 0.88), vColorVar);
    const crestMask = vWaveCrest
      .mul(smoothstep(0.28, 1.0, vHeight))
      .mul(clamp(uTipGlow, 0.0, 1.4));
    const ridgeShade = float(0.94).add(float(1.0).sub(abs(vSide)).mul(0.1));
    const styledCol = mix(
      baseTip.mul(warmShift).mul(meadowVar),
      uCrestColor,
      clamp(crestMask.mul(0.42), 0.0, 0.55)
    ).mul(ridgeShade);

    // Blend blade roots & lower body softly toward the underlying painted terrain color map
    const groundBlendFactor = clamp(float(0.44).sub(vHeight.mul(0.28)), 0.12, 0.44);
    const groundMatched = styledCol.mul(vGroundTint).mul(1.26);
    const baseCol = mix(styledCol, groundMatched, groundBlendFactor);

    const camDist = length(cameraPosition.sub(vWorldPos));
    const nearNormalMix = float(1.0).sub(smoothstep(9.0, 28.0, camDist));
    const faceSign = select(frontFacing, float(1.0), float(-0.32));
    const norm = normalize(
      mix(vTerrainNormal, vBladeNormal.mul(faceSign), vHeight.mul(0.32).mul(nearNormalMix))
    );

    const viewDir = normalize(cameraPosition.sub(vWorldPos).add(vec3(0.0001)));
    const ndl = dot(norm, uSunDir);
    const rawWrapDiff = clamp(ndl.add(0.48).div(1.48), 0.0, 1.0);
    const wrapDiff = opts.celMode
      ? mix(rawWrapDiff, smoothstep(0.06, 0.86, rawWrapDiff), 0.55)
      : rawWrapDiff;

    const hemiMix = clamp(norm.y.mul(0.5).add(0.5), 0.0, 1.0);
    const ambientLight = mix(uGroundHemiColor, uSkyColor, hemiMix).mul(uHemiIntensity).mul(0.8);
    const cloudShade = vCloudShade;
    const directLight = uSunColor.mul(uSunIntensity).mul(wrapDiff).mul(0.68).mul(cloudShade);

    // Smooth distance-attenuated sun sheen across wind waves (prevents sub-pixel HDR sparkle)
    const halfVec = normalize(uSunDir.add(viewDir));
    const specPower = pow(clamp(dot(norm, halfVec), 0.0, 1.0), 7.5);
    const glintFade = float(1.0).sub(smoothstep(10.0, 32.0, camDist));
    const glintWeight = opts.isFarTuft ? 0.045 : 0.11;
    const sunGlint = vec3(uSunColor.r, uSunColor.g, uSunColor.b)
      .mul(specPower)
      .mul(glintWeight)
      .mul(glintFade)
      .mul(smoothstep(0.24, 0.96, vHeight))
      .mul(cloudShade)
      .mul(clamp(uSunIntensity.mul(0.55), 0.1, 1.15));

    const backScatter = pow(clamp(dot(viewDir.negate(), uSunDir), 0.0, 1.0), 3.0);
    const rimGlow = pow(float(1.0).sub(clamp(abs(dot(norm, viewDir)), 0.0, 1.0)), 2.2).mul(
      float(0.28).add(uRimStrength)
    );
    const sssDistScale = mix(1.0, 0.42, smoothstep(10.0, 34.0, camDist));
    const sssGlow = vec3(uSunColor.r, uSunColor.g, uSunColor.b)
      .mul(uCrestColor)
      .mul(backScatter.mul(0.46).add(rimGlow.mul(0.18)))
      .mul(vHeight)
      .mul(uTipGlow)
      .mul(sssDistScale)
      .mul(cloudShade)
      .mul(clamp(uSunIntensity.mul(0.65), 0.15, 1.2));

    const shadowMask = clamp(float(0.52).sub(ndl.mul(0.52)), 0.0, 1.0);
    const coolShadowTint = baseCol.mul(uShadowCoolColor).mul(shadowMask).mul(uShadowLiftStrength);

    const rootAo = mix(0.78, 1.04, smoothstep(0.0, 0.58, vHeight));
    const litCol = baseCol
      .mul(ambientLight.add(directLight))
      .mul(rootAo)
      .add(coolShadowTint)
      .add(sssGlow)
      .add(sunGlint)
      .toVar();

    // Soft HDR shoulder so thin waving blade tips never fire isolated bloom/flare fireflies
    const hdrExcess = max(litCol.sub(vec3(0.84)), vec3(0.0));
    litCol.assign(litCol.min(vec3(0.84)).add(hdrExcess.div(vec3(1.0).add(hdrExcess.mul(2.4)))));

    // Aerial perspective distance + valley height mist matching scene.fogNode
    const fogFactor = float(0.0).toVar();
    If(uFogMode.greaterThan(1.5), () => {
      fogFactor.assign(
        float(1.0).sub(exp(uFogDensity.mul(uFogDensity).mul(camDist).mul(camDist).negate()))
      );
    }).ElseIf(uFogMode.greaterThan(0.5), () => {
      fogFactor.assign(smoothstep(uFogNear, uFogFar, camDist));
    });
    const hBelow = max(0.0, uHeightFogLevel.sub(vWorldPos.y));
    const hProd = uHeightFogDensity.mul(hBelow).mul(camDist);
    const heightFog = float(1.0).sub(exp(hProd.mul(hProd).negate()));
    const combinedFog = clamp(
      float(1.0).sub(float(1.0).sub(fogFactor).mul(float(1.0).sub(heightFog))),
      0.0,
      1.0
    );
    const viewAway = normalize(vWorldPos.sub(cameraPosition).add(vec3(0.0001)));
    const sunInscatter = pow(max(0.0, dot(viewAway, uSunDir)), 5.0).mul(uSunInscatterStrength);
    const aerialColor = mix(uFogColor, uSunInscatterColor, clamp(sunInscatter, 0.0, 0.72));
    litCol.assign(mix(litCol, aerialColor, combinedFog));

    return vec4(litCol, 1.0);
  })();

  return {
    material: mat,
    uniforms: {
      uLodInnerStart,
      uLodInnerEnd,
      uLodOuterStart,
      uLodOuterEnd,
      uBladeHeight,
      uBladeWidth,
      uWindWaveStrength,
      uTipGlow,
      uPrimaryCol,
      uSecondaryCol,
      uUseCustomDualTone,
      uMixNoiseScale,
      uCarexMix,
      uTuftClumpiness,
      uCameraPos,
      uTime,
      uWindStrength,
      uSunDir,
      uSunColor,
      uSunIntensity,
      uSkyColor,
      uGroundHemiColor,
      uHemiIntensity,
      uFogColor,
      uFogDensity,
      uFogNear,
      uFogFar,
      uFogMode,
      uHeightFogDensity,
      uHeightFogLevel,
      uSunInscatterColor,
      uSunInscatterStrength,
      uShadowCoolColor,
      uShadowLiftStrength,
      uRimStrength,
      uHeroActive,
      uHeroPos,
    },
  };
}

/** Spatial tile edge length in world meters (exact multiple of all LOD cell spacings). */
const GRASS_CHUNK_SIZE = 18.0;
const TRAIL_TEX_SIZE = 256;

export interface LodTierSpec {
  nearCellsPerSide: number;
  nearSpacing: number;
  nearBladesPerCell: number;
  farCellsPerSide: number;
  farSpacing: number;
  farBladesPerCell: number;
}

export function getLodTierSpec(quality: GrassQuality): LodTierSpec {
  switch (quality) {
    case 'light':
      return {
        nearCellsPerSide: 16,
        nearSpacing: GRASS_CHUNK_SIZE / 16, // 1.125m
        nearBladesPerCell: 2,
        farCellsPerSide: 9,
        farSpacing: GRASS_CHUNK_SIZE / 9, // 2.00m (each instance = 3-blade tuft card)
        farBladesPerCell: 1,
      };
    case 'dense':
      return {
        nearCellsPerSide: 26,
        nearSpacing: GRASS_CHUNK_SIZE / 26, // ~0.692m
        nearBladesPerCell: 3,
        farCellsPerSide: 13,
        farSpacing: GRASS_CHUNK_SIZE / 13, // ~1.385m
        farBladesPerCell: 2,
      };
    case 'ultra':
      return {
        nearCellsPerSide: 32,
        nearSpacing: GRASS_CHUNK_SIZE / 32, // 0.5625m
        nearBladesPerCell: 3,
        farCellsPerSide: 16,
        farSpacing: GRASS_CHUNK_SIZE / 16, // 1.125m
        farBladesPerCell: 2,
      };
    case 'lush':
    default:
      return {
        nearCellsPerSide: 22,
        nearSpacing: GRASS_CHUNK_SIZE / 22, // ~0.818m
        nearBladesPerCell: 2,
        farCellsPerSide: 11,
        farSpacing: GRASS_CHUNK_SIZE / 11, // ~1.636m
        farBladesPerCell: 2,
      };
  }
}

interface FloatingGrassTile {
  ox: number;
  oz: number;
  lastNearX: number;
  lastNearZ: number;
  lastFarX: number;
  lastFarZ: number;
  nearMesh: THREE.Mesh;
  farMesh: THREE.Mesh;
}

export interface GrassCullingStats {
  totalChunks: number;
  grassChunks: number;
  visibleNearChunks: number;
  visibleFarChunks: number;
  culledChunks: number;
  activeInstances: number;
}

interface BakedGrassMapSnapshot {
  heightsRef: TerrainData['heights'];
  layersRef: TerrainData['layers'];
  revision: number;
  size: number;
  worldRadius: number;
  biome: BiomeId;
  biomeGroundHex: string;
  biomeDetailHex: string;
  maxBladeHeightMilli: number;
  worldMapRevision: number;
  activeRegionCode: number;
  activeRegionOriginX: number;
  activeRegionOriginZ: number;
  terrainTexData: Float32Array;
  terrainTexHalfData: Uint16Array;
  groundColorData: Uint8Array;
  worldGridOrigin: number;
  worldGridCols: number;
  worldCellHasGrass: Uint8Array;
  worldCellMinY: Float32Array;
  worldCellMaxY: Float32Array;
  grassWorldCells: number;
}

const bakedGrassMapCache: BakedGrassMapSnapshot[] = [];

export class StylizedGrassSystem {
  public readonly group: THREE.Group;
  private terrainTex: THREE.DataTexture;
  private terrainTexData: Float32Array;
  private terrainTexHalfData: Uint16Array;
  private groundColorTex: THREE.DataTexture;
  private groundColorData: Uint8Array;
  private buffersSharedFromCache = false;
  private readonly trailTex: THREE.DataTexture;
  private readonly trailData: Uint8Array;
  private readonly activeTrailIndices: number[] = [];
  private readonly inActiveTrail: Uint8Array;
  private trailDecayAccum = 0;
  private pendingTrailUpload = false;
  private lastTrailUploadTime = -1;
  private prevHeroX = 0;
  private prevHeroZ = 0;
  private hasPrevHero = false;

  private readonly terrainTexSize: number;
  private readonly terrainWorldRadius: number;
  private readonly densityBias: number;
  private readonly biomeGroundHex: string;
  private readonly biomeDetailHex: string;

  private readonly nearMat: MeshBasicNodeMaterial;
  private readonly farMat: MeshBasicNodeMaterial;
  private readonly nearUniforms: GrassMaterialBundle['uniforms'];
  private readonly farUniforms: GrassMaterialBundle['uniforms'];
  private readonly nearGeo: THREE.InstancedBufferGeometry;
  private readonly farGeo: THREE.InstancedBufferGeometry;
  private readonly nearBaseBlade: THREE.BufferGeometry;
  private readonly farBaseBlade: THREE.BufferGeometry;
  private readonly nearInstancesPerChunk: number;
  private readonly farInstancesPerChunk: number;

  // Coarse O(1) world-cell height/grass lookup grid + compact camera-snapped floating tile pool
  private readonly worldGridOrigin: number;
  private readonly worldGridCols: number;
  private worldCellHasGrass: Uint8Array;
  private worldCellMinY: Float32Array;
  private worldCellMaxY: Float32Array;
  private grassWorldCells = 0;
  private readonly floatingTiles: FloatingGrassTile[] = [];

  private config: GrassFieldConfig;
  private readonly baseViewDist: number;
  private viewDist: number;
  private nearEnd: number;
  private farStart: number;
  private dynamicViewScale = 1;
  private readonly maxBladeHeight: number;

  private lastStats: GrassCullingStats = {
    totalChunks: 0,
    grassChunks: 0,
    visibleNearChunks: 0,
    visibleFarChunks: 0,
    culledChunks: 0,
    activeInstances: 0,
  };

  private readonly _frustum = new THREE.Frustum();
  private readonly _projScreenMatrix = new THREE.Matrix4();
  private readonly _sunDir = new THREE.Vector3();
  private readonly _tileBox = new THREE.Box3();

  private worldMapCtx?: GrassWorldMapMaskContext;

  constructor(opts: {
    terrain: TerrainData;
    biome: BiomeId;
    biomeGroundHex: string;
    biomeDetailHex: string;
    visualStyle: VisualStyleId;
    config?: Partial<GrassFieldConfig>;
    isSoftwareGl?: boolean;
    worldMapCtx?: GrassWorldMapMaskContext;
  }) {
    this.group = new THREE.Group();
    this.group.name = 'StylizedGrassSystem';
    this.group.userData.disposeExtra = () => this.dispose();
    this.worldMapCtx = opts.worldMapCtx;

    const resolved = resolveGrassConfig(opts.config);
    if ((opts.isSoftwareGl || isIOSDevice()) && resolved.quality !== 'off') {
      resolved.quality = 'light';
      resolved.viewDistance = Math.min(resolved.viewDistance, 44);
    }
    this.config = resolved;
    this.biomeGroundHex = opts.biomeGroundHex;
    this.biomeDetailHex = opts.biomeDetailHex;

    const palette = getBiomeGrassPalette(opts.biome, opts.biomeGroundHex, opts.biomeDetailHex);
    this.densityBias = palette.densityBias;

    const clampedBladeHeight = THREE.MathUtils.clamp(resolved.bladeHeight, 0.25, 1.6);
    this.maxBladeHeight = clampedBladeHeight * 1.5;
    const maxBladeHeightMilli = Math.round(this.maxBladeHeight * 1000);

    const upgraded = ensureUpgradedTerrain(opts.terrain);
    this.terrainTexSize = upgraded.size + 1;
    this.terrainWorldRadius = getTerrainRadius(upgraded);
    const texLen = this.terrainTexSize * this.terrainTexSize * 4;

    const halfSpanChunks = Math.ceil(this.terrainWorldRadius / GRASS_CHUNK_SIZE);
    this.worldGridOrigin = -halfSpanChunks * GRASS_CHUNK_SIZE;
    this.worldGridCols = halfSpanChunks * 2;
    const totalWorldCells = this.worldGridCols * this.worldGridCols;

    const wmRev = opts.worldMapCtx?.worldMap?.revision ?? 0;
    const wmCode = opts.worldMapCtx?.activeRegionCode ?? 0;
    const wmOriginX = opts.worldMapCtx?.activeRegionOrigin?.[0] ?? 0;
    const wmOriginZ = opts.worldMapCtx?.activeRegionOrigin?.[1] ?? 0;

    const cacheIdx = bakedGrassMapCache.findIndex(
      (c) =>
        c.heightsRef === upgraded.heights &&
        c.layersRef === upgraded.layers &&
        c.revision === (upgraded.revision ?? 0) &&
        c.size === upgraded.size &&
        c.worldRadius === this.terrainWorldRadius &&
        c.biome === opts.biome &&
        c.biomeGroundHex === this.biomeGroundHex &&
        c.biomeDetailHex === this.biomeDetailHex &&
        c.maxBladeHeightMilli === maxBladeHeightMilli &&
        c.worldMapRevision === wmRev &&
        c.activeRegionCode === wmCode &&
        c.activeRegionOriginX === wmOriginX &&
        c.activeRegionOriginZ === wmOriginZ
    );

    if (cacheIdx >= 0) {
      const hit = bakedGrassMapCache[cacheIdx];
      this.terrainTexData = hit.terrainTexData;
      this.terrainTexHalfData = hit.terrainTexHalfData;
      this.groundColorData = hit.groundColorData;
      this.worldCellHasGrass = hit.worldCellHasGrass;
      this.worldCellMinY = hit.worldCellMinY;
      this.worldCellMaxY = hit.worldCellMaxY;
      this.grassWorldCells = hit.grassWorldCells;
      this.lastStats.grassChunks = hit.grassWorldCells;
      this.buffersSharedFromCache = true;
    } else {
      this.terrainTexData = new Float32Array(texLen);
      this.terrainTexHalfData = new Uint16Array(texLen);
      this.groundColorData = new Uint8Array(texLen);

      populateTerrainAndColorTextures(
        upgraded,
        this.terrainTexData,
        this.groundColorData,
        this.densityBias,
        this.biomeGroundHex,
        this.biomeDetailHex,
        undefined,
        this.worldMapCtx
      );
      packTerrainHalfFloat(this.terrainTexData, this.terrainTexHalfData, this.terrainTexSize);

      this.worldCellHasGrass = new Uint8Array(totalWorldCells);
      this.worldCellMinY = new Float32Array(totalWorldCells);
      this.worldCellMaxY = new Float32Array(totalWorldCells);
      this.recomputeChunkBounds();

      bakedGrassMapCache.unshift({
        heightsRef: upgraded.heights,
        layersRef: upgraded.layers,
        revision: upgraded.revision ?? 0,
        size: upgraded.size,
        worldRadius: this.terrainWorldRadius,
        biome: opts.biome,
        biomeGroundHex: this.biomeGroundHex,
        biomeDetailHex: this.biomeDetailHex,
        maxBladeHeightMilli,
        worldMapRevision: wmRev,
        activeRegionCode: wmCode,
        activeRegionOriginX: wmOriginX,
        activeRegionOriginZ: wmOriginZ,
        terrainTexData: this.terrainTexData,
        terrainTexHalfData: this.terrainTexHalfData,
        groundColorData: this.groundColorData,
        worldGridOrigin: this.worldGridOrigin,
        worldGridCols: this.worldGridCols,
        worldCellHasGrass: this.worldCellHasGrass,
        worldCellMinY: this.worldCellMinY,
        worldCellMaxY: this.worldCellMaxY,
        grassWorldCells: this.grassWorldCells,
      });
      if (bakedGrassMapCache.length > 1) {
        bakedGrassMapCache.length = 1;
      }
      this.buffersSharedFromCache = true;
    }

    this.terrainTex = new THREE.DataTexture(
      this.terrainTexHalfData,
      this.terrainTexSize,
      this.terrainTexSize,
      THREE.RGBAFormat,
      THREE.HalfFloatType
    );
    this.terrainTex.minFilter = THREE.LinearFilter;
    this.terrainTex.magFilter = THREE.LinearFilter;
    this.terrainTex.wrapS = THREE.ClampToEdgeWrapping;
    this.terrainTex.wrapT = THREE.ClampToEdgeWrapping;
    this.terrainTex.generateMipmaps = false;
    this.terrainTex.needsUpdate = true;

    this.groundColorTex = new THREE.DataTexture(
      this.groundColorData,
      this.terrainTexSize,
      this.terrainTexSize,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    );
    this.groundColorTex.colorSpace = THREE.NoColorSpace;
    this.groundColorTex.minFilter = THREE.LinearFilter;
    this.groundColorTex.magFilter = THREE.LinearFilter;
    this.groundColorTex.wrapS = THREE.ClampToEdgeWrapping;
    this.groundColorTex.wrapT = THREE.ClampToEdgeWrapping;
    this.groundColorTex.generateMipmaps = false;
    this.groundColorTex.needsUpdate = true;

    const trailPixels = TRAIL_TEX_SIZE * TRAIL_TEX_SIZE;
    this.trailData = new Uint8Array(trailPixels * 4);
    this.inActiveTrail = new Uint8Array(trailPixels);
    for (let i = 0; i < trailPixels; i++) {
      const o = i * 4;
      this.trailData[o] = 0;
      this.trailData[o + 1] = 128;
      this.trailData[o + 2] = 128;
      this.trailData[o + 3] = 255;
    }
    this.trailTex = new THREE.DataTexture(
      this.trailData,
      TRAIL_TEX_SIZE,
      TRAIL_TEX_SIZE,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    );
    this.trailTex.minFilter = THREE.LinearFilter;
    this.trailTex.magFilter = THREE.LinearFilter;
    this.trailTex.wrapS = THREE.ClampToEdgeWrapping;
    this.trailTex.wrapT = THREE.ClampToEdgeWrapping;
    this.trailTex.generateMipmaps = false;
    this.trailTex.needsUpdate = true;

    const viewDist = THREE.MathUtils.clamp(resolved.viewDistance, 26, 90);
    const spec = getLodTierSpec(resolved.quality);

    // Push Near->Far transition well past the 3rd-person character with wide overlapping diffuse bands
    const nearEnd = viewDist * 0.64;
    const nearFadeStart = viewDist * 0.48;
    const farStart = viewDist * 0.44;
    const farFadeInEnd = viewDist * 0.60;
    const farFadeOutStart = viewDist * 0.72;

    this.baseViewDist = viewDist;
    this.viewDist = viewDist;
    this.nearEnd = nearEnd;
    this.farStart = farStart;

    this.nearBaseBlade = createNearBladeGeometry(1.06);
    this.farBaseBlade = createFarTuftCardGeometry(1.0);

    const nearInst = buildChunkInstancedGeometry(
      this.nearBaseBlade,
      spec.nearCellsPerSide,
      spec.nearBladesPerCell,
      GRASS_CHUNK_SIZE
    );
    const farInst = buildChunkInstancedGeometry(
      this.farBaseBlade,
      spec.farCellsPerSide,
      spec.farBladesPerCell,
      GRASS_CHUNK_SIZE
    );
    this.nearGeo = nearInst.geometry;
    this.farGeo = farInst.geometry;
    this.nearInstancesPerChunk = nearInst.instanceCount;
    this.farInstancesPerChunk = farInst.instanceCount;

    const bladeWidthBase = THREE.MathUtils.clamp(resolved.bladeWidth, 0.04, 0.22);
    const windWaveStr = THREE.MathUtils.clamp(resolved.windWaveStrength, 0.1, 2.5);
    const tipGlowVal = THREE.MathUtils.clamp(resolved.tipGlow, 0, 1.4);
    const celMode = opts.visualStyle === 'celToon';
    const useCustomDualTone = Boolean(resolved.primaryColor || resolved.secondaryColor);
    const primaryColorHex = resolved.primaryColor ?? palette.midHex;
    const secondaryColorHex = resolved.secondaryColor ?? palette.tipHex;
    const mixNoiseScale = THREE.MathUtils.clamp(resolved.mixNoiseScale ?? 1.0, 0.2, 3.0);
    const carexMix = THREE.MathUtils.clamp(resolved.carexMix ?? 0.32, 0.0, 1.0);
    const tuftClumpiness = THREE.MathUtils.clamp(resolved.tuftClumpiness ?? 0.45, 0.0, 1.0);

    const nearBundle = createGrassNodeMaterial({
      terrainTex: this.terrainTex,
      groundColorTex: this.groundColorTex,
      trailTex: this.trailTex,
      terrainTexSize: this.terrainTexSize,
      trailTexSize: TRAIL_TEX_SIZE,
      worldRadius: this.terrainWorldRadius,
      cellSpacing: spec.nearSpacing,
      isFarTuft: false,
      innerStart: 0.0,
      innerEnd: 0.0,
      outerStart: nearFadeStart,
      outerEnd: nearEnd,
      bladeHeight: clampedBladeHeight,
      bladeWidth: bladeWidthBase,
      windWaveStrength: windWaveStr,
      tipGlow: tipGlowVal,
      celMode,
      rootHex: palette.rootHex,
      midHex: palette.midHex,
      tipHex: palette.tipHex,
      crestHex: palette.crestHex,
      primaryColorHex,
      secondaryColorHex,
      useCustomDualTone,
      mixNoiseScale,
      carexMix,
      tuftClumpiness,
    });
    this.nearMat = nearBundle.material;
    this.nearUniforms = nearBundle.uniforms;

    const farBundle = createGrassNodeMaterial({
      terrainTex: this.terrainTex,
      groundColorTex: this.groundColorTex,
      trailTex: this.trailTex,
      terrainTexSize: this.terrainTexSize,
      trailTexSize: TRAIL_TEX_SIZE,
      worldRadius: this.terrainWorldRadius,
      cellSpacing: spec.farSpacing,
      isFarTuft: true,
      innerStart: farStart,
      innerEnd: farFadeInEnd,
      outerStart: farFadeOutStart,
      outerEnd: viewDist,
      bladeHeight: clampedBladeHeight,
      bladeWidth: bladeWidthBase,
      windWaveStrength: windWaveStr,
      tipGlow: tipGlowVal,
      celMode,
      rootHex: palette.rootHex,
      midHex: palette.midHex,
      tipHex: palette.tipHex,
      crestHex: palette.crestHex,
      primaryColorHex,
      secondaryColorHex,
      useCustomDualTone,
      mixNoiseScale,
      carexMix,
      tuftClumpiness,
    });
    this.farMat = farBundle.material;
    this.farUniforms = farBundle.uniforms;

    // 2. Allocate compact camera-snapped floating tile ring covering only the active circular view radius
    const maxRing = Math.ceil((viewDist + 6.0) / GRASS_CHUNK_SIZE);
    const maxRangeSq = (viewDist + 6.0 + GRASS_CHUNK_SIZE * 0.72) ** 2;

    for (let oz = -maxRing; oz <= maxRing; oz++) {
      for (let ox = -maxRing; ox <= maxRing; ox++) {
        // Skip outer corner tiles that never intersect the view circle around the camera cell
        const nearDx = Math.max(0, Math.abs(ox) - 1) * GRASS_CHUNK_SIZE;
        const nearDz = Math.max(0, Math.abs(oz) - 1) * GRASS_CHUNK_SIZE;
        if (nearDx * nearDx + nearDz * nearDz > maxRangeSq) continue;

        const nearMesh = new THREE.Mesh(this.nearGeo, this.nearMat);
        nearMesh.matrixAutoUpdate = false;
        nearMesh.frustumCulled = false;
        nearMesh.castShadow = false;
        nearMesh.receiveShadow = false;
        nearMesh.visible = false;

        const farMesh = new THREE.Mesh(this.farGeo, this.farMat);
        farMesh.matrixAutoUpdate = false;
        farMesh.frustumCulled = false;
        farMesh.castShadow = false;
        farMesh.receiveShadow = false;
        farMesh.visible = false;

        this.group.add(nearMesh, farMesh);
        this.floatingTiles.push({
          ox,
          oz,
          lastNearX: Number.NaN,
          lastNearZ: Number.NaN,
          lastFarX: Number.NaN,
          lastFarZ: Number.NaN,
          nearMesh,
          farMesh,
        });
      }
    }

    this.lastStats.totalChunks = this.floatingTiles.length;
    this.group.visible = resolved.enabled && resolved.quality !== 'off';
  }

  private recomputeChunkBounds(brushArea?: { x: number; z: number; radius: number }): void {
    const worldRadius = this.terrainWorldRadius;
    const texSize = this.terrainTexSize;
    const gridMax = texSize - 1;
    const data = this.terrainTexData;
    const brushPad = brushArea ? brushArea.radius + 5.5 : 0;

    let grassCells = 0;

    for (let gz = 0; gz < this.worldGridCols; gz++) {
      const minZ = this.worldGridOrigin + gz * GRASS_CHUNK_SIZE;
      const maxZ = minZ + GRASS_CHUNK_SIZE;
      for (let gx = 0; gx < this.worldGridCols; gx++) {
        const minX = this.worldGridOrigin + gx * GRASS_CHUNK_SIZE;
        const maxX = minX + GRASS_CHUNK_SIZE;
        const cellIdx = gz * this.worldGridCols + gx;

        if (
          maxX < -worldRadius ||
          minX > worldRadius ||
          maxZ < -worldRadius ||
          minZ > worldRadius
        ) {
          this.worldCellHasGrass[cellIdx] = 0;
          continue;
        }

        if (brushArea) {
          const outsideBrush =
            maxX < brushArea.x - brushPad ||
            minX > brushArea.x + brushPad ||
            maxZ < brushArea.z - brushPad ||
            minZ > brushArea.z + brushPad;
          if (outsideBrush) {
            if (this.worldCellHasGrass[cellIdx]) grassCells++;
            continue;
          }
        }

        const minCol = Math.max(
          0,
          Math.floor(((minX - 1.5 + worldRadius) / (2 * worldRadius)) * gridMax)
        );
        const maxCol = Math.min(
          gridMax,
          Math.ceil(((maxX + 1.5 + worldRadius) / (2 * worldRadius)) * gridMax)
        );
        const minRow = Math.max(
          0,
          Math.floor(((minZ - 1.5 + worldRadius) / (2 * worldRadius)) * gridMax)
        );
        const maxRow = Math.min(
          gridMax,
          Math.ceil(((maxZ + 1.5 + worldRadius) / (2 * worldRadius)) * gridMax)
        );

        let minY = Infinity;
        let maxY = -Infinity;
        let hasGrass = false;

        for (let row = minRow; row <= maxRow; row++) {
          const rowOff = row * texSize;
          for (let col = minCol; col <= maxCol; col++) {
            const o = (rowOff + col) * 4;
            const h = data[o];
            const mask = data[o + 1];
            if (mask >= 0.08) {
              hasGrass = true;
              if (h < minY) minY = h;
              if (h > maxY) maxY = h;
            }
          }
        }

        this.worldCellHasGrass[cellIdx] = hasGrass ? 1 : 0;
        if (hasGrass) {
          grassCells++;
          this.worldCellMinY[cellIdx] = minY - 0.5;
          this.worldCellMaxY[cellIdx] = maxY + this.maxBladeHeight + 0.75;
        }
      }
    }

    this.grassWorldCells = grassCells;
    this.lastStats.grassChunks = grassCells;
  }

  public updateTerrainData(
    rawTerrain: TerrainData,
    brushArea?: { x: number; z: number; radius: number },
    worldMapCtx?: GrassWorldMapMaskContext
  ): void {
    if (worldMapCtx) {
      this.worldMapCtx = worldMapCtx;
    }
    const terrain = ensureUpgradedTerrain(rawTerrain);
    if (terrain.size + 1 !== this.terrainTexSize) return;

    if (this.buffersSharedFromCache) {
      this.terrainTexData = this.terrainTexData.slice();
      this.terrainTexHalfData = this.terrainTexHalfData.slice();
      this.groundColorData = this.groundColorData.slice();
      this.worldCellHasGrass = this.worldCellHasGrass.slice();
      this.worldCellMinY = this.worldCellMinY.slice();
      this.worldCellMaxY = this.worldCellMaxY.slice();
      (this.terrainTex.image as { data: Uint16Array }).data = this.terrainTexHalfData;
      (this.groundColorTex.image as { data: Uint8Array }).data = this.groundColorData;
      this.buffersSharedFromCache = false;
    }

    let bounds: { minRow: number; maxRow: number; minCol: number; maxCol: number } | undefined;
    if (brushArea) {
      const worldRadius = getTerrainRadius(terrain);
      const pad = brushArea.radius + 5.0;
      const size = terrain.size;
      bounds = {
        minCol: Math.floor(((brushArea.x - pad + worldRadius) / (2 * worldRadius)) * size),
        maxCol: Math.ceil(((brushArea.x + pad + worldRadius) / (2 * worldRadius)) * size),
        minRow: Math.floor(((brushArea.z - pad + worldRadius) / (2 * worldRadius)) * size),
        maxRow: Math.ceil(((brushArea.z + pad + worldRadius) / (2 * worldRadius)) * size),
      };
    }

    populateTerrainAndColorTextures(
      terrain,
      this.terrainTexData,
      this.groundColorData,
      this.densityBias,
      this.biomeGroundHex,
      this.biomeDetailHex,
      bounds,
      this.worldMapCtx
    );
    packTerrainHalfFloat(this.terrainTexData, this.terrainTexHalfData, this.terrainTexSize, bounds);
    this.terrainTex.needsUpdate = true;
    this.groundColorTex.needsUpdate = true;
    this.recomputeChunkBounds(brushArea);
  }

  public applyConfigUniforms(cfg?: Partial<GrassFieldConfig> | null): void {
    const resolved = resolveGrassConfig(cfg);
    this.config = resolved;
    this.group.visible = resolved.enabled && resolved.quality !== 'off';
    const bladeH = THREE.MathUtils.clamp(resolved.bladeHeight, 0.25, 1.8);
    const bladeW = THREE.MathUtils.clamp(resolved.bladeWidth, 0.04, 0.22);
    const windStr = THREE.MathUtils.clamp(resolved.windWaveStrength, 0.1, 2.5);
    const tipGlow = THREE.MathUtils.clamp(resolved.tipGlow, 0, 1.4);
    const useDual = resolved.primaryColor || resolved.secondaryColor ? 1.0 : 0.0;
    const mixScale = THREE.MathUtils.clamp(resolved.mixNoiseScale ?? 1.0, 0.2, 3.0);
    const carex = THREE.MathUtils.clamp(resolved.carexMix ?? 0.32, 0.0, 1.0);
    const clump = THREE.MathUtils.clamp(resolved.tuftClumpiness ?? 0.45, 0.0, 1.0);

    for (const u of [this.nearUniforms, this.farUniforms]) {
      u.uBladeHeight.value = bladeH;
      u.uBladeWidth.value = bladeW;
      u.uWindWaveStrength.value = windStr;
      u.uTipGlow.value = tipGlow;
      u.uUseCustomDualTone.value = useDual;
      if (resolved.primaryColor) u.uPrimaryCol.value.set(resolved.primaryColor);
      if (resolved.secondaryColor) u.uSecondaryCol.value.set(resolved.secondaryColor);
      u.uMixNoiseScale.value = mixScale;
      u.uCarexMix.value = carex;
      u.uTuftClumpiness.value = clump;
    }
  }

  public setDynamicViewScale(scale: number): void {
    const clamped = THREE.MathUtils.clamp(scale, 0.52, 1.0);
    if (Math.abs(clamped - this.dynamicViewScale) < 0.02) return;
    this.dynamicViewScale = clamped;
    const vd = this.baseViewDist * clamped;
    this.viewDist = vd;
    this.nearEnd = vd * 0.64;
    this.farStart = vd * 0.44;

    this.nearUniforms.uLodOuterStart.value = vd * 0.48;
    this.nearUniforms.uLodOuterEnd.value = this.nearEnd;
    this.farUniforms.uLodInnerStart.value = this.farStart;
    this.farUniforms.uLodInnerEnd.value = vd * 0.60;
    this.farUniforms.uLodOuterStart.value = vd * 0.72;
    this.farUniforms.uLodOuterEnd.value = vd;
  }

  private updateTrailMap(
    elapsedTime: number,
    heroPosition?: THREE.Vector3 | null
  ): void {
    const dt = Math.min(0.1, Math.max(0, elapsedTime - this.trailDecayAccum));
    let dirty = false;

    // 1. Decay active trampled texels smoothly back upright (~5.5s recovery) at ~18Hz
    if (dt >= 0.055) {
      this.trailDecayAccum = elapsedTime;
      if (this.activeTrailIndices.length > 0) {
        const stepDown = Math.max(1, Math.round(dt * 44));
        for (let i = this.activeTrailIndices.length - 1; i >= 0; i--) {
          const pIdx = this.activeTrailIndices[i];
          const o = pIdx * 4;
          const next = Math.max(0, this.trailData[o] - stepDown);
          if (next !== this.trailData[o]) {
            this.trailData[o] = next;
            dirty = true;
          }
          if (next === 0) {
            this.inActiveTrail[pIdx] = 0;
            const last = this.activeTrailIndices.pop()!;
            if (i < this.activeTrailIndices.length) {
              this.activeTrailIndices[i] = last;
            }
          }
        }
      }
    }

    // 2. Stamp hero movement trail footprint into the active DataTexture
    if (this.config.interactiveParting && heroPosition) {
      const worldRadius = this.terrainWorldRadius;
      const hx = heroPosition.x;
      const hz = heroPosition.z;
      let moveDx = 0;
      let moveDz = 0;
      let movedSq = 1;
      if (this.hasPrevHero) {
        moveDx = hx - this.prevHeroX;
        moveDz = hz - this.prevHeroZ;
        movedSq = moveDx * moveDx + moveDz * moveDz;
      }
      this.prevHeroX = hx;
      this.prevHeroZ = hz;
      this.hasPrevHero = true;

      if (movedSq > 0.0002 && Math.abs(hx) < worldRadius && Math.abs(hz) < worldRadius) {
        const moveLen = Math.sqrt(movedSq);
        const dirX = moveDx / moveLen;
        const dirZ = moveDz / moveLen;
        const encG = Math.round((dirX * 0.5 + 0.5) * 255);
        const encB = Math.round((dirZ * 0.5 + 0.5) * 255);

        const texMax = TRAIL_TEX_SIZE - 1;
        const fx = ((hx + worldRadius) / (2 * worldRadius)) * texMax;
        const fz = ((hz + worldRadius) / (2 * worldRadius)) * texMax;
        const cx = Math.round(fx);
        const cz = Math.round(fz);
        const stampRad = 1; // ~1.25m per texel -> 3x3 soft footprint brush

        for (let dz = -stampRad; dz <= stampRad; dz++) {
          const rz = cz + dz;
          if (rz < 0 || rz >= TRAIL_TEX_SIZE) continue;
          for (let dx = -stampRad; dx <= stampRad; dx++) {
            const rx = cx + dx;
            if (rx < 0 || rx >= TRAIL_TEX_SIZE) continue;
            const d2 = dx * dx + dz * dz;
            if (d2 > 2) continue;
            const strength = d2 === 0 ? 235 : d2 === 1 ? 185 : 115;
            const pIdx = rz * TRAIL_TEX_SIZE + rx;
            const o = pIdx * 4;
            if (strength > this.trailData[o]) {
              this.trailData[o] = strength;
              this.trailData[o + 1] = encG;
              this.trailData[o + 2] = encB;
              dirty = true;
            } else if (this.trailData[o] > 40) {
              this.trailData[o + 1] = Math.round((this.trailData[o + 1] + encG) * 0.5);
              this.trailData[o + 2] = Math.round((this.trailData[o + 2] + encB) * 0.5);
              dirty = true;
            }
            if (this.inActiveTrail[pIdx] === 0 && this.trailData[o] > 0) {
              this.inActiveTrail[pIdx] = 1;
              this.activeTrailIndices.push(pIdx);
            }
          }
        }
      }
    } else {
      this.hasPrevHero = false;
    }

    if (dirty) {
      this.pendingTrailUpload = true;
    }
    if (
      this.pendingTrailUpload &&
      (this.lastTrailUploadTime < 0 || elapsedTime - this.lastTrailUploadTime >= 0.065)
    ) {
      this.trailTex.needsUpdate = true;
      this.pendingTrailUpload = false;
      this.lastTrailUploadTime = elapsedTime;
    }
  }

  public getCullingStats(): GrassCullingStats {
    return { ...this.lastStats };
  }

  public update(
    camera: THREE.PerspectiveCamera,
    sun: THREE.DirectionalLight,
    hemi: THREE.HemisphereLight,
    scene: THREE.Scene,
    elapsedTime: number,
    windFactor: number,
    heroPosition?: THREE.Vector3 | null
  ): void {
    if (!this.group.visible) return;

    this.updateTrailMap(elapsedTime, heroPosition);

    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    this._projScreenMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    const camWithDepth = camera as THREE.PerspectiveCamera & { reversedDepth?: boolean };
    this._frustum.setFromProjectionMatrix(
      this._projScreenMatrix,
      camera.coordinateSystem,
      camWithDepth.reversedDepth
    );

    const camX = camera.position.x;
    const camZ = camera.position.z;
    const snapCol = Math.floor((camX - this.worldGridOrigin) / GRASS_CHUNK_SIZE);
    const snapRow = Math.floor((camZ - this.worldGridOrigin) / GRASS_CHUNK_SIZE);

    const maxDistCutoff = this.viewDist + 5.0;
    const nearCutoff = this.nearEnd + 5.0;
    const farMinCutoff = Math.max(0, this.farStart - 5.0);
    const padXZ = 1.25;

    let visibleNearChunks = 0;
    let visibleFarChunks = 0;
    let culledChunks = 0;

    for (let i = 0; i < this.floatingTiles.length; i++) {
      const tile = this.floatingTiles[i];
      const gx = snapCol + tile.ox;
      const gz = snapRow + tile.oz;

      if (gx < 0 || gx >= this.worldGridCols || gz < 0 || gz >= this.worldGridCols) {
        tile.nearMesh.visible = false;
        tile.farMesh.visible = false;
        culledChunks++;
        continue;
      }

      const cellIdx = gz * this.worldGridCols + gx;
      if (this.worldCellHasGrass[cellIdx] === 0) {
        tile.nearMesh.visible = false;
        tile.farMesh.visible = false;
        culledChunks++;
        continue;
      }

      const minX = this.worldGridOrigin + gx * GRASS_CHUNK_SIZE;
      const minZ = this.worldGridOrigin + gz * GRASS_CHUNK_SIZE;
      const maxX = minX + GRASS_CHUNK_SIZE;
      const maxZ = minZ + GRASS_CHUNK_SIZE;

      const closestX = camX < minX ? minX : camX > maxX ? maxX : camX;
      const closestZ = camZ < minZ ? minZ : camZ > maxZ ? maxZ : camZ;
      const minDistXZ = Math.hypot(camX - closestX, camZ - closestZ);

      if (minDistXZ > maxDistCutoff) {
        tile.nearMesh.visible = false;
        tile.farMesh.visible = false;
        culledChunks++;
        continue;
      }

      this._tileBox.min.set(minX - padXZ, this.worldCellMinY[cellIdx], minZ - padXZ);
      this._tileBox.max.set(maxX + padXZ, this.worldCellMaxY[cellIdx], maxZ + padXZ);
      if (!this._frustum.intersectsBox(this._tileBox)) {
        tile.nearMesh.visible = false;
        tile.farMesh.visible = false;
        culledChunks++;
        continue;
      }

      const farX = Math.abs(camX - minX) > Math.abs(camX - maxX) ? minX : maxX;
      const farZ = Math.abs(camZ - minZ) > Math.abs(camZ - maxZ) ? minZ : maxZ;
      const maxDistXZ = Math.hypot(camX - farX, camZ - farZ);

      const showNear = minDistXZ <= nearCutoff;
      const showFar = maxDistXZ >= farMinCutoff && minDistXZ <= maxDistCutoff;

      if (showNear) {
        if (tile.lastNearX !== minX || tile.lastNearZ !== minZ) {
          tile.nearMesh.position.set(minX, 0, minZ);
          tile.nearMesh.updateMatrix();
          tile.nearMesh.updateMatrixWorld(true);
          tile.lastNearX = minX;
          tile.lastNearZ = minZ;
        }
        tile.nearMesh.visible = true;
        visibleNearChunks++;
      } else {
        tile.nearMesh.visible = false;
      }

      if (showFar) {
        if (tile.lastFarX !== minX || tile.lastFarZ !== minZ) {
          tile.farMesh.position.set(minX, 0, minZ);
          tile.farMesh.updateMatrix();
          tile.farMesh.updateMatrixWorld(true);
          tile.lastFarX = minX;
          tile.lastFarZ = minZ;
        }
        tile.farMesh.visible = true;
        visibleFarChunks++;
      } else {
        tile.farMesh.visible = false;
      }

      if (!showNear && !showFar) culledChunks++;
    }

    this.lastStats.grassChunks = this.grassWorldCells;
    this.lastStats.visibleNearChunks = visibleNearChunks;
    this.lastStats.visibleFarChunks = visibleFarChunks;
    this.lastStats.culledChunks = culledChunks;
    this.lastStats.activeInstances =
      visibleNearChunks * this.nearInstancesPerChunk +
      visibleFarChunks * this.farInstancesPerChunk;

    if (visibleNearChunks === 0 && visibleFarChunks === 0) return;

    this._sunDir.copy(sun.position).sub(sun.target.position);
    if (this._sunDir.lengthSq() < 0.0001) {
      this._sunDir.set(0.4, 0.75, 0.5);
    }
    this._sunDir.normalize();

    const fog = scene.fog;
    let fogMode = 0.0;
    let fogDensity = 0.002;
    let fogNear = 50;
    let fogFar = 220;
    if (fog instanceof THREE.FogExp2) {
      fogMode = 2.0;
      fogDensity = fog.density;
    } else if (fog instanceof THREE.Fog) {
      fogMode = 1.0;
      fogNear = fog.near;
      fogFar = fog.far;
    }

    const heroOn = Boolean(this.config.interactiveParting && heroPosition);
    const botwU = getSharedBotwUniforms();
    const fogBundle = scene.userData?.botwFogUniforms as BotwFogUniformBundle | undefined;

    const applyUniforms = (u: GrassMaterialBundle['uniforms']) => {
      u.uCameraPos.value.copy(camera.position);
      u.uTime.value = elapsedTime;
      u.uWindStrength.value = windFactor;
      u.uSunDir.value.copy(this._sunDir);
      u.uSunColor.value.copy(sun.color);
      u.uSunIntensity.value = sun.intensity;
      u.uSkyColor.value.copy(hemi.color);
      u.uGroundHemiColor.value.copy(hemi.groundColor);
      u.uHemiIntensity.value = hemi.intensity;
      u.uFogMode.value = fogMode;
      u.uFogDensity.value = fogDensity;
      u.uFogNear.value = fogNear;
      u.uFogFar.value = Math.max(fogFar, fogNear + 0.01);
      if (fog) {
        u.uFogColor.value.copy(fog.color);
      }
      if (fogBundle) {
        u.uHeightFogDensity.value = fogBundle.uHeightFogDensity.value;
        u.uHeightFogLevel.value = fogBundle.uHeightFogLevel.value;
        u.uSunInscatterColor.value.copy(fogBundle.uSunInscatterColor.value);
        u.uSunInscatterStrength.value = fogBundle.uSunInscatterStrength.value;
      }
      u.uShadowCoolColor.value.copy(botwU.uShadowCoolColor.value);
      u.uShadowLiftStrength.value = botwU.uShadowLiftStrength.value;
      u.uRimStrength.value = botwU.uRimStrength.value;
      u.uHeroActive.value = heroOn ? 1.0 : 0.0;
      if (heroPosition) {
        u.uHeroPos.value.copy(heroPosition);
      }
    };

    if (visibleNearChunks > 0) applyUniforms(this.nearUniforms);
    if (visibleFarChunks > 0) applyUniforms(this.farUniforms);
  }

  public dispose(): void {
    this.terrainTex.dispose();
    this.groundColorTex.dispose();
    this.trailTex.dispose();
    this.nearGeo.dispose();
    this.farGeo.dispose();
    this.nearBaseBlade.dispose();
    this.farBaseBlade.dispose();
    this.nearMat.dispose();
    this.farMat.dispose();
    this.floatingTiles.length = 0;
    this.activeTrailIndices.length = 0;
  }
}
