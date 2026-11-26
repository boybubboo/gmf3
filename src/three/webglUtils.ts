import * as THREE from 'three';
import {
  estimateBytesUsed,
  interleaveAttributes,
  mergeGeometries,
  mergeVertices,
} from 'three/addons/utils/BufferGeometryUtils.js';

export interface HardwareContextOptions {
  antialias?: boolean;
  alpha?: boolean;
  depth?: boolean;
  stencil?: boolean;
  isSoftwareGl?: boolean;
  preserveDrawingBuffer?: boolean;
}

export interface HardwareProbeResult {
  isSoftwareGl: boolean;
  hardwareWebGL2Supported: boolean;
  rendererString: string;
}

const SOFTWARE_RENDERER_RE = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i;

/**
 * Probes WebGL2 hardware acceleration using high-performance GPU preference,
 * freeing the temporary probe context immediately via WEBGL_lose_context.
 */
export function probeHardwareWebGL2(): HardwareProbeResult {
  if (typeof document === 'undefined') {
    return {
      isSoftwareGl: false,
      hardwareWebGL2Supported: true,
      rendererString: 'headless',
    };
  }
  try {
    const canvas = document.createElement('canvas');
    const hwOnlyGl = canvas.getContext('webgl2', {
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: true,
    }) as WebGL2RenderingContext | null;

    const gl =
      hwOnlyGl ||
      (canvas.getContext('webgl2', {
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: false,
      }) as WebGL2RenderingContext | null) ||
      (canvas.getContext('webgl', {
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: false,
      }) as WebGLRenderingContext | null);

    if (!gl) {
      return {
        isSoftwareGl: true,
        hardwareWebGL2Supported: false,
        rendererString: 'unavailable',
      };
    }

    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const rendererString = String(gl.getParameter(param) ?? '');
    const isSoftwareGl = SOFTWARE_RENDERER_RE.test(rendererString);
    const hardwareWebGL2Supported = Boolean(hwOnlyGl) && !isSoftwareGl;

    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return {
      isSoftwareGl,
      hardwareWebGL2Supported,
      rendererString,
    };
  } catch {
    return {
      isSoftwareGl: false,
      hardwareWebGL2Supported: false,
      rendererString: 'probe-error',
    };
  }
}

/**
 * Creates a hardware-accelerated WebGL2RenderingContext configured for high-performance
 * rendering and initializes Three.js WebGLUtils format/type conversion validation.
 */
export function createHardwareWebGL2Context(
  canvas: HTMLCanvasElement,
  opts: HardwareContextOptions = {}
): { gl: WebGL2RenderingContext | null; utils: THREE.WebGLUtils | null } {
  const {
    antialias = true,
    alpha = true,
    depth = true,
    stencil = false,
    isSoftwareGl = false,
    preserveDrawingBuffer = false,
  } = opts;

  const baseAttrs: WebGLContextAttributes = {
    antialias: !isSoftwareGl && antialias,
    alpha,
    depth,
    stencil,
    powerPreference: 'high-performance',
    desynchronized: false,
    preserveDrawingBuffer,
  };

  let gl: WebGL2RenderingContext | null = null;
  if (!isSoftwareGl) {
    gl = canvas.getContext('webgl2', {
      ...baseAttrs,
      failIfMajorPerformanceCaveat: true,
    }) as WebGL2RenderingContext | null;
  }
  if (!gl) {
    gl = canvas.getContext('webgl2', {
      ...baseAttrs,
      failIfMajorPerformanceCaveat: false,
    }) as WebGL2RenderingContext | null;
  }
  if (!gl) {
    return { gl: null, utils: null };
  }

  // Initialize Three.js WebGLUtils against the active WebGL2 context so format/type lookups
  // and compressed texture capability queries are ready immediately.
  const extCache = {
    get: (name: string) => gl.getExtension(name),
    has: (name: string) => Boolean(gl.getExtension(name)),
  };
  const utils = new THREE.WebGLUtils(
    gl,
    extCache as unknown as ConstructorParameters<typeof THREE.WebGLUtils>[1]
  );
  // Pre-validate common GPU buffer/texture constants used by scene assets & grass heightmaps
  utils.convert(THREE.UnsignedByteType);
  utils.convert(THREE.HalfFloatType);
  utils.convert(THREE.RGBAFormat);

  return { gl, utils };
}

