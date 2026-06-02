#include "runtime/BattleSystem.h"
#include "runtime/BattleStats.h"
#include "events/GameState.h"
#include "core/Logger.h"
#include <algorithm>

namespace rpg {

BattleSystem::BattleSystem(const RpgDatabases& dbs, GameState& state)
    : dbs_(dbs), state_(state) {}

int BattleSystem::computeDamage(int attackerAttack, int defenderDefense) {
    int dmg = attackerAttack * 2 - defenderDefense;
    return dmg < 1 ? 1 : dmg;
}

namespace {

struct Combatant {
    std::string id;
    int hp;
    int attack;
    int defense;
    bool isParty;
};

} // anon

BattleResult BattleSystem::run(const std::string& troopId) {
    BattleResult result;
    result.outcome = BattleResult::Outcome::Defeat;

    auto* troop = dbs_.findTroop(troopId);
    if (!troop) {
        Logger::warning("BattleSystem: unknown troop '" + troopId + "'");
        return result;
    }

    // Build party combatants from current party + actor HP overrides.
    std::vector<Combatant> party;
    for (const auto& aid : state_.getParty()) {
        const auto* actor = dbs_.findActor(aid);
        if (!actor) continue;
        const ActorBattleStats stats = resolveActorBattleStats(dbs_, *actor);
        Combatant c;
        c.id = aid;
        c.hp = state_.getActorHp(aid, stats.hp);
        c.attack = stats.stats.attack;
        c.defense = stats.stats.defense;
        c.isParty = true;
        party.push_back(c);
    }
    if (party.empty()) {
        Logger::warning("BattleSystem: empty party — auto-defeat");
        return result;
    }

    // Build enemy combatants.
    std::vector<Combatant> enemies;
    int totalGold = 0;
    int totalExp = 0;
    std::vector<std::pair<std::string, int>> drops;
    for (const auto& enemyId : troop->members) {
        const auto* enemy = dbs_.findEnemy(enemyId);
        if (!enemy) continue;
        Combatant c;
        c.id = enemyId;
        c.hp = enemy->stats.maxHp;
        c.attack = enemy->stats.attack;
        c.defense = enemy->stats.defense;
        c.isParty = false;
        enemies.push_back(c);
        totalGold += enemy->gold;
        totalExp += enemy->exp;
        // Deterministic drops: rate >= 1.0 always drops; below 1.0 — drop iff rate * 1000 % 2 even.
        // For Phase 6 we keep it simple: only drop if rate >= 1.0.
        for (const auto& [itemId, rate] : enemy->drops) {
            if (rate >= 1.0) drops.emplace_back(itemId, 1);
        }
    }

    if (enemies.empty()) {
        Logger::warning("BattleSystem: troop has no resolvable enemies — auto-victory");
        result.outcome = BattleResult::Outcome::Victory;
        result.goldAwarded = totalGold;
        result.expAwarded = totalExp;
        result.itemsAwarded = drops;
        return result;
    }

    // Round loop. Bounded so a misconfiguration never hangs the runtime.
    constexpr int kMaxRounds = 64;
    for (int round = 0; round < kMaxRounds; ++round) {
        // Party turn: each living member hits the first living enemy.
        for (auto& p : party) {
            if (p.hp <= 0) continue;
            for (auto& e : enemies) {
                if (e.hp > 0) {
                    e.hp -= computeDamage(p.attack, e.defense);
                    break;
                }
            }
        }
        bool enemiesAlive = std::any_of(enemies.begin(), enemies.end(),
                                        [](const Combatant& c) { return c.hp > 0; });
        if (!enemiesAlive) {
            result.outcome = BattleResult::Outcome::Victory;
            break;
        }

        // Enemy turn.
        for (auto& e : enemies) {
            if (e.hp <= 0) continue;
            for (auto& p : party) {
                if (p.hp > 0) {
                    p.hp -= computeDamage(e.attack, p.defense);
                    break;
                }
            }
        }
        bool partyAlive = std::any_of(party.begin(), party.end(),
                                      [](const Combatant& c) { return c.hp > 0; });
        if (!partyAlive) {
            result.outcome = BattleResult::Outcome::Defeat;
            break;
        }
    }

    // Persist HP back to GameState for save/load.
    for (const auto& p : party) {
        int hp = p.hp < 0 ? 0 : p.hp;
        state_.setActorHp(p.id, hp);
    }

    if (result.outcome == BattleResult::Outcome::Victory) {
        result.goldAwarded = totalGold;
        result.expAwarded = totalExp;
        result.itemsAwarded = drops;
    }

    Logger::info("Battle '" + troopId + "' resolved: " +
                 (result.outcome == BattleResult::Outcome::Victory ? "VICTORY"
                  : result.outcome == BattleResult::Outcome::Defeat ? "DEFEAT" : "ESCAPE"));

    return result;
}

} // namespace rpg
