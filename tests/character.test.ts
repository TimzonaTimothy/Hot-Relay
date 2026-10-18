import { describe, expect, it } from 'vitest';
import { Arsenal, IDLE_TOPUP_MS } from '../src/systems/Arsenal';
import { WEAPONS, shotStats } from '../src/data/weapons';
import { OPERATORS, OPERATOR_BY_ID, isUnlocked, resolveSquad } from '../src/data/operators';
import { Squad } from '../src/systems/Squad';
import {
  FLOOR_PRESS,
  swimStep,
  waterAt,
  pointInWater,
  type SwimTuning,
} from '../src/systems/water';
import { groundBelow, insideSolid, ledgeAhead } from '../src/systems/geometry';
import { InsertionSequence, INSERTION_MS } from '../src/systems/insertion';
import { TUNING } from '../src/config/tuning';

const T: SwimTuning = TUNING.water;
const STEP = 1000 / 60;

describe('Arsenal', () => {
  it('spends rounds and reloads automatically when empty', () => {
    const a = new Arsenal(['needle', 'p9']);
    for (let i = 0; i < 6; i++) {
      expect(a.canFire(false)).toBe('ok');
      a.fire();
      a.cooldownMs = 0;
    }
    expect(a.mag).toBe(0);
    expect(a.reloading).toBe(true);
    expect(a.canFire(false)).toBe('reloading');
    let done = false;
    for (let t = 0; t < WEAPONS.needle.reloadMs + 20; t += STEP) done = a.tick(STEP, false) || done;
    expect(done).toBe(true);
    expect(a.mag).toBe(6);
  });

  it('tops up a half-empty magazine after a pause in firing', () => {
    const a = new Arsenal(['kestrel', 'p9']);
    for (let i = 0; i < 20; i++) a.fire();
    expect(a.mag).toBe(10);
    for (let t = 0; t < IDLE_TOPUP_MS + 20; t += STEP) a.tick(STEP, false);
    expect(a.reloading).toBe(true);
  });

  it('switching weapons cancels a reload', () => {
    const a = new Arsenal(['kestrel', 'p9']);
    for (let i = 0; i < 30; i++) a.fire();
    expect(a.reloading).toBe(true);
    expect(a.switchNext().id).toBe('p9');
    expect(a.reloading).toBe(false);
  });

  it('swaps away from a weapon that cannot fire underwater, and back on surfacing', () => {
    const a = new Arsenal(['bulwark', 'p9']);
    expect(a.canFire(true)).toBe('blockedUnderwater');
    expect(a.adaptToWater(true)).toBe(true);
    expect(a.current.id).toBe('p9');
    expect(a.canFire(true)).toBe('ok');
    expect(a.adaptToWater(false)).toBe(true);
    expect(a.current.id).toBe('bulwark');
  });

  it('underwater rounds are slower and weaker, except the speargun', () => {
    expect(shotStats(WEAPONS.bulwark, true)).toBeNull();
    const smg = shotStats(WEAPONS.kestrel, true)!;
    expect(smg.speed).toBeLessThan(WEAPONS.kestrel.bulletSpeed);
    expect(smg.damage).toBeLessThan(WEAPONS.kestrel.damage);
    expect(shotStats(WEAPONS.riptide, true)!.speed).toBe(WEAPONS.riptide.bulletSpeed);
  });
});

describe('roster', () => {
  it('has eight operators with distinct roles and valid weapons', () => {
    expect(OPERATORS.map((o) => o.role)).toEqual([
      'Assault',
      'Heavy',
      'Recon',
      'Amphibious',
      'Engineer',
      'Demolition',
      'Support',
      'Experimental',
    ]);
    for (const o of OPERATORS) for (const w of o.weapons) expect(WEAPONS[w]).toBeDefined();
  });

  it('resolveSquad drops unknown and duplicate ids and fills from the default', () => {
    expect(resolveSquad(['tari', 'tari', 'nobody']).map((o) => o.id)).toEqual([
      'tari',
      'kemi',
      'rurik',
    ]);
    expect(resolveSquad(undefined).map((o) => o.id)).toEqual(['kemi', 'rurik', 'meilin']);
    expect(resolveSquad(['meilin'], 1).map((o) => o.id)).toEqual(['meilin']);
  });
});

