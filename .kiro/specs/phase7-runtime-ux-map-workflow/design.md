# Phase 7 — Design

## Overview

Phase 7 splits cleanly into three tracks that share validation
infrastructure but otherwise touch different code:

- **Asset foundation track** — lives in `assets/generated`,
  `src/assets/generated`, and `src/renderer`. Adds committed original
  generated imagery for tiles, sprites, editor icons, inventory / quest
  / status / battle / shop visuals, and wires the runtime to load those
  sprites from disk.
- **Runtime UX track** — lives in C++ under `src/core`, `src/runtime`,
  `src/dialogue`, and `src/renderer`. Adds in-game menus, inventory,
  party/status, quest journal, shop UI, battle UI, and a save-slot
  picker. Renderer is extended to draw text-mode panels; gameplay logic
  stays in `Game` and the new state machines.
- **Map creation workflow track** — lives in TypeScript under
  `src/components/editor`, `src/screens/MainEditorScreen.tsx`, and
  `src/stores/projectStore.ts`. Adds tile painting, collision painting,
  event place/move/duplicate/delete, and undo/redo. The reducer keeps
  data immutable; the canvas dispatches actions; the existing Save
  pipeline persists everything.

A small E2E track wires the two together via the existing Tauri
filesystem adapter and `RuntimeLaunchAdapter`.

The architecture rules from `AGENTS.md` are unchanged:

- The C++ runtime owns no game content. It still loads JSON.
- The renderer draws; gameplay logic stays in `Game` and the new menu
  state machines (`MenuSystem`, `ShopMenuSystem`, `BattleUI`).
- The editor edits project data only; nothing is hardcoded except sane
  defaults.
- The shell sandboxes file I/O.

## Architecture

```
+-----------------------------------------+        +--------------------------------+
| React/Vite Editor                       |        | C++ Runtime                    |
|                                         |        |                                |
| screens/MainEditorScreen                |        | core/Game                      |
|   ├─ TilePalette  (tile + tool select)  |        |   ├─ MapScene                  |
|   ├─ MapCanvas    (paint + place +      |        |   ├─ EventRunner               |
|   │   move + duplicate + delete)        |        |   ├─ DialogueSystem            |
|   └─ Inspector    (event fields)        |        |   ├─ BattleSystem              |
|                                         |        |   ├─ MenuSystem (NEW)          |
| stores/projectStore                     |  IPC   |   │   ├─ Inventory             |
|   ├─ projectReducer (paint, collision,  | <----> |   │   ├─ Party / Status        |
|   │   event place/move/dup/del,         |        |   │   ├─ Quest Journal         |
|   │   UNDO / REDO)                      |        |   │   └─ Save / Load slots     |
|   └─ historyMiddleware (NEW)            |        |   ├─ ShopMenuSystem (NEW)      |
|                                         |        |   └─ BattleUI (NEW)            |
| adapters/FileSystemAdapter              | files  |                                |
|   └─ writeMap / writeProject            | <----> | renderer/Renderer2D            |
|                                         |        |   ├─ renderMenuPanel (NEW)     |
| RuntimeLaunchAdapter                    |        |   ├─ renderShopPanel (NEW)     |
|   └─ launches rpg_creator_runtime.exe   | -----> |   └─ renderBattlePanel (NEW)   |
+-----------------------------------------+        +--------------------------------+
```

## Components and interfaces

### Runtime UX (C++)

#### MenuSystem

Lives in `src/runtime/MenuSystem.{h,cpp}`. Owns:

