import * as THREE from 'three';
import type { NodeMaterial } from 'three/webgpu';
import {
  abs,
  attribute,
  clamp,
  cos,
  dot,
  float,
  fract,
  length,
  materialColor,
  materialOpacity,
  materialRoughness,
  max,
  modelWorldMatrix,
  normalLocal,
  normalize,
  positionGeometry,
  positionLocal,
  sin,
  uniform,
  vec2,
  vec3,
  vec4,
  vertexColor,
} from 'three/tsl';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type {
  CanopyLeafShape,
  ConiferShapeStyle,
  GameLevel,
  SceneryTextureSlot,
  ScatterItem,
  StylizedCanopyConfig,
  SurfaceTextureSettings,
  TreeSpeciesType,
  VisualStyleId,
} from '../types/maker';
import {
  applySurfaceTextureToMaterial,
  getProcessedSurfaceTextures,
} from './customTextureManager';
import { getCachedAssetSync } from './gltfAssetManager';
import { getTerrainTextureAtlas } from './proceduralTextures';
import { adaptMaterialForVisualStyle, attachBotwPainterlyShader } from './botwStyleUtils';
import {
  deriveNormalMapFromImageTexture,
  getProceduralCanopyBaseTextures,
  getProceduralFoliageTextures,
  getProceduralLeafBladeTextures,
  getProceduralPineFrondTextures,
} from './treeBarkTextures';
import {
  buildProceduralTreeBase,
  createTreePrng,
  hashTreeSeed,
  type BranchAnchor,
  type BuiltTreeBase,
} from './treeBaseBuilder';
import { createSculptedCanopyLobeGeometry } from './treeGeometry';
import {
  applyVertexPaintStrokesToObject,
  prepareObjectForVertexPainting,
} from './vertexPainter';
import {
  applyDegradeLayersTsl,
  applyDegradeRoughnessTsl,
  applyHsvShiftLinearTsl,
  applyWearDingsScratchesTsl,
  safeMaterialReference,
  upgradeToNodeMaterial,
} from './nodeMaterialUtils';
import { buildEzTreeGroup } from './ezTreeBuilder';

export interface CanopyPuffTransform {
  x: number;
  y: number;
  z: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  /** Per-puff HSV offset: [hueDelta (-0.5..0.5), satDelta (-1..1), valDelta (-1..1)] */
  hsvShift: [number, number, number];
}

export interface GeneratedTreeCanopyLayout {
  puffs: CanopyPuffTransform[];
  crownBaseY: number;
}

export interface NormalizedCanopyPrimitive {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  isFallback: boolean;
}

export interface BuiltSingleTreeResult {
  group: THREE.Group;
  colorHex: string;
}

const DEFAULT_WEATHER_WIND_UNIFORM = uniform(1.0);
const _defaultZeroVec3 = new THREE.Vector3(0, 0, 0);
const _floatUniformCache = new WeakMap<object, typeof DEFAULT_WEATHER_WIND_UNIFORM>();
const _uniformObjIds = new WeakMap<object, number>();
let _nextUniformObjId = 1;

function getUniformObjId(u: object): number {
  let id = _uniformObjIds.get(u);
  if (!id) {
    id = _nextUniformObjId++;
    _uniformObjIds.set(u, id);
  }
  return id;
}

const _canopyPosNodeCache = new Map<string, ReturnType<typeof vec3>>();
const _canopyColorNodeCache = new Map<string, ReturnType<typeof vec4>>();
const _leafFlutterPosNodeCache = new Map<string, ReturnType<typeof vec3>>();

function asFloatUniformNode(u: { value: number }): typeof DEFAULT_WEATHER_WIND_UNIFORM {
  if ((u as unknown as { isNode?: boolean })?.isNode) {
    return u as typeof DEFAULT_WEATHER_WIND_UNIFORM;
  }
  const existing = _floatUniformCache.get(u);
  if (existing) return existing;
  const created = uniform(u.value);
  _floatUniformCache.set(u, created);
  return created;
}

/**
 * Computes a live wind multiplier from scene weather pattern + wind strength slider
 * so canopy clouds and 3D contour leaves flutter and bend realistically when weather changes!
 */
export function computeWeatherWindFactor(
  weather?: GameLevel['weather'],
  wind = 0.5
): number {
  const w = THREE.MathUtils.clamp(wind ?? 0.5, 0, 2.5);
  const base = 0.32 + w * 1.15;
  if (weather === 'rain') return base * 2.15;
  if (weather === 'leaves') return base * 1.85;
  if (weather === 'snow') return base * 1.32;
  if (weather === 'fireflies') return base * 0.62;
  return base;
}

/**
 * Deterministically generates overlapping squished canopy puffs for Oak / Fantasy / Custom trees,
 * anchoring naturally over the trunk and major branch cradle.
 */
export function generateTreeCanopyLayout(
  config: StylizedCanopyConfig,
  treeKey: string,
  branchTips?: THREE.Vector3[],
  base?: BuiltTreeBase
): GeneratedTreeCanopyLayout {
  const rand = createTreePrng(hashTreeSeed(treeKey, config.seed));
  const minP = Math.max(1, Math.min(12, Math.round(Math.min(config.minPuffs, config.maxPuffs))));
  const maxP = Math.max(minP, Math.min(12, Math.round(Math.max(config.minPuffs, config.maxPuffs))));
  const rolledPuffCount = minP + Math.floor(rand() * (maxP - minP + 1));

  const heightJitter = (rand() - 0.5) * 2 * config.heightVariation;
  const crownBaseY = Math.max(0.9, config.canopyHeight + heightJitter);

  const baseHueNorm = config.hueShift / 360;
  const treeHueOffset = (rand() - 0.5) * 2 * (config.hueVariation / 360);
  const treeValOffset = (rand() - 0.5) * 2 * config.valueVariation;

  const spacingMult = THREE.MathUtils.lerp(
    1.22,
    0.42,
    THREE.MathUtils.clamp(config.overlapTightness, 0, 1)
  );
  const startAngle = rand() * Math.PI * 2;
  const windDirAngle = rand() * Math.PI * 2;
  const tiltRad = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(config.tiltAmount, 0, 45));

  const branchAttach = THREE.MathUtils.clamp(config.canopyBranchAttach ?? 0.72, 0, 1);
  const branchCanopyScale = THREE.MathUtils.clamp(config.branchCanopyScale ?? 0.68, 0.35, 1.0);

  // Prominent main branches emanating from the trunk (sorted longest/thickest first)
  const anchors: BranchAnchor[] = base?.branchAnchors ?? [];
  const trunkApex = base ? base.trunkCurve.getPointAt(1) : new THREE.Vector3(0, crownBaseY, 0);
  const crownHeightOffset = base ? crownBaseY - (base.trunkTopY + 0.35) : 0;

  // Guarantee EVERY main branch emanating from the trunk receives its own canopy sphere (or cluster of spheres)!
  const useBranchCrowns = branchAttach > 0.04 && anchors.length > 0;
  const centralCrownCount = useBranchCrowns
    ? Math.max(1, Math.min(2, Math.round(rolledPuffCount * 0.34)))
    : rolledPuffCount;
  const puffCount = useBranchCrowns
    ? Math.min(18, Math.max(rolledPuffCount, centralCrownCount + anchors.length))
    : rolledPuffCount;

  // Fallback cradle offset when no branchAnchors provided
  let cradleX = trunkApex.x;
  let cradleZ = trunkApex.z;
  if (!base && branchTips && branchTips.length > 0) {
    cradleX = 0;
    cradleZ = 0;
    for (const tip of branchTips) {
      cradleX += tip.x;
      cradleZ += tip.z;
    }
    cradleX /= branchTips.length;
    cradleZ /= branchTips.length;
  }

  const maxProminence =
    anchors.length > 0 ? Math.max(0.01, anchors[0].length * anchors[0].thickness) : 1;

  const rawPuffs: {
    x: number;
    y: number;
    z: number;
    sx: number;
    sy: number;
    sz: number;
    rx: number;
    ry: number;
    rz: number;
    microHue: number;
    microVal: number;
  }[] = [];

  for (let i = 0; i < puffCount; i++) {
    const t = puffCount > 1 ? i / (puffCount - 1) : 0;
    const isHero = i === 0;
    const isBranchPuff = useBranchCrowns && i >= centralCrownCount;
    const angle = startAngle + i * 2.3999632 + (rand() - 0.5) * 0.55;

    let assignedBranch: BranchAnchor | null = null;
    let branchSubIdx = 0;
    if (isBranchPuff) {
      const bSlot = i - centralCrownCount;
      // Cover EVERY main branch 1-to-1 first, then add secondary spheres onto prominent branches
      assignedBranch = anchors[bSlot % anchors.length];
      branchSubIdx = Math.floor(bSlot / anchors.length);
    }

    const sizeContrast = isHero
      ? 1.0 + config.sizeVariation * (0.18 + rand() * 0.25)
      : 1.0 + (rand() * 2 - 1.1) * config.sizeVariation * 0.48;

    // Secondary main-branch canopies are naturally slightly smaller than the main central canopy!
    let branchScaleFactor = 1.0;
    if (assignedBranch) {
      const promNorm = THREE.MathUtils.clamp(
        (assignedBranch.length * assignedBranch.thickness) / maxProminence,
        0.35,
        1.0
      );
      const secondaryPenalty = branchSubIdx > 0 ? 0.84 : 1.0;
      const targetBranchScale =
        branchCanopyScale * (0.84 + promNorm * 0.24) * secondaryPenalty;
      branchScaleFactor = THREE.MathUtils.lerp(1.0, targetBranchScale, branchAttach);
    }

    const baseSize = Math.max(
      0.28,
      config.basePuffSize * Math.max(0.45, sizeContrast) * branchScaleFactor
    );

    const squishJitter = 1 + (rand() - 0.5) * 2 * config.squishVariation;
    let syFactor = THREE.MathUtils.clamp(config.squishY * squishJitter, 0.28, 2.2);
    if (config.silhouette === 'umbrella') syFactor *= 0.84;
    if (config.silhouette === 'cypress') syFactor *= 1.18;
    if (config.silhouette === 'tiered') syFactor *= 0.78;

    const ovalAxisFlip = rand() > 0.5 ? 1 : -1;
    const ovalStrength = config.ovalnessXZ * (0.4 + rand() * 0.6);
    const ovalX = ovalAxisFlip > 0 ? 1 + ovalStrength * 0.55 : 1 - ovalStrength * 0.38;
    const ovalZ = ovalAxisFlip > 0 ? 1 - ovalStrength * 0.38 : 1 + ovalStrength * 0.55;

    const sx = Math.max(
      0.24,
      baseSize * ovalX * (1 + (rand() - 0.5) * config.squishVariation * 0.45)
    );
    const sy = Math.max(0.24, baseSize * syFactor);
    const sz = Math.max(
      0.24,
      baseSize * ovalZ * (1 + (rand() - 0.5) * config.squishVariation * 0.45)
    );

    // 1. Compute classic central-mass silhouette position
    let px = cradleX * 0.8;
    let py = crownBaseY;
    let pz = cradleZ * 0.8;

    if (config.silhouette === 'dome') {
      if (isHero) {
        const r = config.clusterSpread * 0.12 * spacingMult;
        px += Math.cos(angle) * r;
        pz += Math.sin(angle) * r;
        py += config.verticalSpread * (0.28 + rand() * 0.2);
      } else {
        const ringR = config.clusterSpread * spacingMult * (0.62 + rand() * 0.48);
        px += Math.cos(angle) * ringR;
        pz += Math.sin(angle) * ringR;
        const yArc = i === puffCount - 1 && puffCount >= 4 ? 0.52 : -0.32 + rand() * 0.72;
        py += yArc * config.verticalSpread;
      }
    } else if (config.silhouette === 'umbrella') {
      const ringR = isHero
        ? config.clusterSpread * 0.2 * spacingMult
        : config.clusterSpread * 1.24 * spacingMult * (0.68 + rand() * 0.42);
      px += Math.cos(angle) * ringR;
      pz += Math.sin(angle) * ringR;
      py += (isHero ? 0.22 : (rand() - 0.5) * 0.52) * config.verticalSpread;
    } else if (config.silhouette === 'cypress') {
      const stackT = puffCount > 1 ? i / (puffCount - 1) : 0.5;
      const taper = 1 - stackT * 0.45;
      const ringR = config.clusterSpread * 0.46 * spacingMult * taper * (0.35 + rand() * 0.75);
      px += Math.cos(angle) * ringR;
      pz += Math.sin(angle) * ringR;
      py += (stackT - 0.35) * config.verticalSpread * 1.95;
    } else if (config.silhouette === 'tiered') {
      const tier = i % Math.min(3, Math.max(2, Math.ceil(puffCount / 2)));
      const ringR =
        tier === 0 && isHero
          ? config.clusterSpread * 0.22 * spacingMult
          : config.clusterSpread *
            1.12 *
            spacingMult *
            (0.55 + (1 - tier * 0.22) * (0.35 + rand() * 0.35));
      px += Math.cos(angle) * ringR;
      pz += Math.sin(angle) * ringR;
      py += (tier - 0.65) * config.verticalSpread * 0.72 + (rand() - 0.5) * 0.16;
    } else {
      const drift = (0.28 + t * 0.95) * config.clusterSpread * spacingMult;
      const sideJitter = (rand() - 0.5) * config.clusterSpread * spacingMult * 0.9;
      px += Math.cos(windDirAngle) * drift - Math.sin(windDirAngle) * sideJitter;
      pz += Math.sin(windDirAngle) * drift + Math.cos(windDirAngle) * sideJitter;
      py += (isHero ? 0.26 : (rand() - 0.42) * 0.95) * config.verticalSpread;
    }

    // 2. When branch attachment is active, seat branch puffs cleanly onto prominent main branches!
    if (assignedBranch) {
      // Cradle the puff around the outer 78% of the branch (between mid and tip) so wood flows directly into foliage
      const seat = assignedBranch.mid.clone().lerp(assignedBranch.tip, 0.72);
      const subOffsetR =
        branchSubIdx > 0 ? baseSize * (0.48 + (1 - config.overlapTightness) * 0.38) : baseSize * 0.14;
      const subAngle = assignedBranch.yaw + (branchSubIdx % 2 === 0 ? 0.75 : -0.75) + (rand() - 0.5) * 0.6;

      const bx = seat.x + Math.cos(subAngle) * subOffsetR;
      const bz = seat.z + Math.sin(subAngle) * subOffsetR;
      // Follow branch elevation while honoring user canopyHeight adjustment gently
      const by =
        seat.y +
        sy * 0.32 +
        crownHeightOffset * 0.42 +
        (branchSubIdx > 0 ? (rand() - 0.35) * 0.28 : 0.08);

      px = THREE.MathUtils.lerp(px, bx, branchAttach);
      py = THREE.MathUtils.lerp(py, by, branchAttach);
      pz = THREE.MathUtils.lerp(pz, bz, branchAttach);
    }

    rawPuffs.push({
      x: px,
      y: py,
      z: pz,
      sx,
      sy,
      sz,
      rx: (rand() - 0.5) * 2 * tiltRad,
      ry: rand() * Math.PI * 2,
      rz: (rand() - 0.5) * 2 * tiltRad,
      microHue: (rand() - 0.5) * 2 * (config.hueVariation / 360) * 0.45,
      microVal: (rand() - 0.5) * 2 * config.valueVariation * 0.45,
    });
  }

  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of rawPuffs) {
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const spanY = Math.max(0.25, maxY - minY);

  const puffs: CanopyPuffTransform[] = rawPuffs.map((p) => {
    const heightNorm = ((p.y - minY) / spanY) * 2 - 1;
    const sunVal = heightNorm * config.sunCrownGradient * 0.34;
    const sunHue = heightNorm * config.sunCrownGradient * -0.025;

    return {
      x: p.x,
      y: p.y,
      z: p.z,
      scaleX: p.sx,
      scaleY: p.sy,
      scaleZ: p.sz,
      rotX: p.rx,
      rotY: p.ry,
      rotZ: p.rz,
      hsvShift: [
        baseHueNorm + treeHueOffset + p.microHue + sunHue,
        config.saturationShift,
        config.valueShift + treeValOffset + p.microVal + sunVal,
      ],
    };
  });

  return { puffs, crownBaseY };
}

