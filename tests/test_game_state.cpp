#include <doctest/doctest.h>
#include "events/GameState.h"

TEST_CASE("GameState defaults") {
    GameState s;
    CHECK(s.getCurrentMapId().empty());
    CHECK(s.getPlayerX() == 0);
    CHECK(s.getPlayerY() == 0);
    CHECK(s.getPlayerDirection() == Direction::Down);
    CHECK(s.getFlag("anything") == false);
    CHECK(s.getVariable("anything") == 0);
    CHECK(s.hasItem("anything", 1) == false);
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
