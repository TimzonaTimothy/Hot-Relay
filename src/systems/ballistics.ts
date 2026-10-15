/** Thrown and lobbed projectiles (pure). */

/**
 * Launch velocity that lands a projectile `dx, dy` away after `timeS` seconds under gravity `g`
 * (px/s², downward positive).
 */
export function lobVelocity(
  dx: number,
  dy: number,
  g: number,
  timeS: number,
): { vx: number; vy: number } {
  const t = Math.max(0.05, timeS);
  return { vx: dx / t, vy: (dy - 0.5 * g * t * t) / t };
}

/** Flight time for a lob: farther targets get a little longer, within limits. */
export function lobTime(dx: number): number {
  return Math.min(1.25, Math.max(0.7, 0.55 + Math.abs(dx) / 420));
}

/**
 * Rotate a velocity towards a target by at most `maxTurn` radians (homing rockets).
 * Speed is preserved.
 */
export function steerTowards(
  vx: number,
  vy: number,
  tx: number,
  ty: number,
  maxTurn: number,
): { vx: number; vy: number } {
  const speed = Math.hypot(vx, vy);
  if (speed === 0) return { vx, vy };
  const cur = Math.atan2(vy, vx);
  const want = Math.atan2(ty, tx);
  let d = want - cur;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  const a = cur + Math.max(-maxTurn, Math.min(maxTurn, d));
  return { vx: Math.cos(a) * speed, vy: Math.sin(a) * speed };
}
