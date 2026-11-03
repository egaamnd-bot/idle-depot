/**
 * Converts real elapsed time into whole simulation ticks (fixed timestep with accumulator).
 * It never reads a clock: the caller supplies elapsed milliseconds. The simulation itself only ever sees ticks,
 * so frame rate cannot change outcomes. Integer-millisecond input gives the same tick count however it is sliced into
 * frames. Fractional deltas (for example from a smoothed render loop) may land one tick earlier or later at a boundary
 * through floating-point rounding, but no time is ever lost: ticks * tickMs + pendingMs equals total elapsed time.
 */
export interface StepResult {
  readonly ticks: number;
  /** Real time discarded because it exceeded maxTicksPerStep (spiral-of-death guard). */
  readonly droppedMs: number;
}

export class FixedStepper {
  private accumulatorMs = 0;

  constructor(
    private readonly tickMs: number,
    private readonly maxTicksPerStep: number,
  ) {
    if (!(tickMs > 0) || !Number.isFinite(tickMs)) throw new RangeError('tickMs must be a positive number');
    if (!Number.isInteger(maxTicksPerStep) || maxTicksPerStep < 1) {
      throw new RangeError('maxTicksPerStep must be a positive integer');
    }
  }

  /** Non-finite or negative elapsed values (clock jumped back, paused tab) count as zero. */
  step(elapsedMs: number): StepResult {
    if (Number.isFinite(elapsedMs) && elapsedMs > 0) this.accumulatorMs += elapsedMs;
    const due = Math.floor(this.accumulatorMs / this.tickMs);
    if (due <= this.maxTicksPerStep) {
      this.accumulatorMs -= due * this.tickMs;
      return { ticks: due, droppedMs: 0 };
    }
    const droppedMs = this.accumulatorMs - this.maxTicksPerStep * this.tickMs;
    this.accumulatorMs = 0;
    return { ticks: this.maxTicksPerStep, droppedMs };
  }

  get pendingMs(): number {
    return this.accumulatorMs;
  }
}
