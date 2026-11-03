# Changelog

## Unreleased (branch `feature/phase-1-sim-kernel-and-boundaries`, stacked on `feature/phase-0-completion`)

### Added
- Deterministic simulation kernel: seeded RNG, fixed-step stepper, `advance()` with ordered event delivery, canonical JSON and hashing, state validation (`src/core/simulation`).
- Versioned save envelope with checksum and migration foundation, `SaveStore`, Web Storage store, typed save/load (`src/persistence`).
- `PlatformAdapter` and web implementation (`src/platform`); composition root and `SimRuntime` with autosave, pause-save and save lock (`src/app`); sim config placeholders (`src/config/sim.ts`).
- 65 new tests (117 total, up from 52), frozen v1 save fixture, browser persistence check.

### Changed
- ESLint: `src/core` forbids clocks, `Math.random`, `crypto`, and imports of `config` and `app`.
- Boot scene shows sim tick and save status (wiring check).
- CI workflow now runs on pull requests to any branch (stacked PRs previously got no checks).

## Phase 0 (branch `feature/phase-0-completion`)

### Added
- Asset Pack v1.1 integrated: 68 game files (58 SVG, 10 WAV) and 2 concept PNGs under `assets/`; pack manifest kept as `assets/pack-manifest-v1.1.json`.
- Central asset registry `src/assets/manifest.ts` and Vite URL resolution `src/assets/urls.ts`; `containerSpriteId()` and semantic `AUDIO` keys.
- Boot scene loads every registered SVG and audio file through Phaser and shows a gallery (foundation check, not gameplay).
- Container domain model: three independent axes, workflows (STANDARD, OFFHIRE, REPO), data-driven combination and transition rules, `createContainer`, `transition`, `moveContainer` (`src/core/container/`).
- Tests: 51 across container types, rules and workflows, asset registry, audio headers and SVG sanity.
- Docs completed: GDD v0.1, technical architecture, operational workflows with diagrams, container data model, economy design v0.1, asset specification v1.1, roadmap, `PHASE_1_PLAN.md`, handoff.
- `scripts/browser-check.py`: optional real-browser asset check.
- `@types/node` dev dependency (needed to typecheck fs-based tests).

- `docs/ART_FOLLOWUPS.md` review checklist; registry `status: 'starter'` on every asset; gallery caption and `assets/STARTER_ASSETS.md` mark art as placeholder (52 tests).

### Changed
- ESLint core-isolation rule now also blocks `src/core` importing `src/assets`.
- Vite `assetsInlineLimit: 0` so assets always stay real files.
- README corrected: it said `main` is protected, which is not true. Added owner instructions for privacy, protection and description.
- Operational statuses extended with `AWAITING_SURVEY` and `AWAITING_ASSESSMENT`.

### Known issues
See `docs/ASSET_SPECIFICATION.md` section 4 and `docs/AI_HANDOFF.md`.

## 0.0.1 — initial scaffold (`a7932f8`)
Vite, TypeScript strict, Phaser 3 boot scene, ESLint, Vitest, CI workflow, directory layout, docs stubs.
