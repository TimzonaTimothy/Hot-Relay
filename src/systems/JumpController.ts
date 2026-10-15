/**
 * Coyote time + jump buffering (MOVE-03).
 * - Coyote time: you can still jump for a moment after running off a ledge.
 * - Jump buffer: pressing jump just before landing still jumps on landing.
 * Both make jumps feel fair; neither changes jump height.
 */
export class JumpController {
  private coyoteLeft = 0;
  private bufferLeft = 0;

  constructor(
    private readonly coyoteMs: number,
    private readonly bufferMs: number,
  ) {}

  /**
   * Call once per fixed step.
   * @returns true when a jump should start this step.
   */
  step(dtMs: number, grounded: boolean, jumpPressed: boolean): boolean {
    this.coyoteLeft = grounded ? this.coyoteMs : Math.max(0, this.coyoteLeft - dtMs);
    this.bufferLeft = jumpPressed ? this.bufferMs : Math.max(0, this.bufferLeft - dtMs);

    if (this.bufferLeft > 0 && this.coyoteLeft > 0) {
      this.bufferLeft = 0;
      this.coyoteLeft = 0;
      return true;
    }
    return false;
  }

  /** Forget any pending buffered jump (e.g. after a drop-through or respawn). */
  clear(): void {
    this.coyoteLeft = 0;
    this.bufferLeft = 0;
  }
}
