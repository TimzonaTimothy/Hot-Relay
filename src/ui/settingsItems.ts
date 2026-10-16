/** Settings shared by the main menu and the pause menu (UI-03 basics, A11Y-01). */
import type { MenuItem } from './MenuList';
import { saves } from '../systems/services';
import { sfx } from '../systems/Sfx';
import type { Settings, TouchMode } from '../systems/SaveStore';
import { DETAIL_SETTINGS } from '../systems/detail';
import { ZOOM_LEVELS, zoomLabel } from '../systems/viewZoom';

const onOff = (v: boolean) => (v ? 'On' : 'Off');

function toggle(
  key: keyof Pick<Settings, 'screenShake' | 'flashing' | 'aimAssist' | 'autoFire' | 'showFps'>,
): () => void {
  return () => void saves.updateSettings({ [key]: !saves.data.settings[key] });
}

const TOUCH_MODES: TouchMode[] = ['auto', 'on', 'off'];
const cap = (v: string) => `${v[0]?.toUpperCase()}${v.slice(1)}`;

export function settingsItems(): MenuItem[] {
  const s = () => saves.data.settings;
  return [
    { label: () => `Screen shake: ${onOff(s().screenShake)}`, adjust: toggle('screenShake') },
    { label: () => `Flashing effects: ${onOff(s().flashing)}`, adjust: toggle('flashing') },
    { label: () => `Touch aim-assist: ${onOff(s().aimAssist)}`, adjust: toggle('aimAssist') },
    { label: () => `Touch auto-fire: ${onOff(s().autoFire)}`, adjust: toggle('autoFire') },
    {
      label: () =>
        `Touch controls: ${s().touchControls[0]?.toUpperCase()}${s().touchControls.slice(1)}`,
      adjust: (dir) => {
        const i = TOUCH_MODES.indexOf(s().touchControls);
        const next = TOUCH_MODES[(i + dir + TOUCH_MODES.length) % TOUCH_MODES.length] ?? 'auto';
        void saves.updateSettings({ touchControls: next });
      },
    },
    {
      // PERF-01: Low hides the mid/near parallax, water light shafts, grass tufts and shadows
      label: () => `Detail: ${cap(s().detail)}`,
      adjust: (dir) => {
        const i = DETAIL_SETTINGS.indexOf(s().detail);
        const n = DETAIL_SETTINGS.length;
        void saves.updateSettings({ detail: DETAIL_SETTINGS[(i + dir + n) % n] ?? 'auto' });
      },
    },
    {
      label: () => `View zoom: ${zoomLabel(s().viewZoom)}`,
      adjust: (dir) => {
        const i = (ZOOM_LEVELS as readonly number[]).indexOf(s().viewZoom);
        const n = ZOOM_LEVELS.length;
        void saves.updateSettings({ viewZoom: ZOOM_LEVELS[(i + dir + n) % n] ?? 2 });
      },
    },
    {
      label: () => `Sound: ${Math.round(s().volume * 100)}%`,
      adjust: (dir) => {
        // tapping cycles upward and wraps from 100% back to 0%
        let v = Math.round((s().volume + dir * 0.2) * 10) / 10;
        if (v > 1.001) v = 0;
        if (v < 0) v = 1;
        sfx.setVolume(v);
        void saves.updateSettings({ volume: v });
      },
    },
    { label: () => `Show FPS: ${onOff(s().showFps)}`, adjust: toggle('showFps') },
  ];
}