/**
 * Patches any standard/toon/physical material with perceptual GPU RGB<->HSV color shifting
 * + living wind sway shader!
 */
export function patchCanopyMaterial(
  mat: THREE.Material,
  opts: {
    instanced: boolean;
    timeUniform: { value: number };
    windAmp: number;
    weatherWindUniform?: { value: number };
    uniformHsvShift?: THREE.Vector3;
    windTipFactor?: number;
    enableVertexPaintHsv?: boolean;
  }
): NodeMaterial {
  const {
    instanced,
    timeUniform,
    windAmp,
    weatherWindUniform = DEFAULT_WEATHER_WIND_UNIFORM,
    uniformHsvShift,
    windTipFactor = 0.065,
    enableVertexPaintHsv = false,
  } = opts;

  const hadVertexColors = Boolean((mat as THREE.MeshStandardMaterial).vertexColors);
  const nodeMat = upgradeToNodeMaterial(mat);
  if (nodeMat !== mat) {
    mat.dispose();
  }

  if (enableVertexPaintHsv) {
    nodeMat.userData.hasVertexPaintHsv = true;
  }

  // Store per-material parameters on userData and read them via materialReference so every
  // puff and tree shares ONE compiled WGSL shader instead of compiling 200-400 unique pipelines.
  nodeMat.userData.uWindAmp = windAmp;
  nodeMat.userData.uWindTipFactor = windTipFactor;
  nodeMat.userData.uHsvShift = (uniformHsvShift ?? _defaultZeroVec3).clone();

  const uTime = asFloatUniformNode(timeUniform);
  const uWeatherWind = asFloatUniformNode(weatherWindUniform);
  const timeId = getUniformObjId(uTime);
  const windId = getUniformObjId(uWeatherWind);

  const posKey = `${instanced ? 'i' : 'u'}|${timeId}|${windId}`;
  let cachedPosNode = _canopyPosNodeCache.get(posKey);
  if (!cachedPosNode) {
    const uWindAmp = safeMaterialReference('userData.uWindAmp', 'float', 0) as unknown as ReturnType<
      typeof float
    >;
    const uWindScale = safeMaterialReference(
      'userData.uWindTipFactor',
      'float',
      0.065
    ) as unknown as ReturnType<typeof float>;
    const cEffWind = uWindAmp.mul(uWeatherWind);

    const cOrigin = instanced
      ? modelWorldMatrix.mul(vec4(positionLocal.sub(positionGeometry), 1.0)).xyz
      : modelWorldMatrix.mul(vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    const cPhase = cOrigin.x
      .mul(0.42)
      .add(cOrigin.z.mul(0.37))
      .add(cOrigin.y.mul(0.65))
      .add(positionGeometry.y.mul(0.7));
    const cRadial = clamp(length(vec2(positionGeometry.x, positionGeometry.z)).mul(0.65).add(0.35), 0.25, 1.6);
    const cGust = sin(uTime.mul(1.9).add(cPhase)).add(sin(uTime.mul(3.4).add(cPhase.mul(1.35))).mul(0.38));
    const dx = cGust.mul(cEffWind).mul(uWindScale).mul(cRadial);
    const dz = cos(uTime.mul(1.5).add(cPhase.mul(0.9))).mul(cEffWind).mul(uWindScale.mul(0.72)).mul(cRadial);
    const dy = sin(uTime.mul(2.3).add(cPhase)).mul(cEffWind).mul(uWindScale.mul(0.25)).mul(cRadial);
    cachedPosNode = positionLocal.add(vec3(dx, dy, dz)) as unknown as ReturnType<typeof vec3>;
    _canopyPosNodeCache.set(posKey, cachedPosNode);
  }
  nodeMat.positionNode = cachedPosNode;

  if (hadVertexColors) {
    nodeMat.vertexColors = false;
    nodeMat.userData._vpBakedVertexColors = true;
  }

  const colKey = `${hadVertexColors ? 'vc' : 'nvc'}|${instanced ? 'i' : 'u'}|${enableVertexPaintHsv ? 'vp2' : 'nvp'}`;
  let cachedColorNode = _canopyColorNodeCache.get(colKey);
  if (!cachedColorNode) {
    const rgbNode = hadVertexColors
      ? materialColor.rgb.mul(vertexColor().rgb)
      : materialColor.rgb;
    const baseShift = instanced
      ? attribute('aHsvShift', 'vec3')
      : (safeMaterialReference('userData.uHsvShift', 'vec3', _defaultZeroVec3) as unknown as ReturnType<
          typeof vec3
        >);
    const totalShift = enableVertexPaintHsv
      ? baseShift.add(attribute('aPaintHsv', 'vec3'))
      : baseShift;

    const shiftedRgb = applyHsvShiftLinearTsl(rgbNode, totalShift);
    const degradedRgb = enableVertexPaintHsv
      ? applyDegradeLayersTsl(
          shiftedRgb.rgb,
          attribute('aDegrade0', 'vec4').x,
          attribute('aDegrade0', 'vec4').y,
          attribute('aDegrade0', 'vec4').z,
          attribute('aDegrade0', 'vec4').w,
          attribute('aDegrade1', 'vec4').x,
          attribute('aDegrade1', 'vec4').y,
          attribute('aDegrade1', 'vec4').z,
          attribute('aDegrade1', 'vec4').w,
          attribute('aDegradeWet', 'float')
        )
      : shiftedRgb.rgb;
    const uWearFactor = safeMaterialReference('userData.uWearFactor', 'float', 0) as unknown as ReturnType<typeof float>;
    const finalRgb = applyWearDingsScratchesTsl(degradedRgb, clamp(uWearFactor, 0.0, 1.0));
    cachedColorNode = vec4(finalRgb, materialOpacity);
    _canopyColorNodeCache.set(colKey, cachedColorNode);
  }
  nodeMat.colorNode = cachedColorNode;

  if (enableVertexPaintHsv && 'roughnessNode' in nodeMat) {
    const deg0 = attribute('aDegrade0', 'vec4');
    const deg1 = attribute('aDegrade1', 'vec4');
    const degWet = attribute('aDegradeWet', 'float');
    (nodeMat as unknown as { roughnessNode: unknown }).roughnessNode = applyDegradeRoughnessTsl(
      materialRoughness,
      deg0.x,
      deg0.y,
      deg0.z,
      deg0.w,
      deg1.x,
      deg1.y,
      deg1.z,
      deg1.w,
      degWet
    );
  }

  nodeMat.userData.__canopyWeatherReady = true;
  if (typeof nodeMat.userData.uWearFactor !== 'number') {
    nodeMat.userData.uWearFactor = 0;
  }

  attachBotwPainterlyShader(nodeMat, {
    isFoliage: true,
    rimStrengthScale: 0.9,
    shadowLiftScale: 0.85,
    translucencyScale: 1.0,
  });
  nodeMat.needsUpdate = true;
  return nodeMat;
}

function adaptMaterialForStyle(
  src: THREE.Material,
  style: VisualStyleId,
  bumpStrength = 0
): THREE.Material {
  const cloned = src.clone();
  const std = cloned as THREE.MeshStandardMaterial;

  // Derive a crisp Sobel tangent-space normal map from the diffuse texture when Bump Strength > 0
  if (bumpStrength > 0.01) {
    if (std.map && !std.normalMap) {
      const derivedNormal = deriveNormalMapFromImageTexture(std.map);
      if (derivedNormal) {
        std.normalMap = derivedNormal;
      } else {
        std.bumpMap = std.map;
        std.bumpScale = bumpStrength * 0.45;
      }
    }
    if (std.normalMap) {
      const nScale = bumpStrength * 2.4;
      std.normalScale = new THREE.Vector2(nScale, nScale);
    } else if (std.bumpMap) {
      std.bumpScale = bumpStrength * 0.45;
    }
  } else {
    if (std.normalMap) {
      std.normalScale = new THREE.Vector2(0, 0);
    }
    if (std.bumpMap) {
      std.bumpScale = 0;
    }
  }

  const adapted = adaptMaterialForVisualStyle(cloned, style, {
    isFoliage: true,
    rimStrengthScale: 0.9,
    shadowLiftScale: 0.85,
  });
  if (adapted !== cloned) {
    cloned.dispose();
  }
  return adapted;
}

/**
 * Extracts normalized unit-radius primitives from an imported GLB (canopy sphere or fruit),
 * or builds a rich textured Oak/Fantasy sculpted canopy puff with texture-guided bump!
 */
export function extractNormalizedCanopyPrimitives(
  assetId: string | undefined,
  style: VisualStyleId,
  config: StylizedCanopyConfig,
  fallbackBaseColor?: string,
  sceneryTextures?: Partial<Record<SceneryTextureSlot, SurfaceTextureSettings>>
): NormalizedCanopyPrimitive[] {
  const bumpStrength = config.foliageBumpStrength ?? 0.42;
  const customCanopyTex =
    config.canopyTexture?.enabled && config.canopyTexture.textureId
      ? config.canopyTexture
      : sceneryTextures?.treeCanopy?.enabled && sceneryTextures.treeCanopy.textureId
      ? sceneryTextures.treeCanopy
      : undefined;

  if (assetId) {
    const cached = getCachedAssetSync(assetId);
    if (cached) {
      cached.scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(cached.scene);
      if (!box.isEmpty()) {
        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        box.getCenter(center);
        box.getSize(size);
        const radius = Math.max(0.001, Math.max(size.x, size.y, size.z) * 0.5);
        const invScale = 1 / radius;

        const normMatrix = new THREE.Matrix4()
          .makeScale(invScale, invScale, invScale)
          .multiply(new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z));

        const primitives: NormalizedCanopyPrimitive[] = [];
        cached.scene.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (!mesh.isMesh || !mesh.geometry) return;
          const geo = mesh.geometry.clone();
          const bake = normMatrix.clone().multiply(mesh.matrixWorld);
          geo.applyMatrix4(bake);
          if (!geo.attributes.normal) {
            geo.computeVertexNormals();
          }

          const rawMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
          const mat = rawMat
            ? adaptMaterialForStyle(rawMat, style, bumpStrength)
            : new THREE.MeshStandardMaterial({
                color: fallbackBaseColor ?? config.foliageBaseColor ?? '#56A946',
                roughness: 0.78,
              });

          // Allow custom seamless canopy texture to skin uploaded GLB treetop spheres too!
          if (
            customCanopyTex &&
            (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshToonMaterial)
          ) {
            applySurfaceTextureToMaterial(mat, customCanopyTex, {
              baseTintHex: fallbackBaseColor ?? config.foliageBaseColor ?? '#4EA343',
              isToon: style === 'celToon',
            });
          }

          primitives.push({
            geometry: geo,
            material: mat,
            isFallback: false,
          });
        });

        if (primitives.length > 0) {
          return primitives;
        }
      }
    }
  }

  // Stylized sculpted foliage puff using custom seamless texture, clean leaf-free grain/noise base, OR procedural foliage!
  const texStyle = config.foliageTextureStyle ?? 'cleanBase';
  const baseColor = fallbackBaseColor ?? config.foliageBaseColor ?? '#4EA343';
  const geo = createSculptedCanopyLobeGeometry(1.0, 1.0, 1.0, 1.0, 2.4, 20, 14, 2.4, 1.8);
  const isFantasy = config.treeType === 'fantasy';

  if (customCanopyTex) {
    const customMat =
      style === 'celToon'
        ? new THREE.MeshToonMaterial({
            color: '#FFFFFF',
            gradientMap: getTerrainTextureAtlas().toonGradient,
          })
        : new THREE.MeshStandardMaterial({
            color: '#FFFFFF',
            roughness: customCanopyTex.roughness ?? (isFantasy ? 0.72 : 0.88),
            metalness: isFantasy ? 0.04 : 0.0,
            envMapIntensity: isFantasy ? 0.5 : 0.32,
            emissive: isFantasy ? new THREE.Color('#2E648F') : new THREE.Color('#000000'),
            emissiveIntensity: isFantasy ? 0.25 : 0,
          });
    if (
      applySurfaceTextureToMaterial(customMat, customCanopyTex, {
        baseTintHex: baseColor,
        isToon: style === 'celToon',
      })
    ) {
      return [{ geometry: geo, material: customMat, isFallback: true }];
    }
    customMat.dispose();
  }

  if (texStyle === 'cleanBase') {
    const pattern = config.canopyBasePattern ?? 'noise';
    const grainStr = config.canopyBaseGrainStrength ?? 0.42;
    const grainScale = config.canopyBaseGrainScale ?? 1.2;
    const { map, normalMap } = getProceduralCanopyBaseTextures(pattern, grainStr, grainScale);
    const nScale = bumpStrength * 0.95;
    const mat =
      style === 'celToon'
        ? new THREE.MeshToonMaterial({
            color: '#FFFFFF',
            vertexColors: true,
            map,
            normalMap: bumpStrength > 0.01 ? normalMap : null,
            normalScale: new THREE.Vector2(nScale * 0.8, nScale * 0.8),
            gradientMap: getTerrainTextureAtlas().toonGradient,
          })
        : new THREE.MeshStandardMaterial({
            color: '#FFFFFF',
            vertexColors: true,
            map,
            normalMap: bumpStrength > 0.01 ? normalMap : null,
            normalScale: new THREE.Vector2(nScale, nScale),
            roughness: isFantasy ? 0.72 : 0.88,
            metalness: isFantasy ? 0.04 : 0.0,
            envMapIntensity: isFantasy ? 0.5 : 0.32,
            emissive: isFantasy ? new THREE.Color('#26557B') : new THREE.Color('#000000'),
            emissiveIntensity: isFantasy ? 0.22 : 0,
          });
    mat.userData.isCleanCanopyBase = true;
    return [{ geometry: geo, material: mat, isFallback: true }];
  }

  const { map, normalMap } = getProceduralFoliageTextures(texStyle, baseColor);
  const nScale = bumpStrength * 1.0;
  const mat =
    style === 'celToon'
      ? new THREE.MeshToonMaterial({
          color: '#FFFFFF',
          map,
          normalMap: bumpStrength > 0.01 ? normalMap : null,
          normalScale: new THREE.Vector2(nScale * 0.8, nScale * 0.8),
          gradientMap: getTerrainTextureAtlas().toonGradient,
        })
      : new THREE.MeshStandardMaterial({
          color: '#FFFFFF',
          map,
          normalMap: bumpStrength > 0.01 ? normalMap : null,
          normalScale: new THREE.Vector2(nScale, nScale),
          roughness: isFantasy ? 0.72 : 0.86,
          metalness: isFantasy ? 0.04 : 0.0,
          envMapIntensity: isFantasy ? 0.5 : 0.32,
          emissive: isFantasy ? new THREE.Color('#2E648F') : new THREE.Color('#000000'),
          emissiveIntensity: isFantasy ? 0.25 : 0,
        });

  return [{ geometry: geo, material: mat, isFallback: true }];
}

