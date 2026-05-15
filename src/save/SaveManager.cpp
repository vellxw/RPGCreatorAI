#include "save/SaveManager.h"
#include "platform/FileSystem.h"
#include "core/Logger.h"
#include <nlohmann/json.hpp>

using json = nlohmann::json;

std::string SaveManager::getSavePath(const std::string& slotId) {
    return "saves/" + slotId + ".json";
}

bool SaveManager::save(const std::string& slotId, const GameState& state) {
    json j;
    j["currentMapId"] = state.getCurrentMapId();
    j["player"]["x"] = state.getPlayerX();
    j["player"]["y"] = state.getPlayerY();
    j["player"]["direction"] = directionToString(state.getPlayerDirection());
    
    j["flags"] = state.getFlags();
    j["variables"] = state.getVariables();
    j["inventory"] = state.getInventory();
    
    std::string path = getSavePath(slotId);
    if (FileSystem::writeFile(path, j.dump(2))) {
        Logger::info("Game saved to " + path);
        return true;
    }
    
    Logger::error("Failed to save game to " + path);
    return false;
}

std::optional<GameState> SaveManager::load(const std::string& slotId) {
    std::string path = getSavePath(slotId);
    auto content = FileSystem::readFile(path);
    if (!content) {
        Logger::warning("No save found at " + path);
        return std::nullopt;
    }
    
    try {
        json j = json::parse(*content);
        GameState state;
        
        state.setCurrentMap(j.at("currentMapId").get<std::string>());
        
        auto player = j.at("player");
        state.setPlayerPosition(
            player.at("x").get<int>(),
            player.at("y").get<int>(),
            stringToDirection(player.at("direction").get<std::string>())
        );
        
        state.loadFromMaps(
            j.at("flags").get<std::unordered_map<std::string, bool>>(),
            j.at("variables").get<std::unordered_map<std::string, int>>(),
            j.at("inventory").get<std::unordered_map<std::string, int>>()
        );
        
        Logger::info("Game loaded from " + path);
        return state;
    } catch (const json::exception& e) {
        Logger::error(std::string("Error parsing save file: ") + e.what());
        return std::nullopt;
    }
}

bool SaveManager::hasSave(const std::string& slotId) {
    return FileSystem::exists(getSavePath(slotId));
}
