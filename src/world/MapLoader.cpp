#include "world/MapLoader.h"
#include "platform/FileSystem.h"
#include "core/Logger.h"
#include <nlohmann/json.hpp>

using json = nlohmann::json;

static std::shared_ptr<EventCommand> parseCommand(const json& j) {
    auto cmd = std::make_shared<EventCommand>();
    cmd->type = j.at("type").get<std::string>();
    const auto& type = cmd->type;

    if (type == "showText") {
        cmd->text = j.at("text").get<std::string>();
        if (j.contains("speaker")) cmd->speaker = j.at("speaker").get<std::string>();
    } else if (type == "showChoices") {
        cmd->prompt = j.value("prompt", std::string{});
        if (j.contains("choices")) {
            for (const auto& choiceJson : j.at("choices")) {
                EventCommand::Choice ch;
                ch.label = choiceJson.value("label", std::string{});
                if (choiceJson.contains("commands")) {
                    for (const auto& inner : choiceJson.at("commands")) {
                        ch.commands.push_back(parseCommand(inner));
                    }
                }
                cmd->choices.push_back(std::move(ch));
            }
        }
    } else if (type == "setFlag") {
        cmd->flag = j.at("flag").get<std::string>();
        cmd->boolValue = j.at("value").get<bool>();
    } else if (type == "ifFlag") {
        cmd->flag = j.at("flag").get<std::string>();
        cmd->boolValue = j.at("equals").get<bool>();
        if (j.contains("then")) for (const auto& c : j.at("then")) cmd->thenCommands.push_back(parseCommand(c));
        if (j.contains("else")) for (const auto& c : j.at("else")) cmd->elseCommands.push_back(parseCommand(c));
    } else if (type == "ifSwitch") {
        cmd->switchId = j.at("switchId").get<std::string>();
        cmd->boolValue = j.at("equals").get<bool>();
        if (j.contains("then")) for (const auto& c : j.at("then")) cmd->thenCommands.push_back(parseCommand(c));
        if (j.contains("else")) for (const auto& c : j.at("else")) cmd->elseCommands.push_back(parseCommand(c));
    } else if (type == "ifVariable") {
        cmd->variableId = j.at("variableId").get<std::string>();
        cmd->compareOp = j.value("op", std::string{"eq"});
        cmd->varValue = j.value("value", 0);
        if (j.contains("then")) for (const auto& c : j.at("then")) cmd->thenCommands.push_back(parseCommand(c));
        if (j.contains("else")) for (const auto& c : j.at("else")) cmd->elseCommands.push_back(parseCommand(c));
    } else if (type == "controlSwitch") {
        cmd->switchId = j.at("switchId").get<std::string>();
        cmd->boolValue = j.at("value").get<bool>();
    } else if (type == "controlVariable") {
        cmd->variableId = j.at("variableId").get<std::string>();
        cmd->varOp = j.value("op", std::string{"set"});
        cmd->varValue = j.value("value", 0);
        if (j.contains("sourceVariableId")) cmd->sourceVariableId = j.at("sourceVariableId").get<std::string>();
    } else if (type == "addItem" || type == "removeItem") {
        cmd->itemId = j.at("itemId").get<std::string>();
        cmd->amount = j.at("amount").get<int>();
    } else if (type == "addGold" || type == "removeGold") {
        cmd->goldAmount = j.at("amount").get<int>();
    } else if (type == "transferMap" || type == "setPlayerPosition") {
        cmd->mapId = j.at("mapId").get<std::string>();
        cmd->x = j.at("x").get<int>();
        cmd->y = j.at("y").get<int>();
        cmd->direction = j.at("direction").get<std::string>();
    } else if (type == "playSound") {
        cmd->soundId = j.at("soundId").get<std::string>();
    } else if (type == "wait") {
        cmd->ms = j.at("ms").get<int>();
    } else if (type == "comment") {
        cmd->text = j.value("text", std::string{});
    } else if (type == "callCommonEvent") {
        cmd->commonEventId = j.at("commonEventId").get<std::string>();
    } else if (type == "startQuest" || type == "completeQuest") {
        cmd->questId = j.at("questId").get<std::string>();
    } else if (type == "updateQuestObjective") {
        cmd->questId = j.at("questId").get<std::string>();
        cmd->objectiveId = j.at("objectiveId").get<std::string>();
        cmd->objectiveState = j.value("state", std::string{"done"});
    } else if (type == "openShop") {
        cmd->shopId = j.at("shopId").get<std::string>();
    } else if (type == "startBattle") {
        cmd->troopId = j.at("troopId").get<std::string>();
        cmd->canEscape = j.value("canEscape", false);
        if (j.contains("victoryBranch"))
            for (const auto& c : j.at("victoryBranch")) cmd->victoryBranch.push_back(parseCommand(c));
        if (j.contains("defeatBranch"))
            for (const auto& c : j.at("defeatBranch")) cmd->defeatBranch.push_back(parseCommand(c));
    } else if (type == "changeActorHp") {
        cmd->actorId = j.at("actorId").get<std::string>();
        cmd->delta = j.at("delta").get<int>();
    } else if (type == "playAnimation") {
        cmd->animationTarget = j.value("target", std::string{"player"});
        cmd->animationEventId = j.value("eventId", std::string{});
        cmd->animationAction = j.value("action", std::string{"idle"});
        cmd->animationDirection = j.value("direction", std::string{"current"});
        cmd->animationDurationMs = j.value("durationMs", 0);
        cmd->animationBlocking = j.value("blocking", false);
        cmd->animationLoop = j.value("loop", false);
    } else {
        Logger::warning("MapLoader: unknown command type '" + type + "' (kept as opaque)");
    }

    return cmd;
}

