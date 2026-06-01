# Phase 11 Product Charter - Complete Product Platform

## Purpose

Phase 11 turns the completed Phase 10 MVP into a complete local-first
RPGCreatorAI product platform. The product must let a creator create or open a
project, author maps, events, databases, and assets, validate the project,
save safely, playtest and debug locally, package a Windows desktop build, and
prepare a releasable project without manual JSON editing.

## User Promise

RPGCreatorAI is a professional desktop RPG creation app for deterministic,
data-driven story RPGs. A user should be able to work locally, understand where
their project files and diagnostics live, recover from validation or provider
errors, and launch a native runtime that consumes project data without hidden
services.

Optional AI tooling may assist authoring inside the editor. It must always be
explicit, configurable, mock-testable, and safe to disable. The saved project
and the native runtime must remain usable without provider credentials, paid
API calls, network access, or cloud services.

## Starting Assumptions From Phase 10

- Phase 10 MVP is complete and validated by `docs/PHASE_10_MVP_VALIDATION_REPORT.md`.
- The canonical gate `scripts/dev/verify.ps1` passed on June 1, 2026.
- The editor already supports professional map authoring, event pages,
  database V2 editors, playtest modes, runtime logs, event traces, runtime
  snapshots, and real local validation surfaces.
- The native runtime already supports deterministic project validation,
  selectable choices, movement routes, event priority/Y-sort, foreground
  occlusion, local audio requests, plugin command v1, smoke screenshots, and
  editor-runtime roundtrip proof.
- Known Phase 10 limitations are accepted starting points, not shipped
  complete-platform behavior: no installer polish, no embedded packaging
  strategy, limited onboarding, optional audio assets, no live AI provider
  workflows, and no final release documentation.

## Product Objective

Ship a complete end-to-end RPG creation platform with:

- Reliable Windows dev and packaged build flows.
- Safe first-run project, app-data, temp session, log, and artifact behavior.
- A complete authoring loop from create/open through save, validate, playtest,
  debug, package, and release handoff.
- Professional editor, runtime, database, asset, and sample-project polish.
- Optional AI Provider Hub infrastructure for editor/tooling only.
- Mocked provider contracts, credential boundaries, cost/rate-limit UX, and
  opt-in live diagnostics only when explicitly configured.
- Continuous visual, UX, asset, security, and regression audits.
- Final docs and validation evidence that match the implemented product.

## Runtime Boundary

The native runtime remains local, deterministic, and data-driven. It may read
project JSON and committed local assets, write saves/logs/snapshots, and render
or execute gameplay deterministically. It must not depend on:

- AI providers or model APIs.
- Network, cloud storage, or remote services.
- Provider credentials or API keys.
- Marketplace packages.
- Arbitrary script execution or plugin code.
- Editor-only generation queues.

Runtime integrations that request behavior, such as audio or plugin command
v1, must stay allowlisted, local, testable, and non-destructive.

## Optional AI Editor Tooling Boundary

AI is a user-controlled editor/tooling layer. Phase 11 may add provider
settings, provider capability metadata, generation queues, prompt/config
manifests, candidate assets, draft content, diagnostics, and mock provider
tests. These systems must:

- Run with providers disabled.
- Store no secrets in project JSON, repo files, logs, screenshots, or docs.
- Use mocks and fixtures for normal validation.
- Treat live provider calls as opt-in diagnostics only.
- Make cost, rate-limit, failed-call, cancellation, and retry states visible.
- Keep provider IDs, model IDs, base URLs, limits, and capabilities as data or
  config rather than hardcoded product assumptions.

## Non-Goals

- No runtime AI dependency.
- No mandatory cloud account or online service.
- No live paid AI call in normal validation or CI.
- No API keys committed, logged, or stored in project JSON.
- No proprietary RPG Maker file format or asset compatibility target.
- No marketplace, backend project sync, account system, or networked storage.
- No arbitrary scripting VM or plugin code execution.
- No silent import of generated assets into accepted project data.
- No destructive edits to source projects during playtest or packaging.

## Success Criteria

Phase 11 is complete only when:

- A clean checkout can run the documented dev and validation workflows.
- A Windows packaged build can be produced with documented artifact policy.
- First-run, project-open/create/save, validation, playtest, diagnostics, and
  recovery flows are understandable without manual JSON editing.
- Editor and runtime data boundaries are documented and enforced.
- Database, map, event, asset, sample, and runtime workflows are covered by
  tests or smoke checks appropriate to their risk.
- AI/provider workflows are optional, mocked in normal validation, credential
  safe, cost/rate-limit aware, and recoverable after failures.
- Runtime smoke, editor-runtime roundtrip, desktop tests, frontend tests,
  native C++ tests, provider mock tests, and final docs/reporting gates pass.
- Linear CP-001 through CP-128 are closed with commits, push results, and
  validation evidence.

## Source Documents

- `AGENTS.md`
- `docs/GOAL_STACK.md`
- `docs/PHASE_10_MVP_VALIDATION_REPORT.md`
- `docs/GAME_VISUAL_DESIGN.md`
- `.kiro/specs/phase11-complete-product-platform/`
- Linear project `RPGCreatorAI Complete Product Platform`
