import Phaser from 'phaser';
import { SCENES } from '../config/constants';
import { saves } from '../systems/services';
import { sfx } from '../systems/Sfx';
import { telemetry } from '../systems/Telemetry';
import { FLAGS } from '../systems/flags';
import { input } from '../systems/InputManager';
import { loadFonts } from '../ui/fonts';

/** Loads the local save before anything reads settings (SAVE-02). */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.boot);
  }

  async create(): Promise<void> {
    input.attach();
    telemetry.debug = FLAGS.debug;
    const [data] = await Promise.all([saves.load(), loadFonts()]);
    sfx.setVolume(data.settings.volume);
    telemetry.log('session_start', { ...telemetry.context(), mode: FLAGS.mode });
    window.__hotRelay = { telemetry };
    document.getElementById('boot')?.remove();
    this.scene.start(SCENES.preload);
  }
}
