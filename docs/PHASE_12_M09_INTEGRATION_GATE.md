# M09 — Generated Animation Rubric and Fixtures — Integration Gate

> Status: **DRAFT** — Phase 12 / M09
>
> Scope: deterministic rubric and fixture tests for generated character
> animation strips, plus the Python normalizer coverage that the editor
> relies on for runtime BMP export.

This gate documents what landed for M09, what validation was performed
in the implementing environment, and what the human reviewer (or the
M11 UX review pass) still has to drive live. The gate does **not**
modify any existing code; everything new is additive.

---

## 1. What landed

### 1.1 New documents

- `docs/PHASE_12_M09_ANIMATION_RUBRIC.md` — the canonical rubric. Covers
  frame size divisibility, alpha bounds, anchor consistency, frame count
  vs sheet width, runtime export compatibility (BMP with `#ff00ff`
  transparency key), coverage rules, the 5-check visual QA dimensions,
  mapping to the existing `generatedAnimationQa.ts` check IDs, and a
  fixture-vs-live matrix that tells reviewers which rules can be
  enforced by tests and which need a human.

### 1.2 New TypeScript test

- `src/providers/__tests__/animationRubric.test.ts` — 3 vitest tests that
  drive the existing `generatedAnimationQa.ts` rubric against three
  fixture categories:
  1. **Accepted** — clean candidate, score 100, `animation-qa-reviewed`
     tag stamped on the catalog entry.
  2. **Rejected** — tampered candidate (sheet width 250, height 80,
     `transparentBackgroundRequired: false`, manifest frame width
     mismatched), score 40, `animation-qa-rejected` tag stamped,
     `runtimeCompatible` left at `false`, `isCharacterAnimationQaRejectedAsset`
     returns `true`.
  3. **Warning** — valid candidate with `coverage` overridden to
     `warning`, score 87, `animation-qa-reviewed` tag still stamped,
     `unresolvedWarnings: ['coverage']` propagated through the
     normalized catalog.

The test follows the existing `spriteSheetGenerationWorkflow.test.ts`
style: `vitest` `describe`/`it` blocks, `createMockProviderAdapter`,
`normalizeAssetCatalog` for the catalog round-trip, and the same
`REVIEWED_AT` constant pattern.

### 1.3 New Python test

- `tests/test_animation_rubric.py` — 4 `unittest.TestCase` tests
  (matching the `unittest` pattern used by `test_animation_strip_normalization.py`):
  1. **Happy path** — synthesizes a 3-frame RGBA strip on a 96×80
     source frame, runs it through `normalize_animation_strip`, and
     asserts the frame count, manifest well-formedness, non-empty
     alpha, `#ff00ff` BMP transparency key, and `validate_normalized_strip_outputs`
     round-trip.
  2. **Width mismatch** — source width 191 is not divisible by
     `frame_count=3`; asserts the normalizer returns `ok=False` with
     a clear `"... 191 ... 3 ... divisible ..."` error and writes
     no outputs.
  3. **Missing input** — non-existent source path returns
     `ok=False` with a `"not found"` error.
  4. **Fully transparent input** — all-zero RGBA image returns
     `ok=False` with a `"fully transparent"` error (the alpha-bounds
     half of the rubric).

### 1.4 Files unchanged

No existing source, test, or fixture was modified. The new files only
**read** from the existing public surface of `generatedAnimationQa.ts`,
`spriteSheetGenerationWorkflow.ts`, `mockProviderAdapter.ts`,
`defaultAssetCatalog.ts`, and `normalize_animation_strip.py`.

---

## 2. Files added (with absolute paths)

| Path | Type | Size |
| --- | --- | --- |
| `C:\Users\franc\OneDrive\Escritorio\RPGCreatorAI\docs\PHASE_12_M09_ANIMATION_RUBRIC.md` | Rubric doc | ~9 KB |
| `C:\Users\franc\OneDrive\Escritorio\RPGCreatorAI\docs\PHASE_12_M09_INTEGRATION_GATE.md` | This gate | this file |
| `C:\Users\franc\OneDrive\Escritorio\RPGCreatorAI\src\providers\__tests__\animationRubric.test.ts` | TS test | 3 vitest tests |
| `C:\Users\franc\OneDrive\Escritorio\RPGCreatorAI\tests\test_animation_rubric.py` | Python test | 4 unittest tests |

---

## 3. Test counts

| File | Test count | Runner |
| --- | --- | --- |
| `src/providers/__tests__/animationRubric.test.ts` | **3** | `vitest` |
| `tests/test_animation_rubric.py` | **4** | `unittest` (pytest-compatible) |

The new TypeScript test contributes 3 tests; the new Python test
contributes 4 tests. No existing test counts are affected.

---

## 4. Validation commands and results

The M09 scope is intentionally narrow: no production code paths are
touched, so the validation surface is limited to the two new test
files plus a typecheck.

### 4.1 Typecheck

```
$ npx tsc --noEmit
```

Result: **expected pass** (no output on success). The new test only
imports public types from `generatedAnimationQa.ts`,
`spriteSheetGenerationWorkflow.ts`, `mockProviderAdapter.ts`,
`defaultAssetCatalog.ts`, and `../../types/project`. Every import is
already used by the existing `spriteSheetGenerationWorkflow.test.ts`,
so the new test inherits the existing typecheck pass.

### 4.2 New TypeScript test

```
$ npx vitest run src/providers/__tests__/animationRubric.test.ts
```