```cpp
enum class MenuScreen {
    Closed,
    Root,        // Inventory / Party / Quests / Save / Load / Close
    Inventory,
    Party,
    Quests,
    Save,        // slot picker
    Load,        // slot picker
};

class MenuSystem {
public:
    void open();
    void close();
    bool isOpen() const;
    MenuScreen current() const;

    // Keyboard-driven navigation; returns true if input was consumed.
    bool handleInput(const InputEvent& ev);

    // Snapshot used by the renderer.
    struct ViewModel {
        MenuScreen screen;
        int selectionIndex;
        std::vector<std::string> rootItems;
        std::vector<InventoryRow> inventory;   // {itemId, name, amount, description}
        std::vector<PartyRow>     party;       // {actorId, name, classId, level, hp/maxHp, mp/maxMp, equipment}
        std::vector<QuestRow>     quests;      // grouped active/completed/failed
        std::vector<SlotRow>      slots;       // {index, exists, summary}
    };
    ViewModel snapshot(const GameState& state, const RpgDatabases& dbs, const SaveManager& saves) const;

private:
    MenuScreen screen_ = MenuScreen::Closed;
    int selectionIndex_ = 0;
    // sub-screen state (e.g. inventory scroll offset, slot index)
};
```

`Game::update` calls `menuSystem.handleInput(...)` first if open, and
short-circuits player movement / event runner / battle ticking while
`menuSystem.isOpen()`.

#### ShopMenuSystem

Lives in `src/runtime/ShopMenuSystem.{h,cpp}`. Replaces the Phase 6
dialogue stub for `openShop`.

```cpp
class ShopMenuSystem {
public:
    void open(const ShopData& shop);
    void close();
    bool isOpen() const;

    bool handleInput(const InputEvent& ev);
    BuyResult tryBuy(GameState& state, const RpgDatabases& dbs);

    struct ViewModel {
        std::string shopId;
        std::string shopName;
        int playerGold;
        std::vector<ListingRow> listings; // {itemId, name, price, affordable}
        int selectionIndex;
        std::optional<std::string> message; // "Not enough gold." etc.
    };
    ViewModel snapshot(const GameState& state, const RpgDatabases& dbs) const;
};
```

`EventRunner::resolveOpenShop` is rewired from "log + dialogue line" to
`shopMenuSystem.open(shop)` and pauses until the system closes itself.

#### BattleUI

Lives in `src/runtime/BattleUI.{h,cpp}`. Wraps the existing `BattleSystem`
with a turn log and a deterministic frame ticker so the renderer can
display each turn for ~250 ms each. The math is unchanged; the UI only
sequences existing turn results.

```cpp
class BattleUI {
public:
    void start(const TroopData& troop, const std::vector<ActorData>& party);
    void tick(float dt); // advances animation; deterministic by counter, not real-time
    bool isFinished() const;
    BattleResult result() const;

    struct ViewModel {
        std::vector<CombatantRow> party;   // {name, hp/maxHp, isActive}
        std::vector<CombatantRow> enemies; // same
        std::deque<std::string>   log;     // last N turn lines
        std::optional<std::string> outcome; // "Victory", "Defeat", "Escape"
        std::optional<RewardSummary> rewards;
    };
    ViewModel snapshot() const;
};
```

A separate `BattleResolver` (a thin wrapper that pre-computes the full
turn sequence using `BattleSystem`) feeds the UI. Determinism is
preserved: the resolver runs to completion at battle start, the UI just
plays back.

#### Renderer2D extensions

Three new methods, all isolated to the renderer:

```cpp
void renderMenuPanel(const MenuSystem::ViewModel& vm);
void renderShopPanel(const ShopMenuSystem::ViewModel& vm);
void renderBattlePanel(const BattleUI::ViewModel& vm);
```

They reuse `BitmapFont` (already in the renderer) and a shared
"text panel" routine that draws a translucent black background, a
white border, and rows of text. No SDL leaks outside the renderer.

#### SaveManager

Phase 6 already supports schemaVersion 2 saves. Phase 7 adds:

- A small `SlotMetadata` summary read from each `saves/slot_<n>.json`
  (`mapId`, `gold`, party joined as `,`-list, mtime).
- A list helper: `std::vector<SlotMetadata> listSlots(int maxSlots)`.

No format change.

### Map creation workflow (TypeScript)

#### Project reducer additions

`src/stores/projectStore.ts` reducer gains:

