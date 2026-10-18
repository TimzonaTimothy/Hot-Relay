/**
 * The Contra-inspired enemy set (original designs, themed to Nullward's harbour forces):
 * - Runner: sprints straight at the player, hops gaps, dies in one hit.
 * - Turret: wall-mounted gun, or a hatch gun that rises from the deck when you come close;
 *   turns in 45° steps and fires once lined up.
 * - SupplyDrone: crosses the sky; shooting it down drops a pickup crate.
 * - Frogman: surfaces in the water to lob a grenade, then dives (untouchable while under).
 * - GateCore: the Lock Gate's core, shielded until both gate cannons are destroyed.
 */
import Phaser from 'phaser';
import { Enemy, type EnemyContext, type EnemyVisualWorld } from './Enemy';
import { Rig, RIG_SCALE } from './Rig';
import { COLORS, DEPTH } from '../config/constants';
import { FX_RES } from '../art/fx';
import { AnimStateMachine } from '../systems/anim';
import { groundBelow, type Rect } from '../systems/geometry';
import { snap8 } from '../systems/aim';
import { sfx } from '../systems/Sfx';
import type { WaterVolume } from '../systems/water';
import type { PickupKind } from '../data/stages/types';

const S = 1 / FX_RES;

/* ------------------------------------------------------------------ runner */

const RUN_SPEED = 128;
const RUN_JUMP = 300;

export class Runner extends Enemy {
  private readonly anim = new AnimStateMachine();
  private readonly dir: 1 | -1;
  private corpse: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    ms: number;
    floor: number;
  } | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    feetY: number,
    dir: 1 | -1,
    private readonly platforms: readonly Rect[],
    private readonly worldH: number,
  ) {
    super(scene, x, feetY - 10, 'hitbox', 1);
    this.dir = dir;
    this.setVisible(false);
    this.arcadeBody.setSize(10, 18).setOffset(1, 2);
    this.arcadeBody.setMaxVelocityY(420);
    this.rig = new Rig(scene, 'runner', 'p9', DEPTH.enemies, RIG_SCALE * 0.94);
  }

  protected think(dtMs: number, ctx: EnemyContext): void {
    const body = this.arcadeBody;
    const grounded = body.blocked.down || body.touching.down;
    body.setVelocityX(this.dir * RUN_SPEED);
    if (grounded) {
      // hop when the deck runs out ahead (gaps, channels), like a soldier vaulting a gap
      const ahead = groundBelow(this.platforms, this.x + this.dir * 12, body.bottom - 2, 24);
      if (ahead === null) body.setVelocityY(-RUN_JUMP);
    }
    if (!this.engaged && this.isOnScreen(ctx.view, -6)) {
      this.engaged = true;
      ctx.onEngage(this);
    }
    // ran off the far side of the screen, or into the sea: gone without a kill
    const gone =
      (this.dir < 0 && this.x < ctx.view.x - 40) ||
      (this.dir > 0 && this.x > ctx.view.right + 40) ||
      this.y > this.worldH + 10 ||
      ctx.water.some((w) => this.x > w.x && this.x < w.x + w.w && body.bottom > w.y + 6);
    if (gone) this.despawn();
    this.anim.step(dtMs, {
      grounded,
      vx: body.velocity.x,
      vy: body.velocity.y,
      runSpeed: RUN_SPEED * 0.8,
      crouch: false,
      sliding: false,
      spinning: false,
      inWater: false,
      submerged: false,
      climbing: false,
      onRope: false,
      dead: false,
      victory: false,
      hurt: false,
    });
  }

  override syncVisual(frameMs: number, world: EnemyVisualWorld): void {
    const rig = this.rig;
    if (!rig) return;
    if (this.corpse) {
      const c = this.corpse;
      const dt = frameMs / 1000;
      c.ms += frameMs;
      c.vy += 600 * dt;
      c.x += c.vx * dt;
      c.floor = groundBelow(world.platforms, c.x, Math.min(c.y, c.floor) - 1, 400) ?? c.floor;
      c.y = Math.min(c.floor, c.y + c.vy * dt);
      rig.update(frameMs, this.params('dead'), c.x, c.y);
      rig.setAlpha(c.ms < 600 ? 1 : Math.max(0, 1 - (c.ms - 600) / 400));
      if (c.ms > 1000) {
        rig.setVisible(false);
        this.corpse = null;
      }
      return;
    }
    if (this.dead) return;
    rig.update(frameMs, this.params(this.anim.state), this.x, this.arcadeBody.bottom);
  }

  private params(state: Parameters<Rig['update']>[1]['state']) {
    return {
      state,
      stateMs: this.anim.timeMs,
      vx: this.arcadeBody.velocity.x,
      vy: this.arcadeBody.velocity.y,
      runSpeed: RUN_SPEED * 0.8,
      aim: { x: this.dir, y: 0.35 },
      facing: this.dir,
      armReady: true,
      reload: null,
      swimDir: { x: 0, y: 0 },
    };
  }

  protected override die(): void {
    const feet = this.arcadeBody.bottom;
    super.die();
    this.corpse = { x: this.x, y: feet, vx: -this.dir * 60, vy: -120, ms: 0, floor: feet };
    this.scene.events.emit('enemy-died', this);
  }

  override despawn(): void {
    super.despawn();
    this.corpse = null;
  }
}

