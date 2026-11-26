import * as THREE from 'three';
import {
  MeshBasicNodeMaterial,
  MeshLambertNodeMaterial,
  MeshPhongNodeMaterial,
  MeshPhysicalNodeMaterial,
  MeshStandardNodeMaterial,
  MeshToonNodeMaterial,
  NodeMaterialInstance,
  type NodeMaterial,
} from 'three/webgpu';
import {
  Fn,
  If,
  abs,
  clamp,
  dot,
  float,
  fract,
  materialColor,
  materialDiffuseRoughness,
  materialRoughness,
  materialReference,
  max,
  min,
  mix,
  normalWorld,
  positionLocal,
  positionWorld,
  pow,
  sin,
  cos,
  smoothstep,
  step,
  vec3,
  vec4,
} from 'three/tsl';
import type { EntityMaterialVariant, VisualStyleId, WeatheringPreset } from '../types/maker';
import { attachBotwPainterlyShader } from './botwStyleUtils';

export const WEATHERING_TYPE_MAP: Record<WeatheringPreset, number> = {
  none: 0,
  moss: 1,
  snow: 2,
  wet: 3,
  cracked: 4,
  chipped: 5,
  scorched: 6,
  muddy: 7,
  bleached: 8,
  rusted: 9,
};

export interface WeatheringPresetMeta {
  id: WeatheringPreset;
  label: string;
  shortDesc: string;
  swatch: string;
}

export const WEATHERING_PRESETS: WeatheringPresetMeta[] = [
  { id: 'none', label: 'Clean', shortDesc: 'Pristine unweathered finish', swatch: '#CBD5E1' },
  { id: 'moss', label: 'Moss', shortDesc: 'Lichen & mossy growth in crevices', swatch: '#4B8B3B' },
  { id: 'cracked', label: 'Cracked', shortDesc: 'Fractured fissures & mineral grime', swatch: '#57534E' },
  { id: 'chipped', label: 'Chipped', shortDesc: 'Worn edges, dents & exposed core', swatch: '#D6CFC2' },
  { id: 'scorched', label: 'Scorched', shortDesc: 'Charred soot, ash & fire stain', swatch: '#292524' },
  { id: 'muddy', label: 'Muddy', shortDesc: 'Damp earth splatters & bog rot', swatch: '#6B4C35' },
  { id: 'bleached', label: 'Bleached', shortDesc: 'Sun-faded weathered wood & bone', swatch: '#DDD5C4' },
  { id: 'rusted', label: 'Rusted', shortDesc: 'Oxidized patina & pitted flaking', swatch: '#A64B2A' },
  { id: 'snow', label: 'Frost', shortDesc: 'Cold rime frost & snow dusting', swatch: '#E2EFFA' },
  { id: 'wet', label: 'Wet', shortDesc: 'Rain-darkened slick surface sheen', swatch: '#3B6488' },
];

// Ensure r187's NodeMaterial.setDefaultValues + copy() never triggers the deprecated
// `iridescenceThicknessRange` getter/setter warning on MeshPhysicalNodeMaterial clones.
let _physicalProtoCleaned = false;
function ensurePhysicalNodeProtoCleaned(): void {
  if (_physicalProtoCleaned) return;
  _physicalProtoCleaned = true;
  try {
    const proto = MeshPhysicalNodeMaterial.prototype as unknown as {
      iridescenceThicknessMinimum?: number;
      iridescenceThicknessMaximum?: number;
    };
    const probe = new MeshPhysicalNodeMaterial();
    probe.dispose();
    Object.defineProperty(proto, 'iridescenceThicknessRange', {
      configurable: true,
      enumerable: false,
      get(this: { iridescenceThicknessMinimum?: number; iridescenceThicknessMaximum?: number }) {
        return [this.iridescenceThicknessMinimum ?? 100, this.iridescenceThicknessMaximum ?? 400];
      },
      set(
        this: { iridescenceThicknessMinimum?: number; iridescenceThicknessMaximum?: number },
        value: unknown
      ) {
        if (Array.isArray(value) && value.length >= 2) {
          this.iridescenceThicknessMinimum = Number(value[0]) || 100;
          this.iridescenceThicknessMaximum = Number(value[1]) || 400;
        }
      },
    });
  } catch {
    // ignore if prototype is sealed
  }
}
ensurePhysicalNodeProtoCleaned();

export function isNodeMaterialInstance(mat: THREE.Material | null | undefined): mat is NodeMaterial {
  return Boolean(mat && (mat as unknown as { isNodeMaterial?: boolean }).isNodeMaterial);
}

export function isRealNodeMaterialInstance(
  mat: THREE.Material | null | undefined
): mat is NodeMaterialInstance {
  return Boolean(
    mat && (mat as unknown as { isNodeMaterialInstance?: boolean }).isNodeMaterialInstance
  );
}

/**
 * Enables r187's Energy-Preserving Oren-Nayar (EON) `diffuseRoughness` on matte PBR materials
 * by upgrading classic `MeshStandardMaterial` / `MeshStandardNodeMaterial` into
 * `MeshPhysicalNodeMaterial` (ignoring celToon, transparent, or unlit materials).
 */
export function enableDiffuseRoughnessEon(
  mat: THREE.Material,
  diffuseRoughnessVal = 0.88
): THREE.Material {
  if ((mat as THREE.MeshToonMaterial).isMeshToonMaterial) return mat;
  if ((mat as THREE.MeshBasicMaterial).isMeshBasicMaterial) return mat;
  if (mat.transparent) return mat;

  if ((mat as MeshPhysicalNodeMaterial).isMeshPhysicalNodeMaterial) {
    (mat as MeshPhysicalNodeMaterial).diffuseRoughness = THREE.MathUtils.clamp(
      diffuseRoughnessVal,
      0,
      1
    );
    return mat;
  }

  if (isRealNodeMaterialInstance(mat)) {
    const asPhys = mat as unknown as { diffuseRoughness?: number };
    asPhys.diffuseRoughness = THREE.MathUtils.clamp(diffuseRoughnessVal, 0, 1);
    return mat;
  }

  const phys = new MeshPhysicalNodeMaterial();
  const src = mat as THREE.MeshStandardMaterial & { diffuseRoughness?: number };
  if (src.color) phys.color.copy(src.color);
  phys.map = src.map ?? null;
  phys.alphaMap = src.alphaMap ?? null;
  phys.normalMap = src.normalMap ?? null;
  if (src.normalScale) phys.normalScale.copy(src.normalScale);
  phys.bumpMap = src.bumpMap ?? null;
  phys.bumpScale = src.bumpScale ?? 1;
  phys.roughness = src.roughness ?? 0.86;
  phys.metalness = src.metalness ?? 0;
  phys.diffuseRoughness = THREE.MathUtils.clamp(
    src.diffuseRoughness ?? diffuseRoughnessVal,
    0,
    1
  );
  phys.roughnessMap = src.roughnessMap ?? null;
  phys.metalnessMap = src.metalnessMap ?? null;
  if (src.emissive) phys.emissive.copy(src.emissive);
  phys.emissiveIntensity = src.emissiveIntensity ?? 1;
  phys.emissiveMap = src.emissiveMap ?? null;
  phys.aoMap = src.aoMap ?? null;
  phys.aoMapIntensity = src.aoMapIntensity ?? 1;
  phys.envMapIntensity = src.envMapIntensity ?? 1;

  phys.name = mat.name;
  phys.transparent = mat.transparent;
  phys.opacity = mat.opacity;
  phys.alphaTest = mat.alphaTest;
  phys.side = mat.side;
  phys.depthWrite = mat.depthWrite;
  phys.depthTest = mat.depthTest;
  phys.blending = mat.blending;
  phys.vertexColors = mat.vertexColors;
  phys.fog = src.fog ?? true;
  phys.toneMapped = mat.toneMapped;
  phys.wireframe = Boolean(src.wireframe);
  (phys as unknown as { flatShading?: boolean }).flatShading = Boolean(src.flatShading);
  phys.userData = { ...mat.userData };
  phys.needsUpdate = true;

  if (mat !== phys) {
    mat.dispose();
  }
  return phys;
}