```ts
type ProjectAction =
  // existing actions...
  | { type: 'PAINT_TILE';        mapId: string; layer: 'ground' | 'collision'; x: number; y: number; tile: number }
  | { type: 'PAINT_TILE_STROKE'; mapId: string; layer: 'ground' | 'collision'; cells: Array<{ x: number; y: number; tile: number }> }
  | { type: 'TOGGLE_COLLISION';  mapId: string; x: number; y: number }
  | { type: 'PLACE_EVENT';       mapId: string; event: GameEvent }
  | { type: 'MOVE_EVENT';        mapId: string; eventId: string; x: number; y: number }
  | { type: 'DUPLICATE_EVENT';   mapId: string; eventId: string }
  | { type: 'DELETE_EVENT';      mapId: string; eventId: string }
  | { type: 'UNDO' }
  | { type: 'REDO' };
```

Each mutation returns a fresh map array (no mutation), so React renders
correctly and the history middleware can snapshot the previous state.

#### History middleware

`src/stores/historyMiddleware.ts` (new) wraps the reducer:

```ts
interface History {
  past: ProjectData[];
  present: ProjectData;
  future: ProjectData[];
}

const HISTORY_TRACKED: ProjectAction['type'][] = [
  'PAINT_TILE',
  'PAINT_TILE_STROKE',
  'TOGGLE_COLLISION',
  'PLACE_EVENT',
  'MOVE_EVENT',
  'DUPLICATE_EVENT',
  'DELETE_EVENT',
];

const HISTORY_LIMIT = 100;
```

- `UNDO` pops `past`, pushes current onto `future`.
- `REDO` pops `future`, pushes current onto `past`.
- Tracked actions push the previous state onto `past`, clear `future`,
  and clamp to `HISTORY_LIMIT`.
- Untracked actions (e.g. selecting a map, opening the inspector) bypass
  history.
- A separate `BEGIN_STROKE` / `END_STROKE` pair groups paint drags into
  a single undo entry: while a stroke is open, the middleware coalesces
  `PAINT_TILE` actions into one history entry.

#### MapCanvas additions

`src/components/editor/MapCanvas.tsx`:

- Reads the active editor tool from a new field on `EditorState`:
  `tool: 'paint' | 'eraser' | 'collision' | 'event' | 'select'`.
- On `mousedown` + drag, dispatches `BEGIN_STROKE` then a
  `PAINT_TILE_STROKE` per cell entered, then `END_STROKE`. This keeps
  the undo entry single per drag.
- In `event` mode, click on empty cell → `PLACE_EVENT`.
- In `select` mode (default), click on event → existing `SELECT_EVENT`;
  drag selected event → `MOVE_EVENT`.
- Keyboard: `Delete` → `DELETE_EVENT`, `Ctrl+D` → `DUPLICATE_EVENT`,
  `Ctrl+Z` → `UNDO`, `Ctrl+Y` / `Ctrl+Shift+Z` → `REDO`.

A small inline confirm prompt is reused for `DELETE_EVENT` (the existing
`window.confirm` is acceptable for v1; a styled dialog is deferred).

#### TilePalette additions

`src/components/editor/TilePalette.tsx`:

- Adds tool buttons that dispatch into editor state (`paint`, `eraser`,
  `collision`, `event`, `select`).
- Maps palette entries to integer tile ids per layer:
  ground: `1` walkable, `2` path, `3` water (visual only),
  collision: `9` wall, `0` walkable.
- Selected tile id is held in editor state and read by `MapCanvas`.

#### EditorState additions

```ts
interface EditorState {
  activeScreen: Screen;
  selectedMapId: string;
  selectedEvent: GameEvent | null;
  selectedEventMapId: string | null;
  zoom: number;
  saved: boolean;

  // NEW
  tool: 'select' | 'paint' | 'eraser' | 'collision' | 'event';
  selectedTileId: number;     // bound to active layer's tile id space
  activeLayer: 'ground' | 'collision';
}
```

### E2E round-trip

A new vitest harness `src/e2e/__tests__/editorRoundtrip.test.ts`:

