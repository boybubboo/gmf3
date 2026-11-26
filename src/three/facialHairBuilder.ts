import * as THREE from 'three';
import type {
  CharacterBeardConfig,
  CharacterBeardStyle,
  CharacterFacialHairConfig,
  CharacterMakerDoc,
  CharacterMustacheConfig,
  CharacterMustacheSideConfig,
  CharacterMustacheStyle,
  CharacterSideburnsConfig,
  CharacterSideburnsStyle,
  CharacterStubbleConfig,
  CharacterStubbleStyle,
} from '../types/maker';
import type { SdfFieldEvaluator } from './sdfMarchingCubes';

export interface FacialHairOption<T extends string> {
  id: T;
  label: string;
  desc: string;
}

export const MUSTACHE_STYLE_OPTIONS: FacialHairOption<CharacterMustacheStyle>[] = [
  { id: 'none', label: 'None', desc: 'Clean upper lip' },
  { id: 'pencil', label: 'Pencil Thin', desc: 'Sleek fine narrow line' },
  { id: 'classicStraight', label: 'Classic Straight', desc: 'Balanced neat sweep' },
  { id: 'chevron', label: 'Chevron', desc: 'Full sloped classic' },
  { id: 'handlebar', label: 'Handlebar', desc: 'Curved upward tips' },
  { id: 'imperial', label: 'Imperial Curl', desc: 'Thick sweeping spiral tips' },
  { id: 'dali', label: 'Dali Tips', desc: 'Thin artistic upward tips' },
  { id: 'walrus', label: 'Walrus Bushy', desc: 'Heavy drooping curtain' },
  { id: 'bushyBrush', label: 'Bushy Brush', desc: 'Dense layered bristles' },
  { id: 'horseshoe', label: 'Horseshoe', desc: 'Sweeps down mouth corners' },
  { id: 'fuManchu', label: 'Long Droop', desc: 'Slender drooping strands' },
  { id: 'toothbrush', label: 'Compact Center', desc: 'Short neat center tuft' },
];

export const BEARD_STYLE_OPTIONS: FacialHairOption<CharacterBeardStyle>[] = [
  { id: 'none', label: 'None', desc: 'Clean shaven' },
  { id: 'soulPatch', label: 'Soul Patch', desc: 'Soft tuft below lower lip' },
  { id: 'goatee', label: 'Classic Goatee', desc: 'Rounded chin tuft' },
  { id: 'vanDyke', label: 'Van Dyke', desc: 'Tapered pointed goatee' },
  { id: 'circleBeard', label: 'Circle Beard', desc: 'Ring around chin & corners' },
  { id: 'chinStrap', label: 'Chin Strap', desc: 'Sleek jawline contour' },
  { id: 'chinCurtain', label: 'Chin Curtain', desc: 'Full jaw fringe' },
  { id: 'shortBoxed', label: 'Short Trimmed', desc: 'Neat layered cheek & chin' },
  { id: 'fullTrimmed', label: 'Full Beard', desc: 'Lush multi-layer coverage' },
  { id: 'bushyLumberjack', label: 'Bushy Lumberjack', desc: 'Voluminous wild layers' },
  { id: 'ducktail', label: 'Ducktail', desc: 'Full cheeks, sculpted point' },
  { id: 'wizardLong', label: 'Wizard Elder', desc: 'Long cascading tiers' },
  { id: 'vikingBraided', label: 'Viking Forks', desc: 'Broad base with twin tails' },
  { id: 'muttonChops', label: 'Friendly Chops', desc: 'Bushy cheeks, open chin' },
];

export const SIDEBURNS_STYLE_OPTIONS: FacialHairOption<CharacterSideburnsStyle>[] = [
  { id: 'none', label: 'None', desc: 'No sideburns' },
  { id: 'shortNeat', label: 'Short Neat', desc: 'Tidy upper ear trim' },
  { id: 'pointed', label: 'Pointed', desc: 'Tapered sleek sideburns' },
  { id: 'flared', label: 'Flared', desc: 'Widening mid-jaw sweep' },
  { id: 'muttonChops', label: 'Mutton Chops', desc: 'Full bushy cheek sweeps' },
  { id: 'connectedFull', label: 'Connected Full', desc: 'Seamless hair-to-beard bridge' },
];

export const STUBBLE_STYLE_OPTIONS: FacialHairOption<CharacterStubbleStyle>[] = [
  { id: 'none', label: 'None', desc: 'Clean smooth skin' },
  { id: 'fiveOClock', label: "5 O'Clock Shadow", desc: 'Soft lower-face shading' },
  { id: 'designer', label: 'Designer Trim', desc: 'Neat jaw & lip contour' },
  { id: 'goatee', label: 'Goatee Shadow', desc: 'Lip & chin shading only' },
  { id: 'mustache', label: 'Upper Lip Shadow', desc: 'Subtle mustache shadow' },
  { id: 'chinJaw', label: 'Chin & Jaw', desc: 'Jawline shadow only' },
  { id: 'fullHeavy', label: 'Full Heavy', desc: 'Dense high-cheek shadow' },
];

export interface FacialHairComboPreset {
  id: string;
  label: string;
  apply: (baseColor: string) => Partial<CharacterFacialHairConfig>;
}

function hash01(n: number): number {
  let x = (n | 0) * 374761393;
  x = (x ^ (x >> 13)) * 1274126177;
  return ((x ^ (x >> 16)) >>> 0) / 4294967295;
}

