/**
 * TEST-01 / H10: 60 enemies and ~200 bullets on screen, frame rate measured for 10 s.
 * Open with ?stage=stress (or from the debug menu). Pass: median ≥ 55 fps, p10 ≥ 45 fps.
 */
import Phaser from 'phaser';
import {
  CANVAS_H,
  CANVAS_W,
  COLORS,
  CSS,
  DEPTH,
  FONT,
  SCENES,
  VIEW_H,
  VIEW_W,
  ZOOM,
} from '../config/constants';
import { TUNING } from '../config/tuning';
import { Rifleman } from '../entities/Rifleman';
import type { EnemyContext } from '../entities/Enemy';
import { BulletPool } from '../entities/BulletPool';
import { FixedStep } from '../systems/FixedStep';
import { FpsMeter } from '../systems/FpsMeter';
import { input } from '../systems/InputManager';
import { telemetry } from '../systems/Telemetry';
import { Effects } from '../stage/Effects';
import { FLAGS } from '../systems/flags';
import { playtest, saves } from '../systems/services';
import { currentDevice } from '../systems/playtest';
import { resolveDetail } from '../systems/detail';

const ENEMIES = 60;
const TARGET_BULLETS = 200;
const WARMUP_MS = 1500;
const MEASURE_MS = 10_000;

export class StressScene extends Phaser.Scene {
  private enemies: Rifleman[] = [];
  private pBullets!: BulletPool;
  private eBullets!: BulletPool;
  private telegraph!: Phaser.GameObjects.Graphics;
  private fixed = new FixedStep(TUNING.stepMs, TUNING.maxFrameMs);
  private meter = new FpsMeter(2000);
  private elapsed = 0;
  private target = { x: VIEW_W / 2, y: 200 };
  private label!: Phaser.GameObjects.Text;
  private done = false;
  private peakBullets = 0;
  private fx!: Effects;
  private detail: 'high' | 'low' = 'high';

  constructor() {
    super(SCENES.stress);
  }

  create(): void {
    this.enemies = [];
    this.elapsed = 0;
    this.done = false;
    this.meter.reset();
    this.physics.world.gravity.y = TUNING.gravity;
    this.physics.world.setBounds(0, 0, VIEW_W, VIEW_H);
    this.cameras.main
      .setZoom(ZOOM)
      .setBounds(0, 0, VIEW_W, VIEW_H)
      .centerOn(VIEW_W / 2, VIEW_H / 2);
    this.cameras.main.setBackgroundColor(COLORS.bg);

    const solids = this.physics.add.staticGroup();
    const shelf = (x: number, y: number, w: number, h: number) => {
      const r = this.add.rectangle(x + w / 2, y + h / 2, w, h, COLORS.solid).setDepth(DEPTH.level);
      this.physics.add.existing(r, true);
      solids.add(r);
    };
    shelf(0, 240, VIEW_W, 30);
    shelf(20, 190, VIEW_W - 40, 6);
    shelf(20, 140, VIEW_W - 40, 6);
    shelf(20, 90, VIEW_W - 40, 6);

    const rows = [240, 190, 140, 90];
    for (let i = 0; i < ENEMIES; i++) {
      const row = rows[i % rows.length] ?? 240;
      const x = 30 + ((i * 29) % (VIEW_W - 60));
      this.enemies.push(new Rifleman(this, x, row, undefined));
    }
    this.physics.add.collider(this.enemies, solids);
    // every rifleman is a full cut-out rig with a contact shadow, as in the stage
    this.fx = new Effects(this, [], []);
    // Low detail turns shadows off; Auto counts as high so the measurement is of one level.
    this.detail = resolveDetail(saves.data.settings.detail, FLAGS.detail, 'high');
    this.fx.shadows = this.detail === 'high';

    this.pBullets = new BulletPool(this, 'bullet-p', 120);
    this.eBullets = new BulletPool(this, 'bullet-e', 160);
    this.telegraph = this.add.graphics().setDepth(DEPTH.fx);

    this.label = this.add
      .text(8, 8, 'Stress test: warming up…', { fontFamily: FONT, fontSize: '9px', color: CSS.ui })
      .setDepth(100);
    input.flush();
  }

