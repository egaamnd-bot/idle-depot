import { describe, expect, it } from 'vitest';
import {
  createContainer,
  moveContainer,
  transition,
  type Container,
  type NewContainer,
} from '../src/core/container/container';
import {
  CARGO_ALLOWED,
  CONDITIONS_ALLOWED,
  TRANSITIONS,
  WORKFLOW_STATUSES,
  checkCombination,
  isValidCombination,
} from '../src/core/container/rules';
import {
  CargoStatus as C,
  ContainerSize,
  OperationalStatus as Op,
  PhysicalCondition as Cond,
  WorkflowId as Wf,
  type ContainerState,
  type OperationalStatus,
  type PhysicalCondition,
} from '../src/core/container/types';

const base = (over: Partial<NewContainer> = {}): NewContainer => ({
  id: 'c1',
  number: 'ABCU1234567',
  size: ContainerSize.FT40,
  owner: 'Example Line',
  cargo: C.LADEN,
  arrivedAt: 1000,
  ...over,
});

function make(over: Partial<NewContainer> = {}): Container {
  const r = createContainer(base(over));
  if (!r.ok) throw new Error(`setup failed: ${r.error}`);
  return r.value;
}

/** Runs a sequence of steps, failing the test on the first rejected step. */
function run(start: Container, steps: Array<[OperationalStatus, PhysicalCondition?]>): Container {
  let c = start;
  let t = 2000;
  for (const [to, condition] of steps) {
    const r = transition(c, condition ? { to, at: t++, condition } : { to, at: t++ });
    if (!r.ok) throw new Error(`step to ${to} rejected: ${r.error} (from ${c.status}/${c.condition}/${c.cargo})`);
    c = r.value;
  }
  return c;
}

describe('combination rules (cargo x condition x status)', () => {
  const valid: ContainerState[] = [
    { cargo: C.EMPTY, condition: Cond.AV, status: Op.IN_YARD },
    { cargo: C.LADEN, condition: Cond.AV, status: Op.IN_YARD },
    { cargo: C.EMPTY, condition: Cond.DM, status: Op.UNDER_REPAIR },
    { cargo: C.LADEN, condition: Cond.DM, status: Op.AWAITING_ASSESSMENT },
    { cargo: C.EMPTY, condition: Cond.AV, status: Op.REPO_PROCESSING },
    { cargo: C.LADEN, condition: Cond.AV, status: Op.READY_FOR_DISPATCH },
  ];
  it.each(valid)('accepts $cargo / $condition / $status (brief examples)', (s) => {
    expect(isValidCombination(s)).toBe(true);
  });

  const invalid: Array<[ContainerState, string]> = [
    [{ cargo: C.LADEN, condition: Cond.AV, status: Op.REPO_PROCESSING }, 'CARGO_INCOMPATIBLE'],
    [{ cargo: C.LADEN, condition: Cond.DM, status: Op.UNDER_REPAIR }, 'CARGO_INCOMPATIBLE'],
    [{ cargo: C.EMPTY, condition: Cond.DM, status: Op.READY_FOR_DISPATCH }, 'CONDITION_INCOMPATIBLE'],
    [{ cargo: C.EMPTY, condition: Cond.AV, status: Op.INBOUND }, 'CONDITION_INCOMPATIBLE'],
    [{ cargo: C.EMPTY, condition: Cond.UNDER_INSPECTION, status: Op.IN_YARD }, 'CONDITION_INCOMPATIBLE'],
  ];
  it.each(invalid)('rejects %j with %s', (s, code) => {
    expect(checkCombination(s)).toBe(code);
  });

  it('defines rules for every status and never references an unknown value', () => {
    const statuses = Object.values(Op);
    for (const s of statuses) {
      expect(CONDITIONS_ALLOWED[s].length).toBeGreaterThan(0);
      expect(CARGO_ALLOWED[s].length).toBeGreaterThan(0);
      for (const t of TRANSITIONS[s]) expect(statuses).toContain(t);
    }
  });

  it('keeps both cargo statuses reachable in every non-repair, non-off-hire, non-repo status', () => {
    for (const s of [Op.INBOUND, Op.IN_YARD, Op.READY_FOR_DISPATCH, Op.OUTBOUND, Op.RELEASED]) {
      expect(CARGO_ALLOWED[s]).toEqual(expect.arrayContaining([C.EMPTY, C.LADEN]));
    }
  });

  it('every workflow status set is a subset of the known statuses and RELEASED is terminal', () => {
    for (const wf of Object.values(Wf)) {
      for (const s of WORKFLOW_STATUSES[wf]) expect(Object.values(Op)).toContain(s);
    }
    expect(TRANSITIONS[Op.RELEASED]).toEqual([]);
  });
});