/**
 * Checks if an initialized WebGPURenderer selected a software fallback adapter
 * despite hardware acceleration being desired.
 */
export function isWebGPUFallbackAdapter(renderer: { backend?: unknown }): boolean {
  const backend = renderer.backend as
    | {
        isWebGPUBackend?: boolean;
        device?: GPUDevice & { adapterInfo?: { isFallbackAdapter?: boolean } };
        adapter?: { info?: { isFallbackAdapter?: boolean }; isFallbackAdapter?: boolean };
      }
    | undefined;
  if (!backend?.isWebGPUBackend) return false;
  return Boolean(
    backend.adapter?.info?.isFallbackAdapter ||
      backend.adapter?.isFallbackAdapter ||
      backend.device?.adapterInfo?.isFallbackAdapter
  );
}

let cachedIsIOS: boolean | null = null;

/**
 * Returns true on iPhone/iPad/iPod (including iPadOS desktop-UA Safari).
 * Always returns false on desktop browsers so desktop rendering paths remain untouched.
 */
export function isIOSDevice(): boolean {
  if (cachedIsIOS !== null) return cachedIsIOS;
  if (typeof navigator === 'undefined') {
    cachedIsIOS = false;
    return false;
  }
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) {
    cachedIsIOS = true;
    return true;
  }
  // iPadOS 13+ reports Macintosh UA alongside multi-touch capability
  if (/Macintosh/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 1) {
    cachedIsIOS = true;
    return true;
  }
  cachedIsIOS = false;
  return false;
}

/**
 * Explicitly forces WebGL context loss and shrinks the backing canvas on iOS
 * so iOS Safari/WebKit releases GPU backing memory immediately on view transition.
 */
