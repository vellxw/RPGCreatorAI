# M10 — Multi-Round Asset Refinement Pipeline

> Status: **CLOSED** (commit pending)
>
> Milestone scope: PX-206 through PX-225 (Multi-round planner/generator/checker/refiner loops with cost guardrails and review integration)

## What landed

- `src/providers/refinementPipeline.ts` — provider-agnostic multi-round pipeline. Exports:
  - `RefinementPhase` — the 8 phase kinds (`plan`, `generate`, `check`, `refine`, `verify`, `accept`, `reject`, `budget-blocked`).
  - `RefinementBudget` and `DEFAULT_REFINEMENT_BUDGET` — `maxSteps`, `maxCostUsd`, `maxRefineRounds`, `requireUserConfirmationAbove`, `requireUserConfirmationKind`.
  - `RefinementPlan`, `RefinementRun`, `RefinementStep`, `RefinementDraft` — the immutable step log + status surface.
  - `planRefinementRun(draft, budget?)` — pure planner. Returns the deterministic phase sequence and the budget.
  - `executeRefinementRun(plan, executor, options?)` — runs the plan with any `RefinementExecutor` and produces a `RefinementRun`. Stops on `budget-blocked` (cost or refine-round overflow) or `rejected` (verify fail).
  - `shouldRequireUserConfirmation(costEstimate, budget)` — pure function returning `{ required, reason }`.
  - `isBudgetBlocked(run, budget?)` — pure function that returns true if cost, step count, or refine count overflows.
  - `createMockRefinementExecutor({ alwaysFailCheck?, alwaysFailVerify?, costPerStep? })` — fixture executor for tests.
  - `buildRefinementProviderRequest(draft, phase)` and `makeOfflineRefinementExecutor(adapter?)` — the offline adapter-backed executor used by the "no live provider" test.
- Tests: `src/providers/__tests__/refinementPipeline.test.ts` (10 vitest tests):
  1. `planRefinementRun` produces a deterministic phase sequence.
  2. `planRefinementRun` respects a custom budget.
  3. `shouldRequireUserConfirmation` returns a reason above the threshold.
  4. `shouldRequireUserConfirmation` is silent at or below the threshold.
  5. `isBudgetBlocked` detects cost overflow and refine-round overflow.
  6. Happy path: every check passes and the run is accepted.
  7. `maxRefineRounds` is enforced and a run with a failing check is rejected via the verify step (no third refine, no runaway loop).
  8. Per-step cost overflow blocks the run before the next step.
  9. **No live provider call** — the offline mock executor is used; no `fetch` is invoked; no API key/endpoint appears in the request payload.
  10. `buildRefinementProviderRequest` targets the offline `local`/`offline-image-mock` route.

## Why this is offline-first

- The default executor (`makeOfflineRefinementExecutor`) targets `local` / `offline-image-mock`.
- The `executeRefinementRun` function never resolves to a real network call — it just orchestrates the executor's output.
- The test suite explicitly asserts `fetch` is never called.
- The pipeline does not import or depend on any live provider code path.

## Validation

```
$ npx tsc --noEmit
(no output)

$ npx vitest run src/providers/__tests__/refinementPipeline.test.ts
Test Files  1 passed (1)
Tests       10 passed (10)

$ npx vitest run
Test Files  143 passed (143)
Tests       902 passed (902)
```

## Mapping back to M08

- The M08 recommendation ("bounded planner → generator → checker → refiner") is the contract `executeRefinementRun` implements.
- The M08 cost guardrails (max retries, per-session cap, confirmation above threshold) are the `RefinementBudget` fields.
- The M08 "no live call" policy is enforced by the test `never calls a live provider`.

## Out-of-scope follow-ups

- Hook the pipeline into the existing M05 `candidateStore` so an accepted refinement creates a `CandidateRecord` of kind `accepted` with the step log persisted. Tracked in M12.
- Wire the `requiresUserConfirmation` flag to a Settings-driven confirm dialog. The `ProviderCostBudgetPanel` already surfaces cost guidance and is the natural host.
- Add live-image QA (`styleConsistency`, `readability`) as a non-blocking warning field on the `RefinementStep` so the reviewer can see them in the accept step.
