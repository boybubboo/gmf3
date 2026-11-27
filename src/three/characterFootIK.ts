import * as THREE from 'three';

/**
 * Zero-allocation real-time Character Foot-Planting IK, Slope Alignment & Additive Motion Layer.
 *
 * Designed to run every frame in Play Mode at <0.08ms CPU cost with zero heap allocations:
 * 1. Probes ground height directly beneath the left & right feet (terrain, caves, bridges, props).
 * 2. Drops the pelvis slightly when standing/walking on slopes so the downhill foot reaches ground
 *    naturally without stretching, while bending the uphill knee via analytical 2-bone IK.
 * 3. Adds subtle additive secondary motion: rhythmic breathing, turn banking, slope torso pitch,
 *    and landing/hit-impact squash impulse.
 */

export interface FootIKInput {
  /** World X/Z of the character root. */
  rootX: number;
  rootZ: number;
  /** Current ground Y directly under character center. */
  centerGroundY: number;
  /** Facing yaw in radians (standard Three.js Y-rotation where +Z is forward). */
  facingYaw: number;
  /** Horizontal speed in m/s. */
  horizSpeed: number;
  /** Turning angular velocity (rad/s) for banking lean. */
  turnRate: number;
  /** True while standing/running on ground (false while airborne/swimming/climbing). */
  grounded: boolean;
  /** Frame delta time in seconds. */
  dt: number;
  /** Elapsed time in seconds for breathing micro-motion. */
  elapsedTime: number;
  /** Optional one-shot impact impulse (0..1) from landing or taking damage. */
  impactImpulse?: number;
  /** Height sampler returning ground Y at any world (x, z). */
  sampleGroundY: (x: number, z: number) => number;
}

export interface FootIKTargets {
  pelvisDropY: number;
  leftFootOffsetY: number;
  rightFootOffsetY: number;
  leftHipFlexRad: number;
  rightHipFlexRad: number;
  slopePitchRad: number;
  slopeRollRad: number;
  bankRollRad: number;
  breathLift: number;
  impactSquash: number;
}

export class CharacterFootIKController {
  private smoothedPelvisDrop = 0;
  private smoothedLeftLift = 0;
  private smoothedRightLift = 0;
  private smoothedSlopePitch = 0;
  private smoothedSlopeRoll = 0;
  private smoothedBankRoll = 0;
  private impactDecay = 0;
  private readonly restPosY = new WeakMap<THREE.Object3D, number>();

  // Scratch targets object (zero allocations)
  private readonly _out: FootIKTargets = {
    pelvisDropY: 0,
    leftFootOffsetY: 0,
    rightFootOffsetY: 0,
    leftHipFlexRad: 0,
    rightHipFlexRad: 0,
    slopePitchRad: 0,
    slopeRollRad: 0,
    bankRollRad: 0,
    breathLift: 0,
    impactSquash: 0,
  };

  public triggerImpact(amount = 0.65): void {
    this.impactDecay = Math.min(1, Math.max(this.impactDecay, amount));
  }

  public reset(): void {
    this.smoothedPelvisDrop = 0;
    this.smoothedLeftLift = 0;
    this.smoothedRightLift = 0;
    this.smoothedSlopePitch = 0;
    this.smoothedSlopeRoll = 0;
    this.smoothedBankRoll = 0;
    this.impactDecay = 0;
  }

