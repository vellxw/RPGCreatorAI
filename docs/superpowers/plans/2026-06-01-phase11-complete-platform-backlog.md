# Phase 11 Complete Platform Backlog Source

Captured from Linear project `RPGCreatorAI Complete Product Platform` on
2026-06-01 19:12:09 -03:00.

This file is the repo-tracked continuation source for CP-001 through CP-128
(`FRA-36` through `FRA-163`). Linear remains the live status source, but this
document preserves the complete milestone/issue map so future agents can
continue issue-by-issue without chat memory.

## Execution Rules

- Work in CP order: CP-001, CP-002, ... CP-128.
- For every issue, fetch the Linear issue before implementation and follow its
  exact validation section.
- Move each Linear issue to In Progress before work, comment start, implement,
  validate, update docs/logs, commit, push, comment results, then move Done.
- Do not rely on live AI providers for normal validation. Use mocks, fixtures,
  and contract tests unless a user explicitly authorizes live diagnostics.
- Do not let native runtime behavior depend on AI, network, cloud, provider
  credentials, marketplace systems, or arbitrary scripting.
- Stop for credentials, OAuth/login, signing certificates, admin installs,
  destructive operations outside the repo, wrong remote origin, or material
  product-direction changes.

## Validation By Label

All issues must run `git diff --check` or `git diff --cached --check` before
commit. Additional gates are selected from issue scope and labels:

