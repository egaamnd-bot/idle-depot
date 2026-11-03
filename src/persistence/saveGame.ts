import type { SimState } from '../core/simulation/types';
import { isSimState } from '../core/simulation/validate';
import {
  createEnvelope,
  fail,
  ok,
  parseEnvelope,
  serializeEnvelope,
  type MigrationOptions,
  type Outcome,
} from './envelope';
import type { SaveStore } from './store';

export const DEFAULT_SLOT = 'main';

/** Saves a simulation state. Never throws: failures come back as values so callers cannot report a fake success. */
export async function saveState<W>(
  store: SaveStore,
  slot: string,
  state: SimState<W>,
  savedAt: number,
): Promise<Outcome<void>> {
  let raw: string;
  try {
    raw = serializeEnvelope(createEnvelope(state, savedAt));
  } catch (e) {
    return fail('INVALID_PAYLOAD', e instanceof Error ? e.message : String(e));
  }
  try {
    await store.write(slot, raw);
  } catch (e) {
    return fail('STORAGE_FAILED', e instanceof Error ? e.message : String(e));
  }
  return ok(undefined);
}

export interface LoadedGame<W> {
  readonly state: SimState<W>;
  readonly savedAt: number;
  readonly migratedFrom: number;
}

/**
 * Loads, verifies and migrates a save. `NO_SAVE` means the slot is empty (a normal first run). Any other error
 * means a save exists but was not loaded; callers must not overwrite it (see SimRuntime.persistenceLocked).
 */
export async function loadState<W>(
  store: SaveStore,
  slot: string,
  isWorld: (w: unknown) => w is W,
  options: MigrationOptions = {},
): Promise<Outcome<LoadedGame<W>>> {
  let raw: string | null;
  try {
    raw = await store.read(slot);
  } catch (e) {
    return fail('STORAGE_FAILED', e instanceof Error ? e.message : String(e));
  }
  if (raw === null) return fail('NO_SAVE');

  const parsed = parseEnvelope(raw, options);
  if (!parsed.ok) return parsed;
  const { envelope, migratedFrom } = parsed.value;
  if (!isSimState(envelope.payload, isWorld)) return fail('INVALID_PAYLOAD');
  return ok({ state: envelope.payload, savedAt: envelope.savedAt, migratedFrom });
}
