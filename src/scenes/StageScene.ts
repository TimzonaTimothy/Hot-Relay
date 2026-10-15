import Phaser from 'phaser';
import { DEPTH, FONT_DISPLAY, STEP_MS, VIEW_H, VIEW_W } from '../config/constants';
import { TUNING } from '../config/tuning';
import { paintBlock, paintFern, paintPalmProp, paintPillar } from '../art/environment';
import { OPERATORS, SQUAD_ORDER, type OperatorId } from '../data/operators';
import { STAGES } from '../data/stages';
import type { Arena, EnemySpawn, Rect, StageDef } from '../data/stages/types';
import { Bullet, BulletPool } from '../entities/BulletPool';
import { Enemy, type EnemyContext } from '../entities/Enemy';
import { Player, type PlayerContext, type ShotOpts } from '../entities/Player';
import { Rifleman } from '../entities/Rifleman';
import { FixedStep } from '../systems/FixedStep';
import { Squad } from '../systems/Squad';
import { assistAim } from '../systems/aim';
import { rankFor, betterRank, type RunStats } from '../systems/rank';
import { services, touchActive } from '../systems/services';
import type { InputFrame } from '../systems/InputManager';
import type { SfxName } from '../systems/Sfx';
import { MenuList } from '../ui/MenuList';
import { emptyHud, type HudState } from '../ui/hudState';

export interface StageData {
  stage: string;
  mode: 'relay' | 'solo';
}

export interface ResultsData {
  stageId: string;
  stageName: string;
  mode: 'relay' | 'solo';
  cleared: boolean;
  stats: RunStats;
  swaps: number;
  score: number;
}

interface ArenaRun {
  def: Arena;
  wave: number;
  live: Enemy[];
  state: 'waiting' | 'active' | 'done';
}

const DOWN_DELAY = 0.75;

/**
 * One playable stage. All gameplay advances in `tick(dt)` at a fixed 60 Hz; `update()` only
 * feeds ticks and draws. Arcade runs in customUpdate mode and is stepped from `tick`.
 */
export class StageScene extends Phaser.Scene {
  def!: StageDef;
  mode: 'relay' | 'solo' = 'relay';
  squad!: Squad;
  player!: Player;
  enemies: Enemy[] = [];
  private enemyGroup!: Phaser.Physics.Arcade.Group;
  private pBullets!: BulletPool;
  private eBullets!: BulletPool;
  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private readonly step = new FixedStep(STEP_MS);
  private hitStop = 0;
  runTime = 0;
  private kills = 0;
  private score = 0;
  private continues = 0;
  private totalEnemies = 0;
  private checkpoint = -1;
  private beacons: Phaser.GameObjects.Sprite[] = [];
  private lastSafe = { x: 0, y: 0 };
  private arenas: ArenaRun[] = [];
  private downTimer = -1;
  private fellInWater = false;
  finished = false;
  failed = false;
  private failMenu: MenuList | null = null;
  private failTexts: Phaser.GameObjects.GameObject[] = [];
  private hud!: HudState;
  private layers: { tile: Phaser.GameObjects.TileSprite; factor: number; drift?: number }[] = [];
  private water!: Phaser.GameObjects.TileSprite;
  private camTarget = { x: 0, y: VIEW_H / 2 };
  private lookAhead = 0;
  private muzzles: { img: Phaser.GameObjects.Image; t: number }[] = [];
  private booms: Phaser.GameObjects.Sprite[] = [];
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private debris!: Phaser.GameObjects.Particles.ParticleEmitter;
  private firstFight = false;
  private lastFrame: InputFrame | null = null;
  private viewRect = new Phaser.Geom.Rectangle();
  private tickCount = 0;

  constructor(key = 'Stage') {
    super(key);
  }

  init(data: StageData): void {
    this.def = STAGES[data.stage] ?? STAGES.jungle01;
    this.mode = data.mode ?? services.flags.mode;
    this.enemies = [];
    this.arenas = [];
    this.beacons = [];
    this.layers = [];
    this.muzzles = [];
    this.booms = [];
    this.runTime = 0;
    this.kills = this.score = this.continues = 0;
    this.checkpoint = -1;
    this.hitStop = 0;
    this.downTimer = -1;
    this.finished = this.failed = false;
    this.failMenu = null;
    this.failTexts = [];
    this.firstFight = false;
    this.tickCount = 0;
    this.step.reset();
  }

