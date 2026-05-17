#include <doctest/doctest.h>
#include "save/SaveManager.h"
#include "events/GameState.h"
#include <cstdio>
#include <fstream>
#include <optional>
#include <string>

namespace {

constexpr const char* kSlot = "test_phase6_slot";
constexpr const char* kLegacySlot = "test_phase2_legacy_slot";

std::optional<std::string> readExisting(const std::string& path) {
    std::ifstream in(path);
    if (!in) return std::nullopt;
    return std::string((std::istreambuf_iterator<char>(in)),
                       std::istreambuf_iterator<char>());
}

void restoreFile(const std::string& path, const std::optional<std::string>& previous) {
    if (previous) {
        std::ofstream out(path);
        out << *previous;
    } else {
        std::remove(path.c_str());
    }
}

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

TEST_CASE("SaveManager::listSlots reports empty and populated slot metadata") {
    const std::string slot1Path = "saves/slot_1.json";
    const std::string slot2Path = "saves/slot_2.json";
    const auto slot1Before = readExisting(slot1Path);
    const auto slot2Before = readExisting(slot2Path);

    restoreFile(slot1Path, std::nullopt);
    restoreFile(slot2Path, std::nullopt);

    GameState state;
    state.setCurrentMap("house");
    state.setGold(77);
    state.setParty({"arc"});
    REQUIRE(SaveManager::save("slot_2", state));

    const auto slots = SaveManager::listSlots(3);
    REQUIRE(slots.size() == 3);
    CHECK(slots[0].index == 1);
    CHECK_FALSE(slots[0].exists);
    CHECK(slots[1].index == 2);
    CHECK(slots[1].exists);
    CHECK(slots[1].mapId == "house");
    CHECK(slots[1].gold == 77);
    REQUIRE(slots[1].party.size() == 1);
    CHECK(slots[1].party[0] == "arc");
    CHECK(slots[1].mtimeUnix > 0);

    restoreFile(slot1Path, slot1Before);
    restoreFile(slot2Path, slot2Before);
}
