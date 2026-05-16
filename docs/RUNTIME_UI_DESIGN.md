# Runtime UI Design — Phase 7

This document specifies the in-game UI surfaces introduced in Phase 7.
It is the source of truth for layout, interaction, and rendering rules
for the runtime menus, shop, battle UI, and save/load slot picker.

The runtime is C++ + SDL. The renderer is `Renderer2D`. All text uses
the existing `BitmapFont`. All UI lives in C++ — no embedded webview,
no HTML, no scripting layer.

## Goals

- A player can pause, inspect inventory, party, and quests, and
  save/load to specific slots, without touching JSON.
- A player can buy items at a shop with a real UI, not a debug log.
- A player can see a battle resolve turn-by-turn instead of silently.

## Non-goals

- "Use item from menu" — Phase 7 v1 only shows item descriptions.
- Per-actor skill selection in battle — combatants auto-attack.
- Animations richer than fade-ins / progress bars.
- Mouse interaction in the runtime — keyboard only.

## Conventions

### Colors

All UI panels share the same colour scheme so the game has a consistent
look:

```cpp
constexpr Color kPanelFill   {  10,  12,  18, 230 };  // translucent black
constexpr Color kPanelBorder { 230, 230, 230, 255 };  // light grey
constexpr Color kPanelHeader { 240, 220,  60, 255 };  // accent yellow
constexpr Color kPanelText   { 240, 240, 240, 255 };  // off-white
constexpr Color kPanelDim    { 160, 160, 160, 255 };  // disabled / hint text
constexpr Color kPanelOK     {  90, 200, 120, 255 };  // success / affordable
constexpr Color kPanelBad    { 220,  90,  90, 255 };  // failure / unaffordable
```

These constants live in `Renderer2D.cpp`, not in game data. Renderer
styling is renderer-owned (see AGENTS.md rule 8).

### Layout

- All panels are drawn at fixed pixel sizes relative to the 800×600
  viewport, then scaled by the renderer if the window is resized.
- Panels are centred horizontally; vertical position depends on the
  panel:
  - Menu / Shop / Battle: full-screen overlay (margin 32 px).
  - Dialogue: bottom strip (height 120 px).
- A 1 px border + 1 px inner padding + a 16 px text margin keeps text
  away from the edge.

### Input

- Arrow keys / WASD navigate.
- `Enter` / `Space` confirms.
- `Escape` / `Backspace` cancels (or closes a sub-screen).
- The active sub-screen captures all input; the player and EventRunner
  do not see it.

### Rendering primitive

`Renderer2D::drawTextPanel(int x, int y, int w, int h, const std::string& title, const std::vector<TextRow>& rows)` draws:

1. A filled rect with `kPanelFill`.
2. A 1 px outline with `kPanelBorder`.
3. The title in `kPanelHeader` (top, padded).
4. Each `TextRow` with its own colour and an optional bullet, prefix
   marker (`>` for selected), and trailing badge (e.g. amount).

All sub-screens are composed of repeated calls to `drawTextPanel` and
`drawProgressBar`.

## Pause / main menu

### Layout

```
+----------------------------------------------------------+
|  [ MENU ]                                                |
|                                                          |
|    > Inventory                                           |
|      Party                                               |
|      Quests                                              |
|      Save                                                |
|      Load                                                |
|      Close                                               |
|                                                          |
+----------------------------------------------------------+
```

### Behaviour

- Opens on `Escape` when no dialogue, choice, shop, or battle is active.
- Player movement, EventRunner advancement, and battle ticking are
  paused.
- Up / Down moves the `>` marker; `Enter` opens the sub-screen.
- `Escape` closes the menu and resumes the game.

### Closed sub-screens

`Close` is identical to pressing `Escape`.

## Inventory sub-screen

### Layout

```
+----------------------------------------------------------+
|  [ INVENTORY ]                                           |
|                                                          |
|    > potion           x 03   Restores 30 HP.             |
|      ether            x 01   Restores 20 MP.             |
|      iron_sword       x 01   +5 ATK.                     |
|                                                          |
|    [ ESC ] back                                          |
+----------------------------------------------------------+
```

### Behaviour

- Rows are sorted alphabetically by item id (deterministic for tests
  and screenshots).
- Selected row's description appears inline (or below the list if the
  description is long).
