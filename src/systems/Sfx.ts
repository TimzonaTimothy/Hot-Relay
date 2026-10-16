/**
 * Placeholder sound effects synthesised with Web Audio (AUDIO-01).
 * No audio files means nothing extra to download and it all works offline.
 * Final sounds replace these in Gate 5 (AUDIO-02).
 */
type Wave = OscillatorType;

class SfxEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private volume = 0.6;
  private muted = false;
  private lastPlay = new Map<string, number>();

  setVolume(v: number): void {
    this.volume = Math.min(1, Math.max(0, v));
    if (this.master) this.master.gain.value = this.volume * 0.35;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ctx) void (m ? this.ctx.suspend() : this.ctx.resume());
  }

  /** Browsers only allow audio after a user gesture; call from the first input. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && !this.muted) void this.ctx.resume();
      return;
    }
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume * 0.35;
    this.master.connect(this.ctx.destination);
  }

  private tone(
    key: string,
    freq: number,
    durMs: number,
    wave: Wave,
    opts: { slideTo?: number; gain?: number; minGapMs?: number; noise?: boolean } = {},
  ): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.muted || this.volume <= 0) return;
    const now = ctx.currentTime;
    const gap = (opts.minGapMs ?? 0) / 1000;
    const last = this.lastPlay.get(key) ?? -1;
    if (now - last < gap) return;
    this.lastPlay.set(key, now);

    const g = ctx.createGain();
    const peak = opts.gain ?? 0.5;
    g.gain.setValueAtTime(peak, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + durMs / 1000);
    g.connect(master);

    if (opts.noise) {
      const len = Math.ceil((ctx.sampleRate * durMs) / 1000);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = freq;
      src.connect(filter).connect(g);
      src.start(now);
      return;
    }

    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, now);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, now + durMs / 1000);
    osc.connect(g);
    osc.start(now);
    osc.stop(now + durMs / 1000 + 0.02);
  }

  shoot(pitch: number): void {
    this.tone('shoot', pitch, 60, 'square', { slideTo: pitch * 0.6, gain: 0.18, minGapMs: 45 });
  }
  enemyShoot(): void {
    this.tone('eshoot', 300, 90, 'sawtooth', { slideTo: 180, gain: 0.15, minGapMs: 40 });
  }
  hit(): void {
    this.tone('hit', 1800, 40, 'square', { gain: 0.12, minGapMs: 30, noise: true });
  }
  enemyDie(): void {
    this.tone('die', 900, 220, 'square', { gain: 0.35, noise: true });
  }
  hurt(): void {
    this.tone('hurt', 220, 200, 'sawtooth', { slideTo: 90, gain: 0.4 });
  }
  down(): void {
    this.tone('down', 330, 500, 'triangle', { slideTo: 60, gain: 0.5 });
  }
  jump(): void {
    this.tone('jump', 260, 90, 'square', { slideTo: 520, gain: 0.12, minGapMs: 50 });
  }
  swap(): void {
    this.tone('swap1', 520, 70, 'square', { gain: 0.22 });
    window.setTimeout(() => this.tone('swap2', 780, 70, 'square', { gain: 0.22 }), 60);
    window.setTimeout(() => this.tone('swap3', 1040, 110, 'square', { gain: 0.22 }), 120);
  }
  pound(): void {
    this.tone('pound', 400, 260, 'square', { gain: 0.6, noise: true });
  }
  telegraph(): void {
    this.tone('tele', 1400, 80, 'sine', { gain: 0.12, minGapMs: 120 });
  }
  checkpoint(): void {
    this.tone('cp1', 660, 90, 'triangle', { gain: 0.3 });
    window.setTimeout(() => this.tone('cp2', 990, 140, 'triangle', { gain: 0.3 }), 90);
  }
  clear(): void {
    [523, 659, 784, 1046].forEach((f, i) =>
      window.setTimeout(() => this.tone(`clr${i}`, f, 160, 'square', { gain: 0.25 }), i * 110),
    );
  }
  splash(big: boolean): void {
    this.tone('splash', big ? 900 : 1600, big ? 420 : 200, 'sine', {
      gain: big ? 0.45 : 0.22,
      noise: true,
      minGapMs: 80,
    });
  }
  dash(): void {
    this.tone('dash', 1400, 140, 'sine', { gain: 0.2, noise: true, minGapMs: 80 });
  }
  pickupWeapon(): void {
    [440, 660, 990, 1320].forEach((f, i) =>
      window.setTimeout(() => this.tone(`pw${i}`, f, 80, 'square', { gain: 0.2 }), i * 55),
    );
  }
  grenadeBounce(): void {
    this.tone('gb', 320, 50, 'triangle', { gain: 0.15, minGapMs: 60 });
  }
  ping(): void {
    this.tone('ping', 2600, 60, 'triangle', { gain: 0.12, minGapMs: 50 });
  }
  rocket(): void {
    this.tone('rkt', 200, 260, 'sawtooth', { slideTo: 90, gain: 0.22, noise: true, minGapMs: 80 });
  }
  climb(): void {
    this.tone('climb', 180, 120, 'triangle', { slideTo: 260, gain: 0.2, minGapMs: 100 });
  }
  reload(): void {
    this.tone('rl1', 1200, 35, 'square', { gain: 0.12 });
    window.setTimeout(() => this.tone('rl2', 700, 50, 'square', { gain: 0.14 }), 90);
  }
  reloadDone(): void {
    this.tone('rld', 1500, 45, 'square', { gain: 0.14, minGapMs: 60 });
  }
  dryFire(): void {
    this.tone('dry', 2400, 25, 'square', { gain: 0.08, minGapMs: 180 });
  }
  weaponSwitch(): void {
    this.tone('wsw', 900, 40, 'square', { slideTo: 1300, gain: 0.14, minGapMs: 60 });
  }
  gasp(): void {
    this.tone('gasp', 500, 260, 'sine', { gain: 0.25, noise: true, minGapMs: 400 });
  }
  airWarning(): void {
    this.tone('air', 1760, 70, 'sine', { gain: 0.14, minGapMs: 500 });
  }
  explosion(): void {
    this.tone('boom', 260, 520, 'square', { gain: 0.6, noise: true, minGapMs: 60 });
  }
  pickup(): void {
    [660, 880, 1320].forEach((f, i) =>
      window.setTimeout(() => this.tone(`pk${i}`, f, 90, 'triangle', { gain: 0.25 }), i * 70),
    );
  }

  /**
   * Helicopter rotor loop: filtered noise chopped by a ~11 Hz amplitude LFO (the "whop"),
   * plus a low turbine hum. Placeholder synthesis; volume follows `setRotor`.
   */
  private rotor: { gain: GainNode; stop: () => void } | null = null;

  startRotor(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.rotor) return;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(master);

    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const chop = ctx.createGain();
    chop.gain.value = 0.5;
    const lfo = ctx.createOscillator();
    lfo.type = 'sawtooth';
    lfo.frequency.value = 11;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.5;
    lfo.connect(lfoDepth).connect(chop.gain);
    noise.connect(lp).connect(chop).connect(out);

    const hum = ctx.createOscillator();
    hum.type = 'triangle';
    hum.frequency.value = 74;
    const humGain = ctx.createGain();
    humGain.gain.value = 0.18;
    hum.connect(humGain).connect(out);

    noise.start();
    lfo.start();
    hum.start();
    this.rotor = {
      gain: out,
      stop: () => {
        for (const n of [noise, lfo, hum]) {
          try {
            n.stop();
          } catch {
            /* already stopped */
          }
        }
        out.disconnect();
      },
    };
  }

  /** 0..1 loudness of the rotor loop (distance and departure). */
  setRotor(level: number): void {
    if (!this.rotor || !this.ctx) return;
    this.rotor.gain.gain.setTargetAtTime(
      Math.max(0, Math.min(1, level)) * 0.9,
      this.ctx.currentTime,
      0.05,
    );
  }

  stopRotor(): void {
    this.rotor?.stop();
    this.rotor = null;
  }

  ui(): void {
    this.tone('ui', 700, 40, 'square', { gain: 0.12, minGapMs: 40 });
  }
}

export const sfx = new SfxEngine();
