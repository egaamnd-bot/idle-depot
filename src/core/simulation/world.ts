import type { Container } from '../container/container';

/**
 * Minimal depot world for the foundation. Deliberately holds only containers: yard layout, departments and economy
 * are not hardened yet (open Producer decisions D1-D15) and will be added as separate, configurable modules.
 */
export interface DepotWorld {
  readonly containers: Readonly<Record<string, Container>>;
}

export function createDepotWorld(): DepotWorld {
  return { containers: {} };
}

export function isDepotWorld(value: unknown): value is DepotWorld {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const c = (value as { containers?: unknown }).containers;
  return typeof c === 'object' && c !== null && !Array.isArray(c);
}
