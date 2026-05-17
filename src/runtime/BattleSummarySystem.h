#pragma once

#include "events/EventRunner.h"

#include <string>
#include <vector>

class GameState;
class InputManager;

namespace rpg {

class RpgDatabases;

class BattleSummarySystem {
public:
    struct EnemyRow {
        std::string name;
        int count = 0;
    };

    struct PartyRow {
        std::string name;
        int hp = 0;
        int maxHp = 0;
    };

    struct RewardRow {
        std::string name;
        int amount = 0;
    };

    struct ViewModel {
        bool active = false;
        std::string title;
        std::string outcomeLabel;
        int goldAwarded = 0;
        int expAwarded = 0;
        std::vector<EnemyRow> enemies;
        std::vector<PartyRow> party;
        std::vector<RewardRow> rewards;
    };

    void open(const std::string& troopId,
              const BattleResult& result,
              const RpgDatabases& dbs,
              const GameState& state);
    void close();
    bool isOpen() const { return viewModel_.active; }
    bool handleInput(const InputManager& input);
    const ViewModel& snapshot() const { return viewModel_; }

private:
    ViewModel viewModel_;
};

} // namespace rpg
