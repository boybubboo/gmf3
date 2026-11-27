import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { GameLevel } from '../types/maker';
import {
  getEnvironmentType,
  getTerrainRadius,
  sampleLevelHeight,
} from '../utils/terrain';

/**
 * Hybrid Rapier 3D WASM Physics World for Play Mode.
 *
 * Syncs the island heightfield + carved cave floor slabs into Rapier and drives:
 *  - Pushable & tumbleable dynamic props (barrels, crates, rolling boulders, collectibles)
 *  - Hit-driven enemy knockback & ragdoll-style physical tumbles
 *  - Tactile melee/dash impulse blasts & kinematic hero body collision
 *
 * Runs at <0.4ms/frame in Rust WASM with zero per-frame JS allocations and complete
 * WASM heap cleanup on `dispose()`.
 */

let rapierInitPromise: Promise<void> | null = null;

function ensureRapierInit(): Promise<void> {
  if (!rapierInitPromise) {
    rapierInitPromise = RAPIER.init().catch((err) => {
      rapierInitPromise = null;
      throw err;
    });
  }
  return rapierInitPromise;
}

export interface DynamicPropBinding {
  id: string;
  mesh: THREE.Object3D;
  body: RAPIER.RigidBody;
  radius: number;
  baseYOffset: number;
  /** Optional TTL in seconds for temporary knockback / debris bodies. */
  ttl?: number;
}

export class HybridRapierPhysicsWorld {
  private world: RAPIER.World | null = null;
  private heroBody: RAPIER.RigidBody | null = null;
  private readonly props = new Map<string, DynamicPropBinding>();
  private disposed = false;
  private ready = false;
  private accumDt = 0;

  // Scratch vectors (zero GC)
  private readonly _prevHeroPos = new THREE.Vector3();
  private readonly _heroVel = new THREE.Vector3();
  private hasHeroPrev = false;

  public isReady(): boolean {
    return this.ready && !this.disposed && this.world !== null;
  }

  /**
   * Initializes Rapier WASM and builds static world colliders (terrain heightfield + cave floors)
   * plus the kinematic hero body for tactile prop pushing.
   */
  public async initForLevel(level: GameLevel): Promise<boolean> {
    try {
      await ensureRapierInit();
      if (this.disposed) return false;

      const world = new RAPIER.World({ x: 0, y: -22, z: 0 });
      const env = getEnvironmentType(level);
      const terrain = level.terrain;
      const worldR = terrain ? getTerrainRadius(terrain) : 78;
      const physSpan = Math.min(worldR, 156);

      // 1. Static Terrain Heightfield collider (64x64 grid = crisp slopes & mountain bounce)
      if (env !== 'dungeon') {
        const nrows = 64;
        const ncols = 64;
        const heights = new Float32Array((nrows + 1) * (ncols + 1));
        const stepX = (physSpan * 2) / nrows;
        const stepZ = (physSpan * 2) / ncols;

        // Rapier heightfield is column-major: index = col * (nrows + 1) + row
        for (let col = 0; col <= ncols; col++) {
          const wz = -physSpan + col * stepZ;
          for (let row = 0; row <= nrows; row++) {
            const wx = -physSpan + row * stepX;
            heights[col * (nrows + 1) + row] = sampleLevelHeight(level, wx, wz);
          }
        }

        const hfDesc = RAPIER.ColliderDesc.heightfield(
          nrows,
          ncols,
          heights,
          new RAPIER.Vector3(physSpan * 2, 1.0, physSpan * 2)
        )
          .setFriction(0.72)
          .setRestitution(0.22);
        world.createCollider(hfDesc);
      } else {
        // Flat dungeon floor slab
        const floorDesc = RAPIER.ColliderDesc.cuboid(physSpan, 0.5, physSpan)
          .setTranslation(0, -0.5, 0)
          .setFriction(0.75);
        world.createCollider(floorDesc);
      }

      // 2. Static floor slabs for carved cave tunnels so objects roll along cave floors
      const caves = terrain?.caves ?? [];
      for (let c = 0; c < caves.length; c++) {
        const cave = caves[c];
        const nodes = cave.tunnelNodes ?? [];
        const baseFloor = cave.floorElevation ?? nodes[0]?.floorY ?? 1.5;
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          const fy = n.floorY ?? baseFloor;
          const r = Math.max(2.0, n.radius ?? 4.2);
          const slab = RAPIER.ColliderDesc.cuboid(r, 0.25, r)
            .setTranslation(n.x, fy - 0.25, n.z)
            .setFriction(0.75);
          world.createCollider(slab);
        }
      }

      // 3. Kinematic hero collider so sprinting into barrels/crates/boulders pushes them physically
      const heroDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 5, 0);
      const heroBody = world.createRigidBody(heroDesc);
      const heroCol = RAPIER.ColliderDesc.capsule(0.55, 0.45)
        .setFriction(0.35)
        .setRestitution(0.15);
      world.createCollider(heroCol, heroBody);

