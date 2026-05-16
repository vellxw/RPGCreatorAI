# Phase 5 Requirements — Desktop Shell + Real FileSystem + Runtime Bridge

## R1: Desktop Shell
The editor must run inside a desktop shell that gives it native filesystem access and the ability to spawn the C++ runtime. The shell is selected after a documented evaluation in `design.md`. **Default choice: Tauri 2.x.** Electron is the documented fallback only if a Tauri-specific blocker is found during implementation.

The desktop shell is an opt-in target: the existing browser/Vite dev mode must keep working unchanged for fast UI iteration and for users who do not have the desktop toolchain installed.

## R2: Real FileSystemAdapter
A real implementation of `ProjectDataAdapter` that reads from and writes to actual project files on disk:

- `data/project.json`
- `data/maps/*.json`
- `data/database/items.json`

Implementation must:

- Read whole files synchronously from the desktop side, return parsed JSON to the editor
- Write files atomically (write to a temp file in the same directory, then rename) to avoid leaving truncated JSON on crash
- Refuse to read or write any path outside the currently-open project root
- Validate JSON serialisability and run the existing `validateProject()` gate before any write
- Surface OS errors (permission denied, disk full, file locked) cleanly to the editor as `SaveResult { success: false, error }`

## R3: Project Open / Save Workflow
The editor must support the following workflows in desktop mode:

- **Open project**: native folder picker, validates the folder contains a `data/project.json`, loads it through the adapter, sets the current project root, marks the editor as clean
- **Save**: writes back to the current project root using the active adapter (no folder picker)
- **Save As / Export bundle**: still available as the JSON export already implemented in Phase 4
- **Recent projects**: the shell remembers the last N opened project roots in a config file in the user data dir
- **Close project**: warns on unsaved changes, returns the editor to an empty/no-project state

In browser mode, "Open project" is hidden or replaced by the existing Import-from-JSON flow.

## R4: Backup Before Overwrite
Before overwriting any tracked file (`project.json`, `maps/*.json`, `items.json`), the FileSystemAdapter must create a timestamped copy under `<projectRoot>/.backups/`:

- Format: `<filename>.<ISO-timestamp>.json` (e.g. `town.2026-05-16T03-12-44Z.json`)
- Backups are pruned to the last N per file (default: 10) to bound disk usage
- `.backups/` is added to the project's `.gitignore` automatically when missing
- Backup write failure must not abort the user's save; it is logged and surfaced as a warning, not an error

## R5: RuntimeLaunchAdapter
A real implementation that the desktop shell exposes to the editor through a typed bridge (Tauri `invoke` commands or Electron `contextBridge`):

- `canLaunch(): boolean` — true when the desktop shell is present and the runtime executable is locatable
- `getExecutablePath(): string | null` — resolves the runtime binary based on `BUILD_DIR` env / config / fallback search order
- `launch(projectRoot: string): Promise<RuntimeLaunchResult>` — spawns the runtime with the project root as its working directory, returns the OS PID
- `getStatus(): 'unavailable' | 'ready' | 'running'` — reflects whether a child process is currently alive
- `kill(): Promise<void>` — terminates the child process gracefully (SIGTERM/Win32 kill), with a hard timeout

Only one runtime instance may be running at a time. Status changes must propagate to the Playtest screen status bar.

## R6: Browser Fallback
When the editor runs in browser/Vite dev mode (no shell):

- The factory selects `BrowserMemoryAdapter` and `BrowserRuntimeAdapter` (already exists)
- "Open project" UI is hidden or replaced by the existing JSON import
- "Save" continues to work in-memory; the toolbar still offers "Export" to download a bundle
- The Playtest screen continues to show the "Editor Preview (simulated) — not the native runtime" banner
- No Phase 5 code path may assume desktop APIs are present

## R7: Security Rules
- **No secrets committed**: all desktop-shell config is local; `tauri.conf.json` and equivalent files do not contain API keys; `.env` remains gitignored
- **Path sandboxing**: the shell's filesystem capabilities are scoped to the currently-open project root. The editor cannot read or write outside it. Symlink escape is rejected (resolve to canonical path before allowing access).
- **Confirm destructive overwrite**: when "Save As" or "Open project" would replace an existing project, show a confirmation dialog
- **Validate before save**: existing `validateProject()` gate is mandatory in desktop mode too. Errors block the write.
- **No shell command injection**: `RuntimeLaunchAdapter` spawns a known executable path with structured arguments; never `exec(string)` with concatenated user input
- **Allowlisted IPC**: the shell exposes a small, fixed set of commands (`fs.readProject`, `fs.writeProject`, `fs.openDialog`, `runtime.launch`, `runtime.kill`, `runtime.status`, `config.recents`). Anything else is rejected at the shell layer.

## R8: Build & Packaging (Dev Mode)
Phase 5 must produce a working **dev mode** desktop build for Windows:

- A single command starts the editor as a desktop app pointing at the local Vite dev server
- A second command builds a non-installer Windows binary (e.g. `.exe` directly, or `target/release/<name>.exe`) suitable for local testing
- Build outputs land **outside OneDrive** by default (consistent with Phase 4.1) — at minimum, document where they go and how to override
- Full installer / signing / auto-update / store-ready packaging is **out of scope** for Phase 5 (deferred to a later polish phase)

## R9: Tests
- Unit tests for the new desktop adapter glue where it can run without the shell (path canonicalisation, backup naming, validation gate, recents store)
- Integration smoke: a script that builds the desktop binary in dev mode and exits 0 on success
- The existing 32 frontend tests must continue to pass
- The C++ runtime build must continue to pass via the existing Phase 4.1 scripts

## R10: Documentation
- `docs/PHASE_5_SCOPE.md` — what is in/out of scope
- `docs/DESKTOP_SHELL_ARCHITECTURE.md` — chosen shell, IPC surface, capability model
- `docs/FILESYSTEM_ADAPTER.md` — how reads/writes/backups work and what the security perimeter is
- `docs/RUNTIME_LAUNCH_BRIDGE.md` — how the shell finds and spawns the C++ runtime, what status codes mean, how the editor interacts

## R11: Out of Scope (Hard Boundaries)
Explicitly **not** in Phase 5:
- Real AI provider calls (no API keys, no network calls to OpenAI/Claude/Gemini/etc.)
- Image generation, 3D generation, Tripo
- GitHub OAuth or any authenticated remote
- Cloud sync, marketplace, plugins
- Advanced scripting (Lua, JS-in-runtime, etc.)
- HD-2D renderer changes
- Full installer / code signing / auto-update / store distribution

These belong in subsequent phases.
