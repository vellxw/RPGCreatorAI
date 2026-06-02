# Desktop Shell Architecture

## Chosen Shell: Tauri 2.x (default)

Tauri 2.x is the default desktop shell for RPGCreatorAI. The decision rationale is documented in `.kiro/specs/phase5-desktop-shell-runtime-bridge/design.md` (section 1). Short version:

- Bundle size and memory footprint are an order of magnitude smaller than Electron.
- Tauri's allowlist-driven capability model maps directly to our security requirements.
- Rust's `std::process::Command` with structured args avoids the `spawn(string)` injection class entirely.
- Edge WebView2 is preinstalled on Windows 10+ (no extra runtime required for end users).

## Fallback

Tauri is the implemented shell. Electron is not part of the MVP. If a future
phase finds a Tauri-specific blocker, any fallback must preserve the same
allowlisted renderer bridge and document the decision before implementation.

## Required Tools

| Tool | Why | Install |
|------|-----|---------|
| Rust stable toolchain | Tauri Rust core | <https://rustup.rs/> |
| Tauri CLI 2.x | `tauri dev` / `tauri build` | `npm install -D @tauri-apps/cli` |
| Edge WebView2 | UI runtime on Windows | Preinstalled on Win10+ |
| Visual Studio Build Tools (already required for the C++ runtime) | MSVC linker for Rust on Windows | Phase 1 already documents this |

## Process & Window Model

```
+---------------------------------------------------------------+
|                       Tauri main process                       |
|   - registers #[tauri::command] handlers                       |
|   - owns the project root, spawned runtime PID, recents store  |
|   - serves Vite (dev) or bundled assets (prod)                 |
+--------------------------------+------------------------------+
                                 |
                       single primary window
                                 |
+--------------------------------v------------------------------+
|                   Edge WebView2 / Renderer                    |
|   - React 19 + Vite + Tailwind editor (existing)              |
|   - `window.rpgBridge` typed wrapper                          |
+---------------------------------------------------------------+
```

The shell launches a single primary editor window. Runtime playtest launches
spawn the separate native C++ runtime process; the runtime viewport is not
embedded in the editor.

## IPC Surface (`window.rpgBridge`)

The renderer never sees a generic `invoke()` function. Instead, a thin typed wrapper exposes only the namespaced calls listed below. Anything else is a programmer error and won't compile.

| Namespace | Command | Purpose |
|-----------|---------|---------|
| `fs` | `openProjectDialog()` | Native folder picker, returns selected root or cancellation |
| `fs` | `createProjectDialog(state)` | Native folder picker for a new project; writes the supplied validated starter data without overwriting existing project data |
| `fs` | `readProject(root)` | Reads project.json + maps + items, returns `FullProjectState` |
| `fs` | `writeProject(root, state)` | Atomic write with backup; runs validation in renderer first |
| `fs` | `listBackups(root, file)` | Lists `.backups/` entries for a given file |
| `fs` | `closeProject()` | Releases the active root scope |
| `fs` | `createPlaytestSession(sourceRoot, state, request)` | Writes a temporary playtest project for project-start/current-map/selected-event modes |
| `runtime` | `launch(projectRoot, executableSearchRoot?)` | Spawns the C++ runtime; returns PID and resolved executable path |
| `runtime` | `kill()` | Graceful kill + wait |
| `runtime` | `status()` | `unavailable` / `ready` / `running` |
| `runtime` | `getLatestLog()` | Returns the current or newest bounded runtime log path |
| `runtime` | `readLogTail(maxBytes)` | Reads the latest runtime log tail, capped at 256 KiB |
| `runtime` | `readLatestSnapshot(maxBytes)` | Reads the latest runtime state snapshot, capped at 128 KiB |
| `runtime` | `openLogFolder()` | Opens the allowlisted runtime log folder |
| `config` | `getRecents()` | Returns recent project roots |
| `config` | `addRecent(root)` | Persists most recent root |
| `credentials` | `getStatus(providerId)` | Returns provider credential metadata without a secret value |
| `credentials` | `list()` | Lists configured provider credential metadata |
| `credentials` | `set(providerId, secret)` | Stores a user-entered provider credential as a Windows DPAPI blob under app data |
| `credentials` | `delete(providerId)` | Removes the stored provider credential blob |
| `shell` | `name`, `version` | Identifies the host (`tauri`/`electron`) |

