/**
 * Procedural art for the prototype. Everything here is generated once at boot, so the game
 * downloads no image files. Gate 5 swaps these for drawn sprite atlases under the same keys.
 * Sizes are in world pixels (the 480×270 view); menus draw them at ×2 so pixels stay crisp.
 */
import Phaser from 'phaser';
import { OPERATORS, type OperatorDef } from '../data/operators';
import { PALETTE, seeded } from './theme';

type G = Phaser.GameObjects.Graphics;

function withGfx(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (g: G) => void,
): void {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics().setVisible(false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

function withCanvas(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  draw(tex.getContext());
  tex.refresh();
}

const SKIN: Record<OperatorDef['id'], number> = {
  kemi: 0x6b3e26,
  rurik: 0xe0b49a,
  meilin: 0xd9a77f,
  tari: 0x4a2c1d,
  tomas: 0x9c6b45,
  farida: 0xa8714f,
  sione: 0x7a4a2e,
  kai7: 0xd5dde5,
};
const HAIR: Record<OperatorDef['id'], number> = {
  kemi: 0x1d120c,
  rurik: 0x8a5a2b,
  meilin: 0x15110f,
  tari: 0x0b0806,
  tomas: 0x2a1a12,
  farida: 0x2a1a12,
  sione: 0x15100c,
  kai7: 0x1b5f6b,
};

export function generateArt(scene: Phaser.Scene): void {
  OPERATORS.forEach((op) => {
    portrait(scene, op);
    weaponIcon(scene, op);
  });
  hazard(scene);
  scanlines(scene);
  vignette(scene);
  glow(scene);
  skylineFar(scene);
  skylineMid(scene);
  dockNear(scene);
  foreground(scene);
  water(scene);
  quay(scene);
  containers(scene);
  catwalk(scene);
  dogTag(scene);
}

/** 16×16 head-and-shoulders portrait used by the HUD and squad screens. */
function portrait(scene: Phaser.Scene, op: OperatorDef): void {
  withGfx(scene, `portrait-${op.id}`, 16, 16, (g) => {
    const skin = SKIN[op.id];
    // shoulders / collar
    g.fillStyle(op.accent, 1).fillRect(1, 13, 14, 3);
    g.fillStyle(op.color, 1).fillRect(3, 13, 10, 2);
    // neck and face
    g.fillStyle(skin, 1).fillRect(6, 11, 4, 2).fillRect(4, 5, 8, 7);
    // jaw shading
    g.fillStyle(0x000000, 0.2).fillRect(4, 10, 8, 1);
    // helmet
    g.fillStyle(op.accent, 1).fillRect(3, 1, 10, 4).fillRect(2, 3, 12, 2);
    g.fillStyle(op.color, 1).fillRect(4, 1, 8, 2);
    // visor band and glint
    g.fillStyle(0x0b0f14, 1).fillRect(4, 6, 8, 2);
    g.fillStyle(op.color, 1).fillRect(5, 6, 6, 1);
    g.fillStyle(0xffffff, 1).fillRect(10, 6, 1, 1);
    // mouth
    g.fillStyle(0x000000, 0.35).fillRect(7, 10, 3, 1);
    if (op.id === 'kemi') {
      g.fillStyle(0xd94b3b, 1).fillRect(3, 5, 10, 1); // red headband
      g.fillStyle(HAIR.kemi, 1).fillRect(2, 6, 2, 5).fillRect(12, 6, 2, 4); // braids
    }
    if (op.id === 'rurik') {
      g.fillStyle(HAIR.rurik, 1).fillRect(4, 9, 8, 3); // beard
      g.fillStyle(skin, 1).fillRect(6, 9, 4, 1);
      g.fillStyle(op.accent, 1).fillRect(0, 12, 4, 4).fillRect(12, 12, 4, 4); // shoulder plates
    }
    if (op.id === 'meilin') {
      g.fillStyle(HAIR.meilin, 1).fillRect(12, 4, 2, 8).fillRect(3, 5, 1, 3); // ponytail
      g.fillStyle(0xd9ffd0, 1).fillRect(11, 7, 2, 1); // scope monocle glow
    }
    if (op.id === 'tomas') {
      g.fillStyle(op.color, 1).fillRect(1, 4, 14, 1); // hard-hat brim
      g.fillStyle(HAIR.tomas, 1).fillRect(6, 9, 5, 1); // moustache
      g.fillStyle(0xe8eef0, 1).fillRect(3, 14, 10, 1); // hi-vis stripe
    }
    if (op.id === 'farida') {
      g.fillStyle(HAIR.farida, 1).fillRect(3, 1, 10, 4).fillRect(2, 3, 2, 4).fillRect(12, 3, 2, 3); // curls
      g.fillStyle(0x0b0f14, 1).fillRect(4, 4, 8, 2); // goggles up
      g.fillStyle(op.color, 1).fillRect(5, 4, 2, 1).fillRect(9, 4, 2, 1);
      g.fillStyle(0x8a3a30, 1).fillRect(4, 12, 8, 2); // blast collar
    }
    if (op.id === 'sione') {
      g.fillStyle(0x20252b, 1).fillRect(3, 7, 2, 2); // headset
      g.fillStyle(op.color, 1).fillRect(5, 10, 3, 1); // boom mic
    }
    if (op.id === 'kai7') {
      // faceless shell with a light visor
      g.fillStyle(0xe8eef3, 1).fillRect(3, 1, 10, 11);
      g.fillStyle(0x0d1a20, 1).fillRect(4, 6, 9, 2);
      g.fillStyle(op.color, 1).fillRect(5, 6, 7, 1);
      g.fillStyle(op.color, 1).fillRect(7, 14, 2, 2); // chest core
    }
  });
}

/** 22×8 weapon silhouette for the HUD badge. */
function weaponIcon(scene: Phaser.Scene, op: OperatorDef): void {
  withGfx(scene, `w-${op.id}`, 22, 8, (g) => {
    const c = PALETTE.bone;
    g.fillStyle(c, 1);
    const w = op.weapons[0];
    if (w === 'forge') {
      // carbine: plain body, curved mag
      g.fillRect(3, 2, 13, 3).fillRect(16, 3, 4, 1).fillRect(9, 5, 2, 3).fillRect(0, 3, 3, 2);
    } else if (w === 'tremor') {
      // grenade launcher: fat barrel, round cylinder
      g.fillRect(2, 2, 6, 4).fillRect(8, 1, 10, 4).fillRect(5, 6, 2, 2);
      g.fillCircle(8, 4, 3);
    } else if (w === 'tala') {
      // pump shotgun: long tube, pump grip
      g.fillRect(0, 3, 9, 3).fillRect(9, 3, 12, 1).fillRect(12, 4, 5, 2).fillRect(5, 6, 2, 2);
    } else if (w === 'volt') {
      // energy repeater: rounded body, emitter
      g.fillRect(3, 2, 14, 3).fillRect(17, 3, 3, 1).fillRect(8, 5, 2, 2);
      g.fillStyle(op.color, 1).fillRect(9, 2, 1, 3).fillRect(12, 2, 1, 3).fillRect(19, 3, 2, 1);
    } else if (w === 'riptide') {
      // speargun: slim tube, spear tip
      g.fillRect(4, 3, 12, 2).fillRect(16, 3, 4, 1).fillRect(20, 2, 2, 3).fillRect(7, 5, 2, 3);
    } else if (op.id === 'kemi') {
      // compact SMG: short body, vertical mag, stubby barrel
      g.fillRect(4, 2, 11, 3).fillRect(15, 3, 4, 1).fillRect(8, 5, 2, 3).fillRect(1, 2, 3, 2);
    } else if (op.id === 'rurik') {
      // LMG: long body, box mag, bipod
      g.fillRect(2, 2, 15, 3).fillRect(17, 3, 5, 1).fillRect(7, 5, 4, 3).fillRect(0, 3, 2, 3);
      g.fillRect(16, 5, 1, 3).fillRect(18, 5, 1, 3);
    } else {
      // DMR: long slim body, scope on top
      g.fillRect(1, 3, 17, 2).fillRect(18, 3, 4, 1).fillRect(7, 0, 7, 2).fillRect(9, 5, 2, 3);
    }
  });
}

function hazard(scene: Phaser.Scene): void {
  withGfx(scene, 'hazard', 16, 16, (g) => {
    g.fillStyle(0x111111, 1).fillRect(0, 0, 16, 16);
    g.fillStyle(PALETTE.signal, 1);
    // two diagonal stripes per tile, seamless when tiled
    for (const off of [-16, 0, 16]) {
      g.fillPoints(
        [
          new Phaser.Math.Vector2(off, 16),
          new Phaser.Math.Vector2(off + 8, 16),
          new Phaser.Math.Vector2(off + 24, 0),
          new Phaser.Math.Vector2(off + 16, 0),
        ],
        true,
      );
    }
  });
}

/** Full-screen scanline overlay baked into one texture (one quad, no tiling shader). */
function scanlines(scene: Phaser.Scene): void {
  withCanvas(scene, 'scan', 480, 270, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,1)';
    for (let y = 2; y < 270; y += 3) ctx.fillRect(0, y, 480, 1);
  });
}

