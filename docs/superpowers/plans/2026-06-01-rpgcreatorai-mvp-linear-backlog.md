# RPGCreatorAI MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the first fully usable local RPGCreatorAI MVP: a professional RPG Maker MZ-style desktop editor that can author, validate, save, playtest, launch, and run a small RPG end to end without AI or network dependencies.

**Architecture:** Keep the runtime deterministic and data-driven. The React/Tauri editor owns authoring, validation, persistence, and launch ergonomics; the C++ runtime interprets project data, renders, runs events, saves state, and exposes deterministic debug evidence through logs and bounded files. No proprietary RPG Maker formats or assets are introduced.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind 4, Tauri 2, Rust, C++20, SDL2, CMake, Vitest, doctest.

---

## Linear Import Notes

Linear tools were not exposed in this Codex session, so this file is the source backlog to import or recreate as Linear issues. Use these labels:

- `mvp`
- `phase-10`
- `database-v2`
- `runtime-mz`
- `playtest-debug`
- `desktop`
- `qa`
- `docs`
- `parallel-safe`
- `integration-gate`

Use these priorities:

- `P0`: blocks usable MVP.
- `P1`: required before declaring Phase 10 done.
- `P2`: quality and hardening needed before public release.

Recommended Linear project:

- Name: `RPGCreatorAI Usable MVP`
- Target date: after all P0/P1 tasks pass validation.
- Milestones: `MVP Planning`, `Database V2`, `Runtime MZ Foundation`, `Playtest Debug Tools`, `Integration QA`.

## Subagent Execution Rules

- Every issue must run in its own branch or worktree named `codex/mvp-<issue-id>-<short-name>`.
- Each subagent reads `AGENTS.md`, `docs/GOAL_STACK.md`, `docs/GAME_VISUAL_DESIGN.md`, `.kiro/specs/phase10-professional-mz-editor/*`, `CMakeLists.txt`, and `tests/CMakeLists.txt` before editing.
- Each subagent implements only its issue. If it needs a shared type or helper outside scope, it adds the smallest compatible change and documents the dependency.
- Every issue updates tests and, when it runs validation, appends a short entry to `docs/VALIDATION_LOG.md`.
- No subagent may claim success without running the validation commands listed in its issue.
- Integration tasks are not parallel-safe. Run them after feature branches are merged.
- If two issues touch `src/types/project.ts`, `src/stores/projectStore.ts`, or `src/screens/DatabaseScreen.tsx`, merge the schema/foundation issue first, then rebase the UI issues.

## MVP Definition Of Done

- Desktop editor opens and saves a project folder through Tauri.
- User can create maps, paint layers/regions/collision, edit map properties, place events, create event pages, edit event commands, and edit all MVP database shards.
- Validation blocks broken saves and broken runtime launches with actionable messages.
- Playtest can launch the native runtime from project start, current map, or selected event context.
- Runtime supports interactive choices, event target movement routes, deterministic event priority/Y-sort, foreground occlusion, and local audio v1.
- Debug tools show launch logs, validation, event traces, and runtime/editor state snapshots without AI placeholders.
- Bundled sample project exercises the core MVP features.
- `npm run verify`, C++ configure/build/tests, Tauri content verification, runtime smoke, and editor-runtime roundtrip pass or have a documented blocker.

## Dependency Map

- `MVP-000` must be done first.
- `DB-001` must be merged before `DB-002` through `DB-009`.
- `RT-001` can run parallel with `DB-001`, but final validation depends on database schema stability.
- `RT-002` through `RT-006` can run mostly in parallel after `RT-001` creates the validator seam.
- `PT-001` can run parallel with runtime tasks, but `PT-002` depends on the runtime launch/session contract.
- `INT-001` through `INT-005` run last.

---

## MVP-000 - Lock MVP Scope And Linear Tracking Metadata

Priority: P0
Labels: `mvp`, `phase-10`, `docs`, `integration-gate`
Parallel safety: run first, not parallel-safe

### Files

- Modify: `.kiro/specs/phase10-professional-mz-editor/requirements.md`
- Modify: `.kiro/specs/phase10-professional-mz-editor/design.md`
- Modify: `.kiro/specs/phase10-professional-mz-editor/tasks.md`
- Modify: `docs/GOAL_STACK.md`
- Modify: `docs/RPG_SYSTEMS_MATRIX.md`
- Modify: `docs/VALIDATION_LOG.md`

### Steps

- [ ] Add a `Phase 10 MVP Closeout` section to requirements with explicit P0 outcomes: Database V2, runtime validator, choices UI, event movement, event priority/Y-sort, foreground occlusion, local audio, current map/event playtest, logs, trace, state inspector, plugin-command v1.
- [ ] Add non-goals: no general scripting VM, no AI runtime provider, no marketplace, no network/cloud storage, no proprietary RPG Maker formats, no installer polish beyond the current Tauri debug build.
- [ ] Expand `tasks.md` with Slice 4, Slice 5, Slice 6, and Integration QA checkboxes matching this backlog.
- [ ] Update `GOAL_STACK.md` open subgoals so it names the exact MVP closeout slices and does not imply future-phase AI work.
- [ ] Update `RPG_SYSTEMS_MATRIX.md` statuses conservatively. Mark rows as `partial` until editor, runtime, validation, and tests are all present.
- [ ] Add a validation-log entry noting this is a planning/docs-only change and no build validation was required for this issue.

### Validation

- [ ] Run `git diff --check`.
- [ ] Expected: no whitespace errors.

### Acceptance Criteria

- A fresh subagent can identify the remaining Phase 10 MVP scope from docs alone.
- The docs do not promise AI, scripting, marketplace, cloud, or proprietary compatibility.
- Every later issue in this backlog maps to at least one checkbox in `.kiro/specs/phase10-professional-mz-editor/tasks.md`.

---

## DB-001 - Extract Database V2 Editor Framework

Priority: P0
Labels: `mvp`, `phase-10`, `database-v2`, `parallel-safe`
Parallel safety: foundation branch; merge before other DB issues

### Files

- Create: `src/components/database/DatabaseLayout.tsx`
- Create: `src/components/database/DatabaseList.tsx`
- Create: `src/components/database/DatabaseFields.tsx`
- Create: `src/components/database/ReferenceSelect.tsx`
- Create: `src/components/database/ArrayFieldEditor.tsx`
- Create: `src/components/database/__tests__/DatabaseFields.test.tsx`
- Modify: `src/screens/DatabaseScreen.tsx`
- Modify: `src/components/ui/Input.tsx` if shared select/input gaps are found

### Steps

- [ ] Move the repeated list/detail structure out of `DatabaseScreen.tsx` into `DatabaseLayout`.
- [ ] Move add, duplicate, delete, select behavior into `DatabaseList`. Keep existing reducer actions: `ADD_DATABASE_ENTRY`, `UPDATE_DATABASE_ENTRY`, `RENAME_DATABASE_ENTRY`, `REMOVE_DATABASE_ENTRY`.
- [ ] Create `TextField`, `NumberField`, `CheckboxField`, `SelectField`, `TextareaField`, and `IdField` helpers in `DatabaseFields.tsx`.
- [ ] Create `ReferenceSelect` that receives `{ value, options, emptyLabel, onChange }` and renders stable labels from database entries.
- [ ] Create `ArrayFieldEditor` for simple arrays and object arrays with add/remove/reorder controls.
- [ ] Keep current tabs and behavior working while internals are extracted.
- [ ] Do not redesign the screen. This is a refactor for safer specialized editors.

