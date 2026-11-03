import type { SimConfig } from '../core/simulation/types';

/**
 * Simulation configuration. Values are PROVISIONAL placeholders, not balance decisions:
 * the real time scale is Producer decision D10, and nothing here is an economy value.
 */
export const SIM_CONFIG: SimConfig = {
  tickMs: 1000,
};

/** Autosave roughly every this many ticks while running. */
export const AUTOSAVE_EVERY_TICKS = 30;

/** Largest burst of ticks run in one frame; anything beyond is dropped rather than letting the game spiral. */
export const MAX_TICKS_PER_STEP = 20;

export const SAVE_SLOT = 'main';
