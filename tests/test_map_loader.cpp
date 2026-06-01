#include <doctest/doctest.h>
#include "world/MapLoader.h"
#include <algorithm>
#include <fstream>
#include <cstdio>
#include <functional>

namespace {

std::string writeTemp(const std::string& name, const std::string& content) {
    std::string path = "test_tmp_" + name;
    std::ofstream o(path);
    o << content;
    return path;
}

void rm(const std::string& p) { std::remove(p.c_str()); }

bool hasCommand(
    const std::vector<std::shared_ptr<EventCommand>>& commands,
    const std::function<bool(const EventCommand&)>& pred
) {
    for (const auto& command : commands) {
        if (!command) continue;
        if (pred(*command)) return true;
        if (hasCommand(command->thenCommands, pred)) return true;
        if (hasCommand(command->elseCommands, pred)) return true;
        if (hasCommand(command->victoryBranch, pred)) return true;
        if (hasCommand(command->defeatBranch, pred)) return true;
        for (const auto& choice : command->choices) {
            if (hasCommand(choice.commands, pred)) return true;
        }
    }
    return false;
}

bool hasCommand(const EventData& event, const std::function<bool(const EventCommand&)>& pred) {
    if (hasCommand(event.commands, pred)) return true;
    for (const auto& page : event.pages) {
        if (hasCommand(page.commands, pred)) return true;
    }
    return false;
}

bool hasNonZeroForeground(const MapData& map) {
    for (const auto& layer : map.layers) {
        if (layer.role != "foreground" && layer.name != "foreground") continue;
        return std::any_of(layer.tiles.begin(), layer.tiles.end(), [](int tile) { return tile != 0; });
    }
    return false;
}

} // namespace

TEST_CASE("MapLoader loads town.json with expected dimensions and events") {
    auto m = MapLoader::load("data/maps/town.json");
    REQUIRE(m.has_value());
    CHECK(m->id == "town");
    CHECK(m->width == 40);
    CHECK(m->height == 23);
    CHECK(m->tileSize == 32);

    bool foundOldMan = false;
    bool foundDoor = false;
    for (const auto& e : m->events) {
        if (e.id == "old_man") { foundOldMan = true; CHECK(e.solid); }
        if (e.id == "door_to_house") { foundDoor = true; CHECK_FALSE(e.solid); CHECK(e.trigger == "touch"); }
    }
    CHECK(foundOldMan);
    CHECK(foundDoor);
}

TEST_CASE("MapLoader loads house.json with chest and door") {
    auto m = MapLoader::load("data/maps/house.json");
    REQUIRE(m.has_value());
    CHECK(m->id == "house");

    bool chest = false, door = false;
    for (const auto& e : m->events) {
        if (e.id == "chest_001") chest = true;
        if (e.id == "door_to_town") door = true;
    }
    CHECK(chest);
    CHECK(door);
}

TEST_CASE("Bundled sample maps include Phase 10 MVP command and visual coverage") {
    auto town = MapLoader::load("data/maps/town.json");
    auto house = MapLoader::load("data/maps/house.json");
    REQUIRE(town.has_value());
    REQUIRE(house.has_value());

    const bool hasForegroundOcclusion = hasNonZeroForeground(*town) || hasNonZeroForeground(*house);
    CHECK(hasForegroundOcclusion);

    auto routeCoach = std::find_if(town->events.begin(), town->events.end(), [](const EventData& e) {
        return e.id == "route_coach";
    });
    REQUIRE(routeCoach != town->events.end());
    CHECK(hasCommand(*routeCoach, [](const EventCommand& command) {
        return command.type == "setMovementRoute" &&
               command.movementRouteTarget == "event" &&
               command.movementRouteEventId == "patrol_crate" &&
               command.movementRouteSteps.size() >= 2;
    }));
    CHECK(hasCommand(*routeCoach, [](const EventCommand& command) {
        return command.type == "pluginCommand" &&
               command.pluginId == "debug" &&
               command.pluginCommand == "log";
    }));

    auto chest = std::find_if(house->events.begin(), house->events.end(), [](const EventData& e) {
        return e.id == "chest_001";
    });
    REQUIRE(chest != house->events.end());
    REQUIRE(chest->pages.size() >= 2);
    CHECK(hasCommand(*chest, [](const EventCommand& command) {
        return command.type == "controlSelfSwitch" && command.switchId == "A" && command.boolValue;
    }));
    CHECK(hasCommand(*chest, [](const EventCommand& command) {
        return command.type == "ifSelfSwitch" && command.switchId == "A";
    }));
    CHECK(std::any_of(chest->pages.begin(), chest->pages.end(), [](const EventPage& page) {
        return std::any_of(page.conditions.begin(), page.conditions.end(), [](const EventPageCondition& condition) {
            return condition.type == "selfSwitch" && condition.id == "A" && condition.boolValue;
        });
    }));
}

