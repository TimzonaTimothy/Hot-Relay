/**
 * Fixed-timestep accumulator (CORE-02).
 * Rendering runs at whatever rate the device manages; game logic and physics always
 * advance in identical steps, which keeps feel consistent on slow phones and makes
 * input replays deterministic later (LB-02).
 */
export class FixedStep {
  private accumulator = 0;

  constructor(
    readonly stepMs: number,
    readonly maxFrameMs = 250,
    readonly maxStepsPerFrame = 8,
  ) {
    if (stepMs <= 0) throw new Error('stepMs must be positive');
  }

  /**
   * Feed one rendered frame's delta. Calls `tick` zero or more times.
   * @returns number of steps run this frame.
   */
  advance(frameDeltaMs: number, tick: (stepMs: number) => void): number {
    const delta = Math.min(Math.max(frameDeltaMs, 0), this.maxFrameMs);
    this.accumulator += delta;
    let steps = 0;
    while (this.accumulator >= this.stepMs && steps < this.maxStepsPerFrame) {
      tick(this.stepMs);
      this.accumulator -= this.stepMs;
      steps++;
    }
    // If we hit the cap the device is far too slow; drop the backlog rather than spiral.
    if (steps === this.maxStepsPerFrame && this.accumulator >= this.stepMs) {
      this.accumulator = 0;
    }
    return steps;
  }

  /** 0..1 progress towards the next step (for render interpolation, unused for now). */
  get alpha(): number {
    return this.accumulator / this.stepMs;
  }

  reset(): void {
    this.accumulator = 0;
  }
}
