# M11 — Sprite Sheet and Animation Pipeline Optimization

> Status: **CLOSED** (commit pending)
>
> Scope: deterministic, reviewable contract for the sprite sheet and animation pipeline the editor's character generation workflow produces. Wires the existing pieces together so every generated sprite sheet candidate has:
>
> - a structured prompt spec the prompt template library can render,
> - identity and style constraints that survive across the 6-action × 4-direction grid,
> - a normalization step that produces a single horizontal-strip BMP for the runtime,
> - a deterministic preview GIF + sheet for visual QA,
> - a runtime-export compatibility gate keyed on the project magenta transparency color.

This document is **additive**. No existing source file, test, or fixture is modified. It pairs with:

- `docs/PHASE_12_M09_ANIMATION_RUBRIC.md` — the rubric the workflow must satisfy,
- `scripts/dev/normalize_animation_strip.py` — the canonical normalizer (referenced as the only production pipeline for horizontal-strip generation),
- `scripts/dev/generate_animation_preview.py` — the canonical preview generator,
- `src/providers/spriteSheetGenerationWorkflow.ts` and `src/providers/generatedAnimationQa.ts` — the editor contract this milestone re-confirms through fixture tests.

## 1. Prompt spec

The sprite sheet workflow renders its prompt via `renderImagePromptTemplate('character-spritesheet-v1', ...)` in `src/providers/imagePromptTemplates.ts`. The prompt template is the only one that drives sprite sheet generation; the editor never falls back to a different template for that operation.

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `frameWidth` | positive integer | ✅ | `64` | Per-frame width in pixels. Must equal the source frame width after normalization. |
| `frameHeight` | positive integer | ✅ | `64` | Per-frame height in pixels. Must equal the strip height. |
| `frameCount` | positive integer | ✅ | `4` | Number of frames in the horizontal strip. Sheet width = `frameWidth × frameCount`. |
| `fps` | positive finite | ✅ | `8` | Playback rate. |
| `loop` | boolean | ✅ | `true` | Whether the runtime wraps the strip. |
| `anchorX`, `anchorY` | integers in frame bounds | ✅ | `32, 54` | Bottom-center feet anchor. |
| `transparentBackgroundRequired` | boolean | ✅ (must be `true`) | `true` | Hard-coded by the workflow; the QA rubric forbids `false`. |
| `frameLayout` | `'horizontal-strip'` | ✅ (must be `'horizontal-strip'`) | `'horizontal-strip'` | Hard-coded by the workflow. |
| `action` | string | ✅ | `'idle'` | One of `idle`, `walk`, `interact`, `attack`, `hurt`, `death`. |
| `direction` | `Direction \| 'any'` | ✅ | `'down'` | One of `'down'`, `'left'`, `'right'`, `'up'`, `'any'`. |
| `displayHeightTiles` | positive finite | ✅ | `1.5` | Map-tile height the runtime claims. |
| `displayWidthTiles` | positive finite | ✅ | `1` | Map-tile width the runtime claims. |
| `displayYOffsetPx` | finite | ✅ | `0` | Optional vertical offset for fine alignment. |
| `colorPalette` | string | ✅ | derived from source concept | Restricts the prompt to the project's palette. |
| `promptInputs.subject` | string | ✅ | derived from owner | One-line subject for the AI. |
| `promptInputs.useCase` | string | ✅ | derived from owner | Reviewable use-case copy. |
| `promptInputs.palette` | string | ✅ | transparent + readable costume | Palette guidance mirrored from the binding visual design. |
| `promptInputs.styleNotes` | string | ✅ | transparent + strict boundaries | Style guidance that pins the strip to the horizontal-strip contract. |

The image generation request also carries:

- `outputFormat: 'png'`
- `quality: 'low'`
- `size: '1024x1024'`
- `style: 'pixel-art'`
- `background: 'auto'`
- `moderation: 'auto'`

These come from `normalizeImageGenerationSettings` in `providerImageGenerationSettings.ts` and are the canonical defaults.

## 2. Identity constraints

The character must remain recognizable across the **6 actions × 4 directions** the player set requires:

- **6 actions:** `idle`, `walk`, `interact`, `attack`, `hurt`, `death`.
- **4 directions:** `down`, `left`, `right`, `up`.

The workflow's identity contract:

1. **One source concept per character.** The `sourceConceptAsset` field on `SpriteSheetGenerationDraft` is the single visual anchor. Every action and direction strip generated for the same owner reuses the same source concept id; the generated asset records the link via `generated.sourceAssetId` and `generated.sourceAssetPath`.
2. **Stable palette and silhouette.** The palette is recorded in the concept asset metadata and re-applied to every subsequent strip via the prompt template's `palette` input. The silhouette is preserved by the `anchor` (bottom-center feet) and by reusing the same `displayHeightTiles` for every strip of the same character.
3. **No silent costume swaps.** The QA rubric's `referenceAssets` field is non-empty when the author chose to anchor the character to a previously generated sprite sheet; the workflow stamps the `referenceAssetIds` array onto the generated asset so a costume swap in a later strip is reviewable.
4. **Direction coverage warning.** If a strip only covers one direction, the project-level coverage validator flags the player set as incomplete; the workflow does **not** raise a fifth QA check ID — the existing `coverage` check remains the single place where direction gaps surface.

## 3. Style constraints

The strip must obey the project's binding visual rules (`docs/GAME_VISUAL_DESIGN.md`) and the prompt template's `styleConstraints` list (`character-spritesheet-v1`):

