# Validation Log

Append-only log of major validation runs. Newest entries on top.

---

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
