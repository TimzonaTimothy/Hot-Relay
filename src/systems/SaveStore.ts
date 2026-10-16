/**
 * Local save (SAVE-01, SAVE-02, start of SAVE-03).
 * Storage is injected so the logic is testable; in the browser it is IndexedDB via idb-keyval,
 * falling back to memory when IndexedDB is unavailable (private mode, some embedded webviews).
 */
import type { Rank } from './rank';
import { isDetailSetting, type DetailSetting } from './detail';
import { ZOOM_DEFAULT, isZoomLevel } from './viewZoom';

export const SAVE_VERSION = 1;
const SAVE_KEY = 'hot-relay/save';

export type TouchMode = 'auto' | 'on' | 'off';

export interface Settings {
  screenShake: boolean;
  flashing: boolean;
  aimAssist: boolean;
  autoFire: boolean;
  volume: number;
  showFps: boolean;
  touchControls: TouchMode;
  /** Render detail (PERF-01). */
  detail: DetailSetting;
  /** World camera zoom (UI-11): 2 normal, 1.6 wide, 2.5 close. */
  viewZoom: number;
}

export interface BestRun {
  rank: Rank;
  timeMs: number;
  at: string;
}

export interface SaveData {
  version: number;
  settings: Settings;
  bestByStage: Record<string, BestRun>;
  stats: { runsStarted: number; runsCleared: number };
  /** Squad picked last time, in relay order (operator ids). */
  lastSquad: string[];
  /** Stages whose opening insertion has been watched once (skippable afterwards). */
  seenInsertion: Record<string, boolean>;
}

export const DEFAULT_SETTINGS: Settings = {
  screenShake: true,
  flashing: true,
  aimAssist: true,
  autoFire: false,
  volume: 0.6,
  showFps: false,
  touchControls: 'auto',
  detail: 'auto',
  viewZoom: ZOOM_DEFAULT,
};

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    bestByStage: {},
    stats: { runsStarted: 0, runsCleared: 0 },
    lastSquad: [],
    seenInsertion: {},
  };
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Bring any stored value up to the current schema. Unknown or broken data never crashes
 * the game; it falls back to defaults field by field.
 */
export function migrate(raw: unknown): SaveData {
  const base = defaultSave();
  if (!isObj(raw)) return base;

  const s = isObj(raw.settings) ? raw.settings : {};
  const settings: Settings = { ...base.settings };
  for (const key of Object.keys(base.settings) as (keyof Settings)[]) {
    const v = s[key];
    const def = base.settings[key];
    if (typeof v === typeof def) (settings as unknown as Record<string, unknown>)[key] = v;
  }
  settings.volume = Math.min(1, Math.max(0, settings.volume));
  if (!['auto', 'on', 'off'].includes(settings.touchControls)) settings.touchControls = 'auto';
  if (!isDetailSetting(settings.detail)) settings.detail = 'auto';
  if (!isZoomLevel(settings.viewZoom)) settings.viewZoom = ZOOM_DEFAULT;

  const bestByStage: Record<string, BestRun> = {};
  if (isObj(raw.bestByStage)) {
    for (const [id, b] of Object.entries(raw.bestByStage)) {
      if (
        isObj(b) &&
        typeof b.timeMs === 'number' &&
        ['S', 'A', 'B', 'C'].includes(String(b.rank))
      ) {
        bestByStage[id] = { rank: b.rank as Rank, timeMs: b.timeMs, at: String(b.at ?? '') };
      }
    }
  }

  const st = isObj(raw.stats) ? raw.stats : {};
  return {
    version: SAVE_VERSION,
    settings,
    bestByStage,
    stats: {
      runsStarted: typeof st.runsStarted === 'number' ? st.runsStarted : 0,
      runsCleared: typeof st.runsCleared === 'number' ? st.runsCleared : 0,
    },
    lastSquad: Array.isArray(raw.lastSquad)
      ? raw.lastSquad.filter((x): x is string => typeof x === 'string').slice(0, 3)
      : [],
    seenInsertion: isObj(raw.seenInsertion)
      ? (Object.fromEntries(
          Object.entries(raw.seenInsertion).filter(([, v]) => v === true),
        ) as Record<string, boolean>)
      : {},
  };
}

export interface KeyValueStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

export class MemoryStore implements KeyValueStore {
  private map = new Map<string, unknown>();
  async get(key: string): Promise<unknown> {
    return structuredClone(this.map.get(key));
  }
  async set(key: string, value: unknown): Promise<void> {
    this.map.set(key, structuredClone(value));
  }
}

export class SaveStore {
  data: SaveData = defaultSave();
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private store: KeyValueStore) {}

  async load(): Promise<SaveData> {
    try {
      this.data = migrate(await this.store.get(SAVE_KEY));
    } catch (err) {
      console.warn('Save load failed; using defaults', err);
      this.data = defaultSave();
    }
    return this.data;
  }

  /** Writes are queued so rapid changes never interleave. */
  save(): Promise<void> {
    const snapshot = structuredClone(this.data);
    this.writeChain = this.writeChain
      .then(() => this.store.set(SAVE_KEY, snapshot))
      .catch((err) => console.warn('Save write failed', err));
    return this.writeChain;
  }

  updateSettings(patch: Partial<Settings>): Promise<void> {
    this.data.settings = { ...this.data.settings, ...patch };
    return this.save();
  }
}
