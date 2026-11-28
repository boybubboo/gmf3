import * as THREE from 'three';
import type { TerrainData, TerrainQualityTier, WorldMapData } from '../types/maker';
import { getWorldMapRadius, sampleWorldMapInto, WORLD_TERRAIN_YELLOW, type WorldMapSample } from '../utils/worldMap';
import {
  getTerrainRadius,
  getTerrainShoreRadius,
  IslandTerrain,
  sampleTerrainHeight,
  sampleTerrainWeathering,
} from '../utils/terrain';
import { disposeObjectBVH, initBvhAcceleration } from './bvhAcceleration';

export interface TerrainWorldMapContext {
  worldMap?: WorldMapData;
  mode: 'worldMap' | 'land';
  activeRegionCode?: number;
  activeRegionOrigin?: [number, number];
}

export interface TerrainLodThresholds {
  lod0Dist: number;
  lod1Dist: number;
  detailLevel: number; // 0..1 fed to TSL shader micro-normals / octaves
}

export function resolveTerrainQualityThresholds(tier: TerrainQualityTier = 'balanced'): TerrainLodThresholds {
  if (tier === 'performance') {
    return { lod0Dist: 68, lod1Dist: 132, detailLevel: 0.42 };
  }
  if (tier === 'ultra') {
    return { lod0Dist: 148, lod1Dist: 255, detailLevel: 1.0 };
  }
  return { lod0Dist: 98, lod1Dist: 184, detailLevel: 0.76 };
}

export const TERRAIN_CHUNK_GRID = 8; // 8x8 = 64 chunks
export const TERRAIN_CHUNK_CELLS = 40; // divisible cleanly by 1 (LOD0), 2 (LOD1), and 4 (LOD2)
export const TERRAIN_RENDER_SIZE = TERRAIN_CHUNK_GRID * TERRAIN_CHUNK_CELLS; // 320

const CHUNK_STRIDE = TERRAIN_CHUNK_CELLS + 1; // 41
const SURFACE_VERT_COUNT = CHUNK_STRIDE * CHUNK_STRIDE; // 1681
const SKIRT_EDGE_LEN = CHUNK_STRIDE; // 41 per edge
const SKIRT_DROP_METERS = 1.65;
const TOTAL_CHUNK_VERTS = SURFACE_VERT_COUNT + SKIRT_EDGE_LEN * 4; // 1845

interface LodRange {
  start: number;
  count: number;
}

interface SharedChunkIndexBundle {
  indexAttr: THREE.BufferAttribute;
  ranges: [LodRange, LodRange, LodRange];
}

let _sharedChunkIndexBundle: SharedChunkIndexBundle | null = null;

