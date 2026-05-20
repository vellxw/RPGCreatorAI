#include "events/GameState.h"
#include <algorithm>
#include <cctype>

GameState::GameState() = default;

// ---- legacy flags --------------------------------------------------------

bool GameState::getFlag(const std::string& name) const {
    auto it = flags.find(name);
    return it != flags.end() ? it->second : false;
}

void GameState::setFlag(const std::string& name, bool value) {
    flags[name] = value;
}

// ---- typed switches ------------------------------------------------------

bool GameState::getSwitch(const std::string& id) const {
    auto it = switches.find(id);
    if (it != switches.end()) return it->second;
    // Fallback to legacy flags so old data keeps working with the typed API.
    auto legacy = flags.find(id);
    return legacy != flags.end() ? legacy->second : false;
}

void GameState::setSwitch(const std::string& id, bool value) {
    switches[id] = value;
    // Mirror to legacy flags so existing event commands and saves remain
    // backward-compatible.
    flags[id] = value;
}

// ---- self switches -------------------------------------------------------

namespace {

char normalizeSelfSwitch(char letter) {
    const auto upper = static_cast<char>(std::toupper(static_cast<unsigned char>(letter)));
    return upper >= 'A' && upper <= 'D' ? upper : '\0';
}

std::string selfSwitchKey(const std::string& mapId, const std::string& eventId, char letter) {
    return mapId + ":" + eventId + ":" + std::string(1, letter);
}

} // namespace

bool GameState::getSelfSwitch(const std::string& mapId, const std::string& eventId, char letter) const {
    const char normalized = normalizeSelfSwitch(letter);
    if (normalized == '\0') return false;

    const auto it = selfSwitches.find(selfSwitchKey(mapId, eventId, normalized));
    return it != selfSwitches.end() ? it->second : false;
}

void GameState::setSelfSwitch(const std::string& mapId, const std::string& eventId, char letter, bool value) {
    const char normalized = normalizeSelfSwitch(letter);
    if (normalized == '\0') return;

    selfSwitches[selfSwitchKey(mapId, eventId, normalized)] = value;
}

// ---- variables -----------------------------------------------------------

int GameState::getVariable(const std::string& name) const {
    auto it = variables.find(name);
    return it != variables.end() ? it->second : 0;
}

void GameState::setVariable(const std::string& name, int value) {
    variables[name] = value;
}

// ---- inventory -----------------------------------------------------------

void GameState::addItem(const std::string& itemId, int amount) {
    if (amount <= 0) return;
    inventory[itemId] += amount;
}

void GameState::removeItem(const std::string& itemId, int amount) {
    if (amount <= 0) return;
    auto it = inventory.find(itemId);
    if (it == inventory.end()) return;
    it->second -= amount;
    if (it->second <= 0) inventory.erase(it);
}

bool GameState::hasItem(const std::string& itemId, int amount) const {
    auto it = inventory.find(itemId);
    return it != inventory.end() && it->second >= amount;
}

// ---- gold ----------------------------------------------------------------

void GameState::addGold(int amount) {
    if (amount <= 0) return;
    gold += amount;
}

void GameState::removeGold(int amount) {
    if (amount <= 0) return;
    gold -= amount;
    if (gold < 0) gold = 0;
}

// ---- party ---------------------------------------------------------------

bool GameState::inParty(const std::string& actorId) const {
    return std::find(party.begin(), party.end(), actorId) != party.end();
}

// ---- quests --------------------------------------------------------------

QuestState* GameState::getQuestMutable(const std::string& questId) {
    auto it = quests.find(questId);
    return it == quests.end() ? nullptr : &it->second;
}

void GameState::startQuest(const std::string& questId, const std::vector<std::string>& objectiveIds) {
    auto& q = quests[questId];
    if (q.state != "completed" && q.state != "failed") {
        q.state = "active";
    }
    for (const auto& oid : objectiveIds) {
        if (q.objectives.find(oid) == q.objectives.end()) q.objectives[oid] = "open";
    }
}

void GameState::completeQuest(const std::string& questId) {
    auto& q = quests[questId];
    q.state = "completed";
    for (auto& kv : q.objectives) kv.second = "done";
}

void GameState::updateQuestObjective(const std::string& questId,
                                     const std::string& objectiveId,
                                     const std::string& state) {
    auto& q = quests[questId];
    if (q.state.empty() || q.state == "inactive") q.state = "active";
    q.objectives[objectiveId] = state;
}

// ---- actor hp ------------------------------------------------------------

int GameState::getActorHp(const std::string& actorId, int defaultValue) const {
    auto it = actorHps.find(actorId);
    return it != actorHps.end() ? it->second : defaultValue;
}

void GameState::setActorHp(const std::string& actorId, int hp) {
    actorHps[actorId] = hp < 0 ? 0 : hp;
}
