# Phase 11 Kimi Provider Adapter

Issue: CP-091 / FRA-126
Date: 2026-06-04

## Result

Kimi / Moonshot now has an executable OpenAI-compatible editor-side adapter
for supported text, structured authoring, and code-assist workflows. The
implementation adds a reusable OpenAI-compatible adapter foundation for
providers that use Chat Completions-compatible HTTP APIs, while preserving the
local-first runtime and mock-only normal validation boundary.

## Audit Finding

Linear had marked CP-091 Done with a closeout that cited commit `a95e4cf` and
described only Kimi registry metadata plus local mock contracts. Repo
inspection found no CP-091/FRA-126 commit and no executable Kimi/Moonshot
adapter.

## Official Docs Check

Before implementation, current official Kimi/Moonshot docs were rechecked:

- API overview:
  `https://platform.kimi.ai/docs/api/overview`
- Chat Completions API:
  `https://platform.kimi.ai/docs/api/chat`
- Model list:
  `https://platform.kimi.ai/docs/models`
- Kimi K2.6 guide:
  `https://platform.kimi.ai/docs/guide/kimi-k2-6-quickstart`
- Rate limits:
  `https://www.kimi.com/help/kimi-api/api-rate-limits`
- API error codes:
  `https://www.kimi.com/help/kimi-api/api-error-codes`

Implementation choices from those docs:

- Kimi uses OpenAI-compatible HTTP APIs with SDK `base_url`
  `https://api.moonshot.ai/v1`.
- Direct chat calls use `POST /v1/chat/completions`.
- Authentication uses `Authorization: Bearer <MOONSHOT_API_KEY>`.
- JSON authoring maps to OpenAI-compatible `response_format` JSON mode.
- Rate-limit and quota/balance errors are normalized into shared provider
  failures.

## Code Changes

- `src/providers/openAiCompatibleProviderAdapter.ts` adds a reusable
  OpenAI-compatible Chat Completions adapter with injectable fetch, injectable
  credential lookup, configurable base URL, request/response normalization,
  JSON output parsing, rate-limit/quota/provider-error mapping, cancellation
  handling, and secret redaction.
- `src/providers/kimiProviderAdapter.ts` wraps the compatible adapter for
  provider id `moonshot`, default base URL `https://api.moonshot.ai/v1`, and
  default model `kimi-k2.6`.
- `src/providers/providerRegistry.ts` adds configurable Kimi K2.6, Kimi K2.5,
  and Moonshot v1 model metadata while keeping model selection user-driven.
- `src/providers/modelCapabilityRegistry.ts` adds Kimi/Moonshot text,
  structured-JSON, code, and tool capability descriptors.
- `src/providers/__tests__/kimiProviderAdapter.test.ts` covers model listing,
  missing credentials, default and custom base URLs, Chat Completions request
  mapping, JSON authoring, error normalization, rate limits, quota/balance
  failures, and redaction without live HTTP calls.

## Credential Boundary

The adapter accepts a credential resolver callback. If no credential is
returned, it fails closed with `missing-credentials` and does not call `fetch`.
No Moonshot API key is stored in project data, docs, test fixtures, logs, or
runtime state.

## Safety Boundaries

- Normal validation uses mocked HTTP responses only.
- No live Kimi/Moonshot API request was made.
- The native runtime remains independent of providers, credentials, network,
  cloud services, and AI.
- Project mutation remains owned by explicit editor workflows after candidate
  review.

## Validation

TDD RED before implementation:

```powershell
npm test -- --run src/providers/__tests__/kimiProviderAdapter.test.ts
```

Result: FAIL as expected. Vitest could not resolve `../kimiProviderAdapter`
because the adapter module did not exist.

Focused GREEN after implementation:

```powershell
npm test -- --run src/providers/__tests__/kimiProviderAdapter.test.ts
```

Result: PASS, 1 file and 5 tests.

Focused provider/security regression:

```powershell
npm test -- --run src/providers/__tests__/openAiProviderAdapter.test.ts src/providers/__tests__/anthropicProviderAdapter.test.ts src/providers/__tests__/kimiProviderAdapter.test.ts src/providers/__tests__/providerRegistry.test.ts src/providers/__tests__/modelCapabilityRegistry.test.ts src/providers/__tests__/mockProviderContract.test.ts src/providers/__tests__/mockProviderAdapter.test.ts src/security/__tests__/redaction.test.ts
```

Result: PASS, 8 files and 45 tests.

TypeScript:

```powershell
npm run typecheck
```

Result: PASS.

Full canonical gate:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1
```

Result: PASS. Gates passed: frontend typecheck, full Vitest (101 files / 528
tests), frontend build, native C++ configure/build/CTest, Tauri content check,
43 Rust desktop tests, runtime smoke, and editor-runtime screenshot
roundtrip. Known nonfatal warnings remained: Vite chunk-size warning and
existing CMake FetchContent/deprecation warnings.
