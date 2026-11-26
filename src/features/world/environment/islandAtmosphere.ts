import * as THREE from 'three';
import type { WebGPURenderer } from 'three/webgpu';
import {
  uniform,
  Fn,
  vec2,
  fract,
  dot,
  mix,
  floor,
  Loop,
  normalize,
  positionLocal,
  clamp,
  smoothstep,
  pow,
  float,
} from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import type { GameLevel, VisualStyleId } from '../../../types/maker';
import { getSky } from '../../../data/registries';
import { getEnvironmentType } from '../../../utils/terrain';
import {
  syncBotwStyleUniforms,
  syncBotwSceneFog,
  syncBotwTime,
} from '../../../three/botwStyleUtils';
import { IslandTerrain } from '../../../utils/terrain';

export interface ComputedAtmosphere {
  zenithColor: THREE.Color;
  midColor: THREE.Color;
  horizonColor: THREE.Color;
  fogColor: THREE.Color;
  sunColor: THREE.Color;
  sunIntensity: number;
  sunPos: THREE.Vector3;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  nightFactor: number;
  envIntensity: number;
  warmGlow: number;
}

export function computeAtmosphereState(level: GameLevel, overrideTime?: number): ComputedAtmosphere {
  const sky = getSky(level.sky);
  const style: VisualStyleId = level.visualStyle ?? 'painterlyPBR';
  const env = getEnvironmentType(level);

  // Enclosed dark subterranean dungeon overrides outdoor sky brightness
  if (env === 'dungeon') {
    return {
      zenithColor: new THREE.Color('#090B10'),
      midColor: new THREE.Color('#0D1017'),
      horizonColor: new THREE.Color('#11141D'),
      fogColor: new THREE.Color('#0E1118'),
      sunColor: new THREE.Color('#9AA8C7'),
      sunIntensity: 0.42,
      sunPos: new THREE.Vector3(14, 34, 22),
      hemiSky: new THREE.Color('#424D6B'),
      hemiGround: new THREE.Color('#191D26'),
      hemiIntensity: 0.58,
      nightFactor: 0,
      envIntensity: 0.16,
      warmGlow: 0,
    };
  }

  const hasDynamicTime = level.timeOfDay !== undefined || overrideTime !== undefined;

  const cloudDensity = THREE.MathUtils.clamp(
    level.cloudDensity ?? (level.sky === 'storm' ? 0.85 : level.sky === 'mist' ? 0.72 : 0.58),
    0,
    1
  );
  const sunScale = THREE.MathUtils.clamp(level.sunIntensityScale ?? 1, 0.3, 1.8);
  const ambientScale = THREE.MathUtils.clamp(level.ambientIntensityScale ?? 1, 0.3, 1.8);
  const warmth = THREE.MathUtils.clamp(level.atmosphereWarmth ?? 0, -0.5, 0.5);
  const overcastDamp = 1 - Math.max(0, cloudDensity - 0.55) * 0.48;

  const applyTuning = (base: ComputedAtmosphere): ComputedAtmosphere => {
    if (warmth !== 0) {
      const targetWarm = warmth > 0 ? new THREE.Color('#FFAD66') : new THREE.Color('#78B7FF');
      const amt = Math.abs(warmth);
      base.horizonColor.lerp(targetWarm, amt * 0.42);
      base.midColor.lerp(targetWarm, amt * 0.25);
      base.fogColor.lerp(targetWarm, amt * 0.35);
      base.sunColor.lerp(targetWarm, amt * 0.38);
      base.warmGlow = THREE.MathUtils.clamp(base.warmGlow + warmth * 0.55, 0, 1.25);
    }
    if (cloudDensity > 0.65) {
      const hazeAmt = (cloudDensity - 0.65) * 0.55;
      const cloudGrey = new THREE.Color(base.nightFactor > 0.5 ? '#263452' : '#9AA9BA');
      base.zenithColor.lerp(cloudGrey, hazeAmt);
      base.midColor.lerp(cloudGrey, hazeAmt * 0.75);
    }
    base.sunIntensity = base.sunIntensity * sunScale * overcastDamp;
    base.hemiIntensity = base.hemiIntensity * ambientScale * (1 + Math.max(0, cloudDensity - 0.55) * 0.14);
    base.envIntensity = base.envIntensity * THREE.MathUtils.lerp(1, ambientScale, 0.55);
    return base;
  };

  if (!hasDynamicTime) {
    const rad = ((level.sunAngle || 38) * Math.PI) / 180;
    const isNight = level.sky === 'night' || level.sky === 'cave' || env === 'scifi';
    const isGolden = level.sky === 'golden';
    const isStorm = level.sky === 'storm';
    const isMist = level.sky === 'mist';

    const sunPos = isGolden
      ? new THREE.Vector3(Math.cos(rad) * 72, 16 + Math.sin(rad) * 10, 46)
      : new THREE.Vector3(Math.cos(rad) * 58, 34 + Math.sin(rad) * 22, 34);

    let horizon = new THREE.Color(env === 'scifi' ? '#0C1222' : sky.bgHex);
    let zenith: THREE.Color;
    let mid: THREE.Color;
    let fog = new THREE.Color(sky.fogHex);
    let sunCol = new THREE.Color(sky.sunColor);
    let sunInt: number;
    let hemiSk: THREE.Color;
    let hemiGnd = new THREE.Color(sky.hemiGround);
    let hemiInt: number;
    let nightFac: number;
    let envInt: number;
    let glow: number;

    if (isNight) {
      zenith = new THREE.Color(env === 'scifi' ? '#070A14' : '#0B111E');
      mid = new THREE.Color(env === 'scifi' ? '#0F1A35' : '#142038');
      horizon = new THREE.Color(env === 'scifi' ? '#182C55' : '#1E2D4A');
      fog = new THREE.Color(env === 'scifi' ? '#0D162B' : '#121C30');
      sunCol = new THREE.Color(env === 'scifi' ? '#38BDF8' : '#93C5FD');
      sunInt = 0.55;
      hemiSk = new THREE.Color('#223458');
      hemiGnd = new THREE.Color('#0A0E17');
      hemiInt = 0.52;
      nightFac = 1.0;
      envInt = env === 'scifi' ? 0.38 : 0.22;
      glow = 0.12;
    } else if (isGolden) {
      zenith = new THREE.Color(style === 'softFantasy' ? '#2B2B4E' : '#313359');
      mid = new THREE.Color('#5E4256');
      horizon.set('#C46844');
      fog.set('#8C5046');
      sunCol.set('#FFB366');
      sunInt = 1.25;
      hemiSk = new THREE.Color('#7A5255');
      hemiGnd = new THREE.Color('#2A1A1E');
      hemiInt = 0.92;
      nightFac = 0.05;
      envInt = 0.55;
      glow = 1.05;
    } else if (isStorm) {
      zenith = new THREE.Color('#1E2533');
      mid = new THREE.Color('#2C3545');
      horizon.set('#3D4859');
      fog.set('#323B4A');
      sunCol.set('#94A3B8');
      sunInt = 0.65;
      hemiSk = new THREE.Color('#475569');
      hemiGnd.set('#111827');
      hemiInt = 0.62;
      nightFac = 0.45;
      envInt = 0.32;
      glow = 0.18;
    } else if (isMist) {
      zenith = new THREE.Color('#4B5563');
      mid = new THREE.Color('#6B7280');
      horizon.set('#9CA3AF');
      fog.set('#6B7280');
      sunCol.set('#E5E7EB');
      sunInt = 0.82;
      hemiSk = new THREE.Color('#78716C');
      hemiGnd.set('#292524');
      hemiInt = 0.78;
      nightFac = 0.15;
      envInt = 0.42;
      glow = 0.32;
    } else {
      zenith = new THREE.Color(style === 'softFantasy' ? '#3B4A75' : '#2A437E');
      mid = new THREE.Color(style === 'softFantasy' ? '#6B5A87' : '#5A6E9E');
      horizon.set(sky.sunColor);
      fog.set(sky.fogHex);
      sunCol.set(sky.sunColor);
      sunInt = 1.38;
      hemiSk = new THREE.Color(style === 'softFantasy' ? '#7A8ABF' : '#687FA8');
      hemiGnd = new THREE.Color(sky.hemiGround);
      hemiInt = 0.88;
      nightFac = 0;
      envInt = 0.52;
      glow = 0.65;
    }

    return applyTuning({
      zenithColor: zenith,
      midColor: mid,
      horizonColor: horizon,
      fogColor: fog,
      sunColor: sunCol,
      sunIntensity: sunInt,
      sunPos,
      hemiSky: hemiSk,
      hemiGround: hemiGnd,
      hemiIntensity: hemiInt,
      nightFactor: nightFac,
      envIntensity: envInt,
      warmGlow: glow,
    });
  }

  // Dynamic time-of-day math (0..24 hours)
  const tHour = (level.timeOfDay ?? overrideTime ?? 12 + (level.sunAngle || 38) / 15) % 24;
  const sunAngleRad = ((tHour - 6) / 24) * Math.PI * 2;
  const sunX = Math.cos(sunAngleRad) * 65;
  const sunY = Math.sin(sunAngleRad) * 58;
  const sunZ = 34;
  const sunPos = new THREE.Vector3(sunX, Math.max(-15, sunY), sunZ);

  const isNightTime = tHour < 5.5 || tHour > 19.5;
  const isDawnOrDusk = (tHour >= 5.5 && tHour < 7.5) || (tHour >= 17.5 && tHour <= 19.5);

  let zenith = new THREE.Color('#1E3A8A');
  let mid = new THREE.Color('#3B82F6');
  let horizon = new THREE.Color('#93C5FD');
  let fog = new THREE.Color('#60A5FA');
  let sunCol = new THREE.Color('#FACC15');
  let sunInt = 1.25;
  let hemiSk = new THREE.Color('#60A5FA');
  let hemiGnd = new THREE.Color('#1E293B');
  let hemiInt = 0.82;
  let nightFac = isNightTime ? 1.0 : isDawnOrDusk ? 0.35 : 0;
  let envInt = 0.5;
  let glow = 0.5;

  if (isNightTime) {
    zenith.set('#070A14');
    mid.set('#0F1A35');
    horizon.set('#182C55');
    fog.set('#0D162B');
    sunCol.set('#93C5FD');
    sunInt = 0.45;
    hemiSk.set('#223458');
    hemiGnd.set('#0A0E17');
    hemiInt = 0.48;
    nightFac = 1.0;
    envInt = 0.25;
    glow = 0.1;
  } else if (isDawnOrDusk) {
    zenith.set('#313359');
    mid.set('#5E4256');
    horizon.set('#C46844');
    fog.set('#8C5046');
    sunCol.set('#FFB366');
    sunInt = 1.15;
    hemiSk.set('#7A5255');
    hemiGnd.set('#2A1A1E');
    hemiInt = 0.85;
    nightFac = 0.25;
    envInt = 0.48;
    glow = 0.95;
  }

  return applyTuning({
    zenithColor: zenith,
    midColor: mid,
    horizonColor: horizon,
    fogColor: fog,
    sunColor: sunCol,
    sunIntensity: sunInt,
    sunPos,
    hemiSky: hemiSk,
    hemiGround: hemiGnd,
    hemiIntensity: hemiInt,
    nightFactor: nightFac,
    envIntensity: envInt,
    warmGlow: glow,
  });
}

