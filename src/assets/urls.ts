import { ASSET_BY_ID, ASSETS, type AssetEntry } from './manifest';

/**
 * Resolves registry paths to URLs through Vite, so the same registry works on web, Telegram and Capacitor builds
 * (hashed, relative-base URLs). Concept art under assets/concept is deliberately not matched: it is an art-direction
 * document, never loaded by the game.
 */
const found = import.meta.glob('../../assets/{sprites,tiles,ui,audio}/**/*.{svg,wav}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const byPath = new Map<string, string>();
for (const [key, url] of Object.entries(found)) {
  byPath.set(key.replace('../../assets/', ''), url);
}

export function assetUrl(entry: AssetEntry): string {
  const url = byPath.get(entry.path);
  if (url === undefined) throw new Error(`Asset "${entry.id}" is registered but its file is missing: assets/${entry.path}`);
  return url;
}

export function assetUrlById(id: string): string {
  const entry = ASSET_BY_ID.get(id);
  if (entry === undefined) throw new Error(`Unknown asset id "${id}"`);
  return assetUrl(entry);
}

/** Registry entries with no resolvable file. Empty in a healthy build; asserted in tests. */
export function missingAssets(): AssetEntry[] {
  return ASSETS.filter((a) => !byPath.has(a.path));
}