/**
 * Upgrades any classic Three.js Material (MeshStandardMaterial, MeshToonMaterial, etc.)
 * into its r187 NodeMaterial equivalent while preserving all surface maps, PBR/Toon params,
 * EON diffuseRoughness, blending, transparency, and vertexColors flags so TSL hooks work
 * natively under WebGPURenderer.
 */
export function upgradeToNodeMaterial(mat: THREE.Material): NodeMaterial {
  if (isNodeMaterialInstance(mat)) {
    return mat;
  }

  let target: NodeMaterial;
  const src = mat as THREE.MeshStandardMaterial &
    THREE.MeshToonMaterial &
    THREE.MeshPhysicalMaterial &
    THREE.MeshPhongMaterial & { diffuseRoughness?: number };

  if ((mat as THREE.MeshToonMaterial).isMeshToonMaterial) {
    const toon = new MeshToonNodeMaterial();
    toon.color.copy(src.color ?? new THREE.Color('#ffffff'));
    toon.map = src.map ?? null;
    toon.alphaMap = src.alphaMap ?? null;
    toon.normalMap = src.normalMap ?? null;
    if (src.normalScale) toon.normalScale.copy(src.normalScale);
    toon.bumpMap = src.bumpMap ?? null;
    toon.bumpScale = src.bumpScale ?? 1;
    toon.emissive.copy(src.emissive ?? new THREE.Color('#000000'));
    toon.emissiveIntensity = src.emissiveIntensity ?? 1;
    toon.emissiveMap = src.emissiveMap ?? null;
    toon.aoMap = src.aoMap ?? null;
    toon.aoMapIntensity = src.aoMapIntensity ?? 1;
    toon.gradientMap = src.gradientMap ?? null;
    target = toon;
  } else if ((mat as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial) {
    const phys = new MeshPhysicalNodeMaterial();
    phys.color.copy(src.color ?? new THREE.Color('#ffffff'));
    phys.map = src.map ?? null;
    phys.alphaMap = src.alphaMap ?? null;
    phys.normalMap = src.normalMap ?? null;
    if (src.normalScale) phys.normalScale.copy(src.normalScale);
    phys.bumpMap = src.bumpMap ?? null;
    phys.bumpScale = src.bumpScale ?? 1;
    phys.roughness = src.roughness ?? 1;
    phys.metalness = src.metalness ?? 0;
    phys.diffuseRoughness = src.diffuseRoughness ?? 0;
    phys.roughnessMap = src.roughnessMap ?? null;
    phys.metalnessMap = src.metalnessMap ?? null;
    phys.emissive.copy(src.emissive ?? new THREE.Color('#000000'));
    phys.emissiveIntensity = src.emissiveIntensity ?? 1;
    phys.emissiveMap = src.emissiveMap ?? null;
    phys.aoMap = src.aoMap ?? null;
    phys.aoMapIntensity = src.aoMapIntensity ?? 1;
    phys.envMapIntensity = src.envMapIntensity ?? 1;
    phys.clearcoat = src.clearcoat ?? 0;
    phys.clearcoatRoughness = src.clearcoatRoughness ?? 0;
    phys.ior = src.ior ?? 1.5;
    phys.iridescence = src.iridescence ?? 0;
    phys.iridescenceIOR = src.iridescenceIOR ?? 1.3;
    phys.iridescenceThicknessMinimum = src.iridescenceThicknessMinimum ?? 100;
    phys.iridescenceThicknessMaximum = src.iridescenceThicknessMaximum ?? 400;
    target = phys;
  } else if ((mat as THREE.MeshBasicMaterial).isMeshBasicMaterial) {
    const basic = new MeshBasicNodeMaterial();
    basic.color.copy(src.color ?? new THREE.Color('#ffffff'));
    basic.map = src.map ?? null;
    basic.alphaMap = src.alphaMap ?? null;
    basic.aoMap = src.aoMap ?? null;
    basic.aoMapIntensity = src.aoMapIntensity ?? 1;
    target = basic;
  } else if ((mat as THREE.MeshLambertMaterial).isMeshLambertMaterial) {
    const lambert = new MeshLambertNodeMaterial();
    lambert.color.copy(src.color ?? new THREE.Color('#ffffff'));
    lambert.map = src.map ?? null;
    lambert.alphaMap = src.alphaMap ?? null;
    lambert.emissive.copy(src.emissive ?? new THREE.Color('#000000'));
    lambert.emissiveIntensity = src.emissiveIntensity ?? 1;
    lambert.emissiveMap = src.emissiveMap ?? null;
    target = lambert;
  } else if ((mat as THREE.MeshPhongMaterial).isMeshPhongMaterial) {
    const phong = new MeshPhongNodeMaterial();
    phong.color.copy(src.color ?? new THREE.Color('#ffffff'));
    phong.map = src.map ?? null;
    phong.alphaMap = src.alphaMap ?? null;
    phong.normalMap = src.normalMap ?? null;
    if (src.normalScale) phong.normalScale.copy(src.normalScale);
    phong.bumpMap = src.bumpMap ?? null;
    phong.bumpScale = src.bumpScale ?? 1;
    phong.emissive.copy(src.emissive ?? new THREE.Color('#000000'));
    phong.emissiveIntensity = src.emissiveIntensity ?? 1;
    phong.emissiveMap = src.emissiveMap ?? null;
    phong.shininess = src.shininess ?? 30;
    target = phong;
  } else {
    const std = new MeshStandardNodeMaterial();
    if (src.color) std.color.copy(src.color);
    std.map = src.map ?? null;
    std.alphaMap = src.alphaMap ?? null;
    std.normalMap = src.normalMap ?? null;
    if (src.normalScale) std.normalScale.copy(src.normalScale);
    std.bumpMap = src.bumpMap ?? null;
    std.bumpScale = src.bumpScale ?? 1;
    std.roughness = src.roughness ?? 1;
    std.metalness = src.metalness ?? 0;
    std.roughnessMap = src.roughnessMap ?? null;
    std.metalnessMap = src.metalnessMap ?? null;
    if (src.emissive) std.emissive.copy(src.emissive);
    std.emissiveIntensity = src.emissiveIntensity ?? 1;
    std.emissiveMap = src.emissiveMap ?? null;
    std.aoMap = src.aoMap ?? null;
    std.aoMapIntensity = src.aoMapIntensity ?? 1;
    std.envMapIntensity = src.envMapIntensity ?? 1;
    target = std;
  }

  target.name = mat.name;
  target.transparent = mat.transparent;
  target.opacity = mat.opacity;
  target.alphaTest = mat.alphaTest;
  target.side = mat.side;
  target.depthWrite = mat.depthWrite;
  target.depthTest = mat.depthTest;
  target.blending = mat.blending;
  target.vertexColors = mat.vertexColors;
  target.fog = (mat as THREE.MeshStandardMaterial).fog ?? true;
  target.toneMapped = mat.toneMapped;
  const targetStd = target as unknown as THREE.MeshStandardMaterial;
  targetStd.wireframe = (mat as THREE.MeshStandardMaterial).wireframe ?? false;
  targetStd.flatShading = Boolean((mat as THREE.MeshStandardMaterial).flatShading);
  target.userData = { ...mat.userData };
  target.needsUpdate = true;

  return target;
}

/**
 * Shared TSL perceptual linear-RGB <-> sRGB <-> HSV shift helper
 * (matches the original GLSL hue/saturation/value shifts across Canopy Engine and Vertex Painter).
 */
export const applyHsvShiftLinearTsl = Fn(([rgbLinear, hsvShift]: [any, any]) => {
  const outCol = vec3(rgbLinear.rgb).toVar('hsvOutRgb');
  const mag = abs(hsvShift.x).add(abs(hsvShift.y)).add(abs(hsvShift.z));

  If(mag.greaterThan(0.0005), () => {
    const srgbCol = pow(max(outCol, vec3(0.0001)), vec3(1.0 / 2.2));
    const K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    const p = mix(vec4(srgbCol.bg, K.wz), vec4(srgbCol.gb, K.xy), step(srgbCol.b, srgbCol.g));
    const q = mix(vec4(p.xyw, srgbCol.r), vec4(srgbCol.r, p.yzx), step(p.x, srgbCol.r));
    const d = q.x.sub(min(q.w, q.y));
    const e = float(1.0e-10);
    const hue = abs(q.z.add(q.w.sub(q.y).div(d.mul(6.0).add(e))));
    const sat = d.div(q.x.add(e));
    const val = q.x;

    const newH = fract(hue.add(hsvShift.x));
    const newS = clamp(sat.add(hsvShift.y), 0.0, 1.0);
    const newV = clamp(val.mul(float(1.0).add(hsvShift.z)), 0.0, 1.4);

    const K2 = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    const p2 = abs(fract(vec3(newH, newH, newH).add(K2.xyz)).mul(6.0).sub(K2.www));
    const shiftedSrgb = clamp(mix(K2.xxx, clamp(p2.sub(K2.xxx), 0.0, 1.0), newS), 0.0, 1.4).mul(newV);

    outCol.assign(pow(max(shiftedSrgb, vec3(0.0)), vec3(2.2)));
  });

  return outCol;
});

const _defaultTintFallback = new THREE.Color('#ffffff');

export function safeMaterialReference<T>(property: string, inputType: string, fallback: T) {
  const node = materialReference(property, inputType) as unknown as {
    reference?: Record<string, unknown> | null;
    properties?: string[];
    getValueFromReference?: (obj?: Record<string, unknown> | null) => unknown;
  };
  node.getValueFromReference = function (object = node.reference) {
    if (!object) return fallback;
    const props = node.properties ?? property.split('.');
    let cur: unknown = object;
    for (let i = 0; i < props.length; i++) {
      if (cur === null || cur === undefined || typeof cur !== 'object') {
        return fallback;
      }
      cur = (cur as Record<string, unknown>)[props[i]];
    }
    return cur === undefined || cur === null ? fallback : cur;
  };
  return node;
}

function typeBandMask(uType: ReturnType<typeof float>, targetId: number) {
  return step(targetId - 0.5, uType).mul(float(1.0).sub(step(targetId + 0.5, uType)));
}

/**
 * Shared TSL multi-form degradation & weathering blender.
 * Evaluates procedural world-space cracks, chips, scorch soot, mud splatters, moss, frost,
 * sun-bleached wear, rust patina, and wetness given normalized weights for each channel.
 */
export const applyDegradeLayersTsl = Fn(
  ([
    baseColor,
    wMoss,
    wCracks,
    wChipped,
    wScorch,
    wMud,
    wFrost,
    wBleached,
    wRusted,
    wWet,
  ]: [any, any, any, any, any, any, any, any, any, any]) => {
    const wp = positionWorld;
    const wnY = clamp(normalWorld.y, -1.0, 1.0);
    const upFacing = smoothstep(0.12, 0.72, wnY);

    // Multi-frequency deterministic 3D world-space pattern fields
    const nA = sin(wp.x.mul(2.1).add(wp.z.mul(1.7))).mul(cos(wp.z.mul(2.4).sub(wp.y.mul(1.3))));
    const nB = cos(wp.x.mul(5.3).sub(wp.z.mul(4.1)).add(wp.y.mul(3.2))).mul(0.5);
    const nFine = sin(wp.x.mul(11.7).add(wp.y.mul(9.1)).sub(wp.z.mul(10.3))).mul(0.5).add(0.5);
    const patchNoise = smoothstep(-0.35, 0.55, nA.add(nB));

    // Ridged fracture / crack network lines in 3D space
    const crackWave1 = abs(sin(wp.x.mul(4.7).add(nA.mul(1.8)).add(wp.y.mul(2.3))));
    const crackWave2 = abs(cos(wp.z.mul(5.1).sub(nB.mul(2.1)).add(wp.y.mul(3.4))));
    const crackNet = max(
      pow(float(1.0).sub(clamp(crackWave1, 0.0, 1.0)), 7.0),
      pow(float(1.0).sub(clamp(crackWave2, 0.0, 1.0)), 8.0)
    );

    // Chipping / edge wear speckles (sharp gouged highlights + shadowed pits)
    const chipMask = smoothstep(0.56, 0.84, patchNoise.mul(0.62).add(nFine.mul(0.5)));
    const chipPit = smoothstep(0.76, 0.94, nFine.mul(0.68).add(crackNet.mul(0.45)));

    const out = vec3(baseColor).toVar('degradedRgb');

    // 1. Moss & Lichen
    const effMoss = clamp(upFacing.mul(0.65).add(0.35).mul(mix(0.45, 1.0, patchNoise)).mul(wMoss), 0.0, 0.94);
    const mossCol = mix(vec3(0.14, 0.34, 0.12), vec3(0.32, 0.54, 0.2), patchNoise);
    out.assign(mix(out, mossCol, effMoss));

    // 2. Cracked (dark fissure veins + dusty aged rock tint)
    const crackAmt = clamp(wCracks, 0.0, 1.0);
    const agedDust = out.mul(0.78).add(vec3(0.11, 0.1, 0.09).mul(0.38));
    out.assign(mix(out, agedDust, crackAmt.mul(0.42).mul(mix(0.5, 1.0, patchNoise))));
    const fissure = clamp(crackNet.mul(1.35).add(nFine.mul(0.18)).mul(crackAmt), 0.0, 0.94);
    out.assign(mix(out, vec3(0.06, 0.055, 0.05), fissure));

    // 3. Chipped & Dented (exposed lighter inner stone/wood + dark gouge pits)
    const chipAmt = clamp(wChipped, 0.0, 1.0);
    const exposedCore = clamp(out.mul(1.28).add(vec3(0.18, 0.16, 0.14)), vec3(0.0), vec3(1.0));
    out.assign(mix(out, exposedCore, chipMask.mul(chipAmt).mul(0.72)));
    out.assign(mix(out, out.mul(0.34), chipPit.mul(chipAmt).mul(0.8)));

    // 4. Scorched / Soot / Char
    const scorchAmt = clamp(wScorch, 0.0, 1.0);
    const sootPattern = clamp(patchNoise.mul(0.65).add(nFine.mul(0.45)), 0.0, 1.0);
    const sootCol = mix(vec3(0.12, 0.08, 0.06), vec3(0.03, 0.028, 0.026), sootPattern);
    out.assign(mix(out, sootCol, clamp(scorchAmt.mul(mix(0.62, 1.0, sootPattern)), 0.0, 0.96)));

    // 5. Muddy / Damp Earth Rot
    const mudAmt = clamp(wMud, 0.0, 1.0);
    const mudPattern = smoothstep(0.2, 0.78, patchNoise.mul(0.7).add(nFine.mul(0.3)));
    const mudCol = mix(vec3(0.18, 0.12, 0.07), vec3(0.31, 0.22, 0.13), nFine);
    out.assign(mix(out, mudCol, clamp(mudAmt.mul(mix(0.45, 0.96, mudPattern)), 0.0, 0.92)));

    // 6. Sun-Bleached / Dry Weathered Wood & Bone
    const bleachAmt = clamp(wBleached, 0.0, 1.0);
    const luma = dot(out, vec3(0.299, 0.587, 0.114));
    const bleachedTone = mix(vec3(luma), vec3(0.74, 0.7, 0.63), 0.55).mul(float(0.95).add(nFine.mul(0.12)));
    out.assign(mix(out, bleachedTone, clamp(bleachAmt.mul(mix(0.55, 0.95, patchNoise)), 0.0, 0.92)));

    // 7. Rusted / Oxidized Patina
    const rustAmt = clamp(wRusted, 0.0, 1.0);
    const rustCol = mix(vec3(0.36, 0.14, 0.06), vec3(0.68, 0.29, 0.1), patchNoise.mul(0.7).add(nFine.mul(0.3)));
    out.assign(mix(out, rustCol, clamp(rustAmt.mul(mix(0.45, 0.98, chipMask.max(patchNoise.mul(0.65)))), 0.0, 0.94)));

    // 8. Snow / Rime Frost
    const snowMask = smoothstep(0.14, 0.6, wnY.add(patchNoise.sub(0.5).mul(0.32))).mul(wFrost);
    const snowCol = mix(vec3(0.8, 0.88, 0.96), vec3(0.97, 0.99, 1.0), upFacing);
    out.assign(mix(out, snowCol, clamp(snowMask.mul(0.95), 0.0, 0.96)));

    // 9. Wet Sheen (darkened saturated albedo)
    const wetMask = clamp(wWet.mul(0.85), 0.0, 0.95);
    out.assign(mix(out, out.mul(0.56), wetMask));

    return out;
  }
);

export const applyDegradeRoughnessTsl = Fn(
  ([baseRough, wMoss, wCracks, wChipped, wScorch, wMud, wFrost, wBleached, wRusted, wWet]: [
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
  ]) => {
    const wnY = clamp(normalWorld.y, -1.0, 1.0);
    const upFacing = smoothstep(0.18, 0.68, wnY);
    const r = float(baseRough).toVar('degradeRough');
    r.assign(mix(r, max(r, 0.92), clamp(wMoss.mul(upFacing), 0.0, 1.0)));
    r.assign(mix(r, max(r, 0.94), clamp(wCracks.add(wChipped).mul(0.85), 0.0, 1.0)));
    r.assign(mix(r, float(0.97), clamp(wScorch, 0.0, 1.0)));
    r.assign(mix(r, float(0.95), clamp(wBleached, 0.0, 1.0)));
    r.assign(mix(r, float(0.88), clamp(wRusted, 0.0, 1.0)));
    r.assign(mix(r, float(0.34), clamp(wMud.mul(0.8), 0.0, 0.9)));
    r.assign(mix(r, float(0.42), clamp(wFrost.mul(upFacing).mul(0.85), 0.0, 0.9)));
    r.assign(mix(r, float(0.11), clamp(wWet.mul(0.95), 0.0, 0.95)));
    return clamp(r, 0.05, 1.0);
  }
);

/**
 * Local-space procedural dings, edge chips, and directional surface scratches driven by `wearFactor` (0..1).
 * Uses `positionLocal` so scratches and impact dings stay locked onto each block when moved or rotated.
 */
export const applyWearDingsScratchesTsl = Fn(([baseColor, wearAmt]: [any, any]) => {
  const out = vec3(baseColor).toVar('wearRgb');
  const w = clamp(wearAmt, 0.0, 1.0);

  If(w.greaterThan(0.005), () => {
    const lp = positionLocal;
    const warp = sin(lp.x.mul(5.3).add(lp.z.mul(4.1))).mul(cos(lp.y.mul(4.7).sub(lp.x.mul(3.1))));
    const fineNoise = sin(lp.x.mul(17.3).add(lp.y.mul(13.7)).sub(lp.z.mul(15.9))).mul(0.5).add(0.5);

    // Directional scratches (density & width expand continuously as w increases)
    const diagA = lp.x.mul(13.5).add(lp.y.mul(22.0)).add(lp.z.mul(6.5)).add(warp.mul(1.8));
    const diagB = lp.z.mul(15.0).sub(lp.y.mul(18.5)).add(lp.x.mul(7.0)).sub(warp.mul(1.6));
    const sLineA = float(1.0).sub(abs(sin(diagA)));
    const sLineB = float(1.0).sub(abs(cos(diagB)));
    const sGateA = smoothstep(0.15, 0.72, sin(lp.x.mul(3.1).sub(lp.z.mul(2.7)).add(1.2)).mul(0.5).add(0.5));
    const sGateB = smoothstep(0.2, 0.78, cos(lp.y.mul(3.6).add(lp.z.mul(2.9))).mul(0.5).add(0.5));

    const scratchThresh = mix(0.96, 0.78, w);
    const scratchHit = max(
      smoothstep(scratchThresh, 0.996, sLineA).mul(sGateA),
      smoothstep(scratchThresh, 0.996, sLineB).mul(sGateB)
    );
    const scratchHighlight = smoothstep(mix(0.92, 0.72, w), 0.985, max(sLineA.mul(sGateA), sLineB.mul(sGateB))).mul(0.5);

    // Clustered impact dings & chipped divots
    const dingField = sin(lp.x.mul(7.2).add(0.5))
      .mul(cos(lp.z.mul(6.8).sub(0.8)))
      .mul(0.55)
      .add(sin(lp.y.mul(9.1).add(lp.x.mul(4.3))).mul(0.45));
    const dingMask = smoothstep(mix(0.76, 0.24, w), mix(0.92, 0.56, w), dingField.mul(0.5).add(0.5));
    const dingCore = smoothstep(mix(0.86, 0.48, w), 0.96, dingField.mul(0.5).add(0.5).mul(0.75).add(fineNoise.mul(0.25)));

    // Exposed scuffed core + dark deep groove/pit shadowing
    const exposedCore = clamp(out.mul(1.24).add(vec3(0.16, 0.14, 0.12)), vec3(0.0), vec3(1.0));
    const darkGroove = out.mul(mix(0.48, 0.22, w));

    out.assign(mix(out, exposedCore, clamp(dingMask.mul(0.52).add(scratchHighlight.mul(0.65)).mul(w), 0.0, 0.85)));
    out.assign(mix(out, darkGroove, clamp(dingCore.mul(0.78).add(scratchHit.mul(0.92)).mul(mix(0.45, 1.0, w)), 0.0, 0.92)));
  });

  return out;
});

/**
 * Reusable TSL Weathering shader fragment (`moss`, `snow`, `wet`, `cracked`, `chipped`,
 * `scorched`, `muddy`, `bleached`, `rusted`, `none`) + universal `uWearFactor` dings & scratches
 * driven purely by safe `materialReference` uniforms so sliders update in real time with ZERO recompilation.
 */
export function buildWeatheringColorTsl(baseRgbNode: unknown) {
  return Fn(() => {
    const uTintColor = safeMaterialReference('userData.uTintColor', 'color', _defaultTintFallback) as unknown as ReturnType<typeof vec3>;
    const uTintMix = safeMaterialReference('userData.uTintMix', 'float', 0) as unknown as ReturnType<typeof float>;
    const uWeatherType = safeMaterialReference('userData.uWeatherType', 'float', 0) as unknown as ReturnType<typeof float>;
    const uWeatherIntensity = safeMaterialReference('userData.uWeatherIntensity', 'float', 0) as unknown as ReturnType<typeof float>;
    const uWearFactor = safeMaterialReference('userData.uWearFactor', 'float', 0) as unknown as ReturnType<typeof float>;

    const baseRgb = vec3(baseRgbNode as THREE.Vector3);
    const tinted = mix(baseRgb, baseRgb.mul(vec3(uTintColor)), clamp(uTintMix, 0.0, 1.0));
    const amt = clamp(uWeatherIntensity, 0.0, 1.0);

    const weathered = applyDegradeLayersTsl(
      tinted,
      typeBandMask(uWeatherType, 1).mul(amt),
      typeBandMask(uWeatherType, 4).mul(amt),
      typeBandMask(uWeatherType, 5).mul(amt),
      typeBandMask(uWeatherType, 6).mul(amt),
      typeBandMask(uWeatherType, 7).mul(amt),
      typeBandMask(uWeatherType, 2).mul(amt),
      typeBandMask(uWeatherType, 8).mul(amt),
      typeBandMask(uWeatherType, 9).mul(amt),
      typeBandMask(uWeatherType, 3).mul(amt)
    );
    return applyWearDingsScratchesTsl(weathered, clamp(uWearFactor, 0.0, 1.0));
  })();
}

export function buildWeatheringRoughnessTsl() {
  return Fn(() => {
    const uWeatherType = safeMaterialReference('userData.uWeatherType', 'float', 0) as unknown as ReturnType<typeof float>;
    const uWeatherIntensity = safeMaterialReference('userData.uWeatherIntensity', 'float', 0) as unknown as ReturnType<typeof float>;
    const uWearFactor = safeMaterialReference('userData.uWearFactor', 'float', 0) as unknown as ReturnType<typeof float>;
    const amt = clamp(uWeatherIntensity, 0.0, 1.0);

    const degR = applyDegradeRoughnessTsl(
      materialRoughness,
      typeBandMask(uWeatherType, 1).mul(amt),
      typeBandMask(uWeatherType, 4).mul(amt),
      typeBandMask(uWeatherType, 5).mul(amt),
      typeBandMask(uWeatherType, 6).mul(amt),
      typeBandMask(uWeatherType, 7).mul(amt),
      typeBandMask(uWeatherType, 2).mul(amt),
      typeBandMask(uWeatherType, 8).mul(amt),
      typeBandMask(uWeatherType, 9).mul(amt),
      typeBandMask(uWeatherType, 3).mul(amt)
    );
    return mix(degR, max(degR, 0.94), clamp(uWearFactor.mul(0.8), 0.0, 1.0));
  })();
}

export function applyWeatheringUserData(
  targetUserData: Record<string, unknown>,
  opts?: {
    tintHex?: string;
    tintMix?: number;
    weathering?: WeatheringPreset;
    weatheringIntensity?: number;
    wearFactor?: number;
  }
) {
  if (!(targetUserData.uTintColor instanceof THREE.Color)) {
    targetUserData.uTintColor = new THREE.Color('#ffffff');
  }
  if (opts?.tintHex) {
    (targetUserData.uTintColor as THREE.Color).set(opts.tintHex);
  } else if (opts && 'tintHex' in opts && opts.tintHex === undefined) {
    (targetUserData.uTintColor as THREE.Color).set('#ffffff');
  }
  if (typeof opts?.tintMix === 'number') {
    targetUserData.uTintMix = THREE.MathUtils.clamp(opts.tintMix, 0, 1);
  } else if (typeof targetUserData.uTintMix !== 'number') {
    targetUserData.uTintMix = 0;
  }
  if (opts?.weathering !== undefined) {
    targetUserData.uWeatherType = WEATHERING_TYPE_MAP[opts.weathering] ?? 0;
  } else if (typeof targetUserData.uWeatherType !== 'number') {
    targetUserData.uWeatherType = 0;
  }
  if (typeof opts?.weatheringIntensity === 'number') {
    targetUserData.uWeatherIntensity = THREE.MathUtils.clamp(opts.weatheringIntensity, 0, 1);
  } else if (typeof targetUserData.uWeatherIntensity !== 'number') {
    targetUserData.uWeatherIntensity = 0.65;
  }
  if (typeof opts?.wearFactor === 'number') {
    targetUserData.uWearFactor = THREE.MathUtils.clamp(opts.wearFactor, 0, 1);
  } else if (typeof targetUserData.uWearFactor !== 'number') {
    targetUserData.uWearFactor = 0;
  }
}

export interface VariantBaseOptions {
  style?: VisualStyleId;
  hasMap?: boolean;
  doubleSide?: boolean;
  transparent?: boolean;
  vertexColors?: boolean;
  diffuseRoughness?: number;
  roughness?: number;
  metalness?: number;
}

const variantBaseCache = new Map<string, MeshPhysicalNodeMaterial>();

/**
 * Returns a shared compiled `MeshPhysicalNodeMaterial` (EON-capable + TSL weathering/tint hooks)
 * keyed only by pipeline structural flags so creating/tweaking dozens of `NodeMaterialInstance`
 * variants compiles ZERO additional shaders!
 */
export function getSharedWeatheringBaseMaterial(opts: VariantBaseOptions = {}): MeshPhysicalNodeMaterial {
  const key = [
    opts.doubleSide ? 'ds' : 'fs',
    opts.transparent ? 'tr' : 'op',
    opts.vertexColors ? 'vc' : 'nvc',
    opts.hasMap ? 'map' : 'nomap',
  ].join('|');

  const cached = variantBaseCache.get(key);
  if (cached) return cached;

  const base = new MeshPhysicalNodeMaterial({
    color: '#ffffff',
    roughness: opts.roughness ?? 0.84,
    metalness: opts.metalness ?? 0.02,
    diffuseRoughness: opts.diffuseRoughness ?? 0.72,
    side: opts.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    transparent: Boolean(opts.transparent),
    vertexColors: Boolean(opts.vertexColors),
  });

  // `materialColor` automatically reads `material.color` and multiplies `material.map` via `MaterialNode`
  base.colorNode = buildWeatheringColorTsl(vec3(materialColor));
  base.roughnessNode = buildWeatheringRoughnessTsl();
  base.diffuseRoughnessNode = materialDiffuseRoughness;
  attachBotwPainterlyShader(base, { rimStrengthScale: 0.85, shadowLiftScale: 0.85 });

  applyWeatheringUserData(base.userData, {
    tintHex: '#ffffff',
    tintMix: 0,
    weathering: 'none',
    weatheringIntensity: 0.65,
    wearFactor: 0,
  });
  base.needsUpdate = true;
  variantBaseCache.set(key, base);
  return base;
}

/**
 * Creates a `NodeMaterialInstance` backed by `baseNodeMat` with cleanly cloned mutable
 * Color / Vector2 / userData properties (preventing shared Color references across instances).
 */
export function createMaterialVariantInstance(
  baseNodeMat: NodeMaterial,
  init?: {
    colorHex?: string;
    tintHex?: string;
    tintMix?: number;
    roughness?: number;
    metalness?: number;
    diffuseRoughness?: number;
    weathering?: WeatheringPreset;
    weatheringIntensity?: number;
    wearFactor?: number;
    map?: THREE.Texture | null;
    normalMap?: THREE.Texture | null;
    normalScale?: number;
    bumpMap?: THREE.Texture | null;
    bumpScale?: number;
    opacity?: number;
    transparent?: boolean;
  }
): NodeMaterialInstance {
  const inst = new NodeMaterialInstance(baseNodeMat);
  const instAny = inst as unknown as THREE.MeshPhysicalMaterial & {
    diffuseRoughness?: number;
  };
  const baseAny = baseNodeMat as unknown as THREE.MeshPhysicalMaterial & {
    diffuseRoughness?: number;
  };

  instAny.color = baseAny.color ? baseAny.color.clone() : new THREE.Color('#ffffff');
  instAny.emissive = baseAny.emissive ? baseAny.emissive.clone() : new THREE.Color('#000000');
  instAny.normalScale = baseAny.normalScale ? baseAny.normalScale.clone() : new THREE.Vector2(1, 1);

  if (init?.colorHex) instAny.color.set(init.colorHex);
  if (typeof init?.roughness === 'number') instAny.roughness = init.roughness;
  if (typeof init?.metalness === 'number') instAny.metalness = init.metalness;
  if (typeof init?.diffuseRoughness === 'number') instAny.diffuseRoughness = init.diffuseRoughness;
  if (init?.map !== undefined) instAny.map = init.map;
  if (init?.normalMap !== undefined) instAny.normalMap = init.normalMap;
  if (typeof init?.normalScale === 'number') {
    instAny.normalScale.set(init.normalScale, init.normalScale);
  }
  if (init?.bumpMap !== undefined) instAny.bumpMap = init.bumpMap;
  if (typeof init?.bumpScale === 'number') instAny.bumpScale = init.bumpScale;
  if (typeof init?.opacity === 'number') instAny.opacity = init.opacity;
  if (typeof init?.transparent === 'boolean') instAny.transparent = init.transparent;

  applyWeatheringUserData(inst.userData, {
    tintHex: init?.tintHex,
    tintMix: init?.tintMix,
    weathering: init?.weathering,
    weatheringIntensity: init?.weatheringIntensity,
    wearFactor: init?.wearFactor,
  });
  return inst;
}

/**
 * Updates uniform values on a `NodeMaterialInstance` or concrete variant material in real time
 * with ZERO shader recompilation freezes!
 */
export function updateMaterialVariantInstance(
  mat: THREE.Material,
  variant: {
    colorHex?: string;
    tintHex?: string;
    tintMix?: number;
    roughness?: number;
    diffuseRoughness?: number;
    weathering?: WeatheringPreset;
    weatheringIntensity?: number;
    wearFactor?: number;
  }
) {
  const m = mat as unknown as {
    color?: THREE.Color;
    roughness?: number;
    diffuseRoughness?: number;
    userData: Record<string, unknown>;
  };

  if (variant.colorHex && m.color) {
    m.color.set(variant.colorHex);
  }
  if (typeof variant.roughness === 'number' && typeof m.roughness === 'number') {
    m.roughness = THREE.MathUtils.clamp(variant.roughness, 0.05, 1);
  }
  if (typeof variant.diffuseRoughness === 'number') {
    m.diffuseRoughness = THREE.MathUtils.clamp(variant.diffuseRoughness, 0, 1);
  }

  applyWeatheringUserData(m.userData, {
    tintHex: variant.tintHex,
    tintMix: variant.tintMix,
    weathering: variant.weathering,
    weatheringIntensity: variant.weatheringIntensity,
    wearFactor: variant.wearFactor,
  });
}

/**
 * Dynamically applies or removes watertight physical vertex dings, edge chips, and denting
 * across an entity's subdivided meshes based on `wearFactor` (0..1).
 * Coincident corner/edge vertices share a smooth averaged normal so BoxGeometries never tear.
 */
export function applyObjectWearDeformation(root: THREE.Object3D, wearFactor: number): void {
  const clamped = THREE.MathUtils.clamp(wearFactor, 0, 1);
  const prevApplied = root.userData.__appliedWearFactor as number | undefined;
  if (prevApplied !== undefined && Math.abs(prevApplied - clamped) < 0.002) {
    return;
  }
  if (prevApplied === undefined && clamped <= 0.002) {
    root.userData.__appliedWearFactor = 0;
    return;
  }
  root.userData.__appliedWearFactor = clamped;

  const seenGeos = new Set<THREE.BufferGeometry>();

  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    if (obj instanceof THREE.InstancedMesh || obj instanceof THREE.SkinnedMesh) return;
    if (obj.userData.noVertexPaint || obj.userData.floatSpin || obj.userData.puzzleCore) return;

    let geo = obj.geometry;
    if (seenGeos.has(geo)) {
      geo = geo.clone();
      obj.geometry = geo;
    }
    seenGeos.add(geo);

    const pos = geo.attributes.position as THREE.BufferAttribute | undefined;
    if (!pos || pos.count < 16 || !(pos.array instanceof Float32Array)) return;

    if (!geo.attributes.normal) {
      geo.computeVertexNormals();
    }
    const norm = geo.attributes.normal as THREE.BufferAttribute | undefined;
    if (!norm || !(norm.array instanceof Float32Array)) return;

    let basePos = geo.userData.wearBasePositions as Float32Array | undefined;
    let baseNorm = geo.userData.wearBaseNormals as Float32Array | undefined;
    let smoothNorm = geo.userData.wearSmoothNormals as Float32Array | undefined;
    let geoScale = geo.userData.wearGeoScale as number | undefined;

    if (!basePos || basePos.length !== pos.array.length) {
      basePos = new Float32Array(pos.array);
      baseNorm = new Float32Array(norm.array);
      geo.computeBoundingSphere();
      geoScale = Math.max(0.45, geo.boundingSphere?.radius ?? 1.0);

      // Accumulate smooth watertight normals per unique spatial vertex position
      const acc = new Map<string, [number, number, number]>();
      for (let i = 0; i < pos.count; i++) {
        const i3 = i * 3;
        const key = `${Math.round(basePos[i3] * 500)},${Math.round(basePos[i3 + 1] * 500)},${Math.round(basePos[i3 + 2] * 500)}`;
        const entry = acc.get(key);
        if (entry) {
          entry[0] += baseNorm[i3];
          entry[1] += baseNorm[i3 + 1];
          entry[2] += baseNorm[i3 + 2];
        } else {
          acc.set(key, [baseNorm[i3], baseNorm[i3 + 1], baseNorm[i3 + 2]]);
        }
      }
      smoothNorm = new Float32Array(pos.array.length);
      for (let i = 0; i < pos.count; i++) {
        const i3 = i * 3;
        const key = `${Math.round(basePos[i3] * 500)},${Math.round(basePos[i3 + 1] * 500)},${Math.round(basePos[i3 + 2] * 500)}`;
        const sum = acc.get(key)!;
        const len = Math.hypot(sum[0], sum[1], sum[2]) || 1;
        smoothNorm[i3] = sum[0] / len;
        smoothNorm[i3 + 1] = sum[1] / len;
        smoothNorm[i3 + 2] = sum[2] / len;
      }

      geo.userData.wearBasePositions = basePos;
      geo.userData.wearBaseNormals = baseNorm;
      geo.userData.wearSmoothNormals = smoothNorm;
      geo.userData.wearGeoScale = geoScale;
    }

    if (clamped <= 0.002) {
      pos.array.set(basePos);
      if (baseNorm) norm.array.set(baseNorm);
      pos.needsUpdate = true;
      norm.needsUpdate = true;
      return;
    }

    const pArr = pos.array as Float32Array;
    const sArr = smoothNorm!;
    if (!geo.boundingBox) geo.computeBoundingBox();
    const bbMin = geo.boundingBox?.min;
    const bbMax = geo.boundingBox?.max;
    const bCx = bbMin && bbMax ? (bbMin.x + bbMax.x) * 0.5 : 0;
    const bCy = bbMin && bbMax ? (bbMin.y + bbMax.y) * 0.5 : 0;
    const bCz = bbMin && bbMax ? (bbMin.z + bbMax.z) * 0.5 : 0;
    const bHx = bbMin && bbMax ? Math.max(0.1, (bbMax.x - bbMin.x) * 0.5) : 1;
    const bHy = bbMin && bbMax ? Math.max(0.1, (bbMax.y - bbMin.y) * 0.5) : 1;
    const bHz = bbMin && bbMax ? Math.max(0.1, (bbMax.z - bbMin.z) * 0.5) : 1;

    const maxDent = Math.min(0.14, (geoScale ?? 1.0) * 0.082) * clamped;
    const invScale = 1.0 / Math.max(0.35, (geoScale ?? 1.0) * 0.55);

    for (let i = 0; i < pos.count; i++) {
      const i3 = i * 3;
      const vx = basePos[i3];
      const vy = basePos[i3 + 1];
      const vz = basePos[i3 + 2];
      const sx = vx * invScale;
      const sy = vy * invScale;
      const sz = vz * invScale;

      // Normalized distance along the 2nd-closest bounding axis identifies bevels/edges/corners
      const ax = Math.abs(vx - bCx) / bHx;
      const ay = Math.abs(vy - bCy) / bHy;
      const az = Math.abs(vz - bCz) / bHz;
      let secondAxis = ax <= ay ? (ay <= az ? ay : Math.max(ax, az)) : (ax <= az ? ax : Math.max(ay, az));
      secondAxis = THREE.MathUtils.clamp(secondAxis, 0, 1);
      const edgeProx = Math.max(0, (secondAxis - 0.65) / 0.35);

      // Multi-pocket impact dings + diagonal scratch gouges (same inputs for shared corners)
      const dingWave =
        Math.sin(sx * 4.3 + sy * 2.1) * Math.cos(sz * 4.7 - sy * 1.9) * 0.6 +
        Math.sin(sx * 8.9 - sz * 7.3 + sy * 5.1) * 0.4;
      const pocket = Math.max(0, dingWave * 0.5 + 0.5 - (0.72 - clamped * 0.36 - edgeProx * 0.14));
      const gougeLine = Math.max(
        0,
        Math.abs(Math.sin(sx * 6.5 + sy * 9.5 + sz * 3.1)) - (0.94 - clamped * 0.14)
      );
      const disp = Math.min(1.0, (pocket * 2.6 + gougeLine * 3.2) * (1 + edgeProx * 0.95)) * maxDent;

      pArr[i3] = vx - sArr[i3] * disp;
      pArr[i3 + 1] = vy - sArr[i3 + 1] * disp;
      pArr[i3 + 2] = vz - sArr[i3 + 2] * disp;
    }

    pos.needsUpdate = true;
    geo.computeVertexNormals();
  });
}

