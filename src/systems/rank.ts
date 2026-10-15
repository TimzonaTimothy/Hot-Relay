export type Rank = 'S' | 'A' | 'B' | 'C';

export interface RunStats {
  timeSec: number;
  parSec: number;
  downs: number;
  continues: number;
  kills: number;
  totalEnemies: number;
}

/** 0–100 score: time vs par, survival and clear rate. */
export function rankScore(s: RunStats): number {
  const timeRatio = s.parSec / Math.max(1, s.timeSec);
  const time = Math.min(40, 40 * timeRatio);
  const survival = Math.max(0, 35 - s.downs * 12 - s.continues * 25);
  const clear = s.totalEnemies > 0 ? 25 * Math.min(1, s.kills / s.totalEnemies) : 25;
  return Math.round(time + survival + clear);
}

export function rankFor(s: RunStats): Rank {
  const score = rankScore(s);
  if (s.continues === 0 && score >= 88) return 'S';
  if (score >= 72) return 'A';
  if (score >= 52) return 'B';
  return 'C';
}

const ORDER: Rank[] = ['C', 'B', 'A', 'S'];
export function betterRank(a: Rank | undefined, b: Rank): boolean {
  return a === undefined || ORDER.indexOf(b) > ORDER.indexOf(a);
}
