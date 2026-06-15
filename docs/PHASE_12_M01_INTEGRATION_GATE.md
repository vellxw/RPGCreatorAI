# M01 — Launcher, Desktop Entry, Splash, And Startup UX Integration Gate

Issue: PX-030 / FRA-464
Date: 2026-06-15

## Result

M01 is green. The desktop entry, launcher, splash, startup phases, recent
project restore, recovery, lazy-loading boundaries, accessibility,
loading feedback, and smoke coverage are all in place behind one coherent
product entry experience, and Phase 12 can proceed to M02 (AI Studio
Shell And Project-Aware Chat).

This gate also closes the prior In Progress state of FRA-464 (started
2026-06-13 and paused before smoke + report). The remaining
deliverables for the gate are: gather the M01 evidence table, run a
final M01-wide validation, write this report, commit/push, and post
the Linear evidence comment before moving FRA-464 to Done.

## Linear Evidence Review

All PX-011 through PX-029 issues were audited for Done status, closure
comment with commands, results, files, and commit hash.

| Issue | Linear ID | Status | Commit | Evidence |
| --- | --- | --- | --- | --- |
| PX-011 App Icon And Branding Asset Audit | FRA-445 | Done | `b22ca09` | Branding/launcher docs and audit updated; placeholder/secret/diff scans and targeted validation passed. |
| PX-012 Windows Double-Click Executable Path | FRA-446 | Done | `fc75e73` | Packaged executable path is documented; colocated runtime discovery and launch smoke captured. |
| PX-013 Desktop Shortcut And Start Menu Guidance Prototype | FRA-447 | Done | `4205521` | Shortcut helper script with dry-run; launcher docs updated. |
| PX-014 Instant Splash Screen Shell | FRA-448 | Done | `2e8d607` | Splash shell renders before heavier editor/provider/asset work; typecheck and focused tests passed. |
| PX-015 Startup Loading Phase State Machine | FRA-449 | Done | `6f763d7` | Deterministic phase model; tests cover transitions and lazy boundaries. |
| PX-016 Recent Project Restore Startup Flow | FRA-450 | Done | `b305dbe` | Recent restore with explicit pending/feedback states; missing/invalid case covered by recovery. |
| PX-017 Runtime Availability Startup Check | FRA-451 | Done | `b9260f0` | Runtime readiness exposed without blocking editor; desktop/browser states distinct. |
| PX-018 Provider Hub Lazy Load Boundary | FRA-452 | Done | `6457bf6` | Provider hub initialization deferred; beginner state stays inert. |
| PX-019 Asset Thumbnail Lazy Load Boundary | FRA-453 | Done | `356d26a` | Asset thumbnails deferred past first paint; stable empty/loading states covered. |
| PX-020 Diagnostics Panels Lazy Load Boundary | FRA-454 | Done | `a4e9c22` | Playtest diagnostics moved out of startup critical path. |
| PX-021 First Paint Performance Budget | FRA-455 | Done | `0422f5b` | `scripts/dev/measure-first-paint.ps1` records splash/FCP/DOMContentLoaded; budget thresholds set. |
| PX-022 Startup Error Recovery States | FRA-456 | Done | `aa85878` | Recovery states for missing/invalid project, filesystem adapter, runtime diagnostics, provider hub. |
| PX-023 Startup Splash Accessibility And Keyboard Behavior | FRA-457 | Done | `753e995` | Semantic status, focus order, reduced-motion, no keyboard traps. |
| PX-024 Startup Project Selection Loading Feedback | FRA-458 | Done | `c1609e6` | Open/Create/Import have specific busy copy and disabled controls; ARIA `status` + `aria-busy`. |
| PX-025 Packaged Prototype Launch Smoke | FRA-459 | Done | `cd1c9bb` | `scripts/dev/smoke-packaged-executable-launch.ps1` PASS; pid recorded; honest warning set documented. |
| PX-026 Desktop Launch Screenshot Evidence | FRA-460 | Done | `a1295ad` | Two PNGs with SHA-256/dimensions/bytes recorded; no recovery screenshot fabricated. |
| PX-027 Launch Docs For Non-Terminal Users | FRA-461 | Done | `0028cd9` | README, BUILD_AND_RUN, WINDOWS_BUILD_NOTES updated; advanced dev commands kept separate. |
| PX-028 App Logo Icon Metadata Verification | FRA-462 | Done | `0e105ef` | Title/favicon fixed; `scripts/dev/verify-branding-assets.ps1` extended; focused tests pass. |
| PX-029 Startup UX Tests And Smoke Harness | FRA-463 | Done | `0de184a` | Browser harness now fetches and validates pre-React splash HTML; focused M01 matrix 29 tests pass. |

