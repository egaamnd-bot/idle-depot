import { advance } from '../core/simulation/advance';
import { FixedStepper } from '../core/simulation/stepper';
import type { SimConfig, SimEvent, SimModules, SimState } from '../core/simulation/types';
import { fail, ok, type Outcome } from '../persistence/envelope';
import { saveState } from '../persistence/saveGame';
import type { SaveStore } from '../persistence/store';
import type { PlatformAdapter } from '../platform/types';

export interface RuntimeOptions<W> {
  readonly state: SimState<W>;
  readonly config: SimConfig;
  readonly modules: SimModules<W>;
  readonly platform: PlatformAdapter;
  readonly store: SaveStore;
  readonly slot: string;
  readonly autosaveEveryTicks: number;
  readonly maxTicksPerStep: number;
  /**
   * When set, a save exists that could not be loaded (corrupt, from a newer build, failed migration). Autosave is
   * disabled so that save is never overwritten; the string says why. The game still runs in memory.
   */
  readonly persistenceLockedReason?: string | null;
}

export interface SaveStatus {
  readonly lastSavedAt: number | null;
  readonly lastError: string | null;
  readonly lockedReason: string | null;
}

type EventListener = (events: readonly SimEvent[]) => void;

/**
 * Drives the simulation from real time and keeps saves. This is the only place where wall-clock time, the stepper,
 * the pure simulation kernel and persistence meet. Rendering and UI read `state` and subscribe to events; they never
 * mutate it.
 */
export class SimRuntime<W> {
  private current: SimState<W>;
  private readonly stepper: FixedStepper;
  private readonly listeners = new Set<EventListener>();
  private readonly unsubscribeLifecycle: () => void;
  private lastSavedTick: number;
  private saveChain: Promise<unknown> = Promise.resolve();
  private status: SaveStatus;
  private droppedMs = 0;

  constructor(private readonly opts: RuntimeOptions<W>) {
    this.current = opts.state;
    this.lastSavedTick = opts.state.tick;
    this.stepper = new FixedStepper(opts.config.tickMs, opts.maxTicksPerStep);
    this.status = { lastSavedAt: null, lastError: null, lockedReason: opts.persistenceLockedReason ?? null };
    this.unsubscribeLifecycle = opts.platform.onLifecycle((e) => {
      if (e === 'pause') void this.save();
    });
  }

  get state(): SimState<W> {
    return this.current;
  }

  get saveStatus(): SaveStatus {
    return this.status;
  }

  /** Real time dropped by the catch-up cap since start (diagnostic). */
  get totalDroppedMs(): number {
    return this.droppedMs;
  }

  onEvents(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Call every frame with the real milliseconds since the previous call. Returns ticks simulated. */
  update(deltaMs: number): number {
    const { ticks, droppedMs } = this.stepper.step(deltaMs);
    this.droppedMs += droppedMs;
    if (ticks === 0) return 0;
    const result = advance(this.current, this.opts.config, this.opts.modules, ticks);
    this.current = result.state;
    if (result.events.length > 0) for (const l of this.listeners) l(result.events);
    if (this.current.tick - this.lastSavedTick >= this.opts.autosaveEveryTicks) void this.save();
    return ticks;
  }

  /** Saves the current state now. Saves are serialised so two writes never interleave. Failures are reported, not hidden. */
  save(): Promise<Outcome<void>> {
    const snapshot = this.current;
    const run = async (): Promise<Outcome<void>> => {
      if (this.status.lockedReason !== null) return fail('STORAGE_FAILED', this.status.lockedReason);
      const at = this.opts.platform.now();
      const result = await saveState(this.opts.store, this.opts.slot, snapshot, at);
      if (result.ok) {
        this.lastSavedTick = snapshot.tick;
        this.status = { ...this.status, lastSavedAt: at, lastError: null };
        return ok(undefined);
      }
      this.status = { ...this.status, lastError: result.detail ?? result.error };
      return result;
    };
    const next = this.saveChain.then(run, run);
    this.saveChain = next;
    return next;
  }

  dispose(): void {
    this.unsubscribeLifecycle();
    this.listeners.clear();
  }
}
