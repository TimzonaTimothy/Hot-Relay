/**
 * PLACEHOLDER ART — paints the stage geometry into textures at boot, in the cel-shaded,
 * ink-outlined style of the characters: quay walls with grassy lips, shipping containers,
 * steel catwalks, moored pontoons and a muddy harbour bed.
 *
 * Each platform gets its own texture drawn at ART_RES pixels per world pixel (the world camera
 * zooms ×2, so this stays sharp). Collision is untouched: art is placed exactly over the
 * platform rectangles, with a little overhang above the top edge for grass and bollards.
 * Final art replaces this with Tiled tilesets (LEVEL-02); see ASSETS.md.
 */
import Phaser from 'phaser';
import { canvasTexture, INK, poly, roundRect, type Ctx } from './paint';
import { seeded } from '../ui/theme';
import type { PlatformDef, StageDef } from '../data/stages/types';

export const ART_RES = 2;
/** Art drawn above a platform's top edge (grass, bollards). */
const OVER = 8;

export interface PlacedArt {
  key: string;
  x: number;
  y: number;
  pontoon: boolean;
}

type Style = 'quay' | 'container' | 'bed' | 'catwalk' | 'pontoon';

function styleOf(p: PlatformDef, groundY: number): Style {
  if (p.pontoon) return 'pontoon';
  if (p.kind === 'oneway') return 'catwalk';
  if (p.y >= groundY + 60) return 'bed';
  if (p.y === groundY) return 'quay';
  return 'container';
}

export function paintStage(
  scene: Phaser.Scene,
  stage: StageDef,
  groundY: number,
  surfaceY: number,
): PlacedArt[] {
  const out: PlacedArt[] = [];
  stage.platforms.forEach((p, i) => {
    const style = styleOf(p, groundY);
    const key = `plat-${stage.id}-${i}`;
    const rnd = seeded(1000 + i * 17);
    const h = style === 'catwalk' ? p.h + 10 : style === 'pontoon' ? p.h + 12 : p.h;
    canvasTexture(scene, key, p.w, h + OVER, ART_RES, (c) => {
      c.translate(0, OVER);
      switch (style) {
        case 'quay':
          quay(c, p, surfaceY - p.y, rnd);
          break;
        case 'container':
          container(c, p, i);
          break;
        case 'bed':
          bed(c, p, rnd);
          break;
        case 'catwalk':
          catwalk(c, p);
          break;
        case 'pontoon':
          pontoon(c, p);
          break;
      }
    });
    out.push({ key, x: p.x, y: p.y - OVER, pontoon: style === 'pontoon' });
  });
  return out;
}