/**
 * Builds a single closed, plump, pillowy 3D stylized pine leaf-lobe growing along +Z
 * with verified outward triangle winding, rounded tip dome, and vivid per-vertex gradient!
 */
function createSculptedPineLobeGeometry(opts: {
  length: number;
  width: number;
  thickness: number;
  droopDrop: number;
  archLift: number;
  lengthSegs?: number;
  radialSegs?: number;
  fullUnderside?: boolean;
}): THREE.BufferGeometry {
  const {
    length,
    width,
    thickness,
    droopDrop,
    archLift,
    lengthSegs = 5,
    radialSegs = 6,
    fullUnderside = false,
  } = opts;

  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  // Ring vertices along spine s in [0..1)
  for (let r = 0; r <= lengthSegs; r++) {
    const s = r / lengthSegs;
    const zPos = s * length;

    // Soft arched cushion spine: rises gently near shoulder, then sweeps up or drapes smoothly downward
    const spineY = archLift * Math.sin(s * Math.PI * 0.78) - droopDrop * Math.pow(s, 1.48);

    // Paddle-shaped plump silhouette with a soft rounded pill tip (never needle-sharp!)
    const baseSwell = 0.42 + 0.58 * Math.sin(Math.min(1, s * 1.45) * Math.PI * 0.5);
    const tipRound = r === lengthSegs ? 0.24 : Math.sin(Math.pow(1 - s * 0.94, 0.52) * Math.PI * 0.5);
    const rx = Math.max(0.018, width * 0.5 * baseSwell * tipRound);

    const thickProfile =
      r === lengthSegs
        ? 0.22
        : (0.58 + 0.48 * Math.sin(s * Math.PI * 0.86)) * Math.pow(1 - s * 0.76, 0.36);
    const ry = Math.max(0.016, thickness * 0.5 * thickProfile);

    for (let j = 0; j <= radialSegs; j++) {
      const uFrac = j / radialSegs;
      const theta = uFrac * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      // Plump domed upper ridge, fuller underside when leaves tilt upward so both sides read sculptural
      const domeMult = sinT >= 0 ? 1.14 + 0.08 * sinT * sinT : fullUnderside ? 0.92 : 0.76;
      const px = cosT * rx;
      const py = spineY + sinT * ry * domeMult;
      const pz = zPos;

      positions.push(px, py, pz);
      uvs.push(uFrac * 1.4, s * 1.6);
      colors.push(1, 1, 1);
    }
  }

  // Verified outward-facing tube quads: (a, b, d) & (b, c, d)
  const stride = radialSegs + 1;
  for (let r = 0; r < lengthSegs; r++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = r * stride + j;
      const b = r * stride + j + 1;
      const c = (r + 1) * stride + j + 1;
      const d = (r + 1) * stride + j;
      indices.push(a, b, d, b, c, d);
    }
  }

  // Rounded tip dome apex (+Z outward)
  const tipY = archLift * Math.sin(Math.PI * 0.78) - droopDrop - thickness * 0.02;
  const tipZ = length + Math.min(width, thickness) * 0.16;
  const tipIdx = positions.length / 3;
  positions.push(0, tipY, tipZ);
  uvs.push(0.5, 1.65);
  colors.push(1, 1, 1);

  const lastRing = lengthSegs * stride;
  for (let j = 0; j < radialSegs; j++) {
    indices.push(lastRing + j, lastRing + j + 1, tipIdx);
  }

  // Base cap (-Z outward, tucked cleanly inside trunk)
  const baseIdx = positions.length / 3;
  positions.push(0, 0, -thickness * 0.12);
  uvs.push(0.5, 0);
  colors.push(1, 1, 1);

  for (let j = 0; j < radialSegs; j++) {
    indices.push(baseIdx, j + 1, j);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

const _srgbA = { r: 0, g: 0, b: 0 };
const _srgbB = { r: 0, g: 0, b: 0 };

/**
 * Perceptual sRGB-space color interpolation converted back into Three.js linear RGB,
 * so top-to-bottom gradients look genuinely 50/50 balanced and vivid across any color pair.
 */
function lerpColorSRGB(a: THREE.Color, b: THREE.Color, t: number, out: THREE.Color): THREE.Color {
  const clamped = THREE.MathUtils.clamp(t, 0, 1);
  a.getRGB(_srgbA, THREE.SRGBColorSpace);
  b.getRGB(_srgbB, THREE.SRGBColorSpace);
  out.setRGB(
    _srgbA.r + (_srgbB.r - _srgbA.r) * clamped,
    _srgbA.g + (_srgbB.g - _srgbA.g) * clamped,
    _srgbA.b + (_srgbB.b - _srgbA.b) * clamped,
    THREE.SRGBColorSpace
  );
  return out;
}

/**
 * Builds a single lush stylized 3D Pine Frond-Bough composed of 5 (or 3) overlapping plump
 * fanned leaf-lobes with crisp scalloped shadow valleys.
 */
function createSculptedPineFrondGeometry(opts: {
  length: number;
  width: number;
  thickness: number;
  droop: number;
  shape: ConiferShapeStyle;
  lobeCount: 3 | 5;
  rand: () => number;
}): THREE.BufferGeometry {
  const { length, width, thickness, droop, shape, lobeCount, rand } = opts;

  // Shape modifies droop subtly while preserving full -1 (nearly vertical up) .. +1 (heavy downward droop) authority
  const shapeDroopOffset =
    shape === 'weeping'
      ? 0.16
      : shape === 'snowDroop'
      ? 0.12
      : shape === 'spire'
      ? 0.06
      : 0;
  const effectiveDroop =
    droop < 0
      ? droop
      : shape === 'flatBough'
      ? droop * 0.45
      : THREE.MathUtils.clamp(droop + shapeDroopOffset * droop, -1, 1.15);

  // Upward spread (< 0) curves gently skyward; level (0) is flat; downward (> 0) drapes naturally
  const archLift =
    effectiveDroop < 0
      ? length * (0.04 + Math.abs(effectiveDroop) * 0.05)
      : shape === 'flatBough'
      ? length * 0.06
      : length * 0.11;

  const droopDrop =
    effectiveDroop < 0
      ? length * (effectiveDroop * 0.24)
      : length * (0.06 + effectiveDroop * 0.54);

  const fullUnderside = droop < -0.15;

  const lobeSpecs =
    lobeCount === 5
      ? [
          // Central plump hero lobe
          { yaw: 0.0, lenM: 1.0, widM: 0.44, thkM: 1.0, yOff: 0.024, zStart: 0.0, pitchOff: 0.0 },
          // Inner flanking scallops
          { yaw: 0.34, lenM: 0.87, widM: 0.37, thkM: 0.88, yOff: -0.008, zStart: 0.05, pitchOff: 0.04 },
          { yaw: -0.34, lenM: 0.87, widM: 0.37, thkM: 0.88, yOff: -0.008, zStart: 0.05, pitchOff: 0.04 },
          // Outer shoulder scallops
          { yaw: 0.66, lenM: 0.68, widM: 0.31, thkM: 0.74, yOff: -0.036, zStart: 0.09, pitchOff: 0.08 },
          { yaw: -0.66, lenM: 0.68, widM: 0.31, thkM: 0.74, yOff: -0.036, zStart: 0.09, pitchOff: 0.08 },
        ]
      : [
          // Compact 3-lobe upper/narrow scallop frond
          { yaw: 0.0, lenM: 1.0, widM: 0.52, thkM: 1.0, yOff: 0.018, zStart: 0.0, pitchOff: 0.0 },
          { yaw: 0.38, lenM: 0.82, widM: 0.42, thkM: 0.84, yOff: -0.014, zStart: 0.04, pitchOff: 0.05 },
          { yaw: -0.38, lenM: 0.82, widM: 0.42, thkM: 0.84, yOff: -0.014, zStart: 0.04, pitchOff: 0.05 },
        ];

  const pitchDirSign = droop < 0 ? -0.5 : 1.0;

  const parts: THREE.BufferGeometry[] = [];
  for (const spec of lobeSpecs) {
    const lenJitter = 0.94 + rand() * 0.12;
    const widJitter = 0.94 + rand() * 0.12;
    const lobeGeo = createSculptedPineLobeGeometry({
      length: length * spec.lenM * lenJitter,
      width: width * spec.widM * widJitter,
      thickness: thickness * spec.thkM,
      droopDrop: droopDrop * spec.lenM,
      archLift: archLift * spec.lenM,
      lengthSegs: 5,
      radialSegs: 6,
      fullUnderside,
    });

    if (Math.abs(spec.pitchOff) > 0.001) {
      lobeGeo.rotateX(spec.pitchOff * pitchDirSign);
    }
    lobeGeo.rotateY(spec.yaw + (rand() - 0.5) * 0.05);
    lobeGeo.translate(0, spec.yOff * length, spec.zStart * length);
    parts.push(lobeGeo);
  }

  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return (
    merged ??
    createSculptedPineLobeGeometry({
      length,
      width: width * 0.5,
      thickness,
      droopDrop,
      archLift,
      fullUnderside,
    })
  );
}

/**
 * Builds the wind-animated sculpted Stylized Pine / Conifer canopy made of distinct shingled
 * whorls of plump sculpted fronds + a soft pointed apex bud crown.
 * Supports:
 * - True post-transform world-Y Per-Tier Top-to-Bottom Gradient on EVERY individual tier
 * - Whole-Tree Top-to-Bottom Gradient spanning across ALL tiers as a whole
 * - Full bidirectional Leaf Angle / Droop (-1 nearly vertical upward .. 0 horizontal .. +1 steep droop)
 * - Configurable Leaves per Tier (circumference count 3..16)
 * - Layer Scarcity, Evergreen Shapes, and crisp Normal-Mapped Needle Relief
 */
function buildConiferCanopyGroup(
  config: StylizedCanopyConfig,
  base: BuiltTreeBase,
  treeKey: string,
  style: VisualStyleId,
  timeUniform: { value: number },
  sceneryTextures?: Partial<Record<SceneryTextureSlot, SurfaceTextureSettings>>,
  enableVertexPaint = false,
  weatherWindUniform: { value: number } = DEFAULT_WEATHER_WIND_UNIFORM
): { group: THREE.Group; colorHex: string } {
  const rand = createTreePrng(hashTreeSeed(`${treeKey}_conifer`, config.seed));
  const group = new THREE.Group();

  const tierCount = Math.max(3, Math.min(11, Math.round(config.coniferTiers ?? 8)));
  const leavesPerTier = Math.max(3, Math.min(16, Math.round(config.coniferLeavesPerTier ?? 7)));
  const shape: ConiferShapeStyle = config.coniferShape ?? 'classic';
  const scarcity = THREE.MathUtils.clamp(config.coniferScarcity ?? 0.16, 0, 1);
  const droop = THREE.MathUtils.clamp(config.coniferDroop ?? 0.34, -1.0, 1.0);
  const widthScale = Math.max(0.5, config.coniferWidth ?? 1.52);

  const perTierStrength = THREE.MathUtils.clamp(config.coniferGradientStrength ?? 0.92, 0, 1);
  const wholeStrength = THREE.MathUtils.clamp(config.coniferWholeGradientStrength ?? 0, 0, 1);

  const tierTopCol = new THREE.Color(config.coniferTopColor ?? '#98D45A');
  const tierBottomCol = new THREE.Color(config.coniferBottomColor ?? '#254F24');
  const wholeTopCol = new THREE.Color(config.coniferWholeTopColor ?? '#B8EA5C');
  const wholeBottomCol = new THREE.Color(config.coniferWholeBottomColor ?? '#173A24');

  const atlas = getTerrainTextureAtlas();
  const baseHueNorm = config.hueShift / 360;
  const treeHueJitter = (rand() - 0.5) * 2 * (config.hueVariation / 360);
  const treeValJitter = (rand() - 0.5) * 2 * config.valueVariation;

  // Lowest whorl starts warmly above the trunk base so the flared pine trunk peeks below the bottom skirt
  const crownStartY = Math.max(
    0.55,
    Math.min(base.trunkTopY * 0.68, (config.canopyHeight ?? 1.25) * 0.72)
  );
  const crownTopY = base.trunkTopY + 0.65 + scarcity * 0.75;
  const spanY = Math.max(1.6, crownTopY - crownStartY);

  // Bidirectional leaf pitch angle:
  // droop = -1.0 -> -1.34 rad (~77 deg upward, nearly vertical!)
  // droop =  0.0 ->  0.00 rad (level horizontal spread)
  // droop = +1.0 -> +1.08..+1.26 rad (steep downward droop)
  const maxDownPitch =
    shape === 'flatBough'
      ? 0.68
      : shape === 'weeping'
      ? 1.24
      : shape === 'snowDroop'
      ? 1.18
      : shape === 'spire'
      ? 1.12
      : 1.04;
  const basePitch =
    droop < 0
      ? THREE.MathUtils.lerp(0.0, -1.34, Math.abs(droop))
      : THREE.MathUtils.lerp(0.0, maxDownPitch, droop);

  // Keep leaves distinct and crisp whether user picks 3 or 16 around the circumference
  const widthDensityScale = THREE.MathUtils.clamp(Math.sqrt(7 / leavesPerTier), 0.58, 1.35);

  interface TierBucket {
    geos: THREE.BufferGeometry[];
    spineX: number;
    spineZ: number;
    innerExcludeR: number;
  }
  const tierBuckets: TierBucket[] = [];
  const baseAzimuth = rand() * Math.PI * 2;

  for (let i = 0; i < tierCount; i++) {
    const frac = tierCount > 1 ? i / (tierCount - 1) : 1; // 0 = widest bottom skirt, 1 = upper crown
    const yCenter = crownStartY + frac * spanY;

    // Shape-aware radial silhouette envelope from wide bottom boughs to tapered spire
    let radiusEnv = Math.pow(1 - frac * 0.84, 0.82);
    if (shape === 'spire') radiusEnv = Math.pow(1 - frac * 0.88, 1.12) * 0.74;
    if (shape === 'flatBough') radiusEnv = (0.34 + (1 - frac) * 0.76) * 1.14;
    if (shape === 'weeping') radiusEnv = Math.pow(1 - frac * 0.8, 0.76) * 1.04;
    if (shape === 'snowDroop') radiusEnv = Math.pow(1 - frac * 0.83, 0.86) * 0.98;

    const boughLen = Math.max(0.32, widthScale * radiusEnv * 1.08);
    const frondWidth = boughLen * THREE.MathUtils.lerp(0.86, 0.74, scarcity) * widthDensityScale;
    const frondThick = Math.max(
      0.11,
      boughLen *
        THREE.MathUtils.lerp(0.24, 0.17, scarcity) *
        (shape === 'flatBough' ? 0.8 : 1.0) *
        THREE.MathUtils.clamp(Math.pow(7 / leavesPerTier, 0.25), 0.76, 1.16)
    );

    const trunkFrac = THREE.MathUtils.clamp(yCenter / Math.max(0.5, base.trunkTopY), 0, 1);
    const spinePt = base.trunkCurve.getPointAt(trunkFrac);
    const trunkR = Math.max(0.05, 0.2 * (1 - trunkFrac * 0.75) * (config.trunkThickness ?? 0.86));

    // Honor user's Leaves per Tier across the circumference, gently scaling only near the very tip
    const tipTaper = frac > 0.74 ? THREE.MathUtils.lerp(1.0, 0.6, (frac - 0.74) / 0.26) : 1.0;
    const frondsInRing = Math.max(3, Math.round(leavesPerTier * tipTaper));

    const useFiveLobes: 3 | 5 = frac < 0.74 && leavesPerTier <= 11 ? 5 : 3;
    const tierTwist = baseAzimuth + i * 0.58 + (i % 2) * (Math.PI / frondsInRing);

    const bucketGeos: THREE.BufferGeometry[] = [];

    for (let f = 0; f < frondsInRing; f++) {
      const azimuth =
        tierTwist +
        (f / frondsInRing) * Math.PI * 2 +
        (rand() - 0.5) * Math.min(0.16, (Math.PI * 0.35) / frondsInRing);
      const lenVar = 0.9 + rand() * 0.2;
      const widVar = 0.93 + rand() * 0.14;

      const frondGeo = createSculptedPineFrondGeometry({
        length: boughLen * lenVar,
        width: frondWidth * widVar,
        thickness: frondThick,
        droop,
        shape,
        lobeCount: useFiveLobes,
        rand,
      });

      // Slight organic pitch/roll variation (tighter when near-vertical so leaves stay cleanly upright)
      const pitchJitter = (rand() - 0.5) * (Math.abs(droop) > 0.75 ? 0.06 : 0.11);
      const roll = (rand() - 0.5) * 0.12;
      frondGeo.rotateZ(roll);
      frondGeo.rotateX(basePitch + pitchJitter);
      frondGeo.rotateY(azimuth);

      const attachR = trunkR * (droop < -0.35 ? 0.75 : 0.55);
      const yJitter = (rand() - 0.5) * (spanY / tierCount) * 0.14;
      frondGeo.translate(
        spinePt.x + Math.sin(azimuth) * attachR,
        yCenter + yJitter,
        spinePt.z + Math.cos(azimuth) * attachR
      );
      bucketGeos.push(frondGeo);
    }

    tierBuckets.push({
      geos: bucketGeos,
      spineX: spinePt.x,
      spineZ: spinePt.z,
      innerExcludeR: trunkR * 0.85,
    });
  }

  // Soft sculpted pointed Apex Bud Crown at the very top (treated as the top tier bucket!)
  const apexPt = base.trunkCurve.getPointAt(1);
  const apexY = crownTopY + 0.08;
  const apexGeos: THREE.BufferGeometry[] = [];
  const budCount = Math.max(3, Math.min(7, Math.round(leavesPerTier * 0.65)));
  for (let b = 0; b < budCount; b++) {
    const az = baseAzimuth + (b / budCount) * Math.PI * 2;
    const budGeo = createSculptedPineLobeGeometry({
      length: 0.36 + rand() * 0.08,
      width: 0.24,
      thickness: 0.15,
      droopDrop: 0.04,
      archLift: 0.06,
      lengthSegs: 4,
      radialSegs: 6,
      fullUnderside: true,
    });
    budGeo.rotateX(-0.78);
    budGeo.rotateY(az);
    budGeo.translate(
      apexPt.x + Math.sin(az) * 0.05,
      apexY - 0.06,
      apexPt.z + Math.cos(az) * 0.05
    );
    apexGeos.push(budGeo);
  }

  const finialGeo = createSculptedPineLobeGeometry({
    length: 0.46,
    width: 0.26,
    thickness: 0.24,
    droopDrop: 0,
    archLift: 0,
    lengthSegs: 4,
    radialSegs: 6,
    fullUnderside: true,
  });
  finialGeo.rotateX(-Math.PI / 2);
  finialGeo.translate(apexPt.x, apexY + 0.04, apexPt.z);
  apexGeos.push(finialGeo);

  tierBuckets.push({
    geos: apexGeos,
    spineX: apexPt.x,
    spineZ: apexPt.z,
    innerExcludeR: 0,
  });

  // --- PASS 1: Measure exact post-transform world-Y bounds per tier AND across the whole crown ---
  let crownMinY = Infinity;
  let crownMaxY = -Infinity;

  const bucketBounds = tierBuckets.map((bucket) => {
    let extMinY = Infinity;
    let extMaxY = -Infinity;
    let allMinY = Infinity;
    let allMaxY = -Infinity;
    const exR2 = bucket.innerExcludeR * bucket.innerExcludeR;

    for (const geo of bucket.geos) {
      const pos = geo.attributes.position as THREE.BufferAttribute;
      for (let v = 0; v < pos.count; v++) {
        const vx = pos.getX(v);
        const vy = pos.getY(v);
        const vz = pos.getZ(v);
        if (vy < allMinY) allMinY = vy;
        if (vy > allMaxY) allMaxY = vy;
        if (vy < crownMinY) crownMinY = vy;
        if (vy > crownMaxY) crownMaxY = vy;
        const dx = vx - bucket.spineX;
        const dz = vz - bucket.spineZ;
        if (dx * dx + dz * dz >= exR2) {
          if (vy < extMinY) extMinY = vy;
          if (vy > extMaxY) extMaxY = vy;
        }
      }
    }

    const useExt = extMaxY > extMinY + 0.02;
    return {
      minY: useExt ? extMinY : allMinY,
      maxY: useExt ? extMaxY : allMaxY,
    };
  });

  const crownSpanY = Math.max(0.05, crownMaxY - crownMinY);

  // --- PASS 2: Paint crisp, vivid Per-Tier AND Whole-Tree top-to-bottom vertex gradients ---
  const tierMidCol = lerpColorSRGB(tierTopCol, tierBottomCol, 0.5, new THREE.Color());
  const tierGradCol = new THREE.Color();
  const perTierResult = new THREE.Color();
  const wholeGradCol = new THREE.Color();
  const finalCol = new THREE.Color();

  const frondParts: THREE.BufferGeometry[] = [];

  tierBuckets.forEach((bucket, bIdx) => {
    const { minY, maxY } = bucketBounds[bIdx];
    const tierSpanY = Math.max(0.02, maxY - minY);

    for (const geo of bucket.geos) {
      const pos = geo.attributes.position as THREE.BufferAttribute;
      const colAttr = geo.attributes.color as THREE.BufferAttribute;

      for (let v = 0; v < pos.count; v++) {
        const vy = pos.getY(v);

        // 0 = exact top of THIS tier, 1 = exact bottom of THIS tier
        const rawTierT = 1 - THREE.MathUtils.clamp((vy - minY) / tierSpanY, 0, 1);
        const tierT = THREE.MathUtils.clamp((rawTierT - 0.06) / 0.88, 0, 1);

        // 0 = very top of WHOLE conifer tree, 1 = very bottom of lowest tier
        const rawWholeT = 1 - THREE.MathUtils.clamp((vy - crownMinY) / crownSpanY, 0, 1);
        const wholeT = THREE.MathUtils.clamp((rawWholeT - 0.03) / 0.94, 0, 1);

        // Compute Per-Tier top-to-bottom gradient
        lerpColorSRGB(tierTopCol, tierBottomCol, tierT, tierGradCol);
        lerpColorSRGB(tierMidCol, tierGradCol, perTierStrength, perTierResult);

        // Compute Whole-Tree top-to-bottom gradient across all tiers
        lerpColorSRGB(wholeTopCol, wholeBottomCol, wholeT, wholeGradCol);

        // Blend Per-Tier and Whole-Tree cleanly
        lerpColorSRGB(perTierResult, wholeGradCol, wholeStrength, finalCol);

        colAttr.setXYZ(v, finalCol.r, finalCol.g, finalCol.b);
      }
      colAttr.needsUpdate = true;
      frondParts.push(geo);
    }
  });

  const merged = mergeGeometries(frondParts, false);
  frondParts.forEach((g) => g.dispose());

  if (merged) {
    merged.computeVertexNormals();
    const customCanopyTex =
      config.canopyTexture?.enabled && config.canopyTexture.textureId
        ? config.canopyTexture
        : sceneryTextures?.treeCanopy?.enabled && sceneryTextures.treeCanopy.textureId
        ? sceneryTextures.treeCanopy
        : undefined;
    const customProc = getProcessedSurfaceTextures(customCanopyTex);
    const bumpStr = customProc
      ? customCanopyTex?.bumpStrength ?? 0.55
      : config.foliageBumpStrength ?? 0.55;
    const pineTex = getProceduralPineFrondTextures();
    const activeMap = customProc ? customProc.map : pineTex.map;
    const activeNormal = customProc ? customProc.normalMap : pineTex.normalMap;
    const nScale = bumpStr * 1.0;

    const mat =
      style === 'celToon'
        ? new THREE.MeshToonMaterial({
            color: '#FFFFFF',
            vertexColors: !customProc || (customCanopyTex?.tintStrength ?? 0.25) > 0.05,
            map: activeMap,
            normalMap: bumpStr > 0.01 ? activeNormal : null,
            normalScale: new THREE.Vector2(nScale * 0.8, nScale * 0.8),
            gradientMap: atlas.toonGradient,
          })
        : new THREE.MeshStandardMaterial({
            color: '#FFFFFF',
            vertexColors: !customProc || (customCanopyTex?.tintStrength ?? 0.25) > 0.05,
            map: activeMap,
            normalMap: bumpStr > 0.01 ? activeNormal : null,
            normalScale: new THREE.Vector2(nScale, nScale),
            roughness: THREE.MathUtils.clamp(customProc ? customCanopyTex?.roughness ?? 0.86 : 0.86, 0.72, 0.96),
            metalness: 0.0,
            envMapIntensity: 0.32,
          });

    const patchedMat = patchCanopyMaterial(mat, {
      instanced: false,
      timeUniform,
      windAmp: config.windSway,
      weatherWindUniform,
      uniformHsvShift: new THREE.Vector3(
        baseHueNorm + treeHueJitter,
        config.saturationShift,
        config.valueShift + treeValJitter
      ),
      windTipFactor: 0.075,
      enableVertexPaintHsv: enableVertexPaint,
    });

    const mesh = new THREE.Mesh(merged, patchedMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.paintPart = 'leaves';
    group.add(mesh);
  }

  const repTier = lerpColorSRGB(tierTopCol, tierBottomCol, 0.45, new THREE.Color());
  const repWhole = lerpColorSRGB(wholeTopCol, wholeBottomCol, 0.45, new THREE.Color());
  const rep = lerpColorSRGB(repTier, repWhole, wholeStrength, new THREE.Color());
  rep.offsetHSL(baseHueNorm + treeHueJitter, config.saturationShift * 0.4, config.valueShift * 0.3);
  return { group, colorHex: `#${rep.getHexString()}` };
}

/**
 * Builds a single stylized ovate leaf blade BufferGeometry (2-segment slightly cupped leaf)
 * for authentic airy Birch leaf sprigs rather than round spheres!
 */
function createLeafBladeGeometry(width: number, length: number): THREE.BufferGeometry {
  const hw = width * 0.5;
  const positions = new Float32Array([
    0, 0, 0, // base stem
    -hw, 0.015, length * 0.42, // left mid
    0, 0.028, length * 0.45, // center vein mid
    hw, 0.015, length * 0.42, // right mid
    0, -0.01, length, // pointed tip
  ]);
  const uvs = new Float32Array([0.5, 0, 0, 0.45, 0.5, 0.45, 1, 0.45, 0.5, 1]);
  const indices = [0, 1, 2, 0, 2, 3, 1, 4, 2, 2, 4, 3];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds lush Birch foliage composed of fine clusters of real angled leaves attached directly
 * to the fine tapered twigs, with per-leaf AND per-cluster random hue variation (ideal for Autumn reds/oranges/browns/yellows!).
 */
function buildBirchLeafCanopyGroup(
  config: StylizedCanopyConfig,
  base: BuiltTreeBase,
  treeKey: string,
  style: VisualStyleId,
  timeUniform: { value: number },
  sceneryTextures?: Partial<Record<SceneryTextureSlot, SurfaceTextureSettings>>,
  enableVertexPaint = false,
  weatherWindUniform: { value: number } = DEFAULT_WEATHER_WIND_UNIFORM
): { group: THREE.Group; colorHex: string } {
  const rand = createTreePrng(hashTreeSeed(`${treeKey}_birch_leaves`, config.seed));
  const group = new THREE.Group();

  const density = THREE.MathUtils.clamp(config.birchLeafDensity ?? 1.35, 0.3, 2.2);
  const leafSize = THREE.MathUtils.clamp(config.birchLeafSize ?? 1.05, 0.5, 2.0);
  const baseLeafColor = new THREE.Color(config.birchLeafColor ?? '#98D14A');

  const hueShiftNorm = config.hueShift / 360;
  const hueSpreadNorm = config.hueVariation / 360;
  const valSpread = config.valueVariation;
  const treeHueBase = (rand() - 0.5) * 2 * hueSpreadNorm * 0.55;
  const treeValBase = (rand() - 0.5) * 2 * valSpread * 0.45;

  const attachments = base.twigAttachments.length > 0
    ? base.twigAttachments
    : base.branchTips.map((pos) => ({ pos, dir: new THREE.Vector3(0, 1, 0), scale: 1 }));

  const leavesPerSprig = Math.max(7, Math.round(13 * density));
  const leafParts: THREE.BufferGeometry[] = [];
  const tmpColor = new THREE.Color();
  const baseBlade = createLeafBladeGeometry(0.17 * leafSize, 0.28 * leafSize);

  for (const att of attachments) {
    // Cluster-level hue & value shift so each leafy bough reads with vivid autumn/spring variety
    const clusterHue = (rand() - 0.5) * 2 * hueSpreadNorm * 0.85;
    const clusterVal = (rand() - 0.5) * 2 * valSpread * 0.8;
    const sprigRadius = 0.26 * att.scale * (0.85 + leafSize * 0.25);

    for (let l = 0; l < leavesPerSprig; l++) {
      const leafGeo = baseBlade.clone();
      const s = (0.72 + rand() * 0.65) * att.scale;
      leafGeo.scale(s, s, s);
      leafGeo.rotateX((rand() - 0.42) * 1.45);
      leafGeo.rotateY(rand() * Math.PI * 2);
      leafGeo.rotateZ((rand() - 0.5) * 1.1);

      const theta = rand() * Math.PI * 2;
      const phi = (rand() - 0.45) * Math.PI;
      const dist = sprigRadius * Math.pow(rand(), 0.6);
      leafGeo.translate(
        att.pos.x + Math.cos(theta) * Math.cos(phi) * dist,
        att.pos.y + Math.sin(phi) * dist * 0.72,
        att.pos.z + Math.sin(theta) * Math.cos(phi) * dist
      );

      // Per-leaf random hue & lightness (creates natural warm red/orange/brown/yellow scatter in fall!)
      const leafHue = (rand() - 0.5) * 2 * hueSpreadNorm * 0.55;
      const leafLight = (rand() - 0.5) * 2 * valSpread * 0.55;
      const sunLift =
        THREE.MathUtils.clamp((att.pos.y - base.trunkTopY * 0.65) / 2.2, -0.5, 1) *
        config.sunCrownGradient *
        0.18;

      tmpColor
        .copy(baseLeafColor)
        .offsetHSL(
          hueShiftNorm + treeHueBase + clusterHue + leafHue,
          config.saturationShift * 0.75 + (rand() - 0.5) * 0.14,
          config.valueShift * 0.55 + treeValBase + clusterVal + leafLight + sunLift
        );

      const count = leafGeo.attributes.position.count;
      const cols = new Float32Array(count * 3);
      for (let v = 0; v < count; v++) {
        // Subtle sunlit tip highlight on each leaf blade
        const tipLift = v === 4 ? 1.12 : v === 0 ? 0.86 : 1.0;
        cols[v * 3] = Math.min(1, tmpColor.r * tipLift);
        cols[v * 3 + 1] = Math.min(1, tmpColor.g * tipLift);
        cols[v * 3 + 2] = Math.min(1, tmpColor.b * tipLift);
      }
      leafGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      leafParts.push(leafGeo);
    }
  }
  baseBlade.dispose();

  const merged = mergeGeometries(leafParts, false);
  leafParts.forEach((g) => g.dispose());

  if (merged) {
    merged.computeVertexNormals();
    const customCanopyTex =
      config.canopyTexture?.enabled && config.canopyTexture.textureId
        ? config.canopyTexture
        : sceneryTextures?.treeCanopy?.enabled && sceneryTextures.treeCanopy.textureId
        ? sceneryTextures.treeCanopy
        : undefined;
    const customProc = getProcessedSurfaceTextures(customCanopyTex);
    const leafTex = getProceduralLeafBladeTextures();
    const bumpStr = customProc
      ? customCanopyTex?.bumpStrength ?? 0.52
      : config.foliageBumpStrength ?? 0.52;
    const activeMap = customProc ? customProc.map : leafTex.map;
    const activeNormal = customProc ? customProc.normalMap : leafTex.normalMap;
    const nScale = bumpStr * 0.95;
    const mat =
      style === 'celToon'
        ? new THREE.MeshToonMaterial({
            color: '#FFFFFF',
            vertexColors: !customProc || (customCanopyTex?.tintStrength ?? 0.25) > 0.05,
            map: activeMap,
            normalMap: bumpStr > 0.01 ? activeNormal : null,
            normalScale: new THREE.Vector2(nScale * 0.8, nScale * 0.8),
            side: THREE.DoubleSide,
            gradientMap: getTerrainTextureAtlas().toonGradient,
          })
        : new THREE.MeshStandardMaterial({
            color: '#FFFFFF',
            vertexColors: !customProc || (customCanopyTex?.tintStrength ?? 0.25) > 0.05,
            map: activeMap,
            normalMap: bumpStr > 0.01 ? activeNormal : null,
            normalScale: new THREE.Vector2(nScale, nScale),
            roughness: THREE.MathUtils.clamp(customProc ? customCanopyTex?.roughness ?? 0.86 : 0.86, 0.72, 0.96),
            metalness: 0.0,
            envMapIntensity: 0.32,
            side: THREE.DoubleSide,
          });

    // Apply lively wind flutter shader without shifting HSV twice (vertex colors already hold exact per-leaf HSV!)
    const patchedMat = patchCanopyMaterial(mat, {
      instanced: false,
      timeUniform,
      windAmp: config.windSway,
      weatherWindUniform,
      uniformHsvShift: new THREE.Vector3(0, 0, 0),
      windTipFactor: 0.095,
      enableVertexPaintHsv: enableVertexPaint,
    });

    const mesh = new THREE.Mesh(merged, patchedMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.paintPart = 'leaves';
    group.add(mesh);
  }

  const rep = baseLeafColor.clone().offsetHSL(hueShiftNorm + treeHueBase, 0, 0);
  return { group, colorHex: `#${rep.getHexString()}` };
}

/**
 * Distributes stylized 3D fruit (spheres or uploaded custom .GLB) across an Oak, Fantasy, or Custom canopy!
 */
function buildTreeFruitGroup(
  config: StylizedCanopyConfig,
  puffs: CanopyPuffTransform[],
  treeKey: string,
  style: VisualStyleId,
  sceneryTextures?: Partial<Record<SceneryTextureSlot, SurfaceTextureSettings>>
): THREE.Group | null {
  if (!config.fruitEnabled || puffs.length === 0) return null;
  const count = Math.max(0, Math.min(36, Math.round(config.fruitCount ?? 10)));
  if (count === 0) return null;

  const rand = createTreePrng(hashTreeSeed(`${treeKey}_fruit`, config.seed));
  const fruitGroup = new THREE.Group();
  const fruitSize = Math.max(0.06, config.fruitSize ?? 0.17);
  const fruitColor = config.fruitColor ?? '#D93B3B';
  const fruitGlow = Math.max(0, config.fruitGlow ?? 0);
  const distMode = config.fruitDistribution ?? 'outerCrown';
  const customFruitTex =
    config.fruitTexture?.enabled && config.fruitTexture.textureId
      ? config.fruitTexture
      : sceneryTextures?.fruit?.enabled && sceneryTextures.fruit.textureId
      ? sceneryTextures.fruit
      : undefined;

  // Extract custom Fruit GLB primitives if uploaded, otherwise use glossy stylized fruit sphere + stem!
  let fruitPrims: NormalizedCanopyPrimitive[] = [];
  if (config.fruitAssetId) {
    const cached = getCachedAssetSync(config.fruitAssetId);
    if (cached) {
      cached.scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(cached.scene);
      if (!box.isEmpty()) {
        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        box.getCenter(center);
        box.getSize(size);
        const radius = Math.max(0.001, Math.max(size.x, size.y, size.z) * 0.5);
        const inv = 1 / radius;
        const norm = new THREE.Matrix4()
          .makeScale(inv, inv, inv)
          .multiply(new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z));

        cached.scene.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (!mesh.isMesh || !mesh.geometry) return;
          const geo = mesh.geometry.clone();
          geo.applyMatrix4(norm.clone().multiply(mesh.matrixWorld));
          if (!geo.attributes.normal) geo.computeVertexNormals();
          const rawMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
          const mat = rawMat
            ? adaptMaterialForStyle(rawMat, style, 0)
            : new THREE.MeshStandardMaterial({ color: fruitColor, roughness: 0.35 });
          if (
            customFruitTex &&
            (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshToonMaterial)
          ) {
            applySurfaceTextureToMaterial(mat, customFruitTex, {
              baseTintHex: fruitColor,
              isToon: style === 'celToon',
            });
          }
          fruitPrims.push({ geometry: geo, material: mat, isFallback: false });
        });
      }
    }
  }

  if (fruitPrims.length === 0) {
    const sphereGeo = new THREE.SphereGeometry(1.0, 14, 12);
    // Subtle organic apple/fruit taper
    sphereGeo.scale(1.0, 0.94, 1.0);
    const mat =
      style === 'celToon'
        ? new THREE.MeshToonMaterial({
            color: fruitColor,
            gradientMap: getTerrainTextureAtlas().toonGradient,
          })
        : new THREE.MeshStandardMaterial({
            color: fruitColor,
            roughness: fruitGlow > 0.1 ? 0.25 : 0.32,
            metalness: 0.04,
            emissive: fruitGlow > 0.05 ? new THREE.Color(fruitColor) : new THREE.Color('#000000'),
            emissiveIntensity: fruitGlow,
          });
    if (customFruitTex) {
      applySurfaceTextureToMaterial(mat, customFruitTex, {
        baseTintHex: fruitColor,
        isToon: style === 'celToon',
      });
    }
    fruitPrims = [{ geometry: sphereGeo, material: mat, isFallback: true }];
  }

  // Use InstancedMesh per fruit primitive so 20+ fruits render in 1 draw call per tree
  const dummy = new THREE.Object3D();
  const instMeshes = fruitPrims.map((fp) => {
    const im = new THREE.InstancedMesh(fp.geometry, fp.material, count);
    im.castShadow = true;
    im.userData.noVertexPaint = true;
    fruitGroup.add(im);
    return im;
  });

  // Add subtle slender hanging stems when distribution === 'hanging'
  const stemMat =
    distMode === 'hanging'
      ? new THREE.MeshStandardMaterial({
          color: fruitGlow > 0.2 ? '#B8D4E8' : '#594230',
          roughness: 0.85,
        })
      : null;
  const stemGeo = distMode === 'hanging' ? new THREE.CylinderGeometry(0.012, 0.012, 0.36, 5) : null;
  const stemInst =
    stemGeo && stemMat ? new THREE.InstancedMesh(stemGeo, stemMat, count) : null;
  if (stemInst) {
    stemInst.userData.noVertexPaint = true;
    fruitGroup.add(stemInst);
  }

  for (let i = 0; i < count; i++) {
    const puff = puffs[Math.floor(rand() * puffs.length)];
    const theta = rand() * Math.PI * 2;
    let fx = puff.x;
    let fy = puff.y;
    let fz = puff.z;

    if (distMode === 'underCanopy') {
      const r = 0.45 + rand() * 0.42;
      fx += Math.cos(theta) * puff.scaleX * r;
      fz += Math.sin(theta) * puff.scaleZ * r;
      fy -= puff.scaleY * (0.68 + rand() * 0.24);
    } else if (distMode === 'hanging') {
      const r = 0.55 + rand() * 0.42;
      const hangLen = 0.22 + rand() * 0.26;
      fx += Math.cos(theta) * puff.scaleX * r;
      fz += Math.sin(theta) * puff.scaleZ * r;
      fy -= puff.scaleY * 0.72 + hangLen;
      if (stemInst) {
        dummy.position.set(fx, fy + hangLen * 0.55, fz);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, hangLen / 0.36, 1);
        dummy.updateMatrix();
        stemInst.setMatrixAt(i, dummy.matrix);
      }
    } else {
      // outerCrown: nestled visibly across the sunlit surface of the canopy puffs
      const phi = (rand() - 0.2) * Math.PI * 0.78;
      const surfR = 0.86 + rand() * 0.14;
      fx += Math.cos(theta) * Math.cos(phi) * puff.scaleX * surfR;
      fy += Math.sin(phi) * puff.scaleY * surfR;
      fz += Math.sin(theta) * Math.cos(phi) * puff.scaleZ * surfR;
    }

    const s = fruitSize * (0.82 + rand() * 0.38);
    dummy.position.set(fx, fy, fz);
    dummy.rotation.set((rand() - 0.5) * 0.5, rand() * Math.PI * 2, (rand() - 0.5) * 0.5);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    for (const im of instMeshes) {
      im.setMatrixAt(i, dummy.matrix);
    }
  }

  for (const im of instMeshes) {
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
  }
  if (stemInst) {
    stemInst.instanceMatrix.needsUpdate = true;
    stemInst.computeBoundingSphere();
  }

  return fruitGroup;
}

