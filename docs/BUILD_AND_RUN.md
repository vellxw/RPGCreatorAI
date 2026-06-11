# Build and Run Instructions

## For Creators: Open An Existing Windows Prototype

These steps require no terminal, developer tools, or repository checkout. They
apply only after a maintainer has prepared the unsigned local prototype on the
same Windows account.

1. Open File Explorer.
2. Paste `%LOCALAPPDATA%\RPGCreatorAI\tauri-target\debug` into the address bar.
3. Confirm that `rpgcreator-shell.exe` and `rpg_creator_runtime.exe` are both
   present.
4. Double-click `rpgcreator-shell.exe`, or use an RPGCreatorAI Desktop/Start
   Menu shortcut that a maintainer previously created.
5. Wait for the branded `Preparing your workspace` splash to advance to the
   project-selection screen.
6. Open, import, or create a project, or start with the bundled sample.

Do not separate the two executable files: the desktop shell uses its own folder
as the packaged runtime fallback. The startup screen reports native runtime
readiness before Playtest is opened.

The current artifact is an unsigned Tauri debug no-bundle prototype, not an
installed Windows application. It does not provide an installer, uninstaller,
automatic updates, automatic Start Menu registration, or a verified publisher.
Only open a local build from a trusted maintainer. The remaining sections are
for contributors and maintainers who build or validate the project.

## Requirements

- Node.js 22 recommended and npm 10+.
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

# First-paint startup budget measurement. Starts/reuses Vite, reads browser
# paint/navigation timing, and writes local artifacts under
# output/playwright/phase12-px021-first-paint.
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/measure-first-paint.ps1

# Runtime diagnostics entry point and no-log failure-path coverage.
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify-diagnostics.ps1

# Release branding metadata/icon checks.
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify-branding-assets.ps1

# Asset export pipeline validation, without rewriting committed outputs.
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/export-runtime-assets.ps1 --validate-only

# Animation strip normalization manifest validation, without rewriting outputs.
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/normalize-animation-strip.ps1 --validate-manifest assets/generated/source/phase11_animation_normalization/player_adventurer_walk_down.json

# Animation preview manifest validation, without rewriting preview outputs.
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/generate-animation-preview.ps1 --validate-preview-manifest assets/generated/source/phase11_animation_previews/player_adventurer_walk_down.json

# First-run packaged-shell app-data smoke. Run after `npm run desktop:package:windows`.
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/smoke-first-run-app-data.ps1

# Packaged executable launch smoke. Run after `npm run desktop:package:windows`
# to validate the exact executable path a user can double-click.
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/smoke-packaged-executable-launch.ps1

# Current-user desktop/Start Menu shortcut plan. Dry-run by default; pass
# -Apply only when you intentionally want to create .lnk files.
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/create-windows-shortcuts.ps1