/**
 * Wraps every opaque/standard mesh inside an entity's 3D hierarchy into a shared-shader
 * `NodeMaterialInstance` so per-entity color, roughness, EON `diffuseRoughness`,
 * weathering presets, and `wearFactor` (dings & scratches) update live via uniforms without recompiling shaders!
 * Snapshot original defaults into `userData.__baseVariantDefaults` so resetting returns cleanly.
 */
export function applyEntityMaterialVariant(
  root: THREE.Object3D,
  variant?: EntityMaterialVariant,
  isMatteEntity = true
): void {
  const wearAmt = typeof variant?.wearFactor === 'number' ? THREE.MathUtils.clamp(variant.wearFactor, 0, 1) : 0;
  const hasVariant = Boolean(
    variant &&
      (variant.colorHex ||
        typeof variant.roughness === 'number' ||
        typeof variant.diffuseRoughness === 'number' ||
        wearAmt > 0.001 ||
        (variant.weathering && variant.weathering !== 'none'))
  );

  const wrappedCache = new Map<THREE.Material, THREE.Material>();
  const kept = new Set<THREE.Material>();
  const replaced = new Set<THREE.Material>();

  const wrap = (m: THREE.Material) => {
    const cached = wrappedCache.get(m);
    if (cached) return cached;
    const next = wrapSingleEntityMaterial(m, variant, isMatteEntity, hasVariant);
    wrappedCache.set(m, next);
    kept.add(next);
    if (next !== m) {
      replaced.add(m);
    }
    return next;
  };

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map(wrap);
    } else if (mesh.material) {
      mesh.material = wrap(mesh.material);
    }
  });

  replaced.forEach((oldMat) => {
    if (!kept.has(oldMat)) {
      oldMat.dispose();
    }
  });

  applyObjectWearDeformation(root, wearAmt);
}

