#include <doctest/doctest.h>
#include "world/ProjectLoader.h"
#include "types/Direction.h"
#include <fstream>
#include <cstdio>
#include <string>

// Helper to write a temporary JSON file and return its path
static std::string writeTempJson(const std::string& filename, const std::string& content) {
    std::string path = "test_tmp_" + filename;
    std::ofstream out(path);
    out << content;
    out.close();
    return path;
}

// Helper to remove a temporary file
static void removeTempFile(const std::string& path) {
    std::remove(path.c_str());
}

TEST_CASE("ProjectLoader loads valid project.json correctly") {
    auto project = ProjectLoader::load("data/project.json");

    REQUIRE(project.has_value());
    CHECK(project->schemaVersion == 1);
    CHECK(project->title == "Demo RPG");
    CHECK(project->startMapId == "town");
    CHECK(project->startPosition.pos.x == 4);
    CHECK(project->startPosition.pos.y == 4);
    CHECK(project->startPosition.direction == Direction::Down);
    CHECK(project->maps.size() == 2);
}

TEST_CASE("ProjectLoader returns nullopt for unsupported schemaVersion") {
    std::string content = R"({
        "schemaVersion": 2,
        "title": "Test",
        "startMapId": "town",
        "startPosition": { "x": 0, "y": 0, "direction": "down" },
        "maps": [{ "id": "town", "path": "maps/town.json" }],
        "database": { "items": "data/items.json" }
    })";
    std::string path = writeTempJson("schema_v2.json", content);

    auto project = ProjectLoader::load(path);
    CHECK_FALSE(project.has_value());

    removeTempFile(path);
}

TEST_CASE("ProjectLoader returns nullopt for missing required field") {
    // Missing "title" field
    std::string content = R"({
        "schemaVersion": 1,
        "startMapId": "town",
        "startPosition": { "x": 0, "y": 0, "direction": "down" },
        "maps": [{ "id": "town", "path": "maps/town.json" }],
        "database": { "items": "data/items.json" }
    })";
    std::string path = writeTempJson("missing_field.json", content);

    auto project = ProjectLoader::load(path);
    CHECK_FALSE(project.has_value());

    removeTempFile(path);
}

TEST_CASE("ProjectLoader returns nullopt when startMapId not in maps") {
    std::string content = R"({
        "schemaVersion": 1,
        "title": "Test",
        "startMapId": "forest",
        "startPosition": { "x": 0, "y": 0, "direction": "down" },
        "maps": [{ "id": "town", "path": "maps/town.json" }],
        "database": { "items": "data/items.json" }
    })";
    std::string path = writeTempJson("bad_start_map.json", content);

    auto project = ProjectLoader::load(path);
    CHECK_FALSE(project.has_value());

    removeTempFile(path);
}

TEST_CASE("ProjectLoader returns nullopt for invalid direction value") {
    std::string content = R"({
        "schemaVersion": 1,
        "title": "Test",
        "startMapId": "town",
        "startPosition": { "x": 0, "y": 0, "direction": "northeast" },
        "maps": [{ "id": "town", "path": "maps/town.json" }],
        "database": { "items": "data/items.json" }
    })";
    std::string path = writeTempJson("bad_direction.json", content);

    auto project = ProjectLoader::load(path);
    CHECK_FALSE(project.has_value());

    removeTempFile(path);
}

TEST_CASE("ProjectLoader returns nullopt for invalid JSON syntax") {
    std::string content = R"({ "schemaVersion": 1, "title": "Test", INVALID })";
    std::string path = writeTempJson("bad_syntax.json", content);

    auto project = ProjectLoader::load(path);
    CHECK_FALSE(project.has_value());

    removeTempFile(path);
}

TEST_CASE("ProjectLoader returns nullopt for non-existent file") {
    auto project = ProjectLoader::load("this_file_does_not_exist.json");
    CHECK_FALSE(project.has_value());
}

TEST_CASE("ProjectLoader returns nullopt for empty maps array") {
    std::string content = R"({
        "schemaVersion": 1,
        "title": "Test",
        "startMapId": "town",
        "startPosition": { "x": 0, "y": 0, "direction": "down" },
        "maps": [],
        "database": { "items": "data/items.json" }
    })";
    std::string path = writeTempJson("empty_maps.json", content);

    auto project = ProjectLoader::load(path);
    CHECK_FALSE(project.has_value());

    removeTempFile(path);
}
