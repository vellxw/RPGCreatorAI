# Phase 12 — M06 Integration Gate: Developer Mode

**Status:** CLOSED
**Scope:** M06 — Developer Mode
**Commit:** b5660b2
**Branch:** main

## Objective

Give the engine an off-by-default Developer Mode that surfaces
diagnostics and code-assistant workflows behind an explicit,
disclaimer-gated toggle, while keeping the host shell-free, commit-
free, push-free, and out-of-project-write-free even when the mode
is on.

## What ships in M06

- `src/devMode/devModeTypes.ts`
  - `DeveloperModeState` of `'off' | 'on'`.
  - `DeveloperModeCapabilities` (7 capabilities) with
    `DEVELOPER_MODE_OFF_CAPABILITIES` and
    `DEVELOPER_MODE_ON_CAPABILITIES` frozen tables.
  - `DEVELOPER_MODE_DEFAULT_STATE = 'off'`.
  - Helpers: `getDeveloperModeCapabilities`, `isCapabilityEnabled`,
    `DISABLED_WHEN_OFF`, `ALWAYS_ENABLED`.
  - `DeveloperModePreferences` v1 with `state`, `enabledAt`,
    `acknowledgedDisclaimerAt`.
  - `DeveloperModeChangeError` typed for `enable` / `disable`
    responses.
- `src/devMode/devModeStore.ts`
  - `useDeveloperMode` hook backed by `useReducer`.
  - Localstorage persistence with try/catch and safe fallback to
    defaults on malformed JSON.
  - `enable(acknowledgedDisclaimer)` requires the exact disclaimer
    text to flip the state. Without it the state stays `off`.
  - `disable()` and `reset()` are idempotent.
  - Exports the reducer and the storage key for guard tests.
- `src/components/ai/DeveloperModeSettings.tsx`
  - Inert presentational component.
  - Renders the off/on state with stable `data-state` and
    per-capability `data-enabled` / `data-locked-off` attributes.
  - Accept/Reject affordances are `type="button"`.
  - The enable button only fires when the user has read the
    disclaimer (text is passed back through `onEnable`).
  - Does not call providers, stores, or programmatic navigation.
- `src/screens/SettingsScreen.tsx`
  - Mounts `useDeveloperMode` at the top level of the screen.
  - Renders the new `DeveloperModeSettings` panel right below the
    Advanced provider panel.
  - Surfaces enable errors via the existing provider-disclosure
    feedback map.

## UX rules preserved

- Buttons are `type="button"` (no implicit form submission).
- Components are inert; side effects route through `onEnable`,
  `onDisable` props owned by the host.
- Stable `data-*` attributes for state, capabilities, and ids.
- No "Run now", "Execute now", "Deploy" verbs in user-facing copy.
- The disclaimer explicitly states the four "never" guarantees
  (shell, commit, push, write outside project).

## Safety guarantees (verified)

- `canExecuteShell` is `false` in BOTH `off` and `on` tables.
- `canCommitChanges` is `false` in BOTH tables.
- `canPushToRemote` is `false` in BOTH tables.
- `canWriteOutsideProject` is `false` in BOTH tables.
- The Tauri allowlist (`src-tauri/capabilities/default.json`)
  still has no `shell`/`process`/`fs:scope-extended` plugins, and
  the IPC handler list in `src-tauri/src/lib.rs` still exposes no
  generic exec endpoint. No git CLI is referenced anywhere in
  `src-tauri/` or `src/`.

## Tests added (in this milestone)

- `src/devMode/__tests__/devModeStore.test.ts` — types default
  state, capability tables, reducer transitions, gated enable,
  disable, persistence, hydration, malformed JSON safety,
  idempotent re-enable, reset.
- `src/components/ai/__tests__/DeveloperModeSettings.test.tsx` —
  off state defaults, on state capabilities, button types,
  onEnable contract, onDisable contract, inertness, locked-off
  capabilities for shell/commit/push/write-outside.

## Validation evidence

- `npx tsc --noEmit` — clean
- `npx vitest run` — 138 test files / 871 tests, all green

## Known limitations (carried into M07+)

- Code-assistant workflows and runtime diagnostics are *enabled* in
  the capability table when Developer Mode is on, but their
  specific UI surfaces are authored in M07+ (in-app first-run,
  on-this-machine checks, sprite/asset pipeline).
- `acknowledgedDisclaimerAt` is recorded with the disclaimer
  version. Bumping the version in a future milestone will force
  the user to re-acknowledge.
- We do not yet call `isCapabilityEnabled` from concrete code
  paths (e.g., the runtime launcher, the asset pipeline) because
  those code paths do not exist yet in M06. M07+ will add the
  guard calls as features land.

## Recommended next milestone

- M07: First-Run Onboarding + Generated Asset & Animation Research
  (deterministic seed-onboarding, in-app first-run check, asset
  pipeline research, sprite sheet research, deterministic
  refinement, sprite sheet optimization).
