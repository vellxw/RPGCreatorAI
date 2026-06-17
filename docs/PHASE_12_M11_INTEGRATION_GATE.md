# M11 — Sprite Sheet and Animation Pipeline Optimization — Integration Gate

> Status: **CLOSED** (commit pending)
>
> Scope: deterministic contract for the sprite sheet and animation pipeline, with fixture tests for the workflow (TS) and the Python normalizer.

## What landed

- `docs/PHASE_12_M11_SPRITE_SHEET_OPTIMIZATION.md` — canonical M11 spec.
- `src/providers/__tests__/spriteSheetOptimization.test.ts` — 6 vitest tests covering missing frame metadata, hardcoded invariants, default draft defaults, mock round-trip, prompt template kind coverage, and no live provider calls.
- `tests/test_sprite_sheet_optimization.py` — 4 unittest tests covering the happy path, manifest frame count match, BMP `#ff00ff` transparency key, and sheet width invariant.

## Validation

```
$ npx tsc --noEmit
(no output)

$ npx vitest run src/providers/__tests__/spriteSheetOptimization.test.ts
Test Files  1 passed (1)
Tests       6 passed (6)

$ python -m unittest tests.test_sprite_sheet_optimization -v
test_happy_path_normalizes_6_frame_32x32_strip_to_runtime_outputs ... ok
test_manifest_frame_count_matches_input ... ok
test_runtime_bmp_uses_magenta_transparency_key ... ok
test_sheet_width_equals_frame_width_times_frame_count ... ok
Ran 4 tests in <time>s
OK

$ npx vitest run
Test Files  144 passed (144)
Tests       908 passed (908)
```

## Files added (with absolute paths)

| Path | Type |
| --- | --- |
| `docs/PHASE_12_M11_SPRITE_SHEET_OPTIMIZATION.md` | Spec doc |
| `docs/PHASE_12_M11_INTEGRATION_GATE.md` | This gate |
| `src/providers/__tests__/spriteSheetOptimization.test.ts` | TS test (6 vitest tests) |
| `tests/test_sprite_sheet_optimization.py` | Python test (4 unittest tests) |

## Known follow-ups

- Live-image QA still requires a human reviewer.
- No new `GeneratedAnimationQaCheckId` was added in M11.
- Project-level coverage validator (M08 / CP-076) is unchanged.
- No live provider call is added.
