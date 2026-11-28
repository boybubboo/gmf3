import * as THREE from 'three';
import type { MonsterAbilityId, MonsterAttackType } from '../types/maker';

export interface MonsterAttackMeta {
  id: MonsterAttackType;
  label: string;
  element: 'Physical' | 'Fire' | 'Ice' | 'Water' | 'Electric' | 'Poison' | 'Shadow' | 'Solar' | 'Sound';
  color: string;
  secondaryColor: string;
  defaultRange: number;
  windupDuration: number;
  strikeDuration: number;
  description: string;
  isRangedBreath: boolean;
  isRadialAoe: boolean;
}

export const MONSTER_ATTACK_CATALOG: MonsterAttackMeta[] = [
  {
    id: 'clawSlash',
    label: 'Claw Slash',
    element: 'Physical',
    color: '#FF5E3A',
    secondaryColor: '#FDE047',
    defaultRange: 2.3,
    windupDuration: 0.42,
    strikeDuration: 0.24,
    description: 'Fierce lunging swipe with glowing crescent claw arcs',
    isRangedBreath: false,
    isRadialAoe: false,
  },
  {
    id: 'groundPound',
    label: 'Ground Pound',
    element: 'Physical',
    color: '#D97706',
    secondaryColor: '#FBBF24',
    defaultRange: 3.4,
    windupDuration: 0.56,
    strikeDuration: 0.34,
    description: 'Rears up high then slams the earth to send seismic shockwaves',
    isRangedBreath: false,
    isRadialAoe: true,
  },
  {
    id: 'tailSmash',
    label: 'Tail Smash',
    element: 'Physical',
    color: '#A855F7',
    secondaryColor: '#F472B6',
    defaultRange: 2.8,
    windupDuration: 0.48,
    strikeDuration: 0.28,
    description: 'Coils hips and whips a heavy spinning tail sweep',
    isRangedBreath: false,
    isRadialAoe: false,
  },
  {
    id: 'chargeGore',
    label: 'Horn Charge',
    element: 'Physical',
    color: '#F59E0B',
    secondaryColor: '#FEF3C7',
    defaultRange: 3.2,
    windupDuration: 0.46,
    strikeDuration: 0.32,
    description: 'Lowers head & paws the dirt before bull-rushing forward',
    isRangedBreath: false,
    isRadialAoe: false,
  },
  {
    id: 'sonicRoar',
    label: 'Sonic Roar',
    element: 'Sound',
    color: '#EC4899',
    secondaryColor: '#FBCFE8',
    defaultRange: 4.0,
    windupDuration: 0.48,
    strikeDuration: 0.38,
    description: 'Rears skyward and unleashes expanding shock-sound rings',
    isRangedBreath: false,
    isRadialAoe: true,
  },
  {
    id: 'fireBreath',
    label: 'Fire Breath',
    element: 'Fire',
    color: '#F97316',
    secondaryColor: '#FDE047',
    defaultRange: 4.8,
    windupDuration: 0.52,
    strikeDuration: 0.44,
    description: 'Inhales embers and sweeps a roaring flame torrent from every head',
    isRangedBreath: true,
    isRadialAoe: false,
  },
  {
    id: 'iceBreath',
    label: 'Frost Breath',
    element: 'Ice',
    color: '#38BDF8',
    secondaryColor: '#E0F2FE',
    defaultRange: 4.6,
    windupDuration: 0.52,
    strikeDuration: 0.44,
    description: 'Exhales a freezing blizzard cone of frost mist & ice crystals',
    isRangedBreath: true,
    isRadialAoe: false,
  },
  {
    id: 'waterJet',
    label: 'Hydro Jet',
    element: 'Water',
    color: '#0EA5E9',
    secondaryColor: '#BAE6FD',
    defaultRange: 5.2,
    windupDuration: 0.48,
    strikeDuration: 0.42,
    description: 'Fires a pressurized torrent of surging water & foam spray',
    isRangedBreath: true,
    isRadialAoe: false,
  },
  {
    id: 'electricShock',
    label: 'Thunder Shock',
    element: 'Electric',
    color: '#FACC15',
    secondaryColor: '#7DD3FC',
    defaultRange: 4.8,
    windupDuration: 0.48,
    strikeDuration: 0.36,
    description: 'Crackles static across its body then discharges jagged lightning bolts',
    isRangedBreath: true,
    isRadialAoe: true,
  },
  {
    id: 'poisonSpit',
    label: 'Venom Spray',
    element: 'Poison',
    color: '#84CC16',
    secondaryColor: '#C084FC',
    defaultRange: 4.5,
    windupDuration: 0.46,
    strikeDuration: 0.38,
    description: 'Hurls bubbling caustic venom globules and toxic mist',
    isRangedBreath: true,
    isRadialAoe: false,
  },
  {
    id: 'shadowBeam',
    label: 'Void Pulse',
    element: 'Shadow',
    color: '#7C3AED',
    secondaryColor: '#1E1B4B',
    defaultRange: 5.2,
    windupDuration: 0.54,
    strikeDuration: 0.42,
    description: 'Condenses dark abyssal rings and blasts a shadowy energy beam',
    isRangedBreath: true,
    isRadialAoe: false,
  },
  {
    id: 'solarBeam',
    label: 'Solar Flare',
    element: 'Solar',
    color: '#FBBF24',
    secondaryColor: '#FFFBEB',
    defaultRange: 5.6,
    windupDuration: 0.62,
    strikeDuration: 0.46,
    description: 'Gathers radiant sunlight before firing a blazing golden beam',
    isRangedBreath: true,
    isRadialAoe: false,
  },
];

