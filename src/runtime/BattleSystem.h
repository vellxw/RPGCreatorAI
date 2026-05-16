#pragma once
#include <string>
#include <vector>
#include "events/EventRunner.h"
#include "database/RpgDatabases.h"

namespace rpg {

// Deterministic battle resolver. Phase 6 v1: party first, enemies second,
// formula `max(1, atk * 2 - def)`. Works without rendering UI; the runner
// calls this synchronously.
class BattleSystem {
public:
    BattleSystem(const RpgDatabases& dbs, class GameState& state);

    BattleResult run(const std::string& troopId);

    // Test seam — exposes the damage formula directly so unit tests can
    // assert the math without standing up a full battle.
    static int computeDamage(int attackerAttack, int defenderDefense);

private:
    const RpgDatabases& dbs_;
    class GameState& state_;
};

} // namespace rpg
