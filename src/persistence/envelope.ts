import { hashValue, stableStringify } from '../core/simulation/hash';

/**
 * Versioned save envelope and migration foundation.
 *
 * Rules:
 *  - Every change to the saved payload shape bumps CURRENT_SAVE_VERSION and adds a migration `N -> N+1`.
 *  - A frozen sample of every released version stays in tests/fixtures and must keep loading forever.
 *  - A save from a NEWER version than this build is refused and never overwritten.
 *  - The checksum detects accidental corruption (truncated write, hand edit). It is not tamper protection:
 *    the client is untrusted, and real anti-cheat is server-side (docs/TECHNICAL_ARCHITECTURE.md section 4).
 */
export const SAVE_FORMAT = 'idle-depot-save';
export const CURRENT_SAVE_VERSION = 1;

export interface SaveEnvelope {
  readonly format: typeof SAVE_FORMAT;
  readonly version: number;
  /** Wall-clock ms when saved, supplied by the platform adapter. Informational; never used for rewards. */
  readonly savedAt: number;
  /** hashValue(payload) at this envelope's version. */
  readonly checksum: string;
  readonly payload: unknown;
}

/** Key `v` holds the migration from version v to v+1. */
export type Migration = (payload: unknown) => unknown;
export type Migrations = Readonly<Record<number, Migration>>;

/** No migrations exist yet: version 1 is the first released format. */
export const MIGRATIONS: Migrations = {};

export type SaveError =
  | 'INVALID_JSON'
  | 'NOT_A_SAVE'
  | 'CHECKSUM_MISMATCH'
  | 'VERSION_TOO_NEW'
  | 'INVALID_VERSION'
  | 'MIGRATION_MISSING'
  | 'MIGRATION_FAILED'
  | 'INVALID_PAYLOAD'
  | 'STORAGE_FAILED'
  | 'NO_SAVE';

export type Outcome<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: SaveError; readonly detail?: string };

export const ok = <T>(value: T): Outcome<T> => ({ ok: true, value });
export const fail = <T = never>(error: SaveError, detail?: string): Outcome<T> =>
  detail === undefined ? { ok: false, error } : { ok: false, error, detail };

export interface MigrationOptions {
  readonly currentVersion?: number;
  readonly migrations?: Migrations;
}

export function createEnvelope(payload: unknown, savedAt: number, version: number = CURRENT_SAVE_VERSION): SaveEnvelope {
  return { format: SAVE_FORMAT, version, savedAt, checksum: hashValue(payload), payload };
}

/** Throws TypeError (from stableStringify) if the payload is not strictly JSON-safe, so bad data never reaches storage. */
export function serializeEnvelope(envelope: SaveEnvelope): string {
  return stableStringify(envelope);
}

export interface ParsedSave {
  /** Envelope upgraded to the current version, with a fresh checksum. */
  readonly envelope: SaveEnvelope;
  readonly migratedFrom: number;
}

export function parseEnvelope(raw: string, options: MigrationOptions = {}): Outcome<ParsedSave> {
  const currentVersion = options.currentVersion ?? CURRENT_SAVE_VERSION;
  const migrations = options.migrations ?? MIGRATIONS;

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return fail('INVALID_JSON');
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return fail('NOT_A_SAVE');
  const e = data as Record<string, unknown>;
  if (e['format'] !== SAVE_FORMAT || typeof e['checksum'] !== 'string' || typeof e['savedAt'] !== 'number' || !('payload' in e)) {
    return fail('NOT_A_SAVE');
  }
  const version = e['version'];
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) return fail('INVALID_VERSION');
  if (version > currentVersion) return fail('VERSION_TOO_NEW', `save v${version}, build supports up to v${currentVersion}`);

  let actual: string;
  try {
    actual = hashValue(e['payload']);
  } catch {
    return fail('NOT_A_SAVE');
  }
  if (actual !== e['checksum']) return fail('CHECKSUM_MISMATCH');

  let payload = e['payload'];
  for (let v = version; v < currentVersion; v++) {
    const migrate = migrations[v];
    if (migrate === undefined) return fail('MIGRATION_MISSING', `no migration from v${v} to v${v + 1}`);
    try {
      payload = migrate(payload);
    } catch (err) {
      return fail('MIGRATION_FAILED', `v${v} -> v${v + 1}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return ok({ envelope: createEnvelope(payload, e['savedAt'], currentVersion), migratedFrom: version });
}
