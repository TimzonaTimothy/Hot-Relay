/**
 * Cut-out character parts (head, torso, leg, gun arm) drawn as cel-shaded illustrations.
 * A Rig assembles and animates them. Units are world pixels; textures are drawn at PART_RES
 * pixels per world pixel so they stay sharp when shown larger (title and squad screens).
 * An artist can later replace each texture with a painted part using the same pivots.
 *
 * Art direction: heroic action-game cast — broad V-shaped torsos, big hair, chunky guns and a
 * strong personal silhouette per operator, rather than matching military uniforms. Every design
 * here is original to Hot Relay.
 */
import Phaser from 'phaser';
import { inked, poly, rimTop, roundRect, shadeBelow, type Ctx } from './paint';
import { OPERATORS } from '../data/operators';
import type { WeaponId } from '../data/weapons';

export const PART_RES = 6;

export type RigId =
  | 'kemi'
  | 'rurik'
  | 'meilin'
  | 'tari'
  | 'tomas'
  | 'farida'
  | 'sione'
  | 'kai7'
  | 'contractor';

/** Colours and build of one character. */
export interface Look {
  skin: string;
  skinShade: string;
  hair: string;
  /** Main upper garment (jacket, vest, suit, armour). */
  top: string;
  topShade: string;
  /** Second garment / undershirt / panels. */
  trim: string;
  pants: string;
  pantsShade: string;
  boot: string;
  bootTrim: string;
  glove: string;
  /** Operator colour: bands, stripes, lenses. */
  accent: string;
  /** What the upper and fore arm show. */
  sleeve: 'skin' | 'top' | 'armour';
  /** Torso width multiplier (1 = athletic). */
  build: number;
}

export const LOOKS: Record<RigId, Look> = {
  kemi: {
    skin: '#7a4528',
    skinShade: '#5a311b',
    hair: '#1a0f0a',
    top: '#f08a24',
    topShade: '#b85f12',
    trim: '#1d2229',
    pants: '#2e5e5a',
    pantsShade: '#1f413e',
    boot: '#f4efe6',
    bootTrim: '#f08a24',
    glove: '#1d2229',
    accent: '#f2a541',
    sleeve: 'top',
    build: 0.94,
  },
  rurik: {
    skin: '#e4b393',
    skinShade: '#c08a6a',
    hair: '#b0642c',
    top: '#3f6ea8',
    topShade: '#2a4c78',
    trim: '#26303b',
    pants: '#34404f',
    pantsShade: '#232c37',
    boot: '#1f2328',
    bootTrim: '#5aa9e6',
    glove: '#2a2f36',
    accent: '#5aa9e6',
    sleeve: 'skin',
    build: 1.18,
  },
  meilin: {
    skin: '#e3b48f',
    skinShade: '#c39270',
    hair: '#111114',
    top: '#2f6a46',
    topShade: '#1f4a30',
    trim: '#1a2420',
    pants: '#1f3a2b',
    pantsShade: '#14261c',
    boot: '#15191b',
    bootTrim: '#9bd36a',
    glove: '#15191b',
    accent: '#9bd36a',
    sleeve: 'top',
    build: 0.9,
  },
  tari: {
    skin: '#5a3420',
    skinShade: '#3f2314',
    hair: '#1b120c',
    top: '#15191d',
    topShade: '#0b0e11',
    trim: '#2ec4b6',
    pants: '#15191d',
    pantsShade: '#0b0e11',
    boot: '#16756c',
    bootTrim: '#2ec4b6',
    glove: '#15191d',
    accent: '#2ec4b6',
    sleeve: 'top',
    build: 0.98,
  },
  tomas: {
    skin: '#a06d47',
    skinShade: '#7e5232',
    hair: '#24170f',
    top: '#4a5a6a',
    topShade: '#333f4b',
    trim: '#d8d2c4',
    pants: '#5b4a36',
    pantsShade: '#3f3325',
    boot: '#3a2a1c',
    bootTrim: '#f2d13a',
    glove: '#e0b52f',
    accent: '#f2d13a',
    sleeve: 'skin',
    build: 1.08,
  },
  farida: {
    skin: '#b07650',
    skinShade: '#8a5937',
    hair: '#24140c',
    top: '#b8352a',
    topShade: '#7e1f17',
    trim: '#e8dcc4',
    pants: '#7a6448',
    pantsShade: '#5a4933',
    boot: '#2e221a',
    bootTrim: '#e0533d',
    glove: '#e8dcc4',
    accent: '#e0533d',
    sleeve: 'skin',
    build: 0.95,
  },
  sione: {
    skin: '#7a4a2c',
    skinShade: '#5a341d',
    hair: '#140e0a',
    top: '#6b4fb0',
    topShade: '#4a3480',
    trim: '#2a2440',
    pants: '#2b3346',
    pantsShade: '#1d2331',
    boot: '#1c1b22',
    bootTrim: '#b48cff',
    glove: '#2a2440',
    accent: '#b48cff',
    sleeve: 'top',
    build: 1.24,
  },
  kai7: {
    skin: '#dfe6ec',
    skinShade: '#a9b6c2',
    hair: '#1b5f6b',
    top: '#eef3f6',
    topShade: '#b4c1cc',
    trim: '#2a3440',
    pants: '#2a3440',
    pantsShade: '#1a222b',
    boot: '#dfe6ec',
    bootTrim: '#7ff3ff',
    glove: '#2a3440',
    accent: '#7ff3ff',
    sleeve: 'armour',
    build: 1.14,
  },
  contractor: {
    skin: '#5e636c',
    skinShade: '#3f434b',
    hair: '#2a2d33',
    top: '#565a63',
    topShade: '#373a41',
    trim: '#2d3036',
    pants: '#2d3036',
    pantsShade: '#1d1f23',
    boot: '#18191c',
    bootTrim: '#2a2d33',
    glove: '#2a2723',
    accent: '#e0452f',
    sleeve: 'top',
    build: 1,
  },
};

/** Part frame sizes and pivots, in world units. Heads and torsos have room for hair and shoulders. */
export const PARTS = {
  leg: { w: 10, h: 15, px: 3.5, py: 1.5 },
  torso: { w: 22, h: 17, px: 11, py: 14 },
  head: { w: 18, h: 16, px: 9.5, py: 14 },
  arm: { w: 30, h: 12, px: 3, py: 6 },
} as const;

