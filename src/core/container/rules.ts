import {
  CargoStatus as Cargo,
  OperationalStatus as Op,
  PhysicalCondition as Cond,
  WorkflowId as Wf,
  type CargoStatus,
  type ContainerState,
  type OperationalStatus,
  type PhysicalCondition,
  type WorkflowId,
} from './types';

/**
 * PROVISIONAL RULES. These tables encode the combinations named in the Producer brief and the minimum needed to
 * make the model testable. Every row marked in docs/OPERATIONAL_WORKFLOWS.md "Producer decisions" must be
 * confirmed or corrected by the Producer. They are data, so changing a ruling is a table edit, not a code change.
 */

/** Which physical conditions an operational status may coexist with. */
export const CONDITIONS_ALLOWED: Readonly<Record<OperationalStatus, readonly PhysicalCondition[]>> = {
  [Op.INBOUND]: [Cond.UNDER_INSPECTION],
  [Op.AWAITING_SURVEY]: [Cond.UNDER_INSPECTION],
  [Op.IN_SURVEY]: [Cond.UNDER_INSPECTION],
  [Op.IN_YARD]: [Cond.AV, Cond.DM, Cond.REPAIR_REQUIRED],
  [Op.AWAITING_ASSESSMENT]: [Cond.DM],
  [Op.UNDER_REPAIR]: [Cond.DM, Cond.REPAIR_REQUIRED],
  [Op.READY_FOR_DISPATCH]: [Cond.AV],
  [Op.OFFHIRE_PROCESSING]: [Cond.AV, Cond.DM, Cond.REPAIR_REQUIRED, Cond.UNDER_INSPECTION],
  [Op.REPO_PROCESSING]: [Cond.AV],
  [Op.OUTBOUND]: [Cond.AV],
  [Op.RELEASED]: [Cond.AV],
};

/** Which cargo statuses an operational status may coexist with (independent of condition). */
export const CARGO_ALLOWED: Readonly<Record<OperationalStatus, readonly CargoStatus[]>> = {
  [Op.INBOUND]: [Cargo.EMPTY, Cargo.LADEN],
  [Op.AWAITING_SURVEY]: [Cargo.EMPTY, Cargo.LADEN],
  [Op.IN_SURVEY]: [Cargo.EMPTY, Cargo.LADEN],
  [Op.IN_YARD]: [Cargo.EMPTY, Cargo.LADEN],
  [Op.AWAITING_ASSESSMENT]: [Cargo.EMPTY, Cargo.LADEN],
  [Op.UNDER_REPAIR]: [Cargo.EMPTY], // PROVISIONAL: brief lists "Empty repair" only
  [Op.READY_FOR_DISPATCH]: [Cargo.EMPTY, Cargo.LADEN],
  [Op.OFFHIRE_PROCESSING]: [Cargo.EMPTY], // PROVISIONAL: off-hire redelivery of empties
  [Op.REPO_PROCESSING]: [Cargo.EMPTY], // brief: "Empty container repositioning"
  [Op.OUTBOUND]: [Cargo.EMPTY, Cargo.LADEN],
  [Op.RELEASED]: [Cargo.EMPTY, Cargo.LADEN],
};

/** Base status graph. A workflow narrows it; it never adds edges. */
export const TRANSITIONS: Readonly<Record<OperationalStatus, readonly OperationalStatus[]>> = {
  [Op.INBOUND]: [Op.AWAITING_SURVEY],
  [Op.AWAITING_SURVEY]: [Op.IN_SURVEY],
  [Op.IN_SURVEY]: [Op.IN_YARD, Op.AWAITING_ASSESSMENT, Op.READY_FOR_DISPATCH],
  [Op.IN_YARD]: [
    Op.AWAITING_ASSESSMENT,
    Op.IN_SURVEY, // survey out / re-survey (survey kind is a survey-record field, see data model)
    Op.READY_FOR_DISPATCH,
    Op.OFFHIRE_PROCESSING,
    Op.REPO_PROCESSING,
  ],
  [Op.AWAITING_ASSESSMENT]: [Op.UNDER_REPAIR, Op.IN_YARD],
  [Op.UNDER_REPAIR]: [Op.IN_YARD],
  [Op.READY_FOR_DISPATCH]: [Op.OUTBOUND, Op.IN_YARD],
  [Op.OFFHIRE_PROCESSING]: [Op.IN_SURVEY, Op.AWAITING_ASSESSMENT, Op.READY_FOR_DISPATCH, Op.IN_YARD],
  [Op.REPO_PROCESSING]: [Op.OUTBOUND, Op.IN_YARD],
  [Op.OUTBOUND]: [Op.RELEASED],
  [Op.RELEASED]: [],
};

/** Statuses each workflow may enter. Special-handling workflows are future work. */
export const WORKFLOW_STATUSES: Readonly<Record<WorkflowId, ReadonlySet<OperationalStatus>>> = {
  [Wf.STANDARD]: new Set<OperationalStatus>([
    Op.INBOUND,
    Op.AWAITING_SURVEY,
    Op.IN_SURVEY,
    Op.IN_YARD,
    Op.AWAITING_ASSESSMENT,
    Op.UNDER_REPAIR,
    Op.READY_FOR_DISPATCH,
    Op.OUTBOUND,
    Op.RELEASED,
  ]),
  [Wf.OFFHIRE]: new Set<OperationalStatus>([
    Op.INBOUND,
    Op.AWAITING_SURVEY,
    Op.IN_SURVEY,
    Op.IN_YARD,
    Op.AWAITING_ASSESSMENT,
    Op.UNDER_REPAIR,
    Op.OFFHIRE_PROCESSING,
    Op.READY_FOR_DISPATCH,
    Op.OUTBOUND,
    Op.RELEASED,
  ]),
  [Wf.REPO]: new Set<OperationalStatus>([
    Op.INBOUND,
    Op.AWAITING_SURVEY,
    Op.IN_SURVEY,
    Op.IN_YARD,
    Op.AWAITING_ASSESSMENT,
    Op.UNDER_REPAIR,
    Op.REPO_PROCESSING,
    Op.OUTBOUND,
    Op.RELEASED,
  ]),
};

export type RuleViolation =
  | 'CONDITION_INCOMPATIBLE'
  | 'CARGO_INCOMPATIBLE'
  | 'TRANSITION_NOT_ALLOWED'
  | 'ALREADY_IN_STATUS'
  | 'STATUS_NOT_IN_WORKFLOW';

/** Returns the first violation for a state, or null when the three axes are compatible. */
export function checkCombination(state: ContainerState): RuleViolation | null {
  if (!CONDITIONS_ALLOWED[state.status].includes(state.condition)) return 'CONDITION_INCOMPATIBLE';
  if (!CARGO_ALLOWED[state.status].includes(state.cargo)) return 'CARGO_INCOMPATIBLE';
  return null;
}

export function isValidCombination(state: ContainerState): boolean {
  return checkCombination(state) === null;
}

/** Pure check of a status change for a given workflow. Does not look at the condition: callers check the result state. */
export function checkTransition(
  workflow: WorkflowId,
  from: OperationalStatus,
  to: OperationalStatus,
): RuleViolation | null {
  if (from === to) return 'ALREADY_IN_STATUS';
  if (!WORKFLOW_STATUSES[workflow].has(to)) return 'STATUS_NOT_IN_WORKFLOW';
  if (!TRANSITIONS[from].includes(to)) return 'TRANSITION_NOT_ALLOWED';
  return null;
}
