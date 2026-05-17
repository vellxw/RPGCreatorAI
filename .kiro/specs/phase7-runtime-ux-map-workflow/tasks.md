# Phase 7 — Tasks

Phase 7 ships in 11 vertical slices. Every slice is built, tested,
committed, and pushed before the next starts. Nothing in this phase is
half-wired.

## Slice 0 — Original asset foundation

- [x] 0.1 Generate and commit original asset atlases plus derived editor
      PNGs / runtime BMPs under `src/assets/generated/` and
      `assets/generated/`.
- [x] 0.2 Replace production emoji placeholders in editor / playtest UI
      with generated assets or proper vector icons.
- [x] 0.3 Add runtime sprite lookup + BMP texture loading so maps and
      entities render committed sprites instead of only color blocks.
- [x] 0.4 Update the bundled sample maps to reference concrete sprite ids.
- [x] 0.5 Add tests for the asset catalog and sprite catalog.
- [x] 0.6 Validate frontend build/tests, runtime build/tests, smoke, and
      visual smoke screenshots.
- [ ] 0.7 Commit + push.

## Slice 1 — Runtime pause / main menu skeleton

- [x] 1.1 Add `src/runtime/MenuSystem.{h,cpp}` with `MenuScreen` enum,
      `open/close/isOpen/current`, root selection state, and
      `handleInput` for arrow keys + Enter + Escape.
- [x] 1.2 Wire `MenuSystem` into `Game`: open on `Escape`, short-circuit
      player movement, EventRunner advancement, and battle ticking
      while open.
- [x] 1.3 Extend `Renderer2D` with a shared `drawTextPanel` primitive
      and a `renderMenuPanel(const MenuSystem::ViewModel&)` that draws
      the root list using `BitmapFont`.
- [x] 1.4 Add `tests/test_menu_system.cpp` covering open/close, key
      navigation, and root selection cycling.
- [x] 1.5 Build (`scripts\dev\verify-runtime.bat`), confirm RPGTests
      pass, smoke runtime once.
- [ ] 1.6 Commit + push.

## Slice 2 — Inventory, Party, Quests views

- [ ] 2.1 Extend `MenuSystem::ViewModel` with `InventoryRow`,
      `PartyRow`, `QuestRow` and a `snapshot(state, dbs, saves)` method.
- [ ] 2.2 Implement deterministic sorting (alphabetical by id for
      inventory, party order for actors, grouped by state for quests).
- [ ] 2.3 Renderer draws each sub-screen via `drawTextPanel` rows; add
      scrolling when rows exceed panel height.
- [ ] 2.4 Inventory selection shows description from `RpgDatabases`.
- [ ] 2.5 Tests in `test_menu_system.cpp` for snapshot composition with
      a mocked database (party stat resolver matches `BattleSystem`).
- [ ] 2.6 Build, test, commit, push.

## Slice 3 — Save / load slot picker

- [ ] 3.1 Add `SaveManager::listSlots(int maxSlots)` returning
      `std::vector<SlotMetadata>` (index, exists, mapId, gold, party,
      mtimeUnix).
- [ ] 3.2 Add Save and Load sub-screens to `MenuSystem` with overwrite
      confirmation for non-empty Save slots and disabled empty Load
      slots.
- [ ] 3.3 Renderer draws the slot list with the human summary.
- [ ] 3.4 `Game::saveGame` / `Game::loadGameFromDisk` accept a slot
      index parameter; default kept at `slot_1` for back-compat with
      existing F5/F9 keys.
- [ ] 3.5 Tests: `test_save_manager.cpp` extended to cover `listSlots`
      with empty + populated saves directory; `test_menu_system.cpp`
      covers slot picker navigation + overwrite confirm path.
- [ ] 3.6 Smoke: open menu, walk to Save → slot 1 → confirm overwrite,
      reload from slot 1, assert game state restored.
- [ ] 3.7 Commit + push.

## Slice 4 — Shop UI

- [ ] 4.1 Add `src/runtime/ShopMenuSystem.{h,cpp}` with
      `open/close/isOpen`, `handleInput`, `tryBuy`, and `snapshot`.
- [ ] 4.2 Rewire `EventRunner::resolveOpenShop` to call
      `shopMenuSystem.open(shop)` and pause until close (drop the
      Phase 6 dialogue stub line).
- [ ] 4.3 Renderer adds `renderShopPanel` (shop name, gold, listings,
      selection, message line for "Not enough gold.").
- [ ] 4.4 Insufficient-gold and successful-buy paths update `GameState`
      atomically; close resumes `EventRunner`.
- [ ] 4.5 Tests in `tests/test_shop_menu_system.cpp` for both buy paths
      and resume; vitest equivalent for the data path on the editor
      side (already covered, extend as needed).
- [ ] 4.6 Build, test, smoke, commit, push.

## Slice 5 — Battle UI

- [ ] 5.1 Add `src/runtime/BattleResolver.{h,cpp}` that runs the
      Phase 6 `BattleSystem` math and emits an ordered `BattleTurn`
      list.
- [ ] 5.2 Add `src/runtime/BattleUI.{h,cpp}` with `start/tick/isFinished
      /result/snapshot`. `tick(dt)` advances by a deterministic counter
      so tests can step it without real time.
- [ ] 5.3 Rewire `EventRunner` start-battle to populate `BattleUI` and
      pause until `isFinished()`; victory/defeat branches stay
      identical.
- [ ] 5.4 Renderer adds `renderBattlePanel` (party + enemies HP bars,
      turn log, outcome banner, rewards summary).
- [ ] 5.5 Tests in `tests/test_battle_ui.cpp`: pre-computed turns equal
      `BattleSystem::run` outcome; rewards match.
