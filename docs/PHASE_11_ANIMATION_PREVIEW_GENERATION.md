# Phase 11 Animation Preview Generation

Issue: CP-077 / FRA-112
Date: 2026-06-02

## Result

RPGCreatorAI now has a deterministic local pipeline for generating animation
preview evidence from normalized animation strip manifests. The pipeline writes
GIF and sheet previews for visual QA, stores a preview manifest with source
links, and keeps preview outputs out of runtime dependency paths.

No live AI call, credential lookup, network request, paid API, native runtime
dependency, or runtime AI dependency was added.

## Pipeline Contract

The preview generator is implemented in:

```text
scripts/dev/generate_animation_preview.py
scripts/dev/generate-animation-preview.ps1
scripts/dev/generate-animation-preview.bat
```

Inputs:

- a CP-075 normalization manifest
- the normalized web PNG strip referenced by `outputs.webPng`

Default outputs:

- preview GIF:
  `docs/screenshots/phase11-animation-preview/{outputId}.gif`
- preview sheet:
  `docs/screenshots/phase11-animation-preview/{outputId}_sheet.png`
- preview manifest:
  `assets/generated/source/phase11_animation_previews/{outputId}.json`

The preview manifest records:

- source normalization manifest path
- source strip path
- optional source asset/concept ids
- action, direction, frame size, frame count, FPS, loop, and anchor
- preview scale, duration, and background
- preview GIF/sheet output paths
- `runtimeDependency: false`

## Example

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/generate-animation-preview.ps1 `
  --manifest assets/generated/source/phase11_animation_normalization/player_adventurer_walk_down.json `
  --preview-scale 2
```

Validate an existing preview manifest without rewriting outputs:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/generate-animation-preview.ps1 `
  --validate-preview-manifest assets/generated/source/phase11_animation_previews/player_adventurer_walk_down.json
```

## Sample Preview

CP-077 adds sample preview evidence for the accepted built-in
`player_adventurer_walk_down` strip:

- source normalization manifest:
  `assets/generated/source/phase11_animation_normalization/player_adventurer_walk_down.json`
- preview manifest:
  `assets/generated/source/phase11_animation_previews/player_adventurer_walk_down.json`
- preview GIF:
  `docs/screenshots/phase11-animation-preview/player_adventurer_walk_down.gif`
- preview sheet:
  `docs/screenshots/phase11-animation-preview/player_adventurer_walk_down_sheet.png`

Visual review: the preview sheet shows four readable down-walk frames at 2x
scale on a neutral background. The frames are aligned, non-empty, and suitable
for animation QA before runtime export or acceptance.

## Evidence

TDD red step:

```powershell
python -m unittest tests.test_animation_preview_generation
```

Result: FAIL before implementation because
`scripts/dev/generate_animation_preview.py` did not exist.

Focused CP-077 fixture tests:

```powershell
python -m unittest tests.test_animation_preview_generation
```

Result: PASS, 3 tests.

Sample preview generation:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/generate-animation-preview.ps1 --manifest assets/generated/source/phase11_animation_normalization/player_adventurer_walk_down.json --preview-scale 2
```

Result: PASS; generated the sample preview GIF, preview sheet, and preview
manifest.

Adjacent asset pipeline tests:

```powershell
python -m unittest tests.test_animation_preview_generation tests.test_animation_strip_normalization tests.test_runtime_asset_export tests.test_visual_assets
```

Result: PASS, 9 tests.

Preview manifest validation:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/generate-animation-preview.ps1 --validate-preview-manifest assets/generated/source/phase11_animation_previews/player_adventurer_walk_down.json
```

Result: PASS.

Live-call/secret scan:

```powershell
rg -n "(fetch|axios|WebSocket|EventSource|XMLHttpRequest|https://api|apiKey|secret|token|sk-)" scripts\dev\generate_animation_preview.py scripts\dev\generate-animation-preview.ps1 scripts\dev\generate-animation-preview.bat tests\test_animation_preview_generation.py assets\generated\source\phase11_animation_normalization\player_adventurer_walk_down.json assets\generated\source\phase11_animation_previews\player_adventurer_walk_down.json
```

Result: PASS for CP-077 scope; no matches.

## Known Limits

CP-077 generates preview evidence for normalized strip manifests. It does not
automatically attach previews to every editor asset row, generate previews for
missing provider files, or make preview artifacts runtime dependencies.
