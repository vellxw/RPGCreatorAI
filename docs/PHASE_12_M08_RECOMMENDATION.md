# Phase 12 M08 Architectural Recommendation

Issue: PX-166..PX-185 / FRA-443 (M08 Generated Asset and Animation Research)
Date: 2026-06-08

## Scope

This document is the M08 architectural recommendation for which provider
should default to which pipeline, what cost guardrails to apply, and how to
keep the multi-round refinement loop deterministic, offline-first, and
legally bounded. It does not change any code; it points to the existing
files that already implement the recommendation and calls out the gaps that
later milestones (M09, M10, M11) must close.

The recommendation is consistent with:

- `docs/PHASE_12_RISK_REGISTER.md` (P12-R002, P12-R005, P12-R006,
  P12-R007, P12-R011, P12-R013, P12-R023).
- `docs/PHASE_11_PROVIDER_LEGAL_BASELINE.md` (no-live-call default,
  provenance, disclosure).
- `docs/PRIVACY_COST_POLICY.md` and
  `docs/PHASE_11_COST_RATE_LIMIT_BUDGET_STATES.md` (cost, rate-limit,
  budget gates).
- `docs/PHASE_12_CREATOR_FIRST_AI_UX_PRINCIPLES.md` and
  `src/providers/providerMode.ts` (the five creator-facing modes).
- `docs/PHASE_12_M08_PROVIDER_CAPABILITY_MATRIX.md` (what each provider
  actually declares today).

## Pipeline Default Recommendations

The "pipeline" column maps onto the existing per-workflow resolution in
`src/providers/providerMode.ts` and the provider workflow definitions in
`src/providers/modelCapabilityRegistry.ts`.

| Pipeline | Default provider / model | Justification | Fallback |
| --- | --- | --- | --- |
| text-draft (text.generate) | Anthropic Claude Sonnet 4.6 (`claude-sonnet-4-6`) | Strong narrative/dialogue authoring, structured output (`structured-json` capability), 1M-token context window, code assistance available for adjacent plugin work. Listed first in `RECOMMENDED_TEXT_PREFERENCE` in `providerMode.ts`. | Local mock (`offline-mock`) for first-run, deepseek-v4-flash, moonshot-v1-8k, gpt-5.5. |
| structured-json (text.generate with `response_format` / `output_config`) | Anthropic Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) | Cheapest Anthropic model that still declares `structured-json`; the chat completions adapters (`kimiProviderAdapter`, `deepSeekProviderAdapter`, `openAiCompatibleProviderAdapter`) also expose `response_format: { type: 'json_object' }`. Listed first in `STRUCTURED_JSON_PREFERENCE`. | Local mock for first-run and offline validation, gpt-5.5. |
| image-generate (`image.generate`) | OpenAI GPT Image 2 (`gpt-image-2`) | The only provider in the current registry whose image model declares both `image` and `image-edit` capabilities, configurable quality/size/format/background/moderation via `providerImageGenerationSettings.ts`, and is the first paid image model in `IMAGE_PREFERENCE` in `providerMode.ts`. | Local mock (`offline-image-mock`) for first-run, MiniMax `image-01` as a paid secondary. |
| image-edit (`image.edit`) | OpenAI GPT Image 2 (`gpt-image-2`) | OpenAI is the only provider in the registry that declares `image.edit`. `MINIMAX` does not declare `image.edit`; Anthropic, DeepSeek, and Kimi do not declare any image operation. The edit template (`asset-edit-v1`) therefore has no other live provider fallback. | Local mock (`offline-image-edit-mock`) only. |
| sprite-sheet (`image.generate` + `character-spritesheet-v1` template) | OpenAI GPT Image 2 (`gpt-image-2`) | Uses the same `image.generate` route as image-generate; sprite-sheet output is a horizontal-strip image that the local Python `normalize_animation_strip.py` and `generate_animation_preview.py` scripts already consume. | Local mock for offline validation; MiniMax `image-01` as a paid secondary if OpenAI is unavailable. |
| code-tooling (`code.assist`) | opencode workflow adapter (`opencode-workflow`) | The opencode handoff is the only provider the repo ships that is non-destructive (no execution, `requiresExplicitExecution: true`, `edit` and `bash` forced to `deny`, cwd must stay inside the configured workspace root). It is listed first in `CODE_TOOLING_PREFERENCE`. | Local mock, Anthropic Claude Sonnet 4.6, DeepSeek V4 Flash for paid text-only code suggestions. |
| animation-draft (currently `video` capability) | **No live provider.** Local mock only. | No registered descriptor declares the `video` capability. M09 must keep animation review-gated and offline; animation normalization already runs locally in `scripts/dev/normalize_animation_strip.py`. | n/a — escalate to user per `docs/PHASE_12_RISK_REGISTER.md` P12-R007 if a paid video model is later added. |