describe('Squad air', () => {
  const make = () =>
    new Squad([OPERATOR_BY_ID.kemi, OPERATOR_BY_ID.tari], 'relay', {
      swapCooldownMs: 0,
      benchArmourRegenMs: 2000,
      drownTickMs: 1500,
    });

  it('drains underwater, hits once when air runs out, then every tick', () => {
    const s = make();
    let hits = 0;
    const air = OPERATOR_BY_ID.kemi.swim.oxygenMs;
    for (let t = 0; t < air - 50; t += STEP) hits += s.breathe(STEP, true);
    expect(hits).toBe(0);
    for (let t = 0; t < 100; t += STEP) hits += s.breathe(STEP, true);
    expect(hits).toBe(1);
    for (let t = 0; t < 1500; t += STEP) hits += s.breathe(STEP, true);
    expect(hits).toBe(2);
  });

  it('refills at the surface and on the bench', () => {
    const s = make();
    for (let t = 0; t < 4000; t += STEP) s.breathe(STEP, true);
    expect(s.oxygenFrac).toBeLessThan(1);
    for (let t = 0; t < 2000; t += STEP) s.breathe(STEP, false);
    expect(s.oxygenFrac).toBe(1);

    for (let t = 0; t < 4000; t += STEP) s.breathe(STEP, true);
    s.swap();
    for (let t = 0; t < 3000; t += STEP) s.tick(STEP);
    expect(s.members[0]!.oxygenMs).toBe(OPERATOR_BY_ID.kemi.swim.oxygenMs);
  });

  it('each member keeps their own magazines', () => {
    const s = make();
    s.active.arsenal.fire();
    expect(s.members[0]!.arsenal.mag).toBe(29);
    expect(s.members[1]!.arsenal.mag).toBe(WEAPONS.riptide.magSize);
  });
});

describe('water', () => {
  const pool = [{ x: 100, y: 200, w: 100, h: 80 }];
  const box = (cy: number) => ({ left: 145, right: 155, top: cy - 9, bottom: cy + 9 });

  it('classifies above, wading, at the surface and submerged', () => {
    expect(waterAt(box(180), pool).inWater).toBe(false);
    const surface = waterAt(box(204), pool);
    expect(surface.inWater).toBe(true);
    expect(surface.submerged).toBe(false);
    expect(waterAt(box(240), pool).submerged).toBe(true);
    expect(pointInWater(150, 250, pool)).toBe(true);
    expect(pointInWater(150, 190, pool)).toBe(false);
  });

  it('a floater settles at the surface and never sinks out of reach', () => {
    const prof = OPERATOR_BY_ID.kemi.swim;
    let y = 230; // body centre, submerged
    let vy = 0;
    for (let i = 0; i < 600; i++) {
      const info = waterAt(box(y), pool);
      ({ vy } = swimStep(
        0,
        vy,
        { x: 0, up: false, down: false },
        prof,
        T,
        {
          submerged: info.submerged,
          depth: info.depth,
          onFloor: false,
        },
        STEP,
      ));
      y += (vy * STEP) / 1000;
    }
    expect(Math.abs(y - (200 + T.floatDepth))).toBeLessThan(2);
  });

  it('a sinker goes down unless treading, and stops on the floor', () => {
    const prof = OPERATOR_BY_ID.rurik.swim;
    const r = swimStep(
      0,
      0,
      { x: 0, up: false, down: false },
      prof,
      T,
      { submerged: false, depth: 4, onFloor: false },
      STEP,
    );
    expect(r.vy).toBeGreaterThan(0);
    const tread = swimStep(
      0,
      0,
      { x: 0, up: true, down: false },
      prof,
      T,
      { submerged: false, depth: 4, onFloor: false },
      STEP,
    );
    expect(tread.vy).toBeLessThanOrEqual(0);
    const floor = swimStep(
      0,
      30,
      { x: 0, up: false, down: false },
      prof,
      T,
      { submerged: true, depth: 60, onFloor: true },
      STEP,
    );
    expect(floor.vy).toBe(FLOOR_PRESS);
    const floater = swimStep(
      0,
      30,
      { x: 0, up: false, down: false },
      OPERATOR_BY_ID.kemi.swim,
      T,
      { submerged: true, depth: 60, onFloor: true },
      STEP,
    );
    expect(floater.vy).toBe(0);
  });

  it('horizontal swim speed is capped per operator', () => {
    let vx = 0;
    for (let i = 0; i < 300; i++)
      ({ vx } = swimStep(
        vx,
        0,
        { x: 1, up: false, down: false },
        OPERATOR_BY_ID.tari.swim,
        T,
        { submerged: true, depth: 40, onFloor: false },
        STEP,
      ));
    expect(vx).toBeLessThanOrEqual(OPERATOR_BY_ID.tari.swim.speed);
    expect(vx).toBeGreaterThan(OPERATOR_BY_ID.tari.swim.speed * 0.8);
  });
});

