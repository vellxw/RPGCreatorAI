#include <doctest/doctest.h>
#include "save/SaveManager.h"
#include "events/GameState.h"
#include <cstdio>
#include <fstream>

namespace {

constexpr const char* kSlot = "test_phase6_slot";
constexpr const char* kLegacySlot = "test_phase2_legacy_slot";

} // namespace

TEST_CASE("SaveManager round-trips a populated GameState (Phase 6 v2)") {
    GameState src;
    src.setCurrentMap("house");
    src.setPlayerPosition(5, 5, Direction::Left);
    src.setFlag("chest_001_opened", true);
    src.setSwitch("door_open", true);
    src.setVariable("gold", 17);
    src.setVariable("score", 99);
    src.addItem("potion", 5);
    src.setGold(120);
    src.setParty({"arc"});
    src.setActorHp("arc", 14);
    src.startQuest("lost_chest", {"open_chest", "talk_back"});
    src.updateQuestObjective("lost_chest", "open_chest", "done");

    REQUIRE(SaveManager::save(kSlot, src));
    REQUIRE(SaveManager::hasSave(kSlot));

    auto loaded = SaveManager::load(kSlot);
    REQUIRE(loaded.has_value());
    CHECK(loaded->getCurrentMapId() == "house");
    CHECK(loaded->getPlayerX() == 5);
    CHECK(loaded->getPlayerDirection() == Direction::Left);
    CHECK(loaded->getFlag("chest_001_opened") == true);
    CHECK(loaded->getSwitch("door_open") == true);
    CHECK(loaded->getVariable("score") == 99);
    CHECK(loaded->hasItem("potion", 5));
    CHECK_FALSE(loaded->hasItem("sword", 1));
    CHECK(loaded->getGold() == 120);
    REQUIRE(loaded->getParty().size() == 1);
    CHECK(loaded->getParty()[0] == "arc");
    CHECK(loaded->getActorHp("arc", 0) == 14);
    REQUIRE(loaded->getQuests().count("lost_chest") == 1);
    CHECK(loaded->getQuests().at("lost_chest").objectives.at("open_chest") == "done");

    std::remove((std::string("saves/") + kSlot + ".json").c_str());
}

TEST_CASE("SaveManager loads legacy v1 saves with sane defaults") {
    // Phase 2 era save shape (no schemaVersion, no gold/party/quests).
    const std::string body = R"({
        "currentMapId": "town",
        "player": { "x": 1, "y": 2, "direction": "right" },
        "flags": { "talked_to_old_man": true },
        "variables": { "gold": 5 },
        "inventory": { "potion": 2 }
    })";
    std::ofstream out(std::string("saves/") + kLegacySlot + ".json");
    out << body;
    out.close();

    auto loaded = SaveManager::load(kLegacySlot);
    REQUIRE(loaded.has_value());
    CHECK(loaded->getCurrentMapId() == "town");
    CHECK(loaded->getFlag("talked_to_old_man") == true);
    CHECK(loaded->hasItem("potion", 2));
    CHECK(loaded->getGold() == 0);
    CHECK(loaded->getParty().empty());

    std::remove((std::string("saves/") + kLegacySlot + ".json").c_str());
}

TEST_CASE("SaveManager::load returns nullopt for missing slot") {
    auto loaded = SaveManager::load("definitely_does_not_exist_slot");
    CHECK_FALSE(loaded.has_value());
}
