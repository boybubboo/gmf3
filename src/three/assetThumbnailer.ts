import * as THREE from 'three';
import { EntityKindMeta } from '../data/registries';
import type {
  AssetCategory,
  EntityKind,
  LevelEntity,
  MonsterBlueprint,
  PlatformPreset,
} from '../types/maker';
import { regenerateCustomAssetThumbnail, renderObject3DThumbnail } from './gltfAssetManager';
import { disposeObject3D } from './islandScene';
import { buildEntityMesh, buildHeroModel } from './proceduralModels';

const thumbCache = new Map<string, string>();
const inflightCustom = new Map<string, Promise<string | undefined>>();
const pendingQueue: { key: string; render: () => Promise<string | undefined> }[] = [];
const queuedKeys = new Set<string>();
const listeners = new Set<() => void>();
let rafScheduled = false;
let isFlushing = false;

function notifyThumbListeners() {
  listeners.forEach((fn) => fn());
}

export function subscribeAssetThumbnails(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function scheduleNextThumbFlush(delayMs = 20) {
  if (rafScheduled || typeof window === 'undefined') return;
  rafScheduled = true;
  window.setTimeout(() => {
    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    };
    if (typeof win.requestIdleCallback === 'function') {
      win.requestIdleCallback(() => {
        void flushThumbnailQueue();
      }, { timeout: 120 });
    } else if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        void flushThumbnailQueue();
      });
    } else {
      void flushThumbnailQueue();
    }
  }, delayMs);
}

async function flushThumbnailQueue() {
  rafScheduled = false;
  if (isFlushing) return;
  isFlushing = true;
  try {
    let didRender = false;
    while (pendingQueue.length > 0) {
      const job = pendingQueue.shift();
      if (!job) break;
      queuedKeys.delete(job.key);
      if (thumbCache.has(job.key)) continue;
      const url = await job.render();
      if (url) {
        thumbCache.set(job.key, url);
        didRender = true;
      }
      break; // max 1 offscreen render per scheduled turn to avoid UI frame blocks
    }
    if (didRender) {
      notifyThumbListeners();
    }
  } finally {
    isFlushing = false;
    if (pendingQueue.length > 0) {
      scheduleNextThumbFlush(20);
    }
  }
}

function enqueueRender(key: string, render: () => Promise<string | undefined>) {
  if (thumbCache.has(key) || queuedKeys.has(key)) return;
  queuedKeys.add(key);
  pendingQueue.push({ key, render });
  if (!rafScheduled && !isFlushing) {
    // Allow initial viewport mount / WebGPU init to settle before spinning up offscreen WebGL2 PMREM
    scheduleNextThumbFlush(thumbCache.size === 0 ? 180 : 20);
  }
}

function makeSampleEntity(
  kind: EntityKind,
  opts?: { isBoss?: boolean; platformPreset?: PlatformPreset; name?: string; monsterConfig?: MonsterBlueprint }
): LevelEntity {
  const meta = EntityKindMeta[kind];
  return {
    id: `thumb-${kind}`,
    name: opts?.name || opts?.monsterConfig?.name || meta.title,
    kind,
    position: { x: 0.5, y: 0.5 },
    rotation: 0,
    scale: 1,
    isBoss: opts?.isBoss ?? false,
    brain: 'Idle',
    health: 3,
    speed: 2,
    damage: 1,
    loot: '',
    puzzleType: 'Button',
    dialogue: '',
    platformPreset: opts?.platformPreset ?? 'stoneLift',
    platformMotion: 'slide',
    platformSpeed: 1,
    platformWait: 0.5,
    platformRunning: true,
    conversation: [],
    notes: '',
    cards: [],
    monsterConfig: opts?.monsterConfig,
  };
}

