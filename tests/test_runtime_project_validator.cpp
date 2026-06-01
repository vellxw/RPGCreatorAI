#include <doctest/doctest.h>
#include "runtime/RuntimeProjectValidator.h"

#include <filesystem>
#include <fstream>
#include <string>

namespace {

namespace fs = std::filesystem;

void writeFile(const fs::path& path, const std::string& content) {
    fs::create_directories(path.parent_path());
    std::ofstream out(path);
    out << content;
}

fs::path makeFixtureRoot(const std::string& name) {
    fs::path root = fs::current_path() / ("test_tmp_runtime_validator_" + name);
    fs::remove_all(root);
    fs::create_directories(root);
    return root;
}

bool hasMessage(const rpg::RuntimeValidationReport& report,
                rpg::RuntimeValidationSeverity severity,
                const std::string& text) {
    for (const auto& message : report.messages) {
        if (message.severity == severity &&
            message.message.find(text) != std::string::npos) {
            return true;
        }
    }
    return false;
}

void writeMinimalProject(const fs::path& root,
                         const std::string& mapBody,
                         const std::string& databaseBlock) {
    writeFile(root / "project.json", R"({
        "schemaVersion": 1,
        "title": "Validator Fixture",
        "startMapId": "town",
        "startPosition": { "x": 0, "y": 0, "direction": "down" },
        "maps": [{ "id": "town", "path": "maps/town.json" }],
        "database": )" + databaseBlock + R"(
    })");
    writeFile(root / "maps" / "town.json", mapBody);
}

void writeEmptyReferenceDatabases(const fs::path& root) {
    writeFile(root / "database" / "items.json", R"({ "schemaVersion": 1, "items": [] })");
    writeFile(root / "database" / "switches.json", R"({ "schemaVersion": 1, "switches": [] })");
    writeFile(root / "database" / "variables.json", R"({ "schemaVersion": 1, "variables": [] })");
    writeFile(root / "database" / "commonEvents.json", R"({ "schemaVersion": 1, "commonEvents": [] })");
    writeFile(root / "database" / "shops.json", R"({ "schemaVersion": 1, "shops": [] })");
    writeFile(root / "database" / "troops.json", R"({ "schemaVersion": 1, "troops": [] })");
    writeFile(root / "database" / "animations.json", R"({ "schemaVersion": 1, "sets": [] })");
    writeFile(root / "database" / "tilesets.json", R"({ "schemaVersion": 1, "tilesets": [] })");
}

} // namespace

TEST_CASE("RuntimeProjectValidator accepts the bundled sample project") {
    rpg::RuntimeProjectValidator validator;

    const auto report = validator.validateProjectFile("data/project.json");

    CHECK_FALSE(report.hasErrors());
}

TEST_CASE("RuntimeProjectValidator reports unsafe paths and missing startup assets") {
    const fs::path root = makeFixtureRoot("paths");
    writeFile(root / "project.json", R"({
        "schemaVersion": 1,
        "title": "Bad Paths",
        "startMapId": "town",
        "startPosition": { "x": 0, "y": 0, "direction": "down" },
        "maps": [
            { "id": "town", "path": "maps/missing.json" },
            { "id": "escape", "path": "../outside.json" }
        ],
        "database": { "items": "database/items.json" }
    })");
    writeFile(root / "database" / "items.json", R"({ "schemaVersion": 1, "items": [] })");

    rpg::RuntimeProjectValidator validator;
    const auto report = validator.validateProjectFile(root / "project.json");

    CHECK(report.hasErrors());
    CHECK(hasMessage(report, rpg::RuntimeValidationSeverity::Error,
                     "Map file not found for map \"town\""));
    CHECK(hasMessage(report, rpg::RuntimeValidationSeverity::Error,
                     "Unsafe project-relative path"));

    fs::remove_all(root);
}

