# Phase 11 Battle Runtime Gap Closure

Issue: CP-035 / FRA-70
Date: 2026-06-02

## Result

CP-035 closes the highest-impact v1 gap between battle authoring data and the
native runtime battle resolver. A simple authored battle can be configured,
validated, and run without relying on hidden class, equipment, troop, or escape
assumptions.

## Runtime Data Paths

- `BattleSystem` now builds actor combatants through the shared
  `resolveActorBattleStats(...)` helper.
- Actor stats resolve from `actor.baseStats`, plus class growth scaled by
  `max(0, actor.level - 1)`, plus equipment item modifiers.
- Actor battle HP starts from `GameState.actorHps` when present, otherwise the
  resolved actor HP that includes class max-HP growth.
- The party menu uses the same resolved stats, so the player-facing party view
  matches battle math.
- Enemy HP, attack, defense, EXP, gold, and guaranteed drops continue to come
  from the enemy and troop databases.

## Validation Policy

The TypeScript project validator and native runtime project validator now reject
or report these battle-authoring hazards before runtime launch:

- actor references to missing classes;
- actor equipment references to missing items;
- actor skill references to missing skills;
- class learned-skill references to missing skills;
- enemy drop references to missing items;
- troops with no members;
- troop members referencing missing enemies;
- `startBattle.canEscape=true`, because interactive escape is not implemented
  in the deterministic v1 battle runtime.

`canEscape=false` remains the supported authored configuration for v1
auto-resolved battles.

## Known Limits

- Battles are still deterministic auto-attack flows.
- Skills, actor action selection, state effects, battle animation effects, and
  interactive escape are future-depth work.
- No runtime AI, network, cloud, provider credentials, or arbitrary scripting
  were added.
