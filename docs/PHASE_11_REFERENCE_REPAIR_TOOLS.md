# Phase 11 Reference Repair Tools

Issue: CP-047 / FRA-82

## Result

Broken reference handling now has a repair path instead of only validation
messages.

- `referenceIndex` can list known targets, detect broken references, and
  produce same-table replacement options.
- Project and map references are indexed for repair, including start map,
  map-tree parent, `transferMap`, and `setPlayerPosition` references.
- The Validation tab shows a compact `Reference repair` section when a broken
  reference has valid replacement records.
- Repairs dispatch one explicit `REPAIR_REFERENCE` action and remain undoable.
- The reducer validates that the replacement target exists before mutating
  project data; invalid repairs are no-ops and do not dirty the project.
- Repairs are source-scoped. The editor does not delete records, create new
  records, or guess content.

## Boundary

CP-047 covers explicit replacement of broken references with existing records.
It does not add automatic record creation, fuzzy rename matching, AI repair
suggestions, or destructive cleanup actions. Those remain future depth items.

## Validation

Validation evidence is recorded in `docs/VALIDATION_LOG.md`.
