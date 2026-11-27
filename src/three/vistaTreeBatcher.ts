import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type {
  SceneryTextureSlot,
  StylizedCanopyConfig,
  SurfaceTextureSettings,
  VisualStyleId,
} from '../types/maker';
import { applyBotwStyleToObject } from './botwStyleUtils';
import { buildSingleCanopyTreeGroup } from './canopyClusterBuilder';

export interface VistaTreePlacement {
  x: number;
  y: number;
  z: number;
  s: number;
  rot: number;
}

interface VistaBucket {
  isFoliage: boolean;
  mapTex: THREE.Texture | null;
  alphaTest: number;
  side: THREE.Side;
  roughness: number;
  metalness: number;
  geos: THREE.BufferGeometry[];
}

const STATIC_ZERO_TIME = { value: 0 };
const WHITE_COLOR = new THREE.Color('#FFFFFF');

function bakeSinglePrimitiveGeometry(
  rawNonIndexedGeo: THREE.BufferGeometry,
  worldMatrix: THREE.Matrix4,
  matColor: THREE.Color,
  useGeoVertexColors: boolean,
  instanceColor: THREE.Color | null,
  hsvShift: THREE.Vector3 | null
): THREE.BufferGeometry | null {
  const posAttr = rawNonIndexedGeo.attributes.position as THREE.BufferAttribute | undefined;
  if (!posAttr || posAttr.count === 0) return null;

  const baked = new THREE.BufferGeometry();
  const posCopy = posAttr.clone();
  baked.setAttribute('position', posCopy);

  if (rawNonIndexedGeo.attributes.normal) {
    baked.setAttribute('normal', (rawNonIndexedGeo.attributes.normal as THREE.BufferAttribute).clone());
  }

  baked.applyMatrix4(worldMatrix);
  if (!baked.attributes.normal) {
    baked.computeVertexNormals();
  }

  const vCount = posCopy.count;
  const srcUv = rawNonIndexedGeo.attributes.uv as THREE.BufferAttribute | undefined;
  if (srcUv && srcUv.count === vCount) {
    baked.setAttribute('uv', srcUv.clone());
  } else {
    baked.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(vCount * 2), 2));
  }

  const srcCol = useGeoVertexColors
    ? (rawNonIndexedGeo.attributes.color as THREE.BufferAttribute | undefined)
    : undefined;
  const hasHsv = Boolean(
    hsvShift &&
      (Math.abs(hsvShift.x) > 1e-4 || Math.abs(hsvShift.y) > 1e-4 || Math.abs(hsvShift.z) > 1e-4)
  );
  const cols = new Float32Array(vCount * 3);
  const tmpCol = new THREE.Color();

  for (let v = 0; v < vCount; v++) {
    tmpCol.copy(matColor);
    if (srcCol && v < srcCol.count) {
      tmpCol.r *= srcCol.getX(v);
      tmpCol.g *= srcCol.getY(v);
      tmpCol.b *= srcCol.getZ(v);
    }
    if (instanceColor) {
      tmpCol.multiply(instanceColor);
    }
    if (hasHsv && hsvShift) {
      tmpCol.offsetHSL(hsvShift.x, hsvShift.y, hsvShift.z);
    }
    cols[v * 3] = THREE.MathUtils.clamp(tmpCol.r, 0, 1.25);
    cols[v * 3 + 1] = THREE.MathUtils.clamp(tmpCol.g, 0, 1.25);
    cols[v * 3 + 2] = THREE.MathUtils.clamp(tmpCol.b, 0, 1.25);
  }
  baked.setAttribute('color', new THREE.BufferAttribute(cols, 3));

  return baked;
}

function disposeArchetypeOnly(root: THREE.Object3D): void {
  const seenGeos = new Set<THREE.BufferGeometry>();
  const seenMats = new Set<THREE.Material>();

  root.traverse((obj) => {
    if ((obj as THREE.InstancedMesh).isInstancedMesh) {
      (obj as THREE.InstancedMesh).dispose?.();
    }
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (mesh.geometry && !seenGeos.has(mesh.geometry)) {
      seenGeos.add(mesh.geometry);
      mesh.geometry.dispose();
    }
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (m && !seenMats.has(m)) {
        seenMats.add(m);
        m.dispose();
      }
    }
  });
}

