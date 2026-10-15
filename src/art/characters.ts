import { canvas, capsule, cel, circle, mix, poly, roundRect, INK, type Ctx, type Strip } from './util';

/**
 * Painted soldier sprites, side view facing right. Body frames (legs, torso, head) are separate
 * from the arms+gun sprite, which rotates around the shoulder for smooth 8-way aim.
 */

export interface Kit {
  skin: string;
  skinShade: string;
  gear: string;
  gearShade: string;
  gearLight: string;
  strap: string;
  boot: string;
  accent: string;
  helmet: string;
  helmetShade: string;
  /** Full-face helmet with a glowing visor slit (enemies). */
  faceless?: boolean;
  visorGlow?: string;
  hair?: 'braid' | 'ponytail' | 'beard';
  hairColor?: string;
  monocle?: boolean;
  scale: number;
}

export type WeaponKind = 'smg' | 'lmg' | 'dmr' | 'rifle';

const OLIVE = { gear: '#5d6b3c', gearShade: '#414b28', gearLight: '#8b9a58', strap: '#33372a', boot: '#2c2722' };

export const KITS: Record<string, Kit> = {
  kemi: {
    ...OLIVE,
    skin: '#7a4a2c',
    skinShade: '#55321d',
    accent: '#f39a1e',
    helmet: '#55613a',
    helmetShade: '#3b4426',
    hair: 'braid',
    hairColor: '#1b1410',
    scale: 1,
  },
  rurik: {
    ...OLIVE,
    gear: '#56653f',
    skin: '#e9b995',
    skinShade: '#c48d6a',
    accent: '#4f86c6',
    helmet: '#4e5a37',
    helmetShade: '#363f24',
    hair: 'beard',
    hairColor: '#9a5a2c',
    scale: 1.1,
  },
  meilin: {
    ...OLIVE,
    gear: '#617040',
    skin: '#dcab80',
    skinShade: '#b4835c',
    accent: '#9be03c',
    helmet: '#58653c',
    helmetShade: '#3c4528',
    hair: 'ponytail',
    hairColor: '#15120f',
    monocle: true,
    scale: 0.97,
  },
  rifleman: {
    gear: '#868b92',
    gearShade: '#5d6168',
    gearLight: '#b8bcc2',
    strap: '#3a3c40',
    boot: '#2a2a2d',
    skin: '#6b6f75',
    skinShade: '#4d5056',
    accent: '#c8452f',
    helmet: '#6f747b',
    helmetShade: '#4b4f55',
    faceless: true,
    visorGlow: '#ffa040',
    scale: 1,
  },
};

interface Leg {
  /** Thigh angle from straight down; positive swings forward. */
  t: number;
  /** Knee bend; positive folds the shin backward. */
  k: number;
}

interface Pose {
  front: Leg;
  back: Leg;
  /** Fixed hip height (air poses); otherwise the lowest foot rests on the ground. */
  hipY?: number;
  lean: number;
  bob?: number;
}

const THIGH = 18;
const SHIN = 17;

function footDrop(l: Leg): number {
  return THIGH * Math.cos(l.t) + SHIN * Math.cos(l.t - l.k);
}

function runPose(i: number, n: number, amp: number, lean: number): Pose {
  const p = (i / n) * Math.PI * 2;
  const leg = (q: number): Leg => ({
    t: amp * Math.sin(q),
    k: 0.2 + 1.15 * Math.max(0, Math.cos(q)) * (amp / 0.68),
  });
  return { front: leg(p), back: leg(p + Math.PI), lean };
}

const POSES: Record<string, Pose> = {
  idle0: { front: { t: 0.14, k: 0.06 }, back: { t: -0.12, k: 0.04 }, lean: 1 },
  idle1: { front: { t: 0.14, k: 0.1 }, back: { t: -0.12, k: 0.08 }, lean: 1, bob: 1 },
  jump: { front: { t: 1.0, k: 1.75 }, back: { t: 0.35, k: 1.5 }, hipY: -44, lean: 2 },
  fall: { front: { t: 0.4, k: 0.55 }, back: { t: -0.3, k: 0.35 }, hipY: -46, lean: 1 },
  crouch: { front: { t: 1.35, k: 1.35 }, back: { t: 0.08, k: 1.65 }, lean: 0 },
};

/** Feet are at the bottom-centre of each frame. */
export const FRAME = { w: 120, h: 116, footX: 60, footY: 110 } as const;

