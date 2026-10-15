/**
 * Relay Swap rules (RELAY-01..05) as pure logic, no Phaser.
 *
 * relay mode: three operators, one active. Swap tags in the next standing operator.
 *   Benched operators slowly regain armour. When the active one goes down, the next
 *   standing operator tags in automatically. The run fails only when all are down.
 * solo mode (H2 baseline): one operator with a fixed number of lives, no swapping.
 */
import type { OperatorDef } from '../data/operators';
import { Arsenal } from './Arsenal';

export type SquadMode = 'relay' | 'solo';

export interface MemberState {
  def: OperatorDef;
  hp: number;
  armour: number;
  down: boolean;
  /** Time accumulated towards the next armour point while benched. */
  regenMs: number;
  /** Each operator carries their own weapons and magazines. */
  arsenal: Arsenal;
  /** Air left underwater (ms). */
  oxygenMs: number;
  /** Time spent without air, towards the next drowning hit. */
  drownMs: number;
}

export interface DamageResult {
  armourLost: number;
  hpLost: number;
  downed: boolean;
}

export type DownOutcome =
  { kind: 'swapped'; to: number } | { kind: 'respawn'; livesLeft: number } | { kind: 'allDown' };

export interface SquadOptions {
  swapCooldownMs: number;
  benchArmourRegenMs: number;
  soloLives?: number;
  /** Drowning: one hit every drownTickMs once air runs out. */
  drownTickMs?: number;
  /** Air refill speed at the surface (× real time) and while benched. */
  oxygenRefillRate?: number;
  benchOxygenRefillRate?: number;
}

export class Squad {
  readonly members: MemberState[];
  activeIndex = 0;
  swapCooldownLeft = 0;
  livesLeft: number;
  /** Counters for telemetry and rank. */
  swaps = 0;
  downs = 0;

  constructor(
    defs: readonly OperatorDef[],
    readonly mode: SquadMode,
    private readonly opts: SquadOptions,
  ) {
    if (defs.length === 0) throw new Error('Squad needs at least one operator');
    const roster = mode === 'solo' ? defs.slice(0, 1) : defs.slice(0, 3);
    this.members = roster.map((def) => fresh(def));
    this.livesLeft = mode === 'solo' ? (opts.soloLives ?? 3) : 1;
  }

  get active(): MemberState {
    const m = this.members[this.activeIndex];
    if (!m) throw new Error('Invalid active index');
    return m;
  }

  get standingCount(): number {
    return this.members.filter((m) => !m.down).length;
  }

  get allDown(): boolean {
    return this.mode === 'relay' ? this.standingCount === 0 : this.livesLeft <= 0;
  }

  /** Index of the next standing operator after `from`, or -1 if none. */
  nextStanding(from = this.activeIndex): number {
    const n = this.members.length;
    for (let i = 1; i < n; i++) {
      const idx = (from + i) % n;
      if (!this.members[idx]?.down) return idx;
    }
    return -1;
  }

  canSwap(): boolean {
    return this.mode === 'relay' && this.swapCooldownLeft <= 0 && this.nextStanding() !== -1;
  }

  /** Manual swap. Returns the new active index, or null if a swap is not allowed now. */
  swap(): number | null {
    if (!this.canSwap()) return null;
    this.activeIndex = this.nextStanding();
    this.swapCooldownLeft = this.opts.swapCooldownMs;
    this.swaps++;
    return this.activeIndex;
  }

  /** Apply damage to the active operator: armour absorbs first, then health. */
  damage(amount: number): DamageResult {
    const m = this.active;
    if (m.down || amount <= 0) return { armourLost: 0, hpLost: 0, downed: false };
    const armourLost = Math.min(m.armour, amount);
    m.armour -= armourLost;
    const hpLost = Math.min(m.hp, amount - armourLost);
    m.hp -= hpLost;
    m.regenMs = 0;
    return { armourLost, hpLost, downed: m.hp <= 0 };
  }

  /** The active operator has gone down (no health left, or fell into a pit). */
  activeDown(): DownOutcome {
    const m = this.active;
    m.hp = 0;
    m.armour = 0;
    m.down = true;
    this.downs++;

    if (this.mode === 'solo') {
      this.livesLeft--;
      if (this.livesLeft <= 0) return { kind: 'allDown' };
      Object.assign(m, fresh(m.def));
      return { kind: 'respawn', livesLeft: this.livesLeft };
    }

    const next = this.nextStanding();
    if (next === -1) return { kind: 'allDown' };
    this.activeIndex = next;
    // An automatic tag-in should never be blocked by the manual swap cooldown that follows it.
    this.swapCooldownLeft = this.opts.swapCooldownMs;
    return { kind: 'swapped', to: next };
  }

  /**
   * Active operator's air for one step. Underwater, air drains; once it is gone they take a
   * drowning hit every drownTickMs. At the surface it refills quickly.
   * @returns how many drowning hits land this step (0 or 1).
   */
  breathe(dtMs: number, submerged: boolean): number {
    const m = this.active;
    if (m.down) return 0;
    const max = m.def.swim.oxygenMs;
    if (!submerged) {
      m.oxygenMs = Math.min(max, m.oxygenMs + dtMs * (this.opts.oxygenRefillRate ?? 4));
      m.drownMs = 0;
      return 0;
    }
    if (m.oxygenMs > 0) {
      m.oxygenMs = Math.max(0, m.oxygenMs - dtMs);
      // the first hit lands the moment air runs out
      if (m.oxygenMs === 0) {
        m.drownMs = 0;
        return 1;
      }
      return 0;
    }
    m.drownMs += dtMs;
    const tick = this.opts.drownTickMs ?? 1500;
    if (m.drownMs >= tick) {
      m.drownMs -= tick;
      return 1;
    }
    return 0;
  }

  /** Air left for the active operator, 0..1. */
  get oxygenFrac(): number {
    const m = this.active;
    return m.oxygenMs / m.def.swim.oxygenMs;
  }

  /** Advance timers by one fixed step. Benched, standing operators regain armour and air. */
  tick(dtMs: number): void {
    this.swapCooldownLeft = Math.max(0, this.swapCooldownLeft - dtMs);
    this.members.forEach((m, i) => {
      if (i !== this.activeIndex && !m.down) {
        m.oxygenMs = Math.min(
          m.def.swim.oxygenMs,
          m.oxygenMs + dtMs * (this.opts.benchOxygenRefillRate ?? 2),
        );
        m.drownMs = 0;
        m.arsenal.tick(dtMs, false);
      }
      if (i === this.activeIndex || m.down || m.armour >= m.def.maxArmour) {
        m.regenMs = 0;
        return;
      }
      m.regenMs += dtMs;
      while (m.regenMs >= this.opts.benchArmourRegenMs && m.armour < m.def.maxArmour) {
        m.regenMs -= this.opts.benchArmourRegenMs;
        m.armour++;
      }
    });
  }

  /** Retry from checkpoint: everyone back up, full health, first operator active. */
  reviveAll(): void {
    this.members.forEach((m, i) => (this.members[i] = fresh(m.def)));
    this.activeIndex = 0;
    this.swapCooldownLeft = 0;
    this.livesLeft = this.mode === 'solo' ? (this.opts.soloLives ?? 3) : 1;
  }
}

function fresh(def: OperatorDef): MemberState {
  return {
    def,
    hp: def.maxHp,
    armour: def.maxArmour,
    down: false,
    regenMs: 0,
    arsenal: new Arsenal(def.weapons),
    oxygenMs: def.swim.oxygenMs,
    drownMs: 0,
  };
}
