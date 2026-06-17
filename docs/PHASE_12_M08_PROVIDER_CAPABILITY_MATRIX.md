# Phase 12 M08 Provider Capability Matrix

Issue: PX-166..PX-185 / FRA-443 (M08 Generated Asset and Animation Research)
Date: 2026-06-08

## Scope

This matrix records the capabilities actually declared by the provider
adapters and registries in the repo, not marketing claims. Every cell cites
the file that determines the capability declaration. Capabilities that the
repo does not currently declare are marked clearly.

This matrix is consumed by M04 (creator-first provider UX), M09 (animation
QA), M10 (multi-round refinement), and M11 (sprite sheet and animation
pipeline). It must be re-checked whenever a provider registry entry, model
capability descriptor, or adapter is added or changed.

## Source Files

The matrix is derived from the following files (no live provider calls were
made to produce it):

- `src/providers/providerRegistry.ts` — provider metadata, default models,
  operations, cost/rate-limit declarations.
- `src/providers/modelCapabilityRegistry.ts` — per-model capabilities, limits,
  workflow definitions, and capability gates.
- `src/providers/openAiProviderAdapter.ts` — OpenAI adapter (Responses API,
  Images API).
- `src/providers/anthropicProviderAdapter.ts` — Anthropic Claude adapter
  (Messages API only).
- `src/providers/kimiProviderAdapter.ts` and
  `src/providers/openAiCompatibleProviderAdapter.ts` — Kimi/Moonshot
  OpenAI-compatible chat completions adapter.
- `src/providers/deepSeekProviderAdapter.ts` — DeepSeek OpenAI-compatible
  adapter.
- `src/providers/miniMaxProviderAdapter.ts` — MiniMax chat completions +
  image_generation adapter.
- `src/providers/openCodeWorkflowAdapter.ts` — OpenCode controlled handoff
  adapter.
- `src/providers/mockProviderAdapter.ts` — offline mock provider contract.
- `src/providers/imagePromptTemplates.ts` — prompt template kinds.

## Capability Columns

| Column | Meaning |
| --- | --- |
| text-draft | Can produce free-form narrative copy, quest drafts, dialogue, etc. Maps to `text.generate`. |
| structured-json | Can produce JSON-shaped output for downstream parsers. Maps to the `structured-json` capability flag and the `output_config` / `response_format=json_object` paths in the adapters. |
| code-tooling | Can produce code-edit suggestions or controlled handoffs to a code tool. Maps to `code.assist`. |
| image-generate | Can generate an image asset from a prompt. Maps to `image.generate`. |
| image-edit | Can edit or vary an existing image asset. Maps to `image.edit`. |
| animation-strip | Can produce a single horizontal sprite-sheet strip suitable for animation normalization. The repo defines this as an `image.generate` candidate that is then run through `normalize_animation_strip.py`; no provider declares a dedicated animation operation. |
| sprite-sheet | Same as animation-strip in this repo: a sprite sheet is a sprite-sheet template (`character-spritesheet-v1`) rendered into an `image.generate` request. No provider declares a dedicated sprite-sheet operation. |
| long-context | Declared context window >= 200,000 tokens in `modelCapabilityRegistry.ts`. |
| offline-mock | Provider does not make any network call; uses fixture responses only. |

Legend: **yes** = declared and routed, **partial** = capability exists with
limits/conditions (see notes), **unsupported** = operation not declared by the
provider metadata, **no** = capability not declared at all.

## Provider Capability Matrix