## Coherence Checks

- The M01 evidence docs form a coherent set: launcher audit
  (`docs/PHASE_12_LAUNCHER_STARTUP_PATH_AUDIT.md`), branding audit
  (`docs/PHASE_12_APP_ICON_BRANDING_AUDIT.md`), and desktop screenshot
  evidence (`docs/PHASE_12_DESKTOP_STARTUP_SCREENSHOT_EVIDENCE.md`).
- Lazy boundaries respect the local-first/no-runtime-AI boundary
  from M00 (PX-008 + PX-007 + PX-009): no startup path requires
  live provider credentials; provider hub, asset thumbnails, and
  diagnostics are deferred behind explicit gates.
- The startup phase model (PX-015), recovery states (PX-022), and
  loading feedback (PX-024) integrate so that pending/recovery copy
  is consistent and does not block creator-first UX.
- Accessibility behavior (PX-023) is consistent with the product UX
  principles (PX-007): no infrastructure jargon, focus order, status
  roles, and reduced-motion.
- Performance budget (PX-021) is measured locally with
  `scripts/dev/measure-first-paint.ps1` and respects the no-paid-service
  rule (no live diagnostics, no Computer Use).

## Validation Executed

The M01 gate validation is docs/frontend focused because the M01
work is splash/launcher/UI and prior C++ runtime is not in scope.

Commands executed for PX-030:

- `git status --short --branch` — clean except for
  `.commandcode/taste/`, `.playwright-cli/`, `output/`, and the
  untracked `docs/analysis/` directory. None of those are M01 scope.
- `npm run typecheck` — PASS; `tsc --noEmit` completed with no
  diagnostics.
- `npm test -- --run src/__tests__/AppStartup.test.tsx
  src/components/project/__tests__/ProjectStartupScreen.test.tsx
  src/startup/__tests__/startupRecovery.test.ts` — PASS, 3 files /
  25 tests.
- `git log --oneline -30` — confirms all PX-011..PX-029 commits are
  present in the local history and on `origin/main`.
- `git rev-parse HEAD` vs `git rev-parse origin/main` — both report
  `cbca94eca48501ffae8df9d16ce275608188b60c`; no divergence.

A combined M01 commit range `b22ca09..0de184a` is in `origin/main`
and matches the Linear evidence table above.

## Known Limitations

- The M01 commits were produced sequentially and each individual
  PX-011..PX-029 was pushed to `origin/main` already. PX-030 itself
  is a documentation/audit gate, not a code change.
- Pre-existing preserved unrelated worktree items
  (`.commandcode/taste/`, `.playwright-cli/`, `output/`, and the
  untracked `docs/analysis/` technical audit) are out of scope for
  M01 and are not staged. They are documented in PX-006 / M00.
- No Computer Use or live paid provider diagnostics were used during
  M01 work. All M01 evidence is local mocks, fixtures, browser smoke,
  packaged launch smoke, and First-Paint measurement script.

## Gate Decision

M01 is complete. Phase 12 can proceed to M02 AI Studio Shell and
Project-Aware Chat with the following M01 controls in force:

- use creator-first UX principles for AI Studio shells
- keep providers behind optional/advanced boundaries
- defer heavy visual and provider work behind startup boundaries
- validate each issue with exact commands and log results
- preserve issue-by-issue Linear evidence and commit discipline
- no Computer Use, no live paid provider calls during validation
