import * as THREE from 'three';
import {
  abs,
  attribute,
  clamp,
  cos,
  float,
  materialColor,
  max,
  modelWorldMatrix,
  positionGeometry,
  positionLocal,
  pow,
  sin,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
  vertexColor,
} from 'three/tsl';
import type { NodeMaterial } from 'three/webgpu';
import { resolveEzTreeParams } from '../data/canopyEnginePresets';
import type {
  EzTreeLeafStyle,
  EzTreeParams,
  SceneryTextureSlot,
  StylizedCanopyConfig,
  SurfaceTextureSettings,
  VisualStyleId,
} from '../types/maker';
import { attachBotwPainterlyShader } from './botwStyleUtils';
import { applyHsvShiftLinearTsl, safeMaterialReference, upgradeToNodeMaterial } from './nodeMaterialUtils';
import { getTerrainTextureAtlas } from './proceduralTextures';
import { deriveNormalMapFromImageTexture } from './treeBarkTextures';
import {
  type BranchAnchor,
  createTreeBarkMaterial,
  createTreePrng,
  hashTreeSeed,
} from './treeBaseBuilder';

export interface BuiltEzTreeSkeleton {
  group: THREE.Group;
  branchGeometry: THREE.BufferGeometry;
  leafGeometry: THREE.BufferGeometry | null;
  branchTips: THREE.Vector3[];
  branchAnchors: BranchAnchor[];
  trunkTopY: number;
  treeHeight: number;
}

interface EzLeafTexturePair {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture | null;
}

const ezLeafTextureCache = new Map<EzTreeLeafStyle, EzLeafTexturePair>();

/**
 * Generates (and caches) crisp 256x256 procedural alpha-cutout leaf cluster sprites
 * in white/neutral grayscale tones so vertex colors + tints produce vivid seasonal foliage.
 */
