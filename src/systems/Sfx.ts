export type SfxName =
  | 'smg'
  | 'lmg'
  | 'dmr'
  | 'enemyShot'
  | 'hit'
  | 'armour'
  | 'hurt'
  | 'down'
  | 'explode'
  | 'jump'
  | 'swap'
  | 'pound'
  | 'checkpoint'
  | 'ui'
  | 'confirm'
  | 'clear';

/** Placeholder sound set synthesised with Web Audio. No files to download. */
export class Sfx {
  enabled = true;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private lastPlay: Partial<Record<SfxName, number>> = {};

  /** Must be called from a user gesture on iOS. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  suspend(): void {
    if (this.ctx?.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  play(name: SfxName): void {
    const ctx = this.ctx;
    if (!this.enabled || !ctx || !this.master || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    // Rapid-fire sounds are rate-limited so 11 shots/s plus enemies don't pile up.
    const minGap = name === 'hit' || name === 'enemyShot' ? 0.04 : 0.02;
    if (now - (this.lastPlay[name] ?? -1) < minGap) return;
    this.lastPlay[name] = now;

    switch (name) {
      case 'smg':
        this.noiseBurst(now, 0.06, 2600, 0.5);
        this.tone(now, 'square', 420, 120, 0.05, 0.12);
        break;
      case 'lmg':
        this.noiseBurst(now, 0.09, 1500, 0.7);
        this.tone(now, 'square', 220, 70, 0.08, 0.18);
        break;
      case 'dmr':
        this.noiseBurst(now, 0.18, 3800, 0.8);
        this.tone(now, 'sawtooth', 900, 120, 0.16, 0.2);
        break;
      case 'enemyShot':
        this.tone(now, 'square', 620, 260, 0.08, 0.1);
        break;
      case 'hit':
        this.noiseBurst(now, 0.05, 5000, 0.35);
        break;
      case 'armour':
        this.tone(now, 'triangle', 1200, 700, 0.12, 0.25);
        break;
      case 'hurt':
        this.tone(now, 'sawtooth', 300, 90, 0.2, 0.3);
        break;
      case 'down':
        this.tone(now, 'sawtooth', 400, 50, 0.6, 0.3);
        break;
      case 'explode':
        this.noiseBurst(now, 0.4, 900, 0.9);
        this.tone(now, 'sine', 140, 30, 0.35, 0.5);
        break;
      case 'jump':
        this.tone(now, 'square', 260, 520, 0.08, 0.08);
        break;
      case 'swap':
        this.tone(now, 'triangle', 500, 1300, 0.14, 0.25);
        this.tone(now + 0.06, 'triangle', 800, 1600, 0.1, 0.18);
        break;
      case 'pound':
        this.noiseBurst(now, 0.35, 500, 1);
        this.tone(now, 'sine', 110, 35, 0.4, 0.6);
        break;
      case 'checkpoint':
        [660, 880, 1100].forEach((f, i) => this.tone(now + i * 0.08, 'triangle', f, f, 0.12, 0.2));
        break;
      case 'ui':
        this.tone(now, 'square', 700, 700, 0.04, 0.08);
        break;
      case 'confirm':
        this.tone(now, 'square', 600, 1200, 0.1, 0.12);
        break;
      case 'clear':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(now + i * 0.12, 'square', f, f, 0.18, 0.14));
        break;
    }
  }

  private tone(t: number, type: OscillatorType, f0: number, f1: number, dur: number, vol: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noiseBurst(t: number, dur: number, cutoff: number, vol: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(60, cutoff * 0.2), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(g).connect(this.master!);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }
}
