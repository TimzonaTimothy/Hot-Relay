/**
 * Cut-out character parts (head, torso, leg, gun arm) drawn as cel-shaded illustrations.
 * A Rig assembles and animates them. Units are world pixels; textures are drawn at PART_RES
 * pixels per world pixel so they stay sharp when shown larger (title screen).
 * An artist can later replace each texture with a painted part using the same pivots.
 */
import Phaser from 'phaser';
import { inked, poly, rimTop, roundRect, shadeBelow, type Ctx } from './paint';
import { OPERATORS } from '../data/operators';
import type { WeaponId } from '../data/weapons';

export const PART_RES = 6;

export type RigId = 'kemi' | 'rurik' | 'meilin' | 'tari' | 'contractor';

export interface RigPalette {
  armour: string;
  armourShade: string;
  cloth: string;
  clothShade: string;
  accent: string;
  skin: string;
  helmet: string;
  helmetShade: string;
  boot: string;
}

export const RIG_PALETTES: Record<RigId, RigPalette> = {
  kemi: {
    armour: '#c2a868',
    armourShade: '#8a7442',
    cloth: '#6f7748',
    clothShade: '#4d5331',
    accent: '#f2a541',
    skin: '#6b3e26',
    helmet: '#8f7d4a',
    helmetShade: '#64562f',
    boot: '#2e2a24',
  },
  rurik: {
    armour: '#5f7f9f',
    armourShade: '#3c5873',
    cloth: '#3e4a5a',
    clothShade: '#2a3441',
    accent: '#5aa9e6',
    skin: '#e2b69b',
    helmet: '#46627f',
    helmetShade: '#2f4459',
    boot: '#23272d',
  },
  meilin: {
    armour: '#567a56',
    armourShade: '#365338',
    cloth: '#334237',
    clothShade: '#212c24',
    accent: '#9bd36a',
    skin: '#dcab84',
    helmet: '#40603f',
    helmetShade: '#2a4129',
    boot: '#1f2420',
  },
  tari: {
    armour: '#2c3d44',
    armourShade: '#1b282d',
    cloth: '#1d2a2f',
    clothShade: '#121b1f',
    accent: '#2ec4b6',
    skin: '#4e2e1c',
    helmet: '#24363c',
    helmetShade: '#162328',
    boot: '#101619',
  },
  contractor: {
    armour: '#565a63',
    armourShade: '#373a41',
    cloth: '#2d3036',
    clothShade: '#1d1f23',
    accent: '#e0452f',
    skin: '#5e636c',
    helmet: '#3f434b',
    helmetShade: '#2a2d33',
    boot: '#18191c',
  },
};

