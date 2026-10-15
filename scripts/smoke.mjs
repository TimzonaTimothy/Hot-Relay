// Headless smoke test for the built game (TEST-08 seed).
// Usage: npm run build && CHROME_PATH=/path/to/chrome node scripts/smoke.mjs
// Starts `vite preview`, then: menu → squad select → helicopter insertion (unskippable the
// first time, skippable after), a bot plays the stage to the goal (swimming the basin), swap,
// weapon switch, reload and pause work, swimming/climbing/sinking/drowning behave, touch
// controls work on a phone, the stress test reports fps, and the game launches offline.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 4173;
const BASE = `http://localhost:${PORT}/`;
const OUT = 'scripts/out';
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// own process group, so stopping it also stops the vite child process
const server = spawn(
  'node_modules/.bin/vite',
  ['preview', '--port', String(PORT), '--strictPort'],
  {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  },
);
const stopServer = () => {
  try {
    process.kill(-server.pid, 'SIGTERM');
  } catch {
    /* already gone */
  }
};
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('preview server did not start')), 20000);
  const onData = (d) => {
    const text = String(d);
    if (text.includes('already in use')) reject(new Error(`port ${PORT} is busy`));
    else if (text.includes(String(PORT))) {
      clearTimeout(t);
      resolve();
    }
  };
  server.stdout.on('data', onData);
  server.stderr.on('data', onData);
});

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--autoplay-policy=no-user-gesture-required',
    '--no-sandbox',
  ],
});

const state = (page) => page.evaluate(() => window.__hotRelay?.state ?? null);
/** Poll game state until pred(state) is true or the timeout passes; returns the last state. */
const waitState = async (page, pred, timeoutMs = 20000) => {
  const t0 = Date.now();
  let s = await state(page);
  while (Date.now() - t0 < timeoutMs) {
    s = await state(page);
    if (s && pred(s)) return s;
    await sleep(100);
  }
  return s;
};
const stagePage = async (ctx, query) => {
  const page = await ctx.newPage();
  const errs = errorsOf(page);
  await page.goto(`${BASE}${query}`);
  await page.waitForFunction(() => window.__hotRelay?.state?.scene === 'stage', null, {
    timeout: 20000,
  });
  return { page, errs };
};
const errorsOf = (page) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  return errs;
};