function hash3D(ix: number, iy: number, iz: number): number {
  let h = (ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export function createMustacheSidePreset(style: CharacterMustacheStyle): CharacterMustacheSideConfig {
  switch (style) {
    case 'pencil':
      return {
        enabled: true,
        thickness: 0.36,
        length: 0.92,
        curl: 0.12,
        bushiness: 0.08,
        angleDeg: -6,
        offsetX: 0.002,
        offsetY: 0,
        offsetZ: 0,
        scale: 1.0,
      };
    case 'classicStraight':
      return {
        enabled: true,
        thickness: 0.88,
        length: 0.98,
        curl: 0.04,
        bushiness: 0.32,
        angleDeg: -4,
        offsetX: 0,
        offsetY: 0,
        offsetZ: 0,
        scale: 1.0,
      };
    case 'chevron':
      return {
        enabled: true,
        thickness: 1.18,
        length: 1.08,
        curl: -0.18,
        bushiness: 0.52,
        angleDeg: -14,
        offsetX: -0.002,
        offsetY: 0,
        offsetZ: 0,
        scale: 1.0,
      };
    case 'handlebar':
      return {
        enabled: true,
        thickness: 0.92,
        length: 1.32,
        curl: 1.15,
        bushiness: 0.38,
        angleDeg: 4,
        offsetX: 0,
        offsetY: 0,
        offsetZ: 0,
        scale: 1.0,
      };
    case 'imperial':
      return {
        enabled: true,
        thickness: 1.25,
        length: 1.52,
        curl: 1.55,
        bushiness: 0.68,
        angleDeg: 8,
        offsetX: -0.002,
        offsetY: 0,
        offsetZ: 0,
        scale: 1.05,
      };
    case 'dali':
      return {
        enabled: true,
        thickness: 0.42,
        length: 1.48,
        curl: 1.42,
        bushiness: 0.12,
        angleDeg: 18,
        offsetX: 0.001,
        offsetY: 0,
        offsetZ: 0,
        scale: 1.0,
      };
    case 'walrus':
      return {
        enabled: true,
        thickness: 1.65,
        length: 1.25,
        curl: -0.58,
        bushiness: 0.88,
        angleDeg: -22,
        offsetX: -0.003,
        offsetY: 0.002,
        offsetZ: 0.003,
        scale: 1.08,
      };
    case 'bushyBrush':
      return {
        enabled: true,
        thickness: 1.45,
        length: 1.12,
        curl: -0.06,
        bushiness: 0.92,
        angleDeg: -8,
        offsetX: -0.003,
        offsetY: 0,
        offsetZ: 0.002,
        scale: 1.04,
      };
    case 'horseshoe':
      return {
        enabled: true,
        thickness: 1.12,
        length: 1.45,
        curl: -0.95,
        bushiness: 0.48,
        angleDeg: -34,
        offsetX: -0.001,
        offsetY: 0.002,
        offsetZ: 0,
        scale: 1.0,
      };
    case 'fuManchu':
      return {
        enabled: true,
        thickness: 0.62,
        length: 1.85,
        curl: -1.08,
        bushiness: 0.24,
        angleDeg: -38,
        offsetX: 0.004,
        offsetY: 0.002,
        offsetZ: 0,
        scale: 1.0,
      };
    case 'toothbrush':
      return {
        enabled: true,
        thickness: 1.05,
        length: 0.42,
        curl: 0.0,
        bushiness: 0.42,
        angleDeg: -2,
        offsetX: -0.004,
        offsetY: 0,
        offsetZ: 0,
        scale: 0.95,
      };
    case 'none':
    default:
      return {
        enabled: true,
        thickness: 0.9,
        length: 1.0,
        curl: 0.1,
        bushiness: 0.35,
        angleDeg: -4,
        offsetX: 0,
        offsetY: 0,
        offsetZ: 0,
        scale: 1.0,
      };
  }
}

export function createMustachePresetConfig(style: CharacterMustacheStyle): CharacterMustacheConfig {
  const side = createMustacheSidePreset(style);
  return {
    style,
    mirrorSides: true,
    left: { ...side },
    right: { ...side },
  };
}

export function createBeardPresetConfig(style: CharacterBeardStyle): CharacterBeardConfig {
  switch (style) {
    case 'soulPatch':
      return {
        style,
        length: 0.45,
        thickness: 0.72,
        bushiness: 0.25,
        width: 0.45,
        curl: 0.08,
        taper: 0.65,
        cheekHeight: 0.1,
        depthOffset: 0,
        offsetY: 0,
        offsetZ: 0,
      };
    case 'goatee':
      return {
        style,
        length: 0.72,
        thickness: 0.95,
        bushiness: 0.42,
        width: 0.75,
        curl: 0.12,
        taper: 0.25,
        cheekHeight: 0.15,
        depthOffset: 0,
        offsetY: 0,
        offsetZ: 0,
      };
    case 'vanDyke':
      return {
        style,
        length: 0.95,
        thickness: 0.86,
        bushiness: 0.34,
        width: 0.68,
        curl: 0.1,
        taper: 0.78,
        cheekHeight: 0.15,
        depthOffset: 0,
        offsetY: 0,
        offsetZ: 0,
      };
    case 'circleBeard':
      return {
        style,
        length: 0.68,
        thickness: 0.9,
        bushiness: 0.36,
        width: 0.88,
        curl: 0.1,
        taper: 0.0,
        cheekHeight: 0.22,
        depthOffset: 0,
        offsetY: 0,
        offsetZ: 0,
      };
    case 'chinStrap':
      return {
        style,
        length: 0.45,
        thickness: 0.62,
        bushiness: 0.18,
        width: 1.02,
        curl: 0.05,
        taper: -0.1,
        cheekHeight: 0.2,
        depthOffset: 0,
        offsetY: 0,
        offsetZ: 0,
      };
    case 'chinCurtain':
      return {
        style,
        length: 0.85,
        thickness: 1.1,
        bushiness: 0.56,
        width: 1.05,
        curl: 0.18,
        taper: -0.25,
        cheekHeight: 0.28,
        depthOffset: 0,
        offsetY: 0,
        offsetZ: 0,
      };
    case 'shortBoxed':
      return {
        style,
        length: 0.64,
        thickness: 0.92,
        bushiness: 0.42,
        width: 1.04,
        curl: 0.12,
        taper: -0.15,
        cheekHeight: 0.52,
        depthOffset: 0,
        offsetY: 0,
        offsetZ: 0,
      };
    case 'fullTrimmed':
      return {
        style,
        length: 0.96,
        thickness: 1.15,
        bushiness: 0.62,
        width: 1.12,
        curl: 0.2,
        taper: -0.15,
        cheekHeight: 0.68,
        depthOffset: 0,
        offsetY: 0,
        offsetZ: 0,
      };
    case 'bushyLumberjack':
      return {
        style,
        length: 1.32,
        thickness: 1.48,
        bushiness: 0.92,
        width: 1.28,
        curl: 0.36,
        taper: -0.35,
        cheekHeight: 0.78,
        depthOffset: 0.002,
        offsetY: 0,
        offsetZ: 0,
      };
    case 'ducktail':
      return {
        style,
        length: 1.24,
        thickness: 1.16,
        bushiness: 0.55,
        width: 1.06,
        curl: 0.16,
        taper: 0.72,
        cheekHeight: 0.62,
        depthOffset: 0,
        offsetY: 0,
        offsetZ: 0,
      };
    case 'wizardLong':
      return {
        style,
        length: 1.95,
        thickness: 1.32,
        bushiness: 0.78,
        width: 1.18,
        curl: 0.44,
        taper: 0.45,
        cheekHeight: 0.72,
        depthOffset: 0.002,
        offsetY: 0,
        offsetZ: 0,
      };
    case 'vikingBraided':
      return {
        style,
        length: 1.65,
        thickness: 1.38,
        bushiness: 0.74,
        width: 1.22,
        curl: 0.28,
        taper: 0.2,
        cheekHeight: 0.72,
        depthOffset: 0.002,
        offsetY: 0,
        offsetZ: 0,
      };
    case 'muttonChops':
      return {
        style,
        length: 0.9,
        thickness: 1.28,
        bushiness: 0.76,
        width: 1.2,
        curl: 0.25,
        taper: -0.2,
        cheekHeight: 0.7,
        depthOffset: 0,
        offsetY: 0,
        offsetZ: 0,
      };
    case 'none':
    default:
      return {
        style: 'none',
        length: 0.9,
        thickness: 1.0,
        bushiness: 0.5,
        width: 1.0,
        curl: 0.18,
        taper: 0.0,
        cheekHeight: 0.55,
        depthOffset: 0,
        offsetY: 0,
        offsetZ: 0,
      };
  }
}

export function createSideburnsPresetConfig(style: CharacterSideburnsStyle): CharacterSideburnsConfig {
  switch (style) {
    case 'shortNeat':
      return {
        style,
        connectToHair: true,
        connectToBeard: false,
        length: 0.45,
        width: 0.75,
        thickness: 0.75,
        flare: 0.0,
        depthOffset: 0,
        offsetY: 0,
        offsetZ: 0,
      };
    case 'pointed':
      return {
        style,
        connectToHair: true,
        connectToBeard: false,
        length: 0.78,
        width: 0.85,
        thickness: 0.85,
        flare: -0.15,
        depthOffset: 0,
        offsetY: 0,
        offsetZ: 0,
      };
    case 'flared':
      return {
        style,
        connectToHair: true,
        connectToBeard: false,
        length: 0.95,
        width: 1.22,
        thickness: 1.1,
        flare: 0.52,
        depthOffset: 0,
        offsetY: 0,
        offsetZ: 0,
      };
    case 'muttonChops':
      return {
        style,
        connectToHair: true,
        connectToBeard: false,
        length: 1.24,
        width: 1.65,
        thickness: 1.38,
        flare: 0.85,
        depthOffset: 0.002,
        offsetY: 0,
        offsetZ: 0,
      };
    case 'connectedFull':
      return {
        style,
        connectToHair: true,
        connectToBeard: true,
        length: 1.35,
        width: 1.05,
        thickness: 1.05,
        flare: 0.18,
        depthOffset: 0,
        offsetY: 0,
        offsetZ: 0,
      };
    case 'none':
    default:
      return {
        style: 'none',
        connectToHair: true,
        connectToBeard: false,
        length: 0.65,
        width: 0.9,
        thickness: 0.9,
        flare: 0.05,
        depthOffset: 0,
        offsetY: 0,
        offsetZ: 0,
      };
  }
}

export function createDefaultStubbleConfig(): CharacterStubbleConfig {
  return {
    style: 'none',
    opacity: 0.48,
    density: 0.68,
    softness: 0.65,
    cheekHeight: 0.55,
    color: '#2B211B',
  };
}

export function createDefaultFacialHairConfig(hairColor = '#5C3A21'): CharacterFacialHairConfig {
  return {
    color: hairColor,
    accentColor: '#9A7B5C',
    matchHairColor: true,
    depthOffset: 0,
    mustache: createMustachePresetConfig('none'),
    beard: createBeardPresetConfig('none'),
    sideburns: createSideburnsPresetConfig('none'),
    stubble: createDefaultStubbleConfig(),
  };
}

export function resolveFacialHairConfig(
  doc: CharacterMakerDoc
): CharacterFacialHairConfig {
  const base = createDefaultFacialHairConfig(doc.hairColor || '#5C3A21');
  const u = doc.facialHair;
  if (!u) return base;

  const mBase = createMustachePresetConfig(u.mustache?.style ?? 'none');
  const uM = u.mustache;
  const mLeft = { ...mBase.left, ...(uM?.left ?? {}) };
  const mRight = uM?.mirrorSides
    ? { ...mLeft }
    : { ...mBase.right, ...(uM?.right ?? {}) };

  const bStyle = u.beard?.style ?? 'none';
  const bBase = createBeardPresetConfig(bStyle);
  const sStyle = u.sideburns?.style ?? 'none';
  const sBase = createSideburnsPresetConfig(sStyle);
  const stBase = createDefaultStubbleConfig();

  const resolvedColor = u.matchHairColor ?? base.matchHairColor
    ? doc.hairColor || base.color
    : u.color || base.color;

  return {
    color: resolvedColor,
    accentColor: u.accentColor ?? base.accentColor,
    matchHairColor: u.matchHairColor ?? base.matchHairColor,
    depthOffset: u.depthOffset ?? 0,
    mustache: {
      style: uM?.style ?? 'none',
      mirrorSides: uM?.mirrorSides ?? true,
      left: mLeft,
      right: mRight,
    },
    beard: { ...bBase, ...(u.beard ?? {}) },
    sideburns: { ...sBase, ...(u.sideburns ?? {}) },
    stubble: {
      ...stBase,
      ...(u.stubble ?? {}),
      color: u.stubble?.color || resolvedColor,
    },
  };
}

export const FACIAL_HAIR_COMBO_PRESETS: FacialHairComboPreset[] = [
  {
    id: 'clean',
    label: 'Clean Shaven',
    apply: () => ({
      mustache: createMustachePresetConfig('none'),
      beard: createBeardPresetConfig('none'),
      sideburns: createSideburnsPresetConfig('none'),
      stubble: { ...createDefaultStubbleConfig(), style: 'none' },
    }),
  },
  {
    id: 'fiveOClock',
    label: "5 O'Clock",
    apply: (c) => ({
      mustache: createMustachePresetConfig('none'),
      beard: createBeardPresetConfig('none'),
      sideburns: createSideburnsPresetConfig('shortNeat'),
      stubble: {
        style: 'fiveOClock',
        opacity: 0.45,
        density: 0.72,
        softness: 0.7,
        cheekHeight: 0.56,
        color: c,
      },
    }),
  },
  {
    id: 'dapperHandlebar',
    label: 'Handlebar + Van Dyke',
    apply: (c) => ({
      mustache: createMustachePresetConfig('handlebar'),
      beard: createBeardPresetConfig('vanDyke'),
      sideburns: createSideburnsPresetConfig('pointed'),
      stubble: {
        style: 'designer',
        opacity: 0.25,
        density: 0.65,
        softness: 0.7,
        cheekHeight: 0.45,
        color: c,
      },
    }),
  },
  {
    id: 'lumberjack',
    label: 'Lumberjack',
    apply: () => ({
      mustache: createMustachePresetConfig('chevron'),
      beard: createBeardPresetConfig('bushyLumberjack'),
      sideburns: createSideburnsPresetConfig('connectedFull'),
      stubble: { ...createDefaultStubbleConfig(), style: 'none' },
    }),
  },
  {
    id: 'wizard',
    label: 'Grand Wizard',
    apply: () => ({
      mustache: createMustachePresetConfig('walrus'),
      beard: createBeardPresetConfig('wizardLong'),
      sideburns: createSideburnsPresetConfig('connectedFull'),
      stubble: { ...createDefaultStubbleConfig(), style: 'none' },
    }),
  },
  {
    id: 'viking',
    label: 'Viking Raider',
    apply: () => ({
      mustache: createMustachePresetConfig('imperial'),
      beard: createBeardPresetConfig('vikingBraided'),
      sideburns: createSideburnsPresetConfig('connectedFull'),
      stubble: { ...createDefaultStubbleConfig(), style: 'none' },
    }),
  },
  {
    id: 'chops',
    label: 'Mutton Chops',
    apply: () => ({
      mustache: createMustachePresetConfig('handlebar'),
      beard: createBeardPresetConfig('none'),
      sideburns: createSideburnsPresetConfig('muttonChops'),
      stubble: { ...createDefaultStubbleConfig(), style: 'none' },
    }),
  },
];

export interface FacialHairSpatialContext {
  evaluator: SdfFieldEvaluator;
  headBone: THREE.Bone;
  headPos: THREE.Vector3;
  headBotY: number;
  headTopY: number;
  headRadiusX: number;
  headRadiusY: number;
  headRadiusZ: number;
  jawEndY: number;
  jawEndZ: number;
  hasMuzzle: boolean;
  muzzleStartPt: THREE.Vector3;
  muzzleEndPt: THREE.Vector3;
  muzzleDir: THREE.Vector3;
  muzzleWidth: number;
  muzzleHeight: number;
  noseSurfacePt: THREE.Vector3;
  noseRadiusX: number;
  noseRadiusY: number;
  mouthSurfacePt: THREE.Vector3;
  mouthHalfWidth: number;
  mouthHalfHeight: number;
  mouthTiltRad: number;
  leftMouthOffsetY: number;
  rightMouthOffsetY: number;
  isOpenMouth: boolean;
  hairActive: boolean;
  hairTempleY: number;
  hairSideOffsetX: number;
  skinColorHex: string;
}

/**
 * Creates a closed, softly rounded, tapered hair strand geometry along a Catmull-Rom curve.
 * Both root and tip taper smoothly to rounded pole vertices (zero blocky/harsh open caps).
 */
function createSoftStrandGeometry(
  pts: THREE.Vector3[],
  rRoot: number,
  rMid: number,
  rTip: number,
  flattenRadial: number,
  rootColor: THREE.Color,
  midColor: THREE.Color,
  tipColor: THREE.Color,
  faceCenterRef: THREE.Vector3,
  lengthSegsOverride?: number,
  radialSegs = 10
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.45);
  const lengthSegs = lengthSegsOverride ?? Math.max(12, Math.min(26, pts.length * 4));
  const ringVerts = radialSegs + 1;
  // +2 vertices for smooth rounded root pole & soft feathered tip pole
  const bodyVerts = (lengthSegs + 1) * ringVerts;
  const vertCount = bodyVerts + 2;
  const positions = new Float32Array(vertCount * 3);
  const colors = new Float32Array(vertCount * 3);
  const indices: number[] = [];

  const tangents: THREE.Vector3[] = [];
  for (let i = 0; i <= lengthSegs; i++) {
    tangents.push(curve.getTangent(i / lengthSegs).normalize());
  }

  const normals: THREE.Vector3[] = [];
  const binormals: THREE.Vector3[] = [];
  const t0 = tangents[0];
  const out0 = pts[0].clone().sub(faceCenterRef);
  out0.addScaledVector(t0, -out0.dot(t0));
  let n0: THREE.Vector3;
  if (out0.lengthSq() > 1e-6) {
    n0 = out0.normalize();
  } else {
    const refVec = Math.abs(t0.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    n0 = new THREE.Vector3().crossVectors(t0, refVec).normalize();
  }
  normals.push(n0);
  binormals.push(new THREE.Vector3().crossVectors(t0, n0).normalize());

  const rotQ = new THREE.Quaternion();
  for (let i = 1; i <= lengthSegs; i++) {
    const prevT = tangents[i - 1];
    const curT = tangents[i];
    const dotVal = THREE.MathUtils.clamp(prevT.dot(curT), -1, 1);
    const prevN = normals[i - 1];
    let nextN: THREE.Vector3;
    if (dotVal < 0.9999 && dotVal > -0.9999) {
      const axis = new THREE.Vector3().crossVectors(prevT, curT).normalize();
      rotQ.setFromAxisAngle(axis, Math.acos(dotVal));
      nextN = prevN.clone().applyQuaternion(rotQ).normalize();
    } else {
      nextN = prevN.clone();
    }
    const pCur = curve.getPoint(i / lengthSegs);
    const outDir = pCur.sub(faceCenterRef);
    outDir.addScaledVector(curT, -outDir.dot(curT));
    if (outDir.lengthSq() > 1e-6) {
      outDir.normalize();
      if (nextN.dot(outDir) < 0) outDir.negate();
      nextN.lerp(outDir, 0.45).normalize();
    }
    normals.push(nextN);
    binormals.push(new THREE.Vector3().crossVectors(curT, nextN).normalize());
  }

  const tmpPt = new THREE.Vector3();
  const tmpCol = new THREE.Color();

  for (let i = 0; i <= lengthSegs; i++) {
    const u = i / lengthSegs;
    const p = curve.getPoint(u, tmpPt);
    const n = normals[i];
    const b = binormals[i];

    // Smooth teardrop swell: soft tapered root -> full mid-body -> feathered soft tip
    let rad: number;
    if (u < 0.16) {
      const k = u / 0.16;
      const ease = Math.sin(k * Math.PI * 0.5);
      rad = THREE.MathUtils.lerp(rRoot * 0.28, rMid, ease);
    } else if (u < 0.45) {
      const k = (u - 0.16) / 0.29;
      rad = THREE.MathUtils.lerp(rMid, rMid * 1.04, Math.sin(k * Math.PI));
    } else {
      const k = (u - 0.45) / 0.55;
      // Soft cosine-power taper all the way to a delicate rounded tip
      const taper = Math.pow(Math.max(0, 1 - k), 0.78);
      rad = THREE.MathUtils.lerp(rTip * 0.25, rMid, taper);
    }
    if (i === lengthSegs) {
      rad = Math.max(0.0007, rTip * 0.18);
    }

    const rOut = rad * flattenRadial;
    const rWide = rad * 1.28;

    if (u < 0.45) {
      tmpCol.copy(rootColor).lerp(midColor, u / 0.45);
    } else {
      tmpCol.copy(midColor).lerp(tipColor, (u - 0.45) / 0.55);
    }

    for (let j = 0; j <= radialSegs; j++) {
      const ang = (j / radialSegs) * Math.PI * 2;
      // Soft double-strand ridge along width for layered hair silhouette
      const groove = 1 + 0.065 * Math.cos(ang * 2) * (1 - u * 0.5);
      const ca = Math.cos(ang) * rOut * groove;
      const sa = Math.sin(ang) * rWide * groove;
      const idx = (i * ringVerts + j) * 3;
      positions[idx] = p.x + n.x * ca + b.x * sa;
      positions[idx + 1] = p.y + n.y * ca + b.y * sa;
      positions[idx + 2] = p.z + n.z * ca + b.z * sa;
      colors[idx] = tmpCol.r;
      colors[idx + 1] = tmpCol.g;
      colors[idx + 2] = tmpCol.b;
    }
  }

  // Smooth rounded start pole
  const startPoleIdx = bodyVerts;
  const pStart = curve.getPoint(0);
  const startCapExtend = Math.min(0.006, rRoot * 0.35);
  positions[startPoleIdx * 3] = pStart.x - tangents[0].x * startCapExtend;
  positions[startPoleIdx * 3 + 1] = pStart.y - tangents[0].y * startCapExtend;
  positions[startPoleIdx * 3 + 2] = pStart.z - tangents[0].z * startCapExtend;
  colors[startPoleIdx * 3] = rootColor.r;
  colors[startPoleIdx * 3 + 1] = rootColor.g;
  colors[startPoleIdx * 3 + 2] = rootColor.b;

  // Smooth feathered tip pole
  const endPoleIdx = bodyVerts + 1;
  const pEnd = curve.getPoint(1);
  const endCapExtend = Math.min(0.005, rTip * 0.45 + 0.0012);
  positions[endPoleIdx * 3] = pEnd.x + tangents[lengthSegs].x * endCapExtend;
  positions[endPoleIdx * 3 + 1] = pEnd.y + tangents[lengthSegs].y * endCapExtend;
  positions[endPoleIdx * 3 + 2] = pEnd.z + tangents[lengthSegs].z * endCapExtend;
  colors[endPoleIdx * 3] = tipColor.r;
  colors[endPoleIdx * 3 + 1] = tipColor.g;
  colors[endPoleIdx * 3 + 2] = tipColor.b;

  for (let j = 0; j < radialSegs; j++) {
    indices.push(startPoleIdx, j, j + 1);
  }
  for (let i = 0; i < lengthSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * ringVerts + j;
      const b = (i + 1) * ringVerts + j;
      const c = (i + 1) * ringVerts + (j + 1);
      const d = i * ringVerts + (j + 1);
      indices.push(a, d, b, d, c, b);
    }
  }
  const lastRingStart = lengthSegs * ringVerts;
  for (let j = 0; j < radialSegs; j++) {
    indices.push(lastRingStart + j, endPoleIdx, lastRingStart + j + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function mergeStrandGeometries(parts: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  if (parts.length === 0) return null;
  let totalVerts = 0;
  const normalized = parts.map((raw) => {
    const g = raw.index ? raw.toNonIndexed() : raw;
    totalVerts += g.attributes.position.count;
    return g;
  });

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const colors = new Float32Array(totalVerts * 3);
  let offset = 0;

  for (let idx = 0; idx < normalized.length; idx++) {
    const g = normalized[idx];
    const posAttr = g.attributes.position as THREE.BufferAttribute;
    const normAttr = g.attributes.normal as THREE.BufferAttribute | undefined;
    const colAttr = g.attributes.color as THREE.BufferAttribute | undefined;
    const count = posAttr.count;
    for (let i = 0; i < count; i++) {
      const dst = (offset + i) * 3;
      positions[dst] = posAttr.getX(i);
      positions[dst + 1] = posAttr.getY(i);
      positions[dst + 2] = posAttr.getZ(i);
      if (normAttr) {
        normals[dst] = normAttr.getX(i);
        normals[dst + 1] = normAttr.getY(i);
        normals[dst + 2] = normAttr.getZ(i);
      } else {
        normals[dst + 1] = 1;
      }
      if (colAttr) {
        colors[dst] = colAttr.getX(i);
        colors[dst + 1] = colAttr.getY(i);
        colors[dst + 2] = colAttr.getZ(i);
      } else {
        colors[dst] = 1;
        colors[dst + 1] = 1;
        colors[dst + 2] = 1;
      }
    }
    offset += count;
    if (g !== parts[idx]) g.dispose();
  }
  for (const p of parts) p.dispose();

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  merged.computeBoundingSphere();
  return merged;
}

/** Projects a target world-space facial point onto the actual SDF head/jaw/muzzle skin */
function projectFaceSurfacePoint(
  ctx: FacialHairSpatialContext,
  targetWorld: THREE.Vector3,
  surfaceBias = 0
): { point: THREE.Vector3; normal: THREE.Vector3 } {
  const spineCenter = ctx.hasMuzzle
    ? ctx.muzzleStartPt.clone().lerp(ctx.muzzleEndPt, 0.45)
    : new THREE.Vector3(0, THREE.MathUtils.clamp(targetWorld.y, ctx.jawEndY + 0.02, ctx.headTopY - 0.02), ctx.headPos.z);

  const interior = new THREE.Vector3(
    THREE.MathUtils.clamp(targetWorld.x * 0.25, -ctx.headRadiusX * 0.35, ctx.headRadiusX * 0.35),
    THREE.MathUtils.lerp(spineCenter.y, targetWorld.y, 0.55),
    spineCenter.z - ctx.headRadiusZ * 0.08
  );
  // Ensure interior point is strictly inside the SDF
  if (ctx.evaluator.evaluate(interior.x, interior.y, interior.z) >= -0.01) {
    interior.copy(ctx.headPos);
  }

  const rayDir = targetWorld.clone().sub(interior);
  if (rayDir.lengthSq() < 1e-6) rayDir.set(0, 0, 1);
  rayDir.normalize();

  const hit =
    ctx.evaluator.projectOutwardFromInterior(interior, rayDir, 0.8) ??
    ctx.evaluator.projectPointToSurface(
      targetWorld.clone().addScaledVector(rayDir, 0.08),
      rayDir,
      20
    );

  const pt = hit.point.clone().addScaledVector(hit.normal, surfaceBias);
  return { point: pt, normal: hit.normal.clone().normalize() };
}

/** Projects an azimuthal/height ray outward from the head/muzzle interior onto the SDF skin */
function projectAzimuthToFace(
  ctx: FacialHairSpatialContext,
  azRad: number,
  worldY: number,
  surfaceBias = 0
): { point: THREE.Vector3; normal: THREE.Vector3 } {
  let spineZ = ctx.headPos.z;
  if (ctx.hasMuzzle) {
    const mFrac = THREE.MathUtils.clamp(1 - Math.abs(azRad) / (Math.PI * 0.55), 0, 1);
    const mPt = ctx.muzzleStartPt.clone().lerp(ctx.muzzleEndPt, 0.55);
    spineZ = THREE.MathUtils.lerp(ctx.headPos.z, mPt.z, mFrac * 0.85);
  }
  const interior = new THREE.Vector3(
    0,
    THREE.MathUtils.clamp(worldY, ctx.jawEndY + 0.025, ctx.headTopY - 0.02),
    spineZ - ctx.headRadiusZ * 0.1
  );
  if (ctx.evaluator.evaluate(interior.x, interior.y, interior.z) >= -0.01) {
    interior.copy(ctx.headPos);
  }
  const yTilt = THREE.MathUtils.clamp((worldY - interior.y) * 1.4, -0.55, 0.45);
  const dir = new THREE.Vector3(Math.sin(azRad), yTilt, Math.cos(azRad)).normalize();

  const hit =
    ctx.evaluator.projectOutwardFromInterior(interior, dir, 0.85) ??
    ctx.evaluator.projectPointToSurface(
      interior.clone().addScaledVector(dir, ctx.headRadiusZ + 0.14),
      dir,
      22
    );

  return {
    point: hit.point.clone().addScaledVector(hit.normal, surfaceBias),
    normal: hit.normal.clone().normalize(),
  };
}

/** Builds the layered 3D Mustache (independent Left & Right sides, full style range) */
function buildMustacheSideStrands(
  ctx: FacialHairSpatialContext,
  style: CharacterMustacheStyle,
  sideSign: 1 | -1,
  sideCfg: CharacterMustacheSideConfig,
  globalDepthOffset: number,
  rootColor: THREE.Color,
  midColor: THREE.Color,
  tipColor: THREE.Color
): THREE.BufferGeometry[] {
  if (style === 'none' || !sideCfg.enabled) return [];

  const parts: THREE.BufferGeometry[] = [];
  const headScale = THREE.MathUtils.clamp(ctx.headRadiusX / 0.19, 0.5, 2.4);
  const faceCenterLocal = new THREE.Vector3(0, 0, 0);

  // Anchor dynamically between actual nose bottom and actual mouth top!
  const noseBottomY = ctx.noseSurfacePt.y - ctx.noseRadiusY * 0.82;
  const mouthTopY = ctx.mouthSurfacePt.y + ctx.mouthHalfHeight * 0.78;
  const baseLipMidY =
    noseBottomY >= mouthTopY
      ? THREE.MathUtils.lerp(mouthTopY, noseBottomY, 0.44)
      : mouthTopY + 0.004 * headScale;

  // Track individual side mouth Y offset if mouth is asymmetric
  const sideMouthDy = sideSign > 0 ? ctx.leftMouthOffsetY : ctx.rightMouthOffsetY;
  const anchorWorldY = baseLipMidY + sideMouthDy * 0.45 + sideCfg.offsetY;

  const sc = THREE.MathUtils.clamp(sideCfg.scale, 0.35, 2.0);
  const thick = THREE.MathUtils.clamp(sideCfg.thickness, 0.2, 2.5) * sc;
  const lenMult = THREE.MathUtils.clamp(sideCfg.length, 0.25, 2.5) * sc;
  const curl = THREE.MathUtils.clamp(sideCfg.curl, -1.4, 2.0);
  const bushy = THREE.MathUtils.clamp(sideCfg.bushiness, 0, 1);
  const angleRad = THREE.MathUtils.degToRad(sideCfg.angleDeg);
  const depthBias = globalDepthOffset + sideCfg.offsetZ;

  // Base span tracks head width & mouth width so mustache scales cleanly with any head/mouth size
  const baseSpan = Math.max(ctx.mouthHalfWidth * 1.18, ctx.headRadiusX * 0.34) * lenMult;
  const baseStrandR = 0.0068 * headScale * thick;

  const isToothbrush = style === 'toothbrush';
  const isFuManchu = style === 'fuManchu';
  const isHorseshoe = style === 'horseshoe';
  const isWalrus = style === 'walrus';
  const isHandlebar = style === 'handlebar' || style === 'imperial' || style === 'dali';

  // Root X starts near philtrum center (with offsetX gap)
  const rootGap = isToothbrush
    ? 0.0015 * headScale + sideCfg.offsetX
    : 0.0045 * headScale + sideCfg.offsetX;

  const layerCount = bushy > 0.62 ? 3 : bushy > 0.2 ? 2 : 1;
  const strandsPerLayer = isToothbrush ? 3 : Math.round(3 + bushy * 5);

  for (let layer = 0; layer < layerCount; layer++) {
    const layerFrac = layerCount === 1 ? 0.5 : layer / (layerCount - 1);
    for (let sIdx = 0; sIdx < strandsPerLayer; sIdx++) {
      const sf = strandsPerLayer === 1 ? 0.5 : sIdx / (strandsPerLayer - 1);
      const seed = hash01(layer * 47 + sIdx * 19 + (sideSign > 0 ? 3 : 11));

      // Stagger roots vertically across upper lip & slightly outward along wing
      const rootYOff = (sf - 0.5) * (isToothbrush ? 0.008 : 0.011) * headScale * (0.5 + thick * 0.45);
      const rootXStart = sideSign * Math.max(0.0008, rootGap + (layerFrac * 0.004 + sf * 0.007) * headScale);
      const rootWorldPos = new THREE.Vector3(
        rootXStart,
        anchorWorldY + rootYOff,
        ctx.mouthSurfacePt.z + 0.01
      );
      const rootHit = projectFaceSurfacePoint(
        ctx,
        rootWorldPos,
        depthBias + (0.0012 + layerFrac * 0.0032 * (0.6 + bushy * 0.7)) * headScale
      );

      // Compute wing path along skin contour + curl
      const wingSpan = baseSpan * (0.82 + layerFrac * 0.12 + (seed - 0.5) * 0.14);
      const ptsWorld: THREE.Vector3[] = [rootHit.point];

      const midCount = isHandlebar || Math.abs(curl) > 0.5 || isHorseshoe || isFuManchu ? 5 : 3;
      for (let m = 1; m <= midCount; m++) {
        const t = m / midCount;
        // Azimuth / lateral sweep along face curve
        const lat = rootXStart + sideSign * wingSpan * (isHorseshoe || isFuManchu ? Math.sin(t * Math.PI * 0.58) : t);

        // Vertical drop / sweep from angle + natural arch
        let dy = Math.tan(angleRad) * wingSpan * t * 0.55;
        if (isWalrus) {
          dy -= Math.pow(t, 1.35) * 0.022 * headScale * lenMult;
        } else if (isHorseshoe) {
          dy -= Math.pow(t, 1.3) * 0.048 * headScale * lenMult;
        } else if (isFuManchu) {
          dy -= Math.pow(t, 1.15) * 0.085 * headScale * lenMult;
        } else {
          dy -= Math.sin(t * Math.PI * 0.65) * 0.006 * headScale;
        }

        // Curl term at the outer tip (positive = handlebar curl up, negative = extra droop)
        let tipCurlX = 0;
        let tipCurlY = 0;
        let tipCurlZ = 0;
        if (t > 0.45) {
          const ct = (t - 0.45) / 0.55;
          if (curl > 0.05) {
            const cAng = ct * Math.min(Math.PI * 1.45, curl * Math.PI * 0.92);
            const curlRad = wingSpan * (0.14 + Math.min(0.22, curl * 0.14));
            tipCurlX = sideSign * (Math.sin(cAng) * curlRad * 0.45 - ct * wingSpan * 0.12);
            tipCurlY = (1 - Math.cos(cAng)) * curlRad + ct * 0.012 * curl * headScale;
            tipCurlZ = Math.sin(ct * Math.PI) * 0.008 * curl * headScale;
          } else if (curl < -0.05) {
            tipCurlY = ct * ct * curl * 0.032 * headScale;
            tipCurlX = -sideSign * ct * ct * Math.abs(curl) * 0.008 * headScale;
          }
        }

        // Project intermediate body points onto SDF skin, letting outer curled tips lift off gracefully
        const projWeight = t < 0.6 ? 1.0 : Math.max(0.18, 1 - (t - 0.6) * (Math.abs(curl) > 0.35 ? 1.7 : 0.7));
        const target = new THREE.Vector3(
          lat + tipCurlX,
          anchorWorldY + rootYOff * (1 - t * 0.45) + dy + tipCurlY,
          ctx.mouthSurfacePt.z
        );
        const surf = projectFaceSurfacePoint(
          ctx,
          target,
          depthBias + (0.002 + layerFrac * 0.0048 * (0.5 + bushy * 0.8) + t * 0.003 * (0.3 + bushy)) * headScale
        );

        const pFinal = surf.point.clone();
        if (projWeight < 1) {
          const prev = ptsWorld[ptsWorld.length - 1];
          const lifted = new THREE.Vector3(
            lat + tipCurlX,
            anchorWorldY + rootYOff * 0.5 + dy + tipCurlY,
            prev.z + tipCurlZ
          );
          pFinal.lerp(lifted, 1 - projWeight);
        }
        pFinal.z += tipCurlZ;
        ptsWorld.push(pFinal);
      }

      const ptsLocal = ptsWorld.map((w) => w.clone().sub(ctx.headPos));
      const rScale = (layer === 0 ? 1.08 : layer === 1 ? 0.88 : 0.66) * (0.85 + seed * 0.3);
      const geo = createSoftStrandGeometry(
        ptsLocal,
        baseStrandR * 0.85 * rScale,
        baseStrandR * 1.12 * rScale,
        baseStrandR * 0.24 * rScale,
        0.58,
        rootColor,
        midColor,
        tipColor,
        faceCenterLocal,
        isHandlebar || isFuManchu ? 20 : 14,
        10
      );
      parts.push(geo);
    }
  }

  return parts;
}

/** Builds layered soft-ended 3D Beard strands conforming to head/jaw/muzzle/mouth */
function buildBeardStrands(
  ctx: FacialHairSpatialContext,
  beard: CharacterBeardConfig,
  globalDepthOffset: number,
  rootColor: THREE.Color,
  midColor: THREE.Color,
  tipColor: THREE.Color
): THREE.BufferGeometry[] {
  const style = beard.style;
  if (style === 'none') return [];

  const parts: THREE.BufferGeometry[] = [];
  const headScale = THREE.MathUtils.clamp(ctx.headRadiusX / 0.19, 0.5, 2.4);
  const faceCenterLocal = new THREE.Vector3(0, 0, 0);

  const thick = THREE.MathUtils.clamp(beard.thickness, 0.3, 2.4);
  const lenMult = THREE.MathUtils.clamp(beard.length, 0.2, 2.5);
  const bushy = THREE.MathUtils.clamp(beard.bushiness, 0, 1);
  const widthMult = THREE.MathUtils.clamp(beard.width, 0.35, 2.0);
  const curl = THREE.MathUtils.clamp(beard.curl, 0, 1.2);
  const taper = THREE.MathUtils.clamp(beard.taper, -1, 1);
  const cheekH = THREE.MathUtils.clamp(beard.cheekHeight, 0, 1);
  const depthBias = globalDepthOffset + beard.depthOffset;

  const mouthY = ctx.mouthSurfacePt.y;
  const mouthBotY = mouthY - ctx.mouthHalfHeight * 1.05 - 0.004 * headScale;
  const mouthCornerW = ctx.mouthHalfWidth * 1.12;
  const jawBottomPt = projectAzimuthToFace(ctx, 0, ctx.jawEndY - 0.02 * headScale, 0).point;
  const chinY = Math.min(mouthBotY - 0.025 * headScale, jawBottomPt.y);

  const baseStrandR = 0.0085 * headScale * thick;

  const addStrand = (
    ptsWorld: THREE.Vector3[],
    rMul: number,
    flatten = 0.56,
    segs = 14
  ) => {
    const ptsLocal = ptsWorld.map((w) =>
      w.clone().add(new THREE.Vector3(0, beard.offsetY, beard.offsetZ)).sub(ctx.headPos)
    );
    parts.push(
      createSoftStrandGeometry(
        ptsLocal,
        baseStrandR * 0.88 * rMul,
        baseStrandR * 1.15 * rMul,
        baseStrandR * 0.26 * rMul,
        flatten,
        rootColor,
        midColor,
        tipColor,
        faceCenterLocal,
        segs,
        10
      )
    );
  };

  // Helper to build a single layered jaw/chin/cheek cascade strand starting at (azRad, rootY)
  const spawnJawCascade = (
    azRad: number,
    rootY: number,
    dropLen: number,
    layerFrac: number,
    seed: number,
    rMul: number,
    inwardGather = 0
  ) => {
    const rootHit = projectAzimuthToFace(
      ctx,
      azRad,
      rootY,
      depthBias + (0.001 + layerFrac * 0.005 * (0.5 + bushy)) * headScale
    );
    const pts: THREE.Vector3[] = [rootHit.point];

    // Hug chin contour for upper segment, then drape down with soft curl/taper
    const midY = THREE.MathUtils.lerp(rootY, Math.min(chinY, rootY - dropLen * 0.45), 0.72);
    const midAz = azRad * (1 - inwardGather * 0.25);
    const midHit = projectAzimuthToFace(
      ctx,
      midAz,
      midY,
      depthBias + (0.003 + layerFrac * 0.009 * (0.4 + bushy * 0.9)) * headScale
    );
    pts.push(midHit.point);

    const outHoriz = new THREE.Vector3(midHit.normal.x, 0, midHit.normal.z);
    if (outHoriz.lengthSq() > 1e-4) outHoriz.normalize();

    const stepCount = dropLen > 0.14 * headScale ? 4 : 2;
    for (let k = 1; k <= stepCount; k++) {
      const f = k / stepCount;
      const swayX =
        Math.sin(f * Math.PI * (1.2 + curl * 1.4) + seed * 6.28) *
        curl *
        0.016 *
        headScale *
        f;
      const gatherX = -midHit.point.x * inwardGather * f * 0.55;
      const outPush =
        (bushy * 0.016 * Math.sin(f * Math.PI * 0.75) - f * 0.004 * taper) * headScale;
      const pNext = midHit.point
        .clone()
        .add(
          new THREE.Vector3(
            swayX + gatherX,
            -dropLen * (0.55 + 0.45 * (1 - Math.abs(azRad) / 1.8)) * f,
            (seed - 0.5) * 0.008 * curl * headScale
          )
        )
        .addScaledVector(outHoriz, outPush);
      pts.push(pNext);
    }

    addStrand(pts, rMul, 0.54, stepCount > 2 ? 18 : 13);
  };

  // 1. Soul Patch (always neat soft tuft right below lower lip)
  if (style === 'soulPatch' || style === 'vanDyke') {
    const spLen = (style === 'soulPatch' ? 0.036 : 0.028) * headScale * lenMult;
    for (let i = -1; i <= 1; i++) {
      const x = i * 0.0055 * headScale * widthMult;
      const r0 = projectFaceSurfacePoint(
        ctx,
        new THREE.Vector3(x, mouthBotY - 0.003 * headScale, ctx.mouthSurfacePt.z),
        depthBias + 0.002 * headScale
      );
      const r1 = projectFaceSurfacePoint(
        ctx,
        new THREE.Vector3(x * 0.65, mouthBotY - spLen * 0.55, ctx.mouthSurfacePt.z),
        depthBias + 0.003 * headScale
      );
      const r2 = projectFaceSurfacePoint(
        ctx,
        new THREE.Vector3(x * 0.25, mouthBotY - spLen, ctx.mouthSurfacePt.z),
        depthBias + 0.0015 * headScale
      );
      addStrand([r0.point, r1.point, r2.point], i === 0 ? 1.0 : 0.72, 0.52, 12);
    }
  }

  // 2. Goatee / Van Dyke / Circle Beard
  if (style === 'goatee' || style === 'vanDyke' || style === 'circleBeard') {
    const isCircle = style === 'circleBeard';
    const isVanDyke = style === 'vanDyke';
    const maxAz = (isCircle ? 0.48 : isVanDyke ? 0.34 : 0.4) * widthMult;
    const layers = bushy > 0.5 ? 2 : 1;
    const cols = Math.round((isCircle ? 9 : 7) + bushy * 4);
    for (let l = 0; l < layers; l++) {
      const lf = layers === 1 ? 0.45 : l / (layers - 1);
      for (let c = 0; c < cols; c++) {
        const cf = cols === 1 ? 0 : (c / (cols - 1)) * 2 - 1;
        const az = cf * maxAz;
        const absCf = Math.abs(cf);
        const seed = hash01(l * 59 + c * 23 + 7);
        const rootY =
          isCircle && absCf > 0.58
            ? THREE.MathUtils.lerp(mouthBotY, mouthY + 0.008 * headScale, (absCf - 0.58) / 0.42)
            : mouthBotY - 0.006 * headScale;
        const dropBase = (isVanDyke ? 0.075 : 0.056) * headScale * lenMult;
        const shapeTaper = isVanDyke
          ? 1 - absCf * (0.48 + taper * 0.25)
          : 1 - absCf * Math.max(0.15, 0.32 + taper * 0.28);
        spawnJawCascade(
          az,
          rootY,
          Math.max(0.018 * headScale, dropBase * shapeTaper * (0.88 + seed * 0.24)),
          lf,
          seed,
          (1.0 - lf * 0.16) * (0.88 + seed * 0.24),
          isVanDyke ? 0.42 : 0.18
        );
      }
    }
    return parts;
  }

  if (style === 'soulPatch') return parts;

  // 3. Chin Strap / Chin Curtain
  if (style === 'chinStrap' || style === 'chinCurtain') {
    const isCurtain = style === 'chinCurtain';
    const maxAz = 1.38 * Math.min(1.18, widthMult);
    const cols = Math.round((isCurtain ? 15 : 13) + bushy * 6);
    const layers = isCurtain && bushy > 0.35 ? 2 : 1;
    for (let l = 0; l < layers; l++) {
      const lf = layers === 1 ? 0.4 : l / (layers - 1);
      for (let c = 0; c < cols; c++) {
        const cf = (c / (cols - 1)) * 2 - 1;
        const az = cf * maxAz;
        const absCf = Math.abs(cf);
        const seed = hash01(l * 71 + c * 31 + 19);
        // Curve gently up the jawline on the sides toward sideburns
        const rootY = THREE.MathUtils.lerp(
          chinY + 0.018 * headScale,
          mouthY + 0.02 * headScale * (0.5 + cheekH),
          Math.pow(absCf, 1.35)
        );
        const drop =
          (isCurtain ? 0.068 : 0.028) *
          headScale *
          lenMult *
          (1 - absCf * 0.42) *
          (0.85 + seed * 0.3);
        spawnJawCascade(
          az,
          rootY,
          drop,
          lf,
          seed,
          (isCurtain ? 0.96 : 0.68) * (0.88 + seed * 0.24),
          0.12
        );
      }
    }
    return parts;
  }

  // 4. Mutton Chops (beard style: bushy cheeks framing open chin)
  if (style === 'muttonChops') {
    const layers = bushy > 0.3 ? 2 : 1;
    const colsPerSide = Math.round(6 + bushy * 4);
    ([-1, 1] as const).forEach((sideSign) => {
      for (let l = 0; l < layers; l++) {
        const lf = layers === 1 ? 0.45 : l / (layers - 1);
        for (let c = 0; c < colsPerSide; c++) {
          const cf = c / (colsPerSide - 1); // 0 = near mouth corner, 1 = ear/sideburn line
          const az = sideSign * THREE.MathUtils.lerp(0.42, 1.36, cf) * Math.min(1.18, widthMult);
          const seed = hash01(l * 89 + c * 29 + (sideSign > 0 ? 5 : 13));
          const rootY = THREE.MathUtils.lerp(
            mouthY + (0.01 + cheekH * 0.032) * headScale,
            mouthY + (0.03 + cheekH * 0.045) * headScale,
            cf
          );
          const drop =
            (0.058 + (1 - Math.abs(cf - 0.35)) * 0.035) *
            headScale *
            lenMult *
            (0.85 + seed * 0.3);
          spawnJawCascade(
            az,
            rootY,
            drop,
            lf,
            seed,
            (1.02 - lf * 0.16) * (0.85 + seed * 0.25),
            -0.08
          );
        }
      }
    });
    return parts;
  }

  // 5. Full Beard Family: shortBoxed, fullTrimmed, bushyLumberjack, ducktail, wizardLong, vikingBraided
  const isLong = style === 'wizardLong' || style === 'vikingBraided';
  const isDucktail = style === 'ducktail';
  const isLumberjack = style === 'bushyLumberjack';
  const maxAz = 1.38 * Math.min(1.22, widthMult);
  const layers = bushy > 0.55 || isLumberjack || isLong ? 3 : 2;
  const cols = Math.round(13 + bushy * 8);

  const baseDrop =
    style === 'shortBoxed'
      ? 0.052
      : style === 'fullTrimmed'
        ? 0.085
        : isDucktail
          ? 0.115
          : isLumberjack
            ? 0.125
            : style === 'vikingBraided'
              ? 0.165
              : 0.215;

  for (let l = 0; l < layers; l++) {
    const lf = l / (layers - 1);
    for (let c = 0; c < cols; c++) {
      const cf = (c / (cols - 1)) * 2 - 1;
      const az = cf * maxAz;
      const absCf = Math.abs(cf);
      const seed = hash01(l * 101 + c * 37 + 17);

      // Compute cheek hairline Y while cleanly protecting the mouth opening!
      const cheekTopY = mouthY + (0.016 + cheekH * 0.045) * headScale;
      const centerMouthTestX = Math.sin(az) * ctx.headRadiusX;
      let rootY = THREE.MathUtils.lerp(mouthBotY - 0.004 * headScale, cheekTopY, THREE.MathUtils.smoothstep(absCf, 0.18, 0.65));
      if (Math.abs(centerMouthTestX) < mouthCornerW) {
        rootY = Math.min(rootY, mouthBotY - 0.004 * headScale);
      }

      // Profile length envelope across chin -> cheeks
      const centerWeight = 1 - Math.pow(absCf, isDucktail ? 1.25 : isLumberjack ? 1.9 : 1.55);
      const taperBias = taper * 0.35;
      const env = THREE.MathUtils.clamp(
        centerWeight * (1 + taperBias * (1 - absCf * 1.4)) + 0.22 * (1 - absCf),
        0.18,
        1.28
      );
      const strandDrop = baseDrop * headScale * lenMult * env * (0.86 + seed * 0.28);

      // Viking braided: split center/side lower strands into 2 sculpted twin fork tails + soft ties!
      if (style === 'vikingBraided' && l === layers - 1 && absCf < 0.45) {
        const forkSign = cf >= 0 ? 1 : -1;
        const forkAz = forkSign * 0.22;
        const rootHit = projectAzimuthToFace(
          ctx,
          az,
          rootY,
          depthBias + 0.004 * headScale
        );
        const midHit = projectAzimuthToFace(
          ctx,
          forkAz,
          chinY - strandDrop * 0.32,
          depthBias + 0.008 * headScale
        );
        const tipPt = midHit.point.clone().add(
          new THREE.Vector3(
            forkSign * 0.008 * headScale,
            -strandDrop * 0.68,
            0.006 * headScale
          )
        );
        addStrand(
          [
            rootHit.point,
            midHit.point,
            midHit.point.clone().lerp(tipPt, 0.55).add(new THREE.Vector3(0, 0, 0.005 * headScale)),
            tipPt,
          ],
          1.12,
          0.62,
          16
        );
      } else {
        spawnJawCascade(
          az,
          rootY,
          strandDrop,
          lf,
          seed,
          (1.06 - lf * 0.22) * (0.85 + seed * 0.28),
          isDucktail || style === 'wizardLong' ? 0.32 : isLumberjack ? -0.06 : 0.14
        );
      }
    }
  }

  // Extra soft under-lip fill row on full beards so there's no hollow gap under lower lip
  const underLipCount = 5;
  for (let u = 0; u < underLipCount; u++) {
    const uf = (u / (underLipCount - 1)) * 2 - 1;
    const az = uf * 0.26;
    const seed = hash01(u * 43 + 91);
    spawnJawCascade(
      az,
      mouthBotY - 0.003 * headScale,
      baseDrop * 0.55 * headScale * lenMult * (0.9 + seed * 0.2),
      0.7,
      seed,
      0.86,
      0.22
    );
  }

  return parts;
}

/** Builds layered 3D Sideburns with optional hair-to-beard connection */
function buildSideburnsStrands(
  ctx: FacialHairSpatialContext,
  sb: CharacterSideburnsConfig,
  beard: CharacterBeardConfig,
  globalDepthOffset: number,
  rootColor: THREE.Color,
  midColor: THREE.Color,
  tipColor: THREE.Color
): THREE.BufferGeometry[] {
  if (sb.style === 'none') return [];

  const parts: THREE.BufferGeometry[] = [];
  const headScale = THREE.MathUtils.clamp(ctx.headRadiusX / 0.19, 0.5, 2.4);
  const faceCenterLocal = new THREE.Vector3(0, 0, 0);

  const thick = THREE.MathUtils.clamp(sb.thickness, 0.3, 2.4);
  const lenMult = THREE.MathUtils.clamp(sb.length, 0.2, 2.0);
  const widthMult = THREE.MathUtils.clamp(sb.width, 0.25, 2.2);
  const flare = THREE.MathUtils.clamp(sb.flare, -0.5, 1.2);
  const depthBias = globalDepthOffset + sb.depthOffset;
  const baseStrandR = 0.0074 * headScale * thick;

  const isMutton = sb.style === 'muttonChops' || sb.style === 'flared';
  const isPointed = sb.style === 'pointed';
  const connectHair = sb.connectToHair || sb.style === 'connectedFull';
  const connectBeard = sb.connectToBeard || sb.style === 'connectedFull';

  // Top anchor: connect smoothly up into temple hair if enabled, else mid-temple
  const topAnchorY = connectHair && ctx.hairActive
    ? Math.max(ctx.headPos.y + 0.02 * headScale, ctx.hairTempleY + 0.015 * headScale)
    : ctx.headPos.y + 0.012 * headScale;

  // Bottom anchor: short ear -> mid jaw -> connected seamlessly into beard cheek/jawline
  const jawCornerY = ctx.jawEndY + 0.028 * headScale;
  const baseBottomY = THREE.MathUtils.lerp(
    topAnchorY - 0.055 * headScale,
    jawCornerY - 0.01 * headScale,
    THREE.MathUtils.clamp(lenMult / 1.45, 0.15, 1.0)
  );
  const finalBottomY = connectBeard
    ? Math.min(baseBottomY, jawCornerY - 0.012 * headScale)
    : baseBottomY;

  const strandCols = Math.round(3 + widthMult * 2.5);
  const layers = isMutton ? 2 : 1;

  ([-1, 1] as const).forEach((sideSign) => {
    for (let l = 0; l < layers; l++) {
      const lf = layers === 1 ? 0.5 : l / (layers - 1);
      for (let c = 0; c < strandCols; c++) {
        const cf = strandCols === 1 ? 0.5 : c / (strandCols - 1); // 0 = rear near ear, 1 = front cheek edge
        const seed = hash01(l * 67 + c * 23 + (sideSign > 0 ? 7 : 13));

        const azRear = 1.48;
        const azFront = THREE.MathUtils.lerp(1.28, 0.92, THREE.MathUtils.clamp((widthMult - 0.3) / 1.5, 0, 1));
        const azTop = THREE.MathUtils.lerp(azRear, azFront, cf);

        // Flare widens the lower cheek sweep forward onto the cheek
        const azBot = THREE.MathUtils.clamp(
          azTop - (flare * 0.24 * cf + (connectBeard ? 0.38 : 0)) - (isPointed ? -0.06 * (1 - cf) : 0),
          0.32,
          1.55
        );

        const steps = connectBeard ? 5 : 4;
        const ptsWorld: THREE.Vector3[] = [];
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const azCur = THREE.MathUtils.lerp(azTop, azBot, Math.pow(t, connectBeard ? 1.25 : 0.9));
          const yCur = THREE.MathUtils.lerp(topAnchorY, finalBottomY, t);
          const extraOut =
            (0.0018 + lf * 0.0038 + Math.max(0, flare) * 0.006 * t * cf) * headScale;
          const hit = projectAzimuthToFace(ctx, sideSign * azCur, yCur, depthBias + extraOut);
          ptsWorld.push(hit.point);
        }

        // If connecting to beard and beard is active, curve final tip smoothly into beard chin/jaw
        if (connectBeard && beard.style !== 'none') {
          const joinAz = sideSign * THREE.MathUtils.lerp(0.58, 0.34, cf);
          const joinHit = projectAzimuthToFace(
            ctx,
            joinAz,
            finalBottomY - 0.018 * headScale,
            depthBias + beard.depthOffset + 0.004 * headScale
          );
          ptsWorld.push(joinHit.point);
        }

        const ptsLocal = ptsWorld.map((w) =>
          w.clone().add(new THREE.Vector3(0, sb.offsetY, sb.offsetZ)).sub(ctx.headPos)
        );
        const rMul =
          (isPointed ? 0.85 : isMutton ? 1.15 : 0.92) *
          (1 - lf * 0.16) *
          (0.86 + seed * 0.24);
        parts.push(
          createSoftStrandGeometry(
            ptsLocal,
            baseStrandR * 0.85 * rMul,
            baseStrandR * 1.05 * rMul,
            baseStrandR * (isPointed ? 0.14 : 0.28) * rMul,
            0.52,
            rootColor,
            midColor,
            tipColor,
            faceCenterLocal,
            15,
            10
          )
        );
      }
    }
  });

  return parts;
}

/**
 * Builds a ZERO-MESH-DEPTH conformal skin-painted stubble decal mesh!
 * Projected directly onto the exact SDF head/jaw/muzzle surface so it conforms
 * to any head size, jaw shape, muzzle, and exact nose & mouth positions.
 */
function buildConformalStubbleMesh(
  ctx: FacialHairSpatialContext,
  stubble: CharacterStubbleConfig
): THREE.Mesh | null {
  if (stubble.style === 'none' || stubble.opacity <= 0.01) return null;

  const cols = 45;
  const rows = 31;
  const headScale = THREE.MathUtils.clamp(ctx.headRadiusX / 0.19, 0.5, 2.4);

  const mouthLocal = ctx.mouthSurfacePt.clone().sub(ctx.headPos);
  const noseLocal = ctx.noseSurfacePt.clone().sub(ctx.headPos);

  // Vertical span from cheek/nose bridge level down cleanly under the chin
  const topWorldY = Math.max(
    ctx.noseSurfacePt.y + 0.016 * headScale,
    ctx.mouthSurfacePt.y + 0.068 * headScale
  );
  const botWorldY = ctx.jawEndY - 0.022 * headScale;
  const maxAz = 1.68; // ~96 deg around left & right cheeks

  const gridLocalPos = new Float32Array(cols * rows * 3);
  const positions = new Float32Array(cols * rows * 3);
  const normals = new Float32Array(cols * rows * 3);
  const uvs = new Float32Array(cols * rows * 2);
  const indices: number[] = [];

  for (let r = 0; r < rows; r++) {
    const vf = r / (rows - 1); // 0 = top cheeks/nose, 1 = under chin
    const worldY = THREE.MathUtils.lerp(topWorldY, botWorldY, vf);
    for (let c = 0; c < cols; c++) {
      const uf = c / (cols - 1); // 0 = right cheek (-X), 1 = left cheek (+X)
      const az = (uf * 2 - 1) * maxAz;

      // Project onto exact SDF skin with near-zero bias (0.35mm + polygonOffset = zero mesh depth)
      const hit = projectAzimuthToFace(ctx, az, worldY, 0.00035);
      const localPt = hit.point.clone().sub(ctx.headPos);

      const idx3 = (r * cols + c) * 3;
      gridLocalPos[idx3] = localPt.x;
      gridLocalPos[idx3 + 1] = localPt.y;
      gridLocalPos[idx3 + 2] = localPt.z;

      positions[idx3] = localPt.x;
      positions[idx3 + 1] = localPt.y;
      positions[idx3 + 2] = localPt.z;

      normals[idx3] = hit.normal.x;
      normals[idx3 + 1] = hit.normal.y;
      normals[idx3 + 2] = hit.normal.z;

      const idx2 = (r * cols + c) * 2;
      uvs[idx2] = uf;
      uvs[idx2 + 1] = 1 - vf;
    }
  }

  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c;
      const b = a + 1;
      const d = (r + 1) * cols + c;
      const e = d + 1;
      indices.push(a, d, b, b, d, e);
    }
  }

  // Paint high-res conformal RGBA texture using exact 3D face coordinates at every texel
  const texW = 320;
  const texH = 320;
  const canvas = document.createElement('canvas');
  canvas.width = texW;
  canvas.height = texH;
  const ctx2d = canvas.getContext('2d');
  if (!ctx2d) return null;

  const img = ctx2d.createImageData(texW, texH);
  const data = img.data;

  const stCol = new THREE.Color(stubble.color || '#2B211B');
  const rBase = Math.round(stCol.r * 255);
  const gBase = Math.round(stCol.g * 255);
  const bBase = Math.round(stCol.b * 255);

  const opacity = THREE.MathUtils.clamp(stubble.opacity, 0, 1);
  const density = THREE.MathUtils.clamp(stubble.density, 0.15, 1);
  const soft = THREE.MathUtils.clamp(stubble.softness, 0.1, 1);
  const cheekH = THREE.MathUtils.clamp(stubble.cheekHeight, 0, 1);

  const noseBotY = noseLocal.y - ctx.noseRadiusY * 0.85;
  const noseClearRx = Math.max(0.012 * headScale, ctx.noseRadiusX * 1.18);
  const noseClearRy = Math.max(0.012 * headScale, ctx.noseRadiusY * 1.12);

  const mouthRx = Math.max(0.016 * headScale, ctx.mouthHalfWidth * 1.16);
  const mouthRy = Math.max(0.009 * headScale, ctx.mouthHalfHeight * 1.42 + 0.005 * headScale);
  const cosMT = Math.cos(-ctx.mouthTiltRad);
  const sinMT = Math.sin(-ctx.mouthTiltRad);
  const featherDist = (0.008 + soft * 0.018) * headScale;

  const jawBotLocalY = botWorldY - ctx.headPos.y;
  const sideburnLimitX = ctx.headRadiusX * 0.94;
  const cheekMaxY =
    mouthLocal.y + (0.004 + cheekH * 0.044 + (stubble.style === 'fullHeavy' ? 0.014 : 0)) * headScale;

  for (let py = 0; py < texH; py++) {
    // v = 1 - py/(texH-1), and rowFrac vf = 1 - v = py/(texH-1)
    const vf = py / (texH - 1);
    const rf = vf * (rows - 1);
    const r0 = Math.min(rows - 2, Math.floor(rf));
    const rt = rf - r0;

    for (let px = 0; px < texW; px++) {
      const uf = px / (texW - 1);
      const cf = uf * (cols - 1);
      const c0 = Math.min(cols - 2, Math.floor(cf));
      const ct = cf - c0;

      // Bilinearly interpolate exact 3D head-local surface position
      const i00 = (r0 * cols + c0) * 3;
      const i10 = (r0 * cols + c0 + 1) * 3;
      const i01 = ((r0 + 1) * cols + c0) * 3;
      const i11 = ((r0 + 1) * cols + c0 + 1) * 3;

      const xTop = gridLocalPos[i00] + (gridLocalPos[i10] - gridLocalPos[i00]) * ct;
      const yTop = gridLocalPos[i00 + 1] + (gridLocalPos[i10 + 1] - gridLocalPos[i00 + 1]) * ct;
      const zTop = gridLocalPos[i00 + 2] + (gridLocalPos[i10 + 2] - gridLocalPos[i00 + 2]) * ct;

      const xBot = gridLocalPos[i01] + (gridLocalPos[i11] - gridLocalPos[i01]) * ct;
      const yBot = gridLocalPos[i01 + 1] + (gridLocalPos[i11 + 1] - gridLocalPos[i01 + 1]) * ct;
      const zBot = gridLocalPos[i01 + 2] + (gridLocalPos[i11 + 2] - gridLocalPos[i01 + 2]) * ct;

      const lx = xTop + (xBot - xTop) * rt;
      const ly = yTop + (yBot - yTop) * rt;
      const lz = zTop + (zBot - zTop) * rt;

      // 1. Mouth lip exclusion (tracks mouth position, tilt, asymmetric L/R offset, width, open height)
      const sideDy = lx >= 0 ? ctx.leftMouthOffsetY : ctx.rightMouthOffsetY;
      const mdx = lx - mouthLocal.x;
      const mdy = ly - (mouthLocal.y + sideDy * 0.6);
      const rotMx = mdx * cosMT - mdy * sinMT;
      const rotMy = mdx * sinMT + mdy * cosMT;
      const mouthNormDist = Math.hypot(rotMx / mouthRx, rotMy / mouthRy);
      const mouthClear = THREE.MathUtils.smoothstep(
        mouthNormDist,
        0.92,
        1.14 + soft * 0.24
      );

      // 2. Nose exclusion (tracks nose position & size)
      const ndx = (lx - noseLocal.x) / noseClearRx;
      const ndy = (ly - noseLocal.y) / noseClearRy;
      const noseNormDist = Math.hypot(ndx, ndy);
      const noseClear = THREE.MathUtils.smoothstep(noseNormDist, 0.85, 1.2 + soft * 0.2);

      // 3. Regional stubble mask by style
      const absXNorm = Math.abs(lx) / Math.max(0.05, sideburnLimitX);
      let mask = 0;

      if (stubble.style === 'mustache') {
        const upLipTop = noseBotY + 0.002 * headScale;
        const inUpperLipY =
          THREE.MathUtils.smoothstep(ly, mouthLocal.y - 0.004 * headScale, mouthLocal.y + 0.006 * headScale) *
          (1 - THREE.MathUtils.smoothstep(ly, upLipTop - featherDist * 0.35, upLipTop + featherDist * 0.35));
        const widthEnv = 1 - THREE.MathUtils.smoothstep(Math.abs(lx), mouthRx * 0.85, mouthRx * 1.45);
        mask = inUpperLipY * widthEnv;
      } else if (stubble.style === 'goatee') {
        const chinDist = Math.hypot(lx / (mouthRx * 1.32), (ly - (mouthLocal.y - 0.018 * headScale)) / (0.052 * headScale));
        const chinMask = 1 - THREE.MathUtils.smoothstep(chinDist, 0.72, 1.0 + soft * 0.22);
        const upLipMask =
          THREE.MathUtils.smoothstep(ly, mouthLocal.y, mouthLocal.y + 0.005 * headScale) *
          (1 - THREE.MathUtils.smoothstep(ly, noseBotY - 0.004 * headScale, noseBotY + 0.004 * headScale)) *
          (1 - THREE.MathUtils.smoothstep(Math.abs(lx), mouthRx * 0.85, mouthRx * 1.32));
        mask = Math.max(chinMask, upLipMask);
      } else if (stubble.style === 'chinJaw') {
        const jawYLim = mouthLocal.y - 0.008 * headScale + absXNorm * 0.025 * headScale;
        const topFade = 1 - THREE.MathUtils.smoothstep(ly, jawYLim - featherDist * 0.6, jawYLim + featherDist * 0.45);
        const botFade = THREE.MathUtils.smoothstep(ly, jawBotLocalY, jawBotLocalY + 0.018 * headScale);
        const sideFade = 1 - THREE.MathUtils.smoothstep(absXNorm, 0.86, 1.04);
        mask = topFade * botFade * sideFade;
      } else {
        // 'fiveOClock' | 'designer' | 'fullHeavy'
        const isDesigner = stubble.style === 'designer';
        const isHeavy = stubble.style === 'fullHeavy';

        // Cheek contour curve rises gently from mid-face out toward sideburns, dips cleanly under nose
        const cheekLineY = THREE.MathUtils.lerp(
          noseBotY - 0.002 * headScale,
          cheekMaxY + 0.012 * headScale,
          THREE.MathUtils.smoothstep(absXNorm, 0.22, 0.82)
        );
        // Carve a clean soft curve between nose wing and upper cheek (avoiding harsh nose-bridge mask)
        const upperCheekFade =
          1 -
          THREE.MathUtils.smoothstep(
            ly,
            cheekLineY - featherDist * (isDesigner ? 0.45 : 0.9),
            cheekLineY + featherDist * (isDesigner ? 0.3 : 0.75)
          );
        const lowerNeckFade = THREE.MathUtils.smoothstep(
          ly,
          jawBotLocalY + (isHeavy ? 0.002 : 0.008) * headScale,
          jawBotLocalY + 0.026 * headScale
        );
        const sideFade = 1 - THREE.MathUtils.smoothstep(absXNorm, 0.88, 1.06);

        // Keep center upper-lip strictly below nose base
        const centerNoseGuard =
          absXNorm < 0.28
            ? 1 - THREE.MathUtils.smoothstep(ly, noseBotY - 0.003 * headScale, noseBotY + 0.004 * headScale)
            : 1;

        mask = upperCheekFade * lowerNeckFade * sideFade * centerNoseGuard;
      }

      const finalMask = mask * mouthClear * noseClear;
      if (finalMask <= 0.004) {
        const dst = (py * texW + px) * 4;
        data[dst + 3] = 0;
        continue;
      }

      // 4. Deterministic 3D-space follicle stipple + soft skin shading
      const cellScale = 440 / headScale;
      const gx = Math.floor(lx * cellScale);
      const gy = Math.floor(ly * cellScale);
      const gz = Math.floor(lz * cellScale);
      const stipple = hash3D(gx, gy, gz);
      const grain = 0.48 + (stipple > 1 - density * 0.58 ? 0.52 * density : 0.14 * stipple);

      const alpha = THREE.MathUtils.clamp(finalMask * opacity * grain * 0.92, 0, 1);
      const dst = (py * texW + px) * 4;
      data[dst] = rBase;
      data[dst + 1] = gBase;
      data[dst + 2] = bBase;
      data[dst + 3] = Math.round(alpha * 255);
    }
  }

  ctx2d.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeBoundingSphere();

  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
    roughness: 0.9,
    metalness: 0.0,
    side: THREE.FrontSide,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'CharFacialStubble';
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.renderOrder = 2;
  mesh.userData.noVertexPaint = true;
  mesh.userData.disposeExtra = () => {
    tex.dispose();
  };
  return mesh;
}

/** Builds the complete Beard, Mustache, Sideburns & Painted Stubble group attached to Head Bone */
export function buildFacialHairGroup(
  doc: CharacterMakerDoc,
  facialHair: CharacterFacialHairConfig,
  ctx: FacialHairSpatialContext
): THREE.Group | null {
  const hasMustache =
    facialHair.mustache.style !== 'none' &&
    (facialHair.mustache.left.enabled || facialHair.mustache.right.enabled);
  const hasBeard = facialHair.beard.style !== 'none';
  const hasSideburns = facialHair.sideburns.style !== 'none';
  const hasStubble =
    facialHair.stubble.style !== 'none' && facialHair.stubble.opacity > 0.01;

  if (!hasMustache && !hasBeard && !hasSideburns && !hasStubble) {
    return null;
  }

  const group = new THREE.Group();
  group.name = 'CharFacialHair';

  const baseCol = new THREE.Color(facialHair.color || doc.hairColor || '#5C3A21');
  const accentCol = new THREE.Color(facialHair.accentColor || facialHair.color || '#9A7B5C');
  const rootCol = baseCol.clone().multiplyScalar(0.84);
  const midCol = baseCol.clone();
  const tipCol = baseCol.clone().lerp(accentCol, 0.24);

  // 1. Conformal Zero-Depth Stubble Sticker (always flush on skin)
  if (hasStubble) {
    const stubbleMesh = buildConformalStubbleMesh(ctx, facialHair.stubble);
    if (stubbleMesh) {
      group.add(stubbleMesh);
    }
  }

  const allStrandGeos: THREE.BufferGeometry[] = [];

  // 2. Mustache (Left & Right independent controls)
  if (hasMustache) {
    const m = facialHair.mustache;
    const rightCfg = m.mirrorSides ? m.left : m.right;
    allStrandGeos.push(
      ...buildMustacheSideStrands(
        ctx,
        m.style,
        1,
        m.left,
        facialHair.depthOffset,
        rootCol,
        midCol,
        tipCol
      ),
      ...buildMustacheSideStrands(
        ctx,
        m.style,
        -1,
        rightCfg,
        facialHair.depthOffset,
        rootCol,
        midCol,
        tipCol
      )
    );
  }

  // 3. Beard (Layered soft strands)
  if (hasBeard) {
    allStrandGeos.push(
      ...buildBeardStrands(
        ctx,
        facialHair.beard,
        facialHair.depthOffset,
        rootCol,
        midCol,
        tipCol
      )
    );
  }

  // 4. Sideburns (Connectable up to hair and down into beard)
  if (hasSideburns) {
    allStrandGeos.push(
      ...buildSideburnsStrands(
        ctx,
        facialHair.sideburns,
        facialHair.beard,
        facialHair.depthOffset,
        rootCol,
        midCol,
        tipCol
      )
    );
  }

  const mergedStrands = mergeStrandGeometries(allStrandGeos);
  if (mergedStrands) {
    const strandMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.72,
      metalness: 0.02,
      side: THREE.FrontSide,
    });
    const hairMesh = new THREE.Mesh(mergedStrands, strandMat);
    hairMesh.name = 'CharFacialHairStrands';
    hairMesh.castShadow = true;
    hairMesh.receiveShadow = true;
    group.add(hairMesh);
  }

  return group;
}
