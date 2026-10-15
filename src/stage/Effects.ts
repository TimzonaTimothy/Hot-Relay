/**
 * Visual-only effects for the stage: muzzle flashes, spent casings, contact shadows, dust,
 * splashes, bubbles and drips. Nothing here affects gameplay, so it runs per rendered frame.
 * Particles are pooled emitters; casings are a small fixed pool with hand-rolled physics so
 * they bounce once on the real level geometry.
 */
import Phaser from 'phaser';
import { DEPTH } from '../config/constants';
import { FX_RES } from '../art/fx';
import { groundBelow, type Rect } from '../systems/geometry';
import { pointInWater, type WaterVolume } from '../systems/water';

interface Casing {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  spin: number;
  lifeMs: number;
  floorY: number;
  bounced: boolean;
}

const S = 1 / FX_RES;
const CASINGS = 28;

export class Effects {
  private casings: Casing[] = [];
  private nextCasing = 0;
  private flashes: Phaser.GameObjects.Image[] = [];
  private flashLife: number[] = [];
  private dustE: Phaser.GameObjects.Particles.ParticleEmitter;
  private dropE: Phaser.GameObjects.Particles.ParticleEmitter;
  private foamE: Phaser.GameObjects.Particles.ParticleEmitter;
  private bubbleE: Phaser.GameObjects.Particles.ParticleEmitter;
  private washE: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly platforms: readonly Rect[],
    private readonly water: readonly WaterVolume[],
  ) {
    for (let i = 0; i < CASINGS; i++) {
      const img = scene.add
        .image(-50, -50, 'fx-casing')
        .setScale(S)
        .setDepth(DEPTH.player + 2)
        .setVisible(false);
      this.casings.push({ img, vx: 0, vy: 0, spin: 0, lifeMs: 0, floorY: 0, bounced: false });
    }
    for (let i = 0; i < 6; i++) {
      this.flashes.push(
        scene.add
          .image(-50, -50, 'fx-flash')
          .setOrigin(0.22, 0.5)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(DEPTH.fx)
          .setVisible(false),
      );
      this.flashLife.push(0);
    }
    this.dustE = scene.add
      .particles(0, 0, 'fx-dust', {
        speed: { min: 10, max: 45 },
        angle: { min: 180, max: 360 },
        lifespan: { min: 300, max: 560 },
        scale: { start: S * 0.7, end: S * 1.8 },
        alpha: { start: 0.55, end: 0 },
        tint: 0xb9a888,
        gravityY: -10,
        emitting: false,
      })
      .setDepth(DEPTH.player + 3);
    this.dropE = scene.add
      .particles(0, 0, 'fx-drop', {
        speed: { min: 40, max: 150 },
        angle: { min: 235, max: 305 },
        lifespan: { min: 380, max: 700 },
        scale: { start: S * 1.2, end: S * 0.6 },
        alpha: { start: 0.95, end: 0.2 },
        gravityY: 520,
        emitting: false,
      })
      .setDepth(DEPTH.fx);
    this.foamE = scene.add
      .particles(0, 0, 'fx-dust', {
        speedX: { min: -40, max: 40 },
        speedY: { min: -6, max: 0 },
        lifespan: { min: 300, max: 600 },
        scaleX: { start: S * 2.2, end: S * 3.4 },
        scaleY: { start: S * 0.6, end: S * 0.3 },
        alpha: { start: 0.8, end: 0 },
        tint: 0xe6f8ff,
        emitting: false,
      })
      .setDepth(DEPTH.fx);
    this.bubbleE = scene.add
      .particles(0, 0, 'fx-bubble', {
        speedX: { min: -12, max: 12 },
        speedY: { min: -50, max: -20 },
        lifespan: { min: 500, max: 1100 },
        scale: { start: S * 0.7, end: S * 1.2 },
        alpha: { start: 0.9, end: 0 },
        gravityY: -40,
        emitting: false,
      })
      .setDepth(DEPTH.fx);
    // rotor wash: low, fast, flat dust sheets thrown outwards from under the helicopter
    this.washE = scene.add
      .particles(0, 0, 'fx-dust', {
        speedX: { min: -160, max: 160 },
        speedY: { min: -30, max: -4 },
        lifespan: { min: 380, max: 760 },
        scaleX: { start: S * 1.4, end: S * 4 },
        scaleY: { start: S * 0.8, end: S * 1.6 },
        alpha: { start: 0.5, end: 0 },
        tint: [0xc9b48c, 0xb09a72, 0xd8c8a6],
        frequency: -1,
        emitting: false,
      })
      .setDepth(DEPTH.player + 3);
  }

  /** Muzzle flash at the barrel tip, pointing along `angle`. Underwater it is a bubble burst. */
  muzzle(
    x: number,
    y: number,
    angle: number,
    size: number,
    underwater: boolean,
    tint = 0xffffff,
  ): void {
    if (underwater) {
      this.bubbles(x, y, 4);
      return;
    }
    const i = this.flashLife.findIndex((l) => l <= 0);
    const img = this.flashes[i >= 0 ? i : 0];
    if (!img) return;
    this.flashLife[i >= 0 ? i : 0] = 45;
    img
      .setPosition(x, y)
      .setRotation(angle)
      .setScale(S * size * (0.85 + Math.random() * 0.3), S * size * (Math.random() < 0.5 ? 1 : -1))
      .setTint(tint)
      .setAlpha(1)
      .setVisible(true);
  }

  /** Spent casing thrown up and back from the ejection port. */
  casing(x: number, y: number, facing: 1 | -1): void {
    const c = this.casings[this.nextCasing];
    this.nextCasing = (this.nextCasing + 1) % CASINGS;
    if (!c) return;
    c.vx = -facing * (30 + Math.random() * 40);
    c.vy = -(70 + Math.random() * 50);
    c.spin = (Math.random() * 2 - 1) * 30;
    c.lifeMs = 900;
    c.bounced = false;
    c.floorY = groundBelow(this.platforms, x, y, 200) ?? y + 400;
    c.img
      .setPosition(x, y)
      .setAlpha(1)
      .setVisible(true)
      .setRotation(Math.random() * 6);
  }

  dust(x: number, y: number, count = 6, tint?: number): void {
    if (tint !== undefined) this.dustE.setParticleTint(tint);
    else this.dustE.setParticleTint(0xb9a888);
    this.dustE.explode(count, x, y);
  }

  /** Splash where a body crosses the surface. strength 0..1 sets the size. */
  splash(x: number, surfaceY: number, strength: number): void {
    const s = Math.max(0.2, Math.min(1, strength));
    this.dropE.explode(Math.round(4 + s * 16), x, surfaceY);
    this.foamE.explode(Math.round(2 + s * 5), x, surfaceY);
    if (s > 0.5) this.bubbles(x, surfaceY + 8, Math.round(s * 8));
  }

  bubbles(x: number, y: number, count = 3): void {
    this.bubbleE.explode(count, x, y);
  }

  drip(x: number, y: number): void {
    this.dropE.explode(1, x, y);
  }

  /** Rotor wash under a hovering helicopter; strength 0..1. Called every frame while active. */
  wash(x: number, groundY: number, strength: number, dtMs: number): void {
    if (strength <= 0.02) return;
    const n = Math.random() < strength * dtMs * 0.06 ? Math.ceil(strength * 3) : 0;
    if (n > 0) this.washE.explode(n, x + (Math.random() * 2 - 1) * 26, groundY - 1);
  }

  /** Contact shadow under a character: smaller and fainter the higher they are. */
  placeShadow(
    img: Phaser.GameObjects.Image,
    x: number,
    feetY: number,
    width: number,
    hidden: boolean,
  ): void {
    if (hidden) {
      img.setVisible(false);
      return;
    }
    const ground = groundBelow(this.platforms, x, feetY - 1, 140);
    if (ground === null || pointInWater(x, ground - 1, this.water)) {
      img.setVisible(false);
      return;
    }
    const h = ground - feetY;
    const k = Math.max(0, 1 - h / 140);
    img
      .setVisible(true)
      .setPosition(x, ground)
      .setScale((S * width * (0.55 + 0.45 * k)) / 24, S * (0.7 + 0.3 * k))
      .setAlpha(0.25 + 0.6 * k);
  }

  makeShadow(): Phaser.GameObjects.Image {
    return this.scene.add
      .image(0, 0, 'fx-shadow')
      .setDepth(DEPTH.level + 1)
      .setVisible(false);
  }

  update(dtMs: number): void {
    const dt = dtMs / 1000;
    for (let i = 0; i < this.flashes.length; i++) {
      const life = this.flashLife[i] ?? 0;
      if (life <= 0) continue;
      const left = life - dtMs;
      this.flashLife[i] = left;
      const img = this.flashes[i];
      if (!img) continue;
      if (left <= 0) img.setVisible(false);
      else img.setAlpha(Math.min(1, left / 25));
    }
    for (const c of this.casings) {
      if (c.lifeMs <= 0) continue;
      c.lifeMs -= dtMs;
      const img = c.img;
      const wet = pointInWater(img.x, img.y, this.water);
      if (wet) {
        // sink slowly, tumbling
        c.vx *= 0.9;
        c.vy = Math.min(c.vy * 0.9 + 4, 18);
      } else {
        c.vy += 700 * dt;
      }
      img.x += c.vx * dt;
      img.y += c.vy * dt;
      img.rotation += c.spin * dt;
      if (img.y >= c.floorY - 0.6) {
        img.y = c.floorY - 0.6;
        if (!c.bounced && !wet) {
          c.bounced = true;
          c.vy = -c.vy * 0.32;
          c.vx *= 0.5;
          c.spin *= 0.5;
        } else {
          c.vx *= 0.8;
          c.vy = 0;
          c.spin *= 0.8;
        }
      }
      if (c.lifeMs < 300) img.setAlpha(c.lifeMs / 300);
      if (c.lifeMs <= 0) img.setVisible(false);
    }
  }
}
