# M09 — Generated Animation Rubric and Fixtures

> Status: **DRAFT** — Phase 12 / M09
>
> Scope: deterministic, reviewable rubric that maps every acceptance rule
> for generated character animation strips to a concrete check in
> `src/providers/generatedAnimationQa.ts`, and tells reviewers which rules
> can be enforced by fixture-driven tests and which still need a human eye.

This document is the single source of truth for what "accepted", "rejected",
and "warning" mean for a generated character sprite sheet inside the
RPGCreatorAI editor. It pairs with the new test files:

- `src/providers/__tests__/animationRubric.test.ts` — fixture-driven TS test
  that drives `generatedAnimationQa.ts` against three fixture categories
  (accepted / rejected / warning).
- `tests/test_animation_rubric.py` — Python test that exercises
  `scripts/dev/normalize_animation_strip.py` against a synthetic strip.

Both new tests are **additive**. No existing test or source file is
modified.

---

## 1. Scope

The rubric covers a generated animation strip from the moment the sprite
sheet workflow produces a `SpriteSheetGenerationCandidate` (pending review)
until the editor stamps the asset with `generated.animationQa` and adds it
to `data/assets/catalog.json`. It explicitly includes the
`normalize_animation_strip` Python pipeline because the catalog-level
runtime BMP is produced by that pipeline before the editor ever sees the
asset.

The rubric does **not** cover:

- Live AI provider calls (out of scope by design — fixture-driven).
- Native runtime playback (covered by `src-tauri` C++ tests).
- Author-side concept review (handled by the existing visual QA in
  `generatedImageVisualQa.ts`).

---

## 2. Rule catalogue

Each rule below is the canonical statement. The next section maps every
rule to the check ID in `generatedAnimationQa.ts` and the related Python
normalizer assertion.

### 2.1 Frame size divisibility

`frameWidth × frameCount == sheet.width` and `frameHeight == sheet.height`.
The sheet must be a strict horizontal strip with no padding, no margins,
and no mixed frame sizes. Frames that do not evenly tile the sheet width
are rejected; off-by-one sheet widths from a sloppy resampler are the most
common cause and are caught at the candidate stage.

### 2.2 Alpha bounds

If `transparentBackgroundRequired === true` (which every workflow-produced
candidate sets), then:

- The strip **must not** be 100% opaque (alpha min ≠ 255) — there must be
  at least one transparent pixel.
- The strip **must not** be 100% transparent (alpha max ≠ 0) — at least
  one frame must contain visible art.
- Each individual frame must have a non-empty alpha bbox. An empty frame
  is a hard reject because it cannot be normalized.

These bounds are enforced by `build_normalized_strip` in
`normalize_animation_strip.py` and surfaced via the candidate's
`qaPreview` (preview check) in TS.

### 2.3 Anchor consistency

`clip.anchor.x` and `clip.anchor.y` must lie strictly inside the frame
bounds:

- `0 ≤ anchor.x < frameWidth`
- `0 < anchor.y < frameHeight` (Python uses `0 < anchor.y < frameHeight`
  for a bottom-center anchor; the editor contract uses `≤`).

Anchor outside the frame is a workflow error, not a content error, and is
caught by `validateSpriteSheetGenerationDraft` in
`spriteSheetGenerationWorkflow.ts` and `validate_request` in the
normalizer.

### 2.4 Frame count vs sheet width

Sheet width must equal `frameWidth * frameCount`. The TS candidate exposes
`expectedWidth = frameWidth * frameCount` and the runtime compatibility
check enforces `asset.width === expectedWidth`. The Python normalizer
checks the same property on the source strip with
`if image.width % frame_count != 0`.

### 2.5 Runtime export compatibility

The runtime BMP must:

- Use the `#ff00ff` magenta key for transparent pixels.
- Match the source dimensions exactly (`frameWidth * frameCount ×
  frameHeight`).
- Use one of the supported extensions for catalog ingestion
  (`.png`, `.jpg`, `.jpeg`, `.bmp`, `.webp`).

The TS check `runtimeCompatibility` enforces (a) and (b) through the
candidate's `qaPreview`; the Python `validate_bmp_output` enforces (a)
and (b) on the actual BMP; the runtime manifest
`data/assets/runtime-manifest.json` records the `transparencyKey:
"#ff00ff"` invariant for the editor and runtime both to consume.

### 2.6 Coverage rules

Coverage is a **project-level** concern enforced by the existing
`validateDatabases` project validator (see
`docs/PHASE_11_ANIMATION_COVERAGE_VALIDATOR.md`):