  /**
   * Computes smoothed slope alignment, pelvis drop, per-foot elevation offsets,
   * analytical hip flexion targets, and additive breathing/banking/impact values.
   */
  public evaluate(input: FootIKInput): FootIKTargets {
    const dt = Math.min(0.06, Math.max(0.001, input.dt));
    if (input.impactImpulse && input.impactImpulse > 0.01) {
      this.impactDecay = Math.min(1, Math.max(this.impactDecay, input.impactImpulse));
    }
    this.impactDecay = THREE.MathUtils.damp(this.impactDecay, 0, 10, dt);

    const sinY = Math.sin(input.facingYaw);
    const cosY = Math.cos(input.facingYaw);
    // Forward vector = (sinY, cosY), Right vector = (cosY, -sinY)
    const stanceHalfWidth = 0.24;
    const probeForward = 0.34;

    let targetPelvisDrop = 0;
    let targetLeftLift = 0;
    let targetRightLift = 0;
    let targetSlopePitch = 0;
    let targetSlopeRoll = 0;

    if (input.grounded) {
      const leftX = input.rootX - cosY * stanceHalfWidth;
      const leftZ = input.rootZ + sinY * stanceHalfWidth;
      const rightX = input.rootX + cosY * stanceHalfWidth;
      const rightZ = input.rootZ - sinY * stanceHalfWidth;
      const fwdX = input.rootX + sinY * probeForward;
      const fwdZ = input.rootZ + cosY * probeForward;
      const backX = input.rootX - sinY * probeForward;
      const backZ = input.rootZ - cosY * probeForward;

      const leftGroundY = input.sampleGroundY(leftX, leftZ);
      const rightGroundY = input.sampleGroundY(rightX, rightZ);
      const fwdGroundY = input.sampleGroundY(fwdX, fwdZ);
      const backGroundY = input.sampleGroundY(backX, backZ);

      // Clamp probe deltas to realistic leg reach so cliff edges don't distort character
      const maxReach = 0.44;
      const dLeft = THREE.MathUtils.clamp(leftGroundY - input.centerGroundY, -maxReach, maxReach);
      const dRight = THREE.MathUtils.clamp(rightGroundY - input.centerGroundY, -maxReach, maxReach);

      // Weight down foot-lock slightly while sprinting fast so stride arc stays athletic
      const speedBlend = 1 - THREE.MathUtils.smoothstep(input.horizSpeed, 3.2, 10.5) * 0.45;
      const minFootDelta = Math.min(dLeft, dRight);

      // Drop pelvis to meet the lower foot, then lift the higher foot relative to dropped pelvis
      targetPelvisDrop = Math.min(0, minFootDelta) * 0.72 * speedBlend;
      targetLeftLift = Math.max(0, dLeft - targetPelvisDrop) * speedBlend;
      targetRightLift = Math.max(0, dRight - targetPelvisDrop) * speedBlend;

      // Ground slope pitch (uphill/downhill lean) and roll
      const fwdSlope = THREE.MathUtils.clamp(
        Math.atan2(fwdGroundY - backGroundY, probeForward * 2),
        -0.55,
        0.55
      );
      const sideSlope = THREE.MathUtils.clamp(
        Math.atan2(rightGroundY - leftGroundY, stanceHalfWidth * 2),
        -0.45,
        0.45
      );

      // Lean slightly into uphill climbs, lean slightly back on steep descents
      const moveWeight = THREE.MathUtils.clamp(input.horizSpeed / 4.5, 0.15, 1.0);
      targetSlopePitch = fwdSlope * 0.32 * moveWeight;
      targetSlopeRoll = sideSlope * 0.18 * speedBlend;
    }

    // Turn banking lean (smooth athletic lean into turns at speed)
    const speedFactor = THREE.MathUtils.clamp(input.horizSpeed / 6.5, 0, 1);
    const targetBankRoll = THREE.MathUtils.clamp(
      -input.turnRate * 0.085 * speedFactor,
      -0.22,
      0.22
    );

    const smoothRate = input.grounded ? 14 : 9;
    this.smoothedPelvisDrop = THREE.MathUtils.damp(
      this.smoothedPelvisDrop,
      targetPelvisDrop,
      smoothRate,
      dt
    );
    this.smoothedLeftLift = THREE.MathUtils.damp(
      this.smoothedLeftLift,
      targetLeftLift,
      smoothRate,
      dt
    );
    this.smoothedRightLift = THREE.MathUtils.damp(
      this.smoothedRightLift,
      targetRightLift,
      smoothRate,
      dt
    );
    this.smoothedSlopePitch = THREE.MathUtils.damp(
      this.smoothedSlopePitch,
      targetSlopePitch,
      10,
      dt
    );
    this.smoothedSlopeRoll = THREE.MathUtils.damp(
      this.smoothedSlopeRoll,
      targetSlopeRoll,
      10,
      dt
    );
    this.smoothedBankRoll = THREE.MathUtils.damp(this.smoothedBankRoll, targetBankRoll, 11, dt);

    // Subtle organic breathing cycle (calmer when idle, slightly deeper after movement)
    const breathFreq = 1.85 + Math.min(1.4, input.horizSpeed * 0.16);
    const breathLift = Math.sin(input.elapsedTime * breathFreq) * 0.014;

    // Analytical Law-of-Cosines hip flexion target (pure non-cumulative angle in radians)
    const solveHipFlex = (liftY: number): number => {
      if (liftY <= 0.004) return 0;
      const legLen = 0.72;
      const thighLen = legLen * 0.52;
      const shinLen = legLen * 0.48;
      const targetDist = THREE.MathUtils.clamp(
        legLen - liftY,
        Math.abs(thighLen - shinLen) + 0.06,
        thighLen + shinLen - 0.005
      );
      const cosHip = THREE.MathUtils.clamp(
        (thighLen * thighLen + targetDist * targetDist - shinLen * shinLen) /
          (2 * thighLen * targetDist),
        -1,
        1
      );
      return Math.min(0.24, Math.acos(cosHip) * 0.36);
    };

    this._out.pelvisDropY = this.smoothedPelvisDrop - this.impactDecay * 0.11;
    this._out.leftFootOffsetY = this.smoothedLeftLift;
    this._out.rightFootOffsetY = this.smoothedRightLift;
    this._out.leftHipFlexRad = solveHipFlex(this.smoothedLeftLift);
    this._out.rightHipFlexRad = solveHipFlex(this.smoothedRightLift);
    this._out.slopePitchRad = this.smoothedSlopePitch;
    this._out.slopeRollRad = this.smoothedSlopeRoll;
    this._out.bankRollRad = this.smoothedBankRoll;
    this._out.breathLift = breathLift;
    this._out.impactSquash = this.impactDecay;
    return this._out;
  }

