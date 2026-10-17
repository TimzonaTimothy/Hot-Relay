import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// BASE_PATH picks the public base. Default './' keeps every URL relative, so one build works on
// GitHub Pages sub-paths, itch.io iframes and portals. Hosts can pin it: the Pages workflow uses
// BASE_PATH=/Hot-Relay/, Vercel uses BASE_PATH=/. The manifest scope and start URL follow it;
// vite-plugin-pwa registers the service worker under the same base.
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env;
const base = env?.BASE_PATH || './';

export default defineConfig({
  base,
  define: { __BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')) },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: (id) => (id.includes('node_modules/phaser') ? 'phaser' : undefined),
      },
    },
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icons/*.png', 'favicon.svg'],
      manifest: {
        name: 'Hot Relay',
        short_name: 'Hot Relay',
        description: 'Tag-team run-and-gun. Plays offline.',
        start_url: base,
        scope: base,
        display: 'fullscreen',
        orientation: 'landscape',
        background_color: '#0e1116',
        theme_color: '#0e1116',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,json,webmanifest}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
} as Parameters<typeof defineConfig>[0]);
