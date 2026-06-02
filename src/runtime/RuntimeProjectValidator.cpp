#include "runtime/RuntimeProjectValidator.h"

#include "types/ProjectTypes.h"
#include "world/MapLoader.h"
#include "world/ProjectLoader.h"

#include <algorithm>
#include <cctype>
#include <cmath>
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
    IdSet audioIds;
    std::unordered_map<std::string, std::string> audioPaths;
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

bool finiteNumber(const json& value, double& out) {
    if (!value.is_number()) return false;
    out = value.get<double>();
    return std::isfinite(out);
}

void validateNonNegativeNumber(rpg::RuntimeValidationReport& report,
                               const json& object,
                               const char* key,
                               const std::string& source,
                               const std::string& label) {
    if (!object.is_object()) return;
    auto it = object.find(key);
    if (it == object.end()) return;
    double value = 0.0;
    if (!finiteNumber(*it, value) || value < 0.0) {
        addError(report, source, label + " must be a non-negative finite number");
    }
}

void validateFiniteNumber(rpg::RuntimeValidationReport& report,
                          const json& object,
                          const char* key,
                          const std::string& source,
                          const std::string& label) {
    if (!object.is_object()) return;
    auto it = object.find(key);
    if (it == object.end()) return;
    double value = 0.0;
    if (!finiteNumber(*it, value)) {
        addError(report, source, label + " must be finite");
    }
}

const std::vector<const char*>& statFieldNames() {
    static const std::vector<const char*> fields = {
        "maxHp",
        "maxMp",
        "attack",
        "defense",
        "magicAttack",
        "magicDefense",
        "agility",
        "luck",
    };
    return fields;
}

void validateEnemyStats(rpg::RuntimeValidationReport& report,
                        const json& enemy,
                        const std::string& enemyId,
                        const std::string& source) {
    auto statsIt = enemy.find("stats");
    if (statsIt == enemy.end() || !statsIt->is_object()) return;

    for (const char* field : statFieldNames()) {
        validateNonNegativeNumber(
            report,
            *statsIt,
            field,
            source,
            "Enemy \"" + enemyId + "\" stats." + field);
    }
}

