import * as THREE from 'three';
import type {
  GameLevel,
  RockPatternKind,
  RockShapeKind,
  ScatterItem,
} from '../types/maker';
import {
  buildSculptedRockGeometry,
  getOrCreateRockPatternTexture,
  inferRockSizeClass,
} from './rockBuilder';
import {
  getEnvironmentType,
  getTerrainRadius,
  IslandTerrain,
  resolveHorizontalCollision,
  sampleLevelHeight,
  type CollisionFilterContext,
} from '../utils/terrain';

export type CarryRockKind = 'rock' | 'boulder';

export interface PickupRockItem {
  id: string;
  scatterId?: string;
  kind: CarryRockKind;
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  radius: number;
  vx: number;
  vy: number;
  vz: number;
  spinX: number;
  spinZ: number;
  state: 'ground' | 'carried' | 'thrown';
  bounces: number;
  throwGrace: number;
}

export interface PushableStoneBlock {
  id: string;
  mesh: THREE.Group;
  switchMesh: THREE.Group;
  x: number;
  y: number;
  z: number;
  startX: number;
  startZ: number;
  switchX: number;
  switchZ: number;
  halfSize: number;
  solved: boolean;
  rewardKind: 'chest' | 'coins';
  scrapeSoundCooldown: number;
  dustCooldown: number;
}

export interface GrabbableWallTorch {
  id: string;
  group: THREE.Object3D;
  removableParts: THREE.Object3D[];
  light?: THREE.PointLight | null;
  x: number;
  y: number;
  z: number;
  grabbed: boolean;
}

export type DebrisTheme =
  | 'leaf'
  | 'berry'
  | 'flower'
  | 'fern'
  | 'wood'
  | 'ceramic'
  | 'stone'
  | 'dust'
  | 'ember';

interface DebrisPiece {
  active: boolean;
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  life: number;
  maxLife: number;
  baseScale: number;
  gravity: number;
  bounced: boolean;
}

export interface RockImpactEnemyTarget {
  id: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  isBoss: boolean;
}

export interface WorldInteractivityCallbacks {
  onRockHitEnemy: (
    enemyId: string,
    kind: CarryRockKind,
    dirX: number,
    dirZ: number,
    impactX: number,
    impactY: number,
    impactZ: number
  ) => void;
  onRockImpactGround: (
    kind: CarryRockKind,
    x: number,
    y: number,
    z: number
  ) => void;
  onStoneScrape: () => void;
  onPuzzleBlockSolved: (block: PushableStoneBlock) => void;
}

/**
 * Deterministic seeded PRNG (Mulberry32) so scattered rocks & puzzle blocks
 * never jitter between reloads and stay organically varied.
 */
function createSeededRng(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Builds an organically sculpted, chiseled-facet granite/fieldstone rock geometry.
 * Deliberately non-spherical: asymmetric squash + multi-frequency directional ridge displacement
 * + flat face normals for crisp natural rock planes.
 */
function createOrganicRockGeometry(
  baseRadius: number,
  seed: number,
  detail: number
): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(baseRadius, detail);
  const nonIndexed = geo.index ? geo.toNonIndexed() : geo;
  if (nonIndexed !== geo) geo.dispose();

  const pos = nonIndexed.attributes.position as THREE.BufferAttribute;
  const rng = createSeededRng(seed);
  // 5 random plane/ridge axes so every variant has distinct natural cleave faces
  const axes: Array<[number, number, number, number, number]> = [];
  for (let k = 0; k < 5; k++) {
    const theta = rng() * Math.PI * 2;
    const phi = Math.acos(2 * rng() - 1);
    axes.push([
      Math.sin(phi) * Math.cos(theta),
      Math.cos(phi),
      Math.sin(phi) * Math.sin(theta),
      0.16 + rng() * 0.22,
      rng() * Math.PI * 2,
    ]);
  }
  const stretchX = 0.88 + rng() * 0.32;
  const stretchY = 0.68 + rng() * 0.24; // Slightly flatter natural resting rock profile
  const stretchZ = 0.85 + rng() * 0.34;

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const len = Math.max(0.0001, Math.hypot(vx, vy, vz));
    const nx = vx / len;
    const ny = vy / len;
    const nz = vz / len;

    let disp = 1.0;
    for (let k = 0; k < axes.length; k++) {
      const [ax, ay, az, amp, ph] = axes[k];
      const d = nx * ax + ny * ay + nz * az;
      // Cleave flat facets where dot product exceeds ridge threshold
      if (d > 0.42) {
        disp -= (d - 0.42) * amp * 1.15;
      }
      disp += Math.sin(d * 4.5 + ph) * amp * 0.32;
    }
    // Flatten underside slightly so rocks sit naturally on soil
    const bottomFlat = ny < -0.35 ? 0.82 : 1.0;
    pos.setXYZ(
      i,
      vx * disp * stretchX,
      vy * disp * stretchY * bottomFlat,
      vz * disp * stretchZ
    );
  }
  pos.needsUpdate = true;
  nonIndexed.computeVertexNormals();
  nonIndexed.computeBoundingSphere();
  return nonIndexed;
}

/**
 * Builds a weathered, distressed carved stone puzzle cube (beveled granite body,
 * chiseled trim ribs, mossy cracks, and an engraved ancient emblem on top & sides).
 */