export function forceReleaseRendererContext(
  renderer: { getContext?: () => unknown; domElement?: HTMLCanvasElement } | null | undefined,
  preCapturedGl?: unknown
): void {
  try {
    const gl = (preCapturedGl ??
      (typeof renderer?.getContext === 'function' ? renderer.getContext() : null)) as Partial<
      WebGL2RenderingContext | WebGLRenderingContext
    > | null;
    if (gl && typeof gl.getExtension === 'function') {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    // ignore if context is already lost
  }
  try {
    const canvas = renderer?.domElement;
    if (canvas) {
      canvas.width = 1;
      canvas.height = 1;
    }
  } catch {
    // ignore canvas resize errors during teardown
  }
}

export interface OptimizeGeometryOptions {
  /** Weld duplicate vertices on unindexed static meshes when safe (reduces VRAM & vertex shader work). */
  weldUnindexed?: boolean;
  /** Interleave static Float32 attributes (`position`, `normal`, `uv`) into one cache-friendly buffer. */
  interleave?: boolean;
  /** Precompute boundingBox & boundingSphere once to avoid lazy frame-time spikes. */
  computeBounds?: boolean;
}

/**
 * Optimizes a `THREE.BufferGeometry` for fast GPU upload and rendering:
 * - Optionally welds duplicate vertices into compact indexed buffers
 * - Optionally interleaves static float attributes via `BufferGeometryUtils.interleaveAttributes`
 * - Marks all attributes `StaticDrawUsage`
 * - Precomputes `boundingBox` and `boundingSphere`
 */
export function optimizeGeometryBuffers(
  geometry: THREE.BufferGeometry,
  opts: OptimizeGeometryOptions = {}
): THREE.BufferGeometry {
  const { weldUnindexed = false, interleave = false, computeBounds = true } = opts;

  let target = geometry;
  const posAttr = target.attributes.position;
  if (!posAttr || posAttr.count === 0) return target;

  const hasMorphs = Object.keys(target.morphAttributes || {}).length > 0;
  const hasSkin = Boolean(target.attributes.skinIndex || target.attributes.skinWeight);

  if (weldUnindexed && !target.index && !hasMorphs && !hasSkin && posAttr.count > 24 && posAttr.count <= 120_000) {
    try {
      const welded = mergeVertices(target, 1e-4);
      if (welded && welded.attributes.position && welded.attributes.position.count < posAttr.count * 0.92) {
        target.dispose();
        target = welded;
      } else if (welded && welded !== target) {
        welded.dispose();
      }
    } catch {
      // Keep original geometry if attribute layout doesn't support welding
    }
  }

  if (interleave && !hasMorphs && !hasSkin) {
    const attrKeys = Object.keys(target.attributes);
    const canInterleave =
      attrKeys.length >= 2 &&
      attrKeys.every((k) => {
        const attr = target.attributes[k];
        return (
          (k === 'position' || k === 'normal' || k === 'uv') &&
          !(attr as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute &&
          (attr as THREE.BufferAttribute).array instanceof Float32Array
        );
      });

    if (canInterleave) {
      try {
        const orderedNames = attrKeys.filter((k) => k === 'position' || k === 'normal' || k === 'uv');
        const sourceAttrs = orderedNames.map((k) => target.attributes[k] as THREE.BufferAttribute);
        const interleaved = interleaveAttributes(sourceAttrs) as unknown as
          | THREE.InterleavedBufferAttribute[]
          | null;
        if (Array.isArray(interleaved) && interleaved.length === orderedNames.length) {
          for (let i = 0; i < orderedNames.length; i++) {
            interleaved[i].data.setUsage(THREE.StaticDrawUsage);
            target.setAttribute(orderedNames[i], interleaved[i]);
          }
        }
      } catch {
        // Fallback cleanly to non-interleaved attributes
      }
    }
  }

  for (const name of Object.keys(target.attributes)) {
    const attr = target.attributes[name];
    if ((attr as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute) {
      (attr as THREE.InterleavedBufferAttribute).data.setUsage(THREE.StaticDrawUsage);
    } else if (typeof (attr as THREE.BufferAttribute).setUsage === 'function') {
      (attr as THREE.BufferAttribute).setUsage(THREE.StaticDrawUsage);
    }
  }

  if (computeBounds) {
    if (!target.boundingBox) target.computeBoundingBox();
    if (!target.boundingSphere) target.computeBoundingSphere();
  }

  return target;
}

/**
 * Safely merges multiple compatible geometries via `BufferGeometryUtils.mergeGeometries`,
 * immediately disposes all intermediate source geometries, and applies buffer optimization.
 */
export function mergeAndOptimizeGeometries(
  parts: THREE.BufferGeometry[],
  opts: OptimizeGeometryOptions & {
    computeNormals?: boolean;
    disposeInputs?: boolean;
  } = {}
): THREE.BufferGeometry | null {
  if (parts.length === 0) return null;
  const { computeNormals = false, disposeInputs = true, ...optCfg } = opts;

  if (parts.length === 1) {
    const single = parts[0];
    if (computeNormals && !single.attributes.normal) {
      single.computeVertexNormals();
    }
    return optimizeGeometryBuffers(single, optCfg);
  }

  const merged = mergeGeometries(parts, false);
  if (disposeInputs) {
    for (let i = 0; i < parts.length; i++) {
      parts[i].dispose();
    }
  }
  if (!merged) return null;

  if (computeNormals) {
    merged.computeVertexNormals();
  }
  return optimizeGeometryBuffers(merged, optCfg);
}

/**
 * Optimizes all static mesh buffers across an `Object3D` hierarchy once at asset prep time,
 * deduplicating shared geometries and skipping `SkinnedMesh` / `InstancedMesh` / `BatchedMesh`
 * attributes that must remain untouched for runtime animation or batching.
 */
export function optimizeObjectBuffers(
  root: THREE.Object3D,
  opts: OptimizeGeometryOptions = {}
): { meshesVisited: number; totalBufferBytes: number } {
  const seen = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
  let meshesVisited = 0;
  let totalBufferBytes = 0;

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh & {
      isSkinnedMesh?: boolean;
      isInstancedMesh?: boolean;
      isBatchedMesh?: boolean;
    };
    if (!mesh.isMesh || !mesh.geometry) return;
    meshesVisited++;

    const cached = seen.get(mesh.geometry);
    if (cached) {
      mesh.geometry = cached;
      return;
    }

    const original = mesh.geometry;
    const isDynamicSpecial = Boolean(
      mesh.isSkinnedMesh || mesh.isInstancedMesh || mesh.isBatchedMesh
    );

    const optimized = optimizeGeometryBuffers(original, {
      weldUnindexed: !isDynamicSpecial && Boolean(opts.weldUnindexed),
      interleave: !isDynamicSpecial && Boolean(opts.interleave),
      computeBounds: opts.computeBounds ?? true,
    });
    seen.set(original, optimized);
    seen.set(optimized, optimized);
    mesh.geometry = optimized;

    try {
      totalBufferBytes += estimateBytesUsed(optimized);
    } catch {
      // ignore if custom attribute doesn't implement byte estimation
    }
  });

  return { meshesVisited, totalBufferBytes };
}

let knownWebGPUMaxTextureArrayLayers: number | null = null;

/**
 * Updates the lowest observed active WebGPU device `maxTextureArrayLayers` limit.
 */
export function recordWebGPUMaxTextureArrayLayers(limit: number): void {
  if (typeof limit !== 'number' || !Number.isFinite(limit) || limit <= 0) return;
  knownWebGPUMaxTextureArrayLayers =
    knownWebGPUMaxTextureArrayLayers === null
      ? limit
      : Math.min(knownWebGPUMaxTextureArrayLayers, limit);
}

/**
 * Returns the observed active WebGPU `maxTextureArrayLayers` limit (or null if not yet initialized).
 */
export function getKnownWebGPUMaxTextureArrayLayers(): number | null {
  return knownWebGPUMaxTextureArrayLayers;
}

/**
 * Returns the active GPU device's maximum supported 2D texture array layers
 * (`maxTextureArrayLayers` on WebGPU, `MAX_ARRAY_TEXTURE_LAYERS` on WebGL2).
 */
export function getRendererMaxTextureArrayLayers(
  renderer?: { backend?: unknown; getContext?: () => unknown } | null
): number {
  const backend = renderer?.backend as
    | {
        isWebGPUBackend?: boolean;
        device?: GPUDevice;
      }
    | undefined;
  if (backend?.isWebGPUBackend) {
    const limit = backend.device?.limits?.maxTextureArrayLayers;
    return typeof limit === 'number' && limit > 0 ? limit : 256;
  }
  try {
    const gl = (
      typeof renderer?.getContext === 'function' ? renderer.getContext() : null
    ) as WebGL2RenderingContext | null;
    if (gl && typeof gl.getParameter === 'function' && 'MAX_ARRAY_TEXTURE_LAYERS' in gl) {
      const val = Number(gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS));
      if (Number.isFinite(val) && val > 0) return val;
    }
  } catch {
    // ignore context query errors
  }
  return 2048;
}

