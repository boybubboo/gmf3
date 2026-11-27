import * as THREE from 'three';

export interface ActiveHeroEffectTimers {
  burn: number;
  freeze: number;
  shock: number;
  poison: number;
  soak: number;
}

interface PooledMote {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  vel: THREE.Vector3;
  age: number;
  life: number;
  startScale: number;
  endScale: number;
  gravity: number;
  active: boolean;
}

interface PooledShockArc {
  line: THREE.Line;
  mat: THREE.LineBasicMaterial;
  posAttr: THREE.BufferAttribute;
  age: number;
  life: number;
  active: boolean;
}

const _pt = new THREE.Vector3();
const _start = new THREE.Vector3();
const _end = new THREE.Vector3();

/**
 * Pooled zero-GC combat status & celebratory VFX attached to world space:
 * - Fire Burn: clinging orange-gold flames + dark soot & rising smoke puffs
 * - Ice Freeze: orbiting frost crystal shards + icy chill mist
 * - Electric Shock: crackling jagged arcs pulsing around hero + dark soot smoke
 * - Poison / Soak: bubbling venom or splashing droplets
 * - Knockdown Dust, Boss Death Ember/Smoke Explosion, & Hero Victory Golden Sparkles
 */
export class HeroCombatEffectsController {
  private readonly parent: THREE.Object3D;
  private readonly container: THREE.Group;
  private readonly sphereGeo: THREE.SphereGeometry;
  private readonly shardGeo: THREE.OctahedronGeometry;
  private readonly puffGeo: THREE.DodecahedronGeometry;
  private readonly motes: PooledMote[] = [];
  private readonly arcs: PooledShockArc[] = [];
  private statusEmitAccum = 0;
  private victoryEmitAccum = 0;

