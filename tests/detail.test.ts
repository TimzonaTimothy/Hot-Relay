import { describe, expect, it } from 'vitest';
import { AUTO_DETAIL, AutoDetail, resolveDetail } from '../src/systems/detail';
import { migrate } from '../src/systems/SaveStore';

/** Feed `ms` of frames at a steady fps; returns the last level reported. */
function feed(auto: AutoDetail, fps: number, ms: number): string {
  let level = '';
  for (let t = 0; t < ms; t += 1000 / fps) level = auto.addFrame(1000 / fps);
  return level;
}

const W = AUTO_DETAIL.windowMs;

describe('AutoDetail rolling window (PERF-01)', () => {
  it('stays high until a full 5 s window has been seen, even when slow', () => {
    const a = new AutoDetail();
    expect(feed(a, 20, W - 300)).toBe('high');
    expect(a.decision).toBeNull();
  });

  it('lowers once a full window has a median below 50 fps', () => {
    const a = new AutoDetail();
    expect(feed(a, 22, W + 300)).toBe('low');
    expect(a.decision).toBe('low');
    expect(a.medianFps).toBeLessThan(50);
  });

  it('keeps high at a steady 50 fps or more', () => {
    for (const fps of [50, 60, 120]) {
      const a = new AutoDetail();
      expect(feed(a, fps, 60_000)).toBe('high');
      expect(a.decision).toBeNull();
    }
  });

  it('catches a slowdown late in the stage, not just at the start', () => {
    const a = new AutoDetail();
    expect(feed(a, 60, 40_000)).toBe('high'); // cheap opening section
    expect(feed(a, 60, 2_000)).toBe('high');
    expect(feed(a, 25, 2_000)).toBe('high'); // window still mostly fast frames
    expect(feed(a, 25, 2_000)).toBe('low'); // now most of the last 5 s is slow
  });

  it('ignores a short dip that never makes up half the window', () => {
    const a = new AutoDetail();
    for (let i = 0; i < 20; i++) {
      feed(a, 60, 4_000);
      feed(a, 20, 1_000);
    }
    expect(a.decision).toBeNull();
  });

  it('uses the median, so hitches do not lower detail', () => {
    const a = new AutoDetail();
    for (let i = 0; i < 300; i++) {
      a.addFrame(1000 / 60);
      if (i % 10 === 0) a.addFrame(120); // 10% long frames
    }
    expect(a.decision).toBeNull();
  });

  it('never switches back up, even after clearing the window', () => {
    const a = new AutoDetail();
    feed(a, 30, W + 300);
    expect(feed(a, 60, 30_000)).toBe('low');
    a.clearWindow();
    expect(feed(a, 60, 30_000)).toBe('low');
    expect(a.decision).toBe('low');
  });

  it('ignores bad and very long frames, so one stall cannot fill the window', () => {
    const a = new AutoDetail();
    a.addFrame(NaN);
    a.addFrame(-5);
    a.addFrame(0);
    a.addFrame(8000); // returning from a background tab
    expect(feed(a, 60, 100)).toBe('high');
    expect(a.decision).toBeNull();
  });

  it('clearing the window restarts the 5 s count when not yet lowered', () => {
    const a = new AutoDetail();
    feed(a, 20, W - 500);
    a.clearWindow();
    expect(feed(a, 20, W - 500)).toBe('high');
    expect(feed(a, 20, 1_000)).toBe('low');
  });
});

describe('resolveDetail', () => {
  it('follows the setting, with the URL flag taking priority', () => {
    expect(resolveDetail('high', null, 'low')).toBe('high');
    expect(resolveDetail('low', null, 'high')).toBe('low');
    expect(resolveDetail('high', 'low', null)).toBe('low');
    expect(resolveDetail('low', 'auto', 'high')).toBe('high');
  });

  it('auto is high until decided, then the decision', () => {
    expect(resolveDetail('auto', null, null)).toBe('high');
    expect(resolveDetail('auto', null, 'low')).toBe('low');
  });
});

describe('detail setting in the save', () => {
  it('defaults to auto and repairs bad values', () => {
    expect(migrate({}).settings.detail).toBe('auto');
    expect(migrate({ version: 1, settings: { detail: 'low' } }).settings.detail).toBe('low');
    expect(migrate({ version: 1, settings: { detail: 'ultra' } }).settings.detail).toBe('auto');
  });
});
