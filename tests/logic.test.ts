import { describe, expect, it } from 'vitest';
import { FixedStep } from '../src/systems/FixedStep';
import { JumpController } from '../src/systems/JumpController';
import { Squad } from '../src/systems/Squad';
import { OPERATORS } from '../src/data/operators';
import { aimFromInput, assistAim, snap8 } from '../src/systems/aim';
import { computeRank, formatTime, isBetterRun } from '../src/systems/rank';
import { FpsMeter } from '../src/systems/FpsMeter';
import { MemoryStore, SaveStore, defaultSave, migrate } from '../src/systems/SaveStore';
import { GREYBOX_01 } from '../src/data/stages/greybox01';

const opts = { swapCooldownMs: 1000, benchArmourRegenMs: 2000, soloLives: 3 };
const none = { left: false, right: false, up: false, down: false };

describe('FixedStep', () => {
  it('runs whole steps and carries the remainder', () => {
    const fs = new FixedStep(10);
    let ticks = 0;
    expect(fs.advance(25, () => ticks++)).toBe(2);
    expect(fs.advance(5, () => ticks++)).toBe(1);
    expect(ticks).toBe(3);
  });
  it('caps huge frames so a tab switch cannot spiral', () => {
    const fs = new FixedStep(10, 250, 8);
    expect(fs.advance(10_000, () => {})).toBe(8);
    expect(fs.advance(0, () => {})).toBe(0);
  });
});

describe('JumpController', () => {
  it('jumps immediately when grounded', () => {
    const j = new JumpController(90, 110);
    expect(j.step(16, true, true)).toBe('ground');
  });
  it('allows coyote-time jumps just after leaving a ledge', () => {
    const j = new JumpController(90, 110);
    j.step(16, true, false);
    expect(j.step(50, false, true)).toBe('ground');
  });
  it('refuses jumps after coyote time runs out', () => {
    const j = new JumpController(90, 110);
    j.step(16, true, false);
    j.step(100, false, false);
    expect(j.step(16, false, true)).toBeNull();
  });
  it('buffers a press made just before landing', () => {
    const j = new JumpController(90, 110);
    j.step(16, false, true); // pressed in the air
    expect(j.step(60, true, false)).toBe('ground'); // lands within the buffer
  });
});

describe('Double jump (MOVE-07)', () => {
  it('a second press in mid-air jumps again, once', () => {
    const j = new JumpController(90, 110, 1);
    expect(j.step(16, true, true)).toBe('ground');
    j.step(100, false, false); // rising, past coyote time
    expect(j.step(16, false, true)).toBe('air');
    expect(j.airJumpsRemaining).toBe(0);
    expect(j.step(16, false, true)).toBeNull();
  });
  it('landing gives the air jump back', () => {
    const j = new JumpController(90, 110, 1);
    j.step(16, true, true);
    j.step(100, false, false);
    j.step(16, false, true);
    j.step(16, true, false);
    expect(j.airJumpsRemaining).toBe(1);
  });
  it('walking off a ledge still leaves the air jump', () => {
    const j = new JumpController(90, 110, 1);
    j.step(16, true, false);
    j.step(120, false, false); // coyote time has run out
    expect(j.step(16, false, true)).toBe('air');
  });
  it('within coyote time a press is the normal ground jump, not the air jump', () => {
    const j = new JumpController(90, 110, 1);
    j.step(16, true, false);
    expect(j.step(40, false, true)).toBe('ground');
    expect(j.airJumpsRemaining).toBe(1);
  });
  it('no air jumps unless configured', () => {
    const j = new JumpController(90, 110);
    j.step(16, true, false);
    j.step(120, false, false);
    expect(j.step(16, false, true)).toBeNull();
  });
});

