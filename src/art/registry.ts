import type { OperatorId } from '../data/operators';

export interface RigInfo {
  /** Shoulder pivot relative to the feet (facing right), per body frame. */
  shoulder: Record<string, { x: number; y: number }>;
  muzzle: number;
  gunY: number;
}

/** Runtime metadata for generated sprites, filled in by PreloadScene. */
export const RIGS: Partial<Record<OperatorId | 'rifleman', RigInfo>> = {};

export function rig(id: OperatorId | 'rifleman'): RigInfo {
  const r = RIGS[id];
  if (!r) throw new Error(`rig ${id} not generated`);
  return r;
}