function buildFxOrbPreview(): THREE.Group {
  const g = new THREE.Group();
  const coreMat = new THREE.MeshStandardMaterial({
    color: '#A855F7',
    emissive: '#7C5CFF',
    emissiveIntensity: 0.9,
    roughness: 0.2,
    metalness: 0.1,
  });
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 1), coreMat);
  core.position.y = 0.72;
  g.add(core);

  const ringMat = new THREE.MeshStandardMaterial({
    color: '#F59E0B',
    emissive: '#F59E0B',
    emissiveIntensity: 0.75,
    roughness: 0.25,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.055, 10, 28), ringMat);
  ring.position.y = 0.72;
  ring.rotation.x = Math.PI * 0.36;
  ring.rotation.y = 0.4;
  g.add(ring);

  const sparkMat = new THREE.MeshStandardMaterial({
    color: '#38BDF8',
    emissive: '#38BDF8',
    emissiveIntensity: 0.95,
    roughness: 0.2,
  });
  const offsets: [number, number, number][] = [
    [0.52, 1.18, 0.22],
    [-0.48, 1.05, 0.3],
    [0.2, 1.35, -0.35],
    [-0.36, 0.34, -0.25],
    [0.44, 0.42, 0.34],
  ];
  for (const [x, y, z] of offsets) {
    const spark = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), sparkMat);
    spark.position.set(x, y, z);
    g.add(spark);
  }
  return g;
}

export function getEntityThumbnailKey(
  kind: EntityKind,
  opts?: { isBoss?: boolean; platformPreset?: PlatformPreset; name?: string; monsterConfig?: MonsterBlueprint }
): string {
  if (opts?.monsterConfig) {
    const m = opts.monsterConfig;
    return `mon:${m.id}:${m.legPairs}:${m.headCount}:${m.headStyle}:${m.hornStyle}:${m.wingStyle}:${m.tailStyle}:${m.materialFinish ?? 'clay'}:${m.ears?.style ?? 'auto'}:${m.ears?.thickness ?? 1}:${m.ears?.softness ?? 0.2}:${m.eyes?.pupilStyle ?? 'auto'}:${m.nose?.style ?? 'auto'}:${m.nose?.depth3D ?? 0.5}:${m.nose?.color ?? 'auto'}:${m.mouth?.mood ?? 'auto'}:${m.mouth?.tongueStickOut ?? 0}:${m.teeth?.style ?? 'auto'}:${m.teeth?.sharpness ?? 0.5}:${m.eyebrows?.mood ?? 'auto'}:${m.wings?.membraneOpacity ?? 0.76}:${m.surfaceCoat?.mode ?? 'none'}:${m.spikes?.enabled ?? m.spineSpikes}:${m.spikes?.style ?? 'auto'}:${m.spikes?.sinkDepth ?? 0.016}:${m.spikes?.softness ?? 0.2}:${m.bodyLength}:${m.bodyWidth}:${m.legHeight}:${m.scale}:${m.primaryAttack ?? 'clawSlash'}:${m.bodyColor}:${m.bellyColor}:${m.accentColor}:${m.wingColor}`;
  }
  const lower = (opts?.name ?? '').toLowerCase();
  const semanticHint =
    kind === 'scenery' ||
    kind === 'prop' ||
    kind === 'baddie' ||
    kind === 'pickup' ||
    kind === 'npc' ||
    kind === 'sign' ||
    kind === 'light' ||
    kind === 'checkpoint'
      ? lower.includes('skunk')
        ? 'skunk'
        : lower.includes('porcupine')
        ? 'porcupine'
        : lower.includes('mole')
        ? 'molerat'
        : lower.includes('vulture')
        ? 'vulture'
        : lower.includes('tavern') || lower.includes('inn')
        ? 'tavern'
        : lower.includes('cottage') || lower.includes('burrow')
        ? 'cottage'
        : lower.includes('dock') || lower.includes('pier')
        ? 'dock'
        : lower.includes('ramp')
        ? 'ramp'
        : lower.includes('arch')
        ? 'arch'
        : lower.includes('crafting') || lower.includes('workbench') || lower.includes('anvil') || lower.includes('bench')
        ? 'craftingBench'
        : lower.includes('campfire')
        ? 'campfire'
        : lower.includes('tree') || lower.includes('pine') || lower.includes('oak')
        ? 'tree'
        : lower.includes('rock') || lower.includes('boulder')
        ? 'rock'
        : lower.includes('crate') || lower.includes('barrel')
        ? 'crate'
        : lower.includes('torch') || lower.includes('lamp') || lower.includes('lantern')
        ? 'lamp'
        : lower.includes('heart')
        ? 'heart'
        : lower.includes('coin') || lower.includes('gem')
        ? 'gem'
        : lower.includes('slime')
        ? 'slime'
        : 'default'
      : 'default';
  return `ent:${kind}:${opts?.isBoss ? 'boss' : 'std'}:${opts?.platformPreset ?? 'none'}:${semanticHint}`;
}

