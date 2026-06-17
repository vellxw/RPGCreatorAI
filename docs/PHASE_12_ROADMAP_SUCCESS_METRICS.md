# Phase 12 Roadmap And Success Metrics

Issue: PX-008 / FRA-442
Date: 2026-06-08

## Purpose

This roadmap translates the Phase 12 Linear backlog (`PX-001` through
`PX-250`) into measurable product outcomes. Metrics here are verification
targets, not marketing claims: each one should be provable with versioned
docs, tests, screenshots, smoke checks, validation logs, and Linear evidence.

No live paid AI provider calls are part of normal Phase 12 validation. AI,
asset, animation, and provider work must use mocks, fixtures, local scripts,
mocked HTTP, or offline diagnostics unless a later issue explicitly requires
a separate credentialed diagnostic and the user provides credentials.

## Roadmap Sequence

| Milestone | Issues | Product outcome | Completion evidence |
| --- | --- | --- | --- |
| M00 - Baseline Recovery And Product Framing | PX-001 through PX-010 | Phase 12 starts from a verified Phase 11 baseline with UX audits, pipeline inventories, creator-first principles, roadmap, risk register, and UI-work gate. | Versioned audit/principles/roadmap/risk docs, current validation log, branch/origin evidence, baseline validation, Linear comments, and M00 integration gate. |
| M01 - Launcher, Desktop Entry, Splash, And Startup UX | PX-011 through PX-030 | The app feels like a product when launched: executable entry, icon/branding, splash/progress states, lazy loading, recent projects, and launch smoke evidence. | Startup tests, launcher scripts, branding checks, screenshot evidence, desktop/Tauri smoke, runtime-launch honesty, and M01 gate report. |
| M02 - AI Studio Shell And Project-Aware Chat | PX-031 through PX-055 | AI Studio becomes a real project-aware workspace with chat, context, task/action cards, mock responses, and review-forward UI. | UI tests, mock chat fixtures, project-context tests, no-provider/default tests, screenshots, docs, and M02 gate report. |
| M03 - Pipeline-Aware AI Command Router | PX-056 through PX-085 | Natural-language creator intent routes to safe data, asset, validation, balance, mechanic, and preview pipelines without silent mutation. | Router fixtures, ambiguity tests, preview-before-apply tests, unsupported-intent tests, no-mutation assertions, and M03 gate report. |
| M04 - Creator-Friendly Provider And Model UX | PX-086 through PX-105 | Normal creators choose outcome-oriented modes while advanced users retain provider/model/endpoint controls. | Preset tests, persistence tests, credential/cost/capability state tests, beginner/advanced copy audit, accessibility checks, screenshots, and M04 gate report. |
| M05 - AI Action Review Inbox And Candidate Lifecycle | PX-106 through PX-125 | AI outputs have a unified candidate lifecycle with provenance, previews, accept/reject/archive, validation status, persistence, and runtime exclusion. | Candidate model tests, reducer/persistence tests, rejected-runtime-exclusion tests, preview screenshots, lifecycle docs, and M05 gate report. |
| M06 - Developer Mode Code Assistant | PX-126 through PX-145 | Source/code assistance is explicit Developer Mode with reviewed handoffs, diffs, test suggestions, and source safety boundaries. | Developer gate tests, source candidate tests, no-commit/no-push assertions, OpenCode handoff safety tests, screenshots/docs, and M06 gate report. |
| M07 - First-Run Onboarding And Starter Project Flow | PX-146 through PX-165 | First-run creators can reach the first success loop: choose starter path, save, validate, and playtest without provider setup. | Onboarding tests, sample/blank/local-mock starter tests, save/validate/playtest evidence, screenshots, docs, and M07 gate report. |
| M08 - Generated Asset And Animation Research | PX-166 through PX-185 | Provider/image/animation/legal/cost/API research produces a capability matrix and architecture recommendation before execution paths expand. | Research docs, provider capability matrix, legal/cost notes, no-live-call evidence, recommendation doc, and M08 gate report. |
| M09 - Animation Quality Rubric And Fixtures | PX-186 through PX-205 | Animation quality becomes deterministic and reviewable with accepted/rejected fixtures, rubric checks, validation, and preview evidence. | Fixture assets/manifests, rubric docs, validator tests, preview evidence, failure-case tests, and M09 gate report. |
| M10 - Multi-Round Asset Refinement Pipeline | PX-206 through PX-225 | Asset generation supports provider-agnostic planner/generator/checker/refiner/verifier loops with cost guardrails and review integration. | Mock loop tests, cost guardrail tests, review inbox integration tests, refinement history, docs, and M10 gate report. |
| M11 - Sprite Sheet And Animation Pipeline Optimization | PX-226 through PX-245 | Sprite sheet and animation generation are optimized with prompt specs, identity/style constraints, normalization, preview generation, runtime export compatibility, and screenshots. | Prompt spec docs, identity/style tests, normalization/preview tests, runtime export tests, screenshot evidence, and M11 gate report. |
| M12 - Integration, Release, Docs, And Final Gate | PX-246 through PX-250 | Phase 12 closes with an integrated AI Studio/product UX gate, screenshot audit, docs update, validation report, and final ship gate. | Final validation commands, runtime smoke if applicable, screenshot audit, docs index updates, Linear evidence for all issues, final commit/push, and M12 final report. |

