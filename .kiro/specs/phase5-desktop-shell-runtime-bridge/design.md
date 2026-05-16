# Phase 5 Design — Desktop Shell + Real FileSystem + Runtime Bridge

## 1. Shell Selection: Tauri vs Electron

| Criterion | Tauri 2.x | Electron |
|-----------|-----------|----------|
| Bundle size | ~3–10 MB | ~80–150 MB |
| Memory footprint | Small (system webview) | Heavy (bundled Chromium) |
| FS capability model | Allowlist + per-scope permissions in `tauri.conf.json` | Manual via IPC + `contextBridge` |
| Process spawn | `tauri::api::process::Command` (Rust, structured args) | `child_process.spawn` (Node) |
| Toolchain need | Rust + system webview (Edge WebView2 on Windows, present by default on Win10+) | Node.js (already present here) |
| Maturity for our use | High; v2 is stable, single binary build is well-trodden | Highest; widest community |
| Security defaults | Deny-by-default; explicit permissions | Permissive Node; we'd hand-roll the allowlist |
| Risk for this project | Rust toolchain is a new dependency on this Windows + OneDrive box | Larger surface area, slower to start, but no new toolchain |

### Decision: Tauri 2.x is the default.
Reasons:
- The capability model maps directly to R7 (path sandboxing, allowlisted IPC).
- Rust child process spawn with structured args removes a class of injection bugs that Electron + `spawn(string)` patterns invite.
- Bundle size matters because we eventually ship to end users.
- Edge WebView2 is preinstalled on Windows 10+, so end-user deployment is light.

### Fallback trigger for Electron
If during implementation we hit a Tauri-specific blocker we cannot resolve (e.g., Rust toolchain refuses to install on the target machine, or a required native API is unavailable through Tauri plugins), we fall back to Electron. The fallback is documented as a separate task and produces an equivalent allowlisted IPC layer.

## 2. High-Level Architecture

```
+-------------------------------------------------------------+
|              React / Vite Editor (existing)                 |
|  components, screens, stores, validation, save flow         |
+--------------------------+----------------------------------+
                           |
                  window.rpgBridge (typed)
                           |
+--------------------------v----------------------------------+
|              Desktop Shell (Tauri Rust core)                |
|  +-------------------+  +-------------------+               |
|  | fs.readProject    |  | runtime.launch    |               |
|  | fs.writeProject   |  | runtime.kill      |               |
|  | fs.openDialog     |  | runtime.status    |               |
|  | fs.listBackups    |  | config.recents    |               |
|  +-------------------+  +-------------------+               |
|         |                       |                           |
|  scoped fs (project root)   spawn rpg_creator_runtime.exe   |
+-------------------------------------------------------------+
                           |
                           v
                +----------------------+
                | Project on disk:     |
                | data/, .backups/     |
                +----------------------+
```

The shell exposes a single object on the renderer side: `window.rpgBridge`. Everything the editor needs to do natively goes through it. The browser/Vite dev mode does not have this object, which is exactly how the existing factory feature-detects the shell.

## 3. IPC Surface (Allowlist)

All commands are namespaced. Each is a Tauri `#[tauri::command]` (or Electron `ipcMain.handle`) returning a typed result.

```typescript
// renderer-side type that mirrors the Rust commands
interface RpgBridge {
  fs: {
    openProjectDialog(): Promise<{ root: string } | { cancelled: true }>;
    readProject(root: string): Promise<FullProjectState>;
    writeProject(root: string, state: FullProjectState): Promise<SaveResult>;
    listBackups(root: string, file: string): Promise<string[]>;
    closeProject(): Promise<void>;
  };
  runtime: {
    launch(projectRoot: string): Promise<RuntimeLaunchResult>;
    kill(): Promise<void>;
    status(): Promise<RuntimeStatus>;
  };
  config: {
    getRecents(): Promise<string[]>;
    addRecent(root: string): Promise<void>;
  };
  shell: {
    name: 'tauri' | 'electron';
    version: string;
  };
}

declare global {
  interface Window {
    rpgBridge?: RpgBridge;
  }
}
```

Adding a new IPC command requires editing both the Rust side (Tauri commands) and the renderer-side TypeScript declaration. There is no generic `invoke(name, args)` escape hatch exposed to the renderer.

## 4. Capability Model (Tauri-specific)

`tauri.conf.json` will declare:

