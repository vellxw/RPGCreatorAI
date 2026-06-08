# Phase 12 Existing AI Pipeline Inventory

Issue: PX-004 / FRA-438
Date: 2026-06-07

## Scope And Sources

This inventory records the AI/provider/content pipeline that already exists
from Phase 11 so Phase 12 can reuse real boundaries instead of duplicating
infrastructure. It distinguishes implemented local tooling, mock-only normal
validation, optional provider adapters, docs-only guidance, and future work.

Inspected sources include:

- `src/providers/*`
- `src/providers/__tests__/*`
- `src/stores/providerStore.ts`
- `src/stores/aiRequestQueueStore.ts`
- `src/components/ai/*`
- `src/screens/SettingsScreen.tsx`
- `src/screens/AIToolsScreen.tsx`
- `src-tauri/src/credential_commands.rs`
- `src-tauri/src/lib.rs`
- `src/e2e/__tests__/aiContentPipelineIntegration.test.ts`
- Phase 11 provider, mock-contract, request-queue, image-pipeline, and
  content-pipeline docs.

No `.env` file, live credential store value, or app-data secret was read.

## Inventory Summary

| Area | Status | Existing boundary |
| --- | --- | --- |
| Provider registry | Implemented | `providerRegistry.ts` defines provider ids, operations, credential metadata, model metadata, cost/rate-limit metadata, default disabled configs, and local mock provider metadata. |
| Adapter interface | Implemented | `providerAdapter.ts` defines request/response/failure shapes for text, image, vision, code, audio, and video operations. |
| Adapter hub | Implemented | `providerAdapterHub.ts` constructs adapters for OpenAI, Anthropic, Kimi/Moonshot, DeepSeek, MiniMax, OpenCode, custom OpenAI-compatible endpoints, and local mock. |
| Model capability routing | Implemented | `modelCapabilityRegistry.ts` builds workflow capability gates by model capability, not provider name. |
| Cost/rate-limit/budget state | Implemented | `providerCostBudget.ts`, provider metadata, and Settings panels expose free, estimated, unknown, provider-managed, and confirmation-required states. |
| Credential UI/storage | Implemented, desktop-local | Settings opt-in and `credential_commands.rs` support provider credential status/set/delete. Windows storage uses DPAPI blobs under app config; non-Windows reports unavailable. |
| AI request queue | Implemented infrastructure | `aiRequestQueueStore.ts` tracks bounded jobs, retries, cancellation, restart recovery, idempotency keys, write intents, cost, rate-limit, and budget confirmation. It does not execute providers. |
| Mock provider contracts | Implemented and required for normal validation | `mockProviderContract.ts`, `mockProviderAdapter.ts`, and normalization tests provide deterministic success, image success, malformed, provider-error, rate-limit, quota, timeout, and cancellation fixtures. |
| Remote provider adapters | Implemented editor-side adapters, not normal validation | OpenAI, Anthropic, Kimi/Moonshot, DeepSeek, MiniMax, and custom OpenAI-compatible adapters use injected `fetch` and credential resolvers; tests mock HTTP and verify fail-closed behavior. |
| OpenCode adapter | Implemented handoff-only | `openCodeWorkflowAdapter.ts` prepares controlled code-assist handoff data, validates repo-local cwd, denies direct mutation/execution, and does not run external tools. |
| Content workflows | Implemented mock-backed authoring helpers | Map drafts, quests, event commands, database drafts, balancing, validation repair, generation history, save/reload, validation, and playtest planning are covered by the CP-088 integration test. |
| Image workflows | Implemented mock-backed review gates | Tilesets, item/equipment icons, portraits, character concepts, image edit/variation, sprite sheets, prompt templates, and visual QA create pending candidates with provenance. |
| AI Tools screen | Implemented as status/navigation framing | `AIToolsScreen.tsx` explains optional tooling, review gates, provider setup, history, and safety boundaries. It is not a command router yet. |
| Native runtime | Provider-independent | The C++ runtime consumes accepted local project data and assets only. Tauri exposes local shell/fs/runtime/config/credential commands, but no AI provider execution command. |

