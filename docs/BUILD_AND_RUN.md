# Build and Run Instructions

## Requirements

- Node.js and npm.
- Rust and Cargo for the Tauri desktop bridge.
- Visual Studio Build Tools or Visual Studio with the C++ workload.
- CMake and Ninja.

## Canonical MVP verification

Run the full local green gate from the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1
```

This command runs frontend typecheck, Vitest, frontend build, native C++
configure/build/CTest, Tauri content verification, Rust desktop tests,
runtime smoke, and editor-runtime roundtrip validation. The native build
defaults to `%LOCALAPPDATA%\RPGCreatorAI\build` to avoid OneDrive file locks.

Targeted skip flags for local diagnosis:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1 -SkipFrontend
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1 -SkipDesktop
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1 -SkipRuntime
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1 -SkipSmoke
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
```

Equivalent `.bat` wrappers are available when direct PowerShell script
execution is blocked:

```cmd
scripts\dev\build.bat
scripts\dev\test.bat
scripts\dev\smoke-runtime.bat
```

For manual CMake diagnosis on Windows, prefer the out-of-OneDrive preset:

```cmd
cmake --preset windows-dev
cmake --build --preset windows-dev
ctest --preset windows-dev
```

## Development server

```bash
npm install
npm run dev
```

`npm run dev` starts browser mode on port 3000. Browser mode is useful for
editing and UI checks, but it cannot spawn native processes, create native
playtest sessions, read runtime logs, or read runtime state snapshots.

The desktop dev server uses the strict Tauri port:

```bash
npm run dev:tauri
```

For the full desktop shell, run:

```bash
npm run desktop:dev
```

Tauri uses `npm run dev:tauri` as its `beforeDevCommand` and opens the editor
against `http://localhost:1420`.

## Packaged Windows prototype

For a local unsigned packaged prototype, run:

```powershell
npm run desktop:package:windows
```

The helper builds the native runtime, runs `tauri build --debug --no-bundle`,
sets `CARGO_TARGET_DIR` to `%LOCALAPPDATA%\RPGCreatorAI\tauri-target`, copies
`rpg_creator_runtime.exe` next to the produced Tauri executable, and
smoke-launches the packaged app. This prototype intentionally does not create
an installer; the installer/signing policy is defined in
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

## User workflow

1. Use `npm run desktop:dev` for real filesystem persistence and native
   runtime launch, or `npm run dev` for browser-only editing.
2. Open a project folder or use the bundled `data/` project.
3. Edit maps, event pages/commands, common events, and database entries.
4. Run Validate from the toolbar; Save only writes valid project data.
5. In Playtest, choose Project Start, Current Map, or Selected Event.
6. Open in Runtime from desktop mode. The shell writes a temporary playtest
   session under the app data directory and launches the native runtime with
   that temp root as `current_dir`.
7. Use Runtime Log, Event Trace, and Runtime State tabs for local debugging.

## MVP limitations

- Browser mode does not fake native filesystem/runtime capabilities.
- Runtime data is local JSON plus committed assets; there is no cloud service,
  marketplace, proprietary project import, scripting VM, or runtime AI
  dependency in the MVP.
- Audio files are optional local assets. Missing files/devices warn and
  continue.
