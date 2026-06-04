# Phase 11 OpenAI Provider Adapter

Issue: CP-089 / FRA-124
Date: 2026-06-04

## Result

The OpenAI provider now has an executable editor-side adapter behind the
shared `ProviderAdapter` interface. The adapter remains optional and
credential-gated, uses mocked tests for normal validation, and does not add a
native runtime, project-data, or live-validation dependency.

## Audit Finding

Linear had marked CP-089 Done with a closeout that cited commit `a95e4cf` and
described OpenAI registry metadata plus mocked local contracts. Repo inspection
found no OpenAI adapter implementation, no OpenAI request/response
normalization, no mocked OpenAI HTTP tests, and no CP-089/FRA-124 commit.

## Official Docs Check

Before implementation, current official OpenAI docs were rechecked because the
issue explicitly required it:

- Responses API reference:
  `https://platform.openai.com/docs/api-reference/responses?api-mode=responses`
- Image generation guide:
  `https://developers.openai.com/api/docs/guides/image-generation`
- Images API reference:
  `https://developers.openai.com/api/reference/resources/images`
- Responses image-generation tool guide:
  `https://developers.openai.com/api/docs/guides/tools-image-generation`
- Rate-limit guide:
  `https://developers.openai.com/api/docs/guides/rate-limits`
- GPT-5.5 model page:
  `https://developers.openai.com/api/docs/models/gpt-5.5/`

Implementation choices from those docs:

- Text and vision workflows use `POST /v1/responses`.
- Single-prompt image generation uses `POST /v1/images/generations`.
- Image edits use `POST /v1/images/edits` when an image reference is supplied.
- GPT Image model metadata remains configurable and capability-driven.
- Rate-limit failures preserve retry intervals when the provider returns
  `retry-after` or reset headers.

## Code Changes

- `src/providers/openAiProviderAdapter.ts` adds `createOpenAiProviderAdapter`
  with injectable `fetch`, injectable credential resolution, request builders,
  response normalization, structured failure mapping, cancellation handling,
  and secret redaction.
- `src/providers/providerAdapter.ts` adds the `missing-credentials` failure
  kind so credential-gated provider execution can fail closed without being
  reported as a provider API error.
- `src/providers/providerRegistry.ts` adds `gpt-5.5` as a configurable OpenAI
  text/vision model while preserving user-selected model configuration.
- `src/providers/modelCapabilityRegistry.ts` adds `gpt-5.5` text, structured
  JSON, vision, and tool capability metadata.
- `src/providers/__tests__/openAiProviderAdapter.test.ts` covers success,
  API error, rate limit, missing credentials, text normalization, image
  generation, and image edit normalization without live HTTP calls.

## Credential Boundary

The adapter accepts a credential resolver callback instead of reading a secret
from project data or the browser environment. If no credential is returned, it
does not call `fetch` and returns a structured `missing-credentials` failure.

This preserves the CP-058 policy: credentials are not stored in project JSON,
not returned by existing credential metadata commands, and not required by the
native runtime. Future desktop provider execution can provide an approved
credential broker without changing the shared adapter contract.

## Safety Boundaries

- Normal validation uses mocked HTTP responses only.
- No live OpenAI API request was made.
- The adapter redacts known credential values from API errors and thrown
  network errors before returning them to caller-visible response objects.
- Image responses return stable generated refs plus structured image payload
  metadata; project asset writes remain the responsibility of later workflow
  layers.
- Unknown project/runtime code paths remain provider-independent.

## Validation

TDD RED before implementation:

```powershell
npm test -- --run src/providers/__tests__/openAiProviderAdapter.test.ts
```

Result: FAIL as expected. Vitest could not resolve
`../openAiProviderAdapter` because the adapter module did not exist.

Focused GREEN after implementation:

```powershell
npm test -- --run src/providers/__tests__/openAiProviderAdapter.test.ts
```

Result: PASS, 1 file and 6 tests.

Focused provider/security regression:

```powershell
npm test -- --run src/providers/__tests__/openAiProviderAdapter.test.ts src/providers/__tests__/providerRegistry.test.ts src/providers/__tests__/modelCapabilityRegistry.test.ts src/providers/__tests__/mockProviderContract.test.ts src/providers/__tests__/mockProviderAdapter.test.ts src/security/__tests__/redaction.test.ts
```

Result: PASS, 6 files and 30 tests before adding the explicit GPT-5.5
registry/capability assertions.

Focused provider/security rerun after explicit GPT-5.5 assertions:

```powershell
npm test -- --run src/providers/__tests__/openAiProviderAdapter.test.ts src/providers/__tests__/providerRegistry.test.ts src/providers/__tests__/modelCapabilityRegistry.test.ts src/providers/__tests__/mockProviderContract.test.ts src/providers/__tests__/mockProviderAdapter.test.ts src/security/__tests__/redaction.test.ts
```

Result: PASS, 6 files and 31 tests.

TypeScript:

```powershell
npm run typecheck
```

Result: FAIL once after implementation due to test mock tuple inference and two
adapter narrowing issues. Fix applied: typed the mocked fetch functions and
made adapter response/image normalization guards explicit.

```powershell
npm run typecheck
```

Result: PASS.

Full canonical gate:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1
```

Result: PASS. Gates passed: frontend typecheck, full Vitest (99 files / 514
tests), frontend build, native C++ configure/build/CTest, Tauri content check,
43 Rust desktop tests, runtime smoke, and editor-runtime screenshot
roundtrip. Known nonfatal warnings remained: Vite chunk-size warning and
existing CMake FetchContent/deprecation warnings.
