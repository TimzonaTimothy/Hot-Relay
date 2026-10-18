/**
 * Stage 1 · Harbour approach (greybox layout, painted placeholder art), aimed at 3–5 minutes.
 * Teaching order: helicopter insertion → shoot level → shoot up-diagonal at a ledge →
 * hop the water channels → climb one-way platforms → raised perch → the flooded basin
 * (hop the pontoons or swim it; mines and an eel drone below; a grate hides a supply cache)
 * → gauntlet → ambush arena → the rigged gangway over a channel (a frogman below) → the Lock
 * Gate boss → goal.
 *
 * Contra-inspired pressure throughout (original designs): runner zones, wall and hatch turrets,
 * supply drones carrying pickups (Fan, Hornet, Rail) and frogmen in the water.
 *
 * Reach limits (slowest operator, Rurik): ~41 px jump height, ~57 px running jump distance.
 * Channel gaps are 48 px; pontoon gaps are 46 px. Every quay is climbable from the water:
 * the surface is 12 px below the quay top and the ledge assist reaches 26 px.
 */
import type { PlatformDef, StageDef } from './types';

const GROUND_Y = 240;
const WORLD_H = 360;
export const SURFACE_Y = 252;

const ground = (x: number, to: number): PlatformDef => ({
  x,
  y: GROUND_Y,
  w: to - x,
  h: WORLD_H - GROUND_Y,
  kind: 'solid',
});
const oneway = (x: number, to: number, y: number): PlatformDef => ({
  x,
  y,
  w: to - x,
  h: 6,
  kind: 'oneway',
});
const pontoon = (x: number, to: number): PlatformDef => ({
  x,
  y: 244,
  w: to - x,
  h: 6,
  kind: 'oneway',
  pontoon: true,
});
const block = (x: number, to: number, y: number, bottom = GROUND_Y): PlatformDef => ({
  x,
  y,
  w: to - x,
  h: bottom - y,
  kind: 'solid',
});

/** Section D starts after the basin; everything there is laid out relative to it. */
const D = 352;
/** Section E: gangway channel, then the Lock Gate arena. */
const E = 3900 + D; // 4252, where section D's ground ends
const GATE_X = E + 688; // 4940

