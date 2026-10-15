/**
 * Title screen. Attract state (logo slam, squad lineup, PRESS START) → main menu → settings.
 * Composition is deliberately asymmetric: identity and menu on the left, the squad on the right.
 */
import Phaser from 'phaser';
import { CANVAS_H, CANVAS_W, SCENES } from '../config/constants';
import { MenuList } from '../ui/MenuList';
import { FLAGS } from '../systems/flags';
import { input } from '../systems/InputManager';
import { saves } from '../systems/services';
import { sfx } from '../systems/Sfx';
import { settingsItems } from '../ui/settingsItems';
import { formatTime } from '../systems/rank';
import { GREYBOX_01 } from '../data/stages/greybox01';
import { OPERATORS } from '../data/operators';
import { Rig } from '../entities/Rig';
import { Backdrop } from '../ui/Backdrop';
import { CSSC, PALETTE, css, metalFill, plate, txt } from '../ui/theme';
import type { SquadMode } from '../systems/Squad';

const LEFT = 64;

export class MenuScene extends Phaser.Scene {
  private menu: MenuList | null = null;
  private mode: SquadMode = FLAGS.mode;
  private view: 'attract' | 'main' | 'settings' = 'attract';
  private pressStart!: Phaser.GameObjects.Text;
  private pressStartPlate!: Phaser.GameObjects.Graphics;
  private panelTitle!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private rigs: { rig: Rig; x: number; y: number; facing: 1 | -1; t: number }[] = [];

  constructor() {
    super(SCENES.menu);
  }

  create(data: { skipAttract?: boolean } = {}): void {
    this.menu = null;
    this.rigs = [];
    this.cameras.main.setBackgroundColor(PALETTE.ink);
    new Backdrop(this);

    this.buildLogo();
    this.buildLineup();

    this.pressStartPlate = this.add.graphics();
    plate(this.pressStartPlate, LEFT - 20, 302, 300, 54, {
      skew: 18,
      fill: PALETTE.ink,
      fillAlpha: 0.75,
    });
    this.pressStart = this.add
      .text(LEFT + 14, 330, 'PRESS START', txt('hud', 40, CSSC.bone, { letterSpacing: 6 }))
      .setOrigin(0, 0.5);
    this.tweens.add({
      targets: this.pressStart,
      alpha: 0.15,
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: 'Stepped',
    });

    this.panelTitle = this.add
      .text(LEFT + 4, 250, '', txt('hud', 22, CSSC.ember, { letterSpacing: 4 }))
      .setOrigin(0, 0.5);
    this.hint = this.add
      .text(LEFT + 4, 410, '', txt('body', 13, CSSC.muted, { lineSpacing: 6 }))
      .setOrigin(0, 0);

    // footer
    const best = saves.data.bestByStage[GREYBOX_01.id];
    this.add
      .text(
        LEFT,
        CANVAS_H - 22,
        'PROTOTYPE  ·  VERTICAL SLICE  ·  PLACEHOLDER ART',
        txt('hud', 18, CSSC.dim, { letterSpacing: 2 }),
      )
      .setOrigin(0, 0.5);
    if (best) {
      this.add
        .text(
          CANVAS_W - 28,
          CANVAS_H - 22,
          `BEST  ${best.rank}  ·  ${formatTime(best.timeMs)}`,
          txt('hud', 22, CSSC.emberHi, { letterSpacing: 2 }),
        )
        .setOrigin(1, 0.5);
    }

    input.flush();
    if (data.skipAttract || FLAGS.debug) this.showMain();
    else this.input.once('pointerdown', () => this.view === 'attract' && this.showMain());
  }

  private buildLogo(): void {
    const g = this.add.graphics();
    // ember slash behind the wordmark
    plate(g, LEFT - 90, 92, 560, 92, { skew: 40, fill: PALETTE.ember, fillAlpha: 0.9 });
    plate(g, LEFT - 90, 184, 520, 8, { skew: 4, fill: PALETTE.signal });
    g.setAlpha(0);

    const eyebrow = this.add
      .text(
        LEFT + 2,
        72,
        'RELAY TEAM  ·  RAPID RESPONSE',
        txt('hud', 22, CSSC.emberHi, { letterSpacing: 5 }),
      )
      .setOrigin(0, 0.5)
      .setAlpha(0);

    const logo = this.add
      .text(LEFT, 138, 'HOT RELAY', txt('display', 96, CSSC.bone))
      .setOrigin(0, 0.5)
      .setStroke(CSSC.ink, 12)
      .setShadow(6, 6, '#070b11', 0, true, true);
    metalFill(logo);

    const tagline = this.add
      .text(
        LEFT + 4,
        212,
        'FOUR OPERATORS  ·  PICK THREE  ·  ONE RELAY',
        txt('hud', 26, CSSC.bone, { letterSpacing: 3 }),
      )
      .setOrigin(0, 0.5)
      .setAlpha(0);

    // slam
    logo.setScale(1.7).setAlpha(0);
    this.tweens.add({
      targets: logo,
      scale: 1,
      alpha: 1,
      duration: 260,
      delay: 150,
      ease: 'Back.easeOut',
      onComplete: () => {
        if (saves.data.settings.screenShake) this.cameras.main.shake(140, 0.006);
        if (saves.data.settings.flashing) this.cameras.main.flash(120, 255, 170, 90);
        this.tweens.add({ targets: [g, eyebrow, tagline], alpha: 1, duration: 260 });
      },
    });
  }