export interface CharacterArt {
  strip: Strip;
  /** Shoulder pivot relative to the feet (facing right), per frame. */
  shoulder: Record<string, { x: number; y: number }>;
}

function drawLeg(ctx: Ctx, kit: Kit, hx: number, hy: number, l: Leg, far: boolean): void {
  const kx = hx + Math.sin(l.t) * THIGH;
  const ky = hy + Math.cos(l.t) * THIGH;
  const sa = l.t - l.k;
  const fx = kx + Math.sin(sa) * SHIN;
  const fy = ky + Math.cos(sa) * SHIN;
  const dim = (c: string) => (far ? mix(c, '#101418', 0.32) : c);
  const style = { base: dim(kit.gear), shade: dim(kit.gearShade), light: far ? undefined : kit.gearLight, shadeOff: 2.5 };
  cel(ctx, (c) => capsule(c, kx, ky, fx, fy, 5.2), style);
  cel(ctx, (c) => capsule(c, hx, hy, kx, ky, 6.4), style);
  // knee pad
  cel(ctx, (c) => circle(c, kx + Math.sin(l.t) * 0.5 + 1.5, ky, 3.6), {
    base: dim(kit.strap),
    light: far ? undefined : mix(kit.strap, '#ffffff', 0.25),
    lw: 1.5,
  });
  // boot: toe always points forward along the ground-ish
  const ba = Math.max(-0.5, Math.min(0.6, sa * 0.35));
  ctx.save();
  ctx.translate(fx, fy);
  ctx.rotate(-ba);
  cel(ctx, (c) => roundRect(c, -5, -4, 15, 8, 3), { base: dim(kit.boot), light: far ? undefined : '#5a514a', lw: 2 });
  ctx.restore();
}

function drawHead(ctx: Ctx, kit: Kit, cx: number, cy: number): void {
  // hair behind the helmet
  if (kit.hair === 'braid') {
    cel(ctx, (c) => capsule(c, cx - 7, cy + 1, cx - 11, cy + 12, 2.6), { base: kit.hairColor!, lw: 1.5 });
  } else if (kit.hair === 'ponytail') {
    cel(
      ctx,
      (c) => {
        c.moveTo(cx - 6, cy - 6);
        c.quadraticCurveTo(cx - 20, cy - 4, cx - 17, cy + 12);
        c.quadraticCurveTo(cx - 12, cy + 2, cx - 4, cy - 2);
        c.closePath();
      },
      { base: kit.hairColor!, light: '#3a3430', lw: 1.5 },
    );
  }
  // neck + face
  cel(ctx, (c) => roundRect(c, cx - 4, cy + 3, 8, 8, 2), { base: kit.skinShade, lw: 1.5 });
  cel(
    ctx,
    (c) => {
      c.moveTo(cx - 7, cy - 4);
      c.quadraticCurveTo(cx + 9, cy - 9, cx + 9, cy + 1);
      c.lineTo(cx + 10, cy + 3);
      c.quadraticCurveTo(cx + 8, cy + 9, cx + 1, cy + 9);
      c.quadraticCurveTo(cx - 7, cy + 8, cx - 7, cy - 4);
      c.closePath();
    },
    { base: kit.skin, shade: kit.skinShade, light: mix(kit.skin, '#fff3dc', 0.35), shadeOff: 2.5 },
  );
  if (kit.hair === 'beard') {
    cel(
      ctx,
      (c) => {
        c.moveTo(cx - 3, cy + 2);
        c.quadraticCurveTo(cx + 2, cy + 3, cx + 9, cy + 3);
        c.quadraticCurveTo(cx + 8, cy + 11, cx + 1, cy + 11);
        c.quadraticCurveTo(cx - 5, cy + 10, cx - 3, cy + 2);
        c.closePath();
      },
      { base: kit.hairColor!, light: mix(kit.hairColor!, '#ffd09a', 0.35), lw: 1.5 },
    );
  }
  // eye + brow
  if (!kit.faceless) {
    ctx.fillStyle = INK;
    ctx.fillRect(cx + 4, cy - 1, 2.5, 2.5);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx + 2.5, cy - 3);
    ctx.lineTo(cx + 7.5, cy - 2.4);
    ctx.stroke();
  }
  if (kit.monocle) {
    ctx.save();
    ctx.shadowColor = kit.accent;
    ctx.shadowBlur = 6;
    cel(ctx, (c) => circle(c, cx + 5.5, cy + 0.5, 3.2), { base: '#c9ff7a', light: '#ffffff', lw: 1.5 });
    ctx.restore();
  }
  // helmet
  const helm = (c: Ctx) => {
    c.moveTo(cx - 10, cy + 2);
    c.quadraticCurveTo(cx - 12, cy - 13, cx + 1, cy - 13);
    c.quadraticCurveTo(cx + 12, cy - 12, cx + 11, cy - 2);
    c.lineTo(cx + 12, cy - 1);
    c.lineTo(cx - 10, cy + 2);
    c.closePath();
  };
  if (kit.faceless) {
    // full-face helmet covering the face
    cel(
      ctx,
      (c) => {
        c.moveTo(cx - 10, cy + 4);
        c.quadraticCurveTo(cx - 12, cy - 13, cx + 1, cy - 13);
        c.quadraticCurveTo(cx + 12, cy - 12, cx + 11, cy + 2);
        c.quadraticCurveTo(cx + 10, cy + 10, cx + 1, cy + 10);
        c.quadraticCurveTo(cx - 9, cy + 10, cx - 10, cy + 4);
        c.closePath();
      },
      { base: kit.helmet, shade: kit.helmetShade, light: mix(kit.helmet, '#ffffff', 0.35) },
    );
    ctx.save();
    ctx.shadowColor = kit.visorGlow!;
    ctx.shadowBlur = 7;
    ctx.fillStyle = kit.visorGlow!;
    ctx.beginPath();
    roundRect(ctx, cx + 1, cy - 2, 10, 3.2, 1.5);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = kit.accent;
    ctx.fillRect(cx - 9, cy - 5, 6, 3);
  } else {
    cel(ctx, helm, { base: kit.helmet, shade: kit.helmetShade, light: mix(kit.helmet, '#ffffff', 0.3) });
    // visor band in the operator's colour
    ctx.save();
    ctx.beginPath();
    helm(ctx);
    ctx.clip();
    ctx.fillStyle = kit.accent;
    ctx.fillRect(cx - 14, cy - 5, 28, 3.6);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(cx - 14, cy - 5, 28, 1.1);
    ctx.restore();
    // chin strap
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx - 3, cy + 1);
    ctx.lineTo(cx + 2, cy + 8);
    ctx.stroke();
  }
}

