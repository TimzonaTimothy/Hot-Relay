/**
 * Character animation state machine (pure, no Phaser).
 * Each step it picks the highest-priority state the character's physical situation asks for,
 * then only moves there if the transition table allows it and the current state has been
 * held for its minimum time. The rig blends between poses, so a state change never snaps.
 *
 * Animation never drives physics: the controller decides movement and hitboxes, and this
 * machine only describes what that looks like.
 */

export type AnimState =
  | 'idle'
  | 'aim'
  | 'shoot'
  | 'walk'
  | 'run'
  | 'runShoot'
  | 'takeoff'
  | 'jump'
  | 'flip'
  | 'fall'
  | 'land'
  | 'proneEnter'
  | 'prone'
  | 'proneShoot'
  | 'proneExit'
  | 'slide'
  | 'dash'
  | 'hurt'
  | 'dead'
  | 'victory'
  | 'rope'
  | 'swimSurface'
  | 'swimUnder'
  | 'climb';

export const ANIM_STATES: readonly AnimState[] = [
  'idle',
  'aim',
  'shoot',
  'walk',
  'run',
  'runShoot',
  'takeoff',
  'jump',
  'flip',
  'fall',
  'land',
  'proneEnter',
  'prone',
  'proneShoot',
  'proneExit',
  'slide',
  'dash',
  'hurt',
  'dead',
  'victory',
  'rope',
  'swimSurface',
  'swimUnder',
  'climb',
];

export interface AnimInput {
  grounded: boolean;
  vx: number;
  vy: number;
  runSpeed: number;
  /** Lying prone (the controller has already lowered the hitbox). */
  prone: boolean;
  /** Fired in the last moment (drives shoot / run-and-shoot / prone-shoot). */
  firing: boolean;
  /** Holding an explicit aim (up or diagonal) while standing. */
  aiming: boolean;
  /** True on the step a ground jump launched. */
  takeoff: boolean;
  /** Somersault in progress. */
  flipping: boolean;
  dashing: boolean;
  sliding: boolean;
  inWater: boolean;
  submerged: boolean;
  climbing: boolean;
  onRope: boolean;
  dead: boolean;
  victory: boolean;
  /** True on the step a hit landed. */
  hurt: boolean;
}

/** Minimum time a state is held before another non-forced state may replace it. */
export const MIN_HOLD_MS: Partial<Record<AnimState, number>> = {
  land: 110,
  hurt: 220,
  climb: 260,
  takeoff: 60,
  proneEnter: 130,
  proneExit: 130,
};

/** States that override any hold time the moment they are requested. */
const FORCED: ReadonlySet<AnimState> = new Set(['dead', 'rope', 'hurt', 'victory', 'dash']);

const PRONE: ReadonlySet<AnimState> = new Set(['proneEnter', 'prone', 'proneShoot']);
const AIRBORNE_LANDING: ReadonlySet<AnimState> = new Set(['fall', 'flip', 'rope']);

/** Which states each state may move to. Anything not listed is refused. */
export const TRANSITIONS: Record<AnimState, readonly AnimState[]> = Object.fromEntries(
  ANIM_STATES.map((s) => {
    if (s === 'dead') return [s, ['idle', 'rope']]; // only a respawn leaves "dead"
    if (s === 'victory') return [s, ['idle']];
    if (s === 'rope') return [s, ['land', 'fall', 'idle', 'dead']];
    // prone goes through its exit before standing moves (no snapping from lying to running)
    if (PRONE.has(s))
      return [
        s,
        ANIM_STATES.filter(
          (t) =>
            ![
              'run',
              'walk',
              'runShoot',
              'idle',
              'aim',
              'shoot',
              'takeoff',
              'jump',
              'flip',
            ].includes(t),
        ),
      ];
    return [s, ANIM_STATES.filter((t) => t !== s)];
  }),
) as unknown as Record<AnimState, readonly AnimState[]>;

/** What the situation asks for, highest priority first. */
export function desiredState(i: AnimInput, current: AnimState): AnimState {
  if (i.dead) return 'dead';
  if (i.onRope) return 'rope';
  if (i.victory) return 'victory';
  if (i.hurt) return 'hurt';
  if (i.climbing) return 'climb';
  if (i.sliding) return 'slide';
  if (i.dashing) return 'dash';
  if (i.inWater && !i.grounded) return i.submerged ? 'swimUnder' : 'swimSurface';
  if (!i.grounded) {
    if (i.takeoff || current === 'takeoff')
      return i.takeoff ? 'takeoff' : i.flipping ? 'flip' : 'jump';
    if (i.flipping) return 'flip';
    return i.vy < 0 ? 'jump' : 'fall';
  }
  // just touched down after falling or flipping: a short landing beat
  if (AIRBORNE_LANDING.has(current)) return 'land';
  if (i.prone) return PRONE.has(current) ? (i.firing ? 'proneShoot' : 'prone') : 'proneEnter';
  if (PRONE.has(current)) return 'proneExit';
  const speed = Math.abs(i.vx);
  if (speed > 12) {
    if (i.firing) return 'runShoot';
    return speed > i.runSpeed * 0.6 ? 'run' : 'walk';
  }
  if (i.firing) return 'shoot';
  if (i.aiming) return 'aim';
  return 'idle';
}

export class AnimStateMachine {
  state: AnimState = 'idle';
  previous: AnimState = 'idle';
  /** Time spent in the current state. */
  timeMs = 0;

  step(dtMs: number, input: AnimInput): AnimState {
    this.timeMs += dtMs;
    const want = desiredState(input, this.state);
    if (want === this.state) return this.state;
    const held = this.timeMs >= (MIN_HOLD_MS[this.state] ?? 0);
    if (!held && !FORCED.has(want)) return this.state;
    if (!TRANSITIONS[this.state].includes(want)) return this.state;
    this.previous = this.state;
    this.state = want;
    this.timeMs = 0;
    return this.state;
  }

  /** Respawn or retry: leave any state, including dead. */
  reset(state: AnimState = 'idle'): void {
    this.previous = this.state;
    this.state = state;
    this.timeMs = 0;
  }
}

/** Neutral input, handy for tests and for characters that only use a few fields. */
export const IDLE_INPUT: AnimInput = {
  grounded: true,
  vx: 0,
  vy: 0,
  runSpeed: 120,
  prone: false,
  firing: false,
  aiming: false,
  takeoff: false,
  flipping: false,
  dashing: false,
  sliding: false,
  inWater: false,
  submerged: false,
  climbing: false,
  onRope: false,
  dead: false,
  victory: false,
  hurt: false,
};