describe('geometry', () => {
  const plats = [
    { x: 0, y: 240, w: 100, h: 120 },
    { x: 148, y: 240, w: 100, h: 120 },
    { x: 100, y: 340, w: 48, h: 20 },
    { x: 20, y: 200, w: 40, h: 6 },
  ];

  it('finds the ground under a point', () => {
    expect(groundBelow(plats, 30, 0)).toBe(200);
    expect(groundBelow(plats, 30, 210)).toBe(240);
    expect(groundBelow(plats, 120, 0)).toBe(340);
    expect(groundBelow(plats, 120, 0, 100)).toBeNull();
    expect(insideSolid(plats, 50, 260)).toBe(true);
  });

  it('finds a climbable ledge beside a swimmer at the surface', () => {
    const body = { left: 136, right: 146, bottom: 266 };
    expect(ledgeAhead(plats, body, 1, 252, 26)).toEqual({ x: 155, y: 240 });
    expect(ledgeAhead(plats, { left: 110, right: 120, bottom: 266 }, 1, 252, 26)).toBeNull();
    expect(ledgeAhead(plats, { left: 102, right: 112, bottom: 266 }, -1, 252, 26)).toEqual({
      x: 93,
      y: 240,
    });
  });
});

describe('InsertionSequence', () => {
  const def = {
    landX: 120,
    approachFrom: 'left' as const,
    hoverHeight: 92,
    title: 'T',
    subtitle: 'S',
  };

  it('lands the operator exactly on the measured ground and then returns control', () => {
    const seq = new InsertionSequence(def, 240);
    let lowest = -Infinity;
    let t = 0;
    while (!seq.controlReturned && t < 20000) {
      const f = seq.step(STEP);
      if (f.rider) lowest = Math.max(lowest, f.rider.y);
      t += STEP;
    }
    expect(lowest).toBeLessThanOrEqual(240);
    expect(lowest).toBeGreaterThan(236);
    expect(t).toBeGreaterThanOrEqual(InsertionSequence.timeToControlMs - STEP);
    expect(t).toBeLessThan(InsertionSequence.timeToControlMs + 2 * STEP);
  });

  it('flies in from off-screen and leaves to the other side', () => {
    const seq = new InsertionSequence(def, 240);
    expect(seq.step(1).heli.x).toBeLessThan(0);
    while (!seq.finished) seq.step(50);
    expect(seq.frame().heli.x).toBeGreaterThan(400);

    const right = new InsertionSequence({ ...def, landX: 300, approachFrom: 'right' }, 240);
    expect(right.step(1).heli.x).toBeGreaterThan(600);
  });

  it('skip hands over control at once with nobody on the rope', () => {
    const seq = new InsertionSequence(def, 240);
    seq.step(500);
    seq.skip();
    const f = seq.step(STEP);
    expect(f.controlReturned).toBe(true);
    expect(f.rider).toBeNull();
    expect(seq.wasSkipped).toBe(true);
  });

  it('a huge frame step cannot stall the timeline', () => {
    const seq = new InsertionSequence(def, 240);
    seq.step(Object.values(INSERTION_MS).reduce((a, b) => a + b, 0) + 10);
    expect(seq.finished).toBe(true);
  });
});

describe('save data for the character system', () => {
  it('keeps the picked squad and seen insertions, drops junk', async () => {
    const { migrate } = await import('../src/systems/SaveStore');
    const d = migrate({
      lastSquad: ['tari', 7, 'kemi', 'rurik', 'meilin'],
      seenInsertion: { 'greybox-01': true, x: 'yes' },
    });
    expect(d.lastSquad).toEqual(['tari', 'kemi', 'rurik']);
    expect(d.seenInsertion).toEqual({ 'greybox-01': true });
    const old = migrate({ settings: {} });
    expect(old.lastSquad).toEqual([]);
    expect(old.seenInsertion).toEqual({});
  });
});