- Items not declared in the database render as
  `<id>          x <amount>   (unknown item)` — the UI never crashes on
  missing metadata.
- `Escape` returns to the root menu.
- v1 does not support "use" from the menu; the description is read-only.

## Party / status sub-screen

### Layout

```
+----------------------------------------------------------+
|  [ PARTY ]                                               |
|                                                          |
|  > Arc the Brave   Hero  Lv 4                            |
|       HP  18 / 24   MP   5 / 12                          |
|       ATK 12  DEF  6  AGI 8  LUK 4                       |
|       Weapon: iron_sword   Armor: -   Accessory: -       |
|                                                          |
|    Mira the Healer   Cleric  Lv 3                        |
|       HP  16 / 16   MP   8 / 14                          |
|       ATK  6  DEF  8  AGI 6  LUK 6                       |
|       Weapon: oak_staff   Armor: -   Accessory: -        |
|                                                          |
|    [ ESC ] back                                          |
+----------------------------------------------------------+
```

### Behaviour

- Rows are in the order of `GameState.party`.
- Stats include base + class growth + equipment modifiers and match the
  resolver used by `BattleSystem` so what the player sees equals what
  the battle uses.
- HP override comes from `GameState.actorHps` if present.
- Empty party renders `No party members` and `Escape` returns to root.

## Quest journal sub-screen

### Layout

```
+----------------------------------------------------------+
|  [ QUEST JOURNAL ]                                       |
|                                                          |
|  ACTIVE                                                  |
|  > The Lost Chest                                        |
|       Old man's chest is missing somewhere in the house. |
|       [x] Talk to the old man                            |
|       [ ] Open the chest                                 |
|       [ ] Return to the old man                          |
|                                                          |
|  COMPLETED                                               |
|    Tutorial Walk                                         |
|       The mayor's first errand.                          |
|                                                          |
|    [ ESC ] back                                          |
+----------------------------------------------------------+
```

### Behaviour

- Three groups: `Active`, `Completed`, `Failed`. Empty groups are
  hidden. Inactive (declared but not started) quests do not appear.
- For each shown quest, render title + summary + objectives with
  `[ ]` for `open` and `[x]` for `done`.
- Missing database entry → render the raw quest id with
  `(unknown quest)`.
- Up / Down scrolls through quests. `Escape` returns.

## Save / load slot picker

### Layout

```
+----------------------------------------------------------+
|  [ SAVE ]                                                |
|                                                          |
|  > Slot 1   town   50g   arc                 2026-05-16  |
|    Slot 2   Empty                                        |
|    Slot 3   house  120g  arc, mira           2026-05-15  |
|                                                          |
|    [ ENTER ] confirm   [ ESC ] back                      |
+----------------------------------------------------------+
```

### Behaviour

- 3 slots in v1 (file paths `saves/slot_1.json`, `saves/slot_2.json`,
  `saves/slot_3.json`).
- Each slot row shows: `Slot N   <mapId>   <gold>g   <party>   <date>`,
  or `Slot N   Empty` when the file does not exist.
- `Save` on a non-empty slot displays a confirm prompt:

  ```
  +----------------------------+
  |  Overwrite Slot 1 ?        |
  |                            |
  |    [ Y ] yes   [ N ] no    |
  +----------------------------+
  ```

- `Load` on an empty slot is disabled (rendered with `kPanelDim`).
- After a successful save or load, a 1.5 s toast `Saved to slot 1`
  appears at the bottom of the menu, then the menu closes.

### Format

Saves use the existing schemaVersion 2 format from Phase 6. No
migration. `mtime` is read from disk, not stored in the file.

## Shop UI

### Layout

```
+----------------------------------------------------------+
|  [ TOWN GENERAL STORE ]               Gold:   50g        |
|                                                          |
|  > potion             10g                                |
|    ether              25g                                |
|    iron_sword        100g            (not enough gold)   |
|                                                          |
|    [ ENTER ] buy   [ ESC ] close                         |
+----------------------------------------------------------+
```

### Behaviour

- Opens when `EventRunner` executes `openShop(shopId)`. The Phase 6
  dialogue stub is removed.
- Lists `(itemId, price)` rows from the shop database; each row marks
  affordability against current gold.
