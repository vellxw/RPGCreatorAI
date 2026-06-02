# Phase 11 Spritesheet Import Workflow

Issue: CP-051 / FRA-86
Date: 2026-06-02

## Result

RPGCreatorAI now supports spritesheet import as an editor-only workflow that
connects project-owned assets to animation database entries without hand
editing animation JSON.

The workflow remains local and deterministic:

- desktop import copies a selected spritesheet into the project
- metadata is accepted before the file picker opens
- the asset catalog receives a `spritesheet` entry
- the animation database receives a new animation set with one clip pointing
  at the imported asset
- the native runtime still does not depend on AI, providers, network, or cloud

## Import Policy

Spritesheet imports use the same allowed image extensions as image import:

- `.png`
- `.jpg`
- `.jpeg`
- `.bmp`
- `.webp`

Desktop copies go under:

```text
assets/imported/spritesheets/
```

Existing project files are never overwritten. Duplicate filenames receive a
numeric suffix, and duplicate asset ids receive a unique `_2`, `_3`, ...
suffix.

## Metadata

The import panel captures:

- animation set id
- spritesheet asset name
- action
- direction
- frame width
- frame height
- frame count
- FPS
- loop flag
- anchor X/Y
- display height/width/y-offset

The panel renders a metadata preview before accepting. Invalid metadata blocks
the desktop file picker and reports the first actionable error.

## Catalog And Animation Link

Successful desktop import creates an asset catalog entry with:

- `kind: "spritesheet"`
- `source: "imported"`
- project-relative path under `assets/imported/spritesheets/`
- frame width, frame height, and frame count metadata
- `imported` and `spritesheet` tags

The animation database then receives a new set whose first clip references the
imported asset id and uses the accepted action, direction, frame, FPS, loop,
anchor, and display metadata.

## Validation

TypeScript validation now accepts animation clips that reference catalog
entries with `kind: "spritesheet"`. It still rejects clips that reference
non-spritesheet catalog entries.

When a clip references a catalog spritesheet, validation also checks that clip
frame width/height match the asset metadata and that clip frame count does not
exceed the asset frame count.

## Evidence

- Focused frontend tests:
  - `src/components/database/__tests__/AnimationsEditor.test.tsx`
  - `src/components/database/__tests__/AnimationPreview.test.tsx`
  - `src/validation/__tests__/validateDatabases.test.ts`
- Desktop import helper test:
  - `src-tauri/src/fs_commands.rs`
- Browser smoke screenshot:
  - `docs/screenshots/phase11-cp051/spritesheet-import-browser-unavailable.png`

## Known Limits

CP-051 imports and links one spritesheet clip per accepted import. It does not
auto-detect image dimensions, split multi-row directional sheets, generate
spritesheets, or change native runtime asset loading. Those remain later asset
pipeline/runtime export depth.
