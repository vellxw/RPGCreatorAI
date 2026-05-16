# Runtime Launch Bridge

## Status After Phase 5
The `DesktopRuntimeAdapter` becomes a real implementation backed by a Tauri command that spawns the C++ runtime executable. The Phase 4 seam is replaced; the renderer-side adapter shape is unchanged.

## Renderer Surface (unchanged)

```ts
interface RuntimeLaunchAdapter {
  canLaunch(): boolean;
  getExecutablePath(): string | null;
  launch(projectRoot: string): Promise<RuntimeLaunchResult>;
  getStatus(): RuntimeStatus;
  kill(): Promise<void>;
  getUnavailableReason(): string | null;
}
```

In desktop mode, every method is wired to a `window.rpgBridge.runtime.*` IPC call. In browser mode, the existing `BrowserRuntimeAdapter` continues to honestly report `unavailable`.

## Executable Resolution

The shell searches for `rpg_creator_runtime.exe` in this exact order:

1. `RPG_RUNTIME_EXE` environment variable, if set
2. `<projectRoot>/build/rpg_creator_runtime.exe`
3. `%LOCALAPPDATA%\RPGCreatorAI\build\rpg_creator_runtime.exe` (the Phase 4.1 default build dir)
4. The directory containing the Tauri shell binary
5. Returns `Err(...)`, which makes `canLaunch()` report `false` and `getUnavailableReason()` explain why

The renderer never decides where the binary lives; that decision is the shell's.

## Launch Flow

```
Playtest screen: "Open in Runtime" (enabled because canLaunch() is true)
  -> adapter.launch(projectRoot)
     -> window.rpgBridge.runtime.launch(projectRoot)
        -> Rust: locate_runtime_executable() -> exe path
        -> Rust: ensure no other runtime instance is alive
        -> std::process::Command::new(exe)
              .current_dir(projectRoot)
              .spawn()
        -> store Child in static Mutex<Option<Child>>
        -> return RuntimeLaunchResult { success: true, pid: Some(<pid>) }
  -> Playtest toolbar shows "Runtime: running (pid <n>)"
```

The runtime launches **with `current_dir` set to the project root**, so its existing `data/maps/...` lookups continue to work without any change to the C++ side. This matches the Phase 4.1 smoke run, which already proved the runtime resolves data paths correctly when launched from the repo root.

## Status Polling

`getStatus()` translates the Rust `try_wait` result:

| Rust state | Renderer status | Notes |
|------------|-----------------|-------|
| No `Child` stored | `ready` | Shell present, nothing running |
| `try_wait` returns `Ok(Some(_))` | `ready` | Runtime exited; shell clears the slot |
| `try_wait` returns `Ok(None)` | `running` | Runtime alive |
| `try_wait` returns `Err(_)` | `unavailable` | Process handle invalid; surfaced honestly |
| Browser mode (no shell) | `unavailable` | Existing `BrowserRuntimeAdapter` behaviour |

The Playtest screen polls status every 1 second while a runtime is running and pushes the current status into the existing `RuntimeBridgePanel` UI element.

## Stop / Kill Flow

User clicks Stop, or the editor window is closing:

1. `adapter.kill()` -> `runtime.kill()`
2. The shell calls `Child::kill()` (`SIGTERM` on Unix, `TerminateProcess` on Windows).
3. `Child::wait()` is bounded by a hard timeout (default 3 s). Beyond that, the slot is cleared regardless and the renderer shows `ready` again.

`kill()` is idempotent: calling it when nothing is running is a no-op.

## Concurrency Rules

- Only one runtime instance may be alive at a time. A second `launch()` while one is running returns `RuntimeLaunchResult { success: false, error: "runtime already running" }`.
- The renderer `DesktopRuntimeAdapter` mirrors this: its `launch()` immediately returns the error if it sees `running` from a status poll.
- On editor window close, the shell triggers `kill()` so we never leave orphaned runtime processes.

## Security

- The shell spawns a known executable path with **no command-line arguments**. There is no `exec(string)` and no shell interpretation. Even if someone smuggled a malicious string into the project root, it would not become a command-line argument.
- The executable path is resolved once at launch and validated:
  - Must exist
  - Must be a regular file (not a symlink to outside user space)
  - Must be executable
- The shell does not pipe stdin from anywhere. stdout/stderr are captured to a log file under the user data dir for debugging.

## Logging

Each launch creates a log under the user data dir:

```
%APPDATA%\RPGCreatorAI\runtime-logs\runtime.<ISO-timestamp>.log
```

The log captures stdout and stderr from the runtime process. The Playtest screen exposes a "Open log folder" button (gated on shell presence) that calls a small `shell.openLogsDir` IPC command (added narrowly for this purpose; not part of a generic shell-open allowlist).

## Browser Fallback

`window.rpgBridge` is absent in browser mode, so `BrowserRuntimeAdapter` is selected. It returns:
- `canLaunch() = false`
- `launch(...) = { success: false, error: "Native runtime cannot be launched from the browser..." }`
- `getStatus() = "unavailable"`
- `getUnavailableReason() = "Browser mode: process spawning is not exposed by Vite..."`

The Playtest screen continues to display the "Editor Preview (simulated) — not the native runtime" banner. No claim is made that the SVG preview is the native runtime.

## What Phase 5 Does NOT Add

- No IPC from the runtime back to the editor (no breakpoints, no hot-reload, no state sync). That belongs in a later phase.
- No embedded runtime view inside the editor window.
- No remote runtime (`runtime` running on a different machine).
- No multiplayer.
- No installer-based runtime distribution; the user is still expected to build the C++ runtime via the existing Phase 4.1 scripts.
