export interface JumpParams {
  coyoteTime: number;
  bufferTime: number;
}

export interface JumpResult {
  /** Start a jump this tick. */
  jump: boolean;
  /** Jump was released while rising: cut the upward velocity. */
  cut: boolean;
}

/** Coyote time, jump buffering and variable jump height, independent of physics. */
export class JumpController {
  private coyote = 0;
  private buffer = 0;
  private rising = false;

  constructor(private readonly p: JumpParams) {}

  tick(dt: number, grounded: boolean, pressed: boolean, held: boolean, vy: number): JumpResult {
    this.coyote = grounded ? this.p.coyoteTime : Math.max(0, this.coyote - dt);
    this.buffer = pressed ? this.p.bufferTime : Math.max(0, this.buffer - dt);
    if (grounded && vy >= 0) this.rising = false;

    let jump = false;
    if (this.buffer > 0 && this.coyote > 0) {
      jump = true;
      this.buffer = 0;
      this.coyote = 0;
      this.rising = true;
    }

    let cut = false;
    if (!jump && this.rising && !held && vy < 0) {
      cut = true;
      this.rising = false;
    }
    if (vy >= 0 && !grounded) this.rising = false;
    return { jump, cut };
  }

  reset(): void {
    this.coyote = 0;
    this.buffer = 0;
    this.rising = false;
  }
}
