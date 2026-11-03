import { MemoryStorage } from '../src/persistence/store';
import type { SaveStore } from '../src/persistence/store';
import type { LifecycleEvent, PlatformAdapter } from '../src/platform/types';

export interface FakePlatform extends PlatformAdapter {
  setNow(ms: number): void;
  emit(event: LifecycleEvent): void;
  readonly seedCalls: number;
}

export function fakePlatform(opts: { seed?: number; now?: number } = {}): FakePlatform {
  let now = opts.now ?? 1_700_000_000_000;
  let seedCalls = 0;
  const handlers = new Set<(e: LifecycleEvent) => void>();
  return {
    id: 'web',
    now: () => now,
    randomSeed: () => {
      seedCalls++;
      return opts.seed ?? 4242;
    },
    storage: new MemoryStorage(),
    storagePersistent: true,
    onLifecycle(h) {
      handlers.add(h);
      return () => handlers.delete(h);
    },
    setNow(ms) {
      now = ms;
    },
    emit(e) {
      for (const h of handlers) h(e);
    },
    get seedCalls() {
      return seedCalls;
    },
  };
}

/** In-memory store that can be told to fail, delay or record writes. */
export class TestStore implements SaveStore {
  readonly data = new Map<string, string>();
  readonly writes: Array<{ slot: string; data: string }> = [];
  failWrites: string | null = null;
  failReads: string | null = null;
  writeDelayMs = 0;

  read(slot: string): Promise<string | null> {
    if (this.failReads) return Promise.reject(new Error(this.failReads));
    return Promise.resolve(this.data.get(slot) ?? null);
  }

  async write(slot: string, data: string): Promise<void> {
    if (this.failWrites) throw new Error(this.failWrites);
    if (this.writeDelayMs > 0) await new Promise((r) => setTimeout(r, this.writeDelayMs));
    this.data.set(slot, data);
    this.writes.push({ slot, data });
  }

  remove(slot: string): Promise<void> {
    this.data.delete(slot);
    return Promise.resolve();
  }
}