/** Concrete harbour wall with a grassy lip, panel seams, rust streaks and a wet waterline. */
function quay(c: Ctx, p: PlatformDef, waterline: number, rnd: () => number): void {
  const { w, h } = p;
  // face: lit top to dark bottom
  const grd = c.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, '#6e7a86');
  grd.addColorStop(0.18, '#56616d');
  grd.addColorStop(0.6, '#3c4550');
  grd.addColorStop(1, '#232a32');
  c.fillStyle = grd;
  c.fillRect(0, 0, w, h);
  // concrete courses
  c.strokeStyle = 'rgba(20,24,29,0.45)';
  c.lineWidth = 0.6;
  for (let y = 14; y < h; y += 16) {
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(w, y);
    c.stroke();
  }
  // panel seams with staggered offsets
  for (let x = 20 + rnd() * 10; x < w; x += 30 + rnd() * 14) {
    c.beginPath();
    c.moveTo(x, 4);
    c.lineTo(x + (rnd() - 0.5) * 2, h);
    c.stroke();
    // lit edge beside the seam
    c.strokeStyle = 'rgba(255,255,255,0.08)';
    c.beginPath();
    c.moveTo(x + 0.8, 4);
    c.lineTo(x + 0.8, h);
    c.stroke();
    c.strokeStyle = 'rgba(20,24,29,0.45)';
  }
  // speckle and chips
  for (let i = 0; i < w / 6; i++) {
    c.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.12)';
    c.fillRect(rnd() * w, 4 + rnd() * (h - 4), 1 + rnd() * 2, 0.8);
  }
  // rust streaks from bolts
  for (let x = 8 + rnd() * 20; x < w; x += 40 + rnd() * 50) {
    c.fillStyle = '#b8b0a0';
    c.beginPath();
    c.arc(x, 7, 0.9, 0, Math.PI * 2);
    c.fill();
    const g2 = c.createLinearGradient(0, 8, 0, 30);
    g2.addColorStop(0, 'rgba(150,70,30,0.45)');
    g2.addColorStop(1, 'rgba(150,70,30,0)');
    c.fillStyle = g2;
    c.fillRect(x - 0.8, 8, 1.6 + rnd(), 18 + rnd() * 10);
  }
  // wet band and algae at the waterline
  if (waterline > 0 && waterline < h) {
    c.fillStyle = 'rgba(10,25,30,0.45)';
    c.fillRect(0, waterline - 3, w, h - waterline + 3);
    c.fillStyle = 'rgba(70,110,50,0.75)';
    c.beginPath();
    c.moveTo(0, waterline - 2);
    for (let x = 0; x <= w; x += 3)
      c.lineTo(x, waterline - 2 + Math.sin(x * 0.7) * 0.8 + rnd() * 2.5);
    c.lineTo(w, waterline + 1);
    c.lineTo(0, waterline + 1);
    c.closePath();
    c.fill();
  }
  // bevelled side edges where the wall drops into water or a channel
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.fillRect(0, 2, 1.5, h);
  c.fillRect(w - 1.5, 2, 1.5, h);
  // top walkway lip
  c.fillStyle = '#8c98a4';
  c.fillRect(0, 0, w, 3);
  c.fillStyle = '#b5bec7';
  c.fillRect(0, 0, w, 1);
  c.fillStyle = INK;
  c.fillRect(0, 3, w, 0.7);
  // hazard paint at the very edges
  c.fillStyle = '#ffd23f';
  for (const ex of [1.5, w - 7.5])
    for (let k = 0; k < 3; k += 2) c.fillRect(ex + k * 2, 3.7, 1.6, 1.2);
  // bollards and grass along the lip (drawn into the overhang above the top)
  for (let x = 30 + rnd() * 40; x < w - 10; x += 110 + rnd() * 120) bollard(c, x);
  grass(c, w, rnd);
}

function bollard(c: Ctx, x: number): void {
  roundRect(c, x - 2.4, -5, 4.8, 5.5, 1.4);
  c.fillStyle = '#2b3138';
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = 0.5;
  c.stroke();
  c.fillStyle = '#58626d';
  c.fillRect(x - 1.6, -4.6, 1.2, 4.6);
  roundRect(c, x - 3.2, -6.4, 6.4, 1.8, 0.8);
  c.fillStyle = '#353c44';
  c.fill();
  c.stroke();
}

/** Clumps of grass and weeds breaking through the lip. */
function grass(c: Ctx, w: number, rnd: () => number): void {
  for (let x = rnd() * 12; x < w; x += 6 + rnd() * 26) {
    const clump = 2 + Math.floor(rnd() * 4);
    for (let k = 0; k < clump; k++) {
      const bx = x + (rnd() - 0.5) * 4;
      const len = 2 + rnd() * 5;
      const lean = (rnd() - 0.5) * 3;
      c.fillStyle =
        ['#3f6b2a', '#5d8f37', '#4c7d2f', '#79a84a'][Math.floor(rnd() * 4)] ?? '#4c7d2f';
      c.beginPath();
      c.moveTo(bx - 0.8, 0.5);
      c.quadraticCurveTo(bx + lean * 0.5, -len * 0.6, bx + lean, -len);
      c.quadraticCurveTo(bx + lean * 0.3 + 0.6, -len * 0.4, bx + 0.9, 0.5);
      c.closePath();
      c.fill();
    }
  }
}

const CONTAINER_PAINT: Array<[string, string, string]> = [
  ['#a4452f', '#7a2f20', '#c9644a'],
  ['#2f7a73', '#1f5450', '#4b9c94'],
  ['#36598c', '#253f66', '#5378ad'],
];

