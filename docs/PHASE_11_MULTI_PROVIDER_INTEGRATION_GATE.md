# Phase 11 Multi-Provider Integration Gate

Issue: CP-096 / FRA-131
Date: 2026-06-04

## Result

The provider layer now has a shared adapter hub that constructs every provider
adapter from the registry surface and validates them through one offline test
suite. The gate covers OpenAI, Anthropic Claude, Kimi/Moonshot, DeepSeek,
MiniMax, OpenCode, custom OpenAI-compatible endpoints, and the local mock
provider.

Normal validation remains offline. Live provider diagnostics are separate and
must require explicit user opt-in, configured credentials, and provider-specific
budget controls.

## Audit Finding

Linear had marked CP-096 Done with a closeout that cited commit `a95e4cf` and
described provider registry metadata plus mock contracts. Repo inspection found
that CP-089 through CP-095 had only partial metadata at that point, and there
was no single provider hub that could instantiate all real adapters uniformly.

## Code Changes

- `src/providers/providerAdapterHub.ts` creates the shared adapter surface for
  every registry provider id.
- `src/providers/__tests__/providerAdapterHub.test.ts` verifies all provider ids
  have adapters, disabled providers do not route workflow gates, credentialed
  adapters fail closed without calling HTTP, and local/OpenCode remain offline
  and non-mutating.
- The gate uses the remediated adapters from CP-089 through CP-095:
  OpenAI, Claude, Kimi, DeepSeek, MiniMax, OpenCode, and custom endpoints.

## Security Boundary

- Hub tests inject credential resolvers and fetch functions; no live HTTP
  requests are made.
- Credentialed providers with missing credentials fail before fetch is called.
- Disabled providers remain disabled in provider configs, mock contract
  readiness, and capability gates.
- Local mock workflows stay deterministic and offline.
- OpenCode hub execution prepares a handoff only and reports
  `mutationAllowed: false`.
- Provider configs and serialized contract fixtures are checked for secret-like
  fields.

## Validation

TDD RED before implementation:

```powershell
npm test -- --run src/providers/__tests__/providerAdapterHub.test.ts
```

Result: FAIL as expected. Vitest could not resolve `../providerAdapterHub`
because the shared hub module did not exist.

Focused GREEN after implementation:

```powershell
npm test -- --run src/providers/__tests__/providerAdapterHub.test.ts
```

Result: PASS, 1 file and 4 tests.

Focused multi-provider regression:

```powershell
npm test -- --run src/providers/__tests__/providerAdapterHub.test.ts src/providers/__tests__/openAiProviderAdapter.test.ts src/providers/__tests__/anthropicProviderAdapter.test.ts src/providers/__tests__/kimiProviderAdapter.test.ts src/providers/__tests__/deepSeekProviderAdapter.test.ts src/providers/__tests__/miniMaxProviderAdapter.test.ts src/providers/__tests__/openCodeWorkflowAdapter.test.ts src/providers/__tests__/customOpenAiCompatibleProviderAdapter.test.ts src/providers/__tests__/providerRegistry.test.ts src/providers/__tests__/modelCapabilityRegistry.test.ts src/providers/__tests__/mockProviderContract.test.ts src/providers/__tests__/mockProviderAdapter.test.ts src/security/__tests__/redaction.test.ts src/stores/__tests__/providerStore.test.tsx src/screens/__tests__/SettingsScreen.test.tsx src/components/ai/__tests__/ProviderCapabilityGatesPanel.test.tsx
```

Result: PASS, 16 files and 83 tests.

TypeScript:

```powershell
npm run typecheck
```

Result: PASS.

Full canonical gate:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1
```

Result: PASS. Gates passed: frontend typecheck, full Vitest (106 files / 558
tests), frontend build, native C++ configure/build/CTest, Tauri content check,
43 Rust desktop tests, runtime smoke, and editor-runtime screenshot roundtrip.
Known nonfatal warnings remained: Vite chunk-size warning and existing CMake
FetchContent/deprecation warnings.
