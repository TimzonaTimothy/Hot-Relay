import Phaser from 'phaser';
import { DEPTH } from '../config/constants';
import { TUNING } from '../config/tuning';
import { ARM, FRAME } from '../art/characters';
import { rig } from '../art/registry';
import type { OperatorDef } from '../data/operators';
import { JumpController } from '../systems/JumpController';
import { aimAngle } from '../systems/aim';
import type { InputFrame } from '../systems/InputManager';
import type { SfxName } from '../systems/Sfx';

export interface ShotOpts {
  texture: string;
  speed: number;
  damage: number;
  pierce: number;
  scale?: number;
}

/** What the player may ask of the stage. */
export interface PlayerContext {
  fire(x: number, y: number, angle: number, shot: ShotOpts): void;
  muzzleFlash(x: number, y: number, angle: number): void;
  sfx(name: SfxName): void;
  /** Touch aim-assist; returns the angle unchanged when off. */
  assist(angle: number, x: number, y: number): number;
  standingOnPlatform(body: Phaser.Physics.Arcade.Body): boolean;
  /** Rurik's ground-pound landed. */
  pound(x: number, y: number): void;
  dust(x: number, y: number): void;
}

const BODY_W = 28;
const BODY_H = 74;
const CROUCH_H = 48;

type Entry = { kind: 'slide' | 'pound' | 'pierce'; t: number } | null;

