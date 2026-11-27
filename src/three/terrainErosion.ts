import type { TerrainData } from '../types/maker';
import {
  ensureUpgradedTerrain,
  getTerrainRadius,
  IslandTerrain,
  isInsideCarvedCave,
} from '../utils/terrain';

/**
 * Fast, deterministic Particle-Based Hydraulic + Thermal Talus Erosion engine
 * operating directly on `TerrainData.heights` (`(size + 1) * (size + 1)`).
 *
 * Carves realistic branching mountain gullies, ridge creases, and alluvial scree fans
 * while protecting roads, underwater basins, and carved cave entrances.
 */

export interface ErosionOptions {
  /** Number of simulated rain droplets (200..22000). */
  droplets?: number;
  /** Maximum simulation steps per droplet. */
  maxSteps?: number;
  /** Strength multiplier for hydraulic carving (0.2..2.0). */
  strength?: number;
  /** Number of thermal scree relaxation passes (0..6). */
  thermalPasses?: number;
  /** Optional world-space circular focus region (for live Erosion Brush). */
  region?: { x: number; z: number; radius: number };
  /** Deterministic PRNG seed. */
  seed?: number;
}

function createMulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Builds a protection mask (0 = protected, 1 = erodible) so erosion never
 * destroys carved cave mouths, paved roads, or underwater riverbeds.
 */
function buildErosionMask(
  terrain: TerrainData,
  heights: Float32Array,
  width: number,
  worldRadius: number,
  cellSize: number,
  region?: { x: number; z: number; radius: number }
): Float32Array {
  const mask = new Float32Array(width * width);
  const waterCut = IslandTerrain.waterLevel + 0.6;
  const roads = terrain.roads ?? [];
  const caves = terrain.caves ?? [];

  const regX = region?.x ?? 0;
  const regZ = region?.z ?? 0;
  const regR = region?.radius ?? 0;
  const regR2 = regR * regR;

  for (let gz = 0; gz < width; gz++) {
    const wz = -worldRadius + gz * cellSize;
    const rowOff = gz * width;
    for (let gx = 0; gx < width; gx++) {
      const idx = rowOff + gx;
      const h = heights[idx];
      if (h <= waterCut) {
        mask[idx] = 0;
        continue;
      }

      const wx = -worldRadius + gx * cellSize;
      let weight = Math.min(1, (h - waterCut) / 2.2);

      if (region && regR > 0.1) {
        const dx = wx - regX;
        const dz = wz - regZ;
        const d2 = dx * dx + dz * dz;
        if (d2 >= regR2) {
          mask[idx] = 0;
          continue;
        }
        const t = 1 - Math.sqrt(d2) / regR;
        weight *= t * t * (3 - 2 * t);
      }

      // Protect road splines so erosion never breaks walkable paths
      for (let r = 0; r < roads.length; r++) {
        const pts = roads[r].points;
        const halfW = (roads[r].width ?? 3.6) * 0.78 + 1.5;
        const halfW2 = halfW * halfW;
        for (let k = 0; k < pts.length; k++) {
          const dx = wx - pts[k][0];
          const dz = wz - pts[k][1];
          if (dx * dx + dz * dz < halfW2) {
            weight = 0;
            break;
          }
        }
        if (weight <= 0.001) break;
      }
      if (weight <= 0.001) {
        mask[idx] = 0;
        continue;
      }

      // Gently preserve carved cave vaults & portals
      if (caves.length > 0 && isInsideCarvedCave(terrain, wx, wz)) {
        weight *= 0.2;
      }

      mask[idx] = weight;
    }
  }

  return mask;
}

/**
 * Runs realistic Particle-Based Hydraulic + Thermal Talus Erosion on `TerrainData`
 * and returns a new immutable `TerrainData` snapshot with bumped `revision`.
 */
