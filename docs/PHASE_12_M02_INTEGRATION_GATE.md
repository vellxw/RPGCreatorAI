# Phase 12 M02 — AI Studio Shell And Project-Aware Chat Integration Gate

Issues covered: FRA-465 (PX-031), FRA-467 (PX-033), FRA-468 (PX-034), FRA-469 (PX-035),
FRA-485 (PX-051), FRA-487 (PX-053), FRA-488 (PX-054), FRA-489 (PX-055).

Date: 2026-06-17

## Goal

Close M02 by verifying the AI Studio dock shell, project context binding, selected map / event
binding, keyboard accessibility, focused component and integration tests, and screenshot
evidence work together as one coherent workspace.

## Implemented Surfaces

* `src/components/ai/AIStudioDockLayout.tsx` — dock with `context`, `chat`, `queue`, `activity`
  panes, `data-pane`, `aria-selected`, `role="tablist"` and `role="tabpanel"`, with a
  forwarded `onKeyDown` for arrow-key navigation between panes.
* `src/components/ai/AIStudioContextPanel.tsx` — bounded project context view with stable
  `data-state`, `data-context-section`, and explicit no-project / loading / ready states.
* `src/components/ai/projectContext.ts` — typed `ProjectContext` model and `buildProjectContext`
  helper that returns `null` when there is no project.
* `src/components/ai/AIStudioSessionActivity.tsx` — recent accept / reject / archive / cancel
  / reset activity list, with `data-activity-id` and `data-activity-kind` per entry.
* `src/components/ai/AIStudioScreen.tsx` — host that wires context, chat, queue, and activity
  panes, selects a pane via state, forwards arrow-key navigation, records session activity,
  and never mutates project or calls providers directly.
* `src/components/ai/__tests__/AIStudioDockLayout.test.tsx` — 6 tests covering tabs, panel
  visibility, callbacks, aria-selected, key forwarding, and inertness.
* `src/components/ai/__tests__/AIStudioContextPanel.test.tsx` — 4 tests covering each state
  and redaction safety.
* `src/components/ai/__tests__/AIStudioSessionActivity.test.tsx` — 2 tests for empty and
  populated states.
* `src/components/ai/__tests__/AIStudioShellIntegration.test.tsx` — 7 tests covering dock
  navigation, context binding, no-project state, session activity recording, and shell
  inertness.

## Areas

* `AIStudioScreen` receives `projectId`, `projectTitle`, `mapCount`, `eventCount`,
  `validationStatus`, `selectedMap`, `selectedEvent`, and `database` so map, event, and
  database context bindings reach the AI Studio without changing the existing empty / chat /
  queue / activity behavior.
* The dock shell is the new container for the AI Studio and remains a workspace, not a modal
  or full-screen takeover.
* All AI Studio components keep the presentational rules from the project taste: `type="button"`,
  no provider / store / navigation calls inside the component, no "Run now" / "Execute now"
  verbs, stable `data-*` attributes.

## Validation

Commands run:

```powershell
npx tsc --noEmit
npx vitest run src/components/ai/__tests__/
```

Result: typecheck clean, **129 / 129 AI Studio tests pass** (110 pre-existing + 19 new tests
added in this milestone close).

Broader validation:

```powershell
npm run typecheck
npm test
```

Result: typecheck clean, **758 / 758 tests pass** (739 pre-existing + 19 new tests added in
this milestone close).

## Honest Limitations

* Screenshot evidence is captured manually by the existing desktop startup harness and is not
  re-captured in this gate report. Visual QA across `docs/screenshots/phase12-m02/` is logged
  in `docs/PHASE_12_PRODUCT_UX_AUDIT.md` separately.
* The session activity list is in-memory only; persisting it across reloads is a future M05
  candidate lifecycle concern and is explicitly out of scope for the M02 gate.

## Done When

AI Studio is a visible dock shell with project context, selected map / event context, and
session activity panes, all keyboard-accessible, inert by default, and covered by 19 focused
component and integration tests.
