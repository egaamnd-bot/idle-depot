# IDLE DEPOT

Isometric container depot management and idle tycoon simulation. **BUILD IT. MOVE IT. FIX IT. GROW IT.**

Targets: web browser, Telegram Mini App, Android (Capacitor), all from one shared codebase.

## Status

Phase 0 (Foundation) — documentation, container data model, asset registry and Asset Pack v1.1 integration. No gameplay yet. See [docs/ROADMAP.md](docs/ROADMAP.md) and [docs/PHASE_1_PLAN.md](docs/PHASE_1_PLAN.md).

## Stack

Phaser 3, TypeScript (strict), Vite, Vitest, ESLint. Planned, added progressively: Capacitor, Telegram Mini Apps SDK, Node.js backend, PostgreSQL/Supabase.

## Getting started

```bash
npm install
npm run dev        # local dev server (asset gallery)
npm run ci         # lint + typecheck + test + build (same steps as GitHub Actions)
```

Optional real-browser asset check (needs Python Playwright; not part of CI):

```bash
npm run build && npx vite preview --port 4173 &
python3 scripts/browser-check.py http://localhost:4173/ gallery.png
```

## Layout

```
src/core/         Deterministic simulation. No Phaser, UI, platform, persistence, asset, config or app imports, no clocks, no Math.random (enforced by ESLint).
src/app/          Composition root and runtime: the only place wiring platform, persistence, config and simulation.
src/assets/       Asset registry (logical IDs -> files). Rendering code uses IDs, never paths.
src/render/       Phaser scenes and rendering.
src/ui/           Management UI.
src/platform/     Web / Telegram / Android adapters.
src/persistence/  Save, load, sync.
src/config/       Economy and balance data.
assets/           Sprites, tiles, UI, audio, and concept art (art direction only, never loaded by the game).
docs/             Design, architecture, workflows, economy, asset spec, roadmap, handoff.
tests/            Unit and integration tests.
scripts/          Repository tooling.
```

## Workflow

Work happens on feature branches and is merged through pull requests; CI must pass. **Branch protection on `main` is not enabled yet** (see below), so this is currently a convention, not an enforced rule. Every substantial change updates the docs and adds an entry to `docs/AI_HANDOFF.md`.

## Repository settings that need the repository owner

These cannot be done by the build environment and are **not yet done** unless noted in `docs/AI_HANDOFF.md`.

**Make the repository private** (it is currently public): GitHub > Settings > General > Danger Zone > Change repository visibility > Make private.

**Protect `main`**: Settings > Branches > Add branch ruleset (or classic rule) for `main`: require a pull request before merging; require status check `Lint, typecheck, test, build`; block force pushes and deletions. Or, with an authenticated `gh` and admin rights, run `scripts/protect-main.sh OWNER/idle-depot`. Branch protection on private repositories depends on your GitHub plan.

**Repository description**: Settings > General: `IDLE DEPOT — Isometric Container Depot Management & Idle Tycoon Simulation`.