// ---------------------------------------------------------------------------
// 3D CONTOUR-FOLLOWING CANOPY LEAVES (Basic, Oak, Maple, Triple Fanned Sprig)
// ---------------------------------------------------------------------------

const canopyLeafGeometryCache = new Map<CanopyLeafShape, THREE.BufferGeometry>();

/**
 * Builds a single cupped two-curve pointed leaf blade (stem at y=0, pointed tip at y=length)
 * with a central midrib spine so it cups naturally in 3D and catches sunlit highlights.
 */
function buildBasicPointedLeafGeo(width = 0.52, length = 1.0): THREE.BufferGeometry {
  const segs = 6;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Tip & base single vertices + 3-across interior rows (left, center vein, right)
  positions.push(0, 0, 0);
  uvs.push(0.5, 0);

  for (let i = 1; i < segs; i++) {
    const t = i / segs;
    // Two smooth curves meeting at pointed ends (sin^0.82 creates a classic graceful almond leaf!)
    const halfW = width * 0.5 * Math.pow(Math.sin(t * Math.PI), 0.82);
    const y = t * length;
    const archZ = Math.sin(t * Math.PI) * 0.08 - t * t * 0.14;
    const edgeLift = halfW * 0.28;

    positions.push(-halfW, y, archZ + edgeLift);
    uvs.push(0, t);

    positions.push(0, y, archZ);
    uvs.push(0.5, t);

    positions.push(halfW, y, archZ + edgeLift);
    uvs.push(1, t);
  }

  const tipIdx = 1 + (segs - 1) * 3;
  positions.push(0, length, -0.14);
  uvs.push(0.5, 1);

  // Base triangles
  indices.push(0, 2, 1, 0, 3, 2);

  // Interior quads split across the midrib
  for (let i = 0; i < segs - 2; i++) {
    const r0 = 1 + i * 3;
    const r1 = r0 + 3;
    indices.push(r0, r0 + 1, r1 + 1, r0, r1 + 1, r1);
    indices.push(r0 + 1, r0 + 2, r1 + 2, r0 + 1, r1 + 2, r1 + 1);
  }

  // Tip triangles
  const lastRow = 1 + (segs - 2) * 3;
  indices.push(lastRow, lastRow + 1, tipIdx, lastRow + 1, lastRow + 2, tipIdx);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Helper: Converts a 2D botanical THREE.Shape (centered on X, y in 0..1) into a 3D cupped leaf mesh
 * with normalized UVs so veined normal/bump maps run straight up the central midrib!
 */
function cupAndNormalizeLeafShape(
  shape: THREE.Shape,
  curveSegments: number,
  cupStrength: number,
  archDrop: number
): THREE.BufferGeometry {
  const raw = new THREE.ShapeGeometry(shape, curveSegments);
  const geo = raw.index ? raw.toNonIndexed() : raw;
  if (raw !== geo) raw.dispose();

  const pos = geo.attributes.position as THREE.BufferAttribute;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const spanX = Math.max(0.001, maxX - minX);
  const spanY = Math.max(0.001, maxY - minY);
  const uvs = new Float32Array(pos.count * 2);

  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i) / spanY; // preserve natural aspect ratio while scaling height to 1.0
    const ny = (pos.getY(i) - minY) / spanY;
    const cupZ = Math.abs(nx) * cupStrength + Math.sin(ny * Math.PI) * 0.06 - ny * ny * archDrop;
    pos.setXYZ(i, nx, ny, cupZ);
    uvs[i * 2] = (pos.getX(i) * spanY - minX) / spanX;
    uvs[i * 2 + 1] = ny;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Classic sinuous multi-lobed Oak leaf silhouette (3 rounded lateral lobe pairs + crown lobe).
 */
function buildOakLeafGeo(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  // Right half from stem up to crown apex
  s.bezierCurveTo(0.06, 0.08, 0.14, 0.12, 0.22, 0.19);
  s.bezierCurveTo(0.28, 0.24, 0.24, 0.31, 0.14, 0.34); // sinus 1
  s.bezierCurveTo(0.27, 0.38, 0.36, 0.45, 0.34, 0.54); // lobe 2
  s.bezierCurveTo(0.32, 0.61, 0.22, 0.63, 0.16, 0.66); // sinus 2
  s.bezierCurveTo(0.28, 0.72, 0.31, 0.80, 0.22, 0.86); // lobe 3
  s.bezierCurveTo(0.15, 0.90, 0.11, 0.96, 0, 1.0); // crown apex
  // Left half mirror back to stem
  s.bezierCurveTo(-0.11, 0.96, -0.15, 0.90, -0.22, 0.86);
  s.bezierCurveTo(-0.31, 0.80, -0.28, 0.72, -0.16, 0.66);
  s.bezierCurveTo(-0.22, 0.63, -0.32, 0.61, -0.34, 0.54);
  s.bezierCurveTo(-0.36, 0.45, -0.27, 0.38, -0.14, 0.34);
  s.bezierCurveTo(-0.24, 0.31, -0.28, 0.24, -0.22, 0.19);
  s.bezierCurveTo(-0.14, 0.12, -0.06, 0.08, 0, 0);
  return cupAndNormalizeLeafShape(s, 5, 0.22, 0.14);
}

/**
 * Crisp 5-lobed palmate Maple leaf silhouette with pointed tips and serrated notches.
 */
function buildMapleLeafGeo(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  // Short stem base widening to lower-right lobe
  s.lineTo(0.03, 0.14);
  s.lineTo(0.28, 0.16);
  s.lineTo(0.36, 0.24); // lower right lobe tip
  s.lineTo(0.24, 0.32); // lower notch
  // Mid-right major lobe
  s.lineTo(0.47, 0.44);
  s.lineTo(0.41, 0.53);
  s.lineTo(0.49, 0.61); // mid right peak
  s.lineTo(0.32, 0.64);
  s.lineTo(0.22, 0.58); // deep upper notch
  // Central tall lobe
  s.lineTo(0.27, 0.76);
  s.lineTo(0.16, 0.82);
  s.lineTo(0, 1.0); // center apex
  // Left mirror
  s.lineTo(-0.16, 0.82);
  s.lineTo(-0.27, 0.76);
  s.lineTo(-0.22, 0.58);
  s.lineTo(-0.32, 0.64);
  s.lineTo(-0.49, 0.61);
  s.lineTo(-0.41, 0.53);
  s.lineTo(-0.47, 0.44);
  s.lineTo(-0.24, 0.32);
  s.lineTo(-0.36, 0.24);
  s.lineTo(-0.28, 0.16);
  s.lineTo(-0.03, 0.14);
  s.lineTo(0, 0);
  return cupAndNormalizeLeafShape(s, 2, 0.18, 0.12);
}

/**
 * Triple Leaf unit: 3 smaller two-curve basic pointed leaves fanning out from a shared connected stem!
 */
function buildTripleLeafGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // Center lead blade (slightly larger, pointing forward)
  const center = buildBasicPointedLeafGeo(0.40, 0.84);
  center.translate(0, 0.06, 0.01);
  parts.push(center.index ? center.toNonIndexed() : center);

  // Left fanned blade (+46 deg)
  const left = buildBasicPointedLeafGeo(0.34, 0.68);
  left.rotateY(-0.14);
  left.rotateZ(0.8);
  left.translate(-0.02, 0.05, -0.01);
  parts.push(left.index ? left.toNonIndexed() : left);

  // Right fanned blade (-46 deg)
  const right = buildBasicPointedLeafGeo(0.34, 0.68);
  right.rotateY(0.14);
  right.rotateZ(-0.8);
  right.translate(0.02, 0.05, -0.01);
  parts.push(right.index ? right.toNonIndexed() : right);

  // Tiny shared stem tab joining all three leaf bases cleanly at (0,0,0)
  const stemShape = new THREE.Shape();
  stemShape.moveTo(-0.03, 0);
  stemShape.lineTo(0.03, 0);
  stemShape.lineTo(0.045, 0.1);
  stemShape.lineTo(-0.045, 0.1);
  stemShape.closePath();
  const rawStem = new THREE.ShapeGeometry(stemShape, 1);
  const stem = rawStem.index ? rawStem.toNonIndexed() : rawStem;
  if (rawStem !== stem) rawStem.dispose();
  const sPos = stem.attributes.position as THREE.BufferAttribute;
  const sUv = new Float32Array(sPos.count * 2);
  for (let i = 0; i < sPos.count; i++) {
    sUv[i * 2] = 0.5;
    sUv[i * 2 + 1] = 0.05;
  }
  stem.setAttribute('uv', new THREE.BufferAttribute(sUv, 2));
  stem.computeVertexNormals();
  parts.push(stem);

  const merged = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  if (!merged) return buildBasicPointedLeafGeo(0.5, 1.0);
  merged.computeVertexNormals();
  return merged;
}