/* ------------------------------------------------------------------ turret */

export interface TurretOpts {
  mount: 'wall' | 'hatch' | 'gate';
  hp: number;
  /** Shots per volley (gate cannons fire a short spread). */
  volley: number;
  cooldownMs: number;
}

const TURN_STEP_MS = 260;
const TELEGRAPH_MS = 320;
const TURRET_BULLET = 150;
const HATCH_SENSE = 150;

export class Turret extends Enemy {
  private readonly head: Phaser.GameObjects.Image;
  private readonly barrel: Phaser.GameObjects.Image;
  private readonly mountImg: Phaser.GameObjects.Image | null = null;
  private readonly lid: Phaser.GameObjects.Image | null = null;
  /** 0..7, 45° steps; 4 = facing left. */
  private step8 = 4;
  private turnMs = 0;
  private cooldown = 800;
  private telegraphMs = 0;
  /** Hatch guns hide until the player is near; they can't be hurt while closed. */
  private rise = 1;
  hidden = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly opts: TurretOpts,
  ) {
    super(scene, x, y, 'hitbox', opts.hp);
    this.setVisible(false);
    const body = this.arcadeBody;
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.setSize(12, 12).setOffset(0, 4);
    this.contactDamage = 0;
    if (opts.mount === 'wall') {
      this.mountImg = scene.add
        .image(x, y, 'turret-mount')
        .setScale(S)
        .setDepth(DEPTH.enemies - 1);
    }
    if (opts.mount === 'hatch') {
      this.hidden = true;
      this.rise = 0;
      this.mountImg = scene.add
        .image(x, y + 1, 'hatch-frame')
        .setOrigin(0.5, 0)
        .setScale(S)
        .setDepth(DEPTH.enemies + 1);
      this.lid = scene.add
        .image(x, y + 0.5, 'hatch-lid')
        .setOrigin(0.5, 0)
        .setScale(S)
        .setDepth(DEPTH.enemies + 2);
    }
    const headKey = opts.mount === 'gate' ? 'gate-cannon' : 'turret-head';
    this.head = scene.add.image(x, y, headKey).setScale(S).setDepth(DEPTH.enemies);
    this.barrel = scene.add
      .image(x, y, 'turret-barrel')
      .setOrigin(0.05, 0.5)
      .setScale(opts.mount === 'gate' ? S * 1.4 : S)
      .setDepth(DEPTH.enemies - 0.5);
  }

  override hit(damage: number): boolean {
    if (this.hidden) {
      sfx.dryFire(); // rounds ping off the closed hatch
      return false;
    }
    const killed = super.hit(damage);
    return killed;
  }

  private get aimAngle(): number {
    return (this.step8 * Math.PI) / 4;
  }

  private muzzle(): { x: number; y: number } {
    const len = this.opts.mount === 'gate' ? 15 : 10;
    return {
      x: this.x + Math.cos(this.aimAngle) * len,
      y: this.head.y + Math.sin(this.aimAngle) * len,
    };
  }

  protected think(dtMs: number, ctx: EnemyContext): void {
    const dx = ctx.target.x - this.x;
    const dy = ctx.target.y - this.y;
    const onScreen = this.isOnScreen(ctx.view, -4);
    if (this.opts.mount === 'hatch') {
      const near = Math.hypot(dx, dy) < HATCH_SENSE && onScreen;
      const target = near ? 1 : 0;
      this.rise +=
        Math.sign(target - this.rise) * Math.min(Math.abs(target - this.rise), dtMs / 380);
      const wasHidden = this.hidden;
      this.hidden = this.rise < 0.95;
      if (wasHidden && !this.hidden) sfx.telegraph();
      if (this.hidden) return;
    }
    if (!onScreen || ctx.targetSubmerged) return;
    if (!this.engaged) {
      this.engaged = true;
      ctx.onEngage(this);
    }
    // turn one 45° step at a time towards the player (wall guns cannot aim into the wall)
    const want = snap8({ x: dx, y: dy });
    let wantStep = Math.round(Math.atan2(want.y, want.x) / (Math.PI / 4));
    wantStep = ((wantStep % 8) + 8) % 8;
    if (this.opts.mount !== 'hatch' && (wantStep === 0 || wantStep === 1 || wantStep === 7))
      wantStep = 4;
    if (this.opts.mount === 'hatch' && (wantStep === 1 || wantStep === 2 || wantStep === 3))
      wantStep = dx < 0 ? 4 : 0;
    this.turnMs -= dtMs;
    if (this.turnMs <= 0 && wantStep !== this.step8) {
      const diff = (wantStep - this.step8 + 8) % 8;
      this.step8 = (this.step8 + (diff <= 4 ? 1 : 7)) % 8;
      this.turnMs = TURN_STEP_MS;
      this.telegraphMs = 0;
    }
    this.cooldown -= dtMs;
    const aligned = wantStep === this.step8;
    if (aligned && this.cooldown <= 0) {
      if (this.telegraphMs === 0) sfx.telegraph();
      this.telegraphMs += dtMs;
      // a short glint and line before every shot
      const m = this.muzzle();
      ctx.telegraph.lineStyle(1, COLORS.enemyBullet, 0.3 + (this.telegraphMs / TELEGRAPH_MS) * 0.5);
      ctx.telegraph.lineBetween(
        m.x,
        m.y,
        m.x + Math.cos(this.aimAngle) * 40,
        m.y + Math.sin(this.aimAngle) * 40,
      );
      if (this.telegraphMs >= TELEGRAPH_MS) {
        const n = this.opts.volley;
        for (let i = 0; i < n; i++) {
          const a = this.aimAngle + (n > 1 ? (i / (n - 1) - 0.5) * 0.36 : 0);
          ctx.fireEnemyBullet(m.x, m.y, Math.cos(a), Math.sin(a), TURRET_BULLET);
        }
        sfx.enemyShoot();
        this.cooldown = this.opts.cooldownMs + Math.random() * 300;
        this.telegraphMs = 0;
      }
    } else {
      this.telegraphMs = 0;
    }
  }

  override syncVisual(): void {
    if (this.dead) return;
    const up = this.opts.mount === 'hatch' ? (this.rise - 1) * -9 : 0;
    this.head.setPosition(this.x, this.y + up - (this.opts.mount === 'hatch' ? 5 : 0));
    this.barrel.setPosition(this.head.x, this.head.y).setRotation(this.aimAngle);
    this.barrel.setFlipY(Math.cos(this.aimAngle) < -0.1);
    const show = this.opts.mount !== 'hatch' || this.rise > 0.05;
    this.head.setVisible(show);
    this.barrel.setVisible(show);
    if (this.lid) this.lid.setX(this.x + this.rise * 8).setAlpha(1 - this.rise * 0.6);
    const glint = this.telegraphMs > 0 && Math.floor(this.telegraphMs / 70) % 2 === 0;
    if (glint) this.head.setTint(0xffb080);
    else this.head.clearTint();
    // keep the body where the gun is, so hidden hatches can't be shot from the side
    this.arcadeBody.reset(this.x, this.head.y - 6 + 6);
  }

  protected override die(): void {
    super.die();
    this.head.setVisible(false);
    this.barrel.setVisible(false);
    this.mountImg?.setTint(0x555555);
    this.lid?.setVisible(false);
    this.scene.events.emit('enemy-died', this);
    this.scene.events.emit('big-boom', this.x, this.head.y);
  }

  override destroy(fromScene?: boolean): void {
    this.head.destroy();
    this.barrel.destroy();
    this.mountImg?.destroy();
    this.lid?.destroy();
    super.destroy(fromScene);
  }
}

