import { describe, expect, it } from 'vitest';
import { CargoStatus, OperationalStatus, PhysicalCondition } from '../src/core/container/types';

describe('container status axes', () => {
  it('keeps cargo status limited to EMPTY and LADEN', () => {
    expect(Object.values(CargoStatus).sort()).toEqual(['EMPTY', 'LADEN']);
  });

  it('keeps the three axes as disjoint-purpose value sets', () => {
    const cargo = new Set<string>(Object.values(CargoStatus));
    const operational = new Set<string>(Object.values(OperationalStatus));
    const condition = new Set<string>(Object.values(PhysicalCondition));
    for (const v of cargo) {
      expect(operational.has(v)).toBe(false);
      expect(condition.has(v)).toBe(false);
    }
  });
});