## Implemented Local Tooling

The Phase 11 provider layer is real editor infrastructure:

- `ProviderAdapter` supports shared operation ids and structured failures:
  missing credentials, rate limit, quota exceeded, budget exceeded, timeout,
  unsupported operation, provider error, and cancellation.
- `defaultProviderRegistry` includes OpenAI, Anthropic, Kimi/Moonshot,
  DeepSeek, MiniMax, OpenCode, custom OpenAI-compatible endpoint, and local
  gateway metadata.
- Provider configs start disabled. Credentialed providers start
  missing-credential-safe; local and OpenCode have no credential requirement.
- Capability gates are computed from model descriptors. Current workflow gate
  ids include text draft, structured JSON, image generation, image edit,
  animation draft, and code/tooling.
- The Settings screen owns opt-in disclosure, model/base URL inputs, custom
  endpoint capability toggles, image settings, credential save/delete, cost and
  budget panels, capability gates, and the AI request queue.
- Generation history stores redacted prompts, input context, output summaries,
  cost/failure metadata, review state, accepted output links, and acceptance
  events in project metadata.

## Mock-Only Normal Validation

Normal validation uses local fixtures rather than paid providers:

- The local provider supports deterministic `text.generate`,
  `image.generate`, and `image.edit` fixture responses.
- Mock contract fixtures cover success, image success, malformed response,
  provider error, rate-limit, quota exceeded, timeout, and cancellation.
- Provider request serialization redacts secret-looking fields.
- Workflow tests assert generated requests do not contain API keys, live API
  URLs, or `sk-` looking secrets.
- The CP-088 content pipeline test composes generated content through the same
  reducers, project validation, save/reload, and playtest planning used by
  normal editor flows.

## Optional Provider Adapters

Remote provider adapters exist as optional editor-side modules, but they are
not part of normal validation and are not runtime dependencies.

| Provider | Implemented operations | Validation boundary |
| --- | --- | --- |
| OpenAI | `text.generate`, `image.generate`, `image.edit`, `vision.analyze` | Mocked `fetch`; missing credentials fail before HTTP; no live API call in normal tests. |
| Anthropic Claude | `text.generate`, `code.assist` | Mocked `fetch`; credential-gated; structured errors redacted. |
| Kimi/Moonshot | `text.generate`, `code.assist` | OpenAI-compatible chat adapter; mocked `fetch`; configurable base URL. |
| DeepSeek | `text.generate`, `code.assist` | OpenAI-compatible chat adapter; mocked `fetch`; configurable base URL. |
| MiniMax | `text.generate`, `image.generate` | Mocked `fetch`; supports text and image response normalization. Audio/video remain documented provider capabilities, not app-supported operations. |
| Custom OpenAI-compatible | User-configured text/code capabilities | Requires valid base URL, model id, and capability config before delegation. |
| OpenCode | `code.assist` handoff | Prepares non-mutating handoff metadata only; direct execution is rejected. |

## Content And Asset Workflows

Implemented workflow modules are review-gated and data-driven:

- `mapDraftGenerationWorkflow.ts`: builds and validates generated map drafts,
  including map dimensions, layers, tilesets, and complete event objects.
- `questGenerationWorkflow.ts`: builds and validates draft quest records before
  database insertion.
- `eventCommandGenerationWorkflow.ts`: builds and validates candidate event
  command lists against project context.
- `dbDraftGenerationWorkflow.ts`: supports actor, enemy, and item draft
  generation with type-specific validation and approval.
- `balancingAssistantWorkflow.ts`: proposes actor/enemy/item adjustment sets
  and applies only reviewed changes through normal reducers.
- `validationRepairWorkflow.ts`: generates reviewed repair suggestions without
  mutating project data automatically.
