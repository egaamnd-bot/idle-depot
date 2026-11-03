import { MemoryStorage, type StorageLike } from '../persistence/store';
import type { LifecycleEvent, PlatformAdapter } from './types';

/** The parts of `window` the adapter touches, so it can be tested without a browser. */
export interface WebEnv {
  readonly localStorage?: StorageLike | undefined;
  readonly document: {
    readonly visibilityState: string;
    addEventListener(type: 'visibilitychange', listener: () => void): void;
    removeEventListener(type: 'visibilitychange', listener: () => void): void;
  };
  readonly crypto?: { getRandomValues<T extends ArrayBufferView>(array: T): T } | undefined;
  readonly now?: (() => number) | undefined;
}

export function createWebPlatform(env: WebEnv = window as unknown as WebEnv): PlatformAdapter {
  const probe = tryLocalStorage(env);
  return {
    id: 'web',
    now: env.now ?? (() => Date.now()),
    randomSeed() {
      if (env.crypto) return env.crypto.getRandomValues(new Uint32Array(1))[0] as number;
      return (env.now ?? (() => Date.now()))() >>> 0;
    },
    storage: probe ?? new MemoryStorage(),
    storagePersistent: probe !== null,
    onLifecycle(handler: (event: LifecycleEvent) => void) {
      const listener = () => handler(env.document.visibilityState === 'hidden' ? 'pause' : 'resume');
      env.document.addEventListener('visibilitychange', listener);
      return () => env.document.removeEventListener('visibilitychange', listener);
    },
  };
}

/** localStorage can throw on access or write (private mode, disabled storage). Verify with a real write. */
function tryLocalStorage(env: WebEnv): StorageLike | null {
  try {
    const s = env.localStorage;
    if (!s) return null;
    const key = '__idle_depot_probe__';
    s.setItem(key, '1');
    s.removeItem(key);
    return s;
  } catch {
    return null;
  }
}
