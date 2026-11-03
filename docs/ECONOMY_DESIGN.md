# Economy Design v0.1

Status: structure and rules only. **No balance numbers are set.** Inventing tariffs now would anchor the design on guesses (and, if taken from real operations, risk leaking domain data into a public repo, D13). Numbers are calibrated in Phase 4 with the Producer, using a simulation harness. Every value below lives in configuration (`src/config/economy.*`, typed by `src/core/economy`), never in gameplay code.

## 1. Principles

1. Profit comes from decisions, not from unlimited upgrades. Every capacity upgrade moves the bottleneck and adds upkeep.
2. Cargo status matters: laden and empty differ in tariffs, handling, zoning, dwell, SLA and repositioning value.
3. All values are data. A balance change is a config change plus a test run.
4. Money maths is integer (smallest currency unit), deterministic and unit-tested before any UI shows it.

## 2. Revenue

| Stream | Basis (to calibrate) | Varies by |
|---|---|---|
| Handling (lift on/off) | per movement | cargo, size |
| Storage | per container per day after free days | cargo, size, owner |
| Survey | per survey (in and out) | cargo, size |
| Repair | quoted per job: labour + materials + margin | damage type, size |
| Off-hire processing | per container | contract |
| Repositioning | per container per contract | route, priority, contract |
| Special services | per service | service type |

## 3. Expenses

| Expense | Driver |
|---|---|
| Salaries | headcount x role rate per day |
| Fuel | equipment hours worked x consumption |
| Maintenance | equipment age, hours; breakdown risk when deferred |
| Repair materials | consumed per repair job by damage type |
| Land expansion | one-off per yard block |
| Utilities | per building and per day |
| Penalties | SLA breaches, congestion, failed contracts |

## 4. Capacity and productivity model

For each department: `throughput = min(staffCapacity, equipmentCapacity, spaceCapacity) x efficiency`.

- Equipment without an operator contributes zero.
- Efficiency falls with deferred maintenance, rises with upgrades.
- Yard slowdown applies when yard occupancy ratio exceeds a congestion threshold (D15), reducing handling throughput.
- Queues are first-class state; leftover demand carries over rather than disappearing.

## 5. Offline progression

Uses the same `advance()` as live play over capped elapsed time (see `TECHNICAL_ARCHITECTURE.md` section 4). Revenue and expenses accrue under the same capacity constraints, so a depot that is bottlenecked earns and congests offline exactly as it would online. Early versions are local, capped and untrusted (D12); real reward semantics wait for the server-authoritative design.

## 6. Configuration shape (sketch)

```ts
interface EconomyConfig {
  currencyUnit: number;                          // integer scale, e.g. 1 = smallest unit
  tariffs: Record<CargoStatus, {
    handling: Record<ContainerSize, number>;
    storagePerDay: Record<ContainerSize, number>;
    freeDays: number;
  }>;
  survey: Record<CargoStatus, number>;
  repair: Record<DamageType, { baseCost: number; materials: Record<Material, number>; ticks: number }>;
  roles: Record<Role, { dailyWage: number; productivity: number }>;
  equipment: Record<EquipmentType, { price: number; fuelPerTick: number; maintenanceInterval: number; capacity: number }>;
  yard: { congestionThreshold: number; blockPrice: number; slotsPerBlock: number };
  sla: Record<CargoStatus, { maxQueueTicks: number; penalty: number }>;
  offline: { maxTicks: number };
}
```

## 7. Dashboard metrics

Cash; daily revenue, expenses, net; revenue and cost by department; revenue by cargo status; total, laden and empty containers; laden and empty yard utilisation; average dwell by cargo status; laden and empty queues; SLA performance; customer satisfaction; equipment productivity and utilisation.

## 8. Testing plan (Phase 4, before UI)

Unit tests for each fee and cost formula; property tests (money conserved, no negative cash from rounding); golden-seed run of a full day; balance harness that simulates N in-game days per strategy and reports profit curves, to catch dominant strategies and dead ends.

## 9. Producer decisions

D8 (tariff structure), D10 (time scale), D11 (currencies and XP), D12 (offline trust), D13 (real data in a public repo), D15 (yard congestion thresholds). See `docs/GAME_DESIGN_DOCUMENT.md` section 10.
