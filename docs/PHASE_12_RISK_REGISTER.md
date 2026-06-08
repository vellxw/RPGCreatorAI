# Phase 12 Risk Register

Issue: PX-009 / FRA-443
Date: 2026-06-08

## Scope And Sources

This register covers Phase 12 risks across product UX, provider UX, cost,
privacy, security, generated asset provenance, launch, validation, and
implementation workflow.

Sources reviewed:

- `docs/PHASE_11_RISK_REGISTER.md`
- `docs/PHASE_11_PROVIDER_LEGAL_BASELINE.md`
- `docs/PRIVACY_COST_POLICY.md`
- `docs/SECURITY_THREAT_MODEL.md`
- `docs/PHASE_11_CREDENTIAL_STORAGE_POLICY.md`
- `docs/PHASE_11_COST_RATE_LIMIT_BUDGET_STATES.md`
- `docs/PHASE_11_RELEASE_ARTIFACT_POLICY.md`
- `docs/GENERATED_ASSET_QUALITY_AUDIT.md`
- `docs/ERROR_RECOVERY.md`
- `docs/DIAGNOSTICS.md`
- `docs/PHASE_12_CREATOR_FIRST_AI_UX_PRINCIPLES.md`
- `docs/PHASE_12_ROADMAP_SUCCESS_METRICS.md`
- `docs/PHASE_12_AI_PIPELINE_INVENTORY.md`
- `docs/PHASE_12_ASSET_ANIMATION_PIPELINE_INVENTORY.md`
- `docs/PHASE_12_PHASE_11_BASELINE_VERIFICATION.md`

No secrets, `.env` files, provider credential stores, live provider endpoints,
or paid APIs were inspected.

## Scoring

- Severity: Critical, High, Medium, Low.
- Likelihood: High, Medium, Low.
- Owner milestone: primary Phase 12 milestone expected to mitigate or re-check
  the risk.
- Stop condition: the agent must stop if the condition is reached and cannot
  be handled safely inside repo-local work.

## Register