  create(): void {
    const d = this.def;
    const solo = this.mode === 'solo';
    this.physics.world.setBounds(0, -400, d.width, d.height + 800);
    this.physics.world.gravity.y = TUNING.gravity;

    this.buildBackground();
    this.buildTerrain();
    this.buildProps();

    this.squad = new Squad(
      SQUAD_ORDER.map((id) => ({ id, health: OPERATORS[id].health, armour: OPERATORS[id].armour })),
      { swapCooldown: TUNING.relay.swapCooldown, benchRegen: TUNING.relay.benchRegen, soloLives: solo ? TUNING.solo.lives : undefined },
    );
    this.player = new Player(this, d.spawn.x, d.spawn.y, OPERATORS[this.squad.current.id as OperatorId]);
    this.player.god = services.flags.debug && new URLSearchParams(location.search).get('god') === '1';
    this.lastSafe = { ...d.spawn };

    this.pBullets = new BulletPool(this, 'player', 90);
    this.eBullets = new BulletPool(this, 'enemy', TUNING.bullet.poolSize);
    this.enemyGroup = this.physics.add.group();
    d.enemies.forEach((e, i) => this.spawnEnemy(e, i));
    this.totalEnemies = d.enemies.length + d.arenas.reduce((n, a) => n + a.waves.flat().length, 0);
    this.arenas = d.arenas.map((a) => ({ def: a, wave: -1, live: [], state: 'waiting' }));

    this.buildFx();
    this.addColliders();

    const cam = this.cameras.main;
    cam.setBounds(0, 0, d.width, d.height);
    this.camTarget.x = d.spawn.x + TUNING.camera.lookAhead;
    cam.startFollow(this.camTarget, false, TUNING.camera.lerp, 0);
    cam.centerOn(this.camTarget.x, VIEW_H / 2);

    this.hud = emptyHud();
    this.hud.stageName = d.name;
    this.hud.solo = solo;
    this.registry.set('hud', this.hud);
    this.scene.launch('Hud');
    this.scene.bringToTop('Hud');
    this.updateHud();
    this.callout(d.id === 'stress' ? 'STRESS TEST' : solo ? 'SOLO RUN — 3 LIVES' : 'RELAY READY', '#ffe2a8', 1.6);

    const onHidden = () => {
      if (document.hidden && this.scene.isActive() && !this.finished) this.pause();
    };
    document.addEventListener('visibilitychange', onHidden);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener('visibilitychange', onHidden);
      this.scene.stop('Hud');
    });
    this.events.on(Phaser.Scenes.Events.RESUME, () => {
      this.step.reset();
      services.sfx.resume();
    });

    services.save.data.plays += 1;
    void services.save.save();
    services.telemetry.log('stage_start', { stage: d.id, mode: this.mode, touch: touchActive() });
    this.exposeForTests();
  }

  /* ------------------------------------------------------------------ building */

  private buildBackground(): void {
    const d = this.def;
    this.add.image(0, 0, 'sky').setOrigin(0).setScrollFactor(0).setDepth(DEPTH.sky);
    const layer = (key: string, y: number, h: number, factor: number, depth: number, drift = 0) => {
      const tile = this.add.tileSprite(0, y, VIEW_W, h, key).setOrigin(0).setScrollFactor(0).setDepth(depth);
      this.layers.push({ tile, factor, drift });
      return tile;
    };
    layer('clouds', 10, 300, 0.05, DEPTH.sky + 1, 6);
    layer('far', -30, 540, 0.15, DEPTH.far);
    layer('mid', 40, 540, 0.4, DEPTH.mid);
    layer('near', 0, 540, 0.72, DEPTH.near);
    this.water = this.add
      .tileSprite(0, d.waterY - 6, d.width, d.height - d.waterY + 10, 'water')
      .setOrigin(0)
      .setDepth(DEPTH.water);
    const fg = layer('fg', VIEW_H - 120, 160, 1.25, DEPTH.foreground);
    fg.setAlpha(0.95);
  }

  private buildTerrain(): void {
    const d = this.def;
    this.solids = this.physics.add.staticGroup();
    this.platforms = this.physics.add.staticGroup();
    const paintDepth = 200;
    const addBlock = (r: Rect, i: number, oneWay: boolean) => {
      const key = `blk_${d.id}_${oneWay ? 'p' : 's'}${i}`;
      if (!this.textures.exists(key)) {
        this.textures.addCanvas(key, paintBlock({ w: r.w, h: r.h, paintDepth, oneWay, seed: i * 31 + (oneWay ? 7 : 3) }));
      }
      this.add
        .image(r.x - 10, r.y - 10, key)
        .setOrigin(0)
        .setDepth(DEPTH.terrain);
      if (r.h > paintDepth) {
        this.add
          .rectangle(r.x + 3, r.y + paintDepth - 2, r.w - 6, r.h - paintDepth + 4, 0x2a2a20)
          .setOrigin(0)
          .setDepth(DEPTH.terrain - 1);
      }
      const zone = this.add.zone(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h);
      (oneWay ? this.platforms : this.solids).add(zone);
      const body = zone.body as Phaser.Physics.Arcade.StaticBody;
      if (oneWay) {
        body.checkCollision.down = false;
        body.checkCollision.left = false;
        body.checkCollision.right = false;
      }
    };
    d.solids.forEach((r, i) => addBlock(r, i, false));
    d.platforms.forEach((r, i) => addBlock(r, i, true));
  }

  private buildProps(): void {
    const d = this.def;
    for (const p of d.decor) {
      const key = `${p.kind}_${p.seed}`;
      if (!this.textures.exists(key)) {
        const c = p.kind === 'palm' ? paintPalmProp(p.seed, p.size ?? 190) : p.kind === 'fern' ? paintFern(p.seed, 34) : paintPillar(p.seed);
        this.textures.addCanvas(key, c);
      }
      const depth = p.kind === 'fern' ? DEPTH.decor : DEPTH.terrainBack;
      this.add
        .image(p.x, p.y + (p.kind === 'pillar' ? 2 : 4), key)
        .setOrigin(0.5, 1)
        .setDepth(depth);
    }
    d.checkpoints.forEach((c) => {
      this.beacons.push(this.add.sprite(c.x, c.y + 2, 'beacon', 'off').setOrigin(0.5, 1).setDepth(DEPTH.terrainBack));
    });
    if (d.goal.x < d.width) this.add.image(d.goal.x, d.goal.y + 2, 'flag').setOrigin(0.15, 1).setDepth(DEPTH.terrainBack);
  }

  private buildFx(): void {
    for (let i = 0; i < 8; i++) {
      const img = this.add.image(0, 0, 'muzzle').setOrigin(0.15, 0.5).setDepth(DEPTH.fx).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
      this.muzzles.push({ img, t: 0 });
    }
    for (let i = 0; i < 10; i++) {
      const s = this.add.sprite(0, 0, 'boom', 'b0').setDepth(DEPTH.fx).setVisible(false);
      this.booms.push(s);
    }
    this.sparks = this.add
      .particles(0, 0, 'spark', {
        speed: { min: 90, max: 320 },
        lifespan: 220,
        scale: { start: 1.2, end: 0 },
        angle: { min: 0, max: 360 },
        rotate: { min: 0, max: 360 },
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(DEPTH.fx);
    this.dust = this.add
      .particles(0, 0, 'puff', {
        speedX: { min: -60, max: 60 },
        speedY: { min: -30, max: -5 },
        lifespan: 420,
        scale: { start: 0.35, end: 0.9 },
        alpha: { start: 0.65, end: 0 },
        emitting: false,
      })
      .setDepth(DEPTH.fx - 1);
    this.debris = this.add
      .particles(0, 0, 'leaf', {
        speed: { min: 120, max: 300 },
        angle: { min: 200, max: 340 },
        gravityY: 900,
        lifespan: 700,
        rotate: { min: 0, max: 360 },
        tint: [0x6fa846, 0x8a8f96, 0xc8452f, 0x4e5a37],
        emitting: false,
      })
      .setDepth(DEPTH.fx);
  }

  private spawnEnemy(e: EnemySpawn, seed: number, dropIn = false): Enemy {
    const enemy = new Rifleman(this, e.x, dropIn ? -40 - (seed % 3) * 50 : e.y, seed + 1);
    this.enemyGroup.add(enemy);
    (enemy.body as Phaser.Physics.Arcade.Body).setMaxVelocityY(TUNING.maxFall);
    this.enemies.push(enemy);
    return enemy;
  }

  private addColliders(): void {
    const p = this.player;
    this.physics.add.collider(p, this.solids);
    this.physics.add.collider(p, this.platforms, undefined, () => p.dropTimer <= 0 && p.pbody.velocity.y >= 0);
    this.physics.add.collider(this.enemyGroup, this.solids);
    this.physics.add.collider(this.enemyGroup, this.platforms);

    // Arcade does not guarantee argument order for group-vs-group: identify by type.
    this.physics.add.overlap(this.pBullets.group, this.enemyGroup, (a, b) => {
      const bullet = (a instanceof Bullet ? a : b) as Bullet;
      const enemy = (a instanceof Enemy ? a : b) as Enemy;
      this.bulletHitsEnemy(bullet, enemy);
    });
    this.physics.add.overlap(this.eBullets.group, p, (a, b) => {
      const bullet = (a instanceof Bullet ? a : b) as Bullet;
      if (!bullet.active || !p.alive) return;
      if (this.hurtPlayer()) bullet.kill();
    });
    this.physics.add.overlap(p, this.enemyGroup, (_a, b) => {
      const enemy = (b instanceof Enemy ? b : _a) as Enemy;
      if (!enemy.dead) this.hurtPlayer();
    });
    const killOnWall = (a: unknown, b: unknown) => {
      const bullet = (a instanceof Bullet ? a : b) as Bullet;
      if (bullet.active) {
        this.sparks.explode(4, bullet.x, bullet.y);
        bullet.kill();
      }
    };
    this.physics.add.overlap(this.pBullets.group, this.solids, killOnWall);
    this.physics.add.overlap(this.eBullets.group, this.solids, killOnWall);
  }

  /* ------------------------------------------------------------------ loop */

  override update(_time: number, delta: number): void {
    services.fps.push(delta);
    if (this.finished) return;
    if (this.failed) {
      this.failMenu?.update(services.input.poll());
      return;
    }
    const steps = this.step.advance(delta);
    for (let i = 0; i < steps; i++) {
      this.tick(STEP_MS / 1000);
      if (this.finished || this.failed || !this.scene.isActive()) break;
    }
    this.draw(delta / 1000);
  }

  tick(dt: number): void {
    this.tickCount++;
    const f = this.readInput();
    this.lastFrame = f;
    if (f.pausePressed) {
      this.pause();
      return;
    }
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      return;
    }
    this.runTime += dt;
    this.squad.tick(dt);

    if (f.swapPressed) this.trySwap();
    this.player.tick(dt, f, this.playerCtx);

    const ectx = this.enemyCtx;
    ectx.player.x = this.player.x;
    ectx.player.y = this.player.y;
    ectx.player.alive = this.player.alive;
    ectx.flashing = services.save.data.settings.flashing;
    for (const e of this.enemies) e.tick(dt, ectx);

    this.physics.world.singleStep();

    this.afterPhysics(dt);
    this.player.sync(dt, services.save.data.settings.flashing);
    for (const e of this.enemies) e.sync(ectx);
    this.updateHud();
  }

  private readInput(): InputFrame {
    const f = services.input.poll();
    const s = services.save.data.settings;
    if (touchActive() && s.autoFire && f.source === 'touch' && this.player.alive) {
      f.fire ||= this.enemies.some((e) => !e.dead && Math.abs(e.x - this.player.x) < 520 && this.inView(e.x, e.y - 40, 0));
    }
    return f;
  }

  private afterPhysics(dt: number): void {
    const d = this.def;
    const p = this.player;
    const cam = this.cameras.main;
    this.viewRect.setTo(cam.scrollX, cam.scrollY, VIEW_W, VIEW_H);
    this.pBullets.tick(dt, this.viewRect);
    this.eBullets.tick(dt, this.viewRect);

    for (const m of this.muzzles) {
      if (m.t > 0) {
        m.t -= dt;
        if (m.t <= 0) m.img.setVisible(false);
      }
    }

    // Remove dead enemies once their explosion has been spawned.
    if (this.enemies.some((e) => e.dead)) {
      this.enemies = this.enemies.filter((e) => {
        if (!e.dead) return true;
        e.destroyAll();
        return false;
      });
    }

    if (p.alive) {
      // Water or a fall below the stage knocks the operator out.
      if (p.y > d.waterY + 40) {
        this.fellInWater = true;
        this.splash(p.x, d.waterY);
        if (!p.god) this.downPlayer(true);
        else p.respawn(this.lastSafe.x, this.lastSafe.y - 4, 1);
      } else if (p.grounded && !p.entering) {
        const under = this.solidUnder(p.x);
        if (under && p.x > under.x + 36 && p.x < under.x + under.w - 36) this.lastSafe = { x: p.x, y: under.y };
      }
      this.checkProgress();
    }

    if (this.downTimer >= 0) {
      this.downTimer -= dt;
      if (this.downTimer < 0) this.handOver();
    }

    // Camera target with look-ahead in the facing direction.
    this.lookAhead += (p.facing * TUNING.camera.lookAhead - this.lookAhead) * Math.min(1, dt * 3);
    this.camTarget.x = p.x + this.lookAhead;
    const arena = this.arenas.find((a) => a.state === 'active');
    if (arena) {
      const minX = arena.def.left + 24;
      const maxX = arena.def.right - 24;
      if (p.x < minX || p.x > maxX) {
        p.x = Phaser.Math.Clamp(p.x, minX, maxX);
        p.pbody.updateFromGameObject();
        p.pbody.setVelocityX(0);
      }
    } else if (p.x < 20) {
      p.x = 20;
      p.pbody.updateFromGameObject();
    }
  }

  private draw(dt: number): void {
    const cam = this.cameras.main;
    for (const l of this.layers) {
      l.tile.tilePositionX = cam.scrollX * l.factor + (l.drift ? this.runTime * l.drift : 0);
    }
    this.water.tilePositionX += dt * 14;
  }

  /* ------------------------------------------------------------------ gameplay events */

  private checkProgress(): void {
    const d = this.def;
    const p = this.player;
    d.checkpoints.forEach((c, i) => {
      if (i > this.checkpoint && p.x >= c.x) {
        this.checkpoint = i;
        this.beacons[i]?.setFrame('on');
        this.callout('CHECKPOINT', '#9ffcff', 1.2);
        services.sfx.play('checkpoint');
        services.telemetry.log('checkpoint', { index: i, t: this.runTime });
      }
    });
    for (const a of this.arenas) {
      if (a.state === 'waiting' && p.x >= a.def.triggerX) this.startArena(a);
      if (a.state === 'active' && a.live.every((e) => e.dead)) {
        a.wave++;
        if (a.wave >= a.def.waves.length) {
          a.state = 'done';
          this.cameras.main.setBounds(0, 0, d.width, d.height);
          this.callout('AREA CLEAR', '#9be03c', 1.4);
        } else {
          this.dropWave(a);
        }
      }
    }
    if (p.x >= d.goal.x) this.clearStage();
  }

  private startArena(a: ArenaRun): void {
    a.state = 'active';
    a.wave = 0;
    this.cameras.main.setBounds(a.def.left, 0, a.def.right - a.def.left, this.def.height);
    this.callout('AMBUSH!', '#ff7a2e', 1.4);
    services.telemetry.log('arena_start', { t: this.runTime });
    this.dropWave(a);
  }

  private dropWave(a: ArenaRun): void {
    a.live = a.def.waves[a.wave].map((s, i) => this.spawnEnemy(s, 100 + a.wave * 10 + i, true));
  }

  private trySwap(): void {
    const p = this.player;
    if (!p.alive || p.entering || this.downTimer >= 0) return;
    const idx = this.squad.swap();
    if (idx === null) return;
    this.tagIn(true);
    services.telemetry.log('swap', { to: this.squad.current.id, t: this.runTime, x: Math.round(p.x) });
  }

  /** Bring the current squad member onto the field with their entry attack. */
  private tagIn(entry: boolean): void {
    const op = OPERATORS[this.squad.current.id as OperatorId];
    const p = this.player;
    p.setOperator(op);
    if (entry) p.startEntry();
    this.ring(p.x, p.y - 40, op.color, 1.6);
    services.sfx.play('swap');
    this.callout(`TAG IN: ${op.name.toUpperCase()}`, '#' + op.color.toString(16).padStart(6, '0'), 0.9);
  }

  /** Returns true if the hit landed (so the bullet is spent). */
  private hurtPlayer(): boolean {
    const p = this.player;
    if (!p.alive || p.invuln > 0 || p.god || this.downTimer >= 0 || this.finished) return false;
    const out = this.squad.hit(1);
    const s = services.save.data.settings;
    if (out === 'armour') {
      services.sfx.play('armour');
      p.invuln = 0.6;
      this.sparks.explode(10, p.x, p.y - 44);
    } else if (out === 'health') {
      services.sfx.play('hurt');
      p.invuln = TUNING.hit.playerInvuln;
      this.hitStop = TUNING.hit.hitStop * 1.5;
      if (s.shake) this.cameras.main.shake(TUNING.hit.shakeDuration * 1000, TUNING.hit.shake * 1.5);
      if (s.flashing) this.cameras.main.flash(80, 255, 80, 60);
    } else if (out === 'down') {
      this.downPlayer(false);
    }
    return out !== 'ignored';
  }

  private downPlayer(fell: boolean): void {
    const p = this.player;
    if (fell) this.squad.fall();
    this.fellInWater = fell;
    services.sfx.play('down');
    services.telemetry.log('down', { op: p.op.id, x: Math.round(p.x), t: this.runTime, fell });
    if (!fell) {
      const ghost = this.add
        .image(p.x, p.y, `op_${p.op.id}`, 'fall')
        .setOrigin(0.5, 0.95)
        .setFlipX(p.facing < 0)
        .setDepth(DEPTH.player);
      this.tweens.add({ targets: ghost, angle: -90 * p.facing, y: p.y - 30, alpha: 0, duration: 650, ease: 'Quad.easeOut', onComplete: () => ghost.destroy() });
      this.explode(p.x, p.y - 40, false);
    }
    p.knockOut();
    this.eBullets.clear();
    this.downTimer = DOWN_DELAY;
  }

  private handOver(): void {
    const next = this.squad.handOver();
    if (next === null) {
      this.fail();
      return;
    }
    const p = this.player;
    const pos = this.fellInWater ? this.lastSafe : { x: p.x, y: p.y };
    p.respawn(pos.x, pos.y - 4, this.squad.solo ? 2 : TUNING.relay.entryInvuln);
    this.fellInWater = false;
    if (this.squad.solo) {
      this.ring(p.x, p.y - 40, OPERATORS[p.op.id].color, 1.4);
      this.callout(`LIVES: ${this.squad.livesLeft}`, '#ffe2a8', 1);
    } else {
      this.tagIn(true);
    }
  }

  private fail(): void {
    this.failed = true;
    services.telemetry.log('fail', { t: this.runTime, x: Math.round(this.player.x) });
    const cx = VIEW_W / 2;
    const shade = this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x0b120e, 0.72).setOrigin(0).setScrollFactor(0).setDepth(200);
    const title = this.add
      .text(cx, 150, 'SQUAD DOWN', { fontFamily: FONT_DISPLAY, fontSize: '64px', color: '#ff7a2e' })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(201)
      .setStroke('#1b1a17', 8);
    this.failTexts = [shade, title];
    this.failMenu = new MenuList(this, cx, 270, [
      { label: () => 'CONTINUE FROM CHECKPOINT', action: () => this.continueRun() },
      { label: () => 'QUIT', action: () => this.finish(false) },
    ], 420);
    this.failMenu.setDepth(202);
  }

  private continueRun(): void {
    this.failMenu?.destroy();
    this.failMenu = null;
    this.failTexts.forEach((o) => o.destroy());
    this.failed = false;
    this.continues++;
    services.telemetry.log('continue', { t: this.runTime });
    this.squad.reviveAll();
    const c = this.def.checkpoints[this.checkpoint];
    const pos = c ?? this.def.spawn;
    this.player.setOperator(OPERATORS[this.squad.current.id as OperatorId]);
    this.player.respawn(pos.x, pos.y - 4, 2);
    this.eBullets.clear();
    this.step.reset();
  }

  private clearStage(): void {
    if (this.finished) return;
    services.sfx.play('clear');
    this.callout('MISSION COMPLETE', '#9be03c', 3);
    this.finish(true);
  }

  private finish(cleared: boolean): void {
    if (this.finished) return;
    this.finished = true;
    const stats: RunStats = {
      timeSec: this.runTime,
      parSec: this.def.parSec,
      downs: this.squad.downs,
      continues: this.continues,
      kills: this.kills,
      totalEnemies: this.totalEnemies,
    };
    services.telemetry.log(cleared ? 'clear' : 'quit', { t: this.runTime, rank: cleared ? rankFor(stats) : null, swaps: this.squad.swaps });
    if (cleared) {
      const rank = rankFor(stats);
      const best = services.save.data.best[this.def.id];
      if (betterRank(best?.rank, rank) || (best?.rank === rank && stats.timeSec < best.timeSec)) {
        services.save.data.best[this.def.id] = { rank, timeSec: stats.timeSec };
      }
      void services.save.save();
    }
    const data: ResultsData = {
      stageId: this.def.id,
      stageName: this.def.name,
      mode: this.mode,
      cleared,
      stats,
      swaps: this.squad.swaps,
      score: this.score,
    };
    this.time.delayedCall(cleared ? 1400 : 0, () => {
      this.scene.stop('Hud');
      this.scene.start('Results', data);
    });
  }

  pause(): void {
    if (this.finished || this.failed) return;
    services.input.releaseAll();
    services.sfx.suspend();
    this.scene.pause();
    this.scene.launch('Pause', { from: 'Stage', stage: this.def.id, mode: this.mode });
  }

  /* ------------------------------------------------------------------ combat helpers */

  private bulletHitsEnemy(bullet: Bullet, enemy: Enemy): void {
    if (!bullet.active || enemy.dead || bullet.hits.has(enemy)) return;
    bullet.hits.add(enemy);
    if (!this.firstFight) {
      this.firstFight = true;
      services.telemetry.log('first_fight', { t: this.runTime });
    }
    const killed = enemy.hurt(bullet.damage);
    this.sparks.explode(5, bullet.x, bullet.y);
    services.sfx.play('hit');
    if (killed) this.killEnemy(enemy);
    if (bullet.pierce > 0) bullet.pierce--;
    else bullet.kill();
  }

  private killEnemy(enemy: Enemy): void {
    this.kills++;
    this.score += enemy.score;
    this.explode(enemy.x, enemy.y - 40, true);
    this.hitStop = Math.max(this.hitStop, TUNING.hit.hitStop);
    (enemy.body as Phaser.Physics.Arcade.Body).enable = false;
    enemy.setVisible(false);
  }

  private explode(x: number, y: number, big: boolean): void {
    const b = this.booms.find((s) => !s.visible);
    if (b) {
      b.setPosition(x, y).setVisible(true).setScale(big ? 1.1 : 0.8).setAngle(Math.random() * 360);
      b.play('boom');
    }
    this.debris.explode(big ? 10 : 6, x, y);
    this.dust.explode(4, x, y + 20);
    services.sfx.play('explode');
    if (big && services.save.data.settings.shake) this.cameras.main.shake(90, TUNING.hit.shake);
  }

  private ring(x: number, y: number, color: number, scale: number): void {
    const r = this.add.image(x, y, 'ring').setTint(color).setDepth(DEPTH.fx).setScale(0.2).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: r, scale, alpha: 0, duration: 380, ease: 'Cubic.easeOut', onComplete: () => r.destroy() });
  }

  private splash(x: number, y: number): void {
    this.dust.explode(8, x, y);
    this.sparks.explode(6, x, y);
  }

  private solidUnder(x: number): Rect | undefined {
    return this.def.solids.find((r) => x >= r.x && x <= r.x + r.w);
  }

  private inView(x: number, y: number, margin: number): boolean {
    const cam = this.cameras.main;
    return x > cam.scrollX - margin && x < cam.scrollX + VIEW_W + margin && y > cam.scrollY - margin && y < cam.scrollY + VIEW_H + margin;
  }

  private callout(text: string, color: string, sec: number): void {
    if (this.hud) this.hud.callout = { text, color, until: this.runTime + sec };
  }

  private updateHud(): void {
    const h = this.hud;
    const sq = this.squad;
    h.members = sq.members.map((m, i) => {
      const op = OPERATORS[m.id as OperatorId];
      return {
        id: op.id,
        name: op.name,
        color: op.color,
        health: m.health,
        maxHealth: m.maxHealth,
        armour: m.armour,
        maxArmour: m.maxArmour,
        down: m.down,
        active: i === sq.active,
      };
    });
    h.swapCooldown = sq.cooldown / TUNING.relay.swapCooldown;
    h.canSwap = sq.canSwap;
    h.livesLeft = sq.livesLeft;
    h.timeSec = this.runTime;
    h.score = this.score;
    h.weapon = this.player.op.weapon.name;
    if (h.callout && h.callout.until < this.runTime) h.callout = null;
  }

  /* ------------------------------------------------------------------ contexts */

  private readonly playerCtx: PlayerContext = {
    fire: (x: number, y: number, angle: number, shot: ShotOpts) => {
      const b = this.pBullets.fire(x, y, angle, shot.speed, shot.texture, shot.damage, shot.pierce, TUNING.bullet.lifetime);
      b?.setScale(shot.scale ?? 1);
    },
    muzzleFlash: (x: number, y: number, angle: number) => {
      const m = this.muzzles.find((i) => i.t <= 0) ?? this.muzzles[0];
      m.t = 0.05;
      m.img.setPosition(x, y).setRotation(angle).setVisible(true).setScale(0.8 + Math.random() * 0.4);
    },
    sfx: (name: SfxName) => services.sfx.play(name),
    assist: (angle: number, x: number, y: number) => {
      if (!services.save.data.settings.aimAssist) return angle;
      const targets = this.enemies.filter((e) => !e.dead && this.inView(e.x, e.y, 0)).map((e) => ({ x: e.x, y: e.y - 44 }));
      return assistAim(angle, { x, y }, targets, TUNING.touch.aimAssistCone, TUNING.touch.aimAssistRange);
    },
    standingOnPlatform: (body: Phaser.Physics.Arcade.Body) => {
      const bottom = body.bottom;
      const cx = body.center.x;
      return this.def.platforms.some((r) => cx >= r.x && cx <= r.x + r.w && Math.abs(bottom - r.y) < 6);
    },
    pound: (x: number, y: number) => {
      services.sfx.play('pound');
      this.ring(x, y - 10, OPERATORS.rurik.color, 3.2);
      this.dust.explode(14, x, y);
      if (services.save.data.settings.shake) this.cameras.main.shake(200, TUNING.hit.shake * 2);
      this.hitStop = TUNING.hit.hitStop;
      for (const e of this.enemies) {
        if (e.dead) continue;
        const dist = Phaser.Math.Distance.Between(x, y - 30, e.x, e.y - 40);
        if (dist < 210) {
          e.stun = 1.6;
          if (e.hurt(3)) this.killEnemy(e);
        }
      }
      for (const b of this.eBullets.items) {
        if (b.active && Phaser.Math.Distance.Between(x, y - 30, b.x, b.y) < 240) b.kill();
      }
    },
    dust: (x: number, y: number) => this.dust.explode(3, x, y),
  };

  private readonly enemyCtx: EnemyContext = {
    player: { x: 0, y: 0, alive: true },
    inView: (x, y, m) => this.inView(x, y, m),
    groundAhead: (x, y, dir) => {
      const probeX = x + dir * 26;
      return (
        this.def.solids.some((r) => probeX >= r.x && probeX <= r.x + r.w && Math.abs(r.y - y) < 8) ||
        this.def.platforms.some((r) => probeX >= r.x && probeX <= r.x + r.w && Math.abs(r.y - y) < 8)
      );
    },
    fireEnemyBullet: (x, y, angle) => {
      this.eBullets.fire(x, y, angle, TUNING.bullet.enemySpeed, 'bullet_enemy', 1, 0, 3);
    },
    sfx: (name) => services.sfx.play(name),
    flashing: true,
  };

  /* ------------------------------------------------------------------ test hooks */

  private exposeForTests(): void {
    const w = window as unknown as { __hotRelay?: Record<string, unknown> };
    w.__hotRelay = w.__hotRelay ?? {};
    w.__hotRelay.stage = this;
    w.__hotRelay.probe = () => {
      const p = this.player;
      const ahead = (dx: number) => this.def.solids.find((r) => p.x + dx >= r.x && p.x + dx <= r.x + r.w);
      const curr = this.solidUnder(p.x);
      const next = ahead(p.facing * 90);
      return {
        x: p.x,
        y: p.y,
        grounded: p.grounded,
        alive: p.alive,
        gapAhead: !next,
        wallAhead: !!next && !!curr && next.y < curr.y - 10,
        arena: this.arenas.some((a) => a.state === 'active'),
        enemiesInView: this.enemies.filter((e) => !e.dead && this.inView(e.x, e.y, 0)).length,
        finished: this.finished,
        failed: this.failed,
        runTime: this.runTime,
        kills: this.kills,
        downs: this.squad.downs,
        swaps: this.squad.swaps,
        active: this.squad.current.id,
        enemyBullets: this.eBullets.activeCount,
        enemies: this.enemies.length,
        ticks: this.tickCount,
        last: this.lastFrame,
      };
    };
  }

  get enemyBulletCount(): number {
    return this.eBullets.activeCount;
  }
}
