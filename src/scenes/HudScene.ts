/**
 * Heads-up display, drawn at full canvas resolution so text stays crisp, in the menu theme
 * (slanted gunmetal plates, ember accent, condensed HUD numerals).
 *
 * Top left: squad cards (portrait, health, armour, air). Top right: weapon, magazine and
 * reload. Centre: timer, air gauge while underwater, callouts. Cinematics get letterbox bars,
 * a title card and a skip prompt (after the first viewing).
 */
import Phaser from 'phaser';
import { CANVAS_H, CANVAS_W, SCENES } from '../config/constants';
import { hud, HUD_EVENTS } from '../ui/hudState';
import { TouchControls } from '../ui/TouchControls';
import { input } from '../systems/InputManager';
import { saves } from '../systems/services';
import { formatTime } from '../systems/rank';
import { FLAGS } from '../systems/flags';
import { CSSC, PALETTE, css, plate, segments, chevrons, txt } from '../ui/theme';

const PAD = 16;
const CARD_W = 168;
const CARD_H = 64;
const WPN_W = 250;
const WPN_H = 64;
const BAR_H = 44;
const AIR_Y = 150;

interface Card {
  portrait: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text;
  down: Phaser.GameObjects.Text;
}

export class HudScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private top!: Phaser.GameObjects.Graphics;
  private cards: Card[] = [];
  private swapText!: Phaser.GameObjects.Text;
  private timer!: Phaser.GameObjects.Text;
  private fpsText!: Phaser.GameObjects.Text;
  private callout!: Phaser.GameObjects.Text;
  private wName!: Phaser.GameObjects.Text;
  private wMag!: Phaser.GameObjects.Text;
  private wInfo!: Phaser.GameObjects.Text;
  private airLabel!: Phaser.GameObjects.Text;
  private overlay!: Phaser.GameObjects.Container;
  private retryText!: Phaser.GameObjects.Text;
  private cineTitle!: Phaser.GameObjects.Text;
  private cineSub!: Phaser.GameObjects.Text;
  private cineSkip!: Phaser.GameObjects.Text;
  private gameplay: Phaser.GameObjects.GameObject[] = [];
  private touch!: TouchControls;
  private isTouchDevice = false;
  private t = 0;
  private uiAlpha = 1;

  constructor() {
    super(SCENES.hud);
  }

  create(): void {
    this.g = this.add.graphics();
    this.cards = [];
    for (let i = 0; i < 3; i++) {
      const x = PAD + i * (CARD_W + 10);
      const portrait = this.add.image(x + 30, PAD + 30, 'portrait-kemi').setScale(2.6);
      const name = this.add.text(
        x + 58,
        PAD + 4,
        '',
        txt('hud', 22, CSSC.bone, { letterSpacing: 1 }),
      );
      const down = this.add
        .text(x + CARD_W / 2 + 10, PAD + CARD_H / 2, 'DOWN', txt('display', 22, CSSC.alert))
        .setOrigin(0.5)
        .setRotation(-0.12)
        .setStroke(CSSC.ink, 5);
      this.cards.push({ portrait, name, down });
    }
    this.swapText = this.add.text(
      PAD + 4,
      PAD + CARD_H + 8,
      '',
      txt('hud', 20, CSSC.bone, { letterSpacing: 2 }),
    );
    this.timer = this.add
      .text(
        CANVAS_W - PAD - 20,
        PAD + WPN_H + 4,
        '',
        txt('hud', 28, CSSC.bone, { letterSpacing: 2 }),
      )
      .setOrigin(1, 0)
      .setStroke(CSSC.ink, 4);
    this.airLabel = this.add
      .text(CANVAS_W / 2, AIR_Y - 30, 'AIR', txt('hud', 20, CSSC.bone, { letterSpacing: 4 }))
      .setOrigin(0.5, 0)
      .setStroke(CSSC.ink, 4);
    this.fpsText = this.add
      .text(CANVAS_W - PAD, CANVAS_H - PAD, '', txt('hud', 16, CSSC.muted))
      .setOrigin(1, 1);

    this.wName = this.add.text(0, 0, '', txt('hud', 24, CSSC.bone, { letterSpacing: 2 }));
    this.wMag = this.add.text(0, 0, '', txt('hud', 40, CSSC.emberHi)).setOrigin(1, 0);
    this.wInfo = this.add.text(0, 0, '', txt('hud', 17, CSSC.muted, { letterSpacing: 1 }));

    this.callout = this.add
      .text(CANVAS_W / 2, 200, '', txt('display', 30, CSSC.bone))
      .setOrigin(0.5)
      .setStroke(CSSC.ink, 8)
      .setAlpha(0);

    // squad down overlay
    const shade = this.add.rectangle(
      CANVAS_W / 2,
      CANVAS_H / 2,
      CANVAS_W,
      CANVAS_H,
      PALETTE.ink,
      0.72,
    );
    const band = this.add.graphics();
    plate(band, -40, CANVAS_H / 2 - 70, CANVAS_W + 80, 92, {
      skew: 30,
      fill: PALETTE.alert,
      fillAlpha: 0.9,
    });
    const title = this.add
      .text(CANVAS_W / 2, CANVAS_H / 2 - 24, 'SQUAD DOWN', txt('display', 60, CSSC.bone))
      .setOrigin(0.5)
      .setStroke(CSSC.ink, 10);
    this.retryText = this.add
      .text(
        CANVAS_W / 2,
        CANVAS_H / 2 + 52,
        'PRESS JUMP OR TAP · RETRY FROM CHECKPOINT',
        txt('hud', 26, CSSC.bone, { letterSpacing: 3 }),
      )
      .setOrigin(0.5)
      .setPadding(20, 12, 20, 12);
    this.overlay = this.add
      .container(0, 0, [shade, band, title, this.retryText])
      .setVisible(false)
      .setDepth(50);
    shade.setInteractive().on('pointerdown', () => this.game.events.emit(HUD_EVENTS.retry));

    // cinematic layer
    this.top = this.add.graphics().setDepth(60);
    this.cineTitle = this.add
      .text(64, CANVAS_H - 150, '', txt('display', 54, CSSC.bone))
      .setOrigin(0, 1)
      .setStroke(CSSC.ink, 10)
      .setShadow(5, 5, '#070b11', 0, true, true)
      .setDepth(61);
    this.cineSub = this.add
      .text(68, CANVAS_H - 142, '', txt('hud', 26, CSSC.emberHi, { letterSpacing: 5 }))
      .setOrigin(0, 0)
      .setStroke(CSSC.ink, 4)
      .setDepth(61);
    this.cineSkip = this.add
      .text(
        CANVAS_W - 28,
        CANVAS_H - 32,
        'JUMP / TAP  ·  SKIP  ▸▸',
        txt('hud', 22, CSSC.bone, { letterSpacing: 3 }),
      )
      .setOrigin(1, 0.5)
      .setDepth(61);
    this.input.on('pointerdown', () => {
      if (hud.cinematic.active && hud.cinematic.skippable) this.game.events.emit(HUD_EVENTS.skip);
    });

    this.gameplay = [
      ...this.cards.flatMap((c) => [c.portrait, c.name, c.down]),
      this.swapText,
      this.timer,
      this.wName,
      this.wMag,
      this.wInfo,
      this.airLabel,
      this.g,
    ];

    this.isTouchDevice =
      (navigator.maxTouchPoints ?? 0) > 0 ||
      window.matchMedia?.('(pointer: coarse)').matches === true;
    this.touch = new TouchControls(this);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.wasTouch) input.noteSource('touch');
    });

    this.game.events.on(HUD_EVENTS.callout, this.showCallout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(HUD_EVENTS.callout, this.showCallout, this);
      this.touch.destroy();
    });
  }

  private showCallout(text: string, color: number): void {
    this.callout
      .setText(text.toUpperCase())
      .setColor(css(color))
      .setAlpha(1)
      .setY(200)
      .setScale(1.25);
    this.tweens.killTweensOf(this.callout);
    this.tweens.add({ targets: this.callout, scale: 1, duration: 140, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.callout, alpha: 0, y: 184, delay: 1000, duration: 400 });
  }

  private touchVisible(): boolean {
    const mode = saves.data.settings.touchControls;
    if (mode === 'on') return true;
    if (mode === 'off') return false;
    if (!this.isTouchDevice) return false;
    return input.lastSource === 'touch';
  }

  override update(_time: number, delta: number): void {
    if (!hud.running) return;
    this.t += delta;
    const g = this.g;
    g.clear();
    const cine = hud.cinematic;
    const uiAlpha = cine.active ? 1 - Math.min(1, cine.letterbox * 1.5) : 1;
    this.uiAlpha = uiAlpha;
    for (const o of this.gameplay)
      (o as unknown as Phaser.GameObjects.Components.Alpha).setAlpha?.(uiAlpha);

    this.drawCards(g);
    this.drawSwap(g);
    this.drawWeapon(g);
    this.drawAir(g);

    this.timer
      .setText(formatTime(hud.timeMs))
      .setX(CANVAS_W - PAD - 20 - (this.touch.visible ? 64 : 0));
    this.fpsText.setText(
      hud.fps ? `${hud.fps.p50} FPS · P10 ${hud.fps.p10}` : FLAGS.debug ? 'DEBUG' : '',
    );

    this.overlay.setVisible(hud.status === 'squadDown');
    this.retryText.setAlpha(hud.showRetry ? 1 : 0.3);

    this.drawCinematic();

    const showTouch = this.touchVisible() && hud.status === 'playing' && !cine.active;
    if (showTouch !== this.touch.visible) this.touch.setVisible(showTouch);
    this.touch.setSwapReady(hud.swapReady, hud.mode === 'relay');
  }

  private drawCards(g: Phaser.GameObjects.Graphics): void {
    hud.members.forEach((m, i) => {
      const card = this.cards[i];
      if (!card) return;
      const x = PAD + i * (CARD_W + 10);
      const y = PAD;
      const a = (m.down ? 0.45 : 1) * this.uiAlpha;
      plate(g, x, y, CARD_W, CARD_H, {
        skew: 14,
        fill: m.active ? PALETTE.gunmetal : PALETTE.navy,
        fillAlpha: m.active ? 0.92 : 0.75,
        stroke: m.active ? m.color : PALETTE.steel,
        strokeAlpha: 1,
        lineWidth: m.active ? 3 : 1.5,
      });
      // role colour tab
      plate(g, x + 4, y + 4, 10, CARD_H - 8, { skew: 4, fill: m.color, fillAlpha: a });
      card.portrait
        .setTexture(`portrait-${m.id}`)
        .setPosition(x + 36, y + 32)
        .setAlpha(a);
      card.name
        .setPosition(x + 60, y + 2)
        .setText(m.name.toUpperCase())
        .setAlpha(a);
      segments(g, x + 60, y + 32, m.maxHp, m.hp, 16, 9, PALETTE.hp, PALETTE.hpEmpty);
      segments(
        g,
        x + 60,
        y + 45,
        m.maxArmour,
        m.armour,
        16,
        5,
        PALETTE.armour,
        PALETTE.armourEmpty,
      );
      // air sliver when it is not full
      if (m.oxygen < 0.999 && !m.down) {
        g.fillStyle(PALETTE.ink, 0.8).fillRect(x + 60, y + 54, 90, 4);
        g.fillStyle(m.oxygen < 0.3 ? PALETTE.alert : 0x7fd6e6, 1).fillRect(
          x + 60,
          y + 54,
          90 * m.oxygen,
          4,
        );
      }
      card.down.setVisible(m.down);
    });
    for (let i = hud.members.length; i < this.cards.length; i++) {
      const c = this.cards[i];
      c?.portrait.setVisible(false);
      c?.name.setVisible(false);
      c?.down.setVisible(false);
    }
  }

  private drawSwap(g: Phaser.GameObjects.Graphics): void {
    const y = PAD + CARD_H + 10;
    if (hud.mode === 'relay') {
      const label = hud.nextName ? `SWAP  ${hud.nextName.toUpperCase()}` : 'NOBODY LEFT TO TAG IN';
      this.swapText
        .setText(label)
        .setColor(hud.swapReady ? CSSC.bone : CSSC.dim)
        .setPosition(PAD + 52, y);
      chevrons(
        g,
        PAD + 4,
        y + 5,
        16,
        2,
        1 - hud.swapCooldownFrac,
        hud.swapReady ? PALETTE.ember : PALETTE.steelHi,
        PALETTE.steel,
      );
    } else {
      this.swapText
        .setText(`LIVES  ${hud.livesLeft}`)
        .setColor(CSSC.bone)
        .setPosition(PAD + 4, y);
    }
  }

  private drawWeapon(g: Phaser.GameObjects.Graphics): void {
    const w = hud.weapon;
    const visible = !!w;
    this.wName.setVisible(visible);
    this.wMag.setVisible(visible);
    this.wInfo.setVisible(visible);
    if (!w) return;
    const x = CANVAS_W - PAD - WPN_W - (this.touch.visible ? 64 : 0);
    const y = PAD;
    plate(g, x, y, WPN_W, WPN_H, {
      skew: 14,
      fill: PALETTE.gunmetal,
      fillAlpha: 0.9,
      stroke: w.blocked ? PALETTE.alert : PALETTE.steel,
      lineWidth: w.blocked ? 3 : 1.5,
    });
    this.wName
      .setPosition(x + 22, y + 2)
      .setText(w.name.toUpperCase())
      .setScale(1);
    if (this.wName.width > WPN_W - 110) this.wName.setScale((WPN_W - 110) / this.wName.width, 1);
    const low = w.magSize > 0 && w.mag <= Math.max(1, Math.floor(w.magSize * 0.25));
    this.wMag
      .setPosition(x + WPN_W - 22, y - 2)
      .setText(w.magSize > 0 ? String(w.mag) : '∞')
      .setColor(w.reload !== null ? CSSC.dim : low ? CSSC.alert : CSSC.emberHi);
    const keyHint =
      input.lastSource === 'gamepad' ? 'Y' : input.lastSource === 'touch' ? 'WPN' : 'Q';
    if (w.blocked) {
      const blink = Math.floor(this.t / 260) % 2 === 0;
      this.wInfo.setText('CAN’T FIRE UNDERWATER').setColor(blink ? CSSC.alert : CSSC.bone);
    } else if (w.reload !== null) {
      this.wInfo.setText('RELOADING').setColor(CSSC.signal);
    } else {
      this.wInfo
        .setText(`[${keyHint}] ${w.other.toUpperCase()}   /${w.magSize}`)
        .setColor(CSSC.muted);
    }
    this.wInfo.setPosition(x + 22, y + 34);
    // magazine strip / reload bar
    const bx = x + 20;
    const by = y + WPN_H - 8;
    const bw = WPN_W - 50;
    g.fillStyle(PALETTE.ink, 0.9).fillRect(bx, by, bw, 4);
    if (w.reload !== null) g.fillStyle(PALETTE.signal, 1).fillRect(bx, by, bw * w.reload, 4);
    else if (w.magSize > 0)
      g.fillStyle(low ? PALETTE.alert : PALETTE.ember, 1).fillRect(
        bx,
        by,
        (bw * w.mag) / w.magSize,
        4,
      );
  }

  private drawAir(g: Phaser.GameObjects.Graphics): void {
    const show = hud.showOxygen && hud.status === 'playing';
    this.airLabel.setVisible(show);
    if (!show) return;
    const frac = Math.max(0, Math.min(1, hud.oxygen));
    const low = frac < 0.3;
    const blink = low && Math.floor(this.t / 200) % 2 === 0;
    const cx = CANVAS_W / 2;
    const w = 220;
    const x = cx - w / 2;
    const y = AIR_Y;
    plate(g, x - 8, y - 4, w + 16, 16, { skew: 6, fill: PALETTE.ink, fillAlpha: 0.8 });
    g.fillStyle(
      blink ? PALETTE.bone : low ? PALETTE.alert : frac < 0.6 ? PALETTE.signal : 0x7fd6e6,
      1,
    );
    g.fillRect(x, y, w * frac, 8);
    this.airLabel
      .setColor(low ? CSSC.alert : CSSC.bone)
      .setText(frac <= 0 ? 'NO AIR · SURFACE!' : 'AIR');
  }

  private drawCinematic(): void {
    const c = hud.cinematic;
    const g = this.top;
    g.clear();
    const lb = c.active ? c.letterbox : 0;
    if (lb > 0) {
      g.fillStyle(0x000000, 1);
      g.fillRect(0, 0, CANVAS_W, BAR_H * lb);
      g.fillRect(0, CANVAS_H - BAR_H * lb, CANVAS_W, BAR_H * lb);
    }
    const ta = c.active ? c.titleAlpha : 0;
    if (ta > 0) {
      plate(g, 30, CANVAS_H - 220, 520, 8, { skew: 4, fill: PALETTE.ember, fillAlpha: ta });
    }
    this.cineTitle
      .setText(c.title)
      .setAlpha(ta)
      .setX(64 - (1 - ta) * 30);
    this.cineSub.setText(c.subtitle).setAlpha(ta);
    this.cineSkip
      .setVisible(c.active && c.skippable && lb > 0.5)
      .setAlpha(0.6 + Math.sin(this.t / 220) * 0.3);
  }
}