export function applyAtmosphere(
  scene: THREE.Scene,
  sunLight: THREE.DirectionalLight,
  hemiLight: THREE.HemisphereLight,
  level: GameLevel,
  renderer?: WebGPURenderer,
  overrideTime?: number,
  options?: { isWorldMapMode?: boolean }
): ComputedAtmosphere {
  const atmo = computeAtmosphereState(level, overrideTime);
  const style: VisualStyleId = level.visualStyle ?? 'painterlyPBR';
  const env = getEnvironmentType(level);
  const isWmMode = Boolean(options?.isWorldMapMode);
  const cloudDensity = THREE.MathUtils.clamp(
    level.cloudDensity ?? (level.sky === 'storm' ? 0.85 : level.sky === 'mist' ? 0.72 : 0.58),
    0,
    1
  );
  const starScale = THREE.MathUtils.clamp(level.starIntensity ?? 1, 0, 1.5);

  scene.background = atmo.horizonColor;
  scene.environmentIntensity = atmo.envIntensity;
  syncBotwStyleUniforms(style, atmo, env, cloudDensity, level.sky);
  syncBotwSceneFog(
    scene,
    atmo,
    env,
    level.fog,
    cloudDensity,
    level.sky,
    IslandTerrain.waterLevel,
    level.vistaHeightFog ?? 1
  );
  if (isWmMode) {
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.density *= 0.14;
    }
    const fogU = scene.userData.botwFogUniforms as
      | {
          uFogDensity: { value: number };
          uHeightFogDensity: { value: number };
          uSunInscatterStrength: { value: number };
        }
      | undefined;
    if (fogU) {
      fogU.uFogDensity.value *= 0.14;
      fogU.uHeightFogDensity.value *= 0.1;
      fogU.uSunInscatterStrength.value *= 0.35;
    }
  }

  sunLight.color.copy(atmo.sunColor);
  sunLight.intensity = atmo.sunIntensity;
  sunLight.position.copy(atmo.sunPos);

  hemiLight.color.copy(atmo.hemiSky);
  hemiLight.groundColor.copy(atmo.hemiGround);
  hemiLight.intensity = atmo.hemiIntensity;

  if (renderer) {
    const goldenScale = level.sky === 'golden' ? 0.94 : 1.0;
    renderer.toneMappingExposure =
      (env === 'dungeon'
        ? 1.14
        : style === 'softFantasy'
        ? 1.05
        : style === 'celToon'
        ? 0.98
        : 0.99) * goldenScale;
  }

  const cloudTint = new THREE.Color('#F5EDE4')
    .lerp(atmo.horizonColor, atmo.warmGlow * 0.42)
    .lerp(atmo.sunColor, 0.22);
  if (atmo.nightFactor > 0) {
    cloudTint.lerp(new THREE.Color('#475A7E'), atmo.nightFactor * 0.72);
  }
  if (level.sky === 'storm') {
    cloudTint.lerp(new THREE.Color('#7C899E'), 0.6);
  }

  const skyDome =
    (scene.userData.__makerSkyDome as THREE.Mesh | undefined) ??
    (scene.getObjectByName('maker-skydome') as THREE.Mesh | undefined);
  if (skyDome) {
    scene.userData.__makerSkyDome = skyDome;
    skyDome.visible = env !== 'dungeon';
    const skyU = skyDome.userData?.skyUniforms as
      | {
          uZenith: { value: THREE.Color };
          uMidSky: { value: THREE.Color };
          uHorizon: { value: THREE.Color };
          uSunDir: { value: THREE.Vector3 };
          uSunColor: { value: THREE.Color };
          uWarmGlow: { value: number };
          uCloudDensity: { value: number };
          uCloudColor: { value: THREE.Color };
          uTime: { value: number };
        }
      | undefined;
    if (skyU) {
      skyU.uZenith.value.copy(atmo.zenithColor);
      skyU.uMidSky.value.copy(atmo.midColor);
      skyU.uHorizon.value.copy(atmo.horizonColor);
      skyU.uSunDir.value.copy(atmo.sunPos).normalize();
      skyU.uSunColor.value.copy(atmo.sunColor);
      skyU.uWarmGlow.value = atmo.warmGlow;
      skyU.uCloudDensity.value = env === 'sideScroller' ? cloudDensity * 0.45 : cloudDensity;
      skyU.uCloudColor.value.copy(cloudTint);
    }
  }
  const stars =
    (scene.userData.__makerStars as THREE.Points | undefined) ??
    (scene.getObjectByName('maker-stars') as THREE.Points | undefined);
  if (stars && stars.material instanceof THREE.PointsMaterial) {
    scene.userData.__makerStars = stars;
    const starOpacity = THREE.MathUtils.clamp(atmo.nightFactor * 0.92 * starScale * (1 - cloudDensity * 0.45), 0, 1);
    stars.material.opacity = starOpacity;
    stars.visible = env !== 'dungeon' && starOpacity > 0.03;
  }

  const clouds =
    (scene.userData.__makerClouds as THREE.Group | undefined) ??
    (scene.getObjectByName('maker-clouds') as THREE.Group | undefined);
  if (clouds) {
    scene.userData.__makerClouds = clouds;
    clouds.visible =
      !isWmMode && env !== 'dungeon' && env !== 'sideScroller' && cloudDensity > 0.015;
    const cloudMat = clouds.userData?.material as THREE.MeshStandardMaterial | undefined;
    if (cloudMat) {
      cloudMat.color.copy(cloudTint);
      cloudMat.emissive.copy(atmo.horizonColor).multiplyScalar(atmo.warmGlow * 0.22);
      cloudMat.emissiveIntensity = atmo.warmGlow > 0.4 ? 0.48 : 0.14;
      if (atmo.nightFactor > 0) {
        cloudMat.emissiveIntensity = 0.04;
      }
      if (level.sky === 'storm') {
        cloudMat.emissiveIntensity = 0.05;
      }
    }
    const fullnessScale = 0.72 + cloudDensity * 0.52;
    for (const child of clouds.children) {
      const ud = child.userData as { priority?: number; baseScale?: number };
      const priority = ud.priority ?? 0.5;
      const baseScale = ud.baseScale ?? 3.0;
      const isVisible = priority < cloudDensity;
      child.visible = isVisible;
      if (isVisible) {
        const edgeFade = THREE.MathUtils.clamp((cloudDensity - priority) / 0.14, 0.35, 1);
        child.scale.setScalar(baseScale * fullnessScale * edgeFade);
      }
    }
  }

  return atmo;
}