function getEzLeafClusterTextures(leafStyle: EzTreeLeafStyle): EzLeafTexturePair {
  const existing = ezLeafTextureCache.get(leafStyle);
  if (existing) return existing;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  const drawLeafShape = (
    cx: number,
    cy: number,
    angle: number,
    len: number,
    wid: number,
    style: EzTreeLeafStyle,
    shade: number
  ) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    const lumTop = Math.min(255, Math.round(238 * shade));
    const lumBot = Math.max(120, Math.round(168 * shade));
    const grad = ctx.createLinearGradient(0, 0, 0, -len);
    grad.addColorStop(0, `rgb(${lumBot}, ${lumBot}, ${lumBot})`);
    grad.addColorStop(0.55, `rgb(${lumTop}, ${lumTop}, ${lumTop})`);
    grad.addColorStop(1, `rgb(255, 255, 255)`);
    ctx.fillStyle = grad;

    ctx.beginPath();
    if (style === 'oak') {
      // Classic wavy multi-lobed oak leaf
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-wid * 0.45, -len * 0.14, -wid * 0.9, -len * 0.16, -wid * 0.56, -len * 0.34);
      ctx.bezierCurveTo(-wid * 1.05, -len * 0.44, -wid * 1.02, -len * 0.62, -wid * 0.58, -len * 0.68);
      ctx.bezierCurveTo(-wid * 0.85, -len * 0.82, -wid * 0.48, -len * 0.96, 0, -len);
      ctx.bezierCurveTo(wid * 0.48, -len * 0.96, wid * 0.85, -len * 0.82, wid * 0.58, -len * 0.68);
      ctx.bezierCurveTo(wid * 1.02, -len * 0.62, wid * 1.05, -len * 0.44, wid * 0.56, -len * 0.34);
      ctx.bezierCurveTo(wid * 0.9, -len * 0.16, wid * 0.45, -len * 0.14, 0, 0);
    } else if (style === 'aspen') {
      // Broad cordate / trembling aspen leaf
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-wid * 1.08, -len * 0.08, -wid * 1.05, -len * 0.68, 0, -len);
      ctx.bezierCurveTo(wid * 1.05, -len * 0.68, wid * 1.08, -len * 0.08, 0, 0);
    } else {
      // Pointed elliptical leaflet (ash)
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-wid * 0.85, -len * 0.28, -wid * 0.68, -len * 0.78, 0, -len);
      ctx.bezierCurveTo(wid * 0.68, -len * 0.78, wid * 0.85, -len * 0.28, 0, 0);
    }
    ctx.closePath();
    ctx.fill();

    // Subtle crisp border + midrib vein for natural definition
    ctx.strokeStyle = `rgba(92, 92, 92, 0.38)`;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.lineTo(0, -len * 0.88);
    ctx.strokeStyle = `rgba(255, 255, 255, 0.45)`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  };

  if (leafStyle === 'pine') {
    // Radiating pine needle fascicle fan (3 layered needle bursts around center twig)
    const rand = createTreePrng(77123);
    const bursts: { bx: number; by: number; baseA: number; span: number; count: number; len: number }[] = [
      { bx: 128, by: 215, baseA: -Math.PI * 0.5, span: 1.5, count: 28, len: 108 },
      { bx: 94, by: 162, baseA: -Math.PI * 0.65, span: 1.35, count: 24, len: 92 },
      { bx: 162, by: 162, baseA: -Math.PI * 0.35, span: 1.35, count: 24, len: 92 },
      { bx: 128, by: 120, baseA: -Math.PI * 0.5, span: 1.75, count: 32, len: 96 },
    ];
    for (const b of bursts) {
      for (let i = 0; i < b.count; i++) {
        const t = i / Math.max(1, b.count - 1) - 0.5;
        const a = b.baseA + t * b.span + (rand() - 0.5) * 0.12;
        const nLen = b.len * (0.76 + rand() * 0.32);
        const lum = Math.round(165 + rand() * 88);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(b.bx, b.by);
        ctx.quadraticCurveTo(
          b.bx + Math.cos(a) * nLen * 0.55 + (rand() - 0.5) * 6,
          b.by + Math.sin(a) * nLen * 0.55 - 4,
          b.bx + Math.cos(a) * nLen,
          b.by + Math.sin(a) * nLen
        );
        ctx.strokeStyle = `rgb(${lum}, ${lum}, ${lum})`;
        ctx.lineWidth = 5.4;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();
      }
    }
  } else if (leafStyle === 'ash') {
    // Compound pinnate ash sprig (paired leaflets + terminal leaf)
    ctx.strokeStyle = 'rgb(148, 136, 122)';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(128, 244);
    ctx.quadraticCurveTo(125, 145, 128, 55);
    ctx.stroke();

    const pairs = [
      { y: 204, spread: 0.96, len: 74, wid: 25 },
      { y: 164, spread: 0.92, len: 82, wid: 27 },
      { y: 124, spread: 0.85, len: 78, wid: 26 },
      { y: 86, spread: 0.72, len: 66, wid: 23 },
    ];
    pairs.forEach((p, idx) => {
      const shade = 0.88 + idx * 0.04;
      drawLeafShape(126, p.y, -p.spread, p.len, p.wid, 'ash', shade);
      drawLeafShape(130, p.y, p.spread, p.len, p.wid, 'ash', shade * 0.96);
    });
    drawLeafShape(128, 62, 0.02, 72, 26, 'ash', 1.0);
  } else {
    // Rich radiating cluster of 7 leaves (Oak or Aspen) for dense, natural silhouettes
    ctx.strokeStyle = 'rgb(142, 132, 120)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(128, 248);
    ctx.lineTo(128, 132);
    ctx.stroke();

    const leafSpecs = [
      { cx: 128, cy: 196, a: -1.12, len: 92, wid: 44, shade: 0.82 },
      { cx: 128, cy: 196, a: 1.12, len: 92, wid: 44, shade: 0.84 },
      { cx: 126, cy: 162, a: -0.78, len: 102, wid: 48, shade: 0.9 },
      { cx: 130, cy: 162, a: 0.78, len: 102, wid: 48, shade: 0.92 },
      { cx: 124, cy: 128, a: -0.44, len: 104, wid: 48, shade: 0.96 },
      { cx: 132, cy: 128, a: 0.44, len: 104, wid: 48, shade: 0.98 },
      { cx: 128, cy: 118, a: 0.0, len: 110, wid: 50, shade: 1.0 },
    ];
    for (const sp of leafSpecs) {
      drawLeafShape(sp.cx, sp.cy, sp.a, sp.len, sp.wid, leafStyle, sp.shade);
    }
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.ClampToEdgeWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;
  map.anisotropy = 4;
  map.generateMipmaps = true;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.magFilter = THREE.LinearFilter;
  map.needsUpdate = true;

  const normalMap = deriveNormalMapFromImageTexture(map);
  if (normalMap) {
    normalMap.wrapS = THREE.ClampToEdgeWrapping;
    normalMap.wrapT = THREE.ClampToEdgeWrapping;
  }

  const pair = { map, normalMap };
  ezLeafTextureCache.set(leafStyle, pair);
  return pair;
}

interface BranchQueueItem {
  origin: THREE.Vector3;
  orientation: THREE.Euler;
  length: number;
  radius: number;
  level: number;
  sectionCount: number;
  segmentCount: number;
}

interface RecordedSection {
  origin: THREE.Vector3;
  orientation: THREE.Euler;
  radius: number;
}

const DEFAULT_WEATHER_WIND_UNIFORM = uniform(1.0);
const _ezPosNodeCache = new Map<string, ReturnType<typeof vec3>>();
const _ezColNodeCache = new Map<string, ReturnType<typeof vec4>>();
const _ezOpacityNodeCache = new Map<string, ReturnType<typeof vec4>['a']>();
const _uniformIds = new WeakMap<object, number>();
let _nextUniformId = 1;

function getUniformId(u: object): number {
  let id = _uniformIds.get(u);
  if (!id) {
    id = _nextUniformId++;
    _uniformIds.set(u, id);
  }
  return id;
}

