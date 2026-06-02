# Map Creation Workflow — Phase 10 MVP

This document describes the editor-side workflow for building a map in
RPGCreatorAI: choosing a tool, painting tiles, toggling collisions,
placing and managing events, and undoing mistakes. It covers both the
user flow (what a creator sees) and the data flow (how the React /
Vite editor talks to the project store and the Tauri filesystem
adapter).

The editor is React 19 + Vite + Tailwind. It mutates project data through
`src/stores/projectStore.ts` and tracks UI authoring state through
`src/stores/editorStore.ts`. Undo/redo is handled by the history middleware
around reducer actions.

## Bundled MVP sample coverage

The bundled project under `data/` is also a Phase 10 QA fixture. Keep it
small, but keep it representative of the MVP runtime/editor contract:

- `data/maps/town.json` includes the `old_man` choice event with two
  meaningful branches, plus `route_coach` driving an event-target movement
  route for `patrol_crate` and a deterministic `debug.log` plugin command.
- `data/maps/town.json` includes non-zero foreground tree tiles so visual
  QA and loaders exercise foreground occlusion separately from collision.
- `data/maps/house.json` includes `chest_001`, which plays a local sound,
  updates quest state, sets self switch `A`, and exposes a self-switch-gated
  opened page guarded by `ifSelfSwitch`.
- `data/database/switches.json` and `data/database/commonEvents.json`
  include `mvp_debug_enabled` and `mvp_debug_ping`, a switch-gated parallel
  common event that executes an allowlisted `debug.log` command.
- `src/validation/__tests__/bundledSample.test.ts` and
  `tests/test_map_loader.cpp` assert this command surface so the fixture
  cannot silently shrink below MVP coverage.

## Goals

- Let a creator paint ground, decoration, foreground, collision, and region
  data on the map canvas.
- Let a creator place, move, duplicate, delete, and select events without
  leaving the editor.
- Let a creator edit map properties, event pages, command stacks, common
  events, and Database V2 entries from the local editor.
- Let a creator undo and redo any map edit with `Ctrl+Z` / `Ctrl+Y`.
- Persist every change through the Save flow and validate it against the same
  JSON format the C++ runtime loads.
- Let desktop users create temp playtest sessions for Project Start,
  Current Map, and Selected Event without mutating source project files.

## Non-goals

- Autotile rules and layer blending.
- Drag-select / box-select for multiple events.
- Tile collisions stored outside the explicit `collision` layer
  (`9 = wall`, `0 = walkable`).
- Runtime scripting console, arbitrary plugin code, or AI/runtime services.
- Cloud sync, marketplace publishing, or proprietary RPG Maker import.

## User flow

1. Open the editor at the Map screen.
2. In the map tree, select, create, rename, duplicate, reorder, or nest maps.
3. In map properties, edit display name, tileset, scroll, size, viewport,
   encounter, battleback, parallax, and start-map settings.
4. In the Tile Palette, pick an authoring layer: Ground, Decor, Front, Pass,
   Region, or Events.
5. Pick a brush, fill, rectangle, eraser, or select/move tool. Brushes can be
   visual tiles, passability cells, region ids, or event templates.
6. On the canvas:
   - **Select** mode: click an event to inspect it; drag a selected
     event to move it; press `Delete` to delete; press `Ctrl+D` to
     duplicate.
   - **Brush** mode: click and drag to paint the active brush on the active
     layer.
   - **Fill** mode: fill a contiguous region on the active layer.
   - **Rectangle** mode: paint a rectangular region on the active layer.
   - **Eraser** mode: clear cells back to `0` where the active layer allows
     clearing.
   - **Events** layer: click an empty cell to place a new event with a
     unique id and minimal default fields.
7. Edit selected event pages and command stacks in the event inspector or
   Events screen.
8. The Save toolbar lights up because the project is dirty. Hitting
   Save (or `Ctrl+S`) validates first, then writes through the active
   adapter: Tauri filesystem in desktop mode, browser/export flow in browser
   mode.
9. Use Validate before runtime launch or save handoff.
10. `Ctrl+Z` undoes the last action; `Ctrl+Y` or `Ctrl+Shift+Z` redoes.
11. Switching maps clears the selection, but the undo stack is per
   editor session and stays alive until the editor is closed.

