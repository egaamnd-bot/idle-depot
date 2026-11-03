import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createContainer, moveContainer } from '../src/core/container/container';
import { advance, createSimState } from '../src/core/simulation/advance';
import { hashValue, stableStringify } from '../src/core/simulation/hash';
import { isDepotWorld, type DepotWorld } from '../src/core/simulation/world';
import {
  CURRENT_SAVE_VERSION,
  SAVE_FORMAT,
  createEnvelope,
  parseEnvelope,
  serializeEnvelope,
  type Migrations,
} from '../src/persistence/envelope';
import { loadState, saveState } from '../src/persistence/saveGame';
import { MemoryStorage, StorageSaveStore } from '../src/persistence/store';
import { createWebPlatform, type WebEnv } from '../src/platform/web';
import { TestStore } from './helpers';

const FIXTURE = readFileSync(new URL('./fixtures/save-v1.json', import.meta.url), 'utf8');

function worldWithContainer(): DepotWorld {
  const c = createContainer({
    id: 'c-9', number: 'ZZZU7654321', size: '20FT', owner: 'Example Line', cargo: 'EMPTY', arrivedAt: 10,
  });
  if (!c.ok) throw new Error('setup');
  return { containers: { 'c-9': moveContainer(c.value, 'B-01-01', 20) } };
}

describe('save envelope', () => {
  it('serialises deterministically and round-trips', () => {
    const env = createEnvelope({ b: 1, a: [1, 2] }, 123);
    expect(env.format).toBe(SAVE_FORMAT);
    expect(env.version).toBe(CURRENT_SAVE_VERSION);
    const raw = serializeEnvelope(env);
    expect(raw).toBe(serializeEnvelope(createEnvelope({ a: [1, 2], b: 1 }, 123)));
    const parsed = parseEnvelope(raw);
    expect(parsed.ok && parsed.value.envelope.payload).toEqual({ a: [1, 2], b: 1 });
    expect(parsed.ok && parsed.value.migratedFrom).toBe(1);
  });

  it('refuses to serialise a payload that is not JSON-safe', () => {
    expect(() => serializeEnvelope(createEnvelope({ x: NaN }, 1))).toThrow(TypeError);
    expect(() => serializeEnvelope(createEnvelope({ x: undefined }, 1))).toThrow(TypeError);
  });

  it('rejects malformed input with specific errors', () => {
    const good = JSON.parse(serializeEnvelope(createEnvelope({ a: 1 }, 5))) as Record<string, unknown>;
    const cases: Array<[string, string]> = [
      ['not json {', 'INVALID_JSON'],
      ['[]', 'NOT_A_SAVE'],
      ['null', 'NOT_A_SAVE'],
      [JSON.stringify({ ...good, format: 'other' }), 'NOT_A_SAVE'],
      [JSON.stringify({ ...good, savedAt: 'yesterday' }), 'NOT_A_SAVE'],
      [JSON.stringify({ ...good, version: 0 }), 'INVALID_VERSION'],
      [JSON.stringify({ ...good, version: 1.5 }), 'INVALID_VERSION'],
      [JSON.stringify({ ...good, version: '1' }), 'INVALID_VERSION'],
      [JSON.stringify({ ...good, version: 2 }), 'VERSION_TOO_NEW'],
      [JSON.stringify({ ...good, payload: { a: 2 } }), 'CHECKSUM_MISMATCH'],
      [JSON.stringify({ ...good, checksum: 'deadbeef' }), 'CHECKSUM_MISMATCH'],
    ];
    for (const [raw, error] of cases) {
      const r = parseEnvelope(raw);
      expect(r.ok, raw.slice(0, 40)).toBe(false);
      if (!r.ok) expect(r.error, raw.slice(0, 40)).toBe(error);
    }
  });
});

