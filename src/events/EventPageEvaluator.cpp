#include "events/EventPageEvaluator.h"
#include "events/GameState.h"

namespace {

bool compareInts(int lhs, int rhs, const std::string& op) {
    if (op == "eq") return lhs == rhs;
    if (op == "neq") return lhs != rhs;
    if (op == "gt") return lhs > rhs;
    if (op == "gte") return lhs >= rhs;
    if (op == "lt") return lhs < rhs;
    if (op == "lte") return lhs <= rhs;
    return false;
}

char conditionLetter(const std::string& id) {
    return id.empty() ? '\0' : id.front();
}

bool conditionMatches(const EventPageCondition& condition,
                      const EventData& event,
                      const GameState& state,
                      const std::string& mapId) {
    if (condition.type == "switch") {
        return state.getSwitch(condition.id) == condition.boolValue;
    }
    if (condition.type == "selfSwitch") {
        return state.getSelfSwitch(mapId, event.id, conditionLetter(condition.id)) == condition.boolValue;
    }
    if (condition.type == "variable") {
        return compareInts(state.getVariable(condition.id), condition.intValue, condition.op);
    }
    return false;
}

bool pageMatches(const EventPage& page,
                 const EventData& event,
                 const GameState& state,
                 const std::string& mapId) {
    for (const auto& condition : page.conditions) {
        if (!conditionMatches(condition, event, state, mapId)) return false;
    }
    return true;
}

bool pageBlocksMovement(const EventPage& page) {
    if (page.options.through) return false;
    if (page.options.solid) return true;
    return page.options.priority == "same" || page.options.priority == "sameAsCharacters";
}

} // namespace

namespace rpg {

const EventPage* selectActiveEventPage(const EventData& event,
                                       const GameState& state,
                                       const std::string& mapId) {
    for (auto it = event.pages.rbegin(); it != event.pages.rend(); ++it) {
        if (pageMatches(*it, event, state, mapId)) return &(*it);
    }
    return nullptr;
}

bool eventHasActivePage(const EventData& event,
                        const GameState& state,
                        const std::string& mapId) {
    return event.pages.empty() || selectActiveEventPage(event, state, mapId) != nullptr;
}

std::string activeEventTrigger(const EventData& event,
                               const GameState& state,
                               const std::string& mapId) {
    if (event.pages.empty()) return event.trigger;
    const EventPage* page = selectActiveEventPage(event, state, mapId);
    return page ? page->options.trigger : std::string{};
}

bool activeEventBlocksMovement(const EventData& event,
                               const GameState& state,
                               const std::string& mapId) {
    if (event.pages.empty()) return event.solid;
    const EventPage* page = selectActiveEventPage(event, state, mapId);
    return page ? pageBlocksMovement(*page) : false;
}

const std::vector<std::shared_ptr<EventCommand>>& activeEventCommands(
    const EventData& event,
    const GameState& state,
    const std::string& mapId) {
    static const std::vector<std::shared_ptr<EventCommand>> emptyCommands;
    if (event.pages.empty()) return event.commands;
    const EventPage* page = selectActiveEventPage(event, state, mapId);
    return page ? page->commands : emptyCommands;
}

} // namespace rpg