- [ ] 5.6 Build, test, smoke, commit, push.

## Slice 6 — Editor undo / redo + history middleware

- [ ] 6.1 Create `src/stores/historyMiddleware.ts` wrapping the project
      reducer; track `past/present/future` with `HISTORY_LIMIT = 100`.
- [ ] 6.2 Add `BEGIN_STROKE` / `END_STROKE` action pair for paint drag
      coalescing.
- [ ] 6.3 Add `UNDO` / `REDO` actions; clear `future` on tracked
      mutations.
- [ ] 6.4 Hook `Ctrl+Z` and `Ctrl+Y` / `Ctrl+Shift+Z` global shortcuts
      in `App.tsx` (only when the editor screen is active).
- [ ] 6.5 Vitest: `historyMiddleware.test.ts` covers push, undo/redo,
      coalescing, bounded length, untracked-action passthrough.
- [ ] 6.6 Build (`npx tsc --noEmit`, `npx vitest run`, `npx vite
      build`), commit, push.

## Slice 7 — Tile painting + collision painting

- [ ] 7.1 Extend `EditorState` with `tool`, `selectedTileId`, and
      `activeLayer`; add `SET_TOOL`, `SET_SELECTED_TILE`,
      `SET_ACTIVE_LAYER` actions.
- [ ] 7.2 Add reducer actions `PAINT_TILE`, `PAINT_TILE_STROKE`,
      `TOGGLE_COLLISION` to `projectReducer`.
- [ ] 7.3 Update `TilePalette` to show tool buttons (paint, eraser,
      collision, event, select), bind palette colors to integer tile
      ids per layer, and dispatch `SET_*` actions.
- [ ] 7.4 Update `MapCanvas` to draw the active layer correctly and
      render a collision overlay when `activeLayer === 'collision'`.
- [ ] 7.5 Add mouse paint handlers on the canvas (mousedown +
      mousemove + mouseup) that wrap drags in `BEGIN_STROKE` /
      `END_STROKE` and dispatch one `PAINT_TILE_STROKE` per cell
      entered. Clamp to map bounds.
- [ ] 7.6 Vitest: `projectReducer.paint.test.ts` and
      `editorStore.test.ts` cover all new actions and transitions.
- [ ] 7.7 Build, test, commit, push.

## Slice 8 — Event placement / move / duplicate / delete

- [ ] 8.1 Add reducer actions `PLACE_EVENT`, `MOVE_EVENT`,
      `DUPLICATE_EVENT`, `DELETE_EVENT`.
- [ ] 8.2 `MapCanvas` event-mode click on empty cell dispatches
      `PLACE_EVENT` with a freshly generated unique id and minimal
      defaults.
- [ ] 8.3 Drag selected event in select mode dispatches `MOVE_EVENT`
      clamped to map bounds; release commits position.
- [ ] 8.4 Inspector / canvas exposes Duplicate (also `Ctrl+D`) and
      Delete (also `Delete` key) buttons; deletion is gated by a
      confirm prompt.
- [ ] 8.5 Validator extended to assert per-map event id uniqueness as a
      post-condition.
- [ ] 8.6 Vitest: `projectReducer.events.test.ts` covers each action,
      including unique-id generation, deep-clone of commands on
      duplicate, and clamp-to-bounds on move.
- [ ] 8.7 Build, test, commit, push.

## Slice 9 — End-to-end editor → runtime QA

- [ ] 9.1 Author `docs/EDITOR_RUNTIME_E2E_QA.md` with the full manual
      flow (paint a tile, toggle a collision, place an event, save,
      launch runtime, verify on-screen).
- [ ] 9.2 Add vitest e2e `src/e2e/__tests__/editorRoundtrip.test.ts`:
      seed adapter, dispatch reducer mutations, save through the same
      action the toolbar uses, re-read JSON, assert the change.
- [ ] 9.3 Capture screenshots from a real session into
      `docs/screenshots/phase-7/` (or, if the runtime can't be launched
      in this environment, document the limitation honestly per
      AGENTS.md global rule 1–4).
- [ ] 9.4 Tauri content regression check unchanged
      (`npm run desktop:verify-content`); document run + result.
- [ ] 9.5 Commit + push.

## Slice 10 — Final validation + report

- [ ] 10.1 `npx tsc --noEmit` — exit 0.
- [ ] 10.2 `npx vite build` — exit 0.
- [ ] 10.3 `npx vitest run` — all tests pass.
- [ ] 10.4 `cargo test --manifest-path src-tauri/Cargo.toml --lib` —
      pass.
- [ ] 10.5 `cargo build --manifest-path src-tauri/Cargo.toml` — pass.
- [ ] 10.6 `scripts\dev\verify-runtime.bat` — runtime build + ctest
      pass.
- [ ] 10.7 `scripts\dev\smoke-runtime.bat` — runtime spawns and logs
      project + databases + map.
- [ ] 10.8 Append a new "Phase 7" section to
      `docs/VALIDATION_LOG.md` with all the commands and outcomes.
- [ ] 10.9 Update `docs/RPG_SYSTEMS_MATRIX.md` (shop graduates from
      `impl` to `val`; menu-related rows graduate as appropriate).
- [ ] 10.10 Update `docs/GOAL_STACK.md` to close Phase 7 and surface
      the next-phase candidate.
- [ ] 10.11 Write `docs/PHASE_7_VALIDATION_REPORT.md` with implemented
      features, exact validation commands and results, runtime smoke
      result, files changed summary, commit hash, push result, and
      known limitations.
- [ ] 10.12 Final commit + push.
