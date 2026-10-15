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
  /** Segment of a collapsing bridge (segments with the same id fall in order). */
  bridge?: number;
}

export type EnemyType = 'rifleman' | 'grenadier';

export interface EnemySpawn {
  type: EnemyType;
  x: number;
  y: number;
  /** Riflemen: patrol this far either side of the spawn point while idle. */
  patrol?: number;
}

export interface TurretDef {
  x: number;
  /** Ground the turret sits on. */
  y: number;
  facing: 1 | -1;
}

export interface PodDef {
  /** The pod launches when the player passes this x. */
  triggerX: number;
  /** Flight height. */
  y: number;
  give: 'fan' | 'hornet' | 'lance' | 'ammo';
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
  turrets: TurretDef[];
  /** Explosive barrels (feet positions). */
  barrels: { x: number; y: number }[];
  /** Supply pods that fly across and drop weapon/ammo pickups when shot down. */
  pods: PodDef[];
  checkpoints: { x: number; y: number }[];
  arenas: ArenaDef[];
  goal: { x: number; y: number };
  /** Opening helicopter insertion; omit for a plain start. */
  insertion?: InsertionDef;
  /** Grass tufts that sway (and bend in rotor wash), as x positions on the ground. */
  tufts: { x: number; y: number }[];
}
