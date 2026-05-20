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