| Constraint | Source | Enforcement |
| --- | --- | --- |
| **Palette** | `promptInputs.palette` | Prompt template + workflow. |
| **Line weight** | template `styleConstraints`: "pixel-clean frame boundaries", "consistent character scale" | Prompt template + workflow; visually verified by reviewer. |
| **No anti-aliased edges** | template `styleConstraints`: "no merged or cropped frames" | The Python normalizer uses `Image.Resampling.NEAREST` for resampling (preserves input pixels exactly). Anti-aliased input is a workflow issue, not a normalizer issue. |
| **No background gradient** | template + `transparentBackgroundRequired: true` | The workflow forces the QA contract to `transparentBackgroundRequired: true`; the normalizer paints transparent pixels with `#ff00ff` on the runtime BMP. |
| **Consistent anchor** | `anchorX`, `anchorY` | `validateSpriteSheetGenerationDraft` rejects out-of-frame anchors. |
| **Strict horizontal strip** | `frameLayout: 'horizontal-strip'` | Hard-coded by `buildSpriteSheetGenerationRequest`; the QA `metadata` check rejects any other value. |

The visual half of these constraints (palette, line weight, no background gradient, silhouette readability) is still a human review item; the fixture test in `src/providers/__tests__/spriteSheetOptimization.test.ts` asserts only the deterministic half.

## 4. Normalization pipeline

The canonical normalizer is:

```text
scripts/dev/normalize_animation_strip.py
```

This document references that script as the **only** production pipeline that produces a runtime-ready horizontal-strip output. The M11 milestone does **not** duplicate or fork that logic; the new TypeScript and Python tests exercise the existing script through its public function (`normalize_animation_strip`) and CLI (`python scripts/dev/normalize_animation_strip.py`).

Default output paths (project-relative):

- web PNG: `assets/generated/web/{outputId}.png`
- editor PNG: `src/assets/generated/{outputId}.png`
- runtime BMP: `assets/generated/runtime/{outputId}.bmp`
- normalization manifest: `assets/generated/source/phase11_animation_normalization/{outputId}.json`

Default pipeline metadata recorded in the manifest:

- `schemaVersion: 1`
- `pipeline: "rpgcreatorai-animation-strip-normalization-v1"`
- `normalization.layout: "horizontal-strip"`
- `normalization.anchorRule: "bottom-center"`
- `transparency.runtimeBmpTransparencyKey: "#ff00ff"`
- `transparency.pngBackground: "alpha"`

The M11 contract requires the manifest's `frameCount` to match the draft's `frameCount` input and the produced sheet width to equal `frameWidth × frameCount`. Both are asserted by the new Python test in `tests/test_sprite_sheet_optimization.py`.

## 5. Preview generation

The canonical preview generator is:

```text
scripts/dev/generate_animation_preview.py
```

This document references that script as the **only** production pipeline that produces the GIF + sheet evidence the editor surfaces in its preview pane. Default output paths (project-relative):

- preview GIF: `docs/screenshots/phase11-animation-preview/{outputId}.gif`
- preview sheet: `docs/screenshots/phase11-animation-preview/{outputId}_sheet.png`
- preview manifest: `assets/generated/source/phase11_animation_previews/{outputId}.json`

The preview manifest records `runtimeDependency: false` so the C++ runtime never accidentally mounts a preview GIF as a runtime asset.

## 6. Runtime export compatibility

The runtime-export gate enforces:

1. **BMP format with `#ff00ff` magenta key.** Recorded on the normalization manifest **and** on the runtime manifest (`data/assets/runtime-manifest.json`). The Python normalizer paints every transparent pixel with `(255, 0, 255)` and verifies that the resulting BMP's top-left pixel is magenta.
2. **Dimensions match the manifest.** The runtime BMP dimensions are `(frameWidth × frameCount) × frameHeight`. The Python normalizer checks `image.size == (frame_width * frame_count, frame_height)` inside `validate_bmp_output`. The TS `runtimeCompatibility` check verifies the same property on the asset via `qaPreview`.
3. **Sheet width = `frameWidth × frameCount`.** The asset's `width` must equal `frameWidth × frameCount` (the TS candidate sets `expectedWidth = frameWidth * frameCount`). The Python normalizer enforces this with `if image.width % frame_count != 0`.
4. **Supported extension.** `asset.path` must use `.png`, `.jpg`, `.jpeg`, `.bmp`, or `.webp` for catalog ingestion. The sprite sheet workflow writes `.png`.

The M11 contract treats the BMP `#ff00ff` key as a single-source invariant: the Python script, the runtime manifest, the C++ runtime, and the catalog entry all reference the same string literal.

## 7. Screenshot evidence

The directory `docs/screenshots/phase11-animation-preview/` holds the preview artifacts the editor surfaces in its animation QA pane. The two existing files:

- `player_adventurer_walk_down.gif` — produced by `generate_animation_preview.py`. Validates frame count, FPS, and preview pipeline output.
- `player_adventurer_walk_down_sheet.png` — static 4-frame sheet at 2x preview scale. Validates sheet size and frame readability.

These are the existing CP-077 evidence for the bundled sample player.

## 8. Out-of-scope follow-ups

- **Live-image QA still requires a human reviewer.** The visual half of `styleConsistency`, `readability`, and `runtimeSuitability` cannot be asserted from fixtures alone.
- **No new `GeneratedAnimationQaCheckId` was added in M11.** The 4-check contract is unchanged.
- **Project-level coverage validator (M08 / CP-076) is unchanged.** M11 only documents the 6-action × 4-direction identity contract.
- **No live provider call is added.** Every fixture round-trip uses `createMockProviderAdapter`. The new TS test asserts this with a `vi.spyOn` on the adapter's `execute` method.
