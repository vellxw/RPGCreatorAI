#pragma once
#include <string>
#include <unordered_map>
#include "types/Direction.h"

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

    bool getFlag(const std::string& name) const;
    void setFlag(const std::string& name, bool value);

    int getVariable(const std::string& name) const;
    void setVariable(const std::string& name, int value);

    void addItem(const std::string& itemId, int amount);
    bool hasItem(const std::string& itemId, int amount) const;
    const std::unordered_map<std::string, int>& getInventory() const { return inventory; }

    const std::unordered_map<std::string, bool>& getFlags() const { return flags; }
    const std::unordered_map<std::string, int>& getVariables() const { return variables; }
    
    void loadFromMaps(const std::unordered_map<std::string, bool>& newFlags, 
                      const std::unordered_map<std::string, int>& newVariables,
                      const std::unordered_map<std::string, int>& newInventory) {
        flags = newFlags;
        variables = newVariables;
        inventory = newInventory;
    }

private:
    std::string currentMapId;
    int playerX;
    int playerY;
    Direction playerDirection;

    std::unordered_map<std::string, bool> flags;
    std::unordered_map<std::string, int> variables;
    std::unordered_map<std::string, int> inventory;
};