describe('Squad (Relay Swap)', () => {
  it('swaps to the next standing operator and applies a cooldown', () => {
    const s = new Squad(OPERATORS, 'relay', opts);
    expect(s.swap()).toBe(1);
    expect(s.swap()).toBeNull();
    s.tick(1000);
    expect(s.swap()).toBe(2);
    expect(s.swaps).toBe(2);
  });
  it('armour absorbs damage before health', () => {
    const s = new Squad(OPERATORS, 'relay', opts);
    const r = s.damage(1);
    expect(r).toEqual({ armourLost: 1, hpLost: 0, downed: false });
    expect(s.active.hp).toBe(OPERATORS[0]!.maxHp);
  });
  it('auto tags in the next operator when the active one goes down', () => {
    const s = new Squad(OPERATORS, 'relay', opts);
    s.damage(99);
    expect(s.activeDown()).toEqual({ kind: 'swapped', to: 1 });
    expect(s.members[0]!.down).toBe(true);
    expect(s.downs).toBe(1);
  });
  it('fails only when all three are down', () => {
    const s = new Squad(OPERATORS, 'relay', opts);
    expect(s.activeDown().kind).toBe('swapped');
    expect(s.activeDown().kind).toBe('swapped');
    expect(s.activeDown().kind).toBe('allDown');
    expect(s.allDown).toBe(true);
  });
  it('skips fallen operators when swapping', () => {
    const s = new Squad(OPERATORS, 'relay', opts);
    s.activeDown(); // Kemi down → Rurik
    s.tick(1000);
    expect(s.swap()).toBe(2); // Mei-Lin
    s.tick(1000);
    expect(s.swap()).toBe(1); // back to Rurik, not Kemi
  });
  it('regenerates armour only for benched, standing operators', () => {
    const s = new Squad(OPERATORS, 'relay', opts);
    s.damage(1); // Kemi loses armour
    s.swap(); // Kemi benched
    s.tick(2000);
    expect(s.members[0]!.armour).toBe(OPERATORS[0]!.maxArmour);
  });
  it('solo mode has lives and no swapping', () => {
    const s = new Squad(OPERATORS, 'solo', opts);
    expect(s.members).toHaveLength(1);
    expect(s.canSwap()).toBe(false);
    expect(s.activeDown()).toEqual({ kind: 'respawn', livesLeft: 2 });
    expect(s.active.hp).toBe(OPERATORS[0]!.maxHp);
    s.activeDown();
    expect(s.activeDown().kind).toBe('allDown');
  });
  it('reviveAll restores the squad for a checkpoint retry', () => {
    const s = new Squad(OPERATORS, 'relay', opts);
    s.activeDown();
    s.activeDown();
    s.reviveAll();
    expect(s.standingCount).toBe(3);
    expect(s.activeIndex).toBe(0);
  });
});

describe('aim', () => {
  it('faces forward with no input', () => {
    expect(aimFromInput(none, true, -1).dir).toEqual({ x: -1, y: 0 });
  });
  it('aims up and diagonally', () => {
    expect(aimFromInput({ ...none, up: true }, true, 1).dir).toEqual({ x: 0, y: -1 });
    const d = aimFromInput({ ...none, up: true, right: true }, true, 1).dir;
    expect(d.x).toBeCloseTo(Math.SQRT1_2);
    expect(d.y).toBeCloseTo(-Math.SQRT1_2);
  });
  it('crouches on the ground and shoots down in the air', () => {
    expect(aimFromInput({ ...none, down: true }, true, 1).crouch).toBe(true);
    expect(aimFromInput({ ...none, down: true }, false, 1).dir).toEqual({ x: 0, y: 1 });
  });
  it('snaps vectors to 8 directions', () => {
    expect(snap8({ x: 10, y: -9 }).x).toBeCloseTo(Math.SQRT1_2);
    expect(snap8({ x: -5, y: 0.5 })).toEqual({ x: -1, y: 0 });
  });
  it('assist targets a raised enemy in front, ignores ones behind', () => {
    const base = aimFromInput(none, true, 1);
    const up = assistAim({ x: 0, y: 0 }, base, 1, [{ x: 100, y: -95 }], 220, 50);
    expect(up.y).toBeLessThan(0);
    const behind = assistAim({ x: 0, y: 0 }, base, 1, [{ x: -50, y: 0 }], 220, 50);
    expect(behind).toEqual({ x: 1, y: 0 });
  });
});