TEST_CASE("MapLoader returns nullopt for non-existent file") {
    auto m = MapLoader::load("nonexistent_map.json");
    CHECK_FALSE(m.has_value());
}

TEST_CASE("MapLoader returns nullopt for invalid JSON") {
    std::string p = writeTemp("bad_map.json", "{ this is not json }");
    auto m = MapLoader::load(p);
    CHECK_FALSE(m.has_value());
    rm(p);
}

TEST_CASE("MapLoader returns nullopt when required field missing") {
    // Missing "events" field
    std::string p = writeTemp("missing_events.json", R"({
        "schemaVersion": 1, "id": "x", "name": "X",
        "width": 2, "height": 2, "tileSize": 32,
        "layers": []
    })");
    auto m = MapLoader::load(p);
    CHECK_FALSE(m.has_value());
    rm(p);
}

TEST_CASE("MapLoader rejects layer with wrong tile count") {
    // width*height = 4 but only 3 tiles supplied.
    std::string p = writeTemp("bad_layer_size.json", R"({
        "schemaVersion": 1, "id": "x", "name": "X",
        "width": 2, "height": 2, "tileSize": 32,
        "layers": [
            { "name": "ground", "type": "visual", "tiles": [1,1,1] }
        ],
        "events": []
    })");
    auto m = MapLoader::load(p);
    CHECK_FALSE(m.has_value());
    rm(p);
}

TEST_CASE("MapLoader rejects unsupported schemaVersion") {
    std::string p = writeTemp("bad_schema.json", R"({
        "schemaVersion": 99, "id": "x", "name": "X",
        "width": 1, "height": 1, "tileSize": 32,
        "layers": [], "events": []
    })");
    auto m = MapLoader::load(p);
    CHECK_FALSE(m.has_value());
    rm(p);
}

TEST_CASE("MapLoader keeps legacy event commands when pages are absent") {
    std::string p = writeTemp("legacy_event_commands.json", R"({
        "schemaVersion": 1, "id": "x", "name": "X",
        "width": 1, "height": 1, "tileSize": 32,
        "layers": [
            { "name": "ground", "type": "visual", "tiles": [1] }
        ],
        "events": [
            {
                "id": "npc", "type": "npc", "x": 0, "y": 0,
                "commands": [
                    { "type": "showText", "speaker": "NPC", "text": "Hello" }
                ]
            }
        ]
    })");

    auto m = MapLoader::load(p);
    REQUIRE(m.has_value());
    REQUIRE(m->events.size() == 1);
    CHECK(m->events[0].pages.empty());
    REQUIRE(m->events[0].commands.size() == 1);
    CHECK(m->events[0].commands[0]->type == "showText");
    CHECK(m->events[0].commands[0]->text == "Hello");
    rm(p);
}

