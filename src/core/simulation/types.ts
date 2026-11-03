import type { Rng, RngState } from './rng';

/**
 * Simulation kernel types. The kernel is generic over the world `W` so that it stays free of depot rules:
 * departments, yard, economy and workflows are modules plugged in later (Phase 1 P1-07 onward).
 * Worlds and event payloads must be JSON-safe (checked strictly by stableStringify at save time).
 */
export interface SimConfig {
  /** Simulation time per tick in milliseconds. PROVISIONAL placeholder until the Producer sets the time scale (D10). */
  readonly tickMs: number;
}

/** An event that happened. Output of `advance`, consumed by renderer and UI; never re-delivered to handlers. */
export interface SimEvent {
  readonly tick: number;
  /** Strictly increasing across the whole run (and across saves). */
  readonly seq: number;
  readonly type: string;
  readonly payload: unknown;
}

/** A command scheduled for a future tick. Delivered to the handler registered for `type`. */
export interface ScheduledEvent {
  readonly at: number;
  /** Tie-break for events due on the same tick: lower first. Assigned from the shared counter at schedule time. */
  readonly order: number;
  readonly type: string;
  readonly payload: unknown;
}

export interface SimState<W> {
  readonly tick: number;
  /** Shared counter for event seq and scheduled order. */
  readonly seq: number;
  readonly rng: RngState;
  readonly scheduled: readonly ScheduledEvent[];
  readonly world: W;
}

/** What systems and handlers may do. The world is mutable only inside `advance`, on a private copy. */
export interface SimContext<W> {
  readonly tick: number;
  readonly config: SimConfig;
  readonly rng: Rng;
  readonly world: W;
  /** Record that something happened (appended to the output events). */
  emit(type: string, payload?: unknown): void;
  /** Deliver `type` to its handler after `delayTicks` (an integer >= 1) ticks. */
  schedule(delayTicks: number, type: string, payload?: unknown): void;
}

export type System<W> = (ctx: SimContext<W>) => void;
export type EventHandler<W> = (ctx: SimContext<W>, event: SimEvent) => void;

export interface SimModules<W> {
  /** Run once per tick, in this order, after due scheduled events are delivered. */
  readonly systems: readonly System<W>[];
  readonly handlers: Readonly<Record<string, EventHandler<W>>>;
}

export interface AdvanceResult<W> {
  readonly state: SimState<W>;
  readonly events: readonly SimEvent[];
}
