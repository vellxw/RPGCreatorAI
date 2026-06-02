# Phase 11 Provider And Legal Baseline

CP-004 / FRA-39 defines the baseline policy for optional AI provider tooling in
RPGCreatorAI. This document is planning and implementation guidance for later
AI Provider Hub, asset generation, security, cost, and release issues.

No live provider calls were made for this review. No credentials were created,
used, stored, or requested.

## Official Sources Checked

Checked on 2026-06-01:

- OpenAI API authentication:
  https://developers.openai.com/api/reference/overview#authentication
- OpenAI image generation:
  https://developers.openai.com/api/docs/guides/image-generation
- OpenAI data controls:
  https://developers.openai.com/api/docs/guides/your-data#default-usage-policies-by-endpoint
- Anthropic Claude authentication:
  https://platform.claude.com/docs/en/manage-claude/authentication
- Anthropic Claude rate limits:
  https://platform.claude.com/docs/en/manage-claude/rate-limits-api
- Anthropic Claude Code data usage:
  https://code.claude.com/docs/en/data-usage
- Kimi / Moonshot API overview:
  https://platform.kimi.ai/docs/api/overview
- Kimi OpenPlatform Terms of Service:
  https://platform.kimi.ai/docs/agreement/modeluse
- DeepSeek API docs:
  https://api-docs.deepseek.com/
- DeepSeek API reference:
  https://api-docs.deepseek.com/api/deepseek-api/
- DeepSeek Open Platform Terms of Service:
  https://cdn.deepseek.com/policies/en-US/deepseek-open-platform-terms-of-service.html
- MiniMax quickstart prerequisites:
  https://platform.minimax.io/docs/guides/quickstart-preparation
- MiniMax tool configuration:
  https://platform.minimax.io/docs/token-plan/other-tools
- MiniMax text generation API reference:
  https://platform.minimax.io/docs/api-reference/text-post
- OpenCode provider docs:
  https://opencode.ai/docs/providers/

## Provider Compatibility Baseline

| Provider family | API compatibility baseline | Credential assumption | Model/config rule | Live-call rule |
| --- | --- | --- | --- | --- |
| OpenAI | Native OpenAI API; Responses and Image API are relevant for text/tool and image-generation workflows. | User-supplied API key; optional organization/project headers when required by the account. | Provider ID, model ID, image API choice, output size/quality, and tool options must be data/config, not hardcoded required defaults. | Mock tests only by default; live diagnostics require explicit opt-in, configured credential, and cost confirmation. |
| Anthropic Claude | Native Claude API uses Anthropic request/auth shapes; Messages API and rate-limit metadata must be treated separately from OpenAI-compatible adapters. | User-supplied API key or Workload Identity Federation in environments that support it. | Claude model IDs and rate-limit group behavior must be configurable and refreshable from provider metadata. | Mock tests only by default; no Claude request in CI or normal validation. |
| Kimi / Moonshot | Kimi Open Platform documents OpenAI Chat Completions compatibility at `https://api.moonshot.ai/v1`. | User-supplied Moonshot API key. | Use a provider profile with configurable base URL and model IDs. Do not assume every OpenAI feature exists. | Mock tests only by default; live diagnostics require explicit user opt-in. |
| DeepSeek | DeepSeek documents OpenAI/Anthropic-compatible formats and bearer auth. | User-supplied DeepSeek API key. | Model names and deprecation dates must be provider metadata; no pinned required model string in source. | Mock tests only by default; live diagnostics require explicit user opt-in and disclosure review. |
| MiniMax | MiniMax documents account/API-key prerequisites, modality support, and OpenAI-compatible plus Anthropic-compatible endpoint options. | User-supplied MiniMax API or subscription key. | Protocol, base URL, modality support, and model IDs must be configurable; deprecated endpoints must not be selected as required defaults. | Mock tests only by default; live diagnostics require explicit user opt-in. |
| OpenCode | OpenCode is an adapter/tooling workflow, not a runtime provider. It can connect many providers and custom OpenAI-compatible endpoints. | OpenCode-managed credentials are outside project JSON and must not be copied into the repo. | Project may store adapter preferences only; provider credentials and selected model IDs must remain user-controlled. | No OpenCode execution in normal validation; optional diagnostics only after user approval. |
| Custom OpenAI-compatible endpoint | Treat as user-defined HTTP provider with an OpenAI-style contract only after validation. | User-supplied base URL and key. | Capabilities must be declared and contract-tested per endpoint; no assumptions about images, tools, streaming, or retention. | Mock tests only by default; live diagnostics require explicit user opt-in. |

