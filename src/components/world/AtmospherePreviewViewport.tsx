import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial, type WebGPURenderer } from 'three/webgpu';
import {
  clamp,
  cos,
  dot,
  exp,
  float,
  floor,
  fract,
  length,
  max,
  mix,
  normalize,
  positionLocal,
  positionWorld,
  pow,
  sin,
  smoothstep,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { CloudFog, Compass, Sparkles } from 'lucide-react';
import { getBiome } from '../../data/registries';
import { resolvePostProcessingConfig } from '../../data/postProcessingPresets';
import {
  applyAtmosphere,
  computeAtmosphereState,
  createMakerRenderer,
  detectSoftwareGl,
  disposeObject3D,
  ensureSkyDome,
  initMakerRenderer,
  syncSkyDomeToCamera,
  updateSkyClouds,
} from '../../three/islandScene';
import { computeWeatherWindFactor } from '../../three/canopyClusterBuilder';
import { forceReleaseRendererContext } from '../../three/webglUtils';
import type { GameLevel, PostProcessingConfig } from '../../types/maker';
import type { AtmosphereSectionId } from '../../utils/editorPrefs';

type PreviewCameraMode = 'landSky' | 'skyward' | 'valleyMist';

interface AtmospherePreviewViewportProps {
  level: GameLevel;
  postProcessing?: PostProcessingConfig;
  activeSection?: AtmosphereSectionId;
}

const CAMERA_PRESETS: Record<
  PreviewCameraMode,
  { yaw: number; pitch: number; dist: number; targetY: number }
> = {
  landSky: { yaw: 0.42, pitch: 0.14, dist: 21.5, targetY: 3.1 },
  skyward: { yaw: 0.55, pitch: -0.24, dist: 16.5, targetY: 5.8 },
  valleyMist: { yaw: -0.35, pitch: 0.24, dist: 23.0, targetY: 1.8 },
};

function sampleMiniHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  // Central valley pond depression
  const pondDip = -2.35 * Math.exp(-(x * x + (z - 1.2) * (z - 1.2)) / 24.0);
  // Rolling meadow hills framing left, right, and rear ridges
  const hillLeft = 4.6 * Math.exp(-((x + 8.5) * (x + 8.5) + (z + 4.5) * (z + 4.5)) / 42.0);
  const hillRight = 5.4 * Math.exp(-((x - 9.2) * (x - 9.2) + (z + 5.8) * (z + 5.8)) / 48.0);
  const rearPeak = 7.2 * Math.exp(-((x - 1.2) * (x - 1.2) + (z + 13.5) * (z + 13.5)) / 56.0);
  const ripple =
    Math.sin(x * 0.26) * Math.cos(z * 0.24) * 0.65 +
    Math.sin((x + z) * 0.45) * 0.22;
  const edgeTaper = THREE.MathUtils.clamp(1 - Math.max(0, r - 17) / 14, 0, 1);
  return (0.4 + pondDip + hillLeft + hillRight + rearPeak + ripple) * edgeTaper - (1 - edgeTaper) * 2.2;
}

function createSoftParticleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
    grad.addColorStop(0.0, 'rgba(255,255,255,1.0)');
    grad.addColorStop(0.32, 'rgba(255,248,225,0.82)');
    grad.addColorStop(0.68, 'rgba(255,235,190,0.22)');
    grad.addColorStop(1.0, 'rgba(255,220,160,0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Smooth organic 2D noise in TSL for miniature valley ground mist (zero hard stripes!)
const miniHash = (p: any) => {
  const s = fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))).mul(43758.5453));
  return fract(s.x.add(s.y));
};

const miniNoise = (p: any) => {
  const i = floor(p);
  const fRaw = fract(p);
  const f = fRaw.mul(fRaw).mul(vec2(3.0).sub(fRaw.mul(2.0)));
  const a = miniHash(i);
  const b = miniHash(i.add(vec2(1.0, 0.0)));
  const c = miniHash(i.add(vec2(0.0, 1.0)));
  const d = miniHash(i.add(vec2(1.0, 1.0)));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
};

