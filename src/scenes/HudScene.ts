import Phaser from 'phaser';
import { FONT, FONT_DISPLAY, VIEW_W } from '../config/constants';
import { services, touchActive } from '../systems/services';
import { TouchControls } from '../ui/TouchControls';
import { formatTime, type HudState } from '../ui/hudState';

const CARD_W = 150;
const CARD_H = 64;

/** Squad cards, timer, callouts, fps and the touch overlay. Reads `registry.hud`. */
export class HudScene extends Phaser.Scene {
  private gfx!: Phaser.GameObjects.Graphics;
  private portraits: Phaser.GameObjects.Image[] = [];
  private names: Phaser.GameObjects.Text[] = [];
  private timer!: Phaser.GameObjects.Text;
  private score!: Phaser.GameObjects.Text;
  private callout!: Phaser.GameObjects.Text;
  private fps!: Phaser.GameObjects.Text;
  private weapon!: Phaser.GameObjects.Text;
  private touch!: TouchControls;
  private lastCallout = '';

  constructor() {
    super('Hud');
  }

  create(): void {
    this.portraits = [];
    this.names = [];
    this.gfx = this.add.graphics();
    const style = { fontFamily: FONT_DISPLAY, fontSize: '16px', color: '#ffffff' };
    for (let i = 0; i < 3; i++) {
      this.portraits.push(this.add.image(0, 0, 'portrait_kemi').setOrigin(0).setDisplaySize(48, 48).setVisible(false));
      this.names.push(this.add.text(0, 0, '', style).setShadow(1, 1, '#000', 0, true, true).setVisible(false));
    }
    this.timer = this.add
      .text(VIEW_W - 16, 12, '0:00.00', { fontFamily: FONT_DISPLAY, fontSize: '26px', color: '#ffffff' })
      .setOrigin(1, 0)
      .setStroke('#1b1a17', 5);
    this.score = this.add
      .text(VIEW_W - 16, 44, '0', { fontFamily: FONT_DISPLAY, fontSize: '20px', color: '#ffe2a8' })
      .setOrigin(1, 0)
      .setStroke('#1b1a17', 5);
    this.weapon = this.add
      .text(16, 90, '', { fontFamily: FONT, fontSize: '13px', color: '#e8f3df' })
      .setStroke('#1b1a17', 4);
    this.callout = this.add
      .text(VIEW_W / 2, 150, '', { fontFamily: FONT_DISPLAY, fontSize: '42px', color: '#ffffff' })
      .setOrigin(0.5)
      .setStroke('#1b1a17', 8)
      .setAlpha(0);
    this.fps = this.add
      .text(VIEW_W - 16, 72, '', { fontFamily: FONT, fontSize: '13px', color: '#9be03c' })
      .setOrigin(1, 0)
      .setStroke('#000000', 3);
    this.touch = new TouchControls(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.touch.destroy());
  }

  override update(): void {
    const hud = this.registry.get('hud') as HudState | undefined;
    if (!hud) return;
    this.drawSquad(hud);
    this.timer.setText(formatTime(hud.timeSec));
    this.score.setText(String(hud.score).padStart(6, '0'));
    this.weapon.setText(hud.solo ? `${hud.weapon} · LIVES ${hud.livesLeft}` : hud.weapon);
    const c = hud.callout;
    if (c && c.text !== this.lastCallout) {
      this.lastCallout = c.text;
      this.callout.setText(c.text).setColor(c.color).setAlpha(1).setScale(1.25);
      this.tweens.add({ targets: this.callout, scale: 1, duration: 180, ease: 'Back.easeOut' });
    } else if (!c && this.lastCallout) {
      this.lastCallout = '';
      this.tweens.add({ targets: this.callout, alpha: 0, duration: 250 });
    }
    const showFps = services.save.data.settings.showFps || services.flags.debug;
    this.fps.setVisible(showFps);
    if (showFps) this.fps.setText(`${services.fps.p50.toFixed(0)} fps (p10 ${services.fps.p10.toFixed(0)})`);
    this.touch.setVisible(touchActive());
  }

  private drawSquad(hud: HudState): void {
    const g = this.gfx;
    g.clear();
    hud.members.forEach((m, i) => {
      const x = 12 + i * (CARD_W + 8);
      const y = 12;
      const active = m.active;
      const alpha = m.down ? 0.45 : 1;
      // slanted gunmetal card with an ember edge on the active operator
      g.fillStyle(0x0f1d17, 0.82 * alpha);
      g.fillRoundedRect(x, y, CARD_W, CARD_H, 6);
      g.lineStyle(active ? 3 : 1.5, active ? m.color : 0x6f9a8f, active ? 1 : 0.6);
      g.strokeRoundedRect(x, y, CARD_W, CARD_H, 6);
      const p = this.portraits[i];
      p.setTexture(`portrait_${m.id}`).setPosition(x + 8, y + 8).setVisible(true).setAlpha(alpha);
      if (m.down) p.setTint(0x555555);
      else p.clearTint();
      this.names[i].setText(m.down ? 'DOWN' : m.name.toUpperCase()).setPosition(x + 62, y + 6).setVisible(true).setColor(m.down ? '#ff7a2e' : '#ffffff');
      // health pips (red) and armour pips (steel)
      for (let h = 0; h < m.maxHealth; h++) {
        g.fillStyle(h < m.health ? 0xe0452f : 0x3a2a26, alpha);
        g.fillRect(x + 62 + h * 15, y + 30, 12, 9);
      }
      for (let a = 0; a < m.maxArmour; a++) {
        g.fillStyle(a < m.armour ? 0x8fd0ff : 0x24343c, alpha);
        g.fillRect(x + 62 + a * 15, y + 44, 12, 7);
      }
      // swap cooldown bar under the active card
      if (active && !hud.solo) {
        g.fillStyle(0x24343c, 1);
        g.fillRect(x, y + CARD_H + 4, CARD_W, 5);
        g.fillStyle(hud.canSwap ? 0x9be03c : 0xff9a3c, 1);
        g.fillRect(x, y + CARD_H + 4, CARD_W * (1 - hud.swapCooldown), 5);
      }
    });
    for (let i = hud.members.length; i < 3; i++) {
      this.portraits[i].setVisible(false);
      this.names[i].setVisible(false);
    }
    this.weapon.setY(hud.solo ? 84 : 90);
  }
}
