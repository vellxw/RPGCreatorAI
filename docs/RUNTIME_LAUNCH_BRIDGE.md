# Runtime Launch Bridge

## Status After FRA-22

The desktop playtest flow now builds a temporary project root before
launching the native C++ runtime. The source project folder is used only as
the trusted executable search root and as the asset source for optional copied
assets. Runtime launch still uses `std::process::Command` directly with no
command-line arguments and no shell interpretation.

Browser mode remains honest: it can run the simulated editor preview, but it
cannot create native playtest sessions or spawn the runtime.

## Renderer Surface

```ts
interface RuntimeLaunchAdapter {
  canLaunch(): boolean;
  getExecutablePath(): string | null;
  launch(
    projectRoot: string,
    options?: { executableSearchRoot?: string },
  ): Promise<RuntimeLaunchResult>;
  getStatus(): RuntimeStatus;
  kill(): Promise<void>;
  getUnavailableReason(): string | null;
}

interface PlaytestSessionAdapter {
  canCreateSession(): boolean;
  createSession(
    sourceRoot: string,
    state: FullProjectState,
    request: PlaytestSessionRequest,
  ): Promise<PlaytestSessionResult>;
  getUnavailableReason(): string | null;
}
```

`projectRoot` is the folder the runtime should read from. For normal source
launches that can be the source project. For playtest sessions it is the
temporary session root. `executableSearchRoot` lets the shell find the runtime
under the source repository while still launching with `current_dir` set to
the temp session root.

## Playtest Session Modes

The playtest toolbar exposes three modes:

| Mode | Session behavior |
|------|------------------|
| `projectStart` | Preserves the project's authored start map and start position. |
| `currentMap` | Writes only the temp `data/project.json` to start on the selected editor map. If that map differs from the authored start map, the temp start position becomes `0,0,down`. |
| `selectedEvent` | Writes only the temp `data/project.json` to start on the selected event's map and tile, facing `down`. The mode is disabled when no event is selected. |

The session builder writes the in-memory project state, map JSON, items, and
database shards into the temp root. It copies `assets/` when present so local
runtime visual/audio references keep resolving. It does not write or back up
files inside the source project.

Sessions are stored under the app data directory:

```text
%APPDATA%\RPGCreatorAI\playtest-sessions\
```

If `%APPDATA%` is unavailable, the shell falls back to `%LOCALAPPDATA%`, then
`$HOME/.rpgcreatorai/playtest-sessions`. The shell keeps the latest five
`session-*` directories and prunes older sessions.

## Executable Resolution

The shell searches for `rpg_creator_runtime.exe` in this order, using
`executableSearchRoot` when provided and `projectRoot` otherwise:

1. `RPG_RUNTIME_EXE` environment variable, if set to an existing file
2. `<searchRoot>/build/rpg_creator_runtime.exe`
3. `%LOCALAPPDATA%\RPGCreatorAI\build\rpg_creator_runtime.exe`
4. The directory containing the Tauri shell binary
5. Return a failed `RuntimeLaunchResult` explaining that the runtime was not found

The renderer never constructs a shell command.

## Launch Flow

```text
Playtest screen: Open in Runtime
  -> validate the in-memory project state
  -> fs.createPlaytestSession(sourceRoot, state, request)
      -> write temp data/project.json, maps, items, and database shards
      -> copy optional source assets/
      -> prune older temp sessions beyond five
  -> runtime.launch(sessionRoot, { executableSearchRoot: sourceRoot })
      -> Rust locates the runtime executable from sourceRoot/search fallbacks
      -> Rust rejects launch if another runtime process is still alive
      -> Command::new(exe)
            .current_dir(sessionRoot)
            .spawn()
      -> shell stores the Child handle and returns the pid
```

The runtime reads `data/project.json` and relative data/assets paths from the
temporary session root. The C++ runtime does not need command-line arguments
or a special playtest flag.

## Status Polling

`getStatus()` translates Rust `try_wait` results:

| Rust state | Renderer status | Notes |
|------------|-----------------|-------|
| No `Child` stored | `ready` | Shell present, nothing running |
| `try_wait` returns `Ok(Some(_))` | `ready` | Runtime exited; shell clears the slot |
| `try_wait` returns `Ok(None)` | `running` | Runtime alive |
| `try_wait` returns `Err(_)` | `unavailable` | Process handle invalid |
| Browser mode | `unavailable` | Process spawning is not exposed |

The Playtest screen polls the shell status while the bridge is available.

## Stop / Kill Flow

When the user clicks Stop Runtime:

1. `adapter.kill()` calls `runtime.kill()`.
2. The shell calls `Child::kill()`.
3. The shell calls `Child::wait()` and clears the stored process handle.

`kill()` is idempotent when no runtime process is stored.

## Security

- The shell starts a resolved executable path with no command-line arguments.
- There is no `exec(string)` and no shell interpolation.
- Playtest mode changes are data changes written only to the temp project
  snapshot.
- The source project root is not modified by launch preparation.
- Browser mode does not fake native runtime access.

## Logging

FRA-22 does not add a runtime log viewer or shell-side stdout/stderr capture.
That is tracked by PT-002. Current validation evidence still comes from the
existing runtime smoke scripts and process status.

## What FRA-22 Does Not Add

- No runtime-to-editor IPC.
- No embedded runtime viewport.
- No remote runtime.
- No automatic source project save before launch.
- No log viewer, event trace panel, or runtime state snapshot reader.
