export interface Vec {
  x: number;
  y: number;
}

/**
 * 8-way aim from digital directions, Contra rules:
 * no vertical input aims forward; up aims up (diagonal when moving);
 * down on the ground crouches and fires forward; down in the air aims down.
 */
export function aimAngle(
  dir: { left: boolean; right: boolean; up: boolean; down: boolean },
  facing: 1 | -1,
  grounded: boolean,
): number {
  const h = dir.right && !dir.left ? 1 : dir.left && !dir.right ? -1 : 0;
  const v = dir.up && !dir.down ? -1 : dir.down && !dir.up ? 1 : 0;
  const fx = h !== 0 ? h : facing;
  if (v === 0) return fx > 0 ? 0 : Math.PI;
  if (v < 0) return h === 0 ? -Math.PI / 2 : Math.atan2(-1, h);
  if (grounded) return h === 0 ? (fx > 0 ? 0 : Math.PI) : Math.atan2(1, h);
  return h === 0 ? Math.PI / 2 : Math.atan2(1, h);
}

/** Snap an analog stick vector to the nearest of 8 directions; null inside the dead zone. */
export function snap8(x: number, y: number, deadZone = 0.35): Vec | null {
  if (Math.hypot(x, y) < deadZone) return null;
  const a = Math.round(Math.atan2(y, x) / (Math.PI / 4)) * (Math.PI / 4);
  return { x: Math.round(Math.cos(a)), y: Math.round(Math.sin(a)) };
}

export function angleDiff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

/** Touch aim-assist: bend the aim toward the nearest target inside the cone. */
export function assistAim(angle: number, from: Vec, targets: Vec[], cone: number, range: number): number {
  let best = angle;
  let bestDist = Infinity;
  for (const t of targets) {
    const dx = t.x - from.x;
    const dy = t.y - from.y;
    const dist = Math.hypot(dx, dy);
    if (dist > range || dist < 1) continue;
    const a = Math.atan2(dy, dx);
    if (angleDiff(a, angle) <= cone && dist < bestDist) {
      bestDist = dist;
      best = a;
    }
  }
  return best;
}
