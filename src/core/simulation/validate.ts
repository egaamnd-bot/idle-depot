import type { SimState } from './types';

const isUint = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Structural check of an untrusted value (for example a loaded save) before it is used as simulation state. */
export function isSimState<W>(value: unknown, isWorld: (w: unknown) => w is W): value is SimState<W> {
  if (!isObj(value)) return false;
  if (!isUint(value['tick']) || !isUint(value['seq'])) return false;
  const rng = value['rng'];
  if (!isObj(rng) || !isUint(rng['s']) || rng['s'] > 0xffffffff) return false;
  const scheduled = value['scheduled'];
  if (!Array.isArray(scheduled)) return false;
  for (const e of scheduled) {
    if (!isObj(e) || !isUint(e['at']) || !isUint(e['order']) || typeof e['type'] !== 'string') return false;
  }
  return isWorld(value['world']);
}
