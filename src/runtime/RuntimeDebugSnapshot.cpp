#include "runtime/RuntimeDebugSnapshot.h"

#include <fstream>
#include <nlohmann/json.hpp>
#include <system_error>

namespace rpg {

std::filesystem::path runtimeDebugSnapshotPath(const std::filesystem::path& runtimeLogsDir) {
    return runtimeLogsDir / "runtime-state-snapshot.json";
}

std::string serializeRuntimeDebugSnapshot(const RuntimeDebugSnapshot& snapshot) {
    nlohmann::json json;
    json["schemaVersion"] = 1;
    json["frameNumber"] = snapshot.frameNumber;
    json["mapId"] = snapshot.mapId;
    json["player"] = {
        {"x", snapshot.playerX},
        {"y", snapshot.playerY},
        {"direction", snapshot.playerDirection},
    };
    json["gold"] = snapshot.gold;
    json["party"] = snapshot.party;
    json["switches"] = snapshot.switches;
    json["variables"] = snapshot.variables;
    json["selfSwitches"] = snapshot.selfSwitches;
    json["inventory"] = snapshot.inventory;
    json["active"] = {
        {"dialogue", snapshot.activeDialogue},
        {"menu", snapshot.activeMenu},
        {"shop", snapshot.activeShop},
        {"battle", snapshot.activeBattle},
    };
    json["runningEventIds"] = snapshot.runningEventIds;
    return json.dump();
}

bool writeRuntimeDebugSnapshotAtomic(const std::filesystem::path& path,
                                     const RuntimeDebugSnapshot& snapshot,
                                     std::string* error) {
    auto fail = [error](const std::string& message) {
        if (error) *error = message;
        return false;
    };
    if (error) error->clear();

    const auto parent = path.parent_path();
    if (!parent.empty()) {
        std::error_code mkdirError;
        std::filesystem::create_directories(parent, mkdirError);
        if (mkdirError) {
            return fail("mkdir " + parent.string() + ": " + mkdirError.message());
        }
    }

    const std::filesystem::path tempPath = path.string() + ".tmp";
    {
        std::ofstream out(tempPath, std::ios::binary | std::ios::trunc);
        if (!out) return fail("open " + tempPath.string() + " for write");
        out << serializeRuntimeDebugSnapshot(snapshot);
        out.flush();
        if (!out) return fail("write " + tempPath.string());
    }

    std::error_code removeError;
    std::filesystem::remove(path, removeError);

    std::error_code renameError;
    std::filesystem::rename(tempPath, path, renameError);
    if (renameError) {
        std::error_code cleanupError;
        std::filesystem::remove(tempPath, cleanupError);
        return fail("replace " + path.string() + ": " + renameError.message());
    }
    return true;
}

} // namespace rpg