function getCanopyLeafGeometry(shape: CanopyLeafShape): THREE.BufferGeometry {
  const cached = canopyLeafGeometryCache.get(shape);
  if (cached) return cached;
  const geo =
    shape === 'oak'
      ? buildOakLeafGeo()
      : shape === 'maple'
      ? buildMapleLeafGeo()
      : shape === 'triple'
      ? buildTripleLeafGeo()
      : buildBasicPointedLeafGeo(0.5, 1.0);
  canopyLeafGeometryCache.set(shape, geo);
  return geo;
}

/**
 * Patches an InstancedMesh leaf material with living weather-responsive wind flutter
 * anchored at the leaf stem (position.y = 0) and fluttering freely toward the tip!
 */
function patchLeafFlutterMaterial(
  mat: THREE.Material,
  timeUniform: { value: number },
  weatherWindUniform: { value: number },
  windAmp: number
): NodeMaterial {
  const nodeMat = upgradeToNodeMaterial(mat);
  if (nodeMat !== mat) {
    mat.dispose();
  }

  nodeMat.userData.uWindAmp = windAmp;
  const uTime = asFloatUniformNode(timeUniform);
  const uWeather = asFloatUniformNode(weatherWindUniform);
  const leafPosKey = `${getUniformObjId(uTime)}|${getUniformObjId(uWeather)}`;
  let cachedLeafPos = _leafFlutterPosNodeCache.get(leafPosKey);
  if (!cachedLeafPos) {
    const uWindAmp = safeMaterialReference('userData.uWindAmp', 'float', 0) as unknown as ReturnType<
      typeof float
    >;
    const lWind = uWindAmp.mul(uWeather);
    const lOrigin = modelWorldMatrix.mul(vec4(positionLocal.sub(positionGeometry), 1.0)).xyz;
    const tipMask = clamp(positionGeometry.y.mul(1.15), 0.0, 1.0);
    const lSeed = fract(
      sin(dot(vec2(lOrigin.x, lOrigin.z).add(lOrigin.y.mul(0.73)), vec2(12.9898, 78.233))).mul(43758.5453)
    );
    const lFreq = float(2.4).add(clamp(uWeather, 0.2, 3.2).mul(1.35));
    const lWave = sin(uTime.mul(1.7).add(lOrigin.x.mul(0.42)).add(lOrigin.z.mul(0.34))).add(
      sin(uTime.mul(3.2).add(lOrigin.x.mul(0.85)).sub(lOrigin.z.mul(0.65))).mul(0.45)
    );
    const lFlutter = sin(uTime.mul(lFreq.mul(1.85)).add(lSeed.mul(6.28318)).add(positionGeometry.y.mul(4.5)));
    const lGust = float(0.6).add(sin(uTime.mul(0.75).add(lOrigin.x.mul(0.14)).sub(lOrigin.z.mul(0.11))).mul(0.4));
    const lBend = lWave.mul(0.09).mul(lGust).add(lFlutter.mul(0.05)).mul(lWind).mul(tipMask);
    const lTwist = cos(uTime.mul(lFreq.mul(1.5)).add(lSeed.mul(6.28318))).mul(0.055).mul(lWind).mul(tipMask);

    const outN = normalize(normalLocal);
    const flutterOffset = outN
      .mul(lBend)
      .add(vec3(lTwist.add(lWave.mul(0.042).mul(lGust).mul(lWind).mul(tipMask)), abs(lBend).mul(-0.14), 0.0));
    cachedLeafPos = positionLocal.add(flutterOffset) as unknown as ReturnType<typeof vec3>;
    _leafFlutterPosNodeCache.set(leafPosKey, cachedLeafPos);
  }
  nodeMat.positionNode = cachedLeafPos;
  nodeMat.needsUpdate = true;

  return nodeMat;
}

