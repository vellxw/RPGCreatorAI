# CI Ready Validation Documentation

Date: 2026-06-04

Issue: CP-111 / FRA-146

## Result

PASS. This runbook maps the local validation suite to future CI without adding
CI infrastructure. It separates portable Node checks, Windows native/runtime
checks, optional browser automation, provider mock policy, cache expectations,
artifact cleanup, and known nonfatal warnings.

---

## Command Map

### Portable Node Checks

These commands do not require the Windows native runtime, Tauri shell, provider
credentials, or live network calls.

| Command | CI use | Notes |
| --- | --- | --- |
| `npm ci` | Required setup | Restores the locked Node dependency graph. |
| `npm run typecheck` | Required | TypeScript compilation check via `tsc --noEmit`. |
| `npm test -- --run` | Required | Full Vitest suite, including offline provider fixtures and mocked fetch adapters. |
| `npm run build` | Required | Runs `tsc --noEmit && vite build`; output is regenerated under `dist/`. |

### Windows Native And Desktop Checks

These are CI-ready for a Windows runner with Node, Python, Rust/Cargo, CMake,
Ninja, and Visual Studio C++ tools installed. They are not cross-platform shell
commands because the repo wrappers are PowerShell/`.bat` and the runtime output
is `rpg_creator_runtime.exe`.

| Command | CI use | Notes |
| --- | --- | --- |
| `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1` | Full Windows gate | Runs frontend typecheck/tests/build, asset export validation, native configure/build/CTest, Tauri content check, Rust desktop tests, runtime smoke, and editor-runtime roundtrip. |
| `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1 -SkipSmoke` | Desktop/native without runtime launch smoke | Useful when a runner can build and test but cannot launch the runtime process reliably. |
| `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1 -SkipFrontend -SkipDesktop -SkipSmoke` | Native C++ + asset pipeline only | Mirrors `npm run verify:runtime:windows`; avoids duplicate frontend work in split CI jobs. |
| `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/smoke-runtime.ps1` | Optional focused smoke | Requires a built runtime at the default `%LOCALAPPDATA%\RPGCreatorAI\build` location or an explicit `-BuildDir`. |
| `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify-editor-runtime-roundtrip.ps1` | Optional focused roundtrip | Starts/reuses Vite on `127.0.0.1:1420`, runs frontend roundtrip fixtures, Rust desktop tests, native build/test, runtime smoke, and screenshot hash roundtrip. |
| `cargo test --manifest-path src-tauri/Cargo.toml` | Optional focused desktop test | Runs Rust desktop shell unit tests without launching the Tauri app. |

### Asset Pipeline Checks

| Command | CI use | Notes |
| --- | --- | --- |
| `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/export-runtime-assets.ps1 --validate-only` | CI-safe on Windows/PowerShell runners | Validates committed generated-asset manifests and runtime export paths without live providers. |
| `python scripts/dev/export_runtime_assets.py --validate-only` | Portable equivalent | Use when Python is available and PowerShell is not desired. |

### Optional Browser Automation

| Command | CI use | Notes |
| --- | --- | --- |
| `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/smoke-browser-editor.ps1` | Optional, browser-capable runner only | Starts/reuses Vite on `127.0.0.1:3000`, drives the editor through `npx @playwright/cli`, and writes artifacts under `output/playwright/cp108`. |
| `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/smoke-browser-editor.ps1 -SkipBrowser` | Capability probe / explicit skip | Exits 0 with `BROWSER SMOKE SKIPPED: SkipBrowser requested.` and writes `skip.txt`. |

### Skip Flags

| Command | Skips |
| --- | --- |
| `scripts/dev/verify.ps1 -SkipFrontend` | `npm run typecheck`, `npm test`, `npm run build` |
| `scripts/dev/verify.ps1 -SkipAssets` | Phase 11 asset export validation |
| `scripts/dev/verify.ps1 -SkipRuntime` | Native CMake configure/build/CTest, runtime smoke, editor-runtime roundtrip |
| `scripts/dev/verify.ps1 -SkipDesktop` | Tauri content check and Rust desktop tests |
| `scripts/dev/verify.ps1 -SkipSmoke` | Runtime launch smoke and editor-runtime roundtrip |