| Provider | text-draft | structured-json | code-tooling | image-generate | image-edit | animation-strip | sprite-sheet | long-context | offline-mock | Source-of-truth file |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OpenAI (`openai`, gpt-5.5 + gpt-image-2) | yes | yes (gpt-5.5, capability `structured-json`) | no (not declared) | yes (gpt-image-2) | yes (gpt-image-2) | partial (uses `image.generate`; horizontal-strip layout comes from prompt template + normalization) | partial (uses `image.generate` + `character-spritesheet-v1` template) | yes (gpt-5.5: 1,050,000 context) | no | `src/providers/providerRegistry.ts`, `src/providers/modelCapabilityRegistry.ts`, `src/providers/openAiProviderAdapter.ts` |
| Anthropic (`anthropic`, claude-opus-4-8 / sonnet-4-6 / haiku-4-5) | yes | yes (capability `structured-json` on all three Claude models) | yes (capability `code`) | unsupported (no `image.generate` operation in metadata; no image endpoint in adapter) | unsupported (no `image.edit` operation in metadata) | unsupported (no image route; would require a separate image provider) | unsupported (no image route) | yes (Opus/Sonnet: 1,000,000; Haiku: 200,000) | no | `src/providers/providerRegistry.ts`, `src/providers/modelCapabilityRegistry.ts`, `src/providers/anthropicProviderAdapter.ts` |
| DeepSeek (`deepseek`, v4-flash / v4-pro / chat / reasoner) | yes | yes (capability `structured-json` on all four models) | yes (capability `code` on all four models) | unsupported (no image operation in metadata) | unsupported (no image operation in metadata) | unsupported | unsupported | no (no context window declared in `modelCapabilityRegistry.ts`) | no | `src/providers/providerRegistry.ts`, `src/providers/modelCapabilityRegistry.ts`, `src/providers/deepSeekProviderAdapter.ts` |
| Kimi / Moonshot (`moonshot`, kimi-k2.6 / k2.5 / moonshot-v1-128k / 32k / 8k) | yes | yes (capability `structured-json` on all five models) | yes (capability `code` on kimi-k2.5 and kimi-k2.6; not on moonshot-v1-*) | unsupported (no image operation in metadata) | unsupported (no image operation in metadata) | unsupported | unsupported | yes (kimi-k2.5/2.6: 256,000; moonshot-v1-128k: 128,000) | no | `src/providers/providerRegistry.ts`, `src/providers/modelCapabilityRegistry.ts`, `src/providers/kimiProviderAdapter.ts` |
| MiniMax (`minimax`, M3 / M2.7 / M2.7-highspeed + image-01) | yes | yes (capability `structured-json` on M3, M2.7, M2.7-highspeed; uses `response_format: { type: 'json_object' }`) | no (not declared in model capabilities) | yes (image-01, capability `image`, `outputFileTypes: image/jpeg`) | unsupported (no `image.edit` operation; not declared in metadata) | partial (uses `image.generate`; no native animation; relies on local `normalize_animation_strip.py`) | partial (uses `image.generate`; no native sprite-sheet operation) | yes (M3: 1,000,000; M2.7 family: 204,800) | no | `src/providers/providerRegistry.ts`, `src/providers/modelCapabilityRegistry.ts`, `src/providers/miniMaxProviderAdapter.ts` |
| opencode workflow adapter (`opencode`, `opencode-workflow`) | no (not declared) | no (not declared) | yes (`code.assist`; prepares controlled handoff, does not execute) | unsupported | unsupported | unsupported | unsupported | no (no context window declared) | yes (no network call; handoff-only) | `src/providers/providerRegistry.ts`, `src/providers/modelCapabilityRegistry.ts`, `src/providers/openCodeWorkflowAdapter.ts` |
| Local mock provider (`local`, offline-mock / offline-image-mock / offline-image-edit-mock) | yes (offline-mock) | no (not declared as a capability) | no (not declared) | yes (offline-image-mock, capability `image`, PNG-only fixture) | yes (offline-image-edit-mock, capability `image-edit`, PNG-only fixture) | yes (offline-image-mock produces a single-image fixture consumed by `normalize_animation_strip.py`) | yes (offline-image-mock + `character-spritesheet-v1` template) | no (offline-mock context window is 4,000) | yes (no network call, fixture-driven) | `src/providers/providerRegistry.ts`, `src/providers/modelCapabilityRegistry.ts`, `src/providers/mockProviderAdapter.ts`, `src/providers/mockProviderContract.ts` |

## Prompt Template Kind Coverage

The eight prompt template kinds in `src/providers/imagePromptTemplates.ts`
are:

| Kind | Template id | Required operation | Notes |
| --- | --- | --- | --- |
| tileset | `tileset-rpg-map-v1` | `image.generate` | Tile family; size and palette from inputs. |
| icon | `icon-item-v1` | `image.generate` | Inventory icon, small-canvas. |
| portrait | `portrait-character-v1` | `image.generate` | Dialogue portrait. |
| concept | `character-concept-v1` | `image.generate` | Full-body character concept. |
| spritesheet | `character-spritesheet-v1` | `image.generate` | Horizontal strip; runtime normalization. |
| edit | `asset-edit-v1` | `image.edit` | Edit/variation of an existing asset. |
| ui-panel | `ui-panel-v1` | `image.generate` | Runtime UI panel. |
| reference | `reference-board-v1` | `image.generate` | Internal mood/visual reference board. |