These defaults align with `providerMode.ts` and respect the existing mode
presets: "Recommended" picks the first credentialed provider from the
preference list, "Fast/cheap" picks the cheapest, "Best quality" picks the
highest capability, "Local/mock" forces the offline provider, and
"Custom advanced" lets the user override per workflow.

## Cost Guardrails

The repo already implements the following guardrails. The recommendation
keeps them and adds two explicit thresholds the queue should enforce.

### Existing guardrails (already in code)

- Per-provider `paidOperations` and `confirmationPolicy` in
  `src/providers/providerRegistry.ts` (`confirm-paid-session` for every
  paid provider, `none` for the local mock).
- `imageGenerationReadiness` in
  `src/providers/providerImageGenerationSettings.ts` refuses to mark a
  provider `ready` unless it is enabled, has credentials, has a model
  selected, and the model declares the `image` capability. The four
  failure states (`disabled`, `missing-credentials`, `missing-model`,
  `unsupported-model`) are user-facing copy.
- `buildProviderCostBudgetStates` in
  `src/providers/providerCostBudget.ts` exposes a per-provider
  `requiresConfirmation` flag and a `confirmationPolicy` label for the
  read-only Settings "Cost & Budget" panel.
- Per-job cost/rate-limit/budget-confirmation fields on the AI request
  queue (`src/stores/aiRequestQueueStore.ts`). The queue rejects
  expensive estimated-cost jobs with unconfirmed session budget using
  the failure kind `budget-confirmation-required`.
- Provider-managed rate-limit handling: adapters parse
  `retry-after`/`x-ratelimit-reset[-requests]` headers into structured
  `retryAfterSeconds` and emit `rate-limit` / `quota-exceeded` failure
  kinds (see `openAiProviderAdapter.ts`, `anthropicProviderAdapter.ts`,
  `openAiCompatibleProviderAdapter.ts`, `miniMaxProviderAdapter.ts`).
- The mock provider contract returns deterministic `rate-limit` and
  `quota-exceeded` fixtures with retry guidance so the recovery UI is
  exercised without a live call.

### Recommended thresholds (M08 stance, no code change)

- **Confirmation above N image jobs per session.** The current queue
  requires per-session confirmation for any paid or unknown-cost work.
  M08 recommends an additional explicit confirmation prompt when a
  single session has already enqueued more than 4 image jobs without an
  accepted candidate (or when the session is in the `best-quality`
  mode). The exact number is product-polish; the gate is the
  requirement, not the constant.
- **Maximum retry count per job.** M08 recommends a hard cap of 2
  automatic retries per job (initial attempt + 1 transient retry on
  `rate-limit` / `timeout`, with `retryAfterSeconds` honored; no
  automatic retry on `quota-exceeded`, `budget-confirmation-required`,
  `unsupported-operation`, or `cancelled`). This is consistent with the
  offline-mock contract and the `rate-limit` / `timeout` /
  `quota-exceeded` failure kinds already declared in
  `src/providers/providerAdapter.ts`.
- **Per-session cost cap.** M08 recommends a soft cap of "unknown" or
  any estimated total > $0 that the user has not explicitly approved in
  the current session. The existing `requiresPaidJobConfirmation` flag
  already does this for unknown-cost work; M10 should add a
  session-level running total that gates the next enqueue when the
  estimate crosses a user-set threshold.
- **No unbounded live loops.** The multi-round refinement loop (below)
  is bounded by the iteration cap, never by elapsed time or token spend.
- **All four thresholds are UI-visible.** They show up in the read-only
  Cost & Budget panel and in the queue job row. The user can see
  confirmation state, retry count, and running total before they enqueue
  the next job.

## Deterministic Multi-Round Refinement Approach

The current pipeline already produces single-pass candidates via
`tilesetGenerationWorkflow.ts`, `itemIconGenerationWorkflow.ts`,
`portraitGenerationWorkflow.ts`, `characterConceptGenerationWorkflow.ts`,
`imageEditVariationWorkflow.ts`, and `spriteSheetGenerationWorkflow.ts`.
M10 should add a multi-round loop without expanding scope or inventing new
provider operations.

The recommended loop is **planner -> generator -> checker -> refiner**,
bounded to a small fixed number of iterations:

1. **Planner.** A text-draft call (default Anthropic Sonnet 4.6; falls
   back to local mock) consumes the user's brief plus any accepted
   candidates, scope constraints from `docs/GAME_VISUAL_DESIGN.md`, and
   the previous round's checker report. It returns a structured prompt
   brief using the same shape `imagePromptTemplates.ts` already
   requires (`subject`, `useCase`, `palette`, `styleNotes`) and an
   optional `legalConstraints` overlay. The planner output is a
   candidate, not a mutation.
