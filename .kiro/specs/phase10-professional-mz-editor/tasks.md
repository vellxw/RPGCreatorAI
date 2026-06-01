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
- [ ] Slice 4C: extract reusable Database V2 editor framework.
- [ ] Slice 4D: dedicated Items, Types, Terms, Tilesets, and Animations
  editors.
- [ ] Slice 4E: richer Weapons, Armors, States, and Common Events editors
  with complete command editing for common events.

## Next Slices

- [ ] Slice 5: runtime MZ foundation validator and interaction upgrades.
- [ ] Slice 6: playtest/debug programmer tools.
