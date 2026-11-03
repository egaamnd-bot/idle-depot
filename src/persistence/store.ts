/** Where serialized saves live. Implementations are provided by the platform layer; persistence only depends on this. */
export interface SaveStore {
  read(slot: string): Promise<string | null>;
  write(slot: string, data: string): Promise<void>;
  remove(slot: string): Promise<void>;
}

/** The subset of the Web Storage API we rely on, so tests and other platforms can supply their own. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class MemoryStorage implements StorageLike {
  private readonly map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

/** SaveStore over a Storage-like object. Errors (quota, private mode) propagate to the caller, which reports them. */
export class StorageSaveStore implements SaveStore {
  constructor(
    private readonly storage: StorageLike,
    private readonly prefix = 'idle-depot:',
  ) {}

  read(slot: string): Promise<string | null> {
    return this.run(() => this.storage.getItem(this.prefix + slot));
  }
  write(slot: string, data: string): Promise<void> {
    return this.run(() => this.storage.setItem(this.prefix + slot, data));
  }
  remove(slot: string): Promise<void> {
    return this.run(() => this.storage.removeItem(this.prefix + slot));
  }

  private run<T>(fn: () => T): Promise<T> {
    try {
      return Promise.resolve(fn());
    } catch (e) {
      return Promise.reject(e instanceof Error ? e : new Error(String(e)));
    }
  }
}
