#include <doctest/doctest.h>
#include "save/SaveManager.h"
#include "events/GameState.h"
#include <cstdio>

namespace {

constexpr const char* kSlot = "test_phase2_slot";

} // namespace

TEST_CASE("SaveManager round-trips a populated GameState") {
    GameState src;
    src.setCurrentMap("house");
    src.setPlayerPosition(5, 5, Direction::Left);
    src.setFlag("chest_001_opened", true);
    src.setVariable("gold", 17);
    src.addItem("potion", 5);

    REQUIRE(SaveManager::save(kSlot, src));
    REQUIRE(SaveManager::hasSave(kSlot));

    auto loaded = SaveManager::load(kSlot);
    REQUIRE(loaded.has_value());
    CHECK(loaded->getCurrentMapId() == "house");
    CHECK(loaded->getPlayerX() == 5);
    CHECK(loaded->getPlayerY() == 5);
    CHECK(loaded->getPlayerDirection() == Direction::Left);
    CHECK(loaded->getFlag("chest_001_opened") == true);
    CHECK(loaded->getVariable("gold") == 17);
    CHECK(loaded->hasItem("potion", 5));
    CHECK_FALSE(loaded->hasItem("sword", 1));

    // Cleanup the save file written into saves/ from the project root.
    std::remove((std::string("saves/") + kSlot + ".json").c_str());
}

TEST_CASE("SaveManager::load returns nullopt for missing slot") {
    auto loaded = SaveManager::load("definitely_does_not_exist_slot");
    CHECK_FALSE(loaded.has_value());
}