- `Enter` on an affordable row deducts `price` gold and adds the item
  in a single atomic transaction.
- `Enter` on an unaffordable row shows `Not enough gold.` for ~1 s; no
  state changes.
- `Escape` closes the shop and resumes `EventRunner` after the
  `openShop` command.

### Edge cases

- An item id not present in the items database still appears in the
  listings (the shop database is the source of truth for what's for
  sale) but renders with `(unknown item)`.
- A shop id that doesn't exist falls back to a 1-line error message
  and an immediate close, identical to Phase 6 behaviour.

## Battle UI

### Layout

```
+----------------------------------------------------------+
|  [ BATTLE ]                                              |
|                                                          |
|  Enemies                                                 |
|    Slime           HP   8 /  8   ###############         |
|    Slime           HP   0 /  8   (defeated)              |
|                                                          |
|  Party                                                   |
|    Arc the Brave   HP  18 / 24   ##########              |
|    Mira the Healer HP  16 / 16   ###############         |
|                                                          |
|  Turn log                                                |
|    > Arc attacks Slime for 7 damage.                     |
|      Slime attacks Arc for 3 damage.                     |
|      Arc attacks Slime for 7 damage. (defeated)          |
|                                                          |
|                                                          |
|  >>> VICTORY <<<                                         |
|  Rewards: 12 exp, 8g, potion x1                          |
|                                                          |
|    [ ENTER ] continue                                    |
+----------------------------------------------------------+
```

### Behaviour

- `BattleResolver` runs the existing Phase 6 `BattleSystem` math at
  battle start and produces an ordered turn list. The math is unchanged.
- `BattleUI::tick(dt)` advances a deterministic counter (e.g. one turn
  per 250 ms of simulated time). Tests step the counter directly.
- HP bars animate down to the next value over ~150 ms (cosmetic only).
- The most recent ~6 turns appear in the log; older lines scroll off.
- On `isFinished()` the panel shows the outcome banner (`Victory`,
  `Defeat`, `Escape`) and the rewards summary; `Enter` resumes the
  EventRunner with the same victory / defeat branch dispatching as
  Phase 6.
- The UI never introduces real RNG. `BattleSystem::computeDamage` stays
  the deterministic source of truth.

## Class diagram (runtime UI)

```
+--------------------+
|  Game              |
|                    |
| - menuSystem       |---owns---+
| - shopMenuSystem   |---owns---+
| - battleUI         |---owns---+
| - eventRunner      |          |
+----------+---------+          |
           |                    |
           | (input pause)      |
           v                    |
+----------+--------+   +-------+--------+   +----------------+
|   MenuSystem      |   | ShopMenuSystem |   |   BattleUI      |
|   - screen        |   | - shop         |   |   - resolver    |
|   - selection     |   | - selection    |   |   - turn log    |
|   - sub-screens   |   | - message      |   |   - frame ctr   |
+-------------------+   +----------------+   +-----------------+
        |                       |                    |
        |  snapshot()           |  snapshot()        |  snapshot()
        v                       v                    v
+----------------------------- Renderer2D ----------------------------+
| - drawTextPanel  - renderMenuPanel - renderShopPanel - renderBattle |
+----------------------------------------------------------------------+
```

`Game::update` order while a UI is active:

```
if menuSystem.isOpen():           menuSystem.handleInput(input)
elif shopMenuSystem.isOpen():     shopMenuSystem.handleInput(input)
elif battleUI.isFinished() == false: battleUI.tick(dt)
elif dialogue.isActive():         dialogue update path (existing)
else:                             player + eventRunner update path (existing)
```

`Game::render` calls each renderer hook conditionally so panels stack
predictably (a battle panel covers a dialogue panel; a menu panel
covers a battle panel).

## Test hooks

- `MenuSystem::snapshot(...)` returns a deterministic `ViewModel` so
  tests can assert composition without touching SDL.
- `ShopMenuSystem::tryBuy(state, dbs)` is the test entry point for the
  buy transaction; it does not need rendering.
- `BattleUI::start(turnList, ...)` accepts a pre-computed turn list so
  tests can inject a known sequence.
- `SaveManager::listSlots(maxSlots)` is the test entry point for the
  slot picker; it returns a vector of metadata that is sortable and
  comparable in fixtures.
