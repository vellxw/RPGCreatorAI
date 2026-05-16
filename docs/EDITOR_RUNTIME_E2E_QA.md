# Editor → Runtime End-to-End QA

This document defines the explicit, reproducible flow that proves a map
edit in the editor reaches the runtime correctly. It is the closing
verification for Phase 7.

The QA has two layers:

1. **Automated layer** — a vitest harness that mutates a map in memory,
   saves through the same adapter the editor uses, re-reads the file,
   and asserts the change.
2. **Manual layer** — a documented sequence a human runs to capture
   screenshots and confirm the runtime reflects the edit on screen.

Both layers must pass for Phase 7 to be considered closed.

## Goals

- Detect any regression that breaks the editor → save → runtime data
  path before it ships.
- Document the manual flow so any maintainer can reproduce it.
- Capture screenshots in `docs/screenshots/phase-7/` proving the
  round-trip.

## Non-goals

- A full screen-recording-based UI test framework. Manual screenshots
  + structured logs are sufficient for v1.
- Asserting visual styling (text colour, panel fills). The runtime
  smoke harness already covers structural rendering.

## Prerequisites

| Requirement                                                  | Verified by               |
|--------------------------------------------------------------|---------------------------|
| Node.js 20+ and npm 10+                                      | `node --version`          |
| Rust 1.95+ (for Tauri shell)                                 | `cargo --version`         |
| MSVC + CMake (for runtime build)                             | `scripts\dev\verify-runtime.bat` |
| Working directory under `%LOCALAPPDATA%\RPGCreatorAI\build`   | already set in scripts    |

## Automated layer — vitest round-trip

### File

`src/e2e/__tests__/editorRoundtrip.test.ts`

### Flow

```ts
test('paint -> save -> reload reflects the change', async () => {
  // 1. Boot the same adapter the editor uses in dev mode.
  const adapter = new BrowserMemoryAdapter(seedFromBundledSample());

  // 2. Mutate the project through the same reducer the editor uses.
  let project = await adapter.readProject();
  project = projectReducer(project, {
    type: 'PAINT_TILE',
    mapId: 'town',
    layer: 'collision',
    x: 1,
    y: 1,
    tile: 9,
  });
  project = projectReducer(project, {
    type: 'PLACE_EVENT',
    mapId: 'town',
    event: makeDefaultEvent(/* x */ 4, /* y */ 4),
  });

  // 3. Save through the same write path the toolbar uses.
  await adapter.writeProject(project);

  // 4. Re-read and assert the on-disk JSON contains the edits.
  const reloaded = await adapter.readProject();
  const town = reloaded.maps['town'];
  const collision = town.layers.find(l => l.type === 'collision')!;
  const idx = 1 * town.width + 1;
  expect(collision.tiles[idx]).toBe(9);
  expect(town.events.find(e => e.x === 4 && e.y === 4)).toBeDefined();
});
```

### Pass criteria

- Test passes when run by `npx vitest run` inside CI / locally.
- The same harness exercises both the `BrowserMemoryAdapter` (always)
  and, when running under Tauri dev, the `FileSystemAdapter` (gated
  behind a runtime check that skips when not in Tauri).

## Manual layer — full editor → runtime walkthrough

### Steps

1. **Launch the editor in Tauri dev mode.**

   ```cmd
   npm run dev:tauri
   ```

   Wait for the Tauri window. Confirm the title is
   `RPGCreatorAI — Visual Editor` and the page renders the Maps screen.

   Capture: `docs/screenshots/phase-7/01-editor-loaded.png`.

2. **Switch to the `town` map.**

   Click `town` in the maps list (or it loads by default). Confirm the
   canvas shows the bundled town. Set zoom to 100%.

3. **Paint a collision wall.**

   - In the Tile Palette, choose the **Collision** tool.
   - Click the cell at `(1, 1)`. Confirm the overlay marker appears.

   Capture: `docs/screenshots/phase-7/02-collision-painted.png`.

4. **Place a new event.**

   - Switch tool to **Event**.
   - Click cell `(4, 4)`. A new event with id `evt_<8-hex>` appears.

   Capture: `docs/screenshots/phase-7/03-event-placed.png`.

5. **Undo and redo.**

   - Press `Ctrl+Z` once. Event should disappear.
   - Press `Ctrl+Y`. Event should reappear.

   Capture: `docs/screenshots/phase-7/04-undo-redo.png` (showing the
   event back in place).

6. **Save the project.**

   Click Save in the toolbar (or `Ctrl+S`). Confirm the dirty indicator
   clears. Inspect `data/maps/town.json` directly and verify the
   collision cell at `(1, 1)` is `9` and the new event is present.

   Capture: `docs/screenshots/phase-7/05-saved.png`.

7. **Launch the runtime against the saved project.**

   ```cmd
   build\rpg_creator_runtime.exe
   ```

   - Wait for the SDL window titled `My First RPG`.
   - Confirm the runtime stdout includes:
     - `[INFO] Project loaded: My First RPG`
     - `[INFO] Map loaded: town`
   - Walk the player toward cell `(1, 1)` — the collision cell — and
     confirm the player cannot enter it.
   - Walk the player onto cell `(4, 4)` and press `E`. Confirm the
     placeholder event triggers (no commands; the EventRunner logs
     `[INFO] Event triggered: evt_<8-hex>`).

   Capture: `docs/screenshots/phase-7/06-runtime-reflects-changes.png`.

