import { get, set } from 'idb-keyval';
import type { Rank } from './rank';

export const SAVE_VERSION = 1;
const KEY = 'hot-relay-save';

export type TouchMode = 'auto' | 'on' | 'off';

export interface Settings {
  shake: boolean;
  flashing: boolean;
  aimAssist: boolean;
  autoFire: boolean;
  touchMode: TouchMode;
  sound: boolean;
  showFps: boolean;
}

export interface BestRun {
  rank: Rank;
  timeSec: number;
}

export interface SaveData {
  version: number;
  settings: Settings;
  best: Record<string, BestRun>;
  plays: number;
}

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    settings: {
      shake: true,
      flashing: true,
      aimAssist: true,
      autoFire: false,
      touchMode: 'auto',
      sound: true,
      showFps: false,
    },
    best: {},
    plays: 0,
  };
}

const RANKS = new Set(['S', 'A', 'B', 'C']);

/** Field-by-field repair: keep what is valid, default the rest. Never throws. */
export function repairSave(raw: unknown): SaveData {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  const s = (r.settings ?? {}) as Record<string, unknown>;
  for (const k of Object.keys(d.settings) as (keyof Settings)[]) {
    const def = d.settings[k];
    const v = s[k];
    if (k === 'touchMode') {
      if (v === 'auto' || v === 'on' || v === 'off') d.settings.touchMode = v;
    } else if (typeof v === typeof def) {
      (d.settings[k] as boolean) = v as boolean;
    }
  }
  if (r.best && typeof r.best === 'object') {
    for (const [id, b] of Object.entries(r.best as Record<string, unknown>)) {
      const run = b as Partial<BestRun> | null;
      if (run && RANKS.has(run.rank as string) && typeof run.timeSec === 'number' && run.timeSec > 0) {
        d.best[id] = { rank: run.rank as Rank, timeSec: run.timeSec };
      }
    }
  }
  if (typeof r.plays === 'number' && r.plays >= 0) d.plays = Math.floor(r.plays);
  return d;
}

/** IndexedDB save with an in-memory fallback (private mode, blocked storage). */
export class SaveStore {
  data: SaveData = defaultSave();
  persistent = true;

  async load(): Promise<SaveData> {
    try {
      this.data = repairSave(await get(KEY));
    } catch {
      this.persistent = false;
      this.data = defaultSave();
    }
    return this.data;
  }

  async save(): Promise<void> {
    if (!this.persistent) return;
    try {
      await set(KEY, this.data);
    } catch {
      this.persistent = false;
    }
  }
}