| ID | Risk | Severity | Likelihood | Owner milestone | Mitigation | Validation evidence | Stop condition |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P12-R001 | Phase 12 UI work blocks normal creation behind AI/provider setup. | Critical | Medium | M01, M02, M07 | Keep open/create/save/validate/playtest available with all providers disabled; make Local/mock first-run path explicit. | Startup/onboarding tests, no-provider AI Studio tests, screenshots, M01/M02/M07 gates. | Yes, if a required flow cannot run without credentials. |
| P12-R002 | Provider/model infrastructure leaks into beginner surfaces and undermines creator-first UX. | High | High | M04 | Put `Recommended`, `Fast/cheap`, `Best quality`, `Local/mock`, and `Custom advanced` before provider cards; move raw provider settings behind advanced mode. | Copy tests, screenshot evidence, accessibility checks, M04 integration gate. | No. |
| P12-R003 | Runtime starts depending on AI providers, network, credentials, or editor-only generation history. | Critical | Low | M00, M02, M03, M05, M12 | Preserve native runtime data-only boundary; route AI work through editor candidates and accepted local data. | C++ tests, runtime smoke, no runtime provider imports/calls, final gate review. | Yes, if a product decision would make runtime AI/network/cloud dependent. |
| P12-R004 | Provider credentials, API keys, bearer values, or app-data credential blobs leak into project JSON, docs, logs, screenshots, Linear comments, or commits. | Critical | Medium | M04, M05, M06, M12 | Keep DPAPI/app-data credential boundary, use redaction, scan edited/staged files, never read `.env` or credential blobs. | Secret-like scans, redaction tests, credential bridge tests, staged diff review. | Yes, if a real secret is found or credentials are required. |
| P12-R005 | Normal validation accidentally makes live paid provider calls. | Critical | Medium | M02, M03, M04, M08, M10, M12 | Use mocks, fixtures, mocked HTTP, and offline scripts; treat live diagnostics as outside normal validation. | Mock contract tests, adapter mocked HTTP tests, validation log evidence, no credential reads. | Yes, before any live paid provider call. |
| P12-R006 | Cost, quota, or rate-limit behavior surprises users or causes duplicate work. | High | Medium | M04, M10 | Show action-level cost/unknown-cost and budget gates; preserve queue context; use idempotency/write-intent guards. | Cost panel tests, queue tests, refinement guardrail tests, rate-limit/quota fixtures. | Yes, before unconfirmed paid or unknown-cost execution. |
| P12-R007 | Provider API/model/capability assumptions become stale or hardcoded into UX promises. | High | Medium | M04, M08 | Treat provider metadata as configurable; separate provider research from app-supported operations; avoid exact pricing/model promises unless validated. | Provider registry tests, M08 capability matrix, docs review. | Yes, if current provider terms/API changes require product/legal decision. |
| P12-R008 | Provider-bound context overshares private project data. | High | Medium | M02, M03, M04, M06 | Send only selected prompt and scoped records/assets for explicit actions; never include runtime saves/logs/snapshots, whole-project dumps by default, or unrelated files. | Context summary tests, router fixtures, redaction tests, security checklist. | Yes, if private external transmission would occur without explicit opt-in. |
| P12-R009 | Failed, malformed, rejected, or partial AI output mutates accepted project data. | Critical | Medium | M03, M05, M10 | All AI outputs are candidates; validation and explicit accept required before reducers/loaders write accepted data. | No-silent-mutation tests, candidate lifecycle tests, failed-provider fixtures, M05 gate. | No, unless data corruption risks user data outside repo. |
| P12-R010 | Candidate provenance is incomplete, making generated outputs unauditable. | High | Medium | M05, M08, M10, M11 | Store safe provider/mode/pipeline/provenance metadata, prompt template ids, QA state, timestamps, and accepted output links without secrets. | Provenance tests, generation history tests, asset catalog metadata checks. | Yes, if legal/provider terms require user decision. |
| P12-R011 | Generated asset legal/licensing/disclosure assumptions are wrong. | High | Medium | M08, M12 | Research provider terms before expanding real generation paths; keep generated assets editable/removable and provenance-visible. | M08 research docs, capability matrix, legal notes, final docs review. | Yes, if provider terms or licensing require user approval. |
| P12-R012 | Generated asset or animation quality is visibly poor, inconsistent, or runtime-incompatible. | High | Medium | M09, M10, M11 | Use deterministic rubrics, accepted/rejected fixtures, preview evidence, normalization, runtime BMP export validation, and `GAME_VISUAL_DESIGN.md`. | Fixture tests, Python pipeline tests, visual QA docs, runtime manifest validation, screenshots. | No. |
| P12-R013 | Multi-round refinement loops run too long, repeat bad candidates, or bypass cost/review guardrails. | High | Medium | M10 | Bound iterations, require planner/checker/verifier outputs, enforce budget confirmation, and send all outputs to review inbox. | Loop tests, cost guardrail tests, queue tests, review inbox integration. | Yes, before unbounded live or paid execution. |
| P12-R014 | Developer Mode code assistance mutates source, runs unsafe tools, commits, pushes, or accesses external paths. | Critical | Medium | M06 | Require explicit Developer Mode gate; keep OpenCode adapter as safe handoff/diff proposal; deny direct execution and external dirs by default. | Developer Mode tests, OpenCode handoff tests, no-commit/no-push assertions, path safety tests. | Yes, if source mutation or external command execution requires user approval. |
| P12-R015 | Launcher/startup/package polish regresses app launch or runtime discovery. | High | Medium | M01, M12 | Verify desktop entry, splash phases, runtime lookup, branding, Tauri content, and packaged smoke where scoped. | Startup tests, branding script, Tauri content checks, runtime launch smoke, M01/M12 gates. | Yes, if admin install, signing credentials, or package account credentials are required. |
| P12-R016 | App-data, diagnostics, playtest sessions, screenshots, or generated outputs accumulate unsafe files or risk deleting user data. | High | Medium | M01, M07, M12 | Keep bounded app-data policies, temp-session pruning, non-destructive cleanup docs, and repo-staging hygiene. | Diagnostics tests, smoke output review, `git status --short`, no generated outputs staged. | Yes, before deleting/overwriting user data outside repo. |
| P12-R017 | Browser/desktop capability differences are hidden, causing fake success or broken workflows. | Medium | High | M01, M04, M07 | Keep browser mode honest for filesystem, credentials, runtime launch, diagnostics, and app-data features. | Browser/desktop tests, unavailable-state copy tests, startup/onboarding screenshots. | No. |
| P12-R018 | Visual/product UI changes drift from `docs/GAME_VISUAL_DESIGN.md` or create unreadable layouts. | Medium | Medium | M01, M02, M04, M05, M07, M11, M12 | Use visual design doc as source of truth; capture screenshots for visual issues; test text overflow/accessibility where relevant. | Screenshot evidence, accessibility tests, visual QA checks, final screenshot audit. | No. |
| P12-R019 | Validation is too narrow, flaky, or not recorded, allowing regressions to ship. | High | Medium | Every milestone, M12 | Use focused validation per issue, full gates at integration milestones, and append failures/fixes to validation log. | `docs/VALIDATION_LOG.md`, exact commands/results, gate reports. | No, unless external tooling is repeatedly unavailable. |
| P12-R020 | Linear/GitHub/tooling failures cause skipped issues, batch closing, or missing evidence. | High | Medium | M00, M12 | Work strictly sequentially, read each issue, comment evidence, move Done only after validation; retry transient failures. | Linear history, issue comments, commit hashes, status checks. | Yes, if Linear cannot read/comment/update after reasonable retries. |
| P12-R021 | Dirty worktree residue or unrelated user changes get staged or pushed. | Critical | Medium | Every milestone | Review `git status --short`, staged diff, and file list before every commit; stage only issue-scoped files; never stage `.commandcode/`, `output/`, build artifacts, or secrets. | Staged diff review, commit file list, final git status. | Yes, if remote is wrong or a secret/unrelated destructive change is staged. |
| P12-R022 | Docs/phase state drifts from actual implementation and misleads future agents. | Medium | High | M00, M12 | Update docs with reality, not intent; record known limitations and skipped validations; keep GOAL_STACK and roadmap current. | Docs review, placeholder scans, validation log, integration gates. | No. |
| P12-R023 | Asset research or provider recommendations rely on unsourced, stale, or unverifiable external claims. | High | Medium | M08 | Browse official/current sources when provider facts are unstable; cite source dates; distinguish provider claims from implemented app behavior. | Research docs with links/dates, capability matrix review. | Yes, if required source access or legal decision is unavailable. |
| P12-R024 | First-run onboarding overpromises AI-generated starters before safe mock/provider flows exist. | Medium | Medium | M07 | Offer sample/blank/local mock starters first; provider-backed starter generation must be review-gated and cost/context disclosed. | Onboarding tests, mock starter tests, provider-disabled tests, screenshots. | No. |

