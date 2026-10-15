/**
 * Frame-time sampler for H10 (TEST-01, ANALYTICS-04).
 * Reports median (p50) and 10th-percentile (p10, i.e. the slow frames) fps.
 */
export class FpsMeter {
  private samples: number[] = [];

  constructor(private readonly capacity = 3600) {}

  addFrame(deltaMs: number): void {
    if (deltaMs <= 0 || !Number.isFinite(deltaMs)) return;
    this.samples.push(deltaMs);
    if (this.samples.length > this.capacity) this.samples.shift();
  }

  get count(): number {
    return this.samples.length;
  }

  /** fps at the given percentile of frame rate (p10 = 10% of frames were this slow or slower). */
  percentileFps(p: number): number {
    if (this.samples.length === 0) return 0;
    const fps = this.samples.map((d) => 1000 / d).sort((a, b) => a - b);
    const idx = Math.min(fps.length - 1, Math.max(0, Math.floor((p / 100) * (fps.length - 1))));
    return fps[idx] ?? 0;
  }

  summary(): { p50: number; p10: number; frames: number } {
    return {
      p50: Math.round(this.percentileFps(50) * 10) / 10,
      p10: Math.round(this.percentileFps(10) * 10) / 10,
      frames: this.samples.length,
    };
  }

  reset(): void {
    this.samples = [];
  }
}