function buildSharedChunkIndexBundle(): SharedChunkIndexBundle {
  if (_sharedChunkIndexBundle) return _sharedChunkIndexBundle;

  const indices: number[] = [];
  const ranges: LodRange[] = [];

  const skirtTopStart = SURFACE_VERT_COUNT;
  const skirtBottomStart = SURFACE_VERT_COUNT + SKIRT_EDGE_LEN;
  const skirtLeftStart = SURFACE_VERT_COUNT + SKIRT_EDGE_LEN * 2;
  const skirtRightStart = SURFACE_VERT_COUNT + SKIRT_EDGE_LEN * 3;

  const strides = [1, 2, 4] as const;
  for (let lod = 0; lod < strides.length; lod++) {
    const s = strides[lod];
    const start = indices.length;

    // 1. Checkerboard alternating-diagonal surface quads
    for (let r = 0; r < TERRAIN_CHUNK_CELLS; r += s) {
      const rNext = r + s;
      const rowA = r * CHUNK_STRIDE;
      const rowB = rNext * CHUNK_STRIDE;
      for (let c = 0; c < TERRAIN_CHUNK_CELLS; c += s) {
        const a = rowA + c;
        const b = a + s;
        const p = rowB + c;
        const d = p + s;
        if (((r / s + c / s) & 1) === 0) {
          indices.push(a, p, b, b, p, d);
        } else {
          indices.push(a, p, d, a, d, b);
        }
      }
    }

    // 2. Four seam-hiding downward skirts around chunk perimeter
    // North edge (r = 0, outward normal -Z): surface c -> c+s, skirt dropped -Y
    for (let c = 0; c < TERRAIN_CHUNK_CELLS; c += s) {
      const t0 = c;
      const t1 = c + s;
      const s0 = skirtTopStart + c;
      const s1 = skirtTopStart + c + s;
      indices.push(t0, t1, s0, t1, s1, s0);
    }
    // South edge (r = TERRAIN_CHUNK_CELLS, outward normal +Z)
    const botRowOffset = TERRAIN_CHUNK_CELLS * CHUNK_STRIDE;
    for (let c = 0; c < TERRAIN_CHUNK_CELLS; c += s) {
      const t0 = botRowOffset + c;
      const t1 = botRowOffset + c + s;
      const s0 = skirtBottomStart + c;
      const s1 = skirtBottomStart + c + s;
      indices.push(t0, s0, t1, t1, s0, s1);
    }
    // West edge (c = 0, outward normal -X)
    for (let r = 0; r < TERRAIN_CHUNK_CELLS; r += s) {
      const t0 = r * CHUNK_STRIDE;
      const t1 = (r + s) * CHUNK_STRIDE;
      const s0 = skirtLeftStart + r;
      const s1 = skirtLeftStart + r + s;
      indices.push(t0, s0, t1, t1, s0, s1);
    }
    // East edge (c = TERRAIN_CHUNK_CELLS, outward normal +X)
    for (let r = 0; r < TERRAIN_CHUNK_CELLS; r += s) {
      const t0 = r * CHUNK_STRIDE + TERRAIN_CHUNK_CELLS;
      const t1 = (r + s) * CHUNK_STRIDE + TERRAIN_CHUNK_CELLS;
      const s0 = skirtRightStart + r;
      const s1 = skirtRightStart + r + s;
      indices.push(t0, t1, s0, t1, s1, s0);
    }

    ranges.push({ start, count: indices.length - start });
  }

  const indexArray = new Uint16Array(indices);
  const indexAttr = new THREE.BufferAttribute(indexArray, 1);
  _sharedChunkIndexBundle = {
    indexAttr,
    ranges: [ranges[0], ranges[1], ranges[2]],
  };
  return _sharedChunkIndexBundle;
}

interface TerrainChunkNode {
  cx: number;
  cz: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  centerX: number;
  centerY: number;
  centerZ: number;
  currentLod: 0 | 1 | 2;
  mesh: THREE.Mesh;
  geometry: THREE.BufferGeometry;
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  w0: Float32Array;
  w1: Float32Array;
  w2: Float32Array;
  weather0: Float32Array;
  weather1: Float32Array;
}

const _chunkOceanCol = new THREE.Color('#1B6B93');
const _chunkYellowCol = new THREE.Color(WORLD_TERRAIN_YELLOW);
const _chunkTmpCol = new THREE.Color();
const _chunkRegionColMap = new Map<number, THREE.Color>();
const _chunkGauss = [1, 4, 6, 4, 1];
const _chunkAcc = new Float32Array(10);
const _chunkWmScratch: WorldMapSample = { land: 0, regionCode: 0, isBorder: false };

export class ChunkedTerrainSystem {
  public readonly group: THREE.Group;
  public readonly worldRadius: number;
  public readonly renderStep: number;
  private readonly chunks: TerrainChunkNode[] = [];
  private readonly sharedIndices: SharedChunkIndexBundle;
  private lastCamX = Number.NaN;
  private lastCamZ = Number.NaN;
  private lastQualityTier: TerrainQualityTier = 'balanced';
  private isFreeform: boolean;
  private material: THREE.Material;

