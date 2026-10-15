/**
 * Small canvas toolkit for the cel-shaded illustrated look: outlined shapes, two-tone shading,
 * leaves, clouds. All art is drawn once into textures at boot; nothing here runs per frame.
 */
import Phaser from 'phaser';

export type Ctx = CanvasRenderingContext2D;
export type Pt = [number, number];

export const INK = '#14181d';

/** Create a canvas texture once and draw into it with a scale so callers work in their own units. */
export function canvasTexture(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  scale: number,
  draw: (ctx: Ctx) => void,
): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, Math.ceil(w * scale), Math.ceil(h * scale));
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.save();
  ctx.scale(scale, scale);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  draw(ctx);
  ctx.restore();
  tex.refresh();
}

export function poly(ctx: Ctx, pts: Pt[]): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Fill the current path, then outline it. */
export function inked(ctx: Ctx, fill: string, line = 0.8, stroke = INK): void {
  ctx.fillStyle = fill;
  ctx.fill();
  if (line > 0) {
    ctx.lineWidth = line;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

/** Shade the lower/back part of the current path (call right after building the path). */
export function shadeBelow(
  ctx: Ctx,
  color: string,
  fromY: number,
  toY: number,
  x0 = -999,
  x1 = 999,
): void {
  ctx.save();
  ctx.clip();
  ctx.fillStyle = color;
  ctx.fillRect(x0, fromY, x1 - x0, toY - fromY);
  ctx.restore();
}

/** Light rim along the top edge of a shape. */
export function rimTop(
  ctx: Ctx,
  x0: number,
  x1: number,
  y: number,
  color: string,
  width = 0.6,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.stroke();
}

/** Pointed leaf from (x, y) along angle `a`, with a centre vein and shaded half. */
export function leaf(
  ctx: Ctx,
  x: number,
  y: number,
  len: number,
  wid: number,
  a: number,
  fill: string,
  shade: string,
  line = 0,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.45, -wid, len, 0);
  ctx.quadraticCurveTo(len * 0.45, wid, 0, 0);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.45, wid, len, 0);
  ctx.closePath();
  ctx.fillStyle = shade;
  ctx.fill();
  if (line > 0) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.45, -wid, len, 0);
    ctx.quadraticCurveTo(len * 0.45, wid, 0, 0);
    ctx.lineWidth = line;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
  ctx.restore();
}

/** Palm frond: a curved spine with leaflets along it. */
export function frond(
  ctx: Ctx,
  x: number,
  y: number,
  len: number,
  a: number,
  droop: number,
  fill: string,
  shade: string,
): void {
  const steps = 14;
  let px = x;
  let py = y;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const ang = a + droop * t * t;
    const nx = px + Math.cos(ang) * (len / steps);
    const ny = py + Math.sin(ang) * (len / steps);
    const ll = len * 0.32 * Math.sin(Math.PI * Math.min(1, t + 0.15));
    leaf(ctx, nx, ny, ll, ll * 0.18, ang - 1.0, fill, shade);
    leaf(ctx, nx, ny, ll, ll * 0.18, ang + 1.0, shade, fill);
    px = nx;
    py = ny;
  }
  ctx.strokeStyle = shade;
  ctx.lineWidth = len * 0.025;
  ctx.beginPath();
  ctx.moveTo(x, y);
  let sx = x;
  let sy = y;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const ang = a + droop * t * t;
    sx += Math.cos(ang) * (len / steps);
    sy += Math.sin(ang) * (len / steps);
    ctx.lineTo(sx, sy);
  }
  ctx.stroke();
}

/** Puffy cumulus cloud with a shaded underside. */
export function cloud(ctx: Ctx, x: number, y: number, w: number, rnd: () => number): void {
  const puffs = 7;
  const draw = (color: string, dy: number) => {
    ctx.fillStyle = color;
    for (let i = 0; i < puffs; i++) {
      const t = i / (puffs - 1);
      const r = w * (0.12 + 0.12 * Math.sin(Math.PI * t) + rnd() * 0.04);
      ctx.beginPath();
      ctx.arc(x + t * w, y - Math.sin(Math.PI * t) * w * 0.12 + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  draw('rgba(160,196,214,0.9)', w * 0.05);
  draw('rgba(255,255,255,0.97)', 0);
}

export function lerpColor(a: string, b: string, t: number): string {
  const pa = Phaser.Display.Color.HexStringToColor(a);
  const pb = Phaser.Display.Color.HexStringToColor(b);
  const r = Math.round(pa.red + (pb.red - pa.red) * t);
  const g = Math.round(pa.green + (pb.green - pa.green) * t);
  const bl = Math.round(pa.blue + (pb.blue - pa.blue) * t);
  return `rgb(${r},${g},${bl})`;
}
