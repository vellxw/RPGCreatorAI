# Phase 11 Animation Strip Normalization

Issue: CP-075 / FRA-110
Date: 2026-06-02

## Result

RPGCreatorAI now has a deterministic local pipeline for normalizing generated
or imported raw character strips into runtime/editor-ready animation strips.
The workflow is script-driven, writes traceable manifests, rejects malformed
input before output, and has fixture tests for successful output generation and
clear failure cases.

No live AI call, credential lookup, network request, paid API, native runtime
dependency, or runtime AI dependency was added.

## Pipeline Contract

The normalizer is implemented in:

```text
scripts/dev/normalize_animation_strip.py
scripts/dev/normalize-animation-strip.ps1
scripts/dev/normalize-animation-strip.bat
```

Default outputs are project-relative:

- web/editor PNG strip: `assets/generated/web/{outputId}.png`
- editor source PNG strip: `src/assets/generated/{outputId}.png`
- runtime BMP strip: `assets/generated/runtime/{outputId}.bmp`
- source manifest:
  `assets/generated/source/phase11_animation_normalization/{outputId}.json`

The script enforces:

- safe project-relative paths and output ids
- positive frame width, height, count, and FPS
- valid direction and boolean loop metadata
- anchor coordinates inside the target frame
- source width divisible by frame count
- transparent source background pixels
- non-empty source and normalized frames
- one shared scale across the whole strip
- bottom-center anchor placement
- deterministic JSON manifests with no timestamps
- runtime BMP transparency using `#ff00ff`

Manifests record source path, optional source asset/concept ids, frame size,
source slot size, action, direction, FPS, loop, anchor, shared scale, per-frame
source/normalized bounds, and output paths.

## Example

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/normalize-animation-strip.ps1 `
  --input assets/generated/source/raw/hero-run-raw.png `
  --output-id hero_run_normalized `
  --name "Hero Run Normalized" `
  --action walk `
  --direction down `
  --frame-width 64 `
  --frame-height 64 `
  --frame-count 4 `
  --fps 8 `
  --loop true `
  --anchor-x 32 `
  --anchor-y 56
```

Validate an existing manifest without rewriting outputs:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/normalize-animation-strip.ps1 `
  --validate-manifest assets/generated/source/phase11_animation_normalization/hero_run_normalized.json
```

## Evidence

TDD red step:

```powershell
python -m unittest tests.test_animation_strip_normalization
```

Result: FAIL before implementation because
`scripts/dev/normalize_animation_strip.py` did not exist.

Focused CP-075 fixture tests:

```powershell
python -m unittest tests.test_animation_strip_normalization
```

Result: PASS, 3 tests.

Adjacent asset pipeline tests:

```powershell
python -m unittest tests.test_animation_strip_normalization tests.test_runtime_asset_export tests.test_visual_assets
```

Result: PASS, 6 tests.

PowerShell wrapper smoke:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/normalize-animation-strip.ps1 --help
```

Result: PASS; argparse help rendered successfully.

Live-call/secret scan:

```powershell
rg -n "(fetch|axios|WebSocket|EventSource|XMLHttpRequest|https://api|apiKey|secret|token|sk-)" scripts\dev\normalize_animation_strip.py scripts\dev\normalize-animation-strip.ps1 scripts\dev\normalize-animation-strip.bat tests\test_animation_strip_normalization.py docs\PHASE_11_ANIMATION_STRIP_NORMALIZATION.md docs\ASSET_PIPELINE.md
```

Result: PASS for CP-075 scope; no matches.

## Known Limits

CP-075 normalizes a single horizontal strip into deterministic PNG/BMP outputs.
It does not update the asset catalog or animation database automatically, does
not generate preview GIFs, and does not materialize `mock://generated/...`
provider references. Those remain separate pipeline steps for later issues.
