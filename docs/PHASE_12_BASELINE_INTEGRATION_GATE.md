# Phase 12 Baseline Integration Gate

Issue: PX-010 / FRA-444
Date: 2026-06-08

## Result

M00 is green. Phase 12 baseline framing is versioned, Linear evidence exists
for `PX-001` through `PX-009`, and later UI implementation work can begin
without unresolved baseline ambiguity.

This gate also updates `AGENTS.md` phase framing from Phase 11 to Phase 12 so
the root agent instructions, `docs/GOAL_STACK.md`, Linear, and the Phase 12
roadmap agree on the active phase.

## Linear Evidence Review

Linear issue statuses and evidence comments were reviewed for `PX-001`
through `PX-009`.

| Issue | Linear ID | Status | Commit | Evidence |
| --- | --- | --- | --- | --- |
| PX-001 Product UX Audit From User Feedback | FRA-435 | Done | `1ff9ef8` | Final comment records source/docs inspection, `npm run typecheck`, focused UI tests, commit, and push. |
| PX-002 Current Provider And Model Settings UX Audit | FRA-436 | Done | `3a79d99` | Final comment records provider/settings/credential inspections, focused tests, secret scan, commit, and push. |
| PX-003 Current Launcher And Startup Path Audit | FRA-437 | Done | `1f37325` | Final comment records launcher/startup inspections, focused tests, branding check, skipped package smoke rationale, commit, and push. |
| PX-004 Existing AI Pipeline Inventory | FRA-438 | Done | `da675bf` | Final comment records provider/content pipeline inspections, offline AI/provider tests, secret scan, commit, and push. |
| PX-005 Existing Asset And Animation Pipeline Inventory | FRA-439 | Done | `03c15f5` | Final comment records asset/animation pipeline inspections, focused tests, Python/script validation, secret scan, commit, and push. |
| PX-006 Phase 11 Baseline Verification | FRA-440 | Done | `c9102dc` | Final comment records branch/origin/dirty-worktree evidence and full `scripts/dev/verify.ps1` PASS. |
| PX-007 Product UX Principles For Creator-First AI | FRA-441 | Done | `4b169e4` | Final comment records principles doc, typecheck, placeholder/secret/diff checks, and false-positive scan handling. |
| PX-008 Phase 12 Roadmap And Success Metrics | FRA-442 | Done | `93a80c4` | Final comment records roadmap, GOAL_STACK update, typecheck, docs scans, false-positive scan handling, commit, and push. |
| PX-009 Phase 12 Risk Register | FRA-443 | Done | `41c7efb` | Final comment records risk register, typecheck, placeholder/secret/diff checks, commit, and push. |

## Versioned M00 Artifacts

| Artifact | Owner issue | Gate status |
| --- | --- | --- |
| `docs/PHASE_12_PRODUCT_UX_AUDIT.md` | PX-001 | Present |
| `docs/PHASE_12_PROVIDER_MODEL_SETTINGS_UX_AUDIT.md` | PX-002 | Present |
| `docs/PHASE_12_LAUNCHER_STARTUP_PATH_AUDIT.md` | PX-003 | Present |
| `docs/PHASE_12_AI_PIPELINE_INVENTORY.md` | PX-004 | Present |
| `docs/PHASE_12_ASSET_ANIMATION_PIPELINE_INVENTORY.md` | PX-005 | Present |
| `docs/PHASE_12_PHASE_11_BASELINE_VERIFICATION.md` | PX-006 | Present |
| `docs/PHASE_12_CREATOR_FIRST_AI_UX_PRINCIPLES.md` | PX-007 | Present |
| `docs/PHASE_12_ROADMAP_SUCCESS_METRICS.md` | PX-008 | Present |
| `docs/PHASE_12_RISK_REGISTER.md` | PX-009 | Present |
| `docs/GOAL_STACK.md` Phase 12 active section | PX-008 | Present |
| `AGENTS.md` Phase 12 active section | PX-010 | Present |
| `docs/VALIDATION_LOG.md` entries for PX-001 through PX-009 | PX-001 through PX-009 | Present |

## Coherence Checks

- `docs/GOAL_STACK.md` now identifies Phase 12 as active and lists M00 through
  M12 open subgoals.
- `AGENTS.md` now identifies Phase 12 as active and points future agents to
  the Phase 12 roadmap and risk register.
- `docs/PHASE_12_PHASE_11_BASELINE_VERIFICATION.md` records the earlier PX-006
  baseline observation that `GOAL_STACK.md` was stale at the time. That
  observation is historical and is resolved by PX-008 plus this PX-010
  `AGENTS.md` update.
- The roadmap, principles, inventories, risk register, and validation log all
  preserve the same boundaries: local-first product, no runtime AI dependency,
  no live paid provider calls during normal validation, review-gated AI
  candidates, and issue-scoped validation evidence.
- The Linear review confirms M00 issues were closed sequentially with evidence
  comments and commit hashes.

## Validation Executed

The gate validation is docs/typecheck focused because M00 changes are
documentation and phase-framing changes, not runtime/editor behavior changes.

Commands executed for PX-010 are recorded in `docs/VALIDATION_LOG.md`.

Required checks:

- `git status --short --branch`
- `npm run typecheck`
- M00 artifact presence check
- validation-log entry coverage check
- placeholder scan for edited M00 docs
- secret-like value scan for edited M00 docs
- `git diff --check` for PX-010 edited files

## Known Limitations

- The worktree still contains preserved unrelated unstaged changes from the
  created-project visual hotfix area and untracked `.commandcode/taste/` plus
  `output/`. These are documented in PX-006 and are not staged by PX-010.
- Package smoke is not rerun for PX-010. M00 is a baseline documentation gate;
  the full Phase 11 canonical verification was run in PX-006, and launch work
  resumes in M01.
- No live provider diagnostics were run. Normal Phase 12 validation remains
  mock/offline unless a later issue and user-provided credentials explicitly
  define a separate diagnostic.

## Gate Decision

M00 is complete. Phase 12 can proceed to M01 launcher/startup implementation
with the following baseline controls in force:

- use creator-first UX principles for UI work
- keep providers behind optional/advanced boundaries
- route AI work through review-gated candidates
- keep native runtime provider-independent
- validate each issue with exact commands and log results
- preserve issue-by-issue Linear evidence and commit discipline
