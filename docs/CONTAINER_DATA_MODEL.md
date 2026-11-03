# Container Data Model

Implemented in `src/core/container/` and tested in `tests/container-*.test.ts`. Rules are **provisional** until the Producer decisions in `docs/OPERATIONAL_WORKFLOWS.md` section 6 are answered. They live in data tables (`rules.ts`), so a ruling is a table edit.

## 1. Three independent axes

Cargo status, physical condition and operational status are three separate fields. They are never merged into one enum and never inferred from each other.

| Axis | Values |
|---|---|
| Cargo status | `EMPTY`, `LADEN` |
| Physical condition | `AV`, `DM`, `UNDER_INSPECTION`, `REPAIR_REQUIRED` |
| Operational status | `INBOUND`, `AWAITING_SURVEY`, `IN_SURVEY`, `IN_YARD`, `AWAITING_ASSESSMENT`, `UNDER_REPAIR`, `READY_FOR_DISPATCH`, `OFFHIRE_PROCESSING`, `REPO_PROCESSING`, `OUTBOUND`, `RELEASED` |

Cargo status changes only through a dedicated stuffing/unstuffing operation (not built; see D1). **No status transition can change cargo.** A test asserts this on every path.

## 2. Entity

```
Container
  id, number (ISO 6346 shape), size (20FT|40FT|40HC), type (DRY now; REEFER, OPEN_TOP, FLAT_RACK, TANK later)
  owner (shipping line / lessor)
  cargo, condition, status, workflow (STANDARD|OFFHIRE|REPO)
  location (yard slot id | null), sealNumber | null
  arrivedAt, outboundAt | null
  statusHistory[]   { at, from, to, condition }
  movementHistory[] { at, from, to }
```

Core never reads a clock: every timestamp is passed in. Functions are pure and return a new container. Errors are values (`Result`), never thrown for rule violations, and a rejected transition leaves the input unchanged.

Not yet modelled (Phase 2+): survey records (kind IN/OUT, damage classification, photos-as-flags), repair jobs and history, contract information, customer. The extension points are separate record types referenced by container id, not extra fields on the status enums.

Container numbers are validated for shape only (`AAA[UJZ]#######`). Check-digit generation/validation (ISO 6346) is a Phase 2 decision (D14). Owner names will be fictional.

## 3. Valid combinations (provisional)

Condition x status and cargo x status are checked independently by `checkCombination`.

| Operational status | Allowed conditions | Allowed cargo |
|---|---|---|
| INBOUND, AWAITING_SURVEY, IN_SURVEY | UNDER_INSPECTION | EMPTY, LADEN |
| IN_YARD | AV, DM, REPAIR_REQUIRED | EMPTY, LADEN |
| AWAITING_ASSESSMENT | DM | EMPTY, LADEN |
| UNDER_REPAIR | DM, REPAIR_REQUIRED | EMPTY only (D1) |
| READY_FOR_DISPATCH | AV | EMPTY, LADEN |
| OFFHIRE_PROCESSING | any | EMPTY only (D2) |
| REPO_PROCESSING | AV | EMPTY only |
| OUTBOUND, RELEASED | AV | EMPTY, LADEN |

Brief examples, all accepted by tests: EMPTY/AV/In Yard, LADEN/AV/In Yard, EMPTY/DM/Under Repair, LADEN/DM/Awaiting Assessment, EMPTY/AV/Repo Processing, LADEN/AV/Ready for Dispatch. Rejected by tests: LADEN in Repo Processing, LADEN in Under Repair, DM in Ready for Dispatch, AV while Inbound.

## 4. Transitions

Base graph (`TRANSITIONS`), narrowed per workflow (`WORKFLOW_STATUSES`). A step succeeds only if the status edge exists, the target is in the container's workflow, and the resulting cargo/condition/status triple is a valid combination.

```
INBOUND -> AWAITING_SURVEY -> IN_SURVEY -> IN_YARD | AWAITING_ASSESSMENT | READY_FOR_DISPATCH
IN_YARD -> AWAITING_ASSESSMENT | IN_SURVEY (survey out) | READY_FOR_DISPATCH | OFFHIRE_PROCESSING* | REPO_PROCESSING*
AWAITING_ASSESSMENT -> UNDER_REPAIR | IN_YARD
UNDER_REPAIR -> IN_YARD            (repair always returns through the yard, then survey out)
READY_FOR_DISPATCH -> OUTBOUND | IN_YARD
OFFHIRE_PROCESSING* -> IN_SURVEY | AWAITING_ASSESSMENT | READY_FOR_DISPATCH | IN_YARD
REPO_PROCESSING* -> OUTBOUND | IN_YARD
OUTBOUND -> RELEASED -> (terminal)
* only in the OFFHIRE / REPO workflow respectively
```

Duplicate processing (same status again) returns `ALREADY_IN_STATUS`. Skipping steps returns `TRANSITION_NOT_ALLOWED`. A status outside the container's workflow returns `STATUS_NOT_IN_WORKFLOW`. Survey outcomes set the condition in the same step (survey out re-enters `IN_SURVEY` with `UNDER_INSPECTION`, then leaves with `AV`).

## 5. Laden / Empty implications

Cargo status is a first-class dimension of storage (separate laden and empty yard zones), tariffs, handling fees, dwell time, SLA and repositioning eligibility (only EMPTY can be repositioned or off-hired). The dashboard reports total, laden and empty counts, utilisation, dwell and revenue split by cargo status. Cargo-specific values live in configuration (`docs/ECONOMY_DESIGN.md`), not in the model.

## 6. Persistence (planned)

Relational tables `containers`, `container_status_history`, `container_movements`, with cargo, condition and status as three columns with check constraints mirroring the rule tables; `workflow` as a fourth. Save payloads carry a `version` and migrate forward (see `docs/TECHNICAL_ARCHITECTURE.md`). Schema SQL is written in Phase 7; the model above is the contract.
