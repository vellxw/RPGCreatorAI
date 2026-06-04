# Phase 11 Cost, Rate Limit, And Budget States

CP-062 / FRA-97 adds editor-side cost, rate-limit, quota, and session-budget
state for optional provider work. It does not call live providers, read
credentials, generate content, mutate project JSON, or affect the native
runtime.

## Provider Metadata

`src/providers/providerRegistry.ts` now records cost and rate-limit metadata
beside each provider:

- live/paid providers are marked as `estimateAvailability: unknown`
- the offline mock provider is marked as `free`
- providers or adapters that can estimate a job before execution may provide
  `estimatedUsd` with `currency: USD`
- provider-managed rate limits carry retry and quota guidance
- paid or unknown-cost work requires explicit per-session confirmation before
  it can be queued

Exact vendor pricing is intentionally not hardcoded as a product promise. If
future adapters can return an estimate, they should provide that estimate at
job creation time and keep unknown pricing visible when they cannot.

## Queue And Adapter Contract

`src/stores/aiRequestQueueStore.ts` now supports optional job cost,
rate-limit, and budget-confirmation fields. Expensive estimated-cost jobs with
unconfirmed session budget state are rejected before enqueueing with
`budget-confirmation-required`.

`src/providers/providerAdapter.ts` now exposes structured failure metadata for
rate-limit, quota, budget, unsupported-operation, cancellation, and provider
errors while preserving the existing string `error` field for UI copy.

The offline mock adapter can return deterministic fixture failures for
`rate-limit` and `quota-exceeded`, including retry guidance, without any live
provider call.

The offline mock provider contract treats both `rate-limit` and
`quota-exceeded` as required fixtures so provider recovery UI can be validated
without paid calls.

## Settings UI

Settings now includes a read-only `Cost & Budget` panel. The panel lists each
provider's cost availability, rate-limit state, retry guidance, and whether
paid work needs session confirmation. It has no generate, connect, or
test-provider action.

The AI Request Queue panel can also display job-level cost, rate-limit, quota,
and budget-confirmation status when future provider workflows enqueue jobs.

## Generation History

Generation history records can store sanitized cost metadata when it is known
at generation time. The stored metadata is limited to cost availability,
non-negative USD estimate, confirmation requirement, confirmation threshold,
confirmation timestamp, and redacted display detail. It must not store
credentials, provider headers, raw API responses, or vendor account data.

## Validation

Normal validation stays offline:

- provider cost/budget state contract tests
- known-estimate Settings panel regression tests
- generation history cost metadata persistence and redaction tests
- mock adapter rate-limit and quota fixture tests
- queue budget-confirmation rejection tests
- Settings and panel UI regression tests

No live OpenAI, Claude, Kimi/Moonshot, DeepSeek, MiniMax, custom endpoint, or
other paid provider call was made.
