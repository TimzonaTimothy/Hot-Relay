/**
 * Playable operators: all character behaviour is configured here (RELAY-01, character system).
 * Numbers are starting points for playtest tuning, not final balance.
 *
 * Roster logic: each operator changes how you play, on land and in water.
 * - Kemi (assault): fastest on foot, all-round, floats and swims well enough.
 * - Rurik (heavy): toughest, slowest; his armour makes him sink and walk the sea bed,
 *   and his LMG cannot fire underwater.
 * - Mei-Lin (recon/marksman): fragile, hard-hitting, long breath.
 * - Tari (amphibious): ordinary on land, dominant in water: fast swimmer, 30 s of air,
 *   a speargun that works fully underwater.
 * - Tomás (engineer): drops an automatic sentry on entry; his own carbine is weak.
 * - Farida (demolition): lobbed grenades with splash (useless point-blank); blast-jumps in.
 * - Sione (support): makes the bench heal faster; a shield pulse on entry clears enemy fire
 *   and gives the whole squad armour. Low damage.
 * - KAI-7 (experimental android): fast and fragile; armour hits charge a counter-blast, but
 *   its armour drains while it is active. Locked until a stage is cleared.
 * Squads take three of the roster; the order is the relay order.
 */
import type { RigId } from '../art/characters';
import { WEAPONS, type WeaponDef, type WeaponId } from './weapons';

export type EntryAttack =
  'slide' | 'pound' | 'pierce' | 'surge' | 'sentry' | 'blast' | 'pulse' | 'phase';
export type OperatorId =
  'kemi' | 'rurik' | 'meilin' | 'tari' | 'tomas' | 'farida' | 'sione' | 'kai7';

/** How an operator is unlocked; absent = available from the start. */
export type Unlock = 'firstClear';

export interface SwimProfile {
  /** Top swimming speed in px/s. */
  speed: number;
  /** How fast they reach it (px/s²). */
  accel: number;
  /**
   * -1..1. Positive floats towards the surface, negative sinks (Rurik walks the bottom).
   * Scaled by TUNING.water.buoyancyForce.
   */
  buoyancy: number;
  /** Time underwater before drowning damage starts. */
  oxygenMs: number;
}

export interface OperatorDef {
  id: OperatorId;
  name: string;
  role: string;
  /** One line shown on the squad screen. */
  blurb: string;
  color: number;
  accent: number;
  rig: RigId;
  maxHp: number;
  maxArmour: number;
  runSpeed: number;
  jumpVelocity: number;
  swim: SwimProfile;
  /** Primary first; the secondary is always usable as a fallback. */
  weapons: [WeaponId, WeaponId];
  /** Convenience: the primary weapon definition. */
  weapon: WeaponDef;
  entry: EntryAttack;
  entryLabel: string;
  /** While this operator is in the squad (benched or active), bench armour regen is this much faster. */
  squadRegenBoost?: number;
  /** Armour hits charge a counter-blast; it fires after this many. */
  absorbCharge?: number;
  /** Loses one armour point every this many ms while active. */
  armourDrainMs?: number;
  unlock?: Unlock;
}

const def = (o: Omit<OperatorDef, 'weapon'>): OperatorDef => ({
  ...o,
  weapon: WEAPONS[o.weapons[0]],
});