function measureMorphAttributePeakDelta(
  morphAttr: THREE.BufferAttribute,
  baseAttr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined,
  isRelative: boolean
): number {
  const count = morphAttr.count;
  const itemSize = morphAttr.itemSize;
  let peak = 0;
  for (let v = 0; v < count; v++) {
    const dx = isRelative || !baseAttr ? morphAttr.getX(v) : morphAttr.getX(v) - baseAttr.getX(v);
    const dy =
      itemSize >= 2
        ? isRelative || !baseAttr
          ? morphAttr.getY(v)
          : morphAttr.getY(v) - baseAttr.getY(v)
        : 0;
    const dz =
      itemSize >= 3
        ? isRelative || !baseAttr
          ? morphAttr.getZ(v)
          : morphAttr.getZ(v) - baseAttr.getZ(v)
        : 0;
    const mag = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz));
    if (mag > peak) peak = mag;
  }
  return peak;
}

export interface SanitizeMorphTargetsOptions {
  /** Optional animation clips whose `.morphTargetInfluences` tracks should stay aligned with compacted morph indices. */
  animations?: THREE.AnimationClip[];
  /** Optional hard upper cap on morph layers per geometry (used when active GPU limit < morph count). */
  maxLayers?: number;
  /** Clone shared/cached BufferGeometries before mutating morphAttributes (default: false). */
  cloneSharedGeometries?: boolean;
  /** Threshold below which a morph target is considered an empty zero-delta placeholder (default: 1e-5). */
  epsilon?: number;
}

/**
 * Losslessly prunes all-zero/empty placeholder morph targets across a 3D hierarchy, and
 * (when `maxLayers` is specified and still exceeded) trims lowest-impact targets to stay
 * strictly within WebGPU's `maxTextureArrayLayers` limit without downscaling per-layer resolution.
 */
