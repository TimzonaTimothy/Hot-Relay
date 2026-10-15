/**
 * Helicopter insertion as a pure timeline (no Phaser), so it can be unit-tested and reused on
 * any stage with any lead operator.
 *
 * approach → hover → rope → descend → landed → depart
 * Control returns to the player when `depart` begins; the helicopter finishes leaving in the
 * background. `skip()` jumps straight to `depart` with the operator already on the ground.
 *
 * All positions are world pixels. The landing height is passed in by the stage (measured from
 * the level geometry), so the operator can never be dropped into or under the terrain.
 */

export interface InsertionDef {
  /** Where the operator touches down. */
  landX: number;
  /** Which side the helicopter flies in from; it leaves towards the other side. */
  approachFrom: 'left' | 'right';
  /** Height of the helicopter's cabin door above the landing ground while hovering. */
  hoverHeight: number;
  title: string;
  subtitle: string;
}

export type InsertionPhase =
  'approach' | 'hover' | 'rope' | 'descend' | 'landed' | 'depart' | 'done';

export const INSERTION_MS: Record<Exclude<InsertionPhase, 'done'>, number> = {
  approach: 2300,
  hover: 450,
  rope: 550,
  descend: 1150,
  landed: 380,
  depart: 1800,
};

export interface InsertionFrame {
  phase: InsertionPhase;
  /** Time inside the current phase. */
  phaseMs: number;
  /** Helicopter cabin-door position (the rope anchor) and body tilt in radians. */
  heli: { x: number; y: number; tilt: number };
  /** Rope length below the door, 0 when stowed. */
  ropeLen: number;
  /** Operator feet position while riding in or on the rope, or null once landed. */
  rider: { x: number; y: number; onRope: boolean } | null;
  /** Camera focus x (y is left to the stage's normal framing). */
  cameraX: number;
  /** Rotor-wash strength on the ground, 0..1. */
  wash: number;
  /** Stage title card opacity and letterbox amount, 0..1. */
  title: number;
  letterbox: number;
  /** Player has control from here on. */
  controlReturned: boolean;
}

/** Feet hang this far below the door when the operator grabs the rope. */
export const RIDER_HANG = 20;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
const easeInQuad = (t: number) => t * t;

const ORDER: InsertionPhase[] = [
  'approach',
  'hover',
  'rope',
  'descend',
  'landed',
  'depart',
  'done',
];

export class InsertionSequence {
  phase: InsertionPhase = 'approach';
  phaseMs = 0;
  private skipped = false;
  /** Cabin door is a little behind the landing point so the rope hangs at landX. */
  private readonly side: 1 | -1;
  private readonly hoverY: number;
  private readonly startX: number;
  private readonly exitX: number;

  constructor(
    readonly def: InsertionDef,
    /** Top of the ground at landX, measured from the level. */
    readonly groundY: number,
    /** How far off-screen the helicopter starts, in px from landX. */
    approachDistance = 380,
  ) {
    this.side = def.approachFrom === 'left' ? 1 : -1;
    this.hoverY = groundY - def.hoverHeight;
    this.startX = def.landX - this.side * approachDistance;
    this.exitX = def.landX + this.side * (approachDistance + 120);
  }

  get controlReturned(): boolean {
    return this.phase === 'depart' || this.phase === 'done';
  }

  get finished(): boolean {
    return this.phase === 'done';
  }

  get wasSkipped(): boolean {
    return this.skipped;
  }

  /** Total time until the player gets control. */
  static get timeToControlMs(): number {
    return (
      INSERTION_MS.approach +
      INSERTION_MS.hover +
      INSERTION_MS.rope +
      INSERTION_MS.descend +
      INSERTION_MS.landed
    );
  }

  skip(): void {
    if (this.controlReturned) return;
    this.skipped = true;
    this.phase = 'depart';
    this.phaseMs = 0;
  }

  step(dtMs: number): InsertionFrame {
    if (this.phase !== 'done') {
      this.phaseMs += dtMs;
      // carry leftover time into the next phase(s), so big frame steps cannot stall
      while (
        this.phase !== 'done' &&
        this.phaseMs >= INSERTION_MS[this.phase as Exclude<InsertionPhase, 'done'>]
      ) {
        this.phaseMs -= INSERTION_MS[this.phase as Exclude<InsertionPhase, 'done'>];
        this.phase = ORDER[ORDER.indexOf(this.phase) + 1] ?? 'done';
      }
    }
    return this.frame();
  }

  frame(): InsertionFrame {
    const { landX } = this.def;
    const g = this.groundY;
    const s = this.side;
    const ph = this.phase;
    const t = ph === 'done' ? 1 : clamp01(this.phaseMs / INSERTION_MS[ph]);
    const ropeFull = this.def.hoverHeight;
    const out: InsertionFrame = {
      phase: ph,
      phaseMs: this.phaseMs,
      heli: { x: landX, y: this.hoverY, tilt: 0 },
      ropeLen: 0,
      rider: null,
      cameraX: landX,
      wash: 1,
      title: 0,
      letterbox: 1,
      controlReturned: this.controlReturned,
    };

    switch (ph) {
      case 'approach': {
        const e = easeOutCubic(t);
        out.heli.x = this.startX + (landX - this.startX) * e;
        // comes in a little high and settles
        out.heli.y = this.hoverY - 46 * (1 - e);
        // nose down while flying, flaring back as it brakes
        out.heli.tilt = s * (0.2 * (1 - t) - 0.12 * Math.sin(Math.PI * clamp01((t - 0.55) / 0.45)));
        out.wash = clamp01((t - 0.45) / 0.55);
        out.title = clamp01((this.phaseMs - 300) / 350);
        out.cameraX = out.heli.x;
        break;
      }
      case 'hover':
        out.heli.y = this.hoverY + Math.sin(this.phaseMs / 140) * 0.8;
        out.title = 1;
        break;
      case 'rope':
        out.heli.y = this.hoverY + Math.sin(this.phaseMs / 140) * 0.8;
        out.ropeLen = ropeFull * easeOutCubic(t);
        out.title = 1 - clamp01((t - 0.5) / 0.5);
        // operator swings out of the door onto the rope
        out.rider = { x: landX, y: out.heli.y + RIDER_HANG, onRope: true };
        break;
      case 'descend': {
        out.heli.y = this.hoverY + Math.sin(this.phaseMs / 140) * 0.8;
        out.ropeLen = ropeFull;
        const top = this.hoverY + RIDER_HANG;
        const y = top + (g - top) * easeInQuad(t);
        out.rider = {
          x: landX + Math.sin(t * Math.PI * 2) * 1.2 * (1 - t),
          y: Math.min(g, y),
          onRope: true,
        };
        break;
      }
      case 'landed':
        out.heli.y = this.hoverY + Math.sin(this.phaseMs / 140) * 0.8;
        // rope is cut and falls away / is reeled in
        out.ropeLen = ropeFull * (1 - easeOutCubic(t));
        out.letterbox = 1 - t;
        break;
      case 'depart':
      case 'done': {
        const e = ph === 'done' ? 1 : easeInOutSine(t);
        out.heli.x = landX + (this.exitX - landX) * e;
        out.heli.y = this.hoverY - 150 * e;
        out.heli.tilt = s * 0.22 * Math.sin(Math.PI * Math.min(1, t * 1.3));
        out.wash = clamp01(1 - t * 2);
        out.letterbox = 0;
        break;
      }
    }
    return out;
  }
}
