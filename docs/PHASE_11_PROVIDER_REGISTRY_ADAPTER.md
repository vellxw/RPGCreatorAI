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
- model-list policy; CP-061 adds model capability descriptors and workflow
  gates on top of this provider-level metadata
- optional base URL metadata for OpenAI-compatible providers

Real provider model ids are not required product defaults. Most real providers
use `modelSelection: user-selected`; CP-061 stores model capability data
separately so capabilities can change without rewriting provider screens. The
local mock provider has a fixture model descriptor so contract tests can
validate the adapter shape offline.

## Adapter Contract

`src/providers/providerAdapter.ts` defines a generic adapter interface:

- `discoverCapabilities()`
- `listModels()`
- `execute(request, options)`

Requests carry an id, provider id, operation id, created timestamp, optional
model id, prompt, and structured input. Responses use one shared shape for
`succeeded`, `failed`, and `cancelled` outcomes, with optional output and usage
metadata.

## Mock Adapter

`src/providers/mockProviderAdapter.ts` is the first implementation. It is
deterministic, local, and fixture-only:

- lists the local mock model
- supports `text.generate`
- returns deterministic text and usage metadata
- returns structured cancellation when an `AbortSignal` is already aborted
- returns structured failure for unsupported operations

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

No live OpenAI, Claude, Kimi/Moonshot, DeepSeek, MiniMax, custom endpoint, or
other paid provider call was made.
