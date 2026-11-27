import * as THREE from 'three';
import {
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree,
} from 'three-mesh-bvh';

let bvhPatched = false;

type BvhGeometry = THREE.BufferGeometry & {
  boundsTree?: unknown;
};

/**
 * Patches Three.js BufferGeometry & Mesh prototypes once so any geometry with a
 * built `boundsTree` automatically gets O(log N) BVH-accelerated raycasting.
 * Meshes without a `boundsTree` transparently fall back to standard raycasting.
 */
export function initBvhAcceleration(): void {
  if (bvhPatched) return;
  bvhPatched = true;
  if (!THREE.BufferGeometry.prototype.computeBoundsTree) {
    THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
  }
  if (!THREE.BufferGeometry.prototype.disposeBoundsTree) {
    THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
  }
  THREE.Mesh.prototype.raycast = acceleratedRaycast;
}

/**
 * Builds a fast MeshBVH bounds tree on eligible static meshes inside `root`.
 * Skips skinned, instanced, batched, and low-poly meshes where brute-force is already instant.
 */
export function buildObjectBVH(
  root: THREE.Object3D | null | undefined,
  minTriangles = 180
): void {
  if (!root) return;
  initBvhAcceleration();

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) return;
    if ((mesh as THREE.InstancedMesh).isInstancedMesh) return;
    if ((mesh as THREE.BatchedMesh).isBatchedMesh) return;

    const geo = mesh.geometry as BvhGeometry | undefined;
    if (!geo || !geo.attributes?.position) return;

    const triCount = geo.index
      ? Math.floor(geo.index.count / 3)
      : Math.floor(geo.attributes.position.count / 3);
    if (triCount < minTriangles) return;

    if (typeof geo.computeBoundsTree === 'function' && !geo.boundsTree) {
      try {
        geo.computeBoundsTree();
      } catch {
        // Ignore exotic/non-indexed morph geometries
      }
    }
  });
}

/**
 * Rebuilds the BVH bounds tree on a single BufferGeometry after in-place vertex updates
 * (for example, after sculpting a terrain chunk or editing a cave mesh).
 */
export function rebuildGeometryBVH(
  geo: THREE.BufferGeometry | null | undefined,
  minTriangles = 180
): void {
  if (!geo || !geo.attributes?.position) return;
  initBvhAcceleration();
  const bvhGeo = geo as BvhGeometry;
  if (bvhGeo.boundsTree && typeof bvhGeo.disposeBoundsTree === 'function') {
    bvhGeo.disposeBoundsTree();
  }
  const triCount = geo.index
    ? Math.floor(geo.index.count / 3)
    : Math.floor(geo.attributes.position.count / 3);
  if (triCount < minTriangles) return;
  if (typeof bvhGeo.computeBoundsTree === 'function') {
    try {
      bvhGeo.computeBoundsTree();
    } catch {
      // Safe fallback
    }
  }
}

/**
 * Frees any MeshBVH bounds trees inside `root` to prevent retaining stale geometry references.
 */
export function disposeObjectBVH(root: THREE.Object3D | null | undefined): void {
  if (!root) return;
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geo = mesh.geometry as BvhGeometry | undefined;
    if (geo?.boundsTree && typeof geo.disposeBoundsTree === 'function') {
      geo.disposeBoundsTree();
    }
  });
}
