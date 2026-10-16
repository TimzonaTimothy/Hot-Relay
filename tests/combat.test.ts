import { describe, expect, it } from 'vitest';
import { DEFAULT_KEYS, findConflicts, keyMap, resolveBindings } from '../src/config/controls';
import { Arsenal, PICKUP_SLOT } from '../src/systems/Arsenal';
import { WEAPONS } from '../src/data/weapons';
import { lobTime, lobVelocity, steerTowards } from '../src/systems/ballistics';
import { segmentBlocked } from '../src/systems/geometry';
import { collapseOrder } from '../src/stage/Bridges';
import { TUNING } from '../src/config/tuning';

const STEP = 1000 / 60;

describe('control layout', () => {
  it('defaults follow the brief and have no conflicting keys', () => {
    expect(DEFAULT_KEYS.jump).toContain('Space');
    expect(DEFAULT_KEYS.fire).toContain('KeyJ');
    expect(DEFAULT_KEYS.prone).toEqual(['KeyC']);
    expect(DEFAULT_KEYS.dash).toContain('ShiftLeft');
    expect(DEFAULT_KEYS.slot3).toContain('Digit3');
    expect(DEFAULT_KEYS.pause).toContain('Escape');
    expect(findConflicts(DEFAULT_KEYS)).toEqual({});
  });

  it('overrides replace one action and conflicts are reported', () => {
    const b = resolveBindings({ dash: ['KeyF'] });
    expect(keyMap(b).KeyF).toBe('dash');
    expect(keyMap(b).ShiftLeft).toBeUndefined();
    const clash = resolveBindings({ dash: ['KeyJ'] });
    expect(findConflicts(clash).KeyJ).toEqual(['fire', 'dash']);
    // junk in saved data is ignored
    expect(resolveBindings({ jump: [3 as unknown as string] }).jump).toEqual(DEFAULT_KEYS.jump);
  });
});

describe('weapon slots and pickups', () => {
  it('a pickup takes slot 3 with limited ammo and is equipped', () => {
    const a = new Arsenal(['kestrel', 'p9']);
    a.givePickup('fan');
    expect(a.ids).toEqual(['kestrel', 'p9', 'fan']);
    expect(a.index).toBe(PICKUP_SLOT);
    expect(a.pickupAmmo).toBe(WEAPONS.fan.pickupAmmo);
    expect(a.select(0)).toBe(true);
    expect(a.current.id).toBe('kestrel');
    expect(a.select(5)).toBe(false);
  });

  it('the same pickup adds ammo; a different one replaces it', () => {
    const a = new Arsenal(['kestrel', 'p9']);
    a.givePickup('hornet');
    a.givePickup('hornet');
    expect(a.pickupAmmo).toBe(2 * (WEAPONS.hornet.pickupAmmo ?? 0));
    a.givePickup('lance');
    expect(a.ids[PICKUP_SLOT]).toBe('lance');
    expect(a.pickupAmmo).toBe(WEAPONS.lance.pickupAmmo);
  });

  it('a pickup weapon reloads from its reserve and is dropped when empty', () => {
    const a = new Arsenal(['kestrel', 'p9']);
    a.givePickup('hornet', 6); // 4 in the magazine, 2 in reserve
    for (let i = 0; i < 4; i++) a.fire();
    expect(a.reloading).toBe(true);
    for (let t = 0; t < 2000; t += STEP) a.tick(STEP, false);
    expect(a.mag).toBe(2);
    expect(a.pickupAmmo).toBe(2);
    a.fire();
    a.fire();
    expect(a.ids).toEqual(['kestrel', 'p9']);
    expect(a.current.id).toBe('kestrel');
  });

  it('ammo pickups refill magazines and top up the pickup weapon', () => {
    const a = new Arsenal(['kestrel', 'p9']);
    a.givePickup('fan', 10);
    a.select(0);
    for (let i = 0; i < 10; i++) a.fire();
    const before = a.pickupAmmo ?? 0;
    a.addAmmo();
    expect(a.mag).toBe(30);
    expect(a.pickupAmmo ?? 0).toBeGreaterThan(before);
  });
});

describe('ballistics', () => {
  it('a lob lands on its target after the flight time', () => {
    const g = TUNING.gravity;
    for (const [dx, dy] of [
      [120, 0],
      [-200, 40],
      [80, -30],
    ] as const) {
      const t = lobTime(dx);
      const v = lobVelocity(dx, dy, g, t);
      expect(v.vx * t).toBeCloseTo(dx);
      expect(v.vy * t + 0.5 * g * t * t).toBeCloseTo(dy);
      expect(v.vy).toBeLessThan(0); // always thrown upwards
    }
  });

  it('homing turns by at most the allowed angle and keeps speed', () => {
    const v = steerTowards(100, 0, 0, 100, 0.2);
    expect(Math.hypot(v.vx, v.vy)).toBeCloseTo(100);
    expect(Math.atan2(v.vy, v.vx)).toBeCloseTo(0.2);
  });
});

describe('line of sight and bridges', () => {
  const wall = [{ x: 100, y: 0, w: 20, h: 200 }];
  it('walls block sight; open air does not', () => {
    expect(segmentBlocked(wall, 50, 100, 200, 100)).toBe(true);
    expect(segmentBlocked(wall, 50, 100, 90, 100)).toBe(false);
    expect(segmentBlocked(wall, 50, -50, 200, -50)).toBe(false);
  });

  it('a bridge collapses from the end you step onto', () => {
    const xs = [1520, 1536, 1552, 1568];
    expect(collapseOrder(xs, 1522)).toEqual([0, 1, 2, 3]);
    expect(collapseOrder(xs, 1580)).toEqual([3, 2, 1, 0]);
  });
});
