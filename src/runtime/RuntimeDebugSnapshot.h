#pragma once

#include <cstdint>
#include <filesystem>
#include <map>
#include <string>
#include <vector>

namespace rpg {

struct RuntimeDebugSnapshot {
    std::uint64_t frameNumber = 0;
    std::string mapId;
    int playerX = 0;
    int playerY = 0;
    std::string playerDirection = "down";
    int gold = 0;
    std::vector<std::string> party;
    std::map<std::string, bool> switches;
    std::map<std::string, int> variables;
    std::map<std::string, bool> selfSwitches;
    std::map<std::string, int> inventory;
    bool activeDialogue = false;
    bool activeMenu = false;
    bool activeShop = false;
    bool activeBattle = false;
    std::vector<std::string> runningEventIds;
};

std::filesystem::path runtimeDebugSnapshotPath(const std::filesystem::path& runtimeLogsDir);
std::string serializeRuntimeDebugSnapshot(const RuntimeDebugSnapshot& snapshot);
bool writeRuntimeDebugSnapshotAtomic(const std::filesystem::path& path,
                                     const RuntimeDebugSnapshot& snapshot,
                                     std::string* error = nullptr);

} // namespace rpg
