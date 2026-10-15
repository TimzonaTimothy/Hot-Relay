import Phaser from 'phaser';
import { FONT_DISPLAY, VIEW_H, VIEW_W } from '../config/constants';
import {
  KITS,
  OPERATOR_FRAMES,
  RIFLEMAN_FRAMES,
  operatorPoses,
  paintArms,
  paintCharacter,
  paintPortrait,
  riflemanPoses,
  type WeaponKind,
} from '../art/characters';
import {
  paintBeacon,
  paintClouds,
  paintFar,
  paintFlag,
  paintForeground,
  paintMid,
  paintNear,
  paintSky,
  paintWater,
} from '../art/environment';
import { paintBoom, paintBullets, paintLeaf, paintMuzzle, paintPuff, paintRing, paintSoftDot, paintSpark } from '../art/fx';
import { RIGS } from '../art/registry';
import { SQUAD_ORDER } from '../data/operators';
import { services } from '../systems/services';
import type { Strip } from '../art/util';

const WEAPON: Record<string, WeaponKind> = { kemi: 'smg', rurik: 'lmg', meilin: 'dmr' };

/**
 * Paints every placeholder texture in code (no image downloads) and registers animations.
 * Texture keys are stable so real atlases can replace them later.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0d1712');
    this.add
      .text(VIEW_W / 2, VIEW_H / 2, 'PAINTING THE JUNGLE…', { fontFamily: FONT_DISPLAY, fontSize: '28px', color: '#ff9a3c' })
      .setOrigin(0.5);
    // Let the label render before the (synchronous) painting starts.
    this.time.delayedCall(30, () => {
      this.generate();
      const f = services.flags;
      if (f.autostart || f.stage === 'stress') this.scene.start('Stage', { stage: f.stage, mode: f.mode });
      else this.scene.start('Menu');
    });
  }

  private addStrip(key: string, s: Strip): void {
    if (this.textures.exists(key)) this.textures.remove(key);
    const tex = this.textures.addCanvas(key, s.canvas)!;
    s.names.forEach((n, i) => tex.add(n, 0, i * s.frameW, 0, s.frameW, s.frameH));
  }

  private addCanvas(key: string, c: HTMLCanvasElement): void {
    if (this.textures.exists(key)) this.textures.remove(key);
    this.textures.addCanvas(key, c);
  }

  private generate(): void {
    for (const id of SQUAD_ORDER) {
      const kit = KITS[id];
      const art = paintCharacter(kit, OPERATOR_FRAMES, operatorPoses());
      const arms = paintArms(kit, WEAPON[id]);
      this.addStrip(`op_${id}`, art.strip);
      this.addCanvas(`arm_${id}_r`, arms.right);
      this.addCanvas(`arm_${id}_l`, arms.left);
      this.addCanvas(`portrait_${id}`, paintPortrait(kit, 64));
      RIGS[id] = { shoulder: art.shoulder, muzzle: arms.muzzle, gunY: arms.gunY };
      this.anims.create({
        key: `op_${id}_run`,
        frames: Array.from({ length: 8 }, (_, i) => ({ key: `op_${id}`, frame: `run${i}` })),
        frameRate: id === 'rurik' ? 12 : 15,
        repeat: -1,
      });
      this.anims.create({
        key: `op_${id}_idle`,
        frames: [
          { key: `op_${id}`, frame: 'idle0' },
          { key: `op_${id}`, frame: 'idle1' },
        ],
        frameRate: 2.5,
        repeat: -1,
      });
    }

    const rm = paintCharacter(KITS.rifleman, RIFLEMAN_FRAMES, riflemanPoses());
    const rmArms = paintArms(KITS.rifleman, 'rifle');
    this.addStrip('rifleman', rm.strip);
    this.addCanvas('arm_rifleman_r', rmArms.right);
    this.addCanvas('arm_rifleman_l', rmArms.left);
    RIGS.rifleman = { shoulder: rm.shoulder, muzzle: rmArms.muzzle, gunY: rmArms.gunY };
    this.anims.create({
      key: 'rifleman_run',
      frames: Array.from({ length: 6 }, (_, i) => ({ key: 'rifleman', frame: `run${i}` })),
      frameRate: 9,
      repeat: -1,
    });
    this.anims.create({
      key: 'rifleman_idle',
      frames: [
        { key: 'rifleman', frame: 'idle0' },
        { key: 'rifleman', frame: 'idle1' },
      ],
      frameRate: 2,
      repeat: -1,
    });

    this.addCanvas('shield_riot', paintRiotShield());

    // environment layers
    this.addCanvas('sky', paintSky(VIEW_W, VIEW_H));
    this.addCanvas('clouds', paintClouds(1920, 300));
    this.addCanvas('far', paintFar(1920, 540));
    this.addCanvas('mid', paintMid(1920, 540));
    this.addCanvas('near', paintNear(1920, 540));
    this.addCanvas('water', paintWater(512, 80));
    this.addCanvas('fg', paintForeground(1920, 160));
    this.addStrip('beacon', { canvas: paintBeacon(), frameW: 48, frameH: 110, names: ['off', 'on'] });
    this.addCanvas('flag', paintFlag());

    // bullets + fx
    for (const [k, c] of Object.entries(paintBullets())) this.addCanvas(k, c);
    this.addCanvas('muzzle', paintMuzzle());
    this.addCanvas('glow', paintSoftDot(64, 'rgba(255,250,220,1)'));
    this.addCanvas('glow_red', paintSoftDot(40, 'rgba(255,110,40,1)'));
    this.addCanvas('spark', paintSpark());
    this.addCanvas('puff', paintPuff());
    this.addCanvas('ring', paintRing('#ffffff'));
    this.addCanvas('leaf', paintLeaf());
    this.addStrip('boom', { canvas: paintBoom(), frameW: 80, frameH: 80, names: ['b0', 'b1', 'b2', 'b3', 'b4'] });
    this.anims.create({
      key: 'boom',
      frames: ['b0', 'b1', 'b2', 'b3', 'b4'].map((f) => ({ key: 'boom', frame: f })),
      frameRate: 18,
      hideOnComplete: true,
    });
  }
}

/** Riot shield, facing right: tall slab with a visor slit and a red stripe. */
function paintRiotShield(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 20;
  cv.height = 62;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#1f2226';
  c.beginPath();
  c.roundRect(0, 0, 20, 62, 5);
  c.fill();
  c.fillStyle = '#4b5058';
  c.beginPath();
  c.roundRect(2, 2, 16, 58, 4);
  c.fill();
  c.fillStyle = '#6f757e';
  c.fillRect(13, 4, 3, 54);
  c.fillStyle = '#9fd4ff';
  c.fillRect(4, 12, 12, 4);
  c.fillStyle = '#c8452f';
  c.fillRect(2, 40, 16, 4);
  return cv;
}
