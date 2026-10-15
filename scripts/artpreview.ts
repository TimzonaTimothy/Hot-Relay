// Dev-only page: composes the generated art into one frame so art changes can be eyeballed
// (npm run dev → /artpreview.html).
import { KITS, paintCharacter, paintArms, OPERATOR_FRAMES, RIFLEMAN_FRAMES, operatorPoses, riflemanPoses, FRAME, ARM } from '../src/art/characters';
import { paintSky, paintClouds, paintFar, paintMid, paintNear, paintWater, paintForeground, paintBlock, paintPalmProp, paintFern, paintPillar, paintBeacon } from '../src/art/environment';
import { paintMuzzle, paintBullets } from '../src/art/fx';

const W = 960, H = 540;
const out = document.createElement('canvas');
out.width = W; out.height = H;
out.style.width = W * 1.5 + 'px';
document.body.appendChild(out);
const g = out.getContext('2d')!;
g.drawImage(paintSky(W, H), 0, 0);
g.drawImage(paintClouds(1920, 300), -200, 0);
g.drawImage(paintFar(1920, 540), -300, -40);
g.drawImage(paintMid(1920, 540), -500, 40);
g.drawImage(paintWater(512, 120), 0, 470); g.drawImage(paintWater(512, 120), 512, 470);
g.drawImage(paintPalmProp(3, 190), 600, 430 - 190 * 1.25);
const blocks: [number, number, number, number, boolean][] = [[-20, 420, 520, 140, false], [600, 440, 420, 120, false], [280, 300, 200, 26, true]];
blocks.forEach(([x, y, w, h, ow], i) => g.drawImage(paintBlock({ w, h, paintDepth: 160, oneWay: ow, seed: 7 + i }), x - 10, y - 10));
g.drawImage(paintPillar(4), 420, 420 - 148);
g.drawImage(paintFern(5, 40), 40, 420 - 52);
g.drawImage(paintBeacon(), 0, 0, 48, 110, 480, 420 - 108, 48, 110);
const op = paintCharacter(KITS.kemi, OPERATOR_FRAMES, operatorPoses());
const arms = paintArms(KITS.kemi, 'smg');
const drawFrame = (art: ReturnType<typeof paintCharacter>, arm: HTMLCanvasElement | null, frame: string, x: number, y: number, flip = false, aim = 0) => {
  const i = art.strip.names.indexOf(frame);
  g.save(); g.translate(x, y); if (flip) g.scale(-1, 1);
  g.drawImage(art.strip.canvas, i * FRAME.w, 0, FRAME.w, FRAME.h, -FRAME.footX, -FRAME.footY, FRAME.w, FRAME.h);
  if (arm) { const s = art.shoulder[frame]; g.translate(s.x, s.y); g.rotate(aim); g.drawImage(arm, -ARM.pivotX, -ARM.pivotY); }
  g.restore();
};
drawFrame(op, arms.right, 'run3', 150, 420);
g.drawImage(paintMuzzle(), 150 + 36, 420 - 70);
const b = paintBullets();
g.drawImage(b.bullet_smg, 260, 344); g.drawImage(b.bullet_smg, 330, 345); g.drawImage(b.bullet_enemy, 560, 350);
const rm = paintCharacter(KITS.rifleman, RIFLEMAN_FRAMES, riflemanPoses());
const rArm = paintArms(KITS.rifleman, 'rifle');
drawFrame(rm, rArm.right, 'idle0', 700, 440, true);
drawFrame(rm, rArm.right, 'run2', 380, 300, true, -0.3);
g.drawImage(paintNear(1920, 540), -900, 0);
g.drawImage(paintForeground(1920, 160), -100, 400);
(window as unknown as { artReady: boolean }).artReady = true;
