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

## Next Slices

- [ ] Slice 2: data-driven tilesets and layer authoring.
- [ ] Slice 3: event pages, self switches, and scheduler.
- [ ] Slice 4: database v2 editors.
- [ ] Slice 5: runtime MZ foundation validator and interaction upgrades.
- [ ] Slice 6: playtest/debug programmer tools.
