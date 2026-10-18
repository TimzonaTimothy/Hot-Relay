/**
 * Feel numbers in one place (RES-08 feel guide starts here).
 * World units are pixels at the 480×270 logical resolution; times are milliseconds.
 * Change values here, not inside entities, so playtest tuning is a one-file diff.
 */
export const TUNING = {
  /** Fixed simulation step: 60 ticks per second. */
  stepMs: 1000 / 60,
  /** Longest frame we will simulate in one go (tab switch, GC pause). */
  maxFrameMs: 250,

  gravity: 1100,
  maxFallSpeed: 420,

  groundAccel: 1500,
  groundDecel: 2000,
  airAccel: 950,
  airDecel: 700,

  /** Multiplier applied to upward speed when jump is released early (variable jump). */
  jumpCutMultiplier: 0.45,
  coyoteMs: 90,
  jumpBufferMs: 110,
  /** Extra jumps in mid-air before landing (MOVE-07 double jump). */
  airJumps: 1,
  /** Air jump speed as a share of the operator's ground jump (a slightly lower hop). */
  airJumpScale: 0.88,
  /** How long one-way platforms ignore the player after down+jump. */
  dropThroughMs: 220,

  crouchHeight: 12,
  standHeight: 20,

  /**
   * After any hit, touching an enemy can't hurt again for this long (so standing in one doesn't
   * drain you every frame). Bullets ignore it: every bullet in a burst lands.
   */
  contactCooldownMs: 900,
  /** Invulnerability after falling out of the level and respawning at the last safe spot. */
  pitRespawnInvulnMs: 900,
  /** Invulnerability when an operator tags in (manual or automatic). */
  tagInInvulnMs: 550,
  /** Invulnerability after the active operator goes down and the next one arrives. */
  downInvulnMs: 1200,

  swapCooldownMs: 1400,
  benchArmourRegenMs: 2000,

  hitStopKillMs: 45,
  hitStopHurtMs: 70,
  shakeHurt: { durationMs: 120, intensity: 0.006 },
  shakeKill: { durationMs: 60, intensity: 0.002 },
  shakePound: { durationMs: 160, intensity: 0.01 },

  cameraLerpX: 0.12,
  cameraLookAhead: 44,

  bulletLifeMs: 900,

  /** Falling into water costs this much damage, then the operator climbs back at the last safe ledge. */
  pitDamage: 2,
  /** Ground-pound shockwave reach from the feet, and its damage and stun. */
  poundRangeX: 72,
  poundRangeY: 40,
  poundDamage: 2,
  poundStunMs: 1100,
  slideMs: 200,
  slideSpeed: 300,
  slideShots: 4,
  slideShotGapMs: 50,
  pierceShot: { damage: 6, pierce: 99, speed: 720, length: 14 },
  contactDamage: 1,

  /** Aim-assist: how far (px) and how wide (degrees off the aim line) it looks for a target. */
  aimAssistRange: 220,
  aimAssistConeDeg: 50,
  /** Auto-fire (touch option) only fires when an enemy is within this distance. */
  autoFireRange: 230,

  /** Knockback when hit: away from the hit, with a small hop (can knock you into water). */
  hurtKnockX: 120,
  hurtKnockY: 150,
  /** Landings faster than this kick up dust and squash the rig. */
  hardLandingSpeed: 260,

  /** Swimming. Per-operator speed, acceleration, buoyancy and air live in operators.ts. */
  water: {
    drag: 2.2,
    buoyancyForce: 320,
    floatDepth: 4,
    surfaceSpring: 60,
    surfaceDamping: 9,
    maxSinkSpeed: 70,
    waterJumpVelocity: 290,
    strokeBoost: 1.6,
    /** Vertical speed kept when hitting the water, so a fall does not drive you to the floor. */
    entrySpeedKeep: 0.35,
    /** After a water jump, swim physics pauses so normal gravity carries you out. */
    waterJumpMs: 260,
    /** A body entering faster than this makes a big splash. */
    bigSplashSpeed: 220,
    /** Ledge assist: how high above the surface a ledge can be and still be climbed. */
    climbReach: 26,
    climbMs: 260,
    /** Gravity and run speed are scaled this much for an operator walking the sea bed. */
    floorWalkSpeed: 0.55,
  },
  /** Air: drowning damage every drownTickMs once air runs out; refill rate is × real time. */
  oxygen: {
    drownTickMs: 1500,
    drownDamage: 1,
    refillRate: 4,
    benchRefillRate: 2,
    lowFrac: 0.3,
  },

  /**
   * Somersault jump (MOVE-08). A running jump tucks into a spin with a fixed, slightly higher
   * arc (releasing jump early does not cut it) and the small crouch hitbox. Firing unfurls the
   * operator into the upright aim pose for the rest of the jump. Standing jumps stay upright.
   */
  spin: {
    /** Horizontal speed (share of run speed) or stick tilt that turns a jump into a somersault. */
    runThreshold: 0.35,
    jumpScale: 1.06,
    turnsPerSec: 2.4,
    /** The double jump is always a quicker flip. */
    fastTurnsPerSec: 3.6,
  },

  // --- operators 5–8 (Tomás, Farida, Sione, KAI-7)
  /** Tomás's sentry: dropped on tag-in, one at a time. */
  sentry: { lifeMs: 9000, range: 170, fireRate: 4, damage: 0.8, bulletSpeed: 360 },
  /** Farida's blast jump: an explosion at her feet that hurts enemies only, and a launch. */
  blast: { radius: 40, damage: 3, launch: 1.3 },
  /** Sione's shield pulse: wipes enemy bullets, pushes and stuns enemies, +1 armour to the squad. */
  pulse: { radius: 96, stunMs: 900, knock: 160 },
  /** KAI-7's phase dash: intangible, passes through enemies and hits each once. */
  phase: { ms: 260, invulnMs: 520, damage: 2 },
  /** KAI-7's counter-blast after absorbing hits: a ring of bolts. */
  counter: { bolts: 10, damage: 1.5, speed: 380, pierce: 2 },
} as const;

export type Tuning = typeof TUNING;