std::optional<MapData> MapLoader::load(const std::string& path) {
    auto content = FileSystem::readFile(path);
    if (!content) {
        Logger::error("Failed to read map file: " + path);
        return std::nullopt;
    }

    try {
        json j = json::parse(*content);
        MapData map;

        map.schemaVersion = j.at("schemaVersion").get<int>();
        if (map.schemaVersion != 1) {
            Logger::error("Unsupported map schemaVersion in " + path +
                          ": expected 1, received " + std::to_string(map.schemaVersion));
            return std::nullopt;
        }
        map.id = j.at("id").get<std::string>();
        map.name = j.at("name").get<std::string>();
        map.displayName = j.value("displayName", std::string{});
        map.tilesetId = j.value("tilesetId", std::string{});
        map.width = j.at("width").get<int>();
        map.height = j.at("height").get<int>();
        map.tileSize = j.at("tileSize").get<int>();

        for (const auto& layer : j.at("layers")) {
            MapLayer ml;
            ml.name = layer.at("name").get<std::string>();
            ml.type = layer.at("type").get<std::string>();
            ml.role = layer.value("role", std::string{});
            ml.visible = layer.value("visible", true);
            ml.locked = layer.value("locked", false);
            for (int tileId : layer.at("tiles")) {
                ml.tiles.push_back(tileId);
            }
            const int expected = map.width * map.height;
            if (static_cast<int>(ml.tiles.size()) != expected) {
                Logger::error("Layer '" + ml.name + "' tile count mismatch in " + path +
                              ": expected " + std::to_string(expected) +
                              " (width*height), got " + std::to_string(ml.tiles.size()));
                return std::nullopt;
            }
            map.layers.push_back(ml);
        }

        for (const auto& evt : j.at("events")) {
            EventData ed;
            ed.id = evt.at("id").get<std::string>();
            ed.type = evt.at("type").get<std::string>();
            ed.x = evt.at("x").get<int>();
            ed.y = evt.at("y").get<int>();
            ed.solid = evt.value("solid", false);
            ed.sprite = evt.value("sprite", "");
            ed.animationSet = evt.value("animationSet", "");
            ed.displayHeightTiles = evt.value("displayHeightTiles", 0.0f);
            ed.trigger = evt.value("trigger", "interact");

            for (const auto& cmd : evt.at("commands")) {
                ed.commands.push_back(parseCommand(cmd));
            }

            map.events.push_back(ed);
        }

        return map;
    } catch (const json::exception& e) {
        Logger::error(std::string("JSON parsing error in map: ") + path + " - " + e.what());
        return std::nullopt;
    }
}
