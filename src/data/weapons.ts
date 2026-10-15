/**
 * Weapon catalogue. Every weapon behaviour is data: fire rate, damage, magazine and reload,
 * recoil, and what it can do underwater. Ammo reserves are unlimited (run-and-gun pacing);
 * magazines exist so reloads create short, readable windows of vulnerability.
 */

export type WeaponId =
  | 'kestrel'
  | 'bulwark'
  | 'needle'
  | 'riptide'
  | 'p9'
  | 'contractorRifle'
  | 'fan'
  | 'hornet'
  | 'lance'
  | 'thumper';

/** Weapons that only come from supply-pod pickups (slot 3, limited ammo). */
export const PICKUP_WEAPONS: readonly WeaponId[] = ['fan', 'hornet', 'lance'];

/**
 * full: fires normally underwater (speargun).
 * reduced: fires, but rounds are slow, short-ranged and weaker (cavitation).
 * none: cannot fire underwater (belt-fed LMG); the operator switches to their sidearm.
 */
export type UnderwaterMode = 'full' | 'reduced' | 'none';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  /** Short label for the HUD. */
  short: string;
  /** Shots per second while fire is held. */
  fireRate: number;
  damage: number;
  bulletSpeed: number;
  spreadDeg: number;
  /** Enemies one round passes through (1 = stops at the first). */
  pierce: number;
  bulletLength: number;
  magSize: number;
  reloadMs: number;
  /** How far the gun kicks back along the aim line, in world px. */
  recoil: number;
  /** Shoulder-to-muzzle distance in rig units (before rig scale). */
  muzzle: number;
  underwater: UnderwaterMode;
  ejectsCasings: boolean;
  /** Placeholder synth pitch for the shot sound. */
  pitch: number;
  tint?: number;
  /** Rounds per trigger pull, fanned evenly across `pelletSpreadDeg`. */
  pellets?: number;
  pelletSpreadDeg?: number;
  /** Homing turn rate in radians per second (rockets). */
  homing?: number;
  /** Explodes on impact or at the end of its flight. */
  blast?: { radius: number; damage: number };
  /** Tracer colour behind each round. */
  trail: number;
  /** Ammo a pickup gives (pickup weapons only). */
  pickupAmmo?: number;
}

