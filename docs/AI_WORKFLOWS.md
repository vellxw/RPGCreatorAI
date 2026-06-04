# AI Workflows And Provider Setup

RPGCreatorAI AI features are optional editor tooling. The native runtime,
browser editor, desktop editor, project loading, save/load, validation, and
playtest flows remain usable without providers, credentials, network access,
cloud services, live APIs, or paid calls.

## Current Surfaces

- `Settings` is the provider control surface. It shows Provider Settings,
  Capability Gates, Cost & Budget, Safety, and AI Request Queue panels.
- `AI Tools`, if reached directly, is a read-only status surface for the
  implemented editor tooling. It does not start live provider calls.
- Workflow entry points live near the data they affect: map drafts in map
  tooling, event command generation in event tooling, database drafts and
  balancing in database tooling, image generation in asset tooling, and
  validation repair guidance near validation flows.

## Provider Setup

1. Open `Settings`.
2. Enable a provider only after accepting the provider opt-in disclosure.
3. Configure model labels, image options, custom endpoint URL, or custom
   capabilities when the provider supports them.
4. In desktop mode, paste a credential only into the provider credential field
   and save it through the credential bridge.
5. In browser mode, credential storage is unavailable by design; local editing
   and mock-backed validation still work.

Credential values are stored outside project JSON. The desktop shell stores
provider credentials as local app-data blobs through the policy in
`docs/PHASE_11_CREDENTIAL_STORAGE_POLICY.md`. Credential values must not be
committed, logged, stored in generation history, added to screenshots, or
posted to Linear.

## Mock Tests Versus Live Diagnostics

Normal validation uses local mocks, fixtures, contract tests, adapter tests,
and UI tests. It does not make live OpenAI, Anthropic, Kimi/Moonshot,
DeepSeek, MiniMax, custom endpoint, OpenCode, or other paid provider calls.

The local mock provider supports deterministic text and image fixtures,
provider failures, rate-limit failures, quota failures, cancellation, timeout,
malformed response, and missing-credential states. These fixtures are the
normal release-validation path.

Future live diagnostics, if explicitly requested, must be separate from normal
validation, use configured credentials, disclose cost or unknown-cost state,
redact outputs, and record diagnostic-only evidence.

## Generation Workflows

All generation workflows are review-gated. Generated output remains a
candidate until explicitly accepted by the editor workflow that owns the data.
Rejected and failed candidates must not mutate accepted project data.

Implemented workflow groups:

- Content drafts: map drafts, quest drafts, event command drafts, database
  drafts, balancing suggestions, and validation repair guidance.
- Image assets: tileset generation, item icon generation, portrait generation,
  and image edit variations.
- Character and animation: character concepts, sprite-sheet generation,
  animation strip normalization, preview generation, visual QA, animation QA,
  and runtime BMP export.
- Provider adapters: OpenAI, Anthropic Claude, Kimi/Moonshot, DeepSeek,
  MiniMax, custom OpenAI-compatible endpoints, OpenCode workflow integration,
  and the deterministic local mock adapter.

Important workflow docs:

- `docs/PHASE_11_AI_PROVIDER_HUB_FOUNDATION_GATE.md`
- `docs/PHASE_11_AI_GAME_CONTENT_PIPELINE_INTEGRATION_GATE.md`
- `docs/PHASE_11_GPT_IMAGE_ASSET_PIPELINE_INTEGRATION_GATE.md`
- `docs/ASSET_PIPELINE.md`
- `docs/PHASE_11_PROMPT_GENERATION_HISTORY.md`
- `docs/PHASE_11_MOCK_PROVIDER_CONTRACTS.md`

## Safety Boundaries

Provider-backed actions may send only the selected prompt and scoped project
context needed for the selected editor action. They must not send credential
values, runtime saves, runtime logs, runtime snapshots, whole-project dumps
when selected records are enough, unrelated local files, or playtest session
directories.

Cost state must be visible before provider-backed work runs. Known estimates
may be shown only when provider or adapter metadata supplies them. Unknown
pricing stays explicit, and paid or unknown-cost work requires the local
budget/session confirmation gate.

Rate-limit and quota failures are recoverable provider states. They preserve
queue context, expose retry or quota guidance when available, and use
idempotency/write-intent guards to avoid duplicate writes.

Failed provider calls are non-destructive. They may be recorded as rejected
generation history with redacted prompt/input context, sanitized failure
metadata, and partial output marked as a failed candidate. Failed records do
not import assets, apply map/database/event changes, or create accepted output
links.

See also:

- `docs/PRIVACY_COST_POLICY.md`
- `docs/PHASE_11_COST_RATE_LIMIT_BUDGET_STATES.md`
- `docs/PHASE_11_PROVIDER_SETTINGS_UI.md`
- `docs/ERROR_RECOVERY.md`
- `docs/DIAGNOSTICS.md`

## Troubleshooting

| State | Meaning | User-safe recovery |
| --- | --- | --- |
| Provider disabled | Provider-backed work is unavailable. | Enable only if you want provider-backed editor tooling. Local authoring remains available. |
| Needs credentials | Provider is enabled but desktop credential metadata is missing. | Save a credential in desktop Settings, or keep using local/mock workflows. |
| Browser credential storage unavailable | Browser mode cannot store desktop credentials. | Use desktop mode for credential-backed tooling. |
| Workflow unavailable | Capability gates do not find a configured provider/model for that operation. | Configure provider capabilities/model metadata, or use local non-provider workflows. |
| Cost unknown | Provider pricing metadata is not available for the configured model/usage. | Treat the action as unknown-cost and require the local budget/session confirmation gate. |
| Rate limited | Provider reported a retryable limit state. | Keep queue context and retry only after the displayed guidance. |
| Quota exceeded | Provider reported quota exhaustion. | Change provider/account/model after resolving quota; do not retry blindly. |
| Failed candidate | A provider call failed after preserving redacted context. | Review the rejected history record; no accepted project data was changed. |

## Validation Commands

Focused AI/provider documentation and UI checks:

```powershell
npm test -- --run src/components/layout/__tests__/MvpPlaceholderGating.test.tsx src/screens/__tests__/SettingsScreen.test.tsx src/components/ai/__tests__/ProviderCapabilityGatesPanel.test.tsx src/components/ai/__tests__/ProviderCostBudgetPanel.test.tsx src/components/ai/__tests__/AIRequestQueuePanel.test.tsx src/providers/__tests__/generationHistory.test.ts src/providers/__tests__/mockProviderContract.test.ts
```

Full local product gate:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1
```

No live provider call is required for either command.
