# Phase 7 — Requirements

## Introduction

Phase 6 delivered every RPG subsystem at the data + runtime + validation
layer. They work, they are tested, and a sample game exercises all of
them. What is missing is **visibility**: a real player has no menu, no
inventory screen, no quest journal, no shop UI, and no in-battle
feedback; a real creator paints maps with a placeholder tile palette,
cannot easily move or duplicate events, and has no undo/redo.

Phase 7 closes that gap. It does **not** add new RPG systems. It does not
introduce AI. It does not expand schemas. It makes every existing system
visible and usable end-to-end, from authoring a map in the editor to
playing it through the runtime. The user has additionally promoted
original production assets into the first slice of the phase so the
creator loop is polished rather than still relying on emojis and flat
placeholder blocks.

The phase is defined by two parallel tracks:

- **Runtime UX** — menus, inventory, party/status, quest journal, shop,
  battle UI improvements, save/load slot picker.
- **Map creation workflow** — tile painting, collision painting, event
  placement/move/duplicate/delete, editor undo/redo, and an end-to-end
  proof that "edit → save → launch runtime → see the change" works.

Both tracks share a single closing requirement: a documented,
reproducible E2E QA pass.

## Out of scope

- New RPG systems (no self-switches runtime, no autorun/parallel common
  events runtime, no new commands).
- AI providers, prompt UIs, generation tooling.
- AI-backed asset generation providers, asset marketplaces, or remote
  asset libraries.
- HD-2D renderer, WebGPU, scripting language, modding API.
- Online publishing, marketplaces, cloud sync, multiplayer.
- Editor-side battle previewer or troop simulator.
- Animated tile transitions, lighting, weather.

## Requirements

### R0 — Original production assets

**User story:** As a creator and player, I want the shipped UI and sample
game to use coherent original visuals, so the product feels intentional
instead of placeholder-driven.

#### Acceptance Criteria

1. Production React UI SHALL NOT rely on random emoji glyphs for its
   main iconography.
2. The repo SHALL contain committed original generated assets under both
   `src/assets/generated/` and `assets/generated/`.
3. The editor SHALL use generated icons, tile previews, and event
   thumbnails in place of emoji placeholders.
4. The runtime SHALL render committed tile/entity sprites from disk
   instead of only flat colored rectangles.
5. Sample project data SHALL reference concrete sprite ids where
   appropriate (`npc_old_man`, `npc_shopkeeper`, `chest_closed`,
   `transfer_door`, `enemy_slime`).

### R1 — Pause / main menu

**User story:** As a player, I want to open a menu while playing, so I can
reach inventory, status, quests, save, and load without quitting.

#### Acceptance Criteria

1. WHEN the player presses `Escape` (or `Menu`) AND no dialogue, choice
   prompt, or battle is active THEN the runtime SHALL open the pause
   menu.
2. WHEN the pause menu is open THEN player movement, EventRunner
   advancement, and battle ticking SHALL be paused.
3. The pause menu SHALL list at minimum: `Inventory`, `Party`, `Quests`,
   `Save`, `Load`, `Close`.
4. WHEN the player selects a menu entry THEN the runtime SHALL push the
   matching sub-screen and SHALL allow `Escape` / `Backspace` to return.
5. The menu SHALL be operable with keyboard alone (arrow keys to
   navigate, `Enter`/`Space` to confirm, `Escape` to close).

### R2 — Inventory UI

**User story:** As a player, I want to see what items I own and how many,
so I know what I can use or sell.

#### Acceptance Criteria

1. WHEN the inventory screen is open THEN it SHALL list every owned item
   id, the human-readable name from the items database, and the owned
   amount.
2. Items not declared in the items database SHALL still render with the
   raw id and a `(unknown item)` note; the UI SHALL NOT crash on missing
   metadata.
3. The list SHALL be sorted deterministically (alphabetical by id) for
   stable screenshots and tests.
4. Selecting an item SHALL display its description from the database.
5. Phase 7 v1 SHALL NOT yet implement "use from menu" — that is deferred.

### R3 — Party / status UI

**User story:** As a player, I want to see my party members, their
levels, HP, MP, and equipment, so I understand my current strength.

#### Acceptance Criteria

1. The party screen SHALL list every actor id in `GameState.party` in
   order, with name, class, level, current HP / max HP, current MP / max
   MP, and equipped items.
