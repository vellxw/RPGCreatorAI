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
    CHECK(m->width == 10);
    CHECK(m->height == 10);
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
