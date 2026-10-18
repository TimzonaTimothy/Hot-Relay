/**
 * Stage data format. Coordinates are world pixels;
 * `y` of a platform is its top edge; an enemy's `y` is where its feet stand.
 * Final Port Ileya stages move to Tiled maps in Gate 5 (LEVEL-02); this format stays
 * as the in-memory shape that the Tiled loader will produce.
 */
import type { InsertionDef } from '../../systems/insertion';
import type { WaterVolume } from '../../systems/water';

export type PlatformKind = 'solid' | 'oneway';

export interface PlatformDef {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: PlatformKind;
  /** Floating pontoon: drawn as a moored float that bobs (collision stays fixed). */
  pontoon?: boolean;
}

export type EnemyType = 'rifleman';

export interface EnemySpawn {
  type: EnemyType;
  x: number;
  y: number;
}

/** A section where the camera locks until every spawned enemy is cleared. */
export interface ArenaDef {
  triggerX: number;
  left: number;
  right: number;
  spawns: EnemySpawn[];
}

export interface MineDef {
  x: number;
  y: number;
}

export interface EelDef {
  x: number;
  y: number;
  minX: number;
  maxX: number;
}

/** Breakable grate covering a hidden route. */
export interface GrateDef {
  x: number;
  top: number;
  h: number;
}

/** A stretch where runners keep sprinting in from the screen edges (Contra-style pressure). */
export interface RunnerZone {
  fromX: number;
  toX: number;
  /** Average gap between runners. */
  everyMs: number;
  /** Most runners alive at once from this zone. */
  max: number;
  /** 'ahead' = only from the screen edge in front; 'both' also from behind now and then. */
  sides: 'ahead' | 'both';
}

/** Mounted gun: on a wall / container side, or hidden in a deck hatch until you are close. */
export interface TurretDef {
  x: number;
  /** Pivot height (wall) or deck level (hatch). */
  y: number;
  mount: 'wall' | 'hatch';
}

/** A supply drone crosses the screen when the player passes triggerX; shoot it for a pickup. */
export interface DroneDef {
  triggerX: number;
  y: number;
  pickup: PickupKind;
}

export type PickupKind = 'fan' | 'hornet' | 'rail';

/** Rigged gangway: oneway catwalk segments that blow up in turn once stepped on. */
export interface BridgeDef {
  x: number;
  to: number;
  y: number;
}

/** Diver that surfaces in a water volume to lob grenades. */
export interface FrogmanDef {
  x: number;
}

/** Stage boss: the Lock Gate (two cannons guard a shielded core). */
export interface GateDef {
  /** Face of the wall; the player is kept left of it until the core dies. */
  x: number;
  triggerX: number;
  arenaLeft: number;
}

export interface StageDef {
  id: string;
  name: string;
  width: number;
  height: number;
  parTimeMs: number;
  start: { x: number; y: number };
  platforms: PlatformDef[];
  /** Water volumes; the top edge of each is the surface. */
  water: WaterVolume[];
  enemies: EnemySpawn[];
  mines: MineDef[];
  eels: EelDef[];
  grates: GrateDef[];
  /** Supply caches (usually behind a grate). */
  caches: { x: number; y: number }[];
  checkpoints: { x: number; y: number }[];
  arenas: ArenaDef[];
  goal: { x: number; y: number };
  /** Opening helicopter insertion; omit for a plain start. */
  insertion?: InsertionDef;
  /** Grass tufts that sway (and bend in rotor wash), as x positions on the ground. */
  tufts: { x: number; y: number }[];
  // Contra-inspired set (all optional so other stages and the stress scene need none)
  runners?: RunnerZone[];
  turrets?: TurretDef[];
  drones?: DroneDef[];
  bridges?: BridgeDef[];
  frogmen?: FrogmanDef[];
  gate?: GateDef;
}
