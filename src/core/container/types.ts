/**
 * Container state is split into independent axes (see docs/CONTAINER_DATA_MODEL.md).
 * Cargo status, physical condition and operational status are NEVER merged into one enum.
 * Which combinations are legal, and which transitions are allowed, lives in rules.ts as data.
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
  AWAITING_SURVEY: 'AWAITING_SURVEY',
  IN_SURVEY: 'IN_SURVEY',
  IN_YARD: 'IN_YARD',
  AWAITING_ASSESSMENT: 'AWAITING_ASSESSMENT',
  UNDER_REPAIR: 'UNDER_REPAIR',
  READY_FOR_DISPATCH: 'READY_FOR_DISPATCH',
  OFFHIRE_PROCESSING: 'OFFHIRE_PROCESSING',
  REPO_PROCESSING: 'REPO_PROCESSING',
  OUTBOUND: 'OUTBOUND',
  RELEASED: 'RELEASED',
} as const;
export type OperationalStatus = (typeof OperationalStatus)[keyof typeof OperationalStatus];

/** Sizes in scope for the first release. */
export const ContainerSize = {
  FT20: '20FT',
  FT40: '40FT',
  HC40: '40HC',
} as const;
export type ContainerSize = (typeof ContainerSize)[keyof typeof ContainerSize];

/** Only DRY is modelled now; the union is the extension point for reefer, open-top, flat-rack and tank. */
export const ContainerType = {
  DRY: 'DRY',
} as const;
export type ContainerType = (typeof ContainerType)[keyof typeof ContainerType];

/** The three axes together. Always validated with isValidCombination(). */
export interface ContainerState {
  readonly cargo: CargoStatus;
  readonly condition: PhysicalCondition;
  readonly status: OperationalStatus;
}

/**
 * Workflows are configurable, not one rigid lifecycle. A container follows exactly one workflow at a time;
 * the workflow decides which operational statuses it may enter.
 */
export const WorkflowId = {
  STANDARD: 'STANDARD',
  OFFHIRE: 'OFFHIRE',
  REPO: 'REPO',
} as const;
export type WorkflowId = (typeof WorkflowId)[keyof typeof WorkflowId];
