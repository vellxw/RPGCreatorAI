# Phase 12 M08 Legal And Cost Notes

Issue: PX-166..PX-185 / FRA-443 (M08 Generated Asset and Animation Research)
Date: 2026-06-08

## Scope And Method

This document records the legal and cost position for each provider the
repo can route to. It is intentionally brief. The provider registry in
`src/providers/providerRegistry.ts` stores only configurable, repo-local
metadata (provider id, model id, operations, cost availability, rate-limit
status). Exact vendor pricing, retention windows, and policy wording change
frequently; this document does not invent specific numbers and points to the
provider's own documentation as the source of truth.

No live provider calls were made for this research. No credentials were
created, used, stored, or requested. Provider metadata, adapter code, and
open official documentation were the only sources reviewed.

This document must be re-checked whenever a new provider is added or any
provider's terms change materially. See `docs/PHASE_12_RISK_REGISTER.md`
risks P12-R011 and P12-R023.

## How The Repo Stores Cost And Legal Metadata

- `src/providers/providerRegistry.ts` stores per-provider
  `ProviderCostMetadata` and `ProviderRateLimitMetadata`. Paid providers are
  marked `estimateAvailability: 'unknown'`, `paidOperations: true`,
  `confirmationPolicy: 'confirm-paid-session'`. The local mock is marked
  `estimateAvailability: 'free'`, `paidOperations: false`,
  `confirmationPolicy: 'none'`. Exact dollar values are intentionally not
  hardcoded.
- `src/providers/providerCostBudget.ts` exposes
  `buildProviderCostBudgetStates`, which derives a per-provider
  `ProviderCostBudgetState` (cost, rate limit, budget) for the Settings
  panel. The state is read-only and never enqueues work by itself.
- `src/providers/providerImageGenerationSettings.ts` exposes
  `imageGenerationReadiness`, which gates a provider/model pair to `ready`
  only when the model descriptor declares the `image` capability. The
  generator action must be `disabled`, `missing-credentials`,
  `missing-model`, `unsupported-model`, or `ready`; only `ready` produces
  candidates.
- `src/providers/imagePromptTemplates.ts` carries per-template
  `legalConstraints` arrays and a `sanitizePromptInput` scrubber that
  removes "in the style of", "style of", "copy", "clone", "copyrighted",
  and "trademarked" tokens before prompt construction. The scrubber is
  the only "in the style of X" mitigation currently shipped.

## Per-Provider Notes

The notes below cite the official provider documentation as
source-of-truth references. Where a number is not stable or not yet
re-verified, the cell says "see provider pricing page" or "unknown" rather
than guessing.

### OpenAI

- API and docs: see `docs/PHASE_11_PROVIDER_LEGAL_BASELINE.md` (OpenAI
  authentication, image generation, data controls links).
- Data retention and usage policy: see the OpenAI "Default usage policies
  by endpoint" doc linked in the legal baseline. The repo does not assert
  any specific retention window.
- Image API content restrictions: see the OpenAI image generation guide
  linked in the legal baseline. The repo does not assert any specific list.
- Token/image pricing reference: see the OpenAI pricing page. The repo
  does not store a per-image price; cost is intentionally `unknown` in
  `providerRegistry.ts`.
- Repo guardrails: `openai` is marked `paidOperations: true`,
  `confirmationPolicy: 'confirm-paid-session'`, so any queue enqueue that
  targets a paid image model must pass the per-session confirmation gate
  defined in `docs/PHASE_11_COST_RATE_LIMIT_BUDGET_STATES.md`.
  `imageGenerationReadiness` will also refuse to mark a configured
  OpenAI provider as `ready` unless the selected model declares the
  `image` capability in `modelCapabilityRegistry.ts`.

### Anthropic Claude

- API and docs: see the Anthropic authentication, rate limits, and Claude
  Code data usage links in `docs/PHASE_11_PROVIDER_LEGAL_BASELINE.md`.
- Data usage and retention: see Anthropic's data usage docs linked there.
  The repo does not assert any specific retention window.
- Token pricing reference: see the Anthropic pricing page.
- Repo guardrails: `anthropic` is marked `paidOperations: true`,
  `confirmationPolicy: 'confirm-paid-session'`. The adapter does not
  implement image generation or image edit; only `text.generate` and
  `code.assist` are routed. `imageGenerationReadiness` therefore cannot
  mark an Anthropic provider as `ready` for image work.

### DeepSeek

- API and docs: see the DeepSeek API docs and terms of service links in
  `docs/PHASE_11_PROVIDER_LEGAL_BASELINE.md`.
- Data usage and retention: see DeepSeek's terms of service linked there.
  The repo does not assert any specific retention window.
- Token pricing reference: see the DeepSeek pricing page. The repo's
  `modelCapabilityRegistry.ts` does not declare a context window for
  DeepSeek models; this is a known gap (see also P12-R007).
- Repo guardrails: `deepseek` is marked `paidOperations: true`,
  `confirmationPolicy: 'confirm-paid-session'`. No image operation is
  routed through DeepSeek.

### Kimi / Moonshot

- API and docs: see the Kimi API overview and OpenPlatform terms of
  service links in `docs/PHASE_11_PROVIDER_LEGAL_BASELINE.md`.
- Data usage and retention: see Kimi's terms linked there. The repo does
  not assert any specific retention window.
