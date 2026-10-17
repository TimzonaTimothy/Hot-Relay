/** Pause menu (UI-02, CORE-05). Opens on Esc/P/Start, the touch pause button, or when the tab is hidden. */
import Phaser from 'phaser';
import { CANVAS_H, CANVAS_W, SCENES } from '../config/constants';
import { CSSC, PALETTE, plate, txt } from '../ui/theme';
import { MenuList } from '../ui/MenuList';
import { settingsItems } from '../ui/settingsItems';
import { input } from '../systems/InputManager';
import { telemetry } from '../systems/Telemetry';
import type { SquadMode } from '../systems/Squad';
import type { StageScene } from './StageScene';

export class PauseScene extends Phaser.Scene {
  private menu!: MenuList;
  private mode: SquadMode = 'relay';

  constructor() {
    super(SCENES.pause);
  }

  init(data: { mode?: SquadMode }): void {
    this.mode = data.mode ?? 'relay';
  }

  create(): void {
    this.add
      .rectangle(CANVAS_W / 2, CANVAS_H / 2, CANVAS_W, CANVAS_H, PALETTE.ink, 0.8)
      .setInteractive();
    const g = this.add.graphics();
    plate(g, CANVAS_W / 2 - 200, 40, 400, 64, { skew: 22, fill: PALETTE.ember, fillAlpha: 0.95 });
    this.add.text(CANVAS_W / 2, 72, 'PAUSED', txt('display', 44, CSSC.ink)).setOrigin(0.5);
    input.flush();
    input.clearTouch();
    this.menu = new MenuList(
      this,
      [
        { label: () => 'Resume', action: () => this.resume() },
        { label: () => 'Restart stage', action: () => this.restart() },
        ...settingsItems(),
        { label: () => 'Quit to menu', action: () => this.quit() },
      ],
      CANVAS_W / 2,
      134,
      { spacing: 36, fontSize: 18, align: 'center', width: 420, height: 30 },
    );
  }

  private resume(): void {
    input.flush();
    this.scene.resume(SCENES.hud);
    this.scene.resume(SCENES.stage);
    this.scene.stop();
  }

  private restart(): void {
    telemetry.log('stage_quit', { reason: 'restart' });
    (this.scene.get(SCENES.stage) as StageScene).endRun('restart');
    this.scene.stop(SCENES.hud);
    this.scene.stop();
    this.scene.get(SCENES.stage).scene.restart({ mode: this.mode, replay: true });
  }

  private quit(): void {
    telemetry.log('stage_quit', { reason: 'menu' });
    (this.scene.get(SCENES.stage) as StageScene).endRun('quit');
    this.scene.stop(SCENES.hud);
    this.scene.stop(SCENES.stage);
    this.scene.start(SCENES.menu, { skipAttract: true });
  }

  override update(): void {
    this.menu.update();
    if (this.menu.lastFrame?.pausePressed) this.resume();
  }
}
