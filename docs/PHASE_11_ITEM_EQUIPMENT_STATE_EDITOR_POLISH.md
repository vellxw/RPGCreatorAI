# Phase 11 Item Equipment State Editor Polish

Issue: CP-044 / FRA-79
Date: 2026-06-02

## Result

Item, weapon, armor, and state authoring is more practical and reference-safe
for the current Phase 11 database contract.

Items remain the runtime-consumed inventory/equipment records in v1. Separated
`weapons`, `armors`, and `states` shards remain first-class editor and
validation data; they are not loaded as direct runtime battle/status-effect
records in this slice. CP-044 resolves the boundary by documenting it and by
strengthening runtime pre-launch validation for the `items` and actor equipment
data that native gameplay actually consumes.

## Editor Changes

- Item stat modifier labels now use authored stat names such as `Attack` and
  `Magic Defense` instead of raw camel-case field ids.
- Weapon and armor editors expose every stat modifier, not only attack or
  defense.
- Weapon, armor, and state traits now use row-based add, remove, move, and edit
  controls through the shared array editor instead of comma-separated text.
- Existing reference selects keep unknown current values visible through the
  existing `ReferenceSelect` unknown-option behavior, so stale type, slot, or
  animation references can be inspected and repaired instead of silently lost.

## Validation Changes

- TypeScript validation now rejects blank or duplicate weapon, armor, and state
  traits.
- Native `RuntimeProjectValidator` now checks runtime-consumed item data before
  launch:
  - item price must be non-negative and finite;
  - item HP/MP effects must be finite when authored;
  - item stat modifiers must be finite when authored;
  - item equipment slots must be one of `weapon`, `armor`, or `accessory`;
  - actor equipment slot keys must stay within the same runtime-supported set.

## Boundary Notes

- Runtime battle stats still resolve equipment modifiers from `items.items`.
- Direct `weapons`/`armors` runtime consumption is intentionally deferred until
  a future equipment-depth slice defines migration or composition rules.
- Runtime state/status-effect simulation is still not implemented in v1; state
  records remain authoring and validation data.

## Validation

Validation evidence is recorded in `docs/VALIDATION_LOG.md` under
`Phase 11 FRA-79 / CP-044`.
