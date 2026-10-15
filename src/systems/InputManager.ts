/**
 * One input state for the whole game, merged from keyboard (INPUT-01), the browser
 * Gamepad API (INPUT-02) and the touch overlay (INPUT-03).
 *
 * Button presses are latched until the next fixed simulation step consumes them, so a tap
 * shorter than one rendered frame is never lost on a slow phone.
 */

export type Action =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'jump'
  | 'fire'
  | 'swap'
  | 'weapon'
  | 'reload'
  | 'pause'
  | 'confirm';

export type InputSource = 'keyboard' | 'gamepad' | 'touch';

export interface InputFrame {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jumpHeld: boolean;
  fireHeld: boolean;
  /** A fire press since the last step, so a tap shorter than one frame still shoots once. */
  firePressed: boolean;
  jumpPressed: boolean;
  swapPressed: boolean;
  /** Cycle to the operator's other weapon. */
  weaponPressed: boolean;
  reloadPressed: boolean;
  pausePressed: boolean;
  confirmPressed: boolean;
  /** Direction taps since the last read (menus), so a quick key press is never lost. */
  upPressed: boolean;
  downPressed: boolean;
  leftPressed: boolean;
  rightPressed: boolean;
  /**
   * Analogue horizontal input, -1..1. Keyboard gives ±1; a half-tilted stick walks.
   * A light stick tilt can walk before left/right register as held.
   */
  axisX: number;
}

const KEYMAP: Record<string, Action> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  KeyZ: 'jump',
  Space: 'jump',
  KeyK: 'jump',
  KeyX: 'fire',
  KeyJ: 'fire',
  KeyC: 'swap',
  KeyL: 'swap',
  ShiftLeft: 'swap',
  ShiftRight: 'swap',
  KeyQ: 'weapon',
  KeyV: 'weapon',
  KeyR: 'reload',
  Escape: 'pause',
  KeyP: 'pause',
  Enter: 'confirm',
};

/** Standard Gamepad mapping indices. */
const PAD = {
  a: 0,
  b: 1,
  x: 2,
  y: 3,
  lb: 4,
  rb: 5,
  lt: 6,
  rt: 7,
  start: 9,
  up: 12,
  down: 13,
  left: 14,
  right: 15,
} as const;
const STICK_DEADZONE = 0.35;
/** Below the digital deadzone the stick still walks slowly (analogue), above this. */
const ANALOG_DEADZONE = 0.18;

type HeldMap = Record<Action, boolean>;
const emptyHeld = (): HeldMap => ({
  left: false,
  right: false,
  up: false,
  down: false,
  jump: false,
  fire: false,
  swap: false,
  weapon: false,
  reload: false,
  pause: false,
  confirm: false,
});

export class InputManager {
  private keys = emptyHeld();
  private pad = emptyHeld();
  private touch = emptyHeld();
  private prevHeld = emptyHeld();
  private latched = {
    jump: false,
    fire: false,
    swap: false,
    weapon: false,
    reload: false,
    pause: false,
    confirm: false,
    up: false,
    down: false,
    left: false,
    right: false,
  };
  private listeners: Array<(source: InputSource) => void> = [];
  lastSource: InputSource = 'keyboard';
  private padAxisX = 0;
  private touchAxisX = 0;
  padConnected = false;

  attach(target: Window = window): () => void {
    const down = (e: KeyboardEvent) => {
      const action = KEYMAP[e.code];
      if (!action) return;
      e.preventDefault();
      if (!this.keys[action]) this.latchPress(action); // ignores key auto-repeat
      this.keys[action] = true;
      this.setSource('keyboard');
    };
    const up = (e: KeyboardEvent) => {
      const action = KEYMAP[e.code];
      if (!action) return;
      this.keys[action] = false;
    };
    const blur = () => {
      this.keys = emptyHeld();
      this.touch = emptyHeld();
    };
    target.addEventListener('keydown', down);
    target.addEventListener('keyup', up);
    target.addEventListener('blur', blur);
    return () => {
      target.removeEventListener('keydown', down);
      target.removeEventListener('keyup', up);
      target.removeEventListener('blur', blur);
    };
  }

  /** Called by the touch overlay. */
  setTouch(action: Action, held: boolean): void {
    // latch presses immediately: touchstart and touchend can land in the same frame
    if (held && !this.touch[action]) this.latchPress(action);
    this.touch[action] = held;
    if (held) this.setSource('touch');
  }

  /**
   * Record a press the moment it happens (key or touch event), so a tap released before the
   * next frame still counts. Marking it as previously held stops the per-frame edge check in
   * `update` from counting the same press twice.
   */
  private latchPress(action: Action): void {
    if (action in this.latched) {
      this.latched[action as keyof typeof this.latched] = true;
      this.prevHeld[action] = true;
    }
  }

  setTouchDirection(dir: { left: boolean; right: boolean; up: boolean; down: boolean }): void {
    for (const k of ['left', 'right', 'up', 'down'] as const)
      if (dir[k] && !this.touch[k]) this.latchPress(k);
    this.touch.left = dir.left;
    this.touch.right = dir.right;
    this.touch.up = dir.up;
    this.touch.down = dir.down;
    if (dir.left || dir.right || dir.up || dir.down) this.setSource('touch');
  }

