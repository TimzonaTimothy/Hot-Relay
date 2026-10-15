import type { EnemySpawn, StageDef } from './types';

/** TEST-01 / H10: 60 riflemen and ~200 bullets on one screen-and-a-bit. */
const enemies: EnemySpawn[] = [];
for (let i = 0; i < 60; i++) {
  const row = i % 3;
  enemies.push({ kind: 'rifleman', x: 300 + ((i * 37) % 620), y: row === 0 ? 430 : row === 1 ? 300 : 190 });
}

export const stress: StageDef = {
  id: 'stress',
  name: 'Stress Test',
  width: 960,
  height: 540,
  parSec: 60,
  waterY: 600,
  spawn: { x: 120, y: 430 },
  solids: [{ x: -40, y: 430, w: 1040, h: 110 }],
  platforms: [
    { x: 260, y: 300, w: 680, h: 22 },
    { x: 280, y: 190, w: 660, h: 22 },
  ],
  checkpoints: [],
  enemies,
  arenas: [],
  goal: { x: 99999, y: 430 },
  decor: [],
};
