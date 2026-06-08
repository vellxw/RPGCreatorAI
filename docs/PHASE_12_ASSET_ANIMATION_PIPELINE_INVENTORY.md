# Phase 12 Existing Asset And Animation Pipeline Inventory

Issue: PX-005 / FRA-439
Date: 2026-06-08

## Scope And Sources

This inventory records the asset, generated image, sprite sheet, and animation
pipeline already present in the repo so Phase 12 optimization work can improve
existing workflows instead of bypassing them.

Inspected sources include:

- `docs/ASSET_PIPELINE.md`
- Phase 11 asset import, metadata, runtime export, generated image, visual QA,
  character concept, sprite sheet, animation normalization, preview, coverage,
  QA, runtime BMP export, and integration gate docs.
- `data/assets/catalog.json`
- `data/assets/runtime-manifest.json`
- `src/types/project.ts`
- `src/adapters/assetImport.ts`
- `src/adapters/spritesheetImport.ts`
- `src/adapters/tilesetImport.ts`
- `src/adapters/audioImport.ts`
- `src/stores/projectStore.ts`
- `src/screens/AssetsScreen.tsx`
- `src/components/database/*`
- `src/providers/*GenerationWorkflow.ts`
- `src/providers/generatedImageVisualQa.ts`
- `src/providers/generatedAnimationQa.ts`
- `scripts/dev/export_runtime_assets.py`
- `scripts/dev/normalize_animation_strip.py`
- `scripts/dev/generate_animation_preview.py`
- native runtime sprite, animation, and runtime-project validation tests.

No `.env` file, credential store, live image provider, live animation provider,
network endpoint, paid API, or app-data secret was inspected or called.

## Inventory Summary

| Area | Status | Existing boundary |
| --- | --- | --- |
| Asset catalog | Implemented | `data/assets/catalog.json`, project metadata, `AssetCatalog`, and reducer actions store editor asset entries separate from native runtime loading. |
| Asset import workflows | Implemented desktop-local | Image, spritesheet, tileset, and audio import adapters copy user assets into project folders and add catalog/database metadata. Browser import is intentionally unavailable. |
| Asset metadata editor | Implemented | Metadata editing is limited to descriptive/runtime compatibility fields while identity and source fields remain protected. |
| Generated image workflows | Implemented mock-backed | Tileset, icon, portrait, concept, image edit/variation, and sprite sheet workflows create review-gated generated candidates with provenance and QA metadata. |
| Visual QA | Implemented local rubric | Generated image visual QA records score categories, warnings, accept/reject state, and review notes without calling providers. |
| Animation QA | Implemented local rubric | Generated animation QA checks preview evidence, metadata, coverage, runtime exportability, and blocks rejected assets from assignment. |
| Animation strip normalization | Implemented local script | `normalize_animation_strip.py` creates editor PNG, web PNG, runtime BMP, and source manifest outputs from horizontal strips. |
| Animation preview generation | Implemented local script | `generate_animation_preview.py` reads normalization manifests and writes preview evidence without creating runtime dependencies. |
| Runtime asset export | Implemented deterministic local script | `export_runtime_assets.py` exports compatible visual assets as BMP, preserves WAV audio, extends normalized animation manifests, and writes `data/assets/runtime-manifest.json`. |
| Runtime integration | Implemented fixture path contract | Native runtime tests validate sprite path lookup, animation data, runtime project validation, and missing-runtime-BMP warnings. |

## Workflow Classification

| Workflow | Classification | Evidence |
| --- | --- | --- |
| Catalog load/save/reducer state | Implemented | `src/types/project.ts`, `defaultAssetCatalog.ts`, `projectStore.ts`, `assetCatalogReducer.test.ts`. |
| Image import | Implemented | `importImageAsset`, `PHASE_11_IMAGE_IMPORT_WORKFLOW.md`, `AssetsScreen.test.tsx`. |
| Spritesheet import | Implemented | `importSpritesheetAsset`, optional animation clip link, `PHASE_11_SPRITESHEET_IMPORT_WORKFLOW.md`. |
| Tileset import | Implemented | `importTilesetAsset`, map tileset metadata, `tilesetImport.test.ts`, `TilesetEditor.test.tsx`. |
| Audio import | Implemented | `importAudioAsset`, WAV-preserving runtime export, `audioImport.test.ts`. |
| Asset metadata editing | Implemented | `PHASE_11_ASSET_METADATA_EDITOR.md`, runtime-compatibility metadata, protected identity fields. |
| Runtime export | Implemented | `export_runtime_assets.py`, `PHASE_11_ASSET_OPTIMIZATION_RUNTIME_EXPORT.md`, runtime manifest fixture. |
| Generated tileset/icon/portrait/concept/edit candidates | Mock-only normal validation | Provider workflows build pending candidates with `mock://generated/...` references and review metadata. |
| Generated sprite sheet candidates | Mock-only normal validation | `spriteSheetGenerationWorkflow.ts` consumes concept direction and records generated candidate provenance. |
| Generated image visual QA | Implemented local review | `generatedImageVisualQa.ts` stores score evidence and review decisions. |
| Generated animation QA | Implemented local review | `generatedAnimationQa.ts` stores QA state and blocks rejected animation assets. |
| Animation strip normalization | Implemented | Local Python scripts validate frame count, dimensions, nonempty frames, safe paths, and magenta transparency. |
| Animation preview evidence | Implemented | Preview generator writes GIF/sheet evidence and manifest metadata marked `runtimeDependency: false`. |
| Animation coverage validation | Implemented | Coverage validator requires player/basic clips and runtime-compatible spritesheet metadata. |
| Runtime BMP export for generated characters | Implemented for normalized manifests | Existing normalized manifests export `player_adventurer_walk_down` to runtime BMP and manifest entries. |
| Live provider asset generation | Out of normal validation scope | Optional future/live diagnostics require explicit credentials and are not used for Phase 12 normal validation. |
| Materializing arbitrary `mock://generated/...` bytes | Gap | Mock candidates carry metadata and refs; arbitrary new mock candidates do not automatically create production image bytes. |
| Multi-action, multi-direction sprite expansion | Gap | Current normalization handles explicit strip inputs and fixture contracts rather than a full bulk animation generator. |
| Source image dimension inspection/slicing/transcoding | Gap | Import docs record current limits for richer image inspection, per-tile slicing, and format conversion. |
| Dynamic native runtime asset-catalog loader | Out of scope | Runtime consumes local data and runtime manifest/assets; the editor catalog is not a runtime dependency. |

