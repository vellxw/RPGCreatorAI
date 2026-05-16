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
| Project metadata | val | yes | yes | yes | yes | yes | Existing from Phase 1 |
| Maps + tilesets (placeholder) | impl | yes | yes | yes | yes | yes | Tile painting deferred |
| Events (id, position, trigger, solid, sprite) | val | yes | yes | yes | yes | yes | Phase 3 |
| Event commands v0 (showText, setFlag, ifFlag, addItem, transferMap, playSound) | val | yes | yes | yes | yes | yes | Phase 1/2 |
| Event commands v1 (choices, vars, gold, quest, shop, battle, common events) | n/s | — | — | — | — | — | Slice 3 |
| Switches | n/s | — | — | — | — | — | Slice 1/4 |
| Variables | n/s | — | — | — | — | — | Slice 1/4 |
| Self switches | n/s | — | — | — | — | — | Slice 4 |
| Common events | n/s | — | — | — | — | — | Slice 3 |
| Items DB | val | yes | partial | yes | yes | yes | Phase 2 |
| Actors / party | n/s | — | — | — | — | — | Slice 1/6 |
| Classes | n/s | — | — | — | — | — | Slice 1/7 |
| Skills | n/s | — | — | — | — | — | Slice 7 |
| Equipment | n/s | — | — | — | — | — | Slice 7 |
| Enemies | n/s | — | — | — | — | — | Slice 1/8 |
| Troops | n/s | — | — | — | — | — | Slice 1/8 |
| Battle system | n/s | — | — | — | — | — | Slice 8 |
| Quests | n/s | — | — | — | — | — | Slice 1/5 |
| Shops | n/s | — | — | — | — | — | Slice 1/9 |
| Inventory + gold | partial | items only | partial | items only | partial | partial | Slice 6 |
| System settings | n/s | — | — | — | — | — | Slice 1 |
| Save/load (current keys) | val | — | — | yes | — | yes | Phase 2; expand in Slice 6 |
| Audio (BGM/SFX) | partial | playSound | — | logged stub | — | — | Out of phase 6 polish |

The matrix is conservative: a row only graduates from `partial` to `impl`
when both editor and runtime support are real, and `val` requires test
coverage of the runtime path.