describe('container creation', () => {
  it('starts INBOUND and UNDER_INSPECTION and keeps the cargo status it was given', () => {
    for (const cargo of [C.EMPTY, C.LADEN]) {
      const c = make({ cargo });
      expect(c.cargo).toBe(cargo);
      expect(c.status).toBe(Op.INBOUND);
      expect(c.condition).toBe(Cond.UNDER_INSPECTION);
      expect(c.statusHistory).toHaveLength(1);
    }
  });

  it('rejects malformed container numbers and empty ids', () => {
    for (const number of ['', 'ABC1234567', 'ABCX1234567', 'abcu1234567', 'ABCU123456', 'ABCU12345678']) {
      const r = createContainer(base({ number }));
      expect(r).toEqual({ ok: false, error: 'INVALID_CONTAINER_NUMBER' });
    }
    expect(createContainer(base({ id: '  ' }))).toEqual({ ok: false, error: 'EMPTY_ID' });
  });
});

describe('laden workflow', () => {
  it('inbound -> survey -> yard storage -> survey out -> dispatch -> released, cargo never changes', () => {
    const c = run(make({ cargo: C.LADEN, sealNumber: 'SEAL-001' }), [
      [Op.AWAITING_SURVEY],
      [Op.IN_SURVEY],
      [Op.IN_YARD, Cond.AV],
      [Op.IN_SURVEY, Cond.UNDER_INSPECTION], // survey out: re-inspection
      [Op.READY_FOR_DISPATCH, Cond.AV],
      [Op.OUTBOUND],
      [Op.RELEASED],
    ]);
    expect(c.status).toBe(Op.RELEASED);
    expect(c.cargo).toBe(C.LADEN);
    expect(c.sealNumber).toBe('SEAL-001');
    expect(c.outboundAt).not.toBeNull();
    expect(c.statusHistory.map((h) => h.to)).toEqual([
      Op.INBOUND,
      Op.AWAITING_SURVEY,
      Op.IN_SURVEY,
      Op.IN_YARD,
      Op.IN_SURVEY,
      Op.READY_FOR_DISPATCH,
      Op.OUTBOUND,
      Op.RELEASED,
    ]);
  });

  it('damaged laden container waits for assessment but cannot enter repair while laden (provisional rule)', () => {
    const atAssessment = run(make({ cargo: C.LADEN }), [
      [Op.AWAITING_SURVEY],
      [Op.IN_SURVEY],
      [Op.AWAITING_ASSESSMENT, Cond.DM],
    ]);
    expect(atAssessment.condition).toBe(Cond.DM);
    expect(transition(atAssessment, { to: Op.UNDER_REPAIR, at: 9 })).toEqual({ ok: false, error: 'CARGO_INCOMPATIBLE' });
  });
});

describe('empty workflows', () => {
  it('empty inbound -> survey -> yard storage', () => {
    const c = run(make({ cargo: C.EMPTY }), [[Op.AWAITING_SURVEY], [Op.IN_SURVEY], [Op.IN_YARD, Cond.AV]]);
    expect(c.status).toBe(Op.IN_YARD);
    expect(c.cargo).toBe(C.EMPTY);
  });

  it('empty damaged -> assessment -> repair -> yard AV -> dispatch', () => {
    const c = run(make({ cargo: C.EMPTY }), [
      [Op.AWAITING_SURVEY],
      [Op.IN_SURVEY],
      [Op.AWAITING_ASSESSMENT, Cond.DM],
      [Op.UNDER_REPAIR],
      [Op.IN_YARD, Cond.AV],
      [Op.READY_FOR_DISPATCH],
      [Op.OUTBOUND],
      [Op.RELEASED],
    ]);
    expect(c.status).toBe(Op.RELEASED);
    expect(c.cargo).toBe(C.EMPTY);
  });

  it('repair cannot finish into dispatch without passing back through the yard', () => {
    const c = run(make({ cargo: C.EMPTY }), [
      [Op.AWAITING_SURVEY],
      [Op.IN_SURVEY],
      [Op.AWAITING_ASSESSMENT, Cond.DM],
      [Op.UNDER_REPAIR],
    ]);
    expect(transition(c, { to: Op.READY_FOR_DISPATCH, at: 9, condition: Cond.AV })).toEqual({
      ok: false,
      error: 'TRANSITION_NOT_ALLOWED',
    });
  });

  it('empty repositioning on the REPO workflow', () => {
    const c = run(make({ cargo: C.EMPTY, workflow: Wf.REPO }), [
      [Op.AWAITING_SURVEY],
      [Op.IN_SURVEY],
      [Op.IN_YARD, Cond.AV],
      [Op.REPO_PROCESSING],
      [Op.OUTBOUND],
      [Op.RELEASED],
    ]);
    expect(c.status).toBe(Op.RELEASED);
  });

  it('a laden container cannot be repositioned', () => {
    const inYard = run(make({ cargo: C.LADEN, workflow: Wf.REPO }), [
      [Op.AWAITING_SURVEY],
      [Op.IN_SURVEY],
      [Op.IN_YARD, Cond.AV],
    ]);
    expect(transition(inYard, { to: Op.REPO_PROCESSING, at: 9 })).toEqual({ ok: false, error: 'CARGO_INCOMPATIBLE' });
  });
});

