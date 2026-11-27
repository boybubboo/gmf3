import * as THREE from 'three';
import type { MonsterBlueprint } from '../../../types/maker';

export interface EnemyHealthBar {
  group: THREE.Group;
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D | null;
  tex: THREE.CanvasTexture;
  fillHex: string;
  borderHex: string;
  lastRenderedHp: number;
  lastFillKey: number;
  lastTrailKey: number;
  lastColorKey: string;
  maxHealth: number;
  displayTrail: number;
  opacity: number;
  heightOffset: number;
}

export function hexLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return 0.5;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function resolveBaddieHealthBarColors(
  bp: MonsterBlueprint | undefined,
  isBoss: boolean,
  styleTint?: string
): { fillHex: string; borderHex: string } {
  let fillCandidate = bp?.bodyColor || styleTint || (isBoss ? '#F59E0B' : '#F2545B');
  if (!/^#[0-9a-fA-F]{6}$/.test(fillCandidate) || hexLuminance(fillCandidate) < 0.09) {
    fillCandidate = isBoss ? '#EF4444' : '#F2545B';
  }
  const accentCandidates = [bp?.bellyColor, bp?.wingColor, bp?.accentColor, bp?.eyeColor].filter(
    (c): c is string => Boolean(c && /^#[0-9a-fA-F]{6}$/.test(c))
  );
  // Pick a key palette accent with strong visibility for the border + matching numeric HP text
  let borderHex = isBoss ? '#FBBF24' : '#FCA5A5';
  if (bp?.accentColor && /^#[0-9a-fA-F]{6}$/.test(bp.accentColor) && hexLuminance(bp.accentColor) > 0.22) {
    borderHex = bp.accentColor;
  } else {
    const brightMatch = accentCandidates.find((c) => hexLuminance(c) > 0.28);
    if (brightMatch) borderHex = brightMatch;
  }
  return { fillHex: fillCandidate, borderHex };
}

export function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export function redrawEnemyHealthBar(
  bar: EnemyHealthBar,
  curHp: number,
  maxHp: number,
  trailRatioOverride?: number
): void {
  const safeMax = Math.max(1, maxHp);
  const clampedCur = Math.max(0, Math.ceil(curHp));
  const hpRatio = THREE.MathUtils.clamp(curHp / safeMax, 0, 1);
  const trailRatio = THREE.MathUtils.clamp(
    trailRatioOverride ?? bar.displayTrail ?? hpRatio,
    hpRatio,
    1
  );
  const fillKey = Math.round(hpRatio * 400);
  const trailKey = Math.round(trailRatio * 400);
  const colorKey = `${bar.fillHex}|${bar.borderHex}`;

  if (
    bar.lastRenderedHp === clampedCur &&
    bar.maxHealth === safeMax &&
    bar.lastFillKey === fillKey &&
    bar.lastTrailKey === trailKey &&
    bar.lastColorKey === colorKey
  ) {
    return;
  }
  bar.lastRenderedHp = clampedCur;
  bar.maxHealth = safeMax;
  bar.lastFillKey = fillKey;
  bar.lastTrailKey = trailKey;
  bar.lastColorKey = colorKey;

  const ctx = bar.ctx;
  if (!ctx) return;
  const { width, height } = bar.canvas;
  ctx.clearRect(0, 0, width, height);

  // 1. Numeric HP readout above the bar matching the border color
  const label = `${clampedCur} / ${safeMax}`;
  ctx.font = '900 32px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(10, 12, 18, 0.96)';
  ctx.strokeText(label, width / 2, 24);
  ctx.fillStyle = bar.borderHex || '#FBBF24';
  ctx.fillText(label, width / 2, 24);

  // 2. Outer border frame matching baddie key accent color
  const outerX = 12;
  const outerY = 50;
  const outerW = width - 24;
  const outerH = 48;
  const pad = 6;
  drawRoundedRectPath(ctx, outerX, outerY, outerW, outerH, 12);
  ctx.fillStyle = bar.borderHex || '#FBBF24';
  ctx.fill();

  // 3. Dark empty background track
  const trackX = outerX + pad;
  const trackY = outerY + pad;
  const trackW = outerW - pad * 2;
  const trackH = outerH - pad * 2;
  drawRoundedRectPath(ctx, trackX, trackY, trackW, trackH, 7);
  ctx.fillStyle = '#131722';
  ctx.fill();

  // Clip inner track for trail + fill + gloss + segment ticks
  ctx.save();
  drawRoundedRectPath(ctx, trackX, trackY, trackW, trackH, 7);
  ctx.clip();

  // 4. Delayed damage-chunk trail bar
  const trailW = trackW * trailRatio;
  if (trailW > 1.5 && trailRatio > hpRatio + 0.002) {
    ctx.fillStyle = '#FEF08A';
    ctx.fillRect(trackX, trackY, trailW, trackH);
  }

  // 5. Primary solid colored HP fill (depletes left-to-right on attacks)
  const fillW = trackW * hpRatio;
  if (fillW > 1.5) {
    const safeFill =
      bar.fillHex && hexLuminance(bar.fillHex) >= 0.08 ? bar.fillHex : '#EF4444';
    ctx.fillStyle = safeFill;
    ctx.fillRect(trackX, trackY, fillW, trackH);

    // Subtle top specular highlight so the bar feels crisp and dimensional
    ctx.fillStyle = 'rgba(255, 255, 255, 0.26)';
    ctx.fillRect(trackX, trackY, fillW, Math.max(4, Math.round(trackH * 0.34)));

    // Subtle bottom shade
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.fillRect(trackX, trackY + Math.round(trackH * 0.72), fillW, Math.round(trackH * 0.28));
  }

  // 6. Segment divider ticks for readable HP chunks
  if (safeMax > 1 && safeMax <= 12) {
    ctx.fillStyle = 'rgba(13, 16, 26, 0.65)';
    for (let i = 1; i < safeMax; i++) {
      const tx = Math.round(trackX + (trackW * i) / safeMax);
      ctx.fillRect(tx - 1, trackY, 3, trackH);
    }
  }
  ctx.restore();

  bar.tex.needsUpdate = true;
}

export function createEnemyHealthBar(
  maxHealth: number,
  isBoss: boolean,
  heightOffset: number,
  fillHex = isBoss ? '#F59E0B' : '#F2545B',
  borderHex = isBoss ? '#FBBF24' : '#FCA5A5'
): EnemyHealthBar {
  const planeW = isBoss ? 1.92 : 1.32;
  const planeH = isBoss ? 0.56 : 0.39;

  const group = new THREE.Group();
  group.visible = false;
  group.renderOrder = 25;

  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 112;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;

  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(planeW, planeH), mat);
  mesh.renderOrder = 25;
  group.add(mesh);

  const bar: EnemyHealthBar = {
    group,
    mesh,
    mat,
    canvas,
    ctx,
    tex,
    fillHex,
    borderHex,
    lastRenderedHp: -1,
    lastFillKey: -1,
    lastTrailKey: -1,
    lastColorKey: '',
    maxHealth,
    displayTrail: 1,
    opacity: 0,
    heightOffset,
  };
  redrawEnemyHealthBar(bar, maxHealth, maxHealth, 1);
  return bar;
}

