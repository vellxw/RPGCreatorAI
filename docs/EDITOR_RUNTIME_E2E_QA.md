# Editor → Runtime End-to-End QA

This document records the concrete Phase 7 proof that editor-authored
project data reaches the runtime. The implementation now uses three
complementary checks rather than one optimistic manual story:

1. **Editor save path** — Vitest drives the same reducer + `performSave`
   flow used by the React editor and reloads the active adapter.
2. **Desktop disk path** — Rust tests round-trip real map edits through
   the Tauri shell writer/reader.
3. **Runtime consumption path** — a PowerShell harness copies the bundled
   project to a temporary folder, edits visible map JSON, launches the
   native runtime twice, and proves the rendered frame changes.

Together these cover the full path the product actually uses:

```text
editor reducer → save adapter → project JSON on disk → C++ runtime loader → rendered frame
```

## Automated checks

| Layer | Command | Evidence |
| --- | --- | --- |
| Editor reducer + save adapter | `npx vitest run src/e2e/__tests__/editorRoundtrip.test.ts` | Paints collision, adds an event, saves, reloads, and asserts both edits persist. |
| Desktop shell persistence | `cargo test --manifest-path src-tauri/Cargo.toml --lib` | Includes `write_then_read_round_trips_map_edits`. |
| Runtime reads saved data | `powershell -File scripts/dev/verify-editor-runtime-roundtrip.ps1` | Mutates a copied `town.json`, launches the runtime, and verifies the edited first-frame screenshot hash differs from baseline. |

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
