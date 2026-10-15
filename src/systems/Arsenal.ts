/**
 * One operator's weapons (pure): up to three slots — 1 primary, 2 sidearm (both with unlimited
 * reserves), and 3 a pickup weapon with limited ammo. Magazines, reloads, switching, and water
 * rules live here.
 *
 * An empty magazine reloads automatically; a part-used one tops up after a short pause in
 * firing. When a pickup weapon runs completely dry, its slot is dropped and the primary returns.
 */
import { WEAPONS, type WeaponDef, type WeaponId } from '../data/weapons';

export type FireCheck = 'ok' | 'cooldown' | 'reloading' | 'blockedUnderwater';

export const IDLE_TOPUP_MS = 1500;
/** Slot index of the pickup weapon. */
export const PICKUP_SLOT = 2;

export class Arsenal {
  index = 0;
  readonly ids: WeaponId[];
  readonly mags: number[];
  /** Rounds left outside the magazine; null = unlimited. */
  readonly reserve: (number | null)[];
  reloadLeftMs = 0;
  cooldownMs = 0;
  private idleMs = 0;
  /** Weapon the player chose before water forced a switch, restored on surfacing. */
  private preferredBeforeWater: number | null = null;

  constructor(ids: readonly WeaponId[]) {
    if (ids.length === 0) throw new Error('Arsenal needs a weapon');
    this.ids = ids.slice(0, PICKUP_SLOT);
    this.mags = this.ids.map((id) => WEAPONS[id].magSize);
    this.reserve = this.ids.map(() => null);
  }

  get current(): WeaponDef {
    return WEAPONS[this.ids[this.index] ?? this.ids[0]!];
  }

  get mag(): number {
    return this.mags[this.index] ?? 0;
  }

  /** Total ammo of the pickup slot (magazine + reserve), or null if there is none. */
  get pickupAmmo(): number | null {
    if (this.ids.length <= PICKUP_SLOT) return null;
    return (this.mags[PICKUP_SLOT] ?? 0) + (this.reserve[PICKUP_SLOT] ?? 0);
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

  /** Spend one round. Starts a reload when the magazine runs dry; drops an empty pickup. */
  fire(): void {
    const w = this.current;
    this.cooldownMs = 1000 / w.fireRate;
    this.idleMs = 0;
    if (w.magSize <= 0) return;
    this.mags[this.index] = Math.max(0, this.mag - 1);
    if (this.mag > 0) return;
    const res = this.reserve[this.index];
    if (res !== null && res !== undefined && res <= 0) this.dropSlot(this.index);
    else this.startReload();
  }

  startReload(): boolean {
    const w = this.current;
    const res = this.reserve[this.index];
    if (w.magSize <= 0 || this.reloading || this.mag >= w.magSize) return false;
    if (res !== null && res !== undefined && res <= 0) return false;
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
        const i = this.index;
        const need = this.current.magSize - this.mag;
        const res = this.reserve[i];
        const take = res === null || res === undefined ? need : Math.min(need, res);
        this.mags[i] = this.mag + take;
        if (res !== null && res !== undefined) this.reserve[i] = res - take;
        return true;
      }
      return false;
    }
    if (this.idleMs >= IDLE_TOPUP_MS && this.mag < this.current.magSize * 0.5) this.startReload();
    return false;
  }

  /** Select a slot directly (1/2/3 keys). Returns false if that slot is empty or current. */
  select(slot: number): boolean {
    if (slot < 0 || slot >= this.ids.length || slot === this.index) return false;
    this.reloadLeftMs = 0;
    this.index = slot;
    this.preferredBeforeWater = null;
    this.cooldownMs = Math.max(this.cooldownMs, 180);
    return true;
  }

  /** Cycle to the next weapon. Cancels a reload in progress. */
  switchNext(): WeaponDef {
    this.select((this.index + 1) % this.ids.length);
    return this.current;
  }

  /**
   * Take a pickup weapon into slot 3 and equip it. The same weapon again adds its ammo; a
   * different one replaces it.
   */
  givePickup(id: WeaponId, ammo = WEAPONS[id].pickupAmmo ?? 30): void {
    const w = WEAPONS[id];
    if (this.ids[PICKUP_SLOT] === id) {
      this.reserve[PICKUP_SLOT] = (this.reserve[PICKUP_SLOT] ?? 0) + ammo;
    } else {
      const inMag = Math.min(w.magSize, ammo);
      this.ids[PICKUP_SLOT] = id;
      this.mags[PICKUP_SLOT] = inMag;
      this.reserve[PICKUP_SLOT] = ammo - inMag;
    }
    this.reloadLeftMs = 0;
    this.index = PICKUP_SLOT;
    this.preferredBeforeWater = null;
  }

  /** Ammo pickup: extra rounds for the pickup weapon if carried, and full magazines. */
  addAmmo(): void {
    const id = this.ids[PICKUP_SLOT];
    if (id)
      this.reserve[PICKUP_SLOT] =
        (this.reserve[PICKUP_SLOT] ?? 0) + Math.ceil((WEAPONS[id].pickupAmmo ?? 30) / 2);
    this.refill();
  }

  private dropSlot(i: number): void {
    if (i < PICKUP_SLOT) return;
    this.ids.splice(i, 1);
    this.mags.splice(i, 1);
    this.reserve.splice(i, 1);
    this.reloadLeftMs = 0;
    this.index = 0;
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
      if (this.preferredBeforeWater < this.ids.length) this.index = this.preferredBeforeWater;
      this.preferredBeforeWater = null;
      this.reloadLeftMs = 0;
      return true;
    }
    return false;
  }

  /** Full magazines (reserves unchanged). */
  refill(): void {
    this.ids.forEach((id, i) => {
      const w = WEAPONS[id];
      const res = this.reserve[i];
      if (res === null || res === undefined) this.mags[i] = w.magSize;
      else {
        const take = Math.min(w.magSize - (this.mags[i] ?? 0), res);
        this.mags[i] = (this.mags[i] ?? 0) + take;
        this.reserve[i] = res - take;
      }
    });
    this.reloadLeftMs = 0;
  }
}
