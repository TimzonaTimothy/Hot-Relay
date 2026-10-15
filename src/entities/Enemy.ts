/**
 * Enemy base class with a small state machine (ENEMY-01).
 * Subclasses implement `think`; the base handles health, hit flash, stun and death.
 * Enemies that use a cut-out Rig draw through it; the physics sprite itself stays invisible.
 */
import Phaser from 'phaser';
import { DEPTH } from '../config/constants';
import type { WaterVolume } from '../systems/water';
import type { Rect } from '../systems/geometry';
import type { Effects } from '../stage/Effects';
import type { Rig } from './Rig';

export interface EnemyContext {
  /** Player centre in world space. */
  target: { x: number; y: number };
  /** Is the player in the water (and fully under)? Water enemies only hunt swimmers. */
  targetInWater: boolean;
  targetSubmerged: boolean;
  /** Current camera view in world space; enemies only act when on screen. */
  view: Phaser.Geom.Rectangle;
  flashing: boolean;
  water: readonly WaterVolume[];
  fireEnemyBullet(x: number, y: number, dirX: number, dirY: number, speed: number): void;
  /** Lob a grenade (grenadiers). */
  throwGrenade(x: number, y: number, vx: number, vy: number): void;
  /** Line of sight through the level's solid geometry. */
  canSee(ax: number, ay: number, bx: number, by: number): boolean;
  /** Ground height under a point (for patrols that must not walk off ledges). */
  groundAt(x: number, fromY: number): number | null;
  /** Blast that hurts the player and other enemies in range (mines). */
  explode(x: number, y: number, radius: number, damage: number, source: Enemy): void;
  /** Called the first time any enemy starts attacking (telemetry: time to first fight). */
  onEngage(enemy: Enemy): void;
  /** Shared graphics for telegraph lines, cleared each frame by the scene. */
  telegraph: Phaser.GameObjects.Graphics;
}

/** What enemies need for per-frame visuals. */
export interface EnemyVisualWorld {
  platforms: readonly Rect[];
  water: readonly WaterVolume[];
  fx: Effects;
}

export abstract class Enemy extends Phaser.Physics.Arcade.Sprite {
  hp: number;
  readonly maxHp: number;
  dead = false;
  stunnedMs = 0;
  private flashMs = 0;
  engaged = false;
  /** Visual rig, if this enemy is drawn as a cut-out character. */
  protected rig: Rig | null = null;
  /** Contact damage dealt by touching this enemy. */
  contactDamage = 1;
  /** Hit reaction: time left in the flinch (subclasses play a hurt pose / pause). */
  flinchMs = 0;
  /** Short label for tests and telemetry. */
  readonly kind: string = 'enemy';

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, maxHp: number) {
    super(scene, x, y, texture);
    this.maxHp = maxHp;
    this.hp = maxHp;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(DEPTH.enemies);
  }

  get arcadeBody(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  /** Feet position, used for ground-pound range checks. */
  get feetY(): number {
    return this.arcadeBody.bottom;
  }

  /** @returns true if this hit killed the enemy. */
  hit(damage: number): boolean {
    if (this.dead) return false;
    this.hp -= damage;
    this.flashMs = 70;
    this.flinchMs = 160;
    if (this.rig) this.rig.flash(70);
    else this.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    if (this.hp <= 0) {
      this.die();
      return true;
    }
    return false;
  }

  stun(ms: number): void {
    if (this.dead) return;
    this.stunnedMs = Math.max(this.stunnedMs, ms);
    this.onStunned();
  }

  protected onStunned(): void {}

  /** Remove without a death (no score, no effects, no events), e.g. resetting an arena. */
  despawn(): void {
    this.dead = true;
    this.disableBody(true, true);
    this.rig?.setVisible(false);
  }

  protected die(): void {
    this.dead = true;
    this.disableBody(true, true);
  }

  isOnScreen(view: Phaser.Geom.Rectangle, margin = 8): boolean {
    return (
      this.x > view.x - margin &&
      this.x < view.right + margin &&
      this.y > view.y - margin &&
      this.y < view.bottom + margin
    );
  }

  step(dtMs: number, ctx: EnemyContext): void {
    if (this.dead) return;
    this.flinchMs = Math.max(0, this.flinchMs - dtMs);
    if (this.flashMs > 0) {
      this.flashMs -= dtMs;
      if (this.flashMs <= 0) this.restoreTint();
    }
    if (this.stunnedMs > 0) {
      this.stunnedMs -= dtMs;
      if (this.stunnedMs <= 0) this.restoreTint();
      return;
    }
    this.think(dtMs, ctx);
  }

  protected restoreTint(): void {
    if (this.rig) {
      this.rig.setTint(this.stunnedMs > 0 ? 0x8899ff : null);
      return;
    }
    this.clearTint();
    this.setTintMode(Phaser.TintModes.MULTIPLY);
    if (this.stunnedMs > 0) this.setTint(0x8899ff);
  }

  /** Per-frame visuals (rig pose, death fall). Default: nothing. */
  syncVisual(_frameMs: number, _world: EnemyVisualWorld): void {}

  protected abstract think(dtMs: number, ctx: EnemyContext): void;

  override destroy(fromScene?: boolean): void {
    this.rig?.destroy();
    super.destroy(fromScene);
  }
}
