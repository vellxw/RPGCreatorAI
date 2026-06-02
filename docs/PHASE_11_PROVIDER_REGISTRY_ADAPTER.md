# Phase 11 Provider Registry And Adapter Interface

CP-060 / FRA-95 defines the editor-side provider registry and adapter contract
used by future AI integrations. It adds no live provider call, network
dependency, credential read, project mutation, or native runtime dependency.

## Registry

`src/providers/providerRegistry.ts` defines:

- provider ids and display names
- adapter kind (`official-api`, `openai-compatible`, `external-tool`,
  `mock-local`)
- credential requirements and environment variable labels
- supported operation ids:
  `text.generate`, `image.generate`, `image.edit`, `vision.analyze`,
  `code.assist`, `audio.generate`, and `video.generate`
- cost availability, paid-work confirmation policy, and provider-managed
  rate-limit/quota recovery guidance added by CP-062
- model-list policy; CP-061 adds model capability descriptors and workflow
  gates on top of this provider-level metadata
- optional base URL metadata for OpenAI-compatible providers

Real provider model ids are not required product defaults. Most real providers
use `modelSelection: user-selected`; CP-061 stores model capability data
separately so capabilities can change without rewriting provider screens.
CP-065 records the current OpenAI image model option `gpt-image-2` as
configurable metadata without pre-filling provider configs. The local mock
provider has separate text and image fixture model descriptors so contract
tests can validate adapter shapes offline.

## Adapter Contract

`src/providers/providerAdapter.ts` defines a generic adapter interface:

- `discoverCapabilities()`
- `listModels()`
- `execute(request, options)`

Requests carry an id, provider id, operation id, created timestamp, optional
model id, prompt, and structured input. Responses use one shared shape for
`succeeded`, `failed`, and `cancelled` outcomes, with optional output and usage
metadata. CP-062 adds optional structured failure metadata so rate-limit,
quota, budget, unsupported-operation, provider-error, and cancellation states
can carry retry guidance without parsing display copy.

## Mock Adapter

`src/providers/mockProviderAdapter.ts` is the first implementation. It is
deterministic, local, and fixture-only:

- lists the local mock text and image models
- supports `text.generate` and deterministic offline `image.generate` fixtures
- returns deterministic text and usage metadata
- returns deterministic mock image asset refs and image usage metadata for
  `offline-image-mock`
- returns structured cancellation when an `AbortSignal` is already aborted
- returns structured failure for unsupported operations
- returns deterministic fixture failures for rate-limit and quota states
- CP-063 adds the offline contract fixture runner and response normalization
  helpers for success, malformed, provider-error, rate-limit, timeout, and
  cancellation cases

## Settings Boundary

`src/stores/providerStore.ts` now derives `defaultProviderConfigs` from the
registry. This keeps Settings provider rows aligned with the registry while
preserving the CP-057/CP-058 rules: providers start disabled, model strings
are empty, no `apiKey` field exists, and credentials remain outside project
data.

## Validation

Normal validation uses TypeScript contract tests only:

- registry metadata and operation id coverage
- registry-derived Settings provider defaults
- mock provider capability/model discovery
- deterministic text response shape
- cancellation response shape
- unsupported operation failure shape
- CP-063 offline contract fixtures, deterministic request serialization,
  response normalization, and disabled/missing-credential readiness states

No live OpenAI, Claude, Kimi/Moonshot, DeepSeek, MiniMax, custom endpoint, or
other paid provider call was made.

CP-064 ran the AI Provider Hub foundation gate across provider Settings,
credentials, queue, registry, capabilities, cost/rate-limit states, offline
contract fixtures, zero-provider browser smoke, provider/runtime dependency
scans, and the canonical `scripts/dev/verify.ps1` gate. Evidence is recorded
in `docs/PHASE_11_AI_PROVIDER_HUB_FOUNDATION_GATE.md`.
