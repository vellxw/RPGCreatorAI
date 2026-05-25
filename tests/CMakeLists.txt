# Phase 2 test target — explicit source list (no GLOB) so out-of-scope
# tests cannot be picked up silently. Render-level tests are intentionally
# omitted; render is validated via the runtime smoke check.
set(PHASE2_TEST_SOURCES
    main_test.cpp
    test_project_loader.cpp
    test_map_loader.cpp
    test_camera.cpp
    test_collision.cpp
    test_player_motion.cpp
    test_event_runner.cpp
    test_game_state.cpp
    test_save_manager.cpp
    test_animation_database.cpp
    test_battle_system.cpp
    test_battle_summary_system.cpp
    test_sprite_catalog.cpp
    test_menu_system.cpp
    test_shop_system.cpp
    test_tileset_runtime_data.cpp
    test_event_page_evaluator.cpp
    test_event_scheduler.cpp
    test_game_movement_route.cpp
)

add_executable(rpg_tests ${PHASE2_TEST_SOURCES})

target_link_libraries(rpg_tests PRIVATE RuntimeLib doctest::doctest)

add_test(NAME RPGTests COMMAND rpg_tests)
set_tests_properties(RPGTests PROPERTIES WORKING_DIRECTORY ${CMAKE_SOURCE_DIR})