/** Shipping container or crate stack, corrugated, cel-shaded. */
function container(c: Ctx, p: PlatformDef, i: number): void {
  const [base, dark, light] = CONTAINER_PAINT[i % CONTAINER_PAINT.length] ?? CONTAINER_PAINT[0]!;
  const { w, h } = p;
  roundRect(c, 0.3, 0.3, w - 0.6, h - 0.3, 1);
  c.fillStyle = base;
  c.fill();
  // corrugation
  for (let x = 3; x < w - 2; x += 3.2) {
    c.fillStyle = dark;
    c.fillRect(x, 3, 1, h - 5);
    c.fillStyle = light;
    c.fillRect(x + 1, 3, 0.5, h - 5);
  }
  // shade the lower half
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.35)');
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  // top rail and corner posts
  c.fillStyle = light;
  c.fillRect(0, 0, w, 2.2);
  c.fillStyle = dark;
  c.fillRect(0, 0, 2.2, h);
  c.fillRect(w - 2.2, 0, 2.2, h);
  c.fillStyle = '#e9e2d0';
  c.globalAlpha = 0.5;
  c.fillRect(w * 0.25, h * 0.45, w * 0.3, 1.2);
  c.globalAlpha = 1;
  roundRect(c, 0.3, 0.3, w - 0.6, h - 0.3, 1);
  c.strokeStyle = INK;
  c.lineWidth = 0.7;
  c.stroke();
}

/** Muddy harbour bed with stones and debris. */
function bed(c: Ctx, p: PlatformDef, rnd: () => number): void {
  const { w, h } = p;
  c.fillStyle = '#2a2a22';
  c.fillRect(0, 0, w, h);
  c.fillStyle = '#3d3a2c';
  c.beginPath();
  c.moveTo(0, 2);
  for (let x = 0; x <= w; x += 4) c.lineTo(x, 1 + rnd() * 2);
  c.lineTo(w, h);
  c.lineTo(0, h);
  c.closePath();
  c.fill();
  for (let i = 0; i < w / 10; i++) {
    const x = rnd() * w;
    const r = 0.8 + rnd() * 2;
    c.fillStyle = rnd() > 0.5 ? '#4f4b3c' : '#5d5a49';
    c.beginPath();
    c.ellipse(x, 2 + rnd() * 2, r * 1.4, r, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 0.3;
    c.stroke();
  }
  // weeds swaying up from the bed (static)
  for (let x = rnd() * 20; x < w; x += 14 + rnd() * 30) {
    c.strokeStyle = 'rgba(80,120,60,0.8)';
    c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(x, 2);
    c.quadraticCurveTo(x + 3, -6, x - 1, -7);
    c.stroke();
  }
}

/** Steel catwalk: grated deck with a truss underneath. */
function catwalk(c: Ctx, p: PlatformDef): void {
  const { w } = p;
  c.fillStyle = '#5a6675';
  c.fillRect(0, 0, w, 3);
  c.fillStyle = '#a6b2bf';
  c.fillRect(0, 0, w, 1);
  c.fillStyle = '#2b3442';
  for (let x = 1; x < w; x += 2.5) c.fillRect(x, 1, 0.8, 2);
  c.strokeStyle = '#3a4554';
  c.lineWidth = 1;
  c.beginPath();
  for (let x = 0; x < w; x += 10) {
    c.moveTo(x, 3.5);
    c.lineTo(x + 5, 10);
    c.lineTo(x + 10, 3.5);
  }
  c.stroke();
  c.fillStyle = '#3a4554';
  c.fillRect(0, 9.5, w, 1.2);
  c.strokeStyle = INK;
  c.lineWidth = 0.6;
  c.strokeRect(0, 0, w, 3);
}

/** Moored pontoon: plank deck over orange floats (the floats sit in the water). */
function pontoon(c: Ctx, p: PlatformDef): void {
  const { w } = p;
  for (let x = 4; x < w - 6; x += 14) {
    roundRect(c, x, 4, 11, 10, 4.5);
    c.fillStyle = '#e0702e';
    c.fill();
    c.fillStyle = '#b4521c';
    c.fillRect(x + 1, 10, 9, 3);
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.fillRect(x + 2.5, 5.5, 5, 1);
    roundRect(c, x, 4, 11, 10, 4.5);
    c.strokeStyle = INK;
    c.lineWidth = 0.6;
    c.stroke();
  }
  for (let x = 0; x < w; x += 6) {
    poly(c, [
      [x, 0],
      [x + 5.6, 0],
      [x + 5.6, 4],
      [x, 4],
    ]);
    c.fillStyle = x % 12 === 0 ? '#8a6a44' : '#7a5c3a';
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 0.4;
    c.stroke();
  }
  c.fillStyle = '#b08a5c';
  c.fillRect(0, 0, w, 0.8);
}
