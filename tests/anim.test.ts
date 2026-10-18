import { describe, expect, it } from 'vitest';
import {
  AnimStateMachine,
  TRANSITIONS,
  desiredState,
  type AnimInput,
  type AnimState,
} from '../src/systems/anim';

const base: AnimInput = {
  grounded: true,
  vx: 0,
  vy: 0,
  runSpeed: 120,
  crouch: false,
  sliding: false,
  spinning: false,
  inWater: false,
  submerged: false,
  climbing: false,
  onRope: false,
  dead: false,
  victory: false,
  hurt: false,
};
const step = (m: AnimStateMachine, patch: Partial<AnimInput>, dt = 16) =>
  m.step(dt, { ...base, ...patch });

describe('AnimStateMachine', () => {
  it('walks, then runs as speed rises', () => {
    const m = new AnimStateMachine();
    expect(step(m, { vx: 40 })).toBe('walk');
    expect(step(m, { vx: 110 })).toBe('run');
    expect(step(m, { vx: 0 })).toBe('idle');
  });

  it('jump → fall → land → idle, with a short landing beat', () => {
    const m = new AnimStateMachine();
    expect(step(m, { grounded: false, vy: -300 })).toBe('jump');
    expect(step(m, { grounded: false, vy: 50 })).toBe('fall');
    expect(step(m, {})).toBe('land');
    expect(step(m, {}, 50)).toBe('land'); // still inside the 110 ms hold
    expect(step(m, {}, 80)).toBe('idle');
  });

  it('a hit interrupts anything except death, and holds briefly', () => {
    const m = new AnimStateMachine();
    step(m, { vx: 120 });
    expect(step(m, { vx: 120, hurt: true })).toBe('hurt');
    expect(step(m, { vx: 120 }, 100)).toBe('hurt');
    expect(step(m, { vx: 120 }, 150)).toBe('run');
  });

  it('death is final until reset', () => {
    const m = new AnimStateMachine();
    expect(step(m, { dead: true })).toBe('dead');
    expect(step(m, { vx: 120 })).toBe('dead');
    m.reset();
    expect(step(m, {})).toBe('idle');
  });

  it('swims at the surface and underwater, and climbs out', () => {
    const m = new AnimStateMachine();
    expect(step(m, { grounded: false, inWater: true })).toBe('swimSurface');
    expect(step(m, { grounded: false, inWater: true, submerged: true })).toBe('swimUnder');
    expect(step(m, { grounded: false, inWater: true, climbing: true })).toBe('climb');
    expect(step(m, { grounded: true }, 300)).toBe('idle');
  });

  it('a heavy operator walking the sea bed uses land states', () => {
    const m = new AnimStateMachine();
    expect(step(m, { grounded: true, inWater: true, submerged: true, vx: 30 })).toBe('walk');
  });

  it('rope descent ends in a landing', () => {
    const m = new AnimStateMachine();
    expect(step(m, { onRope: true, grounded: false })).toBe('rope');
    expect(step(m, { grounded: true })).toBe('land');
  });

  it('every transition target is a real state, and dead can only be left by reset', () => {
    const states = Object.keys(TRANSITIONS) as AnimState[];
    for (const s of states) for (const t of TRANSITIONS[s]) expect(states).toContain(t);
    expect(TRANSITIONS.dead).not.toContain('run');
  });
});

describe('somersault (MOVE-08)', () => {
  it('an airborne spinning operator is in the spin state, rising or falling', () => {
    expect(desiredState({ ...base, grounded: false, vy: -200, spinning: true }, 'run')).toBe('spin');
    expect(desiredState({ ...base, grounded: false, vy: 150, spinning: true }, 'spin')).toBe('spin');
  });
  it('unfurling (firing) drops back to the normal jump and fall poses', () => {
    expect(desiredState({ ...base, grounded: false, vy: -100 }, 'spin')).toBe('jump');
    expect(desiredState({ ...base, grounded: false, vy: 100 }, 'spin')).toBe('fall');
  });
  it('touching down from a spin plays the landing beat', () => {
    expect(desiredState({ ...base }, 'spin')).toBe('land');
  });
  it('the machine can enter and leave spin', () => {
    const m = new AnimStateMachine();
    m.step(16, { ...base, vx: 120 });
    m.step(16, { ...base, grounded: false, vx: 120, vy: -300, spinning: true });
    expect(m.state).toBe('spin');
    m.step(16, { ...base, grounded: true });
    expect(m.state).toBe('land');
  });
  it('swimming wins over spinning', () => {
    expect(desiredState({ ...base, grounded: false, inWater: true, spinning: true }, 'spin')).toBe('swimSurface');
  });
});
