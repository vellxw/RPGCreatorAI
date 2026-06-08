# Phase 12 Launcher And Startup Path Audit

Issue: PX-003 / FRA-437
Date: 2026-06-07

## Scope And Sources

This audit reviews how RPGCreatorAI currently starts in browser dev, Tauri dev,
and packaged desktop contexts. It focuses on double-click launch readiness,
first paint, splash/loading feedback, startup recovery, existing smoke
evidence, and Phase 12 M01 follow-up work.

Inspected sources:

- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`
- `src/App.tsx`
- `src/components/project/ProjectStartupScreen.tsx`
- `src/__tests__/AppStartup.test.tsx`
- `src/components/project/__tests__/ProjectStartupScreen.test.tsx`
- `src/adapters/RuntimeLaunchAdapter.ts`
- `src/adapters/PlaytestSessionAdapter.ts`
- `src-tauri/src/runtime_commands.rs`
- `scripts/dev/package-windows.ps1`
- `scripts/dev/verify-tauri-content.ps1`
- `scripts/dev/smoke-first-run-app-data.ps1`
- `scripts/dev/smoke-browser-editor.ps1`
- `scripts/dev/verify-branding-assets.ps1`
- `docs/BUILD_AND_RUN.md`
- `docs/WINDOWS_BUILD_NOTES.md`
- `docs/PHASE_11_PACKAGING_INTEGRATION_GATE.md`
- `docs/PHASE_11_FINAL_SHIP_GATE.md`
- `docs/FIRST_RUN_APP_DATA_POLICY.md`
- `docs/DIAGNOSTICS.md`
- `docs/BROWSER_SMOKE_HARNESS.md`
- `docs/RELEASE_BRANDING_ASSETS.md`
- `README.md`

This audit did not execute a packaged launch, runtime smoke, or desktop
screenshot capture. Existing packaged smoke evidence cited below is Phase 11
evidence from committed docs.

## Current Startup Paths

| Context | Current path | Evidence |
| --- | --- | --- |
| Browser dev | `npm run dev` starts Vite on port 3000. Browser mode uses browser adapters and cannot spawn native runtime processes or open native filesystem folders. | `package.json`, `README.md`, `BUILD_AND_RUN.md`, `RuntimeLaunchAdapter.ts`, `PlaytestSessionAdapter.ts` |
| Tauri dev | `npm run desktop:dev` runs Tauri; Tauri `beforeDevCommand` starts `npm run dev:tauri` on strict port 1420 and opens the editor at `http://localhost:1420`. | `package.json`, `src-tauri/tauri.conf.json`, `BUILD_AND_RUN.md`, `verify-tauri-content.ps1` |
| Packaged prototype | `npm run desktop:package:windows` builds the native runtime, builds Tauri debug no-bundle, copies `rpg_creator_runtime.exe` beside the shell executable, and smoke-launches the packaged shell unless `-SkipSmoke` is used. | `package-windows.ps1`, `WINDOWS_BUILD_NOTES.md`, `PHASE_11_FINAL_SHIP_GATE.md` |
| React startup | `App.tsx` loads project data through the active adapter, shows centered `Loading project...`, then renders `ProjectStartupScreen` with open/create/import/sample actions. | `App.tsx`, `ProjectStartupScreen.tsx`, `AppStartup.test.tsx`, `ProjectStartupScreen.test.tsx` |
| Runtime launch from desktop | Tauri runtime command locates the runtime by `RPG_RUNTIME_EXE`, project `build/`, `%LOCALAPPDATA%\RPGCreatorAI\build`, then the current shell executable directory. Packaged helper copies the runtime into that final search location. | `runtime_commands.rs`, `package-windows.ps1`, `DIAGNOSTICS.md` |

## Current Strengths

- Browser mode is honest about native limitations and keeps native-only launch,
  diagnostics, and playtest session behavior unavailable.
- Tauri dev uses a strict port (`1420`) and has a content verifier to avoid
  silently opening the wrong app.
- The unsigned Windows packaged prototype has a documented build path, local
  output root, colocated runtime executable, and prior Phase 11 smoke evidence.
