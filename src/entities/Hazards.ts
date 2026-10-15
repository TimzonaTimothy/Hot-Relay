/**
 * Underwater threats and features of the harbour basin:
 * - Mine: tethered to the bed, bobs, its lamp blinks faster as you approach. Touch it or shoot
 *   it and it blows, hurting anyone close (including enemies).
 * - EelDrone: patrols the water, only hunts swimmers. Eye flashes (telegraph), then it lunges.
 * - Grate: breakable bars over the secret tunnel.
 * - Cache: supply crate in the tunnel (air, armour, ammo for the squad).
 *
 * PLACEHOLDER ART: textures come from src/art/fx.ts.
 */
import Phaser from 'phaser';
import { Enemy, type EnemyContext, type EnemyVisualWorld } from './Enemy';
import { DEPTH } from '../config/constants';
import { FX_RES } from '../art/fx';
import { sfx } from '../systems/Sfx';
import type { WaterVolume } from '../systems/water';

const S = 1 / FX_RES;

export class Mine extends Enemy {
  private readonly baseY: number;
  private t = Math.random() * 6;
  private readonly lamp: Phaser.GameObjects.Image;
  private readonly tether: Phaser.GameObjects.Rectangle;
  private blinkMs = 0;
  private proximity = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, floorY: number) {
    super(scene, x, y, 'mine', 1);
    this.setScale(S);
    this.baseY = y;
    this.contactDamage = 0; // it explodes instead
    const body = this.arcadeBody;
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.setCircle(5 * FX_RES, 2 * FX_RES, 2 * FX_RES);
    this.tether = scene.add
      .rectangle(x, (y + floorY) / 2, 0.8, Math.max(0, floorY - y), 0x23282c)
      .setDepth(DEPTH.enemies - 1);
    this.lamp = scene.add
      .image(x, y, 'mine-lamp')
      .setScale(S * 1.4)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.enemies + 1);
  }

  protected think(dtMs: number, ctx: EnemyContext): void {
    this.t += dtMs / 1000;
    this.y = this.baseY + Math.sin(this.t * 1.7) * 1.6;
    const d = Math.hypot(ctx.target.x - this.x, ctx.target.y - this.y);
    this.proximity = Math.max(0, 1 - d / 70);
    if (d < 13) this.hit(99);
    this.blinkMs -= dtMs;
    if (this.blinkMs <= 0) {
      this.blinkMs = 900 - this.proximity * 760;
      if (this.proximity > 0.3) sfx.telegraph();
    }
    this.arcadeBody.setVelocity(0, 0);
  }

  override syncVisual(): void {
    if (this.dead) return;
    const on = this.blinkMs > (900 - this.proximity * 760) * 0.55;
    this.lamp.setPosition(this.x, this.y).setAlpha(on ? 1 : 0.15);
  }

  protected override die(): void {
    const x = this.x;
    const y = this.y;
    super.die();
    this.lamp.setVisible(false);
    this.tether.setVisible(false);
    this.scene.events.emit('mine-exploded', x, y, this);
    this.scene.events.emit('enemy-died', this);
  }

  override despawn(): void {
    super.despawn();
    this.lamp.setVisible(false);
    this.tether.setVisible(false);
  }

  override destroy(fromScene?: boolean): void {
    this.lamp.destroy();
    this.tether.destroy();
    super.destroy(fromScene);
  }
}

type EelState = 'patrol' | 'notice' | 'lunge' | 'recover';

const NOTICE_MS = 480;
const LUNGE_MS = 850;
const RECOVER_MS = 900;
const LUNGE_SPEED = 135;
const PATROL_SPEED = 34;
const SENSE = 125;