export function createFacetedCloudMesh(mat: THREE.Material, variant = 0): THREE.Group {
  const cloud = new THREE.Group();
  const puffLayouts: [number, number, number, number, number, number, number][][] = [
    [
      [0, 0.25, 0, 2.35, 1.35, 0.74, 1.08],
      [-2.15, -0.15, 0.35, 1.65, 1.15, 0.68, 0.96],
      [2.25, -0.1, -0.25, 1.75, 1.2, 0.7, 1.0],
      [-0.85, 0.95, 0.18, 1.55, 1.05, 0.88, 0.95],
      [1.05, 0.82, -0.15, 1.45, 1.0, 0.84, 0.92],
      [0.2, 0.1, 1.25, 1.4, 1.1, 0.68, 0.92],
      [-0.25, 0.05, -1.2, 1.35, 1.05, 0.66, 0.9],
    ],
    [
      [0, 0.15, 0, 2.55, 1.45, 0.7, 1.05],
      [-2.45, -0.15, -0.2, 1.7, 1.15, 0.64, 0.95],
      [2.4, -0.18, 0.3, 1.65, 1.12, 0.66, 0.94],
      [0.35, 1.08, 0.1, 1.68, 1.08, 0.9, 0.98],
      [-1.15, 0.72, -0.22, 1.38, 1.0, 0.82, 0.9],
      [1.35, 0.58, 0.18, 1.3, 1.0, 0.78, 0.92],
    ],
    [
      [-0.4, 0.18, 0, 2.15, 1.25, 0.72, 1.0],
      [1.55, 0.08, 0.25, 1.88, 1.18, 0.7, 0.96],
      [-2.15, -0.2, 0.2, 1.35, 1.08, 0.64, 0.88],
      [0.55, 0.92, -0.12, 1.48, 1.02, 0.88, 0.94],
      [-1.05, 0.72, 0.18, 1.28, 0.96, 0.82, 0.9],
    ],
  ];

  const layout = puffLayouts[Math.abs(variant) % puffLayouts.length];
  for (let i = 0; i < layout.length; i++) {
    const [px, py, pz, r, sx, sy, sz] = layout[i];
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat);
    puff.position.set(px, py, pz);
    puff.scale.set(sx, sy, sz);
    puff.rotation.set(((i * 0.7 + variant) % 1) * 0.45, (i * 1.1 + variant) % Math.PI, 0);
    cloud.add(puff);
  }
  return cloud;
}

