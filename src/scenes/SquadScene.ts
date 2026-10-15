/**
 * Squad select: pick three of the four operators (one in solo mode). The order you pick them
 * is the relay order; the first is the lead who rides the rope down in the insertion.
 *
 * Keyboard/gamepad: left/right moves, Jump/Fire toggles, move onto DEPLOY (or press down) and
 * Jump to start; Esc/Start goes back. Touch: tap a card to toggle, tap DEPLOY.
 */
import Phaser from 'phaser';
import { CANVAS_H, CANVAS_W, SCENES } from '../config/constants';
import { OPERATORS, resolveSquad, type OperatorDef } from '../data/operators';
import { WEAPONS } from '../data/weapons';
import { Rig } from '../entities/Rig';
import { input } from '../systems/InputManager';
import { saves } from '../systems/services';
import { sfx } from '../systems/Sfx';
import { telemetry } from '../systems/Telemetry';
import type { SquadMode } from '../systems/Squad';
import { Backdrop } from '../ui/Backdrop';
import { CSSC, PALETTE, chevrons, css, plate, txt } from '../ui/theme';

const CARD_W = 206;
const CARD_H = 330;
const GAP = 14;
const TOP = 104;
const LEFT = (CANVAS_W - (CARD_W * 4 + GAP * 3)) / 2;

/** Stat ranges for the bars (min..max across the roster, with a little headroom). */
const STATS: Array<{ label: string; get: (o: OperatorDef) => number; lo: number; hi: number }> = [
  { label: 'SPEED', get: (o) => o.runSpeed, lo: 90, hi: 136 },
  { label: 'TOUGH', get: (o) => o.maxHp + o.maxArmour, lo: 2, hi: 6 },
  { label: 'SWIM', get: (o) => o.swim.speed, lo: 30, hi: 120 },
  { label: 'AIR', get: (o) => o.swim.oxygenMs, lo: 4000, hi: 30000 },
];

interface CardView {
  op: OperatorDef;
  x: number;
  rig: Rig;
  slot: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Zone;
}

export class SquadScene extends Phaser.Scene {
  private mode: SquadMode = 'relay';
  private picked: OperatorDef[] = [];
  private cursor = 0;
  private cards: CardView[] = [];
  private g!: Phaser.GameObjects.Graphics;
  private deployText!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private leaving = false;

  constructor() {
    super(SCENES.squad);
  }

  get need(): number {
    return this.mode === 'solo' ? 1 : 3;
  }

  create(data: { mode?: SquadMode } = {}): void {
    this.mode = data.mode ?? 'relay';
    this.leaving = false;
    this.cards = [];
    this.cameras.main.setBackgroundColor(PALETTE.ink);
    new Backdrop(this, { drift: 0.4, dim: 0.45 });
    const saved = saves.data.lastSquad;
    this.picked = resolveSquad(saved.length ? saved : undefined, this.need);

    this.add
      .text(LEFT, 36, 'ASSEMBLE THE RELAY', txt('display', 40, CSSC.bone))
      .setOrigin(0, 0.5)
      .setStroke(CSSC.ink, 8);
    this.add
      .text(
        LEFT + 4,
        72,
        this.mode === 'solo'
          ? 'SOLO RUN  ·  PICK ONE OPERATOR'
          : 'PICK THREE  ·  PICK ORDER = RELAY ORDER  ·  #1 LEADS THE INSERTION',
        txt('hud', 22, CSSC.emberHi, { letterSpacing: 3 }),
      )
      .setOrigin(0, 0.5);

    this.g = this.add.graphics().setDepth(1);
    OPERATORS.forEach((op, i) => {
      const x = LEFT + i * (CARD_W + GAP);
      const rig = new Rig(this, op.rig, op.weapons[0], 3, 4.4);
      this.add
        .text(x + 24, TOP + 162, op.name.toUpperCase(), txt('display', 26, CSSC.bone))
        .setOrigin(0, 0)
        .setDepth(3);
      this.add
        .text(
          x + 26,
          TOP + 194,
          op.role.toUpperCase(),
          txt('hud', 20, css(op.color), { letterSpacing: 3 }),
        )
        .setDepth(3);
      this.add
        .text(
          x + 26,
          TOP + 218,
          op.blurb,
          txt('body', 12, CSSC.muted, { wordWrap: { width: CARD_W - 44 } }),
        )
        .setDepth(3);
      STATS.forEach((s, k) => {
        this.add
          .text(x + 26, TOP + 250 + k * 15, s.label, txt('hud', 15, CSSC.dim, { letterSpacing: 2 }))
          .setDepth(3);
      });
      const weapons = op.weapons.map((w) => WEAPONS[w].short).join(' + ');
      this.add
        .text(x + 26, TOP + CARD_H - 22, weapons, txt('hud', 17, CSSC.bone, { letterSpacing: 2 }))
        .setDepth(3);
      const slot = this.add
        .text(x + CARD_W - 30, TOP + 26, '', txt('display', 34, CSSC.ink))
        .setOrigin(0.5)
        .setDepth(4);
      const zone = this.add
        .zone(x, TOP, CARD_W, CARD_H)
        .setOrigin(0)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => {
        sfx.unlock();
        this.cursor = i;
        this.toggle(op);
      });
      this.cards.push({ op, x, rig, slot, zone });
    });