describe('migration foundation', () => {
  const migrations: Migrations = {
    1: (p) => ({ ...(p as object), addedInV2: true }),
    2: (p) => {
      const { oldName, ...rest } = p as { oldName: string };
      return { ...rest, newName: oldName };
    },
  };
  const v1 = serializeEnvelope(createEnvelope({ oldName: 'x' }, 99, 1));
  const v2 = serializeEnvelope(createEnvelope({ oldName: 'y', addedInV2: true }, 99, 2));

  it('upgrades step by step from the saved version to the current one', () => {
    const r1 = parseEnvelope(v1, { currentVersion: 3, migrations });
    expect(r1.ok && r1.value.envelope.payload).toEqual({ addedInV2: true, newName: 'x' });
    expect(r1.ok && r1.value.migratedFrom).toBe(1);
    expect(r1.ok && r1.value.envelope.version).toBe(3);
    const r2 = parseEnvelope(v2, { currentVersion: 3, migrations });
    expect(r2.ok && r2.value.envelope.payload).toEqual({ addedInV2: true, newName: 'y' });
    expect(r2.ok && r2.value.migratedFrom).toBe(2);
  });

  it('re-stamps a valid checksum on the migrated envelope, so it round-trips', () => {
    const r = parseEnvelope(v1, { currentVersion: 3, migrations });
    if (!r.ok) throw new Error('expected ok');
    const again = parseEnvelope(serializeEnvelope(r.value.envelope), { currentVersion: 3, migrations });
    expect(again.ok && again.value.migratedFrom).toBe(3);
  });

  it('verifies the checksum before migrating, so a tampered old save is rejected', () => {
    const tampered = JSON.stringify({ ...(JSON.parse(v1) as object), payload: { oldName: 'evil' } });
    const r = parseEnvelope(tampered, { currentVersion: 3, migrations });
    expect(!r.ok && r.error).toBe('CHECKSUM_MISMATCH');
  });

  it('fails clearly when a migration step is missing or throws', () => {
    const missing = parseEnvelope(v1, { currentVersion: 3, migrations: { 1: migrations[1]! } });
    expect(!missing.ok && missing.error).toBe('MIGRATION_MISSING');
    const boom = parseEnvelope(v1, {
      currentVersion: 2,
      migrations: { 1: () => { throw new Error('boom'); } },
    });
    expect(!boom.ok && boom.error).toBe('MIGRATION_FAILED');
    expect(!boom.ok && boom.detail).toContain('boom');
  });

  it('refuses a save newer than the build and names both versions', () => {
    const r = parseEnvelope(v2, { currentVersion: 1 });
    expect(!r.ok && r.error).toBe('VERSION_TOO_NEW');
    expect(!r.ok && r.detail).toContain('v2');
  });
});

describe('frozen version 1 save fixture (must load forever)', () => {
  it('loads from the real loader and keeps every field', async () => {
    const store = new TestStore();
    store.data.set('main', FIXTURE);
    const r = await loadState(store, 'main', isDepotWorld);
    if (!r.ok) throw new Error(`fixture failed to load: ${r.error} ${r.detail ?? ''}`);
    const { state, savedAt, migratedFrom } = r.value;
    expect(migratedFrom).toBe(1);
    expect(savedAt).toBe(1_700_000_000_000);
    expect(state.tick).toBe(5);
    expect(state.seq).toBe(2);
    expect(state.rng).toEqual({ s: 7 });
    expect(state.scheduled).toEqual([{ at: 10, order: 1, type: 'survey', payload: { id: 'c-1' } }]);
    const c = state.world.containers['c-1']!;
    expect(c.number).toBe('ABCU1234567');
    expect(c.cargo).toBe('LADEN');
    expect(c.status).toBe('AWAITING_SURVEY');
    expect(c.location).toBe('A-02-04');
    expect(c.sealNumber).toBe('SEAL-001');
    expect(c.statusHistory).toHaveLength(2);
  });

  it('is byte-for-byte what the current serializer produces for the same data', async () => {
    const store = new TestStore();
    store.data.set('main', FIXTURE);
    const r = await loadState(store, 'main', isDepotWorld);
    if (!r.ok) throw new Error('load');
    expect(serializeEnvelope(createEnvelope(r.value.state, r.value.savedAt, 1)) + '\n').toBe(FIXTURE);
  });
});

describe('save and load round trip', () => {
  it('restores the exact state', async () => {
    const store = new TestStore();
    const state = advance(createSimState(11, worldWithContainer()), { tickMs: 1000 }, { systems: [], handlers: {} }, 25).state;
    const saved = await saveState(store, 'main', state, 555);
    expect(saved.ok).toBe(true);
    const loaded = await loadState(store, 'main', isDepotWorld);
    if (!loaded.ok) throw new Error(loaded.error);
    expect(hashValue(loaded.value.state)).toBe(hashValue(state));
    expect(loaded.value.savedAt).toBe(555);
  });

  it('continues identically after loading (determinism survives a save)', async () => {
    interface W { n: number }
    const isW = (w: unknown): w is W => typeof w === 'object' && w !== null && 'n' in w;
    const modules = {
      systems: [(ctx: { rng: { chance(p: number): boolean }; world: W; schedule(d: number, t: string): void }) => {
        if (ctx.rng.chance(0.5)) { ctx.world.n += 1; ctx.schedule(3, 'tick'); }
      }],
      handlers: { tick: (ctx: { world: W }) => { ctx.world.n += 10; } },
    };
    const mid = advance(createSimState(3, { n: 0 }), { tickMs: 1000 }, modules, 60).state;
    const store = new TestStore();
    await saveState(store, 's', mid, 1);
    const loaded = await loadState(store, 's', isW);
    if (!loaded.ok) throw new Error(loaded.error);
    const a = advance(mid, { tickMs: 1000 }, modules, 100);
    const b = advance(loaded.value.state, { tickMs: 1000 }, modules, 100);
    expect(hashValue(b.state)).toBe(hashValue(a.state));
    expect(b.events).toEqual(a.events);
  });

  it('reports an empty slot as NO_SAVE, not as an error to overwrite around', async () => {
    const r = await loadState(new TestStore(), 'main', isDepotWorld);
    expect(!r.ok && r.error).toBe('NO_SAVE');
  });

  it('rejects a well-formed envelope whose payload is not a simulation state', async () => {
    const store = new TestStore();
    store.data.set('main', serializeEnvelope(createEnvelope({ hello: 'world' }, 1)));
    const r = await loadState(store, 'main', isDepotWorld);
    expect(!r.ok && r.error).toBe('INVALID_PAYLOAD');
  });

  it('reports storage failures as values, and writes nothing for an unsafe state', async () => {
    const store = new TestStore();
    store.failWrites = 'QuotaExceededError';
    const full = await saveState(store, 'main', createSimState(1, worldWithContainer()), 1);
    expect(!full.ok && full.error).toBe('STORAGE_FAILED');
    expect(!full.ok && full.detail).toContain('Quota');

    const clean = new TestStore();
    const bad = { ...createSimState(1, worldWithContainer()), tick: NaN };
    const r = await saveState(clean, 'main', bad, 1);
    expect(!r.ok && r.error).toBe('INVALID_PAYLOAD');
    expect(clean.writes).toEqual([]);

    const unreadable = new TestStore();
    unreadable.failReads = 'denied';
    const rr = await loadState(unreadable, 'main', isDepotWorld);
    expect(!rr.ok && rr.error).toBe('STORAGE_FAILED');
  });

  it('detects a corrupted stored save', async () => {
    const store = new TestStore();
    await saveState(store, 'main', createSimState(1, worldWithContainer()), 1);
    const raw = store.data.get('main')!;
    store.data.set('main', raw.replace('"tick":0', '"tick":9'));
    const r = await loadState(store, 'main', isDepotWorld);
    expect(!r.ok && r.error).toBe('CHECKSUM_MISMATCH');
    store.data.set('main', raw.slice(0, raw.length - 20));
    const t = await loadState(store, 'main', isDepotWorld);
    expect(!t.ok && t.error).toBe('INVALID_JSON');
  });
});

