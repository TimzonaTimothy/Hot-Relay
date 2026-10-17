/**
 * Offline playtest log (ANALYTICS-03, groundwork for ANALYTICS-02/04 and TEST-02/03).
 * Every stage attempt becomes one RunRecord kept on the device; in playtest mode the tester
 * also answers a 3-question survey. The owner collects results as an exported JSON file, so
 * Gate 4 playtests need no backend. Pure logic: no Phaser.
 */
import type { KeyValueStore } from './SaveStore';

export const PLAYTEST_KEY = 'hot-relay-playtest';
export const PLAYTEST_FORMAT = 'hot-relay-playtest';
/** Oldest runs are dropped beyond this, so the log never grows without limit. */
export const MAX_RUNS = 300;
/** The prototype's headline metric: share of sessions with at least 3 minutes of play. */
export const SESSION_BAR_MS = 3 * 60 * 1000;

export type RunOutcome = 'clear' | 'quit' | 'restart';
export type InputKind = 'keyboard' | 'gamepad' | 'touch';
export type Again = 'yes' | 'maybe' | 'no';

export interface Survey {
  /** 1–5: how fun was that run? */
  fun: number;
  /** 1–5: did the controls do what you meant? (H4) */
  controls: number;
  /** Would you play another stage? */
  again: Again;
}

export const SURVEY_QUESTIONS = {
  fun: 'How fun was that run?',
  controls: 'Did the controls do what you meant?',
  again: 'Play another stage?',
} as const;

export interface RunRecord {
  id: string;
  /** ISO time the run ended. */
  at: string;
  sessionId: string;
  build: string;
  stage: string;
  mode: 'relay' | 'solo';
  squad: string[];
  outcome: RunOutcome;
  /** Stage play time (excludes the insertion cinematic and pauses). */
  timeMs: number;
  /** From control to the first enemy engaging; null if no fight happened. */
  firstFightMs: number | null;
  downs: number;
  /** Operators down per stage section; section 0 is before the first checkpoint. */
  downsBySection: number[];
  swaps: number;
  swapsPerMin: number;
  continues: number;
  /** The control the run was mostly played with. */
  input: InputKind;
  fpsP50: number;
  fpsP10: number;
  detail: string;
  /** Started from "Play again" or a restart rather than a fresh menu pick. */
  replay: boolean;
  device: { touch: boolean; screen: string; dpr: number; standalone: boolean; ua: string };
  survey: Survey | null;
}

export function swapsPerMinute(swaps: number, timeMs: number): number {
  if (timeMs <= 0) return 0;
  return Math.round((swaps / (timeMs / 60000)) * 100) / 100;
}

/** The input with the most play time; keyboard on a tie or with no samples. */
export function dominantInput(msBySource: Partial<Record<InputKind, number>>): InputKind {
  let best: InputKind = 'keyboard';
  let bestMs = 0;
  for (const k of ['keyboard', 'gamepad', 'touch'] as const) {
    const ms = msBySource[k] ?? 0;
    if (ms > bestMs) {
      best = k;
      bestMs = ms;
    }
  }
  return best;
}

export function isSurvey(v: unknown): v is Survey {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  const score = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 5;
  return score(s.fun) && score(s.controls) && (s.again === 'yes' || s.again === 'maybe' || s.again === 'no');
}

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const mean = (xs: number[]): number | null =>
  xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : null;

export interface GroupStats {
  runs: number;
  clears: number;
  /** Clears ÷ runs (quits and restarts count as not cleared). */
  clearRate: number | null;
}

export interface PlaytestSummary {
  runs: number;
  sessions: number;
  /** Prototype headline: sessions with ≥3 min of play ÷ sessions. */
  sessionsOver3Min: number;
  shareOver3Min: number | null;
  medianFirstFightMs: number | null;
  replays: number;
  /** H4: touch vs keyboard completion. */
  byInput: Record<InputKind, GroupStats>;
  /** H2: relay vs solo, with swaps per minute for relay. */
  byMode: Record<'relay' | 'solo', GroupStats & { medianSwapsPerMin: number | null }>;
  downsBySection: number[];
  survey: {
    answered: number;
    fun: number | null;
    controls: number | null;
    again: Record<Again, number>;
    /** Averages split by input and mode, for H4 and H2. */
    funByMode: Record<'relay' | 'solo', number | null>;
    controlsByInput: Record<InputKind, number | null>;
  };
}

function group(runs: RunRecord[]): GroupStats {
  const clears = runs.filter((r) => r.outcome === 'clear').length;
  return { runs: runs.length, clears, clearRate: runs.length ? Math.round((clears / runs.length) * 100) / 100 : null };
}

