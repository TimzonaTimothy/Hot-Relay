/**
 * Control layout in one place. Keyboard bindings are data: InputManager builds its key map from
 * DEFAULT_KEYS plus any saved overrides (Settings → controls rebinding UI is INPUT-05; the data
 * path already works: `input.setKeyBindings({ dash: ['KeyF'] })`).
 *
 * Defaults follow the brief: A/D or arrows move, Space jump/flip, J fire, W/S aim (S on the
 * ground goes prone), C prone toggle, Shift dash, 1/2/3 weapons, Esc pause. The older layout's
 * keys stay as alternates where they don't clash (Z jump, X fire, K jump).
 */

export type Action =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'jump'
  | 'fire'
  | 'prone'
  | 'dash'
  | 'swap'
  | 'weapon'
  | 'slot1'
  | 'slot2'
  | 'slot3'
  | 'reload'
  | 'pause'
  | 'confirm';

export const ACTIONS: readonly Action[] = [
  'left',
  'right',
  'up',
  'down',
  'jump',
  'fire',
  'prone',
  'dash',
  'swap',
  'weapon',
  'slot1',
  'slot2',
  'slot3',
  'reload',
  'pause',
  'confirm',
];

/** Keyboard: KeyboardEvent.code values per action. */
export const DEFAULT_KEYS: Record<Action, readonly string[]> = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  jump: ['Space', 'KeyK', 'KeyZ'],
  fire: ['KeyJ', 'KeyX'],
  prone: ['KeyC'],
  dash: ['ShiftLeft', 'ShiftRight'],
  swap: ['KeyE', 'KeyL'],
  weapon: ['KeyQ', 'KeyV'],
  slot1: ['Digit1', 'Numpad1'],
  slot2: ['Digit2', 'Numpad2'],
  slot3: ['Digit3', 'Numpad3'],
  reload: ['KeyR'],
  pause: ['Escape', 'KeyP'],
  confirm: ['Enter'],
};

/** Standard Gamepad mapping button indices. */
export const PAD = {
  a: 0,
  b: 1,
  x: 2,
  y: 3,
  lb: 4,
  rb: 5,
  lt: 6,
  rt: 7,
  back: 8,
  start: 9,
  up: 12,
  down: 13,
  left: 14,
  right: 15,
} as const;

/** Gamepad buttons per action (directions also come from the left stick). */
export const PAD_BUTTONS: Partial<Record<Action, readonly number[]>> = {
  jump: [PAD.a],
  fire: [PAD.x, PAD.rt],
  dash: [PAD.b],
  weapon: [PAD.y],
  swap: [PAD.rb],
  prone: [PAD.lb],
  reload: [PAD.lt],
  pause: [PAD.start],
  confirm: [PAD.a],
  up: [PAD.up],
  down: [PAD.down],
  left: [PAD.left],
  right: [PAD.right],
};

/** Merge saved overrides over the defaults. An override replaces that action's keys. */
export function resolveBindings(
  overrides: Partial<Record<Action, readonly string[]>> = {},
): Record<Action, readonly string[]> {
  const out = { ...DEFAULT_KEYS };
  for (const a of ACTIONS) {
    const o = overrides[a];
    if (Array.isArray(o) && o.every((k) => typeof k === 'string')) out[a] = o;
  }
  return out;
}

/**
 * Codes bound to more than one action (gameplay actions only: "confirm" is a menu key and may
 * share Enter/Space-style keys). Returned as code → actions.
 */
export function findConflicts(
  bindings: Record<Action, readonly string[]>,
): Record<string, Action[]> {
  const seen: Record<string, Action[]> = {};
  for (const a of ACTIONS) {
    if (a === 'confirm') continue;
    for (const code of bindings[a]) (seen[code] ??= []).push(a);
  }
  return Object.fromEntries(Object.entries(seen).filter(([, acts]) => acts.length > 1));
}

/** code → action lookup used by the keyboard listener. */
export function keyMap(bindings: Record<Action, readonly string[]>): Record<string, Action> {
  const map: Record<string, Action> = {};
  for (const a of ACTIONS) for (const code of bindings[a]) map[code] ??= a;
  return map;
}
