import Phaser from 'phaser';
import { FONT_DISPLAY, VIEW_H, VIEW_W } from '../config/constants';
import { snap8 } from '../systems/aim';
import { services } from '../systems/services';

interface Button {
  name: 'fire' | 'jump' | 'swap' | 'pause';
  x: number;
  y: number;
  r: number;
  label: string;
  gfx: Phaser.GameObjects.Graphics;
  pointer: number | null;
}

const STICK_R = 62;

/**
 * On-screen controls: a floating stick on the left half, fire / jump / swap on the right.
 * Writes into `services.input.touch`, so gameplay never knows touch exists.
 */
export class TouchControls {
  private readonly buttons: Button[];
  private readonly stickBase: Phaser.GameObjects.Graphics;
  private readonly stickKnob: Phaser.GameObjects.Graphics;
  private stickPointer: number | null = null;
  private stickOrigin = new Phaser.Math.Vector2(150, VIEW_H - 130);
  private readonly root: Phaser.GameObjects.Container;
  visible = true;

  constructor(private readonly scene: Phaser.Scene) {
    scene.input.addPointer(3);
    this.root = scene.add.container(0, 0).setDepth(50);
    this.stickBase = scene.add.graphics();
    this.stickKnob = scene.add.graphics();
    this.root.add([this.stickBase, this.stickKnob]);
    const def: Omit<Button, 'gfx' | 'pointer'>[] = [
      { name: 'fire', x: VIEW_W - 100, y: VIEW_H - 110, r: 56, label: 'FIRE' },
      { name: 'jump', x: VIEW_W - 225, y: VIEW_H - 70, r: 46, label: 'JUMP' },
      { name: 'swap', x: VIEW_W - 92, y: VIEW_H - 250, r: 38, label: 'SWAP' },
      { name: 'pause', x: VIEW_W / 2, y: 34, r: 24, label: 'II' },
    ];
    this.buttons = def.map((d) => {
      const gfx = scene.add.graphics();
      const t = scene.add
        .text(d.x, d.y, d.label, { fontFamily: FONT_DISPLAY, fontSize: d.r > 30 ? '18px' : '16px', color: '#ffffff' })
        .setOrigin(0.5)
        .setAlpha(0.9);
      this.root.add([gfx, t]);
      return { ...d, gfx, pointer: null };
    });
    this.drawStick(0, 0);
    this.drawButtons();

    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('pointerupoutside', this.onUp, this);
    this.setVisible(false);
  }

  setVisible(v: boolean): void {
    if (v === this.visible) return;
    this.visible = v;
    this.root.setVisible(v);
    if (!v) this.release();
  }

  private release(): void {
    const t = services.input.touch;
    t.left = t.right = t.up = t.down = t.fire = t.jump = false;
    services.input.stickX = services.input.stickY = 0;
    this.stickPointer = null;
    this.buttons.forEach((b) => (b.pointer = null));
    this.drawStick(0, 0);
    this.drawButtons();
  }

  private hit(p: Phaser.Input.Pointer): Button | undefined {
    return this.buttons.find((b) => Phaser.Math.Distance.Between(p.x, p.y, b.x, b.y) <= b.r + 14);
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (p.wasTouch) services.touchSeen = true;
    if (!this.visible) return;
    services.sfx.unlock();
    const t = services.input.touch;
    services.input.last = 'touch';
    const b = this.hit(p);
    if (b) {
      b.pointer = p.id;
      if (b.name === 'fire') t.fire = true;
      if (b.name === 'jump') {
        t.jump = true;
        t.jumpPressed++;
      }
      if (b.name === 'swap') t.swapPressed++;
      if (b.name === 'pause') t.pausePressed++;
      this.drawButtons();
      return;
    }
    if (p.x < VIEW_W * 0.5 && this.stickPointer === null) {
      this.stickPointer = p.id;
      this.stickOrigin.set(p.x, p.y);
      this.updateStick(p);
    }
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (this.visible && p.id === this.stickPointer) this.updateStick(p);
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (!this.visible) return;
    const t = services.input.touch;
    if (p.id === this.stickPointer) {
      this.stickPointer = null;
      t.left = t.right = t.up = t.down = false;
      services.input.stickX = services.input.stickY = 0;
      this.drawStick(0, 0);
    }
    for (const b of this.buttons) {
      if (b.pointer !== p.id) continue;
      b.pointer = null;
      if (b.name === 'fire') t.fire = false;
      if (b.name === 'jump') t.jump = false;
    }
    this.drawButtons();
  }

  private updateStick(p: Phaser.Input.Pointer): void {
    let dx = p.x - this.stickOrigin.x;
    let dy = p.y - this.stickOrigin.y;
    const len = Math.hypot(dx, dy);
    if (len > STICK_R) {
      dx = (dx / len) * STICK_R;
      dy = (dy / len) * STICK_R;
    }
    const nx = dx / STICK_R;
    const ny = dy / STICK_R;
    services.input.stickX = nx;
    services.input.stickY = ny;
    const d = snap8(nx, ny, 0.3);
    const t = services.input.touch;
    t.left = d?.x === -1;
    t.right = d?.x === 1;
    t.up = d?.y === -1;
    t.down = d?.y === 1;
    this.drawStick(dx, dy);
  }

  private drawStick(dx: number, dy: number): void {
    const { x, y } = this.stickOrigin;
    const active = this.stickPointer !== null;
    this.stickBase.clear();
    this.stickBase.fillStyle(0x0d1712, active ? 0.45 : 0.3);
    this.stickBase.fillCircle(x, y, STICK_R + 8);
    this.stickBase.lineStyle(3, 0xff9a3c, active ? 0.9 : 0.5);
    this.stickBase.strokeCircle(x, y, STICK_R + 8);
    this.stickKnob.clear();
    this.stickKnob.fillStyle(0xffffff, active ? 0.85 : 0.5);
    this.stickKnob.fillCircle(x + dx, y + dy, 26);
  }

  private drawButtons(): void {
    for (const b of this.buttons) {
      const down = b.pointer !== null;
      b.gfx.clear();
      b.gfx.fillStyle(down ? 0xff8a2e : 0x0d1712, down ? 0.75 : 0.4);
      b.gfx.fillCircle(b.x, b.y, b.r);
      b.gfx.lineStyle(3, 0xff9a3c, down ? 1 : 0.7);
      b.gfx.strokeCircle(b.x, b.y, b.r);
    }
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.onDown, this);
    this.scene.input.off('pointermove', this.onMove, this);
    this.scene.input.off('pointerup', this.onUp, this);
    this.scene.input.off('pointerupoutside', this.onUp, this);
    this.root.destroy();
  }
}
