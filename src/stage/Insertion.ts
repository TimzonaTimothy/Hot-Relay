/**
 * Helicopter insertion cinematic: drives the pure InsertionSequence and draws it.
 * The helicopter (PLACEHOLDER art from src/art/fx.ts) flies in, hovers, drops a rope; the lead
 * operator (any operator: it uses their own rig) slides down, lands, and the helicopter leaves
 * while the player already has control. Rotor wash throws dust and flattens grass; the rotor
 * loop is synthesised (PLACEHOLDER audio).
 *
 * The landing height comes from the level geometry, and the player body is disabled while on
 * the rope and re-enabled standing on that ground, so the operator cannot fall through terrain.
 */
import Phaser from 'phaser';
import { DEPTH } from '../config/constants';
import { FX_RES } from '../art/fx';
import { InsertionSequence, type InsertionDef, type InsertionFrame } from '../systems/insertion';
import type { Player } from '../entities/Player';
import type { Effects } from './Effects';
import type { Foliage } from './Foliage';
import { sfx } from '../systems/Sfx';

const S = 1 / FX_RES;
/** Cabin-door anchor inside the heli-body texture (world units, facing right). */
const DOOR = { x: 58, y: 27 };

export class InsertionCinematic {
  readonly seq: InsertionSequence;
  private readonly heli: Phaser.GameObjects.Container;
  private readonly rotorDisc: Phaser.GameObjects.Image;
  private readonly bladeA: Phaser.GameObjects.Image;
  private readonly bladeB: Phaser.GameObjects.Image;
  private readonly tail: Phaser.GameObjects.Image;
  private readonly rope: Phaser.GameObjects.Graphics;
  private rotorAngle = 0;
  private landedHandled = false;
  private frameState: InsertionFrame;
  private ropeSway = 0;

  constructor(
    scene: Phaser.Scene,
    def: InsertionDef,
    groundY: number,
    private readonly player: Player,
    private readonly fx: Effects,
    private readonly foliage: Foliage,
  ) {
    this.seq = new InsertionSequence(def, groundY);
    const facing = def.approachFrom === 'left' ? 1 : -1;

    const body = scene.add
      .image(0, 0, 'heli-body')
      .setScale(S)
      .setOrigin(DOOR.x / 96, DOOR.y / 40);
    this.rotorDisc = scene.add.image(-4, -25, 'heli-rotor').setScale(S * 1.05, S);
    this.bladeA = scene.add.image(-4, -25, 'heli-blade').setScale(S, S);
    this.bladeB = scene.add.image(-4, -25, 'heli-blade').setScale(S, S);
    this.tail = scene.add.image(-53, -22, 'heli-tail').setScale(S);
    this.heli = scene.add
      .container(0, 0, [body, this.rotorDisc, this.bladeA, this.bladeB, this.tail])
      .setDepth(DEPTH.player - 1)
      .setScale(facing, 1);
    this.rope = scene.add.graphics().setDepth(DEPTH.player - 1);

    player.arcadeBody.enable = false;
    player.onRope = false;
    player.shown = false;
    player.facing = facing;
    sfx.startRotor();
    this.frameState = this.seq.frame();
  }

  get controlReturned(): boolean {
    return this.seq.controlReturned;
  }

  get finished(): boolean {
    return this.seq.finished;
  }

  get frame(): InsertionFrame {
    return this.frameState;
  }

  skip(): void {
    if (this.seq.controlReturned) return;
    this.seq.skip();
    this.touchDown(false);
  }

  /** Fixed-step advance: moves the operator (gameplay-relevant). */
  step(dtMs: number): void {
    const f = this.seq.step(dtMs);
    this.frameState = f;
    const p = this.player;
    if (f.rider && !f.controlReturned) {
      p.shown = true;
      p.onRope = f.rider.onRope;
      p.placeAt(f.rider.x + (f.rider.onRope ? Math.sin(this.ropeSway) * 0.8 : 0), f.rider.y);
    }
    if (f.phase === 'landed' || f.controlReturned) this.touchDown(true);
  }

  /** The operator's feet reach the ground: enable physics standing on the measured ground. */
  private touchDown(animate: boolean): void {
    if (this.landedHandled) return;
    this.landedHandled = true;
    const p = this.player;
    p.onRope = false;
    p.shown = true;
    p.respawnAt(this.seq.def.landX, this.seq.groundY);
    if (animate) {
      p.anim.reset('rope');
      p.rig.land(0.9);
      this.fx.dust(p.x, this.seq.groundY, 8);
    }
  }

  /** Per-frame visuals: heli, rotors, rope, wash, sound. */
  render(frameMs: number, view: Phaser.Geom.Rectangle): void {
    const f = this.frameState;
    const dt = frameMs / 1000;
    this.ropeSway += dt * 2.3;
    this.heli.setPosition(f.heli.x, f.heli.y).setRotation(f.heli.tilt);
    // edge-on rotor: the disc shimmers, two blades sweep through foreshortening
    this.rotorAngle += dt * 38;
    this.rotorDisc.setAlpha(0.75 + Math.sin(this.rotorAngle * 3.1) * 0.2);
    this.bladeA.setScale(S * Math.cos(this.rotorAngle), S);
    this.bladeB.setScale(S * Math.cos(this.rotorAngle + Math.PI / 2), S);
    this.tail.setRotation(this.rotorAngle * 1.6);

    this.rope.clear();
    if (f.ropeLen > 0.5) {
      const x0 = f.heli.x;
      const y0 = f.heli.y;
      const sway = Math.sin(this.ropeSway) * 2.2 * (f.phase === 'landed' ? 1.8 : 1);
      this.rope.lineStyle(1, 0x2a2016, 1);
      this.rope.beginPath();
      this.rope.moveTo(x0, y0);
      const steps = 8;
      for (let i = 1; i <= steps; i++) {
        const k = i / steps;
        this.rope.lineTo(x0 + sway * k * k, y0 + f.ropeLen * k);
      }
      this.rope.strokePath();
      this.rope.lineStyle(0.5, 0x8a7350, 1);
      this.rope.beginPath();
      this.rope.moveTo(x0 + 0.4, y0);
      this.rope.lineTo(x0 + 0.4 + sway, y0 + f.ropeLen);
      this.rope.strokePath();
    }

    // rotor wash on dust and grass beneath the helicopter
    this.fx.wash(f.heli.x, this.seq.groundY, f.wash, frameMs);
    this.foliage.setWash(f.heli.x, f.wash);

    // loudness: closer to the view centre and lower is louder
    const dist = Math.abs(f.heli.x - view.centerX);
    const level =
      Math.max(0, 1 - dist / 520) *
      (f.phase === 'depart' || f.phase === 'done' ? 1 - Math.min(1, f.phaseMs / 1800) : 1);
    sfx.setRotor(level);

    if (this.seq.finished) this.destroy();
  }

  destroy(): void {
    if (!this.heli.active) return;
    sfx.stopRotor();
    this.foliage.setWash(0, 0);
    this.heli.destroy();
    this.rope.destroy();
  }
}
