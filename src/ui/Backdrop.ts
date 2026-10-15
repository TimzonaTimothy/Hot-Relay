/**
 * Animated dusk-harbour backdrop for full-screen menus (title, results).
 * Layers scroll at different speeds for depth; searchlights sweep; embers drift up.
 * Drawn at canvas resolution (960×540) with the pixel layers scaled ×2.
 */
import Phaser from 'phaser';
import { CANVAS_H, CANVAS_W } from '../config/constants';
import { PALETTE } from './theme';
import { ParallaxStrip } from './ParallaxStrip';

export class Backdrop {
  private layers: { strip: ParallaxStrip; speed: number; offset: number }[] = [];
  readonly root: Phaser.GameObjects.Container;

  constructor(
    private readonly scene: Phaser.Scene,
    opts: { drift?: number; dim?: number } = {},
  ) {
    const s = scene;
    this.root = s.add.container(0, 0).setDepth(-100);
    const drift = opts.drift ?? 1;

    const sky = s.add.graphics();
    sky.fillGradientStyle(0x0a1120, 0x0a1120, 0x4a2238, 0x4a2238, 1);
    sky.fillRect(0, 0, CANVAS_W, 300);
    sky.fillGradientStyle(0x4a2238, 0x4a2238, 0xc4552a, 0xc4552a, 1);
    sky.fillRect(0, 300, CANVAS_W, 110);
    this.root.add(sky);

    // low sun behind the cranes
    const sunGlow = s.add
      .image(700, 360, 'glow')
      .setScale(9)
      .setTint(0xff8a3a)
      .setAlpha(0.55)
      .setBlendMode(Phaser.BlendModes.ADD);
    const sun = s.add.circle(700, 372, 44, 0xffb066, 0.95);
    this.root.add([sunGlow, sun]);

    // searchlight beams sweeping from the quay
    for (const [x, from, to, dur] of [
      [220, -0.55, -0.1, 5200],
      [780, 0.15, 0.6, 6100],
    ] as const) {
      const beam = s.add.graphics({ x, y: 440 });
      beam.fillStyle(0xdde8ff, 0.07);
      beam.fillTriangle(0, 0, -60, -520, 60, -520);
      beam.fillStyle(0xdde8ff, 0.05);
      beam.fillTriangle(0, 0, -24, -520, 24, -520);
      beam.setRotation(from).setBlendMode(Phaser.BlendModes.ADD);
      s.tweens.add({
        targets: beam,
        rotation: to,
        duration: dur,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.root.add(beam);
    }

    this.addLayer('bg-far', 100, 150, 0.06 * drift, 0.9);
    this.addLayer('bg-mid', 200, 110, 0.16 * drift, 1);
    this.addLayer('bg-near', 300, 70, 0.4 * drift, 1);
    this.addLayer('water', 440, 50, 0.5 * drift, 1);
    // sun reflection on the water
    const glint = s.add
      .image(700, 452, 'glow')
      .setScale(5, 0.6)
      .setTint(0xff9a4a)
      .setAlpha(0.5)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.root.add(glint);

    const embers = s.add.particles(0, 0, 'px', {
      x: { min: 0, max: CANVAS_W },
      y: CANVAS_H + 4,
      speedY: { min: -70, max: -25 },
      speedX: { min: -12, max: 18 },
      lifespan: 6000,
      frequency: 140,
      scale: { min: 0.8, max: 1.8 },
      alpha: { start: 0.9, end: 0 },
      tint: [PALETTE.ember, PALETTE.emberHi, 0xffe0a0],
      blendMode: Phaser.BlendModes.ADD,
    });
    this.root.add(embers);

    const vig = s.add.image(0, 0, 'vignette').setOrigin(0).setScale(2).setAlpha(0.95);
    const scan = s.add.image(0, 0, 'scan').setOrigin(0).setScale(2).setAlpha(0.08);
    this.root.add([vig, scan]);
    if (opts.dim)
      this.root.add(s.add.rectangle(0, 0, CANVAS_W, CANVAS_H, PALETTE.ink, opts.dim).setOrigin(0));

    s.events.on(Phaser.Scenes.Events.UPDATE, this.update, this);
    s.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      s.events.off(Phaser.Scenes.Events.UPDATE, this.update, this),
    );
  }

  private addLayer(key: string, y: number, _h: number, speed: number, alpha: number): void {
    const strip = new ParallaxStrip(this.scene, key, 0, y, CANVAS_W, 2, { alpha });
    this.layers.push({ strip, speed, offset: 0 });
    this.root.add(strip.objects);
  }

  private update(_t: number, delta: number): void {
    for (const l of this.layers) {
      l.offset += (l.speed * delta) / 16;
      l.strip.setOffset(l.offset);
    }
  }
}
