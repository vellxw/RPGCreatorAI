#include "save/SaveManager.h"
#include "platform/FileSystem.h"
#include "core/Logger.h"
#include <nlohmann/json.hpp>
#include <chrono>
#include <filesystem>
#include <unordered_map>

using json = nlohmann::json;

namespace {

constexpr int kCurrentSaveSchemaVersion = 2;

struct SaveEnvelopeValidation {
    SaveManager::LoadStatus status = SaveManager::LoadStatus::Loaded;
    std::string error;
};

SaveEnvelopeValidation validateSaveEnvelope(const json& j) {
    int schemaVersion = 1;
    if (j.contains("schemaVersion")) {
        if (!j.at("schemaVersion").is_number_integer()) {
            return {SaveManager::LoadStatus::Invalid,
                    "Save file schemaVersion must be an integer"};
        }
        schemaVersion = j.at("schemaVersion").get<int>();
    }
    if (schemaVersion < 1) {
        return {SaveManager::LoadStatus::Invalid,
                "Save file schemaVersion must be at least 1"};
    }
    if (schemaVersion > kCurrentSaveSchemaVersion) {
        return {SaveManager::LoadStatus::UnsupportedVersion,
                "Save file uses unsupported schemaVersion " +
                    std::to_string(schemaVersion)};
    }

    if (!j.contains("currentMapId") || !j.at("currentMapId").is_string() ||
        j.at("currentMapId").get<std::string>().empty()) {
        return {SaveManager::LoadStatus::Invalid,
                "Save file missing currentMapId"};
    }
    if (!j.contains("player") || !j.at("player").is_object()) {
        return {SaveManager::LoadStatus::Invalid,
                "Save file missing player object"};
    }
    const auto& player = j.at("player");
    if (!player.contains("x") || !player.at("x").is_number_integer() ||
        !player.contains("y") || !player.at("y").is_number_integer()) {
        return {SaveManager::LoadStatus::Invalid,
                "Save file player position must include integer x/y"};
    }
    if (!player.contains("direction") || !player.at("direction").is_string()) {
        return {SaveManager::LoadStatus::Invalid,
                "Save file player direction must be a string"};
    }
    const std::string direction = player.at("direction").get<std::string>();
    if (direction != "up" && direction != "down" &&
        direction != "left" && direction != "right") {
        return {SaveManager::LoadStatus::Invalid,
                "Save file player direction is unsupported: " + direction};
    }

    return {};
}

void fillMtime(SaveManager::SlotMetadata& metadata, const std::string& path) {
    try {
        const auto ftime = std::filesystem::last_write_time(path);
        const auto sctp = std::chrono::time_point_cast<std::chrono::system_clock::duration>(
            ftime - std::filesystem::file_time_type::clock::now() +
            std::chrono::system_clock::now());
        metadata.mtimeUnix =
            std::chrono::duration_cast<std::chrono::seconds>(sctp.time_since_epoch()).count();
    } catch (const std::filesystem::filesystem_error&) {
        metadata.mtimeUnix = 0;
    }
}

SaveManager::LoadResult makeLoadFailure(SaveManager::LoadStatus status,
                                        const std::string& path,
                                        const std::string& error) {
    SaveManager::LoadResult result;
    result.status = status;
    result.path = path;
    result.error = error;
    return result;
}

} // namespace

std::string SaveManager::getSavePath(const std::string& slotId) {
    return "saves/" + slotId + ".json";
}

SaveManager::SaveResult SaveManager::saveDetailed(const std::string& slotId, const GameState& state) {
    json j;
    j["schemaVersion"] = kCurrentSaveSchemaVersion;
    j["currentMapId"] = state.getCurrentMapId();
    j["player"]["x"] = state.getPlayerX();
    j["player"]["y"] = state.getPlayerY();
    j["player"]["direction"] = directionToString(state.getPlayerDirection());

    j["flags"] = state.getFlags();
    j["switches"] = state.getSwitches();
    j["selfSwitches"] = state.getSelfSwitches();
    j["variables"] = state.getVariables();
    j["inventory"] = state.getInventory();
    j["gold"] = state.getGold();
    j["party"] = state.getParty();
    j["actorHps"] = state.getActorHps();

    json questsJson = json::object();
    for (const auto& [qid, q] : state.getQuests()) {
        json qj;
        qj["state"] = q.state;
        qj["objectives"] = q.objectives;
        questsJson[qid] = std::move(qj);
    }
    j["quests"] = std::move(questsJson);

    std::string path = getSavePath(slotId);
    SaveResult result;
    result.path = path;
    if (FileSystem::writeFile(path, j.dump(2))) {
        Logger::info("Game saved to " + path);
        result.ok = true;
        return result;
    }

    result.error = "Failed to write save file: " + path;
    Logger::error(result.error);
    return result;
}

bool SaveManager::save(const std::string& slotId, const GameState& state) {
    return saveDetailed(slotId, state).ok;
}

