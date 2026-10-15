/**
 * Turret emplacement (an "installation"): armoured while closed, so bullets only spark off it.
 * closed → opening → tracking (the barrel turns towards the player at a limited rate, then a
 * laser line telegraphs the shot) → 3-round burst along the barrel → closing → closed.
 * Needs line of sight. Takes real damage only while open. Explodes when destroyed and leaves
 * a scorched wreck. PLACEHOLDER art: `turret-base`, `turret-gun` (src/art/fx.ts).
 */
import Phaser from 'phaser';
import { Enemy, type EnemyContext, type EnemyVisualWorld } from './Enemy';
import { DEPTH, COLORS } from '../config/constants';
import { FX_RES } from '../art/fx';
import { sfx } from '../systems/Sfx';

type State = 'closed' | 'opening' | 'tracking' | 'burst' | 'closing';

const S = 1 / FX_RES;
const CLOSED_MS = 1500;
const OPEN_MS = 280;
const TRACK_MS = 1100;
const TELEGRAPH_MS = 450;
const SHOT_GAP_MS = 150;
const TURN_RATE = 2.2; // rad/s
const BULLET_SPEED = 175;
const RANGE = 260;

export class Turret extends Enemy {
  override readonly kind: string = 'turret';
  private st: State = 'closed';
  private timer = CLOSED_MS * Math.random();
  private aimAngle: number;
  private shots = 0;
  private readonly gun: Phaser.GameObjects.Image;
  private readonly hatch: Phaser.GameObjects.Rectangle;
  private wreck = false;

  constructor(scene: Phaser.Scene, x: number, feetY: number, facing: 1 | -1 = -1) {
    super(scene, x, feetY - 7, 'turret-base', 12);
    this.setScale(S).setDepth(DEPTH.enemies - 1);
    this.aimAngle = facing > 0 ? 0 : Math.PI;
    this.contactDamage = 0;
    const b = this.arcadeBody;
    b.setAllowGravity(false);
    b.setImmovable(true);
    this.gun = scene.add
      .image(x, feetY - 10, 'turret-gun')
      .setOrigin(0.18, 0.5)
      .setScale(S)
      .setDepth(DEPTH.enemies - 2);
    // armoured hatch drawn over the gun while closed
    this.hatch = scene.add
      .rectangle(x, feetY - 10, 10, 6, 0x2b3138)
      .setStrokeStyle(0.6, 0x14181d)
      .setDepth(DEPTH.enemies);
  }

  get open(): boolean {
    return this.st === 'tracking' || this.st === 'burst';
  }

  /** Closed armour shrugs off fire (with a spark and a ping). */
  override hit(damage: number): boolean {
    if (this.dead) return false;
    if (!this.open && this.st !== 'opening') {
      sfx.ping();
      return false;
    }
    return super.hit(damage);
  }

  protected think(dtMs: number, ctx: EnemyContext): void {
    const gx = this.x;
    const gy = this.y - 3;
    const dx = ctx.target.x - gx;
    const dy = ctx.target.y - gy;
    const sees =
      Math.hypot(dx, dy) < RANGE &&
      this.isOnScreen(ctx.view, -4) &&
      !ctx.targetSubmerged &&
      ctx.canSee(gx, gy - 4, ctx.target.x, ctx.target.y);
    this.timer -= dtMs;
    switch (this.st) {
      case 'closed':
        if (this.timer <= 0 && sees) {
          this.st = 'opening';
          this.timer = OPEN_MS;
          if (!this.engaged) {
            this.engaged = true;
            ctx.onEngage(this);
          }
        }
        break;
      case 'opening':
        if (this.timer <= 0) {
          this.st = 'tracking';
          this.timer = TRACK_MS;
        }
        break;
      case 'tracking': {
        const want = Math.atan2(dy, dx);
        let d = want - this.aimAngle;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        // never aims into the ground it sits on
        const step = Math.max((-TURN_RATE * dtMs) / 1000, Math.min((TURN_RATE * dtMs) / 1000, d));
        this.aimAngle += step;
        if (Math.sin(this.aimAngle) > 0.2) this.aimAngle = Math.atan2(0.2, Math.cos(this.aimAngle));
        if (this.timer <= TELEGRAPH_MS) this.drawTelegraph(ctx);
        if (
          this.timer === TELEGRAPH_MS ||
          (this.timer < TELEGRAPH_MS && this.timer + dtMs >= TELEGRAPH_MS)
        )
          sfx.telegraph();
        if (this.timer <= 0) {
          this.st = 'burst';
          this.shots = 3;
          this.timer = 0;
        }
        break;
      }
      case 'burst':
        if (this.timer <= 0 && this.shots > 0) {
          const m = this.muzzle();
          ctx.fireEnemyBullet(
            m.x,
            m.y,
            Math.cos(this.aimAngle),
            Math.sin(this.aimAngle),
            BULLET_SPEED,
          );
          sfx.enemyShoot();
          this.shots--;
          this.timer = SHOT_GAP_MS;
        }
        if (this.shots <= 0 && this.timer <= 0) {
          this.st = 'closing';
          this.timer = OPEN_MS;
        }
        break;
      case 'closing':
        if (this.timer <= 0) {
          this.st = 'closed';
          this.timer = CLOSED_MS;
        }
        break;
    }
  }

  private muzzle(): { x: number; y: number } {
    return {
      x: this.gun.x + Math.cos(this.aimAngle) * 11,
      y: this.gun.y + Math.sin(this.aimAngle) * 11,
    };
  }

  private drawTelegraph(ctx: EnemyContext): void {
    const m = this.muzzle();
    const p = 1 - this.timer / TELEGRAPH_MS;
    const on = ctx.flashing ? Math.floor(this.timer / 70) % 2 === 0 : true;
    if (!on) return;
    ctx.telegraph.lineStyle(1, COLORS.enemyBullet, 0.3 + p * 0.6);
    ctx.telegraph.lineBetween(
      m.x,
      m.y,
      m.x + Math.cos(this.aimAngle) * (30 + p * 90),
      m.y + Math.sin(this.aimAngle) * (30 + p * 90),
    );
  }

  override syncVisual(_frameMs: number, _world: EnemyVisualWorld): void {
    if (this.wreck) return;
    this.gun.setRotation(this.aimAngle).setFlipY(Math.cos(this.aimAngle) < 0);
    // the hatch slides down to expose the gun, and back up to armour it
    const openK =
      this.st === 'opening'
        ? 1 - this.timer / OPEN_MS
        : this.st === 'closing'
          ? this.timer / OPEN_MS
          : this.open
            ? 1
            : 0;
    this.hatch.setY(this.y - 3 + openK * 5).setAlpha(1 - openK * 0.85);
  }

  protected override die(): void {
    super.die();
    // leave a scorched wreck in place
    this.wreck = true;
    this.setVisible(true).setActive(false).setTint(0x2a2622);
    this.gun.setTint(0x2a2622).setRotation(0.5);
    this.hatch.setVisible(false);
    this.scene.events.emit('turret-destroyed', this.x, this.y - 3, this);
    this.scene.events.emit('enemy-died', this);
  }

  override despawn(): void {
    super.despawn();
    this.gun.setVisible(false);
    this.hatch.setVisible(false);
  }

  override destroy(fromScene?: boolean): void {
    this.gun.destroy();
    this.hatch.destroy();
    super.destroy(fromScene);
  }
}
