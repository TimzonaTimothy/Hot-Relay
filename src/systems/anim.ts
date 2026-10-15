/**
 * Character animation state machine (pure, no Phaser).
 * Each step it picks the highest-priority state the character's physical situation asks for,
 * then only moves there if the transition table allows it and the current state has been
 * held for its minimum time. The rig blends between poses, so a state change never snaps.
 */

export type AnimState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'jump'
  | 'fall'
  | 'land'
  | 'crouch'
  | 'slide'
  | 'hurt'
  | 'dead'
  | 'victory'
  | 'rope'
  | 'swimSurface'
  | 'swimUnder'
  | 'climb';

export interface AnimInput {
  grounded: boolean;
  vx: number;
  vy: number;
  runSpeed: number;
  crouch: boolean;
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
};

/** States that override any hold time the moment they are requested. */
const FORCED: ReadonlySet<AnimState> = new Set(['dead', 'rope', 'hurt', 'victory']);

const LAND_STATES: AnimState[] = [
  'idle',
  'walk',
  'run',
  'jump',
  'fall',
  'land',
  'crouch',
  'slide',
  'hurt',
  'rope',
];
const WATER_STATES: AnimState[] = [
  'swimSurface',
  'swimUnder',
  'climb',
  'hurt',
  'jump',
  'fall',
  'rope',
];

/** Which states each state may move to. Anything not listed is refused. */
export const TRANSITIONS: Record<AnimState, readonly AnimState[]> = {
  idle: [...LAND_STATES, 'swimSurface', 'swimUnder', 'dead', 'victory'],
  walk: [...LAND_STATES, 'swimSurface', 'swimUnder', 'dead', 'victory'],
  run: [...LAND_STATES, 'swimSurface', 'swimUnder', 'dead', 'victory'],
  jump: [...LAND_STATES, 'swimSurface', 'swimUnder', 'dead', 'victory'],
  fall: [...LAND_STATES, 'swimSurface', 'swimUnder', 'dead', 'victory'],
  land: [...LAND_STATES, 'dead', 'victory'],
  crouch: [...LAND_STATES, 'dead', 'victory'],
  slide: [...LAND_STATES, 'swimSurface', 'swimUnder', 'dead'],
  hurt: [...LAND_STATES, ...WATER_STATES, 'dead'],
  dead: ['idle', 'rope'], // only a respawn leaves "dead"
  victory: ['idle'],
  rope: ['land', 'fall', 'idle', 'dead'],
  swimSurface: [...WATER_STATES, 'idle', 'walk', 'run', 'land', 'dead'],
  swimUnder: [...WATER_STATES, 'idle', 'walk', 'run', 'land', 'dead'],
  climb: ['idle', 'walk', 'run', 'land', 'fall', 'jump', 'swimSurface', 'dead'],
};

/** What the situation asks for, highest priority first. */
export function desiredState(i: AnimInput, current: AnimState): AnimState {
  if (i.dead) return 'dead';
  if (i.onRope) return 'rope';
  if (i.victory) return 'victory';
  if (i.hurt) return 'hurt';
  if (i.climbing) return 'climb';
  if (i.sliding) return 'slide';
  if (i.inWater && !i.grounded) return i.submerged ? 'swimUnder' : 'swimSurface';
  if (!i.grounded) return i.vy < 0 ? 'jump' : 'fall';
  // just touched down after falling: a short landing beat
  if (current === 'fall' || current === 'rope') return 'land';
  if (i.crouch) return 'crouch';
  const speed = Math.abs(i.vx);
  if (speed > i.runSpeed * 0.6) return 'run';
  if (speed > 12) return 'walk';
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