/**
 * Bakes 1 stylized/EZ-Tree archetype matching the user's configured tree style into
 * low-draw-call `THREE.InstancedMesh` buckets for crisp, fast 360° horizon panoramas.
 */
export function buildVistaTreeSpeciesInstancedGroup(opts: {
  config: StylizedCanopyConfig;
  speciesKey: string;
  style: VisualStyleId;
  placements: VistaTreePlacement[];
  treeScaleMultiplier?: number;
  fallbackBaseColor?: string;
  sceneryTextures?: Partial<Record<SceneryTextureSlot, SurfaceTextureSettings>>;
}): THREE.Group {
  const resultGroup = new THREE.Group();
  const {
    config,
    speciesKey,
    style,
    placements,
    treeScaleMultiplier = 1,
    fallbackBaseColor,
    sceneryTextures,
  } = opts;

  if (placements.length === 0) return resultGroup;

  const vistaCfg: StylizedCanopyConfig = {
    ...config,
    canopyLeafCount:
      typeof config.canopyLeafCount === 'number'
        ? Math.min(config.canopyLeafCount, 110)
        : 110,
    windSway: 0,
  };

  const archetype = buildSingleCanopyTreeGroup(
    vistaCfg,
    `vista_arch_${speciesKey}`,
    style,
    STATIC_ZERO_TIME,
    fallbackBaseColor,
    {
      sceneryTextures,
      detail: 'forest',
    }
  );
  archetype.updateMatrixWorld(true);

  const buckets = new Map<string, VistaBucket>();
  const instLocalMat = new THREE.Matrix4();
  const combinedMat = new THREE.Matrix4();
  const instColTmp = new THREE.Color();

  archetype.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry || !mesh.material) return;

    const srcMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (!srcMat) return;

    const stdMat = srcMat as THREE.MeshStandardMaterial;
    const isInst = Boolean((mesh as THREE.InstancedMesh).isInstancedMesh);
    const mapTex = stdMat.map ?? null;
    const alphaTest =
      typeof stdMat.alphaTest === 'number' && stdMat.alphaTest > 0
        ? THREE.MathUtils.clamp(stdMat.alphaTest, 0.05, 0.9)
        : 0;
    const side = stdMat.side ?? THREE.FrontSide;
    const roughness =
      typeof stdMat.roughness === 'number'
        ? THREE.MathUtils.clamp(stdMat.roughness, 0.55, 0.96)
        : 0.86;
    const metalness =
      typeof stdMat.metalness === 'number'
        ? THREE.MathUtils.clamp(stdMat.metalness, 0, 0.25)
        : 0;
    const isFoliage =
      isInst ||
      mesh.userData?.paintPart === 'leaves' ||
      Boolean(srcMat.userData?._vpBakedVertexColors) ||
      Boolean(srcMat.userData?.uHsvShift) ||
      alphaTest > 0;

    const useGeoVertexColors =
      Boolean(mesh.geometry.attributes.color) &&
      (Boolean(stdMat.vertexColors) || Boolean(srcMat.userData?._vpBakedVertexColors));
    const matColor = stdMat.color ? stdMat.color : WHITE_COLOR;
    const hsvShift =
      srcMat.userData?.uHsvShift instanceof THREE.Vector3 ? srcMat.userData.uHsvShift : null;

    const key = `${isFoliage ? 'F' : 'B'}|${mapTex?.uuid ?? 'nomap'}|${alphaTest.toFixed(2)}|${
      side === THREE.DoubleSide ? '2' : '1'
    }|${roughness.toFixed(2)}|${metalness.toFixed(2)}`;

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        isFoliage,
        mapTex,
        alphaTest,
        side,
        roughness,
        metalness,
        geos: [],
      };
      buckets.set(key, bucket);
    }

    const nonIdx = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;

    if (isInst) {
      const instMesh = mesh as THREE.InstancedMesh;
      const count = instMesh.count;
      const hasInstCol = Boolean(instMesh.instanceColor);
      for (let i = 0; i < count; i++) {
        instMesh.getMatrixAt(i, instLocalMat);
        combinedMat.multiplyMatrices(mesh.matrixWorld, instLocalMat);
        if (hasInstCol) {
          instMesh.getColorAt(i, instColTmp);
        }
        const baked = bakeSinglePrimitiveGeometry(
          nonIdx,
          combinedMat,
          matColor,
          useGeoVertexColors,
          hasInstCol ? instColTmp : null,
          hsvShift
        );
        if (baked) bucket.geos.push(baked);
      }
    } else {
      const baked = bakeSinglePrimitiveGeometry(
        nonIdx,
        mesh.matrixWorld,
        matColor,
        useGeoVertexColors,
        null,
        hsvShift
      );
      if (baked) bucket.geos.push(baked);
    }

    if (nonIdx !== mesh.geometry) {
      nonIdx.dispose();
    }
  });

  disposeArchetypeOnly(archetype);

  const dummy = new THREE.Object3D();
  const instTint = new THREE.Color();
  const botwCache = new Map<THREE.Material, THREE.Material>();

  // Split placements: mid-ground full 3D vista instances vs. far-horizon lightweight star cross-card impostors
  const IMPOSTOR_DIST_SQ = 148 * 148;
  const nearPlacements: VistaTreePlacement[] = [];
  const farPlacements: VistaTreePlacement[] = [];
  for (let i = 0; i < placements.length; i++) {
    const p = placements[i];
    if (p.x * p.x + p.z * p.z > IMPOSTOR_DIST_SQ) {
      farPlacements.push(p);
    } else {
      nearPlacements.push(p);
    }
  }

  // Track representative foliage & bark aesthetics for building a matching far-horizon impostor archetype
  let repFoliageMap: THREE.Texture | null = null;
  let repFoliageAlphaTest = 0;
  let repTreeHeight = 5.4;
  let repCanopyRadius = 2.15;
  let repCanopyColor = new THREE.Color('#4A7C3F');

  for (const bucket of buckets.values()) {
    if (bucket.geos.length === 0) continue;
    const merged = mergeGeometries(bucket.geos, false);
    for (const g of bucket.geos) g.dispose();
    bucket.geos.length = 0;
    if (!merged) continue;

    merged.computeBoundingBox();
    merged.computeBoundingSphere();

    if (bucket.isFoliage && merged.boundingBox) {
      const bb = merged.boundingBox;
      repTreeHeight = Math.max(3.2, bb.max.y);
      repCanopyRadius = Math.max(1.2, Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) * 0.5);
      if (bucket.mapTex) {
        repFoliageMap = bucket.mapTex;
        repFoliageAlphaTest = bucket.alphaTest;
      }
      const colAttr = merged.attributes.color as THREE.BufferAttribute | undefined;
      if (colAttr && colAttr.count > 0) {
        const sampleStep = Math.max(1, Math.floor(colAttr.count / 24));
        let sr = 0;
        let sg = 0;
        let sb = 0;
        let sc = 0;
        for (let k = 0; k < colAttr.count; k += sampleStep) {
          sr += colAttr.getX(k);
          sg += colAttr.getY(k);
          sb += colAttr.getZ(k);
          sc++;
        }
        if (sc > 0) {
          repCanopyColor.setRGB(sr / sc, sg / sc, sb / sc);
        }
      }
    }

    if (nearPlacements.length === 0) {
      merged.dispose();
      continue;
    }

    const mat = new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      vertexColors: true,
      map: bucket.mapTex,
      alphaTest: bucket.alphaTest,
      transparent: false,
      side: bucket.side,
      roughness: bucket.roughness,
      metalness: bucket.metalness,
      envMapIntensity: bucket.isFoliage ? 0.34 : 0.45,
    });

    const instMesh = new THREE.InstancedMesh(merged, mat, nearPlacements.length);
    instMesh.castShadow = false;
    instMesh.receiveShadow = false;
    instMesh.frustumCulled = false;

    for (let i = 0; i < nearPlacements.length; i++) {
      const p = nearPlacements[i];
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, p.rot, 0);
      dummy.scale.setScalar(p.s * treeScaleMultiplier);
      dummy.updateMatrix();
      instMesh.setMatrixAt(i, dummy.matrix);

      if (bucket.isFoliage) {
        const shade = 0.91 + ((i * 7) % 5) * 0.04;
        const warmBias = ((i % 3) - 1) * 0.025;
        instTint.setRGB(
          THREE.MathUtils.clamp(shade + warmBias, 0.78, 1.12),
          THREE.MathUtils.clamp(shade, 0.78, 1.12),
          THREE.MathUtils.clamp(shade - warmBias * 0.6, 0.78, 1.12)
        );
      } else {
        const barkShade = 0.92 + (i % 4) * 0.035;
        instTint.setRGB(barkShade, barkShade, barkShade);
      }
      instMesh.setColorAt(i, instTint);
    }

    instMesh.instanceMatrix.needsUpdate = true;
    if (instMesh.instanceColor) instMesh.instanceColor.needsUpdate = true;

    applyBotwStyleToObject(
      instMesh,
      style,
      {
        isFoliage: bucket.isFoliage,
        rimStrengthScale: 0.78,
        shadowLiftScale: 0.85,
      },
      botwCache
    );

    resultGroup.add(instMesh);
  }

  // Far-horizon ultra-lightweight 3-plane star cross-card impostor forest (~12 tris per tree, radially lit normals)
  if (farPlacements.length > 0) {
    const canopyCenterY = repTreeHeight * 0.64;
    const crownH = repTreeHeight * 0.68;
    const crownW = repCanopyRadius * 1.95;
    const cardPlanes: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 3; k++) {
      const plane = new THREE.PlaneGeometry(crownW, crownH, 1, 1);
      plane.rotateY((k * Math.PI) / 3);
      plane.translate(0, canopyCenterY, 0);
      // Point normals radially outward from canopy center for soft lush tree volume (no flat card lighting seams)
      const pos = plane.attributes.position as THREE.BufferAttribute;
      const nrm = plane.attributes.normal as THREE.BufferAttribute;
      const vCols = new Float32Array(pos.count * 3);
      for (let v = 0; v < pos.count; v++) {
        const vx = pos.getX(v);
        const vy = pos.getY(v) - canopyCenterY;
        const vz = pos.getZ(v);
        const len = Math.max(0.01, Math.hypot(vx, vy * 1.15 + crownH * 0.25, vz));
        nrm.setXYZ(v, vx / len, (vy * 1.15 + crownH * 0.25) / len, vz / len);
        const topShade = vy > 0 ? 1.06 : 0.72;
        vCols[v * 3] = repCanopyColor.r * topShade;
        vCols[v * 3 + 1] = repCanopyColor.g * topShade;
        vCols[v * 3 + 2] = repCanopyColor.b * topShade;
      }
      plane.setAttribute('color', new THREE.BufferAttribute(vCols, 3));
      const nonIdxCard = plane.index ? plane.toNonIndexed() : plane;
      if (nonIdxCard !== plane) plane.dispose();
      cardPlanes.push(nonIdxCard);
    }

    const impostorGeo = mergeGeometries(cardPlanes, false);
    for (const p of cardPlanes) p.dispose();
    if (impostorGeo) {
      impostorGeo.computeBoundingSphere();
      const impostorMat = new THREE.MeshStandardMaterial({
        color: '#FFFFFF',
        vertexColors: true,
        map: repFoliageMap,
        alphaTest: repFoliageMap ? Math.max(0.32, repFoliageAlphaTest) : 0,
        transparent: false,
        side: THREE.DoubleSide,
        roughness: 0.9,
        metalness: 0,
        envMapIntensity: 0.3,
      });
      const impostorInst = new THREE.InstancedMesh(impostorGeo, impostorMat, farPlacements.length);
      impostorInst.castShadow = false;
      impostorInst.receiveShadow = false;
      impostorInst.frustumCulled = false;

      for (let i = 0; i < farPlacements.length; i++) {
        const p = farPlacements[i];
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(0, p.rot, 0);
        dummy.scale.setScalar(p.s * treeScaleMultiplier);
        dummy.updateMatrix();
        impostorInst.setMatrixAt(i, dummy.matrix);

        const shade = 0.88 + ((i * 5) % 5) * 0.045;
        instTint.setRGB(shade, shade, shade);
        impostorInst.setColorAt(i, instTint);
      }
      impostorInst.instanceMatrix.needsUpdate = true;
      if (impostorInst.instanceColor) impostorInst.instanceColor.needsUpdate = true;

      applyBotwStyleToObject(
        impostorInst,
        style,
        {
          isFoliage: true,
          rimStrengthScale: 0.65,
          shadowLiftScale: 0.9,
        },
        botwCache
      );
      resultGroup.add(impostorInst);
    }
  }

  return resultGroup;
}
