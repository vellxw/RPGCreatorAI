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
| Project metadata | val | yes | yes | yes | yes | yes | Phase 8 adds backward-compatible visual profiles for aspect ratio, resolution, camera mode, tile size, and zoom |
| Maps + tilesets / sprites | val | yes | yes | yes | yes | yes | Phase 8 adds full-bleed generated tiles, no-gap validation, scene templates, and widescreen visual QA |
| Events (id, position, trigger, solid, sprite, pages) | val | yes | yes | yes | yes | yes | Phase 10 Slice 3B adds active-page runtime selection for interact/touch, commands, render metadata, and collision; autorun/parallel scheduler remains separate |
| Event commands v0 (showText, setFlag, ifFlag, addItem, transferMap, playSound) | val | yes | yes | yes | yes | yes | Phase 1/2 |
| Event commands v1 (choices, vars, gold, quest, shop, battle, common events, self switches) | val | yes | yes | yes | yes | yes | Phase 10 Slice 3B executes controlSelfSwitch/ifSelfSwitch |
| Switches (typed) | val | yes | yes | yes | yes | yes | Slice 1/4 |
| Variables (typed) | val | yes | yes | yes | yes | yes | Slice 1/4 |
| Self switches | val | yes | yes | yes | yes | yes | Phase 10 Slice 3B adds active-page conditions plus control/branch command execution scoped by map/event |
| Common events | val | yes | partial | yes | yes | yes | Slice 1/3 (editor command-list editing in Phase 7) |
| Items DB | val | yes | partial | yes | yes | yes | Phase 2 / Slice 1 |
| Actors / party | val | yes | yes | yes | yes | yes | Slice 1/6/7 |
| Classes | val | yes | yes | yes | yes | yes | Slice 1/7 |
| Skills | impl | yes | yes | yes | yes | partial | Slice 1/7; active battle skill selection remains future work |
| Equipment (stat modifiers) | impl | yes | partial | yes | yes | partial | Slice 7 (battle integration done) |
| Enemies | val | yes | yes | yes | yes | yes | Slice 1/8 |
| Troops | val | yes | yes | yes | yes | yes | Slice 1/8 |
| Battle system v1 | val | yes | yes | yes | yes | yes | Slice 8 deterministic core; Phase 7 adds visible result / reward presentation |
| Quests | val | yes | yes | yes | yes | yes | Slice 1/5; Phase 7 adds visible quest journal UI |
| Shops | val | yes | yes | yes | yes | yes | Slice 9 data flow; Phase 7 adds real modal buy UI with gold checks |
| Inventory + gold | val | yes | yes | yes | yes | yes | Slice 6; Phase 7 adds visible inventory UI |
| System settings | val | yes | yes | yes | yes | yes | Slice 1/2; Phase 8 adds shared editor/runtime visual interpretation |
| Save/load (Phase 6 v2) | val | yes | n/a | yes | yes | yes | Migrates Phase 2 saves |
| Audio (BGM/SFX) | partial | playSound | partial | logged stub | partial | partial | Future audiovisual polish phase |

The matrix is conservative: a row only graduates from `partial` to `impl`
when both editor and runtime support are real, and `val` requires test
coverage of the runtime path.
