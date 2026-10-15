import type { OperatorId } from '../data/operators';

export interface HudMember {
  id: OperatorId;
  name: string;
  color: number;
  health: number;
  maxHealth: number;
  armour: number;
  maxArmour: number;
  down: boolean;
  active: boolean;
}

/** Written by StageScene every tick, drawn by HudScene. */
export interface HudState {
  members: HudMember[];
  /** 0 = ready, 1 = just swapped. */
  swapCooldown: number;
  canSwap: boolean;
  solo: boolean;
  livesLeft: number;
  timeSec: number;
  score: number;
  callout: { text: string; color: string; until: number } | null;
  weapon: string;
  stageName: string;
}

export function emptyHud(): HudState {
  return {
    members: [],
    swapCooldown: 0,
    canSwap: false,
    solo: false,
    livesLeft: 0,
    timeSec: 0,
    score: 0,
    callout: null,
    weapon: '',
    stageName: '',
  };
}

export function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec * 100) % 100);
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}