export const MONSTER_ATTACK_BY_ID: Record<MonsterAttackType, MonsterAttackMeta> =
  Object.fromEntries(MONSTER_ATTACK_CATALOG.map((m) => [m.id, m])) as Record<
    MonsterAttackType,
    MonsterAttackMeta
  >;

export interface MonsterAbilityMeta {
  id: MonsterAbilityId;
  label: string;
  tag: string;
  description: string;
}

export const MONSTER_ABILITY_CATALOG: MonsterAbilityMeta[] = [
  { id: 'none', label: 'None', tag: 'Standard', description: 'Standard creature behavior without passive traits' },
  { id: 'intimidate', label: 'Intimidate', tag: 'Aura', description: 'Fierce presence slows nearby foes and lowers strike tempo' },
  { id: 'thickFat', label: 'Thick Fat', tag: 'Defense', description: '+25% max HP and sturdy knockback resistance' },
  { id: 'flameBody', label: 'Flame Body', tag: 'Contact', description: 'Scorches attackers on melee contact with fiery sparks' },
  { id: 'staticShell', label: 'Static Shell', tag: 'Contact', description: 'Discharges electric jolts when struck at close range' },
  { id: 'swiftStride', label: 'Swift Stride', tag: 'Mobility', description: '+22% pursuit & patrol movement speed' },
  { id: 'galeWings', label: 'Gale Wings', tag: 'Aerial', description: 'Boosts wing speed & reduces attack cooldown when airborne' },
  { id: 'berserk', label: 'Berserk', tag: 'Fury', description: 'Gains speed and ferocity below 50% health' },
  { id: 'regenerator', label: 'Regenerator', tag: 'Sustain', description: 'Slowly recovers health between skirmishes' },
];

export const MONSTER_ABILITY_BY_ID: Record<MonsterAbilityId, MonsterAbilityMeta> =
  Object.fromEntries(MONSTER_ABILITY_CATALOG.map((a) => [a.id, a])) as Record<
    MonsterAbilityId,
    MonsterAbilityMeta
  >;

export interface VfxRigAnchors {
  root: THREE.Group;
  mouthAnchors: THREE.Object3D[];
  chestAnchor?: THREE.Object3D;
  tailTipAnchor?: THREE.Object3D;
  scale: number;
}

