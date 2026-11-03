# IDLE DEPOT

Isometric container depot management and idle tycoon simulation. **BUILD IT. MOVE IT. FIX IT. GROW IT.**

Targets: web browser, Telegram Mini App, Android (Capacitor), all from one shared codebase.

## Status

Phase 0 — Foundation. Repository scaffold only; no gameplay yet. See [docs/ROADMAP.md](docs/ROADMAP.md).

## Stack

Phaser 3, TypeScript (strict), Vite, Vitest, ESLint. Planned: Capacitor, Telegram Mini Apps SDK, Node.js backend, PostgreSQL/Supabase.

## Getting started

```bash
npm install
npm run dev        # local dev server
npm run ci         # lint + typecheck + test + build (same as GitHub Actions)
```

## Layout

```
src/core/         Simulation. No Phaser, Telegram or Android imports (enforced by ESLint).
src/render/       Phaser scenes and rendering.
src/ui/           Management UI.
src/platform/     Web / Telegram / Android adapters.
src/persistence/  Save, load, sync.
src/config/       Economy and balance data (no scattered magic numbers).
assets/           Replaceable sprites, animations, audio, UI (see docs/ASSET_SPECIFICATION.md).
docs/             Design, architecture and handoff documents.
tests/            Unit and integration tests.
```

## Workflow

`main` is protected. Work on feature branches, open a pull request, CI must pass. Every substantial change updates the docs and adds an entry to `docs/AI_HANDOFF.md`.
