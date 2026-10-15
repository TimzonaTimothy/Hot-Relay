import type { EnemySpawn, StageDef } from './types';

const H = 540;
const solid = (x: number, y: number, w: number) => ({ x, y, w, h: H - y });
const plat = (x: number, y: number, w: number) => ({ x, y, w, h: 22 });
const r = (x: number, y: number): EnemySpawn => ({ kind: 'rifleman', x, y });
const riot = (x: number, y: number): EnemySpawn => ({ kind: 'riot', x, y });

/**
 * Stage 1 — Verdant Steps. Ruined sandstone walkways over a jungle river.
 * Teaches: run and shoot → jump gaps → aim up at platforms → ambush arena → extraction.
 */
export const jungle01: StageDef = {
  id: 'jungle01',
  name: 'Verdant Steps',
  width: 6900,
  height: H,
  parSec: 150,
  waterY: 482,
  spawn: { x: 130, y: 430 },
  solids: [
    solid(-40, 430, 980),
    solid(1040, 410, 480),
    solid(1590, 445, 70),
    solid(1730, 430, 620),
    solid(2350, 365, 380),
    solid(2730, 440, 600),
    solid(3440, 420, 700),
    solid(4140, 430, 960),
    solid(5210, 400, 640),
    solid(5960, 430, 980),
  ],
  platforms: [
    plat(1170, 300, 200),
    plat(2010, 315, 220),
    plat(2820, 330, 160),
    plat(3060, 255, 180),
    plat(3700, 300, 200),
    plat(4300, 320, 200),
    plat(4720, 320, 200),
    plat(5450, 290, 200),
    plat(6200, 310, 220),
  ],
  checkpoints: [
    { x: 1800, y: 430 },
    { x: 3520, y: 420 },
    { x: 5290, y: 400 },
  ],
  enemies: [
    r(720, 430),
    r(880, 430),
    r(1280, 300),
    r(1420, 410),
    r(2120, 315),
    r(2250, 430),
    r(2620, 365),
    riot(2900, 440),
    r(3150, 255),
    r(3260, 440),
    r(3780, 300),
    r(3980, 420),
    r(5520, 290),
    riot(5700, 400),
    r(6280, 310),
    r(6420, 430),
    r(6600, 430),
  ],
  arenas: [
    {
      triggerX: 4330,
      left: 4140,
      right: 5100,
      waves: [
        [r(4400, 320), r(4800, 320), r(4980, 430)],
        [riot(4250, 430), r(4600, 430), r(4780, 320), riot(5000, 430)],
      ],
    },
  ],
  goal: { x: 6760, y: 430 },
  decor: [
    { kind: 'palm', x: 300, y: 430, seed: 1, size: 200 },
    { kind: 'fern', x: 520, y: 430, seed: 2 },
    { kind: 'pillar', x: 820, y: 430, seed: 3 },
    { kind: 'fern', x: 1100, y: 410, seed: 4 },
    { kind: 'palm', x: 1470, y: 410, seed: 5, size: 170 },
    { kind: 'fern', x: 1950, y: 430, seed: 6 },
    { kind: 'pillar', x: 2290, y: 430, seed: 7 },
    { kind: 'palm', x: 2480, y: 365, seed: 8, size: 190 },
    { kind: 'fern', x: 2780, y: 440, seed: 9 },
    { kind: 'fern', x: 3300, y: 440, seed: 10 },
    { kind: 'palm', x: 3640, y: 420, seed: 11, size: 210 },
    { kind: 'pillar', x: 4060, y: 420, seed: 12 },
    { kind: 'pillar', x: 4200, y: 430, seed: 13 },
    { kind: 'fern', x: 4560, y: 430, seed: 14 },
    { kind: 'pillar', x: 5060, y: 430, seed: 15 },
    { kind: 'palm', x: 5380, y: 400, seed: 16, size: 180 },
    { kind: 'fern', x: 5790, y: 400, seed: 17 },
    { kind: 'palm', x: 6080, y: 430, seed: 18, size: 220 },
    { kind: 'fern', x: 6500, y: 430, seed: 19 },
  ],
};