/** Part frame sizes and pivots, in world units. */
export const PARTS = {
  leg: { w: 9, h: 15, px: 3, py: 1.5 },
  torso: { w: 18, h: 14, px: 9, py: 12.5 },
  head: { w: 15, h: 12, px: 8, py: 11 },
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
  (Object.keys(RIG_PALETTES) as RigId[]).forEach((id, row) => {
    const p = RIG_PALETTES[id];
    jobs.push({ row, name: `${id}-leg`, d: PARTS.leg, draw: (c) => leg(c, p, false, id) });
    jobs.push({ row, name: `${id}-legB`, d: PARTS.leg, draw: (c) => leg(c, p, true, id) });
    jobs.push({ row, name: `${id}-torso`, d: PARTS.torso, draw: (c) => torso(c, p, id) });
    jobs.push({ row, name: `${id}-head`, d: PARTS.head, draw: (c) => head(c, p, id) });
    for (const w of weaponsFor(id))
      jobs.push({ row, name: armKey(id, w), d: PARTS.arm, draw: (c) => arm(c, p, w) });
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

function leg(c: Ctx, p: RigPalette, back: boolean, id: RigId): void {
  const cloth = back ? p.clothShade : p.cloth;
  const armour = back ? p.armourShade : p.armour;
  // thigh
  roundRect(c, -2.1, -0.6, 4.4, 7, 1.6);
  inked(c, cloth, L);
  roundRect(c, -2.1, -0.6, 4.4, 7, 1.6);
  shadeBelow(c, 'rgba(0,0,0,0.22)', -1, 7, -2.2, 0);
  // shin guard
  roundRect(c, -2, 5.6, 4.3, 5.2, 1.2);
  inked(c, armour, L);
  rimTop(c, -1.2, 1.6, 6.3, 'rgba(255,255,255,0.35)', 0.45);
  // knee pad
  roundRect(c, -0.4, 4.6, 3.2, 2.4, 1);
  inked(c, back ? p.armourShade : p.accent, L);
  if (id === 'tari') {
    // dive fin instead of a boot
    poly(c, [
      [-2.4, 10.2],
      [2.4, 10.2],
      [7.4, 11.6],
      [7.6, 12.8],
      [-2.4, 12.6],
    ]);
    inked(c, back ? '#0c3a36' : '#16756c', L);
    return;
  }
  // boot with forward toe
  poly(c, [
    [-2.4, 10.2],
    [2.6, 10.2],
    [4.6, 11.4],
    [4.6, 12.6],
    [-2.4, 12.6],
  ]);
  inked(c, p.boot, L);
  rimTop(c, -1.6, 2.4, 10.8, 'rgba(255,255,255,0.18)', 0.4);
}

function torso(c: Ctx, p: RigPalette, id: RigId): void {
  // backpack (behind, towards -x since rigs face right)
  roundRect(c, -8.2, -10.6, 5, 8.6, 1.4);
  inked(c, id === 'contractor' ? p.clothShade : p.armourShade, L);
  rimTop(c, -7.6, -4, -10, 'rgba(255,255,255,0.18)', 0.45);
  if (id === 'tari') {
    // twin rebreather cylinders over the pack
    roundRect(c, -8.8, -11.6, 2.8, 9.6, 1.3);
    inked(c, '#c9d3dd', L);
    roundRect(c, -6.6, -11.2, 2.6, 9, 1.2);
    inked(c, '#9aa7b5', L);
    c.fillStyle = p.accent;
    c.fillRect(-8.6, -8, 4.6, 0.8);
  }
  if (id === 'rurik') {
    // ammo drum on the pack
    c.beginPath();
    c.arc(-6, -4.2, 2.1, 0, Math.PI * 2);
    inked(c, '#2b2f35', L);
  }
  // undershirt / fatigues
  roundRect(c, -4.6, -11.4, 9.4, 11.4, 2.4);
  inked(c, p.cloth, L);
  // armoured vest with chest plate
  roundRect(c, -4.2, -10.8, 8.6, 8.8, 2);
  inked(c, p.armour, L);
  roundRect(c, -4.2, -10.8, 8.6, 8.8, 2);
  shadeBelow(c, p.armourShade, -6, -1.8, -5, 0.2);
  rimTop(c, -2.8, 3, -10.2, 'rgba(255,255,255,0.45)', 0.5);
  // pouches
  roundRect(c, -1.4, -5.6, 2.6, 2.6, 0.6);
  inked(c, p.armourShade, L * 0.8);
  roundRect(c, 1.6, -5.6, 2.4, 2.6, 0.6);
  inked(c, p.armourShade, L * 0.8);
  // operator stripe across the chest
  c.fillStyle = p.accent;
  c.fillRect(-3.8, -9, 7.8, 1.1);
  // belt
  roundRect(c, -4.7, -2.2, 9.6, 2.5, 0.8);
  inked(c, '#2a2723', L);
  c.fillStyle = '#c9b27a';
  c.fillRect(0.4, -1.6, 1.4, 1.3);
  // heavy gets shoulder plates
  if (id === 'rurik') {
    roundRect(c, -5.4, -12.2, 4.2, 3.2, 1.2);
    inked(c, p.armour, L);
  }
}

function head(c: Ctx, p: RigPalette, id: RigId): void {
  // neck
  c.fillStyle = id === 'contractor' ? p.clothShade : p.skin;
  c.fillRect(-1.3, -2.4, 2.8, 2.6);
  if (id === 'contractor') {
    // full gas mask
    roundRect(c, -3.2, -7.6, 7.2, 6.4, 2.6);
    inked(c, p.skin, L);
    c.beginPath();
    c.arc(2.4, -2.6, 1.6, 0, Math.PI * 2);
    inked(c, '#2b2e33', L * 0.8);
    roundRect(c, -0.6, -6.6, 4.4, 2, 0.9);
    inked(c, p.accent, L * 0.8);
    c.fillStyle = 'rgba(255,255,255,0.7)';
    c.fillRect(2.4, -6.3, 0.9, 0.6);
  } else {
    // face
    roundRect(c, -2.6, -7.4, 6.6, 6.6, 2.4);
    inked(c, p.skin, L);
    roundRect(c, -2.6, -7.4, 6.6, 6.6, 2.4);
    shadeBelow(c, 'rgba(0,0,0,0.18)', -3, -0.5, -3, 4.2);
    // mouth
    c.strokeStyle = 'rgba(20,24,29,0.6)';
    c.lineWidth = 0.35;
    c.beginPath();
    c.moveTo(1.6, -2.3);
    c.lineTo(3.1, -2.4);
    c.stroke();
    if (id === 'rurik') {
      // beard
      poly(c, [
        [-1.6, -3.4],
        [3.8, -3.4],
        [3.6, -1.2],
        [1.2, -0.4],
        [-1.4, -1.4],
      ]);
      inked(c, '#8a5a2b', L * 0.7);
    }
  }
  if (id === 'tari') {
    // neoprene hood, dive mask pushed up, rebreather mouthpiece hose
    c.beginPath();
    c.moveTo(-4.4, -2);
    c.quadraticCurveTo(-5.2, -10.6, 0.6, -10.2);
    c.quadraticCurveTo(5, -10.2, 4.8, -6.2);
    c.lineTo(-1, -6);
    c.lineTo(-1.6, -1.6);
    c.closePath();
    inked(c, p.helmet, L);
    roundRect(c, -0.4, -9.8, 5.2, 2.6, 1);
    inked(c, '#20252b', L * 0.8);
    c.fillStyle = p.accent;
    c.fillRect(0.4, -9.2, 3.6, 1.4);
    c.fillStyle = 'rgba(255,255,255,0.6)';
    c.fillRect(0.8, -9.1, 1, 0.5);
    c.strokeStyle = '#c9d3dd';
    c.lineWidth = 0.7;
    c.beginPath();
    c.moveTo(3.4, -1.8);
    c.quadraticCurveTo(-1, 0.6, -4, -2.4);
    c.stroke();
    return;
  }
  // helmet dome
  c.beginPath();
  c.moveTo(-4.6, -5.4);
  c.quadraticCurveTo(-4.6, -10.4, 0.6, -10.4);
  c.quadraticCurveTo(5.4, -10.4, 5.2, -5.6);
  c.lineTo(-4.6, -5.4);
  c.closePath();
  inked(c, p.helmet, L);
  c.beginPath();
  c.moveTo(-4.6, -5.4);
  c.quadraticCurveTo(-4.6, -10.4, 0.6, -10.4);
  c.quadraticCurveTo(5.4, -10.4, 5.2, -5.6);
  c.lineTo(-4.6, -5.4);
  c.closePath();
  shadeBelow(c, p.helmetShade, -10.5, -5, -5, -0.8);
  rimTop(c, -1.4, 3, -9.7, 'rgba(255,255,255,0.4)', 0.5);
  // brim
  roundRect(c, -5, -6, 10.8, 1.4, 0.6);
  inked(c, p.helmetShade, L * 0.8);
  if (id !== 'contractor') {
    // goggles pushed onto the helmet, lens in operator colour
    roundRect(c, 0.2, -8.6, 4.2, 1.9, 0.8);
    inked(c, '#20252b', L * 0.7);
    c.fillStyle = p.accent;
    c.fillRect(0.9, -8.1, 1.3, 0.9);
    c.fillRect(2.6, -8.1, 1.3, 0.9);
  }
  if (id === 'kemi') {
    // red headband tails and braids
    c.fillStyle = '#d94b3b';
    c.fillRect(-4.4, -6.2, 9.4, 0.9);
    poly(c, [
      [-4.4, -6],
      [-6.4, -4.4],
      [-5.8, -3.6],
      [-4, -5.2],
    ]);
    inked(c, '#d94b3b', L * 0.6);
    roundRect(c, -4.2, -5, 1.6, 4, 0.8);
    inked(c, '#1d120c', L * 0.6);
  }
  if (id === 'meilin') {
    // ponytail and scope monocle
    c.beginPath();
    c.moveTo(-4.2, -6);
    c.quadraticCurveTo(-7.4, -4.6, -6.4, -1.2);
    c.quadraticCurveTo(-5, -3.6, -3.4, -4.8);
    c.closePath();
    inked(c, '#15110f', L * 0.7);
    c.beginPath();
    c.arc(2.8, -4.6, 1.1, 0, Math.PI * 2);
    inked(c, '#d9ffd0', L * 0.6);
  }
}

/** Shoulder → arm → weapon, pointing along +x. The barrel sits on the y=0 line through the pivot. */
function arm(c: Ctx, p: RigPalette, weapon: WeaponId): void {
  const metal = '#2d3238';
  const metalHi = 'rgba(255,255,255,0.28)';
  // upper arm and forearm in the operator's own colours
  roundRect(c, -1.4, -1.6, 6.4, 3.4, 1.6);
  inked(c, p.cloth, L);
  roundRect(c, 3.8, -1.3, 4.4, 3, 1.4);
  inked(c, p.armour, L);
  switch (weapon) {
    case 'kestrel':
      poly(c, [
        [6.4, -1.6],
        [15.2, -1.6],
        [15.6, 1.2],
        [6.4, 1.6],
      ]);
      inked(c, metal, L);
      rimTop(c, 7, 15, -1.1, metalHi);
      roundRect(c, 9.6, 1, 1.7, 4, 0.5); // magazine
      inked(c, '#3a3f45', L * 0.8);
      roundRect(c, 15.2, -0.7, 2.8, 1.2, 0.4); // barrel
      inked(c, metal, L * 0.8);
      roundRect(c, 4.4, -1.1, 2.4, 2.2, 0.8); // stock
      inked(c, '#3a3f45', L * 0.8);
      break;
    case 'bulwark':
      poly(c, [
        [5.6, -2.2],
        [18, -2.2],
        [18.6, 1.6],
        [5.6, 2.2],
      ]);
      inked(c, metal, L);
      rimTop(c, 6.2, 17.6, -1.7, metalHi);
      roundRect(c, 8.6, 1.6, 4.4, 3.6, 0.7); // box mag
      inked(c, '#4a4033', L * 0.8);
      roundRect(c, 18, -0.8, 5, 1.5, 0.5); // barrel
      inked(c, metal, L * 0.8);
      c.strokeStyle = '#20252b';
      c.lineWidth = 0.5;
      c.beginPath();
      c.moveTo(17, 1.4);
      c.lineTo(15.8, 4);
      c.moveTo(17.6, 1.4);
      c.lineTo(18.8, 4);
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
      roundRect(c, 19, -0.5, 6, 1, 0.4); // long barrel
      inked(c, metal, L * 0.7);
      roundRect(c, 9.4, -3.8, 6.2, 2, 0.9); // scope
      inked(c, '#20252b', L * 0.8);
      c.fillStyle = p.accent;
      c.fillRect(15, -3.4, 0.6, 1.2);
      roundRect(c, 10.4, 1.2, 1.5, 3, 0.5);
      inked(c, '#3a3f45', L * 0.7);
      break;
    case 'riptide':
      // pneumatic speargun: slim tube, grip, loaded spear with a barbed tip
      roundRect(c, 6, -1.1, 12.6, 2.2, 1);
      inked(c, '#e8edf2', L);
      rimTop(c, 6.6, 18, -0.7, 'rgba(255,255,255,0.5)');
      c.fillStyle = p.accent;
      c.fillRect(9, -1.1, 1.2, 2.2);
      roundRect(c, 8.6, 1, 1.8, 3.4, 0.6); // grip
      inked(c, '#20252b', L * 0.8);
      c.strokeStyle = '#9aa7b5';
      c.lineWidth = 0.6;
      c.beginPath();
      c.moveTo(18.4, 0);
      c.lineTo(24, 0);
      c.stroke();
      poly(c, [
        [24, -1.1],
        [26.4, 0],
        [24, 1.1],
      ]);
      inked(c, '#c9d3dd', L * 0.6);
      break;
    case 'p9':
      // compact sidearm held at full extension
      roundRect(c, 7.4, -1.4, 6, 2.4, 0.6);
      inked(c, metal, L);
      rimTop(c, 7.8, 13, -1, metalHi);
      roundRect(c, 8, 0.6, 1.8, 3.2, 0.5);
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
      c.fillStyle = p.accent;
      c.fillRect(12.6, -1.2, 2.4, 0.6);
  }
  // gloved hand on the grip
  c.beginPath();
  c.arc(weapon === 'p9' ? 8.4 : 7.6, 0.6, 1.5, 0, Math.PI * 2);
  inked(c, '#2a2723', L * 0.8);
}
