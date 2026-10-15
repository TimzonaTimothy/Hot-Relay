export interface Rect {
  x: number;
  /** Top edge (the walkable surface). */
  y: number;
  w: number;
  h: number;
}

export type EnemyKind = 'rifleman';
export type DecorKind = 'palm' | 'fern' | 'pillar';

export interface EnemySpawn {
  kind: EnemyKind;
  x: number;
  /** Feet position. */
  y: number;
}

export interface Arena {
  /** Player crossing this x locks the camera. */
  triggerX: number;
  left: number;
  right: number;
  /** Each wave drops in when the previous one is cleared. */
  waves: EnemySpawn[][];
}

export interface StageDef {
  id: string;
  name: string;
  width: number;
  height: number;
  /** Target clear time for an S rank. */
  parSec: number;
  /** Water surface; falling below it knocks the operator out. */
  waterY: number;
  spawn: { x: number; y: number };
  solids: Rect[];
  /** One-way platforms: land from above, drop through with down + jump. */
  platforms: Rect[];
  checkpoints: { x: number; y: number }[];
  enemies: EnemySpawn[];
  arenas: Arena[];
  goal: { x: number; y: number };
  decor: { kind: DecorKind; x: number; y: number; seed: number; size?: number }[];
}
