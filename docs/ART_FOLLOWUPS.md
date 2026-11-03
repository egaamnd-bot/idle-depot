# Art Follow-ups for Asset Pack v1.2

Owner of every item: **ChatGPT** (Asset Production Lead), unless marked Producer. Engineering does not generate replacement art. All Asset Pack v1.1 files are **STARTER assets** (`status: 'starter'` in `src/assets/manifest.ts`) until each is replaced; a test pins this so a replacement forces a deliberate registry change.

Each item has a "done when" so reviewers can verify it without opinion.

## 1. Baked-in text (31 SVGs)
- [ ] Re-export without any `<text>` element: 12 containers, 6 vehicles, 6 buildings, 6 workers, `logo-idle-depot`.
- Done when: `grep -l "<text" assets -r` returns nothing for game sprites, and `hasBakedText` is cleared in the registry (test `records the known baked-text defect` updated from 31 to 0). Building signage that must stay in the art is delivered as a separate text-free sign plate; the game draws the words.

## 2. Black rendering defects (asphalt, concrete)
- [ ] Fix `tiles/asphalt.svg` and `tiles/concrete.svg`: stroke-only paths lack `fill="none"`, so the SVG default black fill shows.
- [ ] Audit every other SVG for the same omission (many harmless straight lines, but any closed or bent path is a latent defect).
- Done when: both tiles render with no black region in Chromium, verified with `scripts/browser-check.py` screenshot reviewed by the Producer.

## 3. Cargo colour inconsistency (decision first)
- [ ] **Producer decides (D9)**: Laden/Empty palette. Sprites currently use Empty blue / Laden red; the reference HUD uses Laden green / Empty amber.
- [ ] ChatGPT applies the chosen palette to container sprites, HUD chips and icons.
- [ ] Cargo status and condition are also conveyed without colour (shape, icon or badge), per the accessibility rule.
- Done when: one palette is documented in `ASSET_SPECIFICATION.md` and every container, chip and icon follows it.

## 4. Missing anchors
- [ ] Per-asset ground-contact anchor and separate collision bounds delivered in a machine-readable file (`assets/anchors.json`: id, anchorX, anchorY, bounds).
- Done when: every world sprite has an entry and the registry uses it instead of `DEFAULT_WORLD_ORIGIN`.

## 5. Missing animation frames
- [ ] Worker walk: 4 directions x 4 frames. Vehicle drive: 4 directions x 2-4 frames. Reach-stacker lift: 4 frames. Repair: 4 frames.
- [ ] Frames delivered as PNG/WebP atlases with JSON frame data, plus the registry-facing IDs.
- Done when: atlases load in the gallery scene and each animation plays at its documented frame rate.

## 6. Unresolved isometric grid ratio
- [ ] Settle one tile ratio with engineering (pack tiles are 256x150, ratio 1.71:1; a standard 2:1 diamond would be 256x128). Reconcile all tiles, buildings and props to it.
- Done when: the ratio is written in `ASSET_SPECIFICATION.md` section 6, all ground tiles tessellate without seams in a test scene, and engineering task P1-02 can start.

## 7. Quality gap to the reference (not in the original review, recorded for completeness)
- [ ] Distinct designs for reach stacker, terminal tractor, container truck, forklift (recognisable machines), six distinct buildings, workers with more than one pose, shipping-line liveries using fictional lines (no real brand names).
- [ ] Treatment for UNDER_INSPECTION and REPAIR_REQUIRED, or confirmation that game-drawn overlays are used instead.
- Done when: the Producer signs off on a comparison against `assets/concept/producer-visual-reference.png`.

## Status rule
Items stay unchecked until the replacement is merged and the registry test expectations are updated in the same PR. Phase 1 tasks that show art in the world (P1-05, P1-06) are gated on items 1, 2, 4 and 6.