## Map properties inspector

When no event is selected, the right inspector edits map-level metadata.
Creators can edit name, display name, tileset, scroll behavior, size,
viewport preset, encounter steps, battleback id, parallax image, parallax
loop flags, parallax scroll speeds, and project start position without
opening JSON.

The tileset dropdown keeps invalid references visible instead of silently
falling back. If a map points at a tileset id that is not present in the
loaded tileset database, the inspector shows `Missing tileset: <id>` and
keeps that value selectable until the creator chooses a valid tileset.

Start-map editing is explicit. The current start map exposes start X, start
Y, and facing direction controls. Selecting another map as the project start
also writes a safe start position clamped inside that map's dimensions, so
shrinking or switching maps cannot leave the player spawn outside bounds.

Map property writes are normalized by the project reducer before persistence:
unknown scroll modes become `none`, negative or non-finite encounter step
counts become `0`, battleback and parallax image ids are trimmed, and
non-finite parallax scroll values become `0`. Project validation still flags
invalid loaded JSON for invalid scroll modes, negative encounter steps, and
non-finite parallax scroll values before save or playtest handoff.

## Tools

| Tool | Cursor / hint | Click action | Drag action |
|------|---------------|--------------|-------------|
| Select | move | select event under cursor | move selected event |
| Brush | pencil | paint active brush in active layer | paint stroke |
| Fill | bucket | flood-fill contiguous cells | n/a |
| Rectangle | square | start rectangle | size and commit rectangle |
| Eraser | eraser | clear active layer cell | clear stroke |

The active tool, brush, brush size, playtest mode, and active layer live in
`EditorState` (see below). They are persisted in memory only; closing the
editor resets them to defaults.

## Layers

Phase 10 maps require these authoring layers:

| Layer | Type | Runtime role |
|-------|------|--------------|
| `ground` | visual | primary background terrain |
| `decoration` | visual | non-blocking visual detail behind entities |
| `foreground` | visual | occluders drawn after same-priority entities |
| `collision` | collision | movement truth; `0` walkable, `9` blocked |
| `region` | region | authoring metadata for region ids |
| `event` | event authoring mode | places and edits entries in `map.events` |

Painting visual tiles never silently changes collision. Collision and region
layers remain gameplay/editor data; the runtime does not render them as
visual tiles.

## State shapes

### `EditorState` additions

```ts
interface EditorState {
  activeScreen: Screen;
  selectedMapId: string;
  selectedEvent: GameEvent | null;
  selectedEventMapId: string | null;
  zoom: number;
  saved: boolean;

  brush: BrushSelection;
  activeLayer: 'ground' | 'decoration' | 'foreground' | 'collision' | 'region' | 'event';
  tool: 'brush' | 'fill' | 'rectangle' | 'erase' | 'select';
  brushSize: 1 | 2 | 3 | 5;
  playtestMode: 'projectStart' | 'currentMap' | 'selectedEvent';
}
```

### `EditorAction` additions

```ts
type EditorAction =
  | ...existing
  | { type: 'SET_TOOL';          tool: EditorState['tool'] }
  | { type: 'SET_BRUSH';         brush: BrushSelection }
  | { type: 'SET_BRUSH_SIZE';    brushSize: EditorState['brushSize'] }
  | { type: 'SET_ACTIVE_LAYER';  layer: EditorState['activeLayer'] }
  | { type: 'SET_PLAYTEST_MODE'; mode: PlaytestSessionMode };
```

### `ProjectAction` additions (handled through the history middleware)

```ts
type ProjectAction =
  | ...existing Phase 6 actions
  | { type: 'PAINT_TILE';        mapId: string; layerName: string; x: number; y: number; tile: number }
  | { type: 'PAINT_TILE_STROKE'; mapId: string; layerName: string; cells: Array<{ x: number; y: number; tile: number }> }
  | { type: 'PAINT_RECT';        mapId: string; layerName: string; x0: number; y0: number; x1: number; y1: number; tile: number }
  | { type: 'FLOOD_FILL';        mapId: string; layerName: string; x: number; y: number; tile: number }
  | { type: 'TOGGLE_COLLISION';  mapId: string; x: number; y: number }
  | { type: 'PLACE_EVENT';       mapId: string; event: GameEvent }
  | { type: 'MOVE_EVENT';        mapId: string; eventId: string; x: number; y: number }
  | { type: 'DUPLICATE_EVENT';   mapId: string; eventId: string }
  | { type: 'DELETE_EVENT';      mapId: string; eventId: string }
  | { type: 'BEGIN_STROKE' }
  | { type: 'END_STROKE' }
  | { type: 'UNDO' }
  | { type: 'REDO' };
```

