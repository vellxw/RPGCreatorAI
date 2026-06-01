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

## Development server

```bash
npm install
npm run dev
```

The desktop dev server uses the strict Tauri port:

```bash
npm run dev:tauri
```
