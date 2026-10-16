/**
 * View zoom (UI-11): the player can widen or tighten the world camera.
 * Pure logic; StageScene applies it to the camera and the parallax layers.
 */

/** The world camera's normal zoom (480×270 logical view in a 960×540 canvas). */
export const ZOOM_DEFAULT = 2;
/** Tap order of the zoom button: normal → wide → close → normal. */
export const ZOOM_LEVELS = [2, 1.6, 2.5] as const;
/**
 * Widest zoom. At 1.6 the view is 600×337, which still fits inside a 360 px tall stage;
 * anything wider would show past the top and bottom of the world.
 */
export const ZOOM_MIN = Math.min(...ZOOM_LEVELS);

export function isZoomLevel(z: unknown): z is number {
  return typeof z === 'number' && (ZOOM_LEVELS as readonly number[]).includes(z);
}

export function nextZoom(z: number): number {
  const i = (ZOOM_LEVELS as readonly number[]).indexOf(z);
  return ZOOM_LEVELS[(i + 1) % ZOOM_LEVELS.length] ?? ZOOM_DEFAULT;
}

export function zoomLabel(z: number): string {
  if (z < ZOOM_DEFAULT) return 'Wide';
  if (z > ZOOM_DEFAULT) return 'Close';
  return 'Normal';
}

/** World-space size of the view at a zoom. */
export function viewSize(z: number, canvasW: number, canvasH: number): { w: number; h: number } {
  return { w: canvasW / z, h: canvasH / z };
}

/**
 * Where scroll-factor-0 objects must sit (in canvas units) to line up with the screen's
 * top-left corner: the camera zooms around its centre.
 */
export function screenOrigin(z: number, canvasW: number, canvasH: number): { x: number; y: number } {
  const v = viewSize(z, canvasW, canvasH);
  return { x: (canvasW - v.w) / 2, y: (canvasH - v.h) / 2 };
}

/** Ease the current zoom toward the target (~150 ms), snapping when close. */
export function approachZoom(current: number, target: number, frameMs: number): number {
  const next = current + (target - current) * (1 - Math.exp(-frameMs / 70));
  return Math.abs(target - next) < 0.002 ? target : next;
}