interface PooledParticle {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  vel: THREE.Vector3;
  rotVel: THREE.Vector3;
  age: number;
  life: number;
  startScale: number;
  endScale: number;
  gravity: number;
  active: boolean;
}

interface PooledRing {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  age: number;
  life: number;
  startScale: number;
  endScale: number;
  active: boolean;
}

interface PooledBolt {
  line: THREE.Line;
  mat: THREE.LineBasicMaterial;
  posAttr: THREE.BufferAttribute;
  age: number;
  life: number;
  active: boolean;
}

interface ActiveChargeOrb {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  age: number;
}

const _origin = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _fwdRef = new THREE.Vector3(0, 0, 1);
const _upRef = new THREE.Vector3(0, 1, 0);
const _tmpPt = new THREE.Vector3();
const _tmpVel = new THREE.Vector3();
const _ringQuat = new THREE.Quaternion();

export class MonsterAttackVfxController {
  private readonly parent: THREE.Object3D;
  private readonly container: THREE.Group;
  private readonly sphereGeo: THREE.SphereGeometry;
  private readonly crystalGeo: THREE.OctahedronGeometry;
  private readonly chunkGeo: THREE.DodecahedronGeometry;
  private readonly ringGeo: THREE.TorusGeometry;
  private readonly beamGeo: THREE.CylinderGeometry;
  private readonly particles: PooledParticle[] = [];
  private readonly rings: PooledRing[] = [];
  private readonly bolts: PooledBolt[] = [];
  private readonly chargeOrbs: ActiveChargeOrb[] = [];
  private beamMesh: THREE.Mesh;
  private beamMat: THREE.MeshBasicMaterial;
  private beamTimer = 0;
  private emitAccum = 0;