export function summarize(runs: RunRecord[]): PlaytestSummary {
  const bySession = new Map<string, number>();
  for (const r of runs) bySession.set(r.sessionId, (bySession.get(r.sessionId) ?? 0) + r.timeMs);
  const over = [...bySession.values()].filter((ms) => ms >= SESSION_BAR_MS).length;

  const downsBySection: number[] = [];
  for (const r of runs)
    r.downsBySection.forEach((n, i) => (downsBySection[i] = (downsBySection[i] ?? 0) + n));
  for (let i = 0; i < downsBySection.length; i++) downsBySection[i] ??= 0;

  const inputs = ['keyboard', 'gamepad', 'touch'] as const;
  const modes = ['relay', 'solo'] as const;
  const answered = runs.filter((r) => r.survey);
  const sv = (rs: RunRecord[], k: 'fun' | 'controls') => mean(rs.flatMap((r) => (r.survey ? [r.survey[k]] : [])));

  return {
    runs: runs.length,
    sessions: bySession.size,
    sessionsOver3Min: over,
    shareOver3Min: bySession.size ? Math.round((over / bySession.size) * 100) / 100 : null,
    medianFirstFightMs: median(runs.flatMap((r) => (r.firstFightMs === null ? [] : [r.firstFightMs]))),
    replays: runs.filter((r) => r.replay).length,
    byInput: Object.fromEntries(inputs.map((k) => [k, group(runs.filter((r) => r.input === k))])) as Record<
      InputKind,
      GroupStats
    >,
    byMode: Object.fromEntries(
      modes.map((m) => {
        const rs = runs.filter((r) => r.mode === m);
        return [m, { ...group(rs), medianSwapsPerMin: m === 'relay' ? median(rs.map((r) => r.swapsPerMin)) : null }];
      }),
    ) as PlaytestSummary['byMode'],
    downsBySection,
    survey: {
      answered: answered.length,
      fun: sv(answered, 'fun'),
      controls: sv(answered, 'controls'),
      again: {
        yes: answered.filter((r) => r.survey!.again === 'yes').length,
        maybe: answered.filter((r) => r.survey!.again === 'maybe').length,
        no: answered.filter((r) => r.survey!.again === 'no').length,
      },
      funByMode: Object.fromEntries(modes.map((m) => [m, sv(answered.filter((r) => r.mode === m), 'fun')])) as Record<
        'relay' | 'solo',
        number | null
      >,
      controlsByInput: Object.fromEntries(
        inputs.map((k) => [k, sv(answered.filter((r) => r.input === k), 'controls')]),
      ) as Record<InputKind, number | null>,
    },
  };
}

interface Stored {
  enabled: boolean;
  runs: RunRecord[];
}

/** Keep only records that look like runs, so a damaged store never breaks the game. */
export function repairLog(raw: unknown): Stored {
  const out: Stored = { enabled: false, runs: [] };
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  out.enabled = r.enabled === true;
  if (Array.isArray(r.runs)) {
    out.runs = r.runs
      .filter(
        (x): x is RunRecord =>
          !!x &&
          typeof x === 'object' &&
          typeof (x as RunRecord).id === 'string' &&
          typeof (x as RunRecord).timeMs === 'number' &&
          Array.isArray((x as RunRecord).downsBySection),
      )
      .map((x) => ({ ...x, survey: isSurvey(x.survey) ? x.survey : null }))
      .slice(-MAX_RUNS);
  }
  return out;
}

export class PlaytestLog {
  enabled = false;
  runs: RunRecord[] = [];
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly store: KeyValueStore) {}

  async load(): Promise<void> {
    try {
      const s = repairLog(await this.store.get(PLAYTEST_KEY));
      this.enabled = s.enabled;
      this.runs = s.runs;
    } catch (err) {
      console.warn('Playtest log load failed', err);
    }
  }

  private save(): Promise<void> {
    const snapshot: Stored = structuredClone({ enabled: this.enabled, runs: this.runs });
    this.writeChain = this.writeChain
      .then(() => this.store.set(PLAYTEST_KEY, snapshot))
      .catch((err) => console.warn('Playtest log write failed', err));
    return this.writeChain;
  }

  setEnabled(on: boolean): Promise<void> {
    this.enabled = on;
    return this.save();
  }

  add(run: RunRecord): Promise<void> {
    this.runs.push(run);
    if (this.runs.length > MAX_RUNS) this.runs.splice(0, this.runs.length - MAX_RUNS);
    return this.save();
  }

  setSurvey(id: string, survey: Survey): Promise<void> {
    const r = this.runs.find((x) => x.id === id);
    if (r && isSurvey(survey)) r.survey = survey;
    return this.save();
  }

  clear(): Promise<void> {
    this.runs = [];
    return this.save();
  }

  summary(): PlaytestSummary {
    return summarize(this.runs);
  }

  /** The file a tester sends back: summary first (readable), then every run. */
  exportJson(now = new Date()): string {
    return JSON.stringify(
      { format: PLAYTEST_FORMAT, version: 1, exportedAt: now.toISOString(), summary: this.summary(), runs: this.runs },
      null,
      2,
    );
  }
}
