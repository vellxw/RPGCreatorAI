# Phase 5 Validation Report — Desktop Shell + Real FileSystem + Runtime Bridge

## Toolchain

| Tool | Result |
|------|--------|
| `rustup` install (user-space, no admin) | PASS |
| `rustc --version` | `rustc 1.95.0 (59807616e 2026-04-14)` |
| `cargo --version` | `cargo 1.95.0 (f2d3ce0bd 2026-03-21)` |
| `npx tauri --version` | `tauri-cli 2.11.1` |
| Cargo `target-dir` redirected to `%LOCALAPPDATA%\RPGCreatorAI\tauri-target` | PASS |

## Frontend

```
$ npx tsc --noEmit          → exit 0
$ npx vite build            → exit 0 (295 KB JS, ~19s)
$ npx vitest run            → 6 files / 43 tests passed
```

## Rust shell

```
$ cargo build --manifest-path src-tauri/Cargo.toml          → exit 0 (4m45s first build)
$ cargo test  --manifest-path src-tauri/Cargo.toml --lib    → 14/14 tests passed
```
Tests cover: path canonicalisation (user-space / system path / dotdot escape / sibling rejection / normal join), atomic write with backup, backup pruning, project.json existence guard, .gitignore amendment, runtime executable resolution.

## Desktop dev

```
$ npm run desktop:dev
... Vite v6.4.2 ready (127.0.0.1:1420)
... Running `<targetDir>\debug\rpgcreator-shell.exe`
```

| Check | Result |
|-------|--------|
| Vite bound to `127.0.0.1:1420` with `--strictPort` | PASS |
| `scripts/dev/verify-tauri-content.ps1` (regression check) | PASS — `OK: serving the RPGCreatorAI editor` |
| Page `<title>` | `RPGCreatorAI — Visual Editor` |
| Required DOM strings (`RPGCreatorAI`, `My First RPG`, `Maps`, `Events`, `AI Tools`) | All present, none missing |
| `--strictPort` fail-loud confirmed | PASS — `Error: Port 1420 is already in use` exit 1 |
| Tauri window screenshot | `docs/screenshots/phase-5/02-tauri-window.png` (1456×939) |
| Renderer screenshot | `docs/screenshots/phase-5/01-tauri-dev-content.png` |

## C++ runtime regression

```
$ scripts\dev\verify-runtime.bat                 → exit 0, 1/1 tests passed
$ powershell -File scripts\dev\verify.ps1        → exit 0
   === RUNTIME SMOKE ===
   OK: process still running (pid=19120) after 3 s -- terminating...
   --- stdout ---
   [INFO] RPG Creator Runtime starting...
   [INFO] Project loaded: My First RPG
   [INFO] Map loaded: town
   SMOKE PASSED
```

## What is real vs seam

| Capability | Status |
|------------|--------|
| Tauri 2.11 desktop shell | REAL — runs, opens window, loads editor |
| `window.rpgBridge` typed IPC surface | REAL — installed by `src/adapters/tauriBridge.ts` when `__TAURI_INTERNALS__` is present |
| `FileSystemAdapter` reads from disk | REAL via `fs_read_project` — sandboxed to user-space + project root |
| `FileSystemAdapter` writes to disk | REAL via `fs_write_project` — atomic write + per-file backup + `.backups/` pruning + auto `.gitignore` amend |
| Path sandbox | REAL — `safe_path::canonicalize_inside_user_space` + `ensure_inside` + `join_inside`, all unit-tested |
| Backups before overwrite | REAL — `<projectRoot>/.backups/<basename>.<ISO-Z>.json`, pruned to 10 |
| `RuntimeLaunchAdapter` (Desktop) | REAL — `runtime_launch` spawns `rpg_creator_runtime.exe` via `std::process::Command` with `current_dir = projectRoot`, no shell, structured args, single-instance enforcement, `try_wait`-based status polling, graceful kill |
| Runtime executable resolution | REAL — env override → `<root>/build/` → `%LOCALAPPDATA%\RPGCreatorAI\build\` → next to shell binary |
| Recent projects | REAL — persisted at `%APPDATA%\RPGCreatorAI\config.json` |
| Browser fallback | REAL — `BrowserMemoryAdapter` + `BrowserRuntimeAdapter` selected when `window.rpgBridge` is absent (factory feature-detection unchanged from Phase 4) |
| AI provider calls | UNCHANGED — still mock per Phase 5 scope |
| Bundled installer / signing / store | NOT in scope |

## Bug uncovered and fixed during Phase 5

Tauri originally chained to `npm run dev` which used port 3000. Vite would silently fall back when 3000 was occupied, and Tauri opened a webview onto whichever app happened to be on the chosen port. Fixed by introducing a dedicated `npm run dev:tauri` on port 1420 with `--strictPort`. Regression check added (`scripts/dev/verify-tauri-content.ps1`) that asserts the response from `127.0.0.1:1420/` contains `<title>RPGCreatorAI` and `/src/main.tsx`.