- The startup screen exposes real user actions: open project folder, create
  project, import bundle, and bundled sample.
- Browser startup tests cover the discoverable project screen before entering
  the editor.
- Packaging, app-data, diagnostics, and first-run directory policies are
  documented and include explicit success markers.
- Branding assets and Tauri icon metadata are tracked and have a focused
  validation script.

## Launch And Startup Gaps

| Gap | Current evidence | User impact | M01 follow-up |
| --- | --- | --- | --- |
| First paint is not product-grade. | `App.tsx` shows only `Loading project...` before the project chooser. | A double-click or cold launch can look unfinished before the editor appears. | `PX-014`, `PX-015`, `PX-021`, `PX-023` |
| Startup branding is not tied to release icon/logo assets. | `ProjectStartupScreen` uses a Lucide package icon and text label, while release icon source lives under `src-tauri/icons`. | The first viewport does not reinforce the packaged desktop identity. | `PX-011`, `PX-014`, `PX-028` |
| Double-click launch path is indirect. | Current packaged artifact is an unsigned debug no-bundle executable under `%LOCALAPPDATA%\RPGCreatorAI\tauri-target\debug`; docs still primarily describe commands. | Non-terminal users need clearer executable, shortcut, and Start Menu guidance. | `PX-012`, `PX-013`, `PX-027` |
| No startup recent-project restore surface. | `ProjectStartupScreen` has open/create/import/sample actions but no recent project list or restore attempt. | Returning users must reopen manually instead of resuming the last project. | `PX-016`, `PX-024` |
| Runtime availability is not surfaced during startup. | Runtime executable lookup exists in Rust and Playtest launch adapters, but startup screen does not report runtime readiness. | Users discover missing runtime only later when Playtest fails or diagnostics are opened. | `PX-017`, `PX-022` |
| Heavy editor/provider/asset/diagnostic surfaces are imported up front. | `App.tsx` statically imports all screens, including Settings/provider, Assets, Playtest, and Database. | First-paint and startup bundle work can grow with later AI Studio/provider work. | `PX-018`, `PX-019`, `PX-020`, `PX-021` |
| Startup recovery is coarse. | `startupFailure()` formats Open/Create/Import failures as a single status message. | Users get a basic message but no phase-specific retry, path, permissions, or diagnostics flow. | `PX-022`, `PX-024` |
| Packaged smoke exists but is not a permanent M01 launcher harness yet. | `package-windows.ps1` smoke-launches the packaged app for 5 seconds; Phase 11 docs record a pass. | Phase 12 needs launcher-specific smoke and screenshot evidence tied to M01 changes. | `PX-025`, `PX-026`, `PX-029`, `PX-030` |

PX-017 update: startup now performs a non-launching runtime availability check
through `runtime_availability` and surfaces ready/unavailable copy on the
project startup screen. Editing remains available when the native runtime is
missing, and the check does not spawn the runtime.

PX-018 update: provider settings now load through a lazy Settings boundary.
The provider store and model capability registry are not imported or
initialized from the startup path, so first paint does not require provider
credentials, model metadata, or live provider calls.

PX-019 update: the Assets workspace now loads through a lazy asset boundary.
Generated asset preview imports and asset thumbnail/catalog rendering stay out
of the startup module graph until the creator opens Assets.

PX-020 update: the Playtest workspace now loads through a lazy diagnostics
boundary. Runtime log, event trace, runtime snapshot, and diagnostic recovery
panels stay out of the startup module graph until the creator opens Playtest,
while their runtime commands remain available from Playtest user actions.

PX-021 update: M01 launcher work now has a repeatable first-paint performance
budget in `docs/FIRST_PAINT_PERFORMANCE_BUDGET.md` and a repo-local
measurement command, `scripts/dev/measure-first-paint.ps1`. Future startup
changes should record splash-visible, first-contentful-paint, and
DOMContentLoaded evidence before closing related issues.

## Existing Evidence And Safe Commands

Existing committed Phase 11 evidence:

