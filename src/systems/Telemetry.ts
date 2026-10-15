export interface TelemetryEvent {
  name: string;
  t: number;
  data?: Record<string, unknown>;
}

/** In-memory event log. Upload comes with the backend (ANALYTICS-01). */
export class Telemetry {
  readonly events: TelemetryEvent[] = [];
  private readonly t0 = Date.now();

  log(name: string, data?: Record<string, unknown>): void {
    this.events.push({ name, t: (Date.now() - this.t0) / 1000, data });
    if (this.events.length > 5000) this.events.shift();
  }

  count(name: string): number {
    return this.events.filter((e) => e.name === name).length;
  }
}