export function updateSkyClouds(scene: THREE.Scene, elapsed: number, wind = 0.3) {
  syncBotwTime(elapsed);
  let skyDome = scene.userData.__makerSkyDome as THREE.Mesh | undefined;
  if (!skyDome) {
    skyDome = scene.getObjectByName('maker-skydome') as THREE.Mesh | undefined;
    if (skyDome) scene.userData.__makerSkyDome = skyDome;
  }
  const skyU = skyDome?.userData?.skyUniforms as { uTime?: { value: number } } | undefined;
  if (skyDome && skyDome.visible && skyU?.uTime) {
    skyU.uTime.value = elapsed * (0.35 + wind * 0.9);
  }
  let clouds = scene.userData.__makerClouds as THREE.Group | undefined;
  if (!clouds) {
    clouds = scene.getObjectByName('maker-clouds') as THREE.Group | undefined;
    if (clouds) scene.userData.__makerClouds = clouds;
  }
  if (!clouds || !clouds.visible) return;
  const speedBoost = 0.35 + wind * 1.15;
  for (const child of clouds.children) {
    if (!child.visible) continue;
    const ud = child.userData as {
      baseAngle?: number;
      radius?: number;
      baseY?: number;
      driftSpeed?: number;
      bobPhase?: number;
    };
    if (ud.baseAngle === undefined || ud.radius === undefined || ud.baseY === undefined) continue;
    const ang = ud.baseAngle + elapsed * (ud.driftSpeed ?? 0.008) * speedBoost;
    child.position.set(
      Math.cos(ang) * ud.radius,
      ud.baseY + Math.sin(elapsed * 0.45 + (ud.bobPhase ?? 0)) * 0.9,
      Math.sin(ang) * ud.radius
    );
    child.rotation.y = -ang + Math.PI * 0.5;
  }
}

