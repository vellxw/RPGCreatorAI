# Build and Run Instructions

## Requirements

- Node.js and npm.
- Rust and Cargo for the Tauri desktop bridge.
- Visual Studio Build Tools or Visual Studio with the C++ workload.
- CMake and Ninja.

## Canonical Local Verification

Run the full local green gate from the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1
```

This command runs frontend typecheck, Vitest, frontend build, Phase 11 asset
pipeline validation, native C++ configure/build/CTest, Tauri content
verification, Rust desktop tests, runtime smoke, and editor-runtime roundtrip
validation. The native build defaults to `%LOCALAPPDATA%\RPGCreatorAI\build` to
avoid OneDrive file locks. A successful run ends with `=== ALL PASSED ===`.

NPM alias:

```powershell
npm run verify:windows
```

Targeted skip flags for local diagnosis:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1 -SkipFrontend
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1 -SkipDesktop
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1 -SkipRuntime
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1 -SkipSmoke
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1 -SkipAssets
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1 -BuildDir D:\rpg-build
```

For restricted PowerShell execution policies:

```cmd
scripts\dev\verify.bat
```

## Focused helpers

```powershell
# Native configure/build/CTest only, no frontend/desktop/smoke gates.
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/build.ps1

# Frontend Vitest plus CTest against the existing native build.
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/test.ps1

# Runtime smoke only.
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/smoke-runtime.ps1

# Browser editor smoke harness. Starts/reuses Vite, drives the editor with
# Playwright CLI through npx, and writes local artifacts under output/playwright/cp108.
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/smoke-browser-editor.ps1

# Runtime diagnostics entry point and no-log failure-path coverage.
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify-diagnostics.ps1

# Release branding metadata/icon checks.
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify-branding-assets.ps1

# Asset export pipeline (cataloged assets to runtime BMP/WAV).
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/export-runtime-assets.ps1

# Animation strip normalization (generated sprite sheets to runtime-ready strips).
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/normalize-animation-strip.ps1

# Animation preview generation (GIF/sheet previews from normalization manifests).
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/generate-animation-preview.ps1

# Screenshot analysis (audit helper for screenshot directories).
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/analyze-screenshots.ps1
```

Equivalent `.bat` wrappers are available when direct PowerShell script
execution is blocked:

```cmd
scripts\dev\build.bat
scripts\dev\test.bat
scripts\dev\smoke-runtime.bat
scripts\dev\smoke-browser-editor.bat
scripts\dev\verify-diagnostics.bat
scripts\dev\verify-branding-assets.bat
scripts\dev\export-runtime-assets.bat
scripts\dev\normalize-animation-strip.bat
scripts\dev\generate-animation-preview.bat
```

Expected success markers:

| Command | Success marker |
| --- | --- |
| `scripts/dev/verify.ps1` | `=== ALL PASSED ===` |
| `scripts/dev/build.ps1` | native CTest reports `100% tests passed` |
| `scripts/dev/test.ps1` | `=== TESTS PASSED ===` |
| `scripts/dev/smoke-runtime.ps1` | `SMOKE PASSED` |
| `scripts/dev/smoke-browser-editor.ps1` | `BROWSER SMOKE PASSED` or explicit `BROWSER SMOKE SKIPPED: <reason>` |
| `scripts/dev/verify-diagnostics.ps1` | `RUNTIME DIAGNOSTICS VERIFY PASSED` |
| `scripts/dev/verify-branding-assets.ps1` | `BRANDING ASSETS PASSED` |
| `npm run desktop:package:windows` | `PACKAGED SMOKE PASSED` and `=== WINDOWS PACKAGE PROTOTYPE PASSED ===` |
| `scripts/dev/smoke-first-run-app-data.ps1` | `FIRST-RUN APP DATA SMOKE PASSED` |
| `scripts/dev/export-runtime-assets.ps1` | `RUNTIME EXPORT PASSED` |
| `scripts/dev/normalize-animation-strip.ps1` | `NORMALIZATION PASSED` |
| `scripts/dev/generate-animation-preview.ps1` | `PREVIEW GENERATION PASSED` |

Known nonfatal warnings in the current Windows environment:

- Vite can warn that one built chunk is larger than 500 kB.
- CMake can print FetchContent CMP0135 developer warnings and dependency
  `cmake_minimum_required` deprecation warnings.
