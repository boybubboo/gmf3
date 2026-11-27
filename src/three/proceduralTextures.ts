import * as THREE from 'three';

export interface TerrainTextureAtlas {
  grass: THREE.CanvasTexture;
  sand: THREE.CanvasTexture;
  rock: THREE.CanvasTexture;
  snow: THREE.CanvasTexture;
  moss: THREE.CanvasTexture;
  cobble: THREE.CanvasTexture;
  dirt: THREE.CanvasTexture;
  leavesFloor: THREE.CanvasTexture;
  clumpyDirt: THREE.CanvasTexture;
  chamferedAshlarStone: THREE.CanvasTexture;
  oakBark: THREE.CanvasTexture;
  oakBarkBump: THREE.CanvasTexture;
  pineBark: THREE.CanvasTexture;
  pineBarkBump: THREE.CanvasTexture;
  birchBark: THREE.CanvasTexture;
  birchBarkBump: THREE.CanvasTexture;
  oakLeaves: THREE.CanvasTexture;
  oakLeavesBump: THREE.CanvasTexture;
  pineLeaves: THREE.CanvasTexture;
  pineLeavesBump: THREE.CanvasTexture;
  birchLeaves: THREE.CanvasTexture;
  birchLeavesBump: THREE.CanvasTexture;
  woodRings: THREE.CanvasTexture;
  dampStoneBrick: THREE.CanvasTexture;
  craggyCaveRock: THREE.CanvasTexture;
  dungeonFlagstone: THREE.CanvasTexture;
  castleFloor: THREE.CanvasTexture;
  castleWall: THREE.CanvasTexture;
  scifiDeck: THREE.CanvasTexture;
  waterNormal: THREE.CanvasTexture;
  toonGradient: THREE.DataTexture;
  glowSprite: THREE.CanvasTexture;
}

