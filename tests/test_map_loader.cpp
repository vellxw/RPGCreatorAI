#include <doctest/doctest.h>
#include "world/MapLoader.h"
#include <fstream>
#include <cstdio>

namespace {

std::string writeTemp(const std::string& name, const std::string& content) {
    std::string path = "test_tmp_" + name;
    std::ofstream o(path);
    o << content;
    return path;
}

void rm(const std::string& p) { std::remove(p.c_str()); }

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
    REQUIRE(page.commands.size() == 2);
    CHECK(page.commands[0]->type == "controlSelfSwitch");
    CHECK(page.commands[0]->switchId == "A");
    CHECK(page.commands[0]->boolValue == true);
    CHECK(page.commands[1]->type == "ifSelfSwitch");
    CHECK(page.commands[1]->switchId == "B");
    CHECK(page.commands[1]->boolValue == false);
    REQUIRE(page.commands[1]->thenCommands.size() == 1);
    CHECK(page.commands[1]->thenCommands[0]->text == "B is off");
    REQUIRE(page.commands[1]->elseCommands.size() == 1);
    CHECK(page.commands[1]->elseCommands[0]->text == "B is on");
    rm(p);
}