function drawBody(ctx: Ctx, kit: Kit, pose: Pose): { x: number; y: number } {
  const hipY = pose.hipY ?? -Math.max(footDrop(pose.front), footDrop(pose.back)) - 2;
  const hx = -2;
  const hy = hipY + (pose.bob ?? 0);
  const lean = pose.lean;
  const top = hy - 27;

  drawLeg(ctx, kit, hx - 1, hy, pose.back, true);

  // backpack
  cel(ctx, (c) => roundRect(c, hx - 20 + lean, top + 1, 12, 23, 3), {
    base: kit.gearShade,
    light: kit.gear,
    shade: mix(kit.gearShade, '#000000', 0.25),
  });

  // torso / plate carrier
  const torso = (c: Ctx) => {
    c.moveTo(hx - 11, hy + 2);
    c.lineTo(hx + 10, hy + 2);
    c.quadraticCurveTo(hx + 16 + lean, hy - 12, hx + 13 + lean, top + 3);
    c.quadraticCurveTo(hx + 7 + lean, top - 3, hx - 8 + lean, top - 1);
    c.quadraticCurveTo(hx - 15 + lean, hy - 12, hx - 11, hy + 2);
    c.closePath();
  };
  cel(ctx, torso, { base: kit.gear, shade: kit.gearShade, light: kit.gearLight, shadeOff: 4 });
  // belt
  cel(ctx, (c) => roundRect(c, hx - 12, hy - 3, 23, 5.5, 1.5), { base: kit.strap, lw: 1.5 });
  // chest pouches
  for (let i = 0; i < 2; i++) {
    const px = hx - 3 + i * 6 + lean * 0.6;
    cel(ctx, (c) => roundRect(c, px, hy - 14, 5.5, 8, 1.5), {
      base: kit.gearShade,
      light: kit.gear,
      lw: 1.3,
    });
  }
  // accent stripe on the carrier (team colour)
  ctx.fillStyle = kit.accent;
  ctx.fillRect(hx - 1 + lean, top + 4, 9, 2.4);

  drawLeg(ctx, kit, hx + 1, hy, pose.front, false);

  ctx.save();
  ctx.translate(hx + 3 + lean, top - 9);
  ctx.scale(1.15, 1.15);
  drawHead(ctx, kit, 0, 0);
  ctx.restore();

  return { x: hx + 3 + lean, y: top + 5 };
}

