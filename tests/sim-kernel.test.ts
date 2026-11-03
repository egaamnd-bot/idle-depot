import { describe, expect, it } from 'vitest';
import { advance, createSimState, simTimeMs } from '../src/core/simulation/advance';
import { hashValue, stableStringify } from '../src/core/simulation/hash';
import { Rng, createRngState } from '../src/core/simulation/rng';
import { FixedStepper } from '../src/core/simulation/stepper';
import type { SimConfig, SimModules, SimState } from '../src/core/simulation/types';
import { isSimState } from '../src/core/simulation/validate';

/** A tiny test-only world: arrivals use the RNG and schedule a follow-up. Not depot rules. */
interface TestWorld {
  arrived: number;
  surveyed: number;
  trail: number[];
}
const isTestWorld = (w: unknown): w is TestWorld =>
  typeof w === 'object' && w !== null && 'arrived' in w && 'surveyed' in w && 'trail' in w;

const config: SimConfig = { tickMs: 1000 };

const modules: SimModules<TestWorld> = {
  systems: [
    (ctx) => {
      if (ctx.rng.chance(0.4)) {
        ctx.world.arrived += 1;
        ctx.emit('arrival', { n: ctx.world.arrived });
        ctx.schedule(ctx.rng.range(2, 6), 'survey', { n: ctx.world.arrived });
      }
    },
  ],
  handlers: {
    survey: (ctx, event) => {
      ctx.world.surveyed += 1;
      ctx.world.trail.push(event.tick);
    },
  },
};

const fresh = (seed = 42): SimState<TestWorld> => createSimState(seed, { arrived: 0, surveyed: 0, trail: [] });

describe('rng', () => {
  it('matches an independent mulberry32 reference implementation', () => {
    const r1 = new Rng(createRngState(1));
    expect([r1.next(), r1.next(), r1.next(), r1.next()]).toEqual([
      0.6270739405881613, 0.002735721180215478, 0.5274470399599522, 0.9810509674716741,
    ]);
    const r2 = new Rng(createRngState(12345));
    expect([r2.next(), r2.next(), r2.next(), r2.next()]).toEqual([
      0.9797282677609473, 0.3067522644996643, 0.484205421525985, 0.817934412509203,
    ]);
  });

  it('is repeatable per seed and differs across seeds', () => {
    const seq = (seed: number) => {
      const r = new Rng(createRngState(seed));
      return Array.from({ length: 20 }, () => r.next());
    };
    expect(seq(7)).toEqual(seq(7));
    expect(seq(7)).not.toEqual(seq(8));
  });

  it('continues the same sequence after its state is saved and restored', () => {
    const a = new Rng(createRngState(99));
    for (let i = 0; i < 17; i++) a.next();
    const restored = new Rng(JSON.parse(JSON.stringify(a.state())) as { s: number });
    expect(Array.from({ length: 10 }, () => restored.next())).toEqual(Array.from({ length: 10 }, () => a.next()));
  });

  it('keeps outputs within bounds and covers the range', () => {
    const r = new Rng(createRngState(5));
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const f = r.next();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = r.range(3, 7);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(7);
      seen.add(n);
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6, 7]);
  });

  it('rejects invalid arguments and states', () => {
    const r = new Rng(createRngState(1));
    expect(() => r.int(0)).toThrow(RangeError);
    expect(() => r.int(1.5)).toThrow(RangeError);
    expect(() => r.range(5, 4)).toThrow(RangeError);
    expect(() => r.chance(1.1)).toThrow(RangeError);
    expect(() => r.pick([])).toThrow(RangeError);
    expect(() => createRngState(NaN)).toThrow(RangeError);
    expect(() => new Rng({ s: -1 })).toThrow(RangeError);
    expect(() => new Rng({ s: 2 ** 32 })).toThrow(RangeError);
  });

  it('normalises seeds to uint32', () => {
    expect(createRngState(-1).s).toBe(0xffffffff);
    expect(createRngState(2 ** 32 + 5).s).toBe(5);
  });
});