bool isSupportedRuntimeEquipmentSlot(const std::string& value) {
    return value == "weapon" || value == "armor" || value == "accessory";
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

bool isSafeAudioId(const std::string& value) {
    if (value.empty()) return false;
    const auto isAlpha = [](unsigned char ch) { return std::isalpha(ch) != 0; };
    const auto isAllowed = [](unsigned char ch) {
        return std::isalnum(ch) != 0 || ch == '_' || ch == '-';
    };
    if (!isAlpha(static_cast<unsigned char>(value.front()))) return false;
    if (value.size() > 64) return false;
    return std::all_of(value.begin(), value.end(), [&](char ch) {
        return isAllowed(static_cast<unsigned char>(ch));
    });
}

bool isSafePluginIdentifier(const std::string& value, std::size_t maxLength, bool allowDot) {
    if (value.empty() || value.size() > maxLength) return false;
    const auto isAlpha = [](unsigned char ch) { return std::isalpha(ch) != 0; };
    const auto isAllowed = [&](unsigned char ch) {
        return std::isalnum(ch) != 0 || ch == '_' || ch == '-' ||
               (allowDot && ch == '.');
    };
    if (!isAlpha(static_cast<unsigned char>(value.front()))) return false;
    return std::all_of(value.begin(), value.end(), [&](char ch) {
        return isAllowed(static_cast<unsigned char>(ch));
    });
}

bool containsCodeLikePluginText(const std::string& value) {
    std::string lower = value;
    std::transform(lower.begin(), lower.end(), lower.begin(),
                   [](unsigned char ch) { return static_cast<char>(std::tolower(ch)); });
    return value.find("=>") != std::string::npos ||
           lower.find("function") != std::string::npos ||
           lower.find("eval(") != std::string::npos ||
           lower.find("import(") != std::string::npos ||
           lower.find("require(") != std::string::npos ||
           lower.find("new function") != std::string::npos ||
           lower.find("<script") != std::string::npos;
}

enum class PluginArgKind {
    String,
    Number,
    Boolean,
    Null,
};

enum class PluginArgReference {
    None,
    Switch,
    Variable,
};

struct PluginCommandArgMetadata {
    const char* key;
    PluginArgKind kind;
    bool required;
    PluginArgReference reference;
};

struct PluginCommandMetadata {
    const char* pluginId;
    const char* command;
    std::vector<PluginCommandArgMetadata> args;
};

const std::vector<PluginCommandMetadata>& pluginCommandMetadataRegistry() {
    static const std::vector<PluginCommandMetadata> registry = {
        {
            "debug",
            "log",
            {
                {"message", PluginArgKind::String, false, PluginArgReference::None},
            },
        },
        {
            "debug",
            "setSwitch",
            {
                {"switchId", PluginArgKind::String, true, PluginArgReference::Switch},
                {"value", PluginArgKind::Boolean, true, PluginArgReference::None},
            },
        },
        {
            "debug",
            "setVariable",
            {
                {"variableId", PluginArgKind::String, true, PluginArgReference::Variable},
                {"value", PluginArgKind::Number, true, PluginArgReference::None},
            },
        },
    };
    return registry;
}

const PluginCommandMetadata* findPluginCommandMetadata(const std::string& pluginId,
                                                       const std::string& command) {
    const auto& registry = pluginCommandMetadataRegistry();
    const auto it = std::find_if(registry.begin(), registry.end(), [&](const auto& entry) {
        return pluginId == entry.pluginId && command == entry.command;
    });
    return it == registry.end() ? nullptr : &(*it);
}

const char* pluginArgKindName(PluginArgKind kind) {
    switch (kind) {
    case PluginArgKind::String: return "string";
    case PluginArgKind::Number: return "number";
    case PluginArgKind::Boolean: return "boolean";
    case PluginArgKind::Null: return "null";
    }
    return "scalar";
}

bool isPluginScalarArg(const json& value) {
    return value.is_null() || value.is_string() || value.is_boolean() ||
           value.is_number();
}

bool matchesPluginArgKind(const json& value, PluginArgKind kind) {
    switch (kind) {
    case PluginArgKind::String: return value.is_string();
    case PluginArgKind::Number: return value.is_number();
    case PluginArgKind::Boolean: return value.is_boolean();
    case PluginArgKind::Null: return value.is_null();
    }
    return false;
}

bool isMissingRequiredPluginArg(const json& args, const PluginCommandArgMetadata& arg) {
    auto it = args.find(arg.key);
    if (it == args.end() || it->is_null()) return true;
    return arg.kind == PluginArgKind::String && it->is_string() &&
           it->get<std::string>().empty();
}

void validatePluginCommandJson(const json& command,
                               const std::string& source,
                               const DatabaseIndex& db,
                               rpg::RuntimeValidationReport& report) {
    const std::string pluginId = stringField(command, "pluginId");
    const std::string pluginCommand = stringField(command, "command");
    const std::string fullCommand = pluginId + "." + pluginCommand;

    if (!isSafePluginIdentifier(pluginId, 64, false)) {
        addError(report, source,
                 "pluginCommand pluginId \"" + pluginId +
                     "\" is not a safe identifier");
    }
    if (!isSafePluginIdentifier(pluginCommand, 128, true)) {
        addError(report, source,
                 "pluginCommand command \"" + pluginCommand +
                     "\" is not a safe identifier");
    }

    auto argsIt = command.find("args");
    if (argsIt == command.end() || !argsIt->is_object() || argsIt->is_array()) {
        addError(report, source, "pluginCommand args must be an object of scalar values");
        return;
    }

    for (const auto& [key, value] : argsIt->items()) {
        if (!isSafePluginIdentifier(key, 64, false)) {
            addError(report, source,
                     "pluginCommand arg \"" + key + "\" is not a safe identifier");
        }
        if (!isPluginScalarArg(value)) {
            addError(report, source,
                     "pluginCommand arg \"" + key + "\" must be a scalar");
            continue;
        }
        if (value.is_string() && containsCodeLikePluginText(value.get<std::string>())) {
            addError(report, source,
                     "pluginCommand arg \"" + key + "\" contains code-like text");
        }
    }

    const auto* metadata = findPluginCommandMetadata(pluginId, pluginCommand);
    if (!metadata) return;

    for (const auto& arg : metadata->args) {
        auto argIt = argsIt->find(arg.key);
        if (arg.required && isMissingRequiredPluginArg(*argsIt, arg)) {
            addError(report, source,
                     "pluginCommand " + fullCommand + " missing required arg \"" +
                         arg.key + "\"");
            continue;
        }
        if (argIt == argsIt->end() || argIt->is_null()) continue;
        if (!matchesPluginArgKind(*argIt, arg.kind)) {
            addError(report, source,
                     "pluginCommand " + fullCommand + " arg \"" + arg.key +
                         "\" must be " + pluginArgKindName(arg.kind));
            continue;
        }
        if (arg.reference == PluginArgReference::Switch && argIt->is_string()) {
            const std::string switchId = argIt->get<std::string>();
            if (!containsId(db.switches, switchId)) {
                addError(report, source,
                         "pluginCommand " + fullCommand + " arg \"" + arg.key +
                             "\" references unknown switch \"" + switchId + "\"");
            }
        }
        if (arg.reference == PluginArgReference::Variable && argIt->is_string()) {
            const std::string variableId = argIt->get<std::string>();
            if (!containsId(db.variables, variableId)) {
                addError(report, source,
                         "pluginCommand " + fullCommand + " arg \"" + arg.key +
                             "\" references unknown variable \"" + variableId + "\"");
            }
        }
    }
}

bool hasWavExtension(const std::string& value) {
    std::string extension = fs::path(value).extension().string();
    std::transform(extension.begin(), extension.end(), extension.begin(),
                   [](unsigned char ch) { return static_cast<char>(std::tolower(ch)); });
    return extension == ".wav";
}

void seedDefaultAudioRegistry(DatabaseIndex& db) {
    const std::vector<std::pair<std::string, std::string>> defaults = {
        {"confirm", "assets/audio/confirm.wav"},
        {"cancel", "assets/audio/cancel.wav"},
        {"chest", "assets/audio/chest.wav"},
        {"chest_open", "assets/audio/chest.wav"},
        {"battle", "assets/audio/battle.wav"},
        {"town_bgm", "assets/audio/town_bgm.wav"},
        {"town_theme", "assets/audio/town_bgm.wav"},
    };
    for (const auto& [id, path] : defaults) {
        db.audioIds.insert(id);
        db.audioPaths.try_emplace(id, path);
    }
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
    } else if (type == "playSound") {
        requireId(report, db.audioIds, stringField(command, "soundId"), source, "audio id");
    } else if (type == "pluginCommand") {
        validatePluginCommandJson(command, source, db, report);
    } else if (type == "callCommonEvent") {
        requireId(report, db.commonEvents, stringField(command, "commonEventId"), source,
                  "common event");
    } else if (type == "openShop") {
        requireId(report, db.shops, stringField(command, "shopId"), source, "shop");
    } else if (type == "startBattle") {
        requireId(report, db.troops, stringField(command, "troopId"), source, "troop");
        if (command.value("canEscape", false)) {
            addError(report, source,
                     "Command startBattle canEscape is not supported by deterministic runtime battles");
        }
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

void collectAudioRegistryFromJson(const json& root,
                                  const std::string& source,
                                  const fs::path& projectRoot,
                                  DatabaseIndex& db,
                                  rpg::RuntimeValidationReport& report) {
    auto registerAudio = [&](const std::string& id,
                             const std::string& path,
                             const std::string& entrySource) {
        if (id.empty() && path.empty()) return;
        if (!isSafeAudioId(id)) {
            addError(report, entrySource, "Audio asset \"" + id + "\" has invalid id");
        }
        if (path.empty()) {
            addError(report, entrySource, "Audio asset \"" + id + "\" path is required");
            return;
        }

        db.audioIds.insert(id);
        db.audioPaths[id] = path;

        if (!isSafeProjectRelativePath(path)) {
            addError(report, entrySource,
                     "Audio asset \"" + id + "\" uses unsafe project-relative path \"" +
                         path + "\"");
            return;
        }
        if (!hasWavExtension(path)) {
            addError(report, entrySource,
                     "Audio asset \"" + id + "\" must use a .wav file");
        }

        const fs::path resolvedPath = resolveDeclaredPath(projectRoot, path);
        std::error_code ec;
        if (!fs::exists(resolvedPath, ec)) {
            addWarning(report, entrySource,
                       "Audio asset \"" + id + "\" file not found: " + path);
        }
    };

    auto audioIt = root.find("audio");
    if (audioIt != root.end() && audioIt->is_object()) {
        for (const auto& [id, value] : audioIt->items()) {
            if (!value.is_string()) {
                addError(report, source + "/audio/" + id,
                         "Audio asset \"" + id + "\" path must be a string");
                continue;
            }
            registerAudio(id, value.get<std::string>(), source + "/audio/" + id);
        }
    }

    auto registerArray = [&](const char* key) {
        const json* entries = arrayField(root, key);
        if (!entries) return;
        int index = 0;
        for (const auto& entry : *entries) {
            registerAudio(stringField(entry, "id"),
                          stringField(entry, "path"),
                          source + "/" + key + "/" + std::to_string(index));
            ++index;
        }
    };
    registerArray("sounds");
    registerArray("bgm");
}

void collectAndValidateAudio(const std::unordered_map<std::string, json>& databases,
                             const fs::path& projectRoot,
                             DatabaseIndex& db,
                             rpg::RuntimeValidationReport& report) {
    seedDefaultAudioRegistry(db);
    auto audioIt = databases.find("audio");
    if (audioIt != databases.end()) {
        collectAudioRegistryFromJson(audioIt->second, "database/audio", projectRoot, db, report);
    }
    auto systemIt = databases.find("system");
    if (systemIt != databases.end()) {
        collectAudioRegistryFromJson(systemIt->second, "database/system", projectRoot, db, report);
        const std::string defaultBgm = stringField(systemIt->second, "defaultBgm");
        if (!defaultBgm.empty() && !containsId(db.audioIds, defaultBgm)) {
            addError(report, "database/system/defaultBgm",
                     "System defaultBgm references unknown audio id \"" +
                         defaultBgm + "\"");
        }
    }
}

void validateItemRuntimeData(const std::unordered_map<std::string, json>& databases,
                             rpg::RuntimeValidationReport& report) {
    auto itemsIt = databases.find("items");
    if (itemsIt == databases.end()) return;

    const json* items = arrayField(itemsIt->second, "items");
    if (!items) return;

    for (const auto& item : *items) {
        const std::string itemId = stringField(item, "id");
        const std::string source = "database/items/" + itemId;
        validateNonNegativeNumber(
            report,
            item,
            "price",
            source,
            "Item \"" + itemId + "\" price");

        auto effectIt = item.find("effect");
        if (effectIt != item.end() && effectIt->is_object()) {
            validateFiniteNumber(
                report,
                *effectIt,
                "hp",
                source,
                "Item \"" + itemId + "\" effect.hp");
            validateFiniteNumber(
                report,
                *effectIt,
                "mp",
                source,
                "Item \"" + itemId + "\" effect.mp");
        }

        auto modifiersIt = item.find("modifiers");
        if (modifiersIt != item.end() && modifiersIt->is_object()) {
            for (const char* field : statFieldNames()) {
                validateFiniteNumber(
                    report,
                    *modifiersIt,
                    field,
                    source,
                    "Item \"" + itemId + "\" modifier " + std::string(field));
            }
        }

        const std::string slot = stringField(item, "slot");
        if (!slot.empty() && !isSupportedRuntimeEquipmentSlot(slot)) {
            addError(report, source,
                     "Item \"" + itemId +
                         "\" uses unsupported equipment slot \"" + slot + "\"");
        }
    }
}

void validateDatabaseReferences(const std::unordered_map<std::string, json>& databases,
                                const DatabaseIndex& db,
                                rpg::RuntimeValidationReport& report) {
    validateItemRuntimeData(databases, report);

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

    auto actorsIt = databases.find("actors");
    if (actorsIt != databases.end()) {
        const json* actors = arrayField(actorsIt->second, "actors");
        if (actors) {
            for (const auto& actor : *actors) {
                const std::string actorId = stringField(actor, "id");
                const std::string classId = stringField(actor, "classId");
                if (!classId.empty() && !containsId(db.classes, classId)) {
                    addError(report, "database/actors/" + actorId,
                             "Actor \"" + actorId + "\" references unknown class \"" +
                                 classId + "\"");
                }

                auto equipmentIt = actor.find("equipment");
                if (equipmentIt != actor.end() && equipmentIt->is_object()) {
                    for (const auto& [slot, value] : equipmentIt->items()) {
                        if (!isSupportedRuntimeEquipmentSlot(slot)) {
                            addError(report, "database/actors/" + actorId,
                                     "Actor \"" + actorId +
                                         "\" equipment slot \"" + slot +
                                         "\" is not supported by the runtime");
                        }
                        if (!value.is_string()) continue;
                        const std::string itemId = value.get<std::string>();
                        if (!itemId.empty() && !containsId(db.items, itemId)) {
                            addError(report, "database/actors/" + actorId,
                                     "Actor \"" + actorId + "\" equips unknown item \"" +
                                         itemId + "\" in slot \"" + slot + "\"");
                        }
                    }
                }

                const json* skills = arrayField(actor, "skills");
                if (skills) {
                    for (const auto& skill : *skills) {
                        if (!skill.is_string()) continue;
                        const std::string skillId = skill.get<std::string>();
                        if (!skillId.empty() && !containsId(db.skills, skillId)) {
                            addError(report, "database/actors/" + actorId,
                                     "Actor \"" + actorId +
                                         "\" references unknown skill \"" + skillId + "\"");
                        }
                    }
                }
            }
        }
    }

    auto classesIt = databases.find("classes");
    if (classesIt != databases.end()) {
        const json* classes = arrayField(classesIt->second, "classes");
        if (classes) {
            for (const auto& klass : *classes) {
                const std::string classId = stringField(klass, "id");
                const json* learnedSkills = arrayField(klass, "learnedSkills");
                if (!learnedSkills) continue;
                for (const auto& learned : *learnedSkills) {
                    const std::string skillId = stringField(learned, "skillId");
                    if (!skillId.empty() && !containsId(db.skills, skillId)) {
                        addError(report, "database/classes/" + classId,
                                 "Class \"" + classId +
                                     "\" references unknown learned skill \"" +
                                     skillId + "\"");
                    }
                }
            }
        }
    }

    auto enemiesIt = databases.find("enemies");
    if (enemiesIt != databases.end()) {
        const json* enemies = arrayField(enemiesIt->second, "enemies");
        if (enemies) {
            for (const auto& enemy : *enemies) {
                const std::string enemyId = stringField(enemy, "id");
                const std::string source = "database/enemies/" + enemyId;
                validateEnemyStats(report, enemy, enemyId, source);
                validateNonNegativeNumber(
                    report,
                    enemy,
                    "exp",
                    source,
                    "Enemy \"" + enemyId + "\" exp");
                validateNonNegativeNumber(
                    report,
                    enemy,
                    "gold",
                    source,
                    "Enemy \"" + enemyId + "\" gold");
                const json* drops = arrayField(enemy, "drops");
                if (!drops) continue;
                for (const auto& drop : *drops) {
                    const std::string itemId = stringField(drop, "itemId");
                    if (!itemId.empty() && !containsId(db.items, itemId)) {
                        addError(report, source,
                                 "Enemy \"" + enemyId +
                                     "\" drops unknown item \"" + itemId + "\"");
                    }
                    auto rateIt = drop.find("rate");
                    if (rateIt != drop.end()) {
                        double rate = 0.0;
                        if (!finiteNumber(*rateIt, rate) || rate < 0.0 || rate > 1.0) {
                            addError(report, source,
                                     "Enemy \"" + enemyId +
                                         "\" drop rate must be between 0 and 1");
                        }
                    }
                }
            }
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
                if (members->empty()) {
                    addError(report, "database/troops/" + troopId,
                             "Troop \"" + troopId +
                                 "\" must contain at least one enemy");
                }
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
    if (!map.bgm.empty() && !containsId(db.audioIds, map.bgm)) {
        addError(report, mapSource, "Map \"" + map.id +
                                  "\" references unknown BGM audio id \"" +
                                  map.bgm + "\"");
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
    collectAndValidateAudio(databaseJsons, projectRoot, db, report);
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
