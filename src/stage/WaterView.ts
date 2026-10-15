/**
 * Water rendering (PLACEHOLDER visuals, but complete): a deep gradient behind everything, a
 * translucent front layer that tints anything underwater, an animated surface line with
 * foam highlights, drifting light shafts, and a screen tint while the camera's subject is
 * submerged. All shapes come from the stage's water volumes, so the visuals always match the
 * physics.
 */
import Phaser from 'phaser';
import { CANVAS_H, CANVAS_W, DEPTH, VIEW_H, VIEW_W } from '../config/constants';
import type { WaterVolume } from '../systems/water';

export class WaterView {
  private readonly surface: Phaser.GameObjects.Graphics;
  private readonly underTint: Phaser.GameObjects.Rectangle;
  private readonly shafts: Phaser.GameObjects.Image[] = [];
  private t = 0;
  private tint = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly volumes: readonly WaterVolume[],
  ) {
    const back = scene.add.graphics().setDepth(DEPTH.level - 1);
    const front = scene.add.graphics().setDepth(DEPTH.player + 4);
    for (const v of volumes) {
      back.fillGradientStyle(0x2c6e7c, 0x2c6e7c, 0x08202b, 0x08202b, 1);
      back.fillRect(v.x, v.y, v.w, v.h);
      // front: tints submerged characters and bullets, darker with depth
      front.fillGradientStyle(0x3c97ad, 0x3c97ad, 0x0d3445, 0x0d3445, 0.22, 0.22, 0.55, 0.55);
      front.fillRect(v.x, v.y + 1, v.w, v.h - 1);
      // light shafts in wide water
      if (v.w > 120) {
        for (let x = v.x + 30; x < v.x + v.w - 20; x += 70) {
          const img = scene.add
            .image(x, v.y, 'glow')
            .setOrigin(0.5, 0)
            .setScale(0.25, v.h / 40)
            .setRotation(-0.25)
            .setTint(0x9fe8ff)
            .setAlpha(0.1)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(DEPTH.level - 1);
          this.shafts.push(img);
        }
      }
    }
    this.surface = scene.add.graphics().setDepth(DEPTH.player + 5);

    // screen tint while submerged (scroll factor 0 objects sit around the zoomed camera centre)
    const ox = (CANVAS_W - VIEW_W) / 2;
    const oy = (CANVAS_H - VIEW_H) / 2;
    this.underTint = scene.add
      .rectangle(ox, oy, VIEW_W, VIEW_H, 0x0f4a5e, 1)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(DEPTH.fx + 5)
      .setAlpha(0);
  }

  update(frameMs: number, view: Phaser.Geom.Rectangle, submerged: boolean): void {
    this.t += frameMs / 1000;
    const g = this.surface;
    g.clear();
    for (const v of this.volumes) {
      const x0 = Math.max(v.x, view.x - 4);
      const x1 = Math.min(v.x + v.w, view.right + 4);
      if (x1 <= x0 || v.y > view.bottom + 4 || v.y + v.h < view.y) continue;
      const wave = (x: number) =>
        v.y + Math.sin(x * 0.09 + this.t * 2.2) * 0.7 + Math.sin(x * 0.031 - this.t * 1.3) * 0.6;
      // body of the surface band
      g.fillStyle(0x7fd6e6, 0.35);
      g.beginPath();
      g.moveTo(x0, wave(x0));
      for (let x = x0; x <= x1; x += 3) g.lineTo(x, wave(x));
      g.lineTo(x1, wave(x1) + 2.5);
      g.lineTo(x0, wave(x0) + 2.5);
      g.closePath();
      g.fillPath();
      // bright crest line
      g.lineStyle(1, 0xd9fbff, 0.85);
      g.beginPath();
      g.moveTo(x0, wave(x0));
      for (let x = x0; x <= x1; x += 3) g.lineTo(x, wave(x));
      g.strokePath();
      // foam flecks drifting along the surface
      g.fillStyle(0xffffff, 0.7);
      for (let k = 0; k < (x1 - x0) / 18; k++) {
        const fx = x0 + ((k * 37 + this.t * 9) % (x1 - x0));
        g.fillRect(fx, wave(fx) + 0.6, 2, 0.6);
      }
    }
    this.shafts.forEach((s, i) => {
      s.setAlpha(0.07 + Math.sin(this.t * 0.7 + i * 1.7) * 0.04);
      s.setRotation(-0.25 + Math.sin(this.t * 0.4 + i) * 0.06);
    });
    // ease the screen tint in and out
    this.tint += ((submerged ? 1 : 0) - this.tint) * Math.min(1, frameMs / 120);
    this.underTint.setAlpha(this.tint * 0.22);
  }
}