### Validation

- [ ] Run `npm test -- --run src/stores/__tests__/databaseReducer.test.ts src/validation/__tests__/validateDatabases.test.ts`.
- [ ] Run `npm run typecheck`.
- [ ] Expected: tests and typecheck pass.

### Acceptance Criteria

- `DatabaseScreen.tsx` is smaller and delegates generic UI behavior.
- Existing database CRUD still works for actors, classes, skills, weapons, armors, states, enemies, troops, quests, shops, switches, variables, common events, and system.
- No database data shape changes are introduced in this issue.

---

## DB-002 - Add Types And Terms Database Shards

Priority: P0
Labels: `mvp`, `phase-10`, `database-v2`, `parallel-safe`
Parallel safety: touches shared schema; merge before UI tasks using types/terms

### Files

- Create: `data/database/types.json`
- Create: `data/database/terms.json`
- Modify: `data/project.json`
- Modify: `src/types/project.ts`
- Modify: `src/adapters/defaultDatabases.ts`
- Modify: `src/adapters/BrowserMemoryAdapter.ts`
- Modify: `src/adapters/FileSystemAdapter.ts`
- Modify: `src/adapters/types.ts`
- Modify: `src-tauri/src/project_state.rs`
- Modify: `src-tauri/src/fs_commands.rs`
- Modify: `src/validation/validateProject.ts`
- Modify: `src/validation/__tests__/validateDatabases.test.ts`
- Modify: `src/adapters/__tests__/BrowserMemoryAdapter.test.ts`
- Modify: `src/adapters/__tests__/FileSystemAdapter.test.ts`

### Steps

- [ ] Add `types.json` with deterministic starter data: weapon types, armor types, skill types, elements, equipment slots, and item categories.
- [ ] Add `terms.json` with UI vocabulary: currency unit, menu labels, stat labels, command labels, save/load labels, and battle labels.
- [ ] Extend `DatabasePaths` with optional `types` and `terms`.
- [ ] Extend `DatabaseEntries` with `types` and `terms`.
- [ ] Add TypeScript interfaces: `TypesDatabaseData`, `TermsDatabaseData`, `NamedTypeEntry`, `StatTerms`, `MenuTerms`, `BattleTerms`.
- [ ] Update default database merging so missing shards use complete defaults.
- [ ] Update browser and filesystem adapters so new shards load, save, export, and import with the rest of the project.
- [ ] Update Rust project-state mirror so Tauri round-trips the new paths and does not drop the shards.
- [ ] Add validator checks for duplicate IDs, empty names, missing default equipment slots, and terms missing required labels.
- [ ] Keep runtime use optional in this issue. Runtime consumption happens in later tasks.

### Validation

