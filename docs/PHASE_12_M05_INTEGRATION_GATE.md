# Phase 12 — M05 Integration Gate: Review-Gated AI Candidate Lifecycle

**Status:** CLOSED
**Scope:** M05 — Review-Gated AI Candidate Lifecycle
**Commit:** a95ea1e
**Branch:** main

## Objective

Give every AI Studio draft a first-class lifecycle: provenance, review
state, validation, and explicit accept/reject with no silent mutation
of the project. Rejected candidates cannot be re-applied and never
enter runtime data.

## What ships in M05

- `src/aiCandidates/candidateTypes.ts`
  - `Candidate` discriminated union with 9 kinds: `map-draft`,
    `event-draft`, `event-commands`, `database-draft-actor`,
    `database-draft-item`, `asset-draft`, `validation-repair`,
    `balancing`, `quest-draft`.
  - `CandidateReviewState` of `'draft' | 'review' | 'accepted' |
    'rejected' | 'expired'`.
  - `CandidateProvenance` (provider/model/operation/prompt template),
    `CandidateValidation` (errors/warnings), `CandidatePayload`
    (summary/apply actions/output).
  - `CandidateStoreError` union for typed accept/reject errors:
    `already-resolved`, `missing-apply-actions`,
    `invalid-validation`, `unknown-candidate`,
    `blocked-by-provenance`.
- `src/aiCandidates/candidateStore.ts`
  - `useCandidateStore` hook backed by a `useReducer` of typed actions.
  - Safe persistence to `localStorage` (with try/catch around reads
    and writes so a quota failure never crashes the host).
  - `tryAcceptCandidate` and `tryRejectCandidate` pure helpers that
    return a `CandidateTransitionResult` discriminated union
    (`{ ok: true, candidate, event } | { ok: false, error }`).
  - `clearResolved` removes only accepted/rejected/expired candidates
    so the inbox never grows without bound.
- `src/components/ai/AICandidateReviewPanel.tsx`
  - Inert presentational component.
  - Renders reviewable candidates with stable `data-candidate-id`,
    `data-review-state`, `data-kind`, `data-state` attributes.
  - Accept/Reject buttons are `type="button"`.
  - Accept is disabled when validation has errors or the candidate
    is no longer reviewable.
  - Resolved candidates appear in a collapsible `<details>` with the
    reviewer note when present.
  - Does not call providers, stores, or programmatic navigation.
- `src/components/ai/AIStudioScreen.tsx`
  - Mounts `useCandidateStore` at screen level.
  - New dock pane `candidates` rendered via `AIStudioDockLayout`.
  - `handleSeedCandidate` creates a draft candidate for the active
    project (validation errors when no map is selected).
  - `handleAcceptCandidate` invokes the host's
    `onApplyCandidate(candidate)` and records the activity.
  - `handleRejectCandidate` only updates review state and records
    the activity; never mutates the project.
- `src/components/ai/AIStudioDockLayout.tsx`
  - New pane id `'candidates'` with its own tab label, short label,
    and bounded description.

## UX rules preserved

- Buttons are `type="button"` (no implicit form submission).
- Components are inert; side effects route through `onAccept`,
  `onReject`, `onSelectCandidate`, `onApplyCandidate` props.
- Stable `data-*` attributes for state and ids.
- No "Run now", "Execute now", "Deploy" verbs in user-facing copy.
- No paths, no env var names, no credentials in rendered copy.

## Tests added (in this milestone)

- `src/aiCandidates/__tests__/candidateStore.test.ts` — reducer add,
  mark-review, accept, reject, archive, set-validation, clear-resolved,
  runtime guard, error variants.
- `src/components/ai/__tests__/AICandidateReviewPanel.test.tsx` —
  empty state, accept/reject affordances, validation-disabled accept,
  no accept/reject for terminal states, resolved details, inert
  behavior (no provider/store/navigation calls).
- `src/components/ai/__tests__/AIStudioShellIntegration.test.tsx` —
  new test "exposes the candidate review pane in the dock and stays
  inert on seed".
- `src/components/ai/__tests__/AIStudioDockLayout.test.tsx` — updated
  to expect 5 dock panes (added candidates).

## Validation evidence

- `npx tsc --noEmit` — clean
- `npx vitest run` — 136 test files / 851 tests, all green

## Known limitations (carried into M06+)

- "Draft event candidate" is the only seeder surfaced; the panel is
  ready to receive candidates from real provider pipelines in M07+.
- The "advanced affordance" for picking a specific provider/model for
  candidate generation is still pending; the candidate store treats
  provenance as descriptive metadata for now.
- The runtime guard test verifies that a rejected candidate cannot
  be re-accepted; deeper "rejected candidates cannot enter runtime
  data" tests will be authored alongside the live pipeline wiring in
  M07+.

## Recommended next milestone

- M06: Developer Mode (off-by-default, code-assistant outputs are
  proposals/handoffs, no push, no commit, no shell exec, no
  external-path writes).
