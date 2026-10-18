/**
 * Offline playtest log (ANALYTICS-03/04, groundwork for ANALYTICS-02 and TEST-01/02/03).
 * Every stage attempt becomes one RunRecord kept on the device; in playtest mode the tester
 * also answers a 3-question survey. Stress-test results (?stage=stress) are kept too, so frame
 * rates from real phones (H10, PERF-01, TEST-01) arrive in the same exported file. The owner collects results as an exported JSON file, so
 * Gate 4 playtests need no backend. Pure logic: no Phaser.
 */
import type { KeyValueStore } from './SaveStore';

export const PLAYTEST_KEY = 'hot-relay-playtest';
export const PLAYTEST_FORMAT = 'hot-relay-playtest';
/** Oldest runs are dropped beyond this, so the log never grows without limit. */
export const MAX_RUNS = 300;
/** The prototype's headline metric: share of sessions with at least 3 minutes of play. */
export const SESSION_BAR_MS = 3 * 60 * 1000;
/** H10 targets: median and slowest-10% frame rate. */
export const FPS_TARGET = { p50: 55, p10: 45 } as const;

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

export type DeviceInfo = RunRecord['device'];

/** One stress-scene measurement (TEST-01: 60 enemies, ~200 bullets, 10 s). */
export interface StressRecord {
  id: string;
  at: string;
  build: string;
  p50: number;
  p10: number;
  frames: number;
  detail: string;
  device: DeviceInfo;
}

/**
 * Short readable device label from the user agent and screen: "Android phone", "iPhone",
 * "iPad", "Android tablet", "Mac", "Windows PC", "Linux PC", or "Other".
 */
export function deviceLabel(d: DeviceInfo): string {
  const ua = d.ua;
  if (/iPhone/.test(ua)) return 'iPhone';
  // iPadOS reports as a Mac with touch
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && d.touch)) return 'iPad';
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'Android phone' : 'Android tablet';
  if (/Macintosh|Mac OS X/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows PC';
  if (/CrOS/.test(ua)) return 'Chromebook';
  if (/Linux/.test(ua)) return 'Linux PC';
  return 'Other';
}

export interface DeviceFps {
  device: string;
  /** Stage runs and stress tests measured on this kind of device. */
  runs: number;
  stressTests: number;
  /** Medians across runs (gameplay frames). */
  runP50: number | null;
  runP10: number | null;
  /** Medians across stress tests (the H10 measurement). */
  stressP50: number | null;
  stressP10: number | null;
  /** Meets H10 on the stress test (falls back to gameplay runs if there is no stress test). */
  meetsTarget: boolean | null;
}

/** Describe the device this build is running on (browser APIs only; safe in tests). */
export function currentDevice(standalone = false): DeviceInfo {
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  const scr = typeof screen !== 'undefined' ? screen : null;
  return {
    touch: (nav?.maxTouchPoints ?? 0) > 0,
    screen: scr ? `${scr.width}x${scr.height}` : 'unknown',
    dpr: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    standalone,
    ua: nav?.userAgent ?? '',
  };
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
  return (
    score(s.fun) &&
    score(s.controls) &&
    (s.again === 'yes' || s.again === 'maybe' || s.again === 'no')
  );
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
  /** ANALYTICS-04 / H10: frame rate per kind of device. */
  fpsByDevice: DeviceFps[];
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
  return {
    runs: runs.length,
    clears,
    clearRate: runs.length ? Math.round((clears / runs.length) * 100) / 100 : null,
  };
}

export function fpsByDevice(runs: RunRecord[], stress: StressRecord[]): DeviceFps[] {
  const labels = new Set([
    ...runs.map((r) => deviceLabel(r.device)),
    ...stress.map((s) => deviceLabel(s.device)),
  ]);
  const out: DeviceFps[] = [];
  for (const device of [...labels].sort()) {
    const rs = runs.filter((r) => deviceLabel(r.device) === device && r.fpsP50 > 0);
    const ss = stress.filter((s) => deviceLabel(s.device) === device);
    const stressP50 = median(ss.map((s) => s.p50));
    const stressP10 = median(ss.map((s) => s.p10));
    const runP50 = median(rs.map((r) => r.fpsP50));
    const runP10 = median(rs.map((r) => r.fpsP10));
    const p50 = stressP50 ?? runP50;
    const p10 = stressP10 ?? runP10;
    out.push({
      device,
      runs: rs.length,
      stressTests: ss.length,
      runP50,
      runP10,
      stressP50,
      stressP10,
      meetsTarget:
        p50 === null || p10 === null ? null : p50 >= FPS_TARGET.p50 && p10 >= FPS_TARGET.p10,
    });
  }
  return out;
}

