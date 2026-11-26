import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { WebGPURenderer } from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Grid2X2, Layers, RotateCw, X } from 'lucide-react';
import type { MakerStore } from '../../store/useMakerStore';
import {
  applySeamlessBoxUVs,
  applySurfaceTextureToMaterial,
  applyWorldScaledBoxUVs,
  getProcessedSurfaceTextures,
  SCENERY_TEXTURE_SLOTS,
  subscribeCustomTextureCache,
} from '../../three/customTextureManager';
import {
  createMaterialVariantInstance,
  getSharedWeatheringBaseMaterial,
  updateMaterialVariantInstance,
} from '../../three/nodeMaterialUtils';
import {
  createMakerRenderer,
  detectSoftwareGl,
  disposeObject3D,
  initMakerRenderer,
  setupSceneEnvironment,
} from '../../three/islandScene';
import { getTerrainTextureAtlas } from '../../three/proceduralTextures';
import {
  createCurvedGrassTuftGeometries,
  createOrganicTrunkGeometry,
  createSculptedCanopyLobeGeometry,
} from '../../three/treeGeometry';
import type { SceneryTextureSlot, SurfaceTextureSettings } from '../../types/maker';
import { SurfaceTextureControls } from './SurfaceTextureControls';

interface TextureStudioModalProps {
  store: MakerStore;
  initialSlot?: SceneryTextureSlot;
  onClose: () => void;
}

