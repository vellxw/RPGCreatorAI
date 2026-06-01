# Tasks — Phase 10 Professional MZ-style Editor

## Slice 1 — Editor Shell Professional

- [x] Gate 0: classify and validate the pre-existing Phase 9 hotfix baseline.
- [x] Extend `MapReference` with `parentId`, `order`, and `expanded`.
- [x] Extend `MapData` with professional map properties and layer metadata.
- [x] Add reducer actions for map properties, create, duplicate, remove,
  reference update, and move.
- [x] Add map tree UI with create, duplicate, delete, rename, reorder,
  child-map, select, and expand/collapse operations.
- [x] Add map properties controls for name, display name, tileset, scroll,
  size, viewport preset, encounter steps, battleback, and start map.
- [x] Remove placeholder AI/debug/event-page controls until implemented.
- [x] Add TypeScript reducer and validator tests.
- [x] Add Rust desktop round-trip support for map-tree metadata.

## Slice 2 — Data-driven Tilesets and Layer Authoring

- [x] Add `data/database/tilesets.json` with project-owned sample tilesets and
  metadata.
- [x] Extend TypeScript project/database types for tilesets and tile metadata.
- [x] Replace hardcoded visual tile catalog lookups with data-driven tileset
  helpers.
- [x] Add layer selection for ground, decoration, foreground, collision,
  region, and event authoring.
- [x] Add layer visibility and lock controls to the tile palette.
- [x] Prevent reducer paint operations from mutating locked layers.
- [x] Add region brush support and region overlay rendering.
- [x] Add passability overlay rendering from tileset metadata.
- [x] Validate unknown tilesets, missing required authoring layers, unsupported
  visual/collision tiles, and invalid region ids.
- [x] Extend Tauri persistence and C++ runtime loaders for tileset database
  paths, map tileset ids, display names, and layer metadata.
- [x] Add focused TypeScript and C++ tests.

## Slice 3 — Event Pages, Self Switches, and Scheduler

- [x] Slice 3A: add TypeScript event page model while preserving legacy flat
  events.
- [x] Slice 3A: normalize legacy commands into `page_1` in the project store.
- [x] Slice 3A: add reducer actions for add/update/remove/reorder page and
  page-scoped command editing.
- [x] Slice 3A: support command path editing inside conditionals, choices, and
  battle branches.
- [x] Slice 3A: add event editor page tabs, page settings, priority, trigger,
  and self-switch condition controls.
- [x] Slice 3A: validate page triggers, priorities, self-switch conditions, and
  page command references.
- [x] Slice 3A: add C++ self-switch state and save/load round-trip.
- [x] Slice 3A: parse legacy flat events and paged events in the C++ map
  loader.
- [x] Slice 3B: active-page runtime selection by switch/variable/self-switch
  conditions.
- [x] Slice 3B: `controlSelfSwitch` and `ifSelfSwitch` execution in
  `EventRunner`.
- [x] Slice 3B: use the active page for interact/touch triggers, command
  lists, render graphics, event collision priority, and `through`.
- [x] Slice 3C: deterministic autorun/parallel map and common-event scheduler.

## Slice 4 — Database V2

- [x] Slice 3D: command-stack v1 polish with insert, move, duplicate,
  cut/copy/paste, and empty-branch insertion targets.
- [x] Slice 3D: movement-route basics with editor command data, validation,
  C++ parsing, `EventRunner` requests, and player-target runtime execution.
- [x] Slice 3D: command-stack range selection/delete.
- [x] Slice 4A: separated weapons, armors, and states database foundation
  with seed data, adapter persistence, duplicate-id validation, editor CRUD
  tabs, and legacy equipment migration from `items`.
- [x] Slice 4B: add `types` and `terms` database shards with deterministic
  starter data, TypeScript schema, browser import/export round-trip, Tauri
  save/load round-trip, C++ optional path parsing, and editor validation for
  duplicate/unnamed type entries, required equipment slots, and required
  term labels.