function vignette(scene: Phaser.Scene): void {
  withCanvas(scene, 'vignette', 480, 270, (ctx) => {
    const grd = ctx.createRadialGradient(240, 135, 90, 240, 135, 300);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(0.7, 'rgba(5,8,14,0.25)');
    grd.addColorStop(1, 'rgba(5,8,14,0.75)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 480, 270);
  });
}

function glow(scene: Phaser.Scene): void {
  withCanvas(scene, 'glow', 64, 64, (ctx) => {
    const grd = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 64, 64);
  });
}

/** Far layer, 512×150: gantry cranes and towers against the sunset. Tiles seamlessly. */
function skylineFar(scene: Phaser.Scene): void {
  withGfx(scene, 'bg-far', 512, 150, (g) => {
    const rnd = seeded(11);
    const col = 0x1c2738;
    g.fillStyle(col, 1);
    // low city band
    for (let x = 0; x < 512; x += 8) {
      const h = 18 + Math.floor(rnd() * 22);
      g.fillRect(x, 150 - h, 8, h);
    }
    // towers
    for (const x of [40, 210, 330, 450]) {
      const h = 50 + Math.floor(rnd() * 40);
      g.fillRect(x, 150 - h, 14, h);
      g.fillRect(x + 6, 150 - h - 10, 2, 10);
    }
    // gantry cranes: legs, boom, cab
    for (const x of [110, 270, 400]) {
      g.fillRect(x, 60, 4, 90).fillRect(x + 36, 60, 4, 90);
      g.fillRect(x - 30, 52, 110, 6);
      g.fillRect(x + 10, 44, 18, 10);
      g.lineStyle(1, col, 1)
        .lineBetween(x + 2, 60, x + 38, 120)
        .lineBetween(x + 38, 60, x + 2, 120);
    }
    // warm windows on towers
    g.fillStyle(0xffb35a, 0.55);
    for (let i = 0; i < 40; i++)
      g.fillRect(Math.floor(rnd() * 512), 100 + Math.floor(rnd() * 45), 1, 1);
  });
}