export function runTerrainErosion(
  rawTerrain: TerrainData,
  options?: ErosionOptions
): TerrainData {
  const terrain = ensureUpgradedTerrain(rawTerrain);
  const size = terrain.size;
  const width = size + 1;
  const srcHeights = terrain.heights;
  if (!srcHeights || srcHeights.length !== width * width) {
    return terrain;
  }

  const worldRadius = getTerrainRadius(terrain);
  const cellSize = (worldRadius * 2) / size;

  const heights = new Float32Array(srcHeights.length);
  for (let i = 0; i < srcHeights.length; i++) {
    heights[i] = srcHeights[i];
  }

  const region = options?.region;
  const strength = Math.max(0.15, Math.min(2.2, options?.strength ?? 0.9));
  const dropletCount = Math.max(
    180,
    Math.min(24000, Math.round(options?.droplets ?? (region ? 1100 : 12000)))
  );
  const maxSteps = Math.max(12, Math.min(48, options?.maxSteps ?? (region ? 24 : 34)));
  const thermalPasses = Math.max(0, Math.min(6, options?.thermalPasses ?? (region ? 1 : 3)));

  const mask = buildErosionMask(terrain, heights, width, worldRadius, cellSize, region);
  const rand = createMulberry32(
    options?.seed ??
      Math.floor(
        (region ? region.x * 73856093 + region.z * 19349663 : 1337) +
          (terrain.revision ?? 1) * 31337
      )
  );

  let minGx = 2;
  let maxGx = width - 3;
  let minGz = 2;
  let maxGz = width - 3;
  if (region && region.radius > 0.1) {
    const radCells = Math.ceil(region.radius / cellSize) + 1;
    const cx = (region.x + worldRadius) / cellSize;
    const cz = (region.z + worldRadius) / cellSize;
    minGx = Math.max(2, Math.floor(cx - radCells));
    maxGx = Math.min(width - 3, Math.ceil(cx + radCells));
    minGz = Math.max(2, Math.floor(cz - radCells));
    maxGz = Math.min(width - 3, Math.ceil(cz + radCells));
    if (maxGx <= minGx || maxGz <= minGz) return terrain;
  }

  const inertia = 0.08;
  const sedimentCapacityFactor = 3.5 * strength;
  const minSedimentCapacity = 0.008;
  const erodeSpeed = 0.25 * strength;
  const depositSpeed = 0.28 * strength;
  const evaporateSpeed = 0.025;
  const gravity = 4.0;

  const brushOffsets = [
    [-1, -1, 0.05],
    [0, -1, 0.1],
    [1, -1, 0.05],
    [-1, 0, 0.1],
    [0, 0, 0.4],
    [1, 0, 0.1],
    [-1, 1, 0.05],
    [0, 1, 0.1],
    [1, 1, 0.05],
  ] as const;

  // Track cumulative erosion intensity per cell to expose rock on carved gullies
  const carvedAmount = new Float32Array(width * width);

  for (let d = 0; d < dropletCount; d++) {
    let posX = minGx + rand() * (maxGx - minGx);
    let posZ = minGz + rand() * (maxGz - minGz);

    const startIdx = Math.floor(posZ) * width + Math.floor(posX);
    if (mask[startIdx] < 0.04) continue;

    let dirX = 0;
    let dirZ = 0;
    let speed = 1.0;
    let water = 1.0;
    let sediment = 0.0;

    for (let step = 0; step < maxSteps; step++) {
      const nodeX = Math.floor(posX);
      const nodeZ = Math.floor(posZ);
      if (nodeX < 1 || nodeX >= width - 2 || nodeZ < 1 || nodeZ >= width - 2) break;

      const cellOffsetX = posX - nodeX;
      const cellOffsetZ = posZ - nodeZ;
      const idx00 = nodeZ * width + nodeX;

      const h00 = heights[idx00];
      const h10 = heights[idx00 + 1];
      const h01 = heights[idx00 + width];
      const h11 = heights[idx00 + width + 1];

      const gradX = (h10 - h00) * (1 - cellOffsetZ) + (h11 - h01) * cellOffsetZ;
      const gradZ = (h01 - h00) * (1 - cellOffsetX) + (h11 - h10) * cellOffsetX;
      const heightOld =
        h00 * (1 - cellOffsetX) * (1 - cellOffsetZ) +
        h10 * cellOffsetX * (1 - cellOffsetZ) +
        h01 * (1 - cellOffsetX) * cellOffsetZ +
        h11 * cellOffsetX * cellOffsetZ;

      dirX = dirX * inertia - gradX * (1 - inertia);
      dirZ = dirZ * inertia - gradZ * (1 - inertia);
      const len = Math.hypot(dirX, dirZ);
      if (len < 1e-5) {
        const a = rand() * Math.PI * 2;
        dirX = Math.cos(a);
        dirZ = Math.sin(a);
      } else {
        dirX /= len;
        dirZ /= len;
      }

      posX += dirX;
      posZ += dirZ;
      if (posX < 1 || posX >= width - 2 || posZ < 1 || posZ >= width - 2) break;

      const newX = Math.floor(posX);
      const newZ = Math.floor(posZ);
      const newOffX = posX - newX;
      const newOffZ = posZ - newZ;
      const nIdx = newZ * width + newX;
      const heightNew =
        heights[nIdx] * (1 - newOffX) * (1 - newOffZ) +
        heights[nIdx + 1] * newOffX * (1 - newOffZ) +
        heights[nIdx + width] * (1 - newOffX) * newOffZ +
        heights[nIdx + width + 1] * newOffX * newOffZ;

      const deltaHeight = heightNew - heightOld;
      const sedimentCapacity = Math.max(
        -deltaHeight * speed * water * sedimentCapacityFactor,
        minSedimentCapacity
      );

      const m = mask[idx00];
      if (m <= 0.002) break;

      if (sediment > sedimentCapacity || deltaHeight > 0) {
        const amountToDeposit =
          deltaHeight > 0
            ? Math.min(deltaHeight, sediment)
            : (sediment - sedimentCapacity) * depositSpeed;
        sediment -= amountToDeposit;
        const dep = amountToDeposit * m;
        heights[idx00] += dep * (1 - cellOffsetX) * (1 - cellOffsetZ);
        heights[idx00 + 1] += dep * cellOffsetX * (1 - cellOffsetZ);
        heights[idx00 + width] += dep * (1 - cellOffsetX) * cellOffsetZ;
        heights[idx00 + width + 1] += dep * cellOffsetX * cellOffsetZ;
      } else {
        const amountToErode = Math.min(
          (sedimentCapacity - sediment) * erodeSpeed,
          -deltaHeight * 0.92
        );
        let erodedTotal = 0;
        for (let b = 0; b < brushOffsets.length; b++) {
          const [ox, oz, w] = brushOffsets[b];
          const bx = nodeX + ox;
          const bz = nodeZ + oz;
          if (bx < 1 || bx >= width - 1 || bz < 1 || bz >= width - 1) continue;
          const bIdx = bz * width + bx;
          const bm = mask[bIdx];
          if (bm <= 0.002) continue;
          const delta = amountToErode * w * bm;
          const clamped = Math.min(
            delta,
            Math.max(0, heights[bIdx] - (IslandTerrain.waterLevel + 0.35))
          );
          heights[bIdx] -= clamped;
          carvedAmount[bIdx] += clamped;
          erodedTotal += clamped;
        }
        sediment += erodedTotal;
      }

      speed = Math.sqrt(Math.max(0.05, speed * speed + deltaHeight * gravity));
      water *= 1 - evaporateSpeed;
      if (water < 0.02) break;
    }
  }

  // Thermal scree / talus relaxation pass — gives steep cliffs realistic talus slopes
  if (thermalPasses > 0) {
    const talusThreshold = cellSize * 1.16;
    const thermalRate = 0.22 * Math.min(1.2, strength);
    const deltaBuf = new Float32Array(width * width);

    for (let pass = 0; pass < thermalPasses; pass++) {
      deltaBuf.fill(0);
      for (let gz = minGz; gz <= maxGz; gz++) {
        const row = gz * width;
        for (let gx = minGx; gx <= maxGx; gx++) {
          const idx = row + gx;
          const m = mask[idx];
          if (m <= 0.01) continue;
          const h = heights[idx];

          let maxDiff = 0;
          let totalExcess = 0;
          const n0 = idx - 1;
          const n1 = idx + 1;
          const n2 = idx - width;
          const n3 = idx + width;

          const d0 = h - heights[n0];
          const d1 = h - heights[n1];
          const d2 = h - heights[n2];
          const d3 = h - heights[n3];

          if (d0 > talusThreshold) {
            totalExcess += d0 - talusThreshold;
            if (d0 > maxDiff) maxDiff = d0;
          }
          if (d1 > talusThreshold) {
            totalExcess += d1 - talusThreshold;
            if (d1 > maxDiff) maxDiff = d1;
          }
          if (d2 > talusThreshold) {
            totalExcess += d2 - talusThreshold;
            if (d2 > maxDiff) maxDiff = d2;
          }
          if (d3 > talusThreshold) {
            totalExcess += d3 - talusThreshold;
            if (d3 > maxDiff) maxDiff = d3;
          }

          if (totalExcess > 0.001) {
            const transfer = (maxDiff - talusThreshold) * thermalRate * m;
            deltaBuf[idx] -= transfer;
            if (d0 > talusThreshold)
              deltaBuf[n0] += (transfer * (d0 - talusThreshold)) / totalExcess;
            if (d1 > talusThreshold)
              deltaBuf[n1] += (transfer * (d1 - talusThreshold)) / totalExcess;
            if (d2 > talusThreshold)
              deltaBuf[n2] += (transfer * (d2 - talusThreshold)) / totalExcess;
            if (d3 > talusThreshold)
              deltaBuf[n3] += (transfer * (d3 - talusThreshold)) / totalExcess;
          }
        }
      }

      for (let i = 0; i < heights.length; i++) {
        heights[i] += deltaBuf[i];
      }
    }
  }

  // Expose rock layer along strongly eroded mountain ridges/gullies (without overwriting snow/cobble)
  const updatedLayers = [...terrain.layers];
  for (let i = 0; i < carvedAmount.length; i++) {
    if (carvedAmount[i] > 0.14 && heights[i] > 4.2 && updatedLayers[i] === 0) {
      updatedLayers[i] = 2; // rock
    }
  }

  return {
    ...terrain,
    heights: Array.from(heights),
    layers: updatedLayers,
    revision: (terrain.revision ?? 0) + 1,
  };
}
