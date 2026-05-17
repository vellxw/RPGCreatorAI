#include "runtime/BattleSummarySystem.h"

#include "database/RpgDatabases.h"
#include "events/GameState.h"
#include "platform/InputManager.h"

#include <unordered_map>

namespace rpg {

namespace {

std::string labelFor(BattleResult::Outcome outcome) {
    switch (outcome) {
        case BattleResult::Outcome::Victory: return "VICTORY";
        case BattleResult::Outcome::Defeat: return "DEFEAT";
        case BattleResult::Outcome::Escape: return "ESCAPE";
    }
    return "RESULT";
}

} // namespace

void BattleSummarySystem::open(const std::string& troopId,
                               const BattleResult& result,
                               const RpgDatabases& dbs,
                               const GameState& state) {
    viewModel_ = {};
    viewModel_.active = true;
    viewModel_.goldAwarded = result.goldAwarded;
    viewModel_.expAwarded = result.expAwarded;
    viewModel_.outcomeLabel = labelFor(result.outcome);

    const TroopRecord* troop = dbs.findTroop(troopId);
    viewModel_.title = troop && !troop->name.empty() ? troop->name : troopId;

    if (troop) {
        std::unordered_map<std::string, int> enemyCounts;
        std::vector<std::string> enemyOrder;
        for (const auto& enemyId : troop->members) {
            if (enemyCounts.emplace(enemyId, 0).second) {
                enemyOrder.push_back(enemyId);
            }
            ++enemyCounts[enemyId];
        }

        for (const auto& enemyId : enemyOrder) {
            EnemyRow row;
            if (const EnemyRecord* enemy = dbs.findEnemy(enemyId)) {
                row.name = enemy->name.empty() ? enemyId : enemy->name;
            } else {
                row.name = enemyId;
            }
            row.count = enemyCounts[enemyId];
            viewModel_.enemies.push_back(std::move(row));
        }
    }

    for (const auto& actorId : state.getParty()) {
        PartyRow row;
        if (const ActorRecord* actor = dbs.findActor(actorId)) {
            row.name = actor->name.empty() ? actorId : actor->name;
            row.maxHp = actor->baseStats.maxHp;
            row.hp = state.getActorHp(actorId, actor->hp);
        } else {
            row.name = actorId;
            row.hp = state.getActorHp(actorId, 0);
        }
        viewModel_.party.push_back(std::move(row));
    }

    for (const auto& [itemId, amount] : result.itemsAwarded) {
        RewardRow row;
        if (const ItemRecord* item = dbs.findItem(itemId)) {
            row.name = item->name.empty() ? itemId : item->name;
        } else {
            row.name = itemId;
        }
        row.amount = amount;
        viewModel_.rewards.push_back(std::move(row));
    }
}

void BattleSummarySystem::close() {
    viewModel_ = {};
}

bool BattleSummarySystem::handleInput(const InputManager& input) {
    if (!isOpen()) {
        return false;
    }

    if (input.isJustPressed(KeyButton::Confirm) ||
        input.isJustPressed(KeyButton::Cancel) ||
        input.isJustPressed(KeyButton::Menu)) {
        close();
    }

    return true;
}

} // namespace rpg
