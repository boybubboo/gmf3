import type { ObjectMakerDoc } from '../types/maker';
import { DEFAULT_PART_MODIFIERS } from './objectMakerBuilder';

export const FALLBACK_FALLEN_LOG_ASSET_ID = 'builtin-fallen-log-chair';

/**
 * Thick woodland fallen log asset:
 * - Tree-trunk scale (~2.15m wide, ~0.72m thick)
 * - Furrowed bark exterior + lighter-beige organic uneven growth rings & dark heartwood hollow on ends
 * - Two broken branch nubs along the bark
 * - Pre-tagged with the 'sit' interaction attribute and calibrated seat placement
 */
export function createFallenLogObjectDoc(): ObjectMakerDoc {
  return {
    version: 1,
    interactionAttributes: ['sit'],
    interactionCalibrations: {
      sit: {
        offset: [0, 0.69, 0.14],
        yawDeg: 0,
      },
    },
    groups: [],
    parts: [
      {
        id: 'fallen_log_trunk',
        name: 'Fallen Trunk',
        shape: 'cylinder',
        position: [0, 0.36, 0],
        rotation: [0, 0, 90],
        dimensions: [0.72, 2.15, 0.72],
        modifiers: {
          ...DEFAULT_PART_MODIFIERS,
          bevel: 0.04,
          roundness: 0.08,
          edgeWear: 0.1,
        },
        material: {
          color: '#FFFFFF',
          roughness: 0.9,
          metalness: 0,
          proceduralSurface: 'logBark',
        },
      },
      {
        id: 'fallen_log_rings_right',
        name: 'Cut Rings Right',
        shape: 'cylinder',
        position: [1.07, 0.36, 0],
        rotation: [0, 0, 90],
        dimensions: [0.64, 0.03, 0.64],
        modifiers: {
          ...DEFAULT_PART_MODIFIERS,
          bevel: 0.01,
        },
        material: {
          color: '#FFFFFF',
          roughness: 0.84,
          metalness: 0,
          proceduralSurface: 'logRings',
        },
      },
      {
        id: 'fallen_log_rings_left',
        name: 'Cut Rings Left',
        shape: 'cylinder',
        position: [-1.07, 0.36, 0],
        rotation: [0, 0, 90],
        dimensions: [0.68, 0.03, 0.68],
        modifiers: {
          ...DEFAULT_PART_MODIFIERS,
          bevel: 0.01,
        },
        material: {
          color: '#FFFFFF',
          roughness: 0.84,
          metalness: 0,
          proceduralSurface: 'logRings',
        },
      },
      {
        id: 'fallen_log_nub_1',
        name: 'Broken Branch Nub A',
        shape: 'cylinder',
        position: [0.42, 0.68, -0.18],
        rotation: [-32, 18, -22],
        dimensions: [0.16, 0.28, 0.16],
        modifiers: {
          ...DEFAULT_PART_MODIFIERS,
          bevel: 0.03,
          roundness: 0.06,
        },
        material: {
          color: '#FFFFFF',
          roughness: 0.9,
          metalness: 0,
          proceduralSurface: 'logBark',
        },
      },
      {
        id: 'fallen_log_nub_1_rings',
        name: 'Nub Tip Rings A',
        shape: 'cylinder',
        position: [0.48, 0.79, -0.25],
        rotation: [-32, 18, -22],
        dimensions: [0.11, 0.025, 0.11],
        modifiers: {
          ...DEFAULT_PART_MODIFIERS,
          bevel: 0.01,
        },
        material: {
          color: '#FFFFFF',
          roughness: 0.84,
          metalness: 0,
          proceduralSurface: 'logRings',
        },
      },
      {
        id: 'fallen_log_nub_2',
        name: 'Broken Branch Nub B',
        shape: 'cylinder',
        position: [-0.55, 0.52, 0.32],
        rotation: [58, -14, 16],
        dimensions: [0.13, 0.22, 0.13],
        modifiers: {
          ...DEFAULT_PART_MODIFIERS,
          bevel: 0.03,
          roundness: 0.06,
        },
        material: {
          color: '#FFFFFF',
          roughness: 0.9,
          metalness: 0,
          proceduralSurface: 'logBark',
        },
      },
    ],
  };
}
