/** Logical view size. The camera is not zoomed: world units are canvas pixels. */
export const VIEW_W = 960;
export const VIEW_H = 540;

export const STEP_HZ = 60;
export const STEP_MS = 1000 / STEP_HZ;

/** Draw order. Higher is in front. */
export const DEPTH = {
  sky: -100,
  far: -90,
  mid: -80,
  near: -70,
  water: -60,
  terrainBack: -10,
  terrain: 0,
  decor: 5,
  pickups: 8,
  enemies: 10,
  player: 20,
  bullets: 30,
  fx: 40,
  foreground: 60,
  debug: 100,
} as const;

/** Palette taken from the jungle-ruins reference: teal sky, moss greens, sandstone walkways. */
export const COLOR = {
  ink: 0x1b1a17,
  sky: 0x9fdde0,
  moss: 0x5a9a3c,
  sand: 0xc9925e,
  water: 0x4fc1c4,
  ember: 0xff7a2e,
  white: 0xffffff,
  hudBg: 0x0f1d17,
  hudEdge: 0xff9a3c,
  danger: 0xe0452f,
  good: 0x9be03c,
} as const;

export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
export const FONT_DISPLAY = 'Impact, "Arial Black", "Trebuchet MS", sans-serif';
