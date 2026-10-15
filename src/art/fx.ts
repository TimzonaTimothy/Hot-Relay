import { canvas, circle, INK } from './util';

/** Bullets and effects: bright additive-looking shapes. */

function glowCapsule(w: number, h: number, core: string, glow: string): HTMLCanvasElement {
  const pad = 6;
  const [cv, ctx] = canvas(w + pad * 2, h + pad * 2);
  ctx.shadowColor = glow;
  ctx.shadowBlur = 8;
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(pad + w / 2, pad + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.ellipse(pad + w * 0.6, pad + h / 2, w * 0.36, h * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  return cv;
}

export function paintBullets(): Record<string, HTMLCanvasElement> {
  const enemy = (() => {
    const [cv, ctx] = canvas(22, 22);
    ctx.shadowColor = '#ff5a1f';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ff6a2a';
    ctx.beginPath();
    circle(ctx, 11, 11, 6);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff1c8';
    ctx.beginPath();
    circle(ctx, 11, 11, 3);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    circle(ctx, 11, 11, 6.5);
    ctx.stroke();
    return cv;
  })();
  return {
    bullet_smg: glowCapsule(18, 6, '#fffbe6', '#ffc53a'),
    bullet_lmg: glowCapsule(24, 7, '#fffbe6', '#ff9a2e'),
    bullet_dmr: glowCapsule(40, 6, '#f6ffe8', '#9be03c'),
    bullet_enemy: enemy,
  };
}

export function paintMuzzle(): HTMLCanvasElement {
  const [cv, ctx] = canvas(48, 32);
  ctx.translate(8, 16);
  ctx.shadowColor = '#ffb030';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#ffd25a';
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(16, -11);
  ctx.lineTo(12, -3);
  ctx.lineTo(34, 0);
  ctx.lineTo(12, 3);
  ctx.lineTo(16, 11);
  ctx.lineTo(0, 7);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(6, 0, 8, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  return cv;
}

export function paintSoftDot(size: number, color: string): HTMLCanvasElement {
  const [cv, ctx] = canvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return cv;
}

export function paintSpark(): HTMLCanvasElement {
  const [cv, ctx] = canvas(12, 4);
  ctx.fillStyle = '#fff6c8';
  ctx.beginPath();
  ctx.ellipse(6, 2, 6, 1.8, 0, 0, Math.PI * 2);
  ctx.fill();
  return cv;
}

export function paintPuff(): HTMLCanvasElement {
  const [cv, ctx] = canvas(40, 40);
  ctx.fillStyle = '#e8e2d4';
  ctx.beginPath();
  circle(ctx, 20, 22, 14);
  circle(ctx, 12, 24, 9);
  circle(ctx, 28, 25, 9);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  circle(ctx, 23, 18, 8);
  ctx.fill();
  return cv;
}

/** 5-frame cel explosion strip, 80×80 per frame. */
export function paintBoom(): HTMLCanvasElement {
  const fw = 80;
  const [cv, ctx] = canvas(fw * 5, fw);
  for (let f = 0; f < 5; f++) {
    ctx.save();
    ctx.translate(f * fw + fw / 2, fw / 2);
    const t = f / 4;
    const r = 14 + t * 22;
    if (f < 4) {
      ctx.fillStyle = f < 2 ? '#ffffff' : '#ffdf6a';
      ctx.beginPath();
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        circle(ctx, Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * (0.55 - t * 0.2));
      }
      ctx.fill();
      ctx.fillStyle = f < 2 ? '#ffd040' : '#ff7a2e';
      ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + 0.3;
        circle(ctx, Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7, r * 0.3);
      }
      ctx.fill();
    }
    if (f >= 2) {
      ctx.fillStyle = `rgba(70,62,56,${0.9 - (f - 2) * 0.25})`;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        circle(ctx, Math.cos(a) * r * 0.75, Math.sin(a) * r * 0.75 - t * 8, r * 0.32);
      }
      ctx.fill();
    }
    ctx.restore();
  }
  return cv;
}

export function paintRing(color: string): HTMLCanvasElement {
  const [cv, ctx] = canvas(128, 128);
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.beginPath();
  circle(ctx, 64, 64, 54);
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  circle(ctx, 64, 64, 54);
  ctx.stroke();
  return cv;
}

export function paintLeaf(): HTMLCanvasElement {
  const [cv, ctx] = canvas(12, 6);
  ctx.fillStyle = '#6fa846';
  ctx.beginPath();
  ctx.ellipse(6, 3, 6, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  return cv;
}
