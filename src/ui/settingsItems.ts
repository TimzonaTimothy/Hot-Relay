import type { Settings, TouchMode } from '../systems/SaveStore';

export interface SettingItem {
  key: keyof Settings;
  label: string;
  value: (s: Settings) => string;
  next: (s: Settings) => void;
}

const onOff = (b: boolean) => (b ? 'ON' : 'OFF');
const TOUCH: TouchMode[] = ['auto', 'on', 'off'];

export const SETTINGS_ITEMS: SettingItem[] = [
  { key: 'sound', label: 'Sound', value: (s) => onOff(s.sound), next: (s) => (s.sound = !s.sound) },
  { key: 'shake', label: 'Screen shake', value: (s) => onOff(s.shake), next: (s) => (s.shake = !s.shake) },
  { key: 'flashing', label: 'Flashing effects', value: (s) => onOff(s.flashing), next: (s) => (s.flashing = !s.flashing) },
  { key: 'aimAssist', label: 'Touch aim-assist', value: (s) => onOff(s.aimAssist), next: (s) => (s.aimAssist = !s.aimAssist) },
  { key: 'autoFire', label: 'Touch auto-fire', value: (s) => onOff(s.autoFire), next: (s) => (s.autoFire = !s.autoFire) },
  {
    key: 'touchMode',
    label: 'Touch controls',
    value: (s) => s.touchMode.toUpperCase(),
    next: (s) => (s.touchMode = TOUCH[(TOUCH.indexOf(s.touchMode) + 1) % TOUCH.length]),
  },
  { key: 'showFps', label: 'Show FPS', value: (s) => onOff(s.showFps), next: (s) => (s.showFps = !s.showFps) },
];
