/**
 * Collapsing bridges. Step onto one and its segments blow up one after another from the start,
 * a little slower than a running operator, so keep moving or drop into the water below.
 * A destroyed segment loses its collision, its art, and its place in the live platform list
 * (so shadows, ledge climbs and respawns stop treating it as ground). Bridges stay down.
 */
import type Phaser from 'phaser';
import type { PlatformDef } from '../data/stages/types';

/** Delay before the first segment goes, then the gap between segments. */
export const BRIDGE_FUSE_MS = 380;
export const BRIDGE_GAP_MS = 230;

interface Segment {
  def: PlatformDef;
  body: Phaser.GameObjects.Rectangle;
  art: Phaser.GameObjects.Image | null;
  goesAt: number;
  gone: boolean;
}

/** Order in which the segments of one bridge fall: from the end the player stepped on. */
export function collapseOrder(xs: readonly number[], stepX: number): number[] {
  const first = xs.reduce((a, x) => Math.min(a, x), Infinity);
  const last = xs.reduce((a, x) => Math.max(a, x), -Infinity);
  const fromStart = Math.abs(stepX - first) <= Math.abs(stepX - last);
  return xs.map((_, i) => i).sort((a, b) => ((xs[a] ?? 0) - (xs[b] ?? 0)) * (fromStart ? 1 : -1));
}

export class Bridges {
  private readonly bridges = new Map<number, { segs: Segment[]; startedAt: number | null }>();
  collapsed = 0;

  constructor(
    private readonly live: PlatformDef[],
    private readonly onBlast: (x: number, y: number) => void,
    private readonly removeBody: (body: Phaser.GameObjects.Rectangle) => void,
  ) {}

  add(def: PlatformDef, body: Phaser.GameObjects.Rectangle): void {
    if (def.bridge === undefined) return;
    let b = this.bridges.get(def.bridge);
    if (!b) this.bridges.set(def.bridge, (b = { segs: [], startedAt: null }));
    b.segs.push({ def, body, art: null, goesAt: Infinity, gone: false });
  }

  setArt(def: PlatformDef, art: Phaser.GameObjects.Image): void {
    for (const b of this.bridges.values()) for (const s of b.segs) if (s.def === def) s.art = art;
  }

  /** Fixed step: start a bridge when the player stands on it, then drop segments on time. */
  step(nowMs: number, player: { x: number; feetY: number; grounded: boolean }): void {
    for (const b of this.bridges.values()) {
      if (b.startedAt === null) {
        const on = b.segs.some(
          (s) =>
            !s.gone &&
            player.grounded &&
            Math.abs(player.feetY - s.def.y) < 2 &&
            player.x >= s.def.x &&
            player.x <= s.def.x + s.def.w,
        );
        if (on) {
          b.startedAt = nowMs;
          const order = collapseOrder(
            b.segs.map((s) => s.def.x),
            player.x,
          );
          order.forEach((segIndex, k) => {
            const seg = b.segs[segIndex];
            if (seg) seg.goesAt = nowMs + BRIDGE_FUSE_MS + k * BRIDGE_GAP_MS;
          });
        }
        continue;
      }
      for (const s of b.segs) {
        if (s.gone || nowMs < s.goesAt) continue;
        s.gone = true;
        this.collapsed++;
        this.removeBody(s.body);
        s.art?.setVisible(false);
        const i = this.live.indexOf(s.def);
        if (i >= 0) this.live.splice(i, 1);
        this.onBlast(s.def.x + s.def.w / 2, s.def.y + 2);
      }
    }
  }
}
