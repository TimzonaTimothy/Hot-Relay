/**
 * Feel numbers. Units: pixels and seconds (velocities px/s, accelerations px/s²).
 * The world is 960×540 with the player about 80 px tall.
 */
export const TUNING = {
  gravity: 2600,
  maxFall: 1100,

  run: {
    accelGround: 5200,
    accelAir: 3600,
    frictionGround: 6000,
    frictionAir: 1200,
  },

  jump: {
    velocity: 860,
    /** Multiplier applied to upward velocity when jump is released early. */
    cutMultiplier: 0.45,
    coyoteTime: 0.1,
    bufferTime: 0.12,
    /** Seconds a drop-through ignores one-way platforms. */
    dropTime: 0.22,
  },

  bullet: {
    playerSpeed: 1150,
    enemySpeed: 360,
    lifetime: 1.1,
    poolSize: 260,
  },

  hit: {
    playerInvuln: 1.2,
    hitStop: 0.05,
    shake: 0.006,
    shakeDuration: 0.12,
  },

  relay: {
    swapCooldown: 1.6,
    entryInvuln: 0.7,
    /** Seconds per armour point regenerated on the bench. */
    benchRegen: 4,
  },

  camera: {
    lookAhead: 140,
    lerp: 0.12,
    /** Player sits this far left of centre while running right. */
    deadzoneW: 80,
    deadzoneH: 120,
  },

  touch: {
    /** Aim-assist cone in radians: nearest enemy within this angle of the stick gets aimed at. */
    aimAssistCone: 0.6,
    aimAssistRange: 520,
  },

  rifleman: {
    health: 3,
    walkSpeed: 70,
    sightRange: 620,
    telegraph: 0.55,
    burstCount: 3,
    burstGap: 0.14,
    cooldown: 1.6,
    score: 100,
  },

  solo: { lives: 3 },
} as const;
