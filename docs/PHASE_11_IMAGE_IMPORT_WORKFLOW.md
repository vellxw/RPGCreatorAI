# Phase 11 Image Import Workflow

Issue: CP-050 / FRA-85
Date: 2026-06-02

## Result

RPGCreatorAI now has a safe desktop image import workflow for project-owned
asset catalog entries.

The workflow stays inside the editor/tooling layer:

- The native runtime does not read the asset catalog.
- Importing does not call AI providers, network services, or cloud APIs.
- Imported files are copied into the opened project and then referenced by
  catalog metadata.
- Browser mode exposes an honest unavailable state instead of attempting local
  filesystem access.

## Import Policy

Allowed extensions are:

- `.png`
- `.jpg`
- `.jpeg`
- `.bmp`
- `.webp`

Desktop import uses a native file dialog constrained to those image types.
The pure import helper also rejects unsupported extensions with a clear error.

Imported images are copied under:

```text
assets/imported/images/
```

Destination paths are project-relative and are built through the same safe
path helpers used by desktop persistence. Existing project files are never
overwritten: duplicate filenames get a numeric suffix such as
`castle-gate-2.png`.

## Catalog Entry

Each successful import returns an asset catalog entry with:

- a unique slugged `id`
- a titleized `name`
- `kind: "image"`
- `source: "imported"`
- a project-relative `path`
- `imported` and `image` tags

The Assets screen adds the entry through the project reducer, marks the
project dirty, selects the new asset, and shows a success status. Existing
desktop save/preservation paths then persist the catalog shard.

## Failure States

The UI reports:

- desktop import unavailable in browser mode
- no desktop project root opened
- unsupported source extensions
- invalid non-file sources
- copy or path errors returned by the desktop command

Canceling the file dialog is a no-op and does not dirty the project.

## Evidence

- Focused frontend tests:
  - `src/stores/__tests__/assetCatalogReducer.test.ts`
  - `src/screens/__tests__/AssetsScreen.test.tsx`
- Desktop import helper tests:
  - `src-tauri/src/fs_commands.rs`
- Browser smoke screenshot:
  - `docs/screenshots/phase11-cp050/image-import-browser-unavailable.png`

## Known Limits

CP-050 imports local images into the catalog. It does not generate images,
inspect image dimensions, wire imported images into specific database pickers,
or mutate runtime asset dependency behavior. Those remain owned by later asset
pipeline, database workflow, and optional AI-provider issues.
