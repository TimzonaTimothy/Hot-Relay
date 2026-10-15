/** Canvas helpers for the painted placeholder art. No Phaser here. */

export type Ctx = CanvasRenderingContext2D;

export function canvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  return [c, ctx];
}

/** Deterministic RNG so the art is the same on every load. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const INK = '#1d1a17';

export interface CelStyle {
  base: string;
  shade?: string;
  light?: string;
  /** Shadow offset: the part not covered by the shape shifted toward the light becomes shadow. */
  shadeOff?: number;
  rimOff?: number;
  outline?: string | null;
  lw?: number;
}

/**
 * Cel-shaded fill with an ink outline: base colour, a lower-left shadow crescent and an
 * upper-right rim light (light comes from the upper right, like the reference).
 */
export function cel(ctx: Ctx, path: (c: Ctx) => void, s: CelStyle): void {
  ctx.save();
  ctx.beginPath();
  path(ctx);
  ctx.fillStyle = s.base;
  ctx.fill();
  ctx.clip();
  if (s.shade) {
    const o = s.shadeOff ?? 3;
    ctx.beginPath();
    ctx.rect(-1e4, -1e4, 2e4, 2e4);
    ctx.save();
    ctx.translate(o, -o);
    path(ctx);
    ctx.restore();
    ctx.fillStyle = s.shade;
    ctx.fill('evenodd');
  }
  if (s.light) {
    const o = s.rimOff ?? 1.5;
    ctx.beginPath();
    ctx.rect(-1e4, -1e4, 2e4, 2e4);
    ctx.save();
    ctx.translate(-o, o);
    path(ctx);
    ctx.restore();
    ctx.fillStyle = s.light;
    ctx.fill('evenodd');
  }
  ctx.restore();
  if (s.outline !== null) {
    ctx.beginPath();
    path(ctx);
    ctx.strokeStyle = s.outline ?? INK;
    ctx.lineWidth = s.lw ?? 2;
    ctx.stroke();
  }
}

/** Round-capped segment from A to B with radius r. */
export function capsule(c: Ctx, ax: number, ay: number, bx: number, by: number, r: number): void {
  const a = Math.atan2(by - ay, bx - ax);
  c.moveTo(ax + Math.cos(a + Math.PI / 2) * r, ay + Math.sin(a + Math.PI / 2) * r);
  c.arc(ax, ay, r, a + Math.PI / 2, a - Math.PI / 2);
  c.arc(bx, by, r, a - Math.PI / 2, a + Math.PI / 2);
  c.closePath();
}

export function roundRect(c: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}

export function poly(c: Ctx, pts: number[]): void {
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath();
}

export function circle(c: Ctx, x: number, y: number, r: number): void {
  c.moveTo(x + r, y);
  c.arc(x, y, r, 0, Math.PI * 2);
}

/** Draw `fn` at x and x±width so a layer tiles horizontally without seams. */
export function wrapX(width: number, x: number, span: number, fn: (x: number) => void): void {
  fn(x);
  if (x - span < 0) fn(x + width);
  if (x + span > width) fn(x - width);
}

export function hex(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}

/** Mix two #rrggbb colours. */
export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return '#' + ((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0');
}

/** A sprite strip: frames laid out left to right, all the same size. */
export interface Strip {
  canvas: HTMLCanvasElement;
  frameW: number;
  frameH: number;
  names: string[];
}
