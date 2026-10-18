/**
 * Contractor rifleman (ENEMY-02), drawn with the shared cut-out rig.
 * idle → aim (visible telegraph, direction locked) → 3-round burst → cooldown → aim …
 * The aim direction is locked when the telegraph starts, so a player who reads the
 * flash can always step out of the line. Shots travel in one of 8 directions.
 * On death the rig is thrown back, falls to the ground and fades.
 */
import Phaser from 'phaser';
import { Enemy, type EnemyContext, type EnemyVisualWorld } from './Enemy';
import { snap8 } from '../systems/aim';
import { sfx } from '../systems/Sfx';
import { COLORS, DEPTH } from '../config/constants';
import { Rig, RIG_SCALE } from './Rig';
import { AnimStateMachine } from '../systems/anim';
import { groundBelow } from '../systems/geometry';
import { WEAPONS } from '../data/weapons';

type State = 'idle' | 'aim' | 'burst' | 'cooldown';

const AIM_MS = 600;
const SHOT_GAP_MS = 140;
const SHOTS_PER_BURST = 3;
const COOLDOWN_MS = 950;
const COOLDOWN_JITTER_MS = 450;
const BULLET_SPEED = 165;
const RANGE_X = 250;
const RANGE_Y = 160;

export class Rifleman extends Enemy {
  private aiState: State = 'idle';
  private timerMs = 0;
  private shotsLeft = 0;
  private aimDir = { x: -1, y: 0 };
  private facing: 1 | -1 = -1;
  private readonly anim = new AnimStateMachine();
  private readonly shadow: Phaser.GameObjects.Image | null = null;
  private corpse: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    ms: number;
    floor: number;
  } | null = null;
  private glint = false;

  constructor(scene: Phaser.Scene, x: number, feetY: number, shadow?: Phaser.GameObjects.Image) {
    super(scene, x, feetY - 10, 'hitbox', 3);
    this.setVisible(false);
    this.arcadeBody.setSize(10, 18).setOffset(1, 2);
    this.arcadeBody.setMaxVelocityY(420);
    this.rig = new Rig(scene, 'contractor', 'contractorRifle', DEPTH.enemies, RIG_SCALE * 0.96);
    this.shadow = shadow ?? null;
  }

  protected override onStunned(): void {
    this.aiState = 'cooldown';
    this.timerMs = COOLDOWN_MS;
    this.rig?.setTint(0x8899ff);
  }

  private muzzle(): { x: number; y: number } {
    if (this.rig) return this.rig.muzzle(this.aimDir, WEAPONS.contractorRifle.muzzle);
    return { x: this.x + this.aimDir.x * 8, y: this.y - 3 + this.aimDir.y * 8 };
  }

  protected think(dtMs: number, ctx: EnemyContext): void {
    const dx = ctx.target.x - this.x;
    const dy = ctx.target.y - this.y;
    const inRange =
      Math.abs(dx) < RANGE_X &&
      Math.abs(dy) < RANGE_Y &&
      !ctx.targetSubmerged && // can't see a diver under the surface
      this.isOnScreen(ctx.view, -4) &&
      this.arcadeBody.blocked.down;
    if (this.aiState === 'idle' || this.aiState === 'cooldown') this.facing = dx < 0 ? -1 : 1;

    switch (this.aiState) {
      case 'idle':
        if (inRange) this.beginAim(ctx);
        break;
      case 'aim': {
        this.timerMs -= dtMs;
        this.drawTelegraph(ctx);
        if (this.timerMs <= 0) {
          this.aiState = 'burst';
          this.shotsLeft = SHOTS_PER_BURST;
          this.timerMs = 0;
          this.setGlint(false);
        }
        break;
      }
      case 'burst':
        this.timerMs -= dtMs;
        if (this.timerMs <= 0 && this.shotsLeft > 0) {
          const m = this.muzzle();
          ctx.fireEnemyBullet(m.x, m.y, this.aimDir.x, this.aimDir.y, BULLET_SPEED);
          this.rig?.kick(1.2);
          sfx.enemyShoot();
          this.shotsLeft--;
          this.timerMs = SHOT_GAP_MS;
        }
        if (this.shotsLeft <= 0) {
          this.aiState = 'cooldown';
          this.timerMs = COOLDOWN_MS + Math.random() * COOLDOWN_JITTER_MS;
        }
        break;
      case 'cooldown':
        this.timerMs -= dtMs;
        if (this.timerMs <= 0) {
          if (inRange) this.beginAim(ctx);
          else this.aiState = 'idle';
        }
        break;
    }
    this.anim.step(dtMs, {
      grounded: this.arcadeBody.blocked.down || this.arcadeBody.touching.down,
      vx: this.arcadeBody.velocity.x,
      vy: this.arcadeBody.velocity.y,
      runSpeed: 100,
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

  private beginAim(ctx: EnemyContext): void {
    this.aiState = 'aim';
    this.timerMs = AIM_MS;
    this.aimDir = snap8({ x: ctx.target.x - this.x, y: ctx.target.y - (this.y - 3) });
    // never shoot straight down through the platform it stands on
    if (this.aimDir.y > 0.9) this.aimDir = { x: Math.sign(ctx.target.x - this.x) || -1, y: 0 };
    this.facing = this.aimDir.x < 0 ? -1 : this.aimDir.x > 0 ? 1 : this.facing;
    if (!this.engaged) {
      this.engaged = true;
      ctx.onEngage(this);
    }
    sfx.telegraph();
  }

  private setGlint(on: boolean): void {
    if (on === this.glint) return;
    this.glint = on;
    if (on) this.rig?.setTint(0xff9070, Phaser.TintModes.ADD);
    else this.restoreTint();
  }

  private drawTelegraph(ctx: EnemyContext): void {
    const progress = 1 - this.timerMs / AIM_MS;
    const blinkOn = ctx.flashing ? Math.floor(this.timerMs / 75) % 2 === 0 : true;
    this.setGlint(blinkOn);
    const m = this.muzzle();
    const len = 18 + progress * 70;
    const g = ctx.telegraph;
    g.lineStyle(1, COLORS.enemyBullet, 0.35 + progress * 0.5);
    g.lineBetween(m.x, m.y, m.x + this.aimDir.x * len, m.y + this.aimDir.y * len);
  }

  override syncVisual(frameMs: number, world: EnemyVisualWorld): void {
    const rig = this.rig;
    if (!rig) return;
    const aiming = this.aiState === 'aim' || this.aiState === 'burst';
    const aim = aiming ? this.aimDir : { x: this.facing, y: 0.12 };
    if (this.corpse) {
      // thrown back, falls onto the ground, then fades out
      const c = this.corpse;
      const dt = frameMs / 1000;
      c.ms += frameMs;
      c.vy += 600 * dt;
      c.x += c.vx * dt;
      c.floor = groundBelow(world.platforms, c.x, Math.min(c.y, c.floor) - 1, 400) ?? c.floor;
      c.y = Math.min(c.floor, c.y + c.vy * dt);
      if (c.y >= c.floor) c.vx *= 0.85;
      rig.update(frameMs, this.params('dead', aim), c.x, c.y);
      rig.setAlpha(c.ms < 700 ? 1 : Math.max(0, 1 - (c.ms - 700) / 400));
      if (c.ms > 1100) {
        rig.setVisible(false);
        this.corpse = null;
      }
      this.shadow?.setVisible(false);
      return;
    }
    if (this.dead) return;
    rig.update(frameMs, this.params(this.anim.state, aim), this.x, this.arcadeBody.bottom);
    if (this.shadow) world.fx.placeShadow(this.shadow, this.x, this.arcadeBody.bottom, 15, false);
  }

  private params(state: Parameters<Rig['update']>[1]['state'], aim: { x: number; y: number }) {
    return {
      state,
      stateMs: this.anim.timeMs,
      vx: 0,
      vy: 0,
      runSpeed: 100,
      aim,
      facing: this.facing,
      armReady: true,
      reload: null,
      swimDir: { x: 0, y: 0 },
    };
  }

  protected override die(): void {
    const feet = this.arcadeBody.bottom;
    super.die();
    this.setGlint(false);
    this.corpse = {
      x: this.x,
      y: feet,
      vx: -this.facing * 55,
      vy: -110,
      ms: 0,
      floor: feet,
    };
    this.scene.events.emit('enemy-died', this);
  }

  override despawn(): void {
    super.despawn();
    this.corpse = null;
    this.shadow?.setVisible(false);
  }

  override destroy(fromScene?: boolean): void {
    this.shadow?.destroy();
    super.destroy(fromScene);
  }
}
