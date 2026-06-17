# Phase 12 — M04 Integration Gate: Creator-First Provider/Model UX

**Status:** CLOSED
**Scope:** M04 — Creator-first provider/model UX (PX-086 — PX-114)
**Commit:** a7e7ddf
**Branch:** main

## Objective

Hide the raw provider/model configuration from the average creator and
let them choose a *mode* (Recommended, Fast/Cheap, Best Quality, Local
Mock, Custom Advanced) that resolves to a safe, deterministic routing
plan. Persist the choice and any per-workflow overrides, but keep the
advanced panel explicitly opt-in.

## What ships in M04

- `src/providers/providerMode.ts`
  - 5 modes: `recommended`, `fast-cheap`, `best-quality`, `local-mock`,
    `custom-advanced`.
  - `resolveCreatorModeRoutes` returns one `ResolvedWorkflowRoute` per
    workflow with a clear `source`: `recommended`, `fast-cheap`,
    `best-quality`, `local-mock`, `override`, `fallback-paid`,
    `fallback-local`.
  - Free providers are tagged with `free: true` so the UI can show
    cost hints without exposing amounts or paths.
  - Local mock is the deterministic, offline-safe default.
- `src/providers/providerModePreferences.ts`
  - Versioned preferences bag: `{ mode, overrides[] }`.
  - `loadProviderModePreferences(scope, storage)` reads from
    `localStorage` with safe fallback to defaults.
  - `saveProviderModePreferences(scope, prefs, storage)` writes the bag
    and never throws (storage failures are swallowed).
  - `clearProviderModePreferences(scope, storage)` removes the bag.
- `src/stores/providerStore.ts` extended
  - New state: `creatorMode`, `workflowOverrides`,
    `isAdvancedPanelOpen`.
  - New actions: `setCreatorMode`, `setWorkflowOverride`,
    `clearWorkflowOverride`, `clearAllWorkflowOverrides`,
    `resetProviderModePreferences`.
  - Hooked up to the persistence layer keyed by an explicit
    `preferencesScope` so creators/projects do not leak.
- `src/components/ai/CreatorModeSelector.tsx`
  - Inert presentational component: 5 mode cards with stable
    `data-mode` attribute and `onSelect` callback.
  - No provider, store, or navigation calls in the component.
  - `type="button"` on every action.
- `src/components/ai/PerPipelineModelDefaults.tsx`
  - Inert presentational component: per-workflow resolved route with
    `data-workflow-id`, `data-source`, and `data-free` attributes.
  - Calls only `onChange` for override edits and `onReset` to clear
    the override.
- `src/components/ai/AdvancedProviderPanel.tsx`
  - Inert presentational component: existing provider list, now with
    free badges and explicit advanced disclosure.
  - Does not write to any store, mutate providers, or trigger any
    network call.
- `src/screens/SettingsScreen.tsx`
  - "Advanced" affordance reveals `AdvancedProviderPanel` only when
    the user explicitly enables the advanced view.
  - Default UI is the creator mode selector + per-pipeline defaults.

## UX rules preserved

- Buttons are `type="button"` (no implicit form submission).
- Components are inert; side effects route through `onAction` / `onSelect`.
- Stable `data-*` attributes for state and ids.
- No "Run now", "Execute now", "Deploy" verbs in user-facing copy.
- "Free" labels are explicit, never token prices.
- No paths, no env var names, no credentials in rendered copy.

## Tests added (in this milestone)

- `src/providers/__tests__/providerMode.test.ts` — routing resolution
  per mode, override honors, fallback to local mock, free tagging.
- `src/providers/__tests__/providerModePreferences.test.ts` —
  persistence round-trip, malformed JSON safety, missing storage
  safety, write failure safety, namespaced scope, reset.
- `src/stores/__tests__/providerStoreCreatorMode.test.tsx` — store
  defaults, mode switching, persistence, hydration from initial
  preferences, clear single/all overrides, reset.

## Validation evidence

- `npx tsc --noEmit` — clean
- `npx vitest run` — 134 test files / 831 tests, all green

## Known limitations (carried into M05+)

- Per-workflow model override does not yet surface an in-Context
  affordance; it lives only in the Settings screen.
- "Recommended" mode is a static deterministic mapping; no live
  telemetry informs the recommendation yet.
- Cost estimate panel still does not read from this resolved map;
  the integration is left for a later milestone that wires
  `ProviderCostBudgetPanel` against `resolveCreatorModeRoutes`.

## Recommended next milestone

- M05: Review-Gated AI Candidate Lifecycle
  (Pipelines, CandidateStore, Accept/Discard flow wired to
  `resolveCreatorModeRoutes`.)
