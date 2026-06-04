# Phase 11 Anthropic Claude Provider Adapter

Issue: CP-090 / FRA-125
Date: 2026-06-04

## Result

Anthropic Claude now has an executable editor-side adapter behind the shared
`ProviderAdapter` interface for text, structured authoring, and code-assist
workflows. The adapter remains optional, credential-gated, mocked in normal
validation, and independent of the native runtime.

## Audit Finding

Linear had marked CP-090 Done with a closeout that cited commit `a95e4cf` and
described only Claude registry metadata plus local mock contracts. Repo
inspection found no CP-090/FRA-125 commit and no executable Claude adapter.

## Official Docs Check

Before implementation, current official Anthropic docs were rechecked:

- Messages API reference:
  `https://docs.anthropic.com/en/api/messages`
- Messages examples:
  `https://docs.anthropic.com/en/api/messages-examples`
- Structured outputs:
  `https://platform.claude.com/docs/en/build-with-claude/structured-outputs`
- Errors:
  `https://docs.anthropic.com/en/api/errors`
- Rate limits:
  `https://docs.anthropic.com/en/api/rate-limits`
- Model overview:
  `https://platform.claude.com/docs/en/about-claude/models/overview`

Implementation choices from those docs:

- Text, structured authoring, and code-assist workflows map to
  `POST /v1/messages`.
- Requests use `x-api-key`, `anthropic-version: 2023-06-01`, `messages`, and
  `max_tokens`.
- Structured authoring can pass a JSON schema through
  `output_config.format`.
- API errors use the shared provider failure shape, with 429/rate-limit
  responses preserving provider retry intervals where present.

## Code Changes

- `src/providers/anthropicProviderAdapter.ts` adds
  `createAnthropicProviderAdapter` with injectable `fetch`, injectable
  credential lookup, Messages API request mapping, structured-output mapping,
  response normalization, JSON text parsing for structured output data,
  structured failure mapping, cancellation handling, and secret redaction.
- `src/providers/providerRegistry.ts` adds configurable Claude Opus 4.8,
  Claude Sonnet 4.6, and Claude Haiku 4.5 model metadata without making any
  model a required default.
- `src/providers/modelCapabilityRegistry.ts` adds Claude text,
  structured-JSON, code, and tool capability descriptors.
- `src/providers/__tests__/anthropicProviderAdapter.test.ts` covers success,
  structured output mapping, API error, rate limit, missing credentials, model
  listing, and credential redaction without live HTTP calls.

## Credential Boundary

The adapter accepts a credential resolver callback. If no credential is
returned, it fails closed with `missing-credentials` and does not call `fetch`.
No Anthropic API key is stored in project data, docs, test fixtures, logs, or
native runtime state.

## Safety Boundaries

- Normal validation uses mocked HTTP responses only.
- No live Anthropic API request was made.
- Project JSON and runtime code remain provider-independent.
- Claude output becomes structured provider-response data only; caller
  workflows still own candidate review and project mutation.

## Validation

TDD RED before implementation:

```powershell
npm test -- --run src/providers/__tests__/anthropicProviderAdapter.test.ts
```

Result: FAIL as expected. Vitest could not resolve
`../anthropicProviderAdapter` because the adapter module did not exist.

Focused GREEN after implementation:

```powershell
npm test -- --run src/providers/__tests__/anthropicProviderAdapter.test.ts
```

Result: PASS, 1 file and 5 tests.

Focused provider/security regression:

```powershell
npm test -- --run src/providers/__tests__/openAiProviderAdapter.test.ts src/providers/__tests__/anthropicProviderAdapter.test.ts src/providers/__tests__/providerRegistry.test.ts src/providers/__tests__/modelCapabilityRegistry.test.ts src/providers/__tests__/mockProviderContract.test.ts src/providers/__tests__/mockProviderAdapter.test.ts src/security/__tests__/redaction.test.ts
```

Result: PASS, 7 files and 38 tests.

TypeScript:

```powershell
npm run typecheck
```

Result: PASS.

Full canonical gate:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1
```

Result: PASS. Gates passed: frontend typecheck, full Vitest (100 files / 521
tests), frontend build, native C++ configure/build/CTest, Tauri content check,
43 Rust desktop tests, runtime smoke, and editor-runtime screenshot
roundtrip. Known nonfatal warnings remained: Vite chunk-size warning and
existing CMake FetchContent/deprecation warnings.
