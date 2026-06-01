# Windows Build Notes

## TL;DR
On Windows, build the C++ runtime **outside** the OneDrive-synced repo path. The provided scripts already do this by default.

```cmd
:: Canonical MVP green gate
scripts\dev\verify.bat

:: Native configure/build/CTest only
scripts\dev\build.bat

:: Focused frontend Vitest plus CTest against the existing native build
scripts\dev\test.bat
```

The verifier defaults the native build directory to
`%LOCALAPPDATA%\RPGCreatorAI\build`.

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
5. Smoke-launches the packaged executable, waits 5 seconds, and terminates it.

Useful options:

```powershell
.\scripts\dev\package-windows.ps1 -SkipNativeBuild
.\scripts\dev\package-windows.ps1 -SkipSmoke
.\scripts\dev\package-windows.ps1 -BuildDir D:\rpg-build
.\scripts\dev\package-windows.ps1 -CargoTargetDir D:\rpg-tauri-target
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

## Canonical gate

`scripts\dev\verify.ps1` is the source-of-truth MVP validation command. By
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

## Frontend

The frontend is unaffected by the OneDrive issue because `node_modules/` and `dist/` do not contain rename-heavy CMake metadata. Standard:

```cmd
npm install
npm run typecheck
npm run build
npm test
```

## Runtime smoke

`scripts\dev\smoke-runtime.ps1` accepts `-BuildDir` and now defaults to the same `%LOCALAPPDATA%\RPGCreatorAI\build` location. It launches the runtime from the repo root so `data/` paths resolve correctly, captures stdout/stderr, runs the deterministic `--smoke-shots` feature path into `docs\screenshots\phase10-mvp`, and fails on any `[ERROR]` lines or missing MVP smoke markers.
