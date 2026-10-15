import Phaser from 'phaser';
import { FONT_DISPLAY } from '../config/constants';
import { services } from '../systems/services';
import type { InputFrame } from '../systems/InputManager';
import { SETTINGS_ITEMS } from './settingsItems';

export interface MenuEntry {
  label: () => string;
  action: () => void;
  /** Left/right changes the value instead of confirming. */
  cycle?: boolean;
}

/**
 * Vertical menu driven by keyboard, gamepad, mouse and touch.
 * Call `update(frame)` once per frame with a polled input frame.
 */
export class MenuList {
  private index = 0;
  private readonly rows: { plate: Phaser.GameObjects.Graphics; text: Phaser.GameObjects.Text; zone: Phaser.GameObjects.Zone }[] = [];
  private prevDir = { up: false, down: false, left: false, right: false };

  constructor(
    scene: Phaser.Scene,
    private readonly x: number,
    private readonly y: number,
    private readonly entries: MenuEntry[],
    private readonly width = 340,
    private readonly rowH = 48,
  ) {
    entries.forEach((e, i) => {
      const plate = scene.add.graphics().setScrollFactor(0);
      const text = scene.add
        .text(x, y + i * rowH, e.label(), { fontFamily: FONT_DISPLAY, fontSize: '24px', color: '#ffffff' })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setShadow(2, 2, '#000000', 0, true, true);
      const zone = scene.add
        .zone(x, y + i * rowH, width, rowH - 6)
        .setScrollFactor(0)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => this.select(i));
      zone.on('pointerdown', () => {
        services.sfx.unlock();
        this.select(i);
        this.activate();
      });
      this.rows.push({ plate, text, zone });
    });
    this.redraw();
  }

  get selected(): number {
    return this.index;
  }

  select(i: number): void {
    if (i === this.index) return;
    this.index = i;
    services.sfx.play('ui');
    this.redraw();
  }

  activate(): void {
    services.sfx.play('confirm');
    this.entries[this.index].action();
    this.redraw();
  }

  update(f: InputFrame): void {
    const edge = (k: 'up' | 'down' | 'left' | 'right') => f[k] && !this.prevDir[k];
    if (edge('up')) this.select((this.index + this.entries.length - 1) % this.entries.length);
    if (edge('down')) this.select((this.index + 1) % this.entries.length);
    const e = this.entries[this.index];
    if (e.cycle && (edge('left') || edge('right'))) this.activate();
    else if (f.confirmPressed) this.activate();
    this.prevDir = { up: f.up, down: f.down, left: f.left, right: f.right };
  }

  redraw(): void {
    this.rows.forEach((r, i) => {
      const on = i === this.index;
      const cy = this.y + i * this.rowH;
      const w = this.width;
      const h = this.rowH - 10;
      r.plate.clear();
      r.plate.fillStyle(on ? 0xff8a2e : 0x10231c, on ? 0.95 : 0.78);
      r.plate.lineStyle(2, on ? 0xffe2a8 : 0x6f9a8f, 1);
      const s = 12;
      const pts = [
        new Phaser.Math.Vector2(this.x - w / 2 + s, cy - h / 2),
        new Phaser.Math.Vector2(this.x + w / 2, cy - h / 2),
        new Phaser.Math.Vector2(this.x + w / 2 - s, cy + h / 2),
        new Phaser.Math.Vector2(this.x - w / 2, cy + h / 2),
      ];
      r.plate.fillPoints(pts, true);
      r.plate.strokePoints(pts, true);
      r.text.setText(this.entries[i].label());
      r.text.setColor(on ? '#1b1a17' : '#f2f6e6');
      r.text.setShadow(2, 2, on ? 'rgba(0,0,0,0)' : '#000000', 0, true, true);
    });
  }

  setDepth(d: number): this {
    this.rows.forEach((r) => {
      r.plate.setDepth(d);
      r.text.setDepth(d + 1);
      r.zone.setDepth(d + 1);
    });
    return this;
  }

  destroy(): void {
    this.rows.forEach((r) => {
      r.plate.destroy();
      r.text.destroy();
      r.zone.destroy();
    });
  }
}

/** Settings rows plus a Back row; saves and applies on every change. */
export function settingsEntries(onBack: () => void): MenuEntry[] {
  const s = services.save.data.settings;
  return [
    ...SETTINGS_ITEMS.map((item) => ({
      label: () => `${item.label}: ${item.value(s)}`,
      cycle: true,
      action: () => {
        item.next(s);
        services.sfx.enabled = s.sound;
        void services.save.save();
      },
    })),
    { label: () => 'BACK', action: onBack },
  ];
}