describe('animation edge cases', () => {
  it('can grab the rope from a fall, and lands from it', async () => {
    const { AnimStateMachine } = await import('../src/systems/anim');
    const m = new AnimStateMachine();
    const base = {
      grounded: false,
      vx: 0,
      vy: 50,
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
    expect(m.step(16, base)).toBe('fall');
    expect(m.step(16, { ...base, onRope: true })).toBe('rope');
    expect(m.step(16, { ...base, grounded: true, vy: 0 })).toBe('land');
  });

  it('hurt while swimming returns to swimming, not a land state', async () => {
    const { AnimStateMachine } = await import('../src/systems/anim');
    const m = new AnimStateMachine();
    const w = {
      grounded: false,
      vx: 0,
      vy: 0,
      runSpeed: 120,
      crouch: false,
      sliding: false,
      spinning: false,
      inWater: true,
      submerged: true,
      climbing: false,
      onRope: false,
      dead: false,
      victory: false,
      hurt: false,
    };
    m.step(16, w);
    expect(m.step(16, { ...w, hurt: true })).toBe('hurt');
    expect(m.step(300, w)).toBe('swimUnder');
  });
});

describe('analogue input', () => {
  it('keyboard gives full-speed ±1 on axisX', async () => {
    const { InputManager } = await import('../src/systems/InputManager');
    const im = new InputManager();
    const listeners: Record<string, (e: unknown) => void> = {};
    const fake = {
      addEventListener: (t: string, fn: (e: unknown) => void) => (listeners[t] = fn),
      removeEventListener: () => {},
    };
    im.attach(fake as unknown as Window);
    listeners.keydown?.({ code: 'ArrowLeft', preventDefault() {} });
    expect(im.consume().axisX).toBe(-1);
    listeners.keyup?.({ code: 'ArrowLeft' });
    expect(im.consume().axisX).toBe(0);
    im.setTouchAxis(0.3);
    const ax = im.consume().axisX;
    expect(ax).toBeGreaterThan(0);
    expect(ax).toBeLessThan(0.5);
  });
});

describe('operators 5–8 (Tomás, Farida, Sione, KAI-7)', () => {
  const by = (id: string) => OPERATOR_BY_ID[id as keyof typeof OPERATOR_BY_ID];
  const sopts = { swapCooldownMs: 1000, benchArmourRegenMs: 4000 };

  it('every operator has distinct colours, valid weapons and a unique entry attack', () => {
    expect(OPERATORS).toHaveLength(8);
    expect(new Set(OPERATORS.map((o) => o.color)).size).toBe(8);
    expect(new Set(OPERATORS.map((o) => o.entry)).size).toBe(8);
    for (const o of OPERATORS) for (const w of o.weapons) expect(WEAPONS[w]).toBeDefined();
  });

  it('Sione makes the bench regain armour faster, even from the bench', () => {
    const plain = new Squad([by('kemi'), by('rurik'), by('meilin')], 'relay', sopts);
    const support = new Squad([by('kemi'), by('rurik'), by('sione')], 'relay', sopts);
    expect(plain.benchRegenBoost).toBe(1);
    expect(support.benchRegenBoost).toBe(1.75);
    for (const s of [plain, support]) {
      s.members[1]!.armour = 0;
      s.tick(2500);
    }
    expect(plain.members[1]!.armour).toBe(0); // needs 4000 ms
    expect(support.members[1]!.armour).toBe(1); // needs ~2286 ms
  });

  it('the boost stops when Sione is down', () => {
    const s = new Squad([by('kemi'), by('rurik'), by('sione')], 'relay', sopts);
    s.members[2]!.down = true;
    expect(s.benchRegenBoost).toBe(1);
  });

  it('KAI-7 loses armour while active, and keeps it on the bench', () => {
    const s = new Squad([by('kai7'), by('kemi'), by('rurik')], 'relay', sopts);
    expect(s.active.armour).toBe(3);
    s.tick(6000);
    expect(s.active.armour).toBe(2);
    s.swap();
    const kai = s.members[0]!;
    s.tick(6000);
    expect(kai.armour).toBe(3); // drain stopped, bench regen refilled it
  });

  it('KAI-7 is locked until a stage is cleared; the rest are open', () => {
    expect(isUnlocked(by('kai7'), 0)).toBe(false);
    expect(isUnlocked(by('kai7'), 1)).toBe(true);
    for (const o of OPERATORS.filter((x) => x.id !== 'kai7')) expect(isUnlocked(o, 0)).toBe(true);
  });

  it('shotgun and grenade weapons are described by data', () => {
    expect(WEAPONS.tala.pellets).toBeGreaterThan(1);
    expect(WEAPONS.tremor.grenade?.armMs).toBeGreaterThan(0);
    expect(WEAPONS.tremor.underwater).toBe('none');
  });
});