export interface EvaporatingDamageNumber {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  tex: THREE.CanvasTexture;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  baseScale: number;
}

export function spawnEvaporatingDamageNumber(
  scene: THREE.Scene,
  list: EvaporatingDamageNumber[],
  x: number,
  y: number,
  z: number,
  text: string,
  colorHex = '#FBBF24',
  subText?: string
): void {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 112;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';

    if (subText) {
      ctx.font = '900 22px system-ui, -apple-system, sans-serif';
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(8, 10, 18, 0.95)';
      ctx.strokeText(subText, 128, 24);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(subText, 128, 24);
    }

    ctx.font = '900 54px system-ui, -apple-system, sans-serif';
    ctx.lineWidth = 11;
    ctx.strokeStyle = 'rgba(8, 10, 18, 0.96)';
    ctx.strokeText(text, 128, subText ? 68 : 56);
    ctx.fillStyle = colorHex;
    ctx.fillText(text, 128, subText ? 68 : 56);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 0.68), mat);
  mesh.renderOrder = 32;
  mesh.position.set(
    x + (Math.random() - 0.5) * 0.45,
    y + 0.25,
    z + (Math.random() - 0.5) * 0.45
  );
  scene.add(mesh);

  list.push({
    mesh,
    mat,
    tex,
    vx: (Math.random() - 0.5) * 1.1,
    vy: 2.35 + Math.random() * 0.65,
    vz: (Math.random() - 0.5) * 1.1,
    life: 1.05,
    maxLife: 1.05,
    baseScale: subText ? 1.18 : 1.0,
  });
}

