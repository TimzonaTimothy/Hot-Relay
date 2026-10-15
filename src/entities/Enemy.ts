import Phaser from 'phaser';
import { DEPTH } from '../config/constants';

/** What an enemy may ask of the stage. Keeps enemies decoupled from StageScene. */
export interface EnemyContext {
  player: { x: number; y: number; alive: boolean };
  inView(x: number, y: number, margin: number): boolean;
  groundAhead(x: number, y: number, dir: number): boolean;
  fireEnemyBullet(x: number, y: number, angle: number): void;
  sfx(name: 'enemyShot'): void;
  flashing: boolean;
}

export type EnemyMode = 'idle' | 'patrol' | 'aim' | 'burst' | 'cooldown';

/** Base enemy: health, hit flash, stun and a simple state machine with a timer. */
export abstract class Enemy extends Phaser.Physics.Arcade.Sprite {
  health: number;
  readonly maxHealth: number;
  facing: 1 | -1 = -1;
  mode: EnemyMode = 'idle';
  modeTime = 0;
  stun = 0;
  flash = 0;
  dead = false;
  abstract readonly score: number;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, health: number) {
    super(scene, x, y, texture);
    this.health = health;
    this.maxHealth = health;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(DEPTH.enemies);
  }

  setMode(m: EnemyMode): void {
    this.mode = m;
    this.modeTime = 0;
  }

  /** Returns true when this hit killed the enemy. */
  hurt(damage: number): boolean {
    if (this.dead) return false;
    this.health -= damage;
    this.flash = 0.06;
    if (this.health <= 0) {
      this.dead = true;
      return true;
    }
    return false;
  }

  /** True when a player bullet travelling with horizontal velocity `vx` is stopped by armour. */
  blocks(_vx: number): boolean {
    return false;
  }

  /** Gameplay step at the fixed rate. */
  abstract tick(dt: number, ctx: EnemyContext): void;

  /** After physics: position attached sprites, animation, flash. */
  abstract sync(ctx: EnemyContext): void;

  protected applyFlash(): void {
    if (this.flash > 0) this.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    else if (this.stun > 0) this.setTint(0x9ad0ff).setTintMode(Phaser.TintModes.MULTIPLY);
    else this.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
  }

  abstract destroyAll(): void;
}