1. Boots a `BrowserMemoryAdapter` seeded from the bundled sample.
2. Runs `dispatch({ type: 'PAINT_TILE', ... })`.
3. Calls the same save action the toolbar uses.
4. Asserts that the in-memory adapter file contents reflect the painted
   cell.

A separate Tauri-only flow (documented but not auto-run because it
needs the desktop shell) reproduces the same against
`FileSystemAdapter`. The QA doc covers the manual launch step.

## Data flow

### Pause menu opening

```
SDL key Escape
  └─> Game::handlePlayerInput
        └─> menuSystem.open()
Game::update
  └─> if (menuSystem.isOpen()) {
        menuSystem.handleInput(input);
        // skip player movement, EventRunner, battle ticking
        return;
      }
Renderer2D::renderMenuPanel(menuSystem.snapshot(state, dbs, saveManager))
```

### Shop opening

```
EventRunner sees `openShop(shopId)`
  └─> finds shop in databases
  └─> shopMenuSystem.open(shop)
  └─> EventRunner pauses (waitForUI = true)
Game::update
  └─> if shopMenuSystem.isOpen(): shopMenuSystem.handleInput(input)
  └─> if buy confirmed: shopMenuSystem.tryBuy(state, dbs)
  └─> on close: EventRunner.resume()
```

### Battle opening

```
EventRunner sees `startBattle(troopId, ...)`
  └─> battleResolver.precompute(troop, party) → ordered turn list
  └─> battleUI.start(turnList, troop, party)
  └─> EventRunner pauses
Game::update
  └─> battleUI.tick(dt)
  └─> when battleUI.isFinished():
        EventRunner applies result branch (victory or defeat) as before
```

### Tile paint stroke

```
Mouse down on canvas
  └─> dispatch BEGIN_STROKE
Mouse move (held) entering new cell
  └─> dispatch PAINT_TILE_STROKE { cells: [last cell] }
Mouse up
  └─> dispatch END_STROKE
History middleware records ONE entry covering the whole drag.
```

## State shapes

### Slot metadata

```ts
interface SaveSlotMetadata {
  index: number;
  exists: boolean;
  mapId?: string;
  gold?: number;
  party?: string[];
  mtime?: number; // unix epoch
}
```

C++ mirror:

```cpp
struct SlotMetadata {
  int index;
  bool exists;
  std::string mapId;
  int gold;
  std::vector<std::string> party;
  long long mtimeUnix;
};
```

### Battle UI turn entry

```cpp
struct BattleTurn {
  std::string actorId;     // attacker
  std::string targetId;    // defender
  int damage;              // pre-computed
  bool defeated;           // target HP -> 0
};
```

The Phase 6 `BattleSystem` already computes these via `computeDamage`;
the resolver just collects them into a sequence.

## Validation

`validateProject` keeps every Phase 6 referential check. Phase 7 adds:

- New event placements: ids SHALL be unique within the map (the reducer
  guarantees this; the validator enforces it as a post-condition).
- Duplicated events SHALL keep all referenced ids valid (the deep-clone
  reuses original ids; the new entity gets a fresh `id` only).
- Tile values written by paint mode SHALL be in the layer's allowed set
  (e.g. `collision` ∈ {0, 9}); the validator surfaces an error if
  anything else slips in.

No new schema files.

## Save / load

### Slot picker UX

- Save: shows 3 slots, each `Empty` or
  `Slot 2 — town · 50g · arc · 2026-05-16 14:32`.
- Load: identical layout, empty slots disabled.
- Save overwrite confirmation is a yes/no prompt rendered inside the
  menu panel.

### Format

- `saves/slot_<n>.json` already uses schemaVersion 2 (Phase 6).
- Mtime is read from the filesystem at list time; not persisted in the
  save itself.

## Testing strategy

### TypeScript / vitest

- `historyMiddleware.test.ts` — push, undo, redo, stroke coalescing,
  bounded length.
- `projectReducer.paint.test.ts` — PAINT_TILE updates the cell;
  TOGGLE_COLLISION flips 0↔9; clamping rejects out-of-bounds.