export const UNDERWATER_REDUCED = { speed: 0.42, life: 0.6, damage: 0.75 } as const;

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  kestrel: {
    id: 'kestrel',
    trail: 0xffe39a,
    name: 'Kestrel SMG',
    short: 'SMG',
    fireRate: 10,
    damage: 1,
    bulletSpeed: 380,
    spreadDeg: 3,
    pierce: 1,
    bulletLength: 5,
    magSize: 30,
    reloadMs: 900,
    recoil: 1.2,
    muzzle: 18,
    underwater: 'reduced',
    ejectsCasings: true,
    pitch: 880,
  },
  bulwark: {
    id: 'bulwark',
    trail: 0xffc46b,
    name: 'Bulwark LMG',
    short: 'LMG',
    fireRate: 8,
    damage: 1.5,
    bulletSpeed: 340,
    spreadDeg: 5,
    pierce: 1,
    bulletLength: 6,
    magSize: 60,
    reloadMs: 1500,
    recoil: 1.8,
    muzzle: 23,
    underwater: 'none',
    ejectsCasings: true,
    pitch: 420,
  },
  needle: {
    id: 'needle',
    trail: 0xd9ffd0,
    name: 'Needle DMR',
    short: 'DMR',
    fireRate: 2.6,
    damage: 4,
    bulletSpeed: 560,
    spreadDeg: 0,
    pierce: 2,
    bulletLength: 9,
    magSize: 6,
    reloadMs: 1100,
    recoil: 2.6,
    muzzle: 25,
    underwater: 'reduced',
    ejectsCasings: true,
    pitch: 1320,
  },
  riptide: {
    id: 'riptide',
    trail: 0xbff6ee,
    name: 'Riptide speargun',
    short: 'SPEAR',
    fireRate: 3.2,
    damage: 3,
    bulletSpeed: 300,
    spreadDeg: 0,
    pierce: 2,
    bulletLength: 11,
    magSize: 4,
    reloadMs: 850,
    recoil: 1.6,
    muzzle: 21,
    underwater: 'full',
    ejectsCasings: false,
    pitch: 640,
    tint: 0xbff6ee,
  },
  p9: {
    id: 'p9',
    trail: 0xfff2c0,
    name: 'P9 sidearm',
    short: 'P9',
    fireRate: 5,
    damage: 1,
    bulletSpeed: 400,
    spreadDeg: 2,
    pierce: 1,
    bulletLength: 4,
    magSize: 12,
    reloadMs: 700,
    recoil: 1,
    muzzle: 13,
    underwater: 'reduced',
    ejectsCasings: true,
    pitch: 1000,
  },
  contractorRifle: {
    id: 'contractorRifle',
    trail: 0xff8a50,
    name: 'Contractor rifle',
    short: 'AR',
    fireRate: 0,
    damage: 1,
    bulletSpeed: 165,
    spreadDeg: 0,
    pierce: 1,
    bulletLength: 4,
    magSize: 0,
    reloadMs: 0,
    recoil: 1.2,
    muzzle: 19,
    underwater: 'none',
    ejectsCasings: true,
    pitch: 300,
  },
  fan: {
    id: 'fan',
    name: 'Fan scattergun',
    short: 'FAN',
    trail: 0xffb36b,
    fireRate: 4.5,
    damage: 1,
    bulletSpeed: 330,
    spreadDeg: 0,
    pellets: 5,
    pelletSpreadDeg: 32,
    pierce: 1,
    bulletLength: 5,
    magSize: 10,
    reloadMs: 900,
    recoil: 2.2,
    muzzle: 19,
    underwater: 'reduced',
    ejectsCasings: true,
    pitch: 520,
    pickupAmmo: 60,
  },
  hornet: {
    id: 'hornet',
    name: 'Hornet launcher',
    short: 'HORNET',
    trail: 0xdcdcdc,
    fireRate: 2.2,
    damage: 2,
    bulletSpeed: 210,
    spreadDeg: 0,
    homing: 5.5,
    blast: { radius: 22, damage: 3 },
    pierce: 1,
    bulletLength: 8,
    magSize: 4,
    reloadMs: 1300,
    recoil: 2.4,
    muzzle: 22,
    underwater: 'none',
    ejectsCasings: false,
    pitch: 220,
    tint: 0xffe0b0,
    pickupAmmo: 16,
  },
  lance: {
    id: 'lance',
    name: 'Arc lance',
    short: 'LANCE',
    trail: 0x8ff3ff,
    fireRate: 3.5,
    damage: 2.5,
    bulletSpeed: 820,
    spreadDeg: 0,
    pierce: 99,
    bulletLength: 24,
    magSize: 8,
    reloadMs: 1000,
    recoil: 1.4,
    muzzle: 21,
    underwater: 'reduced',
    ejectsCasings: false,
    pitch: 1800,
    tint: 0xbff9ff,
    pickupAmmo: 40,
  },
  // grenadier's launcher (enemy only): lobs bouncing grenades
  thumper: {
    id: 'thumper',
    name: 'Thumper',
    short: 'GL',
    trail: 0xff8a50,
    fireRate: 0,
    damage: 1,
    bulletSpeed: 0,
    spreadDeg: 0,
    pierce: 1,
    bulletLength: 4,
    magSize: 0,
    reloadMs: 0,
    recoil: 2,
    muzzle: 15,
    underwater: 'none',
    ejectsCasings: false,
    pitch: 260,
  },
};

/** Effective stats for a shot fired in or out of water. Returns null if it cannot fire. */
export function shotStats(
  w: WeaponDef,
  submerged: boolean,
): { speed: number; damage: number; lifeScale: number } | null {
  if (!submerged || w.underwater === 'full')
    return { speed: w.bulletSpeed, damage: w.damage, lifeScale: 1 };
  if (w.underwater === 'none') return null;
  return {
    speed: w.bulletSpeed * UNDERWATER_REDUCED.speed,
    damage: w.damage * UNDERWATER_REDUCED.damage,
    lifeScale: UNDERWATER_REDUCED.life,
  };
}
