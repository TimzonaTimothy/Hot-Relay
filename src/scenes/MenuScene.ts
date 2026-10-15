import Phaser from 'phaser';
import { FONT, FONT_DISPLAY, VIEW_H, VIEW_W } from '../config/constants';
import { ARM, FRAME } from '../art/characters';
import { paintBlock } from '../art/environment';
import { rig } from '../art/registry';
import { OPERATORS, SQUAD_ORDER } from '../data/operators';
import { services } from '../systems/services';
import { MenuList, settingsEntries, type MenuEntry } from '../ui/MenuList';
import { formatTime } from '../ui/hudState';

export class MenuScene extends Phaser.Scene {
  private menu: MenuList | null = null;
  private layers: { t: Phaser.GameObjects.TileSprite; f: number }[] = [];
  private scroll = 0;
  private mode: 'relay' | 'solo' = 'relay';

  constructor() {
    super('Menu');
  }

  create(): void {
    this.mode = services.flags.mode;
    this.layers = [];
    this.add.image(0, 0, 'sky').setOrigin(0);
    const layer = (key: string, y: number, h: number, f: number) => this.layers.push({ t: this.add.tileSprite(0, y, VIEW_W, h, key).setOrigin(0), f });
    layer('clouds', 10, 300, 0.1);
    layer('far', -30, 540, 0.25);
    layer('mid', 40, 540, 0.6);
    this.add.tileSprite(0, 476, VIEW_W, 70, 'water').setOrigin(0);

    // the squad on a ruined walkway
    if (!this.textures.exists('menu_ledge')) this.textures.addCanvas('menu_ledge', paintBlock({ w: 420, h: 120, paintDepth: 200, oneWay: false, seed: 99 }));
    this.add.image(560, 430, 'menu_ledge').setOrigin(0);
    SQUAD_ORDER.forEach((id, i) => {
      const x = 640 + i * 110;
      const y = 440 - 2;
      const body = this.add.sprite(x, y, `op_${id}`, 'idle0').setOrigin(0.5, FRAME.footY / FRAME.h);
      body.play({ key: `op_${id}_idle`, startFrame: i % 2 });
      const s = rig(id).shoulder.idle0;
      this.add
        .image(x + s.x, y + s.y, `arm_${id}_r`)
        .setOrigin(ARM.pivotX / ARM.w, ARM.pivotY / ARM.h)
        .setRotation(-0.15 - i * 0.05);
      this.add
        .text(x, y + 14, OPERATORS[id].name.toUpperCase(), { fontFamily: FONT_DISPLAY, fontSize: '15px', color: '#' + OPERATORS[id].color.toString(16).padStart(6, '0') })
        .setOrigin(0.5, 0)
        .setStroke('#1b1a17', 4);
    });
    this.add.image(0, 0, 'near').setOrigin(0).setAlpha(0.95).setX(-700);

    // title
    this.add.rectangle(0, 0, 420, VIEW_H, 0x0b120e, 0.55).setOrigin(0);
    this.add
      .text(210, 70, 'HOT RELAY', { fontFamily: FONT_DISPLAY, fontSize: '68px', color: '#ff9a3c' })
      .setOrigin(0.5)
      .setStroke('#1b1a17', 10)
      .setShadow(4, 4, '#000000', 0, true, true);
    this.add
      .text(210, 118, 'THREE OPERATORS · ONE RELAY', { fontFamily: FONT_DISPLAY, fontSize: '16px', color: '#ffe2a8' })
      .setOrigin(0.5);
    const best = services.save.data.best.jungle01;
    this.add
      .text(210, 146, best ? `Verdant Steps · best ${best.rank} · ${formatTime(best.timeSec)}` : 'Stage 1 · Verdant Steps', { fontFamily: FONT, fontSize: '14px', color: '#b9d6c3' })
      .setOrigin(0.5);
    this.add
      .text(
        210,
        VIEW_H - 64,
        'Move: Arrows/WASD · Jump: Space/Z/K · Fire: X/J\nSwap: C/L/E · Hold aim: Shift/V · Pause: Esc/P\nGamepad and touch supported',
        { fontFamily: FONT, fontSize: '13px', color: '#cfe8dc', align: 'center', lineSpacing: 4 },
      )
      .setOrigin(0.5);
    this.showMain();

    const unlock = () => services.sfx.unlock();
    this.input.once('pointerdown', unlock);
    this.input.keyboard?.once('keydown', unlock);
  }

  private showMain(): void {
    this.menu?.destroy();
    const entries: MenuEntry[] = [
      { label: () => (this.mode === 'solo' ? 'PLAY (SOLO)' : 'PLAY'), action: () => this.play() },
    ];
    if (services.flags.debug) {
      entries.push({
        label: () => `MODE: ${this.mode === 'solo' ? 'SOLO (H2 baseline)' : 'RELAY'}`,
        cycle: true,
        action: () => (this.mode = this.mode === 'solo' ? 'relay' : 'solo'),
      });
    }
    entries.push({ label: () => 'SETTINGS', action: () => this.showSettings() });
    if (services.flags.debug) entries.push({ label: () => 'STRESS TEST', action: () => this.scene.start('Stress') });
    this.menu = new MenuList(this, 210, 210, entries, 320);
  }

  private showSettings(): void {
    this.menu?.destroy();
    this.menu = new MenuList(this, 210, 180, settingsEntries(() => this.showMain()), 380, 40);
  }

  private play(): void {
    services.sfx.unlock();
    this.scene.start('Stage', { stage: 'jungle01', mode: this.mode });
  }

  override update(_t: number, delta: number): void {
    services.fps.push(delta);
    this.scroll += delta * 0.03;
    for (const l of this.layers) l.t.tilePositionX = this.scroll * l.f;
    this.menu?.update(services.input.poll());
  }
}