- `tilesetGenerationWorkflow.ts`, `itemIconGenerationWorkflow.ts`,
  `portraitGenerationWorkflow.ts`, `characterConceptGenerationWorkflow.ts`,
  `imageEditVariationWorkflow.ts`, and `spriteSheetGenerationWorkflow.ts`
  create pending generated asset candidates with mock refs, prompt provenance,
  QA previews, and explicit approval functions.
- `generatedImageVisualQa.ts` and `generatedAnimationQa.ts` add review/QA
  metadata and block rejected animation assets from selection.

## Docs-Only Or Future Boundaries

The following are intentionally not complete product execution paths yet:

- A unified AI Studio command router does not exist. AI capabilities currently
  live in Settings, feature-specific editors, provider modules, and tests.
- The AI request queue does not execute provider calls by itself.
- Normal mock image workflows return `mock://generated/...` refs and metadata;
  they do not write live generated image bytes to disk.
- Live provider diagnostics remain opt-in only and require explicit user
  credentials, provider-specific disclosures, and separate validation evidence.
- The native runtime remains independent of AI, network, provider credentials,
  cloud services, and live APIs.
- Project JSON can store redacted generation history and accepted generated
  asset metadata, but must not store provider credential values.

## Reusable Boundaries For Phase 12

Phase 12 AI Studio and command routing should reuse these existing seams:

- Use `ProviderAdapter` and `ProviderAdapterHub` for provider dispatch.
- Use `modelCapabilityRegistry.ts` for routing by capability.
- Use `providerStore.ts` and credential status for opt-in readiness.
- Use `aiRequestQueueStore.ts` for queued/running/cancel/retry/cost/rate-limit
  presentation, but add execution separately only when a specific issue
  requires it.
- Use existing workflow build/validate/approve functions instead of generating
  project mutations directly.
- Use `generationHistory.ts` for redacted audit trails and accepted output
  links.
- Keep normal validation on mock fixtures and mocked HTTP adapters.

## Safe Validation Commands

Safe offline commands for Phase 12 AI/provider work:

```powershell
npm run typecheck
npm test -- --run src/providers/__tests__/providerAdapterHub.test.ts src/providers/__tests__/mockProviderContract.test.ts src/providers/__tests__/mockProviderAdapter.test.ts src/providers/__tests__/providerRegistry.test.ts src/providers/__tests__/modelCapabilityRegistry.test.ts src/providers/__tests__/providerCostBudget.test.ts src/stores/__tests__/providerStore.test.tsx src/stores/__tests__/aiRequestQueueStore.test.ts src/components/ai/__tests__/AIRequestQueuePanel.test.tsx src/components/ai/__tests__/ProviderCapabilityGatesPanel.test.tsx src/components/ai/__tests__/ProviderCostBudgetPanel.test.tsx
npm test -- --run src/e2e/__tests__/aiContentPipelineIntegration.test.ts src/providers/__tests__/gptImageAssetPipelineIntegration.test.ts
npm test -- --run src/providers/__tests__/openAiProviderAdapter.test.ts src/providers/__tests__/anthropicProviderAdapter.test.ts src/providers/__tests__/kimiProviderAdapter.test.ts src/providers/__tests__/deepSeekProviderAdapter.test.ts src/providers/__tests__/miniMaxProviderAdapter.test.ts src/providers/__tests__/customOpenAiCompatibleProviderAdapter.test.ts src/providers/__tests__/openCodeWorkflowAdapter.test.ts
```

Do not treat any of these as live provider diagnostics. They are offline tests
using local fixtures or mocked HTTP.

## Inventory Result

Phase 11 already delivered a substantial editor-side AI foundation: provider
metadata, adapters, capability routing, cost/rate-limit visibility, credential
storage boundaries, queue state, mock contracts, content workflows, image
workflows, generation history, and integration tests. Phase 12 should build on
that foundation by improving command routing, UX clarity, and optional
provider execution surfaces only when the relevant issue requires them.