/**
 * Applies single base color + true post-transform top-to-bottom vertical gradient vertex colors
 * onto a leaf-free Canopy Base puff geometry!
 */
function applyCanopyBaseVertexColors(
  geo: THREE.BufferGeometry,
  puffMatrix: THREE.Matrix4,
  crownMinY: number,
  crownMaxY: number,
  config: StylizedCanopyConfig,
  fallbackBaseColor?: string
): void {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const baseCol = new THREE.Color(config.foliageBaseColor ?? fallbackBaseColor ?? '#4EA343');
  const topCol = new THREE.Color(config.canopyBaseTopColor ?? '#8FD652');
  const botCol = new THREE.Color(config.canopyBaseBottomColor ?? '#245A29');
  const gradStr = THREE.MathUtils.clamp(config.canopyBaseGradientStrength ?? 0.58, 0, 1);
  const scope = config.canopyBaseGradientScope ?? 'both';

  // Compute exact world-Y bounds of this puff
  const tmpV = new THREE.Vector3();
  let puffMinY = Infinity;
  let puffMaxY = -Infinity;
  const worldYs = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    tmpV.fromBufferAttribute(pos, i).applyMatrix4(puffMatrix);
    worldYs[i] = tmpV.y;
    if (tmpV.y < puffMinY) puffMinY = tmpV.y;
    if (tmpV.y > puffMaxY) puffMaxY = tmpV.y;
  }

  const puffSpan = Math.max(0.05, puffMaxY - puffMinY);
  const crownSpan = Math.max(0.1, crownMaxY - crownMinY);
  const cols = new Float32Array(pos.count * 3);
  const gradCol = new THREE.Color();
  const finalCol = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const wy = worldYs[i];
    const tPuff = THREE.MathUtils.clamp((wy - puffMinY) / puffSpan, 0, 1);
    const tWhole = THREE.MathUtils.clamp((wy - crownMinY) / crownSpan, 0, 1);
    const tGrad =
      scope === 'whole' ? tWhole : scope === 'perPuff' ? tPuff : tWhole * 0.55 + tPuff * 0.45;

    lerpColorSRGB(botCol, topCol, tGrad, gradCol);
    lerpColorSRGB(baseCol, gradCol, gradStr, finalCol);
    cols[i * 3] = finalCol.r;
    cols[i * 3 + 1] = finalCol.g;
    cols[i * 3 + 2] = finalCol.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
}

