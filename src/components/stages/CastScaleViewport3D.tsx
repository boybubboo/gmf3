import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RotateCcw, Trees, User } from 'lucide-react';
import { getBiome } from '../../data/registries';
import type {
  CustomAssetMeta,
  GameLevel,
  GameProject,
  LevelEntity,
  VisualStyleId,
} from '../../types/maker';
import { resolveEffectiveVistaTreeConfig } from '../../utils/defaultTreeStyles';
import { buildSingleCanopyTreeGroup } from '../../three/canopyClusterBuilder';
import {
  applyVisualStyleToObject,
  getCachedAssetSync,
  instantiateCustomModel,
  loadCustomAssetToCache,
} from '../../three/gltfAssetManager';
import {
  createMakerRenderer,
  detectSoftwareGl,
  disposeObject3D,
  initMakerRenderer,
  setupSceneEnvironment,
} from '../../three/islandScene';
import { buildEntityMesh, buildHeroModel } from '../../three/proceduralModels';
import {
  animateQuadrupedMonster,
  type QuadrupedMonsterRig,
} from '../../three/quadrupedMonsterBuilder';
import { getTerrainTextureAtlas } from '../../three/proceduralTextures';
import {
  createDetailedPineTierGeometry,
  createOrganicTrunkGeometry,
} from '../../three/treeGeometry';
import { applyVertexPaintStrokesToObject } from '../../three/vertexPainter';
import { isWebGPUFallbackAdapter } from '../../three/webglUtils';

export interface CastScaleViewport3DProps {
  project: GameProject;
  level: GameLevel;
  customAssets: CustomAssetMeta[];
  focusedTarget: 'hero' | 'entity';
  selectedEntity: LevelEntity | null;
  onSelectTarget?: (target: 'hero' | 'entity') => void;
}

type CamPreset = 'compare' | 'closeup' | 'tree';

function makeHeightTickSprite(label: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 44;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(6, 6, 84, 32, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#E2E8F0';
    ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 48, 23);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.48, 0.22, 1);
  return sprite;
}

function buildFallbackConiferTree(level: GameLevel, style: VisualStyleId): THREE.Group {
  const tree = new THREE.Group();
  const biome = getBiome(level.biome);
  const atlas = getTerrainTextureAtlas();

  const trunkGeo = createOrganicTrunkGeometry({
    rTop: 0.11,
    rBottom: 0.34,
    height: 2.9,
    yOffset: -0.35,
    radialSegs: 14,
    heightSegs: 8,
    rootCount: 5,
    rootFlare: 0.36,
    curveX: 0.06,
    curveZ: 0.04,
    barkFlute: 0.05,
    uvScaleU: 2.2,
    uvScaleV: 2.6,
  });
  const barkMat = new THREE.MeshStandardMaterial({
    color: '#FFFFFF',
    roughness: 0.9,
    map: atlas.pineBark,
    bumpMap: atlas.pineBarkBump,
    bumpScale: 0.14,
  });
  const trunk = new THREE.Mesh(trunkGeo, barkMat);
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  tree.add(trunk);

  const basePine = new THREE.Color(biome.detail).lerp(new THREE.Color('#4B9E3D'), 0.68);
  const tiers: [number, number, number, number, number, number][] = [
    [1.62, 1.52, 11, 1, 2.15, 0],
    [1.38, 1.42, 11, 2, 2.95, 0.29],
    [1.12, 1.32, 10, 3, 3.7, 0.61],
    [0.84, 1.18, 9, 4, 4.38, 0.95],
    [0.52, 0.98, 7, 5, 4.98, 0.42],
  ];
  tiers.forEach(([r, h, segs, seed, ty, rotY], idx) => {
    const geo = createDetailedPineTierGeometry(r, h, segs, seed);
    const tint = basePine.clone().offsetHSL(idx * 0.004, 0, -0.02 + idx * 0.032);
    const leafMat = new THREE.MeshStandardMaterial({
      color: tint,
      roughness: 0.82,
      map: atlas.pineLeaves,
      bumpMap: atlas.pineLeavesBump,
      bumpScale: 0.12,
      flatShading: style !== 'celToon',
    });
    const mesh = new THREE.Mesh(geo, leafMat);
    mesh.position.y = ty;
    mesh.rotation.y = rotY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    tree.add(mesh);
  });

  // Island scatter scales default size * 1.15
  tree.scale.setScalar(1.15);
  return tree;
}

