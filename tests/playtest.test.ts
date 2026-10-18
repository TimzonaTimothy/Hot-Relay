import { describe, expect, it } from 'vitest';
import { MemoryStore } from '../src/systems/SaveStore';
import {
  MAX_RUNS,
  PLAYTEST_KEY,
  PlaytestLog,
  deviceLabel,
  dominantInput,
  fpsByDevice,
  isSurvey,
  repairLog,
  summarize,
  swapsPerMinute,
  type RunRecord,
  type StressRecord,
} from '../src/systems/playtest';

let n = 0;
function run(over: Partial<RunRecord> = {}): RunRecord {
  n++;
  return {
    id: `r${n}`,
    at: '2026-10-16T10:00:00.000Z',
    sessionId: 's1',
    build: 'test',
    stage: 'greybox01',
    mode: 'relay',
    squad: ['kemi', 'rurik', 'tari'],
    outcome: 'clear',
    timeMs: 60000,
    firstFightMs: 8000,
    downs: 1,
    downsBySection: [1, 0],
    swaps: 3,
    swapsPerMin: 3,
    continues: 0,
    input: 'keyboard',
    fpsP50: 60,
    fpsP10: 55,
    detail: 'high',
    replay: false,
    device: { touch: false, screen: '1920x1080', dpr: 2, standalone: false, ua: 'test' },
    survey: null,
    ...over,
  };
}

describe('playtest metrics', () => {
  it('swaps per minute', () => {
    expect(swapsPerMinute(3, 90000)).toBe(2);
    expect(swapsPerMinute(5, 0)).toBe(0);
  });

  it('picks the input with the most play time', () => {
    expect(dominantInput({ keyboard: 1000, touch: 5000 })).toBe('touch');
    expect(dominantInput({})).toBe('keyboard');
  });

  it('validates survey answers', () => {
    expect(isSurvey({ fun: 4, controls: 2, again: 'maybe' })).toBe(true);
    expect(isSurvey({ fun: 6, controls: 2, again: 'yes' })).toBe(false);
    expect(isSurvey({ fun: 3, controls: 3, again: 'sure' })).toBe(false);
  });

  it('summarises the Gate 4 numbers', () => {
    const runs = [
      // session 1: keyboard, relay, two clears, 4 minutes in total
      run({ sessionId: 'a', timeMs: 120000, swapsPerMin: 2, downsBySection: [1, 2] }),
      run({
        sessionId: 'a',
        timeMs: 120000,
        swapsPerMin: 4,
        replay: true,
        survey: { fun: 4, controls: 5, again: 'yes' },
      }),
      // session 2: touch, solo, a quit after one minute
      run({
        sessionId: 'b',
        timeMs: 60000,
        mode: 'solo',
        input: 'touch',
        outcome: 'quit',
        firstFightMs: null,
        downsBySection: [0, 0, 3],
        survey: { fun: 2, controls: 1, again: 'no' },
      }),
    ];
    const s = summarize(runs);
    expect(s.runs).toBe(3);
    expect(s.sessions).toBe(2);
    expect(s.sessionsOver3Min).toBe(1);
    expect(s.shareOver3Min).toBe(0.5);
    expect(s.medianFirstFightMs).toBe(8000);
    expect(s.replays).toBe(1);
    expect(s.byInput.keyboard).toEqual({ runs: 2, clears: 2, clearRate: 1 });
    expect(s.byInput.touch).toEqual({ runs: 1, clears: 0, clearRate: 0 });
    expect(s.byInput.gamepad.clearRate).toBeNull();
    expect(s.byMode.relay.medianSwapsPerMin).toBe(3);
    expect(s.byMode.solo.medianSwapsPerMin).toBeNull();
    expect(s.downsBySection).toEqual([2, 2, 3]);
    expect(s.survey.answered).toBe(2);
    expect(s.survey.fun).toBe(3);
    expect(s.survey.again).toEqual({ yes: 1, maybe: 0, no: 1 });
    expect(s.survey.funByMode).toEqual({ relay: 4, solo: 2 });
    expect(s.survey.controlsByInput.touch).toBe(1);
  });

  it('an empty log summarises without dividing by zero', () => {
    const s = summarize([]);
    expect(s.shareOver3Min).toBeNull();
    expect(s.medianFirstFightMs).toBeNull();
    expect(s.survey.fun).toBeNull();
  });
});

