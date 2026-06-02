#pragma once

#include <cstdint>
#include <cstddef>
#include <filesystem>
#include <map>
#include <string>
#include <vector>

namespace rpg {

inline constexpr std::size_t kRuntimeDebugSnapshotCollectionLimit = 64;
inline constexpr std::size_t kRuntimeDebugSnapshotRunningEventLimit = 32;

struct RuntimeDebugSnapshot {
    std::uint64_t frameNumber = 0;
    std::string mapId;
    int mapWidth = 0;
    int mapHeight = 0;
    int tileSize = 0;
    std::size_t mapEventCount = 0;
    int playerX = 0;
    int playerY = 0;
    std::string playerDirection = "down";
    int gold = 0;
    std::vector<std::string> party;
    std::size_t partyCount = 0;
    std::map<std::string, bool> switches;
    std::size_t switchCount = 0;
    std::map<std::string, int> variables;
    std::size_t variableCount = 0;
    std::map<std::string, bool> selfSwitches;
    std::size_t selfSwitchCount = 0;
    std::map<std::string, int> inventory;
    std::size_t inventoryCount = 0;
    bool activeDialogue = false;
    bool activeMenu = false;
    bool activeShop = false;
    bool activeBattle = false;
    std::vector<std::string> runningEventIds;
    std::size_t runningEventCount = 0;
    std::size_t eventTraceEntryCount = 0;
    std::size_t eventTraceCapacity = 0;
};

std::filesystem::path runtimeDebugSnapshotPath(const std::filesystem::path& runtimeLogsDir);
std::string serializeRuntimeDebugSnapshot(const RuntimeDebugSnapshot& snapshot);
bool writeRuntimeDebugSnapshotAtomic(const std::filesystem::path& path,
                                     const RuntimeDebugSnapshot& snapshot,
                                     std::string* error = nullptr);

} // namespace rpg