export class Player extends Phaser.Physics.Arcade.Sprite {
  op!: OperatorDef;
  facing: 1 | -1 = 1;
  aim = 0;
  grounded = false;
  crouching = false;
  invuln = 0;
  dropTimer = 0;
  alive = true;
  /** Debug god mode for the smoke-test bot. */
  god = false;
  readonly arm: Phaser.GameObjects.Image;
  private readonly jumpCtl = new JumpController(TUNING.jump);
  private fireTimer = 0;
  private recoil = 0;
  private entry: Entry = null;
  private wasGrounded = false;
  private blink = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, op: OperatorDef) {
    super(scene, x, y, `op_${op.id}`, 'idle0');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, FRAME.footY / FRAME.h).setDepth(DEPTH.player);
    this.arm = scene.add.image(x, y, `arm_${op.id}_r`).setDepth(DEPTH.player + 1);
    (this.body as Phaser.Physics.Arcade.Body).setMaxVelocityY(TUNING.maxFall);
    this.setOperator(op);
  }

  get pbody(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  get entering(): boolean {
    return this.entry !== null;
  }

  setOperator(op: OperatorDef): void {
    this.op = op;
    this.setTexture(`op_${op.id}`, 'idle0');
    this.fireTimer = 0;
    this.entry = null;
    this.setHitbox(false);
  }

  private setHitbox(crouch: boolean): void {
    const s = this.op.id === 'rurik' ? 1.08 : 1;
    const h = (crouch ? CROUCH_H : BODY_H) * s;
    this.pbody.setSize(BODY_W, h);
    this.pbody.setOffset(FRAME.footX - BODY_W / 2, FRAME.footY - h);
  }

  /** Tag in with the operator's entry attack and brief invulnerability. */
  startEntry(): void {
    this.invuln = Math.max(this.invuln, TUNING.relay.entryInvuln);
    this.entry = { kind: this.op.entry, t: 0 };
  }

  respawn(x: number, y: number, invuln: number): void {
    this.alive = true;
    this.setVisible(true);
    this.arm.setVisible(true);
    this.setPosition(x, y);
    this.pbody.reset(x, y);
    this.pbody.setVelocity(0, 0);
    this.pbody.enable = true;
    this.jumpCtl.reset();
    this.invuln = invuln;
    this.entry = null;
  }

  knockOut(): void {
    this.alive = false;
    this.entry = null;
    this.pbody.setVelocity(0, 0);
    this.pbody.enable = false;
    this.setVisible(false);
    this.arm.setVisible(false);
  }

  /** The point the gun pivots on, in world space. */
  shoulder(): { x: number; y: number } {
    const name = String(this.frame.name);
    const r = rig(this.op.id);
    const s = r.shoulder[name] ?? r.shoulder.idle0;
    return { x: this.x + s.x * this.facing, y: this.y + s.y };
  }

  muzzle(angle = this.aim): { x: number; y: number } {
    const r = rig(this.op.id);
    const s = this.shoulder();
    const gy = this.facing > 0 ? r.gunY : -r.gunY;
    const c = Math.cos(angle);
    const n = Math.sin(angle);
    return { x: s.x + c * r.muzzle - n * gy, y: s.y + n * r.muzzle + c * gy };
  }

  tick(dt: number, f: InputFrame, ctx: PlayerContext): void {
    if (!this.alive) return;
    const body = this.pbody;
    this.invuln = Math.max(0, this.invuln - dt);
    this.dropTimer = Math.max(0, this.dropTimer - dt);
    this.recoil = Math.max(0, this.recoil - dt * 40);
    this.grounded = body.blocked.down || body.touching.down;
    if (this.grounded && !this.wasGrounded && body.velocity.y >= 0) ctx.dust(this.x, this.y);
    this.wasGrounded = this.grounded;

    if (this.entry && this.tickEntry(dt, ctx)) return;

    const h = f.right ? 1 : f.left ? -1 : 0;
    if (h !== 0) this.facing = h as 1 | -1;
    const crouch = this.grounded && f.down && h === 0;
    if (crouch !== this.crouching) {
      this.crouching = crouch;
      this.setHitbox(crouch);
    }
    const planted = crouch || (f.lock && this.grounded);
    const target = planted ? 0 : h * this.op.runSpeed;
    const R = TUNING.run;
    const accel = this.grounded ? (h !== 0 ? R.accelGround : R.frictionGround) : h !== 0 ? R.accelAir : R.frictionAir;
    body.setVelocityX(approach(body.velocity.x, target, accel * dt));

    if (f.down && f.jumpPressed && this.grounded && ctx.standingOnPlatform(body)) {
      this.dropTimer = TUNING.jump.dropTime;
      this.y += 2;
      this.jumpCtl.reset();
    } else {
      const j = this.jumpCtl.tick(dt, this.grounded, f.jumpPressed, f.jump, body.velocity.y);
      if (j.jump) {
        body.setVelocityY(-TUNING.jump.velocity * this.op.jumpScale);
        this.grounded = false;
        ctx.sfx('jump');
      } else if (j.cut) {
        body.setVelocityY(body.velocity.y * TUNING.jump.cutMultiplier);
      }
    }

    let a = aimAngle(f, this.facing, this.grounded);
    if (crouch) a = this.facing > 0 ? 0 : Math.PI;
    if (f.source === 'touch') {
      const s = this.shoulder();
      a = ctx.assist(a, s.x, s.y);
    }
    this.aim = a;

    this.fireTimer -= dt;
    if (f.fire && this.fireTimer <= 0) {
      this.shoot(ctx);
      this.fireTimer = 1 / this.op.weapon.rate;
    }
  }

  /** Returns true while the entry attack owns movement. */
  private tickEntry(dt: number, ctx: PlayerContext): boolean {
    const e = this.entry!;
    const body = this.pbody;
    e.t += dt;
    switch (e.kind) {
      case 'slide':
        // Kemi: low slide along the ground firing a burst forward.
        if (e.t === dt) this.setHitbox(true);
        this.crouching = true;
        this.aim = this.facing > 0 ? 0 : Math.PI;
        body.setVelocityX(this.facing * 640 * Math.max(0.3, 1 - e.t / 0.4));
        this.fireTimer -= dt;
        if (this.fireTimer <= 0) {
          this.shoot(ctx);
          this.fireTimer = 0.055;
        }
        if (e.t > 0.38) {
          this.entry = null;
          this.crouching = false;
          this.setHitbox(false);
        }
        return true;
      case 'pound':
        // Rurik: slam down, shockwave on landing.
        body.setVelocityX(0);
        if (!this.grounded) {
          body.setVelocityY(1200);
          if (e.t < 3) return true;
        }
        ctx.pound(this.x, this.y);
        this.entry = null;
        return true;
      case 'pierce':
        // Mei-Lin: one charged round that passes through everything in line.
        this.entry = null;
        {
          const m = this.muzzle();
          ctx.fire(m.x, m.y, this.aim, { texture: 'bullet_dmr', speed: 1900, damage: 6, pierce: 99, scale: 1.7 });
          ctx.muzzleFlash(m.x, m.y, this.aim);
          ctx.sfx('dmr');
          this.recoil = 4;
        }
        return false;
    }
  }

  private shoot(ctx: PlayerContext): void {
    const w = this.op.weapon;
    const m = this.muzzle();
    const angle = this.aim + (Math.random() * 2 - 1) * w.spread;
    ctx.fire(m.x, m.y, angle, {
      texture: `bullet_${w.tracer}`,
      speed: TUNING.bullet.playerSpeed * w.speedScale,
      damage: w.damage,
      pierce: w.pierce,
    });
    ctx.muzzleFlash(m.x, m.y, this.aim);
    ctx.sfx(w.tracer);
    this.recoil = w.tracer === 'dmr' ? 4 : 2;
  }

  /** After physics: frame, flip, arm, blink. */
  sync(dt: number, flashing: boolean): void {
    if (!this.alive) return;
    const id = this.op.id;
    const body = this.pbody;
    this.setFlipX(this.facing < 0);
    if (!this.grounded && !this.crouching) {
      this.anims.stop();
      this.setFrame(body.velocity.y < 0 ? 'jump' : 'fall');
    } else if (this.crouching) {
      this.anims.stop();
      this.setFrame('crouch');
    } else if (Math.abs(body.velocity.x) > 30) {
      if (this.anims.currentAnim?.key !== `op_${id}_run` || !this.anims.isPlaying) this.play(`op_${id}_run`);
    } else if (this.anims.currentAnim?.key !== `op_${id}_idle` || !this.anims.isPlaying) {
      this.play(`op_${id}_idle`);
    }

    const s = this.shoulder();
    const right = this.facing > 0;
    const back = this.recoil;
    this.arm
      .setTexture(right ? `arm_${id}_r` : `arm_${id}_l`)
      .setOrigin(ARM.pivotX / ARM.w, (right ? ARM.pivotY : ARM.h - ARM.pivotY) / ARM.h)
      .setPosition(s.x - Math.cos(this.aim) * back, s.y - Math.sin(this.aim) * back)
      .setRotation(this.aim);

    this.blink += dt;
    const a = this.invuln > 0 ? (flashing ? (Math.floor(this.blink * 20) % 2 ? 0.35 : 1) : 0.6) : 1;
    this.setAlpha(a);
    this.arm.setAlpha(a);
  }

  destroyAll(): void {
    this.arm.destroy();
    this.destroy();
  }
}

function approach(v: number, target: number, step: number): number {
  if (v < target) return Math.min(target, v + step);
  if (v > target) return Math.max(target, v - step);
  return v;
}
