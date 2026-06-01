#include <doctest/doctest.h>
#include "core/Game.h"
#include "platform/Window.h"
#include <cstdio>
#include <fstream>
#include <utility>
#include <vector>

namespace {

std::string writeTempMap(const std::string& name, const std::string& content) {
    std::string path = "test_tmp_" + name;
    std::ofstream out(path);
    out << content;
    return path;
}

void removeTempMap(const std::string& path) {
    std::remove(path.c_str());
}

ProjectData makeProject(const std::string& mapPath) {
    ProjectData project;
    project.schemaVersion = 1;
    project.title = "Route Test";
    project.startMapId = "route_map";
    project.startPosition.pos = {0, 0};
    project.startPosition.direction = Direction::Down;
    project.maps.push_back({"route_map", mapPath});
    return project;
}

ProjectData makeProjectWithMaps(std::vector<MapReference> maps) {
    ProjectData project;
    project.schemaVersion = 1;
    project.title = "Route Test";
    project.startMapId = "route_map";
    project.startPosition.pos = {0, 0};
    project.startPosition.direction = Direction::Down;
    project.maps = std::move(maps);
    return project;
}

void pump(Game& game, float dt = 0.016f) {
    game.pumpEvents(dt);
}

} // namespace

TEST_CASE("Game player movement route triggers touch events at destination") {
    const std::string mapPath = writeTempMap("route_touch_map.json", R"({
        "schemaVersion": 1, "id": "route_map", "name": "Route Map",
        "width": 3, "height": 2, "tileSize": 32,
        "layers": [
            { "name": "ground", "type": "visual", "tiles": [1,1,1,1,1,1] },
            { "name": "collision", "type": "collision", "tiles": [0,0,0,0,0,0] }
        ],
        "events": [
            {
                "id": "router", "type": "npc", "x": 0, "y": 1, "solid": false,
                "trigger": "interact",
                "commands": [
                    {
                        "type": "setMovementRoute",
                        "target": "player",
                        "wait": true,
                        "skippable": true,
                        "repeat": false,
                        "steps": [{ "type": "moveRight" }]
                    }
                ]
            },
            {
                "id": "touch_flag", "type": "npc", "x": 1, "y": 0, "solid": false,
                "trigger": "touch",
                "commands": [{ "type": "setFlag", "flag": "touch_fired", "value": true }]
            }
        ]
    })");

    Window window;
    Game game;
    REQUIRE(game.initialize(window, makeProject(mapPath)));

    game.stepInteract();
    pump(game);
    pump(game, 0.2f);
    pump(game);

    CHECK(game.getGameState().getPlayerX() == 1);
    CHECK(game.getGameState().getPlayerY() == 0);
    CHECK(game.getGameState().getFlag("touch_fired"));
    removeTempMap(mapPath);
}

TEST_CASE("Game waits before continuing after wait-enabled player movement route") {
    const std::string mapPath = writeTempMap("route_wait_map.json", R"({
        "schemaVersion": 1, "id": "route_map", "name": "Route Map",
        "width": 4, "height": 2, "tileSize": 32,
        "layers": [
            { "name": "ground", "type": "visual", "tiles": [1,1,1,1,1,1,1,1] },
            { "name": "collision", "type": "collision", "tiles": [0,0,0,0,0,0,0,0] }
        ],
        "events": [
            {
                "id": "router", "type": "npc", "x": 0, "y": 1, "solid": false,
                "trigger": "interact",
                "commands": [
                    {
                        "type": "setMovementRoute",
                        "target": "player",
                        "wait": true,
                        "skippable": true,
                        "repeat": false,
                        "steps": [
                            { "type": "moveRight" },
                            { "type": "moveRight" }
                        ]
                    },
                    { "type": "setFlag", "flag": "after_route", "value": true }
                ]
            }
        ]
    })");

    Window window;
    Game game;
    REQUIRE(game.initialize(window, makeProject(mapPath)));

    game.stepInteract();
    pump(game);
    pump(game, 0.016f);

    CHECK(game.getGameState().getPlayerX() == 2);
    CHECK_FALSE(game.getGameState().getFlag("after_route"));

    pump(game, 0.3f);

    CHECK(game.getGameState().getFlag("after_route"));
    removeTempMap(mapPath);
}

