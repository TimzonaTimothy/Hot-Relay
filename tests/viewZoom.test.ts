import { describe, expect, it } from 'vitest';
import {
  ZOOM_DEFAULT,
  ZOOM_LEVELS,
  ZOOM_MIN,
  approachZoom,
  isZoomLevel,
  nextZoom,
  screenOrigin,
  viewSize,
  zoomLabel,
} from '../src/systems/viewZoom';
import { migrate } from '../src/systems/SaveStore';

describe('view zoom', () => {
  it('cycles normal → wide → close → normal', () => {
    expect(nextZoom(ZOOM_DEFAULT)).toBe(1.6);
    expect(nextZoom(1.6)).toBe(2.5);
    expect(nextZoom(2.5)).toBe(ZOOM_DEFAULT);
    expect(nextZoom(7)).toBe(ZOOM_LEVELS[0]);
  });

  it('labels the levels', () => {
    expect(zoomLabel(2)).toBe('Normal');
    expect(zoomLabel(1.6)).toBe('Wide');
    expect(zoomLabel(2.5)).toBe('Close');
  });

  it('the widest view still fits a 360 px tall stage', () => {
    expect(viewSize(ZOOM_MIN, 960, 540).h).toBeLessThanOrEqual(360);
  });

  it('places screen-fixed layers around the zoomed centre', () => {
    expect(screenOrigin(2, 960, 540)).toEqual({ x: 240, y: 135 });
    expect(screenOrigin(1.6, 960, 540)).toEqual({ x: 180, y: 101.25 });
  });

  it('eases toward the target and snaps when close', () => {
    let z = 2;
    for (let i = 0; i < 60; i++) z = approachZoom(z, 1.6, 16.7);
    expect(z).toBe(1.6);
    expect(approachZoom(2, 2.5, 16.7)).toBeGreaterThan(2);
    expect(approachZoom(2, 2.5, 16.7)).toBeLessThan(2.5);
  });

  it('save repair keeps a valid zoom and resets anything else', () => {
    expect(migrate({ settings: { viewZoom: 1.6 } }).settings.viewZoom).toBe(1.6);
    expect(migrate({ settings: { viewZoom: 0.3 } }).settings.viewZoom).toBe(ZOOM_DEFAULT);
    expect(isZoomLevel('2')).toBe(false);
  });
});