export class EelDrone extends Enemy {
  private st: EelState = 'patrol';
  private timer = 0;
  private dir: 1 | -1 = 1;
  private lungeDir = { x: 1, y: 0 };
  private t = 0;
  private readonly eye: Phaser.GameObjects.Image;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly minX: number,
    private readonly maxX: number,
    private readonly homeY: number,
    private readonly pool: WaterVolume,
  ) {
    super(scene, x, y, 'eel', 3);
    this.setScale(S);
    const body = this.arcadeBody;
    body.setAllowGravity(false);
    body.setSize(18 * FX_RES, 6 * FX_RES).setOffset(4 * FX_RES, 1.5 * FX_RES);
    this.eye = scene.add
      .image(x, y, 'eel-eye')
      .setScale(S * 1.6)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.enemies + 1);
  }

  protected think(dtMs: number, ctx: EnemyContext): void {
    this.t += dtMs / 1000;
    const body = this.arcadeBody;
    const dx = ctx.target.x - this.x;
    const dy = ctx.target.y - this.y;
    const dist = Math.hypot(dx, dy);
    switch (this.st) {
      case 'patrol': {
        if (this.x > this.maxX) this.dir = -1;
        if (this.x < this.minX) this.dir = 1;
        body.setVelocity(
          this.dir * PATROL_SPEED,
          (this.homeY - this.y) * 1.5 + Math.sin(this.t * 2) * 6,
        );
        if (ctx.targetInWater && dist < SENSE) {
          this.st = 'notice';
          this.timer = NOTICE_MS;
          sfx.telegraph();
          if (!this.engaged) {
            this.engaged = true;
            ctx.onEngage(this);
          }
        }
        break;
      }
      case 'notice':
        body.setVelocity(body.velocity.x * 0.85, body.velocity.y * 0.85);
        this.dir = dx < 0 ? -1 : 1;
        this.timer -= dtMs;
        if (this.timer <= 0) {
          const len = Math.max(1, dist);
          this.lungeDir = { x: dx / len, y: dy / len };
          this.st = 'lunge';
          this.timer = LUNGE_MS;
        }
        break;
      case 'lunge':
        body.setVelocity(this.lungeDir.x * LUNGE_SPEED, this.lungeDir.y * LUNGE_SPEED);
        this.timer -= dtMs;
        if (this.timer <= 0) {
          this.st = 'recover';
          this.timer = RECOVER_MS;
        }
        break;
      case 'recover':
        body.setVelocity(body.velocity.x * 0.92, (this.homeY - this.y) * 1.2);
        this.timer -= dtMs;
        if (this.timer <= 0) this.st = 'patrol';
        break;
    }
    // stay inside the water
    const p = this.pool;
    if (this.y < p.y + 8) body.velocity.y = Math.max(body.velocity.y, 20);
    if (this.y > p.y + p.h - 6) body.velocity.y = Math.min(body.velocity.y, -20);
    if (body.velocity.x !== 0) this.dir = body.velocity.x < 0 ? -1 : 1;
  }

  override syncVisual(_frameMs: number, _world: EnemyVisualWorld): void {
    if (this.dead) {
      this.eye.setVisible(false);
      return;
    }
    this.setFlipX(this.dir < 0);
    this.setRotation(
      Math.sin(this.t * 7) * 0.06 +
        (this.st === 'lunge'
          ? Math.atan2(this.lungeDir.y, Math.abs(this.lungeDir.x)) * this.dir
          : 0),
    );
    const ex = this.x + this.dir * 9.5;
    this.eye.setPosition(ex, this.y - 0.2);
    const alert =
      this.st === 'notice'
        ? Math.floor(this.timer / 80) % 2 === 0
          ? 1
          : 0.3
        : this.st === 'lunge'
          ? 1
          : 0.45;
    this.eye.setAlpha(alert).setScale(S * (this.st === 'patrol' ? 1.4 : 2.4));
  }

  protected override die(): void {
    super.die();
    this.eye.setVisible(false);
    this.scene.events.emit('enemy-died', this);
  }

  override despawn(): void {
    super.despawn();
    this.eye.setVisible(false);
  }

  override destroy(fromScene?: boolean): void {
    this.eye.destroy();
    super.destroy(fromScene);
  }
}

/** Breakable bars. Lives in the stage's `breakables` static group. */
export class Grate extends Phaser.GameObjects.Image {
  hp = 8;
  broken = false;

  constructor(scene: Phaser.Scene, x: number, top: number, h: number) {
    super(scene, x, top + h / 2, 'grate');
    scene.add.existing(this);
    this.setScale(S, (h / 40) * S).setDepth(DEPTH.level + 2);
    // display size is exactly 8 × h, so the static body matches it
    scene.physics.add.existing(this, true);
  }

  /** @returns true when this hit breaks it. */
  hit(damage: number): boolean {
    if (this.broken) return false;
    this.hp -= damage;
    this.setTintMode(Phaser.TintModes.FILL).setTint(0xffffff);
    this.scene.time.delayedCall(
      60,
      () => !this.broken && this.clearTint().setTintMode(Phaser.TintModes.MULTIPLY),
    );
    if (this.hp <= 0) {
      this.broken = true;
      return true;
    }
    return false;
  }
}

export class Cache extends Phaser.GameObjects.Image {
  taken = false;
  constructor(scene: Phaser.Scene, x: number, feetY: number) {
    super(scene, x, feetY, 'cache');
    scene.add.existing(this);
    this.setOrigin(0.5, 1).setScale(S).setDepth(DEPTH.pickups);
  }
}
