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
