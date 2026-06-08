# Windows Build Notes

## TL;DR
On Windows, build the C++ runtime **outside** the OneDrive-synced repo path. The provided scripts already do this by default.

```cmd
:: Canonical local green gate
scripts\dev\verify.bat

:: Native configure/build/CTest only
scripts\dev\build.bat

:: Focused frontend Vitest plus CTest against the existing native build
scripts\dev\test.bat

:: Unsigned packaged desktop prototype plus smoke launch
scripts\dev\package-windows.bat
```

The verifier defaults the native build directory to
`%LOCALAPPDATA%\RPGCreatorAI\build`.

Successful full verification ends with `=== ALL PASSED ===`. The package
helper ends with `PACKAGED SMOKE PASSED` and
`=== WINDOWS PACKAGE PROTOTYPE PASSED ===`.

## Why
The repository on this machine lives under `C:\Users\<user>\OneDrive\Escritorio\RPGCreatorAI`. OneDrive's filter driver intermittently locks files inside `build/_deps/` while CMake's `FetchContent` is performing rename steps (e.g. `json-populate1234/json` -> `json-src`). The symptom is:

```
file RENAME failed to rename
    .../build/_deps/ex-json-populate1234/json
to
    .../build/_deps/json-src
because: Acceso denegado.
```

The fix is to put the build tree somewhere OneDrive does not sync. `%LOCALAPPDATA%` (`C:\Users\<user>\AppData\Local`) is excluded from OneDrive sync by default, so it is the safest target.

## Overriding the build directory

### `verify-runtime.bat`
```cmd
set BUILD_DIR=D:\rpg-build
scripts\dev\verify-runtime.bat
```

### `verify.ps1`
```powershell
.\scripts\dev\verify.ps1 -BuildDir D:\rpg-build
.\scripts\dev\verify.ps1 -Clean -SkipSmoke    # clean native reconfigure, no smoke/roundtrip
.\scripts\dev\verify.ps1 -SkipFrontend        # skip npm typecheck/test/build
.\scripts\dev\verify.ps1 -SkipDesktop         # skip Tauri content and cargo tests
.\scripts\dev\verify.ps1 -SkipRuntime         # skip C++ configure/build/CTest
.\scripts\dev\verify.ps1 -SkipAssets          # skip Phase 11 asset pipeline validation
```

### `build.ps1` / `build.bat`
```powershell
.\scripts\dev\build.ps1 -BuildDir D:\rpg-build
.\scripts\dev\build.ps1 -Clean
```

```cmd
scripts\dev\build.bat -BuildDir D:\rpg-build
scripts\dev\build.bat -Clean
```

### `test.ps1` / `test.bat`
```powershell
.\scripts\dev\test.ps1 -BuildDir D:\rpg-build
.\scripts\dev\test.ps1 -SkipFrontend
.\scripts\dev\test.ps1 -SkipRuntime
```

```cmd
scripts\dev\test.bat -BuildDir D:\rpg-build
scripts\dev\test.bat -SkipFrontend
scripts\dev\test.bat -SkipRuntime
```

### CMake presets
For manual CMake diagnosis, prefer the Windows preset that writes to
`%LOCALAPPDATA%\RPGCreatorAI\build`. If the compiler is not already on
`PATH`, use `scripts\dev\build.bat` instead; the helper bootstraps
`VsDevCmd.bat` automatically.

```cmd
cmake --preset windows-dev
cmake --build --preset windows-dev
ctest --preset windows-dev
```

### `build_bootstrap.bat`
```cmd
set BUILD_DIR=D:\rpg-build & build_bootstrap.bat
```

If you really want an in-repo build (not recommended on OneDrive systems), point `BUILD_DIR` at a folder inside the repo:
```cmd
set BUILD_DIR=%CD%\build & build_bootstrap.bat
```

## Packaged prototype

CP-010 defines the current local packaging prototype as an unsigned Tauri
debug no-bundle build plus a copied native runtime executable:

```cmd
scripts\dev\package-windows.bat
```

or:

```powershell
npm run desktop:package:windows
```

The helper:

1. Builds/tests the C++ runtime under `%LOCALAPPDATA%\RPGCreatorAI\build`.
2. Sets `CARGO_TARGET_DIR` to `%LOCALAPPDATA%\RPGCreatorAI\tauri-target`.
3. Runs `npm run desktop:build`, which executes `tauri build --debug --no-bundle`
   and uses `src-tauri/tauri.conf.json` `frontendDist = ../dist`.
4. Copies `rpg_creator_runtime.exe` next to the produced Tauri executable so
   the runtime bridge can resolve it from the shell binary directory.
5. Runs `scripts/dev/smoke-packaged-executable-launch.ps1`, which verifies the
   shell executable, colocated runtime copy, package working directory, and
   hidden launch without depending on the repository terminal cwd.

The current user-facing double-click path for the unsigned prototype is:

```text
%LOCALAPPDATA%\RPGCreatorAI\tauri-target\debug\rpgcreator-shell.exe
```