export function summarize(runs: RunRecord[], stress: StressRecord[] = []): PlaytestSummary {
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
  const sv = (rs: RunRecord[], k: 'fun' | 'controls') =>
    mean(rs.flatMap((r) => (r.survey ? [r.survey[k]] : [])));

  return {
    runs: runs.length,
    sessions: bySession.size,
    sessionsOver3Min: over,
    shareOver3Min: bySession.size ? Math.round((over / bySession.size) * 100) / 100 : null,
    medianFirstFightMs: median(
      runs.flatMap((r) => (r.firstFightMs === null ? [] : [r.firstFightMs])),
    ),
    replays: runs.filter((r) => r.replay).length,
    byInput: Object.fromEntries(
      inputs.map((k) => [k, group(runs.filter((r) => r.input === k))]),
    ) as Record<InputKind, GroupStats>,
    byMode: Object.fromEntries(
      modes.map((m) => {
        const rs = runs.filter((r) => r.mode === m);
        return [
          m,
          {
            ...group(rs),
            medianSwapsPerMin: m === 'relay' ? median(rs.map((r) => r.swapsPerMin)) : null,
          },
        ];
      }),
    ) as PlaytestSummary['byMode'],
    downsBySection,
    fpsByDevice: fpsByDevice(runs, stress),
    survey: {
      answered: answered.length,
      fun: sv(answered, 'fun'),
      controls: sv(answered, 'controls'),
      again: {
        yes: answered.filter((r) => r.survey!.again === 'yes').length,
        maybe: answered.filter((r) => r.survey!.again === 'maybe').length,
        no: answered.filter((r) => r.survey!.again === 'no').length,
      },
      funByMode: Object.fromEntries(
        modes.map((m) => [
          m,
          sv(
            answered.filter((r) => r.mode === m),
            'fun',
          ),
        ]),
      ) as Record<'relay' | 'solo', number | null>,
      controlsByInput: Object.fromEntries(
        inputs.map((k) => [
          k,
          sv(
            answered.filter((r) => r.input === k),
            'controls',
          ),
        ]),
      ) as Record<InputKind, number | null>,
    },
  };
}

interface Stored {
  enabled: boolean;
  runs: RunRecord[];
  stress: StressRecord[];
}

/** Keep only records that look like runs, so a damaged store never breaks the game. */
export function repairLog(raw: unknown): Stored {
  const out: Stored = { enabled: false, runs: [], stress: [] };
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
  if (Array.isArray(r.stress)) {
    out.stress = r.stress
      .filter(
        (x): x is StressRecord =>
          !!x &&
          typeof x === 'object' &&
          typeof (x as StressRecord).p50 === 'number' &&
          typeof (x as StressRecord).p10 === 'number' &&
          !!(x as StressRecord).device,
      )
      .slice(-MAX_RUNS);
  }
  return out;
}

export class PlaytestLog {
  enabled = false;
  runs: RunRecord[] = [];
  stress: StressRecord[] = [];
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly store: KeyValueStore) {}

  async load(): Promise<void> {
    try {
      const s = repairLog(await this.store.get(PLAYTEST_KEY));
      this.enabled = s.enabled;
      this.runs = s.runs;
      this.stress = s.stress;
    } catch (err) {
      console.warn('Playtest log load failed', err);
    }
  }

  private save(): Promise<void> {
    const snapshot: Stored = structuredClone({
      enabled: this.enabled,
      runs: this.runs,
      stress: this.stress,
    });
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

  addStress(rec: StressRecord): Promise<void> {
    this.stress.push(rec);
    if (this.stress.length > MAX_RUNS) this.stress.splice(0, this.stress.length - MAX_RUNS);
    return this.save();
  }

  setSurvey(id: string, survey: Survey): Promise<void> {
    const r = this.runs.find((x) => x.id === id);
    if (r && isSurvey(survey)) r.survey = survey;
    return this.save();
  }

  clear(): Promise<void> {
    this.runs = [];
    this.stress = [];
    return this.save();
  }

  summary(): PlaytestSummary {
    return summarize(this.runs, this.stress);
  }

  /** The file a tester sends back: summary first (readable), then every run. */
  exportJson(now = new Date()): string {
    return JSON.stringify(
      {
        format: PLAYTEST_FORMAT,
        version: 1,
        exportedAt: now.toISOString(),
        summary: this.summary(),
        runs: this.runs,
        stress: this.stress,
      },
      null,
      2,
    );
  }
}
