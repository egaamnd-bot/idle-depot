import { createSimState } from '../core/simulation/advance';
import type { SimModules } from '../core/simulation/types';
import { createDepotWorld, isDepotWorld, type DepotWorld } from '../core/simulation/world';
import { AUTOSAVE_EVERY_TICKS, MAX_TICKS_PER_STEP, SAVE_SLOT, SIM_CONFIG } from '../config/sim';
import { loadState } from '../persistence/saveGame';
import { StorageSaveStore, type SaveStore } from '../persistence/store';
import type { PlatformAdapter } from '../platform/types';
import { SimRuntime } from './runtime';

/** No departments or systems are plugged in yet: they wait for the Producer's operational rules (D1-D15). */
export const DEPOT_MODULES: SimModules<DepotWorld> = { systems: [], handlers: {} };

export type BootReport =
  | { readonly kind: 'new' }
  | { readonly kind: 'loaded'; readonly migratedFrom: number; readonly savedAt: number }
  | { readonly kind: 'locked'; readonly reason: string };

export interface App {
  readonly runtime: SimRuntime<DepotWorld>;
  readonly boot: BootReport;
  readonly platform: PlatformAdapter;
}

/**
 * Composition root: the one place that wires platform, persistence, config and the simulation together.
 * Core knows nothing about any of them.
 *
 * Boot policy:
 *  - slot empty            -> new game from a platform-provided seed;
 *  - slot loads           -> resume (migrating older versions);
 *  - slot exists but fails -> run a new game IN MEMORY with saving locked, so the unreadable save is never overwritten.
 */
export async function composeApp(
  platform: PlatformAdapter,
  store: SaveStore = new StorageSaveStore(platform.storage),
): Promise<App> {
  const loaded = await loadState(store, SAVE_SLOT, isDepotWorld);

  let state;
  let boot: BootReport;
  let lockedReason: string | null = null;

  if (loaded.ok) {
    state = loaded.value.state;
    boot = { kind: 'loaded', migratedFrom: loaded.value.migratedFrom, savedAt: loaded.value.savedAt };
  } else if (loaded.error === 'NO_SAVE') {
    state = createSimState(platform.randomSeed(), createDepotWorld());
    boot = { kind: 'new' };
  } else {
    lockedReason = `A saved game exists but could not be loaded (${loaded.error}${loaded.detail ? `: ${loaded.detail}` : ''}). Saving is disabled so it is not overwritten.`;
    state = createSimState(platform.randomSeed(), createDepotWorld());
    boot = { kind: 'locked', reason: lockedReason };
  }

  const runtime = new SimRuntime<DepotWorld>({
    state,
    config: SIM_CONFIG,
    modules: DEPOT_MODULES,
    platform,
    store,
    slot: SAVE_SLOT,
    autosaveEveryTicks: AUTOSAVE_EVERY_TICKS,
    maxTicksPerStep: MAX_TICKS_PER_STEP,
    persistenceLockedReason: lockedReason,
  });
  return { runtime, boot, platform };
}
