/**
 * Visual identity for menus and HUD: "dusk harbour ops".
 * Gunmetal navy surfaces, ember orange (muzzle flash) as the single accent, signal yellow
 * for alerts, slanted plates for forward motion. Display: Black Ops One (stencil).
 * HUD numbers and labels: Teko (condensed). Menus and body: Chakra Petch.
 */
import Phaser from 'phaser';

export const PALETTE = {
  ink: 0x070b11,
  navy: 0x0d1520,
  gunmetal: 0x18222f,
  steel: 0x2b394a,
  steelHi: 0x8fa3b8,
  bone: 0xeae4d6,
  ember: 0xff7a1f,
  emberHi: 0xffb347,
  signal: 0xffd23f,
  alert: 0xff3b30,
  ok: 0x7ed957,
  armour: 0x5ab0ff,
  hp: 0xff5a36,
  hpEmpty: 0x3a1c18,
  armourEmpty: 0x1a2c3e,
} as const;

export const CSSC = {
  ink: '#070b11',
  bone: '#eae4d6',
  muted: '#8fa3b8',
  dim: '#5b6b7d',
  ember: '#ff7a1f',
  emberHi: '#ffb347',
  signal: '#ffd23f',
  alert: '#ff3b30',
  ok: '#7ed957',
} as const;

export const FONTS = {
  display: '"Black Ops One", Impact, "Arial Black", sans-serif',
  hud: 'Teko, "Arial Narrow", Impact, sans-serif',
  body: '"Chakra Petch", "Segoe UI", Roboto, sans-serif',
} as const;

type Kind = 'display' | 'hud' | 'body';

export function txt(
  kind: Kind,
  size: number,
  color: string = CSSC.bone,
  extra: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONTS[kind],
    fontSize: `${size}px`,
    color,
    fontStyle: kind === 'body' ? '600' : kind === 'hud' ? '600' : 'normal',
    // Teko sits high in its line box; padding stops ascenders being clipped
    padding: kind === 'hud' ? { top: Math.ceil(size * 0.18), bottom: 2 } : { top: 2, bottom: 2 },
    ...extra,
  };
}

/** Hex colour number to CSS string. */
export const css = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

export interface PlateOpts {
  skew?: number;
  fill?: number;
  fillAlpha?: number;
  stroke?: number;
  strokeAlpha?: number;
  lineWidth?: number;
}

/** Slanted parallelogram panel; (x, y) is the top-left of its bounding box. */
export function plate(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  o: PlateOpts = {},
): void {
  const s = o.skew ?? Math.round(h * 0.35);
  const pts = [
    new Phaser.Math.Vector2(x + s, y),
    new Phaser.Math.Vector2(x + w, y),
    new Phaser.Math.Vector2(x + w - s, y + h),
    new Phaser.Math.Vector2(x, y + h),
  ];
  if (o.fill !== undefined) {
    g.fillStyle(o.fill, o.fillAlpha ?? 1);
    g.fillPoints(pts, true);
  }
  if (o.stroke !== undefined) {
    g.lineStyle(o.lineWidth ?? 2, o.stroke, o.strokeAlpha ?? 1);
    g.strokePoints(pts, true);
  }
}

/** Segmented gauge (health, armour). Each segment is a small slanted cell. */
export function segments(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  count: number,
  filled: number,
  cellW: number,
  cellH: number,
  on: number,
  off: number,
  gap = 3,
): void {
  for (let i = 0; i < count; i++) {
    plate(g, x + i * (cellW + gap), y, cellW, cellH, {
      skew: Math.min(4, cellH * 0.4),
      fill: i < filled ? on : off,
    });
    if (i < filled) {
      // bevel highlight on lit cells
      g.fillStyle(0xffffff, 0.28);
      g.fillRect(x + i * (cellW + gap) + 3, y + 1, cellW - 5, 2);
    }
  }
}

/** Double chevron ">>" drawn as filled arrows; fraction fills from the left. */
export function chevrons(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  size: number,
  count: number,
  frac: number,
  on: number,
  off: number,
): void {
  const lit = Math.floor(frac * count + 1e-6);
  for (let i = 0; i < count; i++) {
    const cx = x + i * size * 0.75;
    g.fillStyle(i < lit ? on : off, 1);
    g.fillPoints(
      [
        new Phaser.Math.Vector2(cx, y),
        new Phaser.Math.Vector2(cx + size * 0.45, y),
        new Phaser.Math.Vector2(cx + size * 0.85, y + size / 2),
        new Phaser.Math.Vector2(cx + size * 0.45, y + size),
        new Phaser.Math.Vector2(cx, y + size),
        new Phaser.Math.Vector2(cx + size * 0.4, y + size / 2),
      ],
      true,
    );
  }
}

/** Metallic fill for a display headline: bone at the top, ember at the bottom. */
export function metalFill(
  t: Phaser.GameObjects.Text,
  top = '#fff6e3',
  mid = '#ffd08a',
  bottom = '#ff6a1a',
): void {
  const ctx = t.context;
  const h = t.height || 100;
  const grd = ctx.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, top);
  grd.addColorStop(0.48, mid);
  grd.addColorStop(0.52, bottom);
  grd.addColorStop(1, '#a8320c');
  t.setFill(grd);
}

/** A seeded random generator so procedural art is identical on every load. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
