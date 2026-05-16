#include <doctest/doctest.h>
#include "events/GameState.h"

TEST_CASE("GameState defaults") {
    GameState s;
    CHECK(s.getCurrentMapId().empty());
    CHECK(s.getPlayerX() == 0);
    CHECK(s.getPlayerY() == 0);
    CHECK(s.getPlayerDirection() == Direction::Down);
    CHECK(s.getFlag("anything") == false);
    CHECK(s.getSwitch("anything") == false);
    CHECK(s.getVariable("anything") == 0);
    CHECK(s.hasItem("anything", 1) == false);
    CHECK(s.getGold() == 0);
    CHECK(s.getParty().empty());
    CHECK(s.getQuests().empty());
}

TEST_CASE("GameState flags, variables, inventory, position") {
    GameState s;
    s.setCurrentMap("town");
    s.setPlayerPosition(7, 9, Direction::Left);
    s.setFlag("opened", true);
    s.setVariable("gold", 42);
    s.addItem("potion", 2);
    s.addItem("potion", 3);
    s.addItem("key", 1);

    CHECK(s.getCurrentMapId() == "town");
    CHECK(s.getPlayerX() == 7);
    CHECK(s.getPlayerY() == 9);
    CHECK(s.getPlayerDirection() == Direction::Left);
    CHECK(s.getFlag("opened") == true);
    CHECK(s.getFlag("missing") == false);
    CHECK(s.getVariable("gold") == 42);
    CHECK(s.getVariable("missing") == 0);
    CHECK(s.hasItem("potion", 5) == true);
    CHECK(s.hasItem("potion", 6) == false);
    CHECK(s.hasItem("key", 1) == true);
}

TEST_CASE("GameState gold clamps non-negative") {
    GameState s;
    s.addGold(50);
    CHECK(s.getGold() == 50);
    s.removeGold(70);
    CHECK(s.getGold() == 0);
    s.removeGold(10);
    CHECK(s.getGold() == 0);
    s.addGold(-1);
    CHECK(s.getGold() == 0);
}

TEST_CASE("GameState removeItem clamps to zero") {
    GameState s;
    s.addItem("potion", 3);
    s.removeItem("potion", 5);
    CHECK(s.hasItem("potion", 1) == false);
    CHECK(s.getInventory().count("potion") == 0);
}

TEST_CASE("GameState typed switches mirror legacy flags") {
    GameState s;
    s.setSwitch("door_open", true);
    CHECK(s.getSwitch("door_open") == true);
    CHECK(s.getFlag("door_open") == true);

    s.setFlag("legacy_only", true);
    CHECK(s.getSwitch("legacy_only") == true);
}

TEST_CASE("GameState quest progression is idempotent") {
    GameState s;
    s.startQuest("q1", {"a", "b"});
    s.updateQuestObjective("q1", "a", "done");
    s.startQuest("q1", {"a", "b", "c"}); // adds c without resetting a
    auto* q = s.getQuestMutable("q1");
    REQUIRE(q != nullptr);
    CHECK(q->state == "active");
    CHECK(q->objectives.at("a") == "done");
    CHECK(q->objectives.at("c") == "open");

    s.completeQuest("q1");
    CHECK(s.getQuests().at("q1").state == "completed");
}

TEST_CASE("GameState party state") {
    GameState s;
    s.setParty({"arc", "luna"});
    CHECK(s.inParty("arc"));
    CHECK(s.inParty("luna"));
    CHECK_FALSE(s.inParty("ghost"));
}
