/** Snapshot the Stage writes every frame and the HUD scene reads. */
import type { SquadMode } from '../systems/Squad';

export interface HudMember {
  id: string;
  oxygen: number;
  name: string;
  role: string;
  color: number;
  hp: number;
  maxHp: number;
  armour: number;
  maxArmour: number;
  down: boolean;
  active: boolean;
}

export interface HudWeapon {
  name: string;
  short: string;
  mag: number;
  magSize: number;
  /** Reload progress 0..1, or null. */
  reload: number | null;
  /** Cannot fire here (LMG underwater). */
  blocked: boolean;
  /** The other weapon's short name. */
  other: string;
}

export interface HudCinematic {
  active: boolean;
  letterbox: number;
  title: string;
  subtitle: string;
  titleAlpha: number;
  skippable: boolean;
}

export interface HudState {
  running: boolean;
  mode: SquadMode;
  members: HudMember[];
  livesLeft: number;
  swapReady: boolean;
  swapCooldownFrac: number;
  nextName: string;
  timeMs: number;
  status: 'playing' | 'squadDown' | 'clear';
  showRetry: boolean;
  fps: { p50: number; p10: number } | null;
  weapon: HudWeapon | null;
  /** Active operator's air 0..1 and whether to show the gauge. */
  oxygen: number;
  showOxygen: boolean;
  cinematic: HudCinematic;
  secrets: number;
  /** Boss health bar (BOSS-01): name, remaining 0..1, and whether its core is still shielded. */
  boss: { name: string; frac: number; shielded: boolean } | null;
}

export const hud: HudState = {
  running: false,
  mode: 'relay',
  members: [],
  livesLeft: 0,
  swapReady: false,
  swapCooldownFrac: 0,
  nextName: '',
  timeMs: 0,
  status: 'playing',
  showRetry: false,
  fps: null,
  weapon: null,
  oxygen: 1,
  showOxygen: false,
  cinematic: {
    active: false,
    letterbox: 0,
    title: '',
    subtitle: '',
    titleAlpha: 0,
    skippable: false,
  },
  secrets: 0,
  boss: null,
};

/** Game-wide event names (emitted on game.events). */
export const HUD_EVENTS = {
  callout: 'hud-callout',
  /** Small, quiet notice (e.g. 'Detail lowered'), separate from the big callout. */
  notice: 'hud-notice',
  retry: 'hud-retry',
  skip: 'hud-skip',
} as const;