function buildSlotShowcaseObject(
  slot: SceneryTextureSlot,
  settings: SurfaceTextureSettings | undefined
): THREE.Group {
  const group = new THREE.Group();
  const atlas = getTerrainTextureAtlas();

  const makeShowcaseMat = (defaultColor: string, defaultMap?: THREE.Texture, roughness = 0.84) => {
    const proc = settings?.enabled ? getProcessedSurfaceTextures(settings) : null;
    const isMatteSlot =
      slot === 'rocks' ||
      slot === 'cave' ||
      slot === 'treeBark' ||
      slot === 'pathRoad' ||
      slot === 'woodStructures' ||
      slot === 'grass';
    const hasMap = Boolean(proc?.map || defaultMap);
    const base = getSharedWeatheringBaseMaterial({
      hasMap,
      doubleSide: slot === 'grass',
    });
    const inst = createMaterialVariantInstance(base, {
      colorHex: defaultColor,
      map: defaultMap ?? null,
      roughness,
      diffuseRoughness:
        typeof settings?.diffuseRoughness === 'number'
          ? settings.diffuseRoughness
          : isMatteSlot
          ? 0.88
          : 0.45,
      weathering: settings?.weathering ?? 'none',
      weatheringIntensity: settings?.weatheringIntensity ?? 0.65,
    });
    if (proc) {
      applySurfaceTextureToMaterial(inst as unknown as THREE.MeshStandardMaterial, settings, {
        baseTintHex: defaultColor,
      });
    }
    inst.userData.__isShowcaseSlotMat = true;
    return inst as unknown as THREE.MeshStandardMaterial;
  };

  if (slot === 'treeCanopy') {
    const mat = makeShowcaseMat('#56A846', atlas.oakLeaves, 0.78);
    const g1 = createSculptedCanopyLobeGeometry(1.15, 1.08, 0.88, 1.04, 2.2, 24, 16, 2.4, 1.8);
    const g2 = createSculptedCanopyLobeGeometry(0.84, 1.04, 0.86, 1.02, 5.1, 20, 14, 2.2, 1.6);
    g2.translate(0.95, -0.22, 0.42);
    const g3 = createSculptedCanopyLobeGeometry(0.76, 1.06, 0.82, 1.04, 8.3, 20, 14, 2.1, 1.6);
    g3.translate(-0.88, -0.18, -0.36);
    const m1 = new THREE.Mesh(g1, mat);
    const m2 = new THREE.Mesh(g2, mat);
    const m3 = new THREE.Mesh(g3, mat);
    m1.position.y = 1.45;
    m2.position.y = 1.45;
    m3.position.y = 1.45;
    m1.castShadow = m2.castShadow = m3.castShadow = true;
    group.add(m1, m2, m3);
    return group;
  }

  if (slot === 'treeBark') {
    const mat = makeShowcaseMat('#72503A', atlas.oakBark, 0.88);
    const trunkGeo = createOrganicTrunkGeometry({
      rTop: 0.28,
      rBottom: 0.52,
      height: 2.9,
      yOffset: 0,
      radialSegs: 16,
      heightSegs: 12,
      rootCount: 5,
      rootFlare: 0.44,
      curveX: 0.12,
      curveZ: 0.08,
      barkFlute: 0.07,
      uvScaleU: 2.0,
      uvScaleV: 2.2,
      branches: [
        { startY: 1.7, length: 1.3, rBottom: 0.18, rTop: 0.06, tilt: 0.65, yaw: 0.6, bend: 0.09 },
        { startY: 1.9, length: 1.15, rBottom: 0.16, rTop: 0.05, tilt: 0.58, yaw: 2.8, bend: 0.08 },
      ],
    });
    const m = new THREE.Mesh(trunkGeo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return group;
  }

  if (slot === 'fruit') {
    const mat = makeShowcaseMat('#D93B3B', undefined, 0.34);
    const stemMat = new THREE.MeshStandardMaterial({ color: '#5A3E28', roughness: 0.85 });
    const positions: [number, number, number, number][] = [
      [0, 1.05, 0, 0.82],
      [-0.95, 0.72, 0.52, 0.58],
      [0.92, 0.68, -0.35, 0.56],
    ];
    for (const [x, y, z, r] of positions) {
      const sg = new THREE.SphereGeometry(r, 24, 18);
      sg.scale(1, 0.94, 1);
      const sm = new THREE.Mesh(sg, mat);
      sm.position.set(x, y, z);
      sm.castShadow = true;
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.32, 6), stemMat);
      st.position.set(x, y + r * 0.95, z);
      group.add(sm, st);
    }
    return group;
  }

  if (slot === 'rocks') {
    const mat = makeShowcaseMat('#8A92A0', atlas.rock, 0.88);
    if (!settings?.enabled) mat.flatShading = true;
    const g1 = applySeamlessBoxUVs(new THREE.DodecahedronGeometry(1.18, 0), 0.72);
    g1.scale(1.22, 0.84, 1.05);
    const m1 = new THREE.Mesh(g1, mat);
    m1.position.set(-0.22, 0.95, 0);
    m1.castShadow = m1.receiveShadow = true;

    const g2 = applySeamlessBoxUVs(new THREE.DodecahedronGeometry(0.76, 0), 0.72);
    g2.scale(0.95, 1.08, 0.92);
    const m2 = new THREE.Mesh(g2, mat);
    m2.position.set(1.05, 0.72, 0.45);
    m2.castShadow = m2.receiveShadow = true;
    group.add(m1, m2);
    return group;
  }

  if (slot === 'grass') {
    const mat = makeShowcaseMat('#66B84C', atlas.grass, 0.82);
    const slabGeo = new THREE.CylinderGeometry(2.05, 2.2, 0.42, 32, 1);
    const slab = new THREE.Mesh(slabGeo, mat);
    slab.position.y = 0.21;
    slab.receiveShadow = true;
    group.add(slab);

    const bladeMat = makeShowcaseMat('#72C452', undefined, 0.75);
    bladeMat.side = THREE.DoubleSide;
    const { innerGeo, outerGeo } = createCurvedGrassTuftGeometries();
    const offsets: [number, number, number][] = [
      [-0.75, 0.38, 0.4],
      [0.65, 0.38, -0.3],
      [0.05, 0.38, 0.65],
      [-0.25, 0.38, -0.75],
    ];
    for (const [ox, oy, oz] of offsets) {
      const mIn = new THREE.Mesh(innerGeo, bladeMat);
      const mOut = new THREE.Mesh(outerGeo, bladeMat);
      mIn.position.set(ox, oy, oz);
      mOut.position.set(ox, oy, oz);
      mIn.scale.setScalar(1.35);
      mOut.scale.setScalar(1.35);
      group.add(mIn, mOut);
    }
    return group;
  }

  if (slot === 'bushes') {
    const mat = makeShowcaseMat('#3E9648', atlas.oakLeaves, 0.8);
    const l1 = createSculptedCanopyLobeGeometry(1.05, 1.12, 0.82, 1.06, 1.8, 20, 14, 2.2, 1.6);
    const l2 = createSculptedCanopyLobeGeometry(0.76, 1.08, 0.8, 1.02, 4.4, 18, 12, 2.0, 1.5);
    l2.translate(0.76, -0.14, 0.28);
    const l3 = createSculptedCanopyLobeGeometry(0.7, 1.06, 0.8, 1.02, 7.6, 18, 12, 1.9, 1.4);
    l3.translate(-0.72, -0.18, -0.32);
    const m1 = new THREE.Mesh(l1, mat);
    const m2 = new THREE.Mesh(l2, mat);
    const m3 = new THREE.Mesh(l3, mat);
    m1.position.y = m2.position.y = m3.position.y = 0.88;
    m1.castShadow = m2.castShadow = m3.castShadow = true;
    group.add(m1, m2, m3);
    return group;
  }

  if (slot === 'flowerPetals' || slot === 'flowerStems') {
    const stemMat =
      slot === 'flowerStems'
        ? makeShowcaseMat('#479444', undefined, 0.76)
        : new THREE.MeshStandardMaterial({ color: '#479444', roughness: 0.76 });
    const petalMat =
      slot === 'flowerPetals'
        ? makeShowcaseMat('#FB7185', undefined, 0.5)
        : new THREE.MeshStandardMaterial({ color: '#FB7185', roughness: 0.5 });
    const centerMat = new THREE.MeshStandardMaterial({ color: '#FACC15', roughness: 0.45 });

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 1.95, 10), stemMat);
    stem.position.y = 0.98;
    stem.castShadow = true;

    const leafGeo = new THREE.ConeGeometry(0.36, 1.05, 6);
    const leaf1 = new THREE.Mesh(leafGeo, stemMat);
    leaf1.position.set(0.38, 0.75, 0);
    leaf1.rotation.z = -0.82;
    const leaf2 = new THREE.Mesh(leafGeo, stemMat);
    leaf2.position.set(-0.36, 0.55, 0.18);
    leaf2.rotation.z = 0.86;
    leaf2.rotation.y = 0.4;

    const bloomGroup = new THREE.Group();
    bloomGroup.position.set(0, 1.92, 0);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const pGeo = new THREE.SphereGeometry(0.42, 16, 12);
      pGeo.scale(1.15, 0.28, 0.76);
      const petal = new THREE.Mesh(pGeo, petalMat);
      petal.position.set(Math.cos(a) * 0.55, 0.04, Math.sin(a) * 0.55);
      petal.rotation.y = -a;
      petal.rotation.z = -0.14;
      petal.castShadow = true;
      bloomGroup.add(petal);
    }
    const center = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 12), centerMat);
    center.scale.set(1, 0.65, 1);
    center.position.y = 0.1;
    bloomGroup.add(center);

    group.add(stem, leaf1, leaf2, bloomGroup);
    return group;
  }

  if (slot === 'pathRoad') {
    const mat = makeShowcaseMat('#B89C76', atlas.cobble, 0.88);
    const roadGeo = applyWorldScaledBoxUVs(new THREE.BoxGeometry(3.4, 0.34, 2.8), 3.4, 0.34, 2.8, 0.45);
    const road = new THREE.Mesh(roadGeo, mat);
    road.position.y = 0.17;
    road.receiveShadow = road.castShadow = true;
    group.add(road);
    return group;
  }

  if (slot === 'cave') {
    const mat = makeShowcaseMat('#727988', atlas.craggyCaveRock, 0.92);
    const pGeo = applySeamlessBoxUVs(new THREE.DodecahedronGeometry(0.86, 0), 0.62);
    const left = new THREE.Mesh(pGeo, mat);
    left.scale.set(0.9, 1.5, 1.15);
    left.position.set(-1.05, 0.92, 0);
    const right = new THREE.Mesh(pGeo, mat);
    right.scale.set(0.9, 1.5, 1.15);
    right.position.set(1.05, 0.92, 0);
    const archGeo = applySeamlessBoxUVs(new THREE.DodecahedronGeometry(1.15, 0), 0.62);
    const arch = new THREE.Mesh(archGeo, mat);
    arch.scale.set(1.55, 0.66, 1.18);
    arch.position.set(0, 2.05, -0.1);
    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.28, 0),
      new THREE.MeshStandardMaterial({
        color: '#6CE5FF',
        emissive: '#38BDF8',
        emissiveIntensity: 1.2,
        roughness: 0.2,
      })
    );
    crystal.position.set(0, 0.55, -0.3);
    left.castShadow = right.castShadow = arch.castShadow = true;
    group.add(left, right, arch, crystal);
    return group;
  }

  // woodStructures: Wooden footbridge deck + rails + posts
  const mat = makeShowcaseMat('#8A5A36', undefined, 0.84);
  const deckGeo = applyWorldScaledBoxUVs(new THREE.BoxGeometry(3.4, 0.28, 2.2), 3.4, 0.28, 2.2, 0.45);
  const deck = new THREE.Mesh(deckGeo, mat);
  deck.position.y = 0.55;
  deck.castShadow = deck.receiveShadow = true;
  group.add(deck);

  const railGeo = applyWorldScaledBoxUVs(new THREE.BoxGeometry(3.3, 0.14, 0.14), 3.3, 0.14, 0.14, 0.5);
  const postGeo = applyWorldScaledBoxUVs(new THREE.BoxGeometry(0.2, 1.15, 0.2), 0.2, 1.15, 0.2, 0.5);
  for (const sz of [-0.95, 0.95]) {
    const rail = new THREE.Mesh(railGeo, mat);
    rail.position.set(0, 1.38, sz);
    rail.castShadow = true;
    group.add(rail);
    for (const px of [-1.4, 0, 1.4]) {
      const post = new THREE.Mesh(postGeo, mat);
      post.position.set(px, 0.96, sz);
      post.castShadow = true;
      group.add(post);
    }
  }
  return group;
}

