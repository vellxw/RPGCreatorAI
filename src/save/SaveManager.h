#pragma once
#include "events/GameState.h"
#include <string>
#include <optional>

class SaveManager {
public:
    static bool save(const std::string& slotId, const GameState& state);
    static std::optional<GameState> load(const std::string& slotId);
    static bool hasSave(const std::string& slotId);
    
private:
    static std::string getSavePath(const std::string& slotId);
};
