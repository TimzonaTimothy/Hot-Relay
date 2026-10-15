/**
 * Side-scrolling camera. Horizontal: follows the subject with a smoothed look-ahead in the
 * facing direction. Vertical: stays anchored to the ground the subject last stood on, so jumps
 * do not bob the view; it only follows when the subject drops below that ground (falling,
 * diving) or climbs well above it. A cinematic can take over the focus; when it hands back,
 * the same smoothing carries the camera to the player, so the handoff never cuts.
 */
import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '../config/constants';

export interface CameraSubject {
  x: number;
  feetY: number;
  facing: 1 | -1;
  grounded: boolean;
  inWater: boolean;
}

/** Feet sit this far below the view centre when standing on the ground. */
const FEET_BELOW_CENTRE = 105;
const FEET_IN_WATER = 40;
const LOOK_AHEAD = 44;

export class CameraRig {
  private cx = 0;
  private cy = 0;
  private look = 0;
  private anchorY = 0;
  private bounds = new Phaser.Geom.Rectangle(0, 0, 0, 0);
  /** Cinematic focus (x only); null = follow the subject. */
  focusX: number | null = null;

  constructor(private readonly cam: Phaser.Cameras.Scene2D.Camera) {}

  setBounds(x: number, y: number, w: number, h: number): void {
    this.bounds.setTo(x, y, w, h);
    this.cam.setBounds(x, y, w, h);
  }

  /** Jump straight to the subject (stage start, retry). */
  snap(s: CameraSubject): void {
    this.anchorY = s.feetY;
    this.look = s.facing * LOOK_AHEAD;
    this.cx = this.focusX ?? s.x + this.look;
    this.cy = this.anchorY - FEET_BELOW_CENTRE;
    this.apply();
  }

  update(frameMs: number, s: CameraSubject): void {
    const dt = frameMs / 1000;
    // vertical anchor: ground level, unless below it (water, pits) or far above it
    if (s.grounded || s.inWater) this.anchorY = s.feetY;
    else if (s.feetY > this.anchorY) this.anchorY = s.feetY;
    else if (s.feetY < this.anchorY - 90) this.anchorY = s.feetY + 90;

    this.look += (s.facing * LOOK_AHEAD - this.look) * Math.min(1, dt * 2.2);
    const tx = this.focusX ?? s.x + this.look;
    // underwater the diver is framed near the middle so the depths are visible
    const ty = this.anchorY - (s.inWater ? FEET_IN_WATER : FEET_BELOW_CENTRE);
    this.cx += (tx - this.cx) * (1 - Math.exp(-dt * 7));
    this.cy += (ty - this.cy) * (1 - Math.exp(-dt * 5));
    this.apply();
  }

  private apply(): void {
    const b = this.bounds;
    const hw = VIEW_W / 2;
    const hh = VIEW_H / 2;
    const x = b.width > VIEW_W ? Phaser.Math.Clamp(this.cx, b.x + hw, b.right - hw) : b.centerX;
    const y = b.height > VIEW_H ? Phaser.Math.Clamp(this.cy, b.y + hh, b.bottom - hh) : b.centerY;
    // keep the smoothed state inside the bounds, so leaving an edge never lags
    this.cx = x;
    this.cy = y;
    this.cam.centerOn(Math.round(x * 2) / 2, Math.round(y * 2) / 2);
  }
}
