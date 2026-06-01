# Diagnostics And Logs

CP-014 / FRA-49 defines the stable diagnostics entry point for support,
debugging, and agent validation. Diagnostics are local files only. The native
runtime does not depend on AI providers, network access, cloud services, or
provider credentials.

## Primary Entry Point

In the desktop shell, open Playtest and select the Runtime Log tab. The panel
shows:

- the latest runtime log filename when one exists
- the diagnostics folder path even before the first runtime log exists
- refresh, copy-log-text, and open-folder controls
- a truncation marker when the UI is showing only the bounded log tail

Browser mode cannot read native diagnostics and reports that limitation
honestly.

## Diagnostics Folder

Runtime diagnostics use the shared app-data policy from
`docs/FIRST_RUN_APP_DATA_POLICY.md`:

1. `%APPDATA%\RPGCreatorAI\runtime-logs`
2. `%LOCALAPPDATA%\RPGCreatorAI\runtime-logs` when `%APPDATA%` is unavailable
3. `$HOME\.rpgcreatorai\runtime-logs` when neither Windows app-data variable is available

The Tauri command `runtime_diagnostics` creates and reports only this
allowlisted folder. It also reports the latest log path, latest snapshot path,
and the hard read caps used by the editor.

## Files

| File | Created when | Notes |
| --- | --- | --- |
| `runtime-*.log` | Desktop launches the native runtime | Captures native runtime stdout/stderr for that run |
| `runtime-state-snapshot.json` | Desktop runtime launch enables debug snapshots | Rewritten atomically by the runtime while it is alive |

The editor reads only the latest 256 KiB of the latest log and only the latest 128 KiB
of the runtime snapshot. Full files remain local on disk for manual debugging.

## Failed Startup Or Runtime Launch

If the desktop app fails before the UI opens:

1. Re-run the scenario with `npm run desktop:dev` or
   `npm run desktop:package:windows` from the repo root.
2. Capture the terminal output. That startup output is the authoritative
   Tauri/Rust diagnostic when the renderer never loads.
3. Confirm the packaged prototype exists under
   `%LOCALAPPDATA%\RPGCreatorAI\tauri-target\debug` when testing package
   startup.

If Playtest runtime launch fails after the UI opens:

1. Open Playtest > Runtime Log.
2. Use the displayed Diagnostics folder or the folder icon.
3. If no `runtime-*.log` exists, the launch failed before the native runtime process started.
   The panel still reports the diagnostics folder, and the launch status text
   explains the shell-side failure such as a missing `rpg_creator_runtime.exe`.
4. If a log exists, inspect the latest `runtime-*.log` and
   `runtime-state-snapshot.json`.

## Secret Handling

Diagnostics must not contain API keys. The runtime is provider-independent,
and provider credentials are not runtime inputs. Do not store API keys in
project JSON, committed docs, scripts, runtime logs, or support comments.
Redact any accidental secrets before sharing diagnostics externally.

## Offline Validation

Run the focused diagnostics gate from the repo root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify-diagnostics.ps1
```

The helper simulates the safe failure path where no runtime log exists yet and
verifies that `runtime_diagnostics` still reports the folder. It also runs the
desktop adapter and Runtime Log panel tests, then `npm run typecheck`.

Restricted execution policy fallback:

```cmd
scripts\dev\verify-diagnostics.bat
```
