# Design — Phase 10 Professional MZ-style Editor

## Slice 1 Architecture

- `ProjectData.maps` remains the authoritative persisted map list, extended
  with tree metadata. Runtime loaders may ignore this metadata.
- `MapData` remains the authored scene data, extended with professional map
  properties and layer metadata. Existing maps remain backward compatible.
- `projectReducer` owns map CRUD and tree changes so undo/redo, dirty state,
  and validation behavior stay consistent with existing editor workflows.
- `MapTreePanel` is a left-column editor surface above the tile palette. It
  selects maps through `editorStore` and mutates project data through
  `projectStore`.
- Desktop shell Rust schema mirrors optional map-reference metadata so saving
  through Tauri does not drop tree state.

## Data Compatibility

Old projects that only have `id` and `path` map references still load. Missing
tree metadata is interpreted as root-level, order zero, expanded. Old maps that
lack professional properties still load because all new fields are optional.

## Validation

Editor validation checks project map references before command validation. Map
data that is loaded but not referenced is a warning, not a hard failure, so
manual repair remains possible.

## Slice 2 Architecture

- `data/database/tilesets.json` is the first project-owned tileset database.
  It describes authored tile groups, tile ids, asset keys, passability,
  directional passability, terrain tags, ladder/bush/counter/damage flags,
  and visual priority without adopting RPG Maker proprietary formats.
- `tileCatalog` resolves editor/runtime-preview tile assets from tileset data
  instead of hardcoded tile lists. Unknown visual tiles intentionally fall
  back to the existing void warning asset.
- `MapData.layers` is now treated as a professional authoring stack:
  `ground`, `decoration`, `foreground`, `collision`, and `region`. Visibility
  affects rendering overlays, and `locked` prevents reducer paint mutations.
- `TilePalette` selects concrete authoring layers and exposes layer visibility
  and lock controls. Region brushes write region ids to the region layer;
  collision brushes remain explicit collision authoring.
- `MapCanvas` renders visible visual layers in stack order, shows tileset
  passability metadata while the passability layer is active, and shows region
  ids while the region layer is active.
- The C++ runtime schema now parses map `displayName`, `tilesetId`, layer
  `role`/`visible`/`locked`, and the optional project `database.tilesets`
  shard. Runtime database loading exposes tileset lookup for later validator
  and renderer work.

## Slice 2 Validation

TypeScript tests cover data-driven tileset resolution, layer selection, locked
paint refusal, layer metadata undo, region painting, missing layer validation,
unknown tileset references, and invalid region ids. C++ tests cover project
tileset database paths, map tileset/layer metadata parsing, and runtime
tileset database loading.

## Slice 3A Architecture

- `GameEvent.pages?: EventPage[]` is additive. Legacy events with only
  top-level `trigger` and `commands` are normalized in the editor to a single
  `page_1` and remain valid on disk.
- Page 1 mirrors back to the legacy projection (`trigger`, `commands`, sprite,
  animation set, display height, and solid-ish priority) so existing runtime
  paths keep working while deeper page-resolution runtime work is staged.
- Event pages carry `conditions`, `graphic`, `movement`, `options`, `priority`,
  `trigger`, and `commands`. Self switch conditions use letters `A-D`.
- The event editor screen now has page tabs, page reordering, page-scoped
  command stacks, page priority/trigger controls, and self-switch condition
  toggles.
- Command tree path editing now supports conditionals, choices, and battle
  victory/defeat branches consistently.
- C++ runtime data now stores self switches in `GameState`, saves/loads them
  through `SaveManager`, and parses both legacy flat events and paged events
  through `MapLoader`.

## Slice 3B Runtime Activation

- `EventPageEvaluator` resolves the active page by scanning pages from last
  to first and requiring every switch, variable, and self-switch condition to
  match.
- Legacy flat events remain active without pages. Paged events with no active
  page expose no trigger or commands, are skipped by event rendering, and do
  not override collision tiles.
- `Game` uses the active page for interact/touch triggers, command list
  execution, render graphic/animation metadata, collision priority, and
  `through`.
- `EventRunner` now executes `controlSelfSwitch` and `ifSelfSwitch` against
  the map/event owner captured when the command list starts, so transfers do
  not retarget the self-switch scope mid-list.

## Slice 3B Deferred Work

The autorun/parallel scheduler is intentionally not implemented in this cut.
It needs separate runner contexts so parallel events do not overwrite the
interactive `EventRunner` stack. Slice 3C should add deterministic map and
common-event scheduling plus command-stack polish.
