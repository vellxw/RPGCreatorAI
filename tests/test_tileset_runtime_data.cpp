#include <doctest/doctest.h>
#include "database/RpgDatabases.h"
#include "world/MapLoader.h"
#include "world/ProjectLoader.h"
#include <cstdio>
#include <fstream>
#include <string>

namespace {

std::string writeTempJson(const std::string& filename, const std::string& content) {
    const std::string path = "test_tmp_" + filename;
    std::ofstream out(path);
    out << content;
    return path;
}

void removeTempFile(const std::string& path) {
    std::remove(path.c_str());
}

} // namespace

TEST_CASE("ProjectLoader treats database.tilesets as optional") {
    const std::string legacyPath = writeTempJson("legacy_without_tilesets_project.json", R"({
        "schemaVersion": 1,
        "title": "Legacy",
        "startMapId": "town",
        "startPosition": { "x": 0, "y": 0, "direction": "down" },
        "maps": [{ "id": "town", "path": "maps/town.json" }],
        "database": { "items": "data/database/items.json" }
    })");

    auto legacy = ProjectLoader::load(legacyPath);
    REQUIRE(legacy.has_value());
    CHECK(legacy->database.tilesetsPath.empty());

    removeTempFile(legacyPath);
}

TEST_CASE("ProjectLoader loads optional database.tilesets path") {
    const std::string projectPath = writeTempJson("with_tilesets_project.json", R"({
        "schemaVersion": 1,
        "title": "Tilesets",
        "startMapId": "town",
        "startPosition": { "x": 0, "y": 0, "direction": "down" },
        "maps": [{ "id": "town", "path": "maps/town.json" }],
        "database": {
            "items": "data/database/items.json",
            "tilesets": "data/database/tilesets.json"
        }
    })");

    auto project = ProjectLoader::load(projectPath);
    REQUIRE(project.has_value());
    CHECK(project->database.tilesetsPath == "data/database/tilesets.json");

    removeTempFile(projectPath);
}

TEST_CASE("RpgDatabases loads tilesets and finds them by id") {
    const std::string tilesetsPath = writeTempJson("tilesets_database.json", R"({
        "schemaVersion": 1,
        "tilesets": [
            {
                "id": "sample-town",
                "name": "Sample Town",
                "tileSize": 32,
                "image": "assets/tilesets/sample-town.png",
                "columns": 8,
                "tiles": [
                    { "id": 0, "name": "Void", "asset": "void", "passability": "blocked", "terrainTag": "void" },
                    { "id": 5, "name": "Tree", "asset": "tree", "passability": "blocked", "terrainTag": "forest" }
                ]
            }
        ]
    })");

    ProjectData project;
    project.database.tilesetsPath = tilesetsPath;

    rpg::RpgDatabases databases;
    CHECK(databases.loadAll(project));

    const auto* tileset = databases.findTileset("sample-town");
    REQUIRE(tileset != nullptr);
    CHECK(tileset->id == "sample-town");
    CHECK(tileset->name == "Sample Town");
    CHECK(tileset->tileSize == 32);
    CHECK(tileset->image == "assets/tilesets/sample-town.png");
    CHECK(tileset->columns == 8);
    REQUIRE(tileset->tiles.size() == 2);
    CHECK(tileset->tiles[1].id == 5);
    CHECK(tileset->tiles[1].asset == "tree");
    CHECK(tileset->tiles[1].passability == "blocked");
    CHECK(tileset->tiles[1].terrainTag == "forest");
    CHECK(databases.findTileset("missing") == nullptr);

    removeTempFile(tilesetsPath);
}

TEST_CASE("RpgDatabases keeps legacy projects without tilesets empty") {
    ProjectData project;

    rpg::RpgDatabases databases;
    CHECK(databases.loadAll(project));
    CHECK(databases.tilesets().empty());
    CHECK(databases.findTileset("sample-town") == nullptr);
}

TEST_CASE("MapLoader parses map tileset identity and editor layer metadata") {
    const std::string mapPath = writeTempJson("map_with_tileset_metadata.json", R"({
        "schemaVersion": 1,
        "id": "town",
        "name": "Town",
        "displayName": "Town Display",
        "tilesetId": "sample-town",
        "width": 2,
        "height": 2,
        "tileSize": 32,
        "layers": [
            {
                "name": "ground",
                "type": "visual",
                "role": "ground",
                "visible": false,
                "locked": true,
                "tiles": [1, 1, 1, 1]
            }
        ],
        "events": []
    })");

    auto map = MapLoader::load(mapPath);
    REQUIRE(map.has_value());
    CHECK(map->displayName == "Town Display");
    CHECK(map->tilesetId == "sample-town");
    REQUIRE(map->layers.size() == 1);
    CHECK(map->layers[0].role == "ground");
    CHECK(map->layers[0].visible == false);
    CHECK(map->layers[0].locked == true);

    removeTempFile(mapPath);
}

TEST_CASE("MapLoader remains backward compatible for legacy layer metadata") {
    const std::string mapPath = writeTempJson("legacy_map_without_tileset_metadata.json", R"({
        "schemaVersion": 1,
        "id": "legacy",
        "name": "Legacy",
        "width": 1,
        "height": 1,
        "tileSize": 32,
        "layers": [
            { "name": "ground", "type": "visual", "tiles": [1] }
        ],
        "events": []
    })");

    auto map = MapLoader::load(mapPath);
    REQUIRE(map.has_value());
    CHECK(map->displayName.empty());
    CHECK(map->tilesetId.empty());
    REQUIRE(map->layers.size() == 1);
    CHECK(map->layers[0].role.empty());
    CHECK(map->layers[0].visible);
    CHECK_FALSE(map->layers[0].locked);

    removeTempFile(mapPath);
}
