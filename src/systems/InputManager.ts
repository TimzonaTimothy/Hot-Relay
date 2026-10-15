import { snap8 } from './aim';

export type InputSource = 'keyboard' | 'gamepad' | 'touch';

/** One device's view of the controls during a tick. */
export interface SourceState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
  fire: boolean;
  lock: boolean;
  /** Edge-triggered presses since the last poll. */
  jumpPressed: number;
  swapPressed: number;
  pausePressed: number;
  confirmPressed: number;
  backPressed: number;
}

export interface InputFrame {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
  fire: boolean;
  lock: boolean;
  jumpPressed: boolean;
  swapPressed: boolean;
  pausePressed: boolean;
  confirmPressed: boolean;
  backPressed: boolean;
  /** Device that produced the most recent input. */
  source: InputSource;
}

export function emptySource(): SourceState {
  return {
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false,
    fire: false,
    lock: false,
    jumpPressed: 0,
    swapPressed: 0,
    pausePressed: 0,
    confirmPressed: 0,
    backPressed: 0,
  };
}

/** OR the held buttons of every device together; any latched press counts. */
export function mergeInput(sources: SourceState[], last: InputSource): InputFrame {
  const f: InputFrame = {
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false,
    fire: false,
    lock: false,
    jumpPressed: false,
    swapPressed: false,
    pausePressed: false,
    confirmPressed: false,
    backPressed: false,
    source: last,
  };
  for (const s of sources) {
    f.left ||= s.left;
    f.right ||= s.right;
    f.up ||= s.up;
    f.down ||= s.down;
    f.jump ||= s.jump;
    f.fire ||= s.fire;
    f.lock ||= s.lock;
    f.jumpPressed ||= s.jumpPressed > 0;
    f.swapPressed ||= s.swapPressed > 0;
    f.pausePressed ||= s.pausePressed > 0;
    f.confirmPressed ||= s.confirmPressed > 0;
    f.backPressed ||= s.backPressed > 0;
  }
  if (f.left && f.right) f.left = f.right = false;
  return f;
}

function clearPresses(s: SourceState): void {
  s.jumpPressed = s.swapPressed = s.pausePressed = s.confirmPressed = s.backPressed = 0;
}

const KEYS: Record<string, keyof SourceState> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  Space: 'jump',
  KeyZ: 'jump',
  KeyK: 'jump',
  KeyX: 'fire',
  KeyJ: 'fire',
  ShiftLeft: 'lock',
  KeyV: 'lock',
};
const SWAP_KEYS = new Set(['KeyC', 'KeyL', 'KeyE']);
const PAUSE_KEYS = new Set(['Escape', 'KeyP']);
const CONFIRM_KEYS = new Set(['Enter', 'Space', 'KeyZ', 'KeyK']);
const BACK_KEYS = new Set(['Escape', 'Backspace', 'KeyX']);

/** Pad buttons in the browser's standard mapping. */
const PAD = { a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, lt: 6, rt: 7, select: 8, start: 9, up: 12, down: 13, left: 14, right: 15 };

/**
 * One input hub for keyboard, Gamepad API and the touch overlay.
 * Presses are latched until `poll()` consumes them, so a tap shorter than a tick is never lost.
 */
export class InputManager {
  readonly keyboard = emptySource();
  readonly gamepad = emptySource();
  /** Written by the touch overlay. `stickX/Y` is the raw analog stick (-1..1). */
  readonly touch = emptySource();
  stickX = 0;
  stickY = 0;
  last: InputSource = 'keyboard';
  private prevPad: boolean[] = [];
  private attached = false;

  attach(target: Window = window): void {
    if (this.attached) return;
    this.attached = true;
    target.addEventListener('keydown', (e) => this.onKey(e, true));
    target.addEventListener('keyup', (e) => this.onKey(e, false));
    target.addEventListener('blur', () => this.releaseAll());
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    const held = KEYS[e.code];
    const known = held || SWAP_KEYS.has(e.code) || PAUSE_KEYS.has(e.code) || CONFIRM_KEYS.has(e.code);
    if (!known) return;
    e.preventDefault();
    this.last = 'keyboard';
    const k = this.keyboard;
    if (held) (k[held] as boolean) = down;
    if (!down || e.repeat) return;
    if (held === 'jump') k.jumpPressed++;
    if (SWAP_KEYS.has(e.code)) k.swapPressed++;
    if (PAUSE_KEYS.has(e.code)) k.pausePressed++;
    if (CONFIRM_KEYS.has(e.code)) k.confirmPressed++;
    if (BACK_KEYS.has(e.code)) k.backPressed++;
  }

  releaseAll(): void {
    for (const s of [this.keyboard, this.touch]) {
      s.left = s.right = s.up = s.down = s.jump = s.fire = s.lock = false;
    }
    this.stickX = this.stickY = 0;
  }

  private readPad(): void {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = Array.from(pads).find((p) => p && p.connected);
    const g = this.gamepad;
    if (!pad) {
      Object.assign(g, emptySource());
      this.prevPad = [];
      return;
    }
    const b = (i: number): boolean => !!pad.buttons[i]?.pressed;
    const edge = (i: number): boolean => b(i) && !this.prevPad[i];
    const stick = snap8(pad.axes[0] ?? 0, pad.axes[1] ?? 0, 0.4);
    g.left = b(PAD.left) || stick?.x === -1;
    g.right = b(PAD.right) || stick?.x === 1;
    g.up = b(PAD.up) || stick?.y === -1;
    g.down = b(PAD.down) || stick?.y === 1;
    g.jump = b(PAD.a);
    g.fire = b(PAD.x) || b(PAD.rt);
    g.lock = b(PAD.lb) || b(PAD.rb) || b(PAD.lt);
    if (edge(PAD.a)) g.jumpPressed++;
    if (edge(PAD.b) || edge(PAD.y)) g.swapPressed++;
    if (edge(PAD.start) || edge(PAD.select)) g.pausePressed++;
    if (edge(PAD.a) || edge(PAD.start)) g.confirmPressed++;
    if (edge(PAD.b)) g.backPressed++;
    for (const [i, cur] of pad.buttons.map((x) => x.pressed).entries()) {
      if (cur && !this.prevPad[i]) this.last = 'gamepad';
      this.prevPad[i] = cur;
    }
    if (stick) this.last = 'gamepad';
  }

  /** Read every device, merge, and consume the latched presses. */
  poll(): InputFrame {
    this.readPad();
    const frame = mergeInput([this.keyboard, this.gamepad, this.touch], this.last);
    clearPresses(this.keyboard);
    clearPresses(this.gamepad);
    clearPresses(this.touch);
    return frame;
  }
}
