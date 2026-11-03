/**
 * Seeded pseudo-random generator (mulberry32). Integer arithmetic only, so results are identical on every
 * JavaScript engine. The whole state is one uint32, which is JSON-safe and travels inside saves, so a loaded game
 * continues the exact same random sequence. Not cryptographic: never use for anything security related.
 */
export interface RngState {
  readonly s: number; // uint32
}

export function createRngState(seed: number): RngState {
  if (!Number.isFinite(seed)) throw new RangeError('seed must be a finite number');
  return { s: Math.trunc(seed) >>> 0 };
}

export class Rng {
  private s: number;

  constructor(state: RngState) {
    if (!Number.isInteger(state.s) || state.s < 0 || state.s > 0xffffffff) {
      throw new RangeError('invalid rng state');
    }
    this.s = state.s;
  }

  /** Current state, for saving. */
  state(): RngState {
    return { s: this.s };
  }

  /** Float in [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [0, maxExclusive). Modulo bias is negligible at game scales. */
  int(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RangeError('maxExclusive must be a positive integer');
    }
    return Math.floor(this.next() * maxExclusive);
  }

  /** Integer in [min, max] inclusive. */
  range(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) throw new RangeError('invalid range');
    return min + this.int(max - min + 1);
  }

  /** True with the given probability in [0, 1]. */
  chance(p: number): boolean {
    if (!(p >= 0 && p <= 1)) throw new RangeError('probability must be within [0, 1]');
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError('cannot pick from an empty list');
    return items[this.int(items.length)] as T;
  }
}
