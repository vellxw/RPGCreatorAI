# Phase 11 Asset Optimization And Runtime Export

Issue: CP-055 / FRA-90
Date: 2026-06-02

## Result

RPGCreatorAI now has a deterministic local export path from editor catalog
assets to runtime-ready assets.

The native runtime still does not consume editor-only catalog metadata. The
export script reads the catalog, writes concrete runtime files and a manifest,
and the runtime validator checks runtime-consumed animation clip assets by the
same `SpriteCatalog::runtimePathFor()` rule used by rendering.

## Pipeline

Entry points:

- `scripts/dev/export_runtime_assets.py`
- `scripts/dev/export-runtime-assets.ps1`
- `scripts/dev/export-runtime-assets.bat`

Default project root is the repo root. `--validate-only` validates the
existing runtime manifest and outputs without rewriting them.

Visual catalog kinds exported to runtime BMP:

- `image`
- `spritesheet`
- `tileset`
- `generated`

Audio catalog kind:

- `audio`

Audio is not transcoded in v1. Local WAV assets are preserved as runtime-ready
paths and validated as project-relative `.wav` files.

## Conversion Rules

Visual source formats accepted by the exporter:

- `.png`
- `.jpg`
- `.jpeg`
- `.bmp`
- `.webp`

Visual outputs are written under:

```text
assets/generated/runtime/
```

The runtime BMP transparency key is:

```text
#ff00ff
```

Source alpha is flattened onto that magenta key before BMP output. This
matches the renderer's SDL color-key path.

Generated web assets under `assets/generated/web/` use the source file stem as
their runtime key. Other local/imported visual assets use their catalog id.
This preserves existing runtime keys such as `player_adventurer` while still
making imported assets predictable.

Unsafe, absolute, drive-rooted, URI-like, or parent-traversing paths are
rejected before reading or writing files.

## Manifest

The exporter writes:

```text
data/assets/runtime-manifest.json
```

The manifest is deterministic and contains no timestamp. It records:

- schema and pipeline version
- output root
- transparency key
- source path
- runtime key
- runtime path
- runtime format
- measured output dimensions
- spritesheet frame metadata when present

The checked-in sample manifest is the current traceability source for bundled
runtime-ready asset outputs.

## Runtime Validation

`RuntimeProjectValidator` now gathers animation clip `asset` keys from
`data/database/animations.json`, resolves each through
`SpriteCatalog::runtimePathFor()`, and warns if the expected BMP file is
missing.

Missing animation BMPs are warnings, not errors, because the renderer still has
deterministic fallback drawing. Unsafe runtime keys and unsafe resolved paths
are errors.

## Evidence

- `python -m unittest tests.test_runtime_asset_export`
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/export-runtime-assets.ps1`
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/export-runtime-assets.ps1 --validate-only`
- `cmd /c scripts\dev\export-runtime-assets.bat --validate-only`
- `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && cmake --build --preset default && ctest --test-dir build --output-on-failure -R RPGTests"`

## Known Limits

CP-055 does not add lossy optimization, texture packing, audio transcoding,
provider calls, cloud processing, or runtime dependence on the editor catalog.
Those remain outside the current milestone scope.
