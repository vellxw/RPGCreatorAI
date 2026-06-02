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

TEST_CASE("RuntimeProjectValidator validates authored audio registry and missing optional files") {
    const fs::path root = makeFixtureRoot("audio_registry");
    writeMinimalProject(
        root,
        R"({
            "schemaVersion": 1,
            "id": "town",
            "name": "Town",
            "bgm": "missing_bgm",
            "width": 2,
            "height": 2,
            "tileSize": 32,
            "layers": [
                { "name": "ground", "type": "visual", "role": "ground", "tiles": [0, 0, 0, 0] },
                { "name": "collision", "type": "collision", "role": "collision", "tiles": [0, 0, 0, 0] }
            ],
            "events": [
                {
                    "id": "speaker",
                    "type": "object",
                    "x": 0,
                    "y": 0,
                    "trigger": "interact",
                    "commands": [
                        { "type": "playSound", "soundId": "known_sfx" },
                        { "type": "playSound", "soundId": "unknown_sfx" }
                    ]
                }
            ]
        })",
        R"({
            "items": "database/items.json",
            "system": "database/system.json"
        })");
    writeFile(root / "database" / "items.json", R"({
        "schemaVersion": 1,
        "items": []
    })");
    writeFile(root / "database" / "system.json", R"({
        "schemaVersion": 1,
        "defaultBgm": "missing_bgm",
        "audio": {
            "missing_bgm": "assets/audio/missing.wav",
            "known_sfx": "assets/audio/effect.wav",
            "bad_ext": "assets/audio/effect.ogg",
            "unsafe": "../outside.wav"
        }
    })");

    rpg::RuntimeProjectValidator validator;
    const auto report = validator.validateProjectFile(root / "project.json");

    CHECK(report.hasErrors());
    CHECK(hasMessage(report, rpg::RuntimeValidationSeverity::Error,
                     "Audio asset \"bad_ext\" must use a .wav file"));
    CHECK(hasMessage(report, rpg::RuntimeValidationSeverity::Error,
                     "Audio asset \"unsafe\" uses unsafe project-relative path"));
    CHECK(hasMessage(report, rpg::RuntimeValidationSeverity::Error,
                     "unknown audio id \"unknown_sfx\""));
    CHECK(hasMessage(report, rpg::RuntimeValidationSeverity::Warning,
                     "Audio asset \"missing_bgm\" file not found"));
    CHECK(hasMessage(report, rpg::RuntimeValidationSeverity::Warning,
                     "Audio asset \"known_sfx\" file not found"));

    fs::remove_all(root);
}