- [ ] Run `npm test -- --run src/adapters/__tests__/BrowserMemoryAdapter.test.ts src/adapters/__tests__/FileSystemAdapter.test.ts src/validation/__tests__/validateDatabases.test.ts`.
- [ ] Run `npm run typecheck`.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml`.
- [ ] Expected: all pass.

### Acceptance Criteria

- New projects and old projects both load.
- Export/import preserves `types` and `terms`.
- Tauri save/load preserves `database.types` and `database.terms`.
- Validation reports duplicate or malformed type/term data.

---

## DB-003 - Build Dedicated Tileset Database Editor

Priority: P0
Labels: `mvp`, `phase-10`, `database-v2`, `parallel-safe`

### Files

- Create: `src/components/database/TilesetEditor.tsx`
- Create: `src/components/database/__tests__/TilesetEditor.test.tsx`
- Modify: `src/screens/DatabaseScreen.tsx`
- Modify: `src/visual/tileCatalog.ts`
- Modify: `src/visual/__tests__/tileCatalog.test.ts`
- Modify: `src/validation/validateProject.ts`
- Modify: `src/validation/__tests__/validateProject.test.ts`

### Steps

- [ ] Add a `Tilesets` tab to the database screen.
- [ ] In the tileset list, support create, duplicate, rename ID, delete with reference warnings, and select.
- [ ] In the detail panel, edit tileset name and tile size.
- [ ] Add a tile table grouped by group `A`, `B`, `C`, `D`, `E`, `Region`, `Collision`.
- [ ] For each tile row, edit ID, name, asset key, group, passability, directional passability, terrain tag, ladder, bush, counter, damage, and priority.
- [ ] Add asset-key validation against `src/assets/generated/assetCatalog.ts` known tile assets.
- [ ] Add duplicate tile ID validation within each tileset.
- [ ] Add a small visual swatch for each tile asset. Unknown assets must render the existing void warning swatch.
- [ ] Preserve existing tile-catalog behavior for current maps.

### Validation

- [ ] Run `npm test -- --run src/visual/__tests__/tileCatalog.test.ts src/validation/__tests__/validateProject.test.ts`.
- [ ] Run `npm run typecheck`.
- [ ] Expected: all pass.

### Acceptance Criteria

- A user can author a tileset without editing JSON manually.
- Passability and priority metadata authored in the editor are saved to `data/database/tilesets.json`.
- Maps referencing deleted or missing tilesets get a clear validation error.

---

## DB-004 - Build Items, Weapons, Armors, And States V2 Editors

Priority: P0
Labels: `mvp`, `phase-10`, `database-v2`, `parallel-safe`

### Files

- Create: `src/components/database/ItemsEditor.tsx`
- Create: `src/components/database/EquipmentEditor.tsx`
- Create: `src/components/database/StatesEditor.tsx`
- Modify: `src/screens/DatabaseScreen.tsx`
- Modify: `src/validation/validateProject.ts`
- Modify: `src/validation/__tests__/validateDatabases.test.ts`
- Modify: `src/stores/__tests__/databaseReducer.test.ts`

### Steps

- [ ] Replace generic item editing with an item-specific editor for ID, name, description, type/category, price, consumable HP/MP effect, equipment slot, and stat modifiers.
- [ ] Replace generic weapon editing with fields for weapon type reference, price, params, animation reference, and traits.
- [ ] Replace generic armor editing with fields for armor type reference, armor slot, price, params, and traits.
- [ ] Replace generic state editing with fields for priority, remove-at-battle-end, restriction, and traits.
- [ ] Use `types` database references for weapon type, armor type, item category, and equipment slot when `DB-002` is merged.
- [ ] Validate references and numeric ranges: prices >= 0, priorities 0..100, stat params finite, rates finite.
- [ ] Keep legacy `items.json` compatibility. Do not delete existing `weapons.json` or `armors.json`.

### Validation

- [ ] Run `npm test -- --run src/stores/__tests__/databaseReducer.test.ts src/validation/__tests__/validateDatabases.test.ts`.
- [ ] Run `npm run typecheck`.
- [ ] Expected: all pass.

### Acceptance Criteria

- Users can author all equipment and state data from clear domain-specific forms.
- Validation catches unknown type references and invalid numeric fields.
- Runtime battle equipment tests still pass after data edits.

---

## DB-005 - Build Actors, Classes, Skills, Enemies, And Troops V2 Editors

Priority: P0
Labels: `mvp`, `phase-10`, `database-v2`, `parallel-safe`

### Files

- Create: `src/components/database/ActorsEditor.tsx`
- Create: `src/components/database/ClassesEditor.tsx`
- Create: `src/components/database/SkillsEditor.tsx`
- Create: `src/components/database/EnemiesEditor.tsx`
- Create: `src/components/database/TroopsEditor.tsx`
- Modify: `src/screens/DatabaseScreen.tsx`
- Modify: `src/validation/validateProject.ts`
- Modify: `src/validation/__tests__/validateDatabases.test.ts`

### Steps

- [ ] Add actor editor fields for class, level, HP/MP, base stats, equipment references, and learned skills.
- [ ] Add class editor fields for growth stats, usable equipment slots, and learned skills by level.
- [ ] Add skill editor fields for MP cost, power, target, element reference, and description.
- [ ] Add enemy editor fields for stats, EXP, gold, and drops with item reference and rate.
- [ ] Add troop editor fields for ordered enemy members, add/remove/reorder, and empty troop warnings.
- [ ] Use type database references for skill types/elements/equipment where available.
- [ ] Validate references and numeric ranges: level >= 1, stats >= 0, drop rates 0..1, troop members known.

### Validation

- [ ] Run `npm test -- --run src/validation/__tests__/validateDatabases.test.ts`.
- [ ] Run `npm run typecheck`.
- [ ] Run `cmake --preset default`.
- [ ] Run `cmake --build --preset default`.
- [ ] Run `ctest --test-dir build --output-on-failure`.
- [ ] Expected: all pass.

### Acceptance Criteria

- A small battle setup can be authored without JSON edits.
- Existing deterministic battle tests still pass.
- Invalid references are blocked before runtime launch.

---

## DB-006 - Build Quests, Shops, Switches, Variables, And System V2 Editors

Priority: P0
Labels: `mvp`, `phase-10`, `database-v2`, `parallel-safe`

### Files

- Create: `src/components/database/QuestsEditor.tsx`
- Create: `src/components/database/ShopsEditor.tsx`
- Create: `src/components/database/SwitchesVariablesEditor.tsx`
- Create: `src/components/database/SystemEditor.tsx`
- Modify: `src/screens/DatabaseScreen.tsx`
- Modify: `src/validation/validateProject.ts`
- Modify: `src/validation/__tests__/validateDatabases.test.ts`

### Steps

- [ ] Add quest editor with objectives, rewards, item rewards, and stable objective IDs.
- [ ] Add shop editor with item listings, price override, duplicate listing warning, and empty shop warning.
- [ ] Add switches editor with ID, name, initial value, and reference usage count.
- [ ] Add variables editor with ID, name, initial value, and reference usage count.
- [ ] Add system editor sections for starting party, starting gold, player animation set, movement speed, default character height, default BGM, window tint, and battle background.
- [ ] Validate starting party actor references, animation references, movement speed enum, and non-negative starting gold.
- [ ] Show inline reference warnings before ID rename or delete.

### Validation

- [ ] Run `npm test -- --run src/validation/__tests__/validateDatabases.test.ts src/validation/__tests__/validateProject.test.ts`.
- [ ] Run `npm run typecheck`.
- [ ] Expected: all pass.

### Acceptance Criteria

- Core RPG project setup can be completed from the database screen.
- Users can see which switches/variables are used before renaming/deleting.
- System defaults round-trip through save/export/import.

---

## DB-007 - Add Common Event Command Editing

Priority: P0
Labels: `mvp`, `phase-10`, `database-v2`, `parallel-safe`

### Files

- Create: `src/components/events/CommandStackEditor.tsx`
- Create: `src/components/events/__tests__/CommandStackEditor.test.tsx`
- Modify: `src/screens/EventEditorScreen.tsx`
- Modify: `src/screens/DatabaseScreen.tsx`
- Modify: `src/components/events/CommandEditor.tsx`
- Modify: `src/stores/projectStore.ts`
- Modify: `src/stores/__tests__/projectReducer.test.ts`
- Modify: `src/validation/__tests__/validateProject.test.ts`

### Steps

- [ ] Extract the existing event-page command stack UI into `CommandStackEditor`.
- [ ] Keep support for insert, move, duplicate, cut, copy, paste, range delete, and empty branch insertion.
- [ ] Use the extracted stack in `EventEditorScreen` for map event pages.
- [ ] Use the same stack in the common events database tab.
- [ ] Add reducer actions for common event command update/insert/remove/move/duplicate/range delete if existing generic database update is too coarse for undo safety.
- [ ] Preserve validation for nested branches, movement routes, battle branches, and choices.
- [ ] Add tests proving common event command editing does not mutate map events.

### Validation

- [ ] Run `npm test -- --run src/stores/__tests__/projectReducer.test.ts src/validation/__tests__/validateProject.test.ts`.
- [ ] Run `npm run typecheck`.
- [ ] Expected: all pass.

### Acceptance Criteria

- Common events can be authored with the same command-stack quality as map events.
- Autorun/parallel common events can be edited without manual JSON.
- Undo/redo and dirty tracking still work.

---

## DB-008 - Build Animation Database V2 Editor With Preview

Priority: P1
Labels: `mvp`, `phase-10`, `database-v2`, `parallel-safe`

### Files

- Create: `src/components/database/AnimationsEditor.tsx`
- Create: `src/components/database/AnimationPreview.tsx`
- Create: `src/components/database/__tests__/AnimationsEditor.test.tsx`
- Modify: `src/screens/DatabaseScreen.tsx`
- Modify: `src/assets/generated/assetCatalog.ts` only if generated assets require new exports
- Modify: `src/validation/validateProject.ts`
- Modify: `src/validation/__tests__/validateDatabases.test.ts`

### Steps

- [ ] Add animation-set list create/duplicate/rename/delete.
- [ ] Add display editor for `heightTiles`, `widthTiles`, and `yOffsetPx`.
- [ ] Add clip editor for action, direction, asset, frame size, frame count, FPS, loop, and anchor.
- [ ] Add preview canvas or SVG that displays the selected clip frame animation using existing generated PNG sheets.
- [ ] Validate frame count > 0, FPS > 0, frame sizes > 0, and asset reference known.
- [ ] Warn when the player system animation set does not contain idle/walk clips for all four directions.

### Validation

- [ ] Run `npm test -- --run src/assets/generated/__tests__/assetCatalog.test.ts src/validation/__tests__/validateDatabases.test.ts`.
- [ ] Run `npm run typecheck`.
- [ ] Expected: all pass.

### Acceptance Criteria

- Users can inspect and edit animation metadata without reading JSON.
- The preview reflects display height and frame clipping.
- Broken player animation sets are caught before runtime launch.

---

## DB-009 - Database Delete/Rename Reference Safety

Priority: P1
Labels: `mvp`, `phase-10`, `database-v2`, `qa`

### Files

- Create: `src/validation/referenceIndex.ts`
- Create: `src/validation/__tests__/referenceIndex.test.ts`
- Modify: `src/screens/DatabaseScreen.tsx`
- Modify: `src/components/database/DatabaseList.tsx`
- Modify: `src/stores/projectStore.ts`
- Modify: `src/stores/__tests__/databaseReducer.test.ts`

### Steps

- [ ] Build a reference index that reports all usages of a database ID across project metadata, maps, events, event pages, commands, common events, and other databases.
- [ ] Before deleting an entry, show blocking references and require the user to remove them first.
- [ ] Before renaming an ID, offer `Rename only ID` and `Rename and update references`.
- [ ] Implement `Rename and update references` deterministically in the reducer for switches, variables, items, actors, classes, skills, enemies, troops, quests, shops, common events, animations, tilesets, types, and terms where applicable.
- [ ] Add tests for switch, variable, map event command, common event command, quest objective, shop listing, and tileset references.

### Validation

- [ ] Run `npm test -- --run src/validation/__tests__/referenceIndex.test.ts src/stores/__tests__/databaseReducer.test.ts`.
- [ ] Run `npm run typecheck`.
- [ ] Expected: all pass.

### Acceptance Criteria

- Users cannot silently break projects by deleting referenced data.
- Reference-updating rename is deterministic and covered by tests.
- Validation still catches any missed broken reference.

---

## RT-001 - Add Runtime Project Validator Seam

Priority: P0
Labels: `mvp`, `phase-10`, `runtime-mz`, `parallel-safe`

### Files

- Create: `src/runtime/RuntimeProjectValidator.h`
- Create: `src/runtime/RuntimeProjectValidator.cpp`
- Create: `tests/test_runtime_project_validator.cpp`
- Modify: `tests/CMakeLists.txt`
- Modify: `src/core/Application.cpp`
- Modify: `src/main.cpp` if startup error reporting needs a return code
- Modify: `docs/RUNTIME_CONTROLS.md`
- Modify: `docs/VALIDATION_LOG.md`

### Steps

- [ ] Define `RuntimeValidationMessage { level, message, source }`.
- [ ] Define `RuntimeValidationReport { errors, warnings, ok() }`.
- [ ] Implement validation that loads `data/project.json`, every referenced map, and every configured database shard.
- [ ] Validate project map references: duplicate IDs, empty/unsafe paths, missing maps, missing start map.
- [ ] Validate maps: dimensions, layer tile counts, required layers, event IDs, event bounds, page triggers, page priorities.
- [ ] Validate runtime-critical command references: transfer map, items, shops, troops, common events, switches, variables, self switches, movement routes, animations.
- [ ] Integrate validator before `Game::initialize`. If errors exist, log every error and return non-zero without opening a broken game loop.
- [ ] Keep warnings non-fatal.

### Validation

- [ ] Run `cmake --preset default`.
- [ ] Run `cmake --build --preset default`.
- [ ] Run `ctest --test-dir build --output-on-failure`.
- [ ] Expected: `test_runtime_project_validator.cpp` passes and existing tests pass.

### Acceptance Criteria

- Runtime fails early with clear errors instead of undefined behavior on malformed projects.
- Existing bundled sample runs unchanged.
- Validator does not hardcode game content.

---

## RT-002 - Implement Interactive Runtime Choices UI

Priority: P0
Labels: `mvp`, `phase-10`, `runtime-mz`, `parallel-safe`

### Files

- Modify: `src/dialogue/DialogueSystem.h`
- Modify: `src/dialogue/DialogueSystem.cpp`
- Modify: `src/events/EventRunner.h`
- Modify: `src/events/EventRunner.cpp`
- Modify: `src/core/Game.cpp`
- Modify: `src/renderer/IRenderer.h` only if a separate choice render method is cleaner
- Modify: `src/renderer/Renderer2D.cpp`
- Modify: `tests/test_event_runner.cpp`
- Create: `tests/test_dialogue_choices.cpp`

### Steps

- [ ] Extend `DialogueSystem` with an optional choice mode: prompt, labels, selected index, confirmed result, and cancelled result.
- [ ] Add methods `showChoices(prompt, labels)`, `moveChoice(delta)`, `confirmChoice()`, `cancelChoice()`, `hasChoiceResult()`, and `consumeChoiceResult()`.
- [ ] Change `EventRunner` so `showChoices` opens the choice UI and waits until a result exists instead of defaulting to the first choice immediately.
- [ ] Preserve deterministic fallback for tests by allowing an injected choice picker/resolver.
- [ ] Update `Game::update` input priority so Up/Down moves selection, Confirm selects, Cancel chooses a deterministic cancel path. If no cancel branch exists, use the first choice.
- [ ] Render prompt and choices in `Renderer2D::renderDialogue`, including selected row marker and keyboard hint.
- [ ] Add tests for selection movement, confirm, cancel, and event branch execution.

### Validation

- [ ] Run `cmake --build --preset default`.
- [ ] Run `ctest --test-dir build --output-on-failure`.
- [ ] Run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/smoke-runtime.ps1` if available on the machine.
- [ ] Expected: tests pass; smoke still reaches the sample choice interaction.

