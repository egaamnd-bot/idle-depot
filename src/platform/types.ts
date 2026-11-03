import type { StorageLike } from '../persistence/store';

/**
 * Everything the game needs from the host environment. Core never sees this; the composition root passes pieces of it
 * to the runtime and persistence. Only the web implementation exists. 'telegram' and 'android' are reserved ids:
 * their adapters are deliberately not written yet (Phase 7, added one at a time).
 */
export type PlatformId = 'web' | 'telegram' | 'android';
export type LifecycleEvent = 'pause' | 'resume';

export interface PlatformAdapter {
  readonly id: PlatformId;
  /** Wall-clock milliseconds. Used to stamp saves; never used by core and never trusted for rewards. */
  now(): number;
  /** Non-deterministic seed for a brand-new game. Entropy belongs to the platform, not to core. */
  randomSeed(): number;
  readonly storage: StorageLike;
  /** False when storage fell back to memory (for example private browsing): progress will not survive a reload. */
  readonly storagePersistent: boolean;
  /** Subscribe to app pause/resume (tab hidden, app backgrounded). Returns an unsubscribe function. */
  onLifecycle(handler: (event: LifecycleEvent) => void): () => void;
}