const L = 0.55; // outline width in world units (≈1.6 screen px in game)

/** Which arm textures each rig needs: the operator's own two weapons, or the contractor rifle. */
function weaponsFor(id: RigId): WeaponId[] {
  if (id === 'contractor') return ['contractorRifle'];
  return OPERATORS.find((o) => o.rig === id)?.weapons ?? ['p9'];
}

export const armKey = (id: RigId, weapon: WeaponId) => `${id}-arm-${weapon}`;

/** All rig parts live in one atlas texture, so every character draws in a single batch. */
export const RIG_ATLAS = 'rigs';

type PartDims = { w: number; h: number; px: number; py: number };

export function generateCharacterParts(scene: Phaser.Scene): void {
  if (scene.textures.exists(RIG_ATLAS)) return;
  const jobs: Array<{ row: number; name: string; d: PartDims; draw: (c: Ctx) => void }> = [];
  (Object.keys(LOOKS) as RigId[]).forEach((id, row) => {
    const k = LOOKS[id];
    jobs.push({ row, name: `${id}-leg`, d: PARTS.leg, draw: (c) => leg(c, k, false, id) });
    jobs.push({ row, name: `${id}-legB`, d: PARTS.leg, draw: (c) => leg(c, k, true, id) });
    jobs.push({ row, name: `${id}-torso`, d: PARTS.torso, draw: (c) => torso(c, k, id) });
    jobs.push({ row, name: `${id}-head`, d: PARTS.head, draw: (c) => head(c, k, id) });
    for (const w of weaponsFor(id))
      jobs.push({ row, name: armKey(id, w), d: PARTS.arm, draw: (c) => arm(c, k, w, id) });
  });

  // shelf-pack: one row per character, 2 px gutters so filtering never bleeds between parts
  const GAP = 2;
  const rowH = Math.ceil(Math.max(...Object.values(PARTS).map((d) => d.h)) * PART_RES) + GAP;
  const placed: Array<{
    name: string;
    x: number;
    y: number;
    w: number;
    h: number;
    d: PartDims;
    draw: (c: Ctx) => void;
  }> = [];
  const cursor = new Map<number, number>();
  let width = 0;
  let rows = 0;
  for (const j of jobs) {
    const w = Math.ceil(j.d.w * PART_RES);
    const h = Math.ceil(j.d.h * PART_RES);
    const x = cursor.get(j.row) ?? GAP;
    placed.push({ name: j.name, x, y: GAP + j.row * rowH, w, h, d: j.d, draw: j.draw });
    cursor.set(j.row, x + w + GAP);
    width = Math.max(width, x + w + GAP);
    rows = Math.max(rows, j.row + 1);
  }
  const tex = scene.textures.createCanvas(RIG_ATLAS, width, GAP + rows * rowH);
  if (!tex) return;
  const ctx = tex.getContext();
  for (const pl of placed) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(pl.x, pl.y, pl.w, pl.h);
    ctx.clip();
    ctx.translate(pl.x, pl.y);
    ctx.scale(PART_RES, PART_RES);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.translate(pl.d.px, pl.d.py);
    pl.draw(ctx);
    ctx.restore();
    tex.add(pl.name, 0, pl.x, pl.y, pl.w, pl.h);
  }
  tex.refresh();
}

const dim = (back: boolean, a: string, b: string) => (back ? b : a);

/* ------------------------------------------------------------------ legs */

function leg(c: Ctx, k: Look, back: boolean, id: RigId): void {
  const pants = dim(back, k.pants, k.pantsShade);
  const heavy = id === 'rurik' || id === 'sione' || id === 'kai7';
  const tw = heavy ? 5 : 4.4; // thigh width
  const thigh = () =>
    poly(c, [
      [-tw / 2, -0.8],
      [tw / 2 + 0.2, -0.8],
      [tw / 2 - 0.2, 6.6],
      [-tw / 2 + 0.3, 6.6],
    ]);
  thigh();
  inked(c, pants, L);
  thigh();
  shadeBelow(c, 'rgba(0,0,0,0.22)', -1, 7, -tw / 2 - 0.2, -0.4);
  // shin
  roundRect(c, -1.9, 5.6, 4, 5.4, 1.2);
  inked(c, pants, L);

  if (id === 'kai7') {
    // armour plates: thigh plate, shin greave with a cyan seam
    roundRect(c, -2.2, 0.4, 4.8, 4.6, 1.2);
    inked(c, dim(back, k.top, k.topShade), L);
    roundRect(c, -2.2, 5.6, 4.8, 5.4, 1.4);
    inked(c, dim(back, k.top, k.topShade), L);
    rimTop(c, -1.4, 1.8, 6.2, 'rgba(255,255,255,0.6)', 0.45);
    c.fillStyle = back ? '#3f9fa8' : k.accent;
    c.fillRect(-1.8, 8.2, 4, 0.5);
  } else if (heavy) {
    // knee guard
    roundRect(c, -0.6, 4.4, 3.6, 2.8, 1);
    inked(c, dim(back, k.top, k.topShade), L);
  } else if (id === 'kemi' || id === 'farida') {
    // knee wrap in the operator colour
    c.fillStyle = dim(back, k.accent, k.pantsShade);
    c.fillRect(-1.8, 5.2, 4, 1.1);
  }
  if (id === 'meilin' && !back) {
    // strapped thigh holster
    roundRect(c, -2.4, 1.6, 2.2, 3.4, 0.6);
    inked(c, k.trim, L * 0.7);
  }

  if (id === 'tari') {
    // dive fin
    poly(c, [
      [-2.4, 10.2],
      [2.4, 10.2],
      [7.8, 11.4],
      [8, 12.8],
      [-2.4, 12.6],
    ]);
    inked(c, dim(back, k.boot, '#0c3a36'), L);
    c.fillStyle = dim(back, k.bootTrim, '#145a53');
    c.fillRect(2, 11, 5, 0.5);
    return;
  }
  if (id === 'kemi') {
    // high-top sneaker: white with an orange panel and a thick sole
    poly(c, [
      [-2.3, 8.6],
      [2.4, 8.6],
      [2.8, 10.4],
      [5.2, 11.2],
      [5.2, 12.4],
      [-2.4, 12.4],
    ]);
    inked(c, dim(back, k.boot, '#b9b3a8'), L);
    c.fillStyle = dim(back, k.bootTrim, '#9a5a16');
    c.fillRect(-1.6, 10.2, 4.4, 0.8);
    c.fillStyle = '#2a2d33';
    c.fillRect(-2.4, 12, 7.6, 0.6);
    return;
  }
  // boot with a forward toe and a coloured strap
  const big = heavy ? 0.6 : 0;
  poly(c, [
    [-2.4 - big * 0.4, 9.6],
    [2.6, 9.6],
    [2.8 + big, 10.6],
    [4.8 + big, 11.3],
    [4.8 + big, 12.6],
    [-2.4 - big * 0.4, 12.6],
  ]);
  inked(c, dim(back, k.boot, '#141618'), L);
  rimTop(c, -1.6, 2.4, 10.1, 'rgba(255,255,255,0.2)', 0.4);
  c.fillStyle = dim(back, k.bootTrim, 'rgba(0,0,0,0.3)');
  c.fillRect(-2, 10.6, 4.4, 0.55);
}

