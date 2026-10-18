/**
 * PLACEHOLDER art for the touch buttons, in the HUD's "dusk harbour ops" style (see theme.ts):
 * angular hexagonal plates in dark gunmetal with a coloured edge and a flat glowing icon.
 * Each button has an idle and a lit (pressed) texture: `touch-<name>-<r>` / `...-on`.
 */
import Phaser from 'phaser';

export type TouchIcon = 'reticle' | 'chevrons' | 'magnifier' | 'swap' | 'ammo';

export interface ButtonLook {
  icon: TouchIcon;
  /** Edge, icon and glow colour. */
  color: string;
}

export const BUTTON_LOOKS = {
  fire: { icon: 'reticle', color: '#ff7a1f' }, // ember: the game's single accent
  jump: { icon: 'chevrons', color: '#35d0c8' }, // teal; two chevrons = double jump
  zoom: { icon: 'magnifier', color: '#5ab0ff' }, // steel blue
  swap: { icon: 'swap', color: '#7ed957' }, // lime: the relay hand-off
  weapon: { icon: 'ammo', color: '#c9d4e0' }, // pale steel
} satisfies Record<string, ButtonLook>;

export type ButtonName = keyof typeof BUTTON_LOOKS;

/** Paint (once) both states and return the idle and lit texture keys. */
export function touchButtonTextures(
  scene: Phaser.Scene,
  name: ButtonName,
  r: number,
): { idle: string; lit: string } {
  const idle = `touch-${name}-${r}`;
  const lit = `${idle}-on`;
  if (!scene.textures.exists(idle)) paint(scene, idle, BUTTON_LOOKS[name], r, false);
  if (!scene.textures.exists(lit)) paint(scene, lit, BUTTON_LOOKS[name], r, true);
  return { idle, lit };
}

/** Pointy-top hexagon with softly rounded corners. */
function hexPath(c: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  const round = r * 0.14;
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    const [x0, y0] = pts[(i + 5) % 6]!;
    const [x1, y1] = pts[i]!;
    const [x2, y2] = pts[(i + 1) % 6]!;
    const m0x = x1 + ((x0 - x1) / r) * round;
    const m0y = y1 + ((y0 - y1) / r) * round;
    const m1x = x1 + ((x2 - x1) / r) * round;
    const m1y = y1 + ((y2 - y1) / r) * round;
    if (i === 0) c.moveTo(m0x, m0y);
    else c.lineTo(m0x, m0y);
    c.quadraticCurveTo(x1, y1, m1x, m1y);
  }
  c.closePath();
}

function paint(scene: Phaser.Scene, key: string, look: ButtonLook, r: number, lit: boolean): void {
  const pad = 10;
  const size = Math.ceil((r + pad) * 2);
  const tex = scene.textures.createCanvas(key, size, size);
  if (!tex) return;
  const c = tex.getContext();
  const cx = size / 2;
  const cy = size / 2;
  const col = look.color;

  // outer glow (stronger when pressed)
  c.save();
  c.shadowColor = col;
  c.shadowBlur = lit ? 16 : 6;
  hexPath(c, cx, cy, r);
  c.fillStyle = 'rgba(7,11,17,0.01)';
  c.fill();
  c.restore();

  // plate: gunmetal, or filled with the colour when pressed
  hexPath(c, cx, cy, r);
  const g = c.createLinearGradient(0, cy - r, 0, cy + r);
  if (lit) {
    g.addColorStop(0, col);
    g.addColorStop(1, shade(col, 0.45));
  } else {
    g.addColorStop(0, 'rgba(43,57,74,0.82)');
    g.addColorStop(1, 'rgba(13,21,32,0.88)');
  }
  c.fillStyle = g;
  c.fill();

  // inner bevel line and the coloured edge
  hexPath(c, cx, cy, r - 5);
  c.strokeStyle = lit ? 'rgba(255,255,255,0.35)' : 'rgba(143,163,184,0.25)';
  c.lineWidth = 1.5;
  c.stroke();
  hexPath(c, cx, cy, r);
  c.strokeStyle = col;
  c.lineWidth = 3.5;
  c.stroke();
  // corner ticks top-left/bottom-right: a small "tactical" detail
  c.fillStyle = col;
  c.fillRect(cx - r * 0.9, cy - r * 0.62, 5, 2);
  c.fillRect(cx + r * 0.9 - 5, cy + r * 0.62 - 2, 5, 2);

  // icon
  c.save();
  c.translate(cx, cy);
  c.scale(r / 44, r / 44);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  const ink = lit ? '#070b11' : col;
  if (!lit) {
    c.shadowColor = col;
    c.shadowBlur = 8;
  }
  c.strokeStyle = ink;
  c.fillStyle = ink;
  drawIcon(c, look.icon);
  c.restore();
  tex.refresh();
}

/** Icons on an ~80 px grid centred on 0,0. */
function drawIcon(c: CanvasRenderingContext2D, icon: TouchIcon): void {
  c.lineWidth = 5;
  switch (icon) {
    case 'reticle':
      c.beginPath();
      c.arc(0, 0, 16, 0, Math.PI * 2);
      c.stroke();
      c.beginPath();
      for (const [dx, dy] of [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ] as const) {
        c.moveTo(dx * 9, dy * 9);
        c.lineTo(dx * 25, dy * 25);
      }
      c.stroke();
      c.beginPath();
      c.arc(0, 0, 3.5, 0, Math.PI * 2);
      c.fill();
      break;
    case 'chevrons':
      c.lineWidth = 7;
      c.beginPath();
      for (const y of [-6, 12]) {
        c.moveTo(-17, y + 9);
        c.lineTo(0, y - 8);
        c.lineTo(17, y + 9);
      }
      c.stroke();
      break;
    case 'magnifier':
      c.beginPath();
      c.arc(-5, -5, 15, 0, Math.PI * 2);
      c.stroke();
      c.lineWidth = 7;
      c.beginPath();
      c.moveTo(6, 6);
      c.lineTo(20, 20);
      c.stroke();
      // ± inside the lens: zoom in and out
      c.lineWidth = 3.5;
      c.beginPath();
      c.moveTo(-11, -9);
      c.lineTo(1, -9);
      c.moveTo(-5, -15);
      c.lineTo(-5, -3);
      c.moveTo(-11, 1);
      c.lineTo(1, 1);
      c.stroke();
      break;
    case 'swap':
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(-18, -7);
      c.lineTo(16, -7);
      c.moveTo(18, 7);
      c.lineTo(-16, 7);
      c.stroke();
      c.beginPath();
      c.moveTo(20, -7);
      c.lineTo(9, -15);
      c.lineTo(9, 1);
      c.closePath();
      c.moveTo(-20, 7);
      c.lineTo(-9, -1);
      c.lineTo(-9, 15);
      c.closePath();
      c.fill();
      break;
    case 'ammo':
      c.beginPath();
      c.moveTo(-8, 22);
      c.lineTo(-8, -4);
      c.quadraticCurveTo(-8, -22, 0, -26);
      c.quadraticCurveTo(8, -22, 8, -4);
      c.lineTo(8, 22);
      c.closePath();
      c.stroke();
      c.beginPath();
      c.moveTo(-8, 10);
      c.lineTo(8, 10);
      c.stroke();
      break;
  }
}

/** Darken a #rrggbb colour by `k` (0..1). */
function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s: number) => Math.round(((n >> s) & 255) * (1 - k));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