TEST_CASE("RuntimeProjectValidator reports structural map and critical command references") {
    const fs::path root = makeFixtureRoot("references");
    writeEmptyReferenceDatabases(root);
    writeMinimalProject(
        root,
        R"({
            "schemaVersion": 1,
            "id": "town",
            "name": "Town",
            "tilesetId": "missing_tileset",
            "width": 2,
            "height": 2,
            "tileSize": 32,
            "layers": [
                { "name": "ground", "type": "visual", "role": "ground", "tiles": [0, 0, 0, 0] },
                { "name": "collision", "type": "collision", "role": "collision", "tiles": [9, 0, 0, 0] }
            ],
            "events": [
                {
                    "id": "npc",
                    "type": "npc",
                    "x": 4,
                    "y": 1,
                    "trigger": "interact",
                    "animationSet": "missing_event_animation",
                    "commands": [
                        { "type": "addItem", "itemId": "missing_item", "amount": 1 },
                        { "type": "controlSwitch", "switchId": "missing_switch", "value": true },
                        {
                            "type": "controlVariable",
                            "variableId": "missing_variable",
                            "op": "set",
                            "value": 1,
                            "sourceVariableId": "missing_source_variable"
                        },
                        { "type": "callCommonEvent", "commonEventId": "missing_common_event" },
                        { "type": "openShop", "shopId": "missing_shop" },
                        {
                            "type": "startBattle",
                            "troopId": "missing_troop",
                            "victoryBranch": [
                                {
                                    "type": "playAnimation",
                                    "target": "player",
                                    "action": "missing_action",
                                    "direction": "down"
                                }
                            ]
                        },
                        {
                            "type": "transferMap",
                            "mapId": "missing_map",
                            "x": 10,
                            "y": 10,
                            "direction": "sideways"
                        },
                        {
                            "type": "setMovementRoute",
                            "target": "event",
                            "eventId": "missing_event",
                            "steps": [{ "type": "jump" }]
                        }
                    ],
                    "pages": [
                        {
                            "trigger": "invalid_trigger",
                            "priority": "invalid_priority",
                            "conditions": [
                                { "type": "switch", "id": "missing_page_switch", "value": true }
                            ],
                            "commands": []
                        }
                    ]
                }
            ]
        })",
        R"({
            "items": "database/items.json",
            "switches": "database/switches.json",
            "variables": "database/variables.json",
            "commonEvents": "database/commonEvents.json",
            "shops": "database/shops.json",
            "troops": "database/troops.json",
            "animations": "database/animations.json",
            "tilesets": "database/tilesets.json"
        })");

    rpg::RuntimeProjectValidator validator;
    const auto report = validator.validateProjectFile(root / "project.json");

    CHECK(report.hasErrors());
    CHECK(hasMessage(report, rpg::RuntimeValidationSeverity::Error,
                     "Start position is blocked by the collision layer"));
    CHECK(hasMessage(report, rpg::RuntimeValidationSeverity::Error,
                     "Map \"town\" references unknown tileset \"missing_tileset\""));
    CHECK(hasMessage(report, rpg::RuntimeValidationSeverity::Error,
                     "Event \"npc\" is outside map bounds"));
    CHECK(hasMessage(report, rpg::RuntimeValidationSeverity::Error,
                     "unsupported trigger \"invalid_trigger\""));
    CHECK(hasMessage(report, rpg::RuntimeValidationSeverity::Error,
                     "unsupported priority \"invalid_priority\""));
    CHECK(hasMessage(report, rpg::RuntimeValidationSeverity::Error,
                     "unknown item \"missing_item\""));
    CHECK(hasMessage(report, rpg::RuntimeValidationSeverity::Error,
                     "unknown switch \"missing_switch\""));
    CHECK(hasMessage(report, rpg::RuntimeValidationSeverity::Error,
                     "unknown variable \"missing_variable\""));
    CHECK(hasMessage(report, rpg::RuntimeValidationSeverity::Error,
                     "unknown common event \"missing_common_event\""));
    CHECK(hasMessage(report, rpg::RuntimeValidationSeverity::Error,
                     "unknown shop \"missing_shop\""));
    CHECK(hasMessage(report, rpg::RuntimeValidationSeverity::Error,
                     "unknown troop \"missing_troop\""));
    CHECK(hasMessage(report, rpg::RuntimeValidationSeverity::Error,
                     "unknown map \"missing_map\""));
    CHECK(hasMessage(report, rpg::RuntimeValidationSeverity::Error,
                     "unsupported direction \"sideways\""));
    CHECK(hasMessage(report, rpg::RuntimeValidationSeverity::Error,
                     "unknown animation action \"missing_action\""));
    CHECK(hasMessage(report, rpg::RuntimeValidationSeverity::Error,
                     "unknown event \"missing_event\""));
    CHECK(hasMessage(report, rpg::RuntimeValidationSeverity::Warning,
                     "unsupported movement route step \"jump\""));

    fs::remove_all(root);
}
