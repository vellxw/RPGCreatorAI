#include "events/GameState.h"

GameState::GameState() : playerX(0), playerY(0), playerDirection(Direction::Down) {}

bool GameState::getFlag(const std::string& name) const {
    auto it = flags.find(name);
    return it != flags.end() ? it->second : false;
}

void GameState::setFlag(const std::string& name, bool value) {
    flags[name] = value;
}

int GameState::getVariable(const std::string& name) const {
    auto it = variables.find(name);
    return it != variables.end() ? it->second : 0;
}

void GameState::setVariable(const std::string& name, int value) {
    variables[name] = value;
}

void GameState::addItem(const std::string& itemId, int amount) {
    inventory[itemId] += amount;
}

bool GameState::hasItem(const std::string& itemId, int amount) const {
    auto it = inventory.find(itemId);
    if (it != inventory.end()) {
        return it->second >= amount;
    }
    return false;
}
