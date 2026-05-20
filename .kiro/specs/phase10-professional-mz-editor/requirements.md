# Requirements — Phase 10 Professional MZ-style Editor

## Goal

Adapt RPGCreatorAI into a professional RPG Maker MZ-style creation workflow
without copying proprietary assets, formats, or runtime dependencies.

## Functional Requirements

1. The editor shall expose a persistent map tree backed by project data.
   Map references shall support `parentId`, `order`, and `expanded`.
2. The editor shall support create, duplicate, delete, rename, reorder, and
   child-map operations without corrupting existing maps.
3. Maps shall support professional properties: display name, tileset id,
   scroll type, battleback, encounter step count, encounter list, parallax,
   and layer role/visibility/lock metadata.
4. Tilesets shall be loaded from project/database data, with authored groups,
   tile metadata, passability, terrain tags, flags, and visual priority.
5. Newly created maps shall include authoring layers for ground, decoration,
   foreground, collision, and region.
6. The map editor shall support selecting visible authoring layers, locking
   layers against paint edits, region painting, and passability overlays.
7. Project validation shall detect duplicate map references, missing map data,
   missing parents, cyclic parent chains, and orphan loaded maps.
8. Map validation shall detect missing required authoring layers, unknown
   tileset references, unsupported visual/collision tiles, and invalid region
   ids.
9. Runtime loaders shall parse map tileset ids, display names, layer metadata,
   and database tilesets.
10. Desktop persistence shall round-trip map-tree metadata and tileset database
   shards.
11. Toolbar and inspector buttons that imply unimplemented workflows shall be
   removed or disabled until real behavior exists.

## Non-Goals

- No RPG Maker proprietary file formats or assets.
- No general scripting/plugin execution in this slice.
- No AI runtime dependency.
- No autotile rules in Slice 2.