/* ------------------------------------------------------------------ torso */

/** V-shaped chest: narrow waist (y=0) to broad shoulders (y≈-11.6). */
function chestPath(c: Ctx, b: number): void {
  c.beginPath();
  c.moveTo(-4.2 * b, 0.2);
  c.lineTo(4.6 * b, 0.2);
  c.quadraticCurveTo(5.4 * b, -5, 6 * b, -9.6);
  c.quadraticCurveTo(5.6 * b, -11.6, 3.4 * b, -11.6);
  c.lineTo(-3.4 * b, -11.6);
  c.quadraticCurveTo(-5.8 * b, -11.4, -5.8 * b, -9.4);
  c.quadraticCurveTo(-5.2 * b, -5, -4.2 * b, 0.2);
  c.closePath();
}

function torso(c: Ctx, k: Look, id: RigId): void {
  const b = k.build;
  backItem(c, k, id, b);

  // base body / undershirt (skin for bare-armed builds shows at the shoulders)
  chestPath(c, b);
  inked(c, k.sleeve === 'skin' ? k.skin : k.trim, L);

  switch (id) {
    case 'kemi': {
      // cropped bomber over a black top: open front, ribbed hem, orange body
      chestPath(c, b);
      c.save();
      c.clip();
      c.fillStyle = k.top;
      c.fillRect(-7, -12, 14, 8.4);
      c.fillStyle = k.topShade;
      c.fillRect(-7, -12, 3.2, 8.4);
      c.fillStyle = k.trim;
      c.fillRect(-0.4, -11.6, 3.4, 8); // open front shows the black top
      c.fillStyle = '#2a2d33';
      c.fillRect(-7, -4, 14, 1); // ribbed hem
      c.restore();
      chestPath(c, b);
      c.lineWidth = L;
      c.strokeStyle = '#14181d';
      c.stroke();
      poly(c, [
        [-3.2, -11.8],
        [0.4, -11.8],
        [-0.2, -9.6],
        [-2.6, -10.2],
      ]);
      inked(c, k.topShade, L * 0.8);
      break;
    }
    case 'rurik': {
      // heavy open-sided armour vest, dog tags, one big pauldron at the back
      const vest = () =>
        poly(c, [
          [-4.6 * b, 0.2],
          [4.8 * b, 0.2],
          [5.4 * b, -9.6],
          [2.6 * b, -11],
          [-3.4 * b, -11],
          [-5.4 * b, -9.4],
        ]);
      vest();
      inked(c, k.top, L);
      vest();
      shadeBelow(c, k.topShade, -4, 0.4);
      rimTop(c, -2.6, 3.6, -10.4, 'rgba(255,255,255,0.4)', 0.5);
      c.strokeStyle = 'rgba(10,14,20,0.6)';
      c.lineWidth = 0.4;
      c.beginPath();
      c.moveTo(-4.6, -5.4);
      c.lineTo(5.2, -5.4);
      c.stroke();
      c.fillStyle = k.accent;
      c.fillRect(-3.8, -8.6, 8.2, 0.9);
      c.strokeStyle = '#c9d3dd';
      c.lineWidth = 0.35;
      c.beginPath();
      c.moveTo(-1.4, -11);
      c.lineTo(0.6, -7.4);
      c.lineTo(2.4, -11);
      c.stroke();
      roundRect(c, 0, -7.6, 1.3, 1.6, 0.3);
      inked(c, '#c9d3dd', L * 0.5);
      roundRect(c, -7, -12.4, 5.6, 4.2, 1.6);
      inked(c, k.top, L);
      rimTop(c, -6.2, -2.6, -11.8, 'rgba(255,255,255,0.4)', 0.45);
      break;
    }
    case 'meilin': {
      // sleek high-collar suit with dark armour panels and a scarf
      chestPath(c, b);
      inked(c, k.top, L);
      chestPath(c, b);
      shadeBelow(c, k.topShade, -5, 0.4);
      roundRect(c, -3.6, -10, 7.4, 4.6, 1.4);
      inked(c, k.trim, L * 0.8);
      c.fillStyle = k.accent;
      c.fillRect(-3, -6.9, 6.4, 0.5);
      c.fillRect(0.2, -10, 0.5, 3.4);
      roundRect(c, -3.4, -12.6, 6.6, 2.4, 1);
      inked(c, '#3f8a5a', L * 0.8);
      poly(c, [
        [-3.2, -12],
        [-9.6, -10.6],
        [-10.4, -8.6],
        [-3, -10.4],
      ]);
      inked(c, '#3f8a5a', L * 0.7);
      break;
    }
    case 'tari': {
      // wetsuit with neon piping, harness strap
      chestPath(c, b);
      inked(c, k.top, L);
      chestPath(c, b);
      shadeBelow(c, k.topShade, -4, 0.4);
      rimTop(c, -2.6, 3.4, -11, 'rgba(255,255,255,0.18)', 0.5);
      c.strokeStyle = k.trim;
      c.lineWidth = 0.55;
      c.beginPath();
      c.moveTo(4.6 * b, -0.2);
      c.quadraticCurveTo(5.4 * b, -5, 5.6 * b, -9.6);
      c.moveTo(-1.2, -11.4);
      c.lineTo(-1.2, -0.2);
      c.stroke();
      c.strokeStyle = '#3a3f45';
      c.lineWidth = 0.8;
      c.beginPath();
      c.moveTo(-4, -11);
      c.lineTo(3.6, -2);
      c.stroke();
      break;
    }
    case 'tomas': {
      // grey tee, sleeveless work vest with pockets
      chestPath(c, b);
      c.save();
      c.clip();
      c.fillStyle = k.trim;
      c.fillRect(-8, -12, 16, 13);
      c.restore();
      poly(c, [
        [-4.6 * b, 0.2],
        [-0.6, 0.2],
        [-0.2, -10.6],
        [-4.2 * b, -11],
        [-5.6 * b, -9.4],
      ]);
      inked(c, k.top, L);
      poly(c, [
        [1.4, 0.2],
        [4.8 * b, 0.2],
        [5.6 * b, -9.6],
        [3.2, -10.8],
        [1.6, -10.6],
      ]);
      inked(c, k.top, L);
      roundRect(c, 2.2, -6.6, 2.6, 2.4, 0.5);
      inked(c, k.topShade, L * 0.7);
      roundRect(c, -3.8, -6.6, 2.6, 2.4, 0.5);
      inked(c, k.topShade, L * 0.7);
      c.fillStyle = k.accent;
      c.fillRect(-4.4, -9.2, 3.6, 0.7);
      break;
    }
    case 'farida': {
      // sleeveless red vest with grenade straps crossing the chest
      chestPath(c, b);
      inked(c, k.top, L);
      chestPath(c, b);
      shadeBelow(c, k.topShade, -4.4, 0.4);
      rimTop(c, -2.8, 3.6, -11, 'rgba(255,255,255,0.35)', 0.5);
      c.strokeStyle = '#3a2a1e';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(-4.4, -11);
      c.lineTo(4.4, -1.6);
      c.moveTo(4.4, -11);
      c.lineTo(-2, -4.4);
      c.stroke();
      for (const [gx, gy] of [
        [-2.4, -8.8],
        [0, -6.2],
        [2.4, -3.6],
      ] as const) {
        c.beginPath();
        c.arc(gx, gy, 1.05, 0, Math.PI * 2);
        inked(c, '#5d6b3c', L * 0.6);
        c.fillStyle = k.accent;
        c.fillRect(gx - 1, gy - 0.2, 2, 0.4);
      }
      break;
    }
    case 'sione': {
      // padded quilted vest over a dark tee, emitter node on the chest strap
      chestPath(c, b);
      inked(c, k.top, L);
      chestPath(c, b);
      shadeBelow(c, k.topShade, -5, 0.4);
      rimTop(c, -3, 4, -11, 'rgba(255,255,255,0.35)', 0.5);
      c.strokeStyle = 'rgba(20,16,40,0.55)';
      c.lineWidth = 0.35;
      for (const y of [-8.4, -5.6, -2.8]) {
        c.beginPath();
        c.moveTo(-5 * b, y);
        c.lineTo(5.2 * b, y);
        c.stroke();
      }
      roundRect(c, 1.6, -9.6, 2.6, 2.6, 1.3);
      inked(c, '#e4d6ff', L * 0.6);
      c.fillStyle = k.accent;
      c.fillRect(2.4, -8.8, 1, 1);
      break;
    }
    case 'kai7': {
      // chunky plated chest, glowing core, cyan seams, big pauldron
      chestPath(c, b);
      inked(c, k.top, L);
      chestPath(c, b);
      shadeBelow(c, k.topShade, -4.4, 0.4);
      rimTop(c, -3, 4, -11, 'rgba(255,255,255,0.8)', 0.5);
      c.strokeStyle = k.accent;
      c.lineWidth = 0.4;
      c.beginPath();
      c.moveTo(-5 * b, -4.4);
      c.lineTo(5.2 * b, -4.4);
      c.stroke();
      c.beginPath();
      c.arc(0.6, -7.4, 2.1, 0, Math.PI * 2);
      inked(c, '#1b5f6b', L * 0.8);
      c.beginPath();
      c.arc(0.6, -7.4, 1.3, 0, Math.PI * 2);
      c.fillStyle = k.accent;
      c.fill();
      c.fillStyle = '#ffffff';
      c.fillRect(0.8, -8, 0.5, 0.5);
      roundRect(c, -7.4, -13, 6.4, 4.8, 1.8);
      inked(c, k.top, L);
      rimTop(c, -6.6, -2, -12.4, 'rgba(255,255,255,0.8)', 0.45);
      c.fillStyle = k.accent;
      c.fillRect(-6.6, -9.4, 4.8, 0.45);
      break;
    }
    default: {
      // contractor: armoured vest with pouches
      chestPath(c, b);
      inked(c, k.top, L);
      chestPath(c, b);
      shadeBelow(c, k.topShade, -5, 0.4);
      rimTop(c, -2.8, 3, -10.6, 'rgba(255,255,255,0.35)', 0.5);
      roundRect(c, -1.4, -5.6, 2.6, 2.6, 0.6);
      inked(c, k.topShade, L * 0.8);
      roundRect(c, 1.6, -5.6, 2.4, 2.6, 0.6);
      inked(c, k.topShade, L * 0.8);
      c.fillStyle = k.accent;
      c.fillRect(-3.8, -9, 7.8, 1.1);
    }
  }

  // belt (Tomás wears a loaded tool belt)
  roundRect(c, -4.8 * b, -2.2, 9.8 * b, 2.5, 0.8);
  inked(c, id === 'tomas' ? '#6b4a2e' : '#2a2723', L);
  c.fillStyle = id === 'kai7' ? k.accent : '#c9b27a';
  c.fillRect(0.4, -1.6, 1.4, 1.3);
  if (id === 'tomas') {
    roundRect(c, 2.6, -1.6, 2, 3.2, 0.4);
    inked(c, '#3a3f45', L * 0.6);
    c.strokeStyle = '#9aa7b5';
    c.lineWidth = 0.6;
    c.beginPath();
    c.moveTo(-3.6, -1.4);
    c.lineTo(-3, 2.6);
    c.stroke();
  }
}