TEST_CASE("MapLoader loads event pages in order with conditions") {
    std::string p = writeTemp("event_pages.json", R"({
        "schemaVersion": 1, "id": "x", "name": "X",
        "width": 1, "height": 1, "tileSize": 32,
        "layers": [
            { "name": "ground", "type": "visual", "tiles": [1] }
        ],
        "events": [
            {
                "id": "chest", "type": "event", "x": 0, "y": 0,
                "commands": [],
                "pages": [
                    {
                        "conditions": [],
                        "graphic": { "sprite": "closed_chest" },
                        "options": { "trigger": "interact", "solid": false },
                        "movement": { "type": "fixed" },
                        "commands": [
                            { "type": "showText", "text": "Found potion" }
                        ]
                    },
                    {
                        "conditions": [
                            { "type": "selfSwitch", "id": "A", "value": true },
                            { "type": "switch", "id": "quest_started", "value": true }
                        ],
                        "graphic": { "sprite": "open_chest", "animationSet": "chest" },
                        "options": { "trigger": "touch", "solid": true, "priority": "same" },
                        "movement": { "type": "random", "speed": 4, "frequency": 5 },
                        "commands": [
                            { "type": "comment", "text": "Already opened" }
                        ]
                    }
                ]
            }
        ]
    })");

    auto m = MapLoader::load(p);
    REQUIRE(m.has_value());
    REQUIRE(m->events.size() == 1);
    const auto& event = m->events[0];
    REQUIRE(event.pages.size() == 2);

    CHECK(event.pages[0].graphic.sprite == "closed_chest");
    CHECK(event.pages[0].options.trigger == "interact");
    REQUIRE(event.pages[0].commands.size() == 1);
    CHECK(event.pages[0].commands[0]->text == "Found potion");

    REQUIRE(event.pages[1].conditions.size() == 2);
    CHECK(event.pages[1].conditions[0].type == "selfSwitch");
    CHECK(event.pages[1].conditions[0].id == "A");
    CHECK(event.pages[1].conditions[0].boolValue == true);
    CHECK(event.pages[1].conditions[1].type == "switch");
    CHECK(event.pages[1].graphic.sprite == "open_chest");
    CHECK(event.pages[1].graphic.animationSet == "chest");
    CHECK(event.pages[1].options.trigger == "touch");
    CHECK(event.pages[1].options.solid == true);
    CHECK(event.pages[1].movement.type == "random");
    CHECK(event.pages[1].movement.speed == 4);
    REQUIRE(event.pages[1].commands.size() == 1);
    CHECK(event.pages[1].commands[0]->text == "Already opened");
    rm(p);
}

