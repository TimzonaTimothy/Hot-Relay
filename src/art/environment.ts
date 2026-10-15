import { canvas, cel, circle, mix, poly, rng, roundRect, wrapX, INK, type Ctx } from './util';

/**
 * Jungle-ruins environment after the reference: pale teal sky with tall clouds, misty karst
 * towers and overgrown temple ruins with waterfalls, layered jungle, sandstone walkways over
 * turquoise water. Every parallax layer tiles horizontally.
 */

export const JUNGLE = {
  skyTop: '#4fb3cc',
  skyMid: '#a6dfdb',
  skyLow: '#eef4d6',
  haze: '#cfe8dc',
  farRock: '#8cb5a8',
  farRockShade: '#6f9a8f',
  farRockLight: '#b9d6c3',
  farMoss: '#93b77c',
  midLeaf: '#4a8a43',
  midLeafShade: '#2f6236',
  midLeafLight: '#7db24c',
  leafHi: '#b8cf4f',
  ruin: '#b59c7b',
  ruinShade: '#8c7760',
  ruinLight: '#d8c39f',
  trunk: '#7c4b2f',
  trunkShade: '#55321f',
  trunkLight: '#a8714a',
  stoneTop: '#d39b62',
  stoneTopLight: '#ecc28a',
  stoneTopShade: '#b07a4b',
  stoneFace: '#8f5d3d',
  stoneFaceDark: '#5f3b28',
  crack: '#47291b',
  moss: '#7fa83a',
  mossDark: '#557a2a',
  water: '#3fb6bb',
  waterDeep: '#257f8c',
  waterLight: '#8ae0d8',
  foam: '#ecfbf5',
} as const;

const J = JUNGLE;

/* ------------------------------------------------------------------ sky */

export function paintSky(w: number, h: number): HTMLCanvasElement {
  const [cv, ctx] = canvas(w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, J.skyTop);
  g.addColorStop(0.55, J.skyMid);
  g.addColorStop(1, J.skyLow);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // sun glow upper right
  const sg = ctx.createRadialGradient(w * 0.78, h * 0.18, 10, w * 0.78, h * 0.18, h * 0.6);
  sg.addColorStop(0, 'rgba(255,252,225,0.95)');
  sg.addColorStop(0.25, 'rgba(255,248,210,0.35)');
  sg.addColorStop(1, 'rgba(255,248,210,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, w, h);
  return cv;
}

function cloud(ctx: Ctx, x: number, y: number, s: number, r: () => number): void {
  const puffs: [number, number, number][] = [];
  const n = 7 + Math.floor(r() * 5);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI;
    puffs.push([x + Math.cos(a) * s * (0.9 + r() * 0.4), y - Math.sin(a) * s * (0.5 + r() * 0.6), s * (0.35 + r() * 0.25)]);
  }
  puffs.push([x, y - s * 0.4, s * 0.6]);
  // underside shade, body, highlight
  ctx.fillStyle = '#b9d9df';
  ctx.beginPath();
  for (const [px, py, pr] of puffs) circle(ctx, px - pr * 0.12, py + pr * 0.16, pr);
  ctx.fill();
  ctx.fillStyle = '#f4fbfb';
  ctx.beginPath();
  for (const [px, py, pr] of puffs) circle(ctx, px + pr * 0.06, py - pr * 0.08, pr * 0.92);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  for (const [px, py, pr] of puffs) circle(ctx, px + pr * 0.22, py - pr * 0.24, pr * 0.55);
  ctx.fill();
}

export function paintClouds(w: number, h: number): HTMLCanvasElement {
  const [cv, ctx] = canvas(w, h);
  const r = rng(11);
  for (let i = 0; i < 9; i++) {
    const x = (i / 9) * w + r() * 80;
    const s = 40 + r() * 70;
    const y = h * (0.35 + r() * 0.45);
    wrapX(w, x, s * 2.2, (xx) => cloud(ctx, xx, y, s, rng(100 + i)));
  }
  // a few distant birds
  ctx.strokeStyle = 'rgba(40,60,60,0.55)';
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 6; i++) {
    const x = r() * w;
    const y = h * 0.2 + r() * h * 0.4;
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 2);
    ctx.quadraticCurveTo(x - 3, y - 4, x, y);
    ctx.quadraticCurveTo(x + 3, y - 4, x + 6, y - 2);
    ctx.stroke();
  }
  return cv;
}

