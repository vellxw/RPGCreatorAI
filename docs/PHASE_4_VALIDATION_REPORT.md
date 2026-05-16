# Phase 4 Validation Report — Editor Persistence & Runtime Bridge

## Summary
Phase 4 implementation complete and now fully green after Phase 4.1 hardening.
Editor mutations flow through a real reducer-backed store, validated by a
stricter validation engine, and persisted via a `ProjectDataAdapter`
abstraction. Runtime launch is gated through a `RuntimeLaunchAdapter`. All
frontend and runtime validation pipelines pass on this Windows + OneDrive
environment.

## Frontend

### TypeScript
```
$ npx tsc --noEmit
exit=0
```
**Result: PASS** ✅

### Vite Build
```
$ npx vite build
vite v6.4.2 building for production...
1706 modules transformed.
dist/index.html                   0.68 kB | gzip:  0.45 kB
dist/assets/index-DAIU1_MT.css   30.30 kB | gzip:  6.37 kB
dist/assets/index-DJCOi0Gc.js   290.01 kB | gzip: 83.86 kB
built in 15.99s
exit=0
```
**Result: PASS** ✅

### Vitest Unit Tests
```
$ npx vitest run
RUN  v4.1.6
Test Files  4 passed (4)
     Tests  32 passed (32)
exit=0
```
Coverage by suite:
- `BrowserMemoryAdapter.test.ts` — 6 tests
- `RuntimeLaunchAdapter.test.ts` — 5 tests
- `validateProject.test.ts` — 11 tests
- `projectReducer.test.ts` — 10 tests

**Result: PASS** ✅

## C++ Runtime

### Configure + Build + Test (out-of-OneDrive build dir)
```
$ scripts\dev\verify-runtime.bat
=== Configuration ===
  Repo:  C:\Users\franc\OneDrive\Escritorio\RPGCreatorAI
  Build: C:\Users\franc\AppData\Local\RPGCreatorAI\build
=== CONFIGURE ===
... cmake configures cleanly ...
-- Configuring done
-- Generating done
=== BUILD ===
[1/317] ...
[317/317] Linking CXX executable rpg_creator_runtime.exe
=== TEST ===
Test project C:/Users/franc/AppData/Local/RPGCreatorAI/build
    Start 1: RPGTests
1/1 Test #1: RPGTests .........................   Passed    0.26 sec
100% tests passed, 0 tests failed out of 1
=== ALL PASSED ===
```
**Result: PASS** ✅

### Runtime Smoke (3-second launch + log scrape)
```
$ powershell -File scripts\dev\verify.ps1
=== RUNTIME SMOKE ===
OK: process still running (pid=21472) after 3 s -- terminating...
--- stdout ---
[INFO] RPG Creator Runtime starting...
[INFO] Project loaded: Demo RPG
[INFO] Map loaded: town
SMOKE PASSED
=== ALL PASSED ===
```
**Result: PASS** ✅

## What Phase 4.1 Changed

### Scripts
- `scripts/dev/verify.ps1`
  - Replaced `New-TemporaryFile` with `[System.IO.Path]::GetTempFileName()`
    so it runs on Windows PowerShell hosts that don't expose the cmdlet.
  - Added `-BuildDir` parameter; default is
    `%LOCALAPPDATA%\RPGCreatorAI\build` (outside OneDrive).
  - Now passes `-S <repo>` and `-B <buildDir>` explicitly to `cmake` and
    `ctest --test-dir <buildDir>`.
  - Forwards `BuildDir` to `smoke-runtime.ps1`.

- `scripts/dev/smoke-runtime.ps1`
  - Accepts a `-BuildDir` parameter; defaults to the same out-of-OneDrive
    location used by `verify.ps1`.
  - Launches the runtime with `WorkingDirectory = repoRoot` so its
    `data/` lookups resolve correctly even though the executable lives
    outside the repo.
  - Replaced an em-dash with `--` in a status line so older PowerShell
    hosts don't mis-parse it under non-UTF-8 code pages.

- `scripts/dev/verify-runtime.bat` (new)
  - Pure cmd-shell version of the build pipeline. No PowerShell required.
  - Honours `BUILD_DIR` env var, defaults to the LOCALAPPDATA location.
  - Auto-discovers VsDevCmd, cmake, and ninja.

- `build_bootstrap.bat`
  - Now defaults to `%LOCALAPPDATA%\RPGCreatorAI\build` for the same
    reason. Documented override via `set BUILD_DIR=...`.

### Docs
- `docs/WINDOWS_BUILD_NOTES.md` (new): explains the OneDrive issue,
  recommended build path, override hooks, and PowerShell compatibility.
- `docs/PHASE_4_VALIDATION_REPORT.md`: refreshed with the green pipeline.
- `docs/VALIDATION_LOG.md`: appended Phase 4.1 entry.
- `docs/GOAL_STACK.md`: updated to mark Phase 4.1 complete.

## OneDrive Issue: Resolved
The "file RENAME failed ... Acceso denegado" failure during cmake
FetchContent was a real lock from the OneDrive filter driver while the
build tree lived inside the synced folder. Moving the CMake binary
directory to `%LOCALAPPDATA%\RPGCreatorAI\build` removes the contended
files from OneDrive entirely. After this change the C++ pipeline
configures, builds, and tests cleanly.

## Git State
The build tree lives outside the repo, so `git status` is unaffected.
`.gitignore` already excluded `build/` for the legacy in-repo path.

## Final Verdict
- Frontend: GREEN
- C++ runtime: GREEN
- Smoke: GREEN
- Working tree: clean (after commit)