describe('storage adapters', () => {
  it('namespaces keys and propagates failures', async () => {
    const mem = new MemoryStorage();
    const store = new StorageSaveStore(mem, 'p:');
    await store.write('a', 'x');
    expect(mem.getItem('p:a')).toBe('x');
    expect(await store.read('a')).toBe('x');
    await store.remove('a');
    expect(await store.read('a')).toBeNull();
    const throwing = new StorageSaveStore({
      getItem: () => { throw new Error('nope'); },
      setItem: () => { throw new Error('full'); },
      removeItem: () => undefined,
    });
    await expect(throwing.read('a')).rejects.toThrow('nope');
    await expect(throwing.write('a', 'x')).rejects.toThrow('full');
  });
});

describe('web platform adapter', () => {
  const makeEnv = (over: Partial<WebEnv> = {}) => {
    const listeners = new Set<() => void>();
    const doc = {
      visibilityState: 'visible',
      addEventListener: (_t: 'visibilitychange', l: () => void) => void listeners.add(l),
      removeEventListener: (_t: 'visibilitychange', l: () => void) => void listeners.delete(l),
    };
    const env: WebEnv = { document: doc, localStorage: new MemoryStorage(), now: () => 777, ...over };
    return { env, doc, fire: () => listeners.forEach((l) => l()), count: () => listeners.size };
  };

  it('uses local storage when it really works', () => {
    const { env } = makeEnv();
    const p = createWebPlatform(env);
    expect(p.id).toBe('web');
    expect(p.storage).toBe(env.localStorage);
    expect(p.storagePersistent).toBe(true);
    expect(p.now()).toBe(777);
  });

  it('falls back to memory, and says so, when storage is missing or throws', () => {
    for (const ls of [undefined, { getItem: () => null, setItem: () => { throw new Error('blocked'); }, removeItem: () => undefined }]) {
      const p = createWebPlatform(makeEnv({ localStorage: ls }).env);
      expect(p.storagePersistent).toBe(false);
      p.storage.setItem('k', 'v');
      expect(p.storage.getItem('k')).toBe('v');
    }
  });

  it('maps visibility changes to pause and resume, and unsubscribes', () => {
    const { env, doc, fire, count } = makeEnv();
    const p = createWebPlatform(env);
    const seen: string[] = [];
    const off = p.onLifecycle((e) => seen.push(e));
    (doc as { visibilityState: string }).visibilityState = 'hidden';
    fire();
    (doc as { visibilityState: string }).visibilityState = 'visible';
    fire();
    expect(seen).toEqual(['pause', 'resume']);
    off();
    expect(count()).toBe(0);
  });

  it('takes seeds from crypto when present, otherwise from the clock', () => {
    const withCrypto = createWebPlatform(makeEnv({ crypto: { getRandomValues: <T extends ArrayBufferView>(a: T) => { (a as unknown as Uint32Array)[0] = 123456; return a; } } }).env);
    expect(withCrypto.randomSeed()).toBe(123456);
    expect(createWebPlatform(makeEnv().env).randomSeed()).toBe(777);
  });
});

describe('stableStringify guards what is saved', () => {
  it('rejects class instances so they cannot be silently flattened', () => {
    class Box { v = 1; }
    expect(() => stableStringify({ b: new Box() })).toThrow(TypeError);
  });
});