export const AtmospherePreviewViewport: React.FC<AtmospherePreviewViewportProps> = ({
  level,
  postProcessing,
  activeSection,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const levelRef = useRef<GameLevel>(level);
  levelRef.current = level;

  const postCfg = useMemo(() => resolvePostProcessingConfig(postProcessing), [postProcessing]);
  const postCfgRef = useRef(postCfg);
  postCfgRef.current = postCfg;

  const [cameraMode, setCameraMode] = useState<PreviewCameraMode>('landSky');
  const camStateRef = useRef({
    yaw: CAMERA_PRESETS.landSky.yaw,
    pitch: CAMERA_PRESETS.landSky.pitch,
    dist: CAMERA_PRESETS.landSky.dist,
    targetY: CAMERA_PRESETS.landSky.targetY,
    goalYaw: CAMERA_PRESETS.landSky.yaw,
    goalPitch: CAMERA_PRESETS.landSky.pitch,
    goalDist: CAMERA_PRESETS.landSky.dist,
    goalTargetY: CAMERA_PRESETS.landSky.targetY,
    dragging: false,
    lastX: 0,
    lastY: 0,
  });

  // Gently frame the ideal camera angle when switching atmosphere sections (unless user dragged manually recently)
  const userDraggedRef = useRef(false);
  useEffect(() => {
    if (userDraggedRef.current || !activeSection) return;
    if (activeSection === 'skyTime') {
      setCameraMode('landSky');
    } else if (activeSection === 'fogMist') {
      setCameraMode('valleyMist');
    } else if (activeSection === 'horizonVista') {
      setCameraMode('landSky');
    }
  }, [activeSection]);

  useEffect(() => {
    const preset = CAMERA_PRESETS[cameraMode];
    camStateRef.current.goalYaw = preset.yaw;
    camStateRef.current.goalPitch = preset.pitch;
    camStateRef.current.goalDist = preset.dist;
    camStateRef.current.goalTargetY = preset.targetY;
  }, [cameraMode]);

  // Ref bag for live uniform & scene syncing without recreating renderer
  const sceneCtxRef = useRef<{
    scene: THREE.Scene;
    renderer: WebGPURenderer;
    sun: THREE.DirectionalLight;
    hemi: THREE.HemisphereLight;
    terrainMat: MeshStandardNodeMaterial;
    waterMat: MeshStandardNodeMaterial;
    foliageMat: MeshStandardNodeMaterial;
    mountainGroup: THREE.Group;
    mountainMat: MeshStandardNodeMaterial;
    treeGroup: THREE.Group;
    shaftsGroup: THREE.Group;
    dustPoints: THREE.Points;
    weatherPoints: THREE.Points | null;
    mistUniforms: {
      uTime: { value: number };
      uMistEnabled: { value: number };
      uMistDensity: { value: number };
      uMistHeight: { value: number };
      uMistSoftness: { value: number };
      uMistNoise: { value: number };
      uMistPatchiness: { value: number };
      uMistColor: { value: THREE.Color };
      uWindSpeed: { value: number };
    };
    shaftUniforms: {
      uTime: { value: number };
      uSunColor: { value: THREE.Color };
      uIntensity: { value: number };
    };
    currentWeather: string;
    rebuildWeather: (weather: GameLevel['weather']) => void;
    syncFromProps: () => void;
  } | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let disposed = false;
    let frameId = 0;
    const isSoftwareGl = detectSoftwareGl();
    let renderer = createMakerRenderer(isSoftwareGl);
    renderer.shadowMap.enabled = false; // Lightweight crisp lighting for mini preview
    renderer.setPixelRatio(1);

    const w0 = Math.max(220, container.clientWidth || 268);
    const h0 = Math.max(150, container.clientHeight || 176);
    renderer.setSize(w0, h0);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    ensureSkyDome(scene, 0.22);

    const camera = new THREE.PerspectiveCamera(48, w0 / h0, 0.15, 1100);

    const hemi = new THREE.HemisphereLight('#A8D2F0', '#4E663C', 0.72);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight('#FFF0D4', 1.55);
    sun.position.set(42, 32, 26);
    scene.add(sun);

    // Shared organic valley-mist TSL uniforms (applied smoothly to terrain, foliage & water — zero hard planes!)
    const uMistTime = uniform(0.0);
    const uMistEnabled = uniform(1.0);
    const uMistDensity = uniform(0.75);
    const uMistHeight = uniform(2.0);
    const uMistSoftness = uniform(4.2);
    const uMistNoise = uniform(0.95);
    const uMistPatchiness = uniform(0.45);
    const uMistColor = uniform(new THREE.Color('#C8DCEB'));
    const uWindSpeed = uniform(0.6);

    const buildMistEmissiveNode = () => {
      const drift = vec2(uMistTime.mul(0.09).mul(uWindSpeed), uMistTime.mul(0.045).mul(uWindSpeed));
      const p1 = positionWorld.xz.mul(0.11).sub(drift);
      const n1 = miniNoise(p1);
      const n2 = miniNoise(p1.mul(2.15).add(drift.mul(1.3)).add(vec2(5.2, 2.8)));
      const fbm = n1.mul(0.64).add(n2.mul(0.36));

      // Organic height boundary undulation so mist never forms a flat horizontal stripe
      const undulatedCeiling = uMistHeight.add(fbm.sub(0.5).mul(uMistNoise.mul(3.4)));
      const heightFade = float(1.0).sub(
        smoothstep(
          undulatedCeiling.sub(uMistSoftness.mul(0.45)),
          undulatedCeiling.add(uMistSoftness.mul(0.95)),
          positionWorld.y
        )
      );
      const patchMask = mix(
        float(1.0),
        smoothstep(0.24, 0.76, fbm),
        clamp(uMistPatchiness, 0.0, 1.0)
      );
      const valleyMask = clamp(heightFade.mul(patchMask).mul(uMistDensity).mul(uMistEnabled).mul(0.68), 0.0, 0.85);
      return uMistColor.mul(valleyMask);
    };

    // 1. Sculpted Miniature Land Mesh
    const segs = 44;
    const terrainGeo = new THREE.PlaneGeometry(42, 42, segs, segs);
    terrainGeo.rotateX(-Math.PI / 2);
    const tPos = terrainGeo.attributes.position as THREE.BufferAttribute;
    const tCols = new Float32Array(tPos.count * 3);
    const cLow = new THREE.Color('#6E994B');
    const cMid = new THREE.Color('#86B856');
    const cRock = new THREE.Color('#7B848C');
    const cTmp = new THREE.Color();
    for (let i = 0; i < tPos.count; i++) {
      const x = tPos.getX(i);
      const z = tPos.getZ(i);
      const y = sampleMiniHeight(x, z);
      tPos.setY(i, y);
      const rockT = THREE.MathUtils.clamp((y - 3.6) / 3.2, 0, 1);
      const lowT = THREE.MathUtils.clamp((y + 1.5) / 2.6, 0, 1);
      cTmp.copy(cLow).lerp(cMid, lowT).lerp(cRock, rockT * 0.75);
      tCols[i * 3] = cTmp.r;
      tCols[i * 3 + 1] = cTmp.g;
      tCols[i * 3 + 2] = cTmp.b;
    }
    terrainGeo.setAttribute('color', new THREE.BufferAttribute(tCols, 3));
    terrainGeo.computeVertexNormals();

    const terrainMat = new MeshStandardNodeMaterial({
      color: '#FFFFFF',
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.0,
    });
    terrainMat.emissiveNode = buildMistEmissiveNode();
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    scene.add(terrainMesh);

    // 2. Valley Pond & Outer Ocean Water Surface
    const waterGeo = new THREE.CircleGeometry(145, 48);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new MeshStandardNodeMaterial({
      color: '#2A88E8',
      roughness: 0.24,
      metalness: 0.12,
      transparent: true,
      opacity: 0.86,
    });
    waterMat.emissiveNode = buildMistEmissiveNode().mul(0.85);
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.position.y = -0.82;
    scene.add(waterMesh);

    // 3. Distant 360° Horizon Mountain Ring
    const mountainGroup = new THREE.Group();
    const mountainMat = new MeshStandardNodeMaterial({
      color: '#5B6E82',
      roughness: 0.94,
      metalness: 0.0,
      flatShading: true,
    });
    mountainMat.emissiveNode = buildMistEmissiveNode().mul(0.7);
    const peakCount = 22;
    for (let i = 0; i < peakCount; i++) {
      const ang = (i / peakCount) * Math.PI * 2 + (i % 3) * 0.08;
      const dist = 54 + (i % 4) * 14;
      const radius = 11 + (i % 5) * 3.8;
      const height = 10 + (i % 4) * 5.2;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 6), mountainMat);
      cone.position.set(Math.cos(ang) * dist, height * 0.42 - 2.2, Math.sin(ang) * dist);
      cone.rotation.y = i * 1.1;
      cone.userData.baseHeight = height;
      mountainGroup.add(cone);
    }
    scene.add(mountainGroup);

    // 4. Stylized Miniature Pine & Oak Grove (shows fog, sunlight, wind sway & god rays)
    const treeGroup = new THREE.Group();
    const trunkMat = new MeshStandardNodeMaterial({ color: '#6E4C34', roughness: 0.92 });
    const foliageMat = new MeshStandardNodeMaterial({ color: '#44823A', roughness: 0.86 });
    foliageMat.emissiveNode = buildMistEmissiveNode().mul(0.85);
    const trunkGeo = new THREE.CylinderGeometry(0.11, 0.18, 1.4, 6);
    const pineGeoA = new THREE.ConeGeometry(0.95, 2.2, 7);
    const pineGeoB = new THREE.ConeGeometry(0.7, 1.7, 7);
    const oakGeo = new THREE.IcosahedronGeometry(0.95, 1);

    const treeCoords: [number, number, boolean, number][] = [
      [-6.8, -3.5, true, 1.15],
      [-8.6, -5.8, true, 1.35],
      [-5.2, -6.5, false, 1.0],
      [-9.5, -1.6, true, 0.95],
      [6.4, -3.8, true, 1.2],
      [8.8, -6.0, true, 1.3],
      [5.5, -7.2, false, 1.1],
      [10.2, -2.5, true, 0.95],
      [-1.5, -9.8, true, 1.4],
      [2.6, -10.5, true, 1.3],
      [-4.2, 4.8, false, 0.92],
      [5.4, 5.2, false, 0.96],
      [-10.4, 3.4, true, 1.05],
      [9.4, 4.2, true, 1.1],
    ];
    for (let i = 0; i < treeCoords.length; i++) {
      const [tx, tz, isPine, sc] = treeCoords[i];
      const ty = sampleMiniHeight(tx, tz);
      if (ty < -0.65) continue;
      const tGrp = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 0.65;
      tGrp.add(trunk);
      if (isPine) {
        const c1 = new THREE.Mesh(pineGeoA, foliageMat);
        c1.position.y = 1.9;
        const c2 = new THREE.Mesh(pineGeoB, foliageMat);
        c2.position.y = 3.0;
        tGrp.add(c1, c2);
      } else {
        const crown = new THREE.Mesh(oakGeo, foliageMat);
        crown.position.y = 2.05;
        crown.scale.set(1.15, 0.92, 1.05);
        tGrp.add(crown);
      }
      tGrp.position.set(tx, ty - 0.08, tz);
      tGrp.scale.setScalar(sc);
      tGrp.userData.swayPhase = i * 1.3;
      treeGroup.add(tGrp);
    }
    scene.add(treeGroup);

    // 5. Miniature 3D Volumetric God Ray Shafts
    const shaftsGroup = new THREE.Group();
    const uShaftTime = uniform(0.0);
    const uShaftColor = uniform(new THREE.Color('#FFF0C2'));
    const uShaftIntensity = uniform(0.65);

    const shaftMat = new MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    shaftMat.colorNode = (() => {
      const radDist = length(vec2(positionLocal.x, positionLocal.z));
      const radFade = float(1.0).sub(smoothstep(float(0.05), float(0.95), radDist));
      const topFade = smoothstep(float(0.0), float(0.24), uv().y);
      const btmFade = float(1.0).sub(smoothstep(float(0.72), float(1.0), uv().y));
      const shimmer = sin(uv().y.mul(5.0).sub(uShaftTime.mul(0.8))).mul(0.18).add(0.82);
      const alpha = clamp(
        radFade.mul(topFade).mul(btmFade).mul(shimmer).mul(uShaftIntensity).mul(0.26),
        float(0.0),
        float(0.55)
      );
      return vec4(uShaftColor, alpha);
    })();

    const shaftConfigs: [number, number, number, number][] = [
      [-4.5, 5.5, -4.5, 1.35],
      [0.8, 6.2, -3.2, 1.65],
      [5.2, 5.8, -5.0, 1.4],
      [-1.8, 5.2, 1.5, 1.25],
    ];
    for (const [sx, sy, sz, rad] of shaftConfigs) {
      const coneGeo = new THREE.CylinderGeometry(rad * 0.32, rad * 1.45, 22, 10, 1, true);
      const beam = new THREE.Mesh(coneGeo, shaftMat);
      beam.position.set(sx, sy, sz);
      shaftsGroup.add(beam);
    }
    scene.add(shaftsGroup);

    // 6. Floating Sunbeam Dust Motes
    const dustCount = 110;
    const dustPos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3] = (Math.random() - 0.5) * 24;
      dustPos[i * 3 + 1] = 0.2 + Math.random() * 8.5;
      dustPos[i * 3 + 2] = (Math.random() - 0.5) * 24;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustTex = createSoftParticleTexture();
    const dustMat = new THREE.PointsMaterial({
      size: 0.34,
      map: dustTex,
      color: '#FFF4D4',
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const dustPoints = new THREE.Points(dustGeo, dustMat);
    scene.add(dustPoints);

    // 7. Localized Weather Particles Helper
    let weatherPoints: THREE.Points | null = null;
    const rebuildWeather = (weather: GameLevel['weather']) => {
      if (weatherPoints) {
        scene.remove(weatherPoints);
        disposeObject3D(weatherPoints);
        weatherPoints = null;
      }
      if (weather === 'none') return;
      const isFireflies = weather === 'fireflies';
      const isLeaves = weather === 'leaves';
      const isStorm = weather === 'storm';
      const isRain = weather === 'rain' || isStorm;
      const count = isStorm ? 260 : isRain ? 180 : isFireflies ? 70 : isLeaves ? 80 : 140;
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 28;
        pos[i * 3 + 1] = isFireflies ? 0.2 + Math.random() * 5.0 : Math.random() * 14;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 28;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        color: isStorm
          ? '#98C7EB'
          : isRain
          ? '#BAE6FD'
          : isFireflies
          ? '#FFE97D'
          : isLeaves
          ? '#F59E0B'
          : '#FFFFFF',
        map: isFireflies ? dustTex : undefined,
        size: isStorm ? 0.22 : isRain ? 0.18 : isFireflies ? 0.58 : isLeaves ? 0.36 : 0.28,
        transparent: true,
        opacity: isStorm ? 0.8 : isRain ? 0.65 : isFireflies ? 0.95 : 0.88,
        blending: isFireflies ? THREE.AdditiveBlending : THREE.NormalBlending,
        depthWrite: false,
      });
      weatherPoints = new THREE.Points(geo, mat);
      weatherPoints.userData.weather = weather;
      scene.add(weatherPoints);
      if (sceneCtxRef.current) {
        sceneCtxRef.current.weatherPoints = weatherPoints;
        sceneCtxRef.current.currentWeather = weather;
      }
    };

    const _sunDir = new THREE.Vector3();
    const _upVec = new THREE.Vector3(0, 1, 0);
    const _quat = new THREE.Quaternion();

    const syncFromProps = () => {
      const lvl = levelRef.current;
      const pCfg = postCfgRef.current;
      const atmo = applyAtmosphere(scene, sun, hemi, lvl, renderer);

      // Slightly stronger fog scale for the compact 42m diorama so Distance Fog reads clearly
      if (scene.fog instanceof THREE.FogExp2) {
        const previewFogBase = 0.0042 + (lvl.fog ?? 0.25) * 0.022;
        scene.fog.density = previewFogBase;
      }

      // Sync Tone Mapper & Exposure from Post FX
      renderer.toneMapping =
        (pCfg.toneMapping ?? 'agx') === 'aces'
          ? THREE.ACESFilmicToneMapping
          : THREE.AgXToneMapping;
      if (pCfg.enabled && pCfg.colorGradingEnabled) {
        renderer.toneMappingExposure = THREE.MathUtils.clamp(
          (renderer.toneMappingExposure || 1.0) * pCfg.exposure,
          0.45,
          2.2
        );
      }

      // Sync Biome Terrain & Water Palette
      const biome = getBiome(lvl.biome);
      terrainMat.color.set(biome.ground).lerp(new THREE.Color('#FFFFFF'), 0.25);
      foliageMat.color.set(biome.detail).lerp(new THREE.Color('#3F8739'), 0.35);
      waterMat.color.set(biome.water).lerp(atmo.horizonColor, 0.28);
      mountainMat.color
        .set(biome.detail)
        .lerp(atmo.midColor, 0.45)
        .lerp(new THREE.Color('#5A6D82'), 0.35);

      // Sync Visual Style Roughness feel
      const style = lvl.visualStyle ?? 'painterlyPBR';
      terrainMat.roughness = style === 'celToon' ? 0.96 : style === 'softFantasy' ? 0.85 : 0.9;

      // Sync Horizon Vista Mountains
      const vistaVisible = (lvl.vistaPreset ?? 'alpineValley') !== 'none';
      mountainGroup.visible = vistaVisible;
      const mScale = THREE.MathUtils.clamp(lvl.vistaMountainScale ?? 1.0, 0.05, 1.8);
      for (const child of mountainGroup.children) {
        child.scale.set(1, mScale, 1);
      }

      // Sync Organic Valley Mist uniforms
      const mistOn = lvl.volumetricFogEnabled ?? true;
      const hFogScale = THREE.MathUtils.clamp(lvl.vistaHeightFog ?? 1.0, 0, 2.0);
      const densityVal = THREE.MathUtils.clamp(
        (lvl.volumetricFogDensity ?? 1.0) * (0.45 + hFogScale * 0.45),
        0,
        2.5
      );
      uMistEnabled.value = mistOn ? 1.0 : 0.0;
      uMistDensity.value = densityVal;
      // Map world mist height (-4..20m) onto our miniature valley elevation (-1.2..5.5m)
      const worldMistH = lvl.volumetricFogHeight !== undefined ? lvl.volumetricFogHeight : 2.2;
      uMistHeight.value = THREE.MathUtils.clamp(-0.6 + (worldMistH + 4) * 0.25, -1.2, 6.2);
      const softVal = THREE.MathUtils.clamp(lvl.volumetricFogSoftness ?? 8.5, 1, 25);
      const sharpVal = THREE.MathUtils.clamp(lvl.volumetricFogSharpness ?? 0.3, 0, 1);
      uMistSoftness.value = THREE.MathUtils.clamp(softVal * 0.42 * (1.25 - sharpVal * 0.72), 0.45, 9.5);
      uMistNoise.value = THREE.MathUtils.clamp(lvl.volumetricFogNoise ?? 0.95, 0, 2.0);
      uMistPatchiness.value = THREE.MathUtils.clamp(lvl.volumetricFogPatchiness ?? 0.45, 0, 1.0);
      uMistColor.value.copy(atmo.fogColor).lerp(atmo.horizonColor, 0.32);
      uWindSpeed.value = THREE.MathUtils.clamp((lvl.volumetricFogSpeed ?? 0.75) * (0.5 + (lvl.wind ?? 0.45)), 0, 4.0);

      // Sync Volumetric God Rays & Dust Motes
      const raysOn = (lvl.godRaysEnabled ?? true) && atmo.nightFactor < 0.78;
      const raysInt = THREE.MathUtils.clamp(lvl.godRaysIntensity ?? 0.75, 0, 1.8) * (1 - atmo.nightFactor * 0.85);
      shaftsGroup.visible = raysOn && raysInt > 0.03;
      uShaftIntensity.value = raysOn ? raysInt : 0;
      uShaftColor.value.copy(atmo.sunColor).lerp(atmo.horizonColor, 0.25);

      _sunDir.copy(atmo.sunPos).normalize();
      if (_sunDir.y < 0.14) _sunDir.y = 0.14;
      _sunDir.normalize();
      _quat.setFromUnitVectors(_upVec, _sunDir);
      shaftsGroup.quaternion.copy(_quat);

      const dustLevel = THREE.MathUtils.clamp(lvl.atmosphericDust ?? 0.5, 0, 1);
      dustPoints.visible = dustLevel > 0.02;
      dustMat.opacity = dustLevel * 0.72;
      dustMat.color.copy(atmo.sunColor).lerp(new THREE.Color('#FFF8E4'), 0.45);

      // Sync Weather Particles
      if (!weatherPoints && lvl.weather !== 'none') {
        rebuildWeather(lvl.weather);
      } else if (weatherPoints && weatherPoints.userData.weather !== lvl.weather) {
        rebuildWeather(lvl.weather);
      }
    };

    sceneCtxRef.current = {
      scene,
      renderer,
      sun,
      hemi,
      terrainMat,
      waterMat,
      foliageMat,
      mountainGroup,
      mountainMat,
      treeGroup,
      shaftsGroup,
      dustPoints,
      weatherPoints,
      mistUniforms: {
        uTime: uMistTime,
        uMistEnabled,
        uMistDensity,
        uMistHeight,
        uMistSoftness,
        uMistNoise,
        uMistPatchiness,
        uMistColor,
        uWindSpeed,
      },
      shaftUniforms: {
        uTime: uShaftTime,
        uSunColor: uShaftColor,
        uIntensity: uShaftIntensity,
      },
      currentWeather: levelRef.current.weather,
      rebuildWeather,
      syncFromProps,
    };

    rebuildWeather(levelRef.current.weather);
    syncFromProps();

    const ro = new ResizeObserver(() => {
      if (disposed || !container) return;
      const cw = Math.max(180, container.clientWidth);
      const ch = Math.max(130, container.clientHeight);
      camera.aspect = cw / ch;
      camera.updateProjectionMatrix();
      renderer.setSize(cw, ch);
    });
    ro.observe(container);

    const timer = new THREE.Timer();
    let initialized = false;

    const renderLoop = () => {
      if (disposed) return;
      timer.update();
      const dt = Math.min(0.08, timer.getDelta());
      const t = timer.getElapsed();
      const lvl = levelRef.current;

      // Smooth orbit camera interpolation
      const cs = camStateRef.current;
      const lerpAmt = 1 - Math.exp(-dt * 8.5);
      cs.yaw += (cs.goalYaw - cs.yaw) * lerpAmt;
      cs.pitch += (cs.goalPitch - cs.pitch) * lerpAmt;
      cs.dist += (cs.goalDist - cs.dist) * lerpAmt;
      cs.targetY += (cs.goalTargetY - cs.targetY) * lerpAmt;

      const cosP = Math.cos(cs.pitch);
      camera.position.set(
        Math.sin(cs.yaw) * cosP * cs.dist,
        Math.max(1.2, cs.targetY + Math.sin(cs.pitch) * cs.dist),
        Math.cos(cs.yaw) * cosP * cs.dist
      );
      // When pitching upward (skyward), aim higher into the sky dome so Moon/Aurora/Clouds fill the frame
      const lookY = cs.pitch < 0 ? cs.targetY - Math.sin(cs.pitch) * cs.dist * 1.15 : cs.targetY;
      camera.lookAt(0, lookY, 0);

      syncSkyDomeToCamera(scene, camera.position);
      updateSkyClouds(scene, t, lvl.wind ?? 0.45);
      uMistTime.value = t;
      uShaftTime.value = t;

      // Gentle wind sway on miniature trees
      const windFac = computeWeatherWindFactor(lvl.weather, lvl.wind ?? 0.45);
      const swayAmp = THREE.MathUtils.clamp(windFac * 0.025, 0.005, 0.14);
      for (const tree of treeGroup.children) {
        const ph = (tree.userData.swayPhase as number | undefined) ?? 0;
        tree.rotation.z = Math.sin(t * (1.8 + windFac * 0.45) + ph) * swayAmp;
      }

      // Gentle drifting dust motes
      if (dustPoints.visible) {
        const dAttr = dustPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < dAttr.count; i++) {
          let dy = dAttr.getY(i) + Math.sin(t * 0.8 + i * 1.1) * dt * 0.25;
          let dx = dAttr.getX(i) + Math.cos(t * 0.5 + i) * dt * 0.18;
          if (dy > 9.5) dy = 0.5;
          if (dx > 12) dx = -12;
          dAttr.setXY(i, dx, dy);
        }
        dAttr.needsUpdate = true;
      }

      // Animate localized weather particles
      if (weatherPoints) {
        const wAttr = weatherPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
        const kind = weatherPoints.userData.weather as GameLevel['weather'];
        for (let i = 0; i < wAttr.count; i++) {
          let px = wAttr.getX(i);
          let py = wAttr.getY(i);
          let pz = wAttr.getZ(i);
          if (kind === 'fireflies') {
            px += Math.sin(t * 1.1 + i * 1.3) * dt * 0.65;
            py += Math.cos(t * 1.5 + i * 0.7) * dt * 0.38;
            pz += Math.cos(t * 0.9 + i * 1.1) * dt * 0.65;
            if (py < 0.2) py = 0.4;
            if (py > 5.5) py = 4.8;
          } else if (kind === 'leaves') {
            py -= dt * 1.6;
            px += Math.sin(t * 1.8 + i) * dt * 1.1;
            if (py < -1) {
              py = 13;
              px = (Math.random() - 0.5) * 26;
              pz = (Math.random() - 0.5) * 26;
            }
          } else {
            const isStorm = kind === 'storm';
            const isRain = kind === 'rain' || isStorm;
            py -= dt * (isStorm ? 18 : isRain ? 12.5 : 2.3);
            px += isStorm ? dt * 5.2 : isRain ? dt * 1.1 : Math.sin(t + i) * dt * 0.5;
            if (py < -1.2) {
              py = 13.5;
              px = (Math.random() - 0.5) * 26;
              pz = (Math.random() - 0.5) * 26;
            }
          }
          wAttr.setXYZ(i, px, py, pz);
        }
        wAttr.needsUpdate = true;
      }

      if (initialized) {
        try {
          renderer.render(scene, camera);
        } catch {
          // Skip transient render frame errors during resize/device recovery
        }
      }

      if (isSoftwareGl) {
        frameId = window.setTimeout(renderLoop, 110);
      } else {
        frameId = requestAnimationFrame(renderLoop);
      }
    };

    const boot = async () => {
      try {
        await initMakerRenderer(renderer);
      } catch {
        if (disposed) return;
        try {
          renderer.dispose();
        } catch {
          // ignore
        }
        renderer = createMakerRenderer(isSoftwareGl, true);
        renderer.shadowMap.enabled = false;
        renderer.setPixelRatio(1);
        renderer.setSize(
          Math.max(180, container.clientWidth || w0),
          Math.max(130, container.clientHeight || h0)
        );
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
        renderer.domElement.style.display = 'block';
        container.innerHTML = '';
        container.appendChild(renderer.domElement);
        if (sceneCtxRef.current) sceneCtxRef.current.renderer = renderer;
        await initMakerRenderer(renderer);
      }
      if (disposed) return;
      initialized = true;
      syncFromProps();
      renderLoop();
    };
    void boot();

    return () => {
      disposed = true;
      if (isSoftwareGl) {
        window.clearTimeout(frameId);
      } else {
        cancelAnimationFrame(frameId);
      }
      ro.disconnect();
      sceneCtxRef.current = null;
      disposeObject3D(scene);
      dustTex.dispose();
      try {
        renderer.dispose();
      } catch {
        // ignore
      }
      forceReleaseRendererContext(renderer);
    };
  }, []);

  // Re-sync preview immediately whenever any atmosphere or post FX setting changes
  useEffect(() => {
    sceneCtxRef.current?.syncFromProps();
  }, [level, postCfg]);

  // Lightweight live CSS color-grading & bloom/vignette preview reflecting Post FX panel edits
  const postFilterStyle = useMemo<React.CSSProperties>(() => {
    if (!postCfg.enabled) return {};
    const filters: string[] = [];
    if (postCfg.colorGradingEnabled) {
      const contrastPct = Math.round(THREE.MathUtils.clamp(1 + postCfg.contrast * 0.85, 0.45, 1.8) * 100);
      const satPct = Math.round(THREE.MathUtils.clamp(1 + postCfg.saturation, 0, 2.0) * 100);
      const brightPct = Math.round(THREE.MathUtils.clamp(postCfg.exposure, 0.55, 1.65) * 100);
      filters.push(`contrast(${contrastPct}%)`);
      filters.push(`saturate(${satPct}%)`);
      filters.push(`brightness(${brightPct}%)`);
      if (postCfg.temperature > 0.04) {
        filters.push(`sepia(${Math.round(postCfg.temperature * 28)}%)`);
      } else if (postCfg.temperature < -0.04) {
        filters.push(`hue-rotate(${Math.round(postCfg.temperature * 22)}deg)`);
      }
    }
    if (postCfg.bloomEnabled && postCfg.bloomIntensity > 0.05) {
      const glowBoost = Math.round(100 + Math.min(28, postCfg.bloomIntensity * 14));
      filters.push(`brightness(${glowBoost}%)`);
    }
    return filters.length > 0 ? { filter: filters.join(' ') } : {};
  }, [postCfg]);

  const vignetteStrength =
    postCfg.enabled && (postCfg.vignetteEnabled ?? postCfg.vignette > 0.01)
      ? THREE.MathUtils.clamp(postCfg.vignette, 0, 1)
      : 0;

  // Compact active mood summary for the header bar
  const moodSummary = useMemo(() => {
    const atmo = computeAtmosphereState(level);
    const isStorm =
      level.stormClouds !== undefined
        ? level.stormClouds
        : level.weather === 'storm' || level.sky === 'storm';
    if (isStorm) return 'Storm';
    if (level.auroraEnabled) return 'Aurora';
    if (atmo.nightFactor > 0.65) return 'Night';
    if (atmo.warmGlow > 0.65) return 'Golden';
    return 'Day';
  }, [level]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    userDraggedRef.current = true;
    camStateRef.current.dragging = true;
    camStateRef.current.lastX = e.clientX;
    camStateRef.current.lastY = e.clientY;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!camStateRef.current.dragging) return;
    const dx = e.clientX - camStateRef.current.lastX;
    const dy = e.clientY - camStateRef.current.lastY;
    camStateRef.current.lastX = e.clientX;
    camStateRef.current.lastY = e.clientY;
    camStateRef.current.goalYaw -= dx * 0.012;
    camStateRef.current.goalPitch = THREE.MathUtils.clamp(
      camStateRef.current.goalPitch + dy * 0.0085,
      -0.62,
      0.72
    );
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (camStateRef.current.dragging) {
      camStateRef.current.dragging = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  const modes: { id: PreviewCameraMode; label: string; Icon: React.FC<{ size?: number }> }[] = [
    { id: 'landSky', label: 'Land & Sky', Icon: Compass },
    { id: 'skyward', label: 'Sky View', Icon: Sparkles },
    { id: 'valleyMist', label: 'Valley Mist', Icon: CloudFog },
  ];

  return (
    <div className="rounded-xl border border-slate-200/85 dark:border-white/[0.1] bg-slate-100/90 dark:bg-[#111520] overflow-hidden flex flex-col shrink-0">
      {/* Compact Header */}
      <div className="px-2.5 py-1.5 flex items-center justify-between gap-2 border-b border-slate-200/75 dark:border-white/[0.07] bg-white/80 dark:bg-[#161B28]">
        <span className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100 tracking-tight truncate">
          Live Atmosphere Preview
        </span>
        <span className="text-[10px] font-bold text-slate-500 dark:text-[#8E96AB] shrink-0">
          {moodSummary} · Drag to look
        </span>
      </div>

      {/* Interactive 3D Miniature Land & Sky Canvas */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        title="Drag to orbit land and tilt up toward sky, moon, stars, aurora & clouds"
        className="relative w-full h-[186px] cursor-grab active:cursor-grabbing select-none overflow-hidden bg-[#0F1524]"
      >
        <div ref={mountRef} className="w-full h-full" style={postFilterStyle} />

        {/* Live Post FX Bloom Soft Glow Accent */}
        {postCfg.enabled && postCfg.bloomEnabled && postCfg.bloomIntensity > 0.15 && (
          <div
            className="pointer-events-none absolute inset-0 mix-blend-screen"
            style={{
              opacity: Math.min(0.32, postCfg.bloomIntensity * 0.16),
              background:
                'radial-gradient(circle at 50% 34%, rgba(255,244,214,0.85) 0%, rgba(255,220,168,0.18) 46%, rgba(0,0,0,0) 78%)',
            }}
          />
        )}

        {/* Live Post FX Vignette Overlay */}
        {vignetteStrength > 0.01 && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at center, rgba(0,0,0,0) ${Math.round(
                52 - vignetteStrength * 16
              )}%, rgba(0,0,0,${(vignetteStrength * 0.82).toFixed(2)}) 100%)`,
            }}
          />
        )}
      </div>

      {/* Camera Framing Bar */}
      <div className="grid grid-cols-3 gap-1 p-1.5 bg-white/80 dark:bg-[#161B28] border-t border-slate-200/75 dark:border-white/[0.07]">
        {modes.map(({ id, label, Icon }) => {
          const active = cameraMode === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                userDraggedRef.current = false;
                setCameraMode(id);
                const preset = CAMERA_PRESETS[id];
                camStateRef.current.goalYaw = preset.yaw;
                camStateRef.current.goalPitch = preset.pitch;
                camStateRef.current.goalDist = preset.dist;
                camStateRef.current.goalTargetY = preset.targetY;
              }}
              className={`py-1 px-1.5 rounded-lg text-[10px] font-bold inline-flex items-center justify-center gap-1 whitespace-nowrap transition-colors ${
                active
                  ? 'bg-[#0EA5E9] text-white'
                  : 'bg-slate-100 dark:bg-[#1E2331] text-slate-600 dark:text-[#9AA3B8] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon size={11} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
