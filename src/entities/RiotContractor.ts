import Phaser from 'phaser';
import { DEPTH } from '../config/constants';
import { TUNING } from '../config/tuning';
import type { EnemyContext } from './Enemy';
import { Rifleman } from './Rifleman';

/**
 * Riot contractor: a rifleman behind a front shield. The shield stops bullets from the
 * front until it lowers to aim and fire, or while stunned. Flank it, wait for the
 * telegraph, or break it open with an entry attack.
 */
export class RiotContractor extends Rifleman {
  private readonly shield: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, x: number, y: number, seed: number) {
    super(scene, x, y, seed, TUNING.riot);
    this.shield = scene.add.image(x, y, 'shield_riot').setDepth(DEPTH.enemies + 2);
  }

  /** Shield is lowered while aiming, firing or stunned. */
  get shieldUp(): boolean {
    return !this.dead && this.stun <= 0 && this.mode !== 'aim' && this.mode !== 'burst';
  }

  /** A bullet moving towards the shield's face (opposite to `facing`) is blocked. */
  override blocks(vx: number): boolean {
    return this.shieldUp && Math.sign(vx) === -this.facing;
  }

  override sync(ctx: EnemyContext): void {
    super.sync(ctx);
    if (this.dead) {
      this.shield.setVisible(false);
      return;
    }
    const up = this.shieldUp;
    this.shield
      .setVisible(this.visible)
      .setFlipX(this.facing < 0)
      .setPosition(this.x + this.facing * (up ? 18 : 12), this.y - (up ? 40 : 22))
      .setRotation(up ? 0 : this.facing * 0.5)
      .setAlpha(up ? 1 : 0.85);
    if (this.flash > 0) this.shield.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    else this.shield.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
  }

  override destroyAll(): void {
    this.shield.destroy();
    super.destroyAll();
  }
}
