export interface MemberDef {
  id: string;
  health: number;
  armour: number;
}

export interface MemberState {
  id: string;
  maxHealth: number;
  maxArmour: number;
  health: number;
  armour: number;
  down: boolean;
  regen: number;
}

export type HitOutcome = 'armour' | 'health' | 'down' | 'ignored';

export interface SquadParams {
  swapCooldown: number;
  benchRegen: number;
  /** Solo mode: one operator with this many lives instead of a relay. */
  soloLives?: number;
}

/**
 * Relay Swap rules. One active operator; the bench regains armour over time;
 * a fallen operator hands over to the next; the stage fails when everyone is down.
 */
export class Squad {
  readonly members: MemberState[];
  active = 0;
  cooldown = 0;
  swaps = 0;
  downs = 0;
  livesLeft: number;
  readonly solo: boolean;

  constructor(
    defs: MemberDef[],
    private readonly p: SquadParams,
  ) {
    this.solo = p.soloLives !== undefined;
    const used = this.solo ? defs.slice(0, 1) : defs;
    this.members = used.map((d) => ({
      id: d.id,
      maxHealth: d.health,
      maxArmour: d.armour,
      health: d.health,
      armour: d.armour,
      down: false,
      regen: 0,
    }));
    this.livesLeft = p.soloLives ?? 0;
  }

  get current(): MemberState {
    return this.members[this.active];
  }

  get allDown(): boolean {
    return this.members.every((m) => m.down);
  }

  get canSwap(): boolean {
    return !this.solo && this.cooldown <= 0 && this.nextAlive() !== null;
  }

  tick(dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.members.forEach((m, i) => {
      if (i === this.active || m.down || m.armour >= m.maxArmour) {
        m.regen = 0;
        return;
      }
      m.regen += dt;
      if (m.regen >= this.p.benchRegen) {
        m.regen -= this.p.benchRegen;
        m.armour += 1;
      }
    });
  }

  /** Index of the next operator still standing, or null. */
  nextAlive(): number | null {
    const n = this.members.length;
    for (let k = 1; k < n; k++) {
      const i = (this.active + k) % n;
      if (!this.members[i].down) return i;
    }
    return null;
  }

  /** Player-initiated swap. Returns the new index, or null if not allowed. */
  swap(): number | null {
    if (!this.canSwap) return null;
    const next = this.nextAlive();
    if (next === null) return null;
    this.active = next;
    this.cooldown = this.p.swapCooldown;
    this.swaps += 1;
    return next;
  }

  hit(damage = 1): HitOutcome {
    const m = this.current;
    if (m.down) return 'ignored';
    if (m.armour > 0) {
      m.armour -= 1;
      return 'armour';
    }
    m.health = Math.max(0, m.health - damage);
    if (m.health > 0) return 'health';
    m.down = true;
    this.downs += 1;
    return 'down';
  }

  /** Instant knock-out (pits, crushers). */
  fall(): HitOutcome {
    const m = this.current;
    if (m.down) return 'ignored';
    m.armour = 0;
    m.health = 0;
    m.down = true;
    this.downs += 1;
    return 'down';
  }

  /**
   * After a 'down': tag in the next operator (relay) or spend a life (solo).
   * Returns the new active index, or null when the run has failed.
   */
  handOver(): number | null {
    if (this.solo) {
      if (this.livesLeft <= 1) {
        this.livesLeft = 0;
        return null;
      }
      this.livesLeft -= 1;
      this.restore(this.members[0]);
      return 0;
    }
    const next = this.nextAlive();
    if (next === null) return null;
    this.active = next;
    this.cooldown = this.p.swapCooldown;
    return next;
  }

  /** Continue after failing: everyone back on their feet. */
  reviveAll(): void {
    this.members.forEach((m) => this.restore(m));
    this.active = 0;
    this.cooldown = 0;
    if (this.solo) this.livesLeft = this.p.soloLives ?? 1;
  }

  private restore(m: MemberState): void {
    m.down = false;
    m.health = m.maxHealth;
    m.armour = m.maxArmour;
    m.regen = 0;
  }
}
