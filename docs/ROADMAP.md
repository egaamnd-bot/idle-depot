# Roadmap

| Phase | Scope | Status |
|---|---|---|
| 0 | Foundation: repo, design docs, architecture, data model, economy, asset registry and integration, test infra | Accepted in principle; PR #1 open, not merged, review checklist in `docs/ART_FOLLOWUPS.md` |
| 1 | Playable depot vertical slice | In progress. P1-01 (sim kernel) and P1-04 (boundaries, versioned saves) done on `feature/phase-1-sim-kernel-and-boundaries` (PR pending review). Remaining tasks gated on D1-D15 and clean art, see `docs/PHASE_1_PLAN.md` |
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
