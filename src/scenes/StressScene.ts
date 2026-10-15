import Phaser from 'phaser';
import { FONT, VIEW_W } from '../config/constants';
import { services } from '../systems/services';
import { StageScene } from './StageScene';

const WARMUP = 2;
const MEASURE = 10;

/**
 * TEST-01 / H10: 60 riflemen, ~200 bullets. The player cannot be hurt; fps is sampled for
 * 10 s after a 2 s warm-up and reported on screen and in `window.__hotRelay.stress`.
 */
export class StressScene extends StageScene {
  private elapsed = 0;
  private label!: Phaser.GameObjects.Text;
  private peakBullets = 0;
  private done = false;

  constructor() {
    super('Stress');
  }

  override init(): void {
    super.init({ stage: 'stress', mode: 'relay' });
    this.elapsed = 0;
    this.peakBullets = 0;
    this.done = false;
  }

  override create(): void {
    super.create();
    this.player.god = true;
    this.label = this.add
      .text(VIEW_W / 2, 80, 'Warming up…', { fontFamily: FONT, fontSize: '20px', color: '#ffffff', backgroundColor: '#0d1712cc', padding: { x: 10, y: 6 } })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(300);
  }

  override update(time: number, delta: number): void {
    super.update(time, delta);
    if (this.done) return;
    this.elapsed += delta / 1000;
    this.peakBullets = Math.max(this.peakBullets, this.enemyBulletCount);
    if (this.elapsed < WARMUP) {
      services.fps.reset();
      return;
    }
    const t = this.elapsed - WARMUP;
    const fps = services.fps;
    this.label.setText(
      `Measuring ${t.toFixed(1)}/${MEASURE}s · enemies ${this.enemies.length} · bullets ${this.enemyBulletCount} · p50 ${fps.p50.toFixed(0)} fps`,
    );
    if (t >= MEASURE) {
      this.done = true;
      const result = { p50: Math.round(fps.p50), p10: Math.round(fps.p10), samples: fps.count, peakBullets: this.peakBullets, enemies: this.enemies.length };
      const pass = result.p50 >= 55 && result.p10 >= 45;
      this.label.setText(`STRESS RESULT  median ${result.p50} fps · p10 ${result.p10} fps · peak bullets ${result.peakBullets} · ${pass ? 'PASS' : 'FAIL'} (H10: ≥55 / ≥45)`);
      this.label.setColor(pass ? '#9be03c' : '#ff7a2e');
      services.telemetry.log('stress', result);
      const w = window as unknown as { __hotRelay: Record<string, unknown> };
      w.__hotRelay.stress = result;
    }
  }
}
