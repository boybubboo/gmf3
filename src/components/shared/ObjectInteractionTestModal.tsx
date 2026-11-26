import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { WebGPURenderer } from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Check, Pause, Play, RotateCcw, Sparkles, X } from 'lucide-react';
import {
  OBJECT_ATTRIBUTE_BY_ID,
  OBJECT_INTERACTION_ATTRIBUTES,
  getClipSlotForObjectAttribute,
} from '../../data/motionLibrary';
import {
  instantiateCustomModel,
  loadCustomAssetToCache,
  type CustomModelInstance,
} from '../../three/gltfAssetManager';
import {
  createMakerRenderer,
  detectSoftwareGl,
  disposeObject3D,
  setupSceneEnvironment,
} from '../../three/islandScene';
import { buildObjectMakerSceneGroup } from '../../three/objectMakerBuilder';
import { buildEntityMesh, buildHeroModel, type HeroRig } from '../../three/proceduralModels';
import { isWebGPUFallbackAdapter } from '../../three/webglUtils';
import type {
  CustomClipSlot,
  LevelEntity,
  ObjectInteractionAttributeId,
  ObjectInteractionCalibration,
  ObjectMakerDoc,
} from '../../types/maker';

export interface ObjectInteractionTestModalProps {
  title: string;
  attributes: ObjectInteractionAttributeId[];
  calibrations: Partial<Record<ObjectInteractionAttributeId, ObjectInteractionCalibration>>;
  initialAttribute?: ObjectInteractionAttributeId;
  objectDoc?: ObjectMakerDoc;
  customAssetId?: string;
  entity?: LevelEntity;
  customHeroAssetId?: string;
  onSaveCalibration: (
    attr: ObjectInteractionAttributeId,
    calibration: ObjectInteractionCalibration
  ) => void;
  onClose: () => void;
}

export function getDefaultCalibrationForAttribute(
  attr: ObjectInteractionAttributeId
): ObjectInteractionCalibration {
  switch (attr) {
    case 'sit':
      return { offset: [0, 0.44, 0.24], yawDeg: 0 };
    case 'sleep':
      return { offset: [0, 0.42, 0], yawDeg: 90 };
    case 'climbVertical':
      return { offset: [0, 0.35, 0.62], yawDeg: 180 };
    case 'climbStairs':
      return { offset: [0, 0.24, 0.15], yawDeg: 0 };
    case 'crouch':
    case 'sneak':
      return { offset: [0, 0, 0.85], yawDeg: 180 };
    default:
      return { offset: [0, 0, 0.72], yawDeg: 180 };
  }
}