- `docs`: docs-only validation plus any commands claimed in docs.
- `qa`: focused tests or smoke checks that prove the changed behavior.
- `integration-gate`: run the canonical gate when applicable:
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1`.
- `desktop`: Rust/Tauri tests and desktop smoke where the issue changes shell
  behavior.
- `runtime`: native CMake/build/CTest and runtime smoke where runtime behavior
  changes.
- `editor`, `ux`, `database`: `npm run typecheck`, focused Vitest, and build
  if the issue changes frontend behavior.
- `assets`, `animation`, `gpt-image`, `visual-qa`: asset pipeline tests,
  visual QA evidence, and runtime export checks as appropriate.
- `ai-provider`, `provider-integrations`, `provider-mock`, `content-ai`,
  `security`: offline mock/contract tests; live provider diagnostics only with
  explicit user opt-in and configured credentials.

## Dependency Model

- CP-001 through CP-008 lock planning before implementation.
- Each milestone integration gate depends on the non-gate issues in the same
  milestone.
- Release/packaging issues CP-009 through CP-016 must complete before later
  UX flows depend on packaged behavior.
- AI/provider issues depend on CP-004 and the no-live-API policy.
- Asset generation issues depend on CP-049 through CP-056 asset library work
  and CP-057 through CP-064 provider hub foundation where provider behavior is
  involved.
- Security/privacy/cost issues CP-113 through CP-120 must be re-checked before
  docs/final ship issues CP-121 through CP-128.

## Milestones

| Milestone | Linear description | Issues |
| --- | --- | --- |
| 00 Planning And Scope Lock | Lock scope, risks, execution protocol, source docs, and the validation baseline before implementation. | CP-001..CP-008 |
| 01 Release Hardening And Packaging | Make the Windows desktop app buildable, packageable, identifiable, and supportable outside dev mode. | CP-009..CP-016 |
| 02 End-To-End Usability | Ensure a user can use the app from create/open through save, validate, playtest, debug, and recover from errors. | CP-017..CP-024 |
| 03 Professional Editor Surface | Polish primary editor surfaces to a professional, repeatable authoring standard. | CP-025..CP-032 |
| 04 Runtime Feature Completeness | Close runtime command, menu, battle, audio, plugin, save/load, and diagnostics gaps. | CP-033..CP-040 |
| 05 Database/System Completeness | Complete schema, editor, validation, reference repair, and database authoring quality. | CP-041..CP-048 |
| 06 Asset Library And Import Pipeline | Build import, cataloging, metadata, optimization, and export workflows for project assets. | CP-049..CP-056 |
| 07 AI Provider Hub Foundation | Introduce optional provider settings, credentials, queues, capabilities, costs, mocks, and tests. | CP-057..CP-064 |
| 08 GPT Image 2 Asset Pipeline | Add configurable GPT Image-capable generation/editing workflows for image assets. | CP-065..CP-072 |
| 09 AI Characters And Animations | Generate, normalize, preview, validate, and runtime-export characters and animation sets. | CP-073..CP-080 |
| 10 AI Game Content Pipelines | Draft and validate maps, quests, events, databases, balancing, and repair suggestions with AI. | CP-081..CP-088 |
| 11 Multi-Provider Integrations | Add concrete adapters for major providers and custom OpenAI-compatible endpoints. | CP-089..CP-096 |
| 12 Continuous Visual/UX Audits | Run recurring screenshot, accessibility, copy, asset, and regression audits between implementation streams. | CP-097..CP-104 |
| 13 QA Automation And Regression | Expand automated verification for frontend, runtime, desktop, AI mocks, assets, and roundtrip flows. | CP-105..CP-112 |
| 14 Security Privacy And Cost Controls | Protect secrets, local data boundaries, opt-in provider behavior, costs, rate limits, and failure recovery. | CP-113..CP-120 |
| 15 Docs Examples And Final Ship | Complete docs, samples, validation report, Linear closeout, and final release handoff. | CP-121..CP-128 |

## Complete Issue Map

Common labels on every issue: `phase-11`, `complete-platform`.

| CP | Linear | Title | Milestone | Specific labels |
| --- | --- | --- | --- | --- |
| CP-001 | FRA-36 | Product Charter And Phase 11 Scope Lock | 00 Planning And Scope Lock | planning, parallel-safe, docs |
| CP-002 | FRA-37 | Full Repo And Product Surface Audit | 00 Planning And Scope Lock | audit, planning, parallel-safe |
| CP-003 | FRA-38 | Complete Platform Risk Register | 00 Planning And Scope Lock | security, planning, parallel-safe |
| CP-004 | FRA-39 | Provider And Legal Review Baseline | 00 Planning And Scope Lock | security, ai-provider, planning, parallel-safe |
| CP-005 | FRA-40 | Complete Platform Backlog Source Document | 00 Planning And Scope Lock | planning, parallel-safe, docs |
| CP-006 | FRA-41 | Phase 11 Execution Protocol And Branch Rules | 00 Planning And Scope Lock | planning, parallel-safe, docs |
| CP-007 | FRA-42 | Phase 11 Validation Baseline | 00 Planning And Scope Lock | planning, parallel-safe, qa |
| CP-008 | FRA-43 | Planning Integration Gate | 00 Planning And Scope Lock | planning, integration-gate, qa |
| CP-009 | FRA-44 | Windows Dev Build Reliability | 01 Release Hardening And Packaging | packaging, parallel-safe, desktop |
| CP-010 | FRA-45 | Windows Packaged Build Prototype | 01 Release Hardening And Packaging | packaging, parallel-safe, desktop |
| CP-011 | FRA-46 | Installer Strategy And Release Artifact Policy | 01 Release Hardening And Packaging | release-readiness, packaging, parallel-safe |
| CP-012 | FRA-47 | App Icon And Release Branding Assets | 01 Release Hardening And Packaging | assets, packaging, parallel-safe |
| CP-013 | FRA-48 | First-Run Directories And Local App Data Policy | 01 Release Hardening And Packaging | security, packaging, parallel-safe, desktop |
| CP-014 | FRA-49 | Crash Log And Diagnostics Location | 01 Release Hardening And Packaging | packaging, parallel-safe, qa |
| CP-015 | FRA-50 | Build Run And Packaging Docs Refresh | 01 Release Hardening And Packaging | packaging, parallel-safe, docs |
| CP-016 | FRA-51 | Packaging Integration Gate | 01 Release Hardening And Packaging | packaging, integration-gate, qa |
| CP-017 | FRA-52 | Open And Create Project Flow | 02 End-To-End Usability | editor, ux, parallel-safe |
| CP-018 | FRA-53 | Save And Validate User Flow Polish | 02 End-To-End Usability | editor, ux, parallel-safe, qa |
| CP-019 | FRA-54 | Project Start Playtest Flow | 02 End-To-End Usability | runtime, ux, parallel-safe |
| CP-020 | FRA-55 | Current Map Playtest Flow | 02 End-To-End Usability | runtime, ux, parallel-safe |
| CP-021 | FRA-56 | Selected Event Playtest Flow | 02 End-To-End Usability | runtime, ux, parallel-safe |
| CP-022 | FRA-57 | Error Recovery And User-Safe Failure States | 02 End-To-End Usability | security, ux, parallel-safe |
| CP-023 | FRA-58 | Empty States And First-Time Guidance | 02 End-To-End Usability | editor, ux, parallel-safe |
| CP-024 | FRA-59 | End-To-End Usability Integration Gate | 02 End-To-End Usability | ux, integration-gate, qa |
| CP-025 | FRA-60 | Primary Navigation Polish | 03 Professional Editor Surface | editor, ux, parallel-safe |
| CP-026 | FRA-61 | Map Tree Workflow Polish | 03 Professional Editor Surface | editor, ux, parallel-safe |
| CP-027 | FRA-62 | Map Properties Polish | 03 Professional Editor Surface | database, editor, parallel-safe |
| CP-028 | FRA-63 | Tile Palette And Brush Workflow Polish | 03 Professional Editor Surface | assets, editor, parallel-safe |
| CP-029 | FRA-64 | Layer Workflow Polish | 03 Professional Editor Surface | visual-qa, editor, parallel-safe |
| CP-030 | FRA-65 | Event Editor Surface Polish | 03 Professional Editor Surface | runtime, editor, parallel-safe |
| CP-031 | FRA-66 | Database Navigation And Large List Polish | 03 Professional Editor Surface | database, editor, parallel-safe |
| CP-032 | FRA-67 | Professional Editor Surface Integration Gate | 03 Professional Editor Surface | editor, integration-gate, qa |
| CP-033 | FRA-68 | Runtime Command Gap Audit | 04 Runtime Feature Completeness | audit, runtime, parallel-safe |
| CP-034 | FRA-69 | Runtime Menu Flow Polish | 04 Runtime Feature Completeness | runtime, ux, parallel-safe |
| CP-035 | FRA-70 | Battle Authoring Runtime Gap Closure | 04 Runtime Feature Completeness | database, runtime, parallel-safe |
| CP-036 | FRA-71 | Audio Authoring Runtime V1 | 04 Runtime Feature Completeness | assets, runtime, parallel-safe |
| CP-037 | FRA-72 | Deterministic Plugin Command Registry V2 | 04 Runtime Feature Completeness | security, runtime, parallel-safe |
| CP-038 | FRA-73 | Save Load UX And Runtime Slot Polish | 04 Runtime Feature Completeness | runtime, ux, parallel-safe |
| CP-039 | FRA-74 | Runtime Diagnostics And Developer Overlay | 04 Runtime Feature Completeness | runtime, parallel-safe, qa |
| CP-040 | FRA-75 | Runtime Feature Completeness Integration Gate | 04 Runtime Feature Completeness | runtime, integration-gate, qa |
| CP-041 | FRA-76 | Database Schema Gap Audit | 05 Database/System Completeness | audit, database, parallel-safe |
| CP-042 | FRA-77 | Actor Class And Skill Editor Polish | 05 Database/System Completeness | database, editor, parallel-safe |
| CP-043 | FRA-78 | Enemy And Troop Editor Polish | 05 Database/System Completeness | database, editor, parallel-safe |
| CP-044 | FRA-79 | Item Equipment And State Editor Polish | 05 Database/System Completeness | database, editor, parallel-safe |
| CP-045 | FRA-80 | System Types And Terms Polish | 05 Database/System Completeness | database, ux, parallel-safe |
| CP-046 | FRA-81 | Common Event Authoring Polish | 05 Database/System Completeness | database, runtime, parallel-safe |
| CP-047 | FRA-82 | Reference Repair Tools | 05 Database/System Completeness | database, parallel-safe, qa |
| CP-048 | FRA-83 | Database/System Completeness Integration Gate | 05 Database/System Completeness | database, integration-gate, qa |
| CP-049 | FRA-84 | Asset Catalog V2 | 06 Asset Library And Import Pipeline | assets, editor, parallel-safe |
| CP-050 | FRA-85 | Image Import Workflow | 06 Asset Library And Import Pipeline | assets, editor, parallel-safe |
| CP-051 | FRA-86 | Spritesheet Import Workflow | 06 Asset Library And Import Pipeline | animation, assets, parallel-safe |
| CP-052 | FRA-87 | Audio Import Workflow | 06 Asset Library And Import Pipeline | assets, runtime, parallel-safe |
| CP-053 | FRA-88 | Tileset Import Workflow | 06 Asset Library And Import Pipeline | assets, database, parallel-safe |
| CP-054 | FRA-89 | Asset Metadata Editor | 06 Asset Library And Import Pipeline | assets, editor, parallel-safe |
| CP-055 | FRA-90 | Asset Optimization And Runtime Export | 06 Asset Library And Import Pipeline | assets, runtime, parallel-safe |
| CP-056 | FRA-91 | Asset Library Integration Gate | 06 Asset Library And Import Pipeline | assets, integration-gate, qa |
| CP-057 | FRA-92 | Provider Settings UI | 07 AI Provider Hub Foundation | ai-provider, editor, parallel-safe |
| CP-058 | FRA-93 | Credential Storage Policy And Implementation | 07 AI Provider Hub Foundation | security, ai-provider, parallel-safe |
| CP-059 | FRA-94 | AI Request Queue And Cancellation | 07 AI Provider Hub Foundation | ai-provider, ux, parallel-safe |
| CP-060 | FRA-95 | Provider Registry And Adapter Interface | 07 AI Provider Hub Foundation | provider-integrations, ai-provider, parallel-safe |
| CP-061 | FRA-96 | Model Capability Registry | 07 AI Provider Hub Foundation | provider-integrations, ai-provider, parallel-safe |
| CP-062 | FRA-97 | Cost Rate Limit And Budget States | 07 AI Provider Hub Foundation | security, ai-provider, parallel-safe |
| CP-063 | FRA-98 | Mocked Provider Contract Test Suite | 07 AI Provider Hub Foundation | provider-mock, ai-provider, parallel-safe, qa |
| CP-064 | FRA-99 | AI Provider Hub Foundation Integration Gate | 07 AI Provider Hub Foundation | ai-provider, integration-gate, qa |
| CP-065 | FRA-100 | GPT Image Model Configuration | 08 GPT Image 2 Asset Pipeline | gpt-image, ai-provider, parallel-safe |
| CP-066 | FRA-101 | Image Prompt Template Library | 08 GPT Image 2 Asset Pipeline | gpt-image, assets, parallel-safe |
| CP-067 | FRA-102 | AI Tileset Generation Workflow | 08 GPT Image 2 Asset Pipeline | gpt-image, assets, parallel-safe |
| CP-068 | FRA-103 | AI Item Icon Generation Workflow | 08 GPT Image 2 Asset Pipeline | gpt-image, assets, parallel-safe |
| CP-069 | FRA-104 | AI Portrait Generation Workflow | 08 GPT Image 2 Asset Pipeline | gpt-image, assets, parallel-safe |
| CP-070 | FRA-105 | Image Edit And Variation Workflow | 08 GPT Image 2 Asset Pipeline | gpt-image, assets, parallel-safe |
| CP-071 | FRA-106 | Generated Image Visual QA Scoring | 08 GPT Image 2 Asset Pipeline | visual-qa, audit, gpt-image, parallel-safe |
| CP-072 | FRA-107 | GPT Image Asset Pipeline Integration Gate | 08 GPT Image 2 Asset Pipeline | gpt-image, integration-gate, qa |
| CP-073 | FRA-108 | Character Concept Generator | 09 AI Characters And Animations | content-ai, animation, parallel-safe |
| CP-074 | FRA-109 | Sprite Sheet Generation Pipeline | 09 AI Characters And Animations | animation, gpt-image, parallel-safe |
| CP-075 | FRA-110 | Animation Strip Normalization | 09 AI Characters And Animations | animation, assets, parallel-safe |
| CP-076 | FRA-111 | Direction And Action Coverage Validator | 09 AI Characters And Animations | animation, parallel-safe, qa |
| CP-077 | FRA-112 | Preview GIF Generation | 09 AI Characters And Animations | visual-qa, animation, parallel-safe |
| CP-078 | FRA-113 | Runtime BMP Export For Generated Characters | 09 AI Characters And Animations | animation, runtime, parallel-safe |
| CP-079 | FRA-114 | Character Animation QA Review Surface | 09 AI Characters And Animations | visual-qa, audit, animation, parallel-safe |
| CP-080 | FRA-115 | AI Character Animation Integration Gate | 09 AI Characters And Animations | animation, integration-gate, qa |
| CP-081 | FRA-116 | AI Map Draft Generator | 10 AI Game Content Pipelines | content-ai, editor, parallel-safe |
| CP-082 | FRA-117 | AI Quest Generator | 10 AI Game Content Pipelines | content-ai, database, parallel-safe |
| CP-083 | FRA-118 | AI Event Command Generator | 10 AI Game Content Pipelines | content-ai, runtime, parallel-safe |
| CP-084 | FRA-119 | AI Database Draft Generator | 10 AI Game Content Pipelines | content-ai, database, parallel-safe |
| CP-085 | FRA-120 | AI Balancing Assistant | 10 AI Game Content Pipelines | content-ai, database, parallel-safe |
| CP-086 | FRA-121 | AI Validation Repair Assistant | 10 AI Game Content Pipelines | content-ai, parallel-safe, qa |
| CP-087 | FRA-122 | Prompt And Generation History | 10 AI Game Content Pipelines | content-ai, ai-provider, parallel-safe |
| CP-088 | FRA-123 | AI Game Content Pipeline Integration Gate | 10 AI Game Content Pipelines | content-ai, integration-gate, qa |
| CP-089 | FRA-124 | OpenAI Provider Adapter | 11 Multi-Provider Integrations | provider-integrations, ai-provider, parallel-safe |
| CP-090 | FRA-125 | Claude Provider Adapter | 11 Multi-Provider Integrations | provider-integrations, ai-provider, parallel-safe |
| CP-091 | FRA-126 | Kimi Provider Adapter | 11 Multi-Provider Integrations | provider-integrations, ai-provider, parallel-safe |
| CP-092 | FRA-127 | DeepSeek Provider Adapter | 11 Multi-Provider Integrations | provider-integrations, ai-provider, parallel-safe |
| CP-093 | FRA-128 | MiniMax Provider Adapter | 11 Multi-Provider Integrations | provider-integrations, ai-provider, parallel-safe |
| CP-094 | FRA-129 | OpenCode Workflow Adapter | 11 Multi-Provider Integrations | provider-integrations, ai-provider, parallel-safe |
| CP-095 | FRA-130 | Custom OpenAI-Compatible Endpoint Adapter | 11 Multi-Provider Integrations | provider-integrations, ai-provider, parallel-safe |
| CP-096 | FRA-131 | Multi-Provider Integration Gate | 11 Multi-Provider Integrations | provider-integrations, integration-gate, qa |
| CP-097 | FRA-132 | Editor Screenshot Audit Workflow | 12 Continuous Visual/UX Audits | visual-qa, audit, parallel-safe |
| CP-098 | FRA-133 | Runtime Screenshot Audit Workflow | 12 Continuous Visual/UX Audits | visual-qa, audit, runtime, parallel-safe |
| CP-099 | FRA-134 | Responsive Layout Audit | 12 Continuous Visual/UX Audits | audit, ux, parallel-safe |
| CP-100 | FRA-135 | Accessibility Audit | 12 Continuous Visual/UX Audits | audit, ux, parallel-safe |
| CP-101 | FRA-136 | UX Copy Audit | 12 Continuous Visual/UX Audits | audit, ux, parallel-safe, docs |
| CP-102 | FRA-137 | Generated Asset Quality Audit | 12 Continuous Visual/UX Audits | visual-qa, audit, assets, parallel-safe |
| CP-103 | FRA-138 | Regression Triage Workflow | 12 Continuous Visual/UX Audits | audit, parallel-safe, qa |
| CP-104 | FRA-139 | Continuous Audit Integration Gate | 12 Continuous Visual/UX Audits | audit, integration-gate, qa |
| CP-105 | FRA-140 | Verify Script Expansion For Phase 11 | 13 QA Automation And Regression | parallel-safe, qa |
| CP-106 | FRA-141 | Provider Mock Contract Regression Suite | 13 QA Automation And Regression | provider-mock, parallel-safe, qa |
| CP-107 | FRA-142 | Asset Pipeline Regression Tests | 13 QA Automation And Regression | assets, parallel-safe, qa |
| CP-108 | FRA-143 | Desktop Playwright Smoke Harness | 13 QA Automation And Regression | parallel-safe, qa, desktop |
| CP-109 | FRA-144 | Runtime Smoke Expansion | 13 QA Automation And Regression | runtime, parallel-safe, qa |
| CP-110 | FRA-145 | Editor Runtime Roundtrip Fixtures V2 | 13 QA Automation And Regression | runtime, parallel-safe, qa |
| CP-111 | FRA-146 | CI Ready Validation Documentation | 13 QA Automation And Regression | parallel-safe, docs, qa |
| CP-112 | FRA-147 | QA Automation Integration Gate | 13 QA Automation And Regression | integration-gate, qa |
| CP-113 | FRA-148 | Secret Redaction Everywhere | 14 Security Privacy And Cost Controls | security, ai-provider, parallel-safe |
| CP-114 | FRA-149 | No-Key Logging Audit | 14 Security Privacy And Cost Controls | security, audit, parallel-safe |
| CP-115 | FRA-150 | Local Data Boundary Audit | 14 Security Privacy And Cost Controls | security, audit, parallel-safe |
| CP-116 | FRA-151 | Provider Opt-In UX | 14 Security Privacy And Cost Controls | security, ux, parallel-safe |
| CP-117 | FRA-152 | Cost Estimate UI | 14 Security Privacy And Cost Controls | security, ai-provider, parallel-safe |
| CP-118 | FRA-153 | Rate Limit Handling UX | 14 Security Privacy And Cost Controls | security, ai-provider, parallel-safe |
| CP-119 | FRA-154 | Failed AI Call Recovery | 14 Security Privacy And Cost Controls | security, ai-provider, parallel-safe |
| CP-120 | FRA-155 | Security Privacy Cost Integration Gate | 14 Security Privacy And Cost Controls | security, integration-gate, qa |
| CP-121 | FRA-156 | README Complete Platform Rewrite | 15 Docs Examples And Final Ship | release-readiness, parallel-safe, docs |
| CP-122 | FRA-157 | Build Run And Release Docs Final Pass | 15 Docs Examples And Final Ship | packaging, parallel-safe, docs |
| CP-123 | FRA-158 | AI Workflow Documentation | 15 Docs Examples And Final Ship | ai-provider, parallel-safe, docs |
| CP-124 | FRA-159 | Asset Pipeline Documentation Final Pass | 15 Docs Examples And Final Ship | assets, parallel-safe, docs |
| CP-125 | FRA-160 | Sample Project Complete Platform Expansion | 15 Docs Examples And Final Ship | parallel-safe, docs, qa |
| CP-126 | FRA-161 | Complete Platform Final Validation Report | 15 Docs Examples And Final Ship | release-readiness, parallel-safe, docs, qa |
| CP-127 | FRA-162 | Linear Closeout Comments And Project Status | 15 Docs Examples And Final Ship | integration-gate, parallel-safe, docs |
| CP-128 | FRA-163 | Complete Platform Final Ship Gate | 15 Docs Examples And Final Ship | release-readiness, integration-gate, qa |

## Continuation Checklist For Future Agents

1. Read `AGENTS.md`, `docs/GOAL_STACK.md`, this backlog file, the current
   Linear issue, and relevant phase docs.
2. Confirm `git remote -v` still points to
   `https://github.com/vellxw/RPGCreatorAI.git`.
3. Confirm `git status --short` and protect unrelated/untracked files.
4. Work exactly one CP issue at a time in CP order.
5. Update source docs and `docs/VALIDATION_LOG.md` whenever behavior or major
   validation changes.
6. Commit only related files and push each completed issue to `origin/main`.
7. Comment Linear with exact commands/results/hash/push and move the issue to
   Done before continuing.
