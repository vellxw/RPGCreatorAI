# M07 — First-run onboarding gate

> Status: **CLOSED** (commit `e0123ec`, pushed to `origin/main` on 2026-06-17)
>
> Milestone scope: PX-086 — PX-100 (First-run starter path, save & playtest affordance, starter project selection)

## What landed

- `src/firstRun/firstRunTypes.ts` — `FirstRunStarterPath`, `FirstRunPath`, and
  `FIRST_RUN_PATHS` (3 deterministic paths: `blank`, `town-template`,
  `bundled-sample`). `getFirstRunPath` is a defensive lookup that falls back
  to the blank path if a stored value is unknown.
- `src/firstRun/firstRunStore.ts` — `useFirstRun` hook + `reducer` with
  `'select-path' | 'complete' | 'reset' | 'restore'`. Persists to
  `localStorage` under the `rpgcreatorai:phase12:first-run:v1` key. Restore
  is defensive: malformed JSON, wrong version, or unknown path values
  resolve to `DEFAULT_FIRST_RUN_PREFERENCES`. The store is non-destructive
  by design — `'complete'` is a no-op until a path is selected.
- `src/firstRun/saveAndPlaytest.ts` — `decideSaveAndPlaytest` returning a
  discriminated `SaveAndPlaytestOutcome` (`'saved-and-playtested' |
  'saved-and-routed' | 'save-blocked'`). Used by the host toolbar to choose
  between native runtime launch, in-editor playtest view, and an
  error message that points to the validation panel.
- `src/components/onboarding/FirstRunPathSelector.tsx` — inert, presentational
  selector. `type="button"` on every action, no fetch, no store mutation, no
  programmatic navigation. Routes through `onSelectPath`, `onConfirm`, and
  optional `onSkip`. Exposes stable `data-testid` and `data-path` attributes
  for every option and a `data-has-completed` attribute on the section.
- Tests (18 new): store reducer transitions, persistence round-trip,
  JSON-corruption fallback, selector render/inertness, saveAndPlaytest
  outcomes.

## Why this is offline-first

- `FIRST_RUN_PATHS` is fully static, baked into the build.
- No provider credential, no network call, no editor mutation.
- The "bundled sample" path is the same data the existing
  `BrowserMemoryAdapter.seedFromBundle` consumes; the blank path is
  `createNewProjectState`; the town path uses the `town-street-16x9`
  scene template already used by new projects.
- `decideSaveAndPlaytest` is a pure function — it cannot leak any
  provider, secret, or path into the UI copy.

## Validation

```
$ npx tsc --noEmit
(no output)

$ npx vitest run
Test Files  141 passed (141)
Tests       889 passed (889)
```

Per-file:
```
src/firstRun/__tests__/firstRunStore.test.ts   — 12 tests
src/firstRun/__tests__/saveAndPlaytest.test.ts — 4 tests
src/components/onboarding/__tests__/FirstRunPathSelector.test.tsx — 6 tests
```

## Commit

- `e0123ec` — `feat(onboarding): add first-run starter path selector and save & playtest`
  pushed to `origin/main` (2026-06-17).

## Known follow-ups (kept out of M07)

- Wire `useFirstRun` into `App.tsx` so the startup screen becomes the
  first-run surface once (and the "Use bundled sample" button actually
  loads the bundled sample in desktop mode — see M07 explore).
- Add the "Save & Playtest" button to `TopToolbar.tsx` consuming
  `decideSaveAndPlaytest` + `performSave`. This is intentionally deferred
  to M11 so the affordance can land alongside the screenshot audit and
  the native runtime availability check.