2. **Generator.** A single `image.generate` call (default OpenAI
   `gpt-image-2`; falls back to `offline-image-mock`) renders the
   planner's brief using the matching template kind. Image settings come
   from `providerImageGenerationSettings.ts` so quality/size/format/
   background/moderation stay configurable. The generator's output is a
   candidate, not an accepted asset.
3. **Checker.** The local visual QA rubric in
   `src/providers/generatedImageVisualQa.ts` (and the animation QA
   rubric in `src/providers/generatedAnimationQa.ts` for sprite sheets)
   scores the candidate against deterministic criteria. The rubric is
   the same one Phase 11 already uses for first-pass validation; no new
   rubric is introduced in M08. The checker is the gate: the candidate
   is only sent to the refiner if the rubric produces an
   `accept`-eligible score band.
4. **Refiner.** The refiner re-runs the planner/generator pair with the
   checker's structured feedback folded into the brief. The refiner
   inherits the same template constraints and the same `sanitizePromptInput`
   scrubber. The refiner never edits the original accepted asset and
   never mutates the project catalog directly.

Constraints:

- The loop is bounded to a fixed iteration cap (recommended: 2 rounds
  total: initial + 1 refinement). Exceeding the cap sends the
  best-scoring candidate to the review inbox with a "max iterations
  reached" provenance note. The cap is exposed to the user.
- Each round is enqueued as a separate job so the existing per-job
  cost/rate-limit/budget-confirmation gates still apply. The queue's
  idempotency/write-intent guards prevent duplicate writes; refinement
  never overwrites an accepted asset.
- Provenance accumulates across rounds. The
  `buildImagePromptProvenance` helper in `imagePromptTemplates.ts`
  already records template id, version, kind, inputs, provider id,
  model id, image settings, visual-context source/version, and
  creation timestamp. The M10 refinement wrapper appends a round index
  and the checker's score breakdown without adding secrets.
- Failure paths are explicit. A `quota-exceeded` failure stops the loop
  immediately. A `rate-limit` failure is honored with
  `retryAfterSeconds` and the loop continues only if retries remain.
  An `unsupported-operation` failure (e.g. the user picked a provider
  with no `image.generate` operation) is a user error, not a loop
  condition.

This approach does not expand scope. It reuses the existing workflow
files, the existing prompt templates, the existing visual/animation QA,
the existing provider queue, and the existing offline mock contract. It
introduces no new provider operations and no new image or animation
capability claims.

## No-Live-Call Validation Policy

M08 validation must remain offline. The following rules apply to every
command, test, and gate that touches provider code or generated asset
code:

- `npm run typecheck`, `npm test -- --run ...`, `npm run build`, the
  native runtime tests, and the Python animation scripts run against
  fixtures, mocks, and sanitized local data. They do not require
  credentials, network access, paid APIs, or a live provider.
- The focused contract command is:
  ```powershell
  npm test -- --run src/providers/__tests__/mockProviderContract.test.ts src/providers/__tests__/mockProviderAdapter.test.ts src/providers/__tests__/providerCostBudget.test.ts src/providers/__tests__/modelCapabilityRegistry.test.ts src/providers/__tests__/openAiProviderAdapter.test.ts src/providers/__tests__/anthropicProviderAdapter.test.ts src/providers/__tests__/kimiProviderAdapter.test.ts src/providers/__tests__/deepSeekProviderAdapter.test.ts src/providers/__tests__/miniMaxProviderAdapter.test.ts src/providers/__tests__/openCodeWorkflowAdapter.test.ts
  ```
  All of these tests use `fetch` injection or the in-process mock
  adapter; none of them make a real network call.
- The asset and animation focused command (already documented in
  `docs/PHASE_12_ASSET_ANIMATION_PIPELINE_INVENTORY.md`) is the safe
  validation surface for M08's downstream milestones.
- Live provider diagnostics are out of scope for M08. If a future
  milestone needs a real call, it must follow the explicit opt-in,
  redacted, cost-disclosed, and diagnostic-only rules in
  `docs/PHASE_11_PROVIDER_LEGAL_BASELINE.md` and
  `docs/PHASE_12_RISK_REGISTER.md` (P12-R005, stop condition).

## Legal Scope And The "In The Style Of" Scrubber

