# Phase 11 Provider Settings UI

CP-057 / FRA-92 adds the first real Provider Settings surface for optional
AI/editor tooling. The implementation is intentionally configuration-only:
it does not add live provider calls, generation actions, credential storage,
or any native runtime dependency.

## Implemented Surface

- `Settings` is now an implemented primary workspace route.
- Provider rows expose enable/disable state, capability tags, model labels,
  credential source labels, and explicit missing-credential feedback.
- The screen handles an empty provider list without blocking local authoring.
- Enabled providers without credentials show `Needs credentials`; configured
  providers can be represented by credential availability metadata.
- CP-058 adds a desktop-only password field for explicitly saving a provider
  credential through the Tauri credential bridge. The raw value is cleared
  after the write attempt and is never returned by the bridge.
- Project JSON still stores no provider credentials.
- Generation/test/connect actions remain absent from this screen until later
  provider hub issues add real capability gates and offline contracts.

## Store Boundary

`src/stores/providerStore.ts` now models provider availability with:

- provider id and display name
- enabled state
- status derived from enabled + credential availability
- optional model label
- credential environment/source name only
- capability metadata

The store no longer models an `apiKey` value. CP-058 adds credential
availability metadata and desktop-safe local storage through the Tauri bridge;
the raw credential value is never stored in project data or returned to the
renderer after a save attempt.

## Runtime Boundary

The native runtime remains independent of provider settings, AI providers,
network access, cloud services, credentials, and live APIs. Provider settings
are editor/tooling metadata only.

## Validation

Focused UI/store coverage validates:

- no-provider empty state
- disabled provider state
- enabled provider with missing credentials
- configured-provider state
- no raw credential value in rendered feedback after save
- no generation, connect, or live-test action buttons
- Settings primary navigation dispatch
- provider defaults start disabled, model-empty, routing-disabled, and without
  an `apiKey` field

Normal validation uses local Vitest and TypeScript only; no live provider call
was made.