/** Things worn on the back, drawn first so the body covers them. */
function backItem(c: Ctx, k: Look, id: RigId, b: number): void {
  switch (id) {
    case 'kemi':
      // slim sling bag
      roundRect(c, -8, -10.4, 3.6, 7, 1.2);
      inked(c, '#2a2d33', L);
      c.fillStyle = k.accent;
      c.fillRect(-7.6, -8, 2.8, 0.6);
      break;
    case 'rurik':
      // ammo drum pack
      roundRect(c, -9.4 * b, -11, 5.6, 9.4, 1.6);
      inked(c, k.trim, L);
      c.beginPath();
      c.arc(-6.8 * b, -5, 2.2, 0, Math.PI * 2);
      inked(c, '#2b2f35', L);
      break;
    case 'tari':
      // twin rebreather cylinders
      roundRect(c, -9.2, -11.6, 2.8, 9.6, 1.3);
      inked(c, '#c9d3dd', L);
      roundRect(c, -7, -11.2, 2.6, 9, 1.2);
      inked(c, '#9aa7b5', L);
      c.fillStyle = k.accent;
      c.fillRect(-9, -8, 4.6, 0.8);
      break;
    case 'tomas':
      // folded sentry on the back: box, barrel stub, hazard band
      roundRect(c, -10, -12.4, 6.4, 5.4, 0.8);
      inked(c, '#4a5058', L);
      c.fillStyle = k.accent;
      c.fillRect(-9.6, -8.8, 5.6, 0.9);
      roundRect(c, -7.6, -14.6, 1.4, 2.6, 0.4);
      inked(c, '#2d3238', L * 0.7);
      break;
    case 'farida':
      // satchel of charges
      roundRect(c, -8.6, -8.6, 4.4, 6, 1);
      inked(c, '#6b5a44', L);
      c.fillStyle = k.accent;
      c.fillRect(-8.2, -6.4, 3.6, 0.6);
      break;
    case 'sione': {
      // big shield-emitter pack with a glowing node and an antenna
      const s = Math.min(b, 1.05);
      roundRect(c, -10.6 * s, -12, 6.4, 10.6, 2.2);
      inked(c, k.trim, L);
      c.beginPath();
      c.arc(-7.4 * s, -7, 1.7, 0, Math.PI * 2);
      inked(c, '#e4d6ff', L * 0.6);
      c.strokeStyle = '#20252b';
      c.lineWidth = 0.5;
      c.beginPath();
      c.moveTo(-9, -12);
      c.lineTo(-10, -15.4);
      c.stroke();
      c.fillStyle = k.accent;
      c.fillRect(-10.4, -16, 1, 1);
      break;
    }
    case 'kai7':
      // dorsal fin module
      poly(c, [
        [-9.6, -12],
        [-4.6, -12.6],
        [-4.6, -2.4],
        [-8, -3.4],
      ]);
      inked(c, k.topShade, L);
      c.fillStyle = k.accent;
      c.fillRect(-8.6, -9.4, 3, 0.7);
      c.fillRect(-8.4, -7.4, 2.8, 0.7);
      break;
    case 'meilin':
      // slim rifle case
      roundRect(c, -8, -12.6, 2.6, 11.4, 1);
      inked(c, k.trim, L);
      break;
    default:
      roundRect(c, -8.2, -10.6, 5, 8.6, 1.4);
      inked(c, k.trim, L);
  }
}