TEST_CASE("RuntimeProjectValidator reports battle database gaps before runtime") {
    const fs::path root = makeFixtureRoot("battle_database");
    writeMinimalProject(
        root,
        R"({
            "schemaVersion": 1,
            "id": "town",
            "name": "Town",
            "width": 2,
            "height": 2,
            "tileSize": 32,
            "layers": [
                { "name": "ground", "type": "visual", "role": "ground", "tiles": [0, 0, 0, 0] },
                { "name": "collision", "type": "collision", "role": "collision", "tiles": [0, 0, 0, 0] }
            ],
            "events": [
                {
                    "id": "battle_event",
                    "type": "object",
                    "x": 0,
                    "y": 0,
                    "trigger": "interact",
                    "commands": [
                        { "type": "startBattle", "troopId": "battle_troop", "canEscape": true }
                    ]
                }
            ]
        })",
        R"({
            "items": "database/items.json",
            "actors": "database/actors.json",
            "classes": "database/classes.json",
            "skills": "database/skills.json",
            "enemies": "database/enemies.json",
            "troops": "database/troops.json",
            "system": "database/system.json"
        })");

    writeFile(root / "database" / "items.json", R"({
        "schemaVersion": 1,
        "items": [{ "id": "potion", "name": "Potion" }]
    })");
    writeFile(root / "database" / "actors.json", R"({
        "schemaVersion": 1,
        "actors": [
            {
                "id": "bad_actor",
                "name": "Bad Actor",
                "classId": "missing_class",
                "level": 1,
                "hp": 10,
                "mp": 0,
                "baseStats": {
                    "maxHp": 10,
                    "maxMp": 0,
                    "attack": 1,
                    "defense": 1,
                    "magicAttack": 1,
                    "magicDefense": 1,
                    "agility": 1,
                    "luck": 1
                },
                "equipment": { "weapon": "missing_item" },
                "skills": ["missing_skill"]
            }
        ]
    })");
    writeFile(root / "database" / "classes.json", R"({
        "schemaVersion": 1,
        "classes": [
            {
                "id": "bad_class",
                "name": "Bad Class",
                "growth": {
                    "maxHp": 1,
                    "maxMp": 0,
                    "attack": 1,
                    "defense": 1,
                    "magicAttack": 1,
                    "magicDefense": 1,
                    "agility": 1,
                    "luck": 1
                },
                "learnedSkills": [{ "level": 1, "skillId": "missing_skill" }]
            }
        ]
    })");
    writeFile(root / "database" / "skills.json", R"({
        "schemaVersion": 1,
        "skills": [{ "id": "slash", "name": "Slash", "target": "singleEnemy" }]
    })");
    writeFile(root / "database" / "enemies.json", R"({
        "schemaVersion": 1,
        "enemies": [
            {
                "id": "bad_enemy",
                "name": "Bad Enemy",
                "stats": { "maxHp": -1, "attack": 1, "defense": 1 },
                "exp": -1,
                "gold": -2,
                "drops": [{ "itemId": "missing_item", "rate": 1.5 }]
            }
        ]
    })");
    writeFile(root / "database" / "troops.json", R"({
        "schemaVersion": 1,
        "troops": [
            { "id": "battle_troop", "name": "Battle Troop", "members": ["bad_enemy"] },
            { "id": "empty_troop", "name": "Empty Troop", "members": [] }
        ]
    })");
    writeFile(root / "database" / "system.json", R"({
        "schemaVersion": 1,
        "startingParty": ["bad_actor"]
    })");

    rpg::RuntimeProjectValidator validator;
    const auto report = validator.validateProjectFile(root / "project.json");

    CHECK(report.hasErrors());
    CHECK(hasMessage(report, rpg::RuntimeValidationSeverity::Error,
                     "Actor \"bad_actor\" references unknown class \"missing_class\""));
    CHECK(hasMessage(report, rpg::RuntimeValidationSeverity::Error,
                     "Actor \"bad_actor\" equips unknown item \"missing_item\" in slot \"weapon\""));
    CHECK(hasMessage(report, rpg::RuntimeValidationSeverity::Error,
                     "Actor \"bad_actor\" references unknown skill \"missing_skill\""));
    CHECK(hasMessage(report, rpg::RuntimeValidationSeverity::Error,
                     "Class \"bad_class\" references unknown learned skill \"missing_skill\""));
    CHECK(hasMessage(report, rpg::RuntimeValidationSeverity::Error,
                     "Enemy \"bad_enemy\" drops unknown item \"missing_item\""));
    CHECK(hasMessage(report, rpg::RuntimeValidationSeverity::Error,
                     "Enemy \"bad_enemy\" stats.maxHp must be a non-negative finite number"));
    CHECK(hasMessage(report, rpg::RuntimeValidationSeverity::Error,
                     "Enemy \"bad_enemy\" exp must be a non-negative finite number"));
    CHECK(hasMessage(report, rpg::RuntimeValidationSeverity::Error,
                     "Enemy \"bad_enemy\" gold must be a non-negative finite number"));
    CHECK(hasMessage(report, rpg::RuntimeValidationSeverity::Error,
                     "Enemy \"bad_enemy\" drop rate must be between 0 and 1"));
    CHECK(hasMessage(report, rpg::RuntimeValidationSeverity::Error,
                     "Troop \"empty_troop\" must contain at least one enemy"));
    CHECK(hasMessage(report, rpg::RuntimeValidationSeverity::Error,
                     "startBattle canEscape is not supported by deterministic runtime battles"));

    fs::remove_all(root);
}

