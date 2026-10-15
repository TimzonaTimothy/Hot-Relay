/**
 * Render detail (PERF-01). Pure logic: which detail level to draw, and the Auto decision.
 *   high → everything
 *   low  → no bg-mid / bg-near parallax, no water light shafts, no grass tufts, no contact shadows
 * Auto starts on high. The stage feeds it gameplay frames only (no cinematics, pause or
 * hit-stop); if the median fps over any rolling 5-second window drops below 50 it switches to
 * low, once, and never switches back up. A manual High/Low setting always wins.
 */

export type DetailSetting = 'auto' | 'high' | 'low';
export type DetailLevel = 'high' | 'low';

export const DETAIL_SETTINGS: readonly DetailSetting[] = ['auto', 'high', 'low'];

export const AUTO_DETAIL = {
  /** Length of the rolling window. */
  windowMs: 5000,
  /** Median fps below this switches to low. */
  minFps: 50,
  /** How often the window's median is checked. */
  checkEveryMs: 250,
  /** Longer frames (tab switches, stalls) are ignored so one can't fill the window. */
  maxFrameMs: 500,
} as const;

export function isDetailSetting(v: unknown): v is DetailSetting {
  return typeof v === 'string' && (DETAIL_SETTINGS as readonly string[]).includes(v);
}

/** Rolling-window fps watcher. Latches to low the first time a full window's median is too slow. */
export class AutoDetail {
  private frames: number[] = [];
  private sum = 0;
  private sinceCheck = 0;
  private lowered = false;
  private lastMedian = 0;

  constructor(private readonly cfg: typeof AUTO_DETAIL = AUTO_DETAIL) {}

  /** Feed one gameplay frame. Returns the level: high until it lowers, then low for good. */
  addFrame(deltaMs: number): DetailLevel {
    if (this.lowered) return 'low';
    if (!(deltaMs > 0) || deltaMs > this.cfg.maxFrameMs) return 'high';
    this.frames.push(deltaMs);
    this.sum += deltaMs;
    // drop the oldest frames while the rest still cover the window
    while (this.frames.length > 1 && this.sum - (this.frames[0] ?? 0) >= this.cfg.windowMs) {
      this.sum -= this.frames.shift() ?? 0;
    }
    this.sinceCheck += deltaMs;
    if (this.sum >= this.cfg.windowMs && this.sinceCheck >= this.cfg.checkEveryMs) {
      this.sinceCheck = 0;
      this.lastMedian = medianFps(this.frames);
      if (this.lastMedian < this.cfg.minFps) this.lowered = true;
    }
    return this.lowered ? 'low' : 'high';
  }

  /** 'low' once lowered, otherwise null (still watching). */
  get decision(): DetailLevel | null {
    return this.lowered ? 'low' : null;
  }

  /** Median fps at the last check. */
  get medianFps(): number {
    return Math.round(this.lastMedian * 10) / 10;
  }

  /** Forget the window (e.g. a new stage) but keep a low decision: never switch back up. */
  clearWindow(): void {
    this.frames = [];
    this.sum = 0;
    this.sinceCheck = 0;
  }
}

function medianFps(frameMs: readonly number[]): number {
  const sorted = [...frameMs].sort((a, b) => a - b);
  const mid = sorted[Math.floor(sorted.length / 2)] ?? 0;
  return mid > 0 ? 1000 / mid : 0;
}

/**
 * Level to draw. The URL flag (?detail=) overrides the saved setting; Auto follows the
 * AutoDetail decision (high until it decides).
 */
export function resolveDetail(
  setting: DetailSetting,
  flag: DetailSetting | null,
  auto: DetailLevel | null,
): DetailLevel {
  const s = flag ?? setting;
  if (s === 'auto') return auto ?? 'high';
  return s;
}