/**
 * Distributes 3D contoured leaves (Basic, Oak, Maple, or Triple Leaf) directly across the outer
 * surface of the canopy base puffs, following their exact contour and offset slightly outside
 * for lush 3D dimensional depth — with seasonal hue spread, size uniformity/randomness, and
 * weather-driven living wind flutter!
 */
function buildCanopyContourLeavesGroup(
  config: StylizedCanopyConfig,
  puffs: CanopyPuffTransform[],
  puffGeometry: THREE.BufferGeometry,
  treeKey: string,
  style: VisualStyleId,
  timeUniform: { value: number },
  weatherWindUniform: { value: number }
): THREE.Group | null {
  if (!config.canopyLeavesEnabled || puffs.length === 0) return null;
  const count = Math.max(12, Math.min(650, Math.round(config.canopyLeafCount ?? 220)));

  const posAttr = puffGeometry.attributes.position as THREE.BufferAttribute | undefined;
  if (!posAttr || posAttr.count < 3) return null;

  const rand = createTreePrng(hashTreeSeed(`${treeKey}_contour_leaves`, config.seed));
  const shape: CanopyLeafShape = config.canopyLeafShape ?? 'basic';
  const leafGeo = getCanopyLeafGeometry(shape);

  // Build area-weighted triangle CDF from the puff mesh so leaves hug exact sculpted/GLB contours!
  const indexAttr = puffGeometry.index;
  const triCount = indexAttr ? Math.floor(indexAttr.count / 3) : Math.floor(posAttr.count / 3);
  if (triCount <= 0) return null;

  const triCdf = new Float32Array(triCount);
  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const cross = new THREE.Vector3();
  let totalTriArea = 0;

  for (let t = 0; t < triCount; t++) {
    const i0 = indexAttr ? indexAttr.getX(t * 3) : t * 3;
    const i1 = indexAttr ? indexAttr.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = indexAttr ? indexAttr.getX(t * 3 + 2) : t * 3 + 2;
    vA.fromBufferAttribute(posAttr, i0);
    vB.fromBufferAttribute(posAttr, i1);
    vC.fromBufferAttribute(posAttr, i2);
    e1.subVectors(vB, vA);
    e2.subVectors(vC, vA);
    cross.crossVectors(e1, e2);
    totalTriArea += cross.length() * 0.5;
    triCdf[t] = totalTriArea;
  }
  if (totalTriArea <= 0.0001) return null;

  // Precompute puff world matrices, inverses (for interior overlap rejection), and surface area weights
  const puffMats: THREE.Matrix4[] = [];
  const puffInvMats: THREE.Matrix4[] = [];
  const puffNormalMats: THREE.Matrix3[] = [];
  const puffCdf = new Float32Array(puffs.length);
  const qTmp = new THREE.Quaternion();
  const eTmp = new THREE.Euler();
  const pTmp = new THREE.Vector3();
  const sTmp = new THREE.Vector3();
  let totalPuffArea = 0;
  let crownMinY = Infinity;
  let crownMaxY = -Infinity;

  for (let i = 0; i < puffs.length; i++) {
    const pf = puffs[i];
    eTmp.set(pf.rotX, pf.rotY, pf.rotZ);
    qTmp.setFromEuler(eTmp);
    pTmp.set(pf.x, pf.y, pf.z);
    sTmp.set(pf.scaleX, pf.scaleY, pf.scaleZ);
    const m = new THREE.Matrix4().compose(pTmp, qTmp, sTmp);
    puffMats.push(m);
    puffInvMats.push(m.clone().invert());
    puffNormalMats.push(new THREE.Matrix3().getNormalMatrix(m));

    const areaWeight = pf.scaleX * pf.scaleY + pf.scaleY * pf.scaleZ + pf.scaleZ * pf.scaleX;
    totalPuffArea += Math.max(0.05, areaWeight);
    puffCdf[i] = totalPuffArea;

    if (pf.y - pf.scaleY < crownMinY) crownMinY = pf.y - pf.scaleY;
    if (pf.y + pf.scaleY > crownMaxY) crownMaxY = pf.y + pf.scaleY;
  }
  const crownSpanY = Math.max(0.25, crownMaxY - crownMinY);

  const pickByCdf = (cdf: Float32Array, total: number, r: number): number => {
    const target = r * total;
    let lo = 0;
    let hi = cdf.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (cdf[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };

  // Veined leaf material with crisp bump/normal relief + double-sided shading + living wind flutter
  const leafTex = getProceduralLeafBladeTextures();
  const bumpStr = THREE.MathUtils.clamp(config.foliageBumpStrength ?? 0.42, 0, 1);
  const nScale = bumpStr * 0.95;
  const leafMat =
    style === 'celToon'
      ? new THREE.MeshToonMaterial({
          color: '#FFFFFF',
          map: leafTex.map,
          normalMap: bumpStr > 0.01 ? leafTex.normalMap : null,
          normalScale: new THREE.Vector2(nScale * 0.8, nScale * 0.8),
          side: THREE.DoubleSide,
          gradientMap: getTerrainTextureAtlas().toonGradient,
        })
      : new THREE.MeshStandardMaterial({
          color: '#FFFFFF',
          map: leafTex.map,
          normalMap: bumpStr > 0.01 ? leafTex.normalMap : null,
          normalScale: new THREE.Vector2(nScale, nScale),
          roughness: 0.86,
          metalness: 0.0,
          envMapIntensity: 0.32,
          side: THREE.DoubleSide,
        });

  const windAmp = Math.max(0, config.windSway * (config.canopyLeafWindFlutter ?? 1.0));
  const patchedLeafMat = patchLeafFlutterMaterial(leafMat, timeUniform, weatherWindUniform, windAmp);

  const instMesh = new THREE.InstancedMesh(leafGeo, patchedLeafMat, count);
  instMesh.castShadow = true;
  instMesh.receiveShadow = true;
  instMesh.userData.noVertexPaint = true;

  const baseLeafColor = new THREE.Color(config.canopyLeafColor ?? '#58B446');
  const baseSize = THREE.MathUtils.clamp(config.canopyLeafSize ?? 0.34, 0.1, 0.85);
  const sizeRandomness = THREE.MathUtils.clamp(config.canopyLeafSizeRandomness ?? 0.45, 0, 1);
  const hueSpreadNorm = THREE.MathUtils.clamp(config.canopyLeafHueSpread ?? 16, 0, 90) / 360;
  const valueSpread = THREE.MathUtils.clamp(config.canopyLeafValueSpread ?? 0.16, 0, 0.45);
  const surfaceOffset = THREE.MathUtils.clamp(config.canopyLeafSurfaceOffset ?? 0.08, 0, 0.48);
  const tiltRandomness = THREE.MathUtils.clamp(config.canopyLeafTiltRandomness ?? 0.48, 0, 1);
  const globalHueNorm = (config.hueShift ?? 0) / 360;
  const globalSatShift = (config.saturationShift ?? 0) * 0.7;
  const globalValShift = (config.valueShift ?? 0) * 0.55;
  const sunLiftAmt = config.sunCrownGradient ?? 0.22;

  const samplePos = new THREE.Vector3();
  const sampleNorm = new THREE.Vector3();
  const worldPos = new THREE.Vector3();
  const worldNorm = new THREE.Vector3();
  const testLocal = new THREE.Vector3();
  const tangentX = new THREE.Vector3();
  const tangentY = new THREE.Vector3();
  const upRef = new THREE.Vector3();
  const basisMat = new THREE.Matrix4();
  const leafQuat = new THREE.Quaternion();
  const spinQuat = new THREE.Quaternion();
  const tiltQuat = new THREE.Quaternion();
  const leafMatrix = new THREE.Matrix4();
  const scaleVec = new THREE.Vector3();
  const leafColor = new THREE.Color();

  for (let i = 0; i < count; i++) {
    let chosenPuff = 0;
    let foundOuter = false;

    // Sample outer visible contour (rejecting interior puff overlap & dark trunk core)
    for (let attempt = 0; attempt < 6; attempt++) {
      chosenPuff = pickByCdf(puffCdf, totalPuffArea, rand());
      const triIdx = pickByCdf(triCdf, totalTriArea, rand());
      const i0 = indexAttr ? indexAttr.getX(triIdx * 3) : triIdx * 3;
      const i1 = indexAttr ? indexAttr.getX(triIdx * 3 + 1) : triIdx * 3 + 1;
      const i2 = indexAttr ? indexAttr.getX(triIdx * 3 + 2) : triIdx * 3 + 2;

      vA.fromBufferAttribute(posAttr, i0);
      vB.fromBufferAttribute(posAttr, i1);
      vC.fromBufferAttribute(posAttr, i2);

      // Uniform barycentric point inside triangle
      let r1 = rand();
      let r2 = rand();
      if (r1 + r2 > 1) {
        r1 = 1 - r1;
        r2 = 1 - r2;
      }
      const r0 = 1 - r1 - r2;
      samplePos
        .set(
          vA.x * r0 + vB.x * r1 + vC.x * r2,
          vA.y * r0 + vB.y * r1 + vC.y * r2,
          vA.z * r0 + vB.z * r1 + vC.z * r2
        );

      // Outward triangle normal (fallback to radial normal)
      e1.subVectors(vB, vA);
      e2.subVectors(vC, vA);
      sampleNorm.crossVectors(e1, e2);
      if (sampleNorm.lengthSq() < 1e-6) {
        sampleNorm.copy(samplePos);
      }
      sampleNorm.normalize();
      if (sampleNorm.dot(samplePos) < 0) sampleNorm.negate();

      worldPos.copy(samplePos).applyMatrix4(puffMats[chosenPuff]);
      worldNorm.copy(sampleNorm).applyMatrix3(puffNormalMats[chosenPuff]).normalize();

      // Gently reduce underside clutter facing straight down into trunk
      if (worldNorm.y < -0.62 && attempt < 4) continue;

      // Exterior overlap rejection: skip points buried inside another puff
      let buried = false;
      for (let j = 0; j < puffs.length; j++) {
        if (j === chosenPuff) continue;
        testLocal.copy(worldPos).applyMatrix4(puffInvMats[j]);
        if (testLocal.lengthSq() < 0.72) {
          buried = true;
          break;
        }
      }
      if (!buried) {
        foundOuter = true;
        break;
      }
    }

    if (!foundOuter) {
      // Ensure outward normal even on fallback
      worldNorm.normalize();
    }

    // Offset slightly outside the canopy surface along the surface normal for crisp 3D depth!
    const lift = surfaceOffset * (0.65 + rand() * 0.7);
    worldPos.addScaledVector(worldNorm, lift);

    // Build contour-following tangent frame: leaf local +Z aligns with outward canopy normal!
    if (Math.abs(worldNorm.y) < 0.92) {
      upRef.set(0, 1, 0);
    } else {
      upRef.set(1, 0, 0);
    }
    tangentX.crossVectors(upRef, worldNorm).normalize();
    tangentY.crossVectors(worldNorm, tangentX).normalize();
    basisMat.makeBasis(tangentX, tangentY, worldNorm);
    leafQuat.setFromRotationMatrix(basisMat);

    // Random organic spin around surface normal so leaves flow gracefully around the contour
    spinQuat.setFromAxisAngle(worldNorm, rand() * Math.PI * 2);
    leafQuat.premultiply(spinQuat);

    // Subtle outward pitch + fluttery 3D tilt (0 = hugs contour smoothly, 1 = lively layered 3D angle)
    const pitchOut = THREE.MathUtils.lerp(0.12, 0.42, tiltRandomness) * (0.45 + rand() * 0.85);
    const rollJitter = (rand() - 0.5) * 0.65 * tiltRandomness;
    eTmp.set(pitchOut, 0, rollJitter);
    tiltQuat.setFromEuler(eTmp);
    leafQuat.multiply(tiltQuat);

    // Per-leaf size: 0% randomness = perfectly uniform, 100% = organic size variety
    const sizeFactor = THREE.MathUtils.lerp(1.0, 0.52 + rand() * 0.96, sizeRandomness);
    const leafScale = baseSize * sizeFactor;
    // Anchor leaf midpoint cleanly over the sampled contour point (stem trails slightly behind)
    pTmp.set(0, -leafScale * 0.36, 0).applyQuaternion(leafQuat);
    worldPos.add(pTmp);

    scaleVec.set(leafScale, leafScale, leafScale);
    leafMatrix.compose(worldPos, leafQuat, scaleVec);
    instMesh.setMatrixAt(i, leafMatrix);

    // Per-leaf seasonal hue spread + brightness variance + sunlit vertical crown lift
    const heightNorm = THREE.MathUtils.clamp((worldPos.y - crownMinY) / crownSpanY, 0, 1);
    const hueJitter = (rand() - 0.5) * 2 * hueSpreadNorm;
    const satJitter = (rand() - 0.5) * 0.14;
    const valJitter = (rand() - 0.5) * 2 * valueSpread;
    const crownSun = (heightNorm - 0.42) * sunLiftAmt * 0.34;

    leafColor
      .copy(baseLeafColor)
      .offsetHSL(
        globalHueNorm + hueJitter,
        globalSatShift + satJitter,
        globalValShift + valJitter + crownSun
      );
    instMesh.setColorAt(i, leafColor);
  }

  instMesh.instanceMatrix.needsUpdate = true;
  if (instMesh.instanceColor) instMesh.instanceColor.needsUpdate = true;
  instMesh.computeBoundingSphere();

  const group = new THREE.Group();
  group.add(instMesh);
  return group;
}

/**
 * Builds a complete single standalone stylized tree THREE.Group for ANY of the 5 species
 * (Oak, Conifer, Birch, Fantasy, Custom), supporting base-only preview mode!
 */
export function buildSingleCanopyTreeGroup(
  config: StylizedCanopyConfig,
  treeKey: string,
  style: VisualStyleId,
  timeUniform: { value: number },
  fallbackBaseColor?: string,
  opts?: {
    baseOnly?: boolean;
    previewIndex?: number;
    sceneryTextures?: Partial<Record<SceneryTextureSlot, SurfaceTextureSettings>>;
    enableVertexPaint?: boolean;
    weatherWindUniform?: { value: number };
    detail?: 'studio' | 'forest';
  }
): THREE.Group {
  const root = new THREE.Group();
  const species: TreeSpeciesType = config.treeType ?? 'oak';
  const sceneryTextures = opts?.sceneryTextures;
  const hasStrokes = (config.vertexPaintStrokes?.length ?? 0) > 0;
  const vpActive = Boolean(opts?.enableVertexPaint || hasStrokes);
  const weatherWindUniform = opts?.weatherWindUniform ?? DEFAULT_WEATHER_WIND_UNIFORM;

  // 0. EZ-Tree Recursive Multi-Level Branching Mode
  if (config.treeGeneratorMode === 'ezTree') {
    const ezRes = buildEzTreeGroup(config, treeKey, style, timeUniform, {
      baseOnly: opts?.baseOnly,
      sceneryTextures,
      weatherWindUniform,
      detail: opts?.detail ?? 'studio',
    });
    root.add(ezRes.group);

    if (!opts?.baseOnly) {
      const attachPuffs = ezRes.foliageMode === 'canopyPuffs' || ezRes.foliageMode === 'both';
      const fruitAnchors: CanopyPuffTransform[] = [];

      if (attachPuffs) {
        const fakeCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, ezRes.trunkTopY, 0),
        ]);
        const syntheticBase: BuiltTreeBase = {
          group: root,
          trunkTopY: ezRes.trunkTopY,
          trunkCurve: fakeCurve,
          branchTips: ezRes.branchTips,
          branchAnchors: ezRes.branchAnchors,
          twigAttachments: [],
          hasHollow: false,
          hasRoots: false,
        };
        const layout = generateTreeCanopyLayout(config, treeKey, ezRes.branchTips, syntheticBase);
        const canopyPrims = extractNormalizedCanopyPrimitives(
          config.canopyAssetId,
          style,
          config,
          fallbackBaseColor,
          sceneryTextures
        );

        let crownMinY = Infinity;
        let crownMaxY = -Infinity;
        for (const puff of layout.puffs) {
          if (puff.y - puff.scaleY < crownMinY) crownMinY = puff.y - puff.scaleY;
          if (puff.y + puff.scaleY > crownMaxY) crownMaxY = puff.y + puff.scaleY;
        }

        const puffEuler = new THREE.Euler();
        const puffQuat = new THREE.Quaternion();
        const puffPos = new THREE.Vector3();
        const puffScale = new THREE.Vector3();
        const puffMat4 = new THREE.Matrix4();

        for (const puff of layout.puffs) {
          fruitAnchors.push(puff);
          const puffGroup = new THREE.Group();
          puffGroup.position.set(puff.x, puff.y, puff.z);
          puffGroup.rotation.set(puff.rotX, puff.rotY, puff.rotZ);
          puffGroup.scale.set(puff.scaleX, puff.scaleY, puff.scaleZ);

          puffEuler.set(puff.rotX, puff.rotY, puff.rotZ);
          puffQuat.setFromEuler(puffEuler);
          puffPos.set(puff.x, puff.y, puff.z);
          puffScale.set(puff.scaleX, puff.scaleY, puff.scaleZ);
          puffMat4.compose(puffPos, puffQuat, puffScale);

          const hsvVec = new THREE.Vector3(puff.hsvShift[0], puff.hsvShift[1], puff.hsvShift[2]);
          for (const cp of canopyPrims) {
            const isCleanBase = Boolean(cp.material.userData?.isCleanCanopyBase);
            const needsUniqueGeo = vpActive || isCleanBase;
            const puffGeo = needsUniqueGeo ? cp.geometry.clone() : cp.geometry;
            if (isCleanBase) {
              applyCanopyBaseVertexColors(
                puffGeo,
                puffMat4,
                crownMinY,
                crownMaxY,
                config,
                fallbackBaseColor
              );
            }
            const mat = cp.material.clone();
            const patchedMat = patchCanopyMaterial(mat, {
              instanced: false,
              timeUniform,
              windAmp: config.windSway,
              weatherWindUniform,
              uniformHsvShift: hsvVec,
              enableVertexPaintHsv: vpActive,
            });
            const mesh = new THREE.Mesh(puffGeo, patchedMat);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData.paintPart = 'leaves';
            puffGroup.add(mesh);
          }
          root.add(puffGroup);
        }

        canopyPrims.forEach((cp) => {
          const isCleanBase = Boolean(cp.material.userData?.isCleanCanopyBase);
          cp.material.dispose();
          if (vpActive || isCleanBase) cp.geometry.dispose();
        });
      } else if (config.fruitEnabled && ezRes.branchTips.length > 0) {
        for (const tip of ezRes.branchTips.slice(0, 16)) {
          fruitAnchors.push({
            x: tip.x,
            y: tip.y,
            z: tip.z,
            scaleX: 0.45,
            scaleY: 0.45,
            scaleZ: 0.45,
            rotX: 0,
            rotY: 0,
            rotZ: 0,
            hsvShift: [0, 0, 0],
          });
        }
      }

      if (fruitAnchors.length > 0) {
        const fruitGrp = buildTreeFruitGroup(config, fruitAnchors, treeKey, style, sceneryTextures);
        if (fruitGrp) {
          root.add(fruitGrp);
        }
      }
    }

    if (vpActive) {
      prepareObjectForVertexPainting(root);
      if (hasStrokes) {
        applyVertexPaintStrokesToObject(root, config.vertexPaintStrokes);
      }
    }
    return root;
  }

  // 1. Build sculpted Tree Base (trunk, bark lines, major canopy branches, birch twigs, roots, owl hollow)
  const base = buildProceduralTreeBase(
    config,
    treeKey,
    style,
    opts?.previewIndex,
    sceneryTextures
  );
  root.add(base.group);

  if (!opts?.baseOnly) {
    // 2. Species-specific Canopy
    if (species === 'conifer') {
      const { group: conGroup } = buildConiferCanopyGroup(
        config,
        base,
        treeKey,
        style,
        timeUniform,
        sceneryTextures,
        vpActive,
        weatherWindUniform
      );
      root.add(conGroup);
    } else if (species === 'birch') {
      const { group: birchGroup } = buildBirchLeafCanopyGroup(
        config,
        base,
        treeKey,
        style,
        timeUniform,
        sceneryTextures,
        vpActive,
        weatherWindUniform
      );
      root.add(birchGroup);
    } else {
      // 3. Oak, Fantasy & Custom: overlapping squished GLB or leaf-free grain/gradient canopy puffs
      const layout = generateTreeCanopyLayout(config, treeKey, base.branchTips, base);
      const canopyPrims = extractNormalizedCanopyPrimitives(
        config.canopyAssetId,
        style,
        config,
        fallbackBaseColor,
        sceneryTextures
      );

      // Compute whole-crown vertical bounds for cleanBase top-to-bottom gradient
      let crownMinY = Infinity;
      let crownMaxY = -Infinity;
      for (const puff of layout.puffs) {
        if (puff.y - puff.scaleY < crownMinY) crownMinY = puff.y - puff.scaleY;
        if (puff.y + puff.scaleY > crownMaxY) crownMaxY = puff.y + puff.scaleY;
      }

      const puffEuler = new THREE.Euler();
      const puffQuat = new THREE.Quaternion();
      const puffPos = new THREE.Vector3();
      const puffScale = new THREE.Vector3();
      const puffMat4 = new THREE.Matrix4();

      for (const puff of layout.puffs) {
        const puffGroup = new THREE.Group();
        puffGroup.position.set(puff.x, puff.y, puff.z);
        puffGroup.rotation.set(puff.rotX, puff.rotY, puff.rotZ);
        puffGroup.scale.set(puff.scaleX, puff.scaleY, puff.scaleZ);

        puffEuler.set(puff.rotX, puff.rotY, puff.rotZ);
        puffQuat.setFromEuler(puffEuler);
        puffPos.set(puff.x, puff.y, puff.z);
        puffScale.set(puff.scaleX, puff.scaleY, puff.scaleZ);
        puffMat4.compose(puffPos, puffQuat, puffScale);

        const hsvVec = new THREE.Vector3(puff.hsvShift[0], puff.hsvShift[1], puff.hsvShift[2]);
        for (const cp of canopyPrims) {
          const isCleanBase = Boolean(cp.material.userData?.isCleanCanopyBase);
          const needsUniqueGeo = vpActive || isCleanBase;
          const puffGeo = needsUniqueGeo ? cp.geometry.clone() : cp.geometry;
          if (isCleanBase) {
            applyCanopyBaseVertexColors(
              puffGeo,
              puffMat4,
              crownMinY,
              crownMaxY,
              config,
              fallbackBaseColor
            );
          }

          const mat = cp.material.clone();
          const patchedMat = patchCanopyMaterial(mat, {
            instanced: false,
            timeUniform,
            windAmp: config.windSway,
            weatherWindUniform,
            uniformHsvShift: hsvVec,
            enableVertexPaintHsv: vpActive,
          });
          const mesh = new THREE.Mesh(puffGeo, patchedMat);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.userData.paintPart = 'leaves';
          puffGroup.add(mesh);
        }
        root.add(puffGroup);
      }

      // 4. Optional 3D Contour-Following Canopy Leaves (Basic, Oak, Maple, Triple)
      if (config.canopyLeavesEnabled && canopyPrims.length > 0) {
        const contourLeavesGrp = buildCanopyContourLeavesGroup(
          config,
          layout.puffs,
          canopyPrims[0].geometry,
          treeKey,
          style,
          timeUniform,
          weatherWindUniform
        );
        if (contourLeavesGrp) {
          root.add(contourLeavesGrp);
        }
      }

      canopyPrims.forEach((cp) => {
        const isCleanBase = Boolean(cp.material.userData?.isCleanCanopyBase);
        cp.material.dispose();
        if (vpActive || isCleanBase) cp.geometry.dispose();
      });

      // 5. Optional Fruit (Oak, Fantasy & Custom)
      const fruitGrp = buildTreeFruitGroup(config, layout.puffs, treeKey, style, sceneryTextures);
      if (fruitGrp) {
        root.add(fruitGrp);
      }
    }
  }

  // 6. Prepare & replay any hand-painted 3D vertex color / hue-shift strokes across leaves & branches
  if (vpActive) {
    prepareObjectForVertexPainting(root);
    if (hasStrokes) {
      applyVertexPaintStrokesToObject(root, config.vertexPaintStrokes);
    }
  }

  return root;
}

