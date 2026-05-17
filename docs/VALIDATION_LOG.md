# Validation Log

Append-only log of major validation runs. Newest entries on top.

---

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

