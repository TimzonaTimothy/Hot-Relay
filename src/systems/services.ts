/** Shared services, created once in Boot and read by every scene. */
import { get, set } from 'idb-keyval';
import { MemoryStore, SaveStore, type KeyValueStore } from './SaveStore';
import { PlaytestLog } from './playtest';

function browserStore(): KeyValueStore {
  try {
    if (typeof indexedDB === 'undefined') return new MemoryStore();
    return { get: (k) => get(k), set: (k, v) => set(k, v) };
  } catch {
    return new MemoryStore();
  }
}

const store = browserStore();
export const saves = new SaveStore(store);
/** Offline playtest runs and survey answers (ANALYTICS-03). */
export const playtest = new PlaytestLog(store);