export interface ProceduralForestTreeRecord {
  item: ScatterItem;
  y: number;
  treeGroup: THREE.Group;
  colorHex: string;
}

/**
 * Builds a lush forest of unique procedural-base + stylized-canopy trees for the island
 * (supporting roots, owl hollows, gnarl, conifer gradients, birch leaf sprigs, GLB puffs,
 * leaf-free grain/gradient canopy bases, 3D contour leaves & fruit)
 * while keeping every tree individually choppable & wobblable in Play Mode!
 */
export function buildProceduralCanopyForest(
  trees: { item: ScatterItem; y: number; config: StylizedCanopyConfig }[],
  style: VisualStyleId,
  timeUniform: { value: number },
  fallbackBaseColor?: string,
  sceneryTextures?: Partial<Record<SceneryTextureSlot, SurfaceTextureSettings>>,
  weatherWindUniform: { value: number } = DEFAULT_WEATHER_WIND_UNIFORM
): { group: THREE.Group; records: ProceduralForestTreeRecord[] } {
  const forestGroup = new THREE.Group();
  const records: ProceduralForestTreeRecord[] = [];

  for (const { item, y, config } of trees) {
    const treeGroup = buildSingleCanopyTreeGroup(
      config,
      item.id,
      style,
      timeUniform,
      fallbackBaseColor,
      { sceneryTextures, weatherWindUniform, detail: 'forest' }
    );
    const s = item.size * 1.12;
    treeGroup.position.set(item.x, y, item.z);
    treeGroup.rotation.set(0, item.rotation, 0);
    treeGroup.scale.setScalar(s);
    forestGroup.add(treeGroup);

    const repHex =
      config.treeGeneratorMode === 'ezTree'
        ? config.ezTree?.leafTint ?? fallbackBaseColor ?? '#55AB42'
        : config.treeType === 'conifer'
        ? config.coniferTopColor ?? '#55A84E'
        : config.treeType === 'birch'
        ? config.birchLeafColor ?? '#88C846'
        : config.canopyLeavesEnabled
        ? config.canopyLeafColor ?? config.foliageBaseColor ?? fallbackBaseColor ?? '#4EA343'
        : config.foliageBaseColor ?? fallbackBaseColor ?? '#4EA343';

    records.push({
      item,
      y,
      treeGroup,
      colorHex: repHex,
    });
  }

  return { group: forestGroup, records };
}