/* ------------------------------------------------------------------ head */

/** Face profile (facing right) with a strong jaw; `jaw` > 0 squares it off. */
function face(c: Ctx, k: Look, jaw = 0): void {
  c.fillStyle = k.skinShade;
  c.fillRect(-1.5, -2.6, 3.2, 2.8); // neck
  const outline = () => {
    c.beginPath();
    c.moveTo(-2.8, -7.6);
    c.quadraticCurveTo(-2.9, -1.6, -1.2, -0.9 - jaw * 0.2);
    c.lineTo(2.6, -0.9 - jaw * 0.2);
    c.quadraticCurveTo(4.4, -1.6, 4.4, -3.6);
    c.lineTo(4.8, -5);
    c.lineTo(4.2, -5.6);
    c.quadraticCurveTo(4.2, -7.8, 2.2, -8);
    c.closePath();
  };
  outline();
  inked(c, k.skin, L);
  outline();
  shadeBelow(c, 'rgba(0,0,0,0.2)', -8, 0, -3, 0);
  // ear
  c.beginPath();
  c.arc(-0.6, -4.6, 0.9, 0, Math.PI * 2);
  inked(c, k.skinShade, L * 0.6);
  // determined eye and brow
  c.fillStyle = '#14181d';
  c.fillRect(2.4, -5.6, 1.1, 1);
  c.strokeStyle = '#14181d';
  c.lineWidth = 0.55;
  c.beginPath();
  c.moveTo(1.6, -6.6);
  c.lineTo(3.9, -6.2);
  c.stroke();
  // mouth
  c.strokeStyle = 'rgba(20,24,29,0.65)';
  c.lineWidth = 0.35;
  c.beginPath();
  c.moveTo(2.2, -2.4);
  c.lineTo(3.7, -2.5);
  c.stroke();
}

/** Several circles as one shape with a single outline (hair volume). */
function blob(c: Ctx, pts: Array<[number, number, number]>, fill: string): void {
  c.beginPath();
  for (const [x, y, r] of pts) {
    c.moveTo(x + r, y);
    c.arc(x, y, r, 0, Math.PI * 2);
  }
  c.lineWidth = L * 2;
  c.strokeStyle = '#14181d';
  c.stroke();
  c.fillStyle = fill;
  c.fill();
}