SaveManager::LoadResult SaveManager::loadDetailed(const std::string& slotId) {
    std::string path = getSavePath(slotId);
    auto content = FileSystem::readFile(path);
    if (!content) {
        const std::string error = "No save found at " + path;
        Logger::warning(error);
        return makeLoadFailure(LoadStatus::Missing, path, error);
    }

    try {
        json j = json::parse(*content);
        auto validation = validateSaveEnvelope(j);
        if (validation.status != LoadStatus::Loaded) {
            Logger::error(validation.error + " in " + path);
            return makeLoadFailure(validation.status, path, validation.error);
        }

        GameState state;

        state.setCurrentMap(j.at("currentMapId").get<std::string>());

        auto player = j.at("player");
        state.setPlayerPosition(
            player.at("x").get<int>(),
            player.at("y").get<int>(),
            stringToDirection(player.at("direction").get<std::string>())
        );

        // Common state
        std::unordered_map<std::string, bool> flags;
        std::unordered_map<std::string, int> variables;
        std::unordered_map<std::string, int> inventory;
        if (j.contains("flags")) flags = j.at("flags").get<std::unordered_map<std::string, bool>>();
        if (j.contains("variables")) variables = j.at("variables").get<std::unordered_map<std::string, int>>();
        if (j.contains("inventory")) inventory = j.at("inventory").get<std::unordered_map<std::string, int>>();
        state.loadFromMaps(flags, variables, inventory);

        // Phase 6 additions (all optional for backwards compatibility)
        if (j.contains("switches")) {
            for (const auto& [id, val] : j.at("switches").items()) {
                state.setSwitch(id, val.get<bool>());
            }
        }
        if (j.contains("selfSwitches")) {
            for (const auto& [key, val] : j.at("selfSwitches").items()) {
                const auto first = key.find(':');
                const auto last = key.rfind(':');
                if (first == std::string::npos || last == std::string::npos || first == last || last + 1 >= key.size()) {
                    continue;
                }

                const std::string mapId = key.substr(0, first);
                const std::string eventId = key.substr(first + 1, last - first - 1);
                state.setSelfSwitch(mapId, eventId, key[last + 1], val.get<bool>());
            }
        }
        if (j.contains("gold")) state.setGold(j.at("gold").get<int>());
        if (j.contains("party")) state.setParty(j.at("party").get<std::vector<std::string>>());
        if (j.contains("actorHps")) {
            for (const auto& [id, val] : j.at("actorHps").items()) {
                state.setActorHp(id, val.get<int>());
            }
        }
        if (j.contains("quests")) {
            for (const auto& [qid, qj] : j.at("quests").items()) {
                std::string st = qj.value("state", std::string{"active"});
                std::vector<std::string> objIds;
                if (qj.contains("objectives")) {
                    for (const auto& [oid, _] : qj.at("objectives").items()) objIds.push_back(oid);
                }
                state.startQuest(qid, objIds);
                auto* q = state.getQuestMutable(qid);
                if (q) q->state = st;
                if (qj.contains("objectives")) {
                    for (const auto& [oid, ostate] : qj.at("objectives").items()) {
                        state.updateQuestObjective(qid, oid, ostate.get<std::string>());
                    }
                    if (q) q->state = st; // restore final state in case updateQuest reset it
                }
            }
        }

        Logger::info("Game loaded from " + path);
        LoadResult result;
        result.status = LoadStatus::Loaded;
        result.path = path;
        result.state = std::move(state);
        return result;
    } catch (const json::exception& e) {
        const std::string error = "Invalid save JSON: " + std::string(e.what());
        Logger::error(error + " in " + path);
        return makeLoadFailure(LoadStatus::Invalid, path, error);
    }
}

std::optional<GameState> SaveManager::load(const std::string& slotId) {
    return loadDetailed(slotId).state;
}

bool SaveManager::hasSave(const std::string& slotId) {
    return FileSystem::exists(getSavePath(slotId));
}

std::vector<SaveManager::SlotMetadata> SaveManager::listSlots(int maxSlots) {
    std::vector<SlotMetadata> slots;
    if (maxSlots <= 0) {
        return slots;
    }

    slots.reserve(static_cast<size_t>(maxSlots));

    for (int index = 1; index <= maxSlots; ++index) {
        SlotMetadata metadata;
        metadata.index = index;

        const std::string slotId = "slot_" + std::to_string(index);
        const std::string path = getSavePath(slotId);
        auto content = FileSystem::readFile(path);
        if (!content) {
            slots.push_back(std::move(metadata));
            continue;
        }

        metadata.exists = true;
        fillMtime(metadata, path);

        try {
            const json j = json::parse(*content);
            auto validation = validateSaveEnvelope(j);
            if (validation.status != LoadStatus::Loaded) {
                metadata.corrupt = true;
                metadata.detail = validation.error;
                slots.push_back(std::move(metadata));
                continue;
            }

            metadata.loadable = true;
            metadata.mapId = j.value("currentMapId", std::string{});
            metadata.gold = j.value("gold", 0);
            if (j.contains("party") && j.at("party").is_array()) {
                metadata.party = j.at("party").get<std::vector<std::string>>();
            }
        } catch (const json::exception& e) {
            metadata.corrupt = true;
            metadata.detail = "Invalid save JSON: " + std::string(e.what());
            slots.push_back(std::move(metadata));
            continue;
        }

        slots.push_back(std::move(metadata));
    }

    return slots;
}
