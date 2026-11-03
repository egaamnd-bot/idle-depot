import { CargoStatus, ContainerSize, PhysicalCondition } from '../core/container/types';

/**
 * Central asset registry. Gameplay and rendering code refer to logical IDs only, never to file paths.
 * Replacing artwork means replacing the file (or editing one line here), not touching game logic.
 * Logical IDs are the file stems from Asset Pack v1.1, so ChatGPT's naming is preserved.
 */

export type AssetKind = 'svg' | 'audio';
/** `starter` = Asset Pack v1.1 placeholder art awaiting ChatGPT's production replacement (docs/ART_FOLLOWUPS.md). */
export type AssetStatus = 'starter' | 'production';
export type AssetGroup =
  | 'container'
  | 'vehicle'
  | 'building'
  | 'worker'
  | 'environment'
  | 'tile'
  | 'ui-icon'
  | 'ui-panel'
  | 'ui-logo'
  | 'music'
  | 'sfx';

export interface AssetEntry {
  readonly id: string;
  readonly kind: AssetKind;
  readonly group: AssetGroup;
  /** Path relative to the repository `assets/` folder. */
  readonly path: string;
  /**
   * True while the starter SVG still has dynamic text drawn into the artwork. The game must not show baked
   * labels; see docs/ASSET_SPECIFICATION.md "Known pack defects". Cleared when ChatGPT delivers clean files.
   */
  readonly hasBakedText: boolean;
  readonly status: AssetStatus;
}

function svg(group: AssetGroup, dir: string, stems: readonly string[], hasBakedText: boolean): AssetEntry[] {
  return stems.map((id) => ({ id, kind: 'svg', group, path: `${dir}/${id}.svg`, hasBakedText, status: 'starter' }));
}

function audio(group: 'music' | 'sfx', dir: string, stems: readonly string[]): AssetEntry[] {
  return stems.map((id) => ({ id, kind: 'audio', group, path: `${dir}/${id}.wav`, hasBakedText: false, status: 'starter' }));
}

const containerStems = Object.values(ContainerSize).flatMap((size) =>
  Object.values(CargoStatus).flatMap((cargo) =>
    (['AV', 'DM'] as const).map((cond) => `container-${size.toLowerCase()}-${cargo.toLowerCase()}-${cond.toLowerCase()}`),
  ),
);

export const ASSETS: readonly AssetEntry[] = [
  ...svg('container', 'sprites/containers', containerStems, true),
  ...svg('vehicle', 'sprites/vehicles', ['container-truck', 'forklift', 'fuel-truck', 'reach-stacker', 'terminal-tractor', 'yard-truck'], true),
  ...svg('building', 'sprites/buildings', ['admin-office', 'equipment-shed', 'gate-complex', 'repair-workshop', 'survey-building', 'warehouse'], true),
  ...svg('worker', 'sprites/workers', ['gate-staff', 'manager', 'operator', 'surveyor', 'technician', 'yard-worker'], true),
  ...svg('environment', 'sprites/environment', ['fence', 'gate-barrier', 'street-light', 'traffic-cone', 'tree'], false),
  ...svg('tile', 'tiles', ['asphalt', 'concrete', 'grass', 'stack-marking', 'yard-slot'], false),
  ...svg('ui-icon', 'ui/icons', ['contracts', 'dispatch', 'equipment', 'finance', 'gate', 'off-hire', 'repair', 'repo', 'settings', 'staff', 'survey', 'yard'], false),
  ...svg('ui-panel', 'ui/panels', ['button-danger', 'button-primary', 'button-success', 'button-warning', 'panel-dark'], false),
  ...svg('ui-logo', 'ui', ['logo-idle-depot'], true),
  ...audio('music', 'audio/music', ['depot-day-loop', 'depot-night-loop']),
  ...audio('sfx', 'audio/sfx', ['confirm', 'container-drop', 'gate-open', 'notification', 'reach-stacker-hydraulic', 'repair-complete', 'truck-horn', 'ui-click']),
];

export const ASSET_BY_ID: ReadonlyMap<string, AssetEntry> = new Map(ASSETS.map((a) => [a.id, a]));

/** Semantic audio names -> logical IDs (from Asset Pack v1.1 audio-example). Gameplay code uses these keys. */
export const AUDIO = {
  music: { day: 'depot-day-loop', night: 'depot-night-loop' },
  sfx: {
    click: 'ui-click',
    confirm: 'confirm',
    containerDrop: 'container-drop',
    truckHorn: 'truck-horn',
    repairComplete: 'repair-complete',
    notification: 'notification',
    reachStacker: 'reach-stacker-hydraulic',
    gateOpen: 'gate-open',
  },
} as const;

/**
 * Picks the container sprite for a cargo/condition pair. v1.1 only draws AV and DM:
 *  - UNDER_INSPECTION uses the AV sprite (inspection is shown by a game-drawn overlay),
 *  - REPAIR_REQUIRED uses the DM sprite.
 * PROVISIONAL mapping, to be confirmed with ChatGPT. Cargo is never inferred from condition and vice versa.
 */
export function containerSpriteId(size: ContainerSize, cargo: CargoStatus, condition: PhysicalCondition): string {
  const drawn = condition === PhysicalCondition.DM || condition === PhysicalCondition.REPAIR_REQUIRED ? 'dm' : 'av';
  return `container-${size.toLowerCase()}-${cargo.toLowerCase()}-${drawn}`;
}

/**
 * Provisional ground-contact origin for world sprites. The spec requires anchors at the ground contact point, but the
 * pack ships no per-asset anchor data; tuned per asset in Phase 1 once ChatGPT supplies them.
 */
export const DEFAULT_WORLD_ORIGIN = { x: 0.5, y: 0.88 } as const;