export function getOrQueueEntityThumbnail(
  kind: EntityKind,
  opts?: { isBoss?: boolean; platformPreset?: PlatformPreset; name?: string; monsterConfig?: MonsterBlueprint }
): string | undefined {
  const key = getEntityThumbnailKey(kind, opts);
  const hit = thumbCache.get(key);
  if (hit) return hit;

  enqueueRender(key, async () => {
    let mesh: THREE.Group | null = null;
    try {
      mesh =
        kind === 'fxEmitter'
          ? buildFxOrbPreview()
          : buildEntityMesh(makeSampleEntity(kind, opts));
      const zoom = kind === 'platform' || kind === 'door' || kind === 'portal' ? 1.06 : 0.96;
      return await renderObject3DThumbnail(mesh, {
        azimuthRad: 0.52,
        elevationFactor: kind === 'platform' ? 0.65 : 0.42,
        zoom,
      });
    } finally {
      if (mesh) disposeObject3D(mesh);
    }
  });
  return undefined;
}

export function getHeroThumbnailKey(
  heroBody: string,
  colors: { tunic: string; cloak: string; hair: string; skin: string }
): string {
  return `hero:${heroBody}:${colors.tunic}:${colors.cloak}:${colors.hair}:${colors.skin}`;
}

export function getOrQueueHeroThumbnail(
  heroBody: string,
  colors: { tunic: string; cloak: string; hair: string; skin: string }
): string | undefined {
  const key = getHeroThumbnailKey(heroBody, colors);
  const hit = thumbCache.get(key);
  if (hit) return hit;

  enqueueRender(key, async () => {
    let rigGroup: THREE.Group | null = null;
    try {
      const rig = buildHeroModel(heroBody, colors);
      rigGroup = rig.group;
      return await renderObject3DThumbnail(rigGroup, {
        azimuthRad: 0.42,
        elevationFactor: 0.34,
        zoom: 0.92,
      });
    } finally {
      if (rigGroup) disposeObject3D(rigGroup);
    }
  });
  return undefined;
}

export function getOrLoadCustomAssetThumbnail(
  assetId: string,
  category: AssetCategory,
  existingDataUrl?: string
): string | undefined {
  if (existingDataUrl) {
    thumbCache.set(`glb:${assetId}`, existingDataUrl);
    return existingDataUrl;
  }
  const key = `glb:${assetId}`;
  const hit = thumbCache.get(key);
  if (hit) return hit;

  if (!inflightCustom.has(key)) {
    const p = regenerateCustomAssetThumbnail(assetId, category)
      .then((url) => {
        if (url) {
          thumbCache.set(key, url);
          notifyThumbListeners();
        }
        return url;
      })
      .finally(() => {
        inflightCustom.delete(key);
      });
    inflightCustom.set(key, p);
  }
  return undefined;
}

export function setCustomAssetThumbnailCache(assetId: string, dataUrl: string) {
  thumbCache.set(`glb:${assetId}`, dataUrl);
  notifyThumbListeners();
}
