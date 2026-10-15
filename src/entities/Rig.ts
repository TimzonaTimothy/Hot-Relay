/**
 * Cut-out character rig: two legs, torso, head and a weapon arm that rotates to any aim angle.
 * Purely visual; physics lives on the invisible sprite that owns the rig.
 *
 * Animation is procedural and blended: every state sets joint targets, and joints ease toward
 * them, so switching state never snaps. The whole body pivots at the hip, which lets swimmers
 * lie horizontal and turn smoothly toward their swim direction.
 */
import Phaser from 'phaser';
import { PART_RES, PARTS, RIG_ATLAS, armKey, type RigId } from '../art/characters';
import type { WeaponId } from '../data/weapons';
import type { AnimState } from '../systems/anim';
import type { Vec } from '../systems/aim';
import { FLAGS } from '../systems/flags';

/** ?debug=1&rigs=off: never draw rigs (bodies and logic still run) to measure their cost. */
const RIGS_HIDDEN = FLAGS.debug && FLAGS.rigsOff;

/** On-screen size of rigs relative to their drawn parts. */
export const RIG_SCALE = 0.8;

// Joint positions in rig-local units (feet at 0,0; up is negative).
const HIP_Y = -10;
const SHOULDER = { x: 1.2, y: -17.6 };
const NECK = { x: 0.6, y: -20.4 };
/** How far a prone body drops so it lies on the ground (world px, before rig scale). */
const PRONE_SINK = 6.2;
/** Body pivot (hips), measured up from the feet, in rig units. */
export const PIVOT = 11;

export interface RigParams {
  state: AnimState;
  /** Time spent in the current state (ms). */
  stateMs: number;
  vx: number;
  vy: number;
  runSpeed: number;
  aim: Vec;
  facing: 1 | -1;
  /** Can the arm aim (weapon usable here)? If false, the arm strokes instead (swimming). */
  armReady: boolean;
  /** Reload progress 0..1, or null when not reloading. */
  reload: number | null;
  /** Swim heading for underwater orientation (world space). */
  swimDir: Vec;
  /** Somersault progress 0..1 while flipping, else null. */
  flip?: number | null;
}

interface Pose {
  legF: number;
  legB: number;
  torso: number;
  head: number;
  /** Arm angle override in local space, or null to aim. */
  arm: number | null;
  /** Whole-body rotation (local, before facing), radians. */
  body: number;
  drop: number;
  bob: number;
  /** Extra downward offset of the whole body (lying down), world px. */
  sink: number;
}

const easeInOut = (t: number) => -(Math.cos(Math.PI * Math.min(1, Math.max(0, t))) - 1) / 2;

const ease = (cur: number, target: number, rate: number, dt: number) =>
  cur + (target - cur) * Math.min(1, dt * rate);

export class Rig {
  readonly root: Phaser.GameObjects.Container;
  private readonly inner: Phaser.GameObjects.Container;
  private legB: Phaser.GameObjects.Image;
  private legF: Phaser.GameObjects.Image;
  private torso: Phaser.GameObjects.Image;
  private head: Phaser.GameObjects.Image;
  private arm: Phaser.GameObjects.Image;
  private phase = 0;
  private t = 0;
  private recoilMs = 0;
  private recoilPx = 1.3;
  private flashMs = 0;
  private squash = 1;
  private cur: Pose = {
    legF: 0,
    legB: 0,
    torso: 0,
    head: 0,
    arm: null,
    body: 0,
    drop: 0,
    bob: 0,
    sink: 0,
  };
  private armEased = 0;
  private bodyRot = 0;
  /** Extra somersault rotation, finished forward to a full turn after landing. */
  private flipRot = 0;
  id: RigId;
  weapon: WeaponId;
  readonly scale: number;

  constructor(scene: Phaser.Scene, id: RigId, weapon: WeaponId, depth: number, scale = RIG_SCALE) {
    this.id = id;
    this.weapon = weapon;
    this.scale = scale;
    const img = (frame: string, d: { w: number; h: number; px: number; py: number }) =>
      scene.add
        .image(0, 0, RIG_ATLAS, frame)
        .setOrigin(d.px / d.w, d.py / d.h)
        .setScale(1 / PART_RES);
    this.legB = img(`${id}-legB`, PARTS.leg);
    this.torso = img(`${id}-torso`, PARTS.torso);
    this.legF = img(`${id}-leg`, PARTS.leg);
    this.head = img(`${id}-head`, PARTS.head);
    this.arm = img(armKey(id, weapon), PARTS.arm);
    this.inner = scene.add.container(0, PIVOT, [
      this.legB,
      this.torso,
      this.legF,
      this.head,
      this.arm,
    ]);
    this.root = scene.add.container(0, 0, [this.inner]);
    this.root.setDepth(depth).setScale(scale).setVisible(!RIGS_HIDDEN);
    this.layout();
  }