8. **Open the pause menu in the runtime.**

   Press `Escape`. Confirm the menu opens with Inventory / Party /
   Quests / Save / Load / Close. Navigate through each sub-screen and
   verify rendering against `docs/RUNTIME_UI_DESIGN.md`.

   Capture per sub-screen: `docs/screenshots/phase-7/07-menu-root.png`,
   `08-menu-inventory.png`, `09-menu-party.png`, `10-menu-quests.png`,
   `11-menu-save.png`, `12-menu-load.png`.

9. **Trigger a shop and a battle.**

   Walk to the shop NPC in the bundled sample. Confirm the new shop UI
   replaces the Phase 6 dialogue stub.

   Capture: `docs/screenshots/phase-7/13-shop.png`.

   Walk into the slime patch. Confirm the battle UI shows combatants,
   HP bars, and the turn log.

   Capture: `docs/screenshots/phase-7/14-battle.png`.

   On Victory, confirm the rewards summary appears.

   Capture: `docs/screenshots/phase-7/15-battle-victory.png`.

10. **Save and load through the slot picker.**

    Open the menu, choose Save, pick Slot 2, confirm. Confirm the
    `Saved to slot 2` toast appears. Inspect `saves/slot_2.json` to
    confirm the schemaVersion 2 file exists.

    Open the menu, choose Load, pick Slot 2, confirm. Confirm the
    runtime restores state.

    Capture: `docs/screenshots/phase-7/16-save-slot.png`,
    `17-load-slot.png`.

### Pass criteria

- Every step above completes without errors.
- The runtime stdout never logs `[ERROR]`.
- The runtime never crashes.
- The screenshots match the layout in `docs/RUNTIME_UI_DESIGN.md`.

## Limitations and honesty

If any of the manual steps cannot be reproduced in the current
environment (for example, the runtime cannot be launched headlessly in
CI), this document SHALL state so explicitly. Per AGENTS.md global
rules 1–4, agents do not claim runtime opens unless launched and
observed.

When skipping a step, append a section here:

```
## Skipped on <date>

- Step <n>: <reason>
- Replacement evidence: <path-to-log-or-trace>
```

## Validation matrix

| Layer                        | Command                                              | Expected      |
|------------------------------|------------------------------------------------------|---------------|
| Vitest e2e harness           | `npx vitest run -- editorRoundtrip`                  | PASS          |
| Frontend typecheck           | `npx tsc --noEmit`                                   | exit 0        |
| Frontend production build    | `npx vite build`                                     | exit 0        |
| Frontend full test suite     | `npx vitest run`                                     | all green     |
| Rust unit tests              | `cargo test --manifest-path src-tauri/Cargo.toml --lib` | PASS       |
| Rust build                   | `cargo build --manifest-path src-tauri/Cargo.toml`   | PASS          |
| Runtime build + ctest        | `scripts\dev\verify-runtime.bat`                     | PASS          |
| Runtime smoke                | `scripts\dev\smoke-runtime.bat`                      | SMOKE PASSED  |
| Tauri content regression     | `npm run desktop:verify-content`                     | OK            |
| Manual editor walkthrough    | this document, steps 1–10                            | screenshots captured |

## When this QA fails

- A failing automated round-trip blocks Phase 7 closure.
- A failing manual step blocks Phase 7 closure unless the limitation
  is documented and a replacement evidence trace is provided per the
  honesty rule above.
- Regressions discovered during the walk-through are logged in
  `docs/VALIDATION_LOG.md` with the failing command, the fix applied,
  and the re-run result, before Phase 7 is closed.

## Where the captured screenshots go

- `docs/screenshots/phase-7/01-editor-loaded.png`
- `docs/screenshots/phase-7/02-collision-painted.png`
- `docs/screenshots/phase-7/03-event-placed.png`
- `docs/screenshots/phase-7/04-undo-redo.png`
- `docs/screenshots/phase-7/05-saved.png`
- `docs/screenshots/phase-7/06-runtime-reflects-changes.png`
- `docs/screenshots/phase-7/07-menu-root.png`
- `docs/screenshots/phase-7/08-menu-inventory.png`
- `docs/screenshots/phase-7/09-menu-party.png`
- `docs/screenshots/phase-7/10-menu-quests.png`
- `docs/screenshots/phase-7/11-menu-save.png`
- `docs/screenshots/phase-7/12-menu-load.png`
- `docs/screenshots/phase-7/13-shop.png`
- `docs/screenshots/phase-7/14-battle.png`
- `docs/screenshots/phase-7/15-battle-victory.png`
- `docs/screenshots/phase-7/16-save-slot.png`
- `docs/screenshots/phase-7/17-load-slot.png`

The folder is created on first use. The QA doc is the source of truth
for naming and ordering; rename only if you also update this doc.
