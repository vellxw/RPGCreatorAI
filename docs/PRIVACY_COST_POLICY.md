# Phase 11 Privacy, Cost, And Provider Safety Policy

RPGCreatorAI is local-first. The native runtime, project loading, save/load,
playtest, database editing, map editing, and asset management must work without
AI providers, network access, cloud services, provider credentials, or live API
availability.

## Provider Opt-In

Providers are optional editor tooling. A provider-backed action may run only
after the user explicitly enables the provider, accepts the provider-bound
context disclosure, and starts a specific editor action.

Provider-bound context is scoped to that action. It may include the submitted
prompt, selected project records, selected asset metadata, visual guidance,
model id, operation id, and non-secret cost or generation provenance metadata.

Provider-bound context must not include credential values, credential blobs,
runtime saves, runtime logs, runtime snapshots, playtest session directories,
unrelated local files, or whole-project dumps when selected records are enough.

## Credential Boundary

Credential values are never stored in project JSON, generation history,
diagnostics, screenshots, validation logs, or Linear comments. Desktop
credential storage uses the credential adapter described in
`docs/PHASE_11_CREDENTIAL_STORAGE_POLICY.md`; browser mode exposes credential
storage as unavailable.

Any provider error, failure detail, prompt history, or diagnostic text that can
reach logs or project metadata must pass through the shared redaction boundary.

## Cost And Rate Limits

Cost state must be visible before provider-backed work runs. Known estimates
may be shown only when provider or adapter metadata supplies them. Unknown
pricing must remain explicit, and paid or unknown-cost work requires the local
budget/session confirmation gate documented in
`docs/PHASE_11_COST_RATE_LIMIT_BUDGET_STATES.md`.

Rate-limit and quota failures are recoverable provider states. They must carry
retry or quota guidance when available, preserve queue context, and avoid
duplicate writes through idempotency keys and write-intent guards.

## Failure Recovery

Provider failures must be non-destructive. Successful generated output remains
a candidate until explicit review and acceptance. Failed provider calls may be
recorded as rejected generation history with redacted prompt/input context,
sanitized failure metadata, and partial outputs marked as failed candidates.
Failed records must not import assets, apply database/map/event changes, or
create accepted output links.

## Validation Policy

Normal validation uses mocks, fixtures, contract tests, local UI tests, local
builds, and smoke checks. Live paid provider calls are not part of normal
validation. If a future live diagnostic is requested explicitly, it must be
separate from release validation, use configured credentials, disclose cost or
unknown-cost state, redact outputs, and record diagnostic-only evidence.
