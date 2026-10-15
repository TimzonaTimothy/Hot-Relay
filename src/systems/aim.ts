/** 8-way aiming (COMBAT-01) and touch aim-assist (INPUT-04). Pure functions, no Phaser. */

export interface Vec {
  x: number;
  y: number;
}

export interface DirInput {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}

const D = Math.SQRT1_2;

/** The eight unit directions, clockwise from right. */
export const DIRECTIONS: readonly Vec[] = [
  { x: 1, y: 0 },
  { x: D, y: D },
  { x: 0, y: 1 },
  { x: -D, y: D },
  { x: -1, y: 0 },
  { x: -D, y: -D },
  { x: 0, y: -1 },
  { x: D, y: -D },
];

export interface AimResult {
  dir: Vec;
  /** True when standing on the ground holding only "down": the operator crouches. */
  crouch: boolean;
  /** True when the player chose a vertical component (up or down). */
  explicitVertical: boolean;
}

/**
 * Contra-style aim rules:
 * - up → straight up; up + side → diagonal up
 * - down + side → diagonal down
 * - down alone: crouch on the ground (shoot level), shoot straight down in the air
 * - nothing → facing direction
 */
export function aimFromInput(input: DirInput, grounded: boolean, facing: 1 | -1): AimResult {
  const h = input.right === input.left ? 0 : input.right ? 1 : -1;
  const v = input.up === input.down ? 0 : input.up ? -1 : 1;

  if (v === 0) return { dir: { x: h || facing, y: 0 }, crouch: false, explicitVertical: false };
  if (v === 1 && h === 0) {
    return grounded
      ? { dir: { x: facing, y: 0 }, crouch: true, explicitVertical: false }
      : { dir: { x: 0, y: 1 }, crouch: false, explicitVertical: true };
  }
  if (h === 0) return { dir: { x: 0, y: -1 }, crouch: false, explicitVertical: true };
  return { dir: { x: h * D, y: v * D }, crouch: false, explicitVertical: true };
}

/** Snap any vector to the nearest of the 8 directions. */
export function snap8(v: Vec): Vec {
  if (v.x === 0 && v.y === 0) return { x: 1, y: 0 };
  const angle = Math.atan2(v.y, v.x);
  const idx = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
  return DIRECTIONS[idx] ?? { x: 1, y: 0 };
}

/**
 * Aim-assist for touch players: if the player has not chosen a vertical aim,
 * point at the nearest target inside a cone in front of them, snapped to 8 ways.
 * Returns the original direction when no target qualifies.
 */
export function assistAim(
  origin: Vec,
  current: AimResult,
  facing: 1 | -1,
  targets: readonly Vec[],
  range: number,
  coneDeg: number,
): Vec {
  if (current.explicitVertical || current.crouch) return current.dir;
  let best: Vec | null = null;
  let bestDist = range * range;
  // a target counts only if it sits within `coneDeg` of the facing direction
  const cosLimit = Math.cos((coneDeg * Math.PI) / 180);
  for (const t of targets) {
    const dx = t.x - origin.x;
    const dy = t.y - origin.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > bestDist || d2 === 0) continue;
    const len = Math.sqrt(d2);
    // must be in front of the player (within the cone around the facing direction)
    if ((dx / len) * facing < cosLimit) continue;
    bestDist = d2;
    best = { x: dx, y: dy };
  }
  return best ? snap8(best) : current.dir;
}