- Token pricing reference: see the Kimi/Moonshot pricing page.
- Repo guardrails: `moonshot` is marked `paidOperations: true`,
  `confirmationPolicy: 'confirm-paid-session'`. No image operation is
  routed through Kimi.

### MiniMax

- API and docs: see the MiniMax quickstart, tool configuration, and text
  generation API reference links in
  `docs/PHASE_11_PROVIDER_LEGAL_BASELINE.md`.
- Data usage and retention: see the MiniMax terms linked there. The repo
  does not assert any specific retention window.
- Token/image pricing reference: see the MiniMax pricing page. The repo's
  `providerRegistry.ts` intentionally does not store a per-image or
  per-1k-token number.
- Repo guardrails: `minimax` is marked `paidOperations: true`,
  `confirmationPolicy: 'confirm-paid-session'`. The MiniMax adapter only
  supports `text.generate` and `image.generate`; there is no `image.edit`
  path. `imageGenerationReadiness` will mark MiniMax as `ready` only when
  the selected model declares the `image` capability (e.g. `image-01`).

### opencode workflow adapter

- API and docs: see the OpenCode provider docs link in
  `docs/PHASE_11_PROVIDER_LEGAL_BASELINE.md`.
- Legal position: the adapter does not call any external tool. It prepares
  a controlled handoff (a non-destructive prompt preview, a permission
  manifest, and a `requiresExplicitExecution: true` flag) and returns.
  All execution happens outside the adapter through an explicit user/agent
  path. The repo therefore does not assert any provider-side cost,
  retention, or content policy for the opencode handoff itself.
- Repo guardrails: `opencode` is marked
  `cost.confirmationPolicy: 'none'`, `cost.paidOperations: false`, but
  the rate-limit status is `unknown` and retry guidance is
  "Review the external tool output before retrying." Path safety is
  enforced in `openCodeWorkflowAdapter.ts` (cwd must remain inside the
  configured workspace root; `edit` and `bash` are forced to `deny`; the
  `execute` / `executionApproved` input is rejected outright).

### Local mock provider

- API and docs: the mock provider is a repo-local fixture. It has no
  external API, no pricing, no retention, and no content policy of its
  own beyond the per-template `legalConstraints` strings in
  `src/providers/imagePromptTemplates.ts`.
- Repo guardrails: `local` is the only provider marked
  `estimateAvailability: 'free'`, `paidOperations: false`,
  `confirmationPolicy: 'none'`. Its rate-limit status is
  `not-applicable`. It is the only provider the runtime and CI can call
  without credentials or network access.

## Offline-Mock Policy (Repo-Wide)

RPGCreatorAI does not call live providers during normal validation. The
following rules apply across every provider, every adapter, and every CI
job:

- `npm test`, `npm run typecheck`, `npm run build`, the native runtime
  tests, the asset and animation scripts, and all Phase 12 integration
  gates must use mocks, fixtures, or sanitized local scripts.
- `src/providers/mockProviderContract.ts` defines the required fixture
  outcomes (`success`, `image-success`, `malformed-response`,
  `provider-error`, `rate-limit`, `quota-exceeded`, `timeout`,
  `cancellation`). These fixtures are deterministic and offline.
- Live provider diagnostics are allowed only when the user explicitly
  requests them for the current run, credentials exist through the
  approved credential path, the UI or command displays provider, model,
  estimated or unknown cost, and the data that will be sent, and the
  result is logged as a diagnostic rather than as gate evidence. See
  `docs/PHASE_11_PROVIDER_LEGAL_BASELINE.md` for the full rule.
- The asset and animation pipeline (`tilesetGenerationWorkflow.ts`,
  `itemIconGenerationWorkflow.ts`, `portraitGenerationWorkflow.ts`,
  `characterConceptGenerationWorkflow.ts`,
  `imageEditVariationWorkflow.ts`, `spriteSheetGenerationWorkflow.ts`)
  defaults to `createMockProviderAdapter()` in production code paths.
  Live providers are reached only when a real adapter is substituted at
  the call site.
- Stop conditions from `docs/PHASE_12_RISK_REGISTER.md` apply: do not run
  a live paid or unknown-cost provider call as part of M08 validation,
  CI, or any gate evidence.

## Cross-References

- `docs/PHASE_12_RISK_REGISTER.md` — P12-R005 (live paid calls), P12-R006
  (cost/rate surprises), P12-R007 (stale provider assumptions), P12-R011
  (legal/licensing), P12-R023 (unsourced provider research).
- `docs/PHASE_11_PROVIDER_LEGAL_BASELINE.md` — official source links per
  provider and the no-live-call default.
- `docs/PRIVACY_COST_POLICY.md` — provider opt-in, credential boundary,
  cost and rate-limit visibility, failure recovery.
- `docs/PHASE_11_COST_RATE_LIMIT_BUDGET_STATES.md` — how the queue
  rejects unconfirmed paid or unknown-cost jobs and how the
  `rate-limit` / `quota-exceeded` fixtures are validated.
- `docs/SECURITY_THREAT_MODEL.md` — trust boundaries and provider-bound
  context rules.
- `src/providers/imagePromptTemplates.ts` — per-template `legalConstraints`
  and the `sanitizePromptInput` "in the style of X" scrubber.
- `src/providers/providerImageGenerationSettings.ts` —
  `imageGenerationReadiness` state machine for image generation.
- `src/providers/providerCostBudget.ts` — `buildProviderCostBudgetStates`
  and `ProviderCostBudgetState` shape.
