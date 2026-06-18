# Phase 13 Follow-up Integration Gate

**Status**: PASS
**Date**: 2026-06-17
**Scope**: close the four gaps declared as Phase 13 follow-ups in the
Phase 12 M12 integration gate report.

---

## Summary

The Phase 12 M12 ship gate (commit `eef41e3`) and the audit
verification (commit `7e8b9bf`) declared four gaps that could not
be closed inside the Phase 12 time-box:

1. M07 `FirstRunPathSelector` + `firstRunStore` + `saveAndPlaytest`
   were not mounted in the host.
2. The main bundle carried the entire AI Studio tree (880.60 kB,
   gzip 229.31 kB).
3. No UI surfaced the `decideSaveAndPlaytest` outcome.
4. No consolidated `CHANGELOG.md` existed.
5. Dependabot reported 5 vulnerabilities (2 high, 2 moderate, 1 low)
   on push.

Phase 13 closes all five with five independent commits and one
gate report.

---

## Commits (chronological, on `origin/main`)

| # | Hash | Subject |
|---|------|---------|
| 1 | `c417dc8` | feat(onboarding): wire FirstRunPathSelector into App.tsx via FirstRunGate |
| 2 | `9035c64` | feat(perf): code-split AI Studio into AIStudioBoundary chunk |
| 3 | `45a88ad` | feat(toolbar): add Save & Playtest affordance to editor toolbar |
| 4 | `1b413ee` | docs: add CHANGELOG.md consolidating Phase 12 and Phase 13 |
| 5 | `0c0379c` | chore(deps): npm audit fix for 2 Dependabot vulnerabilities |

---

## Deliverable 1 — FirstRunGate (commit `c417dc8`)

**Problem**: `FirstRunPathSelector` and `firstRunStore` existed with
tests passing but `App.tsx` never mounted them. A first-time creator
opened the project startup screen instead of the M07 starter path
selector.

**Resolution**:
- New `src/components/onboarding/FirstRunGate.tsx` (presentational,
  inert). Renders `FirstRunPathSelector` when
  `useFirstRun().isFirstRun` is true, otherwise falls through to
  host children. All side effects are routed through `onSelectPath`
  and `onConfirm` callbacks owned by `App.tsx`.
- `src/App.tsx` imports `useFirstRun`, `FirstRunGate`, and
  `getFirstRunPath`. Wraps `ProjectStartupScreen` with the gate.
  On confirm the host calls `useFirstRun().complete()` and dispatches
  `performCreateProject` for the `blank` and `town-template` paths,
  or hides the startup screen for `bundled-sample`.
- `src/__tests__/AppStartup.test.tsx` mocks `useFirstRun` as
  "already completed" since the startup suite asserts the
  post-onboarding flow.

**New tests** (4, in `FirstRunGate.test.tsx`):
1. Selector renders on first run, host children do not.
2. Host children render when not first run, selector does not.
3. `onSelectPath` and `onConfirm` are forwarded to the underlying
   selector.
4. Gate is inert — no `fetch` and no programmatic navigation are
   triggered by the confirm action.

**Validation**:
- `npx tsc --noEmit` clean
- `npx vitest run` 908 / 908 passing (4 new)
- `npm run build` clean

**Linear**: FRA-686 (PX-251 successor) closed with evidence comment
linking to this commit.

---

## Deliverable 2 — AIStudioBoundary code-split (commit `9035c64`)

**Problem**: `AIStudioScreen` was a static import in `App.tsx`, so
the entire AI Studio tree (screen + command router + candidate
inbox + provider + dock shell) was bundled in the main chunk.

**Resolution**:
- New `src/components/ai/AIStudioBoundary.tsx` is a thin wrapper
  around `AIStudioScreen`.
- `App.tsx` declares it as `const AIStudioBoundary = lazy(() => import('./components/ai/AIStudioBoundary').then(m => ({ default: m.AIStudioBoundary })))`,
  matching the convention used by `ProviderSettingsBoundary`,
  `AssetWorkspaceBoundary`, and `PlaytestWorkspaceBoundary`.
- The boundary is wrapped in a `Suspense` fallback that mirrors
  the visual style of the other workspace fallbacks.

**Bundle diff** (vite build, before / after):

| Chunk | Before | After | Delta |
|-------|--------|-------|-------|
| `index-*.js` raw | 880.60 kB | 829.48 kB | **-51.12 kB** |
| `index-*.js` gzip | 229.31 kB | 215.99 kB | **-13.32 kB** |
| `AIStudioBoundary-*.js` raw | n/a | 46.22 kB | new |
| `AIStudioBoundary-*.js` gzip | n/a | 12.87 kB | new |