function buildDistressedStoneCubeMesh(
  halfSize: number,
  seed: number,
  sharedMats: THREE.Material[],
  sharedGeos: THREE.BufferGeometry[]
): THREE.Group {
  const grp = new THREE.Group();
  const s = halfSize * 2;
  const rng = createSeededRng(seed);

  const stoneBaseMat = new THREE.MeshStandardMaterial({
    color: '#737A82',
    roughness: 0.92,
    metalness: 0.04,
    flatShading: true,
  });
  const stoneTrimMat = new THREE.MeshStandardMaterial({
    color: '#545B63',
    roughness: 0.94,
    metalness: 0.06,
    flatShading: true,
  });
  const mossMat = new THREE.MeshStandardMaterial({
    color: '#4B7A47',
    roughness: 0.88,
    metalness: 0.0,
    flatShading: true,
  });
  const runeMat = new THREE.MeshStandardMaterial({
    color: '#93C5FD',
    emissive: '#38BDF8',
    emissiveIntensity: 0.55,
    roughness: 0.35,
  });
  sharedMats.push(stoneBaseMat, stoneTrimMat, mossMat, runeMat);

  // Distressed main carved core (displaced box vertices so edges look hand-hewn & weathered)
  const coreGeo = new THREE.BoxGeometry(s * 0.94, s * 0.96, s * 0.94, 3, 3, 3);
  const cPos = coreGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < cPos.count; i++) {
    const px = cPos.getX(i);
    const py = cPos.getY(i);
    const pz = cPos.getZ(i);
    // Keep bottom relatively flush so cube sits solid on terrain
    const jitterScale = py < -s * 0.38 ? 0.015 : 0.045;
    const jx = (Math.sin(px * 9.3 + py * 5.7 + seed) * 0.5 + (rng() - 0.5)) * jitterScale;
    const jy = (Math.cos(pz * 8.1 + px * 4.3 + seed) * 0.5 + (rng() - 0.5)) * jitterScale;
    const jz = (Math.sin(py * 7.9 + pz * 6.1 + seed) * 0.5 + (rng() - 0.5)) * jitterScale;
    cPos.setXYZ(i, px + jx, py + jy, pz + jz);
  }
  coreGeo.computeVertexNormals();
  const coreMesh = new THREE.Mesh(coreGeo, stoneBaseMat);
  coreMesh.position.y = halfSize;
  coreMesh.castShadow = true;
  coreMesh.receiveShadow = true;
  grp.add(coreMesh);

  // Heavy top & bottom weathered stone collar rims
  const rimGeo = new THREE.BoxGeometry(s * 1.02, s * 0.14, s * 1.02);
  const botRim = new THREE.Mesh(rimGeo, stoneTrimMat);
  botRim.position.y = s * 0.07;
  botRim.castShadow = true;
  botRim.receiveShadow = true;
  const topRim = new THREE.Mesh(rimGeo, stoneTrimMat);
  topRim.position.y = s * 0.92;
  topRim.castShadow = true;
  topRim.receiveShadow = true;
  grp.add(botRim, topRim);

  // Corner chiselled buttress pillars
  const pillarGeo = new THREE.BoxGeometry(s * 0.16, s * 0.86, s * 0.16);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const pil = new THREE.Mesh(pillarGeo, stoneTrimMat);
      pil.position.set(sx * s * 0.44, halfSize, sz * s * 0.44);
      pil.castShadow = true;
      pil.receiveShadow = true;
      grp.add(pil);
    }
  }

  // Subtle carved glowing rune diamond on each cardinal face + top so player recognizes puzzle block
  const runeGeo = new THREE.OctahedronGeometry(s * 0.13, 0);
  runeGeo.scale(1, 1, 0.25);
  const faceDirs: Array<[number, number, number, number]> = [
    [0, halfSize, halfSize * 0.96, 0],
    [0, halfSize, -halfSize * 0.96, Math.PI],
    [halfSize * 0.96, halfSize, 0, Math.PI * 0.5],
    [-halfSize * 0.96, halfSize, 0, -Math.PI * 0.5],
  ];
  for (const [rx, ry, rz, ryaw] of faceDirs) {
    const rMesh = new THREE.Mesh(runeGeo, runeMat);
    rMesh.position.set(rx, ry, rz);
    rMesh.rotation.y = ryaw;
    grp.add(rMesh);
  }

  // Moss clumps tucked on upper corners for distressed ancient look
  const mossGeo = new THREE.DodecahedronGeometry(s * 0.15, 0);
  mossGeo.scale(1.35, 0.48, 1.15);
  for (let m = 0; m < 4; m++) {
    const mMesh = new THREE.Mesh(mossGeo, mossMat);
    const a = m * Math.PI * 0.5 + 0.45;
    mMesh.position.set(
      Math.cos(a) * s * 0.34,
      s * 0.99,
      Math.sin(a) * s * 0.34
    );
    mMesh.rotation.y = a;
    grp.add(mMesh);
  }

  sharedGeos.push(coreGeo, rimGeo, pillarGeo, runeGeo, mossGeo);
  return grp;
}

/**
 * Builds the ancient floor pressure tile / secret rune plate that responds when
 * a distressed stone cube is pushed onto it (or uncovered beneath it).
 */
function buildAncientFloorSwitchMesh(
  halfSize: number,
  sharedMats: THREE.Material[],
  sharedGeos: THREE.BufferGeometry[]
): THREE.Group {
  const grp = new THREE.Group();
  const s = halfSize * 2.15;

  const rimMat = new THREE.MeshStandardMaterial({
    color: '#475569',
    roughness: 0.85,
    metalness: 0.12,
  });
  const plateMat = new THREE.MeshStandardMaterial({
    color: '#1E293B',
    emissive: '#F59E0B',
    emissiveIntensity: 0.45,
    roughness: 0.45,
    metalness: 0.2,
  });
  sharedMats.push(rimMat, plateMat);

  const outerGeo = new THREE.BoxGeometry(s, 0.1, s);
  const outer = new THREE.Mesh(outerGeo, rimMat);
  outer.position.y = 0.04;
  outer.receiveShadow = true;

  const innerGeo = new THREE.BoxGeometry(s * 0.72, 0.12, s * 0.72);
  const inner = new THREE.Mesh(innerGeo, plateMat);
  inner.position.y = 0.06;
  inner.name = 'switch-plate';
  inner.receiveShadow = true;

  sharedGeos.push(outerGeo, innerGeo);
  grp.add(outer, inner);
  return grp;
}

export class WorldInteractivitySystem {
  public readonly group = new THREE.Group();

  public readonly rocks: PickupRockItem[] = [];
  public readonly pushBlocks: PushableStoneBlock[] = [];
  public readonly wallTorches: GrabbableWallTorch[] = [];

  public carriedRock: PickupRockItem | null = null;
  public isPushingStone = false;
  public pushingYaw = 0;

  // 3D Orange Aiming Bullseye + Parabolic Trajectory Dots
  private readonly bullseyeGroup = new THREE.Group();
  private readonly bullseyeOuterRing: THREE.Mesh;
  private readonly bullseyeInnerRing: THREE.Mesh;
  private readonly bullseyeDot: THREE.Mesh;
  private readonly arcDots: THREE.Mesh[] = [];
  public aimX = 0;
  public aimY = 0;
  public aimZ = 0;
  public aimRangeOffset = 0; // Optional user fine-tune distance offset
  private hasPointerAim = false;
  private pointerTargetX = 0;
  private pointerTargetZ = 0;

  // Pooled 3D destruction debris
  private readonly debrisPool: DebrisPiece[] = [];
  private debrisCursor = 0;

  private readonly level: GameLevel;
  private readonly ownedGeos: THREE.BufferGeometry[] = [];
  private readonly ownedMats: THREE.Material[] = [];
  private disposed = false;

