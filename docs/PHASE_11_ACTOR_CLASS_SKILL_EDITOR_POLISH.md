# Phase 11 CP-042 - Actor, Class, And Skill Editor Polish

## Scope

CP-042 keeps the existing party/combat database shape and improves authoring
controls for actors, classes, and skills. It does not add runtime AI,
networking, provider dependencies, or new native data requirements.

## Implemented

- Actor skills are edited through a checklist of known skills instead of a
  comma-separated ID field.
- Class usable equipment is edited through a checklist of equipment slot
  labels instead of a comma-separated ID field.
- Unknown actor skill and class equipment-slot references remain visible in
  the checklist as removable `(unknown)` rows, so invalid data can be repaired
  without opening JSON.
- Class learned-skill progression keeps level plus skill reference controls,
  disables adding progression rows when no skills exist, and shows a compact
  empty state when none are configured.
- Actor/class/enemy stat labels now use authored editor labels such as
  `Attack`, `Magic Attack`, `Max HP`, and `Max MP` instead of raw camel-case
  field names.
- Database list delete warnings are covered for skills referenced by actors
  and classes.

## Runtime Boundary

No data shape changed. Native runtime loader, validator, and battle stat
consumption remain on the existing `actors`, `classes`, and `skills` fields.
Richer skill behavior beyond the existing `mpCost`, `power`, `target`, and
`element` shape remains future product depth unless a later issue expands the
schema and runtime contract deliberately.

## Validation

- `npm test -- --run src/components/database/__tests__/PartyCombatEditors.test.tsx`
- `npm test -- --run src/components/database/__tests__/PartyCombatEditors.test.tsx src/components/database/__tests__/DatabaseListWorkflow.test.tsx`
- Final CP-042 validation is recorded in `docs/VALIDATION_LOG.md`.