export function sanitizeObjectMorphTargets(
  root: THREE.Object3D,
  options: SanitizeMorphTargetsOptions = {}
): { prunedZeroCount: number; cappedCount: number; maxRemainingLayers: number } {
  const epsilon = options.epsilon ?? 1e-5;
  const maxLayers =
    typeof options.maxLayers === 'number' && options.maxLayers > 0
      ? Math.floor(options.maxLayers)
      : undefined;

  let prunedZeroCount = 0;
  let cappedCount = 0;
  let maxRemainingLayers = 0;

  interface MeshRemapInfo {
    mesh: THREE.Mesh;
    oldCount: number;
    keptIndices: number[];
  }

  const meshesToProcess: THREE.Mesh[] = [];
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const morphAttrs = mesh.geometry.morphAttributes;
    const refArr = morphAttrs?.position || morphAttrs?.normal || morphAttrs?.color;
    if (refArr && refArr.length > 0) {
      meshesToProcess.push(mesh);
    }
  });

  if (meshesToProcess.length === 0) {
    return { prunedZeroCount: 0, cappedCount: 0, maxRemainingLayers: 0 };
  }

  // Group meshes by geometry when mutating in-place so shared geometries stay consistent
  const geometryGroups = new Map<THREE.BufferGeometry, THREE.Mesh[]>();
  for (const mesh of meshesToProcess) {
    const list = geometryGroups.get(mesh.geometry);
    if (list) list.push(mesh);
    else geometryGroups.set(mesh.geometry, [mesh]);
  }

  const remapsByTrackTarget = new Map<string, { oldCount: number; keptIndices: number[] }>();

  for (const [origGeom, sharedMeshes] of geometryGroups.entries()) {
    const posTargets = origGeom.morphAttributes.position as THREE.BufferAttribute[] | undefined;
    const normTargets = origGeom.morphAttributes.normal as THREE.BufferAttribute[] | undefined;
    const colTargets = origGeom.morphAttributes.color as THREE.BufferAttribute[] | undefined;
    const oldCount = posTargets?.length ?? normTargets?.length ?? colTargets?.length ?? 0;
    if (oldCount === 0) continue;

    const isRelative = Boolean(origGeom.morphTargetsRelative);
    const basePos = origGeom.attributes.position as
      | THREE.BufferAttribute
      | THREE.InterleavedBufferAttribute
      | undefined;
    const baseNorm = origGeom.attributes.normal as
      | THREE.BufferAttribute
      | THREE.InterleavedBufferAttribute
      | undefined;
    const baseCol = origGeom.attributes.color as
      | THREE.BufferAttribute
      | THREE.InterleavedBufferAttribute
      | undefined;

    const peakDeltas = new Float32Array(oldCount);
    const activeIndices: number[] = [];

    for (let i = 0; i < oldCount; i++) {
      let peak = 0;
      if (posTargets?.[i]) {
        peak = Math.max(peak, measureMorphAttributePeakDelta(posTargets[i], basePos, isRelative));
      }
      if (normTargets?.[i]) {
        peak = Math.max(peak, measureMorphAttributePeakDelta(normTargets[i], baseNorm, isRelative));
      }
      if (colTargets?.[i]) {
        peak = Math.max(peak, measureMorphAttributePeakDelta(colTargets[i], baseCol, isRelative));
      }
      peakDeltas[i] = peak;
      if (peak > epsilon) {
        activeIndices.push(i);
      }
    }

    const zeroDropped = oldCount - activeIndices.length;
    prunedZeroCount += zeroDropped;

    let keptIndices = activeIndices;
    if (maxLayers !== undefined && keptIndices.length > maxLayers) {
      const scored = keptIndices.map((idx) => {
        let activeWeight = 0;
        for (const m of sharedMeshes) {
          const w = Math.abs(m.morphTargetInfluences?.[idx] ?? 0);
          if (w > activeWeight) activeWeight = w;
        }
        return {
          idx,
          score: (activeWeight > 1e-4 ? 1e9 : 0) + peakDeltas[idx],
        };
      });
      scored.sort((a, b) => b.score - a.score);
      keptIndices = scored
        .slice(0, maxLayers)
        .map((s) => s.idx)
        .sort((a, b) => a - b);
      cappedCount += activeIndices.length - keptIndices.length;
    }

    maxRemainingLayers = Math.max(maxRemainingLayers, keptIndices.length);
    if (keptIndices.length === oldCount) continue;

    const newIndexByOld = new Map<number, number>();
    keptIndices.forEach((oldIdx, newIdx) => newIndexByOld.set(oldIdx, newIdx));

    const applyToGeometry = (targetGeom: THREE.BufferGeometry) => {
      if (keptIndices.length === 0) {
        delete targetGeom.morphAttributes.position;
        delete targetGeom.morphAttributes.normal;
        delete targetGeom.morphAttributes.color;
        return;
      }
      const tp = targetGeom.morphAttributes.position as THREE.BufferAttribute[] | undefined;
      const tn = targetGeom.morphAttributes.normal as THREE.BufferAttribute[] | undefined;
      const tc = targetGeom.morphAttributes.color as THREE.BufferAttribute[] | undefined;
      if (tp) targetGeom.morphAttributes.position = keptIndices.map((k) => tp[k]);
      if (tn) targetGeom.morphAttributes.normal = keptIndices.map((k) => tn[k]);
      if (tc) targetGeom.morphAttributes.color = keptIndices.map((k) => tc[k]);
    };

    let sharedUpdatedGeom: THREE.BufferGeometry | null = null;
    const remapsForMeshes: MeshRemapInfo[] = [];

    for (const mesh of sharedMeshes) {
      if (options.cloneSharedGeometries) {
        if (!sharedUpdatedGeom) {
          sharedUpdatedGeom = origGeom.clone();
          applyToGeometry(sharedUpdatedGeom);
        }
        mesh.geometry = sharedUpdatedGeom;
      } else if (!sharedUpdatedGeom) {
        sharedUpdatedGeom = origGeom;
        applyToGeometry(origGeom);
      }

      if (keptIndices.length === 0) {
        mesh.morphTargetInfluences = undefined;
        mesh.morphTargetDictionary = undefined;
      } else {
        const prevInfluences = mesh.morphTargetInfluences ?? [];
        mesh.morphTargetInfluences = keptIndices.map((k) => prevInfluences[k] ?? 0);
        if (mesh.morphTargetDictionary) {
          const nextDict: Record<string, number> = {};
          for (const [name, oldIdx] of Object.entries(mesh.morphTargetDictionary)) {
            const mapped = newIndexByOld.get(oldIdx);
            if (mapped !== undefined) {
              nextDict[name] = mapped;
            }
          }
          mesh.morphTargetDictionary = nextDict;
        }
      }

      remapsForMeshes.push({ mesh, oldCount, keptIndices });
    }

    for (const info of remapsForMeshes) {
      if (info.mesh.name) {
        remapsByTrackTarget.set(info.mesh.name, { oldCount: info.oldCount, keptIndices: info.keptIndices });
      }
      remapsByTrackTarget.set(info.mesh.uuid, { oldCount: info.oldCount, keptIndices: info.keptIndices });
      if (info.mesh.parent && info.mesh.parent !== root) {
        if (info.mesh.parent.name && !remapsByTrackTarget.has(info.mesh.parent.name)) {
          remapsByTrackTarget.set(info.mesh.parent.name, {
            oldCount: info.oldCount,
            keptIndices: info.keptIndices,
          });
        }
        if (!remapsByTrackTarget.has(info.mesh.parent.uuid)) {
          remapsByTrackTarget.set(info.mesh.parent.uuid, {
            oldCount: info.oldCount,
            keptIndices: info.keptIndices,
          });
        }
      }
    }
  }

  if (options.animations && remapsByTrackTarget.size > 0) {
    for (const clip of options.animations) {
      const nextTracks: THREE.KeyframeTrack[] = [];
      for (const track of clip.tracks) {
        if (!track.name.endsWith('.morphTargetInfluences')) {
          nextTracks.push(track);
          continue;
        }
        const targetKey = track.name.slice(0, -'.morphTargetInfluences'.length);
        const remap = remapsByTrackTarget.get(targetKey);
        if (!remap || track.values.length === 0 || track.values.length % remap.oldCount !== 0) {
          nextTracks.push(track);
          continue;
        }
        const { oldCount, keptIndices } = remap;
        if (keptIndices.length === 0) {
          continue;
        }
        const frameCount = track.values.length / oldCount;
        const compacted = new Float32Array(frameCount * keptIndices.length);
        for (let f = 0; f < frameCount; f++) {
          const srcBase = f * oldCount;
          const dstBase = f * keptIndices.length;
          for (let k = 0; k < keptIndices.length; k++) {
            compacted[dstBase + k] = track.values[srcBase + keptIndices[k]];
          }
        }
        track.values = compacted;
        nextTracks.push(track);
      }
      clip.tracks = nextTracks;
    }
  }

  return { prunedZeroCount, cappedCount, maxRemainingLayers };
}

