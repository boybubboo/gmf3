import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
  Fn,
  If,
  attribute,
  cameraProjectionMatrix,
  clamp,
  cos,
  float,
  length,
  modelViewMatrix,
  positionGeometry,
  sin,
  texture,
  uniform,
  uv,
  varying,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { getFxPresetMeta } from '../data/fxEmitterPresets';
import type { FxEmitterConfig, FxEmitterPresetId } from '../types/maker';
import { getCachedAssetSync, loadCustomAssetToCache } from './gltfAssetManager';

type SpriteKind = 'puff' | 'flame' | 'spark' | 'star' | 'droplet' | 'snowflake';

const spriteTextureCache = new Map<SpriteKind, THREE.CanvasTexture>();

function getSpriteTexture(kind: SpriteKind): THREE.CanvasTexture {
  const existing = spriteTextureCache.get(kind);
  if (existing) return existing;

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const half = size / 2;

  ctx.clearRect(0, 0, size, size);

  if (kind === 'puff') {
    // Soft multi-lobe billowy cloud puff for smoke, dust, and volumetric mist cards
    const lobes: [number, number, number, number][] = [
      [0, 0, half * 0.92, 0.72],
      [-14, -8, half * 0.62, 0.42],
      [15, -6, half * 0.58, 0.38],
      [-8, 13, half * 0.54, 0.36],
      [12, 11, half * 0.52, 0.34],
    ];
    for (const [ox, oy, rad, alpha] of lobes) {
      const grad = ctx.createRadialGradient(half + ox, half + oy, 2, half + ox, half + oy, rad);
      grad.addColorStop(0, `rgba(255,255,255,${alpha})`);
      grad.addColorStop(0.5, `rgba(255,255,255,${alpha * 0.45})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(half + ox, half + oy, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (kind === 'flame') {
    const grad = ctx.createRadialGradient(half, half * 1.05, 4, half, half, half * 0.96);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.32, 'rgba(255,245,220,0.88)');
    grad.addColorStop(0.68, 'rgba(255,180,90,0.34)');
    grad.addColorStop(1, 'rgba(255,120,20,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(half, half, half * 0.96, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'spark') {
    const grad = ctx.createRadialGradient(half, half, 2, half, half, half * 0.95);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(255,255,255,0.92)');
    grad.addColorStop(0.55, 'rgba(255,220,160,0.35)');
    grad.addColorStop(1, 'rgba(255,180,80,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  } else if (kind === 'star') {
    // Glowing core + crisp 4-point magic star glint
    const core = ctx.createRadialGradient(half, half, 2, half, half, half * 0.86);
    core.addColorStop(0, 'rgba(255,255,255,1)');
    core.addColorStop(0.22, 'rgba(255,255,255,0.85)');
    core.addColorStop(0.55, 'rgba(255,255,255,0.22)');
    core.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    ctx.translate(half, half);
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, -half * 0.94);
      ctx.quadraticCurveTo(6, -10, 12, 0);
      ctx.quadraticCurveTo(6, 10, 0, half * 0.94);
      ctx.quadraticCurveTo(-6, 10, -12, 0);
      ctx.quadraticCurveTo(-6, -10, 0, -half * 0.94);
      ctx.fill();
    }
    ctx.restore();
  } else if (kind === 'droplet') {
    const grad = ctx.createRadialGradient(half - 6, half - 8, 4, half, half, half * 0.85);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.45, 'rgba(235,250,255,0.86)');
    grad.addColorStop(0.8, 'rgba(180,230,255,0.28)');
    grad.addColorStop(1, 'rgba(160,220,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(half, half, half * 0.86, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Snowflake crystal
    ctx.save();
    ctx.translate(half, half);
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, half * 0.82);
    glow.addColorStop(0, 'rgba(255,255,255,0.95)');
    glow.addColorStop(0.45, 'rgba(255,255,255,0.35)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, half * 0.82, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      ctx.rotate(Math.PI / 3);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -half * 0.72);
      ctx.moveTo(0, -half * 0.42);
      ctx.lineTo(10, -half * 0.56);
      ctx.moveTo(0, -half * 0.42);
      ctx.lineTo(-10, -half * 0.56);
      ctx.stroke();
    }
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  spriteTextureCache.set(kind, tex);
  return tex;
}

// Reusable procedural sculpted 3D leaf geometry (fallback for Falling Leaves)
let cachedLeafGeo: THREE.BufferGeometry | null = null;
function getFallbackLeafGeometry(): THREE.BufferGeometry {
  if (cachedLeafGeo) return cachedLeafGeo;
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.5);
  shape.quadraticCurveTo(0.36, -0.18, 0.3, 0.14);
  shape.quadraticCurveTo(0.18, 0.38, 0, 0.55);
  shape.quadraticCurveTo(-0.18, 0.38, -0.3, 0.14);
  shape.quadraticCurveTo(-0.36, -0.18, 0, -0.5);
  const geo = new THREE.ShapeGeometry(shape, 5);
  // Subtle natural curl along the blade
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const curl = Math.abs(x) * 0.18 - y * y * 0.12;
    pos.setZ(i, curl);
  }
  geo.computeVertexNormals();
  cachedLeafGeo = geo;
  return geo;
}

// Pre-allocated scratch math helpers (zero per-frame allocations)
const _dummy = new THREE.Object3D();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _wingQuat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _vecA = new THREE.Vector3();
const _vecB = new THREE.Vector3();
const _vecC = new THREE.Vector3();
const _vecRight = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _fwd = new THREE.Vector3(0, 0, 1);
const _colStart = new THREE.Color();
const _colEnd = new THREE.Color();
const _colMix = new THREE.Color();
const _camPosLocal = new THREE.Vector3();
const _invRootMat = new THREE.Matrix4();

function spriteForPreset(preset: FxEmitterPresetId): SpriteKind {
  switch (preset) {
    case 'fire':
      return 'flame';
    case 'sparks':
      return 'spark';
    case 'magic':
    case 'fireflies':
      return 'star';
    case 'waterSplash':
    case 'rain':
      return 'droplet';
    case 'snow':
      return 'snowflake';
    default:
      return 'puff';
  }
}

function isAdditivePreset(preset: FxEmitterPresetId): boolean {
  return preset === 'fire' || preset === 'sparks' || preset === 'magic';
}

interface BillboardMaterialHandle {
  material: MeshBasicNodeMaterial;
  emissiveBoostUniform: { value: number };
}

function createBillboardShaderMaterial(
  sprite: SpriteKind,
  additive: boolean,
  stretchFactor: number,
  emissiveBoost: number
): BillboardMaterialHandle {
  const spriteTex = getSpriteTexture(sprite);
  const uStretch = uniform(stretchFactor);
  const uEmissiveBoost = uniform(1 + Math.max(0, emissiveBoost) * 0.65);

  const vUv = varying(vec2());
  const vColor = varying(vec4());

  const mat = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
    fog: false,
  });

  mat.vertexNode = Fn(() => {
    const aOffset = attribute('aOffset', 'vec3');
    const aScale = attribute('aScale', 'vec2');
    const aColor = attribute('aColor', 'vec4');
    const aRoll = attribute('aRoll', 'float');
    const aVel = attribute('aVel', 'vec3');

    vUv.assign(uv());
    vColor.assign(aColor);

    const clipOut = vec4(2.0, 2.0, 2.0, 1.0).toVar();
    const visibleCond = aColor.a.greaterThan(0.001).and(aScale.x.greaterThan(0.0001));

    If(visibleCond, () => {
      const mvCenter = modelViewMatrix.mul(vec4(aOffset, 1.0)).toVar();
      const localPos = positionGeometry.xy.mul(aScale);

      If(uStretch.greaterThan(0.01), () => {
        const mvVel = modelViewMatrix.mul(vec4(aVel, 0.0)).xyz;
        const speed2d = length(mvVel.xy);
        If(speed2d.greaterThan(0.05), () => {
          const dir = mvVel.xy.div(speed2d);
          const perp = vec2(dir.y.negate(), dir.x);
          const stretchLen = clamp(speed2d.mul(uStretch), 1.0, 6.5);
          const aligned = perp.mul(localPos.x).add(dir.mul(localPos.y.mul(stretchLen)));
          mvCenter.xy.addAssign(aligned);
        }).Else(() => {
          mvCenter.xy.addAssign(localPos);
        });
      }).Else(() => {
        const c = cos(aRoll);
        const s = sin(aRoll);
        mvCenter.xy.addAssign(
          vec2(localPos.x.mul(c).sub(localPos.y.mul(s)), localPos.x.mul(s).add(localPos.y.mul(c)))
        );
      });

      clipOut.assign(cameraProjectionMatrix.mul(mvCenter));
    });

    return clipOut;
  })();

  mat.colorNode = Fn(() => {
    const tex = texture(spriteTex, vUv);
    const alpha = tex.a.mul(vColor.a);
    alpha.lessThan(0.008).discard();
    const col = tex.rgb.mul(vColor.rgb).mul(uEmissiveBoost);
    return vec4(col, alpha);
  })();

  return { material: mat, emissiveBoostUniform: uEmissiveBoost };
}

function buildEditorBeacon(accentHex: string): THREE.Group {
  const marker = new THREE.Group();
  marker.name = 'FxEmitterBeacon';
  const color = new THREE.Color(accentHex);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.032, 10, 28),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.78,
    })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.06;

  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.24, 0),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.9,
      roughness: 0.25,
      metalness: 0.35,
      transparent: true,
      opacity: 0.88,
    })
  );
  core.position.y = 0.42;
  core.userData.floatSpin = true;

  // Hit cylinder so clicking anywhere on the beacon is easy in the 3D editor
  const hitProxy = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 1.0, 10),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitProxy.position.y = 0.5;

  marker.add(ring, core, hitProxy);
  return marker;
}

interface ClassicParticle {
  alive: boolean;
  age: number;
  life: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  roll: number;
  rollSpeed: number;
  seed: number;
  sizeMul: number;
}

interface LeafParticle {
  alive: boolean;
  age: number;
  life: number;
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  vrx: number;
  vry: number;
  vrz: number;
  scale: number;
  seed: number;
  colorMix: number;
}

interface CritterAgent {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  tx: number;
  ty: number;
  tz: number;
  phase: number;
  sizeMul: number;
  colorMix: number;
  glowPhase: number;
  // Bird & wing dynamics
  wingPhase: number;
  bankAngle: number;
  glideTimer: number;
  isGliding: boolean;
  birdState: 'flying' | 'descending' | 'landed' | 'takeoff';
  stateTimer: number;
  landCooldown: number;
  landX: number;
  landZ: number;
  orbitAngle: number;
  orbitAlt: number;
  headingYaw: number;
}

function getCategoryForPreset(
  preset: FxEmitterPresetId
): 'billboard' | 'customMesh' | 'lightning' | 'critter' {
  if (preset === 'fallingLeaves') return 'customMesh';
  if (preset === 'lightning') return 'lightning';
  if (
    preset === 'bees' ||
    preset === 'flies' ||
    preset === 'butterflies' ||
    preset === 'moths' ||
    preset === 'fireflies' ||
    preset === 'birds'
  ) {
    return 'critter';
  }
  return 'billboard';
}

function mirrorGeometryX(src: THREE.BufferGeometry): THREE.BufferGeometry {
  const geo = src.clone();
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, -pos.getX(i));
  }
  const idx = geo.getIndex();
  if (idx) {
    const arr = idx.array;
    for (let i = 0; i < arr.length; i += 3) {
      const tmp = arr[i + 1];
      (arr as Uint16Array | Uint32Array)[i + 1] = arr[i + 2];
      (arr as Uint16Array | Uint32Array)[i + 2] = tmp;
    }
    idx.needsUpdate = true;
  } else {
    for (let i = 0; i < pos.count; i += 3) {
      const x1 = pos.getX(i + 1);
      const y1 = pos.getY(i + 1);
      const z1 = pos.getZ(i + 1);
      pos.setXYZ(i + 1, pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));
      pos.setXYZ(i + 2, x1, y1, z1);
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function buildSculptedBirdBodyGeometry(): THREE.BufferGeometry {
  // Streamlined bird body facing +Z (beak at +Z, fanned tail at -Z)
  const positions: number[] = [];
  const pushTri = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number]
  ) => {
    positions.push(...a, ...b, ...c);
  };

  // Cross-sections along Z: beak tip -> head -> chest -> belly -> tail base -> fanned tail
  const nose: [number, number, number] = [0, 0.08, 0.72];
  const headRing: [number, number, number][] = [
    [0, 0.2, 0.44],
    [0.12, 0.09, 0.42],
    [0, -0.02, 0.44],
    [-0.12, 0.09, 0.42],
  ];
  const chestRing: [number, number, number][] = [
    [0, 0.19, 0.12],
    [0.2, 0.03, 0.1],
    [0, -0.15, 0.12],
    [-0.2, 0.03, 0.1],
  ];
  const hipRing: [number, number, number][] = [
    [0, 0.11, -0.34],
    [0.12, 0.0, -0.34],
    [0, -0.08, -0.34],
    [-0.12, 0.0, -0.34],
  ];
  const tailTipL: [number, number, number] = [-0.24, 0.07, -0.78];
  const tailTipC: [number, number, number] = [0, 0.05, -0.7];
  const tailTipR: [number, number, number] = [0.24, 0.07, -0.78];

  const stitchRing = (
    r1: [number, number, number][],
    r2: [number, number, number][]
  ) => {
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      pushTri(r1[i], r2[i], r2[j]);
      pushTri(r1[i], r2[j], r1[j]);
    }
  };

  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    pushTri(nose, headRing[i], headRing[j]);
  }
  stitchRing(headRing, chestRing);
  stitchRing(chestRing, hipRing);

  // Fanned tail feathers (double-sided)
  pushTri(hipRing[0], tailTipR, tailTipC);
  pushTri(hipRing[0], tailTipC, tailTipL);
  pushTri(hipRing[2], tailTipC, tailTipR);
  pushTri(hipRing[2], tailTipL, tailTipC);
  pushTri(hipRing[1], tailTipR, hipRing[0]);
  pushTri(hipRing[3], hipRing[0], tailTipL);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

export class FxEmitterRuntime {
  public readonly group: THREE.Group;
  private readonly fxRoot: THREE.Group;
  private readonly beacon: THREE.Group | null;
  private config: FxEmitterConfig;
  private readonly isEditor: boolean;
  private elapsed = 0;
  private spawnAccum = 0;
  private burstTimer = 0;
  private paused = false;

  // Pool A: Instanced billboard shader particles (Classic, Splash, Rain, Snow, Fog)
  private billboardMesh: THREE.Mesh | null = null;
  private billboardMat: MeshBasicNodeMaterial | null = null;
  private billboardEmissiveUniform: { value: number } | null = null;
  private aOffset: THREE.InstancedBufferAttribute | null = null;
  private aScale: THREE.InstancedBufferAttribute | null = null;
  private aColor: THREE.InstancedBufferAttribute | null = null;
  private aRoll: THREE.InstancedBufferAttribute | null = null;
  private aVel: THREE.InstancedBufferAttribute | null = null;
  private particles: ClassicParticle[] = [];

  // Pool B: Instanced 3D Custom-Object particles (Falling Leaves)
  private leafMesh: THREE.InstancedMesh | null = null;
  private leafCustomMatCloned = false;
  private leafParticles: LeafParticle[] = [];
  private loadedCustomAssetId: string | undefined = undefined;

  // Pool C: Dynamic jagged lightning ribbons
  private lightningCore: THREE.Mesh | null = null;
  private lightningGlow: THREE.Mesh | null = null;
  private lightningCorePos: Float32Array | null = null;
  private lightningGlowPos: Float32Array | null = null;
  private lightningLight: THREE.PointLight | null = null;
  private lightningFlickerTimer = 0;
  private lightningFlashIntensity = 1;
  private lightningSegments: [number, number, number, number, number, number, number][] = [];

  // Pool D: Living Critter Swarms & Birds (body + mirrored left/right flapping wings + optional glow)
  private critterBodyMesh: THREE.InstancedMesh | null = null;
  private critterLeftWingMesh: THREE.InstancedMesh | null = null;
  private critterRightWingMesh: THREE.InstancedMesh | null = null;
  private critterGlowMesh: THREE.Mesh | null = null;
  private critterGlowOffset: THREE.InstancedBufferAttribute | null = null;
  private critterGlowScale: THREE.InstancedBufferAttribute | null = null;
  private critterGlowColor: THREE.InstancedBufferAttribute | null = null;
  private critters: CritterAgent[] = [];
  private flockDirProgress = 0;

  private activeMode: 'billboard' | 'customMesh' | 'lightning' | 'critter' = 'billboard';
  private activeCap = 0;

  constructor(config: FxEmitterConfig, entityId: string, isEditor: boolean) {
    this.config = { ...config, targetOffset: [...config.targetOffset] as [number, number, number] };
    this.isEditor = isEditor;
    this.group = new THREE.Group();
    this.group.userData.entityId = entityId;
    this.group.userData.isFxEmitter = true;

    this.fxRoot = new THREE.Group();
    this.fxRoot.position.y = config.elevationY ?? 0.3;
    this.group.add(this.fxRoot);

    if (isEditor) {
      const meta = getFxPresetMeta(config.preset);
      this.beacon = buildEditorBeacon(meta.accentHex);
      this.group.add(this.beacon);
    } else {
      this.beacon = null;
    }

    this.rebuildPools();
  }

  public getConfig(): Readonly<FxEmitterConfig> {
    return this.config;
  }

  public setPaused(p: boolean): void {
    this.paused = p;
  }

  public updateConfig(next: FxEmitterConfig): void {
    const prev = this.config;
    const prevMode = getCategoryForPreset(prev.preset);
    const nextMode = getCategoryForPreset(next.preset);
    const capChanged = Math.max(4, Math.round(prev.maxParticles)) !== Math.max(4, Math.round(next.maxParticles));
    const critterCountChanged =
      nextMode === 'critter' &&
      Math.max(1, Math.round(prev.critterCount)) !== Math.max(1, Math.round(next.critterCount));
    const presetChanged = prev.preset !== next.preset;
    const customMeshChanged = prev.customMeshAssetId !== next.customMeshAssetId;
    const glowChanged = prev.glowEnabled !== next.glowEnabled;
    const colorChanged = prev.startColor !== next.startColor || prev.endColor !== next.endColor;

    this.config = { ...next, targetOffset: [...next.targetOffset] as [number, number, number] };
    this.fxRoot.position.y = next.elevationY ?? 0;

    if (
      prevMode !== nextMode ||
      capChanged ||
      critterCountChanged ||
      presetChanged ||
      customMeshChanged ||
      (nextMode === 'critter' && (glowChanged || colorChanged))
    ) {
      this.rebuildPools();
      return;
    }

    // Live uniform updates without rebuilding pools
    if (this.billboardEmissiveUniform) {
      this.billboardEmissiveUniform.value = 1 + Math.max(0, next.emissiveIntensity) * 0.65;
    }
    if (this.lightningGlow) {
      const mat = this.lightningGlow.material as THREE.MeshBasicMaterial;
      mat.color.set(next.startColor);
    }
    if (this.lightningLight) {
      this.lightningLight.color.set(next.startColor);
    }
  }

  public triggerBurst(): void {
    const cfg = this.config;
    if (this.activeMode === 'lightning') {
      this.regenerateLightningBolt();
      this.lightningFlashIntensity = 1.4;
      this.lightningFlickerTimer = 0;
      return;
    }
    if (this.activeMode === 'billboard') {
      const count =
        cfg.preset === 'waterSplash'
          ? Math.min(this.activeCap, Math.max(6, Math.round(cfg.burstCount)))
          : Math.min(this.activeCap, Math.max(10, Math.round(this.activeCap * 0.45)));
      for (let i = 0; i < count; i++) {
        this.spawnClassicParticle(true);
      }
      return;
    }
    if (this.activeMode === 'customMesh') {
      const count = Math.min(this.activeCap, 16);
      for (let i = 0; i < count; i++) {
        this.spawnLeafParticle(true);
      }
      return;
    }
    if (this.activeMode === 'critter') {
      // Excite swarm outward briefly on burst
      for (let i = 0; i < this.critters.length; i++) {
        const a = this.critters[i];
        a.vx += (Math.random() - 0.5) * cfg.moveSpeed * 2.4;
        a.vy += Math.random() * cfg.moveSpeed * 1.4;
        a.vz += (Math.random() - 0.5) * cfg.moveSpeed * 2.4;
      }
    }
  }

  private clearPools(): void {
    while (this.fxRoot.children.length > 0) {
      const ch = this.fxRoot.children[0];
      this.fxRoot.remove(ch);
      ch.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry && mesh.geometry !== cachedLeafGeo) {
          mesh.geometry.dispose();
        }
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            mesh.material.dispose();
          }
        }
      });
    }
    this.billboardMesh = null;
    this.billboardMat = null;
    this.aOffset = null;
    this.aScale = null;
    this.aColor = null;
    this.aRoll = null;
    this.aVel = null;
    this.particles = [];

    this.leafMesh = null;
    this.leafParticles = [];
    this.leafCustomMatCloned = false;

    this.lightningCore = null;
    this.lightningGlow = null;
    this.lightningCorePos = null;
    this.lightningGlowPos = null;
    this.lightningLight = null;
    this.lightningSegments = [];

    this.critterBodyMesh = null;
    this.critterLeftWingMesh = null;
    this.critterRightWingMesh = null;
    this.critterGlowMesh = null;
    this.critterGlowOffset = null;
    this.critterGlowScale = null;
    this.critterGlowColor = null;
    this.critters = [];
  }

  private rebuildPools(): void {
    this.clearPools();
    const cfg = this.config;
    const mode = getCategoryForPreset(cfg.preset);
    this.activeMode = mode;
    this.activeCap = Math.max(4, Math.min(260, Math.round(cfg.maxParticles || 64)));
    this.spawnAccum = 0;
    this.burstTimer = 0;

    if (mode === 'billboard') {
      this.initBillboardPool();
    } else if (mode === 'customMesh') {
      this.initCustomMeshPool();
    } else if (mode === 'lightning') {
      this.initLightningPool();
    } else {
      this.initCritterPool();
    }
  }

  private initBillboardPool(): void {
    const cfg = this.config;
    const cap = this.activeCap;
    const baseQuad = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = baseQuad.index;
    geo.attributes.position = baseQuad.attributes.position;
    geo.attributes.uv = baseQuad.attributes.uv;
    baseQuad.dispose();
    geo.instanceCount = cap;

    const offsets = new Float32Array(cap * 3);
    const scales = new Float32Array(cap * 2);
    const colors = new Float32Array(cap * 4);
    const rolls = new Float32Array(cap);
    const vels = new Float32Array(cap * 3);

    this.aOffset = new THREE.InstancedBufferAttribute(offsets, 3);
    this.aScale = new THREE.InstancedBufferAttribute(scales, 2);
    this.aColor = new THREE.InstancedBufferAttribute(colors, 4);
    this.aRoll = new THREE.InstancedBufferAttribute(rolls, 1);
    this.aVel = new THREE.InstancedBufferAttribute(vels, 3);

    geo.setAttribute('aOffset', this.aOffset);
    geo.setAttribute('aScale', this.aScale);
    geo.setAttribute('aColor', this.aColor);
    geo.setAttribute('aRoll', this.aRoll);
    geo.setAttribute('aVel', this.aVel);

    const stretch =
      cfg.preset === 'sparks' ? 0.55 : cfg.preset === 'rain' ? 0.62 : 0.0;
    const handle = createBillboardShaderMaterial(
      spriteForPreset(cfg.preset),
      isAdditivePreset(cfg.preset),
      stretch,
      cfg.emissiveIntensity
    );
    this.billboardMat = handle.material;
    this.billboardEmissiveUniform = handle.emissiveBoostUniform;

    const mesh = new THREE.Mesh(geo, handle.material);
    mesh.frustumCulled = false;
    mesh.renderOrder = cfg.preset === 'fog' ? 4 : 8;
    this.billboardMesh = mesh;
    this.fxRoot.add(mesh);

    this.particles = [];
    for (let i = 0; i < cap; i++) {
      this.particles.push({
        alive: false,
        age: 0,
        life: 1,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        roll: 0,
        rollSpeed: 0,
        seed: Math.random() * 100,
        sizeMul: 0.75 + Math.random() * 0.5,
      });
    }

    // Pre-warm weather volumes (rain, snow, fog) & initial splash so they appear right away
    if (cfg.preset === 'rain' || cfg.preset === 'snow' || cfg.preset === 'fog') {
      const targetCount = Math.min(cap, Math.max(4, Math.round(cfg.density)));
      for (let i = 0; i < targetCount; i++) {
        this.spawnWeatherParticle(this.particles[i], true);
      }
    } else if (cfg.preset === 'waterSplash') {
      const count = Math.min(cap, Math.max(8, Math.round(cfg.burstCount)));
      for (let i = 0; i < count; i++) {
        this.spawnClassicParticle(true);
      }
    } else {
      // Pre-seed a few classic particles mid-life so editor shows FX immediately
      const prewarm = Math.min(cap, Math.max(6, Math.round(cfg.spawnRate * cfg.lifetime * 0.4)));
      for (let i = 0; i < prewarm; i++) {
        const p = this.spawnClassicParticle(false);
        if (p) {
          const frac = Math.random() * 0.75;
          p.age = p.life * frac;
          p.x += p.vx * p.age;
          p.y += p.vy * p.age + 0.5 * cfg.gravity * p.age * p.age;
          p.z += p.vz * p.age;
        }
      }
    }
  }

  private initCustomMeshPool(): void {
    const cfg = this.config;
    const cap = this.activeCap;
    this.loadedCustomAssetId = cfg.customMeshAssetId;

    let meshGeo: THREE.BufferGeometry = getFallbackLeafGeometry();
    let meshMat: THREE.Material = new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      roughness: 0.68,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
    let useInstanceColors = true;

    if (cfg.customMeshAssetId) {
      const cached = getCachedAssetSync(cfg.customMeshAssetId);
      if (cached) {
        let firstMesh: THREE.Mesh | null = null;
        cached.scene.traverse((obj) => {
          if (!firstMesh && (obj as THREE.Mesh).isMesh) {
            firstMesh = obj as THREE.Mesh;
          }
        });
        if (firstMesh) {
          const fm = firstMesh as THREE.Mesh;
          const clonedGeo = fm.geometry.clone();
          clonedGeo.computeBoundingBox();
          const bb = clonedGeo.boundingBox;
          if (bb) {
            const sz = new THREE.Vector3();
            const cen = new THREE.Vector3();
            bb.getSize(sz);
            bb.getCenter(cen);
            const maxDim = Math.max(sz.x, sz.y, sz.z, 0.001);
            clonedGeo.translate(-cen.x, -cen.y, -cen.z);
            clonedGeo.scale(1 / maxDim, 1 / maxDim, 1 / maxDim);
          }
          meshGeo = clonedGeo;
          const srcMat = Array.isArray(fm.material) ? fm.material[0] : fm.material;
          if (srcMat) {
            meshMat = srcMat.clone();
            this.leafCustomMatCloned = true;
            useInstanceColors = false;
          }
        }
      } else {
        void loadCustomAssetToCache(cfg.customMeshAssetId, 'prop');
      }
    }

    const inst = new THREE.InstancedMesh(meshGeo, meshMat, cap);
    inst.frustumCulled = false;
    inst.castShadow = false;
    inst.receiveShadow = false;

    _colStart.set(cfg.startColor);
    _colEnd.set(cfg.endColor);

    this.leafParticles = [];
    for (let i = 0; i < cap; i++) {
      this.leafParticles.push({
        alive: false,
        age: 0,
        life: cfg.lifetime,
        x: 0,
        y: 0,
        z: 0,
        rx: 0,
        ry: 0,
        rz: 0,
        vrx: 0,
        vry: 0,
        vrz: 0,
        scale: 1,
        seed: Math.random() * 100,
        colorMix: Math.random(),
      });
      _mat4.makeScale(0, 0, 0);
      inst.setMatrixAt(i, _mat4);
      if (useInstanceColors) {
        _colMix.copy(_colStart).lerp(_colEnd, Math.random());
        inst.setColorAt(i, _colMix);
      }
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;

    this.leafMesh = inst;
    this.fxRoot.add(inst);

    // Pre-seed leaves across the drop volume
    const prewarm = Math.min(cap, Math.max(6, Math.round(cfg.spawnRate * cfg.lifetime * 0.45)));
    for (let i = 0; i < prewarm; i++) {
      const lp = this.spawnLeafParticle(false);
      if (lp) {
        lp.age = lp.life * Math.random() * 0.8;
        lp.y -= cfg.fallSpeed * lp.age;
      }
    }
  }

  private initLightningPool(): void {
    const cfg = this.config;
    const maxSegs = 96; // main bolt segments + forked branches
    const vertsPerSeg = 6; // 2 triangles per ribbon segment

    const corePos = new Float32Array(maxSegs * vertsPerSeg * 3);
    const glowPos = new Float32Array(maxSegs * vertsPerSeg * 3);
    this.lightningCorePos = corePos;
    this.lightningGlowPos = glowPos;

    const coreGeo = new THREE.BufferGeometry();
    coreGeo.setAttribute('position', new THREE.BufferAttribute(corePos, 3));
    const coreMat = new THREE.MeshBasicMaterial({
      color: '#FFFFFF',
      transparent: true,
      opacity: 0.98,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.frustumCulled = false;
    coreMesh.renderOrder = 11;

    const glowGeo = new THREE.BufferGeometry();
    glowGeo.setAttribute('position', new THREE.BufferAttribute(glowPos, 3));
    const glowMat = new THREE.MeshBasicMaterial({
      color: cfg.startColor,
      transparent: true,
      opacity: 0.48,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const glowMesh = new THREE.Mesh(glowGeo, glowMat);
    glowMesh.frustumCulled = false;
    glowMesh.renderOrder = 10;

    const light = new THREE.PointLight(cfg.startColor, 0, 12, 1.8);
    light.position.set(0, 1.4, 0);

    this.lightningCore = coreMesh;
    this.lightningGlow = glowMesh;
    this.lightningLight = light;
    this.fxRoot.add(glowMesh, coreMesh, light);

    this.regenerateLightningBolt();
  }

  private initCritterPool(): void {
    const cfg = this.config;
    const cap = Math.min(this.activeCap, Math.max(1, Math.round(cfg.critterCount)));
    const preset = cfg.preset;
    const isBird = preset === 'birds';
    const isBroadWing = preset === 'butterflies' || preset === 'moths';

    // Body geometry (faces +Z)
    const bodyGeo = isBird
      ? buildSculptedBirdBodyGeometry()
      : (() => {
          const g = new THREE.CapsuleGeometry(0.16, 0.44, 4, 6);
          g.rotateX(Math.PI / 2);
          return g;
        })();

    const bodyMat = new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      emissive: cfg.glowEnabled ? cfg.startColor : '#000000',
      emissiveIntensity: cfg.glowEnabled ? Math.max(0.8, cfg.emissiveIntensity) : 0,
      roughness: isBird ? 0.62 : 0.55,
      metalness: 0.08,
      side: isBird ? THREE.DoubleSide : THREE.FrontSide,
    });
    const bodyMesh = new THREE.InstancedMesh(bodyGeo, bodyMat, cap);
    bodyMesh.frustumCulled = false;

    // Right wing geometry (extends outward along +X, leading edge toward +Z, hinges cleanly along x = 0)
    let rightWingGeo: THREE.BufferGeometry;
    if (isBird) {
      // Swept feathered avian wing
      const ws = new THREE.Shape();
      ws.moveTo(0, 0.24);
      ws.quadraticCurveTo(0.52, 0.34, 1.15, 0.06);
      ws.quadraticCurveTo(1.55, -0.14, 1.75, -0.34);
      ws.quadraticCurveTo(1.22, -0.36, 0.82, -0.26);
      ws.quadraticCurveTo(0.42, -0.22, 0, -0.24);
      ws.closePath();
      rightWingGeo = new THREE.ShapeGeometry(ws, 5);
      // Shape is in XY (+Y forward), rotate -90 deg around X so +Y becomes -Z, then flip Z so leading edge is +Z
      rightWingGeo.rotateX(Math.PI / 2);
    } else if (isBroadWing) {
      // Sculpted butterfly forewing + hindwing extending along +X, forewing toward +Z
      const ws = new THREE.Shape();
      ws.moveTo(0, 0.14);
      ws.quadraticCurveTo(0.42, 0.62, 1.02, 0.46);
      ws.quadraticCurveTo(1.18, 0.12, 0.66, -0.06);
      ws.quadraticCurveTo(0.92, -0.34, 0.52, -0.58);
      ws.quadraticCurveTo(0.18, -0.44, 0, -0.18);
      ws.closePath();
      rightWingGeo = new THREE.ShapeGeometry(ws, 5);
      rightWingGeo.rotateX(Math.PI / 2);
    } else {
      // Tapered insect wing
      const ws = new THREE.Shape();
      ws.moveTo(0, 0.05);
      ws.quadraticCurveTo(0.42, 0.22, 0.74, 0.04);
      ws.quadraticCurveTo(0.45, -0.16, 0, -0.06);
      ws.closePath();
      rightWingGeo = new THREE.ShapeGeometry(ws, 3);
      rightWingGeo.rotateX(Math.PI / 2);
    }

    // True mirrored left wing geometry (extends along -X, leading edge STILL toward +Z!)
    const leftWingGeo = mirrorGeometryX(rightWingGeo);

    const wingMatL = new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      emissive: cfg.glowEnabled ? cfg.endColor : '#000000',
      emissiveIntensity: cfg.glowEnabled ? 0.55 : 0,
      roughness: isBird ? 0.58 : 0.45,
      transparent: !isBroadWing && !isBird,
      opacity: isBroadWing || isBird ? 0.96 : 0.68,
      side: THREE.DoubleSide,
    });
    const wingMatR = wingMatL.clone();

    const leftWingMesh = new THREE.InstancedMesh(leftWingGeo, wingMatL, cap);
    const rightWingMesh = new THREE.InstancedMesh(rightWingGeo, wingMatR, cap);
    leftWingMesh.frustumCulled = false;
    rightWingMesh.frustumCulled = false;

    _colStart.set(cfg.startColor);
    _colEnd.set(cfg.endColor);

    this.flockDirProgress = 0;
    this.critters = [];
    const headingRad = THREE.MathUtils.degToRad(cfg.flightHeading ?? 40);
    const dirX = Math.cos(headingRad);
    const dirZ = Math.sin(headingRad);
    const rightX = -dirZ;
    const rightZ = dirX;

    for (let i = 0; i < cap; i++) {
      const ang = (i / Math.max(1, cap)) * Math.PI * 2 + Math.random() * 0.5;
      const rad = isBird
        ? (0.35 + Math.random() * 0.65) * cfg.roamRadius
        : Math.random() * cfg.roamRadius;
      const h = (Math.random() - 0.5) * Math.min(isBird ? 3.5 : 2.6, cfg.roamRadius * 0.65);
      const mix = Math.random();

      let sx = Math.cos(ang) * rad;
      let sy = h;
      let sz = Math.sin(ang) * rad;
      let vx = (Math.random() - 0.5) * cfg.moveSpeed;
      let vy = (Math.random() - 0.5) * cfg.moveSpeed * 0.3;
      let vz = (Math.random() - 0.5) * cfg.moveSpeed;

      if (isBird && (cfg.flightPattern ?? 'flock') === 'vFormation') {
        const rank = Math.ceil(i / 2);
        const side = i === 0 ? 0 : i % 2 === 1 ? 1 : -1;
        const spacing = Math.max(1.3, cfg.critterSize * 3.1);
        sx = -dirX * rank * spacing * 0.95 + rightX * side * rank * spacing * 0.85;
        sz = -dirZ * rank * spacing * 0.95 + rightZ * side * rank * spacing * 0.85;
        sy = (Math.random() - 0.5) * 0.35;
        vx = dirX * cfg.moveSpeed;
        vy = 0;
        vz = dirZ * cfg.moveSpeed;
      } else if (isBird && (cfg.flightMode ?? 'random') === 'directional') {
        const spreadAlong = (Math.random() - 0.5) * cfg.roamRadius * 1.6;
        const spreadLat = (Math.random() - 0.5) * cfg.roamRadius * 0.9;
        sx = dirX * spreadAlong + rightX * spreadLat;
        sz = dirZ * spreadAlong + rightZ * spreadLat;
        vx = dirX * cfg.moveSpeed;
        vz = dirZ * cfg.moveSpeed;
      }

      this.critters.push({
        x: sx,
        y: sy,
        z: sz,
        vx,
        vy,
        vz,
        tx: (Math.random() - 0.5) * cfg.roamRadius * 1.4,
        ty: (Math.random() - 0.5) * Math.min(2.4, cfg.roamRadius * 0.7),
        tz: (Math.random() - 0.5) * cfg.roamRadius * 1.4,
        phase: Math.random() * Math.PI * 2,
        sizeMul: isBird ? 0.88 + Math.random() * 0.24 : 0.78 + Math.random() * 0.45,
        colorMix: mix,
        glowPhase: Math.random() * Math.PI * 2,
        wingPhase: Math.random() * Math.PI * 2,
        bankAngle: 0,
        glideTimer: 1.4 + Math.random() * 2.8,
        isGliding: false,
        birdState: 'flying',
        stateTimer: 0,
        landCooldown: 3.5 + Math.random() * 8.0,
        landX: (Math.random() - 0.5) * cfg.roamRadius * 0.7,
        landZ: (Math.random() - 0.5) * cfg.roamRadius * 0.7,
        orbitAngle: ang,
        orbitAlt: (Math.random() - 0.5) * 1.8,
        headingYaw: Math.atan2(vx, vz),
      });

      _colMix
        .copy(_colStart)
        .lerp(_colEnd, preset === 'bees' ? (i % 2 === 0 ? 0.1 : 0.35) : isBird ? mix * 0.32 : mix * 0.5);
      bodyMesh.setColorAt(i, _colMix);

      _colMix
        .copy(_colStart)
        .lerp(_colEnd, isBroadWing ? mix : isBird ? 0.45 + mix * 0.45 : 0.75);
      leftWingMesh.setColorAt(i, _colMix);
      rightWingMesh.setColorAt(i, _colMix);
    }
    if (bodyMesh.instanceColor) bodyMesh.instanceColor.needsUpdate = true;
    if (leftWingMesh.instanceColor) leftWingMesh.instanceColor.needsUpdate = true;
    if (rightWingMesh.instanceColor) rightWingMesh.instanceColor.needsUpdate = true;

    this.critterBodyMesh = bodyMesh;
    this.critterLeftWingMesh = leftWingMesh;
    this.critterRightWingMesh = rightWingMesh;
    this.fxRoot.add(bodyMesh, leftWingMesh, rightWingMesh);

    if (cfg.glowEnabled) {
      const baseQuad = new THREE.PlaneGeometry(1, 1);
      const gGeo = new THREE.InstancedBufferGeometry();
      gGeo.index = baseQuad.index;
      gGeo.attributes.position = baseQuad.attributes.position;
      gGeo.attributes.uv = baseQuad.attributes.uv;
      baseQuad.dispose();
      gGeo.instanceCount = cap;

      this.critterGlowOffset = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
      this.critterGlowScale = new THREE.InstancedBufferAttribute(new Float32Array(cap * 2), 2);
      this.critterGlowColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
      const dummyRoll = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
      const dummyVel = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);

      gGeo.setAttribute('aOffset', this.critterGlowOffset);
      gGeo.setAttribute('aScale', this.critterGlowScale);
      gGeo.setAttribute('aColor', this.critterGlowColor);
      gGeo.setAttribute('aRoll', dummyRoll);
      gGeo.setAttribute('aVel', dummyVel);

      const gHandle = createBillboardShaderMaterial(
        'star',
        true,
        0,
        Math.max(1.2, cfg.emissiveIntensity)
      );
      const gMesh = new THREE.Mesh(gGeo, gHandle.material);
      gMesh.frustumCulled = false;
      gMesh.renderOrder = 9;
      this.critterGlowMesh = gMesh;
      this.fxRoot.add(gMesh);
    }
  }

  private spawnClassicParticle(isBurst: boolean): ClassicParticle | null {
    const cfg = this.config;
    let slot: ClassicParticle | null = null;
    for (let i = 0; i < this.particles.length; i++) {
      if (!this.particles[i].alive) {
        slot = this.particles[i];
        break;
      }
    }
    if (!slot) return null;

    const spreadRad = THREE.MathUtils.degToRad(Math.max(2, cfg.spreadAngle));
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * spreadRad;
    const sinPhi = Math.sin(phi);
    const spd = cfg.speed * (0.65 + Math.random() * 0.7) * (isBurst && cfg.preset !== 'waterSplash' ? 1.25 : 1);

    const originR = cfg.preset === 'magic' ? 0.55 : cfg.preset === 'dust' ? 0.75 : 0.16;
    slot.alive = true;
    slot.age = 0;
    slot.life = Math.max(0.18, cfg.lifetime * (0.72 + Math.random() * 0.56));
    slot.x = Math.cos(theta) * Math.random() * originR;
    slot.y = Math.random() * 0.12;
    slot.z = Math.sin(theta) * Math.random() * originR;
    slot.vx = Math.cos(theta) * sinPhi * spd;
    slot.vy = Math.cos(phi) * spd;
    slot.vz = Math.sin(theta) * sinPhi * spd;
    slot.roll = Math.random() * Math.PI * 2;
    slot.rollSpeed = (Math.random() - 0.5) * (cfg.preset === 'smoke' || cfg.preset === 'dust' ? 0.85 : 2.2);
    slot.seed = Math.random() * 100;
    slot.sizeMul = 0.72 + Math.random() * 0.58;
    return slot;
  }

  private spawnWeatherParticle(slot: ClassicParticle, randomHeight: boolean): void {
    const cfg = this.config;
    const r = Math.sqrt(Math.random()) * Math.max(0.8, cfg.areaRadius);
    const a = Math.random() * Math.PI * 2;
    const h = Math.max(1.2, cfg.areaHeight);
    const windRad = THREE.MathUtils.degToRad(cfg.windAngle);
    const wx = Math.cos(windRad) * cfg.windDrift;
    const wz = Math.sin(windRad) * cfg.windDrift;

    slot.alive = true;
    slot.age = randomHeight ? Math.random() * 4 : 0;
    slot.life = cfg.preset === 'fog' ? 7 + Math.random() * 5 : 4 + Math.random() * 3;
    slot.x = Math.cos(a) * r;
    slot.z = Math.sin(a) * r;
    slot.y = randomHeight ? Math.random() * h : cfg.preset === 'fog' ? Math.random() * h : h;
    slot.vx = wx + (Math.random() - 0.5) * 0.25;
    slot.vy = cfg.preset === 'fog' ? (Math.random() - 0.5) * 0.08 : -Math.max(0.2, cfg.fallSpeed) * (0.8 + Math.random() * 0.4);
    slot.vz = wz + (Math.random() - 0.5) * 0.25;
    slot.roll = Math.random() * Math.PI * 2;
    slot.rollSpeed = cfg.preset === 'fog' ? (Math.random() - 0.5) * 0.14 : (Math.random() - 0.5) * 1.1;
    slot.seed = Math.random() * 100;
    slot.sizeMul = 0.75 + Math.random() * 0.5;
  }

  private spawnLeafParticle(isBurst: boolean): LeafParticle | null {
    const cfg = this.config;
    let slot: LeafParticle | null = null;
    for (let i = 0; i < this.leafParticles.length; i++) {
      if (!this.leafParticles[i].alive) {
        slot = this.leafParticles[i];
        break;
      }
    }
    if (!slot) return null;

    const r = Math.sqrt(Math.random()) * Math.max(0.6, cfg.areaRadius || 4.0);
    const a = Math.random() * Math.PI * 2;
    slot.alive = true;
    slot.age = 0;
    slot.life = Math.max(0.8, cfg.lifetime * (0.75 + Math.random() * 0.5));
    slot.x = Math.cos(a) * r;
    slot.y = isBurst ? (Math.random() - 0.3) * 1.2 : Math.random() * 0.8;
    slot.z = Math.sin(a) * r;
    slot.rx = Math.random() * Math.PI * 2;
    slot.ry = Math.random() * Math.PI * 2;
    slot.rz = Math.random() * Math.PI * 2;
    slot.vrx = (Math.random() - 0.5) * cfg.tumbleSpeed * 2;
    slot.vry = (Math.random() - 0.5) * cfg.tumbleSpeed * 2;
    slot.vrz = (Math.random() - 0.5) * cfg.tumbleSpeed * 2;
    const v = Math.max(0, Math.min(0.85, cfg.scaleVariation));
    slot.scale = Math.max(0.08, cfg.startSize * (1 - v * 0.5 + Math.random() * v));
    slot.seed = Math.random() * 100;
    slot.colorMix = Math.random();
    return slot;
  }

  private regenerateLightningBolt(): void {
    const cfg = this.config;
    this.lightningSegments.length = 0;

    // Direction & length
    const ox = cfg.targetOffset[0];
    const oy = cfg.targetOffset[1];
    const oz = cfg.targetOffset[2];
    const rawLen = Math.hypot(ox, oy, oz);
    const scale = rawLen > 0.05 ? cfg.boltLength / rawLen : 1;
    const ex = rawLen > 0.05 ? ox * scale : 0;
    const ey = rawLen > 0.05 ? oy * scale : cfg.boltLength;
    const ez = rawLen > 0.05 ? oz * scale : 0;

    const steps = 16;
    const jitter = Math.max(0.05, cfg.jitterAmount) * (cfg.boltLength * 0.14);
    let px = 0;
    let py = 0;
    let pz = 0;

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const env = Math.sin(t * Math.PI); // pin endpoints cleanly at 0 and target
      const nx = ex * t + (Math.random() - 0.5) * 2 * jitter * env;
      const ny = ey * t + (Math.random() - 0.5) * 0.7 * jitter * env;
      const nz = ez * t + (Math.random() - 0.5) * 2 * jitter * env;
      this.lightningSegments.push([px, py, pz, nx, ny, nz, 1.0]);

      // Forked side branches
      if (i > 2 && i < steps - 2 && Math.random() < cfg.branchAmount * 0.55) {
        let bx = nx;
        let by = ny;
        let bz = nz;
        const bDirX = (Math.random() - 0.5) * 2.2;
        const bDirY = (ey >= 0 ? 0.55 : -0.55) + (Math.random() - 0.5) * 0.6;
        const bDirZ = (Math.random() - 0.5) * 2.2;
        const bLen = cfg.boltLength * (0.14 + Math.random() * 0.18);
        const bSteps = 4;
        for (let b = 1; b <= bSteps; b++) {
          const bt = b / bSteps;
          const nbx = bx + (bDirX * bLen) / bSteps + (Math.random() - 0.5) * jitter * 0.45;
          const nby = by + (bDirY * bLen) / bSteps + (Math.random() - 0.5) * jitter * 0.3;
          const nbz = bz + (bDirZ * bLen) / bSteps + (Math.random() - 0.5) * jitter * 0.45;
          if (this.lightningSegments.length < 96) {
            this.lightningSegments.push([bx, by, bz, nbx, nby, nbz, 0.55 * (1 - bt * 0.5)]);
          }
          bx = nbx;
          by = nby;
          bz = nbz;
        }
      }

      px = nx;
      py = ny;
      pz = nz;
    }
  }

  private writeLightningRibbons(camera: THREE.Camera | null): void {
    if (!this.lightningCore || !this.lightningGlow || !this.lightningCorePos || !this.lightningGlowPos) {
      return;
    }
    const cfg = this.config;
    const coreArr = this.lightningCorePos;
    const glowArr = this.lightningGlowPos;
    coreArr.fill(0);
    glowArr.fill(0);

    // Compute camera position in fxRoot local space for crisp billboarding
    if (camera) {
      this.fxRoot.updateMatrixWorld(false);
      _invRootMat.copy(this.fxRoot.matrixWorld).invert();
      _camPosLocal.copy(camera.position).applyMatrix4(_invRootMat);
    } else {
      _camPosLocal.set(0, 3, 8);
    }

    const baseHalfW = Math.max(0.015, cfg.boltThickness * 0.45);
    const segCount = Math.min(96, this.lightningSegments.length);

    for (let i = 0; i < segCount; i++) {
      const seg = this.lightningSegments[i];
      _vecA.set(seg[0], seg[1], seg[2]);
      _vecB.set(seg[3], seg[4], seg[5]);
      const wScale = seg[6];

      // Ribbon perpendicular axis facing camera
      _vecC.copy(_vecB).sub(_vecA);
      _vecRight.copy(_camPosLocal).sub(_vecA).cross(_vecC);
      if (_vecRight.lengthSq() < 0.00001) _vecRight.set(1, 0, 0);
      else _vecRight.normalize();

      const hwCore = baseHalfW * wScale;
      const hwGlow = baseHalfW * 3.1 * wScale;
      const baseIdx = i * 18;

      for (let pass = 0; pass < 2; pass++) {
        const arr = pass === 0 ? coreArr : glowArr;
        const hw = pass === 0 ? hwCore : hwGlow;
        const rx = _vecRight.x * hw;
        const ry = _vecRight.y * hw;
        const rz = _vecRight.z * hw;

        // Tri 1: A-r, A+r, B+r
        arr[baseIdx + 0] = _vecA.x - rx;
        arr[baseIdx + 1] = _vecA.y - ry;
        arr[baseIdx + 2] = _vecA.z - rz;
        arr[baseIdx + 3] = _vecA.x + rx;
        arr[baseIdx + 4] = _vecA.y + ry;
        arr[baseIdx + 5] = _vecA.z + rz;
        arr[baseIdx + 6] = _vecB.x + rx;
        arr[baseIdx + 7] = _vecB.y + ry;
        arr[baseIdx + 8] = _vecB.z + rz;
        // Tri 2: A-r, B+r, B-r
        arr[baseIdx + 9] = _vecA.x - rx;
        arr[baseIdx + 10] = _vecA.y - ry;
        arr[baseIdx + 11] = _vecA.z - rz;
        arr[baseIdx + 12] = _vecB.x + rx;
        arr[baseIdx + 13] = _vecB.y + ry;
        arr[baseIdx + 14] = _vecB.z + rz;
        arr[baseIdx + 15] = _vecB.x - rx;
        arr[baseIdx + 16] = _vecB.y - ry;
        arr[baseIdx + 17] = _vecB.z - rz;
      }
    }

    (this.lightningCore.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.lightningGlow.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;

    const coreMat = this.lightningCore.material as THREE.MeshBasicMaterial;
    const glowMat = this.lightningGlow.material as THREE.MeshBasicMaterial;
    const vis = Math.max(0, Math.min(1, this.lightningFlashIntensity));
    coreMat.opacity = vis;
    glowMat.opacity = vis * Math.min(0.85, 0.35 + cfg.emissiveIntensity * 0.16);
    if (this.lightningLight) {
      this.lightningLight.intensity = vis * (1.2 + cfg.emissiveIntensity * 1.4);
    }
  }

  public update(dt: number, camera: THREE.Camera | null = null): void {
    const cfg = this.config;
    this.fxRoot.visible = cfg.enabled;

    if (this.beacon) {
      this.beacon.visible = this.isEditor;
    }
    if (!cfg.enabled || this.paused) return;

    const safeDt = Math.min(0.06, Math.max(0.001, dt));
    this.elapsed += safeDt;

    // If custom mesh finished async loading into cache, upgrade fallingLeaves pool
    if (
      this.activeMode === 'customMesh' &&
      cfg.customMeshAssetId &&
      !this.leafCustomMatCloned &&
      getCachedAssetSync(cfg.customMeshAssetId)
    ) {
      this.rebuildPools();
    }

    if (this.activeMode === 'billboard') {
      this.stepBillboardPool(safeDt);
    } else if (this.activeMode === 'customMesh') {
      this.stepCustomMeshPool(safeDt);
    } else if (this.activeMode === 'lightning') {
      this.stepLightningPool(safeDt, camera);
    } else {
      this.stepCritterPool(safeDt);
    }
  }

  private stepBillboardPool(dt: number): void {
    if (!this.aOffset || !this.aScale || !this.aColor || !this.aRoll || !this.aVel) return;
    const cfg = this.config;
    const isWeather = cfg.preset === 'rain' || cfg.preset === 'snow' || cfg.preset === 'fog';
    const isSplash = cfg.preset === 'waterSplash';

    if (isSplash) {
      if (cfg.burstInterval > 0.05) {
        this.burstTimer += dt;
        if (this.burstTimer >= cfg.burstInterval) {
          this.burstTimer = 0;
          const cnt = Math.min(this.activeCap, Math.max(4, Math.round(cfg.burstCount)));
          for (let i = 0; i < cnt; i++) this.spawnClassicParticle(true);
        }
      }
    } else if (isWeather) {
      const desired = Math.min(this.activeCap, Math.max(2, Math.round(cfg.density)));
      let activeCount = 0;
      for (let i = 0; i < this.particles.length; i++) {
        if (this.particles[i].alive) activeCount++;
      }
      for (let i = 0; i < this.particles.length && activeCount < desired; i++) {
        if (!this.particles[i].alive) {
          this.spawnWeatherParticle(this.particles[i], false);
          activeCount++;
        }
      }
    } else {
      this.spawnAccum += cfg.spawnRate * dt;
      let toSpawn = Math.min(12, Math.floor(this.spawnAccum));
      this.spawnAccum -= toSpawn;
      while (toSpawn-- > 0) {
        this.spawnClassicParticle(false);
      }
    }

    _colStart.set(cfg.startColor);
    _colEnd.set(cfg.endColor);

    const offsets = this.aOffset.array as Float32Array;
    const scales = this.aScale.array as Float32Array;
    const colors = this.aColor.array as Float32Array;
    const rolls = this.aRoll.array as Float32Array;
    const vels = this.aVel.array as Float32Array;
    const windRad = THREE.MathUtils.degToRad(cfg.windAngle);
    const windX = Math.cos(windRad) * cfg.windDrift;
    const windZ = Math.sin(windRad) * cfg.windDrift;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const o3 = i * 3;
      const o2 = i * 2;
      const o4 = i * 4;

      if (!p.alive) {
        colors[o4 + 3] = 0;
        scales[o2] = 0;
        scales[o2 + 1] = 0;
        continue;
      }

      p.age += dt;
      if (isWeather) {
        const h = Math.max(1.2, cfg.areaHeight);
        const rad = Math.max(0.8, cfg.areaRadius);
        if (cfg.preset === 'fog') {
          p.x += (windX * 0.45 + Math.sin(this.elapsed * 0.35 + p.seed) * 0.2) * dt;
          p.z += (windZ * 0.45 + Math.cos(this.elapsed * 0.3 + p.seed) * 0.2) * dt;
          p.y += Math.sin(this.elapsed * 0.4 + p.seed) * 0.08 * dt;
          p.roll += p.rollSpeed * dt;
          if (p.age >= p.life || Math.hypot(p.x, p.z) > rad * 1.45) {
            this.spawnWeatherParticle(p, true);
            p.age = 0;
          }
        } else {
          const swirl = cfg.preset === 'snow' ? cfg.turbulence * 0.85 : 0;
          p.vx = windX + (swirl > 0 ? Math.sin(this.elapsed * 1.6 + p.seed) * swirl : 0);
          p.vz = windZ + (swirl > 0 ? Math.cos(this.elapsed * 1.4 + p.seed) * swirl : 0);
          p.vy = -Math.max(0.25, cfg.fallSpeed);
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          p.roll += p.rollSpeed * dt;

          if (p.y < -0.2 || Math.hypot(p.x, p.z) > rad * 1.55) {
            this.spawnWeatherParticle(p, false);
          }
        }

        const t = Math.min(1, p.age / Math.max(0.1, p.life));
        let alpha = cfg.preset === 'fog' ? 0.22 : cfg.preset === 'rain' ? 0.72 : 0.88;
        if (cfg.preset === 'fog') {
          const fIn = Math.max(0.05, cfg.fadeIn);
          const fOut = Math.max(0.05, cfg.fadeOut);
          if (t < fIn) alpha *= t / fIn;
          else if (t > 1 - fOut) alpha *= (1 - t) / fOut;
        }
        const sz =
          THREE.MathUtils.lerp(cfg.startSize, cfg.endSize, cfg.preset === 'fog' ? t : 0) *
          p.sizeMul;

        _colMix.copy(_colStart).lerp(_colEnd, cfg.preset === 'fog' ? t : 0.35);
        offsets[o3] = p.x;
        offsets[o3 + 1] = p.y;
        offsets[o3 + 2] = p.z;
        scales[o2] = sz;
        scales[o2 + 1] = cfg.preset === 'rain' ? sz * 2.2 : sz;
        colors[o4] = _colMix.r;
        colors[o4 + 1] = _colMix.g;
        colors[o4 + 2] = _colMix.b;
        colors[o4 + 3] = Math.max(0, alpha);
        rolls[i] = p.roll;
        vels[o3] = p.vx;
        vels[o3 + 1] = p.vy;
        vels[o3 + 2] = p.vz;
        continue;
      }

      if (p.age >= p.life) {
        p.alive = false;
        colors[o4 + 3] = 0;
        scales[o2] = 0;
        scales[o2 + 1] = 0;
        continue;
      }

      // Classic & Splash physics + swirl turbulence
      p.vy += cfg.gravity * dt;
      if (cfg.turbulence > 0.01) {
        const turb = cfg.turbulence;
        const phase = this.elapsed * 2.6 + p.seed;
        if (cfg.preset === 'magic') {
          // Swirl orbit around Y axis
          p.vx += (-p.z * 1.4 + Math.sin(phase) * 0.9) * turb * dt;
          p.vz += (p.x * 1.4 + Math.cos(phase) * 0.9) * turb * dt;
        } else {
          p.vx += Math.sin(phase) * turb * 1.6 * dt;
          p.vz += Math.cos(phase * 0.85) * turb * 1.6 * dt;
        }
      }

      // Gentle air drag for smoke/dust
      if (cfg.preset === 'smoke' || cfg.preset === 'dust') {
        const drag = Math.max(0, 1 - dt * 0.75);
        p.vx *= drag;
        p.vz *= drag;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.roll += p.rollSpeed * dt;

      // Ground bounce for sparks & droplets
      if ((cfg.preset === 'sparks' || isSplash) && p.y < -cfg.elevationY) {
        p.y = -cfg.elevationY;
        p.vy = Math.abs(p.vy) * 0.28;
        p.vx *= 0.6;
        p.vz *= 0.6;
      }

      const lifeT = p.age / p.life;
      const fIn = Math.max(0.001, Math.min(0.49, cfg.fadeIn));
      const fOut = Math.max(0.001, Math.min(0.85, cfg.fadeOut));
      let alpha = 1;
      if (lifeT < fIn) alpha = lifeT / fIn;
      else if (lifeT > 1 - fOut) alpha = (1 - lifeT) / fOut;

      if (cfg.preset === 'smoke') alpha *= 0.56;
      else if (cfg.preset === 'dust') alpha *= 0.52;
      else if (cfg.preset === 'magic') {
        // Twinkle shimmer on magic sparkles
        alpha *= 0.72 + Math.sin(this.elapsed * 12 + p.seed) * 0.28;
      }

      const baseStart = isSplash ? cfg.splashSize : cfg.startSize;
      const baseEnd = isSplash ? cfg.splashSize * 0.35 : cfg.endSize;
      const sz = Math.max(0.01, THREE.MathUtils.lerp(baseStart, baseEnd, lifeT) * p.sizeMul);

      _colMix.copy(_colStart).lerp(_colEnd, lifeT);

      offsets[o3] = p.x;
      offsets[o3 + 1] = p.y;
      offsets[o3 + 2] = p.z;
      scales[o2] = sz;
      scales[o2 + 1] = sz;
      colors[o4] = _colMix.r;
      colors[o4 + 1] = _colMix.g;
      colors[o4 + 2] = _colMix.b;
      colors[o4 + 3] = Math.max(0, Math.min(1, alpha));
      rolls[i] = p.roll;
      vels[o3] = p.vx;
      vels[o3 + 1] = p.vy;
      vels[o3 + 2] = p.vz;
    }

    this.aOffset.needsUpdate = true;
    this.aScale.needsUpdate = true;
    this.aColor.needsUpdate = true;
    this.aRoll.needsUpdate = true;
    this.aVel.needsUpdate = true;
  }

  private stepCustomMeshPool(dt: number): void {
    if (!this.leafMesh) return;
    const cfg = this.config;

    this.spawnAccum += cfg.spawnRate * dt;
    let toSpawn = Math.min(6, Math.floor(this.spawnAccum));
    this.spawnAccum -= toSpawn;
    while (toSpawn-- > 0) {
      this.spawnLeafParticle(false);
    }

    const windRad = THREE.MathUtils.degToRad(cfg.windAngle);
    const windX = Math.cos(windRad) * cfg.windDrift;
    const windZ = Math.sin(windRad) * cfg.windDrift;
    const floorY = -(cfg.elevationY ?? 0) + 0.04;

    for (let i = 0; i < this.leafParticles.length; i++) {
      const lp = this.leafParticles[i];
      if (!lp.alive) {
        _mat4.makeScale(0, 0, 0);
        this.leafMesh.setMatrixAt(i, _mat4);
        continue;
      }

      lp.age += dt;
      if (lp.age >= lp.life) {
        lp.alive = false;
        _mat4.makeScale(0, 0, 0);
        this.leafMesh.setMatrixAt(i, _mat4);
        continue;
      }

      const lifeT = lp.age / lp.life;
      if (lp.y > floorY) {
        const swayPhase = this.elapsed * cfg.swayFrequency + lp.seed;
        const swayX = Math.cos(swayPhase) * cfg.swayAmplitude;
        const swayZ = Math.sin(swayPhase * 0.78) * cfg.swayAmplitude * 0.65;
        lp.x += (windX + swayX) * dt;
        lp.z += (windZ + swayZ) * dt;
        lp.y -= cfg.fallSpeed * (0.85 + Math.sin(swayPhase * 2) * 0.2) * dt;
        lp.rx += lp.vrx * dt;
        lp.ry += lp.vry * dt;
        lp.rz += lp.vrz * dt;
      } else {
        lp.y = floorY;
      }

      let env = 1;
      if (lifeT < 0.1) env = lifeT / 0.1;
      else if (lifeT > 0.8) env = (1 - lifeT) / 0.2;

      _dummy.position.set(lp.x, lp.y, lp.z);
      _dummy.rotation.set(lp.rx, lp.ry, lp.rz);
      _dummy.scale.setScalar(Math.max(0.001, lp.scale * env));
      _dummy.updateMatrix();
      this.leafMesh.setMatrixAt(i, _dummy.matrix);
    }

    this.leafMesh.instanceMatrix.needsUpdate = true;
  }

  private stepLightningPool(dt: number, camera: THREE.Camera | null): void {
    const cfg = this.config;
    const rate = Math.max(0.25, cfg.flickerRate);
    this.lightningFlickerTimer += dt;

    if (cfg.burstInterval > 0.05) {
      // Repeating storm bursts
      this.burstTimer += dt;
      if (this.burstTimer >= cfg.burstInterval) {
        this.burstTimer = 0;
        this.regenerateLightningBolt();
        this.lightningFlashIntensity = 1.35;
      }
      this.lightningFlashIntensity = Math.max(0, this.lightningFlashIntensity - dt * 3.8);
    } else {
      // Continuous crackling arc at flickerRate Hz
      const interval = 1 / rate;
      if (this.lightningFlickerTimer >= interval) {
        this.lightningFlickerTimer = 0;
        this.regenerateLightningBolt();
        this.lightningFlashIntensity = 0.85 + Math.random() * 0.35;
      } else {
        this.lightningFlashIntensity = Math.max(0.32, this.lightningFlashIntensity - dt * 1.4);
      }
    }

    this.writeLightningRibbons(camera);
  }

  private stepCritterPool(dt: number): void {
    if (!this.critterBodyMesh || !this.critterLeftWingMesh || !this.critterRightWingMesh) return;
    const cfg = this.config;
    const isBird = cfg.preset === 'birds';
    const isButterfly = cfg.preset === 'butterflies' || cfg.preset === 'moths';
    const radius = Math.max(0.5, cfg.roamRadius);
    const maxH = isBird ? Math.min(6.0, radius * 0.45) : Math.min(3.2, radius * 0.85);
    const maxSpeed = Math.max(0.2, cfg.moveSpeed);
    const erratic = Math.max(0, cfg.erraticness);
    const flapAmpRad = THREE.MathUtils.degToRad(
      THREE.MathUtils.clamp(
        cfg.wingFlapAmplitude ?? (isButterfly ? 72 : isBird ? 56 : 45),
        0,
        85
      )
    );
    const groundLocalY = -(cfg.elevationY ?? 0);

    _colStart.set(cfg.startColor);
    _colEnd.set(cfg.endColor);

    const glowOffsets = this.critterGlowOffset?.array as Float32Array | undefined;
    const glowScales = this.critterGlowScale?.array as Float32Array | undefined;
    const glowColors = this.critterGlowColor?.array as Float32Array | undefined;

    // Precompute flock center & directional heading for birds
    const flightPattern = cfg.flightPattern ?? 'flock';
    const flightMode = cfg.flightMode ?? 'random';
    const headingRad = THREE.MathUtils.degToRad(cfg.flightHeading ?? 40);
    const dirX = Math.cos(headingRad);
    const dirZ = Math.sin(headingRad);
    const rightX = -dirZ;
    const rightZ = dirX;

    let flockCx = 0;
    let flockCy = 0;
    let flockCz = 0;
    let flockVx = 0;
    let flockVz = 0;
    let flyingCount = 0;

    if (isBird) {
      this.flockDirProgress += maxSpeed * dt;
      const span = radius * 2.4;
      if (this.flockDirProgress > span) this.flockDirProgress -= span * 2;
      for (let i = 0; i < this.critters.length; i++) {
        const b = this.critters[i];
        if (b.birdState === 'flying') {
          flockCx += b.x;
          flockCy += b.y;
          flockCz += b.z;
          flockVx += b.vx;
          flockVz += b.vz;
          flyingCount++;
        }
      }
      if (flyingCount > 0) {
        flockCx /= flyingCount;
        flockCy /= flyingCount;
        flockCz /= flyingCount;
        flockVx /= flyingCount;
        flockVz /= flyingCount;
      }
    }

    // Leader trajectory for V-Formation
    let vLeadX = 0;
    let vLeadY = 0;
    let vLeadZ = 0;
    let vFwdX = dirX;
    let vFwdZ = dirZ;
    if (isBird && flightPattern === 'vFormation') {
      if (flightMode === 'directional') {
        vLeadX = dirX * this.flockDirProgress;
        vLeadZ = dirZ * this.flockDirProgress;
        vLeadY = Math.sin(this.elapsed * 0.7) * 0.65;
        vFwdX = dirX;
        vFwdZ = dirZ;
      } else {
        const orbitR = radius * 0.72;
        const omega = maxSpeed / Math.max(3.0, orbitR);
        const ang = this.elapsed * omega;
        vLeadX = Math.cos(ang) * orbitR;
        vLeadZ = Math.sin(ang) * orbitR;
        vLeadY = Math.sin(this.elapsed * 0.65) * 1.1;
        vFwdX = -Math.sin(ang);
        vFwdZ = Math.cos(ang);
      }
    }

    const vRightX = -vFwdZ;
    const vRightZ = vFwdX;
    const canLand = isBird && Boolean(cfg.landingEnabled);
    const landFreq = THREE.MathUtils.clamp(cfg.landingFrequency ?? 0.35, 0.02, 1.0);

    for (let i = 0; i < this.critters.length; i++) {
      const a = this.critters[i];
      const sz = Math.max(0.05, cfg.critterSize * a.sizeMul);
      const prevVx = a.vx;
      const prevVz = a.vz;
      let wingFoldBlend = 0; // 0 = flying outstretched, 1 = perched folded
      let flapRateMul = 1.0;

      if (isBird) {
        const perchY = groundLocalY + sz * 0.24;

        // Bird state machine: flying -> descending -> landed -> takeoff -> flying
        if (a.birdState === 'landed') {
          a.stateTimer -= dt;
          wingFoldBlend = 1;
          a.vx = 0;
          a.vy = 0;
          a.vz = 0;
          // Gentle perched hop & head-look rotation
          const hop = Math.max(0, Math.sin(this.elapsed * 4.5 + a.phase * 5)) > 0.92 ? 0.12 * sz : 0;
          a.y = perchY + hop;
          a.headingYaw += Math.sin(this.elapsed * 1.4 + a.phase) * 0.55 * dt;
          if (!canLand || a.stateTimer <= 0) {
            a.birdState = 'takeoff';
            a.stateTimer = 1.05;
            const takeAng = a.headingYaw;
            a.vx = Math.sin(takeAng) * maxSpeed * 0.75;
            a.vz = Math.cos(takeAng) * maxSpeed * 0.75;
            a.vy = maxSpeed * 0.65;
          }
        } else if (a.birdState === 'descending') {
          const ldx = a.landX - a.x;
          const ldy = perchY - a.y;
          const ldz = a.landZ - a.z;
          const hDist = Math.hypot(ldx, ldz);
          const approachSpeed = Math.max(1.2, Math.min(maxSpeed * 0.85, hDist * 1.4 + 0.8));
          const invH = hDist > 0.01 ? 1 / hDist : 0;
          a.vx = THREE.MathUtils.damp(a.vx, ldx * invH * approachSpeed, 3.8, dt);
          a.vz = THREE.MathUtils.damp(a.vz, ldz * invH * approachSpeed, 3.8, dt);
          a.vy = THREE.MathUtils.damp(a.vy, Math.max(-maxSpeed * 0.7, ldy * 1.8), 4.0, dt);
          a.x += a.vx * dt;
          a.y += a.vy * dt;
          a.z += a.vz * dt;
          flapRateMul = 1.35; // braking flutter on landing approach
          if (!canLand) {
            a.birdState = 'flying';
          } else if (hDist < 0.55 && a.y <= perchY + 0.25) {
            a.y = perchY;
            a.birdState = 'landed';
            a.stateTimer = 2.6 + Math.random() * 4.4;
          }
        } else if (a.birdState === 'takeoff') {
          a.stateTimer -= dt;
          a.vy = THREE.MathUtils.damp(a.vy, maxSpeed * 0.55, 3.5, dt);
          a.x += a.vx * dt;
          a.y += a.vy * dt;
          a.z += a.vz * dt;
          flapRateMul = 1.5; // strong climb wingbeats
          if (a.stateTimer <= 0 || a.y >= -0.4) {
            a.birdState = 'flying';
            a.landCooldown = 5.0 + Math.random() * 8.0 / Math.max(0.2, landFreq);
          }
        } else {
          // 'flying' state
          if (canLand) {
            a.landCooldown -= dt;
            if (a.landCooldown <= 0 && Math.random() < dt * landFreq * 0.45) {
              const lang = Math.random() * Math.PI * 2;
              const lrad = Math.random() * Math.min(radius * 0.72, 10);
              a.landX = Math.cos(lang) * lrad;
              a.landZ = Math.sin(lang) * lrad;
              a.birdState = 'descending';
              a.isGliding = false;
            }
          }

          if (flightPattern === 'vFormation') {
            const rank = Math.ceil(i / 2);
            const side = i === 0 ? 0 : i % 2 === 1 ? 1 : -1;
            const spacing = Math.max(1.35, cfg.critterSize * 3.1);
            const slotX =
              vLeadX - vFwdX * rank * spacing * 0.92 + vRightX * side * rank * spacing * 0.85;
            const slotZ =
              vLeadZ - vFwdZ * rank * spacing * 0.92 + vRightZ * side * rank * spacing * 0.85;
            const slotY = vLeadY + Math.sin(this.elapsed * 1.4 + a.phase) * 0.22;

            // Wrap cleanly if leader wrapped across directional bounds
            if (Math.hypot(slotX - a.x, slotZ - a.z) > radius * 1.9) {
              a.x = slotX;
              a.y = slotY;
              a.z = slotZ;
            } else {
              const sdx = slotX - a.x;
              const sdy = slotY - a.y;
              const sdz = slotZ - a.z;
              a.vx = THREE.MathUtils.damp(a.vx, vFwdX * maxSpeed + sdx * 2.4, 4.5, dt);
              a.vy = THREE.MathUtils.damp(a.vy, sdy * 2.6, 4.0, dt);
              a.vz = THREE.MathUtils.damp(a.vz, vFwdZ * maxSpeed + sdz * 2.4, 4.5, dt);
            }
          } else if (flightPattern === 'circle') {
            const orbitR = Math.max(2.5, radius * (0.55 + (a.colorMix * 0.4)));
            const omega = (maxSpeed / orbitR) * (i % 2 === 0 ? 1 : 0.92);
            a.orbitAngle += omega * dt;
            const tx = Math.cos(a.orbitAngle) * orbitR;
            const tz = Math.sin(a.orbitAngle) * orbitR;
            const ty = a.orbitAlt + Math.sin(this.elapsed * 0.6 + a.phase) * 0.9;
            const tangX = -Math.sin(a.orbitAngle) * maxSpeed;
            const tangZ = Math.cos(a.orbitAngle) * maxSpeed;
            a.vx = THREE.MathUtils.damp(a.vx, tangX + (tx - a.x) * 1.5, 3.6, dt);
            a.vy = THREE.MathUtils.damp(a.vy, (ty - a.y) * 1.4, 3.0, dt);
            a.vz = THREE.MathUtils.damp(a.vz, tangZ + (tz - a.z) * 1.5, 3.6, dt);
          } else if (flightPattern === 'flock') {
            // Cohesive Boids flock (separation + alignment + cohesion)
            let sepX = 0;
            let sepY = 0;
            let sepZ = 0;
            const sepDist = Math.max(1.2, cfg.critterSize * 2.8);
            for (let j = 0; j < this.critters.length; j++) {
              if (j === i) continue;
              const o = this.critters[j];
              if (o.birdState !== 'flying') continue;
              const ox = a.x - o.x;
              const oy = a.y - o.y;
              const oz = a.z - o.z;
              const dSq = ox * ox + oy * oy + oz * oz;
              if (dSq > 0.0001 && dSq < sepDist * sepDist) {
                const inv = 1 / Math.sqrt(dSq);
                const push = (sepDist - Math.sqrt(dSq)) * inv;
                sepX += ox * push;
                sepY += oy * push;
                sepZ += oz * push;
              }
            }
            a.vx += sepX * 5.2 * dt;
            a.vy += sepY * 3.8 * dt;
            a.vz += sepZ * 5.2 * dt;

            if (flyingCount > 1) {
              a.vx += (flockCx - a.x) * 0.75 * dt + (flockVx - a.vx) * 1.4 * dt;
              a.vy += (flockCy - a.y) * 0.65 * dt;
              a.vz += (flockCz - a.z) * 0.75 * dt + (flockVz - a.vz) * 1.4 * dt;
            }

            if (flightMode === 'directional') {
              a.vx += (dirX * maxSpeed - a.vx) * 1.8 * dt;
              a.vz += (dirZ * maxSpeed - a.vz) * 1.8 * dt;
              a.vy += Math.sin(this.elapsed * 1.5 + a.phase) * 0.6 * dt;
            } else {
              // Gentle flock wheeling inside roam radius
              a.vx += (-a.z * 0.35 + Math.sin(this.elapsed * 0.9 + a.phase) * erratic * 2.2) * dt;
              a.vz += (a.x * 0.35 + Math.cos(this.elapsed * 0.8 + a.phase) * erratic * 2.2) * dt;
              a.vy += (-a.y * 0.55 + Math.sin(this.elapsed * 1.1 + a.phase) * 0.9) * dt;
            }
          } else {
            // 'wander' free flight
            if (flightMode === 'directional') {
              a.vx += (dirX * maxSpeed - a.vx) * 1.6 * dt + Math.sin(this.elapsed * 1.8 + a.phase) * erratic * 2.4 * dt;
              a.vz += (dirZ * maxSpeed - a.vz) * 1.6 * dt + Math.cos(this.elapsed * 1.6 + a.phase) * erratic * 2.4 * dt;
              a.vy += (-a.y * 0.4 + Math.sin(this.elapsed * 1.3 + a.phase) * 1.1) * dt;
            } else {
              const dx = a.tx - a.x;
              const dy = a.ty - a.y;
              const dz = a.tz - a.z;
              const distSq = dx * dx + dy * dy + dz * dz;
              if (distSq < 1.2 || Math.random() < dt * (0.28 + erratic * 0.85)) {
                const ang = Math.random() * Math.PI * 2;
                const r = (0.25 + Math.random() * 0.75) * radius;
                a.tx = Math.cos(ang) * r;
                a.ty = (Math.random() - 0.5) * maxH;
                a.tz = Math.sin(ang) * r;
              }
              const invD = distSq > 0.001 ? 1 / Math.sqrt(distSq) : 0;
              a.vx += dx * invD * maxSpeed * 1.9 * dt;
              a.vy += dy * invD * maxSpeed * 1.2 * dt;
              a.vz += dz * invD * maxSpeed * 1.9 * dt;
            }
          }

          // Directional boundary wrap vs local radius leash
          if (flightMode === 'directional' && flightPattern !== 'vFormation') {
            const along = a.x * dirX + a.z * dirZ;
            const lat = a.x * rightX + a.z * rightZ;
            const wrapSpan = radius * 1.6;
            if (along > wrapSpan) {
              a.x -= dirX * wrapSpan * 2;
              a.z -= dirZ * wrapSpan * 2;
            }
            if (Math.abs(lat) > radius * 0.95) {
              const pull = (Math.abs(lat) - radius * 0.95) * Math.sign(lat) * 2.8 * dt;
              a.vx -= rightX * pull;
              a.vz -= rightZ * pull;
            }
          } else if (flightPattern !== 'vFormation') {
            const curR = Math.hypot(a.x, a.z);
            if (curR > radius) {
              const pull = (curR - radius) * 3.4 * dt;
              a.vx -= (a.x / curR) * pull;
              a.vz -= (a.z / curR) * pull;
            }
          }

          // Maintain graceful cruise speed (birds stall if too slow)
          const spd = Math.hypot(a.vx, a.vy, a.vz);
          const minCruise = maxSpeed * 0.58;
          if (spd > maxSpeed) {
            const f = maxSpeed / spd;
            a.vx *= f;
            a.vy *= f;
            a.vz *= f;
          } else if (spd < minCruise && spd > 0.01) {
            const f = minCruise / spd;
            a.vx *= f;
            a.vy *= f;
            a.vz *= f;
          }

          a.x += a.vx * dt;
          a.y += a.vy * dt;
          a.z += a.vz * dt;

          // Keep flying birds comfortably above ground
          const minFlyY = groundLocalY + 0.85;
          if (a.y < minFlyY) {
            a.y = minFlyY;
            a.vy = Math.abs(a.vy) * 0.6 + 0.5;
          }
          if (a.y > maxH) {
            a.vy -= (a.y - maxH) * 2.0 * dt;
          }

          // Natural flap-and-glide rhythm for birds (longer soaring glides in circle mode)
          a.glideTimer -= dt;
          if (a.glideTimer <= 0) {
            a.isGliding = !a.isGliding;
            if (a.isGliding) {
              a.glideTimer =
                flightPattern === 'circle'
                  ? 1.8 + Math.random() * 2.4
                  : 0.75 + Math.random() * 1.15;
            } else {
              a.glideTimer =
                flightPattern === 'circle'
                  ? 0.9 + Math.random() * 1.0
                  : 1.4 + Math.random() * 2.0;
            }
          }
          // Climb forces active flapping
          if (a.vy > 0.45) a.isGliding = false;
        }
      } else {
        // Non-bird insects (bees, flies, butterflies, moths, fireflies)
        const dx = a.tx - a.x;
        const dy = a.ty - a.y;
        const dz = a.tz - a.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        if (distSq < 0.35 || Math.random() < dt * (0.45 + erratic * 1.6)) {
          const ang = Math.random() * Math.PI * 2;
          const r = Math.cbrt(Math.random()) * radius;
          a.tx = Math.cos(ang) * r;
          a.ty = (Math.random() - 0.5) * maxH;
          a.tz = Math.sin(ang) * r;
        }

        const invD = distSq > 0.001 ? 1 / Math.sqrt(distSq) : 0;
        const steer = 2.4 + erratic * 3.2;
        a.vx += dx * invD * maxSpeed * steer * dt;
        a.vy += dy * invD * maxSpeed * steer * 0.7 * dt;
        a.vz += dz * invD * maxSpeed * steer * dt;

        a.vx += -a.z * 0.55 * dt;
        a.vz += a.x * 0.55 * dt;

        if (erratic > 0.05) {
          a.vx += Math.sin(this.elapsed * 5.7 + a.phase * 3.1) * erratic * maxSpeed * 2.2 * dt;
          a.vy += Math.cos(this.elapsed * 6.3 + a.phase * 2.3) * erratic * maxSpeed * 1.4 * dt;
          a.vz += Math.cos(this.elapsed * 5.1 + a.phase * 4.1) * erratic * maxSpeed * 2.2 * dt;
        }

        const curR = Math.hypot(a.x, a.z);
        if (curR > radius) {
          const pull = (curR - radius) * 4.2 * dt;
          a.vx -= (a.x / curR) * pull;
          a.vz -= (a.z / curR) * pull;
        }

        const spd = Math.hypot(a.vx, a.vy, a.vz);
        if (spd > maxSpeed) {
          const f = maxSpeed / spd;
          a.vx *= f;
          a.vy *= f;
          a.vz *= f;
        }

        a.x += a.vx * dt;
        a.y += a.vy * dt;
        a.z += a.vz * dt;

        const minY = groundLocalY + 0.22;
        if (a.y < minY) {
          a.y = minY;
          a.vy = Math.abs(a.vy) * 0.5;
        }
      }

      // Advance wingbeat phase monotonically & compute symmetric flap angle!
      const isActivelyFlapping = !(isBird && (a.isGliding || a.birdState === 'landed'));
      if (isActivelyFlapping) {
        a.wingPhase += dt * cfg.flutterSpeed * flapRateMul;
      } else if (isBird && a.isGliding) {
        // Settle gently toward flat/slight-dihedral glide angle
        const targetGlide = Math.PI * 0.06;
        a.wingPhase = THREE.MathUtils.damp(Math.sin(a.wingPhase), Math.sin(targetGlide), 6, dt);
      }

      let flapAngle: number;
      if (wingFoldBlend > 0.5) {
        // Folded wings neatly tucked against body while perched
        flapAngle = -1.18;
      } else if (isBird && a.isGliding) {
        // Slight upward dihedral while soaring/gliding
        flapAngle = 0.14;
      } else if (isButterfly) {
        // Butterflies lift wings high above back (+1.0) and sweep gently below horizontal (-0.55)
        const s = Math.sin(a.wingPhase);
        flapAngle = (s * 0.8 + 0.22) * flapAmpRad;
      } else {
        flapAngle = Math.sin(a.wingPhase) * flapAmpRad;
      }

      // Subtle vertical bob synced to butterfly downstroke
      const bodyBobY = isButterfly ? -Math.sin(a.wingPhase) * sz * 0.16 : 0;

      // Smooth bank angle into turns (for birds & butterflies)
      const turnCross = prevVx * a.vz - prevVz * a.vx;
      const targetBank =
        wingFoldBlend > 0.5
          ? 0
          : THREE.MathUtils.clamp(turnCross * (isBird ? 0.22 : 0.12), -0.52, 0.52);
      a.bankAngle = THREE.MathUtils.damp(a.bankAngle, targetBank, 6.5, dt);

      // Compute clean upright yaw/pitch/bank orientation (avoids roll flip glitches from setFromUnitVectors)
      const horizSpd = Math.hypot(a.vx, a.vz);
      if (horizSpd > 0.05) {
        a.headingYaw = Math.atan2(a.vx, a.vz);
      }
      const pitch =
        wingFoldBlend > 0.5
          ? -0.06
          : THREE.MathUtils.clamp(-Math.atan2(a.vy, Math.max(0.4, horizSpd)) * 0.65, -0.55, 0.55);

      _euler.set(pitch, a.headingYaw, a.bankAngle, 'YXZ');
      _quat.setFromEuler(_euler);

      _dummy.position.set(a.x, a.y + bodyBobY, a.z);
      _dummy.quaternion.copy(_quat);
      _dummy.scale.setScalar(sz);
      _dummy.updateMatrix();
      this.critterBodyMesh.setMatrixAt(i, _dummy.matrix);

      // True symmetric Left & Right wing flapping around body centerline (+Z)!
      // Right wing (+X) rotates +flapAngle around Z -> tip lifts +Y.
      // Left wing (-X, mirrored geometry) rotates -flapAngle around Z -> tip lifts +Y identically!
      const wingScale = isBird ? sz * 1.15 : sz * 1.45;
      const wingOffsetY = isBird ? sz * 0.08 : sz * 0.06;
      const wingTuckScaleX = wingFoldBlend > 0.5 ? wingScale * 0.45 : wingScale;
      const wingFoldPitchY = wingFoldBlend > 0.5 ? 0.35 : 0;

      // Right wing
      _euler.set(0, -wingFoldPitchY, flapAngle, 'YXZ');
      _wingQuat.setFromEuler(_euler);
      _dummy.position.set(a.x, a.y + bodyBobY + wingOffsetY, a.z);
      _dummy.quaternion.copy(_quat).multiply(_wingQuat);
      _dummy.scale.set(wingTuckScaleX, wingScale, wingScale);
      _dummy.updateMatrix();
      this.critterRightWingMesh.setMatrixAt(i, _dummy.matrix);

      // Left wing (mirrored geometry -> negative Z rotation raises -X wingtip UP symmetrically!)
      _euler.set(0, wingFoldPitchY, -flapAngle, 'YXZ');
      _wingQuat.setFromEuler(_euler);
      _dummy.position.set(a.x, a.y + bodyBobY + wingOffsetY, a.z);
      _dummy.quaternion.copy(_quat).multiply(_wingQuat);
      _dummy.scale.set(wingTuckScaleX, wingScale, wingScale);
      _dummy.updateMatrix();
      this.critterLeftWingMesh.setMatrixAt(i, _dummy.matrix);

      if (glowOffsets && glowScales && glowColors) {
        const pulse =
          cfg.preset === 'fireflies'
            ? 0.25 + Math.pow(0.5 + 0.5 * Math.sin(this.elapsed * 2.6 + a.glowPhase), 2.4) * 0.95
            : 0.72 + Math.sin(this.elapsed * 4.5 + a.glowPhase) * 0.22;
        const gSz = sz * 3.8 * (0.75 + pulse * 0.45);
        _colMix.copy(_colStart).lerp(_colEnd, a.colorMix);

        glowOffsets[i * 3] = a.x;
        glowOffsets[i * 3 + 1] = a.y + bodyBobY;
        glowOffsets[i * 3 + 2] = a.z;
        glowScales[i * 2] = gSz;
        glowScales[i * 2 + 1] = gSz;
        glowColors[i * 4] = _colMix.r;
        glowColors[i * 4 + 1] = _colMix.g;
        glowColors[i * 4 + 2] = _colMix.b;
        glowColors[i * 4 + 3] = pulse;
      }
    }

    this.critterBodyMesh.instanceMatrix.needsUpdate = true;
    this.critterLeftWingMesh.instanceMatrix.needsUpdate = true;
    this.critterRightWingMesh.instanceMatrix.needsUpdate = true;
    if (this.critterGlowOffset && this.critterGlowScale && this.critterGlowColor) {
      this.critterGlowOffset.needsUpdate = true;
      this.critterGlowScale.needsUpdate = true;
      this.critterGlowColor.needsUpdate = true;
    }
  }

  public dispose(): void {
    this.clearPools();
    if (this.beacon) {
      this.group.remove(this.beacon);
      this.beacon.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
          else mesh.material.dispose();
        }
      });
    }
  }
}

export function buildFxEmitterFallbackGroup(entityId: string, config?: FxEmitterConfig): THREE.Group {
  const g = new THREE.Group();
  g.userData.entityId = entityId;
  const meta = getFxPresetMeta(config?.preset ?? 'fire');
  g.add(buildEditorBeacon(meta.accentHex));
  return g;
}