TEST_CASE("RuntimeProjectValidator reports item equipment data gaps before runtime") {
    const fs::path root = makeFixtureRoot("item_equipment_database");
    writeMinimalProject(
        root,
        R"({
            "schemaVersion": 1,
            "id": "town",
            "name": "Town",
            "width": 2,
            "height": 2,
            "tileSize": 32,
            "layers": [
                { "name": "ground", "type": "visual", "role": "ground", "tiles": [0, 0, 0, 0] },
                { "name": "collision", "type": "collision", "role": "collision", "tiles": [0, 0, 0, 0] }
            ],
            "events": []
        })",
        R"({
            "items": "database/items.json",
            "actors": "database/actors.json",
            "classes": "database/classes.json",
            "system": "database/system.json"
        })");

    writeFile(root / "database" / "items.json", R"({
        "schemaVersion": 1,
        "items": [
            {
                "id": "bad_blade",
                "name": "Bad Blade",
                "price": -10,
                "slot": "ring",
                "effect": { "hp": "lots" },
                "modifiers": { "attack": "heavy" }
            }
        ]
    })");
    writeFile(root / "database" / "actors.json", R"({
        "schemaVersion": 1,
        "actors": [
            {
                "id": "hero",
                "name": "Hero",
                "classId": "",
                "level": 1,
                "hp": 10,
                "mp": 0,
                "baseStats": {
                    "maxHp": 10,
                    "maxMp": 0,
                    "attack": 1,
                    "defense": 1,
                    "magicAttack": 1,
                    "magicDefense": 1,
                    "agility": 1,
                    "luck": 1
                },
                "equipment": { "ring": "bad_blade" },
                "skills": []
            }
        ]
    })");
    writeFile(root / "database" / "classes.json", R"({
        "schemaVersion": 1,
        "classes": []
    })");
    writeFile(root / "database" / "system.json", R"({
        "schemaVersion": 1,
        "startingParty": ["hero"]
    })");

    rpg::RuntimeProjectValidator validator;
    const auto report = validator.validateProjectFile(root / "project.json");

    CHECK(report.hasErrors());
    CHECK(hasMessage(report, rpg::RuntimeValidationSeverity::Error,
                     "Item \"bad_blade\" price must be a non-negative finite number"));
    CHECK(hasMessage(report, rpg::RuntimeValidationSeverity::Error,
                     "Item \"bad_blade\" effect.hp must be finite"));
    CHECK(hasMessage(report, rpg::RuntimeValidationSeverity::Error,
                     "Item \"bad_blade\" modifier attack must be finite"));
    CHECK(hasMessage(report, rpg::RuntimeValidationSeverity::Error,
                     "Item \"bad_blade\" uses unsupported equipment slot \"ring\""));
    CHECK(hasMessage(report, rpg::RuntimeValidationSeverity::Error,
                     "Actor \"hero\" equipment slot \"ring\" is not supported by the runtime"));

    fs::remove_all(root);
}

TEST_CASE("RuntimeProjectValidator validates registered plugin command metadata") {
    const fs::path root = makeFixtureRoot("plugin_registry");
    writeMinimalProject(
        root,
        R"({
            "schemaVersion": 1,
            "id": "town",
            "name": "Town",
            "width": 2,
            "height": 2,
            "tileSize": 32,
            "layers": [
                { "name": "ground", "type": "visual", "role": "ground", "tiles": [0, 0, 0, 0] },
                { "name": "collision", "type": "collision", "role": "collision", "tiles": [0, 0, 0, 0] }
            ],
            "events": [
                {
                    "id": "plugin_host",
                    "type": "npc",
                    "x": 0,
                    "y": 0,
                    "trigger": "interact",
                    "commands": [
                        {
                            "type": "pluginCommand",
                            "pluginId": "debug",
                            "command": "setSwitch",
                            "args": { "switchId": "missing_switch", "value": "true" }
                        },
                        {
                            "type": "pluginCommand",
                            "pluginId": "debug",
                            "command": "setVariable",
                            "args": { "variableId": "score", "value": "42" }
                        },
                        {
                            "type": "pluginCommand",
                            "pluginId": "customLocal",
                            "command": "unknownCommand",
                            "args": { "payload": "deterministic scalar" }
                        }
                    ]
                }
            ]
        })",
        R"({
            "items": "database/items.json",
            "switches": "database/switches.json",
            "variables": "database/variables.json"
        })");

    writeFile(root / "database" / "items.json",
              R"({ "schemaVersion": 1, "items": [] })");
    writeFile(root / "database" / "switches.json",
              R"({ "schemaVersion": 1, "switches": [{ "id": "story_ready", "name": "Story Ready", "initial": false }] })");
    writeFile(root / "database" / "variables.json",
              R"({ "schemaVersion": 1, "variables": [{ "id": "score", "name": "Score", "initial": 0 }] })");

    rpg::RuntimeProjectValidator validator;
    const auto report = validator.validateProjectFile(root / "project.json");

    CHECK(report.hasErrors());
    CHECK(hasMessage(report, rpg::RuntimeValidationSeverity::Error,
                     "pluginCommand debug.setSwitch arg \"switchId\" references unknown switch \"missing_switch\""));
    CHECK(hasMessage(report, rpg::RuntimeValidationSeverity::Error,
                     "pluginCommand debug.setSwitch arg \"value\" must be boolean"));
    CHECK(hasMessage(report, rpg::RuntimeValidationSeverity::Error,
                     "pluginCommand debug.setVariable arg \"value\" must be number"));
    CHECK_FALSE(hasMessage(report, rpg::RuntimeValidationSeverity::Error,
                           "customLocal.unknownCommand"));

    fs::remove_all(root);
}
