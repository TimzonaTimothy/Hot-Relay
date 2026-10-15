import Phaser from 'phaser';
import { DEPTH } from '../config/constants';

export type Team = 'player' | 'enemy';

export class Bullet extends Phaser.Physics.Arcade.Image {
  team: Team = 'player';
  damage = 1;
  /** Remaining enemies this bullet can pass through. */
  pierce = 0;
  life = 0;
  /** Enemies already hit, so a piercing round damages each once. */
  readonly hits = new Set<object>();

  fire(x: number, y: number, angle: number, speed: number, texture: string, damage: number, pierce: number, life: number): void {
    this.enableBody(true, x, y, true, true);
    this.setTexture(texture);
    this.setRotation(angle);
    this.damage = damage;
    this.pierce = pierce;
    this.life = life;
    this.hits.clear();
    const body = this.body as Phaser.Physics.Arcade.Body;
    const s = this.team === 'enemy' ? 10 : 8;
    body.setSize(s, s);
    body.setOffset(this.width / 2 - s / 2, this.height / 2 - s / 2);
    body.setAllowGravity(false);
    body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
  }

  kill(): void {
    this.disableBody(true, true);
  }
}

/** Fixed-size pool per team. Nothing is allocated while playing. */
export class BulletPool {
  readonly group: Phaser.Physics.Arcade.Group;
  readonly items: Bullet[] = [];

  constructor(scene: Phaser.Scene, team: Team, size: number) {
    this.group = scene.physics.add.group({ classType: Bullet, allowGravity: false, maxSize: size });
    for (let i = 0; i < size; i++) {
      const b = new Bullet(scene, -100, -100, team === 'player' ? 'bullet_smg' : 'bullet_enemy');
      b.team = team;
      scene.add.existing(b);
      this.group.add(b);
      b.setDepth(DEPTH.bullets);
      b.kill();
      this.items.push(b);
    }
  }

  fire(x: number, y: number, angle: number, speed: number, texture: string, damage = 1, pierce = 0, life = 1.2): Bullet | null {
    const b = this.items.find((i) => !i.active);
    if (!b) return null;
    b.fire(x, y, angle, speed, texture, damage, pierce, life);
    return b;
  }

  /** Age bullets and recycle the ones that leave the view or expire. */
  tick(dt: number, view: Phaser.Geom.Rectangle, margin = 80): void {
    for (const b of this.items) {
      if (!b.active) continue;
      b.life -= dt;
      if (
        b.life <= 0 ||
        b.x < view.x - margin ||
        b.x > view.right + margin ||
        b.y < view.y - margin ||
        b.y > view.bottom + margin
      ) {
        b.kill();
      }
    }
  }

  get activeCount(): number {
    let n = 0;
    for (const b of this.items) if (b.active) n++;
    return n;
  }

  clear(): void {
    this.items.forEach((b) => b.active && b.kill());
  }
}
