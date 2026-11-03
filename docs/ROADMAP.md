# Roadmap

| Phase | Scope | Status |
|---|---|---|
| 0 | Foundation: repo, design docs, architecture, data model, economy, asset registry and integration, test infra | Complete pending Producer and ChatGPT review (PR `feature/phase-0-completion`) |
| 1 | Playable depot vertical slice | Planned: `docs/PHASE_1_PLAN.md`. Gated on Producer decisions D9, D11, D13 and clean art (see below) |
| 2 | Core operations: gate, survey in/out, yard storage, dispatch, laden/empty | Not started. Needs D1-D7 |
| 3 | Operational management: workshop, equipment, employees, queues, maintenance | Not started |
| 4 | Idle economy: revenue, expenses, dashboard, upgrades, offline (local, capped) | Not started. Needs D8, D10, D12, D15 |
| 5 | Advanced operations: off-hire, repo, contracts, SLA, customers, incidents | Not started |
| 6 | Expansion: blocks, automation, multiple depots, regional network | Not started |
| 7 | Distribution: Telegram Mini App, backend auth, cloud saves, sync, Capacitor Android, release | Not started |

## Dependencies that can block Phase 1

1. **Art**: ChatGPT to deliver label-free SVGs, fixed tiles, anchors and a settled iso grid ratio. Without them the world renders but looks wrong. Phase 1 can start with the sim and camera work while art catches up.
2. **Decisions**: D9 (colours), D11 (HUD currencies), D13 (public repo data).
3. **Repo settings**: private visibility and `main` protection are owner actions.

## Principles

Build incrementally; do not implement phases together. Each phase ships code, tests, docs, a build and a handoff note. Capacitor, Telegram and cloud persistence arrive progressively, not all at once.