/** Mid layer, 512×110: container stacks and a warehouse with lit windows. */
function skylineMid(scene: Phaser.Scene): void {
  withGfx(scene, 'bg-mid', 512, 110, (g) => {
    const rnd = seeded(23);
    const cols = [0x14202e, 0x182636, 0x101a26];
    let x = 0;
    while (x < 512) {
      const w = 34 + Math.floor(rnd() * 3) * 16;
      const stacks = 1 + Math.floor(rnd() * 4);
      for (let s = 0; s < stacks; s++) {
        const y = 110 - (s + 1) * 16;
        g.fillStyle(cols[(s + Math.floor(x / 40)) % cols.length] ?? 0x14202e, 1).fillRect(
          x,
          y,
          Math.min(w, 512 - x),
          15,
        );
        g.fillStyle(0x000000, 0.25);
        for (let k = x + 3; k < x + w - 2 && k < 512; k += 4) g.fillRect(k, y + 2, 1, 11);
      }
      x += w + 2;
    }
    // warehouse block with windows
    g.fillStyle(0x0f1823, 1).fillRect(300, 40, 120, 70);
    g.fillStyle(0xffb35a, 0.7);
    for (let wx = 306; wx < 414; wx += 9)
      for (let wy = 48; wy < 100; wy += 10) if (rnd() > 0.45) g.fillRect(wx, wy, 4, 4);
  });
}

