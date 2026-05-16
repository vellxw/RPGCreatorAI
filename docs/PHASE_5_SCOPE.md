# Phase 5 Scope — Desktop Shell + Real FileSystem + Runtime Bridge

## Goal
Turn the React/Vite editor into a real desktop application that can read and write project JSON files on disk and launch the C++ runtime. The browser/Vite dev mode remains fully functional as a fallback for fast UI iteration.

## In Scope

### Desktop Shell
- **Tauri 2.x** as the default shell. Electron is a documented fallback only if a Tauri-specific blocker appears during implementation.
- `npm run desktop:dev` launches the editor inside the shell with hot reload.
- `npm run desktop:build` produces an unsigned dev `.exe` for local testing.

### Real FileSystem Persistence
- `FileSystemAdapter` becomes a real implementation backed by Tauri commands.
- Reads `data/project.json`, `data/maps/*.json`, `data/database/items.json`.
- Atomic writes (temp file + rename) to avoid truncated saves.
- Path sandboxing: cannot read or write outside the open project root.
- `validateProject()` runs before every save; errors block the write.
- Backups before overwrite, stored in `<projectRoot>/.backups/`, pruned to last N per file.

### Project Open / Save / Recent
- Native folder picker for "Open Project".
- Save writes back to the open project root.
- Recent projects list persisted in user data dir.
- Confirm-on-close-with-unsaved-changes already works from Phase 4.

### Real Runtime Bridge
- `DesktopRuntimeAdapter` calls into the shell to spawn `rpg_creator_runtime.exe`.
- Search order: `RPG_RUNTIME_EXE` env, project's `build/`, `%LOCALAPPDATA%\RPGCreatorAI\build`, alongside the shell binary.
- Tracks live status via `try_wait`; only one instance at a time.
- Graceful kill on stop or window close.

### Browser Fallback
- Without the shell, factory selects `BrowserMemoryAdapter` + `BrowserRuntimeAdapter` (existing behaviour).
- "Open Project" UI is hidden in browser mode; existing JSON Import remains.

### Security
- Allowlisted IPC surface: a fixed set of named commands, no generic `invoke(name, args)`.
- Path canonicalisation rejects symlink escape and any path outside `%USERPROFILE%`/`$HOME`.
- Process spawning uses structured args, never `exec(string)`.
- No secrets committed; `.env` and config remain gitignored.

### Build Strategy
- Cargo `target-dir` redirected to `%LOCALAPPDATA%\RPGCreatorAI\tauri-target` to dodge OneDrive locks (consistent with Phase 4.1).
- `src-tauri/target/` gitignored.

### Tests
- Renderer unit tests against a mocked `window.rpgBridge` (success + error paths).
- Rust unit tests for path sandbox, atomic write, backup, prune.
- Smoke: `npm run desktop:build` exits 0 and the produced `.exe` launches.
- Existing 32 vitest tests + Phase 4.1 C++ pipeline stay green.

## Out of Scope (Hard Boundaries)
- Real AI provider calls (no API keys, no network)
- Image generation, 3D generation, Tripo
- GitHub OAuth, cloud sync, marketplace
- Plugin system
- Advanced scripting (Lua, in-runtime JS)
- HD-2D renderer changes
- Full installer / code signing / auto-update / store distribution
- New screens or UI redesign

## Success Criteria
1. `npm run desktop:dev` opens the editor in a desktop window.
2. Open Project dialog selects a folder containing `data/project.json` and the editor populates from disk.
3. Editing an event and pressing Save writes the JSON files atomically and creates `.backups/`.
4. Validation errors block saves; warnings do not.
5. Open in Runtime spawns `rpg_creator_runtime.exe` with the project root as cwd; the runtime window appears.
6. Stop or closing the editor kills the runtime cleanly.
7. Browser mode (`npm run dev`) continues to behave exactly as in Phase 4.1.
8. Frontend typecheck/build/tests + Rust tests + C++ pipeline all green.
9. `git status --short` clean after commit. No build artifacts, no secrets.
