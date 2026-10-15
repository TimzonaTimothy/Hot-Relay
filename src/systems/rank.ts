/** Stage rank (UI-05 basic). Pure so it can be unit tested and tuned from playtest data. */

export type Rank = 'S' | 'A' | 'B' | 'C';

export interface RunStats {
  timeMs: number;
  /** Operators that went down during the run (or lives lost in solo mode). */
  downs: number;
  /** Times the whole squad went down and the player retried from a checkpoint. */
  continues: number;
  parTimeMs: number;
}

export function computeRank({ timeMs, downs, continues, parTimeMs }: RunStats): Rank {
  if (continues > 0) return 'C';
  if (downs === 0 && timeMs <= parTimeMs) return 'S';
  if (downs <= 1 && timeMs <= parTimeMs * 1.3) return 'A';
  return 'B';
}

/** Lower is better; used to decide whether a run beats the saved best. */
export const RANK_ORDER: Record<Rank, number> = { S: 0, A: 1, B: 2, C: 3 };

export function isBetterRun(
  a: { rank: Rank; timeMs: number },
  b: { rank: Rank; timeMs: number } | undefined,
): boolean {
  if (!b) return true;
  if (RANK_ORDER[a.rank] !== RANK_ORDER[b.rank]) return RANK_ORDER[a.rank] < RANK_ORDER[b.rank];
  return a.timeMs < b.timeMs;
}

export function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 10));
  const cs = total % 100;
  const s = Math.floor(total / 100) % 60;
  const m = Math.floor(total / 6000);
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}
