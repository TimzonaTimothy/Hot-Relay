/**
 * A horizontally repeating background strip made of plain images that leapfrog each other.
 * Cheaper to draw than a TileSprite (standard quad shader, no per-pixel wrapping), which
 * matters on low-end phone GPUs (measured: each full-width TileSprite cost ~10 fps in
 * software rendering).
 */
import Phaser from 'phaser';

export class ParallaxStrip {
  private readonly images: Phaser.GameObjects.Image[] = [];
  private readonly tileW: number;

  constructor(
    scene: Phaser.Scene,
    key: string,
    private readonly x0: number,
    y: number,
    viewW: number,
    scale = 1,
    opts: { alpha?: number; depth?: number; scrollFactor?: number; tint?: number } = {},
  ) {
    const frame = scene.textures.getFrame(key);
    this.tileW = (frame?.width ?? 512) * scale;
    const count = Math.ceil(viewW / this.tileW) + 1;
    for (let i = 0; i < count; i++) {
      const img = scene.add
        .image(x0 + i * this.tileW, y, key)
        .setOrigin(0, 0)
        .setScale(scale);
      if (opts.alpha !== undefined) img.setAlpha(opts.alpha);
      if (opts.depth !== undefined) img.setDepth(opts.depth);
      if (opts.scrollFactor !== undefined) img.setScrollFactor(opts.scrollFactor);
      if (opts.tint !== undefined) img.setTint(opts.tint);
      this.images.push(img);
    }
  }

  get objects(): Phaser.GameObjects.Image[] {
    return this.images;
  }

  /** Set the scroll offset in screen pixels (grows as the view moves right). */
  setOffset(offset: number): void {
    const shift = ((offset % this.tileW) + this.tileW) % this.tileW;
    this.images.forEach((img, i) => {
      img.x = this.x0 - shift + i * this.tileW;
    });
  }
}