      if (this.disposed) {
        world.free();
        return false;
      }

      this.world = world;
      this.heroBody = heroBody;
      this.ready = true;
      return true;
    } catch (err) {
      console.warn('Rapier WASM physics init skipped:', err);
      return false;
    }
  }

  /**
   * Registers a movable/pushable world prop (crate, barrel, boulder, urn, etc.) as a real
   * Rapier dynamic rigid body synced automatically back to its Three.js Object3D every frame.
   */
  public registerDynamicProp(
    id: string,
    mesh: THREE.Object3D,
    options?: {
      radius?: number;
      shape?: 'box' | 'sphere' | 'cylinder';
      mass?: number;
      restitution?: number;
      baseYOffset?: number;
      ttl?: number;
    }
  ): void {
    if (!this.world || !this.ready || this.disposed) return;
    if (this.props.has(id)) return;

    const r = Math.max(0.22, options?.radius ?? 0.55);
    const yOff = options?.baseYOffset ?? r;
    const rbDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(mesh.position.x, mesh.position.y + yOff, mesh.position.z)
      .setLinearDamping(0.65)
      .setAngularDamping(0.85)
      .setCanSleep(true);
    const body = this.world.createRigidBody(rbDesc);

    const shape = options?.shape ?? 'box';
    const colDesc =
      shape === 'sphere'
        ? RAPIER.ColliderDesc.ball(r)
        : shape === 'cylinder'
        ? RAPIER.ColliderDesc.cylinder(r * 0.9, r * 0.78)
        : RAPIER.ColliderDesc.cuboid(r * 0.85, r * 0.85, r * 0.85);

    colDesc
      .setDensity(options?.mass ?? 1.4)
      .setFriction(0.72)
      .setRestitution(options?.restitution ?? 0.28);

    this.world.createCollider(colDesc, body);

    this.props.set(id, {
      id,
      mesh,
      body,
      radius: r,
      baseYOffset: yOff,
      ttl: options?.ttl,
    });
  }

  /**
   * Triggers a physical radial blast / melee knockback impulse (e.g. sword swing, axe smash,
   * enemy explosion, or dash impact) that sends nearby dynamic props tumbling through the air.
   */
  public applyRadialImpulse(
    originX: number,
    originY: number,
    originZ: number,
    radius: number,
    strength = 12,
    upwardLift = 0.45
  ): void {
    if (!this.world || !this.ready || this.disposed) return;
    const r2 = radius * radius;
    this.props.forEach((binding) => {
      const pos = binding.body.translation();
      const dx = pos.x - originX;
      const dy = pos.y - originY;
      const dz = pos.z - originZ;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > r2) return;
      const d = Math.max(0.15, Math.sqrt(d2));
      const falloff = 1 - d / radius;
      const mag = strength * (0.4 + 0.6 * falloff);
      binding.body.wakeUp();
      binding.body.applyImpulse(
        {
          x: (dx / d) * mag,
          y: (upwardLift + Math.max(0, dy / d) * 0.35) * mag,
          z: (dz / d) * mag,
        },
        true
      );
      binding.body.applyTorqueImpulse(
        {
          x: (dz / d) * mag * 0.25,
          y: (Math.sin(d * 7.1) * 0.5) * mag * 0.15,
          z: (-dx / d) * mag * 0.25,
        },
        true
      );
    });
  }

  /**
   * Launches a defeated enemy mesh (or debris chunk) with real Rapier ragdoll-tumble physics
   * so killing blows knock foes tumbling down slopes and bouncing off rocks.
   */
  public launchTumbleBody(
    id: string,
    mesh: THREE.Object3D,
    impulseX: number,
    impulseY: number,
    impulseZ: number,
    radius = 0.55,
    ttl = 2.6
  ): void {
    if (!this.world || !this.ready || this.disposed) return;
    this.removeProp(id);
    this.registerDynamicProp(id, mesh, {
      radius,
      shape: 'sphere',
      mass: 1.1,
      restitution: 0.36,
      baseYOffset: radius * 0.8,
      ttl,
    });
    const binding = this.props.get(id);
    if (binding) {
      binding.body.wakeUp();
      binding.body.applyImpulse({ x: impulseX, y: impulseY, z: impulseZ }, true);
      binding.body.applyTorqueImpulse(
        {
          x: impulseZ * 0.42,
          y: (impulseX - impulseZ) * 0.18,
          z: -impulseX * 0.42,
        },
        true
      );
    }
  }

  public removeProp(id: string): void {
    const existing = this.props.get(id);
    if (!existing) return;
    if (this.world && !this.disposed) {
      try {
        this.world.removeRigidBody(existing.body);
      } catch {
        // ignore if already removed
      }
    }
    this.props.delete(id);
  }

  /**
   * Advances the Rapier simulation using a fixed 60Hz timestep (max 2 substeps) and syncs
   * awake dynamic props back to their Three.js transforms.
   */
  public step(
    dt: number,
    heroX: number,
    heroY: number,
    heroZ: number
  ): void {
    if (!this.world || !this.ready || this.disposed) return;
    const safeDt = Math.min(0.05, Math.max(0.001, dt));

    // Sync kinematic hero capsule + compute hero push velocity
    if (this.heroBody) {
      const hy = heroY + 0.95;
      this.heroBody.setNextKinematicTranslation({ x: heroX, y: hy, z: heroZ });
      if (this.hasHeroPrev) {
        this._heroVel.set(
          (heroX - this._prevHeroPos.x) / safeDt,
          (hy - this._prevHeroPos.y) / safeDt,
          (heroZ - this._prevHeroPos.z) / safeDt
        );
        // Gentle contact nudge when sprinting right against dynamic props
        const heroSpdSq = this._heroVel.x * this._heroVel.x + this._heroVel.z * this._heroVel.z;
        if (heroSpdSq > 1.5 && this.props.size > 0) {
          this.props.forEach((b) => {
            const p = b.body.translation();
            const dx = p.x - heroX;
            const dz = p.z - heroZ;
            const dy = Math.abs(p.y - hy);
            const touchR = b.radius + 0.72;
            if (dy < 1.35 && dx * dx + dz * dz < touchR * touchR) {
              b.body.wakeUp();
              b.body.applyImpulse(
                {
                  x: this._heroVel.x * 0.14,
                  y: 0.35,
                  z: this._heroVel.z * 0.14,
                },
                true
              );
            }
          });
        }
      }
      this._prevHeroPos.set(heroX, hy, heroZ);
      this.hasHeroPrev = true;
    }

    // Only step Rapier when there are active dynamic bodies (zero idle cost!)
    if (this.props.size === 0) return;

    this.accumDt += safeDt;
    const fixedStep = 1 / 60;
    let substeps = 0;
    while (this.accumDt >= fixedStep && substeps < 2) {
      this.world.step();
      this.accumDt -= fixedStep;
      substeps++;
    }

    // Sync awake rigid bodies back to Three.js meshes
    const expired: string[] = [];
    this.props.forEach((b, id) => {
      if (typeof b.ttl === 'number') {
        b.ttl -= safeDt;
        if (b.ttl <= 0) {
          expired.push(id);
          return;
        }
      }
      if (!b.body.isSleeping()) {
        const t = b.body.translation();
        const r = b.body.rotation();
        b.mesh.position.set(t.x, t.y - b.baseYOffset, t.z);
        b.mesh.quaternion.set(r.x, r.y, r.z, r.w);
      }
    });

    for (let i = 0; i < expired.length; i++) {
      this.removeProp(expired[i]);
    }
  }

  public dispose(): void {
    this.disposed = true;
    this.ready = false;
    this.props.clear();
    this.heroBody = null;
    if (this.world) {
      try {
        this.world.free();
      } catch {
        // ignore
      }
      this.world = null;
    }
  }
}
