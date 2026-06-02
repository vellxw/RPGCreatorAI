# Phase 11 FRA-80 / CP-045 - System Types And Terms Polish

Date: 2026-06-02

## Result

CP-045 makes system defaults, type tables, and terminology editable and
validated in the professional database surface.

- The Database screen now includes standalone `Types` and `Terms` tabs.
- `TypesEditor` exposes row-based editors for weapon types, armor types,
  skill types, elements, equipment slots, and item categories, with visible
  warnings for missing ids or labels.
- `TermsEditor` exposes the currency unit plus required stat, menu, command,
  battle, and save/load labels, with visible warnings for blank required
  labels.
- `SystemEditor` now uses the configured currency term in the starting-gold
  label and edits the starting party with actor reference selects instead of
  comma-separated actor ids.
- Starting-party references remain visible if they point at unknown actor ids,
  matching the existing reference-safe editor behavior.
- TypeScript validation now flags duplicate starting-party actor ids as errors,
  warns when actors exist but the starting party is empty, and warns when
  animation sets exist but `system.playerAnimationSet` is unset.

## Boundary

Types and terms remain editor/validation data for v1. They provide stable
reference option tables and author-facing terminology, but the native runtime
does not depend on localized labels or editor-only type names.

Switch and variable non-default `initial` seeding remains unresolved. Runtime
validation indexes their ids, but `GameState` still starts switches as false
and variables as zero unless commands modify them. That gap remains owned by
the next common-event/system depth work rather than CP-045.

## Validation

Validation evidence is recorded in `docs/VALIDATION_LOG.md`.
