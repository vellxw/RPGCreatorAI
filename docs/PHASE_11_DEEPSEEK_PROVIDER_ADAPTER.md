# Phase 11 DeepSeek Provider Adapter

Issue: CP-092 / FRA-127
Date: 2026-06-04

## Result

DeepSeek now has an executable OpenAI-compatible editor-side adapter for
supported text, structured authoring, and code-assist workflows. It reuses the
shared OpenAI-compatible Chat Completions adapter added for CP-091 while
applying DeepSeek-specific base URL, token parameter, model metadata, and
failure mapping tests.

## Audit Finding

Linear had marked CP-092 Done with a closeout that cited commit `a95e4cf` and
described only DeepSeek registry metadata plus local mock contracts. Repo
inspection found no CP-092/FRA-127 commit and no executable DeepSeek adapter.

## Official Docs Check

Before implementation, current official DeepSeek docs were rechecked:

- First API call / overview:
  `https://api-docs.deepseek.com/`
- Create chat completion:
  `https://api-docs.deepseek.com/api/create-chat-completion`
- Reasoning model:
  `https://api-docs.deepseek.com/guides/reasoning_model`
- List models:
  `https://api-docs.deepseek.com/api/list-models`
- Error codes:
  `https://api-docs.deepseek.com/quick_start/error_codes`

Implementation choices from those docs:

- DeepSeek uses OpenAI-compatible chat completions.
- OpenAI-format base URL is `https://api.deepseek.com`.
- Chat calls use `/chat/completions`.
- Authentication uses `Authorization: Bearer <DEEPSEEK_API_KEY>`.
- DeepSeek uses `max_tokens` rather than Kimi's `max_completion_tokens`.
- Current v4 models are preferred while `deepseek-chat` and
  `deepseek-reasoner` remain compatibility aliases until their documented
  future deprecation date.

## Code Changes

- `src/providers/deepSeekProviderAdapter.ts` wraps the shared
  OpenAI-compatible adapter for provider id `deepseek`, default base URL
  `https://api.deepseek.com`, default model `deepseek-v4-flash`, and
  DeepSeek's `max_tokens` request field.
- `src/providers/openAiCompatibleProviderAdapter.ts` now supports either
  `max_completion_tokens` or `max_tokens` per wrapped provider.
- `src/providers/providerRegistry.ts` adds configurable DeepSeek V4 Flash,
  V4 Pro, Chat, and Reasoner model metadata plus configurable base URL
  metadata.
- `src/providers/modelCapabilityRegistry.ts` adds DeepSeek text,
  structured-JSON, and code capability descriptors.
- `src/providers/__tests__/deepSeekProviderAdapter.test.ts` covers model
  listing, missing credentials, default and custom base URLs, DeepSeek
  `max_tokens`, JSON authoring, API error/rate-limit/quota mapping, and
  redaction without live HTTP calls.

## Credential Boundary

The adapter accepts a credential resolver callback. If no credential is
returned, it fails closed with `missing-credentials` and does not call `fetch`.
No DeepSeek API key is stored in project data, docs, test fixtures, logs, or
runtime state.

## Safety Boundaries

- Normal validation uses mocked HTTP responses only.
- No live DeepSeek API request was made.
- The native runtime remains independent of providers, credentials, network,
  cloud services, and AI.
- Project mutation remains owned by explicit editor workflows after candidate
  review.

## Validation

TDD RED before implementation:

```powershell
npm test -- --run src/providers/__tests__/deepSeekProviderAdapter.test.ts
```

Result: FAIL as expected. Vitest could not resolve
`../deepSeekProviderAdapter` because the adapter module did not exist.

Focused GREEN after implementation:

```powershell
npm test -- --run src/providers/__tests__/deepSeekProviderAdapter.test.ts
```

Result: PASS, 1 file and 5 tests.

Focused provider/security regression:

```powershell
npm test -- --run src/providers/__tests__/openAiProviderAdapter.test.ts src/providers/__tests__/anthropicProviderAdapter.test.ts src/providers/__tests__/kimiProviderAdapter.test.ts src/providers/__tests__/deepSeekProviderAdapter.test.ts src/providers/__tests__/providerRegistry.test.ts src/providers/__tests__/modelCapabilityRegistry.test.ts src/providers/__tests__/mockProviderContract.test.ts src/providers/__tests__/mockProviderAdapter.test.ts src/security/__tests__/redaction.test.ts
```

Result: PASS, 9 files and 52 tests.

TypeScript:

```powershell
npm run typecheck
```

Result: PASS.

Full canonical gate:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1
```

Result: PASS. Gates passed: frontend typecheck, full Vitest (102 files / 535
tests), frontend build, native C++ configure/build/CTest, Tauri content check,
43 Rust desktop tests, runtime smoke, and editor-runtime screenshot roundtrip.
Known nonfatal warnings remained: Vite chunk-size warning and existing CMake
FetchContent/deprecation warnings.