/** Paint every body frame for a kit into one strip. */
export function paintCharacter(kit: Kit, frames: string[], extraPoses?: Record<string, Pose>): CharacterArt {
  const poses = { ...POSES, ...extraPoses };
  const [cv, ctx] = canvas(FRAME.w * frames.length, FRAME.h);
  const shoulder: CharacterArt['shoulder'] = {};
  frames.forEach((name, i) => {
    ctx.save();
    ctx.translate(i * FRAME.w + FRAME.footX, FRAME.footY);
    ctx.scale(kit.scale, kit.scale);
    const s = drawBody(ctx, kit, poses[name]);
    ctx.restore();
    shoulder[name] = { x: s.x * kit.scale, y: s.y * kit.scale };
  });
  return { strip: { canvas: cv, frameW: FRAME.w, frameH: FRAME.h, names: frames }, shoulder };
}

export const OPERATOR_FRAMES = ['idle0', 'idle1', ...Array.from({ length: 8 }, (_, i) => `run${i}`), 'jump', 'fall', 'crouch'];
export const RIFLEMAN_FRAMES = ['idle0', 'idle1', ...Array.from({ length: 6 }, (_, i) => `run${i}`)];

export function operatorPoses(): Record<string, Pose> {
  const p: Record<string, Pose> = {};
  for (let i = 0; i < 8; i++) p[`run${i}`] = runPose(i, 8, 0.68, 4);
  return p;
}

export function riflemanPoses(): Record<string, Pose> {
  const p: Record<string, Pose> = {};
  for (let i = 0; i < 6; i++) p[`run${i}`] = runPose(i, 6, 0.42, 2);
  return p;
}

/* ------------------------------------------------------------------ arms + weapons */

export const ARM = { w: 104, h: 44, pivotX: 26, pivotY: 18, gunY: 5 } as const;

function drawGun(ctx: Ctx, kind: WeaponKind, accent: string): number {
  const metal = { base: '#33363a', shade: '#1f2124', light: '#6a6f76', shadeOff: 2 };
  const y = ARM.gunY;
  switch (kind) {
    case 'smg':
      cel(ctx, (c) => roundRect(c, 14, y + 2, 5, 13, 1.5), metal); // magazine
      cel(ctx, (c) => roundRect(c, -2, y - 1, 8, 6, 2), metal); // stub stock
      cel(ctx, (c) => roundRect(c, 4, y - 4, 26, 9, 2.5), metal);
      cel(ctx, (c) => roundRect(c, 28, y - 1.5, 10, 4, 1.5), metal);
      ctx.fillStyle = accent;
      ctx.fillRect(8, y - 3, 10, 2);
      return 38;
    case 'lmg':
      cel(ctx, (c) => roundRect(c, -10, y - 3, 14, 9, 3), metal); // stock
      cel(ctx, (c) => roundRect(c, 10, y + 3, 13, 11, 2), { ...metal, base: '#4a4f45' }); // box mag
      cel(ctx, (c) => roundRect(c, 2, y - 5, 32, 11, 3), metal);
      cel(ctx, (c) => roundRect(c, 32, y - 2.5, 18, 5, 2), metal);
      cel(ctx, (c) => poly(c, [36, y + 2, 40, y + 2, 46, y + 9, 43, y + 10]), metal); // folded bipod
      cel(ctx, (c) => roundRect(c, 12, y - 9, 12, 5, 2), metal); // carry handle
      ctx.fillStyle = accent;
      ctx.fillRect(6, y - 3, 14, 2.2);
      return 50;
    case 'dmr':
      cel(ctx, (c) => poly(c, [-12, y - 2, 4, y - 3, 4, y + 5, -10, y + 7]), metal); // stock
      cel(ctx, (c) => roundRect(c, 2, y - 3, 34, 7, 2.5), metal);
      cel(ctx, (c) => roundRect(c, 34, y - 1.5, 22, 3.5, 1.5), metal); // long barrel
      cel(ctx, (c) => roundRect(c, 10, y - 9, 18, 5, 2.5), metal); // scope
      ctx.save();
      ctx.shadowColor = accent;
      ctx.shadowBlur = 6;
      ctx.fillStyle = accent;
      ctx.beginPath();
      circle(ctx, 28, y - 6.5, 2);
      ctx.fill();
      ctx.fillRect(6, y - 1, 24, 1.8);
      ctx.restore();
      cel(ctx, (c) => roundRect(c, 15, y + 3, 5, 8, 1.5), metal); // mag
      return 56;
    case 'rifle':
      cel(ctx, (c) => roundRect(c, -8, y - 2, 12, 7, 2), metal);
      cel(ctx, (c) => poly(c, [14, y + 3, 19, y + 3, 22, y + 13, 17, y + 14]), metal);
      cel(ctx, (c) => roundRect(c, 2, y - 4, 28, 8, 2.5), metal);
      cel(ctx, (c) => roundRect(c, 28, y - 1.5, 12, 3.5, 1.5), metal);
      ctx.fillStyle = accent;
      ctx.fillRect(6, y - 3, 8, 2);
      return 40;
  }
}