2. Stats SHALL include base + class growth + equipment modifiers and
   match the resolver used by `BattleSystem`.
3. WHEN an actor's HP override exists in `GameState.actorHps` THEN it
   SHALL be displayed instead of the default actor HP.
4. The screen SHALL render correctly for an empty party (`No party
   members`) and SHALL NOT crash.

### R4 — Quest journal UI

**User story:** As a player, I want to see active and completed quests
with their objectives, so I know what to do next.

#### Acceptance Criteria

1. The journal SHALL group quests by state: `Active`, `Completed`,
   `Failed` (failed only when present).
2. Inactive quests (declared but not yet started) SHALL NOT appear.
3. For each shown quest THEN the UI SHALL render title, summary, and a
   per-objective bullet list with `[ ]` / `[x]` for `open` / `done`.
4. The data SHALL come strictly from `GameState.quests` joined with the
   `quests` database; missing database entries SHALL fall back to the
   raw id with a `(unknown quest)` note.

### R5 — Shop UI

**User story:** As a player, I want to spend gold to buy items at a shop,
not just see a debug log line.

#### Acceptance Criteria

1. WHEN the runtime executes `openShop(shopId)` THEN it SHALL open the
   shop UI with the shop name, the player's current gold, and the list
   of `(item, price)` listings.
2. WHEN the player confirms a buy AND has at least the price in gold
   THEN the runtime SHALL deduct the price and add the item.
3. WHEN the player has insufficient gold THEN the buy SHALL fail with a
   visible message and SHALL NOT change inventory or gold.
4. WHEN the player closes the shop THEN execution SHALL resume on the
   command after `openShop`.
5. The Phase 6 dialogue stub log line SHALL be replaced by the shop UI
   call; no behaviour SHALL be silently dropped.

### R6 — Battle UI improvements

**User story:** As a player, I want the battle to be visible — combatants,
HP bars, turn order, and outcome — instead of resolving silently.

#### Acceptance Criteria

1. WHEN a battle starts THEN the runtime SHALL render party + enemies
   with names, HP bars, and a turn-by-turn action log.
2. The deterministic Phase 6 resolver SHALL still drive the math; the UI
   SHALL only animate / display its turns.
3. The UI SHALL show the final outcome (`Victory`, `Defeat`, `Escape`)
   and the rewards before returning to the map.
4. The UI SHALL NOT introduce non-determinism (no real RNG, no
   timing-based outcomes); animations SHALL be cosmetic only.
5. Phase 7 v1 SHALL NOT yet add per-actor skill selection — that is
   deferred to a later phase.

### R7 — Save / load slot picker

**User story:** As a player, I want multiple save slots, so I can keep
several runs.

#### Acceptance Criteria

1. The runtime SHALL support at least 3 save slots, written under
   `saves/slot_<n>.json`.