  constructor(
    terrain: TerrainData,
    material: THREE.Material,
    isFreeform: boolean,
    worldRadius: number,
    worldMapContext?: TerrainWorldMapContext
  ) {
    this.group = new THREE.Group();
    this.group.name = 'chunked-terrain-root';
    this.material = material;
    this.isFreeform = isFreeform;
    this.worldRadius = worldRadius;
    this.renderStep = (2 * worldRadius) / TERRAIN_RENDER_SIZE;
    this.sharedIndices = buildSharedChunkIndexBundle();

    const chunkWorldSpan = (2 * worldRadius) / TERRAIN_CHUNK_GRID;
    const isWorldMap = worldMapContext?.mode === 'worldMap' && Boolean(worldMapContext.worldMap);
    const shoreRadius = getTerrainShoreRadius(terrain);
    const shorePadSq = Math.pow(shoreRadius + chunkWorldSpan * 0.85, 2);

    for (let cz = 0; cz < TERRAIN_CHUNK_GRID; cz++) {
      const minZ = -worldRadius + cz * chunkWorldSpan;
      const maxZ = minZ + chunkWorldSpan;
      const centerZ = (minZ + maxZ) * 0.5;

      for (let cx = 0; cx < TERRAIN_CHUNK_GRID; cx++) {
        const minX = -worldRadius + cx * chunkWorldSpan;
        const maxX = minX + chunkWorldSpan;
        const centerX = (minX + maxX) * 0.5;

        // Skip chunks far outside classic circular islands
        if (!isFreeform && !isWorldMap) {
          const nearX = Math.max(minX, Math.min(0, maxX));
          const nearZ = Math.max(minZ, Math.min(0, maxZ));
          if (nearX * nearX + nearZ * nearZ > shorePadSq) continue;
        }

        const positions = new Float32Array(TOTAL_CHUNK_VERTS * 3);
        const normals = new Float32Array(TOTAL_CHUNK_VERTS * 3);
        const colors = new Float32Array(TOTAL_CHUNK_VERTS * 3);
        const w0 = new Float32Array(TOTAL_CHUNK_VERTS * 4);
        const w1 = new Float32Array(TOTAL_CHUNK_VERTS * 3);
        const w2 = new Float32Array(TOTAL_CHUNK_VERTS * 3);
        const weather0 = new Float32Array(TOTAL_CHUNK_VERTS * 4);
        const weather1 = new Float32Array(TOTAL_CHUNK_VERTS);

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('aW0', new THREE.BufferAttribute(w0, 4));
        geometry.setAttribute('aW1', new THREE.BufferAttribute(w1, 3));
        geometry.setAttribute('aW2', new THREE.BufferAttribute(w2, 3));
        geometry.setAttribute('aWeather0', new THREE.BufferAttribute(weather0, 4));
        geometry.setAttribute('aWeather1', new THREE.BufferAttribute(weather1, 1));
        geometry.setIndex(new THREE.BufferAttribute(this.sharedIndices.indexAttr.array as Uint16Array, 1));
        geometry.setDrawRange(this.sharedIndices.ranges[0].start, this.sharedIndices.ranges[0].count);

        const mesh = new THREE.Mesh(geometry, material);
        mesh.receiveShadow = true;
        mesh.castShadow = true;
        mesh.frustumCulled = true;
        mesh.userData.isGround = true;
        mesh.userData.terrainChunk = { cx, cz };
        this.group.add(mesh);

        const node: TerrainChunkNode = {
          cx,
          cz,
          minX,
          maxX,
          minZ,
          maxZ,
          centerX,
          centerY: 1.0,
          centerZ,
          currentLod: 0,
          mesh,
          geometry,
          positions,
          normals,
          colors,
          w0,
          w1,
          w2,
          weather0,
          weather1,
        };
        this.populateChunk(node, terrain, worldMapContext);
        this.chunks.push(node);
      }
    }
  }

  public setMaterial(nextMat: THREE.Material): void {
    this.material = nextMat;
    for (let i = 0; i < this.chunks.length; i++) {
      this.chunks[i].mesh.material = nextMat;
    }
  }

