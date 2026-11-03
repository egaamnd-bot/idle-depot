# Game Design Document v0.1

Owner: ChatGPT (design) with the Producer. Engineering notes by Claude. Status: draft for review.

## 1. Pitch

IDLE DEPOT is a container depot management simulation that keeps running while you are away. You start with one small depot and grow it into a logistics operation. **BUILD IT. MOVE IT. FIX IT. GROW IT.**

It is not a clicker with a container skin. The fun comes from a believable operation with real constraints: if you let more trucks in than you can survey, a queue forms; if surveys outrun yard space, the yard congests; if damage outruns technicians, repairs back up. Profit comes from good decisions about capacity, placement and equipment, not from buying every upgrade.

Inspirations: The Sims (environment, customisation), RollerCoaster Tycoon (build and optimise), Idle Miner Tycoon (offline earnings, upgrades). Domain authority: the Producer's real depot experience.

## 2. Platforms and session shape

Web browser, Telegram Mini App, Android (Capacitor). Portrait-first, one-handed, readable on mid-range Android. Sessions: a 1-3 minute check-in (collect, fix a bottleneck, spend) and occasional longer sessions (expand, reorganise the yard).

## 3. Core loop

1. Trucks arrive at the gate with laden or empty containers.
2. Containers are surveyed, then stored in the yard (laden and empty handled differently).
3. Damaged containers go to assessment and repair.
4. Containers leave via survey out and dispatch, or through off-hire and repositioning.
5. Each step earns fees and costs money. Bottlenecks are visible in the world and on the dashboard.
6. Spend cash on capacity, equipment, staff and land. Bottlenecks move; the player chases them.

## 4. What makes it distinct

- **Laden vs Empty** is a core dimension of storage, tariffs, handling, dwell, SLA and repositioning, not a colour.
- **Visible operation**: trucks, reach stackers, workers and containers move in an isometric depot you can zoom and pan.
- **Yard as a puzzle**: slot placement and zoning affect throughput and congestion (yard occupancy ratio).
- **Honest idle**: offline progress respects the same constraints as online play.

## 5. Systems (scope by phase)

| System | Summary | Phase |
|---|---|---|
| Depot world | Isometric yard, gate, buildings, camera pan/zoom | 1 |
| Containers | Identity, cargo/condition/status, history | 0 (model), 1-2 |
| Gate, Survey In/Out, Dispatch | Queues, capacity, records | 2 |
| Repair workshop | Assessment, jobs, technicians, materials, QC | 3 |
| Equipment and staff | Reach stackers, forklifts, tractors; operators; fuel, maintenance | 3 |
| Economy | Revenue, expenses, dashboard, upgrades, offline | 4 |
| Off-hire, Repo, contracts, SLA, incidents | Advanced operations | 5 |
| Expansion | More blocks, automation, multiple depots, regional network | 6 |
| Distribution | Telegram, auth, cloud saves, Android build | 7 |

Out of scope until the core is stable: payments, Telegram Stars, special container features (reefer power and alarms), multiplayer.

## 6. First playable milestone (Phase 1)

A small working depot you can open and watch: isometric scene, camera, yard grid and slots, individual containers (laden/empty, inspectable), trucks and a reach stacker moving containers, workers, visible operational status, basic revenue and one upgrade. Detail in `docs/PHASE_1_PLAN.md`. Not included: full departments, contracts, offline rewards, backend.

## 7. UX principles

Mobile first, bottom-anchored controls, 48 px minimum touch targets, readable text at arm's length, status never by colour alone, one-tap inspection of any container, every number explained on tap. Dark navy panels, bright department icons, per the reference image. Layout proposal in section 9.

## 8. Visual and audio direction

Defined by the Producer's reference image and `docs/ASSET_SPECIFICATION.md`. Starter art in v1.1 is below that bar; replacement is ChatGPT's task. Audio: day and night music loops, short SFX for click, confirm, container drop, hydraulics, horn, gate, repair complete, notification.

## 9. UI layout proposal

Top bar: depot level or name, cash, (premium currency if approved, D11). Below: summary chips (Total, Laden, Empty). Centre: the depot. Bottom: department strip (Gate, Survey, Yard, Repair, Equipment, Off-hire, Repo, Survey Out, Dispatch, Contracts). Tapping a department opens a bottom sheet with queue, capacity, staff, equipment and an upgrade button. Tapping a container opens an inspector (number, size, type, owner, cargo, condition, status, location, history). Dashboard sheet: totals, laden/empty utilisation, dwell, revenue by cargo and department, queues, SLA. Phase 1 builds the top bar, chips, inspector and one department sheet only.

## 10. Producer decisions needed

Operational rules D1-D7 are in `docs/OPERATIONAL_WORKFLOWS.md`. Further:

| ID | Question | Why it matters |
|---|---|---|
| D8 | Tariff structure: free days, per-day storage, lift-on/lift-off, by cargo and size? Abstract game values, or a realistic structure? | Core of economy balance (`ECONOMY_DESIGN.md`) |
| D9 | Cargo colour scheme: sprites use Empty blue / Laden red; reference HUD uses Laden green / Empty amber. Which one? | Art and UI consistency |
| D10 | Time scale: how many in-game depot minutes per real minute? | Pacing, offline maths |
| D11 | The reference HUD shows an XP level and two currencies (cash and gems). In scope? Brief says no payments yet. | UI, progression, monetisation design |
| D12 | Early offline progression: accept client-computed, capped, unverified saves until the server exists? | Security and exploit exposure |
| D13 | The repository is public. May any real SBS data, tariffs or process detail appear in it? Recommended: no, game values only. | Confidentiality |
| D14 | Container numbering: generate ISO 6346 check digits? Fictional owners only (the reference image shows a real line's name)? | Authenticity vs IP safety |
| D15 | Yard occupancy ratio (YOR) thresholds that trigger congestion effects? | Yard puzzle tuning |

## 11. Risks to design

Idle games lose players when there is nothing to decide. The bottleneck chase must stay legible; if every upgrade is simply "more", the design fails. Mitigation: each upgrade shifts the bottleneck and costs upkeep; Phase 4 includes a balance simulation harness before content is added.
