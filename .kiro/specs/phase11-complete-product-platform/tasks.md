# Tasks - Phase 11 Complete Product Platform

## 00 Planning And Scope Lock

- [x] CP-001 / FRA-36: lock the product charter and Phase 11 scope.
- [x] CP-002 / FRA-37: audit the full repo and product surface.
- [x] CP-003 / FRA-38: create the complete-platform risk register.
- [x] CP-004 / FRA-39: record provider and legal review baseline.
- [x] CP-005 / FRA-40: create a repo-tracked backlog source document.
- [x] CP-006 / FRA-41: define execution protocol and branch rules.
- [x] CP-007 / FRA-42: run and record the Phase 11 validation baseline.
- [x] CP-008 / FRA-43: run the planning integration gate.

## Milestone Tracks

- [x] 01 Release Hardening And Packaging.
  - [x] CP-009 / FRA-44: make Windows development builds reliable.
  - [x] CP-010 / FRA-45: prototype the Windows packaged build.
  - [x] CP-011 / FRA-46: define installer strategy and release artifact policy.
  - [x] CP-012 / FRA-47: prepare app icon and release branding assets.
  - [x] CP-013 / FRA-48: define first-run directories and local app-data policy.
  - [x] CP-014 / FRA-49: define crash log and diagnostics location.
  - [x] CP-015 / FRA-50: refresh build, run, and packaging docs.
  - [x] CP-016 / FRA-51: run the packaging integration gate.
- [ ] 02 End-To-End Usability.
  - [x] CP-017 / FRA-52: complete open and create project startup flow.
  - [x] CP-018 / FRA-53: polish save and validation user flow.
  - [x] CP-019 / FRA-54: polish project-start playtest launch flow.
  - [x] CP-020 / FRA-55: polish current-map playtest launch flow.
  - [x] CP-021 / FRA-56: polish selected-event playtest launch flow.
  - [x] CP-022 / FRA-57: improve recoverable error states and user-safe failure copy.
  - [x] CP-023 / FRA-58: add professional empty states and first-time guidance.
  - [x] CP-024 / FRA-59: run the end-to-end usability integration gate.
- [x] 03 Professional Editor Surface.
  - [x] CP-025 / FRA-60: polish primary navigation and route visibility.
  - [x] CP-026 / FRA-61: polish map tree workflow reliability.
  - [x] CP-027 / FRA-62: polish map properties editing and validation.
  - [x] CP-028 / FRA-63: polish tile palette and brush workflow.
  - [x] CP-029 / FRA-64: polish layer workflow safety and overlays.
  - [x] CP-030 / FRA-65: polish event editor surface and command editing.
  - [x] CP-031 / FRA-66: polish database navigation and large-list safety.
  - [x] CP-032 / FRA-67: run the professional editor surface integration gate.
- [x] 04 Runtime Feature Completeness.
  - [x] CP-033 / FRA-68: audit runtime command support gaps.
  - [x] CP-034 / FRA-69: polish runtime menu flow.
  - [x] CP-035 / FRA-70: close battle authoring runtime gaps.
  - [x] CP-036 / FRA-71: implement audio authoring runtime v1.
  - [x] CP-037 / FRA-72: implement deterministic plugin command registry v2.
  - [x] CP-038 / FRA-73: polish save/load UX and runtime slots.
  - [x] CP-039 / FRA-74: add runtime diagnostics and developer overlay.
  - [x] CP-040 / FRA-75: run the runtime feature completeness integration gate.
- [ ] 05 Database/System Completeness.
  - [x] CP-041 / FRA-76: audit database schema gaps.
  - [x] CP-042 / FRA-77: polish actor, class, and skill authoring.
  - [ ] CP-043 / FRA-78: polish enemy and troop authoring.
  - [ ] CP-044 / FRA-79: polish item, equipment, and state authoring.
  - [ ] CP-045 / FRA-80: polish system, types, and terms.
  - [ ] CP-046 / FRA-81: polish common event authoring.
  - [ ] CP-047 / FRA-82: add reference repair tools.
  - [ ] CP-048 / FRA-83: run the database/system completeness gate.
- [ ] 06 Asset Library And Import Pipeline.
- [ ] 07 AI Provider Hub Foundation.
- [ ] 08 GPT Image 2 Asset Pipeline.
- [ ] 09 AI Characters And Animations.
- [ ] 10 AI Game Content Pipelines.
- [ ] 11 Multi-Provider Integrations.
- [ ] 12 Continuous Visual/UX Audits.
- [ ] 13 QA Automation And Regression.
- [ ] 14 Security Privacy And Cost Controls.
- [ ] 15 Docs Examples And Final Ship.

## Execution Notes

- Work issues in Linear order CP-001 through CP-128 unless a later issue is
  explicitly skipped because it is already Done with matching repo evidence.
- CP-005 created the complete repo-tracked backlog mirror with exact issue IDs,
  labels, validation rules, dependencies, and milestone mapping in
  `docs/superpowers/plans/2026-06-01-phase11-complete-platform-backlog.md`.
- Update this task file at milestone boundaries and integration gates.
- Keep all AI/provider work optional and editor/tooling-only.
- Keep native runtime behavior deterministic and provider-independent.
