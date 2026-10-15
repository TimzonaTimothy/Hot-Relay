/**
 * Event log for playtests. In Gate 3 events stay in memory (and the debug console);
 * Gate 4 adds the upload endpoint (ANALYTICS-01) using these same event names.
 */
export type TelemetryEvent =
  | 'session_start'
  | 'stage_start'
  | 'first_fight'
  | 'swap'
  | 'operator_down'
  | 'all_down'
  | 'retry'
  | 'checkpoint'
  | 'arena_start'
  | 'arena_clear'
  | 'stage_clear'
  | 'stage_quit'
  | 'stress_result'
  | 'insertion_done'
  | 'detail_change'
  | 'secret_route'
  | 'secret_found'
  | 'squad_selected'
  | 'pickup';

export interface TelemetryRecord {
  t: number;
  event: TelemetryEvent;
  data?: Record<string, unknown>;
}

class Telemetry {
  readonly sessionId = Math.random().toString(36).slice(2, 10);
  readonly records: TelemetryRecord[] = [];
  private readonly started = performance.now();
  debug = false;

  log(event: TelemetryEvent, data?: Record<string, unknown>): void {
    const rec: TelemetryRecord = { t: Math.round(performance.now() - this.started), event, data };
    this.records.push(rec);
    if (this.records.length > 2000) this.records.shift();
    if (this.debug) console.info('[telemetry]', event, data ?? '');
  }

  context(): Record<string, unknown> {
    return {
      online: typeof navigator !== 'undefined' ? navigator.onLine : true,
      standalone:
        typeof window !== 'undefined' &&
        window.matchMedia?.('(display-mode: standalone), (display-mode: fullscreen)').matches,
      ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    };
  }
}

export const telemetry = new Telemetry();

declare global {
  interface Window {
    __hotRelay?: {
      telemetry: Telemetry;
      stress?: { p50: number; p10: number; frames: number; detail?: 'high' | 'low' };
      /** Debug hooks (?debug=1) used by the smoke test. */
      debug?: {
        teleport(x: number, feetY: number): void;
        setInvulnerable(ms: number): void;
        clearEnemies(): void;
        /** Drop a pickup at the player's feet. */
        givePickup(kind: string): void;
        /** Visible objects per texture key (PERF-01 checks). */
        visibleByTexture(keys: string[]): Record<string, number>;
        feedAutoDetail(fps: number, ms: number): void;
        /** The live stage scene, for profiling from the console. */
        scene: unknown;
      };
      state?: Record<string, unknown>;
    };
  }
}
