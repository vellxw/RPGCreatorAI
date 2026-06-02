# Error Recovery

CP-022 records the current recoverable failure policy for the local-first
editor. Failure UI must tell the user what happened, what data was not marked
safe, and what to do next.

| Area | Current behavior | Recovery copy |
| --- | --- | --- |
| Startup open/create | Folder guards reject wrong roots, existing projects in Create, and non-empty `data/` folders before writing new data. | Choose an RPGCreatorAI project root, use Open for existing projects, or pick an empty folder for Create. |
| Recent project open | Shell/file errors are normalized before UI display. | Permission denied, disk full, desktop unavailable, and file-in-use messages include the next action. |
| Import bundle | Import errors pass through the same recoverable formatter, so file access failures are not shown as raw shell strings. | Retry with a readable JSON bundle or use the bundled sample while inspecting the file. |
| Save | Validation errors block before adapter writes. Adapter failures do not dispatch `MARK_SAVED`; the editor remains dirty. | Fix validation, or resolve the write problem, inspect `.backups` if a desktop write partially failed, then Save again. |
| Runtime save/load slots | Empty runtime slots are disabled for load. Corrupt or future-version slots remain visible but are not loadable; the runtime reports the specific save-file problem and leaves game state unchanged. | Pick another slot, overwrite the bad slot from Save, or inspect/remove the affected `saves/slot_N.json` file in the runtime current directory. |
| Runtime launch | Browser mode stays unavailable. Desktop launch/session failures are status feedback, not fake success. | Open/create a project, fix validation/session errors, or inspect Runtime Log/Event Trace/Runtime State after successful launches. |
| Provider settings | Providers are optional editor tooling. Disabled providers, enabled providers without credentials, browser credential-storage unavailable, and stored desktop credentials are explicit states. | Use desktop Settings to save or forget credentials; values are stored as DPAPI app-data blobs, redacted from feedback, never written to project data, and no live provider call runs during normal validation. |
| AI request queue | AI jobs are editor-only queue records with queued/running/cancelled/failed/succeeded states, progress, cancellation, retry, and restart recovery. Interrupted running jobs restore as failed/retryable instead of replaying work. | Cancel active work from Settings, retry failed/cancelled work when attempts remain, and review failure copy before any future generated draft is applied. Retries keep the same write intent to avoid duplicate destructive writes. |

The native runtime remains independent of AI providers, network, cloud
services, and provider credentials. Normal validation uses local tests and
mocks only.
