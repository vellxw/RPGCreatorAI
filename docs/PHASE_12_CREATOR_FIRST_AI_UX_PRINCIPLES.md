# Phase 12 Creator-First AI UX Principles

Issue: PX-007 / FRA-441
Date: 2026-06-08

## Scope And Sources

This document defines Phase 12 product UX principles for AI-assisted creation
in RPGCreatorAI. The goal is to keep normal creators focused on making a game,
not configuring provider infrastructure, while preserving advanced controls
for users who need them.

Sources synthesized:

- Phase 12 goal prompt in Linear `FRA-441`
- `docs/PHASE_12_PRODUCT_UX_AUDIT.md`
- `docs/PHASE_12_PROVIDER_MODEL_SETTINGS_UX_AUDIT.md`
- `docs/PHASE_12_AI_PIPELINE_INVENTORY.md`
- `docs/PHASE_12_ASSET_ANIMATION_PIPELINE_INVENTORY.md`
- `docs/PHASE_12_PHASE_11_BASELINE_VERIFICATION.md`
- `docs/AI_WORKFLOWS.md`
- `docs/PHASE_11_PROVIDER_SETTINGS_UI.md`
- `docs/PHASE_11_CREDENTIAL_STORAGE_POLICY.md`
- `docs/PHASE_11_COST_RATE_LIMIT_BUDGET_STATES.md`
- `docs/PHASE_11_AI_REQUEST_QUEUE.md`
- `docs/PHASE_11_PROMPT_GENERATION_HISTORY.md`
- `docs/PHASE_11_OPENCODE_WORKFLOW_ADAPTER.md`

No frontend copy changed in this issue.

## Chosen Product Approach

Three approaches were considered:

| Approach | Tradeoff | Decision |
| --- | --- | --- |
| Provider-first Settings | Transparent for technical users, but forces beginners to choose vendors, model ids, credentials, endpoints, and cost states before they understand the task. | Reject as the default surface. Keep only as advanced configuration. |
| Feature-island AI buttons | Easy to add near existing editors, but fragments context, review state, cost warnings, and history across the product. | Use only when the action belongs naturally inside an editor, and still route through shared review/candidate rules. |
| Creator-first AI Studio plus advanced provider layer | Gives normal users outcome-oriented actions while preserving provider/model control for power users. | Adopt for Phase 12. |

The default mental model is: describe the creator outcome, preview the
candidate, review evidence, then accept or reject. Provider details are
supporting infrastructure, not the product's primary vocabulary.

## Principles

### 1. Local Creation Works Before AI Setup

Opening, creating, saving, validating, editing, and playtesting a project must
work without provider setup, credentials, network access, cloud services, or
live APIs. AI should enhance the editor; it must not gate normal creation.

Validation cue: startup, onboarding, and AI Studio tests must prove local/mock
paths remain available when every remote provider is disabled.

### 2. Outcomes First, Providers Second

Beginner surfaces should use creator outcomes: draft a map, add a quest,
repair validation issues, make a portrait, refine a sprite sheet, or explain a
runtime problem. They should not lead with provider names, raw model ids,
base URLs, env var names, operation ids, or capability matrices.

Provider details remain available in an advanced area for users who choose
`Custom advanced` or need diagnostics.

### 3. AI Studio Is A Work Surface, Not A Provider Console

AI Studio should be project-aware and task-oriented. It should show the
current project context, the affected maps/events/database records/assets, the
reasoning or evidence for a proposed action, and the next review step.

It should not look like a generic chat box attached to a provider list. Chat is
useful only when it produces concrete, scoped task cards or explains project
state.

### 4. Presets Are Product Modes

Creator mode choices should be understandable without provider knowledge:

- `Recommended`: safest default for the current task and project state.
- `Fast/cheap`: lower-cost or faster options when available.
- `Best quality`: quality-biased options with explicit cost/latency warning.
- `Local/mock`: no-cost offline practice and normal validation path.
- `Custom advanced`: raw provider/model/endpoint controls for power users.

Presets are UX contracts, not hardcoded provider promises. If the registry
cannot satisfy a preset, the UI should explain what is missing and keep local
creation available.