  constructor(parent: THREE.Object3D) {
    this.parent = parent;
    this.container = new THREE.Group();
    this.container.name = 'HeroCombatEffectsContainer';
    this.parent.add(this.container);

    this.sphereGeo = new THREE.SphereGeometry(0.11, 8, 6);
    this.shardGeo = new THREE.OctahedronGeometry(0.14, 0);
    this.puffGeo = new THREE.DodecahedronGeometry(0.16, 0);

    const maxMotes = 48;
    for (let i = 0; i < maxMotes; i++) {
      const geo = i % 3 === 0 ? this.shardGeo : i % 3 === 1 ? this.puffGeo : this.sphereGeo;
      const mat = new THREE.MeshBasicMaterial({
        color: '#F97316',
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = true;
      mesh.frustumCulled = false;
      mesh.position.set(0, -500, 0);
      mesh.scale.setScalar(0.0001);
      this.container.add(mesh);
      this.motes.push({
        mesh,
        mat,
        vel: new THREE.Vector3(),
        age: 0,
        life: 0.5,
        startScale: 1,
        endScale: 0.2,
        gravity: 0,
        active: false,
      });
    }

    const maxArcs = 10;
    for (let i = 0; i < maxArcs; i++) {
      const positions = new Float32Array(8 * 3);
      const geo = new THREE.BufferGeometry();
      const posAttr = new THREE.BufferAttribute(positions, 3);
      geo.setAttribute('position', posAttr);
      const mat = new THREE.LineBasicMaterial({
        color: '#FACC15',
        transparent: true,
        opacity: 0,
      });
      const line = new THREE.Line(geo, mat);
      line.visible = true;
      line.frustumCulled = false;
      this.container.add(line);
      this.arcs.push({ line, mat, posAttr, age: 0, life: 0.16, active: false });
    }
  }

  private spawnMote(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    colorHex: string,
    life: number,
    startScale: number,
    endScale: number,
    gravity = 0
  ) {
    for (const m of this.motes) {
      if (m.active) continue;
      m.active = true;
      m.age = 0;
      m.life = life;
      m.startScale = startScale;
      m.endScale = endScale;
      m.gravity = gravity;
      m.mesh.position.set(x, y, z);
      m.vel.set(vx, vy, vz);
      m.mesh.scale.setScalar(startScale);
      m.mat.color.set(colorHex);
      m.mat.opacity = 0.9;
      return;
    }
  }

  private spawnShockArc(cx: number, cy: number, cz: number, radius: number, colorHex: string) {
    for (const a of this.arcs) {
      if (a.active) continue;
      a.active = true;
      a.age = 0;
      a.life = 0.12 + Math.random() * 0.08;
      const theta1 = Math.random() * Math.PI * 2;
      const theta2 = theta1 + (Math.random() - 0.5) * 2.2;
      _start.set(
        cx + Math.cos(theta1) * radius,
        cy + 0.35 + Math.random() * 1.15,
        cz + Math.sin(theta1) * radius
      );
      _end.set(
        cx + Math.cos(theta2) * radius,
        cy + 0.3 + Math.random() * 1.25,
        cz + Math.sin(theta2) * radius
      );
      const arr = a.posAttr.array as Float32Array;
      const segs = 7;
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        _pt.lerpVectors(_start, _end, t);
        if (i > 0 && i < segs) {
          const jitter = 0.24 * Math.sin(t * Math.PI);
          _pt.x += (Math.random() - 0.5) * jitter * 2;
          _pt.y += (Math.random() - 0.5) * jitter * 2;
          _pt.z += (Math.random() - 0.5) * jitter * 2;
        }
        arr[i * 3] = _pt.x;
        arr[i * 3 + 1] = _pt.y;
        arr[i * 3 + 2] = _pt.z;
      }
      a.posAttr.needsUpdate = true;
      a.mat.color.set(colorHex);
      a.mat.opacity = 0.96;
      return;
    }
  }

  public updateHeroStatuses(
    hx: number,
    hy: number,
    hz: number,
    dt: number,
    timers: ActiveHeroEffectTimers
  ) {
    this.statusEmitAccum += dt;
    if (this.statusEmitAccum < 0.048) return;
    this.statusEmitAccum = 0;

    if (timers.burn > 0) {
      // Flames licking upward + dark soot/smoke billowing off hero
      const ang = Math.random() * Math.PI * 2;
      const r = 0.22 + Math.random() * 0.36;
      this.spawnMote(
        hx + Math.cos(ang) * r,
        hy + 0.35 + Math.random() * 0.9,
        hz + Math.sin(ang) * r,
        (Math.random() - 0.5) * 0.5,
        1.5 + Math.random() * 1.3,
        (Math.random() - 0.5) * 0.5,
        Math.random() < 0.65 ? '#F97316' : '#FDE047',
        0.38 + Math.random() * 0.2,
        0.95,
        0.18,
        -0.6
      );
      if (Math.random() < 0.72) {
        this.spawnMote(
          hx + (Math.random() - 0.5) * 0.55,
          hy + 0.95 + Math.random() * 0.5,
          hz + (Math.random() - 0.5) * 0.55,
          (Math.random() - 0.5) * 0.45,
          1.2 + Math.random() * 0.8,
          (Math.random() - 0.5) * 0.45,
          Math.random() < 0.5 ? '#292524' : '#57534E',
          0.65 + Math.random() * 0.25,
          0.8,
          1.65,
          -0.4
        );
      }
    }

    if (timers.freeze > 0) {
      // Icy blue crystal shards + pale chill mist hugging the hero
      const ang = Math.random() * Math.PI * 2;
      const r = 0.42 + Math.random() * 0.28;
      this.spawnMote(
        hx + Math.cos(ang) * r,
        hy + 0.25 + Math.random() * 1.15,
        hz + Math.sin(ang) * r,
        Math.cos(ang + 1.5) * 0.6,
        0.35 + Math.random() * 0.4,
        Math.sin(ang + 1.5) * 0.6,
        Math.random() < 0.6 ? '#38BDF8' : '#BAE6FD',
        0.48 + Math.random() * 0.22,
        0.9,
        0.2,
        0.2
      );
      if (Math.random() < 0.55) {
        this.spawnMote(
          hx + (Math.random() - 0.5) * 0.6,
          hy + 0.2 + Math.random() * 0.7,
          hz + (Math.random() - 0.5) * 0.6,
          (Math.random() - 0.5) * 0.4,
          0.2,
          (Math.random() - 0.5) * 0.4,
          '#E0F2FE',
          0.55,
          0.85,
          1.45,
          0.1
        );
      }
    }

    if (timers.shock > 0) {
      // Soot puffs + crackling jagged electric bolts around hero
      this.spawnShockArc(hx, hy, hz, 0.58, Math.random() < 0.65 ? '#FACC15' : '#7DD3FC');
      if (Math.random() < 0.6) {
        this.spawnShockArc(hx, hy, hz, 0.68, '#FEF08A');
      }
      if (Math.random() < 0.68) {
        this.spawnMote(
          hx + (Math.random() - 0.5) * 0.55,
          hy + 0.75 + Math.random() * 0.7,
          hz + (Math.random() - 0.5) * 0.55,
          (Math.random() - 0.5) * 0.5,
          0.95 + Math.random() * 0.65,
          (Math.random() - 0.5) * 0.5,
          Math.random() < 0.55 ? '#1F2937' : '#4B5563',
          0.58,
          0.72,
          1.45,
          -0.3
        );
      }
    }

    if (timers.poison > 0) {
      this.spawnMote(
        hx + (Math.random() - 0.5) * 0.65,
        hy + 0.4 + Math.random() * 0.9,
        hz + (Math.random() - 0.5) * 0.65,
        (Math.random() - 0.5) * 0.3,
        0.95 + Math.random() * 0.5,
        (Math.random() - 0.5) * 0.3,
        Math.random() < 0.6 ? '#4ADE80' : '#A855F7',
        0.5,
        0.65,
        0.15,
        -0.2
      );
    }

    if (timers.soak > 0 && Math.random() < 0.65) {
      this.spawnMote(
        hx + (Math.random() - 0.5) * 0.55,
        hy + 0.6 + Math.random() * 0.8,
        hz + (Math.random() - 0.5) * 0.55,
        (Math.random() - 0.5) * 0.5,
        -0.6,
        (Math.random() - 0.5) * 0.5,
        '#38BDF8',
        0.35,
        0.55,
        0.2,
        6.5
      );
    }
  }

  public emitKnockdownImpact(hx: number, hy: number, hz: number) {
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * Math.PI * 2 + Math.random() * 0.25;
      const spd = 1.6 + Math.random() * 2.0;
      this.spawnMote(
        hx + Math.cos(ang) * 0.25,
        hy + 0.16,
        hz + Math.sin(ang) * 0.25,
        Math.cos(ang) * spd,
        0.75 + Math.random() * 0.9,
        Math.sin(ang) * spd,
        i % 2 === 0 ? '#D6D3D1' : '#A8A29E',
        0.46 + Math.random() * 0.2,
        0.85,
        1.5,
        2.6
      );
    }
  }

