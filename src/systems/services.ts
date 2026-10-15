import { InputManager } from './InputManager';
import { SaveStore } from './SaveStore';
import { Telemetry } from './Telemetry';
import { Sfx } from './Sfx';
import { FpsMeter } from './FpsMeter';
import { parseFlags, type Flags } from './flags';

/** App-wide singletons shared by every scene. */
export const services = {
  input: new InputManager(),
  save: new SaveStore(),
  telemetry: new Telemetry(),
  sfx: new Sfx(),
  fps: new FpsMeter(),
  flags: (typeof location !== 'undefined' ? parseFlags(location.search) : parseFlags('')) as Flags,
  /** True once a touch has been seen; drives touchMode 'auto'. */
  touchSeen: false,
};

export type Services = typeof services;

export function touchActive(): boolean {
  const mode = services.save.data.settings.touchMode;
  if (services.flags.touch || mode === 'on') return true;
  if (mode === 'off') return false;
  return services.touchSeen;
}
