/**
 * Canonical JSON and a small non-cryptographic hash. Used for determinism tests and save-corruption detection.
 * Strict on purpose: anything that would not survive a JSON round trip (undefined, NaN, Infinity, functions,
 * Map, Set, Date, class instances) throws instead of being silently dropped, so a bad save is caught at write time.
 */
export function stableStringify(value: unknown): string {
  return write(value, '$');
}

function write(value: unknown, path: string): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      if (!Number.isFinite(value)) throw new TypeError(`non-finite number at ${path}`);
      return Object.is(value, -0) ? '0' : String(value);
    case 'string':
      return JSON.stringify(value);
    case 'object': {
      if (Array.isArray(value)) {
        return `[${value.map((v, i) => write(v, `${path}[${i}]`)).join(',')}]`;
      }
      const proto = Object.getPrototypeOf(value) as unknown;
      if (proto !== Object.prototype && proto !== null) throw new TypeError(`non-plain object at ${path}`);
      const obj = value as Record<string, unknown>;
      const keys = Object.keys(obj).sort();
      return `{${keys.map((k) => `${JSON.stringify(k)}:${write(obj[k], `${path}.${k}`)}`).join(',')}}`;
    }
    default:
      throw new TypeError(`unsupported ${typeof value} at ${path}`);
  }
}

/** FNV-1a, 32 bit, as 8 hex characters. Detects accidental change, not tampering. */
export function hash32(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function hashValue(value: unknown): string {
  return hash32(stableStringify(value));
}