2. WHEN the player opens `Save` from the pause menu THEN they SHALL see
   each slot's metadata (`empty` or `<map name> · <gold>g · <party
   summary> · <timestamp>`).
3. WHEN the player confirms `Save` on a non-empty slot THEN the runtime
   SHALL prompt for overwrite confirmation.
4. WHEN the player opens `Load` THEN they SHALL only be able to pick
   non-empty slots; empty slots SHALL be visually disabled.
5. The file format SHALL stay schemaVersion 2 from Phase 6; no migration
   is required.

### R8 — Map tile painting

**User story:** As a creator, I want to paint terrain on the map canvas,
so I can shape the world I'm building.

#### Acceptance Criteria

1. The Tile Palette SHALL bind selected palette entries to integer tile
   ids defined per-project (a small fixed set is fine for v1).
2. WHEN the user clicks (or drags with mouse held) on the map canvas
   THEN the selected tile SHALL be written to the active tile layer at
   that cell.
3. WHEN the user uses the eraser tool THEN the cell SHALL be cleared to
   the layer's empty value (`0` for ground, `0` for collision).
4. Painting SHALL mark the project dirty and SHALL be reflected by the
   existing Save flow without changes to the file format.
5. The painting SHALL clamp to the map bounds and SHALL NOT throw on
   clicks outside the canvas.

### R9 — Collision painting

**User story:** As a creator, I want to paint and erase collision blocks
on top of the ground layer.

#### Acceptance Criteria

1. The editor SHALL expose a `Collision` editing mode separate from
   `Terrain` painting.
2. WHEN in Collision mode THEN the canvas SHALL overlay collision cells
   (`9 = wall`) with a translucent indicator on top of the ground.
3. WHEN the user clicks a cell in Collision mode THEN the collision
   value SHALL toggle between `0` and `9`.
4. The collision value SHALL be persisted on the same `collision` layer
   already present on Phase 1+ maps; no schema change.

### R10 — Event placement / move / duplicate / delete

**User story:** As a creator, I want full event lifecycle on the map
canvas, not only via JSON.

#### Acceptance Criteria

1. WHEN the user is in `Event` placement mode AND clicks an empty cell
   THEN a new event SHALL be added with a unique id and default fields
   (no commands, type `object`, solid `false`).
2. WHEN the user drags an existing event THEN its `(x, y)` SHALL update
   to the dropped cell, clamped to the map.
3. WHEN the user duplicates a selected event (button or `Ctrl+D`) THEN
   a copy SHALL be inserted on the next free cell with a new unique id;
   commands and fields SHALL be deep-cloned.
4. WHEN the user deletes a selected event (button or `Delete` key) THEN
   the editor SHALL remove it after a confirm prompt.
5. All of the above SHALL flow through the existing reducer, mark dirty,
   and pass validation before save (no orphan id references).

### R11 — Editor undo / redo for map edits

**User story:** As a creator, I want to undo my last action when I
mis-paint or mis-place an event.

#### Acceptance Criteria

1. The editor SHALL support undo (`Ctrl+Z`) and redo (`Ctrl+Y` /
   `Ctrl+Shift+Z`) for at least: tile painting, collision toggling, and
   event place / move / duplicate / delete.
2. The undo stack SHALL be bounded (e.g. 100 entries) and SHALL collapse
   contiguous paint strokes into a single entry per stroke.
3. Undo / redo SHALL leave the project in the same dirty / saved state
   it would have if the user had taken the inverse action manually.
4. Saving SHALL NOT clear the undo stack; the stack SHALL persist for
   the editor session only (no need to persist across launches).
5. Undo / redo SHALL be scoped to the editor; the runtime is unaffected.

### R12 — End-to-end editor → runtime round-trip

**User story:** As a maintainer, I want a documented proof that editing a
map and launching the runtime shows my edit, so regressions are
detectable.

#### Acceptance Criteria

1. The repo SHALL document an explicit E2E QA flow under
   `docs/EDITOR_RUNTIME_E2E_QA.md` covering: edit a tile, edit a
   collision, place an event, save, launch runtime, observe the change.
2. There SHALL be a scripted check (Vitest + a smoke step) that:
   - mutates a map via the reducer, saves through the adapter,
   - re-reads the file from disk,
   - asserts the change is present in the on-disk JSON,
   - launches the runtime against the saved project and confirms the
     [INFO] map-load log mentions the same map id.
3. Manual screenshots from a real session SHALL be stored under
   `docs/screenshots/phase-7/` with names that match the QA doc.
4. WHEN the runtime cannot be launched in the current environment THEN
   the QA doc SHALL document that limitation honestly (per AGENTS.md
   global engineering rule 1–4).

### R13 — Validation, tests, and reporting

**User story:** As a maintainer, I want the existing validation,
typecheck, and test commands to keep working, with new coverage for the
Phase 7 surfaces.

#### Acceptance Criteria

1. `npx tsc --noEmit` SHALL exit 0.
2. `npx vite build` SHALL exit 0.
3. `npx vitest run` SHALL pass with new tests for: pause menu reducer,
   shop transaction (success + insufficient gold), save-slot picker
   metadata builder, paint-tile reducer, undo/redo reducer,
   event-place/duplicate/delete reducer.
4. `cargo test --manifest-path src-tauri/Cargo.toml --lib` SHALL pass.
5. `scripts\dev\verify-runtime.bat` SHALL pass; new C++ tests SHALL
   cover any new runtime menu state machine if it lives in C++.
6. The runtime smoke harness SHALL still pass against the bundled
   sample.
7. The validator SHALL continue to reject orphan references introduced
   by event placement / duplication; no new validation regressions
   SHALL be tolerated.
