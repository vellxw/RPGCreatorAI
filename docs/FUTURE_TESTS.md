# Future Tests (deferred from Phase 1 Bootstrap)

The Phase 1 bootstrap deliverable intentionally limits `EventRunner` to logging
warnings for any command type and excludes `SaveManager` from runtime
invocation. Tests below were removed from the bootstrap test target
(`tests/CMakeLists.txt`) because they require behavior outside the bootstrap
scope. They are documented here so they can be reintroduced when the
corresponding feature is implemented in a later phase.

## test_transfer_map (originally `tests/test_transfer_map.cpp`)

**Defer until:** the phase that implements concrete `transferMap` execution in
`EventRunner`.

**Intent of the test:**
- Build an `EventCommand` with `type == "transferMap"`, `mapId`, `x`, `y`, `direction`.
- Run it through `EventRunner::runCommandList({cmd})` + `EventRunner::update(dt)`.
- Verify that `EventRunner::consumeTransferRequest()` returns:
  - `active == true`
  - `mapId`, `targetX`, `targetY`, `direction` populated from the command.
- Verify a second `consumeTransferRequest()` call returns `active == false`
  (the request must be reset on consume).

**Why deferred:** the bootstrap spec (Requirement 6.7, 6.8) requires
`EventRunner` to emit `Logger::warning` for every command type and continue,
without executing concrete behavior. Implementing `transferMap` would violate
that scope.

## test_save_manager (originally `tests/test_save_manager.cpp`)

**Defer until:** the phase that introduces save/load functionality.

**Intent of the test:**
- Populate a `GameState` (current map, player position, flag, inventory item).
- Call `SaveManager::save(slot, state)` and assert it returns `true`.
- Assert `SaveManager::hasSave(slot) == true`.
- Call `SaveManager::load(slot)` and assert the returned `GameState` matches
  the original on map id, player position, direction, flag value, and item
  counts (including a negative case for an item not in the inventory).

**Why deferred:** save/load is explicitly excluded from the Phase 1 bootstrap
scope. `SaveManager.{h,cpp}` exist in the source tree from a prior prototype
iteration and compile into `RuntimeLib`, but no bootstrap path invokes them.

## Re-enable procedure

When a later phase implements the matching feature:

1. Recreate the test file under `tests/` (the original code is preserved in
   the repository history if this commit is committed before deletion).
2. Add the filename to `BOOTSTRAP_TEST_SOURCES` (or whatever the test target
   list is named at that point) in `tests/CMakeLists.txt`.
3. Run `ctest --test-dir build --output-on-failure` to confirm.