# Screenshot analysis audit helper. Prints palette metrics; it is not a pass/fail gate.
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/analyze-screenshots.ps1
```

To rewrite asset export, normalization, or preview outputs intentionally, run
the same scripts without the validation-only flags and with the source/input
arguments documented in `docs/ASSET_PIPELINE.md`.

Equivalent `.bat` wrappers are available when direct PowerShell script
execution is blocked:

```cmd
scripts\dev\build.bat
scripts\dev\test.bat
scripts\dev\smoke-runtime.bat
scripts\dev\smoke-browser-editor.bat
scripts\dev\measure-first-paint.bat
scripts\dev\verify-diagnostics.bat
scripts\dev\verify-branding-assets.bat
scripts\dev\export-runtime-assets.bat
scripts\dev\normalize-animation-strip.bat
scripts\dev\generate-animation-preview.bat
scripts\dev\smoke-first-run-app-data.bat
scripts\dev\smoke-packaged-executable-launch.bat
scripts\dev\create-windows-shortcuts.bat
```

Expected success markers:

| Command | Success marker |
| --- | --- |
| `scripts/dev/verify.ps1` | `=== ALL PASSED ===` |
| `scripts/dev/build.ps1` | native CTest reports `100% tests passed` |
| `scripts/dev/test.ps1` | `=== TESTS PASSED ===` |
| `scripts/dev/smoke-runtime.ps1` | `SMOKE PASSED` |
| `scripts/dev/smoke-browser-editor.ps1` | `BROWSER SMOKE PASSED` or explicit `BROWSER SMOKE SKIPPED: <reason>` |
| `scripts/dev/measure-first-paint.ps1` | `FIRST PAINT MEASURE PASSED` or explicit `FIRST PAINT MEASURE SKIPPED: <reason>` |
| `scripts/dev/verify-diagnostics.ps1` | `RUNTIME DIAGNOSTICS VERIFY PASSED` |
| `scripts/dev/verify-branding-assets.ps1` | `BRANDING ASSETS PASSED` |
| `npm run desktop:package:windows` | `PACKAGED EXECUTABLE LAUNCH SMOKE PASSED`, `PACKAGED SMOKE PASSED`, and `=== WINDOWS PACKAGE PROTOTYPE PASSED ===` |
| `scripts/dev/smoke-first-run-app-data.ps1` | `FIRST-RUN APP DATA SMOKE PASSED` |
| `scripts/dev/smoke-packaged-executable-launch.ps1` | `PACKAGED EXECUTABLE LAUNCH SMOKE PASSED` |
| `scripts/dev/create-windows-shortcuts.ps1` | `WINDOWS SHORTCUT PLAN PASSED` by default, or `WINDOWS SHORTCUT CREATION PASSED` with `-Apply` |
| `scripts/dev/export-runtime-assets.ps1 --validate-only` | `Runtime asset export validation passed.` |
| `scripts/dev/normalize-animation-strip.ps1 --validate-manifest ...` | `Animation strip normalization validation passed.` |
| `scripts/dev/generate-animation-preview.ps1 --validate-preview-manifest ...` | `Animation preview generation validation passed.` |

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

Desktop shell architecture, IPC boundaries, browser/desktop adapter selection,
and output paths are documented in
`docs/DESKTOP_SHELL_ARCHITECTURE.md`.

When `npm run desktop:verify-content` is run by itself, start
`npm run dev:tauri` first in another terminal or controlled process; the
content check only verifies an already-running `http://127.0.0.1:1420/`
server. The full `scripts/dev/verify.ps1` gate manages that temporary server
automatically when no correct 1420 server is already running.

## Packaged Windows prototype

This section prepares the artifact used by the creator steps at the top of this
document. It is a maintainer/developer workflow and is not required each time a
creator opens an already-built prototype.

For a local unsigned packaged prototype, run:

```powershell
npm run desktop:package:windows
```

The helper builds the native runtime, runs `tauri build --debug --no-bundle`,
sets `CARGO_TARGET_DIR` to `%LOCALAPPDATA%\RPGCreatorAI\tauri-target`, copies
`rpg_creator_runtime.exe` next to the produced Tauri executable, and
smoke-launches the packaged app through
`scripts/dev/smoke-packaged-executable-launch.ps1`. A successful run prints
`PACKAGED EXECUTABLE LAUNCH SMOKE PASSED`, `PACKAGED SMOKE PASSED`, and
`=== WINDOWS PACKAGE PROTOTYPE PASSED ===`. This prototype
intentionally does not create an installer; the installer/signing policy is defined in
`docs/PHASE_11_RELEASE_ARTIFACT_POLICY.md`.

The user-facing executable path for the current unsigned prototype is:

```text
%LOCALAPPDATA%\RPGCreatorAI\tauri-target\debug\rpgcreator-shell.exe
```

Users can double-click that executable from File Explorer after the package
helper has run. Keep `rpg_creator_runtime.exe` in the same directory; the
desktop bridge can resolve the native runtime from the shell executable
directory, and runtime playtests still launch with the selected project root as
their working directory.

Optional current-user shortcuts:

```powershell
# Dry-run: prints Desktop and Start Menu targets without writing .lnk files.
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/create-windows-shortcuts.ps1

# Create current-user Desktop and Start Menu shortcuts.
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/create-windows-shortcuts.ps1 -Apply

# Create only one target.
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/create-windows-shortcuts.ps1 -Desktop -Apply
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/create-windows-shortcuts.ps1 -StartMenu -Apply
```

This helper is not an installer. It does not write to Program Files, all-users
Start Menu folders, the registry, or an uninstaller entry. It only creates
current-user `.lnk` files when `-Apply` is present, and refuses to overwrite an
existing shortcut unless `-Force` is also provided.

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

To rerun only the executable launch assumption check against an existing
packaged prototype:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/smoke-packaged-executable-launch.ps1
```

Restricted-policy fallback:

```cmd
scripts\dev\smoke-first-run-app-data.bat
scripts\dev\smoke-packaged-executable-launch.bat
scripts\dev\create-windows-shortcuts.bat
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
