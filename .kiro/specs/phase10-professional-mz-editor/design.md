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

## Slice 3C Scheduler Architecture

- `EventScheduler` owns independent `EventRunner` instances for scheduled
  map events and common events, so autorun/parallel execution no longer
  overwrites the interactive runner used by interact/touch events.
- `Game` rebuilds scheduled candidates from the active map each frame after
  active-page selection. Map candidates use the active page trigger and command
  list; common-event candidates require `trigger` to be `autorun` or `parallel`
  and require their condition switch to be ON.
- Autorun runners block player input while running. Parallel runners do not
  block for waits, but global modal effects they open (dialogue, shop, battle
  summary, map transfer) still take normal gameplay focus.
- Scheduled runners receive the same common-event, quest, and battle resolvers
  as the interactive runner. Common-event command parsing now mirrors
  self-switch and animation commands used by map events.
- When a scheduled runner requests `transferMap`, the scheduler preserves that
  runner as detached until its remaining command queue completes, then syncs
  against the new map on subsequent frames. Other scheduled runners are
  discarded deterministically at the map transition boundary.

## Slice 3D Command Stack V1

- `projectReducer` now has command-list operations for insert, move, and
  duplicate, with legacy event actions mirrored back through page 1 and
  page-scoped actions applied through `replacePage()`.
- Command insertion accepts command paths and branch-list paths. A path like
  `[]` appends to the root list; `[0]` inserts around command 0; `[0, 1]`
  appends into command 0 branch 1. The existing path shape remains compatible
  with conditionals, choices, and battle branches.
- `EventEditorScreen` renders branch target rows for Then, Else, choice
  labels, Victory, and Defeat, including empty branches. Selecting a branch
  target and adding or pasting a command inserts into that branch instead of
  forcing authors to create data indirectly.
- The command-stack toolbar exposes move up/down, duplicate, cut, copy, paste,
  and delete for the selected command. Clipboard state is intentionally local
  to the command stack; persisted project state remains data-only.
- Range selection/delete is handled with command-row checkboxes and
  shift-click over command rows only. Branch target rows remain insertion
  targets and are never included in range payloads.
- Range deletion is a reducer-level batch operation. `REMOVE_COMMAND_RANGE`
  and `REMOVE_PAGE_COMMAND_RANGE` delete an inclusive range only when both
  endpoints share the same command-list parent path, then preserve page-1
  legacy mirroring. Endpoints across different branches no-op instead of
  trying to infer cross-branch order.

## Slice 3D Movement Route Basics

- `EventCommand` now includes `setMovementRoute` with `target`, optional
  `eventId`, `repeat`, `skippable`, `wait`, and ordered route `steps`.
  Supported route steps are `moveUp`, `moveDown`, `moveLeft`, `moveRight`,
  `turnUp`, `turnDown`, `turnLeft`, `turnRight`, and route-local `wait`.
- The event command editor exposes a focused route-step editor with target
  selection, repeat/skippable/wait flags, ordered step editing, and add/remove
  controls. Route commands live inside the normal command stack and use the
  existing page-command update path, so page 1 still mirrors to legacy
  `event.commands`.
- TypeScript map/project validation accepts `setMovementRoute`, checks named
  event targets, validates route step names, and rejects negative/non-finite
  route wait durations.
- C++ `MapLoader` and `RpgDatabases` parse the same command shape for map
  events and common events. `EventRunner` emits a `MovementRouteRequest`
  rather than owning world movement.
- `Game` consumes player-target movement routes deterministically by applying
  move/turn steps through existing collision and facing rules. Route movement
  reuses touch-event dispatch at destination tiles, and `wait: true` blocks
  the issuing runner by the route's move-step duration plus explicit route
  waits before continuing to following commands.
- Malformed route data is handled as validation errors instead of throwing:
  target values must be supported, `steps` must be an array, step names must
  be known, and wait durations must be non-negative finite numbers.
- Event-target movement and repeat-loop playback are logged as unsupported
  runtime extensions for a later foundation slice.