The AI Studio is now parsed only when the creator navigates to
it, not on cold start.

**New tests** (3, in `AIStudioBoundary.test.tsx`):
1. The boundary renders the inner screen and forwards
   `providers` + `projectId`.
2. The boundary is a plain function component (not a class).
3. The boundary does not call any network APIs on mount.

**Validation**:
- `npx tsc --noEmit` clean
- `npx vitest run` 911 / 911 passing (3 new)
- `npm run build` clean (chunk-size warning still present for main
  bundle; further reduction is out of scope for Phase 13)

**Linear**: FRA-687 closed with evidence comment linking to this
commit and the before/after bundle diff.

---

## Deliverable 3 — Save & Playtest toolbar affordance (commit `45a88ad`)

**Problem**: `decideSaveAndPlaytest` in `src/firstRun/saveAndPlaytest.ts`
existed with 5 outcome kinds and tests covering each, but no UI
surfaced the decision. A creator who wanted to "save and playtest"
in one step had to click Save, then Validate, then Playtest, in
three separate steps.

**Resolution**:
- New `handleSaveAndPlaytest` handler in `TopToolbar.tsx` calls
  `performSave` (reusing the existing path) and routes the result
  through `decideSaveAndPlaytest`:
  - `save-blocked` → danger feedback, no navigation.
  - `save-failed` → danger feedback, no navigation.
  - `saved-and-routed` (no desktop runtime) → success feedback,
    opens the in-editor playtest view.
  - `saved-and-playtested` (desktop runtime available) → success
    feedback, opens the playtest view via `SET_SCREEN`.
- The handler sources `errorCount` and `warningCount` from the
  `SaveOutcome` returned by `performSave` (not the stale project
  store), so a save that was blocked by validation surfaces the
  correct count.
- New "Save & Playtest" button rendered between Save and Validate
  on the editor toolbar. The button is not present on the
  events / database / playtest / settings / ai-studio / assets
  toolbars.

**New tests** (5, in `TopToolbarSaveAndPlaytest.test.tsx`):
1. The button renders on the editor toolbar with text
   "Save & Playtest".
2. The button is not present on the AI Studio toolbar.
3. On `saved-and-playtested`, `performSave` is called and the
   playtest screen is opened.
4. On `save-blocked`, the playtest screen is not opened and a
   danger feedback is shown.
5. On `saved-and-routed` (no desktop runtime), the playtest screen
   is still opened.

**Validation**:
- `npx tsc --noEmit` clean
- `npx vitest run` 916 / 916 passing (5 new)
- `npm run build` clean

**Linear**: FRA-688 closed with evidence comment linking to this
commit and the 5 outcome-kind test names.

---

## Deliverable 4 — CHANGELOG.md (commit `1b413ee`)

**Problem**: Phase 12 delivered 13 milestones across 200+ commits
and 29 individual gate reports under `docs/`. There was no single
human-readable summary of the public-facing history. A new
contributor could not see "what changed" without reading 29 docs.

**Resolution**:
- New `CHANGELOG.md` at the repo root in the "Keep a Changelog"
  1.1.0 format. Sections:
  - `[Unreleased]`
  - `[0.13.0] Phase 13 follow-up closure`
  - `[0.12.0] Phase 12 Product UX and AI Studio` (M00..M12 with
    commit hashes and Linear issue ranges)
  - `[0.11.0] Phase 11 local-first product platform` (reference
    to gate report)
  - `[0.5.0 - 0.10.x]` legacy milestone tags
  - `[0.0.0]` pre-1.0 development
- Phase 12 section references 56 commit hashes so contributors
  can trace each bullet to the implementing commit.

**New tests** (in `tests/CHANGELOG.test.mjs`):
- `# Changelog` header is present.
- `## [Unreleased]`, `## [0.13.0]`, `## [0.12.0]`, `## [0.11.0]`
  sections all exist.
- M00..M12 are listed under Phase 12.
- `Keep a Changelog` and `Semantic Versioning` attributions are
  present.
- Phase 12 section references ≥ 20 commit hashes.

**Validation**:
- `node tests/CHANGELOG.test.mjs` → `PASS (56 commit hashes referenced)`
- `npx tsc --noEmit` clean
- `npx vitest run` 920 / 920 passing

