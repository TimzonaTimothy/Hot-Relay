import { describe, expect, it } from 'vitest';
import {
  ANIM_STATES,
  AnimStateMachine,
  IDLE_INPUT,
  TRANSITIONS,
  type AnimInput,
} from '../src/systems/anim';

const step = (m: AnimStateMachine, patch: Partial<AnimInput>, dt = 16) =>
  m.step(dt, { ...IDLE_INPUT, ...patch });

describe('AnimStateMachine', () => {
  it('walks, then runs as speed rises', () => {
    const m = new AnimStateMachine();
    expect(step(m, { vx: 40 })).toBe('walk');
    expect(step(m, { vx: 110 })).toBe('run');
    expect(step(m, { vx: 0 })).toBe('idle');
  });

  it('standing aim, standing shoot, run-and-shoot', () => {
    const m = new AnimStateMachine();
    expect(step(m, { aiming: true })).toBe('aim');
    expect(step(m, { firing: true })).toBe('shoot');
    expect(step(m, { firing: true, vx: 110 })).toBe('runShoot');
    expect(step(m, { vx: 110 })).toBe('run');
  });

  it('takeoff → somersault → fall → land → idle', () => {
    const m = new AnimStateMachine();
    expect(step(m, { grounded: false, vy: -300, takeoff: true, flipping: true })).toBe('takeoff');
    expect(step(m, { grounded: false, vy: -250, flipping: true }, 80)).toBe('flip');
    expect(step(m, { grounded: false, vy: -50, flipping: true })).toBe('flip');
    expect(step(m, { grounded: false, vy: 60 })).toBe('fall');
    expect(step(m, {})).toBe('land');
    expect(step(m, {}, 50)).toBe('land');
    expect(step(m, {}, 80)).toBe('idle');
  });

  it('landing straight out of a flip still plays the landing beat', () => {
    const m = new AnimStateMachine();
    step(m, { grounded: false, vy: -200, takeoff: true, flipping: true });
    step(m, { grounded: false, vy: 100, flipping: true }, 80);
    expect(step(m, {})).toBe('land');
  });

  it('prone: enter, lie, shoot, then exit before standing moves', () => {
    const m = new AnimStateMachine();
    expect(step(m, { prone: true })).toBe('proneEnter');
    expect(step(m, { prone: true }, 60)).toBe('proneEnter');
    expect(step(m, { prone: true }, 100)).toBe('prone');
    expect(step(m, { prone: true, firing: true })).toBe('proneShoot');
    expect(step(m, { prone: true })).toBe('prone');
    expect(step(m, { vx: 120 })).toBe('proneExit');
    expect(step(m, { vx: 120 }, 60)).toBe('proneExit');
    expect(step(m, { vx: 120 }, 100)).toBe('run');
  });

  it('prone never snaps straight to running or jumping', () => {
    for (const s of ['proneEnter', 'prone', 'proneShoot'] as const) {
      expect(TRANSITIONS[s]).not.toContain('run');
      expect(TRANSITIONS[s]).not.toContain('jump');
      expect(TRANSITIONS[s]).toContain('proneExit');
    }
  });

  it('a dash interrupts other states immediately', () => {
    const m = new AnimStateMachine();
    step(m, { grounded: false, vy: -200, takeoff: true });
    expect(step(m, { dashing: true, grounded: false })).toBe('dash');
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
    for (const s of ANIM_STATES) for (const t of TRANSITIONS[s]) expect(ANIM_STATES).toContain(t);
    expect(TRANSITIONS.dead).not.toContain('run');
  });
});
