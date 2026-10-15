/**
 * URL flags for playtests.
 *   ?mode=solo   → single-operator build for the H2 A/B test (RELAY-05)
 *   ?debug=1     → fps overlay, physics debug toggle (F2), stress test on the menu
 *   ?stage=stress→ jump straight into the stress scene (TEST-01)
 *   ?squad=a,b,c → pick the squad; ?insertion=play|skip → force or skip the opening cinematic
 *   ?detail=auto|high|low → override the saved Detail setting (PERF-01)
 *   ?rigs=off    → with ?debug=1 only: hide every character rig, physics keeps running (PERF-01)
 */
import type { SquadMode } from './Squad';
import { isDetailSetting, type DetailSetting } from './detail';

const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');

export const FLAGS = {
  mode: (params.get('mode') === 'solo' ? 'solo' : 'relay') as SquadMode,
  debug: params.get('debug') === '1',
  stress: params.get('stage') === 'stress',
  /** Lets automated smoke tests run without waiting on audio unlock or menus. */
  autostart: params.get('autostart') === '1',
  /** ?squad=tari,kemi,rurik — squad and relay order (otherwise the saved squad). */
  squad: params.get('squad')?.split(',').filter(Boolean) ?? null,
  /**
   * ?insertion=play|skip. Default: play from the menu; autostart (smoke tests) skips it
   * unless asked to play.
   */
  insertion: (params.get('insertion') as 'play' | 'skip' | null) ?? null,
  /** ?detail=auto|high|low — overrides the saved Detail setting for this session. */
  /** ?rigs=off — only honoured with ?debug=1 (see Rig). */
  rigsOff: params.get('rigs') === 'off',
  detail: ((d) => (isDetailSetting(d) ? d : null))(params.get('detail')) as DetailSetting | null,
};