export function syncSkyDomeToCamera(scene: THREE.Scene, cameraPos: THREE.Vector3) {
  let skyDome = scene.userData.__makerSkyDome as THREE.Mesh | undefined;
  if (!skyDome) {
    skyDome = scene.getObjectByName('maker-skydome') as THREE.Mesh | undefined;
    if (skyDome) scene.userData.__makerSkyDome = skyDome;
  }
  if (skyDome) {
    skyDome.position.set(cameraPos.x, 0, cameraPos.z);
  }
  let stars = scene.userData.__makerStars as THREE.Points | undefined;
  if (!stars) {
    stars = scene.getObjectByName('maker-stars') as THREE.Points | undefined;
    if (stars) scene.userData.__makerStars = stars;
  }
  if (stars) {
    stars.position.set(cameraPos.x, 0, cameraPos.z);
  }
}

const skyHash21Tsl = Fn(([pIn]: [any]) => {
  const p = vec2(fract(vec2(pIn).mul(vec2(123.34, 456.21)))).toVar();
  p.addAssign(dot(p, p.add(45.32)));
  return fract(p.x.mul(p.y));
});

const skyValueNoiseTsl = Fn(([p]: [any]) => {
  const i = floor(p);
  const fRaw = fract(p);
  const f = fRaw.mul(fRaw).mul(vec2(3.0).sub(fRaw.mul(2.0)));
  const a = skyHash21Tsl(i);
  const b = skyHash21Tsl(i.add(vec2(1.0, 0.0)));
  const c = skyHash21Tsl(i.add(vec2(0.0, 1.0)));
  const d = skyHash21Tsl(i.add(vec2(1.0, 1.0)));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
});

