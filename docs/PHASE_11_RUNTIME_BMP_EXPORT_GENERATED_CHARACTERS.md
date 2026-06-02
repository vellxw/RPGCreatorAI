# Phase 11 Runtime BMP Export For Generated Characters

Issue: CP-078 / FRA-113
Date: 2026-06-02

## Result

RPGCreatorAI now exports accepted generated character animation strips into the
native runtime's BMP asset convention. The runtime exporter reads CP-075
normalization manifests, converts their normalized web PNG strips to BMP files
with the `#ff00ff` transparency key, and records source-to-runtime metadata in
`data/assets/runtime-manifest.json`.

No live AI call, credential lookup, network request, paid API, native runtime
AI dependency, network dependency, or cloud dependency was added.

## Export Contract

The runtime exporter still starts from:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/export-runtime-assets.ps1
```

For generated character strips, it now scans:

```text
assets/generated/source/phase11_animation_normalization/*.json
```

Each valid normalization manifest exports:

- source strip: `outputs.webPng`
- runtime BMP: `assets/generated/runtime/{id}.bmp`
- runtime manifest entry in `data/assets/runtime-manifest.json`

Generated-character manifest entries include:

- `kind: "spritesheet"`
- `source: "generated"`
- source normalization manifest path
- source asset/concept ids when present
- runtime key/path/format
- width, height, frame width, frame height, frame count
- action, direction, FPS, loop, and anchor metadata
- `transparencyKey: "#ff00ff"`

The runtime path matches the native `SpriteCatalog::runtimePathFor(assetKey)`
contract, so an animation clip whose `asset` is `{id}` resolves to the exported
BMP path.

## Checked-In Sample

The checked-in `player_adventurer_walk_down` normalization manifest now exports
to:

```text
assets/generated/runtime/player_adventurer_walk_down.bmp
```

`data/assets/runtime-manifest.json` records the generated-character runtime
entry and source manifest link.

## Evidence

TDD red step:

```powershell
python -m unittest tests.test_runtime_asset_export
```

Result: FAIL before implementation. A normalization manifest with
`assets/generated/web/hero_walk_normalized.png` did not produce
`assets/generated/runtime/hero_walk_normalized.bmp`.

Focused pipeline validation:

```powershell
python -m unittest tests.test_runtime_asset_export
```

Result: PASS, 3 tests.

Repo runtime export:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/export-runtime-assets.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/export-runtime-assets.ps1 --validate-only
```

Result: PASS. The runtime manifest now includes
`player_adventurer_walk_down` as a generated spritesheet entry.

Adjacent asset pipeline validation:

```powershell
python -m unittest tests.test_runtime_asset_export tests.test_animation_preview_generation tests.test_animation_strip_normalization tests.test_visual_assets
```

Result: PASS, 10 tests.

Native runtime validation:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1 -SkipFrontend -SkipDesktop -SkipSmoke
```

Result: PASS. Native configure/build/CTest passed, including the updated
SpriteCatalog runtime path test. Frontend, desktop, smoke, and roundtrip gates
were intentionally skipped for this runtime-export-focused validation. Existing
non-fatal CMake/dependency warnings remained.

Live-call/secret scan:

```powershell
rg -n "(fetch|axios|WebSocket|EventSource|XMLHttpRequest|https://api|apiKey|secret|token|sk-)" scripts\dev\export_runtime_assets.py tests\test_runtime_asset_export.py tests\test_sprite_catalog.cpp data\assets\runtime-manifest.json
```

Result: PASS for CP-078 scope; no matches.

## Known Limits

CP-078 exports normalized generated-character strips that already have
project-local PNG outputs. It does not materialize provider-only
`mock://generated/...` references, and it does not add a dynamic runtime asset
manifest loader. The native runtime continues to resolve animation clip asset
keys through the deterministic `assets/generated/runtime/{assetKey}.bmp`
convention.