/* ------------------------------------------------------------------ supply drone */

export class SupplyDrone extends Enemy {
  private t = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    private readonly baseY: number,
    readonly pickup: PickupKind,
  ) {
    super(scene, x, baseY, 'drone', 2);
    this.setScale(S).setDepth(DEPTH.enemies + 2);
    const body = this.arcadeBody;
    body.setAllowGravity(false);
    body.setSize(18 * FX_RES, 9 * FX_RES).setOffset(4 * FX_RES, 1 * FX_RES);
    this.contactDamage = 0;
  }

  protected think(dtMs: number, ctx: EnemyContext): void {
    this.t += dtMs / 1000;
    this.arcadeBody.setVelocity(-62, Math.cos(this.t * 2.4) * 34);
    this.y = Math.max(ctx.view.y + 14, Math.min(this.y, this.baseY + 24));
    this.setAngle(Math.sin(this.t * 2.4) * 6);
    if (this.x < ctx.view.x - 40) this.despawn();
  }

  protected override die(): void {
    super.die();
    this.scene.events.emit('drone-down', this.x, this.y, this.pickup);
    this.scene.events.emit('big-boom', this.x, this.y);
  }
}

/* ------------------------------------------------------------------ frogman */

type FrogState = 'under' | 'rise' | 'up' | 'dive';

