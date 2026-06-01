# Phase 11 Product Surface Audit

CP-002 / FRA-37 records the starting product surface after Phase 10. This is
an inspection report, not an implementation pass. Downstream issues should use
this matrix to avoid re-discovering known gaps and to keep scope changes
explicit.

## Scope And Method

Audit date: 2026-06-01.

Inspected areas:

- React editor screens, layout components, stores, adapters, validation, and
  generated UI asset catalog.
- Tauri shell commands, runtime launch bridge, filesystem bridge, and desktop
  configuration.
- Native C++ runtime systems, runtime validator, smoke mode, and CTest suite.
- Build, test, smoke, packaging, and verification scripts.
- Bundled sample project data and generated asset manifests.
- Phase 10 and Phase 11 docs, roadmap, validation report, and Linear project
  documents.

Inspection commands included `rg --files`, targeted `rg -n` searches for
placeholder/future/provider/package/smoke terms, direct reads of the primary
source files, and Linear issue inventory for CP-001 through CP-128.

## Surface Inventory

| Area | Status | Evidence | Notes |
| --- | --- | --- | --- |
| React editor shell and routing | Partial | `src/App.tsx`, `src/components/layout/Sidebar.tsx:15-19` | Core screens route correctly for Maps, Events, Database, and Playtest. Dialogue and Assets nav items currently route back to the map editor and need dedicated behavior or honest disabled states. |
| Top toolbar and project actions | Partial | `src/components/layout/TopToolbar.tsx:87`, `src/components/layout/TopToolbar.tsx:305` | Open/save/import/export/status affordances exist. Export is still a status toast, and the Settings icon is visually actionable but has no settings surface behind it. |
| Map/editor authoring surface | Partial | `src/screens/MainEditorScreen.tsx`, `src/stores/editorStore.ts` | Map editing, selection, validation, undo/redo, and save state are present. Phase 11 still needs end-to-end project creation/opening, richer editor polish, and dedicated asset/dialogue flows. |
| Event editor | Partial | `src/screens/EventEditorScreen.tsx:25`, `src/screens/EventEditorScreen.tsx:42`, `src/screens/EventEditorScreen.tsx:81`, `src/screens/EventEditorScreen.tsx:408` | Event validation and command editing exist. Search is present but not wired, Add Event is not actionable, expanded map defaults are hardcoded to `town`/`house`, and a `npc_placeholder` sprite choice remains visible. |
| Database editor | Partial | `src/screens/DatabaseScreen.tsx` | Database V2 editors are functional for core data. The file still contains unused legacy detail components, making schema expansion and maintenance harder until cleaned up. |
| Playtest/debug surface | Partial | `src/screens/PlaytestScreen.tsx:140`, `src/screens/PlaytestScreen.tsx:810`, `src/screens/PlaytestScreen.tsx:851` | Runtime launch, logs, traces, state snapshots, and browser-unavailable states are present. Some controls and validation counts are simulated or static, including Spawn at Start and the validation badge. |
| AI/provider UI | Missing for Phase 11 product use | `src/screens/AIToolsScreen.tsx:15-25`, `src/stores/providerStore.ts:8`, `src/stores/providerStore.ts:17`, `src/stores/providerStore.ts:34`, `src/stores/providerStore.ts:91` | Phase 10 intentionally hid the AI workspace from primary routing. A stale provider store still marks several providers as connected by default and has a mock `testConnection`; it must not become user-facing without the Phase 11 provider policy, credential, opt-in, cost, and offline-test work. |
| Frontend design system context | Missing | `.impeccable.md` absent | The design-audit skill chain expects persistent project design context. Current UI uses local component conventions, but there is no repo-tracked design brief for future visual audits. |
| Tauri filesystem bridge | Complete for MVP, partial for complete platform | `src-tauri/src/fs_commands.rs`, `src/adapters/FileSystemAdapter.ts` | Safe path checks, backups, project persistence, and playtest session creation exist. First-run directory policy and user-facing diagnostics still need Phase 11 documentation and hardening. |
| Tauri runtime bridge | Complete for MVP, partial for release | `src-tauri/src/runtime_commands.rs`, `src/adapters/RuntimeLaunchAdapter.ts`, `src/adapters/PlaytestSessionAdapter.ts` | Runtime launch, bounded logs, snapshots, and log-folder opening exist. CP-010 added colocated packaged-runtime discovery for the local package prototype; installer artifact behavior remains future release work. |
| Desktop package configuration | Partial | `package.json:42`, `src-tauri/tauri.conf.json:28-30`, `package.json:4`, `src-tauri/Cargo.toml:3` | `desktop:build` uses `tauri build --debug --no-bundle`; Tauri bundle targets are empty. CP-011 aligned npm, package-lock, Tauri, and Cargo release metadata at `0.5.0` and documented unsigned local artifacts plus future NSIS/MSI policy. |
| Native runtime | Complete for Phase 10 MVP, partial for Phase 11 breadth | `src/main.cpp`, `src/runtime/RuntimeProjectValidator.*`, `tests/CMakeLists.txt` | Runtime is local, deterministic, data-driven, and covered by CTest plus smoke mode. Phase 11 should keep runtime provider-independent while expanding release coverage and sample breadth. |
| Canonical validation scripts | Complete for current MVP, partial for release | `scripts/dev/verify.ps1`, `scripts/dev/smoke-runtime.ps1`, `scripts/dev/verify-editor-runtime-roundtrip.ps1` | The canonical gate covers frontend typecheck/tests/build, native configure/build/CTest, Tauri content, Rust tests, runtime smoke, and editor-runtime roundtrip. Packaged app smoke and release artifact gates still need dedicated Phase 11 work. |
| Bundled sample project | Partial | `data/project.json` | The sample exercises Phase 10 MVP systems with `town` and `house` maps. Complete-platform flows need broader content and generated/imported asset examples without live AI dependencies. |
| Asset pipeline | Partial | `docs/ASSET_PIPELINE.md`, `scripts/dev/generate_animation_assets.py`, `scripts/dev/generate_visual_assets.py`, `scripts/dev/extract_generated_assets.py`, `src/assets/generated/assetCatalog.ts` | Phase 9 generated assets and manifests exist. Complete import, candidate review, provenance, normalization, runtime export, and AI generation workflows remain Phase 11 work. |
| Docs | Partial | `docs/GOAL_STACK.md`, `docs/PHASE_10_MVP_VALIDATION_REPORT.md`, `docs/FEATURE_BACKLOG.md:3`, `docs/PHASE_3_VISUAL_QA.md:21`, `docs/PHASE_3_VISUAL_QA.md:31` | Phase 11 charter and goal stack are current. Some historical docs still mention older phase assumptions or visible AI provider cards and must be rewritten or clearly marked historical as the platform docs mature. |