describe('off-hire workflow', () => {
  it('yard -> off-hire processing -> survey -> dispatch -> released', () => {
    const c = run(make({ cargo: C.EMPTY, workflow: Wf.OFFHIRE }), [
      [Op.AWAITING_SURVEY],
      [Op.IN_SURVEY],
      [Op.IN_YARD, Cond.AV],
      [Op.OFFHIRE_PROCESSING],
      [Op.IN_SURVEY, Cond.UNDER_INSPECTION],
      [Op.READY_FOR_DISPATCH, Cond.AV],
      [Op.OUTBOUND],
      [Op.RELEASED],
    ]);
    expect(c.status).toBe(Op.RELEASED);
  });

  it('off-hire processing is closed to the STANDARD workflow', () => {
    const c = run(make({ cargo: C.EMPTY }), [[Op.AWAITING_SURVEY], [Op.IN_SURVEY], [Op.IN_YARD, Cond.AV]]);
    expect(transition(c, { to: Op.OFFHIRE_PROCESSING, at: 9 })).toEqual({ ok: false, error: 'STATUS_NOT_IN_WORKFLOW' });
  });

  it('repo processing is closed to the OFFHIRE workflow', () => {
    const c = run(make({ cargo: C.EMPTY, workflow: Wf.OFFHIRE }), [
      [Op.AWAITING_SURVEY],
      [Op.IN_SURVEY],
      [Op.IN_YARD, Cond.AV],
    ]);
    expect(transition(c, { to: Op.REPO_PROCESSING, at: 9 })).toEqual({ ok: false, error: 'STATUS_NOT_IN_WORKFLOW' });
  });
});

describe('invalid and duplicate transitions', () => {
  it('rejects skipping survey', () => {
    expect(transition(make(), { to: Op.IN_YARD, at: 1, condition: Cond.AV })).toEqual({
      ok: false,
      error: 'TRANSITION_NOT_ALLOWED',
    });
  });

  it('rejects duplicate processing of the same status', () => {
    const c = run(make(), [[Op.AWAITING_SURVEY]]);
    expect(transition(c, { to: Op.AWAITING_SURVEY, at: 5 })).toEqual({ ok: false, error: 'ALREADY_IN_STATUS' });
  });

  it('RELEASED is terminal', () => {
    const c = run(make({ cargo: C.EMPTY }), [
      [Op.AWAITING_SURVEY],
      [Op.IN_SURVEY],
      [Op.IN_YARD, Cond.AV],
      [Op.READY_FOR_DISPATCH],
      [Op.OUTBOUND],
      [Op.RELEASED],
    ]);
    for (const to of Object.values(Op)) {
      expect(transition(c, { to, at: 99 }).ok).toBe(false);
    }
  });

  it('rejects a step whose resulting combination is invalid and leaves the container unchanged', () => {
    const c = run(make(), [[Op.AWAITING_SURVEY], [Op.IN_SURVEY]]);
    const snapshot = JSON.stringify(c);
    // Leaving survey into the yard while still UNDER_INSPECTION is not a valid combination.
    expect(transition(c, { to: Op.IN_YARD, at: 7 })).toEqual({ ok: false, error: 'CONDITION_INCOMPATIBLE' });
    expect(JSON.stringify(c)).toBe(snapshot);
  });

  it('never changes cargo status through a transition, whatever the path', () => {
    for (const cargo of [C.EMPTY, C.LADEN]) {
      const c = run(make({ cargo }), [[Op.AWAITING_SURVEY], [Op.IN_SURVEY], [Op.IN_YARD, Cond.AV]]);
      expect(c.cargo).toBe(cargo);
    }
  });
});

describe('movement history', () => {
  it('records yard moves without touching status or cargo', () => {
    const c = run(make(), [[Op.AWAITING_SURVEY], [Op.IN_SURVEY], [Op.IN_YARD, Cond.AV]]);
    const moved = moveContainer(moveContainer(c, 'A-02-04', 10), 'B-01-01', 20);
    expect(moved.location).toBe('B-01-01');
    expect(moved.movementHistory).toEqual([
      { at: 10, from: null, to: 'A-02-04' },
      { at: 20, from: 'A-02-04', to: 'B-01-01' },
    ]);
    expect(moved.status).toBe(c.status);
    expect(moved.cargo).toBe(c.cargo);
  });
});
