#include "save/SaveManager.h"
#include "platform/FileSystem.h"
#include "core/Logger.h"
#include <nlohmann/json.hpp>
#include <chrono>
#include <filesystem>

using json = nlohmann::json;

std::string SaveManager::getSavePath(const std::string& slotId) {
    return "saves/" + slotId + ".json";
}

bool SaveManager::save(const std::string& slotId, const GameState& state) {
    json j;
    j["schemaVersion"] = 2;
    j["currentMapId"] = state.getCurrentMapId();
    j["player"]["x"] = state.getPlayerX();
    j["player"]["y"] = state.getPlayerY();
    j["player"]["direction"] = directionToString(state.getPlayerDirection());

    j["flags"] = state.getFlags();
    j["switches"] = state.getSwitches();
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
        return state;
    } catch (const json::exception& e) {
        Logger::error(std::string("Error parsing save file: ") + e.what());
        return std::nullopt;
    }
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

        try {
            const json j = json::parse(*content);
            metadata.exists = true;
            metadata.mapId = j.value("currentMapId", std::string{});
            metadata.gold = j.value("gold", 0);
            if (j.contains("party") && j.at("party").is_array()) {
                metadata.party = j.at("party").get<std::vector<std::string>>();
            }
        } catch (const json::exception&) {
            slots.push_back(std::move(metadata));
            continue;
        }

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

        slots.push_back(std::move(metadata));
    }

    return slots;
}
