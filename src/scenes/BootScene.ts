import Phaser from 'phaser';
import { services } from '../systems/services';

/** Loads the save before anything else so settings apply from the first frame. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    services.input.attach();
    void services.save.load().then((d) => {
      services.sfx.enabled = d.settings.sound;
      this.scene.start('Preload');
    });
  }
}
