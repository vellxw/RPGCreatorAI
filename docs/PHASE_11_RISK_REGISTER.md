# Phase 11 Risk Register

CP-003 / FRA-38 records the starting risk register for the complete product
platform. It is based on the Phase 11 charter, CP-002 product surface audit,
Linear project documents, and Phase 10 MVP validation report.

This document is a planning control. It does not approve live provider calls,
credential storage, installer signing, or destructive project operations.

## Source Inputs

- `docs/PHASE_11_PRODUCT_CHARTER.md`
- `docs/PHASE_11_PRODUCT_SURFACE_AUDIT.md`
- `docs/PHASE_10_MVP_VALIDATION_REPORT.md`
- `docs/GOAL_STACK.md`
- Linear document: Product Scope And Execution Rules
- Linear document: AI Provider Hub Policy
- Linear document: Asset Generation And Audit Rubric
- Linear document: Validation And Release Runbook

## Scoring

- Severity: Critical, High, Medium, Low.
- Likelihood: High, Medium, Low.
- Stop condition: Yes means the agent must stop if the condition is reached
  and cannot be handled safely inside the repo without user action.

## Register

| ID | Risk | Severity | Likelihood | Owner issue category | Mitigation | Stop condition |
| --- | --- | --- | --- | --- | --- | --- |
| R-001 | Unexpected remote, staged secrets, or unrelated generated artifacts are pushed. | Critical | Low | CP-006, CP-008, CP-120, CP-128 | Check `git remote -v`, `git status --short`, and staged diff before every commit; never stage `.env`, build output, binaries, or unrelated untracked files. | Yes, if remote is not `https://github.com/vellxw/RPGCreatorAI.git` or secrets are present. |
| R-002 | Packaged app cannot locate or launch the native runtime. | High | Medium | CP-009, CP-010, CP-016 | Define runtime embedding/discovery policy, test packaged launch, keep browser unavailable states honest. | No, unless packaging requires system/admin install. |
| R-003 | Installer strategy requires signing credentials or external release accounts. | High | Medium | CP-011, CP-122, CP-128 | Document unsigned local artifact policy first; separate future signing from local validation. | Yes, if signing certificates, store accounts, or credentials are required. |
| R-004 | OneDrive or workspace path locking breaks native/desktop builds. | High | Medium | CP-009, CP-013, CP-007 | Keep build/cache output under bounded app-data or configured build dirs; keep PowerShell and `.bat` helpers aligned. | No, unless an admin/system install is required. |
| R-005 | First-run directories, playtest sessions, logs, and temp files confuse users or accumulate unsafe data. | High | Medium | CP-013, CP-014, CP-017 | Document app data locations, bound logs/snapshots, prune temp sessions, expose diagnostics folder actions. | No, unless cleanup would delete user data outside repo. |
| R-006 | Project save, export, import, or playtest session flow mutates source data unexpectedly. | High | Medium | CP-017, CP-018, CP-019, CP-107 | Preserve backup and temp-session boundaries, add roundtrip tests, keep destructive operations explicit and recoverable. | Yes, if an operation may overwrite user data outside the repo. |
| R-007 | Runtime determinism regresses as editor, asset, or provider systems grow. | Critical | Medium | 04 Runtime Feature Completeness, CP-115, CP-128 | Keep runtime provider-independent, data-driven, locally validated, and covered by C++ tests plus runtime smoke. | Yes, if a product decision would make runtime depend on AI/network/cloud. |
| R-008 | Validation gates become slow, flaky, or narrower than the behavior being changed. | High | Medium | CP-007, CP-008, 13 QA Automation And Regression | Use focused checks for small issues, full `scripts/dev/verify.ps1` at gates, and record exact commands/results. | No. |
| R-009 | Placeholder or inactive UI implies features exist when they are missing. | Medium | High | CP-025, CP-099, CP-101 | Replace placeholders with working controls, disabled states, or honest copy; keep AI surfaces hidden until policy is implemented. | No. |
| R-010 | Docs drift from implemented behavior and cause users or agents to run wrong commands. | Medium | High | CP-005, CP-121, CP-122, CP-123, CP-124 | Update docs in the same issue that changes behavior; execute documented commands before claiming them. | No. |
| R-011 | API keys or provider credentials leak into project JSON, logs, screenshots, docs, or git. | Critical | Medium | CP-004, CP-058, CP-114, CP-115, CP-120 | Choose desktop-safe credential storage, redact logs, scan staged files, and keep project data credential-free. | Yes, if credentials are required or a secret is found. |
| R-012 | Normal validation accidentally performs live paid AI calls. | Critical | Medium | CP-004, CP-116, CP-117, CP-120 | Make mocks and fixtures mandatory for tests/CI; require explicit live diagnostic opt-in and credential presence. | Yes, before any live paid provider call. |
| R-013 | Provider APIs, models, limits, or compatibility assumptions are hardcoded and become stale. | High | Medium | CP-004, 07 AI Provider Hub Foundation, 11 Multi-Provider Integrations | Store provider IDs, models, base URLs, capabilities, and limits as data/config; add contract fixtures. | No, unless current official docs or credentials are required and unavailable. |
| R-014 | Cost, quota, or rate-limit behavior surprises users or loses work. | High | Medium | CP-117, CP-118, CP-119 | Show known/unknown cost before jobs, normalize rate limits, preserve prompts and candidates, provide safe retry/cancel. | Yes, before paid live execution without explicit permission. |
| R-015 | Failed AI calls or malformed provider responses write corrupt assets/content into accepted project data. | High | Medium | CP-077, CP-080, CP-088, CP-119 | Stage all generated output as candidates/drafts, validate schema/assets before accept, keep failed output recoverable. | No. |
| R-016 | Generated content lacks provenance, audit evidence, or legal review. | High | Medium | CP-004, CP-049, CP-083, CP-124 | Require prompt/config manifests, source references, dimensions, QA screenshots/previews, and removable candidate states. | Yes, if legal/provider terms require user decision. |
| R-017 | Imported/generated assets have wrong dimensions, transparency, anchors, frames, metadata, or runtime references. | High | Medium | CP-049, 06 Asset Library And Import Pipeline, 08 GPT Image 2 Asset Pipeline, 09 AI Characters And Animations | Normalize assets, validate metadata, generate previews, run visual/runtime export checks, and test broken reference paths. | No. |
| R-018 | Asset generation silently accepts low-quality or mismatched visual style. | Medium | Medium | CP-083, CP-099, CP-124 | Enforce `docs/GAME_VISUAL_DESIGN.md`, asset audit rubric, preview review, and explicit accept/reject workflow. | No. |
| R-019 | Database/schema expansion breaks editor/runtime loader compatibility. | High | Medium | CP-041, 05 Database/System Completeness, CP-128 | Add TypeScript validation, Tauri roundtrip, C++ loader coverage, migration rules, and reference-safe delete/rename tests. | No. |
| R-020 | Sample project remains too small to prove complete-platform workflows. | Medium | High | CP-125 | Expand sample data only with local, legally independent content that exercises editor, runtime, assets, AI-mock, and packaging paths. | No. |
| R-021 | Missing persistent design context causes inconsistent visual/UX audit outcomes. | Medium | Medium | CP-025, CP-099, CP-101 | Create or document project design guidance before major UI audit passes; verify with screenshots where visual behavior changes. | No. |
| R-022 | Logs, diagnostics, prompt history, or provider requests expose private project context. | High | Medium | CP-014, CP-114, CP-115, CP-120 | Bound logs, redact secrets, document local/provider data boundaries, and keep provider-bound context opt-in. | Yes, if private external transmission would occur without explicit opt-in. |
| R-023 | Release artifacts include generated binaries, caches, private app data, or non-release evidence. | High | Low | CP-011, CP-016, CP-120, CP-128 | Define artifact naming/storage policy, inspect release folders, and keep generated build output unstaged. | Yes, if artifact creation would overwrite user data outside repo. |
| R-024 | Issue-by-issue execution loses continuity across long runs. | Medium | Medium | CP-005, CP-006, CP-127 | Maintain repo-tracked backlog, task files, validation log, Linear comments, and commit-per-issue evidence. | No. |

## Stop And User-Decision Triggers

The agent must stop and ask the user before proceeding if any task requires:

- Provider credentials, OAuth, API keys, or account login.
- Live paid calls to OpenAI, Anthropic Claude, Kimi/Moonshot, DeepSeek,
  MiniMax, OpenCode-backed services, custom endpoints, or similar providers.
- Installer signing certificates, store accounts, or external release
  credentials.
- Destructive overwrite/delete outside this repository.
- Runtime dependency on AI, network, cloud, marketplace systems, or arbitrary
  scripting.
- Remote origin different from `https://github.com/vellxw/RPGCreatorAI.git`.

## Required Controls For Downstream Issues

- Provider issues must reference R-011 through R-015 and R-022.
- Asset generation/import issues must reference R-015 through R-018.
- Release hardening and packaging issues must reference R-001 through R-005 and
  R-023.
- Runtime and database issues must reference R-007 and R-019.
- Final QA and ship gates must re-check every Critical and High risk that is
  still open.
