export interface Flags {
  mode: 'relay' | 'solo';
  debug: boolean;
  stage: string;
  autostart: boolean;
  /** Force the touch overlay on (smoke test). */
  touch: boolean;
}

export function parseFlags(search: string): Flags {
  const q = new URLSearchParams(search);
  return {
    mode: q.get('mode') === 'solo' ? 'solo' : 'relay',
    debug: q.get('debug') === '1',
    stage: q.get('stage') ?? 'jungle01',
    autostart: q.get('autostart') === '1',
    touch: q.get('touch') === '1',
  };
}
