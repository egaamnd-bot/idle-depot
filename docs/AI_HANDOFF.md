# AI Handoff Log

Newest entry first. Each entry: implemented, files, architecture decisions, tests and results, known issues, outstanding work, next steps.

## 2026-11-03 — Phase 1 foundation: simulation kernel and platform boundaries (branch `feature/phase-1-sim-kernel-and-boundaries`)

Scope: P1-01 and P1-04 only, as instructed. **No yard zoning, occupancy, container placement, workflows, economy balance, isometric rendering, Android or Telegram work was done or hardened.**

### 1. Review follow-up on PR #1 (branch `feature/phase-0-completion`, still open, not merged)
- Checklist posted as a PR comment and committed as `docs/ART_FOLLOWUPS.md`: baked-in text (31 files), black asphalt/concrete tiles, cargo colour (needs Producer D9 first), missing anchors, missing animation frames, unresolved grid ratio, plus the quality gap. Each item has a verifiable "done when". All owned by ChatGPT.
- All Asset Pack v1.1 assets are marked **starter**: registry `status: 'starter'` (pinned by a test), gallery caption, `assets/STARTER_ASSETS.md`.
- CI for that PR head (`d8fb8f6`): success.

### 2. Implemented
- **Kernel** (`src/core/simulation`): seeded RNG (mulberry32, state is one uint32 saved with the game), `FixedStepper`, `advance()` (fixed timestep, deterministic event delivery in `(at, order)` order, input never mutated, split-invariant), strict canonical JSON and 32-bit hash, state validation, minimal `DepotWorld`.
- **Persistence** (`src/persistence`): versioned envelope with checksum, migration chain (`CURRENT_SAVE_VERSION = 1`, no real migrations yet), `SaveStore`, `StorageSaveStore`, `saveState`/`loadState` returning typed errors instead of throwing.
- **Platform boundary** (`src/platform`): `PlatformAdapter` (time, seed, storage, lifecycle) and a web implementation with a safe memory fallback. `telegram` and `android` ids are reserved only.
- **Composition root and runtime** (`src/app`): boot policy (new / resume / locked), autosave every 30 ticks and on pause, serialised saves, **saving is locked if an unreadable save exists so it is never overwritten**. Boot scene shows the tick counter and save status as a wiring check only.
- **Config**: `src/config/sim.ts` holds the placeholder `tickMs = 1000`, autosave and catch-up limits. `tickMs` is PROVISIONAL pending Producer decision D10.
- **Lint guards**: `src/core` may not use `Math.random`, `Date`, `performance` or `crypto`, and may not import `config` or `app` (probed: each fires).

### 3. Files
Created: `src/core/simulation/{rng,stepper,hash,types,advance,validate,world}.ts`, `src/persistence/{envelope,store,saveGame}.ts`, `src/platform/{types,web}.ts`, `src/app/{compose,runtime}.ts`, `src/config/sim.ts`, `tests/{sim-kernel,persistence,runtime}.test.ts`, `tests/helpers.ts`, `tests/fixtures/save-v1.json`.
Modified: `src/main.ts`, `src/render/BootScene.ts`, `eslint.config.js`, `scripts/browser-check.py`, `README.md`, `docs/{TECHNICAL_ARCHITECTURE,ROADMAP,PHASE_1_PLAN,CHANGELOG,AI_HANDOFF}.md`.

### 4. Architecture decisions
- Kernel is generic over the world; departments plug in later as `systems` and `handlers`. `DEPOT_MODULES` is empty on purpose.
- Two event kinds: `emit` (notification) and `schedule` (future command). Unknown scheduled types throw, never vanish.
- Core stays pure; clocks and entropy live in the platform adapter. Checksum is corruption detection, not security (client is untrusted; server authority comes in Phase 7).
- Provisional container rules from Phase 0 remain provisional and are untouched.

