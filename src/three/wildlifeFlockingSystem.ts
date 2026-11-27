import * as THREE from 'three';
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu';
import {
  Fn,
  instancedBufferAttribute,
  positionLocal,
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
 * Renders three ecological layers:
 *  1. Sky Bird Flocks — 3-mesh rigid-wing sculpted avian flocks (body + mirrored left/right hinged
 *     feathered wings, matching the smooth FX spawner bird rig) soaring calmly on steady thermal
 *     altitudes with natural flap-and-glide cycles and gentle banking (zero bobbing or vertex glitches)
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
  /** Precomputed stable thermal soaring altitude well above highest terrain along the orbit ring */
  baseAltY: number;
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
  // Streamlined bird body facing +Z (beak at +Z, fanned tail at -Z), matching FX spawner birds
  const positions: number[] = [];
  const pushTri = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number]
  ) => {
    positions.push(...a, ...b, ...c);
  };

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
  geo.computeBoundingSphere();
  return geo;
}

function buildBirdRightWingGeometry(): THREE.BufferGeometry {
  // Swept feathered avian wing extending along +X, leading edge toward +Z, hinging at x = 0
  const ws = new THREE.Shape();
  ws.moveTo(0, 0.24);
  ws.quadraticCurveTo(0.52, 0.34, 1.15, 0.06);
  ws.quadraticCurveTo(1.55, -0.14, 1.75, -0.34);
  ws.quadraticCurveTo(1.22, -0.36, 0.82, -0.26);
  ws.quadraticCurveTo(0.42, -0.22, 0, -0.24);
  ws.closePath();
  const geo = new THREE.ShapeGeometry(ws, 5);
  geo.rotateX(Math.PI / 2);
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
  private birdBodyMesh: THREE.InstancedMesh | null = null;
  private birdLeftWingMesh: THREE.InstancedMesh | null = null;
  private birdRightWingMesh: THREE.InstancedMesh | null = null;
  private fishMesh: THREE.InstancedMesh | null = null;
  private fireflyMesh: THREE.InstancedMesh | null = null;

  private readonly birds: BirdAgent[] = [];
  private readonly fishes: FishAgent[] = [];
  private readonly fireflies: FireflyAgent[] = [];

  private readonly _dummy = new THREE.Object3D();
  private readonly _lookTarget = new THREE.Vector3();
  private readonly _euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly _quat = new THREE.Quaternion();
  private readonly _wingQuat = new THREE.Quaternion();
  private disposed = false;

  constructor(level: GameLevel, densityScale = 1.0) {
    this.level = level;
    this.group.name = 'maker-wildlife-flocking';
    const env = getEnvironmentType(level);
    if (env === 'dungeon') return;

    const terrain = level.terrain;
    const worldR = Math.min(terrain ? getTerrainRadius(terrain) : 78, 130);
    const scaleClamp = THREE.MathUtils.clamp(densityScale, 0.35, 1.5);

    this.initBirds(level, worldR, Math.round(20 * scaleClamp));
    this.initFish(level, worldR, Math.round(26 * scaleClamp));
    this.initCaveFireflies(level, Math.round(36 * scaleClamp));
  }

  private initBirds(level: GameLevel, worldR: number, count: number): void {
    if (count <= 0) return;

    const bodyGeo = buildSculptedBirdBodyGeometry();
    const rightWingGeo = buildBirdRightWingGeometry();
    const leftWingGeo = mirrorGeometryX(rightWingGeo);

    const bodyMat = new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      roughness: 0.62,
      metalness: 0.06,
      side: THREE.DoubleSide,
    });
    const wingMatL = new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      roughness: 0.58,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
    const wingMatR = wingMatL.clone();

    const bodyInst = new THREE.InstancedMesh(bodyGeo, bodyMat, count);
    const leftWingInst = new THREE.InstancedMesh(leftWingGeo, wingMatL, count);
    const rightWingInst = new THREE.InstancedMesh(rightWingGeo, wingMatR, count);
    bodyInst.castShadow = false;
    bodyInst.receiveShadow = false;
    bodyInst.frustumCulled = false;
    leftWingInst.castShadow = false;
    leftWingInst.receiveShadow = false;
    leftWingInst.frustumCulled = false;
    rightWingInst.castShadow = false;
    rightWingInst.receiveShadow = false;
    rightWingInst.frustumCulled = false;

    const flockCenters = [
      { x: -worldR * 0.28, z: -worldR * 0.24, dir: 1, ceilingY: 22 },
      { x: worldR * 0.30, z: worldR * 0.18, dir: -1, ceilingY: 22 },
      { x: 0, z: -worldR * 0.36, dir: 1, ceilingY: 22 },
    ];

    // Precompute a smooth, constant safe soaring ceiling above the highest terrain point
    // along each flock's entire flight ring so birds NEVER spike or bob over cliffs/hills!
    for (const fc of flockCenters) {
      let maxH = sampleLevelHeight(level, fc.x, fc.z);
      for (let s = 0; s < 16; s++) {
        const a = (s / 16) * Math.PI * 2;
        const h1 = sampleLevelHeight(level, fc.x + Math.cos(a) * 22, fc.z + Math.sin(a) * 22);
        const h2 = sampleLevelHeight(level, fc.x + Math.cos(a) * 38, fc.z + Math.sin(a) * 38);
        if (h1 > maxH) maxH = h1;
        if (h2 > maxH) maxH = h2;
      }
      fc.ceilingY = Math.max(18.5, maxH + 11.5);
    }

    const bodyPalette = [
      new THREE.Color('#F8FAFC'), // Crisp gull ivory
      new THREE.Color('#E2E8F0'), // Soft sky dove
      new THREE.Color('#F5EFE6'), // Warm cream seabird
      new THREE.Color('#DDD6C7'), // Woodland kestrel sand
    ];
    const wingPalette = [
      new THREE.Color('#94A3B8'), // Slate gull wing
      new THREE.Color('#64748B'), // Deep slate wing
      new THREE.Color('#A89F91'), // Warm taupe wing
      new THREE.Color('#475569'), // Charcoal wingtip tone
    ];

    for (let i = 0; i < count; i++) {
      const fc = flockCenters[i % flockCenters.length];
      const ang = (i / count) * Math.PI * 2 + (i % 3) * 0.65;
      const rad = 16 + (i % 6) * 4.8;
      const px = fc.x + Math.cos(ang) * rad;
      const pz = fc.z + Math.sin(ang) * rad;
      const baseAltY = fc.ceilingY + (i % 5) * 2.1;
      const speed = 5.6 + (i % 4) * 0.65;
      const vx = -Math.sin(ang) * speed * fc.dir;
      const vz = Math.cos(ang) * speed * fc.dir;
      const startGliding = i % 3 !== 0;

      this.birds.push({
        px,
        py: baseAltY,
        pz,
        vx,
        vy: 0,
        vz,
        homeX: fc.x,
        homeZ: fc.z,
        orbitDir: fc.dir,
        baseAltY,
        scale: 0.48 + (i % 5) * 0.075,
        headingYaw: Math.atan2(vx, vz),
        pitch: 0,
        bankRoll: 0,
        isGliding: startGliding,
        glideTimer: startGliding ? 2.6 + (i % 5) * 0.9 : 1.1 + (i % 4) * 0.35,
        wingPhase: i * 1.37,
        flapRate: 6.2 + (i % 4) * 0.55,
        wingAngle: 0.14,
        altPhase: i * 1.13,
        altSpeed: 0.16 + (i % 4) * 0.03,
      });

      bodyInst.setColorAt(i, bodyPalette[i % bodyPalette.length]);
      const wCol = wingPalette[i % wingPalette.length];
      leftWingInst.setColorAt(i, wCol);
      rightWingInst.setColorAt(i, wCol);
    }
    if (bodyInst.instanceColor) bodyInst.instanceColor.needsUpdate = true;
    if (leftWingInst.instanceColor) leftWingInst.instanceColor.needsUpdate = true;
    if (rightWingInst.instanceColor) rightWingInst.instanceColor.needsUpdate = true;

    this.birdBodyMesh = bodyInst;
    this.birdLeftWingMesh = leftWingInst;
    this.birdRightWingMesh = rightWingInst;
    this.group.add(bodyInst, leftWingInst, rightWingInst);
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

    // 1. Update Sky Bird Flocks (smooth continuous boids + steady thermal soaring + 3-mesh rigid-wing flapping)
    if (
      this.birdBodyMesh &&
      this.birdLeftWingMesh &&
      this.birdRightWingMesh &&
      this.birds.length > 0
    ) {
      const n = this.birds.length;
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
              const push = w * w * 2.2;
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

        let ax = sepX * 3.0;
        let az = sepZ * 3.0;
        if (neighbors > 0) {
          ax += (cohX / neighbors - b.px) * 0.12 + (aliX / neighbors - b.vx) * 0.38;
          az += (cohZ / neighbors - b.pz) * 0.12 + (aliZ / neighbors - b.vz) * 0.38;
        }

        const radialErr = homeDist - preferredOrbitR;
        if (homeDist > 1.5) {
          const invH = 1 / homeDist;
          const pull = THREE.MathUtils.clamp(radialErr * 0.12, -1.4, 2.4);
          ax += toHomeX * invH * pull;
          az += toHomeZ * invH * pull;
          ax += (-toHomeZ * invH) * b.orbitDir * 1.4;
          az += (toHomeX * invH) * b.orbitDir * 1.4;
        }

        b.vx += ax * safeDt;
        b.vz += az * safeDt;
        const spd = Math.hypot(b.vx, b.vz);
        const targetSpd = b.isGliding ? 5.8 : 6.4;
        const clampedSpd = THREE.MathUtils.damp(
          THREE.MathUtils.clamp(spd, 4.8, 7.6),
          targetSpd,
          1.8,
          safeDt
        );
        if (spd > 0.01) {
          b.vx = (b.vx / spd) * clampedSpd;
          b.vz = (b.vz / spd) * clampedSpd;
        }

        // Serene, level thermal soaring around precomputed safe ceiling (ZERO sudden vertical spikes!)
        const desiredY = b.baseAltY + Math.sin(elapsed * b.altSpeed + b.altPhase) * 0.45;
        const targetVy = THREE.MathUtils.clamp((desiredY - b.py) * 0.35, -0.45, 0.45);
        b.vy = THREE.MathUtils.damp(b.vy, targetVy, 2.5, safeDt);

        b.px += b.vx * safeDt;
        b.py += b.vy * safeDt;
        b.pz += b.vz * safeDt;

        // Calm flap-and-glide state machine (long glides with occasional rhythmic wingbeats)
        b.glideTimer -= safeDt;
        if (b.glideTimer <= 0) {
          b.isGliding = !b.isGliding;
          b.glideTimer = b.isGliding
            ? 3.4 + ((i * 13 + Math.floor(elapsed * 7)) % 7) * 0.55
            : 1.2 + ((i * 7 + Math.floor(elapsed * 5)) % 4) * 0.28;
        }
        if (!b.isGliding) {
          b.wingPhase += safeDt * b.flapRate;
          const targetAngle = Math.sin(b.wingPhase) * 0.52;
          b.wingAngle = THREE.MathUtils.damp(b.wingAngle, targetAngle, 14, safeDt);
        } else {
          // Steady upward soaring dihedral while gliding
          const glideDihedral = 0.14;
          b.wingAngle = THREE.MathUtils.damp(b.wingAngle, glideDihedral, 5.5, safeDt);
        }

        // Smooth aerodynamic orientation (yaw + ultra-subtle pitch + graceful turn bank)
        const desiredYaw = Math.atan2(b.vx, b.vz);
        let dYaw = desiredYaw - b.headingYaw;
        while (dYaw > Math.PI) dYaw -= Math.PI * 2;
        while (dYaw < -Math.PI) dYaw += Math.PI * 2;
        b.headingYaw += dYaw * Math.min(1, safeDt * 5.0);

        const desiredPitch = THREE.MathUtils.clamp(
          -Math.atan2(b.vy, Math.max(2.5, clampedSpd)) * 0.45,
          -0.16,
          0.16
        );
        b.pitch = THREE.MathUtils.damp(b.pitch, desiredPitch, 4.0, safeDt);

        const turnCross = (prevVx * b.vz - prevVz * b.vx) / Math.max(0.001, safeDt);
        const desiredBank = THREE.MathUtils.clamp(-turnCross * 0.014, -0.38, 0.38);
        b.bankRoll = THREE.MathUtils.damp(b.bankRoll, desiredBank, 4.0, safeDt);

        const sz = b.scale;
        this._euler.set(b.pitch, b.headingYaw, b.bankRoll, 'YXZ');
        this._quat.setFromEuler(this._euler);

        // Rigid body matrix (zero vertical body bobbing!)
        this._dummy.position.set(b.px, b.py, b.pz);
        this._dummy.quaternion.copy(this._quat);
        this._dummy.scale.setScalar(sz);
        this._dummy.updateMatrix();
        this.birdBodyMesh.setMatrixAt(i, this._dummy.matrix);

        // Symmetric rigid-hinged right & left wings (matching FX spawner birds!)
        const wingScale = sz * 1.15;
        const wingOffsetY = sz * 0.08;

        // Right wing (+X): +wingAngle around Z lifts tip UP
        this._euler.set(0, 0, b.wingAngle, 'YXZ');
        this._wingQuat.setFromEuler(this._euler);
        this._dummy.position.set(b.px, b.py + wingOffsetY, b.pz);
        this._dummy.quaternion.copy(this._quat).multiply(this._wingQuat);
        this._dummy.scale.setScalar(wingScale);
        this._dummy.updateMatrix();
        this.birdRightWingMesh.setMatrixAt(i, this._dummy.matrix);

        // Left wing (-X mirrored): -wingAngle around Z lifts tip UP identically
        this._euler.set(0, 0, -b.wingAngle, 'YXZ');
        this._wingQuat.setFromEuler(this._euler);
        this._dummy.position.set(b.px, b.py + wingOffsetY, b.pz);
        this._dummy.quaternion.copy(this._quat).multiply(this._wingQuat);
        this._dummy.scale.setScalar(wingScale);
        this._dummy.updateMatrix();
        this.birdLeftWingMesh.setMatrixAt(i, this._dummy.matrix);
      }
      this.birdBodyMesh.instanceMatrix.needsUpdate = true;
      this.birdLeftWingMesh.instanceMatrix.needsUpdate = true;
      this.birdRightWingMesh.instanceMatrix.needsUpdate = true;
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
    disposeInst(this.birdBodyMesh);
    disposeInst(this.birdLeftWingMesh);
    disposeInst(this.birdRightWingMesh);
    disposeInst(this.fishMesh);
    disposeInst(this.fireflyMesh);
    this.birdBodyMesh = null;
    this.birdLeftWingMesh = null;
    this.birdRightWingMesh = null;
    this.fishMesh = null;
    this.fireflyMesh = null;
    this.birds.length = 0;
    this.fishes.length = 0;
    this.fireflies.length = 0;
    this.group.clear();
  }
}
