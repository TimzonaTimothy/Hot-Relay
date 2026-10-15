/**
 * Builds all PLACEHOLDER textures in code at boot: menu art, cut-out character parts,
 * effects, hazards, the helicopter (stage art is painted when the stage starts).
 * Zero image downloads keeps the first load tiny (PWA-05) and everything works offline.
 * Final art replaces these via atlases (SETUP-05) using the same keys — see ASSETS.md.
 */
import Phaser from 'phaser';
import { COLORS, SCENES } from '../config/constants';
import { FLAGS } from '../systems/flags';
import { generateArt } from '../ui/artGen';
import { generateCharacterParts } from '../art/characters';
import { generateFxArt } from '../art/fx';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SCENES.preload);
  }

  create(): void {
    this.makeRect('bullet-p', 6, 2, COLORS.playerBullet);
    this.makeEnemyBullet();
    this.makeRect('px', 2, 2, COLORS.white);
    generateArt(this);
    generateCharacterParts(this);
    generateFxArt(this);

    if (FLAGS.stress) this.scene.start(SCENES.stress);
    else if (FLAGS.autostart) this.scene.start(SCENES.stage, { mode: FLAGS.mode });
    else this.scene.start(SCENES.menu);
  }

  private gfx(): Phaser.GameObjects.Graphics {
    return this.add.graphics().setVisible(false);
  }

  private makeRect(key: string, w: number, h: number, color: number): void {
    const g = this.gfx();
    g.fillStyle(color, 1).fillRect(0, 0, w, h);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  private makeEnemyBullet(): void {
    const g = this.gfx();
    g.fillStyle(COLORS.enemyBullet, 1).fillRect(1, 0, 2, 4).fillRect(0, 1, 4, 2);
    g.fillStyle(0xffe0c0, 1).fillRect(1, 1, 2, 2);
    g.generateTexture('bullet-e', 4, 4);
    g.destroy();
  }
}
