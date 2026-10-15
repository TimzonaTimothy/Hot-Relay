// Headless smoke test against the production build in dist/.
// Usage: npm run build && npm run e2e   (CHROME_PATH=/path/to/chrome if Playwright's Chromium is not installed)
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const PORT = 4173;
const BASE = process.env.BASE_URL ?? `http://localhost:${PORT}/`;
const results = [];
let failed = 0;

function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  return candidates.find((p) => existsSync(p));
}

async function startServer() {
  if (process.env.BASE_URL) return null;
  const srv = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(BASE);
      if (r.ok) return srv;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  srv.kill();
  throw new Error('preview server did not start (did you run npm run build?)');
}

async function check(name, fn) {
  const t0 = Date.now();
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail, ms: Date.now() - t0 });
    console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (e) {
    failed++;
    results.push({ name, ok: false, detail: String(e?.message ?? e) });
    console.log(`  ✗ ${name} — ${e?.message ?? e}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function openPage(browser, query = '', opts = {}) {
  const context = await browser.newContext({ viewport: { width: 960, height: 540 }, ...opts });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/GL Driver|favicon/.test(m.text())) errors.push(m.text());
  });
  await page.goto(BASE + query);
  return { context, page, errors };
}

const sceneActive = (page, key) => page.evaluate((k) => window.__hotRelay?.game?.scene.isActive(k) ?? false, key);
const probe = (page) => page.evaluate(() => window.__hotRelay.probe());

async function waitFor(page, fn, arg, timeout = 15000) {
  await page.waitForFunction(fn, arg, { timeout, polling: 100 });
}

async function waitStage(page) {
  await waitFor(page, () => window.__hotRelay?.game?.scene.isActive('Stage') && window.__hotRelay.probe);
  await page.waitForTimeout(300);
}

/** Simple bot: run right firing, jump gaps and steps, swap now and then, sweep in arenas. */
async function botClear(page, limitMs) {
  const kb = page.keyboard;
  await kb.down('ArrowRight');
  await kb.down('KeyX');
  let dir = 1;
  let lastSwap = Date.now();
  let lastTurn = Date.now();
  let jumping = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < limitMs) {
    const s = await probe(page);
    if (s.finished) break;
    if (s.arena && Date.now() - lastTurn > 1600) {
      await kb.up(dir > 0 ? 'ArrowRight' : 'ArrowLeft');
      dir = -dir;
      await kb.down(dir > 0 ? 'ArrowRight' : 'ArrowLeft');
      lastTurn = Date.now();
    } else if (!s.arena && dir < 0) {
      await kb.up('ArrowLeft');
      dir = 1;
      await kb.down('ArrowRight');
    }
    if (s.grounded && (s.gapAhead || s.wallAhead) && Date.now() - jumping > 450) {
      jumping = Date.now();
      await kb.down('Space');
      setTimeout(() => void kb.up('Space').catch(() => {}), 320);
    }
    if (Date.now() - lastSwap > 7000) {
      lastSwap = Date.now();
      await kb.press('KeyC');
    }
    await page.waitForTimeout(60);
  }
  await kb.up('ArrowRight').catch(() => {});
  await kb.up('ArrowLeft').catch(() => {});
  await kb.up('KeyX').catch(() => {});
  return probe(page);
}

const server = await startServer();
const executablePath = chromePath();
const browser = await chromium.launch({
  executablePath,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
console.log(`Smoke test against ${BASE} (${executablePath ?? 'playwright chromium'})`);

await check('boots to the menu with no errors', async () => {
  const { context, page, errors } = await openPage(browser);
  await waitFor(page, () => window.__hotRelay?.game?.scene.isActive('Menu'));
  await page.waitForTimeout(500);
  await context.close();
  assert(errors.length === 0, errors.join(' | '));
});

await check('bot clears Verdant Steps (god mode)', async () => {
  const { context, page, errors } = await openPage(browser, '?autostart=1&debug=1&god=1');
  await waitStage(page);
  const s = await botClear(page, 240000);
  assert(s.finished, `not finished: x=${Math.round(s.x)} t=${s.runTime.toFixed(1)}`);
  await waitFor(page, () => window.__hotRelay.game.scene.isActive('Results'), undefined, 5000);
  const ev = await page.evaluate(() => window.__hotRelay.telemetry.events.map((e) => e.name));
  await context.close();
  assert(errors.length === 0, errors.join(' | '));
  assert(ev.includes('clear') && ev.includes('first_fight') && ev.includes('checkpoint'), `telemetry: ${ev.join(',')}`);
  return `${s.runTime.toFixed(1)} s game time, ${s.kills} kills, ${s.swaps} swaps`;
});

await check('relay swap, auto tag-in on down, fail when all three are down', async () => {
  const { context, page, errors } = await openPage(browser, '?autostart=1');
  await waitStage(page);
  let s = await probe(page);
  assert(s.active === 'kemi', `starts with ${s.active}`);
  await page.keyboard.press('KeyC');
  await page.waitForTimeout(300);
  s = await probe(page);
  assert(s.active === 'rurik' && s.swaps === 1, `after swap: ${s.active}, swaps ${s.swaps}`);
  await page.evaluate(() => window.__hotRelay.stage.downPlayer(false));
  await page.waitForTimeout(1300);
  s = await probe(page);
  assert(s.downs === 1 && s.alive && s.active === 'meilin', `after down: ${JSON.stringify({ d: s.downs, a: s.active, alive: s.alive })}`);
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => window.__hotRelay.stage.downPlayer(false));
    await page.waitForTimeout(1300);
  }
  s = await probe(page);
  assert(s.failed, 'run should fail when all three are down');
  await page.keyboard.press('Enter'); // Continue
  await page.waitForTimeout(400);
  s = await probe(page);
  assert(!s.failed && s.alive, 'continue should revive the squad');
  await context.close();
  assert(errors.length === 0, errors.join(' | '));
});

await check('solo mode: one operator, three lives', async () => {
  const { context, page } = await openPage(browser, '?autostart=1&mode=solo');
  await waitStage(page);
  const n = await page.evaluate(() => [window.__hotRelay.stage.squad.members.length, window.__hotRelay.stage.squad.livesLeft]);
  await context.close();
  assert(n[0] === 1 && n[1] === 3, `members ${n[0]}, lives ${n[1]}`);
});

await check('pause and resume', async () => {
  const { context, page } = await openPage(browser, '?autostart=1');
  await waitStage(page);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const paused = await sceneActive(page, 'Pause');
  const t1 = (await probe(page)).runTime;
  await page.waitForTimeout(500);
  const t2 = (await probe(page)).runTime;
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const resumed = (await sceneActive(page, 'Stage')) && !(await sceneActive(page, 'Pause'));
  await context.close();
  assert(paused && t1 === t2 && resumed, `paused=${paused} frozen=${t1 === t2} resumed=${resumed}`);
});

await check('touch controls fire and move', async () => {
  const { context, page, errors } = await openPage(browser, '?autostart=1&touch=1', { hasTouch: true, isMobile: true });
  await waitStage(page);
  const box = await page.locator('canvas').boundingBox();
  const sx = box.width / 960;
  const sy = box.height / 540;
  const cdp = await context.newCDPSession(page);
  const pt = (x, y, id) => ({ x: box.x + x * sx, y: box.y + y * sy, id });
  const x0 = (await probe(page)).x;
  // hold the stick to the right and the fire button together
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt(150, 420, 1)] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [pt(210, 420, 1)] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt(210, 420, 1), pt(860, 430, 2)] });
  await page.waitForTimeout(700);
  const fired = await page.evaluate(() => window.__hotRelay.stage.pBullets.activeCount);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const x1 = (await probe(page)).x;
  await context.close();
  assert(errors.length === 0, errors.join(' | '));
  assert(fired > 0 && x1 > x0 + 40, `bullets ${fired}, moved ${Math.round(x1 - x0)} px`);
  return `${fired} bullets in flight, moved ${Math.round(x1 - x0)} px`;
});

await check('stress scene: 60 enemies, ~200 bullets, fps measured', async () => {
  const { context, page, errors } = await openPage(browser, '?stage=stress');
  await waitFor(page, () => !!window.__hotRelay?.stress, undefined, 40000);
  const r = await page.evaluate(() => window.__hotRelay.stress);
  await context.close();
  assert(errors.length === 0, errors.join(' | '));
  assert(r.enemies >= 55, `only ${r.enemies} enemies`);
  return `median ${r.p50} fps, p10 ${r.p10}, peak ${r.peakBullets} bullets (headless software GL; real devices: TEST-01)`;
});

await check('settings persist across reload (IndexedDB)', async () => {
  const { context, page } = await openPage(browser);
  await waitFor(page, () => window.__hotRelay?.game?.scene.isActive('Menu'));
  await page.evaluate(async () => {
    const s = window.__hotRelay.services.save;
    s.data.settings.shake = false;
    await s.save();
  });
  await page.reload();
  await waitFor(page, () => window.__hotRelay?.game?.scene.isActive('Menu'));
  const shake = await page.evaluate(() => window.__hotRelay.services.save.data.settings.shake);
  await context.close();
  assert(shake === false, 'setting was not persisted');
});

await check('starts offline after the first visit (service worker)', async () => {
  const { context, page } = await openPage(browser);
  await waitFor(page, () => window.__hotRelay?.game?.scene.isActive('Menu'));
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(800);
  await context.setOffline(true);
  await page.reload();
  await waitFor(page, () => window.__hotRelay?.game?.scene.isActive('Menu'), undefined, 15000);
  await context.close();
});

await browser.close();
server?.kill();
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
