/**
 * Service worker registration (PWA-02). The worker precaches the whole build so the game
 * starts with no connection after the first visit. Update prompt comes in Gate 5 (PWA-04);
 * for now new versions activate on the next launch.
 */
export async function registerServiceWorker(): Promise<void> {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  try {
    const { registerSW } = await import('virtual:pwa-register');
    registerSW({
      immediate: true,
      onOfflineReady() {
        console.info('[pwa] ready to play offline');
        document.documentElement.dataset.offlineReady = '1';
      },
      onRegisterError(err: unknown) {
        console.warn('[pwa] service worker failed to register', err);
      },
    });
  } catch (err) {
    console.warn('[pwa] registration skipped', err);
  }
}
