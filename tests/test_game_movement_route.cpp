#include <doctest/doctest.h>
#include "core/Game.h"
#include "platform/Window.h"
#include <cstdio>
#include <fstream>

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
