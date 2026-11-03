import { checkCombination, checkTransition, type RuleViolation } from './rules';
import {
  CargoStatus,
  ContainerType,
  OperationalStatus,
  PhysicalCondition,
  WorkflowId,
  type ContainerSize,
  type ContainerState,
} from './types';

/** Container number: owner code (3 letters) + category letter + 6 digits + check digit. Format only; see data model doc. */
const CONTAINER_NUMBER = /^[A-Z]{3}[UJZ]\d{7}$/;

export interface MovementRecord {
  readonly at: number; // simulation time, epoch ms. Supplied by the caller: core never reads a clock.
  readonly from: string | null; // yard slot id, null when outside the yard
  readonly to: string | null;
}

export interface StatusRecord {
  readonly at: number;
  readonly from: OperationalStatus | null;
  readonly to: OperationalStatus;
  readonly condition: PhysicalCondition;
}

export interface Container {
  readonly id: string;
  readonly number: string;
  readonly size: ContainerSize;
  readonly type: ContainerType;
  readonly owner: string;
  readonly cargo: CargoStatus;
  readonly condition: PhysicalCondition;
  readonly status: OperationalStatus;
  readonly workflow: WorkflowId;
  readonly location: string | null;
  readonly sealNumber: string | null;
  readonly arrivedAt: number;
  readonly outboundAt: number | null;
  readonly statusHistory: readonly StatusRecord[];
  readonly movementHistory: readonly MovementRecord[];
}

export type Result<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: ContainerError };

export type ContainerError = RuleViolation | 'INVALID_CONTAINER_NUMBER' | 'EMPTY_ID';

export interface NewContainer {
  readonly id: string;
  readonly number: string;
  readonly size: ContainerSize;
  readonly type?: ContainerType;
  readonly owner: string;
  readonly cargo: CargoStatus;
  readonly sealNumber?: string | null;
  readonly workflow?: WorkflowId;
  readonly arrivedAt: number;
}

/** Every container enters as INBOUND with condition UNDER_INSPECTION; survey decides the real condition. */
export function createContainer(input: NewContainer): Result<Container> {
  if (input.id.trim() === '') return fail('EMPTY_ID');
  if (!CONTAINER_NUMBER.test(input.number)) return fail('INVALID_CONTAINER_NUMBER');
  const state: ContainerState = {
    cargo: input.cargo,
    condition: PhysicalCondition.UNDER_INSPECTION,
    status: OperationalStatus.INBOUND,
  };
  const violation = checkCombination(state);
  if (violation) return fail(violation);
  return ok({
    id: input.id,
    number: input.number,
    size: input.size,
    type: input.type ?? ContainerType.DRY,
    owner: input.owner,
    cargo: state.cargo,
    condition: state.condition,
    status: state.status,
    workflow: input.workflow ?? WorkflowId.STANDARD,
    location: null,
    sealNumber: input.sealNumber ?? null,
    arrivedAt: input.arrivedAt,
    outboundAt: null,
    statusHistory: [{ at: input.arrivedAt, from: null, to: state.status, condition: state.condition }],
    movementHistory: [],
  });
}

export interface TransitionRequest {
  readonly to: OperationalStatus;
  readonly at: number;
  /** Survey and repair outcomes change the condition as part of the same step. Cargo never changes here. */
  readonly condition?: PhysicalCondition;
}

/**
 * Moves a container to a new operational status. Cargo status is never touched. The result state must be a valid
 * combination, so an invalid or duplicate step returns an error and leaves the input container unchanged.
 */
export function transition(container: Container, req: TransitionRequest): Result<Container> {
  const violation = checkTransition(container.workflow, container.status, req.to);
  if (violation) return fail(violation);

  const condition = req.condition ?? container.condition;
  const next: ContainerState = { cargo: container.cargo, condition, status: req.to };
  const combo = checkCombination(next);
  if (combo) return fail(combo);

  return ok({
    ...container,
    condition,
    status: req.to,
    outboundAt: req.to === OperationalStatus.OUTBOUND ? req.at : container.outboundAt,
    statusHistory: [...container.statusHistory, { at: req.at, from: container.status, to: req.to, condition }],
  });
}

/** Records a yard movement. Slot validity and occupancy are the yard module's job (Phase 1), not checked here. */
export function moveContainer(container: Container, to: string | null, at: number): Container {
  return {
    ...container,
    location: to,
    movementHistory: [...container.movementHistory, { at, from: container.location, to }],
  };
}

function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

function fail<T>(error: ContainerError): Result<T> {
  return { ok: false, error };
}
