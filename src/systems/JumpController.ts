/**
 * Coyote time + jump buffering (MOVE-03) and the double jump (MOVE-07).
 * - Coyote time: you can still jump for a moment after running off a ledge.
 * - Jump buffer: pressing jump just before landing still jumps on landing.
 * - Double jump: pressing jump again in mid-air jumps once more; landing restores it.
 * Coyote time and the buffer make jumps feel fair; neither changes jump height.
 */
export type JumpKind = 'ground' | 'air';

export class JumpController {
  private coyoteLeft = 0;
  private bufferLeft = 0;
  private airJumpsLeft = 0;

  constructor(
    private readonly coyoteMs: number,
    private readonly bufferMs: number,
    /** Extra jumps allowed in mid-air before landing again. */
    private readonly airJumps = 0,
  ) {}

  /**
   * Call once per fixed step.
   * @returns which jump should start this step, or null.
   */
  step(dtMs: number, grounded: boolean, jumpPressed: boolean): JumpKind | null {
    if (grounded) this.airJumpsLeft = this.airJumps;
    this.coyoteLeft = grounded ? this.coyoteMs : Math.max(0, this.coyoteLeft - dtMs);
    this.bufferLeft = jumpPressed ? this.bufferMs : Math.max(0, this.bufferLeft - dtMs);

    if (this.bufferLeft > 0 && this.coyoteLeft > 0) {
      this.bufferLeft = 0;
      this.coyoteLeft = 0;
      return 'ground';
    }
    // a fresh press in mid-air (past coyote time) spends an air jump
    if (jumpPressed && !grounded && this.airJumpsLeft > 0) {
      this.airJumpsLeft--;
      this.bufferLeft = 0;
      return 'air';
    }
    return null;
  }

  /** Air jumps still available before landing. */
  get airJumpsRemaining(): number {
    return this.airJumpsLeft;
  }

  /** Forget any pending buffered jump (e.g. after a drop-through or respawn). */
  clear(): void {
    this.coyoteLeft = 0;
    this.bufferLeft = 0;
  }

  /** Give the air jump back (e.g. after climbing out of water onto a ledge). */
  refill(): void {
    this.airJumpsLeft = this.airJumps;
  }
}
