/**
 * Container state is deliberately split into independent axes (see docs/CONTAINER_DATA_MODEL.md).
 * Cargo status, physical condition and operational status are NEVER merged into one enum.
 * Valid combinations and transitions are enforced by the lifecycle module (Phase 0 deliverable),
 * and the exact value sets below are placeholders pending Producer confirmation.
 */

export const CargoStatus = {
  EMPTY: 'EMPTY',
  LADEN: 'LADEN',
} as const;
export type CargoStatus = (typeof CargoStatus)[keyof typeof CargoStatus];

export const PhysicalCondition = {
  AV: 'AV',
  DM: 'DM',
  UNDER_INSPECTION: 'UNDER_INSPECTION',
  REPAIR_REQUIRED: 'REPAIR_REQUIRED',
} as const;
export type PhysicalCondition = (typeof PhysicalCondition)[keyof typeof PhysicalCondition];

export const OperationalStatus = {
  INBOUND: 'INBOUND',
  IN_SURVEY: 'IN_SURVEY',
  IN_YARD: 'IN_YARD',
  UNDER_REPAIR: 'UNDER_REPAIR',
  READY_FOR_DISPATCH: 'READY_FOR_DISPATCH',
  OFFHIRE_PROCESSING: 'OFFHIRE_PROCESSING',
  REPO_PROCESSING: 'REPO_PROCESSING',
  OUTBOUND: 'OUTBOUND',
  RELEASED: 'RELEASED',
} as const;
export type OperationalStatus = (typeof OperationalStatus)[keyof typeof OperationalStatus];
