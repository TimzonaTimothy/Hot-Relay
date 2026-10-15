import { registerSW } from 'virtual:pwa-register';

/** Register the Workbox service worker in production builds. */
export function registerServiceWorker(): void {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  registerSW({ immediate: true });
}
