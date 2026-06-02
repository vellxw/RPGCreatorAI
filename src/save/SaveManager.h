#pragma once
#include "events/GameState.h"
#include <optional>
#include <string>
#include <vector>

class SaveManager {
public:
    enum class LoadStatus {
        Loaded,
        Missing,
        Invalid,
        UnsupportedVersion,
    };

    struct SaveResult {
        bool ok = false;
        std::string path;
        std::string error;
    };

    struct LoadResult {
        LoadStatus status = LoadStatus::Missing;
        std::string path;
        std::string error;
        std::optional<GameState> state;

        bool ok() const { return status == LoadStatus::Loaded && state.has_value(); }
    };

    struct SlotMetadata {
        int index = 1;
        bool exists = false;
        bool loadable = false;
        bool corrupt = false;
        std::string mapId;
        int gold = 0;
        std::vector<std::string> party;
        long long mtimeUnix = 0;
        std::string detail;
    };

    static SaveResult saveDetailed(const std::string& slotId, const GameState& state);
    static LoadResult loadDetailed(const std::string& slotId);
    static bool save(const std::string& slotId, const GameState& state);
    static std::optional<GameState> load(const std::string& slotId);
    static bool hasSave(const std::string& slotId);
    static std::vector<SlotMetadata> listSlots(int maxSlots);
    
private:
    static std::string getSavePath(const std::string& slotId);
};
