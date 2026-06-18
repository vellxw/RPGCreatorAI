# Changelog

All notable changes to RPGCreatorAI will be documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Versioning note: the project is currently pre-1.0. Minor (0.x.0) bumps
signal a milestone; patch (0.x.y) bumps signal follow-up work on the same
milestone.

## [Unreleased]

## [0.13.0] - 2026-06-17 - Phase 13 follow-up closure

### Added
- FirstRunGate: presentational, inert gate that wraps the host shell and
  renders the `FirstRunPathSelector` when `useFirstRun().isFirstRun` is
  true. App.tsx uses the gate to mount M07's starter-path selector
  (blank / town-template / bundled-sample) so the first-run flow
  declared in M07 is now visible in the host. On confirm the gate
  routes through `useFirstRun().complete()` and `performCreateProject`
  for the project-creating paths. Commit: c417dc8.
- AIStudioBoundary: thin wrapper around `AIStudioScreen` loaded via
  `React.lazy` and `Suspense` so the AI Studio no longer ships in the
  main bundle. Commit: 9035c64.
- "Save & Playtest" button on the editor toolbar: invokes
  `performSave` and routes the outcome through `decideSaveAndPlaytest`
  to surface `save-blocked`, `saved-and-routed`, or
  `saved-and-playtested` feedback. On success the toolbar switches
  the active screen to `playtest`. Commit: 45a88ad.
- `CHANGELOG.md` (this file): consolidates the milestone gate reports
  so the public-facing history of Phase 12 is in one place.
- Linear `FRA-686` / `FRA-687` / `FRA-688` / `FRA-689` records (one
  per Phase 13 follow-up) closed with per-issue evidence comments.
  Tracked in the `docs/PHASE_13_FOLLOWUP_INTEGRATION_GATE.md` report.

### Changed
- `src/App.tsx` now imports `useFirstRun` and `FirstRunGate` and wraps
  the `ProjectStartupScreen` with the gate so the M07 starter path is
  the first screen on a fresh install. Commit: c417dc8.
- `src/components/ai/AIStudioBoundary.tsx` is loaded lazily, removing
  AI Studio (screen + command router + candidate inbox + dock shell)
  from the main bundle. Commit: 9035c64.
- `src/components/layout/TopToolbar.tsx` now exposes a "Save & Playtest"
  affordance on the editor toolbar; the existing "Playtest" button
  remains so creators can still jump straight to playtest without
  saving. Commit: 45a88ad.

### Performance
- Main bundle reduced from 880.60 kB (gzip 229.31 kB) to 829.48 kB
  (gzip 215.99 kB) after extracting `AIStudioBoundary` into its own
  46.22 kB (gzip 12.87 kB) chunk. Net cold-start savings: ~51 kB
  raw / ~13 kB gzip on the main chunk, plus the AI Studio is no
  longer parsed on first paint. Commit: 9035c64.

## [0.12.0] - 2026-06-17 - Phase 12: Product UX And AI Studio

Phase 12 introduced the AI Studio as a creator-first product surface,
the in-app provider model UX, candidate review inbox, off-by-default
Developer Mode, and the asset / animation quality research and tooling
that anchors the creation pipeline.

### Added
- **M00 — Baseline and ship-readiness audit** (FRA-435..444). Initial
  Phase 12 docs and platform baseline audit. Commits: 93a80c4,
  41c7efb, 23b126a, 8654c44, c05604d, 23b9d27, c0aeebd, fe90ce8,
  80ba442, c596a79, fb1a866, 34c9b1f, 235438e.
- **M01 — Launcher / startup shell** (FRA-445..464). Ordered startup
  phase state machine, accessibility and keyboard behavior, recovery
  surfaces, recent-projects, and packaged-executable launch smoke.
  Commits: 0d19bf8, 23b126a, c05604d, 23b9d27, c0aeebd, fe90ce8,
  80ba442, c596a79, a1295ad, fc75e73, 2c051aa.
