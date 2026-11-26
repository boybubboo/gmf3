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
