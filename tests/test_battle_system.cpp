#include <doctest/doctest.h>
#include "runtime/BattleSystem.h"
#include "events/GameState.h"
#include "database/RpgDatabases.h"
#include "types/EventTypes.h"
#include "types/ProjectTypes.h"

#include <filesystem>
#include <fstream>
#include <string>
#include <utility>

using namespace rpg;

namespace {

namespace fs = std::filesystem;

void writeFile(const fs::path& path, const std::string& content) {
    fs::create_directories(path.parent_path());
    std::ofstream out(path);
    out << content;
}

class BattleFixtureDir {
public:
    explicit BattleFixtureDir(std::string name)
        : root_(fs::current_path() / ("test_tmp_battle_system_" + std::move(name))) {
        fs::remove_all(root_);
        fs::create_directories(root_);
    }

    ~BattleFixtureDir() {
        fs::remove_all(root_);
    }

    fs::path path(const std::string& filename) const {
        return root_ / filename;
    }

private:
    fs::path root_;
};

} // namespace

TEST_CASE("BattleSystem::computeDamage uses formula max(1, atk*2 - def)") {
    CHECK(BattleSystem::computeDamage(5, 0) == 10);
    CHECK(BattleSystem::computeDamage(5, 5) == 5);
    CHECK(BattleSystem::computeDamage(1, 100) == 1); // floored at 1
    CHECK(BattleSystem::computeDamage(10, 3) == 17);
    CHECK(BattleSystem::computeDamage(0, 0) == 1);
}

TEST_CASE("BattleSystem auto-defeats with empty party") {
    RpgDatabases dbs;
    GameState state;
    BattleSystem battle(dbs, state);
    auto result = battle.run("any_troop");
    CHECK(result.outcome == BattleResult::Outcome::Defeat);
}

TEST_CASE("BattleSystem applies actor class growth by level to battle stats") {
    BattleFixtureDir fixture("class_growth");
    writeFile(fixture.path("items.json"), R"({ "schemaVersion": 1, "items": [] })");
    writeFile(fixture.path("actors.json"), R"({
        "schemaVersion": 1,
        "actors": [
            {
                "id": "arc",
                "name": "Arc",
                "classId": "hero",
                "level": 3,
                "hp": 3,
                "mp": 0,
                "baseStats": {
                    "maxHp": 3,
                    "maxMp": 0,
                    "attack": 1,
                    "defense": 0,
                    "magicAttack": 0,
                    "magicDefense": 0,
                    "agility": 1,
                    "luck": 1
                },
                "equipment": {},
                "skills": []
            }
        ]
    })");
    writeFile(fixture.path("classes.json"), R"({
        "schemaVersion": 1,
        "classes": [
            {
                "id": "hero",
                "name": "Hero",
                "growth": {
                    "maxHp": 0,
                    "maxMp": 0,
                    "attack": 5,
                    "defense": 0,
                    "magicAttack": 0,
                    "magicDefense": 0,
                    "agility": 0,
                    "luck": 0
                },
                "usableEquipment": [],
                "learnedSkills": []
            }
        ]
    })");
    writeFile(fixture.path("enemies.json"), R"({
        "schemaVersion": 1,
        "enemies": [
            {
                "id": "slime",
                "name": "Slime",
                "stats": {
                    "maxHp": 10,
                    "maxMp": 0,
                    "attack": 2,
                    "defense": 0,
                    "magicAttack": 0,
                    "magicDefense": 0,
                    "agility": 1,
                    "luck": 1
                },
                "exp": 4,
                "gold": 8,
                "drops": []
            }
        ]
    })");
    writeFile(fixture.path("troops.json"), R"({
        "schemaVersion": 1,
        "troops": [
            { "id": "slime_one", "name": "Slime", "members": ["slime"] }
        ]
    })");

    ProjectData project;
    project.database.itemsPath = fixture.path("items.json").string();
    project.database.actorsPath = fixture.path("actors.json").string();
    project.database.classesPath = fixture.path("classes.json").string();
    project.database.enemiesPath = fixture.path("enemies.json").string();
    project.database.troopsPath = fixture.path("troops.json").string();

    RpgDatabases dbs;
    REQUIRE(dbs.loadAll(project));

    GameState state;
    state.setParty({"arc"});

    BattleSystem battle(dbs, state);
    const auto result = battle.run("slime_one");

    CHECK(result.outcome == BattleResult::Outcome::Victory);
    CHECK(result.goldAwarded == 8);
    CHECK(result.expAwarded == 4);
}
