#include "world/MapLoader.h"
#include "platform/FileSystem.h"
#include "core/Logger.h"
#include <nlohmann/json.hpp>

using json = nlohmann::json;

static std::shared_ptr<EventCommand> parseCommand(const json& j) {
    auto cmd = std::make_shared<EventCommand>();
    cmd->type = j.at("type").get<std::string>();
    
    if (cmd->type == "showText") {
        cmd->text = j.at("text").get<std::string>();
        if (j.contains("speaker")) {
            cmd->speaker = j.at("speaker").get<std::string>();
        }
    } else if (cmd->type == "setFlag") {
        cmd->flag = j.at("flag").get<std::string>();
        cmd->boolValue = j.at("value").get<bool>();
    } else if (cmd->type == "ifFlag") {
        cmd->flag = j.at("flag").get<std::string>();
        cmd->boolValue = j.at("equals").get<bool>();
        if (j.contains("then")) {
            for (const auto& thenCmd : j.at("then")) {
                cmd->thenCommands.push_back(parseCommand(thenCmd));
            }
        }
        if (j.contains("else")) {
            for (const auto& elseCmd : j.at("else")) {
                cmd->elseCommands.push_back(parseCommand(elseCmd));
            }
        }
    } else if (cmd->type == "addItem") {
        cmd->itemId = j.at("itemId").get<std::string>();
        cmd->amount = j.at("amount").get<int>();
    } else if (cmd->type == "transferMap") {
        cmd->mapId = j.at("mapId").get<std::string>();
        cmd->x = j.at("x").get<int>();
        cmd->y = j.at("y").get<int>();
        cmd->direction = j.at("direction").get<std::string>();
    } else if (cmd->type == "playSound") {
        cmd->soundId = j.at("soundId").get<std::string>();
    } else if (cmd->type == "wait") {
        cmd->ms = j.at("ms").get<int>();
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
        map.width = j.at("width").get<int>();
        map.height = j.at("height").get<int>();
        map.tileSize = j.at("tileSize").get<int>();
        
        for (const auto& layer : j.at("layers")) {
            MapLayer ml;
            ml.name = layer.at("name").get<std::string>();
            ml.type = layer.at("type").get<std::string>();
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