- **M02 — AI Studio shell** (FRA-465..489). Project-aware chat,
  dock-shell layout, sidebar entry, prompt template library, safe
  context-boundary redaction, loading and streaming states, and
  project-scoped session. Commits: c0a8e42, 5172921, a4f4c9b,
  caba1df, 84b1a2f, 814483b, fcd8cdc, dc8bd32, caba1df, 9f9a46f,
  0cf2786, cbfb988.
- **M03 — Pipeline-Aware AI Command Router** (FRA-490..520). Pipeline
  router with 24 intent handlers, ambiguity clarification, and
  preview-before-apply contract. Commits: fba5413, c5c2ac5, 4a11723.
- **M04 — Creator-friendly provider and model UX** (FRA-521..559).
  Five creator modes (Recommended, Fast/cheap, Best quality,
  Local/mock, Custom advanced) with persistence and an
  AdvancedProviderPanel behind a creator-controlled boundary.
  Commits: a7e7ddf, 0f7da5b.
- **M05 — AI Action Review Inbox** (FRA-560..579). Candidate
  lifecycle (accept / reject / archive), six candidate preview types
  (map, event, database, asset, animation, code), runtime exclusion
  for rejected candidates. Commits: a95ea1e, 26c0437.
- **M06 — Off-by-default Developer Mode** (FRA-580..599). Code
  assistant shell, file context, diff proposal UI, no-auto-commit /
  no-auto-push guards, patch safety boundaries. Commits: b5660b2,
  920ebca.
- **M07 — First-run onboarding** (FRA-600..619). Three starter
  paths (blank, town-template, bundled-sample), localStorage
  persistence, Save & Playtest helper, and FirstRunPathSelector
  presentational component. Commits: e0123ec, 7bfb871.
- **M08 — Generated asset and animation research** (FRA-620..639).
  Provider capability matrix, legal / cost notes, and recommendation
  document. Commits: 22515e0, 87aa0d2.
- **M09 — Animation quality rubric** (FRA-640..659). Frame-count,
  dimension, identity, scale, direction / action, silhouette,
  anchor, limb-drift, loop-smoothness, and runtime-suitability
  checks plus accepted / rejected fixture sets. Commits: 87aa0d2.
- **M10 — Multi-round asset refinement pipeline** (FRA-660..679).
  Deterministic offline executor, cost guardrails, max-round
  limits, cancellation, and retry controls. Commit: 4ca6aa1.
- **M11 — Sprite sheet optimization** (FRA-680..699). Spec and
  validator with accepted fixture tests and mock success / failure
  outputs. Commit: 094e330.
- **M12 — Final ship gate and Linear closure** (FRA-700..719).
  Ship gate report, goal-stack update, and the procedure to
  close all 251 Phase 12 FRA-* issues in Linear with evidence
  comments. Commits: eef41e3, 7e8b9bf.

### Changed
- `verify.ps1` now chains 9 gates (typecheck -> test -> build ->
  asset pipeline -> native build -> Tauri content -> Rust tests
  -> runtime smoke -> editor roundtrip) and is the source of truth
  for Phase 12 CI. See `docs/CI_READY_VALIDATION.md`.
- `docs/GAME_VISUAL_DESIGN.md` is the binding source of truth for
  authored game visuals; supersedes any earlier screenshots.

### Fixed
- 10 critical bug fixes and 10 quick wins in the C++ codebase
  (commit 2c051aa).
- Command router multi-word match tiebreak so longer keyword matches
  win when scores tie (commit c5c2ac5).

### Security
- All AI provider validation remains mock-only by default per
  `docs/CI_READY_VALIDATION.md`. Live provider calls require
  explicit opt-in and credential gating. No live paid provider call
  was executed during the entire Phase 12 validation run.

## [0.11.0] - 2026-05-14 - Phase 11: Local-first product platform

Phase 11 completed the local-first product platform: project
persistence, validation, recent-projects, and editor polish. See
`docs/PHASE_11_INTEGRATION_GATE.md` for the milestone gate.

[0.5.0 - 0.10.x]: legacy milestone tags, see `docs/`.

[0.0.0]: pre-1.0 development.