  /**
   * Rebuilds only the 1..4 chunks touched by a sculpt/paint brush stroke (or all chunks if no bounds).
   */
  public updateFromTerrain(
    terrain: TerrainData,
    brushArea?: { x: number; z: number; radius: number },
    worldMapContext?: TerrainWorldMapContext
  ): number {
    this.isFreeform = Boolean(terrain.freeformWorld) || worldMapContext?.mode === 'worldMap';
    const pad = brushArea ? brushArea.radius + 7.5 : 0;
    const minBx = brushArea ? brushArea.x - pad : -Infinity;
    const maxBx = brushArea ? brushArea.x + pad : Infinity;
    const minBz = brushArea ? brushArea.z - pad : -Infinity;
    const maxBz = brushArea ? brushArea.z + pad : Infinity;

    let updatedCount = 0;
    for (let i = 0; i < this.chunks.length; i++) {
      const ch = this.chunks[i];
      if (brushArea) {
        if (ch.maxX < minBx || ch.minX > maxBx || ch.maxZ < minBz || ch.minZ > maxBz) {
          continue;
        }
      }
      this.populateChunk(ch, terrain, worldMapContext);
      updatedCount++;
    }
    return updatedCount;
  }

  /**
   * Switches each chunk's active LOD drawRange with hysteresis based on camera distance and Quality Tier.
   */
  public updateLOD(cameraPos: THREE.Vector3, qualityTier: TerrainQualityTier = 'balanced'): void {
    const dxCam = cameraPos.x - this.lastCamX;
    const dzCam = cameraPos.z - this.lastCamZ;
    if (
      qualityTier === this.lastQualityTier &&
      dxCam * dxCam + dzCam * dzCam < 9.0
    ) {
      return;
    }
    this.lastCamX = cameraPos.x;
    this.lastCamZ = cameraPos.z;
    this.lastQualityTier = qualityTier;

    const worldScale = Math.max(1, this.worldRadius / 156);
    const thresh = resolveTerrainQualityThresholds(qualityTier);
    const d0 = thresh.lod0Dist * worldScale;
    const d1 = thresh.lod1Dist * worldScale;
    const hyst = 10 * worldScale;

    for (let i = 0; i < this.chunks.length; i++) {
      const ch = this.chunks[i];
      const d = Math.hypot(ch.centerX - cameraPos.x, ch.centerZ - cameraPos.z);
      let nextLod = ch.currentLod;

      if (ch.currentLod === 0) {
        if (d > d1 + hyst) nextLod = 2;
        else if (d > d0 + hyst) nextLod = 1;
      } else if (ch.currentLod === 1) {
        if (d < d0 - hyst) nextLod = 0;
        else if (d > d1 + hyst) nextLod = 2;
      } else {
        if (d < d0 - hyst) nextLod = 0;
        else if (d < d1 - hyst) nextLod = 1;
      }

      if (nextLod !== ch.currentLod) {
        ch.currentLod = nextLod;
        const r = this.sharedIndices.ranges[nextLod];
        ch.geometry.setDrawRange(r.start, r.count);
      }
    }
  }

  public sampleWaterDepthGrid(
    outData: Float32Array,
    size: number,
    worldRadius: number
  ): void {
    const maxIdx = size - 1;
    const worldDiameter = worldRadius * 2;
    // Fast lookup via terrain/positions when called on full world-map rebuild
    for (let row = 0; row <= maxIdx; row++) {
      const wz = -worldRadius + (row / maxIdx) * worldDiameter;
      const rowOff = row * size;
      for (let col = 0; col <= maxIdx; col++) {
        const wx = -worldRadius + (col / maxIdx) * worldDiameter;
        const h = this.sampleHeightApprox(wx, wz);
        const idx = (rowOff + col) * 4;
        outData[idx] = h;
        outData[idx + 1] = h;
        outData[idx + 2] = h;
        outData[idx + 3] = 1.0;
      }
    }
  }

