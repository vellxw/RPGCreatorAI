# Phase 5 Tasks — Desktop Shell + Real FileSystem + Runtime Bridge

## T1: Tooling
- [ ] Document required tools in `docs/DESKTOP_SHELL_ARCHITECTURE.md`: rustup + stable toolchain, Tauri CLI, Edge WebView2 (default on Win10+).
- [ ] Add Tauri CLI to `devDependencies` (`@tauri-apps/cli`).
- [ ] Add `.cargo/config.toml` redirecting `target-dir` to `%LOCALAPPDATA%\RPGCreatorAI\tauri-target` to keep Rust output out of OneDrive.

## T2: Tauri Project Skeleton
- [ ] `npm run tauri init` (manual review of generated files).
- [ ] Configure `src-tauri/tauri.conf.json`:
  - app title, identifier, version
  - dev URL = Vite dev server
  - production assets path = `dist`
  - strict CSP
  - bundle targets empty (`[]`) for dev mode
- [ ] Add `src-tauri/` to `.gitignore` selectively: include source, exclude `target/`.

## T3: IPC Surface
- [ ] Define Rust types matching `src/types/project.ts` (`ProjectData`, `MapData`, `ItemDatabase`, `FullProjectState`, `SaveResult`, `RuntimeStatus`, `RuntimeLaunchResult`).
- [ ] Implement `#[tauri::command]`s:
  - `fs_open_project_dialog`
  - `fs_read_project`
  - `fs_write_project`
  - `fs_list_backups`
  - `fs_close_project`
  - `runtime_launch`
  - `runtime_kill`
  - `runtime_status`
  - `config_get_recents`
  - `config_add_recent`
- [ ] Register the commands in `src-tauri/src/main.rs` with explicit allowlist.
- [ ] Add `window.rpgBridge` typings in `src/types/rpgBridge.ts` and a thin renderer wrapper.

## T4: FileSystem Capability + Path Sandbox
- [ ] Implement `canonicalize_inside_user_space`: rejects paths outside `%USERPROFILE%`/`$HOME`, resolves symlinks before checking, returns `PathBuf`.
- [ ] Implement `ensure_inside(root, path)`: rejects `path` if not a descendant of `root`.
- [ ] Implement `must_contain_project_json`: rejects roots without `data/project.json`.
- [ ] Wire all `fs_*` commands through these guards.

## T5: Atomic Write + Backup
- [ ] Implement `atomic_write_json(path, value)`: writes `<path>.tmp`, calls `std::fs::rename`.
- [ ] Implement `backup_existing(root, relative_path)`: copies to `<root>/.backups/<basename>.<timestamp>.json` if the source exists.
- [ ] Implement `prune_backups(root, max_per_file)`: keeps last N per `<basename>` by mtime.
- [ ] Auto-add `.backups/` to the project's `.gitignore` if missing (only on first save).
- [ ] Surface backup-write failures as `SaveResult` warnings, not errors.

## T6: Runtime Spawn
- [ ] Implement `locate_runtime_executable` with the search order in design.md.
- [ ] Implement `runtime_launch` with `current_dir = projectRoot`, store `Child` in a global `Mutex<Option<Child>>`.
- [ ] Implement `runtime_status` using `try_wait` to detect natural exit.
- [ ] Implement `runtime_kill` with graceful kill + wait (with a hard timeout).
- [ ] Refuse a second concurrent launch.
- [ ] Never exec a string; only known executable paths with structured args.

## T7: Renderer Adapters
- [ ] Replace `FileSystemAdapter` no-op bodies with `window.rpgBridge.fs.*` calls.
- [ ] Update `DesktopRuntimeAdapter` to call `window.rpgBridge.runtime.*`.
- [ ] Update `adapterFactory.detectDesktopShell()` to check `window.rpgBridge` (instead of `runtimeBridge`).
- [ ] Keep `BrowserMemoryAdapter` and `BrowserRuntimeAdapter` paths unchanged for browser/Vite mode.

## T8: Editor UX (no new screens, no redesign)
- [ ] Add "Open Project" toolbar action visible only when `window.rpgBridge` is present.
- [ ] Add "Recent Projects" submenu under Project (also gated on shell presence).
- [ ] In Playtest screen, when `canLaunch()` is true, "Open in Runtime" button calls `runtime_launch` and live-binds to status.
- [ ] When the runtime exits naturally, update the toolbar status indicator.
- [ ] Browser mode unchanged.

## T9: Validation Gate
- [ ] Run existing `validateProject()` in `performSave()` before invoking `fs_write_project`.
- [ ] Errors block the IPC call entirely.
- [ ] Warnings still allow the save and surface in the bottom panel.

## T10: Tests
- [ ] Renderer unit tests for new adapter wiring against a mocked `window.rpgBridge` (success + error paths).
- [ ] Rust unit tests for `canonicalize_inside_user_space`, `ensure_inside`, `backup_existing`, `prune_backups`.
- [ ] Smoke test: `npm run desktop:build` exits 0 and produces `rpgcreator.exe`.
- [ ] Existing 32 vitest tests stay green.
- [ ] `scripts/dev/verify-runtime.bat` continues to pass.

## T11: Build & Packaging
- [ ] `npm run desktop:dev` — Vite + Tauri shell, hot reload.
- [ ] `npm run desktop:build` — unsigned dev `.exe`, no installer.
- [ ] Document output paths in `docs/DESKTOP_SHELL_ARCHITECTURE.md`.
- [ ] Verify `target/` lands in `%LOCALAPPDATA%\RPGCreatorAI\tauri-target` per `.cargo/config.toml`.

## T12: Documentation
- [ ] `docs/PHASE_5_SCOPE.md`
- [ ] `docs/DESKTOP_SHELL_ARCHITECTURE.md`
- [ ] `docs/FILESYSTEM_ADAPTER.md`
- [ ] `docs/RUNTIME_LAUNCH_BRIDGE.md`
- [ ] Update `docs/EDITOR_PERSISTENCE.md` to point at the now-real FileSystemAdapter.
- [ ] Update `docs/RUNTIME_BRIDGE.md` to point at the now-real DesktopRuntimeAdapter.
- [ ] Append `docs/VALIDATION_LOG.md`.
- [ ] Update `docs/GOAL_STACK.md`.

## T13: Validation & Commit
- [ ] `npx tsc --noEmit`
- [ ] `npx vite build`
- [ ] `npx vitest run`
- [ ] `cargo test` in `src-tauri/`
- [ ] `npm run desktop:build`
- [ ] `scripts\dev\verify-runtime.bat`
- [ ] `scripts\dev\verify.ps1` (with smoke)
- [ ] Commit and push only when all of the above are green and `git status --short` is clean.
- [ ] Final report with exact outputs.

## T14: Fallback Branch (Conditional)
Only triggered if a Tauri-specific blocker is encountered:
- [ ] Mirror T2–T7 with Electron + `contextBridge`.
- [ ] Document the trigger and the trade-offs in `docs/DESKTOP_SHELL_ARCHITECTURE.md`.