export function updateEvaporatingDamageNumbers(
  scene: THREE.Scene,
  list: EvaporatingDamageNumber[],
  camera: THREE.Camera,
  dt: number
): void {
  for (let i = list.length - 1; i >= 0; i--) {
    const item = list[i];
    item.life -= dt;
    if (item.life <= 0) {
      scene.remove(item.mesh);
      item.mesh.geometry.dispose();
      item.mat.dispose();
      item.tex.dispose();
      list.splice(i, 1);
      continue;
    }
    const progress = 1 - item.life / item.maxLife;
    item.mesh.position.x += item.vx * dt;
    item.mesh.position.y += item.vy * dt;
    item.mesh.position.z += item.vz * dt;
    item.vy = Math.max(0.8, item.vy - dt * 1.4);
    item.mesh.quaternion.copy(camera.quaternion);

    // Pop in during first 15%, then drift and evaporate upward
    const pop =
      progress < 0.16
        ? THREE.MathUtils.lerp(0.55, 1.25, progress / 0.16)
        : THREE.MathUtils.lerp(1.25, 0.78, (progress - 0.16) / 0.84);
    item.mesh.scale.setScalar(item.baseScale * pop);
    item.mat.opacity = progress < 0.45 ? 1 : Math.max(0, 1 - (progress - 0.45) / 0.55);
  }
}

export interface RpgVisualFxItem {
  group: THREE.Group;
  life: number;
  maxLife: number;
  expandSpeed: number;
  spinSpeed: number;
}

export function spawnRpgSwordSlashArc(
  scene: THREE.Scene,
  list: RpgVisualFxItem[],
  x: number,
  y: number,
  z: number,
  yaw: number,
  colorHex = '#F59E0B'
): void {
  const group = new THREE.Group();
  group.position.set(x + Math.sin(yaw) * 0.85, y + 0.95, z + Math.cos(yaw) * 0.85);
  group.rotation.y = yaw;

  const arcMat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const crescent = new THREE.Mesh(
    new THREE.RingGeometry(0.65, 1.38, 22, 1, -Math.PI * 0.45, Math.PI * 0.9),
    arcMat
  );
  crescent.rotation.x = Math.PI / 2;
  crescent.rotation.z = -Math.PI / 2;

  const coreMat = new THREE.MeshBasicMaterial({
    color: '#FEF08A',
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const innerArc = new THREE.Mesh(
    new THREE.RingGeometry(0.88, 1.16, 20, 1, -Math.PI * 0.4, Math.PI * 0.8),
    coreMat
  );
  innerArc.rotation.x = Math.PI / 2;
  innerArc.rotation.z = -Math.PI / 2;
  innerArc.position.y = 0.02;

  group.add(crescent, innerArc);
  scene.add(group);
  list.push({
    group,
    life: 0.26,
    maxLife: 0.26,
    expandSpeed: 2.8,
    spinSpeed: 4.5,
  });
}

export function spawnRpgMagicZapBeam(
  scene: THREE.Scene,
  list: RpgVisualFxItem[],
  fromX: number,
  fromY: number,
  fromZ: number,
  toX: number,
  toY: number,
  toZ: number,
  colorHex = '#A855F7'
): void {
  const group = new THREE.Group();
  const segments = 6;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    const jitter = i === 0 || i === segments ? 0 : 0.34;
    pts.push(
      new THREE.Vector3(
        THREE.MathUtils.lerp(fromX, toX, u) + (Math.random() - 0.5) * jitter,
        THREE.MathUtils.lerp(fromY, toY, u) + (Math.random() - 0.5) * jitter,
        THREE.MathUtils.lerp(fromZ, toZ, u) + (Math.random() - 0.5) * jitter
      )
    );
  }

  const boltMat = new THREE.MeshBasicMaterial({
    color: '#38BDF8',
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
  });
  const glowMat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  for (let i = 0; i < segments; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const dist = p0.distanceTo(p1);
    const segMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, dist, 6), boltMat);
    const mid = p0.clone().add(p1).multiplyScalar(0.5);
    segMesh.position.copy(mid);
    segMesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      p1.clone().sub(p0).normalize()
    );
    group.add(segMesh);
  }

  // Arcane impact ring at target
  const impactRing = new THREE.Mesh(new THREE.RingGeometry(0.45, 1.25, 24), glowMat);
  impactRing.rotation.x = -Math.PI / 2;
  impactRing.position.set(toX, toY - 0.7, toZ);
  group.add(impactRing);

  scene.add(group);
  list.push({
    group,
    life: 0.34,
    maxLife: 0.34,
    expandSpeed: 0.4,
    spinSpeed: 0,
  });
}

