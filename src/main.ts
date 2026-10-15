import Phaser from 'phaser';
import { CANVAS_H, CANVAS_W, COLORS } from './config/constants';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MenuScene } from './scenes/MenuScene';
import { StageScene } from './scenes/StageScene';
import { HudScene } from './scenes/HudScene';
import { PauseScene } from './scenes/PauseScene';
import { ResultsScene } from './scenes/ResultsScene';
import { StressScene } from './scenes/StressScene';
import { SquadScene } from './scenes/SquadScene';
import { registerServiceWorker } from './systems/pwa';
import { input } from './systems/InputManager';
import './ui/fonts';

// Start on-screen controls straight away on phones and tablets.
if ((navigator.maxTouchPoints ?? 0) > 0 && window.matchMedia?.('(pointer: coarse)').matches) {
  input.lastSource = 'touch';
}

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  width: CANVAS_W,
  height: CANVAS_H,
  backgroundColor: COLORS.bg,
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    activePointers: 4,
    gamepad: false, // read directly through the browser Gamepad API in InputManager
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      fps: 60,
      fixedStep: true,
      // Stage and Stress advance physics inside their own fixed-step loop (CORE-02)
      customUpdate: true,
      debug: false,
    },
  },
  fps: { target: 60, smoothStep: true },
  scene: [
    BootScene,
    PreloadScene,
    MenuScene,
    SquadScene,
    StageScene,
    HudScene,
    PauseScene,
    ResultsScene,
    StressScene,
  ],
});

void registerServiceWorker();

if (import.meta.env.DEV) (window as unknown as { game: Phaser.Game }).game = game;
