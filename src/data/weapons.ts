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
  | 'forge'
  | 'tremor'
  | 'tala'
  | 'volt'
  | 'p9'
  | 'contractorRifle';

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
  /** Rounds per trigger pull, fanned across spreadDeg (shotguns). Default 1. */
  pellets?: number;
  /** Round lifetime override in ms (short-range weapons). Default TUNING.bulletLifeMs. */
  lifeMs?: number;
  /**
   * Fires a lobbed grenade instead of a bullet: it falls under gravity and explodes on impact.
   * It only arms after armMs, so it cannot be used point-blank (Farida's weakness).
   */
  grenade?: { radius: number; gravity: number; armMs: number; fuseMs: number };
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
  forge: {
    // Tomás: a weak personal gun is his weakness; the sentry does the heavy lifting
    id: 'forge',
    name: 'Forge carbine',
    short: 'CARB',
    fireRate: 6,
    damage: 0.8,
    bulletSpeed: 360,
    spreadDeg: 3,
    pierce: 1,
    bulletLength: 5,
    magSize: 24,
    reloadMs: 1000,
    recoil: 1.1,
    muzzle: 19,
    underwater: 'reduced',
    ejectsCasings: true,
    pitch: 760,
  },
  tremor: {
    // Farida: lobbed grenades with splash; arm after a short flight
    id: 'tremor',
    name: 'Tremor launcher',
    short: 'GL',
    fireRate: 1.6,
    damage: 3,
    bulletSpeed: 230,
    spreadDeg: 0,
    pierce: 1,
    bulletLength: 4,
    magSize: 6,
    reloadMs: 1400,
    recoil: 2.4,
    muzzle: 19,
    underwater: 'none',
    ejectsCasings: false,
    pitch: 220,
    grenade: { radius: 30, gravity: 520, armMs: 140, fuseMs: 2200 },
  },
  tala: {
    // Sione: a short-range pump shotgun, low damage per pellet
    id: 'tala',
    name: 'Tala shotgun',
    short: 'SG',
    fireRate: 2,
    damage: 0.8,
    bulletSpeed: 340,
    spreadDeg: 10,
    pierce: 1,
    bulletLength: 3,
    magSize: 6,
    reloadMs: 1300,
    recoil: 2.2,
    muzzle: 20,
    underwater: 'reduced',
    ejectsCasings: true,
    pitch: 300,
    pellets: 5,
    lifeMs: 300,
  },
  volt: {
    // KAI-7: fast, light energy bolts
    id: 'volt',
    name: 'Volt repeater',
    short: 'VOLT',
    fireRate: 12,
    damage: 0.7,
    bulletSpeed: 460,
    spreadDeg: 2,
    pierce: 1,
    bulletLength: 7,
    magSize: 40,
    reloadMs: 800,
    recoil: 0.8,
    muzzle: 19,
    underwater: 'reduced',
    ejectsCasings: false,
    pitch: 1500,
    tint: 0x7ff3ff,
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
