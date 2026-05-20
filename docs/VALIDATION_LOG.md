# Validation Log

Append-only log of major validation runs. Newest entries on top.

---

## Phase 9 Hotfix — RPG Maker scale and no-lag movement

**Date**: 2026-05-19

### Commands run

| Command | Result | Notes |
|---------|--------|-------|
| `npm test -- --run src/playtest/__tests__/tileFluidMotion.test.ts src/validation/__tests__/validateProject.test.ts src/validation/__tests__/bundledSample.test.ts` | FAIL -> PASS | Initial RED covered missing movement-speed helper, missing `displayHeightTiles`/system validation, and missing bundled defaults. Final: 26/26 focused tests passed. |
| `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1 -SkipSmoke` | PASS | Configure/build/CTest passed using the repo's MSVC bootstrap and out-of-OneDrive build dir. |
| `npm test` | PASS | 18 files, 107 tests. |
| `npm run build` | PASS | `tsc --noEmit` and `vite build` passed. |
| `cargo test --manifest-path src-tauri/Cargo.toml --lib` | PASS | 17/17 Rust tests. |
| `%LOCALAPPDATA%\RPGCreatorAI\build\rpg_creator_runtime.exe --smoke-shots docs/screenshots/phase-9-animation-hotfix` | PASS | Runtime wrote the full smoke set plus Phase 9 hotfix frames. |
| Screenshot bbox audit for `phase9-01-walk-midstep.bmp` | PASS | Player bbox measured `48px` high in the runtime smoke screenshot. |
| Playwright browser check at `http://127.0.0.1:5173` | PASS | Editor preview player clip was `48px` high and moved `12.8px` within 80ms of holding `W`; screenshot saved as `editor-preview-playtest.png`. |
| `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1` | PASS | Final configure/build/CTest plus runtime 3-second smoke passed with `SMOKE PASSED`. |
| Pre-commit rerun at `2026-05-19 02:29:09 -03:00`: `npm test`; `npm run build`; `cargo test --manifest-path src-tauri/Cargo.toml --lib`; `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1` | PASS | Fresh closeout validation: 107/107 Vitest tests, Vite build, 17/17 Rust tests, CTest, and runtime smoke passed. |

### Fixes applied

- Removed sprite padding from runtime entity drawing and made character
  render rects bottom-center on the logical tile.
- Added animation-set display metadata, event display-height overrides,
  and system-level `playerMovementSpeed` / `defaultCharacterHeightTiles`.
- Changed the bundled sample to `playerMovementSpeed: "double"` and kept
  tile logic/collision/saves unchanged.
- Updated editor playtest preview to use the runtime display rules,
  memoize static map/event layers, and start/chained held movement in the
  same visual update.

### Final pass/fail

- Frontend: PASS
- C++ runtime: PASS
- Rust shell: PASS
- Runtime smoke screenshots: PASS
- Editor browser preview: PASS

## Phase 8 — Slice 1 Game Visual Source of Truth + Visual Profile

**Date**: 2026-05-17

### Commands run

| Command | Result | Notes |
|---------|--------|-------|
| `npx vitest run src/visual/__tests__/visualProfile.test.ts src/adapters/__tests__/BrowserMemoryAdapter.test.ts` | FAIL → PASS | Initial RED: missing `visualProfile` module and no seeded profile. Final: 9/9 tests passed after implementation. |
| `cmd /c scripts\dev\verify-runtime.bat` | FAIL → PASS | Initial RED: `ProjectData` had no `visualProfile`. Final: C++ build succeeded and `RPGTests` passed. |
| `npx tsc --noEmit` | PASS | 0 errors after the profile implementation. |

### Fixes applied

- Added `docs/GAME_VISUAL_DESIGN.md` as the binding visual standard and
  `docs/GAME_VISUAL_QA.md` as the scorecard.
- Reset governing docs to Phase 8 and declared the visual design document
  as the source of truth.
- Added a backward-compatible project `visualProfile` with safe editor
  normalization and safe runtime defaults for legacy JSON.

### Final pass/fail

- Frontend focused tests: PASS
- C++ runtime focused validation: PASS
- TypeScript compile: PASS

## Phase 8 — Slice 2 Shared Viewport / Camera Model

**Date**: 2026-05-18

### Commands run

| Command | Result | Notes |
|---------|--------|-------|
| `npx vitest run src/visual/__tests__/viewport.test.ts` | FAIL → PASS | Initial RED: missing `viewport.ts`. Final: 3/3 tests passed. |
| `cmd /c scripts\dev\verify-runtime.bat` | FAIL → PASS | Initial RED: `Camera2D` lacked `setViewport`, `follow`, and `centerRoom`. Final: runtime build succeeded and `RPGTests` passed with new camera coverage. |
| `npx tsc --noEmit` | PASS | 0 errors after viewport helpers landed. |

### Fixes applied

- Added shared editor-side viewport math for visible tile span and
  fit-to-view scaling.
- Added runtime camera viewport awareness, clamp-to-bounds follow
  behavior, and fixed-room centering.
- Switched runtime window creation from hardcoded `800x600` to the saved
  project visual profile resolution.

### Final pass/fail

- Frontend focused tests: PASS
- C++ runtime focused validation: PASS
- TypeScript compile: PASS

## Phase 8 — Slice 3 Editor Canvas Scale + Screen Bounds Overlay

**Date**: 2026-05-18

### Commands run

