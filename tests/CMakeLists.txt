# Phase 2 test target — explicit source list (no GLOB) so out-of-scope
# tests cannot be picked up silently. Render-level tests are intentionally
# omitted; render is validated via the runtime smoke check.
set(PHASE2_TEST_SOURCES
    main_test.cpp
    test_project_loader.cpp
    test_map_loader.cpp
    test_collision.cpp
    test_event_runner.cpp
    test_game_state.cpp
    test_save_manager.cpp
    test_battle_system.cpp
)

add_executable(rpg_tests ${PHASE2_TEST_SOURCES})

target_link_libraries(rpg_tests PRIVATE RuntimeLib doctest::doctest)

add_test(NAME RPGTests COMMAND rpg_tests)
set_tests_properties(RPGTests PROPERTIES WORKING_DIRECTORY ${CMAKE_SOURCE_DIR})
