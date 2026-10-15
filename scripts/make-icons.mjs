// Regenerates the placeholder PWA icons (public/icons/icon-192.png, icon-512.png) by drawing
// them on a canvas in headless Chrome. Set CHROME_PATH if Chrome is not in a standard place.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const executablePath =
  process.env.CHROME_PATH ??
  ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath });
const page = await browser.newPage();
mkdirSync('public/icons', { recursive: true });
for (const size of [192, 512]) {
  const data = await page.evaluate((s) => {
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const g = c.getContext('2d');
    const k = s / 512;
    const bg = g.createLinearGradient(0, 0, 0, s);
    bg.addColorStop(0, '#4fb3cc');
    bg.addColorStop(0.6, '#a6dfdb');
    bg.addColorStop(1, '#3f7a3a');
    g.fillStyle = bg;
    g.fillRect(0, 0, s, s);
    // three relay chevrons in the operators' colours
    ['#f39a1e', '#4f86c6', '#9be03c'].forEach((col, i) => {
      g.save();
      g.translate((120 + i * 105) * k, 256 * k);
      g.beginPath();
      g.moveTo(-40 * k, -120 * k);
      g.lineTo(40 * k, 0);
      g.lineTo(-40 * k, 120 * k);
      g.lineTo(10 * k, 120 * k);
      g.lineTo(90 * k, 0);
      g.lineTo(10 * k, -120 * k);
      g.closePath();
      g.fillStyle = col;
      g.fill();
      g.lineWidth = 12 * k;
      g.strokeStyle = '#1d1a17';
      g.stroke();
      g.restore();
    });
    return c.toDataURL('image/png').split(',')[1];
  }, size);
  writeFileSync(`public/icons/icon-${size}.png`, Buffer.from(data, 'base64'));
  console.log(`public/icons/icon-${size}.png`);
}
await browser.close();
