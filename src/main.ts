import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from './config/constants';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MenuScene } from './scenes/MenuScene';
import { StageScene } from './scenes/StageScene';
import { StressScene } from './scenes/StressScene';
import { HudScene } from './scenes/HudScene';
import { PauseScene } from './scenes/PauseScene';
import { ResultsScene } from './scenes/ResultsScene';
import { services } from './systems/services';
import { registerServiceWorker } from './systems/pwa';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: VIEW_W,
  height: VIEW_H,
  backgroundColor: '#0d1712',
  pixelArt: false,
  antialias: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 4, gamepad: false },
  fps: { target: 60, smoothStep: false },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      // Stepped manually from StageScene.tick so gameplay runs at a fixed 60 Hz.
      customUpdate: true,
      debug: services.flags.debug,
    },
  },
  scene: [BootScene, PreloadScene, MenuScene, StageScene, StressScene, HudScene, PauseScene, ResultsScene],
});

window.addEventListener('touchstart', () => (services.touchSeen = true), { once: true, passive: true });

// F2 toggles physics debug bodies when ?debug=1.
if (services.flags.debug) {
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'F2') return;
    for (const s of game.scene.getScenes(true)) {
      const w = (s as Phaser.Scene).physics?.world;
      if (!w) continue;
      if (!w.debugGraphic) w.createDebugGraphic();
      w.drawDebug = !w.drawDebug;
      w.debugGraphic.clear();
    }
  });
}

(window as unknown as { __hotRelay: Record<string, unknown> }).__hotRelay = { game, services, telemetry: services.telemetry };
registerServiceWorker();
