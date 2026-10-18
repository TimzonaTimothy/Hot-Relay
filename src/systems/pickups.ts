/**
 * Field pickups (COMBAT-06): temporary weapons dropped by supply drones. Each overrides the
 * operator's primary while ammo lasts and is lost when that operator goes down. Pure data and
 * rules; StageScene fires them.
 */
import type { MemberState } from './Squad';
import type { PickupKind } from '../data/stages/types';

export interface PickupSpec {
  kind: PickupKind;
  name: string;
  short: string;
  /** Trigger pulls per pickup. */
  ammo: number;
  /** Pulls per second while fire is held. */
  rate: number;
  damage: number;
  /** Rounds per pull, fanned over spreadDeg either side. */
  pellets: number;
  spreadDeg: number;
  speed: number;
  pierce: number;
  length: number;
  /** Rounds steer towards the nearest enemy. */
  homing: boolean;
  tint: number;
  /** Crate and HUD colour. */
  color: number;
}

export const PICKUPS: Record<PickupKind, PickupSpec> = {
  fan: {
    kind: 'fan',
    name: 'Fan spread',
    short: 'FAN',
    ammo: 40,
    rate: 4,
    damage: 1,
    pellets: 5,
    spreadDeg: 18,
    speed: 360,
    pierce: 1,
    length: 5,
    homing: false,
    tint: 0xffb347,
    color: 0xff7a1f,
  },
  hornet: {
    kind: 'hornet',
    name: 'Hornet missiles',
    short: 'HRN',
    ammo: 30,
    rate: 3.5,
    damage: 2,
    pellets: 1,
    spreadDeg: 0,
    speed: 240,
    pierce: 1,
    length: 7,
    homing: true,
    tint: 0xff5a5a,
    color: 0xe0453a,
  },
  rail: {
    kind: 'rail',
    name: 'Rail lance',
    short: 'RAIL',
    ammo: 8,
    rate: 1.4,
    damage: 5,
    pellets: 1,
    spreadDeg: 0,
    speed: 720,
    pierce: 99,
    length: 22,
    homing: false,
    tint: 0xd6f4ff,
    color: 0xe8f6ff,
  },
};

/** Pick up a crate: the same kind tops up to full, a different kind replaces it. */
export function grantPickup(m: MemberState, kind: PickupKind): void {
  const spec = PICKUPS[kind];
  m.pickup = { kind, ammo: spec.ammo, full: spec.ammo };
}

/** Spend one pull; returns the spec to fire, or null if there is no pickup. Empties are dropped. */
export function spendPickup(m: MemberState): PickupSpec | null {
  const p = m.pickup;
  if (!p || p.ammo <= 0) return null;
  p.ammo--;
  const spec = PICKUPS[p.kind as PickupKind];
  if (p.ammo <= 0) m.pickup = null;
  return spec ?? null;
}

/** Angles (radians) of each round in one pull, evenly fanned around the aim. */
export function pelletAngles(aim: number, spec: PickupSpec): number[] {
  if (spec.pellets <= 1) return [aim];
  const spread = (spec.spreadDeg * Math.PI) / 180;
  return Array.from(
    { length: spec.pellets },
    (_, i) => aim + spread * ((i / (spec.pellets - 1)) * 2 - 1),
  );
}

/**
 * Turn a homing round's heading towards a target by at most maxTurn radians.
 * Returns the new heading.
 */
export function steer(heading: number, toTarget: number, maxTurn: number): number {
  let d = toTarget - heading;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return heading + Math.max(-maxTurn, Math.min(maxTurn, d));
}
