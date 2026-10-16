/**
 * Supply pods and pickups (weapon and ammo drops).
 * A pod is a winged capsule that crosses the screen in a gentle wave once the player reaches
 * its trigger point. Shoot it down and it drops a pickup, which falls to the ground (or floats
 * on water) and waits to be collected. PLACEHOLDER art: `pod`, `pickup-*` (src/art/fx.ts).
 */
import Phaser from 'phaser';
import { Enemy, type EnemyContext } from './Enemy';
import { DEPTH } from '../config/constants';
import { FX_RES } from '../art/fx';
import { groundBelow, type Rect } from '../systems/geometry';
import type { WaterVolume } from '../systems/water';

const S = 1 / FX_RES;

export type PickupKind = 'fan' | 'hornet' | 'lance' | 'ammo';

export const PICKUP_LABEL: Record<PickupKind, string> = {
  fan: 'Fan scattergun',
  hornet: 'Hornet launcher',
  lance: 'Arc lance',
  ammo: 'Ammo resupply',
};

export class SupplyPod extends Enemy {
  override readonly kind: string = 'pod';
  private t = 0;
  private readonly baseY: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly give: PickupKind,
    private readonly speed = 72,
  ) {
    super(scene, x, y, 'pod', 2);
    this.setScale(S).setDepth(DEPTH.enemies + 2);
    this.baseY = y;
    this.contactDamage = 0;
    this.arcadeBody.setAllowGravity(false);
  }

  protected think(dtMs: number, ctx: EnemyContext): void {
    this.t += dtMs / 1000;
    this.arcadeBody.setVelocity(this.speed, Math.cos(this.t * 2.6) * 26);
    this.y = Math.min(this.y, this.baseY + 14);
    // gone once it has crossed the screen unhurt
    if (this.x > ctx.view.right + 30) this.despawn();
  }

  override syncVisual(): void {
    if (!this.dead) this.setRotation(Math.sin(this.t * 2.6) * 0.12);
  }

  protected override die(): void {
    const x = this.x;
    const y = this.y;
    super.die();
    this.scene.events.emit('pod-opened', x, y, this.give);
    this.scene.events.emit('enemy-died', this);
  }
}

export class Pickup extends Phaser.GameObjects.Image {
  private vy = -90;
  private settled = false;
  private restY = 0;
  private t = 0;
  lifeMs = 14000;
  taken = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly kind: PickupKind,
  ) {
    super(scene, x, y, `pickup-${kind}`);
    scene.add.existing(this);
    this.setScale(S).setDepth(DEPTH.pickups + 1);
  }

  /** Falls to the ground or the water surface, then bobs. @returns false once it expires. */
  step(dtMs: number, platforms: readonly Rect[], water: readonly WaterVolume[]): boolean {
    if (this.taken) return false;
    const dt = dtMs / 1000;
    this.t += dt;
    this.lifeMs -= dtMs;
    if (!this.settled) {
      this.vy = Math.min(this.vy + 520 * dt, 260);
      const ground = groundBelow(platforms, this.x, this.y + 5, 600) ?? Infinity;
      const surface =
        water.find((v) => this.x >= v.x && this.x <= v.x + v.w && v.y >= this.y - 2)?.y ?? Infinity;
      const floor = Math.min(ground - 6, surface - 3);
      this.y += this.vy * dt;
      if (this.vy > 0 && this.y >= floor) {
        this.y = floor;
        this.restY = floor;
        this.settled = true;
      }
    } else {
      this.y = this.restY + Math.sin(this.t * 3) * 1.2;
    }
    if (this.lifeMs < 3000) this.setAlpha(Math.floor(this.lifeMs / 120) % 2 === 0 ? 0.3 : 1);
    return this.lifeMs > 0;
  }
}
