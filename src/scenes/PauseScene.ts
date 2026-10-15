import Phaser from 'phaser';
import { FONT_DISPLAY, VIEW_H, VIEW_W } from '../config/constants';
import { services } from '../systems/services';
import { MenuList, settingsEntries } from '../ui/MenuList';

interface PauseData {
  from: string;
  stage: string;
  mode: 'relay' | 'solo';
}

export class PauseScene extends Phaser.Scene {
  private menu: MenuList | null = null;
  private data0!: PauseData;

  constructor() {
    super('Pause');
  }

  init(data: PauseData): void {
    this.data0 = data;
  }

  create(): void {
    this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x0b120e, 0.7).setOrigin(0);
    this.add
      .text(VIEW_W / 2, 110, 'PAUSED', { fontFamily: FONT_DISPLAY, fontSize: '56px', color: '#ff9a3c' })
      .setOrigin(0.5)
      .setStroke('#1b1a17', 8);
    this.showMain();
    services.input.poll(); // drop the press that opened the menu
  }

  private showMain(): void {
    this.menu?.destroy();
    this.menu = new MenuList(this, VIEW_W / 2, 210, [
      { label: () => 'RESUME', action: () => this.resume() },
      { label: () => 'SETTINGS', action: () => this.showSettings() },
      { label: () => 'RESTART STAGE', action: () => this.restart() },
      { label: () => 'QUIT TO MENU', action: () => this.quit() },
    ]);
  }

  private showSettings(): void {
    this.menu?.destroy();
    this.menu = new MenuList(this, VIEW_W / 2, 180, settingsEntries(() => this.showMain()), 420, 42);
  }

  private resume(): void {
    this.scene.stop();
    this.scene.resume(this.data0.from);
  }

  private restart(): void {
    services.telemetry.log('restart', { stage: this.data0.stage });
    this.scene.stop('Hud');
    this.scene.stop(this.data0.from);
    this.scene.stop();
    this.scene.start(this.data0.from, { stage: this.data0.stage, mode: this.data0.mode });
  }

  private quit(): void {
    this.scene.stop('Hud');
    this.scene.stop(this.data0.from);
    this.scene.stop();
    this.scene.start('Menu');
  }

  override update(): void {
    const f = services.input.poll();
    if (f.pausePressed) {
      this.resume();
      return;
    }
    this.menu?.update(f);
  }
}
