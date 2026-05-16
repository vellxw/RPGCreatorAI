# Desktop Shell Architecture

## Chosen Shell: Tauri 2.x (default)

Tauri 2.x is the default desktop shell for RPGCreatorAI. The decision rationale is documented in `.kiro/specs/phase5-desktop-shell-runtime-bridge/design.md` (section 1). Short version:

- Bundle size and memory footprint are an order of magnitude smaller than Electron.
- Tauri's allowlist-driven capability model maps directly to our security requirements.
- Rust's `std::process::Command` with structured args avoids the `spawn(string)` injection class entirely.
- Edge WebView2 is preinstalled on Windows 10+ (no extra runtime required for end users).

## Fallback: Electron

If a Tauri-specific blocker appears during implementation (Rust toolchain problems on the target machine, a missing native API not available through Tauri plugins, etc.), the project falls back to Electron with an equivalent allowlisted IPC layer via `contextBridge`. The fallback decision is itself documented as a task and produces the same renderer-side bridge surface.

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

The shell launches a single window. There are no extra background windows in Phase 5.

## IPC Surface (`window.rpgBridge`)

The renderer never sees a generic `invoke()` function. Instead, a thin typed wrapper exposes only the namespaced calls listed below. Anything else is a programmer error and won't compile.

| Namespace | Command | Purpose |
|-----------|---------|---------|
| `fs` | `openProjectDialog()` | Native folder picker, returns selected root or cancellation |
| `fs` | `readProject(root)` | Reads project.json + maps + items, returns `FullProjectState` |
| `fs` | `writeProject(root, state)` | Atomic write with backup; runs validation in renderer first |
| `fs` | `listBackups(root, file)` | Lists `.backups/` entries for a given file |
| `fs` | `closeProject()` | Releases the active root scope |
| `runtime` | `launch(projectRoot)` | Spawns the C++ runtime; returns PID |
| `runtime` | `kill()` | Graceful kill + wait |
| `runtime` | `status()` | `unavailable` / `ready` / `running` |
| `config` | `getRecents()` | Returns recent project roots |
| `config` | `addRecent(root)` | Persists most recent root |
| `shell` | `name`, `version` | Identifies the host (`tauri`/`electron`) |

The Rust side declares each handler with explicit input and output types. There is no string-based dispatch.

## Security Model

- **Capability allowlist** in `src-tauri/capabilities/default.json`. Only the commands listed above are reachable from the renderer.
- **Path sandbox** for every `fs.*` command:
  1. Resolve the input path with `std::fs::canonicalize` (follows symlinks).
  2. Reject paths outside `%USERPROFILE%` (Windows) or `$HOME` (macOS/Linux).
  3. For per-file ops, enforce that the resolved path is a descendant of the active project root.
- **Strict CSP** in `tauri.conf.json`: `default-src 'self'`, `connect-src 'self' http://localhost:5173`, no remote scripts.
- **No `shell.open`** allowlist entry — opening external URLs is not exposed in Phase 5.
- **No environment-variable read leak** — the renderer cannot read arbitrary env vars; only the shell does, and only for `RPG_RUNTIME_EXE` resolution.
- **No secrets committed** — `.env`, `*.local`, and `src-tauri/target/` remain gitignored.

## Build & Output Paths

| Mode | Command | Output |
|------|---------|--------|
| Dev (hot reload) | `npm run desktop:dev` | Window backed by Vite dev server |
| Dev binary | `npm run desktop:build` | `<targetDir>/debug/rpgcreator.exe` |
| Browser-only (existing) | `npm run dev` | http://localhost:5173 |

`<targetDir>` is `%LOCALAPPDATA%\RPGCreatorAI\tauri-target` on Windows by default, configured via `.cargo/config.toml`. This keeps Rust's heavy file-rename activity out of OneDrive's filter zone, mirroring the Phase 4.1 fix for cmake.

## Detection & Fallback

```ts
function detectDesktopShell(): boolean {
  return typeof window !== 'undefined' && !!window.rpgBridge;
}
```

The factory in `src/adapters/adapterFactory.ts` checks this once at startup and selects:
- `FileSystemAdapter` + `DesktopRuntimeAdapter` if `rpgBridge` is present
- `BrowserMemoryAdapter` + `BrowserRuntimeAdapter` otherwise

Browser-mode users see the existing Phase 4.1 experience unchanged.

## Update Path

The shell does not include auto-update in Phase 5. A later phase will add code signing, an update server (or local file-based update channel), and store distribution metadata. Until then, dev binaries are produced by re-running `npm run desktop:build`.
