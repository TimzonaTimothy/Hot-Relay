/**
 * Projectile presentation and guidance: tracer lines behind every round, smoke behind rockets,
 * and homing for rounds that have it (steered in fixed steps, so it is deterministic).
 */
import Phaser from 'phaser';
import { DEPTH } from '../config/constants';
import type { Bullet, BulletPool } from '../entities/BulletPool';
import type { Effects } from './Effects';
import { steerTowards } from '../systems/ballistics';

/** How much of a round's path the tracer shows, in seconds of travel. */
const TRAIL_S = 0.028;

export class Tracers {
  private readonly g: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    private readonly pools: readonly BulletPool[],
    private readonly fx: Effects,
  ) {
    this.g = scene.add
      .graphics()
      .setDepth(DEPTH.bullets - 1)
      .setBlendMode(Phaser.BlendModes.ADD);
  }

  /** Fixed step: turn homing rounds towards the nearest target ahead of them. */
  steer(dtMs: number, targets: readonly { x: number; y: number }[]): void {
    for (const pool of this.pools) {
      for (const child of pool.group.getChildren()) {
        const b = child as Bullet;
        if (!b.active || b.homing <= 0) continue;
        const body = b.body as Phaser.Physics.Arcade.Body;
        const t = nearestAhead(b, body.velocity, targets);
        if (t) {
          const v = steerTowards(
            body.velocity.x,
            body.velocity.y,
            t.x - b.x,
            t.y - b.y,
            (b.homing * dtMs) / 1000,
          );
          body.setVelocity(v.vx, v.vy);
          b.setRotation(Math.atan2(v.vy, v.vx));
        }
      }
    }
  }

  /** Per frame: draw tracers and puff rocket smoke. */
  draw(): void {
    const g = this.g;
    g.clear();
    for (const pool of this.pools) {
      for (const child of pool.group.getChildren()) {
        const b = child as Bullet;
        if (!b.active) continue;
        const v = (b.body as Phaser.Physics.Arcade.Body).velocity;
        const k = b.homing > 0 ? TRAIL_S * 1.6 : TRAIL_S;
        g.lineStyle(b.blast ? 1.4 : 1, b.trail, b.wet ? 0.25 : 0.55);
        g.lineBetween(b.x - v.x * k, b.y - v.y * k, b.x, b.y);
        if (b.homing > 0 && Math.random() < 0.7)
          this.fx.dust(b.x - v.x * 0.02, b.y - v.y * 0.02, 1, 0xbdb6ad);
      }
    }
  }
}

function nearestAhead(
  b: Bullet,
  v: { x: number; y: number },
  targets: readonly { x: number; y: number }[],
): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestD = 200 * 200;
  const speed = Math.hypot(v.x, v.y) || 1;
  for (const t of targets) {
    const dx = t.x - b.x;
    const dy = t.y - b.y;
    const d = dx * dx + dy * dy;
    // only targets in front (within ~80° of travel)
    if ((dx * v.x + dy * v.y) / (Math.sqrt(d) * speed || 1) < 0.18) continue;
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}