const skyFbmCloudTsl = Fn(([pIn]: [any]) => {
  const v = float(0.0).toVar();
  const amp = float(0.52).toVar();
  const p = vec2(pIn).toVar();
  Loop(4, () => {
    v.addAssign(amp.mul(skyValueNoiseTsl(p)));
    const nextP = vec2(p.x.mul(0.8).sub(p.y.mul(0.6)), p.x.mul(0.6).add(p.y.mul(0.8)))
      .mul(2.06)
      .add(vec2(1.7, 9.2));
    p.assign(nextP);
    amp.mulAssign(0.48);
  });
  return v;
});

export function ensureSkyDome(scene: THREE.Scene) {
  if (!scene.userData.__makerSkyDome && !scene.getObjectByName('maker-skydome')) {
    const skyGeo = new THREE.SphereGeometry(2400, 28, 18);
    const uZenith = uniform(new THREE.Color('#34466E'));
    const uMidSky = uniform(new THREE.Color('#A66E64'));
    const uHorizon = uniform(new THREE.Color('#D88E5A'));
    const uSunDir = uniform(new THREE.Vector3(0.6, 0.28, 0.45).normalize());
    const uSunColor = uniform(new THREE.Color('#FFA95C'));
    const uWarmGlow = uniform(0.9);
    const uCloudDensity = uniform(0.58);
    const uCloudColor = uniform(new THREE.Color('#F5EDE4'));
    const uTime = uniform(0);

    const skyMat = new MeshBasicNodeMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      toneMapped: true,
    });

    skyMat.colorNode = Fn(() => {
      const dir = normalize(positionLocal);
      const elev = clamp(dir.y, 0.0, 1.0);
      const lowerT = smoothstep(0.0, 0.34, elev);
      const upperT = smoothstep(0.24, 0.95, elev);
      const col = mix(uHorizon, uMidSky, lowerT).toVar();
      col.assign(mix(col, uZenith, pow(upperT, 0.85)));

      const viewDirXZ = normalize(vec2(dir.x, dir.z));
      const cloudSampleCoord = viewDirXZ
        .mul(1.6)
        .add(vec2(uTime.mul(0.012), uTime.mul(0.008)));
      const noiseVal = skyFbmCloudTsl(cloudSampleCoord);
      const horizonFade = smoothstep(0.02, 0.28, elev);
      const topFade = smoothstep(0.92, 0.45, elev);
      const cloudMask = clamp(
        noiseVal.sub(float(1.0).sub(uCloudDensity)).div(0.42),
        0.0,
        1.0
      ).mul(horizonFade).mul(topFade);

      const sunAlignment = dot(normalize(dir), uSunDir);
      const sunGlow = pow(clamp(sunAlignment, 0.0, 1.0), 16.0).mul(0.65);
      const finalCol = mix(col, uCloudColor, cloudMask).toVar();
      finalCol.addAssign(uSunColor.mul(sunGlow.mul(uWarmGlow)));
      return finalCol;
    })();

    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    skyMesh.name = 'maker-skydome';
    skyMesh.renderOrder = -10;
    skyMesh.frustumCulled = false;
    skyMesh.userData.skyUniforms = {
      uZenith,
      uMidSky,
      uHorizon,
      uSunDir,
      uSunColor,
      uWarmGlow,
      uCloudDensity,
      uCloudColor,
      uTime,
    };
    scene.add(skyMesh);
    scene.userData.__makerSkyDome = skyMesh;
  }

  if (!scene.userData.__makerStars && !scene.getObjectByName('maker-stars')) {
    const starCount = 350;
    const starGeo = new THREE.BufferGeometry();
    const posArr = new Float32Array(starCount * 3);
    const colArr = new Float32Array(starCount * 3);
    const rng = (seed: number) => {
      const x = Math.sin(seed * 78.233) * 43758.5453123;
      return x - Math.floor(x);
    };

    for (let i = 0; i < starCount; i++) {
      const u = rng(i * 3 + 1);
      const v = rng(i * 3 + 2);
      const theta = u * Math.PI * 2;
      const phi = Math.acos(2 * v - 1);
      const r = 2100;
      posArr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      posArr[i * 3 + 1] = Math.max(120, r * Math.cos(phi));
      posArr[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      const tintRoll = rng(i * 3 + 3);
      const starCol =
        tintRoll > 0.85
          ? new THREE.Color('#93C5FD')
          : tintRoll > 0.7
          ? new THREE.Color('#FDE047')
          : new THREE.Color('#FFFFFF');
      colArr[i * 3] = starCol.r;
      colArr[i * 3 + 1] = starCol.g;
      colArr[i * 3 + 2] = starCol.b;
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));

    const starMat = new THREE.PointsMaterial({
      size: 14,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const starPoints = new THREE.Points(starGeo, starMat);
    starPoints.name = 'maker-stars';
    starPoints.renderOrder = -11;
    starPoints.frustumCulled = false;
    scene.add(starPoints);
    scene.userData.__makerStars = starPoints;
  }
}
