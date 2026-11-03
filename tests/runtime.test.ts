import { describe, expect, it } from 'vitest';
import { DEPOT_MODULES, composeApp } from '../src/app/compose';
import { SimRuntime } from '../src/app/runtime';
import { createSimState } from '../src/core/simulation/advance';
import { hashValue } from '../src/core/simulation/hash';
import type { SimModules } from '../src/core/simulation/types';
import { createDepotWorld, isDepotWorld, type DepotWorld } from '../src/core/simulation/world';
import { createEnvelope, serializeEnvelope } from '../src/persistence/envelope';
import { loadState } from '../src/persistence/saveGame';
import { fakePlatform, TestStore } from './helpers';

const config = { tickMs: 1000 };

function makeRuntime(over: { store?: TestStore; modules?: SimModules<DepotWorld>; autosave?: number; locked?: string | null } = {}) {
  const platform = fakePlatform();
  const store = over.store ?? new TestStore();
  const runtime = new SimRuntime<DepotWorld>({
    state: createSimState(5, createDepotWorld()),
    config,
    modules: over.modules ?? DEPOT_MODULES,
    platform,
    store,
    slot: 'main',
    autosaveEveryTicks: over.autosave ?? 3,
    maxTicksPerStep: 10,
    persistenceLockedReason: over.locked ?? null,
  });
  return { runtime, platform, store };
}

const settle = () => new Promise((r) => setTimeout(r, 10));

describe('SimRuntime', () => {
  it('converts real time to whole ticks and advances the simulation', () => {
    const { runtime } = makeRuntime();
    expect(runtime.update(400)).toBe(0);
    expect(runtime.update(700)).toBe(1);
    expect(runtime.state.tick).toBe(1);
    expect(runtime.update(2000)).toBe(2);
    expect(runtime.state.tick).toBe(3);
  });

  it('delivers simulation events to subscribers, and stops after unsubscribe', () => {
    const modules: SimModules<DepotWorld> = { systems: [(ctx) => ctx.emit('beat', { t: ctx.tick })], handlers: {} };
    const { runtime } = makeRuntime({ modules, autosave: 1000 });
    const seen: number[] = [];
    const off = runtime.onEvents((evs) => evs.forEach((e) => seen.push(e.tick)));
    runtime.update(3000);
    off();
    runtime.update(2000);
    expect(seen).toEqual([1, 2, 3]);
  });

  it('autosaves after the configured number of ticks, stamping the platform time', async () => {
    const { runtime, store, platform } = makeRuntime({ autosave: 3 });
    platform.setNow(1_800_000_000_000);
    runtime.update(2000);
    await settle();
    expect(store.writes).toHaveLength(0);
    runtime.update(1000);
    await settle();
    expect(store.writes).toHaveLength(1);
    const loaded = await loadState(store, 'main', isDepotWorld);
    if (!loaded.ok) throw new Error(loaded.error);
    expect(loaded.value.state.tick).toBe(3);
    expect(loaded.value.savedAt).toBe(1_800_000_000_000);
    expect(runtime.saveStatus.lastSavedAt).toBe(1_800_000_000_000);
  });

  it('saves when the app is paused (tab hidden or backgrounded)', async () => {
    const { runtime, store, platform } = makeRuntime({ autosave: 1000 });
    runtime.update(2000);
    platform.emit('pause');
    await settle();
    expect(store.writes).toHaveLength(1);
    platform.emit('resume');
    await settle();
    expect(store.writes).toHaveLength(1);
  });

  it('surfaces a failed save as an error and recovers on the next success', async () => {
    const { runtime, store } = makeRuntime();
    runtime.update(1000);
    store.failWrites = 'QuotaExceededError';
    const bad = await runtime.save();
    expect(!bad.ok && bad.error).toBe('STORAGE_FAILED');
    expect(runtime.saveStatus.lastError).toContain('Quota');
    expect(runtime.saveStatus.lastSavedAt).toBeNull();
    store.failWrites = null;
    const good = await runtime.save();
    expect(good.ok).toBe(true);
    expect(runtime.saveStatus.lastError).toBeNull();
    expect(runtime.saveStatus.lastSavedAt).not.toBeNull();
  });

  it('serialises overlapping saves so older state can never overwrite newer state', async () => {
    const { runtime, store } = makeRuntime({ autosave: 1000 });
    store.writeDelayMs = 20;
    runtime.update(1000);
    const first = runtime.save();
    runtime.update(1000);
    const second = runtime.save();
    await Promise.all([first, second]);
    expect(store.writes).toHaveLength(2);
    const ticks = store.writes.map((w) => (JSON.parse(w.data) as { payload: { tick: number } }).payload.tick);
    expect(ticks).toEqual([1, 2]);
    expect((JSON.parse(store.data.get('main')!) as { payload: { tick: number } }).payload.tick).toBe(2);
  });

  it('never writes while persistence is locked, and says why', async () => {
    const { runtime, store } = makeRuntime({ locked: 'unreadable save', autosave: 1 });
    runtime.update(5000);
    const r = await runtime.save();
    await settle();
    expect(store.writes).toEqual([]);
    expect(!r.ok && r.detail).toBe('unreadable save');
    expect(runtime.saveStatus.lockedReason).toBe('unreadable save');
    expect(runtime.state.tick).toBe(5); // the game itself still runs
  });

  it('caps a huge elapsed time instead of simulating it, and records what was dropped', () => {
    const { runtime } = makeRuntime();
    expect(runtime.update(3_600_000)).toBe(10);
    expect(runtime.totalDroppedMs).toBe(3_590_000);
  });

  it('stops reacting to lifecycle events after dispose', async () => {
    const { runtime, store, platform } = makeRuntime({ autosave: 1000 });
    runtime.update(1000);
    runtime.dispose();
    platform.emit('pause');
    await settle();
    expect(store.writes).toEqual([]);
  });
});

