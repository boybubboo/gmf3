import * as THREE from 'three';
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu';
import {
  Fn,
  abs,
  atan,
  clamp,
  cos,
  dot,
  float,
  fract,
  length,
  max,
  mix,
  normalView,
  positionViewDirection,
  pow,
  sin,
  smoothstep,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import type { FxEmitterConfig, FxEmitterPresetId } from '../types/maker';

export type ArcanePresetId =
  | 'dimensionalPortal'
  | 'arcaneSigil'
  | 'crystalEruption'
  | 'energyPillar'
  | 'voidVortex'
  | 'meteorStrike';

export function isArcanePreset(preset: FxEmitterPresetId): preset is ArcanePresetId {
  return (
    preset === 'dimensionalPortal' ||
    preset === 'arcaneSigil' ||
    preset === 'crystalEruption' ||
    preset === 'energyPillar' ||
    preset === 'voidVortex' ||
    preset === 'meteorStrike'
  );
}

// Reusable scratch transforms (zero per-frame heap allocations)
const _dummy = new THREE.Object3D();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _vecA = new THREE.Vector3();
const _colA = new THREE.Color();
const _colB = new THREE.Color();

interface OrbitShard {
  angle: number;
  radius: number;
  height: number;
  speed: number;
  bobPhase: number;
  scale: number;
  tiltX: number;
  tiltZ: number;
}

interface CrystalSpireSpec {
  x: number;
  z: number;
  rotY: number;
  tiltX: number;
  tiltZ: number;
  radius: number;
  height: number;
  delay: number;
}

interface MeteorDebris {
  vx: number;
  vy: number;
  vz: number;
  rotSpeedX: number;
  rotSpeedY: number;
  scale: number;
}

/**
 * Builds a tapered hexagonal faceted crystal prism with base at y = 0 and sharp apex at y = 1.
 */
function createHexCrystalGeometry(): THREE.BufferGeometry {
  const sides = 6;
  const positions: number[] = [];
  const uvs: number[] = [];

  const pushTri = (
    ax: number, ay: number, az: number, au: number, av: number,
    bx: number, by: number, bz: number, bu: number, bv: number,
    cx: number, cy: number, cz: number, cu: number, cv: number
  ) => {
    positions.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    uvs.push(au, av, bu, bv, cu, cv);
  };

  const baseR = 0.24;
  const shoulderR = 0.28;
  const shoulderY = 0.68;
  const tipY = 1.0;

  for (let i = 0; i < sides; i++) {
    const a0 = (i / sides) * Math.PI * 2;
    const a1 = ((i + 1) / sides) * Math.PI * 2;
    const u0 = i / sides;
    const u1 = (i + 1) / sides;

    const bx0 = Math.cos(a0) * baseR;
    const bz0 = Math.sin(a0) * baseR;
    const bx1 = Math.cos(a1) * baseR;
    const bz1 = Math.sin(a1) * baseR;

    const sx0 = Math.cos(a0) * shoulderR;
    const sz0 = Math.sin(a0) * shoulderR;
    const sx1 = Math.cos(a1) * shoulderR;
    const sz1 = Math.sin(a1) * shoulderR;

    // Lower hexagonal prism shaft
    pushTri(bx0, 0, bz0, u0, 0, bx1, 0, bz1, u1, 0, sx1, shoulderY, sz1, u1, shoulderY);
    pushTri(bx0, 0, bz0, u0, 0, sx1, shoulderY, sz1, u1, shoulderY, sx0, shoulderY, sz0, u0, shoulderY);

    // Tapered pyramidal crown
    pushTri(sx0, shoulderY, sz0, u0, shoulderY, sx1, shoulderY, sz1, u1, shoulderY, 0, tipY, 0, (u0 + u1) * 0.5, 1.0);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Builds a coiled 3D helix tube wrapping around Y from y = 0 to y = 1.
 */
function createHelixTubeGeometry(
  radius: number,
  turns: number,
  phaseOffset: number,
  tubeRadius: number
): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  const steps = 44;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * Math.PI * 2 * turns + phaseOffset;
    const taper = 1 - Math.abs(t - 0.5) * 0.28;
    pts.push(new THREE.Vector3(Math.cos(a) * radius * taper, t, Math.sin(a) * radius * taper));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, 48, tubeRadius, 6, false);
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Builds a funnel-sculpted accretion disc (radius 1, slight vortex dip in the center).
 */
function createVortexFunnelGeometry(): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(2.2, 2.2, 24, 24);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    const dip = -Math.exp(-r * r * 3.8) * 0.42;
    pos.setY(i, dip);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Procedural TSL Arcane, Portal & Spell Ability VFX controller.
 * Inspired by shader-driven game ability VFX (LinearAbilityExtThreeJS):
 *  - 100% WebGPU + WebGL2 compatible via Three.js TSL node materials
 *  - Zero external textures, zero per-frame allocations, clean full disposal
 */
export class ArcaneVfxController {
  public readonly root = new THREE.Group();
  private readonly preset: ArcanePresetId;

  // Shared live TSL uniforms
  private readonly uTime = uniform(0);
  private readonly uSpeed = uniform(1);
  private readonly uEmissive = uniform(2.0);
  private readonly uBurst = uniform(0);
  private readonly uProgress = uniform(0);
  private readonly uColorA = uniform(new THREE.Color('#A855F7'));
  private readonly uColorB = uniform(new THREE.Color('#22D3EE'));

  private elapsed = 0;
  private burstEnergy = 0;
  private cycleTimer = 0;

  // Dynamic sub-elements animated per-frame
  private pointLight: THREE.PointLight | null = null;
  private ringOuter: THREE.Mesh | null = null;
  private ringInner: THREE.Mesh | null = null;
  private runeRingMesh: THREE.InstancedMesh | null = null;
  private shardMesh: THREE.InstancedMesh | null = null;
  private shards: OrbitShard[] = [];

  // Arcane sigil / energy pillar meshes
  private sigilInnerMesh: THREE.Mesh | null = null;
  private curtainMesh: THREE.Mesh | null = null;
  private helixA: THREE.Mesh | null = null;
  private helixB: THREE.Mesh | null = null;

  // Crystal eruption
  private crystalMesh: THREE.InstancedMesh | null = null;
  private crystalSpecs: CrystalSpireSpec[] = [];

  // Void vortex
  private vortexCore: THREE.Mesh | null = null;
  private vortexCorona: THREE.Mesh | null = null;
  private vortexHalo: THREE.Mesh | null = null;

  // Meteor strike
  private meteorGroup: THREE.Group | null = null;
  private meteorDome: THREE.Mesh | null = null;
  private meteorShockRing: THREE.Mesh | null = null;
  private meteorDebrisMesh: THREE.InstancedMesh | null = null;
  private meteorDebris: MeteorDebris[] = [];
  private meteorImpactAge = 99;
  private meteorCyclePhase = 0;

  constructor(config: FxEmitterConfig) {
    this.preset = isArcanePreset(config.preset) ? config.preset : 'dimensionalPortal';
    this.syncUniformsFromConfig(config);

    switch (this.preset) {
      case 'dimensionalPortal':
        this.buildDimensionalPortal(config);
        break;
      case 'arcaneSigil':
        this.buildArcaneSigil(config);
        break;
      case 'crystalEruption':
        this.buildCrystalEruption(config);
        break;
      case 'energyPillar':
        this.buildEnergyPillar(config);
        break;
      case 'voidVortex':
        this.buildVoidVortex(config);
        break;
      case 'meteorStrike':
        this.buildMeteorStrike(config);
        break;
    }
  }

  public syncUniformsFromConfig(config: FxEmitterConfig): void {
    _colA.set(config.startColor || '#A855F7');
    _colB.set(config.endColor || '#22D3EE');
    this.uColorA.value.copy(_colA);
    this.uColorB.value.copy(_colB);
    this.uSpeed.value = Math.max(0.1, config.speed || 1.0);
    this.uEmissive.value = Math.max(0.2, config.emissiveIntensity || 1.8);
    if (this.pointLight) {
      this.pointLight.color.copy(_colA).lerp(_colB, 0.35);
    }
  }

  public triggerBurst(): void {
    this.burstEnergy = 1.0;
    if (this.preset === 'crystalEruption') {
      // Jump straight to eruption onset
      this.cycleTimer = 0.25;
    } else if (this.preset === 'meteorStrike') {
      // Launch meteor immediately from the sky
      this.meteorCyclePhase = 0.05;
      this.meteorImpactAge = 99;
    }
  }

  // ---------------------------------------------------------------------------
  // TSL SHADER FACTORIES (WebGPU WGSL + WebGL2 GLSL native)
  // ---------------------------------------------------------------------------

  private createPortalVortexMaterial(): MeshBasicNodeMaterial {
    const uTime = this.uTime;
    const uSpeed = this.uSpeed;
    const uEmissive = this.uEmissive;
    const uBurst = this.uBurst;
    const uColorA = this.uColorA;
    const uColorB = this.uColorB;

    const mat = new MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
      fog: false,
    });

    mat.colorNode = Fn(() => {
      const p = uv().sub(vec2(0.5, 0.5)).mul(2.0);
      const r = length(p);
      const angle = atan(p.y, p.x);
      const t = uTime.mul(uSpeed);

      // 3-arm primary spiral + 5-arm counter-harmonic plasma wave
      const s1 = sin(angle.mul(3.0).add(r.mul(13.0)).sub(t.mul(3.4))).mul(0.5).add(0.5);
      const s2 = sin(angle.mul(5.0).sub(r.mul(9.0)).add(t.mul(2.2))).mul(0.5).add(0.5);
      const swirl = pow(s1.mul(0.65).add(s2.mul(0.35)), float(1.4));

      // Crisp blazing outer event-horizon ring + bright shockwave pulse on burst
      const rimRing = smoothstep(float(0.68), float(0.92), r).mul(
        float(1.0).sub(smoothstep(float(0.92), float(1.0), r))
      );
      const innerRipple = sin(r.mul(18.0).sub(t.mul(5.2))).mul(0.5).add(0.5);
      const burstWave = smoothstep(float(0.0), float(0.14), float(0.14).sub(abs(r.sub(float(1.0).sub(uBurst))))).mul(uBurst);

      // Dark mysterious dimensional core opening into luminous plasma
      const coreMask = smoothstep(float(0.12), float(0.42), r);
      const outerFade = float(1.0).sub(smoothstep(float(0.86), float(1.0), r));

      const col = mix(uColorA, uColorB, swirl.mul(0.75).add(rimRing.mul(0.45))).toVar();
      col.addAssign(vec3(1.0, 0.96, 1.0).mul(rimRing.mul(0.85).add(burstWave.mul(1.2))));

      const intensity = coreMask
        .mul(swirl.mul(0.85).add(innerRipple.mul(0.22)))
        .add(rimRing.mul(1.4))
        .add(burstWave.mul(1.3))
        .add(float(0.16).mul(outerFade));

      const glow = uEmissive.mul(0.55).add(0.55);
      const alpha = clamp(intensity.mul(outerFade), float(0.0), float(1.0));
      return vec4(col.mul(glow).mul(alpha), alpha);
    })();

    return mat;
  }

  private createArcaneSigilMaterial(isTargetLock = false): MeshBasicNodeMaterial {
    const uTime = this.uTime;
    const uSpeed = this.uSpeed;
    const uEmissive = this.uEmissive;
    const uBurst = this.uBurst;
    const uColorA = this.uColorA;
    const uColorB = this.uColorB;

    const mat = new MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
      fog: false,
    });

    mat.colorNode = Fn(() => {
      const p = uv().sub(vec2(0.5, 0.5)).mul(2.0);
      const r = length(p);
      const angle = atan(p.y, p.x);
      const t = uTime.mul(uSpeed);

      // Outer double SDF ring
      const ringOuter = float(1.0).sub(smoothstep(float(0.012), float(0.042), abs(r.sub(0.92))));
      const ringTrack = float(1.0).sub(smoothstep(float(0.01), float(0.032), abs(r.sub(0.78))));
      const ringInner = float(1.0).sub(smoothstep(float(0.012), float(0.038), abs(r.sub(0.48))));

      // Procedural segmented rune notches between r = 0.78 and 0.92
      const bandMask = smoothstep(float(0.77), float(0.80), r).mul(
        float(1.0).sub(smoothstep(float(0.89), float(0.92), r))
      );
      const runeTicks = smoothstep(
        float(0.25),
        float(0.65),
        sin(angle.mul(18.0).add(t.mul(1.1))).mul(cos(angle.mul(6.0).sub(t.mul(0.6))))
      );
      const runeBand = bandMask.mul(runeTicks).mul(0.85);

      // Rotating 6-point sacred star polygon SDF via polar angular modulation
      const starAngle = angle.add(t.mul(0.55));
      const starWave = abs(sin(starAngle.mul(3.0))).mul(0.18).add(0.48);
      const starLine = float(1.0).sub(smoothstep(float(0.012), float(0.042), abs(r.sub(starWave))));

      // Counter-rotating 3-point inner triangle wave
      const triAngle = angle.sub(t.mul(0.8));
      const triWave = abs(cos(triAngle.mul(1.5))).mul(0.22).add(0.26);
      const triLine = float(1.0).sub(smoothstep(float(0.012), float(0.04), abs(r.sub(triWave))));

      // Expanding pulse shockwave ring
      const pulseR = isTargetLock
        ? float(0.94).sub(fract(t.mul(0.55)).mul(0.88))
        : fract(t.mul(0.38)).mul(0.96);
      const pulseRing = float(1.0)
        .sub(smoothstep(float(0.015), float(0.075), abs(r.sub(pulseR))))
        .mul(float(1.0).sub(pulseR.mul(0.65)));

      // Soft radial ambient glow fill
      const centerGlow = pow(clamp(float(1.0).sub(r), float(0.0), float(1.0)), float(2.4)).mul(0.35);

      const lineSum = clamp(
        ringOuter
          .add(ringTrack.mul(0.85))
          .add(ringInner.mul(0.9))
          .add(runeBand)
          .add(starLine.mul(0.95))
          .add(triLine.mul(0.8))
          .add(pulseRing.mul(1.1))
          .add(centerGlow)
          .add(uBurst.mul(0.6).mul(float(1.0).sub(smoothstep(float(0.7), float(1.0), r)))),
        float(0.0),
        float(1.6)
      );

      const edgeClip = float(1.0).sub(smoothstep(float(0.95), float(1.0), r));
      const col = mix(uColorA, uColorB, clamp(r.mul(0.75).add(pulseRing.mul(0.5)), float(0.0), float(1.0))).toVar();
      col.addAssign(vec3(0.95, 0.98, 1.0).mul(ringOuter.add(starLine).mul(0.45)));

      const glow = uEmissive.mul(0.5).add(0.6);
      const alpha = clamp(lineSum.mul(edgeClip), float(0.0), float(1.0));
      return vec4(col.mul(glow).mul(alpha), alpha);
    })();

    return mat;
  }

  private createEnergyCurtainMaterial(spiralTwist: number, scrollSpeed: number): MeshBasicNodeMaterial {
    const uTime = this.uTime;
    const uSpeed = this.uSpeed;
    const uEmissive = this.uEmissive;
    const uBurst = this.uBurst;
    const uColorA = this.uColorA;
    const uColorB = this.uColorB;

    const mat = new MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
      fog: false,
    });

    mat.colorNode = Fn(() => {
      const uvCoord = uv();
      const t = uTime.mul(uSpeed).mul(scrollSpeed);

      // Vertical fade cleanly at bottom and top edges (zero harsh cylinder seam)
      const vFade = smoothstep(float(0.0), float(0.14), uvCoord.y).mul(
        float(1.0).sub(smoothstep(float(0.68), float(1.0), uvCoord.y))
      );

      // Scrolling plasma filaments wrapping around the cylinder
      const theta = uvCoord.x.mul(6.2831853);
      const s1 = sin(theta.mul(4.0).add(uvCoord.y.mul(spiralTwist)).sub(t.mul(3.8))).mul(0.5).add(0.5);
      const s2 = sin(theta.mul(9.0).sub(uvCoord.y.mul(spiralTwist * 0.65)).sub(t.mul(5.4))).mul(0.5).add(0.5);
      const streaks = pow(s1.mul(0.62).add(s2.mul(0.38)), float(1.6));

      // Subtle rising pulse bands
      const band = sin(uvCoord.y.mul(10.0).sub(t.mul(4.5))).mul(0.5).add(0.5);
      const energy = streaks.mul(0.75).add(band.mul(0.25)).add(float(0.22)).add(uBurst.mul(0.55));

      const col = mix(uColorA, uColorB, uvCoord.y.mul(0.65).add(streaks.mul(0.35))).toVar();
      col.addAssign(vec3(1.0, 0.98, 1.0).mul(pow(streaks, float(3.0)).mul(0.6)));

      const glow = uEmissive.mul(0.48).add(0.52);
      const alpha = clamp(energy.mul(vFade).mul(0.85), float(0.0), float(1.0));
      return vec4(col.mul(glow).mul(alpha), alpha);
    })();

    return mat;
  }

  private createCrystalShaderMaterial(): MeshStandardNodeMaterial {
    const uTime = this.uTime;
    const uSpeed = this.uSpeed;
    const uEmissive = this.uEmissive;
    const uColorA = this.uColorA;
    const uColorB = this.uColorB;

    const mat = new MeshStandardNodeMaterial({
      color: '#FFFFFF',
      roughness: 0.16,
      metalness: 0.22,
      transparent: true,
      opacity: 0.92,
    });

    mat.colorNode = Fn(() => {
      const uvCoord = uv();
      return mix(uColorB, uColorA, uvCoord.y);
    })();

    mat.emissiveNode = Fn(() => {
      const uvCoord = uv();
      const t = uTime.mul(uSpeed);
      // View-space Fresnel rim glow so crystal edges blaze luminously
      const ndv = clamp(abs(dot(normalView, positionViewDirection)), float(0.0), float(1.0));
      const fresnel = pow(float(1.0).sub(ndv), float(2.2));
      // Scrolling harmonic crystal shimmer band
      const shimmer = sin(uvCoord.y.mul(14.0).sub(t.mul(3.4))).mul(0.5).add(0.5);
      const tipGlow = smoothstep(float(0.45), float(1.0), uvCoord.y);
      const energy = fresnel.mul(1.35).add(tipGlow.mul(0.65)).add(shimmer.mul(0.32));
      const col = mix(uColorB, uColorA, tipGlow.mul(0.6).add(fresnel.mul(0.4)));
      return col.mul(energy).mul(uEmissive.mul(0.48).add(0.35));
    })();

    return mat;
  }

  private createFresnelDomeMaterial(): MeshBasicNodeMaterial {
    const uTime = this.uTime;
    const uSpeed = this.uSpeed;
    const uEmissive = this.uEmissive;
    const uProgress = this.uProgress;
    const uColorA = this.uColorA;
    const uColorB = this.uColorB;

    const mat = new MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
      fog: false,
    });

    mat.colorNode = Fn(() => {
      const uvCoord = uv();
      const t = uTime.mul(uSpeed);
      const ndv = clamp(abs(dot(normalView, positionViewDirection)), float(0.0), float(1.0));
      const fresnel = pow(float(1.0).sub(ndv), float(2.1));
      const ripple = sin(uvCoord.y.mul(22.0).sub(t.mul(7.0))).mul(0.5).add(0.5);
      const fadeOut = float(1.0).sub(smoothstep(float(0.35), float(1.0), uProgress));
      const alpha = clamp(fresnel.mul(1.25).add(ripple.mul(0.22)).mul(fadeOut), float(0.0), float(1.0));
      const col = mix(uColorA, uColorB, fresnel).add(vec3(1.0, 0.96, 0.92).mul(pow(fresnel, float(3.0)).mul(0.7)));
      const glow = uEmissive.mul(0.5).add(0.6);
      return vec4(col.mul(glow).mul(alpha), alpha);
    })();

    return mat;
  }

  // ---------------------------------------------------------------------------
  // EFFECT BUILDERS
  // ---------------------------------------------------------------------------

  private buildDimensionalPortal(config: FxEmitterConfig): void {
    const r = Math.max(0.6, config.areaRadius || 2.0);
    const centerY = r * 1.05;

    // 1. Vertical swirling event-horizon vortex disc
    const vortexGeo = new THREE.CircleGeometry(r * 0.94, 48);
    const vortexMat = this.createPortalVortexMaterial();
    const vortexMesh = new THREE.Mesh(vortexGeo, vortexMat);
    vortexMesh.position.y = centerY;
    vortexMesh.renderOrder = 9;
    this.root.add(vortexMesh);

    // 2. Outer sculpted beveled portal frame ring
    const outerGeo = new THREE.TorusGeometry(r, r * 0.065, 12, 48);
    const outerMat = new THREE.MeshStandardMaterial({
      color: '#1E1B2E',
      emissive: config.startColor,
      emissiveIntensity: 1.15,
      roughness: 0.28,
      metalness: 0.72,
    });
    this.ringOuter = new THREE.Mesh(outerGeo, outerMat);
    this.ringOuter.position.y = centerY;
    this.root.add(this.ringOuter);

    // 3. Inner counter-rotating filigree energy ring
    const innerGeo = new THREE.TorusGeometry(r * 0.88, r * 0.028, 8, 40);
    const innerMat = new THREE.MeshBasicMaterial({
      color: config.endColor,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this.ringInner = new THREE.Mesh(innerGeo, innerMat);
    this.ringInner.position.y = centerY;
    this.root.add(this.ringInner);

    // 4. 12 instanced floating runic gate segments around the portal rim
    const runeCount = 12;
    const runeGeo = new THREE.BoxGeometry(r * 0.16, r * 0.08, r * 0.06);
    const runeMat = new THREE.MeshStandardMaterial({
      color: '#312E81',
      emissive: config.endColor,
      emissiveIntensity: 1.4,
      roughness: 0.3,
      metalness: 0.55,
    });
    this.runeRingMesh = new THREE.InstancedMesh(runeGeo, runeMat, runeCount);
    this.runeRingMesh.position.y = centerY;
    this.runeRingMesh.frustumCulled = false;
    this.root.add(this.runeRingMesh);

    // 5. Horizontal ground energy spill sigil beneath the gateway
    const groundGeo = new THREE.PlaneGeometry(r * 2.2, r * 2.2);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMesh = new THREE.Mesh(groundGeo, this.createArcaneSigilMaterial(false));
    groundMesh.position.y = 0.04;
    groundMesh.renderOrder = 7;
    this.root.add(groundMesh);

    // 6. 18 orbiting luminous crystal motes spiraling around the portal
    const shardCount = 18;
    const shardGeo = new THREE.OctahedronGeometry(r * 0.065, 0);
    const shardMat = new THREE.MeshBasicMaterial({
      color: config.endColor,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this.shardMesh = new THREE.InstancedMesh(shardGeo, shardMat, shardCount);
    this.shardMesh.position.y = centerY;
    this.shardMesh.frustumCulled = false;
    this.shards = [];
    for (let i = 0; i < shardCount; i++) {
      this.shards.push({
        angle: (i / shardCount) * Math.PI * 2,
        radius: r * (0.98 + (i % 4) * 0.14),
        height: ((i % 5) - 2) * r * 0.16,
        speed: (0.75 + (i % 5) * 0.22) * (i % 2 === 0 ? 1 : -0.8),
        bobPhase: i * 1.43,
        scale: 0.65 + (i % 4) * 0.24,
        tiltX: i * 0.7,
        tiltZ: i * 1.1,
      });
    }
    this.root.add(this.shardMesh);

    // 7. Dynamic portal glow light
    this.pointLight = new THREE.PointLight(config.startColor, 2.8, r * 5.2, 1.6);
    this.pointLight.position.set(0, centerY, 0.35);
    this.root.add(this.pointLight);
  }

  private buildArcaneSigil(config: FxEmitterConfig): void {
    const r = Math.max(0.8, config.areaRadius || 2.8);
    const h = Math.max(0.8, config.areaHeight || 2.4);

    // 1. Primary ground SDF magic circle
    const baseGeo = new THREE.PlaneGeometry(r * 2.0, r * 2.0);
    baseGeo.rotateX(-Math.PI / 2);
    const baseMesh = new THREE.Mesh(baseGeo, this.createArcaneSigilMaterial(false));
    baseMesh.position.y = 0.04;
    baseMesh.renderOrder = 8;
    this.root.add(baseMesh);

    // 2. Elevated counter-rotating secondary sigil ring
    const innerGeo = new THREE.PlaneGeometry(r * 1.25, r * 1.25);
    innerGeo.rotateX(-Math.PI / 2);
    this.sigilInnerMesh = new THREE.Mesh(innerGeo, this.createArcaneSigilMaterial(true));
    this.sigilInnerMesh.position.y = 0.14;
    this.sigilInnerMesh.renderOrder = 9;
    this.root.add(this.sigilInnerMesh);

    // 3. Rising translucent energy veil cylinder around perimeter
    const curtainGeo = new THREE.CylinderGeometry(r * 0.92, r * 0.92, h, 36, 1, true);
    curtainGeo.translate(0, h * 0.5, 0);
    this.curtainMesh = new THREE.Mesh(curtainGeo, this.createEnergyCurtainMaterial(4.5, 0.75));
    this.curtainMesh.renderOrder = 8;
    this.root.add(this.curtainMesh);

    // 4. 24 rising luminous rune motes
    const shardCount = 24;
    const shardGeo = new THREE.OctahedronGeometry(0.085, 0);
    const shardMat = new THREE.MeshBasicMaterial({
      color: config.startColor,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this.shardMesh = new THREE.InstancedMesh(shardGeo, shardMat, shardCount);
    this.shardMesh.frustumCulled = false;
    this.shards = [];
    for (let i = 0; i < shardCount; i++) {
      this.shards.push({
        angle: (i / shardCount) * Math.PI * 2,
        radius: r * (0.45 + (i % 5) * 0.12),
        height: (i / shardCount) * h,
        speed: 0.55 + (i % 4) * 0.22,
        bobPhase: i * 1.91,
        scale: 0.6 + (i % 3) * 0.35,
        tiltX: i * 0.5,
        tiltZ: i * 0.8,
      });
    }
    this.root.add(this.shardMesh);

    this.pointLight = new THREE.PointLight(config.startColor, 2.2, r * 4.0, 1.7);
    this.pointLight.position.set(0, 0.9, 0);
    this.root.add(this.pointLight);
  }

  private buildCrystalEruption(config: FxEmitterConfig): void {
    const r = Math.max(0.8, config.areaRadius || 2.2);
    const h = Math.max(1.0, config.areaHeight || 3.4);

    // 1. Arcane fracture sigil on the ground
    const groundGeo = new THREE.PlaneGeometry(r * 2.3, r * 2.3);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMesh = new THREE.Mesh(groundGeo, this.createArcaneSigilMaterial(false));
    groundMesh.position.y = 0.04;
    groundMesh.renderOrder = 7;
    this.root.add(groundMesh);

    // 2. Cluster of 18 sculpted hexagonal crystal spires with TSL Fresnel rim glow
    const crystalGeo = createHexCrystalGeometry();
    const crystalMat = this.createCrystalShaderMaterial();
    const count = 18;
    this.crystalMesh = new THREE.InstancedMesh(crystalGeo, crystalMat, count);
    this.crystalMesh.frustumCulled = false;
    this.crystalSpecs = [];

    // Hero central spire
    this.crystalSpecs.push({
      x: 0,
      z: 0,
      rotY: 0.3,
      tiltX: 0.05,
      tiltZ: -0.04,
      radius: r * 0.58,
      height: h,
      delay: 0.0,
    });
    // Mid ring (6 angled towering crystals)
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.25;
      const dist = r * (0.28 + (i % 2) * 0.12);
      this.crystalSpecs.push({
        x: Math.cos(a) * dist,
        z: Math.sin(a) * dist,
        rotY: a,
        tiltX: Math.sin(a) * 0.32,
        tiltZ: -Math.cos(a) * 0.32,
        radius: r * (0.34 + (i % 3) * 0.06),
        height: h * (0.64 + (i % 3) * 0.12),
        delay: 0.08 + i * 0.03,
      });
    }
    // Outer ring (11 jagged emerging shards leaning outward)
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2 + 0.12;
      const dist = r * (0.58 + (i % 3) * 0.12);
      this.crystalSpecs.push({
        x: Math.cos(a) * dist,
        z: Math.sin(a) * dist,
        rotY: a + 0.4,
        tiltX: Math.sin(a) * 0.52,
        tiltZ: -Math.cos(a) * 0.52,
        radius: r * (0.22 + (i % 3) * 0.05),
        height: h * (0.35 + (i % 4) * 0.09),
        delay: 0.18 + (i % 5) * 0.04,
      });
    }
    this.root.add(this.crystalMesh);

    // 3. 20 hovering floating crystal dust shards
    const shardCount = 20;
    const shardGeo = new THREE.OctahedronGeometry(0.09, 0);
    const shardMat = new THREE.MeshBasicMaterial({
      color: config.startColor,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this.shardMesh = new THREE.InstancedMesh(shardGeo, shardMat, shardCount);
    this.shardMesh.frustumCulled = false;
    this.shards = [];
    for (let i = 0; i < shardCount; i++) {
      this.shards.push({
        angle: (i / shardCount) * Math.PI * 2,
        radius: r * (0.35 + (i % 5) * 0.16),
        height: 0.4 + (i % 6) * (h * 0.16),
        speed: 0.65 + (i % 4) * 0.25,
        bobPhase: i * 1.61,
        scale: 0.6 + (i % 3) * 0.3,
        tiltX: i * 0.9,
        tiltZ: i * 0.4,
      });
    }
    this.root.add(this.shardMesh);

    this.pointLight = new THREE.PointLight(config.startColor, 2.4, r * 4.5, 1.7);
    this.pointLight.position.set(0, h * 0.45, 0);
    this.root.add(this.pointLight);
  }

  private buildEnergyPillar(config: FxEmitterConfig): void {
    const r = Math.max(0.6, config.areaRadius || 2.1);
    const h = Math.max(3.0, config.areaHeight || 11.0);

    // 1. Blazing inner energy core shaft
    const coreGeo = new THREE.CylinderGeometry(r * 0.24, r * 0.34, h, 24, 1, true);
    coreGeo.translate(0, h * 0.5, 0);
    const coreMesh = new THREE.Mesh(coreGeo, this.createEnergyCurtainMaterial(2.0, 1.8));
    coreMesh.renderOrder = 10;
    this.root.add(coreMesh);

    // 2. Wider swirling plasma outer sheath
    const outerGeo = new THREE.CylinderGeometry(r * 0.55, r * 0.72, h, 32, 1, true);
    outerGeo.translate(0, h * 0.5, 0);
    this.curtainMesh = new THREE.Mesh(outerGeo, this.createEnergyCurtainMaterial(-7.5, 1.25));
    this.curtainMesh.renderOrder = 9;
    this.root.add(this.curtainMesh);

    // 3. Counter-coiled 3D double-helix energy ribbons
    const helixGeoA = createHelixTubeGeometry(r * 0.58, 3.2, 0, Math.max(0.045, r * 0.032));
    helixGeoA.scale(1, h, 1);
    const helixMatA = new THREE.MeshBasicMaterial({
      color: config.startColor,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this.helixA = new THREE.Mesh(helixGeoA, helixMatA);
    this.helixA.renderOrder = 10;
    this.root.add(this.helixA);

    const helixGeoB = createHelixTubeGeometry(r * 0.64, 3.2, Math.PI, Math.max(0.038, r * 0.026));
    helixGeoB.scale(1, h, 1);
    const helixMatB = new THREE.MeshBasicMaterial({
      color: config.endColor,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this.helixB = new THREE.Mesh(helixGeoB, helixMatB);
    this.helixB.renderOrder = 10;
    this.root.add(this.helixB);

    // 4. Ground impact shockwave sigil
    const groundGeo = new THREE.PlaneGeometry(r * 2.5, r * 2.5);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMesh = new THREE.Mesh(groundGeo, this.createArcaneSigilMaterial(false));
    groundMesh.position.y = 0.04;
    groundMesh.renderOrder = 8;
    this.root.add(groundMesh);

    // 5. 24 upward-spiraling sparks
    const shardCount = 24;
    const shardGeo = new THREE.OctahedronGeometry(0.08, 0);
    const shardMat = new THREE.MeshBasicMaterial({
      color: config.startColor,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this.shardMesh = new THREE.InstancedMesh(shardGeo, shardMat, shardCount);
    this.shardMesh.frustumCulled = false;
    this.shards = [];
    for (let i = 0; i < shardCount; i++) {
      this.shards.push({
        angle: (i / shardCount) * Math.PI * 2,
        radius: r * (0.45 + (i % 4) * 0.16),
        height: (i / shardCount) * h,
        speed: 1.6 + (i % 5) * 0.35,
        bobPhase: i * 1.17,
        scale: 0.6 + (i % 3) * 0.32,
        tiltX: i * 0.4,
        tiltZ: i * 0.7,
      });
    }
    this.root.add(this.shardMesh);

    this.pointLight = new THREE.PointLight(config.startColor, 3.2, r * 5.8, 1.5);
    this.pointLight.position.set(0, 1.6, 0);
    this.root.add(this.pointLight);
  }

  private buildVoidVortex(config: FxEmitterConfig): void {
    const r = Math.max(0.8, config.areaRadius || 2.5);

    // 1. Dark event-horizon singularity sphere
    const coreGeo = new THREE.SphereGeometry(r * 0.24, 24, 18);
    const coreMat = new THREE.MeshBasicMaterial({ color: '#05020A' });
    this.vortexCore = new THREE.Mesh(coreGeo, coreMat);
    this.root.add(this.vortexCore);

    // 2. Blazing TSL Fresnel corona shell hugging the dark core
    const coronaGeo = new THREE.SphereGeometry(r * 0.31, 24, 18);
    this.vortexCorona = new THREE.Mesh(coronaGeo, this.createFresnelDomeMaterial());
    this.vortexCorona.renderOrder = 10;
    this.root.add(this.vortexCorona);

    // 3. Funnel-sculpted accretion disc with swirling TSL vortex shader
    const discGeo = createVortexFunnelGeometry();
    discGeo.scale(r, r * 0.75, r);
    const discMesh = new THREE.Mesh(discGeo, this.createPortalVortexMaterial());
    discMesh.renderOrder = 9;
    this.root.add(discMesh);

    // 4. Tilted outer gravitational halo ring
    const haloGeo = new THREE.TorusGeometry(r * 0.82, r * 0.025, 8, 48);
    const haloMat = new THREE.MeshBasicMaterial({
      color: config.endColor,
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this.vortexHalo = new THREE.Mesh(haloGeo, haloMat);
    this.vortexHalo.rotation.set(0.68, 0, 0.35);
    this.root.add(this.vortexHalo);

    // 5. 28 inward-spiraling gravity debris shards
    const shardCount = 28;
    const shardGeo = new THREE.OctahedronGeometry(0.11, 0);
    const shardMat = new THREE.MeshStandardMaterial({
      color: '#1E1B4B',
      emissive: config.startColor,
      emissiveIntensity: 1.5,
      roughness: 0.35,
      metalness: 0.5,
    });
    this.shardMesh = new THREE.InstancedMesh(shardGeo, shardMat, shardCount);
    this.shardMesh.frustumCulled = false;
    this.shards = [];
    for (let i = 0; i < shardCount; i++) {
      this.shards.push({
        angle: (i / shardCount) * Math.PI * 2,
        radius: 0.25 + (i / shardCount) * 0.95, // normalized 0..1.2 orbital progress
        height: ((i % 7) - 3) * 0.14,
        speed: 1.15 + (i % 4) * 0.28,
        bobPhase: i * 1.53,
        scale: 0.5 + (i % 4) * 0.24,
        tiltX: i * 0.8,
        tiltZ: i * 1.3,
      });
    }
    this.root.add(this.shardMesh);

    this.pointLight = new THREE.PointLight(config.startColor, 2.8, r * 5.0, 1.6);
    this.pointLight.position.set(0, 0.4, 0);
    this.root.add(this.pointLight);
  }

  private buildMeteorStrike(config: FxEmitterConfig): void {
    const r = Math.max(0.8, config.areaRadius || 2.6);

    // 1. Lock-on SDF ground targeting circle
    const targetGeo = new THREE.PlaneGeometry(r * 2.0, r * 2.0);
    targetGeo.rotateX(-Math.PI / 2);
    const targetMesh = new THREE.Mesh(targetGeo, this.createArcaneSigilMaterial(true));
    targetMesh.position.y = 0.04;
    targetMesh.renderOrder = 7;
    this.root.add(targetMesh);

    // 2. Descending blazing meteor core + flame tail cone
    const meteorGrp = new THREE.Group();
    const rockGeo = new THREE.IcosahedronGeometry(r * 0.24, 1);
    const rockMat = new THREE.MeshStandardMaterial({
      color: '#451A03',
      emissive: config.startColor,
      emissiveIntensity: 2.4,
      roughness: 0.4,
      metalness: 0.2,
    });
    const rockMesh = new THREE.Mesh(rockGeo, rockMat);
    meteorGrp.add(rockMesh);

    const tailGeo = new THREE.ConeGeometry(r * 0.34, r * 1.65, 16, 1, true);
    tailGeo.translate(0, r * 0.82, 0);
    const tailMesh = new THREE.Mesh(tailGeo, this.createEnergyCurtainMaterial(6.0, 2.6));
    tailMesh.renderOrder = 10;
    meteorGrp.add(tailMesh);

    // Tilt along the diagonal descent vector
    meteorGrp.rotation.z = -0.34;
    this.meteorGroup = meteorGrp;
    this.root.add(meteorGrp);

    // 3. Expanding impact energy shockwave hemisphere dome
    const domeGeo = new THREE.SphereGeometry(r, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
    this.meteorDome = new THREE.Mesh(domeGeo, this.createFresnelDomeMaterial());
    this.meteorDome.visible = false;
    this.meteorDome.renderOrder = 11;
    this.root.add(this.meteorDome);

    // 4. Flat expanding ground blast ring
    const ringGeo = new THREE.RingGeometry(0.68, 1.0, 40);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: config.startColor,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    this.meteorShockRing = new THREE.Mesh(ringGeo, ringMat);
    this.meteorShockRing.position.y = 0.08;
    this.meteorShockRing.visible = false;
    this.meteorShockRing.renderOrder = 10;
    this.root.add(this.meteorShockRing);

    // 5. 24 radial ballistic impact shards
    const debCount = 24;
    const debGeo = new THREE.OctahedronGeometry(0.14, 0);
    const debMat = new THREE.MeshBasicMaterial({
      color: config.startColor,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this.meteorDebrisMesh = new THREE.InstancedMesh(debGeo, debMat, debCount);
    this.meteorDebrisMesh.frustumCulled = false;
    this.meteorDebris = [];
    for (let i = 0; i < debCount; i++) {
      const a = (i / debCount) * Math.PI * 2 + (i % 3) * 0.17;
      const horiz = 2.6 + (i % 5) * 1.1;
      this.meteorDebris.push({
        vx: Math.cos(a) * horiz,
        vy: 3.4 + (i % 4) * 1.35,
        vz: Math.sin(a) * horiz,
        rotSpeedX: 3.5 + (i % 4) * 1.5,
        rotSpeedY: 2.8 + (i % 5) * 1.2,
        scale: 0.65 + (i % 4) * 0.25,
      });
    }
    this.root.add(this.meteorDebrisMesh);

    this.pointLight = new THREE.PointLight(config.startColor, 1.5, r * 6.0, 1.5);
    this.pointLight.position.set(0, 1.2, 0);
    this.root.add(this.pointLight);
  }

  // ---------------------------------------------------------------------------
  // PER-FRAME ANIMATION UPDATE (ZERO ALLOCATIONS)
  // ---------------------------------------------------------------------------

  public update(dt: number, config: FxEmitterConfig): void {
    const spd = Math.max(0.1, config.speed || 1.0);
    this.elapsed += dt;
    this.uTime.value = this.elapsed;

    // Smoothly decay burst flare
    if (this.burstEnergy > 0.001) {
      this.burstEnergy = Math.max(0, this.burstEnergy - dt * 1.45);
    }
    this.uBurst.value = this.burstEnergy;

    const r = Math.max(0.6, config.areaRadius || 2.0);
    const h = Math.max(1.0, config.areaHeight || 3.5);
    const em = Math.max(0.2, config.emissiveIntensity || 1.8);

    if (this.preset === 'dimensionalPortal') {
      if (this.ringOuter) {
        this.ringOuter.rotation.z = this.elapsed * 0.35 * spd;
      }
      if (this.ringInner) {
        this.ringInner.rotation.z = -this.elapsed * 0.9 * spd;
        const s = 1 + Math.sin(this.elapsed * 3.2 * spd) * 0.025 + this.burstEnergy * 0.08;
        this.ringInner.scale.setScalar(s);
      }
      if (this.runeRingMesh) {
        const count = this.runeRingMesh.count;
        const spin = this.elapsed * 0.55 * spd;
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2 + spin;
          const rad = r * (1.07 + Math.sin(this.elapsed * 2.4 + i) * 0.03 + this.burstEnergy * 0.12);
          _dummy.position.set(Math.cos(a) * rad, Math.sin(a) * rad, Math.sin(this.elapsed * 2.0 + i * 1.3) * 0.08);
          _euler.set(0, 0, a + Math.PI * 0.5);
          _dummy.quaternion.setFromEuler(_euler);
          _dummy.scale.setScalar(1 + this.burstEnergy * 0.25);
          _dummy.updateMatrix();
          this.runeRingMesh.setMatrixAt(i, _dummy.matrix);
        }
        this.runeRingMesh.instanceMatrix.needsUpdate = true;
      }
      if (this.shardMesh) {
        for (let i = 0; i < this.shards.length; i++) {
          const s = this.shards[i];
          const a = s.angle + this.elapsed * s.speed * spd;
          const rad = s.radius * (1 + Math.sin(this.elapsed * 2.0 + s.bobPhase) * 0.08);
          _dummy.position.set(
            Math.cos(a) * rad,
            Math.sin(a) * rad,
            s.height + Math.cos(this.elapsed * 1.7 + s.bobPhase) * 0.18
          );
          _euler.set(this.elapsed * 1.8 + s.tiltX, this.elapsed * 2.2, s.tiltZ);
          _dummy.quaternion.setFromEuler(_euler);
          _dummy.scale.setScalar(s.scale * (0.85 + 0.25 * Math.sin(this.elapsed * 3.5 + s.bobPhase)));
          _dummy.updateMatrix();
          this.shardMesh.setMatrixAt(i, _dummy.matrix);
        }
        this.shardMesh.instanceMatrix.needsUpdate = true;
      }
      if (this.pointLight) {
        this.pointLight.intensity = (1.6 + em * 0.8 + Math.sin(this.elapsed * 4.2) * 0.35 + this.burstEnergy * 2.5);
      }
      return;
    }

    if (this.preset === 'arcaneSigil') {
      if (config.burstInterval > 0.2) {
        this.cycleTimer += dt;
        if (this.cycleTimer >= config.burstInterval) {
          this.cycleTimer = 0;
          this.burstEnergy = 0.85;
        }
      }
      if (this.sigilInnerMesh) {
        this.sigilInnerMesh.rotation.y = -this.elapsed * 0.45 * spd;
        this.sigilInnerMesh.position.y = 0.14 + Math.sin(this.elapsed * 2.2) * 0.04;
      }
      if (this.shardMesh) {
        for (let i = 0; i < this.shards.length; i++) {
          const s = this.shards[i];
          const yNorm = (s.height / h + this.elapsed * 0.28 * spd * s.speed) % 1.0;
          const a = s.angle + this.elapsed * 0.75 * spd * s.speed;
          const rad = s.radius * (1 - yNorm * 0.22);
          const fadeScale = Math.sin(yNorm * Math.PI) * s.scale;
          _dummy.position.set(Math.cos(a) * rad, 0.12 + yNorm * h, Math.sin(a) * rad);
          _euler.set(this.elapsed * 2.0 + s.tiltX, a, s.tiltZ);
          _dummy.quaternion.setFromEuler(_euler);
          _dummy.scale.setScalar(Math.max(0.001, fadeScale));
          _dummy.updateMatrix();
          this.shardMesh.setMatrixAt(i, _dummy.matrix);
        }
        this.shardMesh.instanceMatrix.needsUpdate = true;
      }
      if (this.pointLight) {
        this.pointLight.intensity = 1.4 + em * 0.65 + this.burstEnergy * 2.0;
      }
      return;
    }

    if (this.preset === 'crystalEruption') {
      const cycleLen = config.burstInterval > 0.5 ? config.burstInterval : 4.8;
      this.cycleTimer = (this.cycleTimer + dt * spd) % cycleLen;
      const phase = this.cycleTimer / cycleLen; // 0..1

      if (this.crystalMesh) {
        for (let i = 0; i < this.crystalSpecs.length; i++) {
          const sp = this.crystalSpecs[i];
          let grow = 1.0;
          if (phase < 0.16) {
            // Snappy staggered eruption out of ground
            const localT = THREE.MathUtils.clamp((phase - sp.delay * 0.35) / 0.12, 0, 1);
            // Overshoot back-out curve
            const inv = 1 - localT;
            grow = localT <= 0 ? 0.001 : 1 - inv * inv * inv;
          } else if (phase < 0.76) {
            // Hum & crystalline harmonic pulse
            grow = 1.0 + Math.sin(this.elapsed * 4.5 + i * 0.9) * 0.035 + this.burstEnergy * 0.12;
          } else {
            // Smooth shatter-retract back into earth
            const retractT = THREE.MathUtils.clamp((phase - 0.76 - sp.delay * 0.25) / 0.18, 0, 1);
            grow = Math.max(0.001, 1 - retractT * retractT);
          }

          _dummy.position.set(sp.x, 0, sp.z);
          _euler.set(sp.tiltX, sp.rotY, sp.tiltZ, 'YXZ');
          _dummy.quaternion.setFromEuler(_euler);
          const xzScale = sp.radius * (0.25 + 0.75 * grow);
          _dummy.scale.set(xzScale, sp.height * grow, xzScale);
          _dummy.updateMatrix();
          this.crystalMesh.setMatrixAt(i, _dummy.matrix);
        }
        this.crystalMesh.instanceMatrix.needsUpdate = true;
      }

      if (this.shardMesh) {
        for (let i = 0; i < this.shards.length; i++) {
          const s = this.shards[i];
          const a = s.angle + this.elapsed * s.speed * spd;
          const bob = Math.sin(this.elapsed * 2.8 + s.bobPhase) * 0.25;
          _dummy.position.set(Math.cos(a) * s.radius, Math.max(0.15, s.height + bob), Math.sin(a) * s.radius);
          _euler.set(this.elapsed * 2.4 + s.tiltX, this.elapsed * 1.9, s.tiltZ);
          _dummy.quaternion.setFromEuler(_euler);
          _dummy.scale.setScalar(s.scale * (0.75 + 0.3 * Math.sin(this.elapsed * 4.0 + s.bobPhase)));
          _dummy.updateMatrix();
          this.shardMesh.setMatrixAt(i, _dummy.matrix);
        }
        this.shardMesh.instanceMatrix.needsUpdate = true;
      }

      if (this.pointLight) {
        const eruptFlash = phase < 0.2 ? 1.5 : 0;
        this.pointLight.intensity = 1.4 + em * 0.7 + eruptFlash + this.burstEnergy * 1.8;
      }
      return;
    }

    if (this.preset === 'energyPillar') {
      if (config.burstInterval > 0.2) {
        this.cycleTimer += dt;
        if (this.cycleTimer >= config.burstInterval) {
          this.cycleTimer = 0;
          this.burstEnergy = 0.9;
        }
      }
      const pulseScale = 1 + Math.sin(this.elapsed * 7.5 * spd) * 0.04 + this.burstEnergy * 0.22;
      if (this.helixA) {
        this.helixA.rotation.y = this.elapsed * 2.8 * spd;
        this.helixA.scale.set(pulseScale, 1, pulseScale);
      }
      if (this.helixB) {
        this.helixB.rotation.y = -this.elapsed * 2.1 * spd;
        this.helixB.scale.set(pulseScale, 1, pulseScale);
      }
      if (this.curtainMesh) {
        this.curtainMesh.scale.set(pulseScale, 1, pulseScale);
      }
      if (this.shardMesh) {
        for (let i = 0; i < this.shards.length; i++) {
          const s = this.shards[i];
          const yNorm = (s.height / h + this.elapsed * 0.42 * spd * (0.6 + (i % 3) * 0.2)) % 1.0;
          const a = s.angle + this.elapsed * s.speed * spd;
          const rad = s.radius * (0.72 + 0.35 * Math.sin(yNorm * Math.PI));
          _dummy.position.set(Math.cos(a) * rad, yNorm * h, Math.sin(a) * rad);
          _euler.set(this.elapsed * 3.0, a, s.tiltZ);
          _dummy.quaternion.setFromEuler(_euler);
          _dummy.scale.setScalar(Math.max(0.001, Math.sin(yNorm * Math.PI) * s.scale));
          _dummy.updateMatrix();
          this.shardMesh.setMatrixAt(i, _dummy.matrix);
        }
        this.shardMesh.instanceMatrix.needsUpdate = true;
      }
      if (this.pointLight) {
        this.pointLight.intensity = 2.0 + em * 0.95 + Math.sin(this.elapsed * 9.0) * 0.35 + this.burstEnergy * 2.8;
      }
      return;
    }

    if (this.preset === 'voidVortex') {
      this.uProgress.value = 0.0; // keep Fresnel corona permanently visible
      if (this.vortexCorona) {
        const s = 1 + Math.sin(this.elapsed * 3.8 * spd) * 0.06 + this.burstEnergy * 0.22;
        this.vortexCorona.scale.setScalar(s);
      }
      if (this.vortexHalo) {
        this.vortexHalo.rotation.z = this.elapsed * 1.15 * spd;
        this.vortexHalo.rotation.x = 0.68 + Math.sin(this.elapsed * 0.9) * 0.14;
      }
      if (this.shardMesh) {
        for (let i = 0; i < this.shards.length; i++) {
          const s = this.shards[i];
          // Spiral inward toward singularity, accelerate near center, then respawn on rim
          s.radius -= dt * 0.24 * spd * (0.6 + (1.2 - s.radius) * 1.1);
          if (s.radius < 0.24) {
            s.radius = 1.12 + (i % 4) * 0.06;
          }
          const angVel = s.speed * spd * (0.9 + (1.2 - s.radius) * 2.4);
          s.angle += dt * angVel;
          const worldRad = s.radius * r;
          const funnelY = -Math.exp(-s.radius * s.radius * 3.2) * r * 0.32 + s.height * s.radius;
          _dummy.position.set(Math.cos(s.angle) * worldRad, funnelY, Math.sin(s.angle) * worldRad);
          _euler.set(this.elapsed * 2.6 + s.tiltX, s.angle, this.elapsed * 1.8 + s.tiltZ);
          _dummy.quaternion.setFromEuler(_euler);
          const sc = s.scale * Math.min(1, (s.radius - 0.22) * 3.5);
          _dummy.scale.setScalar(Math.max(0.001, sc));
          _dummy.updateMatrix();
          this.shardMesh.setMatrixAt(i, _dummy.matrix);
        }
        this.shardMesh.instanceMatrix.needsUpdate = true;
      }
      if (this.pointLight) {
        this.pointLight.intensity = 1.8 + em * 0.8 + Math.sin(this.elapsed * 5.0) * 0.4 + this.burstEnergy * 2.6;
      }
      return;
    }

    if (this.preset === 'meteorStrike') {
      const cycleLen = config.burstInterval > 0.8 ? config.burstInterval : 3.8;
      const prevPhase = this.meteorCyclePhase;
      this.meteorCyclePhase = (this.meteorCyclePhase + (dt * spd) / cycleLen) % 1.0;

      // Impact occurs at phase = 0.42
      const impactPhase = 0.42;
      if (prevPhase < impactPhase && this.meteorCyclePhase >= impactPhase) {
        this.meteorImpactAge = 0;
        this.burstEnergy = 1.0;
      }
      this.meteorImpactAge += dt * spd;

      if (this.meteorGroup) {
        if (this.meteorCyclePhase < impactPhase) {
          this.meteorGroup.visible = true;
          const t = this.meteorCyclePhase / impactPhase; // 0 -> 1 descent
          const easeT = t * t; // accelerating fall
          const dropY = (1 - easeT) * h + 0.15;
          const offsetX = (1 - easeT) * h * 0.36;
          this.meteorGroup.position.set(offsetX, dropY, 0);
          // Spin rock core child
          if (this.meteorGroup.children[0]) {
            this.meteorGroup.children[0].rotation.x += dt * 6;
            this.meteorGroup.children[0].rotation.y += dt * 4.5;
          }
        } else {
          this.meteorGroup.visible = false;
        }
      }

      const blastDur = 1.35;
      const blastNorm = THREE.MathUtils.clamp(this.meteorImpactAge / blastDur, 0, 1);
      this.uProgress.value = blastNorm;

      if (this.meteorDome) {
        if (this.meteorImpactAge < blastDur) {
          this.meteorDome.visible = true;
          const easeOut = 1 - Math.pow(1 - blastNorm, 3);
          this.meteorDome.scale.setScalar(0.15 + easeOut * 1.15);
        } else {
          this.meteorDome.visible = false;
        }
      }

      if (this.meteorShockRing) {
        if (this.meteorImpactAge < blastDur * 0.85) {
          this.meteorShockRing.visible = true;
          const rNorm = THREE.MathUtils.clamp(this.meteorImpactAge / (blastDur * 0.85), 0, 1);
          const easeOut = 1 - Math.pow(1 - rNorm, 2.5);
          this.meteorShockRing.scale.setScalar(0.2 + easeOut * r * 1.45);
          (this.meteorShockRing.material as THREE.MeshBasicMaterial).opacity = (1 - rNorm) * 0.9;
        } else {
          this.meteorShockRing.visible = false;
        }
      }

      if (this.meteorDebrisMesh) {
        const active = this.meteorImpactAge < 1.6;
        for (let i = 0; i < this.meteorDebris.length; i++) {
          const d = this.meteorDebris[i];
          if (!active) {
            _dummy.scale.setScalar(0.0001);
            _dummy.position.set(0, -50, 0);
          } else {
            const t = this.meteorImpactAge;
            const y = Math.max(0.06, d.vy * t - 4.9 * t * t);
            const fade = Math.max(0.001, (1 - t / 1.6) * d.scale);
            _dummy.position.set(d.vx * t, y, d.vz * t);
            _euler.set(d.rotSpeedX * t, d.rotSpeedY * t, 0);
            _dummy.quaternion.setFromEuler(_euler);
            _dummy.scale.setScalar(fade);
          }
          _dummy.updateMatrix();
          this.meteorDebrisMesh.setMatrixAt(i, _dummy.matrix);
        }
        this.meteorDebrisMesh.instanceMatrix.needsUpdate = true;
      }

      if (this.pointLight) {
        const blastGlow = this.meteorImpactAge < blastDur ? (1 - blastNorm) * 5.2 : 0;
        this.pointLight.intensity = 1.0 + em * 0.4 + blastGlow;
      }
    }
  }

  public dispose(): void {
    this.root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
        else mesh.material.dispose();
      }
    });
    this.root.clear();
    this.shards = [];
    this.crystalSpecs = [];
    this.meteorDebris = [];
    this.pointLight = null;
    this.ringOuter = null;
    this.ringInner = null;
    this.runeRingMesh = null;
    this.shardMesh = null;
    this.sigilInnerMesh = null;
    this.curtainMesh = null;
    this.helixA = null;
    this.helixB = null;
    this.crystalMesh = null;
    this.vortexCore = null;
    this.vortexCorona = null;
    this.vortexHalo = null;
    this.meteorGroup = null;
    this.meteorDome = null;
    this.meteorShockRing = null;
    this.meteorDebrisMesh = null;
  }
}
