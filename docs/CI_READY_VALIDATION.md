# CI Ready Validation Documentation

Date: 2026-06-04

Issue: CP-111 / FRA-146

## Result

PASS. Documented below: how the local validation suite maps to future CI,
which commands are CI-safe, which require Windows desktop/runtime support,
provider mock policy, cache expectations, and known nonfatal warnings.

---

## Command Map: Local → CI

### CI-Safe (Cross-Platform, No Desktop Required)

| Command | CI-Safe | Notes |
|---------|---------|-------|
| `npm run typecheck` | Yes | TypeScript compilation check; ~30s |
| `npm test -- --run` | Yes | Vitest suite; ~60s; all provider mocks included |
| `npm run build` | Yes | Vite production build; ~15s; output in `dist/` |
| `cargo test` (src-tauri/) | Yes | Rust unit tests; ~30s |
| `cmake --build build --config Release` | Yes | Native runtime build; requires CMake + C++ toolchain |
| `ctest --test-dir build --build-config Release --output-on-failure` | Yes | Native runtime tests; ~10s |

### CI-Safe with Script Wrapper (Cross-Platform)

| Command | CI-Safe | Notes |
|---------|---------|-------|
| `scripts/dev/smoke-runtime.ps1` | Yes | Requires built `rpg_creator_runtime.exe`; runs in hidden window; 3s timeout |
| `scripts/dev/verify-editor-runtime-roundtrip.ps1` | Yes | Requires built runtime + Vite; runs frontend tests, Tauri content check, native build, smoke, roundtrip |

### CI-Safe with Skip Flags

| Command | Skip Flag | What's Skipped |
|---------|-----------|----------------|
| `scripts/dev/verify.ps1 -SkipFrontend` | `-SkipFrontend` | npm typecheck, test, build |
| `scripts/dev/verify.ps1 -SkipDesktop` | `-SkipDesktop` | Cargo test, native build/test |
| `scripts/dev/verify.ps1 -SkipRuntime` | `-SkipRuntime` | CMake configure + build + CTest |
| `scripts/dev/verify.ps1 -SkipSmoke` | `-SkipSmoke` | Runtime launch smoke |

### Requires Windows Desktop/Tauri Shell (Not CI-Safe)

| Command | Reason |
|---------|--------|
| Native runtime launch with window visible | Requires Windows display; `-WindowStyle Hidden` used in scripts |
| Tauri desktop app launch | Requires Tauri shell + Windows display |
| Desktop packaging (`npm run desktop:package:windows`) | Requires full Tauri + Windows build toolchain |
| Playwright/E2E browser automation | Requires Chrome instance |

### Excluded from Normal CI (Live Provider Diagnostics)

| Command | Reason |
|---------|--------|
| `npm run provider-diag` | Makes live API calls to Anthropic, OpenAI, xAI |
| `npm run provider-diag-offline` | Safe for CI but verifies offline behavior only |
| Any test with `MOCK_AI_` prefix | Safe for CI; these use mocked providers |

---

## Provider Mock Policy

- All provider tests use mocked HTTP adapters.
- No test performs network calls or reads real credentials.
- Tests cover: success, malformed response, provider error, rate-limit, timeout, cancellation.
- Provider tests are CI-safe by default.

---

## Cache/Build Output Expectations

| Artifact | Location | CI Behavior |
|----------|----------|-------------|
| `node_modules/` | Project root | Cache in CI; restore on `npm ci` |
| `dist/` | Project root | Vite build output; regenerated each run |
| `build/` | Project root or `$LOCALAPPDATA/RPGCreatorAI/build` | CMake build; use `-BuildDir` override in CI |
| `target/` (Rust) | `src-tauri/target/` | Cargo cache; large; cache in CI |
| `docs/screenshots/phase10-mvp/` | Project root | Runtime smoke screenshots; ephemeral |

---

## Known Nonfatal Warnings

| Warning | Interpretation |
|---------|----------------|
| `LF will be replaced by CRLF` | Git line-ending normalization; nonfatal on Windows |
| `warning: unused import` (Rust) | Nonfatal unless `-D warnings` is passed |
| `npm warn deprecated` | Dependency deprecation; nonfatal unless it blocks install |
| CMake policy compatibility | `-DCMAKE_POLICY_VERSION_MINIMUM=3.5` handled in CMakePresets.json |
| Vite HMR disconnect | Nonfatal when running tests against built output |

---

## Recommended CI Pipeline

```yaml
# Future GitHub Actions workflow (not yet implemented)
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with: { node-version: '20' }
  - uses: actions/setup-python@v5
    with: { python-version: '3.12' }
  - uses: lukka/get-cmake@latest
  - run: npm ci
  - run: npm run typecheck
  - run: npm test -- --run
  - run: npm run build
  - run: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1 -SkipSmoke
  # Optional: runtime smoke if native build succeeds
  - run: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/smoke-runtime.ps1
```
