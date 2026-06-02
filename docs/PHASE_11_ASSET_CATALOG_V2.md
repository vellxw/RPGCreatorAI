# Phase 11 Asset Catalog V2

Issue: CP-049 / FRA-84
Date: 2026-06-02

## Result

RPGCreatorAI now has a first-class editor asset catalog for project-owned
visual and audio assets.

The catalog is stored separately from runtime gameplay data:

- `ProjectData.assetCatalog` points to the catalog shard path.
- `data/assets/catalog.json` stores `schemaVersion` plus catalog entries.
- `FullProjectState.assets` carries the in-memory catalog through browser,
  import/export, desktop open/save, project creation, and playtest snapshots.
- The native runtime ignores `assetCatalog`; it remains local,
  deterministic, and independent of editor-only asset metadata.

## Catalog Shape

Each entry has an `id`, `name`, `kind`, `path`, `source`, optional tags, and
optional visual/audio/generated metadata.
CP-066 extends generated metadata with prompt template id/version/kind,
sanitized prompt inputs, provider/model ids, image settings, rendered prompt,
and visual context source/version for auditable AI asset candidates.
CP-067 adds generated tileset draft candidates that enter the catalog only
after explicit review. Accepted generated tilesets use `kind: "tileset"` and
`source: "generated"` with reviewed prompt provenance; rejected or pending
drafts do not mutate the project asset catalog.

Supported `kind` values:

- `image`
- `spritesheet`
- `tileset`
- `audio`
- `generated`

Supported `source` values:

- `local`
- `generated`
- `imported`

Paths are preserved as project-relative strings. The validator rejects empty
or unsafe paths but does not require files to exist, because browser mode
cannot inspect arbitrary local project files.

## Editor Surface

The primary sidebar now exposes an implemented `Assets` workspace. The screen
lists catalog entries, filters by text and kind, and shows a detail/preview
pane with ID, path, source, dimensions, frame data, tags, and generated
metadata. Known bundled image paths use packaged preview assets; other
entries use deterministic type placeholders.

## Preservation

Browser mode seeds the sample catalog from `data/assets/catalog.json` and
export/import round-trips it. Legacy imports with no `assets` payload normalize
to an empty catalog.

Tauri desktop open/save/create/playtest-session flows read and write the
declared `assetCatalog` shard when present. Legacy desktop projects with no
catalog path load an empty catalog and continue to work.

## Validation

TypeScript validation now reports:

- missing asset IDs
- duplicate asset IDs
- invalid asset IDs
- missing names
- invalid `kind` or `source`
- missing paths
- unsafe project-relative paths
- invalid positive numeric metadata

## Evidence

- Focused TDD red/green coverage:
  - `src/adapters/__tests__/BrowserMemoryAdapter.test.ts`
  - `src/validation/__tests__/validateDatabases.test.ts`
  - `src/screens/__tests__/AssetsScreen.test.tsx`
  - `src/components/layout/__tests__/PrimaryNavigation.test.tsx`
- Desktop preservation coverage:
  - `src-tauri/src/fs_commands.rs`
- Browser smoke screenshot:
  - `docs/screenshots/phase11-cp049/assets-browser-smoke.png`

## Known Limits

CP-049 does not implement generated-asset job history, provider calls, or
runtime asset dependency changes. CP-067 adds a tileset-specific generated
draft review path, but it still uses offline fixtures for normal validation
and does not add native runtime provider dependencies.
