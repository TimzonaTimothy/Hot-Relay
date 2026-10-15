/**
 * On-screen touch controls (INPUT-03).
 * Left side: a floating stick that appears where the thumb lands (8-way).
 * Right side: Fire, Jump, Swap and Weapon buttons. Top right: pause.
 * The stick is analogue horizontally: a small push walks, a full push runs.
 * Multi-touch: each pointer is tracked separately, so you can run, jump and fire at once.
 */
import Phaser from 'phaser';
import { CANVAS_H, CANVAS_W, CSS, FONT } from '../config/constants';
import { input, type Action } from '../systems/InputManager';
import { sfx } from '../systems/Sfx';

interface TouchButton {
  action: Action;
  x: number;
  y: number;
  r: number;
  label: string;
  circle: Phaser.GameObjects.Arc;
  text: Phaser.GameObjects.Text;
  pointerId: number | null;
}

const STICK_RADIUS = 56;
const STICK_DEADZONE = 14;

export class TouchControls {
  private container: Phaser.GameObjects.Container;
  private stickBase: Phaser.GameObjects.Arc;
  private stickKnob: Phaser.GameObjects.Arc;
  private stickPointer: number | null = null;
  private stickOrigin = { x: 0, y: 0 };
  private buttons: TouchButton[] = [];
  visible = false;

  constructor(private readonly scene: Phaser.Scene) {
    this.container = scene.add.container(0, 0).setDepth(100);
    this.stickBase = scene.add
      .circle(150, CANVAS_H - 140, STICK_RADIUS, 0xffffff, 0.08)
      .setStrokeStyle(2, 0xffffff, 0.25);
    this.stickKnob = scene.add.circle(150, CANVAS_H - 140, 24, 0xffffff, 0.3);
    this.container.add([this.stickBase, this.stickKnob]);

    const right = CANVAS_W - 90;
    const bottom = CANVAS_H - 90;
    this.addButton('jump', right, bottom, 50, 'JUMP');
    this.addButton('fire', right - 120, bottom + 10, 50, 'FIRE');
    this.addButton('swap', right - 30, bottom - 125, 38, 'SWAP');
    this.addButton('weapon', right - 150, bottom - 105, 32, 'WPN');
    this.addButton('pause', CANVAS_W - 40, 40, 24, 'II');

    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('pointerupoutside', this.onUp, this);
    this.setVisible(false);
  }

  private addButton(action: Action, x: number, y: number, r: number, label: string): void {
    const circle = this.scene.add.circle(x, y, r, 0xffffff, 0.1).setStrokeStyle(2, 0xffffff, 0.3);
    const text = this.scene.add
      .text(x, y, label, {
        fontFamily: FONT,
        fontSize: r > 40 ? '18px' : '14px',
        color: CSS.ui,
        fontStyle: '700',
      })
      .setOrigin(0.5)
      .setAlpha(0.8);
    this.container.add([circle, text]);
    this.buttons.push({ action, x, y, r, label, circle, text, pointerId: null });
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.container.setVisible(v);
    if (!v) this.releaseAll();
  }

  /** Swap button greys out while the swap is cooling down or nobody is left to tag in. */
  setSwapReady(ready: boolean, show: boolean): void {
    const b = this.buttons.find((x) => x.action === 'swap');
    if (!b) return;
    b.circle.setVisible(show);
    b.text.setVisible(show);
    b.circle.setFillStyle(0xffffff, ready ? 0.16 : 0.04);
    b.text.setAlpha(ready ? 0.9 : 0.35);
  }

  private hitButton(p: Phaser.Input.Pointer): TouchButton | undefined {
    return this.buttons.find(
      (b) => b.circle.visible && Phaser.Math.Distance.Between(p.x, p.y, b.x, b.y) <= b.r + 14,
    );
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (!this.visible || !p.wasTouch) return;
    sfx.unlock();
    const b = this.hitButton(p);
    if (b) {
      b.pointerId = p.id;
      b.circle.setFillStyle(0xffffff, 0.35);
      input.setTouch(b.action, true);
      return;
    }
    if (p.x < CANVAS_W * 0.45 && this.stickPointer === null) {
      this.stickPointer = p.id;
      this.stickOrigin = { x: p.x, y: p.y };
      this.stickBase.setPosition(p.x, p.y);
      this.stickKnob.setPosition(p.x, p.y);
    }
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (!this.visible) return;
    if (p.id === this.stickPointer) {
      const dx = p.x - this.stickOrigin.x;
      const dy = p.y - this.stickOrigin.y;
      const dist = Math.hypot(dx, dy);
      const k = dist > STICK_RADIUS ? STICK_RADIUS / dist : 1;
      this.stickKnob.setPosition(this.stickOrigin.x + dx * k, this.stickOrigin.y + dy * k);
      if (dist < STICK_DEADZONE) {
        input.setTouchDirection({ left: false, right: false, up: false, down: false });
        input.setTouchAxis(0);
        return;
      }
      input.setTouchAxis((dx * k) / STICK_RADIUS);
      // 8 sectors of 45° each; diagonals get both directions
      const angle = Math.atan2(dy, dx);
      const sector = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
      input.setTouchDirection({
        right: sector === 0 || sector === 1 || sector === 7,
        down: sector === 1 || sector === 2 || sector === 3,
        left: sector === 3 || sector === 4 || sector === 5,
        up: sector === 5 || sector === 6 || sector === 7,
      });
      return;
    }
    // sliding a thumb between Fire and Jump works like real buttons
    const owned = this.buttons.find((b) => b.pointerId === p.id);
    const over = this.hitButton(p);
    if (owned && over && over !== owned && over.action !== 'pause') {
      this.release(owned);
      over.pointerId = p.id;
      over.circle.setFillStyle(0xffffff, 0.35);
      input.setTouch(over.action, true);
    }
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (p.id === this.stickPointer) {
      this.stickPointer = null;
      this.stickKnob.setPosition(this.stickOrigin.x, this.stickOrigin.y);
      input.setTouchDirection({ left: false, right: false, up: false, down: false });
      input.setTouchAxis(0);
    }
    for (const b of this.buttons) if (b.pointerId === p.id) this.release(b);
  }

  private release(b: TouchButton): void {
    b.pointerId = null;
    b.circle.setFillStyle(0xffffff, 0.1);
    input.setTouch(b.action, false);
  }

  private releaseAll(): void {
    this.stickPointer = null;
    this.buttons.forEach((b) => this.release(b));
    input.clearTouch();
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.onDown, this);
    this.scene.input.off('pointermove', this.onMove, this);
    this.scene.input.off('pointerup', this.onUp, this);
    this.scene.input.off('pointerupoutside', this.onUp, this);
    this.releaseAll();
    this.container.destroy();
  }
}
