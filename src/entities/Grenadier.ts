/**
 * Grenadier: lobs bouncing grenades over cover, so hiding behind a crate is not enough.
 * idle → wind-up (launcher raised, orange glint, beep: the telegraph) → lob → cooldown.
 * It does not need line of sight (it arcs shots over walls), but it does need the player on
 * screen and within range. Different rig, weapon and attack pattern from the rifleman.
 */
import Phaser from 'phaser';
import { Enemy, type EnemyContext, type EnemyVisualWorld } from './Enemy';
import { Rig, RIG_SCALE } from './Rig';
import { AnimStateMachine, IDLE_INPUT, type AnimState } from '../systems/anim';
import { DEPTH } from '../config/constants';
import { TUNING } from '../config/tuning';
import { lobTime, lobVelocity } from '../systems/ballistics';
import { WEAPONS } from '../data/weapons';
import { sfx } from '../systems/Sfx';
import { groundBelow } from '../systems/geometry';

type State = 'idle' | 'windup' | 'cooldown';

const WINDUP_MS = 550;
const COOLDOWN_MS = 1800;
const RANGE_MIN = 40;
const RANGE_MAX = 270;

export class Grenadier extends Enemy {
  override readonly kind: string = 'grenadier';
  private st: State = 'idle';
  private timer = 0;
  private facing: 1 | -1 = -1;
  private readonly anim = new AnimStateMachine();
  private hurtPending = false;
  private corpseMs = -1;
  private corpse = { x: 0, y: 0, vx: 0, vy: 0, floor: 0 };
  private lobAim = { x: -0.7, y: -0.7 };

  constructor(
    scene: Phaser.Scene,
    x: number,
    feetY: number,
    private readonly shadow: Phaser.GameObjects.Image | null,
  ) {
    super(scene, x, feetY - 10, 'hitbox', 4);
    this.setVisible(false);
    this.arcadeBody.setSize(10, 18).setOffset(1, 2);
    this.arcadeBody.setMaxVelocityY(420);
    this.rig = new Rig(scene, 'grenadier', 'thumper', DEPTH.enemies, RIG_SCALE);
  }

  override hit(damage: number): boolean {
    const killed = super.hit(damage);
    if (!killed) {
      this.hurtPending = true;
      if (this.st === 'windup') this.timer += 120;
    }
    return killed;
  }

  protected override onStunned(): void {
    this.st = 'cooldown';
    this.timer = COOLDOWN_MS;
  }

  protected think(dtMs: number, ctx: EnemyContext): void {
    const dx = ctx.target.x - this.x;
    const dist = Math.abs(dx);
    const inRange =
      dist > RANGE_MIN &&
      dist < RANGE_MAX &&
      Math.abs(ctx.target.y - this.y) < 150 &&
      !ctx.targetSubmerged &&
      this.isOnScreen(ctx.view, -4) &&
      this.arcadeBody.blocked.down;
    if (this.st !== 'windup') this.facing = dx < 0 ? -1 : 1;
    this.arcadeBody.setVelocityX(0);

    switch (this.st) {
      case 'idle':
        if (inRange) {
          this.st = 'windup';
          this.timer = WINDUP_MS;
          sfx.telegraph();
          if (!this.engaged) {
            this.engaged = true;
            ctx.onEngage(this);
          }
        }
        break;
      case 'windup':
        this.timer -= dtMs;
        if (this.timer <= 0) {
          // lob so it lands where the player is standing now
          const from = this.muzzle();
          const tdx = ctx.target.x - from.x;
          const tdy = ctx.target.y + 8 - from.y;
          const t = lobTime(tdx);
          const v = lobVelocity(tdx, tdy, TUNING.gravity, t);
          ctx.throwGrenade(from.x, from.y, v.vx, v.vy);
          this.rig?.kick(2.2);
          sfx.enemyShoot();
          this.st = 'cooldown';
          this.timer = COOLDOWN_MS + Math.random() * 600;
        }
        break;
      case 'cooldown':
        this.timer -= dtMs;
        if (this.timer <= 0) this.st = 'idle';
        break;
    }
    this.anim.step(dtMs, {
      ...IDLE_INPUT,
      grounded: this.arcadeBody.blocked.down || this.arcadeBody.touching.down,
      vy: this.arcadeBody.velocity.y,
      aiming: this.st === 'windup',
      hurt: this.hurtPending,
    });
    this.hurtPending = false;
  }

  private muzzle(): { x: number; y: number } {
    if (this.rig) return this.rig.muzzle(this.lobAim, WEAPONS.thumper.muzzle);
    return { x: this.x, y: this.y - 6 };
  }

  override syncVisual(frameMs: number, world: EnemyVisualWorld): void {
    const rig = this.rig;
    if (!rig) return;
    // launcher held low, raised high during the wind-up
    const raise = this.st === 'windup' ? 1 : 0.15;
    this.lobAim = { x: this.facing * (1 - raise * 0.45), y: -0.25 - raise * 0.6 };
    const len = Math.hypot(this.lobAim.x, this.lobAim.y);
    this.lobAim = { x: this.lobAim.x / len, y: this.lobAim.y / len };
    const state: AnimState = this.corpseMs >= 0 ? 'dead' : this.anim.state;
    const params = {
      state,
      stateMs: this.anim.timeMs,
      vx: 0,
      vy: 0,
      runSpeed: 100,
      aim: this.lobAim,
      facing: this.facing,
      armReady: true,
      reload: null,
      swimDir: { x: 0, y: 0 },
    };
    if (this.corpseMs >= 0) {
      const c = this.corpse;
      const dt = frameMs / 1000;
      this.corpseMs += frameMs;
      c.vy += 600 * dt;
      c.x += c.vx * dt;
      c.floor = groundBelow(world.platforms, c.x, Math.min(c.y, c.floor) - 1, 400) ?? c.floor;
      c.y = Math.min(c.floor, c.y + c.vy * dt);
      if (c.y >= c.floor) c.vx *= 0.8;
      rig.update(frameMs, params, c.x, c.y);
      rig.setAlpha(this.corpseMs < 700 ? 1 : Math.max(0, 1 - (this.corpseMs - 700) / 400));
      if (this.corpseMs > 1100) {
        rig.setVisible(false);
        this.corpseMs = -1;
      }
      this.shadow?.setVisible(false);
      return;
    }
    if (this.dead) return;
    if (this.st === 'windup') {
      const blink = Math.floor(this.timer / 90) % 2 === 0;
      rig.setTint(blink ? 0xffa060 : null, Phaser.TintModes.ADD);
    } else rig.setTint(null);
    rig.update(frameMs, params, this.x, this.arcadeBody.bottom);
    if (this.shadow) world.fx.placeShadow(this.shadow, this.x, this.arcadeBody.bottom, 15, false);
  }

  protected override die(): void {
    const feet = this.arcadeBody.bottom;
    super.die();
    this.corpseMs = 0;
    this.corpse = { x: this.x, y: feet, vx: -this.facing * 50, vy: -110, floor: feet };
    this.scene.events.emit('enemy-died', this);
  }

  override despawn(): void {
    super.despawn();
    this.corpseMs = -1;
    this.shadow?.setVisible(false);
  }

  override destroy(fromScene?: boolean): void {
    this.shadow?.destroy();
    super.destroy(fromScene);
  }
}
