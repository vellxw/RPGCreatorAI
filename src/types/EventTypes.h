#pragma once
#include <string>
#include <vector>
#include <memory>
#include "types/Vec2i.h"

struct EventCommand {
    std::string type;
    
    // Command specific fields (we use a fat struct for Phase 1 simplicity)
    std::string speaker;
    std::string text;
    
    std::string flag;
    bool boolValue;
    
    std::string itemId;
    int amount;
    
    std::string mapId;
    int x;
    int y;
    std::string direction;
    
    int ms;
    std::string soundId;
    
    // For ifFlag
    std::vector<std::shared_ptr<EventCommand>> thenCommands;
    std::vector<std::shared_ptr<EventCommand>> elseCommands;
};

struct EventData {
    std::string id;
    std::string type;
    int x;
    int y;
    bool solid;
    std::string sprite;
    std::string trigger; // "interact", "touch"
    std::vector<std::shared_ptr<EventCommand>> commands;
};
