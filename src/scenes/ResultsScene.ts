import Phaser from 'phaser';
import { CANVAS_W, SCENES } from '../config/constants';
import { Backdrop } from '../ui/Backdrop';
import { CSSC, PALETTE, metalFill, plate, txt } from '../ui/theme';
import { MenuList } from '../ui/MenuList';
import { formatTime } from '../systems/rank';
import { input } from '../systems/InputManager';
import type { ResultsData } from './StageScene';
import { playtest } from '../systems/services';
import { SURVEY_QUESTIONS, type Again } from '../systems/playtest';

/**
 * Stage clear screen (basic UI-05): rank, time and the numbers playtests care about.
 * In playtest mode a 3-question survey comes first (ANALYTICS-03).
 */
export class ResultsScene extends Phaser.Scene {
  private menu!: MenuList;
  private results!: ResultsData;
  private menuY = 0;
  private survey: { fun: number | null; controls: number | null; again: Again | null } = {
    fun: null,
    controls: null,
    again: null,
  };
  private surveyParts: Phaser.GameObjects.GameObject[] = [];
  private surveyNote!: Phaser.GameObjects.Text;

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
    this.menuY = 250 + rows.length * 28 + 6;
    this.survey = { fun: null, controls: null, again: null };
    const survey = playtest.enabled && !!d.runId;
    if (survey) this.showSurvey(d.runId!);
    else this.showMenu();
    // lets the smoke test wait for this screen instead of guessing a delay
    if (window.__hotRelay) window.__hotRelay.state = { scene: 'results', survey };
  }

  private showMenu(): void {
    const d = this.results;
    this.menu = new MenuList(
      this,
      [
        {
          label: () => 'Play again',
          action: () => this.scene.start(SCENES.stage, { mode: d.mode, squad: d.squad, replay: true }),
        },
        {
          label: () => 'Change squad',
          action: () => this.scene.start(SCENES.squad, { mode: d.mode }),
        },
        { label: () => 'Menu', action: () => this.scene.start(SCENES.menu, { skipAttract: true }) },
      ],
      CANVAS_W / 2,
      this.menuY,
      { spacing: 42, fontSize: 18, align: 'center', width: 300, height: 34 },
    );
  }

  /** Three quick questions over the results; answers go into this run's playtest record. */
  private showSurvey(runId: string): void {
    const s = this.survey;
    const score = (v: number | null) => (v === null ? '–' : String(v));
    const step = (v: number | null, dir: 1 | -1) => (v === null ? (dir > 0 ? 1 : 5) : ((v - 1 + dir + 5) % 5) + 1);
    const AGAIN: Again[] = ['yes', 'maybe', 'no'];
    const shade = this.add.rectangle(0, 0, CANVAS_W, 540, PALETTE.ink, 0.82).setOrigin(0);
    const g = this.add.graphics();
    plate(g, CANVAS_W / 2 - 320, 92, 640, 360, { skew: 20, fill: PALETTE.navy, fillAlpha: 0.96 });
    const title = this.add
      .text(CANVAS_W / 2, 126, 'QUICK SURVEY', txt('display', 34, CSSC.emberHi))
      .setOrigin(0.5)
      .setStroke(CSSC.ink, 6);
    const sub = this.add
      .text(CANVAS_W / 2, 160, 'Three taps — it helps tune the game. 1 = not at all, 5 = very.', txt('body', 14, CSSC.muted))
      .setOrigin(0.5);
    this.surveyNote = this.add.text(CANVAS_W / 2, 430, '', txt('hud', 20, CSSC.signal)).setOrigin(0.5);
    this.surveyParts = [shade, g, title, sub, this.surveyNote];
    this.menu = new MenuList(
      this,
      [
        { label: () => `${SURVEY_QUESTIONS.fun}: ${score(s.fun)}`, adjust: (dir) => (s.fun = step(s.fun, dir)) },
        {
          label: () => `${SURVEY_QUESTIONS.controls}: ${score(s.controls)}`,
          adjust: (dir) => (s.controls = step(s.controls, dir)),
        },
        {
          label: () => `${SURVEY_QUESTIONS.again}: ${s.again ? s.again[0]!.toUpperCase() + s.again.slice(1) : '–'}`,
          adjust: (dir) => {
            const i = s.again === null ? (dir > 0 ? -1 : AGAIN.length) : AGAIN.indexOf(s.again);
            s.again = AGAIN[(i + dir + AGAIN.length) % AGAIN.length]!;
          },
        },
        { label: () => 'Send answers', action: () => this.finishSurvey(runId, true) },
        { label: () => 'Skip', action: () => this.finishSurvey(runId, false) },
      ],
      CANVAS_W / 2,
      206,
      { spacing: 44, fontSize: 17, align: 'center', width: 560, height: 34 },
    );
  }

  private finishSurvey(runId: string, send: boolean): void {
    const s = this.survey;
    if (send) {
      if (s.fun === null || s.controls === null || s.again === null) {
        this.surveyNote.setText('Answer all three, or choose Skip');
        return;
      }
      void playtest.setSurvey(runId, { fun: s.fun, controls: s.controls, again: s.again });
    }
    this.menu.destroy();
    this.surveyParts.forEach((o) => o.destroy());
    this.surveyParts = [];
    input.flush();
    this.showMenu();
  }

  override update(): void {
    this.menu.update();
  }
}