/* ------------------------------------------------------------------ shared pieces */

function waterfall(ctx: Ctx, x: number, top: number, bottom: number, width: number, r: () => number, alpha = 1): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, '#d6f4f2');
  g.addColorStop(1, '#f6fffd');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - width / 2, top);
  ctx.lineTo(x + width / 2, top);
  ctx.lineTo(x + width / 2 + width * 0.15, bottom);
  ctx.lineTo(x - width / 2 - width * 0.15, bottom);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,190,200,0.55)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < width / 3; i++) {
    const sx = x - width / 2 + r() * width;
    ctx.beginPath();
    ctx.moveTo(sx, top + r() * 20);
    ctx.lineTo(sx + (sx - x) * 0.1, bottom - r() * 30);
    ctx.stroke();
  }
  // mist at the foot
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.25 + r() * 0.25})`;
    ctx.beginPath();
    circle(ctx, x + (r() - 0.5) * width * 2.2, bottom - r() * 10, width * (0.35 + r() * 0.4));
    ctx.fill();
  }
  ctx.restore();
}

function foliageClump(ctx: Ctx, x: number, y: number, s: number, r: () => number, c: { base: string; shade: string; light: string; hi?: string }): void {
  const blobs: [number, number, number][] = [];
  const n = 5 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) blobs.push([x + (r() - 0.5) * s * 1.8, y + (r() - 0.6) * s * 0.9, s * (0.35 + r() * 0.35)]);
  ctx.fillStyle = c.shade;
  ctx.beginPath();
  for (const [bx, by, br] of blobs) circle(ctx, bx - br * 0.15, by + br * 0.15, br);
  ctx.fill();
  ctx.fillStyle = c.base;
  ctx.beginPath();
  for (const [bx, by, br] of blobs) circle(ctx, bx + br * 0.08, by - br * 0.1, br * 0.82);
  ctx.fill();
  ctx.fillStyle = c.light;
  ctx.beginPath();
  for (const [bx, by, br] of blobs) circle(ctx, bx + br * 0.28, by - br * 0.3, br * 0.42);
  ctx.fill();
  if (c.hi) {
    ctx.fillStyle = c.hi;
    for (const [bx, by, br] of blobs) {
      ctx.beginPath();
      circle(ctx, bx + br * 0.4, by - br * 0.45, br * 0.14);
      ctx.fill();
    }
  }
}

/** Palm: curved ringed trunk and drooping serrated fronds. */
export function palm(ctx: Ctx, x: number, baseY: number, height: number, lean: number, r: () => number, dark = 0, outline = true): void {
  const tc = mix(J.trunk, '#14251c', dark);
  const ts = mix(J.trunkShade, '#14251c', dark);
  const topX = x + lean;
  const topY = baseY - height;
  const cx = x + lean * 0.2;
  const cy = baseY - height * 0.55;
  const trunk = (c: Ctx) => {
    c.moveTo(x - 7, baseY);
    c.quadraticCurveTo(cx - 6, cy, topX - 3, topY);
    c.lineTo(topX + 3, topY);
    c.quadraticCurveTo(cx + 6, cy, x + 7, baseY);
    c.closePath();
  };
  cel(ctx, trunk, { base: tc, shade: ts, light: dark < 0.3 ? J.trunkLight : undefined, outline: outline ? INK : null, lw: 2 });
  ctx.strokeStyle = ts;
  ctx.lineWidth = 1.5;
  for (let t = 0.08; t < 0.95; t += 0.07) {
    const px = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * cx + t * t * topX;
    const py = (1 - t) * (1 - t) * baseY + 2 * (1 - t) * t * cy + t * t * topY;
    ctx.beginPath();
    ctx.moveTo(px - 6 * (1 - t * 0.5), py);
    ctx.lineTo(px + 6 * (1 - t * 0.5), py - 2);
    ctx.stroke();
  }
  const leaf = mix(J.midLeaf, '#14251c', dark);
  const leafS = mix(J.midLeafShade, '#0c1a12', dark);
  const leafL = mix(J.midLeafLight, '#14251c', dark);
  const fronds = 8;
  for (let i = 0; i < fronds; i++) {
    const a = -Math.PI / 2 + ((i / (fronds - 1)) - 0.5) * Math.PI * 1.25 + (r() - 0.5) * 0.25;
    const len = height * (0.42 + r() * 0.18);
    frond(ctx, topX, topY, a, len, leaf, leafS, leafL, outline);
  }
  ctx.fillStyle = mix('#6b3f22', '#14251c', dark);
  ctx.beginPath();
  circle(ctx, topX - 3, topY + 4, 4);
  circle(ctx, topX + 4, topY + 5, 3.5);
  ctx.fill();
}

function frond(ctx: Ctx, x: number, y: number, a: number, len: number, base: string, shade: string, light: string, outline: boolean): void {
  // the frond arcs out and droops under gravity
  const droop = Math.cos(a) * 0.9;
  const pts: [number, number][] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    pts.push([x + Math.cos(a) * len * t, y + Math.sin(a) * len * t + droop * droop * len * 0.55 * t * t + len * 0.35 * t * t]);
  }
  const w = len * 0.13;
  const leafPath = (c: Ctx) => {
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      const [px, py] = pts[i];
      const [qx, qy] = pts[i - 1];
      const nx = -(py - qy);
      const ny = px - qx;
      const nl = Math.hypot(nx, ny) || 1;
      const ww = w * Math.sin((i / pts.length) * Math.PI) * (i % 2 ? 1.25 : 0.7);
      c.lineTo(px + (nx / nl) * ww, py + (ny / nl) * ww);
    }
    for (let i = pts.length - 1; i > 0; i--) {
      const [px, py] = pts[i];
      const [qx, qy] = pts[i - 1];
      const nx = -(py - qy);
      const ny = px - qx;
      const nl = Math.hypot(nx, ny) || 1;
      const ww = w * Math.sin((i / pts.length) * Math.PI) * (i % 2 ? 0.7 : 1.25);
      c.lineTo(px - (nx / nl) * ww, py - (ny / nl) * ww);
    }
    c.closePath();
  };
  cel(ctx, leafPath, { base, shade, light, shadeOff: 2, outline: outline ? INK : null, lw: 1.5 });
  ctx.strokeStyle = shade;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (const [px, py] of pts) ctx.lineTo(px, py);
  ctx.stroke();
}

/* ------------------------------------------------------------------ far layer */

export function paintFar(w: number, h: number): HTMLCanvasElement {
  const [cv, ctx] = canvas(w, h);
  const r = rng(21);
  const horizon = h * 0.78;
  // karst towers and temple spires
  const count = Math.round(w / 150);
  for (let i = 0; i < count; i++) {
    const x = (i / count) * w + r() * 60;
    const tw = 60 + r() * 90;
    const th = 160 + r() * 230;
    const isTemple = r() < 0.35;
    wrapX(w, x, tw, (xx) => {
      if (isTemple) templeSpire(ctx, xx, horizon, tw * 0.8, th, r);
      else karst(ctx, xx, horizon, tw, th, rng(300 + i));
    });
    if (r() < 0.45) {
      const fx = x + tw * 0.45;
      wrapX(w, fx, 20, (xx) => waterfall(ctx, xx, horizon - th * 0.7, horizon + 10, 10 + r() * 10, rng(700 + i), 0.85));
    }
  }
  // atmospheric haze toward the horizon
  const haze = ctx.createLinearGradient(0, h * 0.3, 0, h);
  haze.addColorStop(0, 'rgba(207,232,220,0)');
  haze.addColorStop(0.55, 'rgba(207,232,220,0.55)');
  haze.addColorStop(1, 'rgba(207,232,220,0.95)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, w, h);
  // misty treeline
  for (let x = 0; x < w + 40; x += 26) {
    ctx.fillStyle = '#9fc4b0';
    ctx.beginPath();
    circle(ctx, x, horizon + 8 + Math.sin(x * 0.05) * 6, 26 + Math.sin(x * 0.13) * 8);
    ctx.fill();
  }
  ctx.fillStyle = '#9fc4b0';
  ctx.fillRect(0, horizon + 8, w, h - horizon);
  return cv;
}

function karst(ctx: Ctx, x: number, base: number, w: number, h: number, r: () => number): void {
  const top = base - h;
  const path = (c: Ctx) => {
    c.moveTo(x - w / 2, base);
    c.lineTo(x - w * 0.42, top + h * 0.25);
    c.quadraticCurveTo(x - w * 0.4, top, x - w * 0.05, top + 6);
    c.quadraticCurveTo(x + w * 0.38, top - 4, x + w * 0.4, top + h * 0.3);
    c.lineTo(x + w / 2, base);
    c.closePath();
  };
  cel(ctx, path, { base: J.farRock, shade: J.farRockShade, light: J.farRockLight, shadeOff: w * 0.18, rimOff: 4, outline: null });
  ctx.save();
  ctx.beginPath();
  path(ctx);
  ctx.clip();
  ctx.strokeStyle = 'rgba(80,120,110,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const sx = x - w / 2 + r() * w;
    ctx.beginPath();
    ctx.moveTo(sx, top + r() * h * 0.3);
    ctx.lineTo(sx + (r() - 0.5) * 10, base);
    ctx.stroke();
  }
  // moss cap
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = J.farMoss;
    ctx.beginPath();
    circle(ctx, x - w * 0.35 + r() * w * 0.7, top + 6 + r() * 14, 10 + r() * 10);
    ctx.fill();
  }
  ctx.restore();
}

function templeSpire(ctx: Ctx, x: number, base: number, w: number, h: number, r: () => number): void {
  const tiers = 4;
  let y = base;
  let tw = w;
  for (let t = 0; t < tiers; t++) {
    const th = (h / tiers) * (t === tiers - 1 ? 0.8 : 1);
    cel(ctx, (c) => roundRect(c, x - tw / 2, y - th, tw, th, 3), {
      base: mix(J.farRock, J.ruinLight, 0.25),
      shade: J.farRockShade,
      light: J.farRockLight,
      shadeOff: tw * 0.15,
      outline: null,
    });
    // dark window
    ctx.fillStyle = 'rgba(60,95,90,0.6)';
    ctx.beginPath();
    roundRect(ctx, x - tw * 0.12, y - th * 0.75, tw * 0.24, th * 0.5, tw * 0.1);
    ctx.fill();
    // moss drips
    ctx.fillStyle = J.farMoss;
    for (let i = 0; i < 4; i++) {
      const mx = x - tw / 2 + r() * tw;
      ctx.beginPath();
      roundRect(ctx, mx, y - th, 5 + r() * 8, 6 + r() * 18, 4);
      ctx.fill();
    }
    y -= th;
    tw *= 0.78;
  }
}

/* ------------------------------------------------------------------ mid layer */

export function paintMid(w: number, h: number): HTMLCanvasElement {
  const [cv, ctx] = canvas(w, h);
  const r = rng(31);
  const ground = h * 0.7;
  // ruins: arches and broken colonnades
  for (let i = 0; i < Math.round(w / 520); i++) {
    const x = (i + 0.3 + r() * 0.4) * 520;
    wrapX(w, x, 140, (xx) => ruinArch(ctx, xx, ground + 20, 110 + r() * 60, 150 + r() * 90, rng(400 + i)));
  }
  // waterfalls spilling between ruins
  for (let i = 0; i < 3; i++) {
    const x = (i + 0.7) * (w / 3);
    wrapX(w, x, 40, (xx) => waterfall(ctx, xx, ground - 170 - r() * 60, ground + 30, 22 + r() * 14, rng(800 + i)));
  }
  // jungle canopy band
  for (let x = -40; x < w + 40; x += 34 + r() * 30) {
    const s = 34 + r() * 30;
    const y = ground + 10 + r() * 30;
    wrapX(w, x, s * 1.6, (xx) =>
      foliageClump(ctx, xx, y, s, rng(Math.floor(x) + 5), {
        base: J.midLeaf,
        shade: J.midLeafShade,
        light: J.midLeafLight,
        hi: J.leafHi,
      }),
    );
  }
  // palms poking above the canopy
  for (let i = 0; i < Math.round(w / 260); i++) {
    const x = (i + r()) * 260;
    const ph = 110 + r() * 70;
    wrapX(w, x, ph * 0.7, (xx) => palm(ctx, xx, ground + 40, ph, (r() - 0.5) * 50, rng(500 + i), 0.15, false));
  }
  // aerial haze so the play layer reads first
  ctx.fillStyle = 'rgba(200,228,214,0.28)';
  ctx.fillRect(0, 0, w, ground + 40);
  // dense undergrowth filling the bottom
  const g = ctx.createLinearGradient(0, ground + 30, 0, h);
  g.addColorStop(0, J.midLeafShade);
  g.addColorStop(1, '#1f4228');
  ctx.fillStyle = g;
  ctx.fillRect(0, ground + 40, w, h - ground - 40);
  for (let x = -20; x < w + 20; x += 22) {
    wrapX(w, x, 30, (xx) =>
      foliageClump(ctx, xx, ground + 44 + Math.sin(x * 0.07) * 6, 22, rng(x + 9000), {
        base: '#3c7a3c',
        shade: '#26532d',
        light: '#5f9a42',
      }),
    );
  }
  return cv;
}

function ruinArch(ctx: Ctx, x: number, base: number, w: number, h: number, r: () => number): void {
  const pillarW = w * 0.22;
  const style = { base: J.ruin, shade: J.ruinShade, light: J.ruinLight, shadeOff: 5, outline: '#3b3328', lw: 1.5 };
  // two pillars, one broken
  cel(ctx, (c) => roundRect(c, x - w / 2, base - h, pillarW, h, 2), style);
  const broken = h * (0.55 + r() * 0.3);
  cel(ctx, (c) => poly(c, [x + w / 2 - pillarW, base, x + w / 2 - pillarW, base - broken, x + w / 2 - pillarW * 0.4, base - broken - 12, x + w / 2, base - broken + 4, x + w / 2, base]), style);
  // lintel stub on the intact pillar
  cel(ctx, (c) => roundRect(c, x - w / 2 - 6, base - h - 14, w * 0.55, 16, 2), style);
  // block lines
  ctx.strokeStyle = 'rgba(70,55,40,0.45)';
  ctx.lineWidth = 1.2;
  for (let y = base - h + 18; y < base; y += 18) {
    ctx.beginPath();
    ctx.moveTo(x - w / 2 + 2, y);
    ctx.lineTo(x - w / 2 + pillarW - 2, y);
    ctx.stroke();
  }
  // vines and moss
  ctx.strokeStyle = J.midLeafShade;
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const vx = x - w / 2 + r() * w * 0.55;
    const vl = 20 + r() * 60;
    ctx.beginPath();
    ctx.moveTo(vx, base - h - 6);
    ctx.quadraticCurveTo(vx + 6, base - h + vl / 2, vx - 2, base - h + vl);
    ctx.stroke();
  }
  ctx.fillStyle = J.moss;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    circle(ctx, x - w / 2 + r() * w * 0.55, base - h - 12 + r() * 6, 5 + r() * 6);
    ctx.fill();
  }
}

/* ------------------------------------------------------------------ near layer */

export function paintNear(w: number, h: number): HTMLCanvasElement {
  const [cv, ctx] = canvas(w, h);
  const r = rng(41);
  // big jungle trunks with buttress roots
  for (let i = 0; i < Math.round(w / 700); i++) {
    const x = (i + 0.2 + r() * 0.6) * 700;
    const tw = 38 + r() * 26;
    wrapX(w, x, tw * 3, (xx) => bigTrunk(ctx, xx, h, tw, rng(600 + i)));
  }
  // hanging vines from the top edge
  for (let i = 0; i < Math.round(w / 90); i++) {
    const x = r() * w;
    const len = 40 + r() * 140;
    wrapX(w, x, 20, (xx) => vine(ctx, xx, len, rng(900 + i)));
  }
  // canopy fringe across the top
  for (let x = -30; x < w + 30; x += 40 + r() * 30) {
    const s = 30 + r() * 26;
    wrapX(w, x, s * 1.6, (xx) =>
      foliageClump(ctx, xx, -6 + r() * 18, s, rng(Math.floor(x) + 77), {
        base: '#2f6a35',
        shade: '#1d4526',
        light: '#4f8d3d',
        hi: '#8fb648',
      }),
    );
  }
  return cv;
}

function bigTrunk(ctx: Ctx, x: number, h: number, tw: number, r: () => number): void {
  const style = { base: '#5d3a26', shade: '#3c2417', light: '#87573a', shadeOff: tw * 0.3, rimOff: 3 };
  cel(
    ctx,
    (c) => {
      c.moveTo(x - tw / 2, -10);
      c.lineTo(x + tw / 2, -10);
      c.quadraticCurveTo(x + tw * 0.4, h * 0.6, x + tw * 1.6, h + 4);
      c.lineTo(x - tw * 1.5, h + 4);
      c.quadraticCurveTo(x - tw * 0.45, h * 0.6, x - tw / 2, -10);
      c.closePath();
    },
    style,
  );
  // bark grooves
  ctx.strokeStyle = 'rgba(30,18,10,0.5)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const gx = x - tw * 0.35 + r() * tw * 0.7;
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.quadraticCurveTo(gx + (r() - 0.5) * 10, h * 0.5, gx + (gx - x) * 1.8, h);
    ctx.stroke();
  }
  // moss patches and a bracket fungus
  ctx.fillStyle = J.moss;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    circle(ctx, x - tw * 0.4 + r() * tw * 0.8, h * (0.2 + r() * 0.6), 4 + r() * 7);
    ctx.fill();
  }
}

function vine(ctx: Ctx, x: number, len: number, r: () => number): void {
  ctx.strokeStyle = '#2b5a2c';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.bezierCurveTo(x + 12, len * 0.3, x - 12, len * 0.6, x + 3, len);
  ctx.stroke();
  for (let t = 0.15; t < 1; t += 0.12) {
    const ly = len * t;
    const lx = x + Math.sin(t * 9) * 6;
    ctx.fillStyle = r() < 0.5 ? '#3f7d3a' : '#5a9a3c';
    ctx.beginPath();
    ctx.ellipse(lx + (r() < 0.5 ? -5 : 5), ly, 6, 3, r() - 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ------------------------------------------------------------------ water + foreground */

export function paintWater(w: number, h: number): HTMLCanvasElement {
  const [cv, ctx] = canvas(w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, J.water);
  g.addColorStop(1, J.waterDeep);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const r = rng(51);
  // ripple bands
  for (let i = 0; i < 40; i++) {
    const y = 4 + r() * (h - 8);
    const x = r() * w;
    const len = 20 + r() * 60;
    ctx.strokeStyle = `rgba(160,240,232,${0.25 + (1 - y / h) * 0.45})`;
    ctx.lineWidth = 2;
    wrapX(w, x, len, (xx) => {
      ctx.beginPath();
      ctx.moveTo(xx - len / 2, y);
      ctx.quadraticCurveTo(xx, y - 2, xx + len / 2, y);
      ctx.stroke();
    });
  }
  // bright surface line
  ctx.fillStyle = J.foam;
  ctx.fillRect(0, 0, w, 3);
  ctx.fillStyle = J.waterLight;
  ctx.fillRect(0, 3, w, 3);
  return cv;
}

export function paintForeground(w: number, h: number): HTMLCanvasElement {
  const [cv, ctx] = canvas(w, h);
  const r = rng(61);
  for (let i = 0; i < Math.round(w / 240); i++) {
    const x = (i + r()) * 240;
    wrapX(w, x, 90, (xx) => fernClump(ctx, xx, h + 6, 60 + r() * 50, rng(1000 + i), '#183823', '#0f2617'));
  }
  return cv;
}

export function fernClump(ctx: Ctx, x: number, base: number, size: number, r: () => number, base1: string, shade: string, light?: string): void {
  const n = 7 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i / (n - 1) - 0.5) * 2.2 + (r() - 0.5) * 0.2;
    frond(ctx, x, base, a, size * (0.6 + r() * 0.5), base1, shade, light ?? base1, false);
  }
}

/* ------------------------------------------------------------------ terrain */

export interface BlockPaint {
  w: number;
  h: number;
  /** Paint at most this deep; the rest is a flat dark fill drawn by the engine. */
  paintDepth: number;
  oneWay: boolean;
  seed: number;
}

/** A sandstone walkway block: lit top lip with moss, cracked block face, ink outline. */
export function paintBlock(b: BlockPaint): HTMLCanvasElement {
  const lip = 14;
  const H = Math.min(b.h, b.paintDepth);
  const pad = 10;
  const [cv, ctx] = canvas(b.w + pad * 2, H + pad);
  const r = rng(b.seed);
  ctx.translate(pad, pad);
  const x0 = 0;
  const x1 = b.w;
  // jagged sides so walkways look broken, not cut
  const sideL: number[] = [];
  const sideR: number[] = [];
  for (let y = lip; y <= H; y += 14) {
    sideL.push(x0 + (r() - 0.3) * 6, y);
    sideR.push(x1 - (r() - 0.3) * 6, y);
  }
  const face = (c: Ctx) => {
    c.moveTo(x0, lip - 2);
    c.lineTo(x1, lip - 2);
    for (let i = 0; i < sideR.length; i += 2) c.lineTo(sideR[i], sideR[i + 1]);
    c.lineTo(x1 - 4, H + 2);
    c.lineTo(x0 + 4, H + 2);
    for (let i = sideL.length - 2; i >= 0; i -= 2) c.lineTo(sideL[i], sideL[i + 1]);
    c.closePath();
  };
  ctx.save();
  ctx.beginPath();
  face(ctx);
  const fg = ctx.createLinearGradient(0, lip, 0, H);
  fg.addColorStop(0, J.stoneFace);
  fg.addColorStop(1, mix(J.stoneFaceDark, '#1f2a22', b.h > b.paintDepth ? 0.5 : 0));
  ctx.fillStyle = fg;
  ctx.fill();
  ctx.clip();
  // stone courses
  ctx.strokeStyle = J.crack;
  ctx.lineWidth = 1.6;
  const course = b.oneWay ? 12 : 26;
  for (let y = lip + course; y < H; y += course) {
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(x0, y + (r() - 0.5) * 2);
    ctx.lineTo(x1, y + (r() - 0.5) * 2);
    ctx.stroke();
    const off = r() * 40;
    for (let x = off; x < b.w; x += 34 + r() * 30) {
      ctx.beginPath();
      ctx.moveTo(x, y - course);
      ctx.lineTo(x + (r() - 0.5) * 3, y);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  // lit upper edge on each block, dark shadow under the lip
  ctx.fillStyle = 'rgba(30,15,8,0.45)';
  ctx.fillRect(x0 - 4, lip - 2, b.w + 8, 6);
  // cracks
  ctx.strokeStyle = 'rgba(40,20,10,0.8)';
  ctx.lineWidth = 1.3;
  for (let i = 0; i < b.w / 70; i++) {
    let cx = r() * b.w;
    let cy = lip + 6 + r() * Math.min(60, H - lip);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    for (let k = 0; k < 4; k++) {
      cx += (r() - 0.5) * 14;
      cy += 4 + r() * 8;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }
  // dripping moss and hanging roots
  for (let i = 0; i < b.w / 55; i++) {
    const mx = r() * b.w;
    const ml = 5 + r() * (b.oneWay ? 8 : 20);
    const mw = 5 + r() * 10;
    ctx.fillStyle = r() < 0.7 ? J.mossDark : J.moss;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(mx, lip - 2);
    ctx.lineTo(mx + mw, lip - 2);
    ctx.quadraticCurveTo(mx + mw * 0.8, lip + ml * 0.6, mx + mw * 0.55, lip + ml);
    ctx.quadraticCurveTo(mx + mw * 0.3, lip + ml * 0.4, mx, lip - 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  ctx.beginPath();
  face(ctx);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();

  // top surface slab
  const top = (c: Ctx) => {
    c.moveTo(x0 - 3, lip);
    c.lineTo(x0 - 1, 2);
    c.quadraticCurveTo(x0 + 2, -1, x0 + 8, 0);
    c.lineTo(x1 - 8, 0);
    c.quadraticCurveTo(x1 - 2, -1, x1 + 1, 2);
    c.lineTo(x1 + 3, lip);
    c.closePath();
  };
  cel(ctx, top, { base: J.stoneTop, shade: J.stoneTopShade, light: J.stoneTopLight, shadeOff: 0, rimOff: 3 });
  // slab joints
  ctx.strokeStyle = 'rgba(110,65,35,0.7)';
  ctx.lineWidth = 1.3;
  for (let x = 30 + r() * 40; x < b.w - 10; x += 50 + r() * 50) {
    ctx.beginPath();
    ctx.moveTo(x, 1);
    ctx.lineTo(x - 2, lip - 1);
    ctx.stroke();
  }
  // grass and moss tufts along the top edge
  for (let i = 0; i < b.w / 22; i++) {
    const gx = r() * b.w;
    if (r() < 0.55) {
      ctx.fillStyle = r() < 0.5 ? J.moss : '#9cc34a';
      ctx.beginPath();
      ctx.ellipse(gx, 1, 6 + r() * 10, 3 + r() * 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (r() < 0.4) {
      ctx.strokeStyle = r() < 0.5 ? '#6f9e34' : '#4d7d2a';
      ctx.lineWidth = 1.6;
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(gx + k * 2, 2);
        ctx.lineTo(gx + k * 2 + (r() - 0.5) * 6, -5 - r() * 7);
        ctx.stroke();
      }
    }
  }
  return cv;
}

/* ------------------------------------------------------------------ props */

export function paintFern(seed: number, size: number): HTMLCanvasElement {
  const [cv, ctx] = canvas(size * 2.4, size * 1.3);
  fernClump(ctx, size * 1.2, size * 1.3, size, rng(seed), J.midLeaf, J.midLeafShade, J.midLeafLight);
  return cv;
}

export function paintPalmProp(seed: number, height: number): HTMLCanvasElement {
  const [cv, ctx] = canvas(height * 1.5, height * 1.25);
  palm(ctx, height * 0.75, height * 1.25 - 2, height, (rng(seed)() - 0.5) * height * 0.4, rng(seed + 1));
  return cv;
}

/** Broken statue head / pillar stump to dress walkways. */
export function paintPillar(seed: number): HTMLCanvasElement {
  const [cv, ctx] = canvas(70, 150);
  const r = rng(seed);
  const h = 90 + r() * 50;
  const style = { base: J.ruin, shade: J.ruinShade, light: J.ruinLight, shadeOff: 6 };
  cel(ctx, (c) => poly(c, [14, 148, 14, 148 - h, 30, 148 - h - 10, 44, 148 - h + 6, 56, 148 - h, 56, 148]), style);
  cel(ctx, (c) => roundRect(c, 8, 136, 54, 14, 3), style);
  ctx.strokeStyle = 'rgba(70,55,40,0.5)';
  ctx.lineWidth = 1.3;
  for (let y = 148 - h + 22; y < 136; y += 20) {
    ctx.beginPath();
    ctx.moveTo(16, y);
    ctx.lineTo(54, y);
    ctx.stroke();
  }
  ctx.fillStyle = J.moss;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    circle(ctx, 16 + r() * 38, 148 - h + r() * 20, 4 + r() * 6);
    ctx.fill();
  }
  return cv;
}

/** Checkpoint totem: carved stone post with a beacon lamp. Two frames: idle / lit. */
export function paintBeacon(): HTMLCanvasElement {
  const [cv, ctx] = canvas(96, 110);
  for (let f = 0; f < 2; f++) {
    ctx.save();
    ctx.translate(f * 48, 0);
    cel(ctx, (c) => roundRect(c, 14, 30, 20, 78, 3), { base: J.ruin, shade: J.ruinShade, light: J.ruinLight });
    cel(ctx, (c) => roundRect(c, 8, 98, 32, 11, 3), { base: J.ruin, shade: J.ruinShade, light: J.ruinLight });
    ctx.fillStyle = 'rgba(70,55,40,0.6)';
    ctx.fillRect(18, 50, 12, 3);
    ctx.fillRect(18, 62, 12, 3);
    const lit = f === 1;
    ctx.save();
    if (lit) {
      ctx.shadowColor = '#7dfcff';
      ctx.shadowBlur = 16;
    }
    cel(ctx, (c) => circle(c, 24, 20, 11), { base: lit ? '#9ffcff' : '#4c6e70', light: lit ? '#ffffff' : '#7a9a9a' });
    ctx.restore();
    ctx.restore();
  }
  return cv;
}

/** Extraction flare at the stage end: a pole with an ember flag. */
export function paintFlag(): HTMLCanvasElement {
  const [cv, ctx] = canvas(80, 150);
  cel(ctx, (c) => roundRect(c, 10, 6, 7, 142, 3), { base: '#5a5e63', light: '#9aa0a6', shade: '#33363a' });
  cel(
    ctx,
    (c) => {
      c.moveTo(17, 10);
      c.quadraticCurveTo(45, 4, 74, 16);
      c.quadraticCurveTo(50, 26, 74, 40);
      c.quadraticCurveTo(45, 46, 17, 44);
      c.closePath();
    },
    { base: '#ff8a2e', shade: '#c8452f', light: '#ffc36a' },
  );
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  for (let i = 0; i < 3; i++) poly(ctx, [26 + i * 9, 20, 32 + i * 9, 27, 26 + i * 9, 34]);
  ctx.fill();
  return cv;
}
