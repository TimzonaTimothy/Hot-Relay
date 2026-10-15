/** Accumulates frame time and reports how many fixed ticks to run. */
export class FixedStep {
  private acc = 0;
  constructor(
    readonly stepMs: number,
    /** Cap so a long stall (tab switch, GC) can't trigger a spiral of catch-up ticks. */
    readonly maxSteps = 5,
  ) {}

  advance(frameMs: number): number {
    this.acc += Math.max(0, frameMs);
    let steps = Math.floor(this.acc / this.stepMs);
    if (steps > this.maxSteps) {
      steps = this.maxSteps;
      this.acc = 0;
    } else {
      this.acc -= steps * this.stepMs;
    }
    return steps;
  }

  reset(): void {
    this.acc = 0;
  }
}
