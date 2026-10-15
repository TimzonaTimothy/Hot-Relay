/**
 * Pooled bullets (COMBAT-02). Bullets are recycled, never created mid-fight,
 * so a screen full of fire does not trigger garbage-collection stutter on phones.
 */
import Phaser from 'phaser';
import { DEPTH } from '../config/constants';
import { UNDERWATER_REDUCED } from '../data/weapons';
import { pointInWater, type WaterVolume } from '../systems/water';

export class Bullet extends Phaser.Physics.Arcade.Image {
  damage = 1;
  pierce = 1;
  lifeMs = 0;
  /** Has entered water (slowed once). */
  wet = false;
  /** Keeps full speed in water (speargun bolts). */
  waterproof = false;
  /** Enemies already hit by this bullet, so a piercing shot never double-hits. */
  readonly hitTargets = new Set<object>();
}

export interface FireOptions {
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  speed: number;
  damage: number;
  pierce: number;
  lifeMs: number;
  /** Stretch the sprite along its travel direction (longer = heavier-looking shot). */
  length?: number;
  tint?: number;
  /** Fired from underwater (already slowed by the weapon rules). */
  wet?: boolean;
  waterproof?: boolean;
}

export class BulletPool {
  readonly group: Phaser.Physics.Arcade.Group;

  constructor(scene: Phaser.Scene, texture: string, maxSize: number) {
    this.group = scene.physics.add.group({
      classType: Bullet,
      maxSize,
      allowGravity: false,
      runChildUpdate: false,
    });
    // Warm the pool so the first firefight allocates nothing.
    for (let i = 0; i < maxSize; i++) {
      const b = this.group.create(-100, -100, texture) as Bullet;
      b.setDepth(DEPTH.bullets);
      b.disableBody(true, true);
    }
  }

  fire(o: FireOptions): Bullet | null {
    const b = this.group.getFirstDead(false) as Bullet | null;
    if (!b) return null;
    b.enableBody(true, o.x, o.y, true, true);
    b.damage = o.damage;
    b.pierce = o.pierce;
    b.lifeMs = o.lifeMs;
    b.wet = o.wet ?? false;
    b.waterproof = o.waterproof ?? false;
    b.hitTargets.clear();
    b.setRotation(Math.atan2(o.dirY, o.dirX));
    b.setScale(o.length ? o.length / b.width : 1, 1);
    if (o.tint !== undefined) b.setTint(o.tint);
    else b.clearTint();
    const body = b.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    // a square hitbox regardless of rotation keeps diagonal shots fair
    const size = Math.max(4, Math.min(8, o.length ?? b.width));
    body.setSize(size, size, true);
    body.setVelocity(o.dirX * o.speed, o.dirY * o.speed);
    return b;
  }

  kill(b: Bullet): void {
    b.disableBody(true, true);
  }

  /**
   * Age bullets and recycle ones that expired or left the camera view. Rounds that hit the
   * water slow down sharply and die soon after (except waterproof speargun bolts), which also
   * makes diving a way to dodge rifle fire.
   */
  step(
    dtMs: number,
    view: Phaser.Geom.Rectangle,
    water: readonly WaterVolume[] = [],
    onEnterWater?: (x: number, y: number) => void,
    margin = 32,
  ): void {
    for (const child of this.group.getChildren()) {
      const b = child as Bullet;
      if (!b.active) continue;
      b.lifeMs -= dtMs;
      if (!b.wet && water.length && pointInWater(b.x, b.y, water)) {
        b.wet = true;
        onEnterWater?.(b.x, b.y);
        if (!b.waterproof) {
          const body = b.body as Phaser.Physics.Arcade.Body;
          body.velocity.scale(UNDERWATER_REDUCED.speed);
          b.lifeMs = Math.min(b.lifeMs, 420);
        }
      }
      if (
        b.lifeMs <= 0 ||
        b.x < view.x - margin ||
        b.x > view.right + margin ||
        b.y < view.y - margin ||
        b.y > view.bottom + margin
      ) {
        this.kill(b);
      }
    }
  }

  countActive(): number {
    return this.group.countActive(true);
  }

  clear(): void {
    for (const child of this.group.getChildren()) this.kill(child as Bullet);
  }
}
