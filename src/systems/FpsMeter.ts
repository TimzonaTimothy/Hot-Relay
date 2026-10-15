/** Rolling frame-time samples with median and 10th-percentile fps. */
export class FpsMeter {
  private samples: number[] = [];
  constructor(private readonly size = 600) {}

  push(frameMs: number): void {
    if (frameMs <= 0) return;
    this.samples.push(1000 / frameMs);
    if (this.samples.length > this.size) this.samples.shift();
  }

  get count(): number {
    return this.samples.length;
  }

  percentile(p: number): number {
    if (!this.samples.length) return 0;
    const s = [...this.samples].sort((a, b) => a - b);
    const i = Math.min(s.length - 1, Math.max(0, Math.floor((p / 100) * (s.length - 1))));
    return s[i];
  }

  get p50(): number {
    return this.percentile(50);
  }

  get p10(): number {
    return this.percentile(10);
  }

  reset(): void {
    this.samples = [];
  }
}