### Acceptance Criteria

- Runtime choices are visible and selectable.
- Event execution pauses until the player selects a choice.
- Old tests that inject a choice picker remain deterministic.

---

## RT-003 - Implement Event Target Movement Routes

Priority: P0
Labels: `mvp`, `phase-10`, `runtime-mz`, `parallel-safe`

### Files

- Modify: `src/types/MapTypes.h`
- Modify: `src/world/MapScene.h`
- Modify: `src/world/MapScene.cpp`
- Modify: `src/core/Game.h`
- Modify: `src/core/Game.cpp`
- Modify: `src/events/EventRunner.cpp`
- Modify: `tests/test_game_movement_route.cpp`
- Modify: `tests/test_map_loader.cpp`

### Steps

- [x] Add mutable runtime event positions without changing authored map data on disk.
- [x] Add `RuntimeEventState` keyed by event ID with x, y, direction, optional movement interpolation, and active route state.
- [x] Update collision checks so event-target movement respects map bounds, collision layer, `through`, and same-priority blocking events.
- [x] Implement `setMovementRoute` targets: `player`, `thisEvent`, and named `event`.
- [x] Implement `repeat`: repeat route while the issuing runner remains active, with a deterministic max-step guard per frame to avoid infinite loops.
- [x] Implement `skippable`: blocked route steps are skipped when true; otherwise the route stops and blocks if `wait` is true.
- [x] Implement `wait`: issuing runner resumes only after the target route completes or stops.
- [x] Ensure transfer reload clears event runtime state for the old map and initializes the new map deterministically.
- [x] Add tests for event-target route, blocked route, skippable route, wait behavior, repeat guard, and route targeting `thisEvent`.

### Validation

- [x] Run `cmake --build --preset default`.
- [x] Run `ctest --test-dir build --output-on-failure`.
- [x] Expected: all movement route tests pass.

### Acceptance Criteria

- Event-target movement works in the native runtime.
- Event movement does not mutate JSON map data.
- Infinite or malformed routes cannot lock the runtime.

---

## RT-004 - Implement Event Priority, Y-Sort, And Above/Below Rendering

Priority: P0
Labels: `mvp`, `phase-10`, `runtime-mz`, `parallel-safe`

### Files

- Modify: `src/renderer/RenderSnapshot.h`
- Modify: `src/core/Game.cpp`
- Modify: `src/renderer/Renderer2D.cpp`
- Modify: `src/events/EventPageEvaluator.h`
- Modify: `src/events/EventPageEvaluator.cpp`
- Modify: `tests/test_event_page_evaluator.cpp`
- Create: `tests/test_render_snapshot_order.cpp`
- Modify: `tests/CMakeLists.txt`

