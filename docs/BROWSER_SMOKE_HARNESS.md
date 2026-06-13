# Desktop Browser Smoke Harness

Date: 2026-06-04

Issue: CP-108 / FRA-143

## Result

RPGCreatorAI has an optional scripted browser smoke harness for high-value
editor workflows:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/smoke-browser-editor.ps1
```

Restricted execution-policy environments can use the `.bat` wrapper:

```bat
scripts\dev\smoke-browser-editor.bat
```

The harness starts or reuses the Vite editor at `http://127.0.0.1:3000`, drives
the browser through `@playwright/cli` via `npx`, and writes snapshots plus PNG
screenshots under `output/playwright/cp108`.

## Pass And Skip Semantics

The script exits with success when the smoke passes and prints:

```text
BROWSER SMOKE PASSED
```

The harness is optional for environments without a usable browser automation
stack. If `npx`, `npm`, the dev server, or browser launch is unavailable, it
exits with success and prints an explicit skip:

```text
BROWSER SMOKE SKIPPED: <reason>
```

Skip evidence is written to `output/playwright/cp108/skip.txt`.

Assertion failures in the editor workflow are not skipped. They fail the
command.

## Automated Smoke Steps

1. Fetch the startup HTML before React interaction and verify the static
   `Preparing your workspace` splash shell, busy state, and loading copy.
2. Open the startup route and verify `Start a project`, the honest browser-mode
   filesystem limitation, Import Project Bundle, Create Browser Project, and
   `Use My First RPG`.
3. Load the bundled sample.
4. Verify Maps workspace navigation and top-toolbar actions.
5. Run `Validate` and assert `Validation passed`.
6. Run `Save` and assert `Saved via BrowserMemoryAdapter`.
7. Navigate through Events, Database, Assets, Playtest, and Settings.
8. Capture snapshots and screenshots for each key workspace.
9. Capture browser console errors to `console-errors.txt`.

Deterministic Vitest coverage complements the browser smoke for startup phases,
pending open/create/import feedback, recent-project restore, runtime readiness,
and startup recovery states. Recovery is not forced through a production-only
browser query flag.

## Evidence Storage

Default evidence directory:

```text
output/playwright/cp108
```

Expected artifacts include:

- `browser-smoke-transcript.txt`
- `00-static-splash.html`
- `01-startup.snapshot.txt`
- `01-startup.png`
- `02-maps.snapshot.txt`
- `02-maps.png`
- `03-validate.snapshot.txt`
- `04-save.snapshot.txt`
- `workspace-events.png`
- `workspace-database.png`
- `workspace-assets.png`
- `workspace-playtest.png`
- `workspace-settings.png`
- `console-errors.txt`

## Limitations

- Browser smoke proves the React editor workflow, not native Tauri file dialogs.
- Desktop-only filesystem and runtime launch flows remain covered by
  `scripts/dev/verify.ps1`, `scripts/dev/smoke-runtime.ps1`, and
  `scripts/dev/verify-editor-runtime-roundtrip.ps1`.
- `@playwright/cli` is invoked through `npx`; the repo does not pin a permanent
  Playwright dependency.
- Screenshots under `output/playwright/cp108` are local validation artifacts and
  should not be committed unless a specific issue asks for committed evidence.

## Related Audit Evidence

Manual Chrome DevTools MCP and prior Playwright CLI browser checks remain valid
audit inputs:

- CP-097: editor screenshot audit evidence under `docs/screenshots/phase11-cp097/`.
- CP-099: responsive layout audit evidence under `docs/screenshots/phase11-cp099/`.
- CP-100: accessibility audit JS checks recorded in `docs/ACCESSIBILITY_AUDIT.md`.
