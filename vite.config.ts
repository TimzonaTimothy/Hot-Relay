import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// BASE lets the GitHub Pages workflow serve from /<repo>/; local builds use relative paths.
export default defineConfig({
  base: process.env.BASE ?? './',
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
  server: { host: true },
  preview: { host: true },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      devOptions: { enabled: false },
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'Hot Relay',
        short_name: 'Hot Relay',
        description: 'Three operators, one relay. A run-and-gun that plays offline.',
        theme_color: '#14231c',
        background_color: '#0d1712',
        display: 'fullscreen',
        orientation: 'landscape',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2,json}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
    }),
  ],
});
