/**
 * Vertical menu of slanted plates, usable with keyboard, gamepad and touch.
 * Up/down moves, left/right adjusts a setting, jump/enter/tap activates.
 * Labels of the form "Name: Value" render the value as a pill on the right.
 */
import Phaser from 'phaser';
import { input, type InputFrame } from '../systems/InputManager';
import { sfx } from '../systems/Sfx';
import { CSSC, PALETTE, chevrons, plate, txt } from './theme';

export interface MenuItem {
  label: () => string;
  action?: () => void;
  /** Left/right on a setting; dir is -1 or +1. Tapping calls adjust(+1). */
  adjust?: (dir: 1 | -1) => void;
}

export interface MenuOpts {
  width?: number;
  height?: number;
  spacing?: number;
  fontSize?: number;
  /** x is the left edge of the plates when 'left', their centre when 'center'. */
  align?: 'left' | 'center';
}

interface Row {
  item: MenuItem;
  g: Phaser.GameObjects.Graphics;
  name: Phaser.GameObjects.Text;
  value: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Zone;
  x: number;
  y: number;
}

export class MenuList {
  private rows: Row[] = [];
  private index = 0;
  private prev = { up: false, down: false, left: false, right: false };
  private enabled = true;
  private readonly w: number;
  private readonly h: number;
  private cursor: Phaser.GameObjects.Graphics;
  private glint: Phaser.GameObjects.Rectangle;
  private glintTween?: Phaser.Tweens.Tween;
  /** The input frame read during the last update (scenes check pausePressed for "back"). */
  lastFrame: InputFrame | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly items: MenuItem[],
    x: number,
    y: number,
    opts: MenuOpts = {},
  ) {
    this.w = opts.width ?? 340;
    this.h = opts.height ?? 40;
    const spacing = opts.spacing ?? this.h + 10;
    const size = opts.fontSize ?? Math.round(this.h * 0.5);
    const left = opts.align === 'center' ? x - this.w / 2 : x;

    this.cursor = scene.add.graphics().setDepth(5);
    this.glint = scene.add
      .rectangle(0, 0, 10, this.h + 8, 0xffffff, 0.35)
      .setAngle(20)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(4)
      .setVisible(false);

    items.forEach((item, i) => {
      const ry = y + i * spacing;
      const g = scene.add.graphics().setDepth(2);
      const name = scene.add
        .text(left + 28, ry + this.h / 2, '', txt('body', size))
        .setOrigin(0, 0.5)
        .setDepth(3);
      const value = scene.add
        .text(left + this.w - 34, ry + this.h / 2, '', txt('hud', size + 4))
        .setOrigin(0.5, 0.5)
        .setDepth(3);
      const zone = scene.add
        .zone(left, ry, this.w, this.h)
        .setOrigin(0)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => this.select(i));
      zone.on('pointerdown', () => {
        this.select(i);
        sfx.unlock();
        this.activate(item, 1);
      });
      this.rows.push({ item, g, name, value, zone, x: left, y: ry });

      // staggered slide-in
      for (const o of [g, name, value]) {
        o.setAlpha(0);
        scene.tweens.add({ targets: o, alpha: 1, x: `+=0`, duration: 220, delay: 60 + i * 45 });
      }
      g.x = -40;
      scene.tweens.add({
        targets: g,
        x: 0,
        duration: 260,
        delay: 60 + i * 45,
        ease: 'Cubic.easeOut',
      });
    });

    const held = input.peekHeld();
    this.prev = { up: held.up, down: held.down, left: held.left, right: held.right };
    this.refresh();
  }

  setEnabled(v: boolean): void {
    this.enabled = v;
  }

  private select(i: number): void {
    if (i === this.index) return;
    this.index = i;
    sfx.ui();
    this.refresh();
  }

  private activate(item: MenuItem, dir: 1 | -1): void {
    if (!this.enabled) return;
    if (item.adjust) item.adjust(dir);
    else item.action?.();
    sfx.ui();
    if (this.rows.length) this.refresh();
  }

  refresh(): void {
    this.rows.forEach((r, i) => {
      const selected = i === this.index;
      const full = r.item.label();
      const sep = full.indexOf(': ');
      const name = sep >= 0 ? full.slice(0, sep) : full;
      const val = sep >= 0 ? full.slice(sep + 2) : '';
      r.g.clear();
      if (selected) {
        plate(r.g, r.x, r.y, this.w, this.h, { fill: PALETTE.ember });
        plate(r.g, r.x, r.y, this.w, 4, { skew: 2, fill: PALETTE.emberHi });
      } else {
        plate(r.g, r.x, r.y, this.w, this.h, {
          fill: PALETTE.navy,
          fillAlpha: 0.78,
          stroke: PALETTE.steel,
          lineWidth: 2,
        });
      }
      r.name.setText(name.toUpperCase()).setColor(selected ? CSSC.ink : CSSC.bone);
      r.value.setText(val.toUpperCase());
      if (val) {
        const on = val === 'On';
        const off = val === 'Off';
        const pillFill = on
          ? PALETTE.ok
          : off
            ? PALETTE.steel
            : selected
              ? PALETTE.ink
              : PALETTE.gunmetal;
        const pw = Math.max(54, r.value.width + 18);
        plate(r.g, r.x + this.w - 34 - pw / 2 - 6, r.y + 7, pw, this.h - 14, {
          skew: 6,
          fill: pillFill,
        });
        r.value.setColor(on ? CSSC.ink : off ? CSSC.bone : selected ? CSSC.emberHi : CSSC.emberHi);
      }
    });
    this.drawCursor();
  }

  private drawCursor(): void {
    const r = this.rows[this.index];
    if (!r) return;
    this.cursor.clear();
    chevrons(this.cursor, 0, 0, this.h * 0.45, 2, 1, PALETTE.emberHi, PALETTE.emberHi);
    this.cursor.setPosition(r.x - this.h * 0.95, r.y + this.h * 0.28);
    this.scene.tweens.killTweensOf(this.cursor);
    this.scene.tweens.add({
      targets: this.cursor,
      x: this.cursor.x + 6,
      duration: 380,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.glintTween?.stop();
    this.glint
      .setPosition(r.x + 30, r.y + this.h / 2)
      .setVisible(true)
      .setAlpha(0);
    this.glintTween = this.scene.tweens.add({
      targets: this.glint,
      x: r.x + this.w - 40,
      alpha: { from: 0.0, to: 0.45 },
      duration: 520,
      delay: 300,
      repeatDelay: 1500,
      repeat: -1,
      onRepeat: () => this.glint.setAlpha(0),
    });
  }

  /** Call every frame from the owning scene's update. */
  update(): void {
    if (!this.enabled) return;
    input.update();
    const held = input.peekHeld();
    const frame = input.consume();
    this.lastFrame = frame;
    const pressed = {
      up: frame.upPressed,
      down: frame.downPressed,
      left: frame.leftPressed,
      right: frame.rightPressed,
    };
    const edge = (k: 'up' | 'down' | 'left' | 'right') => pressed[k] || (held[k] && !this.prev[k]);

    if (edge('up')) this.select((this.index - 1 + this.items.length) % this.items.length);
    if (edge('down')) this.select((this.index + 1) % this.items.length);
    const item = this.items[this.index];
    if (item?.adjust && edge('left')) this.activate(item, -1);
    if (item?.adjust && edge('right')) this.activate(item, 1);
    if (item && (frame.jumpPressed || frame.confirmPressed)) {
      sfx.unlock();
      this.activate(item, 1);
    }
    this.prev = { up: held.up, down: held.down, left: held.left, right: held.right };
  }

  destroy(): void {
    this.glintTween?.stop();
    this.scene.tweens.killTweensOf(this.cursor);
    this.cursor.destroy();
    this.glint.destroy();
    this.rows.forEach((r) => {
      this.scene.tweens.killTweensOf([r.g, r.name, r.value]);
      r.g.destroy();
      r.name.destroy();
      r.value.destroy();
      r.zone.destroy();
    });
    this.rows = [];
  }
}
