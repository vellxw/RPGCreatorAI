#include "runtime/RuntimeProjectValidator.h"

#include "types/ProjectTypes.h"
#include "world/MapLoader.h"
#include "world/ProjectLoader.h"

#include <algorithm>
#include <filesystem>
#include <fstream>
#include <nlohmann/json.hpp>
#include <optional>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>

using json = nlohmann::json;

namespace {

namespace fs = std::filesystem;
using IdSet = std::unordered_set<std::string>;

struct MapRuntimeIndex {
    std::string id;
    int width = 0;
    int height = 0;
    IdSet eventIds;
    std::vector<int> collisionTiles;
};

struct DatabaseIndex {
    IdSet items;
    IdSet switches;
    IdSet variables;
    IdSet commonEvents;
    IdSet shops;
    IdSet troops;
    IdSet quests;
    IdSet actors;
    IdSet enemies;
    IdSet skills;
    IdSet classes;
    IdSet tilesets;
    IdSet animations;
    IdSet animationActions;
    std::unordered_map<std::string, IdSet> questObjectives;
    std::string configuredPlayerAnimationSet;
};

struct LoadedMap {
    MapReference ref;
    fs::path path;
    json raw;
    std::optional<MapData> data;
};

void addMessage(rpg::RuntimeValidationReport& report,
                rpg::RuntimeValidationSeverity severity,
                const std::string& source,
                const std::string& message) {
    report.messages.push_back({severity, source, message});
}

void addError(rpg::RuntimeValidationReport& report,
              const std::string& source,
              const std::string& message) {
    addMessage(report, rpg::RuntimeValidationSeverity::Error, source, message);
}

void addWarning(rpg::RuntimeValidationReport& report,
                const std::string& source,
                const std::string& message) {
    addMessage(report, rpg::RuntimeValidationSeverity::Warning, source, message);
}

bool isSafeProjectRelativePath(const std::string& value) {
    if (value.empty()) return false;
    const fs::path path(value);
    if (path.is_absolute() || path.has_root_name() || path.has_root_directory()) {
        return false;
    }

    for (const auto& part : path) {
        if (part == "..") return false;
    }
    return true;
}

fs::path resolveDeclaredPath(const fs::path& projectRoot,
                             const std::string& declaredPath) {
    const fs::path declared(declaredPath);
    const fs::path cwdCandidate = fs::absolute(declared).lexically_normal();
    std::error_code ec;
    if (fs::exists(cwdCandidate, ec)) {
        return cwdCandidate;
    }
    return fs::absolute(projectRoot / declared).lexically_normal();
}

std::optional<json> readJsonFile(const fs::path& path,
                                 rpg::RuntimeValidationReport& report,
                                 const std::string& source) {
    std::ifstream in(path);
    if (!in.is_open()) {
        addError(report, source, "File not found: " + path.string());
        return std::nullopt;
    }

    try {
        json root;
        in >> root;
        return root;
    } catch (const json::exception& e) {
        addError(report, source, "JSON parse error: " + std::string(e.what()));
        return std::nullopt;
    }
}

const json* arrayField(const json& object, const char* key) {
    if (!object.is_object()) return nullptr;
    auto it = object.find(key);
    if (it == object.end() || !it->is_array()) return nullptr;
    return &(*it);
}

std::string stringField(const json& object, const char* key) {
    if (!object.is_object()) return {};
    auto it = object.find(key);
    return it != object.end() && it->is_string() ? it->get<std::string>() : std::string{};
}

int intField(const json& object, const char* key, int fallback = 0) {
    if (!object.is_object()) return fallback;
    auto it = object.find(key);
    return it != object.end() && it->is_number_integer() ? it->get<int>() : fallback;
}

bool containsId(const IdSet& ids, const std::string& id) {
    return !id.empty() && ids.find(id) != ids.end();
}

void requireId(rpg::RuntimeValidationReport& report,
               const IdSet& ids,
               const std::string& id,
               const std::string& source,
               const std::string& label) {
    if (id.empty()) {
        addError(report, source, "Missing " + label + " reference");
        return;
    }
    if (!containsId(ids, id)) {
        addError(report, source, "Command references unknown " + label + " \"" + id + "\"");
    }
}

void collectIds(const json& root,
                const char* arrayKey,
                IdSet& destination,
                rpg::RuntimeValidationReport& report,
                const std::string& source) {
    const json* entries = arrayField(root, arrayKey);
    if (!entries) return;

    for (const auto& entry : *entries) {
        const std::string id = stringField(entry, "id");
        if (id.empty()) {
            addError(report, source, std::string(arrayKey) + " entry is missing an id");
            continue;
        }
        if (!destination.insert(id).second) {
            addError(report, source, "Duplicate id \"" + id + "\" in " + arrayKey);
        }
    }
}

bool isValidDirection(const std::string& value, bool allowCurrent = false) {
    if (allowCurrent && value == "current") return true;
    return value == "up" || value == "down" || value == "left" || value == "right";
}

bool isValidTrigger(const std::string& value) {
    return value == "interact" || value == "touch" ||
           value == "autorun" || value == "parallel";
}

bool isValidPriority(const std::string& value) {
    return value == "below" || value == "same" ||
           value == "sameAsCharacters" || value == "above";
}

bool isValidSelfSwitch(const std::string& value) {
    return value == "A" || value == "B" || value == "C" || value == "D";
}

bool isAllowedMovementRouteStep(const std::string& value) {
    return value == "moveUp" || value == "moveDown" ||
           value == "moveLeft" || value == "moveRight" ||
           value == "turnUp" || value == "turnDown" ||
           value == "turnLeft" || value == "turnRight" ||
           value == "wait";
}

void validateCommandArray(const json& commands,
                          const std::string& source,
                          const DatabaseIndex& db,
                          const std::unordered_map<std::string, MapRuntimeIndex>& maps,
                          const std::string& currentMapId,
                          const std::string& currentEventId,
                          rpg::RuntimeValidationReport& report);

void validateQuestObjective(rpg::RuntimeValidationReport& report,
                            const DatabaseIndex& db,
                            const std::string& questId,
                            const std::string& objectiveId,
                            const std::string& source) {
    if (questId.empty()) {
        addError(report, source, "Missing quest reference");
        return;
    }
    if (!containsId(db.quests, questId)) {
        addError(report, source, "Command references unknown quest \"" + questId + "\"");
        return;
    }
    if (objectiveId.empty()) return;
    auto objectivesIt = db.questObjectives.find(questId);
    if (objectivesIt == db.questObjectives.end() ||
        !containsId(objectivesIt->second, objectiveId)) {
        addError(report, source, "Command references unknown quest objective \"" +
                             objectiveId + "\" for quest \"" + questId + "\"");
    }
}

void validateTargetEventReference(const json& command,
                                  const std::string& target,
                                  const std::string& eventIdKey,
                                  const std::unordered_map<std::string, MapRuntimeIndex>& maps,
                                  const std::string& currentMapId,
                                  const std::string& currentEventId,
                                  const std::string& source,
                                  rpg::RuntimeValidationReport& report) {
    if (target == "player") return;
    if (target == "thisEvent") {
        if (currentEventId.empty()) {
            addError(report, source, "Command target thisEvent has no owning event");
        }
        return;
    }
    if (target != "event") {
        addError(report, source, "Command uses unsupported target \"" + target + "\"");
        return;
    }

    const std::string eventId = stringField(command, eventIdKey.c_str());
    if (eventId.empty()) {
        addError(report, source, "Command target event is missing eventId");
        return;
    }

    auto mapIt = maps.find(currentMapId);
    if (mapIt == maps.end() || !containsId(mapIt->second.eventIds, eventId)) {
        addError(report, source, "Command references unknown event \"" + eventId + "\"");
    }
}

void validateCommand(const json& command,
                     const std::string& source,
                     const DatabaseIndex& db,
                     const std::unordered_map<std::string, MapRuntimeIndex>& maps,
                     const std::string& currentMapId,
                     const std::string& currentEventId,
                     rpg::RuntimeValidationReport& report) {
    if (!command.is_object()) {
        addError(report, source, "Event command must be an object");
        return;
    }

    const std::string type = stringField(command, "type");
    if (type.empty()) {
        addError(report, source, "Event command is missing type");
        return;
    }

    if (type == "addItem" || type == "removeItem") {
        requireId(report, db.items, stringField(command, "itemId"), source, "item");
    } else if (type == "controlSwitch" || type == "ifSwitch") {
        requireId(report, db.switches, stringField(command, "switchId"), source, "switch");
    } else if (type == "controlSelfSwitch" || type == "ifSelfSwitch") {
        const std::string switchId = stringField(command, "switchId");
        if (!isValidSelfSwitch(switchId)) {
            addError(report, source, "Command references unsupported self switch \"" +
                                 switchId + "\"");
        }
    } else if (type == "controlVariable" || type == "ifVariable") {
        requireId(report, db.variables, stringField(command, "variableId"), source, "variable");
        const std::string sourceVariableId = stringField(command, "sourceVariableId");
        if (!sourceVariableId.empty() && !containsId(db.variables, sourceVariableId)) {
            addError(report, source, "Command references unknown variable \"" +
                                 sourceVariableId + "\"");
        }
    } else if (type == "callCommonEvent") {
        requireId(report, db.commonEvents, stringField(command, "commonEventId"), source,
                  "common event");
    } else if (type == "openShop") {
        requireId(report, db.shops, stringField(command, "shopId"), source, "shop");
    } else if (type == "startBattle") {
        requireId(report, db.troops, stringField(command, "troopId"), source, "troop");
    } else if (type == "startQuest" || type == "completeQuest") {
        requireId(report, db.quests, stringField(command, "questId"), source, "quest");
    } else if (type == "updateQuestObjective") {
        validateQuestObjective(report, db, stringField(command, "questId"),
                               stringField(command, "objectiveId"), source);
    } else if (type == "changeActorHp") {
        requireId(report, db.actors, stringField(command, "actorId"), source, "actor");
    } else if (type == "transferMap" || type == "setPlayerPosition") {
        const std::string mapId = stringField(command, "mapId");
        if (mapId.empty()) {
            addError(report, source, "Command references missing map id");
        } else {
            auto mapIt = maps.find(mapId);
            if (mapIt == maps.end()) {
                addError(report, source, "Command references unknown map \"" + mapId + "\"");
            } else {
                const int x = intField(command, "x");
                const int y = intField(command, "y");
                if (x < 0 || y < 0 ||
                    x >= mapIt->second.width || y >= mapIt->second.height) {
                    addError(report, source, "Command transfer target is outside map \"" +
                                         mapId + "\" bounds");
                }
            }
        }

        const std::string direction = stringField(command, "direction");
        if (!isValidDirection(direction)) {
            addError(report, source, "Command uses unsupported direction \"" +
                                 direction + "\"");
        }
    } else if (type == "playAnimation") {
        const std::string target = command.value("target", std::string{"player"});
        validateTargetEventReference(command, target, "eventId", maps, currentMapId,
                                     currentEventId, source, report);

        const std::string action = command.value("action", std::string{"idle"});
        if (!action.empty() && !containsId(db.animationActions, action)) {
            addError(report, source, "Command references unknown animation action \"" +
                                 action + "\"");
        }

        const std::string direction = command.value("direction", std::string{"current"});
        if (!isValidDirection(direction, true)) {
            addError(report, source, "Command uses unsupported direction \"" +
                                 direction + "\"");
        }
    } else if (type == "setMovementRoute") {
        const std::string target = command.value("target", std::string{"player"});
        validateTargetEventReference(command, target, "eventId", maps, currentMapId,
                                     currentEventId, source, report);

        const json* steps = arrayField(command, "steps");
        if (steps) {
            int index = 0;
            for (const auto& step : *steps) {
                const std::string stepType = stringField(step, "type");
                if (!isAllowedMovementRouteStep(stepType)) {
                    addWarning(report, source + "/steps/" + std::to_string(index),
                               "Command uses unsupported movement route step \"" +
                                   stepType + "\"");
                }
                ++index;
            }
        }
    }

    if (type == "showChoices") {
        const json* choices = arrayField(command, "choices");
        if (choices) {
            int index = 0;
            for (const auto& choice : *choices) {
                const json* nested = arrayField(choice, "commands");
                if (nested) {
                    validateCommandArray(*nested,
                                         source + "/choices/" + std::to_string(index),
                                         db, maps, currentMapId, currentEventId, report);
                }
                ++index;
            }
        }
    }

    const std::vector<std::string> branchKeys = {
        "then", "else", "victoryBranch", "defeatBranch"
    };
    for (const std::string& key : branchKeys) {
        const json* branch = arrayField(command, key.c_str());
        if (branch) {
            validateCommandArray(*branch, source + "/" + key, db, maps,
                                 currentMapId, currentEventId, report);
        }
    }
}

void validateCommandArray(const json& commands,
                          const std::string& source,
                          const DatabaseIndex& db,
                          const std::unordered_map<std::string, MapRuntimeIndex>& maps,
                          const std::string& currentMapId,
                          const std::string& currentEventId,
                          rpg::RuntimeValidationReport& report) {
    if (!commands.is_array()) {
        addError(report, source, "Event commands must be an array");
        return;
    }

    int index = 0;
    for (const auto& command : commands) {
        validateCommand(command, source + "/" + std::to_string(index),
                        db, maps, currentMapId, currentEventId, report);
        ++index;
    }
}

void collectDatabaseIds(const std::unordered_map<std::string, json>& databases,
                        DatabaseIndex& db,
                        rpg::RuntimeValidationReport& report) {
    auto collect = [&](const char* databaseKey, const char* arrayKey, IdSet& out) {
        auto it = databases.find(databaseKey);
        if (it != databases.end()) {
            collectIds(it->second, arrayKey, out, report,
                       std::string("database/") + databaseKey);
        }
    };

    collect("items", "items", db.items);
    collect("switches", "switches", db.switches);
    collect("variables", "variables", db.variables);
    collect("commonEvents", "commonEvents", db.commonEvents);
    collect("shops", "shops", db.shops);
    collect("troops", "troops", db.troops);
    collect("quests", "quests", db.quests);
    collect("actors", "actors", db.actors);
    collect("enemies", "enemies", db.enemies);
    collect("skills", "skills", db.skills);
    collect("classes", "classes", db.classes);
    collect("tilesets", "tilesets", db.tilesets);

    auto animationsIt = databases.find("animations");
    if (animationsIt != databases.end()) {
        const json* sets = arrayField(animationsIt->second, "sets");
        if (sets) {
            for (const auto& set : *sets) {
                const std::string setId = stringField(set, "id");
                if (setId.empty()) {
                    addError(report, "database/animations",
                             "animation set entry is missing an id");
                    continue;
                }
                if (!db.animations.insert(setId).second) {
                    addError(report, "database/animations",
                             "Duplicate id \"" + setId + "\" in animation sets");
                }

                const json* clips = arrayField(set, "clips");
                if (!clips) continue;
                for (const auto& clip : *clips) {
                    const std::string action = stringField(clip, "action");
                    if (!action.empty()) {
                        db.animationActions.insert(action);
                    }
                }
            }
        }
    }

    auto questsIt = databases.find("quests");
    if (questsIt != databases.end()) {
        const json* quests = arrayField(questsIt->second, "quests");
        if (quests) {
            for (const auto& quest : *quests) {
                const std::string questId = stringField(quest, "id");
                if (questId.empty()) continue;
                IdSet objectives;
                const json* objectiveArray = arrayField(quest, "objectives");
                if (objectiveArray) {
                    for (const auto& objective : *objectiveArray) {
                        const std::string objectiveId = stringField(objective, "id");
                        if (!objectiveId.empty()) objectives.insert(objectiveId);
                    }
                }
                db.questObjectives[questId] = std::move(objectives);
            }
        }
    }

    auto systemIt = databases.find("system");
    if (systemIt != databases.end()) {
        db.configuredPlayerAnimationSet =
            stringField(systemIt->second, "playerAnimationSet");
    }
}

void validateDatabaseReferences(const std::unordered_map<std::string, json>& databases,
                                const DatabaseIndex& db,
                                rpg::RuntimeValidationReport& report) {
    auto systemIt = databases.find("system");
    if (systemIt != databases.end()) {
        const json* startingParty = arrayField(systemIt->second, "startingParty");
        if (startingParty) {
            for (const auto& actor : *startingParty) {
                if (actor.is_string() && !containsId(db.actors, actor.get<std::string>())) {
                    addError(report, "database/system",
                             "System starting party references unknown actor \"" +
                                 actor.get<std::string>() + "\"");
                }
            }
        }
        if (!db.configuredPlayerAnimationSet.empty() &&
            !containsId(db.animations, db.configuredPlayerAnimationSet)) {
            addError(report, "database/system",
                     "System references unknown animation set \"" +
                         db.configuredPlayerAnimationSet + "\"");
        }
    }

    auto shopsIt = databases.find("shops");
    if (shopsIt != databases.end()) {
        const json* shops = arrayField(shopsIt->second, "shops");
        if (shops) {
            for (const auto& shop : *shops) {
                const std::string shopId = stringField(shop, "id");
                const json* listings = arrayField(shop, "listings");
                if (!listings) continue;
                for (const auto& listing : *listings) {
                    const std::string itemId = stringField(listing, "itemId");
                    if (!itemId.empty() && !containsId(db.items, itemId)) {
                        addError(report, "database/shops/" + shopId,
                                 "Shop listing references unknown item \"" + itemId + "\"");
                    }
                }
            }
        }
    }

    auto troopsIt = databases.find("troops");
    if (troopsIt != databases.end()) {
        const json* troops = arrayField(troopsIt->second, "troops");
        if (troops) {
            for (const auto& troop : *troops) {
                const std::string troopId = stringField(troop, "id");
                const json* members = arrayField(troop, "members");
                if (!members) continue;
                for (const auto& member : *members) {
                    const std::string enemyId =
                        member.is_string() ? member.get<std::string>() : stringField(member, "enemyId");
                    if (!enemyId.empty() && !containsId(db.enemies, enemyId)) {
                        addError(report, "database/troops/" + troopId,
                                 "Troop member references unknown enemy \"" + enemyId + "\"");
                    }
                }
            }
        }
    }

    auto questsIt = databases.find("quests");
    if (questsIt != databases.end()) {
        const json* quests = arrayField(questsIt->second, "quests");
        if (quests) {
            for (const auto& quest : *quests) {
                const std::string questId = stringField(quest, "id");
                auto rewardsIt = quest.find("rewards");
                if (rewardsIt == quest.end() || !rewardsIt->is_object()) continue;
                const json* items = arrayField(*rewardsIt, "items");
                if (!items) continue;
                for (const auto& item : *items) {
                    const std::string itemId = stringField(item, "itemId");
                    if (!itemId.empty() && !containsId(db.items, itemId)) {
                        addError(report, "database/quests/" + questId,
                                 "Quest reward references unknown item \"" + itemId + "\"");
                    }
                }
            }
        }
    }

    auto commonEventsIt = databases.find("commonEvents");
    if (commonEventsIt != databases.end()) {
        const json* commonEvents = arrayField(commonEventsIt->second, "commonEvents");
        if (commonEvents) {
            for (const auto& commonEvent : *commonEvents) {
                const std::string id = stringField(commonEvent, "id");
                const std::string switchId = stringField(commonEvent, "switchId");
                if (!switchId.empty() && !containsId(db.switches, switchId)) {
                    addError(report, "database/commonEvents/" + id,
                             "Common event references unknown switch \"" + switchId + "\"");
                }
            }
        }
    }
}

void validateCommonEventCommands(const std::unordered_map<std::string, json>& databases,
                                 const DatabaseIndex& db,
                                 const std::unordered_map<std::string, MapRuntimeIndex>& maps,
                                 rpg::RuntimeValidationReport& report) {
    auto commonEventsIt = databases.find("commonEvents");
    if (commonEventsIt == databases.end()) return;

    const json* commonEvents = arrayField(commonEventsIt->second, "commonEvents");
    if (!commonEvents) return;

    for (const auto& commonEvent : *commonEvents) {
        const std::string id = stringField(commonEvent, "id");
        const json* commands = arrayField(commonEvent, "commands");
        if (commands) {
            validateCommandArray(*commands,
                                 "database/commonEvents/" + id + "/commands",
                                 db, maps, std::string{}, std::string{}, report);
        }
    }
}

std::unordered_map<std::string, json> loadDatabaseShards(const json& projectJson,
                                                        const fs::path& projectRoot,
                                                        rpg::RuntimeValidationReport& report) {
    std::unordered_map<std::string, json> databases;
    auto dbIt = projectJson.find("database");
    if (dbIt == projectJson.end() || !dbIt->is_object()) {
        return databases;
    }

    for (const auto& [key, value] : dbIt->items()) {
        if (!value.is_string()) {
            addError(report, "project/database/" + key,
                     "Database path must be a string");
            continue;
        }
        const std::string declaredPath = value.get<std::string>();
        if (declaredPath.empty()) continue;
        if (!isSafeProjectRelativePath(declaredPath)) {
            addError(report, "project/database/" + key,
                     "Unsafe project-relative path: " + declaredPath);
            continue;
        }

        const fs::path resolvedPath = resolveDeclaredPath(projectRoot, declaredPath);
        std::error_code ec;
        if (!fs::exists(resolvedPath, ec)) {
            addError(report, "project/database/" + key,
                     "Database file not found: " + declaredPath);
            continue;
        }
        if (auto parsed = readJsonFile(resolvedPath, report, "database/" + key)) {
            databases[key] = *parsed;
        }
    }
    return databases;
}

bool hasRequiredLayer(const MapData& map, const std::string& roleOrName) {
    return std::any_of(map.layers.begin(), map.layers.end(), [&](const MapLayer& layer) {
        return layer.role == roleOrName || layer.name == roleOrName;
    });
}

const MapLayer* findLayer(const MapData& map, const std::string& roleOrName) {
    auto it = std::find_if(map.layers.begin(), map.layers.end(), [&](const MapLayer& layer) {
        return layer.role == roleOrName || layer.name == roleOrName;
    });
    return it == map.layers.end() ? nullptr : &(*it);
}

void validatePageConditions(const json& conditions,
                            const std::string& source,
                            const DatabaseIndex& db,
                            rpg::RuntimeValidationReport& report) {
    auto validateCondition = [&](const json& condition, const std::string& conditionSource) {
        const std::string type = stringField(condition, "type");
        const std::string id = stringField(condition, "id");
        if (type == "switch") {
            requireId(report, db.switches, id, conditionSource, "switch");
        } else if (type == "variable") {
            requireId(report, db.variables, id, conditionSource, "variable");
        } else if (type == "selfSwitch") {
            if (!isValidSelfSwitch(id)) {
                addError(report, conditionSource,
                         "Page condition references unsupported self switch \"" + id + "\"");
            }
        }
    };

    if (conditions.is_array()) {
        int index = 0;
        for (const auto& condition : conditions) {
            validateCondition(condition, source + "/" + std::to_string(index));
            ++index;
        }
        return;
    }

    if (!conditions.is_object()) return;

    auto switchesIt = conditions.find("switches");
    if (switchesIt != conditions.end() && switchesIt->is_object()) {
        for (const auto& [switchId, _] : switchesIt->items()) {
            requireId(report, db.switches, switchId, source + "/switches", "switch");
        }
    }

    auto variablesIt = conditions.find("variables");
    if (variablesIt != conditions.end() && variablesIt->is_array()) {
        int index = 0;
        for (const auto& variable : *variablesIt) {
            requireId(report, db.variables, stringField(variable, "variableId"),
                      source + "/variables/" + std::to_string(index), "variable");
            ++index;
        }
    }

    auto selfSwitchesIt = conditions.find("selfSwitches");
    if (selfSwitchesIt != conditions.end() && selfSwitchesIt->is_object()) {
        for (const auto& [selfSwitchId, _] : selfSwitchesIt->items()) {
            if (!isValidSelfSwitch(selfSwitchId)) {
                addError(report, source + "/selfSwitches",
                         "Page condition references unsupported self switch \"" +
                             selfSwitchId + "\"");
            }
        }
    }
}

void validateMapJson(const LoadedMap& loaded,
                     const ProjectData& project,
                     const DatabaseIndex& db,
                     const std::unordered_map<std::string, MapRuntimeIndex>& maps,
                     rpg::RuntimeValidationReport& report) {
    if (!loaded.data) return;

    const MapData& map = *loaded.data;
    const std::string mapSource = "maps/" + loaded.ref.id;

    if (map.id != loaded.ref.id) {
        addError(report, mapSource, "Map file id \"" + map.id +
                                  "\" does not match project map id \"" +
                                  loaded.ref.id + "\"");
    }
    if (map.width <= 0 || map.height <= 0) {
        addError(report, mapSource, "Map dimensions must be positive");
    }
    if (map.tileSize <= 0) {
        addError(report, mapSource, "Map tileSize must be positive");
    }
    if (!hasRequiredLayer(map, "ground")) {
        addError(report, mapSource, "Map is missing required ground layer");
    }
    if (!hasRequiredLayer(map, "collision")) {
        addError(report, mapSource, "Map is missing required collision layer");
    }
    if (!map.tilesetId.empty() && !containsId(db.tilesets, map.tilesetId)) {
        addError(report, mapSource, "Map \"" + map.id +
                                  "\" references unknown tileset \"" +
                                  map.tilesetId + "\"");
    }

    if (map.id == project.startMapId) {
        const int x = project.startPosition.pos.x;
        const int y = project.startPosition.pos.y;
        if (x < 0 || y < 0 || x >= map.width || y >= map.height) {
            addError(report, mapSource, "Start position is outside start map bounds");
        } else if (const MapLayer* collision = findLayer(map, "collision")) {
            const int index = y * map.width + x;
            if (index >= 0 && index < static_cast<int>(collision->tiles.size()) &&
                collision->tiles[index] == 9) {
                addError(report, mapSource,
                         "Start position is blocked by the collision layer");
            }
        }
    }

    IdSet seenEvents;
    const json* events = arrayField(loaded.raw, "events");
    if (!events) return;

    int eventIndex = 0;
    for (const auto& event : *events) {
        const std::string eventId = stringField(event, "id");
        const std::string eventSource = mapSource + "/events/" + eventId;
        if (eventId.empty()) {
            addError(report, mapSource + "/events/" + std::to_string(eventIndex),
                     "Event is missing id");
        } else if (!seenEvents.insert(eventId).second) {
            addError(report, eventSource, "Duplicate event id \"" + eventId + "\"");
        }

        const int x = intField(event, "x");
        const int y = intField(event, "y");
        if (x < 0 || y < 0 || x >= map.width || y >= map.height) {
            addError(report, eventSource, "Event \"" + eventId +
                                      "\" is outside map bounds");
        }

        const std::string trigger = event.value("trigger", std::string{"interact"});
        if (!isValidTrigger(trigger)) {
            addError(report, eventSource, "Event \"" + eventId +
                                      "\" uses unsupported trigger \"" +
                                      trigger + "\"");
        }

        const std::string eventAnimationSet = stringField(event, "animationSet");
        if (!eventAnimationSet.empty() && !containsId(db.animations, eventAnimationSet)) {
            addError(report, eventSource, "Event \"" + eventId +
                                      "\" references unknown animation set \"" +
                                      eventAnimationSet + "\"");
        }

        const json* commands = arrayField(event, "commands");
        if (commands) {
            validateCommandArray(*commands, eventSource + "/commands",
                                 db, maps, loaded.ref.id, eventId, report);
        }

        const json* pages = arrayField(event, "pages");
        if (pages) {
            int pageIndex = 0;
            for (const auto& page : *pages) {
                const std::string pageSource =
                    eventSource + "/pages/" + std::to_string(pageIndex);

                std::string pageTrigger = page.value("trigger", std::string{});
                auto optionsIt = page.find("options");
                if (pageTrigger.empty() && optionsIt != page.end() && optionsIt->is_object()) {
                    pageTrigger = optionsIt->value("trigger", std::string{"interact"});
                }
                if (pageTrigger.empty()) pageTrigger = "interact";
                if (!isValidTrigger(pageTrigger)) {
                    addError(report, pageSource,
                             "Page uses unsupported trigger \"" + pageTrigger + "\"");
                }

                std::string pagePriority = page.value("priority", std::string{});
                if (pagePriority.empty() && optionsIt != page.end() && optionsIt->is_object()) {
                    pagePriority = optionsIt->value("priority", std::string{"same"});
                }
                if (pagePriority.empty()) pagePriority = "same";
                if (!isValidPriority(pagePriority)) {
                    addError(report, pageSource,
                             "Page uses unsupported priority \"" + pagePriority + "\"");
                }

                auto graphicIt = page.find("graphic");
                if (graphicIt != page.end() && graphicIt->is_object()) {
                    const std::string pageAnimationSet =
                        stringField(*graphicIt, "animationSet");
                    if (!pageAnimationSet.empty() &&
                        !containsId(db.animations, pageAnimationSet)) {
                        addError(report, pageSource,
                                 "Page references unknown animation set \"" +
                                     pageAnimationSet + "\"");
                    }
                }

                auto conditionsIt = page.find("conditions");
                if (conditionsIt != page.end()) {
                    validatePageConditions(*conditionsIt, pageSource + "/conditions",
                                           db, report);
                }

                const json* pageCommands = arrayField(page, "commands");
                if (pageCommands) {
                    validateCommandArray(*pageCommands, pageSource + "/commands",
                                         db, maps, loaded.ref.id, eventId, report);
                }

                ++pageIndex;
            }
        }

        ++eventIndex;
    }
}

} // namespace

