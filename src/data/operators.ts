export type OperatorId = 'kemi' | 'rurik' | 'meilin';
export type EntryKind = 'slide' | 'pound' | 'pierce';

export interface WeaponDef {
  name: string;
  /** Shots per second while fire is held. */
  rate: number;
  damage: number;
  /** Random spread in radians either side of the aim line. */
  spread: number;
  /** Number of enemies a bullet passes through before it is spent. */
  pierce: number;
  speedScale: number;
  /** Muzzle position relative to the shoulder pivot, facing right, aiming forward. */
  muzzle: number;
  tracer: 'smg' | 'lmg' | 'dmr';
}

export interface OperatorDef {
  id: OperatorId;
  name: string;
  role: string;
  /** Personal colour (visor band, HUD). */
  color: number;
  health: number;
  armour: number;
  runSpeed: number;
  jumpScale: number;
  entry: EntryKind;
  weapon: WeaponDef;
}

export const OPERATORS: Record<OperatorId, OperatorDef> = {
  kemi: {
    id: 'kemi',
    name: 'Kemi',
    role: 'Assault',
    color: 0xf39a1e,
    health: 2,
    armour: 1,
    runSpeed: 330,
    jumpScale: 1.04,
    entry: 'slide',
    weapon: { name: 'Kestrel SMG', rate: 11, damage: 1, spread: 0.06, pierce: 0, speedScale: 1, muzzle: 34, tracer: 'smg' },
  },
  rurik: {
    id: 'rurik',
    name: 'Rurik',
    role: 'Heavy',
    color: 0x4f86c6,
    health: 3,
    armour: 2,
    runSpeed: 255,
    jumpScale: 0.92,
    entry: 'pound',
    weapon: { name: 'Bulwark LMG', rate: 9, damage: 1.4, spread: 0.035, pierce: 0, speedScale: 1.05, muzzle: 44, tracer: 'lmg' },
  },
  meilin: {
    id: 'meilin',
    name: 'Mei-Lin',
    role: 'Recon',
    color: 0x9be03c,
    health: 2,
    armour: 1,
    runSpeed: 300,
    jumpScale: 1,
    entry: 'pierce',
    weapon: { name: 'Needle DMR', rate: 3.2, damage: 3.5, spread: 0, pierce: 1, speedScale: 1.5, muzzle: 50, tracer: 'dmr' },
  },
};

export const SQUAD_ORDER: OperatorId[] = ['kemi', 'rurik', 'meilin'];
