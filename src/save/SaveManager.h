#pragma once
#include "events/GameState.h"
#include <optional>
#include <string>
#include <vector>

class SaveManager {
public:
    struct SlotMetadata {
        int index = 1;
        bool exists = false;
        std::string mapId;
        int gold = 0;
        std::vector<std::string> party;
        long long mtimeUnix = 0;
    };

    static bool save(const std::string& slotId, const GameState& state);
    static std::optional<GameState> load(const std::string& slotId);
    static bool hasSave(const std::string& slotId);
    static std::vector<SlotMetadata> listSlots(int maxSlots);
    
private:
    static std::string getSavePath(const std::string& slotId);
};
