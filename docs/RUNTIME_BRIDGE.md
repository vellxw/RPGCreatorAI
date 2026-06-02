# Runtime Bridge

## Current Status

The Runtime Bridge is implemented through the Tauri desktop shell. It lets the
React editor launch the native C++ runtime from the Playtest screen, monitor
status, stop the process, and read bounded local debug artifacts.

Browser mode remains intentionally limited. When `window.rpgBridge` is absent,
the browser adapters return explanatory unavailable results instead of
pretending to spawn the runtime, create playtest folders, or read native logs.

## Architecture

```text
Playtest screen
  -> PlaytestSessionAdapter
      -> BrowserPlaytestSessionAdapter: unavailable
      -> DesktopPlaytestSessionAdapter: window.rpgBridge.fs.createPlaytestSession
  -> RuntimeLaunchAdapter
      -> BrowserRuntimeAdapter: unavailable
      -> DesktopRuntimeAdapter: window.rpgBridge.runtime.*
  -> Native C++ runtime process
```

The editor never builds a shell command. The Tauri shell resolves an
allowlisted runtime executable path and starts it with structured process APIs.

## Renderer Interfaces

```ts
interface PlaytestSessionAdapter {
  canCreateSession(): boolean;
  createSession(
    sourceRoot: string,
    state: FullProjectState,
    request: PlaytestSessionRequest,
  ): Promise<PlaytestSessionResult>;
  getUnavailableReason(): string | null;
}

interface RuntimeLaunchAdapter {
  canLaunch(): boolean;
  getExecutablePath(): string | null;
  launch(
    projectRoot: string,
    options?: { executableSearchRoot?: string },
  ): Promise<RuntimeLaunchResult>;
  getStatus(): RuntimeStatus;
  kill(): Promise<void>;
  getLatestLog(): Promise<RuntimeLogInfo>;
  readLatestLogTail(maxBytes: number): Promise<RuntimeLogTailResult>;
  readLatestSnapshot(maxBytes: number): Promise<RuntimeSnapshotResult>;
  openLogFolder(): Promise<RuntimeLogActionResult>;
  getUnavailableReason(): string | null;
}
```

## Playtest Launch Flow

1. The user selects Project Start, Current Map, or Selected Event in Playtest.
2. The mode-specific Launch button builds a checked playtest request. Current
   Map is blocked before the adapter if the selected map is not loaded.
3. The launch flow validates the in-memory project state.
4. Desktop mode calls `fs.createPlaytestSession(sourceRoot, state, request)`.
5. The shell writes a temporary project root under the app data directory,
   copies optional source assets, and prunes older session folders.
6. Desktop mode calls `runtime.launch(sessionRoot, { executableSearchRoot:
   sourceRoot })`.
7. The shell locates `rpg_creator_runtime.exe`, starts it with `current_dir`
   set to the temp session root, captures stdout/stderr to a runtime log, and
   returns the PID.

The source project is not mutated by playtest launch preparation.

## Runtime Debug Surfaces

- Runtime logs are stored under the app data runtime-log directory and read
  with a hard 256 KiB tail cap.
- Event trace rows use the stable `[TRACE]` prefix plus JSON payloads in the
  runtime log. The Playtest Event Trace tab parses those rows directly.
- Native runtime state snapshots are written as
  `runtime-state-snapshot.json` through a temp-file replace path and read with
  a hard 128 KiB cap.
- The log-folder opener opens only the allowlisted runtime log directory.

## Browser Mode

Browser mode can run the simulated editor preview and validate project data,
but it cannot:

- spawn the native runtime,
- create native temp playtest sessions,
- read native runtime logs,
- read native runtime state snapshots,
- open native log folders.

The UI must show these as unavailable native capabilities, not fake data.

## What The MVP Does Not Add

- No runtime-to-editor IPC.
- No embedded runtime viewport.
- No hot reload of a running runtime.
- No scripting VM or arbitrary plugin code execution.
- No runtime AI, cloud service, marketplace, or proprietary project import.
