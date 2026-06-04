# Phase 11 MiniMax Provider Adapter

Issue: CP-093 / FRA-128
Date: 2026-06-04

## Result

MiniMax now has an executable editor-side adapter for the app workflows that
RPGCreatorAI can currently route safely: text generation and image generation.
Audio and video MiniMax APIs remain documented as official provider
capabilities, but they are not exposed as executable adapter operations until
the editor has concrete audio/video generation workflows and output handling.

## Audit Finding

Linear had marked CP-093 Done with a closeout that cited commit `a95e4cf` and
described provider registry metadata plus offline mock contracts. Repo
inspection found no CP-093/FRA-128 commit and no executable MiniMax adapter
through the shared provider interface.

## Official Docs Check

Before implementation, current official MiniMax docs were rechecked:

- API overview: `https://platform.minimax.io/docs/api-reference/api-overview`
- OpenAI-compatible text API:
  `https://platform.minimax.io/docs/api-reference/text-openai-api`
- Text generation guide:
  `https://platform.minimax.io/docs/guides/text-generation`
- Image generation guide:
  `https://platform.minimax.io/docs/guides/image-generation`
- Text-to-image API:
  `https://platform.minimax.io/docs/api-reference/image-generation-t2i`
- Text-to-speech HTTP API:
  `https://platform.minimax.io/docs/api-reference/speech-t2a-http`
- Video generation guide:
  `https://platform.minimax.io/docs/guides/video-generation`
- Rate limits:
  `https://platform.minimax.io/docs/guides/rate-limits`
- Error codes:
  `https://platform.minimax.io/docs/api-reference/errorcode`

Implementation choices from those docs:

- Text uses the OpenAI-compatible base URL `https://api.minimax.io/v1`.
- Text calls use `/chat/completions` with `Authorization: Bearer
  <MINIMAX_API_KEY>`.
- MiniMax-M3 is the preferred text model for current long-context authoring.
- MiniMax text supports `max_completion_tokens` for new integrations.
- Image generation uses `/image_generation` with model `image-01`.
- MiniMax image responses may return URLs or `image_base64`, depending on
  `response_format`.
- MiniMax T2A and video APIs exist, but RPGCreatorAI does not yet have
  app-level audio/video generation workflows that can persist and review their
  outputs. Those operations are intentionally not exposed by the adapter.
- MiniMax error codes `1002`, `1008`, and related rate/quota/timeout cases are
  normalized into structured provider failures.

## Code Changes

- `src/providers/miniMaxProviderAdapter.ts` implements MiniMax text and image
  execution with injected credential lookup, configurable base URL, missing
  credential handling, request cancellation, provider error normalization, and
  secret redaction.
- `src/providers/providerRegistry.ts` now lists concrete MiniMax models:
  `MiniMax-M3`, `MiniMax-M2.7`, `MiniMax-M2.7-highspeed`, and `image-01`.
- `src/providers/modelCapabilityRegistry.ts` adds MiniMax text and image
  capability descriptors without marking video generation available.
- `src/providers/__tests__/miniMaxProviderAdapter.test.ts` covers metadata,
  missing credentials, text requests, image requests, structured errors, rate
  limits, quota failures, redaction, and unsupported audio/video execution.

## Credential Boundary

The adapter accepts a credential resolver callback. If no credential is
returned, it fails closed with `missing-credentials` and does not call `fetch`.
No MiniMax API key is stored in project data, docs, test fixtures, logs, or
runtime state.

## Safety Boundaries

- Normal validation uses mocked HTTP responses only.
- No live MiniMax API request was made.
- The native runtime remains independent of providers, credentials, network,
  cloud services, and AI.
- Audio/video APIs are not exposed as executable workflows until local product
  flows can persist, review, and validate their outputs.

## Validation

TDD RED before implementation:

```powershell
npm test -- --run src/providers/__tests__/miniMaxProviderAdapter.test.ts
```

Result: FAIL as expected. Vitest could not resolve
`../miniMaxProviderAdapter` because the adapter module did not exist.

Focused GREEN after implementation:

```powershell
npm test -- --run src/providers/__tests__/miniMaxProviderAdapter.test.ts
```

Result: PASS, 1 file and 6 tests.

Focused provider/security regression:

```powershell
npm test -- --run src/providers/__tests__/openAiProviderAdapter.test.ts src/providers/__tests__/anthropicProviderAdapter.test.ts src/providers/__tests__/kimiProviderAdapter.test.ts src/providers/__tests__/deepSeekProviderAdapter.test.ts src/providers/__tests__/miniMaxProviderAdapter.test.ts src/providers/__tests__/providerRegistry.test.ts src/providers/__tests__/modelCapabilityRegistry.test.ts src/providers/__tests__/mockProviderContract.test.ts src/providers/__tests__/mockProviderAdapter.test.ts src/security/__tests__/redaction.test.ts
```

Result: PASS, 10 files and 60 tests.

TypeScript:

```powershell
npm run typecheck
```

Result: PASS.

Full canonical gate:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1
```

Result: PASS. Gates passed: frontend typecheck, full Vitest (103 files / 543
tests), frontend build, native C++ configure/build/CTest, Tauri content check,
43 Rust desktop tests, runtime smoke, and editor-runtime screenshot roundtrip.
Known nonfatal warnings remained: Vite chunk-size warning and existing CMake
FetchContent/deprecation warnings.
