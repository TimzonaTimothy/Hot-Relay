/**
 * The active operator (character controller): movement on land and in water, aiming, entry
 * attacks, ledge climbing and the visual rig.
 *
 * One invisible physics body is shared by the whole squad; a Relay Swap changes its stats,
 * weapons and rig. Movement runs in fixed steps called by the stage; this class never reads
 * the keyboard itself. The cut-out Rig is purely visual and is driven by an AnimStateMachine,
 * which is also stepped in fixed steps so states are deterministic.
 */
import Phaser from 'phaser';
import { TUNING } from '../config/tuning';
import { DEPTH } from '../config/constants';
import type { OperatorDef } from '../data/operators';
import { JumpController } from '../systems/JumpController';
import { aimFromInput, type AimResult, type Vec } from '../systems/aim';
import type { InputFrame } from '../systems/InputManager';
import { sfx } from '../systems/Sfx';
import { AnimStateMachine, type AnimState } from '../systems/anim';
import { swimStep, waterAt, type WaterInfo, type WaterVolume } from '../systems/water';
import { ledgeAhead, type Rect } from '../systems/geometry';
import type { Arsenal } from '../systems/Arsenal';
import { Rig } from './Rig';
import type { Effects } from '../stage/Effects';

export type GroundKind = 'solid' | 'oneway' | null;

/** What the player needs to know about the level. */
export interface PlayerWorld {
  platforms: readonly Rect[];
  water: readonly WaterVolume[];
  fx: Effects;
}

const DRY: WaterInfo = {
  volume: null,
  inWater: false,
  submerged: false,
  depth: -Infinity,
  surfaceY: 0,
};

interface Climb {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  ms: number;
}

export class Player extends Phaser.Physics.Arcade.Sprite {
  def: OperatorDef;
  facing: 1 | -1 = 1;
  crouching = false;
  aim: AimResult = { dir: { x: 1, y: 0 }, crouch: false, explicitVertical: false };
  /** Weapons of the active operator (owned by the squad member). */
  arsenal: Arsenal | null = null;

  invulnMs = 0;
  /** Time left before enemy contact can hurt again (not bullets). */
  contactCooldownMs = 0;
  dropThroughMs = 0;
  /** Set by the platform colliders during each physics step. */
  groundKind: GroundKind = null;

  // entry attacks
  slideMs = 0;
  slideShotsLeft = 0;
  slideShotTimer = 0;
  pounding = false;
  surgeMs = 0;

  // water
  water: WaterInfo = DRY;
  private waterJumpMs = 0;
  private dripMs = 0;
  private climb: Climb | null = null;

  // animation and presentation
  readonly rig: Rig;
  readonly anim = new AnimStateMachine();
  private readonly shadow: Phaser.GameObjects.Image;
  private hurtPending = false;
  dead = false;
  victory = false;
  /** Hanging on the insertion rope (position driven by the cinematic). */
  onRope = false;
  /** Shown or hidden as a whole (rig, shadow). */
  shown = true;

  private jumpCtl = new JumpController(TUNING.coyoteMs, TUNING.jumpBufferMs, TUNING.airJumps);
  private jumpCutDone = true;
  /** In a somersault (MOVE-08): tucked hitbox, fixed arc, until landing or firing. */
  spinning = false;
  private spinFast = false;
  private wasGrounded = true;
  private fallSpeed = 0;
  private swimDir: Vec = { x: 1, y: 0 };
  lastSafe = { x: 0, y: 0 };

  constructor(
    scene: Phaser.Scene,
    x: number,
    feetY: number,
    def: OperatorDef,
    private readonly world: PlayerWorld,
  ) {
    super(scene, x, feetY - 10, 'hitbox');
    this.def = def;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setVisible(false); // the rig draws the operator
    this.rig = new Rig(scene, def.rig, def.weapons[0], DEPTH.player);
    this.shadow = world.fx.makeShadow();
    this.arcadeBody.setMaxVelocityY(TUNING.maxFallSpeed);
    this.arcadeBody.setCollideWorldBounds(false);
    this.setStanding();
    this.lastSafe = { x, y: feetY };
  }