export class Frogman extends Enemy {
  private st: FrogState = 'under';
  private timer = 1200 + Math.random() * 900;
  private thrown = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    private readonly pool: WaterVolume,
  ) {
    super(scene, x, pool.y + 2, 'frogman', 2);
    this.setOrigin(0.5, 1).setScale(S).setDepth(DEPTH.enemies);
    const body = this.arcadeBody;
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.setSize(12 * FX_RES, 10 * FX_RES).setOffset(2 * FX_RES, 4 * FX_RES);
    this.contactDamage = 0;
    this.setVisible(false);
  }

  /** Only hittable while above the surface. */
  override hit(damage: number): boolean {
    if (this.st === 'under') return false;
    return super.hit(damage);
  }

  protected think(dtMs: number, ctx: EnemyContext): void {
    const dx = ctx.target.x - this.x;
    const near = Math.abs(dx) < 240 && this.isOnScreen(ctx.view, 20);
    this.timer -= dtMs;
    switch (this.st) {
      case 'under': {
        this.setVisible(false);
        // drift underwater towards the player, staying in the pool
        const p = this.pool;
        const tx = Phaser.Math.Clamp(ctx.target.x, p.x + 10, p.x + p.w - 10);
        this.x += Math.sign(tx - this.x) * Math.min(Math.abs(tx - this.x), dtMs * 0.03);
        if (this.timer <= 0 && near) {
          this.st = 'rise';
          this.timer = 260;
          this.setVisible(true);
          sfx.splash(false);
          if (!this.engaged) {
            this.engaged = true;
            ctx.onEngage(this);
          }
        }
        break;
      }
      case 'rise':
        if (this.timer <= 0) {
          this.st = 'up';
          this.timer = 950;
          this.thrown = false;
        }
        break;
      case 'up':
        this.setFlipX(dx > 0);
        if (!this.thrown && this.timer < 600) {
          this.thrown = true;
          // lob so it comes down near the player after ~0.9 s
          const t = 0.9;
          const ty = ctx.target.y + 6;
          const vx = Phaser.Math.Clamp(dx / t, -170, 170);
          const vy = (ty - (this.y - 10) - 0.5 * 520 * t * t) / t;
          ctx.lobGrenade(this.x, this.y - 10, vx, vy);
        }
        if (this.timer <= 0) {
          this.st = 'dive';
          this.timer = 260;
        }
        break;
      case 'dive':
        if (this.timer <= 0) {
          this.st = 'under';
          this.timer = 1800 + Math.random() * 1000;
          this.setVisible(false);
        }
        break;
    }
  }

  override syncVisual(): void {
    if (this.dead) return;
    const out =
      this.st === 'up'
        ? 1
        : this.st === 'rise'
          ? 1 - this.timer / 260
          : this.st === 'dive'
            ? this.timer / 260
            : 0;
    this.setY(this.pool.y + 4 - out * 8);
    this.setAlpha(0.6 + out * 0.4);
  }

  protected override die(): void {
    super.die();
    this.scene.events.emit('enemy-died', this);
  }
}

/* ------------------------------------------------------------------ lock gate core */

export class GateCore extends Enemy {
  shielded = true;
  private readonly shield: Phaser.GameObjects.Image;
  private t = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'gate-core', 30);
    this.setScale(S).setDepth(DEPTH.enemies + 1);
    const body = this.arcadeBody;
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.setSize(14 * FX_RES, 14 * FX_RES).setOffset(2 * FX_RES, 2 * FX_RES);
    this.contactDamage = 0;
    this.shield = scene.add
      .image(x, y, 'gate-shield')
      .setScale(S)
      .setDepth(DEPTH.enemies + 2);
  }

  override hit(damage: number): boolean {
    if (this.shielded) {
      sfx.dryFire();
      this.shield.setAlpha(1);
      return false;
    }
    return super.hit(damage);
  }

  dropShield(): void {
    if (!this.shielded) return;
    this.shielded = false;
    this.scene.tweens.add({ targets: this.shield, scale: S * 1.8, alpha: 0, duration: 400 });
  }

  protected think(dtMs: number): void {
    this.t += dtMs / 1000;
  }

  override syncVisual(): void {
    if (this.dead) return;
    const pulse = 1 + Math.sin(this.t * (this.shielded ? 3 : 8)) * 0.06;
    this.setScale(S * pulse);
    if (this.shielded) this.shield.setAlpha(Math.max(0.55, this.shield.alpha - 0.02));
  }

  protected override die(): void {
    super.die();
    this.shield.setVisible(false);
    this.scene.events.emit('enemy-died', this);
  }

  override destroy(fromScene?: boolean): void {
    this.shield.destroy();
    super.destroy(fromScene);
  }
}