// Reused mutable uniform wrappers so `timeUniform` and `weatherWindUniform` bind identically
const _floatWrapperCache = new WeakMap<object, ReturnType<typeof float>>();
function resolveTimeOrWindNode(u: { value: number }): ReturnType<typeof float> {
  if ((u as unknown as { isNode?: boolean })?.isNode) {
    return u as unknown as ReturnType<typeof float>;
  }
  let cached = _floatWrapperCache.get(u);
  if (!cached) {
    cached = uniform(u.value) as unknown as ReturnType<typeof float>;
    _floatWrapperCache.set(u, cached);
  }
  return cached;
}

/**
 * Upgrades and patches an EZ-Tree bark or leaf material with WebGPU/TSL-native:
 * 1) Height-anchored branch wind sway + per-cluster leaf flutter (`aEzSway`)
 * 2) Diffuse map + vertexColor + per-vertex `aPaintHsv` HSV shifting (preserving alpha cutouts)
 * 3) Painterly BOTW rim/shadow light integration
 */
function patchEzTreeNodeMaterial(
  mat: THREE.Material,
  opts: {
    isLeaves: boolean;
    timeUniform: { value: number };
    weatherWindUniform: { value: number };
    windAmp: number;
    treeHeight: number;
    alphaTest?: number;
  }
): NodeMaterial {
  const std = mat as THREE.MeshStandardMaterial;
  const hasMap = Boolean(std.map);
  const mapTex = std.map ?? null;

  const nodeMat = upgradeToNodeMaterial(mat);
  if (nodeMat !== mat) {
    mat.dispose();
  }

  nodeMat.userData.uEzWindAmp = opts.windAmp;
  nodeMat.userData.uEzTreeHeight = Math.max(1.0, opts.treeHeight);
  nodeMat.userData.hasVertexPaintHsv = true;
  nodeMat.userData._vpBakedVertexColors = true;
  nodeMat.vertexColors = false;

  const uTime = resolveTimeOrWindNode(opts.timeUniform);
  const uWeather = resolveTimeOrWindNode(opts.weatherWindUniform);
  const posKey = `${opts.isLeaves ? 'L' : 'B'}|${getUniformId(uTime)}|${getUniformId(uWeather)}`;

  let cachedPosNode = _ezPosNodeCache.get(posKey);
  if (!cachedPosNode) {
    const uWindAmp = safeMaterialReference('userData.uEzWindAmp', 'float', 0) as unknown as ReturnType<
      typeof float
    >;
    const uHeight = safeMaterialReference('userData.uEzTreeHeight', 'float', 5.0) as unknown as ReturnType<
      typeof float
    >;
    const effWind = uWindAmp.mul(uWeather);
    const rootOrigin = modelWorldMatrix.mul(vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    const hNorm = clamp(max(0.0, positionGeometry.y).div(uHeight), 0.0, 1.4);
    const trunkFlex = pow(hNorm, 1.45);

    const treePhase = rootOrigin.x.mul(0.27).add(rootOrigin.z.mul(0.31));
    const macroWave = sin(uTime.mul(1.35).add(treePhase)).add(
      sin(uTime.mul(2.45).add(treePhase.mul(1.7))).mul(0.32)
    );
    const macroZ = cos(uTime.mul(1.12).add(treePhase.mul(0.85)));

    const macroX = macroWave.mul(0.16).mul(effWind).mul(trunkFlex);
    const macroZOff = macroZ.mul(0.12).mul(effWind).mul(trunkFlex);

    if (opts.isLeaves) {
      const swayAttr = attribute('aEzSway', 'vec2');
      const localCardDist = swayAttr.x; // 0 near center stem of card -> 1 at outer leaf edge
      const clusterPhase = swayAttr.y;
      const lFreq = float(2.6).add(clamp(uWeather, 0.2, 3.0).mul(1.2));
      const flutter = sin(uTime.mul(lFreq).add(clusterPhase).add(positionGeometry.y.mul(0.75)))
        .mul(0.085)
        .mul(localCardDist)
        .mul(effWind);
      const flutterZ = cos(uTime.mul(lFreq.mul(0.86)).add(clusterPhase.mul(1.3)))
        .mul(0.065)
        .mul(localCardDist)
        .mul(effWind);
      cachedPosNode = positionLocal.add(
        vec3(
          macroX.add(flutter),
          abs(flutter).mul(-0.18),
          macroZOff.add(flutterZ)
        )
      ) as unknown as ReturnType<typeof vec3>;
    } else {
      cachedPosNode = positionLocal.add(
        vec3(macroX, float(0.0), macroZOff)
      ) as unknown as ReturnType<typeof vec3>;
    }
    _ezPosNodeCache.set(posKey, cachedPosNode);
  }
  nodeMat.positionNode = cachedPosNode;

  // Color + optional alpha cutout node with full VertexPaint (`aPaintHsv`) & diffuse texture support!
  const vPaintHsv = attribute('aPaintHsv', 'vec3');
  if (hasMap && mapTex) {
    const colKey = `ez_map_${opts.isLeaves ? 'L' : 'B'}_${mapTex.uuid}`;
    let cachedCol = _ezColNodeCache.get(colKey);
    if (!cachedCol) {
      // `nodeMat.map = mapTex` already folds map texture RGBA into `materialColor` (vec4)
      const baseRgb = materialColor.rgb.mul(vertexColor().rgb);
      const shiftedRgb = applyHsvShiftLinearTsl(baseRgb, vPaintHsv);
      if (opts.isLeaves) {
        const texSample = texture(mapTex, uv());
        _ezOpacityNodeCache.set(colKey, texSample.a);
        cachedCol = vec4(shiftedRgb.rgb, texSample.a) as unknown as ReturnType<typeof vec4>;
      } else {
        cachedCol = vec4(shiftedRgb.rgb, float(1.0)) as unknown as ReturnType<typeof vec4>;
      }
      _ezColNodeCache.set(colKey, cachedCol);
    }
    nodeMat.colorNode = cachedCol;
    if (opts.isLeaves) {
      const cachedOp = _ezOpacityNodeCache.get(colKey);
      if (cachedOp) nodeMat.opacityNode = cachedOp;
      nodeMat.alphaTestNode = float(opts.alphaTest ?? 0.36);
      nodeMat.alphaTest = opts.alphaTest ?? 0.36;
      nodeMat.transparent = false;
      nodeMat.side = THREE.DoubleSide;
    }
  } else {
    const colKey = `ez_nomap`;
    let cachedCol = _ezColNodeCache.get(colKey);
    if (!cachedCol) {
      const baseRgb = materialColor.rgb.mul(vertexColor().rgb);
      const shiftedRgb = applyHsvShiftLinearTsl(baseRgb, vPaintHsv);
      cachedCol = vec4(shiftedRgb.rgb, float(1.0)) as unknown as ReturnType<typeof vec4>;
      _ezColNodeCache.set(colKey, cachedCol);
    }
    nodeMat.colorNode = cachedCol;
  }

  attachBotwPainterlyShader(nodeMat, {
    isFoliage: opts.isLeaves,
    rimStrengthScale: opts.isLeaves ? 0.92 : 0.72,
    shadowLiftScale: 0.85,
    translucencyScale: opts.isLeaves ? 1.0 : 0.0,
  });
  nodeMat.needsUpdate = true;
  return nodeMat;
}

/**
 * Generates an EZ-Tree recursive multi-level branch & leaf-cluster tree skeleton,
 * returning merged indexed BufferGeometries, terminal anchors, and height bounds.
 */
export function generateEzBranchGeometry(
  config: StylizedCanopyConfig,
  params: EzTreeParams,
  treeKey: string,
  detail: 'studio' | 'forest' = 'studio'
): BuiltEzTreeSkeleton {
  const rand = createTreePrng(hashTreeSeed(`${treeKey}_eztree`, config.seed));
  const variety = THREE.MathUtils.clamp(config.trunkVariety ?? 0.35, 0, 1);
  const hVariety = 1 + (rand() - 0.5) * 2 * variety * 0.22;
  const rVariety = 1 + (rand() - 0.5) * 2 * variety * 0.2;

  // Height scaling keeps EZ-Tree proportions harmonized with stylized island scale
  const heightNormScale = THREE.MathUtils.clamp(config.trunkHeight / 3.0, 0.55, 2.2) * hVariety;
  const thickNormScale = THREE.MathUtils.clamp(config.trunkThickness, 0.4, 2.1) * rVariety;

  const levels = THREE.MathUtils.clamp(Math.round(params.levels), 1, 3);
  const sectionCounts = detail === 'studio' ? [10, 7, 5, 4] : [8, 5, 4, 3];
  const segmentCounts = detail === 'studio' ? [10, 7, 5, 4] : [8, 5, 4, 3];

  const branchVerts: number[] = [];
  const branchNormals: number[] = [];
  const branchUvs: number[] = [];
  const branchColors: number[] = [];
  const branchIndices: number[] = [];

  const leafVerts: number[] = [];
  const leafNormals: number[] = [];
  const leafUvs: number[] = [];
  const leafColors: number[] = [];
  const leafSways: number[] = [];
  const leafIndices: number[] = [];

  const branchTips: THREE.Vector3[] = [];
  const branchAnchors: BranchAnchor[] = [];
  let maxTreeY = 1.0;

  const forceDir = new THREE.Vector3(
    params.forceDirection[0] ?? 0,
    params.forceDirection[1] ?? 1,
    params.forceDirection[2] ?? 0
  );
  if (forceDir.lengthSq() < 0.0001) forceDir.set(0, 1, 0);
  forceDir.normalize();
  const forceQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), forceDir);

  const upVec = new THREE.Vector3(0, 1, 0);
  const tmpVec = new THREE.Vector3();
  const tmpNormal = new THREE.Vector3();
  const qSection = new THREE.Quaternion();
  const qTwist = new THREE.Quaternion();
  const qGnarl = new THREE.Quaternion();

  const queue: BranchQueueItem[] = [
    {
      origin: new THREE.Vector3(0, -0.14, 0), // seat trunk cleanly slightly below terrain ground
      orientation: new THREE.Euler(0, rand() * Math.PI * 2, 0),
      length: Math.max(0.8, (params.length[0] ?? 3.0) * heightNormScale),
      radius: Math.max(0.08, (params.radius[0] ?? 0.42) * thickNormScale),
      level: 0,
      sectionCount: sectionCounts[0],
      segmentCount: segmentCounts[0],
    },
  ];

  // Global hue/sat/val shifts for leaves
  const globalHueNorm = (config.hueShift ?? 0) / 360;
  const treeHueShift = (rand() - 0.5) * 2 * ((config.hueVariation ?? 18) / 360);
  const treeValShift = (rand() - 0.5) * 2 * (config.valueVariation ?? 0.14);
  const globalSatShift = (config.saturationShift ?? 0) * 0.7;
  const globalValShift = (config.valueShift ?? 0) * 0.55;
  const sunLift = config.sunCrownGradient ?? 0.25;

  const baseLeafTint = new THREE.Color(params.leafTint || '#55AB42');
  const tmpLeafColor = new THREE.Color();

  const recordLeafOnBranch = (sections: RecordedSection[], branchLevel: number) => {
    if (!params.leavesEnabled || params.foliageMode === 'canopyPuffs') return;
    if (params.growthType === 'evergreen') {
      if (branchLevel < Math.max(1, levels - 1)) return;
    } else if (branchLevel < levels) {
      return;
    }

    const leafCount = Math.max(
      1,
      Math.round(
        (params.leafCount ?? 12) *
          (branchLevel < levels ? 0.5 : 1.0) *
          (detail === 'forest' ? 0.78 : 1.0)
      )
    );
    const startT = THREE.MathUtils.clamp(params.leafStart ?? 0.12, 0, 0.88);
    const baseLeafSize = THREE.MathUtils.clamp(
      (params.leafSize ?? 1.2) * (0.58 + 0.32 * heightNormScale),
      0.24,
      2.8
    );
    const leafAngleRad = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(params.leafAngle ?? 42, 0, 85));
    const isDouble = params.billboard !== 'single';

    for (let li = 0; li < leafCount; li++) {
      const t = THREE.MathUtils.lerp(startT, 1.0, rand());
      const fIdx = t * (sections.length - 1);
      const sA = Math.min(sections.length - 1, Math.floor(fIdx));
      const sB = Math.min(sections.length - 1, sA + 1);
      const alpha = fIdx - sA;

      const secA = sections[sA];
      const secB = sections[sB];
      const origin = new THREE.Vector3().lerpVectors(secA.origin, secB.origin, alpha);

      const qA = new THREE.Quaternion().setFromEuler(secA.orientation);
      const qB = new THREE.Quaternion().setFromEuler(secB.orientation);
      const baseQ = qA.slerp(qB, alpha);

      // Rotate leaf around branch axis + apply tilt spread
      const rotE = new THREE.Euler(
        (rand() - 0.5) * 2 * leafAngleRad,
        (rand() - 0.5) * Math.PI * 2,
        (rand() - 0.5) * 2 * leafAngleRad
      );
      const leafQ = baseQ.clone().multiply(new THREE.Quaternion().setFromEuler(rotE));
      const sizeScale = baseLeafSize * (0.76 + rand() * 0.48);

      const perLeafHue = (rand() - 0.5) * 2 * ((config.hueVariation ?? 18) / 360) * 0.7;
      const perLeafVal = (rand() - 0.5) * 2 * (config.valueVariation ?? 0.14) * 0.7;
      const yLift = THREE.MathUtils.clamp(origin.y / Math.max(2.5, maxTreeY), 0, 1) * sunLift;
      const innerShadow = THREE.MathUtils.clamp(
        Math.hypot(origin.x, origin.z) / Math.max(1.2, maxTreeY * 0.35),
        0.74,
        1.05
      );

      tmpLeafColor
        .copy(baseLeafTint)
        .offsetHSL(
          globalHueNorm + treeHueShift * 0.5 + perLeafHue,
          globalSatShift,
          globalValShift + treeValShift * 0.4 + perLeafVal + (yLift - 0.12)
        )
        .multiplyScalar(innerShadow);

      const clusterPhase = rand() * Math.PI * 2;
      const planes = isDouble ? [0, Math.PI * 0.5] : [0];

      for (const yawOffset of planes) {
        const planeQ = leafQ.clone().multiply(new THREE.Quaternion().setFromAxisAngle(upVec, yawOffset));
        const vOffset = leafVerts.length / 3;
        const hw = sizeScale * 0.5;
        const hh = sizeScale;

        const quadVerts: [number, number, number, number, number, number][] = [
          [-hw, 0, 0, 0, 0, 0.15],
          [hw, 0, 0, 1, 0, 0.15],
          [hw, hh, 0, 1, 1, 1.0],
          [-hw, hh, 0, 0, 1, 1.0],
        ];
        const quadNorm = new THREE.Vector3(0, 0, 1).applyQuaternion(planeQ).normalize();

        for (const [qx, qy, qz, qu, qv, swayW] of quadVerts) {
          tmpVec.set(qx, qy, qz).applyQuaternion(planeQ).add(origin);
          if (tmpVec.y > maxTreeY) maxTreeY = tmpVec.y;
          leafVerts.push(tmpVec.x, tmpVec.y, tmpVec.z);
          leafNormals.push(quadNorm.x, quadNorm.y, quadNorm.z);
          leafUvs.push(qu, qv);
          leafColors.push(tmpLeafColor.r, tmpLeafColor.g, tmpLeafColor.b);
          leafSways.push(swayW, clusterPhase);
        }

        leafIndices.push(vOffset, vOffset + 1, vOffset + 2, vOffset, vOffset + 2, vOffset + 3);
      }
    }
  };

  let trunkTopY = 2.8;

  while (queue.length > 0) {
    const branch = queue.shift()!;
    const lvl = branch.level;
    const sectionCount = branch.sectionCount;
    const segmentCount = branch.segmentCount;
    const sectionLength = branch.length / sectionCount;
    const taper = THREE.MathUtils.clamp(params.taper[lvl] ?? 0.7, 0.12, 0.96);
    const gnarlAmt = Math.max(0, params.gnarliness[lvl] ?? 0.2);
    const twistAmt = params.twist[lvl] ?? 0.05;

    const curOrigin = branch.origin.clone();
    const curOrient = branch.orientation.clone();
    const firstRingIdx = branchVerts.length / 3;
    const sections: RecordedSection[] = [];

    for (let i = 0; i <= sectionCount; i++) {
      const t = i / sectionCount;
      // Taper smoothly along branch + root collar flare on trunk base
      let secRadius = branch.radius * THREE.MathUtils.lerp(1.0, Math.max(0.06, 1.0 - taper * 0.84), Math.pow(t, 0.85));
      if (lvl === 0 && t < 0.28) {
        secRadius *= 1 + Math.pow(1 - t / 0.28, 2.0) * 0.42;
      }
      if (i === sectionCount) {
        secRadius = Math.max(0.004, lvl === levels ? 0.004 : secRadius * 0.78);
      }

      // Subtle bark crevice AO near parent join
      const collarAo = lvl > 0 && t < 0.22 ? THREE.MathUtils.lerp(0.76, 1.0, t / 0.22) : 1.0;

      sections.push({
        origin: curOrigin.clone(),
        orientation: curOrient.clone(),
        radius: secRadius,
      });

      const stride = segmentCount + 1;
      for (let j = 0; j <= segmentCount; j++) {
        const uFrac = j / segmentCount;
        const angle = uFrac * Math.PI * 2;
        tmpVec
          .set(Math.cos(angle) * secRadius, 0, Math.sin(angle) * secRadius)
          .applyEuler(curOrient)
          .add(curOrigin);

        if (tmpVec.y > maxTreeY) maxTreeY = tmpVec.y;
        tmpNormal
          .set(Math.cos(angle), 0, Math.sin(angle))
          .applyEuler(curOrient)
          .normalize();

        branchVerts.push(tmpVec.x, tmpVec.y, tmpVec.z);
        branchNormals.push(tmpNormal.x, tmpNormal.y, tmpNormal.z);
        branchUvs.push(
          uFrac * (lvl === 0 ? 1.5 : 1.0),
          (t * branch.length) / Math.max(0.4, branch.radius * 5.0)
        );
        branchColors.push(collarAo, collarAo, collarAo);
      }

      if (i < sectionCount) {
        // Advance origin along current tangent
        tmpVec.set(0, sectionLength, 0).applyEuler(curOrient);
        curOrigin.add(tmpVec);

        // Apply gnarliness perturbation + helical twist + tropism growth force
        const fudge = (gnarlAmt * 0.55) / Math.max(0.28, Math.sqrt(Math.max(0.04, secRadius)));
        const gEul = new THREE.Euler(
          (rand() - 0.5) * fudge,
          twistAmt,
          (rand() - 0.5) * fudge
        );
        qSection.setFromEuler(curOrient);
        qGnarl.setFromEuler(gEul);
        qTwist.setFromAxisAngle(upVec, twistAmt * 0.45);
        qSection.multiply(qGnarl).multiply(qTwist);

        if (Math.abs(params.forceStrength) > 0.0005) {
          const forceScale = Math.abs(params.forceStrength) / Math.max(0.18, secRadius * 0.85);
          const targetQ =
            params.forceStrength >= 0
              ? forceQ
              : new THREE.Quaternion().setFromUnitVectors(
                  new THREE.Vector3(0, 1, 0),
                  forceDir.clone().negate()
                );
          qSection.slerp(targetQ, THREE.MathUtils.clamp(forceScale * 0.32, 0, 0.45));
        }

        curOrient.setFromQuaternion(qSection);
      }
    }

    // Build branch triangle indices
    const stride = segmentCount + 1;
    for (let i = 0; i < sectionCount; i++) {
      for (let j = 0; j < segmentCount; j++) {
        const a = firstRingIdx + i * stride + j;
        const b = firstRingIdx + i * stride + j + 1;
        const c = firstRingIdx + (i + 1) * stride + j + 1;
        const d = firstRingIdx + (i + 1) * stride + j;
        branchIndices.push(a, d, b, b, d, c);
      }
    }

    if (lvl === 0) {
      trunkTopY = Math.max(1.2, sections[sections.length - 1].origin.y);
    }

    const endSec = sections[sections.length - 1];
    if (lvl === levels || (lvl === 1 && levels === 1)) {
      branchTips.push(endSec.origin.clone());
    }
    if (lvl === 1) {
      const midSec = sections[Math.floor(sections.length * 0.5)];
      const dx = endSec.origin.x - branch.origin.x;
      const dz = endSec.origin.z - branch.origin.z;
      branchAnchors.push({
        origin: branch.origin.clone(),
        mid: midSec.origin.clone(),
        tip: endSec.origin.clone(),
        length: branch.length,
        thickness: branch.radius,
        yaw: Math.atan2(dz, dx),
      });
    }

    // Generate child branches or attach leaves
    if (lvl < levels) {
      const childCount = Math.max(0, Math.round(params.children[lvl] ?? 3));
      const childStartT = THREE.MathUtils.clamp(params.start[lvl] ?? 0.25, 0.05, 0.92);
      const splitAngleRad = THREE.MathUtils.degToRad(
        THREE.MathUtils.clamp(params.angle[lvl] ?? 48, 8, 86)
      );
      const goldenOffset = rand() * Math.PI * 2;
      const isEvergreenWhorl = params.growthType === 'evergreen';

      for (let c = 0; c < childCount; c++) {
        const frac = childCount > 1 ? c / (childCount - 1) : 0.5;
        const spawnT = isEvergreenWhorl
          ? THREE.MathUtils.lerp(childStartT, 0.96, frac)
          : THREE.MathUtils.lerp(childStartT, 0.98, THREE.MathUtils.clamp(frac + (rand() - 0.5) * 0.14, 0, 1));

        const sFloat = spawnT * (sections.length - 1);
        const s0 = Math.min(sections.length - 1, Math.floor(sFloat));
        const s1 = Math.min(sections.length - 1, s0 + 1);
        const sAlpha = sFloat - s0;

        const childOrigin = new THREE.Vector3().lerpVectors(
          sections[s0].origin,
          sections[s1].origin,
          sAlpha
        );
        const pQuatA = new THREE.Quaternion().setFromEuler(sections[s0].orientation);
        const pQuatB = new THREE.Quaternion().setFromEuler(sections[s1].orientation);
        const parentQuat = pQuatA.slerp(pQuatB, sAlpha);

        const parentRadAtSpawn = THREE.MathUtils.lerp(
          sections[s0].radius,
          sections[s1].radius,
          sAlpha
        );

        const lenAtten = params.length[lvl + 1] ?? 1.6;
        const evergreenAtten = isEvergreenWhorl ? 1.05 - spawnT * 0.72 : 1.0;
        const baseChildLen =
          lvl === 0
            ? lenAtten * heightNormScale * evergreenAtten
            : branch.length * THREE.MathUtils.clamp(lenAtten / Math.max(0.8, params.length[lvl] ?? 2.2), 0.38, 0.86);

        const childRadiusRatio = THREE.MathUtils.clamp(params.radius[lvl + 1] ?? 0.6, 0.25, 0.85);
        const childRadius = Math.max(0.012, parentRadAtSpawn * childRadiusRatio);

        // Even azimuth distribution with natural organic variation
        const azimuth = goldenOffset + c * 2.3999632 + (rand() - 0.5) * 0.42;
        const tilt = splitAngleRad * (0.82 + rand() * 0.36);

        const radialAxis = new THREE.Vector3(Math.cos(azimuth), 0, Math.sin(azimuth)).normalize();
        const splitQ = new THREE.Quaternion().setFromAxisAngle(radialAxis, tilt);
        const childQuat = parentQuat.clone().multiply(splitQ);
        const childEuler = new THREE.Euler().setFromQuaternion(childQuat);

        queue.push({
          origin: childOrigin,
          orientation: childEuler,
          length: Math.max(0.32, baseChildLen * (0.84 + rand() * 0.32)),
          radius: childRadius,
          level: lvl + 1,
          sectionCount: sectionCounts[lvl + 1] ?? 4,
          segmentCount: segmentCounts[lvl + 1] ?? 3,
        });
      }
    }

    recordLeafOnBranch(sections, lvl);
  }

  branchAnchors.sort((a, b) => b.length * b.thickness - a.length * a.thickness);
  if (branchTips.length === 0) {
    branchTips.push(new THREE.Vector3(0, trunkTopY, 0));
  }

  const branchGeometry = new THREE.BufferGeometry();
  branchGeometry.setAttribute('position', new THREE.Float32BufferAttribute(branchVerts, 3));
  branchGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(branchNormals, 3));
  branchGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(branchUvs, 2));
  branchGeometry.setAttribute('color', new THREE.Float32BufferAttribute(branchColors, 3));
  branchGeometry.setAttribute(
    'aPaintHsv',
    new THREE.Float32BufferAttribute(new Float32Array(branchVerts.length), 3)
  );
  branchGeometry.setIndex(branchIndices);
  branchGeometry.computeBoundingSphere();

  let leafGeometry: THREE.BufferGeometry | null = null;
  if (leafVerts.length > 0 && leafIndices.length > 0) {
    leafGeometry = new THREE.BufferGeometry();
    leafGeometry.setAttribute('position', new THREE.Float32BufferAttribute(leafVerts, 3));
    leafGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(leafNormals, 3));
    leafGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(leafUvs, 2));
    leafGeometry.setAttribute('color', new THREE.Float32BufferAttribute(leafColors, 3));
    leafGeometry.setAttribute('aEzSway', new THREE.Float32BufferAttribute(leafSways, 2));
    leafGeometry.setAttribute(
      'aPaintHsv',
      new THREE.Float32BufferAttribute(new Float32Array(leafVerts.length), 3)
    );
    leafGeometry.setIndex(leafIndices);
    leafGeometry.computeBoundingSphere();
  }

  const group = new THREE.Group();
  return {
    group,
    branchGeometry,
    leafGeometry,
    branchTips,
    branchAnchors,
    trunkTopY,
    treeHeight: Math.max(2.0, maxTreeY),
  };
}