## Credential Policy Baseline

- The native runtime must never read provider credentials.
- Provider credentials must never be stored in project JSON, committed repo
  files, docs, screenshots, validation logs, runtime logs, or generated
  manifests.
- Before CP-058 chooses a desktop-safe credential policy, provider credentials
  are considered unavailable.
- Environment variables may be used only for explicit local diagnostics and
  must be redacted from logs.
- Provider settings may store provider IDs, display names, base URLs,
  capability metadata, model IDs selected by the user, and opt-in state.
- Provider settings must not ship with connected defaults, required model
  defaults, fake last-tested timestamps, or mock connection success states.
- The current `src/stores/providerStore.ts` baseline starts all providers
  disconnected, leaves model strings empty, disables routing, and sets a zero
  default budget until the user configures providers.

## No-Live-API Default

Normal validation and CI must use:

- Unit tests against provider-neutral interfaces.
- Contract tests with checked-in sanitized fixtures.
- Mock adapters for success, timeout, cancellation, malformed response,
  provider error, rate limit, and quota cases.
- Cost and unknown-cost fixtures.
- Candidate asset/content fixtures that never require network access.

Live diagnostics are allowed only when all of these are true:

- The user explicitly requests the diagnostic for the current run.
- A credential exists through the approved credential storage path.
- The UI or command displays provider, model, estimated or unknown cost, and
  data that will be sent.
- The result is logged as a diagnostic, not as normal gate evidence.
- Secrets and request bodies are redacted from logs and Linear comments.

## Generated Asset Provenance

Any generated asset, character, animation, map draft, dialogue draft, or
database draft must remain a candidate until explicitly accepted by the user.
Candidate metadata must include:

- Provider family and provider profile ID.
- Model ID used for that job, when known.
- Prompt/config manifest.
- Source image, seed reference, or source data IDs when used.
- Request timestamp and user action that initiated the job.
- Cost estimate or `unknown`.
- Output file hashes and normalized dimensions/frames/anchors.
- QA result and accept/reject state.
- Terms/disclosure flags needed by the provider used for the job.

Accepted generated content must be editable and removable from the editor.
Generated output must never be silently imported into accepted project data.

## User Disclosure Requirements

- The editor must make provider-bound context explicit before sending data.
- Users must be told when a workflow can incur cost or has unknown cost.
- Users must be told when generated output may contain errors or omissions.
- Generated assets/content must retain visible provenance in the editor.
- Release docs must explain how to identify generated content and how to remove
  or replace it.
- For providers whose terms require end-user disclosure of AI-generated output,
  RPGCreatorAI must keep enough metadata for the creator to make that
  disclosure in shipped projects.

## Current Repo Conformance

- PASS: The runtime remains provider-independent and deterministic.
- PASS: Normal validation uses local tests and smoke scripts, not provider
  calls.
- PASS: CP-004 sanitized `src/stores/providerStore.ts` so provider profiles no
  longer start connected or with hardcoded required model strings.
- PASS: `src/stores/__tests__/providerStore.test.tsx` covers disconnected,
  secret-free, model-empty provider defaults.
- PASS: CP-057 exposes provider settings as editor-only availability metadata,
  removes the in-memory `apiKey` value from provider defaults, and renders no
  secret-value input or live provider action.
- OPEN: CP-058 must still choose and implement desktop-safe credential storage.
- OPEN: Provider Hub implementation issues must still add provider metadata,
  mock contract tests, opt-in UX, cost/rate-limit/error states, and live
  diagnostic gates.

## Downstream References

- Provider foundation issues must reference this baseline before adding any
  provider profile, model picker, credential UI, or generation queue.
- Asset generation issues must reference the provenance and disclosure
  requirements above.
- Security/cost issues CP-114 through CP-120 must re-check the no-secret,
  no-live-default, opt-in, cost, rate-limit, and failed-call rules.
- Final ship gates CP-126 through CP-128 must confirm no runtime dependency on
  AI, network, cloud, provider credentials, or live API calls.