  setId(id: RigId, weapon: WeaponId): void {
    this.id = id;
    this.weapon = weapon;
    this.legB.setFrame(`${id}-legB`, false, false);
    this.legF.setFrame(`${id}-leg`, false, false);
    this.torso.setFrame(`${id}-torso`, false, false);
    this.head.setFrame(`${id}-head`, false, false);
    this.arm.setFrame(armKey(id, weapon), false, false);
  }

  setWeapon(weapon: WeaponId): void {
    this.weapon = weapon;
    this.arm.setFrame(armKey(this.id, weapon), false, false);
  }

  /** Recoil kick along the aim line. */
  kick(px = 1.3): void {
    this.recoilMs = 60;
    this.recoilPx = px;
  }

  /** Landing squash; strength 0..1 from impact speed. */
  land(strength = 1): void {
    this.squash = 1 - 0.16 * Math.min(1, strength);
  }

  flash(ms = 70): void {
    this.flashMs = ms;
    for (const p of this.parts()) p.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
  }

  private parts(): Phaser.GameObjects.Image[] {
    return [this.legB, this.legF, this.torso, this.head, this.arm];
  }

  private layout(): void {
    const { drop, bob } = this.cur;
    this.legB.setPosition(-1.2, HIP_Y + drop + bob * 0.3);
    this.legF.setPosition(1.0, HIP_Y + drop + bob * 0.3);
    this.torso.setPosition(0, HIP_Y + drop + bob);
    this.head.setPosition(NECK.x, NECK.y + drop + bob);
    this.arm.setPosition(SHOULDER.x, SHOULDER.y + drop + bob);
  }