  private sampleHeightApprox(x: number, z: number): number {
    const worldDiameter = this.worldRadius * 2;
    const u = Math.max(0, Math.min(0.9999, (x + this.worldRadius) / worldDiameter));
    const v = Math.max(0, Math.min(0.9999, (z + this.worldRadius) / worldDiameter));
    const cx = Math.floor(u * TERRAIN_CHUNK_GRID);
    const cz = Math.floor(v * TERRAIN_CHUNK_GRID);
    const chunk = this.chunks.find((c) => c.cx === cx && c.cz === cz);
    if (!chunk) return IslandTerrain.seaFloor;
    const lc = Math.min(
      TERRAIN_CHUNK_CELLS,
      Math.max(0, Math.round((u * TERRAIN_CHUNK_GRID - cx) * TERRAIN_CHUNK_CELLS))
    );
    const lr = Math.min(
      TERRAIN_CHUNK_CELLS,
      Math.max(0, Math.round((v * TERRAIN_CHUNK_GRID - cz) * TERRAIN_CHUNK_CELLS))
    );
    return chunk.positions[(lr * CHUNK_STRIDE + lc) * 3 + 1];
  }

  private populateChunk(
    chunk: TerrainChunkNode,
    terrain: TerrainData,
    worldMapContext?: TerrainWorldMapContext
  ): void {
    const srcSize = terrain.size;
    const srcWidth = srcSize + 1;
    const worldRadius = this.worldRadius;
    const step = this.renderStep;
    const hasWeathering =
      Boolean(terrain.weathering) && terrain.weathering!.length === srcWidth * srcWidth;

    const wm = worldMapContext?.worldMap;
    const isWorldMap = worldMapContext?.mode === 'worldMap' && Boolean(wm);
    const activeRegionCode = worldMapContext?.activeRegionCode ?? 0;
    const activeOriginX = worldMapContext?.activeRegionOrigin?.[0] ?? 0;
    const activeOriginZ = worldMapContext?.activeRegionOrigin?.[1] ?? 0;
    const checkOtherLand = worldMapContext?.mode === 'land' && Boolean(wm) && activeRegionCode > 0;

    if (isWorldMap && wm) {
      _chunkRegionColMap.clear();
      for (const r of wm.regions) {
        _chunkRegionColMap.set(r.code, new THREE.Color(r.colorHex));
      }
    }

    const { positions, normals, colors, w0, w1, w2, weather0, weather1 } = chunk;
    const globalRowStart = chunk.cz * TERRAIN_CHUNK_CELLS;
    const globalColStart = chunk.cx * TERRAIN_CHUNK_CELLS;

    let minY = Infinity;
    let maxY = -Infinity;

    const sampleH = (wx: number, wz: number): number => {
      if (isWorldMap && wm) {
        const wmS = sampleWorldMapInto(wm, wx, wz, _chunkWmScratch);
        return wmS.land === 1 ? (wmS.isBorder ? 0.55 : IslandTerrain.baseTop) : IslandTerrain.seaFloor;
      }
      return sampleTerrainHeight(terrain, wx, wz);
    };

    for (let lr = 0; lr < CHUNK_STRIDE; lr++) {
      const grow = globalRowStart + lr;
      const vz = -worldRadius + grow * step;
      const srcFZ = (grow / TERRAIN_RENDER_SIZE) * srcSize;
      const baseR = Math.round(srcFZ);

      for (let lc = 0; lc < CHUNK_STRIDE; lc++) {
        const gcol = globalColStart + lc;
        const vx = -worldRadius + gcol * step;
        const idx = lr * CHUNK_STRIDE + lc;

        let h: number;
        let wmSample: WorldMapSample | null = null;
        if (isWorldMap && wm) {
          wmSample = sampleWorldMapInto(wm, vx, vz, _chunkWmScratch);
          h = wmSample.land === 1 ? (wmSample.isBorder ? 0.55 : IslandTerrain.baseTop) : IslandTerrain.seaFloor;
        } else {
          h = sampleTerrainHeight(terrain, vx, vz);
          if (checkOtherLand && wm) {
            wmSample = sampleWorldMapInto(wm, activeOriginX + vx, activeOriginZ + vz, _chunkWmScratch);
          }
        }

        if (h < minY) minY = h;
        if (h > maxY) maxY = h;

        positions[idx * 3] = vx;
        positions[idx * 3 + 1] = h;
        positions[idx * 3 + 2] = vz;

        // Cross-chunk seamless finite-difference normal computed in continuous world coordinates
        const hL = sampleH(vx - step, vz);
        const hR = sampleH(vx + step, vz);
        const hU = sampleH(vx, vz - step);
        const hD = sampleH(vx, vz + step);
        const nx = -(hR - hL) / (2 * step);
        const ny = 1.0;
        const nz = -(hD - hU) / (2 * step);
        const invLen = 1 / Math.hypot(nx, ny, nz);
        normals[idx * 3] = nx * invLen;
        normals[idx * 3 + 1] = ny * invLen;
        normals[idx * 3 + 2] = nz * invLen;

        const srcFX = (gcol / TERRAIN_RENDER_SIZE) * srcSize;
        const baseC = Math.round(srcFX);

        const rMin = baseR > 1 ? baseR - 2 : 0;
        const rMax = baseR + 2 < srcSize ? baseR + 2 : srcSize;
        const cMin = baseC > 1 ? baseC - 2 : 0;
        const cMax = baseC + 2 < srcSize ? baseC + 2 : srcSize;
        const centerL = terrain.layers[baseR * srcWidth + baseC] ?? 0;
        const isUniform =
          centerL >= 0 &&
          centerL < 10 &&
          (terrain.layers[rMin * srcWidth + cMin] ?? 0) === centerL &&
          (terrain.layers[rMin * srcWidth + cMax] ?? 0) === centerL &&
          (terrain.layers[rMax * srcWidth + cMin] ?? 0) === centerL &&
          (terrain.layers[rMax * srcWidth + cMax] ?? 0) === centerL &&
          (terrain.layers[baseR * srcWidth + cMin] ?? 0) === centerL &&
          (terrain.layers[baseR * srcWidth + cMax] ?? 0) === centerL &&
          (terrain.layers[rMin * srcWidth + baseC] ?? 0) === centerL &&
          (terrain.layers[rMax * srcWidth + baseC] ?? 0) === centerL;

        if (isUniform) {
          w0[idx * 4 + 0] = centerL === 0 ? 1 : 0;
          w0[idx * 4 + 1] = centerL === 1 ? 1 : 0;
          w0[idx * 4 + 2] = centerL === 2 ? 1 : 0;
          w0[idx * 4 + 3] = centerL === 3 ? 1 : 0;
          w1[idx * 3 + 0] = centerL === 4 ? 1 : 0;
          w1[idx * 3 + 1] = centerL === 5 ? 1 : 0;
          w1[idx * 3 + 2] = centerL === 6 ? 1 : 0;
          w2[idx * 3 + 0] = centerL === 7 ? 1 : 0;
          w2[idx * 3 + 1] = centerL === 8 ? 1 : 0;
          w2[idx * 3 + 2] = centerL === 9 ? 1 : 0;
        } else {
          for (let k = 0; k < 10; k++) _chunkAcc[k] = 0;
          let totalW = 0;
          for (let dr = -2; dr <= 2; dr++) {
            const nr = Math.max(0, Math.min(srcSize, baseR + dr));
            const wy = _chunkGauss[dr + 2];
            const rowOff = nr * srcWidth;
            for (let dc = -2; dc <= 2; dc++) {
              const nc = Math.max(0, Math.min(srcSize, baseC + dc));
              const wt = wy * _chunkGauss[dc + 2];
              const l = terrain.layers[rowOff + nc] ?? 0;
              if (l >= 0 && l < 10) {
                _chunkAcc[l] += wt;
                totalW += wt;
              }
            }
          }
          const inv = totalW > 0 ? 1 / totalW : 1;
          w0[idx * 4 + 0] = _chunkAcc[0] * inv;
          w0[idx * 4 + 1] = _chunkAcc[1] * inv;
          w0[idx * 4 + 2] = _chunkAcc[2] * inv;
          w0[idx * 4 + 3] = _chunkAcc[3] * inv;
          w1[idx * 3 + 0] = _chunkAcc[4] * inv;
          w1[idx * 3 + 1] = _chunkAcc[5] * inv;
          w1[idx * 3 + 2] = _chunkAcc[6] * inv;
          w2[idx * 3 + 0] = _chunkAcc[7] * inv;
          w2[idx * 3 + 1] = _chunkAcc[8] * inv;
          w2[idx * 3 + 2] = _chunkAcc[9] * inv;
        }

        if (isWorldMap && wmSample) {
          if (wmSample.land === 0) {
            _chunkTmpCol.copy(_chunkOceanCol);
          } else {
            const regCol = wmSample.regionCode > 0 ? _chunkRegionColMap.get(wmSample.regionCode) : undefined;
            _chunkTmpCol.copy(regCol ?? _chunkYellowCol);
            if (wmSample.isBorder) _chunkTmpCol.multiplyScalar(0.74);
          }
          colors[idx * 3] = _chunkTmpCol.r;
          colors[idx * 3 + 1] = _chunkTmpCol.g;
          colors[idx * 3 + 2] = _chunkTmpCol.b;
        } else if (checkOtherLand && wmSample) {
          const isOther = wmSample.land === 1 && wmSample.regionCode !== activeRegionCode ? 1.0 : 0.0;
          colors[idx * 3] = isOther;
          colors[idx * 3 + 1] = isOther;
          colors[idx * 3 + 2] = isOther;
        } else {
          const shade = THREE.MathUtils.clamp(0.92 + h * 0.017, 0.82, 1.14);
          colors[idx * 3] = shade;
          colors[idx * 3 + 1] = shade;
          colors[idx * 3 + 2] = shade;
        }

        if (hasWeathering) {
          const ws = sampleTerrainWeathering(terrain, vx, vz);
          weather0[idx * 4 + 0] = ws.moss;
          weather0[idx * 4 + 1] = ws.cracks;
          weather0[idx * 4 + 2] = ws.scorch;
          weather0[idx * 4 + 3] = ws.mud;
          weather1[idx] = ws.frost;
        } else {
          weather0[idx * 4 + 0] = 0;
          weather0[idx * 4 + 1] = 0;
          weather0[idx * 4 + 2] = 0;
          weather0[idx * 4 + 3] = 0;
          weather1[idx] = 0;
        }
      }
    }

    // Copy boundary vertex attributes into the 4 skirt vertex strips dropped by SKIRT_DROP_METERS
    const copySkirtVertex = (srcIdx: number, dstIdx: number) => {
      positions[dstIdx * 3] = positions[srcIdx * 3];
      positions[dstIdx * 3 + 1] = positions[srcIdx * 3 + 1] - SKIRT_DROP_METERS;
      positions[dstIdx * 3 + 2] = positions[srcIdx * 3 + 2];

      normals[dstIdx * 3] = normals[srcIdx * 3];
      normals[dstIdx * 3 + 1] = normals[srcIdx * 3 + 1];
      normals[dstIdx * 3 + 2] = normals[srcIdx * 3 + 2];

      colors[dstIdx * 3] = colors[srcIdx * 3];
      colors[dstIdx * 3 + 1] = colors[srcIdx * 3 + 1];
      colors[dstIdx * 3 + 2] = colors[srcIdx * 3 + 2];

      w0[dstIdx * 4 + 0] = w0[srcIdx * 4 + 0];
      w0[dstIdx * 4 + 1] = w0[srcIdx * 4 + 1];
      w0[dstIdx * 4 + 2] = w0[srcIdx * 4 + 2];
      w0[dstIdx * 4 + 3] = w0[srcIdx * 4 + 3];

      w1[dstIdx * 3 + 0] = w1[srcIdx * 3 + 0];
      w1[dstIdx * 3 + 1] = w1[srcIdx * 3 + 1];
      w1[dstIdx * 3 + 2] = w1[srcIdx * 3 + 2];

      w2[dstIdx * 3 + 0] = w2[srcIdx * 3 + 0];
      w2[dstIdx * 3 + 1] = w2[srcIdx * 3 + 1];
      w2[dstIdx * 3 + 2] = w2[srcIdx * 3 + 2];

      weather0[dstIdx * 4 + 0] = weather0[srcIdx * 4 + 0];
      weather0[dstIdx * 4 + 1] = weather0[srcIdx * 4 + 1];
      weather0[dstIdx * 4 + 2] = weather0[srcIdx * 4 + 2];
      weather0[dstIdx * 4 + 3] = weather0[srcIdx * 4 + 3];
      weather1[dstIdx] = weather1[srcIdx];
    };

    const skirtTopStart = SURFACE_VERT_COUNT;
    const skirtBottomStart = SURFACE_VERT_COUNT + SKIRT_EDGE_LEN;
    const skirtLeftStart = SURFACE_VERT_COUNT + SKIRT_EDGE_LEN * 2;
    const skirtRightStart = SURFACE_VERT_COUNT + SKIRT_EDGE_LEN * 3;
    const botRowOff = TERRAIN_CHUNK_CELLS * CHUNK_STRIDE;

    for (let i = 0; i < CHUNK_STRIDE; i++) {
      copySkirtVertex(i, skirtTopStart + i);
      copySkirtVertex(botRowOff + i, skirtBottomStart + i);
      copySkirtVertex(i * CHUNK_STRIDE, skirtLeftStart + i);
      copySkirtVertex(i * CHUNK_STRIDE + TERRAIN_CHUNK_CELLS, skirtRightStart + i);
    }

    chunk.centerY = (minY + maxY) * 0.5;
    chunk.geometry.attributes.position.needsUpdate = true;
    chunk.geometry.attributes.normal.needsUpdate = true;
    chunk.geometry.attributes.color.needsUpdate = true;
    chunk.geometry.attributes.aW0.needsUpdate = true;
    chunk.geometry.attributes.aW1.needsUpdate = true;
    chunk.geometry.attributes.aW2.needsUpdate = true;
    chunk.geometry.attributes.aWeather0.needsUpdate = true;
    chunk.geometry.attributes.aWeather1.needsUpdate = true;
    chunk.geometry.computeBoundingBox();
    chunk.geometry.computeBoundingSphere();

    // Maintain O(log N) MeshBVH on LOD0 surface range for fast sculpting & Play Mode raycasting
    initBvhAcceleration();
    const bvhGeo = chunk.geometry as THREE.BufferGeometry & {
      boundsTree?: unknown;
      computeBoundsTree?: (opts?: Record<string, unknown>) => void;
      disposeBoundsTree?: () => void;
    };
    if (bvhGeo.boundsTree && typeof bvhGeo.disposeBoundsTree === 'function') {
      bvhGeo.disposeBoundsTree();
    }
    if (typeof bvhGeo.computeBoundsTree === 'function') {
      try {
        const lod0 = this.sharedIndices.ranges[0];
        bvhGeo.computeBoundsTree({
          range: { start: lod0.start, count: lod0.count },
          maxLeafSize: 16,
        });
      } catch {
        // Fallback safely to standard raycast
      }
    }
  }

  public dispose(): void {
    disposeObjectBVH(this.group);
    for (let i = 0; i < this.chunks.length; i++) {
      this.chunks[i].geometry.dispose();
    }
    this.chunks.length = 0;
  }
}

export function computeEffectiveWorldMapRadius(worldMap?: WorldMapData): number {
  return getWorldMapRadius(worldMap);
}
