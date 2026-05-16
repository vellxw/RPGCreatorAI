#pragma once
#include <string>
#include <vector>
#include <memory>
#include "types/Vec2i.h"

// Phase 6 — fat event command struct that covers every v1 command.
// We intentionally use a single struct (rather than std::variant) to keep
// JSON parsing simple and the existing tests/api stable; only the fields
// matching the active `type` are read by the runtime.
struct EventCommand {
    std::string type;

    // showText / comment
    std::string speaker;
    std::string text;

    // setFlag / ifFlag
    std::string flag;
    bool boolValue = false;

    // typed switches (controlSwitch / ifSwitch)
    std::string switchId;

    // typed variables (controlVariable / ifVariable)
    std::string variableId;
    std::string sourceVariableId;
    std::string varOp;       // "set", "add", "sub", "mul", "div", "mod"
    int varValue = 0;
    std::string compareOp;   // "eq", "neq", "gt", "gte", "lt", "lte"

    // addItem / removeItem
    std::string itemId;
    int amount = 0;

    // gold
    int goldAmount = 0;

    // transferMap / setPlayerPosition
    std::string mapId;
    int x = 0;
    int y = 0;
    std::string direction;

    // wait
    int ms = 0;

    // playSound
    std::string soundId;

    // callCommonEvent
    std::string commonEventId;

    // quests
    std::string questId;
    std::string objectiveId;
    std::string objectiveState;  // "open" or "done"

    // shops
    std::string shopId;

    // battles
    std::string troopId;
    bool canEscape = false;

    // changeActorHp
    std::string actorId;
    int delta = 0;

    // showChoices
    std::string prompt;
    struct Choice {
        std::string label;
        std::vector<std::shared_ptr<EventCommand>> commands;
    };
    std::vector<Choice> choices;

    // Branches (ifFlag / ifSwitch / ifVariable / startBattle)
    std::vector<std::shared_ptr<EventCommand>> thenCommands;
    std::vector<std::shared_ptr<EventCommand>> elseCommands;
    std::vector<std::shared_ptr<EventCommand>> victoryBranch;
    std::vector<std::shared_ptr<EventCommand>> defeatBranch;
};

struct EventData {
    std::string id;
    std::string type;
    int x = 0;
    int y = 0;
    bool solid = false;
    std::string sprite;
    std::string trigger; // "interact", "touch", "autorun", "parallel"
    std::vector<std::shared_ptr<EventCommand>> commands;
};
