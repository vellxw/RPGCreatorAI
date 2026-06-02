#include "runtime/RuntimeDebugSnapshot.h"

#include <fstream>
#include <algorithm>
#include <nlohmann/json.hpp>
#include <system_error>

namespace rpg {

namespace {

std::size_t declaredTotal(std::size_t declared, std::size_t actual) {
    return std::max(declared, actual);
}

std::size_t omittedCount(std::size_t total, std::size_t emitted) {
    return total > emitted ? total - emitted : 0;
}

template <typename T>
nlohmann::json boundedObject(const std::map<std::string, T>& values) {
    nlohmann::json object = nlohmann::json::object();
    std::size_t emitted = 0;
    for (const auto& [key, value] : values) {
        if (emitted >= kRuntimeDebugSnapshotCollectionLimit) break;
        object[key] = value;
        ++emitted;
    }
    return object;
}

nlohmann::json boundedStringArray(const std::vector<std::string>& values,
                                  std::size_t limit) {
    nlohmann::json array = nlohmann::json::array();
    for (const auto& value : values) {
        if (array.size() >= limit) break;
        array.push_back(value);
    }
    return array;
}

} // namespace

std::filesystem::path runtimeDebugSnapshotPath(const std::filesystem::path& runtimeLogsDir) {
    return runtimeLogsDir / "runtime-state-snapshot.json";
}

std::string serializeRuntimeDebugSnapshot(const RuntimeDebugSnapshot& snapshot) {
    const auto party = boundedStringArray(snapshot.party, kRuntimeDebugSnapshotCollectionLimit);
    const auto switches = boundedObject(snapshot.switches);
    const auto variables = boundedObject(snapshot.variables);
    const auto selfSwitches = boundedObject(snapshot.selfSwitches);
    const auto inventory = boundedObject(snapshot.inventory);
    const auto runningEventIds =
        boundedStringArray(snapshot.runningEventIds, kRuntimeDebugSnapshotRunningEventLimit);

    const std::size_t partyTotal = declaredTotal(snapshot.partyCount, snapshot.party.size());
    const std::size_t switchTotal = declaredTotal(snapshot.switchCount, snapshot.switches.size());
    const std::size_t variableTotal = declaredTotal(snapshot.variableCount, snapshot.variables.size());
    const std::size_t selfSwitchTotal = declaredTotal(snapshot.selfSwitchCount, snapshot.selfSwitches.size());
    const std::size_t inventoryTotal = declaredTotal(snapshot.inventoryCount, snapshot.inventory.size());
    const std::size_t runningEventTotal =
        declaredTotal(snapshot.runningEventCount, snapshot.runningEventIds.size());

    nlohmann::json json;
    json["schemaVersion"] = 1;
    json["frameNumber"] = snapshot.frameNumber;
    json["mapId"] = snapshot.mapId;
    json["map"] = {
        {"id", snapshot.mapId},
        {"width", snapshot.mapWidth},
        {"height", snapshot.mapHeight},
        {"tileSize", snapshot.tileSize},
    };
    json["player"] = {
        {"x", snapshot.playerX},
        {"y", snapshot.playerY},
        {"direction", snapshot.playerDirection},
    };
    json["gold"] = snapshot.gold;
    json["party"] = party;
    json["switches"] = switches;
    json["variables"] = variables;
    json["selfSwitches"] = selfSwitches;
    json["inventory"] = inventory;
    json["active"] = {
        {"dialogue", snapshot.activeDialogue},
        {"menu", snapshot.activeMenu},
        {"shop", snapshot.activeShop},
        {"battle", snapshot.activeBattle},
    };
    json["runningEventIds"] = runningEventIds;
    json["diagnostics"] = {
        {"limits",
         {
             {"collectionEntries", kRuntimeDebugSnapshotCollectionLimit},
             {"runningEvents", kRuntimeDebugSnapshotRunningEventLimit},
         }},
        {"counts",
         {
             {"party", partyTotal},
             {"switches", switchTotal},
             {"variables", variableTotal},
             {"selfSwitches", selfSwitchTotal},
             {"inventory", inventoryTotal},
             {"runningEvents", runningEventTotal},
             {"mapEvents", snapshot.mapEventCount},
             {"eventTraceEntries", snapshot.eventTraceEntryCount},
             {"eventTraceCapacity", snapshot.eventTraceCapacity},
         }},
        {"omitted",
         {
             {"party", omittedCount(partyTotal, party.size())},
             {"switches", omittedCount(switchTotal, switches.size())},
             {"variables", omittedCount(variableTotal, variables.size())},
             {"selfSwitches", omittedCount(selfSwitchTotal, selfSwitches.size())},
             {"inventory", omittedCount(inventoryTotal, inventory.size())},
             {"runningEvents", omittedCount(runningEventTotal, runningEventIds.size())},
         }},
    };
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
