import { describe, expect, it } from 'vitest';
import { OPERATOR_BY_ID } from '../src/data/operators';
import { Squad } from '../src/systems/Squad';
import { PICKUPS, grantPickup, pelletAngles, spendPickup, steer } from '../src/systems/pickups';

const squad = () =>
  new Squad([OPERATOR_BY_ID.kemi, OPERATOR_BY_ID.rurik, OPERATOR_BY_ID.meilin], 'relay', {
    swapCooldownMs: 1000,
    benchArmourRegenMs: 4000,
  });

describe('field pickups (COMBAT-06)', () => {
  it('a crate gives a full pickup; the same kind tops up, another kind replaces', () => {
    const s = squad();
    grantPickup(s.active, 'fan');
    expect(s.active.pickup).toEqual({ kind: 'fan', ammo: 40, full: 40 });
    spendPickup(s.active);
    grantPickup(s.active, 'fan');
    expect(s.active.pickup?.ammo).toBe(40);
    grantPickup(s.active, 'rail');
    expect(s.active.pickup?.kind).toBe('rail');
  });

  it('spending ammo returns the spec and drops the pickup when empty', () => {
    const s = squad();
    grantPickup(s.active, 'rail');
    for (let i = 0; i < PICKUPS.rail.ammo - 1; i++)
      expect(spendPickup(s.active)?.kind).toBe('rail');
    expect(s.active.pickup?.ammo).toBe(1);
    expect(spendPickup(s.active)?.kind).toBe('rail');
    expect(s.active.pickup).toBeNull();
    expect(spendPickup(s.active)).toBeNull();
  });

  it('is lost when that operator goes down, and belongs to that operator only', () => {
    const s = squad();
    grantPickup(s.active, 'hornet');
    s.activeDown();
    expect(s.members[0]!.pickup).toBeNull();
    expect(s.active.pickup).toBeNull();
  });

  it('the fan fires five rounds evenly across its spread', () => {
    const a = pelletAngles(0, PICKUPS.fan);
    expect(a).toHaveLength(5);
    expect(a[2]).toBeCloseTo(0);
    expect(a[0]).toBeCloseTo(-a[4]!);
    expect(pelletAngles(1, PICKUPS.rail)).toEqual([1]);
  });

  it('homing turns towards the target, never more than the turn limit', () => {
    expect(steer(0, 1, 0.1)).toBeCloseTo(0.1);
    expect(steer(0, -0.05, 0.1)).toBeCloseTo(-0.05);
    // shortest way round across ±π
    expect(steer(3, -3, 0.2)).toBeCloseTo(3.2);
  });
});