function head(c: Ctx, k: Look, id: RigId): void {
  switch (id) {
    case 'kemi': {
      face(c, k);
      // hair close on the scalp with two big puffs on top, orange bandana, hoop earring
      blob(
        c,
        [
          [0.6, -8, 3.6],
          [-2.6, -11.2, 2.6],
          [2.2, -11.8, 2.4],
        ],
        k.hair,
      );
      c.fillStyle = 'rgba(255,255,255,0.18)';
      c.beginPath();
      c.arc(2.8, -12.6, 0.9, 0, Math.PI * 2);
      c.fill();
      roundRect(c, -3.4, -8.6, 8, 1.6, 0.6);
      inked(c, k.top, L * 0.8);
      poly(c, [
        [-3.2, -8.2],
        [-6.2, -6.4],
        [-5.6, -5.6],
        [-2.8, -7.2],
      ]);
      inked(c, k.top, L * 0.6);
      c.strokeStyle = '#f2c14e';
      c.lineWidth = 0.4;
      c.beginPath();
      c.arc(-0.6, -3.4, 0.7, 0, Math.PI * 2);
      c.stroke();
      return;
    }
    case 'rurik': {
      face(c, k, 1);
      // shaved head with a light rim, big copper beard, scar
      c.beginPath();
      c.moveTo(-2.9, -6.6);
      c.quadraticCurveTo(-2.6, -9.6, 1, -9.6);
      c.quadraticCurveTo(4.4, -9.4, 4.2, -6.6);
      c.closePath();
      inked(c, k.skin, L);
      rimTop(c, -1.6, 2.6, -9.1, 'rgba(255,255,255,0.45)', 0.45);
      poly(c, [
        [-1.8, -4.4],
        [4.8, -4],
        [4.6, -1.2],
        [2.6, 0.8],
        [0, 0.6],
        [-1.6, -1.6],
      ]);
      inked(c, k.hair, L * 0.8);
      c.fillStyle = 'rgba(255,220,180,0.25)';
      c.fillRect(1.6, -3.4, 2.6, 0.5);
      c.strokeStyle = '#9a5a46';
      c.lineWidth = 0.35;
      c.beginPath();
      c.moveTo(2.4, -7.6);
      c.lineTo(3.4, -6.2);
      c.stroke();
      return;
    }
    case 'meilin': {
      face(c, k);
      // sleek hair with a long high ponytail streaming back, visor monocle
      c.beginPath();
      c.moveTo(-3.2, -4.8);
      c.quadraticCurveTo(-3.6, -10, 1, -9.8);
      c.quadraticCurveTo(4.8, -9.6, 4.4, -6.8);
      c.lineTo(1.2, -7.6);
      c.lineTo(-1.2, -6.4);
      c.closePath();
      inked(c, k.hair, L);
      c.beginPath();
      c.moveTo(-2.4, -9.4);
      c.quadraticCurveTo(-8.6, -10.6, -9.4, -4.4);
      c.quadraticCurveTo(-7.6, -7, -2.4, -7.6);
      c.closePath();
      inked(c, k.hair, L * 0.8);
      c.fillStyle = k.accent;
      c.fillRect(-2.8, -9.4, 0.9, 1.6);
      roundRect(c, 1.8, -6.4, 3, 1.8, 0.7);
      inked(c, '#20252b', L * 0.6);
      c.fillStyle = '#d9ffd0';
      c.fillRect(2.4, -6, 1.8, 1);
      return;
    }
    case 'tari': {
      face(c, k);
      // locs gathered up in a teal band and falling back, goggles on the forehead
      for (let i = 0; i < 4; i++) {
        roundRect(c, -6 - i * 0.5, -10.2 + i * 1.3, 5, 1.3, 0.6);
        inked(c, k.hair, L * 0.6);
      }
      blob(
        c,
        [
          [0.4, -8.6, 3.6],
          [-2.6, -9.8, 2.4],
        ],
        k.hair,
      );
      c.fillStyle = k.accent;
      c.fillRect(-3.4, -11.6, 1.2, 2.4);
      roundRect(c, -0.2, -8.8, 5.2, 2.2, 1);
      inked(c, '#20252b', L * 0.8);
      c.fillStyle = k.accent;
      c.fillRect(0.4, -8.3, 3.8, 1.2);
      c.fillStyle = 'rgba(255,255,255,0.6)';
      c.fillRect(0.8, -8.2, 1, 0.5);
      return;
    }
    case 'tomas': {
      face(c, k, 0.5);
      // backwards cap, welding goggles on the front, bushy moustache, stubble
      c.beginPath();
      c.moveTo(-3.2, -6.2);
      c.quadraticCurveTo(-3.2, -10.4, 1, -10.2);
      c.quadraticCurveTo(4.8, -10, 4.6, -6.4);
      c.closePath();
      inked(c, k.accent, L);
      rimTop(c, -1.6, 2.6, -9.6, 'rgba(255,255,255,0.4)', 0.45);
      roundRect(c, -6, -7.2, 3.8, 1.3, 0.6);
      inked(c, '#b8961f', L * 0.7);
      roundRect(c, 0.2, -9.4, 4.6, 2, 0.9);
      inked(c, '#2a2f36', L * 0.7);
      c.fillStyle = '#5fe0c0';
      c.fillRect(0.8, -9, 1.4, 1.1);
      c.fillRect(2.8, -9, 1.4, 1.1);
      roundRect(c, 1.4, -3.4, 3.6, 1.3, 0.6);
      inked(c, k.hair, L * 0.5);
      c.fillStyle = 'rgba(30,20,12,0.25)';
      c.fillRect(-1.2, -2.2, 5, 1.2);
      return;
    }
    case 'farida': {
      face(c, k);
      // red headwrap with curls spilling out the back, blast goggles
      blob(
        c,
        [
          [-3.6, -6.6, 1.6],
          [-4.6, -4.8, 1.4],
          [-3.8, -3.2, 1.2],
        ],
        k.hair,
      );
      c.beginPath();
      c.moveTo(-3.4, -6);
      c.quadraticCurveTo(-3.8, -11, 1, -10.6);
      c.quadraticCurveTo(5, -10.2, 4.6, -6.8);
      c.lineTo(-3.4, -6);
      c.closePath();
      inked(c, k.top, L);
      rimTop(c, -1.4, 3, -10, 'rgba(255,255,255,0.35)', 0.45);
      poly(c, [
        [-3, -9.2],
        [-6.8, -10.2],
        [-6.4, -8.6],
        [-3.2, -8],
      ]);
      inked(c, k.topShade, L * 0.6);
      roundRect(c, 0, -7.8, 4.6, 1.9, 0.8);
      inked(c, '#20252b', L * 0.7);
      c.fillStyle = '#ffb36b';
      c.fillRect(0.6, -7.3, 1.4, 0.9);
      c.fillRect(2.6, -7.3, 1.4, 0.9);
      return;
    }
    case 'sione': {
      face(c, k, 1);
      // short tight curls, full trimmed beard, comms earpiece
      blob(
        c,
        [
          [-1.6, -8.4, 1.8],
          [0.8, -9.2, 1.9],
          [3, -8.6, 1.6],
          [-2.6, -6.8, 1.4],
        ],
        k.hair,
      );
      poly(c, [
        [-1.6, -4.4],
        [4.6, -4],
        [4.4, -1.4],
        [2.2, 0.2],
        [-0.4, 0],
        [-1.8, -2],
      ]);
      inked(c, k.hair, L * 0.7);
      c.fillStyle = k.skin;
      c.fillRect(2.2, -3, 2, 0.7);
      c.beginPath();
      c.arc(-0.6, -4.6, 1.1, 0, Math.PI * 2);
      inked(c, '#20252b', L * 0.6);
      c.fillStyle = k.accent;
      c.fillRect(-0.9, -4.9, 0.6, 0.6);
      return;
    }
    case 'kai7': {
      // faceless dome with a narrow visor slit and a crest
      c.fillStyle = k.pantsShade;
      c.fillRect(-1.5, -2.6, 3.2, 2.8);
      c.beginPath();
      c.moveTo(-3.6, -1.2);
      c.quadraticCurveTo(-4.8, -11, 0.6, -10.8);
      c.quadraticCurveTo(5.8, -10.6, 5, -3.2);
      c.quadraticCurveTo(4.4, -0.8, 0.6, -0.8);
      c.closePath();
      inked(c, k.top, L);
      rimTop(c, -1.8, 3.2, -10.2, 'rgba(255,255,255,0.85)', 0.5);
      poly(c, [
        [-2, -10.6],
        [1.6, -12.6],
        [2.6, -10.6],
      ]);
      inked(c, k.topShade, L * 0.7);
      roundRect(c, -0.4, -6.8, 5.6, 1.9, 0.8);
      inked(c, '#0d1a20', L * 0.7);
      c.fillStyle = k.accent;
      c.fillRect(0.2, -6.3, 4.6, 0.8);
      c.fillStyle = 'rgba(255,255,255,0.85)';
      c.fillRect(3.6, -6.2, 0.7, 0.5);
      return;
    }
    default: {
      // contractor: helmet over a full gas mask
      c.fillStyle = k.trim;
      c.fillRect(-1.5, -2.6, 3.2, 2.8);
      roundRect(c, -3.2, -7.6, 7.2, 6.4, 2.6);
      inked(c, k.skin, L);
      c.beginPath();
      c.arc(2.4, -2.6, 1.6, 0, Math.PI * 2);
      inked(c, '#2b2e33', L);
      roundRect(c, -0.6, -6.6, 4.4, 2, 0.9);
      inked(c, k.accent, L * 0.8);
      c.beginPath();
      c.moveTo(-4.6, -5.4);
      c.quadraticCurveTo(-4.6, -10.4, 0.6, -10.4);
      c.quadraticCurveTo(5.4, -10.4, 5.2, -5.6);
      c.lineTo(-4.6, -5.4);
      c.closePath();
      inked(c, k.top, L);
      roundRect(c, -5, -6, 10.8, 1.4, 0.6);
      inked(c, k.topShade, L * 0.8);
    }
  }
}

