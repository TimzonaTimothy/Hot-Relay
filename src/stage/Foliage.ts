/**
 * Grass tufts that sway in the breeze, bend away from a passing character, and flatten
 * outwards in helicopter rotor wash. Visual only.
 */
import Phaser from 'phaser';
import { DEPTH } from '../config/constants';
import { FX_RES } from '../art/fx';

interface Tuft {
  img: Phaser.GameObjects.Image;
  bend: number;
  phase: number;
}

export class Foliage {
  private readonly tufts: Tuft[] = [];
  private t = 0;
  private wash: { x: number; strength: number } | null = null;

  constructor(scene: Phaser.Scene, spots: readonly { x: number; y: number }[]) {
    spots.forEach((s, i) => {
      const img = scene.add
        .image(s.x, s.y + 0.5, 'fx-tuft')
        .setOrigin(0.5, 1)
        .setScale((1 / FX_RES) * (0.9 + (i % 3) * 0.15))
        .setFlipX(i % 2 === 0)
        .setDepth(DEPTH.player + 1);
      this.tufts.push({ img, bend: 0, phase: i * 1.37 });
    });
  }

  /** Rotor wash centred at x with strength 0..1 (null to clear). */
  setWash(x: number, strength: number): void {
    this.wash = strength > 0.01 ? { x, strength } : null;
  }

  update(frameMs: number, view: Phaser.Geom.Rectangle, walkerX: number, walkerFeetY: number): void {
    const dt = frameMs / 1000;
    this.t += dt;
    for (const tf of this.tufts) {
      const img = tf.img;
      if (img.x < view.x - 20 || img.x > view.right + 20) continue;
      let target = Math.sin(this.t * 1.6 + tf.phase) * 0.08;
      const dx = img.x - walkerX;
      if (Math.abs(dx) < 9 && Math.abs(walkerFeetY - img.y) < 6) target += Math.sign(dx || 1) * 0.5;
      if (this.wash) {
        const wx = img.x - this.wash.x;
        const fall = Math.max(0, 1 - Math.abs(wx) / 140);
        // flattened away from the rotor, with fast flutter
        target +=
          Math.sign(wx || 1) *
          fall *
          this.wash.strength *
          (0.9 + Math.sin(this.t * 31 + tf.phase) * 0.25);
      }
      tf.bend += (target - tf.bend) * Math.min(1, dt * 12);
      img.setRotation(tf.bend);
    }
  }
}
