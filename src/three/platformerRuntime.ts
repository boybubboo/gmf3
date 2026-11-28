import * as THREE from 'three';
import { resolvePlatformerMovement } from '../data/platformerCatalog';
import type {
  GameLevel,
  LevelEntity,
  PlatformerAddonConfig,
  PlatformerModuleId,
  PlatformerMovementConfig,
} from '../types/maker';
import { levelBoardToWorld, sampleLevelHeight } from '../utils/terrain';

export interface PlatformerStepInput {
  heroX: number;
  heroY: number;
  heroZ: number;
  heroVelX: number;
  heroVelY: number;
  heroRadius: number;
  heroHeight: number;
  heroFacingSign: number; // +1 right, -1 left
  moveX: number;
  moveZ: number;
  jumpJustPressed: boolean;
  jumpHeld: boolean;
  dropHeld: boolean;
  interactJustPressed: boolean;
  interactHeld: boolean;
  isDashing: boolean;
  isGroundPounding: boolean;
  coinsCount: number;
  keysCount: number;
  timeElapsed: number;
  jumpCountSeq: number;
}

export interface PlatformerStepResult {
  floorY: number;
  carryDX: number;
  carryDY: number;
  carryDZ: number;
  wallPushX: number;
  wallContactDir: -1 | 0 | 1;
  surfaceFriction: 'normal' | 'ice' | 'sticky';
  conveyorVX: number;
  speedBoostVX: number;
  gravityScale: number;
  gravitySign: 1 | -1;
  inWaterZone: boolean;
  waterSurfaceY: number;
  oxygenPct: number;
  oxygenActive: boolean;
  windAccelX: number;
  windAccelY: number;
  sizeScale: number;
  hasLantern: boolean;
  climbCandidate: {
    kind: 'ladder' | 'grate' | 'monkeyBars';
    anchorX: number;
    anchorY: number;
    minY: number;
    maxY: number;
  } | null;
  activeControlMode: 'none' | 'cannon' | 'vine' | 'grapple' | 'rail' | 'bashAim';
  hasOverridePos: boolean;
  overrideX: number;
  overrideY: number;
  overrideZ: number;
  hasOverrideVel: boolean;
  overrideVX: number;
  overrideVY: number;
  timeDilation: number;
  refillAirMoves: boolean;
  bounceHeroVY: number;
  damageHero: number;
  collectCoins: number;
  starCoinsMask: number;
  starCoinsCount: number;
  bpmPulseNorm: number;
  risingTideY: number | null;
  checkpointReached: { x: number; y: number; z: number; label: string } | null;
  goalReached: { type: 'flagpole' | 'tape' | 'secretExit'; label: string } | null;
  toastMessage: string | null;
  soundEvent:
    | 'jump'
    | 'coin'
    | 'chime'
    | 'hurt'
    | 'whoosh'
    | 'creak'
    | 'hit'
    | 'sparkle'
    | null;
}

interface AddonRuntimeNode {
  entity: LevelEntity;
  cfg: PlatformerAddonConfig;
  mod: PlatformerModuleId;
  mesh: THREE.Group;
  originX: number;
  originY: number;
  originZ: number;
  curX: number;
  curY: number;
  curZ: number;
  prevX: number;
  prevY: number;
  prevZ: number;
  width: number;
  height: number;
  depth: number;
  alive: boolean;
  active: boolean;
  // Moving platforms
  triggered: boolean;
  motionTime: number;
  // Crumble
  crumbleState: 'idle' | 'shaking' | 'fallen';
  crumbleTimer: number;
  // Seesaw
  tiltAngle: number;
  tiltAngVel: number;
  // Switch / Gate / Channel
  channelOpen: boolean;
  timerRemaining: number;
  // Cannon
  cannonAngleRad: number;
  // Pendulum / Vine
  swingAngle: number;
  swingAngVel: number;
  // Thwomp
  thwompState: 'idle' | 'dropping' | 'resting' | 'rising';
  thwompTimer: number;
  // Dash crystal cooldown
  cooldownTimer: number;
  // Follower key
  keyFollowed: boolean;
  keyConsumed: boolean;
  // Crate
  crateVX: number;
  crateVY: number;
  crateCarried: boolean;
  // Enemy AI
  enemyDir: 1 | -1;
  enemyState: 'patrol' | 'telegraph' | 'charge' | 'stun' | 'dead';
  enemyTimer: number;
  enemyVX: number;
  enemyFireTimer: number;
  // Coins / Stars bitmask
  coinSubMask: number;
  // Secret wall fade
  secretAlpha: number;
}

interface ProjectileSlot {
  active: boolean;
  friendly: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  life: number;
  mesh: THREE.Mesh;
}

interface GhostSample {
  x: number;
  y: number;
  z: number;
}

export class PlatformerWorldController {
  public readonly tuning: PlatformerMovementConfig;
  public readonly hasPlatformerModules: boolean;
  public readonly starTotal: number;
  private readonly nodes: AddonRuntimeNode[] = [];
  private readonly scene: THREE.Scene;
  private readonly channelActive = new Map<string, boolean>();
  private readonly projectiles: ProjectileSlot[] = [];

  // Persistent hero modifier state managed by platformer add-ons
  private heroSizeScale = 1;
  private hasLantern = false;
  private starCoinsMask = 0;
  private oxygenPct = 100;
  private portalCooldown = 0;

  // Special lock-on traversal states
  private lockMode: 'none' | 'cannon' | 'vine' | 'grapple' | 'rail' | 'bashAim' = 'none';
  private lockNode: AddonRuntimeNode | null = null;
  private lockParam = 0; // height along vine / normalized s on rail
  private lockReleaseCooldown = 0;
  private bashLaunchAngle = Math.PI * 0.25;
  private bashTimer = 0;

  // Ghost echo 3s loop recorder (20Hz = 60 samples)
  private readonly ghostHistory: GhostSample[] = [];
  private ghostRecordAccum = 0;
  private ghostPlaybackActive = false;
  private ghostPlaybackIndex = 0;
  private ghostPlaybackTimer = 0;
  private ghostMesh: THREE.Group | null = null;
  private ghostPos = new THREE.Vector3();

  // Rising tide mesh
  private risingTideY: number | null = null;
  private risingTideDir: 1 | -1 = 1;
  private risingTideMesh: THREE.Mesh | null = null;

  // Cannon trajectory dots + Grapple tether + Bash aim arrow
  private readonly cannonArcDots: THREE.Mesh[] = [];
  private grappleLine: THREE.Line | null = null;
  private bashArrowGroup: THREE.Group | null = null;
  private lastJumpSeq = 0;

  constructor(
    scene: THREE.Scene,
    level: GameLevel,
    entries: Array<{ entity: LevelEntity; mesh: THREE.Group }>
  ) {
    this.scene = scene;
    this.tuning = resolvePlatformerMovement(level);

    let starCount = 0;
    for (const { entity, mesh } of entries) {
      const cfg = entity.platformerAddon;
      if (!cfg) continue;
      const [wx, wz] = levelBoardToWorld(level, entity.position);
      const wy = sampleLevelHeight(level, wx, wz) + (entity.elevationY ?? 0);
      const sc = entity.scale || 1;
      const w = (cfg.width ?? 3.6) * sc;
      const h = (cfg.height ?? 0.6) * sc;
      const d = (cfg.depth ?? 3.2) * sc;
      if (cfg.moduleId === 'starCoin') starCount++;

      this.nodes.push({
        entity,
        cfg,
        mod: cfg.moduleId,
        mesh,
        originX: wx,
        originY: wy,
        originZ: wz,
        curX: wx,
        curY: wy,
        curZ: wz,
        prevX: wx,
        prevY: wy,
        prevZ: wz,
        width: w,
        height: h,
        depth: d,
        alive: true,
        active: true,
        triggered: !cfg.triggerOnStep,
        motionTime: 0,
        crumbleState: 'idle',
        crumbleTimer: 0,
        tiltAngle: 0,
        tiltAngVel: 0,
        channelOpen: false,
        timerRemaining: 0,
        cannonAngleRad: THREE.MathUtils.degToRad(cfg.cannonAngleDeg ?? 45),
        swingAngle: 0,
        swingAngVel: 0,
        thwompState: 'idle',
        thwompTimer: 0,
        cooldownTimer: 0,
        keyFollowed: false,
        keyConsumed: false,
        crateVX: 0,
        crateVY: 0,
        crateCarried: false,
        enemyDir: 1,
        enemyState: 'patrol',
        enemyTimer: 0,
        enemyVX: 0,
        enemyFireTimer: 1.2 + Math.random() * 0.8,
        coinSubMask: 0,
        secretAlpha: 1,
      });
    }
    this.starTotal = starCount;
    this.hasPlatformerModules =
      this.nodes.length > 0 ||
      this.tuning.risingTideEnabled ||
      level.environmentType === 'sideScroller';

    if (this.hasPlatformerModules) {
      this.initHelperVisuals();
    }
  }

  private initHelperVisuals(): void {
    // Projectile pool (for enemyTurret & bashable orbs)
    const projGeo = new THREE.SphereGeometry(0.28, 10, 8);
    const projMat = new THREE.MeshStandardMaterial({
      color: '#F97316',
      emissive: '#EA580C',
      emissiveIntensity: 0.9,
      roughness: 0.25,
    });
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(projGeo, projMat);
      m.visible = false;
      this.scene.add(m);
      this.projectiles.push({
        active: false,
        friendly: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        life: 0,
        mesh: m,
      });
    }

    // Cannon arc preview dots
    const dotGeo = new THREE.SphereGeometry(0.14, 8, 6);
    const dotMat = new THREE.MeshBasicMaterial({ color: '#FACC15', transparent: true, opacity: 0.88 });
    for (let i = 0; i < 10; i++) {
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.visible = false;
      this.scene.add(dot);
      this.cannonArcDots.push(dot);
    }

