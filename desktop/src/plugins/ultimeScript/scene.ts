// @ts-nocheck
/*
 * Ultime Cord, a Discord client mod
 * Ultime Script — pixel scene by sei (from sei-enfer.js v13), drawn on a canvas instead of a terminal
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/* eslint-disable */

const MIN_COLS = 70;
const MIN_ROWS = 28;
const APP_NAME = "ultime script";
const WEATHER_LABELS = ["orage de feu", "pluie de cendres", "tempête de braises", "cendres et braises", "calme"];
const WEATHER_LEVELS = [[0.0, 0.0], [1.0, 0.0], [0.0, 1.0], [0.75, 0.8], [0.0, 0.0]];

export const cfg = { theme: 0, weather: 1, lightning: 5, fps: 40, camSpeed: 1, rain: 1.0, snow: 1.0, skipIntro: false };
export const ui = { screen: "welcome", pending: null, open: false, openT: 0, openBolt: true, title: "", subtitle: "", rows: [], sel: 0, selY: 0, helpFn: () => "", note: "", noteT: 0, busy: false, crumb: "", input: null, prog: null, stop: false };
function selectableIdx() { return []; }
function selRowIndex() { return -1; }
const process = { stdout: { columns: 200, rows: 70 } };

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const pack = (r, g, b) => (r << 16) | (g << 8) | b;

function lerpC(a, b, k) {
  if (k <= 0) return a;
  if (k >= 1) return b;
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const r = (ar + (((b >> 16) & 255) - ar) * k) | 0;
  const g = (ag + (((b >> 8) & 255) - ag) * k) | 0;
  const bl = (ab + ((b & 255) - ab) * k) | 0;
  return (r << 16) | (g << 8) | bl;
}
function scaleC(c, k) {
  let r = ((c >> 16) & 255) * k, g = ((c >> 8) & 255) * k, b = (c & 255) * k;
  r = r < 0 ? 0 : r > 255 ? 255 : r | 0;
  g = g < 0 ? 0 : g > 255 ? 255 : g | 0;
  b = b < 0 ? 0 : b > 255 ? 255 : b | 0;
  return (r << 16) | (g << 8) | b;
}
function addC(c, d) {
  let r = ((c >> 16) & 255) + ((d >> 16) & 255);
  let g = ((c >> 8) & 255) + ((d >> 8) & 255);
  let b = (c & 255) + (d & 255);
  if (r > 255) r = 255;
  if (g > 255) g = 255;
  if (b > 255) b = 255;
  return (r << 16) | (g << 8) | b;
}
const lum = (c) => 0.299 * ((c >> 16) & 255) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255);

const easeOutCubic = (x) => { x = 1 - clamp01(x); return 1 - x * x * x; };
const easeInOutQuart = (x) => {
  x = clamp01(x);
  if (x < 0.5) return 8 * x * x * x * x;
  const y = 1 - x;
  return 1 - 8 * y * y * y * y;
};
const smooth = (a, b, x) => { const k = clamp01((x - a) / (b - a)); return k * k * (3 - 2 * k); };

function hash(x, y, s) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h & 0x7fffffff) / 0x7fffffff;
}
function n1(x, s) {
  const xi = Math.floor(x);
  let f = x - xi;
  f = f * f * (3 - 2 * f);
  const a = hash(xi, 0, s), b = hash(xi + 1, 0, s);
  return a + (b - a) * f;
}
function n2(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s);
  const c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  const ab = a + (b - a) * u, cd = c + (d - c) * u;
  return ab + (cd - ab) * v;
}
function fbm(x, y, oct, s) {
  let sum = 0, amp = 0.5, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += n2(x, y, s + i * 131) * amp;
    norm += amp;
    x *= 2.03; y *= 2.01; amp *= 0.5;
  }
  return sum / norm;
}
// #endregion
function makeTheme(i) {
  const P = pack;
  let o;
  switch (i) {
    case 1: o = { skyTop: P(26, 10, 4), skyHor: P(224, 120, 34), cloud: P(56, 26, 12), cloudLit: P(255, 196, 110), accent: P(255, 164, 60), bolt: P(255, 244, 214), glow: P(226, 120, 34), snow: P(255, 214, 140), star: P(255, 190, 120), moon: P(230, 140, 70), water: P(86, 32, 10), tree: P(16, 8, 4), logo: P(255, 240, 200), logoEdge: P(255, 170, 70), panel: P(32, 14, 8) }; break;
    case 2: o = { skyTop: P(14, 14, 4), skyHor: P(176, 164, 32), cloud: P(38, 38, 14), cloudLit: P(240, 236, 120), accent: P(208, 236, 72), bolt: P(250, 255, 200), glow: P(150, 168, 40), snow: P(236, 246, 150), star: P(220, 240, 150), moon: P(196, 204, 90), water: P(40, 44, 12), tree: P(10, 12, 4), logo: P(248, 255, 200), logoEdge: P(200, 230, 70), panel: P(20, 22, 8) }; break;
    case 3: o = { skyTop: P(14, 11, 11), skyHor: P(128, 96, 86), cloud: P(34, 28, 28), cloudLit: P(206, 182, 170), accent: P(222, 132, 92), bolt: P(255, 238, 224), glow: P(140, 92, 76), snow: P(232, 214, 200), star: P(222, 196, 180), moon: P(140, 112, 102), water: P(26, 20, 20), tree: P(10, 8, 8), logo: P(246, 232, 220), logoEdge: P(222, 140, 100), panel: P(20, 16, 16) }; break;
    case 4: o = { skyTop: P(10, 8, 8), skyHor: P(120, 110, 106), cloud: P(26, 24, 24), cloudLit: P(206, 200, 196), accent: P(255, 240, 220), bolt: P(255, 255, 255), glow: P(140, 130, 126), snow: P(240, 236, 232), star: P(216, 208, 204), moon: P(70, 64, 62), water: P(12, 10, 10), tree: P(6, 6, 6), logo: P(255, 250, 244), logoEdge: P(255, 240, 220), panel: P(14, 12, 12) }; break;
    case 5: o = { skyTop: P(70, 140, 220), skyHor: P(255, 226, 170), cloud: P(236, 240, 252), cloudLit: P(255, 255, 255), accent: P(255, 214, 120), bolt: P(255, 255, 240), glow: P(255, 220, 150), snow: P(255, 255, 255), star: P(255, 246, 210), moon: P(255, 244, 200), water: P(120, 190, 240), tree: P(40, 90, 70), logo: P(255, 255, 255), logoEdge: P(255, 210, 120), panel: P(230, 240, 255) }; break;
    default: o = { skyTop: P(18, 4, 4), skyHor: P(206, 62, 18), cloud: P(44, 14, 10), cloudLit: P(255, 148, 62), accent: P(255, 92, 38), bolt: P(255, 232, 190), glow: P(204, 54, 20), snow: P(255, 196, 110), star: P(255, 150, 80), moon: P(208, 66, 48), water: P(74, 16, 8), tree: P(12, 5, 4), logo: P(255, 226, 176), logoEdge: P(255, 120, 50), panel: P(26, 9, 7) };
  }
  const far = lerpC(o.skyHor, P(150, 110, 100), 0.42);
  const r0 = lerpC(far, o.skyHor, 0.30);
  o.rock = [r0, scaleC(r0, 0.74), scaleC(r0, 0.52), scaleC(r0, 0.34), scaleC(r0, 0.20)];
  return o;
}
// #endregion