After `npm run desktop:package:windows` succeeds, open that folder in File
Explorer and double-click `rpgcreator-shell.exe`. Do not move
`rpg_creator_runtime.exe` away from that directory; Playtest runtime discovery
uses the shell executable directory as the packaged fallback.

For a current-user shortcut plan, run:

```powershell
.\scripts\dev\create-windows-shortcuts.ps1
```

That command is a dry-run and prints the Desktop and Start Menu `.lnk` targets.
To create shortcuts intentionally, add `-Apply`; to limit the target, add
`-Desktop` or `-StartMenu`; to replace an existing shortcut, add `-Force`.
The helper stays user-scoped and does not require admin rights.

The unsigned no-bundle prototype does not create Start Menu entries
automatically. Automatic Start Menu entries, uninstallers, publisher identity,
and signed installer behavior belong to future NSIS/MSI installer work and
must not be claimed for this local prototype.

Useful options:

```powershell
.\scripts\dev\package-windows.ps1 -SkipNativeBuild
.\scripts\dev\package-windows.ps1 -SkipSmoke
.\scripts\dev\package-windows.ps1 -BuildDir D:\rpg-build
.\scripts\dev\package-windows.ps1 -CargoTargetDir D:\rpg-tauri-target
.\scripts\dev\smoke-packaged-executable-launch.ps1
.\scripts\dev\create-windows-shortcuts.ps1
```

Prototype artifacts are local developer output, not source files:

```cmd
rmdir /s /q "%LOCALAPPDATA%\RPGCreatorAI\tauri-target"
```

CP-011 defines the release artifact policy in
`docs/PHASE_11_RELEASE_ARTIFACT_POLICY.md`. The current shippable developer
artifact remains the unsigned local prototype above. Future installer work
should start with an unsigned NSIS candidate; MSI is secondary, and signing
requires explicit external credentials/certificates.

Branding assets for the packaged desktop shell are sourced from
`src-tauri/icons/icon-source.svg` and documented in
`docs/RELEASE_BRANDING_ASSETS.md`. After changing icons or Tauri metadata, run:

```powershell
.\scripts\dev\verify-branding-assets.ps1
```

First-run desktop state, logs, and temporary playtest sessions are documented
in `docs/FIRST_RUN_APP_DATA_POLICY.md`. After building a packaged prototype,
run this fresh-app-data smoke when changing shell directory policy:

```powershell
.\scripts\dev\smoke-first-run-app-data.ps1
```

Runtime diagnostics and failed-launch support steps are documented in
`docs/DIAGNOSTICS.md`. After changing runtime log, snapshot, or diagnostics
bridge behavior, run:

```powershell
.\scripts\dev\verify-diagnostics.ps1
```

## Cleaning up

The build dir lives outside the repo, so `git clean` won't touch it. Remove it explicitly when needed:
```cmd
rmdir /s /q "%LOCALAPPDATA%\RPGCreatorAI\build"
```

## PowerShell compatibility

`scripts\dev\verify.ps1` no longer uses `New-TemporaryFile`; some older Windows PowerShell versions ship without it. The script now uses `[System.IO.Path]::GetTempFileName()`, which is available in Windows PowerShell 5.1, PowerShell 7+, and any host with .NET available.

## Required tools

- Visual Studio 2022 Build Tools (or VS 2022 Community/Pro/Enterprise) with the C++ workload
- CMake (any modern 3.x or 4.x — we already pin `CMAKE_POLICY_VERSION_MINIMUM=3.5` for FetchContent)
- Ninja (the scripts auto-detect winget-installed Ninja)

The scripts auto-discover all three.

## Canonical Local Gate

`scripts\dev\verify.ps1` is the source-of-truth local validation command. By
default it runs:

- frontend typecheck
- Vitest
- frontend build
- C++ configure/build/CTest
- Tauri content verification
- Rust desktop tests
- runtime smoke
- editor-runtime roundtrip validation

Each gate prints its own header and the script ends with a gate summary.

## Known nonfatal warnings

These warnings are expected in the current Windows setup only when the command
still prints its success marker:

- Vite can warn that one built chunk is larger than 500 kB.
- CMake can print FetchContent CMP0135 developer warnings.
- Dependency `cmake_minimum_required` deprecation warnings can appear while
  configuring bundled third-party projects.
- PkgConfig can be missing during SDL/CMake configuration.
- Runtime smoke can warn about missing optional sample WAV files or an
  unavailable WASAPI/audio endpoint; the runtime continues silently.

## Frontend

The frontend is unaffected by the OneDrive issue because `node_modules/` and `dist/` do not contain rename-heavy CMake metadata. Standard:

```cmd
npm install
npm run typecheck
npm run build
npm test
```

## Runtime smoke

`scripts\dev\smoke-runtime.ps1` accepts `-BuildDir` and now defaults to the same `%LOCALAPPDATA%\RPGCreatorAI\build` location. It launches the runtime from the repo root so `data/` paths resolve correctly, captures stdout/stderr, runs the deterministic `--smoke-shots` feature path into `docs\screenshots\phase10-mvp`, and fails on any `[ERROR]` lines or missing feature-smoke markers.
