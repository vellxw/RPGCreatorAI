# Phase 11 Asset Library Integration Gate

Issue: CP-056 / FRA-91
Date: 2026-06-02

## Result

Milestone 06, Asset Library And Import Pipeline, is green.

The gate validated the asset catalog, import flows, metadata editing,
reference indexing, runtime export, desktop helpers, native runtime checks, and
runtime smoke together. The asset library is ready for downstream optional AI
generation pipelines, while the native runtime remains local, deterministic,
and independent of AI providers, network, cloud, credentials, or live APIs.

## Integration Coverage

Validated asset areas:

- `data/assets/catalog.json` preservation through browser and desktop paths
- image, spritesheet, audio, and tileset import workflows
- imported asset metadata and immutable catalog identity fields
- animation clips referencing imported spritesheet assets
- tileset metadata referencing imported tileset assets
- `system.audio` registrations for imported WAV ids
- runtime-ready BMP/WAV manifest validation
- native runtime warnings for missing animation BMP outputs
- runtime smoke with local audio paths and deterministic fallback when no audio
  endpoint is available

CP-056 added a focused browser-memory roundtrip integration test that preserves
an imported image, spritesheet, tileset, and audio entry together with their
database references, and asserts export/import does not mutate the source
catalog snapshot.

## Commands

Focused asset/import gate:

```powershell
npm test -- --run src/adapters/__tests__/BrowserMemoryAdapter.test.ts src/stores/__tests__/assetCatalogReducer.test.ts src/screens/__tests__/AssetsScreen.test.tsx src/adapters/__tests__/audioImport.test.ts src/adapters/__tests__/tilesetImport.test.ts src/components/database/__tests__/AnimationsEditor.test.tsx src/components/database/__tests__/TilesetEditor.test.tsx src/validation/__tests__/validateDatabases.test.ts src/validation/__tests__/validateProject.test.ts src/validation/__tests__/referenceIndex.test.ts
```

Result: PASS, 10 files and 96 Vitest tests.

Runtime export checks:

```powershell
python -m unittest tests.test_runtime_asset_export
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/export-runtime-assets.ps1 --validate-only
cmd /c scripts\dev\export-runtime-assets.bat --validate-only
```

Result: PASS.

Frontend gate requested by Linear:

```powershell
npm run typecheck
npm test -- --run
npm run build
```

Result: PASS. Full Vitest passed 62 files and 352 tests. Vite emitted the
known non-fatal chunk-size warning.

Canonical integration gate:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1
```

Result: PASS.

Gate summary:

- PASS: frontend typecheck
- PASS: frontend tests
- PASS: frontend build
- PASS: native configure/build/CTest
- PASS: Tauri content check
- PASS: Rust desktop tests
- PASS: runtime smoke
- PASS: editor-runtime roundtrip

Runtime smoke stdout included `Audio requested: town_theme ->
assets/audio/town_bgm.wav` and `Audio requested: chest_open ->
assets/audio/chest.wav`. The local machine still had no audio output endpoint,
so the runtime logged silent-audio warnings and continued as designed.

## Known Limits

Milestone 06 does not add AI generation, provider settings, live provider
diagnostics, lossy texture optimization, audio transcoding, arbitrary
scripting, or runtime dependence on the asset catalog. Those remain future
milestones, with AI/provider work constrained to optional editor/tooling
surfaces.