  public emitBossDeathBurst(bx: number, by: number, bz: number, primaryHex = '#EA580C', accentHex = '#FBBF24') {
    for (let i = 0; i < 12; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 1.4 + Math.random() * 4.2;
      const isSmoke = i % 3 === 0;
      this.spawnMote(
        bx + (Math.random() - 0.5) * 1.4,
        by + 0.5 + Math.random() * 1.2,
        bz + (Math.random() - 0.5) * 1.4,
        Math.cos(ang) * spd,
        1.6 + Math.random() * 3.2,
        Math.sin(ang) * spd,
        isSmoke ? '#3F3F46' : i % 2 === 0 ? primaryHex : accentHex,
        isSmoke ? 0.95 : 0.72,
        isSmoke ? 1.4 : 1.15,
        isSmoke ? 2.4 : 0.2,
        isSmoke ? -0.4 : 4.2
      );
    }
  }

  public emitVictorySparkles(hx: number, hy: number, hz: number, dt: number) {
    this.victoryEmitAccum += dt;
    if (this.victoryEmitAccum < 0.055) return;
    this.victoryEmitAccum = 0;

    for (let i = 0; i < 2; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r = 0.55 + Math.random() * 1.1;
      this.spawnMote(
        hx + Math.cos(ang) * r,
        hy + 0.5 + Math.random() * 1.6,
        hz + Math.sin(ang) * r,
        (Math.random() - 0.5) * 0.6,
        1.6 + Math.random() * 1.5,
        (Math.random() - 0.5) * 0.6,
        Math.random() < 0.65 ? '#FDE047' : '#F59E0B',
        0.72 + Math.random() * 0.3,
        0.85,
        0.1,
        1.4
      );
    }
  }

  public tick(dt: number) {
    for (const m of this.motes) {
      if (!m.active) continue;
      m.age += dt;
      if (m.age >= m.life) {
        m.active = false;
        m.mat.opacity = 0;
        m.mesh.scale.setScalar(0.0001);
        m.mesh.position.set(0, -500, 0);
        continue;
      }
      const u = m.age / m.life;
      m.vel.y -= m.gravity * dt;
      m.mesh.position.addScaledVector(m.vel, dt);
      m.mesh.rotation.y += 2.2 * dt;
      m.mesh.scale.setScalar(THREE.MathUtils.lerp(m.startScale, m.endScale, u));
      m.mat.opacity = (1 - u) * 0.88;
    }

    for (const a of this.arcs) {
      if (!a.active) continue;
      a.age += dt;
      if (a.age >= a.life) {
        a.active = false;
        a.mat.opacity = 0;
        continue;
      }
      a.mat.opacity = 1 - a.age / a.life;
    }
  }

  public clear() {
    for (const m of this.motes) {
      m.active = false;
      m.mat.opacity = 0;
      m.mesh.scale.setScalar(0.0001);
      m.mesh.position.set(0, -500, 0);
    }
    for (const a of this.arcs) {
      a.active = false;
      a.mat.opacity = 0;
    }
  }

  public dispose() {
    this.clear();
    this.sphereGeo.dispose();
    this.shardGeo.dispose();
    this.puffGeo.dispose();
    for (const m of this.motes) m.mat.dispose();
    for (const a of this.arcs) {
      a.line.geometry.dispose();
      a.mat.dispose();
    }
    this.parent.remove(this.container);
  }
}