function wrapSingleEntityMaterial(
  mat: THREE.Material,
  variant: EntityMaterialVariant | undefined,
  isMatteEntity: boolean,
  hasVariant: boolean
): THREE.Material {
  // Never disturb custom particle / unlit glow materials or already-toon materials unless explicitly overridden
  if (mat.userData?.preserveGlowMat) return mat;
  if ((mat as THREE.MeshBasicMaterial).isMeshBasicMaterial && !hasVariant) return mat;

  // Canopy Engine trees already carry their own wind + weathering/wear TSL graph
  if (mat.userData?.__canopyWeatherReady) {
    applyWeatheringUserData(mat.userData, {
      tintHex: variant?.colorHex ?? '#ffffff',
      tintMix: variant?.colorHex ? 0.82 : 0,
      weathering: variant?.weathering ?? 'none',
      weatheringIntensity: variant?.weatheringIntensity ?? 0.65,
      wearFactor: variant?.wearFactor ?? 0,
    });
    return mat;
  }

  // Already wrapped into our variant-aware NodeMaterialInstance (or concrete MeshPhysicalNodeMaterial for meshlets)
  if (mat.userData?.__variantWrapped) {
    applyVariantToWrappedMaterial(mat, variant);
    return mat;
  }

  const src = mat as THREE.MeshStandardMaterial & { diffuseRoughness?: number };
  const origColorHex = src.color ? `#${src.color.getHexString()}` : '#ffffff';
  const origRoughness = typeof src.roughness === 'number' ? src.roughness : 0.82;
  const origDiffuseRoughness =
    typeof src.diffuseRoughness === 'number' ? src.diffuseRoughness : isMatteEntity ? 0.84 : 0.25;

  // Only convert to NodeMaterialInstance when EON/variant is used or standard material benefits from EON + live edits
  if (!hasVariant && !isMatteEntity) {
    return mat;
  }

  const base = getSharedWeatheringBaseMaterial({
    hasMap: Boolean(src.map),
    doubleSide: mat.side === THREE.DoubleSide,
    transparent: mat.transparent,
    vertexColors: mat.vertexColors,
  });

  const inst = createMaterialVariantInstance(base, {
    colorHex: origColorHex,
    roughness: origRoughness,
    metalness: typeof src.metalness === 'number' ? src.metalness : 0.04,
    diffuseRoughness: origDiffuseRoughness,
    map: src.map ?? null,
    normalMap: src.normalMap ?? null,
    normalScale: src.normalScale ? src.normalScale.x : 1,
    bumpMap: src.bumpMap ?? null,
    bumpScale: src.bumpScale ?? 1,
    opacity: mat.opacity,
    transparent: mat.transparent,
    weathering: 'none',
    weatheringIntensity: 0.65,
    wearFactor: 0,
  });

  inst.name = mat.name;
  inst.alphaTest = mat.alphaTest;
  inst.depthWrite = mat.depthWrite;
  inst.depthTest = mat.depthTest;
  (inst as unknown as { fog: boolean }).fog = src.fog ?? true;
  inst.toneMapped = mat.toneMapped;
  inst.userData.__variantWrapped = true;
  inst.userData.__baseVariantDefaults = {
    colorHex: origColorHex,
    roughness: origRoughness,
    diffuseRoughness: origDiffuseRoughness,
  };

  applyVariantToWrappedMaterial(inst, variant);
  return inst;
}

