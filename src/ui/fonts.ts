/**
 * Self-hosted OFL fonts, bundled by Vite and precached by the service worker,
 * so menus and HUD look the same offline. Canvas text only uses a font once it has
 * loaded, so Boot waits for these (with a timeout fallback to system fonts).
 */
import '@fontsource/black-ops-one/latin-400.css';
import '@fontsource/teko/latin-500.css';
import '@fontsource/teko/latin-600.css';
import '@fontsource/chakra-petch/latin-500.css';
import '@fontsource/chakra-petch/latin-600.css';
import '@fontsource/chakra-petch/latin-700.css';

const FACES = [
  '400 32px "Black Ops One"',
  '500 32px Teko',
  '600 32px Teko',
  '500 20px "Chakra Petch"',
  '600 20px "Chakra Petch"',
  '700 20px "Chakra Petch"',
];

export async function loadFonts(timeoutMs = 3000): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const all = Promise.all(FACES.map((f) => document.fonts.load(f, 'AZ09')));
  await Promise.race([all, new Promise((r) => setTimeout(r, timeoutMs))]).catch(() => undefined);
}
