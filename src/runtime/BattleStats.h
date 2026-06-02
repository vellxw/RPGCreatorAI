#pragma once

#include "database/RpgDatabases.h"

namespace rpg {

struct ActorBattleStats {
    StatsCpp stats;
    int hp = 0;
    int mp = 0;
};

ActorBattleStats resolveActorBattleStats(const RpgDatabases& dbs,
                                         const ActorRecord& actor);

} // namespace rpg