export function spawnRpgOgreThrowWave(
  scene: THREE.Scene,
  list: RpgVisualFxItem[],
  x: number,
  y: number,
  z: number
): void {
  const group = new THREE.Group();
  group.position.set(x, y + 0.15, z);
  const ringMat = new THREE.MeshBasicMaterial({
    color: '#EF4444',
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 1.65, 28), ringMat);
  ring.rotation.x = -Math.PI / 2;
  group.add(ring);
  scene.add(group);
  list.push({
    group,
    life: 0.42,
    maxLife: 0.42,
    expandSpeed: 4.6,
    spinSpeed: 2.2,
  });
}

export function buildRpgArrowProjectileMesh(yaw: number): THREE.Mesh {
  const mat = new THREE.MeshStandardMaterial({
    color: '#F59E0B',
    emissive: '#D97706',
    emissiveIntensity: 0.85,
    roughness: 0.3,
  });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.95, 6), mat);
  shaft.rotation.x = Math.PI / 2;

  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.085, 0.24, 6),
    new THREE.MeshStandardMaterial({ color: '#E2E8F0', metalness: 0.85, roughness: 0.2 })
  );
  tip.rotation.x = Math.PI / 2;
  tip.position.z = 0.52;
  shaft.add(tip);

  const fletch = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.04, 0.22),
    new THREE.MeshStandardMaterial({ color: '#10B981', emissive: '#059669', emissiveIntensity: 0.5 })
  );
  fletch.position.z = -0.38;
  shaft.add(fletch);

  shaft.rotation.set(0, yaw, 0);
  return shaft;
}

export function updateRpgVisualFx(
  scene: THREE.Scene,
  list: RpgVisualFxItem[],
  dt: number
): void {
  for (let i = list.length - 1; i >= 0; i--) {
    const fx = list[i];
    fx.life -= dt;
    if (fx.life <= 0) {
      scene.remove(fx.group);
      fx.group.traverse((c) => {
        if (c instanceof THREE.Mesh) {
          c.geometry.dispose();
          if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
          else c.material.dispose();
        }
      });
      list.splice(i, 1);
      continue;
    }
    const frac = fx.life / fx.maxLife;
    if (fx.expandSpeed > 0) {
      const s = 1 + (1 - frac) * fx.expandSpeed;
      fx.group.scale.setScalar(s);
    }
    if (fx.spinSpeed !== 0) {
      fx.group.rotation.y += fx.spinSpeed * dt;
    }
    fx.group.traverse((c) => {
      if (c instanceof THREE.Mesh && c.material instanceof THREE.MeshBasicMaterial) {
        c.material.opacity = frac * 0.92;
      }
    });
  }
}