/**
 * Builds a complete WebGPU/TSL-compatible EZ-Tree THREE.Group (branches + alpha leaf cards)
 * using the app's unified bark styles, wind weather uniform, painterly shader, and Vertex Paint attributes.
 */
export function buildEzTreeGroup(
  config: StylizedCanopyConfig,
  treeKey: string,
  style: VisualStyleId,
  timeUniform: { value: number },
  opts?: {
    baseOnly?: boolean;
    sceneryTextures?: Partial<Record<SceneryTextureSlot, SurfaceTextureSettings>>;
    weatherWindUniform?: { value: number };
    detail?: 'studio' | 'forest';
  }
): {
  group: THREE.Group;
  branchTips: THREE.Vector3[];
  branchAnchors: BranchAnchor[];
  trunkTopY: number;
  foliageMode: EzTreeParams['foliageMode'];
} {
  const params = resolveEzTreeParams(config);
  const weatherWindUniform = opts?.weatherWindUniform ?? DEFAULT_WEATHER_WIND_UNIFORM;
  const skeleton = generateEzBranchGeometry(config, params, treeKey, opts?.detail ?? 'studio');
  const root = skeleton.group;
  const windAmp = Math.max(0, config.windSway ?? 0.8);

  // 1. Bark Material & Merged Branches Mesh
  const rawBarkMat = createTreeBarkMaterial(config, style, opts?.sceneryTextures);
  const patchedBarkMat = patchEzTreeNodeMaterial(rawBarkMat, {
    isLeaves: false,
    timeUniform,
    weatherWindUniform,
    windAmp,
    treeHeight: skeleton.treeHeight,
  });

  const branchMesh = new THREE.Mesh(skeleton.branchGeometry, patchedBarkMat);
  branchMesh.castShadow = true;
  branchMesh.receiveShadow = true;
  branchMesh.userData.paintPart = 'branches';
  root.add(branchMesh);

  // 2. Alpha-Cutout Leaf Cluster Mesh (with vertex color, TSL flutter & Vertex Paint support)
  if (!opts?.baseOnly && skeleton.leafGeometry) {
    const leafTex = getEzLeafClusterTextures(params.leafStyle);
    const bumpStr = THREE.MathUtils.clamp(config.foliageBumpStrength ?? 0.42, 0, 1);
    const nScale = bumpStr * 0.95;

    const rawLeafMat =
      style === 'celToon'
        ? new THREE.MeshToonMaterial({
            color: '#FFFFFF',
            map: leafTex.map,
            normalMap: bumpStr > 0.01 ? leafTex.normalMap : null,
            normalScale: new THREE.Vector2(nScale * 0.8, nScale * 0.8),
            alphaTest: params.leafAlphaTest,
            side: THREE.DoubleSide,
            gradientMap: getTerrainTextureAtlas().toonGradient,
          })
        : new THREE.MeshStandardMaterial({
            color: '#FFFFFF',
            map: leafTex.map,
            normalMap: bumpStr > 0.01 ? leafTex.normalMap : null,
            normalScale: new THREE.Vector2(nScale, nScale),
            alphaTest: params.leafAlphaTest,
            roughness: 0.86,
            metalness: 0.0,
            envMapIntensity: 0.32,
            side: THREE.DoubleSide,
          });

    const patchedLeafMat = patchEzTreeNodeMaterial(rawLeafMat, {
      isLeaves: true,
      timeUniform,
      weatherWindUniform,
      windAmp,
      treeHeight: skeleton.treeHeight,
      alphaTest: params.leafAlphaTest,
    });

    const leavesMesh = new THREE.Mesh(skeleton.leafGeometry, patchedLeafMat);
    leavesMesh.castShadow = true;
    leavesMesh.receiveShadow = true;
    leavesMesh.userData.paintPart = 'leaves';
    root.add(leavesMesh);
  }

  return {
    group: root,
    branchTips: skeleton.branchTips,
    branchAnchors: skeleton.branchAnchors,
    trunkTopY: skeleton.trunkTopY,
    foliageMode: params.foliageMode,
  };
}