- PkgConfig can be missing during SDL/CMake configuration.
- Runtime smoke can warn about a missing WASAPI/audio endpoint and missing
  optional sample WAV files.

Treat those as nonfatal only when the command still prints its success marker.

For manual CMake diagnosis on Windows, prefer the out-of-OneDrive preset:

```cmd
cmake --preset windows-dev
cmake --build --preset windows-dev
ctest --preset windows-dev
```

## Development Server

```bash
npm install
npm run dev
```

`npm run dev` starts browser mode on port 3000. Browser mode is useful for
editing and UI checks, but it cannot spawn native processes, create native
playtest sessions, read runtime logs, or read runtime state snapshots. This is
an interactive long-running server command; stop it with `Ctrl+C`.

The desktop dev server uses the strict Tauri port:

```bash
npm run dev:tauri
```

For the full desktop shell, run:

```bash
npm run desktop:dev
```

Tauri uses `npm run dev:tauri` as its `beforeDevCommand` and opens the editor
against `http://localhost:1420`. This is also an interactive long-running
command. Noninteractive content verification is covered by `verify.ps1` and
`npm run desktop:verify-content`.

When `npm run desktop:verify-content` is run by itself, start
`npm run dev:tauri` first in another terminal or controlled process; the
content check only verifies an already-running `http://127.0.0.1:1420/`
server. The full `scripts/dev/verify.ps1` gate manages that temporary server
automatically when no correct 1420 server is already running.

## Packaged Windows prototype

For a local unsigned packaged prototype, run:

```powershell
npm run desktop:package:windows
```

The helper builds the native runtime, runs `tauri build --debug --no-bundle`,
sets `CARGO_TARGET_DIR` to `%LOCALAPPDATA%\RPGCreatorAI\tauri-target`, copies
`rpg_creator_runtime.exe` next to the produced Tauri executable, and
smoke-launches the packaged app. A successful run prints `PACKAGED SMOKE
PASSED` and `=== WINDOWS PACKAGE PROTOTYPE PASSED ===`. This prototype
intentionally does not create an installer; the installer/signing policy is defined in
`docs/PHASE_11_RELEASE_ARTIFACT_POLICY.md`.

Current release metadata is aligned at version `0.5.0` across npm, Tauri, and
Cargo. Future Windows installer work should target unsigned NSIS first, with
MSI as a later secondary target and code signing deferred until credentials or
certificates are explicitly provided.

Fallback wrapper:

```cmd
scripts\dev\package-windows.bat
```

Generated package artifacts live outside the repo under
`%LOCALAPPDATA%\RPGCreatorAI\tauri-target\debug`. Remove that directory to
clean the prototype output.

First-run app-data behavior is documented in
`docs/FIRST_RUN_APP_DATA_POLICY.md`. To smoke the packaged shell with fresh
temporary `APPDATA` and `LOCALAPPDATA` roots:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/smoke-first-run-app-data.ps1
```

Diagnostics and failed-launch troubleshooting are documented in
`docs/DIAGNOSTICS.md`.

## User workflow

1. Use `npm run desktop:dev` for real filesystem persistence and native
   runtime launch, or `npm run dev` for browser-only editing.
2. On the startup screen, open an existing project folder, create a new
   project, import a project bundle, or use the bundled `data/` sample.
   Browser mode cannot open native folders; its Create Project path starts an
   in-memory project that must be exported as a bundle to persist outside the
   browser session.
3. Edit maps, event pages/commands, common events, and database entries.
4. Run Validate from the toolbar for immediate feedback. Save always validates
   again before writing, blocks on errors, keeps dirty state on write failure,
   and leaves visible recovery feedback below the toolbar.
5. In Playtest, choose Project Start, Current Map, or Selected Event.
6. Launch the selected mode from desktop mode. The shell writes a temporary
   playtest session under the app data directory and launches the native
   runtime with that temp root as `current_dir`.
7. Use Runtime Log, Event Trace, and Runtime State tabs for local debugging.
   Diagnostics folders and failed-launch troubleshooting are documented in
   `docs/DIAGNOSTICS.md`.

## Current Limitations

- Browser mode does not fake native filesystem/runtime capabilities.
- Browser-created projects are memory-backed until exported as a project
  bundle.
- Runtime data is local JSON plus committed assets; there is no cloud service,
  marketplace, proprietary project import, scripting VM, or runtime AI
  dependency.
- Audio files are optional local assets. Missing files/devices warn and
  continue.