### Steps

- [x] Add render priority to `EntityRenderSprite`: `belowCharacters`, `sameAsCharacters`, `aboveCharacters`.
- [x] Populate render priority from the active event page, falling back to legacy event solid/priority semantics.
- [x] Build three ordered buckets: below, same, above.
- [x] Sort the same-priority bucket by visual foot Y, then stable ID tie-breaker, with the player included in the same bucket.
- [x] Render below bucket before the player/same bucket, same bucket in sorted order, and above bucket after same bucket.
- [x] Keep event collision behavior tied to priority and `through`, not renderer assumptions.
- [x] Add tests proving deterministic order for player/event overlap and stable ties.

### Validation

- [x] Run `cmake --build --preset default`.
- [x] Run `ctest --test-dir build --output-on-failure`.
- [x] Expected: render ordering tests and existing event-page tests pass.

### Acceptance Criteria

- Same-priority events visually interleave with the player by foot position.
- Below/above priority renders in the expected layer.
- Sorting is deterministic across runs.

---

## RT-005 - Render Foreground Layer As Occlusion

Priority: P0
Labels: `mvp`, `phase-10`, `runtime-mz`, `parallel-safe`

### Files

- Modify: `src/renderer/IRenderer.h`
- Modify: `src/renderer/Renderer2D.h`
- Modify: `src/renderer/Renderer2D.cpp`
- Modify: `src/core/Game.cpp`
- Modify: `src/world/MapScene.h`
- Modify: `src/world/MapScene.cpp`
- Create: `tests/test_render_layer_roles.cpp`
- Modify: `tests/CMakeLists.txt`
- Modify: `docs/GAME_VISUAL_DESIGN.md` if runtime foreground semantics need clarification

### Steps

- [x] Split map rendering into background roles and foreground roles. Background roles are `ground` and `decoration`; foreground role is `foreground`.
- [x] Keep collision and region layers non-rendering in runtime.
- [x] Update `IRenderer` with explicit `renderMapBackground` and `renderMapForeground`, or add a role parameter to `renderMap`.
- [x] Render order must be: background map, below/same entities, foreground map, above entities, HUD/dialogue/menu overlays.
- [x] Use tileset visual assets for foreground the same way ground currently resolves assets.
- [x] Ensure missing foreground layer is handled by validation, not renderer crashes.
- [x] Add tests for layer role detection and no-op foreground rendering when layer exists but is empty.

### Validation

- [x] Run `cmake --build --preset default`.
- [x] Run `ctest --test-dir build --output-on-failure`.
- [x] Run visual smoke if available: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/smoke-runtime.ps1`.
- [x] Expected: tests pass; foreground tiles appear above same-priority entities.

### Acceptance Criteria

- Trees, walls, canopy, and front-layer tiles can occlude the player.
- Renderer still does not own gameplay collision logic.
- Existing screenshots remain visually valid or are intentionally updated.

---

## RT-006 - Add Local Audio V1

Priority: P1
Labels: `mvp`, `phase-10`, `runtime-mz`, `parallel-safe`

### Files

- Create: `src/platform/AudioSystem.h`
- Create: `src/platform/AudioSystem.cpp`
- Modify: `src/core/Application.h`
- Modify: `src/core/Application.cpp`
- Modify: `src/core/Game.h`
- Modify: `src/core/Game.cpp`
- Modify: `src/events/EventRunner.h`
- Modify: `src/events/EventRunner.cpp`
- Modify: `src/types/ProjectTypes.h`
- Modify: `src/database/RpgDatabases.h`
- Modify: `src/database/RpgDatabases.cpp`
- Create: `tests/test_audio_system.cpp`
- Modify: `tests/CMakeLists.txt`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/RPG_SYSTEMS_MATRIX.md`

### Steps

- [x] Document `platform/AudioSystem` as the explicit SDL-isolated exception for audio, matching the AGENTS SDL boundary rule.
- [x] Implement local WAV playback using SDL audio APIs already available through SDL2. Do not add system installs.
- [x] Add a small deterministic audio registry loaded from system data or a new optional audio database path. Minimum IDs: `confirm`, `cancel`, `chest`, `battle`, `town_bgm`.
- [x] Make `playSound` request audio playback through `Game`, not directly from `EventRunner`.
- [x] Add optional BGM start/stop support from `SystemData.defaultBgm` and map properties if present.
- [x] If an audio file is missing, log a warning and continue. Missing optional audio is not fatal.
- [x] Ensure tests can run without an audio device by using a null/mock backend.
- [x] Update docs to mark audio v1 as local, optional, and deterministic.

### Validation

- [x] Run `cmake --build --preset default`.
- [x] Run `ctest --test-dir build --output-on-failure`.
- [x] Run runtime smoke and confirm logs show audio IDs requested.
- [x] Expected: tests pass; missing audio files do not crash.

### Acceptance Criteria

- `playSound` is no longer only a log stub when a local WAV asset exists.
- Runtime remains functional on machines without audio output.
- No AI, network, streaming, or proprietary audio dependency is added.

---

## RT-007 - Add Deterministic Plugin Command V1

Priority: P1
Labels: `mvp`, `phase-10`, `runtime-mz`, `parallel-safe`

### Files

- Modify: `src/types/project.ts`
- Modify: `src/types/EventTypes.h`
- Modify: `src/components/events/CommandEditor.tsx`
- Modify: `src/screens/EventEditorScreen.tsx`
- Modify: `src/validation/validateMap.ts`
- Modify: `src/validation/validateProject.ts`
- Modify: `src/world/MapLoader.cpp`
- Modify: `src/database/RpgDatabases.cpp`
- Modify: `src/events/EventRunner.h`
- Modify: `src/events/EventRunner.cpp`
- Modify: `tests/test_event_runner.cpp`
- Modify: `tests/test_map_loader.cpp`
- Modify: `tests/test_tileset_runtime_data.cpp`
- Modify: `src/validation/__tests__/validateProject.test.ts`
- Modify: `src/components/events/__tests__/CommandStackEditor.test.tsx`

### Steps

- [x] Add event command type `pluginCommand` with fields `pluginId`, `command`, and `args: Record<string, string | number | boolean | null>`.
- [x] Add editor controls for plugin ID, command name, and key/value args.
- [x] Add validation rules: plugin ID and command are non-empty safe identifiers; arg values are scalar only; no nested objects; no code strings are executed.
- [x] Add runtime parser support in map events and common events.
- [x] Add `EventRunner` handling for built-in deterministic commands only: `debug.log`, `debug.setSwitch`, and `debug.setVariable`.
- [x] Unknown plugin commands must log a warning and continue.
- [x] Document this as registry-style deterministic command dispatch, not a scripting/plugin VM.

### Validation

- [x] Run `npm test -- --run src/validation/__tests__/validateProject.test.ts`.
- [x] Run `npm run typecheck`.
- [x] Run `cmake --build --preset default`.
- [x] Run `ctest --test-dir build --output-on-failure`.
- [x] Expected: all pass.

### Acceptance Criteria

- Plugin-command data can round-trip editor to runtime.
- Runtime never executes arbitrary code.
- Unknown commands are non-fatal and visible in logs.

---

## PT-001 - Add Playtest Session Builder For Current Map And Selected Event

