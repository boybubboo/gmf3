import * as THREE from 'three';
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu';
import {
  Fn,
  abs,
  attribute,
  cos,
  float,
  instancedBufferAttribute,
  instancedDynamicBufferAttribute,
  positionLocal,
  sign,
  sin,
  uniform,
} from 'three/tsl';
import type { GameLevel } from '../types/maker';
import {
  getEnvironmentType,
  getTerrainRadius,
  IslandTerrain,
  sampleLevelHeight,
} from '../utils/terrain';

/**
 * Living GPU-Instanced Wildlife Flocking & Cave Ambient System.
 *
 * Renders three ecological layers in 3 single draw calls using TSL vertex animation:
 *  1. Sky Bird Flocks — sculpted 3D birds soaring & banking gracefully in thermals with
 *     realistic flap-and-glide cycles and true hinged shoulder + flexible wingtip TSL animation
 *  2. River & Cove Fish Schools — darting organically below water with TSL tail-swim wiggle + hero scatter
 *  3. Cave Fireflies / Bioluminescent Spores — floating inside carved mountain caves
 *
 * Uses zero per-frame JS allocations and clean full GPU disposal.
 */

interface BirdAgent {
  px: number;
  py: number;
  pz: number;
  vx: number;
  vy: number;
  vz: number;
  homeX: number;
  homeZ: number;
  orbitDir: number;
  cruiseOffset: number;
  scale: number;
  headingYaw: number;
  pitch: number;
  bankRoll: number;
  /** Flap-and-glide rhythm state */
  isGliding: boolean;
  glideTimer: number;
  wingPhase: number;
  flapRate: number;
  wingAngle: number;
  wingTipLag: number;
  altPhase: number;
  altSpeed: number;
}

interface FishAgent {
  px: number;
  py: number;
  pz: number;
  vx: number;
  vz: number;
  homeX: number;
  homeZ: number;
  depth: number;
  scale: number;
}

interface FireflyAgent {
  baseX: number;
  baseY: number;
  baseZ: number;
  phase: number;
  radius: number;
  speed: number;
  scale: number;
}

const BIRD_SHOULDER_X = 0.085;

/**
 * Builds a clean, watertight 3D stylized soaring bird facing +Z:
 *  - Sculpted tapered fuselage (beak -> head -> plump chest -> tail base)
 *  - Fanned V-tail feathers
 *  - Continuous cambered left & right wings (inner arm + swept outer primaries, zero gaps)
 *  - Vertex colors (warm pale belly, shaded charcoal wingtips & tail for crisp sky contrast)
 *  - Per-vertex `aWingWeight` (0 on torso/head/tail, smooth ramp across inner & outer wing)
 */