---

## Provider Mock Policy

- Normal validation must stay offline and mock-backed.
- The current `package.json` has no `provider-diag` or live-provider diagnostic
  script. Do not add one to normal CI.
- Live provider diagnostics, if introduced later, must be explicit opt-in,
  credential-gated, redacted, and reported separately from normal validation.
- Provider Vitest coverage lives under `src/providers/__tests__` and uses
  injected mock fetch functions, local `offline-mock`,
  `offline-image-mock`, and `offline-image-edit-mock` fixtures.
- The provider contract suite checks success, malformed responses, provider
  errors, rate-limit/quota style failures, timeouts/cancellation, disabled
  provider routing, and missing credentials without using real API keys.
- Fixture values that look like provider names, model names, URLs, or env var
  names are metadata/test assertions only unless a live diagnostic is explicitly
  authorized outside the normal gate.

---

## Cache And Artifact Expectations

| Artifact | Location | CI behavior |
| --- | --- | --- |
| `node_modules/` | repo root | Restore through `npm ci`; cache by `package-lock.json` if desired. |
| `dist/` | repo root | Generated by `npm run build`; do not commit generated output. |
| Native CMake build | `%LOCALAPPDATA%\RPGCreatorAI\build` by default | Cache only if runner isolation is reliable; otherwise regenerate. Use `-BuildDir` for custom CI paths. |
| Rust/Tauri target | `%LOCALAPPDATA%\RPGCreatorAI\tauri-target` for package helper, or Cargo default when running focused tests | Cache by Cargo lock/toolchain when useful. |
| Browser smoke artifacts | `output/playwright/cp108` and `.playwright-cli/` | Local evidence only; do not commit. Clean after CI job. |
| Runtime smoke screenshots | `docs/screenshots/phase10-mvp/` | Smoke evidence files are tracked project evidence; CI should run in a clean checkout and fail if unexpected diffs appear. |
| Runtime logs/build smoke output | `%LOCALAPPDATA%\RPGCreatorAI\build` and app-data runtime log folders | Job-local diagnostics; upload only after redacting accidental secrets. |

---

## Known Nonfatal Warnings

Treat these as nonfatal only when the command exits 0 and prints its expected
success marker.

| Warning | Interpretation |
| --- | --- |
| `LF will be replaced by CRLF` | Git line-ending normalization on Windows. |
| Vite chunk-size warning | Current bundle size warning; does not fail `npm run build`. |
| `Could NOT find PkgConfig` during SDL/CMake configure | Expected on current Windows setup; SDL still configures. |
| CMake FetchContent CMP0135 developer warnings | Dependency policy warnings from fetched third-party projects. |
| Dependency `cmake_minimum_required` deprecation warnings | Third-party CMake compatibility warnings. |
| Optional audio endpoint/sample WAV warnings during smoke | Nonfatal when runtime smoke still prints `SMOKE PASSED`. |

---

## Recommended Future CI Shape

No workflow file is created for CP-111. Future CI should be split so portable
checks are fast and Windows-specific checks run only where the toolchain exists.

```yaml
# Sketch only - not committed as a workflow in CP-111.
jobs:
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm ci
      - run: npm run typecheck
      - run: npm test -- --run
      - run: npm run build

  windows-native:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - uses: actions/setup-python@v5
        with: { python-version: '3.12' }
      - run: npm ci
      - run: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1 -SkipFrontend -SkipDesktop -SkipSmoke

  windows-full-optional:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - uses: actions/setup-python@v5
        with: { python-version: '3.12' }
      - run: npm ci
      - run: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1
```

Before enabling `windows-full-optional` as required CI, confirm the runner can
launch the hidden native runtime and temporary Vite/Tauri-content checks
reliably. Browser smoke should remain optional unless the runner has stable
Playwright/browser support.
