import * as THREE from 'three';
import { MeshPhysicalNodeMaterial, type WebGPURenderer } from 'three/webgpu';
import { MeshletDrawingPipeline } from 'three/addons/pipelines/MeshletDrawingPipeline.js';
import { materialColor, materialDiffuseRoughness, vec3 } from 'three/tsl';
import {
  applyWeatheringUserData,
  buildWeatheringColorTsl,
  buildWeatheringRoughnessTsl,
  isRealNodeMaterialInstance,
} from './nodeMaterialUtils';

function hasMeshletOptIn(obj: THREE.Object3D | null): boolean {
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    if (cur.userData?.meshletEnabled === true) return true;
    cur = cur.parent;
  }
  return false;
}

/**
 * Opt-in WebGPU GPU-driven Meshlet drawing pipeline.
 * Regular objects, dynamic actors, foliage batches, and transparent props use the standard pipeline,
 * while creators can toggle heavy static meshes/landmarks into GPU meshlet culling + cluster LoD.
 */
export class OptInMeshletDrawingPipeline extends MeshletDrawingPipeline {
  constructor() {
    super({
      occlusionCulling: true,
      depthPrepass: false,
    });
  }

  _isMeshlet(
    object: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    group: unknown
  ): boolean {
    if (!hasMeshletOptIn(object)) return false;
    const baseIsMeshlet = (
      MeshletDrawingPipeline.prototype as unknown as {
        _isMeshlet: (
          o: THREE.Object3D,
          g: THREE.BufferGeometry,
          m: THREE.Material,
          gr: unknown
        ) => boolean;
      }
    )._isMeshlet;
    return baseIsMeshlet.call(this, object, geometry, material, group);
  }
}

export function createOptInMeshletPipeline(_renderer: WebGPURenderer): OptInMeshletDrawingPipeline {
  return new OptInMeshletDrawingPipeline();
}

/**
 * Converts a `NodeMaterialInstance` into an equivalent concrete `MeshPhysicalNodeMaterial`
 * when opted into Meshlet GPU culling (`MeshletDrawingPipeline.isSupportedMaterial` requires
 * `material.isNodeMaterial === true`, whereas `NodeMaterialInstance` has `type: 'NodeMaterialInstance'`).
 * Preserves live weathering & tint uniform references on `userData`.
 */
function materializeForMeshlet(mat: THREE.Material): THREE.Material {
  const std = mat as unknown as THREE.MeshPhysicalMaterial & {
    diffuseRoughness?: number;
    flatShading?: boolean;
  };
  if (isRealNodeMaterialInstance(mat) || !std.isMaterial) {
    const concrete = new MeshPhysicalNodeMaterial({
      color: std.color ? std.color.clone() : '#ffffff',
      map: std.map ?? null,
      normalMap: std.normalMap ?? null,
      bumpMap: std.bumpMap ?? null,
      bumpScale: std.bumpScale ?? 1,
      roughness: typeof std.roughness === 'number' ? std.roughness : 0.84,
      metalness: typeof std.metalness === 'number' ? std.metalness : 0.02,
      diffuseRoughness: typeof std.diffuseRoughness === 'number' ? std.diffuseRoughness : 0.82,
      side: THREE.FrontSide,
      transparent: false,
      vertexColors: false,
    });
    if (std.normalScale) concrete.normalScale.copy(std.normalScale);
    concrete.colorNode = buildWeatheringColorTsl(vec3(materialColor));
    concrete.roughnessNode = buildWeatheringRoughnessTsl();
    concrete.diffuseRoughnessNode = materialDiffuseRoughness;
    concrete.userData = { ...mat.userData, __variantWrapped: true };
    applyWeatheringUserData(concrete.userData);
    concrete.needsUpdate = true;
    return concrete;
  }

  // Classic opaque material: ensure Meshlet pipeline constraints (FrontSide, no flatShading, no vertexColors conflict)
  if ((mat as THREE.MeshStandardMaterial).flatShading) {
    (mat as THREE.MeshStandardMaterial).flatShading = false;
    mat.needsUpdate = true;
  }
  return mat;
}

/**
 * Marks a placed entity / landmark object tree for WebGPU Meshlet GPU culling.
 * Safely prepares geometry attributes (non-indexed flat normals if needed, bounding spheres) and
 * material compatibility on opaque front-side sub-meshes while gracefully leaving transparent or
 * multi-sided trim sub-meshes on the standard pipeline.
 */
export function prepareObjectForMeshletCulling(root: THREE.Object3D, enabled: boolean): void {
  root.userData.meshletEnabled = enabled;

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;

    if (!enabled) {
      mesh.userData.meshletEnabled = false;
      return;
    }

    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (!mat) {
      mesh.userData.meshletEnabled = false;
      return;
    }

    // MeshletDrawingPipeline strictly skips transparent, double-sided, or vertexColor materials
    if (mat.transparent || mat.side !== THREE.FrontSide || (mesh as THREE.SkinnedMesh).isSkinnedMesh) {
      mesh.userData.meshletEnabled = false;
      return;
    }

    if (mesh.geometry) {
      // Bake flat-shaded facet normals cleanly if flatShading was used, since Meshlet pipeline skips flatShading materials
      const stdMat = mat as THREE.MeshStandardMaterial;
      if (stdMat.flatShading && mesh.geometry.index) {
        mesh.geometry = mesh.geometry.toNonIndexed();
        mesh.geometry.computeVertexNormals();
      }
      if (!mesh.geometry.attributes.normal) {
        mesh.geometry.computeVertexNormals();
      }
      if (!mesh.geometry.boundingSphere) {
        mesh.geometry.computeBoundingSphere();
      }
    }

    if (!Array.isArray(mesh.material)) {
      if (isRealNodeMaterialInstance(mesh.material) || mesh.material.vertexColors) {
        const concrete = materializeForMeshlet(mesh.material);
        concrete.vertexColors = false;
        mesh.material = concrete;
      } else if ((mesh.material as THREE.MeshStandardMaterial).flatShading) {
        (mesh.material as THREE.MeshStandardMaterial).flatShading = false;
        mesh.material.needsUpdate = true;
      }
    }

    mesh.userData.meshletEnabled = true;
  });
}