describe('PlaytestLog storage', () => {
  it('saves runs and survey answers, and reloads them', async () => {
    const store = new MemoryStore();
    const a = new PlaytestLog(store);
    await a.setEnabled(true);
    const r = run();
    await a.add(r);
    await a.setSurvey(r.id, { fun: 5, controls: 4, again: 'yes' });
    const b = new PlaytestLog(store);
    await b.load();
    expect(b.enabled).toBe(true);
    expect(b.runs).toHaveLength(1);
    expect(b.runs[0]!.survey).toEqual({ fun: 5, controls: 4, again: 'yes' });
  });

  it('ignores invalid survey answers', async () => {
    const log = new PlaytestLog(new MemoryStore());
    const r = run();
    await log.add(r);
    await log.setSurvey(r.id, { fun: 9, controls: 1, again: 'yes' });
    expect(log.runs[0]!.survey).toBeNull();
  });

  it('keeps at most MAX_RUNS, dropping the oldest', async () => {
    const log = new PlaytestLog(new MemoryStore());
    for (let i = 0; i < MAX_RUNS + 5; i++) await log.add(run({ id: `k${i}` }));
    expect(log.runs).toHaveLength(MAX_RUNS);
    expect(log.runs[0]!.id).toBe('k5');
  });

  it('repairs a damaged store', async () => {
    const store = new MemoryStore();
    await store.set(PLAYTEST_KEY, {
      enabled: 'yes',
      runs: [run(), { id: 3 }, null, run({ survey: { fun: 0 } as never })],
    });
    const log = new PlaytestLog(store);
    await log.load();
    expect(log.enabled).toBe(false);
    expect(log.runs).toHaveLength(2);
    expect(log.runs[1]!.survey).toBeNull();
    expect(repairLog('junk')).toEqual({ enabled: false, runs: [], stress: [] });
  });

  it('exports a self-describing file with the summary first', async () => {
    const log = new PlaytestLog(new MemoryStore());
    await log.add(run());
    const file = JSON.parse(log.exportJson(new Date('2026-10-16T12:00:00Z')));
    expect(file.format).toBe('hot-relay-playtest');
    expect(file.exportedAt).toBe('2026-10-16T12:00:00.000Z');
    expect(Object.keys(file)).toEqual([
      'format',
      'version',
      'exportedAt',
      'summary',
      'runs',
      'stress',
    ]);
    expect(file.runs).toHaveLength(1);
  });
});

const UA = {
  android:
    'Mozilla/5.0 (Linux; Android 13; Pixel 6a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36',
  androidTab:
    'Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  windows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
};
const dev = (ua: string, touch = false) => ({
  touch,
  screen: '1x1',
  dpr: 1,
  standalone: false,
  ua,
});

describe('fps by device (ANALYTICS-04)', () => {
  it('labels devices from the user agent', () => {
    expect(deviceLabel(dev(UA.android, true))).toBe('Android phone');
    expect(deviceLabel(dev(UA.androidTab, true))).toBe('Android tablet');
    expect(deviceLabel(dev(UA.iphone, true))).toBe('iPhone');
    expect(deviceLabel(dev(UA.mac, true))).toBe('iPad'); // iPadOS reports as a Mac with touch
    expect(deviceLabel(dev(UA.mac))).toBe('Mac');
    expect(deviceLabel(dev(UA.windows))).toBe('Windows PC');
  });

  const stress = (ua: string, p50: number, p10: number): StressRecord => ({
    id: `s${p50}`,
    at: '2026-10-18T10:00:00.000Z',
    build: 'test',
    p50,
    p10,
    frames: 600,
    detail: 'high',
    device: dev(ua, true),
  });

  it('groups stress tests and runs per device and checks the H10 target', () => {
    const runs = [
      run({ device: dev(UA.android, true), fpsP50: 50, fpsP10: 40 }),
      run({ device: dev(UA.mac), fpsP50: 60, fpsP10: 59 }),
    ];
    const rows = fpsByDevice(runs, [stress(UA.android, 58, 47), stress(UA.android, 56, 44)]);
    const phone = rows.find((r) => r.device === 'Android phone')!;
    expect(phone.stressTests).toBe(2);
    expect(phone.stressP50).toBe(57);
    expect(phone.stressP10).toBe(45.5);
    expect(phone.runP50).toBe(50);
    expect(phone.meetsTarget).toBe(true); // judged on the stress test when there is one
    const mac = rows.find((r) => r.device === 'Mac')!;
    expect(mac.stressTests).toBe(0);
    expect(mac.meetsTarget).toBe(true); // falls back to gameplay frames
  });

  it('a slow phone fails the target', () => {
    const rows = fpsByDevice([], [stress(UA.iphone, 41, 30)]);
    expect(rows[0]).toMatchObject({ device: 'iPhone', meetsTarget: false });
  });

  it('stress results are stored, exported and cleared with the runs', async () => {
    const store = new MemoryStore();
    const a = new PlaytestLog(store);
    await a.addStress(stress(UA.android, 60, 55));
    const b = new PlaytestLog(store);
    await b.load();
    expect(b.stress).toHaveLength(1);
    expect(JSON.parse(b.exportJson()).summary.fpsByDevice[0].device).toBe('Android phone');
    await b.clear();
    expect(b.stress).toHaveLength(0);
  });
});
