/** Settings shared by the main menu and the pause menu (UI-03 basics, A11Y-01). */
import type { MenuItem } from './MenuList';
import { saves } from '../systems/services';
import { sfx } from '../systems/Sfx';
import type { Settings, TouchMode } from '../systems/SaveStore';

const onOff = (v: boolean) => (v ? 'On' : 'Off');

function toggle(
  key: keyof Pick<Settings, 'screenShake' | 'flashing' | 'aimAssist' | 'autoFire' | 'showFps'>,
): () => void {
  return () => void saves.updateSettings({ [key]: !saves.data.settings[key] });
}

const TOUCH_MODES: TouchMode[] = ['auto', 'on', 'off'];

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