### 5. Tests and actual results (local)
- `npm run ci`: lint clean, typecheck clean, **117 tests in 6 files pass**, build succeeds (phaser chunk unchanged at 1.48 MB / 340 KB gzip; app code 22 KB).
- Determinism golden test (seed 42, 300 ticks): counts cross-checked against an independent Python re-implementation (112 arrived, 110 surveyed, 222 events, 2 pending, seq 334); RNG checked against an independent mulberry32 reference.
- Mutation check on the safety-critical paths (lock, checksum, input immutability, tie-break, version guard): 5 of 5 mutants are now caught. One (tie-break) initially survived; a test was added.
- Browser (headless Chromium, built bundle): 58/58 SVG, 10/10 audio, 0 errors; new game, saved on pause at tick 3, reload resumed as "loaded" at tick 3.
- Found and documented while testing: fractional frame deltas can shift the tick count by one at a boundary (time is conserved). Exact for integer milliseconds.
- `npm audit --omit=dev`: 0. Dev-tooling findings unchanged.
- Not tested: real devices, audio audibility, mobile performance, storage quota behaviour on real browsers.

### 6. CI status
Phase 0 PR head `d8fb8f6`: success. This branch: see the new PR's checks (not known when this note was written).

### 7. Known issues and limits
- Single save slot, no backup slot. If a write is interrupted mid-way the checksum detects it, and the app then locks rather than overwriting, but the progress is not recoverable.
- `structuredClone` of the whole state each `advance` call is fine at this size; revisit when the world grows (profile in P1-12).
- Offline progression is not implemented (by design, Phase 4 and 7).
- Art and rule gates from `docs/PHASE_1_PLAN.md` still block P1-02, P1-03, P1-05 to P1-10.

### 8. Outstanding Producer decisions (unchanged, D1-D15)
D10 (time scale) is the first one this work touches: `tickMs = 1000` is a placeholder. Nothing was converted into a permanent rule; when decisions arrive they replace the provisional tables in `src/core/container/rules.ts` and `src/config`.

### 9. Recommended next
After review: P1-03 yard model only once D7 (zoning) and D15 (occupancy thresholds) are decided, or the Producer confirms they should be configuration with neutral defaults. Otherwise wait for art and rules. A safe interim task needing no decisions: a simulation event log viewer (debug overlay) to make determinism visible during review.

## 2026-11-03 — Phase 0 completion, Asset Pack v1.1 integration (branch `feature/phase-0-completion`)

### 1. Repository corrections
- Work is on `feature/phase-0-completion`; nothing committed to `main`.
- README corrected (it falsely said `main` is protected). Owner instructions for visibility, protection and description added.
- **Verified live, not assumed**: repository is still **public**, description is **empty**, `main` is **not protected**. The build environment's GitHub proxy returns 403 for repository-settings writes, so I could not change any of them. These are owner actions; steps are in `README.md`. I have not claimed any of them done.
- `scripts/protect-main.sh` kept for use from an authenticated machine.

### 2. Documentation completed
GDD v0.1, technical architecture (with scaffold review), operational workflows (3 validated Mermaid diagrams), container data model, economy design v0.1 (structure only, no balance numbers), asset specification v1.1, roadmap, `PHASE_1_PLAN.md` (new), changelog, this handoff. Decision IDs D1-D15 are consistent across documents.

### 3. Asset Pack v1.1 integration
- Integrated all 68 game files (58 SVG, 10 WAV) into the existing tree; concept PNGs stored under `assets/concept/` as art direction only (not matched by the loader).
- Registry, loader, gallery scene, tests. Pack names and logical IDs preserved (ID = file stem).
- **Result in a real browser (headless Chromium, built bundle)**: 58/58 SVGs and 10/10 audio files loaded through Phaser; no console errors, no HTTP errors; all 10 WAVs decode. Audible playback is not verifiable headless; needs a device check by the Producer.
- **Honest assessment**: v1.1 is a clear step up from flat, but does not yet match the reference. See below and `ASSET_SPECIFICATION.md` section 3.