Priority: P0
Labels: `mvp`, `phase-10`, `playtest-debug`, `desktop`, `parallel-safe`

### Files

- Create: `src/adapters/PlaytestSessionAdapter.ts`
- Create: `src/adapters/__tests__/PlaytestSessionAdapter.test.ts`
- Modify: `src/adapters/types.ts`
- Modify: `src/adapters/adapterFactory.ts`
- Modify: `src-tauri/src/runtime_commands.rs`
- Modify: `src-tauri/src/fs_commands.rs`
- Modify: `src/screens/PlaytestScreen.tsx`
- Modify: `src/components/layout/TopToolbar.tsx`
- Modify: `docs/RUNTIME_LAUNCH_BRIDGE.md`

### Steps

- [x] Add playtest modes: `projectStart`, `currentMap`, `selectedEvent`.
- [x] Build a temporary playtest project root under the app data directory, not inside the user's source project.
- [x] Copy project data and database shards into the temp root.
- [x] Mutate only the temp `project.json` start map/position/direction for current-map and selected-event modes.
- [x] Launch the runtime with `current_dir` set to the temp root, preserving the no-CLI-args security model.
- [x] Add cleanup policy: keep the latest temp session for debugging, remove older sessions beyond 5.
- [x] Surface mode selection in the playtest toolbar.
- [x] If no event is selected, disable selected-event mode with a clear reason.

### Validation

- [x] Run `npm test -- --run src/adapters/__tests__/PlaytestSessionAdapter.test.ts src/adapters/__tests__/DesktopRuntimeAdapter.test.ts`.
- [x] Run `npm run typecheck`.
- [x] Run `cargo test --manifest-path src-tauri/Cargo.toml`.
- [x] Expected: all pass.

### Acceptance Criteria

- User can playtest from project start, current map, or selected event context.
- Source project files are not modified by playtest launch.
- Runtime launch remains allowlisted and argument-free.

---

## PT-002 - Add Runtime Log Viewer And Bounded Log Reading

Priority: P0
Labels: `mvp`, `phase-10`, `playtest-debug`, `desktop`, `parallel-safe`

### Files

- Modify: `src-tauri/src/runtime_commands.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/adapters/RuntimeLaunchAdapter.ts`
- Modify: `src/adapters/types.ts`
- Modify: `src/screens/PlaytestScreen.tsx`
- Create: `src/components/playtest/RuntimeLogPanel.tsx`
- Create: `src/components/playtest/__tests__/RuntimeLogPanel.test.tsx`
- Modify: `src-tauri/src/runtime_commands.rs` tests if present

### Steps

- [ ] Add Tauri command to return the current/latest runtime log path.
- [ ] Add Tauri command to read the last N bytes of a runtime log, with a hard max of 256 KiB.
- [ ] Extend runtime launch adapter with `getLatestLog()` and `readLatestLogTail(maxBytes)`.
- [ ] Replace static Playtest logs with tabs: `Editor Preview`, `Runtime Log`, `Validation`, `Event Trace`.
- [ ] Poll runtime log tail while runtime is running and stop polling when runtime exits.
- [ ] Add copy-log and open-log-folder buttons.
- [ ] Keep browser mode honest: show unavailable reason and do not fake native logs.

### Validation

- [ ] Run `npm test -- --run src/components/playtest/__tests__/RuntimeLogPanel.test.tsx`.
- [ ] Run `npm run typecheck`.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml`.
- [ ] Expected: all pass.

### Acceptance Criteria

- User can inspect runtime stdout/stderr from inside the editor.
- Log reading is bounded and safe.
- Browser mode does not claim native log access.

---

## PT-003 - Add Event Trace Output

Priority: P1
Labels: `mvp`, `phase-10`, `playtest-debug`, `parallel-safe`

### Files

- Create: `src/events/EventTrace.h`
- Create: `src/events/EventTrace.cpp`
- Modify: `src/events/EventRunner.h`
- Modify: `src/events/EventRunner.cpp`
- Modify: `src/events/EventScheduler.cpp`
- Modify: `src/core/Game.cpp`
- Create: `tests/test_event_trace.cpp`
- Modify: `tests/CMakeLists.txt`
- Modify: `src/screens/PlaytestScreen.tsx`
- Create: `src/components/playtest/EventTracePanel.tsx`

### Steps

- [ ] Define trace event fields: timestamp/frame sequence, source type, map ID, event ID/common event ID, command path, command type, action, and result.
- [ ] Emit trace entries on command start, command finish, wait start, wait finish, branch selected, choice selected, transfer requested, battle requested, shop requested, movement route requested, and error/warning.
- [ ] Write trace to stdout with a stable prefix such as `[TRACE]` so the editor log viewer can parse it.
- [ ] Add an in-memory ring buffer in runtime for tests.
- [ ] Add editor trace parser that extracts trace rows from the runtime log tail.
- [ ] Show trace rows in the Playtest bottom panel with filters for map event, common event, warning, and branch.

### Validation

- [ ] Run `cmake --build --preset default`.
- [ ] Run `ctest --test-dir build --output-on-failure`.
- [ ] Run `npm run typecheck`.
- [ ] Expected: runtime tests pass and trace panel typechecks.

### Acceptance Criteria

- A creator can see which event commands ran and why.
- Trace output is deterministic and testable.
- Trace does not require runtime-editor IPC.

---

## PT-004 - Add Runtime State Snapshot Inspector

Priority: P1
Labels: `mvp`, `phase-10`, `playtest-debug`, `parallel-safe`

### Files

- Create: `src/runtime/RuntimeDebugSnapshot.h`
- Create: `src/runtime/RuntimeDebugSnapshot.cpp`
- Modify: `src/core/Game.h`
- Modify: `src/core/Game.cpp`
- Modify: `src/core/Application.cpp`
- Create: `tests/test_runtime_debug_snapshot.cpp`
- Modify: `tests/CMakeLists.txt`
- Create: `src/components/playtest/RuntimeStatePanel.tsx`
- Modify: `src/screens/PlaytestScreen.tsx`

### Steps

- [ ] Define a JSON debug snapshot with map ID, player position/direction, gold, party IDs, switches, variables, self switches, inventory counts, active dialogue, active menu/shop/battle state, running event IDs, and current frame number.
- [ ] Write the snapshot periodically to the runtime log directory while the runtime is running.
- [ ] Use atomic write: write temp file, then replace.
- [ ] Add a Tauri bounded read command for the latest snapshot file.
- [ ] Add `RuntimeStatePanel` in Playtest screen that shows snapshot data when available.
- [ ] In browser mode, continue showing the existing simulated state inspector and label it as simulated.
- [ ] Add tests for snapshot JSON content and atomic write path formatting.

### Validation

- [ ] Run `cmake --build --preset default`.
- [ ] Run `ctest --test-dir build --output-on-failure`.
- [ ] Run `npm run typecheck`.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml`.
- [ ] Expected: all pass.

### Acceptance Criteria

- Creator can inspect runtime state after launching native runtime.
- Snapshot files are local, bounded, and deterministic.
- No live IPC from runtime to editor is required.

---

## PT-005 - Remove Or Gate Placeholder AI Debug UI

Priority: P0
Labels: `mvp`, `phase-10`, `playtest-debug`, `qa`, `parallel-safe`

### Files

