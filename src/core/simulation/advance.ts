import { Rng, createRngState } from './rng';
import type {
  AdvanceResult,
  ScheduledEvent,
  SimConfig,
  SimContext,
  SimEvent,
  SimModules,
  SimState,
} from './types';

export function createSimState<W>(seed: number, world: W): SimState<W> {
  return { tick: 0, seq: 0, rng: createRngState(seed), scheduled: [], world };
}

/** Simulation time in ms for a state. Pure function of the tick counter, never of a clock. */
export function simTimeMs<W>(state: SimState<W>, config: SimConfig): number {
  return state.tick * config.tickMs;
}

/**
 * Advances the simulation by `ticks` fixed steps. Deterministic: the same state, modules and tick count always give
 * the same result, and advancing by a then b equals advancing by a+b. The input state is never modified: work happens
 * on a deep copy, so callers keep immutable snapshots (undo, comparison, saves).
 *
 * Per tick, in order:
 *  1. tick counter increments;
 *  2. scheduled events due on or before this tick are delivered, sorted by (at, order), to their handlers;
 *  3. systems run in array order.
 * Events scheduled during a tick land on a later tick (delay >= 1), so a tick always terminates.
 *
 * Programmer errors throw (unknown event type, bad tick count, non-integer delay). They are never swallowed.
 */
export function advance<W>(
  input: SimState<W>,
  config: SimConfig,
  modules: SimModules<W>,
  ticks: number,
): AdvanceResult<W> {
  if (!Number.isInteger(ticks) || ticks < 0) throw new RangeError(`ticks must be a non-negative integer, got ${ticks}`);

  const work = structuredClone(input) as {
    tick: number;
    seq: number;
    rng: { s: number };
    scheduled: ScheduledEvent[];
    world: W;
  };
  const rng = new Rng(work.rng);
  const events: SimEvent[] = [];
  work.scheduled.sort(compareScheduled);

  const ctx: SimContext<W> = {
    get tick() {
      return work.tick;
    },
    config,
    rng,
    world: work.world,
    emit(type, payload) {
      events.push({ tick: work.tick, seq: work.seq++, type, payload: payload ?? null });
    },
    schedule(delayTicks, type, payload) {
      if (!Number.isInteger(delayTicks) || delayTicks < 1) {
        throw new RangeError(`delayTicks must be an integer >= 1, got ${delayTicks}`);
      }
      insertSorted(work.scheduled, { at: work.tick + delayTicks, order: work.seq++, type, payload: payload ?? null });
    },
  };

  for (let i = 0; i < ticks; i++) {
    work.tick += 1;
    while (work.scheduled.length > 0 && (work.scheduled[0] as ScheduledEvent).at <= work.tick) {
      const due = work.scheduled.shift() as ScheduledEvent;
      const handler = modules.handlers[due.type];
      if (handler === undefined) throw new Error(`No handler registered for scheduled event "${due.type}"`);
      const event: SimEvent = { tick: work.tick, seq: work.seq++, type: due.type, payload: due.payload };
      events.push(event);
      handler(ctx, event);
    }
    for (const system of modules.systems) system(ctx);
  }

  return {
    state: { tick: work.tick, seq: work.seq, rng: rng.state(), scheduled: work.scheduled, world: work.world },
    events,
  };
}

function compareScheduled(a: ScheduledEvent, b: ScheduledEvent): number {
  return a.at - b.at || a.order - b.order;
}

function insertSorted(list: ScheduledEvent[], item: ScheduledEvent): void {
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (compareScheduled(list[mid] as ScheduledEvent, item) <= 0) lo = mid + 1;
    else hi = mid;
  }
  list.splice(lo, 0, item);
}