`PAINT_TILE` is the granular per-cell action. `PAINT_TILE_STROKE` is the
batched per-cell action used during a drag. The middleware coalesces
both into a single history entry between `BEGIN_STROKE` and
`END_STROKE`.

## History middleware

`src/stores/historyMiddleware.ts` (new) wraps `projectReducer` and
manages the undo / redo stack.

```ts
interface History<S> {
  past: S[];
  present: S;
  future: S[];
}

const HISTORY_LIMIT = 100;

const TRACKED: Array<ProjectAction['type']> = [
  'PAINT_TILE',
  'PAINT_TILE_STROKE',
  'TOGGLE_COLLISION',
  'PLACE_EVENT',
  'MOVE_EVENT',
  'DUPLICATE_EVENT',
  'DELETE_EVENT',
];
```

### Rules

- A tracked action pushes the current `ProjectData` snapshot onto
  `past`, clears `future`, and clamps `past` to `HISTORY_LIMIT`.
- `UNDO` pops `past`, pushes the current snapshot onto `future`, and
  sets the present from the popped snapshot.
- `REDO` pops `future`, pushes the current snapshot onto `past`, and
  sets the present from the popped snapshot.
- Untracked actions (selecting a map, opening the inspector, dirty
  flagging, save toolbar transitions) bypass history entirely.
- Between `BEGIN_STROKE` and `END_STROKE`, only the very first tracked
  action records a history entry; subsequent actions inside the stroke
  mutate `present` without pushing.
- After save, the stack is unchanged. Undoing past a save is allowed;
  the project will simply be flagged dirty again.

### Memory cost

Each entry is a whole-project snapshot. For a Phase 7-sized project
(2 maps, ~100 events, a few KB JSON each), 100 entries is ~1 MB worst
case. Acceptable. If a future phase needs much larger projects, switch
to per-action diffs.

## Canvas interaction

`MapCanvas.tsx` becomes the dispatcher of all map mutations.

### Select tool

- `mousedown` on an event → dispatch `SELECT_EVENT`.
- `mousemove` while a selected event is being dragged → track in local
  component state, draw a ghost preview at the cursor's cell.
- `mouseup` over a different cell → dispatch `MOVE_EVENT { x, y }`
  clamped to map bounds.

### Paint / Eraser / Collision tools

- `mousedown` → dispatch `BEGIN_STROKE`, then dispatch the cell's
  action.
- `mousemove` (button held) entering a new cell → dispatch the cell's
  action. The middleware merges all of these into a single history
  entry.
- `mouseup` or mouse leaves canvas → dispatch `END_STROKE`.

The action chosen depends on the active tool:

| Tool       | Action                                                      |
|------------|-------------------------------------------------------------|
| Brush      | `PAINT_TILE_STROKE { layerName: activeLayer, cells: [...] }` |
| Eraser     | `PAINT_TILE_STROKE { layerName: activeLayer, cells: [{x,y,0}] }` |
| Fill       | `FLOOD_FILL { layerName: activeLayer, x, y, tile }` |
| Rectangle  | `PAINT_RECT { layerName: activeLayer, x0, y0, x1, y1, tile }` |
| Collision  | `PAINT_TILE_STROKE` on `collision` with tile `0` or `9` |

### Event tool

- `mousedown` on empty cell → dispatch `PLACE_EVENT` with a generated
  unique id (`evt_<8-hex>`), a minimal default `GameEvent`, and the
  cell coordinates.
- `mousedown` on existing event → behaves like Select (no double-place).

### Keyboard shortcuts (when MapCanvas is focused)

- `Ctrl+Z` → `UNDO`.
- `Ctrl+Y` or `Ctrl+Shift+Z` → `REDO`.
- `Delete` or `Backspace` → `DELETE_EVENT` after a confirm prompt.
- `Ctrl+D` → `DUPLICATE_EVENT`. The new event lands on the next free
  cell starting from the current position; if the map is full, the new
  event is placed at the same cell (validator will catch the collision
  and the user can move it).

