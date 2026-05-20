#pragma once

#include "types/EventTypes.h"

class GameState;

namespace rpg {

const EventPage* selectActiveEventPage(const EventData& event,
                                       const GameState& state,
                                       const std::string& mapId);

bool eventHasActivePage(const EventData& event,
                        const GameState& state,
                        const std::string& mapId);

std::string activeEventTrigger(const EventData& event,
                               const GameState& state,
                               const std::string& mapId);

bool activeEventBlocksMovement(const EventData& event,
                               const GameState& state,
                               const std::string& mapId);

const std::vector<std::shared_ptr<EventCommand>>& activeEventCommands(
    const EventData& event,
    const GameState& state,
    const std::string& mapId);

} // namespace rpg