| Command | Result | Notes |
|---------|--------|-------|
| `npx vitest run src/visual/__tests__/viewport.test.ts src/stores/__tests__/editorStore.test.ts` | FAIL → PASS | Initial RED: missing camera-frame helpers and no zoom-mode state. Final: 7/7 tests passed. |
| `npx tsc --noEmit` | PASS | 0 errors. |
| `npx vite build` | PASS | Production bundle built successfully. |
| Live browser verification at `http://127.0.0.1:3000/` | PASS | DOM exposed `Frame 1280×720`, `Fit`, `100%`, and SVG geometry proved stage `1280×720`, map bounds `320×320`, viewport frame `1280×720`. |

### Fixes applied

- Switched the editor from raw-map sizing to a profile-aware scene stage.
- Added fit-to-view / actual-size controls, map bounds, camera rail, and
  current viewport overlay.
- Preserved editing coordinates while supporting stage bounds larger than
  the authored map.

### Final pass/fail

- Frontend focused tests: PASS
- Production build: PASS
- Browser verification: PASS

## Phase 8 — Slice 4 No-Gap Validation + Void Visibility

**Date**: 2026-05-18

### Commands run

| Command | Result | Notes |
|---------|--------|-------|
| `npx vitest run src/validation/__tests__/validateProject.test.ts` | FAIL → PASS | Initial RED: no warnings for void cells and no errors for unsupported tile ids. Final: 13/13 tests passed. |
| `cmd /c scripts\dev\verify-runtime.bat` | PASS | Runtime build/tests remained green after sprite-catalog updates. |
| `npx tsc --noEmit` | PASS | 0 errors. |

### Fixes applied

- Added explicit supported tile-id catalogs for visual and collision
  layers.
- Added warnings for void tiles and errors for unsupported visual /
  collision ids.
- Made editor voids visually unmistakable instead of silently falling
  back to grass.
- Forced nearest-neighbor runtime rendering and routed unknown runtime
  tiles to the future `tile_void_warning` asset key instead of silently
  appearing valid.

### Final pass/fail

- Frontend validation tests: PASS
- C++ runtime focused validation: PASS
- TypeScript compile: PASS

## Phase 7 — Slice 0 Original Asset Foundation

**Date**: 2026-05-17

### Commands run

| Command | Result | Notes |
|---------|--------|-------|
| `npx vitest run src/assets/generated/__tests__/assetCatalog.test.ts` | PASS | 3/3 tests |
| `cmd /c scripts\dev\verify-runtime.bat` | PASS | Added `SpriteCatalog` + `MenuSystem` coverage; `RPGTests` passed |
| `npx tsc --noEmit` | PASS | 0 errors |
| `npx vite build` | PASS | Generated asset PNGs included in production bundle |
| `npx vitest run` | PASS | 10 files, 65 tests |
| `cmd /c scripts\dev\smoke-runtime.bat` | PASS | Runtime spawned, loaded project/databases/map |
| `%LOCALAPPDATA%\RPGCreatorAI\build\rpg_creator_runtime.exe --smoke-shots docs\screenshots\phase-7-assets-smoke` | PASS | 9 screenshots written with committed sprite rendering |

### Fixes applied

- Replaced production emoji placeholders with generated assets or vector
  icons across the editor / playtest UI.
- Added original generated asset atlases plus derived transparent PNG and
  runtime BMP assets.
- Added runtime sprite lookup / texture loading and updated sample event
  sprite ids.
- Wired the pause-menu shell into the runtime and added keyboard
  navigation coverage for the new menu state machine.

### Final pass/fail

- Frontend: PASS
- C++ runtime: PASS
- Runtime smoke: PASS
- Visual smoke shots: PASS

## Phase 2 — Visible Playable RPG Runtime MVP

### Run 1 — initial Phase 2 validation

- Command: `build_bootstrap.bat` (configures via `cmake`, builds via
  `cmake --build`, runs `ctest`)
- Result: ALL PASSED
- Build output: `[317/317] Linking CXX executable rpg_creator_runtime.exe`
- Test output: `1/1 Test #1: RPGTests ......... Passed 0.21 sec — 100% tests passed, 0 tests failed out of 1`
- Warnings: doctest C5285 (std::tuple specialization) — known third-party
  warning, harmless under MSVC 19.51 / C++20.
- Fix applied: none required.
- Final: PASS.

### Run 2 — runtime smoke

- Command: launch `build\rpg_creator_runtime.exe` for 4 seconds, capture
  stdout/stderr.
- stdout:
  - `[INFO] RPG Creator Runtime starting...`
  - `[INFO] Project loaded: Demo RPG`
  - `[INFO] Map loaded: town`
- stderr: empty
- Process status: still alive after 4 s; window opened titled
  "Demo RPG"; killed cleanly.
- Final: PASS.

---

## Phase 1 — Bootstrap

### Run — bootstrap configure/build/ctest

- Command: `build_bootstrap.bat`
- Result: ALL PASSED
- ctest: `1/1 Test #1: RPGTests ......... Passed 0.17 sec`
- Final: PASS (Phase 1 commit `41273a8`).


---

## Phase 2 Visual Verification

### Run — `--smoke-shots` deterministic harness

- Command: `build\rpg_creator_runtime.exe --smoke-shots docs\screenshots\phase-2`
- Result: PASS — exit 0, 9 screenshots written, full event trace captured.
- Trace (relevant log lines):
  - `[INFO] Map loaded: town`
  - `[INFO] Dialogue [Anciano]: No cruces el puente de noche.`
  - `[INFO] Map loaded: house`
  - `[INFO] Dialogue: Encontraste una pocion.`
  - `[INFO] playSound: chest_open`
  - `[INFO] Dialogue: El cofre esta vacio.`
  - `[INFO] Game saved to saves/slot_1.json`
  - `[INFO] Map loaded: town` (transfer back)
  - `[INFO] Game loaded from saves/slot_1.json`
  - `[INFO] Map loaded: house` (load restored map)
  - `[INFO] Dialogue: Partida cargada.`