## Event lifecycle

### Place

`PLACE_EVENT { mapId, event }`:
- Reducer adds the event to `maps[mapId].events`, after asserting the
  id is unique within the map.
- Validator post-condition: per-map event id uniqueness.

### Move

`MOVE_EVENT { mapId, eventId, x, y }`:
- Reducer updates the matching event's `x` / `y` after clamping.
- No new dependencies on other databases.

### Duplicate

`DUPLICATE_EVENT { mapId, eventId }`:
- Reducer locates the source event, deep-clones every field
  (commands, metadata), generates a new id, and appends. Position
  defaults to the source position; the next free cell is used if the
  source cell is already occupied (search starts at +1, +0).

### Delete

`DELETE_EVENT { mapId, eventId }`:
- Reducer removes the matching event. Reducer ignores the action if
  the id is missing (idempotent).
- The canvas-side handler shows a confirm prompt (`window.confirm` for
  v1) before dispatching.

## Validation

The Phase 6 validator stays in place. Phase 7 adds:

- Per-map event id uniqueness (post-condition for the new mutating
  actions).
- Tile values written by paint mode SHALL be in the layer's allowed
  set:
  - `ground` ∈ {0, 1, 2, 3}
  - `collision` ∈ {0, 9}

A reducer mutation that would produce an invalid value is dropped
silently; the validator surfaces the offence on Save so the creator
sees a clear error.

## Save / load

The Save toolbar is unchanged. After Phase 7 mutations, the project
travels through the same `FileSystemAdapter` (or
`BrowserMemoryAdapter` in dev) as Phase 6.

The on-disk JSON does not gain new fields. Tile painting just changes
the existing `layers[i].tiles` array. Collision toggling just changes
`layers[collision].tiles`. Event mutations just change the existing
`events` array.

## Testing strategy

### Vitest

- `historyMiddleware.test.ts` — push, undo, redo, stroke coalescing,
  bounded length, untracked passthrough.
- `projectReducer.paint.test.ts` — `PAINT_TILE` updates the cell;
  `PAINT_TILE_STROKE` updates a batch in order; `TOGGLE_COLLISION`
  flips 0 ↔ 9; clamping rejects out-of-bounds.
- `projectReducer.events.test.ts` — `PLACE_EVENT` rejects duplicate
  ids; `MOVE_EVENT` clamps to map bounds; `DUPLICATE_EVENT` deep-clones
  command lists and assigns a new id; `DELETE_EVENT` is idempotent.
- `editorStore.test.ts` — `SET_TOOL`, `SET_SELECTED_TILE`,
  `SET_ACTIVE_LAYER` transitions.

### Manual / E2E

See `docs/EDITOR_RUNTIME_E2E_QA.md`.

## File touchpoints

```
src/components/editor/MapCanvas.tsx          (paint, place, drag, keyboard)
src/components/editor/TilePalette.tsx        (tool buttons, tile id selection)
src/components/editor/Inspector.tsx          (Duplicate / Delete buttons)
src/screens/MainEditorScreen.tsx             (focus management for shortcuts)
src/stores/editorStore.ts                    (tool / tile / layer state)
src/stores/projectStore.ts                   (new reducer actions)
src/stores/historyMiddleware.ts              (NEW)
src/validation/validateProject.ts            (per-map event id uniqueness)
src/types/project.ts                         (no new types — reuses GameEvent)
```

## Risks and mitigations

- **Event id generation collisions.** The reducer must check uniqueness
  before adding; tests cover the path. Use `crypto.randomUUID().slice(0, 8)`
  with a retry loop.
- **Undo / redo memory.** Whole-project snapshots are simple but
  expensive on large projects. v1 caps at 100 entries. Future phases
  can switch to diff snapshots if needed.
- **Stroke coalescing edge cases.** Without `BEGIN_STROKE` /
  `END_STROKE`, a quick second drag could merge into the first. The
  middleware uses an explicit open / close flag, so coalescing only
  happens between matched markers.
- **Canvas focus.** Keyboard shortcuts only fire when the MapCanvas (or
  the editor screen container) has focus. `MainEditorScreen` sets
  `tabIndex={0}` and focuses on mount.
