import Phaser from 'phaser';
import { FONT, FONT_DISPLAY, VIEW_H, VIEW_W } from '../config/constants';
import { rankFor, rankScore } from '../systems/rank';
import { services } from '../systems/services';
import { MenuList } from '../ui/MenuList';
import { formatTime } from '../ui/hudState';
import type { ResultsData } from './StageScene';

const RANK_COLOR: Record<string, string> = { S: '#ffd84a', A: '#9be03c', B: '#8fd0ff', C: '#e8e2d4' };

export class ResultsScene extends Phaser.Scene {
  private menu!: MenuList;
  private r!: ResultsData;

  constructor() {
    super('Results');
  }

  init(data: ResultsData): void {
    this.r = data;
  }

  create(): void {
    const r = this.r;
    this.add.image(0, 0, 'sky').setOrigin(0);
    this.add.tileSprite(0, -30, VIEW_W, 540, 'far').setOrigin(0).setTilePosition(200, 0);
    this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x0b120e, 0.62).setOrigin(0);
    const title = r.cleared ? 'MISSION COMPLETE' : 'MISSION FAILED';
    this.add
      .text(VIEW_W / 2, 60, title, { fontFamily: FONT_DISPLAY, fontSize: '50px', color: r.cleared ? '#9be03c' : '#ff7a2e' })
      .setOrigin(0.5)
      .setStroke('#1b1a17', 8);
    this.add
      .text(VIEW_W / 2, 104, `${r.stageName} · ${r.mode === 'solo' ? 'Solo' : 'Relay'}`, { fontFamily: FONT, fontSize: '18px', color: '#e8f3df' })
      .setOrigin(0.5);

    if (r.cleared) {
      const rank = rankFor(r.stats);
      const rankText = this.add
        .text(250, 270, rank, { fontFamily: FONT_DISPLAY, fontSize: '170px', color: RANK_COLOR[rank] })
        .setOrigin(0.5)
        .setStroke('#1b1a17', 12)
        .setScale(2.4)
        .setAlpha(0);
      this.tweens.add({ targets: rankText, scale: 1, alpha: 1, duration: 380, ease: 'Back.easeOut', delay: 250 });
      this.add.text(250, 380, `RANK · ${rankScore(r.stats)} pts`, { fontFamily: FONT_DISPLAY, fontSize: '20px', color: '#ffffff' }).setOrigin(0.5);
      const best = services.save.data.best[r.stageId];
      if (best) this.add.text(250, 408, `Best: ${best.rank} · ${formatTime(best.timeSec)}`, { fontFamily: FONT, fontSize: '15px', color: '#ffe2a8' }).setOrigin(0.5);
    }

    const s = r.stats;
    const rows: [string, string][] = [
      ['Time', `${formatTime(s.timeSec)}  (par ${formatTime(s.parSec)})`],
      ['Enemies', `${s.kills} / ${s.totalEnemies}`],
      ['Operators down', String(s.downs)],
      ['Relay swaps', String(r.swaps)],
      ['Continues', String(s.continues)],
      ['Score', String(r.score)],
    ];
    rows.forEach(([k, v], i) => {
      const y = 170 + i * 36;
      this.add.text(470, y, k, { fontFamily: FONT, fontSize: '20px', color: '#b9d6c3' });
      this.add.text(880, y, v, { fontFamily: FONT_DISPLAY, fontSize: '20px', color: '#ffffff' }).setOrigin(1, 0);
    });

    this.menu = new MenuList(this, 675, 432, [
      { label: () => 'PLAY AGAIN', action: () => this.again() },
      { label: () => 'MAIN MENU', action: () => this.scene.start('Menu') },
    ]);
    services.input.poll();
  }

  private again(): void {
    services.telemetry.log('replay', { stage: this.r.stageId });
    this.scene.start(this.r.stageId === 'stress' ? 'Stress' : 'Stage', { stage: this.r.stageId, mode: this.r.mode });
  }

  override update(): void {
    this.menu.update(services.input.poll());
  }
}
