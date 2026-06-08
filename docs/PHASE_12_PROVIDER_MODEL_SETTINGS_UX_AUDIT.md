# Phase 12 Provider And Model Settings UX Audit

Issue: PX-002 / FRA-436
Date: 2026-06-07

## Scope And Sources

This audit reviews the current provider/model Settings UX and records where
raw infrastructure details leak into normal creator workflows. It compares the
existing Phase 11 surface against the Phase 12 M04 target modes:

- Auto recommended
- Fast/cheap
- Best quality
- Local/mock
- Custom advanced

Inspected sources:

- `docs/PHASE_11_PROVIDER_SETTINGS_UI.md`
- `docs/PHASE_11_MODEL_CAPABILITY_REGISTRY.md`
- `docs/PHASE_11_CREDENTIAL_STORAGE_POLICY.md`
- `docs/PHASE_11_COST_RATE_LIMIT_BUDGET_STATES.md`
- `docs/AI_WORKFLOWS.md`
- `src/screens/SettingsScreen.tsx`
- `src/stores/providerStore.ts`
- `src/providers/providerRegistry.ts`
- `src/providers/modelCapabilityRegistry.ts`
- `src/providers/providerCostBudget.ts`
- `src/providers/providerImageGenerationSettings.ts`
- `src/components/ai/ProviderCapabilityGatesPanel.tsx`
- `src/components/ai/ProviderCostBudgetPanel.tsx`
- `src/adapters/CredentialStoreAdapter.ts`
- `src-tauri/src/credential_commands.rs`
- focused Settings/provider/model/credential tests

Only source, docs, and tests were inspected. No `.env` file, app-data
credential store, provider credential value, or live provider API was read.

## Current UX Strengths

- Providers are disabled by default and require explicit opt-in disclosure.
- Credential values are not stored in project JSON and are not returned by the
  renderer or Rust bridge after save attempts.
- Browser mode reports credential storage as unavailable instead of pretending
  desktop credential persistence exists.
- Capability gates are model-capability driven rather than provider-name
  driven.
- Cost, rate-limit, quota, and budget confirmation states are visible before
  provider-backed work.
- The offline local mock provider has explicit registry metadata and tests,
  allowing normal validation without paid calls.
- Tests assert that Settings does not expose Generate, Connect, Test
  Connection, or other live-provider actions.

## Beginner UX Gaps