try {
  // 1. Menu → squad select → insertion (first viewing cannot be skipped; the next one can)
  {
    const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
    const page = await ctx.newPage();
    const errs = errorsOf(page);
    await page.goto(BASE);
    await page.waitForFunction(() => !!window.__hotRelay, null, { timeout: 15000 });
    await sleep(1500);
    await page.screenshot({ path: `${OUT}/01-menu.png` });
    check('menu loads without errors', errs.length === 0, errs.join(' | '));

    await waitState(page, (x) => x.scene === 'menu', 10000);
    await page.keyboard.press('Enter'); // attract → main
    await waitState(page, (x) => x.view === 'main', 5000);
    await sleep(300);
    await page.keyboard.press('Enter'); // Deploy → squad select
    await waitState(page, (x) => x.scene === 'squad', 10000);
    await sleep(300);
    // swap Mei-Lin (3rd) for Tari (4th): right ×2, toggle, right, toggle
    const press = async (k, pred) => {
      await page.keyboard.press(k);
      await waitState(page, pred, 3000);
    };
    await press('ArrowRight', (x) => x.cursor === 1);
    await press('ArrowRight', (x) => x.cursor === 2);
    await press('KeyZ', (x) => !x.picked.includes('meilin'));
    await press('ArrowRight', (x) => x.cursor === 3);
    await press('KeyZ', (x) => x.picked.includes('tari'));
    await page.screenshot({ path: `${OUT}/02-squad-select.png` });
    await page.keyboard.press('KeyZ'); // cursor is on DEPLOY once three are picked
    await page.waitForFunction(() => window.__hotRelay?.state?.scene === 'stage', null, {
      timeout: 15000,
    });
    let s = await state(page);
    check(
      'squad select deploys the picked squad',
      s.squad.join(',') === 'kemi,rurik,tari',
      s.squad.join(','),
    );
    check(
      'insertion plays on the first deploy',
      s.insertion === 'approach' && s.control === false,
      `phase ${s.insertion}`,
    );
    await sleep(1200);
    await page.keyboard.press('KeyZ');
    await sleep(300);
    s = await state(page);
    check('first insertion ignores skip', !s.control, `phase ${s.insertion}`);
    await page.screenshot({ path: `${OUT}/03-insertion-title.png` });
    s = await waitState(page, (x) => x.insertion === 'descend', 30000);
    await page.screenshot({ path: `${OUT}/04-insertion-rope.png` });
    check('lead operator rides the rope', s.anim === 'rope', `anim ${s.anim} phase ${s.insertion}`);
    s = await waitState(page, (x) => x.control, 30000);
    await sleep(500);
    s = await state(page);
    await page.screenshot({ path: `${OUT}/05-insertion-handoff.png` });
    check(
      'insertion lands on the ground and hands over control',
      s.control && s.grounded && s.feetY === 240 && s.active === 'kemi',
      `feetY ${s.feetY} grounded ${s.grounded} anim ${s.anim}`,
    );
    // second viewing (save remembers the first): skip works
    await page.reload();
    await page.waitForFunction(() => !!window.__hotRelay, null, { timeout: 15000 });
    await waitState(page, (x) => x.scene === 'menu', 10000);
    await page.keyboard.press('Enter');
    await waitState(page, (x) => x.view === 'main', 5000);
    await sleep(300);
    await page.keyboard.press('Enter');
    await waitState(page, (x) => x.scene === 'squad', 10000);
    await sleep(300);
    await press('ArrowDown', (x) => x.cursor === 4); // saved squad is preselected
    await page.keyboard.press('KeyZ');
    await page.waitForFunction(() => window.__hotRelay?.state?.scene === 'stage', null, {
      timeout: 15000,
    });
    await sleep(600);
    await page.keyboard.press('KeyZ');
    s = await waitState(page, (x) => x.control, 4000);
    check(
      'second insertion can be skipped',
      s.control === true && s.feetY === 240,
      `phase ${s.insertion}`,
    );
    check(
      'menu, squad select and insertion ran without errors',
      errs.length === 0,
      errs.slice(0, 3).join(' | '),
    );
    await ctx.close();
  }

  // 2. Bot plays the stage to the goal (relay mode)
  {
    const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
    const page = await ctx.newPage();
    const errs = errorsOf(page);
    await page.goto(`${BASE}?autostart=1&debug=1&squad=kemi,rurik,meilin`);
    await page.waitForFunction(() => window.__hotRelay?.state?.scene === 'stage', null, {
      timeout: 15000,
    });
    const start = await state(page);

    // Jump at each ledge edge (coyote time makes a jump from the very edge fair) and in front
    // of the two raised blocks. Windows are re-armed after a respawn behind them.
    const D = 352; // section D starts after the basin
    const jumpWindows = [
      [708, 722], // channel 1 edge at 720
      [862, 874], // crate at 880
      [1508, 1522], // channel 2 edge at 1520
      [1784, 1796], // raised block at 1800
      [3232 + D, 3244 + D], // arena cover crate
    ];
    const jumped = new Set();
    await page.keyboard.down('ArrowRight');
    await page.keyboard.down('KeyX');
    let s = start;
    let swapped = false;
    let paused = false;
    let shot = 0;
    const t0 = Date.now();
    let lastX = 0;
    let stuckSince = Date.now();
    let swam = false;
    while (Date.now() - t0 < 420_000) {
      s = await state(page);
      if (!s) break;
      if (s.status === 'clear') break;
      if (s.inWater) swam = true;
      if (s.status === 'squadDown') {
        await page.keyboard.press('KeyZ');
        await sleep(300);
        continue;
      }
      // aim: sweep up-diagonal half the time so ledge enemies get hit
      const phase = Math.floor((Date.now() - t0) / 350) % 2;
      if (phase === 1) await page.keyboard.down('ArrowUp');
      else await page.keyboard.up('ArrowUp');

      for (const [from, to] of jumpWindows) {
        if (s.x < from - 40) jumped.delete(from); // respawned behind it: arm again
        if (!jumped.has(from) && s.x >= from && s.x <= to) {
          jumped.add(from);
          await page.keyboard.up('ArrowUp');
          await page.keyboard.down('KeyZ');
          await sleep(300);
          await page.keyboard.up('KeyZ');
        }
      }
      // pinned against the arena cover crate (3250–3282 + D) on the ground: hop over it with
      // right held. A single missed jump in the window above used to strand the bot here.
      if (s.grounded && s.feetY >= 236 && s.x >= 3232 + D && s.x < 3250 + D) {
        await page.keyboard.up('ArrowUp');
        await page.keyboard.down('ArrowRight');
        await page.keyboard.down('KeyZ');
        await sleep(300);
        await page.keyboard.up('KeyZ');
        continue;
      }
      // inside the arena, past the crate: stop and fight until it is clear
      if (s.x > 3282 + D && s.x < 3600 + D && s.arenaLive > 0) {
        await page.keyboard.up('ArrowRight');
        await page.keyboard.down('ArrowUp');
        await sleep(300);
        await page.keyboard.up('ArrowUp');
        await page.keyboard.down(Math.random() < 0.5 ? 'ArrowRight' : 'ArrowLeft');
        await sleep(150);
        await page.keyboard.up('ArrowLeft');
        await page.keyboard.up('ArrowRight');
      } else {
        await page.keyboard.down('ArrowRight');
      }
      // stuck against something: hop
      if (Math.abs(s.x - lastX) > 4) {
        lastX = s.x;
        stuckSince = Date.now();
      } else if (Date.now() - stuckSince > 1200) {
        await page.keyboard.down('KeyZ');
        await sleep(280);
        await page.keyboard.up('KeyZ');
        stuckSince = Date.now();
      }
      if (!swapped && s.x > 420) {
        await page.keyboard.press('KeyC');
        await sleep(120);
        const after = await state(page);
        swapped = true;
        check(
          'relay swap changes the active operator',
          after.active !== start.active,
          `${start.active} → ${after.active}`,
        );
      }
      // the bot jumps best as Kemi: tag her back in whenever the swap allows
      if (swapped && s.active !== 'kemi' && Date.now() % 1600 < 60)
        await page.keyboard.press('KeyC');
      if (!paused && s.x > 900) {
        paused = true;
        await page.keyboard.up('ArrowRight');
        await page.keyboard.up('KeyX');
        await page.keyboard.press('Escape');
        await sleep(400);
        const a = await state(page);
        await sleep(500);
        const b = await state(page);
        await page.screenshot({ path: `${OUT}/09-pause.png` });
        check('pause freezes the stage', a.timeMs === b.timeMs, `time ${a.timeMs} → ${b.timeMs}`);
        await page.keyboard.press('Escape');
        await sleep(200);
        await page.keyboard.down('KeyX');
      }
      if (shot === 0 && s.x > 380) {
        shot++;
        await page.screenshot({ path: `${OUT}/06-first-fight.png` });
      }
      if (shot === 1 && s.inWater && s.x > 2440) {
        shot++;
        await page.screenshot({ path: `${OUT}/07-bot-swims.png` });
      }
      if (shot === 2 && s.x > 3300 + D) {
        shot++;
        await page.screenshot({ path: `${OUT}/08-arena.png` });
      }
      await sleep(25);
    }
    await page.keyboard.up('ArrowRight');
    await page.keyboard.up('KeyX');
    s = await state(page);
    check('bot swims the basin and climbs out', swam && s.x > 2900, `swam ${swam}`);
    check(
      'bot reaches the goal',
      s?.status === 'clear',
      `x=${s?.x} status=${s?.status} downs=${s?.downs} swaps=${s?.swaps}`,
    );
    await sleep(1800);
    await page.screenshot({ path: `${OUT}/10-results.png` });
    const tel = await page.evaluate(() => window.__hotRelay.telemetry.records.map((r) => r.event));
    check(
      'telemetry logs the run',
      tel.includes('stage_start') && tel.includes('first_fight'),
      [...new Set(tel)].join(','),
    );
    const fps = s?.fps;
    check('stage ran without errors', errs.length === 0, errs.slice(0, 3).join(' | '));
    writeFileSync(`${OUT}/run.json`, JSON.stringify({ state: s, telemetry: tel, fps }, null, 2));
    await ctx.close();
  }

  // 3. Swimming, climbing, weapons underwater, drowning (debug teleports)
  {
    const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
    const { page, errs } = await stagePage(ctx, '?autostart=1&debug=1&squad=kemi,rurik,tari');
    const dbg = (fn, ...args) =>
      page.evaluate(([f, a]) => window.__hotRelay.debug[f](...a), [fn, args]);
    await dbg('clearEnemies');

    // keyboard weapon switch and manual reload
    await page.keyboard.press('KeyQ');
    let s = await waitState(page, (x) => x.weapon === 'p9', 3000);
    check('Q switches weapon', s.weapon === 'p9', s.weapon);
    await page.keyboard.press('KeyQ');
    await waitState(page, (x) => x.weapon === 'kestrel', 3000);
    await page.keyboard.down('KeyX');
    await waitState(page, (x) => x.mag <= 27, 5000);
    await page.keyboard.up('KeyX');
    await page.keyboard.press('KeyR');
    s = await waitState(page, (x) => x.reloading, 3000);
    check('R reloads a part-used magazine', s.reloading && s.weapon === 'kestrel', `mag ${s.mag}`);

    // Kemi drops into channel 1, floats, and climbs out by pushing into the far quay
    await dbg('teleport', 744, 236);
    s = await waitState(page, (x) => x.inWater && x.anim === 'swimSurface', 6000);
    check(
      'falling into water starts swimming at the surface',
      s.inWater && !s.submerged,
      `anim ${s.anim} feetY ${s.feetY}`,
    );
    await page.screenshot({ path: `${OUT}/11-swim-surface.png` });
    await page.keyboard.down('ArrowRight');
    s = await waitState(page, (x) => !x.inWater && x.grounded, 8000);
    await page.keyboard.up('ArrowRight');
    check(
      'swimmer climbs out onto the quay (never stuck at the surface)',
      !s.inWater && s.grounded && s.feetY === 240,
      `x ${s.x} feetY ${s.feetY}`,
    );

    // diving: Kemi goes under with Down and her SMG still fires (reduced) underwater
    await dbg('teleport', 2600, 290);
    await page.keyboard.down('ArrowDown');
    s = await waitState(page, (x) => x.submerged, 6000);
    await page.keyboard.down('KeyX');
    await sleep(600);
    await page.keyboard.up('KeyX');
    await page.keyboard.up('ArrowDown');
    s = await state(page);
    check(
      'diving submerges and the SMG fires underwater',
      s.submerged && s.anim === 'swimUnder' && s.mag < 30,
      `mag ${s.mag} anim ${s.anim}`,
    );
    await page.screenshot({ path: `${OUT}/12-underwater.png` });
    // floaters rise back to the surface on their own
    s = await waitState(page, (x) => x.inWater && !x.submerged, 15000);
    check('a floater drifts back to the surface', s.inWater && !s.submerged, `feetY ${s.feetY}`);

    // Rurik sinks to the bed, his LMG swaps to the sidearm, and he drowns without air
    await page.keyboard.press('KeyC'); // tag Rurik in
    s = await waitState(page, (x) => x.active === 'rurik', 3000);
    await dbg('setInvulnerable', 1e9); // only drowning can hurt him here
    s = await waitState(page, (x) => x.submerged && x.weapon === 'p9', 10000);
    check(
      'heavy operator sinks and switches to his sidearm underwater',
      s.submerged && s.weapon === 'p9',
      `weapon ${s.weapon}`,
    );
    s = await waitState(page, (x) => x.grounded && x.feetY >= 350, 15000);
    check(
      'heavy operator stands on the sea bed',
      s.grounded && s.feetY >= 350,
      `feetY ${s.feetY} anim ${s.anim}`,
    );
    await page.screenshot({ path: `${OUT}/13-seabed.png` });
    const hp0 = s.hp;
    s = await waitState(page, (x) => x.oxygen === 0 && x.hp < hp0, 60000);
    check(
      'running out of air causes drowning damage',
      s.oxygen === 0 && s.hp < hp0,
      `air ${s.oxygen} hp ${hp0}→${s.hp}`,
    );
    s = await waitState(page, (x) => x.downs >= 1, 60000);
    check(
      'drowning downs the operator and the next one tags in underwater',
      s.downs >= 1 && s.active !== 'rurik' && s.status === 'playing',
      `active ${s.active} downs ${s.downs}`,
    );
    await page.screenshot({ path: `${OUT}/14-drowned-tag-in.png` });
    check('swimming checks ran without errors', errs.length === 0, errs.slice(0, 3).join(' | '));
    await ctx.close();
  }

  // 4. Solo mode (H2 baseline)
  {
    const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}?autostart=1&mode=solo`);
    await page.waitForFunction(() => window.__hotRelay?.state?.scene === 'stage', null, {
      timeout: 15000,
    });
    await page.keyboard.press('KeyC');
    await sleep(200);
    const s = await state(page);
    check('solo mode ignores swap', s.active === 'kemi' && s.swaps === 0 && s.squad.length === 1);
    await page.screenshot({ path: `${OUT}/15-solo.png` });
    await ctx.close();
  }

  // 5. Touch controls on a phone-sized landscape screen
  {
    const ctx = await browser.newContext({
      viewport: { width: 844, height: 390 },
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}?autostart=1`);
    await page.waitForFunction(() => window.__hotRelay?.state?.scene === 'stage', null, {
      timeout: 15000,
    });
    await sleep(600);
    // FIRE button sits at canvas (750, 460) of 960×540; scale to the viewport
    const box = await page.locator('canvas').boundingBox();
    const sx = box.width / 960;
    const sy = box.height / 540;
    for (let i = 0; i < 6; i++) {
      await page.touchscreen.tap(box.x + 750 * sx, box.y + 460 * sy);
      await sleep(60);
    }
    let s = await state(page);
    await page.screenshot({ path: `${OUT}/16-touch.png` });
    check(
      'touch fire button shoots',
      s.bullets > 0 || s.mag < 30,
      `bullets=${s.bullets} mag=${s.mag}`,
    );
    // WPN button at canvas (720, 345)
    await page.touchscreen.tap(box.x + 720 * sx, box.y + 345 * sy);
    s = await waitState(page, (x) => x.weapon === 'p9', 3000);
    check('touch WPN button switches weapon', s.weapon === 'p9', s.weapon);
    await ctx.close();
  }

  // 6. Phone-size insertion: title card fits, a tap skips it (debug makes it skippable)
  {
    const ctx = await browser.newContext({
      viewport: { width: 844, height: 390 },
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 2,
    });
    const { page, errs } = await stagePage(
      ctx,
      '?autostart=1&debug=1&insertion=play&squad=tari,kemi,rurik',
    );
    await sleep(1500);
    await page.screenshot({ path: `${OUT}/17-phone-insertion.png` });
    const box = await page.locator('canvas').boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    const s = await waitState(page, (x) => x.control, 5000);
    check(
      'tap skips the insertion on a phone, for any lead operator',
      s.control && s.active === 'tari' && s.feetY === 240,
      `phase ${s.insertion} lead ${s.active}`,
    );
    check('phone insertion ran without errors', errs.length === 0, errs.slice(0, 3).join(' | '));
    await ctx.close();
  }

  // 6b. Low detail (PERF-01): ?detail=low hides mid/near parallax, light shafts, tufts, shadows
  {
    const keys = ['bg-mid', 'bg-near', 'fx-tuft', 'fx-shadow', 'glow', 'stage-sky'];
    const visible = async (query) => {
      const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
      const page = await ctx.newPage();
      const errs = errorsOf(page);
      await page.goto(`${BASE}?autostart=1&debug=1${query}`);
      await page.waitForFunction(() => window.__hotRelay?.state?.detail, null, { timeout: 15000 });
      await sleep(400);
      const v = await page.evaluate((k) => window.__hotRelay.debug.visibleByTexture(k), keys);
      // informational fps sample inside the arena (the heaviest part of the stage): 4 enemies
      // drop in, the player stands invulnerable for ~4 s
      await page.evaluate(() => {
        window.__hotRelay.debug.setInvulnerable(20000);
        window.__hotRelay.debug.teleport(3700 + 352, 240);
      });
      await sleep(1500);
      const fps = await page.evaluate(
        () =>
          new Promise((res) => {
            const d = [];
            let last = performance.now();
            const t0 = last;
            const f = (t) => {
              d.push(t - last);
              last = t;
              if (t - t0 < 4000) requestAnimationFrame(f);
              else {
                const x = d
                  .slice(1)
                  .map((ms) => 1000 / ms)
                  .sort((p, q) => p - q);
                const at = (p) => Math.round(x[Math.floor(p * (x.length - 1))] * 10) / 10;
                res({ p50: at(0.5), p10: at(0.1) });
              }
            };
            requestAnimationFrame(f);
          }),
      );
      const s = await state(page);
      if (query === '&detail=low') await page.screenshot({ path: `${OUT}/17b-detail-low.png` });
      if (query === '&detail=high&rigs=off')
        await page.screenshot({ path: `${OUT}/17d-rigs-off.png` });
      await ctx.close();
      return { detail: s.detail, v, errs, fps };
    };
    const hi = await visible('&detail=high');
    const lo = await visible('&detail=low');
    const fmt = (v) => keys.map((k) => `${k}:${v[k]}`).join(' ');
    check(
      '?detail=low hides parallax, shafts, tufts and shadows',
      lo.detail === 'low' &&
        lo.v['bg-mid'] === 0 &&
        lo.v['bg-near'] === 0 &&
        lo.v['fx-tuft'] === 0 &&
        lo.v['fx-shadow'] === 0 &&
        lo.v['glow'] < hi.v['glow'] &&
        lo.v['stage-sky'] > 0 &&
        hi.v['bg-mid'] > 0 &&
        hi.v['fx-tuft'] > 0 &&
        lo.errs.length === 0,
      `high ${fmt(hi.v)} | low ${fmt(lo.v)}`,
    );
    // informational: fps in the arena at each level
    console.log(
      `INFO  arena fps — high p50 ${hi.fps.p50} p10 ${hi.fps.p10} | low p50 ${lo.fps.p50} p10 ${lo.fps.p10}`,
    );
    // rig cost: same arena sample with every character rig hidden (?rigs=off, debug only)
    const hiOff = await visible('&detail=high&rigs=off');
    const loOff = await visible('&detail=low&rigs=off');
    console.log(
      `INFO  arena fps, rigs off — high p50 ${hiOff.fps.p50} p10 ${hiOff.fps.p10} | low p50 ${loOff.fps.p50} p10 ${loOff.fps.p10}`,
    );
  }

  // 6c. Auto detail (PERF-01): a slow 5 s window lowers detail once, with a notice
  {
    const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
    const page = await ctx.newPage();
    const errs = errorsOf(page);
    await page.goto(`${BASE}?autostart=1&debug=1`);
    await page.waitForFunction(() => window.__hotRelay?.state?.detail, null, { timeout: 15000 });
    await sleep(300);
    const before = await state(page);
    await page.evaluate(() => window.__hotRelay.debug.feedAutoDetail(20, 6000));
    await sleep(300);
    const after = await state(page);
    await page.screenshot({ path: `${OUT}/17c-detail-lowered.png` });
    await page.evaluate(() => window.__hotRelay.debug.feedAutoDetail(60, 20000));
    await sleep(300);
    const later = await state(page);
    check(
      'Auto lowers detail once on a slow window and stays low',
      before.detail === 'high' &&
        after.detail === 'low' &&
        after.detailNotices === 1 &&
        later.detail === 'low' &&
        later.detailNotices === 1 &&
        errs.length === 0,
      `before ${before.detail} → after ${after.detail} (notices ${after.detailNotices}) → later ${later.detail}`,
    );
    await ctx.close();
  }

  // 7. Stress test (H10) — headless software rendering, so treat the number as a floor only
  {
    const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
    const page = await ctx.newPage();
    const errs = errorsOf(page);
    await page.goto(`${BASE}?stage=stress`);
    await page.waitForFunction(() => !!window.__hotRelay?.stress, null, { timeout: 40000 });
    const r = await page.evaluate(() => window.__hotRelay.stress);
    await page.screenshot({ path: `${OUT}/18-stress.png` });
    check(
      'stress test completes',
      r.frames > 50 && errs.length === 0,
      `p50 ${r.p50} fps, p10 ${r.p10} fps, ${r.frames} frames (software GL)`,
    );
    await ctx.close();
  }

  // 8. Offline launch after first visit (PWA-03)
  {
    const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
    const page = await ctx.newPage();
    await page.goto(BASE);
    await page.waitForFunction(() => document.documentElement.dataset.offlineReady === '1', null, {
      timeout: 20000,
    });
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, {
      timeout: 10000,
    });
    await ctx.setOffline(true);
    await page.reload();
    await page.waitForFunction(() => !!window.__hotRelay, null, { timeout: 15000 });
    await sleep(600);
    const online = await page.evaluate(() => navigator.onLine);
    await page.screenshot({ path: `${OUT}/19-offline.png` });
    check(
      'launches with the network off',
      online === false,
      'menu rendered from the service worker cache',
    );
    await ctx.setOffline(false);
    await ctx.close();
  }
} catch (err) {
  check('smoke run', false, String(err));
} finally {
  await browser.close();
  stopServer();
}

const failed = results.filter((r) => !r.ok);
writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
