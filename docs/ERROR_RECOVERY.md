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
| Runtime launch | Browser mode stays unavailable. Desktop launch/session failures are status feedback, not fake success. | Open/create a project, fix validation/session errors, or inspect Runtime Log/Event Trace/Runtime State after successful launches. |
| Provider-disabled surfaces | AI tooling remains future-phase and read-only. | The UI states that no provider call, network request, or API key is used from the MVP screen. |

The native runtime remains independent of AI providers, network, cloud
services, and provider credentials. Normal validation uses local tests and
mocks only.