  private buildLineup(): void {
    const baseY = 452;
    const spots = [
      { x: 600, scale: 5, delay: 0, facing: 1 as const },
      { x: 700, scale: 5.6, delay: 120, facing: 1 as const },
      { x: 800, scale: 5.6, delay: 240, facing: -1 as const },
      { x: 895, scale: 5, delay: 360, facing: -1 as const },
    ];
    OPERATORS.forEach((op, i) => {
      const spot = spots[i];
      if (!spot) return;
      const rim = this.add
        .image(spot.x, baseY - 60, 'glow')
        .setScale(2.6, 4.5)
        .setTint(op.color)
        .setAlpha(0.35)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.add.ellipse(spot.x, baseY + 2, 64, 10, 0x000000, 0.45);
      const rig = new Rig(this, op.rig, op.weapons[0], 2, spot.scale);
      rig.setAlpha(0);
      const name = this.add
        .text(spot.x, baseY + 22, op.name.toUpperCase(), txt('display', 18, CSSC.bone))
        .setOrigin(0.5, 0.5);
      const role = this.add
        .text(
          spot.x,
          baseY + 42,
          op.role.toUpperCase(),
          txt('hud', 17, css(op.color), { letterSpacing: 3 }),
        )
        .setOrigin(0.5, 0.5);
      for (const o of [rim, name, role]) o.setAlpha(0);
      const entry = { rig, x: spot.x, y: baseY + 30, facing: spot.facing, t: 0 };
      this.rigs.push(entry);
      this.tweens.add({
        targets: entry,
        y: baseY,
        duration: 380,
        delay: 500 + spot.delay,
        ease: 'Cubic.easeOut',
      });
      this.tweens.add({ targets: rig.root, alpha: 1, duration: 380, delay: 500 + spot.delay });
      this.tweens.add({
        targets: [rim, name, role],
        alpha: { from: 0, to: 1 },
        duration: 380,
        delay: 650 + spot.delay,
      });
      this.tweens.add({
        targets: rim,
        alpha: 0.2,
        duration: 1400,
        yoyo: true,
        repeat: -1,
        delay: 1100 + spot.delay,
      });
    });
  }

  /** Idle the lineup: breathing, weapons at port arms with a slow drift. */
  private updateLineup(delta: number): void {
    for (const r of this.rigs) {
      r.t += delta;
      // weapons held at port arms (angled up) so the lineup's guns never cross
      const sway = Math.sin(r.t / 900 + r.x) * 0.08;
      r.rig.update(
        delta,
        {
          state: 'idle',
          stateMs: r.t,
          vx: 0,
          vy: 0,
          runSpeed: 100,
          aim: { x: r.facing * (0.42 + sway), y: -0.9 },
          facing: r.facing,
          armReady: true,
          reload: null,
          swimDir: { x: 0, y: 0 },
        },
        r.x,
        r.y,
      );
    }
  }

  private showMain(): void {
    sfx.unlock();
    this.view = 'main';
    this.pressStart.setVisible(false);
    this.pressStartPlate.setVisible(false);
    this.menu?.destroy();
    this.panelTitle.setText('MAIN MENU');
    const items = [
      { label: () => 'Deploy', action: () => this.play() },
      { label: () => 'Settings', action: () => this.showSettings() },
    ];
    if (FLAGS.debug) {
      items.push({
        label: () => `Mode: ${this.mode === 'relay' ? 'Relay' : 'Solo'}`,
        action: () => {
          this.mode = this.mode === 'relay' ? 'solo' : 'relay';
        },
      });
      items.push({ label: () => 'Stress test', action: () => this.scene.start(SCENES.stress) });
    }
    this.menu = new MenuList(this, items, LEFT + 34, 276, {
      width: 330,
      height: 44,
      spacing: 54,
      fontSize: 20,
    });
    this.hint.setText(
      'MOVE  arrows / WASD     JUMP / SWIM UP  Z / Space     FIRE  X / J\nRELAY SWAP  C / Shift     WEAPON  Q     RELOAD  R     PAUSE  Esc\nGamepad and touch supported',
    );
  }

  private showSettings(): void {
    this.view = 'settings';
    this.menu?.destroy();
    this.panelTitle.setText('SETTINGS');
    this.menu = new MenuList(
      this,
      [...settingsItems(), { label: () => 'Back', action: () => this.showMain() }],
      LEFT + 34,
      270,
      {
        width: 400,
        height: 26,
        spacing: 30,
        fontSize: 14,
      },
    );
    this.hint.setText('');
  }

  private play(): void {
    sfx.clear();
    if (saves.data.settings.flashing) this.cameras.main.flash(160, 255, 140, 60);
    this.menu?.setEnabled(false);
    this.cameras.main.fadeOut(260, 7, 11, 17);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
      this.scene.start(SCENES.squad, { mode: this.mode }),
    );
  }

  override update(_t: number, delta: number): void {
    this.updateLineup(delta);
    if (window.__hotRelay) window.__hotRelay.state = { scene: 'menu', view: this.view };
    if (this.view === 'attract') {
      input.update();
      const f = input.consume();
      const held = input.peekHeld();
      if (
        f.jumpPressed ||
        f.confirmPressed ||
        f.pausePressed ||
        f.firePressed ||
        f.swapPressed ||
        held.fire
      )
        this.showMain();
      return;
    }
    this.menu?.update();
    if (this.view === 'settings' && this.menu?.lastFrame?.pausePressed) this.showMain();
  }
}
