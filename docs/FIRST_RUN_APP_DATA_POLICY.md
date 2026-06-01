# First-Run App Data Policy

CP-013 / FRA-48 defines where RPGCreatorAI creates local directories on first
run and during development validation. The policy keeps generated output
bounded, named, recoverable, and separate from user project data unless the
user explicitly opens or saves a project.

## Directory Roots

Desktop shell user state uses one shared app-data root:

1. `%APPDATA%\RPGCreatorAI`
2. `%LOCALAPPDATA%\RPGCreatorAI` when `%APPDATA%` is unavailable
3. `$HOME\.rpgcreatorai` when neither Windows app-data variable is available

The shared root is implemented in `src-tauri/src/app_paths.rs` and used by the
config, runtime-log, and playtest-session code paths.

Runtime diagnostics, log caps, and failed-launch support steps are documented
in `docs/DIAGNOSTICS.md`.

Generated development/build output uses `%LOCALAPPDATA%\RPGCreatorAI` by
default so compiler and package caches stay out of the OneDrive-synced repo.

## Runtime And Desktop Writes

| Purpose | Default location | Created when | Retention / cleanup |
| --- | --- | --- | --- |
| Recent projects config | `%APPDATA%\RPGCreatorAI\config.json` | Desktop recents are saved | Small JSON file; safe to delete while app is closed |
| Playtest sessions | `%APPDATA%\RPGCreatorAI\playtest-sessions\session-*` | Desktop Playtest creates a temporary project root | Shell keeps the latest 5 sessions and prunes older sessions |
| Runtime logs | `%APPDATA%\RPGCreatorAI\runtime-logs\runtime-*.log` | Desktop launches the native runtime | User may delete old logs while app/runtime are closed |
| Runtime state snapshot | `%APPDATA%\RPGCreatorAI\runtime-logs\runtime-state-snapshot.json` | Runtime debug snapshot is enabled by the desktop bridge | Rewritten atomically per runtime run |
| Project save backups | `<projectRoot>\.backups\*.json` | Desktop save overwrites existing project files | Pruned to latest 10 backups per file |
| Runtime save slots | `<runtime-current-dir>\saves\slot_*.json` | Native runtime save/load is used | In desktop playtest this is inside the temporary session root |

Desktop playtest launches the runtime with the temporary session as
`current_dir`, so runtime save slots and debug reads do not mutate the source
project. Direct standalone runtime launches use the process current directory;
that is an explicit developer action and may write `saves/` under that current
directory.

## Build And Package Writes

| Purpose | Default location | Created when | Cleanup |
| --- | --- | --- | --- |
| Native CMake build | `%LOCALAPPDATA%\RPGCreatorAI\build` | `scripts/dev/build.ps1`, `verify.ps1`, package helper | `rmdir /s /q "%LOCALAPPDATA%\RPGCreatorAI\build"` |
| Tauri/Cargo package target | `%LOCALAPPDATA%\RPGCreatorAI\tauri-target` | `npm run desktop:package:windows` | `rmdir /s /q "%LOCALAPPDATA%\RPGCreatorAI\tauri-target"` |
| Future release artifacts | `%LOCALAPPDATA%\RPGCreatorAI\release-artifacts` | Future release packaging issues | `rmdir /s /q "%LOCALAPPDATA%\RPGCreatorAI\release-artifacts"` |
| Frontend build | `dist/` | `npm run build` or Tauri `beforeBuildCommand` | Ignored source-tree output; remove with normal repo cleanup |

Generated output must not be staged unless a specific issue defines a committed
artifact. Runtime smoke screenshots under `docs/screenshots/` are committed
only when the issue explicitly needs visual evidence.

## First-Run Smoke

The first-run desktop smoke starts the packaged shell with fresh temporary
`APPDATA`, `LOCALAPPDATA`, and `HOME` values:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/smoke-first-run-app-data.ps1
```

The script verifies that the packaged app can launch without pre-existing app
data directories and prints any created `RPGCreatorAI` app-data roots. It uses
a unique temporary directory and removes it by default after the process is
stopped.

## User Safety Rules

- Never delete a user-selected project root automatically.
- Only prune app-created playtest sessions and project `.backups` according to
  their documented caps.
- Keep desktop runtime logs and snapshots under the shared app-data root.
- Keep compiler/package caches under `%LOCALAPPDATA%`.
- Keep source-tree writes limited to explicit project saves, explicit frontend
  builds (`dist/`), or explicit validation evidence requested by the issue.
