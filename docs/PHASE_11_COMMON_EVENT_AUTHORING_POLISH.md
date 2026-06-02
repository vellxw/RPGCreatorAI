# Phase 11 FRA-81 / CP-046 - Common Event Authoring Polish

Date: 2026-06-02

## Result

CP-046 tightens common event authoring and validation around reusable command
stacks.

- The shared `CommandStackEditor` now accepts `ownerCommonEventId` when editing
  a common event.
- `CallCommonEventEditor` excludes the owning common event from selectable
  targets so direct self-calls are not authored accidentally.
- Existing self or unknown common-event references remain visible in the
  selector as repairable values.
- Common-event command stack tests now cover appending commands into empty
  branches and owner-aware common-event target choices.
- TypeScript validation now rejects direct common-event self-calls.
- Native runtime pre-launch validation now rejects direct common-event
  self-calls while preserving recursive branch validation for choices,
  conditions, and battle branches.

## Boundary

CP-046 blocks direct self-recursion. It does not implement full graph-cycle
detection across multiple common events. Multi-event cycle analysis remains a
future reference/repair depth task if projects need that guarantee.

## Validation

Validation evidence is recorded in `docs/VALIDATION_LOG.md`.