let cachedAtlas: TerrainTextureAtlas | null = null;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeTileCanvas(size = 256): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function finishColorTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function finishDataTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function createGrassTexture(): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeTileCanvas(size);
  const rand = mulberry32(101);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, size, size);

  // Clean broad painterly grass patches so biome tinting multiplies cleanly without noise
  for (let i = 0; i < 140; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 18 + rand() * 34;
    const v = Math.round(230 + rand() * 22);
    ctx.fillStyle = `rgba(${v}, ${Math.min(255, v + 5)}, ${v - 4}, 0.22)`;
    const minX = x - r;
    const maxX = x + r;
    const minY = y - r;
    const maxY = y + r;
    drawWrappedBounds(size, minX, maxX, minY, maxY, (ox, oy) => {
      ctx.beginPath();
      ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Stylized soft blade strokes
  for (let i = 0; i < 260; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const len = 8 + rand() * 10;
    const tilt = (rand() - 0.5) * 6;
    const bright = rand() > 0.45;
    ctx.strokeStyle = bright ? 'rgba(255,255,244,0.32)' : 'rgba(182,204,172,0.28)';
    ctx.lineWidth = 2.0 + rand() * 1.4;
    ctx.lineCap = 'round';
    const minX = Math.min(x, x + tilt) - 2;
    const maxX = Math.max(x, x + tilt) + 2;
    drawWrappedBounds(size, minX, maxX, y - len - 2, y + 2, (ox, oy) => {
      ctx.beginPath();
      ctx.moveTo(x + ox, y + oy);
      ctx.lineTo(x + ox + tilt, y + oy - len);
      ctx.stroke();
    });
  }

  return finishColorTexture(canvas);
}

function createMossTexture(): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeTileCanvas(size);
  const rand = mulberry32(202);

  // Soft shaded woodland moss base that blends gently into forest grass without harsh contrast
  ctx.fillStyle = '#6B9952';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 420; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 10 + rand() * 22;
    const shade = rand();
    ctx.fillStyle =
      shade > 0.62
        ? 'rgba(136, 184, 98, 0.28)'
        : shade > 0.28
        ? 'rgba(94, 146, 74, 0.30)'
        : 'rgba(72, 118, 60, 0.24)';
    drawWrappedBounds(size, x - r, x + r, y - r, y + r, (ox, oy) => {
      ctx.beginPath();
      ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Subtle soft clover & moss flecks
  for (let i = 0; i < 160; i++) {
    const x = rand() * size;
    const y = rand() * size;
    ctx.fillStyle = 'rgba(182, 218, 126, 0.28)';
    ctx.beginPath();
    ctx.arc(x, y, 1.8 + rand() * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  return finishColorTexture(canvas);
}

function createSandTexture(): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeTileCanvas(size);
  const rand = mulberry32(303);

  ctx.fillStyle = '#F1DFB2';
  ctx.fillRect(0, 0, size, size);

  // Wind-swept sand ripples
  for (let y = 0; y < size; y += 16) {
    ctx.strokeStyle = 'rgba(212, 178, 122, 0.42)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let x = 0; x <= size; x += 16) {
      const wy = y + Math.sin((x / size) * Math.PI * 4) * 3.5;
      if (x === 0) ctx.moveTo(x, wy);
      else ctx.lineTo(x, wy);
    }
    ctx.stroke();
  }

  for (let i = 0; i < 1100; i++) {
    const x = rand() * size;
    const y = rand() * size;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,250,234,0.45)' : 'rgba(184,148,96,0.35)';
    ctx.fillRect(x, y, 1.8, 1.8);
  }

  return finishColorTexture(canvas);
}

function createRockTexture(): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeTileCanvas(size);
  const rand = mulberry32(404);

  // Clean cool slate-blue stone base matching stylized faceted cliffs
  ctx.fillStyle = '#8992A6';
  ctx.fillRect(0, 0, size, size);

  // Large angular low-contrast stone planes (no harsh 1px grid lines)
  for (let i = 0; i < 65; i++) {
    const cx = rand() * size;
    const cy = rand() * size;
    const rx = 20 + rand() * 38;
    const ry = 14 + rand() * 28;
    const lum = Math.round(122 + rand() * 44);
    ctx.fillStyle = `rgba(${lum}, ${lum + 6}, ${Math.min(255, lum + 18)}, 0.45)`;
    drawWrappedBounds(size, cx - rx, cx + rx * 0.85, cy - ry, cy + ry * 0.85, (ox, oy) => {
      ctx.beginPath();
      ctx.moveTo(cx + ox - rx, cy + oy);
      ctx.lineTo(cx + ox - rx * 0.25, cy + oy - ry);
      ctx.lineTo(cx + ox + rx * 0.85, cy + oy - ry * 0.45);
      ctx.lineTo(cx + ox + rx * 0.6, cy + oy + ry * 0.85);
      ctx.closePath();
      ctx.fill();
    });
  }

  return finishColorTexture(canvas);
}

function createSnowTexture(): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeTileCanvas(size);
  const rand = mulberry32(505);

  ctx.fillStyle = '#F2F7FE';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 90; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const rx = 24 + rand() * 40;
    const ry = 10 + rand() * 16;
    ctx.fillStyle = rand() > 0.45 ? 'rgba(255,255,255,0.52)' : 'rgba(202,220,242,0.34)';
    const pad = Math.max(rx, ry);
    drawWrappedBounds(size, x - pad, x + pad, y - pad, y + pad, (ox, oy) => {
      ctx.beginPath();
      ctx.ellipse(x + ox, y + oy, rx, ry, 0.25, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  return finishColorTexture(canvas);
}

function createCobbleTexture(): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeTileCanvas(size);
  const rand = mulberry32(606);

  // Mossy mortar base
  ctx.fillStyle = '#4B564C';
  ctx.fillRect(0, 0, size, size);

  const cols = 6;
  const rows = 6;
  const cellW = size / cols;
  const cellH = size / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const stagger = (r % 2) * (cellW * 0.45);
      const cx = (c * cellW + stagger + (rand() - 0.5) * 4) % size;
      const cy = r * cellH + cellH * 0.5 + (rand() - 0.5) * 3;
      const rw = cellW * (0.37 + rand() * 0.06);
      const rh = cellH * (0.35 + rand() * 0.06);
      const tone = Math.round(135 + rand() * 48);
      const warm = Math.round((rand() - 0.5) * 14);

      const rotAngle = (rand() - 0.5) * 0.25;
      const pad = Math.max(rw, rh);
      drawWrappedBounds(size, cx - pad, cx + pad, cy - pad, cy + pad, (ox, oy) => {
        ctx.fillStyle = `rgb(${tone + warm}, ${tone + 2}, ${tone - warm + 6})`;
        ctx.beginPath();
        ctx.ellipse(cx + ox, cy + oy, rw, rh, rotAngle, 0, Math.PI * 2);
        ctx.fill();

        // Soft stone bevel highlight
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.ellipse(cx + ox - 2, cy + oy - 3, rw * 0.55, rh * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }

  return finishColorTexture(canvas);
}

function createWaterNormalTexture(): THREE.CanvasTexture {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * Math.PI * 2;
      const v = (y / size) * Math.PI * 2;
      const dx =
        Math.cos(u * 3 + v * 2) * 0.35 +
        Math.cos(u * 5 - v * 4) * 0.22 +
        Math.sin(u * 2 + v * 6) * 0.15;
      const dy =
        Math.sin(u * 2 + v * 4) * 0.35 +
        Math.cos(u * 4 + v * 3) * 0.22 -
        Math.cos(u * 6 - v * 2) * 0.15;
      const nx = Math.max(-1, Math.min(1, -dx * 0.7));
      const ny = Math.max(-1, Math.min(1, -dy * 0.7));
      const nz = Math.sqrt(Math.max(0.01, 1 - nx * nx - ny * ny));
      const idx = (y * size + x) * 4;
      data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  // Convert to CanvasTexture for universal browser compatibility
  const [canvas, ctx] = makeTileCanvas(size);
  const imgData = new ImageData(new Uint8ClampedArray(data.buffer), size, size);
  ctx.putImageData(imgData, 0, 0);
  tex.dispose();
  const cTex = new THREE.CanvasTexture(canvas);
  cTex.wrapS = THREE.RepeatWrapping;
  cTex.wrapT = THREE.RepeatWrapping;
  cTex.needsUpdate = true;
  return cTex;
}

function createToonGradientTexture(): THREE.DataTexture {
  const colors = new Uint8Array([
    82, 82, 98, 255,
    148, 148, 162, 255,
    218, 218, 224, 255,
    255, 255, 255, 255,
  ]);
  const tex = new THREE.DataTexture(colors, 4, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

function createGlowSpriteTexture(): THREE.CanvasTexture {
  const size = 64;
  const [canvas, ctx] = makeTileCanvas(size);
  const grad = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,244,180,0.8)');
  grad.addColorStop(1, 'rgba(255,244,180,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createDampStoneBrickTexture(): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeTileCanvas(size);
  const rand = mulberry32(707);

  // Dark damp mortar
  ctx.fillStyle = '#20242A';
  ctx.fillRect(0, 0, size, size);

  const rows = 5;
  const cols = 4;
  const bh = size / rows;
  const bw = size / cols;

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (bw * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * bw + offset + 2;
      const y = r * bh + 2;
      const w = bw - 4;
      const h = bh - 4;
      const shade = Math.round(62 + rand() * 32);
      const blue = shade + 6;
      ctx.fillStyle = `rgb(${shade}, ${shade + 2}, ${blue})`;
      ctx.fillRect(x, y, w, h);

      // Top highlight & bottom shadow bevel
      ctx.fillStyle = 'rgba(185, 195, 210, 0.14)';
      ctx.fillRect(x, y, w, 4);
      ctx.fillStyle = 'rgba(10, 12, 16, 0.35)';
      ctx.fillRect(x, y + h - 4, w, 4);

      // Damp vertical water streak on occasional blocks
      if (rand() > 0.6) {
        const sx = x + 6 + rand() * (w - 14);
        ctx.fillStyle = 'rgba(20, 26, 30, 0.38)';
        ctx.fillRect(sx, y, 5 + rand() * 7, h);
      }

      // Mossy creep in mortar / corners
      if (rand() > 0.58) {
        ctx.fillStyle = 'rgba(54, 102, 58, 0.42)';
        ctx.beginPath();
        ctx.arc(x + rand() * w, y + h, 6 + rand() * 10, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Grit & pit speckles
  for (let i = 0; i < 650; i++) {
    const x = rand() * size;
    const y = rand() * size;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(15,17,22,0.34)' : 'rgba(160,170,185,0.16)';
    ctx.fillRect(x, y, 2, 2);
  }

  return finishColorTexture(canvas);
}

function createCraggyCaveRockTexture(): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeTileCanvas(size);
  const rand = mulberry32(808);

  ctx.fillStyle = '#363942';
  ctx.fillRect(0, 0, size, size);

  // Overlapping jagged strata facets
  for (let i = 0; i < 220; i++) {
    const cx = rand() * size;
    const cy = rand() * size;
    const rx = 14 + rand() * 28;
    const ry = 8 + rand() * 18;
    const lum = Math.round(42 + rand() * 44);
    ctx.fillStyle = `rgba(${lum}, ${lum + 3}, ${lum + 8}, 0.55)`;
    drawWrappedBounds(size, cx - rx, cx + rx, cy - ry, cy + ry, (ox, oy) => {
      ctx.beginPath();
      ctx.moveTo(cx + ox - rx, cy + oy);
      ctx.lineTo(cx + ox - rx * 0.3, cy + oy - ry);
      ctx.lineTo(cx + ox + rx * 0.7, cy + oy - ry * 0.6);
      ctx.lineTo(cx + ox + rx, cy + oy + ry * 0.4);
      ctx.lineTo(cx + ox, cy + oy + ry);
      ctx.closePath();
      ctx.fill();
    });
  }

  // Damp moss flecks inside cave crevices
  for (let i = 0; i < 90; i++) {
    const x = rand() * size;
    const y = rand() * size;
    ctx.fillStyle = 'rgba(56, 108, 62, 0.34)';
    ctx.beginPath();
    ctx.arc(x, y, 4 + rand() * 9, 0, Math.PI * 2);
    ctx.fill();
  }

  return finishColorTexture(canvas);
}

function createDungeonFlagstoneTexture(): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeTileCanvas(size);
  const rand = mulberry32(909);

  ctx.fillStyle = '#1E2229';
  ctx.fillRect(0, 0, size, size);

  const tiles = 4;
  const step = size / tiles;
  for (let r = 0; r < tiles; r++) {
    for (let c = 0; c < tiles; c++) {
      const ox = (r % 2) * (step * 0.45);
      const x = ((c * step + ox) % size) + 2;
      const y = r * step + 2;
      const w = step - 4;
      const h = step - 4;
      const tone = Math.round(64 + rand() * 24);
      for (const wrapX of [-size, 0, size]) {
        if (wrapX < 0 && x + w <= size) continue;
        if (wrapX > 0 && x >= 0) continue;
        ctx.fillStyle = `rgb(${tone}, ${tone + 3}, ${tone + 8})`;
        ctx.fillRect(x + wrapX, y, w, h);
        ctx.strokeStyle = 'rgba(130, 142, 160, 0.14)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + wrapX + 1, y + 1, w - 2, h - 2);
      }
      // Occasional crack
      if (rand() > 0.5) {
        ctx.strokeStyle = 'rgba(18, 20, 26, 0.55)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x + w * 0.2, y + h * 0.25);
        ctx.lineTo(x + w * 0.52, y + h * 0.55);
        ctx.lineTo(x + w * 0.78, y + h * 0.48);
        ctx.stroke();
      }
    }
  }

  // Mossy joints
  for (let i = 0; i < 65; i++) {
    const x = rand() * size;
    const y = rand() * size;
    ctx.fillStyle = 'rgba(58, 108, 60, 0.32)';
    ctx.beginPath();
    ctx.arc(x, y, 3 + rand() * 7, 0, Math.PI * 2);
    ctx.fill();
  }

  return finishColorTexture(canvas);
}

function createCastleFloorTexture(): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeTileCanvas(size);
  const rand = mulberry32(1010);

  ctx.fillStyle = '#756F65';
  ctx.fillRect(0, 0, size, size);

  const n = 4;
  const step = size / n;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const shade = Math.round(145 + rand() * 26);
      ctx.fillStyle = `rgb(${shade + 8}, ${shade + 4}, ${shade - 4})`;
      ctx.fillRect(c * step + 2, r * step + 2, step - 4, step - 4);
      ctx.strokeStyle = 'rgba(255, 250, 240, 0.22)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(c * step + 3, r * step + 3, step - 6, step - 6);
    }
  }
  return finishColorTexture(canvas);
}

function createCastleWallTexture(): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeTileCanvas(size);
  const rand = mulberry32(1111);

  ctx.fillStyle = '#625E5A';
  ctx.fillRect(0, 0, size, size);

  const rows = 6;
  const cols = 4;
  const bh = size / rows;
  const bw = size / cols;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * (bw * 0.5);
    for (let c = -1; c <= cols; c++) {
      const v = Math.round(130 + rand() * 28);
      ctx.fillStyle = `rgb(${v + 6}, ${v + 2}, ${v - 4})`;
      ctx.fillRect(c * bw + off + 2, r * bh + 2, bw - 4, bh - 4);
    }
  }
  return finishColorTexture(canvas);
}

function createScifiDeckTexture(): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeTileCanvas(size);

  ctx.fillStyle = '#1E2534';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = '#33415C';
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, size - 8, size - 8);
  ctx.strokeRect(size / 2 + 4, 4, size / 2 - 8, size / 2 - 8);
  ctx.strokeRect(4, size / 2 + 4, size / 2 - 8, size / 2 - 8);

  // Ribbed treads
  ctx.fillStyle = '#2A344B';
  for (let i = 20; i < 110; i += 14) {
    ctx.fillRect(20, i, 84, 5);
    ctx.fillRect(148, i + 128, 84, 5);
  }

  // Cyan micro conduit line
  ctx.fillStyle = 'rgba(56, 189, 248, 0.5)';
  ctx.fillRect(0, size / 2 - 2, size, 4);
  ctx.fillRect(size / 2 - 2, 0, 4, size);

  return finishColorTexture(canvas);
}

