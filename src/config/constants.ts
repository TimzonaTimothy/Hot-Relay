/** Logical pixel-art resolution of the world. */
export const VIEW_W = 480;
export const VIEW_H = 270;
/** The canvas is twice the logical size so UI text stays crisp; the world camera zooms ×2. */
export const ZOOM = 2;
export const CANVAS_W = VIEW_W * ZOOM;
export const CANVAS_H = VIEW_H * ZOOM;

export const COLORS = {
  bg: 0x0e1116,
  skyTop: 0x1b2a3a,
  skyBottom: 0x5a3b3a,
  solid: 0x394150,
  solidTop: 0x5d6778,
  oneWay: 0x8a6d3b,
  oneWayTop: 0xc49a55,
  checkpointOff: 0x6b7280,
  checkpointOn: 0x9bd36a,
  goal: 0xf2d16b,
  enemy: 0xb94a48,
  enemyDark: 0x6e2b2a,
  playerBullet: 0xfff2a8,
  enemyBullet: 0xff7a45,
  white: 0xffffff,
  ui: 0xe8e2d4,
  uiMuted: 0x8b93a1,
  uiAccent: 0xf2a541,
  danger: 0xe0533d,
} as const;

export const CSS = {
  ui: '#e8e2d4',
  muted: '#8b93a1',
  accent: '#f2a541',
  danger: '#e0533d',
  good: '#9bd36a',
} as const;

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export const DEPTH = {
  background: -10,
  parallax: -5,
  level: 0,
  pickups: 5,
  enemies: 10,
  player: 20,
  bullets: 30,
  fx: 40,
} as const;

export const SCENES = {
  boot: 'Boot',
  preload: 'Preload',
  menu: 'Menu',
  stage: 'Stage',
  hud: 'Hud',
  pause: 'Pause',
  results: 'Results',
  squad: 'Squad',
  stress: 'Stress',
} as const;
