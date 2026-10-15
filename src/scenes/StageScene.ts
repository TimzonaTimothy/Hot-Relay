/**
 * The playable stage (CORE-01..06, RELAY-02..05, LEVEL-01) with the character system,
 * swimming and the helicopter insertion.
 *
 * Everything that affects gameplay happens in `tick`, which runs in fixed steps.
 * `update` only feeds the fixed-step loop and refreshes visuals, the camera and the HUD.
 * Helpers in src/stage/ own the visual-only pieces (effects, water, foliage, camera,
 * insertion); this scene wires them to the rules.
 */
import Phaser from 'phaser';
import {
  CANVAS_H,
  CANVAS_W,
  COLORS,
  DEPTH,
  SCENES,
  VIEW_H,
  VIEW_W,
  ZOOM,
} from '../config/constants';
import { TUNING } from '../config/tuning';
import { resolveSquad, type EntryAttack, type OperatorDef } from '../data/operators';
import { shotStats } from '../data/weapons';
import { GREYBOX_01 } from '../data/stages/greybox01';
import type { ArenaDef, PlatformDef, StageDef } from '../data/stages/types';
import { Player } from '../entities/Player';
import { Rifleman } from '../entities/Rifleman';
import { Enemy, type EnemyContext, type EnemyVisualWorld } from '../entities/Enemy';
import { Cache, EelDrone, Grate, Mine } from '../entities/Hazards';
import { Grenadier } from '../entities/Grenadier';
import { Turret } from '../entities/Turret';
import { Barrel, Grenade, GrenadePool } from '../entities/Explosives';
import { PICKUP_LABEL, Pickup, SupplyPod, type PickupKind } from '../entities/Supply';
import { Tracers } from '../stage/Tracers';
import { Bridges } from '../stage/Bridges';
import { segmentBlocked } from '../systems/geometry';
import { WEAPONS } from '../data/weapons';
import { Bullet, BulletPool } from '../entities/BulletPool';
import { Rig } from '../entities/Rig';
import { FixedStep } from '../systems/FixedStep';
import { Squad, type SquadMode } from '../systems/Squad';
import { input, type InputFrame } from '../systems/InputManager';
import { assistAim, type Vec } from '../systems/aim';
import { sfx } from '../systems/Sfx';
import { telemetry } from '../systems/Telemetry';
import { saves } from '../systems/services';
import { computeRank, isBetterRun } from '../systems/rank';
import { FpsMeter } from '../systems/FpsMeter';
import { FLAGS } from '../systems/flags';
import { AutoDetail, resolveDetail, type DetailLevel } from '../systems/detail';
import { groundBelow } from '../systems/geometry';
import { pointInWater } from '../systems/water';
import { hud, HUD_EVENTS } from '../ui/hudState';
import { ParallaxStrip } from '../ui/ParallaxStrip';
import type { Settings } from '../systems/SaveStore';
import { Effects } from '../stage/Effects';
import { WaterView } from '../stage/WaterView';
import { Foliage } from '../stage/Foliage';
import { CameraRig } from '../stage/CameraRig';
import { InsertionCinematic } from '../stage/Insertion';
import { ART_RES, paintStage } from '../art/stageArt';
import { FX_RES } from '../art/fx';

/** Auto-detail watcher shared by every stage run this session (PERF-01). */
const sessionAutoDetail = new AutoDetail();
/** The 'Detail lowered' notice is shown once per session. */
let autoNoticeShown = false;

type StageStatus = 'playing' | 'squadDown' | 'clear';
type GREYBOX_POD = StageDef['pods'][number];

interface ArenaRuntime {
  def: ArenaDef;
  started: boolean;
  done: boolean;
  enemies: Set<Enemy>;
  walls: Phaser.GameObjects.Rectangle[];
}

interface CheckpointRuntime {
  x: number;
  y: number;
  reached: boolean;
  flag: Phaser.GameObjects.Image;
}

/** A downed operator's body playing out its fall while the next one tags in. */
interface Fallen {
  rig: Rig;
  x: number;
  y: number;
  vy: number;
  ms: number;
  wet: boolean;
  facing: 1 | -1;
}

export interface ResultsData {
  stageId: string;
  stageName: string;
  mode: SquadMode;
  timeMs: number;
  downs: number;
  swaps: number;
  continues: number;
  rank: ReturnType<typeof computeRank>;
  newBest: boolean;
  bestTimeMs: number;
  secrets: number;
  squad: string[];
}

const GROUND_Y = 240;
const SURFACE_Y = 252;

export class StageScene extends Phaser.Scene {
  private def: StageDef = GREYBOX_01;
  private mode: SquadMode = 'relay';
  private squadIds: string[] | undefined;
  private settings!: Settings;
  private squad!: Squad;
  private player!: Player;
  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private oneways!: Phaser.Physics.Arcade.StaticGroup;
  private breakables!: Phaser.Physics.Arcade.StaticGroup;
  private enemies: Enemy[] = [];
  private caches: Cache[] = [];
  private pBullets!: BulletPool;
  private eBullets!: BulletPool;
  private telegraph!: Phaser.GameObjects.Graphics;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private debris!: Phaser.GameObjects.Particles.ParticleEmitter;
  private fx!: Effects;
  private waterView!: WaterView;
  private foliage!: Foliage;
  private camRig!: CameraRig;
  private cinematic: InsertionCinematic | null = null;
  private skippable = false;
  private parallax: { key: string; strip: ParallaxStrip; fx: number; fy: number; y: number }[] = [];
  private pontoonArt: { img: Phaser.GameObjects.Image; baseY: number; phase: number }[] = [];
  private fallen: Fallen[] = [];

  private fixed = new FixedStep(TUNING.stepMs, TUNING.maxFrameMs);
  private fps = new FpsMeter(600);
  /** Session-wide, so a lowered detail survives retries and restarts. */
  private readonly autoDetail = sessionAutoDetail;
  /** Level currently drawn; null until the first frame applies it. */
  private detail: DetailLevel | null = null;
  private detailNotices = 0;
  private hitStopMs = 0;
  private status: StageStatus = 'playing';
  private timeMs = 0;
  private continues = 0;
  private secrets = 0;
  private checkpoint = { x: 0, y: 0 };
  private checkpoints: CheckpointRuntime[] = [];
  private arenas: ArenaRuntime[] = [];
  private firstFightLogged = false;
  private retryReadyAt = 0;
  private wasSubmerged = false;
  private surgeHits = new Set<Enemy>();
  /** Level geometry as it is now (collapsed bridge pieces are removed). */
  private live: PlatformDef[] = [];
  private solidRects: PlatformDef[] = [];
  private grenades!: GrenadePool;
  private barrels: Barrel[] = [];
  private pickups: Pickup[] = [];
  private podQueue: GREYBOX_POD[] = [];
  private tracers!: Tracers;
  private bridges!: Bridges;
  private lastMuzzleY = 0;
  private pickupsTaken = 0;

  constructor() {
    super(SCENES.stage);
  }

  init(data: { mode?: SquadMode; squad?: string[] }): void {
    this.mode = data.mode ?? FLAGS.mode;
    // a restart (pause menu) keeps the squad that was picked
    this.squadIds = data.squad ?? this.squadIds;
    this.def = GREYBOX_01;
    this.enemies = [];
    this.caches = [];
    this.barrels = [];
    this.pickups = [];
    this.podQueue = [];
    this.pickupsTaken = 0;
    this.checkpoints = [];
    this.arenas = [];
    this.parallax = [];
    this.pontoonArt = [];
    this.fallen = [];
    this.cinematic = null;
    this.status = 'playing';
    this.timeMs = 0;
    this.continues = 0;
    this.secrets = 0;
    this.hitStopMs = 0;
    this.firstFightLogged = false;
    this.wasSubmerged = false;
    this.fixed.reset();
    this.fps.reset();
    this.autoDetail.clearWindow();
    this.detail = null;
  }