export const OPERATORS: readonly OperatorDef[] = [
  def({
    id: 'kemi',
    name: 'Kemi',
    role: 'Assault',
    blurb: 'Fastest on her feet. Slides in firing.',
    color: 0xf2a541,
    accent: 0x7a4a12,
    rig: 'kemi',
    maxHp: 3,
    maxArmour: 1,
    runSpeed: 132,
    jumpVelocity: 335,
    swim: { speed: 72, accel: 420, buoyancy: 0.55, oxygenMs: 9000 },
    weapons: ['kestrel', 'p9'],
    entry: 'slide',
    entryLabel: 'Slide-shot',
  }),
  def({
    id: 'rurik',
    name: 'Rurik',
    role: 'Heavy',
    blurb: 'Takes the hits. Sinks like a stone.',
    color: 0x5aa9e6,
    accent: 0x1f4a6e,
    rig: 'rurik',
    maxHp: 4,
    maxArmour: 2,
    runSpeed: 104,
    jumpVelocity: 300,
    swim: { speed: 44, accel: 260, buoyancy: -0.6, oxygenMs: 7000 },
    weapons: ['bulwark', 'p9'],
    entry: 'pound',
    entryLabel: 'Ground-pound',
  }),
  def({
    id: 'meilin',
    name: 'Mei-Lin',
    role: 'Recon',
    blurb: 'One shot, two targets. Long breath.',
    color: 0x9bd36a,
    accent: 0x3c6420,
    rig: 'meilin',
    maxHp: 2,
    maxArmour: 1,
    runSpeed: 120,
    jumpVelocity: 325,
    swim: { speed: 66, accel: 380, buoyancy: 0.45, oxygenMs: 12000 },
    weapons: ['needle', 'p9'],
    entry: 'pierce',
    entryLabel: 'Piercing shot',
  }),
  def({
    id: 'tari',
    name: 'Tari',
    role: 'Amphibious',
    blurb: 'Owns the water. 30 seconds of air.',
    color: 0x2ec4b6,
    accent: 0x0f5d57,
    rig: 'tari',
    maxHp: 3,
    maxArmour: 1,
    runSpeed: 116,
    jumpVelocity: 320,
    swim: { speed: 118, accel: 700, buoyancy: 0.1, oxygenMs: 30000 },
    weapons: ['riptide', 'p9'],
    entry: 'surge',
    entryLabel: 'Surge dash',
  }),
  def({
    id: 'tomas',
    name: 'Tomás',
    role: 'Engineer',
    blurb: 'Drops a sentry on arrival. Weak carbine.',
    color: 0xf2d13a,
    accent: 0x6e5a12,
    rig: 'tomas',
    maxHp: 3,
    maxArmour: 1,
    runSpeed: 116,
    jumpVelocity: 318,
    swim: { speed: 58, accel: 340, buoyancy: 0.3, oxygenMs: 8000 },
    weapons: ['forge', 'p9'],
    entry: 'sentry',
    entryLabel: 'Sentry drop',
  }),
  def({
    id: 'farida',
    name: 'Farida',
    role: 'Demolition',
    blurb: 'Lobs grenades. Useless point-blank.',
    color: 0xe0533d,
    accent: 0x6e1f17,
    rig: 'farida',
    maxHp: 3,
    maxArmour: 1,
    runSpeed: 120,
    jumpVelocity: 325,
    swim: { speed: 60, accel: 360, buoyancy: 0.35, oxygenMs: 8000 },
    weapons: ['tremor', 'p9'],
    entry: 'blast',
    entryLabel: 'Blast jump',
  }),
  def({
    id: 'sione',
    name: 'Sione',
    role: 'Support',
    blurb: 'Bench heals faster. Shield pulse on entry.',
    color: 0xb48cff,
    accent: 0x4a2f7a,
    rig: 'sione',
    maxHp: 3,
    maxArmour: 2,
    runSpeed: 112,
    jumpVelocity: 315,
    swim: { speed: 74, accel: 420, buoyancy: 0.5, oxygenMs: 14000 },
    weapons: ['tala', 'p9'],
    entry: 'pulse',
    entryLabel: 'Shield pulse',
    squadRegenBoost: 1.75,
  }),
  def({
    id: 'kai7',
    name: 'KAI-7',
    role: 'Experimental',
    blurb: 'Absorbs hits into a counter-blast. Armour drains.',
    color: 0x7ff3ff,
    accent: 0x1b5f6b,
    rig: 'kai7',
    maxHp: 2,
    maxArmour: 3,
    runSpeed: 136,
    jumpVelocity: 340,
    // an android: heavy frame sinks slowly, no lungs to drown with for a long time
    swim: { speed: 52, accel: 300, buoyancy: -0.2, oxygenMs: 60000 },
    weapons: ['volt', 'p9'],
    entry: 'phase',
    entryLabel: 'Phase dash',
    absorbCharge: 3,
    armourDrainMs: 6000,
    unlock: 'firstClear',
  }),
];

/** Whether an operator can be picked, given how many stages have been cleared. */
export function isUnlocked(op: OperatorDef, stagesCleared: number): boolean {
  if (op.unlock === 'firstClear') return stagesCleared > 0;
  return true;
}

/** Plain-language unlock condition for the squad screen. */
export function unlockHint(op: OperatorDef): string {
  return op.unlock === 'firstClear' ? 'Clear a stage to unlock' : '';
}

export const OPERATOR_BY_ID = Object.fromEntries(OPERATORS.map((o) => [o.id, o])) as Record<
  OperatorId,
  OperatorDef
>;

export const DEFAULT_SQUAD: OperatorId[] = ['kemi', 'rurik', 'meilin'];

/** Turn saved or URL ids into a valid squad of distinct operators (falls back to default). */
export function resolveSquad(ids: readonly string[] | undefined, size = 3): OperatorDef[] {
  const seen = new Set<string>();
  const out: OperatorDef[] = [];
  for (const id of ids ?? []) {
    const op = OPERATOR_BY_ID[id as OperatorId];
    if (op && !seen.has(id)) {
      seen.add(id);
      out.push(op);
    }
  }
  for (const id of DEFAULT_SQUAD) {
    if (out.length >= size) break;
    if (!seen.has(id)) {
      seen.add(id);
      out.push(OPERATOR_BY_ID[id]);
    }
  }
  return out.slice(0, size);
}
