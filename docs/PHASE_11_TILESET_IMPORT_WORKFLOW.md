# Phase 11 Tileset Import Workflow

Issue: CP-053 / FRA-88
Date: 2026-06-02

## Result

RPGCreatorAI now supports local tileset image import from the Tilesets
database editor. Imported tilesets become project-owned catalog entries and
linked tileset database records with generated tile metadata for map
authoring.

The workflow stays local and deterministic:

- only desktop mode can open a local file picker
- browser mode reports import as unavailable instead of pretending it can read
  local files
- imported files are copied into the opened project
- source files outside the project are never modified
- the native runtime continues to consume project map/tileset data only and
  has no AI, network, cloud, or provider dependency

## Import Policy

Allowed v1 tileset image formats:

- `.png`
- `.jpg`
- `.jpeg`
- `.bmp`
- `.webp`

Desktop copies go under:

```text
assets/imported/tilesets/
```

Existing project files are never overwritten. Duplicate filenames receive a
numeric suffix, and duplicate asset ids receive a unique `_2`, `_3`, ...
suffix.

## Metadata Workflow

The Tilesets database exposes a metadata-first import panel before opening the
file picker:

- tileset database id
- display name
- tile size
- columns
- visual tile count
- default passability
- foreground start tile
- region marker count

The preview shows the configured tile grid and foreground split before use.
Accepting the import creates:

- a catalog entry with `kind: "tileset"` and `source: "imported"`
- a copied project-relative image path under `assets/imported/tilesets/`
- A-group ground tile rows
- B-group foreground tile rows when a foreground start tile is set
- optional Region metadata rows starting at id `1000`
- a Collision metadata row at id `2000`

The imported tileset is immediately selectable from map properties because it
is added to the same tileset database used by maps.

## Validation Behavior

Project validation now accepts tile metadata assets when the asset id points to
a catalog entry with `kind: "tileset"`. Generated static tile asset keys remain
valid.

Map visual-layer validation uses the active project tileset database when the
map references a known tileset id. That allows imported tile ids while still
rejecting unsupported ids and excluding Region/Collision metadata rows from
visual layers.

## Failure States

The UI reports:

- desktop import unavailable in browser mode
- no desktop project root opened
- unsupported source extensions
- invalid non-file sources
- invalid tile size, column count, tile count, foreground start, or region
  marker metadata
- copy or path errors returned by the desktop command

Canceling the file dialog is a no-op and does not dirty the project.

## Evidence

- Focused frontend and adapter tests:
  - `src/components/database/__tests__/TilesetEditor.test.tsx`
  - `src/adapters/__tests__/tilesetImport.test.ts`
- Project validation tests:
  - `src/validation/__tests__/validateProject.test.ts`
- Desktop import helper tests:
  - `src-tauri/src/fs_commands.rs`
- Browser smoke screenshot:
  - `docs/screenshots/phase11-cp053/tileset-import-browser-unavailable.png`

## Known Limits

CP-053 does not inspect actual source image dimensions, slice per-tile preview
bitmaps, transcode images, or change native runtime asset loading. Width and
height metadata are derived from tile size, columns, and tile count for
catalog display. Runtime loading remains data-driven from the authored tileset
database and map layers.