  create(): void {
    this.settings = saves.data.settings;
    const ids =
      this.squadIds ??
      FLAGS.squad ??
      (saves.data.lastSquad.length ? saves.data.lastSquad : undefined);
    this.squad = new Squad(resolveSquad(ids), this.mode, {
      swapCooldownMs: TUNING.swapCooldownMs,
      benchArmourRegenMs: TUNING.benchArmourRegenMs,
      soloLives: 3,
      drownTickMs: TUNING.oxygen.drownTickMs,
      oxygenRefillRate: TUNING.oxygen.refillRate,
      benchOxygenRefillRate: TUNING.oxygen.benchRefillRate,
    });

    const { width, height } = this.def;
    this.physics.world.setBounds(0, 0, width, height + 120);
    this.physics.world.setBoundsCollision(true, true, false, false);
    this.physics.world.gravity.y = TUNING.gravity;

    this.live = [...this.def.platforms];
    this.solidRects = this.def.platforms.filter((p) => p.kind === 'solid');
    this.buildBackground();
    this.fx = new Effects(this, this.live, this.def.water);
    this.buildLevel();
    this.waterView = new WaterView(this, this.def.water);
    this.foliage = new Foliage(this, this.def.tufts);

    const lead = this.squad.active;
    this.player = new Player(this, this.def.start.x, this.def.start.y, lead.def, {
      platforms: this.live,
      water: this.def.water,
      fx: this.fx,
    });
    this.player.setOperator(lead.def, lead.arsenal);
    this.player.setCollideWorldBounds(true);
    this.checkpoint = { ...this.def.start };

    this.def.enemies.forEach((e) => this.spawnEnemy(e));
    this.def.turrets.forEach((t) => this.enemies.push(new Turret(this, t.x, t.y, t.facing)));
    this.podQueue = [...this.def.pods].sort((a, b) => a.triggerX - b.triggerX);
    this.def.mines.forEach((m) => {
      const floor = groundBelow(this.def.platforms, m.x, m.y) ?? m.y + 40;
      this.enemies.push(new Mine(this, m.x, m.y, floor));
    });
    this.def.eels.forEach((e) => {
      const pool = this.def.water.find((v) => pointInWater(e.x, e.y, [v]));
      if (pool) this.enemies.push(new EelDrone(this, e.x, e.y, e.minX, e.maxX, e.y, pool));
    });
    this.def.caches.forEach((c) => this.caches.push(new Cache(this, c.x, c.y)));
    this.arenas = this.def.arenas.map((def) => ({
      def,
      started: false,
      done: false,
      enemies: new Set(),
      walls: [],
    }));

    this.pBullets = new BulletPool(this, 'bullet-p', 110);
    this.eBullets = new BulletPool(this, 'bullet-e', 120);
    this.grenades = new GrenadePool(this, 10);
    this.tracers = new Tracers(this, [this.pBullets, this.eBullets], this.fx);
    this.telegraph = this.add.graphics().setDepth(DEPTH.fx);
    this.sparks = this.add
      .particles(0, 0, 'px', {
        speed: { min: 30, max: 120 },
        lifespan: 220,
        scale: { start: 1, end: 0 },
        tint: [0xfff2a8, 0xffffff],
        gravityY: 200,
        emitting: false,
      })
      .setDepth(DEPTH.fx);
    this.debris = this.add
      .particles(0, 0, 'px', {
        speed: { min: 60, max: 200 },
        lifespan: 480,
        scale: { start: 1.5, end: 0 },
        tint: [COLORS.enemy, COLORS.enemyDark, 0xffb070],
        gravityY: 500,
        emitting: false,
      })
      .setDepth(DEPTH.fx);

    this.addColliders();

    const cam = this.cameras.main;
    cam.setZoom(ZOOM);
    cam.setBackgroundColor(COLORS.bg);
    this.camRig = new CameraRig(cam);
    this.camRig.setBounds(0, 0, width, height);

    this.startInsertion();
    this.camRig.focusX = this.cinematic ? this.cinematic.frame.cameraX : null;
    this.camRig.snap(this.cameraSubject());

    this.events.on('enemy-died', this.onEnemyDied, this);
    this.events.on('mine-exploded', (x: number, y: number, m: Enemy) =>
      this.explode(x, y, 30, 1, m),
    );
    this.events.on('turret-destroyed', (x: number, y: number, t: Enemy) =>
      this.explode(x, y, 26, 0, t),
    );
    this.events.on('pod-opened', (x: number, y: number, give: PickupKind) => {
      this.pickups.push(new Pickup(this, x, y, give));
      this.fx.explosion(x, y, 12, false);
    });
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.onHidden, this);
    this.game.events.on(HUD_EVENTS.retry, this.tryRetry, this);
    this.game.events.on(HUD_EVENTS.skip, this.trySkip, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.HIDDEN, this.onHidden, this);
      this.game.events.off(HUD_EVENTS.retry, this.tryRetry, this);
      this.game.events.off(HUD_EVENTS.skip, this.trySkip, this);
      this.cinematic?.destroy();
      sfx.stopRotor();
      hud.running = false;
      hud.cinematic.active = false;
    });

    if (!this.scene.isActive(SCENES.hud)) this.scene.launch(SCENES.hud);
    else this.scene.get(SCENES.hud).scene.restart();
    this.scene.bringToTop(SCENES.hud);

    input.flush();
    saves.data.stats.runsStarted++;
    void saves.save();
    telemetry.log('stage_start', {
      stage: this.def.id,
      mode: this.mode,
      squad: this.squad.members.map((m) => m.def.id).join(','),
      insertion: this.cinematic ? (this.skippable ? 'skippable' : 'first') : 'none',
      ...telemetry.context(),
    });
    if (FLAGS.debug) {
      this.input.keyboard?.on('keydown-F2', () => this.toggleDebugDraw());
      this.exposeDebug();
    }
    this.exposeState();
  }

  // ---------------------------------------------------------------- level building

  private buildBackground(): void {
    // Objects that do not scroll 1:1 are placed around the zoomed camera's centre, so they
    // shift by half the gap between canvas size and view size to line up with the screen.
    const ox = (CANVAS_W - VIEW_W) / 2;
    const oy = (CANVAS_H - VIEW_H) / 2;
    // Sky, sun and the far skyline are baked into one opaque tile: on fill-rate-limited
    // devices every full-screen layer costs, so the distant backdrop is drawn exactly once.
    this.bakeSky();
    const layer = (key: string, y: number, fx: number, fy: number) => {
      const strip = new ParallaxStrip(this, key, ox, oy + y, VIEW_W, 1, {
        depth: DEPTH.parallax,
        scrollFactor: 0,
      });
      this.parallax.push({ key, strip, fx, fy, y: oy + y });
    };
    layer('stage-sky', -10, 0.06, 0.1);
    layer('bg-mid', 118, 0.16, 0.25);
    layer('bg-near', 182, 0.4, 0.5);
  }

  /** PLACEHOLDER: dusk sky + low sun + far cranes in one 512×290 tile (repeats horizontally). */
  private bakeSky(): void {
    if (this.textures.exists('stage-sky')) return;
    const W = 512;
    const H = 290;
    const tex = this.textures.createCanvas('stage-sky', W, H);
    if (!tex) return;
    const c = tex.getContext();
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0a1120');
    g.addColorStop(0.55, '#4a2238');
    g.addColorStop(0.95, '#c4552a');
    g.addColorStop(1, '#c4552a');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    const sx = 350;
    const sy = 192;
    const glow = c.createRadialGradient(sx, sy, 0, sx, sy, 150);
    glow.addColorStop(0, 'rgba(255,150,70,0.55)');
    glow.addColorStop(1, 'rgba(255,120,50,0)');
    c.fillStyle = glow;
    c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(255,176,102,0.95)';
    c.beginPath();
    c.arc(sx, sy, 20, 0, Math.PI * 2);
    c.fill();
    const far = this.textures.get('bg-far').getSourceImage() as CanvasImageSource;
    c.drawImage(far, 0, 60);
    tex.refresh();
  }

  private buildLevel(): void {
    this.solids = this.physics.add.staticGroup();
    this.oneways = this.physics.add.staticGroup();
    this.breakables = this.physics.add.staticGroup();

    this.bridges = new Bridges(
      this.live,
      (x, y) => this.explode(x, y, 14, 0, null),
      (body) => this.oneways.remove(body, true, true),
    );
    for (const p of this.def.platforms) this.addPlatform(p);
    // PLACEHOLDER painted art over the collision rectangles
    for (const art of paintStage(this, this.def, GROUND_Y, SURFACE_Y)) {
      const img = this.add
        .image(art.x, art.y, art.key)
        .setOrigin(0, 0)
        .setScale(1 / ART_RES)
        .setDepth(art.pontoon ? DEPTH.level + 1 : DEPTH.level);
      if (art.pontoon) this.pontoonArt.push({ img, baseY: art.y, phase: art.x * 0.05 });
      const pdef = this.def.platforms[art.index];
      if (pdef?.bridge !== undefined) this.bridges.setArt(pdef, img);
    }

    for (const g of this.def.grates) this.breakables.add(new Grate(this, g.x, g.top, g.h));
    for (const b of this.def.barrels) {
      const barrel = new Barrel(this, b.x, b.y);
      this.barrels.push(barrel);
      this.breakables.add(barrel);
    }

    this.def.checkpoints.forEach((cp) => {
      const flag = this.add
        .image(cp.x, cp.y, 'prop-checkpoint-off')
        .setOrigin(1.6 / 14, 1)
        .setScale(1 / FX_RES)
        .setDepth(DEPTH.pickups);
      this.checkpoints.push({ x: cp.x, y: cp.y, reached: false, flag });
    });

    const g = this.def.goal;
    const beacon = this.add
      .image(g.x, g.y, 'prop-goal')
      .setOrigin(3 / 22, 1)
      .setScale(1 / FX_RES)
      .setDepth(DEPTH.pickups);
    this.add
      .image(g.x + 0.8, g.y - 49.5, 'glow')
      .setScale(0.35)
      .setTint(0xff3b30)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.pickups);
    this.tweens.add({
      targets: beacon,
      scaleX: 0.96 / FX_RES,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /** Invisible collision rectangle; the art is painted separately. */
  private addPlatform(p: PlatformDef): void {
    const rect = this.add
      .rectangle(p.x + p.w / 2, p.y + p.h / 2, p.w, p.h, 0x000000, 0)
      .setVisible(false);
    this.physics.add.existing(rect, true);
    if (p.kind === 'solid') {
      this.solids.add(rect);
    } else {
      const body = rect.body as Phaser.Physics.Arcade.StaticBody;
      body.checkCollision.down = false;
      body.checkCollision.left = false;
      body.checkCollision.right = false;
      this.oneways.add(rect);
      this.bridges.add(p, rect);
    }
  }

  private spawnEnemy(s: {
    type: 'rifleman' | 'grenadier';
    x: number;
    y: number;
    patrol?: number;
  }): Enemy {
    const e =
      s.type === 'grenadier'
        ? new Grenadier(this, s.x, s.y, this.fx.makeShadow())
        : new Rifleman(this, s.x, s.y, this.fx.makeShadow(), s.patrol ?? 0);
    this.enemies.push(e);
    return e;
  }

  private addColliders(): void {
    const p = this.player;
    this.physics.add.collider(p, this.solids, () => {
      if (p.arcadeBody.blocked.down || p.arcadeBody.touching.down) p.groundKind = 'solid';
    });
    this.physics.add.collider(p, this.breakables);
    this.physics.add.collider(
      p,
      this.oneways,
      () => {
        if ((p.arcadeBody.blocked.down || p.arcadeBody.touching.down) && p.groundKind !== 'solid')
          p.groundKind = 'oneway';
      },
      (_pl, plat) =>
        this.landsOnOneWay(
          p.arcadeBody,
          plat as Phaser.GameObjects.Rectangle,
          p.dropThroughMs <= 0,
        ),
    );

    this.physics.add.collider(this.enemies, this.solids);
    const gr = this.grenades.group;
    this.physics.add.collider(gr, this.solids);
    this.physics.add.collider(gr, this.breakables);
    this.physics.add.collider(gr, this.oneways, undefined, (a, b) => {
      const g = (a instanceof Grenade ? a : b) as Grenade;
      const plat = (g === a ? b : a) as Phaser.GameObjects.Rectangle;
      return this.landsOnOneWay(g.body as Phaser.Physics.Arcade.Body, plat, true);
    });
    this.physics.add.collider(this.enemies, this.breakables);
    // Arcade does not promise argument order when an array meets a group, so callbacks
    // identify each object by type instead of trusting position.
    const bulletOf = (a: unknown, b: unknown): Bullet => (a instanceof Bullet ? a : (b as Bullet));
    const enemyOf = (a: unknown, b: unknown): Enemy => (a instanceof Enemy ? a : (b as Enemy));
    const grateOf = (a: unknown, b: unknown): Grate | Barrel =>
      a instanceof Grate || a instanceof Barrel ? a : (b as Grate | Barrel);
    const otherOf = (a: unknown, b: unknown, known: unknown) => (a === known ? b : a);

    this.physics.add.collider(this.enemies, this.oneways, undefined, (a, b) => {
      const en = enemyOf(a, b);
      const plat = otherOf(a, b, en) as Phaser.GameObjects.Rectangle;
      return this.landsOnOneWay(en.arcadeBody, plat, true);
    });

    this.physics.add.overlap(this.pBullets.group, this.enemies, (a, b) =>
      this.onBulletHitEnemy(bulletOf(a, b), enemyOf(a, b)),
    );
    this.physics.add.overlap(this.pBullets.group, this.solids, (a, b) =>
      this.killBullet(this.pBullets, bulletOf(a, b)),
    );
    this.physics.add.overlap(this.pBullets.group, this.breakables, (a, b) =>
      this.onBulletHitBreakable(bulletOf(a, b), grateOf(a, b)),
    );
    this.physics.add.overlap(this.eBullets.group, this.solids, (a, b) =>
      this.killBullet(this.eBullets, bulletOf(a, b)),
    );
    this.physics.add.overlap(this.eBullets.group, this.breakables, (a, b) =>
      this.killBullet(this.eBullets, bulletOf(a, b)),
    );
    this.physics.add.overlap(p, this.eBullets.group, (a, b) => {
      const bullet = bulletOf(a, b);
      if (!bullet.active || p.invulnMs > 0 || this.status !== 'playing') return;
      const vx = (bullet.body as Phaser.Physics.Arcade.Body).velocity.x;
      this.eBullets.kill(bullet);
      this.hurtPlayer(1, bullet.x - Math.sign(vx || 1) * 10);
    });
    this.physics.add.overlap(p, this.enemies, (a, b) => {
      const e = enemyOf(a, b);
      if (e.contactDamage > 0) this.hurtPlayer(TUNING.contactDamage * e.contactDamage, e.x);
    });
  }

  /** One-way platforms only stop bodies falling onto them from above. */
  private landsOnOneWay(
    body: Phaser.Physics.Arcade.Body,
    plat: Phaser.GameObjects.Rectangle,
    allowed: boolean,
  ): boolean {
    if (!allowed || body.velocity.y < 0) return false;
    const top = (plat.body as Phaser.Physics.Arcade.StaticBody).top;
    return body.prev.y + body.height <= top + 2;
  }

  // ---------------------------------------------------------------- insertion

  private startInsertion(): void {
    const ins = this.def.insertion;
    const play = FLAGS.insertion === 'play' || (FLAGS.insertion !== 'skip' && !FLAGS.autostart);
    if (!ins || !play) return;
    // measured from the level so the operator always lands on solid ground
    const groundY = groundBelow(this.def.platforms, ins.landX, 0) ?? this.def.start.y;
    this.cinematic = new InsertionCinematic(this, ins, groundY, this.player, this.fx, this.foliage);
    this.skippable = saves.data.seenInsertion[this.def.id] === true || FLAGS.debug;
  }

  private trySkip(): void {
    if (this.cinematic && !this.cinematic.controlReturned && this.skippable) this.cinematic.skip();
  }

  private finishInsertion(): void {
    const c = this.cinematic;
    if (!c) return;
    saves.data.seenInsertion[this.def.id] = true;
    void saves.save();
    telemetry.log('insertion_done', { skipped: c.seq.wasSkipped });
    this.checkpoint = { x: this.player.x, y: this.player.feetY };
    this.player.lastSafe = { ...this.checkpoint };
    input.flush();
  }

  // ---------------------------------------------------------------- detail (PERF-01)

  private updateDetail(delta: number): void {
    // Gameplay frames only: not the insertion cinematic, hit-stop or end-of-run screens
    // (the scene doesn't update at all while paused).
    const playing =
      this.status === 'playing' &&
      this.hitStopMs <= 0 &&
      (!this.cinematic || this.cinematic.controlReturned);
    const auto = playing ? this.autoDetail.addFrame(delta) : this.autoDetail.decision;
    const setting = FLAGS.detail ?? saves.data.settings.detail;
    const level = resolveDetail(saves.data.settings.detail, FLAGS.detail, auto);
    if (level !== this.detail) this.applyDetail(level);
    if (setting === 'auto' && auto === 'low' && !autoNoticeShown) {
      autoNoticeShown = true;
      this.game.events.emit(HUD_EVENTS.notice, 'Detail lowered');
      this.detailNotices++;
    }
  }

  /** Low hides the bg-mid/bg-near parallax, water light shafts, grass tufts and shadows. */
  private applyDetail(level: DetailLevel): void {
    const high = level === 'high';
    if (this.detail !== null)
      telemetry.log('detail_change', { level, fps: this.autoDetail.medianFps });
    this.detail = level;
    for (const p of this.parallax) if (p.key !== 'stage-sky') p.strip.setVisible(high);
    this.waterView.setShafts(high);
    this.foliage.setVisible(high);
    this.fx.shadows = high;
  }

  // ---------------------------------------------------------------- frame loop

  override update(_time: number, delta: number): void {
    this.fps.addFrame(delta);
    this.updateDetail(delta);
    input.update();

    if (this.hitStopMs > 0) {
      this.hitStopMs -= delta;
      this.fixed.reset();
    } else {
      this.fixed.advance(delta, (dt) => this.tick(dt));
    }

    const view = this.cameras.main.worldView;
    this.player.syncVisuals(delta, this.settings.flashing);
    const visWorld: EnemyVisualWorld = {
      platforms: this.live,
      water: this.def.water,
      fx: this.fx,
    };
    for (const e of this.enemies) e.syncVisual(delta, visWorld);
    this.updateFallen(delta);
    this.fx.update(delta);
    this.tracers.draw();
    this.waterView.update(delta, view, this.player.submerged);
    this.foliage.update(delta, view, this.player.x, this.player.feetY);
    this.cinematic?.render(delta, view);
    if (this.cinematic?.finished) this.cinematic = null;
    for (const pa of this.pontoonArt) {
      pa.phase += delta / 1000;
      pa.img.y = pa.baseY + Math.sin(pa.phase * 1.8) * 0.7;
    }

    this.camRig.focusX =
      this.cinematic && !this.cinematic.controlReturned ? this.cinematic.frame.cameraX : null;
    this.camRig.update(delta, this.cameraSubject());
    const cam = this.cameras.main;
    for (const l of this.parallax) {
      l.strip.setOffset(cam.scrollX * l.fx);
      for (const img of l.strip.objects) img.y = l.y - cam.scrollY * l.fy;
    }

    this.writeHud();
    this.exposeState();
  }

  private cameraSubject() {
    const p = this.player;
    return { x: p.x, feetY: p.feetY, facing: p.facing, grounded: p.grounded, inWater: p.inWater };
  }

  private tick(dt: number): void {
    const inp = input.consume();
    if (inp.pausePressed && this.status === 'playing') {
      this.openPause();
      return;
    }
    if (this.status === 'squadDown') {
      if ((inp.jumpPressed || inp.confirmPressed) && this.time.now >= this.retryReadyAt)
        this.retry();
      this.stepPhysics(dt);
      this.player.stepAnim(dt);
      return;
    }
    if (this.status === 'clear') {
      this.stepPhysics(dt);
      this.player.stepAnim(dt);
      return;
    }

    // opening cinematic: the player watches (or skips, after the first viewing)
    const c = this.cinematic;
    if (c && !c.controlReturned) {
      if (this.skippable && (inp.jumpPressed || inp.confirmPressed || inp.firePressed)) c.skip();
      c.step(dt);
      this.stepPhysics(dt);
      this.player.stepAnim(dt);
      if (c.controlReturned) this.finishInsertion();
      return;
    }
    c?.step(dt);

    this.timeMs += dt;
    this.squad.tick(dt);

    if (inp.swapPressed) this.doSwap();
    if (inp.weaponPressed) this.switchWeapon();
    if (inp.slotPressed >= 0) this.selectSlot(inp.slotPressed);
    if (inp.reloadPressed && this.player.arsenal?.startReload()) sfx.reload();

    const p = this.player;
    const fireHeld = inp.fireHeld || inp.firePressed || this.autoFireWanted();
    p.stepMovement(dt, inp);
    this.onWaterState();
    this.breathe(dt);
    this.stepEntryAttacks(dt);
    if (fireHeld && p.slideMs <= 0 && !p.climbing) this.tryFire(inp);
    if (p.arsenal?.tick(dt, fireHeld)) sfx.reloadDone();

    this.telegraph.clear();
    const ctx = this.enemyContext();
    for (const e of this.enemies) e.step(dt, ctx);
    this.launchPods();
    this.tracers.steer(
      dt,
      this.enemies.filter((e) => !e.dead && e.kind !== 'pod').map((e) => ({ x: e.x, y: e.y - 3 })),
    );

    this.stepPhysics(dt);

    const view = this.cameras.main.worldView;
    const splash = (x: number, y: number) => this.fx.splash(x, SURFACE_Y, 0.08 + (y - y));
    this.pBullets.step(dt, view, this.def.water, splash, 32, (b) => this.detonate(b));
    this.eBullets.step(dt, view, this.def.water, splash);
    this.stepGrenades(dt);
    this.stepPickups(dt);
    this.bridges.step(this.timeMs, p);
    p.stepAnim(dt);

    if (p.pounding && p.grounded) this.shockwave();

    this.checkCaches();
    this.checkFallout();
    this.checkCheckpoints();
    this.checkArenas();
    this.checkGoal();
  }

  /** Physics advance exactly one fixed step, then sync bodies back to their sprites. */
  private stepPhysics(dt: number): void {
    this.physics.world.update(this.time.now, dt);
    this.physics.world.postUpdate();
  }

  // ---------------------------------------------------------------- water and air

  /** Going under or surfacing: weapons adapt (the LMG can't fire underwater). */
  private onWaterState(): void {
    const p = this.player;
    if (p.submerged === this.wasSubmerged) return;
    this.wasSubmerged = p.submerged;
    const a = p.arsenal;
    if (a?.adaptToWater(p.submerged)) {
      p.syncWeapon();
      sfx.weaponSwitch();
      if (p.submerged)
        this.game.events.emit(
          HUD_EVENTS.callout,
          `${a.current.short} · underwater`,
          COLORS.uiAccent,
        );
    }
    if (!p.submerged && this.squad.oxygenFrac < TUNING.oxygen.lowFrac) sfx.gasp();
  }

  private breathe(dt: number): void {
    const p = this.player;
    const hits = this.squad.breathe(dt, p.submerged);
    if (p.submerged && this.squad.oxygenFrac < TUNING.oxygen.lowFrac) sfx.airWarning();
    if (hits <= 0 || this.status !== 'playing') return;
    // drowning ignores hit invulnerability, but never knocks you about
    const r = this.squad.damage(TUNING.oxygen.drownDamage * hits);
    p.flinch();
    p.rig.flash(80);
    sfx.hurt();
    this.fx.bubbles(p.x, p.y - 6, 8);
    if (r.downed) this.operatorDown('drown');
  }

  // ---------------------------------------------------------------- combat

  private touchActive(): boolean {
    return input.lastSource === 'touch';
  }

  private autoFireWanted(): boolean {
    if (!this.settings.autoFire || !this.touchActive()) return false;
    const r2 = TUNING.autoFireRange ** 2;
    return this.enemies.some(
      (e) =>
        !e.dead &&
        (e.x - this.player.x) ** 2 + (e.y - this.player.y) ** 2 < r2 &&
        e.isOnScreen(this.cameras.main.worldView),
    );
  }

  private aimDirection(): Vec {
    const p = this.player;
    if (!this.settings.aimAssist || !this.touchActive()) return p.aim.dir;
    const targets = this.enemies
      .filter((e) => !e.dead && e.isOnScreen(this.cameras.main.worldView))
      .map((e) => ({ x: e.x, y: e.y - 3 }));
    return assistAim(
      { x: p.x, y: p.y },
      p.aim,
      p.facing,
      targets,
      TUNING.aimAssistRange,
      TUNING.aimAssistConeDeg,
    );
  }

  private tryFire(inp: InputFrame): void {
    const p = this.player;
    const a = p.arsenal;
    if (!a) return;
    const check = a.canFire(p.submerged);
    if (check === 'blockedUnderwater') {
      if (inp.firePressed) sfx.dryFire();
      return;
    }
    if (check !== 'ok') return;
    const w = a.current;
    const stats = shotStats(w, p.submerged);
    if (!stats) return;
    const dir = this.aimDirection();
    if (dir !== p.aim.dir) p.aim = { ...p.aim, dir };
    const base = Math.atan2(dir.y, dir.x);
    const m = p.muzzle(dir);
    // a pull fires one round, or a fan of pellets spread evenly
    const pellets = w.pellets ?? 1;
    const fan = Phaser.Math.DegToRad(w.pelletSpreadDeg ?? 0);
    for (let k = 0; k < pellets; k++) {
      const spread =
        pellets > 1
          ? -fan / 2 + (fan * k) / (pellets - 1)
          : Phaser.Math.DegToRad((Math.random() * 2 - 1) * w.spreadDeg);
      const angle = base + spread;
      this.pBullets.fire({
        x: m.x,
        y: m.y,
        dirX: Math.cos(angle),
        dirY: Math.sin(angle),
        speed: stats.speed,
        damage: stats.damage,
        pierce: w.pierce,
        lifeMs: TUNING.bulletLifeMs * stats.lifeScale * (w.homing ? 2.2 : 1),
        length: w.bulletLength,
        tint: w.tint,
        wet: p.submerged,
        waterproof: w.underwater === 'full',
        homing: w.homing,
        blast: w.blast ?? null,
        trail: w.trail,
        texture: w.id === 'hornet' ? 'rocket' : undefined,
      });
    }
    this.lastMuzzleY = m.y;
    a.fire();
    p.noteShot();
    p.recoil(w.recoil);
    this.fx.muzzle(m.x, m.y, base, 0.7 + w.recoil * 0.25, p.submerged, w.tint ?? 0xffffff);
    if (w.ejectsCasings && !p.submerged) {
      const port = p.ejectionPort(dir);
      this.fx.casing(port.x, port.y, p.facing);
    }
    if (w.homing) sfx.rocket();
    else sfx.shoot(w.pitch);
    if (a.current.id !== w.id) {
      // the pickup weapon ran dry and was dropped
      p.syncWeapon();
      sfx.weaponSwitch();
      this.game.events.emit(HUD_EVENTS.callout, `${w.short} empty`, COLORS.uiAccent);
    } else if (a.reloading) sfx.reload();
  }

  private selectSlot(slot: number): void {
    const p = this.player;
    if (!p.arsenal?.select(slot)) return;
    p.syncWeapon();
    sfx.weaponSwitch();
  }

  private switchWeapon(): void {
    const p = this.player;
    const a = p.arsenal;
    if (!a || a.ids.length < 2) return;
    a.switchNext();
    p.syncWeapon();
    sfx.weaponSwitch();
  }

  private killBullet(pool: BulletPool, b: Bullet): void {
    if (!b.active) return;
    if (b.blast && pool === this.pBullets) this.detonate(b);
    else pool.kill(b);
  }

  // ---------------------------------------------------------------- grenades, pods, pickups

  private stepGrenades(dt: number): void {
    for (const g of this.grenades.live) {
      if (g.step(dt, pointInWater(g.x, g.y, this.def.water))) {
        const { x, y } = g;
        g.defuse();
        this.explode(x, y, 26, 1, null, { enemyDamage: 0 });
      } else if (g.y > this.def.height + 40) g.defuse();
    }
  }

  /** Supply pods launch from the left edge of the view as the player passes their marks. */
  private launchPods(): void {
    const next = this.podQueue[0];
    if (!next || this.player.x < next.triggerX) return;
    this.podQueue.shift();
    const view = this.cameras.main.worldView;
    this.enemies.push(new SupplyPod(this, view.x - 14, next.y, next.give));
  }

  private stepPickups(dt: number): void {
    const p = this.player;
    this.pickups = this.pickups.filter((k) => {
      if (!k.step(dt, this.live, this.def.water)) {
        k.destroy();
        return false;
      }
      if (Math.abs(k.x - p.x) < 12 && Math.abs(k.y - p.y) < 16 && this.status === 'playing') {
        this.collect(k.kind);
        k.taken = true;
        k.destroy();
        return false;
      }
      return true;
    });
  }

  private collect(kind: PickupKind): void {
    const p = this.player;
    this.pickupsTaken++;
    if (kind === 'ammo') {
      for (const m of this.squad.members) if (!m.down) m.arsenal.addAmmo();
      sfx.pickup();
    } else {
      p.arsenal?.givePickup(kind, WEAPONS[kind].pickupAmmo);
      p.arsenal?.adaptToWater(p.submerged);
      p.syncWeapon();
      sfx.pickupWeapon();
    }
    this.fx.dust(p.x, p.y, 6, 0xffe39a);
    this.game.events.emit(HUD_EVENTS.callout, PICKUP_LABEL[kind], COLORS.goal);
    telemetry.log('pickup', { kind, t: Math.round(this.timeMs) });
  }

  private onBulletHitEnemy(b: Bullet, e: Enemy): void {
    if (!b.active || e.dead || b.hitTargets.has(e)) return;
    b.hitTargets.add(e);
    this.sparks.explode(4, b.x, b.y);
    sfx.hit();
    e.hit(b.damage);
    b.pierce--;
    if (b.blast) this.detonate(b);
    else if (b.pierce <= 0) this.pBullets.kill(b);
  }

  /** A player rocket goes off: blast damage to enemies, never to the player. */
  private detonate(b: Bullet): void {
    if (!b.active || !b.blast) return;
    const { radius, damage } = b.blast;
    this.pBullets.kill(b);
    this.explode(b.x, b.y, radius, 0, null, { hurtsPlayer: false, enemyDamage: damage });
  }

  private onBulletHitBreakable(b: Bullet, g: Grate | Barrel): void {
    if (!b.active || g.broken) return;
    if (b.blast) this.detonate(b);
    else this.pBullets.kill(b);
    this.sparks.explode(3, b.x, b.y);
    sfx.hit();
    if (g instanceof Barrel) {
      if (g.hit(b.damage)) this.blowBarrel(g);
      return;
    }
    if (g.hit(b.damage)) {
      this.debris.explode(16, g.x, g.y);
      this.fx.bubbles(g.x, g.y, 12);
      this.breakables.remove(g, true, true);
      sfx.explosion();
      this.game.events.emit(HUD_EVENTS.callout, 'Hidden route open', COLORS.goal);
      telemetry.log('secret_route', { t: Math.round(this.timeMs) });
    }
  }

  private onEnemyDied(e: Enemy): void {
    if (!(e instanceof Mine)) {
      this.debris.explode(14, e.x, e.y);
      sfx.enemyDie();
    }
    this.hitStop(TUNING.hitStopKillMs);
    this.shake(TUNING.shakeKill);
    for (const a of this.arenas) {
      if (a.started && !a.done && a.enemies.has(e)) {
        a.enemies.delete(e);
        if (a.enemies.size === 0) this.endArena(a);
      }
    }
  }

  private blowBarrel(barrel: Barrel): void {
    barrel.broken = true;
    const { x, y } = barrel;
    this.breakables.remove(barrel, true, true);
    this.explode(x, y, 34, 1, null, { enemyDamage: 5 });
  }

  /**
   * Every explosion goes through here (mines, grenades, barrels, rockets, bridges, turrets):
   * effects, player damage (a blast ignores hit invulnerability), enemy damage, and chain
   * reactions in nearby barrels.
   */
  private explode(
    x: number,
    y: number,
    radius: number,
    damage: number,
    source: Enemy | null,
    opts: { hurtsPlayer?: boolean; enemyDamage?: number } = {},
  ): void {
    const wet = pointInWater(x, y, this.def.water);
    this.debris.explode(Math.round(8 + radius * 0.4), x, y);
    this.fx.explosion(x, y, radius, wet);
    if (wet) this.fx.splash(x, SURFACE_Y, 0.9);
    sfx.explosion();
    this.shake(radius > 20 ? TUNING.shakePound : TUNING.shakeKill);
    if (this.settings.flashing && radius > 20) this.cameras.main.flash(70, 255, 200, 150);
    const p = this.player;
    if ((opts.hurtsPlayer ?? true) && damage > 0 && Math.hypot(p.x - x, p.y - y) < radius + 6) {
      p.invulnMs = 0; // a blast always lands
      this.hurtPlayer(damage, x);
    }
    const enemyDamage = opts.enemyDamage ?? 3;
    if (enemyDamage > 0) {
      for (const e of this.enemies) {
        if (e === source || e.dead) continue;
        if (Math.hypot(e.x - x, e.y - y) < radius) e.hit(enemyDamage);
      }
    }
    // chain reaction: nearby barrels go up a moment later
    for (const b of this.barrels) {
      if (b.broken || Math.hypot(b.x - x, b.y - y) > radius + 8) continue;
      if (b.hit(3)) this.time.delayedCall(120, () => this.blowBarrel(b));
    }
  }

  private enemyContext(): EnemyContext {
    const p = this.player;
    return {
      target: { x: p.x, y: p.y },
      targetInWater: p.inWater,
      targetSubmerged: p.submerged,
      water: this.def.water,
      view: this.cameras.main.worldView,
      flashing: this.settings.flashing,
      telegraph: this.telegraph,
      fireEnemyBullet: (x, y, dirX, dirY, speed) =>
        this.eBullets.fire({ x, y, dirX, dirY, speed, damage: 1, pierce: 1, lifeMs: 2400 }),
      explode: (x, y, radius, damage, source) => this.explode(x, y, radius, damage, source),
      throwGrenade: (x, y, vx, vy) => {
        this.grenades.throw(x, y, vx, vy);
      },
      canSee: (ax, ay, bx, by) => !segmentBlocked(this.solidRects, ax, ay, bx, by),
      groundAt: (x, fromY) => groundBelow(this.live, x, fromY, 60),
      onEngage: () => {
        if (this.firstFightLogged) return;
        this.firstFightLogged = true;
        telemetry.log('first_fight', { msSinceStart: Math.round(this.timeMs) });
      },
    };
  }

  private hurtPlayer(amount: number, fromX?: number): void {
    const p = this.player;
    if (this.status !== 'playing' || p.invulnMs > 0 || p.climbing) return;
    if (this.cinematic && !this.cinematic.controlReturned) return;
    const r = this.squad.damage(amount);
    sfx.hurt();
    this.hitStop(TUNING.hitStopHurtMs);
    this.shake(TUNING.shakeHurt);
    if (this.settings.flashing) this.cameras.main.flash(90, 255, 70, 50);
    if (r.downed) {
      this.operatorDown('hp');
      return;
    }
    p.knockback(fromX ?? p.x - p.facing);
    p.invulnMs = TUNING.hurtInvulnMs;
  }

  // ---------------------------------------------------------------- relay swap

  private tagIn(to: OperatorDef): void {
    const p = this.player;
    const m = this.squad.active;
    p.setOperator(to, m.arsenal);
    m.arsenal.adaptToWater(p.submerged);
    p.syncWeapon();
    this.wasSubmerged = p.submerged;
  }

  private doSwap(): void {
    const from = this.squad.active.def;
    if (this.squad.swap() === null) return;
    const to = this.squad.active.def;
    this.tagIn(to);
    this.player.invulnMs = Math.max(this.player.invulnMs, TUNING.tagInInvulnMs);
    this.startEntry(to.entry);
    this.tagRing(to.color);
    sfx.swap();
    this.game.events.emit(HUD_EVENTS.callout, `${to.name} in · ${to.entryLabel}`, to.color);
    telemetry.log('swap', {
      from: from.id,
      to: to.id,
      fromHp: this.squad.members.find((m) => m.def.id === from.id)?.hp,
      x: Math.round(this.player.x),
      t: Math.round(this.timeMs),
    });
  }

  private startEntry(kind: EntryAttack): void {
    const p = this.player;
    switch (kind) {
      case 'slide':
        if (p.inWater) break;
        p.slideMs = TUNING.slideMs;
        p.slideShotsLeft = TUNING.slideShots;
        p.slideShotTimer = 0;
        break;
      case 'pound':
        if (p.inWater) break;
        if (p.grounded) this.shockwave();
        else p.pounding = true;
        break;
      case 'pierce': {
        const dir = this.aimDirection();
        const m = p.muzzle(dir);
        const s = TUNING.pierceShot;
        this.pBullets.fire({
          x: m.x,
          y: m.y,
          dirX: dir.x,
          dirY: dir.y,
          speed: s.speed,
          damage: s.damage,
          pierce: s.pierce,
          lifeMs: TUNING.bulletLifeMs,
          length: s.length,
          tint: 0xd9ffd0,
          waterproof: true,
        });
        this.fx.muzzle(m.x, m.y, Math.atan2(dir.y, dir.x), 1.4, p.submerged, 0xd9ffd0);
        sfx.shoot(1600);
        break;
      }
      case 'surge':
        p.surgeMs = 240;
        this.surgeHits.clear();
        break;
    }
  }

  private stepEntryAttacks(dt: number): void {
    const p = this.player;
    if (p.slideMs > 0 && p.slideShotsLeft > 0) {
      p.slideShotTimer -= dt;
      if (p.slideShotTimer <= 0 && p.arsenal) {
        const w = p.arsenal.current;
        const m = p.muzzle({ x: p.facing, y: 0 });
        this.pBullets.fire({
          x: m.x,
          y: m.y,
          dirX: p.facing,
          dirY: 0,
          speed: w.bulletSpeed,
          damage: w.damage,
          pierce: 1,
          lifeMs: TUNING.bulletLifeMs,
          length: w.bulletLength,
        });
        this.fx.muzzle(m.x, m.y, p.facing > 0 ? 0 : Math.PI, 0.9, false);
        sfx.shoot(w.pitch);
        p.slideShotsLeft--;
        p.slideShotTimer = TUNING.slideShotGapMs;
      }
    }
    // Tari's surge rams through enemies in the way
    if (p.surgeMs > 0) {
      for (const e of this.enemies) {
        if (e.dead || this.surgeHits.has(e)) continue;
        if (Math.abs(e.x - p.x) < 12 && Math.abs(e.y - p.y) < 14) {
          this.surgeHits.add(e);
          if (!e.hit(2)) e.stun(700);
          this.sparks.explode(5, e.x, e.y);
        }
      }
    }
  }

  private shockwave(): void {
    const p = this.player;
    p.pounding = false;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (
        Math.abs(e.x - p.x) <= TUNING.poundRangeX &&
        Math.abs(e.feetY - p.feetY) <= TUNING.poundRangeY
      ) {
        const killed = e.hit(TUNING.poundDamage);
        if (!killed) e.stun(TUNING.poundStunMs);
      }
    }
    const ring = this.add
      .ellipse(p.x, p.feetY - 2, 10, 4)
      .setStrokeStyle(2, 0x9fd0ff)
      .setDepth(DEPTH.fx);
    this.tweens.add({
      targets: ring,
      scaleX: 15,
      scaleY: 4,
      alpha: 0,
      duration: 260,
      onComplete: () => ring.destroy(),
    });
    this.fx.dust(p.x - 10, p.feetY, 6);
    this.fx.dust(p.x + 10, p.feetY, 6);
    this.shake(TUNING.shakePound);
    sfx.pound();
  }

  private tagRing(color: number): void {
    const ring = this.add
      .circle(this.player.x, this.player.y, 6)
      .setStrokeStyle(2, color)
      .setDepth(DEPTH.fx);
    this.tweens.add({
      targets: ring,
      scale: 4,
      alpha: 0,
      duration: 260,
      onComplete: () => ring.destroy(),
    });
  }

  /** Leave the downed operator's body behind, playing its death fall (sinks or floats in water). */
  private spawnFallen(def: OperatorDef): void {
    const p = this.player;
    const rig = new Rig(this, def.rig, p.arsenal?.current.id ?? def.weapons[0], DEPTH.player - 1);
    this.fallen.push({
      rig,
      x: p.x,
      y: p.feetY,
      vy: p.inWater ? 0 : -90,
      ms: 0,
      wet: p.inWater,
      facing: p.facing,
    });
  }

  private updateFallen(frameMs: number): void {
    const dt = frameMs / 1000;
    this.fallen = this.fallen.filter((f) => {
      f.ms += frameMs;
      if (f.wet) {
        f.y = Math.max(SURFACE_Y + 6, f.y - 14 * dt); // drifts up towards the surface
      } else {
        f.vy += 600 * dt;
        f.x -= f.facing * 30 * dt * Math.max(0, 1 - f.ms / 500);
        const floor = groundBelow(this.live, f.x, f.y - 1, 300) ?? f.y;
        f.y = Math.min(floor, f.y + f.vy * dt);
      }
      f.rig.update(
        frameMs,
        {
          state: 'dead',
          stateMs: f.ms,
          vx: 0,
          vy: 0,
          runSpeed: 100,
          aim: { x: f.facing, y: 0.3 },
          facing: f.facing,
          armReady: true,
          reload: null,
          swimDir: { x: 0, y: 0 },
        },
        f.x,
        f.y,
      );
      if (f.wet) f.rig.setTint(0x9fc6d6);
      f.rig.setAlpha(f.ms < 900 ? 1 : Math.max(0, 1 - (f.ms - 900) / 500));
      if (f.ms > 1400) {
        f.rig.destroy();
        return false;
      }
      return true;
    });
  }

  private operatorDown(cause: 'hp' | 'pit' | 'drown'): void {
    const p = this.player;
    const from = this.squad.active.def;
    const outcome = this.squad.activeDown();
    sfx.down();
    this.debris.explode(10, p.x, p.y);
    telemetry.log('operator_down', {
      operator: from.id,
      cause,
      x: Math.round(p.x),
      t: Math.round(this.timeMs),
    });

    if (outcome.kind === 'allDown') {
      this.squadDown();
      return;
    }
    this.spawnFallen(from);
    if (outcome.kind === 'swapped') {
      const to = this.squad.active.def;
      this.tagIn(to);
      this.tagRing(to.color);
      this.game.events.emit(HUD_EVENTS.callout, `${from.name} down · ${to.name} in`, to.color);
    } else {
      this.tagIn(from);
      this.game.events.emit(HUD_EVENTS.callout, `Lives left: ${outcome.livesLeft}`, from.color);
    }
    if (cause === 'pit') this.respawnAtSafeSpot();
    p.invulnMs = TUNING.downInvulnMs;
  }

  private squadDown(): void {
    const p = this.player;
    this.status = 'squadDown';
    p.dead = true;
    p.arcadeBody.setVelocityX(0);
    // underwater the body just hangs where it is (swim physics stop with the squad)
    if (p.inWater) p.arcadeBody.setVelocityY(0);
    this.eBullets.clear();
    this.retryReadyAt = this.time.now + 900;
    telemetry.log('all_down', { x: Math.round(p.x), t: Math.round(this.timeMs) });
  }

  private tryRetry(): void {
    if (this.status === 'squadDown' && this.time.now >= this.retryReadyAt) this.retry();
  }

  private retry(): void {
    this.continues++;
    this.squad.reviveAll();
    const p = this.player;
    // an unfinished arena resets so it can trigger again
    for (const a of this.arenas) {
      if (a.started && !a.done) {
        a.enemies.forEach((e) => e.despawn());
        a.enemies.clear();
        this.removeArenaWalls(a);
        a.started = false;
      }
    }
    this.tagIn(this.squad.active.def);
    p.shown = true;
    p.respawnAt(this.checkpoint.x, this.checkpoint.y);
    p.invulnMs = TUNING.downInvulnMs;
    this.wasSubmerged = false;
    this.camRig.setBounds(0, 0, this.def.width, this.def.height);
    this.camRig.snap(this.cameraSubject());
    this.status = 'playing';
    input.flush();
    telemetry.log('retry', { continues: this.continues });
  }

  // ---------------------------------------------------------------- stage events

  /** Safety net: anything that falls out of the world is put back at the last safe ledge. */
  private checkFallout(): void {
    const p = this.player;
    if (this.status !== 'playing' || p.y < this.def.height + 16) return;
    const r = this.squad.damage(TUNING.pitDamage);
    sfx.hurt();
    if (r.downed) this.operatorDown('pit');
    else {
      this.respawnAtSafeSpot();
      p.invulnMs = TUNING.hurtInvulnMs;
    }
  }

  private respawnAtSafeSpot(): void {
    const p = this.player;
    const spot = this.safeSpot(p.lastSafe.x, p.lastSafe.y);
    p.respawnAt(spot.x, spot.y);
  }

  /** The nearest standing position on the platform the player last stood on. */
  private safeSpot(x: number, feetY: number): { x: number; y: number } {
    let best: PlatformDef | null = null;
    let bestGap = 32;
    for (const pl of this.live) {
      if (Math.abs(pl.y - feetY) >= 6) continue;
      const gap = x < pl.x ? pl.x - x : x > pl.x + pl.w ? x - (pl.x + pl.w) : 0;
      if (gap <= bestGap) {
        bestGap = gap;
        best = pl;
      }
    }
    if (!best) return { ...this.checkpoint };
    return { x: Phaser.Math.Clamp(x, best.x + 12, best.x + best.w - 12), y: best.y };
  }

  private checkCaches(): void {
    const p = this.player;
    for (const c of this.caches) {
      if (c.taken || Math.abs(c.x - p.x) > 16 || Math.abs(c.y - p.feetY) > 16) continue;
      c.taken = true;
      c.setVisible(false);
      this.secrets++;
      for (const m of this.squad.members) {
        if (m.down) continue;
        m.oxygenMs = m.def.swim.oxygenMs;
        m.armour = Math.min(m.def.maxArmour, m.armour + 1);
        m.arsenal.refill();
      }
      this.fx.bubbles(c.x, c.y - 6, 10);
      sfx.pickup();
      this.game.events.emit(HUD_EVENTS.callout, 'Supply cache · air, armour, ammo', COLORS.goal);
      telemetry.log('secret_found', { t: Math.round(this.timeMs) });
    }
  }

  private checkCheckpoints(): void {
    for (const cp of this.checkpoints) {
      if (cp.reached || this.player.x < cp.x || this.player.inWater) continue;
      cp.reached = true;
      cp.flag.setTexture('prop-checkpoint-on');
      this.tweens.add({
        targets: cp.flag,
        scaleY: { from: 1.25 / FX_RES, to: 1 / FX_RES },
        duration: 260,
        ease: 'Back.easeOut',
      });
      this.checkpoint = { x: cp.x, y: cp.y };
      sfx.checkpoint();
      this.game.events.emit(HUD_EVENTS.callout, 'Checkpoint', COLORS.checkpointOn);
      telemetry.log('checkpoint', { x: cp.x, t: Math.round(this.timeMs) });
    }
  }

  private checkArenas(): void {
    for (const a of this.arenas) {
      if (a.started || a.done || this.player.x < a.def.triggerX) continue;
      a.started = true;
      for (const x of [a.def.left - 4, a.def.right + 4]) {
        const wall = this.add.rectangle(
          x,
          this.def.height / 2,
          8,
          this.def.height * 2,
          0x000000,
          0,
        );
        this.physics.add.existing(wall, true);
        this.solids.add(wall);
        a.walls.push(wall);
      }
      this.camRig.setBounds(a.def.left, 0, a.def.right - a.def.left, this.def.height);
      a.def.spawns.forEach((s) => a.enemies.add(this.spawnEnemy(s)));
      this.game.events.emit(HUD_EVENTS.callout, 'Ambush · clear the area', COLORS.danger);
      telemetry.log('arena_start', { x: a.def.triggerX, t: Math.round(this.timeMs) });
    }
  }

  private endArena(a: ArenaRuntime): void {
    a.done = true;
    this.removeArenaWalls(a);
    this.camRig.setBounds(0, 0, this.def.width, this.def.height);
    this.game.events.emit(HUD_EVENTS.callout, 'Area clear', COLORS.checkpointOn);
    telemetry.log('arena_clear', { t: Math.round(this.timeMs) });
  }

  private removeArenaWalls(a: ArenaRuntime): void {
    a.walls.forEach((w) => {
      this.solids.remove(w, true, true);
    });
    a.walls = [];
  }

  private checkGoal(): void {
    if (this.status !== 'playing' || this.player.x < this.def.goal.x) return;
    this.status = 'clear';
    this.player.arcadeBody.setVelocityX(0);
    this.player.victory = true;
    sfx.clear();
    const rank = computeRank({
      timeMs: this.timeMs,
      downs: this.squad.downs,
      continues: this.continues,
      parTimeMs: this.def.parTimeMs,
    });
    const prev = saves.data.bestByStage[this.def.id];
    const run = { rank, timeMs: Math.round(this.timeMs), at: new Date().toISOString() };
    const newBest = isBetterRun(run, prev);
    if (newBest) saves.data.bestByStage[this.def.id] = run;
    saves.data.stats.runsCleared++;
    void saves.save();
    telemetry.log('stage_clear', {
      stage: this.def.id,
      mode: this.mode,
      timeMs: run.timeMs,
      rank,
      downs: this.squad.downs,
      swaps: this.squad.swaps,
      continues: this.continues,
      secrets: this.secrets,
      fps: this.fps.summary(),
    });
    const data: ResultsData = {
      stageId: this.def.id,
      stageName: this.def.name,
      mode: this.mode,
      timeMs: run.timeMs,
      downs: this.squad.downs,
      swaps: this.squad.swaps,
      continues: this.continues,
      rank,
      newBest,
      bestTimeMs: (newBest ? run : prev)?.timeMs ?? run.timeMs,
      secrets: this.secrets,
      squad: this.squad.members.map((m) => m.def.id),
    };
    this.time.delayedCall(1800, () => {
      this.scene.stop(SCENES.hud);
      this.scene.start(SCENES.results, data);
    });
  }

  // ---------------------------------------------------------------- feedback, pause, HUD

  private hitStop(ms: number): void {
    this.hitStopMs = Math.max(this.hitStopMs, ms);
  }

  private shake(s: { durationMs: number; intensity: number }): void {
    if (this.settings.screenShake) this.cameras.main.shake(s.durationMs, s.intensity);
  }

  private onHidden(): void {
    if (this.scene.isActive() && this.status === 'playing') this.openPause();
  }

  private openPause(): void {
    sfx.setRotor(0);
    this.scene.pause();
    this.scene.pause(SCENES.hud);
    this.scene.launch(SCENES.pause, { mode: this.mode });
    this.scene.bringToTop(SCENES.pause);
  }

  private writeHud(): void {
    const s = this.squad;
    const next = s.nextStanding();
    const p = this.player;
    hud.running = true;
    hud.mode = this.mode;
    hud.members = s.members.map((m, i) => ({
      id: m.def.id,
      name: m.def.name,
      role: m.def.role,
      color: m.def.color,
      hp: m.hp,
      maxHp: m.def.maxHp,
      armour: m.armour,
      maxArmour: m.def.maxArmour,
      down: m.down,
      active: i === s.activeIndex,
      oxygen: m.oxygenMs / m.def.swim.oxygenMs,
    }));
    hud.livesLeft = s.livesLeft;
    hud.swapReady = s.canSwap();
    hud.swapCooldownFrac = s.swapCooldownLeft / TUNING.swapCooldownMs;
    hud.nextName = next >= 0 ? (s.members[next]?.def.name ?? '') : '';
    hud.timeMs = this.timeMs;
    hud.status = this.status;
    hud.showRetry = this.status === 'squadDown' && this.time.now >= this.retryReadyAt;
    hud.fps = this.settings.showFps || FLAGS.debug ? this.fps.summary() : null;
    const a = p.arsenal;
    hud.weapon = a
      ? {
          name: a.current.name,
          short: a.current.short,
          mag: a.mag,
          magSize: a.current.magSize,
          reload: a.reloadProgress,
          blocked: p.submerged && a.current.underwater === 'none',
          other: a.ids.length > 1 ? (a.ids[(a.index + 1) % a.ids.length] ?? '') : '',
          slots: a.ids.map((id, i) => ({
            short: WEAPONS[id].short,
            active: i === a.index,
            ammo: i === 2 ? a.pickupAmmo : null,
          })),
          dashReady: 1 - p.dashCooldownMs / TUNING.dashCooldownMs,
        }
      : null;
    hud.oxygen = s.oxygenFrac;
    hud.showOxygen = p.submerged || s.oxygenFrac < 0.999;
    hud.secrets = this.secrets;
    const c = this.cinematic;
    const ins = this.def.insertion;
    if (c && ins) {
      const f = c.frame;
      hud.cinematic = {
        active: !f.controlReturned || f.letterbox > 0,
        letterbox: f.letterbox,
        title: ins.title,
        subtitle: ins.subtitle,
        titleAlpha: f.title,
        skippable: this.skippable && !f.controlReturned,
      };
    } else {
      hud.cinematic.active = false;
    }
  }

  /** Read-only state for automated smoke tests. */
  private exposeState(): void {
    if (!window.__hotRelay) return;
    const p = this.player;
    const a = p.arsenal;
    window.__hotRelay.state = {
      scene: 'stage',
      status: this.status,
      x: Math.round(p.x),
      y: Math.round(p.y),
      feetY: Math.round(p.feetY),
      active: this.squad.active.def.id,
      squad: this.squad.members.map((m) => m.def.id),
      swaps: this.squad.swaps,
      downs: this.squad.downs,
      enemiesAlive: this.enemies.filter((e) => !e.dead).length,
      arenaLive: this.arenas.reduce((n, a) => n + (a.started && !a.done ? a.enemies.size : 0), 0),
      bullets: this.pBullets.countActive() + this.eBullets.countActive(),
      timeMs: Math.round(this.timeMs),
      ground: p.groundKind,
      grounded: p.grounded,
      lastSafe: { x: Math.round(p.lastSafe.x), y: Math.round(p.lastSafe.y) },
      anim: p.animState,
      inWater: p.inWater,
      submerged: p.submerged,
      oxygen: Math.round(this.squad.oxygenFrac * 100) / 100,
      hp: this.squad.active.hp,
      weapon: a?.current.id ?? null,
      mag: a?.mag ?? 0,
      reloading: a?.reloading ?? false,
      insertion: this.cinematic ? this.cinematic.frame.phase : 'none',
      control: !this.cinematic || this.cinematic.controlReturned,
      secrets: this.secrets,
      fps: this.fps.summary(),
      detail: this.detail,
      autoDetail: this.autoDetail.decision,
      detailNotices: this.detailNotices,
      // combat moves and content (smoke tests)
      bodyH: Math.round(p.arcadeBody.height),
      bodyMode: p.bodyMode,
      prone: p.prone,
      flipping: p.flipping,
      dashing: p.dashing,
      dashCooldown: Math.round(p.dashCooldownMs),
      slot: a?.index ?? 0,
      weapons: a ? [...a.ids] : [],
      pickupAmmo: a?.pickupAmmo ?? null,
      lastMuzzleY: Math.round(this.lastMuzzleY * 10) / 10,
      grenades: this.grenades.live.length,
      bridgeCollapsed: this.bridges.collapsed,
      barrels: this.barrels.filter((b) => !b.broken).length,
      pickupsOut: this.pickups.length,
      pickupList: this.pickups.map((k) => ({
        x: Math.round(k.x),
        y: Math.round(k.y),
        kind: k.kind,
      })),
      standUpJumps: p.standUpJumps,
      pickupsTaken: this.pickupsTaken,
      kinds: this.enemies.reduce<Record<string, number>>((m, e) => {
        if (!e.dead) m[e.kind] = (m[e.kind] ?? 0) + 1;
        return m;
      }, {}),
    };
  }

  /** Debug hooks for smoke tests (?debug=1 only). */
  private exposeDebug(): void {
    if (!window.__hotRelay) return;
    window.__hotRelay.debug = {
      /** Feed the Auto-detail watcher synthetic frames (PERF-01 checks). */
      feedAutoDetail: (fps: number, ms: number) => {
        for (let t = 0; t < ms; t += 1000 / fps) this.autoDetail.addFrame(1000 / fps);
      },
      visibleByTexture: (keys: string[]) => {
        const out: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]));
        for (const o of this.children.list) {
          if (!(o instanceof Phaser.GameObjects.Image) || !o.visible) continue;
          const k = o.texture.key;
          if (k in out) out[k] = (out[k] ?? 0) + 1;
        }
        return out;
      },
      teleport: (x: number, feetY: number) => {
        this.player.respawnAt(x, feetY);
        this.camRig.snap(this.cameraSubject());
      },
      setInvulnerable: (ms: number) => {
        this.player.invulnMs = ms;
      },
      clearEnemies: () => this.enemies.forEach((e) => e.despawn()),
      givePickup: (kind: string) => {
        this.pickups.push(
          new Pickup(this, this.player.x + 20, this.player.y - 30, kind as PickupKind),
        );
      },
      scene: this,
    };
  }

  private toggleDebugDraw(): void {
    const world = this.physics.world;
    if (!world.debugGraphic) world.createDebugGraphic();
    world.drawDebug = !world.drawDebug;
    world.debugGraphic.setVisible(world.drawDebug);
  }
}