function createDirtTrailTexture(): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeTileCanvas(size);
  const rand = mulberry32(1212);

  // Clean sunlit warm earth trail color
  ctx.fillStyle = '#9C7E62';
  ctx.fillRect(0, 0, size, size);

  // Soft stylized broad loamy brushstrokes
  for (let i = 0; i < 110; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 16 + rand() * 28;
    const tone = rand();
    ctx.fillStyle =
      tone > 0.58
        ? 'rgba(176, 146, 114, 0.34)'
        : 'rgba(128, 100, 74, 0.30)';
    drawWrappedBounds(size, x - r, x + r, y - r, y + r, (ox, oy) => {
      ctx.beginPath();
      ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Smooth flat stylized stepping pebbles
  for (let i = 0; i < 75; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const rx = 2.5 + rand() * 4.5;
    const ry = 2.0 + rand() * 3.0;
    ctx.fillStyle = rand() > 0.45 ? 'rgba(196, 186, 174, 0.42)' : 'rgba(116, 94, 74, 0.36)';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  return finishColorTexture(canvas);
}

function createLeavesFloorTexture(): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeTileCanvas(size);
  const rand = mulberry32(1313);

  // Rich forest humus underlayment
  ctx.fillStyle = '#4B3624';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 85; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 14 + rand() * 24;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(84, 58, 34, 0.35)' : 'rgba(56, 40, 26, 0.35)';
    drawWrappedBounds(size, x - r, x + r, y - r, y + r, (ox, oy) => {
      ctx.beginPath();
      ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Scattered fallen autumn & woodland oak leaves
  const leafColors = ['#9A5B2C', '#B77234', '#7C4D2B', '#C98A3E', '#5D6E32', '#8B4527'];
  for (let i = 0; i < 360; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const rx = 3.2 + rand() * 5.2;
    const ry = 1.6 + rand() * 2.8;
    const ang = rand() * Math.PI * 2;
    const col = leafColors[Math.floor(rand() * leafColors.length)];
    const pad = Math.max(rx, ry) + 2;
    drawWrappedBounds(size, x - pad, x + pad, y - pad, y + pad, (ox, oy) => {
      ctx.save();
      ctx.translate(x + ox, y + oy);
      ctx.rotate(ang);
      ctx.fillStyle = 'rgba(24, 16, 10, 0.28)';
      ctx.beginPath();
      ctx.ellipse(1.2, 1.4, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  // Crisp small twigs
  for (let i = 0; i < 32; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const len = 8 + rand() * 14;
    const ang = rand() * Math.PI * 2;
    ctx.strokeStyle = 'rgba(64, 42, 24, 0.58)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
  }

  return finishColorTexture(canvas);
}

function createClumpyDirtTexture(): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeTileCanvas(size);
  const rand = mulberry32(1419);

  // Dark rich forest loam & muddy wheel-rut earth
  ctx.fillStyle = '#473323';
  ctx.fillRect(0, 0, size, size);

  // Dark clumpy earth mounds with crisp highlight/shadow rims
  for (let i = 0; i < 160; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const rx = 6 + rand() * 14;
    const ry = 4.5 + rand() * 10;
    const ang = rand() * Math.PI;
    const pad = Math.max(rx, ry) + 2;
    const lum = Math.round(52 + rand() * 34);
    drawWrappedBounds(size, x - pad, x + pad, y - pad, y + pad, (ox, oy) => {
      ctx.save();
      ctx.translate(x + ox, y + oy);
      ctx.rotate(ang);
      ctx.fillStyle = 'rgba(20, 13, 8, 0.45)';
      ctx.beginPath();
      ctx.ellipse(1.5, 2.0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgb(${lum + 14}, ${lum + 2}, ${Math.max(12, lum - 10)})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(138, 108, 78, 0.24)';
      ctx.beginPath();
      ctx.ellipse(-rx * 0.2, -ry * 0.25, rx * 0.55, ry * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  // Grit & dark pebbles
  for (let i = 0; i < 180; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 1.2 + rand() * 2.6;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(98, 86, 74, 0.55)' : 'rgba(26, 18, 12, 0.52)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  return finishColorTexture(canvas);
}

function createChamferedAshlarStoneTexture(): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeTileCanvas(size);
  const rand = mulberry32(1515);

  ctx.fillStyle = '#363A42';
  ctx.fillRect(0, 0, size, size);

  const rows = 5;
  const cols = 4;
  const bh = size / rows;
  const bw = size / cols;

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (bw * 0.48);
    for (let c = -1; c <= cols; c++) {
      const x = c * bw + offset + 2.5;
      const y = r * bh + 2.5;
      const w = bw - 5;
      const h = bh - 5;
      const shade = Math.round(108 + rand() * 34);
      ctx.fillStyle = `rgb(${shade + 4}, ${shade + 2}, ${shade - 4})`;
      ctx.fillRect(x, y, w, h);
      // Chamfer highlight & shadow edge
      ctx.strokeStyle = 'rgba(235, 240, 248, 0.28)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x + 1, y + h - 1);
      ctx.lineTo(x + 1, y + 1);
      ctx.lineTo(x + w - 1, y + 1);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(18, 22, 28, 0.42)';
      ctx.beginPath();
      ctx.moveTo(x + w - 1, y + 1);
      ctx.lineTo(x + w - 1, y + h - 1);
      ctx.lineTo(x + 1, y + h - 1);
      ctx.stroke();
    }
  }

  return finishColorTexture(canvas);
}

function drawWrappedBounds(
  size: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  drawFn: (ox: number, oy: number) => void
) {
  const crossLeft = minX < 0;
  const crossRight = maxX > size;
  const crossTop = minY < 0;
  const crossBottom = maxY > size;

  drawFn(0, 0);
  if (crossRight) drawFn(-size, 0);
  if (crossLeft) drawFn(size, 0);
  if (crossBottom) {
    drawFn(0, -size);
    if (crossRight) drawFn(-size, -size);
    if (crossLeft) drawFn(size, -size);
  }
  if (crossTop) {
    drawFn(0, size);
    if (crossRight) drawFn(-size, size);
    if (crossLeft) drawFn(size, size);
  }
}

function drawWrapped(
  size: number,
  drawFn: (ox: number, oy: number) => void,
  cx?: number,
  cy?: number,
  pad = 48
) {
  if (cx !== undefined && cy !== undefined) {
    drawWrappedBounds(size, cx - pad, cx + pad, cy - pad, cy + pad, drawFn);
    return;
  }
  drawWrappedBounds(size, -1, size + 1, -1, size + 1, drawFn);
}

function drawLeafBlade(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  len: number,
  wid: number,
  angle: number,
  fill: string,
  veinStroke?: string
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, -len * 0.5);
  ctx.quadraticCurveTo(wid * 0.85, -len * 0.1, 0, len * 0.5);
  ctx.quadraticCurveTo(-wid * 0.85, -len * 0.1, 0, -len * 0.5);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (veinStroke) {
    ctx.strokeStyle = veinStroke;
    ctx.lineWidth = Math.max(0.8, wid * 0.08);
    ctx.beginPath();
    ctx.moveTo(0, -len * 0.38);
    ctx.lineTo(0, len * 0.36);
    ctx.stroke();
  }
  ctx.restore();
}

function createOakBarkTextures(): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const size = 512;
  const [canvas, ctx] = makeTileCanvas(size);
  const [bCanvas, bCtx] = makeTileCanvas(size);
  const rand = mulberry32(1414);

  // Warm weathered oak bark base
  ctx.fillStyle = '#7C5336';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  // Broad vertical tonal variation bands
  for (let i = 0; i < 36; i++) {
    const bx = rand() * size;
    const bw = 12 + rand() * 28;
    const tone = rand();
    ctx.fillStyle =
      tone > 0.55
        ? 'rgba(148, 106, 72, 0.22)'
        : tone > 0.25
        ? 'rgba(84, 54, 34, 0.26)'
        : 'rgba(104, 72, 48, 0.22)';
    for (const ox of [-size, 0, size]) {
      if (ox < 0 && bx + bw <= size) continue;
      if (ox > 0 && bx >= 0) continue;
      ctx.fillRect(bx + ox, 0, bw, size);
    }
  }

  // Deep undulating vertical bark ridges & fissured furrows (seamlessly tiled in Y via 2*PI harmonics)
  const ridgeCount = 26;
  for (let r = 0; r < ridgeCount; r++) {
    const baseX = (r / ridgeCount) * size + (rand() - 0.5) * 10;
    const freq1 = 1 + Math.floor(rand() * 2);
    const freq2 = 2 + Math.floor(rand() * 3);
    const phase1 = rand() * Math.PI * 2;
    const phase2 = rand() * Math.PI * 2;
    const amp1 = 5 + rand() * 9;
    const amp2 = 2 + rand() * 4;
    const furrowW = 3.2 + rand() * 4.5;
    const ridgeW = 6.5 + rand() * 7.5;
    const maxOffset = amp1 + amp2 + furrowW + ridgeW;

    const tracePath = (c: CanvasRenderingContext2D, ox: number, shiftX: number) => {
      c.beginPath();
      const steps = 48;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const y = t * size;
        const wave =
          Math.sin(t * Math.PI * 2 * freq1 + phase1) * amp1 +
          Math.sin(t * Math.PI * 2 * freq2 + phase2) * amp2;
        const x = baseX + wave + shiftX + ox;
        if (s === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
    };

    for (const ox of [-size, 0, size]) {
      if (ox < 0 && baseX + maxOffset <= size) continue;
      if (ox > 0 && baseX - maxOffset >= 0) continue;
      // Sunlit raised bark ridge beside the furrow
      tracePath(ctx, ox, furrowW * 0.72);
      ctx.strokeStyle = rand() > 0.4 ? 'rgba(164, 120, 84, 0.52)' : 'rgba(144, 102, 68, 0.48)';
      ctx.lineWidth = ridgeW;
      ctx.lineCap = 'round';
      ctx.stroke();

      tracePath(bCtx, ox, furrowW * 0.72);
      bCtx.strokeStyle = 'rgba(228, 228, 228, 0.62)';
      bCtx.lineWidth = ridgeW;
      bCtx.lineCap = 'round';
      bCtx.stroke();

      // Deep dark fissure trough
      tracePath(ctx, ox, 0);
      ctx.strokeStyle = 'rgba(42, 24, 14, 0.74)';
      ctx.lineWidth = furrowW;
      ctx.stroke();

      tracePath(bCtx, ox, 0);
      bCtx.strokeStyle = 'rgba(24, 24, 24, 0.78)';
      bCtx.lineWidth = furrowW;
      bCtx.stroke();
    }
  }

  // Fine fibrous bark grain striations & short diagonal bark splits
  for (let i = 0; i < 420; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const len = 16 + rand() * 44;
    const dx = (rand() - 0.5) * 6;
    const bright = rand() > 0.52;
    ctx.strokeStyle = bright ? 'rgba(182, 140, 102, 0.34)' : 'rgba(46, 28, 16, 0.42)';
    ctx.lineWidth = 1.2 + rand() * 1.6;
    bCtx.strokeStyle = bright ? 'rgba(215, 215, 215, 0.38)' : 'rgba(35, 35, 35, 0.46)';
    bCtx.lineWidth = ctx.lineWidth;
    drawWrappedBounds(
      size,
      Math.min(x, x + dx) - 2,
      Math.max(x, x + dx) + 2,
      y - 2,
      y + len + 2,
      (ox, oy) => {
        ctx.beginPath();
        ctx.moveTo(x + ox, y + oy);
        ctx.lineTo(x + ox + dx, y + oy + len);
        ctx.stroke();
        bCtx.beginPath();
        bCtx.moveTo(x + ox, y + oy);
        bCtx.lineTo(x + ox + dx, y + oy + len);
        bCtx.stroke();
      }
    );
  }

  // Occasional gnarled bark knots & soft weathered lichen flecks
  for (let i = 0; i < 6; i++) {
    const kx = rand() * size;
    const ky = rand() * size;
    const rx = 7 + rand() * 7;
    const ry = 12 + rand() * 11;
    drawWrappedBounds(size, kx - rx - 4, kx + rx + 4, ky - ry - 4, ky + ry + 4, (ox, oy) => {
      ctx.fillStyle = 'rgba(54, 34, 20, 0.72)';
      ctx.beginPath();
      ctx.ellipse(kx + ox, ky + oy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(156, 114, 80, 0.65)';
      ctx.lineWidth = 3;
      ctx.stroke();

      bCtx.fillStyle = 'rgba(30, 30, 30, 0.78)';
      bCtx.beginPath();
      bCtx.ellipse(kx + ox, ky + oy, rx * 0.75, ry * 0.75, 0, 0, Math.PI * 2);
      bCtx.fill();
      bCtx.strokeStyle = 'rgba(235, 235, 235, 0.75)';
      bCtx.lineWidth = 4;
      bCtx.stroke();
    });
  }

  for (let i = 0; i < 28; i++) {
    const lx = rand() * size;
    const ly = rand() * size;
    const lr = 4 + rand() * 8;
    const lAngle = rand() * Math.PI;
    ctx.fillStyle = 'rgba(128, 146, 102, 0.22)';
    drawWrappedBounds(size, lx - lr * 1.3, lx + lr * 1.3, ly - lr * 1.3, ly + lr * 1.3, (ox, oy) => {
      ctx.beginPath();
      ctx.ellipse(lx + ox, ly + oy, lr * 0.75, lr * 1.25, lAngle, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  return { map: finishColorTexture(canvas), bump: finishDataTexture(bCanvas) };
}

function createPineBarkTextures(): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const size = 512;
  const [canvas, ctx] = makeTileCanvas(size);
  const [bCanvas, bCtx] = makeTileCanvas(size);
  const rand = mulberry32(1515);

  // Deep conifer bark crevice base
  ctx.fillStyle = '#3B2214';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#262626';
  bCtx.fillRect(0, 0, size, size);

  // Interlocking scaly vertical conifer bark plates
  const cols = 10;
  const rows = 8;
  const colW = size / cols;
  const rowH = size / rows;

  for (let c = 0; c < cols; c++) {
    const stagger = (c % 2) * (rowH * 0.5);
    for (let r = 0; r < rows; r++) {
      const cx = c * colW + colW * 0.5 + (rand() - 0.5) * 6;
      const cy = (r * rowH + stagger + (rand() - 0.5) * 8) % size;
      const pw = colW * (0.39 + rand() * 0.08);
      const ph = rowH * (0.42 + rand() * 0.09);
      const rTone = Math.round(112 + rand() * 38);
      const gTone = Math.round(68 + rand() * 24);
      const bTone = Math.round(42 + rand() * 18);
      const bumpVal = Math.round(158 + rand() * 68);

      const drawPlate = (target: CanvasRenderingContext2D, ox: number, oy: number, fill: string, stroke?: string) => {
        target.beginPath();
        target.moveTo(cx + ox - pw * 0.75, cy + oy - ph);
        target.lineTo(cx + ox + pw * 0.72, cy + oy - ph * 0.88);
        target.lineTo(cx + ox + pw, cy + oy + ph * 0.12);
        target.lineTo(cx + ox + pw * 0.62, cy + oy + ph);
        target.lineTo(cx + ox - pw * 0.82, cy + oy + ph * 0.86);
        target.lineTo(cx + ox - pw, cy + oy - ph * 0.15);
        target.closePath();
        target.fillStyle = fill;
        target.fill();
        if (stroke) {
          target.strokeStyle = stroke;
          target.lineWidth = 2.4;
          target.stroke();
        }
      };

      drawWrappedBounds(size, cx - pw - 2, cx + pw + 2, cy - ph - 2, cy + ph + 2, (ox, oy) => {
        drawPlate(ctx, ox, oy, `rgb(${rTone}, ${gTone}, ${bTone})`, 'rgba(42, 22, 12, 0.85)');
        // Warm cinnamon highlight on upper-left plate bevel
        ctx.fillStyle = 'rgba(188, 128, 86, 0.28)';
        ctx.fillRect(cx + ox - pw * 0.6, cy + oy - ph * 0.75, pw * 0.9, ph * 0.45);

        drawPlate(bCtx, ox, oy, `rgb(${bumpVal}, ${bumpVal}, ${bumpVal})`, 'rgba(20, 20, 20, 0.9)');
      });
    }
  }

  // Fine vertical pine bark grain & horizontal scale cracks
  for (let i = 0; i < 360; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const len = 14 + rand() * 30;
    const isDark = rand() > 0.45;
    const dx = (rand() - 0.5) * 3;
    ctx.strokeStyle = isDark ? 'rgba(44, 24, 14, 0.42)' : 'rgba(176, 122, 82, 0.28)';
    ctx.lineWidth = 1.2 + rand() * 1.4;
    bCtx.strokeStyle = isDark ? 'rgba(34, 34, 34, 0.42)' : 'rgba(225, 225, 225, 0.34)';
    bCtx.lineWidth = ctx.lineWidth;
    drawWrappedBounds(size, x - 3, x + 3, y - 2, y + len + 2, (ox, oy) => {
      ctx.beginPath();
      ctx.moveTo(x + ox, y + oy);
      ctx.lineTo(x + ox + dx, y + oy + len);
      ctx.stroke();
      bCtx.beginPath();
      bCtx.moveTo(x + ox, y + oy);
      bCtx.lineTo(x + ox + dx, y + oy + len);
      bCtx.stroke();
    });
  }

  return { map: finishColorTexture(canvas), bump: finishDataTexture(bCanvas) };
}

function createBirchBarkTextures(): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const size = 512;
  const [canvas, ctx] = makeTileCanvas(size);
  const [bCanvas, bCtx] = makeTileCanvas(size);
  const rand = mulberry32(1313);

  ctx.fillStyle = '#EFECE4';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#C8C8C8';
  bCtx.fillRect(0, 0, size, size);

  // Subtle horizontal papery birch grain bands & warm tan inner-bark peeks
  for (let i = 0; i < 95; i++) {
    const y = rand() * size;
    const h = 4 + rand() * 14;
    const warm = rand();
    ctx.fillStyle =
      warm > 0.72
        ? 'rgba(210, 186, 150, 0.32)'
        : warm > 0.35
        ? 'rgba(226, 222, 212, 0.45)'
        : 'rgba(182, 178, 168, 0.28)';
    ctx.fillRect(0, y, size, h);
    bCtx.fillStyle = warm > 0.5 ? 'rgba(225, 225, 225, 0.35)' : 'rgba(155, 155, 155, 0.3)';
    bCtx.fillRect(0, y, size, h);
  }

  // Tapered organic horizontal charcoal lenticels (classic birch dashes)
  for (let i = 0; i < 130; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const w = 14 + rand() * 58;
    const h = 2.2 + rand() * 5.2;
    const dark = rand() > 0.28;
    const tilt = (rand() - 0.5) * 0.06;
    ctx.fillStyle = dark ? 'rgba(42, 39, 36, 0.86)' : 'rgba(98, 90, 80, 0.65)';
    bCtx.fillStyle = dark ? 'rgba(42, 42, 42, 0.82)' : 'rgba(84, 84, 84, 0.62)';
    for (const ox of [-size, 0, size]) {
      if (ox < 0 && x + w * 0.5 <= size) continue;
      if (ox > 0 && x - w * 0.5 >= 0) continue;
      ctx.beginPath();
      ctx.ellipse(x + ox, y, w * 0.5, h * 0.5, tilt, 0, Math.PI * 2);
      ctx.fill();
      bCtx.beginPath();
      bCtx.ellipse(x + ox, y, w * 0.5, h * 0.5, 0, 0, Math.PI * 2);
      bCtx.fill();
    }
  }

  // A few gnarled dark diamond bark knots / scars
  for (let i = 0; i < 12; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const w = 22 + rand() * 34;
    const h = 10 + rand() * 14;
    drawWrappedBounds(size, x - w * 0.5, x + w * 0.5, y - h * 0.7, y + h * 0.7, (ox, oy) => {
      ctx.fillStyle = 'rgba(48, 44, 40, 0.88)';
      ctx.beginPath();
      ctx.moveTo(x + ox - w * 0.5, y + oy);
      ctx.quadraticCurveTo(x + ox, y + oy - h * 0.7, x + ox + w * 0.5, y + oy);
      ctx.quadraticCurveTo(x + ox, y + oy + h * 0.7, x + ox - w * 0.5, y + oy);
      ctx.fill();

      bCtx.fillStyle = 'rgba(26, 26, 26, 0.9)';
      bCtx.beginPath();
      bCtx.moveTo(x + ox - w * 0.5, y + oy);
      bCtx.quadraticCurveTo(x + ox, y + oy - h * 0.7, x + ox + w * 0.5, y + oy);
      bCtx.quadraticCurveTo(x + ox, y + oy + h * 0.7, x + ox - w * 0.5, y + oy);
      bCtx.fill();
    });
  }

  return { map: finishColorTexture(canvas), bump: finishDataTexture(bCanvas) };
}

function createOakLeavesTextures(): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const size = 512;
  const [canvas, ctx] = makeTileCanvas(size);
  const [bCanvas, bCtx] = makeTileCanvas(size);
  const rand = mulberry32(1616);

  // Deep interior foliage shadow pockets (neutral-bright so instance green multiplies vividly)
  ctx.fillStyle = '#7A8672';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#2B2B2B';
  bCtx.fillRect(0, 0, size, size);

  // Soft depth mottling
  for (let i = 0; i < 110; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 18 + rand() * 32;
    const shade = Math.round(108 + rand() * 44);
    ctx.fillStyle = `rgba(${shade}, ${shade + 8}, ${shade - 8}, 0.45)`;
    drawWrappedBounds(size, x - r, x + r, y - r, y + r, (ox, oy) => {
      ctx.beginPath();
      ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Three layered depths of overlapping broadleaf rosettes (shadow -> mid -> sunlit crown)
  const layers = [
    { count: 140, lenMin: 20, lenMax: 30, lumMin: 148, lumMax: 178, bumpMin: 78, bumpMax: 120, veins: false },
    { count: 165, lenMin: 18, lenMax: 27, lumMin: 186, lumMax: 218, bumpMin: 132, bumpMax: 182, veins: true },
    { count: 130, lenMin: 15, lenMax: 23, lumMin: 222, lumMax: 252, bumpMin: 192, bumpMax: 245, veins: true },
  ];

  for (const layer of layers) {
    for (let i = 0; i < layer.count; i++) {
      const cx = rand() * size;
      const cy = rand() * size;
      const rosetteCount = 3 + Math.floor(rand() * 3);
      const baseAngle = rand() * Math.PI * 2;
      const lum = Math.round(layer.lumMin + rand() * (layer.lumMax - layer.lumMin));
      const warmShift = Math.round((rand() - 0.45) * 14);
      const fill = `rgb(${Math.min(255, lum + warmShift)}, ${Math.min(255, lum + 5)}, ${Math.max(0, lum - 10 - warmShift * 0.5)})`;
      const vein = layer.veins ? `rgba(255, 255, 238, 0.36)` : undefined;
      const bVal = Math.round(layer.bumpMin + rand() * (layer.bumpMax - layer.bumpMin));
      const bFill = `rgb(${bVal}, ${bVal}, ${bVal})`;
      const bVein = layer.veins ? `rgba(255, 255, 255, 0.45)` : undefined;

      for (let k = 0; k < rosetteCount; k++) {
        const ang = baseAngle + (k / rosetteCount) * Math.PI * 2 + (rand() - 0.5) * 0.4;
        const len = layer.lenMin + rand() * (layer.lenMax - layer.lenMin);
        const wid = len * (0.48 + rand() * 0.14);
        const lx = cx + Math.cos(ang) * (len * 0.42);
        const ly = cy + Math.sin(ang) * (len * 0.42);
        const pad = len * 0.56 + 3;

        drawWrappedBounds(size, lx - pad, lx + pad, ly - pad, ly + pad, (ox, oy) => {
          // Soft drop shadow beneath each leaf for crisp separation
          drawLeafBlade(ctx, lx + ox + 1.5, ly + oy + 2.2, len, wid, ang + Math.PI * 0.5, 'rgba(38, 48, 34, 0.32)');
          drawLeafBlade(ctx, lx + ox, ly + oy, len, wid, ang + Math.PI * 0.5, fill, vein);
          drawLeafBlade(bCtx, lx + ox, ly + oy, len, wid, ang + Math.PI * 0.5, bFill, bVein);
        });
      }
    }
  }

  return { map: finishColorTexture(canvas), bump: finishDataTexture(bCanvas) };
}

function createPineLeavesTextures(): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const size = 512;
  const [canvas, ctx] = makeTileCanvas(size);
  const [bCanvas, bCtx] = makeTileCanvas(size);
  const rand = mulberry32(1717);

  // Shadowed evergreen bough interior
  ctx.fillStyle = '#70806E';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#282828';
  bCtx.fillRect(0, 0, size, size);

  // Layered downward-fanning conifer needle sprays (matches cone/tier UV orientation)
  const layers = [
    { count: 160, lenMin: 24, lenMax: 36, lumMin: 142, lumMax: 175, bumpMin: 76, bumpMax: 122 },
    { count: 180, lenMin: 20, lenMax: 32, lumMin: 184, lumMax: 218, bumpMin: 136, bumpMax: 186 },
    { count: 140, lenMin: 16, lenMax: 26, lumMin: 222, lumMax: 252, bumpMin: 196, bumpMax: 248 },
  ];

  for (const layer of layers) {
    for (let i = 0; i < layer.count; i++) {
      const cx = rand() * size;
      const cy = rand() * size;
      const sprayAngle = Math.PI * 0.5 + (rand() - 0.5) * 0.55; // fanning downward along boughs
      const needles = 7 + Math.floor(rand() * 4);
      const len = layer.lenMin + rand() * (layer.lenMax - layer.lenMin);
      const lum = Math.round(layer.lumMin + rand() * (layer.lumMax - layer.lumMin));
      const bVal = Math.round(layer.bumpMin + rand() * (layer.bumpMax - layer.bumpMin));
      const pad = len + 4;

      drawWrappedBounds(size, cx - pad, cx + pad, cy - 4, cy + pad, (ox, oy) => {
        for (let n = 0; n < needles; n++) {
          const frac = (n / (needles - 1)) - 0.5;
          const ang = sprayAngle + frac * 1.15;
          const nLen = len * (1.0 - Math.abs(frac) * 0.32);
          const x0 = cx + ox;
          const y0 = cy + oy;
          const x1 = x0 + Math.cos(ang) * nLen;
          const y1 = y0 + Math.sin(ang) * nLen;

          // Subtle dark backing stroke for needle separation
          ctx.strokeStyle = 'rgba(34, 48, 36, 0.35)';
          ctx.lineWidth = 3.4;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(x0, y0 + 1.5);
          ctx.lineTo(x1, y1 + 1.5);
          ctx.stroke();

          // Bright needle frond
          const tipBoost = Math.round((1 - Math.abs(frac)) * 12);
          ctx.strokeStyle = `rgb(${Math.min(255, lum - 6 + tipBoost)}, ${Math.min(255, lum + 6 + tipBoost)}, ${Math.min(255, lum - 4 + tipBoost)})`;
          ctx.lineWidth = 2.1;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();

          bCtx.strokeStyle = `rgb(${bVal}, ${bVal}, ${bVal})`;
          bCtx.lineWidth = 2.4;
          bCtx.lineCap = 'round';
          bCtx.beginPath();
          bCtx.moveTo(x0, y0);
          bCtx.lineTo(x1, y1);
          bCtx.stroke();
        }
      });
    }
  }

  return { map: finishColorTexture(canvas), bump: finishDataTexture(bCanvas) };
}

function createBirchLeavesTextures(): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const size = 512;
  const [canvas, ctx] = makeTileCanvas(size);
  const [bCanvas, bCtx] = makeTileCanvas(size);
  const rand = mulberry32(1818);

  // Airy dappled birch canopy interior
  ctx.fillStyle = '#899880';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#383838';
  bCtx.fillRect(0, 0, size, size);

  const layers = [
    { count: 240, lenMin: 12, lenMax: 18, lumMin: 154, lumMax: 184, bumpMin: 82, bumpMax: 126 },
    { count: 280, lenMin: 11, lenMax: 16, lumMin: 194, lumMax: 226, bumpMin: 138, bumpMax: 190 },
    { count: 240, lenMin: 9, lenMax: 14, lumMin: 228, lumMax: 254, bumpMin: 198, bumpMax: 248 },
  ];

  for (const layer of layers) {
    for (let i = 0; i < layer.count; i++) {
      const cx = rand() * size;
      const cy = rand() * size;
      const ang = rand() * Math.PI * 2;
      const len = layer.lenMin + rand() * (layer.lenMax - layer.lenMin);
      const wid = len * 0.56;
      const lum = Math.round(layer.lumMin + rand() * (layer.lumMax - layer.lumMin));
      const bVal = Math.round(layer.bumpMin + rand() * (layer.bumpMax - layer.bumpMin));
      const fill = `rgb(${Math.min(255, lum + 4)}, ${Math.min(255, lum + 6)}, ${Math.max(0, lum - 12)})`;
      const bFill = `rgb(${bVal}, ${bVal}, ${bVal})`;
      const pad = len * 0.6 + 3;

      drawWrappedBounds(size, cx - pad, cx + pad, cy - pad, cy + pad, (ox, oy) => {
        drawLeafBlade(ctx, cx + ox + 1.2, cy + oy + 1.6, len, wid, ang, 'rgba(42, 54, 38, 0.28)');
        drawLeafBlade(ctx, cx + ox, cy + oy, len, wid, ang, fill, 'rgba(255, 255, 240, 0.3)');
        drawLeafBlade(bCtx, cx + ox, cy + oy, len, wid, ang, bFill);
      });
    }
  }

  return { map: finishColorTexture(canvas), bump: finishDataTexture(bCanvas) };
}

function createWoodRingsTexture(): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeTileCanvas(size);
  const rand = mulberry32(1919);
  const cx = size * 0.5;
  const cy = size * 0.5;

  // Outer sapwood ring
  ctx.fillStyle = '#E2C496';
  ctx.fillRect(0, 0, size, size);

  // Heartwood warm radial gradient
  const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, size * 0.48);
  grad.addColorStop(0, '#B98856');
  grad.addColorStop(0.55, '#D4AE7A');
  grad.addColorStop(0.9, '#E4C89B');
  grad.addColorStop(1, '#754C2E');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Concentric organic annual growth rings
  for (let r = 8; r < size * 0.47; r += 6 + rand() * 3.5) {
    ctx.strokeStyle = rand() > 0.4 ? 'rgba(122, 80, 44, 0.48)' : 'rgba(154, 106, 62, 0.34)';
    ctx.lineWidth = 1.4 + rand() * 1.4;
    ctx.beginPath();
    const wobblePhase = rand() * Math.PI * 2;
    for (let a = 0; a <= 48; a++) {
      const ang = (a / 48) * Math.PI * 2;
      const rad = r + Math.sin(ang * 3 + wobblePhase) * 2.2 + Math.cos(ang * 5 - wobblePhase) * 1.1;
      const x = cx + Math.cos(ang) * rad;
      const y = cy + Math.sin(ang) * rad;
      if (a === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  // Subtle radial drying cracks
  for (let i = 0; i < 6; i++) {
    const ang = rand() * Math.PI * 2;
    const len = 24 + rand() * 72;
    ctx.strokeStyle = 'rgba(72, 44, 24, 0.45)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(ang) * len, cy + Math.sin(ang) * len);
    ctx.stroke();
  }

  return finishColorTexture(canvas);
}

export function getTerrainTextureAtlas(): TerrainTextureAtlas {
  if (!cachedAtlas) {
    const oakBark = createOakBarkTextures();
    const pineBark = createPineBarkTextures();
    const birchBark = createBirchBarkTextures();
    const oakLeaves = createOakLeavesTextures();
    const pineLeaves = createPineLeavesTextures();
    const birchLeaves = createBirchLeavesTextures();

    cachedAtlas = {
      grass: createGrassTexture(),
      sand: createSandTexture(),
      rock: createRockTexture(),
      snow: createSnowTexture(),
      moss: createMossTexture(),
      cobble: createCobbleTexture(),
      dirt: createDirtTrailTexture(),
      leavesFloor: createLeavesFloorTexture(),
      clumpyDirt: createClumpyDirtTexture(),
      chamferedAshlarStone: createChamferedAshlarStoneTexture(),
      oakBark: oakBark.map,
      oakBarkBump: oakBark.bump,
      pineBark: pineBark.map,
      pineBarkBump: pineBark.bump,
      birchBark: birchBark.map,
      birchBarkBump: birchBark.bump,
      oakLeaves: oakLeaves.map,
      oakLeavesBump: oakLeaves.bump,
      pineLeaves: pineLeaves.map,
      pineLeavesBump: pineLeaves.bump,
      birchLeaves: birchLeaves.map,
      birchLeavesBump: birchLeaves.bump,
      woodRings: createWoodRingsTexture(),
      dampStoneBrick: createDampStoneBrickTexture(),
      craggyCaveRock: createCraggyCaveRockTexture(),
      dungeonFlagstone: createDungeonFlagstoneTexture(),
      castleFloor: createCastleFloorTexture(),
      castleWall: createCastleWallTexture(),
      scifiDeck: createScifiDeckTexture(),
      waterNormal: createWaterNormalTexture(),
      toonGradient: createToonGradientTexture(),
      glowSprite: createGlowSpriteTexture(),
    };
  }
  return cachedAtlas;
}