function applyVariantToWrappedMaterial(mat: THREE.Material, variant?: EntityMaterialVariant) {
  const defaults = (mat.userData?.__baseVariantDefaults as
    | { colorHex: string; roughness: number; diffuseRoughness: number }
    | undefined) ?? {
    colorHex: '#ffffff',
    roughness: 0.84,
    diffuseRoughness: 0.84,
  };

  const tintActive = Boolean(variant?.colorHex);
  updateMaterialVariantInstance(mat, {
    colorHex: variant?.colorHex ? '#ffffff' : defaults.colorHex,
    tintHex: variant?.colorHex ?? '#ffffff',
    tintMix: tintActive ? 0.82 : 0,
    roughness: typeof variant?.roughness === 'number' ? variant.roughness : defaults.roughness,
    diffuseRoughness:
      typeof variant?.diffuseRoughness === 'number'
        ? variant.diffuseRoughness
        : defaults.diffuseRoughness,
    weathering: variant?.weathering ?? 'none',
    weatheringIntensity: variant?.weatheringIntensity ?? 0.65,
    wearFactor: variant?.wearFactor ?? 0,
  });
}

/**
 * Live zero-stutter in-place update when an entity's `materialVariant` changes in the inspector.
 */
export function updateEntityMaterialVariantInPlace(
  root: THREE.Object3D,
  variant?: EntityMaterialVariant,
  isMatteEntity = true
): void {
  applyEntityMaterialVariant(root, variant, isMatteEntity);
}

/**
 * Checks if two entities are structurally identical (so we don't tear down & rebuild 3D meshes
 * when only `materialVariant` or `meshletEnabled` is edited in real time).
 */
export function stripLiveVariantFieldsForStructKey(entities: unknown[]): unknown[] {
  return entities.map((e) => {
    if (!e || typeof e !== 'object') return e;
    const {
      materialVariant: _mv,
      meshletEnabled: _me,
      ...rest
    } = e as Record<string, unknown>;
    return rest;
  });
}
