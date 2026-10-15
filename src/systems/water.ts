/**
 * Water volumes and swim physics (pure, no Phaser), so the rules can be unit-tested.
 * A water volume is a rectangle whose top edge is the surface. A body is "in water" once its
 * feet are below the surface, and "submerged" once its head is under.
 */

export interface WaterVolume {
  x: number;
  /** Surface line (top of the volume). */
  y: number;
  w: number;
  h: number;
}

export interface BodyBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface WaterInfo {
  volume: WaterVolume | null;
  inWater: boolean;
  submerged: boolean;
  /** Body centre minus surface: negative above, positive below. */
  depth: number;
  surfaceY: number;
}

const NONE: WaterInfo = {
  volume: null,
  inWater: false,
  submerged: false,
  depth: -Infinity,
  surfaceY: 0,
};

/** How far under the surface the head must be to count as submerged. */
export const SUBMERGE_MARGIN = 3;

/** Downward speed a sinker keeps while standing on the bed (keeps the floor contact). */
export const FLOOR_PRESS = 25;

export function waterAt(b: BodyBox, volumes: readonly WaterVolume[]): WaterInfo {
  const cx = (b.left + b.right) / 2;
  const cy = (b.top + b.bottom) / 2;
  for (const v of volumes) {
    if (cx < v.x || cx > v.x + v.w) continue;
    if (b.bottom <= v.y + 2 || b.top >= v.y + v.h) continue;
    return {
      volume: v,
      inWater: true,
      submerged: b.top > v.y + SUBMERGE_MARGIN,
      depth: cy - v.y,
      surfaceY: v.y,
    };
  }
  return NONE;
}

/** Is a point inside any water volume? (projectiles) */
export function pointInWater(x: number, y: number, volumes: readonly WaterVolume[]): boolean {
  return volumes.some((v) => x >= v.x && x <= v.x + v.w && y >= v.y && y <= v.y + v.h);
}

export interface SwimTuning {
  /** Fraction of velocity lost per second to water drag. */
  drag: number;
  /** Buoyancy force at buoyancy = 1, px/s². */
  buoyancyForce: number;
  /** How far below the surface a floating body's centre rests. */
  floatDepth: number;
  /** Spring that holds floaters at the surface. */
  surfaceSpring: number;
  surfaceDamping: number;
  maxSinkSpeed: number;
  /** Upward speed of a jump from the surface (to climb out onto a quay). */
  waterJumpVelocity: number;
  /** Burst speed of an underwater stroke (jump while submerged), as a multiple of swim speed. */
  strokeBoost: number;
}

export interface SwimProfileLite {
  speed: number;
  accel: number;
  buoyancy: number;
}

export interface SwimInput {
  /** -1..1 analogue horizontal. */
  x: number;
  up: boolean;
  down: boolean;
}

export interface SwimCtx {
  submerged: boolean;
  depth: number;
  /** Standing on the floor of the pool (heavy operators walk the bottom). */
  onFloor: boolean;
}

/** One fixed step of swimming. Returns the new velocity. */
export function swimStep(
  vx: number,
  vy: number,
  inp: SwimInput,
  prof: SwimProfileLite,
  t: SwimTuning,
  ctx: SwimCtx,
  dtMs: number,
): { vx: number; vy: number } {
  const dt = dtMs / 1000;
  const damp = Math.max(0, 1 - t.drag * dt);

  // horizontal: thrust then drag, capped at swim speed
  vx += inp.x * prof.accel * dt;
  vx *= damp;
  vx = Math.max(-prof.speed, Math.min(prof.speed, vx));

  const sinker = prof.buoyancy < 0;
  const vertical = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);

  if (ctx.submerged) {
    vy += vertical * prof.accel * dt;
    // buoyancy pulls floaters up and sinkers down when not actively swimming vertically
    if (vertical === 0) vy -= prof.buoyancy * t.buoyancyForce * dt;
    vy *= damp;
    vy = Math.max(-prof.speed, Math.min(sinker ? t.maxSinkSpeed : prof.speed, vy));
  } else if (sinker && !inp.up) {
    // heavy body at the surface goes under unless it keeps treading
    vy += -prof.buoyancy * t.buoyancyForce * dt;
    vy *= damp;
    vy = Math.min(t.maxSinkSpeed, vy);
  } else if (inp.down) {
    // dive
    vy += prof.accel * dt;
    vy *= damp;
    vy = Math.min(prof.speed, vy);
  } else {
    // float: spring the body centre to just under the surface
    const err = t.floatDepth - ctx.depth;
    vy += (err * t.surfaceSpring - vy * t.surfaceDamping) * dt;
  }
  // on the bed: floaters stop; sinkers keep a light press so they stay in contact and walk it
  if (ctx.onFloor && vy > 0) vy = sinker ? FLOOR_PRESS : 0;
  return { vx, vy };
}