    // Grapple tether line
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(0, 1, 0),
    ]);
    const lineMat = new THREE.LineBasicMaterial({ color: '#38BDF8', transparent: true, opacity: 0.92 });
    this.grappleLine = new THREE.Line(lineGeo, lineMat);
    this.grappleLine.visible = false;
    this.scene.add(this.grappleLine);

    // Bash aim arrow
    const arrowGrp = new THREE.Group();
    const arrowMat = new THREE.MeshBasicMaterial({ color: '#22D3EE', transparent: true, opacity: 0.95 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.5, 8), arrowMat);
    shaft.position.y = 0.75;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.55, 8), arrowMat);
    tip.position.y = 1.65;
    arrowGrp.add(shaft, tip);
    arrowGrp.visible = false;
    this.scene.add(arrowGrp);
    this.bashArrowGroup = arrowGrp;

    // Ghost Echo Clone
    const gGrp = new THREE.Group();
    const gMat = new THREE.MeshStandardMaterial({
      color: '#67E8F9',
      emissive: '#06B6D4',
      emissiveIntensity: 0.75,
      transparent: true,
      opacity: 0.52,
      roughness: 0.2,
    });
    const gBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.82, 6, 10), gMat);
    gBody.position.y = 0.82;
    const gHead = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), gMat);
    gHead.position.y = 1.58;
    gGrp.add(gBody, gHead);
    gGrp.visible = false;
    this.scene.add(gGrp);
    this.ghostMesh = gGrp;

    // Rising Hazard Tide plane
    if (this.tuning.risingTideEnabled) {
      this.risingTideY = this.tuning.risingTideMinY;
      const tideColor =
        this.tuning.risingTideType === 'lava'
          ? '#F97316'
          : this.tuning.risingTideType === 'toxic'
          ? '#84CC16'
          : '#0EA5E9';
      const tideMat = new THREE.MeshStandardMaterial({
        color: tideColor,
        emissive: this.tuning.risingTideType === 'water' ? '#0369A1' : tideColor,
        emissiveIntensity: this.tuning.risingTideType === 'water' ? 0.25 : 0.75,
        transparent: true,
        opacity: this.tuning.risingTideType === 'water' ? 0.62 : 0.88,
        roughness: 0.25,
      });
      const tidePlane = new THREE.Mesh(new THREE.BoxGeometry(240, 1.4, 24), tideMat);
      tidePlane.position.set(0, this.risingTideY - 0.7, 0);
      this.scene.add(tidePlane);
      this.risingTideMesh = tidePlane;
    }
  }

  public dispose(): void {
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    for (const d of this.cannonArcDots) this.scene.remove(d);
    if (this.grappleLine) this.scene.remove(this.grappleLine);
    if (this.bashArrowGroup) this.scene.remove(this.bashArrowGroup);
    if (this.ghostMesh) this.scene.remove(this.ghostMesh);
    if (this.risingTideMesh) this.scene.remove(this.risingTideMesh);
  }

  public isCustomHeroBlocked(heroX: number, heroY: number, heroZ: number, radius: number): boolean {
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      if (!n.alive) continue;
      if (n.mod === 'lockedDoor' || n.mod === 'starGateway') {
        if (n.channelOpen) continue;
        const hw = n.width * 0.5 + radius;
        const hh = n.height;
        const hd = n.depth * 0.5 + radius;
        if (
          Math.abs(heroX - n.curX) < hw &&
          Math.abs(heroZ - n.curZ) < hd &&
          heroY < n.curY + hh &&
          heroY + 1.5 > n.curY
        ) {
          return true;
        }
      } else if (n.mod === 'breakableBlock') {
        const hw = n.width * 0.5 + radius;
        const hh = n.height;
        const hd = n.depth * 0.5 + radius;
        if (
          Math.abs(heroX - n.curX) < hw &&
          Math.abs(heroZ - n.curZ) < hd &&
          heroY < n.curY + hh - 0.25 &&
          heroY + 1.5 > n.curY + 0.15
        ) {
          return true;
        }
      }
    }
    return false;
  }

  private spawnProjectile(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    friendly = false
  ): void {
    for (let i = 0; i < this.projectiles.length; i++) {
      const slot = this.projectiles[i];
      if (!slot.active) {
        slot.active = true;
        slot.friendly = friendly;
        slot.x = x;
        slot.y = y;
        slot.z = z;
        slot.vx = vx;
        slot.vy = vy;
        slot.life = 4.2;
        slot.mesh.visible = true;
        slot.mesh.position.set(x, y, z);
        return;
      }
    }
  }

  public step(dt: number, inp: PlatformerStepInput, out: PlatformerStepResult): void {
    // Reset frame output cleanly (zero allocations)
    out.floorY = -999;
    out.carryDX = 0;
    out.carryDY = 0;
    out.carryDZ = 0;
    out.wallPushX = 0;
    out.wallContactDir = 0;
    out.surfaceFriction = 'normal';
    out.conveyorVX = 0;
    out.speedBoostVX = 0;
    out.gravityScale = 1;
    out.gravitySign = 1;
    out.inWaterZone = false;
    out.waterSurfaceY = 0;
    out.oxygenPct = this.oxygenPct;
    out.oxygenActive = false;
    out.windAccelX = 0;
    out.windAccelY = 0;
    out.sizeScale = this.heroSizeScale;
    out.hasLantern = this.hasLantern;
    out.climbCandidate = null;
    out.activeControlMode = 'none';
    out.hasOverridePos = false;
    out.overrideX = inp.heroX;
    out.overrideY = inp.heroY;
    out.overrideZ = inp.heroZ;
    out.hasOverrideVel = false;
    out.overrideVX = 0;
    out.overrideVY = 0;
    out.timeDilation = 1;
    out.refillAirMoves = false;
    out.bounceHeroVY = 0;
    out.damageHero = 0;
    out.collectCoins = 0;
    out.starCoinsMask = this.starCoinsMask;
    out.starCoinsCount =
      ((this.starCoinsMask & 1) ? 1 : 0) +
      ((this.starCoinsMask & 2) ? 1 : 0) +
      ((this.starCoinsMask & 4) ? 1 : 0);
    out.checkpointReached = null;
    out.goalReached = null;
    out.toastMessage = null;
    out.soundEvent = null;

    this.lockReleaseCooldown = Math.max(0, this.lockReleaseCooldown - dt);
    this.portalCooldown = Math.max(0, this.portalCooldown - dt);

    // Track global jump toggle count for 'toggleOnJump' rhythm platforms
    const jumpedThisStep = inp.jumpCountSeq !== this.lastJumpSeq;
    if (jumpedThisStep) {
      this.lastJumpSeq = inp.jumpCountSeq;
      for (let i = 0; i < this.nodes.length; i++) {
        const n = this.nodes[i];
        if (n.mod === 'rhythmPlatform' && n.cfg.toggleOnJump) {
          n.active = !n.active;
        }
      }
    }

    // Global BPM World Pulse
    const bpm = Math.max(40, Math.min(220, this.tuning.bpm || 116));
    const totalBeats = (inp.timeElapsed * bpm) / 60;
    const beatFrac = totalBeats - Math.floor(totalBeats);
    const beatIndex = Math.floor(totalBeats);
    const bpmPulseNorm = this.tuning.rhythmPulseEnabled
      ? Math.max(0, 1 - beatFrac * 3.8)
      : 0;
    out.bpmPulseNorm = bpmPulseNorm;
    const onBeatBonus = this.tuning.rhythmPulseEnabled && (beatFrac < 0.24 || beatFrac > 0.85);

    // Rising Hazard Tide update
    if (this.tuning.risingTideEnabled && this.risingTideY !== null) {
      const minY = this.tuning.risingTideMinY;
      const maxY = Math.max(minY + 1, this.tuning.risingTideMaxY);
      this.risingTideY += this.risingTideDir * this.tuning.risingTideSpeed * dt;
      if (this.risingTideY >= maxY) {
        this.risingTideY = maxY;
        this.risingTideDir = -1;
      } else if (this.risingTideY <= minY) {
        this.risingTideY = minY;
        this.risingTideDir = 1;
      }
      if (this.risingTideMesh) {
        this.risingTideMesh.position.set(
          inp.heroX,
          this.risingTideY - 0.7 + Math.sin(inp.timeElapsed * 2.5) * 0.04,
          0
        );
      }
      out.risingTideY = this.risingTideY;
      if (inp.heroY < this.risingTideY - 0.25) {
        out.damageHero = Math.max(out.damageHero, 1);
        out.bounceHeroVY = Math.max(out.bounceHeroVY, 11.5);
        out.toastMessage =
          this.tuning.risingTideType === 'lava'
            ? 'Burned by rising lava!'
            : this.tuning.risingTideType === 'toxic'
            ? 'Stung by rising toxic tide!'
            : 'Swept by surging floodwater!';
        out.soundEvent = 'hurt';
      }
    } else {
      out.risingTideY = null;
    }

    // Record hero movement for Ghost Echo Time-Clone
    this.ghostRecordAccum += dt;
    if (this.ghostRecordAccum >= 0.05) {
      this.ghostRecordAccum -= 0.05;
      this.ghostHistory.push({ x: inp.heroX, y: inp.heroY, z: inp.heroZ });
      if (this.ghostHistory.length > 60) {
        this.ghostHistory.shift();
      }
    }

    // Advance Ghost Clone replay if triggered
    let ghostActiveHere = false;
    if (this.ghostPlaybackActive && this.ghostHistory.length > 4 && this.ghostMesh) {
      this.ghostPlaybackTimer -= dt;
      if (this.ghostPlaybackTimer <= 0) {
        this.ghostPlaybackActive = false;
        this.ghostMesh.visible = false;
      } else {
        ghostActiveHere = true;
        this.ghostMesh.visible = true;
        const speedIdx = ((3.0 - this.ghostPlaybackTimer) * 20) % this.ghostHistory.length;
        const samp = this.ghostHistory[Math.floor(speedIdx) % this.ghostHistory.length];
        this.ghostPos.set(samp.x, samp.y, samp.z);
        this.ghostMesh.position.copy(this.ghostPos);
        this.ghostPlaybackIndex = Math.floor(speedIdx);
        // Ghost acts as temporary elevated platform too!
        if (
          Math.abs(inp.heroX - this.ghostPos.x) < 0.75 &&
          Math.abs(inp.heroZ - this.ghostPos.z) < 0.85 &&
          inp.heroVelY <= 0.4 &&
          inp.heroY >= this.ghostPos.y + 1.1 &&
          inp.heroY <= this.ghostPos.y + 2.05
        ) {
          out.floorY = Math.max(out.floorY, this.ghostPos.y + 1.55);
        }
      }
    } else if (this.ghostMesh) {
      this.ghostMesh.visible = false;
    }

    // 1. Update timers & positions for all modular platformer nodes
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      n.prevX = n.curX;
      n.prevY = n.curY;
      n.prevZ = n.curZ;
      if (n.cooldownTimer > 0) n.cooldownTimer = Math.max(0, n.cooldownTimer - dt);
      if (n.timerRemaining > 0) {
        n.timerRemaining = Math.max(0, n.timerRemaining - dt);
        if (n.timerRemaining === 0 && n.cfg.channelId) {
          this.channelActive.set(n.cfg.channelId, false);
        }
      }

      const cfg = n.cfg;
      const spd = cfg.speed ?? 3.0;
      const distSpan = cfg.distance ?? 6.5;

      // Dynamic moving platforms
      if (
        n.mod === 'shuttlePlatform' ||
        n.mod === 'elevatorPlatform' ||
        n.mod === 'orbitPlatform' ||
        n.mod === 'splinePlatform'
      ) {
        if (n.triggered) n.motionTime += dt;
        const pause = cfg.pauseSec ?? 0;
        if (n.mod === 'shuttlePlatform' || cfg.motionPattern === 'shuttle') {
          const halfPeriod = Math.max(0.4, distSpan / Math.max(0.25, spd)) + pause;
          const cyc = (n.motionTime % (halfPeriod * 2)) / halfPeriod;
          let u = cyc <= 1 ? cyc : 2 - cyc;
          const travelFrac = (halfPeriod - pause) / halfPeriod;
          u = THREE.MathUtils.clamp(u / Math.max(0.05, travelFrac), 0, 1);
          const smooth = u * u * (3 - 2 * u);
          n.curX = n.originX + smooth * distSpan;
          n.curY = n.originY;
        } else if (n.mod === 'elevatorPlatform' || cfg.motionPattern === 'elevator') {
          const halfPeriod = Math.max(0.4, distSpan / Math.max(0.25, spd)) + pause;
          const cyc = (n.motionTime % (halfPeriod * 2)) / halfPeriod;
          let u = cyc <= 1 ? cyc : 2 - cyc;
          const travelFrac = (halfPeriod - pause) / halfPeriod;
          u = THREE.MathUtils.clamp(u / Math.max(0.05, travelFrac), 0, 1);
          const smooth = u * u * (3 - 2 * u);
          n.curX = n.originX;
          n.curY = n.originY + smooth * distSpan;
        } else if (n.mod === 'orbitPlatform') {
          const ang = n.motionTime * Math.max(0.4, spd);
          const r = distSpan * 0.6;
          if (cfg.motionPattern === 'figure8') {
            n.curX = n.originX + Math.sin(ang) * r * 1.4;
            n.curY = n.originY + Math.sin(ang * 2) * r * 0.7;
          } else {
            n.curX = n.originX + Math.cos(ang) * r;
            n.curY = n.originY + Math.sin(ang) * r;
          }
        } else if (n.mod === 'splinePlatform') {
          const pts = cfg.waypoints?.length
            ? cfg.waypoints
            : [
                [0, 0, 0],
                [6, 3.2, 0],
                [12, 1.0, 0],
              ];
          const segCount = Math.max(1, pts.length - 1);
          const cycDur = Math.max(1.5, (segCount * 6) / Math.max(0.4, spd));
          const cyc = (n.motionTime % (cycDur * 2)) / cycDur;
          const pingPong = cyc <= 1 ? cyc : 2 - cyc;
          const scaled = pingPong * segCount;
          const idx = Math.min(segCount - 1, Math.floor(scaled));
          const frac = scaled - idx;
          const a = pts[idx];
          const b = pts[idx + 1];
          n.curX = n.originX + THREE.MathUtils.lerp(a[0], b[0], frac);
          n.curY = n.originY + THREE.MathUtils.lerp(a[1], b[1], frac);
          n.curZ = n.originZ + THREE.MathUtils.lerp(a[2], b[2], frac);
        }
        n.mesh.position.set(n.curX, n.curY, n.curZ);
      } else if (n.mod === 'crumblingPlatform') {
        const body = n.mesh.userData.crumbleBody as THREE.Object3D | undefined;
        if (n.crumbleState === 'shaking') {
          n.crumbleTimer -= dt;
          if (body) {
            body.position.x = (Math.random() - 0.5) * 0.14;
            body.position.y = (Math.random() - 0.5) * 0.08;
          }
          if (n.crumbleTimer <= 0) {
            n.crumbleState = 'fallen';
            n.crumbleTimer = cfg.respawnSec ?? 3.0;
            n.alive = false;
            out.soundEvent = 'hit';
          }
        } else if (n.crumbleState === 'fallen') {
          n.mesh.position.y -= dt * 11;
          if (n.mesh.position.y < n.originY - 9) {
            n.mesh.visible = false;
          }
          if ((cfg.respawnSec ?? 3.0) > 0) {
            n.crumbleTimer -= dt;
            if (n.crumbleTimer <= 0) {
              n.crumbleState = 'idle';
              n.alive = true;
              n.mesh.visible = true;
              n.mesh.position.set(n.originX, n.originY, n.originZ);
              if (body) body.position.set(0, 0, 0);
            }
          }
        }
      } else if (n.mod === 'rhythmPlatform') {
        if (!cfg.toggleOnJump) {
          const div = cfg.beatDivision ?? 2;
          const offset = cfg.phaseOffset ?? 0;
          n.active = Math.floor((beatIndex + offset) / div) % 2 === 0;
        }
        const rm = n.mesh.userData.rhythmMesh as THREE.Mesh | undefined;
        const mat = n.mesh.userData.rhythmMat as THREE.MeshStandardMaterial | undefined;
        if (rm && mat) {
          mat.opacity = n.active ? 1.0 : 0.24;
          mat.emissiveIntensity = n.active ? 0.35 + bpmPulseNorm * 0.45 : 0.05;
          const pulseScale = n.active ? 1 + bpmPulseNorm * 0.04 : 0.94;
          rm.scale.setScalar(pulseScale);
        }
      } else if (n.mod === 'seesawPlatform') {
        const stiff = cfg.tiltStiffness ?? 2.2;
        n.tiltAngVel += (-n.tiltAngle * stiff * 2.4 - n.tiltAngVel * 3.1) * dt;
        n.tiltAngle = THREE.MathUtils.clamp(n.tiltAngle + n.tiltAngVel * dt, -0.48, 0.48);
        const deck = n.mesh.userData.seesawDeck as THREE.Object3D | undefined;
        if (deck) deck.rotation.z = n.tiltAngle;
      } else if (n.mod === 'conveyorBelt') {
        const chevs = n.mesh.userData.conveyorChevrons as THREE.Object3D | undefined;
        if (chevs) {
          const cs = cfg.conveyorSpeed ?? 4.5;
          chevs.position.x = ((inp.timeElapsed * cs * 0.4) % 0.85) - 0.42;
        }
      } else if (n.mod === 'barrelCannon') {
        if (cfg.cannonAutoRotate) {
          n.cannonAngleRad = Math.PI * 0.5 + Math.sin(inp.timeElapsed * (cfg.cannonRotateSpeed ?? 1.6)) * 0.85;
        } else {
          n.cannonAngleRad = THREE.MathUtils.degToRad(cfg.cannonAngleDeg ?? 45);
        }
        const piv = n.mesh.userData.barrelPivot as THREE.Object3D | undefined;
        if (piv) piv.rotation.z = Math.PI * 0.5 - n.cannonAngleRad;
      } else if (n.mod === 'swingVine') {
        const freq = Math.sqrt(18 / Math.max(2, cfg.ropeLength ?? 4.8));
        if (this.lockMode === 'vine' && this.lockNode === n) {
          const pump = inp.moveX * 6.5;
          n.swingAngVel += (pump - Math.sin(n.swingAngle) * freq * freq * 1.45 - n.swingAngVel * 0.4) * dt;
        } else {
          n.swingAngVel += (-Math.sin(n.swingAngle) * freq * freq - n.swingAngVel * 0.85) * dt;
        }
        n.swingAngle = THREE.MathUtils.clamp(n.swingAngle + n.swingAngVel * dt, -1.15, 1.15);
        const piv = n.mesh.userData.pendulumPivot as THREE.Object3D | undefined;
        if (piv) piv.rotation.z = n.swingAngle;
      } else if (n.mod === 'spikePendulum') {
        const piv = n.mesh.userData.pendulumPivot as THREE.Object3D | undefined;
        n.swingAngle = Math.sin(inp.timeElapsed * (cfg.speed ?? 2.0)) * 0.95;
        if (piv) piv.rotation.z = n.swingAngle;
      } else if (n.mod === 'firebar') {
        const piv = n.mesh.userData.firebarPivot as THREE.Object3D | undefined;
        if (piv) piv.rotation.z = inp.timeElapsed * (cfg.speed ?? 1.9);
      } else if (n.mod === 'retractSpikes') {
        const cyc = (inp.timeElapsed * (cfg.speed ?? 1.2)) % 3.2;
        const extended = cyc < 1.65;
        n.active = extended;
        const sp = n.mesh.userData.spikesGroup as THREE.Object3D | undefined;
        if (sp) {
          const targetY = extended ? 0.08 : -0.58;
          sp.position.y = THREE.MathUtils.damp(sp.position.y, targetY, 16, dt);
        }
      } else if (n.mod === 'thwompBlock') {
        const body = n.mesh.userData.thwompBody as THREE.Object3D | undefined;
        const dropDist = Math.max(2.5, cfg.distance ?? 5.5);
        if (n.thwompState === 'idle') {
          if (
            Math.abs(inp.heroX - n.curX) < n.width * 0.65 &&
            inp.heroY < n.curY + 0.5 &&
            inp.heroY > n.curY - dropDist - 1.5
          ) {
            n.thwompState = 'dropping';
          }
        } else if (n.thwompState === 'dropping') {
          n.curY -= 19.5 * dt;
          if (n.curY <= n.originY - dropDist) {
            n.curY = n.originY - dropDist;
            n.thwompState = 'resting';
            n.thwompTimer = 0.75;
            out.soundEvent = 'hit';
          }
        } else if (n.thwompState === 'resting') {
          n.thwompTimer -= dt;
          if (n.thwompTimer <= 0) n.thwompState = 'rising';
        } else if (n.thwompState === 'rising') {
          n.curY += (cfg.speed ?? 2.8) * dt;
          if (n.curY >= n.originY) {
            n.curY = n.originY;
            n.thwompState = 'idle';
          }
        }
        if (body) body.position.y = n.curY - n.originY;
      } else if (n.mod === 'shadowZone') {
        const lit = this.hasLantern || !cfg.requiresLantern;
        n.active = lit;
        const mat = n.mesh.userData.shadowMat as THREE.MeshStandardMaterial | undefined;
        if (mat) {
          mat.opacity = lit ? 0.96 : 0.14;
          mat.emissiveIntensity = lit ? 0.45 : 0.04;
        }
      } else if (n.mod === 'lockedDoor') {
        const chOpen = cfg.channelId ? Boolean(this.channelActive.get(cfg.channelId)) : false;
        n.channelOpen = n.triggered || chOpen;
        const door = n.mesh.userData.gateDoor as THREE.Object3D | undefined;
        if (door) {
          const targetY = n.channelOpen ? 3.8 : 1.75;
          door.position.y = THREE.MathUtils.damp(door.position.y, targetY, 8, dt);
        }
      } else if (n.mod === 'starGateway') {
        const req = cfg.requiredTokens ?? 2;
        const have =
          cfg.tokenType === 'coins'
            ? inp.coinsCount
            : cfg.tokenType === 'keys'
            ? inp.keysCount
            : out.starCoinsCount;
        n.channelOpen = have >= req;
        const door = n.mesh.userData.gateDoor as THREE.Object3D | undefined;
        if (door) {
          const targetY = n.channelOpen ? 4.0 : 1.75;
          door.position.y = THREE.MathUtils.damp(door.position.y, targetY, 8, dt);
        }
      } else if (n.mod === 'dashCrystal' || n.mod === 'bashLantern') {
        if (n.cooldownTimer > 0) {
          n.active = false;
          n.mesh.scale.setScalar(0.32);
        } else {
          n.active = true;
          n.mesh.scale.setScalar(1 + bpmPulseNorm * 0.12);
        }
      } else if (n.mod === 'starCoin') {
        const sm = n.mesh.userData.starMesh as THREE.Object3D | undefined;
        if (sm) {
          sm.rotation.y = inp.timeElapsed * 2.2;
          sm.position.y = 1.0 + Math.sin(inp.timeElapsed * 2.8) * 0.14;
        }
      } else if (n.mod === 'boostRing') {
        const rm = n.mesh.userData.ringMesh as THREE.Object3D | undefined;
        if (rm) {
          rm.rotation.z = inp.timeElapsed * 2.1;
          rm.scale.setScalar(1 + bpmPulseNorm * 0.08);
        }
      } else if (n.mod === 'windTunnel') {
        n.mesh.traverse((c) => {
          if (c.userData?.windChevron) {
            c.position.y =
              ((c.position.y + dt * 2.5) % Math.max(2, n.height)) || 0.2;
          }
        });
      }
    }

    // Check Switch / Pressure Plate occupancy (Hero, PushCrate, OR Ghost Clone!)
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      if (n.mod !== 'triggerSwitch' && n.mod !== 'shootTarget') continue;
      let pressed = false;
      if (n.mod === 'triggerSwitch') {
        const heroOn =
          Math.abs(inp.heroX - n.curX) < n.width * 0.55 &&
          Math.abs(inp.heroY - n.curY) < 1.1 &&
          Math.abs(inp.heroZ - n.curZ) < 1.1;
        const ghostOn =
          ghostActiveHere &&
          Math.abs(this.ghostPos.x - n.curX) < n.width * 0.55 &&
          Math.abs(this.ghostPos.y - n.curY) < 1.25;
        let crateOn = false;
        for (let k = 0; k < this.nodes.length; k++) {
          const c = this.nodes[k];
          if (c.mod === 'pushCrate' && c.alive) {
            if (Math.abs(c.curX - n.curX) < 1.15 && Math.abs(c.curY - n.curY) < 1.0) {
              crateOn = true;
              break;
            }
          }
        }
        pressed = heroOn || ghostOn || crateOn;
      }
      if (pressed || n.timerRemaining > 0) {
        if (!n.active && n.cfg.channelId) {
          this.channelActive.set(n.cfg.channelId, true);
          if ((n.cfg.timerSec ?? 0) > 0) {
            n.timerRemaining = n.cfg.timerSec!;
          }
          out.soundEvent = 'chime';
          out.toastMessage = `Channel "${n.cfg.channelId}" activated!`;
        }
        n.active = true;
      } else if ((n.cfg.timerSec ?? 0) === 0 && n.mod === 'triggerSwitch') {
        // Plate releases if no timer
        n.active = false;
        if (n.cfg.channelId) this.channelActive.set(n.cfg.channelId, false);
      }
      const plate = n.mesh.userData.switchPlate as THREE.Object3D | undefined;
      if (plate) {
        plate.position.y = THREE.MathUtils.damp(plate.position.y, n.active ? 0.04 : 0.14, 15, dt);
      }
    }

    // 2. Pushable / Throwable Crates & Follower Keys & Secret Walls
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      if (!n.alive) continue;

      if (n.mod === 'followerKey') {
        if (!n.keyConsumed) {
          if (!n.keyFollowed) {
            if (Math.hypot(inp.heroX - n.curX, inp.heroY - n.curY) < 1.45) {
              n.keyFollowed = true;
              out.soundEvent = 'coin';
              out.toastMessage = 'Collected trailing Key!';
            }
          } else {
            const targetX = inp.heroX - inp.heroFacingSign * 1.1;
            const targetY = inp.heroY + 1.15 + Math.sin(inp.timeElapsed * 3.8) * 0.15;
            n.curX = THREE.MathUtils.damp(n.curX, targetX, 6.5, dt);
            n.curY = THREE.MathUtils.damp(n.curY, targetY, 6.5, dt);
            n.curZ = THREE.MathUtils.damp(n.curZ, inp.heroZ, 6.5, dt);
            n.mesh.position.set(n.curX, n.curY, n.curZ);
            // Unlock matching lockedDoor on proximity
            for (let j = 0; j < this.nodes.length; j++) {
              const gate = this.nodes[j];
              if (gate.mod === 'lockedDoor' && !gate.channelOpen) {
                const sameChannel =
                  !gate.cfg.channelId ||
                  !n.cfg.channelId ||
                  gate.cfg.channelId === n.cfg.channelId;
                if (sameChannel && Math.hypot(n.curX - gate.curX, n.curY - gate.curY) < 2.6) {
                  gate.triggered = true;
                  gate.channelOpen = true;
                  n.keyConsumed = true;
                  n.alive = false;
                  n.mesh.visible = false;
                  out.soundEvent = 'creak';
                  out.toastMessage = `Unlocked ${gate.entity.name}!`;
                  break;
                }
              }
            }
          }
        }
      } else if (n.mod === 'pushCrate') {
        // Carry/throw OR walk-to-push
        const distHero = Math.hypot(inp.heroX - n.curX, inp.heroY - n.curY);
        if (n.crateCarried) {
          n.curX = inp.heroX + inp.heroFacingSign * 0.72;
          n.curY = inp.heroY + 1.35 * this.heroSizeScale;
          n.curZ = inp.heroZ;
          n.crateVY = 0;
          if (inp.interactJustPressed) {
            n.crateCarried = false;
            n.crateVX = inp.heroFacingSign * 11.5;
            n.crateVY = 5.5;
            out.soundEvent = 'whoosh';
          }
        } else {
          if (inp.interactJustPressed && distHero < 1.65) {
            n.crateCarried = true;
            out.soundEvent = 'whoosh';
          } else {
            // Walk-to-push horizontally
            const halfC = n.width * 0.5;
            if (
              Math.abs(inp.heroY - n.curY) < n.height * 0.75 &&
              Math.abs(inp.heroZ - n.curZ) < n.depth * 0.6 &&
              Math.abs(inp.heroX - n.curX) < halfC + inp.heroRadius + 0.12 &&
              Math.abs(inp.moveX) > 0.15
            ) {
              const pushSign = Math.sign(n.curX - inp.heroX) || inp.heroFacingSign;
              if (Math.sign(inp.moveX) === pushSign) {
                n.crateVX = pushSign * 3.4;
              }
            }
            n.crateVY -= 18 * dt;
            n.curX += n.crateVX * dt;
            n.curY += n.crateVY * dt;
            n.crateVX = THREE.MathUtils.damp(n.crateVX, 0, 8, dt);
            if (n.curY <= n.originY) {
              n.curY = n.originY;
              n.crateVY = 0;
            }
            // Crate smashes armored/spiked enemies or shoot targets while fast-moving!
            if (Math.abs(n.crateVX) > 4.5) {
              for (let j = 0; j < this.nodes.length; j++) {
                const target = this.nodes[j];
                if (!target.alive) continue;
                if (
                  (target.mod === 'enemySpiked' ||
                    target.mod === 'enemyPatroller' ||
                    target.mod === 'enemyFlyer' ||
                    target.mod === 'enemyCharger' ||
                    target.mod === 'enemyTurret') &&
                  Math.hypot(n.curX - target.curX, n.curY - target.curY) < 1.35
                ) {
                  target.alive = false;
                  target.enemyState = 'dead';
                  target.mesh.visible = false;
                  out.collectCoins += 3;
                  out.soundEvent = 'hit';
                  out.toastMessage = `Smashed ${target.entity.name} with crate!`;
                }
              }
            }
          }
          // Crate top acts as stepping stone
          if (
            Math.abs(inp.heroX - n.curX) < n.width * 0.55 &&
            Math.abs(inp.heroZ - n.curZ) < n.depth * 0.55 &&
            inp.heroVelY <= 0.4 &&
            inp.heroY >= n.curY + n.height - 0.45 &&
            inp.heroY <= n.curY + n.height + 0.45
          ) {
            out.floorY = Math.max(out.floorY, n.curY + n.height);
          }
        }
        n.mesh.position.set(n.curX, n.curY, n.curZ);
      } else if (n.mod === 'secretWall') {
        const inside =
          Math.abs(inp.heroX - n.curX) < n.width * 0.58 &&
          Math.abs(inp.heroY - (n.curY + n.height * 0.5)) < n.height * 0.58;
        const targetAlpha = inside ? 0.18 : 1.0;
        n.secretAlpha = THREE.MathUtils.damp(n.secretAlpha, targetAlpha, 10, dt);
        const sm = n.mesh.userData.secretMat as THREE.MeshStandardMaterial | undefined;
        if (sm) sm.opacity = n.secretAlpha;
      }
    }

    // 3. Special Lock-On Modes: Barrel Cannon / Swinging Vine / Grapple / Grind Rail / Bash Aim
    // Hide helper meshes unless active
    for (let i = 0; i < this.cannonArcDots.length; i++) this.cannonArcDots[i].visible = false;
    if (this.grappleLine) this.grappleLine.visible = false;
    if (this.bashArrowGroup) this.bashArrowGroup.visible = false;

    if (this.lockMode === 'cannon' && this.lockNode) {
      const c = this.lockNode;
      out.activeControlMode = 'cannon';
      out.hasOverridePos = true;
      out.overrideX = c.curX;
      out.overrideY = c.curY + 0.55;
      out.overrideZ = c.curZ;
      out.hasOverrideVel = true;
      out.overrideVX = 0;
      out.overrideVY = 0;
      if (!c.cfg.cannonAutoRotate && Math.abs(inp.moveX) > 0.15) {
        c.cannonAngleRad = THREE.MathUtils.clamp(
          c.cannonAngleRad - inp.moveX * 1.45 * dt,
          0.15,
          Math.PI - 0.15
        );
        c.cfg.cannonAngleDeg = Math.round(THREE.MathUtils.radToDeg(c.cannonAngleRad));
      }
      const pwr = c.cfg.cannonPower ?? 20;
      const vx = Math.cos(c.cannonAngleRad) * pwr;
      const vy = Math.sin(c.cannonAngleRad) * pwr;
      for (let d = 0; d < this.cannonArcDots.length; d++) {
        const st = (d + 1) * 0.085;
        const dot = this.cannonArcDots[d];
        dot.visible = true;
        dot.position.set(
          c.curX + vx * st,
          c.curY + 0.9 + vy * st - 0.5 * 19.5 * st * st,
          c.curZ
        );
      }
      if (inp.jumpJustPressed || inp.interactJustPressed) {
        this.lockMode = 'none';
        this.lockNode = null;
        this.lockReleaseCooldown = 0.28;
        out.hasOverrideVel = true;
        out.overrideVX = vx;
        out.overrideVY = vy;
        out.refillAirMoves = true;
        out.soundEvent = 'whoosh';
      }
      return;
    }

    if (this.lockMode === 'vine' && this.lockNode) {
      const v = this.lockNode;
      const len = Math.max(2.2, v.cfg.ropeLength ?? 4.8);
      const anchorY = v.curY + len;
      if (Math.abs(inp.moveZ) > 0.15) {
        // climb up/down vine
        this.lockParam = THREE.MathUtils.clamp(this.lockParam - inp.moveZ * 3.5 * dt, 1.0, len - 0.35);
      }
      const hx = v.curX + Math.sin(v.swingAngle) * this.lockParam;
      const hy = anchorY - Math.cos(v.swingAngle) * this.lockParam - 0.7;
      out.activeControlMode = 'vine';
      out.hasOverridePos = true;
      out.overrideX = hx;
      out.overrideY = hy;
      out.overrideZ = v.curZ;
      out.hasOverrideVel = true;
      out.overrideVX = 0;
      out.overrideVY = 0;
      if (inp.jumpJustPressed) {
        const tangVX = Math.cos(v.swingAngle) * v.swingAngVel * this.lockParam;
        this.lockMode = 'none';
        this.lockNode = null;
        this.lockReleaseCooldown = 0.32;
        out.hasOverrideVel = true;
        out.overrideVX = tangVX + inp.moveX * 6.5;
        out.overrideVY = 11.4;
        out.refillAirMoves = true;
        out.soundEvent = 'jump';
      }
      return;
    }

    if (this.lockMode === 'grapple' && this.lockNode) {
      const g = this.lockNode;
      const anchorY = g.curY + 0.5;
      if (this.grappleLine) {
        this.grappleLine.visible = true;
        const posAttr = this.grappleLine.geometry.getAttribute('position') as THREE.BufferAttribute;
        posAttr.setXYZ(0, inp.heroX, inp.heroY + 1.0, inp.heroZ);
        posAttr.setXYZ(1, g.curX, anchorY, g.curZ);
        posAttr.needsUpdate = true;
      }
      const len = Math.max(2.0, this.lockParam);
      g.swingAngVel += (inp.moveX * 7.2 - Math.sin(g.swingAngle) * 22 / len - g.swingAngVel * 0.35) * dt;
      g.swingAngle = THREE.MathUtils.clamp(g.swingAngle + g.swingAngVel * dt, -1.25, 1.25);
      // Pull slightly closer while holding interact
      if (inp.interactHeld) {
        this.lockParam = Math.max(1.8, this.lockParam - 4.2 * dt);
      }
      out.activeControlMode = 'grapple';
      out.hasOverridePos = true;
      out.overrideX = g.curX + Math.sin(g.swingAngle) * this.lockParam;
      out.overrideY = anchorY - Math.cos(g.swingAngle) * this.lockParam - 0.6;
      out.overrideZ = g.curZ;
      out.hasOverrideVel = true;
      out.overrideVX = 0;
      out.overrideVY = 0;
      if (inp.jumpJustPressed || (!inp.interactHeld && inp.heroY > anchorY - 0.5)) {
        const launchVX = Math.cos(g.swingAngle) * g.swingAngVel * this.lockParam + inp.moveX * 5.2;
        this.lockMode = 'none';
        this.lockNode = null;
        this.lockReleaseCooldown = 0.28;
        if (this.grappleLine) this.grappleLine.visible = false;
        out.hasOverrideVel = true;
        out.overrideVX = launchVX;
        out.overrideVY = 11.8;
        out.refillAirMoves = true;
        out.soundEvent = 'whoosh';
      }
      return;
    }

    if (this.lockMode === 'rail' && this.lockNode) {
      const r = this.lockNode;
      const halfW = r.width * 0.5;
      const railDir = Math.abs(inp.moveX) > 0.15 ? Math.sign(inp.moveX) : inp.heroFacingSign;
      this.lockParam += railDir * (r.cfg.speed ?? 10.5) * dt;
      const arcLift = Math.sin(((this.lockParam + halfW) / Math.max(1, r.width)) * Math.PI) * 0.45;
      out.activeControlMode = 'rail';
      out.hasOverridePos = true;
      out.overrideX = r.curX + this.lockParam;
      out.overrideY =
        r.cfg.railType === 'zipline' ? r.curY + 0.15 - (this.lockParam / halfW) * 0.5 : r.curY + 1.0 + arcLift;
      out.overrideZ = r.curZ;
      out.hasOverrideVel = true;
      out.overrideVX = railDir * (r.cfg.speed ?? 10.5);
      out.overrideVY = 0;
      if (inp.jumpJustPressed || Math.abs(this.lockParam) > halfW + 0.2) {
        this.lockMode = 'none';
        this.lockNode = null;
        this.lockReleaseCooldown = 0.24;
        out.hasOverrideVel = true;
        out.overrideVX = railDir * (r.cfg.speed ?? 10.5);
        out.overrideVY = inp.jumpJustPressed ? 11.2 : 1.5;
        out.refillAirMoves = true;
        if (inp.jumpJustPressed) out.soundEvent = 'jump';
      }
      return;
    }

    if (this.lockMode === 'bashAim' && this.lockNode) {
      out.activeControlMode = 'bashAim';
      out.timeDilation = 0.12;
      this.bashTimer -= dt;
      if (Math.abs(inp.moveX) > 0.1 || Math.abs(inp.moveZ) > 0.1) {
        this.bashLaunchAngle = Math.atan2(-inp.moveZ || 0.7, inp.moveX || inp.heroFacingSign * 0.5);
      }
      if (this.bashArrowGroup) {
        this.bashArrowGroup.visible = true;
        this.bashArrowGroup.position.set(this.lockNode.curX, this.lockNode.curY + 0.45, this.lockNode.curZ);
        this.bashArrowGroup.rotation.z = this.bashLaunchAngle - Math.PI * 0.5;
      }
      out.hasOverridePos = true;
      out.overrideX = this.lockNode.curX;
      out.overrideY = this.lockNode.curY + 0.2;
      out.overrideZ = this.lockNode.curZ;
      out.hasOverrideVel = true;
      out.overrideVX = 0;
      out.overrideVY = 0;
      if (!inp.interactHeld || inp.jumpJustPressed || this.bashTimer <= 0) {
        const pwr = this.lockNode.cfg.bounceForce ?? 17.5;
        this.lockNode.cooldownTimer = 0.9;
        // Fire harmless opposite orb / bash impulse!
        this.spawnProjectile(
          this.lockNode.curX,
          this.lockNode.curY + 0.6,
          this.lockNode.curZ,
          -Math.cos(this.bashLaunchAngle) * 14,
          -Math.sin(this.bashLaunchAngle) * 14,
          true
        );
        this.lockMode = 'none';
        this.lockNode = null;
        this.lockReleaseCooldown = 0.26;
        if (this.bashArrowGroup) this.bashArrowGroup.visible = false;
        out.hasOverrideVel = true;
        out.overrideVX = Math.cos(this.bashLaunchAngle) * pwr;
        out.overrideVY = Math.sin(this.bashLaunchAngle) * pwr;
        out.refillAirMoves = true;
        out.soundEvent = 'sparkle';
      }
      return;
    }

    // 4. Advance Projectile Pool & Check Collisions (with Hero & Turret/Bash Targets)
    for (let i = 0; i < this.projectiles.length; i++) {
      const p = this.projectiles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.mesh.position.set(p.x, p.y, p.z);
      if (p.friendly) {
        // Friendly bash projectile can activate shootTarget switches or stun enemies
        for (let j = 0; j < this.nodes.length; j++) {
          const target = this.nodes[j];
          if (!target.alive) continue;
          if (target.mod === 'shootTarget' && Math.hypot(p.x - target.curX, p.y - (target.curY + 1.0)) < 1.15) {
            target.active = true;
            if (target.cfg.channelId) this.channelActive.set(target.cfg.channelId, true);
            target.timerRemaining = target.cfg.timerSec ?? 4;
            p.active = false;
            p.mesh.visible = false;
            out.soundEvent = 'chime';
          } else if (
            (target.mod === 'enemyPatroller' ||
              target.mod === 'enemyFlyer' ||
              target.mod === 'enemyCharger' ||
              target.mod === 'enemyTurret' ||
              target.mod === 'enemySpiked') &&
            Math.hypot(p.x - target.curX, p.y - (target.curY + 0.8)) < 1.1
          ) {
            target.alive = false;
            target.enemyState = 'dead';
            target.mesh.visible = false;
            p.active = false;
            p.mesh.visible = false;
            out.collectCoins += 2;
            out.soundEvent = 'hit';
          }
        }
      } else {
        const dHero = Math.hypot(p.x - inp.heroX, p.y - (inp.heroY + 0.85));
        if (dHero < 0.82) {
          if (inp.isDashing) {
            // Parry / reflect with dash!
            p.friendly = true;
            p.vx = -p.vx * 1.45;
            p.vy = 2.5;
            out.soundEvent = 'sparkle';
            out.toastMessage = 'Parried projectile!';
          } else {
            p.active = false;
            p.mesh.visible = false;
            out.damageHero = Math.max(out.damageHero, 1);
            out.soundEvent = 'hurt';
          }
        }
      }
    }

    // 5. Evaluate All Platform Surfaces, Triggers, Zones, Hazards, Enemies, & Flow Nodes
    let inWaterHere = false;
    let maxWaterSurf = -999;
    let oxygenRequiredHere = false;

    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      const cfg = n.cfg;

      // Platform Surfaces
      if (
        n.mod === 'shuttlePlatform' ||
        n.mod === 'elevatorPlatform' ||
        n.mod === 'orbitPlatform' ||
        n.mod === 'splinePlatform' ||
        n.mod === 'crumblingPlatform' ||
        n.mod === 'oneWayPlatform' ||
        n.mod === 'seesawPlatform' ||
        n.mod === 'rhythmPlatform' ||
        n.mod === 'iceSurface' ||
        n.mod === 'stickySurface' ||
        n.mod === 'conveyorBelt' ||
        n.mod === 'speedBoostPad' ||
        n.mod === 'shadowZone' ||
        n.mod === 'breakableBlock'
      ) {
        if (!n.alive || !n.active) continue;

        const hw = n.width * 0.5 + inp.heroRadius * 0.45;
        const hd = Math.max(1.4, n.depth * 0.5 + inp.heroRadius * 0.45);
        const insideXZ = Math.abs(inp.heroX - n.curX) < hw && Math.abs(inp.heroZ - n.curZ) < hd;

        // Breakable block special triggers (head-bonk / ground-pound / dash / giant)
        if (n.mod === 'breakableBlock') {
          const breakMode = cfg.breakBy ?? 'any';
          const matchesMode =
            breakMode === 'any' ||
            (breakMode === 'groundPound' && inp.isGroundPounding) ||
            (breakMode === 'dash' && inp.isDashing) ||
            (breakMode === 'giant' && this.heroSizeScale >= 1.4) ||
            (breakMode === 'headBonk' && inp.heroVelY > 1.2);
          // Upward head-bonk
          if (
            insideXZ &&
            inp.heroVelY > 0.5 &&
            inp.heroY + inp.heroHeight >= n.curY - 0.18 &&
            inp.heroY + inp.heroHeight <= n.curY + n.height * 0.55
          ) {
            if (matchesMode || breakMode === 'headBonk') {
              n.alive = false;
              n.mesh.visible = false;
              out.hasOverrideVel = true;
              out.overrideVX = inp.heroVelX;
              out.overrideVY = -2.2;
              out.collectCoins += 2;
              out.soundEvent = 'hit';
              continue;
            } else {
              out.hasOverrideVel = true;
              out.overrideVX = inp.heroVelX;
              out.overrideVY = -1.5;
            }
          }
          // Ground pound or dash from top/side
          if (
            insideXZ &&
            ((inp.isGroundPounding && inp.heroY <= n.curY + n.height + 0.4) ||
              (inp.isDashing && Math.abs(inp.heroY - n.curY) < n.height))
          ) {
            if (matchesMode) {
              n.alive = false;
              n.mesh.visible = false;
              out.soundEvent = 'hit';
              out.collectCoins += 1;
              continue;
            }
          }
          // Side wall contact check for Wall-Slide / Wall-Jump
          if (
            Math.abs(inp.heroZ - n.curZ) < hd &&
            inp.heroY < n.curY + n.height - 0.2 &&
            inp.heroY + inp.heroHeight > n.curY + 0.2
          ) {
            const dxWall = inp.heroX - n.curX;
            if (Math.abs(dxWall) < hw + 0.16 && Math.abs(dxWall) > hw - 0.45) {
              out.wallContactDir = dxWall > 0 ? -1 : 1;
            }
          }
        }

        if (!insideXZ) continue;

        let topY = n.curY + n.height;
        if (n.mod === 'seesawPlatform') {
          topY = n.curY + n.height + (inp.heroX - n.curX) * Math.tan(n.tiltAngle);
        }

        const isOneWay = n.mod === 'oneWayPlatform' || n.mod === 'shadowZone';
        if (isOneWay && inp.dropHeld) continue;

        const prevTopDelta = inp.heroY - topY;
        const canLandFromAbove =
          inp.heroVelY <= 0.45 && prevTopDelta >= -0.65 && prevTopDelta <= 0.55;
        if (canLandFromAbove) {
          out.floorY = Math.max(out.floorY, topY);
          // Standing on this surface
          if (inp.heroY <= topY + 0.25) {
            if (
              (n.mod === 'shuttlePlatform' ||
                n.mod === 'elevatorPlatform' ||
                n.mod === 'orbitPlatform' ||
                n.mod === 'splinePlatform') &&
              cfg.triggerOnStep &&
              !n.triggered
            ) {
              n.triggered = true;
              out.soundEvent = 'chime';
            }
            out.carryDX += n.curX - n.prevX;
            out.carryDY += n.curY - n.prevY;
            out.carryDZ += n.curZ - n.prevZ;

            if (n.mod === 'crumblingPlatform' && n.crumbleState === 'idle') {
              n.crumbleState = 'shaking';
              n.crumbleTimer = cfg.crumbleDelay ?? 0.65;
            } else if (n.mod === 'seesawPlatform') {
              const offset = inp.heroX - n.curX;
              n.tiltAngVel -= (offset / Math.max(1.5, n.width * 0.5)) * 4.2 * this.heroSizeScale * dt;
            } else if (n.mod === 'iceSurface') {
              out.surfaceFriction = 'ice';
            } else if (n.mod === 'stickySurface') {
              out.surfaceFriction = 'sticky';
            } else if (n.mod === 'conveyorBelt') {
              out.conveyorVX += cfg.conveyorSpeed ?? 4.5;
            } else if (n.mod === 'speedBoostPad') {
              out.speedBoostVX += (cfg.speed ?? 12.5) * (Math.abs(inp.moveX) > 0.1 ? Math.sign(inp.moveX) : inp.heroFacingSign);
              out.soundEvent = 'whoosh';
            }
          }
        }
        continue;
      }

      // Locked Door / Star Gateway horizontal wall collision & wall-slide contact
      if ((n.mod === 'lockedDoor' || n.mod === 'starGateway') && !n.channelOpen) {
        if (
          Math.abs(inp.heroZ - n.curZ) < n.depth * 0.6 + inp.heroRadius &&
          inp.heroY < n.curY + n.height &&
          inp.heroY + inp.heroHeight > n.curY
        ) {
          const dx = inp.heroX - n.curX;
          const minSep = n.width * 0.5 + inp.heroRadius;
          if (Math.abs(dx) < minSep) {
            out.wallPushX = (dx >= 0 ? 1 : -1) * (minSep - Math.abs(dx));
            out.wallContactDir = dx >= 0 ? -1 : 1;
            if (n.mod === 'starGateway' && Math.abs(inp.moveX) > 0.2) {
              out.toastMessage = `Need ${cfg.requiredTokens ?? 2} ${cfg.tokenType ?? 'stars'} to pass!`;
            }
          }
        }
        continue;
      }

      // Traversal Modules
      if (n.mod === 'barrelCannon' && this.lockReleaseCooldown <= 0) {
        if (Math.hypot(inp.heroX - n.curX, inp.heroY - (n.curY + 0.5)) < 1.25) {
          this.lockMode = 'cannon';
          this.lockNode = n;
          out.soundEvent = 'whoosh';
          out.toastMessage = 'Inside Cannon! Press Space to Blast!';
          return;
        }
      } else if (n.mod === 'swingVine' && this.lockReleaseCooldown <= 0) {
        const ropeLen = Math.max(2.2, cfg.ropeLength ?? 4.8);
        const anchorY = n.curY + ropeLen;
        const dx = inp.heroX - n.curX;
        const dy = anchorY - (inp.heroY + 0.8);
        const distFromAnchor = Math.hypot(dx, dy);
        if (
          Math.abs(inp.heroX - (n.curX + Math.sin(n.swingAngle) * Math.min(ropeLen, distFromAnchor))) < 1.2 &&
          inp.heroY + 0.8 >= n.curY - 0.4 &&
          inp.heroY <= anchorY + 0.2 &&
          (inp.interactJustPressed || Math.abs(inp.heroVelY) > 0.2)
        ) {
          this.lockMode = 'vine';
          this.lockNode = n;
          this.lockParam = THREE.MathUtils.clamp(distFromAnchor, 1.2, ropeLen - 0.3);
          n.swingAngVel = THREE.MathUtils.clamp(inp.heroVelX * 0.25, -2.5, 2.5);
          out.soundEvent = 'whoosh';
          return;
        }
      } else if (n.mod === 'grappleAnchor' && this.lockReleaseCooldown <= 0) {
        const radius = Math.max(3.5, cfg.distance ?? 7.5);
        const d = Math.hypot(inp.heroX - n.curX, inp.heroY + 0.9 - n.curY);
        if (d <= radius && inp.interactJustPressed) {
          this.lockMode = 'grapple';
          this.lockNode = n;
          this.lockParam = Math.max(2.0, d);
          n.swingAngle = Math.atan2(inp.heroX - n.curX, Math.max(0.5, n.curY - inp.heroY));
          n.swingAngVel = inp.heroVelX * 0.18;
          out.soundEvent = 'whoosh';
          return;
        }
      } else if (n.mod === 'bounceSpring' || n.mod === 'wallSpring') {
        const hitDist = Math.hypot(inp.heroX - n.curX, inp.heroY - (n.curY + 0.45));
        if (hitDist < 1.35 && n.cooldownTimer <= 0) {
          n.cooldownTimer = 0.22;
          const baseForce = cfg.bounceForce ?? 16.5;
          const superBonus = inp.jumpHeld ? cfg.superBounceBonus ?? 5.0 : 0;
          const beatBonus = onBeatBonus ? 2.8 : 0;
          const totalForce = baseForce + superBonus + beatBonus;
          const rad = THREE.MathUtils.degToRad(cfg.bounceAngleDeg ?? (n.mod === 'wallSpring' ? 50 : 90));
          out.hasOverrideVel = true;
          out.overrideVX = Math.cos(rad) * totalForce * (n.mod === 'wallSpring' ? (inp.heroX >= n.curX ? 1 : -1) : 1);
          out.overrideVY = Math.sin(rad) * totalForce;
          out.refillAirMoves = true;
          out.soundEvent = 'jump';
          const cap = n.mesh.userData.springCap as THREE.Object3D | undefined;
          if (cap) cap.position.y = 0.72;
        } else {
          const cap = n.mesh.userData.springCap as THREE.Object3D | undefined;
          if (cap) cap.position.y = THREE.MathUtils.damp(cap.position.y, 0.36, 12, dt);
        }
      } else if (n.mod === 'grindRail' && this.lockReleaseCooldown <= 0) {
        const hw = n.width * 0.5;
        if (
          Math.abs(inp.heroX - n.curX) <= hw &&
          Math.abs(inp.heroY - (n.curY + 0.9)) < 0.95 &&
          inp.heroVelY <= 1.2
        ) {
          this.lockMode = 'rail';
          this.lockNode = n;
          this.lockParam = inp.heroX - n.curX;
          out.soundEvent = 'whoosh';
          return;
        }
      } else if (n.mod === 'climbLadder' || n.mod === 'monkeyBars') {
        if (n.mod === 'climbLadder') {
          if (
            Math.abs(inp.heroX - n.curX) < n.width * 0.55 + 0.45 &&
            inp.heroY >= n.curY - 0.5 &&
            inp.heroY <= n.curY + n.height + 0.4
          ) {
            out.climbCandidate = {
              kind: cfg.climbType === 'grate' ? 'grate' : 'ladder',
              anchorX: n.curX,
              anchorY: n.curY,
              minY: n.curY,
              maxY: n.curY + n.height,
            };
          }
        } else {
          // Monkey bars overhead hang
          if (
            Math.abs(inp.heroX - n.curX) <= n.width * 0.55 &&
            Math.abs(inp.heroY + inp.heroHeight - n.curY) < 0.85
          ) {
            out.climbCandidate = {
              kind: 'monkeyBars',
              anchorX: inp.heroX,
              anchorY: n.curY - inp.heroHeight + 0.25,
              minY: n.curX - n.width * 0.5,
              maxY: n.curX + n.width * 0.5,
            };
          }
        }
      } else if (n.mod === 'boostRing') {
        if (n.cooldownTimer <= 0 && Math.hypot(inp.heroX - n.curX, inp.heroY + 0.7 - (n.curY + 1.1)) < 1.45) {
          n.cooldownTimer = 0.4;
          const spd = cfg.speed ?? 19;
          const dx = cfg.windDirX ?? 1;
          const dy = cfg.windDirY ?? 0.35;
          const len = Math.max(0.01, Math.hypot(dx, dy));
          out.hasOverrideVel = true;
          out.overrideVX = (dx / len) * spd;
          out.overrideVY = (dy / len) * spd;
          out.refillAirMoves = true;
          out.soundEvent = 'whoosh';
        }
      } else if (n.mod === 'windTunnel') {
        if (
          Math.abs(inp.heroX - n.curX) < n.width * 0.55 &&
          inp.heroY >= n.curY - 0.4 &&
          inp.heroY <= n.curY + n.height
        ) {
          const f = cfg.windForce ?? 25;
          out.windAccelX += (cfg.windDirX ?? 0) * f;
          out.windAccelY += (cfg.windDirY ?? 1) * f;
        }
      } else if (n.mod === 'waterZone') {
        if (
          Math.abs(inp.heroX - n.curX) < n.width * 0.5 &&
          inp.heroY >= n.curY - 0.5 &&
          inp.heroY <= n.curY + n.height
        ) {
          inWaterHere = true;
          maxWaterSurf = Math.max(maxWaterSurf, n.curY + n.height);
          if (cfg.oxygenEnabled) oxygenRequiredHere = true;
        }
      } else if (n.mod === 'lowGravityZone' || n.mod === 'gravityFlipPad') {
        if (
          Math.abs(inp.heroX - n.curX) < n.width * 0.55 &&
          inp.heroY >= n.curY - 0.4 &&
          inp.heroY <= n.curY + Math.max(2.0, n.height)
        ) {
          if (n.mod === 'gravityFlipPad' || cfg.gravityMode === 'flipCeiling') {
            out.gravitySign = -1;
            out.gravityScale = Math.abs(cfg.gravityScale ?? 0.9);
          } else if (cfg.gravityMode === 'zeroG') {
            out.gravityScale = 0.08;
          } else {
            out.gravityScale = cfg.gravityScale ?? 0.36;
          }
        }
      } else if (n.mod === 'warpPortal' && this.portalCooldown <= 0) {
        if (Math.hypot(inp.heroX - n.curX, inp.heroY + 0.7 - (n.curY + 1.0)) < 1.25) {
          const ch = cfg.channelId ?? 'portalA';
          const mate = this.nodes.find(
            (other) => other !== n && other.mod === 'warpPortal' && (other.cfg.channelId ?? 'portalA') === ch
          );
          if (mate) {
            this.portalCooldown = 0.85;
            out.hasOverridePos = true;
            out.overrideX = mate.curX;
            out.overrideY = mate.curY + 0.4;
            out.overrideZ = mate.curZ;
            out.soundEvent = 'sparkle';
            out.toastMessage = `Warped via "${ch}"!`;
          }
        }
      } else if (n.mod === 'lanternPickup' && n.alive) {
        if (Math.hypot(inp.heroX - n.curX, inp.heroY + 0.7 - (n.curY + 0.9)) < 1.35) {
          n.alive = false;
          n.mesh.visible = false;
          this.hasLantern = true;
          out.hasLantern = true;
          out.soundEvent = 'chime';
          out.toastMessage = 'Picked up Shadow Lantern — shadow platforms illuminated!';
        }
      } else if (
        n.mod === 'retractSpikes' ||
        n.mod === 'spikePendulum' ||
        n.mod === 'firebar' ||
        n.mod === 'thwompBlock'
      ) {
        let hitHazard = false;
        if (n.mod === 'retractSpikes' && n.active) {
          hitHazard =
            Math.abs(inp.heroX - n.curX) < n.width * 0.48 &&
            Math.abs(inp.heroY - n.curY) < 0.75;
        } else if (n.mod === 'spikePendulum') {
          const ballX = n.curX + Math.sin(n.swingAngle) * 3.8;
          const ballY = n.curY + 4.4 - Math.cos(n.swingAngle) * 3.8;
          hitHazard = Math.hypot(inp.heroX - ballX, inp.heroY + 0.7 - ballY) < 1.05;
        } else if (n.mod === 'firebar') {
          const ang = inp.timeElapsed * (cfg.speed ?? 1.9);
          const count = Math.max(2, Math.min(7, cfg.firebarCount ?? 4));
          for (let f = 1; f <= count; f++) {
            const bx = n.curX + Math.cos(ang) * f * 0.72;
            const by = n.curY + 0.85 + Math.sin(ang) * f * 0.72;
            if (Math.hypot(inp.heroX - bx, inp.heroY + 0.75 - by) < 0.72) {
              hitHazard = true;
              break;
            }
          }
        } else if (n.mod === 'thwompBlock') {
          const hw = n.width * 0.5;
          if (Math.abs(inp.heroX - n.curX) < hw + 0.25) {
            if (inp.heroY + inp.heroHeight > n.curY && inp.heroY < n.curY + n.height) {
              if (n.thwompState === 'dropping') {
                hitHazard = true;
              }
            }
            // Top of thwomp acts as solid platform
            const topY = n.curY + n.height;
            if (inp.heroVelY <= 0.4 && inp.heroY >= topY - 0.5 && inp.heroY <= topY + 0.5) {
              out.floorY = Math.max(out.floorY, topY);
            }
          }
        }
        if (hitHazard) {
          out.damageHero = Math.max(out.damageHero, 1);
          out.bounceHeroVY = Math.max(out.bounceHeroVY, 8.5);
          out.soundEvent = 'hurt';
        }
      } else if (
        (n.mod === 'enemyPatroller' ||
          n.mod === 'enemyFlyer' ||
          n.mod === 'enemyCharger' ||
          n.mod === 'enemyTurret' ||
          n.mod === 'enemySpiked') &&
        n.alive
      ) {
        const range = cfg.patrolRange ?? 5.5;
        const spd = cfg.speed ?? 3.2;
        if (n.mod === 'enemyPatroller') {
          n.curX += n.enemyDir * spd * dt;
          if (n.curX > n.originX + range) {
            n.curX = n.originX + range;
            n.enemyDir = -1;
          } else if (n.curX < n.originX - range) {
            n.curX = n.originX - range;
            n.enemyDir = 1;
          }
          n.mesh.position.set(n.curX, n.curY, n.curZ);
          n.mesh.rotation.y = n.enemyDir > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
        } else if (n.mod === 'enemyFlyer') {
          n.curX += n.enemyDir * spd * dt;
          if (Math.abs(n.curX - n.originX) > range) n.enemyDir = n.curX > n.originX ? -1 : 1;
          n.curY = n.originY + Math.sin(inp.timeElapsed * 2.6 + n.originX) * 1.1;
          n.mesh.position.set(n.curX, n.curY, n.curZ);
          n.mesh.rotation.y = n.enemyDir > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
        } else if (n.mod === 'enemyCharger') {
          if (n.enemyState === 'patrol') {
            n.curX += n.enemyDir * spd * 0.7 * dt;
            if (Math.abs(n.curX - n.originX) > range) n.enemyDir = n.curX > n.originX ? -1 : 1;
            if (Math.abs(inp.heroY - n.curY) < 1.6 && Math.abs(inp.heroX - n.curX) < 8.5) {
              n.enemyState = 'telegraph';
              n.enemyTimer = 0.35;
              n.enemyDir = inp.heroX >= n.curX ? 1 : -1;
            }
          } else if (n.enemyState === 'telegraph') {
            n.enemyTimer -= dt;
            if (n.enemyTimer <= 0) {
              n.enemyState = 'charge';
              n.enemyTimer = 1.1;
            }
          } else if (n.enemyState === 'charge') {
            n.curX += n.enemyDir * spd * 3.1 * dt;
            n.enemyTimer -= dt;
            if (n.enemyTimer <= 0 || Math.abs(n.curX - n.originX) > range + 2.5) {
              n.enemyState = 'stun';
              n.enemyTimer = 1.1;
            }
          } else if (n.enemyState === 'stun') {
            n.enemyTimer -= dt;
            if (n.enemyTimer <= 0) n.enemyState = 'patrol';
          }
          n.mesh.position.set(n.curX, n.curY, n.curZ);
          n.mesh.rotation.y = n.enemyDir > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
        } else if (n.mod === 'enemyTurret') {
          n.enemyFireTimer -= dt;
          const head = n.mesh.userData.turretHead as THREE.Object3D | undefined;
          const dirSign = inp.heroX >= n.curX ? 1 : -1;
          if (head) head.rotation.y = dirSign > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
          if (n.enemyFireTimer <= 0) {
            n.enemyFireTimer = Math.max(1.0, 3.0 / Math.max(0.5, spd * 0.45));
            if (Math.hypot(inp.heroX - n.curX, inp.heroY - n.curY) < 22) {
              this.spawnProjectile(n.curX + dirSign * 0.7, n.curY + 0.85, n.curZ, dirSign * 8.5, 0, false);
            }
          }
        } else if (n.mod === 'enemySpiked') {
          n.curX += n.enemyDir * spd * 0.85 * dt;
          if (Math.abs(n.curX - n.originX) > range) n.enemyDir = n.curX > n.originX ? -1 : 1;
          n.mesh.position.set(n.curX, n.curY, n.curZ);
          n.mesh.rotation.y = n.enemyDir > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
        }

        // Contact test with hero
        if (Math.hypot(inp.heroX - n.curX, inp.heroY + 0.65 - (n.curY + 0.55)) < 1.05) {
          const stomping = inp.heroVelY < -0.35 && inp.heroY >= n.curY + 0.52;
          const smashing = inp.isDashing || inp.isGroundPounding || this.heroSizeScale >= 1.4;
          if (n.mod === 'enemySpiked') {
            if (smashing) {
              n.alive = false;
              n.enemyState = 'dead';
              n.mesh.visible = false;
              out.collectCoins += 3;
              out.bounceHeroVY = Math.max(out.bounceHeroVY, 9.5);
              out.soundEvent = 'hit';
            } else {
              out.damageHero = Math.max(out.damageHero, 1);
              out.bounceHeroVY = Math.max(out.bounceHeroVY, 10.0);
              out.soundEvent = 'hurt';
              out.toastMessage = 'Spiked shell! Use Dash or Giant size!';
            }
          } else if (stomping || smashing) {
            if (n.mod === 'enemyFlyer') {
              // Pogo-bounce infinitely or crisp bounce!
              out.bounceHeroVY = Math.max(out.bounceHeroVY, 14.0);
              out.refillAirMoves = true;
              out.soundEvent = 'jump';
            } else {
              n.alive = false;
              n.enemyState = 'dead';
              n.mesh.visible = false;
              out.collectCoins += 2;
              out.bounceHeroVY = Math.max(out.bounceHeroVY, 11.5);
              out.refillAirMoves = true;
              out.soundEvent = 'hit';
            }
          } else {
            out.damageHero = Math.max(out.damageHero, 1);
            out.bounceHeroVY = Math.max(out.bounceHeroVY, 8.0);
            out.soundEvent = 'hurt';
          }
        }
      } else if (n.mod === 'dashCrystal' && n.active) {
        if (Math.hypot(inp.heroX - n.curX, inp.heroY + 0.7 - (n.curY + 0.85)) < 1.25) {
          n.cooldownTimer = cfg.respawnSec ?? 2.6;
          out.refillAirMoves = true;
          out.soundEvent = 'sparkle';
        }
      } else if (n.mod === 'bashLantern' && n.active && n.cooldownTimer <= 0 && this.lockReleaseCooldown <= 0) {
        if (Math.hypot(inp.heroX - n.curX, inp.heroY + 0.7 - (n.curY + 0.85)) < 1.65 && inp.interactHeld) {
          this.lockMode = 'bashAim';
          this.lockNode = n;
          this.bashTimer = 1.8;
          this.bashLaunchAngle = Math.PI * 0.28;
          out.soundEvent = 'whoosh';
          return;
        }
      } else if (n.mod === 'ghostEchoPad') {
        if (Math.hypot(inp.heroX - n.curX, inp.heroY - n.curY) < 1.25 && n.cooldownTimer <= 0) {
          n.cooldownTimer = 3.5;
          this.ghostPlaybackActive = true;
          this.ghostPlaybackTimer = 3.0;
          this.ghostPlaybackIndex = 0;
          out.soundEvent = 'sparkle';
          out.toastMessage = 'Ghost Echo spawned (3s time-clone replay)!';
        }
      } else if (n.mod === 'slingshotWeb') {
        const hw = n.width * 0.5;
        if (Math.abs(inp.heroX - n.curX) < hw && Math.abs(inp.heroY - (n.curY + 0.7)) < 0.85 && inp.heroVelY < 0.5) {
          const force = (cfg.bounceForce ?? 20) * (inp.jumpHeld ? 1.15 : 1.0);
          out.hasOverrideVel = true;
          out.overrideVX = inp.heroVelX * 0.65;
          out.overrideVY = force;
          out.refillAirMoves = true;
          out.soundEvent = 'jump';
          const cord = n.mesh.userData.slingshotCord as THREE.Object3D | undefined;
          if (cord) cord.position.y = 0.25;
        } else {
          const cord = n.mesh.userData.slingshotCord as THREE.Object3D | undefined;
          if (cord) cord.position.y = THREE.MathUtils.damp(cord.position.y, 0.72, 10, dt);
        }
      } else if (n.mod === 'sizeShiftGate' && n.cooldownTimer <= 0) {
        if (Math.hypot(inp.heroX - n.curX, inp.heroY + 0.8 - (n.curY + 1.3)) < 1.35) {
          n.cooldownTimer = 0.9;
          const mode = cfg.sizeMode ?? 'shrink';
          if (mode === 'shrink') {
            this.heroSizeScale = this.heroSizeScale < 0.8 ? 1.0 : 0.52;
          } else if (mode === 'grow') {
            this.heroSizeScale = this.heroSizeScale > 1.2 ? 1.0 : 1.6;
          } else {
            this.heroSizeScale = this.heroSizeScale < 0.8 ? 1.6 : this.heroSizeScale > 1.2 ? 1.0 : 0.52;
          }
          out.sizeScale = this.heroSizeScale;
          out.soundEvent = 'sparkle';
          out.toastMessage =
            this.heroSizeScale < 0.8
              ? 'Shrunk to Mini size (0.5x)!'
              : this.heroSizeScale > 1.2
              ? 'Grown to Giant size (1.6x — smash blocks!)!'
              : 'Returned to Normal size!';
        }
      } else if (n.mod === 'checkpointFlag' && n.alive) {
        if (!n.triggered && Math.hypot(inp.heroX - n.curX, inp.heroY - n.curY) < 1.8) {
          n.triggered = true;
          n.alive = false; // already claimed
          out.checkpointReached = {
            x: n.curX,
            y: n.curY + 0.25,
            z: n.curZ,
            label: n.entity.name,
          };
          out.soundEvent = 'chime';
          const flag = n.mesh.userData.flagMesh as THREE.Mesh | undefined;
          if (flag && flag.material instanceof THREE.MeshStandardMaterial) {
            flag.material.color.set('#20B46A');
            flag.material.emissive.set('#20B46A');
          }
        }
      } else if (n.mod === 'coinTrail') {
        const arcGroup = n.mesh.userData.coinTrailGroup as THREE.Group | undefined;
        if (arcGroup) {
          const children = arcGroup.children;
          for (let ci = 0; ci < children.length; ci++) {
            const coinMesh = children[ci];
            if (!coinMesh.visible) continue;
            const wx = n.curX + coinMesh.position.x;
            const wy = n.curY + coinMesh.position.y;
            if (Math.hypot(inp.heroX - wx, inp.heroY + 0.75 - wy) < 1.05) {
              coinMesh.visible = false;
              out.collectCoins += 1;
              out.soundEvent = 'coin';
            }
          }
        }
      } else if (n.mod === 'starCoin' && n.alive) {
        if (Math.hypot(inp.heroX - n.curX, inp.heroY + 0.75 - (n.curY + 1.0)) < 1.45) {
          n.alive = false;
          n.mesh.visible = false;
          const idx = Math.max(0, Math.min(2, (cfg.starIndex ?? 1) - 1));
          this.starCoinsMask |= 1 << idx;
          out.starCoinsMask = this.starCoinsMask;
          out.starCoinsCount =
            ((this.starCoinsMask & 1) ? 1 : 0) +
            ((this.starCoinsMask & 2) ? 1 : 0) +
            ((this.starCoinsMask & 4) ? 1 : 0);
          out.collectCoins += 5;
          out.soundEvent = 'chime';
          out.toastMessage = `Collected Star Coin #${idx + 1}!`;
        }
      } else if (n.mod === 'finishGoal' && n.alive) {
        if (Math.hypot(inp.heroX - n.curX, inp.heroY - n.curY) < 1.85) {
          n.alive = false;
          out.goalReached = {
            type: cfg.goalType ?? 'flagpole',
            label: n.entity.name,
          };
          out.soundEvent = 'chime';
        }
      }
    }

    // Water & Oxygen tracking
    out.inWaterZone = inWaterHere;
    out.waterSurfaceY = maxWaterSurf;
    out.oxygenActive = inWaterHere && oxygenRequiredHere;
    if (out.oxygenActive) {
      this.oxygenPct = Math.max(0, this.oxygenPct - dt * 10);
      if (this.oxygenPct <= 0) {
        out.damageHero = Math.max(out.damageHero, 1);
        this.oxygenPct = 35;
        out.toastMessage = 'Out of oxygen! Surface for air!';
        out.soundEvent = 'hurt';
      }
    } else {
      this.oxygenPct = Math.min(100, this.oxygenPct + dt * 32);
    }
    out.oxygenPct = this.oxygenPct;
  }
}
