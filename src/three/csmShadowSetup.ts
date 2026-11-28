import * as THREE from 'three';
import { CSMShadowNode } from 'three/addons/csm/CSMShadowNode.js';
import { CSMFrustum } from 'three/addons/csm/CSMFrustum.js';
import type { TerrainQualityTier } from '../types/maker';
import { isIOSDevice } from './webglUtils';

export interface CsmShadowHandle {
  node: CSMShadowNode;
  updateFrustums: () => void;
  setQualityTier: (tier: TerrainQualityTier) => void;
  markDirty: (allCascades?: boolean) => void;
  dispose: () => void;
}

type ShadowWithNode = THREE.DirectionalLightShadow & {
  shadowNode?: CSMShadowNode;
};

// Reusable zero-GC scratch math objects for cascade frustum fitting
const _lightDir = new THREE.Vector3();
const _lightOriMat = new THREE.Matrix4();
const _lightOriMatInv = new THREE.Matrix4();
const _camToLightMat = new THREE.Matrix4();
const _lightSpaceFrustum = new CSMFrustum();
const _bbox = new THREE.Box3();
const _center = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

/**
 * Attaches Three.js r187 WebGPU/TSL Cascaded Shadow Maps (`CSMShadowNode`) to the primary
 * sun DirectionalLight with smart per-cascade caching:
 * - Static scenes skip redundant shadow passes completely (0 shadow renders/frame)
 * - Cascade 0 (near hero/camera) updates at most every 2nd frame while moving (~30Hz)
 * - Cascade 1+ (distant landscape) updates only when camera moves > 2.2m, rotates > 10°,
 *   sun direction shifts, or on explicit `markDirty(true)`
 * - Cascade light matrices stay locked to the exact shadow map rendered for them (zero swimming).
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
    const cascades = options?.cascades ?? 2;
    const maxFar = options?.maxFar ?? 165;
    const lightMargin = options?.lightMargin ?? 75;
    const mapSize = options?.mapSize ?? 768;

    sunLight.shadow.mapSize.set(mapSize, mapSize);
    sunLight.shadow.bias = -0.00035;
    sunLight.shadow.normalBias = 0.025;
    // Clone cascades with autoUpdate = false so each cascade only re-renders when flagged dirty
    sunLight.shadow.autoUpdate = false;
    sunLight.shadow.needsUpdate = true;

    const csm = new CSMShadowNode(sunLight, {
      cascades,
      maxFar,
      mode: 'practical',
      lightMargin,
    });
    csm.fade = true;

    // Per-cascade cache tracking state
    let frameCounter = 0;
    let forceDirtyAll = true;
    let dynamicNearDirty = false;
    const lastSunDir = new THREE.Vector3(NaN, NaN, NaN);
    const cascadeInitialized = new Array<boolean>(cascades).fill(false);
    const cascadeLastFrame = new Array<number>(cascades).fill(-999);
    const cascadeLastCamPos = Array.from({ length: cascades }, () => new THREE.Vector3(NaN, NaN, NaN));
    const cascadeLastCamQuat = Array.from({ length: cascades }, () => new THREE.Quaternion(0, 0, 0, 1));

    csm.updateBefore = function throttledUpdateBefore() {
      const light = this.light as THREE.DirectionalLight;
      const parent = light.parent;
      const camera = this.camera;
      const frustums = this.frustums;
      if (!parent || !camera || frustums.length === 0) return;

      frameCounter++;

      // Attach cascade proxy lights to the scene graph and keep autoUpdate disabled
      for (let i = 0; i < this.lights.length; i++) {
        const lwLight = this.lights[i];
        if (lwLight.shadow?.autoUpdate) {
          lwLight.shadow.autoUpdate = false;
        }
        if (lwLight.parent === null) {
          parent.add(lwLight.target);
          parent.add(lwLight);
        }
      }

      if (light.shadow.needsUpdate) {
        forceDirtyAll = true;
        light.shadow.needsUpdate = false;
      }

      _lightDir.subVectors(light.target.position, light.position).normalize();
      const sunMoved =
        Number.isNaN(lastSunDir.x) || _lightDir.distanceToSquared(lastSunDir) > 1e-6;
      if (sunMoved) {
        lastSunDir.copy(_lightDir);
        forceDirtyAll = true;
      }

      const camPos = camera.position;
      const camQuat = camera.quaternion;
      let anyUpdated = false;
      let lightMatricesComputed = false;

      for (let i = 0; i < frustums.length; i++) {
        const lwLight = this.lights[i];
        const shadow = lwLight.shadow;
        if (!shadow) continue;
        const init = cascadeInitialized[i];
        const framesSince = frameCounter - cascadeLastFrame[i];
        const posDeltaSq = init ? camPos.distanceToSquared(cascadeLastCamPos[i]) : Infinity;
        const quatDot = init ? Math.abs(camQuat.dot(cascadeLastCamQuat[i])) : 0;

        let shouldUpdate = !init || forceDirtyAll || shadow.needsUpdate;
        if (!shouldUpdate) {
          if (i === 0) {
            // Near cascade: update when camera moved or dynamic actor flagged dirty, max 30Hz (every 2nd frame)
            const camChanged0 = posDeltaSq > 0.04 || quatDot < 0.9994;
            if ((camChanged0 || dynamicNearDirty) && framesSince >= 2) {
              shouldUpdate = true;
            }
          } else {
            // Far cascade(s): update only on larger camera travel (>2.2m) or rotation (>10°), max every 8th frame
            const camChangedFar = posDeltaSq > 4.84 || quatDot < 0.996;
            if (camChangedFar && framesSince >= 8) {
              shouldUpdate = true;
            }
          }
        }

        if (!shouldUpdate) continue;

        if (!lightMatricesComputed) {
          _lightOriMat.lookAt(light.position, light.target.position, _up);
          _lightOriMatInv.copy(_lightOriMat).invert();
          _camToLightMat.multiplyMatrices(_lightOriMatInv, camera.matrixWorld);
          lightMatricesComputed = true;
        }

        const shadowCam = shadow.camera;
        const texelWidth = (shadowCam.right - shadowCam.left) / shadow.mapSize.width;
        const texelHeight = (shadowCam.top - shadowCam.bottom) / shadow.mapSize.height;

        frustums[i].toSpace(_camToLightMat, _lightSpaceFrustum);
        const nearVerts = _lightSpaceFrustum.vertices.near;
        const farVerts = _lightSpaceFrustum.vertices.far;

        _bbox.makeEmpty();
        for (let j = 0; j < 4; j++) {
          _bbox.expandByPoint(nearVerts[j]);
          _bbox.expandByPoint(farVerts[j]);
        }

        _bbox.getCenter(_center);
        _center.z = _bbox.max.z + this.lightMargin;
        _center.x = Math.floor(_center.x / texelWidth) * texelWidth;
        _center.y = Math.floor(_center.y / texelHeight) * texelHeight;
        _center.applyMatrix4(_lightOriMat);

        lwLight.position.copy(_center);
        lwLight.target.position.copy(_center);
        lwLight.target.position.add(_lightDir);
        lwLight.updateMatrixWorld();
        lwLight.target.updateMatrixWorld();

        shadow.needsUpdate = true;
        cascadeInitialized[i] = true;
        cascadeLastFrame[i] = frameCounter;
        cascadeLastCamPos[i].copy(camPos);
        cascadeLastCamQuat[i].copy(camQuat);
        if (i === 0) dynamicNearDirty = false;
        anyUpdated = true;
      }

      if (anyUpdated && forceDirtyAll) {
        forceDirtyAll = false;
      }
    };

    (sunLight.shadow as ShadowWithNode).shadowNode = csm;

    const markDirty = (allCascades = false) => {
      if (allCascades) {
        forceDirtyAll = true;
      } else {
        dynamicNearDirty = true;
      }
    };

    const updateFrustums = () => {
      forceDirtyAll = true;
      if (csm.camera) {
        try {
          csm.updateFrustums();
        } catch {
          // Ignore before first render initialization
        }
      }
    };

    const setQualityTier = (tier: TerrainQualityTier) => {
      const targetFar = tier === 'performance' ? 125 : tier === 'ultra' ? 210 : 155;
      const targetSize = tier === 'performance' ? 512 : tier === 'ultra' ? 1024 : 768;
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
        forceDirtyAll = true;
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

    return { node: csm, updateFrustums, setQualityTier, markDirty, dispose };
  } catch (err) {
    console.warn('CSMShadowNode init skipped; falling back to standard directional shadow:', err);
    return null;
  }
}