describe('fixed stepper', () => {
  it('turns elapsed time into whole ticks and carries the remainder', () => {
    const s = new FixedStepper(1000, 10);
    expect(s.step(400).ticks).toBe(0);
    expect(s.step(700).ticks).toBe(1);
    expect(s.pendingMs).toBeCloseTo(100);
    expect(s.step(2900).ticks).toBe(3);
  });

  it('gives the same total ticks however integer-millisecond time is sliced into frames', () => {
    const total = (slices: number[]) => {
      const s = new FixedStepper(250, 1000);
      return slices.reduce((n, ms) => n + s.step(ms).ticks, 0);
    };
    const oneShot = total([10000]);
    expect(oneShot).toBe(40);
    expect(total(Array.from({ length: 625 }, () => 16))).toBe(oneShot);
    expect(total([1, 999, 4000, 5000])).toBe(oneShot);
  });

  it('conserves time for fractional frame deltas (may differ by one tick at a boundary, never loses time)', () => {
    const s = new FixedStepper(250, 1000);
    let ticks = 0;
    let elapsed = 0;
    for (let i = 0; i < 600; i++) {
      const dt = 10000 / 600;
      elapsed += dt;
      ticks += s.step(dt).ticks;
    }
    expect(ticks * 250 + s.pendingMs).toBeCloseTo(elapsed, 6);
    expect(Math.abs(ticks - 40)).toBeLessThanOrEqual(1);
  });

  it('caps catch-up and reports dropped time instead of spiralling', () => {
    const s = new FixedStepper(1000, 5);
    const r = s.step(60_000);
    expect(r.ticks).toBe(5);
    expect(r.droppedMs).toBe(55_000);
    expect(s.pendingMs).toBe(0);
  });

  it('treats negative, NaN and infinite elapsed time as zero', () => {
    const s = new FixedStepper(1000, 5);
    for (const bad of [-500, NaN, Infinity, -Infinity]) expect(s.step(bad)).toEqual({ ticks: 0, droppedMs: 0 });
  });

  it('rejects invalid construction', () => {
    expect(() => new FixedStepper(0, 5)).toThrow(RangeError);
    expect(() => new FixedStepper(1000, 0)).toThrow(RangeError);
  });
});

