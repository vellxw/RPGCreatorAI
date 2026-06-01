#include <doctest/doctest.h>
#include "events/EventPageEvaluator.h"
#include "events/GameState.h"

namespace {

EventPage makePage(const std::string& trigger,
                   const std::string& priority = "belowCharacters") {
    EventPage page;
    page.options.trigger = trigger;
    page.options.priority = priority;
    return page;
}

EventPageCondition selfSwitchCondition(const std::string& id, bool value) {
    EventPageCondition condition;
    condition.type = "selfSwitch";
    condition.id = id;
    condition.boolValue = value;
    return condition;
}

EventPageCondition switchCondition(const std::string& id, bool value) {
    EventPageCondition condition;
    condition.type = "switch";
    condition.id = id;
    condition.boolValue = value;
    return condition;
}

EventPageCondition variableCondition(const std::string& id,
                                     const std::string& op,
                                     int value) {
    EventPageCondition condition;
    condition.type = "variable";
    condition.id = id;
    condition.op = op;
    condition.intValue = value;
    return condition;
}

std::shared_ptr<EventCommand> command(const std::string& type) {
    auto cmd = std::make_shared<EventCommand>();
    cmd->type = type;
    return cmd;
}

} // namespace

TEST_CASE("EventPageEvaluator selects the highest matching page") {
    GameState state;
    state.setCurrentMap("town");

    EventData event;
    event.id = "chest";
    event.trigger = "interact";
    event.solid = true;

    auto first = makePage("interact", "belowCharacters");
    first.commands = {command("comment")};

    auto second = makePage("touch", "sameAsCharacters");
    second.conditions = {selfSwitchCondition("A", true)};
    second.commands = {command("showText")};

    event.pages = {first, second};

    CHECK(rpg::selectActiveEventPage(event, state, "town") == &event.pages[0]);
    CHECK(rpg::activeEventTrigger(event, state, "town") == "interact");
    CHECK_FALSE(rpg::activeEventBlocksMovement(event, state, "town"));
    CHECK(rpg::activeEventCommands(event, state, "town")[0]->type == "comment");

    state.setSelfSwitch("town", "chest", 'A', true);

    CHECK(rpg::selectActiveEventPage(event, state, "town") == &event.pages[1]);
    CHECK(rpg::activeEventTrigger(event, state, "town") == "touch");
    CHECK(rpg::activeEventBlocksMovement(event, state, "town"));
    CHECK(rpg::activeEventCommands(event, state, "town")[0]->type == "showText");
}

TEST_CASE("EventPageEvaluator requires all page conditions") {
    GameState state;
    state.setSwitch("quest_started", true);
    state.setVariable("score", 3);
    state.setSelfSwitch("town", "npc", 'B', true);

    EventData event;
    event.id = "npc";

    auto page = makePage("parallel");
    page.conditions = {
        switchCondition("quest_started", true),
        variableCondition("score", "gte", 3),
        selfSwitchCondition("B", true),
    };
    event.pages = {page};

    CHECK(rpg::eventHasActivePage(event, state, "town"));

    state.setVariable("score", 2);
    CHECK_FALSE(rpg::eventHasActivePage(event, state, "town"));
    CHECK(rpg::activeEventTrigger(event, state, "town").empty());
    CHECK(rpg::activeEventCommands(event, state, "town").empty());
}

TEST_CASE("EventPageEvaluator honors through and inactive pages") {
    GameState state;
    EventData event;
    event.id = "guard";

    auto blocked = makePage("interact", "sameAsCharacters");
    event.pages = {blocked};
    CHECK(rpg::activeEventBlocksMovement(event, state, "town"));

    event.pages[0].options.through = true;
    CHECK_FALSE(rpg::activeEventBlocksMovement(event, state, "town"));

    event.pages[0].conditions = {selfSwitchCondition("A", true)};
    CHECK_FALSE(rpg::eventHasActivePage(event, state, "town"));
    CHECK(rpg::activeEventTrigger(event, state, "town").empty());
    CHECK(rpg::activeEventCommands(event, state, "town").empty());
}

TEST_CASE("EventPageEvaluator preserves legacy flat events") {
    GameState state;
    EventData event;
    event.id = "door";
    event.trigger = "touch";
    event.solid = true;
    event.commands = {command("transferMap")};

    CHECK(rpg::selectActiveEventPage(event, state, "town") == nullptr);
    CHECK(rpg::eventHasActivePage(event, state, "town"));
    CHECK(rpg::activeEventTrigger(event, state, "town") == "touch");
    CHECK(rpg::activeEventBlocksMovement(event, state, "town"));
    CHECK(rpg::activeEventCommands(event, state, "town")[0]->type == "transferMap");
}

TEST_CASE("EventPageEvaluator exposes render priority with legacy fallback") {
    GameState state;
    EventData event;
    event.id = "npc";
    event.solid = false;

    CHECK(rpg::activeEventRenderPriority(event, state, "town") == "belowCharacters");

    event.solid = true;
    CHECK(rpg::activeEventRenderPriority(event, state, "town") == "sameAsCharacters");

    auto below = makePage("interact", "belowCharacters");
    auto above = makePage("interact", "aboveCharacters");
    above.conditions = {selfSwitchCondition("A", true)};
    event.pages = {below, above};

    CHECK(rpg::activeEventRenderPriority(event, state, "town") == "belowCharacters");

    state.setSelfSwitch("town", "npc", 'A', true);
    CHECK(rpg::activeEventRenderPriority(event, state, "town") == "aboveCharacters");

    event.pages[1].conditions = {selfSwitchCondition("B", true)};
    CHECK(rpg::activeEventRenderPriority(event, state, "town") == "belowCharacters");
}