describe('rank', () => {
  it('ranks clean fast runs S and any continue C', () => {
    expect(computeRank({ timeMs: 100, downs: 0, continues: 0, parTimeMs: 150 })).toBe('S');
    expect(computeRank({ timeMs: 100, downs: 1, continues: 0, parTimeMs: 150 })).toBe('A');
    expect(computeRank({ timeMs: 900, downs: 2, continues: 0, parTimeMs: 150 })).toBe('B');
    expect(computeRank({ timeMs: 100, downs: 0, continues: 1, parTimeMs: 150 })).toBe('C');
  });
  it('compares runs by rank, then time', () => {
    expect(isBetterRun({ rank: 'A', timeMs: 900 }, { rank: 'B', timeMs: 100 })).toBe(true);
    expect(isBetterRun({ rank: 'A', timeMs: 900 }, { rank: 'A', timeMs: 800 })).toBe(false);
    expect(isBetterRun({ rank: 'C', timeMs: 1 }, undefined)).toBe(true);
  });
  it('formats times', () => {
    expect(formatTime(125_430)).toBe('2:05.43');
  });
});

describe('FpsMeter', () => {
  it('reports median and slow-frame fps', () => {
    const m = new FpsMeter();
    for (let i = 0; i < 90; i++) m.addFrame(1000 / 60);
    for (let i = 0; i < 10; i++) m.addFrame(1000 / 30);
    const s = m.summary();
    expect(s.p50).toBeCloseTo(60, 0);
    expect(s.p10).toBeLessThan(45);
  });
});

describe('SaveStore', () => {
  it('migrates garbage to defaults without throwing', () => {
    expect(migrate(null)).toEqual(defaultSave());
    expect(migrate('nope')).toEqual(defaultSave());
  });
  it('keeps valid fields and repairs bad ones', () => {
    const m = migrate({
      settings: { screenShake: false, volume: 9, touchControls: 'sideways' },
      bestByStage: { a: { rank: 'S', timeMs: 5 }, b: { rank: 'Z', timeMs: 1 } },
    });
    expect(m.settings.screenShake).toBe(false);
    expect(m.settings.volume).toBe(1);
    expect(m.settings.touchControls).toBe('auto');
    expect(Object.keys(m.bestByStage)).toEqual(['a']);
  });
  it('round-trips through a store', async () => {
    const kv = new MemoryStore();
    const a = new SaveStore(kv);
    await a.load();
    await a.updateSettings({ autoFire: true });
    const b = new SaveStore(kv);
    expect((await b.load()).settings.autoFire).toBe(true);
  });
});

describe('greybox stage data', () => {
  it('starts on solid ground and has a reachable goal', () => {
    const s = GREYBOX_01;
    const startGround = s.platforms.find(
      (p) => p.kind === 'solid' && p.x <= s.start.x && p.x + p.w >= s.start.x,
    );
    expect(startGround).toBeDefined();
    expect(s.goal.x).toBeLessThan(s.width);
    expect(s.checkpoints.length).toBeGreaterThanOrEqual(2);
  });
  it('places every enemy above some platform', () => {
    for (const e of GREYBOX_01.enemies) {
      const under = GREYBOX_01.platforms.some((p) => e.x >= p.x && e.x <= p.x + p.w && p.y >= e.y);
      expect(under, `enemy at ${e.x},${e.y}`).toBe(true);
    }
  });
});

describe('InputManager', () => {
  it('a touch tap shorter than a frame still registers one press', async () => {
    const { InputManager } = await import('../src/systems/InputManager');
    const im = new InputManager();
    im.setTouch('fire', true);
    im.setTouch('fire', false);
    const f = im.consume();
    expect(f.firePressed).toBe(true);
    expect(f.fireHeld).toBe(false);
    expect(im.consume().firePressed).toBe(false);
  });
});

describe('InputManager press latching', () => {
  it('counts a held touch press exactly once across frames', async () => {
    const { InputManager } = await import('../src/systems/InputManager');
    const im = new InputManager();
    im.setTouch('jump', true);
    expect(im.consume().jumpPressed).toBe(true);
    // pretend frames pass while the button stays held: no second press
    (im as unknown as { pollGamepad: () => void }).pollGamepad = () => {};
    im.update();
    expect(im.consume().jumpPressed).toBe(false);
    expect(im.consume().jumpPressed).toBe(false);
  });
});
