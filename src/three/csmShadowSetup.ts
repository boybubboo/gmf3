import * as THREE from 'three';
import { CSMShadowNode } from 'three/addons/csm/CSMShadowNode.js';
import type { TerrainQualityTier } from '../types/maker';
import { isIOSDevice } from './webglUtils';

export interface CsmShadowHandle {
  node: CSMShadowNode;
  updateFrustums: () => void;
  setQualityTier: (tier: TerrainQualityTier) => void;
  dispose: () => void;
}

type ShadowWithNode = THREE.DirectionalLightShadow & {
  shadowNode?: CSMShadowNode;
};

/**
 * Attaches Three.js r187 WebGPU/TSL Cascaded Shadow Maps (`CSMShadowNode`) to the primary
 * sun DirectionalLight. Gives razor-sharp close-up shadows near the hero/camera while
 * covering sweeping open-world mountain & forest shadows across the island.
 *
 * Safely returns `null` on software WebGL or iOS (preserving single shadow-map fallback).
 */
export function attachSunCSM(
  sunLight: THREE.DirectionalLight,
  options?: {
    isSoftwareGl?: boolean;
    cascades?: number;
    maxFar?: number;
    lightMargin?: number;
    mapSize?: number;
  }
): CsmShadowHandle | null {
  if (options?.isSoftwareGl || isIOSDevice() || !sunLight.castShadow) {
    return null;
  }

  try {
    const cascades = options?.cascades ?? 3;
    const maxFar = options?.maxFar ?? 210;
    const lightMargin = options?.lightMargin ?? 85;
    const mapSize = options?.mapSize ?? 1024;

    sunLight.shadow.mapSize.set(mapSize, mapSize);
    sunLight.shadow.bias = -0.00035;
    sunLight.shadow.normalBias = 0.025;
    // CSM repositions cascades every frame to follow the camera frustum with texel snapping
    sunLight.shadow.autoUpdate = true;
    sunLight.shadow.needsUpdate = true;

    const csm = new CSMShadowNode(sunLight, {
      cascades,
      maxFar,
      mode: 'practical',
      lightMargin,
    });
    csm.fade = true;

    (sunLight.shadow as ShadowWithNode).shadowNode = csm;

    const updateFrustums = () => {
      if (csm.camera) {
        try {
          csm.updateFrustums();
        } catch {
          // Ignore before first render initialization
        }
      }
    };

    const setQualityTier = (tier: TerrainQualityTier) => {
      const targetFar = tier === 'performance' ? 145 : tier === 'ultra' ? 275 : 210;
      const targetSize = tier === 'performance' ? 768 : tier === 'ultra' ? 1536 : 1024;
      const changedFar = Math.abs(csm.maxFar - targetFar) > 1;
      csm.maxFar = targetFar;
      if (sunLight.shadow.mapSize.x !== targetSize) {
        sunLight.shadow.mapSize.set(targetSize, targetSize);
        for (const lw of csm.lights) {
          if (lw.shadow) {
            lw.shadow.mapSize.set(targetSize, targetSize);
            lw.shadow.map?.dispose();
            lw.shadow.map = null;
          }
        }
      }
      if (changedFar) {
        updateFrustums();
      }
    };

    const dispose = () => {
      try {
        const s = sunLight.shadow as ShadowWithNode;
        if (s.shadowNode === csm) {
          s.shadowNode = undefined;
        }
        for (const lw of csm.lights) {
          lw.shadow?.map?.dispose();
        }
        csm.dispose();
      } catch {
        // Safe teardown
      }
    };

    return { node: csm, updateFrustums, setQualityTier, dispose };
  } catch (err) {
    console.warn('CSMShadowNode init skipped; falling back to standard directional shadow:', err);
    return null;
  }
}
