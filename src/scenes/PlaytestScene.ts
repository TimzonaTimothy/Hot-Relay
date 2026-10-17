import Phaser from 'phaser';
import { CANVAS_W, SCENES } from '../config/constants';
import { Backdrop } from '../ui/Backdrop';
import { CSSC, PALETTE, plate, txt } from '../ui/theme';
import { MenuList } from '../ui/MenuList';
import { input } from '../systems/InputManager';
import { playtest } from '../systems/services';
import type { GroupStats, PlaytestSummary } from '../systems/playtest';

/**
 * Playtest data (ANALYTICS-03): the Gate 4 numbers recorded on this device, and an export a
 * tester sends back to the owner (copy to the clipboard or save a .json file). No backend.
 */
export class PlaytestScene extends Phaser.Scene {
  private menu!: MenuList;
  private status!: Phaser.GameObjects.Text;
  private body!: Phaser.GameObjects.Text;
  private confirmClear = false;

  constructor() {
    super(SCENES.playtest);
  }

  create(): void {
    this.confirmClear = false;
    this.cameras.main.setBackgroundColor(PALETTE.ink);
    new Backdrop(this, { drift: 0.2, dim: 0.7 });
    const g = this.add.graphics();
    plate(g, CANVAS_W / 2 - 300, 26, 600, 56, { skew: 22, fill: PALETTE.ember, fillAlpha: 0.9 });
    this.add
      .text(CANVAS_W / 2, 54, 'PLAYTEST DATA', txt('display', 40, CSSC.bone))
      .setOrigin(0.5)
      .setStroke(CSSC.ink, 8);
    this.body = this.add
      .text(60, 104, '', txt('body', 15, CSSC.bone, { lineSpacing: 5, wordWrap: { width: 540 } }))
      .setOrigin(0, 0);
    this.status = this.add
      .text(CANVAS_W / 2, 505, '', txt('hud', 22, CSSC.ok, { letterSpacing: 1 }))
      .setOrigin(0.5);
    this.refresh();

    input.flush();
    this.menu = new MenuList(
      this,
      [
        { label: () => 'Copy results', action: () => void this.copy() },
        { label: () => 'Download file', action: () => this.download() },
        {
          label: () => (this.confirmClear ? 'Clear data: press again' : 'Clear data'),
          action: () => void this.clear(),
        },
        { label: () => 'Back', action: () => this.scene.start(SCENES.menu, { skipAttract: true }) },
      ],
      CANVAS_W - 180,
      300,
      { spacing: 44, fontSize: 18, align: 'center', width: 280, height: 34 },
    );
  }

  private refresh(): void {
    this.body.setText(describe(playtest.summary()));
  }

  private async copy(): Promise<void> {
    const json = playtest.exportJson();
    let ok: boolean;
    try {
      await navigator.clipboard.writeText(json);
      ok = true;
    } catch {
      // older browsers / insecure origins: select a hidden textarea and copy
      const ta = document.createElement('textarea');
      ta.value = json;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      ok = document.execCommand('copy');
      ta.remove();
    }
    this.say(ok ? 'Copied: paste it into a message to the team' : 'Copy failed: use Download file', ok);
  }

  private download(): void {
    const blob = new Blob([playtest.exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    a.href = url;
    a.download = `hot-relay-playtest-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    this.say(`Saved ${a.download}`, true);
  }

  private async clear(): Promise<void> {
    if (!this.confirmClear) {
      this.confirmClear = true;
      this.say('This deletes every recorded run on this device', false);
      return;
    }
    this.confirmClear = false;
    await playtest.clear();
    this.refresh();
    this.say('Playtest data cleared', true);
  }

  private say(msg: string, ok: boolean): void {
    this.status.setText(msg).setColor(ok ? CSSC.ok : CSSC.signal);
  }

  override update(): void {
    this.menu.update();
    if (this.menu.lastFrame?.pausePressed) this.scene.start(SCENES.menu, { skipAttract: true });
  }
}

const pct = (x: number | null) => (x === null ? '–' : `${Math.round(x * 100)}%`);
const num = (x: number | null, unit = '') => (x === null ? '–' : `${x}${unit}`);
const grp = (g: GroupStats) => `${g.clears}/${g.runs} cleared (${pct(g.clearRate)})`;

/** Plain-language summary of the numbers each Gate 4 test looks at. */
export function describe(s: PlaytestSummary): string {
  if (s.runs === 0) return 'No runs recorded on this device yet.\nPlay a stage, then come back here to export the results.';
  const sec = s.downsBySection.map((n, i) => `${i === 0 ? 'start' : `CP${i}`} ${n}`).join(' · ');
  return [
    `Runs ${s.runs} · sessions ${s.sessions} · replays ${s.replays}`,
    `Sessions with 3+ min of play: ${s.sessionsOver3Min}/${s.sessions} (${pct(s.shareOver3Min)})`,
    `Median time to first fight: ${s.medianFirstFightMs === null ? '–' : `${(s.medianFirstFightMs / 1000).toFixed(1)} s`}`,
    '',
    'H2  relay vs solo',
    `  Relay ${grp(s.byMode.relay)} · swaps/min ${num(s.byMode.relay.medianSwapsPerMin)}`,
    `  Solo  ${grp(s.byMode.solo)}`,
    'H4  completion by control',
    `  Keyboard ${grp(s.byInput.keyboard)}`,
    `  Touch    ${grp(s.byInput.touch)}`,
    `  Gamepad  ${grp(s.byInput.gamepad)}`,
    '',
    `Operators down by section: ${sec}`,
    `Survey ${s.survey.answered} answered · fun ${num(s.survey.fun, '/5')} · controls ${num(s.survey.controls, '/5')}`,
    `  Play another stage: yes ${s.survey.again.yes} · maybe ${s.survey.again.maybe} · no ${s.survey.again.no}`,
  ].join('\n');
}