## Cross-Cutting Success Metrics

| Area | Metric | Evidence |
| --- | --- | --- |
| Issue discipline | Each `PX-N` is read from Linear, moved In Progress, implemented/audited, validated, logged, committed if changed, pushed, commented with evidence, and moved Done before `PX-N+1`. | Linear issue history, commit hash, `docs/VALIDATION_LOG.md`, final status. |
| Validation honesty | No build/test/smoke/runtime pass is claimed unless the command ran in this repo. | Exact command, result, key output, and failure/fix record in validation log and Linear comment. |
| Git hygiene | Commits stage only issue-scoped files and never include secrets, `.env`, `.commandcode/`, generated binaries, build outputs, or unrelated changes. | `git status --short`, staged diff review, selective staging notes, commit file list. |
| Runtime boundary | Native runtime remains local, deterministic, data-driven, and independent of AI providers, credentials, network, cloud, and editor-only history. | Runtime tests, docs, no runtime provider calls, smoke results, data-only runtime inputs. |
| No live paid provider calls | Normal validation uses local mocks, fixtures, mocked HTTP, and offline scripts. | Test commands, mock fixture references, no credential reads, Linear evidence. |
| Review-gated AI | AI outputs become candidates with preview/provenance/QA before accepted data changes. | Candidate tests, review inbox state, reducer tests, validation repair tests, asset QA tests. |
| Creator-first UX | Beginner flows describe outcomes, not provider infrastructure; advanced controls remain available behind explicit boundaries. | Copy tests, screenshots, accessibility checks, provider UX audits, M04 gate. |
| Startup confidence | Launch paths show visible progress, do not hang behind blank/loading-only states, and preserve browser/desktop honesty. | Startup tests, launch smoke, screenshots, branding checks, recent-project tests. |
| Onboarding success loop | First-run users can create/open a starter, save, validate, and playtest without configuring providers. | Onboarding flow tests, project startup tests, playtest smoke, screenshots. |
| Asset/animation quality | Generated assets and animations have deterministic QA, fixtures, preview evidence, and runtime export compatibility. | Python script tests, Vitest workflow tests, manifests, runtime manifest validation, screenshots. |

## Milestone Evidence Requirements

M00 evidence:

- All baseline docs from `PX-001` through `PX-009` exist.
- `docs/VALIDATION_LOG.md` has entries for each issue.
- `docs/GOAL_STACK.md` identifies Phase 12 as active.
- M00 integration gate validates consistency before UI implementation starts.

M01 evidence:

- Desktop entry and startup UX are verified in desktop/Tauri mode.
- Splash/loading phases and recent project states have tests or screenshots.
- Browser limitations remain honest and local authoring remains available.

M02 evidence:

- AI Studio has project context, chat/task surfaces, empty/error/loading states,
  and no default live-provider action.
- Mock-backed tests cover normal AI Studio behavior.