    this.deployText = this.add
      .text(CANVAS_W - LEFT - 40, TOP + CARD_H + 48, 'DEPLOY', txt('display', 30, CSSC.bone))
      .setOrigin(1, 0.5)
      .setDepth(3);
    this.add
      .zone(CANVAS_W - LEFT - 250, TOP + CARD_H + 22, 250, 54)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        sfx.unlock();
        this.cursor = 4;
        this.deploy();
      });
    this.hint = this.add
      .text(LEFT, TOP + CARD_H + 48, '', txt('body', 13, CSSC.muted))
      .setOrigin(0, 0.5)
      .setDepth(3);

    input.flush();
    this.cameras.main.fadeIn(220, 7, 11, 17);
  }

  private toggle(op: OperatorDef): void {
    const i = this.picked.indexOf(op);
    if (i >= 0) this.picked.splice(i, 1);
    else if (this.picked.length < this.need) this.picked.push(op);
    else {
      // full: replace the last pick so a single tap always does something
      this.picked[this.picked.length - 1] = op;
    }
    sfx.ui();
    if (this.picked.length === this.need && i < 0) this.cursor = 4;
  }

  private deploy(): void {
    if (this.leaving) return;
    if (this.picked.length !== this.need) {
      sfx.dryFire();
      return;
    }
    this.leaving = true;
    const squad = this.picked.map((o) => o.id);
    if (this.mode === 'relay') saves.data.lastSquad = squad;
    void saves.save();
    telemetry.log('squad_selected', { squad: squad.join(','), mode: this.mode });
    sfx.clear();
    this.cameras.main.fadeOut(260, 7, 11, 17);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
      this.scene.start(SCENES.stage, { mode: this.mode, squad }),
    );
  }

  override update(_t: number, delta: number): void {
    input.update();
    const f = input.consume();
    if (!this.leaving) {
      if (f.leftPressed) this.cursor = this.cursor === 4 ? 3 : Math.max(0, this.cursor - 1);
      if (f.rightPressed) this.cursor = Math.min(4, this.cursor + 1);
      if (f.downPressed) this.cursor = 4;
      if (f.upPressed && this.cursor === 4) this.cursor = 3;
      if (f.leftPressed || f.rightPressed || f.downPressed || f.upPressed) sfx.ui();
      if (f.jumpPressed || f.firePressed || f.confirmPressed) {
        sfx.unlock();
        const card = this.cards[this.cursor];
        if (card) this.toggle(card.op);
        else this.deploy();
      }
      if (f.pausePressed || f.swapPressed) {
        this.leaving = true;
        this.scene.start(SCENES.menu, { skipAttract: true });
        return;
      }
    }
    this.draw(delta);
    if (window.__hotRelay)
      window.__hotRelay.state = {
        scene: 'squad',
        cursor: this.cursor,
        picked: this.picked.map((o) => o.id),
      };
  }

  private draw(delta: number): void {
    const g = this.g;
    g.clear();
    this.cards.forEach((c, i) => {
      const order = this.picked.indexOf(c.op);
      const on = order >= 0;
      const focus = this.cursor === i;
      plate(g, c.x, TOP, CARD_W, CARD_H, {
        skew: 22,
        fill: on ? PALETTE.gunmetal : PALETTE.navy,
        fillAlpha: on ? 0.95 : 0.8,
        stroke: focus ? PALETTE.ember : on ? c.op.color : PALETTE.steel,
        lineWidth: focus ? 4 : on ? 2.5 : 1.5,
      });
      // spotlight behind the operator
      g.fillStyle(c.op.color, on ? 0.22 : 0.08).fillEllipse(
        c.x + CARD_W / 2 + 8,
        TOP + 104,
        150,
        150,
      );
      g.fillStyle(0x000000, 0.4).fillEllipse(c.x + CARD_W / 2 + 8, TOP + 146, 90, 12);
      // stat bars
      STATS.forEach((s, k) => {
        const v = Phaser.Math.Clamp((s.get(c.op) - s.lo) / (s.hi - s.lo), 0.06, 1);
        const bx = c.x + 82;
        const by = TOP + 256 + k * 15;
        g.fillStyle(PALETTE.ink, 0.9).fillRect(bx, by, 100, 6);
        g.fillStyle(on ? c.op.color : PALETTE.steelHi, 1).fillRect(bx, by, 100 * v, 6);
      });
      if (on) plate(g, c.x + CARD_W - 54, TOP + 6, 46, 42, { skew: 10, fill: c.op.color });
      c.slot.setText(on ? String(order + 1) : '');
      c.rig.update(
        delta,
        {
          state: on ? 'idle' : 'idle',
          stateMs: 0,
          vx: 0,
          vy: 0,
          runSpeed: 100,
          aim: { x: 1, y: focus ? -0.25 : 0.05 },
          facing: 1,
          armReady: true,
          reload: null,
          swimDir: { x: 0, y: 0 },
        },
        c.x + CARD_W / 2 + 8,
        TOP + 148,
      );
      c.rig.setAlpha(on || focus ? 1 : 0.55);
    });
    const ready = this.picked.length === this.need;
    const focusDeploy = this.cursor === 4;
    plate(g, CANVAS_W - LEFT - 250, TOP + CARD_H + 22, 250, 54, {
      skew: 18,
      fill: ready ? PALETTE.ember : PALETTE.steel,
      fillAlpha: ready ? 1 : 0.6,
      stroke: focusDeploy ? PALETTE.bone : undefined,
      lineWidth: 3,
    });
    chevrons(
      g,
      CANVAS_W - LEFT - 222,
      TOP + CARD_H + 36,
      26,
      2,
      ready ? 1 : 0,
      PALETTE.ink,
      PALETTE.gunmetal,
    );
    this.deployText.setColor(ready ? CSSC.ink : CSSC.dim);
    this.hint.setText(
      ready
        ? `RELAY: ${this.picked.map((o) => o.name.toUpperCase()).join('  ›  ')}`
        : `Pick ${this.need - this.picked.length} more  ·  Jump/Fire or tap to pick  ·  Esc back`,
    );
    void CANVAS_H;
  }
}
