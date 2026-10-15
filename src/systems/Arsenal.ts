/**
 * One operator's weapons: which is equipped, magazines, reloads, and water rules (pure).
 * Reserves are unlimited; an empty magazine reloads automatically, and a partly used one
 * tops up after a short pause in firing so reloads rarely interrupt a fight.
 */
import { WEAPONS, type WeaponDef, type WeaponId } from '../data/weapons';

export type FireCheck = 'ok' | 'cooldown' | 'reloading' | 'blockedUnderwater';

export const IDLE_TOPUP_MS = 1500;

export class Arsenal {
  index = 0;
  readonly mags: number[];
  reloadLeftMs = 0;
  cooldownMs = 0;
  private idleMs = 0;
  /** Weapon the player chose before water forced a switch, restored on surfacing. */
  private preferredBeforeWater: number | null = null;

  constructor(readonly ids: readonly WeaponId[]) {
    if (ids.length === 0) throw new Error('Arsenal needs a weapon');
    this.mags = ids.map((id) => WEAPONS[id].magSize);
  }

  get current(): WeaponDef {
    return WEAPONS[this.ids[this.index] ?? this.ids[0]!];
  }

  get mag(): number {
    return this.mags[this.index] ?? 0;
  }

  get reloading(): boolean {
    return this.reloadLeftMs > 0;
  }

  /** 0..1 progress of the current reload, or null. */
  get reloadProgress(): number | null {
    if (!this.reloading) return null;
    return 1 - this.reloadLeftMs / this.current.reloadMs;
  }

  canFire(submerged: boolean): FireCheck {
    const w = this.current;
    if (submerged && w.underwater === 'none') return 'blockedUnderwater';
    if (this.reloading) return 'reloading';
    if (this.cooldownMs > 0) return 'cooldown';
    return 'ok';
  }

  /** Spend one round. Starts a reload when the magazine runs dry. */
  fire(): void {
    const w = this.current;
    this.cooldownMs = 1000 / w.fireRate;
    this.idleMs = 0;
    if (w.magSize <= 0) return;
    this.mags[this.index] = Math.max(0, this.mag - 1);
    if (this.mag === 0) this.startReload();
  }

  startReload(): boolean {
    const w = this.current;
    if (w.magSize <= 0 || this.reloading || this.mag >= w.magSize) return false;
    this.reloadLeftMs = w.reloadMs;
    return true;
  }

  /** @returns true on the step a reload completes. */
  tick(dtMs: number, firing: boolean): boolean {
    this.cooldownMs = Math.max(0, this.cooldownMs - dtMs);
    if (!firing) this.idleMs += dtMs;
    if (this.reloading) {
      this.reloadLeftMs -= dtMs;
      if (this.reloadLeftMs <= 0) {
        this.reloadLeftMs = 0;
        this.mags[this.index] = this.current.magSize;
        return true;
      }
      return false;
    }
    if (this.idleMs >= IDLE_TOPUP_MS && this.mag < this.current.magSize * 0.5) this.startReload();
    return false;
  }

  /** Cycle to the next weapon. Cancels a reload in progress. */
  switchNext(): WeaponDef {
    this.reloadLeftMs = 0;
    this.index = (this.index + 1) % this.ids.length;
    this.preferredBeforeWater = null;
    this.cooldownMs = Math.max(this.cooldownMs, 180);
    return this.current;
  }

  /**
   * Called when going under or surfacing. Underwater, swap away from a weapon that cannot
   * fire there; on surfacing, swap back to what the player had. Returns true if it switched.
   */
  adaptToWater(submerged: boolean): boolean {
    if (submerged && this.current.underwater === 'none') {
      const alt = this.ids.findIndex((id) => WEAPONS[id].underwater !== 'none');
      if (alt >= 0 && alt !== this.index) {
        this.preferredBeforeWater = this.index;
        this.reloadLeftMs = 0;
        this.index = alt;
        return true;
      }
    }
    if (!submerged && this.preferredBeforeWater !== null) {
      this.index = this.preferredBeforeWater;
      this.preferredBeforeWater = null;
      this.reloadLeftMs = 0;
      return true;
    }
    return false;
  }

  refill(): void {
    this.ids.forEach((id, i) => (this.mags[i] = WEAPONS[id].magSize));
    this.reloadLeftMs = 0;
  }
}
