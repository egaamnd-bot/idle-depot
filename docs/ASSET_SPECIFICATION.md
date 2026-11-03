# Asset Specification v1.1

Asset production owner: ChatGPT. Integration owner: Claude. Art direction owner: Producer.

## 1. Visual identity

The Producer's reference image `assets/concept/producer-visual-reference.png` is the primary art-direction document. `assets/concept/idle-depot-visual-direction.png` is the earlier concept board. **Neither is a sprite sheet and neither is ever sliced or loaded by the game.** The loader only matches `assets/{sprites,tiles,ui,audio}`.

Target: premium, colourful isometric 2.5D tycoon. Dimensional objects with shadows and highlights; white and steel-blue industrial buildings; saturated ribbed containers; detailed yellow reach stackers and forklifts; recognisable trucks and terminal tractors; small uniformed workers in helmets; clean roads and yard markings; dark navy rounded UI panels; bright dimensional department icons; readable on a phone. Do not revert to flat vector icon style.

## 2. What v1.1 actually contains

68 game files (58 SVG, 10 WAV), all registered in `src/assets/manifest.ts` (logical ID = file stem from the pack), plus 2 concept PNGs that are not registered:

| Group | Count | Notes |
|---|---|---|
| Containers | 12 | 20FT / 40FT / 40HC x EMPTY / LADEN x AV / DM |
| Vehicles | 6 | container truck, forklift, fuel truck, reach stacker, terminal tractor, yard truck |
| Buildings | 6 | admin, equipment shed, gate complex, repair workshop, survey building, warehouse |
| Workers | 6 | gate staff, manager, operator, surveyor, technician, yard worker |
| Environment | 5 | fence, gate barrier, street light, traffic cone, tree |
| Tiles | 5 | asphalt, concrete, grass, stack marking, yard slot |
| UI | 18 | 12 department icons, 5 panel/button skins, 1 logo |
| Audio | 10 | 2 music loops (16 s), 8 SFX. WAV, 22,050 Hz, mono, 16-bit. Retained from v1.0 unchanged |

## 3. Honest production status

Every v1.1 asset is a **STARTER asset** (`status: 'starter'` in the registry, `assets/STARTER_ASSETS.md`). The replacement checklist with verifiable "done when" criteria is `docs/ART_FOLLOWUPS.md`.

v1.1 is **modular SVG starter art**, not finished production sprites. It is clearly better than v1.0 but **does not yet match the reference image**. Remaining work, all ChatGPT's:

- Vehicles are small car-like silhouettes; the reach stacker, terminal tractor and container truck are not yet recognisable as those machines. The reference shows detailed, distinct machines.
- All six buildings share one template and differ only by a label. The reference shows distinct, detailed buildings.
- All six workers share one pose and body; only colours differ.
- Containers are one colour per cargo status with no shipping-line livery or corrugation detail at the reference's level; DM is a single crack mark.
- No animation frames exist: no walk cycles, vehicle directions, lift or repair sequences.
- No atlases, no per-asset anchors, no hit/collision bounds, no night variants.
- Missing assets: yard blocks/stacks as grouped pieces, roads, gates, office decoration, UI chips and counters shown in the reference HUD, fonts, backgrounds, effects, ambient audio.
- The 10 audio files are synthetic placeholders.

## 4. Known pack defects (found during integration)

1. **Baked-in text in 31 SVGs**: all 12 containers (e.g. "20FT • LADEN • AV"), 6 vehicles, 6 buildings, 6 workers and the logo. This breaks the pack's own rule that dynamic text must be drawn by the game. Container captions are also wrong the moment a container's state changes. The registry flags these (`hasBakedText`) and a test pins the count at 31. **Phase 1 cannot show these sprites in-world until clean versions arrive.** Request to ChatGPT: re-export without `<text>`.
2. **Asphalt and concrete tiles render with a black lower half** in Chromium (and in Phaser). Cause: stroke-only `<path>` elements without `fill="none"`, so the SVG default black fill appears. Visible in the gallery build. Many other files have the same omission but happen to be straight lines with no visible fill.
3. **Colour conflict**: pack sprites use EMPTY = blue, LADEN = red. The reference HUD uses Laden = green, Empty = amber. One scheme must be chosen (Producer decision D9). Cargo status and condition must also never be conveyed by colour alone (game-drawn icon or badge).
4. **No anchors**: spec requires ground-contact anchors but the pack ships none. `DEFAULT_WORLD_ORIGIN` (0.5, 0.88) is a provisional guess used until supplied.
5. **Real brand names in the reference image** (e.g. "MSC" on containers). Do not reproduce real shipping-line names or logos in game art. Use fictional lines.

Pack files are kept exactly as delivered so provenance stays clean; they are not patched by engineering.

## 5. Integration rules

- Code refers to logical IDs from `src/assets/manifest.ts`. No asset path appears in gameplay or rendering logic.
- Files live under `assets/` and are resolved through Vite (`src/assets/urls.ts`) so hashed, relative-base URLs work on web, Telegram and Capacitor. `assetsInlineLimit` is 0: assets are always real files.
- Replace art by overwriting the file (same name) or editing one registry line. No gameplay change required.
- SVGs are rasterised by Phaser at `min(devicePixelRatio, 2)`. For production, rasterise to PNG/WebP and pack into atlases; the registry stays the single indirection.
- `containerSpriteId(size, cargo, condition)` chooses the sprite. v1.1 only has AV and DM art, so UNDER_INSPECTION uses AV and REPAIR_REQUIRED uses DM (provisional). Inspection state is shown with a game-drawn overlay.
- Anchors at the ground contact point, not visual centre. Collision bounds are separate from art bounds.
- Dynamic text (container numbers, cargo, condition, status) is always rendered by the game.
- Audio uses semantic keys (`AUDIO.sfx.containerDrop`) mapped to IDs, so files can be swapped freely. Music loops; browsers need a user gesture before audio starts, handled at first tap.

## 6. Conventions for new deliveries

- IDs: lowercase kebab-case, stable, unique across all groups. Containers: `container-{20ft|40ft|40hc}-{empty|laden}-{av|dm}`.
- Isometric grid (proposal, to confirm in Phase 1): the pack's tile art is 256 x 150 px (ratio 1.71:1), which is not the standard 2:1 diamond. Phase 1 task P1-02 must settle one grid ratio with ChatGPT before any art is placed in-world.
- Formats: SVG for starter art; PNG/WebP + JSON atlas for production; WAV or OGG for audio (OGG preferred for size on mobile).
- Animation frame requirements (target): worker walk 4 directions x 4 frames; vehicle drive 4 directions x 2-4 frames; reach-stacker lift 4 frames; repair 4 frames. Not delivered yet.
- Every delivery ships an updated manifest, a list of changes, and passes `npm run ci`.

## 7. Verification performed

58/58 SVGs and 10/10 audio files load through Phaser in headless Chromium with zero console or HTTP errors; all 10 WAVs decode in the browser's AudioContext. Headless runs cannot confirm audible playback; that needs a device test by the Producer.