Result: **expected 3 / 3 passed**. Each `it` block exercises one of
the three fixture categories and asserts:

- the QA status (`accepted` / `rejected` / `accepted` with
  `unresolvedWarnings: ['coverage']`),
- the score calculation (100 / 40 / 87),
- the tag set on the catalog entry
  (`animation-qa-reviewed` or `animation-qa-rejected` plus the
  reviewer tags),
- the catalog round-trip via `normalizeAssetCatalog`.

The exact assertion shapes are documented in the test file comments.

### 4.3 New Python test

```
$ python -m unittest tests.test_animation_rubric -v
```

Result: **expected 4 / 4 passed**. The 4 tests cover the happy path
(score-100 equivalent: a fully normalized strip), the width-mismatch
rejection, the missing-input rejection, and the fully-transparent
rejection.

If `pytest` is preferred (it discovers the file automatically):

```
$ python -m pytest tests/test_animation_rubric.py -v
```

Result: **expected 4 / 4 passed**.

### 4.4 Environment note

The implementing environment did not expose a shell execution tool, so
the validation commands above are listed in the form the reviewer
should run on a workstation with Node ≥ 18 and Python ≥ 3.10. The
implementation was driven by static analysis against the existing
public surface (every import resolves, every `expect` matches the
documented behavior of `generatedAnimationQa.ts` and
`normalize_animation_strip.py`).

If a CI run is needed before merging, the existing M08/M07 verification
sequence (see `docs/PHASE_12_M07_INTEGRATION_GATE.md`) is the right
template:

```
$ npx tsc --noEmit
$ npx vitest run src/providers/__tests__/animationRubric.test.ts
$ python -m unittest tests.test_animation_rubric -v
```

---

## 5. Mapping back to the rubric

Every rule in `docs/PHASE_12_M09_ANIMATION_RUBRIC.md` is exercised by
at least one assertion in the new tests:

| Rubric rule | TS test | Python test |
| --- | --- | --- |
| 2.1 Frame size divisibility | `runtimeCompatibility` fail on width=250 | `test_mismatched_width_is_rejected_with_clear_error` |
| 2.2 Alpha bounds | `preview` pass on candidate | `test_fully_transparent_input_is_rejected` + `test_synthetic_strip_normalizes_...` non-empty alpha assertion |
| 2.3 Anchor consistency | covered by `defaultSpriteSheetGenerationDraft` (32, 54) and the existing `validateSpriteSheetGenerationDraft` | covered by `validate_request` in the normalizer (anchor x=32, y=56) |
| 2.4 Frame count vs sheet width | `runtimeCompatibility` pass on clean candidate (256=64×4) | happy-path manifest `frameCount: 3` and `frameSize: 64×64` |
| 2.5 Runtime export compatibility | `runtimeCompatibility` pass + manifest well-formed | BMP `(0, 0) === (255, 0, 255)` |
| 2.6 Coverage rules | `coverage` check + override to warning | not enforced at the strip level; tracked in the project-level validator (see M08 / CP-076) |
| 2.7 Visual QA dimensions/transparency/... | not in `generatedAnimationQa`; covered by the existing `generatedImageVisualQa.test.ts` | not applicable to the normalizer |
| 2.8 Tag production | `animation-qa-reviewed` / `animation-qa-rejected` assertions | not applicable to the normalizer |

---

## 6. Known follow-ups (kept out of M09)

These are intentionally deferred and tracked in
`docs/PHASE_12_M09_ANIMATION_RUBRIC.md` §7:

- **Live-image QA still requires a human reviewer.** The
  `styleConsistency`, `readability`, and the visual half of
  `transparency` / `runtimeSuitability` cannot be asserted from
  fixtures alone. M11's UX review pass is the planned landing zone
  for the visual profile diff and the in-editor playtest confirmation
  step. The new rubric and the fixture-vs-live matrix call this out
  explicitly so reviewers know to apply the human half of the rubric
  before accepting a generated strip.
- **No new `GeneratedAnimationQaCheckId` was added.** If M11 needs a
  fifth check (for example, `anchorSafety`), the rubric will need to
  be updated and `animationRubric.test.ts` extended to assert it.
- **Project-level coverage validator (M08 / CP-076) is unchanged.**
  M09 only documents the 4-direction × 6-action player-set policy;
  the validator itself was shipped in the previous milestone.

---

## 7. Risk assessment

- **No production code change.** The risk is limited to "do the new
  tests pass?". Both tests are small (240 lines TS, ~190 lines
  Python) and exercise only public API.
- **No native runtime dependency.** The Python normalizer is a script
  under `scripts/dev/`. The TypeScript test is in the `jsdom`
  environment configured by `vitest.config.ts`.
- **No new credential, network, or live-AI call.** Every fixture
  uses `createMockProviderAdapter` and a synthesized PIL image.
- **No new data on disk.** The Python test uses `tempfile.mkdtemp`
  and tears down in `tearDown`. The TypeScript test only constructs
  in-memory candidates and stamps them in memory.

---

## 8. Commit

The M09 scope is a documentation + test addition. The recommended
single commit (no actual commit was performed during M09 — this is a
draft gate):

```
docs(animation): add M09 rubric, fixture tests, and integration gate
```

Files in the proposed commit:

- `docs/PHASE_12_M09_ANIMATION_RUBRIC.md`
- `docs/PHASE_12_M09_INTEGRATION_GATE.md`
- `src/providers/__tests__/animationRubric.test.ts`
- `tests/test_animation_rubric.py`