namespace rpg {

bool RuntimeValidationReport::hasErrors() const {
    return std::any_of(messages.begin(), messages.end(), [](const auto& message) {
        return message.severity == RuntimeValidationSeverity::Error;
    });
}

int RuntimeValidationReport::errorCount() const {
    return static_cast<int>(std::count_if(messages.begin(), messages.end(),
                                          [](const auto& message) {
        return message.severity == RuntimeValidationSeverity::Error;
    }));
}

int RuntimeValidationReport::warningCount() const {
    return static_cast<int>(std::count_if(messages.begin(), messages.end(),
                                          [](const auto& message) {
        return message.severity == RuntimeValidationSeverity::Warning;
    }));
}

RuntimeValidationReport RuntimeProjectValidator::validateProjectFile(
    const std::filesystem::path& projectPath) const {
    RuntimeValidationReport report;
    const fs::path absoluteProjectPath = fs::absolute(projectPath).lexically_normal();
    const fs::path projectRoot = absoluteProjectPath.parent_path();

    auto projectJson = readJsonFile(absoluteProjectPath, report, "project");
    if (!projectJson) return report;

    auto project = ProjectLoader::load(absoluteProjectPath.string());
    if (!project) {
        addError(report, "project", "Project file could not be loaded by ProjectLoader");
        return report;
    }

    std::unordered_map<std::string, json> databaseJsons =
        loadDatabaseShards(*projectJson, projectRoot, report);
    DatabaseIndex db;
    collectDatabaseIds(databaseJsons, db, report);
    validateDatabaseReferences(databaseJsons, db, report);

    std::unordered_map<std::string, MapRuntimeIndex> maps;
    std::vector<LoadedMap> loadedMaps;
    IdSet projectMapIds;
    for (const auto& mapRef : project->maps) {
        if (mapRef.id.empty()) {
            addError(report, "project/maps", "Project map entry is missing id");
            continue;
        }
        if (!projectMapIds.insert(mapRef.id).second) {
            addError(report, "project/maps", "Duplicate map id \"" + mapRef.id + "\"");
        }

        if (!isSafeProjectRelativePath(mapRef.path)) {
            addError(report, "project/maps/" + mapRef.id,
                     "Unsafe project-relative path: " + mapRef.path);
            continue;
        }

        const fs::path resolvedPath = resolveDeclaredPath(projectRoot, mapRef.path);
        std::error_code ec;
        if (!fs::exists(resolvedPath, ec)) {
            addError(report, "project/maps/" + mapRef.id,
                     "Map file not found for map \"" + mapRef.id + "\": " + mapRef.path);
            continue;
        }

        LoadedMap loaded;
        loaded.ref = mapRef;
        loaded.path = resolvedPath;
        if (auto parsed = readJsonFile(resolvedPath, report, "maps/" + mapRef.id)) {
            loaded.raw = *parsed;
        } else {
            continue;
        }

        loaded.data = MapLoader::load(resolvedPath.string());
        if (!loaded.data) {
            addError(report, "maps/" + mapRef.id,
                     "Map file failed runtime parsing: " + mapRef.path);
            loadedMaps.push_back(std::move(loaded));
            continue;
        }

        MapRuntimeIndex index;
        index.id = loaded.data->id;
        index.width = loaded.data->width;
        index.height = loaded.data->height;
        if (const MapLayer* collision = findLayer(*loaded.data, "collision")) {
            index.collisionTiles = collision->tiles;
        }
        for (const auto& event : loaded.data->events) {
            if (!event.id.empty()) index.eventIds.insert(event.id);
        }
        maps[mapRef.id] = std::move(index);
        loadedMaps.push_back(std::move(loaded));
    }

    if (maps.find(project->startMapId) == maps.end()) {
        addError(report, "project/startMapId",
                 "Start map \"" + project->startMapId +
                     "\" could not be loaded for runtime startup");
    }

    validateCommonEventCommands(databaseJsons, db, maps, report);

    for (const auto& loaded : loadedMaps) {
        validateMapJson(loaded, *project, db, maps, report);
    }

    return report;
}

} // namespace rpg