  /** Target pose for a state. Angles are local (rig facing right). */
  private target(p: RigParams, dt: number): Pose {
    const pose: Pose = {
      legF: 0.04,
      legB: -0.04,
      torso: 0,
      head: 0,
      arm: null,
      body: 0,
      drop: 0,
      bob: 0,
      sink: 0,
    };
    const speed = Math.abs(p.vx);
    switch (p.state) {
      case 'idle':
        pose.bob = Math.sin(this.t * 2.6) * 0.3;
        break;
      case 'walk':
      case 'run': {
        const run = p.state === 'run';
        this.phase += speed * dt * (run ? 0.115 : 0.13);
        const s = Math.sin(this.phase);
        const amp = run ? 0.85 : 0.5;
        pose.legF = s * amp;
        pose.legB = -s * amp;
        pose.bob = -Math.abs(Math.cos(this.phase)) * (run ? 1.1 : 0.55);
        pose.torso = run ? 0.08 : 0.03;
        break;
      }
      case 'jump':
        pose.legF = -0.7;
        pose.legB = 0.5;
        pose.torso = -0.04;
        break;
      case 'fall':
        pose.legF = -0.25;
        pose.legB = 0.38;
        break;
      case 'land':
        pose.legF = -0.6;
        pose.legB = 0.5;
        pose.drop = 2.2;
        break;
      case 'aim':
      case 'shoot': {
        // braced stance: feet apart, weight forward, a small kick on each shot
        pose.legF = 0.34;
        pose.legB = -0.3;
        pose.torso = 0.07;
        pose.drop = 0.8;
        pose.bob =
          p.state === 'shoot' ? Math.sin(this.t * 40) * 0.25 : Math.sin(this.t * 2.6) * 0.2;
        break;
      }
      case 'takeoff':
        // the crouch-and-push frame before leaving the ground
        pose.legF = -0.55;
        pose.legB = 0.45;
        pose.torso = 0.18;
        pose.drop = 2.6;
        break;
      case 'flip':
        // tucked: knees to chest, torso curled; the spin itself is applied in update()
        pose.legF = -1.75;
        pose.legB = -1.35;
        pose.torso = 0.32;
        pose.head = 0.2;
        pose.drop = 2.2;
        break;
      case 'proneEnter':
      case 'prone':
      case 'proneShoot':
      case 'proneExit': {
        // lying on the stomach, head towards the facing side; the gun stays aimed
        const down = p.state === 'proneEnter' || p.state === 'proneExit' ? 0.55 : 1;
        pose.body = (Math.PI / 2) * down;
        pose.legF = 0.05;
        pose.legB = -0.08 + (p.state === 'prone' ? Math.sin(this.t * 2) * 0.03 : 0);
        pose.head = -0.55 * down;
        pose.torso = 0;
        pose.sink = PRONE_SINK * down;
        if (p.state === 'proneShoot') pose.bob = Math.sin(this.t * 40) * 0.2;
        break;
      }
      case 'dash':
        pose.body = 0.38;
        pose.legF = -0.9;
        pose.legB = 0.85;
        pose.torso = 0.1;
        pose.drop = 1.2;
        break;
      case 'runShoot': {
        // run cycle with a steadier upper body so the aim reads
        this.phase += speed * dt * 0.115;
        const s = Math.sin(this.phase);
        pose.legF = s * 0.8;
        pose.legB = -s * 0.8;
        pose.bob = -Math.abs(Math.cos(this.phase)) * 0.6;
        pose.torso = 0.04;
        break;
      }
      case 'slide':
        pose.body = -0.55;
        pose.legF = -1.35;
        pose.legB = -0.9;
        pose.drop = 3;
        break;
      case 'hurt':
        pose.torso = -0.22;
        pose.head = -0.25;
        pose.legF = 0.25;
        pose.legB = -0.3;
        pose.body = -0.12;
        break;
      case 'dead':
        pose.body = -1.45;
        pose.legF = -0.3;
        pose.legB = 0.2;
        pose.head = -0.3;
        pose.arm = 0.4;
        pose.sink = 6;
        break;
      case 'victory':
        pose.arm = -1.35;
        pose.legF = 0.28;
        pose.legB = -0.28;
        pose.bob = -Math.abs(Math.sin(this.t * 6)) * 1.6;
        pose.head = -0.15;
        break;
      case 'rope':
        pose.arm = -1.55;
        pose.legF = 0.12 + Math.sin(this.t * 3) * 0.08;
        pose.legB = -0.05 + Math.sin(this.t * 3 + 1) * 0.08;
        pose.head = -0.1;
        break;
      case 'climb':
        pose.body = 0.18;
        pose.legF = -1.0;
        pose.legB = 0.6;
        pose.drop = 3;
        pose.arm = -1.1;
        break;
      case 'swimSurface': {
        // treading water: upright-ish, legs pedalling, head above the line
        const lean = speed > 10 ? 0.35 : 0.12;
        pose.body = lean;
        pose.legF = Math.sin(this.t * 7) * 0.45 - 0.2;
        pose.legB = -Math.sin(this.t * 7) * 0.45 + 0.1;
        pose.bob = Math.sin(this.t * 3) * 0.8;
        if (!p.armReady) pose.arm = -0.6 + Math.sin(this.t * 6) * 0.7;
        break;
      }
      case 'swimUnder': {
        // body lies along the swim heading; hovering in place sits half-upright
        const moving = Math.hypot(p.swimDir.x, p.swimDir.y) > 0.2;
        if (moving) {
          const pitch = Math.atan2(-p.swimDir.y, Math.abs(p.swimDir.x) + 1e-3); // + = heading up
          pose.body = Phaser.Math.Clamp(Math.PI / 2 - pitch, 0.15, Math.PI - 0.15);
        } else {
          pose.body = 0.9;
        }
        const kick = moving ? 14 : 6;
        pose.legF = Math.sin(this.t * kick) * 0.32;
        pose.legB = -Math.sin(this.t * kick) * 0.32;
        if (!p.armReady) pose.arm = -1.3 + Math.sin(this.t * 4) * 0.9;
        break;
      }
    }
    return pose;
  }