export const GREYBOX_01: StageDef = {
  id: 'greybox-01',
  name: 'Harbour approach',
  width: GATE_X + 140,
  height: WORLD_H,
  parTimeMs: 210_000,
  start: { x: 110, y: GROUND_Y },
  platforms: [
    // A — landing zone and first contact
    ground(0, 720),
    oneway(540, 660, 192),
    // channel 1: 720–768, water to a bed at 340
    block(720, 768, 340, WORLD_H),
    // B — crates and a two-step climb
    ground(768, 1520),
    block(880, 912, 208),
    oneway(990, 1080, 208),
    oneway(1110, 1200, 176),
    // channel 2: 1520–1568
    block(1520, 1568, 340, WORLD_H),
    // C — raised block and a sniper perch
    ground(1568, 2416),
    block(1800, 1952, 208),
    oneway(2000, 2080, 176),
    oneway(2112, 2224, 144),
    // basin: 2416–2816, bed at 352, pontoons across the top
    block(2416, 2900, 352, WORLD_H),
    pontoon(2462, 2510),
    pontoon(2556, 2604),
    pontoon(2650, 2698),
    pontoon(2744, 2790),
    // secret tunnel under the far quay (2816–2900, 312–352), behind a grate
    block(2816, 2900, GROUND_Y, 312),
    // D — gauntlet, arena, goal
    ground(2900, 3900 + D),
    oneway(2760 + D, 2860 + D, 192),
    oneway(3000 + D, 3100 + D, 184),
    block(3250 + D, 3282 + D, 208),
    oneway(3360 + D, 3460 + D, 192),
    // E — channel under the rigged gangway, then the Lock Gate arena
    block(E, E + 168, 340, WORLD_H),
    ground(E + 168, GATE_X + 140),
    oneway(E + 300, E + 380, 192),
    oneway(E + 470, E + 550, 176),
  ],
  water: [
    { x: 720, y: SURFACE_Y, w: 48, h: 340 - SURFACE_Y },
    { x: 1520, y: SURFACE_Y, w: 48, h: 340 - SURFACE_Y },
    { x: 2416, y: SURFACE_Y, w: 484, h: 352 - SURFACE_Y },
    { x: E, y: SURFACE_Y, w: 168, h: 340 - SURFACE_Y },
  ],
  enemies: [
    { type: 'rifleman', x: 430, y: GROUND_Y },
    { type: 'rifleman', x: 610, y: 192 },
    { type: 'rifleman', x: 1160, y: 176 },
    { type: 'rifleman', x: 1300, y: GROUND_Y },
    { type: 'rifleman', x: 1440, y: GROUND_Y },
    { type: 'rifleman', x: 1880, y: 208 },
    { type: 'rifleman', x: 2170, y: 144 },
    { type: 'rifleman', x: 2290, y: GROUND_Y },
    { type: 'rifleman', x: 2580, y: 244 },
    { type: 'rifleman', x: 2700 + D, y: GROUND_Y },
    { type: 'rifleman', x: 2810 + D, y: 192 },
    { type: 'rifleman', x: 2950 + D, y: GROUND_Y },
    { type: 'rifleman', x: 3050 + D, y: 184 },
  ],
  mines: [
    { x: 2522, y: 302 },
    { x: 2626, y: 324 },
    { x: 2730, y: 298 },
  ],
  eels: [{ x: 2600, y: 316, minX: 2440, maxX: 2790 }],
  grates: [{ x: 2820, top: 312, h: 40 }],
  caches: [{ x: 2876, y: 352 }],
  checkpoints: [
    { x: 1490, y: GROUND_Y },
    { x: 2360, y: GROUND_Y },
    { x: 2940, y: GROUND_Y },
    { x: 3640 + D, y: GROUND_Y },
    { x: E + 210, y: GROUND_Y },
  ],
  arenas: [
    {
      triggerX: 3230 + D,
      left: 3140 + D,
      right: 3620 + D,
      spawns: [
        { type: 'rifleman', x: 3330 + D, y: -20 },
        { type: 'rifleman', x: 3410 + D, y: -40 },
        { type: 'rifleman', x: 3520 + D, y: -20 },
        { type: 'rifleman', x: 3590 + D, y: -60 },
      ],
    },
  ],
  goal: { x: GATE_X + 96, y: GROUND_Y },
  runners: [
    { fromX: 250, toX: 700, everyMs: 2600, max: 2, sides: 'ahead' },
    { fromX: 1600, toX: 2350, everyMs: 2300, max: 3, sides: 'both' },
    { fromX: 2950, toX: 3220 + D, everyMs: 2000, max: 3, sides: 'both' },
    { fromX: 3700 + D, toX: E - 20, everyMs: 2400, max: 2, sides: 'ahead' },
  ],
  turrets: [
    { x: 640, y: GROUND_Y, mount: 'hatch' },
    { x: 876, y: 222, mount: 'wall' },
    { x: 1796, y: 222, mount: 'wall' },
    { x: 2990, y: GROUND_Y, mount: 'hatch' },
    { x: 3246 + D, y: 222, mount: 'wall' },
    { x: 3760 + D, y: GROUND_Y, mount: 'hatch' },
  ],
  drones: [
    { triggerX: 520, y: 150, pickup: 'fan' },
    { triggerX: 1700, y: 120, pickup: 'hornet' },
    { triggerX: 3050, y: 130, pickup: 'rail' },
    { triggerX: E - 80, y: 140, pickup: 'fan' },
  ],
  bridges: [{ x: E, to: E + 168, y: GROUND_Y }],
  frogmen: [{ x: 2480 }, { x: E + 90 }],
  gate: { x: GATE_X, triggerX: E + 250, arenaLeft: E + 180 },
  insertion: {
    landX: 110,
    approachFrom: 'left',
    hoverHeight: 92,
    title: 'HARBOUR APPROACH',
    subtitle: 'PORT ILEYA  ·  05:40  ·  INSERTION',
  },
  tufts: [26, 52, 70, 150, 168, 196, 232, 300, 470, 700, 790, 1012, 1590, 2380, 2930, 3100].map(
    (x) => ({
      x,
      y: GROUND_Y,
    }),
  ),
};