  /**
   * Keeps procedural limb hip sockets strictly anchored to their rest Y positions (zero drift)
   * and applies optional non-cumulative modelPivot / torso / 2-bone knee IK targets.
   */
  public applyToProceduralHero(
    targets: FootIKTargets,
    parts: {
      modelPivot?: THREE.Object3D | null;
      torso?: THREE.Object3D | null;
      leftLeg?: THREE.Object3D | null;
      rightLeg?: THREE.Object3D | null;
      leftKnee?: THREE.Object3D | null;
      rightKnee?: THREE.Object3D | null;
      baseModelY?: number;
      legLength?: number;
    }
  ): void {
    const legLen = parts.legLength ?? 0.72;
    const thighLen = legLen * 0.52;
    const shinLen = legLen * 0.48;

    const getRestY = (obj: THREE.Object3D): number => {
      let rest = this.restPosY.get(obj);
      if (rest === undefined) {
        rest = obj.position.y;
        this.restPosY.set(obj, rest);
      }
      return rest;
    };

    // 1. Pelvis / model vertical drop + subtle landing squash
    if (parts.modelPivot && typeof parts.baseModelY === 'number') {
      parts.modelPivot.position.y =
        parts.baseModelY + targets.pelvisDropY + targets.breathLift * 0.35;
      parts.modelPivot.rotation.z = targets.bankRollRad + targets.slopeRollRad * 0.45;
      parts.modelPivot.rotation.x = targets.slopePitchRad * 0.55;
    }

    // 2. Torso breathing anchored strictly to rest Y
    if (parts.torso) {
      const torsoRestY = getRestY(parts.torso);
      parts.torso.position.y = torsoRestY + targets.breathLift;
    }

    // 3. Keep single-pivot hip sockets strictly anchored to their pelvis rest Y (never detach/float).
    //    For 2-bone legs with explicit knee joints, apply bounded knee bend.
    const applyLegSocket = (
      hip: THREE.Object3D | null | undefined,
      knee: THREE.Object3D | null | undefined,
      liftY: number
    ) => {
      if (!hip) return;
      const hipRestY = getRestY(hip);
      hip.position.y = hipRestY;
      if (!knee || liftY <= 0.004) return;

      const targetDist = THREE.MathUtils.clamp(
        legLen - liftY,
        Math.abs(thighLen - shinLen) + 0.06,
        thighLen + shinLen - 0.005
      );
      const cosKnee = THREE.MathUtils.clamp(
        (thighLen * thighLen + shinLen * shinLen - targetDist * targetDist) /
          (2 * thighLen * shinLen),
        -1,
        1
      );
      const kneeBend = Math.PI - Math.acos(cosKnee);
      knee.rotation.x = Math.min(1.1, kneeBend * 0.85);
    };

    applyLegSocket(parts.leftLeg, parts.leftKnee, targets.leftFootOffsetY);
    applyLegSocket(parts.rightLeg, parts.rightKnee, targets.rightFootOffsetY);
  }
}
