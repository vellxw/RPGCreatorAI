# Bootstrap test sources — explicit list (no GLOB) so out-of-scope tests
# from prior prototype iterations are not silently picked up by the build.
# See docs/FUTURE_TESTS.md for tests deferred to later phases.
set(BOOTSTRAP_TEST_SOURCES
    main_test.cpp
    test_project_loader.cpp
    test_event_runner.cpp
    test_collision.cpp
)

add_executable(rpg_tests ${BOOTSTRAP_TEST_SOURCES})

target_link_libraries(rpg_tests PRIVATE RuntimeLib doctest::doctest)

# Register test (run from project root so data/ paths resolve correctly)
add_test(NAME RPGTests COMMAND rpg_tests)
set_tests_properties(RPGTests PROPERTIES WORKING_DIRECTORY ${CMAKE_SOURCE_DIR})
