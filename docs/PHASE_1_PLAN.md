# Phase 1 Plan: Playable Depot Vertical Slice

Goal: open the game and watch a small, working, living depot. Not in scope: all departments, contracts, repair workshop, offline rewards, backend, Telegram, Android packaging.

## Milestone definition (acceptance for the whole phase)

- Isometric depot scene with camera pan and pinch/wheel zoom.
- Yard grid with storage slots; laden and empty zones.
- Individual container objects, classified laden or empty, inspectable (tap shows number, size, cargo, condition, status, location).
- Containers arrive, are surveyed, stored and later dispatched with visible movement by a truck and a reach stacker.
- A few workers moving between posts.
- Visible operational status (queues, counts, per-container status).
- Revenue accrues from handling and storage; one upgrade can be bought and measurably changes throughput.
- Runs at a steady frame rate on a mid-range Android phone; `npm run ci` green; handoff updated.

## Task breakdown

Tests listed are required, not optional. "Core" files are under `src/core`.

| ID | Task | Depends on | Files / modules | Acceptance | Tests | Risks |
|---|---|---|---|---|---|---|
| P1-01 | Sim kernel: fixed-timestep `advance`, seeded RNG, event list | none | `core/simulation/{clock,rng,advance,events}.ts` | Same seed and ticks give identical state and events | Determinism golden-seed; RNG sequence test | Scope creep into departments |
| P1-02 | Iso math and grid: grid-to-screen and back, depth sort key, tile ratio decision | art: grid ratio from ChatGPT | `core/yard/iso.ts` (pure), `render/IsoView.ts` | Round-trip conversions exact; one agreed tile ratio | Property test grid<->screen; depth sort ordering cases | Pack tiles are 256x150 (not 2:1): wrong ratio makes seams |
| P1-03 | Yard model: blocks, rows, slots, stack height, laden/empty zones, occupancy ratio | P1-01 | `core/yard/yard.ts` | Place/remove respects capacity, zone and stacking; occupancy computed | Capacity, zone, stack, occupancy unit tests | D7 zoning rule undecided: make zone strictness config |
| P1-04 | Composition root and boundaries: `PlatformAdapter` (web), `SaveStore` (local, versioned), config loading | none | `platform/web.ts`, `persistence/{store,envelope}.ts`, `config/` | Save, reload, version migration stub works; core untouched by platform | Save round-trip; migration test with frozen v1 fixture | Over-building before need |
| P1-05 | Depot scene: ground tiles, buildings placed from a layout config, camera pan/zoom with input abstraction | P1-02 | `render/DepotScene.ts`, `render/camera.ts`, `config/layout.ts` | Pan and zoom smooth on touch and mouse; layout driven by config | Camera clamp and zoom limit unit tests; browser check | Art defects (black tiles, baked text) visible: needs clean art |
| P1-06 | Container rendering and inspection: sprite by `containerSpriteId`, game-drawn cargo/condition badges (not colour only), tap-to-inspect panel | P1-03, P1-05, clean art | `render/ContainerView.ts`, `ui/Inspector` | Selecting a container shows all fields; badges distinguish laden/empty without colour | Sprite-id mapping (exists); inspector data-binding test | Baked text: block until label-free sprites or strip at load |
| P1-07 | Phase-1 operations: arrival generator, gate queue, survey step, store-in-yard, dispatch, using `transition()` | P1-01, P1-03 | `core/simulation/{gate,survey,yardops,dispatch}.ts` | Containers progress through valid transitions only; queues grow when capacity is short | Integration run over N ticks; invalid-transition rejection; queue growth under low capacity | Rules provisional (D1-D7) |
| P1-08 | Moving actors: truck path in/out, reach stacker moves a container, workers walk between posts; state-driven, no scripted loops | P1-05, P1-07 | `render/actors/*`, `core` events -> actor commands | Visible link between sim events and animation; no animation changes sim state | Event-to-command mapping tests | No animation frames in pack: use tweened static sprites |
| P1-09 | HUD and dashboard slice: cash, total/laden/empty chips, queue counts, one department sheet | P1-07 | `ui/Hud`, `ui/DeptSheet`, DOM overlay or Phaser UI (decide here) | Numbers match sim state exactly; 48 px touch targets | View-model tests; browser check at 360x800 | Reference HUD implies XP and gems (D11) |
| P1-10 | Economy slice and one upgrade: handling + storage revenue from config, one capacity upgrade (e.g. survey capacity) | P1-07 | `core/economy/*`, `config/economy.*` | Upgrade raises throughput, costs upkeep; cash never negative from rounding | Fee formulas, money conservation, upgrade effect | Balance is placeholder until D8 |
| P1-11 | Audio hookup: unlock on first gesture, music loop, SFX on events | P1-05 | `render/audio.ts` | Sounds play on a real phone after first tap | Mapping test; manual device test by Producer | Headless cannot verify audibility |
| P1-12 | Performance pass: profile on mid-range Android, texture budget, atlas plan | P1-08 | `docs/` perf note | Stable frame rate with target actor and container counts | Frame-time and memory budget recorded | SVG rasterisation cost; needs device |
| P1-13 | Browser test in CI (optional) | P1-05 | `.github/workflows`, tests | Gallery and scene boot asserted headlessly | Playwright smoke | Adds a dependency; accept only if it pays for itself |
| P1-14 | Handoff, docs sync, changelog, PR | all | `docs/*` | Docs match code; CI green; PR open for review | Full `npm run ci` | None |

## Suggested order

P1-01 and P1-04 in parallel, then P1-03, P1-02, P1-05, P1-07, P1-06, P1-08, P1-09, P1-10, P1-11, P1-12, P1-14. P1-13 anywhere after P1-05.

## Gates

- Before P1-05 and P1-06 ship visibly: ChatGPT delivers label-free container, vehicle, building, worker SVGs, corrected asphalt/concrete tiles, anchors and a settled grid ratio.
- Before P1-09 ships: D9 and D11 answered.
- Before P1-07 hardens: D1-D7 answered, or the Producer confirms the provisional rules.

## Phase 1 risks (summary)

Art not at reference quality; iso depth sorting; SVG cost on phones; scope creep into later departments; rule ambiguity; testing only headless for audio and perf. Each is mitigated by gating tasks above, config-driven rules, device testing by the Producer, and a strict "no new departments in Phase 1" rule.