- Modify: `src/components/editor/BottomPanel.tsx`
- Modify: `src/screens/PlaytestScreen.tsx`
- Modify: `src/screens/AIToolsScreen.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/TopToolbar.tsx`
- Modify: `src/App.tsx` if route removal is needed
- Modify: `docs/GOAL_STACK.md`

### Steps

- [ ] Remove clickable AI suggestion cards that imply implemented generation.
- [ ] Remove or disable Playtest `AI Debug Assist` buttons until a real AI/provider phase exists.
- [ ] If the `AI Tools` screen remains visible, label it as a future integration surface and make all actions disabled, or remove it from navigation for MVP.
- [ ] Replace AI debug space in bottom panels with real validation/log/event trace panels.
- [ ] Ensure no visible button says it can generate dialogue, maps, quests, or debug explanations unless it performs a real action.

### Validation

- [ ] Run `npm run typecheck`.
- [ ] Run `npm test -- --run src/stores/__tests__/editorStore.test.ts`.
- [ ] Expected: pass.

### Acceptance Criteria

- MVP UI does not advertise unimplemented AI features.
- Debug surfaces are real: validation, logs, traces, and state.
- This aligns with AGENTS rule to remove placeholder controls.

---

## QA-001 - Expand Bundled Sample To Exercise MVP Features

Priority: P0
Labels: `mvp`, `phase-10`, `qa`, `parallel-safe`

### Files

- Modify: `data/project.json`
- Modify: `data/maps/town.json`
- Modify: `data/maps/house.json`
- Modify: `data/database/*.json`
- Modify: `src/validation/__tests__/bundledSample.test.ts`
- Modify: `tests/test_project_loader.cpp`
- Modify: `tests/test_map_loader.cpp`
- Modify: `docs/MAP_CREATION_WORKFLOW.md`

### Steps

- [ ] Add one event that uses interactive choices with two meaningful branches.
- [ ] Add one event page gated by a self switch.
- [ ] Add one autorun or parallel common event gated by a switch.
- [ ] Add one event-target movement route.
- [ ] Add one foreground occluder area in the map.
- [ ] Add one playSound command using a local optional sound ID.
- [ ] Add one pluginCommand using `debug.log`.
- [ ] Add database entries needed by the sample: items, equipment, states, troop, shop, quest, types, terms, animations.
- [ ] Update bundled sample tests to assert each MVP command/type appears at least once.
- [ ] Keep the sample small and deterministic.

### Validation

- [ ] Run `npm test -- --run src/validation/__tests__/bundledSample.test.ts src/validation/__tests__/validateProject.test.ts`.
- [ ] Run `cmake --build --preset default`.
- [ ] Run `ctest --test-dir build --output-on-failure`.
- [ ] Expected: all pass.

### Acceptance Criteria

- The sample project demonstrates the MVP without manual JSON edits.
- Runtime smoke can traverse the sample without broken references.
- Sample data remains legally original and project-owned.

---

## QA-002 - Add Editor Runtime Roundtrip For MVP Playtest Modes

Priority: P0
Labels: `mvp`, `phase-10`, `qa`, `desktop`, `integration-gate`

### Files

- Modify: `src/e2e/__tests__/editorRoundtrip.test.ts`
- Modify: `scripts/dev/verify-editor-runtime-roundtrip.ps1`
- Modify: `scripts/dev/verify-editor-runtime-roundtrip.bat`
- Modify: `docs/EDITOR_RUNTIME_E2E_QA.md`
- Modify: `docs/VALIDATION_LOG.md`

### Steps

- [ ] Extend editor roundtrip test to edit a database entry, edit a common event command, save, reload, and validate.
- [ ] Add test coverage for playtest session generation in project-start, current-map, and selected-event modes.
- [ ] Update PowerShell script to run frontend tests, Tauri content check, C++ build/tests, and a runtime launch smoke if executable exists.
- [ ] Ensure script exits non-zero on any failed gate.
- [ ] Add a `.bat` equivalent for restricted PowerShell execution policies.
- [ ] Document exact expected output sections.

### Validation

- [ ] Run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify-editor-runtime-roundtrip.ps1`.
- [ ] Expected: all gates pass or missing runtime executable is reported honestly as a documented skip only if build was not requested.

### Acceptance Criteria

- One command proves editor save data can be consumed by runtime.
- Script is usable by future agents without manual steps.
- Failures are actionable.

---

## QA-003 - Add Runtime Smoke Coverage For Choices, Movement, Audio, And Foreground

Priority: P0
Labels: `mvp`, `phase-10`, `qa`, `runtime-mz`, `integration-gate`

### Files

- Modify: `scripts/dev/smoke-runtime.ps1`
- Modify: `scripts/dev/smoke-runtime.bat`
- Modify: `scripts/dev/capture-tauri-window.ps1` if screenshot capture needs updates
- Modify: `docs/GAME_VISUAL_QA.md`
- Modify: `docs/VALIDATION_LOG.md`

### Steps

- [ ] Extend native smoke input script to cover a choice selection.
- [ ] Traverse an event route that moves an NPC or object.
- [ ] Capture a scene where foreground occludes the player.
- [ ] Trigger a playSound command and assert a log line or successful audio request.
- [ ] Trigger pluginCommand `debug.log` and assert trace/log output.
- [ ] Save screenshots under a new phase folder: `docs/screenshots/phase10-mvp/`.
- [ ] Keep smoke deterministic and bounded. No manual key presses.

### Validation

- [ ] Run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/smoke-runtime.ps1`.
- [ ] Expected: smoke completes, screenshots are generated, and logs include expected markers.

### Acceptance Criteria

- MVP runtime features are proven by an automated smoke path.
- Screenshots demonstrate visual correctness under `docs/GAME_VISUAL_DESIGN.md`.
- Logs are real, not fabricated.

---

## QA-004 - Full Verification Script For MVP Green Gate

Priority: P0
Labels: `mvp`, `phase-10`, `qa`, `integration-gate`

### Files

- Modify: `scripts/dev/verify.ps1`
- Modify: `scripts/dev/verify.bat`
- Modify: `scripts/dev/test.ps1`
- Modify: `scripts/dev/build.ps1`
- Modify: `package.json` if script aliases need alignment
- Modify: `docs/BUILD_AND_RUN.md`
- Modify: `docs/WINDOWS_BUILD_NOTES.md`

### Steps

- [ ] Ensure `scripts/dev/verify.ps1` runs frontend typecheck, Vitest, frontend build, C++ configure, C++ build, C++ tests, cargo tests, Tauri content verification, runtime smoke, and editor-runtime roundtrip.
- [ ] Add flags: `-SkipSmoke`, `-SkipDesktop`, `-SkipFrontend`, `-SkipRuntime` for targeted debugging.
- [ ] Default behavior must run all gates when dependencies exist.
- [ ] Each gate must print a clear header and final pass/fail.
- [ ] `.bat` wrapper must call PowerShell with `-ExecutionPolicy Bypass`.
- [ ] Update docs with exact commands users and agents should run.

### Validation

