# First Paint Performance Budget

Issue: PX-021 / FRA-455
Date: 2026-06-08

## Measurement Command

Run the repo-local first-paint measurement from the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/measure-first-paint.ps1
```

Restricted execution-policy environments can use:

```bat
scripts\dev\measure-first-paint.bat
```

NPM alias:

```powershell
npm run measure:first-paint:windows
```

The command starts or reuses Vite at `http://127.0.0.1:3000`, drives the
startup route through `@playwright/cli` via `npx`, waits for the static or
React splash selector, reads browser paint/navigation timing entries, and
writes local evidence under:

```text
output/playwright/phase12-px021-first-paint
```

Expected success marker:

```text
FIRST PAINT MEASURE PASSED
```

If browser automation is unavailable, the command exits successfully only with
an explicit skip marker:

```text
FIRST PAINT MEASURE SKIPPED: <reason>
```

Assertion or budget failures fail the command.

## Startup Budgets

| Metric | Budget | Evidence source |
| --- | ---: | --- |
| Splash visible budget | `splashVisibleMs <= 1000 ms` | Time from browser navigation start until `[data-rpg-splash-shell]` or `[data-testid="app-splash-shell"]` is visible and two animation frames have elapsed. |
| First contentful paint budget | `firstContentfulPaintMs <= 1500 ms` | Browser `performance.getEntriesByType('paint')` entry named `first-contentful-paint`, when the browser reports it. |
| DOMContentLoaded budget | `domContentLoadedMs <= 2500 ms` | Browser navigation timing `domContentLoadedEventEnd`. |
| Desktop launch budget | splash/startup evidence visible within `3000 ms` after packaged executable launch | Future packaged launch screenshot/smoke evidence should record the elapsed time from `Start-Process` to the first captured product shell. |

The browser budgets are intentionally practical for local Windows development:
they measure whether the product shell appears quickly without introducing paid
monitoring, CI infrastructure, or live service dependencies.

## Evidence Procedure

For launcher/startup issues that affect first paint:

1. Run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/measure-first-paint.ps1`.
2. Record the exact command, success/skip marker, and timing values in
   `docs/VALIDATION_LOG.md`.
3. Keep generated files under `output/playwright/phase12-px021-first-paint`
   out of commits unless an issue explicitly asks for committed artifacts.
4. If a budget fails, fix the startup regression or document a scoped,
   issue-specific budget change before moving the Linear issue to Done.
5. For packaged desktop launch work, pair this browser timing with
   `scripts/dev/smoke-packaged-executable-launch.ps1` and screenshot evidence
   from the packaged shell when that issue asks for desktop evidence.

## Current PX-021 Evidence

Validation run on 2026-06-08:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/measure-first-paint.ps1
```

Result:

```text
FIRST PAINT MEASURE PASSED
Splash visible: 52 ms <= 1000 ms
First contentful paint: 352 ms <= 1500 ms (when reported)
DOMContentLoaded: 1283 ms <= 2500 ms
Artifacts: output/playwright/phase12-px021-first-paint
```

The generated `startup-first-paint.json` reported
`measuredAt=2026-06-08T06:20:03.742Z`, HeadlessChrome `149.0.0.0`,
`firstPaintMs=352`, `firstContentfulPaintMs=352`, `domContentLoadedMs=1283`,
and `loadEventEndMs=1296`. The startup shell had already advanced by the time
the post-load query ran, so `splashVisibleMs=52` comes from the static
`window.__RPG_STARTUP_MARKS__.staticSplashDomReadyMs` mark emitted immediately
after the pre-React splash shell markup.