/* ------------------------------------------------------------------ arm + weapon */

/** Shoulder → arm → weapon, pointing along +x. The barrel sits on the y=0 line through the pivot. */
function arm(c: Ctx, k: Look, weapon: WeaponId, id: RigId): void {
  const metal = '#2d3238';
  const metalHi = 'rgba(255,255,255,0.28)';
  const heavy = id === 'rurik' || id === 'sione' || id === 'kai7';
  const up = heavy ? 3.9 : 3.4; // upper-arm thickness
  const upper = k.sleeve === 'skin' ? k.skin : k.top;
  const fore = k.sleeve === 'skin' ? k.skin : k.top;
  // upper arm (big shoulder for heroic builds)
  roundRect(c, -1.8, -up / 2 - 0.2, 6.8, up, 1.8);
  inked(c, upper, L);
  if (k.sleeve === 'skin') rimTop(c, -0.6, 4, -up / 2 + 0.3, 'rgba(255,255,255,0.3)', 0.4);
  // forearm
  roundRect(c, 3.8, -1.4, 4.6, 3, 1.4);
  inked(c, fore, L);
  if (id === 'rurik') {
    c.fillStyle = k.accent; // tactical tape
    c.fillRect(5.2, -1.4, 0.9, 3);
  }
  if (id === 'farida') {
    // wrapped forearm
    c.fillStyle = k.trim;
    c.fillRect(4.4, -1.4, 3.4, 3);
    c.strokeStyle = 'rgba(80,60,40,0.5)';
    c.lineWidth = 0.3;
    for (let x = 4.8; x < 7.8; x += 0.9) {
      c.beginPath();
      c.moveTo(x, -1.4);
      c.lineTo(x + 0.5, 1.6);
      c.stroke();
    }
  }
  if (id === 'tomas') {
    // mechanical brace on the forearm
    roundRect(c, 4.6, -1.8, 3.4, 3.6, 0.8);
    inked(c, '#5a636e', L * 0.8);
    c.fillStyle = k.accent;
    c.fillRect(5.2, -1.2, 2.2, 0.5);
  }
  if (id === 'kai7') {
    c.fillStyle = k.accent; // seam light along the arm
    c.fillRect(0.4, -0.3, 3.6, 0.5);
  }
  if (id === 'kemi') {
    c.fillStyle = k.topShade; // pushed-up sleeve cuff
    c.fillRect(6.6, -1.4, 1, 3);
  }

  switch (weapon) {
    case 'kestrel':
      poly(c, [
        [6.4, -1.8],
        [15.6, -1.8],
        [16, 1.3],
        [6.4, 1.7],
      ]);
      inked(c, metal, L);
      rimTop(c, 7, 15.4, -1.3, metalHi);
      roundRect(c, 9.6, 1.1, 1.8, 4.4, 0.5); // magazine
      inked(c, '#3a3f45', L * 0.8);
      roundRect(c, 15.6, -0.8, 3, 1.3, 0.4); // barrel
      inked(c, metal, L * 0.8);
      c.fillStyle = k.accent;
      c.fillRect(11.8, -1.8, 2.4, 0.6);
      break;
    case 'bulwark':
      poly(c, [
        [5.6, -2.6],
        [18.6, -2.6],
        [19.2, 1.8],
        [5.6, 2.4],
      ]);
      inked(c, metal, L);
      rimTop(c, 6.2, 18.2, -2.1, metalHi);
      roundRect(c, 8.4, 1.8, 5, 4, 0.7); // box mag
      inked(c, '#4a4033', L * 0.8);
      roundRect(c, 18.6, -1, 5.6, 1.8, 0.5); // barrel
      inked(c, metal, L * 0.8);
      roundRect(c, 19.6, -1.6, 1.4, 3, 0.4); // shroud ring
      inked(c, '#3a3f45', L * 0.6);
      c.fillStyle = k.accent;
      c.fillRect(13.6, -2.6, 3, 0.7);
      c.strokeStyle = '#20252b';
      c.lineWidth = 0.5;
      c.beginPath();
      c.moveTo(17, 1.6);
      c.lineTo(15.8, 4.4);
      c.moveTo(17.6, 1.6);
      c.lineTo(18.8, 4.4);
      c.stroke(); // bipod
      break;
    case 'needle':
      poly(c, [
        [5.6, -1.3],
        [19, -1.3],
        [19.2, 1.1],
        [5.6, 1.5],
      ]);
      inked(c, metal, L);
      rimTop(c, 6, 18.6, -0.9, metalHi);
      roundRect(c, 19, -0.5, 6.4, 1, 0.4); // long barrel
      inked(c, metal, L * 0.7);
      roundRect(c, 9.2, -4, 6.6, 2.2, 1); // scope
      inked(c, '#20252b', L * 0.8);
      c.fillStyle = k.accent;
      c.fillRect(15.2, -3.6, 0.6, 1.4);
      roundRect(c, 10.4, 1.2, 1.5, 3, 0.5);
      inked(c, '#3a3f45', L * 0.7);
      break;
    case 'riptide':
      roundRect(c, 6, -1.2, 12.6, 2.4, 1);
      inked(c, '#e8edf2', L);
      rimTop(c, 6.6, 18, -0.8, 'rgba(255,255,255,0.5)');
      c.fillStyle = k.accent;
      c.fillRect(9, -1.2, 1.2, 2.4);
      roundRect(c, 8.6, 1.1, 1.8, 3.4, 0.6);
      inked(c, '#20252b', L * 0.8);
      c.strokeStyle = '#9aa7b5';
      c.lineWidth = 0.6;
      c.beginPath();
      c.moveTo(18.4, 0);
      c.lineTo(24, 0);
      c.stroke();
      poly(c, [
        [24, -1.2],
        [26.6, 0],
        [24, 1.2],
      ]);
      inked(c, '#c9d3dd', L * 0.6);
      break;
    case 'forge':
      poly(c, [
        [5.6, -1.6],
        [16, -1.6],
        [16.4, 1.3],
        [5.6, 1.6],
      ]);
      inked(c, metal, L);
      rimTop(c, 6.2, 15.6, -1.1, metalHi);
      poly(c, [
        [10, 1.2],
        [11.8, 1.2],
        [12.6, 4.8],
        [11, 5],
      ]);
      inked(c, '#3a3f45', L * 0.8);
      roundRect(c, 16, -0.6, 3.4, 1.2, 0.4);
      inked(c, metal, L * 0.8);
      c.fillStyle = k.accent;
      c.fillRect(6, -1.2, 1.4, 2.4);
      break;
    case 'tremor':
      roundRect(c, 5.8, -1.8, 6, 3.8, 1);
      inked(c, metal, L);
      c.beginPath();
      c.arc(9.4, 0.4, 2.9, 0, Math.PI * 2);
      inked(c, '#4a4f56', L);
      for (let n = 0; n < 4; n++) {
        c.beginPath();
        c.arc(9.4 + Math.cos(n * 1.57) * 1.6, 0.4 + Math.sin(n * 1.57) * 1.6, 0.55, 0, Math.PI * 2);
        c.fillStyle = '#20252b';
        c.fill();
      }
      roundRect(c, 11.6, -2, 8, 4, 1.3);
      inked(c, metal, L);
      rimTop(c, 12.2, 19, -1.5, metalHi);
      c.fillStyle = k.accent;
      c.fillRect(17, -2, 1, 4);
      break;
    case 'tala':
      poly(c, [
        [5.6, -1.5],
        [12.8, -1.5],
        [13, 1.5],
        [5.6, 1.7],
      ]);
      inked(c, metal, L);
      roundRect(c, 12.4, -1.2, 8.2, 1.5, 0.5);
      inked(c, metal, L * 0.8);
      rimTop(c, 6, 20.2, -0.9, metalHi);
      roundRect(c, 13.4, 0.4, 4.6, 1.8, 0.6);
      inked(c, '#6b4a2e', L * 0.8);
      c.fillStyle = k.accent;
      c.fillRect(8, -1.5, 1, 3.2);
      break;
    case 'volt':
      roundRect(c, 5.8, -1.8, 13, 3.6, 1.5);
      inked(c, '#e8eef3', L);
      rimTop(c, 6.4, 18.2, -1.3, 'rgba(255,255,255,0.7)');
      c.fillStyle = k.accent;
      c.fillRect(9.6, -1.8, 0.9, 3.6);
      c.fillRect(12, -1.8, 0.9, 3.6);
      roundRect(c, 18.6, -0.9, 1.8, 1.8, 0.9);
      inked(c, k.accent, L * 0.6);
      roundRect(c, 9, 1.4, 1.6, 2.6, 0.5);
      inked(c, '#2a3440', L * 0.7);
      break;
    case 'p9':
      roundRect(c, 7.4, -1.4, 6.2, 2.5, 0.6);
      inked(c, metal, L);
      rimTop(c, 7.8, 13.2, -1, metalHi);
      roundRect(c, 8, 0.7, 1.9, 3.3, 0.5);
      inked(c, '#3a3f45', L * 0.8);
      break;
    default:
      // contractor rifle
      poly(c, [
        [5.6, -1.6],
        [16.6, -1.6],
        [17, 1.3],
        [5.6, 1.6],
      ]);
      inked(c, '#25282d', L);
      rimTop(c, 6, 16.4, -1.1, metalHi);
      roundRect(c, 9.4, 1.1, 1.6, 3.8, 0.5);
      inked(c, '#3a3d42', L * 0.8);
      roundRect(c, 16.6, -0.6, 2.6, 1.1, 0.4);
      inked(c, '#25282d', L * 0.8);
      c.fillStyle = k.accent;
      c.fillRect(12.6, -1.2, 2.4, 0.6);
  }
  // gloved hand on the grip
  c.beginPath();
  c.arc(weapon === 'p9' ? 8.4 : 7.6, 0.6, heavy ? 1.8 : 1.6, 0, Math.PI * 2);
  inked(c, k.glove, L * 0.8);
}
