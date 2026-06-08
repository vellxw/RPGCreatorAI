# Phase 12 Product UX Audit From User Feedback

Issue: PX-001 / FRA-435
Date: 2026-06-07

## Scope And Sources

This audit compares the current RPGCreatorAI product experience to the Phase
12 direction recorded in Linear: product-grade desktop launch, instant startup
feedback, OpenCode-style AI Studio, pipeline-aware AI commands, simplified
provider/model UX, review-gated AI actions, first-run onboarding, and improved
generated asset and animation workflows.

Inspected sources:

- `AGENTS.md`
- `docs/GOAL_STACK.md`
- `docs/PHASE_11_COMPLETE_PLATFORM_VALIDATION_REPORT.md`
- `docs/PHASE_11_FINAL_SHIP_GATE.md`
- `docs/AI_WORKFLOWS.md`
- Linear project `RPGCreatorAI Phase 12 - Product UX And AI Studio`
- Linear issue `PX-001 / FRA-435`
- `src/App.tsx`
- `src/components/project/ProjectStartupScreen.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/screens/SettingsScreen.tsx`
- `src/screens/AIToolsScreen.tsx`
- `src/stores/providerStore.ts`
- `src/providers/providerRegistry.ts`
- `src/providers/modelCapabilityRegistry.ts`
- focused startup, Settings, and AI gating tests

No runtime launch or live provider diagnostic was run for this audit. The issue
requires source/docs inspection plus the narrowest applicable validation if
files change.

## Current Strengths

- The Phase 11 platform is a strong local-first base. Final docs record a
  passing canonical gate, packaged prototype smoke, runtime smoke, mock-backed
  AI/provider validation, and the native runtime's independence from providers,
  network access, credentials, and live APIs.
- The startup screen already gives real creator paths: open a desktop project
  folder, create a project, import a project bundle, or use the bundled sample.
  Browser mode has honest limitations instead of pretending local filesystem
  access exists.
- Primary navigation focuses on implemented workspaces: Maps, Events,
  Database, Assets, Playtest, and Settings. The previous broad AI Tools route
  is intentionally absent from primary navigation.
- Provider settings are explicit and safe. Providers start disabled, enabling
  requires opt-in disclosure, credentials are stored outside project data in
  desktop mode, browser credential storage is unavailable by design, and
  Settings exposes capability, cost, budget, queue, and runtime-independent
  safety states.
- The provider and model registry is structured. Current metadata records
  operations, model labels, capabilities, credential requirements, cost
  availability, rate-limit guidance, custom endpoint configuration, OpenCode
  adapter metadata, and deterministic local mock models.
- AI workflow implementation is review-gated and distributed near the data it
  affects. Existing docs and tests cover map, event, database, validation
  repair, image, tileset, portrait, icon, character concept, sprite-sheet, and
  generation history workflows without live provider calls.

## Product UX Gaps

| Gap | Evidence | Phase 12 implication |
| --- | --- | --- |
| Startup is functional but not instant-launch grade. | `App.tsx` waits for adapter project load and shows only centered `Loading project...` before `ProjectStartupScreen`. `ProjectStartupScreen` is a project chooser, not a splash/loading phase shell. | M01 (`PX-011` through `PX-030`) should add branding/icon audit, double-click executable path, splash shell, startup progress phases, lazy loading, recent projects, and launch smoke evidence. |
| Phase state in repo docs still says Phase 11. | `AGENTS.md` and `docs/GOAL_STACK.md` identify Phase 11 as active, while Linear has a Phase 12 project with M00 through M12 milestones. | M00 (`PX-006` through `PX-010`) should verify the baseline and update planning/state docs only after each required audit artifact exists. |
| Normal creators still face provider infrastructure in Settings. | `SettingsScreen.tsx` surfaces provider names, credential env vars, model labels, base URLs, capabilities, cost states, rate limits, and custom endpoint controls in one advanced workspace. | M04 (`PX-086` through `PX-105`) should introduce creator-friendly recommended modes and reserve raw provider/model details for advanced configuration. |
| There is no OpenCode-style AI Studio shell in the primary product flow. | `Sidebar.tsx` has no AI Studio route. `AIToolsScreen.tsx` exists as a read-only status surface if reached directly and has no chat/task surface. `App.tsx` does not route `AIToolsScreen`. | M02 (`PX-031` through `PX-055`) should add an AI Studio shell, project-aware chat, task/action cards, contextual evidence, mocks, tests, and an integration gate. |
| Existing AI actions are capability islands rather than a natural-language command router. | Workflow entry points are near Maps, Events, Database, Assets, and validation panels. Provider registry has operations, but no product-level command router is exposed. | M03 (`PX-056` through `PX-085`) should route creator intent to data, asset, validation, balance, mechanic, and preview pipelines without bypassing review. |
| Review-gated candidates exist, but there is no unified review inbox. | Phase 11 docs and modules record review-gated generated outputs, but the inspected navigation and screens do not expose a central candidate lifecycle surface. | M05 (`PX-106` through `PX-125`) should define candidate data, provenance, previews, accept/reject/archive actions, validation status, persistence, and gate evidence. |
| Developer-oriented code assistance is represented as provider capability, not a deliberate product mode. | Provider metadata includes `code.assist` and an OpenCode adapter, but there is no explicit Developer Mode shell or source diff review flow in inspected UI. | M06 (`PX-126` through `PX-145`) should keep code assistance behind an explicit developer-mode gate with source candidates, diff/test suggestions, safety docs, and tests. |
| First-run onboarding is still mostly project selection. | Startup lets the user choose a project path or bundled sample, but there is no guided first-run path from blank/sample/mock generation through save, validation, and playtest. | M07 (`PX-146` through `PX-165`) should add onboarding and starter-project flow evidence. |
| Generated asset/animation workflows need research-backed quality and optimization upgrades. | Phase 11 has many pipeline docs/tests, but Phase 12 Linear calls for provider research, animation rubrics, multi-round refinement, and sprite-sheet optimization. | M08 through M11 (`PX-166` through `PX-245`) should improve research, fixtures, QA rubrics, refinement loops, and runtime export compatibility without live paid validation. |

## Phase 12 UX Principles Implied By The Audit

- Keep default authoring immediate: creators should be able to open, create,
  validate, save, and playtest without seeing provider setup first.
- Treat providers as optional capability suppliers, not the product's mental
  model. Default copy should describe creator outcomes; advanced panes can
  reveal provider IDs, model IDs, base URLs, rate limits, and credential
  sources.
- AI Studio should be a project-aware work surface, not a provider console.
  It should explain proposed changes, link to affected maps/events/database
  records/assets, and hand all mutations to review-gated workflows.
- Preserve Phase 11 boundaries: normal validation stays offline and
  mock-backed, live provider diagnostics require explicit credentials and
  opt-in, and the native runtime remains deterministic and provider-free.
- Use milestone gates to avoid scope drift. M00 should document baseline and
  principles; M01 should make launch credible; M02 through M06 should make AI
  assistance understandable and reviewable; M07 should close first-run
  creator onboarding; M08 through M11 should improve generated assets and
  animation quality; M12 should verify the whole product.

## Audit Result

Phase 11 provides solid safety, data, runtime, and mock-provider foundations,
but the current product still reads like a professional editor with advanced
provider panels. Phase 12 should shift the visible experience toward an
instant desktop app and creator-first AI Studio while keeping the existing
local-first architecture and review boundaries intact.
