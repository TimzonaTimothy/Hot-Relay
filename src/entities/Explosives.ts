/**
 * Things that blow up: grenades (thrown by grenadiers) and explosive barrels (set dressing that
 * players can use against enemies). The actual blast — damage, effects, chain reactions — is
 * handled by StageScene.explode so every explosion follows one rule set.
 */
import Phaser from 'phaser';
import { DEPTH } from '../config/constants';
import { FX_RES } from '../art/fx';
import { sfx } from '../systems/Sfx';

const S = 1 / FX_RES;
export const GRENADE_FUSE_MS = 1500;

/** A bouncing grenade with a fuse. Pooled by GrenadePool. */
export class Grenade extends Phaser.Physics.Arcade.Image {
  fuseMs = 0;
  private lastVy = 0;

  arm(x: number, y: number, vx: number, vy: number): void {
    this.enableBody(true, x, y, true, true);
    this.fuseMs = GRENADE_FUSE_MS;
    this.setScale(S).setDepth(DEPTH.bullets);
    const b = this.body as Phaser.Physics.Arcade.Body;
    b.setAllowGravity(true);
    b.setCircle(2.2 * FX_RES, 0.3 * FX_RES, 0.3 * FX_RES);
    b.setBounce(0.38, 0.38);
    b.setDrag(40, 0);
    b.setVelocity(vx, vy);
    this.lastVy = vy;
  }

  /** @returns true when the fuse runs out this step. */
  step(dtMs: number, wet: boolean): boolean {
    if (!this.active) return false;
    const b = this.body as Phaser.Physics.Arcade.Body;
    this.fuseMs -= dtMs;
    if (wet) {
      // water slows it right down, it still goes off
      b.velocity.x *= 0.9;
      b.velocity.y = Math.min(b.velocity.y * 0.9 + 6, 40);
    }
    if (b.blocked.down && this.lastVy > 120) sfx.grenadeBounce();
    if (b.blocked.down) b.velocity.x *= 0.92;
    this.lastVy = b.velocity.y;
    this.rotation += (b.velocity.x / 60) * (dtMs / 1000) * 6;
    // fuse lamp blinks faster as it burns down
    const rate = this.fuseMs < 500 ? 60 : 160;
    this.setTint(Math.floor(this.fuseMs / rate) % 2 === 0 ? 0xffffff : 0xff8a6a);
    return this.fuseMs <= 0;
  }

  defuse(): void {
    this.disableBody(true, true);
  }
}

export class GrenadePool {
  readonly group: Phaser.Physics.Arcade.Group;

  constructor(scene: Phaser.Scene, size = 10) {
    this.group = scene.physics.add.group({
      classType: Grenade,
      maxSize: size,
      runChildUpdate: false,
    });
    for (let i = 0; i < size; i++) {
      const g = this.group.create(-100, -100, 'grenade') as Grenade;
      g.disableBody(true, true);
    }
  }

  throw(x: number, y: number, vx: number, vy: number): Grenade | null {
    const g = this.group.getFirstDead(false) as Grenade | null;
    g?.arm(x, y, vx, vy);
    return g;
  }

  get live(): Grenade[] {
    return (this.group.getChildren() as Grenade[]).filter((g) => g.active);
  }

  clear(): void {
    for (const g of this.group.getChildren() as Grenade[]) g.defuse();
  }
}

/** Explosive barrel: shoot it (or blast it) and it explodes. Solid; you can stand on it. */
export class Barrel extends Phaser.GameObjects.Image {
  hp = 3;
  broken = false;

  constructor(scene: Phaser.Scene, x: number, feetY: number) {
    super(scene, x, feetY - 7, 'barrel');
    scene.add.existing(this);
    this.setScale(S).setDepth(DEPTH.level + 2);
    scene.physics.add.existing(this, true);
  }

  /** @returns true when this hit sets it off. */
  hit(damage: number): boolean {
    if (this.broken) return false;
    this.hp -= damage;
    this.setTintMode(Phaser.TintModes.FILL).setTint(0xffffff);
    this.scene.time.delayedCall(50, () => {
      if (!this.broken) this.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    });
    if (this.hp <= 0) {
      this.broken = true;
      return true;
    }
    return false;
  }
}
