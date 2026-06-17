# Phase 12 M03 — Pipeline-Aware AI Command Router Integration Gate

Issues covered: PX-056, PX-081, PX-082, PX-083, PX-084, PX-085, FRA-490,
FRA-515, FRA-516, FRA-517, FRA-518, FRA-519, FRA-520.

Date: 2026-06-17

## Goal

Close M03 by giving the AI Studio a typed, preview-first command router that
turns free-form creator messages into structured intents or clarification
requests, and by wiring the AI Studio screen so creators can route their
intent through a single chat input without silent project mutation.

## Implemented Surfaces

### `src/commandRouter/` (router kernel — PX-056)
* `intentContract.ts` — typed `CommandRouterIntent` (read | preview |
  mutation), `CommandRouterPipeline`, weighted keyword inference with
  multi-word tiebreak (PX-056, FRA-490), confidence, rationale, and
  stable id factories. Rounds ties on multi-word hits first, then on
  the longest matching keyword, so a "sprite sheet" mention beats a
  generic "character" mention when both appear in the same message.
* `ambiguity.ts` — clarification option list with stable ids, competing
  pipeline scoring, `isAmbiguous` with `DEFAULT_AMBIGUITY_THRESHOLDS`
  (PX-081, FRA-515), and `buildClarification` helper.
* `previewContract.ts` — `mutationGuard` fail-closed preview-before-apply
  contract, `isApplyable`, preview equivalence, and summary helpers
  (PX-082, FRA-516).
* `router.ts` — `routeCreatorRequest` returns either a typed
  `CommandRouterResult.intent` or a `CommandRouterResult.clarification`.
  Ambiguous or out-of-scope messages always fall back to clarification,
  and mutation intents always carry a preview id and write-intent id.
* `routerTestFixtures.ts` — six deterministic end-to-end fixtures
  (`fx-read-map-summary`, `fx-preview-event`, `fx-mutation-balancing`,
  `fx-ambiguous-help`, `fx-no-project`, `fx-mutation-asset-sprite`)
  with `ROUTER_TEST_FIXTURES_VERSION = "1.0.0"`.

### `src/commandRouter/` (host surfaces — PX-083 / PX-084)
* `ClarificationCard.tsx` (PX-083, FRA-517) — renders the clarification
  question, the original context message in italics, and every option as
  an inert `type="button"` with stable `data-option-id` and
  `data-pipeline` attributes.
* `IntentPreviewCard.tsx` (PX-084, FRA-518) — renders a typed intent as
  a presentational card with a capability badge (read-only, preview
  only, or draft preview required), confidence percentage, target
  label, and rationale. Mutation intents expose `Apply this draft` and
  `Discard draft` buttons; read and preview-only intents expose a
  no-apply note. Never mutates project, never calls providers, never
  navigates.
* `RouterResultCard.tsx` — dispatcher that renders the right
  sub-card for each `CommandRouterResult` kind.
* `useRouteCreatorRequest.ts` — host hook that owns
  `CommandRouterResult` state, mirrors it through a `useRef` so the
  `state` field always reflects the latest `route()` / `clear()` call
  even before the next render commits. Never calls providers, never
  mutates project data, never performs programmatic navigation.

### AI Studio integration
* `src/components/ai/AIStudioScreen.tsx` — adds a router form to the
  chat pane (`data-testid="ai-studio-router-form"`,
  `ai-studio-router-input`, `ai-studio-router-submit`). The submit
  handler builds a `CommandRouterInput` from the bounded project
  context (`selectedMapId`, `selectedEventId`, `selectedDatabaseTable`)
  and calls `router.route(...)`. Results render in a
  `RouterResultCard`. Selecting a clarification option dispatches a
  new route with the chosen pipeline. The host records `route`,
  `clarify`, `clarify-pick`, `apply`, and `reject` activity entries
  through the existing `recordActivity` flow; no provider is ever
  called from this code path.
* `src/components/ai/AIStudioSessionActivity.tsx` — extends
  `AIStudioActivityKind` with `clarify`, `route`, `clarify-pick`, and
  `apply` so the existing activity pane lists router lifecycle events
  alongside cancel/reset.

