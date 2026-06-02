#include "runtime/BattleStats.h"

#include <algorithm>

namespace rpg {

namespace {

void addScaled(StatsCpp& stats, const StatsCpp& delta, int scale) {
    stats.maxHp += delta.maxHp * scale;
    stats.maxMp += delta.maxMp * scale;
    stats.attack += delta.attack * scale;
    stats.defense += delta.defense * scale;
    stats.magicAttack += delta.magicAttack * scale;
    stats.magicDefense += delta.magicDefense * scale;
    stats.agility += delta.agility * scale;
    stats.luck += delta.luck * scale;
}

void add(StatsCpp& stats, const StatsCpp& delta) {
    addScaled(stats, delta, 1);
}

} // namespace

ActorBattleStats resolveActorBattleStats(const RpgDatabases& dbs,
                                         const ActorRecord& actor) {
    ActorBattleStats resolved;
    resolved.stats = actor.baseStats;
    resolved.hp = actor.hp;
    resolved.mp = actor.mp;

    const int levelSteps = std::max(0, actor.level - 1);
    if (levelSteps > 0) {
        if (const ClassRecord* klass = dbs.findClass(actor.classId)) {
            addScaled(resolved.stats, klass->growth, levelSteps);
            resolved.hp += klass->growth.maxHp * levelSteps;
            resolved.mp += klass->growth.maxMp * levelSteps;
        }
    }

    for (const auto& [slot, itemId] : actor.equipment) {
        (void)slot;
        if (const ItemRecord* item = dbs.findItem(itemId)) {
            add(resolved.stats, item->modifiers);
        }
    }

    resolved.hp = std::max(0, resolved.hp);
    resolved.mp = std::max(0, resolved.mp);
    resolved.stats.maxHp = std::max(0, resolved.stats.maxHp);
    resolved.stats.maxMp = std::max(0, resolved.stats.maxMp);
    resolved.stats.attack = std::max(0, resolved.stats.attack);
    resolved.stats.defense = std::max(0, resolved.stats.defense);
    resolved.stats.magicAttack = std::max(0, resolved.stats.magicAttack);
    resolved.stats.magicDefense = std::max(0, resolved.stats.magicDefense);
    resolved.stats.agility = std::max(0, resolved.stats.agility);
    resolved.stats.luck = std::max(0, resolved.stats.luck);

    return resolved;
}

} // namespace rpg