const GLYPH = {
  U: ['#..#', '#..#', '#..#', '#..#', '.##.'],
  L: ['#...', '#...', '#...', '#...', '####'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  S: ['.###', '#...', '.##.', '...#', '###.'],
  E: ['####', '#...', '###.', '#...', '####'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#'],
  F: ['####', '#...', '###.', '#...', '#...'],
  R: ['###.', '#..#', '###.', '#.#.', '#..#'],
};

const RIDGE_BASE = [0.64, 0.70, 0.77, 0.83, 0.87];
const RIDGE_AMP = [0.50, 0.42, 0.34, 0.26, 0.15];
const RIDGE_WL = [90, 70, 55, 42, 34];

class Scene {
  constructor() {
    this.t = 0;
    this.th = makeTheme(cfg.theme);
    this.introActive = !cfg.skipIntro;
    this.introT = cfg.skipIntro ? 7.5 : 0;
    this.onIntroEnd = null;
    this.introBolt = false;
    this.camX = 0;
    this.wind = 0; this.windTarget = 0; this.windRatio = 0;
    this.flash = 0; this.shake = 0;
    this.bolts = [];
    this.boltX = -1;
    this.nextBolt = 2.5; this.salvo = 0;
    this.rainLvl = 0; this.snowLvl = 0; this.cover = 0.3;
    this.panelT = 0;
    this.logoOn = false; this.logoSweep = 1; this.logoPending = cfg.skipIntro; this.logoPendT = 0.9;
    this.snowAcc = 0;
    this.fps = 0; this.fpsAcc = 0; this.fpsClock = 0;
    this.pl = { x: 0, y: 0, w: 10, h: 10 };
    this.pRect = null;
    this.logoHit = 0;
    this.resize(Math.max(20, process.stdout.columns || 100), Math.max(8, process.stdout.rows || 30));
  }

  setTheme(i) { this.th = makeTheme(i); }

  // ---------- allocation ----------
  resize(cols, rows) {
    this.cols = cols; this.rows = rows; this.PW = cols; this.PH = rows * 2;
    const n = cols * rows;
    this.pix = new Int32Array(this.PW * this.PH);
    this.tch = new Uint16Array(n);
    this.tfg = new Int32Array(n);
    this.tbold = new Uint8Array(n);
    this.pch = new Uint16Array(n).fill(0xFFFF);
    this.pfg = new Int32Array(n).fill(-1);
    this.pbg = new Int32Array(n).fill(-1);
    this.pbold = new Uint8Array(n);
    this.tooSmall = cols < MIN_COLS || rows < MIN_ROWS;
    this.ridgeY = new Float32Array(5 * this.PW);
    this.waterY = Math.floor(this.PH * 0.80);
    this.buildStars();
    this.buildTrees();
    this.buildParticles();
    this.buildLogo();
    this.bolts = [];
    this.flash = 0;
  }

  buildStars() {
    const n = Math.max(40, this.PW * 2);
    this.starN = n;
    this.starX = new Float32Array(n); this.starY = new Float32Array(n); this.starB = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.starX[i] = Math.random() * this.PW;
      this.starY[i] = Math.random() * this.PH * 0.55;
      this.starB[i] = 0.35 + Math.random() * 0.65;
    }
  }

  buildTrees() {
    const n = Math.max(14, Math.floor(this.PW / 3.2));
    this.trees = [];
    for (let i = 0; i < n; i++) {
      const back = Math.random() < 0.45;
      this.trees.push({
        x: Math.random() * (this.PW + 30) - 15,
        h: this.PH * (0.06 + Math.random() * 0.09) * (back ? 0.8 : 1),
        w: 2.2 + Math.random() * 2.6,
        ph: Math.random() * 6.28,
        back,
      });
    }
    this.trees.sort((a, b) => (a.back === b.back ? 0 : a.back ? -1 : 1));
  }

  buildParticles() {
    const PW = this.PW, PH = this.PH;
    const nr = Math.max(150, Math.floor((PW * PH) / 11));
    this.nr = nr;
    this.rx = new Float32Array(nr); this.ry = new Float32Array(nr); this.rvy = new Float32Array(nr);
    this.rlen = new Float32Array(nr); this.rl = new Uint8Array(nr); this.rgy = new Float32Array(nr);
    for (let i = 0; i < nr; i++) this.spawnRain(i, true);
    const ns = Math.max(80, Math.floor((PW * PH) / 24));
    this.ns = ns;
    this.sx = new Float32Array(ns); this.sy = new Float32Array(ns); this.svy = new Float32Array(ns);
    this.sph = new Float32Array(ns); this.sl = new Uint8Array(ns);
    for (let i = 0; i < ns; i++) this.spawnSnow(i, true);
    const sp = 700;
    this.spN = sp;
    this.spx = new Float32Array(sp); this.spy = new Float32Array(sp);
    this.spvx = new Float32Array(sp); this.spvy = new Float32Array(sp);
    this.spl = new Float32Array(sp); this.spm = new Float32Array(sp); this.spc = new Int32Array(sp);
    const rp = 120;
    this.rpN = rp;
    this.rpx = new Float32Array(rp); this.rpy = new Float32Array(rp); this.rpa = new Float32Array(rp).fill(-1);
  }

  spawnRain(i, init) {
    const PW = this.PW, PH = this.PH;
    const r = Math.random();
    const L = r < 0.5 ? 0 : r < 0.82 ? 1 : 2;
    this.rl[i] = L;
    const ratio = this.windRatio;
    const span = PW + Math.abs(ratio) * PH + 24;
    this.rx[i] = (ratio > 0 ? -ratio * PH - 12 : -12) + Math.random() * span;
    this.rvy[i] = [78, 120, 185][L] * (0.85 + Math.random() * 0.3);
    this.rlen[i] = L === 0 ? 2 + Math.random() : L === 1 ? 4 + Math.random() * 2 : 8 + Math.random() * 5;
    const depth = PH - this.waterY;
    this.rgy[i] = Math.min(PH - 1, this.waterY + 1 + Math.random() * depth * [0.25, 0.6, 1][L]);
    this.ry[i] = init ? Math.random() * this.rgy[i] : -Math.random() * PH * 0.35;
  }

  spawnSnow(i, init) {
    const PW = this.PW, PH = this.PH;
    const L = (Math.random() * 3) | 0;
    this.sl[i] = L;
    this.sx[i] = Math.random() * (PW + 80) - 40;
    this.sy[i] = init ? Math.random() * PH : -Math.random() * 10;
    this.svy[i] = [9, 16, 28][L] * (0.8 + Math.random() * 0.4);
    this.sph[i] = Math.random() * 6.28;
  }

  buildLogo() {
    const s = this.PW >= 135 ? 2 : 1;
    const cells = [];
    let x = 0;
    for (const ch of 'ULTIME') {
      if (ch === ' ') { x += 3; continue; }
      const g = GLYPH[ch];
      for (let r = 0; r < 5; r++)
        for (let c = 0; c < g[r].length; c++) if (g[r][c] === '#') cells.push([x + c, r]);
      x += g[0].length + 1;
    }
    const W0 = x - 1;
    const W = W0 * s, H = 5 * s;
    const mask = new Uint8Array(W * H);
    for (const [cx, cy] of cells)
      for (let dy = 0; dy < s; dy++)
        for (let dx = 0; dx < s; dx++) mask[(cy * s + dy) * W + cx * s + dx] = 1;
    this.logoW = W; this.logoH = H; this.logoMask = mask;
    this.logoX = Math.floor((this.PW - W) / 2);
    this.logoY = 4;
    this.maxSnow = 1 + s;
    // surfaces horizontales où les braises peuvent se poser
    const surf = [];
    for (let yy = 0; yy < H; yy++)
      for (let xx = 0; xx < W; xx++) {
        if (!mask[yy * W + xx]) continue;
        if (yy > 0 && mask[(yy - 1) * W + xx]) continue;
        let cap = 0;
        while (cap < this.maxSnow && (yy - 1 - cap < 0 || !mask[(yy - 1 - cap) * W + xx])) cap++;
        if (cap > 0) surf.push({ x: xx, y: yy, cap, n: 0 });
      }
    this.logoSurf = surf;
    this.logoEndRow = Math.ceil((this.logoY + H + 3) / 2) + 1;
  }

  // ---------- API ----------
  skipIntro() {
    if (!this.introActive) return;
    this.introT = 7.5;
    this.introActive = false;
    if (!this.logoOn) { this.logoPending = true; this.logoPendT = 0.9; }
    if (this.onIntroEnd) this.onIntroEnd();
  }

  strike(power, main, atLogo) {
    const PW = this.PW, PH = this.PH;
    const L = main ? 1 : (Math.random() < 0.6 ? 1 : 2);
    let bestY = 1e9, tx = PW * 0.5;
    const tries = main ? PW : 30;
    const blockPanel = !main && ui.open && this.panelT > 0.3;
    for (let i = 0; i < tries; i++) {
      const x = main ? i : Math.floor(PW * 0.06 + Math.random() * PW * 0.88);
      if (blockPanel && x > this.pl.x - 3 && x < this.pl.x + this.pl.w + 3) continue;
      const y = this.ridgeY[L * PW + x];
      if (y > 1 && y < bestY) { bestY = y; tx = x; }
    }
    if (atLogo) { tx = Math.floor(this.logoX + this.logoW * (0.25 + Math.random() * 0.5)); bestY = this.logoY + this.logoH * 0.5; }
    if (bestY > 1e8) { tx = Math.floor(PW * (0.15 + Math.random() * 0.7)); bestY = Math.max(PH * 0.3, this.ridgeY[L * PW + tx]); }
    const x0 = tx + (Math.random() - 0.5) * PW * 0.30;
    const y0 = PH * (0.04 + Math.random() * 0.07);
    const segs = [];
    const forks = [3 + Math.floor(Math.random() * 5), 2 + Math.floor(Math.random() * 4)];
    const build = (ax, ay, bx, by, disp, depth, w, kind) => {
      if (depth <= 0) { segs.push([ax, ay, bx, by, w, kind]); return; }
      const mx = (ax + bx) / 2 + (Math.random() - 0.5) * disp;
      const my = (ay + by) / 2 + (Math.random() - 0.5) * disp * 0.3;
      build(ax, ay, mx, my, disp * 0.52, depth - 1, w, kind);
      build(mx, my, bx, by, disp * 0.52, depth - 1, w, kind);
      if (kind < 2 && depth >= 2 && depth <= (kind === 0 ? 5 : 3) && forks[kind] > 0 && Math.random() < (kind === 0 ? 0.30 : 0.2)) {
        forks[kind]--;
        const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
        const ang = Math.atan2(dy, dx) + (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.55);
        const bl = len * (kind === 0 ? 2.5 + Math.random() * 3.2 : 1.5 + Math.random() * 2);
        build(mx, my, mx + Math.cos(ang) * bl, my + Math.sin(ang) * bl, bl * 0.30, kind === 0 ? 4 : 3, kind === 0 ? 2 : 1, kind + 1);
      }
    };
    build(x0, y0, tx, bestY, Math.abs(bestY - y0) * 0.30, 7, 3, 0);
    const strikes = [0];
    if (Math.random() < 0.6) strikes.push(0.08 + Math.random() * 0.07);
    if (Math.random() < 0.3) strikes.push(0.22 + Math.random() * 0.10);
    const bolt = { segs, ox: x0, oy: y0, ix: tx, iy: bestY, power: clamp(power, 0.4, 1.4), age: 0, strikes, end: strikes[strikes.length - 1] + 0.5, I: 1 };
    this.bolts.push(bolt);
    if (this.bolts.length > 3) this.bolts.shift();
    this.boltX = tx;
    if (atLogo) { this.logoOn = true; this.logoSweep = 1; this.logoHit = 1.3; }
    // les braises du logo glissent
    for (const s of this.logoSurf) {
      if (s.n > 0 && Math.random() < 0.35) {
        s.n--;
        this.emit(this.logoX + s.x, this.logoY + s.y - 1, (Math.random() - 0.5) * 8, 4 + Math.random() * 8, 0.8, pack(255, 196, 120), 60);
      }
    }
  }

  emit(x, y, vx, vy, life, col, grav) {
    for (let i = 0; i < this.spN; i++) {
      if (this.spl[i] <= 0) {
        this.spx[i] = x; this.spy[i] = y; this.spvx[i] = vx; this.spvy[i] = vy;
        this.spl[i] = life; this.spm[i] = life; this.spc[i] = col; this.spg = grav;
        return;
      }
    }
  }

  splash(x, y, ripple) {
    const n = 2 + ((Math.random() * 3) | 0);
    const col = pack(255, 180, 90);
    for (let k = 0; k < n; k++) this.emit(x, y, (Math.random() - 0.5) * 34, -(18 + Math.random() * 26), 0.16 + Math.random() * 0.12, col, 230);
    if (ripple && Math.random() < 0.55) {
      for (let j = 0; j < this.rpN; j++) if (this.rpa[j] < 0) { this.rpx[j] = x; this.rpy[j] = y; this.rpa[j] = 0; break; }
    }
  }

  // ---------- mise à jour ----------
  update(dt) {
    this.t += dt;
    const t = this.t;
    this.fpsAcc++; this.fpsClock += dt;
    if (this.fpsClock >= 0.5) { this.fps = Math.round(this.fpsAcc / this.fpsClock); this.fpsAcc = 0; this.fpsClock = 0; }

    this.camX = Math.sin(t * 0.05 * cfg.camSpeed) * 40 * Math.min(1.5, cfg.camSpeed);

    // vent
    if (Math.random() < dt * 0.35) this.windTarget = (Math.random() - 0.3) * 1.6;
    this.wind += (this.windTarget - this.wind) * Math.min(1, dt * 0.9);
    const gust = Math.sin(t * 0.7) * 0.18 + Math.sin(t * 2.3) * 0.09;
    let wv = this.wind + gust;
    const it = this.introT;
    if (this.introActive) wv *= smooth(2.5, 4.5, it);
    this.windRatio = clamp(wv * 0.3, -0.45, 0.6);

    // intro
    if (this.introActive) {
      this.introT += dt;
      const i2 = this.introT;
      if (!this.introBolt && i2 >= 4.0) { this.introBolt = true; this.strike(1.4, true, true); this.nextBolt = 99; }
      if (i2 >= 5.4 && this.nextBolt > 50) this.nextBolt = 1.2;
      if (i2 >= 7.0) {
        this.introActive = false;
        if (this.onIntroEnd) this.onIntroEnd();
      }
    }

    // panneau
    const target = ui.open ? 1 : 0;
    if (this.panelT < target) this.panelT = Math.min(1, this.panelT + dt / 0.55);
    else if (this.panelT > target) this.panelT = Math.max(0, this.panelT - dt / 0.22);
    if (ui.open) ui.openT += dt;
    if (ui.pending && !ui.open && this.panelT <= 0.002 && this.onPanelClosed) this.onPanelClosed();
    if (ui.open && !ui.openBolt && ui.screen !== 'intro') {
      const first = selectableIdx()[0] || 0;
      if (ui.openT >= 0.30 + first * 0.07) { ui.openBolt = true; this.strike(0.95, false); }
    }
    // barre de sélection animée
    const sr = selRowIndex();
    if (sr >= 0) {
      if (ui.selY < 0) ui.selY = sr;
      ui.selY += (sr - ui.selY) * Math.min(1, dt * 14);
      if (Math.abs(sr - ui.selY) < 0.3) ui.selY = sr;
    }
    if (ui.noteT > 0) { ui.noteT -= dt; if (ui.noteT <= 0) ui.note = ''; }

    // décharges
    let fl = 0;
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.age += dt;
      let I = 0;
      for (const ts of b.strikes) if (b.age >= ts) I = Math.max(I, Math.exp(-(b.age - ts) / 0.075));
      b.I = I;
      if (b.age > b.end) { this.bolts.splice(i, 1); continue; }
      fl = Math.max(fl, I * b.power);
      if (b.power > 0.85 && I > 0.6) this.shake = 1;
    }
    this.flash = Math.min(1.4, fl);
    if (this.logoHit > 0) this.logoHit = Math.max(0, this.logoHit - dt * 1.6);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 3.5);

    const calm = cfg.weather === 4;
    if (this.logoPending && !this.introActive) {
      this.logoPendT -= dt;
      if (this.logoPendT <= 0) { this.logoPending = false; this.strike(1.1, false, true); }
    }
    if (!calm && !this.introActive || (this.introActive && this.introBolt && !calm)) {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) {
        const li = cfg.lightning;
        const power = (0.55 + Math.random() * 0.5) * (0.6 + li * 0.07);
        this.strike(power, false, this.logoOn && Math.random() < 0.3);
        const mean = (3.4 - 0.24 * li) * (cfg.weather === 2 ? 2.2 : 1);
        if (this.salvo > 0) { this.salvo--; this.nextBolt = 0.12 + Math.random() * 0.25; }
        else if (Math.random() < 0.28) { this.salvo = Math.floor(Math.random() * 3) + 1; this.nextBolt = 0.12 + Math.random() * 0.2; }
        else this.nextBolt = mean * (0.6 + Math.random() * 0.9);
      }
    }

    // météo
    const lv = WEATHER_LEVELS[cfg.weather];
    const introRain = this.introActive ? smooth(2.5, 4.5, it) : 1;
    this.rainLvl += (lv[0] * introRain - this.rainLvl) * Math.min(1, dt * 1.5);
    this.snowLvl += (lv[1] * introRain - this.snowLvl) * Math.min(1, dt * 1.5);
    const coverT = calm ? 0.05 : 1;
    const gather = this.introActive ? smooth(2.5, 4.0, it) : 1;
    this.cover += (Math.min(coverT, 0.12 + 0.88 * gather) - this.cover) * Math.min(1, dt * 1.2);

    this.updateParticles(dt);

    // braises sur le logo
    if (this.logoOn && !calm && !this.introActive || (this.logoOn && this.introActive && it > 5.5)) {
      const rate = cfg.weather === 2 ? 9 : (cfg.weather === 3 ? 5 : 2.5);
      this.snowAcc += dt * rate;
      while (this.snowAcc >= 1) {
        this.snowAcc -= 1;
        const s = this.logoSurf[(Math.random() * this.logoSurf.length) | 0];
        if (s && s.n < s.cap) s.n++;
      }
    }
  }

  updateParticles(dt) {
    const PW = this.PW, PH = this.PH;
    const ratio = this.windRatio;
    const pr = this.pRect;
    const cnt = Math.floor(this.nr * clamp01(this.rainLvl) * cfg.rain);
    for (let i = 0; i < this.nr; i++) {
      const prevY = this.ry[i];
      this.ry[i] += this.rvy[i] * dt * (0.8 + cfg.lightning * 0.04);
      this.rx[i] += ratio * this.rvy[i] * dt;
      const y = this.ry[i], x = this.rx[i];
      let hit = false;
      if (pr && x >= pr.x0 && x < pr.x1 && prevY < pr.topPy && y >= pr.topPy) {
        if (i < cnt) this.splash(x, pr.topPy - 1, false);
        hit = true;
      } else if (y >= this.rgy[i]) {
        if (i < cnt && x >= 0 && x < PW) this.splash(x, this.rgy[i], true);
        hit = true;
      } else if (x < -40 || x > PW + 40) hit = true;
      if (hit) this.spawnRain(i, false);
    }
    for (let i = 0; i < this.ns; i++) {
      this.sy[i] += this.svy[i] * dt;
      this.sx[i] += (ratio * this.svy[i] * 1.6 + Math.sin(this.t * 1.4 + this.sph[i]) * 7) * dt;
      if (this.sy[i] > PH + 2 || this.sx[i] < -50 || this.sx[i] > PW + 50) this.spawnSnow(i, false);
    }
    for (let i = 0; i < this.spN; i++) {
      if (this.spl[i] <= 0) continue;
      this.spl[i] -= dt;
      this.spvy[i] += 230 * dt;
      this.spx[i] += this.spvx[i] * dt;
      this.spy[i] += this.spvy[i] * dt;
    }
    for (let i = 0; i < this.rpN; i++) {
      if (this.rpa[i] >= 0) { this.rpa[i] += dt; if (this.rpa[i] > 1.0) this.rpa[i] = -1; }
    }
  }

  // ---------- pixels ----------
  bp(x, y, c, a) {
    x = x | 0; y = y | 0;
    if (x < 0 || y < 0 || x >= this.PW || y >= this.PH || a <= 0) return;
    const i = y * this.PW + x;
    this.pix[i] = a >= 1 ? c : lerpC(this.pix[i], c, a);
  }
  px(x, y, c) {
    x = x | 0; y = y | 0;
    if (x < 0 || y < 0 || x >= this.PW || y >= this.PH) return;
    this.pix[y * this.PW + x] = c;
  }
  glow(x, y, r, col, a) {
    const xi = Math.round(x), yi = Math.round(y);
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > r) continue;
        const k = 1 - d / r;
        this.bp(xi + dx, yi + dy, col, a * k * k);
      }
  }

  ridgeH(L, wx) {
    let s = 0, a = 1, norm = 0, f = 1 / RIDGE_WL[L];
    for (let o = 0; o < 5; o++) {
      const v = 1 - Math.abs(2 * n1(wx * f + L * 37.3, 17 + L * 11 + o) - 1);
      s += v * a; norm += a; a *= 0.5; f *= 2.1;
    }
    return s / norm;
  }

  // ---------- composition ----------
  compose() {
    const PW = this.PW, PH = this.PH, pix = this.pix, th = this.th, t = this.t;
    this.tch.fill(0);
    if (this.tooSmall) { this.composeTooSmall(); return; }

    const intro = this.introActive, it = this.introT;
    const skyAmt = intro ? easeOutCubic(smooth(0.8, 2.2, it)) : 1;
    const amb = intro ? 0.5 + 0.5 * smooth(4.0, 5.0, it) : 1;
    const fl = this.flash;
    const shX = this.shake > 0.4 ? ((Math.random() * 3) | 0) - 1 : 0;
    const shY = this.shake > 0.8 ? ((Math.random() * 2) | 0) : 0;
    const zoom = 1 + 0.05 * easeInOutQuart(this.panelT);
    const cx = PW / 2, cy = PH * 0.7;

    // ---- ciel ----
    for (let y = 0; y < PH; y++) {
      const k = clamp01(y / (PH * 0.72));
      let c = lerpC(th.skyTop, th.skyHor, Math.pow(k, 0.85));
      c = scaleC(c, skyAmt * amb);
      if (fl > 0.01) c = addC(c, scaleC(th.bolt, fl * 0.30 * (0.35 + 0.65 * k)));
      pix.fill(c, y * PW, (y + 1) * PW);
    }

    // ---- étoiles ----
    const starVis = intro && it < 0.8 ? Math.floor(this.starN * it / 0.8) : this.starN;
    for (let i = 0; i < starVis; i++) {
      const b = this.starB[i] * (0.55 + 0.45 * Math.sin(t * 2.1 + i)) * (1 - clamp01(fl * 1.2));
      const c = scaleC(th.star, b);
      const sx = (this.starX[i] | 0), sy = (this.starY[i] | 0);
      this.px(sx, sy, c);
      if (this.starB[i] > 0.85) { this.bp(sx + 1, sy, c, 0.4); this.bp(sx, sy + 1, c, 0.4); }
    }
    if (intro && it < 0.8) { this.composeIntroTexts(); return; }

    // ---- lune de sang ----
    const mx = PW * 0.78 + shX, my = PH * 0.12;
    for (let y = -14; y <= 14; y++)
      for (let x = -14; x <= 14; x++) {
        const d = Math.sqrt(x * x + y * y);
        if (d > 14) continue;
        const a = d < 4 ? 0.9 : (1 - d / 14) * 0.30;
        this.bp(mx + x, my + y, th.moon, a * amb * skyAmt);
      }

    // ---- voile de feu (calme) ----
    if (cfg.weather === 4) this.composeAurora(amb);

    // ---- fumées ----
    this.composeClouds(shX, amb, skyAmt);

    // ---- montagnes ----
    this.composeMountains(shX, shY, zoom, cx, cy, amb);

    // ---- décharges ----
    for (const b of this.bolts) this.drawBolt(b, shX, shY);

    // ---- forêt calcinée ----
    this.composeForest(shX, shY, amb, intro ? easeOutCubic(smooth(2.0, 3.0, it)) : 1);

    // ---- lac de lave (reflet de tout ce qui précède) ----
    this.composeLake(amb, intro ? smooth(2.2, 3.2, it) : 1);

    // ---- précipitations ----
    this.composePrecip(false);

    // ---- logo ----
    if (this.logoOn) this.composeLogo(shX, amb);
    this.composePrecip(true);
    this.composeParticles();

    // ---- panneau ----
    this.pRect = null;
    if (this.panelT > 0.001 && ui.screen !== 'intro') this.composePanel(amb);
    this.composeFooter();
    this.composeIntroTexts();
  }

  composeTooSmall() {
    const PW = this.PW, PH = this.PH;
    for (let y = 0; y < PH; y++) pix_fill(this.pix, y * PW, (y + 1) * PW, lerpC(this.th.skyTop, this.th.skyHor, y / PH));
    const l1 = 'fenêtre trop petite';
    const l2 = 'minimum ' + MIN_COLS + ' x ' + MIN_ROWS + '  (actuel ' + this.cols + ' x ' + this.rows + ')';
    this.putText(Math.max(0, ((this.cols - l1.length) / 2) | 0), Math.floor(this.rows / 2) - 1, l1, this.th.logo, true);
    this.putText(Math.max(0, ((this.cols - l2.length) / 2) | 0), Math.floor(this.rows / 2) + 1, l2, pack(190, 150, 130), false);
  }

  composeIntroTexts() {
    if (this.introActive && this.introT >= 6.5 && this.introT < 7.0) {
      const s = spaced('bienvenue');
      this.putText(((this.cols - s.length) / 2) | 0, Math.floor(this.rows * 0.56), s, pack(255, 235, 200), true);
    }
  }

  composeAurora(amb) {
    const PW = this.PW, PH = this.PH, t = this.t;
    for (let x = 0; x < PW; x++) {
      const n = n1(x * 0.025 + t * 0.18, 3);
      const top = PH * (0.06 + 0.12 * n);
      const h = PH * (0.18 + 0.18 * n1(x * 0.02 - t * 0.1, 7));
      for (let y = Math.floor(top); y < top + h && y < PH; y++) {
        const k = (y - top) / h;
        const a = Math.pow(1 - k, 1.6) * 0.55 * (0.65 + 0.35 * Math.sin(t * 0.8 + x * 0.07));
        const c = lerpC(pack(255, 96, 32), pack(170, 36, 80), k);
        const i = y * PW + x;
        this.pix[i] = addC(this.pix[i], scaleC(c, a * amb));
      }
    }
  }

  composeClouds(shX, amb, skyAmt) {
    const PW = this.PW, PH = this.PH, t = this.t, th = this.th;
    const bandH = Math.floor(PH * 0.52);
    const lights = [];
    for (const b of this.bolts) lights.push([b.ox, b.oy, b.I * b.power]);
    const fl = this.flash;
    const cover = this.cover;
    const camOff = this.camX * 0.6 + shX;
    for (let y = 0; y < bandH; y++) {
      const vy = y / bandH;
      const thr = 0.70 - 0.28 * cover + vy * 0.18;
      for (let x = 0; x < PW; x++) {
        const d = fbm((x + camOff) * 0.020 + t * 0.012, y * 0.05 - t * 0.006, 3, 5);
        if (d < thr) continue;
        let a = clamp01((d - thr) / 0.16) * 0.94 * skyAmt;
        let c = lerpC(th.cloud, th.cloudLit, clamp01(d * 0.5 + (1 - vy) * 0.1 - 0.08));
        c = scaleC(c, amb);
        if (fl > 0.02) {
          let lit = fl * 0.22;
          for (let j = 0; j < lights.length; j++) {
            const dx = (x - lights[j][0]) / (PW * 0.30), dy = (y - lights[j][1]) / (PH * 0.28);
            lit += clamp01(1 - Math.sqrt(dx * dx + dy * dy)) * lights[j][2] * 0.95;
          }
          c = addC(c, scaleC(th.cloudLit, lit));
          a = clamp01(a + lit * 0.3);
        }
        const i = y * PW + x;
        this.pix[i] = lerpC(this.pix[i], c, a);
      }
    }
  }

  composeMountains(shX, shY, zoom, cx, cy, amb) {
    const PW = this.PW, PH = this.PH, th = this.th, t = this.t, pix = this.pix;
    const intro = this.introActive, it = this.introT;
    const ridgeY = this.ridgeY;
    const fl = this.flash;

    for (let L = 0; L < 5; L++) {
      const rv = intro ? easeOutCubic(clamp01((it - (0.85 + L * 0.25)) / 0.95)) : 1;
      for (let x = 0; x < PW; x++) {
        const u = cx + (x - cx) / zoom + shX;
        const wx = u * 0.9 + this.camX * (0.25 + 0.2 * L) + L * 531;
        let y = RIDGE_BASE[L] * PH - RIDGE_AMP[L] * PH * this.ridgeH(L, wx);
        y = Math.max(PH * 0.05, y);
        y = cy + (y - cy) * zoom;
        y = y + (PH - y) * (1 - rv);
        ridgeY[L * PW + x] = y + shY;
      }
    }

    const fogCol = scaleC(lerpC(th.skyHor, th.cloudLit, 0.2), amb);
    for (let L = 0; L < 5; L++) {
      const base = scaleC(th.rock[L], amb);
      const emberOn = L <= 2;
      const emberLine = (0.30 + L * 0.085) * PH;
      for (let x = 0; x < PW; x++) {
        const y0f = ridgeY[L * PW + x];
        let y0 = Math.ceil(y0f);
        if (y0 >= PH) continue;
        if (y0 < 0) y0 = 0;
        const xm = x > 0 ? x - 1 : 0, xp = x < PW - 1 ? x + 1 : PW - 1;
        const slope = ridgeY[L * PW + xp] - ridgeY[L * PW + xm];
        const s = Math.min(1, Math.abs(slope) / 3);
        const face = slope > 0 ? 1 : -1;
        const bright = 0.88 + 0.22 * face * (0.3 + 0.7 * s);
        const bd = this.boltX >= 0 ? (this.boltX > x ? 1 : -1) : 0;
        const fb = fl > 0.01 ? fl * (0.30 + 0.9 * Math.max(0, face * bd) * (0.4 + 0.6 * s)) : 0;
        const m0 = bright * (1 + fb);
        const edgeLine = emberOn ? emberLine + (n1(x * 0.35 + L * 13, 31 + L) - 0.5) * 6 : -1;
        for (let y = y0; y < PH; y++) {
          const dy = y - y0f;
          let m = m0 * (1 + 0.18 * Math.max(0, 1 - dy / 10)) * (0.94 + 0.12 * hash(x, y, L));
          let c = scaleC(base, m);
          if (emberOn && y < edgeLine) {
            const a = clamp01((edgeLine - y) / 3) * (1 - 0.55 * s);
            if (a > 0) {
              const sm = amb * (0.55 + (face > 0 ? 0.30 : 0) + 0.5 * fb);
              c = lerpC(c, scaleC(th.snow, sm), a);
            }
          }
          if (y === y0) c = lerpC(c, th.cloudLit, 0.14 * amb);
          pix[y * PW + x] = c;
        }
      }
      // brume de vallée le long de la crête suivante
      if (L < 4) {
        for (let x = 0; x < PW; x++) {
          const yb = Math.floor(ridgeY[(L + 1) * PW + x]);
          if (yb >= PH) continue;
          const nz = n2(x * 0.04 + t * 0.12 + L * 5, L * 7, 40 + L);
          for (let dy = -8; dy <= 2; dy++) {
            const y = yb + dy;
            if (y < 0 || y >= PH) continue;
            const a = clamp01(1 - Math.abs(dy + 2.5) / 6) * (0.18 + 0.4 * nz) * (0.5 + 0.12 * L);
            this.bp(x, y, fogCol, a);
          }
        }
      }
    }
  }

  drawBolt(b, shX, shY) {
    const th = this.th;
    const I = b.I;
    if (I < 0.04) return;
    const coreA = Math.min(1, I * 1.5);
    const white = pack(255, 255, 255);
    const gR = b.power > 0.9 ? 5 : 4;
    for (const sg of b.segs) {
      const ax = sg[0] + shX, ay = sg[1] + shY, bx = sg[2] + shX, by = sg[3] + shY;
      const w = sg[4], kind = sg[5];
      const dx = bx - ax, dy = by - ay;
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
      const horiz = Math.abs(dx) > Math.abs(dy);
      for (let s = 0; s <= steps; s++) {
        const k = s / steps;
        const x = ax + dx * k, y = ay + dy * k;
        if (kind === 0 && (s & 1) === 0) this.glow(x, y, gR, th.glow, I * 0.34 * b.power);
        else if (kind === 1 && (s & 1) === 0) this.glow(x, y, 2, th.glow, I * 0.28);
        for (let o = 0; o < w; o++) {
          const off = o - (w === 3 ? 1 : 0);
          const px = horiz ? x : x + off, py = horiz ? y + off : y;
          const isCore = (w === 3 && o === 1) || (w === 2 && o === 0) || w === 1;
          const col = isCore ? (kind === 0 ? white : lerpC(th.bolt, white, 0.5)) : lerpC(th.bolt, th.glow, 0.35);
          this.bp(px, py, col, isCore ? coreA : coreA * 0.8);
        }
      }
    }
    // point d'impact
    for (let a = 0; a < 30; a++) {
      const ang = a * 0.209;
      this.bp(b.ix + shX + Math.cos(ang) * 5, b.iy + shY + Math.sin(ang) * 2, white, 0.5 * I);
    }
    this.glow(b.ix + shX, b.iy + shY, 6, th.bolt, 0.5 * I);
  }

  composeForest(shX, shY, amb, grow) {
    const PH = this.PH, th = this.th, t = this.t, fl = this.flash;
    const baseY0 = this.waterY + shY;
    for (const tr of this.trees) {
      const baseY = baseY0 + (tr.back ? -1 : 2);
      const h = tr.h * grow;
      if (h < 1) continue;
      const topY = baseY - h;
      const sway = Math.sin(t * 0.9 + tr.ph) * (0.4 + Math.abs(this.wind) * 1.6);
      const col = scaleC(tr.back ? lerpC(th.tree, th.rock[4], 0.5) : th.tree, Math.max(0.6, amb));
      const rim = scaleC(th.cloudLit, 0.12 + fl * 0.30);
      for (let y = Math.floor(topY); y < baseY; y++) {
        const tt = (y - topY) / h;
        const tier = Math.floor(tt * 3), lt = tt * 3 - tier;
        const half = tr.w * ((tier + 1) / 3) * (0.35 + 0.65 * lt) + 0.4;
        const cxl = tr.x + shX * 1.4 + sway * (1 - tt);
        const x0 = Math.round(cxl - half), x1 = Math.round(cxl + half);
        for (let x = x0; x <= x1; x++) this.px(x, y, col);
        this.px(x1, y, addC(col, rim));
      }
    }
  }

  composeLake(amb, lakeAmt) {
    const PW = this.PW, PH = this.PH, th = this.th, t = this.t, pix = this.pix;
    const wy = this.waterY, depthTot = Math.max(1, PH - wy);
    const waterCol = scaleC(th.water, Math.max(0.7, amb));
    for (let y = wy; y < PH; y++) {
      const d = (y - wy) / depthTot;
      for (let x = 0; x < PW; x++) {
        const wav = Math.sin(x * 0.17 + t * 2.1 + y * 0.4) * (1 + d * 3) + Math.sin(x * 0.43 - t * 3.0) * 0.8;
        const sx = clamp(Math.round(x + wav), 0, PW - 1);
        let sy = wy - 1 - Math.floor((y - wy) * 0.9 + Math.abs(Math.sin(x * 0.3 + t * 2 + y)) * 1.2);
        if (sy < 0) sy = 0;
        const src = pix[sy * PW + sx];
        let c = lerpC(scaleC(src, 0.62), waterCol, 0.30 + 0.30 * d);
        if (y === wy) c = lerpC(c, th.cloudLit, 0.10);
        const i = y * PW + x;
        pix[i] = lakeAmt >= 1 ? c : lerpC(pix[i], c, lakeAmt);
      }
    }
    // brume au ras de la lave
    for (let y = wy - 6; y < wy + 2; y++) {
      if (y < 0) continue;
      const a = clamp01(1 - Math.abs(y - (wy - 2)) / 5) * 0.22;
      for (let x = 0; x < PW; x++) this.bp(x, y, th.skyHor, a * (0.5 + n2(x * 0.05 + t * 0.2, y * 0.3, 9)));
    }
    // ondulations
    for (let i = 0; i < this.rpN; i++) {
      if (this.rpa[i] < 0) continue;
      const age = this.rpa[i];
      const r = age * 11 + 1;
      const alpha = 0.65 * (1 - age);
      const nPts = Math.min(56, Math.ceil(r * 5));
      for (let a = 0; a < nPts; a++) {
        const ang = (a / nPts) * 6.2832;
        const y = this.rpy[i] + Math.sin(ang) * r * 0.32;
        if (y < wy) continue;
        this.bp(this.rpx[i] + Math.cos(ang) * r * 1.6, y, pack(255, 170, 90), alpha);
      }
    }
  }

  composePrecip(frontOnly) {
    const PW = this.PW, PH = this.PH, fl = this.flash;
    if (!frontOnly) {
      const cnt = Math.floor(this.nr * clamp01(this.rainLvl) * cfg.rain);
      const ratio = this.windRatio;
      const flashC = pack(255, 214, 170);
      const heads = [pack(150, 108, 88), pack(196, 148, 116), pack(236, 190, 150)];
      const tails = [pack(64, 42, 34), pack(104, 72, 56), pack(130, 92, 68)];
      for (let i = 0; i < cnt; i++) {
        const L = this.rl[i];
        const hx = this.rx[i], hy = this.ry[i];
        const len = this.rlen[i];
        const norm = Math.sqrt(1 + ratio * ratio);
        const tx = hx - (ratio / norm) * len, ty = hy - (1 / norm) * len;
        const steps = Math.max(1, Math.ceil(Math.max(Math.abs(hx - tx), Math.abs(hy - ty))));
        const hc = lerpC(heads[L], flashC, clamp01(fl * 0.9));
        const tc = lerpC(tails[L], flashC, clamp01(fl * 0.5));
        const baseA = L === 0 ? 0.5 : L === 1 ? 0.75 : 0.95;
        for (let s = 0; s <= steps; s++) {
          const k = s / steps;
          this.bp(tx + (hx - tx) * k, ty + (hy - ty) * k, lerpC(tc, hc, k), baseA * (0.2 + 0.8 * k));
        }
      }
    }
    const cs = Math.floor(this.ns * clamp01(this.snowLvl) * cfg.snow);
    for (let i = 0; i < cs; i++) {
      const L = this.sl[i];
      if (frontOnly !== (L === 2)) continue;
      const x = this.sx[i], y = this.sy[i];
      let c = L === 0 ? pack(168, 84, 40) : L === 1 ? pack(248, 152, 62) : pack(255, 214, 128);
      c = lerpC(c, pack(255, 255, 255), clamp01(fl));
      if (L === 2) { this.px(x, y, c); this.px(x + 1, y, c); this.px(x, y + 1, c); this.px(x + 1, y + 1, c); }
      else this.px(x, y, c);
    }
  }

  composeParticles() {
    for (let i = 0; i < this.spN; i++) {
      if (this.spl[i] <= 0) continue;
      const a = clamp01(this.spl[i] / this.spm[i]);
      this.bp(this.spx[i], this.spy[i], this.spc[i], a * 0.9);
    }
  }

  composeLogo(shX, amb) {
    const W = this.logoW, H = this.logoH, mask = this.logoMask, th = this.th;
    const hit = clamp01(this.logoHit);
    const white = pack(255, 255, 255);
    const X = this.logoX + shX, Y = this.logoY;
    const reveal = W;
    const flashAll = hit > 0.5 || this.flash > 0.45;
    const t = this.t;

    // le texte est écrit à la braise : chaque pixel de la lettre
    // crépite, pas de remplissage plat ni de contour bleu.
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!mask[y * W + x]) continue;
        // bord ou cœur de trait ?
        let edgeN = false;
        for (let dy = -1; dy <= 1 && !edgeN; dy++)
          for (let dx = -1; dx <= 1 && !edgeN; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H || !mask[ny * W + nx]) edgeN = true;
          }
        const flick = 0.55 + 0.45 * n2(x * 0.9 + t * 9, y * 0.9 - t * 7, 61);
        const spark = Math.random() < 0.05 * (0.4 + hit);
        let col = lerpC(th.bolt, white, clamp01(flick * 0.8 + hit * 0.5));
        if (spark) col = white;
        if (!edgeN) col = lerpC(col, th.glow, 0.18);
        this.px(X + x, Y + y, flashAll ? white : col);
        // micro-étincelles qui jaillissent du contour
        if (edgeN && Math.random() < 0.012 * (0.5 + hit * 2)) {
          const ang = Math.random() * 6.28;
          const len = 1 + Math.random() * 2;
          this.bp(X + x + Math.cos(ang) * len, Y + y + Math.sin(ang) * len, th.glow, 0.5 + 0.4 * hit);
        }
      }
      // halo de chaleur diffus derrière le trait
      for (let x = 0; x < W; x++) {
        if (!mask[y * W + x]) continue;
        if (((x + y + ((t * 20) | 0)) % 5) === 0) this.glow(X + x, Y + y, 2 + (hit > 0.3 ? 1 : 0), th.glow, 0.10 + 0.28 * hit);
      }
    }
    // braises déposées
    const emberCol = flashAll ? white : pack(255, 206, 120);
    for (const s of this.logoSurf) {
      if (s.x > reveal) continue;
      for (let k = 1; k <= s.n; k++) this.px(X + s.x, Y + s.y - k, emberCol);
    }
    // ligne fine sous le logo
    const lineW = Math.floor(W * 0.6), lineX = X + Math.floor((W - lineW) / 2);
    const lineLen = Math.min(lineW, Math.max(0, reveal - Math.floor((W - lineW) / 2)));
    for (let x = 0; x < lineLen; x++) this.px(lineX + x, Y + H + 2, lerpC(th.accent, th.logo, 0.35));
    // sous-titre
    if (this.logoSweep >= 1) {
      const row = Math.ceil((Y + H + 3) / 2);
      const s = APP_NAME;
      this.putText(((this.cols - s.length) / 2) | 0, row, s, pack(190, 150, 130), false);
    }
  }

  // ---------- panneau ----------
  composePanel(amb) {
    const cols = this.cols, rows = this.rows, PW = this.PW, PH = this.PH, pix = this.pix, th = this.th;
    const n = ui.rows.length;
    let maxLen = ui.title.length * 2 + 2;
    for (const r of ui.rows) {
      const l = (r.key ? 5 : 0) + r.name.length + (r.val ? r.val.length + 4 : 0);
      if (l > maxLen) maxLen = l;
    }
    maxLen = Math.max(maxLen, ui.subtitle.length, 46);
    const innerW = Math.min(maxLen, cols - 10);
    const panelW = innerW + 8;
    const panelH = n + 8;
    let panelY = Math.max(this.logoEndRow + 1, Math.floor((rows - panelH) * 0.62));
    if (panelY + panelH > rows - 1) panelY = Math.max(2, rows - 1 - panelH);
    const panelX = Math.floor((cols - panelW) / 2);
    this.pl = { x: panelX, y: panelY, w: panelW, h: panelH };

    const pt = this.panelT;
    const visRows = Math.ceil(panelH * easeOutCubic(clamp01((pt - 0.15) / 0.85)));
    const traceRows = Math.ceil(panelH * easeOutCubic(clamp01(pt * 2.5)));
    if (traceRows < 1) return;
    this.pRect = { x0: panelX, x1: panelX + panelW, topPy: panelY * 2 };

    const base = th.panel;
    // verre
    for (let r = 0; r < visRows; r++) {
      const cy = panelY + r;
      if (cy >= rows - 1) break;
      for (let x = panelX; x < panelX + panelW; x++) {
        const i0 = (cy * 2) * PW + x, i1 = i0 + PW;
        const a = lerpC(pix[i0], pix[i1], 0.5);
        const c = lerpC(scaleC(a, 0.55), base, 0.80);
        pix[i0] = c; pix[i1] = c;
      }
    }
    // ligne d'accent gauche (pulsation douce)
    const pulse = 0.72 + 0.18 * Math.sin(this.t * 1.7) + this.flash * 0.7;
    const accent = scaleC(th.accent, clamp(pulse, 0.4, 1.6));
    for (let r = 0; r < traceRows; r++) {
      const cy = panelY + r;
      if (cy >= rows - 1) break;
      pix[(cy * 2) * PW + panelX] = accent;
      pix[(cy * 2 + 1) * PW + panelX] = accent;
    }
    if (visRows < panelH) return;

    const tx = panelX + 4, rx = panelX + panelW - 4;
    const clip0 = panelX + 3, clip1 = panelX + panelW - 3;
    const contentTop = panelY + 4;
    const t0 = ui.openT;
    const progOf = (start) => easeOutCubic(clamp01((t0 - start) / 0.22));
    const fade = (col, p) => lerpC(base, col, p);

    // titre / sous-titre
    const pT = progOf(0.12), pS = progOf(0.20);
    if (pT > 0) this.putText(tx + Math.round((1 - pT) * 8), panelY + 1, spaced(ui.title), fade(pack(255, 228, 192), pT), true, clip0, clip1);
    if (pS > 0) this.putText(tx + Math.round((1 - pS) * 8), panelY + 2, ui.subtitle, fade(pack(176, 134, 112), pS), false, clip0, clip1);

    // barre de sélection
    const barRow = Math.round(ui.selY);
    const selIdx = selRowIndex();
    const barCol = scaleC(th.accent, 0.85);
    const barText = lum(barCol) > 165 ? pack(14, 8, 6) : pack(255, 248, 240);
    if (selIdx >= 0 && barRow >= 0 && barRow < n && progOf(0.30 + barRow * 0.07) > 0.3) {
      const by = contentTop + barRow;
      for (let x = panelX + 2; x <= panelX + panelW - 3; x++) {
        pix[(by * 2) * PW + x] = barCol; pix[(by * 2 + 1) * PW + x] = barCol;
        if (by > panelY + 3) {
          const j = (by * 2 - 1) * PW + x; pix[j] = lerpC(pix[j], barCol, 0.18);
        }
        const j2 = (by * 2 + 2) * PW + x;
        if (j2 < pix.length) pix[j2] = lerpC(pix[j2], barCol, 0.18);
      }
      const ind = pack(255, 250, 240);
      pix[(by * 2) * PW + panelX + 1] = ind; pix[(by * 2 + 1) * PW + panelX + 1] = ind;
    }

    // lignes
    for (let i = 0; i < n; i++) {
      const r = ui.rows[i];
      if (r.kind === 'h') continue;
      const p = progOf(0.30 + i * 0.07);
      if (p <= 0) continue;
      const ry = contentTop + i;
      if (ry >= panelY + panelH - 3) break;
      const slide = Math.round((1 - p) * 8);
      const isSel = (r.kind === 'e' || r.kind === 's') && !r.disabled && i === barRow;
      const dis = !!r.disabled;
      if (r.kind === 't') {
        this.putText(tx + slide, ry, r.name, fade(pack(196, 158, 136), p), false, clip0, clip1);
        if (r.val) this.putText(rx - r.val.length + slide, ry, r.val, fade(pack(196, 158, 136), p), false, clip0, clip1);
        continue;
      }
      const keyCol = isSel ? barText : (dis ? pack(110, 78, 66) : th.accent === pack(255, 240, 220) ? pack(230, 214, 200) : lerpC(th.accent, pack(255, 250, 240), 0.15));
      const nameCol = isSel ? barText : (dis ? pack(126, 94, 82) : pack(242, 214, 192));
      const valCol = isSel ? barText : (r.color != null ? r.color : pack(196, 150, 126));
      if (r.key) this.putText(tx + slide, ry, r.key, fade(keyCol, p), isSel, clip0, clip1);
      this.putText(tx + (r.key ? 5 : 0) + slide, ry, r.name, fade(nameCol, p), isSel, clip0, clip1);
      if (r.val) this.putText(rx - r.val.length + slide, ry, r.val, fade(valCol, p), isSel, clip0, clip1);
    }

    // aide, saisie et note
    const helpY = panelY + 5 + n;
    const pH2 = progOf(0.30 + n * 0.07);
    if (ui.input) {
      const caret = (Math.floor(this.t * 2.2) & 1) ? ' ' : '_';
      const line = (ui.input.prompt + ui.input.value).slice(-(innerW - 1)) + caret;
      this.putText(tx, helpY, line, pack(255, 220, 150), true, clip0, clip1);
      return;
    }
    if (pH2 > 0) {
      let help = ui.helpFn() || '';
      if (help.length > innerW) help = '…' + help.slice(help.length - innerW + 1);
      this.putText(tx, helpY, help, fade(pack(154, 114, 96), pH2), false, clip0, clip1);
      const spin = '|/-\\'[Math.floor(this.t * 8) % 4];
      const note = ui.busy ? 'en cours  ' + spin + (ui.note ? '  ' + ui.note : '') : ui.note;
      if (note) this.putText(tx, helpY + 1, note, fade(pack(255, 190, 120), pH2), false, clip0, clip1);
    }
  }

  composeFooter() {
    const PW = this.PW, cols = this.cols, rows = this.rows, pix = this.pix;
    const y = rows - 1;
    for (let x = 0; x < cols; x++) {
      const i0 = (y * 2) * PW + x, i1 = i0 + PW;
      const c = scaleC(lerpC(pix[i0], pix[i1], 0.5), 0.30);
      pix[i0] = c; pix[i1] = c;
    }
    const gray = pack(170, 132, 112);
    const left = 'sei > ' + ui.crumb;
    const right = new Date().toTimeString().slice(0, 8) + '   |   ' + this.fps + ' fps   |   ' + WEATHER_LABELS[cfg.weather];
    this.putText(2, y, left, gray, false);
    this.putText(cols - 2 - right.length, y, right, gray, false);
    const mid = 'haut/bas  entrée  échap';
    const mx = Math.floor((cols - mid.length) / 2);
    if (mx > 2 + left.length + 3 && mx + mid.length < cols - 2 - right.length - 3) this.putText(mx, y, mid, pack(140, 104, 88), false);
  }

  putText(x, y, s, fg, bold, c0, c1) {
    if (!s || y < 0 || y >= this.rows) return;
    const lo = c0 == null ? 0 : c0, hi = c1 == null ? this.cols : c1;
    for (let i = 0; i < s.length; i++) {
      const cx = x + i;
      if (cx < lo || cx >= hi || cx < 0 || cx >= this.cols) continue;
      const idx = y * this.cols + cx;
      this.tch[idx] = s.charCodeAt(i);
      this.tfg[idx] = fg;
      this.tbold[idx] = bold ? 1 : 0;
    }
  }

  // ---------- rendu différentiel ----------
  render() {
    const cols = this.cols, rows = this.rows, PW = this.PW, pix = this.pix;
    const tch = this.tch, tfg = this.tfg, tbold = this.tbold;
    const pch = this.pch, pfg = this.pfg, pbg = this.pbg, pbold = this.pbold;
    let out = '';
    let curFg = -1, curBg = -1, curB = 0, cx = -1, cy = -1;
    for (let y = 0; y < rows; y++) {
      const r0 = (y * 2) * PW, r1 = r0 + PW;
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        let c, fg, bg, b;
        const ch = tch[i];
        if (ch !== 0) { c = ch; fg = tfg[i]; bg = pix[r0 + x]; b = tbold[i]; }
        else { c = 0x2580; fg = pix[r0 + x]; bg = pix[r1 + x]; b = 0; }
        if (c === pch[i] && fg === pfg[i] && bg === pbg[i] && b === pbold[i]) continue;
        pch[i] = c; pfg[i] = fg; pbg[i] = bg; pbold[i] = b;
        if (cy !== y || cx !== x) out += '\x1b[' + (y + 1) + ';' + (x + 1) + 'H';
        if (fg !== curFg || bg !== curBg) {
          out += '\x1b[38;2;' + ((fg >> 16) & 255) + ';' + ((fg >> 8) & 255) + ';' + (fg & 255) +
                 ';48;2;' + ((bg >> 16) & 255) + ';' + ((bg >> 8) & 255) + ';' + (bg & 255) + 'm';
          curFg = fg; curBg = bg;
        }
        if (b !== curB) { out += b ? '\x1b[1m' : '\x1b[22m'; curB = b; }
        out += String.fromCharCode(c);
        cx = x + 1; cy = y;
      }
    }
    return out.length ? out + '\x1b[0m' : '';
  }
}

function pix_fill(arr, a, b, c) { arr.fill(c, a, b); }

function spaced(s) {
  return s.toUpperCase().split(' ').map((w) => w.split('').join(' ')).join('   ');
}
// #endregion


export { Scene, makeTheme };