/** Near layer, 512×70: quayside crane legs and lamp posts, darkest of the background. */
function dockNear(scene: Phaser.Scene): void {
  withGfx(scene, 'bg-near', 512, 70, (g) => {
    const c = 0x0b121b;
    g.fillStyle(c, 1);
    g.fillRect(0, 62, 512, 8);
    for (const x of [60, 300]) {
      g.fillRect(x, 0, 6, 70)
        .fillRect(x + 70, 0, 6, 70)
        .fillRect(x - 10, 0, 96, 6);
      g.lineStyle(2, c, 1)
        .lineBetween(x + 3, 6, x + 73, 60)
        .lineBetween(x + 73, 6, x + 3, 60);
    }
    for (const x of [180, 420, 500]) {
      g.fillRect(x, 20, 2, 50);
      g.fillRect(x - 4, 18, 10, 3);
      g.fillStyle(0xffd28a, 0.9).fillRect(x - 2, 21, 6, 1);
      g.fillStyle(c, 1);
    }
  });
}

/** Foreground silhouettes that pass in front of the action (scrolls faster than the world). */
function foreground(scene: Phaser.Scene): void {
  withGfx(scene, 'fg-posts', 512, 60, (g) => {
    const c = 0x04070b;
    g.fillStyle(c, 1);
    // mooring bollards and a sagging chain
    for (const x of [30, 270]) {
      g.fillRect(x, 30, 14, 30).fillRect(x - 3, 26, 20, 6);
    }
    g.lineStyle(2, c, 1);
    for (let i = 0; i < 24; i++) {
      const x1 = 44 + i * 9.4;
      const sag = Math.sin((i / 24) * Math.PI) * 14;
      g.lineBetween(x1, 34 + sag, x1 + 9.4, 34 + Math.sin(((i + 1) / 24) * Math.PI) * 14);
    }
    // a lamp post edge on the right
    g.fillRect(470, 0, 5, 60);
  });
}

function water(scene: Phaser.Scene): void {
  withGfx(scene, 'water', 64, 16, (g) => {
    g.fillStyle(0x0c2236, 1).fillRect(0, 0, 64, 16);
    g.fillStyle(0x2c5a7a, 0.8).fillRect(4, 2, 10, 1).fillRect(30, 6, 14, 1).fillRect(50, 11, 8, 1);
    g.fillStyle(0xff9a4a, 0.35).fillRect(18, 4, 6, 1).fillRect(44, 13, 6, 1);
  });
}

