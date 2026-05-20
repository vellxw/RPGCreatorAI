#pragma once
#include <string>
#include <unordered_map>
#include <vector>
#include "types/Direction.h"

// Phase 6 — quest progress map.
struct QuestState {
    std::string state; // "inactive", "active", "completed", "failed"
    std::unordered_map<std::string, std::string> objectives; // objectiveId -> "open"|"done"
};

class GameState {
public:
    GameState();

    const std::string& getCurrentMapId() const { return currentMapId; }
    void setCurrentMap(const std::string& mapId) { currentMapId = mapId; }

    int getPlayerX() const { return playerX; }
    int getPlayerY() const { return playerY; }
    Direction getPlayerDirection() const { return playerDirection; }

    void setPlayerPosition(int x, int y, Direction dir) {
        playerX = x;
        playerY = y;
        playerDirection = dir;
    }

    // Legacy boolean flags (kept for backward compatibility with Phase 1/2 saves).
    bool getFlag(const std::string& name) const;
    void setFlag(const std::string& name, bool value);

    // Phase 6 typed switches & variables. Switches read through to flags so
    // the legacy `setFlag/ifFlag` runtime keeps working alongside the typed
    // `controlSwitch/ifSwitch` commands.
    bool getSwitch(const std::string& id) const;
    void setSwitch(const std::string& id, bool value);

    bool getSelfSwitch(const std::string& mapId, const std::string& eventId, char letter) const;
    void setSelfSwitch(const std::string& mapId, const std::string& eventId, char letter, bool value);

    int getVariable(const std::string& name) const;
    void setVariable(const std::string& name, int value);

    // Inventory.
    void addItem(const std::string& itemId, int amount);
    void removeItem(const std::string& itemId, int amount);
    bool hasItem(const std::string& itemId, int amount) const;
    const std::unordered_map<std::string, int>& getInventory() const { return inventory; }

    // Gold.
    int getGold() const { return gold; }
    void setGold(int value) { gold = value < 0 ? 0 : value; }
    void addGold(int amount);
    void removeGold(int amount);

    // Party (ordered actor ids).
    const std::vector<std::string>& getParty() const { return party; }
    void setParty(const std::vector<std::string>& p) { party = p; }
    bool inParty(const std::string& actorId) const;

    // Quest state.
    const std::unordered_map<std::string, QuestState>& getQuests() const { return quests; }
    QuestState* getQuestMutable(const std::string& questId);
    void startQuest(const std::string& questId, const std::vector<std::string>& objectiveIds);
    void completeQuest(const std::string& questId);
    void updateQuestObjective(const std::string& questId, const std::string& objectiveId, const std::string& state);

    // Actor HP overrides — used by changeActorHp + battle results so save/load
    // preserves party HP without coupling to the database loader.
    int getActorHp(const std::string& actorId, int defaultValue) const;
    void setActorHp(const std::string& actorId, int hp);
    const std::unordered_map<std::string, int>& getActorHps() const { return actorHps; }

    const std::unordered_map<std::string, bool>& getFlags() const { return flags; }
    const std::unordered_map<std::string, int>& getVariables() const { return variables; }
    const std::unordered_map<std::string, bool>& getSwitches() const { return switches; }
    const std::unordered_map<std::string, bool>& getSelfSwitches() const { return selfSwitches; }

    void loadFromMaps(const std::unordered_map<std::string, bool>& newFlags,
                      const std::unordered_map<std::string, int>& newVariables,
                      const std::unordered_map<std::string, int>& newInventory) {
        flags = newFlags;
        variables = newVariables;
        inventory = newInventory;
    }

private:
    std::string currentMapId;
    int playerX = 0;
    int playerY = 0;
    Direction playerDirection = Direction::Down;

    std::unordered_map<std::string, bool> flags;
    std::unordered_map<std::string, bool> switches;
    std::unordered_map<std::string, bool> selfSwitches;
    std::unordered_map<std::string, int> variables;
    std::unordered_map<std::string, int> inventory;

    int gold = 0;
    std::vector<std::string> party;
    std::unordered_map<std::string, QuestState> quests;
    std::unordered_map<std::string, int> actorHps;
};
