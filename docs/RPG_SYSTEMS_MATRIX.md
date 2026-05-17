# RPG Systems Matrix

Status snapshot of every system targeted by Phase 6. Updated at the end of
each slice.

Legend:

- `n/s` — not started
- `partial` — schema exists, partial editor or runtime
- `impl` — schema, editor, and runtime in place
- `val` — also covered by automated tests

| System | Status | Schema | Editor | Runtime | Validation | Tests | Notes |
|--------|--------|--------|--------|---------|------------|-------|-------|
| Project metadata | val | yes | yes | yes | yes | yes | Phase 1 |
| Maps + tilesets / sprites | impl | yes | yes | yes | yes | yes | Original committed assets landed in Phase 7 Slice 0; tile painting still deferred |
| Events (id, position, trigger, solid, sprite) | val | yes | yes | yes | yes | yes | Phase 3 |
| Event commands v0 (showText, setFlag, ifFlag, addItem, transferMap, playSound) | val | yes | yes | yes | yes | yes | Phase 1/2 |
| Event commands v1 (choices, vars, gold, quest, shop, battle, common events) | val | yes | yes | yes | yes | yes | Slice 3 (24 commands total) |
| Switches (typed) | val | yes | yes | yes | yes | yes | Slice 1/4 |
| Variables (typed) | val | yes | yes | yes | yes | yes | Slice 1/4 |
| Self switches | n/s | — | — | — | — | — | Phase 7 |
| Common events | val | yes | partial | yes | yes | yes | Slice 1/3 (editor command-list editing in Phase 7) |
| Items DB | val | yes | partial | yes | yes | yes | Phase 2 / Slice 1 |
| Actors / party | val | yes | yes | yes | yes | yes | Slice 1/6/7 |
| Classes | val | yes | yes | yes | yes | yes | Slice 1/7 |
| Skills | impl | yes | yes | yes | yes | partial | Slice 1/7 (battle skill use Phase 7) |
| Equipment (stat modifiers) | impl | yes | partial | yes | yes | partial | Slice 7 (battle integration done) |
| Enemies | val | yes | yes | yes | yes | yes | Slice 1/8 |
| Troops | val | yes | yes | yes | yes | yes | Slice 1/8 |
| Battle system v1 | val | yes | yes | yes | yes | yes | Slice 8 deterministic core; Phase 7 adds visible result / reward presentation |
| Quests | val | yes | yes | yes | yes | yes | Slice 1/5 |
| Shops | val | yes | yes | yes | yes | yes | Slice 9 data flow; Phase 7 adds real modal buy UI with gold checks |
| Inventory + gold | val | yes | yes | yes | yes | yes | Slice 6 |
| System settings | val | yes | yes | yes | yes | yes | Slice 1/2 |
| Save/load (Phase 6 v2) | val | yes | n/a | yes | yes | yes | Migrates Phase 2 saves |
| Audio (BGM/SFX) | partial | playSound | partial | logged stub | partial | partial | Phase 7 polish |

The matrix is conservative: a row only graduates from `partial` to `impl`
when both editor and runtime support are real, and `val` requires test
coverage of the runtime path.