### 5. Every AI Mutation Is Review-Gated

AI may draft, suggest, repair, refine, or prepare a handoff. It must not
silently mutate accepted project data. Generated work remains a candidate
until a creator reviews and accepts it through the owning workflow or review
inbox.

Rejected, failed, or cancelled candidates must not enter runtime data, asset
catalog accepted state, source files, or database records.

### 6. Preview Before Apply

A creator should see what will change before accepting it:

- map/event/database candidates show affected records and validation status
- asset candidates show preview evidence, provenance, and QA state
- validation repair candidates show the original issue and proposed fix
- code-assist candidates show diffs or handoff summaries, not direct commits

Apply actions should be explicit, reversible where the editor supports undo,
and tied to normal reducers/loaders instead of bypassing project validation.

### 7. Runtime Independence Is Non-Negotiable

The native runtime consumes accepted local data and runtime-ready assets. It
does not call AI providers, read provider settings, read credentials, require
network access, or depend on editor-only generation history.

Any UI copy that implies "AI-powered runtime" or live provider behavior during
playtest is wrong for Phase 12.

### 8. Cost And Privacy Are Action-Level Warnings

Cost, unknown pricing, rate limits, quota, and context sharing should appear
when a user is about to run a provider-backed task, not as abstract warnings
detached from the task.

Good warnings state:

- what task is being sent
- which scoped context is included
- whether cost is free, estimated, unknown, or provider-managed
- whether a session budget confirmation is required
- how to continue locally if the creator declines

### 9. Errors Preserve Work And Offer Recovery

Provider disabled, missing credentials, browser credential storage unavailable,
rate limited, quota exceeded, unsupported capability, timeout, cancellation,
and provider failure states should be recoverable. They should not clear
prompts, lose candidate context, import partial assets, or apply partial
project changes.

Error copy should name the state, explain the next safe action, and remind the
creator when local/mock workflows still work.

### 10. Advanced Controls Stay Powerful And Explicit

Advanced users must be able to inspect and configure provider ids, model ids,
base URLs, capabilities, credential state, rate-limit guidance, cost metadata,
and OpenCode handoff settings. Those controls should be grouped behind a clear
advanced boundary and should never be required for first-run creation.

Advanced mode can use precise technical labels. Beginner mode should translate
the same state into task availability and recovery.

### 11. Developer Mode Is Separate From Creator AI

Code assistance, OpenCode handoffs, source candidates, shell/tool permissions,
diff previews, and test suggestions belong behind an explicit Developer Mode
gate. They must not appear as ordinary content-generation actions.

Developer Mode may prepare controlled handoffs and diffs, but it must not
commit, push, run arbitrary shell commands, or mutate source without explicit
review and later issue-scoped implementation.

### 12. History Is Useful Only When Redacted And Actionable

Generation history should help creators understand what happened, recover from
failures, and trace accepted outputs. It must not store credentials, provider
headers, raw account data, or unbounded project dumps.

History records should link accepted outputs to maps, events, database records,
assets, or source candidates so review and support flows are concrete.

## Anti-Patterns

Avoid these in Phase 12 UI and docs:

- showing provider cards as the first AI decision for a new creator
- requiring raw model ids before the creator picks a task
- labeling beginner controls with env var names, endpoint URLs, operation ids,
  or adapter names
- adding a generic `Generate` button that mutates project data immediately
- sending whole-project dumps when a selected record or scoped context is
  sufficient
- hiding unknown cost behind optimistic copy
- retrying provider calls blindly after rate-limit or quota failures
- treating live provider diagnostics as normal validation
- storing credentials, tokens, raw provider responses, or provider headers in
  project JSON, screenshots, logs, or Linear comments
- letting rejected candidates appear in runtime data or accepted asset state
- presenting code assistant actions as normal content-authoring actions
- implying the native runtime needs AI to play the game

## Beginner And Advanced Examples

