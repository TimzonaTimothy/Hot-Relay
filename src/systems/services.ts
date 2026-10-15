/** Shared services, created once in Boot and read by every scene. */
import { get, set } from 'idb-keyval';
import { MemoryStore, SaveStore, type KeyValueStore } from './SaveStore';

function browserStore(): KeyValueStore {
  try {
    if (typeof indexedDB === 'undefined') return new MemoryStore();
    return { get: (k) => get(k), set: (k, v) => set(k, v) };
  } catch {
    return new MemoryStore();
  }
}

export const saves = new SaveStore(browserStore());