The repo already ships a `sanitizePromptInput` helper in
`src/providers/imagePromptTemplates.ts` that rewrites any user input
matching the regex `/\b(in the style of|style of|copy|clone|copyrighted|trademarked)\b/i`
into the literal string `'original visual direction reference removed'`
before the prompt is composed. The scrubber runs in
`renderImagePromptTemplate`, so it covers every one of the eight
template kinds (`tileset`, `icon`, `portrait`, `concept`, `spritesheet`,
`edit`, `ui-panel`, `reference`).

The M08 legal scope is the union of:

- The eight per-template `legalConstraints` strings in
  `imagePromptTemplates.ts` (no copying of proprietary tilesets,
  characters, sprites, spritesheets, UI skins, reference boards,
  actors, celebrities, logos, or branded assets; no claims of license,
  endorsement, or compatibility with third-party packs).
- The `defaultImagePromptVisualContext` rules (original RPGCreatorAI
  art direction only; no copying of reference art, layouts, characters,
  or copyrighted content; respect viewport-aware story-RPG
  composition; pixel-perfect alignment; readable playable space;
  authored scene detail over accidental voids).
- The `sanitizePromptInput` scrubber (removes "in the style of",
  "style of", "copy", "clone", "copyrighted", "trademarked" tokens).
- The existing provider metadata rule that paid or unknown-cost work
  requires per-session confirmation
  (`docs/PHASE_11_COST_RATE_LIMIT_BUDGET_STATES.md`).
- The disclosure and provenance rules in
  `docs/PHASE_11_PROVIDER_LEGAL_BASELINE.md` (provider/model/operation
  disclosure before sending, candidate-only until accepted, retain
  provenance in the editor).

The recommendation does not change the scrubber or the templates in
M08. M08 only documents that the existing scrubber is the legal
mitigation for "in the style of X" prompts and that any new legal
phrase list must be appended in `sanitizePromptInput` (or a successor
function) plus mirrored in the per-template `legalConstraints` arrays
to keep prompt-time and review-time guidance consistent.

## Stop Conditions Inherited From The Risk Register

The following stop conditions from `docs/PHASE_12_RISK_REGISTER.md`
bind the M08 recommendation:

- P12-R005: do not run a live paid or unknown-cost provider call as
  part of M08 evidence, CI, or any gate.
- P12-R006: surface action-level cost or unknown-cost and budget
  confirmation before any paid work.
- P12-R007: do not hardcode exact pricing, model promises, or
  capability claims into UX; treat provider metadata as configurable.
- P12-R011: research provider terms before expanding real generation
  paths; keep generated assets editable and provenance-visible.
- P12-R013: bound refinement iterations, require planner/checker
  outputs, enforce budget confirmation, and send all outputs to the
  review inbox.
- P12-R023: cite official sources, distinguish provider claims from
  implemented app behavior, and mark unknown or unstable facts as
  "see provider docs."

## Cross-References

- `docs/PHASE_12_M08_PROVIDER_CAPABILITY_MATRIX.md` — the capability
  source of truth this recommendation maps onto.
- `docs/PHASE_12_M08_LEGAL_COST_NOTES.md` — the legal and cost notes
  this recommendation is bounded by.
- `docs/PHASE_12_RISK_REGISTER.md` — P12-R002, P12-R005, P12-R006,
  P12-R007, P12-R011, P12-R013, P12-R023.
- `docs/PHASE_11_PROVIDER_LEGAL_BASELINE.md` — no-live-call default,
  provenance, disclosure.
- `docs/PHASE_11_COST_RATE_LIMIT_BUDGET_STATES.md` — cost, rate-limit,
  budget states.
- `docs/PRIVACY_COST_POLICY.md` — provider opt-in, credential
  boundary, failure recovery.
- `docs/PHASE_12_CREATOR_FIRST_AI_UX_PRINCIPLES.md` — the five
  creator-facing modes.
- `src/providers/providerMode.ts` — the existing per-mode preference
  tables that this recommendation aligns with.
- `src/providers/providerRegistry.ts`,
  `src/providers/modelCapabilityRegistry.ts`,
  `src/providers/providerCostBudget.ts`,
  `src/providers/providerImageGenerationSettings.ts`,
  `src/providers/imagePromptTemplates.ts`,
  `src/providers/openAiProviderAdapter.ts`,
  `src/providers/anthropicProviderAdapter.ts`,
  `src/providers/kimiProviderAdapter.ts`,
  `src/providers/deepSeekProviderAdapter.ts`,
  `src/providers/miniMaxProviderAdapter.ts`,
  `src/providers/openCodeWorkflowAdapter.ts`,
  `src/providers/mockProviderAdapter.ts`,
  `src/providers/generatedImageVisualQa.ts`,
  `src/providers/generatedAnimationQa.ts` — the code files this
  recommendation points to without modifying.
