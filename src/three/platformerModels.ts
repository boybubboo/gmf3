import * as THREE from 'three';
import type { LevelEntity, PlatformerAddonConfig } from '../types/maker';

function stdMat(
  color: string,
  roughness = 0.65,
  metalness = 0.08,
  opts?: {
    emissive?: string;
    emissiveIntensity?: number;
    transparent?: boolean;
    opacity?: number;
    side?: THREE.Side;
  }
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    ...(opts?.emissive ? { emissive: opts.emissive, emissiveIntensity: opts.emissiveIntensity ?? 0.5 } : {}),
    ...(opts?.transparent ? { transparent: true, opacity: opts.opacity ?? 0.7 } : {}),
    ...(opts?.side !== undefined ? { side: opts.side } : {}),
  });
}

function addBox(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  mat: THREE.Material,
  shadow = true
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = shadow;
  parent.add(m);
  return m;
}

export function buildPlatformerAddonMesh(entity: LevelEntity): THREE.Group {
  const cfg = entity.platformerAddon as PlatformerAddonConfig;
  const group = new THREE.Group();
  group.userData.entityId = entity.id;
  group.userData.platformerModuleId = cfg.moduleId;

  const tint = cfg.colorTag || entity.styleTint || '#20B46A';
  const w = Math.max(0.8, cfg.width ?? 3.6);
  const h = Math.max(0.24, cfg.height ?? 0.55);
  const d = Math.max(0.8, cfg.depth ?? 3.2);

  switch (cfg.moduleId) {
    case 'shuttlePlatform':
    case 'elevatorPlatform':
    case 'orbitPlatform':
    case 'splinePlatform': {
      const deckMat = stdMat(tint, 0.58, 0.22);
      const trimMat = stdMat('#1E293B', 0.42, 0.65);
      const glowMat = stdMat('#38BDF8', 0.3, 0.2, { emissive: tint, emissiveIntensity: 0.65 });
      addBox(group, w, h, d, 0, 0, 0, deckMat);
      addBox(group, w + 0.16, h * 0.35, d + 0.16, 0, -h * 0.28, 0, trimMat);
      for (const sx of [-w * 0.38, w * 0.38]) {
        const thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 0.24, 10), glowMat);
        thruster.position.set(sx, -h * 0.52, 0);
        group.add(thruster);
      }
      const railBeacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), glowMat);
      railBeacon.position.set(0, h * 0.5 + 0.18, -d * 0.42);
      group.add(railBeacon);
      break;
    }

    case 'crumblingPlatform': {
      const rockMat = stdMat('#9A6B4C', 0.88, 0.04);
      const crackMat = stdMat('#292524', 0.92, 0.05);
      const slab = addBox(group, w, h, d, 0, 0, 0, rockMat);
      group.userData.crumbleBody = slab;
      for (let i = -1; i <= 1; i++) {
        addBox(group, 0.12, h + 0.04, d * 0.88, i * (w * 0.26), 0.01, 0, crackMat, false);
      }
      addBox(group, w * 0.86, 0.1, 0.12, 0, h * 0.48, 0, crackMat, false);
      break;
    }

    case 'oneWayPlatform': {
      const plankMat = stdMat('#E0F2FE', 0.65, 0.05);
      const rimMat = stdMat(tint, 0.45, 0.2, { emissive: tint, emissiveIntensity: 0.3 });
      addBox(group, w, h, d, 0, 0, 0, plankMat);
      addBox(group, w + 0.12, h * 0.45, 0.16, 0, 0.05, d * 0.46, rimMat, false);
      addBox(group, w + 0.12, h * 0.45, 0.16, 0, 0.05, -d * 0.46, rimMat, false);
      // Upward chevron indicator
      const chev = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.32, 4), rimMat);
      chev.rotation.y = Math.PI / 4;
      chev.position.set(0, h * 0.62, d * 0.35);
      group.add(chev);
      break;
    }

    case 'seesawPlatform': {
      const plankMat = stdMat(tint, 0.68, 0.12);
      const pivotMat = stdMat('#334155', 0.4, 0.7);
      const plankGroup = new THREE.Group();
      addBox(plankGroup, w, h, d, 0, 0, 0, plankMat);
      addBox(plankGroup, 0.25, h + 0.12, d + 0.1, -w * 0.48, 0.06, 0, pivotMat);
      addBox(plankGroup, 0.25, h + 0.12, d + 0.1, w * 0.48, 0.06, 0, pivotMat);
      group.add(plankGroup);
      group.userData.seesawDeck = plankGroup;
      const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, d + 0.4, 14), pivotMat);
      axle.rotation.x = Math.PI / 2;
      axle.position.y = -0.32;
      group.add(axle);
      const stand = new THREE.Mesh(new THREE.ConeGeometry(0.65, 1.1, 4), pivotMat);
      stand.rotation.y = Math.PI / 4;
      stand.position.y = -0.82;
      group.add(stand);
      break;
    }

    case 'rhythmPlatform': {
      const mat = stdMat(tint, 0.35, 0.18, {
        emissive: tint,
        emissiveIntensity: 0.45,
        transparent: true,
        opacity: 0.92,
      });
      const frameMat = stdMat('#F8FAFC', 0.4, 0.5);
      const block = addBox(group, w, h, d, 0, 0, 0, mat);
      group.userData.rhythmMesh = block;
      group.userData.rhythmMat = mat;
      addBox(group, w + 0.12, 0.1, d + 0.12, 0, h * 0.46, 0, frameMat, false);
      addBox(group, w + 0.12, 0.1, d + 0.12, 0, -h * 0.46, 0, frameMat, false);
      break;
    }

    case 'iceSurface': {
      const iceMat = stdMat('#BAE6FD', 0.12, 0.15, {
        emissive: '#38BDF8',
        emissiveIntensity: 0.25,
        transparent: true,
        opacity: 0.88,
      });
      const snowMat = stdMat('#F8FAFC', 0.55, 0.05);
      addBox(group, w, h, d, 0, 0, 0, iceMat);
      addBox(group, w * 0.94, 0.14, d * 0.94, 0, -h * 0.4, 0, snowMat);
      break;
    }

    case 'stickySurface': {
      const tarMat = stdMat('#292524', 0.22, 0.08, { emissive: '#57534E', emissiveIntensity: 0.12 });
      const bubbleMat = stdMat('#78350F', 0.2, 0.05);
      addBox(group, w, h, d, 0, 0, 0, tarMat);
      for (let i = -2; i <= 2; i++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.18 + ((i + 2) % 2) * 0.08, 10, 8), bubbleMat);
        b.scale.y = 0.45;
        b.position.set(i * (w * 0.18), h * 0.5, (i % 2) * 0.5);
        group.add(b);
      }
      break;
    }

    case 'conveyorBelt':
    case 'speedBoostPad': {
      const isBoost = cfg.moduleId === 'speedBoostPad';
      const baseMat = stdMat('#334155', 0.5, 0.6);
      const beltMat = stdMat(isBoost ? '#0E7490' : '#1E293B', 0.45, 0.3);
      const chevMat = stdMat(isBoost ? '#22D3EE' : tint, 0.3, 0.2, {
        emissive: isBoost ? '#22D3EE' : tint,
        emissiveIntensity: 0.7,
      });
      addBox(group, w, h, d, 0, 0, 0, baseMat);
      addBox(group, w * 0.94, 0.12, d * 0.88, 0, h * 0.46, 0, beltMat);
      const count = Math.max(2, Math.floor(w / 1.3));
      const chevGroup = new THREE.Group();
      const dir = (cfg.conveyorSpeed ?? 4.5) >= 0 ? 1 : -1;
      for (let i = 0; i < count; i++) {
        const cx = -w * 0.38 + (i / Math.max(1, count - 1)) * (w * 0.76);
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.42, 4), chevMat);
        cone.rotation.z = -dir * (Math.PI / 2);
        cone.position.set(cx, h * 0.55, 0);
        chevGroup.add(cone);
      }
      group.add(chevGroup);
      group.userData.conveyorChevrons = chevGroup;
      break;
    }

    case 'breakableBlock': {
      const brickMat = stdMat(tint, 0.82, 0.05);
      const mortarMat = stdMat('#431407', 0.9, 0.05);
      const block = addBox(group, w, h, d, 0, h * 0.5, 0, brickMat);
      addBox(group, w + 0.04, 0.12, d + 0.04, 0, h * 0.5, 0, mortarMat, false);
      addBox(group, 0.12, h + 0.04, d + 0.04, 0, h * 0.5, 0, mortarMat, false);
      group.userData.breakableCube = block;
      break;
    }

    case 'barrelCannon': {
      const baseMat = stdMat('#57534E', 0.75, 0.2);
      const woodMat = stdMat(tint, 0.72, 0.08);
      const hoopMat = stdMat('#1E293B', 0.35, 0.85);
      const fuseMat = stdMat('#FBBF24', 0.25, 0.2, { emissive: '#F59E0B', emissiveIntensity: 0.9 });

      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.95, 0.75, 12), baseMat);
      stand.position.y = 0.38;
      group.add(stand);

      const pivot = new THREE.Group();
      pivot.position.y = 1.25;
      const aimRad = ((90 - (cfg.cannonAngleDeg ?? 45)) * Math.PI) / 180;
      pivot.rotation.z = -aimRad;

      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.72, 1.9, 14), woodMat);
      body.castShadow = true;
      pivot.add(body);
      for (const hy of [-0.62, 0.62]) {
        const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.08, 8, 18), hoopMat);
        hoop.rotation.x = Math.PI / 2;
        hoop.position.y = hy;
        pivot.add(hoop);
      }
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.15, 14), fuseMat);
      rim.position.y = 0.94;
      pivot.add(rim);

      group.add(pivot);
      group.userData.barrelPivot = pivot;
      break;
    }

    case 'swingVine': {
      const len = Math.max(2.5, cfg.ropeLength ?? 5.5);
      const anchorMat = stdMat('#78350F', 0.8, 0.1);
      const vineMat = stdMat(tint, 0.72, 0.05);
      const leafMat = stdMat('#4ADE80', 0.6, 0.05);
      const anchor = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), anchorMat);
      anchor.position.y = len;
      group.add(anchor);

      const pendulum = new THREE.Group();
      pendulum.position.y = len;
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, len, 10), vineMat);
      rope.position.y = -len * 0.5;
      pendulum.add(rope);
      const segs = Math.max(3, Math.floor(len / 1.2));
      for (let i = 0; i < segs; i++) {
        const leaf = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 0), leafMat);
        leaf.scale.set(1.3, 0.45, 0.7);
        leaf.position.set(i % 2 === 0 ? 0.25 : -0.25, -0.7 - i * (len / segs), 0);
        pendulum.add(leaf);
      }
      const grip = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), stdMat('#FBBF24', 0.4, 0.3));
      grip.position.y = -len;
      pendulum.add(grip);
      group.add(pendulum);
      group.userData.pendulumPivot = pendulum;
      break;
    }

    case 'grappleAnchor': {
      const goldMat = stdMat(tint, 0.28, 0.85, { emissive: tint, emissiveIntensity: 0.4 });
      const plateMat = stdMat('#334155', 0.45, 0.7);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.22, 12), plateMat);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.11, 10, 20), goldMat);
      ring.position.y = -0.35;
      const aura = new THREE.Mesh(
        new THREE.TorusGeometry(1.15, 0.04, 8, 28),
        stdMat('#FDE68A', 0.3, 0.2, { emissive: tint, emissiveIntensity: 0.7, transparent: true, opacity: 0.6 })
      );
      aura.rotation.x = Math.PI / 2;
      group.add(cap, ring, aura);
      group.userData.floatSpin = true;
      break;
    }

    case 'bounceSpring':
    case 'wallSpring': {
      const isWall = cfg.moduleId === 'wallSpring';
      const baseMat = stdMat('#334155', 0.45, 0.7);
      const coilMat = stdMat('#CBD5E1', 0.3, 0.85);
      const padMat = stdMat(tint, 0.4, 0.15, { emissive: tint, emissiveIntensity: 0.28 });
      const root = new THREE.Group();
      if (isWall) root.rotation.z = -Math.PI * 0.5;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 0.24, 16), baseMat);
      base.position.y = 0.12;
      const coil = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.45, 12), coilMat);
      coil.position.y = 0.45;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.92, 0.28, 18), padMat);
      cap.position.y = 0.78;
      root.add(base, coil, cap);
      group.add(root);
      group.userData.springCap = cap;
      break;
    }

    case 'grindRail': {
      const railMat = stdMat(tint, 0.22, 0.85, { emissive: tint, emissiveIntensity: 0.3 });
      const postMat = stdMat('#334155', 0.55, 0.65);
      const len = Math.max(4, w);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, len, 10), railMat);
      bar.rotation.z = Math.PI / 2;
      bar.position.y = 1.2;
      group.add(bar);
      for (const px of [-len * 0.42, 0, len * 0.42]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 1.25, 8), postMat);
        post.position.set(px, 0.6, 0);
        group.add(post);
      }
      break;
    }

    case 'climbLadder': {
      const lh = Math.max(2.5, cfg.height ?? 6.5);
      const lw = Math.max(1.2, cfg.width ?? 1.8);
      const railMat = stdMat(tint, 0.65, 0.25);
      const rungMat = stdMat('#FBBF24', 0.5, 0.45);
      for (const sx of [-lw * 0.45, lw * 0.45]) {
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, lh, 8), railMat);
        rail.position.set(sx, lh * 0.5, 0);
        group.add(rail);
      }
      const rungs = Math.max(3, Math.floor(lh / 0.85));
      for (let i = 0; i <= rungs; i++) {
        const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, lw, 8), rungMat);
        rung.rotation.z = Math.PI / 2;
        rung.position.set(0, 0.4 + (i / rungs) * (lh - 0.8), 0);
        group.add(rung);
      }
      break;
    }

    case 'monkeyBars': {
      const span = Math.max(4, w);
      const barMat = stdMat('#475569', 0.4, 0.7);
      const rungMat = stdMat(tint, 0.45, 0.35);
      for (const sz of [-0.6, 0.6]) {
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, span, 8), barMat);
        rail.rotation.z = Math.PI / 2;
        rail.position.set(0, 3.2, sz);
        group.add(rail);
      }
      const rungs = Math.max(4, Math.floor(span / 1.1));
      for (let i = 0; i <= rungs; i++) {
        const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.3, 8), rungMat);
        rung.rotation.x = Math.PI / 2;
        rung.position.set(-span * 0.46 + (i / rungs) * span * 0.92, 3.2, 0);
        group.add(rung);
      }
      break;
    }

    case 'boostRing': {
      const ringMat = stdMat(tint, 0.25, 0.5, { emissive: tint, emissiveIntensity: 0.75 });
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.16, 12, 24), ringMat);
      hoop.position.y = 1.5;
      hoop.rotation.y = Math.PI / 2;
      const core = new THREE.Mesh(
        new THREE.ConeGeometry(0.36, 0.72, 6),
        stdMat('#FDE68A', 0.2, 0.2, { emissive: '#FBBF24', emissiveIntensity: 0.9 })
      );
      core.rotation.z = -Math.PI / 2;
      core.position.y = 1.5;
      group.add(hoop, core);
      group.userData.ringMesh = hoop;
      break;
    }

    case 'windTunnel': {
      const th = Math.max(3, cfg.height ?? 8.5);
      const airMat = stdMat(tint, 0.2, 0.05, {
        emissive: tint,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.32,
      });
      const fanMat = stdMat('#475569', 0.4, 0.75);
      const vent = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.48, w * 0.52, 0.42, 16), fanMat);
      vent.position.y = 0.21;
      const column = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.42, w * 0.45, th, 14), airMat);
      column.position.y = th * 0.5 + 0.3;
      group.add(vent, column);
      for (let i = 0; i < 3; i++) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(w * 0.38, 0.06, 6, 18),
          stdMat('#E0F2FE', 0.2, 0.1, { emissive: '#38BDF8', emissiveIntensity: 0.8 })
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 1.2 + i * (th * 0.28);
        ring.userData.windChevron = true;
        group.add(ring);
      }
      break;
    }

    case 'waterZone': {
      const wh = Math.max(2, cfg.height ?? 6);
      const waterMat = stdMat(tint, 0.15, 0.1, {
        emissive: '#0284C7',
        emissiveIntensity: 0.25,
        transparent: true,
        opacity: 0.44,
      });
      const vol = new THREE.Mesh(new THREE.BoxGeometry(w, wh, d), waterMat);
      vol.position.y = wh * 0.5;
      const topRim = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.1, 0.14, d + 0.1),
        stdMat('#BAE6FD', 0.2, 0.2, { emissive: '#38BDF8', emissiveIntensity: 0.45, transparent: true, opacity: 0.75 })
      );
      topRim.position.y = wh;
      group.add(vol, topRim);
      break;
    }

    case 'lowGravityZone': {
      const rad = Math.max(2.2, w * 0.5);
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(rad, 18, 14),
        stdMat(tint, 0.2, 0.1, { emissive: tint, emissiveIntensity: 0.35, transparent: true, opacity: 0.28 })
      );
      dome.position.y = rad * 0.85;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(rad * 0.96, 0.08, 8, 28),
        stdMat('#C4B5FD', 0.3, 0.3, { emissive: tint, emissiveIntensity: 0.75 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.2;
      group.add(dome, ring);
      break;
    }

    case 'gravityFlipPad': {
      const padMat = stdMat('#312E81', 0.35, 0.5);
      const glowMat = stdMat(tint, 0.25, 0.2, { emissive: tint, emissiveIntensity: 0.85 });
      addBox(group, w, 0.28, d, 0, 0.14, 0, padMat);
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.85, 4), glowMat);
      arrow.position.y = 0.85;
      arrow.userData.floatSpin = true;
      group.add(arrow);
      break;
    }

    case 'warpPortal': {
      const pipeMat = stdMat(tint, 0.35, 0.25, { emissive: tint, emissiveIntensity: 0.2 });
      const rimMat = stdMat(tint, 0.3, 0.3, { emissive: tint, emissiveIntensity: 0.45 });
      const coreMat = stdMat('#111827', 0.9, 0.1);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 1.5, 16), pipeMat);
      body.position.y = 0.75;
      const lip = new THREE.Mesh(new THREE.CylinderGeometry(1.16, 1.12, 0.42, 16), rimMat);
      lip.position.y = 1.55;
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.84, 0.06, 16), coreMat);
      hole.position.y = 1.75;
      group.add(body, lip, hole);
      break;
    }

    case 'shadowZone': {
      const mat = stdMat(tint, 0.45, 0.2, {
        emissive: '#312E81',
        emissiveIntensity: 0.45,
        transparent: true,
        opacity: 0.38,
      });
      const deck = addBox(group, w, h, d, 0, 0, 0, mat, false);
      group.userData.shadowDeck = deck;
      group.userData.shadowMat = mat;
      break;
    }

    case 'lanternPickup': {
      const brass = stdMat('#D97706', 0.3, 0.85);
      const flame = stdMat(tint, 0.2, 0.1, { emissive: tint, emissiveIntensity: 1.1 });
      const holder = new THREE.Group();
      holder.position.y = 1.05;
      holder.userData.floatSpin = true;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.28, 6), brass);
      cap.position.y = 0.34;
      const globe = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), flame);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.14, 6), brass);
      base.position.y = -0.3;
      holder.add(cap, globe, base);
      group.add(holder);
      break;
    }

    case 'triggerSwitch':
    case 'shootTarget': {
      const isTarget = cfg.moduleId === 'shootTarget';
      const baseMat = stdMat('#334155', 0.5, 0.65);
      const actMat = stdMat(tint, 0.35, 0.25, { emissive: tint, emissiveIntensity: 0.65 });
      if (isTarget) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.4, 8), baseMat);
        post.position.y = 0.7;
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.18, 16), actMat);
        disc.rotation.x = Math.PI / 2;
        disc.position.y = 1.5;
        const bull = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 14), stdMat('#FFFFFF', 0.4, 0.1));
        bull.rotation.x = Math.PI / 2;
        bull.position.y = 1.5;
        group.add(post, disc, bull);
        group.userData.switchPlate = disc;
      } else {
        addBox(group, 1.7, 0.18, 1.7, 0, 0.09, 0, baseMat);
        const plate = addBox(group, 1.25, 0.22, 1.25, 0, 0.24, 0, actMat);
        group.userData.switchPlate = plate;
      }
      break;
    }

    case 'lockedDoor':
    case 'starGateway': {
      const gh = Math.max(2.6, cfg.height ?? 4.2);
      const gw = Math.max(1.2, cfg.width ?? 1.6);
      const gd = Math.max(1.8, cfg.depth ?? 3.4);
      const frameMat = stdMat('#334155', 0.5, 0.65);
      const doorMat = stdMat(tint, 0.35, 0.45, { emissive: tint, emissiveIntensity: 0.35 });
      addBox(group, gw + 0.4, 0.45, gd + 0.4, 0, gh, 0, frameMat);
      const leaf = addBox(group, gw * 0.72, gh - 0.2, gd * 0.86, 0, gh * 0.5, 0, doorMat);
      const emblem = new THREE.Mesh(
        cfg.moduleId === 'starGateway' ? new THREE.OctahedronGeometry(0.45, 0) : new THREE.BoxGeometry(0.55, 0.55, 0.55),
        stdMat('#FEF08A', 0.25, 0.6, { emissive: '#FACC15', emissiveIntensity: 0.75 })
      );
      emblem.position.set(0, gh * 0.52, gd * 0.46);
      leaf.add(emblem);
      group.userData.gateDoor = leaf;
      break;
    }

    case 'followerKey': {
      const keyMat = stdMat(tint, 0.25, 0.85, { emissive: tint, emissiveIntensity: 0.45 });
      const holder = new THREE.Group();
      holder.position.y = 0.95;
      holder.userData.floatSpin = true;
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.07, 10, 18), keyMat);
      bow.position.y = 0.28;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.58, 8), keyMat);
      shaft.position.y = -0.15;
      const bit = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.09, 0.08), keyMat);
      bit.position.set(0.12, -0.34, 0);
      holder.add(bow, shaft, bit);
      group.add(holder);
      break;
    }

    case 'pushCrate': {
      const wood = stdMat(tint, 0.76, 0.08);
      const brace = stdMat('#451A03', 0.84, 0.12);
      const s = Math.max(0.9, cfg.width ?? 1.4);
      addBox(group, s, s, s, 0, s * 0.5, 0, wood);
      addBox(group, s + 0.06, s * 0.16, s + 0.06, 0, s * 0.5, 0, brace, false);
      break;
    }

    case 'retractSpikes': {
      const baseMat = stdMat('#334155', 0.5, 0.7);
      const spikeMat = stdMat(tint, 0.28, 0.75, { emissive: '#7F1D1D', emissiveIntensity: 0.35 });
      addBox(group, w, 0.22, 1.8, 0, 0.11, 0, baseMat);
      const spikesGroup = new THREE.Group();
      const count = Math.max(3, Math.floor(w / 0.65));
      for (let i = 0; i < count; i++) {
        const sx = -w * 0.38 + (i / Math.max(1, count - 1)) * (w * 0.76);
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.92, 6), spikeMat);
        cone.position.set(sx, 0.65, 0);
        spikesGroup.add(cone);
      }
      group.add(spikesGroup);
      group.userData.spikesGroup = spikesGroup;
      break;
    }

    case 'spikePendulum': {
      const len = Math.max(2.5, cfg.ropeLength ?? 4.6);
      const chainMat = stdMat('#475569', 0.4, 0.8);
      const maceMat = stdMat('#1E293B', 0.3, 0.85);
      const spikeMat = stdMat(tint, 0.3, 0.75);
      const pivot = new THREE.Group();
      pivot.position.y = len;
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, len, 8), chainMat);
      rod.position.y = -len * 0.5;
      const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.68, 1), maceMat);
      ball.position.y = -len;
      pivot.add(rod, ball);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const sp = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.48, 5), spikeMat);
        sp.position.set(Math.cos(a) * 0.72, -len + Math.sin(a) * 0.72, 0);
        sp.rotation.z = a - Math.PI / 2;
        pivot.add(sp);
      }
      group.add(pivot);
      group.userData.pendulumPivot = pivot;
      break;
    }

    case 'firebar': {
      const count = Math.max(3, Math.min(8, cfg.firebarCount ?? 5));
      const hubMat = stdMat('#475569', 0.4, 0.8);
      const orbMat = stdMat(tint, 0.2, 0.1, { emissive: '#EA580C', emissiveIntensity: 1.0 });
      const hub = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 0.95), hubMat);
      hub.position.y = 0.6;
      group.add(hub);
      const pivot = new THREE.Group();
      pivot.position.y = 0.6;
      for (let i = 1; i <= count; i++) {
        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), orbMat);
        orb.position.set(i * 0.82, 0, 0);
        pivot.add(orb);
      }
      group.add(pivot);
      group.userData.firebarPivot = pivot;
      break;
    }

    case 'thwompBlock': {
      const stone = stdMat(tint, 0.82, 0.15);
      const eye = stdMat('#EF4444', 0.25, 0.1, { emissive: '#EF4444', emissiveIntensity: 0.9 });
      const spike = stdMat('#CBD5E1', 0.3, 0.8);
      const elev = Math.max(2.5, cfg.distance ?? 5.5);
      const body = new THREE.Group();
      body.position.y = elev;
      addBox(body, 2.1, 2.3, 2.2, 0, 0, 0, stone);
      addBox(body, 0.45, 0.28, 0.12, -0.45, 0.25, 1.12, eye, false);
      addBox(body, 0.45, 0.28, 0.12, 0.45, 0.25, 1.12, eye, false);
      for (const sx of [-0.75, 0, 0.75]) {
        const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.45, 4), spike);
        tooth.rotation.x = Math.PI;
        tooth.position.set(sx, -1.32, 0);
        body.add(tooth);
      }
      group.add(body);
      group.userData.thwompBody = body;
      break;
    }

    case 'enemyPatroller':
    case 'enemyFlyer':
    case 'enemyCharger':
    case 'enemyTurret':
    case 'enemySpiked': {
      const bodyMat = stdMat(tint, 0.5, 0.2);
      const eyeMat = stdMat('#FFFFFF', 0.3, 0.1);
      const pupilMat = stdMat('#111827', 0.3, 0.1);
      if (cfg.moduleId === 'enemyTurret') {
        const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.72, 0.9, 10), stdMat('#334155', 0.6, 0.5));
        ped.position.y = 0.45;
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.58, 12, 10), bodyMat);
        head.position.y = 1.1;
        const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.7, 10), stdMat('#1E293B', 0.4, 0.7));
        snout.rotation.z = Math.PI / 2;
        snout.position.set(0.58, 1.1, 0);
        group.add(ped, head, snout);
        group.userData.turretHead = head;
      } else {
        const yOff = cfg.moduleId === 'enemyFlyer' ? 1.45 : 0.62;
        const shell = new THREE.Mesh(
          cfg.moduleId === 'enemyCharger'
            ? new THREE.BoxGeometry(1.35, 0.95, 1.05)
            : new THREE.SphereGeometry(0.62, 14, 12),
          bodyMat
        );
        shell.position.y = yOff;
        shell.castShadow = true;
        group.add(shell);
        for (const ez of [-0.22, 0.22]) {
          const ew = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), eyeMat);
          ew.position.set(0.48, yOff + 0.16, ez);
          const ep = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), pupilMat);
          ep.position.set(0.6, yOff + 0.16, ez);
          group.add(ew, ep);
        }
        if (cfg.moduleId === 'enemyFlyer') {
          const wingMat = stdMat('#FDE68A', 0.45, 0.1);
          for (const wz of [-0.62, 0.62]) {
            const wing = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.72), wingMat);
            wing.position.set(-0.08, yOff + 0.22, wz);
            group.add(wing);
          }
        }
        if (cfg.moduleId === 'enemyCharger') {
          const hornMat = stdMat('#F8FAFC', 0.35, 0.2);
          for (const hz of [-0.34, 0.34]) {
            const horn = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.56, 6), hornMat);
            horn.rotation.z = -Math.PI / 2;
            horn.position.set(0.84, yOff + 0.22, hz);
            group.add(horn);
          }
        }
        if (cfg.moduleId === 'enemySpiked') {
          const spMat = stdMat('#E2E8F0', 0.25, 0.85);
          for (let i = 0; i < 4; i++) {
            const sp = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.52, 5), spMat);
            sp.position.set((i - 1.5) * 0.24, yOff + 0.65, 0);
            group.add(sp);
          }
        }
      }
      break;
    }

    case 'dashCrystal': {
      const cMat = stdMat(tint, 0.15, 0.25, {
        emissive: tint,
        emissiveIntensity: 0.75,
        transparent: true,
        opacity: 0.92,
      });
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), cMat);
      gem.scale.set(0.75, 1.35, 0.75);
      gem.position.y = 1.15;
      gem.userData.floatSpin = true;
      group.add(gem);
      group.userData.crystalMesh = gem;
      break;
    }

    case 'bashLantern': {
      const orbMat = stdMat(tint, 0.2, 0.2, { emissive: tint, emissiveIntensity: 0.85 });
      const haloMat = stdMat('#FDE68A', 0.25, 0.2, { emissive: '#F472B6', emissiveIntensity: 0.7 });
      const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.48, 1), orbMat);
      orb.position.y = 1.25;
      orb.userData.floatSpin = true;
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.06, 8, 22), haloMat);
      halo.position.y = 1.25;
      group.add(orb, halo);
      break;
    }

    case 'ghostEchoPad': {
      const padMat = stdMat('#1E3A8A', 0.4, 0.5);
      const holoMat = stdMat(tint, 0.2, 0.1, {
        emissive: tint,
        emissiveIntensity: 0.75,
        transparent: true,
        opacity: 0.65,
      });
      addBox(group, 1.8, 0.24, 1.8, 0, 0.12, 0, padMat);
      const silhouette = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.7, 6, 12), holoMat);
      silhouette.position.y = 0.95;
      group.add(silhouette);
      break;
    }

    case 'slingshotWeb': {
      const postMat = stdMat('#475569', 0.45, 0.65);
      const cordMat = stdMat(tint, 0.3, 0.1, { emissive: tint, emissiveIntensity: 0.65 });
      const halfW = Math.max(1.5, w * 0.5);
      for (const sx of [-halfW, halfW]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.5, 10), postMat);
        post.position.set(sx, 0.75, 0);
        group.add(post);
      }
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, halfW * 2, 10), cordMat);
      cord.rotation.z = Math.PI / 2;
      cord.position.y = 1.2;
      group.add(cord);
      group.userData.slingshotCord = cord;
      break;
    }

    case 'sizeShiftGate': {
      const gh = Math.max(2.6, cfg.height ?? 4.0);
      const frameMat = stdMat('#334155', 0.45, 0.7);
      const beamColor = cfg.sizeMode === 'shrink' ? '#38BDF8' : cfg.sizeMode === 'grow' ? '#F59E0B' : tint;
      const beamMat = stdMat(beamColor, 0.2, 0.1, {
        emissive: beamColor,
        emissiveIntensity: 0.75,
        transparent: true,
        opacity: 0.5,
      });
      for (const sz of [-1.2, 1.2]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, gh, 8), frameMat);
        post.position.set(0, gh * 0.5, sz);
        group.add(post);
      }
      const header = addBox(group, 0.4, 0.32, 2.7, 0, gh, 0, frameMat);
      header.castShadow = true;
      const curtain = new THREE.Mesh(new THREE.BoxGeometry(0.14, gh - 0.3, 2.2), beamMat);
      curtain.position.y = gh * 0.5;
      group.add(curtain);
      break;
    }

    case 'checkpointFlag': {
      const poleMat = stdMat('#CBD5E1', 0.35, 0.75);
      const flagMat = stdMat(tint, 0.4, 0.15, { emissive: tint, emissiveIntensity: 0.3 });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.22, 12), poleMat);
      base.position.y = 0.11;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.2, 10), poleMat);
      pole.position.y = 1.6;
      const flag = addBox(group, 1.15, 0.68, 0.08, 0.6, 2.65, 0, flagMat);
      group.add(base, pole);
      group.userData.flagMesh = flag;
      break;
    }

    case 'coinTrail': {
      const coinMat = stdMat(tint, 0.22, 0.88, { emissive: '#F59E0B', emissiveIntensity: 0.4 });
      const span = Math.max(3, w);
      const arcH = Math.max(0.8, cfg.height ?? 2.2);
      const arcGroup = new THREE.Group();
      for (let i = 0; i < 5; i++) {
        const u = i / 4;
        const cx = (u - 0.5) * span;
        const cy = 0.8 + Math.sin(u * Math.PI) * arcH;
        const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.1, 14), coinMat);
        coin.rotation.x = Math.PI / 2;
        coin.position.set(cx, cy, 0);
        coin.userData.coinIndex = i;
        arcGroup.add(coin);
      }
      group.add(arcGroup);
      group.userData.coinTrailGroup = arcGroup;
      break;
    }

    case 'starCoin': {
      const starMat = stdMat(tint, 0.2, 0.85, { emissive: '#F59E0B', emissiveIntensity: 0.5 });
      const rimMat = stdMat('#FEF08A', 0.25, 0.9);
      const holder = new THREE.Group();
      holder.position.y = 1.25;
      holder.userData.floatSpin = true;
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.16, 18), starMat);
      disc.rotation.x = Math.PI / 2;
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), rimMat);
      star.scale.set(1, 1, 0.45);
      holder.add(disc, star);
      group.add(holder);
      group.userData.starMesh = holder;
      break;
    }

    case 'secretWall': {
      const wallMat = stdMat(tint, 0.78, 0.08, { transparent: true, opacity: 0.94 });
      const slab = addBox(group, w, cfg.height ?? 4.2, d, 0, (cfg.height ?? 4.2) * 0.5, 0, wallMat);
      group.userData.secretSlab = slab;
      group.userData.secretMat = wallMat;
      break;
    }

    case 'finishGoal': {
      const poleMat = stdMat('#F8FAFC', 0.3, 0.75);
      const topperMat = stdMat('#FACC15', 0.22, 0.9, { emissive: '#F59E0B', emissiveIntensity: 0.45 });
      const tapeMat = stdMat(tint, 0.35, 0.2, { emissive: tint, emissiveIntensity: 0.4 });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.9, 0.4, 14), stdMat('#334155', 0.6, 0.5));
      base.position.y = 0.2;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 6.2, 10), poleMat);
      pole.position.y = 3.1;
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), topperMat);
      orb.position.y = 6.3;
      const banner = addBox(group, 1.85, 0.92, 0.1, 0.98, 5.2, 0, tapeMat);
      group.add(base, pole, orb);
      group.userData.goalBanner = banner;
      break;
    }
  }

  group.rotation.y = (entity.rotation * Math.PI) / 180;
  group.scale.setScalar(entity.scale);
  return group;
}