TEST_CASE("MapLoader accepts editor-authored page shape") {
    std::string p = writeTemp("editor_event_page_shape.json", R"({
        "schemaVersion": 1, "id": "x", "name": "X",
        "width": 1, "height": 1, "tileSize": 32,
        "layers": [
            { "name": "ground", "type": "visual", "tiles": [1] }
        ],
        "events": [
            {
                "id": "npc", "type": "npc", "x": 0, "y": 0,
                "commands": [],
                "pages": [
                    {
                        "id": "page_1",
                        "conditions": {
                            "selfSwitches": { "A": true },
                            "switches": { "quest_started": true },
                            "variables": [{ "variableId": "v1", "op": "gte", "value": 2 }]
                        },
                        "graphic": { "sprite": "npc_old_man" },
                        "movement": { "type": "fixed", "speed": "normal" },
                        "options": { "walking": true, "stepping": false, "directionFix": false, "through": true },
                        "priority": "sameAsCharacters",
                        "trigger": "parallel",
                        "commands": [
                            { "type": "controlSelfSwitch", "switchId": "A", "value": true },
                            {
                                "type": "setMovementRoute",
                                "target": "event",
                                "eventId": "npc",
                                "repeat": false,
                                "skippable": true,
                                "wait": true,
                                "steps": [
                                    { "type": "moveRight" },
                                    { "type": "wait", "ms": 125 },
                                    { "type": "turnDown" }
                                ]
                            },
                            {
                                "type": "ifSelfSwitch",
                                "switchId": "B",
                                "equals": false,
                                "then": [{ "type": "showText", "text": "B is off" }],
                                "else": [{ "type": "comment", "text": "B is on" }]
                            }
                        ]
                    }
                ]
            }
        ]
    })");

    auto m = MapLoader::load(p);
    REQUIRE(m.has_value());
    REQUIRE(m->events.size() == 1);
    REQUIRE(m->events[0].pages.size() == 1);
    const auto& page = m->events[0].pages[0];
    CHECK(page.options.trigger == "parallel");
    CHECK(page.options.priority == "sameAsCharacters");
    CHECK(page.options.through == true);
    CHECK(page.graphic.sprite == "npc_old_man");
    REQUIRE(page.conditions.size() == 3);
    CHECK(page.conditions[0].type == "selfSwitch");
    CHECK(page.conditions[0].id == "A");
    CHECK(page.conditions[2].type == "variable");
    CHECK(page.conditions[2].op == "gte");
    CHECK(page.conditions[2].intValue == 2);
    REQUIRE(page.commands.size() == 3);
    CHECK(page.commands[0]->type == "controlSelfSwitch");
    CHECK(page.commands[0]->switchId == "A");
    CHECK(page.commands[0]->boolValue == true);
    CHECK(page.commands[1]->type == "setMovementRoute");
    CHECK(page.commands[1]->movementRouteTarget == "event");
    CHECK(page.commands[1]->movementRouteEventId == "npc");
    CHECK(page.commands[1]->movementRouteSkippable == true);
    CHECK(page.commands[1]->movementRouteWait == true);
    REQUIRE(page.commands[1]->movementRouteSteps.size() == 3);
    CHECK(page.commands[1]->movementRouteSteps[0].type == "moveRight");
    CHECK(page.commands[1]->movementRouteSteps[1].type == "wait");
    CHECK(page.commands[1]->movementRouteSteps[1].ms == 125);
    CHECK(page.commands[2]->type == "ifSelfSwitch");
    CHECK(page.commands[2]->switchId == "B");
    CHECK(page.commands[2]->boolValue == false);
    REQUIRE(page.commands[2]->thenCommands.size() == 1);
    CHECK(page.commands[2]->thenCommands[0]->text == "B is off");
    REQUIRE(page.commands[2]->elseCommands.size() == 1);
    CHECK(page.commands[2]->elseCommands[0]->text == "B is on");
    rm(p);
}

TEST_CASE("MapLoader parses pluginCommand scalar args") {
    std::string p = writeTemp("plugin_command_map.json", R"({
        "schemaVersion": 1,
        "id": "plugin_map",
        "name": "Plugin Map",
        "width": 1,
        "height": 1,
        "tileSize": 32,
        "layers": [{ "name": "ground", "type": "visual", "tiles": [1] }],
        "events": [
            {
                "id": "plugin_host",
                "type": "npc",
                "x": 0,
                "y": 0,
                "commands": [
                    {
                        "type": "pluginCommand",
                        "pluginId": "debug",
                        "command": "setVariable",
                        "args": {
                            "variableId": "score",
                            "value": 12,
                            "enabled": true,
                            "note": "from map",
                            "empty": null,
                            "nested": { "ignored": true }
                        }
                    }
                ]
            }
        ]
    })");

    auto m = MapLoader::load(p);
    REQUIRE(m.has_value());
    REQUIRE(m->events.size() == 1);
    REQUIRE(m->events[0].commands.size() == 1);
    const auto& command = *m->events[0].commands[0];
    CHECK(command.type == "pluginCommand");
    CHECK(command.pluginId == "debug");
    CHECK(command.pluginCommand == "setVariable");
    REQUIRE(command.pluginArgs.size() == 5);
    CHECK(command.pluginArgs.at("variableId").type == EventCommand::PluginArg::Type::String);
    CHECK(command.pluginArgs.at("variableId").stringValue == "score");
    CHECK(command.pluginArgs.at("value").type == EventCommand::PluginArg::Type::Number);
    CHECK(command.pluginArgs.at("value").numberValue == 12.0);
    CHECK(command.pluginArgs.at("enabled").type == EventCommand::PluginArg::Type::Boolean);
    CHECK(command.pluginArgs.at("enabled").boolValue == true);
    CHECK(command.pluginArgs.at("empty").type == EventCommand::PluginArg::Type::Null);
    CHECK(command.pluginArgs.find("nested") == command.pluginArgs.end());

    rm(p);
}
