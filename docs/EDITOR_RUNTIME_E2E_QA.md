# Editor -> Runtime End-to-End QA

This document records the concrete proof that editor-authored project data
reaches the native runtime. Phase 10 expands the original Phase 7 check into
one repeatable green gate for editor save data, desktop session generation,
Tauri content, native build/tests, launch smoke, and runtime consumption.

The main command is:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify-editor-runtime-roundtrip.ps1
```

For restricted PowerShell environments, run:

```bat
scripts\dev\verify-editor-runtime-roundtrip.bat
```

The script prints these sections and exits non-zero on the first failed gate:

1. **FRONTEND ROUNDTRIP TESTS** — Vitest drives the reducer + `performSave`
   flow used by the React editor, mutates map data, database data, and common
   event commands, reloads the active adapter, and validates the reloaded
   state. It also proves the desktop playtest adapter sends project-start,
   current-map, and selected-event session requests.
2. **TAURI CONTENT CHECK** — the script reuses an existing correct dev server
   on port 1420 or starts Vite directly, then runs
   `scripts/dev/verify-tauri-content.ps1` to ensure Tauri would load this app.
3. **RUST DESKTOP TESTS** — `cargo test --manifest-path src-tauri/Cargo.toml`
   covers desktop persistence and temp playtest session generation.
4. **NATIVE BUILD AND TEST** — `scripts/dev/verify.ps1 -SkipSmoke` configures,
   builds, and runs CTest for the C++ runtime.
5. **RUNTIME LAUNCH SMOKE** — `scripts/dev/smoke-runtime.ps1` launches the
   runtime briefly from real project data and rejects early exit or `[ERROR]`
   output.
6. **RUNTIME SCREENSHOT ROUNDTRIP** — the harness copies the bundled project
   to a temp folder, edits visible map JSON, launches the runtime twice with
   `--smoke-shots`, and proves the rendered frame hash changes.

Together these cover the full path the product actually uses:

```text
editor reducer -> save adapter -> project JSON on disk -> playtest session root -> C++ runtime loader -> rendered frame
```

## Automated checks

| Layer | Command | Evidence |
| --- | --- | --- |
| Editor reducer + save adapter | `npm test -- --run src/e2e/__tests__/editorRoundtrip.test.ts src/adapters/__tests__/PlaytestSessionAdapter.test.ts` | Paints collision, adds an event, edits actor data, edits common event commands, saves, reloads, validates, and verifies project-start/current-map/selected-event session requests. |
| Tauri dev content | `scripts/dev/verify-tauri-content.ps1` through the roundtrip script | Confirms port 1420 serves the RPGCreatorAI editor HTML and entrypoint. |
| Desktop shell persistence | `cargo test --manifest-path src-tauri/Cargo.toml` | Includes map/database write/read coverage and temp playtest session generation for current-map and selected-event modes. |
| Native runtime build/tests | `scripts/dev/verify.ps1 -SkipSmoke` through the roundtrip script | Configures CMake, builds the runtime, and runs CTest. |
| Runtime launch smoke | `scripts/dev/smoke-runtime.ps1` through the roundtrip script | Launches the runtime against real project data and verifies it stays alive without `[ERROR]` output. |
| Runtime reads saved data | `scripts/dev/verify-editor-runtime-roundtrip.ps1` | Mutates a copied `town.json`, launches the runtime, and verifies the edited first-frame screenshot hash differs from baseline. |

The runtime round-trip script is intentionally safe:

- it works in a disposable temp directory,
- copies only the project data and committed runtime assets it needs,
- verifies the cleanup target is still inside the OS temp directory
  before deleting it,
- never mutates the repo copy of the sample project.

## Visual evidence

### Editor workflow

- `docs/screenshots/phase-7-editor/01-editor-workflow.png`
- `docs/screenshots/phase-7/18-editor-shortcuts-after-delete.png`

The live browser pass verified:

- palette-driven event placement,
- `Ctrl+D` duplication to the next free tile,
- delete confirmation,
- `Delete` shortcut removal,
- the editor remaining in a valid unsaved state afterward.

### Runtime workflow

The deterministic native screenshot harness is launched with:

```powershell
& "$env:LOCALAPPDATA\RPGCreatorAI\build\rpg_creator_runtime.exe" --smoke-shots docs\screenshots\phase-7
```

It captures the real SDL renderer, not a mock:

| Screenshot | Flow |
| --- | --- |
| `01-town-initial.bmp` | initial runtime map |
| `02-npc-dialogue.bmp` | dialogue UI |
| `03-house-arrived.bmp` | transfer to second map |
| `04-chest-first-open.bmp` | first chest reward |
| `05-chest-already-opened.bmp` | persisted chest state |
| `06-save-feedback.bmp` | save feedback |
| `07-back-in-town.bmp` | return transfer |
| `08-load-feedback.bmp` | load feedback |
| `09-after-load.bmp` | restored state |
| `10-menu-root.bmp` | pause menu |
| `11-menu-inventory.bmp` | inventory UI |
| `12-menu-party.bmp` | party / status UI |
| `13-menu-quests.bmp` | quest journal |
| `14-menu-save.bmp` | save slot picker |
| `15-menu-load.bmp` | load slot picker |
| `16-shop.bmp` | shop UI |
| `17-battle-summary.bmp` | battle result + rewards UI |

## What is proven

- The editor can author real map mutations without hand-editing JSON.
- Those mutations survive the editor save path.
- The desktop shell preserves map edits on disk.
- The runtime reads project data from disk rather than hardcoded content.
- The visible runtime surfaces added in Phase 7 render in the native app.

## Known limitation

Phase 7 ships a **battle result / reward presentation** rather than a full
turn-by-turn animated battle viewer. The deterministic battle math is still
present and tested from Phase 6, and Phase 7 makes the result visible and
usable. A richer turn log / per-turn HP animation remains a later polish
candidate, not a hidden unfinished dependency of the creator loop.