  /** Analogue x from the touch stick (-1..1); the 8-way directions are set separately. */
  setTouchAxis(x: number): void {
    this.touchAxisX = Math.max(-1, Math.min(1, x));
  }

  clearTouch(): void {
    this.touch = emptyHeld();
    this.touchAxisX = 0;
  }

  /** Record that the player just used this kind of control (e.g. a touch anywhere on screen). */
  noteSource(source: InputSource): void {
    this.setSource(source);
  }

  onSourceChange(fn: (source: InputSource) => void): void {
    this.listeners.push(fn);
  }

  private setSource(source: InputSource): void {
    if (this.lastSource === source) return;
    this.lastSource = source;
    this.listeners.forEach((fn) => fn(source));
  }

  private pollGamepad(): void {
    const pads =
      typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = Array.from(pads).find((p) => p && p.connected);
    this.padConnected = !!gp;
    if (!gp) {
      this.pad = emptyHeld();
      this.padAxisX = 0;
      return;
    }
    const b = (i: number) => !!gp.buttons[i]?.pressed;
    const ax = gp.axes[0] ?? 0;
    const ay = gp.axes[1] ?? 0;
    const next: HeldMap = {
      left: b(PAD.left) || ax < -STICK_DEADZONE,
      right: b(PAD.right) || ax > STICK_DEADZONE,
      up: b(PAD.up) || ay < -STICK_DEADZONE,
      down: b(PAD.down) || ay > STICK_DEADZONE,
      jump: b(PAD.a),
      fire: b(PAD.x) || b(PAD.rt),
      swap: b(PAD.b) || b(PAD.rb),
      weapon: b(PAD.y) || b(PAD.lb),
      reload: b(PAD.lt),
      pause: b(PAD.start),
      confirm: b(PAD.a),
    };
    this.padAxisX = Math.abs(ax) > ANALOG_DEADZONE ? ax : 0;
    if (Object.values(next).some(Boolean)) this.setSource('gamepad');
    this.pad = next;
  }

  /** Call once per rendered frame: polls the gamepad and latches new presses. */
  update(): void {
    this.pollGamepad();
    const held = this.held();
    for (const a of [
      'jump',
      'fire',
      'swap',
      'weapon',
      'reload',
      'pause',
      'confirm',
      'up',
      'down',
      'left',
      'right',
    ] as const) {
      if (held[a] && !this.prevHeld[a]) this.latched[a] = true;
    }
    this.prevHeld = held;
  }

  private held(): HeldMap {
    const out = emptyHeld();
    for (const a of Object.keys(out) as Action[])
      out[a] = this.keys[a] || this.pad[a] || this.touch[a];
    return out;
  }

  /** Read the state for one simulation step and clear the latched presses. */
  consume(): InputFrame {
    const h = this.held();
    const frame: InputFrame = {
      left: h.left,
      right: h.right,
      up: h.up,
      down: h.down,
      jumpHeld: h.jump,
      fireHeld: h.fire,
      firePressed: this.latched.fire,
      jumpPressed: this.latched.jump,
      swapPressed: this.latched.swap,
      weaponPressed: this.latched.weapon,
      reloadPressed: this.latched.reload,
      pausePressed: this.latched.pause,
      confirmPressed: this.latched.confirm,
      upPressed: this.latched.up,
      downPressed: this.latched.down,
      leftPressed: this.latched.left,
      rightPressed: this.latched.right,
      axisX: this.axisX(h),
    };
    this.latched = {
      jump: false,
      fire: false,
      swap: false,
      weapon: false,
      reload: false,
      pause: false,
      confirm: false,
      up: false,
      down: false,
      left: false,
      right: false,
    };
    return frame;
  }

  /** Strongest analogue source wins; digital input (keys, d-pad) is full speed. */
  private axisX(h: HeldMap): number {
    const digital = h.right === h.left ? 0 : h.right ? 1 : -1;
    if (this.keys.left || this.keys.right) return digital;
    const pad = this.padAxisX;
    const touch = this.touchAxisX;
    const analog = Math.abs(pad) >= Math.abs(touch) ? pad : touch;
    if (analog !== 0) {
      // a gentle tilt walks; past ~70% it is a full run
      const mag = Math.min(1, (Math.abs(analog) - ANALOG_DEADZONE) / (0.7 - ANALOG_DEADZONE));
      return Math.sign(analog) * Math.max(0.25, mag);
    }
    return digital;
  }

  /** Peek at held directions without consuming presses (menus). */
  peekHeld(): Readonly<HeldMap> {
    return this.held();
  }

  /** Drop any latched presses, e.g. when changing scenes so a menu tap does not jump. */
  flush(): void {
    this.latched = {
      jump: false,
      fire: false,
      swap: false,
      weapon: false,
      reload: false,
      pause: false,
      confirm: false,
      up: false,
      down: false,
      left: false,
      right: false,
    };
    this.prevHeld = this.held();
  }
}

export const input = new InputManager();