| Gap | Current evidence | Why it leaks infrastructure | M04 follow-up |
| --- | --- | --- | --- |
| No creator-mode entry point. | Settings opens directly to `Provider Settings` and provider cards. | Beginners must reason about vendors before choosing an outcome. | `PX-086`, `PX-087`, `PX-088`, `PX-089`, `PX-090` |
| Providers are listed as the primary choice. | Provider cards show OpenAI, Anthropic Claude, Kimi/Moonshot, DeepSeek, MiniMax, OpenCode, custom endpoint, and local gateway. | The first decision is vendor selection, not "recommended", "fast", "quality", or "local practice". | `PX-086` through `PX-091` |
| Model selection is a raw text field. | `SettingsScreen.tsx` labels it `Model label`; provider configs start with `model: ''`. | Users must know exact model ids or labels before they understand capabilities. | `PX-086`, `PX-092`, `PX-099` |
| Credential source labels expose env var names. | Provider cards show values such as `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and `CUSTOM_OPENAI_API_KEY`. | Env var names are useful diagnostics, but they are implementation details for normal creators. | `PX-093`, `PX-094`, `PX-101` |
| Custom endpoint configuration is inline with normal providers. | Custom provider exposes `Advanced endpoint`, `Base URL`, and capability checkboxes inside the main Settings list. | Base URLs and manual capability declarations are advanced transport details. | `PX-091`, `PX-098`, `PX-103` |
| Capability Gates panel uses technical workflow labels. | The panel lists `Text draft`, `Structured JSON`, `Image generation`, `Image edit`, `Animation draft`, and `Code/tooling`. | These are useful diagnostics, but beginner copy should frame what the app can help create. | `PX-099`, `PX-101`, `PX-104` |
| Cost and rate-limit states are provider-centric. | `Cost & Budget` lists per-provider unknown cost, provider-managed limits, retry guidance, and confirmation policy. | It is safe but abstract; creators need action-level cost warnings before a specific AI task runs. | `PX-096`, `PX-097`, `PX-104` |
| Local mock provider is not framed as the beginner-safe default. | Registry name is `Local gateway`; model labels are `offline-mock`, `offline-image-mock`, and `offline-image-edit-mock`. | The safest no-cost path reads like infrastructure instead of an offline practice mode. | `PX-090`, `PX-101` |
| Provider settings appear ephemeral in the inspected store. | `useProviderStore` uses React state and tests only default disabled/routing state. | Phase 12 needs durable mode/provider preference expectations before UX promises persistence. | `PX-100`, `PX-105` |

## Advanced-Only Candidates

These controls should remain available, but should move behind or below an
advanced boundary once creator modes exist:

- provider ids and adapter kind concepts
- raw model ids and manual model text entry
- credential env var/source names
- custom endpoint base URL
- custom endpoint capability checkboxes
- provider operation names such as `text.generate` and `code.assist`
- context-window and token-limit details
- rate-limit retry/quota diagnostics
- exact provider registry metadata and capability matrix details
- OpenCode adapter setup details

The default creator surface should instead expose intent-oriented choices:
recommended, fast/cheap, best quality, local/mock, and custom advanced.

## Test Coverage Observed

Current focused coverage is strong for Phase 11 safety:

- `SettingsScreen.test.tsx` covers no providers, disabled providers, opt-in
  disclosure, declined enablement, missing credentials, configured provider
  display, image settings controls, credential clearing after save, custom
  endpoint URL/model/capability controls, and absence of live action buttons.
- `providerStore.test.tsx` confirms providers start disabled, models are empty,
  routing defaults are disabled, and provider configs do not contain `apiKey`.
- `providerRegistry.test.ts` covers provider ids, model metadata, base URLs,
  credential requirements, operation ids, and settings config derivation.
- `modelCapabilityRegistry.test.ts` covers known model capabilities, unknown
  model unavailability, custom endpoint routing requirements, and capability
  gates.
- `ProviderCapabilityGatesPanel.test.tsx` and
  `ProviderCostBudgetPanel.test.tsx` cover read-only availability/cost panels
  without live actions.
- `CredentialStoreAdapter.test.ts`, Rust credential command tests, and
  redaction tests cover browser unavailable behavior, DPAPI metadata, path
  safety, and redaction using fixture secrets only.

## Missing Validation For Phase 12 Modes

The current test suite does not yet cover:

- a visible creator-mode preset selector
- Auto recommended provider/model resolution
- Fast/cheap and Best quality preference behavior
- Local/mock as the beginner-safe no-cost path
- Custom advanced boundaries and discoverability
- per-pipeline model defaults surfaced in creator language
- durable persistence for selected mode/provider preferences
- beginner-vs-advanced copy snapshots
- accessibility checks for the future mode selector and advanced panel
- screenshot evidence for provider selection UX
- action-level cost warnings tied to a specific AI task

These gaps align directly with M04 issues `PX-086` through `PX-105`.

## M04 Mapping

- `PX-086` Creator Mode Model Presets: introduce the primary mode selector
  above provider cards.
- `PX-087` Auto Recommended Mode: hide vendor/model choice behind a safe
  default recommendation.
- `PX-088` Fast Cheap Mode and `PX-089` Best Quality Mode: convert raw model
  metadata into understandable tradeoff presets.
- `PX-090` Local Mock Mode: reframe the local gateway as a no-cost offline
  practice/default validation path.
- `PX-091` Custom Advanced Mode Boundary and `PX-098` Advanced Provider Panel:
  move base URL, model ids, env vars, and manual capability controls behind an
  advanced boundary.
- `PX-092` Per-Pipeline Model Defaults: map choices to content, image, code,
  validation, and asset workflows instead of one global raw model field.
- `PX-093` Credential Boundary UX, `PX-094` Missing Credential State, and
  `PX-095` Disabled Provider State: keep current safety but rewrite copy for
  creator outcomes.
- `PX-096` Rate Limit Quota State and `PX-097` Cost Warning Surface: keep
  diagnostics but attach warnings to concrete tasks and modes.
- `PX-099` Model Capability Matrix Surface: keep technical matrix available
  after creator-mode selection, not before it.
- `PX-100` Provider Settings Persistence Tests: define and verify durable mode
  preference storage.
- `PX-101` Beginner Advanced Copy Audit, `PX-102` Screenshot Evidence,
  `PX-103` Accessibility, `PX-104` Contract Tests, and `PX-105` Integration
  Gate: validate the full M04 UX as a coherent product surface.

## Audit Result

The current provider/model UX is safe and well tested for Phase 11, but it is
not creator-first yet. It exposes vendor names, model labels, env var names,
base URLs, capability gates, cost metadata, and rate-limit diagnostics as the
main surface. Phase 12 M04 should keep those controls, but demote them behind
creator-mode presets and advanced panels so normal users choose outcomes
before infrastructure.
