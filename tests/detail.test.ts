import { describe, expect, it } from 'vitest';
import { AUTO_DETAIL, AutoDetail, resolveDetail } from '../src/systems/detail';
import { migrate } from '../src/systems/SaveStore';

/** Feed `ms` of frames at a steady fps; returns the last level reported. */
function feed(auto: AutoDetail, fps: number, ms: number): string {
  let level = '';
  for (let t = 0; t < ms; t += 1000 / fps) level = auto.addFrame(1000 / fps);
  return level;
}

describe('AutoDetail (PERF-01)', () => {
  it('stays high while sampling the first 4 s', () => {
    const a = new AutoDetail();
    expect(feed(a, 20, AUTO_DETAIL.windowMs - 200)).toBe('high');
    expect(a.decision).toBeNull();
  });

  it('drops to low when the median is below 50 fps', () => {
    const a = new AutoDetail();
    expect(feed(a, 22, AUTO_DETAIL.windowMs + 100)).toBe('low');
    expect(a.decision).toBe('low');
  });

  it('keeps high at 50 fps or more', () => {
    const a = new AutoDetail();
    expect(feed(a, 60, AUTO_DETAIL.windowMs + 100)).toBe('high');
    expect(a.decision).toBe('high');
    const b = new AutoDetail();
    expect(feed(b, 50, AUTO_DETAIL.windowMs + 100)).toBe('high');
  });

  it('uses the median, so a few long hitches do not force low', () => {
    const a = new AutoDetail();
    a.addFrame(400); // loading hitch
    a.addFrame(250);
    expect(feed(a, 60, AUTO_DETAIL.windowMs)).toBe('high');
  });

  it('decides once and does not switch back up', () => {
    const a = new AutoDetail();
    feed(a, 30, AUTO_DETAIL.windowMs + 100);
    expect(feed(a, 60, 10_000)).toBe('low');
  });

  it('ignores bad frame times and starts over on reset', () => {
    const a = new AutoDetail();
    a.addFrame(NaN);
    a.addFrame(-5);
    a.addFrame(0);
    expect(a.decision).toBeNull();
    feed(a, 30, AUTO_DETAIL.windowMs + 100);
    a.reset();
    expect(a.decision).toBeNull();
    expect(feed(a, 60, AUTO_DETAIL.windowMs + 100)).toBe('high');
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
