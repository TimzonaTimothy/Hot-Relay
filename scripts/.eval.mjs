import { chromium } from 'playwright-core';
const [url, expr, wait] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
p.on('pageerror', (e) => console.log('pageerror:', e.message));
await p.goto(url);
await p.waitForTimeout(+wait || 3000);
console.log(JSON.stringify(await p.evaluate(expr), null, 1));
await b.close();
