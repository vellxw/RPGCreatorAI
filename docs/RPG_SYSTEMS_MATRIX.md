# RPG Systems Matrix

Status snapshot of every system targeted by the Phase 10 MVP closeout. The
matrix is conservative: a row only graduates from `partial` to `impl` when
schema, editor, and runtime support are real, and only graduates to `val`
when the relevant validation and automated tests exist.

Legend:

- `n/s` - not started
- `partial` - schema exists, partial editor or runtime
- `impl` - schema, editor, and runtime in place
- `val` - also covered by automated tests

| System | Status | Schema | Editor | Runtime | Validation | Tests | Notes |
|--------|--------|--------|--------|---------|------------|-------|-------|
| Project metadata | val | yes | yes | yes | yes | yes | Visual profiles, map references, and desktop persistence are covered. |
| Maps + map tree | val | yes | yes | yes | yes | yes | Phase 10 Slice 1 map tree and map properties are implemented. |
| Tilesets / sprites | partial | yes | partial | yes | partial | partial | Data-driven tilesets exist; dedicated tileset database editor remains FRA-8. |
| Visual layers / foreground | partial | yes | yes | partial | yes | partial | Editor layers exist; runtime foreground occlusion remains FRA-19. |
| Events, pages, and self switches | val | yes | yes | yes | yes | yes | Active-page selection, self switches, and scheduled events are implemented. |
| Event commands baseline | partial | yes | yes | partial | yes | partial | Many commands are covered; interactive choices, event-target routes, audio v1, and plugin commands remain MVP work. |
| Runtime choices UI | partial | yes | yes | partial | yes | partial | Choice command data exists; visible runtime selection remains FRA-16. |
| Movement routes | partial | yes | yes | partial | yes | yes | Player-target routes are implemented; event-target routes remain FRA-17. |
| Common events | partial | yes | partial | yes | yes | yes | Runtime scheduling exists; common-event command-stack editing remains FRA-12. |
| Database V2 shared editor framework | n/s | n/a | no | n/a | no | no | FRA-6 extracts reusable database editor primitives. |
| Items, weapons, armors, states | partial | yes | partial | yes | partial | partial | Dedicated V2 forms and richer reference validation remain FRA-9. |
| Actors, classes, skills, enemies, troops | partial | yes | partial | yes | partial | partial | Dedicated V2 authoring forms remain FRA-10. |
| Quests, shops, switches, variables, system | partial | yes | partial | yes | partial | partial | Dedicated V2 setup/progression forms remain FRA-11. |
| Types and terms | val | yes | partial | partial | yes | yes | Shards persist and validate; dedicated editor/UI consumption remains later DB work. |
| Animations | partial | yes | partial | yes | yes | partial | Data/runtime support exists; animation editor with preview remains FRA-13. |
| Runtime project validator | val | n/a | n/a | yes | yes | yes | Pre-start validator blocks malformed projects before `Game::initialize` with C++ tests and smoke coverage. |
| Save/load | val | yes | n/a | yes | yes | yes | GameState and save migration coverage exists. |
| Battle system v1 | val | yes | partial | yes | yes | yes | Deterministic runtime is covered; richer database authoring remains DB V2 work. |
| Inventory + gold | val | yes | partial | yes | yes | yes | Runtime/menu paths exist; dedicated item/system editors remain DB V2 work. |
| Local audio v1 | partial | partial | partial | logged stub | partial | partial | `playSound` is logged/stubbed; local BGM/SFX playback remains FRA-20. |
| Deterministic plugin commands | n/s | no | no | no | no | no | Allowlisted `debug.log` style dispatch remains FRA-21. |
| Playtest session modes | partial | yes | partial | partial | partial | partial | Existing playtest flow needs project/current-map/selected-event temp sessions in FRA-22. |
| Runtime logs, trace, and state snapshots | n/s | n/a | no | no | no | no | Bounded log viewer, trace output, and state inspector remain FRA-23 through FRA-25. |
| Placeholder AI/debug UI gating | partial | n/a | partial | n/a | n/a | partial | MVP must remove or gate unavailable AI/debug actions in FRA-26. |
| Bundled sample MVP coverage | partial | yes | n/a | partial | partial | partial | Sample exists; full MVP feature coverage remains FRA-27. |
| Green-gate scripts and smoke | partial | n/a | n/a | partial | partial | partial | Current scripts exist; MVP full verify and expanded smoke remain FRA-28 through FRA-30 and FRA-35. |

Rows marked `partial` are intentionally not promoted based on planned work.
They should only move after the corresponding Linear issue is implemented,
validated, documented, committed, pushed, and moved to Done.