  constructor(parent: THREE.Object3D) {
    this.parent = parent;
    this.container = new THREE.Group();
    this.container.name = 'MonsterAttackVfxContainer';
    this.parent.add(this.container);

    this.sphereGeo = new THREE.SphereGeometry(0.14, 10, 8);
    this.crystalGeo = new THREE.OctahedronGeometry(0.15, 0);
    this.chunkGeo = new THREE.DodecahedronGeometry(0.13, 0);
    this.ringGeo = new THREE.TorusGeometry(0.55, 0.055, 8, 28);
    this.ringGeo.rotateX(Math.PI / 2);

    this.beamGeo = new THREE.CylinderGeometry(0.12, 0.24, 1.0, 12, 1, true);
    this.beamGeo.translate(0, 0.5, 0);
    this.beamGeo.rotateX(Math.PI / 2);
    this.beamMat = new THREE.MeshBasicMaterial({
      color: '#FBBF24',
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.beamMesh = new THREE.Mesh(this.beamGeo, this.beamMat);
    this.beamMesh.visible = false;
    this.container.add(this.beamMesh);

    const maxParticles = 140;
    for (let i = 0; i < maxParticles; i++) {
      const geo =
        i % 3 === 0 ? this.crystalGeo : i % 3 === 1 ? this.chunkGeo : this.sphereGeo;
      const mat = new THREE.MeshBasicMaterial({
        color: '#F97316',
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.container.add(mesh);
      this.particles.push({
        mesh,
        mat,
        vel: new THREE.Vector3(),
        rotVel: new THREE.Vector3(),
        age: 0,
        life: 0.4,
        startScale: 1,
        endScale: 0.2,
        gravity: 0,
        active: false,
      });
    }

    const maxRings = 16;
    for (let i = 0; i < maxRings; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: '#FBBF24',
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.ringGeo, mat);
      mesh.visible = false;
      this.container.add(mesh);
      this.rings.push({
        mesh,
        mat,
        age: 0,
        life: 0.45,
        startScale: 0.3,
        endScale: 3.2,
        active: false,
      });
    }

    const maxBolts = 12;
    for (let i = 0; i < maxBolts; i++) {
      const positions = new Float32Array(9 * 3);
      const geo = new THREE.BufferGeometry();
      const posAttr = new THREE.BufferAttribute(positions, 3);
      geo.setAttribute('position', posAttr);
      const mat = new THREE.LineBasicMaterial({
        color: '#FACC15',
        transparent: true,
        opacity: 0,
      });
      const line = new THREE.Line(geo, mat);
      line.visible = false;
      line.frustumCulled = false;
      this.container.add(line);
      this.bolts.push({ line, mat, posAttr, age: 0, life: 0.18, active: false });
    }

    for (let i = 0; i < 3; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: '#FDE047',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(this.sphereGeo, mat);
      mesh.visible = false;
      this.container.add(mesh);
      this.chargeOrbs.push({ mesh, mat, age: 0 });
    }
  }

  private spawnParticle(
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    colorHex: string,
    life: number,
    startScale: number,
    endScale: number,
    gravity = 0,
    additive = true
  ) {
    for (const p of this.particles) {
      if (p.active) continue;
      p.active = true;
      p.age = 0;
      p.life = life;
      p.startScale = startScale;
      p.endScale = endScale;
      p.gravity = gravity;
      p.vel.copy(vel);
      p.rotVel.set(
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8
      );
      p.mesh.position.copy(pos);
      p.mesh.scale.setScalar(startScale);
      p.mesh.visible = true;
      p.mat.color.set(colorHex);
      p.mat.opacity = 0.92;
      p.mat.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
      return;
    }
  }

  private spawnRing(
    pos: THREE.Vector3,
    colorHex: string,
    life: number,
    startScale: number,
    endScale: number,
    orientQuat?: THREE.Quaternion
  ) {
    for (const r of this.rings) {
      if (r.active) continue;
      r.active = true;
      r.age = 0;
      r.life = life;
      r.startScale = startScale;
      r.endScale = endScale;
      r.mesh.position.copy(pos);
      if (orientQuat) {
        r.mesh.quaternion.copy(orientQuat);
      } else {
        r.mesh.rotation.set(0, 0, 0);
      }
      r.mesh.scale.setScalar(startScale);
      r.mesh.visible = true;
      r.mat.color.set(colorHex);
      r.mat.opacity = 0.88;
      return;
    }
  }

  private spawnBolt(start: THREE.Vector3, end: THREE.Vector3, colorHex: string, jitter = 0.24) {
    for (const b of this.bolts) {
      if (b.active) continue;
      b.active = true;
      b.age = 0;
      b.life = 0.14 + Math.random() * 0.08;
      const arr = b.posAttr.array as Float32Array;
      const segs = 8;
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        _tmpPt.lerpVectors(start, end, t);
        if (i > 0 && i < segs) {
          const env = Math.sin(t * Math.PI);
          _tmpPt.x += (Math.random() - 0.5) * jitter * env * 2;
          _tmpPt.y += (Math.random() - 0.5) * jitter * env * 2;
          _tmpPt.z += (Math.random() - 0.5) * jitter * env * 2;
        }
        arr[i * 3] = _tmpPt.x;
        arr[i * 3 + 1] = _tmpPt.y;
        arr[i * 3 + 2] = _tmpPt.z;
      }
      b.posAttr.needsUpdate = true;
      b.mat.color.set(colorHex);
      b.mat.opacity = 0.96;
      b.line.visible = true;
      return;
    }
  }

  /**
   * Pulses a locked ground telegraph ring at the target location during windup
   * so players clearly see the committed attack zone and can dodge out of it.
   */
  public emitLockedTelegraph(
    x: number,
    y: number,
    z: number,
    radius: number,
    colorHex: string,
    progress: number
  ) {
    // Emit a subtle rhythmic ring pulse ~every 0.18s without exhausting the pool
    if (Math.random() > 0.24 && progress > 0.08) return;
    _origin.set(x, y + 0.08, z);
    const targetScale = Math.max(1.2, radius * 1.45);
    const startScale = targetScale * (0.45 + 0.35 * Math.min(1, progress));
    this.spawnRing(_origin, colorHex, 0.32, startScale, targetScale);
  }

  /**
   * Emits continuous charge-up orbs during windup or active elemental/shockwave VFX during strike.
   */
  public emitAttackStep(
    rig: VfxRigAnchors,
    attackType: MonsterAttackType,
    phase: 'windup' | 'strike',
    progress: number,
    dt: number
  ) {
    const meta = MONSTER_ATTACK_BY_ID[attackType] ?? MONSTER_ATTACK_BY_ID.clawSlash;
    const sc = Math.max(0.5, rig.scale);
    rig.root.updateMatrixWorld(true);

    if (phase === 'windup') {
      // Charge-up orb(s) inside mouths for breath/beam moves, or crackling sparks for electric/ground
      if (meta.isRangedBreath || attackType === 'sonicRoar') {
        const count = Math.min(this.chargeOrbs.length, rig.mouthAnchors.length);
        for (let i = 0; i < count; i++) {
          const orb = this.chargeOrbs[i];
          rig.mouthAnchors[i].getWorldPosition(_origin);
          orb.mesh.position.copy(_origin);
          const pulse = 0.6 + 0.4 * Math.sin(progress * Math.PI * 6);
          orb.mesh.scale.setScalar(sc * (0.25 + progress * 1.05) * pulse);
          orb.mat.color.set(progress > 0.6 ? meta.secondaryColor : meta.color);
          orb.mat.opacity = 0.35 + progress * 0.6;
          orb.mesh.visible = true;
          orb.age = 0.08;
        }
      }
      if (attackType === 'electricShock' && Math.random() < dt * 18) {
        rig.root.getWorldPosition(_origin);
        _origin.y += 0.65 * sc;
        _tmpPt.set(
          _origin.x + (Math.random() - 0.5) * 1.1 * sc,
          _origin.y + (Math.random() - 0.3) * 0.8 * sc,
          _origin.z + (Math.random() - 0.5) * 1.1 * sc
        );
        this.spawnBolt(_origin, _tmpPt, meta.color, 0.18 * sc);
      }
      return;
    }

    // Strike phase
    for (const orb of this.chargeOrbs) {
      orb.mesh.visible = false;
    }

    this.emitAccum += dt;
    const stepRate = attackType === 'electricShock' ? 0.025 : 0.018;
    const shouldEmitBurst = this.emitAccum >= stepRate;
    if (shouldEmitBurst) this.emitAccum = 0;

    if (attackType === 'groundPound') {
      if (progress < 0.25 && shouldEmitBurst) {
        if (rig.chestAnchor) rig.chestAnchor.getWorldPosition(_origin);
        else rig.root.getWorldPosition(_origin);
        _origin.y = rig.root.position.y + 0.08;
        this.spawnRing(_origin, meta.color, 0.48, 0.35 * sc, 4.2 * sc);
        this.spawnRing(_origin, meta.secondaryColor, 0.36, 0.25 * sc, 2.8 * sc);
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2 + Math.random() * 0.4;
          const spd = (2.8 + Math.random() * 2.5) * sc;
          _tmpVel.set(
            Math.cos(ang) * spd,
            (2.4 + Math.random() * 2.2) * sc,
            Math.sin(ang) * spd
          );
          this.spawnParticle(
            _origin,
            _tmpVel,
            i % 2 === 0 ? '#78350F' : meta.secondaryColor,
            0.46,
            0.9 * sc,
            0.25 * sc,
            9.5,
            false
          );
        }
      }
      return;
    }

    if (attackType === 'sonicRoar') {
      if (shouldEmitBurst && Math.random() < 0.45) {
        const anchor = rig.mouthAnchors[0];
        if (anchor) {
          anchor.getWorldPosition(_origin);
          anchor.getWorldQuaternion(_quat);
          _dir.copy(_fwdRef).applyQuaternion(_quat).normalize();
          _ringQuat.setFromUnitVectors(_upRef, _dir);
          this.spawnRing(_origin, meta.color, 0.42, 0.35 * sc, 3.6 * sc, _ringQuat);
        }
      }
      return;
    }

    if (attackType === 'tailSmash') {
      if (shouldEmitBurst && rig.tailTipAnchor) {
        rig.tailTipAnchor.getWorldPosition(_origin);
        _tmpVel.set(
          (Math.random() - 0.5) * 1.4,
          0.4 + Math.random() * 1.0,
          (Math.random() - 0.5) * 1.4
        );
        this.spawnParticle(
          _origin,
          _tmpVel,
          Math.random() < 0.5 ? meta.color : meta.secondaryColor,
          0.26,
          1.1 * sc,
          0.15 * sc,
          0,
          true
        );
      }
      return;
    }

    if (attackType === 'chargeGore' || attackType === 'clawSlash') {
      if (shouldEmitBurst) {
        rig.root.getWorldPosition(_origin);
        rig.root.getWorldQuaternion(_quat);
        _dir.copy(_fwdRef).applyQuaternion(_quat).normalize();
        _right.set(1, 0, 0).applyQuaternion(_quat);
        _origin.y += 0.55 * sc;
        _origin.addScaledVector(_dir, 0.65 * sc);
        _origin.addScaledVector(_right, (Math.random() - 0.5) * 0.7 * sc);
        _tmpVel.copy(_dir).multiplyScalar((2.4 + Math.random() * 1.8) * sc);
        _tmpVel.y += 0.6 * sc;
        this.spawnParticle(_origin, _tmpVel, meta.secondaryColor, 0.24, 0.85 * sc, 0.1 * sc, 1.5, true);
      }
      return;
    }

    // Ranged Breath / Beam / Electric attacks from EVERY head mouth anchor!
    if (shouldEmitBurst && rig.mouthAnchors.length > 0) {
      for (let hIdx = 0; hIdx < rig.mouthAnchors.length; hIdx++) {
        const anchor = rig.mouthAnchors[hIdx];
        anchor.getWorldPosition(_origin);
        anchor.getWorldQuaternion(_quat);
        _dir.copy(_fwdRef).applyQuaternion(_quat).normalize();
        _right.crossVectors(_dir, _upRef);
        if (_right.lengthSq() < 1e-4) _right.set(1, 0, 0);
        _right.normalize();
        _up.crossVectors(_right, _dir).normalize();

        if (attackType === 'electricShock') {
          const reach = (3.4 + Math.random() * 1.4) * sc;
          _tmpPt
            .copy(_origin)
            .addScaledVector(_dir, reach)
            .addScaledVector(_right, (Math.random() - 0.5) * 1.2 * sc)
            .addScaledVector(_up, (Math.random() - 0.5) * 0.9 * sc);
          this.spawnBolt(
            _origin,
            _tmpPt,
            Math.random() < 0.6 ? meta.color : meta.secondaryColor,
            0.34 * sc
          );
          _tmpVel.copy(_dir).multiplyScalar(5.5 * sc);
          this.spawnParticle(
            _origin,
            _tmpVel,
            meta.color,
            0.22,
            0.7 * sc,
            0.1 * sc,
            0,
            true
          );
        } else {
          // Volumetric breath / stream / beam particles
          const isBeam = attackType === 'shadowBeam' || attackType === 'solarBeam';
          if (isBeam && hIdx === 0) {
            this.beamMesh.position.copy(_origin);
            this.beamMesh.quaternion.setFromUnitVectors(_fwdRef, _dir);
            const len = 4.6 * sc;
            const pulse = 0.85 + 0.25 * Math.sin(progress * 28);
            this.beamMesh.scale.set(sc * pulse, sc * pulse, len);
            this.beamMat.color.set(meta.color);
            this.beamMat.opacity = 0.68 * Math.sin(Math.min(1, progress) * Math.PI);
            this.beamMesh.visible = true;
            this.beamTimer = 0.08;
          }

          const spread = isBeam ? 0.14 : attackType === 'waterJet' ? 0.18 : 0.34;
          const count = rig.mouthAnchors.length > 1 ? 2 : 3;
          for (let k = 0; k < count; k++) {
            const spd = (isBeam ? 9.5 : attackType === 'waterJet' ? 8.2 : 6.2) * sc * (0.82 + Math.random() * 0.36);
            _tmpVel
              .copy(_dir)
              .multiplyScalar(spd)
              .addScaledVector(_right, (Math.random() - 0.5) * spread * spd)
              .addScaledVector(_up, (Math.random() - 0.42) * spread * spd);
            const col = Math.random() < 0.65 ? meta.color : meta.secondaryColor;
            const startS = (isBeam ? 0.55 : 0.72) * sc * (0.8 + Math.random() * 0.45);
            const endS = isBeam ? 0.2 * sc : 1.75 * sc;
            const grav = attackType === 'waterJet' || attackType === 'poisonSpit' ? 5.8 : -1.2;
            const additive = attackType !== 'poisonSpit';
            this.spawnParticle(
              _origin,
              _tmpVel,
              col,
              isBeam ? 0.32 : 0.42,
              startS,
              endS,
              grav,
              additive
            );
          }
        }
      }
    }
  }

  public update(dt: number) {
    if (this.beamTimer > 0) {
      this.beamTimer -= dt;
      if (this.beamTimer <= 0) {
        this.beamMesh.visible = false;
      }
    }

    for (const orb of this.chargeOrbs) {
      if (orb.mesh.visible) {
        orb.age -= dt;
        if (orb.age <= 0) orb.mesh.visible = false;
      }
    }

    for (const p of this.particles) {
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      const u = p.age / p.life;
      p.vel.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += p.rotVel.x * dt;
      p.mesh.rotation.y += p.rotVel.y * dt;
      p.mesh.scale.setScalar(THREE.MathUtils.lerp(p.startScale, p.endScale, u));
      p.mat.opacity = (1 - u) * 0.9;
    }

    for (const r of this.rings) {
      if (!r.active) continue;
      r.age += dt;
      if (r.age >= r.life) {
        r.active = false;
        r.mesh.visible = false;
        continue;
      }
      const u = r.age / r.life;
      const easeOut = 1 - (1 - u) * (1 - u);
      r.mesh.scale.setScalar(THREE.MathUtils.lerp(r.startScale, r.endScale, easeOut));
      r.mat.opacity = (1 - u) * 0.85;
    }

    for (const b of this.bolts) {
      if (!b.active) continue;
      b.age += dt;
      if (b.age >= b.life) {
        b.active = false;
        b.line.visible = false;
        continue;
      }
      b.mat.opacity = 1 - b.age / b.life;
    }
  }

  public clear() {
    this.beamMesh.visible = false;
    this.beamTimer = 0;
    for (const orb of this.chargeOrbs) {
      orb.mesh.visible = false;
    }
    for (const p of this.particles) {
      p.active = false;
      p.mesh.visible = false;
    }
    for (const r of this.rings) {
      r.active = false;
      r.mesh.visible = false;
    }
    for (const b of this.bolts) {
      b.active = false;
      b.line.visible = false;
    }
  }

  public dispose() {
    this.clear();
    this.sphereGeo.dispose();
    this.crystalGeo.dispose();
    this.chunkGeo.dispose();
    this.ringGeo.dispose();
    this.beamGeo.dispose();
    this.beamMat.dispose();
    for (const orb of this.chargeOrbs) orb.mat.dispose();
    for (const p of this.particles) p.mat.dispose();
    for (const r of this.rings) r.mat.dispose();
    for (const b of this.bolts) {
      b.line.geometry.dispose();
      b.mat.dispose();
    }
    this.parent.remove(this.container);
  }
}