export const TextureStudioModal: React.FC<TextureStudioModalProps> = ({
  store,
  initialSlot = 'rocks',
  onClose,
}) => {
  const { currentLevel } = store;
  const [activeSlot, setActiveSlot] = useState<SceneryTextureSlot>(initialSlot);
  const [autoSpin, setAutoSpin] = useState(true);
  const [showTileCheck, setShowTileCheck] = useState(true);
  const [cacheTick, setCacheTick] = useState(0);

  const mountRef = useRef<HTMLDivElement | null>(null);
  const tileCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const autoSpinRef = useRef(autoSpin);
  autoSpinRef.current = autoSpin;

  const sceneRefs = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    renderer: WebGPURenderer;
    showcaseContainer: THREE.Group;
  } | null>(null);

  useEffect(() => {
    return subscribeCustomTextureCache(() => setCacheTick((t) => t + 1));
  }, []);

  const activeSettings = currentLevel?.sceneryTextures?.[activeSlot];
  const activeSlotInfo =
    SCENERY_TEXTURE_SLOTS.find((s) => s.id === activeSlot) ?? SCENERY_TEXTURE_SLOTS[0];

  // Initialize live 3D material showcase stage once
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#141A24');

    const camera = new THREE.PerspectiveCamera(
      40,
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
      0.1,
      120
    );
    camera.position.set(3.2, 2.3, 4.4);

    const isSwGl = detectSoftwareGl();
    const renderer = createMakerRenderer(isSwGl);
    renderer.setSize(container.clientWidth || 420, container.clientHeight || 300);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    let envTex: THREE.Texture | null = null;

    const hemi = new THREE.HemisphereLight('#FFF5E0', '#334155', 1.15);
    const key = new THREE.DirectionalLight('#FFF6E3', 2.2);
    key.position.set(5, 8, 6);
    key.castShadow = !isSwGl;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0005;
    const rim = new THREE.DirectionalLight('#7DD3FC', 0.65);
    rim.position.set(-5, 3, -5);
    scene.add(hemi, key, rim);

    // Subtle studio turntable plinth
    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(2.55, 2.7, 0.28, 36),
      new THREE.MeshStandardMaterial({ color: '#1F2735', roughness: 0.85, metalness: 0.08 })
    );
    plinth.position.y = -0.14;
    plinth.receiveShadow = true;
    scene.add(plinth);

    const showcaseContainer = new THREE.Group();
    scene.add(showcaseContainer);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSwGl;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 1.05, 0);
    controls.minDistance = 2.2;
    controls.maxDistance = 12;
    controls.update();

    sceneRefs.current = { scene, camera, controls, renderer, showcaseContainer };

    let rafId = 0;
    let disposed = false;
    let lastTs = performance.now();

    const tick = (now: number) => {
      if (disposed) return;
      const dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;
      if (autoSpinRef.current) {
        showcaseContainer.rotation.y += dt * 0.42;
      }
      controls.update();
      renderer.render(scene, camera);
      if (isSwGl) {
        window.setTimeout(() => {
          if (!disposed) rafId = requestAnimationFrame(tick);
        }, 40);
      } else {
        rafId = requestAnimationFrame(tick);
      }
    };
    void (async () => {
      try {
        await initMakerRenderer(renderer);
      } catch {
        // ignore if unmounted
      }
      if (disposed) return;
      envTex = setupSceneEnvironment(scene, renderer);
      rafId = requestAnimationFrame(tick);
    })();

    const ro = new ResizeObserver(() => {
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(container);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      ro.disconnect();
      controls.dispose();
      envTex?.dispose();
      disposeObject3D(showcaseContainer);
      disposeObject3D(plinth);
      renderer.dispose();
      sceneRefs.current = null;
    };
  }, []);

  const lastShowcaseKeyRef = useRef('');

  // Rebuild showcase mesh when geometry slot, texture map, or color grading changes;
  // update roughness, EON diffuseRoughness & weathering in-place via NodeMaterialInstance!
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;
    const structuralKey = JSON.stringify({
      activeSlot,
      cacheTick,
      textureId: activeSettings?.textureId,
      enabled: activeSettings?.enabled,
      repeatX: activeSettings?.repeatX,
      repeatY: activeSettings?.repeatY,
      offsetX: activeSettings?.offsetX,
      offsetY: activeSettings?.offsetY,
      rotationDeg: activeSettings?.rotationDeg,
      flipX: activeSettings?.flipX,
      flipY: activeSettings?.flipY,
      bumpStrength: activeSettings?.bumpStrength,
      hueShift: activeSettings?.hueShift,
      saturation: activeSettings?.saturation,
      value: activeSettings?.value,
      contrast: activeSettings?.contrast,
      tintStrength: activeSettings?.tintStrength,
    });
    if (lastShowcaseKeyRef.current !== structuralKey) {
      lastShowcaseKeyRef.current = structuralKey;
      disposeObject3D(refs.showcaseContainer);
      refs.showcaseContainer.clear();
      const obj = buildSlotShowcaseObject(activeSlot, activeSettings);
      refs.showcaseContainer.add(obj);
      return;
    }

    // Zero-stutter in-place NodeMaterialInstance uniform update
    refs.showcaseContainer.traverse((child) => {
      const m = child as THREE.Mesh;
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        if (mat?.userData?.__isShowcaseSlotMat) {
          updateMaterialVariantInstance(mat, {
            roughness: activeSettings?.roughness,
            diffuseRoughness: activeSettings?.diffuseRoughness,
            weathering: activeSettings?.weathering ?? 'none',
            weatheringIntensity: activeSettings?.weatheringIntensity ?? 0.65,
          });
        }
      }
    });
  }, [activeSlot, activeSettings, cacheTick]);

  // Draw live 2x2 Seamless Tiling Check inset canvas
  useEffect(() => {
    const canvas = tileCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const proc = getProcessedSurfaceTextures(activeSettings);
    if (!proc) return;

    const half = canvas.width / 2;
    for (let gy = 0; gy < 2; gy++) {
      for (let gx = 0; gx < 2; gx++) {
        ctx.drawImage(proc.albedoCanvas, gx * half, gy * half, half, half);
      }
    }
    // Hairline center crosshair to inspect seam continuity
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(half, 0);
    ctx.lineTo(half, canvas.height);
    ctx.moveTo(0, half);
    ctx.lineTo(canvas.width, half);
    ctx.stroke();
  }, [activeSettings, cacheTick, showTileCheck]);

  if (!currentLevel) return null;

  const activeCount = SCENERY_TEXTURE_SLOTS.filter((s) => {
    const st = currentLevel.sceneryTextures?.[s.id];
    return Boolean(st?.enabled && st.textureId);
  }).length;

  const categories: ('Trees & Flora' | 'Ground & Paths' | 'Stone & Structures')[] = [
    'Trees & Flora',
    'Ground & Paths',
    'Stone & Structures',
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-2.5 sm:p-4">
      <div className="w-full max-w-6xl h-[min(92vh,800px)] rounded-2xl bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.1] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <header className="shrink-0 px-5 py-3 border-b border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-extrabold tracking-tight flex items-center gap-2 truncate">
              <Layers size={16} className="text-[#7C5CFF] shrink-0" />
              <span>Texture Maker</span>
              {activeCount > 0 && (
                <span className="px-2 py-0.5 rounded-lg bg-[#7C5CFF]/15 text-[#7C5CFF] text-[11px] font-bold">
                  {activeCount} custom {activeCount === 1 ? 'surface' : 'surfaces'}
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#949BB0] truncate">
              Upload seamless maps for trees, rocks, grass, bushes, flowers, paths, fruit, caves &amp; wooden bridges
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-500"
            aria-label="Close Texture Maker"
          >
            <X size={16} />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          {/* Left: Live 3D Material Showcase + 2x2 Seamless Tile Check */}
          <div className="relative lg:w-[46%] h-64 lg:h-auto shrink-0 bg-[#141A24] border-b lg:border-b-0 lg:border-r border-slate-200/80 dark:border-white/[0.08]">
            <div ref={mountRef} className="w-full h-full" />

            <div className="absolute top-3 left-3 pointer-events-none">
              <div className="px-3 py-1.5 rounded-xl bg-[#10151E]/90 border border-white/[0.1] text-[11px] font-semibold text-slate-200">
                {activeSlotInfo.label} Preview · Drag to orbit
              </div>
            </div>

            {showTileCheck && activeSettings?.enabled && activeSettings.textureId && (
              <div className="absolute top-3 right-3 p-1.5 rounded-xl bg-[#10151E]/92 border border-white/[0.12] space-y-1">
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-300 text-center">
                  2×2 Seam Check
                </div>
                <canvas
                  ref={tileCanvasRef}
                  width={108}
                  height={108}
                  className="w-[108px] h-[108px] rounded-lg block border border-white/[0.1]"
                />
              </div>
            )}

            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
              <div className="flex items-center gap-1.5 pointer-events-auto">
                <button
                  type="button"
                  onClick={() => setAutoSpin((s) => !s)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold whitespace-nowrap ${
                    autoSpin
                      ? 'bg-[#7C5CFF]/25 border-[#7C5CFF]/70 text-[#C4B5FD]'
                      : 'bg-[#10151E]/90 border-white/[0.12] text-slate-300'
                  }`}
                >
                  <RotateCw size={12} />
                  <span>{autoSpin ? 'Spin On' : 'Spin Off'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowTileCheck((s) => !s)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold whitespace-nowrap ${
                    showTileCheck
                      ? 'bg-[#20B46A]/25 border-[#20B46A]/70 text-[#86EFAC]'
                      : 'bg-[#10151E]/90 border-white/[0.12] text-slate-300'
                  }`}
                >
                  <Grid2X2 size={12} />
                  <span>2×2 Seam Check</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right: Surface Slot Selector + Controls */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            {/* Scenery Surface Slots */}
            <div className="space-y-2.5">
              {categories.map((cat) => (
                <div key={cat} className="space-y-1.5">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-[#8E96AB]">
                    {cat}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {SCENERY_TEXTURE_SLOTS.filter((s) => s.category === cat).map((slotInfo) => {
                      const isSel = activeSlot === slotInfo.id;
                      const st = currentLevel.sceneryTextures?.[slotInfo.id];
                      const hasActive = Boolean(st?.enabled && st.textureId);
                      const thumb = hasActive
                        ? store.customTextures.find((t) => t.id === st?.textureId)?.thumbnailDataUrl
                        : null;
                      return (
                        <button
                          key={slotInfo.id}
                          type="button"
                          onClick={() => setActiveSlot(slotInfo.id)}
                          className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border text-left transition-colors ${
                            isSel
                              ? 'bg-[#7C5CFF]/15 border-[#7C5CFF] text-[#7C5CFF] dark:text-[#C4B5FD]'
                              : hasActive
                              ? 'bg-[#20B46A]/10 border-[#20B46A]/40 text-slate-800 dark:text-slate-100'
                              : 'bg-slate-50 dark:bg-[#1B202C] border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:border-[#7C5CFF]/60'
                          }`}
                        >
                          {thumb ? (
                            <img
                              src={thumb}
                              alt=""
                              className="w-6 h-6 rounded-md object-cover shrink-0 border border-black/20"
                            />
                          ) : (
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                hasActive ? 'bg-[#20B46A]' : 'bg-slate-300 dark:bg-white/20'
                              }`}
                            />
                          )}
                          <span className="text-xs font-bold truncate">{slotInfo.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Active Surface Controls */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#1B202C] border border-slate-200/80 dark:border-white/[0.08] space-y-2.5">
              <div>
                <div className="text-xs font-extrabold">{activeSlotInfo.label}</div>
                <p className="text-[11px] text-slate-500 dark:text-[#8E96AB]">
                  {activeSlotInfo.description}
                </p>
              </div>

              <SurfaceTextureControls
                store={store}
                slot={activeSlot}
                title="Seamless Surface Texture"
                value={activeSettings}
                onChange={(next, recordUndo) =>
                  store.updateLevelSceneryTexture(activeSlot, next, recordUndo)
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