- Player set: requires `idle`, `walk`, `interact`, `attack`, `hurt`, and
  `death` for `down`, `left`, `right`, and `up` (4 directions × 6 actions).
  A clip with `direction: 'any'` satisfies every direction.
- NPC set: requires `idle` and `walk` for all four directions.
- Enemy set: requires `idle`, `attack`, `hurt`, and `death` for all four
  directions.

A generated candidate does not need every clip; it only needs the clip
the workflow is currently producing. The project-level coverage validator
aggregates clips across all assets and fails if the player set is
incomplete, so a generated candidate alone cannot fail coverage. The
rubric's "coverage" check therefore is scoped to "this candidate has a
clip aligned to the asset", which is exactly what `generatedAnimationQa`
checks.

### 2.7 Visual QA dimensions / transparency / styleConsistency / readability / runtimeSuitability

These five visual QA dimensions are checked on the **concept image** by
`generatedImageVisualQa.ts`, not on the strip. The rubric lists them
because the strip workflow usually starts from a reviewed concept
(`sourceConceptAsset`), and a rejected visual QA on the concept blocks
the entire strip. They are intentionally not in
`generatedAnimationQa.ts` — that file is for the strip itself.

### 2.8 Tag production

A QA result must produce deterministic tags that the editor and the
catalog can use to filter assets:

- `animation-qa-reviewed` when status is `accepted`.
- `animation-qa-rejected` when status is `rejected`.
- Any reviewer-supplied tags from `finalizeGeneratedAnimationQaReview`.

`applyGeneratedAnimationQaResult` is the single function that stamps
these tags onto the catalog entry.

---

## 3. Mapping to `generatedAnimationQa.ts`

The `GeneratedAnimationQaCheckId` union is currently:

```ts
type GeneratedAnimationQaCheckId =
  | 'preview'
  | 'metadata'
  | 'coverage'
  | 'runtimeCompatibility';
```

| Rubric rule | TS check ID | Pass condition (paraphrased) |
| --- | --- | --- |
| 2.2 Alpha bounds, 2.4 Sheet width = frameWidth × frameCount, 2.7 dimensions | `preview` | `qaPreview` has a non-zero `assetRef`, `width`, `height`, `frameWidth`, `frameHeight`, `frameCount`. |
| 2.1 Frame size divisibility, 2.2 Alpha bounds (manifest side), 2.4 Frame count vs sheet width (manifest side) | `metadata` | `asset.generated.spriteSheet` matches the QA preview exactly (frame size, count, `horizontal-strip`, `transparentBackgroundRequired === true`). |
| 2.3 Anchor consistency (clip side), 2.6 Coverage rules (per-asset side) | `coverage` | The animation set has a clip with `clip.asset === asset.id`, matching `action`, `direction`, `frameSize`, and `frameCount` of the QA preview. |
| 2.5 Runtime export compatibility, 2.7 runtimeSuitability (catalog side) | `runtimeCompatibility` | `asset.kind === 'spritesheet'`, path uses a runtime image extension, sheet width and height match preview, frame metadata matches. |

The 4-check structure is the editor contract — the rubric does not add
new check IDs. When a reviewer wants to record a subjective
"readability" concern, they pass an override in
`finalizeGeneratedAnimationQaReview({ checks: { coverage: { status: 'warning' }}})` rather than
introducing a fifth check ID.

The score is computed by `scoreChecks` in the same file: 25 per `pass`,
12 per `warning`, 0 per `fail`, minus 10 if the overall status is
`rejected`. The integration gate doc captures the exact numbers
produced by the new fixture test.

---

## 4. Fixture vs live matrix

