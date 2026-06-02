# Phase 11 Model Capability Registry

CP-061 / FRA-96 adds editor-side model capability data and workflow gates. The
registry does not call providers, read credentials, generate assets, mutate
project JSON, or affect the native runtime.

## Capability Data

`src/providers/modelCapabilityRegistry.ts` defines:

- model capability flags:
  `text`, `structured-json`, `image`, `image-edit`, `vision`, `audio`,
  `video`, `code`, and `tool`
- model limits such as file types, max images, streaming support, context
  window hints, and max output hints
- workflow definitions for text draft, structured JSON, image generation,
  image edit, animation draft, and code/tooling gates
- helpers to find model descriptors and resolve workflow availability

The default registry includes:

- OpenAI `gpt-image-2` image, image-edit, and vision capability metadata added
  by CP-065.
- Local `offline-mock` text fixture metadata.
- Local `offline-image-mock` image fixture metadata.

Unknown real-provider model ids remain unavailable until explicit capability
data exists. This keeps provider/model behavior data-driven and avoids making
current vendor model ids required product defaults.

## UI Gating

Settings now includes a read-only `Capability Gates` panel. The panel computes
availability from configured provider state plus model capability descriptors.
It never branches on provider names and does not expose generate, connect, or
test-provider actions.

Future generation screens can use the same gate data to decide whether an
action should be enabled, disabled, or routed to a different configured model.

## Validation

Focused tests cover:

- offline mock model capability descriptors and limits
- GPT Image 2 and offline image fixture capability descriptors and limits
- unknown real-provider model ids staying unavailable
- data-driven workflow gates with injected custom model descriptors
- read-only Settings gate UI for ready and unavailable states
- existing Settings/provider placeholder gating regressions

No live OpenAI, Claude, Kimi/Moonshot, DeepSeek, MiniMax, custom endpoint, or
other paid provider call was made.
