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
import { CANVAS_H, CANVAS_W, COLORS, DEPTH, SCENES, VIEW_H } from '../config/constants';
import {
  ZOOM_MIN,
  approachZoom,
  nextZoom,
  screenOrigin,
  viewSize,
  zoomLabel,
} from '../systems/viewZoom';
import { TUNING } from '../config/tuning';
import { resolveSquad, type EntryAttack, type OperatorDef } from '../data/operators';
import { shotStats } from '../data/weapons';
import { GREYBOX_01 } from '../data/stages/greybox01';
import type { ArenaDef, PlatformDef, StageDef } from '../data/stages/types';
import { Player } from '../entities/Player';
import { Rifleman } from '../entities/Rifleman';
import { Enemy, type EnemyContext, type EnemyVisualWorld } from '../entities/Enemy';
import { Cache, EelDrone, Grate, Mine } from '../entities/Hazards';
import { Bullet, BulletPool } from '../entities/BulletPool';
import { Grenade, GrenadePool, Sentry } from '../entities/Gadgets';
import { Frogman, GateCore, Runner, SupplyDrone, Turret } from '../entities/Assault';
import { grantPickup, pelletAngles, PICKUPS, spendPickup, steer } from '../systems/pickups';
import type { BridgeDef, DroneDef, PickupKind, RunnerZone } from '../data/stages/types';
import { Rig } from '../entities/Rig';
import { FixedStep } from '../systems/FixedStep';
import { Squad, type SquadMode } from '../systems/Squad';
import { input, type InputFrame } from '../systems/InputManager';
import { assistAim, type Vec } from '../systems/aim';
import { sfx } from '../systems/Sfx';
import { telemetry } from '../systems/Telemetry';
import { playtest, saves } from '../systems/services';
import {
  currentDevice,
  dominantInput,
  swapsPerMinute,
  type InputKind,
  type RunOutcome,
} from '../systems/playtest';
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
  /** Playtest record of this run, for the end-of-stage survey. */
  runId: string | null;
}

const GROUND_Y = 240;
const SURFACE_Y = 252;

export class StageScene extends Phaser.Scene {
  private def: StageDef = GREYBOX_01;
  private mode: SquadMode = 'relay';
  private squadIds: string[] | undefined;
  private settings!: Settings;
  /** Current (eased) camera zoom; the target is settings.viewZoom (UI-11). */
  private zoom = 2;
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
  // playtest record of the current run (ANALYTICS-03)
  private firstFightMs: number | null = null;
  private section = 0;
  private downsBySection: number[] = [0];
  private inputMs: Partial<Record<InputKind, number>> = {};
  private replay = false;
  private runRecorded = false;
  private retryReadyAt = 0;
  private wasSubmerged = false;
  private surgeHits = new Set<Enemy>();
  // operators 5–8
  private sentry: Sentry | null = null;
  private grenades!: GrenadePool;
  /** KAI-7: armour hits absorbed towards the next counter-blast. */
  private absorbCharge = 0;
  // Contra-inspired set
  private runnerZones: { def: RunnerZone; timerMs: number; alive: Set<Enemy> }[] = [];
  private droneDefs: { def: DroneDef; spawned: boolean }[] = [];
  private crates!: Phaser.Physics.Arcade.Group;
  private bridges: {
    def: BridgeDef;
    segs: { rect: Phaser.GameObjects.Rectangle; img: Phaser.GameObjects.Image }[];
    armed: boolean;
    timerMs: number;
    next: number;
  }[] = [];
  private pickupCdMs = 0;
  private boss: {
    cannons: Turret[];
    core: GateCore;
    wall: Phaser.GameObjects.Rectangle;
    art: Phaser.GameObjects.Image;
    started: boolean;
    exposed: boolean;
    defeated: boolean;
    leftWall: Phaser.GameObjects.Rectangle | null;
    /** Keeps the player a step back from the gate (player only), so shots meet the core. */
    barrier: Phaser.GameObjects.Rectangle;
    runnerMs: number;
    runners: Set<Enemy>;
  } | null = null;

  constructor() {
    super(SCENES.stage);
  }