function drawArms(ctx: Ctx, kit: Kit, kind: WeaponKind): number {
  const y = ARM.gunY;
  const far = { base: mix(kit.gear, '#101418', 0.3), shade: mix(kit.gearShade, '#101418', 0.3), shadeOff: 2 };
  const glove = { base: kit.strap, light: mix(kit.strap, '#ffffff', 0.2), lw: 1.5 };
  const fore = kind === 'smg' ? 24 : kind === 'rifle' ? 26 : 30;
  // far arm reaches the handguard, behind the gun
  cel(ctx, (c) => capsule(c, 2, 2, 12, 12, 4.2), far);
  cel(ctx, (c) => capsule(c, 12, 12, fore, y + 2, 3.8), far);
  cel(ctx, (c) => circle(c, fore, y + 2, 3.4), glove);
  const muzzle = drawGun(ctx, kind, kit.accent);
  // near arm on the grip
  const arm = { base: kit.gear, shade: kit.gearShade, light: kit.gearLight, shadeOff: 2.5 };
  cel(ctx, (c) => capsule(c, -1, 0, 3, 12, 5), arm);
  cel(ctx, (c) => capsule(c, 3, 12, 13, y + 4, 4.4), arm);
  cel(ctx, (c) => circle(c, 13, y + 4, 3.6), glove);
  // shoulder patch: three small chevrons in the team colour
  ctx.fillStyle = kit.accent;
  for (let i = 0; i < 3; i++) ctx.fillRect(-3 + i * 2.4, 1, 1.6, 4);
  return muzzle;
}

export interface ArmArt {
  right: HTMLCanvasElement;
  /** Vertically mirrored copy for facing left (pivot y is mirrored too). */
  left: HTMLCanvasElement;
  /** Muzzle distance from the pivot along the aim line, and the gun line offset. */
  muzzle: number;
  gunY: number;
}

export function paintArms(kit: Kit, kind: WeaponKind): ArmArt {
  const [r, rc] = canvas(ARM.w, ARM.h);
  rc.translate(ARM.pivotX, ARM.pivotY);
  rc.scale(kit.scale, kit.scale);
  const muzzle = drawArms(rc, kit, kind) * kit.scale;
  const [l, lc] = canvas(ARM.w, ARM.h);
  lc.translate(0, ARM.h);
  lc.scale(1, -1);
  lc.drawImage(r, 0, 0);
  return { right: r, left: l, muzzle, gunY: ARM.gunY * kit.scale };
}

/** Square HUD portrait: head and shoulders on a dark panel with a colour rim. */
export function paintPortrait(kit: Kit, size = 64): HTMLCanvasElement {
  const [cv, ctx] = canvas(size, size);
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, '#1d3a33');
  g.addColorStop(1, '#0c1714');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.save();
  ctx.translate(size * 0.42, size * 0.62);
  ctx.scale(size / 34, size / 34);
  cel(ctx, (c) => roundRect(c, -12, 8, 26, 20, 6), { base: kit.gear, shade: kit.gearShade, light: kit.gearLight });
  ctx.fillStyle = kit.accent;
  ctx.fillRect(-4, 12, 10, 2.4);
  drawHead(ctx, kit, 1, -2);
  ctx.restore();
  ctx.strokeStyle = '#' + kit.accent.slice(1);
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, size - 3, size - 3);
  return cv;
}