M03 evidence:

- Router outputs are structured and previewable.
- Ambiguous requests ask concise clarification questions.
- Unsupported requests do not mutate project data.

M04 evidence:

- Creator presets precede raw provider controls.
- Custom advanced mode retains provider/model/base URL/capability settings.
- Credential, cost, rate-limit, quota, and unavailable states have beginner and
  advanced copy coverage.
- Closed at commit a7e7ddf; see `docs/PHASE_12_M04_INTEGRATION_GATE.md`.

M05 evidence:

- Candidate data model persists provenance and review state safely.
- Accept/reject/archive actions are tested.
- Rejected and failed candidates cannot enter runtime data.

M06 evidence:

- Developer Mode is disabled by default.
- Code assistant outputs are proposals/handoffs/diffs, not automatic commits.
- Tests prove no push, commit, arbitrary shell execution, or external path
  access occurs from normal creator flows.

M07 evidence:

- First-run paths cover sample, blank, and local/mock starter flows.
- Save, validate, and playtest are reachable as a guided loop.
- Provider setup is optional and never the first-run blocker.

M08 evidence:

- Research is source-attributed where external information is used.
- Capability matrix separates provider claims from app-supported operations.
- Cost/legal/API risks are documented without making product promises.

M09 evidence:

- Accepted and rejected animation fixtures are deterministic and checked in
  only when appropriate.
- Rubric failures produce actionable repair guidance.
- Preview evidence can be reproduced locally.

M10 evidence:

- Refinement loop has explicit planner/generator/checker/refiner/verifier
  boundaries.
- Cost/session guardrails block unconfirmed paid or unknown-cost work.
- Review inbox receives candidates instead of direct project mutation.

M11 evidence:

- Sprite prompt specs encode identity, style, action, direction, frame count,
  and runtime export needs.
- Normalization/preview/runtime export compatibility tests pass locally.
- Screenshot evidence proves generated/optimized visuals are inspectable.

M12 evidence:

- Final integration validates AI Studio, provider UX, review inbox, onboarding,
  asset/animation pipelines, docs, and runtime boundaries together.
- Final validation commands and runtime smoke are recorded exactly.
- Linear shows `PX-001` through `PX-250` Done with evidence.

## Validation Policy

Every issue should choose the narrowest validation that proves the changed
surface, then broaden at milestone gates. Typical command families:

- docs-only: docs/source inspection, placeholder scan, secret-like value scan,
  `git diff --check`
- frontend UI: `npm run typecheck` plus focused Vitest suites
- AI/provider workflow: mock-provider, adapter, queue, history, and UI tests
  with mocked HTTP only
- asset/animation pipeline: focused Vitest suites plus local Python/script
  validators
- runtime/native: CMake/CTest, Rust tests, runtime smoke, or full
  `scripts/dev/verify.ps1` when the issue or gate changes cross-cutting
  behavior
- visual UI: screenshot evidence through browser/desktop smoke when applicable

No issue may close with unrecorded failures. If a validation fails, record the
failure, fix the cause within scope, and rerun the relevant validation. If the
failure is due to preserved unrelated worktree state, record that evidence and
avoid staging unrelated changes.

## Final Phase 12 Definition Of Done

Phase 12 is complete only when:

- `PX-001` through `PX-250` are Done in Linear with per-issue evidence.
- All issue-scoped changes are committed and pushed to `origin/main`.
- `docs/VALIDATION_LOG.md` records major validation runs and any failures/fixes.
- M00 through M12 gate reports exist where required by Linear.
- Final docs reflect actual behavior, not planned behavior.
- Runtime smoke is executed for final integration if runtime behavior or
  product launch behavior applies.
- The native runtime remains provider-independent.
- Final git status is reported honestly, including preserved unrelated
  workspace residue if any remains.

## Roadmap Result

Phase 12 is a product UX and AI Studio completion phase, not a runtime AI
phase. The measurable outcome is a local-first product that launches
professionally, guides first-run creators, exposes AI through reviewable
project-aware workflows, keeps provider complexity behind advanced controls,
and strengthens generated asset/animation quality with deterministic evidence.
