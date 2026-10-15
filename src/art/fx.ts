/**
 * PLACEHOLDER ART — effects, hazards and the insertion helicopter, drawn in code at boot.
 * Same cel-shaded, ink-outlined style as the characters so the slice reads as one game.
 * Each key is listed in ASSETS.md with the final asset that should replace it; keep keys stable.
 *
 * Textures are drawn at FX_RES pixels per world pixel and shown at 1 / FX_RES scale.
 */
import Phaser from 'phaser';
import { canvasTexture, inked, poly, roundRect, INK, type Ctx } from './paint';

export const FX_RES = 4;

export function generateFxArt(scene: Phaser.Scene): void {
  const tex = (key: string, w: number, h: number, draw: (c: Ctx) => void) =>
    canvasTexture(scene, key, w, h, FX_RES, draw);

  // Invisible physics frame shared by characters (12×20 world px), so hitbox maths is stable.
  if (!scene.textures.exists('hitbox')) {
    const t = scene.textures.createCanvas('hitbox', 12, 20);
    t?.refresh();
  }

  // Muzzle flash: a hot core with four uneven petals, pointing right.
  tex('fx-flash', 20, 12, (c) => {
    const grd = c.createRadialGradient(5, 6, 0, 5, 6, 10);
    grd.addColorStop(0, 'rgba(255,255,235,1)');
    grd.addColorStop(0.35, 'rgba(255,214,120,0.95)');
    grd.addColorStop(1, 'rgba(255,120,30,0)');
    c.fillStyle = grd;
    poly(c, [
      [1, 6],
      [6, 2.2],
      [9, 4.4],
      [19.5, 6],
      [9, 7.6],
      [6, 9.8],
    ]);
    c.fill();
    c.fillStyle = 'rgba(255,255,240,0.95)';
    c.beginPath();
    c.ellipse(5, 6, 3, 2, 0, 0, Math.PI * 2);
    c.fill();
  });

  // Spent brass casing.
  tex('fx-casing', 3, 1.6, (c) => {
    roundRect(c, 0.2, 0.2, 2.6, 1.2, 0.4);
    inked(c, '#e3b553', 0.25, '#6b4a12');
    c.fillStyle = '#fff1b8';
    c.fillRect(0.6, 0.35, 1.6, 0.3);
  });

  // Soft contact shadow.
  tex('fx-shadow', 24, 6, (c) => {
    const grd = c.createRadialGradient(12, 3, 0, 12, 3, 12);
    grd.addColorStop(0, 'rgba(0,0,0,0.55)');
    grd.addColorStop(0.6, 'rgba(0,0,0,0.3)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    c.save();
    c.scale(1, 0.25);
    c.fillStyle = grd;
    c.beginPath();
    c.arc(12, 12, 12, 0, Math.PI * 2);
    c.fill();
    c.restore();
  });

  // Dust puff (tinted per use).
  tex('fx-dust', 8, 8, (c) => {
    const grd = c.createRadialGradient(4, 4, 0, 4, 4, 4);
    grd.addColorStop(0, 'rgba(255,255,255,0.9)');
    grd.addColorStop(0.7, 'rgba(255,255,255,0.45)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = grd;
    c.fillRect(0, 0, 8, 8);
  });

  // Water droplet and foam.
  tex('fx-drop', 2, 3, (c) => {
    c.fillStyle = '#d8f4ff';
    c.beginPath();
    c.moveTo(1, 0);
    c.quadraticCurveTo(2, 2, 1, 3);
    c.quadraticCurveTo(0, 2, 1, 0);
    c.fill();
  });
  tex('fx-bubble', 4, 4, (c) => {
    c.strokeStyle = 'rgba(220,250,255,0.95)';
    c.lineWidth = 0.6;
    c.beginPath();
    c.arc(2, 2, 1.5, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.fillRect(1.2, 1, 0.7, 0.7);
  });

  // Foliage tuft that bends in rotor wash (pivot at the base).
  tex('fx-tuft', 12, 10, (c) => {
    const blades: Array<[number, number, string]> = [
      [-0.5, 9, '#3f6b2a'],
      [-0.2, 10, '#5d8f37'],
      [0.15, 9.5, '#4c7d2f'],
      [0.45, 8, '#6aa040'],
      [-0.8, 7, '#355d23'],
    ];
    for (const [lean, len, col] of blades) {
      c.fillStyle = col;
      c.strokeStyle = INK;
      c.lineWidth = 0.35;
      c.beginPath();
      c.moveTo(5.2, 10);
      c.quadraticCurveTo(6 + lean * 4, 10 - len * 0.6, 6 + lean * len, 10 - len);
      c.quadraticCurveTo(6.8 + lean * 3, 10 - len * 0.5, 6.8, 10);
      c.closePath();
      c.fill();
      c.stroke();
    }
  });

  // Naval mine: spiked sphere with a warning lamp.
  tex('mine', 14, 14, (c) => {
    c.strokeStyle = INK;
    c.lineWidth = 0.5;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      c.fillStyle = '#4b5056';
      poly(c, [
        [7 + Math.cos(a - 0.18) * 4.6, 7 + Math.sin(a - 0.18) * 4.6],
        [7 + Math.cos(a) * 6.8, 7 + Math.sin(a) * 6.8],
        [7 + Math.cos(a + 0.18) * 4.6, 7 + Math.sin(a + 0.18) * 4.6],
      ]);
      c.fill();
      c.stroke();
    }
    c.beginPath();
    c.arc(7, 7, 4.8, 0, Math.PI * 2);
    inked(c, '#2f3439', 0.6);
    c.fillStyle = '#5c646c';
    c.beginPath();
    c.arc(5.6, 5.6, 2, Math.PI, Math.PI * 1.7);
    c.lineTo(5.6, 5.6);
    c.fill();
    c.fillStyle = '#b7322a';
    c.beginPath();
    c.arc(7, 7, 1.3, 0, Math.PI * 2);
    c.fill();
  });
  tex('mine-lamp', 4, 4, (c) => {
    const grd = c.createRadialGradient(2, 2, 0, 2, 2, 2);
    grd.addColorStop(0, 'rgba(255,240,220,1)');
    grd.addColorStop(0.5, 'rgba(255,80,50,0.9)');
    grd.addColorStop(1, 'rgba(255,40,20,0)');
    c.fillStyle = grd;
    c.fillRect(0, 0, 4, 4);
  });

  // Eel drone: segmented underwater robot, facing right.
  tex('eel', 26, 9, (c) => {
    c.strokeStyle = INK;
    for (let i = 0; i < 4; i++) {
      const x = 2 + i * 4.4;
      const h = 4.5 + i * 0.6;
      roundRect(c, x, 4.5 - h / 2, 5, h, 1.6);
      inked(c, i % 2 ? '#3c4f5c' : '#4f6676', 0.5);
    }
    // head
    poly(c, [
      [19, 1.2],
      [24.8, 3.6],
      [25.6, 4.5],
      [24.8, 5.4],
      [19, 7.8],
    ]);
    inked(c, '#5d7788', 0.6);
    c.fillStyle = '#8fb2c4';
    c.fillRect(19.6, 2.2, 3, 0.8);
    // tail fin
    poly(c, [
      [2.5, 4.5],
      [0, 1],
      [0.6, 4.5],
      [0, 8],
    ]);
    inked(c, '#2f3e48', 0.5);
  });
  tex('eel-eye', 3, 3, (c) => {
    const grd = c.createRadialGradient(1.5, 1.5, 0, 1.5, 1.5, 1.5);
    grd.addColorStop(0, '#ffffff');
    grd.addColorStop(0.5, '#ff5a3c');
    grd.addColorStop(1, 'rgba(255,60,30,0)');
    c.fillStyle = grd;
    c.fillRect(0, 0, 3, 3);
  });

  // Rusty grate over the secret tunnel.
  tex('grate', 8, 40, (c) => {
    roundRect(c, 0.4, 0.4, 7.2, 39.2, 0.8);
    c.fillStyle = 'rgba(20,24,29,0.55)';
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 0.5;
    c.stroke();
    for (let x = 1.4; x < 7; x += 1.7) {
      c.fillStyle = '#7a5a3a';
      c.fillRect(x, 0.6, 0.9, 38.8);
      c.fillStyle = '#a07a4e';
      c.fillRect(x, 0.6, 0.35, 38.8);
    }
    for (const y of [3, 20, 37]) {
      c.fillStyle = '#6b4a2e';
      c.fillRect(0.5, y - 0.7, 7, 1.4);
    }
  });

  // Supply cache.
  tex('cache', 16, 11, (c) => {
    roundRect(c, 0.5, 2, 15, 8.5, 1);
    inked(c, '#5b6a3a', 0.6);
    c.fillStyle = '#44512b';
    c.fillRect(0.9, 7, 14.2, 3.1);
    roundRect(c, 0.5, 0.5, 15, 3, 0.8);
    inked(c, '#6f7f47', 0.6);
    c.fillStyle = '#f2d16b';
    c.fillRect(6, 4.5, 4, 2.4);
    c.fillStyle = INK;
    c.fillRect(7.6, 4.8, 0.8, 1.8);
    c.fillRect(7, 5.3, 2, 0.8);
  });

  // Checkpoint banner (off / on) and the extraction beacon at the goal. Pivot: pole foot.
  const banner = (key: string, cloth: string, clothShade: string) =>
    tex(key, 14, 26, (c) => {
      c.fillStyle = '#2a3038';
      c.fillRect(1.2, 1, 1.4, 25);
      c.fillStyle = '#9aa3b2';
      c.fillRect(1.2, 1, 0.5, 25);
      c.beginPath();
      c.moveTo(2.6, 2);
      c.quadraticCurveTo(8, 0.5, 13.5, 3);
      c.lineTo(12, 6);
      c.lineTo(13.5, 9);
      c.quadraticCurveTo(8, 7, 2.6, 9);
      c.closePath();
      inked(c, cloth, 0.45);
      c.fillStyle = clothShade;
      c.fillRect(2.8, 7, 9, 1.4);
      roundRect(c, 0, 24.4, 4, 1.6, 0.6);
      inked(c, '#3a414b', 0.4);
    });
  banner('prop-checkpoint-off', '#6b7280', '#4b525e');
  banner('prop-checkpoint-on', '#7ed957', '#4f9a33');
  tex('prop-goal', 22, 50, (c) => {
    c.fillStyle = '#2a3038';
    c.fillRect(2, 2, 2, 48);
    c.fillStyle = '#c9d0d8';
    c.fillRect(2, 2, 0.7, 48);
    c.beginPath();
    c.moveTo(4, 3);
    c.quadraticCurveTo(12, 1, 21.5, 4.5);
    c.lineTo(19, 9);
    c.lineTo(21.5, 13.5);
    c.quadraticCurveTo(12, 11, 4, 14);
    c.closePath();
    inked(c, '#ffd23f', 0.5);
    c.fillStyle = '#ff7a1f';
    c.fillRect(4.2, 7.4, 15, 2);
    c.fillStyle = '#ff3b30';
    c.beginPath();
    c.arc(3, 2, 1.8, 0, Math.PI * 2);
    c.fill();
    roundRect(c, 0, 47.8, 6, 2.2, 0.8);
    inked(c, '#3a414b', 0.4);
  });

  generateHelicopter(scene);
}

/**
 * Insertion helicopter, side view facing right: body, tail boom, skids, door.
 * Rotors are separate images so they can spin.
 */
function generateHelicopter(scene: Phaser.Scene): void {
  const tex = (key: string, w: number, h: number, draw: (c: Ctx) => void) =>
    canvasTexture(scene, key, w, h, FX_RES, draw);

  tex('heli-body', 96, 40, (c) => {
    const body = '#3d4a3c';
    const bodyHi = '#56664f';
    const bodyLo = '#2a3429';
    // tail boom
    poly(c, [
      [4, 12],
      [40, 13],
      [40, 21],
      [6, 17],
    ]);
    inked(c, body, 0.8);
    // tail fin
    poly(c, [
      [2, 3],
      [8, 3],
      [12, 13],
      [5, 16],
    ]);
    inked(c, bodyLo, 0.8);
    // fuselage
    c.beginPath();
    c.moveTo(34, 10);
    c.lineTo(66, 7);
    c.quadraticCurveTo(86, 8, 92, 20);
    c.quadraticCurveTo(90, 29, 76, 31);
    c.lineTo(40, 31);
    c.quadraticCurveTo(32, 26, 34, 10);
    c.closePath();
    inked(c, body, 0.9);
    // underside shade
    c.save();
    c.clip();
    c.fillStyle = bodyLo;
    c.fillRect(30, 25, 70, 10);
    c.fillStyle = bodyHi;
    c.fillRect(30, 7, 70, 3);
    c.restore();
    // engine hump
    roundRect(c, 46, 3, 22, 6, 2);
    inked(c, bodyLo, 0.8);
    // cockpit glass
    c.beginPath();
    c.moveTo(72, 10);
    c.quadraticCurveTo(86, 10, 90, 19);
    c.lineTo(76, 19);
    c.closePath();
    inked(c, '#7fb0c6', 0.7);
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.beginPath();
    c.moveTo(76, 11.5);
    c.lineTo(81, 11.5);
    c.lineTo(78, 15);
    c.closePath();
    c.fill();
    // open cabin door (dark interior)
    roundRect(c, 50, 12, 16, 15, 1.2);
    inked(c, '#141a17', 0.7);
    c.fillStyle = '#20281f';
    c.fillRect(51, 22, 14, 4);
    // markings
    c.fillStyle = '#ff7a1f';
    c.fillRect(38, 15, 6, 2);
    c.fillStyle = '#eae4d6';
    c.fillRect(70, 23, 8, 1.4);
    // skids
    c.strokeStyle = INK;
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(48, 31);
    c.lineTo(46, 36);
    c.moveTo(74, 31);
    c.lineTo(76, 36);
    c.stroke();
    c.lineWidth = 1.8;
    c.beginPath();
    c.moveTo(38, 36.5);
    c.lineTo(86, 36.5);
    c.quadraticCurveTo(90, 36.5, 91, 34);
    c.stroke();
    c.strokeStyle = '#5c6a57';
    c.lineWidth = 0.7;
    c.beginPath();
    c.moveTo(39, 36.2);
    c.lineTo(86, 36.2);
    c.stroke();
  });

  // Main rotor seen edge-on: a blurred disc with two visible blade streaks.
  tex('heli-rotor', 100, 4, (c) => {
    const grd = c.createLinearGradient(0, 0, 100, 0);
    grd.addColorStop(0, 'rgba(30,34,30,0)');
    grd.addColorStop(0.15, 'rgba(30,34,30,0.35)');
    grd.addColorStop(0.5, 'rgba(30,34,30,0.55)');
    grd.addColorStop(0.85, 'rgba(30,34,30,0.35)');
    grd.addColorStop(1, 'rgba(30,34,30,0)');
    c.fillStyle = grd;
    c.beginPath();
    c.ellipse(50, 2, 50, 1.6, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#1c201c';
    c.fillRect(46, 0.8, 8, 2.4);
  });
  tex('heli-blade', 50, 2, (c) => {
    roundRect(c, 0, 0.3, 50, 1.4, 0.7);
    inked(c, '#2b302b', 0.3);
  });
  // Tail rotor: a small disc.
  tex('heli-tail', 12, 12, (c) => {
    c.fillStyle = 'rgba(30,34,30,0.35)';
    c.beginPath();
    c.arc(6, 6, 5.6, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#20251f';
    c.fillRect(5.4, 0.6, 1.2, 10.8);
    c.fillRect(0.6, 5.4, 10.8, 1.2);
  });
}