All eight kinds route through `image.generate` or `image.edit` operations;
they do not introduce separate provider operations. The legal/safety
constraints and the "in the style of X" scrubber live inside the template
renderer and apply to every kind (`sanitizePromptInput` in
`src/providers/imagePromptTemplates.ts`).

| Template kind | OpenAI (gpt-image-2) | Anthropic | DeepSeek | Kimi / Moonshot | MiniMax (image-01) | opencode workflow | local mock |
| --- | --- | --- | --- | --- | --- | --- | --- |
| tileset | yes | unsupported | unsupported | unsupported | yes | unsupported | yes (offline-image-mock) |
| icon | yes | unsupported | unsupported | unsupported | yes | unsupported | yes (offline-image-mock) |
| portrait | yes | unsupported | unsupported | unsupported | yes | unsupported | yes (offline-image-mock) |
| concept | yes | unsupported | unsupported | unsupported | yes | unsupported | yes (offline-image-mock) |
| spritesheet | yes | unsupported | unsupported | unsupported | yes (relies on local strip normalization) | unsupported | yes (offline-image-mock) |
| edit | yes (gpt-image-2 supports `image.edit`) | unsupported | unsupported | unsupported | unsupported (no `image.edit` in MiniMax adapter) | unsupported | yes (offline-image-edit-mock) |
| ui-panel | yes | unsupported | unsupported | unsupported | yes | unsupported | yes (offline-image-mock) |
| reference | yes | unsupported | unsupported | unsupported | yes | unsupported | yes (offline-image-mock) |

## Notes And Honest Gaps

- **No provider currently declares an `image.edit` operation in MiniMax
  metadata.** MiniMax's adapter only routes `text.generate` and
  `image.generate`. The `edit` template kind has no live provider fallback
  beyond OpenAI and the local mock.
- **No provider declares a `video.generate` or native animation operation.**
  `providerWorkflowDefinitions` in `modelCapabilityRegistry.ts` lists
  `animation-draft` as requiring capability `video`. No registered descriptor
  declares that capability. The current animation pipeline therefore relies
  on `image.generate` for sprite sheets + the local Python
  `normalize_animation_strip.py` and `generate_animation_preview.py` scripts,
  not on provider-side animation. The `animation-strip` and `sprite-sheet`
  cells above mean "image.generate works, local scripts handle the rest,"
  not "the provider natively produces animation."
- **The `local` mock's `text.generate` model (`offline-mock`) does not declare
  `structured-json` or `code`.** It produces a single sentence of fixture
  text. It is suitable for first-run and offline validation only.
- **OpenAI declares no `code` capability on gpt-5.5** even though the model
  can be used with tool calling in general. The repo intentionally routes
  `code.assist` to Anthropic, DeepSeek, Kimi, and the opencode handoff
  adapter; OpenAI is not declared as a code route.
- **Cost, retention, and rate limits are intentionally not pinned in the
  registry.** They are treated as configurable metadata. See
  `docs/PHASE_12_M08_LEGAL_COST_NOTES.md` for the honest position.
- **`offline-mock` is the only provider that is genuinely offline.** The
  opencode adapter is handoff-only and does not call external tools itself,
  but it is not the same as the local mock; it still requires an external
  OpenCode CLI execution path to actually do work.

## Cross-References

- `docs/PHASE_12_RISK_REGISTER.md` — risks P12-R007, P12-R011, P12-R023
  require this matrix to be kept current and sourced.
- `docs/PHASE_11_PROVIDER_LEGAL_BASELINE.md` — provider API/data sources
  list and no-live-call default.
- `docs/PHASE_11_COST_RATE_LIMIT_BUDGET_STATES.md` — how unknown cost and
  budget confirmation are handled in the queue.
- `docs/PHASE_12_CREATOR_FIRST_AI_UX_PRINCIPLES.md` — how the matrix maps
  onto the five creator-facing modes.
- `src/providers/providerMode.ts` — the resolution tables that pick a
  default provider/model for each workflow from this matrix.