describe('stable stringify and hashing', () => {
  it('is independent of key order', () => {
    expect(stableStringify({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe(stableStringify({ a: [2, { c: 2, d: 1 }], b: 1 }));
  });

  it('rejects values that would not survive JSON', () => {
    for (const bad of [{ a: undefined }, { a: NaN }, { a: Infinity }, new Map(), new Date(0), { f: () => 1 }, 1n]) {
      expect(() => stableStringify(bad)).toThrow(TypeError);
    }
  });

  it('changes when any value changes', () => {
    expect(hashValue({ a: 1 })).not.toBe(hashValue({ a: 2 }));
    expect(hashValue({ a: 1 })).toBe(hashValue({ a: 1 }));
  });
});

describe('advance: determinism', () => {
  it('produces identical state and events for the same seed', () => {
    const a = advance(fresh(), config, modules, 200);
    const b = advance(fresh(), config, modules, 200);
    expect(hashValue(a.state)).toBe(hashValue(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('differs for a different seed', () => {
    expect(hashValue(advance(fresh(1), config, modules, 200).state)).not.toBe(
      hashValue(advance(fresh(2), config, modules, 200).state),
    );
  });

  it('matches a pinned golden result (update only for an intentional behaviour change)', () => {
    const r = advance(fresh(42), config, modules, 300);
    expect({ tick: r.state.tick, arrived: r.state.world.arrived, surveyed: r.state.world.surveyed, events: r.events.length }).toEqual(
      GOLDEN_SUMMARY,
    );
    expect(hashValue(r.state)).toBe(GOLDEN_HASH);
  });

  it('advancing in pieces equals advancing all at once (split invariance)', () => {
    const whole = advance(fresh(), config, modules, 150);
    let state = fresh();
    const events: unknown[] = [];
    for (const n of [1, 7, 0, 42, 100]) {
      const r = advance(state, config, modules, n);
      state = r.state;
      events.push(...r.events);
    }
    expect(state.tick).toBe(150);
    expect(hashValue(state)).toBe(hashValue(whole.state));
    expect(events).toEqual(whole.events);
  });

  it('never mutates its input', () => {
    const input = fresh();
    const before = stableStringify(input);
    advance(input, config, modules, 50);
    expect(stableStringify(input)).toBe(before);
  });

  it('advancing zero ticks returns an equal state and no events', () => {
    const input = fresh();
    const r = advance(input, config, modules, 0);
    expect(r.events).toEqual([]);
    expect(hashValue(r.state)).toBe(hashValue(input));
  });
});

describe('advance: event processing', () => {
  const r = advance(fresh(), config, modules, 300);

  it('numbers events with a strictly increasing seq and non-decreasing tick', () => {
    for (let i = 1; i < r.events.length; i++) {
      const prev = r.events[i - 1]!;
      const cur = r.events[i]!;
      expect(cur.seq).toBeGreaterThan(prev.seq);
      expect(cur.tick).toBeGreaterThanOrEqual(prev.tick);
    }
  });

  it('delivers every scheduled command on its due tick or later, never early', () => {
    const arrivals = r.events.filter((e) => e.type === 'arrival');
    const surveys = r.events.filter((e) => e.type === 'survey');
    expect(surveys.length).toBeGreaterThan(0);
    for (const s of surveys) {
      const n = (s.payload as { n: number }).n;
      const arrival = arrivals.find((a) => (a.payload as { n: number }).n === n)!;
      expect(s.tick - arrival.tick).toBeGreaterThanOrEqual(2);
      expect(s.tick - arrival.tick).toBeLessThanOrEqual(6);
    }
    // Everything arrived is either surveyed or still pending in the schedule.
    expect(r.state.world.arrived).toBe(r.state.world.surveyed + r.state.scheduled.length);
  });

  it('breaks same-tick ties by schedule order, and keeps order across calls', () => {
    const order: string[] = [];
    const m: SimModules<{ x: number }> = {
      systems: [
        (ctx) => {
          if (ctx.tick === 1) {
            ctx.schedule(3, 'a');
            ctx.schedule(3, 'b');
            ctx.schedule(2, 'c');
            ctx.schedule(3, 'd');
          }
        },
      ],
      handlers: { a: () => order.push('a'), b: () => order.push('b'), c: () => order.push('c'), d: () => order.push('d') },
    };
    const s0 = createSimState(1, { x: 0 });
    const first = advance(s0, config, m, 1);
    const second = advance(first.state, config, m, 5);
    expect(order).toEqual(['c', 'a', 'b', 'd']);
    expect(second.events.map((e) => e.type)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('orders same-tick events by their order number even when a loaded state lists them out of order', () => {
    const seen: string[] = [];
    const m: SimModules<{ x: number }> = {
      systems: [],
      handlers: { a: () => seen.push('a'), b: () => seen.push('b'), c: () => seen.push('c') },
    };
    const s = {
      ...createSimState(1, { x: 0 }),
      seq: 9,
      scheduled: [
        { at: 2, order: 5, type: 'b', payload: null },
        { at: 3, order: 0, type: 'c', payload: null },
        { at: 2, order: 1, type: 'a', payload: null },
      ],
    };
    advance(s, config, m, 3);
    expect(seen).toEqual(['a', 'b', 'c']);
  });

  it('lets handlers schedule further work, which lands on a later tick', () => {
    const m: SimModules<{ x: number }> = {
      systems: [(ctx) => ctx.tick === 1 && ctx.schedule(1, 'ping')],
      handlers: { ping: (ctx, e) => e.tick < 4 && ctx.schedule(1, 'ping') },
    };
    const out = advance(createSimState(1, { x: 0 }), config, m, 10);
    expect(out.events.map((e) => e.tick)).toEqual([2, 3, 4]);
    expect(out.state.scheduled).toEqual([]);
  });

  it('throws on a scheduled event with no handler instead of dropping it', () => {
    const m: SimModules<{ x: number }> = { systems: [(ctx) => ctx.tick === 1 && ctx.schedule(1, 'ghost')], handlers: {} };
    expect(() => advance(createSimState(1, { x: 0 }), config, m, 3)).toThrow(/ghost/);
  });

  it('rejects invalid tick counts and invalid delays', () => {
    for (const bad of [-1, 1.5, NaN, Infinity]) {
      expect(() => advance(fresh(), config, modules, bad)).toThrow(RangeError);
    }
    const m: SimModules<{ x: number }> = { systems: [(ctx) => ctx.schedule(0, 'x')], handlers: { x: () => undefined } };
    expect(() => advance(createSimState(1, { x: 0 }), config, m, 1)).toThrow(RangeError);
  });

  it('reports simulation time from the tick counter only', () => {
    expect(simTimeMs(r.state, config)).toBe(300_000);
  });
});

describe('state validation', () => {
  it('accepts a real state and rejects malformed ones', () => {
    const good = JSON.parse(JSON.stringify(fresh())) as unknown;
    expect(isSimState(good, isTestWorld)).toBe(true);
    const bad: unknown[] = [
      null, 1, [], {},
      { ...(good as object), tick: -1 },
      { ...(good as object), tick: 1.5 },
      { ...(good as object), rng: { s: 2 ** 32 } },
      { ...(good as object), scheduled: [{ at: 1, order: 0 }] },
      { ...(good as object), world: 'nope' },
    ];
    for (const b of bad) expect(isSimState(b, isTestWorld)).toBe(false);
  });
});

// Seed 42, 300 ticks. Counts were cross-checked against an independent Python re-implementation of the same toy
// simulation (112 arrived, 110 surveyed, 222 events, 2 pending, seq 334); the hash pins the exact state.
const GOLDEN_SUMMARY = { tick: 300, arrived: 112, surveyed: 110, events: 222 };
const GOLDEN_HASH = '21356c4f';