function createStylizedBirdGeometry(): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const wingW: number[] = [];

  const pushTri = (
    ax: number, ay: number, az: number, ca: [number, number, number], wa: number,
    bx: number, by: number, bz: number, cb: [number, number, number], wb: number,
    cx: number, cy: number, cz: number, cc: [number, number, number], wc: number
  ) => {
    pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    col.push(ca[0], ca[1], ca[2], cb[0], cb[1], cb[2], cc[0], cc[1], cc[2]);
    wingW.push(wa, wb, wc);
  };

  // Neutral-white tinted vertex colors so per-instance setColorAt multiplies cleanly
  const cBack: [number, number, number] = [0.96, 0.97, 0.99];
  const cBelly: [number, number, number] = [0.84, 0.87, 0.91];
  const cHead: [number, number, number] = [0.92, 0.94, 0.97];
  const cBeak: [number, number, number] = [0.95, 0.72, 0.34];
  const cWingMid: [number, number, number] = [0.88, 0.90, 0.94];
  const cWingTip: [number, number, number] = [0.34, 0.38, 0.46];
  const cTail: [number, number, number] = [0.46, 0.50, 0.58];

  // Key fuselage landmarks (+Z forward, +Y up)
  const beak: [number, number, number] = [0, 0.018, 0.44];
  const headTop: [number, number, number] = [0, 0.075, 0.27];
  const headBot: [number, number, number] = [0, -0.025, 0.26];
  const headL: [number, number, number] = [-0.048, 0.025, 0.25];
  const headR: [number, number, number] = [0.048, 0.025, 0.25];

  const chestTop: [number, number, number] = [0, 0.088, 0.04];
  const chestBot: [number, number, number] = [0, -0.072, 0.05];
  const shL: [number, number, number] = [-BIRD_SHOULDER_X, 0.024, 0.06];
  const shR: [number, number, number] = [BIRD_SHOULDER_X, 0.024, 0.06];

  const rumpTop: [number, number, number] = [0, 0.042, -0.24];
  const rumpBot: [number, number, number] = [0, -0.022, -0.23];
  const rumpL: [number, number, number] = [-0.052, 0.012, -0.22];
  const rumpR: [number, number, number] = [0.052, 0.012, -0.22];

  // Beak pyramid
  pushTri(...beak, cBeak, 0, ...headTop, cHead, 0, ...headL, cHead, 0);
  pushTri(...beak, cBeak, 0, ...headR, cHead, 0, ...headTop, cHead, 0);
  pushTri(...beak, cBeak, 0, ...headL, cHead, 0, ...headBot, cBelly, 0);
  pushTri(...beak, cBeak, 0, ...headBot, cBelly, 0, ...headR, cHead, 0);

  // Head -> Chest torso loft
  pushTri(...headTop, cHead, 0, ...chestTop, cBack, 0, ...headL, cHead, 0);
  pushTri(...chestTop, cBack, 0, ...shL, cBack, 0, ...headL, cHead, 0);
  pushTri(...headTop, cHead, 0, ...headR, cHead, 0, ...chestTop, cBack, 0);
  pushTri(...chestTop, cBack, 0, ...headR, cHead, 0, ...shR, cBack, 0);

  pushTri(...headL, cHead, 0, ...shL, cBelly, 0, ...headBot, cBelly, 0);
  pushTri(...shL, cBelly, 0, ...chestBot, cBelly, 0, ...headBot, cBelly, 0);
  pushTri(...headR, cHead, 0, ...headBot, cBelly, 0, ...shR, cBelly, 0);
  pushTri(...shR, cBelly, 0, ...headBot, cBelly, 0, ...chestBot, cBelly, 0);

  // Chest -> Rump torso loft
  pushTri(...chestTop, cBack, 0, ...rumpTop, cBack, 0, ...shL, cBack, 0);
  pushTri(...rumpTop, cBack, 0, ...rumpL, cBack, 0, ...shL, cBack, 0);
  pushTri(...chestTop, cBack, 0, ...shR, cBack, 0, ...rumpTop, cBack, 0);
  pushTri(...rumpTop, cBack, 0, ...shR, cBack, 0, ...rumpR, cBack, 0);

  pushTri(...shL, cBelly, 0, ...rumpL, cBelly, 0, ...chestBot, cBelly, 0);
  pushTri(...rumpL, cBelly, 0, ...rumpBot, cBelly, 0, ...chestBot, cBelly, 0);
  pushTri(...shR, cBelly, 0, ...chestBot, cBelly, 0, ...rumpR, cBelly, 0);
  pushTri(...rumpR, cBelly, 0, ...chestBot, cBelly, 0, ...rumpBot, cBelly, 0);

  // Forked swallowtail fan (double-sided via top + underside)
  const tailL: [number, number, number] = [-0.14, 0.022, -0.50];
  const tailMid: [number, number, number] = [0, 0.016, -0.42];
  const tailR: [number, number, number] = [0.14, 0.022, -0.50];
  pushTri(...rumpL, cTail, 0, ...tailL, cTail, 0, ...tailMid, cTail, 0);
  pushTri(...rumpL, cTail, 0, ...tailMid, cTail, 0, ...rumpTop, cBack, 0);
  pushTri(...rumpTop, cBack, 0, ...tailMid, cTail, 0, ...rumpR, cTail, 0);
  pushTri(...rumpR, cTail, 0, ...tailMid, cTail, 0, ...tailR, cTail, 0);
  // Tail underside
  pushTri(...rumpL, cTail, 0, ...tailMid, cTail, 0, ...tailL, cTail, 0);
  pushTri(...rumpR, cTail, 0, ...tailR, cTail, 0, ...tailMid, cTail, 0);

  // Continuous 2-segment swept gull/hawk wings (mirrored cleanly for left & right)
  const addWing = (side: -1 | 1) => {
    const rootLead: [number, number, number] = [side * BIRD_SHOULDER_X, 0.032, 0.14];
    const rootTrail: [number, number, number] = [side * BIRD_SHOULDER_X, 0.016, -0.15];
    const elbowLead: [number, number, number] = [side * 0.44, 0.056, 0.06];
    const elbowTrail: [number, number, number] = [side * 0.42, 0.026, -0.19];
    const tipLead: [number, number, number] = [side * 0.92, 0.028, -0.14];
    const tipTrail: [number, number, number] = [side * 0.80, 0.018, -0.25];

    if (side === 1) {
      // Inner wing quad (2 connected tris)
      pushTri(...rootLead, cBack, 0.02, ...rootTrail, cBack, 0.02, ...elbowLead, cWingMid, 0.48);
      pushTri(...elbowLead, cWingMid, 0.48, ...rootTrail, cBack, 0.02, ...elbowTrail, cWingMid, 0.46);
      // Outer primary wing quad (shares exact elbowLead & elbowTrail vertices -> zero gap!)
      pushTri(...elbowLead, cWingMid, 0.48, ...elbowTrail, cWingMid, 0.46, ...tipLead, cWingTip, 1.0);
      pushTri(...tipLead, cWingTip, 1.0, ...elbowTrail, cWingMid, 0.46, ...tipTrail, cWingTip, 0.92);
    } else {
      pushTri(...rootLead, cBack, 0.02, ...elbowLead, cWingMid, 0.48, ...rootTrail, cBack, 0.02);
      pushTri(...elbowLead, cWingMid, 0.48, ...elbowTrail, cWingMid, 0.46, ...rootTrail, cBack, 0.02);
      pushTri(...elbowLead, cWingMid, 0.48, ...tipLead, cWingTip, 1.0, ...elbowTrail, cWingMid, 0.46);
      pushTri(...tipLead, cWingTip, 1.0, ...tipTrail, cWingTip, 0.92, ...elbowTrail, cWingMid, 0.46);
    }
  };
  addWing(-1);
  addWing(1);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('aWingWeight', new THREE.Float32BufferAttribute(wingW, 1));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