- Pixel verification (see `docs/PHASE_2_VISUAL_VERIFICATION.md`):
  dialogue-edge pixel ratio jumps from 0.04% (idle) to ≥0.58% (dialogue
  frames); ground/wall ratios swap between town and house palettes;
  NPC red appears only on town frames; chest orange only on house
  frames.
- Final: PASS.

### Run — full validation after harness changes

- Command: `build_bootstrap.bat`
- Build: 317/317 link OK.
- Tests: `1/1 Test #1: RPGTests ......... Passed 0.15 sec — 100% tests passed`.
- Final: PASS.


---

## Phase 4 — Editor Persistence & Runtime Bridge

**Date**: 2026-05-15

### Commands run

| Command | Result | Notes |
|---------|--------|-------|
| `npx tsc --noEmit` | PASS | 0 errors |
| `npx vite build` | PASS | 290 KB JS bundle, 18.29s |
| `npx vitest run` | PASS | 32 / 32 tests |
| `cmd /c build_bootstrap.bat` | BLOCKED | Pre-existing OneDrive file-lock during FetchContent rename. No C++ files were modified in Phase 4. |

### Fix applied
- The C++ build failure is environmental (OneDrive holds locks on `build/_deps/` during cmake's directory rename). Documented in `docs/PHASE_4_VALIDATION_REPORT.md` with workaround suggestions. No code changes required for Phase 4.

### Final pass/fail
- Frontend: PASS
- C++ runtime: unmodified, build blocked by OneDrive sync (not a Phase 4 regression)


---

## Phase 4.1 — Validation Hardening & Desktop Bridge Preparation

**Date**: 2026-05-15

### Commands run

| Command | Result | Notes |
|---------|--------|-------|
| `npx tsc --noEmit` | PASS | exit 0 |
| `npx vite build` | PASS | 290 KB JS, 16s |
| `npx vitest run` | PASS | 32/32 tests |
| `scripts\dev\verify-runtime.bat` | PASS | configure + build + ctest, build dir `%LOCALAPPDATA%\RPGCreatorAI\build` |
| `scripts\dev\verify.ps1` (full incl. smoke) | PASS | runtime stays alive 3s, [INFO] Project loaded, [INFO] Map loaded |

### Fixes applied
- Replaced `New-TemporaryFile` in `scripts/dev/verify.ps1` with `[System.IO.Path]::GetTempFileName()` to remove a Windows PowerShell version dependency.
- Defaulted CMake binary dir to `%LOCALAPPDATA%\RPGCreatorAI\build` across `verify.ps1`, `verify-runtime.bat`, and `build_bootstrap.bat` so FetchContent rename steps no longer collide with OneDrive's filter driver.
- Added new `scripts/dev/verify-runtime.bat` for a pure-cmd path (no PowerShell required).
- Updated `smoke-runtime.ps1` to accept `-BuildDir`, run from repo root for `data/` lookups, and use ASCII-only status output.

### Final pass/fail
- Frontend: PASS
- C++ runtime: PASS
- Smoke: PASS
- OneDrive lock issue: RESOLVED via out-of-OneDrive build directory


---

## Phase 5 — Desktop Shell + Real FileSystem + Runtime Bridge (in progress)

**Date**: 2026-05-16

### Bug uncovered: silent Vite port collision in Tauri dev mode

Tauri 2's `beforeDevCommand` originally invoked `npm run dev`, whose Vite
config used port 3000 and was happy to silently fall back to a different
port when 3000 was already taken by another local project. Tauri then
opened a webview for whatever was on that fallback port, which could be
an unrelated app. This is a class-of-bug we never want to ship: the
shell process being alive does not prove the right page loaded.

### Fix

* New `npm run dev:tauri` script: `vite --port=1420 --strictPort --host=127.0.0.1`. `--strictPort` makes Vite **fail** instead of silently moving when 1420 is taken.
* `src-tauri/tauri.conf.json` `beforeDevCommand` now points at `dev:tauri`, `devUrl` is `http://localhost:1420`.
* CSP is narrowed to allow only `http://localhost:1420` and its websocket.
* `npm run dev` (the existing Phase 4.1 browser script on port 3000) is unchanged for users who want pure browser mode.

### Regression check

`scripts/dev/verify-tauri-content.ps1` now hits `http://127.0.0.1:1420/`
and asserts the response body contains `<title>RPGCreatorAI` and the
editor entry `/src/main.tsx`. Exits non-zero otherwise. This catches the
silent-port-collision class of bug for future Phase 5 work.

### Tauri dev verification (this run)

| Check | Result |
|-------|--------|
| Vite bound to `127.0.0.1:1420` with `--strictPort` | PASS |
| `verify-tauri-content.ps1` | PASS (`OK: serving the RPGCreatorAI editor`) |
| Page `<title>` is `RPGCreatorAI — Visual Editor` | PASS |
| DOM includes `RPGCreatorAI`, `My First RPG`, `Maps`, `Events`, `AI Tools` | PASS (no missing strings) |
| Tauri window screenshot | `docs/screenshots/phase-5/02-tauri-window.png` (1456×939) |
| Renderer DOM screenshot | `docs/screenshots/phase-5/01-tauri-dev-content.png` |
| `data/project.json` title aligned to `My First RPG` | PASS |

### Other Phase 5 validation so far

| Check | Result |
|-------|--------|
| `rustup` user-space install | PASS (Rust 1.95.0, Cargo 1.95.0) |
| `npx tsc --noEmit` | PASS |
| `npx vite build` | PASS (295 KB JS, 19s) |
| `npx vitest run` | PASS (43/43 tests) |
| `cargo test --manifest-path src-tauri/Cargo.toml --lib` | PASS (14/14 Rust tests) |
| `cargo build --manifest-path src-tauri/Cargo.toml` | PASS (4m45s first build, target dir under `%LOCALAPPDATA%`) |
| `scripts/dev/verify-runtime.bat` | PASS (C++ runtime still green) |


### `--strictPort` fail-loud verification

Manually held port 1420 with a TcpListener and ran `npx vite --port=1420 --strictPort --host=127.0.0.1`. Vite exited with code 1 and the message `Error: Port 1420 is already in use`. The silent-fallback class of bug cannot recur.

```
Held 1420 with PID 17796
vite running: False, exit=1
vite stopped, ExitCode=1
Error: Port 1420 is already in use
    at Server.onError (...)
```


---

## Phase 6 — Complete RPG Creation System Foundation

### Slice 1+2 (commit `7936b8f`) — data model + database editor

- `npx tsc --noEmit` — exit 0
- `npx vitest run` — 8 files, 59 passed, 59 total
- `cargo test --manifest-path src-tauri/Cargo.toml --lib` — 16 passed (added two new database round-trip tests)
- `scripts\dev\verify-runtime.bat` — configure + build clean, ctest 1/1 RPGTests passed

### Slice 3-6 (commit `46d2726`) — runtime command system v1, switches/variables, quests, gold, party

- `npx tsc --noEmit` — exit 0
- `npx vitest run` — 8 files, 59 passed
- `cargo test ... --lib` — 16 passed
- `verify-runtime.bat` — ctest 1/1 (rpg_tests went from 24 cases / 95 assertions to 47 cases / 145 assertions)

### Slice 7-9 (commit `d4fec32`) — runtime database loader, BattleSystem v1, full editor command UI

- `npx tsc --noEmit` — exit 0
- `npx vitest run` — 8 files, 59 passed
- `cargo test ... --lib` — 16 passed
- `verify-runtime.bat` — ctest 1/1 (rpg_tests 49 cases / 151 assertions, including BattleSystem damage formula + empty-party auto-defeat)

### Slice 10+11 — sample game + final validation

- Sample town/house exercise: dialogue, choices, switch toggle, variable arithmetic, gold change, quest start/objective/complete, shop open, deterministic battle with rewards, transfer, save/load.
- `npx tsc --noEmit` — exit 0
- `npx vitest run` — 9 files, 62 passed (added bundledSample.test.ts)
- `cargo test ... --lib` — 16 passed
- `verify-runtime.bat` — ctest 1/1
- `scripts\dev\smoke-runtime.bat` — runtime spawned (pid logged), `[INFO] Project loaded: My First RPG`, `[INFO] Databases loaded: 1 actors, 1 enemies, 1 troops, 1 quests, 1 shops, 1 common events`, `[INFO] Map loaded: town`, SMOKE PASSED.
- `npm run desktop:verify-content` — skipped (requires running dev server).

---

## Phase 7 — Polished creator-to-player loop

### Slice 0+1 (commit `0012eca`) — generated asset foundation + runtime menu shell

- `npx vitest run src/assets/generated/__tests__/assetCatalog.test.ts` — PASS (3 tests)
- `scripts\dev\verify-runtime.bat` — PASS
- `npx tsc --noEmit` — PASS
- `npx vite build` — PASS
- `npx vitest run` — PASS (10 files, 65 tests)
- `scripts\dev\smoke-runtime.bat` — PASS
- `rpg_creator_runtime.exe --smoke-shots docs\screenshots\phase-7-assets-smoke` — PASS (9 screenshots)

### Slice 2+3 (pending commit) — runtime menu data + save/load slot metadata

- `scripts\dev\verify-runtime.bat` — initially FAILED while compiling
  `tests/test_save_manager.cpp` because `SaveManager::listSlots` did not yet
  exist; fix applied: introduced centralized slot metadata in
  `SaveManager`, then routed `MenuSystem` through it.
- `scripts\dev\verify-runtime.bat` — PASS after fix (1/1 ctest target;
  includes new menu snapshot and save-slot metadata coverage).

### Slice 4+5 (pending commit) — shop modal + battle reward summary

- `scripts\dev\verify-runtime.bat` — initially FAILED while compiling
  `tests/test_shop_system.cpp` because `runtime/ShopSystem.h` did not yet
  exist; fix applied: introduced `ShopSystem`, runtime integration, and shop
  renderer panel.
- `scripts\dev\verify-runtime.bat` — PASS after shop implementation.
- `scripts\dev\verify-runtime.bat` — initially FAILED while compiling
  `tests/test_battle_summary_system.cpp` and the new EventRunner regression
  because `BattleSummarySystem` and `consumeBattleSummaryRequest()` did not
  yet exist; fix applied: introduced explicit battle-summary handoff and
  renderer panel.
- `scripts\dev\verify-runtime.bat` — PASS after battle summary integration.

### Slice 6-8 (pending commit) — undo / redo + map and event authoring

- `npx vitest run src/stores/__tests__/projectReducer.test.ts` — initially
  FAILED on the new undo/redo, tile painting, and event CRUD expectations;
  fix applied: introduced project history snapshots plus map/event reducer
  actions.
- `npx vitest run src/stores/__tests__/projectReducer.test.ts` — PASS
  (15/15).
- `npx tsc --noEmit` — PASS.
- `npx vitest run` — PASS (10 files, 69 tests).
- `npx vite build` — PASS.
- Live browser verification against `http://127.0.0.1:3000/` — PASS:
  path brush changed a map tile to `tile_path.png`, event placement grew the
  canvas event count, duplicate increased the count again, and Undo restored
  the previous count.
- Screenshot captured:
  `docs/screenshots/phase-7-editor/01-editor-workflow.png`.

### Slice 6-9 follow-up (pending commit) — editor polish + end-to-end proof

- `npx vitest run src/utils/__tests__/eventEditing.test.ts src/e2e/__tests__/editorRoundtrip.test.ts src/stores/__tests__/projectReducer.test.ts`
  — initially FAILED because `src/utils/eventEditing.ts` did not exist;
  fix applied: added shared duplicate-placement / editable-target helpers,
  then wired `Ctrl+D`, delete confirmation, and drag coalescing through the
  live editor.
- `npx vitest run src/utils/__tests__/eventEditing.test.ts src/e2e/__tests__/editorRoundtrip.test.ts src/stores/__tests__/projectReducer.test.ts`
  — PASS after the fix (21/21).
- `npx tsc --noEmit` — PASS.
- `cargo test --manifest-path src-tauri/Cargo.toml --lib` — PASS
  (17/17, including new map-edit round-trip coverage).
- `scripts\dev\verify-runtime.bat` — PASS after extending the native smoke
  harness to capture menu, shop, and battle-result screens.
- `rpg_creator_runtime.exe --smoke-shots docs\screenshots\phase-7` — PASS
  (17 native runtime screenshots).
- `powershell -File scripts/dev/verify-editor-runtime-roundtrip.ps1` —
  initially FAILED because the temp project copy lacked a `saves/`
  directory; fix applied: create the directory before launch.
- `powershell -File scripts/dev/verify-editor-runtime-roundtrip.ps1` —
  PASS after the fix (baseline and edited frame hashes differed).
- Live browser verification against `http://127.0.0.1:3000/` — PASS:
  event placement worked, `Ctrl+D` duplicated to the next free tile, delete
  opened a confirm dialog, and `Delete` removed the event after acceptance.
- Screenshot captured:
  `docs/screenshots/phase-7/18-editor-shortcuts-after-delete.png`.

### Slice 10 — final validation + closeout

- `npx tsc --noEmit` — PASS.
- `npx vite build` — PASS.
- `npx vitest run` — PASS (12 files, 75 tests).
- `cargo test --manifest-path src-tauri/Cargo.toml --lib` — PASS
  (17/17 Rust tests).
- `cargo build --manifest-path src-tauri/Cargo.toml` — PASS.
- `scripts\dev\verify-runtime.bat` — PASS.
- `powershell -File scripts/dev/verify.ps1` — PASS; runtime smoke observed
  `Project loaded: My First RPG`, `Map loaded: town`, and `SMOKE PASSED`.
- `powershell -File scripts/dev/verify-editor-runtime-roundtrip.ps1` —
  PASS; baseline / edited frame hashes differed.
- `npm run desktop:verify-content` — PASS with a temporary strict-port Vite
  dev server on `127.0.0.1:1420`.
- `rpg_creator_runtime.exe --smoke-shots docs\screenshots\phase-7` —
  PASS (17 native runtime screenshots refreshed).

---

## Phase 8 — Game visual foundation and creator workflow hardening

### Slice 5 — supplementary original visual assets

- `2026-05-18 00:23 -03:00` —
  `npx vitest run src/assets/generated/__tests__/assetCatalog.test.ts src/visual/__tests__/tileCatalog.test.ts`
  — initially FAILED because the expanded scene-asset catalog and tile IDs
  did not exist yet; fix applied: added deterministic supplementary asset
  generation plus editor/runtime catalog wiring.
- `2026-05-18 00:25 -03:00` —
  `python scripts/dev/generate_visual_assets.py` — PASS; generated original
  scene-support assets into `src/assets/generated/`,
  `assets/generated/web/`, and `assets/generated/runtime/`.
- `2026-05-18 00:25 -03:00` —
  `npx vitest run src/assets/generated/__tests__/assetCatalog.test.ts src/visual/__tests__/tileCatalog.test.ts`
  — PASS (4 tests).
- `2026-05-18 00:25 -03:00` — `npx tsc --noEmit` — PASS.
- `2026-05-18 00:26 -03:00` — `cmd /c scripts\dev\verify-runtime.bat`
  — PASS; runtime tests now include the expanded tile catalog coverage.

### Slice 6 — authored scene templates and widescreen bundled sample

- `2026-05-18 00:30 -03:00` —
  `npx vitest run src/templates/__tests__/sceneTemplates.test.ts src/validation/__tests__/bundledSample.test.ts src/stores/__tests__/projectReducer.test.ts`
  — initially FAILED because scene templates, map replacement support, and
  the widescreen bundled sample did not exist yet; fix applied: added seven
  reusable templates, template application in the editor, reducer support,
  and upgraded the bundled project maps.
- `2026-05-18 00:33 -03:00` —
  `npx vitest run src/templates/__tests__/sceneTemplates.test.ts src/validation/__tests__/bundledSample.test.ts src/stores/__tests__/projectReducer.test.ts`
  — PASS (25 tests).
- `2026-05-18 00:33 -03:00` — `npx tsc --noEmit` — PASS.
- `2026-05-18 00:34 -03:00` — `npx vite build` — PASS.
- `2026-05-18 00:34 -03:00` — `cmd /c scripts\dev\verify-runtime.bat`
  — initially FAILED because native loader tests still asserted the obsolete
  `10x10` town and old start position; fix applied: updated those tests to
  assert the new authored widescreen sample.
- `2026-05-18 00:35 -03:00` — `cmd /c scripts\dev\verify-runtime.bat`
  — PASS after the stale native assertions were updated.

### Slice 7 — runtime scene framing and authored blocker rendering

- `2026-05-18 00:38 -03:00` — `cmd /c scripts\dev\verify-runtime.bat`
  — initially FAILED because native sprite routing still collapsed authored
  `tree` and `interiorWall` blockers into the old generic wall sprite; fix
  applied: preserve explicit authored blocker visuals while retaining the
  legacy wall fallback.
- `2026-05-18 00:39 -03:00` — `cmd /c scripts\dev\verify-runtime.bat`
  — PASS after the sprite-routing fix.
- `2026-05-18 00:40 -03:00` — `cmd /c scripts\dev\smoke-runtime.bat`
  — PASS; runtime opened the widescreen sample and reached
  `SMOKE PASSED`.
- `2026-05-18 00:40 -03:00` —
  `rpg_creator_runtime.exe --smoke-shots docs\screenshots\phase-8-runtime-smoke`
  — PASS (17 native runtime screenshots captured after widening the smoke
  traversal to the new authored sample layout).

### Slice 8 — editor/runtime preview consistency

- `2026-05-18 00:46 -03:00` —
  `npx vitest run src/visual/__tests__/viewport.test.ts src/templates/__tests__/sceneTemplates.test.ts src/validation/__tests__/bundledSample.test.ts`
  — PASS (12 tests).
- `2026-05-18 00:46 -03:00` — `npx tsc --noEmit` — PASS.
- `2026-05-18 00:46 -03:00` — `npx vite build` — PASS.
- Result: the simulated playtest surface now derives its viewport from the
  same visual profile/camera helpers as the editor and native runtime, and
  editor collision cells render as an overlay rather than erasing authored
  scene art.

### Slice 9 — map-authoring workflow hardening

- `2026-05-18 00:52 -03:00` —
  `npx vitest run src/stores/__tests__/editorStore.test.ts src/stores/__tests__/projectReducer.test.ts`
  — initially FAILED because layer/tool state, rectangle painting, flood
  fill, and map resizing were not implemented yet; fix applied: added
  explicit editor authoring modes plus reducer actions for those operations.
- `2026-05-18 00:55 -03:00` —
  `npx vitest run src/stores/__tests__/editorStore.test.ts src/stores/__tests__/projectReducer.test.ts`
  — PASS (24 tests).
- `2026-05-18 00:55 -03:00` — `npx tsc --noEmit` — PASS.
- `2026-05-18 00:58 -03:00` —
  `npx vitest run src/stores/__tests__/editorStore.test.ts src/stores/__tests__/projectReducer.test.ts src/e2e/__tests__/editorRoundtrip.test.ts`
  — PASS (25 tests).
- `2026-05-18 00:58 -03:00` — `npx vite build` — PASS.
- Browser screenshot verification against `http://127.0.0.1:3000/` — PASS:
  map settings, layer tabs, selected-tile preview, brush-size buttons, and
  the clean visual-layer scene presentation all rendered correctly.

### Slice 10 — runtime UX/playability regression pass

- `2026-05-18 01:00 -03:00` — `cmd /c scripts\dev\verify-runtime.bat`
  — PASS.
- `2026-05-18 01:00 -03:00` — `cmd /c scripts\dev\smoke-runtime.bat`
  — PASS.
- `2026-05-18 01:00 -03:00` —
  `rpg_creator_runtime.exe --smoke-shots docs\screenshots\phase-8-ux-smoke`
  — PASS (17 screenshots captured during verification, then cleaned from
  the repo working tree because final evidence belongs under the dedicated
  game-visual-design screenshot set).
- Verified runtime surfaces under the widened scene profile: pause menu,
  inventory, party/status, quest journal, save slots, load slots, shop, and
  battle reward summary.

### Slice 11 — visual QA closeout and final evidence

- `2026-05-18 01:13 -03:00` — `python -m unittest tests.test_visual_assets`
  — initially FAILED because the original `tile_grass`, `tile_path`,
  `tile_water`, and `tile_wall` assets still had transparent outer edges;
  fix applied: regenerated those tiles as full-bleed original assets.
- `2026-05-18 01:14 -03:00` — `python scripts/dev/generate_visual_assets.py`
  — PASS; refreshed full-bleed generated web/runtime terrain tiles.
- `2026-05-18 01:14 -03:00` — `python -m unittest tests.test_visual_assets`
  — PASS; every production visual tile is opaque on all outer edges.
- `2026-05-18 01:18 -03:00` —
  `powershell -File scripts/dev/visual-verify.ps1 -OutputDir output\\visual-closeout\\runtime-wide-new`
  — PASS after fixing the script to prefer the same active out-of-OneDrive
  runtime build directory used by the main verification pipeline instead of
  an obsolete in-repo executable.
- `2026-05-18 01:19 -03:00` — editor/runtime evidence capture — PASS;
  committed screenshot set populated under
  `docs/screenshots/game-visual-design/`:
  `01-editor-16x9-map.png`, `02-runtime-16x9-map.png`,
  `03-editor-square-map.png`, `04-runtime-square-map.png`,
  `05-map-validation-no-gaps.png`, `06-scene-template-town.png`,
  `07-scene-template-forest.png`, and
  `08-scene-template-interior.png`.
- `2026-05-18 01:22 -03:00` — `npx tsc --noEmit` — PASS.
- `2026-05-18 01:22 -03:00` — `npx vite build` — PASS.
- `2026-05-18 01:23 -03:00` — `npx vitest run` — PASS
  (17 files, 97 tests).
- `2026-05-18 01:23 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml --lib` — PASS
  (17/17 Rust tests).
- `2026-05-18 01:24 -03:00` —
  `cargo build --manifest-path src-tauri/Cargo.toml` — PASS.
- `2026-05-18 01:25 -03:00` — `scripts\\dev\\verify-runtime.bat`
  — PASS.
- `2026-05-18 01:25 -03:00` —
  `powershell -File scripts/dev/verify.ps1` — PASS; runtime smoke observed
  `Project loaded: My First RPG`, `Map loaded: town`, and `SMOKE PASSED`.
- `2026-05-18 01:27 -03:00` — `npm run desktop:verify-content`
  — PASS with a strict-port Vite server on `127.0.0.1:1420`.
- `2026-05-18 01:27 -03:00` — screenshot dimension audit — PASS;
  runtime evidence captured at `1280x720` and `768x768`, while editor
  evidence remained full-page `1600x900` captures with the authored frame
  visible inside the UI.

### Phase 9 — smooth movement and character animation foundation

- `2026-05-18 21:31 -03:00` —
  `git ls-remote https://github.com/0x0funky/agent-sprite-forge.git HEAD`
  — PASS; verified pinned upstream commit
  `fff651a89223b044ccfc0b75ed9f3754c6d739b1`.
- `2026-05-18 21:32 -03:00` — Python dependency check — Pillow present,
  NumPy missing. Fix applied:
  `python -m pip install numpy` — PASS (`numpy 2.4.6` installed).
- `2026-05-18 21:34 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\dev\generate-animation-assets.ps1`
  — PASS; generated 40 animation sheets plus manifest, prompts, metadata,
  and preview PNG/GIF evidence.
- `2026-05-18 21:39 -03:00` — `npm test` — PASS (18 files, 103 tests).
- `2026-05-18 21:40 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\dev\verify.ps1 -SkipSmoke`
  — PASS; configure/build/CTest passed.
- `2026-05-18 21:40 -03:00` —
  `cargo fmt --manifest-path src-tauri\Cargo.toml` — initially FAILED
  because `rustfmt` was not installed. Fix applied:
  `rustup component add rustfmt`, then `cargo fmt --manifest-path
  src-tauri\Cargo.toml` — PASS.
- `2026-05-18 21:40 -03:00` —
  `cargo test --manifest-path src-tauri\Cargo.toml --lib` — PASS
  (17/17 Rust tests).
- `2026-05-18 21:41 -03:00` — `npm run build` — PASS (`tsc --noEmit`
  and `vite build`).
- `2026-05-18 21:46 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\dev\verify.ps1 -SkipSmoke`
  — PASS after updating `runSmokeShots()` to account for leading
  `playAnimation` commands.
- `2026-05-18 21:47 -03:00` —
  `%LOCALAPPDATA%\RPGCreatorAI\build\rpg_creator_runtime.exe --smoke-shots docs\screenshots\phase-9-animation`
  — PASS; native screenshot harness wrote the normal RPG smoke sequence
  plus Phase 9 frames for walk mid-step, player interact, hurt, and
  attack.
- `2026-05-18 21:48 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\dev\verify.ps1`
  — PASS; configure/build/CTest passed and runtime 3-second smoke stayed
  alive with no stderr errors.
- `2026-05-18 21:49 -03:00` — `npm test` — PASS (18 files, 103 tests).
- `2026-05-18 21:49 -03:00` —
  `cargo test --manifest-path src-tauri\Cargo.toml --lib` — PASS
  (17/17 Rust tests).
- `2026-05-18 21:49 -03:00` — `npm run build` — PASS (`tsc --noEmit`
  and `vite build`).

### Phase 9 Hotfix — character scale and movement parity baseline

- `2026-05-19 21:01 -03:00` — `git diff --check` — PASS.
- `2026-05-19 21:01 -03:00` — `npm test` — PASS (18 files,
  107 tests).
- `2026-05-19 21:01 -03:00` — `npm run build` — PASS (`tsc --noEmit`
  and `vite build`).
- `2026-05-19 21:01 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml --lib` — PASS
  (17/17 Rust tests).
- `2026-05-19 21:01 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1`
  — PASS; configure/build/CTest passed and runtime smoke reported
  `SMOKE PASSED`.

### Phase 10 Slice 1 — professional editor shell and map tree

- `2026-05-19 21:03 -03:00` —
  `npm test -- src/stores/__tests__/projectReducer.test.ts` — initially
  FAILED as expected under TDD because map tree reducer actions did not
  exist yet. Fix applied: implemented map property, create, duplicate,
  remove, reference update, move, and reorder reducer actions.
- `2026-05-19 21:05 -03:00` —
  `npm test -- src/stores/__tests__/projectReducer.test.ts` — PASS
  (26/26 tests).
- `2026-05-19 21:05 -03:00` —
  `npm test -- src/validation/__tests__/validateProject.test.ts` —
  initially FAILED as expected under TDD because project map-tree validation
  did not exist yet. Fix applied: added duplicate id, missing map data,
  missing parent, orphan map, and cycle validation.
- `2026-05-19 21:06 -03:00` —
  `npm test -- src/validation/__tests__/validateProject.test.ts` — PASS
  (20/20 tests).
- `2026-05-19 21:11 -03:00` — `npm test` — PASS (18 files,
  115 tests).
- `2026-05-19 21:11 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1`
  — PASS; configure/build/CTest passed and runtime smoke reported
  `SMOKE PASSED`.
- `2026-05-19 21:12 -03:00` — `npm run desktop:verify-content` —
  PASS; `http://127.0.0.1:1420/` served the RPGCreatorAI editor.
- `2026-05-19 21:12 -03:00` —
  `npx --yes playwright screenshot --timeout=30000 http://127.0.0.1:1420 output\phase10-slice1\editor-map-tree.png`
  — PASS; screenshot captured for the new map tree editor shell and copied
  to `docs/screenshots/phase10-slice1/editor-map-tree.png`.
- `2026-05-19 21:17 -03:00` —
  `npm test -- src/stores/__tests__/projectReducer.test.ts src/validation/__tests__/validateProject.test.ts`
  — PASS (49/49 tests) after QA fixes for atomic reorder, descendant-cycle
  prevention, and map path validation.
- `2026-05-19 21:17 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml --lib` — PASS
  (18/18 Rust tests) after adding stable root `parentId: null` serialization
  and map-reference metadata round-trip coverage.
- `2026-05-19 21:18 -03:00` — `git diff --check` — PASS.
- `2026-05-19 21:18 -03:00` — `npm test` — PASS (18 files,
  118 tests).
- `2026-05-19 21:18 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml --lib` — PASS
  (18/18 Rust tests).
- `2026-05-19 21:18 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1`
  — PASS; configure/build/CTest passed and runtime smoke reported
  `SMOKE PASSED`.
- `2026-05-19 21:18 -03:00` — `npm run desktop:verify-content` —
  PASS.
- `2026-05-19 21:19 -03:00` — `npm run build` — initially FAILED because
  `ExternalLink` was still used by the AI Tools toolbar after placeholder
  button cleanup. Fix applied: restored the icon import.
- `2026-05-19 21:19 -03:00` — `npm run build` — PASS (`tsc --noEmit`
  and `vite build`).

### Phase 10 Slice 2 — data-driven tilesets and layer authoring

- `2026-05-20 02:34 -03:00` —
  `npm test -- src/visual/__tests__/tileCatalog.test.ts src/stores/__tests__/editorStore.test.ts src/stores/__tests__/projectReducer.test.ts src/validation/__tests__/validateProject.test.ts src/validation/__tests__/bundledSample.test.ts`
  — initially FAILED as expected under TDD because tile catalog helpers,
  concrete authoring layers, locked-layer paint refusal, layer metadata
  reducer actions, tileset validation, and region validation did not exist
  yet. Fix applied: implemented data-driven tilesets, layer controls, region
  authoring, passability overlays, and validation.
- `2026-05-20 02:35 -03:00` — focused TypeScript slice tests — PASS
  (5 files, 65 tests).
- `2026-05-20 02:35 -03:00` — `npm run build` — PASS (`tsc --noEmit`
  and `vite build`).
- `2026-05-20 02:35 -03:00` — `npm test` — PASS (18 files,
  126 tests).
- `2026-05-20 02:36 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml --lib` — PASS
  (18/18 Rust tests).
- `2026-05-20 02:36 -03:00` —
  `cmake --build --preset default --target rpg_tests` — PASS/no rebuild
  required for the in-repo build tree.
- `2026-05-20 02:36 -03:00` — `ctest --preset default` — PASS
  (1/1 C++ tests).
- `2026-05-20 02:38 -03:00` — Browser smoke at
  `http://127.0.0.1:3000` — PASS; editor loaded, layer controls for
  Ground/Decor/Front/Pass/Region were present, Region selection exposed
  region brushes, and console error log was empty. Screenshot capture through
  the in-app browser timed out twice, so this run is recorded as DOM/console
  smoke rather than screenshot evidence.
- `2026-05-20 02:39 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1`
  — PASS; configure/build/CTest passed and runtime smoke reported
  `Databases loaded: ... 2 tilesets ...` followed by `SMOKE PASSED`.
- `2026-05-20 02:39 -03:00` — `npm run desktop:verify-content` —
  initially FAILED because no Vite server was running on the Tauri-only
  port `127.0.0.1:1420`. Fix applied: started `npm run dev:tauri`.
- `2026-05-20 02:40 -03:00` — `npm run desktop:verify-content` — PASS;
  `http://127.0.0.1:1420/` served the RPGCreatorAI editor.
- `2026-05-20 02:41 -03:00` — `git diff --check` — PASS.
- `2026-05-20 02:41 -03:00` — `npm test` — PASS (18 files,
  126 tests) after normalizing sample map layer order.
- `2026-05-20 02:41 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml --lib` — PASS
  (18/18 Rust tests).
- `2026-05-20 02:42 -03:00` — `npm run build` — PASS (`tsc --noEmit`
  and `vite build`).
- `2026-05-20 02:42 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1`
  — PASS; configure/build/CTest passed and runtime smoke reported
  `SMOKE PASSED` with `2 tilesets` loaded.
- `2026-05-20 02:42 -03:00` — `npm run desktop:verify-content` — PASS.

