/**
 * Level geometry queries on stage data (pure, no Phaser): what is under a point, and is there
 * a ledge a swimmer can climb onto. Used for shadows, safe landings and the ledge assist.
 */

export interface Rect {
  x: number;
  /** Top edge. */
  y: number;
  w: number;
  h: number;
}

/**
 * Top of the first surface at or below `fromY` that covers `x` (platform tops only),
 * or null if nothing is within `maxDist`.
 */
export function groundBelow(
  platforms: readonly Rect[],
  x: number,
  fromY: number,
  maxDist = Infinity,
): number | null {
  let best: number | null = null;
  for (const p of platforms) {
    if (x < p.x || x > p.x + p.w) continue;
    if (p.y < fromY - 0.5) continue;
    if (p.y - fromY > maxDist) continue;
    if (best === null || p.y < best) best = p.y;
  }
  return best;
}

/** Is the point inside any platform (used to keep spawns and landings out of terrain)? */
export function insideSolid(platforms: readonly Rect[], x: number, y: number): boolean {
  return platforms.some((p) => x > p.x && x < p.x + p.w && y > p.y && y < p.y + p.h);
}

export interface Ledge {
  /** Where the climber ends up standing: x on the platform, y = its top. */
  x: number;
  y: number;
}

/**
 * A ledge a swimmer at the surface can climb onto, in direction `dir`.
 * The ledge top must be above the swimmer's feet but no more than `reach` above the surface,
 * and its near edge must be within `grab` px of the swimmer's side.
 */
export function ledgeAhead(
  platforms: readonly Rect[],
  body: { left: number; right: number; bottom: number },
  dir: 1 | -1,
  surfaceY: number,
  reach: number,
  grab = 6,
): Ledge | null {
  const side = dir > 0 ? body.right : body.left;
  for (const p of platforms) {
    if (p.y > body.bottom || p.y < surfaceY - reach) continue;
    const edge = dir > 0 ? p.x : p.x + p.w;
    const gap = dir > 0 ? edge - side : side - edge;
    if (gap < -2 || gap > grab) continue;
    const inset = 7;
    return { x: dir > 0 ? p.x + inset : p.x + p.w - inset, y: p.y };
  }
  return null;
}