function createStylizedFishGeometry(): THREE.BufferGeometry {
  // Sleek diamond body + forked tail (tail Z < 0 drives TSL sinusoidal swim wiggle)
  const positions = new Float32Array([
    // Top dorsal diamond
    0, 0.09, 0.26, -0.08, 0, -0.06, 0.08, 0, -0.06,
    0, 0.09, 0.26, 0.08, 0, -0.06, 0, 0.02, -0.26,
    0, 0.09, 0.26, 0, 0.02, -0.26, -0.08, 0, -0.06,
    // Tail fin
    0, 0.02, -0.22, 0, 0.12, -0.44, 0, -0.1, -0.44,
    0, 0.02, -0.22, 0, -0.1, -0.44, 0, 0.12, -0.44,
  ]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

export class WildlifeFlockingSystem {
  public readonly group = new THREE.Group();

  private readonly level: GameLevel;
  private readonly uTime = uniform(0);
  private birdMesh: THREE.InstancedMesh | null = null;
  private birdFlapAttr: THREE.InstancedBufferAttribute | null = null;
  private fishMesh: THREE.InstancedMesh | null = null;
  private fireflyMesh: THREE.InstancedMesh | null = null;

  private readonly birds: BirdAgent[] = [];
  private readonly fishes: FishAgent[] = [];
  private readonly fireflies: FireflyAgent[] = [];

  private readonly _dummy = new THREE.Object3D();
  private readonly _lookTarget = new THREE.Vector3();
  private readonly _euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private disposed = false;

  constructor(level: GameLevel, densityScale = 1.0) {
    this.level = level;
    this.group.name = 'maker-wildlife-flocking';
    const env = getEnvironmentType(level);
    if (env === 'dungeon') return;

    const terrain = level.terrain;
    const worldR = Math.min(terrain ? getTerrainRadius(terrain) : 78, 130);
    const scaleClamp = THREE.MathUtils.clamp(densityScale, 0.35, 1.5);

    this.initBirds(level, worldR, Math.round(24 * scaleClamp));
    this.initFish(level, worldR, Math.round(26 * scaleClamp));
    this.initCaveFireflies(level, Math.round(36 * scaleClamp));
  }

  private initBirds(level: GameLevel, worldR: number, count: number): void {
    if (count <= 0) return;
    const geo = createStylizedBirdGeometry();
    // Per-instance live wing articulation: (innerWingAngleRad, outerTipLagRad)
    const flapData = new Float32Array(count * 2);
    const flapAttr = new THREE.InstancedBufferAttribute(flapData, 2);
    flapAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aFlapState', flapAttr);
    this.birdFlapAttr = flapAttr;

    const mat = new MeshStandardNodeMaterial({
      color: '#FFFFFF',
      vertexColors: true,
      roughness: 0.72,
      metalness: 0.04,
      side: THREE.DoubleSide,
    });

    // True hinged shoulder rotation + subtle flexible primary-feather wingtip lag (zero stretching!)
    const flapNode = instancedDynamicBufferAttribute<'vec2'>(flapAttr, 'vec2');
    mat.positionNode = Fn(() => {
      const p = positionLocal.toVar();
      const w = attribute('aWingWeight', 'float');
      const shoulder = float(BIRD_SHOULDER_X);

      // Side sign (-1 left, +1 right) and horizontal span beyond the shoulder hinge
      const sideSign = sign(p.x);
      const span = abs(p.x).sub(shoulder).max(0.0);

      // Inner wing rotates cleanly around shoulder; outer primaries add subtle delayed flex
      const outerWeight = w.sub(0.45).max(0.0).mul(1.8);
      const angle = flapNode.x.add(flapNode.y.mul(outerWeight));

      const ca = cos(angle);
      const sa = sin(angle);
      const hingedSpan = span.mul(ca);
      const hingedLift = span.mul(sa);

      // Only displace vertices with wing weight > 0 (torso, head, beak & tail stay 100% rigid!)
      const mask = w.mul(40.0).clamp(0.0, 1.0);
      p.x.assign(p.x.mul(float(1.0).sub(mask)).add(sideSign.mul(shoulder.add(hingedSpan)).mul(mask)));
      p.y.addAssign(hingedLift.mul(mask));
      return p;
    })();

    const inst = new THREE.InstancedMesh(geo, mat, count);
    inst.castShadow = false;
    inst.receiveShadow = false;
    inst.frustumCulled = false;

    const flockCenters = [
      { x: -worldR * 0.28, z: -worldR * 0.24, dir: 1 },
      { x: worldR * 0.30, z: worldR * 0.18, dir: -1 },
      { x: 0, z: -worldR * 0.36, dir: 1 },
    ];
    const palette = [
      new THREE.Color('#F8FAFC'), // Crisp gull ivory
      new THREE.Color('#E2E8F0'), // Soft sky dove
      new THREE.Color('#F5EFE6'), // Warm cream seabird
      new THREE.Color('#D6CFC2'), // Woodland kestrel sand
    ];

    for (let i = 0; i < count; i++) {
      const fc = flockCenters[i % flockCenters.length];
      const ang = (i / count) * Math.PI * 2 + (i % 3) * 0.65;
      const rad = 14 + (i % 6) * 5.2;
      const px = fc.x + Math.cos(ang) * rad;
      const pz = fc.z + Math.sin(ang) * rad;
      const groundY = sampleLevelHeight(level, px, pz);
      const cruiseOffset = 15.5 + (i % 5) * 3.1;
      const py = Math.max(18, groundY + cruiseOffset);
      const speed = 6.2 + (i % 4) * 0.75;
      const vx = -Math.sin(ang) * speed * fc.dir;
      const vz = Math.cos(ang) * speed * fc.dir;
      const startGliding = i % 3 !== 0;

      this.birds.push({
        px,
        py,
        pz,
        vx,
        vy: 0,
        vz,
        homeX: fc.x,
        homeZ: fc.z,
        orbitDir: fc.dir,
        cruiseOffset,
        scale: 0.78 + (i % 5) * 0.11,
        headingYaw: Math.atan2(vx, vz),
        pitch: 0,
        bankRoll: 0,
        isGliding: startGliding,
        glideTimer: startGliding ? 1.8 + (i % 5) * 0.8 : 1.0 + (i % 4) * 0.45,
        wingPhase: i * 1.37,
        flapRate: 4.1 + (i % 4) * 0.32,
        wingAngle: 0.12,
        wingTipLag: 0,
        altPhase: i * 1.13,
        altSpeed: 0.2 + (i % 4) * 0.04,
      });

      flapData[i * 2] = 0.12;
      flapData[i * 2 + 1] = 0;
      inst.setColorAt(i, palette[i % palette.length]);
    }
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    flapAttr.needsUpdate = true;
    this.birdMesh = inst;
    this.group.add(inst);
  }

  private initFish(level: GameLevel, worldR: number, count: number): void {
    if (count <= 0) return;
    const waterY = IslandTerrain.waterLevel;
    // Find genuine underwater spots (rivers, lakes, shoreline coves)
    const waterSpots: Array<{ x: number; z: number; bedY: number }> = [];
    for (let i = 0; i < 180; i++) {
      const ang = i * 2.39996;
      const r = 10 + ((i * 19.3) % Math.max(18, worldR * 0.92));
      const x = Math.cos(ang) * r;
      const z = Math.sin(ang) * r;
      const h = sampleLevelHeight(level, x, z);
      if (h < waterY - 0.75) {
        waterSpots.push({ x, z, bedY: h });
        if (waterSpots.length >= 24) break;
      }
    }
    if (waterSpots.length === 0) return;

    const actualCount = Math.min(count, waterSpots.length * 4);
    const geo = createStylizedFishGeometry();
    const phases = new Float32Array(actualCount);
    for (let i = 0; i < actualCount; i++) {
      phases[i] = i * 2.13;
    }
    const fishPhaseAttr = new THREE.InstancedBufferAttribute(phases, 1);
    geo.setAttribute('aPhase', fishPhaseAttr);

    const uTime = this.uTime;
    const mat = new MeshStandardNodeMaterial({
      color: '#F59E0B',
      roughness: 0.35,
      metalness: 0.25,
      side: THREE.DoubleSide,
    });
    // GPU TSL sinusoidal tail-swimming wiggle (strictly per-instance phase)
    const fishPhaseNode = instancedBufferAttribute<'float'>(fishPhaseAttr, 'float');
    mat.positionNode = Fn(() => {
      const p = positionLocal.toVar();
      const tailFactor = positionLocal.z.negate().max(0.0);
      p.x.addAssign(sin(uTime.mul(10.5).add(fishPhaseNode)).mul(tailFactor).mul(0.28));
      return p;
    })();

    const inst = new THREE.InstancedMesh(geo, mat, actualCount);
    inst.castShadow = false;
    inst.receiveShadow = false;
    inst.frustumCulled = false;

    const fishPalette = [
      new THREE.Color('#F97316'),
      new THREE.Color('#FACC15'),
      new THREE.Color('#38BDF8'),
      new THREE.Color('#FB7185'),
      new THREE.Color('#E2E8F0'),
    ];

    for (let i = 0; i < actualCount; i++) {
      const spot = waterSpots[i % waterSpots.length];
      const ang = (i * 1.9) % (Math.PI * 2);
      const px = spot.x + Math.cos(ang) * 1.8;
      const pz = spot.z + Math.sin(ang) * 1.8;
      const depth = Math.min(
        waterY - 0.32,
        Math.max(spot.bedY + 0.3, waterY - 0.65 - (i % 3) * 0.25)
      );
      this.fishes.push({
        px,
        py: depth,
        pz,
        vx: Math.cos(ang) * 1.8,
        vz: Math.sin(ang) * 1.8,
        homeX: spot.x,
        homeZ: spot.z,
        depth,
        scale: 0.65 + (i % 4) * 0.14,
      });
      inst.setColorAt(i, fishPalette[i % fishPalette.length]);
    }
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    this.fishMesh = inst;
    this.group.add(inst);
  }

  private initCaveFireflies(level: GameLevel, maxCount: number): void {
    const caves = level.terrain?.caves ?? [];
    const anchors: Array<{ x: number; y: number; z: number; r: number }> = [];
    for (let c = 0; c < caves.length; c++) {
      const cave = caves[c];
      const nodes = cave.tunnelNodes ?? [];
      if (nodes.length > 0) {
        const baseY = cave.floorElevation ?? nodes[0].floorY ?? 1.5;
        for (let i = 0; i < nodes.length; i += Math.max(1, Math.floor(nodes.length / 6))) {
          const n = nodes[i];
          anchors.push({
            x: n.x,
            y: (n.floorY ?? baseY) + (n.height ?? 4.2) * 0.45,
            z: n.z,
            r: Math.max(1.5, (n.radius ?? 4) * 0.65),
          });
        }
      } else {
        anchors.push({
          x: cave.x,
          y: (cave.floorElevation ?? 1.5) + 1.8,
          z: cave.z,
          r: Math.max(2.0, (cave.cavityWidth ?? 1.0) * (cave.scale ?? 1.0) * 3.0),
        });
      }
    }
    if (anchors.length === 0) return;

    const count = Math.min(maxCount, anchors.length * 5);
    const geo = new THREE.OctahedronGeometry(0.085, 0);
    const mat = new MeshBasicNodeMaterial({
      color: '#FFFFFF',
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const uTime = this.uTime;
    const phases = new Float32Array(count);
    for (let i = 0; i < count; i++) phases[i] = i * 1.71;
    const fireflyPhaseAttr = new THREE.InstancedBufferAttribute(phases, 1);
    geo.setAttribute('aPhase', fireflyPhaseAttr);
    // Soft bioluminescent pulse in GPU vertex shader (strictly per-instance phase)
    const fireflyPhaseNode = instancedBufferAttribute<'float'>(fireflyPhaseAttr, 'float');
    mat.positionNode = Fn(() => {
      const pulse = sin(uTime.mul(3.1).add(fireflyPhaseNode)).mul(0.32).add(0.88);
      return positionLocal.mul(pulse);
    })();

    const inst = new THREE.InstancedMesh(geo, mat, count);
    inst.castShadow = false;
    inst.receiveShadow = false;
    inst.frustumCulled = false;

    const glowPalette = [
      new THREE.Color('#FDE68A'),
      new THREE.Color('#67E8F9'),
      new THREE.Color('#A7F3D0'),
    ];

    for (let i = 0; i < count; i++) {
      const a = anchors[i % anchors.length];
      this.fireflies.push({
        baseX: a.x,
        baseY: a.y + ((i % 3) - 1) * 0.6,
        baseZ: a.z,
        phase: i * 1.93,
        radius: a.r * (0.45 + ((i * 7) % 5) * 0.12),
        speed: 0.45 + (i % 4) * 0.18,
        scale: 0.75 + (i % 3) * 0.25,
      });
      inst.setColorAt(i, glowPalette[i % glowPalette.length]);
    }
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    this.fireflyMesh = inst;
    this.group.add(inst);
  }

  public update(
    dt: number,
    elapsed: number,
    heroPos?: THREE.Vector3 | null
  ): void {
    if (this.disposed) return;
    this.uTime.value = elapsed;
    const safeDt = Math.min(0.05, Math.max(0.001, dt));

    // 1. Update Sky Bird Flocks (smooth continuous boids + thermal soaring + banking + flap-and-glide)
    if (this.birdMesh && this.birdFlapAttr && this.birds.length > 0) {
      const n = this.birds.length;
      const flapArr = this.birdFlapAttr.array as Float32Array;
      const sepRadius = 6.2;
      const sepRadiusSq = sepRadius * sepRadius;

      for (let i = 0; i < n; i++) {
        const b = this.birds[i];
        const prevVx = b.vx;
        const prevVz = b.vz;

        let sepX = 0;
        let sepZ = 0;
        let cohX = 0;
        let cohZ = 0;
        let aliX = 0;
        let aliZ = 0;
        let neighbors = 0;

        // Lightweight neighbor stride check with smooth quadratic separation (no sudden jolts)
        for (let k = 1; k <= 5; k++) {
          const other = this.birds[(i + k * 3) % n];
          const dx = b.px - other.px;
          const dz = b.pz - other.pz;
          const d2 = dx * dx + dz * dz;
          if (d2 > 0.04 && d2 < 260) {
            neighbors++;
            cohX += other.px;
            cohZ += other.pz;
            aliX += other.vx;
            aliZ += other.vz;
            if (d2 < sepRadiusSq) {
              const dist = Math.sqrt(d2);
              const w = 1 - dist / sepRadius;
              const push = w * w * 2.4;
              sepX += (dx / dist) * push;
              sepZ += (dz / dist) * push;
            }
          }
        }

        // Smooth thermal soaring orbit around home center
        const toHomeX = b.homeX - b.px;
        const toHomeZ = b.homeZ - b.pz;
        const homeDist = Math.hypot(toHomeX, toHomeZ);
        const preferredOrbitR = 22 + (i % 5) * 4.5;

        let ax = sepX * 3.2;
        let az = sepZ * 3.2;
        if (neighbors > 0) {
          ax += (cohX / neighbors - b.px) * 0.14 + (aliX / neighbors - b.vx) * 0.42;
          az += (cohZ / neighbors - b.pz) * 0.14 + (aliZ / neighbors - b.vz) * 0.42;
        }

        // Gentle radial leash back toward preferred thermal ring + tangential glide swirl
        const radialErr = homeDist - preferredOrbitR;
        if (homeDist > 1.5) {
          const invH = 1 / homeDist;
          const pull = THREE.MathUtils.clamp(radialErr * 0.14, -1.6, 2.8);
          ax += toHomeX * invH * pull;
          az += toHomeZ * invH * pull;
          // Tangential swirl matching flock's clockwise/counter-clockwise thermal direction
          ax += (-toHomeZ * invH) * b.orbitDir * 1.45;
          az += (toHomeX * invH) * b.orbitDir * 1.45;
        }

        b.vx += ax * safeDt;
        b.vz += az * safeDt;
        const spd = Math.hypot(b.vx, b.vz);
        const targetSpd = b.isGliding ? 6.6 : 7.4;
        const clampedSpd = THREE.MathUtils.damp(
          THREE.MathUtils.clamp(spd, 5.2, 8.8),
          targetSpd,
          1.8,
          safeDt
        );
        if (spd > 0.01) {
          b.vx = (b.vx / spd) * clampedSpd;
          b.vz = (b.vz / spd) * clampedSpd;
        }

        // Dynamic terrain clearance + slow, serene thermal altitude drift (never violent bouncing!)
        const groundY = sampleLevelHeight(this.level, b.px, b.pz);
        const safeFloorY = Math.max(16.5, groundY + 13.5);
        const desiredY =
          Math.max(safeFloorY, groundY + b.cruiseOffset) +
          Math.sin(elapsed * b.altSpeed + b.altPhase) * 0.95;
        const targetVy = THREE.MathUtils.clamp((desiredY - b.py) * 0.45, -1.35, 1.35);
        b.vy = THREE.MathUtils.damp(b.vy, targetVy, 2.2, safeDt);

        b.px += b.vx * safeDt;
        b.py += b.vy * safeDt;
        b.pz += b.vz * safeDt;

        // Flap-and-glide state machine (a few calm wingbeats followed by long soaring glides)
        b.glideTimer -= safeDt;
        if (b.glideTimer <= 0) {
          b.isGliding = !b.isGliding;
          b.glideTimer = b.isGliding
            ? 2.8 + ((i * 13 + Math.floor(elapsed * 7)) % 7) * 0.45
            : 1.35 + ((i * 7 + Math.floor(elapsed * 5)) % 5) * 0.25;
        }
        // Climbing gently triggers active wingbeats
        const activelyFlapping = !b.isGliding || b.vy > 0.55;
        if (activelyFlapping) {
          const climbBoost = b.vy > 0.35 ? 1.22 : 1.0;
          b.wingPhase += safeDt * b.flapRate * Math.PI * 2 * 0.38 * climbBoost;
          // Natural asymmetric wingbeat (slightly fuller downstroke than upstroke)
          const s = Math.sin(b.wingPhase);
          const targetAngle = s * 0.46 + 0.05;
          const targetTipLag = -Math.cos(b.wingPhase) * 0.24;
          b.wingAngle = THREE.MathUtils.damp(b.wingAngle, targetAngle, 12, safeDt);
          b.wingTipLag = THREE.MathUtils.damp(b.wingTipLag, targetTipLag, 10, safeDt);
        } else {
          // Graceful soaring dihedral (wings held steadily slightly upward with tiny breeze flex)
          const glideDihedral = 0.13 + Math.sin(elapsed * 1.1 + b.altPhase) * 0.025;
          b.wingAngle = THREE.MathUtils.damp(b.wingAngle, glideDihedral, 5.5, safeDt);
          b.wingTipLag = THREE.MathUtils.damp(b.wingTipLag, 0.05, 5.5, safeDt);
        }

        flapArr[i * 2] = b.wingAngle;
        flapArr[i * 2 + 1] = b.wingTipLag;

        // Smooth aerodynamic orientation (yaw + gentle pitch + banking roll into turns)
        const desiredYaw = Math.atan2(b.vx, b.vz);
        let dYaw = desiredYaw - b.headingYaw;
        while (dYaw > Math.PI) dYaw -= Math.PI * 2;
        while (dYaw < -Math.PI) dYaw += Math.PI * 2;
        b.headingYaw += dYaw * Math.min(1, safeDt * 5.5);

        const desiredPitch = THREE.MathUtils.clamp(
          -Math.atan2(b.vy, Math.max(2.0, clampedSpd)) * 0.55,
          -0.24,
          0.24
        );
        b.pitch = THREE.MathUtils.damp(b.pitch, desiredPitch, 4.5, safeDt);

        const turnCross = (prevVx * b.vz - prevVz * b.vx) / Math.max(0.001, safeDt);
        const desiredBank = THREE.MathUtils.clamp(-turnCross * 0.016, -0.48, 0.48);
        b.bankRoll = THREE.MathUtils.damp(b.bankRoll, desiredBank, 4.0, safeDt);

        // Tiny subtle body counter-lift synced to active wing downstroke (max ±3.5cm)
        const flapBodyLift = activelyFlapping ? -Math.sin(b.wingAngle) * 0.035 * b.scale : 0;

        this._dummy.position.set(b.px, b.py + flapBodyLift, b.pz);
        this._euler.set(b.pitch, b.headingYaw, b.bankRoll, 'YXZ');
        this._dummy.quaternion.setFromEuler(this._euler);
        this._dummy.scale.setScalar(b.scale);
        this._dummy.updateMatrix();
        this.birdMesh.setMatrixAt(i, this._dummy.matrix);
      }
      this.birdMesh.instanceMatrix.needsUpdate = true;
      this.birdFlapAttr.needsUpdate = true;
    }

    // 2. Update River/Cove Fish Schools (with live hero scatter reaction!)
    if (this.fishMesh && this.fishes.length > 0) {
      const n = this.fishes.length;
      const hx = heroPos?.x ?? 99999;
      const hz = heroPos?.z ?? 99999;
      for (let i = 0; i < n; i++) {
        const f = this.fishes[i];
        let ax = Math.sin(elapsed * 0.9 + i * 2.1) * 0.6;
        let az = Math.cos(elapsed * 0.8 + i * 1.7) * 0.6;

        // Home pool tether so fish stay in deep water
        const toHX = f.homeX - f.px;
        const toHZ = f.homeZ - f.pz;
        const hd = Math.hypot(toHX, toHZ);
        if (hd > 4.2) {
          ax += (toHX / hd) * 3.6;
          az += (toHZ / hd) * 3.6;
        }

        // Dart away quickly when the hero wades or swims nearby
        const fdx = f.px - hx;
        const fdz = f.pz - hz;
        const fd2 = fdx * fdx + fdz * fdz;
        if (fd2 < 36 && fd2 > 0.01) {
          const fd = Math.sqrt(fd2);
          const panic = (1 - fd / 6) * 9.5;
          ax += (fdx / fd) * panic;
          az += (fdz / fd) * panic;
        }

        f.vx += ax * safeDt;
        f.vz += az * safeDt;
        const spd = Math.hypot(f.vx, f.vz);
        const clamped = THREE.MathUtils.clamp(spd, 1.2, fd2 < 36 ? 4.8 : 2.5);
        if (spd > 0.01) {
          f.vx = (f.vx / spd) * clamped;
          f.vz = (f.vz / spd) * clamped;
        }
        f.px += f.vx * safeDt;
        f.pz += f.vz * safeDt;

        this._dummy.position.set(
          f.px,
          f.depth + Math.sin(elapsed * 1.8 + i) * 0.08,
          f.pz
        );
        this._lookTarget.set(f.px + f.vx, this._dummy.position.y, f.pz + f.vz);
        this._dummy.lookAt(this._lookTarget);
        this._dummy.scale.setScalar(f.scale);
        this._dummy.updateMatrix();
        this.fishMesh.setMatrixAt(i, this._dummy.matrix);
      }
      this.fishMesh.instanceMatrix.needsUpdate = true;
    }

    // 3. Update Cave Fireflies / Bioluminescent Spores
    if (this.fireflyMesh && this.fireflies.length > 0) {
      for (let i = 0; i < this.fireflies.length; i++) {
        const ff = this.fireflies[i];
        const t = elapsed * ff.speed + ff.phase;
        this._dummy.position.set(
          ff.baseX + Math.cos(t) * ff.radius,
          ff.baseY + Math.sin(t * 1.4) * 0.55,
          ff.baseZ + Math.sin(t * 0.85) * ff.radius
        );
        this._dummy.rotation.set(0, t, 0);
        this._dummy.scale.setScalar(ff.scale);
        this._dummy.updateMatrix();
        this.fireflyMesh.setMatrixAt(i, this._dummy.matrix);
      }
      this.fireflyMesh.instanceMatrix.needsUpdate = true;
    }
  }

  public dispose(): void {
    this.disposed = true;
    const disposeInst = (mesh: THREE.InstancedMesh | null) => {
      if (!mesh) return;
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      } else {
        mesh.material.dispose();
      }
      mesh.dispose();
    };
    disposeInst(this.birdMesh);
    disposeInst(this.fishMesh);
    disposeInst(this.fireflyMesh);
    this.birdMesh = null;
    this.birdFlapAttr = null;
    this.fishMesh = null;
    this.fireflyMesh = null;
    this.birds.length = 0;
    this.fishes.length = 0;
    this.fireflies.length = 0;
    this.group.clear();
  }
}