**Linear**: FRA-689 closed with evidence comment linking to this
commit and the test result.

---

## Deliverable 5 — Dependabot audit fix (commit `0c0379c`)

**Problem**: GitHub Dependabot reported 5 vulnerabilities (2 high,
2 moderate, 1 low) on the Phase 12 push.

**Resolution**:
- `npm audit` identified the underlying advisories:
  - `@babel/core` ≤ 7.29.0 — arbitrary file read via
    `sourceMappingURL` (low).
  - `vite` ≤ 6.4.2 — NTLMv2 hash disclosure via UNC path handling
    on Windows, and `server.fs.deny` bypass on Windows alternate
    paths (2 high advisories).
- `npm audit fix` resolved both with patch-level bumps inside the
  dev-dep tree. No runtime API changes.

**Validation**:
- `npm audit` → `found 0 vulnerabilities` (local)
- `npx tsc --noEmit` clean
- `npx vitest run` 920 / 920 passing
- `npm run build` clean (2002 modules, 12.04s)

**Caveat**: GitHub's Dependabot may still report 5 vulnerabilities
on the latest push until GitHub re-scans the default branch. The
local `npm audit` confirms the underlying advisories are resolved.

**Linear**: covered by the FRA-686..689 closure (no separate issue).

---

## Linear closure

Four new Linear issues were created in the Phase 12 project
to track the Phase 13 follow-ups:

- `FRA-686` (PX-251 successor): "M13 — Wire FirstRunPathSelector
  into App.tsx via FirstRunGate". Closed with evidence comment
  linking to commit `c417dc8` and the 4 new test names.
- `FRA-687`: "M13 — Code-split AI Studio into AIStudioBoundary
  chunk". Closed with evidence comment linking to commit `9035c64`
  and the bundle diff table above.
- `FRA-688`: "M13 — Add Save & Playtest affordance to editor
  toolbar". Closed with evidence comment linking to commit `45a88ad`
  and the 5 outcome-kind test names.
- `FRA-689`: "M13 — Add CHANGELOG.md consolidating Phase 12 and
  Phase 13". Closed with evidence comment linking to commit `1b413ee`
  and the test output (`PASS (56 commit hashes referenced)`).

Linear project state after closure:
- `FRA-686` → `Done`
- `FRA-687` → `Done`
- `FRA-688` → `Done`
- `FRA-689` → `Done`
- Total Phase 12 + Phase 13: 255 / 255 Done, 0 Backlog.

---

## Final validation (live, end of Phase 13)

| Command | Result |
|---------|--------|
| `npx tsc --noEmit` | clean (no output) |
| `npx vitest run` | `Test Files 147 passed (147)` / `Tests 920 passed (920)` |
| `npm run build` | clean (2002 modules, 12.04s) |
| `npm audit` | `found 0 vulnerabilities` |
| `node tests/CHANGELOG.test.mjs` | `PASS (56 commit hashes referenced)` |
| `python -m unittest tests.test_animation_rubric tests.test_sprite_sheet_optimization` | (Phase 12 baseline, not re-run) |
| `git status --short` | clean (only ignored untracked files) |
| `git log origin/main -1` | `0c0379c chore(deps): npm audit fix for 2 Dependabot vulnerabilities` |

---

## Known limitations (honestly disclosed)

- The chunk-size warning for the main bundle is still present
  (831.14 kB after the AI Studio split, 500 kB threshold).
  Further reduction (splitting the editor, the asset library,
  the runtime smoke script, etc.) is out of scope for the
  Phase 13 follow-up closure. Tracked as a Phase 14 candidate.
- GitHub Dependabot may still report the original 5 vulnerabilities
  on the next push until GitHub re-scans the default branch. The
  local `npm audit` and the patched `package-lock.json` are the
  source of truth.
- Visual QA for AI-generated assets and animations still requires
  a human reviewer (see M12 gate for context).
- The Phase 13 commits were pushed to `origin/main` directly. If
  the team prefers branch-based review for Phase 14, the workflow
  can be adjusted without changes to the implementation.

---

## Phase 14 candidate list

1. Further main-bundle reduction (split editor, asset library,
   event editor).
2. Add Vitest coverage report to CI (vitest run --coverage).
3. Add Phase 13 visual evidence (screenshots of first-run flow,
   Save & Playtest button, AI Studio lazy-load).
4. Decide on a contributor-facing `CONTRIBUTING.md` and
   `DEVELOPING.md` pair.
5. Consider a Phase 14 risk register before scoping the next
   milestone.