## Runtime Data Model And Review Gates

The editor asset catalog and native runtime remain deliberately separate:

- The project catalog records source paths, asset kind, metadata, runtime
  compatibility, generation provenance, review state, and QA evidence.
- Generated candidates enter project data only through explicit approval or
  review functions. Rejected animation assets are blocked from selection.
- Runtime export consumes accepted local assets and normalization manifests,
  writes BMP/WAV outputs under `assets/generated/runtime/`, and writes
  `data/assets/runtime-manifest.json`.
- Native runtime code loads authored project data and runtime-ready assets. It
  does not call providers, read credentials, or interpret editor-only catalog
  state.
- `SpriteCatalog::runtimePathFor` and runtime validation tests preserve the
  asset-key-to-BMP convention used by generated animation fixtures.

Current runtime manifest evidence includes catalog assets such as
`player_adventurer_sheet`, `sample_town_tiles`, `shopkeeper_portrait`,
`town_theme`, `forest_concept_generated`, and normalized generated animation
asset `player_adventurer_walk_down`.

## Gaps Mapped To Phase 12 M08-M11

Linear milestone context:

- M08: Generated Asset And Animation Research (`PX-166` through `PX-185`).
- M09: Animation Quality Rubric And Fixtures (`PX-186` through `PX-205`).
- M10: Multi-Round Asset Refinement Pipeline (`PX-206` through `PX-225`).
- M11: Sprite Sheet And Animation Pipeline Optimization (`PX-226` through
  `PX-245`).

Recommended backlog mapping:

| Gap | Phase 12 target |
| --- | --- |
| Provider/image/animation capability, legal, cost, and API research needs evidence before any product execution path expands. | M08 |
| Current animation QA exists but later work needs deterministic accepted/rejected fixtures, screenshot evidence, and rubric coverage for failure cases. | M09 |
| Mock generated assets are single-pass candidates; refinement loops should remain provider-agnostic, cost-gated, review-gated, and should reuse existing provenance/QA structures. | M10 |
| Sprite sheet generation and normalization need stronger prompt specs, identity/style constraints, repair guidance, preview evidence, and runtime export compatibility tests. | M11 |
| Arbitrary `mock://generated/...` refs do not materialize real image bytes. | M10/M11, depending on whether the issue is refinement-loop output or sprite-sheet runtime export. |
| Current import paths have limited source inspection, slicing, and transcoding. | M11 only if optimization issues require it; otherwise keep out of scope. |
| Dynamic runtime loading from editor catalog would blur the editor/runtime boundary. | Do not implement unless a later issue explicitly changes runtime architecture. |

## Safe Validation Commands

Safe offline commands for Phase 12 asset and animation work:

```powershell
npm run typecheck
npm test -- --run src/screens/__tests__/AssetsScreen.test.tsx src/stores/__tests__/assetCatalogReducer.test.ts src/adapters/__tests__/tilesetImport.test.ts src/adapters/__tests__/audioImport.test.ts src/components/database/__tests__/TilesetEditor.test.tsx src/components/database/__tests__/AnimationsEditor.test.tsx src/components/database/__tests__/AnimationPreview.test.tsx src/components/database/__tests__/CharacterAnimationPipelineIntegration.test.tsx src/assets/generated/__tests__/assetCatalog.test.ts src/assets/generated/__tests__/assetManifestIntegrity.test.ts src/providers/__tests__/tilesetGenerationWorkflow.test.ts src/providers/__tests__/itemIconGenerationWorkflow.test.ts src/providers/__tests__/portraitGenerationWorkflow.test.ts src/providers/__tests__/characterConceptGenerationWorkflow.test.ts src/providers/__tests__/imageEditVariationWorkflow.test.ts src/providers/__tests__/spriteSheetGenerationWorkflow.test.ts src/providers/__tests__/generatedImageVisualQa.test.ts src/providers/__tests__/gptImageAssetPipelineIntegration.test.ts
python -m unittest tests.test_runtime_asset_export tests.test_animation_strip_normalization tests.test_animation_preview_generation tests.test_visual_assets
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/export-runtime-assets.ps1 --validate-only
```

These commands use local fixtures, mocked providers, and deterministic repo
scripts. They are not live provider diagnostics.

## Inventory Result

Phase 11 already delivered a local-first asset foundation: catalog metadata,
desktop import workflows, generated image and sprite candidates, review gates,
visual and animation QA, normalization, preview evidence, deterministic runtime
export, and native runtime fixture validation. Phase 12 should build on those
boundaries by researching provider capabilities first, strengthening
deterministic animation quality evidence, adding provider-agnostic refinement
only where scoped, and optimizing sprite sheet/runtime export workflows without
making the native runtime depend on AI, provider credentials, network calls, or
editor-only catalog state.