### Tests
* `src/commandRouter/__tests__/router.test.ts` (26 tests) — id
  factories, type guards, weighted pipeline inference with multi-word
  tiebreak, longest-keyword tiebreak, ambiguity detection, sorted
  pipeline hits, stable clarification options, preview-before-apply
  guard, end-to-end fixtures.
* `src/commandRouter/__tests__/routerComponents.test.tsx` (14 tests) —
  `ClarificationCard`, `IntentPreviewCard`, `RouterResultCard`, and
  `useRouteCreatorRequest` presentational and host behaviors.
* `src/components/ai/__tests__/AIStudioCommandRouterIntegration.test.tsx`
  (7 tests) — end-to-end: form rendering, focused request routing to
  mutation preview, ambiguous request rendering clarification, discard
  flow without project mutation, route activity entry, disabled form
  without a project, and form-safe button types.

## Behavior

The AI Studio chat pane now exposes a single "Route request" form.
When the user submits a message:

1. The host builds a `CommandRouterInput` from the bounded project
   context, never from secrets, paths, or full project dumps.
2. `routeCreatorRequest` classifies the request.
   * **Read-only** messages ("Explain the selected map.") get a
     `ReadOnlyIntent`. The result card shows a read-only summary and
     never offers an apply button.
   * **Mutation** messages ("Rebalance this enemy stats...", "Generate
     a new character sprite sheet...") get a `MutationIntent` with a
     stable preview id and write-intent id. The result card shows
     "Apply this draft" and "Discard draft"; the host records the
     action but does not perform the apply.
   * **Preview-only** messages ("Draft event commands...") get a
     `PreviewOnlyIntent` with a preview but no apply path.
   * **Ambiguous** messages ("Help me with this project.") get a
     `CommandRouterClarification` with every pipeline option. Picking
     an option re-routes the request with the chosen pipeline.
   * **No project** (projectId is `null`) returns a clarification
     asking the user to open or create a project.

The router never mutates project data, never calls providers, never
performs programmatic navigation. The host owns every effect that
follows `onAcceptIntent` and `onSelectClarification`; both are typed as
plain callbacks so the presentational components stay inert.

## Validation

Commands run:

```powershell
npx tsc --noEmit
npx vitest run src/commandRouter/__tests__/
npx vitest run src/components/ai/__tests__/AIStudioCommandRouterIntegration.test.tsx
npx vitest run
```

Result:

* `npx tsc --noEmit` -> PASS, 0 errors.
* `npx vitest run src/commandRouter/__tests__/` -> PASS, **40/40**
  router unit + presentational tests (26 contract tests + 14 component
  tests).
* `npx vitest run src/components/ai/__tests__/AIStudioCommandRouterIntegration.test.tsx`
  -> PASS, **7/7** end-to-end tests.
* `npx vitest run` (full suite) -> PASS, **805/805 tests** (was
  782/782 before this milestone; +23 new tests, 0 regressions).

## Honest Limitations

* The router's classifier is keyword-based, deterministic, and
  intentionally conservative. Multi-round refinement, embedding-based
  classification, and learned confidence calibration are future
  concerns tracked in M10.
* The router ships only the M03 surfaces; the M05 candidate lifecycle
  and M10 refinement loop will extend the presentational components
  with explicit accept/reject/archive/apply hooks and revision
  history.
* The current `Apply this draft` button records an `apply` activity
  entry but does not write back to the project. The actual mutation
  pipeline is a Phase 12 follow-up: the host can dispatch the typed
  intent to a per-pipeline reducer/loader, but the M03 scope is the
  router contract and the inert host surfaces, not the apply
  mechanics.
* Screenshot evidence for the new form, clarification, and preview
  states is captured through the existing editor screenshot audit
  workflow and is logged separately.

## Done When

A creator can type any free-form message into the AI Studio chat
pane, watch the router classify it into a typed intent (read, preview,
or mutation) or ask for clarification, accept or discard mutation
drafts without touching the project, and see every router lifecycle
event in the activity pane — all without any live provider, secret,
project-data, or programmatic-navigation call from the router
surfaces.

The 30 PX-056..PX-085 issues are wired to a router that fails closed
on ambiguous or out-of-scope requests, never mutates the project
without an explicit apply, and keeps every presentational component
inert. The M03 gate is green.
