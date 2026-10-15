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
 * Squads take three of the four; the order is the relay order.
 */
import type { RigId } from '../art/characters';
import { WEAPONS, type WeaponDef, type WeaponId } from './weapons';

export type EntryAttack = 'slide' | 'pound' | 'pierce' | 'surge';
export type OperatorId = 'kemi' | 'rurik' | 'meilin' | 'tari';

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
];

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