TEST_CASE("Game event movement route moves named event without mutating authored map data") {
    const std::string mapPath = writeTempMap("event_route_named_map.json", R"({
        "schemaVersion": 1, "id": "route_map", "name": "Route Map",
        "width": 4, "height": 2, "tileSize": 32,
        "layers": [
            { "name": "ground", "type": "visual", "tiles": [1,1,1,1,1,1,1,1] },
            { "name": "collision", "type": "collision", "tiles": [0,0,0,0,0,0,0,0] }
        ],
        "events": [
            {
                "id": "router", "type": "npc", "x": 0, "y": 1, "solid": false,
                "trigger": "interact",
                "commands": [
                    {
                        "type": "setMovementRoute",
                        "target": "event",
                        "eventId": "mover",
                        "wait": false,
                        "skippable": true,
                        "repeat": false,
                        "steps": [{ "type": "moveRight" }]
                    }
                ]
            },
            { "id": "mover", "type": "npc", "x": 1, "y": 1, "solid": true, "trigger": "interact", "commands": [] }
        ]
    })");

    Window window;
    Game game;
    REQUIRE(game.initialize(window, makeProject(mapPath)));

    game.stepInteract();
    pump(game);

    const auto moved = game.getCurrentScene().getRuntimeEventPosition("mover");
    REQUIRE(moved.has_value());
    CHECK(moved->x == 2);
    CHECK(moved->y == 1);
    REQUIRE(game.getCurrentScene().getEventAt(2, 1) != nullptr);
    CHECK(game.getCurrentScene().getEventAt(2, 1)->id == "mover");
    REQUIRE(game.getCurrentScene().getData().events.size() == 2);
    CHECK(game.getCurrentScene().getData().events[1].x == 1);
    CHECK(game.getCurrentScene().getData().events[1].y == 1);
    removeTempMap(mapPath);
}

TEST_CASE("Game thisEvent movement route moves the owning event") {
    const std::string mapPath = writeTempMap("event_route_this_event_map.json", R"({
        "schemaVersion": 1, "id": "route_map", "name": "Route Map",
        "width": 3, "height": 2, "tileSize": 32,
        "layers": [
            { "name": "ground", "type": "visual", "tiles": [1,1,1,1,1,1] },
            { "name": "collision", "type": "collision", "tiles": [0,0,0,0,0,0] }
        ],
        "events": [
            {
                "id": "router", "type": "npc", "x": 0, "y": 1, "solid": false,
                "trigger": "interact",
                "commands": [
                    {
                        "type": "setMovementRoute",
                        "target": "thisEvent",
                        "wait": false,
                        "skippable": true,
                        "repeat": false,
                        "steps": [{ "type": "moveRight" }]
                    }
                ]
            }
        ]
    })");

    Window window;
    Game game;
    REQUIRE(game.initialize(window, makeProject(mapPath)));

    game.stepInteract();
    pump(game);

    const auto router = game.getCurrentScene().getRuntimeEventPosition("router");
    REQUIRE(router.has_value());
    CHECK(router->x == 1);
    CHECK(router->y == 1);
    removeTempMap(mapPath);
}

TEST_CASE("Game event route skips blocked steps and waits before tail commands") {
    const std::string mapPath = writeTempMap("event_route_skippable_wait_map.json", R"({
        "schemaVersion": 1, "id": "route_map", "name": "Route Map",
        "width": 3, "height": 3, "tileSize": 32,
        "layers": [
            { "name": "ground", "type": "visual", "tiles": [1,1,1,1,1,1,1,1,1] },
            { "name": "collision", "type": "collision", "tiles": [0,0,0,0,0,0,0,0,0] }
        ],
        "events": [
            {
                "id": "router", "type": "npc", "x": 0, "y": 1, "solid": false,
                "trigger": "interact",
                "commands": [
                    {
                        "type": "setMovementRoute",
                        "target": "event",
                        "eventId": "mover",
                        "wait": true,
                        "skippable": true,
                        "repeat": false,
                        "steps": [
                            { "type": "moveRight" },
                            { "type": "moveDown" }
                        ]
                    },
                    { "type": "setFlag", "flag": "after_route", "value": true }
                ]
            },
            { "id": "mover", "type": "npc", "x": 1, "y": 1, "solid": true, "trigger": "interact", "commands": [] },
            { "id": "blocker", "type": "npc", "x": 2, "y": 1, "solid": true, "trigger": "interact", "commands": [] }
        ]
    })");

    Window window;
    Game game;
    REQUIRE(game.initialize(window, makeProject(mapPath)));

    game.stepInteract();
    pump(game);
    pump(game, 0.016f);

    const auto mover = game.getCurrentScene().getRuntimeEventPosition("mover");
    REQUIRE(mover.has_value());
    CHECK(mover->x == 1);
    CHECK(mover->y == 2);
    CHECK_FALSE(game.getGameState().getFlag("after_route"));

    pump(game, 0.3f);

    CHECK(game.getGameState().getFlag("after_route"));
    removeTempMap(mapPath);
}