- `app.windows.[0].title = "RPGCreatorAI"`
- `app.security.csp` set to a strict CSP that allows the local Vite dev origin in dev and `tauri://localhost` in production
- A custom capability file `capabilities/default.json` listing the allowed commands by name; everything else is denied
- No `allowlist.shell.open = true`. Shell open is not exposed.
- `fs` plugin scope is **not** the default global; we use the custom commands above which canonicalise paths against the active project root before any fs access

In effect, the editor cannot:
- read files outside the open project root
- spawn arbitrary processes
- open external URLs without going through a future, explicit `shell.openExternal` command (not in Phase 5)

## 5. Project Lifecycle

```
                start
                  |
                  v
            no project open
        (editor shows "Open or import project" empty state)
                  |
       +----------+----------+
       |                     |
   open dialog          import JSON
       |                     |
       v                     v
   shell.fs.read        BrowserMemoryAdapter
       |                     |
       +----------+----------+
                  |
                  v
          editor has project
       state.project, dirty=false
                  |
       +----------+----------+----------+
       |          |          |          |
     edit       save       playtest    close
       |          |          |          |
       v          v          v          v
   dirty=true  validate    runtime    confirm if dirty,
              + write +    .launch()  reset state
              backup         |
                             v
                       runtime.kill()
                       on exit/stop
```

## 6. FileSystemAdapter Implementation Outline

```rust
// src-tauri/src/fs_commands.rs (sketch)

#[tauri::command]
fn fs_read_project(root: String) -> Result<FullProjectState, String> {
    let root = canonicalize_inside_user_space(&root)?;
    must_contain_project_json(&root)?;

    let project = read_json::<ProjectData>(root.join("data/project.json"))?;
    let mut maps = HashMap::new();
    for r in &project.maps {
        let map_path = root.join(&r.path);
        ensure_inside(&root, &map_path)?;
        maps.insert(r.id.clone(), read_json::<MapData>(&map_path)?);
    }
    let items = read_json::<ItemDatabase>(root.join("data/database/items.json"))?;
    Ok(FullProjectState { project, maps, items })
}

#[tauri::command]
fn fs_write_project(root: String, state: FullProjectState) -> Result<SaveResult, String> {
    let root = canonicalize_inside_user_space(&root)?;
    must_contain_project_json(&root)?;

    backup_existing(&root, "data/project.json")?;
    atomic_write_json(root.join("data/project.json"), &state.project)?;

    for (id, map) in &state.maps {
        let path = root.join(format!("data/maps/{id}.json"));
        ensure_inside(&root, &path)?;
        backup_existing(&root, &format!("data/maps/{id}.json"))?;
        atomic_write_json(path, map)?;
    }

    backup_existing(&root, "data/database/items.json")?;
    atomic_write_json(root.join("data/database/items.json"), &state.items)?;

    prune_backups(&root, MAX_BACKUPS_PER_FILE)?;
    Ok(SaveResult { success: true, ..Default::default() })
}
```

`atomic_write_json` writes to `<filename>.tmp` in the same directory and then performs `std::fs::rename`, which is atomic on the same filesystem.

`canonicalize_inside_user_space` rejects paths that resolve outside `%USERPROFILE%` on Windows (or `$HOME` on macOS/Linux) to avoid pranks like opening `C:\Windows\System32` as a "project".

`backup_existing` copies the current file (if it exists) to `<root>/.backups/<basename>.<ISO-timestamp>.json`.

## 7. RuntimeLaunchAdapter Implementation Outline

```rust
// src-tauri/src/runtime_commands.rs (sketch)

static RUNTIME_PROCESS: Lazy<Mutex<Option<Child>>> = Lazy::new(|| Mutex::new(None));

#[tauri::command]
async fn runtime_launch(project_root: String) -> Result<RuntimeLaunchResult, String> {
    let exe = locate_runtime_executable()?;
    ensure_only_one_running()?;

    let child = std::process::Command::new(exe)
        .current_dir(&project_root)
        .spawn()
        .map_err(|e| e.to_string())?;
    let pid = child.id();
    *RUNTIME_PROCESS.lock().unwrap() = Some(child);
    Ok(RuntimeLaunchResult { success: true, pid: Some(pid), ..Default::default() })
}

#[tauri::command]
async fn runtime_kill() -> Result<(), String> {
    if let Some(mut child) = RUNTIME_PROCESS.lock().unwrap().take() {
        let _ = child.kill();
        let _ = child.wait();
    }
    Ok(())
}

#[tauri::command]
async fn runtime_status() -> RuntimeStatus {
    let mut guard = RUNTIME_PROCESS.lock().unwrap();
    match guard.as_mut() {
        None => RuntimeStatus::Ready,
        Some(child) => match child.try_wait() {
            Ok(Some(_)) => { *guard = None; RuntimeStatus::Ready }
            Ok(None) => RuntimeStatus::Running,
            Err(_) => RuntimeStatus::Unavailable,
        },
    }
}
```

