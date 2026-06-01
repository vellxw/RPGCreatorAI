# Design - Phase 11 Complete Product Platform

## Product Shape

Phase 11 layers product hardening and optional authoring assistance above the
Phase 10 MVP. The editor remains the place where UX, validation, packaging,
asset pipelines, diagnostics, and optional provider workflows live. The native
runtime continues to interpret local project data and committed local assets.

## Layer Boundaries

- Runtime: C++20, SDL, deterministic project loading, gameplay, rendering,
  saves, runtime logs, smoke screenshots, and debug snapshots.
- Desktop shell: Tauri/Rust filesystem, safe path handling, app-data folders,
  launch bridge, package/runtime executable discovery, credential boundary
  adapters, and bounded diagnostics reads.
- Editor: React/TypeScript authoring surfaces, validation, project state,
  asset import/generation candidates, provider settings, cost/error UI,
  audits, and user-facing workflow guidance.
- Docs/scripts: repeatable command entrypoints, Windows notes, validation logs,
  release artifact policy, and final reporting.

## Runtime Determinism

The runtime consumes only local project data and local assets. Provider
settings, generation queues, candidate assets, model metadata, and live
diagnostics are editor/tooling state until a user explicitly accepts generated
outputs into project data. Accepted project data must still be ordinary JSON
and committed/runtime-ready assets.

## Provider Hub

The provider hub is configuration and queue infrastructure, not a runtime
dependency. It normalizes provider capabilities, credentials availability,
request status, cost/rate-limit information, cancellation, retries, and
failure recovery. Contract tests use mocks and fixtures. Live diagnostics are
optional and require explicit user configuration and permission.

## Asset Pipeline

Imported or generated assets move through inspectable states:

1. Source or prompt/config manifest.
2. Candidate output with metadata and QA status.
3. User-accepted project asset.
4. Runtime-ready export and database references.
5. Removal/repair path that keeps references safe.

Asset dimensions, transparency, anchors, frame counts, metadata, visual QA,
and runtime export behavior follow `docs/GAME_VISUAL_DESIGN.md` and the Linear
asset rubric.

## Milestone Gates

Phase 11 uses the Linear milestones as integration boundaries:

- 00 Planning And Scope Lock: charter, audit, risk register, provider policy,
  backlog source, execution protocol, validation baseline, and planning gate.
- 01 Release Hardening And Packaging: dev build reliability, packaged build,
  installer/artifact policy, branding, app-data/log policy, and diagnostics.
- 02 End-To-End Usability: create/open/save/playtest/debug/recovery workflows.
- 03 Professional Editor Surface: editor polish and authoring ergonomics.
- 04 Runtime Feature Completeness: runtime command/menu/battle/audio/plugin
  gaps and diagnostics.
- 05 Database/System Completeness: schema, validation, reference repair, and
  authoring quality.
- 06 Asset Library And Import Pipeline: import, cataloging, optimization,
  export, and provenance.
- 07 AI Provider Hub Foundation: optional providers, credentials, queues,
  capabilities, costs, mocks, and tests.
- 08 GPT Image 2 Asset Pipeline: configurable image generation/editing
  workflows without live calls in normal validation.
- 09 AI Characters And Animations: character and animation candidate pipelines.
- 10 AI Game Content Pipelines: draft maps, quests, events, databases, balance,
  and repair suggestions.
- 11 Multi-Provider Integrations: concrete adapters and custom
  OpenAI-compatible endpoints with mock contracts.
- 12 Continuous Visual/UX Audits: recurring screenshot, accessibility, copy,
  asset, and regression audits.
- 13 QA Automation And Regression: expanded automated gates.
- 14 Security Privacy And Cost Controls: secrets, opt-in, local boundaries,
  costs, rate limits, and recovery.
- 15 Docs Examples And Final Ship: docs, sample expansion, final validation,
  Linear closeout, and final release handoff.

## Validation Design

Focused issue validation runs first. Broader gates run when an issue touches
shared schemas, serialization, runtime behavior, build scripts, packaged app
behavior, security, provider infrastructure, or docs that claim commands.
Major validation runs are appended to `docs/VALIDATION_LOG.md`. The final
canonical gate remains `powershell -NoProfile -ExecutionPolicy Bypass -File
scripts/dev/verify.ps1` plus any packaged-app or provider-mock gates added by
Phase 11.