function animateProceduralHeroRig(rig: HeroRig, slot: CustomClipSlot, t: number) {
  rig.bodyPivot.position.set(0, 0.85, 0);
  rig.bodyPivot.rotation.set(0, 0, 0);
  rig.head.rotation.set(0, 0, 0);
  rig.armL.rotation.set(0, 0, 0);
  rig.armR.rotation.set(0, 0, 0);
  if (rig.forearmL) rig.forearmL.rotation.set(0, 0, 0);
  if (rig.forearmR) rig.forearmR.rotation.set(0, 0, 0);
  rig.legL.rotation.set(0, 0, 0);
  rig.legR.rotation.set(0, 0, 0);
  if (rig.axe) rig.axe.visible = slot === 'swing' || slot === 'dig';
  if (rig.sword) rig.sword.visible = slot === 'stab' || slot === 'attack';
  if (rig.fishingPole) rig.fishingPole.visible = slot === 'fishing';

  const wave = Math.sin(t * 4.2);
  const fast = Math.sin(t * 7.5);
  switch (slot) {
    case 'sit':
      rig.bodyPivot.position.y = 0.85 - 0.43;
      rig.bodyPivot.rotation.x = -0.05;
      rig.legL.rotation.x = -1.26;
      rig.legR.rotation.x = -1.26;
      rig.armL.rotation.x = -0.25 + wave * 0.03;
      rig.armR.rotation.x = -0.25 - wave * 0.03;
      if (rig.forearmL) rig.forearmL.rotation.x = -0.35;
      if (rig.forearmR) rig.forearmR.rotation.x = -0.35;
      break;
    case 'sleep':
      rig.bodyPivot.position.set(0, 0.85 + 0.28, -0.35);
      rig.bodyPivot.rotation.x = -Math.PI * 0.48;
      rig.armL.rotation.x = -0.15;
      rig.armR.rotation.x = -0.15;
      rig.head.rotation.x = 0.1 + wave * 0.03;
      break;
    case 'climbVertical':
      rig.bodyPivot.rotation.x = -0.1;
      rig.armL.rotation.x = -2.1 + fast * 0.48;
      rig.armR.rotation.x = -2.1 - fast * 0.48;
      rig.legL.rotation.x = -0.55 - fast * 0.42;
      rig.legR.rotation.x = -0.55 + fast * 0.42;
      break;
    case 'climbStairs':
      rig.bodyPivot.position.y = 0.85 + Math.abs(fast) * 0.08;
      rig.bodyPivot.rotation.x = 0.14;
      rig.legL.rotation.x = -0.3 + fast * 0.62;
      rig.legR.rotation.x = -0.3 - fast * 0.62;
      rig.armL.rotation.x = -fast * 0.5;
      rig.armR.rotation.x = fast * 0.5;
      break;
    case 'crouch':
    case 'sneak': {
      const s = slot === 'sneak' ? Math.sin(t * 5.0) : 0;
      rig.bodyPivot.position.y = 0.85 - 0.24 + Math.abs(s) * 0.03;
      rig.bodyPivot.rotation.x = slot === 'sneak' ? 0.34 : 0.24;
      rig.legL.rotation.x = -0.62 + s * 0.38;
      rig.legR.rotation.x = -0.62 - s * 0.38;
      rig.armL.rotation.x = -0.35 - s * 0.22;
      rig.armR.rotation.x = -0.35 + s * 0.22;
      break;
    }
    case 'swing': {
      const p = (t * 1.45) % 1;
      const wind = p < 0.38 ? -p / 0.38 : -1 + ((p - 0.38) / 0.62) * 2.1;
      rig.bodyPivot.rotation.y = wind * 0.38;
      rig.armR.rotation.set(-0.9 - wind * 0.65, -wind * 0.45, -0.45 - wind * 0.35);
      if (rig.forearmR) rig.forearmR.rotation.x = -0.65;
      break;
    }
    case 'stab': {
      const thrust = Math.max(0, Math.sin(t * 5.5));
      rig.bodyPivot.rotation.x = 0.18 * thrust;
      rig.armR.rotation.x = -0.85 - thrust * 0.85;
      if (rig.forearmR) rig.forearmR.rotation.x = -0.35 + thrust * 0.3;
      break;
    }
    case 'throw': {
      const p = (t * 1.35) % 1;
      rig.armR.rotation.x = -2.4 + p * 2.2;
      rig.bodyPivot.rotation.x = -0.15 + p * 0.35;
      break;
    }
    case 'fishing':
      rig.armR.rotation.x = -0.85 + Math.sin(t * 1.8) * 0.1;
      if (rig.forearmR) rig.forearmR.rotation.x = -0.35;
      break;
    case 'lift':
      rig.bodyPivot.position.y = 0.85 - 0.12 + Math.abs(wave) * 0.08;
      rig.armL.rotation.x = -1.6 - wave * 0.25;
      rig.armR.rotation.x = -1.6 - wave * 0.25;
      break;
    case 'pull':
      rig.bodyPivot.rotation.x = -0.25 - wave * 0.08;
      rig.armL.rotation.x = -1.1 + wave * 0.24;
      rig.armR.rotation.x = -1.1 + wave * 0.24;
      break;
    case 'push':
      rig.bodyPivot.rotation.x = 0.28;
      rig.armL.rotation.x = -1.45 - fast * 0.14;
      rig.armR.rotation.x = -1.45 + fast * 0.14;
      rig.legL.rotation.x = fast * 0.35;
      rig.legR.rotation.x = -fast * 0.35;
      break;
    case 'dig':
      rig.bodyPivot.rotation.x = 0.24 + Math.max(0, wave) * 0.22;
      rig.armL.rotation.x = -1.15 - wave * 0.35;
      rig.armR.rotation.x = -1.25 - wave * 0.45;
      break;
    case 'bowPull': {
      const draw = 0.5 + 0.5 * Math.sin(t * 2.6);
      rig.bodyPivot.rotation.y = 0.32;
      rig.armL.rotation.set(-1.35, 0.15, 0.2);
      rig.armR.rotation.set(-1.3, -0.35 * draw, -0.3);
      if (rig.forearmR) rig.forearmR.rotation.x = -0.4 - draw * 0.7;
      break;
    }
    case 'jump': {
      const j = Math.abs(Math.sin(t * 2.8));
      rig.bodyPivot.position.y = 0.85 + j * 0.48;
      rig.armL.rotation.x = -1.9 * j;
      rig.armR.rotation.x = -1.9 * j;
      rig.legL.rotation.x = -0.35 * j;
      rig.legR.rotation.x = 0.35 * j;
      break;
    }
    case 'hold':
    default:
      rig.armR.rotation.x = -0.82 + wave * 0.04;
      if (rig.forearmR) rig.forearmR.rotation.x = -0.45;
      break;
  }
}