`locate_runtime_executable` search order:
1. Env var `RPG_RUNTIME_EXE` if set
2. `<projectRoot>/build/rpg_creator_runtime.exe`
3. `%LOCALAPPDATA%\RPGCreatorAI\build\rpg_creator_runtime.exe` (consistent with Phase 4.1)
4. Same directory as the Tauri binary
5. Returns `Err(...)` so `canLaunch()` reports `false`

The renderer-side `DesktopRuntimeAdapter` (already present as a seam in Phase 4) is updated to detect `window.rpgBridge?.runtime` and route through it.

## 8. Renderer-Side Changes

Existing files extended (no UI redesign):

- `src/adapters/types.ts` — add `RpgBridge` interface to `globalThis.Window`
- `src/adapters/FileSystemAdapter.ts` — replace the no-op bodies with calls to `window.rpgBridge.fs.*`
- `src/adapters/RuntimeLaunchAdapter.ts` — `DesktopRuntimeAdapter` calls `window.rpgBridge.runtime.*`
- `src/adapters/adapterFactory.ts` — already feature-detects the shell. The check changes from `window.runtimeBridge` to `window.rpgBridge`.
- `src/components/layout/TopToolbar.tsx` — `Open` and `Recent Projects` actions appear only when `window.rpgBridge` is present
- `src/screens/PlaytestScreen.tsx` — already shows the runtime bridge panel; in desktop mode the "Open in Runtime" button becomes functional and displays the live PID/status

No new screens. No visual redesign. The desktop affordances are added inside the existing toolbar and playtest panel.

## 9. Build & Packaging Strategy (Dev Mode)

Two NPM scripts orchestrate everything:

```jsonc
"scripts": {
  "desktop:dev":   "tauri dev",                    // Vite dev server + Tauri shell, hot reload
  "desktop:build": "tauri build --debug --no-bundle"  // unsigned dev .exe, no installer
}
```

`tauri.conf.json` sets `tauri.bundle.targets = []` for dev so we get a plain `.exe` at:

```
src-tauri/target/debug/rpgcreator.exe
```

Output paths to document:
- `src-tauri/target/debug/`
- `src-tauri/target/release/`

Both directories are added to `.gitignore`. The build is **not** run from inside OneDrive's filter zone (Tauri's Rust compile is heavy on file renames, just like cmake's FetchContent); the `target/` directory may be redirected to `%LOCALAPPDATA%\RPGCreatorAI\tauri-target\` via Cargo's `target-dir` config in `.cargo/config.toml`.

## 10. Test Strategy

| Layer | Test |
|-------|------|
| Renderer unit | New `FileSystemAdapter` calls go through a mock `window.rpgBridge`; verify error paths surface to `SaveResult` |
| Renderer unit | `DesktopRuntimeAdapter` with mock bridge: ensures correct status transitions, no fake PIDs |
| Renderer integration | Existing 32 vitest tests must remain green |
| Rust unit | `canonicalize_inside_user_space` rejects `..\..\Windows\System32`, allows project root |
| Rust unit | `backup_existing` writes timestamped copies and prunes |
| Smoke | `npm run desktop:build` exits 0; produced `.exe` launches and shows the editor |
| C++ runtime | Phase 4.1 scripts continue to pass |

## 11. Risk Register

| Risk | Mitigation |
|------|------------|
| Rust toolchain not present on user's machine | Dev-only target, document `rustup` install in `DESKTOP_SHELL_ARCHITECTURE.md`; Electron fallback branch ready |
| Tauri 2 plugin API churn | Pin exact Tauri version in `Cargo.toml` |
| OneDrive locks Cargo target/ | `.cargo/config.toml` redirects `target-dir` to `%LOCALAPPDATA%` |
| WebView2 missing on very old Win10 | Document one-time install step; Tauri auto-detects |
| Backup directory grows without bound | `prune_backups` keeps last N (default 10) per file |
| Editor edits a file outside scope | Capability model + `canonicalize_inside_user_space` reject it |

## 12. Out of Scope (Hard)
- Real AI provider calls
- Image / 3D generation
- GitHub OAuth, cloud sync, marketplace
- Plugin system
- Advanced scripting
- HD-2D renderer
- Full installer / code signing / auto-update / store distribution
