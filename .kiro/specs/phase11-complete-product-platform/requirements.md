# Requirements - Phase 11 Complete Product Platform

## Goal

Complete RPGCreatorAI as a local-first desktop RPG creation platform with
release hardening, packaging, professional editor/runtime/database polish,
asset workflows, optional AI-assisted editor tooling, audits, QA automation,
security controls, documentation, and final ship readiness.

## Functional Requirements

1. The project shall provide reliable Windows development and packaged build
   workflows from a clean checkout.
2. The desktop app shall make first-run local directories, app-data folders,
   logs, temp sessions, generated artifacts, and release outputs explicit and
   recoverable.
3. The editor shall support an end-to-end user loop: create/open project,
   author maps/events/databases/assets, validate, save, playtest, debug,
   package, and prepare release handoff.
4. The editor shall preserve deterministic project data and avoid manual JSON
   editing for complete-platform workflows.
5. The native runtime shall remain local, deterministic, data-driven, and free
   of AI, network, cloud, provider credential, marketplace, and arbitrary
   scripting dependencies.
6. Optional AI tooling shall live only in editor/tooling surfaces and shall be
   safe to disable without breaking local authoring or runtime behavior.
7. Provider IDs, model IDs, base URLs, capabilities, limits, costs, and error
   behavior shall be represented as data/config rather than hardcoded product
   assumptions.
8. Normal validation shall use mocks, fixtures, and contract tests for provider
   behavior. Live provider diagnostics shall be opt-in only.
9. Credentials and secrets shall never be stored in project JSON, repo files,
   logs, docs, screenshots, or validation output.
10. Asset import and generation workflows shall produce inspectable,
    versioned, editable, removable, and runtime-exportable project assets with
    provenance metadata.
11. Continuous visual, UX, accessibility, copy, asset, security, and regression
    audits shall be documented and tied to validation evidence.
12. Every milestone shall end with an integration gate before downstream work
    depends on it.
13. The final ship gate shall include canonical verification, packaged app
    smoke, runtime smoke, editor-runtime roundtrip, provider mock tests,
    docs/report review, Linear closeout, commit hash, push result, and final
    `git status --short`.

## Non-Goals

- No runtime AI dependency.
- No mandatory online account, cloud storage, backend sync, or marketplace.
- No live paid AI calls in normal validation or CI.
- No proprietary RPG Maker file format or asset compatibility target.
- No arbitrary scripting VM or unrestricted plugin code execution.
- No committed API keys, generated binaries, build output, or private
  credentials.

## Success Criteria

- The app is usable from project creation/opening through package/release
  handoff without manual JSON editing.
- The packaged Windows flow is documented, repeatable, and smoke-tested.
- The runtime remains playable and deterministic with all providers disabled.
- AI/provider workflows are optional, opt-in, mock-tested, and recoverable.
- Linear CP-001 through CP-128 are Done with validation comments, commits, and
  push evidence.
