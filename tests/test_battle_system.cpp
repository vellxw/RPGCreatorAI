#include <doctest/doctest.h>
#include "runtime/BattleSystem.h"
#include "events/GameState.h"
#include "database/RpgDatabases.h"
#include "types/EventTypes.h"

using namespace rpg;

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