  init(data: { mode?: SquadMode; squad?: string[]; replay?: boolean }): void {
    this.mode = data.mode ?? FLAGS.mode;
    // a restart (pause menu) keeps the squad that was picked
    this.squadIds = data.squad ?? this.squadIds;
    this.def = GREYBOX_01;
    this.enemies = [];
    this.caches = [];
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
    this.firstFightMs = null;
    this.sentry = null;
    this.absorbCharge = 0;
    this.runnerZones = [];
    this.droneDefs = [];
    this.bridges = [];
    this.pickupCdMs = 0;
    this.boss = null;
    this.section = 0;
    this.downsBySection = [0];
    this.inputMs = {};
    this.replay = data.replay ?? false;
    this.runRecorded = false;
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

    this.buildBackground();
    this.fx = new Effects(this, this.def.platforms, this.def.water);
    this.buildLevel();
    this.waterView = new WaterView(this, this.def.water);
    this.foliage = new Foliage(this, this.def.tufts);

    const lead = this.squad.active;
    this.player = new Player(this, this.def.start.x, this.def.start.y, lead.def, {
      platforms: this.def.platforms,
      water: this.def.water,
      fx: this.fx,
    });
    this.player.setOperator(lead.def, lead.arsenal);
    this.player.setCollideWorldBounds(true);
    this.checkpoint = { ...this.def.start };

    this.def.enemies.forEach((e) => this.spawnRifleman(e.x, e.y));
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

    this.pBullets = new BulletPool(this, 'bullet-p', 90);
    this.eBullets = new BulletPool(this, 'bullet-e', 120);
    this.grenades = new GrenadePool(this);
    this.crates = this.physics.add.group({ allowGravity: true });
    this.buildAssault();
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
    this.zoom = this.settings.viewZoom;
    cam.setZoom(this.zoom);
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
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.onHidden, this);
    this.game.events.on(HUD_EVENTS.retry, this.tryRetry, this);
    this.game.events.on(HUD_EVENTS.skip, this.trySkip, this);
    // closing the tab mid-run still records the attempt (best effort)
    const onPageHide = () => this.endRun('quit');
    window.addEventListener('pagehide', onPageHide);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('pagehide', onPageHide);
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
    // Strips are wide enough for the widest view zoom; their left edge moves with the zoom.
    const ox = screenOrigin(this.settings.viewZoom, CANVAS_W, CANVAS_H).x;
    const oy = (CANVAS_H - VIEW_H) / 2;
    const stripW = viewSize(ZOOM_MIN, CANVAS_W, CANVAS_H).w;
    // Sky, sun and the far skyline are baked into one opaque tile: on fill-rate-limited
    // devices every full-screen layer costs, so the distant backdrop is drawn exactly once.
    this.bakeSky();
    const layer = (key: string, y: number, fx: number, fy: number) => {
      const strip = new ParallaxStrip(this, key, ox, oy + y, stripW, 1, {
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

    for (const p of this.def.platforms) this.addPlatform(p);
    // PLACEHOLDER painted art over the collision rectangles
    for (const art of paintStage(this, this.def, GROUND_Y, SURFACE_Y)) {
      const img = this.add
        .image(art.x, art.y, art.key)
        .setOrigin(0, 0)
        .setScale(1 / ART_RES)
        .setDepth(art.pontoon ? DEPTH.level + 1 : DEPTH.level);
      if (art.pontoon) this.pontoonArt.push({ img, baseY: art.y, phase: art.x * 0.05 });
    }

    for (const g of this.def.grates) this.breakables.add(new Grate(this, g.x, g.top, g.h));

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
    }
  }

  private spawnRifleman(x: number, feetY: number): Enemy {
    const e = new Rifleman(this, x, feetY, this.fx.makeShadow());
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
    this.physics.add.collider(this.enemies, this.breakables);
    // Arcade does not promise argument order when an array meets a group, so callbacks
    // identify each object by type instead of trusting position.
    const bulletOf = (a: unknown, b: unknown): Bullet => (a instanceof Bullet ? a : (b as Bullet));
    const enemyOf = (a: unknown, b: unknown): Enemy => (a instanceof Enemy ? a : (b as Enemy));
    const grateOf = (a: unknown, b: unknown): Grate => (a instanceof Grate ? a : (b as Grate));
    const otherOf = (a: unknown, b: unknown, known: unknown) => (a === known ? b : a);

    this.physics.add.collider(this.enemies, this.oneways, undefined, (a, b) => {
      const en = enemyOf(a, b);
      const plat = otherOf(a, b, en) as Phaser.GameObjects.Rectangle;
      return this.landsOnOneWay(en.arcadeBody, plat, true);
    });

    this.physics.add.overlap(this.pBullets.group, this.enemies, (a, b) =>
      this.onBulletHitEnemy(bulletOf(a, b), enemyOf(a, b)),
    );
    // Farida's grenades burst on walls and floors at once, on enemies only once armed
    const grenadeOf = (a: unknown, b: unknown): Grenade =>
      a instanceof Grenade ? a : (b as Grenade);
    const boom = (a: unknown, b: unknown) => this.detonate(grenadeOf(a, b));
    this.physics.add.collider(this.grenades.group, this.solids, boom);
    this.physics.add.collider(this.grenades.group, this.breakables, boom);
    this.physics.add.collider(this.grenades.group, this.oneways, boom, (a, b) => {
      const gr = grenadeOf(a, b);
      return this.landsOnOneWay(
        gr.body as Phaser.Physics.Arcade.Body,
        otherOf(a, b, gr) as Phaser.GameObjects.Rectangle,
        true,
      );
    });
    this.physics.add.overlap(this.grenades.group, this.enemies, (a, b) => {
      const gr = grenadeOf(a, b);
      if (gr.armMs <= 0 && !gr.hostile) this.detonate(gr);
    });
    this.physics.add.overlap(p, this.grenades.group, (a, b) => {
      const gr = grenadeOf(a, b);
      if (gr.hostile && gr.armMs <= 0) this.detonate(gr);
    });
    // pickup crates land on decks and are collected by touch
    this.physics.add.collider(this.crates, this.solids);
    this.physics.add.collider(this.crates, this.oneways);
    this.physics.add.overlap(p, this.crates, (a, b) => {
      const crate = (a === p ? b : a) as Phaser.Physics.Arcade.Image;
      this.collectCrate(crate);
    });
    this.physics.add.overlap(this.pBullets.group, this.solids, (a, b) =>
      this.killBullet(this.pBullets, bulletOf(a, b)),
    );
    this.physics.add.overlap(this.pBullets.group, this.breakables, (a, b) =>
      this.onBulletHitGrate(bulletOf(a, b), grateOf(a, b)),
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
      this.hurtPlayer(1, bullet.x - Math.sign(vx || 1) * 10, false);
    });
    this.physics.add.overlap(p, this.enemies, (a, b) => {
      const e = enemyOf(a, b);
      if (e.contactDamage > 0 && p.contactCooldownMs <= 0)
        this.hurtPlayer(TUNING.contactDamage * e.contactDamage, e.x);
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
      platforms: this.def.platforms,
      water: this.def.water,
      fx: this.fx,
    };
    for (const e of this.enemies) e.syncVisual(delta, visWorld);
    this.updateFallen(delta);
    this.fx.update(delta);
    this.sentry?.render();
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
    const cam = this.cameras.main;
    if (this.zoom !== this.settings.viewZoom) {
      this.zoom = approachZoom(this.zoom, this.settings.viewZoom, delta);
      cam.setZoom(this.zoom);
    }
    this.camRig.update(delta, this.cameraSubject());
    const baseX = screenOrigin(this.zoom, CANVAS_W, CANVAS_H).x;
    for (const l of this.parallax) {
      l.strip.setBaseX(baseX);
      l.strip.setOffset(cam.scrollX * l.fx);
      for (const img of l.strip.objects) img.y = l.y - cam.scrollY * l.fy;
    }

    this.writeHud();
    this.exposeState();
  }

  /** Zoom button / O key / gamepad Back: normal → wide → close (UI-11). Saved as a setting. */
  private cycleZoom(): void {
    const z = nextZoom(this.settings.viewZoom);
    void saves.updateSettings({ viewZoom: z });
    this.settings = saves.data.settings;
    sfx.ui();
    this.game.events.emit(HUD_EVENTS.notice, `View: ${zoomLabel(z)}`);
    telemetry.log('zoom', { zoom: z });
  }

  private cameraSubject() {
    const p = this.player;
    return { x: p.x, feetY: p.feetY, facing: p.facing, grounded: p.grounded, inWater: p.inWater };
  }

  private tick(dt: number): void {
    const inp = input.consume();
    if (inp.zoomPressed) this.cycleZoom();
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
    this.inputMs[input.lastSource] = (this.inputMs[input.lastSource] ?? 0) + dt;
    this.squad.tick(dt);

    if (inp.swapPressed) this.doSwap();
    if (inp.weaponPressed) this.switchWeapon();
    if (inp.reloadPressed && this.player.arsenal?.startReload()) sfx.reload();

    const p = this.player;
    const fireHeld = inp.fireHeld || inp.firePressed || this.autoFireWanted();
    p.stepMovement(dt, inp);
    this.onWaterState();
    this.breathe(dt);
    this.stepEntryAttacks(dt);
    this.stepGadgets(dt);
    this.stepAssault(dt);
    if (fireHeld && p.slideMs <= 0 && !p.climbing) this.tryFire(inp);
    if (p.arsenal?.tick(dt, fireHeld)) sfx.reloadDone();

    this.telegraph.clear();
    const ctx = this.enemyContext();
    for (const e of this.enemies) e.step(dt, ctx);

    this.stepPhysics(dt);

    const view = this.cameras.main.worldView;
    const splash = (x: number, y: number) => this.fx.splash(x, SURFACE_Y, 0.08 + (y - y));
    this.pBullets.step(dt, view, this.def.water, splash);
    this.eBullets.step(dt, view, this.def.water, splash);
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
    // a field pickup overrides the primary while it has ammo (not underwater)
    if (this.squad.active.pickup && !p.submerged) {
      this.firePickup();
      return;
    }
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
    p.unfurl(); // firing mid-somersault opens up into the aim pose
    const m = p.muzzle(dir);
    const aimAngle = Math.atan2(dir.y, dir.x);
    let angle = aimAngle;
    if (w.grenade) {
      this.grenades.throw(m.x, m.y, dir.x, dir.y, w);
    } else {
      // shotguns fan their pellets evenly across the spread, with a little jitter
      const pellets = w.pellets ?? 1;
      for (let k = 0; k < pellets; k++) {
        const fan = pellets > 1 ? (k / (pellets - 1)) * 2 - 1 : Math.random() * 2 - 1;
        const jitter = pellets > 1 ? (Math.random() - 0.5) * 0.3 : 0;
        angle = aimAngle + Phaser.Math.DegToRad((fan + jitter) * w.spreadDeg);
        this.pBullets.fire({
          x: m.x,
          y: m.y,
          dirX: Math.cos(angle),
          dirY: Math.sin(angle),
          speed: stats.speed,
          damage: stats.damage,
          pierce: w.pierce,
          lifeMs: (w.lifeMs ?? TUNING.bulletLifeMs) * stats.lifeScale,
          length: w.bulletLength,
          tint: w.tint,
          wet: p.submerged,
          waterproof: w.underwater === 'full',
        });
      }
      angle = aimAngle;
    }
    a.fire();
    p.recoil(w.recoil);
    this.fx.muzzle(m.x, m.y, angle, 0.7 + w.recoil * 0.25, p.submerged, w.tint ?? 0xffffff);
    if (w.ejectsCasings && !p.submerged) {
      const port = p.ejectionPort(dir);
      this.fx.casing(port.x, port.y, p.facing);
    }
    sfx.shoot(w.pitch);
    if (a.reloading) sfx.reload();
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
    if (b.active) pool.kill(b);
  }

  private onBulletHitEnemy(b: Bullet, e: Enemy): void {
    if (!b.active || e.dead || b.hitTargets.has(e)) return;
    b.hitTargets.add(e);
    this.sparks.explode(4, b.x, b.y);
    sfx.hit();
    e.hit(b.damage);
    b.pierce--;
    if (b.pierce <= 0) this.pBullets.kill(b);
  }

  private onBulletHitGrate(b: Bullet, g: Grate): void {
    if (!b.active || g.broken) return;
    this.pBullets.kill(b);
    this.sparks.explode(3, b.x, b.y);
    sfx.hit();
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

  /** Blast (mines): hurts the player and other enemies in range. */
  /** `friendly` blasts (Farida's) hurt enemies only, for their full damage. */
  private explode(
    x: number,
    y: number,
    radius: number,
    damage: number,
    source: Enemy | null,
    friendly = false,
  ): void {
    const wet = pointInWater(x, y, this.def.water);
    this.debris.explode(18, x, y);
    if (wet) {
      this.fx.bubbles(x, y, 18);
      this.fx.splash(x, SURFACE_Y, 0.9);
    } else {
      this.fx.dust(x, y, 10, 0xffb070);
    }
    sfx.explosion();
    this.shake(TUNING.shakePound);
    if (this.settings.flashing) this.cameras.main.flash(70, 255, 200, 150);
    const p = this.player;
    if (!friendly && Math.hypot(p.x - x, p.y - y) < radius + 6) {
      if (source) p.invulnMs = 0; // a mine blast always lands; thrown grenades respect i-frames
      this.hurtPlayer(damage, x);
    }
    for (const e of this.enemies) {
      if (e === source || e.dead) continue;
      if (Math.hypot(e.x - x, e.y - y) < radius) {
        if (!e.hit(friendly ? damage : 3) && friendly) e.stun(500);
      }
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
      lobGrenade: (x, y, vx, vy) =>
        this.grenades.lob(
          x,
          y,
          vx,
          vy,
          { radius: 18, damage: 1, gravity: 520, armMs: 0, fuseMs: 2600 },
          true,
        ),
      onEngage: () => {
        if (this.firstFightLogged) return;
        this.firstFightLogged = true;
        this.firstFightMs = Math.round(this.timeMs);
        telemetry.log('first_fight', { msSinceStart: Math.round(this.timeMs) });
      },
    };
  }

  private hurtPlayer(amount: number, fromX?: number, hop = true): void {
    const p = this.player;
    if (this.status !== 'playing' || p.invulnMs > 0 || p.climbing) return;
    if (this.cinematic && !this.cinematic.controlReturned) return;
    const absorbing = this.squad.active.def.absorbCharge;
    const r = this.squad.damage(amount);
    sfx.hurt();
    if (absorbing && r.armourLost > 0 && !r.downed) {
      this.absorbCharge += r.armourLost;
      if (this.absorbCharge >= absorbing) {
        this.absorbCharge = 0;
        this.counterBlast();
      }
    }
    this.hitStop(TUNING.hitStopHurtMs);
    this.shake(TUNING.shakeHurt);
    if (this.settings.flashing) this.cameras.main.flash(90, 255, 70, 50);
    if (r.downed) {
      this.operatorDown('hp');
      return;
    }
    p.knockback(fromX ?? p.x - p.facing, hop);
    // No invulnerability after a hit: every bullet in a burst lands. Only contact damage
    // waits; invulnerability is kept for tag-ins and respawns.
    p.contactCooldownMs = TUNING.contactCooldownMs;
    p.rig.flash(80);
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
      case 'sentry': {
        // Tomás: a turret lands where he arrives (one at a time); not underwater
        if (p.submerged) break;
        this.sentry?.destroy();
        const feetY =
          groundBelow(this.def.platforms, p.x + p.facing * 10, p.feetY - 4, 60) ?? p.feetY;
        this.sentry = new Sentry(this, p.x + p.facing * 10, feetY, p.facing);
        this.fx.dust(p.x + p.facing * 10, feetY, 6);
        sfx.weaponSwitch();
        break;
      }
      case 'blast': {
        // Farida: blast at her feet (enemies only) that launches her upward
        if (p.inWater) break;
        const t = TUNING.blast;
        this.explode(p.x, p.feetY - 4, t.radius, t.damage, null, true);
        p.arcadeBody.setVelocityY(-p.def.jumpVelocity * t.launch);
        break;
      }
      case 'pulse':
        this.shieldPulse();
        break;
      case 'phase':
        // KAI-7: an intangible dash through enemies
        p.surgeMs = TUNING.phase.ms;
        p.invulnMs = Math.max(p.invulnMs, TUNING.phase.invulnMs);
        this.surgeHits.clear();
        this.fx.dust(p.x, p.feetY, 5, 0x7ff3ff);
        break;
    }
  }

  /** Sione: wipe nearby enemy fire, stun nearby enemies, +1 armour to every standing member. */
  private shieldPulse(): void {
    const p = this.player;
    const t = TUNING.pulse;
    for (const b of this.eBullets.group.getChildren() as Bullet[]) {
      if (b.active && Math.hypot(b.x - p.x, b.y - p.y) < t.radius) this.eBullets.kill(b);
    }
    for (const e of this.enemies) {
      if (e.dead || Math.hypot(e.x - p.x, e.y - p.y) > t.radius) continue;
      e.stun(t.stunMs);
      e.arcadeBody.setVelocityX(Math.sign(e.x - p.x || 1) * t.knock);
    }
    for (const m of this.squad.members)
      if (!m.down) m.armour = Math.min(m.def.maxArmour, m.armour + 1);
    const ring = this.add
      .ellipse(p.x, p.y - 6, 12, 12)
      .setStrokeStyle(2.5, 0xb48cff)
      .setDepth(DEPTH.fx);
    this.tweens.add({
      targets: ring,
      scale: (t.radius * 2) / 12,
      alpha: 0,
      duration: 360,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });
    sfx.swap();
  }

  /** Sentry fire and grenade fuses, at the fixed rate. */
  private stepGadgets(dt: number): void {
    const s = this.sentry;
    if (s) {
      const dir = s.step(dt, this.enemies, this.cameras.main.worldView);
      if (dir) {
        const m = s.muzzle;
        const t = TUNING.sentry;
        this.pBullets.fire({
          x: m.x,
          y: m.y,
          dirX: dir.x,
          dirY: dir.y,
          speed: t.bulletSpeed,
          damage: t.damage,
          pierce: 1,
          lifeMs: TUNING.bulletLifeMs,
          length: 4,
          tint: 0xfff0a0,
        });
        this.fx.muzzle(m.x, m.y, Math.atan2(dir.y, dir.x), 0.6, false, 0xfff0a0);
        sfx.shoot(980);
      }
      if (s.done) {
        this.fx.dust(s.x, s.feetY, 6);
        s.destroy();
        this.sentry = null;
      }
    }
    for (const g of this.grenades.step(dt)) this.detonate(g);
  }

  private detonate(g: Grenade): void {
    if (!g.active) return;
    const { x, y, radius, damage, hostile } = g;
    this.grenades.kill(g);
    this.explode(x, y, radius, damage, null, !hostile);
  }

  /** KAI-7 turns absorbed armour hits into a ring of bolts. */
  private counterBlast(): void {
    const p = this.player;
    const t = TUNING.counter;
    for (let k = 0; k < t.bolts; k++) {
      const a = (k / t.bolts) * Math.PI * 2;
      this.pBullets.fire({
        x: p.x,
        y: p.y - 4,
        dirX: Math.cos(a),
        dirY: Math.sin(a),
        speed: t.speed,
        damage: t.damage,
        pierce: t.pierce,
        lifeMs: TUNING.bulletLifeMs,
        length: 7,
        tint: 0x7ff3ff,
      });
    }
    this.fx.dust(p.x, p.y, 8, 0x7ff3ff);
    this.shake(TUNING.shakePound);
    sfx.pound();
    this.game.events.emit(HUD_EVENTS.callout, 'Counter-blast', 0x7ff3ff);
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
        const floor = groundBelow(this.def.platforms, f.x, f.y - 1, 300) ?? f.y;
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
    this.downsBySection[this.section] = (this.downsBySection[this.section] ?? 0) + 1;
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
      p.invulnMs = TUNING.pitRespawnInvulnMs;
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
    for (const pl of this.def.platforms) {
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
      this.section++;
      this.downsBySection[this.section] ??= 0;
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
      a.def.spawns.forEach((s) => a.enemies.add(this.spawnRifleman(s.x, s.y)));
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
      runId: this.recordRun('clear'),
    };
    this.time.delayedCall(1800, () => {
      this.scene.stop(SCENES.hud);
      this.scene.start(SCENES.results, data);
    });
  }

  // ---------------------------------------------------------------- playtest record (ANALYTICS-03)

  /** The run ended without a clear (pause → restart / menu, or the tab closed). */
  endRun(outcome: Exclude<RunOutcome, 'clear'>): void {
    if (this.status !== 'clear') this.recordRun(outcome);
  }

  /** Store one record per attempt; nothing if the stage was never actually played. */
  private recordRun(outcome: RunOutcome): string | null {
    if (this.runRecorded || this.timeMs <= 0) return null;
    this.runRecorded = true;
    const id = `${telemetry.sessionId}-${Date.now().toString(36)}`;
    const fps = this.fps.summary();
    const ctx = telemetry.context();
    void playtest.add({
      id,
      at: new Date().toISOString(),
      sessionId: telemetry.sessionId,
      build: __BUILD__,
      stage: this.def.id,
      mode: this.mode,
      squad: this.squad.members.map((m) => m.def.id),
      outcome,
      timeMs: Math.round(this.timeMs),
      firstFightMs: this.firstFightMs,
      downs: this.squad.downs,
      downsBySection: [...this.downsBySection].map((n) => n ?? 0),
      swaps: this.squad.swaps,
      swapsPerMin: swapsPerMinute(this.squad.swaps, this.timeMs),
      continues: this.continues,
      input: dominantInput(this.inputMs),
      fpsP50: fps.p50,
      fpsP10: fps.p10,
      detail: this.detail ?? 'high',
      replay: this.replay,
      device: currentDevice(ctx.standalone === true),
      survey: null,
    });
    return id;
  }

  // ---------------------------------------------------------------- Contra-inspired set

  /** Turrets, frogmen, runner zones, drones, the rigged gangway and the Lock Gate. */
  private buildAssault(): void {
    const d = this.def;
    for (const t of d.turrets ?? []) {
      const opts =
        t.mount === 'wall'
          ? { mount: 'wall' as const, hp: 8, volley: 1, cooldownMs: 1300 }
          : { mount: 'hatch' as const, hp: 6, volley: 1, cooldownMs: 1500 };
      this.enemies.push(new Turret(this, t.x, t.y, opts));
    }
    for (const f of d.frogmen ?? []) {
      const pool = d.water.find((v) => f.x > v.x && f.x < v.x + v.w);
      if (pool) this.enemies.push(new Frogman(this, f.x, pool));
    }
    this.runnerZones = (d.runners ?? []).map((def) => ({ def, timerMs: 600, alive: new Set() }));
    this.droneDefs = (d.drones ?? []).map((def) => ({ def, spawned: false }));
    for (const b of d.bridges ?? []) {
      const segs: { rect: Phaser.GameObjects.Rectangle; img: Phaser.GameObjects.Image }[] = [];
      for (let x = b.x; x < b.to - 1; x += 24) {
        const w = Math.min(24, b.to - x);
        const rect = this.add.rectangle(x + w / 2, b.y + 3, w, 6, 0, 0).setVisible(false);
        this.physics.add.existing(rect, true);
        const body = rect.body as Phaser.Physics.Arcade.StaticBody;
        body.checkCollision.down = false;
        body.checkCollision.left = false;
        body.checkCollision.right = false;
        this.oneways.add(rect);
        const img = this.add
          .image(x, b.y - 4, 'bridge-seg')
          .setOrigin(0, 0)
          .setScale(1 / FX_RES)
          .setDepth(DEPTH.level + 1);
        segs.push({ rect, img });
      }
      this.bridges.push({ def: b, segs, armed: false, timerMs: 0, next: 0 });
    }
    const g = d.gate;
    if (g) {
      const top = GROUND_Y - 180;
      const art = this.add
        .image(g.x - 6, GROUND_Y, 'gate-wall')
        .setOrigin(0, 1)
        .setScale(1 / FX_RES)
        .setDepth(DEPTH.level + 2);
      const wall = this.add.rectangle(g.x + 27, top + 90, 54, 180, 0, 0).setVisible(false);
      this.physics.add.existing(wall, true);
      this.solids.add(wall);
      const cannons = [
        // within reach of a diagonal shot from mid-arena, and of a jump-and-fire up close
        new Turret(this, g.x - 2, GROUND_Y - 104, {
          mount: 'gate',
          hp: 12,
          volley: 3,
          cooldownMs: 1900,
        }),
        new Turret(this, g.x - 2, GROUND_Y - 62, {
          mount: 'gate',
          hp: 12,
          volley: 3,
          cooldownMs: 2300,
        }),
      ];
      const core = new GateCore(this, g.x - 1, GROUND_Y - 22);
      this.enemies.push(...cannons, core);
      const barrier = this.add.rectangle(g.x - 15, top + 90, 30, 180, 0, 0).setVisible(false);
      this.physics.add.existing(barrier, true);
      this.physics.add.collider(this.player, barrier);
      this.boss = {
        cannons,
        core,
        wall,
        art,
        started: false,
        exposed: false,
        defeated: false,
        leftWall: null,
        barrier,
        runnerMs: 2500,
        runners: new Set(),
      };
    }
    this.events.on('drone-down', (x: number, y: number, kind: PickupKind) =>
      this.dropCrate(x, y, kind),
    );
    this.events.on('big-boom', (x: number, y: number) => this.boomFx(x, y, 1));
  }

  /** Visual and sound of an explosion only (no damage). */
  private boomFx(x: number, y: number, size: number): void {
    this.debris.explode(Math.round(12 * size), x, y);
    this.fx.dust(x, y, Math.round(8 * size), 0xffb070);
    sfx.explosion();
    this.shake({
      durationMs: TUNING.shakeKill.durationMs,
      intensity: TUNING.shakeKill.intensity * size,
    });
  }

  private spawnRunner(x: number, dir: 1 | -1): Runner | null {
    const view = this.cameras.main.worldView;
    const feet = groundBelow(this.def.platforms, x, view.y, 400);
    if (feet === null || pointInWater(x, feet - 2, this.def.water)) return null;
    const r = new Runner(this, x, feet, dir, this.def.platforms, this.def.height);
    this.enemies.push(r);
    return r;
  }

  private stepAssault(dt: number): void {
    const p = this.player;
    const view = this.cameras.main.worldView;
    this.pickupCdMs = Math.max(0, this.pickupCdMs - dt);

    // runners keep coming while the player is inside a zone
    for (const z of this.runnerZones) {
      for (const e of z.alive) if (e.dead) z.alive.delete(e);
      if (p.x < z.def.fromX || p.x > z.def.toX || this.status !== 'playing') continue;
      z.timerMs -= dt;
      if (z.timerMs > 0 || z.alive.size >= z.def.max) continue;
      const behind = z.def.sides === 'both' && Math.random() < 0.25;
      const r = behind ? this.spawnRunner(view.x - 8, 1) : this.spawnRunner(view.right + 8, -1);
      z.timerMs = r ? z.def.everyMs * (0.7 + Math.random() * 0.6) : 400;
      if (r) z.alive.add(r);
    }

    // supply drones fly in once their trigger is passed
    for (const dd of this.droneDefs) {
      if (dd.spawned || p.x < dd.def.triggerX) continue;
      dd.spawned = true;
      this.enemies.push(new SupplyDrone(this, view.right + 16, dd.def.y, dd.def.pickup));
    }

    // crates blink out after a while
    for (const c of this.crates.getChildren() as Phaser.Physics.Arcade.Image[]) {
      if (!c.active) continue;
      const left = (c.getData('ttl') as number) - dt;
      c.setData('ttl', left);
      c.setAlpha(left < 3000 && Math.floor(left / 120) % 2 === 0 ? 0.3 : 1);
      if (left <= 0) c.destroy();
    }

    // Hornet rounds home in on the nearest enemy
    for (const b of this.pBullets.group.getChildren() as Bullet[]) {
      if (!b.active || !b.homing) continue;
      let best: Enemy | null = null;
      let bestD = 220;
      for (const e of this.enemies) {
        if (e.dead || !e.active || (e instanceof Turret && e.hidden)) continue;
        const dd = Math.hypot(e.x - b.x, e.y - b.y);
        if (dd < bestD) {
          bestD = dd;
          best = e;
        }
      }
      if (!best) continue;
      const body = b.body as Phaser.Physics.Arcade.Body;
      const speed = Math.hypot(body.velocity.x, body.velocity.y) || 1;
      const h = steer(
        Math.atan2(body.velocity.y, body.velocity.x),
        Math.atan2(best.y - b.y, best.x - b.x),
        (dt / 1000) * 5,
      );
      body.setVelocity(Math.cos(h) * speed, Math.sin(h) * speed);
      b.setRotation(h);
    }

    // the rigged gangway: stepping on it starts a chain of charges from the near end
    for (const br of this.bridges) {
      if (!br.armed) {
        const on =
          p.grounded && p.x > br.def.x && p.x < br.def.to && Math.abs(p.feetY - br.def.y) < 3;
        if (on) {
          br.armed = true;
          br.timerMs = 220;
          this.game.events.emit(HUD_EVENTS.callout, 'Rigged gangway!', COLORS.danger);
          sfx.telegraph();
        }
        continue;
      }
      if (br.next >= br.segs.length) continue;
      br.timerMs -= dt;
      if (br.timerMs > 0) continue;
      const seg = br.segs[br.next]!;
      this.oneways.remove(seg.rect, true, true);
      this.boomFx(seg.img.x + 3, br.def.y + 2, 0.7);
      this.fx.splash(seg.img.x + 3, SURFACE_Y, 0.6);
      seg.img.destroy();
      br.next++;
      br.timerMs = 300;
    }

    this.stepBoss(dt);
  }

  private dropCrate(x: number, y: number, kind: PickupKind): void {
    const c = this.crates.create(x, y, `crate-${kind}`) as Phaser.Physics.Arcade.Image;
    c.setScale(1 / FX_RES).setDepth(DEPTH.pickups);
    c.setData('kind', kind).setData('ttl', 14000);
    const body = c.body as Phaser.Physics.Arcade.Body;
    body.setSize(10 * FX_RES, 10 * FX_RES).setOffset(1 * FX_RES, 1 * FX_RES);
    body.setVelocity(0, -80);
    body.setMaxVelocityY(220);
    body.setDragX(200);
  }

  private collectCrate(c: Phaser.Physics.Arcade.Image): void {
    if (!c.active || this.status !== 'playing') return;
    const kind = c.getData('kind') as PickupKind;
    c.destroy();
    grantPickup(this.squad.active, kind);
    sfx.pickup();
    this.game.events.emit(HUD_EVENTS.callout, PICKUPS[kind].name, PICKUPS[kind].color);
    telemetry.log('pickup', { kind, t: Math.round(this.timeMs) });
  }

  private firePickup(): void {
    if (this.pickupCdMs > 0) return;
    const p = this.player;
    const spec = spendPickup(this.squad.active);
    if (!spec) return;
    this.pickupCdMs = 1000 / spec.rate;
    const dir = this.aimDirection();
    if (dir !== p.aim.dir) p.aim = { ...p.aim, dir };
    p.unfurl();
    const m = p.muzzle(dir);
    for (const a of pelletAngles(Math.atan2(dir.y, dir.x), spec)) {
      this.pBullets.fire({
        x: m.x,
        y: m.y,
        dirX: Math.cos(a),
        dirY: Math.sin(a),
        speed: spec.speed,
        damage: spec.damage,
        pierce: spec.pierce,
        lifeMs: TUNING.bulletLifeMs * (spec.homing ? 1.6 : 1),
        length: spec.length,
        tint: spec.tint,
        homing: spec.homing,
      });
    }
    p.recoil(spec.kind === 'rail' ? 2.6 : 1.2);
    this.fx.muzzle(
      m.x,
      m.y,
      Math.atan2(dir.y, dir.x),
      spec.kind === 'rail' ? 1.6 : 1,
      false,
      spec.tint,
    );
    sfx.shoot(spec.kind === 'rail' ? 1700 : spec.kind === 'hornet' ? 520 : 760);
  }

  /** The Lock Gate: lock the camera, guns first, then the core; defeat opens the way. */
  private stepBoss(dt: number): void {
    const b = this.boss;
    const g = this.def.gate;
    if (!b || !g || b.defeated) return;
    const p = this.player;
    if (!b.started) {
      if (p.x < g.triggerX) return;
      b.started = true;
      const wall = this.add.rectangle(
        g.arenaLeft - 4,
        this.def.height / 2,
        8,
        this.def.height * 2,
        0,
        0,
      );
      this.physics.add.existing(wall, true);
      this.solids.add(wall);
      b.leftWall = wall;
      this.camRig.setBounds(g.arenaLeft, 0, g.x + 64 - g.arenaLeft, this.def.height);
      this.game.events.emit(HUD_EVENTS.callout, 'Lock Gate · take out the cannons', COLORS.danger);
      telemetry.log('boss_start', { t: Math.round(this.timeMs) });
    }
    // the gate keeps releasing runners from its base
    for (const e of b.runners) if (e.dead) b.runners.delete(e);
    b.runnerMs -= dt;
    if (b.runnerMs <= 0 && b.runners.size < 2 && !b.core.dead) {
      const r = this.spawnRunner(g.x - 8, -1);
      if (r) b.runners.add(r);
      b.runnerMs = 3400 + Math.random() * 1200;
    }
    if (!b.exposed && b.cannons.every((c) => c.dead)) {
      b.exposed = true;
      b.core.dropShield();
      this.game.events.emit(HUD_EVENTS.callout, 'Core exposed!', COLORS.uiAccent);
    }
    // only a core shot to pieces opens the gate (not a despawn)
    if (b.core.dead && b.core.hp <= 0) this.defeatBoss();
  }

  private defeatBoss(): void {
    const b = this.boss;
    const g = this.def.gate;
    if (!b || !g || b.defeated) return;
    b.defeated = true;
    for (const e of b.runners) if (!e.dead) e.despawn();
    // a chain of blasts up the gate, then it sinks and the way opens
    for (let i = 0; i < 7; i++) {
      this.time.delayedCall(i * 160, () =>
        this.boomFx(g.x + 10 + Math.random() * 40, GROUND_Y - 20 - Math.random() * 150, 1.2),
      );
    }
    this.time.delayedCall(1100, () => {
      this.solids.remove(b.wall, true, true);
      b.barrier.destroy();
      this.tweens.add({
        targets: b.art,
        y: b.art.y + 190,
        alpha: 0.2,
        duration: 1400,
        ease: 'Quad.easeIn',
      });
      if (b.leftWall) this.solids.remove(b.leftWall, true, true);
      b.leftWall = null;
      this.camRig.setBounds(0, 0, this.def.width, this.def.height);
      this.game.events.emit(HUD_EVENTS.callout, 'Gate down · move out', COLORS.checkpointOn);
    });
    telemetry.log('boss_clear', { t: Math.round(this.timeMs) });
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
    const pk = s.active.pickup;
    hud.weapon = pk
      ? {
          name: PICKUPS[pk.kind as PickupKind].name,
          short: PICKUPS[pk.kind as PickupKind].short,
          mag: pk.ammo,
          magSize: pk.full,
          reload: null,
          blocked: p.submerged,
          other: a ? (a.ids[a.index] ?? '') : '',
        }
      : a
        ? {
            name: a.current.name,
            short: a.current.short,
            mag: a.mag,
            magSize: a.current.magSize,
            reload: a.reloadProgress,
            blocked: p.submerged && a.current.underwater === 'none',
            other: a.ids.length > 1 ? (a.ids[(a.index + 1) % a.ids.length] ?? '') : '',
          }
        : null;
    hud.oxygen = s.oxygenFrac;
    const b = this.boss;
    if (b && b.started && !b.defeated) {
      // cannons count for the first half of the bar, the core for the second
      const cannons =
        b.cannons.reduce((n, c) => n + Math.max(0, c.hp) / c.maxHp, 0) / b.cannons.length;
      const core = Math.max(0, b.core.hp) / b.core.maxHp;
      hud.boss = { name: 'LOCK GATE', frac: (cannons + core) / 2, shielded: b.core.shielded };
    } else {
      hud.boss = null;
    }
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
      zoom: this.settings.viewZoom,
      pickup: this.squad.active.pickup?.kind ?? null,
      pickupAmmo: this.squad.active.pickup?.ammo ?? 0,
      boss: this.boss
        ? {
            started: this.boss.started,
            exposed: this.boss.exposed,
            defeated: this.boss.defeated,
            cannonsAlive: this.boss.cannons.filter((c) => !c.dead).length,
            coreHp: this.boss.core.hp,
          }
        : null,
      runners: this.enemies.filter((e) => e instanceof Runner && !e.dead).length,
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
      /** Destroy the Lock Gate's cannons and core at once. */
      winBoss: () => {
        const b = this.boss;
        if (!b) return;
        b.cannons.forEach((c) => c.dead || c.hit(999));
        b.core.dropShield();
        b.core.hit(999);
      },
      /** Send a supply drone in now, carrying `kind`. */
      spawnDrone: (kind: PickupKind) => {
        const v = this.cameras.main.worldView;
        this.enemies.push(new SupplyDrone(this, v.right - 40, v.y + 60, kind));
      },
      /** Fire an enemy bullet from (x, y) along (dirX, dirY), as a rifleman would. */
      enemyShot: (x: number, y: number, dirX: number, dirY: number) => {
        this.eBullets.fire({ x, y, dirX, dirY, speed: 220, damage: 1, pierce: 1, lifeMs: 2400 });
      },
      // the Lock Gate's cannons and core are scenery-sized and stay (use winBoss for those)
      clearEnemies: () =>
        this.enemies.forEach((e) => {
          if (this.boss && (this.boss.cannons.includes(e as Turret) || e === this.boss.core))
            return;
          e.despawn();
        }),
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