  get arcadeBody(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  get grounded(): boolean {
    return this.arcadeBody.blocked.down || this.arcadeBody.touching.down;
  }

  get feetY(): number {
    return this.arcadeBody.bottom;
  }

  get inWater(): boolean {
    return this.water.inWater;
  }

  get submerged(): boolean {
    return this.water.submerged;
  }

  get climbing(): boolean {
    return this.climb !== null;
  }

  get animState(): AnimState {
    return this.anim.state;
  }

  setOperator(def: OperatorDef, arsenal: Arsenal): void {
    this.def = def;
    this.arsenal = arsenal;
    this.rig.setId(def.rig, arsenal.current.id);
    this.crouching = false;
    this.surgeMs = 0;
    // a tag-in mid-somersault arrives upright
    this.spinning = false;
    this.spinFast = false;
    this.rig.cancelSpin();
    this.setStanding();
  }

  /** Refresh the arm texture after a weapon switch. */
  syncWeapon(): void {
    if (this.arsenal) this.rig.setWeapon(this.arsenal.current.id);
  }

  private setStanding(): void {
    this.arcadeBody.setSize(10, 18).setOffset(1, 2);
  }

  private setCrouched(): void {
    this.arcadeBody.setSize(10, 11).setOffset(1, 9);
  }

  private startSpin(fast: boolean): void {
    this.spinning = true;
    this.spinFast = fast;
    this.setCrouched(); // tucked: the small hitbox slips between shots
  }

  private endSpin(): void {
    if (!this.spinning) return;
    this.spinning = false;
    this.spinFast = false;
    if (!this.crouching) this.setStanding();
  }

  /** Firing mid-somersault unfurls into the upright aim pose for the rest of the jump. */
  unfurl(): void {
    if (!this.spinning) return;
    this.endSpin();
    this.rig.cancelSpin();
  }

  /** Muzzle position in world space for an aim direction (follows the rig's shoulder). */
  muzzle(dir: Vec = this.aim.dir): Vec {
    const w = this.arsenal?.current;
    return this.rig.muzzle(dir, w?.muzzle ?? 18);
  }

  ejectionPort(dir: Vec = this.aim.dir): Vec {
    return this.rig.ejectionPort(dir);
  }

  /** Recoil: the arm kicks back; heavy weapons also nudge the body on the ground. */
  recoil(px: number): void {
    this.rig.kick(px);
    if (!this.inWater && this.grounded && px >= 1.8)
      this.arcadeBody.velocity.x -= this.facing * px * 6;
  }

  /** A hit landed: knock back away from the source and play the hurt beat. */
  /**
   * Push away from a hit. `hop` adds the small upward bounce (contact, blasts); bullet hits skip
   * it, so the rest of a burst still meets the body instead of passing underneath.
   */
  knockback(fromX: number, hop = true): void {
    const dir = this.x >= fromX ? 1 : -1;
    const k = this.inWater ? 0.4 : 1;
    const vy = this.arcadeBody.velocity.y;
    this.arcadeBody.setVelocity(
      dir * TUNING.hurtKnockX * k,
      this.inWater || !hop ? vy : -TUNING.hurtKnockY,
    );
    this.hurtPending = true;
    this.slideMs = 0;
    this.climb = null;
    this.endSpin();
  }

  /** A hit that should play the hurt pose without moving the body (drowning). */
  flinch(): void {
    this.hurtPending = true;
  }

  /**
   * One fixed step of movement. Returns true if the operator jumped this step.
   */
  stepMovement(dtMs: number, inp: InputFrame): boolean {
    const body = this.arcadeBody;
    this.invulnMs = Math.max(0, this.invulnMs - dtMs);
    this.contactCooldownMs = Math.max(0, this.contactCooldownMs - dtMs);
    this.dropThroughMs = Math.max(0, this.dropThroughMs - dtMs);
    this.waterJumpMs = Math.max(0, this.waterJumpMs - dtMs);

    this.updateWater();
    const grounded = this.grounded;
    if (grounded && this.groundKind && !this.inWater) this.lastSafe = { x: this.x, y: this.feetY };

    if (this.climb) {
      this.stepClimb(dtMs);
      this.groundKind = null;
      return false;
    }

    // --- slide (Kemi's entry attack) and surge (Tari's) override normal movement
    if (this.slideMs > 0) {
      this.slideMs -= dtMs;
      body.setVelocityX(this.facing * TUNING.slideSpeed);
      if (!this.crouching) {
        this.crouching = true;
        this.setCrouched();
      }
      if (this.slideMs <= 0) {
        this.crouching = false;
        this.setStanding();
      }
      this.groundKind = null;
      return false;
    }

    if (this.inWater && this.waterJumpMs <= 0) {
      const jumped = this.stepSwim(dtMs, inp);
      this.groundKind = null;
      return jumped;
    }
    body.setAllowGravity(true);
    return this.stepLand(dtMs, inp, grounded);
  }

  private stepLand(dtMs: number, inp: InputFrame, grounded: boolean): boolean {
    const dt = dtMs / 1000;
    const body = this.arcadeBody;

    // --- aim and crouch
    this.aim = aimFromInput(inp, grounded, this.facing);
    const wantCrouch = this.aim.crouch && grounded;
    if (wantCrouch !== this.crouching) {
      this.crouching = wantCrouch;
      if (wantCrouch) this.setCrouched();
      else this.setStanding();
    }

    // --- horizontal: accelerate towards target speed (analogue: a light tilt walks)
    const ax = inp.axisX;
    if (ax !== 0) this.facing = ax > 0 ? 1 : -1;
    const surge = this.surgeMs > 0;
    if (surge) this.surgeMs -= dtMs;
    const target = this.crouching
      ? 0
      : surge
        ? this.facing * this.def.runSpeed * 2.2
        : ax * this.def.runSpeed;
    const accel = grounded
      ? target !== 0
        ? TUNING.groundAccel
        : TUNING.groundDecel
      : target !== 0
        ? TUNING.airAccel
        : TUNING.airDecel;
    const vx = body.velocity.x;
    const diff = target - vx;
    const stepV = accel * dt;
    body.setVelocityX(Math.abs(diff) <= stepV ? target : vx + Math.sign(diff) * stepV);

    // --- drop through a one-way platform: down + jump
    let jumped = false;
    if (inp.down && inp.jumpPressed && grounded && this.groundKind === 'oneway') {
      this.dropThroughMs = TUNING.dropThroughMs;
      this.jumpCtl.clear();
      body.setVelocityY(40);
      this.y += 2;
    } else {
      const kind = this.jumpCtl.step(dtMs, grounded, inp.jumpPressed);
      if (kind) {
        // running jumps tuck into a somersault; standing jumps stay upright for aiming;
        // the double jump is always a quick flip
        const running =
          Math.abs(inp.axisX) >= TUNING.spin.runThreshold ||
          Math.abs(body.velocity.x) >= this.def.runSpeed * TUNING.spin.runThreshold;
        const spin = kind === 'air' || running;
        const scale = kind === 'air' ? TUNING.airJumpScale : spin ? TUNING.spin.jumpScale : 1;
        body.setVelocityY(-this.def.jumpVelocity * scale);
        if (spin) this.startSpin(kind === 'air');
        else this.endSpin();
        this.jumpCutDone = false;
        jumped = true;
        sfx.jump();
        // a puff under the feet sells the mid-air kick
        if (kind === 'air') this.world.fx.dust(this.x, this.feetY, 5);
      }
    }

    // --- variable jump height: releasing early cuts the rise once (somersaults keep a fixed arc)
    if (!this.jumpCutDone && !this.spinning && !inp.jumpHeld && body.velocity.y < 0) {
      body.setVelocityY(body.velocity.y * TUNING.jumpCutMultiplier);
      this.jumpCutDone = true;
    }
    if (body.velocity.y >= 0) this.jumpCutDone = true;

    if (this.pounding) body.setVelocityY(Math.max(body.velocity.y, 520));

    this.groundKind = null; // colliders refill it during the coming physics step
    return jumped;
  }

  private stepSwim(dtMs: number, inp: InputFrame): boolean {
    const body = this.arcadeBody;
    const T = TUNING.water;
    const prof = this.def.swim;
    const w = this.water;
    body.setAllowGravity(false);
    if (this.crouching) {
      this.crouching = false;
      this.setStanding();
    }
    this.pounding = false;

    // aim freely in all 8 directions while swimming; holding only "down" underwater is a
    // dive, so the gun stays level (down + left/right still aims diagonally)
    this.aim = aimFromInput(inp, false, this.facing);
    if (w.submerged && inp.down && !inp.left && !inp.right)
      this.aim = { dir: { x: this.facing, y: 0 }, crouch: false, explicitVertical: false };
    const ax = inp.axisX;
    if (ax !== 0) this.facing = ax > 0 ? 1 : -1;

    const onFloor = this.grounded;
    // a sinker standing on the bottom walks it instead of swimming
    const floorWalk = onFloor && prof.buoyancy < 0 && w.submerged;

    // ledge assist: at the surface, pushing into a quay wall (or pressing up/jump) climbs out
    if (!w.submerged && ax !== 0 && w.volume) {
      const dir: 1 | -1 = ax > 0 ? 1 : -1;
      const blocked = dir > 0 ? body.blocked.right : body.blocked.left;
      if (blocked || inp.up || inp.jumpPressed) {
        const ledge = ledgeAhead(
          this.world.platforms,
          { left: body.left, right: body.right, bottom: body.bottom },
          dir,
          w.surfaceY,
          T.climbReach,
        );
        if (ledge) {
          this.startClimb(ledge.x, ledge.y);
          return false;
        }
      }
    }

    let jumped = false;
    let { vx, vy } = swimStep(
      body.velocity.x,
      body.velocity.y,
      { x: floorWalk ? 0 : ax, up: inp.up || inp.jumpHeld, down: inp.down },
      prof,
      T,
      { submerged: w.submerged, depth: w.depth, onFloor },
      dtMs,
    );
    if (floorWalk) vx = ax * this.def.runSpeed * T.floorWalkSpeed;
    if (this.surgeMs > 0) {
      // Tari's surge: a torpedo burst along the facing direction
      this.surgeMs -= dtMs;
      vx = this.facing * prof.speed * 2.2;
      vy *= 0.5;
      if (Math.random() < 0.5) this.world.fx.bubbles(this.x - this.facing * 6, this.y, 1);
    }

    if (inp.jumpPressed) {
      if (!w.submerged) {
        // jump out of the water (to a pontoon or quay)
        vy = -T.waterJumpVelocity;
        this.waterJumpMs = T.waterJumpMs;
        this.jumpCutDone = false;
        jumped = true;
        sfx.jump();
        this.jumpCtl.refill(); // the double jump helps reach a high quay
      } else {
        // swim stroke: a burst towards the surface (or the held direction)
        const kick = prof.speed * T.strokeBoost;
        vy = inp.down ? Math.max(vy, kick * 0.6) : Math.min(vy, -kick);
        vx += ax * kick * 0.4;
        this.world.fx.bubbles(this.x, this.y - 4, 3);
      }
    }
    body.setVelocity(vx, vy);
    if (Math.hypot(vx, vy) > 14) {
      const len = Math.hypot(vx, vy);
      this.swimDir = { x: vx / len, y: vy / len };
    } else {
      this.swimDir = { x: 0, y: 0 };
    }
    return jumped;
  }

  private startClimb(toX: number, toY: number): void {
    this.climb = { fromX: this.x, fromY: this.feetY, toX, toY, ms: 0 };
    this.arcadeBody.setAllowGravity(false);
    this.arcadeBody.setVelocity(0, 0);
    this.arcadeBody.enable = false;
    this.world.fx.splash(this.x, this.water.surfaceY, 0.3);
    sfx.climb();
  }

  private stepClimb(dtMs: number): void {
    const c = this.climb;
    if (!c) return;
    c.ms += dtMs;
    const t = Math.min(1, c.ms / TUNING.water.climbMs);
    // up first, then over the lip
    const ty = t < 0.6 ? t / 0.6 : 1;
    const tx = t < 0.4 ? 0 : (t - 0.4) / 0.6;
    const feetX = c.fromX + (c.toX - c.fromX) * tx;
    const feetY = c.fromY + (c.toY - 0.5 - c.fromY) * (1 - (1 - ty) ** 2);
    this.arcadeBody.reset(feetX, feetY - 10);
    if (t >= 1) {
      this.climb = null;
      this.arcadeBody.enable = true;
      this.arcadeBody.reset(c.toX, c.toY - 10.5);
      this.arcadeBody.setAllowGravity(true);
      this.lastSafe = { x: c.toX, y: c.toY };
      this.water = DRY;
    }
  }

  /** Re-read the water state and react to entering or leaving it. */
  private updateWater(): void {
    const b = this.arcadeBody;
    const prev = this.water;
    const next = waterAt(
      { left: b.left, right: b.right, top: b.top, bottom: b.bottom },
      this.world.water,
    );
    this.water = next;
    const fx = this.world.fx;
    if (!prev.inWater && next.inWater) {
      // entry: splash scaled by impact speed, and the water soaks up most of the fall
      const speed = Math.abs(b.velocity.y);
      fx.splash(this.x, next.surfaceY, speed / TUNING.water.bigSplashSpeed);
      sfx.splash(speed > TUNING.water.bigSplashSpeed);
      b.velocity.y *= TUNING.water.entrySpeedKeep;
      this.pounding = false;
      this.slideMs = 0;
      this.endSpin();
      this.jumpCtl.clear();
    } else if (prev.inWater && !next.inWater) {
      fx.splash(this.x, prev.surfaceY, 0.25);
      this.dripMs = 1300;
    }
    if (!prev.submerged && next.submerged) fx.bubbles(this.x, this.y - 6, 5);
  }

  /** Fixed-step animation update (after physics). */
  stepAnim(dtMs: number): void {
    const b = this.arcadeBody;
    const grounded = this.grounded;
    if (!this.wasGrounded && grounded && !this.inWater && this.fallSpeed > 120) {
      const strength = this.fallSpeed / TUNING.hardLandingSpeed;
      this.rig.land(strength);
      if (strength > 0.7) this.world.fx.dust(this.x, this.feetY, Math.round(4 + strength * 5));
    }
    this.fallSpeed = grounded ? 0 : Math.max(0, b.velocity.y);
    this.wasGrounded = grounded;
    // a somersault ends on landing, or when a slide, ground-pound or climb takes over
    if (this.spinning && (grounded || this.slideMs > 0 || this.pounding || this.climb)) this.endSpin();
    this.anim.step(dtMs, {
      grounded,
      vx: b.velocity.x,
      vy: b.velocity.y,
      runSpeed: this.def.runSpeed,
      crouch: this.crouching,
      sliding: this.slideMs > 0,
      spinning: this.spinning,
      inWater: this.inWater,
      submerged: this.submerged,
      climbing: this.climb !== null,
      onRope: this.onRope,
      dead: this.dead,
      victory: this.victory,
      hurt: this.hurtPending,
    });
    this.hurtPending = false;
  }

  /** Per-frame visual sync: rig pose, blink while invulnerable, drips, shadow, water tint. */
  syncVisuals(frameMs: number, flashing: boolean): void {
    const a = this.arsenal;
    const blocked = !!a && this.submerged && a.current.underwater === 'none';
    this.rig.update(
      frameMs,
      {
        state: this.anim.state,
        stateMs: this.anim.timeMs,
        vx: this.arcadeBody.velocity.x,
        vy: this.arcadeBody.velocity.y,
        runSpeed: this.def.runSpeed,
        aim: this.aim.dir,
        facing: this.facing,
        armReady: !blocked && !this.climbing,
        reload: a?.reloadProgress ?? null,
        swimDir: this.swimDir,
        spinRate: this.spinFast ? TUNING.spin.fastTurnsPerSec : TUNING.spin.turnsPerSec,
      },
      this.x,
      this.feetY,
    );
    this.rig.setVisible(this.shown);
    if (this.invulnMs > 0 && !this.dead) {
      this.rig.setAlpha(flashing ? (Math.floor(this.invulnMs / 60) % 2 === 0 ? 0.35 : 1) : 0.6);
    } else {
      this.rig.setAlpha(1);
    }
    this.rig.setTint(this.submerged ? 0x9fc6d6 : null);
    this.world.fx.placeShadow(
      this.shadow,
      this.x,
      this.feetY,
      16,
      !this.shown || this.inWater || this.onRope,
    );
    if (this.dripMs > 0) {
      this.dripMs -= frameMs;
      if (Math.random() < frameMs / 140)
        this.world.fx.drip(this.x + (Math.random() * 8 - 4), this.y + 2);
    }
  }

  respawnAt(x: number, feetY: number): void {
    this.arcadeBody.enable = true;
    this.arcadeBody.reset(x, feetY - 10);
    this.arcadeBody.setVelocity(0, 0);
    this.arcadeBody.setAllowGravity(true);
    this.slideMs = 0;
    this.surgeMs = 0;
    this.pounding = false;
    this.crouching = false;
    this.spinning = false;
    this.spinFast = false;
    this.climb = null;
    this.waterJumpMs = 0;
    this.water = DRY;
    this.dead = false;
    this.setStanding();
    this.jumpCtl.clear();
    this.anim.reset('idle');
  }

  /** Place the operator at a feet position without physics (insertion rope). */
  placeAt(x: number, feetY: number): void {
    this.arcadeBody.reset(x, feetY - 10);
    this.arcadeBody.setVelocity(0, 0);
  }

  override destroy(fromScene?: boolean): void {
    this.rig.destroy();
    this.shadow.destroy();
    super.destroy(fromScene);
  }
}
