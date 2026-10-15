import Phaser from 'phaser';
import { CANVAS_W, SCENES } from '../config/constants';
import { Backdrop } from '../ui/Backdrop';
import { CSSC, PALETTE, metalFill, plate, txt } from '../ui/theme';
import { MenuList } from '../ui/MenuList';
import { formatTime } from '../systems/rank';
import { input } from '../systems/InputManager';
import type { ResultsData } from './StageScene';

/** Stage clear screen (basic UI-05): rank, time and the numbers playtests care about. */
export class ResultsScene extends Phaser.Scene {
  private menu!: MenuList;
  private results!: ResultsData;

  constructor() {
    super(SCENES.results);
  }

  init(data: ResultsData): void {
    this.results = data;
  }

  create(): void {
    const d = this.results;
    this.cameras.main.setBackgroundColor(PALETTE.ink);
    new Backdrop(this, { drift: 0.3, dim: 0.55 });
    const g = this.add.graphics();
    plate(g, CANVAS_W / 2 - 330, 34, 660, 74, { skew: 28, fill: PALETTE.ember, fillAlpha: 0.9 });
    const title = this.add
      .text(CANVAS_W / 2, 70, 'STAGE CLEAR', txt('display', 56, CSSC.bone))
      .setOrigin(0.5)
      .setStroke(CSSC.ink, 10);
    metalFill(title);
    this.add
      .text(
        CANVAS_W / 2,
        126,
        d.stageName.toUpperCase(),
        txt('hud', 24, CSSC.emberHi, { letterSpacing: 4 }),
      )
      .setOrigin(0.5);
    this.add
      .text(CANVAS_W / 2, 186, d.rank, txt('display', 88, CSSC.signal))
      .setOrigin(0.5)
      .setStroke(CSSC.ink, 12);

    const rows: [string, string][] = [
      [
        'TIME',
        formatTime(d.timeMs) +
          (d.newBest ? '  · NEW BEST' : `  · BEST ${formatTime(d.bestTimeMs)}`),
      ],
      [d.mode === 'relay' ? 'OPERATORS DOWN' : 'LIVES LOST', String(d.downs)],
      ...(d.mode === 'relay' ? ([['SWAPS', String(d.swaps)]] as [string, string][]) : []),
      ['CONTINUES', String(d.continues)],
      ['SECRETS', `${d.secrets ?? 0} / 1`],
    ];
    rows.forEach(([k, v], i) => {
      const y = 250 + i * 28;
      this.add
        .text(CANVAS_W / 2 - 20, y, k, txt('hud', 24, CSSC.muted, { letterSpacing: 2 }))
        .setOrigin(1, 0.5);
      this.add
        .text(CANVAS_W / 2 + 20, y, v, txt('hud', 26, CSSC.bone, { letterSpacing: 1 }))
        .setOrigin(0, 0.5);
    });

    input.flush();
    this.menu = new MenuList(
      this,
      [
        {
          label: () => 'Play again',
          action: () => this.scene.start(SCENES.stage, { mode: d.mode, squad: d.squad }),
        },
        {
          label: () => 'Change squad',
          action: () => this.scene.start(SCENES.squad, { mode: d.mode }),
        },
        { label: () => 'Menu', action: () => this.scene.start(SCENES.menu, { skipAttract: true }) },
      ],
      CANVAS_W / 2,
      250 + rows.length * 28 + 6,
      { spacing: 42, fontSize: 18, align: 'center', width: 300, height: 34 },
    );
  }

  override update(): void {
    this.menu.update();
  }
}