- `projectReducer.events.test.ts` — PLACE_EVENT generates unique id;
  MOVE_EVENT clamps to map; DUPLICATE_EVENT deep-clones commands;
  DELETE_EVENT removes by id.
- `editorStore.test.ts` — tool / activeLayer transitions.
- `e2e/editorRoundtrip.test.ts` — paint → save → re-read.

### C++ / doctest

- `test_menu_system.cpp` (new) — open/close, root navigation, sub-screen
  push/pop, keyboard navigation, snapshot composition for inventory /
  party / quests with mocked databases.
- `test_shop_menu_system.cpp` (new) — buy success, insufficient gold,
  close resumes EventRunner.
- `test_battle_ui.cpp` (new) — pre-computed turn list matches direct
  `BattleSystem::run` outcome; turn order respected.
- `test_save_manager.cpp` extension — `listSlots(3)` returns metadata
  for present slots, `exists=false` for absent.

### Cargo

No Rust changes needed except a new test that listing
`saves/slot_<n>.json` files round-trips through the existing tauri
filesystem helpers (if a helper is added; otherwise C++ owns it).

### Smoke

- `scripts\dev\smoke-runtime.bat` continues to assert "[INFO] Project
  loaded", "[INFO] Map loaded".
- A new optional smoke step opens the pause menu programmatically (via a
  one-shot debug input injection identical to the Phase 2 visual harness)
  and asserts the renderer logged a menu-rendered marker.

## Risk areas

- **Renderer text panels.** Drawing menus is the largest surface area in
  the renderer. Mitigation: reuse `BitmapFont`, share a single
  `drawTextPanel` primitive, keep colors constant in `Renderer2D.cpp`.
- **EventRunner pausing.** Shop and battle now need a real "pause until
  UI closes" mechanism. Mitigation: a single `EventRunner::pauseFor(...)`
  hook driven by a callback; Phase 6 already has the dialogue-pause
  pattern to copy.
- **Undo/redo correctness.** Easy to corrupt the project bytes by
  partially-deep-cloning maps. Mitigation: take whole-`ProjectData`
  snapshots, accept the small memory cost, keep them immutable.
- **Stroke coalescing.** A naive implementation can swallow legitimate
  separate strokes. Mitigation: explicit `BEGIN_STROKE` / `END_STROKE`
  rather than time- or coordinate-based heuristics.
- **Determinism.** Battle UI must not depend on real wall-clock; tests
  freeze a fixed `dt` per tick.

## Migration path

0. **Slice 0 — original asset foundation.** Commit generated atlases,
   derived editor/runtime assets, replace production emoji placeholders,
   and teach the renderer to load committed sprites.
1. **Slice 1 — runtime menu skeleton.** `MenuSystem` skeleton, pause
   integration, root menu, Close. Renderer draws the panel. No content
   yet.
2. **Slice 2 — inventory + party + quests views.** Snapshot composers
   read `GameState` + `RpgDatabases`. Keyboard scroll. Tests.
3. **Slice 3 — save/load slot picker.** `SaveManager::listSlots`,
   slot rows, overwrite confirm. Tests + smoke.
4. **Slice 4 — shop UI.** `ShopMenuSystem`, EventRunner rewire, buy
   transactions. Tests.
5. **Slice 5 — battle UI.** `BattleResolver` precompute, `BattleUI`
   tick, renderer panel. Tests.
6. **Slice 6 — editor undo/redo + history middleware.** Reducer
   actions, middleware, keyboard shortcuts. Tests.
7. **Slice 7 — tile painting + collision painting.** `MapCanvas` paint
   mode, `TilePalette` tool buttons, integer tile ids, stroke
   coalescing. Tests.
8. **Slice 8 — event place/move/duplicate/delete.** Canvas drag, button
   row, confirm prompt, `Ctrl+D` / `Delete`. Tests.
9. **Slice 9 — E2E round-trip + QA doc.** Vitest e2e harness,
   manual screenshots, `docs/EDITOR_RUNTIME_E2E_QA.md`.
10. **Slice 10 — final validation.** Full toolchain pass, runtime smoke,
    final report, commit, push.