- [ ] Run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1`.
- [ ] Expected: all gates pass before MVP is declared complete.

### Acceptance Criteria

- Future agents have one canonical validation command.
- The script never hides failures.
- The script does not rely on manual command flags for CMake policy compatibility.

---

## INT-001 - Integrate Database V2 Branches

Priority: P0
Labels: `mvp`, `phase-10`, `database-v2`, `integration-gate`

### Files

- Resolve conflicts across DB issues.
- Modify docs and tests only as needed.

### Steps

- [ ] Merge/rebase `DB-001` first.
- [ ] Merge/rebase `DB-002`.
- [ ] Rebase and merge `DB-003` through `DB-009` one at a time.
- [ ] After each merge, run the focused validation listed by that issue.
- [ ] After all DB issues merge, run full frontend validation.
- [ ] Update `docs/RPG_SYSTEMS_MATRIX.md` database rows only after tests pass.
- [ ] Update `.kiro/specs/phase10-professional-mz-editor/tasks.md` Slice 4 checkboxes.

### Validation

- [ ] Run `npm run typecheck`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml`.
- [ ] Expected: all pass.

### Acceptance Criteria

- Database V2 works as one coherent feature.
- No duplicate components or abandoned generic editors remain.
- Slice 4 can be marked complete.

---

## INT-002 - Integrate Runtime MZ Foundation Branches

Priority: P0
Labels: `mvp`, `phase-10`, `runtime-mz`, `integration-gate`

### Files

- Resolve conflicts across runtime issues.
- Modify docs and tests only as needed.

### Steps

- [ ] Merge/rebase `RT-001` first.
- [ ] Merge/rebase `RT-002` through `RT-007` one at a time.
- [ ] After each merge, run `cmake --build --preset default` and `ctest --test-dir build --output-on-failure`.
- [ ] Verify renderer ordering after both Y-sort and foreground branches are merged.
- [ ] Verify audio and plugin-command do not add nondeterministic runtime dependencies.
- [ ] Update `docs/EVENT_SYSTEM.md`, `docs/RUNTIME_CONTROLS.md`, and `docs/RPG_SYSTEMS_MATRIX.md`.
- [ ] Update `.kiro/specs/phase10-professional-mz-editor/tasks.md` Slice 5 checkboxes.

### Validation

- [ ] Run `cmake --preset default`.
- [ ] Run `cmake --build --preset default`.
- [ ] Run `ctest --test-dir build --output-on-failure`.
- [ ] Run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/smoke-runtime.ps1`.
- [ ] Expected: all pass.

### Acceptance Criteria

- Runtime supports all MVP MZ-foundation features together.
- Native smoke passes with real logs and screenshots.
- Slice 5 can be marked complete.

---

## INT-003 - Integrate Playtest And Debug Tooling Branches

Priority: P0
Labels: `mvp`, `phase-10`, `playtest-debug`, `desktop`, `integration-gate`

### Files

- Resolve conflicts across PT issues.
- Modify docs and tests only as needed.

### Steps

- [ ] Merge/rebase `PT-001` first.
- [ ] Merge/rebase `PT-002`, `PT-003`, `PT-004`, and `PT-005`.
- [ ] Ensure Playtest screen has no placeholder AI actions.
- [ ] Verify project-start/current-map/selected-event modes in browser and desktop contexts.
- [ ] Verify runtime log, event trace, and state panels degrade honestly in browser mode.
- [ ] Update `docs/RUNTIME_LAUNCH_BRIDGE.md`, `docs/EDITOR_RUNTIME_E2E_QA.md`, and `docs/GOAL_STACK.md`.
- [ ] Update `.kiro/specs/phase10-professional-mz-editor/tasks.md` Slice 6 checkboxes.

### Validation

- [ ] Run `npm run typecheck`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml`.
- [ ] Run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify-tauri-content.ps1`.
- [ ] Expected: all pass.

### Acceptance Criteria

- Playtest/debug tools are real and usable.
- Browser mode remains honest about native limitations.
- Slice 6 can be marked complete.

---

## INT-004 - MVP Documentation And User Workflow Closeout

Priority: P1
Labels: `mvp`, `phase-10`, `docs`, `qa`, `integration-gate`

### Files

- Modify: `README.md`
- Modify: `docs/BUILD_AND_RUN.md`
- Modify: `docs/MAP_CREATION_WORKFLOW.md`
- Modify: `docs/EDITOR_ARCHITECTURE.md`
- Modify: `docs/DESKTOP_SHELL_ARCHITECTURE.md`
- Modify: `docs/RUNTIME_BRIDGE.md`
- Modify: `docs/RUNTIME_LAUNCH_BRIDGE.md`
- Modify: `docs/GAME_VISUAL_DESIGN.md`
- Modify: `docs/GAME_VISUAL_QA.md`
- Modify: `docs/GOAL_STACK.md`
- Modify: `docs/RPG_SYSTEMS_MATRIX.md`

### Steps

- [ ] Update README with current MVP capabilities and exact run commands.
- [ ] Document editor workflow: open project, edit map, edit event, edit database, validate, save, playtest, launch runtime.
- [ ] Document runtime controls including choices, menu, save/load, shop, battle summary, and debug keys if any.
- [ ] Document playtest modes and temp project behavior.
- [ ] Document validation behavior and where errors appear.
- [ ] Document known limitations honestly: no general scripting, no AI runtime layer, no cloud, no marketplace, no proprietary format import.
- [ ] Ensure all docs match actual command names in `package.json` and `scripts/dev`.

### Validation

- [ ] Run `git diff --check`.
- [ ] Run `npm run typecheck` to catch doc-linked imports only if docs changed code examples in TS files.
- [ ] Expected: no whitespace errors; typecheck passes if run.

### Acceptance Criteria

- A new user can build, run, edit, save, and playtest without asking for missing commands.
- Docs describe reality, not future intent.
- Known limitations are explicit.

---

## INT-005 - Final MVP Green Gate, Commit, Push, And Report

Priority: P0
Labels: `mvp`, `phase-10`, `qa`, `integration-gate`

### Files

- Modify: `docs/VALIDATION_LOG.md`
- Modify: `docs/GOAL_STACK.md`
- Modify: `.kiro/specs/phase10-professional-mz-editor/tasks.md`
- Create or modify final report under `docs/PHASE_10_MVP_VALIDATION_REPORT.md`

### Steps

- [ ] Run `git status --short` and confirm no generated binaries, `.env`, build output, secrets, or unrelated user files are staged.
- [ ] Run full verification: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1`.
- [ ] Run runtime smoke separately if full verify skipped it for any reason.
- [ ] Run editor-runtime roundtrip separately if full verify skipped it for any reason.
- [ ] Capture final editor and runtime screenshots under `docs/screenshots/phase10-mvp/`.
- [ ] Append exact validation commands and pass/fail results to `docs/VALIDATION_LOG.md`.
- [ ] Update `GOAL_STACK.md` to mark Phase 10 MVP closeout done only after validation passes.
- [ ] Write final validation report with implemented features, commands run, runtime smoke result, files changed summary, commit hash, push result, known limitations, and recommended next phase.
- [ ] Commit only after configure/build/tests/smoke are green or an explicitly documented non-code/docs-only exception applies.
- [ ] Push to `origin/main` only after confirming remote origin is the expected repo.

### Validation

- [ ] Run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1`.
- [ ] Run `git status --short`.
- [ ] Expected: validation passes; working tree is clean after commit.

### Acceptance Criteria

- MVP can be honestly reported as usable.
- Final report includes exact logs and commit hash.
- Code is pushed only if green.