TEST_CASE("Game event route stops on blocked non-skippable step") {
    const std::string mapPath = writeTempMap("event_route_blocked_map.json", R"({
        "schemaVersion": 1, "id": "route_map", "name": "Route Map",
        "width": 3, "height": 3, "tileSize": 32,
        "layers": [
            { "name": "ground", "type": "visual", "tiles": [1,1,1,1,1,1,1,1,1] },
            { "name": "collision", "type": "collision", "tiles": [0,0,0,0,0,0,0,0,0] }
        ],
        "events": [
            {
                "id": "router", "type": "npc", "x": 0, "y": 1, "solid": false,
                "trigger": "interact",
                "commands": [
                    {
                        "type": "setMovementRoute",
                        "target": "event",
                        "eventId": "mover",
                        "wait": true,
                        "skippable": false,
                        "repeat": false,
                        "steps": [
                            { "type": "moveRight" },
                            { "type": "moveDown" }
                        ]
                    },
                    { "type": "setFlag", "flag": "after_route", "value": true }
                ]
            },
            { "id": "mover", "type": "npc", "x": 1, "y": 1, "solid": true, "trigger": "interact", "commands": [] },
            { "id": "blocker", "type": "npc", "x": 2, "y": 1, "solid": true, "trigger": "interact", "commands": [] }
        ]
    })");

    Window window;
    Game game;
    REQUIRE(game.initialize(window, makeProject(mapPath)));

    game.stepInteract();
    pump(game);
    pump(game, 0.016f);

    const auto mover = game.getCurrentScene().getRuntimeEventPosition("mover");
    REQUIRE(mover.has_value());
    CHECK(mover->x == 1);
    CHECK(mover->y == 1);
    CHECK_FALSE(game.getGameState().getFlag("after_route"));

    pump(game, 0.2f);

    CHECK(game.getGameState().getFlag("after_route"));
    removeTempMap(mapPath);
}

TEST_CASE("Game repeat event route uses deterministic guard instead of locking") {
    const std::string mapPath = writeTempMap("event_route_repeat_map.json", R"({
        "schemaVersion": 1, "id": "route_map", "name": "Route Map",
        "width": 4, "height": 2, "tileSize": 32,
        "layers": [
            { "name": "ground", "type": "visual", "tiles": [1,1,1,1,1,1,1,1] },
            { "name": "collision", "type": "collision", "tiles": [0,0,0,0,0,0,0,0] }
        ],
        "events": [
            {
                "id": "router", "type": "npc", "x": 0, "y": 1, "solid": false,
                "trigger": "interact",
                "commands": [
                    {
                        "type": "setMovementRoute",
                        "target": "event",
                        "eventId": "mover",
                        "wait": false,
                        "skippable": true,
                        "repeat": true,
                        "steps": [{ "type": "moveRight" }]
                    },
                    { "type": "setFlag", "flag": "after_route", "value": true }
                ]
            },
            { "id": "mover", "type": "npc", "x": 1, "y": 1, "solid": true, "trigger": "interact", "commands": [] }
        ]
    })");

    Window window;
    Game game;
    REQUIRE(game.initialize(window, makeProject(mapPath)));

    game.stepInteract();
    pump(game);
    pump(game);

    const auto mover = game.getCurrentScene().getRuntimeEventPosition("mover");
    REQUIRE(mover.has_value());
    CHECK(mover->x == 3);
    CHECK(mover->y == 1);
    CHECK(game.getGameState().getFlag("after_route"));
    removeTempMap(mapPath);
}

TEST_CASE("Game transfer reload clears previous map event runtime state") {
    const std::string firstMapPath = writeTempMap("event_route_transfer_a.json", R"({
        "schemaVersion": 1, "id": "route_map", "name": "Route Map A",
        "width": 4, "height": 2, "tileSize": 32,
        "layers": [
            { "name": "ground", "type": "visual", "tiles": [1,1,1,1,1,1,1,1] },
            { "name": "collision", "type": "collision", "tiles": [0,0,0,0,0,0,0,0] }
        ],
        "events": [
            {
                "id": "router", "type": "npc", "x": 0, "y": 1, "solid": false,
                "trigger": "interact",
                "commands": [
                    {
                        "type": "setMovementRoute",
                        "target": "event",
                        "eventId": "mover",
                        "wait": false,
                        "skippable": true,
                        "repeat": false,
                        "steps": [{ "type": "moveRight" }]
                    },
                    { "type": "transferMap", "mapId": "route_map_b", "x": 0, "y": 0, "direction": "down" }
                ]
            },
            { "id": "mover", "type": "npc", "x": 1, "y": 1, "solid": true, "trigger": "interact", "commands": [] }
        ]
    })");
    const std::string secondMapPath = writeTempMap("event_route_transfer_b.json", R"({
        "schemaVersion": 1, "id": "route_map_b", "name": "Route Map B",
        "width": 4, "height": 2, "tileSize": 32,
        "layers": [
            { "name": "ground", "type": "visual", "tiles": [1,1,1,1,1,1,1,1] },
            { "name": "collision", "type": "collision", "tiles": [0,0,0,0,0,0,0,0] }
        ],
        "events": [
            { "id": "mover", "type": "npc", "x": 1, "y": 0, "solid": true, "trigger": "interact", "commands": [] }
        ]
    })");

    Window window;
    Game game;
    REQUIRE(game.initialize(window, makeProjectWithMaps({
        {"route_map", firstMapPath},
        {"route_map_b", secondMapPath}
    })));

    game.stepInteract();
    pump(game);
    pump(game);

    CHECK(game.getGameState().getCurrentMapId() == "route_map_b");
    const auto mover = game.getCurrentScene().getRuntimeEventPosition("mover");
    REQUIRE(mover.has_value());
    CHECK(mover->x == 1);
    CHECK(mover->y == 0);
    removeTempMap(firstMapPath);
    removeTempMap(secondMapPath);
}