| Check ID | Deterministic (fixture) | Needs human reviewer | Notes |
| --- | --- | --- | --- |
| `preview` | ✅ | ❌ | All inputs come from `qaPreview`; no image decode required. |
| `metadata` | ✅ | ❌ | Pure object equality between `asset.generated.spriteSheet` and `qaPreview`. |
| `coverage` | ✅ | ❌ | Pure object equality between clip and asset. |
| `runtimeCompatibility` | ✅ | ❌ | Pure dimension/extension match. |
| Visual QA `dimensions` | ✅ | ❌ | Image decode is deterministic; covered by `generatedImageVisualQa.test.ts`. |
| Visual QA `transparency` | ⚠️ partial | ✅ | Whether the magenta key is correctly applied at runtime requires the BMP round-trip; the editor's transparent pixels must be visually verified. |
| Visual QA `styleConsistency` | ❌ | ✅ | Requires comparing the strip against the visual profile and reference art. |
| Visual QA `readability` | ❌ | ✅ | Subjective: silhouette, palette, contrast. |
| Visual QA `runtimeSuitability` | ⚠️ partial | ✅ | The dimensions/format half is deterministic; whether the asset is actually usable in the bundled sample map requires a playtest. |
| Python normalizer alpha bounds | ✅ | ❌ | PIL decode of the source strip is deterministic. |
| Python normalizer anchor consistency | ✅ | ❌ | Pure integer check. |
| Python normalizer BMP `#ff00ff` key | ✅ | ❌ | `image.getpixel((0, 0))` is deterministic on a synthesized strip. |
| Python normalizer manifest well-formedness | ✅ | ❌ | JSON parse + key presence is deterministic. |
| Project-level coverage rules | ❌ | ✅ | The author has to decide whether an NPC or enemy set is required for the project; the validator only reports gaps. |

The fixture-driven column is what the new TS test exercises. The human
column is explicitly called out in the new integration gate report as
follow-up work for the M11 UX review pass.

---

## 5. Acceptance criteria (recap)

A generated animation candidate is **accepted** when:

1. All four `generatedAnimationQa` checks pass (or the reviewer
   explicitly overrides one to `warning` with a recorded note).
2. The score is `100` (4 × 25) for an all-pass result, or
   `100 - 13 × w` for `w` warning checks, minus 10 if the overall status
   is `rejected`.
3. The catalog entry has the `animation-qa-reviewed` tag and
   `generated.animationQa.status === 'accepted'`.
4. The Python normalizer produced a well-formed manifest with
   `transparency.runtimeBmpTransparencyKey === "#ff00ff"` and a BMP
   whose `(0, 0)` pixel is the magenta key.

A candidate is **rejected** when:

1. At least one `generatedAnimationQa` check is `fail`, **or** the
   reviewer records a `rejectionReason`.
2. The catalog entry has the `animation-qa-rejected` tag and
   `generated.animationQa.status === 'rejected'`.
3. `asset.runtimeCompatible` is left at its original value (the QA
   result never promotes a rejected asset to runtime-compatible).

A candidate is a **warning** when:

1. All four checks pass.
2. The reviewer records an override on at least one check to
   `status: 'warning'`.
3. The QA result's `unresolvedWarnings` list contains the warning
   check IDs.
4. The status remains `accepted` (the candidate is accepted but the
   review surface flags the open questions).

---

## 6. Test fixtures summary

The new TS test (`animationRubric.test.ts`) constructs three candidates
using the same `createMockProviderAdapter` factory as the existing
`spriteSheetGenerationWorkflow.test.ts`:

| Category | Construction | Expected status | Expected score | Expected tag |
| --- | --- | --- | --- | --- |
| `accepted` | Use the workflow default with 64×64 frames, 4 frames, valid clip. | `accepted` | `100` | `animation-qa-reviewed` |
| `rejected` | Tamper with the candidate so `asset.width !== expectedWidth` (e.g., 250 instead of 256) **and** drop `transparentBackgroundRequired`. | `rejected` | `40` (1 warning on runtime, 0 on pass) | `animation-qa-rejected` |
| `warning` | Pass a fully valid candidate and override `coverage` to `warning` with a reviewer note. | `accepted` | `87` (3 × 25 + 12) | `animation-qa-reviewed` + reviewer tags |

The Python test (`test_animation_rubric.py`) synthesizes a 3-frame
RGBA strip on a 96 × 80 source frame, runs it through
`normalize_animation_strip`, and asserts the manifest, BMP, and
dimension invariants listed above. A second test mutates the source
strip width to 191 (not divisible by 3) and asserts the normalizer
returns `result.ok === False` with a clear error message.

---

## 7. Out-of-scope follow-ups (tracked elsewhere)

- Live-image QA still requires a human reviewer for `styleConsistency`,
  `readability`, and the `runtimeSuitability` half. The M11 UX review
  pass is the planned landing zone for the visual profile diff and the
  in-editor playtest confirmation step.
- The 4-check ID union is not extended in M09. If M11 introduces a
  fifth check (for example, `anchorSafety`), the rubric will need to be
  updated and the new TS test should be extended to assert the
  additional check.
- The project-level coverage validator (4 directions × 6 actions for
  the player set) is unchanged. M09 only documents it; the validator
  itself was shipped in M08 / CP-076.
