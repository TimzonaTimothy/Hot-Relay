/**
 * Weapon catalogue. Every weapon behaviour is data: fire rate, damage, magazine and reload,
 * recoil, and what it can do underwater. Ammo reserves are unlimited (run-and-gun pacing);
 * magazines exist so reloads create short, readable windows of vulnerability.
 */

export type WeaponId = 'kestrel' | 'bulwark' | 'needle' | 'riptide' | 'p9' | 'contractorRifle';

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
}

export const UNDERWATER_REDUCED = { speed: 0.42, life: 0.6, damage: 0.75 } as const;

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  kestrel: {
    id: 'kestrel',
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
