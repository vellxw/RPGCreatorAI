# Phase 11 AI Character Animation Integration Gate

Issue: CP-080 / FRA-115
Date: 2026-06-02

## Result

The character and animation generation pipeline is validated as one local,
mock-backed workflow. The gate covers reviewed character concept generation,
sprite sheet generation from that concept, character animation QA, visual QA,
project validation, editor preview rendering, normalized preview/export
fixtures, runtime BMP manifest validation, and native runtime fixture path
coverage.

No live provider call, credential lookup, network request, paid API, native
runtime AI dependency, or cloud dependency is required for normal validation.

## Integrated Pipeline Contract

1. `character-concept-v1` mock generation creates a pending generated concept
   candidate.
2. Review approval produces a generated concept asset with owner provenance.
3. `character-spritesheet-v1` mock generation consumes the reviewed concept as
   source direction.
4. The generated sprite sheet candidate receives explicit character animation
   QA for preview evidence, metadata, coverage, and runtime compatibility.
5. Visual QA is accepted independently and stored alongside animation QA.
6. The accepted generated sprite sheet asset can enter project animation data,
   pass project validation, and render in `AnimationPreview` when a preview URL
   is available.
7. Normalized generated animation fixture `player_adventurer_walk_down` remains
   exported through `data/assets/runtime-manifest.json` to
   `assets/generated/runtime/player_adventurer_walk_down.bmp`.
8. Native `SpriteCatalog` runtime path tests continue to pass against the
   runtime fixture convention.

## Code Changes

CP-080 adds:

- `src/components/database/__tests__/CharacterAnimationPipelineIntegration.test.tsx`
- this integration gate report
- asset pipeline documentation that links the concept, spritesheet,
  normalization, preview, runtime export, and QA review stages
- validation-log and goal-stack updates

No production runtime code changed.

## Evidence

TDD red step:

```powershell
npm test -- --run src/components/database/__tests__/CharacterAnimationPipelineIntegration.test.tsx
```

Result: FAIL before the gate test existed. Vitest reported no matching test
files.

Integration gate test:

```powershell
npm test -- --run src/components/database/__tests__/CharacterAnimationPipelineIntegration.test.tsx
```

Result: PASS, 1 file and 1 test. The test composes real helpers for mock
concept generation, mock sprite sheet generation, animation QA, visual QA,
project validation, editor `AnimationPreview`, runtime manifest lookup, and
runtime BMP existence.

Frontend validation:

```powershell
npm run typecheck
npm test -- --run
npm run build
```

Result: PASS. TypeScript passed. Full Vitest passed 85 files and 454 tests.
Production build completed with 1958 modules transformed and the known
non-fatal Vite chunk-size warning.

Pipeline validation:

```powershell
python -m unittest tests.test_animation_strip_normalization tests.test_animation_preview_generation tests.test_runtime_asset_export tests.test_visual_assets
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/export-runtime-assets.ps1 --validate-only
```

Result: PASS. Python pipeline tests passed 10 tests. Runtime asset export
manifest validation passed.

Native runtime fixture confirmation:

```powershell
ctest --test-dir $env:LOCALAPPDATA\RPGCreatorAI\build --output-on-failure
```

Result: PASS. `RPGTests` passed 1/1.

Live-call/secret scan:

```powershell
rg -n "(fetch|axios|WebSocket|EventSource|XMLHttpRequest|https://api|apiKey|secret|token|sk-)" src\components\database\__tests__\CharacterAnimationPipelineIntegration.test.tsx docs\PHASE_11_CHARACTER_ANIMATION_QA_REVIEW.md src\providers\generatedAnimationQa.ts
```

Result: PASS for CP-080 scope. Matches were limited to test assertions and
documented scan commands; no live-call implementation or secrets were added.

## Known Limits

The integrated generated character used by the new TypeScript gate is
metadata/mock-backed. The checked-in runtime BMP fixture remains the normalized
`player_adventurer_walk_down` generated-character asset from CP-078. Generating
and exporting arbitrary newly accepted editor candidates to runtime BMP remains
the explicit asset pipeline step, not a runtime dependency.

## Next

Milestone 09 is ready to hand off to game-content generation work in CP-081.