The Rust side declares each handler with explicit input and output types. There is no string-based dispatch.

## Security Model

- **Capability allowlist** in `src-tauri/capabilities/default.json`. Only the commands listed above are reachable from the renderer.
- **Path sandbox** for every `fs.*` command:
  1. Resolve the input path with `std::fs::canonicalize` (follows symlinks).
  2. Reject paths outside `%USERPROFILE%` (Windows) or `$HOME` (macOS/Linux).
  3. For per-file ops, enforce that the resolved path is a descendant of the active project root.
- **Strict CSP** in `tauri.conf.json`: `default-src 'self'`, local Tauri dev
  connections on port 1420, IPC, data/blob images, and no remote scripts.
- **No arbitrary shell execution** — the runtime bridge resolves an executable
  path and starts it with structured process APIs, not shell interpolation.
- **No environment-variable read leak** — the renderer cannot read arbitrary env vars; only the shell does, and only for `RPG_RUNTIME_EXE` resolution.
- **Credential boundary** — provider credentials are opt-in desktop settings
  only. The renderer may submit a value to `credentials.set`, but Rust stores
  it as a Windows DPAPI-protected app-data blob and returns only redacted
  metadata. Project JSON and native runtime inputs never contain provider
  credentials.
- **No secrets committed** — `.env`, `*.local`, and `src-tauri/target/` remain gitignored.

## Build & Output Paths

| Mode | Command | Output |
|------|---------|--------|
| Dev (hot reload) | `npm run desktop:dev` | Window backed by Vite dev server |
| Dev binary | `npm run desktop:build` | `<targetDir>/debug/<tauri-exe>.exe` |
| Windows package prototype | `npm run desktop:package:windows` | `<targetDir>/debug/<tauri-exe>.exe` plus `rpg_creator_runtime.exe` copied beside it |
| Browser-only | `npm run dev` | http://localhost:3000 |
| Tauri content server | `npm run dev:tauri` | http://localhost:1420 |

`<targetDir>` is `%LOCALAPPDATA%\RPGCreatorAI\tauri-target` for the packaged
Windows prototype. The package helper sets `CARGO_TARGET_DIR` explicitly so
Rust's heavy file-rename activity stays out of OneDrive's filter zone,
mirroring the Phase 4.1 fix for cmake.

Release artifact naming, unsigned local prototype behavior, future NSIS/MSI
installer direction, and signing boundaries are documented in
`docs/PHASE_11_RELEASE_ARTIFACT_POLICY.md`.

First-run config, runtime logs, playtest sessions, backups, and cache
locations are documented in `docs/FIRST_RUN_APP_DATA_POLICY.md`.

## Detection & Fallback

```ts
function detectDesktopShell(): boolean {
  return typeof window !== 'undefined' && !!window.rpgBridge;
}
```

The factory in `src/adapters/adapterFactory.ts` checks this once at startup and selects:
- `FileSystemAdapter` + `DesktopRuntimeAdapter` if `rpgBridge` is present
- `BrowserMemoryAdapter` + `BrowserRuntimeAdapter` otherwise

Browser-mode users get in-memory/browser-adapter editing and honest
unavailable states for native-only capabilities.

## Update Path

The shell does not include auto-update in the MVP. A later phase can add code
signing, an update server or local update channel, and store distribution
metadata. Until then, dev binaries are produced by re-running
`npm run desktop:build` or the CP-010 prototype helper
`npm run desktop:package:windows`. The CP-011 release artifact policy keeps
normal validation on unsigned local artifacts until signing credentials are
provided explicitly.