describe('composeApp boot policy', () => {
  it('starts a new game from the platform seed when no save exists', async () => {
    const platform = fakePlatform({ seed: 777 });
    const store = new TestStore();
    const app = await composeApp(platform, store);
    expect(app.boot).toEqual({ kind: 'new' });
    expect(app.runtime.state.rng).toEqual({ s: 777 });
    expect(app.runtime.state.tick).toBe(0);
    expect(platform.seedCalls).toBe(1);
  });

  it('resumes from a save and does not ask for a new seed', async () => {
    const store = new TestStore();
    const first = await composeApp(fakePlatform({ seed: 5 }), store);
    first.runtime.update(4000);
    await first.runtime.save();
    const platform2 = fakePlatform({ seed: 999 });
    const second = await composeApp(platform2, store);
    expect(second.boot.kind).toBe('loaded');
    expect(second.runtime.state.tick).toBe(4);
    expect(hashValue(second.runtime.state)).toBe(hashValue(first.runtime.state));
    expect(platform2.seedCalls).toBe(0);
  });

  it('locks saving and leaves the stored data untouched when the save is corrupt', async () => {
    const store = new TestStore();
    const first = await composeApp(fakePlatform(), store);
    await first.runtime.save();
    const good = store.data.get('main')!;
    const corrupt = good.replace('"tick":0', '"tick":3');
    store.data.set('main', corrupt);
    const app = await composeApp(fakePlatform(), store);
    expect(app.boot.kind).toBe('locked');
    expect(app.runtime.saveStatus.lockedReason).toContain('CHECKSUM_MISMATCH');
    app.runtime.update(60_000);
    await app.runtime.save();
    expect(store.data.get('main')).toBe(corrupt);
  });

  it('locks saving for a save from a newer build instead of overwriting it', async () => {
    const store = new TestStore();
    const newer = serializeEnvelope(createEnvelope({ future: true }, 1, 99));
    store.data.set('main', newer);
    const app = await composeApp(fakePlatform(), store);
    expect(app.boot.kind).toBe('locked');
    expect(app.boot.kind === 'locked' && app.boot.reason).toContain('VERSION_TOO_NEW');
    await app.runtime.save();
    expect(store.data.get('main')).toBe(newer);
  });
});
