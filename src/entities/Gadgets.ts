/**
 * Operator gadgets: Tomás's sentry and Farida's grenades. Gameplay steps in StageScene.tick
 * (fixed rate); these classes hold state and position their sprites.
 */
import Phaser from 'phaser';
import { DEPTH } from '../config/constants';
import { TUNING } from '../config/tuning';
import { FX_RES } from '../art/fx';
import type { WeaponDef } from '../data/weapons';
import type { Enemy } from './Enemy';

const S = 1 / FX_RES;

/** Automatic turret: aims at the nearest visible enemy in range and fires until it expires. */
export class Sentry {
  readonly base: Phaser.GameObjects.Image;
  readonly gun: Phaser.GameObjects.Image;
  lifeMs: number = TUNING.sentry.lifeMs;
  private fireMs = 300; // a short wind-up after it lands
  private angle = 0;
  done = false;

  constructor(
    scene: Phaser.Scene,
    readonly x: number,
    readonly feetY: number,
    facing: 1 | -1,
  ) {
    this.angle = facing > 0 ? 0 : Math.PI;
    this.base = scene.add
      .image(x, feetY, 'sentry-base')
      .setOrigin(0.5, 1)
      .setScale(S)
      .setDepth(DEPTH.player - 1);
    this.gun = scene.add
      .image(x, feetY - 7.5, 'sentry-gun')
      .setOrigin(0.05, 0.5)
      .setScale(S)
      .setRotation(this.angle)
      .setDepth(DEPTH.player - 1);
    // drop-in: lands with a little squash
    scene.tweens.add({
      targets: [this.base, this.gun],
      scaleY: { from: S * 1.4, to: S },
      duration: 200,
      ease: 'Back.easeOut',
    });
  }

  get muzzle(): { x: number; y: number } {
    return { x: this.gun.x + Math.cos(this.angle) * 11, y: this.gun.y + Math.sin(this.angle) * 11 };
  }

  /** Returns a firing direction this step, or null. */
  step(
    dtMs: number,
    enemies: readonly Enemy[],
    view: Phaser.Geom.Rectangle,
  ): { x: number; y: number } | null {
    if (this.done) return null;
    this.lifeMs -= dtMs;
    if (this.lifeMs <= 0) {
      this.done = true;
      return null;
    }
    let best: Enemy | null = null;
    let bestD: number = TUNING.sentry.range;
    for (const e of enemies) {
      if (e.dead || !view.contains(e.x, e.y)) continue;
      const d = Math.hypot(e.x - this.x, e.y - (this.feetY - 8));
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    this.fireMs -= dtMs;
    if (!best) return null;
    this.angle = Math.atan2(best.y - this.gun.y, best.x - this.gun.x);
    this.gun.setRotation(this.angle).setFlipY(Math.cos(this.angle) < 0);
    if (this.fireMs > 0) return null;
    this.fireMs = 1000 / TUNING.sentry.fireRate;
    return { x: Math.cos(this.angle), y: Math.sin(this.angle) };
  }

  /** Blink in the last two seconds so the player knows it is about to go. */
  render(): void {
    const fading = this.lifeMs < 2000 && Math.floor(this.lifeMs / 120) % 2 === 0;
    this.base.setAlpha(fading ? 0.4 : 1);
    this.gun.setAlpha(fading ? 0.4 : 1);
  }

  destroy(): void {
    this.base.destroy();
    this.gun.destroy();
  }
}

export class Grenade extends Phaser.Physics.Arcade.Image {
  armMs = 0;
  fuseMs = 0;
  radius = 30;
  damage = 3;
}

/** Lobbed grenades (Farida's Tremor launcher). They explode on impact or when the fuse runs out. */
export class GrenadePool {
  readonly group: Phaser.Physics.Arcade.Group;

  constructor(scene: Phaser.Scene, size = 12) {
    this.group = scene.physics.add.group({
      classType: Grenade,
      maxSize: size,
      runChildUpdate: false,
    });
    for (let i = 0; i < size; i++) {
      const g = this.group.create(-100, -100, 'grenade') as Grenade;
      g.setScale(S).setDepth(DEPTH.bullets);
      g.disableBody(true, true);
    }
  }

  throw(x: number, y: number, dirX: number, dirY: number, w: WeaponDef): Grenade | null {
    const spec = w.grenade;
    if (!spec) return null;
    const g = this.group.getFirstDead(false) as Grenade | null;
    if (!g) return null;
    g.enableBody(true, x, y, true, true);
    g.armMs = spec.armMs;
    g.fuseMs = spec.fuseMs;
    g.radius = spec.radius;
    g.damage = w.damage;
    const body = g.body as Phaser.Physics.Arcade.Body;
    body.setCircle(2 * FX_RES, 0.5 * FX_RES, 0.5 * FX_RES);
    body.setAllowGravity(true);
    // world gravity is the player's; grenades fly on their own, floatier arc
    body.setGravityY(spec.gravity - TUNING.gravity);
    // lobbed: a little extra lift so a level shot still arcs
    body.setVelocity(dirX * w.bulletSpeed, dirY * w.bulletSpeed - 90);
    body.setAngularVelocity(dirX >= 0 ? 540 : -540);
    return g;
  }

  /** Age every live grenade; returns the ones whose fuse ran out this step. */
  step(dtMs: number): Grenade[] {
    const out: Grenade[] = [];
    for (const g of this.group.getChildren() as Grenade[]) {
      if (!g.active) continue;
      g.armMs -= dtMs;
      g.fuseMs -= dtMs;
      if (g.fuseMs <= 0) out.push(g);
    }
    return out;
  }

  kill(g: Grenade): void {
    g.disableBody(true, true);
  }
}