/** Quay front face, 64×30: top lip, worn concrete, bolts, a dark waterline. */
function quay(scene: Phaser.Scene): void {
  withGfx(scene, 'tex-quay', 64, 30, (g) => {
    const rnd = seeded(5);
    g.fillStyle(0x3b4656, 1).fillRect(0, 0, 64, 30);
    // walkway top surface (gives depth)
    g.fillStyle(0x6c7a8c, 1).fillRect(0, 0, 64, 3);
    g.fillStyle(0x93a2b3, 1).fillRect(0, 0, 64, 1);
    // edge lip shadow
    g.fillStyle(0x222b37, 1).fillRect(0, 3, 64, 2);
    // speckle and stains
    for (let i = 0; i < 40; i++) {
      g.fillStyle(rnd() > 0.5 ? 0x46525f : 0x323c49, 1).fillRect(
        Math.floor(rnd() * 64),
        6 + Math.floor(rnd() * 22),
        2,
        1,
      );
    }
    // panel seams and bolts
    g.fillStyle(0x2a333f, 1).fillRect(31, 5, 1, 25);
    g.fillStyle(0x8a96a6, 1)
      .fillRect(4, 8, 1, 1)
      .fillRect(58, 8, 1, 1)
      .fillRect(26, 8, 1, 1)
      .fillRect(36, 8, 1, 1);
    // hazard paint at the lip every other panel
    g.fillStyle(PALETTE.signal, 0.85).fillRect(8, 5, 6, 1).fillRect(20, 5, 6, 1);
    g.fillStyle(0x1a222d, 1).fillRect(0, 26, 64, 4);
  });
}

/** Shipping container side, 32×32, in three paint colours. */
function containers(scene: Phaser.Scene): void {
  const paints = [0x8c3b2e, 0x2e6b6b, 0x2d4a7a];
  paints.forEach((paint, i) => {
    withGfx(scene, `tex-container-${i}`, 32, 32, (g) => {
      g.fillStyle(paint, 1).fillRect(0, 0, 32, 32);
      const r = (paint >> 16) & 0xff;
      const gg = (paint >> 8) & 0xff;
      const b = paint & 0xff;
      const light = Phaser.Display.Color.GetColor(
        Math.min(255, r + 50),
        Math.min(255, gg + 50),
        Math.min(255, b + 50),
      );
      const dark = Phaser.Display.Color.GetColor(r * 0.6, gg * 0.6, b * 0.6);
      g.fillStyle(light, 1).fillRect(0, 0, 32, 3); // top face
      g.fillStyle(dark, 1);
      for (let x = 2; x < 32; x += 4) g.fillRect(x, 5, 1, 25); // corrugation
      g.fillStyle(dark, 1).fillRect(0, 3, 32, 2).fillRect(0, 30, 32, 2);
      g.fillStyle(0xd9d2c4, 0.35).fillRect(10, 12, 12, 1); // stencil mark hint
    });
  });
}

/** Steel catwalk, 32×10: grating top, truss below. */
function catwalk(scene: Phaser.Scene): void {
  withGfx(scene, 'tex-catwalk', 32, 10, (g) => {
    g.fillStyle(0x9aa7b5, 1).fillRect(0, 0, 32, 2);
    g.fillStyle(0x5a6675, 1).fillRect(0, 2, 32, 2);
    g.fillStyle(0x2b3442, 1);
    for (let x = 0; x < 32; x += 3) g.fillRect(x, 0, 1, 2);
    g.lineStyle(1, 0x3f4a59, 1);
    g.lineBetween(0, 9, 8, 4)
      .lineBetween(8, 4, 16, 9)
      .lineBetween(16, 9, 24, 4)
      .lineBetween(24, 4, 32, 9);
    g.fillStyle(0x3f4a59, 1).fillRect(0, 9, 32, 1);
  });
}

/** Dog tag icon used for solo-mode lives. */
function dogTag(scene: Phaser.Scene): void {
  withGfx(scene, 'dogtag', 8, 12, (g) => {
    g.fillStyle(0xc9d3dd, 1).fillRect(1, 2, 6, 9).fillRect(2, 1, 4, 11);
    g.fillStyle(0x7e8a97, 1).fillRect(2, 5, 4, 1).fillRect(2, 7, 3, 1);
    g.fillStyle(0x0b0f14, 1).fillRect(3, 3, 2, 1);
  });
}