| Scenario | Beginner copy/behavior | Advanced copy/behavior |
| --- | --- | --- |
| No providers configured | "Use local practice mode or set up AI later. You can still edit, save, validate, and playtest." | Provider list shows disabled providers, credential status, capability gates, and missing configuration. |
| Choose AI mode | `Recommended`, `Fast/cheap`, `Best quality`, `Local/mock`, `Custom advanced`. | Provider/model registry, custom endpoint, capability checkboxes, model labels, and cost metadata. |
| Draft a quest | "Draft a quest using current actors, items, and maps. Review before adding it." | Shows selected provider capability, structured JSON route, prompt template id, scoped context summary, and cost status. |
| Repair validation | "Review suggested fixes for the current validation errors." | Shows validation repair workflow id, candidate patch details, write intent, idempotency key, and retry state. |
| Generate a portrait | "Create a portrait candidate for this character, then run visual QA." | Shows image model setting, prompt template, provider/model ids, accepted output links, and asset-catalog metadata. |
| Missing credentials | "This AI mode needs setup. Save a desktop credential or continue with local practice mode." | Shows provider id, credential storage metadata, configured/unavailable state, and redacted bridge error if any. |
| Rate limited | "The provider asked us to wait. Your prompt and candidate context are preserved." | Shows failure kind, retry-after guidance, queue id, attempts, and provider retry detail. |
| Code assistance | "Developer Mode can prepare a reviewed source-change proposal." | Shows OpenCode handoff permissions, repo-local cwd, denied external directories, and diff/test suggestion metadata. |

## Copy Conventions

Use:

- "Draft", "suggest", "repair", "refine", "review", "accept", "reject"
- "local practice mode" for no-cost mock-backed paths
- "This will not change your project until you accept it"
- "Local editing and playtest still work"
- "Unknown cost" when pricing cannot be estimated
- "Requires desktop credential" when browser mode cannot store credentials

Avoid in beginner surfaces:

- "provider adapter", "operation id", "base URL", "env var", "capability gate"
- "API key" unless the user is explicitly in credential setup
- "run provider", "execute model", or "call API" as the primary action
- vague errors such as "AI failed" without recovery

## Validation In Later UI Issues

M01 Launcher/startup:

- Startup must not block on provider setup.
- First visible states should communicate product launch progress and local
  project paths.

M02 AI Studio:

- AI Studio must show project context, scoped task cards, review status, and
  local/mock availability.
- Tests should assert the shell is not a provider console and does not expose
  live provider actions by default.

M03 Command router:

- Natural-language routing must produce previewable candidates or
  clarifications, never silent mutations.
- Ambiguous, unsupported, and preview-only requests need fixture coverage.

M04 Provider/model UX:

- Creator presets must appear before raw provider configuration.
- Advanced provider controls must remain available but visually and
  semantically separated from beginner mode.
- Copy tests should cover beginner and advanced states.

M05 Review inbox:

- Candidate lifecycle must cover pending, accepted, rejected, archived,
  failed, validation-blocked, and runtime-excluded states.
- Rejected candidates must not enter runtime data.

M06 Developer Mode:

- Code assistant entry points must require an explicit Developer Mode gate.
- Diff/handoff previews and tests must prove no commit, push, or arbitrary
  execution happens from normal creator flows.

M07 Onboarding:

- First-run flows should guide creators through sample, blank, and local/mock
  practice paths without requiring provider setup.
- Save, validate, and playtest should remain the first success loop.

## Acceptance Checks For Future Phase 12 UI

A Phase 12 AI UI change should pass these product checks before it closes:

- Can a non-technical creator understand what the action will create or fix?
- Is provider/model infrastructure hidden until it is useful?
- Is there a local/mock path or a clear explanation when a provider is needed?
- Is cost/privacy shown before provider-backed work runs?
- Is the proposed output previewed as a candidate?
- Is accepted project data changed only by explicit review?
- Are failure states non-destructive and recoverable?
- Does the native runtime remain independent of AI, providers, credentials,
  network, and editor-only history?

## Result

Phase 12 should make AI feel like a project-aware creation assistant, not a
provider setup workflow. The existing Phase 11 provider, queue, history,
review, asset, and runtime boundaries are strong enough to support this shift
as long as later issues keep the default surface outcome-oriented and reserve
infrastructure for explicit advanced mode.
