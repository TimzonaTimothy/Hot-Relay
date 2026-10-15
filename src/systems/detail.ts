/**
 * Render detail (PERF-01). Pure logic: which detail level to draw, and the Auto decision.
 *   high → everything
 *   low  → no bg-mid / bg-near parallax, no water light shafts, no grass tufts, no contact shadows
 * Auto starts on high and drops to low if the median fps over the first few seconds of the
 * stage is below the threshold. It decides once per stage start and never switches back up.
 */
import { FpsMeter } from './FpsMeter';

export type DetailSetting = 'auto' | 'high' | 'low';
export type DetailLevel = 'high' | 'low';

export const DETAIL_SETTINGS: readonly DetailSetting[] = ['auto', 'high', 'low'];

export const AUTO_DETAIL = {
  /** Length of the sampling window at the start of the stage. */
  windowMs: 4000,
  /** Median fps below this switches to low. */
  minFps: 50,
} as const;

export function isDetailSetting(v: unknown): v is DetailSetting {
  return typeof v === 'string' && (DETAIL_SETTINGS as readonly string[]).includes(v);
}

/** Samples frame times for the first `windowMs` and then decides once. */
export class AutoDetail {
  private readonly meter = new FpsMeter(10_000);
  private elapsed = 0;
  private result: DetailLevel | null = null;

  constructor(
    private readonly windowMs: number = AUTO_DETAIL.windowMs,
    private readonly minFps: number = AUTO_DETAIL.minFps,
  ) {}

  /** Feed one frame. Returns the level: high while sampling, then the decision. */
  addFrame(deltaMs: number): DetailLevel {
    if (this.result) return this.result;
    this.meter.addFrame(deltaMs);
    if (deltaMs > 0 && Number.isFinite(deltaMs)) this.elapsed += deltaMs;
    if (this.elapsed >= this.windowMs) {
      this.result = this.meter.percentileFps(50) < this.minFps ? 'low' : 'high';
    }
    return this.result ?? 'high';
  }

  /** null while still sampling. */
  get decision(): DetailLevel | null {
    return this.result;
  }

  /** Median fps measured so far (or at the decision). */
  get medianFps(): number {
    return Math.round(this.meter.percentileFps(50) * 10) / 10;
  }

  reset(): void {
    this.meter.reset();
    this.elapsed = 0;
    this.result = null;
  }
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