  update(dtMs: number, p: RigParams, x: number, feetY: number): void {
    const dt = dtMs / 1000;
    this.t += dt;
    const tg = this.target(p, dt);
    const c = this.cur;
    c.legF = ease(c.legF, tg.legF, 22, dt);
    c.legB = ease(c.legB, tg.legB, 22, dt);
    c.torso = ease(c.torso, tg.torso, 16, dt);
    c.head = ease(c.head, tg.head, 16, dt);
    c.drop = ease(c.drop, tg.drop, 18, dt);
    c.bob = ease(c.bob, tg.bob, 30, dt);
    c.sink = ease(c.sink, tg.sink, 8, dt);
    this.bodyRot = ease(this.bodyRot, tg.body, p.state === 'dead' ? 6 : 10, dt);
    this.squash = ease(this.squash, 1, 12, dt);
    this.layout();

    // the root sits at the hip pivot so rotation turns the body about its middle
    const s = this.scale;
    this.root.setPosition(x, feetY - PIVOT * s + c.sink);
    this.root.scaleX = s * p.facing;
    this.root.scaleY = s * this.squash;
    // somersault: follow the controller's progress; if it ends early (short hop, landing),
    // finish the turn forward quickly rather than unwinding backwards
    if (p.flip !== null && p.flip !== undefined) {
      this.flipRot = Math.max(this.flipRot, easeInOut(p.flip) * Math.PI * 2);
    } else if (this.flipRot > 0) {
      this.flipRot += dt * 22;
      if (this.flipRot >= Math.PI * 2) this.flipRot = 0;
    }
    if (this.flipRot >= Math.PI * 2 - 1e-3) this.flipRot = 0;
    this.root.rotation = (this.bodyRot + this.flipRot) * p.facing;

    this.legF.rotation = c.legF;
    this.legB.rotation = c.legB;
    this.torso.rotation = c.torso;

    // arm: aim in world space, compensating for body rotation and facing
    const worldAim = Math.atan2(p.aim.y, p.aim.x);
    const rel = worldAim - this.root.rotation;
    let armTarget = Math.atan2(Math.sin(rel), p.facing * Math.cos(rel));
    if (tg.arm !== null) armTarget = tg.arm;
    if (p.reload !== null) armTarget += 0.9 * Math.sin(Math.min(1, p.reload) * Math.PI);
    const aimingNow = tg.arm === null && p.reload === null;
    this.armEased = aimingNow ? armTarget : ease(this.armEased, armTarget, 18, dt);
    this.arm.rotation = this.armEased;
    this.head.rotation = c.head + Phaser.Math.Clamp(this.armEased * 0.3, -0.35, 0.3);
    if (this.recoilMs > 0) {
      this.recoilMs -= dtMs;
      this.arm.x -= Math.cos(this.armEased) * this.recoilPx;
      this.arm.y -= Math.sin(this.armEased) * this.recoilPx;
    }

    if (this.flashMs > 0) {
      this.flashMs -= dtMs;
      if (this.flashMs <= 0)
        for (const part of this.parts()) part.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    }
  }

  /** Shoulder in world space (follows body rotation, crouch and bob). */
  shoulder(): Vec {
    const m = this.root.getWorldTransformMatrix();
    const lx = SHOULDER.x;
    const ly = SHOULDER.y + this.cur.drop + this.cur.bob + PIVOT;
    return { x: m.getX(lx, ly), y: m.getY(lx, ly) };
  }

  /** Muzzle in world space for a barrel `muzzle` rig units from the shoulder. */
  muzzle(aim: Vec, muzzle: number): Vec {
    const sh = this.shoulder();
    const len = muzzle * this.scale;
    return { x: sh.x + aim.x * len, y: sh.y + aim.y * len };
  }

  /** Where spent casings come out: a little along the weapon from the shoulder. */
  ejectionPort(aim: Vec): Vec {
    const sh = this.shoulder();
    return { x: sh.x + aim.x * 7 * this.scale, y: sh.y + aim.y * 7 * this.scale - 1 };
  }

  /** Tint every part; ADD mode brightens (telegraph glints), MULTIPLY darkens (water, stun). */
  setTint(color: number | null, mode: Phaser.TintModes = Phaser.TintModes.MULTIPLY): void {
    if (this.flashMs > 0) return;
    for (const part of this.parts()) {
      if (color === null) part.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
      else part.setTint(color).setTintMode(mode);
    }
  }

  get x(): number {
    return this.root.x;
  }

  get y(): number {
    return this.root.y;
  }

  setAlpha(a: number): void {
    this.root.setAlpha(a);
  }

  setVisible(v: boolean): void {
    this.root.setVisible(v && !RIGS_HIDDEN);
  }

  setDepth(d: number): void {
    this.root.setDepth(d);
  }

  destroy(): void {
    this.root.destroy();
  }
}
