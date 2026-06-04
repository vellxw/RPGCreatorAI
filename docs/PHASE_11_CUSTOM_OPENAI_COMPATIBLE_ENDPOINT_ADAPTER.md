# Phase 11 Custom OpenAI-Compatible Endpoint Adapter

Issue: CP-095 / FRA-130
Date: 2026-06-04

## Result

RPGCreatorAI now supports advanced user-configured OpenAI-compatible chat
endpoints without code changes. The support remains editor-only and opt-in:
users must provide a base URL, credential, model id, and capability metadata
before routing can become available.

The native runtime remains independent of providers, credentials, network,
cloud services, and live APIs.

## Audit Finding

Linear had marked CP-095 Done with a closeout that cited commit `a95e4cf` and
described provider registry metadata plus offline mock contracts. Repo
inspection found no CP-095/FRA-130 commit, no dedicated custom endpoint
adapter, and no settings controls for base URL or capability config.

## Official Docs Check

Before implementation, current OpenAI Chat Completions API reference was
rechecked because OpenAI-compatible endpoints mimic that request/response
shape:

- Chat Completions create API:
  `https://platform.openai.com/docs/api-reference/chat/create-chat-completion`

Implementation choices from that shape:

- The custom adapter targets `/chat/completions`.
- Requests send `Authorization: Bearer <credential>` and
  `Content-Type: application/json`.
- Requests include `model` and `messages`.
- Schema-oriented editor flows map to `response_format: { type:
  'json_object' }`.
- Response normalization reads `choices[0].message.content` and usage token
  fields when present.

## Code Changes

- `src/providers/customOpenAiEndpointConfig.ts` validates custom endpoint base
  URLs and maps user-entered capability config to provider/model operations.
- `src/providers/customOpenAiCompatibleProviderAdapter.ts` wraps the reusable
  OpenAI-compatible adapter for provider id `custom`, requiring explicit base
  URL, model id, capabilities, and credential before execution.
- `src/providers/providerRegistry.ts` keeps the custom provider
  OpenAI-compatible with configurable base URL and no registry model defaults.
- `src/providers/modelCapabilityRegistry.ts` builds dynamic descriptors for
  configured custom endpoints only when URL, model, credential state, and
  custom capabilities are present.
- `src/screens/SettingsScreen.tsx` exposes custom endpoint base URL and
  capability controls with warnings for remote endpoints.
- `src/types/project.ts` adds editor-only provider fields for `baseUrl` and
  `customCapabilities`.

## Security Boundary

- Empty or malformed base URLs fail closed.
- Remote `http://` base URLs fail closed; `http://` is accepted only for local
  gateway hosts such as `localhost` and `127.0.0.1`.
- Base URLs with username/password are rejected so secrets cannot be hidden in
  URL strings.
- Missing model id, missing capabilities, missing credentials, unsupported
  operations, rate limits, quota errors, and upstream failures are reported as
  structured provider failures.
- Provider error text is redacted before it reaches adapter responses or UI
  feedback.
- Normal validation uses mocked HTTP responses only.

## Validation

TDD RED before implementation:

```powershell
npm test -- --run src/providers/__tests__/customOpenAiCompatibleProviderAdapter.test.ts src/providers/__tests__/modelCapabilityRegistry.test.ts src/screens/__tests__/SettingsScreen.test.tsx
```

Result: FAIL as expected. Vitest could not resolve
`../customOpenAiCompatibleProviderAdapter`; custom gates were unavailable; and
Settings did not expose custom endpoint controls.

Focused GREEN after implementation:

```powershell
npm test -- --run src/providers/__tests__/customOpenAiCompatibleProviderAdapter.test.ts src/providers/__tests__/modelCapabilityRegistry.test.ts src/screens/__tests__/SettingsScreen.test.tsx
```

Result: PASS, 3 files and 22 tests.

Focused provider/settings/security regression:

```powershell
npm test -- --run src/providers/__tests__/customOpenAiCompatibleProviderAdapter.test.ts src/providers/__tests__/kimiProviderAdapter.test.ts src/providers/__tests__/deepSeekProviderAdapter.test.ts src/providers/__tests__/providerRegistry.test.ts src/providers/__tests__/modelCapabilityRegistry.test.ts src/providers/__tests__/mockProviderContract.test.ts src/providers/__tests__/mockProviderAdapter.test.ts src/security/__tests__/redaction.test.ts src/stores/__tests__/providerStore.test.tsx src/screens/__tests__/SettingsScreen.test.tsx src/components/ai/__tests__/ProviderCapabilityGatesPanel.test.tsx
```

Result: PASS, 11 files and 57 tests.

TypeScript:

```powershell
npm run typecheck
```

Result: PASS.

Full canonical gate:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1
```

Result: PASS. Gates passed: frontend typecheck, full Vitest (105 files / 554
tests), frontend build, native C++ configure/build/CTest, Tauri content check,
43 Rust desktop tests, runtime smoke, and editor-runtime screenshot roundtrip.
Known nonfatal warnings remained: Vite chunk-size warning and existing CMake
FetchContent/deprecation warnings.
