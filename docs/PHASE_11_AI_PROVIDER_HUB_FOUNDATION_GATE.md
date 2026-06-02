# Phase 11 AI Provider Hub Foundation Gate

Issue: CP-064 / FRA-99
Date: 2026-06-02

## Result

Milestone 07, AI Provider Hub Foundation, is green.

The gate validated Settings provider surfaces, credential boundaries, the AI
request queue, provider registry contracts, capability gates, cost and budget
states, and offline mocked provider contracts as one editor-side foundation.
The app remains usable with zero configured providers, and the native runtime
remains local, deterministic, data-driven, and independent of AI providers,
network, cloud services, API credentials, or live generation APIs.

## Integrated Areas

Validated foundation pieces:

- provider Settings UI with disabled and missing-credential states
- desktop credential metadata and browser unavailable states
- bounded AI request queue, cancellation, retry, and write-intent guards
- provider registry and adapter request/response contracts
- model capability registry and read-only workflow gates
- cost availability, paid-work confirmation, budget, rate-limit, and quota
  states
- offline mocked provider contract fixtures for success, malformed response,
  provider error, rate-limit, timeout, and cancellation cases
- deterministic request serialization with redaction of secret-looking fields

No live OpenAI, Claude, Kimi/Moonshot, DeepSeek, MiniMax, custom endpoint, or
other paid provider request was made. No provider credential value is stored in
project JSON, docs, logs, or native runtime data.

## Commands

Focused provider-hub suite:

```powershell
npm test -- --run src/screens/__tests__/SettingsScreen.test.tsx src/components/layout/__tests__/MvpPlaceholderGating.test.tsx src/components/ai/__tests__/AIRequestQueuePanel.test.tsx src/components/ai/__tests__/ProviderCapabilityGatesPanel.test.tsx src/components/ai/__tests__/ProviderCostBudgetPanel.test.tsx src/adapters/__tests__/CredentialStoreAdapter.test.ts src/security/__tests__/redaction.test.ts src/providers/__tests__/providerRegistry.test.ts src/providers/__tests__/modelCapabilityRegistry.test.ts src/providers/__tests__/providerCostBudget.test.ts src/providers/__tests__/mockProviderAdapter.test.ts src/providers/__tests__/mockProviderContract.test.ts src/stores/__tests__/providerStore.test.tsx src/stores/__tests__/aiRequestQueueStore.test.ts
```

Result: PASS, 14 focused files and 41 Vitest tests.

Frontend validation requested by Linear:

```powershell
npm run typecheck
npm test -- --run
npm run build
```

Result: PASS. Full Vitest passed 74 files and 389 tests. Vite transformed
1940 modules and emitted the known non-fatal chunk-size warning.

Provider/runtime boundary scans:

```powershell
rg -n "(OpenAI|Anthropic|Claude|Moonshot|DeepSeek|MiniMax|provider|credential|api[-_ ]?key|AI|network|cloud)" src tests CMakeLists.txt tests\CMakeLists.txt --glob "*.cpp" --glob "*.h" --glob "*.hpp" --glob "*.cxx" --glob "*.cc" --glob "*.cmake"
rg -n "(fetch|axios|WebSocket|EventSource|XMLHttpRequest|https://api|apiKey|secret|token|sk-)" src tests docs --glob "*.ts" --glob "*.tsx" --glob "*.rs" --glob "*.md"
```

Result: PASS. The native runtime scan produced only false positives in
`tests/main_test.cpp` and `src/renderer/Renderer2D.cpp`; no native runtime AI,
provider, network, cloud, or credential dependency exists. The provider scan
found provider metadata, test names, credential labels, and documentation only,
with no live call sites in provider UI/modules and no secret value.

Zero-provider browser smoke:

```powershell
npm run dev -- --host 127.0.0.1
npx --yes --package @playwright/cli playwright-cli -s=cp064 open http://127.0.0.1:3000/
npx --yes --package @playwright/cli playwright-cli -s=cp064 click "button:has-text('Use My First RPG')"
npx --yes --package @playwright/cli playwright-cli -s=cp064 click "button:has-text('Settings')"
npx --yes --package @playwright/cli playwright-cli -s=cp064 snapshot
npx --yes --package @playwright/cli playwright-cli -s=cp064 close
```

Result: PASS after re-reading the snapshot with a stricter marker check. The
Settings surface showed `Provider Settings`, `0 ready`, `Capability Gates`,
`Cost & Budget`, `AI Request Queue`, `0 active`, runtime-independent copy, and
no live generate, connect, or test-provider action.

Canonical integration gate:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1
```

Result: PASS.

Gate summary:

- PASS: frontend typecheck
- PASS: frontend tests, 74 files and 389 Vitest tests
- PASS: frontend build, with the known Vite chunk-size warning only
- PASS: native C++ configure/build/CTest, `RPGTests` 1/1
- PASS: Tauri content check
- PASS: Rust desktop tests, 43 tests
- PASS: runtime smoke
- PASS: editor-runtime screenshot roundtrip

Roundtrip hashes:

- baseline:
  `6C65F8EF5028B064BA8694E005E752CD674861F2F553B7D49E78CD7B46D64944`
- edited:
  `D845D8BBEE8D38C68819A6ECCC927CE357A2FAEA86F4FD604D6EAB394E62340E`

## Known Boundaries

- The provider hub is a foundation only; it does not add live provider
  execution, image generation, asset writes, or model diagnostics.
- Live provider diagnostics remain opt-in and require explicit credentials and
  user permission.
- Provider base URLs and environment variable labels are metadata only.
- Browser credential storage remains honestly unavailable.
- The Vite chunk-size warning, third-party CMake policy/deprecation warnings,
  and local audio-device unavailable warnings remain non-fatal.

## Next

Milestone 08 can start with the GPT Image 2 asset pipeline. That work must stay
optional editor/tooling infrastructure and must continue using mocks and
contract tests for normal validation.
