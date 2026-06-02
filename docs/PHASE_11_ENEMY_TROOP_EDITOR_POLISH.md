# Phase 11 CP-043 - Enemy And Troop Editor Polish

## Scope

CP-043 improves starter battle authoring for enemies and troops while keeping
the existing `enemies` and `troops` data shape. No AI, network, provider, or
cloud dependency is introduced.

## Implemented

- Enemy drops now use a safe `Add drop` action that is disabled when no item
  records exist, preventing empty `itemId` references from being authored by
  the editor.
- New enemy drops default to the first available item with a `1.0` drop
  chance so an authored starter reward works immediately.
- Drop rows expose stable `Remove drop N` labels and use `Drop chance N`
  instead of the less explicit `Drop rate N`.
- Empty enemy drop lists and no-item states show compact repair guidance.
- Troop members now use a safe `Add troop member` action that is disabled
  when no enemy records exist, preventing empty member ids.
- Troop member move/remove controls expose stable labels, and boundary move
  buttons are disabled instead of silently no-oping.
- Empty troop and no-enemy states show compact repair guidance.
- The native runtime project validator now blocks invalid battle-facing enemy
  data before launch: negative/non-finite enemy stats, negative exp/gold, and
  drop chance outside `0..1`.

## Runtime Boundary

The runtime battle data shape is unchanged. `RpgDatabases` still loads enemy
stats, rewards, drops, and troop member ids from the same JSON fields, and
`BattleSystem` remains deterministic. CP-043 only strengthens authoring
defaults and pre-launch validation.

## Validation

- `npm test -- --run src/components/database/__tests__/PartyCombatEditors.test.tsx`
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/build.ps1`
- Final CP-043 validation is recorded in `docs/VALIDATION_LOG.md`.