- [x] FRA-6 / DB-001: extract reusable Database V2 editor framework
  (`DatabaseLayout`, `DatabaseList`, field helpers, reference select, array
  editor) while preserving current CRUD behavior.
- [x] FRA-7 / DB-002: add and validate project-owned `types` and `terms`
  database shards. Existing implementation should be verified before marking
  Linear Done.
- [x] FRA-8 / DB-003: build a dedicated tileset database editor with tile
  metadata, asset swatches, validation, and map reference errors.
- [x] FRA-9 / DB-004: build item, weapon, armor, and state V2 editors with
  domain fields, type references, numeric validation, and compatibility with
  separated equipment shards.
- [x] FRA-10 / DB-005: build actor, class, skill, enemy, and troop V2 editors
  with battle authoring fields, reference validation, and runtime test
  coverage.
- [x] FRA-11 / DB-006: build quest, shop, switches, variables, and system V2
  editors with reference usage warnings and system-default validation.
- [x] FRA-12 / DB-007: extract and reuse the command-stack editor for common
  event command editing with undo-safe reducer behavior.
- [x] FRA-13 / DB-008: build the animation database V2 editor with a real
  sprite-sheet preview and animation validation.
- [x] FRA-14 / DB-009: add database delete/rename reference safety across
  project data and editor workflows.

## Slice 5 — Runtime MZ Foundation

- [x] FRA-15 / RT-001: add a native runtime project validator seam that fails
  malformed projects before startup with actionable errors.
- [x] FRA-16 / RT-002: implement visible, selectable runtime choices and branch
  continuation instead of default-first-choice behavior.
- [x] FRA-17 / RT-003: implement event-target movement routes with runtime
  event positions separate from authored map JSON.
- [x] FRA-18 / RT-004: implement event priority, Y-sort ordering, and
  above/below rendering behavior.
- [x] FRA-19 / RT-005: render the foreground layer as player/event occlusion
  without giving the renderer gameplay ownership.
- [x] FRA-20 / RT-006: add local audio v1 for project-owned BGM/SFX data with
  deterministic skips when audio is unavailable.
- [x] FRA-21 / RT-007: add deterministic plugin command v1 through allowlisted
  commands such as `debug.log`, without adding a scripting VM.

## Slice 6 — Playtest And Debug Programmer Tools

- [x] FRA-22 / PT-001: add playtest session building for project-start,
  current-map, and selected-event modes without mutating source files.
- [x] FRA-23 / PT-002: add a runtime log viewer with bounded native log
  reading and honest browser-mode degradation.
- [x] FRA-24 / PT-003: add deterministic event trace output and an editor trace
  panel parsed from runtime logs.
- [x] FRA-25 / PT-004: add a runtime state snapshot inspector backed by local,
  bounded, atomically written snapshot files.
- [x] FRA-26 / PT-005: remove or gate placeholder AI/debug UI so visible MVP
  actions are real local actions.

## Integration QA — MVP Green Gate

- [x] FRA-5 / MVP-000: lock MVP scope and Linear tracking metadata in docs.
- [x] FRA-27 / QA-001: expand the bundled sample to exercise MVP features and
  validate the sample references.
- [x] FRA-28 / QA-002: add editor-runtime roundtrip coverage for MVP playtest
  modes.
- [x] FRA-29 / QA-003: add runtime smoke coverage for choices, movement,
  audio, foreground occlusion, and plugin-command logs.
- [x] FRA-30 / QA-004: create the full verification script for the MVP green
  gate with targeted skip flags.
- [x] FRA-31 / INT-001: integrate Database V2 branches and run full frontend
  validation.
- [x] FRA-32 / INT-002: integrate Runtime MZ foundation branches and run C++
  validation plus runtime smoke.
- [x] FRA-33 / INT-003: integrate playtest/debug tooling and validate browser
  and desktop degradation paths.
- [x] FRA-34 / INT-004: close MVP documentation and user workflow docs against
  actual command names and behavior.
- [ ] FRA-35 / INT-005: run the final MVP green gate, commit, push, and write
  the Phase 10 MVP validation report.