  override update(_t: number, delta: number): void {
    input.update();
    if (this.done) {
      const f = input.consume();
      if (f.jumpPressed || f.confirmPressed || f.pausePressed) this.scene.start(SCENES.menu);
      return;
    }
    this.elapsed += delta;
    if (this.elapsed > WARMUP_MS) this.meter.addFrame(delta);

    this.fixed.advance(delta, (dt) => {
      input.consume();
      // the "player" target sweeps across the room so riflemen keep re-aiming
      this.target.x = VIEW_W / 2 + Math.sin(this.elapsed / 900) * 180;
      this.telegraph.clear();
      const ctx: EnemyContext = {
        target: this.target,
        targetInWater: false,
        targetSubmerged: false,
        water: [],
        explode: () => {},
        view: new Phaser.Geom.Rectangle(0, 0, VIEW_W, VIEW_H),
        flashing: true,
        telegraph: this.telegraph,
        fireEnemyBullet: (x, y, dx, dy, speed) =>
          this.eBullets.fire({
            x,
            y,
            dirX: dx,
            dirY: dy,
            speed,
            damage: 1,
            pierce: 1,
            lifeMs: 2400,
          }),
        onEngage: () => {},
      };
      for (const e of this.enemies) e.step(dt, ctx);
      // keep the total near TARGET_BULLETS with player-style spray from the centre
      const missing = TARGET_BULLETS - this.pBullets.countActive() - this.eBullets.countActive();
      for (let i = 0; i < Math.min(6, missing); i++) {
        const a = Math.random() * Math.PI * 2;
        this.pBullets.fire({
          x: this.target.x,
          y: 160,
          dirX: Math.cos(a),
          dirY: Math.sin(a),
          speed: 180,
          damage: 1,
          pierce: 1,
          lifeMs: 1600,
        });
      }
      this.physics.world.update(this.time.now, dt);
      this.physics.world.postUpdate();
      const view = new Phaser.Geom.Rectangle(0, 0, VIEW_W, VIEW_H);
      this.pBullets.step(dt, view);
      this.eBullets.step(dt, view);
    });

    for (const e of this.enemies) e.syncVisual(delta, { platforms: [], water: [], fx: this.fx });
    this.fx.update(delta);
    const live = this.pBullets.countActive() + this.eBullets.countActive();
    this.peakBullets = Math.max(this.peakBullets, live);
    const s = this.meter.summary();
    this.label.setText(
      `Stress: ${ENEMIES} enemies · ${live} bullets · ${s.p50} fps median · ${s.p10} fps p10`,
    );

    if (this.elapsed >= WARMUP_MS + MEASURE_MS) this.finish();
  }

  private finish(): void {
    this.done = true;
    const s = this.meter.summary();
    const pass = s.p50 >= 55 && s.p10 >= 45;
    telemetry.log('stress_result', {
      ...s,
      enemies: ENEMIES,
      peakBullets: this.peakBullets,
      pass,
      ...telemetry.context(),
    });
    if (window.__hotRelay) window.__hotRelay.stress = { ...s, detail: this.detail };
    // kept in the playtest log so phone results come back in the exported file (ANALYTICS-04)
    void playtest.addStress({
      id: `${telemetry.sessionId}-stress-${Date.now().toString(36)}`,
      at: new Date().toISOString(),
      build: __BUILD__,
      p50: s.p50,
      p10: s.p10,
      frames: s.frames,
      detail: this.detail,
      device: currentDevice(telemetry.context().standalone === true),
    });
    const overlay = this.add
      .rectangle(CANVAS_W, CANVAS_H, CANVAS_W * 2, CANVAS_H * 2, 0x0e1116, 0.85)
      .setDepth(200);
    overlay.setScrollFactor(0);
    this.add
      .text(VIEW_W / 2, VIEW_H / 2 - 20, `${pass ? 'PASS' : 'BELOW TARGET'}`, {
        fontFamily: FONT,
        fontSize: '22px',
        color: pass ? CSS.good : CSS.danger,
        fontStyle: '800',
      })
      .setOrigin(0.5)
      .setDepth(201);
    this.add
      .text(
        VIEW_W / 2,
        VIEW_H / 2 + 14,
        `median ${s.p50} fps · slowest 10% ${s.p10} fps · peak ${this.peakBullets} bullets\nTarget: median ≥ 55, p10 ≥ 45 · Jump or tap to return`,
        { fontFamily: FONT, fontSize: '9px', color: CSS.ui, align: 'center' },
      )
      .setOrigin(0.5)
      .setDepth(201);
    this.input.once('pointerdown', () => this.scene.start(SCENES.menu));
  }
}