### 4. Files
Created: `src/assets/{manifest,urls}.ts`, `src/core/container/{rules,container}.ts`, `tests/{asset-registry,container-rules}.test.ts`, `docs/PHASE_1_PLAN.md`, `scripts/browser-check.py`, `assets/**` (pack files), `assets/pack-manifest-v1.1.json`, `assets/PACK_README_v1.1.md`.
Modified: `README.md`, all other `docs/*.md`, `src/core/container/types.ts`, `src/render/BootScene.ts`, `tests/container-types.test.ts`, `eslint.config.js`, `vite.config.ts`, `tsconfig.json`, `package.json`, `package-lock.json`.
Removed: `assets/placeholders/` (superseded) and `.gitkeep` files in now-populated folders.

### 5. Architecture decisions
- Core isolation extended to assets (found by probe that the assets import was not blocked).
- Rules are data tables, provisional where the brief is silent.
- Config values are injected into core; core defines types only.
- DOM overlay vs Phaser UI deferred to P1-09.
- No new frameworks. Only new dev dependency: `@types/node`.

### 6. Tests and actual results (local, final state)
- `npm run lint`: clean.
- `npm run typecheck`: clean.
- `npm run test`: 3 files, 51 tests, all passing (container types 4, container rules and workflows 32, asset registry 15).
- `npm run build`: succeeds; phaser chunk 1.48 MB (340 KB gzip).
- Browser check: 58/58 SVG, 10/10 audio, 0 errors.
- Mermaid: 4/4 diagrams parse.
- `npm audit`: 0 vulnerabilities in production dependencies; 14 in dev tooling (2 critical, 12 moderate; vitest transitive `tinypool`). Fix is a breaking vitest major; left for its own PR.
- Not tested: audible playback, mobile performance, Android, Telegram (none exist yet).

### 7. CI status
GitHub Actions on `main` (`a7932f8`): success. For this branch, the result is on the pull request's checks; it was not known when this note was written.

### 8. Known issues
1. 31 SVGs have text baked in (containers, vehicles, buildings, workers, logo), against the pack's own rule. Registry flags them; test pins the count.
2. Asphalt and concrete tiles render with a black half (stroke-only paths without `fill="none"`). Visible in the gallery.
3. Vehicles, buildings and workers are near-identical templates; no animation, atlases, anchors or collision bounds.
4. Cargo colour conflict between sprites (Empty blue / Laden red) and the reference HUD (Laden green / Empty amber).
5. Pack tile art is 256x150, not a 2:1 isometric ratio.
6. The reference image shows a real shipping line's name; avoid in game art.
7. Repository public, unprotected, no description (owner actions).
8. `UNDER_INSPECTION` and `REPAIR_REQUIRED` have no dedicated sprites (provisional mapping to AV and DM).

### 9. Outstanding Producer decisions
D1-D7 (operational rules, `OPERATIONAL_WORKFLOWS.md` section 6) and D8-D15 (`GAME_DESIGN_DOCUMENT.md` section 10): tariffs, colours, time scale, XP and currencies, offline trust, real data in a public repo, container numbering, congestion thresholds. Also: make the repo private (note plan limits for branch protection).

### 10. Phase 1 proposal
`docs/PHASE_1_PLAN.md`: 14 tasks with dependencies, files, acceptance, tests and risks. Recommended first branch after review: `feature/phase-1-sim-kernel-and-boundaries` (tasks P1-01 and P1-04), which needs no art or Producer decisions. Art-dependent tasks (P1-05, P1-06) wait for clean ChatGPT assets.

### Requests to ChatGPT
Label-free SVGs for the 31 files; fix asphalt and concrete tiles; per-asset anchors; settle isometric tile ratio; distinct vehicle, building and worker designs closer to the reference; UNDER_INSPECTION and REPAIR_REQUIRED treatment; production atlases and animation frames.

## 2026-11-03 — Repository scaffold (Phase 0, step 1) (`a7932f8`)

Implemented the initial scaffold: Vite, TypeScript strict, Phaser 3 boot scene, ESLint with core-isolation rule, Vitest, GitHub Actions CI, directory layout, asset directory tree, documentation stubs. Local CI passed; GitHub CI run succeeded. Repository was created by the Producer because the build environment could not create repositories.