## Stop Conditions

Stop and report before proceeding if any of these occur:

- A real provider credential, OAuth/login, API key, account setup, or secret is
  required.
- A live paid or unknown-cost provider call would be needed.
- The git remote is not `https://github.com/vellxw/RPGCreatorAI.git`.
- A staged diff includes secrets, `.env`, `.commandcode/`, generated binaries,
  build artifacts, or unrelated user changes.
- An action would delete or overwrite user data outside this repository.
- Installer signing, publisher identity, store upload, admin install, or
  external release credentials are required.
- A product/architecture decision would make the native runtime depend on AI,
  network, cloud services, credentials, marketplace systems, or arbitrary
  scripting.
- Linear cannot read, comment, or update the current issue after reasonable
  retry/backoff attempts.

## Escalation Triggers

Escalate to the user for a decision when:

- Provider terms, asset licensing, generated-content disclosure, or data
  retention requirements require product/legal approval.
- A live diagnostic is explicitly desired and credentials/cost exposure are
  unavoidable.
- A risk mitigation would materially change Phase 12 product direction or
  runtime architecture.
- Required validation depends on a system/admin install that cannot be handled
  repo-locally.
- A safe fix requires touching unrelated user-authored changes.

## Required Risk Checks By Milestone

| Milestone | Must re-check |
| --- | --- |
| M00 | P12-R019, P12-R020, P12-R021, P12-R022 |
| M01 | P12-R001, P12-R015, P12-R016, P12-R017, P12-R018 |
| M02 | P12-R001, P12-R003, P12-R005, P12-R008, P12-R018 |
| M03 | P12-R005, P12-R008, P12-R009, P12-R019 |
| M04 | P12-R002, P12-R004, P12-R006, P12-R007, P12-R017 |
| M05 | P12-R009, P12-R010, P12-R012 |
| M06 | P12-R004, P12-R008, P12-R014, P12-R021 |
| M07 | P12-R001, P12-R016, P12-R017, P12-R024 |
| M08 | P12-R007, P12-R011, P12-R023 |
| M09 | P12-R010, P12-R012, P12-R018 |
| M10 | P12-R006, P12-R009, P12-R013 |
| M11 | P12-R010, P12-R012, P12-R018 |
| M12 | All Critical and High risks, plus any unresolved Medium risks from gate reports |

## Result

Phase 12 can proceed only as a local-first, review-gated, evidence-driven
product UX phase. The highest-risk areas are runtime independence, credential
and secret handling, live paid provider avoidance, candidate provenance,
generated asset legality/quality, Developer Mode safety, launch/package
reliability, and strict Linear/Git validation discipline.