export const CastScaleViewport3D: React.FC<CastScaleViewport3DProps> = ({
  project,
  level,
  customAssets,
  focusedTarget,
  selectedEntity,
  onSelectTarget,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [camPreset, setCamPreset] = useState<CamPreset>('compare');
  const [camNonce, setCamNonce] = useState(0);
  const [measuredCharHeight, setMeasuredCharHeight] = useState<number>(1.7);
  const [measuredTreeHeight, setMeasuredTreeHeight] = useState<number>(5.8);

  const stageRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: ReturnType<typeof createMakerRenderer>;
    controls: OrbitControls;
    turfDisc: THREE.Mesh;
    treeHolder: THREE.Group;
    charHolder: THREE.Group;
    timeUniform: { value: number };
    customUpdater: ((dt: number) => void) | null;
  } | null>(null);

  const effectiveTarget: 'hero' | 'entity' =
    focusedTarget === 'entity' && selectedEntity ? 'entity' : 'hero';

  const currentScale =
    effectiveTarget === 'hero'
      ? project.heroModelScale ?? 1
      : selectedEntity?.customAssetId
      ? selectedEntity.modelScaleAdjust ?? 1
      : selectedEntity?.scale ?? 1;

  const activeName =
    effectiveTarget === 'hero'
      ? project.heroName || 'Hero'
      : selectedEntity?.name || 'Cast Member';

  const boundEntityAsset = useMemo(
    () =>
      selectedEntity?.customAssetId
        ? customAssets.find((a) => a.id === selectedEntity.customAssetId) ?? null
        : null,
    [customAssets, selectedEntity?.customAssetId]
  );

  const boundHeroAsset = useMemo(
    () =>
      project.heroCustomAssetId
        ? customAssets.find((a) => a.id === project.heroCustomAssetId) ?? null
        : null,
    [customAssets, project.heroCustomAssetId]
  );

  // Initialize Three.js Studio Viewport
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();
    const width = container.clientWidth || 640;
    const height = container.clientHeight || 320;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#141A29');
    scene.fog = new THREE.Fog('#141A29', 16, 42);

    const camera = new THREE.PerspectiveCamera(38, width / Math.max(1, height), 0.1, 80);
    camera.position.set(0.45, 2.4, 8.2);

    let renderer = createMakerRenderer(isSoftwareGl);
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSoftwareGl ? 1 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    if ('shadowMap' in renderer && renderer.shadowMap) {
      renderer.shadowMap.enabled = !isSoftwareGl;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    let envTex: THREE.Texture | null = null;

    // Lights
    const hemi = new THREE.HemisphereLight('#DCEBFF', '#2A3528', 0.92);
    scene.add(hemi);

    const key = new THREE.DirectionalLight('#FFF5E2', 1.85);
    key.position.set(5.5, 9.5, 6.2);
    if (!isSoftwareGl) {
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.near = 1;
      key.shadow.camera.far = 25;
      key.shadow.camera.left = -5.5;
      key.shadow.camera.right = 5.5;
      key.shadow.camera.top = 7;
      key.shadow.camera.bottom = -1;
      key.shadow.bias = -0.0005;
    }
    scene.add(key);

    const rim = new THREE.DirectionalLight('#8FA8FF', 0.72);
    rim.position.set(-5.2, 4.4, -5.5);
    scene.add(rim);

    // Ground platform & meter grid
    const turfMat = new THREE.MeshStandardMaterial({
      color: getBiome(level.biome).ground || '#3C6E3B',
      roughness: 0.92,
      metalness: 0.02,
    });
    const turfDisc = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.4, 0.16, 48), turfMat);
    turfDisc.position.y = -0.08;
    turfDisc.receiveShadow = true;
    scene.add(turfDisc);

    const grid = new THREE.GridHelper(10, 10, '#475569', '#253147');
    grid.position.y = 0.004;
    if (Array.isArray(grid.material)) {
      grid.material.forEach((m) => {
        m.transparent = true;
        m.opacity = 0.32;
      });
    } else {
      grid.material.transparent = true;
      grid.material.opacity = 0.32;
    }
    scene.add(grid);

    // Vertical World Meter Ruler between Character (-0.75) and Conifer (1.65)
    const rulerGroup = new THREE.Group();
    rulerGroup.position.set(0.32, 0, -0.35);
    const poleGeo = new THREE.CylinderGeometry(0.012, 0.012, 6.0, 8);
    const poleMat = new THREE.MeshBasicMaterial({
      color: '#94A3B8',
      transparent: true,
      opacity: 0.45,
    });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 3.0;
    rulerGroup.add(pole);

    for (let m = 1; m <= 6; m++) {
      const tickGeo = new THREE.BoxGeometry(0.36, 0.014, 0.014);
      const tick = new THREE.Mesh(tickGeo, poleMat);
      tick.position.set(0, m, 0);
      rulerGroup.add(tick);
      const sp = makeHeightTickSprite(`${m}m`);
      sp.position.set(0.32, m, 0);
      rulerGroup.add(sp);
    }
    scene.add(rulerGroup);

    const treeHolder = new THREE.Group();
    treeHolder.position.set(1.65, 0, 0);
    scene.add(treeHolder);

    const charHolder = new THREE.Group();
    charHolder.position.set(-0.75, 0, 0.25);
    scene.add(charHolder);

    const createControls = (domEl: HTMLElement) => {
      domEl.style.touchAction = 'none';
      const c = new OrbitControls(camera, domEl);
      c.target.set(0.45, 1.55, 0);
      c.enableDamping = !isSoftwareGl;
      c.dampingFactor = 0.08;
      c.minDistance = 1.6;
      c.maxDistance = 18;
      c.maxPolarAngle = Math.PI * 0.51;
      c.update();
      return c;
    };
    let controls = createControls(renderer.domElement);

    const state = {
      scene,
      camera,
      renderer,
      controls,
      turfDisc,
      treeHolder,
      charHolder,
      timeUniform: { value: 0 },
      customUpdater: null as ((dt: number) => void) | null,
    };
    stageRef.current = state;

    let disposed = false;
    let frameId = 0;
    let lastTs = performance.now();

    const afterDraw = (cb: () => void) => {
      const gl =
        typeof renderer.getContext === 'function'
          ? (renderer.getContext() as Partial<WebGL2RenderingContext> | null)
          : null;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE ?? 0x9117, 0);
        gl.flush?.();
        const poll = () => {
          if (disposed) {
            if (sync) gl.deleteSync?.(sync);
            return;
          }
          const st = sync
            ? gl.getSyncParameter?.(sync, gl.SYNC_STATUS ?? 0x9114)
            : (gl.SIGNALED ?? 0x9119);
          if (st === (gl.UNSIGNALED ?? 0x9118)) {
            frameId = window.setTimeout(poll, 6);
          } else {
            if (sync) gl.deleteSync?.(sync);
            frameId = window.setTimeout(cb, 55);
          }
        };
        frameId = window.setTimeout(poll, 6);
      } else {
        frameId = window.setTimeout(cb, 70);
      }
    };

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min(0.06, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;
      state.timeUniform.value += dt;

      try {
        state.customUpdater?.(dt);
        state.controls.update();
        state.renderer.render(scene, camera);
      } catch {
        // ignore transient draw error
      } finally {
        if (!disposed) {
          if (isSoftwareGl) afterDraw(tick);
          else frameId = requestAnimationFrame(tick);
        }
      }
    };

    const switchToWebGLFallback = async (): Promise<boolean> => {
      if (disposed) return false;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      controls.dispose();
      envTex?.dispose();
      envTex = null;
      try {
        renderer.dispose();
      } catch {
        // ignore
      }
      renderer = createMakerRenderer(isSoftwareGl, true);
      renderer.setSize(container.clientWidth || 640, container.clientHeight || 320);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSoftwareGl ? 1 : 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      container.innerHTML = '';
      container.appendChild(renderer.domElement);
      controls = createControls(renderer.domElement);
      state.renderer = renderer;
      state.controls = controls;
      try {
        await initMakerRenderer(renderer);
        if (disposed) return false;
        envTex = setupSceneEnvironment(scene, renderer);
        return true;
      } catch {
        return false;
      }
    };

    void (async () => {
      let ok = false;
      try {
        await initMakerRenderer(renderer);
        if (!isSoftwareGl && isWebGPUFallbackAdapter(renderer)) {
          ok = await switchToWebGLFallback();
        } else {
          ok = true;
        }
      } catch {
        ok = await switchToWebGLFallback();
      }
      if (disposed || !ok) return;
      if (!envTex) {
        envTex = setupSceneEnvironment(scene, renderer);
      }
      tick();
    })();

    const ro = new ResizeObserver(() => {
      if (disposed) return;
      const w = container.clientWidth || 640;
      const h = container.clientHeight || 320;
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(container);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      ro.disconnect();
      state.controls.dispose();
      disposeObject3D(treeHolder);
      disposeObject3D(charHolder);
      disposeObject3D(rulerGroup);
      disposeObject3D(turfDisc);
      disposeObject3D(grid);
      envTex?.dispose();
      try {
        renderer.dispose();
      } catch {
        // ignore
      }
      stageRef.current = null;
    };
  }, []);

  // Build / refresh the world's current Conifer Tree whenever level conifer defaults or biome change
  useEffect(() => {
    const st = stageRef.current;
    if (!st) return;

    const biome = getBiome(level.biome);
    if (st.turfDisc.material instanceof THREE.MeshStandardMaterial) {
      st.turfDisc.material.color.set(biome.ground || '#3C6E3B');
    }

    disposeObject3D(st.treeHolder);
    st.treeHolder.clear();

    const style: VisualStyleId = level.visualStyle ?? 'painterlyPBR';
    const coniferCfg = resolveEffectiveVistaTreeConfig(level, 'conifer');
    const treeGroup = coniferCfg
      ? buildSingleCanopyTreeGroup(
          coniferCfg,
          `cast_conifer_${level.id}`,
          style,
          st.timeUniform,
          '#4D9E3E',
          { sceneryTextures: level.sceneryTextures, detail: 'forest' }
        )
      : buildFallbackConiferTree(level, style);

    treeGroup.traverse((ch) => {
      if ((ch as THREE.Mesh).isMesh) {
        ch.castShadow = true;
        ch.receiveShadow = true;
      }
    });
    st.treeHolder.add(treeGroup);

    treeGroup.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(treeGroup);
    if (!box.isEmpty()) {
      setMeasuredTreeHeight(Number(Math.max(0.5, box.max.y - box.min.y).toFixed(2)));
    }
  }, [
    level.id,
    level.biome,
    level.visualStyle,
    level.canopyEngine,
    level.sceneryTextures,
  ]);

  // Build / refresh the focused Hero or Cast Entity model
  useEffect(() => {
    const st = stageRef.current;
    if (!st) return;
    let cancelled = false;
    const style: VisualStyleId = level.visualStyle ?? 'painterlyPBR';

    const setPreviewObject = (
      obj: THREE.Object3D,
      updater: ((dt: number) => void) | null = null
    ) => {
      disposeObject3D(st.charHolder);
      st.charHolder.clear();
      st.charHolder.add(obj);
      st.customUpdater = updater;

      st.charHolder.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(st.charHolder);
      if (!box.isEmpty()) {
        setMeasuredCharHeight(Number(Math.max(0.15, box.max.y - box.min.y).toFixed(2)));
      }
    };

    if (effectiveTarget === 'hero') {
      const heroAssetId = project.heroCustomAssetId;
      if (heroAssetId) {
        const cached = getCachedAssetSync(heroAssetId);
        if (cached) {
          const inst = instantiateCustomModel(heroAssetId, boundHeroAsset ?? undefined, {
            scaleAdjust: 1,
            offsetY: 0,
            visualStyle: style,
          });
          if (inst) {
            setPreviewObject(inst.group, (dt) => inst.update(dt));
            return;
          }
        }
        // Fallback immediate preview while GLB decodes
        const fallbackHero = buildHeroModel(project.heroBody, project.heroColors);
        applyVisualStyleToObject(fallbackHero.group, style);
        setPreviewObject(fallbackHero.group, null);

        void loadCustomAssetToCache(heroAssetId, 'character').then((loaded) => {
          if (cancelled || !loaded || !stageRef.current) return;
          const inst = instantiateCustomModel(heroAssetId, boundHeroAsset ?? undefined, {
            scaleAdjust: 1,
            offsetY: 0,
            visualStyle: style,
          });
          if (inst) {
            setPreviewObject(inst.group, (dt) => inst.update(dt));
            // Re-measure with active scale applied
            const box = new THREE.Box3().setFromObject(stageRef.current.charHolder);
            if (!box.isEmpty()) {
              setMeasuredCharHeight(Number(Math.max(0.15, box.max.y - box.min.y).toFixed(2)));
            }
          }
        });
      } else {
        const heroRig = buildHeroModel(project.heroBody, project.heroColors);
        applyVisualStyleToObject(heroRig.group, style);
        setPreviewObject(heroRig.group, null);
      }
    } else if (selectedEntity) {
      const entAssetId = selectedEntity.customAssetId;
      if (entAssetId) {
        const attachInst = (inst: NonNullable<ReturnType<typeof instantiateCustomModel>>) => {
          const strokes =
            selectedEntity.vertexPaintStrokes && selectedEntity.vertexPaintStrokes.length > 0
              ? selectedEntity.vertexPaintStrokes
              : boundEntityAsset?.vertexPaintStrokes;
          if (strokes && strokes.length > 0) {
            applyVertexPaintStrokesToObject(inst.group, strokes);
          }
          setPreviewObject(inst.group, (dt) => inst.update(dt));
        };

        const cached = getCachedAssetSync(entAssetId);
        if (cached) {
          const inst = instantiateCustomModel(entAssetId, boundEntityAsset ?? undefined, {
            scaleAdjust: 1,
            offsetY: 0,
            visualStyle: style,
          });
          if (inst) {
            attachInst(inst);
            return;
          }
        }
        const built = buildEntityMesh({ ...selectedEntity, scale: 1, rotation: 0 });
        applyVisualStyleToObject(built, style);
        setPreviewObject(built, null);

        void loadCustomAssetToCache(entAssetId, 'character').then((loaded) => {
          if (cancelled || !loaded || !stageRef.current) return;
          const inst = instantiateCustomModel(entAssetId, boundEntityAsset ?? undefined, {
            scaleAdjust: 1,
            offsetY: 0,
            visualStyle: style,
          });
          if (inst) {
            attachInst(inst);
            const box = new THREE.Box3().setFromObject(stageRef.current.charHolder);
            if (!box.isEmpty()) {
              setMeasuredCharHeight(Number(Math.max(0.15, box.max.y - box.min.y).toFixed(2)));
            }
          }
        });
      } else {
        const built = buildEntityMesh({ ...selectedEntity, scale: 1, rotation: 0 });
        applyVisualStyleToObject(built, style);
        const qRig = built.userData.quadrupedRig as QuadrupedMonsterRig | undefined;
        let monElapsed = 0;
        setPreviewObject(
          built,
          qRig
            ? (dt) => {
                monElapsed += dt;
                animateQuadrupedMonster(
                  qRig,
                  dt,
                  monElapsed,
                  monElapsed * 4.4,
                  qRig.canFly ? 0.5 : 0.45,
                  qRig.canFly ? 'fly' : 'walk'
                );
              }
            : null
        );
      }
    }

    return () => {
      cancelled = true;
    };
  }, [
    effectiveTarget,
    level.visualStyle,
    project.heroBody,
    project.heroColors,
    project.heroCustomAssetId,
    boundHeroAsset,
    selectedEntity?.id,
    selectedEntity?.kind,
    selectedEntity?.customAssetId,
    selectedEntity?.creatureType,
    selectedEntity?.buildingBlock,
    selectedEntity?.mechTemplate,
    selectedEntity?.canopyTree,
    selectedEntity?.monsterConfig,
    selectedEntity?.vertexPaintStrokes,
    boundEntityAsset,
  ]);

  // Fast 60 FPS non-destructive World Scale & Ground Height update without rebuilding geometry
  useEffect(() => {
    const st = stageRef.current;
    if (!st) return;

    let appliedScale = 1;
    let appliedY = 0;

    if (effectiveTarget === 'hero') {
      appliedScale = Math.max(0.25, Math.min(3.5, project.heroModelScale ?? 1));
      appliedY = project.heroModelOffsetY ?? 0;
    } else if (selectedEntity) {
      if (selectedEntity.customAssetId) {
        appliedScale = Math.max(
          0.25,
          Math.min(4.0, (selectedEntity.modelScaleAdjust ?? 1) * (selectedEntity.scale ?? 1))
        );
        appliedY = selectedEntity.modelOffsetY ?? 0;
      } else {
        appliedScale = Math.max(0.25, Math.min(3.5, selectedEntity.scale ?? 1));
        appliedY = 0;
      }
    }

    st.charHolder.scale.setScalar(appliedScale);
    st.charHolder.position.y = appliedY;
    st.charHolder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(st.charHolder);
    if (!box.isEmpty()) {
      setMeasuredCharHeight(Number(Math.max(0.15, box.max.y - box.min.y).toFixed(2)));
    }
  }, [
    effectiveTarget,
    project.heroModelScale,
    project.heroModelOffsetY,
    selectedEntity?.id,
    selectedEntity?.customAssetId,
    selectedEntity?.scale,
    selectedEntity?.modelScaleAdjust,
    selectedEntity?.modelOffsetY,
  ]);

  // Camera framing presets
  useEffect(() => {
    const st = stageRef.current;
    if (!st) return;

    if (camPreset === 'closeup') {
      st.camera.position.set(-0.65, 1.35, 3.15);
      st.controls.target.set(-0.75, 0.95, 0.25);
    } else if (camPreset === 'tree') {
      st.camera.position.set(0.95, 3.4, 9.8);
      st.controls.target.set(0.65, 2.35, 0);
    } else {
      st.camera.position.set(0.45, 2.4, 8.2);
      st.controls.target.set(0.45, 1.55, 0);
    }
    st.controls.update();
  }, [camPreset, camNonce]);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-200/80 dark:border-white/[0.1] bg-[#141A29] shadow-sm">
      <div
        ref={containerRef}
        className="w-full h-[290px] sm:h-[330px] cursor-grab active:cursor-grabbing"
      />

      {/* Top Overlay: Target Switcher + Live Height Readout */}
      <div className="absolute top-3 left-3 right-3 pointer-events-none flex flex-wrap items-center justify-between gap-2">
        <div className="pointer-events-auto flex items-center gap-1 p-1 rounded-xl bg-slate-900/90 border border-white/15 shadow-md">
          <button
            type="button"
            onClick={() => onSelectTarget?.('hero')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold inline-flex items-center gap-1 transition-colors ${
              effectiveTarget === 'hero'
                ? 'bg-[#7C5CFF] text-white'
                : 'text-slate-300 hover:bg-white/10'
            }`}
          >
            <User size={11} />
            <span>Hero</span>
          </button>
          {selectedEntity && (
            <button
              type="button"
              onClick={() => onSelectTarget?.('entity')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold inline-flex items-center gap-1 transition-colors max-w-[160px] truncate ${
                effectiveTarget === 'entity'
                  ? 'bg-[#7C5CFF] text-white'
                  : 'text-slate-300 hover:bg-white/10'
              }`}
            >
              <span className="truncate">{selectedEntity.name}</span>
            </button>
          )}
        </div>

        <div className="px-2.5 py-1 rounded-xl bg-slate-900/90 border border-white/15 text-[11px] font-bold text-slate-200 flex items-center gap-2.5 tabular-nums shadow-md">
          <span>
            {activeName}: <strong className="text-white">{measuredCharHeight.toFixed(2)}m</strong> ({currentScale.toFixed(2)}×)
          </span>
          <span className="text-slate-500">|</span>
          <span className="inline-flex items-center gap-1 text-emerald-300">
            <Trees size={12} />
            Conifer: {measuredTreeHeight.toFixed(2)}m
          </span>
        </div>
      </div>

      {/* Bottom Overlay: Orbit Hint + Camera Framing */}
      <div className="absolute bottom-2.5 left-3 right-3 pointer-events-none flex flex-wrap items-center justify-between gap-2">
        <div className="px-2.5 py-1 rounded-lg bg-slate-900/85 border border-white/10 text-[10px] font-semibold text-slate-300">
          Drag to rotate 360° · Scroll to zoom · Next to world Conifer tree
        </div>

        <div className="pointer-events-auto flex items-center gap-1 p-1 rounded-xl bg-slate-900/90 border border-white/15 shadow-md">
          {(
            [
              { id: 'compare', label: 'Scale Pair' },
              { id: 'closeup', label: 'Close-Up' },
              { id: 'tree', label: 'Full Tree' },
            ] as const
          ).map((cam) => (
            <button
              key={cam.id}
              type="button"
              onClick={() => {
                setCamPreset(cam.id);
                setCamNonce((n) => n + 1);
              }}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-colors ${
                camPreset === cam.id ? 'bg-white text-slate-900' : 'text-slate-300 hover:bg-white/10'
              }`}
            >
              {cam.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setCamPreset('compare');
              setCamNonce((n) => n + 1);
            }}
            title="Reset camera"
            className="p-1 rounded-lg text-slate-300 hover:bg-white/10"
          >
            <RotateCcw size={11} />
          </button>
        </div>
      </div>
    </div>
  );
};
