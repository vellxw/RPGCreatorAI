# Phase 11 AI Game Content Pipeline Integration Gate

Issue: CP-088 / FRA-123
Date: 2026-06-04

## Result

The AI game-content milestone is validated as one local, mock-backed,
review-gated authoring workflow. The gate covers map drafts, quest drafts,
event command drafts, database drafts, balancing suggestions, validation repair
suggestions, generation history, project validation, save/reload, and selected
event playtest planning.

No live provider call, credential lookup, network request, paid API, native
runtime AI dependency, or cloud dependency is required for normal validation.

## Audit Finding

Linear had marked CP-088 Done, but the closeout cited commit `a95e4cf`, which
is the CP-086 validation repair assistant commit. Repo history had no CP-088 or
FRA-123 commit, and no single integration test proved all content pipelines
could compose into accepted deterministic project data.

The new integration test found a real gap: the map draft mock generated events
with only `id` and `trigger`. Those events could pass the map-draft candidate
validator and enter project data, then `validateProject()` crashed with
`commands is not iterable` instead of reporting or preventing invalid content.

## Integrated Pipeline Contract

The completed CP-088 gate is:

1. Use only the local mock provider for text generation.
2. Generate a map draft and validate candidate map layers, tiles, and complete
   event objects before insertion.
3. Accept the map draft and insert it through `ADD_GENERATED_MAP`.
4. Generate and accept a quest draft, then insert it through database reducer
   actions.
5. Generate and accept event commands, then insert them into the accepted
   generated map event.
6. Generate and accept actor/item database drafts, then insert them through
   reducer actions.
7. Generate and accept balancing adjustments, then apply them through the same
   database/item reducers used by normal editor actions.
8. Generate and accept validation repair guidance without mutating project
   data automatically.
9. Record accepted outputs in `project.generationHistory` with redacted
   context and accepted output links.
10. Validate the composed project, save it, reload it, validate the reloaded
    data, and build a selected-event playtest launch plan for accepted sample
    content.

## Code Changes

CP-088 adds:

- `src/e2e/__tests__/aiContentPipelineIntegration.test.ts`
- this integration gate report
- validation-log and goal-stack updates

CP-088 also repairs:

- `src/providers/mapDraftGenerationWorkflow.ts`
  - mock map events now include complete runtime/editor event shape
  - candidate validation rejects missing event type, coordinates, solid flag,
    trigger, and commands array before approval
- `src/validation/validateMap.ts`
  - project validation now reports malformed event/page command arrays instead
    of throwing

## Evidence

TDD red step:

```powershell
npm test -- --run src/e2e/__tests__/aiContentPipelineIntegration.test.ts
```

Result: FAIL before the fix. The new gate exposed `TypeError: commands is not
iterable` from `validateMap.ts` after an incomplete generated map event entered
the composed project.

Focused integration after fix:

```powershell
npm test -- --run src/e2e/__tests__/aiContentPipelineIntegration.test.ts
```

Result: PASS, 1 file and 1 test.

Focused regression suite:

```powershell
npm test -- --run src/providers/__tests__/mapDraftGenerationWorkflow.test.ts src/validation/__tests__/validateMap.test.ts src/stores/__tests__/projectReducer.test.ts src/e2e/__tests__/editorRoundtrip.test.ts src/e2e/__tests__/aiContentPipelineIntegration.test.ts
```

Result: PASS, 5 files and 63 tests.

TypeScript:

```powershell
npm run typecheck
```

Result: PASS after completing the test harness with the real editor-state
shape.

Full canonical gate:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1
```

Result: PASS. Gates passed: frontend typecheck, full Vitest (98 files / 507
tests), frontend build, native C++ configure/build/CTest, Tauri content check,
43 Rust desktop tests, runtime smoke, and editor-runtime screenshot roundtrip.
Known nonfatal warnings were the existing Vite chunk-size warning and CMake
FetchContent/deprecation warnings.

## Known Limits

The CP-088 gate is mock-backed and validates deterministic accepted project
data. Live provider calls remain explicit opt-in diagnostics only. The native
runtime remains unchanged and consumes only saved project JSON and accepted
local assets.

## Next

Milestone 10 can hand off to provider reliability and multi-provider work
starting at CP-089.