- `docs/PHASE_11_PACKAGING_INTEGRATION_GATE.md` records a passing canonical
  local gate and `npm run desktop:package:windows`.
- `docs/PHASE_11_FINAL_SHIP_GATE.md` records final Phase 11 package evidence:
  packaged executable path, colocated runtime copy, `PACKAGED SMOKE PASSED`,
  and `=== WINDOWS PACKAGE PROTOTYPE PASSED ===`.
- `docs/BROWSER_SMOKE_HARNESS.md` documents the browser startup smoke harness
  and its `Start a project` assertion.

Safe validation commands for later launcher work:

```powershell
npm run typecheck
npm test -- --run src/__tests__/AppStartup.test.tsx src/components/project/__tests__/ProjectStartupScreen.test.tsx
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify-branding-assets.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/measure-first-paint.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/smoke-browser-editor.ps1
npm run desktop:verify-content
npm run desktop:package:windows
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/smoke-first-run-app-data.ps1
```

Only the first three commands above are suitable for this audit without
starting browsers, dev servers, or packaged executables. The package and
first-run smoke commands should be run when an issue changes packaged launch
behavior or explicitly requests launch evidence.

## PX-003 Validation Executed

Validation run on 2026-06-07:

- `npm run typecheck` passed.
- `npm test -- --run src/__tests__/AppStartup.test.tsx src/components/project/__tests__/ProjectStartupScreen.test.tsx src/e2e/__tests__/browserSmokeHarnessScript.test.ts src/e2e/__tests__/verifyScript.test.ts src/adapters/__tests__/RuntimeLaunchAdapter.test.ts src/adapters/__tests__/PlaytestSessionAdapter.test.ts` passed 6 files and 22 tests.
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify-branding-assets.ps1` passed with `BRANDING ASSETS PASSED`.

No packaged executable launch, desktop screenshot capture, runtime smoke, or
first-run app-data smoke was executed for PX-003.

## M01 Mapping

- `PX-011` App Icon And Branding Asset Audit: verify release icon source and
  startup identity alignment.
- `PX-012` Windows Double-Click Executable Path: make executable discovery and
  runtime colocation understandable outside terminal workflows.
- `PX-013` Desktop Shortcut And Start Menu Guidance Prototype: document or
  prototype non-terminal launch entry points.
- `PX-014` Instant Splash Screen Shell and `PX-015` Startup Loading Phase State
  Machine: replace unbranded first paint with a branded, phased shell.
- `PX-016` Recent Project Restore Startup Flow: add restore/recents behavior
  before editor entry.
- `PX-017` Runtime Availability Startup Check: surface missing runtime early.
- `PX-018`, `PX-019`, and `PX-020`: lazy-load provider hub, asset thumbnails,
  and diagnostics panels to protect first paint.
- `PX-021` First Paint Performance Budget: define measurable startup budget.
- `PX-022` Startup Error Recovery States and `PX-024` Startup Project Selection
  Loading Feedback: make recovery phase-specific and visible.
- `PX-023` Startup Splash Accessibility And Keyboard Behavior: ensure splash
  and loading controls are accessible.
- `PX-025` Packaged Prototype Launch Smoke and `PX-026` Desktop Launch
  Screenshot Evidence: generate fresh M01 package evidence.
- `PX-027` Launch Docs For Non-Terminal Users and `PX-028` App Logo Icon
  Metadata Verification: align docs and metadata with launch UX.
- `PX-029` Startup UX Tests And Smoke Harness and `PX-030` Launcher Startup
  Integration Gate: close the launcher milestone with automated evidence.

## Audit Result

RPGCreatorAI already has credible Phase 11 launch infrastructure: browser dev,
Tauri dev, an unsigned packaged prototype, runtime colocation, app-data policy,
diagnostics, and smoke scripts. Phase 12 M01 should not replace that foundation.
It should make startup feel like a desktop product: branded first paint,
visible loading phases, double-click guidance, recent project restore, early
runtime availability, lazy loading, startup recovery, and fresh launch evidence.