  constructor(
    level: GameLevel,
    heroStartX: number,
    heroStartZ: number,
    scene: THREE.Scene,
    collisionCtx?: CollisionFilterContext
  ) {
    this.level = level;
    this.group.name = 'maker-world-interactivity';

    // 1. Build 3D Orange Aiming Bullseye + Dotted Parabolic Arc
    const orangeMat = new THREE.MeshBasicMaterial({
      color: '#FF7A1A',
      transparent: true,
      opacity: 0.94,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const orangeGlowMat = new THREE.MeshBasicMaterial({
      color: '#FFB347',
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.ownedMats.push(orangeMat, orangeGlowMat);

    const outerRingGeo = new THREE.RingGeometry(0.46, 0.58, 28);
    outerRingGeo.rotateX(-Math.PI * 0.5);
    const innerRingGeo = new THREE.RingGeometry(0.22, 0.30, 24);
    innerRingGeo.rotateX(-Math.PI * 0.5);
    const centerDotGeo = new THREE.CircleGeometry(0.11, 16);
    centerDotGeo.rotateX(-Math.PI * 0.5);
    const tickGeo = new THREE.PlaneGeometry(0.08, 0.24);
    tickGeo.rotateX(-Math.PI * 0.5);
    this.ownedGeos.push(outerRingGeo, innerRingGeo, centerDotGeo, tickGeo);

    this.bullseyeOuterRing = new THREE.Mesh(outerRingGeo, orangeMat);
    this.bullseyeInnerRing = new THREE.Mesh(innerRingGeo, orangeGlowMat);
    this.bullseyeDot = new THREE.Mesh(centerDotGeo, orangeMat);
    this.bullseyeGroup.add(this.bullseyeOuterRing, this.bullseyeInnerRing, this.bullseyeDot);

    // 4 crisp crosshair ticks around the bullseye
    for (let k = 0; k < 4; k++) {
      const ang = (k * Math.PI) * 0.5;
      const tick = new THREE.Mesh(tickGeo, orangeMat);
      tick.position.set(Math.sin(ang) * 0.66, 0.01, Math.cos(ang) * 0.66);
      tick.rotation.y = ang;
      this.bullseyeOuterRing.add(tick);
    }
    this.bullseyeGroup.visible = false;
    this.bullseyeGroup.renderOrder = 15;
    this.group.add(this.bullseyeGroup);

    const arcDotGeo = new THREE.SphereGeometry(0.065, 8, 6);
    this.ownedGeos.push(arcDotGeo);
    for (let k = 0; k < 10; k++) {
      const dMesh = new THREE.Mesh(arcDotGeo, orangeGlowMat);
      dMesh.visible = false;
      this.arcDots.push(dMesh);
      this.group.add(dMesh);
    }

    // 2. Pre-allocate pooled 3D Debris Chips (zero runtime GC!)
    const chipGeo = new THREE.OctahedronGeometry(0.09, 0);
    chipGeo.scale(1.4, 0.45, 0.9);
    this.ownedGeos.push(chipGeo);
    for (let i = 0; i < 140; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: '#4ADE80',
        roughness: 0.72,
        metalness: 0.05,
        flatShading: true,
      });
      this.ownedMats.push(mat);
      const mesh = new THREE.Mesh(chipGeo, mat);
      mesh.visible = false;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      this.group.add(mesh);
      this.debrisPool.push({
        active: false,
        mesh,
        vx: 0,
        vy: 0,
        vz: 0,
        rx: 0,
        ry: 0,
        rz: 0,
        life: 0,
        maxLife: 0.8,
        baseScale: 1,
        gravity: 16,
        bounced: false,
      });
    }

    // 3. Scatter Organic Pickup Rocks (1-Handed) & Carry Boulders (2-Handed)
    this.initScatteredRocks(level, heroStartX, heroStartZ, collisionCtx);

    // 4. Spawn Pushable Distressed Stone Puzzle Cubes
    this.initPushableStoneBlocks(level, heroStartX, heroStartZ, collisionCtx);

    // 5. Discover all grab-ready Wall Torches in the scene
    this.discoverWallTorches(scene);
  }

  private initScatteredRocks(
    level: GameLevel,
    heroStartX: number,
    heroStartZ: number,
    collisionCtx?: CollisionFilterContext
  ): void {
    const env = getEnvironmentType(level);
    if (env === 'sideScroller') return;

    const worldR =
      env === 'dungeon'
        ? 18
        : Math.min(level.terrain ? getTerrainRadius(level.terrain) : 65, 92);
    const rng = createSeededRng(104729 + (level.id?.length ?? 7) * 313);

    // 4 distinct organic rock geometries + 3 organic boulder geometries (shared across instances!)
    const smallGeos = [
      createOrganicRockGeometry(0.21, 1101, 1),
      createOrganicRockGeometry(0.23, 2207, 1),
      createOrganicRockGeometry(0.19, 3313, 1),
      createOrganicRockGeometry(0.24, 4421, 1),
    ];
    const boulderGeos = [
      createOrganicRockGeometry(0.44, 5503, 1),
      createOrganicRockGeometry(0.48, 6619, 1),
      createOrganicRockGeometry(0.42, 7727, 1),
    ];
    this.ownedGeos.push(...smallGeos, ...boulderGeos);

    const rockColors = ['#78828E', '#8C857B', '#6B7280', '#968B7E', '#646D6B'];
    const rockMats = rockColors.map((hex) => {
      const m = new THREE.MeshStandardMaterial({
        color: hex,
        roughness: 0.9,
        metalness: 0.04,
        flatShading: true,
      });
      this.ownedMats.push(m);
      return m;
    });

    const isSpotClean = (x: number, z: number, minR: number): boolean => {
      const h = sampleLevelHeight(level, x, z);
      if (env === 'openWorld' && h < IslandTerrain.waterLevel + 0.35) return false;
      // Avoid very steep cliff walls
      const hx = sampleLevelHeight(level, x + 0.9, z);
      const hz = sampleLevelHeight(level, x, z + 0.9);
      if (Math.abs(hx - h) > 0.65 || Math.abs(hz - h) > 0.65) return false;
      // Verify collision clearance
      const [rx, rz] = resolveHorizontalCollision(level, x, z, minR, false, collisionCtx);
      if (Math.hypot(rx - x, rz - z) > 0.25) return false;
      // Avoid overlapping already placed rocks
      for (const existing of this.rocks) {
        if (Math.hypot(existing.x - x, existing.z - z) < 2.2) return false;
      }
      return true;
    };

    const spawnRock = (kind: CarryRockKind, x: number, z: number, idx: number) => {
      const y = sampleLevelHeight(level, x, z);
      const geo =
        kind === 'boulder'
          ? boulderGeos[idx % boulderGeos.length]
          : smallGeos[idx % smallGeos.length];
      const mat = rockMats[idx % rockMats.length];
      const mesh = new THREE.Mesh(geo, mat);
      const radius = kind === 'boulder' ? 0.45 : 0.22;
      mesh.position.set(x, y + radius * 0.58, z);
      mesh.rotation.set(rng() * 0.5, rng() * Math.PI * 2, rng() * 0.5);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.rocks.push({
        id: `${kind}_${idx}`,
        kind,
        mesh,
        x,
        y: y + radius * 0.58,
        z,
        radius,
        vx: 0,
        vy: 0,
        vz: 0,
        spinX: 0,
        spinZ: 0,
        state: 'ground',
        bounces: 0,
        throwGrace: 0,
      });
    };

    // 0. Spawn styled pickupable boulders (2-handed) & field rocks (1-handed) painted onto terrain
    const concreteShapes: Exclude<RockShapeKind, 'mixed'>[] = [
      'crag',
      'cobble',
      'slab',
      'blocky',
    ];
    const styledGeoCache = new Map<string, THREE.BufferGeometry>();
    const styledMatCache = new Map<string, THREE.MeshStandardMaterial>();
    let scatteredSmallCount = 0;
    let scatteredBoulderCount = 0;
    const terrainScatter: ScatterItem[] = level.terrain?.scatter ?? [];

    for (let si = 0; si < terrainScatter.length; si++) {
      const item = terrainScatter[si];
      if (item.kind !== 'rock') continue;
      const rc = inferRockSizeClass(item.rockClass, item.size);
      // Large boulders are sit-only & pebbles are tiny decorative detail; only boulder/rock are pickupable!
      if (rc !== 'rock' && rc !== 'boulder') continue;
      if (scatteredSmallCount + scatteredBoulderCount >= 96) break;

      const shape: Exclude<RockShapeKind, 'mixed'> =
        item.rockShape ?? concreteShapes[si % concreteShapes.length];
      const shapeVar = item.rockShapeVariation ?? 0.5;
      const geoKey = `${shape}|${Math.round(shapeVar * 10)}|${si % 3}`;
      let geo = styledGeoCache.get(geoKey);
      if (!geo) {
        geo = buildSculptedRockGeometry(shape, shapeVar, 17 + (si % 3) * 29, 0.72, false);
        // Center vertically so pickup rotation & ground offset match carried/thrown physics
        geo.center();
        geo.computeBoundingSphere();
        this.ownedGeos.push(geo);
        styledGeoCache.set(geoKey, geo);
      }

      const pattern: RockPatternKind = item.rockPattern ?? 'speckled';
      const primaryHex = item.rockPrimaryColor ?? item.rockColorHex ?? '#7A828C';
      const secondaryHex = item.rockSecondaryColor ?? primaryHex;
      const noise = item.rockPatternNoise ?? 0.55;
      const matKey = `${pattern}|${primaryHex}|${secondaryHex}|${Math.round(noise * 10)}|${shape}`;
      let mat = styledMatCache.get(matKey);
      if (!mat) {
        const tex = getOrCreateRockPatternTexture(pattern, primaryHex, secondaryHex, noise);
        mat = new THREE.MeshStandardMaterial({
          color: '#FFFFFF',
          map: tex,
          roughness: shape === 'cobble' ? 0.68 : 0.88,
          metalness: 0.04,
        });
        this.ownedMats.push(mat);
        styledMatCache.set(matKey, mat);
      }

      const mesh = new THREE.Mesh(geo, mat);
      const scale = Math.max(0.18, item.size);
      mesh.scale.setScalar(scale);
      const radius = Math.max(0.18, 0.52 * scale);
      const gy = sampleLevelHeight(level, item.x, item.z);
      mesh.position.set(item.x, gy + radius * 0.58, item.z);
      mesh.rotation.set(0, item.rotation ?? 0, 0);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);

      const carryKind: CarryRockKind = rc === 'boulder' ? 'boulder' : 'rock';
      this.rocks.push({
        id: `${carryKind}_scatter_${item.id}`,
        scatterId: item.id,
        kind: carryKind,
        mesh,
        x: item.x,
        y: gy + radius * 0.58,
        z: item.z,
        radius,
        vx: 0,
        vy: 0,
        vz: 0,
        spinX: 0,
        spinZ: 0,
        state: 'ground',
        bounces: 0,
        throwGrace: 0,
      });
      if (carryKind === 'boulder') scatteredBoulderCount++;
      else scatteredSmallCount++;
    }

    // Place 2 friendly starter rocks & 1 starter carry-boulder reasonably near hero spawn so player sees them immediately!
    const nearAngles = [0.6, 2.35, -1.45, 3.9, 5.1];
    let nearSmall = 0;
    let nearBoulder = 0;
    if (scatteredSmallCount < 2 || scatteredBoulderCount < 1) {
      for (let k = 0; k < nearAngles.length; k++) {
        const ang = nearAngles[k];
        const d = 4.6 + (k % 3) * 2.2;
        const cx = heroStartX + Math.cos(ang) * d;
        const cz = heroStartZ + Math.sin(ang) * d;
        if (scatteredSmallCount + nearSmall < 2 && isSpotClean(cx, cz, 0.45)) {
          spawnRock('rock', cx, cz, this.rocks.length);
          nearSmall++;
        } else if (scatteredBoulderCount + nearBoulder < 1 && isSpotClean(cx, cz, 0.72)) {
          spawnRock('boulder', cx, cz, this.rocks.length);
          nearBoulder++;
        }
      }
    }

    // Scatter procedural fallback rocks only if terrain scatter has few pickupable rocks/boulders
    const targetSmall = env === 'dungeon' ? 8 : Math.max(scatteredSmallCount, 20);
    const targetBoulders = env === 'dungeon' ? 4 : Math.max(scatteredBoulderCount, 10);
    let smallCount = scatteredSmallCount + nearSmall;
    let boulderCount = scatteredBoulderCount + nearBoulder;

    for (
      let attempt = 0;
      attempt < 240 && (smallCount < targetSmall || boulderCount < targetBoulders);
      attempt++
    ) {
      const ang = rng() * Math.PI * 2;
      const rad = 5.5 + Math.sqrt(rng()) * (worldR * 0.78);
      const x = Math.cos(ang) * rad;
      const z = Math.sin(ang) * rad;
      if (Math.hypot(x - heroStartX, z - heroStartZ) < 3.6) continue;
      const wantBoulder =
        boulderCount < targetBoulders && (smallCount >= targetSmall || attempt % 3 === 0);
      if (isSpotClean(x, z, wantBoulder ? 0.72 : 0.42)) {
        spawnRock(wantBoulder ? 'boulder' : 'rock', x, z, this.rocks.length);
        if (wantBoulder) boulderCount++;
        else smallCount++;
      }
    }
  }

  private initPushableStoneBlocks(
    level: GameLevel,
    heroStartX: number,
    heroStartZ: number,
    collisionCtx?: CollisionFilterContext
  ): void {
    const env = getEnvironmentType(level);
    if (env === 'sideScroller') return;
    if (level.gameplayMode === 'driving') return;

    const worldR =
      env === 'dungeon'
        ? 15
        : Math.min(level.terrain ? getTerrainRadius(level.terrain) : 60, 74);
    const rng = createSeededRng(88211 + (level.id?.length ?? 5) * 97);
    const halfSize = 0.62; // ~1.24m distressed carved stone cube

    const tryPlaceBlock = (bx: number, bz: number, dirX: number, dirZ: number, idx: number): boolean => {
      const swX = bx + dirX * 2.55;
      const swZ = bz + dirZ * 2.55;
      const h0 = sampleLevelHeight(level, bx, bz);
      const h1 = sampleLevelHeight(level, swX, swZ);
      if (env === 'openWorld' && (h0 < IslandTerrain.waterLevel + 0.5 || h1 < IslandTerrain.waterLevel + 0.5)) {
        return false;
      }
      if (Math.abs(h1 - h0) > 0.75) return false;
      if (Math.hypot(bx - heroStartX, bz - heroStartZ) < 4.5) return false;

      // Ensure both block spot and push destination lane are clear of buildings/trees/fences
      for (const frac of [0, 0.5, 1.0]) {
        const px = bx + dirX * 2.55 * frac;
        const pz = bz + dirZ * 2.55 * frac;
        const [rx, rz] = resolveHorizontalCollision(level, px, pz, halfSize + 0.35, false, collisionCtx);
        if (Math.hypot(rx - px, rz - pz) > 0.25) return false;
      }
      for (const existing of this.pushBlocks) {
        if (Math.hypot(existing.x - bx, existing.z - bz) < 11) return false;
      }

      const cubeMesh = buildDistressedStoneCubeMesh(
        halfSize,
        900 + idx * 71,
        this.ownedMats,
        this.ownedGeos
      );
      cubeMesh.position.set(bx, h0, bz);
      this.group.add(cubeMesh);

      const switchMesh = buildAncientFloorSwitchMesh(halfSize, this.ownedMats, this.ownedGeos);
      switchMesh.position.set(swX, h1, swZ);
      this.group.add(switchMesh);

      this.pushBlocks.push({
        id: `puzzle_stone_${idx}`,
        mesh: cubeMesh,
        switchMesh,
        x: bx,
        y: h0,
        z: bz,
        startX: bx,
        startZ: bz,
        switchX: swX,
        switchZ: swZ,
        halfSize,
        solved: false,
        rewardKind: idx === 0 ? 'chest' : 'coins',
        scrapeSoundCooldown: 0,
        dustCooldown: 0,
      });
      return true;
    };

    // Place 1 discoverable puzzle cube within easy strolling distance of spawn, plus 2 across the island
    const cardinals: Array<[number, number]> = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (let attempt = 0; attempt < 36 && this.pushBlocks.length < 1; attempt++) {
      const ang = (attempt / 36) * Math.PI * 2 + 0.35;
      const dist = 7.5 + (attempt % 4) * 2.2;
      const [dx, dz] = cardinals[attempt % 4];
      tryPlaceBlock(heroStartX + Math.cos(ang) * dist, heroStartZ + Math.sin(ang) * dist, dx, dz, 0);
    }
    const targetTotal = env === 'dungeon' ? 2 : 3;
    for (let attempt = 0; attempt < 90 && this.pushBlocks.length < targetTotal; attempt++) {
      const ang = rng() * Math.PI * 2;
      const rad = 11 + rng() * (worldR * 0.62);
      const [dx, dz] = cardinals[Math.floor(rng() * 4)];
      tryPlaceBlock(Math.cos(ang) * rad, Math.sin(ang) * rad, dx, dz, this.pushBlocks.length);
    }
  }

  public discoverWallTorches(scene: THREE.Scene): void {
    this.wallTorches.length = 0;
    const worldPos = new THREE.Vector3();
    scene.updateMatrixWorld(true);
    let idx = 0;
    scene.traverse((obj) => {
      if (obj.userData?.grabbableWallTorch) {
        obj.getWorldPosition(worldPos);
        const removableParts = (obj.userData.wallTorchRemovableParts as THREE.Object3D[] | undefined) ?? [obj];
        const light = (obj.userData.wallTorchLight as THREE.PointLight | undefined) ?? null;
        this.wallTorches.push({
          id: `wall_torch_${idx++}`,
          group: obj,
          removableParts,
          light,
          x: worldPos.x,
          y: worldPos.y,
          z: worldPos.z,
          grabbed: false,
        });
      }
    });
  }

  public registerEntityWallTorch(
    id: string,
    mesh: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    light?: THREE.PointLight | null
  ): void {
    if (this.wallTorches.some((t) => t.id === id)) return;
    this.wallTorches.push({
      id,
      group: mesh,
      removableParts: [mesh],
      light: light ?? null,
      x,
      y,
      z,
      grabbed: false,
    });
  }

  public findNearestWallTorch(heroX: number, heroY: number, heroZ: number): GrabbableWallTorch | null {
    let best: GrabbableWallTorch | null = null;
    let bestDist = 2.75;
    for (const wt of this.wallTorches) {
      if (wt.grabbed) continue;
      const d = Math.hypot(wt.x - heroX, wt.z - heroZ);
      if (d < bestDist && Math.abs(wt.y - (heroY + 1.2)) < 2.6) {
        bestDist = d;
        best = wt;
      }
    }
    return best;
  }

  public grabWallTorch(torch: GrabbableWallTorch): void {
    if (torch.grabbed) return;
    torch.grabbed = true;
    for (const part of torch.removableParts) {
      part.visible = false;
    }
    if (torch.light) {
      torch.light.intensity = 0;
      torch.light.visible = false;
    }
    this.spawnDebrisBurst(torch.x, torch.y + 0.4, torch.z, 'ember', 10, 3.6);
  }

  public findNearestPickupRock(heroX: number, heroY: number, heroZ: number): PickupRockItem | null {
    if (this.carriedRock) return null;
    let best: PickupRockItem | null = null;
    let bestDist = 2.25;
    for (const r of this.rocks) {
      if (r.state !== 'ground') continue;
      const d = Math.hypot(r.x - heroX, r.z - heroZ);
      if (d < bestDist && Math.abs(r.y - heroY) < 2.1) {
        bestDist = d;
        best = r;
      }
    }
    return best;
  }

  public pickUpRock(
    rock: PickupRockItem,
    heroX?: number,
    heroZ?: number,
    heroYaw?: number
  ): void {
    if (this.carriedRock || rock.state !== 'ground') return;
    rock.state = 'carried';
    rock.vx = 0;
    rock.vy = 0;
    rock.vz = 0;
    this.carriedRock = rock;
    this.aimRangeOffset = 0;
    this.hasPointerAim = false;
    if (heroX !== undefined && heroZ !== undefined && heroYaw !== undefined) {
      const defaultRange = rock.kind === 'boulder' ? 6.4 : 11.2;
      this.aimX = heroX + Math.sin(heroYaw) * defaultRange;
      this.aimZ = heroZ + Math.cos(heroYaw) * defaultRange;
      this.aimY = sampleLevelHeight(this.level, this.aimX, this.aimZ);
    }
    this.bullseyeGroup.visible = true;
    for (const dot of this.arcDots) dot.visible = true;
  }

  public clearPointerAim(): void {
    this.hasPointerAim = false;
  }

  public dropCarriedRock(heroX: number, heroY: number, heroZ: number, heroYaw: number): void {
    const r = this.carriedRock;
    if (!r) return;
    this.carriedRock = null;
    r.state = 'ground';
    const dropX = heroX + Math.sin(heroYaw) * 0.9;
    const dropZ = heroZ + Math.cos(heroYaw) * 0.9;
    const gy = sampleLevelHeight(this.level, dropX, dropZ);
    r.x = dropX;
    r.y = gy + r.radius * 0.58;
    r.z = dropZ;
    r.mesh.position.set(r.x, r.y, r.z);
    this.bullseyeGroup.visible = false;
    for (const dot of this.arcDots) dot.visible = false;
  }

  public setPointerAimWorldPoint(x: number, z: number): void {
    this.hasPointerAim = true;
    this.pointerTargetX = x;
    this.pointerTargetZ = z;
  }

  public adjustAimRange(delta: number): void {
    this.aimRangeOffset = THREE.MathUtils.clamp(this.aimRangeOffset + delta, -5.0, 5.5);
  }

  public getMaxThrowRange(kind: CarryRockKind): number {
    return kind === 'boulder' ? 9.5 : 17.5;
  }

  public updateCarriedAndAim(
    dt: number,
    elapsed: number,
    heroX: number,
    heroY: number,
    heroZ: number,
    heroYaw: number,
    isFirstPerson = false
  ): void {
    const r = this.carriedRock;
    if (!r) {
      if (this.bullseyeGroup.visible) {
        this.bullseyeGroup.visible = false;
        for (const dot of this.arcDots) dot.visible = false;
      }
      return;
    }

    const fwdX = Math.sin(heroYaw);
    const fwdZ = Math.cos(heroYaw);
    const rightX = Math.cos(heroYaw);
    const rightZ = -Math.sin(heroYaw);

    // Position held rock naturally: in POV mode keep it lower-forward so the aiming bullseye & arc are unobstructed
    if (isFirstPerson) {
      if (r.kind === 'boulder') {
        r.x = heroX + fwdX * 0.74;
        r.y = heroY + 1.06 + Math.sin(elapsed * 4.2) * 0.02;
        r.z = heroZ + fwdZ * 0.74;
        r.mesh.rotation.y = heroYaw;
      } else {
        r.x = heroX + fwdX * 0.64 + rightX * 0.36;
        r.y = heroY + 1.18 + Math.sin(elapsed * 5.0) * 0.015;
        r.z = heroZ + fwdZ * 0.64 + rightZ * 0.36;
        r.mesh.rotation.y = heroYaw;
      }
    } else if (r.kind === 'boulder') {
      r.x = heroX + fwdX * 0.24;
      r.y = heroY + 1.98 + Math.sin(elapsed * 4.2) * 0.02;
      r.z = heroZ + fwdZ * 0.24;
      r.mesh.rotation.y = heroYaw;
    } else {
      r.x = heroX + fwdX * 0.34 + rightX * 0.36;
      r.y = heroY + 1.12 + Math.sin(elapsed * 5.0) * 0.015;
      r.z = heroZ + fwdZ * 0.34 + rightZ * 0.36;
      r.mesh.rotation.y = heroYaw;
    }
    r.mesh.position.set(r.x, r.y, r.z);

    // Compute Orange Bullseye ground target (smoothly movable via pointer OR facing + aim range)
    const maxRange = this.getMaxThrowRange(r.kind);
    const defaultRange = r.kind === 'boulder' ? 6.4 : 11.2;
    let targetX: number;
    let targetZ: number;
    if (this.hasPointerAim) {
      const pdx = this.pointerTargetX - heroX;
      const pdz = this.pointerTargetZ - heroZ;
      const pd = Math.hypot(pdx, pdz);
      const clampedD = THREE.MathUtils.clamp(pd, 2.0, maxRange);
      if (pd > 0.05) {
        targetX = heroX + (pdx / pd) * clampedD;
        targetZ = heroZ + (pdz / pd) * clampedD;
      } else {
        targetX = heroX + fwdX * defaultRange;
        targetZ = heroZ + fwdZ * defaultRange;
      }
    } else {
      const dist = THREE.MathUtils.clamp(defaultRange + this.aimRangeOffset, 2.2, maxRange);
      targetX = heroX + fwdX * dist;
      targetZ = heroZ + fwdZ * dist;
    }

    const targetY = sampleLevelHeight(this.level, targetX, targetZ);
    this.aimX = THREE.MathUtils.damp(this.aimX || targetX, targetX, 18, dt);
    this.aimZ = THREE.MathUtils.damp(this.aimZ || targetZ, targetZ, 18, dt);
    this.aimY = sampleLevelHeight(this.level, this.aimX, this.aimZ);

    // Animate Orange Bullseye cleanly on terrain surface
    this.bullseyeGroup.visible = true;
    this.bullseyeGroup.position.set(this.aimX, this.aimY + 0.09, this.aimZ);
    this.bullseyeOuterRing.rotation.y = elapsed * 1.15;
    const pulse = 1.0 + Math.sin(elapsed * 6.5) * 0.07;
    this.bullseyeInnerRing.scale.setScalar(pulse);
    this.bullseyeGroup.scale.setScalar(r.kind === 'boulder' ? 1.28 : 0.92);

    // Update dotted ballistic arc preview from hand/overhead to bullseye
    const grav = r.kind === 'boulder' ? 20.5 : 17.5;
    const horizDist = Math.max(1.5, Math.hypot(this.aimX - r.x, this.aimZ - r.z));
    const speed = r.kind === 'boulder' ? 11.4 : 19.2;
    const flightTime = THREE.MathUtils.clamp(horizDist / speed, 0.24, 1.35);
    const vx = (this.aimX - r.x) / flightTime;
    const vz = (this.aimZ - r.z) / flightTime;
    const vy = (this.aimY + 0.1 - r.y + 0.5 * grav * flightTime * flightTime) / flightTime;

    for (let k = 0; k < this.arcDots.length; k++) {
      const frac = (k + 1) / (this.arcDots.length + 1);
      const t = frac * flightTime;
      const dot = this.arcDots[k];
      dot.visible = true;
      dot.position.set(
        r.x + vx * t,
        r.y + vy * t - 0.5 * grav * t * t,
        r.z + vz * t
      );
      dot.scale.setScalar(0.65 + Math.sin(frac * Math.PI) * 0.45);
    }
  }

  public throwCarriedRock(): CarryRockKind | null {
    const r = this.carriedRock;
    if (!r) return null;
    this.carriedRock = null;
    r.state = 'thrown';
    r.bounces = 0;
    r.throwGrace = 0.08;

    const grav = r.kind === 'boulder' ? 20.5 : 17.5;
    const horizDist = Math.max(1.5, Math.hypot(this.aimX - r.x, this.aimZ - r.z));
    const speed = r.kind === 'boulder' ? 11.4 : 19.2;
    const flightTime = THREE.MathUtils.clamp(horizDist / speed, 0.24, 1.35);

    r.vx = (this.aimX - r.x) / flightTime;
    r.vz = (this.aimZ - r.z) / flightTime;
    r.vy = (this.aimY + 0.18 - r.y + 0.5 * grav * flightTime * flightTime) / flightTime;
    r.spinX = r.kind === 'boulder' ? 4.8 : 9.5;
    r.spinZ = r.kind === 'boulder' ? 2.4 : 5.2;

    this.bullseyeGroup.visible = false;
    for (const dot of this.arcDots) dot.visible = false;
    return r.kind;
  }

  public updateThrownRocks(
    dt: number,
    enemies: RockImpactEnemyTarget[],
    callbacks: WorldInteractivityCallbacks,
    collisionCtx?: CollisionFilterContext
  ): void {
    const safeDt = Math.min(0.05, Math.max(0.001, dt));
    for (const r of this.rocks) {
      if (r.state !== 'thrown') continue;
      if (r.throwGrace > 0) r.throwGrace = Math.max(0, r.throwGrace - safeDt);

      const grav = r.kind === 'boulder' ? 20.5 : 17.5;
      r.vy -= grav * safeDt;
      const nextX = r.x + r.vx * safeDt;
      const nextY = r.y + r.vy * safeDt;
      const nextZ = r.z + r.vz * safeDt;

      // Check solid wall/tree collision
      const [colX, colZ] = resolveHorizontalCollision(
        this.level,
        nextX,
        nextZ,
        r.radius * 0.9,
        false,
        collisionCtx
      );
      if (Math.hypot(colX - nextX, colZ - nextZ) > 0.12) {
        r.vx *= -0.35;
        r.vz *= -0.35;
        this.spawnDebrisBurst(r.x, r.y, r.z, 'stone', r.kind === 'boulder' ? 10 : 6, 4.5);
      }
      r.x = colX;
      r.y = nextY;
      r.z = colZ;
      r.mesh.position.set(r.x, r.y, r.z);
      r.mesh.rotation.x += r.spinX * safeDt;
      r.mesh.rotation.z += r.spinZ * safeDt;

      // Check enemy hit!
      let hitEnemy = false;
      const hitPad = r.kind === 'boulder' ? 0.85 : 0.55;
      for (const e of enemies) {
        const dx = e.x - r.x;
        const dz = e.z - r.z;
        const hd = Math.hypot(dx, dz);
        const vyDiff = Math.abs(r.y - (e.y + 0.95));
        if (hd <= e.radius + r.radius + hitPad && vyDiff <= 1.55) {
          const spd = Math.max(0.01, Math.hypot(r.vx, r.vz));
          const dirX = r.vx / spd;
          const dirZ = r.vz / spd;
          callbacks.onRockHitEnemy(e.id, r.kind, dirX, dirZ, r.x, r.y, r.z);
          this.spawnDebrisBurst(
            r.x,
            r.y,
            r.z,
            'stone',
            r.kind === 'boulder' ? 14 : 8,
            r.kind === 'boulder' ? 6.4 : 4.8
          );
          // Rebound rock off enemy naturally
          r.vx = -dirX * (r.kind === 'boulder' ? 2.4 : 3.2);
          r.vz = -dirZ * (r.kind === 'boulder' ? 2.4 : 3.2);
          r.vy = 2.8;
          r.bounces = 2;
          hitEnemy = true;
          break;
        }
      }
      if (hitEnemy) continue;

      // Check ground impact & natural bounce
      const groundY = sampleLevelHeight(this.level, r.x, r.z) + r.radius * 0.58;
      if (r.y <= groundY) {
        r.y = groundY;
        r.mesh.position.y = r.y;
        if (r.bounces === 0) {
          callbacks.onRockImpactGround(r.kind, r.x, r.y, r.z);
          this.spawnDebrisBurst(
            r.x,
            r.y,
            r.z,
            'dust',
            r.kind === 'boulder' ? 14 : 7,
            r.kind === 'boulder' ? 5.6 : 3.6
          );
        }
        r.bounces++;
        if (r.bounces <= 1 && Math.abs(r.vy) > 3.2) {
          r.vy = Math.abs(r.vy) * (r.kind === 'boulder' ? 0.28 : 0.38);
          r.vx *= 0.45;
          r.vz *= 0.45;
          r.spinX *= 0.5;
          r.spinZ *= 0.5;
        } else {
          r.vx = 0;
          r.vy = 0;
          r.vz = 0;
          r.state = 'ground';
        }
      }
    }
  }

  /**
   * Resolves hero collision with distressed stone puzzle blocks AND seamlessly slides
   * a stone block forward whenever the hero walks directly into one of its faces (no Use button!).
   */
  public updatePushableBlocks(
    dt: number,
    heroX: number,
    heroY: number,
    heroZ: number,
    heroRadius: number,
    intentMoveX: number,
    intentMoveZ: number,
    callbacks: WorldInteractivityCallbacks,
    collisionCtx?: CollisionFilterContext
  ): { x: number; z: number; pushing: boolean; pushYaw: number } {
    const safeDt = Math.min(0.05, Math.max(0.001, dt));
    let hx = heroX;
    let hz = heroZ;
    let pushing = false;
    let pushYaw = 0;
    const intentMag = Math.hypot(intentMoveX, intentMoveZ);

    for (const blk of this.pushBlocks) {
      if (blk.scrapeSoundCooldown > 0) blk.scrapeSoundCooldown -= safeDt;
      if (blk.dustCooldown > 0) blk.dustCooldown -= safeDt;

      // Keep switch plate animated cleanly
      const plate = blk.switchMesh.getObjectByName('switch-plate') as THREE.Mesh | undefined;
      if (plate) {
        const targetPlateY = blk.solved ? 0.015 : 0.06;
        plate.position.y = THREE.MathUtils.damp(plate.position.y, targetPlateY, 8, safeDt);
      }

      if (Math.abs(heroY - blk.y) > 1.8) continue;

      const pad = blk.halfSize + heroRadius;
      const dx = hx - blk.x;
      const dz = hz - blk.z;

      if (Math.abs(dx) < pad + 0.16 && Math.abs(dz) < pad + 0.16) {
        const overlapX = pad - Math.abs(dx);
        const overlapZ = pad - Math.abs(dz);

        // Determine dominant face hero is pressing against
        const onXFace = Math.abs(dx) >= Math.abs(dz);
        const pushDirX = onXFace ? (dx > 0 ? -1 : 1) : 0;
        const pushDirZ = onXFace ? 0 : dz > 0 ? -1 : 1;

        // Is hero actively walking INTO this face?
        if (intentMag > 0.2) {
          const inDot =
            (intentMoveX / intentMag) * pushDirX + (intentMoveZ / intentMag) * pushDirZ;
          if (inDot > 0.55) {
            const pushSpeed = 1.72;
            const candX = blk.x + pushDirX * pushSpeed * safeDt;
            const candZ = blk.z + pushDirZ * pushSpeed * safeDt;
            const candY = sampleLevelHeight(this.level, candX, candZ);
            const env = getEnvironmentType(this.level);
            const slopeOk = Math.abs(candY - blk.y) < 0.35;
            const waterOk = env !== 'openWorld' || candY > IslandTerrain.waterLevel + 0.2;
            const [resX, resZ] = resolveHorizontalCollision(
              this.level,
              candX,
              candZ,
              blk.halfSize * 0.96,
              false,
              collisionCtx
            );
            const blockedByEnv = Math.hypot(resX - candX, resZ - candZ) > 0.04;

            if (slopeOk && waterOk && !blockedByEnv) {
              blk.x = resX;
              blk.z = resZ;
              blk.y = candY;
              blk.mesh.position.set(blk.x, blk.y, blk.z);
              pushing = true;
              pushYaw = Math.atan2(pushDirX, pushDirZ);

              if (blk.dustCooldown <= 0) {
                blk.dustCooldown = 0.18;
                this.spawnDebrisBurst(
                  blk.x - pushDirX * blk.halfSize,
                  blk.y + 0.1,
                  blk.z - pushDirZ * blk.halfSize,
                  'dust',
                  3,
                  2.2
                );
              }
              if (blk.scrapeSoundCooldown <= 0) {
                blk.scrapeSoundCooldown = 0.42;
                callbacks.onStoneScrape();
              }

              // Check puzzle trigger: reached switch tile OR uncovered buried spot!
              if (!blk.solved) {
                const distToSwitch = Math.hypot(blk.x - blk.switchX, blk.z - blk.switchZ);
                const movedFromStart = Math.hypot(blk.x - blk.startX, blk.z - blk.startZ);
                if (distToSwitch < 0.72 || movedFromStart > 2.35) {
                  blk.solved = true;
                  if (plate) {
                    const pMat = plate.material as THREE.MeshStandardMaterial;
                    pMat.emissive.set('#4ADE80');
                    pMat.emissiveIntensity = 1.6;
                  }
                  this.spawnDebrisBurst(blk.switchX, blk.y + 0.35, blk.switchZ, 'ember', 16, 5.8);
                  callbacks.onPuzzleBlockSolved(blk);
                }
              }
            }
          }
        }

        // Solid push-out resolution so hero never clips into the stone cube
        if (overlapX > 0 && overlapZ > 0) {
          if (overlapX < overlapZ) {
            hx += dx >= 0 ? overlapX : -overlapX;
          } else {
            hz += dz >= 0 ? overlapZ : -overlapZ;
          }
        }
      }
    }

    this.isPushingStone = pushing;
    this.pushingYaw = pushYaw;
    return { x: hx, z: hz, pushing, pushYaw };
  }

  public spawnDebrisBurst(
    x: number,
    y: number,
    z: number,
    theme: DebrisTheme,
    count = 8,
    speed = 4.6
  ): void {
    const palettes: Record<DebrisTheme, string[]> = {
      leaf: ['#22C55E', '#4ADE80', '#16A34A', '#86EFAC'],
      berry: ['#22C55E', '#E11D48', '#15803D', '#FB7185'],
      flower: ['#F472B6', '#FACC15', '#A78BFA', '#4ADE80'],
      fern: ['#34D399', '#10B981', '#059669', '#6EE7B7'],
      wood: ['#B45309', '#D97706', '#92400E', '#FDE68A'],
      ceramic: ['#C26A3E', '#D98A5C', '#9A4B27', '#E7B48A'],
      stone: ['#94A3B8', '#64748B', '#CBD5E1', '#78716C'],
      dust: ['#D6D3D1', '#A8A29E', '#E7E5E4', '#C4B5A0'],
      ember: ['#FACC15', '#FB923C', '#FDE047', '#F97316'],
    };
    const pal = palettes[theme];
    const isLeafy = theme === 'leaf' || theme === 'berry' || theme === 'flower' || theme === 'fern';

    for (let i = 0; i < count; i++) {
      const piece = this.debrisPool[this.debrisCursor];
      this.debrisCursor = (this.debrisCursor + 1) % this.debrisPool.length;
      const ang = Math.random() * Math.PI * 2;
      const spd = speed * (0.45 + Math.random() * 0.7);
      piece.active = true;
      piece.vx = Math.cos(ang) * spd;
      piece.vy = (isLeafy ? 2.8 : 3.6) + Math.random() * (speed * 0.65);
      piece.vz = Math.sin(ang) * spd;
      piece.rx = (Math.random() - 0.5) * 14;
      piece.ry = (Math.random() - 0.5) * 14;
      piece.rz = (Math.random() - 0.5) * 14;
      piece.maxLife = isLeafy ? 0.72 + Math.random() * 0.45 : 0.52 + Math.random() * 0.35;
      piece.life = piece.maxLife;
      piece.gravity = isLeafy ? 8.8 : 17.5;
      piece.baseScale = isLeafy ? 0.85 + Math.random() * 0.65 : 0.65 + Math.random() * 0.55;
      piece.bounced = false;

      const mat = piece.mesh.material as THREE.MeshStandardMaterial;
      mat.color.set(pal[i % pal.length]);
      mat.emissive.set(theme === 'ember' ? '#F97316' : '#000000');
      mat.emissiveIntensity = theme === 'ember' ? 1.8 : 0;

      piece.mesh.visible = true;
      piece.mesh.position.set(
        x + (Math.random() - 0.5) * 0.35,
        y + Math.random() * 0.25,
        z + (Math.random() - 0.5) * 0.35
      );
      piece.mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      piece.mesh.scale.setScalar(piece.baseScale);
    }
  }

  public updateDebris(dt: number): void {
    const safeDt = Math.min(0.05, Math.max(0.001, dt));
    for (let i = 0; i < this.debrisPool.length; i++) {
      const p = this.debrisPool[i];
      if (!p.active) continue;
      p.life -= safeDt;
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      p.vy -= p.gravity * safeDt;
      // Gentle air drag for fluttery leaves/petals
      if (p.gravity < 11) {
        p.vx *= 1 - safeDt * 2.2;
        p.vz *= 1 - safeDt * 2.2;
      }
      p.mesh.position.x += p.vx * safeDt;
      p.mesh.position.y += p.vy * safeDt;
      p.mesh.position.z += p.vz * safeDt;
      p.mesh.rotation.x += p.rx * safeDt;
      p.mesh.rotation.y += p.ry * safeDt;
      p.mesh.rotation.z += p.rz * safeDt;

      const gy = sampleLevelHeight(this.level, p.mesh.position.x, p.mesh.position.z) + 0.05;
      if (p.mesh.position.y < gy) {
        p.mesh.position.y = gy;
        if (!p.bounced && Math.abs(p.vy) > 1.8) {
          p.bounced = true;
          p.vy = Math.abs(p.vy) * 0.34;
          p.vx *= 0.55;
          p.vz *= 0.55;
        } else {
          p.vy = 0;
          p.vx *= 0.7;
          p.vz *= 0.7;
        }
      }

      const fade = Math.min(1, p.life / (p.maxLife * 0.35));
      p.mesh.scale.setScalar(Math.max(0.01, p.baseScale * fade));
    }
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const g of this.ownedGeos) g.dispose();
    for (const m of this.ownedMats) m.dispose();
    this.ownedGeos.length = 0;
    this.ownedMats.length = 0;
    this.rocks.length = 0;
    this.pushBlocks.length = 0;
    this.wallTorches.length = 0;
    this.debrisPool.length = 0;
    this.group.clear();
  }
}
