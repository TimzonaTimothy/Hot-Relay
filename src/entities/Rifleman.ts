import Phaser from 'phaser';
import { DEPTH } from '../config/constants';
import { TUNING } from '../config/tuning';
import { ARM, FRAME } from '../art/characters';
import { rig } from '../art/registry';
import { Enemy, type EnemyContext } from './Enemy';

const T = TUNING.rifleman;
const BODY_W = 26;
const BODY_H = 72;

/** Contractor rifleman: walks into range, flashes a telegraph, fires a 3-round burst. */
export class Rifleman extends Enemy {
  readonly score = T.score;
  private readonly arm: Phaser.GameObjects.Image;
  private readonly glow: Phaser.GameObjects.Image;
  private aim = Math.PI;
  private shots = 0;
  private wait = 0.4;
  private readonly rand: () => number;

  constructor(scene: Phaser.Scene, x: number, y: number, seed: number) {
    super(scene, x, y, 'rifleman', T.health);
    this.setOrigin(0.5, FRAME.footY / FRAME.h);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(BODY_W, BODY_H);
    body.setOffset(FRAME.footX - BODY_W / 2, FRAME.footY - BODY_H);
    body.setMaxVelocityY(TUNING.maxFall);
    this.arm = scene.add.image(x, y, 'arm_rifleman_r').setDepth(DEPTH.enemies + 1);
    this.glow = scene.add.image(x, y, 'glow_red').setDepth(DEPTH.fx).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    let s = seed * 9301 + 49297;
    this.rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    this.wait = 0.3 + this.rand() * 0.8;
    this.play('rifleman_idle');
  }

  get alive(): boolean {
    return !this.dead;
  }

  tick(dt: number, ctx: EnemyContext): void {
    if (this.dead) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    this.modeTime += dt;
    this.flash = Math.max(0, this.flash - dt);
    if (this.stun > 0) {
      this.stun -= dt;
      body.setVelocityX(0);
      if (this.mode === 'aim' || this.mode === 'burst') this.setMode('cooldown');
      return;
    }
    const p = ctx.player;
    const dx = p.x - this.x;
    const dist = Math.hypot(dx, p.y - 40 - (this.y - 40));
    const active = ctx.inView(this.x, this.y - 40, 30) && p.alive;
    const toPlayer = Math.atan2(p.y - 44 - (this.y - 50), dx);

    switch (this.mode) {
      case 'idle':
      case 'patrol': {
        body.setVelocityX(0);
        if (!active) {
          this.setMode('idle');
          break;
        }
        this.mode = 'patrol';
        this.facing = dx < 0 ? -1 : 1;
        const grounded = body.blocked.down || body.touching.down;
        if (Math.abs(dx) > 360 && grounded && ctx.groundAhead(this.x, this.y, this.facing)) {
          body.setVelocityX(this.facing * T.walkSpeed);
        }
        this.aim = this.facing > 0 ? 0 : Math.PI;
        if (this.modeTime > this.wait && dist < T.sightRange) this.setMode('aim');
        break;
      }
      case 'aim':
        body.setVelocityX(0);
        this.facing = dx < 0 ? -1 : 1;
        // Track for the first half of the telegraph, then commit so the shot is dodgeable.
        if (this.modeTime < T.telegraph * 0.55) this.aim = clampAim(toPlayer, this.facing);
        if (this.modeTime >= T.telegraph) {
          this.shots = 0;
          this.setMode('burst');
        }
        break;
      case 'burst':
        body.setVelocityX(0);
        if (this.modeTime >= this.shots * T.burstGap && this.shots < T.burstCount) {
          const m = this.muzzle();
          ctx.fireEnemyBullet(m.x, m.y, this.aim);
          ctx.sfx('enemyShot');
          this.shots++;
        }
        if (this.shots >= T.burstCount) {
          this.wait = T.cooldown + this.rand() * 0.8;
          this.setMode('cooldown');
        }
        break;
      case 'cooldown':
        body.setVelocityX(0);
        if (this.modeTime >= this.wait) {
          this.wait = 0.2 + this.rand() * 0.4;
          this.setMode('patrol');
        }
        break;
    }
  }

  private shoulder(): { x: number; y: number } {
    const frame = (this.frame.name as string) || 'idle0';
    const s = rig('rifleman').shoulder[frame] ?? rig('rifleman').shoulder.idle0;
    return { x: this.x + s.x * this.facing, y: this.y + s.y };
  }

  private muzzle(): { x: number; y: number } {
    const r = rig('rifleman');
    const s = this.shoulder();
    const gy = this.facing > 0 ? r.gunY : -r.gunY;
    const c = Math.cos(this.aim);
    const n = Math.sin(this.aim);
    return { x: s.x + c * r.muzzle - n * gy, y: s.y + n * r.muzzle + c * gy };
  }

  sync(ctx: EnemyContext): void {
    if (this.dead) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    this.setFlipX(this.facing < 0);
    const moving = Math.abs(body.velocity.x) > 5;
    const want = moving ? 'rifleman_run' : 'rifleman_idle';
    if (this.anims.currentAnim?.key !== want) this.play(want);
    const s = this.shoulder();
    const right = this.facing > 0;
    this.arm
      .setTexture(right ? 'arm_rifleman_r' : 'arm_rifleman_l')
      .setOrigin(ARM.pivotX / ARM.w, (right ? ARM.pivotY : ARM.h - ARM.pivotY) / ARM.h)
      .setPosition(s.x, s.y)
      .setRotation(this.aim)
      .setVisible(this.visible);
    if (this.flash > 0) this.arm.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    else this.arm.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    this.applyFlash();
    const aiming = this.mode === 'aim';
    this.glow.setVisible(aiming);
    if (aiming) {
      const m = this.muzzle();
      const pulse = ctx.flashing ? 0.55 + 0.45 * Math.sin(this.modeTime * 40) : 0.8;
      const grow = 0.6 + (this.modeTime / T.telegraph) * 0.8;
      this.glow.setPosition(m.x, m.y).setAlpha(pulse).setScale(grow);
    }
  }

  destroyAll(): void {
    this.arm.destroy();
    this.glow.destroy();
    this.destroy();
  }
}

/** Riflemen can't shoot behind themselves or straight up/down. */
function clampAim(a: number, facing: 1 | -1): number {
  if (facing > 0) return Phaser.Math.Clamp(a, -1.2, 1.0);
  const rel = Phaser.Math.Angle.Wrap(a - Math.PI);
  return Math.PI + Phaser.Math.Clamp(rel, -1.0, 1.2);
}