export const ObjectInteractionTestModal: React.FC<ObjectInteractionTestModalProps> = ({
  title,
  attributes,
  calibrations,
  initialAttribute,
  objectDoc,
  customAssetId,
  entity,
  customHeroAssetId,
  onSaveCalibration,
  onClose,
}) => {
  const defaultAttr =
    initialAttribute ??
    attributes[0] ??
    OBJECT_INTERACTION_ATTRIBUTES[0].id;

  const [selectedAttr, setSelectedAttr] =
    useState<ObjectInteractionAttributeId>(defaultAttr);
  const [playing, setPlaying] = useState(true);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  const initialCal = useMemo(
    () =>
      calibrations[defaultAttr] ?? getDefaultCalibrationForAttribute(defaultAttr),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const [offsetX, setOffsetX] = useState(initialCal.offset[0]);
  const [offsetY, setOffsetY] = useState(initialCal.offset[1]);
  const [offsetZ, setOffsetZ] = useState(initialCal.offset[2]);
  const [yawDeg, setYawDeg] = useState(initialCal.yawDeg);

  const handleSelectAttr = (attr: ObjectInteractionAttributeId) => {
    setSelectedAttr(attr);
    const next = calibrations[attr] ?? getDefaultCalibrationForAttribute(attr);
    setOffsetX(next.offset[0]);
    setOffsetY(next.offset[1]);
    setOffsetZ(next.offset[2]);
    setYawDeg(next.yawDeg);
  };

  const mountRef = useRef<HTMLDivElement | null>(null);
  const liveRef = useRef({
    selectedAttr,
    playing,
    offsetX,
    offsetY,
    offsetZ,
    yawDeg,
  });
  liveRef.current = {
    selectedAttr,
    playing,
    offsetX,
    offsetY,
    offsetZ,
    yawDeg,
  };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let rafId = 0;

    const isSoftwareGl = detectSoftwareGl();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0E131D');

    const w = Math.max(320, mount.clientWidth || 540);
    const h = Math.max(260, mount.clientHeight || 420);
    const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
    camera.position.set(2.4, 1.85, 2.8);

    let renderer: WebGPURenderer = createMakerRenderer(isSoftwareGl);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSoftwareGl ? 1 : 2));
    renderer.setSize(w, h);
    mount.innerHTML = '';
    mount.appendChild(renderer.domElement);

    const createOrbit = (el: HTMLElement) => {
      const c = new OrbitControls(camera, el);
      c.enableDamping = !isSoftwareGl;
      c.target.set(0, 0.72, 0);
      c.update();
      return c;
    };
    let controls = createOrbit(renderer.domElement);
    let envTex: THREE.Texture | null = null;

    const hemi = new THREE.HemisphereLight('#DCEBFF', '#31422C', 1.25);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight('#FFF5DF', 2.0);
    dir.position.set(3.5, 6.2, 4.0);
    dir.castShadow = !isSoftwareGl;
    scene.add(dir);

    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(2.8, 2.8, 0.08, 32),
      new THREE.MeshStandardMaterial({ color: '#1F2937', roughness: 0.92 })
    );
    floor.position.y = -0.04;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(5.2, 12, '#475569', '#293548');
    grid.position.y = 0.002;
    scene.add(grid);

    const objectHolder = new THREE.Group();
    const characterHolder = new THREE.Group();
    scene.add(objectHolder, characterHolder);

    let heroCustom: CustomModelInstance | null = null;
    let fallbackRig: HeroRig | null = null;

    const initModels = async () => {
      // Load object
      if (objectDoc && objectDoc.parts.length > 0) {
        const built = buildObjectMakerSceneGroup(objectDoc, false);
        const box = new THREE.Box3().setFromObject(built.root);
        if (!box.isEmpty()) {
          const center = new THREE.Vector3();
          box.getCenter(center);
          built.root.position.set(-center.x, -box.min.y, -center.z);
        }
        objectHolder.add(built.root);
      } else if (customAssetId) {
        await loadCustomAssetToCache(customAssetId, entity?.kind === 'npc' ? 'character' : 'prop');
        if (disposed) return;
        const inst = instantiateCustomModel(customAssetId, undefined);
        if (inst) {
          objectHolder.add(inst.group);
        }
      } else if (entity) {
        objectHolder.add(buildEntityMesh(entity));
      }

      if (disposed) return;

      // Load test hero character
      if (customHeroAssetId) {
        await loadCustomAssetToCache(customHeroAssetId, 'character');
        if (!disposed) {
          heroCustom = instantiateCustomModel(customHeroAssetId, undefined);
          if (heroCustom) {
            characterHolder.add(heroCustom.group);
          }
        }
      }
      if (!heroCustom && !disposed) {
        fallbackRig = buildHeroModel('Human', {
          tunic: '#2B87F5',
          cloak: '#F5B82E',
          hair: '#5A3825',
          skin: '#F2C9A0',
        });
        characterHolder.add(fallbackRig.group);
      }
    };

    const ro = new ResizeObserver(() => {
      if (disposed) return;
      const cw = Math.max(240, mount.clientWidth);
      const ch = Math.max(200, mount.clientHeight);
      camera.aspect = cw / ch;
      camera.updateProjectionMatrix();
      renderer.setSize(cw, ch);
    });
    ro.observe(mount);

    let lastNow = performance.now();
    let elapsed = 0;

    const renderLoop = (now: number) => {
      if (disposed) return;
      rafId = requestAnimationFrame(renderLoop);
      const dt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000));
      lastNow = now;
      const cur = liveRef.current;
      if (cur.playing) elapsed += dt;

      characterHolder.position.set(cur.offsetX, cur.offsetY, cur.offsetZ);
      characterHolder.rotation.y = THREE.MathUtils.degToRad(cur.yawDeg);

      const clipSlot = getClipSlotForObjectAttribute(cur.selectedAttr);
      if (heroCustom) {
        if (heroCustom.currentSlot !== clipSlot) {
          heroCustom.setAction(clipSlot, 0.1);
        }
        heroCustom.update(cur.playing ? dt : 0, 1);
      } else if (fallbackRig) {
        animateProceduralHeroRig(fallbackRig, clipSlot, elapsed);
      }

      controls.update();
      try {
        renderer.render(scene, camera);
      } catch {
        // ignore transient draw error
      }
    };

    void (async () => {
      try {
        await renderer.init();
        if (!isSoftwareGl && isWebGPUFallbackAdapter(renderer)) {
          controls.dispose();
          renderer.dispose();
          renderer = createMakerRenderer(isSoftwareGl, true);
          renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
          renderer.setSize(mount.clientWidth || w, mount.clientHeight || h);
          mount.innerHTML = '';
          mount.appendChild(renderer.domElement);
          controls = createOrbit(renderer.domElement);
          await renderer.init();
        }
      } catch {
        if (disposed) return;
        controls.dispose();
        try {
          renderer.dispose();
        } catch {
          // ignore
        }
        renderer = createMakerRenderer(isSoftwareGl, true);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSoftwareGl ? 1 : 2));
        renderer.setSize(mount.clientWidth || w, mount.clientHeight || h);
        mount.innerHTML = '';
        mount.appendChild(renderer.domElement);
        controls = createOrbit(renderer.domElement);
        await renderer.init().catch(() => {});
      }
      if (disposed) return;
      envTex = setupSceneEnvironment(scene, renderer);
      await initModels();
      if (!disposed) {
        lastNow = performance.now();
        rafId = requestAnimationFrame(renderLoop);
      }
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      ro.disconnect();
      controls.dispose();
      envTex?.dispose();
      disposeObject3D(scene);
      renderer.dispose();
      mount.innerHTML = '';
    };
  }, [objectDoc, customAssetId, entity, customHeroAssetId]);

  const activeMeta = OBJECT_ATTRIBUTE_BY_ID[selectedAttr];

  const handleSaveCurrent = () => {
    const cal: ObjectInteractionCalibration = {
      offset: [
        Number(offsetX.toFixed(2)),
        Number(offsetY.toFixed(2)),
        Number(offsetZ.toFixed(2)),
      ],
      yawDeg: Math.round(yawDeg),
    };
    onSaveCalibration(selectedAttr, cal);
    setSavedToast(`Saved ${activeMeta.label} position`);
    window.setTimeout(() => setSavedToast(null), 1800);
  };

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/70 flex items-center justify-center p-3 sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-5xl h-[86vh] max-h-[760px] rounded-3xl bg-white dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.1] shadow-2xl flex flex-col overflow-hidden">
        <header className="shrink-0 px-5 py-3 border-b border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between gap-3 bg-slate-50 dark:bg-[#131720]">
          <div className="min-w-0">
            <div className="text-sm font-extrabold truncate">
              Test & Calibrate Character Interaction — {title}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-[#949BB0]">
              Preview how the hero aligns to this object during an action and save calibrated offsets into the preset.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-[#1F2430]"
          >
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 min-h-0 flex flex-col md:flex-row">
          <div className="flex-1 min-h-[260px] relative bg-[#0E131D]">
            <div ref={mountRef} className="w-full h-full" />
            <div className="absolute top-3 left-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPlaying((p) => !p)}
                className="px-3 py-1.5 rounded-xl bg-black/70 hover:bg-black/85 text-white text-xs font-extrabold inline-flex items-center gap-1.5 border border-white/15"
              >
                {playing ? <Pause size={13} /> : <Play size={13} />}
                <span>{playing ? 'Pause Motion' : 'Play Motion'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const def = getDefaultCalibrationForAttribute(selectedAttr);
                  setOffsetX(def.offset[0]);
                  setOffsetY(def.offset[1]);
                  setOffsetZ(def.offset[2]);
                  setYawDeg(def.yawDeg);
                }}
                className="px-3 py-1.5 rounded-xl bg-black/70 hover:bg-black/85 text-white text-xs font-bold inline-flex items-center gap-1.5 border border-white/15"
              >
                <RotateCcw size={13} />
                <span>Reset Default</span>
              </button>
            </div>
            {savedToast && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-full bg-emerald-500 text-white text-xs font-extrabold shadow-lg inline-flex items-center gap-1.5">
                <Check size={13} />
                <span>{savedToast}</span>
              </div>
            )}
          </div>

          <aside className="w-full md:w-[320px] shrink-0 border-t md:border-t-0 md:border-l border-slate-200/80 dark:border-white/[0.08] p-4 flex flex-col gap-4 overflow-y-auto maker-scroll">
            <div className="space-y-1.5">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB]">
                Test Animation Action
              </div>
              <select
                value={selectedAttr}
                onChange={(e) =>
                  handleSelectAttr(e.target.value as ObjectInteractionAttributeId)
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#12151E] border border-slate-200/80 dark:border-white/[0.08] text-xs font-bold"
              >
                {OBJECT_INTERACTION_ATTRIBUTES.map((attr) => {
                  const enabled = attributes.includes(attr.id);
                  return (
                    <option key={attr.id} value={attr.id}>
                      {enabled ? `✓ ${attr.label}` : attr.label} ({attr.clipSlot})
                    </option>
                  );
                })}
              </select>
              <p className="text-[11px] text-slate-500 dark:text-[#949BB0]">
                {activeMeta.description}
              </p>
            </div>

            <div className="space-y-3 p-3 rounded-2xl bg-slate-50 dark:bg-[#12151E] border border-slate-200/70 dark:border-white/[0.06]">
              <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8E96AB]">
                <Sparkles size={12} className="text-[#7C5CFF]" />
                <span>Character Alignment</span>
              </div>

              <label className="block space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span>Left / Right (X)</span>
                  <span className="tabular-nums">{offsetX.toFixed(2)}m</span>
                </div>
                <input
                  type="range"
                  min={-2}
                  max={2}
                  step={0.02}
                  value={offsetX}
                  onChange={(e) => setOffsetX(Number(e.target.value))}
                  className="w-full accent-[#7C5CFF]"
                />
              </label>

              <label className="block space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span>Height (Y)</span>
                  <span className="tabular-nums">{offsetY.toFixed(2)}m</span>
                </div>
                <input
                  type="range"
                  min={-0.5}
                  max={2.4}
                  step={0.02}
                  value={offsetY}
                  onChange={(e) => setOffsetY(Number(e.target.value))}
                  className="w-full accent-[#7C5CFF]"
                />
              </label>

              <label className="block space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span>Forward / Back (Z)</span>
                  <span className="tabular-nums">{offsetZ.toFixed(2)}m</span>
                </div>
                <input
                  type="range"
                  min={-2}
                  max={2}
                  step={0.02}
                  value={offsetZ}
                  onChange={(e) => setOffsetZ(Number(e.target.value))}
                  className="w-full accent-[#7C5CFF]"
                />
              </label>

              <label className="block space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span>Character Facing (Yaw)</span>
                  <span className="tabular-nums">{Math.round(yawDeg)}°</span>
                </div>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={5}
                  value={yawDeg}
                  onChange={(e) => setYawDeg(Number(e.target.value))}
                  className="w-full accent-[#7C5CFF]"
                />
              </label>
            </div>

            <div className="mt-auto space-y-2">
              <button
                type="button"
                onClick={handleSaveCurrent}
                className="w-full py-2.5 px-4 rounded-xl bg-[#7C5CFF] hover:bg-[#6A48F5] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 shadow-md"
              >
                <Check size={14} />
                <span>Save Calibration to Preset</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2 px-4 rounded-xl bg-slate-100 dark:bg-[#1F2430] text-xs font-bold"
              >
                Close
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