## Gap Matrix

| ID | Severity | Area | Status | Evidence | Downstream reference |
| --- | --- | --- | --- | --- | --- |
| GAP-001 | High | Packaging and release | Partial | `package.json:42`, `src-tauri/tauri.conf.json:28-30` | CP-009, CP-010, CP-011, CP-016 |
| GAP-002 | High | Version and release metadata | Aligned in CP-011; final release check remains | `package.json:4`, `package-lock.json:3`, `src-tauri/tauri.conf.json:3`, `src-tauri/Cargo.toml:3` | CP-011, CP-122 |
| GAP-003 | High | Project open/create/export workflow | Partial | `docs/BUILD_AND_RUN.md:82`, `src/components/layout/TopToolbar.tsx:87` | CP-017 and 02 End-To-End Usability |
| GAP-004 | Medium | Primary navigation truthfulness | Partial | `src/components/layout/Sidebar.tsx:18-19` | CP-025, CP-049 |
| GAP-005 | Medium | Settings/provider entrypoint | Missing | `src/components/layout/TopToolbar.tsx:305`, `src/screens/AIToolsScreen.tsx:15-25` | CP-004, CP-058, CP-116 |
| GAP-006 | High | Provider hub safety | Missing | `src/stores/providerStore.ts:8`, `src/stores/providerStore.ts:17`, `src/stores/providerStore.ts:34`, `src/stores/providerStore.ts:91` | CP-004, CP-071 through CP-094, CP-113 through CP-120 |
| GAP-007 | Medium | Event editor completeness | Partial | `src/screens/EventEditorScreen.tsx:25`, `src/screens/EventEditorScreen.tsx:42`, `src/screens/EventEditorScreen.tsx:81`, `src/screens/EventEditorScreen.tsx:408` | 03 Professional Editor Surface, 04 Runtime Feature Completeness |
| GAP-008 | Medium | Playtest validation/control truthfulness | Partial | `src/screens/PlaytestScreen.tsx:140`, `src/screens/PlaytestScreen.tsx:810`, `src/screens/PlaytestScreen.tsx:851` | 02 End-To-End Usability, 13 QA Automation And Regression |
| GAP-009 | Medium | Database editor maintainability | Partial | `src/screens/DatabaseScreen.tsx` legacy detail components remain beside V2 editors | CP-041 and 05 Database/System Completeness |
| GAP-010 | High | Asset import/generation lifecycle | Partial | `docs/ASSET_PIPELINE.md`, `scripts/dev/generate_animation_assets.py`, `scripts/dev/extract_generated_assets.py`, `src/assets/generated/assetCatalog.ts` | CP-049, 06 Asset Library And Import Pipeline, 08 GPT Image 2 Asset Pipeline, 09 AI Characters And Animations |
| GAP-011 | Medium | First-run data and diagnostics policy | Partial | `src-tauri/src/fs_commands.rs`, `src-tauri/src/runtime_commands.rs`, `docs/BUILD_AND_RUN.md:61` | CP-013, CP-014 |
| GAP-012 | Medium | Design system audit context | Missing | `.impeccable.md` absent | CP-025, CP-099, CP-101 |
| GAP-013 | Medium | Responsive/accessibility polish | Partial | Fixed-width desktop panels across editor/playtest/database screens | CP-099, 12 Continuous Visual/UX Audits |
| GAP-014 | Medium | Stale/historical documentation | Partial | `docs/FEATURE_BACKLOG.md:3`, `docs/PHASE_3_VISUAL_QA.md:21`, `docs/PHASE_3_VISUAL_QA.md:31` | CP-005, CP-121, CP-122, CP-123, CP-124 |
| GAP-015 | Medium | Sample project breadth | Partial | `data/project.json` currently centers on `town` and `house` maps | CP-125 |
| GAP-016 | High | Secret and live-provider boundary | Missing until implemented | Provider UI is hidden, but stale provider defaults can imply connected providers if reused | CP-004, CP-114, CP-115, CP-116, CP-120 |

## Confirmed Strengths

- The native runtime remains local, deterministic, data-driven, and independent
  of AI providers or network access.
- The Phase 10 canonical gate already exercises frontend, desktop shell,
  runtime, smoke, and editor-runtime roundtrip paths.
- Tauri bridges use bounded reads and path controls for project, log, snapshot,
  and playtest-session operations.
- Browser mode is honest about unavailable native filesystem and runtime
  capabilities instead of faking desktop behavior.
- The sample project and runtime smoke provide concrete MVP evidence that
  future Phase 11 work should preserve.

## Blockers And Stop Conditions Found

No immediate user stop condition was found during CP-002:

- `origin` was already confirmed as `https://github.com/vellxw/RPGCreatorAI.git`.
- No credentials or live provider calls were needed.
- No admin/system install was needed.
- No destructive file operations were required.

Future issues must still stop for credentials, live provider opt-in, signing
credentials, installer certificates, or any remote/origin mismatch.

## Immediate Follow-Up

Use this audit as input for:

- CP-003 risk register.
- CP-004 provider/legal baseline.
- CP-005 backlog source mirror.
- CP-006 execution protocol.
- CP-007 validation baseline.
- CP-008 planning integration gate.
